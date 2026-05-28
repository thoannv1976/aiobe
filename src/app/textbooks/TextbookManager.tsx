"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Course {
  id: string;
  code: string;
  name: string;
  program: { code: string };
}
interface Textbook {
  id: string;
  courseId: string;
  title: string;
  author?: string | null;
  publisher?: string | null;
  year?: number | null;
  edition?: string | null;
  isbn?: string | null;
  type: string;
  url?: string | null;
  content?: string | null;
  course: { code: string; name: string };
}

export function TextbookManager({
  courses,
  textbooks,
  filterCourseId,
}: {
  courses: Course[];
  textbooks: Textbook[];
  filterCourseId?: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  async function add(form: FormData) {
    const data = {
      courseId: form.get("courseId"),
      title: form.get("title"),
      author: form.get("author") || null,
      publisher: form.get("publisher") || null,
      year: form.get("year") ? Number(form.get("year")) : null,
      edition: form.get("edition") || null,
      isbn: form.get("isbn") || null,
      type: form.get("type") || "MAIN",
      url: form.get("url") || null,
      content: form.get("content") || null,
    };
    await fetch("/api/textbooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setAdding(false);
    router.refresh();
  }

  async function del(id: string) {
    if (!confirm("Xoá giáo trình này?")) return;
    await fetch(`/api/textbooks/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="text-sm text-slate-600">
          {filterCourseId
            ? `Đang lọc theo học phần`
            : `Tất cả giáo trình (${textbooks.length})`}
        </div>
        <button onClick={() => setAdding(!adding)} className="btn-primary">
          {adding ? "Hủy" : "+ Thêm giáo trình"}
        </button>
      </div>

      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add(new FormData(e.currentTarget));
          }}
          className="card p-4 space-y-3 bg-blue-50"
        >
          <div className="grid grid-cols-3 gap-2">
            <select
              name="courseId"
              required
              defaultValue={filterCourseId || ""}
              className="input"
            >
              <option value="">— Học phần —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  [{c.program.code}] {c.code} — {c.name}
                </option>
              ))}
            </select>
            <select name="type" className="input">
              <option value="MAIN">Giáo trình chính</option>
              <option value="REFERENCE">Tài liệu tham khảo</option>
              <option value="ONLINE">Tài liệu trực tuyến</option>
            </select>
            <input
              name="year"
              type="number"
              placeholder="Năm xuất bản"
              className="input"
            />
          </div>
          <input
            name="title"
            required
            placeholder="Tên giáo trình *"
            className="input"
          />
          <div className="grid grid-cols-3 gap-2">
            <input name="author" placeholder="Tác giả" className="input" />
            <input
              name="publisher"
              placeholder="Nhà xuất bản"
              className="input"
            />
            <input name="edition" placeholder="Phiên bản" className="input" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input name="isbn" placeholder="ISBN" className="input" />
            <input name="url" placeholder="URL (nếu trực tuyến)" className="input" />
          </div>
          <textarea
            name="content"
            placeholder="Tóm tắt / Mục lục..."
            rows={2}
            className="input"
          />
          <button className="btn-primary">Lưu</button>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Loại</th>
              <th className="table-th">Tên</th>
              <th className="table-th">Tác giả</th>
              <th className="table-th">NXB / Năm</th>
              <th className="table-th">Học phần</th>
              <th className="table-th"></th>
            </tr>
          </thead>
          <tbody>
            {textbooks.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="table-td">
                  <span
                    className={`badge ${
                      t.type === "MAIN"
                        ? "bg-brand-100 text-brand-700"
                        : t.type === "REFERENCE"
                          ? "bg-slate-100 text-slate-700"
                          : "bg-purple-100 text-purple-700"
                    }`}
                  >
                    {t.type}
                  </span>
                </td>
                <td className="table-td font-medium">
                  {t.title}
                  {t.url && (
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-600 ml-1"
                    >
                      ↗
                    </a>
                  )}
                  {t.content && (
                    <div className="text-xs text-slate-500 mt-1">
                      {t.content.slice(0, 120)}
                    </div>
                  )}
                </td>
                <td className="table-td">{t.author || "—"}</td>
                <td className="table-td">
                  {t.publisher || "—"} {t.year && `· ${t.year}`}
                </td>
                <td className="table-td text-xs">
                  {t.course.code} — {t.course.name}
                </td>
                <td className="table-td">
                  <button
                    onClick={() => del(t.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Xoá
                  </button>
                </td>
              </tr>
            ))}
            {textbooks.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-6 text-slate-500">
                  Chưa có giáo trình nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
