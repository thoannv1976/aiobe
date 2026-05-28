import { prisma } from "@/lib/prisma";
import { TextbookManager } from "./TextbookManager";

export const dynamic = "force-dynamic";

export default async function TextbooksPage({
  searchParams,
}: {
  searchParams: { courseId?: string };
}) {
  const courses = await prisma.course.findMany({
    orderBy: { code: "asc" },
    include: { program: { select: { code: true } } },
  });
  const textbooks = await prisma.textbook.findMany({
    where: searchParams.courseId ? { courseId: searchParams.courseId } : undefined,
    orderBy: [{ courseId: "asc" }, { type: "asc" }],
    include: { course: { select: { code: true, name: true } } },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Giáo trình</h1>
        <p className="text-sm text-slate-500">
          Quản lý giáo trình chính, tài liệu tham khảo, tài liệu trực tuyến cho
          mỗi học phần.
        </p>
      </div>
      <TextbookManager
        courses={courses as any}
        textbooks={textbooks as any}
        filterCourseId={searchParams.courseId}
      />
    </div>
  );
}
