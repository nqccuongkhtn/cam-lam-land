// QH CHI TIẾT 1/500 CAM LÂM TRÊN MỘT THỬA (15/10/2026) — chủ dự án: "thông tin thửa chưa hiện thông tin quy hoạch 1-500".
// 6 đồ án QĐ 2043–2048/QĐ-UBND ngày 25/9/2026 (UBND xã Cam Lâm). SỐ LIỆU CHỈ GỬI CHO ADMIN (routes/parcels.ts kiểm bằng
// nguoiDungTuYeuCau — đủ chữ ký + tài khoản còn + không khoá + đúng đời phiên). Người khác: thửa nằm trong ranh 1/500 thì chỉ nhận dấu
// { ma:'ct500', khoa:true } — giao diện hiện trang có khoá "liên hệ admin", KHÔNG có loại đất / diện tích / số quyết định.
// Dữ liệu: bảng qh_500 (lô tô màu, đã tách KHÔNG CHỒNG theo đúng thứ tự vẽ của ảnh tô màu) + qh_500_ranh (ranh từng đồ án) —
// nạp bằng scripts/qh-tinh/to_mau_1_500.py nap-sql. Màu = màu ảnh lớp "QH chi tiết 1/500 · tô màu" (bảng mau-1-500.json).
// Cách tính giống phần PDF (qhPdf.ts): hình thửa DỊCH về đúng chỗ (lớp địa chính trượt +0,533 m đông / +0,141 m bắc — LECH_DIA_CHINH),
// đo trên elipxoit rồi đổi tỷ lệ về diện tích CHÍNH THỨC của thửa (mặt phẳng VN-2000, như sổ) → các dòng cộng lại đúng bằng diện tích
// thửa. Phần thửa TRONG ranh mà không có lô nào = Đất giao thông (bản vẽ 1/500 để trống lòng đường — như luật "khe trong ranh = đường"
// của bản phân khu); phần NGOÀI ranh = "Nằm ngoài phạm vi bản quy hoạch này" (giao diện không hiện dòng này, như các bản khác).
import { query } from './db.ts';
import { LECH_DIA_CHINH } from './qhCompute.ts';

export type Ban500 = { ma: 'ct500'; ten: string; nguon: '1/500'; qd?: string; khoa?: boolean;
  areas: { type: string; areaM2: number; mau?: string }[] };
const DUONG = 'Đất giao thông';
const NGOAI = 'Nằm ngoài phạm vi bản quy hoạch này';
const MAU_DUONG = '#c8c8c8';
// Phần đường / phần ngoài ranh nhỏ hơn số này (khe giữa hai lô, mép thửa chạm ranh) thì chia theo tỷ lệ cho các dòng khác.
const NGUONG_M2 = 0.5;
// DẢI HẸP HƠN SAI SỐ CHO PHÉP CỦA BẢN ĐỒ ĐỊA CHÍNH = SAI SỐ VẼ, KHÔNG PHẢI LOẠI ĐẤT TRÊN THỬA (15/10/2026). Chủ dự án hỏi Thửa 1449 · Tờ 157
// (tờ cũ 4 Cam Thành Bắc) "đâu ra đất tái định cư, bạn nhầm không" rồi dặn "tự nghiên cứu làm đúng 100 %". Đo được:
//  · bản vẽ 1/500 và lớp địa chính KHỚP HỆ: góc lô vẽ theo ranh thửa lệch góc thửa địa chính đúng +0,538 m Đông / +0,143 m Bắc ở 4 đồ án
//    (Cam Đức, Cam Hải Tây, Cam Hòa, Cam Tân) — trùng độ trượt LECH_DIA_CHINH (+0,533 / +0,141, đo từ 9 phiếu chính thức) tới ~5 mm;
//  · mẩu "Đất ở tái định cư 0,8 m²" là dải rộng 6,3 cm × dài 13,4 m dọc ranh chung với lô TĐC của thửa bên cạnh — nét ranh hai bản đồ lệch
//    nhau vài cm ở đúng đoạn đó. Quy chuẩn bản đồ địa chính (TT 25/2014/TT-BTNMT, sửa bởi TT 33/2017): sai số vị trí điểm trên ranh thửa
//    7 cm (tờ 1:500) · 15 cm (1:1000) · 30 cm (1:2000) → dải hẹp hơn MỨC CHẶT NHẤT (7 cm) thì đo đạc không phân biệt được.
// Nên: loại đất nào trên thửa chỉ là dải hẹp hơn RONG_SAI_SO_M (bề rộng = đường kính vòng tròn lớn nhất nằm lọt trong phần đó) thì bỏ dòng,
// diện tích chia theo tỷ lệ cho các dòng còn lại (tổng vẫn đúng bằng diện tích thửa); thửa chỉ chạm ranh 1/500 bằng dải hẹp như vậy thì
// coi như KHÔNG nằm trong đồ án. Dải từ 7 cm trở lên vẫn hiện đủ (có thể là phần thật, vd lộ giới lấn vào thửa). Đo 10.644 thửa trong vùng
// 1/500: ~145 dòng (thửa × loại đất) hẹp dưới 7 cm.
const RONG_SAI_SO_M = 0.07;
// Bề rộng (m) của một hình — đường kính vòng tròn lớn nhất lọt trong hình, đo trên mặt phẳng UTM 49N (mét). Hình rỗng = 0.
const sqlRong = (x: string) => `(CASE WHEN ${x} IS NULL OR ST_IsEmpty(ST_CollectionExtract(${x}, 3)) THEN 0
  ELSE 2 * (ST_MaximumInscribedCircle(ST_Transform(ST_CollectionExtract(${x}, 3), 32649))).radius END)`;

