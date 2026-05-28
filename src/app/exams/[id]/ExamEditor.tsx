"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface CLO {
  id: string;
  code: string;
  description: string;
}
interface Question {
  id: string;
  type: string;
  difficulty: string;
  bloomLevel?: string | null;
  content: string;
  options?: string | null;
  answer?: string | null;
  cloId?: string | null;
  clo?: CLO | null;
}
interface ExamQuestion {
  id: string;
  order: number;
  points: number;
  questionId: string;
  question: Question;
}
interface Exam {
  id: string;
  code: string;
  title: string;
  type: string;
  duration: number;
  totalPoints: number;
  matrix?: string | null;
  instructions?: string | null;
  status: string;
  course: {
    code: string;
    name: string;
    program: { code: string; name: string };
    syllabi: { clos: CLO[] }[];
  };
  examQuestions: ExamQuestion[];
}

export function ExamEditor({
  exam,
  allQuestions,
}: {
  exam: Exam;
  allQuestions: Question[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"matrix" | "questions" | "preview">("matrix");
  const clos = exam.course.syllabi[0]?.clos || [];

  const tabs = [
    { id: "matrix", label: "Ma trận đề thi" },
    { id: "questions", label: `Câu hỏi (${exam.examQuestions.length})` },
    { id: "preview", label: "Xem trước & Xuất" },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="border-b flex items-center gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.id
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-600 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto py-2">
          <select
            value={exam.status}
            onChange={async (e) => {
              await fetch(`/api/exams/${exam.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: e.target.value }),
              });
              router.refresh();
            }}
            className="input text-xs py-1"
          >
            <option value="DRAFT">DRAFT</option>
            <option value="APPROVED">APPROVED</option>
            <option value="ARCHIVED">ARCHIVED (Đã lưu trữ)</option>
          </select>
        </div>
      </div>

      {tab === "matrix" && (
        <MatrixTab exam={exam} clos={clos} allQuestions={allQuestions} />
      )}
      {tab === "questions" && (
        <QuestionsTab exam={exam} allQuestions={allQuestions} />
      )}
      {tab === "preview" && <PreviewTab exam={exam} />}
    </div>
  );
}

interface MatrixCell {
  cloId: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  count: number;
  points: number;
}

function MatrixTab({
  exam,
  clos,
  allQuestions,
}: {
  exam: Exam;
  clos: CLO[];
  allQuestions: Question[];
}) {
  const router = useRouter();
  const initial: MatrixCell[] = useMemo(() => {
    try {
      return exam.matrix ? JSON.parse(exam.matrix) : [];
    } catch {
      return [];
    }
  }, [exam.matrix]);

  const [cells, setCells] = useState<MatrixCell[]>(
    initial.length > 0
      ? initial
      : clos.flatMap((clo) =>
          (["EASY", "MEDIUM", "HARD"] as const).map((d) => ({
            cloId: clo.id,
            difficulty: d,
            count: 0,
            points: d === "EASY" ? 1 : d === "MEDIUM" ? 1.5 : 2,
          })),
        ),
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    picked: number;
    totalPoints: number;
    missing: { cloId: string; difficulty: string; need: number; got: number }[];
  } | null>(null);

  function update(
    cloId: string,
    diff: "EASY" | "MEDIUM" | "HARD",
    key: "count" | "points",
    value: number,
  ) {
    setCells((cs) =>
      cs.map((c) =>
        c.cloId === cloId && c.difficulty === diff ? { ...c, [key]: value } : c,
      ),
    );
  }

  function poolCount(cloId: string, diff: string) {
    return allQuestions.filter(
      (q) => q.cloId === cloId && q.difficulty === diff,
    ).length;
  }

  async function generate() {
    setLoading(true);
    const res = await fetch(`/api/exams/${exam.id}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matrix: cells.filter((c) => c.count > 0) }),
    });
    const json = await res.json();
    setLoading(false);
    setResult(json);
    router.refresh();
  }

  const totalCount = cells.reduce((s, c) => s + Number(c.count || 0), 0);
  const totalPoints = cells.reduce(
    (s, c) => s + Number(c.count || 0) * Number(c.points || 0),
    0,
  );

  if (clos.length === 0) {
    return (
      <div className="card p-6 text-center text-slate-500">
        Học phần chưa có CLO trong đề cương. Hãy tạo đề cương và CLO trước khi
        xây dựng ma trận.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-slate-600">
        Ma trận đề thi: chọn số câu và điểm cho mỗi CLO × mức độ. Hệ thống sẽ
        random từ ngân hàng câu hỏi đang có. (Trong ngoặc = số câu khả dụng)
      </div>

      <div className="card overflow-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">CLO</th>
              <th className="table-th text-center bg-green-50">
                Dễ — câu × điểm
              </th>
              <th className="table-th text-center bg-amber-50">
                TB — câu × điểm
              </th>
              <th className="table-th text-center bg-red-50">
                Khó — câu × điểm
              </th>
              <th className="table-th text-center">Tổng</th>
            </tr>
          </thead>
          <tbody>
            {clos.map((clo) => {
              const row = (["EASY", "MEDIUM", "HARD"] as const).map(
                (d) =>
                  cells.find((c) => c.cloId === clo.id && c.difficulty === d) ||
                  { cloId: clo.id, difficulty: d, count: 0, points: 0 },
              );
              const sumQ = row.reduce((s, r) => s + Number(r.count || 0), 0);
              const sumP = row.reduce(
                (s, r) => s + Number(r.count || 0) * Number(r.points || 0),
                0,
              );
              return (
                <tr key={clo.id}>
                  <td className="table-td">
                    <div className="font-mono font-semibold">{clo.code}</div>
                    <div className="text-xs text-slate-500 max-w-xs">
                      {clo.description}
                    </div>
                  </td>
                  {row.map((r, i) => (
                    <td key={i} className="table-td">
                      <div className="flex items-center gap-1 justify-center">
                        <input
                          type="number"
                          min={0}
                          value={r.count}
                          onChange={(e) =>
                            update(
                              clo.id,
                              r.difficulty,
                              "count",
                              Number(e.target.value),
                            )
                          }
                          className="input w-14 text-center text-sm py-1"
                        />
                        <span>×</span>
                        <input
                          type="number"
                          step={0.25}
                          min={0}
                          value={r.points}
                          onChange={(e) =>
                            update(
                              clo.id,
                              r.difficulty,
                              "points",
                              Number(e.target.value),
                            )
                          }
                          className="input w-16 text-center text-sm py-1"
                        />
                        <span className="text-xs text-slate-400">
                          ({poolCount(clo.id, r.difficulty)})
                        </span>
                      </div>
                    </td>
                  ))}
                  <td className="table-td text-center font-semibold">
                    {sumQ} câu · {sumP.toFixed(2)}đ
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="table-td font-semibold">Tổng</td>
              <td colSpan={3} className="table-td"></td>
              <td className="table-td text-center font-bold">
                {totalCount} câu · {totalPoints.toFixed(2)}đ
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex gap-2">
        <button onClick={generate} className="btn-primary" disabled={loading}>
          {loading ? "Đang sinh đề..." : "🎲 Sinh đề thi từ ma trận"}
        </button>
        <button
          onClick={async () => {
            await fetch(`/api/exams/${exam.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ matrix: JSON.stringify(cells) }),
            });
            router.refresh();
          }}
          className="btn-secondary"
        >
          💾 Lưu ma trận
        </button>
      </div>

      {result && (
        <div
          className={`card p-4 ${
            result.missing.length > 0
              ? "bg-amber-50 border-amber-200"
              : "bg-green-50 border-green-200"
          }`}
        >
          <div className="font-semibold">
            ✓ Đã chọn {result.picked} câu, tổng điểm {result.totalPoints}
          </div>
          {result.missing.length > 0 && (
            <div className="text-sm text-amber-800 mt-1">
              ⚠ Thiếu câu hỏi:{" "}
              {result.missing.map((m, i) => (
                <span key={i}>
                  CLO{" "}
                  {clos.find((c) => c.id === m.cloId)?.code || m.cloId} -{" "}
                  {m.difficulty} (cần {m.need}, có {m.got});{" "}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionsTab({
  exam,
  allQuestions,
}: {
  exam: Exam;
  allQuestions: Question[];
}) {
  const router = useRouter();
  const [picker, setPicker] = useState(false);

  async function add(questionId: string) {
    await fetch(`/api/exams/${exam.id}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, points: 1 }),
    });
    router.refresh();
  }

  async function remove(questionId: string) {
    await fetch(`/api/exams/${exam.id}/questions`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId }),
    });
    router.refresh();
  }

  const existing = new Set(exam.examQuestions.map((q) => q.questionId));
  const available = allQuestions.filter((q) => !existing.has(q.id));

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="text-sm text-slate-600">
          Danh sách câu hỏi trong đề (có thể thêm thủ công ngoài ma trận)
        </div>
        <button onClick={() => setPicker(!picker)} className="btn-primary">
          {picker ? "Đóng" : "+ Thêm câu hỏi"}
        </button>
      </div>

      {picker && (
        <div className="card p-3 bg-blue-50 max-h-72 overflow-auto">
          {available.length === 0 ? (
            <div className="text-sm text-slate-500">
              Không còn câu hỏi nào để thêm.
            </div>
          ) : (
            <ul className="space-y-1">
              {available.map((q) => (
                <li
                  key={q.id}
                  className="text-sm flex items-start gap-2 hover:bg-blue-100 p-1 rounded"
                >
                  <button
                    onClick={() => add(q.id)}
                    className="text-brand-600 hover:underline text-xs"
                  >
                    + Thêm
                  </button>
                  <span className="badge bg-slate-100 text-slate-700 text-xs">
                    {q.clo?.code || "—"}
                  </span>
                  <span className="badge bg-slate-100 text-slate-700 text-xs">
                    {q.difficulty}
                  </span>
                  <span className="flex-1">{q.content.slice(0, 100)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">#</th>
              <th className="table-th">CLO</th>
              <th className="table-th">Loại</th>
              <th className="table-th">Độ khó</th>
              <th className="table-th">Nội dung</th>
              <th className="table-th">Điểm</th>
              <th className="table-th"></th>
            </tr>
          </thead>
          <tbody>
            {exam.examQuestions.map((eq) => (
              <tr key={eq.id} className="hover:bg-slate-50">
                <td className="table-td">{eq.order}</td>
                <td className="table-td font-mono">
                  {eq.question.clo?.code || "—"}
                </td>
                <td className="table-td">{eq.question.type}</td>
                <td className="table-td">{eq.question.difficulty}</td>
                <td className="table-td max-w-md">
                  <div className="line-clamp-2">{eq.question.content}</div>
                </td>
                <td className="table-td">{eq.points}</td>
                <td className="table-td">
                  <button
                    onClick={() => remove(eq.questionId)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Bỏ
                  </button>
                </td>
              </tr>
            ))}
            {exam.examQuestions.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-6 text-slate-500">
                  Chưa có câu hỏi nào. Hãy sinh đề từ ma trận hoặc thêm thủ công.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PreviewTab({ exam }: { exam: Exam }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => window.print()}
          className="btn-primary"
        >
          🖨️ In / Xuất PDF
        </button>
      </div>
      <div className="card p-8 bg-white font-serif">
        <div className="text-center border-b pb-4">
          <div className="text-xs">{exam.course.program.name.toUpperCase()}</div>
          <div className="font-bold text-lg mt-1">
            ĐỀ THI {exam.type === "FINAL" ? "KẾT THÚC HỌC PHẦN" : exam.type}
          </div>
          <div className="text-sm mt-1">
            Học phần: <b>{exam.course.code} — {exam.course.name}</b>
          </div>
          <div className="text-sm">
            Mã đề: <b>{exam.code}</b> · Thời gian: <b>{exam.duration} phút</b>
          </div>
        </div>
        {exam.instructions && (
          <div className="my-4 text-sm italic">{exam.instructions}</div>
        )}
        <ol className="space-y-4 mt-4">
          {exam.examQuestions.map((eq) => (
            <li key={eq.id}>
              <div className="font-semibold">
                Câu {eq.order} ({eq.points} điểm):
              </div>
              <div className="ml-1 whitespace-pre-wrap">
                {eq.question.content}
              </div>
              {eq.question.options && (() => {
                try {
                  const opts = JSON.parse(eq.question.options) as string[];
                  return (
                    <div className="ml-4 mt-1 space-y-1">
                      {opts.map((o, i) => (
                        <div key={i}>
                          {String.fromCharCode(65 + i)}. {o}
                        </div>
                      ))}
                    </div>
                  );
                } catch {
                  return null;
                }
              })()}
            </li>
          ))}
        </ol>
        <div className="mt-8 text-right text-sm italic text-slate-500">
          --- Hết ---
        </div>
      </div>
    </div>
  );
}
