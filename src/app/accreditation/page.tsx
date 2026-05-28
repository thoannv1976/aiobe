import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AccreditationPage() {
  const programs = await prisma.program.findMany({
    include: {
      plos: { include: { pis: true }, orderBy: { code: "asc" } },
      courses: {
        include: {
          syllabi: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              clos: { include: { ploMaps: true }, orderBy: { code: "asc" } },
            },
          },
          _count: { select: { exams: true, questions: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">
          Kiểm định & Đảm bảo chất lượng
        </h1>
        <p className="text-sm text-slate-500">
          Báo cáo minh chứng phục vụ kiểm định AUN-QA/OBE: ma trận PLO ↔ học phần,
          tính bao phủ CLO, dữ liệu đề thi đã lưu trữ.
        </p>
      </div>

      {programs.map((p) => {
        const totalQuestions = p.courses.reduce(
          (s, c) => s + c._count.questions,
          0,
        );
        const totalExams = p.courses.reduce((s, c) => s + c._count.exams, 0);
        const totalCLOs = p.courses.reduce(
          (s, c) => s + (c.syllabi[0]?.clos.length || 0),
          0,
        );

        return (
          <section key={p.id} className="space-y-3">
            <div className="card p-4 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg">
                  {p.code} — {p.name}
                </h2>
                <div className="text-xs text-slate-500">
                  {p.level} · {p.year}
                </div>
              </div>
              <div className="flex gap-3 text-center">
                <Stat label="PLO" value={p.plos.length} />
                <Stat label="Học phần" value={p.courses.length} />
                <Stat label="CLO" value={totalCLOs} />
                <Stat label="Câu hỏi" value={totalQuestions} />
                <Stat label="Đề thi" value={totalExams} />
              </div>
            </div>

            <div className="card overflow-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-th sticky left-0 bg-slate-50">
                      Học phần \\ PLO
                    </th>
                    {p.plos.map((plo) => (
                      <th
                        key={plo.id}
                        className="table-th text-center"
                        title={plo.description}
                      >
                        {plo.code}
                      </th>
                    ))}
                    <th className="table-th text-center">Đề cương</th>
                    <th className="table-th text-center">Câu hỏi</th>
                    <th className="table-th text-center">Đề thi</th>
                  </tr>
                </thead>
                <tbody>
                  {p.courses.map((c) => {
                    const syllabus = c.syllabi[0];
                    const cloMaps = syllabus?.clos.flatMap((cl) => cl.ploMaps) || [];
                    return (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="table-td sticky left-0 bg-white">
                          <Link
                            href={`/courses/${c.id}`}
                            className="text-brand-700 hover:underline"
                          >
                            <span className="font-mono">{c.code}</span>{" "}
                            <span className="text-slate-600">— {c.name}</span>
                          </Link>
                        </td>
                        {p.plos.map((plo) => {
                          const maps = cloMaps.filter((m) => m.ploId === plo.id);
                          if (maps.length === 0) {
                            return (
                              <td
                                key={plo.id}
                                className="table-td text-center text-slate-300"
                              >
                                —
                              </td>
                            );
                          }
                          const levels = Array.from(
                            new Set(maps.map((m) => m.contribution)),
                          ).join(",");
                          const color = maps.some((m) => m.contribution === "A")
                            ? "bg-green-100 text-green-700"
                            : maps.some((m) => m.contribution === "M")
                              ? "bg-purple-100 text-purple-700"
                              : maps.some((m) => m.contribution === "R")
                                ? "bg-amber-100 text-amber-700"
                                : "bg-blue-100 text-blue-700";
                          return (
                            <td
                              key={plo.id}
                              className={`table-td text-center font-bold ${color}`}
                              title={`${maps.length} CLO mapping`}
                            >
                              {levels}
                            </td>
                          );
                        })}
                        <td className="table-td text-center">
                          {syllabus ? (
                            <span className="badge bg-green-100 text-green-700">
                              ✓ {syllabus.clos.length} CLO
                            </span>
                          ) : (
                            <span className="badge bg-red-100 text-red-700">
                              Thiếu
                            </span>
                          )}
                        </td>
                        <td className="table-td text-center">
                          {c._count.questions}
                        </td>
                        <td className="table-td text-center">
                          {c._count.exams}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="card p-4 text-sm bg-slate-50">
              <div className="font-semibold mb-2">
                Kiểm tra tuân thủ AUN-QA / OBE
              </div>
              <ul className="space-y-1">
                <Check
                  pass={p.plos.length >= 4}
                  text={`Tối thiểu 4 PLO: ${p.plos.length}/4`}
                />
                <Check
                  pass={p.courses.every((c) => c.syllabi.length > 0)}
                  text={`Mọi học phần có đề cương: ${
                    p.courses.filter((c) => c.syllabi.length > 0).length
                  }/${p.courses.length}`}
                />
                <Check
                  pass={p.plos.every((plo) =>
                    p.courses.some((c) =>
                      c.syllabi[0]?.clos.some((cl) =>
                        cl.ploMaps.some((m) => m.ploId === plo.id),
                      ),
                    ),
                  )}
                  text="Mỗi PLO được ít nhất 1 học phần đáp ứng"
                />
                <Check
                  pass={p.plos.every((plo) =>
                    p.courses.some((c) =>
                      c.syllabi[0]?.clos.some((cl) =>
                        cl.ploMaps.some(
                          (m) => m.ploId === plo.id && m.contribution === "A",
                        ),
                      ),
                    ),
                  )}
                  text="Mỗi PLO có ít nhất 1 học phần đánh giá (A — Assess)"
                />
                <Check
                  pass={totalQuestions > 0}
                  text={`Có ngân hàng câu hỏi: ${totalQuestions} câu`}
                />
                <Check
                  pass={totalExams > 0}
                  text={`Có đề thi lưu trữ: ${totalExams} đề`}
                />
              </ul>
            </div>
          </section>
        );
      })}

      {programs.length === 0 && (
        <div className="card p-10 text-center text-slate-500">
          Chưa có chương trình nào để báo cáo. Hãy upload đề án mở ngành trước.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function Check({ pass, text }: { pass: boolean; text: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={pass ? "text-green-600" : "text-red-600"}>
        {pass ? "✓" : "✗"}
      </span>
      <span className={pass ? "" : "text-red-700"}>{text}</span>
    </li>
  );
}
