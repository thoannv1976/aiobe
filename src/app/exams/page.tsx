import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ExamCreator } from "./ExamCreator";

export const dynamic = "force-dynamic";

export default async function ExamsPage({
  searchParams,
}: {
  searchParams: { courseId?: string };
}) {
  const exams = await prisma.exam.findMany({
    where: searchParams.courseId ? { courseId: searchParams.courseId } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      course: { select: { code: true, name: true } },
      _count: { select: { examQuestions: true } },
    },
  });
  const courses = await prisma.course.findMany({
    orderBy: { code: "asc" },
    include: { program: { select: { code: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Đề thi</h1>
          <p className="text-sm text-slate-500">
            Tạo đề thi theo ma trận CLO/Bloom — đáp ứng AUN-QA Criterion 5.
          </p>
        </div>
        <ExamCreator courses={courses as any} />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Mã đề</th>
              <th className="table-th">Tiêu đề</th>
              <th className="table-th">Học phần</th>
              <th className="table-th">Loại</th>
              <th className="table-th">TG (phút)</th>
              <th className="table-th">Câu hỏi</th>
              <th className="table-th">Điểm</th>
              <th className="table-th">Trạng thái</th>
              <th className="table-th">Ngày tạo</th>
            </tr>
          </thead>
          <tbody>
            {exams.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="table-td font-mono">{e.code}</td>
                <td className="table-td">
                  <Link
                    href={`/exams/${e.id}`}
                    className="text-brand-700 hover:underline font-medium"
                  >
                    {e.title}
                  </Link>
                </td>
                <td className="table-td text-xs">
                  {e.course.code} — {e.course.name}
                </td>
                <td className="table-td">{e.type}</td>
                <td className="table-td">{e.duration}</td>
                <td className="table-td">{e._count.examQuestions}</td>
                <td className="table-td">{e.totalPoints}</td>
                <td className="table-td">
                  <span
                    className={`badge ${
                      e.status === "APPROVED"
                        ? "bg-green-100 text-green-700"
                        : e.status === "ARCHIVED"
                          ? "bg-slate-100 text-slate-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {e.status}
                  </span>
                </td>
                <td className="table-td text-xs">
                  {new Date(e.createdAt).toLocaleDateString("vi-VN")}
                </td>
              </tr>
            ))}
            {exams.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-10 text-slate-500">
                  Chưa có đề thi nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
