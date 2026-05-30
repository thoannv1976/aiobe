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
// Khuyến nghị mặc định: claude-opus-4-7 (mạnh nhất, $5/$25 per Mtok)
// Lựa chọn khác:
// - claude-sonnet-4-6: rẻ hơn 1.7x, đủ tốt cho hầu hết task ($3/$15)
// - claude-haiku-4-5: rẻ nhất ($1/$5), phù hợp task đơn giản
export const AI_MODEL = process.env.AI_MODEL || "claude-opus-4-7";

export function isAIEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
