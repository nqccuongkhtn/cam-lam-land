// CHỈ ĐƯỜNG NHIỀU TUYẾN (giống Google Maps) — dùng tạm, dễ gỡ: xoá 1 dòng app.use + file này.
//
// Cách làm: máy chủ đứng ra hỏi hộ các máy tìm đường mở (OSRM) rồi dịch kết quả sang tiếng Việt.
// Vì sao KHÔNG để trình duyệt gọi thẳng?
//   - Giấu địa chỉ máy tìm đường, tránh bị chặn CORS;
//   - Gọi lại đúng câu hỏi cũ thì trả ngay từ bộ nhớ (cache) → nhanh, đỡ làm phiền máy chủ miễn phí;
//   - Có nhiều máy dự phòng: máy này hỏng thì tự chuyển sang máy khác.
import { Router } from 'express';
import { cached, cachePut } from '../lib/cache.ts';

export const chiDuongRouter = Router();

// ==== Các máy tìm đường công cộng (miễn phí) — thử lần lượt từ trên xuống ====
// {p} = loại phương tiện, {c} = danh sách toạ độ "lng,lat;lng,lat"
const MAY_TIM_DUONG = [
  { ten: 'osrm-chinh', url: (p: string, c: string) => `https://router.project-osrm.org/route/v1/${p}/${c}` },
  { ten: 'osm-de', url: (p: string, c: string) => `https://routing.openstreetmap.de/routed-${p === 'driving' ? 'car' : p === 'cycling' ? 'bike' : 'foot'}/route/v1/${p}/${c}` },
];

// Phương tiện người dùng chọn → tên OSRM hiểu được. Xe máy đi gần giống ô tô nên dùng chung 'driving'.
const PROFILE: Record<string, string> = { car: 'driving', motorbike: 'driving', bike: 'cycling', foot: 'walking' };

// Xe máy ở Việt Nam nhanh hơn ô tô trong phố (luồn lách, ít kẹt) → nhân thời gian cho hệ số này.
const HE_SO_THOI_GIAN: Record<string, number> = { car: 1, motorbike: 0.82, bike: 1, foot: 1 };

// ==== Dịch câu lệnh rẽ của OSRM sang tiếng Việt ====
const HUONG: Record<string, string> = {
  'sharp left': 'gấp sang trái', 'left': 'sang trái', 'slight left': 'chếch sang trái',
  'straight': 'đi thẳng', 'slight right': 'chếch sang phải', 'right': 'sang phải',
  'sharp right': 'gấp sang phải', 'uturn': 'quay đầu',
};
function loiDan(step: any, dauTien: boolean): string {
  const m = step?.maneuver || {};
  const kieu = String(m.type || '');
  const huong = HUONG[String(m.modifier || '')] || '';
  const ten = String(step?.name || '').trim();
  const vao = ten ? ` vào ${ten}` : '';
  const tren = ten ? ` trên ${ten}` : '';
  if (dauTien || kieu === 'depart') return `Bắt đầu đi${tren || ''}`.trim();
  if (kieu === 'arrive') return huong === 'sang trái' ? 'Đã tới nơi, điểm đến bên trái' : huong === 'sang phải' ? 'Đã tới nơi, điểm đến bên phải' : 'Đã tới nơi';
  if (kieu === 'roundabout' || kieu === 'rotary') {
    const lo = Number(m.exit || 0);
    return `Vào vòng xuyến, ra lối thứ ${lo || 1}${vao}`;
  }
  if (kieu === 'merge') return `Nhập làn${vao || ' đường'}`;
  if (kieu === 'on ramp') return `Đi vào đường nhánh${vao}`;
  if (kieu === 'off ramp') return `Ra khỏi đường nhánh${vao}`;
  if (kieu === 'fork') return `Tới ngã ba, đi ${huong || 'thẳng'}${vao}`;
  if (kieu === 'end of road') return `Hết đường, rẽ ${huong || 'theo hướng chỉ dẫn'}${vao}`;
  if (kieu === 'continue' || kieu === 'new name') return huong && huong !== 'đi thẳng' ? `Đi ${huong}${vao}` : `Đi thẳng${tren}`;
  if (kieu === 'turn') return `Rẽ ${huong || 'theo hướng chỉ dẫn'}${vao}`;
  return `${huong ? 'Đi ' + huong : 'Đi tiếp'}${vao}`.trim();
}

