import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const courses = await prisma.course.findMany({
    orderBy: { code: "asc" },
    include: {
      program: { select: { code: true, name: true } },
      _count: { select: { syllabi: true, questions: true, exams: true, textbooks: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Học phần</h1>
        <p className="text-sm text-slate-500">
          Tổng hợp toàn bộ học phần của các chương trình đào tạo.
        </p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Mã HP</th>
              <th className="table-th">Tên học phần</th>
              <th className="table-th">Chương trình</th>
              <th className="table-th">TC</th>
              <th className="table-th">Đề cương</th>
              <th className="table-th">Giáo trình</th>
              <th className="table-th">Câu hỏi</th>
              <th className="table-th">Đề thi</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="table-td font-mono font-semibold">{c.code}</td>
                <td className="table-td">
                  <Link
                    href={`/courses/${c.id}`}
                    className="text-brand-700 hover:underline font-medium"
                  >
                    {c.name}
                  </Link>
                </td>
                <td className="table-td text-xs text-slate-500">
                  {c.program.code}
                </td>
                <td className="table-td">{c.credits}</td>
                <td className="table-td">{c._count.syllabi}</td>
                <td className="table-td">{c._count.textbooks}</td>
                <td className="table-td">{c._count.questions}</td>
                <td className="table-td">{c._count.exams}</td>
              </tr>
            ))}
            {courses.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-10 text-slate-500">
                  Chưa có học phần. Hãy upload đề án mở ngành hoặc thêm thủ công
                  trong trang chương trình.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
