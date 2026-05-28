import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient, AI_MODEL } from "./anthropic";

// =========================================================
// 1. Gợi ý CLO cho học phần
// =========================================================

const CLOSuggestionSchema = z.object({
  code: z.string(),
  description: z.string(),
  category: z.enum(["Kiến thức", "Kỹ năng", "Thái độ"]).nullable(),
  bloomLevel: z
    .enum(["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"])
    .nullable(),
  // Gợi ý map sang PLO nào (mã PLO, vd "PLO1") với mức I/R/M/A
  suggestedPLOMaps: z.array(
    z.object({
      ploCode: z.string(),
      contribution: z.enum(["I", "R", "M", "A"]),
    }),
  ),
});

const CLOSuggestionsResultSchema = z.object({
  clos: z.array(CLOSuggestionSchema).min(3).max(8),
});

export type AICLOSuggestions = z.infer<typeof CLOSuggestionsResultSchema>;

const CLO_SYSTEM_PROMPT = `Bạn là chuyên gia thiết kế đề cương học phần theo chuẩn OBE / AUN-QA.

Nhiệm vụ: với một học phần (tên + mô tả) thuộc chương trình đào tạo có sẵn các PLO, hãy đề xuất 3-8 CLO (Course Learning Outcomes — chuẩn đầu ra học phần) đáp ứng:

1. **Bám sát nội dung học phần** — CLO phải tương ứng với nội dung học phần.
2. **Đóng góp vào PLO** — mỗi CLO phải map được vào ÍT NHẤT 1 PLO của chương trình. Quy ước:
   - I (Introduce): học phần giới thiệu khái niệm, sinh viên mới làm quen
   - R (Reinforce): học phần củng cố, sinh viên đã có nền tảng
   - M (Master): học phần giúp sinh viên thành thạo
   - A (Assess): học phần có hoạt động đánh giá trực tiếp đầu ra này
3. **Phân bổ Bloom hợp lý** — không nên tất cả ở mức "Remember", phải có cả Apply/Analyze/Create cho học phần chuyên ngành.
4. **Category cân đối** — kiến thức + kỹ năng + (thái độ nếu phù hợp).
5. **Mã CLO** dạng CLO1, CLO2,... đánh số liên tục từ 1.
6. **Mô tả CLO** dùng động từ Bloom rõ ràng, có thể đo lường được (tránh "hiểu" mơ hồ, dùng "giải thích", "trình bày", "phân tích"...).

Ưu tiên CHẤT LƯỢNG hơn số lượng. 3-5 CLO chất lượng tốt hơn 8 CLO chung chung.`;

