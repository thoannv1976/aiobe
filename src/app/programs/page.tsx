import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProgramsPage() {
  const programs = await prisma.program.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { plos: true, courses: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            Chương trình đào tạo
          </h1>
          <p className="text-sm text-slate-500">
            Quản lý các chương trình đào tạo được trích xuất từ đề án mở ngành.
          </p>
        </div>
        <Link href="/programs/upload" className="btn-primary">
          ⬆️ Upload đề án mở ngành
        </Link>
      </div>

      {programs.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl">📋</div>
          <div className="mt-3 font-semibold text-slate-700">
            Chưa có chương trình đào tạo
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Hãy upload đề án mở ngành (PDF/DOCX) để hệ thống tự động trích xuất
            PLO, PI và danh sách học phần.
          </p>
          <Link
            href="/programs/upload"
            className="btn-primary mt-4 inline-flex"
          >
            Upload ngay
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Mã</th>
                <th className="table-th">Tên chương trình</th>
                <th className="table-th">Ngành</th>
                <th className="table-th">Bậc</th>
                <th className="table-th">Năm</th>
                <th className="table-th">PLO</th>
                <th className="table-th">Học phần</th>
                <th className="table-th">File nguồn</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="table-td font-mono font-semibold">{p.code}</td>
                  <td className="table-td">
                    <Link
                      href={`/programs/${p.id}`}
                      className="text-brand-700 font-medium hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="table-td">{p.major || "—"}</td>
                  <td className="table-td">{p.level}</td>
                  <td className="table-td">{p.year}</td>
                  <td className="table-td">
                    <span className="badge bg-blue-100 text-blue-700">
                      {p._count.plos}
                    </span>
                  </td>
                  <td className="table-td">
                    <span className="badge bg-green-100 text-green-700">
                      {p._count.courses}
                    </span>
                  </td>
                  <td className="table-td text-xs text-slate-500 truncate max-w-xs">
                    {p.sourceFile || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
