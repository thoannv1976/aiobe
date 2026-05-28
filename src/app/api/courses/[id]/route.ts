import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const course = await prisma.course.findUnique({
    where: { id: params.id },
    include: {
      program: { include: { plos: { include: { pis: true } } } },
      syllabi: {
        include: {
          clos: { include: { ploMaps: { include: { plo: true } } } },
        },
        orderBy: { createdAt: "desc" },
      },
      textbooks: true,
      _count: { select: { questions: true, exams: true } },
    },
  });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(course);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const data = await req.json();
  const course = await prisma.course.update({ where: { id: params.id }, data });
  return NextResponse.json(course);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  await prisma.course.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
