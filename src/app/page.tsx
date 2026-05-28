import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [programCount, courseCount, syllabusCount, questionCount, examCount] =
    await Promise.all([
      prisma.program.count(),
      prisma.course.count(),
      prisma.syllabus.count(),
      prisma.question.count(),
      prisma.exam.count(),
    ]);

  const recentPrograms = await prisma.program.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { _count: { select: { plos: true, courses: true } } },
  });

  const features = [
    {
      href: "/programs/upload",
      title: "1. Upload đề án mở ngành",
      desc: "Tải lên file PDF/DOCX đề án mở chương trình đào tạo. Hệ thống tự động trích xuất PLO, PI và danh mục học phần.",
      icon: "📤",
    },
    {
      href: "/programs",
      title: "2. Quản lý chuẩn đầu ra",
      desc: "Xem, hiệu chỉnh và quản lý PLO (Program Learning Outcomes), PI (Performance Indicators) theo chuẩn AUN-QA.",
      icon: "🎯",
    },
    {
      href: "/syllabi",
      title: "3. Xây dựng đề cương học phần",
      desc: "Thiết kế đề cương gắn với CLO ↔ PLO, đáp ứng yêu cầu OBE và AUN-QA Criterion 2 & 3.",
      icon: "📋",
    },
    {
      href: "/textbooks",
      title: "4. Quản lý giáo trình",
      desc: "Quản lý giáo trình chính, tài liệu tham khảo cho từng học phần.",
      icon: "📚",
    },
    {
      href: "/questions",
      title: "5. Ngân hàng câu hỏi",
      desc: "Tạo câu hỏi theo CLO, mức Bloom, độ khó. Xây dựng ma trận đề thi.",
      icon: "🗂️",
    },
    {
      href: "/exams",
      title: "6. Tạo đề thi",
      desc: "Tạo đề thi tự động/thủ công từ ma trận, đảm bảo bám sát CLO và đạt chuẩn kiểm định.",
      icon: "📝",
    },
    {
      href: "/accreditation",
      title: "7. Lưu trữ & Kiểm định",
      desc: "Báo cáo ma trận CLO/PLO, lưu trữ minh chứng phục vụ AUN-QA, đảm bảo chất lượng.",
      icon: "🏆",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="card p-6 bg-gradient-to-r from-brand-700 to-brand-900 text-white">
        <h1 className="text-2xl font-bold">
          Hệ thống Quản lý Chương trình Đào tạo theo OBE/AUN-QA
        </h1>
        <p className="mt-2 text-blue-100 max-w-3xl">
          Giải pháp toàn diện: từ trích xuất đề án mở ngành → xây dựng đề cương,
          giáo trình → ngân hàng câu hỏi → đề thi → lưu trữ minh chứng kiểm
          định.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href="/programs/upload"
            className="btn bg-white text-brand-700 hover:bg-blue-50"
          >
            ⬆️ Bắt đầu — Upload đề án
          </Link>
          <Link
            href="/programs"
            className="btn bg-white/10 text-white border border-white/30 hover:bg-white/20"
          >
            Xem chương trình đào tạo
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Chương trình" value={programCount} />
        <Stat label="Học phần" value={courseCount} />
        <Stat label="Đề cương" value={syllabusCount} />
        <Stat label="Câu hỏi" value={questionCount} />
        <Stat label="Đề thi" value={examCount} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-slate-800">
          Luồng nghiệp vụ
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {features.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className="card p-4 hover:shadow-md transition"
            >
              <div className="text-2xl">{f.icon}</div>
              <div className="font-semibold mt-2 text-slate-800">{f.title}</div>
              <p className="text-sm text-slate-600 mt-1">{f.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-slate-800">
          Chương trình đào tạo mới nhất
        </h2>
        <div className="card overflow-hidden">
          {recentPrograms.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              Chưa có chương trình nào. Hãy{" "}
              <Link
                href="/programs/upload"
                className="text-brand-600 underline"
              >
                upload đề án mở ngành
              </Link>{" "}
              để bắt đầu.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Mã CT</th>
                  <th className="table-th">Tên chương trình</th>
                  <th className="table-th">Bậc</th>
                  <th className="table-th">Năm</th>
                  <th className="table-th">PLO</th>
                  <th className="table-th">Học phần</th>
                </tr>
              </thead>
              <tbody>
                {recentPrograms.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="table-td font-mono">{p.code}</td>
                    <td className="table-td font-medium">
                      <Link
                        href={`/programs/${p.id}`}
                        className="text-brand-700 hover:underline"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="table-td">{p.level}</td>
                    <td className="table-td">{p.year}</td>
                    <td className="table-td">{p._count.plos}</td>
                    <td className="table-td">{p._count.courses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-slate-500 uppercase tracking-wider">
        {label}
      </div>
      <div className="text-2xl font-bold text-slate-800 mt-1">{value}</div>
    </div>
  );
}
