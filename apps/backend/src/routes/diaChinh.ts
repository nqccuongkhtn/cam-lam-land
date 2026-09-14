// ═══════════════════════════════════════════════════════════════════════════════
// BẢN ĐỒ ĐỊA CHÍNH TOÀN TỈNH — phục vụ theo Ô VUÔNG NHỎ (vector tile) + CHỐNG CÀO
// ═══════════════════════════════════════════════════════════════════════════════
// Vì sao không trả GeoJSON như trước:
//  1) Có hơn 700 nghìn thửa. Gửi cả cục theo khung nhìn thì máy người dùng nghẹt,
//     mà kẻ cào chỉ cần chạy vòng lặp vài chục lần là ôm trọn dữ liệu.
//  2) Ô vuông nhỏ (tile) là dữ liệu ĐÃ CẮT theo lưới, nén nhị phân, mỗi ô chỉ vài chục KB.
//     Muốn ghép lại thành dữ liệu gốc phải tải hàng chục nghìn ô — bị chặn từ lâu trước đó.
//
// Ba lớp khoá:
//  A. VÉ XEM BẢN ĐỒ — mỗi phiên xem phải xin một "vé" ngắn hạn, vé gắn với địa chỉ máy,
//     hết hạn sau ít phút. Không có vé thì không lấy được ô nào (chặn công cụ tải tự động).
//  B. HẠN MỨC — số ô mỗi 5 phút / mỗi ngày. Người xem thật không bao giờ chạm tới.
//  C. ĐO ĐỘ PHỦ — kẻ cào phải quét ô đều khắp bản đồ. Đếm số ô KHÁC NHAU trong 1 giờ,
//     vượt ngưỡng là khoá máy đó lại, vì người xem thật quanh quẩn một vùng nhỏ.
//
// Ngoài ra ô tile CHỈ chứa hình thửa + số tờ + số thửa. Diện tích, loại đất, quy hoạch
// phải bấm từng thửa mới có (đường /api/parcels/at, cũng có hạn mức riêng) — nên dù có
// gom được hình thửa cũng không lấy được phần dữ liệu giá trị nhất.

import { Router } from 'express';
import crypto from 'node:crypto';
import { query } from '../lib/db.ts';
import { env } from '../lib/env.ts';
import { cached, cachePut } from '../lib/cache.ts';
import { verifyToken, coVaiTro } from '../lib/auth.ts';

import { CHAN_TRA_CUU } from './parcels.ts';
export const diaChinhRouter = Router();

// ── Cấu hình (đổi được trong .env, không cần sửa code) ───────────────────────
const KHOA_VE   = process.env.DC_SECRET || env.jwtSecret;          // khoá ký vé
const VE_PHUT   = Number(process.env.DC_VE_PHUT   || 45);          // vé sống bao nhiêu phút
const MUC_5PHUT = Number(process.env.DC_TILE_5P   || 900);         // số ô tối đa / 5 phút
const MUC_NGAY  = Number(process.env.DC_TILE_NGAY || 8000);        // số ô tối đa / ngày
const MUC_PHU   = Number(process.env.DC_PHU_GIO   || 2500);        // số ô KHÁC NHAU tối đa / giờ
const KHOA_GIO  = Number(process.env.DC_KHOA_GIO  || 6);           // khoá bao nhiêu giờ khi phát hiện cào
const Z_TILE    = 16;                                              // chỉ phục vụ đúng mức phóng 16
const CHO_PHEP_TAT = process.env.DC_TAT_CHONG_CAO === 'true';      // bật cờ này là tắt hết khoá (chỉ dùng khi thử nghiệm)

// ── Bộ nhớ đếm (chỉ trong tiến trình, không cần Redis) ───────────────────────
type Dem = { n: number; het: number };
const dem5   = new Map<string, Dem>();
const demNgay = new Map<string, Dem>();
const phuSong = new Map<string, { o: Set<string>; het: number }>();
const soDenBi = new Map<string, number>();   // máy đang bị khoá -> khoá tới lúc nào
const MAX_MAY = 5000;                        // theo dõi tối đa bấy nhiêu máy, tránh phình bộ nhớ

function donDep() {
  const nay = Date.now();
  for (const m of [dem5, demNgay]) for (const [k, v] of m) if (v.het < nay) m.delete(k);
  for (const [k, v] of phuSong) if (v.het < nay) phuSong.delete(k);
  for (const [k, v] of soDenBi) if (v < nay) soDenBi.delete(k);
  // vẫn quá nhiều thì bỏ bớt bản ghi cũ nhất
  for (const m of [dem5, demNgay, phuSong] as Map<string, any>[])
    while (m.size > MAX_MAY) { const k = m.keys().next().value; if (k === undefined) break; m.delete(k); }
}
setInterval(donDep, 5 * 60 * 1000).unref?.();