// Tên gọi ngắn của tuyến: lấy 2 con đường DÀI NHẤT mà tuyến đi qua (giống Google ghi "qua QL1A").
function tomTat(legs: any[]): string {
  const doDai = new Map<string, number>();
  for (const leg of legs || []) for (const s of leg?.steps || []) {
    const ten = String(s?.name || '').trim();
    if (!ten) continue;
    doDai.set(ten, (doDai.get(ten) || 0) + Number(s?.distance || 0));
  }
  const top = [...doDai.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t]) => t);
  return top.join(' và ');
}

async function hoiMayTimDuong(url: string): Promise<any | null> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'CamLamLand/1.0 (ban do quy hoach Cam Lam)' }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return null;
    const j: any = await r.json();
    return j?.code === 'Ok' && Array.isArray(j.routes) && j.routes.length ? j : null;
  } catch { return null; }
}


// Đổi 1 tuyến thô của OSRM thành dạng gọn cho web dùng.
function chuanHoa(r: any, i: number, heSo: number) {
  const legs: any[] = r.legs || [];
  const chang: any[] = [];
  legs.forEach((leg: any, li: number) => {
    (leg.steps || []).forEach((s: any, si: number) => {
      const kieu = String(s?.maneuver?.type || '');
      // Tuyến đi vòng qua điểm phụ bị OSRM cắt thành nhiều chặng → giữa đường có "Đã tới nơi" rồi
      // "Bắt đầu đi" rất vô duyên. Bỏ mấy câu đó đi, chỉ giữ ở đầu và cuối thật.
      if (kieu === 'arrive' && li !== legs.length - 1) return;
      if (kieu === 'depart' && li !== 0) return;
      chang.push({
        loiDan: loiDan(s, li === 0 && si === 0),
        duong: String(s.name || ''),
        khoangCach: Math.round(Number(s.distance) || 0),
        thoiGian: Math.round((Number(s.duration) || 0) * heSo),
        diem: s?.maneuver?.location || null,
      });
    });
  });
  return {
    id: i,
    khoangCach: Math.round(Number(r.distance) || 0),                 // mét
    thoiGian: Math.round((Number(r.duration) || 0) * heSo),          // giây
    tomTat: tomTat(legs) || 'Tuyến ' + (i + 1),
    hinh: r.geometry,                                                // GeoJSON LineString để vẽ lên bản đồ
    chang: chang.slice(0, 120),                                      // chặn danh sách quá dài cho nhẹ máy
  };
}

// "Vân tay" của một tuyến: gom các điểm về ô lưới ~100m. Hai tuyến chung nhiều ô nghĩa là đi gần
// trùng nhau → không đáng gọi là phương án khác.
function vanTay(r: any): Set<string> {
  const out = new Set<string>();
  for (const c of (r?.geometry?.coordinates || []) as number[][]) out.add(`${c[0].toFixed(3)},${c[1].toFixed(3)}`);
  return out;
}
function giongNhau(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 1;
  let chung = 0;
  for (const k of a) if (b.has(k)) chung++;
  return chung / Math.min(a.size, b.size);
}

