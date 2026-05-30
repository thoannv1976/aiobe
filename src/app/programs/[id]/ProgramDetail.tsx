"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface PI {
  id: string;
  code: string;
  description: string;
}
interface PLO {
  id: string;
  code: string;
  description: string;
  bloomLevel?: string | null;
  category?: string | null;
  pis: PI[];
}
interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
  semester?: number | null;
  type?: string | null;
}
interface Program {
  id: string;
  code: string;
  name: string;
  goals?: string | null;
  plos: PLO[];
  courses: Course[];
}

export function ProgramDetail({ program }: { program: Program }) {
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "plos" | "courses">("overview");
  const [reExtracting, setReExtracting] = useState(false);
  const [reExtractMsg, setReExtractMsg] = useState<string | null>(null);

  const tabs = [
    { id: "overview", label: "Tổng quan" },
    { id: "plos", label: `PLO / PI (${program.plos.length})` },
    { id: "courses", label: `Học phần (${program.courses.length})` },
  ] as const;

  async function doExtract() {
    if (
      !confirm(
        "AI sẽ XOÁ toàn bộ PLO/PI/học phần hiện tại và trích xuất lại từ văn bản gốc bằng Claude. " +
          "Quá trình mất 1-3 phút cho đề án dài. Mọi đề cương/câu hỏi/đề thi gắn với các môn cũ cũng sẽ bị xoá. " +
          "Tiếp tục?",
      )
    )
      return;

    setReExtracting(true);
    setReExtractMsg("Đang gọi Claude AI (1-3 phút)…");
    try {
      const res = await fetch(`/api/programs/${program.id}/ai-extract`, {
        method: "POST",
      });
      // Đọc text trước rồi mới parse — tránh "Unexpected end of JSON input"
      const raw = await res.text();
      let json: any = null;
      if (raw) {
        try {
          json = JSON.parse(raw);
        } catch {
          /* not JSON */
        }
      }
      if (!res.ok) {
        const msg = json?.error
          ? json.error
          : raw
            ? `HTTP ${res.status}: ${raw.slice(0, 300)}`
            : `HTTP ${res.status} — server không phản hồi (timeout hoặc crash). Thử lại sau 30s.`;
        setReExtractMsg(`Lỗi: ${msg}`);
      } else if (json?.extracted) {
        setReExtractMsg(
          `✓ AI trích xuất: ${json.extracted.ploCount} PLO, ${json.extracted.piCount} PI, ${json.extracted.courseCount} học phần`,
        );
        router.refresh();
      } else {
        setReExtractMsg("Server trả về phản hồi rỗng — thử lại.");
      }
    } catch (e: any) {
      setReExtractMsg(`Lỗi mạng: ${e.message || e}`);
    } finally {
      setReExtracting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="border-b flex gap-1 items-center">
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
        <div className="ml-auto mb-1 flex gap-1 items-center">
          <button
            onClick={doExtract}
            disabled={reExtracting}
            className="text-xs px-3 py-1.5 rounded border border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100 disabled:opacity-50"
            title="Trích xuất lại bằng Claude AI (1-3 phút cho đề án dài)"
          >
            {reExtracting ? "⏳ Đang trích xuất…" : "✨ AI trích xuất lại"}
          </button>
        </div>
      </div>

      {reExtractMsg && (
        <div
          className={`card p-3 text-sm ${
            reExtractMsg.startsWith("✓")
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {reExtractMsg}
        </div>
      )}

      {tab === "overview" && (
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-slate-800">Mục tiêu chương trình</h2>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">
            {program.goals || "Chưa trích xuất được mục tiêu chương trình."}
          </p>
          <div className="grid grid-cols-3 gap-3 pt-3">
            <div className="text-center bg-blue-50 rounded p-3">
              <div className="text-2xl font-bold text-blue-700">
                {program.plos.length}
              </div>
              <div className="text-xs text-blue-700">PLO</div>
            </div>
            <div className="text-center bg-purple-50 rounded p-3">
              <div className="text-2xl font-bold text-purple-700">
                {program.plos.reduce((s, p) => s + p.pis.length, 0)}
              </div>
              <div className="text-xs text-purple-700">PI</div>
            </div>
            <div className="text-center bg-green-50 rounded p-3">
              <div className="text-2xl font-bold text-green-700">
                {program.courses.length}
              </div>
              <div className="text-xs text-green-700">Học phần</div>
            </div>
          </div>
        </div>
      )}

      {tab === "plos" && (
        <PLOEditor program={program} onChange={() => router.refresh()} />
      )}

      {tab === "courses" && (
        <CoursesEditor program={program} onChange={() => router.refresh()} />
      )}
    </div>
  );
}

function PLOEditor({
  program,
  onChange,
}: {
  program: Program;
  onChange: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function addPLO(form: FormData) {
    const data = {
      programId: program.id,
      code: form.get("code") as string,
      description: form.get("description") as string,
      bloomLevel: (form.get("bloomLevel") as string) || null,
      category: (form.get("category") as string) || null,
    };
    await fetch("/api/plos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setAdding(false);
    onChange();
  }

  async function addPI(ploId: string, code: string, description: string) {
    await fetch("/api/pis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ploId, code, description }),
    });
    onChange();
  }

  async function deletePLO(id: string) {
    if (!confirm("Xoá PLO này?")) return;
    await fetch(`/api/plos/${id}`, { method: "DELETE" });
    onChange();
  }

  async function deletePI(id: string) {
    if (!confirm("Xoá PI này?")) return;
    await fetch(`/api/pis/${id}`, { method: "DELETE" });
    onChange();
  }

  async function updatePLO(id: string, data: any) {
    await fetch(`/api/plos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setEditingId(null);
    onChange();
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="text-sm text-slate-600">
          Chuẩn đầu ra chương trình (PLO) và Chỉ báo thực hiện (PI)
        </div>
        <button onClick={() => setAdding(!adding)} className="btn-primary">
          {adding ? "Hủy" : "+ Thêm PLO"}
        </button>
      </div>

      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addPLO(new FormData(e.currentTarget));
          }}
          className="card p-4 space-y-3 bg-blue-50"
        >
          <div className="grid grid-cols-4 gap-2">
            <input name="code" required placeholder="PLO5" className="input" />
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
            <button type="submit" className="btn-primary">
              Lưu PLO
            </button>
          </div>
          <textarea
            name="description"
            required
            placeholder="Mô tả PLO..."
            className="input"
            rows={2}
          />
        </form>
      )}

      <div className="space-y-3">
        {program.plos.length === 0 && (
          <div className="card p-6 text-center text-slate-500">
            Chưa có PLO nào.
          </div>
        )}
        {program.plos.map((plo) => (
          <div key={plo.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="badge bg-brand-100 text-brand-700 font-bold">
                    {plo.code}
                  </span>
                  {plo.category && (
                    <span className="badge bg-slate-100 text-slate-700">
                      {plo.category}
                    </span>
                  )}
                  {plo.bloomLevel && (
                    <span className="badge bg-amber-100 text-amber-700">
                      {plo.bloomLevel}
                    </span>
                  )}
                </div>
                {editingId === plo.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      updatePLO(plo.id, {
                        description: f.get("description"),
                        bloomLevel: f.get("bloomLevel") || null,
                        category: f.get("category") || null,
                      });
                    }}
                    className="mt-2 space-y-2"
                  >
                    <textarea
                      name="description"
                      defaultValue={plo.description}
                      className="input"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <select
                        name="category"
                        defaultValue={plo.category || ""}
                        className="input"
                      >
                        <option value="">— Phân loại —</option>
                        <option>Kiến thức</option>
                        <option>Kỹ năng</option>
                        <option>Thái độ</option>
                      </select>
                      <select
                        name="bloomLevel"
                        defaultValue={plo.bloomLevel || ""}
                        className="input"
                      >
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
                      <button type="submit" className="btn-primary">
                        Lưu
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="btn-secondary"
                      >
                        Hủy
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="text-sm text-slate-700 mt-1">{plo.description}</p>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() =>
                    setEditingId(editingId === plo.id ? null : plo.id)
                  }
                  className="text-xs text-brand-600 hover:underline px-1"
                >
                  Sửa
                </button>
                <button
                  onClick={() => deletePLO(plo.id)}
                  className="text-xs text-red-600 hover:underline px-1"
                >
                  Xoá
                </button>
              </div>
            </div>

            <div className="mt-3 ml-2 pl-3 border-l-2 border-slate-200 space-y-1">
              {plo.pis.map((pi) => (
                <div
                  key={pi.id}
                  className="flex items-center gap-2 text-sm group"
                >
                  <span className="badge bg-purple-100 text-purple-700 font-mono">
                    {pi.code}
                  </span>
                  <span className="text-slate-700">{pi.description}</span>
                  <button
                    onClick={() => deletePI(pi.id)}
                    className="text-xs text-red-500 opacity-0 group-hover:opacity-100 ml-auto"
                  >
                    Xoá
                  </button>
                </div>
              ))}
              <PIAdder
                ploCode={plo.code}
                ploId={plo.id}
                onAdd={addPI}
                nextIndex={plo.pis.length + 1}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PIAdder({
  ploCode,
  ploId,
  onAdd,
  nextIndex,
}: {
  ploCode: string;
  ploId: string;
  onAdd: (ploId: string, code: string, desc: string) => void;
  nextIndex: number;
}) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-brand-600 hover:underline mt-1"
      >
        + Thêm PI
      </button>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onAdd(ploId, f.get("code") as string, f.get("desc") as string);
        setOpen(false);
      }}
      className="flex gap-2 items-start mt-2"
    >
      <input
        name="code"
        required
        defaultValue={`PI${ploCode.replace(/\D/g, "")}.${nextIndex}`}
        className="input w-24"
      />
      <input
        name="desc"
        required
        placeholder="Mô tả PI"
        className="input flex-1"
      />
      <button className="btn-primary">Lưu</button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="btn-secondary"
      >
        ✕
      </button>
    </form>
  );
}

