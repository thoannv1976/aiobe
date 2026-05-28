"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CLOPLOMap {
  id: string;
  cloId: string;
  ploId: string;
  contribution: string;
}
interface CLO {
  id: string;
  code: string;
  description: string;
  bloomLevel?: string | null;
  category?: string | null;
  ploMaps: CLOPLOMap[];
}
interface PI {
  id: string;
  code: string;
  description: string;
}
interface PLO {
  id: string;
  code: string;
  description: string;
  pis: PI[];
}
interface Syllabus {
  id: string;
  version: string;
  status: string;
  objective?: string | null;
  description?: string | null;
  teachingMethod?: string | null;
  assessmentPlan?: string | null;
  course: {
    id: string;
    code: string;
    name: string;
    program: { plos: PLO[] };
  };
  clos: CLO[];
}

const CONTRIBUTIONS = ["", "I", "R", "M", "A"];
const CONTRIB_COLORS: Record<string, string> = {
  I: "bg-blue-100 text-blue-700",
  R: "bg-amber-100 text-amber-700",
  M: "bg-purple-100 text-purple-700",
  A: "bg-green-100 text-green-700",
};

export function SyllabusEditor({ syllabus }: { syllabus: Syllabus }) {
  const router = useRouter();
  const [tab, setTab] = useState<
    "info" | "clo" | "matrix" | "assessment"
  >("info");

  const tabs = [
    { id: "info", label: "Thông tin chung" },
    { id: "clo", label: `CLO (${syllabus.clos.length})` },
    { id: "matrix", label: "Ma trận CLO ↔ PLO" },
    { id: "assessment", label: "Kế hoạch đánh giá" },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="border-b flex gap-1">
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
            value={syllabus.status}
            onChange={async (e) => {
              await fetch(`/api/syllabi/${syllabus.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: e.target.value }),
              });
              router.refresh();
            }}
            className="input text-xs py-1"
          >
            <option value="DRAFT">DRAFT</option>
            <option value="REVIEW">REVIEW</option>
            <option value="APPROVED">APPROVED</option>
          </select>
        </div>
      </div>

      {tab === "info" && <InfoTab syllabus={syllabus} />}
      {tab === "clo" && <CLOTab syllabus={syllabus} />}
      {tab === "matrix" && <MatrixTab syllabus={syllabus} />}
      {tab === "assessment" && <AssessmentTab syllabus={syllabus} />}
    </div>
  );
}

function InfoTab({ syllabus }: { syllabus: Syllabus }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({
    objective: syllabus.objective || "",
    description: syllabus.description || "",
    teachingMethod: syllabus.teachingMethod || "",
    version: syllabus.version,
  });

  async function save() {
    setSaving(true);
    await fetch(`/api/syllabi/${syllabus.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="card p-5 space-y-4">
      <div>
        <label className="label">Phiên bản</label>
        <input
          value={data.version}
          onChange={(e) => setData({ ...data, version: e.target.value })}
          className="input max-w-xs"
        />
      </div>
      <div>
        <label className="label">Mục tiêu học phần</label>
        <textarea
          rows={3}
          value={data.objective}
          onChange={(e) => setData({ ...data, objective: e.target.value })}
          className="input"
        />
      </div>
      <div>
        <label className="label">Mô tả học phần</label>
        <textarea
          rows={3}
          value={data.description}
          onChange={(e) => setData({ ...data, description: e.target.value })}
          className="input"
        />
      </div>
      <div>
        <label className="label">Phương pháp giảng dạy</label>
        <textarea
          rows={3}
          value={data.teachingMethod}
          onChange={(e) =>
            setData({ ...data, teachingMethod: e.target.value })
          }
          className="input"
        />
      </div>
      <button onClick={save} className="btn-primary" disabled={saving}>
        {saving ? "Đang lưu..." : "💾 Lưu thông tin"}
      </button>
    </div>
  );
}

function CLOTab({ syllabus }: { syllabus: Syllabus }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);

  async function addCLO(form: FormData) {
    await fetch("/api/clos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        syllabusId: syllabus.id,
        code: form.get("code"),
        description: form.get("description"),
        bloomLevel: form.get("bloomLevel") || null,
        category: form.get("category") || null,
      }),
    });
    setAdding(false);
    router.refresh();
  }

  async function del(id: string) {
    if (!confirm("Xoá CLO này?")) return;
    await fetch(`/api/clos/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function aiSuggest() {
    const hasExisting = syllabus.clos.length > 0;
    const msg = hasExisting
      ? "Sẽ XOÁ toàn bộ CLO hiện tại và sinh CLO mới bằng AI (kèm gợi ý map sang PLO). Tiếp tục?"
      : "Sinh CLO bằng AI dựa trên tên học phần + PLO chương trình. Tiếp tục?";
    if (!confirm(msg)) return;

    setAiBusy(true);
    setAiMsg(null);
    try {
      const res = await fetch(
        `/api/syllabi/${syllabus.id}/ai-suggest-clos?apply=true`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok) {
        setAiMsg(`Lỗi: ${json.error}`);
      } else {
        setAiMsg(`✓ AI đã tạo ${json.suggestions.clos.length} CLO + ploMaps tương ứng`);
        router.refresh();
      }
    } catch (e: any) {
      setAiMsg(`Lỗi: ${e.message}`);
    } finally {
      setAiBusy(false);
    }
  }

  const next = syllabus.clos.length + 1;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center gap-2">
        <div className="text-sm text-slate-600">
          Course Learning Outcomes — chuẩn đầu ra học phần
        </div>
        <div className="flex gap-2">
          <button
            onClick={aiSuggest}
            disabled={aiBusy}
            className="text-xs px-3 py-1.5 rounded border border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100 disabled:opacity-50"
            title="AI sinh CLO + tự map sang PLO chương trình"
          >
            {aiBusy ? "Đang sinh..." : "✨ AI gợi ý CLO"}
          </button>
          <button onClick={() => setAdding(!adding)} className="btn-primary">
            {adding ? "Hủy" : "+ Thêm CLO"}
          </button>
        </div>
      </div>

      {aiMsg && (
        <div
          className={`card p-2 text-sm ${
            aiMsg.startsWith("✓")
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {aiMsg}
        </div>
      )}

      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addCLO(new FormData(e.currentTarget));
          }}
          className="card p-4 space-y-2 bg-blue-50"
        >
          <div className="grid grid-cols-4 gap-2">
            <input
              name="code"
              required
              defaultValue={`CLO${next}`}
              className="input"
            />
            <select name="category" className="input">
              <option value="">— Phân loại —</option>
              <option>Kiến thức</option>
              <option>Kỹ năng</option>
              <option>Thái độ</option>
            </select>
            <select name="bloomLevel" className="input">
              <option value="">— Bloom —</option>
              {[
                "Remember",
                "Understand",
                "Apply",
                "Analyze",
                "Evaluate",
                "Create",
              ].map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
            <button className="btn-primary">Lưu CLO</button>
          </div>
          <textarea
            name="description"
            required
            placeholder="Mô tả CLO..."
            rows={2}
            className="input"
          />
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Mã</th>
              <th className="table-th">Mô tả</th>
              <th className="table-th">Phân loại</th>
              <th className="table-th">Bloom</th>
              <th className="table-th">PLO map</th>
              <th className="table-th"></th>
            </tr>
          </thead>
          <tbody>
            {syllabus.clos.map((clo) => (
              <tr key={clo.id} className="hover:bg-slate-50">
                <td className="table-td font-mono font-semibold">{clo.code}</td>
                <td className="table-td">{clo.description}</td>
                <td className="table-td">{clo.category || "—"}</td>
                <td className="table-td">{clo.bloomLevel || "—"}</td>
                <td className="table-td">
                  {clo.ploMaps.length > 0 ? (
                    clo.ploMaps.map((m) => {
                      const plo = syllabus.course.program.plos.find(
                        (p) => p.id === m.ploId,
                      );
                      return (
                        <span
                          key={m.id}
                          className={`badge mr-1 ${
                            CONTRIB_COLORS[m.contribution] ||
                            "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {plo?.code} ({m.contribution})
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-slate-400 text-xs">Chưa map</span>
                  )}
                </td>
                <td className="table-td">
                  <button
                    onClick={() => del(clo.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Xoá
                  </button>
                </td>
              </tr>
            ))}
            {syllabus.clos.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-6 text-slate-500">
                  Chưa có CLO nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MatrixTab({ syllabus }: { syllabus: Syllabus }) {
  const router = useRouter();
  const plos = syllabus.course.program.plos;
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);

  async function setContribution(
    cloId: string,
    ploId: string,
    contribution: string,
  ) {
    await fetch("/api/clo-plo-map", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cloId, ploId, contribution }),
    });
    router.refresh();
  }

  function getMap(cloId: string, ploId: string) {
    const clo = syllabus.clos.find((c) => c.id === cloId);
    return clo?.ploMaps.find((m) => m.ploId === ploId)?.contribution || "";
  }

  async function aiAutoMap() {
    if (!confirm("AI sẽ tự động map CLO ↔ PLO, GHI ĐÈ toàn bộ map hiện tại. Tiếp tục?"))
      return;
    setAiBusy(true);
    setAiMsg(null);
    try {
      const res = await fetch(`/api/syllabi/${syllabus.id}/ai-map`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setAiMsg(`Lỗi: ${json.error}`);
      } else {
        setAiMsg(`✓ AI đã tạo ${json.created} mapping`);
        router.refresh();
      }
    } catch (e: any) {
      setAiMsg(`Lỗi: ${e.message}`);
    } finally {
      setAiBusy(false);
    }
  }

  if (plos.length === 0) {
    return (
      <div className="card p-6 text-center text-slate-500">
        Chương trình chưa có PLO. Hãy thêm PLO trước khi map CLO ↔ PLO.
      </div>
    );
  }
  if (syllabus.clos.length === 0) {
    return (
      <div className="card p-6 text-center text-slate-500">
        Hãy thêm CLO trước khi xây dựng ma trận.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center gap-2">
        <div className="text-sm text-slate-600">
          Ma trận đóng góp CLO ↔ PLO. Quy ước:{" "}
          <span className="badge bg-blue-100 text-blue-700">I</span> Introduce ·{" "}
          <span className="badge bg-amber-100 text-amber-700">R</span> Reinforce ·{" "}
          <span className="badge bg-purple-100 text-purple-700">M</span> Master ·{" "}
          <span className="badge bg-green-100 text-green-700">A</span> Assess
        </div>
        <button
          onClick={aiAutoMap}
          disabled={aiBusy}
          className="text-xs px-3 py-1.5 rounded border border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100 disabled:opacity-50 whitespace-nowrap"
          title="AI tự động map CLO ↔ PLO dựa trên nội dung"
        >
          {aiBusy ? "Đang map..." : "✨ AI auto-map"}
        </button>
      </div>
      {aiMsg && (
        <div
          className={`card p-2 text-sm ${
            aiMsg.startsWith("✓")
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {aiMsg}
        </div>
      )}
      <div className="card overflow-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th sticky left-0 bg-slate-50">CLO \\ PLO</th>
              {plos.map((plo) => (
                <th key={plo.id} className="table-th text-center" title={plo.description}>
                  {plo.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {syllabus.clos.map((clo) => (
              <tr key={clo.id} className="hover:bg-slate-50">
                <td className="table-td sticky left-0 bg-white font-medium">
                  <div className="font-mono">{clo.code}</div>
                  <div className="text-xs text-slate-500 max-w-xs truncate">
                    {clo.description}
                  </div>
                </td>
                {plos.map((plo) => {
                  const v = getMap(clo.id, plo.id);
                  return (
                    <td key={plo.id} className="table-td text-center">
                      <select
                        value={v}
                        onChange={(e) =>
                          setContribution(clo.id, plo.id, e.target.value)
                        }
                        className={`rounded px-1 py-0.5 text-xs font-bold ${
                          v
                            ? CONTRIB_COLORS[v] || "bg-slate-100"
                            : "bg-white border"
                        }`}
                      >
                        {CONTRIBUTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c || "—"}
                          </option>
                        ))}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AssessmentTab({ syllabus }: { syllabus: Syllabus }) {
  const router = useRouter();
  let initial: any[] = [];
  try {
    initial = syllabus.assessmentPlan ? JSON.parse(syllabus.assessmentPlan) : [];
  } catch {
    initial = [];
  }
  const [items, setItems] = useState<
    { name: string; type: string; weight: number; cloRefs: string }[]
  >(
    initial.length > 0
      ? initial
      : [
          {
            name: "Chuyên cần",
            type: "Quá trình",
            weight: 10,
            cloRefs: "",
          },
          {
            name: "Bài tập / Thực hành",
            type: "Quá trình",
            weight: 20,
            cloRefs: "",
          },
          { name: "Giữa kỳ", type: "MIDTERM", weight: 20, cloRefs: "" },
          { name: "Cuối kỳ", type: "FINAL", weight: 50, cloRefs: "" },
        ],
  );

  function update(i: number, key: string, value: any) {
    const next = [...items];
    (next[i] as any)[key] = value;
    setItems(next);
  }

  async function save() {
    await fetch(`/api/syllabi/${syllabus.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assessmentPlan: JSON.stringify(items) }),
    });
    router.refresh();
  }

  const totalWeight = items.reduce((s, x) => s + Number(x.weight || 0), 0);

  return (
    <div className="space-y-3">
      <div className="text-sm text-slate-600">
        Kế hoạch đánh giá học phần (Assessment Plan) — bám CLO theo OBE.
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Hoạt động đánh giá</th>
              <th className="table-th">Loại</th>
              <th className="table-th">Trọng số (%)</th>
              <th className="table-th">CLO đánh giá</th>
              <th className="table-th"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td className="table-td">
                  <input
                    value={it.name}
                    onChange={(e) => update(i, "name", e.target.value)}
                    className="input text-sm py-1"
                  />
                </td>
                <td className="table-td">
                  <select
                    value={it.type}
                    onChange={(e) => update(i, "type", e.target.value)}
                    className="input text-sm py-1"
                  >
                    <option>Quá trình</option>
                    <option>MIDTERM</option>
                    <option>FINAL</option>
                    <option>QUIZ</option>
                    <option>Project</option>
                  </select>
                </td>
                <td className="table-td">
                  <input
                    type="number"
                    value={it.weight}
                    onChange={(e) =>
                      update(i, "weight", Number(e.target.value))
                    }
                    className="input text-sm py-1 w-20"
                  />
                </td>
                <td className="table-td">
                  <input
                    placeholder="VD: CLO1, CLO2"
                    value={it.cloRefs}
                    onChange={(e) => update(i, "cloRefs", e.target.value)}
                    className="input text-sm py-1"
                  />
                </td>
                <td className="table-td">
                  <button
                    onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                    className="text-xs text-red-600"
                  >
                    Xoá
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="table-td font-semibold">Tổng</td>
              <td></td>
              <td className="table-td font-bold">
                <span
                  className={
                    totalWeight === 100 ? "text-green-700" : "text-red-700"
                  }
                >
                  {totalWeight}%
                </span>
              </td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() =>
            setItems([
              ...items,
              { name: "", type: "Quá trình", weight: 0, cloRefs: "" },
            ])
          }
          className="btn-secondary"
        >
          + Thêm dòng
        </button>
        <button onClick={save} className="btn-primary">
          💾 Lưu kế hoạch đánh giá
        </button>
      </div>
    </div>
  );
}
