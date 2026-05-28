import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateQuestions } from "@/lib/ai-suggester";
import { isAIEnabled } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

// AI sinh câu hỏi cho ngân hàng câu hỏi của 1 học phần
// Body: { cloId, type, difficulty, count }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isAIEnabled()) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY chưa cấu hình" },
      { status: 503 },
    );
  }

  const body = await req.json();
  const { cloId, type, difficulty, count } = body;

  if (!cloId || !type || !difficulty || !count) {
    return NextResponse.json(
      { error: "Thiếu cloId, type, difficulty, hoặc count" },
      { status: 400 },
    );
  }

  const course = await prisma.course.findUnique({
    where: { id: params.id },
    select: { id: true, code: true, name: true },
  });
  if (!course) {
    return NextResponse.json({ error: "Không tìm thấy học phần" }, { status: 404 });
  }

  const clo = await prisma.cLO.findUnique({
    where: { id: cloId },
    select: { id: true, code: true, description: true, bloomLevel: true, syllabusId: true },
  });
  if (!clo) {
    return NextResponse.json({ error: "Không tìm thấy CLO" }, { status: 404 });
  }
  // Kiểm tra CLO thuộc syllabus của khóa học này
  const syllabus = await prisma.syllabus.findUnique({
    where: { id: clo.syllabusId },
    select: { courseId: true },
  });
  if (syllabus?.courseId !== course.id) {
    return NextResponse.json(
      { error: "CLO không thuộc học phần này" },
      { status: 400 },
    );
  }

  let result;
  try {
    result = await generateQuestions({
      courseCode: course.code,
      courseName: course.name,
      cloCode: clo.code,
      cloDescription: clo.description,
      bloomLevel: clo.bloomLevel,
      type,
      difficulty,
      count: Math.min(Number(count), 20),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: `AI sinh câu hỏi lỗi: ${e.message}` },
      { status: 500 },
    );
  }

  // Lưu vào ngân hàng câu hỏi
  const createdIds: string[] = [];
  for (const q of result.questions) {
    const saved = await prisma.question.create({
      data: {
        courseId: course.id,
        cloId: clo.id,
        type: q.type,
        difficulty: q.difficulty,
        bloomLevel: q.bloomLevel,
        content: q.content,
        options: q.options ? JSON.stringify(q.options) : null,
        answer: q.answer,
        explanation: q.explanation,
        status: "ACTIVE",
      },
    });
    createdIds.push(saved.id);
  }

  return NextResponse.json({
    ok: true,
    created: createdIds.length,
    questionIds: createdIds,
  });
}
