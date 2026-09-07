// TẢI TRƯỚC Ô ẢNH BẢN ĐỒ (chống hiện tượng "bản đồ trắng" khi kéo/zoom).
//
// VÌ SAO BẢN ĐỒ HAY TRẮNG?
//   Bản đồ ghép từ hàng trăm ô ảnh nhỏ 256×256. MapLibre chỉ bắt đầu tải ô ảnh KHI ô đó đã lọt vào
//   màn hình. Mạng chậm 1 nhịp là người xem thấy ô trắng rồi ảnh mới hiện ra.
//
// CÁCH CHỮA Ở ĐÂY (học từ Google Maps + thảo luận chính thức của MapLibre #116):
//   1. Đoán trước người dùng sẽ kéo về đâu: đo vận tốc kéo bản đồ, dịch khung nhìn theo hướng đó
//      ~0,7 giây rồi tải sẵn ô ảnh của khung tương lai.
//   2. Tải luôn một VÀNH ĐAI ô ảnh bao quanh màn hình → kéo nhẹ là đã có ảnh sẵn.
//   3. Đang phóng to thì tải trước cả mức zoom kế tiếp (và ngược lại khi thu nhỏ).
//   4. Xếp hàng theo thứ tự ưu tiên: ô gần tâm màn hình tải trước, tối đa vài ô cùng lúc để
//      KHÔNG cướp đường truyền của những ô đang thực sự cần hiển thị.
//   5. Máy dùng gói tiết kiệm dữ liệu / mạng 2G thì tự tắt, không tải thừa.
//
// Ảnh tải trước nằm trong bộ nhớ đệm của trình duyệt; lát sau MapLibre xin đúng ảnh đó thì lấy ra
// dùng ngay, không phải chờ mạng → hết trắng.
import type { Map as MlMap } from 'maplibre-gl';
import { taiVaoKho } from './video/tileProtocol';

// ==== Đổi qua lại giữa toạ độ địa lý và số thứ tự ô ảnh (chuẩn Web Mercator, giống Google/OSM) ====
function oX(lng: number, z: number) { return ((lng + 180) / 360) * Math.pow(2, z); }
function oY(lat: number, z: number) {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z);
}

// ==== Mạng có yếu không? Yếu thì thôi, đừng tải thừa cho tốn tiền của người dùng ====
function mangYeu(): boolean {
  const c = (navigator as any)?.connection;
  if (!c) return false;
  if (c.saveData) return true;                                   // người dùng bật "tiết kiệm dữ liệu"
  return ['slow-2g', '2g'].includes(String(c.effectiveType || ''));
}
// CHẾ ĐỘ BAY: lúc dựng video, camera bay theo tuyến nên BIẾT CHẮC sắp tới chỗ nào — tải trước
// càng nhiều càng tốt, không sợ tải thừa. Lúc người dùng kéo bản đồ tay thì ngược lại: tải dè chừng.
let cheDoBay = false;
export function datCheDoBay(bat: boolean) { cheDoBay = bat; }

// Máy khoẻ tải nhiều luồng hơn; điện thoại yếu thì ít lại.
function soLuongCungLuc(): number {
  const c = (navigator as any)?.connection;
  const nhan = (navigator as any)?.hardwareConcurrency || 4;
  if (cheDoBay) return nhan >= 8 ? 8 : 5;   // đang bay: tải khoẻ nhưng KHÔNG dồn hết sức — máy còn phải vẽ hình cho mượt (máy chủ ảnh chạy HTTP/2 nên nhiều luồng vẫn tốt)
  if (String(c?.effectiveType || '') === '3g') return 1;
  return nhan >= 8 ? 3 : 2;     // ít luồng thôi: tải trước là việc PHỤ, không được giành đường với ảnh đang cần hiện
}

// ==== Danh sách ảnh đã tải trước (để không tải lại lần hai) ====
const daTai = new Set<string>();
const GIOI_HAN_NHO = 6000;
function ghiNho(url: string) {
  if (daTai.size > GIOI_HAN_NHO) { let n = 0; for (const k of daTai) { daTai.delete(k); if (++n > GIOI_HAN_NHO / 2) break; } }
  daTai.add(url);
}

