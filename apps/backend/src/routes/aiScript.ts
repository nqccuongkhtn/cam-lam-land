// AI VIẾT KỊCH BẢN VIDEO BẢN ĐỒ (dùng tạm — dễ gỡ: xoá file này + 1 dòng ở index.ts).
// TÁI DÙNG đúng khoá Anthropic đã cấu hình cho công cụ Lập danh mục (app_config['danhmuc_ai'] hoặc env ANTHROPIC_API_KEY).
// KHÔNG lộ tên công nghệ ra ngoài. AI CHỈ dùng dữ kiện được cung cấp — KHÔNG bịa pháp lý/quy hoạch/giá/khoảng cách/thời gian.
import { Router } from 'express';
import { query } from '../lib/db.ts';
import { authRequired, type AuthedRequest } from '../middleware/auth.ts';
import { laAdmin } from '../lib/auth.ts';

export const aiScriptRouter = Router();

async function aiCfg(): Promise<{ apiKey: string; model: string; effort: string }> {
  let v: any = {};
  try { const r = await query<{ value: any }>('SELECT value FROM app_config WHERE key=$1', ['danhmuc_ai']); v = r[0]?.value || {}; } catch { /* ignore */ }
  return {
    apiKey: String(v.apiKey || process.env.ANTHROPIC_API_KEY || ''),
    model: String(v.model || process.env.AI_MODEL || 'claude-sonnet-5'),
    effort: String(v.effort || process.env.AI_EFFORT || 'low'),
  };
}

const SYS = `Bạn là biên kịch video bất động sản tiếng Việt. Viết LỜI THOẠI (caption) ngắn cho video giới thiệu dự án trên bản đồ.
QUY TẮC BẮT BUỘC:
- CHỈ dùng dữ kiện được cung cấp (tên, địa chỉ, giá, diện tích, SĐT...). TUYỆT ĐỐI KHÔNG bịa: pháp lý, quy hoạch, mức tăng giá, con số khoảng cách (km), thời gian di chuyển, hay tiện ích không được cung cấp.
- Thiếu dữ liệu thì viết câu chung chung, KHÔNG nêu số liệu cụ thể.
- Mỗi kịch bản 3-4 dòng; mỗi dòng dưới 8 từ; cô đọng, hấp dẫn, có dấu tiếng Việt.
- TRẢ VỀ DUY NHẤT một JSON hợp lệ, không kèm giải thích.`;

// POST /api/ai/video-script  { property, scripts:[{key,name,focus}], duration }
aiScriptRouter.post('/video-script', authRequired, async (req: AuthedRequest, res) => {
  try {
    // ⚠️ 29/9/2026 (rà soát bảo mật): chỉ người CÒN HẠN GÓI VIDEO (hoặc admin) mới được gọi AI trả phí.
    //    Trước đây chỉ chặn ở giao diện (MapVideoPage) → tài khoản miễn phí gọi thẳng API là tốn tiền khoá Claude.
    if (!laAdmin(req.user)) {
      const [u] = await query('SELECT video_expires_at FROM users WHERE id=$1', [req.user!.id]);
      if (!u?.video_expires_at || new Date(u.video_expires_at).getTime() <= Date.now())
        return res.status(403).json({ error: 'Cần gói Video bản đồ còn hạn để dùng AI viết kịch bản.' });
    }
    const { property = {}, scripts = [], duration = 8 } = (req.body || {}) as any;
    const cfg = await aiCfg();
    if (!cfg.apiKey) return res.status(503).json({ error: 'Tính năng AI chưa sẵn sàng (chưa cấu hình).' });
    if (!Array.isArray(scripts) || !scripts.length) return res.status(400).json({ error: 'Thiếu danh sách kịch bản.' });
    const dur = Math.max(3, Math.min(120, Number(duration) || 8));
    const keys = scripts.map((s: any) => s.key).filter(Boolean);
    const content = `Thông tin dự án (CHỈ dùng đúng những gì có ở đây):\n${JSON.stringify(property)}\nThời lượng mỗi video: ${dur}s\nCác kịch bản cần viết (key · trọng tâm):\n${scripts.map((s: any) => `- ${s.key}: ${s.name || ''} — ${s.focus || ''}`).join('\n')}\n\nTrả JSON đúng dạng, cho MỖI key ở trên:\n{"scripts":{"${keys[0] || 'vitri'}":{"title":"tên dự án ngắn","sub":"1 dòng tagline/liên hệ","lines":["dòng 1","dòng 2","dòng 3"]}}}`;

    const body = JSON.stringify({ model: cfg.model, max_tokens: 2000, output_config: { effort: cfg.effort }, system: SYS, messages: [{ role: 'user', content }] });
    let r: any;
    try {
      r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' }, body });
    } catch { return res.status(502).json({ error: 'Dịch vụ tạm gián đoạn, thử lại sau.' }); }
    if (!r.ok) { return res.status(502).json({ error: 'Dịch vụ tạm gián đoạn, thử lại sau.', detail: `UPSTREAM ${r.status}` }); }
    const j: any = await r.json();
    let txt = (j?.content || []).map((c: any) => c?.text || '').join('');
    const m = txt.match(/\{[\s\S]*\}/); if (m) txt = m[0];
    let parsed: any; try { parsed = JSON.parse(txt); } catch { return res.status(502).json({ error: 'AI trả về không hợp lệ, vui lòng thử lại.' }); }

    const out: Record<string, any> = {};
    for (const [key, v] of Object.entries<any>(parsed?.scripts || {})) {
      const lines = Array.isArray(v?.lines) ? v.lines.filter((x: any) => typeof x === 'string' && x.trim()) : [];
      const n = lines.length || 1; const seg = dur / n;
      out[key] = { title: String(v?.title || ''), sub: String(v?.sub || ''), subs: lines.map((t: string, i: number) => ({ s: +(i * seg).toFixed(1), e: +Math.min(dur, (i + 1) * seg).toFixed(1), t: String(t).trim() })) };
    }
    if (!Object.keys(out).length) return res.status(502).json({ error: 'AI chưa tạo được nội dung, thử lại.' });
    res.json({ scripts: out });
  } catch (e: any) { res.status(500).json({ error: 'Lỗi tạo kịch bản: ' + (e?.message || '') }); }
});
