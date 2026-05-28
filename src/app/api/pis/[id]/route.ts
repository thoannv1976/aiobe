import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const data = await req.json();
  const pi = await prisma.pI.update({ where: { id: params.id }, data });
  return NextResponse.json(pi);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  await prisma.pI.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
