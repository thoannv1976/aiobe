import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AIOBE — Hệ thống quản lý chương trình đào tạo AUN-QA/OBE",
  description:
    "Trích xuất PLO/PI, xây dựng đề cương học phần, giáo trình, ngân hàng câu hỏi và đề thi theo chuẩn kiểm định AUN-QA, OBE",
};

const nav = [
  { href: "/", label: "Trang chủ" },
  { href: "/programs", label: "Chương trình ĐT" },
  { href: "/courses", label: "Học phần" },
  { href: "/syllabi", label: "Đề cương" },
  { href: "/textbooks", label: "Giáo trình" },
  { href: "/questions", label: "Ngân hàng câu hỏi" },
  { href: "/exams", label: "Đề thi" },
  { href: "/accreditation", label: "Kiểm định" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="bg-brand-900 text-white shadow">
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-9 h-9 rounded bg-white/15 flex items-center justify-center font-bold">
                  AQ
                </div>
                <div>
                  <div className="font-semibold leading-tight">AIOBE</div>
                  <div className="text-xs text-blue-100">
                    AUN-QA · OBE Curriculum Management
                  </div>
                </div>
              </Link>
              <div className="text-sm text-blue-100">
                Đăng nhập: <span className="font-semibold">Admin</span>
              </div>
            </div>
            <nav className="bg-brand-700">
              <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
                {nav.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="px-3 py-2 text-sm text-white/90 hover:bg-white/10 whitespace-nowrap"
                  >
                    {n.label}
                  </Link>
                ))}
              </div>
            </nav>
          </header>
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
            {children}
          </main>
          <footer className="border-t bg-white py-3 text-center text-xs text-slate-500">
            © {new Date().getFullYear()} AIOBE — Outcome-Based Education
            Platform. Đáp ứng tiêu chuẩn AUN-QA, OBE.
          </footer>
        </div>
      </body>
    </html>
  );
}