// ==== Hàng đợi tải: mỗi lần chỉ vài ảnh chạy song song, ảnh nào gần tâm màn hình thì ưu tiên ====
let hangDoi: { url: string; uuTien: number }[] = [];
let dangChay = 0;
let phienHienTai = 0;

function chayHangDoi(phien: number) {
  const toiDa = soLuongCungLuc();
  while (dangChay < toiDa && hangDoi.length) {
    if (phien !== phienHienTai) { hangDoi = []; return; }          // khung nhìn đã đổi → bỏ việc cũ
    const viec = hangDoi.shift()!;
    dangChay++;
    // Ảnh đi qua đường tải "có thử lại" (địa chỉ bắt đầu bằng cached://) thì KHÔNG tải bằng thẻ ảnh
    // được — phải tải rồi cất vào đúng kho mà bản đồ sẽ đọc, nếu không thì nạp trước thành công cốc.
    if (viec.url.startsWith('cached://')) {
      taiVaoKho(viec.url.slice('cached://'.length)).finally(() => { dangChay--; chayHangDoi(phien); });
      continue;
    }
    const img = new Image();
    // Ảnh nền của Google không cho đọc pixel (CORS) nhưng ta chỉ cần nó nằm sẵn trong bộ nhớ đệm.
    img.decoding = 'async';
    // Lúc kéo bản đồ bằng tay: ưu tiên THẤP, không tranh đường truyền với ảnh đang cần hiện.
    // Lúc bay quay video: ưu tiên CAO — đã biết chắc mấy giây nữa cần đúng những ảnh này,
    // về chậm là lòi ra mấy ô vuông mờ trong video.
    // Cả lúc bay cũng để ưu tiên vừa phải: giành đường truyền quá tay thì ảnh đang cần hiện lại về chậm,
    // máy vừa tải vừa giải mã ảnh dồn dập là rớt khung hình → nhìn giật.
    (img as any).fetchPriority = cheDoBay ? 'auto' : 'low';
    const xong = () => { dangChay--; chayHangDoi(phien); };
    img.onload = xong; img.onerror = xong;
    img.src = viec.url;
  }
}

/** Dừng mọi việc tải trước đang dở — gọi khi người dùng bắt đầu kéo bản đồ, hoặc khi bắt đầu quay video. */
export function dungTaiTruoc() { phienHienTai++; hangDoi = []; }

/**
 * Chờ cho tới khi tải xong hết (hoặc hết giờ chờ). Dùng TRƯỚC khi bay quay video:
 * nạp đủ ảnh rồi mới chạy, để lúc chạy máy không phải làm gì thêm — hình mới mượt.
 */
export function choTaiXong(toiDaMs = 20000): Promise<void> {
  return new Promise((xong) => {
    const t0 = Date.now();
    const ngo = () => {
      if ((!hangDoi.length && dangChay === 0) || Date.now() - t0 > toiDaMs) { xong(); return; }
      setTimeout(ngo, 120);
    };
    ngo();
  });
}

/** Còn bao nhiêu ảnh đang chờ tải (để hiện tiến độ). */
export function conLai(): number { return hangDoi.length + dangChay; }

function xepHang(dsUrl: { url: string; uuTien: number }[]) {
  phienHienTai++;
  const phien = phienHienTai;
  hangDoi = dsUrl.filter((v) => !daTai.has(v.url)).sort((a, b) => a.uuTien - b.uuTien).slice(0, 24);
  hangDoi.forEach((v) => ghiNho(v.url));
  chayHangDoi(phien);
}

