import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const program = await prisma.program.findUnique({
    where: { id: params.id },
    include: {
      plos: { include: { pis: true }, orderBy: { code: "asc" } },
      courses: { orderBy: { code: "asc" } },
    },
  });
  if (!program)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(program);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const data = await req.json();
  const program = await prisma.program.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(program);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  await prisma.program.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
