"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface CLO {
  id: string;
  code: string;
  description: string;
}
interface Syllabus {
  id: string;
  clos: CLO[];
}
interface Course {
  id: string;
  code: string;
  name: string;
  program: { code: string };
  syllabi: Syllabus[];
}
interface Question {
  id: string;
  courseId: string;
  cloId?: string | null;
  type: string;
  difficulty: string;
  bloomLevel?: string | null;
  content: string;
  options?: string | null;
  answer?: string | null;
  explanation?: string | null;
  status: string;
  course: { code: string; name: string };
  clo?: { code: string; description: string } | null;
}

const TYPE_LABEL: Record<string, string> = {
  MC: "Trắc nghiệm",
  TF: "Đúng/Sai",
  SHORT: "Ngắn",
  ESSAY: "Tự luận",
};
const DIFF_COLOR: Record<string, string> = {
  EASY: "bg-green-100 text-green-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  HARD: "bg-red-100 text-red-700",
};

export function QuestionManager({
  courses,
  questions,
  filter,
}: {
  courses: Course[];
  questions: Question[];
  filter: { courseId?: string; cloId?: string };
}) {
  const router = useRouter();
  const [courseId, setCourseId] = useState(filter.courseId || "");
  const [adding, setAdding] = useState(false);

  const selectedCourse = courses.find((c) => c.id === courseId);
  const availableCLOs = selectedCourse?.syllabi[0]?.clos || [];

  function applyFilter() {
    const params = new URLSearchParams();
    if (courseId) params.set("courseId", courseId);
    router.push(`/questions?${params.toString()}`);
  }

  async function add(form: FormData) {
    const type = form.get("type") as string;
    const options =
      type === "MC"
        ? JSON.stringify(
            ["A", "B", "C", "D"].map(
              (l) => (form.get(`opt_${l}`) as string) || "",
            ),
          )
        : null;
    const data = {
      courseId: form.get("courseId"),
      cloId: form.get("cloId") || null,
      type,
      difficulty: form.get("difficulty"),
      bloomLevel: form.get("bloomLevel") || null,
      content: form.get("content"),
      options,
      answer: form.get("answer") || null,
      explanation: form.get("explanation") || null,
    };
    await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setAdding(false);
    router.refresh();
  }

  async function del(id: string) {
    if (!confirm("Xoá câu hỏi này?")) return;
    await fetch(`/api/questions/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const stats = useMemo(() => {
    const s = { total: questions.length, easy: 0, medium: 0, hard: 0 };
    questions.forEach((q) => {
      if (q.difficulty === "EASY") s.easy++;
      if (q.difficulty === "MEDIUM") s.medium++;
      if (q.difficulty === "HARD") s.hard++;
    });
    return s;
  }, [questions]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3">
        <StatBox label="Tổng câu hỏi" value={stats.total} color="text-slate-700" />
        <StatBox label="Dễ" value={stats.easy} color="text-green-700" />
        <StatBox label="Trung bình" value={stats.medium} color="text-amber-700" />
        <StatBox label="Khó" value={stats.hard} color="text-red-700" />
      </div>

      <div className="card p-3 flex items-center gap-3">
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="input"
        >
          <option value="">— Lọc theo học phần —</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              [{c.program.code}] {c.code} — {c.name}
            </option>
          ))}
        </select>
        <button onClick={applyFilter} className="btn-secondary">
          Lọc
        </button>
        <div className="flex-1" />
        <button onClick={() => setAdding(!adding)} className="btn-primary">
          {adding ? "Hủy" : "+ Thêm câu hỏi"}
        </button>
      </div>

      {adding && <AddQuestionForm courses={courses} onSubmit={add} />}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">CLO</th>
              <th className="table-th">Loại</th>
              <th className="table-th">Bloom</th>
              <th className="table-th">Độ khó</th>
              <th className="table-th">Nội dung</th>
              <th className="table-th">Học phần</th>
              <th className="table-th"></th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr key={q.id} className="hover:bg-slate-50">
                <td className="table-td font-mono">{q.clo?.code || "—"}</td>
                <td className="table-td">{TYPE_LABEL[q.type] || q.type}</td>
                <td className="table-td">{q.bloomLevel || "—"}</td>
                <td className="table-td">
                  <span
                    className={`badge ${DIFF_COLOR[q.difficulty] || ""}`}
                  >
                    {q.difficulty}
                  </span>
                </td>
                <td className="table-td max-w-md">
                  <div className="line-clamp-2">{q.content}</div>
                  {q.options && (
                    <div className="text-xs text-slate-500 mt-1">
                      {(() => {
                        try {
                          const opts = JSON.parse(q.options) as string[];
                          return opts
                            .map(
                              (o, i) =>
                                `${String.fromCharCode(65 + i)}. ${o.slice(0, 30)}`,
                            )
                            .join(" · ");
                        } catch {
                          return "";
                        }
                      })()}
                    </div>
                  )}
                  {q.answer && (
                    <div className="text-xs text-green-700 mt-1">
                      ✓ Đáp án: {q.answer}
                    </div>
                  )}
                </td>
                <td className="table-td text-xs">{q.course.code}</td>
                <td className="table-td">
                  <button
                    onClick={() => del(q.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Xoá
                  </button>
                </td>
              </tr>
            ))}
            {questions.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-6 text-slate-500">
                  Chưa có câu hỏi nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddQuestionForm({
  courses,
  onSubmit,
}: {
  courses: Course[];
  onSubmit: (form: FormData) => void;
}) {
  const [type, setType] = useState("MC");
  const [courseId, setCourseId] = useState("");
  const course = courses.find((c) => c.id === courseId);
  const clos = course?.syllabi[0]?.clos || [];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className="card p-4 space-y-3 bg-blue-50"
    >
      <div className="grid grid-cols-4 gap-2">
        <select
          name="courseId"
          required
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="input"
        >
          <option value="">— Học phần —</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              [{c.program.code}] {c.code}
            </option>
          ))}
        </select>
        <select name="cloId" className="input">
          <option value="">— CLO —</option>
          {clos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.description.slice(0, 40)}
            </option>
          ))}
        </select>
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="input"
        >
          <option value="MC">Trắc nghiệm</option>
          <option value="TF">Đúng/Sai</option>
          <option value="SHORT">Ngắn</option>
          <option value="ESSAY">Tự luận</option>
        </select>
        <select name="difficulty" className="input" defaultValue="MEDIUM">
          <option value="EASY">Dễ</option>
          <option value="MEDIUM">Trung bình</option>
          <option value="HARD">Khó</option>
        </select>
      </div>

      <select name="bloomLevel" className="input">
        <option value="">— Mức Bloom —</option>
        {["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"].map(
          (b) => (
            <option key={b}>{b}</option>
          ),
        )}
      </select>

      <textarea
        name="content"
        required
        placeholder="Nội dung câu hỏi *"
        rows={2}
        className="input"
      />

      {type === "MC" && (
        <div className="grid grid-cols-2 gap-2">
          {["A", "B", "C", "D"].map((l) => (
            <input
              key={l}
              name={`opt_${l}`}
              placeholder={`Phương án ${l}`}
              className="input"
            />
          ))}
        </div>
      )}

      <input
        name="answer"
        placeholder={
          type === "MC"
            ? "Đáp án đúng (VD: A)"
            : type === "TF"
              ? "Đáp án (Đúng/Sai)"
              : "Đáp án"
        }
        className="input"
      />
      <textarea
        name="explanation"
        placeholder="Giải thích / hướng dẫn chấm"
        rows={2}
        className="input"
      />
      <button className="btn-primary">Lưu câu hỏi</button>
    </form>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="card p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
