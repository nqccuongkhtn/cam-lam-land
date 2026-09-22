/* ============================================================================
 *  NẠP BỘ TIN ĐĂNG MẪU CAM LÂM VÀO DATABASE
 * ----------------------------------------------------------------------------
 *  Script này KHÔNG tự nối vào database. Nó chỉ IN RA câu lệnh SQL, mình xem
 *  thấy ổn rồi thì đổ vào PostgreSQL. Làm vậy để không bao giờ lỡ tay xoá nhầm.
 *
 *  CÁCH DÙNG:
 *     node scripts/tin-mau/nap-tin-mau.mjs > nap-tin.sql
 *     docker compose exec -T postgis psql -U camlam -d camlam_gis < nap-tin.sql
 *
 *  Chạy lại bao nhiêu lần cũng được: mỗi lần nó XOÁ HẾT tin mẫu cũ rồi nạp lại
 *  từ đầu, nên không bao giờ bị nhân đôi.
 *
 *  ⚠️ NÓ GIỮ NGUYÊN TIN THẬT của anh (tin do tài khoản thường đăng). Chỉ xoá
 *     tin của mấy tài khoản demo-*@camlam.local và tin mẫu cũ không có người đăng.
 *
 *  Muốn thêm/bớt/sửa tin thì sửa file tin-mau.mjs bên cạnh rồi chạy lại.
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIN, TAM_XA, NGUOI_DANG } from './tin-mau.mjs';

/* ── RẢI ẢNH CHO ĐỀU ──────────────────────────────────────────────────────
 * Trong tin-mau.mjs mình chọn tay ảnh cho từng tin, nên có ảnh bị dùng tới 8 lần
 * còn ảnh khác không ai dùng — lướt danh sách thấy lặp rất chán mắt.
 *
 * Nên ở đây làm thêm một bước: GIỮ NGUYÊN ẢNH ĐẦU (ảnh đầu quyết định thẻ tin
 * trông ra sao nên phải đúng loại, đã chọn tay rồi), còn các ảnh SAU thì lấy lần
 * lượt từ kho ảnh cùng nhóm (đất nền lấy ảnh đất nền, vườn lấy ảnh vườn…).
 * Nhờ vậy mọi ảnh trong kho đều được dùng và không tin nào trùng ảnh tin bên cạnh.
 */
const THU_MUC_ANH = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../apps/frontend/public/tin-mau');

/** Đọc kho ảnh, xếp theo nhóm dựa vào tên file (dat-nen-01.webp → nhóm "dat-nen"). */
function docKhoAnh() {
  const kho = {};
  for (const f of fs.readdirSync(THU_MUC_ANH).filter((f) => f.endsWith('.webp')).sort()) {
    const nhom = f.replace(/-\d+\.webp$/, '');
    (kho[nhom] ||= []).push('tin-mau/' + f);
  }
  return kho;
}

/** Nhóm ảnh hợp với từng loại bất động sản. */
const NHOM_THEO_LOAI = {
  land: ['dat-nen', 'vuon'], farm: ['vuon', 'dat-nen'],
  house: ['nha'], villa: ['biet-thu'], commercial: ['mat-bang'],
  warehouse: ['mat-bang', 'dat-nen'], room: ['nha'], office: ['mat-bang'],
};

const SO_ANH_MOI_TIN = 5;   // tin rao thật thường có 5–8 ảnh

function raiAnh(danhSach) {
  const kho = docKhoAnh();

  /* Hai bộ đếm RIÊNG BIỆT — đây là chỗ quan trọng.
   * Ảnh ĐẦU là ảnh hiện trên thẻ tin ngoài danh sách, người ta lướt là thấy ngay,
   * nên nó phải xoay vòng đều và không được trùng với tin đứng cạnh.
   * Nếu dùng chung một bộ đếm với đám ảnh bù phía sau thì nhịp bị lệch, có tấm
   * làm ảnh đầu tới 7 lần. Nên tách ra: 'dau' lo ảnh đầu, 'sau' lo ảnh còn lại. */
  const dem = { dau: {}, sau: {} };
  const lay = (loai, nhom) => {
    const a = kho[nhom]; if (!a || !a.length) return null;
    const d = dem[loai];
    return a[(d[nhom] = (d[nhom] ?? -1) + 1) % a.length];
  };
  const nhomCua = (t) => NHOM_THEO_LOAI[t.loai] || ['dat-nen'];

  // Lượt 1 — chọn ảnh đầu cho TẤT CẢ tin trước, xoay vòng đều trong nhóm.
  const anhDau = danhSach.map((t) => {
    const goc = (t.anh || [])[0];
    // Ảnh Bãi Dài là ảnh THẬT của Cam Lâm, đã chọn có chủ đích → giữ nguyên.
    if (goc && goc.startsWith('bai-dai/')) return goc;
    const n = nhomCua(t);
    return lay('dau', n[0]) || lay('dau', n[1]) || goc;
  });

  // Lượt 2 — bù các ảnh sau cho đủ, cũng lấy trong nhóm hợp với loại đó.
  return danhSach.map((t, i) => {
    const moi = [anhDau[i]].filter(Boolean);
    // Giữ lại mấy ảnh Bãi Dài đã chọn tay ở các vị trí sau
    for (const cu of (t.anh || []).slice(1)) if (cu.startsWith('bai-dai/') && !moi.includes(cu)) moi.push(cu);
    const n = nhomCua(t);
    for (let thu = 0; moi.length < SO_ANH_MOI_TIN && thu < 40; thu++) {
      const c = lay('sau', n[thu % n.length]);
      if (c && !moi.includes(c)) moi.push(c);
    }
    return { ...t, anh: moi };
  });
}

