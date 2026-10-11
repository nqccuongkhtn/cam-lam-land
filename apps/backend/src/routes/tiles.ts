// PROXY TILE ẢNH VỆ TINH (cho công cụ Tạo video bản đồ) — CÙNG NGUỒN GỐC để vừa nét vừa "sạch CORS" (quay canvas được).
// Ưu tiên GOOGLE (nét, phủ tốt VN); nếu server không lấy được thì lùi về ESRI. KHÔNG lưu gì (chỉ chuyển tiếp + cache biên).
import { Router } from 'express';

export const tilesRouter = Router();

async function grab(url: string): Promise<Response | null> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.google.com/maps' }, signal: AbortSignal.timeout(15000) });
    return r.ok ? r : null;
  } catch { return null; }
}

// GET /api/tiles/:z/:x/:y?l=sat|ref
tilesRouter.get('/:z/:x/:y', async (req, res) => {
  const { z, x } = req.params;
  const y = (req.params.y || '').replace(/\.(png|jpg|jpeg)$/i, '');
  if (![z, x, y].every((v) => /^\d+$/.test(v))) return res.status(400).end();
  // Số ô phải nằm trong lưới thật của mức phóng đó — số bậy thì trả lỗi ngay, khỏi hỏi Google rồi ESRI vô ích.
  if (Number(z) > 22 || Number(x) >= 2 ** Number(z) || Number(y) >= 2 ** Number(z)) return res.status(400).end();
  const ref = String(req.query.l) === 'ref';
  const sub = (Number(x) + Number(y)) % 4;
  const google = `https://mt${sub}.google.com/vt/lyrs=${ref ? 'h' : 's'}&x=${x}&y=${y}&z=${z}`;
  const esri = ref
    ? `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/${z}/${y}/${x}`
    : `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  const r = (await grab(google)) || (await grab(esri));
  if (!r) return res.status(502).end();
  try {
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(buf);
  } catch { res.status(504).end(); }
});
