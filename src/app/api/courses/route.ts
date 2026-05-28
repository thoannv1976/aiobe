import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const programId = req.nextUrl.searchParams.get("programId");
  const courses = await prisma.course.findMany({
    where: programId ? { programId } : undefined,
    orderBy: { code: "asc" },
    include: {
      program: { select: { code: true, name: true } },
      _count: { select: { syllabi: true, questions: true, exams: true } },
    },
  });
  return NextResponse.json(courses);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const course = await prisma.course.create({ data });
  return NextResponse.json(course);
}
