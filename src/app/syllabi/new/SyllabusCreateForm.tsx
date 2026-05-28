"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Course {
  id: string;
  code: string;
  name: string;
  program: { code: string; name: string };
}

export function SyllabusCreateForm({
  courses,
  defaultCourseId,
}: {
  courses: Course[];
  defaultCourseId?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const data = {
      courseId: form.get("courseId"),
      version: form.get("version") || "1.0",
      objective: form.get("objective"),
      description: form.get("description"),
      teachingMethod: form.get("teachingMethod"),
    };
    const res = await fetch("/api/syllabi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    setLoading(false);
    if (json.id) router.push(`/syllabi/${json.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-4">
      <div>
        <label className="label">Học phần *</label>
        <select
          name="courseId"
          required
          defaultValue={defaultCourseId || ""}
          className="input"
        >
          <option value="">— Chọn học phần —</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              [{c.program.code}] {c.code} — {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Phiên bản</label>
        <input name="version" defaultValue="1.0" className="input" />
      </div>

      <div>
        <label className="label">Mục tiêu học phần</label>
        <textarea name="objective" rows={3} className="input" />
      </div>

      <div>
        <label className="label">Mô tả học phần</label>
        <textarea name="description" rows={3} className="input" />
      </div>

      <div>
        <label className="label">Phương pháp giảng dạy</label>
        <textarea
          name="teachingMethod"
          rows={2}
          placeholder="VD: Thuyết giảng kết hợp thực hành dự án, học theo nhóm..."
          className="input"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-secondary"
        >
          Hủy
        </button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Đang lưu..." : "Tạo đề cương"}
        </button>
      </div>
    </form>
  );
}
