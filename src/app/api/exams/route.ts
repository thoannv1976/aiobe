import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const courseId = req.nextUrl.searchParams.get("courseId");
  const items = await prisma.exam.findMany({
    where: courseId ? { courseId } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      course: { select: { code: true, name: true } },
      _count: { select: { examQuestions: true } },
    },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const item = await prisma.exam.create({ data });
  return NextResponse.json(item);
}
