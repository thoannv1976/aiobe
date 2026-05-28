import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const syllabus = await prisma.syllabus.findUnique({
    where: { id: params.id },
    include: {
      course: {
        include: {
          program: {
            include: { plos: { include: { pis: true }, orderBy: { code: "asc" } } },
          },
        },
      },
      clos: {
        orderBy: { code: "asc" },
        include: { ploMaps: { include: { plo: true } } },
      },
    },
  });
  if (!syllabus)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(syllabus);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const data = await req.json();
  const syllabus = await prisma.syllabus.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(syllabus);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  await prisma.syllabus.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
