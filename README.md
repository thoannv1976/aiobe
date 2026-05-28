# AIOBE — Outcome-Based Education Curriculum Management

Hệ thống xây dựng và quản lý chương trình đào tạo theo chuẩn **AUN-QA** và **OBE**.

## Tính năng

1. **Upload đề án mở ngành** (PDF/DOCX/TXT) — hệ thống tự động trích xuất:
   - PLO (Program Learning Outcomes — Chuẩn đầu ra chương trình)
   - PI (Performance Indicators — Chỉ báo thực hiện)
   - Danh mục học phần (mã, tên, số tín chỉ)
2. **Quản lý PLO/PI** — chỉnh sửa, phân loại theo Knowledge/Skill/Attitude, bloom level.
3. **Xây dựng đề cương học phần (Syllabus)** đáp ứng OBE:
   - CLO (Course Learning Outcomes)
   - Ma trận **CLO ↔ PLO** (Introduce / Reinforce / Master / Assess)
   - Kế hoạch đánh giá theo trọng số bám CLO
4. **Quản lý giáo trình** (chính / tham khảo / online) cho từng học phần.
5. **Ngân hàng câu hỏi** — gắn CLO, phân loại Bloom, độ khó (Dễ/TB/Khó), loại câu (MC/Đúng-Sai/Ngắn/Tự luận).
6. **Tạo đề thi** từ **ma trận đề** (CLO × độ khó × số câu × điểm) — sinh tự động, đảm bảo bao phủ CLO.
7. **Báo cáo kiểm định AUN-QA**:
   - Ma trận PLO ↔ học phần
   - Kiểm tra tuân thủ: mỗi PLO có học phần đánh giá, ngân hàng câu hỏi, đề thi…
   - Lưu trữ minh chứng.

## Stack

- **Next.js 14** (App Router) + React 18 + TypeScript
- **Tailwind CSS**
- **Prisma** + **SQLite** (đổi sang Postgres/MySQL trong production)
- **pdf-parse**, **mammoth** cho trích xuất tài liệu

## Chạy

```bash
npm install
npx prisma db push
npx tsx prisma/seed.ts   # tạo dữ liệu mẫu (CNTT2024)
npm run dev              # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

## Quy trình điển hình

```
Upload đề án PDF/DOCX
        │
        ▼
Trích xuất PLO + PI + Học phần
        │
        ▼
Tinh chỉnh PLO/PI (UI)
        │
        ▼
Tạo Đề cương + CLO cho từng học phần
        │
        ▼
Ma trận CLO ↔ PLO (I / R / M / A)
        │
        ▼
Nhập Ngân hàng câu hỏi (gắn CLO)
        │
        ▼
Xây ma trận đề → Sinh đề thi → Lưu trữ
        │
        ▼
Báo cáo Kiểm định AUN-QA
```

## Ghi chú trích xuất

Bộ trích xuất rule-based tối ưu cho định dạng tiếng Việt phổ biến:

- PLO: dòng bắt đầu bằng `PLO1`, `PLO 2`, `CĐR1`, `ELO1`…
- PI: `PI1.1`, `PI 2.3`…
- Học phần: dòng có dạng `MÃ_HP    Tên học phần    Số TC` (3–4 cột tab/space).

Có thể nâng cấp dễ dàng bằng cách thay `src/lib/extractor.ts` bằng LLM (GPT/Claude/Gemini) cho độ chính xác cao hơn.
