import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { cloId, ploId, contribution } = await req.json();
  if (!cloId || !ploId) {
    return NextResponse.json({ error: "Thiếu cloId/ploId" }, { status: 400 });
  }
  if (!contribution) {
    await prisma.cLOPLOMap.deleteMany({ where: { cloId, ploId } });
    return NextResponse.json({ ok: true });
  }
  const map = await prisma.cLOPLOMap.upsert({
    where: { cloId_ploId: { cloId, ploId } },
    update: { contribution },
    create: { cloId, ploId, contribution },
  });
  return NextResponse.json(map);
}
