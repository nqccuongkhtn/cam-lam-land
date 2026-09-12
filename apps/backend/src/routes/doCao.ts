// TRA ĐỘ CAO MẶT ĐẤT — dùng để biết chỗ nào là BIỂN, chỗ nào là sông/đất liền.
//
// Vì sao phải làm ở máy chủ? Bộ ảnh độ cao mở của AWS không kèm giấy phép cho trình duyệt đọc điểm
// ảnh (thiếu header CORS), nên web mở ảnh ra thì thấy nhưng KHÔNG đọc được con số độ cao.
// Máy chủ thì không bị luật đó — tải về, tự giải mã, trả lại con số cho web dùng.
//
// Ảnh dạng "terrarium": mỗi điểm ảnh mã hoá độ cao theo công thức  cao = R*256 + G + B/256 - 32768 (mét).
// Node không có sẵn thư viện đọc ảnh PNG nên bên dưới tự giải mã (PNG loại RGB 8 bit, không xen kẽ) —
// chỉ dùng zlib có sẵn trong Node.
import { Router } from 'express';
import { inflateSync } from 'node:zlib';

export const doCaoRouter = Router();

const Z = 10;                       // mức phóng của ảnh độ cao: 1 điểm ảnh ≈ 150 m — đủ để phân biệt biển với sông
const KICH = 256;
const nhoTile = new Map<string, Float32Array | null>();   // nhớ tạm các ô ảnh đã giải mã
const TOI_DA_TILE = 60;