function diaChi(req: any): string {
  // Web chạy qua Cloudflare Tunnel → nginx → backend. Nếu chỉ lấy req.ip thì mọi người đều
  // hiện ra là "máy nginx", hạn mức sẽ tính chung cho cả thiên hạ (một kẻ cào là cả web bị khoá).
  // Cloudflare luôn gắn sẵn CF-Connecting-IP = địa chỉ THẬT của người xem, và người dùng KHÔNG
  // tự đặt được header này (Cloudflare ghi đè) nên tin được. Không có thì lùi về req.ip.
  const cf = String(req.headers['cf-connecting-ip'] || '').trim();
  if (cf) return cf;
  return String(req.ip || req.socket?.remoteAddress || 'khong-ro');
}
function bam(s: string): string {
  return crypto.createHmac('sha256', KHOA_VE).update(s).digest('base64url').slice(0, 22);
}

// ── A. VÉ XEM BẢN ĐỒ ─────────────────────────────────────────────────────────
// Vé = "dấu vân tay của máy" + "hạn dùng" + chữ ký. Không giải mã được, không chế ra được,
// và mang sang máy khác dùng cũng không được vì vân tay máy sẽ lệch.
function taoVe(ip: string): { ve: string; hetHan: number } {
  const hetHan = Date.now() + VE_PHUT * 60 * 1000;
  const than = `${bam(ip)}.${hetHan}`;
  return { ve: `${than}.${bam(than)}`, hetHan };
}
function veHopLe(ve: string, ip: string): boolean {
  if (CHO_PHEP_TAT) return true;
  const p = String(ve || '').split('.');
  if (p.length !== 3) return false;
  const [vanTay, hanStr, chuKy] = p;
  if (bam(`${vanTay}.${hanStr}`) !== chuKy) return false;   // chữ ký sai → vé giả
  if (Number(hanStr) < Date.now()) return false;            // hết hạn
  if (vanTay !== bam(ip)) return false;                     // vé của máy khác
  return true;
}

// GET /api/dc/ve — xin vé xem bản đồ (trang bản đồ tự gọi, người dùng không thấy)
diaChinhRouter.get('/ve', (req, res) => {
  const ip = diaChi(req);
  if (soDenBi.get(ip) && (soDenBi.get(ip) as number) > Date.now())
    return res.status(429).json({ error: 'Máy của bạn tạm thời bị hạn chế xem bản đồ do truy cập bất thường.' });
  const { ve, hetHan } = taoVe(ip);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ve, hetHan, songThem: VE_PHUT * 60 });
});

// ── B + C. Kiểm tra hạn mức & độ phủ trước khi trả ô ─────────────────────────
function chanNeuCao(ip: string, oKey: string): string | null {
  if (CHO_PHEP_TAT) return null;
  const nay = Date.now();

  const den = soDenBi.get(ip);
  if (den && den > nay) return 'Máy của bạn tạm thời bị hạn chế xem bản đồ do truy cập bất thường. Vui lòng thử lại sau.';

  const a = dem5.get(ip);
  if (!a || a.het < nay) dem5.set(ip, { n: 1, het: nay + 5 * 60 * 1000 });
  else if (++a.n > MUC_5PHUT) return 'Bạn đang xem bản đồ quá nhanh. Vui lòng chậm lại một chút.';

  const b = demNgay.get(ip);
  if (!b || b.het < nay) demNgay.set(ip, { n: 1, het: nay + 24 * 60 * 60 * 1000 });
  else if (++b.n > MUC_NGAY) { soDenBi.set(ip, nay + KHOA_GIO * 3600 * 1000); return 'Đã vượt hạn mức xem bản đồ trong ngày.'; }

  let c = phuSong.get(ip);
  if (!c || c.het < nay) { c = { o: new Set(), het: nay + 60 * 60 * 1000 }; phuSong.set(ip, c); }
  if (c.o.size <= MUC_PHU) c.o.add(oKey);
  if (c.o.size > MUC_PHU) { soDenBi.set(ip, nay + KHOA_GIO * 3600 * 1000); return 'Phát hiện truy cập bất thường (quét bản đồ diện rộng). Truy cập đã tạm khoá.'; }

  return null;
}

