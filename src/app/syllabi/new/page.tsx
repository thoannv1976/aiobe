import { prisma } from "@/lib/prisma";
import { SyllabusCreateForm } from "./SyllabusCreateForm";

export const dynamic = "force-dynamic";

export default async function NewSyllabusPage({
  searchParams,
}: {
  searchParams: { courseId?: string };
}) {
  const courses = await prisma.course.findMany({
    orderBy: { code: "asc" },
    include: { program: { select: { code: true, name: true } } },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-slate-800">
        Tạo đề cương học phần
      </h1>
      <SyllabusCreateForm
        courses={courses as any}
        defaultCourseId={searchParams.courseId}
      />
    </div>
  );
}
