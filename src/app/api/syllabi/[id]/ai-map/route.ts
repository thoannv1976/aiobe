import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapCLOtoPLO } from "@/lib/ai-suggester";
import { isAIEnabled } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// AI tự động map CLO ↔ PLO cho syllabus đã có CLO sẵn.
// Mặc định overwrite toàn bộ map cũ.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isAIEnabled()) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY chưa cấu hình" },
      { status: 503 },
    );
  }

  const syllabus = await prisma.syllabus.findUnique({
    where: { id: params.id },
    include: {
      clos: { orderBy: { code: "asc" } },
      course: {
        include: {
          program: { include: { plos: { orderBy: { code: "asc" } } } },
        },
      },
    },
  });
  if (!syllabus) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (syllabus.clos.length === 0) {
    return NextResponse.json(
      { error: "Syllabus chưa có CLO — không có gì để map" },
      { status: 400 },
    );
  }
  const plos = syllabus.course.program.plos;
  if (plos.length === 0) {
    return NextResponse.json(
      { error: "Chương trình chưa có PLO" },
      { status: 400 },
    );
  }

  let result;
  try {
    result = await mapCLOtoPLO({
      courseCode: syllabus.course.code,
      courseName: syllabus.course.name,
      clos: syllabus.clos.map((c) => ({
        code: c.code,
        description: c.description,
        bloomLevel: c.bloomLevel,
      })),
      plos: plos.map((p) => ({ code: p.code, description: p.description })),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: `AI map lỗi: ${e.message}` },
      { status: 500 },
    );
  }

  // Xoá ploMaps cũ + tạo mới
  const cloByCode = new Map(syllabus.clos.map((c) => [c.code, c.id]));
  const ploByCode = new Map(plos.map((p) => [p.code, p.id]));

  await prisma.cLOPLOMap.deleteMany({
    where: { cloId: { in: syllabus.clos.map((c) => c.id) } },
  });

  let created = 0;
  for (const m of result.mappings) {
    const cloId = cloByCode.get(m.cloCode);
    const ploId = ploByCode.get(m.ploCode);
    if (!cloId || !ploId) continue;
    try {
      await prisma.cLOPLOMap.create({
        data: { cloId, ploId, contribution: m.contribution },
      });
      created++;
    } catch {
      // unique constraint — bỏ qua
    }
  }

  return NextResponse.json({
    ok: true,
    created,
    mappings: result.mappings,
  });
}
