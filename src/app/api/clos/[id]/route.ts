import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const data = await req.json();
  const clo = await prisma.cLO.update({ where: { id: params.id }, data });
  return NextResponse.json(clo);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  await prisma.cLO.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