// ── Kho ô đã dựng sẵn (dùng lại cho mọi người xem, đỡ hỏi database) ──────────
const khoO = new Map<string, Buffer>();
let khoByte = 0;
const KHO_TOI_DA = Number(process.env.DC_KHO_MB || 64) * 1024 * 1024;
function khoLay(k: string) { return khoO.get(k); }
function khoCat(k: string, b: Buffer) {
  khoO.set(k, b); khoByte += b.length;
  while (khoByte > KHO_TOI_DA && khoO.size) {
    const kk = khoO.keys().next().value as string; const vv = khoO.get(kk);
    khoO.delete(kk); khoByte -= vv ? vv.length : 0;
  }
}

// GET /api/dc/:z/:x/:y.mvt?v=<vé> — MỘT ô bản đồ địa chính
diaChinhRouter.get('/:z/:x/:y', async (req, res) => {
  const z = Number(req.params.z), x = Number(req.params.x);
  const y = Number(String(req.params.y || '').replace(/\.(mvt|pbf)$/i, ''));
  if (![z, x, y].every((v) => Number.isInteger(v) && v >= 0)) return res.status(400).end();
  // Chỉ đúng một mức phóng được phục vụ. Mức gần hơn do trình duyệt tự phóng to ô này lên
  // → giảm số ô phải bảo vệ, và không có ô "nhìn cả tỉnh" nào để tải về.
  if (z !== Z_TILE) return res.status(404).end();
  if (x >= 2 ** z || y >= 2 ** z) return res.status(400).end();

  const ip = diaChi(req);
  if (!veHopLe(String(req.query.v || ''), ip))
    return res.status(401).json({ error: 'Phiên xem bản đồ đã hết hạn. Vui lòng tải lại trang.' });

  const key = `${z}/${x}/${y}`;
  const loi = chanNeuCao(ip, key);
  if (loi) return res.status(429).json({ error: loi });

  const sanCo = khoLay(key);
  if (sanCo) {
    res.setHeader('Content-Type', 'application/vnd.mapbox-vector-tile');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return res.status(sanCo.length ? 200 : 204).end(sanCo.length ? sanCo : undefined);
  }

  try {
    // Cắt thửa theo đúng ô rồi nén nhị phân ngay trong database — nhanh hơn làm ở Node rất nhiều.
    const r = await query<{ mvt: Buffer }>(
      `WITH b AS (
         SELECT ST_TileEnvelope($1,$2,$3) AS e3857,
                ST_Transform(ST_TileEnvelope($1,$2,$3), 4326) AS e4326
       )
       SELECT COALESCE(ST_AsMVT(q, 'dc', 4096, 'geom'), ''::bytea) AS mvt
       FROM (
         SELECT * FROM (
           SELECT d.id, d.so_to AS t, d.so_thua AS s,
                  ST_AsMVTGeom(ST_Transform(d.geom, 3857), b.e3857, 4096, 64, true) AS geom
           FROM dia_chinh d, b
           WHERE d.geom && b.e4326
         ) z WHERE z.geom IS NOT NULL
       ) q`,
      [z, x, y],
    );
    const buf: Buffer = (r[0]?.mvt as any) || Buffer.alloc(0);
    khoCat(key, buf);
    res.setHeader('Content-Type', 'application/vnd.mapbox-vector-tile');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return res.status(buf.length ? 200 : 204).end(buf.length ? buf : undefined);
  } catch (e: any) {
    console.error('[dia-chinh] lỗi dựng ô', key, e?.message || e);
    return res.status(500).end();
  }
});

