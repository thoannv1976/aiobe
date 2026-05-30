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
- **Prisma** + **PostgreSQL**
- **pdf-parse**, **mammoth** cho trích xuất tài liệu
- **Anthropic SDK** (Claude Opus 4.7) cho AI extraction + suggestions
- **Cloud Run** + **GitHub Actions** cho CI/CD

## Chức năng AI (Claude API)

App có 4 endpoint AI dùng `claude-opus-4-7` với adaptive thinking + effort:high + prompt caching + structured output (Zod):

| Chức năng | Endpoint | UI |
|---|---|---|
| Trích xuất PLO/PI/học phần | `POST /api/programs/[id]/ai-extract` | Nút **✨ AI trích xuất** trang chương trình |
| Gợi ý + tạo CLO + auto-map | `POST /api/syllabi/[id]/ai-suggest-clos?apply=true` | Tab CLO trên Syllabus → **✨ AI gợi ý CLO** |
| Auto-map CLO ↔ PLO | `POST /api/syllabi/[id]/ai-map` | Tab Ma trận → **✨ AI auto-map** |
| Sinh câu hỏi cho CLO | `POST /api/courses/[id]/ai-generate-questions` | Trang Câu hỏi → **✨ AI sinh câu hỏi** |

Cấu hình:
1. Lấy API key tại https://console.anthropic.com
2. Thêm GitHub Secret `ANTHROPIC_API_KEY` (workflow đã tự pass vào Cloud Run)
3. (Optional) GitHub Variable `AI_MODEL` để chọn model khác — mặc định `claude-opus-4-7`. Lựa chọn:
   - `claude-opus-4-7` (mặc định, mạnh nhất, $5/$25 per Mtok)
   - `claude-sonnet-4-6` (rẻ hơn 1.7x, đủ tốt cho hầu hết task, $3/$15)
   - `claude-haiku-4-5` (rẻ nhất, $1/$5, task đơn giản)

Chi phí ước tính (Opus 4.7, $5/$25 per Mtok):
- AI trích xuất 1 đề án ~50KB text: ~$0.20-0.30
- Gợi ý 5 CLO + map: ~$0.05
- Sinh 5 câu hỏi MC: ~$0.06

Với Sonnet 4.6 chia ~1.7x; với Haiku 4.5 chia ~5x.

## Chạy local

Cần một Postgres database. Cách nhanh nhất: tạo free DB tại [neon.tech](https://neon.tech), copy connection string vào `.env`.

```bash
cp .env.example .env
# sửa DATABASE_URL trong .env

npm install
npx prisma db push        # tạo schema
npx tsx prisma/seed.ts    # seed dữ liệu mẫu (CNTT2024)
npm run dev               # http://localhost:3000
```

## Deploy lên Google Cloud Run (qua GitHub Actions)

### Bước 1 — Setup GCP (chạy 1 lần trong Cloud Shell)

```bash
gcloud config set project aiobe-82bcf   # hoặc project ID của bạn
curl -s https://raw.githubusercontent.com/thoannv1976/aiobe/claude/sweet-edison-2QAd4/scripts/gcp-setup.sh | bash
```

Script sẽ tự động: bật các API → tạo service account `aiobe-deployer` → gán quyền → tạo Artifact Registry → in JSON key ra màn hình.

### Bước 2 — Tạo Postgres database

Chọn 1 trong 2:

**A. Cloud SQL** (trong GCP, cần Blaze):
```bash
gcloud sql instances create aiobe-db --database-version=POSTGRES_15 \
  --tier=db-f1-micro --region=asia-southeast1 --root-password=YOUR_PASSWORD
gcloud sql databases create aiobe --instance=aiobe-db
# Lấy public IP:
gcloud sql instances describe aiobe-db --format='value(ipAddresses[0].ipAddress)'
# DATABASE_URL = postgresql://postgres:YOUR_PASSWORD@<PUBLIC_IP>:5432/aiobe?schema=public
```

**B. Neon free** ([neon.tech](https://neon.tech)) — copy connection string từ dashboard.

### Bước 3 — Thêm 4 GitHub Secrets

Vào **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Giá trị |
|---|---|
| `GCP_PROJECT_ID` | `aiobe-82bcf` |
| `GCP_REGION` | `asia-southeast1` |
| `GCP_SA_KEY` | Toàn bộ nội dung JSON in ra ở Bước 1 |
| `DATABASE_URL` | `postgresql://...` từ Bước 2 |

### Bước 4 — Trigger deploy

```bash
git commit --allow-empty -m "trigger deploy" && git push
```

Hoặc vào **GitHub → Actions → Build & Deploy to Cloud Run → Run workflow**.

Workflow sẽ:
1. Validate secrets
2. `prisma db push` (tạo/cập nhật schema)
3. Build Docker image bằng Cloud Build → push lên Artifact Registry
4. Deploy lên Cloud Run với `DATABASE_URL` env var
5. In URL service (xem ở tab Summary của workflow run)

URL sẽ có dạng: `https://aiobe-<hash>-as.a.run.app`

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
