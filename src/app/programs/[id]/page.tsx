import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProgramDetail } from "./ProgramDetail";

export const dynamic = "force-dynamic";

export default async function ProgramDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const program = await prisma.program.findUnique({
    where: { id: params.id },
    include: {
      plos: { include: { pis: true }, orderBy: { code: "asc" } },
      courses: { orderBy: { code: "asc" } },
    },
  });
  if (!program) notFound();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/programs" className="text-sm text-brand-600 hover:underline">
          ← Danh sách chương trình
        </Link>
        <h1 className="text-xl font-bold text-slate-800 mt-2">
          {program.code} — {program.name}
        </h1>
        <div className="text-sm text-slate-500">
          {program.level} · {program.year} · {program.major || "Chưa rõ ngành"}
        </div>
      </div>

      <ProgramDetail program={program as any} />
    </div>
  );
}
