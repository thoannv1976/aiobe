// Tiền xử lý văn bản gốc trích từ PDF/DOCX trước khi gửi cho AI hoặc rule-based.
// Mục đích: loại bỏ Mục lục (TOC), page numbers, các nhiễu phổ biến để extractor tập trung vào nội dung thật.

// 1 dòng có vẻ là entry trong Mục lục nếu:
//   - kết thúc bằng 1-3 chữ số (số trang)
//   - không chứa năm 4 chữ số (để tránh nhầm "2024" với page)
//   - dài < 200 ký tự
function looksLikeTOCEntry(line: string): boolean {
  const t = line.trim();
  if (t.length < 5 || t.length > 200) return false;
  if (/\b(19|20)\d{2}\b/.test(t)) return false; // có năm → không phải TOC
  // Pattern: <text> <khoảng trắng hoặc dấu chấm> <1-3 chữ số cuối dòng>
  return /\.{2,}\s*\d{1,3}\s*$/.test(t) || /\s+\d{1,3}\s*$/.test(t);
}

// Strip TOC: nếu phát hiện ≥ 5 dòng TOC liên tiếp, bỏ cả khối đó
export function stripTOC(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    let end = i;
    while (end < lines.length && looksLikeTOCEntry(lines[end])) end++;
    if (end - i >= 5) {
      // Bỏ qua cả khối TOC
      i = end;
    } else {
      out.push(lines[i]);
      i++;
    }
  }
  return out.join("\n");
}

// Strip page numbers đứng độc lập trên 1 dòng (vd dòng chỉ có "12" hoặc "Trang 12")
export function stripPageNumbers(text: string): string {
  return text
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      if (!t) return true;
      if (/^(trang|page)?\s*\d{1,3}\s*$/i.test(t)) return false;
      return true;
    })
    .join("\n");
}

// Clean tổng hợp
export function cleanRawText(text: string): string {
  let out = text.replace(/\r/g, "");
  out = stripTOC(out);
  out = stripPageNumbers(out);
  // Gộp khoảng trắng thừa
  out = out.replace(/[\t]+/g, " ").replace(/ {2,}/g, " ");
  // Gộp nhiều dòng trắng liên tiếp thành 1
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}
