import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY chưa được cấu hình. Vào GitHub Secrets thêm ANTHROPIC_API_KEY và redeploy.",
    );
  }
  if (!_client) {
    _client = new Anthropic({ apiKey: key });
  }
  return _client;
}

// Model mặc định — có thể override qua env AI_MODEL
// Khuyến nghị: claude-sonnet-4-6 (chất lượng cao, $3/$15 per Mtok)
// Hoặc claude-haiku-4-5 cho task đơn giản ($1/$5 per Mtok)
export const AI_MODEL = process.env.AI_MODEL || "claude-sonnet-4-6";

export function isAIEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
