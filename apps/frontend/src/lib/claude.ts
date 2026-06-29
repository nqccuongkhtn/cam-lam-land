// Gọi Claude (server-side). Cần ANTHROPIC_API_KEY trong env. Dùng bởi các route handler /feed/ai/*.
const AI_KEY = process.env.ANTHROPIC_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'claude-haiku-4-5-20251001';

export const aiEnabled = (): boolean => !!AI_KEY;

export async function callClaude(prompt: string, maxTokens = 512, system?: string): Promise<string | null> {
  if (!AI_KEY) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: maxTokens, ...(system ? { system } : {}), messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    return j?.content?.[0]?.text?.trim() || null;
  } catch { return null; }
}