// Bám một toạ độ bất kỳ vào con đường gần nhất (không bám thì OSRM hay trả lỗi hoặc đi lối kỳ quặc).
async function bamDuong(profile: string, lng: number, lat: number): Promise<[number, number] | null> {
  for (const may of MAY_TIM_DUONG) {
    const goc = may.url(profile, '').replace(/\/route\/v1\/.*$/, '');
    try {
      const r = await fetch(`${goc}/nearest/v1/${profile}/${lng},${lat}?number=1`, { headers: { 'User-Agent': 'CamLamLand/1.0' }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      const j: any = await r.json();
      const loc = j?.waypoints?.[0]?.location;
      if (Array.isArray(loc) && loc.length === 2) return [loc[0], loc[1]];
    } catch { /* thử máy sau */ }
  }
  return null;
}


// Khoảng cách thô giữa 2 toạ độ (mét) — đủ chính xác để so hơn kém.
function khoangCach(a: number[], b: number[]): number {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toR, dLng = (b[0] - a[0]) * toR;
  const la = (a[1] + b[1]) / 2 * toR;
  const x = dLng * Math.cos(la), y = dLat;
  return Math.sqrt(x * x + y * y) * R;
}

/**
 * TUYẾN CÓ ĐOẠN "ĐI RA RỒI QUAY LẠI" KHÔNG?
 * Lối tự dò bị ÉP đi qua một điểm cố định, nên nếu điểm đó nằm trên núi thì tuyến phải leo lên tận
 * đó rồi quay xuống mới đi tiếp — đoạn leo núi đó hoàn toàn thừa. Nhận ra nó bằng cách đi dọc tuyến
 * và đo khoảng cách tới đích: đường tử tế thì khoảng cách này giảm dần; đường vòng vo thì có lúc
 * TĂNG VỌT lên rồi mới giảm lại.
 */
function coDoanVongVo(r: any, cuoi: number[]): boolean {
  const c: number[][] = r?.geometry?.coordinates || [];
  if (c.length < 10) return false;
  const thang = khoangCach(c[0], cuoi) || 1;
  let ganNhat = Infinity, viVoNhat = 0;
  for (let i = 0; i < c.length; i += Math.max(1, Math.floor(c.length / 120))) {
    const d = khoangCach(c[i], cuoi);
    if (d < ganNhat) ganNhat = d;
    else viVoNhat = Math.max(viVoNhat, d - ganNhat);   // đã tiến gần rồi lại lùi ra xa bấy nhiêu mét
  }
  return viVoNhat > thang * 0.18;   // lùi ra xa quá 18% quãng đường chim bay → chắc chắn có khúc thừa
}

/**
 * LÀM SẠCH LỐI TỰ DÒ.
 * Thay vì giữ nguyên tuyến bị ép qua điểm lệch (hay dính khúc leo núi thừa), lấy một điểm NẰM NGAY
 * TRÊN tuyến đó — chỗ giữa đường — rồi hỏi lại máy tìm đường: đi từ A qua chỗ đó tới B thế nào là
 * hợp lý nhất. Máy sẽ tự bỏ mấy khúc vòng vo, chỉ giữ đúng con đường chính (vd đường ven biển).
 */
async function lamSachTuyen(profile: string, dau: string, cuoi: string, r: any): Promise<any> {
  const c: number[][] = r?.geometry?.coordinates || [];
  if (c.length < 10) return r;
  const giua = c[Math.floor(c.length / 2)];
  const bam = await bamDuong(profile, giua[0], giua[1]);
  const q = bam || [giua[0], giua[1]];
  const url = `/route/v1/${profile}/${dau};${q[0]},${q[1]};${cuoi}?steps=true&overview=full&geometries=geojson`;
  for (const may of MAY_TIM_DUONG) {
    const g = may.url(profile, '').replace(/\/route\/v1\/.*$/, '');
    const j = await hoiMayTimDuong(g + url);
    const moi = j?.routes?.[0];
    // Chỉ nhận bản "đã dọn" nếu nó thật sự gọn hơn (ngắn hơn hoặc bằng) — không thì giữ bản cũ.
    if (moi && (Number(moi.distance) || 0) <= (Number(r.distance) || 0) * 1.02) return moi;
  }
  return r;
}

/**
 * TỰ TÌM THÊM PHƯƠNG ÁN ĐI KHÁC.
 * Cách làm (giống lối "ép đi qua điểm phụ" mà các web bản đồ hay dùng khi mạng đường thưa):
 *   1. Lấy tuyến chính, chấm vài điểm dọc đường (khoảng 1/3 và 2/3 quãng đường);
 *   2. Đẩy điểm đó lệch sang trái / sang phải vài trăm mét, rồi bám vào con đường gần nhất;
 *   3. Bắt tuyến phải đi vòng qua điểm ấy → ra một lối khác;
 *   4. Chỉ giữ lối nào KHÁC tuyến chính đủ nhiều và KHÔNG vòng vo quá 70%.
 */
async function themPhuongAn(profile: string, diem: number[][], chinh: any, canThem: number): Promise<any[]> {
  if (!chinh || canThem <= 0) return [];
  const toaDo: number[][] = chinh?.geometry?.coordinates || [];
  if (toaDo.length < 20) return [];
  const dai = Number(chinh.distance) || 0;
  // Lệch bao nhiêu: quãng ngắn thì lệch ít, quãng dài lệch nhiều — nhưng luôn trong khoảng 300m–1,5km.
  // ══ DÒ RỘNG HẲN RA ══
  // Trước đây chỉ đẩy lệch tối đa 1,5 km nên không bao giờ với tới ĐƯỜNG VEN BIỂN — mà ở Khánh Hoà
  // đường ven biển (Nguyễn Tất Thành, Trần Phú…) cách Quốc lộ 1 tới 5–10 km, lại là tuyến đẹp nhất
  // để quay video. Giờ khoảng lệch tính theo chiều dài chuyến đi: đi 38 km thì dò lệch tới ~9 km.
  const lechCoBan = Math.max(400, Math.min(9000, dai * 0.15));
  const ungVien: { lng: number; lat: number }[] = [];
  // 3 chỗ dọc tuyến × 2 phía × 3 mức lệch (gần · vừa · rất xa) = 18 hướng dò, hỏi song song nên vẫn
  // nhanh, và kết quả nhớ 10 phút nên lần sau bấm lại là ra ngay.
  for (const tyLe of [0.3, 0.5, 0.7]) {
    for (const nhan of [0.6, 1.4, 2.6]) {
      const lechM = lechCoBan * nhan;
      const i = Math.floor(toaDo.length * tyLe);
      const a = toaDo[i], b = toaDo[Math.min(toaDo.length - 1, i + 3)];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const d = Math.hypot(dx, dy);
      if (!d) continue;
      const latR = (a[1] * Math.PI) / 180;
      // Vector vuông góc với hướng đi, đổi từ mét sang độ.
      const nx = (-dy / d) * (lechM / (111320 * Math.cos(latR) || 1e-6));
      const ny = (dx / d) * (lechM / 110540);
      ungVien.push({ lng: a[0] + nx, lat: a[1] + ny }, { lng: a[0] - nx, lat: a[1] - ny });
    }
  }

  const dau = `${diem[0][0]},${diem[0][1]}`, cuoi = `${diem[diem.length - 1][0]},${diem[diem.length - 1][1]}`;
  const vtChinh = vanTay(chinh);
  const ket: any[] = [];
  const daCo: Set<string>[] = [vtChinh];

  // Hỏi cả 4 ứng viên cùng lúc cho nhanh (mỗi ứng viên = bám đường + hỏi tuyến).
  const thu = await Promise.all(ungVien.map(async (v) => {
    const bam = await bamDuong(profile, v.lng, v.lat);
    if (!bam) return null;
    const url = `/route/v1/${profile}/${dau};${bam[0]},${bam[1]};${cuoi}?steps=true&overview=full&geometries=geojson`;
    for (const may of MAY_TIM_DUONG) {
      const g = may.url(profile, '').replace(/\/route\/v1\/.*$/, '');
      const j = await hoiMayTimDuong(g + url);
      if (j) return j.routes[0];
    }
    return null;
  }));

  // Ưu tiên giữ tuyến KHÁC tuyến chính nhiều nhất (khác biệt rõ thì người dùng mới thấy đáng chọn).
  thu.sort((a: any, b: any) => (a && b ? giongNhau(vanTay(a), vtChinh) - giongNhau(vanTay(b), vtChinh) : 0));
  const gioChinh = Number(chinh.duration) || 1;
  for (const r of thu) {
    if (!r || ket.length >= canThem) continue;
    // ══ LỌC THEO TỐC ĐỘ, KHÔNG PHẢI THEO THỜI GIAN ══
    // Lần trước tôi chặn "đi lâu hơn 35%" — chặn được lối leo núi thật, nhưng chặn nhầm luôn ĐƯỜNG
    // VEN BIỂN (qua Đèo Cù Hin đi lâu hơn Quốc lộ 1 mà vẫn là đường đẹp, người ta đi suốt).
    // Cách phân biệt đúng là nhìn TỐC ĐỘ TRUNG BÌNH: đường ven biển vẫn chạy 50–60 km/h, còn lối
    // leo đèo vòng vèo qua đường mòn thì tụt xuống dưới 30 km/h. Vậy chỉ loại lối chạy quá chậm.
    const vTb = ((Number(r.distance) || 0) / Math.max(1, Number(r.duration) || 1)) * 3.6;   // km/h
    if (vTb < 30) continue;                                    // dưới 30 km/h → đường mòn / leo núi, bỏ
    if ((Number(r.duration) || 0) > gioChinh * 1.9) continue;   // lâu gấp đôi thì cũng thôi
    if ((Number(r.distance) || 0) > (dai || 1) * 1.8) continue; // vòng vo quá cũng thôi
    // Dọn khúc thừa (leo lên núi rồi quay xuống) rồi mới xét tiếp.
    let rr2 = await lamSachTuyen(profile, dau, cuoi, r);
    if (coDoanVongVo(rr2, diem[diem.length - 1])) {
      rr2 = await lamSachTuyen(profile, dau, cuoi, rr2);          // thử dọn thêm một lượt nữa
      if (coDoanVongVo(rr2, diem[diem.length - 1])) continue;     // vẫn vòng vo → bỏ hẳn lối này
    }
    const vt = vanTay(rr2);
    if (daCo.some((x) => giongNhau(vt, x) > 0.85)) continue;             // gần trùng tuyến đã có
    daCo.push(vt);
    ket.push(rr2);
  }
  return ket;
}


// ══════════════════════════════════════════════════════════════════════════════════════
// MÁY TÌM ĐƯỜNG THỨ HAI: VALHALLA (cũng miễn phí, cũng chạy trên dữ liệu OpenStreetMap)
// Vì sao cần hai máy? Mỗi máy có cách chấm điểm đường khác nhau: OSRM chuộng đường to chạy nhanh,
// Valhalla cân nhắc cả loại đường, khúc cua, đèo dốc — nên hay tìm ra lối mà OSRM bỏ sót (đúng kiểu
// đường ven biển). Hỏi cả hai rồi gộp lại thì bộ lối đi gần với Google hơn hẳn.
// Valhalla còn có riêng chế độ XE MÁY — hợp Việt Nam hơn là mượn tạm chế độ ô tô.
// ══════════════════════════════════════════════════════════════════════════════════════
const VALHALLA = 'https://valhalla1.openstreetmap.de/route';
const COSTING: Record<string, string> = { car: 'auto', motorbike: 'motorcycle', bike: 'bicycle', foot: 'pedestrian' };

// Valhalla trả hình tuyến ở dạng chuỗi nén — giải ra thành danh sách toạ độ.
function giaiNenHinh(chuoi: string, doChinhXac = 6): number[][] {
  const heSo = Math.pow(10, doChinhXac);
  const ra: number[][] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < chuoi.length) {
    let b: number, dich = 0, ket = 0;
    do { b = chuoi.charCodeAt(i++) - 63; ket |= (b & 0x1f) << dich; dich += 5; } while (b >= 0x20);
    lat += (ket & 1) ? ~(ket >> 1) : (ket >> 1);
    dich = 0; ket = 0;
    do { b = chuoi.charCodeAt(i++) - 63; ket |= (b & 0x1f) << dich; dich += 5; } while (b >= 0x20);
    lng += (ket & 1) ? ~(ket >> 1) : (ket >> 1);
    ra.push([lng / heSo, lat / heSo]);
  }
  return ra;
}

// Số hiệu động tác của Valhalla → cách gọi giống OSRM, để dùng chung bộ dịch tiếng Việt phía trên.
const DONG_TAC: Record<number, { type: string; modifier?: string }> = {
  1: { type: 'depart' }, 2: { type: 'depart' }, 3: { type: 'depart' },
  4: { type: 'arrive' }, 5: { type: 'arrive', modifier: 'right' }, 6: { type: 'arrive', modifier: 'left' },
  7: { type: 'new name' }, 8: { type: 'continue', modifier: 'straight' },
  9: { type: 'turn', modifier: 'slight right' }, 10: { type: 'turn', modifier: 'right' }, 11: { type: 'turn', modifier: 'sharp right' },
  12: { type: 'turn', modifier: 'uturn' }, 13: { type: 'turn', modifier: 'uturn' },
  14: { type: 'turn', modifier: 'sharp left' }, 15: { type: 'turn', modifier: 'left' }, 16: { type: 'turn', modifier: 'slight left' },
  17: { type: 'on ramp', modifier: 'straight' }, 18: { type: 'on ramp', modifier: 'right' }, 19: { type: 'on ramp', modifier: 'left' },
  20: { type: 'off ramp', modifier: 'right' }, 21: { type: 'off ramp', modifier: 'left' },
  22: { type: 'fork', modifier: 'straight' }, 23: { type: 'fork', modifier: 'right' }, 24: { type: 'fork', modifier: 'left' },
  25: { type: 'merge' }, 26: { type: 'roundabout' }, 27: { type: 'roundabout' },
};

/** Hỏi Valhalla, trả về danh sách tuyến ở ĐÚNG dạng mà phần còn lại của tệp này đang dùng. */
async function hoiValhalla(mode: string, diem: number[][]): Promise<any[]> {
  try {
    const body = {
      locations: diem.map((p) => ({ lat: p[1], lon: p[0] })),
      costing: COSTING[mode] || 'auto',
      alternates: 2,
      units: 'kilometers',
    };
    const r = await fetch(VALHALLA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'CamLamLand/1.0' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(14000),
    });
    if (!r.ok) return [];
    const j: any = await r.json();
    const cacTrip = [j.trip, ...(j.alternates || []).map((a: any) => a.trip)].filter(Boolean);
    return cacTrip.map((trip: any) => {
      const toaDo: number[][] = [];
      const steps: any[] = [];
      for (const leg of trip.legs || []) {
        const hinh = giaiNenHinh(leg.shape || '');
        toaDo.push(...(toaDo.length ? hinh.slice(1) : hinh));
        for (const m of leg.maneuvers || []) {
          const dt = DONG_TAC[m.type] || { type: 'continue' };
          steps.push({
            name: (m.street_names && m.street_names[0]) || '',
            distance: (m.length || 0) * 1000,
            duration: m.time || 0,
            maneuver: { type: dt.type, modifier: dt.modifier, exit: m.roundabout_exit_count, location: hinh[m.begin_shape_index] || hinh[0] },
          });
        }
      }
      return {
        distance: (trip.summary?.length || 0) * 1000,
        duration: trip.summary?.time || 0,
        geometry: { type: 'LineString', coordinates: toaDo },
        legs: [{ steps }],
      };
    }).filter((x: any) => x.distance > 0 && x.geometry.coordinates.length > 2);
  } catch { return []; }
}

