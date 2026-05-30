"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadProgramPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    program: { id: string; code: string; name: string };
    extracted: { ploCount: number; piCount: number; courseCount: number };
  } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    if (file) form.set("file", file);

    try {
      const res = await fetch("/api/programs/upload", {
        method: "POST",
        body: form,
      });
      // Đọc text trước rồi mới parse — tránh "Unexpected end of JSON input"
      // khi server trả về body rỗng (timeout, 502, OOM) hoặc HTML 5xx page
      const raw = await res.text();
      let json: any = null;
      if (raw) {
        try {
          json = JSON.parse(raw);
        } catch {
          // không phải JSON — giữ raw để hiển thị
        }
      }
      if (!res.ok) {
        const msg = json?.error
          ? json.error
          : raw
            ? `HTTP ${res.status}: ${raw.slice(0, 300)}`
            : `HTTP ${res.status} — server không trả về phản hồi (có thể timeout hoặc lỗi nghiêm trọng).`;
        setError(msg);
      } else if (json) {
        setResult(json);
      } else {
        setError("Server trả về phản hồi rỗng — thử lại hoặc kiểm tra logs.");
      }
    } catch (err: any) {
      setError(err.message || "Lỗi mạng");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="max-w-2xl mx-auto card p-6 space-y-4">
        <div className="text-center">
          <div className="text-5xl">✅</div>
          <h1 className="text-xl font-bold mt-3">
            Trích xuất thành công
          </h1>
          <p className="text-slate-600 mt-1">
            Chương trình:{" "}
            <span className="font-semibold">
              {result.program.code} — {result.program.name}
            </span>
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="text-center bg-blue-50 rounded p-3">
            <div className="text-2xl font-bold text-blue-700">
              {result.extracted.ploCount}
            </div>
            <div className="text-xs text-blue-700">PLO</div>
          </div>
          <div className="text-center bg-purple-50 rounded p-3">
            <div className="text-2xl font-bold text-purple-700">
              {result.extracted.piCount}
            </div>
            <div className="text-xs text-purple-700">PI</div>
          </div>
          <div className="text-center bg-green-50 rounded p-3">
            <div className="text-2xl font-bold text-green-700">
              {result.extracted.courseCount}
            </div>
            <div className="text-xs text-green-700">Học phần</div>
          </div>
        </div>

        <div className="flex gap-2 justify-center pt-2">
          <button
            onClick={() => router.push(`/programs/${result.program.id}`)}
            className="btn-primary"
          >
            Xem chi tiết
          </button>
          <button
            onClick={() => {
              setResult(null);
              setFile(null);
            }}
            className="btn-secondary"
          >
            Upload tiếp
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">
          Upload đề án mở ngành đào tạo
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Hệ thống sẽ trích xuất chuẩn đầu ra chương trình (PLO), chỉ báo thực
          hiện (PI) và danh mục học phần từ tài liệu.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <div>
          <label className="label">File đề án (PDF / DOCX / TXT)</label>
          <input
            type="file"
            name="file"
            required
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="input"
          />
          {file && (
            <div className="text-xs text-slate-500 mt-1">
              {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Mã chương trình *</label>
            <input
              name="code"
              required
              placeholder="VD: CNTT2024"
              className="input"
            />
          </div>
          <div>
            <label className="label">Năm áp dụng *</label>
            <input
              type="number"
              name="year"
              required
              defaultValue={new Date().getFullYear()}
              className="input"
            />
          </div>
        </div>

        <div>
          <label className="label">Tên chương trình *</label>
          <input
            name="name"
            required
            placeholder="VD: Cử nhân Công nghệ thông tin"
            className="input"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Ngành</label>
            <input
              name="major"
              placeholder="VD: Công nghệ thông tin"
              className="input"
            />
          </div>
          <div>
            <label className="label">Bậc đào tạo</label>
            <select name="level" className="input">
              <option>Cử nhân</option>
              <option>Kỹ sư</option>
              <option>Thạc sĩ</option>
              <option>Tiến sĩ</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.back()}
          >
            Hủy
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Đang trích xuất..." : "Upload & Trích xuất"}
          </button>
        </div>
      </form>

      <div className="card p-4 bg-amber-50 border-amber-200 text-sm text-amber-800">
        <div className="font-semibold mb-1">💡 Gợi ý định dạng tài liệu</div>
        <ul className="list-disc list-inside space-y-1 text-amber-700">
          <li>
            PLO được đánh dấu bằng nhãn <code className="font-mono">PLO1</code>,
            <code className="font-mono"> PLO2</code>, hoặc{" "}
            <code className="font-mono">CĐR1</code>, <code className="font-mono">ELO1</code>...
          </li>
          <li>
            PI dùng nhãn <code className="font-mono">PI1.1</code>,{" "}
            <code className="font-mono">PI1.2</code>...
          </li>
          <li>
            Danh mục học phần: mã (VD <code className="font-mono">CNTT101</code>), tên,
            số tín chỉ trên cùng dòng.
          </li>
        </ul>
      </div>
    </div>
  );
}
