import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SyllabusEditor } from "./SyllabusEditor";

export const dynamic = "force-dynamic";

export default async function SyllabusDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const syllabus = await prisma.syllabus.findUnique({
    where: { id: params.id },
    include: {
      course: {
        include: {
          program: {
            include: {
              plos: {
                include: { pis: true },
                orderBy: { code: "asc" },
              },
            },
          },
        },
      },
      clos: {
        orderBy: { code: "asc" },
        include: { ploMaps: true },
      },
    },
  });
  if (!syllabus) notFound();

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/courses/${syllabus.courseId}`}
          className="text-sm text-brand-600 hover:underline"
        >
          ← {syllabus.course.code} — {syllabus.course.name}
        </Link>
        <h1 className="text-xl font-bold text-slate-800 mt-2">
          Đề cương học phần — phiên bản {syllabus.version}
        </h1>
      </div>
      <SyllabusEditor syllabus={syllabus as any} />
    </div>
  );
}