const soHopLe = (v: any) => Number.isFinite(Number(v));
const lamTron5 = (v: number) => Math.round(v * 1e5) / 1e5;   // ~1m — đủ để gộp các lần bấm sát nhau vào 1 lần cache

// GET /api/chi-duong?from=lng,lat&to=lng,lat&mode=car|motorbike|bike|foot&qua=lng,lat (điểm dừng, không bắt buộc)
chiDuongRouter.get('/', async (req, res) => {
  const tach = (s: any) => String(s || '').split(',').map((x) => Number(x.trim()));
  const from = tach(req.query.from), to = tach(req.query.to);
  if (from.length !== 2 || to.length !== 2 || !from.every(soHopLe) || !to.every(soHopLe))
    return res.status(400).json({ error: 'Thiếu điểm đi hoặc điểm đến' });

  const mode = PROFILE[String(req.query.mode)] ? String(req.query.mode) : 'car';
  const profile = PROFILE[mode];

  // Điểm dừng giữa đường (nếu có) — cho phép tối đa 3 điểm để câu hỏi không quá dài.
  const quaDiem: number[][] = String(req.query.qua || '').split(';').filter(Boolean)
    .map(tach).filter((p) => p.length === 2 && p.every(soHopLe)).slice(0, 3);

  const diem = [from, ...quaDiem, to].map((p) => [lamTron5(p[0]), lamTron5(p[1])]);
  const toaDo = diem.map((p) => `${p[0]},${p[1]}`).join(';');

  const key = `chiduong:${mode}:${toaDo}`;
  const sanCo = cached<any>(key);
  if (sanCo) return res.json({ ...sanCo, tuCache: true });

  // alternatives=3: xin tối đa 3 phương án. OSRM có thể trả ít hơn (đường độc đạo thì chỉ có 1).
  const thamSo = `?alternatives=3&steps=true&overview=full&geometries=geojson&continue_straight=false`;
  // Hỏi Valhalla NGAY TỪ ĐẦU, chạy SONG SONG với OSRM. ⚠️ Trước đây ghi chú nói "song song" nhưng
  // code lại chờ OSRM xong mới hỏi Valhalla (tối đa 14 giây) → tuyến 1,7 km mất 11,5 giây (đo 29/9/2026).
  // hoiValhalla tự bắt lỗi và trả [] nên để chạy trước không sợ lỗi lọt ra ngoài.
  const henValhalla = hoiValhalla(mode, diem);
  let goc: any = null, nguon = '';
  for (const may of MAY_TIM_DUONG) {
    goc = await hoiMayTimDuong(may.url(profile, toaDo) + thamSo);
    if (goc) { nguon = may.ten; break; }
  }
  if (!goc) return res.status(503).json({ error: 'Máy tìm đường đang bận, vui lòng thử lại sau ít phút' });

  const heSo = HE_SO_THOI_GIAN[mode] || 1;

  // Nếu máy tìm đường chỉ đưa được 1 phương án (rất hay gặp ở vùng quê ít đường), TỰ tìm thêm:
  // ép tuyến đi vòng qua một điểm nằm lệch sang bên rồi so xem có ra đường khác thật không.
  // ══ GỘP KẾT QUẢ TỪ HAI MÁY TÌM ĐƯỜNG ══
  // Hỏi Valhalla song song (nó có chế độ XE MÁY riêng, và hay tìm ra lối mà OSRM bỏ sót).
  // Gộp lại, bỏ những lối gần trùng nhau, rồi mới xét tới chuyện tự dò thêm.
  const rGoc: any[] = goc.routes.slice();
  const cuaValhalla = await henValhalla;
  const soOsrm = rGoc.length;
  {
    const vanTayDaCo = rGoc.map((r: any) => vanTay(r));
    for (const r of cuaValhalla) {
      const vt = vanTay(r);
      if (vanTayDaCo.some((x) => giongNhau(vt, x) > 0.8)) continue;   // lối này OSRM đã có rồi
      if (coDoanVongVo(r, diem[diem.length - 1])) continue;           // lối vòng vo thì bỏ
      vanTayDaCo.push(vt);
      rGoc.push(r);
    }
  }
  // Vẫn chưa đủ 3 lối thì mới tự dò (ép đi vòng qua điểm lệch) — cách này kém tin cậy nhất nên để sau cùng.
  if (rGoc.length < 3) {
    const them = await themPhuongAn(profile, diem, rGoc[0], 3 - rGoc.length);
    rGoc.push(...them);
  }

  // Ngay cả tuyến của máy tìm đường cũng có khi lòi ra khúc vòng vo — loại luôn (trừ tuyến số 1).
  const dichCuoi = diem[diem.length - 1];
  const rLoc = rGoc.filter((r: any, i: number) => i === 0 || !coDoanVongVo(r, dichCuoi));
  rGoc.length = 0; rGoc.push(...rLoc);
  const soGoc = Math.min(soOsrm + cuaValhalla.length, rGoc.length);   // của hai máy tìm đường thật (OSRM + Valhalla)
  const tuyen = rGoc.slice(0, 3).map((r: any, i: number) => ({ ...chuanHoa(r, i, heSo), goc: i < soGoc }));

  // ══ XẾP HẠNG KIỂU GOOGLE: KHÔNG CHỈ NHÌN MỖI SỐ PHÚT ══
  // Google không phải lúc nào cũng đưa lối nhanh nhất lên đầu — nó cân nhắc cả quãng đường và chất
  // lượng đường. Ở đây chấm điểm: thời gian là chính (100%), cộng thêm phạt nhẹ nếu đi vòng xa hơn,
  // và phạt nặng nếu tốc độ trung bình thấp (đường nhỏ, nhiều khúc cua). Điểm thấp = xếp trên.
  const chamDiem = (t: any) => {
    const phut = t.thoiGian / 60;
    const km = t.khoangCach / 1000;
    const vTb = km / Math.max(0.01, t.thoiGian / 3600);
    const phatVong = km * 0.35;                                  // mỗi km đi thêm ~ nửa phút "khó chịu"
    const phatDuongXau = vTb < 35 ? (35 - vTb) * 1.2 : 0;        // đường chậm thì trừ điểm
    return phut + phatVong + phatDuongXau + (t.goc ? 0 : 6);     // lối tự dò kém tin cậy → +6 điểm
  };
  tuyen.sort((a: any, b: any) => chamDiem(a) - chamDiem(b));
  const ngan = Math.min(...tuyen.map((t: any) => t.khoangCach));
  tuyen.forEach((t: any, i: number) => {
    t.id = i;
    t.nhan = i === 0 ? 'Nhanh nhất' : (t.khoangCach === ngan ? 'Ngắn nhất' : 'Tuyến khác');
  });

  const ketQua = { mode, nguon, tuyen };
  cachePut(key, ketQua, 10 * 60 * 1000);   // giữ 10 phút: đường sá không đổi trong chốc lát
  res.set('Cache-Control', 'public, max-age=600');
  res.json(ketQua);
});
