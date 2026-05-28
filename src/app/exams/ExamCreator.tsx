"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Course {
  id: string;
  code: string;
  name: string;
  program: { code: string };
}

export function ExamCreator({ courses }: { courses: Course[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function create(form: FormData) {
    setLoading(true);
    const data = {
      courseId: form.get("courseId"),
      code: form.get("code"),
      title: form.get("title"),
      type: form.get("type"),
      duration: Number(form.get("duration") || 60),
    };
    const res = await fetch("/api/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    setLoading(false);
    if (json.id) router.push(`/exams/${json.id}`);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Tạo đề thi mới
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-lg shadow-lg">
        <div className="p-5 border-b flex items-center justify-between">
          <h3 className="font-semibold">Tạo đề thi mới</h3>
          <button
            onClick={() => setOpen(false)}
            className="text-slate-500 hover:text-slate-800"
          >
            ✕
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create(new FormData(e.currentTarget));
          }}
          className="p-5 space-y-3"
        >
          <select name="courseId" required className="input">
            <option value="">— Học phần —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                [{c.program.code}] {c.code} — {c.name}
              </option>
            ))}
          </select>
          <input
            name="code"
            required
            placeholder="Mã đề (VD: CK2024-CK01)"
            className="input"
          />
          <input
            name="title"
            required
            placeholder="Tiêu đề đề thi"
            className="input"
          />
          <div className="grid grid-cols-2 gap-2">
            <select name="type" className="input" defaultValue="FINAL">
              <option value="FINAL">Cuối kỳ</option>
              <option value="MIDTERM">Giữa kỳ</option>
              <option value="QUIZ">Kiểm tra</option>
            </select>
            <input
              name="duration"
              type="number"
              defaultValue={90}
              placeholder="Thời gian (phút)"
              className="input"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-secondary"
            >
              Hủy
            </button>
            <button className="btn-primary" disabled={loading}>
              {loading ? "..." : "Tạo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
