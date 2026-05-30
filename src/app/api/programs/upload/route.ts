import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractFromFile, extractFromText } from "@/lib/extractor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Lưu ý: tên file có thể đến từ user — tránh log đầy stack trace ra response
function safeMsg(e: unknown, prefix: string): string {
  const m = e instanceof Error ? e.message : String(e);
  return `${prefix}: ${m.slice(0, 500)}`;
}

export async function POST(req: NextRequest) {
  // 1. Parse form
  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    return NextResponse.json(
      { error: safeMsg(e, "Không đọc được form") },
      { status: 400 },
    );
  }

  const file = form.get("file") as File | null;
  const code = (form.get("code") as string) || "";
  const name = (form.get("name") as string) || "";
  const level = (form.get("level") as string) || "Cử nhân";
  const year =
    parseInt((form.get("year") as string) || "0", 10) ||
    new Date().getFullYear();
  const major = (form.get("major") as string) || "";

  if (!file) {
    return NextResponse.json({ error: "Thiếu file đề án" }, { status: 400 });
  }
  if (!code || !name) {
    return NextResponse.json(
      { error: "Thiếu mã hoặc tên chương trình" },
      { status: 400 },
    );
  }
  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File quá lớn (>50MB)" },
      { status: 413 },
    );
  }

  // 2. Đọc file vào buffer
  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch (e) {
    return NextResponse.json(
      { error: safeMsg(e, "Không đọc được nội dung file") },
      { status: 400 },
    );
  }

  // 3. Trích xuất text từ PDF/DOCX
  let text = "";
  try {
    text = await extractFromFile(buffer, file.type, file.name);
  } catch (e) {
    return NextResponse.json(
      {
        error: safeMsg(
          e,
          "Không parse được file. PDF có thể bị mã hoá, hỏng hoặc dùng font đặc biệt",
        ),
      },
      { status: 422 },
    );
  }
  if (!text || text.trim().length < 50) {
    return NextResponse.json(
      {
        error:
          "Parse file thành công nhưng không lấy được nội dung text (file có thể chỉ là ảnh scan — cần OCR). Hãy thử file DOCX gốc hoặc PDF có text.",
      },
      { status: 422 },
    );
  }

  // 4. Rule-based extraction (không throw nhưng safe)
  let extracted;
  try {
    extracted = extractFromText(text);
  } catch (e) {
    return NextResponse.json(
      { error: safeMsg(e, "Lỗi khi phân tích nội dung") },
      { status: 500 },
    );
  }

  // 5. Lưu vào DB
  try {
    const program = await prisma.program.create({
      data: {
        code,
        name,
        level,
        major,
        year,
        sourceFile: file.name,
        rawText: text.slice(0, 200000),
        goals: extracted.programGoals,
        plos: {
          create: extracted.plos.map((plo) => ({
            code: plo.code,
            description: plo.description,
            bloomLevel: plo.bloomLevel,
            category: plo.category,
            pis: {
              create: plo.pis.map((pi) => ({
                code: pi.code,
                description: pi.description,
              })),
            },
          })),
        },
        courses: {
          create: extracted.courses.map((c) => ({
            code: c.code,
            name: c.name,
            credits: c.credits,
            type: c.type,
            semester: c.semester,
          })),
        },
      },
      include: {
        plos: { include: { pis: true } },
        courses: true,
      },
    });

    return NextResponse.json({
      program,
      extracted: {
        ploCount: extracted.plos.length,
        piCount: extracted.plos.reduce((s, p) => s + p.pis.length, 0),
        courseCount: extracted.courses.length,
      },
    });
  } catch (e: any) {
    // Prisma unique violation hay gặp do trùng mã chương trình
    if (e?.code === "P2002") {
      return NextResponse.json(
        {
          error: `Mã chương trình "${code}" đã tồn tại. Hãy đổi mã khác hoặc xoá chương trình cũ.`,
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: safeMsg(e, "Lỗi DB khi lưu chương trình") },
      { status: 500 },
    );
  }
}
