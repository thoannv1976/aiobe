import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface MatrixCell {
  cloId: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  count: number;
  points: number;
}

// Sinh đề thi tự động từ ma trận: chọn ngẫu nhiên câu hỏi theo CLO + độ khó
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { matrix } = (await req.json()) as { matrix: MatrixCell[] };

  if (!Array.isArray(matrix) || matrix.length === 0) {
    return NextResponse.json(
      { error: "Ma trận đề thi rỗng" },
      { status: 400 },
    );
  }

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    include: { course: true },
  });
  if (!exam) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.examQuestion.deleteMany({ where: { examId: exam.id } });

  let order = 1;
  const picked: { questionId: string; points: number; order: number }[] = [];
  const missing: { cloId: string; difficulty: string; need: number; got: number }[] =
    [];

  for (const cell of matrix) {
    const pool = await prisma.question.findMany({
      where: {
        courseId: exam.courseId,
        cloId: cell.cloId,
        difficulty: cell.difficulty,
        status: "ACTIVE",
      },
    });
    // shuffle
    pool.sort(() => Math.random() - 0.5);
    const selected = pool.slice(0, cell.count);
    if (selected.length < cell.count) {
      missing.push({
        cloId: cell.cloId,
        difficulty: cell.difficulty,
        need: cell.count,
        got: selected.length,
      });
    }
    for (const q of selected) {
      picked.push({ questionId: q.id, points: cell.points, order: order++ });
    }
  }

  if (picked.length > 0) {
    await prisma.examQuestion.createMany({
      data: picked.map((p) => ({
        examId: exam.id,
        questionId: p.questionId,
        points: p.points,
        order: p.order,
      })),
    });
  }

  const totalPoints = picked.reduce((s, p) => s + p.points, 0);
  await prisma.exam.update({
    where: { id: exam.id },
    data: { matrix: JSON.stringify(matrix), totalPoints },
  });

  return NextResponse.json({
    ok: true,
    picked: picked.length,
    totalPoints,
    missing,
  });
}