// ==== Lấy các "khuôn địa chỉ ảnh" đang thực sự hiển thị trên bản đồ ====
// (nền Google, ảnh quy hoạch qd205… — lớp nào đang bật thì lớp đó được tải trước)
interface NguonAnh { mau: string[]; minzoom: number; maxzoom: number }
// Dò danh sách lớp ảnh khá tốn sức (phải đọc cả bản mô tả bản đồ) mà lớp thì ít khi đổi
// → nhớ lại, 2 giây mới dò lần nữa.
let nhoNguon: { t: number; ds: NguonAnh[] } | null = null;
function layNguonAnh(map: MlMap): NguonAnh[] {
  const gio = Date.now();
  if (nhoNguon && gio - nhoNguon.t < 2000) return nhoNguon.ds;
  const ds = doNguonAnh(map);
  nhoNguon = { t: gio, ds };
  return ds;
}
function doNguonAnh(map: MlMap): NguonAnh[] {
  const out: NguonAnh[] = [];
  let style: any;
  try { style = map.getStyle(); } catch { return out; }
  const layers: any[] = style?.layers || [];
  const sources: any = style?.sources || {};
  const daCo = new Set<string>();
  for (const l of layers) {
    if (l.type !== 'raster') continue;
    if (l.layout?.visibility === 'none') continue;
    const s = sources[l.source];
    if (!s || !Array.isArray(s.tiles) || !s.tiles.length) continue; // dạng pmtiles/url thì bỏ qua (đọc theo range, không tải trước được bằng ảnh)
    const khoa = s.tiles.join('|');
    if (daCo.has(khoa)) continue;
    daCo.add(khoa);
    out.push({ mau: s.tiles, minzoom: s.minzoom ?? 0, maxzoom: s.maxzoom ?? 22 });
  }
  return out;
}

function dienUrl(mau: string[], z: number, x: number, y: number): string {
  const t = mau[(x + y) % mau.length];                              // chia đều cho các máy chủ mt0/mt1/mt2/mt3
  return t.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y))
    .replace('{s}', ['a', 'b', 'c'][(x + y) % 3]).replace(/\{ratio\}/g, '');
}

/** Gom danh sách ảnh cần tải trước cho MỘT khung nhìn ở MỘT mức zoom. */
function omKhung(nguon: NguonAnh[], khung: { w: number; s: number; e: number; n: number }, z: number, vanhDai: number, uuTienGoc: number, ra: { url: string; uuTien: number }[]) {
  const zi = Math.round(z);
  const max = Math.pow(2, zi);
  const x0 = Math.floor(oX(khung.w, zi)) - vanhDai, x1 = Math.floor(oX(khung.e, zi)) + vanhDai;
  const y0 = Math.floor(oY(khung.n, zi)) - vanhDai, y1 = Math.floor(oY(khung.s, zi)) + vanhDai;
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > 220) return;                  // khung quá rộng (zoom xa) → bỏ, tải cũng không kịp
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  for (const ng of nguon) {
    if (zi < ng.minzoom || zi > ng.maxzoom) continue;
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        if (x < 0 || y < 0 || x >= max || y >= max) continue;
        ra.push({ url: dienUrl(ng.mau, zi, x, y), uuTien: uuTienGoc + Math.hypot(x - cx, y - cy) });
      }
    }
  }
}

/**
 * Bật chế độ tải trước cho một bản đồ. Trả về hàm để tắt (gọi khi rời trang).
 */
