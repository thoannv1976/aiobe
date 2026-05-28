// Trích xuất PLO, PI và danh mục học phần từ văn bản đề án mở ngành
// Sử dụng quy tắc (rule-based) cho tiếng Việt. Khi tích hợp LLM có thể thay thế phần này.

export interface ExtractedPLO {
  code: string;
  description: string;
  bloomLevel?: string;
  category?: string;
  pis: ExtractedPI[];
}

export interface ExtractedPI {
  code: string;
  description: string;
}

export interface ExtractedCourse {
  code: string;
  name: string;
  credits: number;
  type?: string;
  semester?: number;
}

export interface ExtractionResult {
  plos: ExtractedPLO[];
  courses: ExtractedCourse[];
  programGoals?: string;
}

const BLOOM_KEYWORDS: Record<string, string> = {
  "hiểu|nhận biết|trình bày|liệt kê|nhớ|định nghĩa": "Remember",
  "giải thích|mô tả|so sánh|phân biệt": "Understand",
  "vận dụng|áp dụng|sử dụng|thực hiện": "Apply",
  "phân tích|tổng hợp|so sánh|đối chiếu": "Analyze",
  "đánh giá|nhận xét|phê phán|kết luận": "Evaluate",
  "sáng tạo|thiết kế|xây dựng|phát triển": "Create",
};

function detectBloomLevel(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const pattern in BLOOM_KEYWORDS) {
    const re = new RegExp(`\\b(${pattern})\\b`, "i");
    if (re.test(lower)) return BLOOM_KEYWORDS[pattern];
  }
  return undefined;
}

function detectCategory(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (/(kiến thức|hiểu|biết)/.test(lower)) return "Kiến thức";
  if (/(kỹ năng|thực hiện|vận dụng|thao tác)/.test(lower)) return "Kỹ năng";
  if (/(thái độ|đạo đức|trách nhiệm|hành vi)/.test(lower)) return "Thái độ";
  return undefined;
}

export function extractFromText(text: string): ExtractionResult {
  const cleaned = text
    .replace(/\r/g, "")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{2,}/g, "\n");

  const plos = extractPLOs(cleaned);
  const courses = extractCourses(cleaned);
  const programGoals = extractProgramGoals(cleaned);

  return { plos, courses, programGoals };
}

function extractProgramGoals(text: string): string | undefined {
  const m = text.match(
    /(mục tiêu (?:của )?chương trình[\s\S]{0,1500}?)(?=chuẩn đầu ra|plo|pi|cấu trúc|khung chương trình|$)/i,
  );
  return m?.[1]?.trim().slice(0, 1500);
}

function extractPLOs(text: string): ExtractedPLO[] {
  const lines = text.split("\n").map((l) => l.trim());

  // Pass 1: tìm dòng bắt đầu bằng PLO/CĐR/ELO + số
  const ploMap = new Map<string, ExtractedPLO>();
  const ploLineRe = /^(PLO|CĐR|ELO)\s*[._-]?\s*(\d{1,2})\b[:.\-)]?\s*(.*)$/i;
  const piLineRe = /^PI\s*(\d{1,2})\.(\d{1,2})\b[:.\-)]?\s*(.*)$/i;

  for (const line of lines) {
    const pm = line.match(ploLineRe);
    if (pm) {
      const num = pm[2];
      const desc = pm[3].trim();
      if (desc.length >= 6) {
        const code = `PLO${num}`;
        if (!ploMap.has(code)) {
          ploMap.set(code, {
            code,
            description: desc.slice(0, 600),
            bloomLevel: detectBloomLevel(desc),
            category: detectCategory(desc),
            pis: [],
          });
        }
      }
      continue;
    }
    const piM = line.match(piLineRe);
    if (piM) {
      const ploNum = piM[1];
      const piNum = piM[2];
      const desc = piM[3].trim();
      const ploCode = `PLO${ploNum}`;
      const piCode = `PI${ploNum}.${piNum}`;
      let plo = ploMap.get(ploCode);
      if (!plo) {
        plo = {
          code: ploCode,
          description: "",
          pis: [],
        };
        ploMap.set(ploCode, plo);
      }
      if (!plo.pis.find((p) => p.code === piCode)) {
        plo.pis.push({ code: piCode, description: desc.slice(0, 400) });
      }
    }
  }

  let result = Array.from(ploMap.values()).sort((a, b) => {
    const na = parseInt(a.code.replace(/\D/g, ""), 10);
    const nb = parseInt(b.code.replace(/\D/g, ""), 10);
    return na - nb;
  });

  // Fallback: bắt theo danh sách số khi không có nhãn PLO
  if (result.length === 0) {
    const section = text.match(
      /(chuẩn đầu ra(?:\s+chương trình)?[\s\S]{0,3000})/i,
    );
    if (section) {
      const items = section[1].match(/(?:\n|^)\s*[-•*]?\s*\d+[.)]\s+[^\n]+/g);
      items?.slice(0, 12).forEach((it, idx) => {
        const desc = it.replace(/^\s*[-•*]?\s*\d+[.)]\s+/, "").trim();
        if (desc.length < 10) return;
        result.push({
          code: `PLO${idx + 1}`,
          description: desc.slice(0, 600),
          bloomLevel: detectBloomLevel(desc),
          category: detectCategory(desc),
          pis: [],
        });
      });
    }
  }

  return result;
}

function extractCourses(text: string): ExtractedCourse[] {
  const result: ExtractedCourse[] = [];
  const seen = new Set<string>();

  // Mẫu phổ biến: MÃ HP   TÊN HỌC PHẦN   SỐ TÍN CHỈ
  // Hoặc dạng bảng: MAT101  Toán cao cấp  3
  const courseRegex =
    /\b([A-Z]{2,5}[\s\-_]?\d{2,4}[A-Z]?)\b[\s\t]+([^\n]{4,80}?)\s+(\d{1,2})(?:\s|$|\n)/g;

  let m;
  while ((m = courseRegex.exec(text)) !== null) {
    const code = m[1].replace(/\s+/g, "").toUpperCase();
    if (seen.has(code)) continue;
    const name = m[2].trim().replace(/\s+/g, " ");
    const credits = parseInt(m[3], 10);
    if (credits > 12 || credits < 1) continue;
    if (name.length < 4) continue;
    seen.add(code);
    result.push({ code, name, credits });
  }

  // Fallback: tìm trong bảng danh mục học phần theo dòng đánh số
  if (result.length === 0) {
    const section = text.match(
      /(danh mục (?:các )?học phần|cấu trúc chương trình|khung chương trình)[\s\S]{0,8000}/i,
    );
    if (section) {
      const lines = section[0].split(/\n+/);
      lines.forEach((line, idx) => {
        const cm = line.match(/^\s*\d+[.)]\s*(.{6,80}?)\s+(\d{1,2})\s*$/);
        if (cm) {
          const name = cm[1].trim();
          const credits = parseInt(cm[2], 10);
          if (credits >= 1 && credits <= 12) {
            const code = `HP${String(idx + 1).padStart(3, "0")}`;
            if (!seen.has(code)) {
              seen.add(code);
              result.push({ code, name, credits });
            }
          }
        }
      });
    }
  }

  return result;
}

export async function extractFromFile(
  buffer: Buffer,
  mime: string,
  filename: string,
): Promise<string> {
  const lname = filename.toLowerCase();
  if (lname.endsWith(".pdf") || mime === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    return data.text || "";
  }
  if (
    lname.endsWith(".docx") ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }
  if (lname.endsWith(".txt") || mime.startsWith("text/")) {
    return buffer.toString("utf-8");
  }
  return buffer.toString("utf-8");
}
