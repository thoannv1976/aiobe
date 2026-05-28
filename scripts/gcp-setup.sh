#!/usr/bin/env bash
# AIOBE — One-time GCP setup for GitHub Actions deployment
#
# Cách dùng (trong Cloud Shell, project aiobe-82bcf đã chọn):
#   bash <(curl -s https://raw.githubusercontent.com/thoannv1976/aiobe/claude/sweet-edison-2QAd4/scripts/gcp-setup.sh)
# Hoặc clone repo rồi: bash scripts/gcp-setup.sh
#
# Script sẽ:
#   1. Bật các API cần thiết (Cloud Run, Artifact Registry, Cloud Build)
#   2. Tạo service account aiobe-deployer với quyền deploy
#   3. Tạo Artifact Registry repo "aiobe"
#   4. Xuất JSON key để bạn paste vào GitHub Secret GCP_SA_KEY

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${REGION:-asia-southeast1}"
SA_NAME="aiobe-deployer"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
REPO_NAME="aiobe"

if [[ -z "$PROJECT_ID" ]]; then
  echo "❌ Chưa chọn GCP project. Chạy: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

echo "================================================="
echo "  AIOBE GCP Setup"
echo "================================================="
echo "Project:  $PROJECT_ID"
echo "Region:   $REGION"
echo "SA:       $SA_EMAIL"
echo "================================================="

echo ""
echo "▶ Bật các API..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  --project="$PROJECT_ID"

echo ""
echo "▶ Tạo service account..."
if gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "  (đã tồn tại — bỏ qua)"
else
  gcloud iam service-accounts create "$SA_NAME" \
    --display-name="AIOBE GitHub Actions Deployer" \
    --project="$PROJECT_ID"
fi

echo ""
echo "▶ Gán quyền..."
ROLES=(
  roles/run.admin
  roles/storage.admin
  roles/artifactregistry.writer
  roles/cloudbuild.builds.editor
  roles/iam.serviceAccountUser
  roles/logging.viewer
)
for ROLE in "${ROLES[@]}"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="$ROLE" \
    --condition=None \
    --quiet >/dev/null
  echo "  ✓ $ROLE"
done

echo ""
echo "▶ Tạo Artifact Registry repo..."
if gcloud artifacts repositories describe "$REPO_NAME" \
  --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "  (đã tồn tại — bỏ qua)"
else
  gcloud artifacts repositories create "$REPO_NAME" \
    --repository-format=docker \
    --location="$REGION" \
    --project="$PROJECT_ID"
fi

echo ""
echo "▶ Tạo JSON key..."
KEY_FILE="$(pwd)/aiobe-sa-key.json"
gcloud iam service-accounts keys create "$KEY_FILE" \
  --iam-account="$SA_EMAIL" \
  --project="$PROJECT_ID"

echo ""
echo "================================================="
echo "  ✅ SETUP HOÀN TẤT"
echo "================================================="
echo ""
echo "Thêm 4 GitHub Secrets vào repo (Settings → Secrets and variables → Actions):"
echo ""
echo "  1. GCP_PROJECT_ID = $PROJECT_ID"
echo "  2. GCP_REGION     = $REGION"
echo "  3. GCP_SA_KEY     = (paste nội dung file dưới đây)"
echo "  4. DATABASE_URL   = postgresql://...  (Cloud SQL hoặc Neon)"
echo ""
echo "------ BEGIN GCP_SA_KEY ------"
cat "$KEY_FILE"
echo ""
echo "------- END GCP_SA_KEY -------"
echo ""
echo "📌 Key file: $KEY_FILE  (nhớ xoá sau khi paste vào GitHub!)"
echo ""
echo "Sau khi thêm secrets, push 1 commit hoặc trigger workflow để deploy."