export function batTaiTruoc(map: MlMap): () => void {
  if (typeof window === 'undefined' || mangYeu()) return () => {};

  let tamTruoc: { lng: number; lat: number; t: number } | null = null;
  let zoomTruoc = map.getZoom();
  let hen: any = null;

  const tinh = () => {
    const nguon = layNguonAnh(map);
    if (!nguon.length) return;
    const b = map.getBounds();
    const khung = { w: b.getWest(), s: b.getSouth(), e: b.getEast(), n: b.getNorth() };
    const z = map.getZoom();
    const tam = map.getCenter();
    const ds: { url: string; uuTien: number }[] = [];

    // (1) Vành đai quanh màn hình hiện tại — việc quan trọng nhất, ưu tiên cao nhất.
    omKhung(nguon, khung, z, 1, 0, ds);

    // (2) Đoán hướng đi tiếp: so tâm bản đồ lần này với lần dừng trước.
    //     Người xem bản đồ hay kéo nhiều nhịp về CÙNG một phía (đi dọc đường, dò dần lên/xuống)
    //     → cứ tải sẵn thêm đúng một khung hình nữa về phía đó là gần như lúc nào cũng trúng.
    const gio = Date.now();
    if (tamTruoc) {
      const dt = gio - tamTruoc.t;
      if (dt < 6000) {                                              // hai nhịp kéo còn liền mạch
        const rong = khung.e - khung.w, cao = khung.n - khung.s;
        let dx = tam.lng - tamTruoc.lng, dy = tam.lat - tamTruoc.lat;
        if (Math.abs(dx) > rong * 0.08 || Math.abs(dy) > cao * 0.08) { // có kéo thật sự mới đoán
          dx = Math.max(-rong, Math.min(rong, dx));                  // không đoán xa quá 1 khung hình
          dy = Math.max(-cao, Math.min(cao, dy));
          omKhung(nguon, { w: khung.w + dx, e: khung.e + dx, s: khung.s + dy, n: khung.n + dy }, z, 0, 100, ds);
        }
      }
    }
    tamTruoc = { lng: tam.lng, lat: tam.lat, t: gio };

    // (3) Đang phóng to → tải trước mức zoom sâu hơn (vùng giữa màn hình).
    //     Đang thu nhỏ → tải trước mức zoom nông hơn.
    const dz = z - zoomTruoc; zoomTruoc = z;
    if (Math.abs(dz) > 0.05) {
      const co = dz > 0 ? 0.5 : 1;                                  // phóng to thì chỉ cần nửa khung giữa
      const cx = (khung.w + khung.e) / 2, cy = (khung.s + khung.n) / 2;
      const rw = ((khung.e - khung.w) / 2) * co, rh = ((khung.n - khung.s) / 2) * co;
      omKhung(nguon, { w: cx - rw, e: cx + rw, s: cy - rh, n: cy + rh }, z + (dz > 0 ? 1 : -1), 0, 200, ds);
    }

    if (ds.length) xepHang(ds);
  };

  // ══ QUY TẮC VÀNG: TUYỆT ĐỐI KHÔNG LÀM GÌ TRONG LÚC NGƯỜI DÙNG ĐANG KÉO BẢN ĐỒ ══
  // Bản trước tính toán + tải ảnh ngay giữa lúc kéo → vừa chiếm sức máy vừa chiếm đường truyền của
  // chính mấy ô ảnh đang cần hiện, nên bản đồ kéo bị GIẬT. Giờ đổi lại:
  //   · vừa chạm tay vào bản đồ  → DỪNG HẲN mọi việc tải trước, trả toàn bộ sức máy cho việc vẽ;
  //   · buông tay, bản đồ đứng yên 0,35 giây → lúc đó mới tính và tải trước, mà còn đợi máy rảnh mới làm.
  // Vẫn đoán được hướng vì so tâm bản đồ giữa hai lần dừng liên tiếp.
  const batDauKeo = () => { if (hen) { clearTimeout(hen); hen = null; } dungTaiTruoc(); };
  const ric2: any = (window as any).requestIdleCallback || ((f: any) => setTimeout(f, 60));
  const keoXong = () => {
    if (hen) clearTimeout(hen);
    hen = setTimeout(() => { hen = null; ric2(() => tinh(), { timeout: 900 }); }, 350);
  };

  map.on('movestart', batDauKeo);
  map.on('zoomstart', batDauKeo);
  map.on('moveend', keoXong);
  map.on('zoomend', keoXong);

  // Lúc máy rảnh sau khi mở bản đồ: tải sẵn vùng rộng quanh chỗ đang xem để lần kéo đầu tiên đã mượt.
  const ric: any = (window as any).requestIdleCallback || ((f: any) => setTimeout(f, 1200));
  const idle = ric(() => {
    const nguon = layNguonAnh(map);
    if (!nguon.length) return;
    const b = map.getBounds();
    omKhungRong(nguon, { w: b.getWest(), s: b.getSouth(), e: b.getEast(), n: b.getNorth() }, map.getZoom());
  }, { timeout: 3000 });

  function omKhungRong(nguon: NguonAnh[], khung: any, z: number) {
    const ds: { url: string; uuTien: number }[] = [];
    omKhung(nguon, khung, Math.max(0, z - 1), 2, 300, ds);          // mức zoom nông hơn: ít ảnh mà phủ rộng
    if (ds.length) xepHang(ds);
  }

  return () => {
    map.off('movestart', batDauKeo); map.off('zoomstart', batDauKeo);
    map.off('moveend', keoXong); map.off('zoomend', keoXong);
    if (hen) clearTimeout(hen);
    const cic: any = (window as any).cancelIdleCallback; if (cic) try { cic(idle); } catch {}
    phienHienTai++; hangDoi = [];
  };
}