// ── DANH MỤC XÃ/PHƯỜNG — cho ô "Chọn xã" và nút bay tới ─────────────────────
// GET /api/dc/danh-muc  →  { cap2: [...], cap3: [...] }
diaChinhRouter.get('/danh-muc', async (req, res) => {
  // SỐ THỬA CỦA TỪNG XÃ LÀ THÔNG TIN NỘI BỘ — chỉ tài khoản quản trị mới thấy.
  // Người ngoài biết xã nào có bao nhiêu thửa là biết luôn quy mô kho dữ liệu và
  // biết nên nhắm vào đâu để cào. Nên máy chủ KHÔNG GỬI con số đó xuống, chứ không
  // phải chỉ giấu trên giao diện (giấu ở giao diện thì mở trình duyệt ra vẫn xem được).
  const h = String(req.headers.authorization || '');
  const nguoi = h.startsWith('Bearer ') ? verifyToken(h.slice(7)) : null;
  const quanLy = coVaiTro(nguoi as any, 'admin', 'gis');

  const KEY = quanLy ? 'dc:danh-muc:admin' : 'dc:danh-muc';
  const san = cached<any>(KEY);
  if (san) { res.setHeader('Cache-Control', quanLy ? 'private, no-store' : 'public, max-age=600'); return res.json(san); }
  try {
    const r = await query<any>(
      `SELECT x.xa_id, x.ten, x.ten_kd, x.cap, x.huyen, x.so_thua,
              x.minx, x.miny, x.maxx, x.maxy, x.cx, x.cy,
              EXISTS (SELECT 1 FROM dia_chinh_to t WHERE t.xa_moi_id = x.xa_id) AS co_bang_to
       FROM dia_chinh_xa x WHERE x.so_thua > 0 ORDER BY x.huyen, x.ten`);
    const map = (d: any) => ({
      xaId: d.xa_id, ten: d.ten, tenKd: d.ten_kd || '',
      ...(quanLy ? { soThua: d.so_thua } : {}),   // số thửa: CHỈ quản trị viên mới nhận được
      huyen: d.huyen || 'Chưa xếp',
      coBangTo: !!d.co_bang_to,   // xã này đã có bảng tra số tờ mới ↔ cũ chưa

      bbox: [Number(d.minx), Number(d.miny), Number(d.maxx), Number(d.maxy)],
      tam: [Number(d.cx), Number(d.cy)],
    });
    const out = {
      cap2: r.filter((d: any) => Number(d.cap) === 2).map(map),
      cap3: r.filter((d: any) => Number(d.cap) !== 2).map(map),
    };
    cachePut(KEY, out, 10 * 60 * 1000);
    res.setHeader('Cache-Control', quanLy ? 'private, no-store' : 'public, max-age=600');
    res.json(out);
  } catch (e: any) {
    console.error('[dia-chinh] danh mục lỗi:', e?.message || e);
    res.json({ cap2: [], cap3: [] });
  }
});

