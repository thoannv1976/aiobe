import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient, AI_MODEL } from "./anthropic";
import { cleanRawText } from "./text-cleaner";

// =========================================================
// Schema
// =========================================================

const BloomEnum = z
  .enum(["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"])
  .nullable();
const CategoryEnum = z.enum(["Kiến thức", "Kỹ năng", "Thái độ"]).nullable();

const PISchema = z.object({
  code: z.string().describe("Mã PI dạng PI1.1, PI1.2, PI2.1..."),
  description: z.string(),
});

const PLOSchema = z.object({
  code: z.string().describe("Mã PLO dạng PLO1, PLO2..."),
  description: z.string().describe("Mô tả đầy đủ, không cắt giữa câu"),
  category: CategoryEnum,
  bloomLevel: BloomEnum,
  pis: z.array(PISchema),
});

const CourseSchema = z.object({
  code: z.string().describe("Mã học phần đầy đủ (VD ESP111, KTEE201, TRIH114)"),
  name: z
    .string()
    .describe(
      "Tên đầy đủ tiếng Việt, không kèm tên tiếng Anh trong ngoặc",
    ),
  credits: z.number().int().min(1).max(12),
  semester: z.number().int().min(1).max(12).nullable(),
  type: z
    .enum(["Đại cương", "Cơ sở ngành", "Chuyên ngành", "Tự chọn", "Khác"])
    .nullable(),
});

// Schema cho pass 1: PLO/PI/goals
const PLOsResultSchema = z.object({
  programGoals: z.string().nullable(),
  plos: z.array(PLOSchema),
});

// Schema cho pass 2: Courses
const CoursesResultSchema = z.object({
  courses: z.array(CourseSchema),
});

// Schema kết hợp (xuất ra)
const ExtractionResultSchema = z.object({
  programGoals: z.string().nullable(),
  plos: z.array(PLOSchema),
  courses: z.array(CourseSchema),
});

export type AIExtractionResult = z.infer<typeof ExtractionResultSchema>;

// =========================================================
// Prompts — TÁCH RIÊNG cho PLO vs Courses để mỗi call nhỏ + nhanh
// =========================================================

const PLO_SYSTEM_PROMPT = `Bạn là chuyên gia phân tích đề án mở ngành đào tạo bậc đại học Việt Nam theo AUN-QA / OBE.

Nhiệm vụ: trích xuất CHỈ 2 thứ:
1. **PLO + PI** (Program Learning Outcomes + Performance Indicators)
2. **Mục tiêu chương trình** (PEO)

LOẠI BỎ:
- Mục lục (TOC): "1.5 Tiêu đề ... 5", "2. Sự cần thiết ... 12" — KHÔNG đưa vào programGoals.
- Page numbers, header/footer, tên trường lặp.

Quy tắc PLO:
- Mã chuẩn "PLO1", "PLO2"... đánh số liên tục (chuyển CĐR/ELO → PLO).
- Description ĐẦY ĐỦ, không cắt giữa câu — ghép nhiều dòng nếu cần.
- Bloom: dùng "(Bloom N)" nếu có trong text. Nếu không, suy từ động từ chính.
  1=Remember, 2=Understand, 3=Apply, 4=Analyze, 5=Evaluate, 6=Create
- Category: Kiến thức / Kỹ năng / Thái độ.

Quy tắc PI:
- Mã "PI1.1", "PI1.2", "PI2.1"... PI<X>.<Y> thuộc PLO<X>.

Quy tắc programGoals:
- Đoạn văn trong phần "Mục tiêu đào tạo" / "Mục tiêu chung" / "PEO" / "Mục tiêu của chương trình".
- KHÔNG dùng TOC entry "Mục tiêu... 5" làm goals. Phải là đoạn văn thực sự.
- Nếu không có, trả null.

KHÔNG cần trích xuất học phần — sẽ có call khác xử lý.`;