/**
 * NẠP SẴN ẢNH QUANH MỘT ĐIỂM — dùng cho video: trong lúc drone đang bay, gọi hàm này với vị trí
 * mà camera SẮP tới vài giây nữa, thế là tới nơi ảnh đã nằm sẵn trong máy, không còn mảng trắng.
 * banKinh = 1 nghĩa là lấy ô ảnh chứa điểm đó và 8 ô xung quanh.
 */
export function napTruocQuanhDiem(map: MlMap, lng: number, lat: number, zoom: number, banKinh = 1, soAnh = 12) {
  if (typeof window === 'undefined' || mangYeu()) return;
  const nguon = layNguonAnh(map);
  if (!nguon.length) return;
  const zi = Math.round(zoom);
  const max = Math.pow(2, zi);
  const x0 = Math.floor(oX(lng, zi)), y0 = Math.floor(oY(lat, zi));
  const ds: { url: string; uuTien: number }[] = [];
  for (const ng of nguon) {
    if (zi < ng.minzoom || zi > ng.maxzoom) continue;
    for (let x = x0 - banKinh; x <= x0 + banKinh; x++)
      for (let y = y0 - banKinh; y <= y0 + banKinh; y++) {
        if (x < 0 || y < 0 || x >= max || y >= max) continue;
        ds.push({ url: dienUrl(ng.mau, zi, x, y), uuTien: Math.hypot(x - x0, y - y0) });
      }
  }
  // Không xoá hàng đợi cũ (video gọi liên tục) — chỉ thêm việc mới vào, tối đa vài ảnh một lượt.
  const moi = ds.filter((v) => !daTai.has(v.url)).sort((a, b) => a.uuTien - b.uuTien).slice(0, soAnh);
  if (!moi.length) return;
  moi.forEach((v) => ghiNho(v.url));
  hangDoi.push(...moi);
  // Lúc nạp trước cho video thì cho hàng đợi dài thoải mái (nạp cả đường bay); lúc thường thì giữ ngắn.
  // Hàng đợi 4.000 ảnh (mỗi ảnh cả trăm KB) là quá tham — chờ tải xong thì bộ nhớ đã chật, trình
  // duyệt báo hết bộ nhớ rồi trắng trang. 900 là đủ phủ trước cả một đoạn đường bay dài.
  const tran = cheDoBay ? 900 : 260;
  if (hangDoi.length > tran) hangDoi.splice(0, hangDoi.length - tran);
  chayHangDoi(phienHienTai);
}

/**
 * NẠP SẴN ẢNH ĐỘ CAO (DEM) — dùng cho cảnh ĐỊA HÌNH 3D.
 * Dựng núi 3D cần một loại ảnh khác hẳn ảnh nền: ảnh ghi độ cao mặt đất. Nếu để tới lúc bay mới tải
 * thì máy vừa phải tải, vừa giải mã, vừa uốn cong ảnh nền theo mặt đất — giật là chắc.
 * Ảnh độ cao rất ít (chỉ tới mức phóng 13, mỗi ô phủ cả vùng rộng) nên nạp trước thoải mái.
 */
export function napTruocDem(mau: string[], lng: number, lat: number, banKinh = 2, cacMuc: number[] = [11, 12, 13]) {
  if (typeof window === 'undefined') return;
  const ds: { url: string; uuTien: number }[] = [];
  for (const zi of cacMuc) {
    const max = Math.pow(2, zi);
    const x0 = Math.floor(oX(lng, zi)), y0 = Math.floor(oY(lat, zi));
    for (let x = x0 - banKinh; x <= x0 + banKinh; x++)
      for (let y = y0 - banKinh; y <= y0 + banKinh; y++) {
        if (x < 0 || y < 0 || x >= max || y >= max) continue;
        ds.push({ url: dienUrl(mau, zi, x, y), uuTien: Math.hypot(x - x0, y - y0) });
      }
  }
  const moi = ds.filter((v) => !daTai.has(v.url));
  if (!moi.length) return;
  moi.forEach((v) => ghiNho(v.url));
  hangDoi.push(...moi);
  chayHangDoi(phienHienTai);
}

