import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { suggestCLOs } from "@/lib/ai-suggester";
import { isAIEnabled } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

// Gợi ý CLO bằng AI cho 1 syllabus.
// Có 2 chế độ:
// - apply=false (mặc định): chỉ trả về suggestions để frontend hiển thị
// - apply=true: tự động tạo CLO + ploMaps vào DB (xoá CLO cũ trước)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isAIEnabled()) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY chưa cấu hình" },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const apply = url.searchParams.get("apply") === "true";

  const syllabus = await prisma.syllabus.findUnique({
    where: { id: params.id },
    include: {
      course: {
        include: {
          program: {
            include: { plos: { orderBy: { code: "asc" } } },
          },
        },
      },
    },
  });
  if (!syllabus) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const plos = syllabus.course.program.plos;
  if (plos.length === 0) {
    return NextResponse.json(
      { error: "Chương trình chưa có PLO. Tạo PLO trước khi gợi ý CLO." },
      { status: 400 },
    );
  }

  let suggestions;
  try {
    suggestions = await suggestCLOs({
      courseCode: syllabus.course.code,
      courseName: syllabus.course.name,
      courseDescription: syllabus.description || syllabus.course.description || undefined,
      courseCredits: syllabus.course.credits,
      programPLOs: plos.map((p) => ({ code: p.code, description: p.description })),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: `AI gợi ý lỗi: ${e.message}` },
      { status: 500 },
    );
  }

  if (apply) {
    // Xoá CLO cũ (kèm ploMaps + questions liên quan)
    await prisma.cLO.deleteMany({ where: { syllabusId: syllabus.id } });

    // Tạo CLO mới
    const ploByCode = new Map(plos.map((p) => [p.code, p.id]));
    for (const clo of suggestions.clos) {
      const created = await prisma.cLO.create({
        data: {
          syllabusId: syllabus.id,
          code: clo.code,
          description: clo.description,
          bloomLevel: clo.bloomLevel,
          category: clo.category,
        },
      });
      // Tạo ploMaps
      for (const m of clo.suggestedPLOMaps) {
        const ploId = ploByCode.get(m.ploCode);
        if (!ploId) continue;
        await prisma.cLOPLOMap.create({
          data: {
            cloId: created.id,
            ploId,
            contribution: m.contribution,
          },
        });
      }
    }
  }

  return NextResponse.json({ ok: true, applied: apply, suggestions });
}
