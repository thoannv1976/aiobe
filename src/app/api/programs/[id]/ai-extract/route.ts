import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractWithAI } from "@/lib/ai-extractor";
import { isAIEnabled } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Trích xuất lại bằng Claude — chính xác hơn rule-based, tốn API cost.
// Sẽ xoá toàn bộ PLO/Course hiện có rồi tạo mới.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isAIEnabled()) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY chưa cấu hình trên server" },
      { status: 503 },
    );
  }

  const program = await prisma.program.findUnique({
    where: { id: params.id },
    select: { id: true, rawText: true },
  });
  if (!program) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!program.rawText) {
    return NextResponse.json(
      { error: "Chương trình chưa có rawText để trích xuất" },
      { status: 400 },
    );
  }

  let extracted;
  try {
    extracted = await extractWithAI(program.rawText);
  } catch (e: any) {
    return NextResponse.json(
      { error: `AI trích xuất lỗi: ${e.message}` },
      { status: 500 },
    );
  }

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
          semester: c.semester,
          type: c.type,
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