export async function suggestCLOs(input: {
  courseCode: string;
  courseName: string;
  courseDescription?: string;
  courseCredits: number;
  programPLOs: { code: string; description: string }[];
}): Promise<AICLOSuggestions> {
  const client = getAnthropicClient();

  const ploListing = input.programPLOs
    .map((p) => `- ${p.code}: ${p.description}`)
    .join("\n");

  const response = await client.messages.parse({
    model: AI_MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: CLO_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Học phần cần thiết kế CLO:
- Mã: ${input.courseCode}
- Tên: ${input.courseName}
- Số tín chỉ: ${input.courseCredits}
- Mô tả: ${input.courseDescription || "(chưa có mô tả — hãy suy luận theo tên học phần)"}

Các PLO của chương trình:
${ploListing}

Hãy đề xuất 3-8 CLO cho học phần này, kèm gợi ý map sang PLO. Chỉ map vào những PLO có mã ở trên — KHÔNG bịa PLO mới.`,
      },
    ],
    output_config: {
      format: zodOutputFormat(CLOSuggestionsResultSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error(`AI không sinh được CLO. stop_reason=${response.stop_reason}`);
  }
  return response.parsed_output;
}

// =========================================================
// 2. Auto-map CLO ↔ PLO cho syllabus đã có sẵn CLO
// =========================================================

const MapResultSchema = z.object({
  mappings: z.array(
    z.object({
      cloCode: z.string(),
      ploCode: z.string(),
      contribution: z.enum(["I", "R", "M", "A"]),
      rationale: z.string().describe("Lý do ngắn 1 câu vì sao map mức này"),
    }),
  ),
});

export type AIMapResult = z.infer<typeof MapResultSchema>;

const MAP_SYSTEM_PROMPT = `Bạn là chuyên gia thiết kế ma trận CLO ↔ PLO theo OBE.

Quy ước contribution:
- I (Introduce): học phần giới thiệu, sinh viên mới làm quen với PLO này.
- R (Reinforce): học phần củng cố, lặp lại để khắc sâu.
- M (Master): học phần giúp sinh viên thành thạo PLO này.
- A (Assess): học phần có hoạt động đánh giá trực tiếp PLO này.

Nguyên tắc:
- KHÔNG map mỗi CLO vào quá nhiều PLO (tối đa 2-3 PLO mỗi CLO).
- Mỗi PLO của chương trình NÊN có ít nhất 1 CLO map vào (nhưng nếu CLO không liên quan thật sự, đừng ép map).
- Chỉ map khi CLO thực sự đóng góp vào PLO — không map theo kiểu hình thức.
- Trả về rationale ngắn gọn 1 câu.`;

export async function mapCLOtoPLO(input: {
  courseCode: string;
  courseName: string;
  clos: { code: string; description: string; bloomLevel?: string | null }[];
  plos: { code: string; description: string }[];
}): Promise<AIMapResult> {
  const client = getAnthropicClient();

  const cloListing = input.clos
    .map(
      (c) =>
        `- ${c.code} [${c.bloomLevel || "?"}]: ${c.description}`,
    )
    .join("\n");
  const ploListing = input.plos
    .map((p) => `- ${p.code}: ${p.description}`)
    .join("\n");

  const response = await client.messages.parse({
    model: AI_MODEL,
    max_tokens: 6000,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: MAP_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Học phần: ${input.courseCode} — ${input.courseName}

CLO của học phần:
${cloListing}

PLO của chương trình:
${ploListing}

Hãy đề xuất các mapping CLO ↔ PLO với mức contribution phù hợp.`,
      },
    ],
    output_config: {
      format: zodOutputFormat(MapResultSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error(`AI không sinh được mapping. stop_reason=${response.stop_reason}`);
  }
  return response.parsed_output;
}

// =========================================================
// 3. Sinh câu hỏi cho ngân hàng
// =========================================================

const QuestionSchema = z.object({
  type: z.enum(["MC", "TF", "SHORT", "ESSAY"]),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  bloomLevel: z
    .enum(["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"])
    .nullable(),
  content: z.string(),
  options: z
    .array(z.string())
    .nullable()
    .describe("Mảng 4 phương án A,B,C,D cho câu MC; null cho loại khác"),
  answer: z
    .string()
    .describe(
      "MC: 'A'/'B'/'C'/'D' — TF: 'Đúng'/'Sai' — SHORT/ESSAY: nội dung đáp án",
    ),
  explanation: z.string().nullable(),
});

const QuestionsResultSchema = z.object({
  questions: z.array(QuestionSchema),
});

export type AIQuestionsResult = z.infer<typeof QuestionsResultSchema>;

const QUESTION_SYSTEM_PROMPT = `Bạn là chuyên gia ra đề thi đại học bám CLO theo chuẩn OBE / AUN-QA.

Nguyên tắc:
- Mỗi câu hỏi PHẢI đo lường được CLO đã cho.
- Bloom level của câu hỏi tương ứng yêu cầu (EASY/MEDIUM/HARD và Remember/Apply/Analyze...).
- Câu MC (Multiple Choice): 4 phương án A/B/C/D, chỉ 1 đáp án đúng. Các phương án sai phải hợp lý (không quá rõ).
- Câu TF (True/False): mệnh đề rõ ràng, không mơ hồ.
- Câu SHORT (trả lời ngắn): đáp án ≤ 3 câu, có thể tính điểm rõ ràng.
- Câu ESSAY (tự luận): đặt vấn đề mở, hướng dẫn chấm là ý chính cần có.
- Tiếng Việt chuẩn mực, học thuật.
- TRÁNH câu lặp lại y nguyên định nghĩa từ giáo trình — phải có biến đổi tình huống.
- explanation: ngắn gọn 1-2 câu vì sao đáp án đúng.`;

export async function generateQuestions(input: {
  courseCode: string;
  courseName: string;
  cloCode: string;
  cloDescription: string;
  bloomLevel?: string | null;
  type: "MC" | "TF" | "SHORT" | "ESSAY";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  count: number;
}): Promise<AIQuestionsResult> {
  const client = getAnthropicClient();

  if (input.count < 1 || input.count > 20) {
    throw new Error("count phải nằm trong [1, 20]");
  }

  const response = await client.messages.parse({
    model: AI_MODEL,
    max_tokens: 10000,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: QUESTION_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Sinh ${input.count} câu hỏi cho ngân hàng câu hỏi:

- Học phần: ${input.courseCode} — ${input.courseName}
- CLO: ${input.cloCode} — ${input.cloDescription}
- Bloom level CLO: ${input.bloomLevel || "(không quy định)"}
- Loại câu: ${input.type}
- Độ khó: ${input.difficulty}

Mỗi câu hỏi PHẢI bám sát CLO trên. Bloom level câu hỏi tương ứng độ khó (EASY≈Remember/Understand, MEDIUM≈Apply/Analyze, HARD≈Evaluate/Create).`,
      },
    ],
    output_config: {
      format: zodOutputFormat(QuestionsResultSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error(`AI không sinh được câu hỏi. stop_reason=${response.stop_reason}`);
  }
  return response.parsed_output;
}
