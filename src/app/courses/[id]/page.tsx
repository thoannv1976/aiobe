import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const course = await prisma.course.findUnique({
    where: { id: params.id },
    include: {
      program: true,
      syllabi: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { clos: true } } },
      },
      textbooks: true,
      _count: { select: { questions: true, exams: true } },
    },
  });
  if (!course) notFound();

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/programs/${course.programId}`}
          className="text-sm text-brand-600 hover:underline"
        >
          ← Chương trình {course.program.code}
        </Link>
        <h1 className="text-xl font-bold text-slate-800 mt-2">
          {course.code} — {course.name}
        </h1>
        <div className="text-sm text-slate-500">
          {course.credits} tín chỉ · {course.type || "—"} · HK{" "}
          {course.semester || "?"}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800">
              📋 Đề cương học phần ({course.syllabi.length})
            </h2>
            <SyllabusCreator courseId={course.id} />
          </div>
          {course.syllabi.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có đề cương nào.</p>
          ) : (
            <ul className="space-y-2">
              {course.syllabi.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between border rounded p-2"
                >
                  <div>
                    <div className="font-medium text-sm">
                      Phiên bản {s.version}{" "}
                      <span
                        className={`badge ml-1 ${
                          s.status === "APPROVED"
                            ? "bg-green-100 text-green-700"
                            : s.status === "REVIEW"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {s._count.clos} CLO
                    </div>
                  </div>
                  <Link
                    href={`/syllabi/${s.id}`}
                    className="text-sm text-brand-600 hover:underline"
                  >
                    Mở →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800">
              📚 Giáo trình ({course.textbooks.length})
            </h2>
            <Link
              href={`/textbooks?courseId=${course.id}`}
              className="btn-secondary text-xs"
            >
              Quản lý →
            </Link>
          </div>
          {course.textbooks.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có giáo trình nào.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {course.textbooks.map((t) => (
                <li key={t.id} className="border rounded p-2">
                  <div className="font-medium">
                    {t.title}{" "}
                    <span
                      className={`badge ml-1 ${
                        t.type === "MAIN"
                          ? "bg-brand-100 text-brand-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {t.type}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {t.author || "Chưa có tác giả"} · {t.year || ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">
              🗂️ Ngân hàng câu hỏi
            </h2>
            <Link
              href={`/questions?courseId=${course.id}`}
              className="btn-secondary text-xs"
            >
              Mở →
            </Link>
          </div>
          <div className="text-3xl font-bold text-slate-700 mt-2">
            {course._count.questions}
          </div>
          <p className="text-xs text-slate-500">câu hỏi đang hoạt động</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">📝 Đề thi</h2>
            <Link
              href={`/exams?courseId=${course.id}`}
              className="btn-secondary text-xs"
            >
              Mở →
            </Link>
          </div>
          <div className="text-3xl font-bold text-slate-700 mt-2">
            {course._count.exams}
          </div>
          <p className="text-xs text-slate-500">đề thi đã tạo</p>
        </div>
      </div>
    </div>
  );
}

function SyllabusCreator({ courseId }: { courseId: string }) {
  return (
    <form
      action={`/syllabi/new?courseId=${courseId}`}
      method="get"
      className="inline"
    >
      <Link
        href={`/syllabi/new?courseId=${courseId}`}
        className="btn-primary text-xs"
      >
        + Đề cương mới
      </Link>
    </form>
  );
}