// ── Giải mã PNG (chỉ loại RGB 8 bit, không xen kẽ — đúng loại của bộ ảnh này) ──
function giaiMaPng(buf: Buffer): { rong: number; cao: number; diem: Buffer } | null {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  let i = 8, rong = 0, cao = 0, sauBit = 0, loaiMau = 0, xenKe = 0;
  const idat: Buffer[] = [];
  while (i + 8 <= buf.length) {
    const doDai = buf.readUInt32BE(i);
    const ten = buf.toString('ascii', i + 4, i + 8);
    const noiDung = buf.subarray(i + 8, i + 8 + doDai);
    if (ten === 'IHDR') {
      rong = noiDung.readUInt32BE(0); cao = noiDung.readUInt32BE(4);
      sauBit = noiDung[8]; loaiMau = noiDung[9]; xenKe = noiDung[12];
    } else if (ten === 'IDAT') idat.push(noiDung);
    else if (ten === 'IEND') break;
    i += 12 + doDai;
  }
  if (!rong || !cao || sauBit !== 8 || xenKe !== 0) return null;
  const soKenh = loaiMau === 2 ? 3 : loaiMau === 6 ? 4 : loaiMau === 0 ? 1 : 0;
  if (!soKenh) return null;

  let tho: Buffer;
  try { tho = inflateSync(Buffer.concat(idat)); } catch { return null; }

  const buocHang = rong * soKenh;
  const ra = Buffer.alloc(cao * buocHang);
  let vt = 0;
  for (let y = 0; y < cao; y++) {
    const loc = tho[vt++];                       // mỗi hàng có 1 byte cho biết kiểu "lọc"
    const hang = tho.subarray(vt, vt + buocHang); vt += buocHang;
    const dich = y * buocHang, tren = dich - buocHang;
    for (let x = 0; x < buocHang; x++) {
      const a = x >= soKenh ? ra[dich + x - soKenh] : 0;   // điểm bên trái
      const b = y > 0 ? ra[tren + x] : 0;                   // điểm bên trên
      const c = (x >= soKenh && y > 0) ? ra[tren + x - soKenh] : 0;  // chéo trên-trái
      let v = hang[x];
      if (loc === 1) v += a;
      else if (loc === 2) v += b;
      else if (loc === 3) v += (a + b) >> 1;
      else if (loc === 4) {                                  // kiểu Paeth
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      ra[dich + x] = v & 0xff;
    }
  }
  return { rong, cao, diem: ra };
}

async function layTile(tx: number, ty: number): Promise<Float32Array | null> {
  const khoa = `${Z}/${tx}/${ty}`;
  if (nhoTile.has(khoa)) return nhoTile.get(khoa)!;
  let cao: Float32Array | null = null;
  try {
    const r = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${tx}/${ty}.png`,
      { signal: AbortSignal.timeout(12000) });
    if (r.ok) {
      const png = giaiMaPng(Buffer.from(await r.arrayBuffer()));
      if (png && png.rong === KICH) {
        cao = new Float32Array(KICH * KICH);
        for (let k = 0; k < KICH * KICH; k++) {
          const j = k * 3;
          cao[k] = png.diem[j] * 256 + png.diem[j + 1] + png.diem[j + 2] / 256 - 32768;
        }
      }
    }
  } catch { /* mạng lỗi thì thôi */ }
  if (nhoTile.size > TOI_DA_TILE) { const k = nhoTile.keys().next().value; if (k) nhoTile.delete(k); }
  nhoTile.set(khoa, cao);
  return cao;
}

// GET /api/do-cao?p=lng,lat;lng,lat;...   → { cao: [số mét hoặc null, ...] }
doCaoRouter.get('/', async (req, res) => {
  const ds = String(req.query.p || '').split(';').filter(Boolean).slice(0, 300);
  const ra: (number | null)[] = [];
  for (const s of ds) {
    const [lng, lat] = s.split(',').map(Number);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) { ra.push(null); continue; }
    const n = Math.pow(2, Z);
    const fx = ((lng + 180) / 360) * n;
    const r = (lat * Math.PI) / 180;
    const fy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
    const tx = Math.floor(fx), ty = Math.floor(fy);
    const tile = await layTile(tx, ty);
    if (!tile) { ra.push(null); continue; }
    const px = Math.min(KICH - 1, Math.max(0, Math.floor((fx - tx) * KICH)));
    const py = Math.min(KICH - 1, Math.max(0, Math.floor((fy - ty) * KICH)));
    ra.push(Math.round(tile[py * KICH + px] * 10) / 10);
  }
  res.set('Cache-Control', 'public, max-age=86400');   // độ cao mặt đất thì cả năm cũng không đổi
  res.json({ cao: ra });
});

// ── PHỤC VỤ ẢNH ĐỘ CAO CHO BẢN ĐỒ (proxy) ──
// GET /api/do-cao/tile/:z/:x/:y.png
// Vì sao phải qua máy chủ nhà: khi dựng núi 3D, bản đồ xin hàng trăm ô ảnh độ cao một lúc thẳng từ
// kho AWS bên Mỹ. Đường xa, xin dồn dập nên thỉnh thoảng vài ô bị rớt — mà một ô độ cao rớt thì cả
// mảng mặt đất chỗ đó phẳng lì rồi lúc ô về mới nhô lên: nhìn ra thành GIẬT.
// Đi qua máy chủ nhà thì ô nào đã lấy một lần là nằm sẵn ở đây, lần sau trả ra tức thì, không phụ
// thuộc đường truyền quốc tế nữa. Có thử lại 2 lần nếu kho bên kia trả lỗi.
// ── NHỚ TẠM TRONG BỘ NHỚ, KHÔNG GHI RA ĐĨA ──
// Đã thử cất ảnh thành file trên đĩa, nhưng ảnh độ cao nhiều vô kể — vẽ tuyến đi xa vài lần là thư
// mục phình ra, đầy máy. Nên giữ trong bộ nhớ thôi.
//
// ⚠️ VÌ SAO PHẢI GIỮ NHIỀU (trước chỉ 300 ô — chính là chỗ làm video giật ở cảnh núi):
// Trước lúc quay, máy đi nạp sẵn ảnh độ cao cho CẢ đường bay — một video 60 giây ngốn tới
// bảy tám trăm ô. Kho chỉ giữ 300 thì nạp tới ô thứ 301 là ô đầu tiên bị đẩy ra. Lúc quay thật,
// camera quay lại đúng chỗ đó thì phải đi xin lại từ kho bên Mỹ — mất một giây, mà một giây đó
// mặt đất tụt về phẳng rồi mới nhô lên: nhìn ra đúng kiểu HÌNH NHẢY QUA NHẢY LẠI ở chỗ đồi núi.
// Giữ 3000 ô (chừng 90 MB) thì cả đường bay dài nằm gọn trong kho, quay bao nhiêu lần cũng tức thì.
// Có thêm chốt theo dung lượng phòng khi gặp ảnh nặng bất thường.
const nhoAnh = new Map<string, Buffer>();
const TOI_DA_ANH = Number(process.env.DEM_CACHE_TILES || 3000);
const TOI_DA_BYTE = Number(process.env.DEM_CACHE_MB || 120) * 1024 * 1024;
let dungLuongNho = 0;
/** Bỏ bớt ô cũ nhất cho tới khi kho về trong mức cho phép. */
function donKho(): void {
  while (nhoAnh.size > TOI_DA_ANH || dungLuongNho > TOI_DA_BYTE) {
    const k = nhoAnh.keys().next().value;
    if (!k) break;
    const b = nhoAnh.get(k);
    if (b) dungLuongNho -= b.length;
    nhoAnh.delete(k);
  }
}

doCaoRouter.get('/tile/:z/:x/:y.png', async (req, res) => {
  const z = Number(req.params.z), x = Number(req.params.x), y = Number(req.params.y);
  if (!Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(y) || z < 0 || z > 15) {
    return res.status(400).end();
  }
  const khoa = `${z}/${x}/${y}`;
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Cache-Control', 'public, max-age=2592000, immutable');   // độ cao mặt đất cả năm không đổi
  res.type('image/png');
  const co = nhoAnh.get(khoa);
  if (co) { nhoAnh.delete(khoa); nhoAnh.set(khoa, co); return res.end(co); }   // dùng tới thì đẩy lên đầu hàng
  for (let lan = 0; lan < 3; lan++) {
    try {
      const r = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${khoa}.png`,
        { signal: AbortSignal.timeout(12000) });
      if (!r.ok) { if (r.status === 404) return res.status(404).end(); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 100) continue;                                // ảnh cụt → thử lại
      nhoAnh.set(khoa, buf); dungLuongNho += buf.length; donKho();
      return res.end(buf);
    } catch { /* thử lại */ }
  }
  res.status(502).end();
});
