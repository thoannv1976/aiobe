import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient, AI_MODEL } from "./anthropic";

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
  code: z.string().describe("Mã học phần đầy đủ (VD CNTT101, ENGL102)"),
  name: z.string().describe("Tên đầy đủ kể cả số thứ tự VD 'Tiếng Anh cơ sở 1'"),
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

const EXTRACTOR_SYSTEM_PROMPT = `Bạn là chuyên gia phân tích chương trình đào tạo bậc đại học theo chuẩn AUN-QA và OBE (Outcome-Based Education).

Nhiệm vụ: từ văn bản đề án mở ngành đào tạo, trích xuất chính xác:
1. **PLO** (Program Learning Outcomes — chuẩn đầu ra chương trình)
2. **PI** (Performance Indicators — chỉ báo thực hiện) cho từng PLO
3. **Danh mục học phần** đầy đủ
4. **Mục tiêu chương trình** (PEO)

Quy tắc bắt buộc:
- PLO mã chuẩn dạng "PLO1", "PLO2", ... đánh số liên tục từ 1, KHÔNG bỏ số nào (chuyển CĐR1/ELO1/PLO1 thành PLO1).
- PI mã dạng "PI1.1", "PI1.2", "PI2.1"... PI1.x thuộc PLO1, v.v.
- Mỗi PLO PHẢI có description ĐẦY ĐỦ, không cắt giữa câu — ghép các dòng liên tiếp nếu mô tả PLO trải qua nhiều dòng.
- Bloom level dựa vào động từ chính (Vận dụng/Áp dụng → Apply, Phân tích → Analyze, Đánh giá → Evaluate, Sáng tạo/Thiết kế → Create, Hiểu/Giải thích → Understand, Nhớ/Liệt kê → Remember). Nếu trong PLO có ghi rõ "(Bloom N)" thì dùng số đó: 1=Remember, 2=Understand, 3=Apply, 4=Analyze, 5=Evaluate, 6=Create.
- Category: Kiến thức (knowledge — kiến thức, hiểu biết, am hiểu), Kỹ năng (skill — kỹ năng, thao tác, làm việc nhóm, giao tiếp), Thái độ (attitude — đạo đức, trách nhiệm, hành vi, phẩm chất).
- Học phần: PHẢI dùng mã đầy đủ (VD "CNTT101", "ENGL102"), tên đầy đủ KỂ CẢ SỐ THỨ TỰ (VD "Tiếng Anh cơ sở 1", "Toán cao cấp 2" — không cắt số). Số tín chỉ là số nguyên 1-12, lấy đúng từ cột "Số TC" / "Tín chỉ", KHÔNG nhầm với số học kỳ hay số trong tên môn.
- Bỏ qua header bảng (STT, MÃ HP, TÊN HỌC PHẦN, SỐ TC, HK, GHI CHÚ), số trang, footer.
- Nếu không có phần nào, trả về array rỗng.
- Trả về tất cả PLO/PI/môn học phát hiện được, không giới hạn số lượng.

Ưu tiên CHÍNH XÁC hơn là đầy đủ. Nếu một dòng không chắc chắn là học phần, đừng đưa vào.`;

// =========================================================
// API
// =========================================================

export async function extractWithAI(rawText: string): Promise<AIExtractionResult> {
  const client = getAnthropicClient();

  // Sonnet 4.6 có context 1M, không cần truncate cho file thông thường
  // Nhưng nếu raw text quá dài (>500KB), cắt phần cuối để tránh chi phí
  const text =
    rawText.length > 500_000 ? rawText.slice(0, 500_000) : rawText;

  const response = await client.messages.parse({
    model: AI_MODEL,
    max_tokens: 16000,
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
        content: `Đây là văn bản đề án mở ngành đào tạo cần trích xuất:\n\n<<<<\n${text}\n>>>>\n\nTrích xuất theo cấu trúc đã chỉ định. Đảm bảo description PLO không bị cắt giữa câu, tên học phần đầy đủ kể cả số thứ tự.`,
      },
    ],
    output_config: {
      format: zodOutputFormat(ExtractionResultSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error(
      `AI không sinh được output có cấu trúc. stop_reason=${response.stop_reason}`,
    );
  }
  return response.parsed_output;
}
