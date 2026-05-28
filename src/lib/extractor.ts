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
  "giải thích|mô tả|phân biệt|tóm tắt": "Understand",
  "vận dụng|áp dụng|sử dụng|thực hiện|thực hành": "Apply",
  "phân tích|đối chiếu|phân loại": "Analyze",
  "đánh giá|nhận xét|phê phán|kết luận|thẩm định": "Evaluate",
  "sáng tạo|thiết kế|xây dựng|phát triển|tổng hợp": "Create",
};

const BLOOM_NUM_MAP: Record<string, string> = {
  "1": "Remember",
  "2": "Understand",
  "3": "Apply",
  "4": "Analyze",
  "5": "Evaluate",
  "6": "Create",
};

function detectBloomLevel(text: string): string | undefined {
  // Ưu tiên nhãn rõ ràng "(Bloom N)" hay "Bloom level N"
  const explicit = text.match(/\bBloom\s*(?:level)?\s*[:=]?\s*(\d)\b/i);
  if (explicit && BLOOM_NUM_MAP[explicit[1]]) return BLOOM_NUM_MAP[explicit[1]];

  const lower = text.toLowerCase();
  for (const pattern in BLOOM_KEYWORDS) {
    const re = new RegExp(`(?:^|\\W)(${pattern})(?:\\W|$)`, "i");
    if (re.test(lower)) return BLOOM_KEYWORDS[pattern];
  }
  return undefined;
}

function detectCategory(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (/(thái độ|đạo đức|trách nhiệm|hành vi|phẩm chất)/.test(lower))
    return "Thái độ";
  if (/(kỹ năng|thao tác|làm việc nhóm|giao tiếp|thực hành)/.test(lower))
    return "Kỹ năng";
  if (/(kiến thức|hiểu biết|nắm vững|am hiểu)/.test(lower)) return "Kiến thức";
  return undefined;
}

export function extractFromText(text: string): ExtractionResult {
  const cleaned = text
    .replace(/\r/g, "")
    .replace(/[\t]+/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/\n{2,}/g, "\n");

  const plos = extractPLOs(cleaned);
  const courses = extractCourses(cleaned);
  const programGoals = extractProgramGoals(cleaned);

  return { plos, courses, programGoals };
}

function extractProgramGoals(text: string): string | undefined {
  const m = text.match(
    /(mục tiêu (?:của |chung )?(?:chương trình)?[\s\S]{0,1500}?)(?=chuẩn đầu ra|plo|pi|cấu trúc|khung chương trình|danh mục|$)/i,
  );
  return m?.[1]?.trim().slice(0, 1500);
}

// Regex nhận diện 1 đầu mục PLO/CĐR/ELO
const PLO_HEAD_RE = /^(PLO|CĐR|ELO)\s*[._-]?\s*(\d{1,2})\b[:.\-)]?\s*(.*)$/i;
const PI_HEAD_RE = /^PI\s*(\d{1,2})\.(\d{1,2})\b[:.\-)]?\s*(.*)$/i;
// Dòng có vẻ là tiêu đề section / bảng — không phải nội dung PLO
const SECTION_BREAK_RE =
  /^(danh\s*mục|cấu\s*trúc|khung\s*chương\s*trình|học\s*phần|chương\s+\d|mục\s+\d|điều\s+\d|article|stt\b|mã\s*hp\b|tên\s*học\s*phần|số\s*tín|tín\s*chỉ|chương\s+iii|chương\s+ii|chương\s+i\b)/i;
// Dòng bắt đầu bằng mã học phần dạng "ABC123"
const COURSE_CODE_RE = /^[A-Z]{2,5}[\s\-_]?\d{2,4}[A-Z]?\b/;

function extractPLOs(text: string): ExtractedPLO[] {
  const lines = text.split("\n").map((l) => l.trim());
  const ploMap = new Map<string, ExtractedPLO>();
  let current: ExtractedPLO | null = null;

  for (const line of lines) {
    if (!line) {
      // dòng trắng không reset PLO ngay — cho phép vài dòng trắng giữa description
      continue;
    }

    const pm = line.match(PLO_HEAD_RE);
    if (pm) {
      const num = pm[2];
      const desc = pm[3].trim();
      const code = `PLO${num}`;
      if (!ploMap.has(code)) {
        ploMap.set(code, {
          code,
          description: desc,
          pis: [],
        });
      } else {
        // Đã có PLO cùng code — gộp thêm description nếu trùng lặp xuất hiện
        const existing = ploMap.get(code)!;
        if (!existing.description) existing.description = desc;
      }
      current = ploMap.get(code)!;
      continue;
    }

    const piM = line.match(PI_HEAD_RE);
    if (piM) {
      const ploNum = piM[1];
      const piNum = piM[2];
      const desc = piM[3].trim();
      const ploCode = `PLO${ploNum}`;
      const piCode = `PI${ploNum}.${piNum}`;
      let plo = ploMap.get(ploCode);
      if (!plo) {
        plo = { code: ploCode, description: "", pis: [] };
        ploMap.set(ploCode, plo);
      }
      if (!plo.pis.find((p) => p.code === piCode)) {
        plo.pis.push({ code: piCode, description: desc.slice(0, 400) });
      }
      current = null; // sau khi gặp PI thì ngừng append vào PLO
      continue;
    }

    // Gặp dòng tiêu đề mới hoặc mã học phần → dừng append
    if (SECTION_BREAK_RE.test(line) || COURSE_CODE_RE.test(line)) {
      current = null;
      continue;
    }

    // Dòng quá ngắn (≤ 2 ký tự) cũng bỏ qua khi append
    if (line.length < 3) continue;

    // Append vào PLO hiện tại nếu còn chỗ
    if (current && current.description.length < 1000) {
      const sep = current.description.endsWith("-") ? "" : " ";
      current.description = (current.description + sep + line).trim();
    }
  }

  // Hoàn thiện: cắt độ dài, gán bloom + category
  for (const plo of ploMap.values()) {
    plo.description = plo.description.replace(/\s+/g, " ").slice(0, 800);
    plo.bloomLevel = detectBloomLevel(plo.description);
    plo.category = detectCategory(plo.description);
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
          description: desc.slice(0, 800),
          bloomLevel: detectBloomLevel(desc),
          category: detectCategory(desc),
          pis: [],
        });
      });
    }
  }

  return result;
}