/**
 * NẠP SẴN ẢNH CHO CẢ KHUNG HÌNH ĐANG NHÌN + một vành đai bao quanh.
 * Dùng khi quay video: camera nghiêng sâu thì khung hình trải rất rộng, chỉ nạp quanh tâm là
 * bốn mép vẫn trắng. Hàm này phủ đúng vùng bản đồ đang lọt vào khung, cộng thêm vài ô ra ngoài.
 */
export function napTruocKhungNhin(map: MlMap, vanhDai = 1, soAnh = 40) {
  if (typeof window === 'undefined') return;
  const nguon = layNguonAnh(map);
  if (!nguon.length) return;
  let b: any;
  try { b = map.getBounds(); } catch { return; }
  const khung = { w: b.getWest(), s: b.getSouth(), e: b.getEast(), n: b.getNorth() };
  const z = map.getZoom();
  const ds: { url: string; uuTien: number }[] = [];
  omKhung(nguon, khung, z, vanhDai, 0, ds);
  omKhung(nguon, khung, Math.max(8, z - 2), 1, 300, ds);   // thêm ảnh mức thấp cho vùng xa / chân trời
  const moi = ds.filter((v) => !daTai.has(v.url)).sort((a, b2) => a.uuTien - b2.uuTien).slice(0, soAnh);
  if (!moi.length) return;
  moi.forEach((v) => ghiNho(v.url));
  hangDoi.push(...moi);
  const tran2 = cheDoBay ? 4000 : 260;
  if (hangDoi.length > tran2) hangDoi.splice(0, hangDoi.length - tran2);
  chayHangDoi(phienHienTai);
}

/**
 * MÁY NÀY NÊN GIỮ BAO NHIÊU Ô ẢNH BẢN ĐỒ TRONG BỘ NHỚ?
 * Trình duyệt KHÔNG cho biết máy có bao nhiêu GB thật (navigator.deviceMemory bị chặn ở 8 dù máy
 * 16–32GB, còn Safari/Firefox không báo gì). Nên ước lượng bằng ba thứ đo được:
 *   · deviceMemory  — bậc RAM trình duyệt chịu báo (0,25 → 8);
 *   · số nhân CPU   — máy mạnh thường nhiều nhân, đi kèm nhiều RAM;
 *   · trần bộ nhớ JS — Chrome cho biết, máy khoẻ thì trần này cao.
 * Máy càng khoẻ giữ càng nhiều, KHÔNG chặn trần thấp nữa: giữ nhiều ảnh thì bay tuyến dài, chạy đi
 * chạy lại đều không phải tải lại — vừa hết trắng vừa đỡ khựng.
 * @param heSo 1 = công cụ dựng video (ngốn ảnh nhất) · 0,4 = trang bản đồ thường.
 */
export function soOAnhNenGiu(heSo = 1): number {
  if (typeof navigator === 'undefined') return 1200;
  const nv: any = navigator;
  const ram = typeof nv.deviceMemory === 'number' ? nv.deviceMemory : 8;   // không báo → coi như 8GB
  const nhan = typeof nv.hardwareConcurrency === 'number' ? nv.hardwareConcurrency : 8;
  const heapGB = (((performance as any)?.memory?.jsHeapSizeLimit) || 0) / (1024 * 1024 * 1024);
  // Điểm sức máy: RAM + nửa số nhân + phần thưởng nếu trần bộ nhớ JS rộng.
  const diem = Math.min(8, ram) + Math.min(8, nhan / 2) + (heapGB >= 3 ? 3 : heapGB >= 2 ? 1.5 : 0);
  const so = Math.round(diem * 340 * heSo);
  return Math.max(600, Math.min(6000, so));
}
