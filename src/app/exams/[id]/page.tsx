import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ExamEditor } from "./ExamEditor";

export const dynamic = "force-dynamic";

export default async function ExamDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    include: {
      course: {
        include: {
          program: true,
          syllabi: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { clos: { orderBy: { code: "asc" } } },
          },
        },
      },
      examQuestions: {
        orderBy: { order: "asc" },
        include: { question: { include: { clo: true } } },
      },
    },
  });
  if (!exam) notFound();

  const allQuestions = await prisma.question.findMany({
    where: { courseId: exam.courseId, status: "ACTIVE" },
    include: { clo: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div>
        <Link href="/exams" className="text-sm text-brand-600 hover:underline">
          ← Danh sách đề thi
        </Link>
        <h1 className="text-xl font-bold text-slate-800 mt-2">
          {exam.code} — {exam.title}
        </h1>
        <div className="text-sm text-slate-500">
          {exam.course.code} {exam.course.name} · {exam.type} · {exam.duration}{" "}
          phút
        </div>
      </div>

      <ExamEditor
        exam={exam as any}
        allQuestions={allQuestions as any}
      />
    </div>
  );
}
