import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const data = await req.json();
  const clo = await prisma.cLO.create({ data });
  return NextResponse.json(clo);
}
