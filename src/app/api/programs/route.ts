import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const programs = await prisma.program.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { plos: true, courses: true } } },
  });
  return NextResponse.json(programs);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const program = await prisma.program.create({ data });
  return NextResponse.json(program);
}
