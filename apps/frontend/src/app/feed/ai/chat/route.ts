import { NextResponse } from 'next/server';
import { aiEnabled } from '@/lib/claude';

export const dynamic = 'force-dynamic';

const AI_KEY = process.env.ANTHROPIC_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'claude-haiku-4-5-20251001';
const SYSTEM = `Bạn là trợ lý tư vấn của "Cam Lâm Land" — sàn bất động sản & bản đồ quy hoạch tại huyện Cam Lâm, Khánh Hòa. Trả lời NGẮN GỌN, thân thiện, bằng tiếng Việt. Hỗ trợ: mua bán nhà đất, giá khu vực, quy hoạch, pháp lý, thủ tục, tiềm năng đầu tư Cam Lâm (gần sân bay Cam Ranh, biển Bãi Dài, hạ tầng phát triển). Gợi ý khách xem mục Nhà đất, Bản đồ quy hoạch, hoặc Đăng tin trên web khi phù hợp; hotline 0988 888 888. TUYỆT ĐỐI không bịa số liệu/giá cụ thể — nếu không chắc, khuyên khách liên hệ admin. Không đưa cam kết pháp lý hay lời khuyên đầu tư chắc thắng.`;

export async function POST(req: Request) {
  if (!aiEnabled()) return NextResponse.json({ error: 'Trợ lý AI chưa được bật (thiếu API key).' }, { status: 503 });
  let b: any = {};
  try { b = await req.json(); } catch {}
  const msgs = Array.isArray(b.messages)
    ? b.messages.slice(-12).filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim()).map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 2000) }))
    : [];
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return NextResponse.json({ error: 'Thiếu nội dung câu hỏi.' }, { status: 400 });
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': AI_KEY as string, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 500, system: SYSTEM, messages: msgs }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return NextResponse.json({ error: 'Trợ lý đang bận, thử lại sau.' }, { status: 502 });
    const j: any = await res.json();
    return NextResponse.json({ reply: j?.content?.[0]?.text?.trim() || 'Xin lỗi, mình chưa trả lời được.' });
  } catch { return NextResponse.json({ error: 'Lỗi kết nối trợ lý.' }, { status: 502 }); }
}