export async function qh500TrenThua(idThua: number, dtThua: number, coQuyen: boolean): Promise<Ban500 | null> {
  return tinh500('SELECT ST_Translate(ST_MakeValid(geom), $2, $3) AS geom FROM dia_chinh WHERE id = $1',
    [idThua, -LECH_DIA_CHINH.x, -LECH_DIA_CHINH.y], dtThua, coQuyen);
}

/** Cùng phép tính cho THỬA KHÁCH TỰ VẼ từ toạ độ VN-2000 (15/10/2026, POST /api/parcels/qh-tu-ve): `geojson` = Polygon WGS84 đổi thẳng từ
 *  toạ độ khách nhập — KHÔNG dịch (toạ độ chính thức đã đúng chỗ). Cùng luật khoá: không có quyền thì chỉ trả dấu khoá. */
export async function qh500TrenHinh(geojson: string, dtThua: number, coQuyen: boolean): Promise<Ban500 | null> {
  return tinh500('SELECT ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) AS geom', [geojson], dtThua, coQuyen);
}

async function tinh500(pSql: string, thamSo: any[], dtThua: number, coQuyen: boolean): Promise<Ban500 | null> {
  const P = `WITH p AS (${pSql})`;
  const ranh = await query<any>(`${P}
    SELECT r.ban, r.qd, ST_Area(ST_Intersection(r.geom, p.geom)::geography) AS dt, ST_Area(p.geom::geography) AS tong
    FROM qh_500_ranh r, p WHERE r.geom && p.geom AND ST_Intersects(r.geom, p.geom)`, thamSo)
    .catch((e) => { console.error('[qh500]', e?.message || e); return [] as any[]; });
  const trong = ranh.reduce((s: number, r: any) => s + (Number(r.dt) || 0), 0);
  if (!ranh.length || trong < NGUONG_M2) return null;          // thửa không nằm trong đồ án 1/500 nào (chạm mép ranh vài cm thì bỏ)
  // Thửa chỉ chạm ranh đồ án bằng dải hẹp hơn sai số → không thuộc đồ án.
  const [rongTrong] = await query<any>(`${P},
      r AS (SELECT ST_Union(r.geom) AS g FROM qh_500_ranh r, p WHERE r.geom && p.geom AND ST_Intersects(r.geom, p.geom))
    SELECT ${sqlRong('ST_Intersection(p.geom, r.g)')} AS rong FROM p, r`, thamSo)
    .catch((e) => { console.error('[qh500]', e?.message || e); return [] as any[]; });
  if (rongTrong && Number(rongTrong.rong) < RONG_SAI_SO_M) return null;
  if (!coQuyen) return { ma: 'ct500', ten: 'QH chi tiết 1/500', nguon: '1/500', khoa: true, areas: [] };
  const lo = await query<any>(`${P}
    SELECT z.ten, MIN(z.mau) AS mau, SUM(ST_Area(ST_Intersection(z.geom, p.geom)::geography)) AS dt
    FROM qh_500 z, p WHERE z.geom && p.geom AND ST_Intersects(z.geom, p.geom) GROUP BY z.ten`, thamSo)
    .catch((e) => { console.error('[qh500]', e?.message || e); return [] as any[]; });
  // PHẦN HẸP HƠN SAI SỐ — dùng PHÉP "MỞ HÌNH" trên mặt phẳng UTM 49N (mét): gọt mỗi mảnh (từng loại đất của lô, phần "đường" = trong ranh
  // mà không lô nào phủ, phần ngoài ranh) vào trong RONG_SAI_SO_M/2 rồi nở ra lại đúng chừng ấy → còn "THÂN ĐẶC"; phần bị gọt mất = chỗ HẸP
  // HƠN SAI SỐ. Mỗi mẩu hẹp nhập vào THÂN ĐẶC nằm kề nó dài nhất (kể cả thân đặc của chính loại đó — vd mũi nhọn của một lô → không đổi gì).
  // Vì sao không đo cả mảnh: phần "đường" gồm cả lòng đường thật lẫn những khe vụn do làm tròn số bám dọc viền thửa, dính liền nên mượn được
  // bề rộng của lòng đường — Thửa 1449 · tờ cũ 4 Cam Thành Bắc: dải TĐC 6 cm nằm sát viền thửa, một bên lô nhà ở (chung 13,38 m), bên kia
  // khe vụn của phần đường (13,44 m) → từng bị nhập nhầm vào "Đất giao thông". Mẩu hẹp < 0,01 m² (góc bo của phép gọt) bỏ qua.
  const R = RONG_SAI_SO_M / 2;
  const hepManh = await query<any>(`${P},
      pm AS (SELECT ST_Transform(geom, 32649) AS g FROM p),
      r AS (SELECT ST_Transform(ST_Union(r.geom), 32649) AS g FROM qh_500_ranh r, p WHERE r.geom && p.geom AND ST_Intersects(r.geom, p.geom)),
      lo AS (SELECT z.ten, ST_CollectionExtract(ST_Union(ST_Intersection(ST_Transform(z.geom, 32649), pm.g)), 3) AS hinh
             FROM qh_500 z, p, pm WHERE z.geom && p.geom AND ST_Intersects(z.geom, p.geom) GROUP BY z.ten),
      tat AS (
        SELECT ten::text AS ten, hinh FROM lo
        UNION ALL
        SELECT $${thamSo.length + 1}::text, ST_CollectionExtract(ST_Difference(ST_Intersection(pm.g, r.g),
               COALESCE((SELECT ST_Union(hinh) FROM lo), ST_SetSRID('GEOMETRYCOLLECTION EMPTY'::geometry, 32649))), 3) FROM pm, r
        UNION ALL
        SELECT $${thamSo.length + 2}::text, ST_CollectionExtract(ST_Difference(pm.g, r.g), 3) FROM pm, r),
      mo AS (SELECT ten, hinh, ST_Buffer(ST_Buffer(hinh, -${R}), ${R}) AS dac FROM tat WHERE hinh IS NOT NULL AND NOT ST_IsEmpty(hinh)),
      hep AS (SELECT ten, (ST_Dump(ST_CollectionExtract(ST_Difference(hinh, dac), 3))).geom AS g FROM mo)
    SELECT h.ten, ST_Area(ST_Transform(h.g, 4326)::geography) AS dt,
           (SELECT m.ten FROM mo m WHERE NOT ST_IsEmpty(m.dac) AND ST_DWithin(h.g, m.dac, ${RONG_SAI_SO_M})
              ORDER BY ST_Length(ST_Intersection(ST_Boundary(h.g), ST_Buffer(m.dac, 0.01))) DESC, ST_Distance(h.g, m.dac) LIMIT 1) AS ke
    FROM hep h WHERE ST_Area(h.g) >= 0.01`, [...thamSo, DUONG, NGOAI])
    .catch((e) => { console.error('[qh500]', e?.message || e); return [] as any[]; });
  const tong = Number(ranh[0].tong) || 0;                    // diện tích thửa trên elipxoit — cùng thước với các phần giao
  if (!tong) return null;
  const coSo = dtThua > 0 ? dtThua : tong;                   // diện tích chính thức (mặt phẳng VN-2000) — tổng các dòng = số này
  const k = coSo / tong;
  const dong: { type: string; v: number; mau?: string }[] = lo
    .map((r: any) => ({ type: String(r.ten), v: (Number(r.dt) || 0) * k, mau: (r.mau || undefined) as string | undefined }))
    .filter((d) => d.v > 0);
  const tongLo = dong.reduce((s, d) => s + d.v, 0);
  const duong = Math.max(0, Math.min(trong, tong) * k - tongLo);
  const ngoai = Math.max(0, coSo - Math.min(trong, tong) * k);
  if (duong > 0) dong.push({ type: DUONG, v: duong, mau: MAU_DUONG });
  if (ngoai > 0) dong.push({ type: NGOAI, v: ngoai, mau: undefined });
  // Chuyển diện tích từng mảnh hẹp sang loại đất của mảnh kề nó; không có mảnh kề (hiếm) thì chia theo tỷ lệ như phần lẻ bên dưới.
  let lech = 0;
  for (const h of hepManh) {
    const tu = dong.find((x) => x.type === String(h.ten));
    if (!tu) continue;
    const bot = Math.min(tu.v, (Number(h.dt) || 0) * k);
    tu.v -= bot;
    const den = h.ke ? dong.find((x) => x.type === String(h.ke)) : undefined;
    if (den) den.v += bot; else lech += bot;
  }
  for (let i = dong.length - 1; i >= 0; i--) if (dong[i].v <= 1e-6) dong.splice(i, 1);
  // Mẩu đường / ngoài ranh quá nhỏ (khe giữa hai lô, mép thửa chạm ranh) → chia theo tỷ lệ cho các dòng còn lại, như trước.
  for (let i = dong.length - 1; i >= 0; i--) {
    if ((dong[i].type === DUONG || dong[i].type === NGOAI) && dong[i].v < NGUONG_M2) { lech += dong[i].v; dong.splice(i, 1); }
  }
  if (!dong.length) return null;
  const tongDong = dong.reduce((s, d) => s + d.v, 0);
  if (lech > 0 && tongDong > 0) for (const d of dong) d.v *= coSo / tongDong;
  dong.sort((a, b) => b.v - a.v);
  // Làm tròn 0,1 m² mà TỔNG vẫn đúng bằng diện tích thửa (như qhPdf.ts): cắt xuống 0,1, phần thiếu cấp cho dòng có phần lẻ lớn nhất.
  const muc = Math.round(coSo * 10);
  const phan = dong.map((d) => Math.floor(d.v * 10 + 1e-9));
  const thuTu = dong.map((_, i) => i).sort((a, b) => (dong[b].v * 10 - phan[b]) - (dong[a].v * 10 - phan[a]));
  let du = muc - phan.reduce((s, x) => s + x, 0);
  for (let j = 0; du > 0 && thuTu.length; j = (j + 1) % thuTu.length, du--) phan[thuTu[j]]++;
  for (let j = thuTu.length - 1; du < 0 && j >= 0; j--) if (phan[thuTu[j]] > 0) { phan[thuTu[j]]--; du++; }
  const areas = dong.map((d, i) => ({ type: d.type, areaM2: phan[i] / 10, mau: d.mau })).filter((a) => a.areaM2 > 0);
  const qd = [...new Set(ranh.filter((r: any) => (Number(r.dt) || 0) >= NGUONG_M2).map((r: any) => String(r.qd)))].join(' · ');
  return { ma: 'ct500', ten: 'QH chi tiết 1/500', nguon: '1/500', qd, areas };
}
