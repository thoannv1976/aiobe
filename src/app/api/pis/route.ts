import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const data = await req.json();
  const pi = await prisma.pI.create({ data });
  return NextResponse.json(pi);
}
