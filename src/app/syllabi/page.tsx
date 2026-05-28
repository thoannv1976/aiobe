import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SyllabiPage() {
  const syllabi = await prisma.syllabus.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      course: {
        select: {
          code: true,
          name: true,
          program: { select: { code: true } },
        },
      },
      _count: { select: { clos: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            Đề cương học phần
          </h1>
          <p className="text-sm text-slate-500">
            Quản lý đề cương học phần theo chuẩn OBE/AUN-QA.
          </p>
        </div>
        <Link href="/syllabi/new" className="btn-primary">
          + Tạo đề cương mới
        </Link>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Học phần</th>
              <th className="table-th">Chương trình</th>
              <th className="table-th">Phiên bản</th>
              <th className="table-th">CLO</th>
              <th className="table-th">Trạng thái</th>
              <th className="table-th">Cập nhật</th>
            </tr>
          </thead>
          <tbody>
            {syllabi.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="table-td">
                  <Link
                    href={`/syllabi/${s.id}`}
                    className="text-brand-700 hover:underline font-medium"
                  >
                    {s.course.code} — {s.course.name}
                  </Link>
                </td>
                <td className="table-td text-xs">{s.course.program.code}</td>
                <td className="table-td">{s.version}</td>
                <td className="table-td">{s._count.clos}</td>
                <td className="table-td">
                  <span
                    className={`badge ${
                      s.status === "APPROVED"
                        ? "bg-green-100 text-green-700"
                        : s.status === "REVIEW"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
                <td className="table-td text-xs text-slate-500">
                  {new Date(s.updatedAt).toLocaleDateString("vi-VN")}
                </td>
              </tr>
            ))}
            {syllabi.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-slate-500">
                  Chưa có đề cương nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
