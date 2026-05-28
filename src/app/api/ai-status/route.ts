import { NextResponse } from "next/server";
import { isAIEnabled, AI_MODEL } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    enabled: isAIEnabled(),
    model: isAIEnabled() ? AI_MODEL : null,
  });
}
