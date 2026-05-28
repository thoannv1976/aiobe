import { prisma } from "@/lib/prisma";
import { QuestionManager } from "./QuestionManager";

export const dynamic = "force-dynamic";

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: { courseId?: string; cloId?: string };
}) {
  const courses = await prisma.course.findMany({
    orderBy: { code: "asc" },
    include: {
      program: { select: { code: true } },
      syllabi: {
        take: 1,
        orderBy: { createdAt: "desc" },
        include: { clos: { orderBy: { code: "asc" } } },
      },
    },
  });
  const questions = await prisma.question.findMany({
    where: {
      courseId: searchParams.courseId,
      cloId: searchParams.cloId,
    },
    orderBy: { createdAt: "desc" },
    include: {
      course: { select: { code: true, name: true } },
      clo: { select: { code: true, description: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Ngân hàng câu hỏi</h1>
        <p className="text-sm text-slate-500">
          Câu hỏi gắn với CLO, phân loại theo mức Bloom và độ khó — phục vụ tạo
          đề thi theo ma trận OBE.
        </p>
      </div>
      <QuestionManager
        courses={courses as any}
        questions={questions as any}
        filter={searchParams}
      />
    </div>
  );
}
