import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const courseId = req.nextUrl.searchParams.get("courseId");
  const cloId = req.nextUrl.searchParams.get("cloId");
  const items = await prisma.question.findMany({
    where: {
      courseId: courseId ?? undefined,
      cloId: cloId ?? undefined,
    },
    orderBy: { createdAt: "desc" },
    include: {
      course: { select: { code: true, name: true } },
      clo: { select: { code: true, description: true } },
    },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const item = await prisma.question.create({ data });
  return NextResponse.json(item);
}
