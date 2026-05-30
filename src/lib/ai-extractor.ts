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

const EXTRACTOR_SYSTEM_PROMPT = `Bạn là chuyên gia phân tích đề án mở ngành đào tạo bậc đại học Việt Nam theo chuẩn AUN-QA và OBE.

Nhiệm vụ: từ văn bản đề án mở ngành (extract từ PDF/DOCX), trích xuất chính xác:
1. **PLO** (Program Learning Outcomes — chuẩn đầu ra chương trình)
2. **PI** (Performance Indicators — chỉ báo thực hiện) cho từng PLO
3. **Danh mục học phần** đầy đủ trong khung chương trình
4. **Mục tiêu chương trình** (PEO — Program Educational Objectives)

LOẠI BỎ HOÀN TOÀN:
- **Mục lục** (Table of Contents): các dòng dạng "1.5 Tiêu đề ... 5", "2. Sự cần thiết ... 12", thường có dấu ".." rồi số trang ở cuối. KHÔNG được trích xuất TOC vào bất kỳ trường nào (kể cả programGoals).
- Page numbers / header / footer / tên trường lặp đi lặp lại.
- Phần phụ lục, biểu mẫu trống, danh sách giảng viên không liên quan.

Quy tắc PLO:
- Mã chuẩn "PLO1", "PLO2"... đánh số liên tục từ 1 (chuyển CĐR1/ELO1 → PLO1).
- PI: "PI1.1", "PI1.2", "PI2.1"... PI<X>.<Y> thuộc PLO<X>.
- Description ĐẦY ĐỦ — ghép nhiều dòng nếu mô tả trải dài, KHÔNG cắt giữa câu.
- Bloom: dùng số rõ trong "(Bloom N)" nếu có (1=Remember, 2=Understand, 3=Apply, 4=Analyze, 5=Evaluate, 6=Create). Nếu không, suy ra từ động từ chính.
- Category: Kiến thức / Kỹ năng / Thái độ.

Quy tắc HỌC PHẦN — quan trọng:
- Học phần thường nằm trong "Khung chương trình", "Cấu trúc chương trình", "Danh mục học phần", "Kế hoạch học tập theo từng học kỳ", chia theo khối kiến thức (Đại cương / Cơ sở ngành / Chuyên ngành / Tự chọn).
- Mã học phần đa dạng: CNTT101, ENGL102, MAT201, KDS498, HP01, BUS501... Có thể có dấu gạch hoặc khoảng trắng giữa chữ và số.
- Tên đầy đủ KỂ CẢ SỐ THỨ TỰ (VD "Tiếng Anh cơ sở 1" giữ nguyên "1", "Toán cao cấp 2" giữ "2").
- Tín chỉ (TC): số nguyên 1-12, lấy từ cột "Số TC" / "Tín chỉ" / "Credits". CẢNH BÁO: đừng nhầm số TC với số học kỳ (HK), số thứ tự (STT), năm học, hay số trong tên môn.
- Nếu PDF có bảng học phần (cột STT / Mã / Tên / TC / HK), bám đúng cột TC.
- Mỗi mã học phần xuất hiện 1 LẦN — bỏ trùng lặp (nếu cùng môn xuất hiện ở danh mục + kế hoạch học tập, chỉ giữ 1).
- Nếu văn bản đề cập "X tín chỉ" cho cả khối, không phải cho 1 môn, KHÔNG đếm số đó là TC của môn lẻ.

Quy tắc MỤC TIÊU CHƯƠNG TRÌNH (programGoals):
- Là đoạn văn bản trong phần "Mục tiêu đào tạo" / "Mục tiêu chung" / "PEO" / "Mục tiêu của chương trình", thường ở chương 4 / mục 4.1 của đề án.
- KHÔNG dùng TOC entry "Mục tiêu... 5" làm programGoals.
- Nếu không tìm thấy đoạn văn rõ ràng, trả null.

Ưu tiên CHÍNH XÁC hơn ĐẦY ĐỦ. Một dòng không chắc là học phần thì bỏ qua.
Trả về tất cả PLO/PI/môn phát hiện được, không giới hạn số lượng.`;

// =========================================================
// API
// =========================================================

export async function extractWithAI(rawText: string): Promise<AIExtractionResult> {
  const client = getAnthropicClient();

  // Tiền xử lý: strip TOC, page numbers, normalize whitespace
  const cleaned = cleanRawText(rawText);
  // Sonnet 4.6 có context 1M nhưng để giảm cost, cắt nếu quá dài
  const text = cleaned.length > 500_000 ? cleaned.slice(0, 500_000) : cleaned;

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
      effort: "high",
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