function CoursesEditor({
  program,
  onChange,
}: {
  program: Program;
  onChange: () => void;
}) {
  const [adding, setAdding] = useState(false);

  async function addCourse(form: FormData) {
    const data = {
      programId: program.id,
      code: form.get("code") as string,
      name: form.get("name") as string,
      credits: parseInt((form.get("credits") as string) || "3", 10),
      semester: parseInt((form.get("semester") as string) || "0", 10) || null,
      type: (form.get("type") as string) || null,
    };
    await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setAdding(false);
    onChange();
  }

  async function del(id: string) {
    if (!confirm("Xoá học phần này?")) return;
    await fetch(`/api/courses/${id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="text-sm text-slate-600">
          Danh mục học phần thuộc chương trình
        </div>
        <button onClick={() => setAdding(!adding)} className="btn-primary">
          {adding ? "Hủy" : "+ Thêm học phần"}
        </button>
      </div>

      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addCourse(new FormData(e.currentTarget));
          }}
          className="card p-4 grid grid-cols-6 gap-2 bg-green-50"
        >
          <input name="code" required placeholder="Mã HP" className="input" />
          <input
            name="name"
            required
            placeholder="Tên học phần"
            className="input col-span-2"
          />
          <input
            name="credits"
            type="number"
            defaultValue={3}
            min={1}
            max={12}
            className="input"
          />
          <input
            name="semester"
            type="number"
            placeholder="HK"
            className="input"
          />
          <select name="type" className="input">
            <option value="">— Loại —</option>
            <option>Đại cương</option>
            <option>Cơ sở ngành</option>
            <option>Chuyên ngành</option>
            <option>Tự chọn</option>
          </select>
          <button type="submit" className="btn-primary col-span-6">
            Lưu học phần
          </button>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Mã HP</th>
              <th className="table-th">Tên học phần</th>
              <th className="table-th">TC</th>
              <th className="table-th">HK</th>
              <th className="table-th">Loại</th>
              <th className="table-th">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {program.courses.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="table-td font-mono font-semibold">{c.code}</td>
                <td className="table-td">
                  <Link
                    href={`/courses/${c.id}`}
                    className="text-brand-700 hover:underline"
                  >
                    {c.name}
                  </Link>
                </td>
                <td className="table-td">{c.credits}</td>
                <td className="table-td">{c.semester || "—"}</td>
                <td className="table-td">{c.type || "—"}</td>
                <td className="table-td">
                  <Link
                    href={`/courses/${c.id}`}
                    className="text-xs text-brand-600 hover:underline mr-2"
                  >
                    Mở
                  </Link>
                  <button
                    onClick={() => del(c.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Xoá
                  </button>
                </td>
              </tr>
            ))}
            {program.courses.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-6 text-slate-500">
                  Chưa có học phần nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
