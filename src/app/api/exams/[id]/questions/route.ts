import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { questionId, points } = await req.json();
  const count = await prisma.examQuestion.count({ where: { examId: params.id } });
  const eq = await prisma.examQuestion.create({
    data: {
      examId: params.id,
      questionId,
      points: points ?? 1,
      order: count + 1,
    },
  });
  return NextResponse.json(eq);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { questionId } = await req.json();
  await prisma.examQuestion.deleteMany({
    where: { examId: params.id, questionId },
  });
  return NextResponse.json({ ok: true });
}
