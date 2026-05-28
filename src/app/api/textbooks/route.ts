import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const courseId = req.nextUrl.searchParams.get("courseId");
  const items = await prisma.textbook.findMany({
    where: courseId ? { courseId } : undefined,
    orderBy: { type: "asc" },
    include: { course: { select: { code: true, name: true } } },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const item = await prisma.textbook.create({ data });
  return NextResponse.json(item);
}
