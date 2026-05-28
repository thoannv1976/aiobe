import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractFromFile, extractFromText } from "@/lib/extractor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const form = await req.formData();
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

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await extractFromFile(buffer, file.type, file.name);
  const extracted = extractFromText(text);

  const program = await prisma.program.create({
    data: {
      code,
      name,
      level,
      major,
      year,
      sourceFile: file.name,
      rawText: text.slice(0, 100000),
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
}