const COURSES_SYSTEM_PROMPT = `Bạn là chuyên gia phân tích đề án mở ngành đào tạo bậc đại học Việt Nam.

Nhiệm vụ: trích xuất TOÀN BỘ học phần trong khung chương trình (có thể 30-100 môn).

══════════════════════
FORMAT BẢNG ĐIỂN HÌNH
══════════════════════
Đề án thường có bảng dạng:

| STT | Tên học phần (VN + EN trong ngoặc)              | Mã HP    | Số TC | Tiết LT | TH | KT | Tổng | HP tiên quyết |
| 1   | Triết học Mác-Lênin (Marxist - Leninist Phil.)  | TRIH114  | 3     | 27      | 18 | 30 | 75   | Không         |
| 6   | Toán, xác suất và thống kê (Math, Prob & Stats) | TOAE102  | 3     | 15      | 60 | 0  | 75   | Không         |
| 7   | Pháp luật đại cương (Introduction to Law)       | PLUE111  | 3     | 30      | 15 | 30 | 75   | Không         |

QUY TẮC PARSE BẮT BUỘC:
- Mỗi dòng (hoặc 2-3 dòng nếu tên dài): 1 học phần.
- Tên tiếng Anh trong ngoặc — BỎ, chỉ giữ tên tiếng Việt.
- Mã HP: định dạng [chữ cái][số] như TRIH114, TOAE102, PLUE111, ESP111, KTEE201, DTIE100.
- Số TC: số NGAY SAU mã HP (giá trị 2-6 thông thường, hiếm khi 1 hoặc 7+).
- CÁC SỐ KHÁC trên dòng (15, 18, 27, 30, 45, 60, 75, 90) là SỐ TIẾT — KHÔNG phải TC. Đừng nhầm!

VÍ DỤ:
"1 Triết học Mác-Lênin (Marxist - Leninist Philosophy) TRIH114 3 27 18 30 75 Không"
→ code="TRIH114", name="Triết học Mác-Lênin", credits=3, type="Đại cương" (nếu nằm trong khối Đại cương)

"9 Công nghệ số và ứng dụng trí tuệ nhân tạo (Digital Technologies and AI) TINE210 3 30 30 30 0 90 Không"
→ code="TINE210", name="Công nghệ số và ứng dụng trí tuệ nhân tạo", credits=3

NGỮ CẢNH KHỐI KIẾN THỨC:
- "Khối kiến thức giáo dục đại cương" → type="Đại cương"
- "Cơ sở khối ngành / Cơ sở ngành" → type="Cơ sở ngành"
- "Kiến thức ngành / Chuyên ngành / Chuyên sâu" → type="Chuyên ngành"
- "Tự chọn" → type="Tự chọn"
- "Học phần thực hành / Khóa luận / Đồ án" → type="Chuyên ngành" hoặc "Khác"

QUAN TRỌNG:
- Lấy ĐỦ tất cả môn — đề án có thể có 30-100 môn, KHÔNG được skip.
- Mỗi mã HP xuất hiện 1 LẦN (môn lặp ở "danh mục" + "kế hoạch HK" thì chỉ giữ 1).
- Bỏ qua tổng kết "23 TC", "131 TC tổng", "75.6% chuyên ngành"...
- Bỏ qua dòng tổng cộng / header bảng / số trang.

KHÔNG cần trích xuất PLO/PI — đã có call khác xử lý.`;

// =========================================================
// Pass 1: PLO + PI + Goals
// =========================================================

async function extractPLOs(text: string): Promise<z.infer<typeof PLOsResultSchema>> {
  const client = getAnthropicClient();
  const stream = client.messages.stream({
    model: AI_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: PLO_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Đề án mở ngành đào tạo:\n\n<<<<\n${text}\n>>>>\n\nTrích xuất PLO, PI và programGoals.`,
      },
    ],
    output_config: {
      effort: "medium",
      format: zodOutputFormat(PLOsResultSchema),
    },
  });

  const message = await stream.finalMessage();
  return parseStructured(message, PLOsResultSchema);
}

// =========================================================
// Pass 2: Courses only
// =========================================================

async function extractCoursesOnly(
  text: string,
): Promise<z.infer<typeof CoursesResultSchema>> {
  const client = getAnthropicClient();
  const stream = client.messages.stream({
    model: AI_MODEL,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: COURSES_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Đề án mở ngành đào tạo:\n\n<<<<\n${text}\n>>>>\n\nTrích xuất TOÀN BỘ học phần trong khung chương trình (có thể 30-100 môn). KHÔNG bỏ sót môn nào.`,
      },
    ],
    output_config: {
      effort: "medium",
      format: zodOutputFormat(CoursesResultSchema),
    },
  });

  const message = await stream.finalMessage();
  return parseStructured(message, CoursesResultSchema);
}

// =========================================================
// Helper: parse Claude response (structured output)
// =========================================================

function parseStructured<T>(message: any, schema: z.ZodSchema<T>): T {
  // Ưu tiên parsed_output nếu SDK đã parse
  if (message?.parsed_output) {
    try {
      return schema.parse(message.parsed_output);
    } catch {
      /* fallback */
    }
  }

  // Manual parse JSON từ text content
  const content = Array.isArray(message?.content) ? message.content : [];
  for (const block of content) {
    if (block?.type === "text" && typeof block.text === "string" && block.text) {
      let raw = block.text.trim();
      if (raw.startsWith("```")) {
        raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
      }
      try {
        const json = JSON.parse(raw);
        return schema.parse(json);
      } catch {
        /* try next block */
      }
    }
  }

  throw new Error(
    `AI không trả về output JSON hợp lệ (stop_reason=${message?.stop_reason ?? "unknown"})`,
  );
}

// =========================================================
// Public API: chạy 2 pass SONG SONG để nhanh
// =========================================================

export async function extractWithAI(rawText: string): Promise<AIExtractionResult> {
  const cleaned = cleanRawText(rawText);
  // Sonnet/Opus có context 1M — đủ cho 200 trang PDF (~300K tokens)
  // Nhưng để giảm cost + thinking time, cắt ở 800K chars (~200K tokens)
  const text = cleaned.length > 800_000 ? cleaned.slice(0, 800_000) : cleaned;

  // Chạy song song — giảm wall-time ~2x
  const [plosResult, coursesResult] = await Promise.all([
    extractPLOs(text),
    extractCoursesOnly(text),
  ]);

  return {
    programGoals: plosResult.programGoals,
    plos: plosResult.plos,
    courses: coursesResult.courses,
  };
}
