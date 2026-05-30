import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient, AI_MODEL } from "./anthropic";
import { cleanRawText } from "./text-cleaner";

// =========================================================
// Schema — structured output từ Claude
// =========================================================

const BloomEnum = z
  .enum(["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"])
  .nullable();
const CategoryEnum = z
  .enum(["Kiến thức", "Kỹ năng", "Thái độ"])
  .nullable();

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
  code: z.string().describe("Mã học phần đầy đủ (VD CNTT101, ESP111, KTEE201)"),
  name: z
    .string()
    .describe(
      "Tên đầy đủ kể cả số thứ tự VD 'Tiếng Anh chuyên ngành 1'. KHÔNG kèm tên tiếng Anh trong ngoặc.",
    ),
  credits: z.number().int().min(1).max(12),
  semester: z.number().int().min(1).max(12).nullable(),
  type: z
    .enum(["Đại cương", "Cơ sở ngành", "Chuyên ngành", "Tự chọn", "Khác"])
    .nullable(),
});

const ExtractionResultSchema = z.object({
  programGoals: z
    .string()
    .nullable()
    .describe("Mục tiêu chương trình đào tạo (PEO), nếu có"),
  plos: z.array(PLOSchema),
  courses: z.array(CourseSchema),
});

export type AIExtractionResult = z.infer<typeof ExtractionResultSchema>;

// =========================================================
// Prompt
// =========================================================

const EXTRACTOR_SYSTEM_PROMPT = `Bạn là chuyên gia phân tích đề án mở ngành đào tạo bậc đại học Việt Nam theo chuẩn AUN-QA và OBE.

Nhiệm vụ: từ văn bản đề án mở ngành (extract từ PDF/DOCX), trích xuất CHÍNH XÁC và ĐẦY ĐỦ:
1. **PLO** (Program Learning Outcomes — chuẩn đầu ra chương trình)
2. **PI** (Performance Indicators — chỉ báo thực hiện) cho từng PLO
3. **Toàn bộ học phần** trong khung chương trình (có thể có 30-80 học phần)
4. **Mục tiêu chương trình** (PEO — Program Educational Objectives)

LOẠI BỎ HOÀN TOÀN:
- **Mục lục** (TOC): "1.5 Tiêu đề ... 5", "2. Sự cần thiết ... 12" — KHÔNG đưa vào programGoals.
- Page numbers, header/footer, tên trường lặp đi lặp lại.
- Phần phụ lục, biểu mẫu trống, danh sách giảng viên.

══════════════════════
QUY TẮC HỌC PHẦN (QUAN TRỌNG NHẤT)
══════════════════════
Đề án thường có MỘT bảng lớn dạng:

| STT | Tên học phần (VN + EN trong ngoặc) | Mã HP | Số TC | Số tiết LT | TH | KT | Tổng | HP tiên quyết |
| 1   | Tiếng Anh chuyên ngành 1            | ESP111| 3     | 30         | 30 | 30 | 90   | Không         |
|     | (English for Specific Purpose 1)    |       |       |            |    |    |      |               |

QUY TẮC:
- Tên tiếng Anh trong ngoặc (English for Specific Purpose 1...) là MÔ TẢ thêm — KHÔNG đưa vào tên môn. Chỉ giữ tên tiếng Việt.
- Mã HP đứng ở cột riêng (ESP111, KTEE201, QTRE303, TINE210...) — định dạng [3-5 chữ cái][2-4 chữ số].
- Số TC là số đứng NGAY SAU mã HP (cột "Số TC" hoặc "Số tín chỉ"). Đây là số nguyên 2-6 thông thường, hiếm khi ≥7.
- CÁC SỐ KHÁC trên cùng dòng (30, 30, 30, 0, 90...) là số tiết / điểm — KHÔNG phải TC. Đừng nhầm lẫn.
- Nếu một dòng có dạng "9 Công nghệ số và ứng dụng trí tuệ nhân tạo (Digital Technologies and AI Applications) TINE210 3 30 30 30 0 90 Không":
    + STT=9 (bỏ qua)
    + name="Công nghệ số và ứng dụng trí tuệ nhân tạo"
    + code="TINE210"
    + credits=3 (số đầu tiên sau mã HP)
    + các số 30,30,30,0,90 là tiết học (bỏ qua)
- Mỗi mã HP xuất hiện 1 LẦN — bỏ trùng (nếu môn xuất hiện ở "danh mục" + "kế hoạch học tập", chỉ giữ 1).
- "Tự chọn" và "Bắt buộc" là type nếu xác định được từ section header.
- Đề án có thể chia theo:
    + Khối Đại cương / Cơ sở ngành / Chuyên ngành / Tự chọn
    + Nhóm "Tiếng Anh chuyên ngành 1..N" — phải lấy ĐỦ CẢ N môn.
- Nếu có 30+ học phần, PHẢI trích xuất hết — không skip để rút gọn.

══════════════════════
QUY TẮC PLO / PI
══════════════════════
- Mã chuẩn "PLO1", "PLO2"... đánh số liên tục (chuyển CĐR1/ELO1 → PLO1).
- PI: "PI1.1", "PI1.2", "PI2.1"... PI<X>.<Y> thuộc PLO<X>.
- Description ĐẦY ĐỦ — ghép nhiều dòng, KHÔNG cắt giữa câu.
- Bloom: dùng số rõ trong "(Bloom N)" nếu có (1=Remember, 2=Understand, 3=Apply, 4=Analyze, 5=Evaluate, 6=Create). Nếu không, suy ra từ động từ chính.
- Category: Kiến thức / Kỹ năng / Thái độ.

══════════════════════
QUY TẮC MỤC TIÊU CHƯƠNG TRÌNH
══════════════════════
- Là đoạn văn bản trong phần "Mục tiêu đào tạo" / "Mục tiêu chung" / "PEO".
- KHÔNG dùng TOC entry "Mục tiêu... 5" làm programGoals.
- Nếu không có đoạn rõ ràng, trả null.

Trả về TẤT CẢ PLO/PI/học phần phát hiện được, không giới hạn số lượng.`;

