import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleanRawText } from "@/lib/text-cleaner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Debug endpoint: trả về rawText đã lưu của 1 program (giới hạn 50KB output)
// Hỗ trợ ?cleaned=true để xem text đã strip TOC.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const program = await prisma.program.findUnique({
    where: { id: params.id },
    select: { code: true, name: true, rawText: true, sourceFile: true },
  });
  if (!program) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const cleaned = req.nextUrl.searchParams.get("cleaned") === "true";
  const limit = Number(req.nextUrl.searchParams.get("limit") || 50000);

  const fullText = program.rawText || "";
  const processed = cleaned ? cleanRawText(fullText) : fullText;

  return NextResponse.json({
    code: program.code,
    name: program.name,
    sourceFile: program.sourceFile,
    originalLength: fullText.length,
    processedLength: processed.length,
    cleaned,
    text: processed.slice(0, limit),
    truncated: processed.length > limit,
  });
}