// Parse 1 dòng có thể chứa học phần. Trả về null nếu không.
// Heuristic chọn TC (giả định format VN: STT CODE NAME [SỐ-TÊN] TC [HK] [LOẠI]):
//   - Lấy mọi token số nguyên 1-12
//   - Nếu ≥ 2 số ở cuối dòng → cặp cuối là "TC HK", TC = số đầu của cặp
//   - Nếu chỉ 1 số → đó là TC
//   - Mọi token trước TC là phần tên (có thể chứa số = thứ tự khoá học)
function parseCourseLine(
  line: string,
): { code: string; name: string; credits: number } | null {
  // Loại bỏ STT đầu dòng nếu có ("1. " hoặc "1) " hoặc "1\t")
  const trimmed = line.replace(/^\s*\d+[.)]\s+/, "").trim();

  const codeMatch = trimmed.match(/\b([A-Z]{2,5}[\s\-_]?\d{2,4}[A-Z]?)\b/);
  if (!codeMatch) return null;
  const code = codeMatch[1].replace(/\s+/g, "").toUpperCase();
  if (/^(PLO|PI|CLO|ELO|CĐR|STT|MA|HP)\d/.test(code)) return null;

  const codeIdx = trimmed.indexOf(codeMatch[1]);
  const after = trimmed.slice(codeIdx + codeMatch[1].length).trim();
  if (after.length < 3) return null;

  const tokens = after.split(/\s+/);
  const isNumeric = (t: string) => /^\d{1,2}$/.test(t);

  // Tìm cluster các số ở cuối (tính cả token text giữa)
  // Ta đếm số số NẰM TRONG 3 token cuối — nếu ≥2 thì coi như có cột HK
  const tail = tokens.slice(-3);
  const tailNumerics = tail.filter(isNumeric);

  let tcIdx = -1;

  if (tailNumerics.length >= 2) {
    // Có cột HK (hoặc thêm cột) — TC là số áp chót gần cuối
    // Tìm 2 số cuối cùng theo thứ tự
    const allNumIdx: number[] = [];
    tokens.forEach((t, i) => {
      if (isNumeric(t) && +t >= 1 && +t <= 12) allNumIdx.push(i);
    });
    // TC = số áp chót trong toàn dòng, miễn giá trị 1-12
    if (allNumIdx.length >= 2) tcIdx = allNumIdx[allNumIdx.length - 2];
  } else if (tailNumerics.length === 1) {
    // Chỉ 1 số ở cuối → đó là TC
    const allNumIdx: number[] = [];
    tokens.forEach((t, i) => {
      if (isNumeric(t) && +t >= 1 && +t <= 12) allNumIdx.push(i);
    });
    if (allNumIdx.length >= 1) tcIdx = allNumIdx[allNumIdx.length - 1];
  } else {
    // Số TC không nằm ở 3 token cuối — có thể có nhiều cột text sau TC
    // Tìm số CUỐI cùng nằm trong cả dòng có giá trị 2-6 (ưu tiên TC điển hình)
    let cand = -1;
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (isNumeric(tokens[i]) && +tokens[i] >= 2 && +tokens[i] <= 6) {
        cand = i;
        break;
      }
    }
    if (cand === -1) {
      for (let i = tokens.length - 1; i >= 0; i--) {
        if (isNumeric(tokens[i]) && +tokens[i] >= 1 && +tokens[i] <= 12) {
          cand = i;
          break;
        }
      }
    }
    tcIdx = cand;
  }

  if (tcIdx === -1) return null;

  const credits = parseInt(tokens[tcIdx], 10);
  if (credits < 1 || credits > 12) return null;

  // Yêu cầu có ít nhất 2 token text-name trước TC
  const nameTokensBeforeTC = tokens.slice(0, tcIdx).filter((t) => !isNumeric(t));
  if (nameTokensBeforeTC.length < 2) return null;

  const name = tokens
    .slice(0, tcIdx)
    .join(" ")
    .replace(/[\s.;:,-]+$/, "")
    .trim();
  if (name.length < 3) return null;

  return { code, name, credits };
}

function extractCourses(text: string): ExtractedCourse[] {
  const lines = text.split(/\n+/);
  const result: ExtractedCourse[] = [];
  const seen = new Set<string>();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.length < 6) continue;
    // Bỏ qua các dòng có vẻ là header bảng
    if (
      /^(stt|mã\s*hp|tên\s*học\s*phần|số\s*tín)/i.test(line) ||
      /chuẩn đầu ra/i.test(line)
    )
      continue;

    const parsed = parseCourseLine(line);
    if (!parsed) continue;
    if (seen.has(parsed.code)) continue;
    seen.add(parsed.code);
    result.push(parsed);
  }

  // Fallback: tìm trong bảng danh mục học phần theo dòng đánh số (không có mã HP)
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