// =========================================================
// API — dùng streaming để tránh timeout với đề án dài
// =========================================================

export async function extractWithAI(rawText: string): Promise<AIExtractionResult> {
  const client = getAnthropicClient();

  const cleaned = cleanRawText(rawText);
  const text = cleaned.length > 500_000 ? cleaned.slice(0, 500_000) : cleaned;

  // Dùng stream() thay vì parse() để:
  //  - giữ kết nối tới Anthropic API "alive" trong suốt quá trình thinking
  //  - tránh HTTP idle timeout của SDK với request dài
  //  - cho phép max_tokens lớn (đề án dài có 60+ học phần × ~80 token/môn)
  const stream = client.messages.stream({
    model: AI_MODEL,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: EXTRACTOR_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Đây là văn bản đề án mở ngành đào tạo cần trích xuất TOÀN BỘ PLO/PI/học phần:\n\n<<<<\n${text}\n>>>>\n\nTrích xuất theo cấu trúc đã chỉ định. Lưu ý đặc biệt:\n- Đảm bảo lấy ĐẦY ĐỦ tất cả học phần trong khung chương trình (có thể 30-80 môn)\n- Tên môn KHÔNG kèm tên tiếng Anh trong ngoặc\n- Số TC là số ngay sau mã HP (2-6), không nhầm với số tiết (30, 45, 60, 90)`,
      },
    ],
    output_config: {
      effort: "medium", // medium đủ cho task này, nhanh hơn high ~40%
      format: zodOutputFormat(ExtractionResultSchema),
    },
  });

  const message = await stream.finalMessage();

  // Ưu tiên parsed_output nếu SDK đã parse sẵn
  const anyMsg = message as unknown as { parsed_output?: unknown };
  if (anyMsg.parsed_output) {
    try {
      return ExtractionResultSchema.parse(anyMsg.parsed_output);
    } catch {
      // fallback xuống manual parse
    }
  }

  // Manual parse từ text content
  for (const block of message.content) {
    if (block.type === "text" && block.text) {
      // Anthropic structured output trả JSON trong text block.
      // Có khi có markdown fence ```json — strip nếu có.
      let raw = block.text.trim();
      if (raw.startsWith("```")) {
        raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
      }
      try {
        const json = JSON.parse(raw);
        return ExtractionResultSchema.parse(json);
      } catch {
        // try next block
      }
    }
  }

  throw new Error(
    `AI không trả về output JSON hợp lệ (stop_reason=${message.stop_reason})`,
  );
}
