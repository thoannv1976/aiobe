import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractFromText } from "@/lib/extractor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Re-extract PLO/PI/Course từ rawText đã lưu trong DB.
// CẢNH BÁO: sẽ xoá toàn bộ PLO/PI/Course hiện có của chương trình
// (kèm theo các quan hệ — Syllabus/CLO/Câu hỏi/Đề thi của các môn đó cũng mất theo onDelete: Cascade).
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const program = await prisma.program.findUnique({
    where: { id: params.id },
    select: { id: true, rawText: true },
  });
  if (!program) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!program.rawText) {
    return NextResponse.json(
      { error: "Chương trình này chưa có nội dung văn bản gốc để trích xuất lại" },
      { status: 400 },
    );
  }

  const extracted = extractFromText(program.rawText);

  await prisma.$transaction([
    prisma.pLO.deleteMany({ where: { programId: program.id } }),
    prisma.course.deleteMany({ where: { programId: program.id } }),
  ]);

  await prisma.program.update({
    where: { id: program.id },
    data: {
      goals: extracted.programGoals,
      plos: {
        create: extracted.plos.map((plo) => ({
          code: plo.code,
          description: plo.description,
          bloomLevel: plo.bloomLevel,
          category: plo.category,
          pis: {
            create: plo.pis.map((pi) => ({
              code: pi.code,
              description: pi.description,
            })),
          },
        })),
      },
      courses: {
        create: extracted.courses.map((c) => ({
          code: c.code,
          name: c.name,
          credits: c.credits,
          type: c.type,
          semester: c.semester,
        })),
      },
    },
  });

  return NextResponse.json({
    ok: true,
    extracted: {
      ploCount: extracted.plos.length,
      piCount: extracted.plos.reduce((s, p) => s + p.pis.length, 0),
      courseCount: extracted.courses.length,
    },
  });
}