// ── TRA CỨU SỐ TỜ / SỐ THỬA ─────────────────────────────────────────────────
// GET /api/dc/tim?to=&thua=&xaId=&cap=
// Trả tối đa 40 kết quả; chỉ 12 kết quả đầu kèm hình thửa (để tô sáng), còn lại chỉ toạ độ
// → tra cứu vẫn đủ dùng nhưng không thể lạm dụng để rút hình thửa hàng loạt.
diaChinhRouter.get('/tim', async (req, res) => {
  const to = String(req.query.to || '').trim();
  const thua = String(req.query.thua || '').trim();
  const xaId = String(req.query.xaId || '').trim();
  const cap = String(req.query.cap || '').trim();
  if (!to && !thua) return res.status(400).json({ error: 'Cần ít nhất số thửa hoặc số tờ.' });

  const dk: string[] = []; const val: any[] = [];
  const soHoa = (v: string) => { const n = v.replace(/[^0-9]/g, '').replace(/^0+/, ''); return n ? Number(n) : NaN; };
  const soTo = to ? soHoa(to) : NaN;
  if (thua) { const n = soHoa(thua); if (!Number.isNaN(n)) { val.push(n); dk.push(`d.thua_num = $${val.length}`); } }
  // Lọc theo CẤP chỉ dùng khi CHƯA chọn xã. Đã chọn xã rồi mà còn lọc cấp thì lại sót đúng
  // những thửa còn mang mã xã cũ — chính cái bẫy vừa nói ở trên.
  if (!xaId && (cap === '2' || cap === '3')) { val.push(Number(cap)); dk.push(`d.cap = $${val.length}`); }

  let doiSoTo: { toMoi: number; toCu: number; xaCuId: string } | null = null;
  try {
    // ⚠️ HAI CÁI BẪY KHI CHỌN XÃ MỚI ⚠️
    //
    // (1) Thửa vẫn nằm nguyên dưới MÃ XÃ CŨ — hệ thống địa chính không dời sang mã mới.
    //     Chọn "Xã Cam Lâm" mà lọc theo xa_id thì chỉ thấy 14.683 thửa, trong khi xã đó
    //     thật ra có 54.263 thửa — sót 73%. Phải lọc theo xa_moi_id.
    //
    // (2) SỐ TỜ CŨNG ĐÃ ĐÁNH LẠI. Mỗi xã mới đánh số tờ liên tục từ 1, nên "tờ 250" trên
    //     giấy tờ mới của Xã Cam Lâm thật ra là "tờ 5 của xã Cam Hoà" trong dữ liệu.
    //     Nếu cứ so thẳng số tờ thì tra "tờ 5" ở Xã Cam Lâm sẽ ra 5 thửa của 5 xã cũ khác
    //     nhau — vô nghĩa, vì trong một xã thì một tờ + một thửa chỉ có ĐÚNG MỘT mảnh đất.
    //     Nên phải đổi số tờ mới → (xã cũ, số tờ cũ) qua bảng dia_chinh_to.
    let laXaMoi = false;
    if (xaId) {
      const [xa] = await query<any>('SELECT cap FROM dia_chinh_xa WHERE xa_id = $1', [xaId]).catch(() => [] as any[]);
      laXaMoi = Number(xa?.cap) === 2;
    }

    if (xaId && laXaMoi && !Number.isNaN(soTo)) {
      const [m] = await query<any>(
        'SELECT xa_cu_id, to_cu FROM dia_chinh_to WHERE xa_moi_id = $1 AND to_moi = $2',
        [xaId, soTo]).catch(() => [] as any[]);
      if (m) {
        // Có bảng tra → tra CHÍNH XÁC vào đúng tờ của đúng xã cũ, ra đúng một thửa.
        doiSoTo = { toMoi: soTo, toCu: Number(m.to_cu), xaCuId: m.xa_cu_id };
        val.push(m.xa_cu_id); dk.push(`d.xa_id = $${val.length}`);
        val.push(Number(m.to_cu)); dk.push(`d.to_num = $${val.length}`);
      } else {
        // Xã này chưa có bảng tra số tờ (mới chỉ có 4 xã của huyện Cam Lâm cũ) → đành tìm
        // rộng trong cả xã mới rồi để người dùng chọn, và báo rõ ở phần ghiChu.
        val.push(xaId); dk.push(`d.xa_moi_id = $${val.length}`);
        val.push(soTo); dk.push(`d.to_num = $${val.length}`);
      }
    } else {
      if (!Number.isNaN(soTo)) { val.push(soTo); dk.push(`d.to_num = $${val.length}`); }
      if (xaId) { val.push(xaId); dk.push(laXaMoi ? `d.xa_moi_id = $${val.length}` : `d.xa_id = $${val.length}`); }
    }
    if (!dk.length) return res.status(400).json({ error: 'Số thửa / số tờ không hợp lệ.' });
    // Bỏ ĐẤT HẠ TẦNG CÔNG CỘNG (đường sá, sông suối, thuỷ lợi) khỏi kết quả tra cứu — danh sách
    // mã lấy từ CHAN_TRA_CUU bên routes/parcels.ts để hai chỗ không bao giờ lệch nhau.
    // Chỉ bỏ thửa THUẦN một loại; thửa vừa đất ở vừa có phần đường vẫn giữ.
    val.push(Object.keys(CHAN_TRA_CUU));
    dk.push(`upper(btrim(coalesce(d.mdsd,''))) <> ALL($${val.length}::text[])`);

    const r = await query<any>(
      `SELECT d.id, d.xa_id, d.so_to, d.so_thua, d.dien_tich, d.mdsd,
              x.ten AS ten_xa, x.cap, x.huyen, xm.ten AS ten_xa_moi,
              ST_X(ST_PointOnSurface(d.geom)) AS lng, ST_Y(ST_PointOnSurface(d.geom)) AS lat,
              CASE WHEN row_number() OVER (ORDER BY d.xa_id, d.to_num, d.thua_num) <= 12
                   THEN ST_AsGeoJSON(d.geom)::json ELSE NULL END AS hinh
       FROM dia_chinh d
       LEFT JOIN dia_chinh_xa x  ON x.xa_id  = d.xa_id
       LEFT JOIN dia_chinh_xa xm ON xm.xa_id = d.xa_moi_id
       WHERE ${dk.join(' AND ')}
       ORDER BY d.xa_id, d.to_num, d.thua_num
       LIMIT 40`, val);
    res.json({
      soLuong: r.length,
      // Cho giao diện biết đã đổi số tờ mới sang số tờ cũ nào, để hiện cho người dùng thấy.
      doiSoTo,
      thuaDat: r.map((d: any) => ({
        id: d.id, xaId: d.xa_id,
        tenXa: d.ten_xa_moi || d.ten_xa,                                   // tên đơn vị HIỆN HÀNH
        tenXaCu: Number(d.cap) === 3 ? d.ten_xa : null,                    // tên trước sáp nhập
        huyenCu: Number(d.cap) === 3 ? d.huyen : null,
        cap: Number(d.cap) || 3,
        soTo: d.so_to, soThua: d.so_thua,
        dienTich: d.dien_tich == null ? null : Number(d.dien_tich),
        mdsd: d.mdsd || '', lng: Number(d.lng), lat: Number(d.lat),
        hinh: d.hinh || null,
      })),
    });
  } catch (e: any) {
    console.error('[dia-chinh] tìm lỗi:', e?.message || e);
    res.status(500).json({ error: 'Không tra cứu được, vui lòng thử lại.' });
  }
});