/* ── Mấy hàm lặt vặt ─────────────────────────────────────────────────────── */

/** Bọc chuỗi cho an toàn khi ghép vào câu SQL (nhân đôi dấu nháy đơn). */
const q = (s) => (s === null || s === undefined || s === '' ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);

/** Mảng chuỗi → kiểu text[] của PostgreSQL. */
const mang = (a) => (a && a.length ? `ARRAY[${a.map(q).join(',')}]` : "'{}'");

/** Bộ sinh số ngẫu nhiên CỐ ĐỊNH — chạy lại vẫn ra y hệt, không nhảy lung tung. */
function tao_ngau_nhien(hat) {
  let s = hat >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Viết số tiền cho người đọc: 8800 triệu → "8,8 tỷ"; 480 triệu → "480 triệu". */
function tienChu(trieu) {
  if (trieu >= 1000) {
    const ty = trieu / 1000;
    return (Number.isInteger(ty) ? String(ty) : ty.toFixed(2).replace(/0$/, '').replace(/\.$/, '')).replace('.', ',') + ' tỷ';
  }
  if (trieu >= 1) return `${String(trieu).replace('.', ',')} triệu`;
  return `${Math.round(trieu * 1000)} nghìn`;
}

/** Giá mỗi m² viết cho dễ đọc. */
function giaMoiM2(giaTr, dt) {
  const t = giaTr / dt;                      // triệu/m²
  if (t >= 1) return `${t.toFixed(t < 10 ? 1 : 0).replace('.', ',')} triệu/m²`;
  return `${Math.round(t * 1000)} nghìn/m²`;
}

/** Diện tích viết có dấu chấm ngăn nghìn: 12000 → "12.000". */
const dtChu = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const TEN_LOAI = {
  land: 'đất nền', farm: 'đất nông nghiệp', house: 'nhà', villa: 'biệt thự',
  commercial: 'mặt bằng kinh doanh', warehouse: 'kho', room: 'phòng trọ', office: 'văn phòng',
};

/* ── Dựng phần mô tả cho một tin, viết như người môi giới thật hay viết ──── */
function dungMoTa(t) {
  const thue = t.deal === 'rent';
  const nguoi = NGUOI_DANG[t.nguoi - 1] ?? NGUOI_DANG[0];
  const d = [];

  // Câu mở đầu
  d.push(thue
    ? `Cho thuê ${TEN_LOAI[t.loai] || 'bất động sản'} tại ${t.diaChi}, xã ${t.xa}, Cam Lâm — Khánh Hoà.`
    : `Cần bán ${TEN_LOAI[t.loai] || 'bất động sản'} tại ${t.diaChi}, xã ${t.xa}, Cam Lâm — Khánh Hoà.`);
  d.push('');

  // Các điểm nhấn
  d.push(...t.y.map((c) => `• ${c}`));
  d.push('');

  // Bảng thông số
  const ts = [`Diện tích: ${dtChu(t.dt)} m²`];
  if (t.mt) ts.push(`Mặt tiền: ${String(t.mt).replace('.', ',')} m`);
  if (t.pn) ts.push(`Phòng ngủ: ${t.pn}`);
  if (t.wc) ts.push(`Vệ sinh: ${t.wc}`);
  if (t.huong) ts.push(`Hướng: ${t.huong}`);
  if (t.phapLy) ts.push(`Pháp lý: ${t.phapLy}`);
  d.push(ts.join(' · '));

  d.push(thue
    ? `Giá thuê: ${tienChu(t.giaTr)}/tháng.`
    : `Giá bán: ${tienChu(t.giaTr)} — tương đương ${giaMoiM2(t.giaTr, t.dt)}.`);
  d.push('');

  d.push(`Liên hệ ${nguoi.ten} — ${nguoi.dt} (${nguoi.vaiTro}) để xem trực tiếp.`);
  d.push('');
  d.push('[Tin đăng mẫu — dùng để xem thử giao diện, không phải tin rao thật.]');

  return d.join('\n');
}

/* ── Sinh SQL ────────────────────────────────────────────────────────────── */
const rnd = tao_ngau_nhien(20260922);
const DS_TIN = raiAnh(TIN);   // rải ảnh phụ cho đều trước khi sinh SQL
const out = [];
const p = (s) => out.push(s);

p('-- ===========================================================================');
p('--  TIN ĐĂNG MẪU CAM LÂM — sinh tự động bởi scripts/tin-mau/nap-tin-mau.mjs');
p(`--  Sinh lúc: ${new Date().toISOString()}   ·   Số tin: ${DS_TIN.length}`);
p('--  Giá đặt theo giá rao THẬT của Cam Lâm đo ngày 22/9/2026. Không chép tin của ai.');
p('-- ===========================================================================');
p('BEGIN;');
p('');

p('-- 1) Bốn người đăng mẫu (số điện thoại là số GIẢ, cố ý chọn dãy không có thật)');
NGUOI_DANG.forEach((n, i) => {
  p(`INSERT INTO users (email, password_hash, full_name, phone, role, email_verified)
VALUES ('demo-agent-${i + 1}@camlam.local', 'x-khong-dang-nhap-duoc', ${q(n.ten)}, ${q(n.dt)}, 'user', true)
ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone;`);
});
p('');

p('-- 2) Xoá sạch tin mẫu CŨ (chỉ tin của tài khoản demo-* và tin mẫu không có người đăng).');
p('--    Tin thật do anh hoặc khách đăng thì GIỮ NGUYÊN.');
p(`DELETE FROM listings
 WHERE created_by IN (SELECT id FROM users WHERE email LIKE 'demo-agent-%@camlam.local')
    OR (created_by IS NULL AND NOT EXISTS (SELECT 1 FROM listing_images i WHERE i.listing_id = listings.id));`);
p('');

p('-- 3) Nạp tin mẫu mới');
p('');

DS_TIN.forEach((t, i) => {
  const thue = t.deal === 'rent';
  const nguoi = NGUOI_DANG[t.nguoi - 1] ?? NGUOI_DANG[0];
  const [lng0, lat0] = TAM_XA[t.xa] ?? [109.0917, 12.0771];

  // Rải điểm quanh tâm xã cho tin không chồng lên nhau trên bản đồ
  const lng = (lng0 + (rnd() - 0.5) * 0.016).toFixed(6);
  const lat = (lat0 + (rnd() - 0.5) * 0.016).toFixed(6);

  // Ngày đăng.
  // ⚠️ LƯU Ý QUAN TRỌNG: web có luật "tin THƯỜNG tự ẩn khỏi danh sách sau 7 ngày
  // nếu không được đẩy" (apps/backend/src/routes/listings.ts). Nên tin thường phải
  // đăng trong vòng 6 ngày trở lại, không thì nạp vào rồi mà ngoài web không thấy.
  // Tin VIP có ngày đẩy (bumped_at) nên để cũ hơn vẫn hiện bình thường.
  const ngayTruoc = t.hang === 'diamond' ? Math.floor(rnd() * 4)
    : t.hang === 'gold' ? Math.floor(rnd() * 14)
      : t.hang === 'silver' ? Math.floor(rnd() * 25) : Math.floor(rnd() * 7);

  // Lượt xem: tin VIP và tin ven biển được xem nhiều hơn
  const nhan = t.hang === 'diamond' ? 6 : t.hang === 'gold' ? 3.5 : t.hang === 'silver' ? 2 : 1;
  const luotXem = Math.round((40 + rnd() * 260) * nhan);

  const hang = t.hang || 'normal';
  const day = hang !== 'normal';           // tin VIP thì có đẩy tin

  p(`-- ${i + 1}. ${t.tieuDe}`);
  p(`INSERT INTO listings
 (title, description, price, area, property_type, deal, address, ward,
  bedrooms, bathrooms, direction, legal, frontage,
  contact_name, contact_phone, status, images, geom,
  created_by, created_at, tier, boosted, bumped_at, views, verified)
VALUES (
 ${q(t.tieuDe)},
 ${q(dungMoTa(t))},
 ${Math.round(t.giaTr * 1e6)}, ${t.dt}, ${q(t.loai)}, ${q(thue ? 'rent' : 'sale')},
 ${q(t.diaChi)}, ${q(t.xa)},
 ${t.pn ?? 'NULL'}, ${t.wc ?? 'NULL'}, ${q(t.huong)}, ${q(t.phapLy)}, ${t.mt ?? 'NULL'},
 ${q(nguoi.ten)}, ${q(nguoi.dt)}, 'active',
 ${mang((t.anh || []).map((a) => '/' + a))},
 ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
 (SELECT id FROM users WHERE email = 'demo-agent-${t.nguoi}@camlam.local'),
 now() - interval '${ngayTruoc} days',
 ${q(hang)}, ${day}, ${day ? `now() - interval '${Math.floor(rnd() * 3)} days'` : 'NULL'},
 ${luotXem}, ${hang === 'diamond' || hang === 'gold'}
);`);
  p('');
});

p('COMMIT;');
p('');
p('-- Xem lại kết quả:');
p("--   SELECT ward, property_type, count(*), round(avg(price/area)/1e6,1) AS trieu_moi_m2");
p("--     FROM listings WHERE deal='sale' GROUP BY 1,2 ORDER BY 1,2;");

process.stdout.write(out.join('\n') + '\n');
