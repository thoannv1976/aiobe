import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const courseId = req.nextUrl.searchParams.get("courseId");
  const syllabi = await prisma.syllabus.findMany({
    where: courseId ? { courseId } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      course: {
        select: {
          code: true,
          name: true,
          program: { select: { code: true, name: true } },
        },
      },
      _count: { select: { clos: true } },
    },
  });
  return NextResponse.json(syllabi);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const syllabus = await prisma.syllabus.create({ data });
  return NextResponse.json(syllabus);
}
