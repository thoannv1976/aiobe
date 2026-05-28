import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    include: {
      course: {
        include: {
          program: true,
          syllabi: {
            include: { clos: { include: { ploMaps: true } } },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
      examQuestions: {
        orderBy: { order: "asc" },
        include: { question: { include: { clo: true } } },
      },
    },
  });
  if (!exam) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(exam);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const data = await req.json();
  const exam = await prisma.exam.update({ where: { id: params.id }, data });
  return NextResponse.json(exam);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  await prisma.exam.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
