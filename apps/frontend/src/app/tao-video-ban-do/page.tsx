'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
// TẠO VIDEO BẢN ĐỒ VỆ TINH (dùng tạm — dễ gỡ). Vẽ lô đất + tuyến đường chạy động, bay/zoom camera, chèn chữ & logo,
// quay canvas 1080p (MediaRecorder) → gửi máy chủ đổi MP4. Ảnh vệ tinh: tái dùng lớp Google của web.
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { napTruocQuanhDiem, napTruocKhungNhin, napTruocDem, datCheDoBay, dungTaiTruoc, choTaiXong, conLai, soOAnhNenGiu } from '@/lib/tilePrefetch';
import { timDuong, docKhoangCach, docThoiGian, type Tuyen } from '@/lib/chiDuong';
import 'maplibre-gl/dist/maplibre-gl.css';
import { toast } from '@/lib/toast';
import { MAP } from '@/lib/config';
import { useAuth, laAdmin } from '@/lib/auth';
import { api } from '@/lib/api';
import { themLopBienDao } from '@/lib/bienDao';
import { choMotKhung, type SoKhung } from '@/lib/video/settle';
import { nayAnhDocDuongBay } from '@/lib/video/warm';
import { dangKyTaiAnhCoThuLai, boc } from '@/lib/video/tileProtocol';

const NAVY = '#0A2540', GOLD = '#C8A14B';
// Bảng màu giao diện tối — dùng cho các bảng cài đặt (sang, đỡ chói mắt khi làm việc lâu).
const INK = '#e7eef7';        // chữ chính
const INK2 = '#94a7bd';       // chữ phụ
const CARD = '#101f33';       // nền thẻ
const LINE = '#223c58';       // viền mảnh
const FIELD = '#17293e';      // nền ô nhập
// Các lớp bản đồ Esri (trực tiếp từ trình duyệt — sạch CORS nên QUAY được). Giới hạn ~z18 để tránh ô "no data".
const ESRI = (svc: string) => boc([`https://server.arcgisonline.com/ArcGIS/rest/services/${svc}/MapServer/tile/{z}/{y}/{x}`]);
const SAT = ESRI('World_Imagery');
const LABELS = ESRI('Reference/World_Boundaries_and_Places');
const STREET = ESRI('World_Street_Map');
const DARK = ESRI('Canvas/World_Dark_Gray_Base');
// Dữ liệu ĐỘ CAO mở (AWS Terrain Tiles) — dùng để đổ bóng đồi núi và dựng địa hình 3D.
/**
 * ══ ĐỒNG HỒ CỦA HIỆU ỨNG ══
 * Mọi hiệu ứng động (lô đất thở, sóng radar lan, ghim nhún, chấm xoay) trước đây chạy theo ĐỒNG HỒ
 * THẬT. Xem trực tiếp thì đúng, nhưng lúc render kỹ thì một khung hình mất cả trăm phần nghìn giây
 * để vẽ — nghĩa là một giây VIDEO ngốn mấy giây THẬT. Hiệu ứng cứ theo đồng hồ thật mà chạy nên
 * trong video nó quay nhanh gấp mấy lần, nhìn rối mắt (đúng cảnh chấm tròn ở thửa đất quay như chong chóng).
 * Lúc render kỹ, biến dưới đây giữ GIÂY CỦA VIDEO — hiệu ứng chạy đúng nhịp người xem sẽ thấy.
 */
/**
 * ══ NHỊP CHỜ KHÔNG BỊ BÓP ══
 * Chrome hạ setTimeout của tab đang ẩn xuống còn 1 lần/giây để tiết kiệm pin — vòng render mà dựa
 * vào setTimeout thì chuyển tab một cái là đứng hình. MessageChannel thì không bị hạ: gửi tin cho
 * chính mình, nhận được là chạy tiếp ngay. Nhờ nó, dựng video vẫn chạy đủ tốc độ khi anh làm việc khác.
 */
/**
 * ══ SOI KHUNG HÌNH — HỌC TỪ NGÀNH KIỂM THỬ ẢNH ══
 *
 * Vấn đề gốc rễ suốt mấy hôm nay: mình cứ HỎI bản đồ "vẽ xong chưa?" rồi tin lời nó. Nhưng bản đồ
 * chỉ biết nó đã tải hết ảnh mà nó BIẾT là cần; ảnh vừa xin thêm, ảnh đang giải mã, mặt đất 3D đang
 * dựng lại — nó không kể. Tin lời là chụp phải khung vẽ dở.
 *
 * Cách của các hệ thống chụp ảnh tự động lớn (Percy, Chromatic, Puppeteer): KHÔNG hỏi ai cả. Chụp
 * hai lượt liên tiếp rồi SO ẢNH. Hai lượt giống hệt nhau nghĩa là cảnh đã đứng yên — lúc đó mới lấy.
 * Ảnh còn đang về thì hai lượt chắc chắn khác nhau.
 *
 * Ở đây làm đúng vậy, thêm một bước nữa: đếm xem trong khung còn bao nhiêu phần là MÀU NỀN TRỐNG
 * (chỗ ảnh chưa về). Còn nhiều mảng trống thì dù ảnh có "đứng yên" cũng chưa chụp.
 *
 * Vân tay lấy ở cỡ 48×27 điểm — đủ để phát hiện một ô ảnh còn thiếu, mà đọc thì tốn chưa tới một
 * phần nghìn giây.
 */
const VT_W = 48, VT_H = 27;
let _vtCanvas: HTMLCanvasElement | null = null;
let _vtCtx: CanvasRenderingContext2D | null = null;
// Mở trang kèm ?debugStability=1 thì quay lại cách chờ khung cũ (soi từng điểm ảnh) để đối chứng.
let _soiAnh: boolean | null = null;
function soiBangDiemAnh(): boolean {
  if (_soiAnh === null) {
    try { _soiAnh = new URLSearchParams(window.location.search).get('debugStability') === '1'; } catch { _soiAnh = false; }
  }
  return _soiAnh;
}
function vanTayKhung(src: HTMLCanvasElement): Uint8ClampedArray | null {
  try {
    if (!_vtCanvas) {
      _vtCanvas = document.createElement('canvas');
      _vtCanvas.width = VT_W; _vtCanvas.height = VT_H;
      _vtCtx = _vtCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (!_vtCtx) return null;
    _vtCtx.drawImage(src, 0, 0, VT_W, VT_H);
    return _vtCtx.getImageData(0, 0, VT_W, VT_H).data;
  } catch { return null; }
}
/** Hai khung khác nhau bao nhiêu phần (0 = giống hệt). */
function khacNhauBaoNhieu(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let khac = 0; const n = a.length / 4;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 26) khac++;
  }
  return khac / n;
}
/** Bao nhiêu phần khung còn là màu nền trống (ảnh chưa về)? Nền là xám nhạt #dfe3e8 và dải trời. */
function phanTrong(a: Uint8ClampedArray): number {
  let trong = 0; const n = a.length / 4;
  for (let i = 0; i < a.length; i += 4) {
    const r = a[i], g = a[i + 1], b = a[i + 2];
    // xám nhạt đều màu (nền chờ) — ảnh vệ tinh thật gần như không bao giờ ra màu này
    if (Math.abs(r - 223) < 9 && Math.abs(g - 227) < 9 && Math.abs(b - 232) < 9) trong++;
  }
  return trong / n;
}

/**
 * ══ MÁY ĐO ĐỘ ĐỀU CỦA KHUNG HÌNH ══
 *
 * Video giật thì ai cũng thấy, nhưng "giật ở đâu, giật kiểu gì" thì mắt không nói được. Máy đo này
 * làm đúng việc đó: mỗi khung vẽ xong, nó chụp lại một bản tí hon (48×27 điểm) rồi so với khung
 * trước, ghi lại "khung này khác khung trước bao nhiêu".
 *
 * Một video mượt thì con số đó gần như bằng nhau ở mọi khung — camera đi đều thì hình đổi đều.
 * Hai kiểu hỏng lộ ra ngay:
 *   · ĐỨNG HÌNH — khác quá ít (dưới 15% mức thường): hai khung gần như y hệt, xem thấy khựng.
 *   · NHẢY VỌT  — khác quá nhiều (trên 250% mức thường): hình đổi đột ngột, xem thấy giật một cái.
 * Cặp "đứng hình rồi nhảy vọt" đi liền nhau chính là kiểu "nhảy qua nhảy lại".
 *
 * Chi phí gần như bằng không (chụp bản tí hon từ khung ĐÃ vẽ sẵn, không đụng tới card đồ hoạ),
 * nên cứ bật thường trực. Xong mỗi lần dựng, số liệu in ra ở bảng điều khiển trình duyệt.
 */
const doDeu = {
  truoc: null as Uint8ClampedArray | null,
  lech: [] as number[],
  cho: [] as number[],        // khung này phải chờ bao nhiêu phần nghìn giây mới vẽ xong
  moc: 0,
  bat: false,
  xoa() { this.truoc = null; this.lech = []; this.cho = []; this.moc = 0; },
  ghi(canvas: HTMLCanvasElement) {
    if (!this.bat) return;
    try {
      const vt = vanTayKhung(canvas);
      if (!vt) return;
      if (this.truoc) {
        let t = 0;
        for (let i = 0; i < vt.length; i += 4) t += Math.abs(vt[i] - this.truoc[i]) + Math.abs(vt[i + 1] - this.truoc[i + 1]) + Math.abs(vt[i + 2] - this.truoc[i + 2]);
        this.lech.push(t / ((vt.length / 4) * 3 * 255));
        this.cho.push(this.moc ? Math.round(performance.now() - this.moc) : 0);
      }
      this.truoc = vt;
    } catch { /* đo hỏng thì thôi, không được làm ảnh hưởng việc dựng */ }
  },
  /** Xem lại cả loạt: chỗ nào đứng hình, chỗ nào nhảy vọt, ở giây thứ mấy. */
  tongKet(fps: number) {
    const d = this.lech;
    if (d.length < 8) return null;
    const tb = d.reduce((a, b) => a + b, 0) / d.length;
    if (tb <= 0) return null;
    const dungHinh: number[] = [], nhayVot: number[] = [];
    d.forEach((v, i) => {
      const giay = Math.round(((i + 1) / fps) * 10) / 10;
      if (v < tb * 0.15) dungHinh.push(giay);
      else if (v > tb * 2.5) nhayVot.push(giay);
    });
    // Khung khựng mà lại là khung CHỜ LÂU → lỗi ở khâu chờ vẽ. Khựng mà chờ nhanh → lỗi ở chỗ khác
    // (camera không nhích, hoặc khung bị ghi trùng). Phân biệt được hai thứ này là biết sửa ở đâu.
    const choTB = this.cho.length ? this.cho.reduce((a, b) => a + b, 0) / this.cho.length : 0;
    let khungKhuenLau = 0;
    d.forEach((v, i) => { if (v < tb * 0.15 && (this.cho[i] || 0) > choTB * 1.5) khungKhuenLau++; });
    return { soKhung: d.length + 1, trungBinh: Math.round(tb * 10000) / 10000, dungHinh, nhayVot,
             choTB: Math.round(choTB), khuenDoChoLau: khungKhuenLau };
  },
};

function nhip0(): Promise<void> {
  return new Promise((res) => {
    try {
      const ch = new MessageChannel();
      ch.port1.onmessage = () => { try { ch.port1.close(); } catch { /* ignore */ } res(); };
      ch.port2.postMessage(0);
    } catch { setTimeout(res, 0); }
  });
}
/** Chờ đúng số mili-giây mà không dùng setTimeout (để tab ẩn cũng chờ đúng). */
async function choKhongBiBop(ms: number) {
  const het = Date.now() + ms;
  while (Date.now() < het) await nhip0();
}

/**
 * ══ VÌ SAO PHẢI TẠM DỪNG HIỆU ỨNG LÚC SOI KHUNG ══
 * Cách soi khung mới so hai lượt vẽ liên tiếp: giống nhau thì cảnh đã đứng yên, mới chụp.
 * Nhưng trên bản đồ luôn có mấy thứ NHẤP NHÁY (lô đất thở, sóng radar quét, chấm sáng) — chúng đổi
 * mỗi nhịp, nên hai lượt KHÔNG BAO GIỜ giống nhau. Kết quả: khung nào cũng bị coi là "chưa xong",
 * chờ hết giờ rồi chụp đại — đúng thứ mình đang muốn tránh (733/3600 khung rơi vào cảnh này).
 * Cách chữa: lúc soi thì cho hiệu ứng ĐỨNG YÊN. Soi xong, cho nó nhích đúng một nhịp rồi mới chụp.
 * Hiệu ứng vẫn chạy đủ trong video, mà phép so ảnh lại chính xác.
 */
let _dungHieuUng = false;

let _gioVideo: number | null = null;      // null = đang xem trực tiếp, dùng đồng hồ thật
let _mocVideo: number | null = null;      // mốc nối hai dòng thời gian lại cho liền mạch
function gioHieuUng(): number {
  const thuc = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (_gioVideo === null) { _mocVideo = null; return thuc; }
  // ⚠️ PHẢI NỐI LIỀN HAI DÒNG THỜI GIAN.
  // Các hiệu ứng đều tính theo kiểu "bây giờ trừ lúc bắt đầu". Lúc bắt đầu được ghi từ đồng hồ thật
  // (một con số rất lớn). Nếu đang chạy mà đổi phắt sang giây của video (bắt đầu từ 0) thì hiệu số
  // hoá ra ÂM cả triệu — hiệu ứng nhảy loạn xạ, nhìn như cả khung hình rung lắc.
  // Nên: giữ lại mốc thời gian thật lúc bắt đầu quay, rồi cộng giây video vào đó. Dòng thời gian
  // vẫn liền mạch và luôn tăng, chỉ khác là nó chạy theo nhịp của video.
  if (_mocVideo === null) _mocVideo = thuc;
  return _mocVideo + _gioVideo * 1000;
}

// Ảnh độ cao (dựng núi 3D) đi qua MÁY CHỦ NHÀ thay vì lấy thẳng từ kho bên Mỹ.
// Lý do: bản đồ xin hàng trăm ô một lúc, đường xa nên rớt vài ô — ô nào rớt thì mặt đất chỗ đó phẳng
// lì rồi lúc ô về mới nhô lên, nhìn ra là GIẬT. Qua máy nhà thì ô đã lấy một lần là có sẵn ngay.
const DEM_TILES = [(process.env.NEXT_PUBLIC_API_BASE || '/api') + '/do-cao/tile/{z}/{x}/{y}.png'];

// TÔNG MÀU BẢN ĐỒ — chỉnh thẳng trên ảnh vệ tinh (rực/tương phản/sáng/ngả màu) cho ảnh tươi, bắt mắt hơn.
type Tone = { sat: number; con: number; briMin: number; briMax: number; hue: number };
const TONES: { key: string; name: string; note: string; v: Tone }[] = [
  { key: 'tuoi', name: '🌿 Tươi', note: 'Cây xanh mướt, biển trong — hợp video bán đất', v: { sat: 0.42, con: 0.14, briMin: 0.02, briMax: 1, hue: 4 } },
  { key: 'goc', name: 'Ảnh gốc', note: 'Đúng như ảnh vệ tinh chụp về', v: { sat: 0, con: 0, briMin: 0, briMax: 1, hue: 0 } },
  { key: 'ruc', name: '🔥 Rực rỡ', note: 'Màu đậm nhất, nổi trên điện thoại', v: { sat: 0.68, con: 0.26, briMin: 0.03, briMax: 1, hue: 2 } },
  { key: 'dienanh', name: '🎬 Điện ảnh', note: 'Tương phản cao, tối góc — sang trọng', v: { sat: 0.18, con: 0.34, briMin: 0.06, briMax: 0.94, hue: -4 } },
  { key: 'am', name: '☀️ Nắng ấm', note: 'Ngả vàng, cảm giác nắng đẹp', v: { sat: 0.4, con: 0.12, briMin: 0.04, briMax: 1, hue: 14 } },
  { key: 'bien', name: '🌊 Biển xanh', note: 'Ngả xanh mát, hợp đất ven biển', v: { sat: 0.46, con: 0.16, briMin: 0.02, briMax: 1, hue: -14 } },
  { key: 'sang', name: '💡 Sáng nhẹ', note: 'Sáng đều, chữ dễ đọc', v: { sat: 0.24, con: 0.05, briMin: 0.12, briMax: 1, hue: 0 } },
];
// Ảnh vệ tinh NGUỒN MỞ (Sentinel-2 của châu Âu, bản ghép năm 2024 do EOX phát hành, giấy phép CC BY).
// Không nét bằng Esri nhưng dùng cho video bán hàng thì yên tâm về bản quyền — giống cách MapEffect làm.
const SAT_OPEN = boc(['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg']);

type Mode = 'none' | 'parcel' | 'route' | 'marker' | 'radius' | 'distance' | 'edit' | 'callout' | 'dir' | 'xoaghim' | 'vexe' | 'muiten';
// THẺ CHÚ THÍCH (call out): thẻ chữ đặt cạnh bản đồ, có DÂY NỐI tới đúng điểm (trường học, chợ, biển…)
// kèm khoảng cách tính từ lô đất. dx/dy = độ lệch của thẻ so với điểm neo (đơn vị: độ toạ độ).
type Callout = { id: string; lng: number; lat: number; dx: number; dy: number; label: string; dist: boolean; shape?: string; cat?: string; sub?: string; gia?: string };
// MŨI TÊN CHỈ HƯỚNG — vạch gạch đứt bắn từ LÔ ĐẤT ra một chỗ nổi tiếng, đầu nhọn cắm tới nơi,
// tên chỗ đó in ngay sau mũi. Đây là lối trình bày hay gặp trong video bất động sản:
// nhìn một cái là biết lô nằm giữa, xung quanh có gì, hướng nào.
type Arrow = { id: string; lng: number; lat: number; label: string; col?: string; tcol?: string; kieu?: string; dist?: boolean; icon?: string };
const MT_KIEU: { key: string; name: string; note: string }[] = [
  { key: 'dutdoan', name: 'Gạch đứt', note: 'Vạch đứt quãng chạy dần về phía mũi — kiểu hay thấy nhất' },
  { key: 'lien', name: 'Nét liền', note: 'Một nét đậm liền mạch, gọn và chắc' },
  { key: 'sang', name: 'Nét phát sáng', note: 'Có quầng sáng quanh nét — nổi bật trên ảnh vệ tinh tối' },
];
const MT_MAU: [string, string][] = [['#ffffff', 'Trắng'], ['#C8A14B', 'Vàng'], ['#ff2d95', 'Hồng'], ['#22c55e', 'Xanh lá'], ['#38bdf8', 'Xanh dương'], ['#ff5a2c', 'Cam']];
// Đầu mũi tên vẽ sẵn thành ảnh rồi dán lên bản đồ (xoay theo hướng bay) — nét viền đen mảnh
// để mũi tên không bị chìm khi nền ảnh vệ tinh sáng chói.
function makeArrowHead(col: string): any {
  if (typeof document === 'undefined') return null;
  const S = 64, c = document.createElement('canvas'); c.width = S; c.height = S;
  const x = c.getContext('2d'); if (!x) return null;
  const m = S / 2;
  x.translate(m, m);
  x.beginPath(); x.moveTo(0, -26); x.lineTo(19, 22); x.lineTo(0, 12); x.lineTo(-19, 22); x.closePath();
  x.fillStyle = col; x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 2.4; x.lineJoin = 'round';
  x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 6; x.shadowOffsetY = 2;
  x.fill(); x.shadowColor = 'transparent'; x.stroke();
  return x.getImageData(0, 0, S, S);
}
// Huy hiệu tròn nhỏ gắn ngay dưới đầu mũi tên — cùng màu vạch, biểu tượng tiện ích in trong lòng.
// Nhìn vào là biết chỗ đó là biển, sân bay hay chợ, khỏi phải đọc chữ.
function makeArrowIcon(col: string, icon: string): any {
  if (typeof document === 'undefined') return null;
  const S = 76, c = document.createElement('canvas'); c.width = S; c.height = S;
  const x = c.getContext('2d'); if (!x) return null;
  const m = S / 2;
  x.beginPath(); x.arc(m, m, 29, 0, Math.PI * 2);
  x.fillStyle = col; x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 8; x.shadowOffsetY = 2; x.fill();
  x.shadowColor = 'transparent';
  x.lineWidth = 3.4; x.strokeStyle = 'rgba(255,255,255,.9)'; x.stroke();
  drawGlyph(x, icon, m, m, 17, '#0A2540');
  return x.getImageData(0, 0, S, S);
}
// 8 KIỂU THẺ CHÚ THÍCH (học từ MapEffect, vẽ bằng bản đồ nên vào thẳng video)
const CO_SHAPES: { key: string; name: string; note: string }[] = [
  { key: 'lux', name: 'Sang trọng nét mảnh', note: 'Khung viền mỏng, chữ hoa giãn đều, mỏ neo hình sao' },
  { key: 'luxdash', name: 'Sang trọng nét đứt', note: 'Như trên nhưng dây dẫn là nét đứt mảnh' },
  { key: 'elbow', name: 'Gấp khúc cơ bản', note: 'Dây bẻ góc vuông, gọn gàng' },
  { key: 'underline', name: 'Gạch chân dưới chữ', note: 'Dây chạy tới rồi gạch dưới chữ' },
  { key: 'pill', name: 'Thanh viên thuốc', note: 'Chữ nằm trong viên thuốc bo tròn' },
  { key: 'bracket', name: 'Ngoặc vuông bao chữ', note: 'Hai ngoặc ôm hai bên chữ' },
  { key: 'frame', name: 'Khung ngắm bốn góc', note: 'Bốn góc vuông như khung ngắm' },
  { key: 'dashed', name: 'Nét đứt chạy', note: 'Dây nét đứt chuyển động' },
  { key: 'curve', name: 'Đường cong mềm', note: 'Dây uốn cong mềm mại' },
  { key: 'wave', name: 'Sóng lan tại điểm neo', note: 'Vòng sóng lan ra từ điểm được chỉ' },
  { key: 'stair', name: 'Hai bậc thang', note: 'Dây đi hai bậc vuông góc — gọn khi thẻ nằm chéo xa điểm' },
  { key: 'dotend', name: 'Chấm nhấn ở cuối', note: 'Dây thẳng, đầu dây có chấm tròn to nhấn vào thẻ' },
  // ── Nhóm BẤT ĐỘNG SẢN: mấy khung hay gặp trên tờ rơi bán đất ──
  { key: 'nenvang', name: 'Chữ trên nền vàng', note: 'Nền vàng đặc, chữ xanh đêm — chói mắt nhất, hợp dòng GIÁ' },
  { key: 'haivach', name: 'Hai vạch vàng kẹp chữ', note: 'Hai vạch vàng trên dưới, nền trong — sang và nhẹ' },
  { key: 'gocvang', name: 'Ngoặc góc vàng', note: 'Bốn ngoặc góc mảnh ôm chữ — kiểu tạp chí bất động sản' },
  { key: 'vienday', name: 'Viền dày nổi khối', note: 'Viền trắng dày bao ngoài như biển hiệu — đọc được từ rất xa' },
];
const CO_STYLES: Record<string, { col: string; bg: string; fg: string }> = {
  gold: { col: '#C8A14B', bg: '#0A2540', fg: '#ffd98a' },
  white: { col: '#ffffff', bg: '#12283f', fg: '#ffffff' },
  navy: { col: '#38bdf8', bg: '#08243c', fg: '#dbeafe' },
  red: { col: '#ff3b30', bg: '#3b0a08', fg: '#ffd9d6' },
};
// Ảnh NỀN CO GIÃN cho thẻ chữ: MapLibre kéo giãn phần giữa nên khung luôn ôm khít chữ ở mọi mức phóng.
function calloutBoxImage(shape: string, col: string, bg: string): any {
  if (typeof document === 'undefined') return null;
  // ══ THẺ PHẢI CÓ KHỐI, ĐỪNG PHẲNG ══
  // Bản trước tô một màu phẳng, viền một nét — hình thì đúng nhưng nhìn như miếng giấy dán lên ảnh.
  // Thẻ của mấy app dựng video xịn đẹp hơn nhờ đúng bốn thứ, và cả bốn đều rẻ:
  //   1. BÓNG ĐỔ  — thẻ tách khỏi ảnh nền, mắt thấy nó nổi lên trên
  //   2. NỀN CHUYỂN SẮC (sáng trên, tối dưới) — cho cảm giác khối, như có ánh sáng chiếu từ trên
  //   3. QUẦNG SÁNG quanh viền (chế độ hoà sáng) — viền không còn khô cứng
  //   4. VỆT SÁNG mép trên — như mặt kính, đây là thứ làm nó "sang"
  // Khung vẽ 128 điểm (trước 96) để bóng đổ có chỗ mà không bị cắt cụt.
  const S = 128, c = document.createElement('canvas'); c.width = S; c.height = S;
  const x = c.getContext('2d'); if (!x) return null;
  const line = Math.max(2, Math.round(S * 0.045));
  const LE = Math.round(line * 2.2);              // lề chừa cho bóng đổ
  const trong = S - LE * 2;
  const duong = (r: number) => {
    x.beginPath();
    x.moveTo(LE + r, LE);
    x.arcTo(S - LE, LE, S - LE, S - LE, r); x.arcTo(S - LE, S - LE, LE, S - LE, r);
    x.arcTo(LE, S - LE, LE, LE, r); x.arcTo(LE, LE, S - LE, LE, r);
    x.closePath();
  };
  const nenCoKhoi = (r: number) => {
    x.save(); x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = line * 2.4; x.shadowOffsetY = line * 0.9;
    x.fillStyle = bg; duong(r); x.fill(); x.restore();
    x.save(); duong(r); x.clip();
    const g = x.createLinearGradient(0, LE, 0, S - LE);
    g.addColorStop(0, 'rgba(255,255,255,.17)'); g.addColorStop(0.45, 'rgba(255,255,255,.03)'); g.addColorStop(1, 'rgba(0,0,0,.22)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    const vet = x.createLinearGradient(0, LE, 0, LE + trong * 0.42);
    vet.addColorStop(0, 'rgba(255,255,255,.20)'); vet.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = vet; x.fillRect(0, LE, S, trong * 0.42);
    x.restore();
  };
  const vienSang = (r: number, dam = 1) => {
    x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.32 * dam;
    x.strokeStyle = col; x.lineWidth = line * 1.7; duong(r); x.stroke(); x.restore();
    x.strokeStyle = col; x.lineWidth = line * 0.62; duong(r); x.stroke();
  };

  const R = Math.round(trong * 0.26);
  if (shape === 'pill') { const r = trong * 0.5; nenCoKhoi(r); vienSang(r); }
  else if (shape === 'frame') {                       // bốn góc như khung ngắm
    nenCoKhoi(R * 0.35);
    const L = trong * 0.3;
    x.save(); x.strokeStyle = col; x.lineWidth = line * 0.8; x.lineCap = 'round';
    x.beginPath();
    ([[LE, LE, 1, 1], [S - LE, LE, -1, 1], [LE, S - LE, 1, -1], [S - LE, S - LE, -1, -1]] as [number, number, number, number][])
      .forEach(([cx, cy, sx, sy]) => { x.moveTo(cx + sx * L, cy); x.lineTo(cx, cy); x.lineTo(cx, cy + sy * L); });
    x.stroke(); x.restore();
  } else if (shape === 'bracket') {                   // ngoặc vuông hai bên
    nenCoKhoi(R * 0.35);
    const L = trong * 0.34;
    x.save(); x.strokeStyle = col; x.lineWidth = line * 0.8; x.lineCap = 'round';
    x.beginPath();
    x.moveTo(LE + L, LE); x.lineTo(LE, LE); x.lineTo(LE, S - LE); x.lineTo(LE + L, S - LE);
    x.moveTo(S - LE - L, LE); x.lineTo(S - LE, LE); x.lineTo(S - LE, S - LE); x.lineTo(S - LE - L, S - LE);
    x.stroke(); x.restore();
  } else if (shape === 'underline') {                 // chỉ gạch chân
    nenCoKhoi(R * 0.2);
    x.save(); x.shadowColor = col; x.shadowBlur = line * 1.6;
    x.fillStyle = col; x.fillRect(LE, S - LE - line * 1.4, trong, line * 1.2); x.restore();
  } else if (shape === 'lux') {                       // khung viền MỎNG, nền mờ nhẹ cho chữ nổi
    const r = R * 0.3;
    x.save(); x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = line * 2; x.shadowOffsetY = line * 0.7;
    x.globalAlpha = 0.62; x.fillStyle = bg; duong(r); x.fill(); x.restore();
    x.save(); duong(r); x.clip();
    const vet = x.createLinearGradient(0, LE, 0, LE + trong * 0.5);
    vet.addColorStop(0, 'rgba(255,255,255,.14)'); vet.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = vet; x.fillRect(0, LE, S, trong * 0.5); x.restore();
    x.strokeStyle = col; x.lineWidth = Math.max(1.6, line * 0.42); duong(r); x.stroke();
  } else if (shape === 'nenvang') {                   // nền đặc màu nhấn, chữ tối
    nenCoKhoi(R * 0.4);
    x.save(); duong(R * 0.4); x.clip();
    x.fillStyle = col; x.globalAlpha = 0.92; x.fillRect(0, 0, S, S); x.globalAlpha = 1;
    const vet = x.createLinearGradient(0, LE, 0, LE + trong * 0.5);
    vet.addColorStop(0, 'rgba(255,255,255,.42)'); vet.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = vet; x.fillRect(0, LE, S, trong * 0.5); x.restore();
    x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = line * 0.5; duong(R * 0.4); x.stroke();
  } else if (shape === 'haivach') {                   // hai vạch kẹp trên dưới, giữa để trong
    x.save(); x.shadowColor = 'rgba(0,0,0,.4)'; x.shadowBlur = line * 1.6;
    x.fillStyle = col;
    x.fillRect(LE, LE, trong, line * 1.1);
    x.fillRect(LE, S - LE - line * 1.1, trong, line * 1.1);
    x.restore();
    x.save(); x.globalAlpha = 0.42; x.fillStyle = bg;
    x.fillRect(LE, LE + line * 1.1, trong, trong - line * 2.2); x.restore();
  } else if (shape === 'gocvang') {                   // bốn ngoặc góc mảnh
    nenCoKhoi(R * 0.25);
    const L2 = trong * 0.26;
    x.save(); x.strokeStyle = col; x.lineWidth = line * 0.62; x.lineCap = 'square';
    x.beginPath();
    ([[LE, LE, 1, 1], [S - LE, LE, -1, 1], [LE, S - LE, 1, -1], [S - LE, S - LE, -1, -1]] as [number, number, number, number][])
      .forEach(([px, py, sx, sy]) => { x.moveTo(px + sx * L2, py); x.lineTo(px, py); x.lineTo(px, py + sy * L2); });
    x.stroke(); x.restore();
  } else if (shape === 'vienday') {                   // viền trắng dày kiểu biển hiệu
    nenCoKhoi(R * 0.5);
    x.save(); x.strokeStyle = '#ffffff'; x.lineWidth = line * 1.5;
    duong(R * 0.5); x.stroke();
    x.strokeStyle = col; x.lineWidth = line * 0.5; duong(R * 0.5); x.stroke(); x.restore();
  } else { nenCoKhoi(R); vienSang(R); }

  const oChu = LE + line * 1.4;                       // vùng đặt chữ, chừa viền và vệt sáng
  return { data: x.getImageData(0, 0, S, S), content: [oChu, oChu, S - oChu, S - oChu], stretchX: [[S * 0.44, S * 0.56]], stretchY: [[S * 0.44, S * 0.56]] };
}

// MỎ NEO HÌNH SAO LA BÀN — bốn tia dài, bốn tia ngắn, nét mảnh; dùng cho thẻ chú thích sang trọng.
function makeStarAnchor(col: string): any {
  if (typeof document === 'undefined') return null;
  const S = 72, c = document.createElement('canvas'); c.width = S; c.height = S;
  const x = c.getContext('2d'); if (!x) return null;
  const m = S / 2;
  x.translate(m, m); x.strokeStyle = col; x.lineCap = 'round';
  x.save(); x.shadowColor = col; x.shadowBlur = 8;
  x.lineWidth = 2.2; x.beginPath();
  [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dy]) => { x.moveTo(dx * 7, dy * 7); x.lineTo(dx * 30, dy * 30); });   // 4 tia dài
  x.stroke();
  x.lineWidth = 1.4; x.beginPath();
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dx, dy]) => { const k = 0.707; x.moveTo(dx * k * 8, dy * k * 8); x.lineTo(dx * k * 17, dy * k * 17); });  // 4 tia ngắn
  x.stroke();
  x.restore();
  x.beginPath(); x.arc(0, 0, 5.5, 0, Math.PI * 2); x.lineWidth = 1.8; x.stroke();
  x.beginPath(); x.arc(0, 0, 2.4, 0, Math.PI * 2); x.fillStyle = col; x.fill();
  return x.getImageData(0, 0, S, S);
}
// ── PHASE 2: 1 dự án → 5 kịch bản. Mỗi kịch bản có bộ cài đặt riêng; dùng chung dữ liệu bản đồ + thông tin dự án. ──
const STORAGE_KEY = 'camlam_mapvideo_project_v1';
const BRAND_KEY = 'camlam_brandkit_v1'; // logo + liên hệ dùng chung cho mọi dự án
const SCRIPTS0 = [
  { key: 'vitri', name: '01 · Vị trí', focus: 'Tỉnh/huyện/xã · vị trí dự án · ranh dự án' },
  { key: 'hatang', name: '02 · Hạ tầng', focus: 'Cao tốc · quốc lộ · sân bay · cảng · trung tâm' },
  { key: 'tienich', name: '03 · Tiện ích', focus: 'Trường · bệnh viện · chợ · biển · TTTM' },
  { key: 'dautu', name: '04 · Đầu tư', focus: 'Vị trí · kết nối · hạ tầng · khu phát triển' },
  { key: 'banhang', name: '05 · Bán hàng', focus: 'Sản phẩm · diện tích · giá · ưu điểm · CTA' },
  // 06 GỘP CHUNG mọi kiểu quay dẫn đường. Trước đây tách thành 5 thẻ 06→10 nên thanh kịch bản dài
  // lê thê mà thực ra cùng một việc: quay đường đi. Giờ chọn 06 là ra kiểu chuẩn, muốn kiểu khác
  // (sát mặt đường, bay cao…) thì sổ danh sách 6.1–6.7 ngay trong bảng Tuyến đường.
  { key: 'chiduong', name: '06 · Dẫn đường', focus: 'Tổng thể → cận thửa → chạy tuyến tới đích. Chọn kiểu bay 6.1–6.7 trong bảng Tuyến đường' },
];
// Các KIỂU BAY của kịch bản 06 — sổ xuống trong bảng Tuyến đường.
// Giữ ĐÚNG bốn kiểu vốn nằm ở thẻ 07 · 08 · 09 · 10 trên thanh, đánh lại số thành 6.1 → 6.4.
const KIEU_DAN_DUONG: { key: string; ten: string; mo: string }[] = [
  { key: '',          ten: '06 · Dẫn đường',                 mo: 'Cân giữa thấy đường và thấy xung quanh — hợp mọi tuyến' },
  { key: 'cd_sat',    ten: '6.1 · Dẫn đường sát',           mo: 'Bám sát mặt đường, nghiêng cao như ngồi trên xe — thấy rõ đường vào tận thửa' },
  { key: 'cd_ketlo',  ten: '6.2 · Đường → thửa đất',        mo: 'Chạy hết tuyến rồi hạ cánh lượn quanh thửa đất — chốt bằng chính miếng đất' },
  { key: 'cd_capmat', ten: '6.3 · Sát mặt đường (cực thấp)', mo: 'Camera gần chạm mặt đường, nghiêng kịch trần — như ngồi trên nắp capo' },
  { key: 'cd_cao',    ten: '6.4 · Bay cao — đường dài',     mo: 'Kéo thanh (hoặc gõ số) để chọn tầm bay: khung hình bao từ 3 km tới 100.000 km' },
];
type Sub = { s: number; e: number; t: string };
type Settings = { title: string; sub: string; layout: Layout; orient: '16:9' | '9:16' | '1:1' | '4:5'; res: '1080' | '720'; duration: number; base: 'sat' | 'sat2' | 'street' | 'dark'; parcelFx: string; parcelColor: string; routeStyle?: string; routeName?: string; routeNameCol?: string; loSoDo?: boolean; sangLo?: boolean; sangLoDo?: number; sangTuyen?: boolean; sangTuyenDo?: number; chartOn: boolean; chartTitle: string; chartType: string; chartRaw: string; chartSeries?: string; subs?: Sub[]; camStyle?: string; textAnim?: string; camKeys?: CamKeyframe[]; objects?: Obj[]; scenes?: Scene[]; intro?: ScreenCard; outro?: ScreenCard; sfx?: Sfx[]; tone?: string; toneCustom?: Tone | null; camTarget?: boolean; logoStyle?: string; logoPos?: string; grade?: string; toiGoc?: number; moDongMan?: boolean; routeDir?: 'xuoi' | 'nguoc'; routeEase?: string; routeHead?: boolean; routeColor?: string; hillshade?: boolean; terrain3d?: boolean; pinAnim?: string; pinGround?: boolean; parcelOpacity?: number; parcelSpark?: boolean; parcel3d?: boolean; photoOpacity?: number; zoneOpacity?: number; pinShape?: string; pinColor?: string; pinIcon?: string; calloutStyle?: 'gold' | 'white' | 'navy' | 'red'; calloutShape?: string; labels?: boolean; pinFamily?: string; radarFx?: string; pinMinZ?: number; pinKhongDe?: boolean; ngamLo?: number; khungKm?: number; bienOn?: boolean; bienHuong?: number; bienKhung?: { t: number; huong: number; cao: number; nghieng: number; dai: number; lng?: number; lat?: number; zoom?: number; pitch?: number; bearing?: number; kieu?: 'bien' | 'deo' }[]; deoOn?: boolean; hinhMode?: 'auto' | '2d' | '3d'; renderKy?: boolean; noiKhoi?: number; fpsQuay?: number; net3d?: boolean; chuKieu?: string };
// THƯ VIỆN MẪU CHỮ ĐỘNG — tên đặt theo việc bán bất động sản, có ô xem trước chạy thật.
const TEXTANIMS: { key: string; name: string; group: string }[] = [
  // Cách chữ xuất hiện
  { key: 'fade', name: 'Mờ dần', group: 'Xuất hiện' },
  { key: 'slideUp', name: 'Trượt lên', group: 'Xuất hiện' },
  { key: 'slideLeft', name: 'Trượt từ trái', group: 'Xuất hiện' },
  { key: 'typewriter', name: 'Đánh máy', group: 'Xuất hiện' },
  { key: 'wipe', name: 'Lộ dần từ trái', group: 'Xuất hiện' },
  { key: 'zoomIn', name: 'Phóng vào', group: 'Xuất hiện' },
  { key: 'bounce', name: 'Nảy vào', group: 'Xuất hiện' },
  { key: 'rotate', name: 'Xoay vào', group: 'Xuất hiện' },
  { key: 'blur', name: 'Mờ nhoè → nét', group: 'Xuất hiện' },
  { key: 'stamp', name: 'Đóng dấu', group: 'Xuất hiện' },
  { key: 'flash', name: 'Nháy rồi đứng', group: 'Xuất hiện' },
  { key: 'dropIn', name: 'Rơi xuống nảy', group: 'Xuất hiện' },
  { key: 'flipX', name: 'Lật ngang', group: 'Xuất hiện' },
  { key: 'expand', name: 'Giãn chữ ra', group: 'Xuất hiện' },
  { key: 'maskUp', name: 'Lộ dần từ dưới', group: 'Xuất hiện' },
  { key: 'glitch', name: 'Nhiễu số (glitch)', group: 'Xuất hiện' },
  { key: 'splitIn', name: 'Tách đôi ghép lại', group: 'Xuất hiện' },
  // Kiểu chữ sang
  { key: 'gold', name: 'Chữ vàng kim', group: 'Chữ sang' },
  { key: 'gold24', name: 'Vàng 24K', group: 'Chữ sang' },
  { key: 'silver', name: 'Bạc kim loại', group: 'Chữ sang' },
  { key: 'neon', name: 'Neon phát sáng', group: 'Chữ sang' },
  { key: 'fire', name: 'Dự án HOT (lửa)', group: 'Chữ sang' },
  { key: 'ocean', name: 'Gần biển (xanh)', group: 'Chữ sang' },
  { key: 'shine', name: 'Quét sáng ngang', group: 'Chữ sang' },
  { key: 'emboss', name: 'Chữ nổi khối', group: 'Chữ sang' },
  { key: 'outline', name: 'Chữ rỗng viền', group: 'Chữ sang' },
  { key: 'chrome', name: 'Crôm bóng', group: 'Chữ sang' },
  { key: 'sunset', name: 'Hoàng hôn (cam→hồng)', group: 'Chữ sang' },
  { key: 'emerald', name: 'Ngọc lục bảo', group: 'Chữ sang' },
  { key: 'holo', name: 'Cầu vồng lạnh', group: 'Chữ sang' },
  { key: 'ink', name: 'Trắng viền đậm (tạp chí)', group: 'Chữ sang' },
  { key: 'goldline', name: 'Vàng kẻ đôi', group: 'Chữ sang' },
  // Có khung / nền
  { key: 'glass', name: 'Thẻ kính mờ', group: 'Có khung' },
  { key: 'ribbon', name: 'Dải băng vàng', group: 'Có khung' },
  { key: 'boxLeft', name: 'Thẻ gạch vàng', group: 'Có khung' },
  { key: 'darkgold', name: 'Nền đen viền vàng', group: 'Có khung' },
  { key: 'bracket', name: 'Ngoặc vuông bao chữ', group: 'Có khung' },
  { key: 'underline', name: 'Gạch chân chạy', group: 'Có khung' },
  { key: 'chip', name: 'Viên thuốc', group: 'Có khung' },
  { key: 'quote', name: 'Dấu ngoặc kép', group: 'Có khung' },
  { key: 'stripe', name: 'Sọc chéo sau chữ', group: 'Có khung' },
  { key: 'boxShine', name: 'Khung quét sáng', group: 'Có khung' },
  { key: 'none', name: 'Không hiệu ứng', group: 'Có khung' },
];
const CAMSTYLES: { key: string; name: string }[] = [
  { key: '', name: 'Theo kịch bản' }, { key: 'overview', name: '🖼 Toàn cảnh (giữ tất cả trong khung)' }, { key: 'vitri', name: 'Định vị (xa→gần)' }, { key: 'hatang', name: 'Quét ngang' },
  { key: 'tienich', name: 'Xoay quanh' }, { key: 'dautu', name: 'Đẩy sát điện ảnh' }, { key: 'banhang', name: 'Bám sát nhanh' }, { key: 'chiduong', name: '🚗 Dẫn đường — chuẩn' }, { key: 'cd_sat', name: '🚗 Dẫn đường — sát mặt đường' }, { key: 'cd_capmat', name: '🚗 Dẫn đường — sát cực thấp (nghiêng kịch trần)' },
  { key: 'cd_tren', name: '🚗 Dẫn đường — nhìn từ trên (như Google Maps)' }, { key: 'cd_ketlo', name: '🚗 Dẫn đường — kết ở thửa đất' },
  { key: 'cd_dienanh', name: '🚗 Dẫn đường — điện ảnh chậm' },
  { key: 'cd_cao', name: '🚗 Dẫn đường — bay cao (đường dài)' },
  { key: 'orbit360', name: '🎬 Flycam xoay 360°' }, { key: 'spiral', name: '🎬 Xoáy ốc bay vào' }, { key: 'crane', name: '🎬 Cần cẩu nâng (crane)' }, { key: 'lowsweep', name: '🎬 Lướt thấp sát mặt' },
  { key: 'reveal', name: '🎬 Lộ diện (trên→3D)' }, { key: 'cinematic', name: '🎬 Điện ảnh chậm' }, { key: 'energetic', name: '🎬 Sôi động bùng nổ' }, { key: 'boomerang', name: '🎬 Vòng cung boomerang' },
  { key: 'custom', name: '🎯 Keyframe tự đặt' },
];
// ══ CÁC KIỂU BAY CỦA KỊCH BẢN "DẪN ĐƯỜNG" ══
// dz     = lệch độ phóng so với mức bám tuyến chuẩn (dương = sát hơn)
// pitch  = độ nghiêng camera (0 = nhìn thẳng từ trên xuống, 70 = gần như nhìn ngang)
// look   = nhìn trước bao nhiêu phần quãng đường
// phan   = bao nhiêu phần tuyến vừa khung hình (nhỏ = camera sát hơn)
// ketLo  = chạy hết tuyến thì hạ cánh vòng quanh thửa đất (thay vì mở rộng ra tổng thể)
// xoayLo = xoay quanh thửa đất bao nhiêu độ ở đoạn "ngắm đất" (video bán đất thì đây là đoạn quan trọng nhất)
// met = BỀ NGANG MẶT ĐẤT mà khung hình phải bao trọn, tính bằng mét. Đây mới là thứ quyết định
// "drone bay cao hay thấp". Trước đây tính theo TỈ LỆ phần trăm tuyến (phan) nên tuyến dài 20 km
// thì drone bay tít trên mây, tuyến 300 m thì drone sà sát đất — chỗ quá gần chỗ quá xa là do đây.
// Giờ mỗi kiểu bay cố định một bề ngang khung hình ⇒ tuyến dài ngắn gì cũng cùng một cảm giác.
const DAN_DUONG: Record<string, { dz: number; pitch: number; look: number; phan: number; met: number; ketLo: boolean; xoayLo: number }> = {
  chiduong:   { dz: 0,    pitch: 42, look: 0.015, phan: 0.16, met: 620,  ketLo: false, xoayLo: 75 },  // chuẩn — cân giữa thấy đường và thấy xung quanh
  cd_sat:     { dz: 1.6,  pitch: 64, look: 0.008, phan: 0.10, met: 260,  ketLo: false, xoayLo: 55 },  // SÁT MẶT ĐƯỜNG như đang ngồi trên xe chạy
  cd_tren:    { dz: -0.2, pitch: 0,  look: 0.03,  phan: 0.18, met: 900,  ketLo: false, xoayLo: 45 },  // nhìn thẳng từ trên xuống như Google Maps
  cd_ketlo:   { dz: 0.3,  pitch: 46, look: 0.015, phan: 0.14, met: 560,  ketLo: true,  xoayLo: 60 },  // chạy xong hạ cánh vòng quanh thửa đất
  cd_dienanh: { dz: -1.1, pitch: 56, look: 0.03,  phan: 0.26, met: 1150, ketLo: false, xoayLo: 95 },  // lùi xa, nghiêng sâu, khoan thai
  // CỰC THẤP: nghiêng 70° là mức tối đa bản đồ cho phép — thấp hơn nữa thì chỉ còn thấy đường chân trời.
  // Nhìn trước rất ngắn (look 0.005) và khung rất hẹp (phan 0.07) → cảm giác mặt đường lao vun vút
  // ngay dưới mũi xe. Chạy hết tuyến thì hạ cánh quanh thửa đất luôn cho có chỗ kết.
  cd_capmat:  { dz: 1.9,  pitch: 66, look: 0.007, phan: 0.09, met: 190,  ketLo: true,  xoayLo: 45 },
  // BAY RẤT CAO — dành cho tuyến dài mấy chục km. Khung hình bao 12 km mặt đất: một khung thấy trọn
  // mấy xã liền nhau, cả dải ven biển và vùng núi phía sau — như nhìn từ máy bay. Không thấy từng
  // mái nhà nữa, mà đúng ra ở tầm này người xem cũng chỉ cần thấy TUYẾN ĐƯỜNG ĐI QUA ĐÂU.
  // Kèm theo cái lợi lớn: mức phóng thấp thì ảnh vệ tinh ít ô, nạp nhoáng cái là xong, chạy rất mượt.
  // Nghiêng 32° để vẫn thấy đường chân trời; nhìn trước rất xa nên camera đi khoan thai, không vội vã.
  // (Tuyến ngắn mà chọn kiểu này thì web tự thu khung lại cho vừa, không bao giờ để tuyến bé như sợi chỉ.)
  cd_cao:     { dz: -2.6, pitch: 32, look: 0.08,  phan: 0.34, met: 12000, ketLo: false, xoayLo: 120 },
};
// ══ 10 KỊCH BẢN ÔM CUA ══ Dành riêng cho khúc rẽ vuông có đường dài phía sau.
// Mỗi khúc cua trên tuyến tự bốc MỘT kiểu, nên video có 3 khúc cua là 3 pha bay khác nhau —
// xem không bị nhàm, và không phải lúc nào cũng vòng rộng ra ngoài khoe toàn cảnh.
//   dat   = dạt ngang bao nhiêu (theo bề ngang khung hình). Dương = ra PHÍA NGOÀI cua, âm = cắt vào PHÍA TRONG.
//   lui   = lùi máy ra xa mấy mức phóng (âm = ập vào gần hơn).
//   ngang = ngẩng máy lên mấy độ (âm = chúi xuống sát mặt đất).
//   ap    = sau khi qua đỉnh cua thì lao tới gần thêm mấy mức phóng.
//   xoay  = cách xoay: deu (đều) · layda (ngoái ngược lấy đà rồi quét) · tre (giữ hướng cũ rồi quét dứt) · som (xoay xong sớm, ngắm trước hướng mới)
const KIEU_OM_CUA: { ten: string; dat: number; lui: number; ngang: number; ap: number; xoay: string }[] = [
  { ten: 'Vòng rộng ra ngoài',        dat:  0.55, lui:  1.15, ngang:  16, ap: 0,    xoay: 'layda' },
  { ten: 'Cắt sát mép trong',         dat: -0.38, lui: -0.20, ngang:  -5, ap: 0,    xoay: 'deu'   },
  { ten: 'Cần cẩu vọt lên cao',       dat:  0.12, lui:  1.35, ngang:  22, ap: 0,    xoay: 'deu'   },   // bay vọt lên khoe toàn cảnh con đường
  { ten: 'Lao sát mặt đường',         dat:  0,    lui: -0.55, ngang: -13, ap: 0,    xoay: 'som'   },
  { ten: 'Quét trễ dứt khoát',        dat:  0.22, lui:  0.55, ngang:   9, ap: 0,    xoay: 'tre'   },
  { ten: 'Ngắm trước hướng mới',      dat:  0.16, lui:  0.75, ngang:  11, ap: 0,    xoay: 'som'   },
  { ten: 'Xoay quanh đỉnh cua',       dat:  0.75, lui:  0.95, ngang:  13, ap: 0,    xoay: 'deu'   },
  { ten: 'Nghiêng vai kiểu máy bay',  dat:  0.48, lui:  0.65, ngang:  15, ap: 0,    xoay: 'layda' },
  { ten: 'Đứng lại cho tuyến chạy qua', dat: -0.22, lui: 1.35, ngang:  21, ap: 0,   xoay: 'tre'   },
  { ten: 'Lùi mạnh rồi lao tới',      dat:  0.30, lui:  1.55, ngang:  18, ap: 0.8,  xoay: 'deu'   },
  // ── 10 kiểu THÊM (tổng 20) — để mỗi khúc cua trong video ra một dáng khác nhau, không còn máy móc ──
  { ten: 'Ngoặt gắt sát mép trong',   dat: -0.50, lui: -0.35, ngang: -18, ap: 0.5,  xoay: 'tre'   },
  { ten: 'Thả trôi nhẹ qua cua',      dat:  0.25, lui:  0.35, ngang:   5, ap: 0,    xoay: 'deu'   },
  { ten: 'Vọt lên nhìn xuống',        dat:  0.20, lui:  1.35, ngang:  22, ap: 0,    xoay: 'som'   },   // nhìn thẳng từ trên xuống, thấy hết ngã rẽ
  { ten: 'Quét vượt rồi kéo lại',     dat:  0.45, lui:  0.85, ngang:  12, ap: 0.3,  xoay: 'trot'  },
  { ten: 'Hai nhịp tay lái',          dat:  0.35, lui:  0.70, ngang:  10, ap: 0,    xoay: 'hai'   },
  { ten: 'Trượt ngang khoe ngã rẽ',   dat:  0.95, lui:  0.45, ngang:   7, ap: 0,    xoay: 'tre'   },
  { ten: 'Bám sát rồi bung ra',       dat: -0.30, lui:  1.25, ngang:  20, ap: 0,    xoay: 'layda' },
  { ten: 'Hạ thấp lách qua',          dat: -0.15, lui: -0.90, ngang: -22, ap: 0.35, xoay: 'som'   },   // sà xuống sát mặt đường rồi lách qua
  { ten: 'Vòng cung chậm rãi',        dat:  0.85, lui:  0.90, ngang:  17, ap: 0,    xoay: 'hai'   },
  { ten: 'Bổ nhào ngay sau cua',      dat:  0.40, lui:  1.40, ngang:  24, ap: 1.1,  xoay: 'trot'  },
];
const laDanDuong = (k: string) => k === 'chiduong' || k.startsWith('cd_');
type CamKeyframe = { t: number; lng: number; lat: number; zoom: number; pitch: number; bearing: number; ease?: string; easeZoom?: string; easePitch?: string; easeBearing?: string };
// Kiểu chuyển động giữa 2 khung camera (như app dựng phim: mượt / đều / tăng tốc / giảm tốc / đứng yên)
const EASES: { key: string; name: string; note: string }[] = [
  { key: 'smooth', name: 'Mượt', note: 'Vào êm, ra êm — hợp nhất' },
  { key: 'linear', name: 'Đều', note: 'Chạy đều một tốc độ' },
  { key: 'in', name: 'Tăng tốc', note: 'Chậm rồi nhanh dần' },
  { key: 'out', name: 'Giảm tốc', note: 'Nhanh rồi chậm lại' },
  { key: 'hold', name: 'Đứng yên', note: 'Giữ nguyên khung tới mốc sau' },
];
function easeAt(kind: string | undefined, t: number): number {
  if (kind === 'linear') return t;
  if (kind === 'in') return t * t;
  if (kind === 'out') return 1 - (1 - t) * (1 - t);
  if (kind === 'hold') return 0;
  return t * t * (3 - 2 * t); // mượt (mặc định)
}
type Scene = { id: string; name: string; dur: number }; // phân cảnh theo thời lượng
// MÀN MỞ ĐẦU / KẾT THÚC: đoạn KHÔNG có bản đồ (nền động + chữ + ảnh) — chèn ở đầu và cuối video.
type ScreenCard = { on: boolean; dur: number; bg: string; title: string; sub: string; img?: string };
const BGS: { key: string; name: string }[] = [
  { key: 'navy', name: 'Xanh đêm' }, { key: 'gold', name: 'Vàng sang' }, { key: 'grid', name: 'Lưới neon' },
  { key: 'contour', name: 'Bình độ' }, { key: 'paper', name: 'Giấy cũ' }, { key: 'black', name: 'Đen trơn' },
];
// Object tự do (chữ/ảnh) đặt trên video: vị trí chuẩn hoá x,y ∈ [0,1] (tâm), co/xoay/mờ/thời gian.
type Obj = { id: string; type: 'text' | 'image' | 'video' | 'widget' | 'xe'; xk?: string; duong?: [number, number][]; wk?: string; wd?: any; font?: string; ls?: number; curve?: number; outline?: boolean; shadow?: boolean; geo?: [number, number]; runRoute?: boolean; faceDir?: boolean; toc?: number; viTri?: number; chot?: { t: number; viTri?: number; scale?: number; rot?: number }[]; x: number; y: number; scale: number; rot: number; opacity: number; s: number; e: number; text?: string; fx?: string; size?: number; color?: string; weight?: number; bg?: boolean; src?: string; aspect?: number; locked?: boolean; hidden?: boolean };
// ── KHỐI DỰNG SẴN (như Templates của MapEffect, thêm mấy mẫu riêng cho bất động sản) ──
type Widget = { key: string; name: string; note: string; w: number; d: { t1: string; t2: string; t3: string; t4?: string } };
const WIDGETS: Widget[] = [
  { key: 'ios', name: 'Thông báo điện thoại', note: 'Thẻ báo nổi lên như tin nhắn tới', w: 0.62, d: { t1: 'CAM LÂM LAND', t2: 'Vừa có khách chốt lô B12', t3: 'Còn 3 lô cuối · giá gốc chủ đầu tư' } },
  { key: 'lock', name: 'Màn khoá điện thoại', note: 'Cả cái điện thoại, có giờ và thông báo', w: 0.46, d: { t1: 'CAM LÂM LAND', t2: 'Đất nền ven biển', t3: 'Sổ đỏ từng lô · 1,2 tỷ', t4: '9:41' } },
  { key: 'chat', name: 'Khung chat', note: 'Hội thoại hiện dần từng câu', w: 0.5, d: { t1: 'Khách hỏi', t2: 'Lô này còn không anh?', t3: 'Còn đúng 2 lô cuối ạ', t4: 'Cho em xem sổ với' } },
  { key: 'profile', name: 'Trang cá nhân', note: 'Hồ sơ, số liệu, nút theo dõi', w: 0.5, d: { t1: 'Cam Lâm Land', t2: 'Đất nền · Sổ đỏ · Cam Lâm', t3: '0567 442 996' } },
  { key: 'call', name: 'Cuộc gọi đến', note: 'Màn hình đang có khách gọi', w: 0.46, d: { t1: 'Khách xem đất', t2: 'Cuộc gọi đến…', t3: '0567 442 996' } },
  { key: 'price', name: 'Bảng giá lô đất', note: 'Riêng cho bất động sản — diện tích, giá, pháp lý', w: 0.56, d: { t1: 'LÔ B12 · MẶT TIỀN', t2: '100 m² · 5×20', t3: '1,25 tỷ', t4: 'Sổ đỏ riêng · Công chứng ngay' } },
  // ══ THẺ GIỚI THIỆU RỜI ══
  // Khác hẳn "Thẻ chú thích": thẻ kia CẮM vào một điểm trên bản đồ, có dây nối, bản đồ xoay thì nó
  // chạy theo. Ba mẫu dưới đây là LỚP RỜI — nằm yên một chỗ trên khung hình, kéo thả tuỳ ý, đặt giờ
  // hiện/tắt riêng. Dùng để giới thiệu dự án, khoe thông số hay dán danh thiếp môi giới vào góc video.
  { key: 'theso', name: 'Thẻ thông số (rời)', note: 'Thẻ đứng riêng một góc: tên lô, thông số, giá — không dính vào bản đồ', w: 0.44, d: { t1: 'ĐẤT NỀN CAM LÂM', t2: '120 m² · 5×24 · Hướng Đông Nam', t3: '2,8 tỷ', t4: 'Sổ đỏ riêng · Đường nhựa 12 m' } },
  { key: 'moigioi', name: 'Thẻ môi giới (rời)', note: 'Danh thiếp góc video: tên, chức danh, số điện thoại', w: 0.4, d: { t1: 'TÊN CỦA BẠN', t2: 'Chuyên viên đất nền Cam Lâm', t3: '0567 442 996' } },
  { key: 'huyhieuct', name: 'Huy hiệu công ty (rời)', note: 'Huy hiệu tròn + tên công ty, hợp làm dấu ở góc suốt video', w: 0.36, d: { t1: 'CAM LÂM LAND', t2: 'Đất nền · Sổ đỏ · Cam Lâm', t3: '' } },
  // ══ THANH LIÊN HỆ ══
  // Thanh nhỏ dán góc video: ô vuông màu thương hiệu bên trái, chữ bên phải. Người xem nhìn phát
  // biết gọi đâu, nhắn đâu. Đây là thứ video bán đất nào cũng cần mà mình chưa hề có.
  { key: 'hopvien', name: 'Hộp viền + icon nhà', note: 'Khung viền trắng bo góc, icon nhà trên, tên dưới — sạch sẽ, trang trọng', w: 0.34, d: { t1: 'CHO THUÊ', t2: 'BIỆT THỰ', t3: '' } },
  { key: 'ngoacgoc', name: 'Ngoặc góc + logo', note: 'Bốn ngoặc góc vàng ôm lấy icon và tên — kiểu tạp chí', w: 0.34, d: { t1: 'CHO THUÊ', t2: 'BIỆT THỰ', t3: '' } },
  { key: 'thanhngang', name: 'Thanh ngang + icon', note: 'Icon nhà bên trái, tên bên phải, gạch vàng dưới — gọn, đọc nhanh', w: 0.38, d: { t1: 'CHO THUÊ', t2: 'Biệt thự biển', t3: '' } },
  { key: 'khunggia', name: 'Khung giá nổi bật', note: 'Ô vàng đặc, chữ đen to — chỉ để khoe GIÁ, đập vào mắt nhất', w: 0.26, d: { t1: '6,5 TỶ', t2: '', t3: '' } },
  { key: 'haivachthe', name: 'Hai vạch vàng + chữ', note: 'Hai vạch vàng kẹp trên dưới, tên ở giữa — sang mà nhẹ', w: 0.34, d: { t1: 'CHO THUÊ', t2: 'BIỆT THỰ', t3: '' } },
  { key: 'lhphone', name: 'Thanh · Số điện thoại', note: 'Ô xanh lá có hình điện thoại + số — dán góc suốt video', w: 0.34, d: { t1: '0567 442 996', t2: 'phone', t3: '' } },
  { key: 'lhzalo', name: 'Thanh · Zalo', note: 'Ô xanh dương kiểu Zalo + số/tên tài khoản', w: 0.34, d: { t1: '0567 442 996', t2: 'zalo', t3: '' } },
  { key: 'lhface', name: 'Thanh · Facebook', note: 'Ô xanh Facebook + tên trang', w: 0.36, d: { t1: 'Cam Lâm Land', t2: 'face', t3: '' } },
  { key: 'lhyoutube', name: 'Thanh · YouTube', note: 'Ô đỏ YouTube + tên kênh', w: 0.36, d: { t1: 'Cam Lâm Land', t2: 'yt', t3: '' } },
  { key: 'lhtiktok', name: 'Thanh · TikTok', note: 'Ô đen TikTok + tên tài khoản', w: 0.34, d: { t1: '@camlamland', t2: 'tt', t3: '' } },
];
// Vẽ một khối dựng sẵn lên canvas. p = tiến độ hiện ra (0→1), el = giây đã trôi (cho phần chạy dần).
function drawWidget(ctx: CanvasRenderingContext2D, kind: string, cx: number, cy: number, w: number, d: any, p: number, el: number) {
  const GOLD = '#C8A14B', NAVY = '#0A2540';
  if (kind === 'hopvien' || kind === 'ngoacgoc' || kind === 'thanhngang' || kind === 'khunggia' || kind === 'haivachthe') {
    const x = ctx;
    const nhaIcon = (X: number, Y: number, r: number, mau: string) => {   // icon ngôi nhà đơn giản, vẽ tay
      x.save(); x.translate(X, Y); x.strokeStyle = mau; x.fillStyle = mau;
      x.lineWidth = Math.max(1.4, r * 0.24); x.lineCap = 'round'; x.lineJoin = 'round';
      x.beginPath(); x.moveTo(-r * 0.8, r * 0.1); x.lineTo(0, -r * 0.72); x.lineTo(r * 0.8, r * 0.1); x.stroke();
      x.beginPath(); x.moveTo(-r * 0.55, 0); x.lineTo(-r * 0.55, r * 0.8); x.lineTo(r * 0.55, r * 0.8); x.lineTo(r * 0.55, 0); x.stroke();
      x.restore();
    };
    const nenDen = (X: number, Y: number, W2: number, H2: number, r: number) => {
      x.save(); x.shadowColor = 'rgba(4,10,20,.55)'; x.shadowBlur = w * 0.05; x.shadowOffsetY = w * 0.016;
      const g = x.createLinearGradient(0, Y, 0, Y + H2);
      g.addColorStop(0, 'rgba(14,26,42,.95)'); g.addColorStop(1, 'rgba(5,12,22,.95)');
      x.fillStyle = g; x.beginPath(); x.roundRect(X, Y, W2, H2, r); x.fill(); x.restore();
    };
    x.textAlign = 'center'; x.textBaseline = 'middle';

    if (kind === 'khunggia') {                        // chỉ để khoe giá
      const H = w * 0.34, X = cx - w / 2, Y = cy - H / 2;
      x.save(); x.shadowColor = 'rgba(4,10,20,.55)'; x.shadowBlur = w * 0.06; x.shadowOffsetY = w * 0.02;
      const gg = x.createLinearGradient(0, Y, 0, Y + H);
      gg.addColorStop(0, '#f3dc95'); gg.addColorStop(0.5, GOLD); gg.addColorStop(1, '#a67c25');
      x.fillStyle = gg; x.beginPath(); x.roundRect(X, Y, w, H, H * 0.2); x.fill(); x.restore();
      x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = Math.max(1, w * 0.005);
      x.beginPath(); x.roundRect(X, Y, w, H, H * 0.2); x.stroke();
      x.fillStyle = NAVY; x.font = '900 ' + Math.round(H * 0.52) + 'px Arial, sans-serif';
      x.fillText(String(d?.t1 || ''), cx, cy + 1);
      return;
    }

    if (kind === 'thanhngang') {
      const H = w * 0.24, X = cx - w / 2, Y = cy - H / 2;
      nenDen(X, Y, w, H, H * 0.18);
      nhaIcon(X + H * 0.62, cy - H * 0.06, H * 0.3, GOLD);
      x.textAlign = 'left';
      x.fillStyle = '#ffffff'; x.font = '800 ' + Math.round(H * 0.42) + 'px Arial, sans-serif';
      x.fillText(String(d?.t1 || ''), X + H * 1.15, cy - H * 0.1);
      x.fillStyle = GOLD; x.fillRect(X + H * 1.15, cy + H * 0.14, w * 0.3, Math.max(2, H * 0.06));
      x.fillStyle = 'rgba(255,255,255,.7)'; x.font = '600 ' + Math.round(H * 0.26) + 'px Arial, sans-serif';
      x.fillText(String(d?.t2 || ''), X + H * 1.15, cy + H * 0.33);
      x.textAlign = 'center';
      return;
    }

    const H = w * 0.62, X = cx - w / 2, Y = cy - H / 2;
    if (kind !== 'ngoacgoc') nenDen(X, Y, w, H, w * 0.05);
    if (kind === 'hopvien') {
      x.strokeStyle = 'rgba(255,255,255,.92)'; x.lineWidth = Math.max(1.6, w * 0.012);
      x.beginPath(); x.roundRect(X + w * 0.05, Y + H * 0.09, w * 0.9, H * 0.82, w * 0.03); x.stroke();
    } else if (kind === 'ngoacgoc') {
      const L = w * 0.16, p = w * 0.03;
      x.save(); x.strokeStyle = GOLD; x.lineWidth = Math.max(1.6, w * 0.012); x.lineCap = 'square';
      x.beginPath();
      ([[X + p, Y + p, 1, 1], [X + w - p, Y + p, -1, 1], [X + p, Y + H - p, 1, -1], [X + w - p, Y + H - p, -1, -1]] as [number, number, number, number][])
        .forEach(([px, py, sx, sy]) => { x.moveTo(px + sx * L, py); x.lineTo(px, py); x.lineTo(px, py + sy * L); });
      x.stroke(); x.restore();
    }
    if (kind === 'haivachthe') {
      x.fillStyle = GOLD;
      x.fillRect(X + w * 0.16, Y + H * 0.27, w * 0.68, Math.max(2, H * 0.035));
      x.fillRect(X + w * 0.16, Y + H * 0.71, w * 0.68, Math.max(2, H * 0.035));
    } else {
      nhaIcon(cx, Y + H * 0.3, w * 0.09, GOLD);
    }
    x.fillStyle = '#ffffff'; x.font = '800 ' + Math.round(w * 0.11) + 'px Arial, sans-serif';
    x.fillText(String(d?.t1 || ''), cx, Y + H * (kind === 'haivachthe' ? 0.49 : 0.62));
    if (d?.t2) {
      x.fillStyle = GOLD; x.font = '700 ' + Math.round(w * 0.055) + 'px Arial, sans-serif';
      x.fillText(String(d.t2), cx, Y + H * (kind === 'haivachthe' ? 0.84 : 0.8));
    }
    return;
  }
  if (kind === 'lhphone' || kind === 'lhzalo' || kind === 'lhface' || kind === 'lhyoutube' || kind === 'lhtiktok') {
    const x = ctx;
    const MAU: Record<string, string> = { lhphone: '#22c55e', lhzalo: '#0068ff', lhface: '#1877f2', lhyoutube: '#ff0000', lhtiktok: '#111827' };
    const mau = MAU[kind] || '#22c55e';
    const H = w * 0.2, X = cx - w / 2, Y = cy - H / 2, R = H * 0.28, O = H * 0.86;
    x.save(); x.shadowColor = 'rgba(4,10,20,.5)'; x.shadowBlur = w * 0.035; x.shadowOffsetY = w * 0.012;
    x.fillStyle = 'rgba(255,255,255,.97)'; x.beginPath(); x.roundRect(X, Y, w, H, R); x.fill(); x.restore();
    x.save(); x.beginPath(); x.roundRect(X, Y, w, H, R); x.clip();
    x.fillStyle = mau; x.beginPath(); x.roundRect(X, Y, O, H, R); x.fill(); x.restore();
    // hình trong ô màu — vẽ tay bằng nét cơ bản cho nhẹ và không phụ thuộc phông chữ
    const ix = X + O / 2, iy = cy, r = H * 0.26;
    x.save(); x.strokeStyle = '#ffffff'; x.fillStyle = '#ffffff'; x.lineWidth = Math.max(1.4, H * 0.09); x.lineCap = 'round'; x.lineJoin = 'round';
    if (kind === 'lhphone' || kind === 'lhzalo') {
      x.beginPath();                                    // ống nghe điện thoại
      x.moveTo(ix - r * 0.55, iy - r * 0.75);
      x.lineTo(ix - r * 0.05, iy - r * 0.25);
      x.lineTo(ix - r * 0.3, iy + r * 0.05);
      x.quadraticCurveTo(ix + r * 0.1, iy + r * 0.5, ix + r * 0.5, iy + r * 0.2);
      x.lineTo(ix + r * 0.85, iy + r * 0.7);
      x.stroke();
      if (kind === 'lhzalo') { x.font = '900 ' + Math.round(H * 0.34) + 'px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('Z', ix + r * 0.05, iy - r * 0.05); }
    } else if (kind === 'lhface') {
      x.font = '900 ' + Math.round(H * 0.62) + 'px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('f', ix, iy + H * 0.02);
    } else if (kind === 'lhyoutube') {
      x.beginPath(); x.moveTo(ix - r * 0.35, iy - r * 0.6); x.lineTo(ix + r * 0.65, iy); x.lineTo(ix - r * 0.35, iy + r * 0.6); x.closePath(); x.fill();
    } else {
      x.beginPath();                                    // nốt nhạc TikTok
      x.moveTo(ix + r * 0.15, iy - r * 0.8); x.lineTo(ix + r * 0.15, iy + r * 0.35); x.stroke();
      x.beginPath(); x.arc(ix - r * 0.2, iy + r * 0.45, r * 0.36, 0, Math.PI * 2); x.stroke();
      x.beginPath(); x.moveTo(ix + r * 0.15, iy - r * 0.8); x.quadraticCurveTo(ix + r * 0.8, iy - r * 0.6, ix + r * 0.85, iy - r * 0.15); x.stroke();
    }
    x.restore();
    x.fillStyle = '#0A2540'; x.font = '800 ' + Math.round(H * 0.44) + 'px Arial, sans-serif';
    x.textAlign = 'left'; x.textBaseline = 'middle';
    x.fillText(String(d?.t1 || ''), X + O + H * 0.34, cy + 1);
    return;
  }
  if (kind === 'theso' || kind === 'moigioi' || kind === 'huyhieuct') {
    const x = ctx;
    const R = Math.round(w * 0.06);
    const hop = (X: number, Y: number, W2: number, H2: number, r: number) => { x.beginPath(); x.roundRect(X, Y, W2, H2, r); };
    const nen = (X: number, Y: number, W2: number, H2: number, r: number) => {
      x.save(); x.shadowColor = 'rgba(4,10,20,.55)'; x.shadowBlur = w * 0.06; x.shadowOffsetY = w * 0.02;
      const g = x.createLinearGradient(0, Y, 0, Y + H2);
      g.addColorStop(0, 'rgba(16,36,60,.96)'); g.addColorStop(1, 'rgba(6,18,32,.96)');
      x.fillStyle = g; hop(X, Y, W2, H2, r); x.fill(); x.restore();
      x.save(); hop(X, Y, W2, H2, r); x.clip();
      const vs = x.createLinearGradient(0, Y, 0, Y + H2 * 0.45);
      vs.addColorStop(0, 'rgba(255,255,255,.13)'); vs.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = vs; x.fillRect(X, Y, W2, H2 * 0.45); x.restore();
      x.strokeStyle = 'rgba(200,161,75,.55)'; x.lineWidth = Math.max(1, w * 0.004); hop(X, Y, W2, H2, r); x.stroke();
    };

    if (kind === 'huyhieuct') {
      const H = w * 0.34, X = cx - w / 2, Y = cy - H / 2;
      nen(X, Y, w, H, R);
      const rr = H * 0.32;
      x.save(); x.beginPath(); x.arc(X + H * 0.5, cy, rr, 0, Math.PI * 2);
      const gd = x.createLinearGradient(0, cy - rr, 0, cy + rr); gd.addColorStop(0, '#f0d68a'); gd.addColorStop(1, '#a67c25');
      x.fillStyle = gd; x.fill(); x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = Math.max(1, w * 0.004); x.stroke(); x.restore();
      x.fillStyle = NAVY; x.font = '800 ' + Math.round(H * 0.3) + 'px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('CL', X + H * 0.5, cy + 1);
      x.textAlign = 'left';
      x.fillStyle = '#ffffff'; x.font = '800 ' + Math.round(H * 0.27) + 'px Arial, sans-serif';
      x.fillText(String(d?.t1 || ''), X + H * 0.95, cy - H * 0.1);
      x.fillStyle = 'rgba(255,255,255,.66)'; x.font = '600 ' + Math.round(H * 0.18) + 'px Arial, sans-serif';
      x.fillText(String(d?.t2 || ''), X + H * 0.95, cy + H * 0.2);
      return;
    }

    const co = kind === 'theso' ? 0.72 : 0.5;
    const H = w * co, X = cx - w / 2, Y = cy - H / 2;
    nen(X, Y, w, H, R);
    x.save(); x.fillStyle = GOLD; x.fillRect(X, Y + H * 0.14, w * 0.018, H * 0.34); x.restore();   // vạch vàng bên trái
    x.textAlign = 'left'; x.textBaseline = 'middle';
    const lề = X + w * 0.075;
    x.fillStyle = '#ffffff'; x.font = '800 ' + Math.round(w * 0.075) + 'px Arial, sans-serif';
    x.fillText(String(d?.t1 || ''), lề, Y + H * 0.24);
    x.fillStyle = 'rgba(255,255,255,.72)'; x.font = '600 ' + Math.round(w * 0.045) + 'px Arial, sans-serif';
    x.fillText(String(d?.t2 || ''), lề, Y + H * 0.45);
    if (kind === 'theso') {
      x.fillStyle = GOLD; x.font = '900 ' + Math.round(w * 0.1) + 'px Arial, sans-serif';
      x.fillText(String(d?.t3 || ''), lề, Y + H * 0.68);
      x.fillStyle = 'rgba(255,255,255,.6)'; x.font = '600 ' + Math.round(w * 0.04) + 'px Arial, sans-serif';
      x.fillText(String(d?.t4 || ''), lề, Y + H * 0.87);
    } else {
      x.save(); x.fillStyle = GOLD; hop(lề, Y + H * 0.62, w * 0.34, H * 0.24, H * 0.12); x.fill(); x.restore();
      x.fillStyle = NAVY; x.font = '800 ' + Math.round(w * 0.05) + 'px Arial, sans-serif'; x.textAlign = 'center';
      x.fillText(String(d?.t3 || ''), lề + w * 0.17, Y + H * 0.74 + 1);
      x.textAlign = 'left';
    }
    return;
  }
  const r = (x: number) => Math.round(x);
  const ap = Math.max(0, Math.min(1, p * 3));
  const box = (bx: number, by: number, bw: number, bh: number, rad: number, fill: string, shadow?: boolean) => {
    ctx.save();
    if (shadow) { ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = w * 0.05; ctx.shadowOffsetY = w * 0.014; }
    ctx.beginPath();
    if ((ctx as any).roundRect) (ctx as any).roundRect(bx, by, bw, bh, rad); else ctx.rect(bx, by, bw, bh);
    ctx.fillStyle = fill; ctx.fill(); ctx.restore();
  };
  const txt = (t: string, x: number, y: number, size: number, weight: number, color: string, align: CanvasTextAlign = 'left') => {
    ctx.font = weight + ' ' + r(size) + 'px Arial, sans-serif'; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y);
  };
  const clip = (t: string, max: number, size: number, weight: number) => {
    ctx.font = weight + ' ' + r(size) + 'px Arial, sans-serif';
    if (ctx.measureText(t).width <= max) return t;
    let out = t; while (out.length > 3 && ctx.measureText(out + '…').width > max) out = out.slice(0, -1);
    return out + '…';
  };
  ctx.save();
  ctx.globalAlpha = ap;
  ctx.translate(0, (1 - ap) * -w * 0.09); // trượt nhẹ từ trên xuống khi hiện ra

  if (kind === 'ios') {
    const h = w * 0.29, x0 = cx - w / 2, y0 = cy - h / 2, pad = w * 0.045;
    box(x0, y0, w, h, w * 0.055, 'rgba(252,252,254,.97)', true);
    const ic = w * 0.085; box(x0 + pad, y0 + pad, ic, ic, ic * 0.28, GOLD);
    txt('🏠', x0 + pad + ic * 0.5, y0 + pad + ic * 0.72, ic * 0.62, 400, NAVY, 'center');
    txt(clip(d.t1, w * 0.5, w * 0.032, 700), x0 + pad + ic + w * 0.03, y0 + pad + ic * 0.62, w * 0.032, 700, '#8e8e93');
    txt('bây giờ', x0 + w - pad, y0 + pad + ic * 0.62, w * 0.03, 400, '#a3a3a8', 'right');
    txt(clip(d.t2, w - pad * 2, w * 0.05, 700), x0 + pad, y0 + h * 0.63, w * 0.05, 700, '#111');
    txt(clip(d.t3, w - pad * 2, w * 0.042, 400), x0 + pad, y0 + h * 0.85, w * 0.042, 400, '#3c3c43');
    ctx.restore(); return;
  }

  const ph = (bodyFill: string, draw: (x0: number, y0: number, pw: number, phh: number) => void) => {
    const pw = w, phh = w * 2.02, x0 = cx - pw / 2, y0 = cy - phh / 2;
    box(x0 - pw * 0.02, y0 - pw * 0.02, pw * 1.04, phh * 1.02, pw * 0.14, '#1b1b1f', true); // vỏ máy
    box(x0, y0, pw, phh, pw * 0.12, bodyFill);                                              // màn hình
    box(cx - pw * 0.17, y0 + pw * 0.022, pw * 0.34, pw * 0.075, pw * 0.04, '#1b1b1f');      // tai thỏ
    draw(x0, y0, pw, phh);
  };

  if (kind === 'lock') {
    ph('#0b1a2b', (x0, y0, pw, phh) => {
      const g = ctx.createLinearGradient(0, y0, 0, y0 + phh); g.addColorStop(0, '#123a5e'); g.addColorStop(1, '#050d16');
      box(x0, y0, pw, phh, pw * 0.12, g as any);
      txt(d.t4 || '9:41', cx, y0 + phh * 0.24, pw * 0.2, 300, '#fff', 'center');
      txt('Thứ Năm, 23 tháng 10', cx, y0 + phh * 0.29, pw * 0.045, 400, 'rgba(255,255,255,.75)', 'center');
      const nh = phh * 0.14, nx = x0 + pw * 0.06, ny = y0 + phh * 0.42, nw = pw * 0.88, pad = pw * 0.05;
      box(nx, ny, nw, nh, pw * 0.06, 'rgba(250,250,252,.96)');
      const ic = pw * 0.12; box(nx + pad, ny + pad * 0.7, ic, ic, ic * 0.28, GOLD);
      txt(clip(d.t1, nw * 0.55, pw * 0.042, 700), nx + pad + ic + pw * 0.035, ny + pad * 0.7 + ic * 0.6, pw * 0.042, 700, '#8e8e93');
      txt(clip(d.t2, nw - pad * 2, pw * 0.062, 700), nx + pad, ny + nh * 0.62, pw * 0.062, 700, '#111');
      txt(clip(d.t3, nw - pad * 2, pw * 0.05, 400), nx + pad, ny + nh * 0.85, pw * 0.05, 400, '#3c3c43');
    });
    ctx.restore(); return;
  }

  if (kind === 'chat') {
    ph('#ffffff', (x0, y0, pw, phh) => {
      box(x0, y0, pw, phh * 0.1, pw * 0.12, '#f2f2f7');                       // thanh trên
      box(x0 + pw * 0.06, y0 + phh * 0.045, pw * 0.09, pw * 0.09, pw * 0.045, GOLD);
      txt(clip(d.t1, pw * 0.6, pw * 0.05, 700), x0 + pw * 0.2, y0 + phh * 0.075, pw * 0.05, 700, '#111');
      const msgs = [[d.t2, 0], [d.t3, 1], [d.t4, 0]] as [string, number][];
      let yy = y0 + phh * 0.16;
      msgs.forEach((m, i) => {
        if (!m[0]) return;
        const show = Math.max(0, Math.min(1, (el - 0.55 - i * 0.85) * 3.2)); // hiện dần từng câu
        if (show <= 0) return;
        ctx.save(); ctx.globalAlpha = ap * show; ctx.translate(0, (1 - show) * pw * 0.05);
        const mine = m[1] === 1, bw = pw * 0.62, bh = pw * 0.17;
        const bx = mine ? x0 + pw - bw - pw * 0.06 : x0 + pw * 0.06;
        box(bx, yy, bw, bh, pw * 0.07, mine ? '#0a84ff' : '#e9e9eb');
        txt(clip(m[0], bw - pw * 0.09, pw * 0.045, 400), bx + pw * 0.045, yy + bh * 0.62, pw * 0.045, 400, mine ? '#fff' : '#111');
        ctx.restore(); yy += bh + pw * 0.05;
      });
    });
    ctx.restore(); return;
  }

  if (kind === 'profile') {
    ph('#ffffff', (x0, y0, pw, phh) => {
      const av = pw * 0.28; box(cx - av / 2, y0 + phh * 0.09, av, av, av / 2, GOLD);
      txt('🏠', cx, y0 + phh * 0.09 + av * 0.68, av * 0.5, 400, NAVY, 'center');
      txt(clip(d.t1, pw * 0.86, pw * 0.07, 700), cx, y0 + phh * 0.235, pw * 0.07, 700, '#111', 'center');
      txt(clip(d.t2, pw * 0.86, pw * 0.045, 400), cx, y0 + phh * 0.268, pw * 0.045, 400, '#6b7280', 'center');
      const stats: [string, string][] = [['128', 'Bài viết'], ['9.842', 'Người theo dõi'], ['12', 'Dự án']];
      stats.forEach((st, i) => {
        const sx = x0 + pw * (0.2 + i * 0.3);
        txt(st[0], sx, y0 + phh * 0.325, pw * 0.055, 700, '#111', 'center');
        txt(st[1], sx, y0 + phh * 0.352, pw * 0.036, 400, '#6b7280', 'center');
      });
      const bw = pw * 0.76, bh = pw * 0.115;
      box(cx - bw / 2, y0 + phh * 0.385, bw, bh, pw * 0.03, '#0a84ff');
      txt('Theo dõi', cx, y0 + phh * 0.385 + bh * 0.68, pw * 0.05, 700, '#fff', 'center');
      txt(clip(d.t3, pw * 0.86, pw * 0.05, 700), cx, y0 + phh * 0.5, pw * 0.05, 700, NAVY, 'center');
    });
    ctx.restore(); return;
  }

  if (kind === 'call') {
    ph('#07131f', (x0, y0, pw, phh) => {
      const g = ctx.createLinearGradient(0, y0, 0, y0 + phh); g.addColorStop(0, '#16324e'); g.addColorStop(1, '#050b12');
      box(x0, y0, pw, phh, pw * 0.12, g as any);
      const av = pw * 0.3; box(cx - av / 2, y0 + phh * 0.16, av, av, av / 2, 'rgba(255,255,255,.14)');
      txt('👤', cx, y0 + phh * 0.16 + av * 0.68, av * 0.5, 400, '#fff', 'center');
      txt(clip(d.t1, pw * 0.86, pw * 0.075, 700), cx, y0 + phh * 0.33, pw * 0.075, 700, '#fff', 'center');
      txt(clip(d.t3, pw * 0.86, pw * 0.05, 400), cx, y0 + phh * 0.37, pw * 0.05, 400, 'rgba(255,255,255,.7)', 'center');
      const blink = 0.55 + 0.45 * Math.sin(el * 4);
      ctx.save(); ctx.globalAlpha = ap * blink;
      txt(d.t2 || 'Cuộc gọi đến…', cx, y0 + phh * 0.42, pw * 0.045, 400, GOLD, 'center'); ctx.restore();
      const br = pw * 0.13, by = y0 + phh * 0.78;
      box(cx - pw * 0.26 - br, by, br * 2, br * 2, br, '#ff3b30'); txt('✕', cx - pw * 0.26, by + br * 1.28, br * 0.9, 700, '#fff', 'center');
      box(cx + pw * 0.26 - br, by, br * 2, br * 2, br, '#30d158'); txt('✆', cx + pw * 0.26, by + br * 1.3, br * 1, 700, '#fff', 'center');
    });
    ctx.restore(); return;
  }

  // 'price' — bảng giá lô đất (mẫu riêng cho bất động sản)
  const h = w * 0.62, x0 = cx - w / 2, y0 = cy - h / 2, pad = w * 0.06;
  box(x0, y0, w, h, w * 0.05, 'rgba(9,20,33,.93)', true);
  box(x0, y0, w * 0.018, h, 0, GOLD);
  txt(clip(d.t1, w - pad * 2, w * 0.045, 800), x0 + pad, y0 + h * 0.17, w * 0.045, 800, GOLD);
  const rows: [string, string][] = [['Diện tích', d.t2], ['Giá bán', d.t3], ['Pháp lý', d.t4 || 'Sổ đỏ riêng']];
  rows.forEach((rw, i) => {
    const yy = y0 + h * (0.36 + i * 0.19);
    txt(rw[0], x0 + pad, yy, w * 0.04, 400, 'rgba(255,255,255,.6)');
    const big = i === 1;
    txt(clip(rw[1], w * 0.62, w * (big ? 0.062 : 0.045), 700), x0 + w - pad, yy + (big ? w * 0.008 : 0), w * (big ? 0.062 : 0.045), 700, big ? GOLD : '#fff', 'right');
    if (i < 2) { ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(x0 + pad, yy + h * 0.05, w - pad * 2, 1); }
  });
  ctx.restore();
}
// Vẽ 1 object lên canvas video theo thời điểm el.
// PHÔNG CHỮ — chỉ dùng phông có sẵn trong máy nên chắc chắn hiện đúng, và đủ dấu tiếng Việt.
const FONTS: { key: string; name: string; css: string }[] = [
  { key: 'sans', name: 'Hiện đại', css: 'Arial, Helvetica, sans-serif' },
  { key: 'ui', name: 'Mềm mại', css: '"Segoe UI", Roboto, "Helvetica Neue", sans-serif' },
  { key: 'wide', name: 'Dễ đọc', css: 'Verdana, Geneva, sans-serif' },
  { key: 'serif', name: 'Cổ điển', css: 'Georgia, "Times New Roman", serif' },
  { key: 'times', name: 'Trang trọng', css: '"Times New Roman", Times, serif' },
  { key: 'black', name: 'Đậm khối', css: '"Arial Black", Arial, sans-serif' },
  { key: 'mono', name: 'Máy chữ', css: '"Courier New", Courier, monospace' },
  { key: 'tahoma', name: 'Gọn gàng', css: 'Tahoma, Geneva, sans-serif' },
];
// Vẽ chữ chạy theo một cung tròn (uốn cong). curve > 0 cong lên, < 0 cong xuống.
function arcText(ctx: CanvasRenderingContext2D, text: string, curve: number, paint: (ch: string) => void) {
  const chars = Array.from(text); if (!chars.length) return;
  const R = Math.max(40, 26000 / Math.abs(curve));            // độ cong càng lớn thì vòng cung càng nhỏ
  const up = curve > 0;
  const ws = chars.map((c) => ctx.measureText(c).width);
  const total = ws.reduce((a, b) => a + b, 0);
  let a = up ? -Math.PI / 2 - total / R / 2 : Math.PI / 2 + total / R / 2;
  ctx.save(); ctx.translate(0, up ? R : -R);
  chars.forEach((c, i) => {
    const da = ws[i] / R; const ang = up ? a + da / 2 : a - da / 2;
    ctx.save(); ctx.translate(Math.cos(ang) * R, Math.sin(ang) * R);
    ctx.rotate(up ? ang + Math.PI / 2 : ang - Math.PI / 2);
    paint(c); ctx.restore();
    a = up ? a + da : a - da;
  });
  ctx.restore();
}
// Vẽ MỘT dòng chữ của object — dùng chung cho video và khung xem trước nên hai bên luôn giống hệt nhau.
function paintObjText(ctx: CanvasRenderingContext2D, o: Obj, fs: number, ap = 1) {
  const fam = FONTS.find((f) => f.key === (o.font || 'sans'))?.css || FONTS[0].css;
  // CÓ CHỌN MẪU CHỮ ĐỘNG → vẽ bằng ĐÚNG bộ vẽ của tiêu đề video (44 mẫu: vàng kim, neon,
  // đánh máy, nhiễu số…). Nhờ vậy chữ ghim xuống bản đồ cũng đẹp y như tiêu đề.
  // Chữ uốn cong thì không dùng mẫu động được (hai thứ này đá nhau), lúc đó vẽ kiểu thường.
  if (o.fx && o.fx !== 'none' && !o.curve) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if (o.bg) {
      ctx.font = `${o.weight || 700} ${fs}px ${fam}`;
      const w0 = ctx.measureText(o.text || '').width, pX = fs * 0.4, pY = fs * 0.25;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(ctx, -(w0 / 2 + pX), -(fs / 2 + pY), w0 + pX * 2, fs + pY * 2, fs * 0.2); ctx.fill();
    }
    paintTextFx(ctx, o.text || '', 0, fs * 0.34, fs, o.weight || 700, o.color || '#ffffff', o.fx, ap, fam);
    ctx.restore();
    return;
  }
  ctx.font = `${o.weight || 700} ${fs}px ${fam}`;
  try { (ctx as any).letterSpacing = (((o.ls || 0) * fs) / 100).toFixed(2) + 'px'; } catch { /* trình duyệt cũ */ }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const t = o.text || '';
  if (o.bg && !o.curve) {
    const w = ctx.measureText(t).width; const padX = fs * 0.4, padY = fs * 0.25, bw = w + padX * 2, bh = fs + padY * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(ctx, -bw / 2, -bh / 2, bw, bh, fs * 0.2); ctx.fill();
  }
  ctx.save();
  if (o.shadow) { ctx.shadowColor = 'rgba(0,0,0,.72)'; ctx.shadowBlur = fs * 0.28; ctx.shadowOffsetY = fs * 0.08; }
  ctx.lineWidth = fs * 0.11; ctx.strokeStyle = 'rgba(8,16,28,.9)'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  ctx.fillStyle = o.color || '#ffffff';
  const one = (ch: string) => { if (o.outline) ctx.strokeText(ch, 0, 0); ctx.fillText(ch, 0, 0); };
  if (o.curve) arcText(ctx, t, o.curve, one); else one(t);
  ctx.restore();
  try { (ctx as any).letterSpacing = '0px'; } catch { /* bỏ qua */ }
}
/**
 * ══ CHỐT KHUNG CHO TỪNG THUỘC TÍNH ══
 * Trước giờ một đối tượng chỉ có MỘT cỡ, MỘT góc xoay, chạy đều từ đầu tới cuối. Muốn "giây thứ 2 xe
 * mới tới ngã ba, giây thứ 4 phóng to lên rồi dừng" thì chịu.
 * Chốt khung chữa đúng chỗ đó: bấm ◇ là ghi lại "tại giây này, giá trị là chừng này". Giữa hai chốt
 * máy tự tính dần đều, nên chuyển động mượt chứ không nhảy cóc.
 * (Đây là thứ app tham chiếu có ở panel đối tượng: ◇ cạnh Vị trí trên tuyến, Kích thước, Xoay.)
 */
function giaTriChot(o: Obj, el: number, ten: 'viTri' | 'scale' | 'rot', macDinh: number): number {
  const ds = (o.chot || []).filter((c) => typeof c[ten] === 'number').sort((a, b) => a.t - b.t);
  if (!ds.length) return macDinh;
  const g = el - o.s;                                  // giây tính từ lúc lớp bắt đầu
  if (g <= ds[0].t) return ds[0][ten] as number;
  if (g >= ds[ds.length - 1].t) return ds[ds.length - 1][ten] as number;
  for (let i = 0; i < ds.length - 1; i++) {
    const a = ds[i], b = ds[i + 1];
    if (g >= a.t && g <= b.t) {
      const p = (g - a.t) / Math.max(0.001, b.t - a.t);
      const m = p * p * (3 - 2 * p);                   // vào/ra êm, không giật ở hai đầu
      return (a[ten] as number) + ((b[ten] as number) - (a[ten] as number)) * m;
    }
  }
  return macDinh;
}

function drawObj(ctx: CanvasRenderingContext2D, W: number, H: number, o: Obj, img: any, el: number) {
  if (o.hidden || el < o.s || el > o.e) return; const k = H / 1080; const cx = o.x * W, cy = o.y * H;
  const coChot = giaTriChot(o, el, 'scale', o.scale || 1);        // cỡ tại giây này
  const xoayChot = giaTriChot(o, el, 'rot', o.rot || 0);          // góc xoay tại giây này
  ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, o.opacity)); ctx.translate(cx, cy); ctx.rotate(xoayChot * Math.PI / 180);
  if (o.type === 'text') {
    // Mấy mẫu chạy chậm (đánh máy, lộ dần, quét sáng…) cho 1,4 giây; còn lại 0,6 giây — giống hệt tiêu đề.
    const cham = ['typewriter', 'wipe', 'shine', 'stamp', 'maskUp', 'boxShine', 'underline', 'goldline', 'ribbon'].includes(o.fx || '');
    const ap = Math.max(0, Math.min(1, (el - o.s) / (cham ? 1.4 : 0.6)));
    paintObjText(ctx, o, (o.size || 48) * k * coChot, ap);
  } else if (o.type === 'xe') {
    // Phương tiện: cỡ tính theo chiều cao khung hình để 720p hay 1080p đều cân đối.
    const xe = XE_LIST.find((v) => v.key === o.xk) || XE_LIST[0];
    drawXe(ctx, xe.key, 96 * k * coChot * xe.co, o.color || xe.mau, el - o.s);
  } else if (o.type === 'widget') {
    const wk = WIDGETS.find((x) => x.key === o.wk) || WIDGETS[0];
    const ww = W * wk.w * coChot;
    drawWidget(ctx, wk.key, 0, 0, ww, o.wd || wk.d, Math.max(0, Math.min(1, (el - o.s) / 0.5)), el - o.s);
  } else if ((o.type === 'image' || o.type === 'video') && img) { const w = 300 * k * coChot, h = w / (o.aspect || 1.5); try { ctx.drawImage(img, -w / 2, -h / 2, w, h); } catch { /* video chưa sẵn frame */ } }
  ctx.restore();
}
// Nội suy camera theo keyframe tại thời điểm el (giây).
function camAtTime(keys: CamKeyframe[], el: number): { lng: number; lat: number; zoom: number; pitch: number; bearing: number } {
  const ks = [...keys].sort((a, b) => a.t - b.t); const n = ks.length;
  if (el <= ks[0].t) return ks[0]; if (el >= ks[n - 1].t) return ks[n - 1];
  const L = (a: number, b: number, t: number) => a + (b - a) * t;
  for (let i = 0; i < n - 1; i++) {
    if (el >= ks[i].t && el <= ks[i + 1].t) {
      const a = ks[i], b = ks[i + 1]; const raw = (el - a.t) / ((b.t - a.t) || 1);
      const lt = easeAt(a.ease, raw);                                  // đường cong chung
      const lz = easeAt(a.easeZoom || a.ease, raw);                    // riêng cho phóng to
      const lp = easeAt(a.easePitch || a.ease, raw);                   // riêng cho độ nghiêng
      const lb = easeAt(a.easeBearing || a.ease, raw);                 // riêng cho hướng xoay
      let db = b.bearing - a.bearing; if (db > 180) db -= 360; if (db < -180) db += 360;
      return { lng: L(a.lng, b.lng, lt), lat: L(a.lat, b.lat, lt), zoom: L(a.zoom, b.zoom, lz), pitch: L(a.pitch, b.pitch, lp), bearing: a.bearing + db * lb };
    }
  }
  return ks[n - 1];
}
function mkSettings(key: string, name = 'Đất nền Cam Lâm', phone = '0567 442 996'): Settings {
  // Tiêu đề CHỈ là tên dự án — KHÔNG ghép nhãn kịch bản (Vị trí/Dẫn đường…) vào video.
  return { title: name, sub: 'Liên hệ: ' + phone, layout: 'bottomLeft', orient: '16:9', res: '1080', duration: 8, base: 'sat', parcelFx: 'glow', parcelColor: '#C8A14B', chartOn: false, chartTitle: 'Lượt quan tâm theo ngày', chartType: 'bar', chartRaw: 'T2:80, T3:120, T4:150, T5:190, T6:250, T7:300', subs: [], textAnim: 'fade' };
}
// Tự sinh LỜI THOẠI (caption theo thời gian) cho từng kịch bản — để "ghi kịch bản vào video".
function genScript(key: string, p: { name?: string; address?: string; area?: string; price?: string; phone?: string }, dur: number): Sub[] {
  const name = p.name?.trim() || 'Dự án'; const area = p.area?.trim(); const price = p.price?.trim(); const phone = p.phone?.trim() || ''; const addr = p.address?.trim();
  const L: Record<string, string[]> = {
    vitri: [name, addr ? `Vị trí: ${addr}` : 'Vị trí đắc địa, kết nối vùng', 'Ranh giới dự án rõ ràng'],
    hatang: ['Hạ tầng kết nối đồng bộ', 'Gần cao tốc – quốc lộ', 'Liền kề sân bay & tuyến chính'],
    tienich: ['Tiện ích bao quanh', 'Trường học – chợ – bệnh viện', 'Gần biển, tiện an cư'],
    dautu: ['Cơ hội đầu tư hấp dẫn', 'Khu vực phát triển mạnh', price ? `Chỉ từ ${price}` : 'Tiềm năng tăng trưởng'],
    banhang: [name, [area && `DT ${area}m²`, price && `Giá ${price}`].filter(Boolean).join(' – ') || 'Sản phẩm mở bán', phone ? `Liên hệ: ${phone}` : 'Liên hệ ngay'],
    chiduong: ['Từ trung tâm tới dự án', 'Lộ trình thuận tiện', `Điểm đến: ${name}`],
    cd_sat: ['Đường vào dự án', 'Đường nhựa rộng rãi, xe tải vào tận nơi', `Tới ngay ${name}`],
    cd_capmat: ['Chạy thử một vòng đường vào', 'Mặt đường phẳng lì, hai xe tránh nhau thoải mái', `Vài phút là tới ${name}`],
    cd_cao: ['Nhìn từ trên cao toàn tuyến đường', 'Đi qua trung tâm xã, khu dân cư đông đúc', `Cả chặng chỉ ngần này là tới ${name}`],
    cd_ketlo: ['Từ trung tâm chạy về dự án', addr ? `Đường vào: ${addr}` : 'Lộ trình thuận tiện', `Đây rồi — ${name}`],
  };
  const lines = (L[key] || [name]).filter(Boolean) as string[];
  const n = lines.length || 1; const seg = Math.max(1, dur) / n;
  return lines.map((t, i) => ({ s: +(i * seg).toFixed(1), e: +Math.min(dur, (i + 1) * seg).toFixed(1), t }));
}
// Nhập phụ đề từ SRT/VTT → mảng {s,e,t}.
function parseSrtVtt(text: string): Sub[] {
  const toSec = (s: string) => { const x = s.trim().replace(',', '.'); const m = x.match(/(\d+):(\d+):(\d+(?:\.\d+)?)/); if (m) return +m[1] * 3600 + +m[2] * 60 + parseFloat(m[3]); const m2 = x.match(/(\d+):(\d+(?:\.\d+)?)/); return m2 ? +m2[1] * 60 + parseFloat(m2[2]) : 0; };
  const out: Sub[] = [];
  for (const b of text.replace(/\r/g, '').split(/\n\n+/)) {
    const lines = b.split('\n').filter((l) => l.trim() !== '');
    const tl = lines.find((l) => l.includes('-->')); if (!tl) continue;
    const [a, c] = tl.split('-->'); const s = toSec(a), e = toSec(c);
    const t = lines.slice(lines.indexOf(tl) + 1).join(' ').trim();
    if (t && e > s) out.push({ s: +s.toFixed(1), e: +e.toFixed(1), t });
  }
  return out;
}
type Layout = 'bottomLeft' | 'bottomCenter' | 'topLeft' | 'card';
// PHASE 8: MẪU BĐS 1-chạm — set bố cục + khổ + hiệu ứng + camera + lời thoại thật vào kịch bản đang mở.
type Tpl = { key: string; name: string; layout: Layout; orient: '16:9' | '9:16' | '1:1' | '4:5'; fx: 'glow' | 'blink' | 'ants' | 'static'; color: string; cam: string; chartOn: boolean; lines: string[] };
const TEMPLATES: Tpl[] = [
  { key: 'vitri', name: 'Vị trí', layout: 'bottomLeft', orient: '16:9', fx: 'glow', color: '#C8A14B', cam: 'vitri', chartOn: false, lines: ['Vị trí đắc địa', 'Kết nối trung tâm', 'Ranh dự án rõ ràng'] },
  { key: 'sanbay', name: 'Gần sân bay', layout: 'topLeft', orient: '16:9', fx: 'ants', color: '#ff3b30', cam: 'hatang', chartOn: false, lines: ['Liền kề sân bay', 'Di chuyển thuận tiện', 'Kết nối vùng nhanh'] },
  { key: 'bien', name: 'Gần biển', layout: 'bottomCenter', orient: '9:16', fx: 'glow', color: '#22c55e', cam: 'tienich', chartOn: false, lines: ['Gần biển trong xanh', 'Không khí trong lành', 'An cư – nghỉ dưỡng'] },
  { key: 'hatang', name: 'Hạ tầng', layout: 'topLeft', orient: '16:9', fx: 'ants', color: '#ff3b30', cam: 'hatang', chartOn: false, lines: ['Hạ tầng đồng bộ', 'Cao tốc – quốc lộ', 'Phát triển mạnh'] },
  { key: 'tienich', name: 'Tiện ích', layout: 'bottomCenter', orient: '1:1', fx: 'glow', color: '#22c55e', cam: 'tienich', chartOn: false, lines: ['Tiện ích bao quanh', 'Trường – chợ – bệnh viện', 'Sống tiện nghi'] },
  { key: 'datnen', name: 'Đất nền', layout: 'card', orient: '16:9', fx: 'blink', color: '#C8A14B', cam: 'banhang', chartOn: false, lines: ['Đất nền sổ đỏ', 'Pháp lý rõ ràng', 'Xây dựng tự do'] },
  { key: 'dautu', name: 'Đầu tư', layout: 'card', orient: '16:9', fx: 'glow', color: '#3b82f6', cam: 'dautu', chartOn: true, lines: ['Cơ hội đầu tư', 'Tăng trưởng bền vững', 'Sinh lời hấp dẫn'] },
  { key: 'banhang', name: 'Bán hàng', layout: 'bottomCenter', orient: '9:16', fx: 'blink', color: '#C8A14B', cam: 'banhang', chartOn: false, lines: ['Mở bán giai đoạn mới', 'Ưu đãi hấp dẫn', 'Liên hệ ngay'] },
  { key: 'chiduong', name: 'Dẫn đường', layout: 'bottomLeft', orient: '16:9', fx: 'glow', color: '#f97316', cam: 'chiduong', chartOn: false, lines: ['Từ trung tâm tới dự án', 'Lộ trình thuận tiện', 'Điểm đến dự án'] },
];
// KHỔ MÀN HÌNH theo NƠI ĐĂNG — mỗi nơi một tỉ lệ khác nhau, đăng sai khổ là bị cắt mất chữ.
const KHO_MAN: { key: '16:9' | '9:16' | '1:1' | '4:5'; ten: string; note: string; px: string }[] = [
  { key: '16:9', ten: '📺 YouTube · Facebook · Web', note: 'Ngang — chuẩn cho YouTube, Facebook, gửi Zalo, chiếu máy tính', px: '1920×1080' },
  { key: '9:16', ten: '📱 TikTok · Reels · Shorts', note: 'Dọc kín màn hình điện thoại — hút xem nhất hiện nay', px: '1080×1920' },
  { key: '4:5', ten: '📸 Instagram · Facebook dọc', note: 'Dọc vừa phải — chiếm nhiều chỗ trên bảng tin mà không bị cắt', px: '1080×1350' },
  { key: '1:1', ten: '⬛ Vuông (bảng tin · quảng cáo)', note: 'Vuông — an toàn cho mọi nơi, hay dùng chạy quảng cáo', px: '1080×1080' },
];
const LAYOUTS: { key: Layout; name: string }[] = [
  { key: 'bottomLeft', name: 'Dưới trái' },
  { key: 'bottomCenter', name: 'Giữa dưới' },
  { key: 'topLeft', name: 'Trên trái' },
  { key: 'card', name: 'Khung thẻ' },
];

// ── CHUYỂN ĐỘNG CAMERA RIÊNG CHO TỪNG KỊCH BẢN — để 5 video KHÁC HẲN nhau (không phải cùng 1 cú bay). ──
// Mỗi keyframe: t∈[0,1] · dz = lệch zoom so với khung vừa · pitch (độ nghiêng) · bear (độ xoay so với hướng đầu).
type CamKF = { t: number; dz: number; pitch: number; bear: number };
const CAM: Record<string, CamKF[]> = {
  vitri:   [{ t: 0, dz: -2.6, pitch: 0, bear: 0 },   { t: 0.55, dz: -1.0, pitch: 22, bear: 8 },  { t: 1, dz: 0.3, pitch: 42, bear: 16 }],  // Định vị: bay xa → hạ dần vào lô (giữ tuyến trong khung)
  hatang:  [{ t: 0, dz: -1.0, pitch: 40, bear: -30 },{ t: 0.5, dz: -0.4, pitch: 50, bear: 22 },  { t: 1, dz: 0.0, pitch: 50, bear: 78 }],  // Kết nối: nghiêng vừa, quét ngang khoe tuyến/hạ tầng
  tienich: [{ t: 0, dz: 0.1, pitch: 48, bear: 0 },   { t: 0.5, dz: 0.2, pitch: 48, bear: 170 },  { t: 1, dz: 0.1, pitch: 48, bear: 320 }],// Tiện ích: XOAY QUANH lô khoe xung quanh
  dautu:   [{ t: 0, dz: -2.2, pitch: 32, bear: -20 },{ t: 0.5, dz: -0.6, pitch: 50, bear: 15 },   { t: 1, dz: 0.6, pitch: 54, bear: 45 }], // Đầu tư: điện ảnh, đẩy sát dần (dolly-in)
  banhang: [{ t: 0, dz: 0.3, pitch: 48, bear: -10 }, { t: 0.4, dz: 0.7, pitch: 52, bear: 5 },    { t: 1, dz: 1.0, pitch: 54, bear: 22 }], // Bán hàng: bám sát lô, nhịp nhanh, chốt deal
  // Toàn cảnh: LUÔN giữ trọn lô + tuyến trong khung (dz ≤ 0 = không zoom sát), chỉ nghiêng/xoay nhẹ.
  overview:  [{ t: 0, dz: -0.35, pitch: 0, bear: 0 },  { t: 0.5, dz: -0.2, pitch: 18, bear: 12 },  { t: 1, dz: -0.3, pitch: 22, bear: -6 }],
  // ── KIỂU QUAY ĐIỆN ẢNH CAO CẤP ──
  orbit360:  [{ t: 0, dz: 0.0, pitch: 52, bear: 0 },   { t: 0.5, dz: 0.2, pitch: 56, bear: 180 }, { t: 1, dz: 0.0, pitch: 52, bear: 360 }],   // Flycam xoay trọn 360°
  spiral:    [{ t: 0, dz: -2.0, pitch: 18, bear: 0 },  { t: 0.5, dz: -0.6, pitch: 45, bear: 200 },{ t: 1, dz: 0.5, pitch: 60, bear: 400 }],   // Xoáy ốc: vừa xoay vừa hạ vào lô
  crane:     [{ t: 0, dz: 0.5, pitch: 66, bear: 12 },  { t: 0.5, dz: 0.1, pitch: 42, bear: 0 },   { t: 1, dz: -0.5, pitch: 12, bear: -8 }],   // Cần cẩu nâng: từ sát mặt vươn lên nhìn xuống
  lowsweep:  [{ t: 0, dz: 0.7, pitch: 70, bear: -45 }, { t: 0.5, dz: 0.5, pitch: 68, bear: 0 },   { t: 1, dz: 0.6, pitch: 70, bear: 50 }],    // Lướt thấp sát mặt đất, quét ngang
  reveal:    [{ t: 0, dz: -0.4, pitch: 0, bear: 0 },   { t: 0.4, dz: -0.2, pitch: 8, bear: 4 },   { t: 1, dz: 0.4, pitch: 60, bear: 30 }],    // Lộ diện: từ nhìn thẳng xuống nghiêng dần ra 3D
  cinematic: [{ t: 0, dz: -0.5, pitch: 48, bear: -8 }, { t: 0.5, dz: -0.1, pitch: 54, bear: 6 },  { t: 1, dz: 0.3, pitch: 58, bear: 20 }],    // Điện ảnh chậm: đẩy nhẹ, xoay nhẹ, sang trọng
  energetic: [{ t: 0, dz: -1.0, pitch: 40, bear: -20 },{ t: 0.25, dz: 0.5, pitch: 58, bear: 12 }, { t: 0.5, dz: -0.4, pitch: 44, bear: -12 }, { t: 0.75, dz: 0.6, pitch: 60, bear: 20 }, { t: 1, dz: 0.1, pitch: 50, bear: 0 }], // Sôi động: zoom giật nhịp
  boomerang: [{ t: 0, dz: 0.1, pitch: 50, bear: 0 },   { t: 0.5, dz: 0.3, pitch: 56, bear: 95 },  { t: 1, dz: 0.1, pitch: 50, bear: -12 }],   // Vòng cung: lượn ra rồi vòng lại
};
function camAt(kf: CamKF[], p: number): { dz: number; pitch: number; bear: number } {
  let a = kf[0], b = kf[kf.length - 1];
  for (let i = 0; i < kf.length - 1; i++) { if (p >= kf[i].t && p <= kf[i + 1].t) { a = kf[i]; b = kf[i + 1]; break; } }
  const span = (b.t - a.t) || 1; let lt = (p - a.t) / span; lt = lt * lt * (3 - 2 * lt); // smoothstep cho mượt
  return { dz: a.dz + (b.dz - a.dz) * lt, pitch: a.pitch + (b.pitch - a.pitch) * lt, bear: a.bear + (b.bear - a.bear) * lt };
}
const CAM_PAD: Record<string, number> = { vitri: 200, hatang: 230, tienich: 150, dautu: 190, banhang: 120, overview: 70 };
const KEYSLUG: Record<string, string> = { vitri: 'VI_TRI', hatang: 'HA_TANG', tienich: 'TIEN_ICH', dautu: 'DAU_TU', banhang: 'BAN_HANG', chiduong: 'DAN_DUONG', cd_sat: 'DAN_DUONG_SAT', cd_ketlo: 'DUONG_TOI_THUA', cd_tren: 'DAN_DUONG_TREN', cd_dienanh: 'DAN_DUONG_DIEN_ANH', cd_capmat: 'DAN_DUONG_CUC_THAP', cd_cao: 'DAN_DUONG_BAY_CAO' };
const slugName = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase() || 'VIDEO';

// ── CỘT CÔNG CỤ (như MapEffect): mỗi ô = 1 việc. 'mode' = vẽ trên bản đồ, 'panel' = mở bảng cài đặt. ──
type Tool = { key: string; icon: string; name: string; mode?: Mode; panel?: string; hint: string };
const TOOLGROUPS: { title: string; items: Tool[] }[] = [
  { title: 'Vẽ trên bản đồ', items: [
    { key: 'sel', icon: '▷', name: 'Chọn', mode: 'none', hint: 'Thôi vẽ, chỉ xem bản đồ' },
    { key: 'parcel', icon: '▱', name: 'Khoanh lô', mode: 'parcel', panel: 'lodat', hint: 'Bấm lần lượt các điểm quanh lô đất' },
    { key: 'route', icon: '➛', name: 'Vẽ tuyến', mode: 'route', panel: 'tuyen', hint: 'Vẽ tuyến + chỉnh chiều chạy, tốc độ, màu' },
    { key: 'edit', icon: '✎', name: 'Sửa đỉnh', mode: 'edit', hint: 'Kéo chấm trắng để dời · bấm để xoá' },
  ] },
  { title: 'Lấy sẵn, khỏi vẽ', items: [
    { key: 'zone', icon: '🗺', name: 'Tìm vùng', panel: 'vung', hint: 'Gõ tên xã/phường → tự khoanh ranh giới' },
    { key: 'dir', icon: '🚗', name: 'Chỉ đường', mode: 'dir', panel: 'tuyen', hint: 'Bấm điểm đi rồi điểm đến → tuyến đường thật, chỉnh kiểu vẽ ngay bên phải' },
  ] },
  { title: 'Đánh dấu tiện ích', items: [
    { key: 'callout', icon: '💬', name: 'Thẻ chú thích', mode: 'callout', panel: 'the', hint: 'Thẻ có dây nối + khoảng cách tới lô' },
    { key: 'marker', icon: '📍', name: 'Ghim', mode: 'marker', panel: 'ghim', hint: 'Ghim giọt nước · chấm · radar' },
    { key: 'muiten', icon: '➤', name: 'Mũi tên', mode: 'muiten', panel: 'muiten', hint: 'Vạch gạch đứt từ lô đất bắn ra chỗ nổi tiếng' },
    { key: 'radius', icon: '⭕', name: 'Bán kính', mode: 'radius', panel: 'bankinh', hint: 'Vòng tròn quanh 1 điểm' },
    { key: 'dist', icon: '📏', name: 'Đo', mode: 'distance', hint: 'Bấm 2 điểm để đo khoảng cách' },
  ] },
  { title: 'Nội dung video', items: [
    { key: 'duan', icon: '🏡', name: 'Dự án', panel: 'duan', hint: 'Tên · giá · diện tích · liên hệ · mẫu nhanh' },
    { key: 'chu', icon: '✏️', name: 'Chữ & lời', panel: 'chu', hint: 'Tiêu đề, bố cục, lời thoại' },
    { key: 'camera', icon: '🎥', name: 'Camera', panel: 'camera', hint: 'Kiểu bay · chốt từng khung (keyframe) · khoá nhìn vào lô' },
    { key: 'media', icon: '🖼', name: 'Ảnh · Video', panel: 'media', hint: 'Chèn ảnh, video, thư viện đã dùng' },
    { key: 'chart', icon: '📊', name: 'Biểu đồ', panel: 'bieudo', hint: 'Biểu đồ động trong video' },
  ] },
  { title: 'Làm đẹp', items: [
    { key: 'mau', icon: '🎨', name: 'Màu bản đồ', panel: 'mau', hint: 'Làm ảnh vệ tinh tươi hơn: cây xanh mướt, biển trong' },
    { key: 'lodat', icon: '✨', name: 'Lô đất', panel: 'lodat', hint: 'Hiệu ứng viền, ảnh trong lô, 3D' },
    { key: 'screen', icon: '🎬', name: 'Mở · Kết', panel: 'manhinh', hint: 'Màn mở đầu & kết thúc, nền động' },
    { key: 'audio', icon: '🔊', name: 'Âm thanh', panel: 'amthanh', hint: 'Nhạc nền, giọng đọc, tiếng động' },
    { key: 'out', icon: '⚙️', name: 'Xuất', panel: 'xuat', hint: 'Thời lượng, chất lượng, logo, phiên bản' },
  ] },
];

// ── Hình học cho Bán kính & Khoảng cách ──
function circleRing(lng: number, lat: number, rMeters: number, n = 64): [number, number][] {
  const ring: [number, number][] = []; const dLat = rMeters / 111320; const dLng = rMeters / (111320 * Math.cos((lat * Math.PI) / 180) || 1e-6);
  for (let i = 0; i <= n; i++) { const a = (i / n) * 2 * Math.PI; ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]); }
  return ring;
}
function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000, toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b[1] - a[1]), dLng = toR(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a[1])) * Math.cos(toR(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
// CHỮ HIỆN TRÊN BẢN ĐỒ — chỉ giữ ký tự có trong bộ phông đã tải sẵn (tiếng Việt đủ dấu + dấu câu).
// Ký tự lạ (emoji…) phải bỏ: thiếu phông cho MỘT ký tự là MapLibre tắt luôn CẢ lớp chữ & ghim.
function chuBanDo(t: string): string {
  return Array.from(t || '').filter((ch) => { const c = ch.codePointAt(0) || 0; return c < 0x200 || (c >= 0x1e00 && c <= 0x1eff) || (c >= 0x2000 && c <= 0x20ff); }).join('').replace(/\s+/g, ' ').trim();
}
const fmtDist = (m: number) => (m >= 1000 ? (m / 1000).toFixed(m >= 10000 ? 0 : 1) + ' km' : Math.round(m) + ' m');
// DIỆN TÍCH một vòng đa giác, ra mét vuông. Chiếu phẳng quanh vĩ độ trung bình của chính lô đó
// nên với thửa đất vài trăm mét thì sai số không đáng kể.
function ringAreaM2(ring: [number, number][]): number {
  if (ring.length < 3) return 0;
  const R = 6378137, toR = Math.PI / 180;
  const lat0 = (ring.reduce((s, p) => s + p[1], 0) / ring.length) * toR;
  const xy = ring.map((p) => [p[0] * toR * R * Math.cos(lat0), p[1] * toR * R]);
  let a = 0;
  for (let i = 0; i < xy.length; i++) { const j = (i + 1) % xy.length; a += xy[i][0] * xy[j][1] - xy[j][0] * xy[i][1]; }
  return Math.abs(a) / 2;
}
const fmtArea = (m2: number) => (m2 >= 10000 ? (m2 / 10000).toFixed(m2 >= 100000 ? 0 : 2) + ' ha' : Math.round(m2).toLocaleString('vi-VN') + ' m²');
// ĐIỂM NHẤN (POI): chọn được kiểu hiển thị — chấm tròn, ghim giọt nước, hay vòng radar lan toả.
// anim = kiểu nhúc nhích RIÊNG của con ghim này · rfx = kiểu radar riêng.
// (Trước đây hiệu ứng đặt chung cho cả lớp nên đổi một cái là đổi hết mọi ghim đã cắm.)
type Marker = { lng: number; lat: number; label: string; kind?: 'dot' | 'pin' | 'radar'; color?: string; shape?: string; icon?: string; anim?: string; rfx?: string; minz?: number; daBan?: boolean };   // minz = phóng bản đồ tới mức này ghim mới hiện (0 = luôn hiện)
// BIỂU TƯỢNG TIỆN ÍCH có thể cắm vào giữa ghim (dáng ghim xem ở PIN_FAMILIES bên dưới).
const PIN_ICONS: { key: string; name: string }[] = [
  { key: 'truong', name: 'Trường học' }, { key: 'cho', name: 'Chợ' }, { key: 'sieuthi', name: 'Siêu thị' },
  { key: 'benhvien', name: 'Bệnh viện' }, { key: 'ubnd', name: 'UBND' }, { key: 'nganhang', name: 'Ngân hàng' },
  { key: 'bien', name: 'Biển' }, { key: 'congvien', name: 'Công viên' }, { key: 'nui', name: 'Núi · đồi' },
  { key: 'golf', name: 'Sân golf' }, { key: 'resort', name: 'Khách sạn · Resort' }, { key: 'anuong', name: 'Nhà hàng' },
  { key: 'cafe', name: 'Cà phê' }, { key: 'sanbay', name: 'Sân bay' }, { key: 'gatau', name: 'Ga tàu' },
  { key: 'benxe', name: 'Bến xe' }, { key: 'duong', name: 'Cao tốc' }, { key: 'xang', name: 'Cây xăng' },
  { key: 'kcn', name: 'Khu công nghiệp' }, { key: 'chua', name: 'Chùa · Nhà thờ' }, { key: 'toanha', name: 'Căn hộ · Toà nhà' },
  { key: 'nha', name: 'Dự án' }, { key: 'sao', name: 'Điểm nhấn' }, { key: 'dot', name: 'Chấm tròn' },
  // 5 biểu tượng bổ sung cho đủ bộ như app tham chiếu (nét lấy từ Lucide, cùng giấy phép ISC).
  { key: 'vitri', name: 'Vị trí của bạn' }, { key: 'laban', name: 'La bàn' }, { key: 'dulich', name: 'Khu du lịch' },
  { key: 'congtruong', name: 'Công trường' }, { key: 'thoitiet', name: 'Thời tiết' },
];
// CHUYỂN ĐỘNG CỦA GHIM — mỗi kiểu một cảm giác khác nhau, xem trước ngay trong bảng chọn.
const PIN_ANIMS: { key: string; name: string; note: string }[] = [
  { key: 'nhun', name: 'Nhún nhẹ', note: 'Ghim nhún lên xuống đều đều — hợp mọi cảnh' },
  { key: 'nhiptim', name: 'Nhịp tim', note: 'Nảy hai nhịp rồi nghỉ, quầng sáng bung theo' },
  { key: 'songlan', name: 'Sóng lan', note: 'Vòng sóng toả ra từ chân ghim' },
  { key: 'roixuong', name: 'Rơi xuống', note: 'Thả từ trên cao rơi xuống rồi nảy — bắt mắt nhất' },
  { key: 'toasang', name: 'Toả sáng', note: 'Quầng sáng phập phồng quanh ghim, rất sang' },
  { key: 'lacnhe', name: 'Lắc lư', note: 'Đung đưa qua lại như treo lơ lửng' },
  { key: 'nhapnhay', name: 'Nhấp nháy', note: 'Mờ tỏ liên tục, dùng để cảnh báo/nhấn mạnh' },
  { key: 'yenlang', name: 'Đứng yên', note: 'Không động, cho video nghiêm túc' },
];
// ══ BỘ SƯU TẬP GHIM — chọn KIỂU trước, rồi chọn TIỆN ÍCH theo tên; màu và chuyển động đã đặt sẵn.
// Mỗi "kiểu" là một dáng ghim + tông màu + kiểu nhúc nhích hợp với nó, khỏi phải tự phối 3 thứ.
// demo  = 3 biểu tượng LÀM MẪU cho kiểu này (bảng chọn hiện 3 con ghim khác nhau, không phải 3 con y hệt).
// tones = các TÔNG MÀU của kiểu (vàng · bạc · xanh · đỏ…). Kiểu 'auto' thì màu chạy theo loại tiện ích.
type PinFamily = { key: string; name: string; note: string; shape: string; color: string; anim: string; demo: string[]; tones?: string[] };
// ══ ĐÃ DỌN BỚT: THÀ ÍT MÀ KHÁC NHAU ══
// Trước đây có 32 kiểu, nhưng phần lớn chỉ khác nhau CÁI VỎ (tròn, hộp, đa giác, giọt) còn bố cục
// thì y hệt: một cái vỏ, biểu tượng nằm giữa. Bày ra 32 ô mà nhìn na ná nhau chỉ làm người dùng
// rối mắt và khó chọn. Nay giữ lại mỗi nhóm một đại diện, cộng 5 bố cục thật sự khác:
// huy hiệu có tên · biển vàng đuôi nhọn · ô kính mờ · biển rao bán hai chân · biển treo một cột.
// LƯU Ý: phần VẼ của các kiểu đã bỏ vẫn còn nguyên trong code — dự án cũ đã lưu kiểu nào thì mở lên
// vẫn hiện đúng như thế, chỉ là không bày trong bảng chọn nữa.
const PIN_FAMILIES: PinFamily[] = [
  { key: 'icondong', name: 'Icon động', note: '24 icon phát sáng, mỗi tiện ích một màu — nhúc nhích cả trong video', shape: 'neon', color: 'auto', anim: 'nhun', demo: ['truong', 'bien', 'cafe'] },
  { key: 'huyhieu', name: 'Huy hiệu lục giác', note: 'Lục giác đặc, biểu tượng khoét chìm — sang và rõ trên ảnh vệ tinh', shape: 'goldhex', color: '#C8A14B', anim: 'nhun', demo: ['resort', 'golf', 'nha'], tones: ['#C8A14B', '#cbd5e1', '#0ea5e9', '#ef4444'] },
  { key: 'radar', name: 'Radar', note: '4 kiểu vùng phủ: quét nan · sóng lan · quầng thở · cung xoay', shape: 'radar', color: '#a855f7', anim: 'songlan', demo: [], tones: ['#a855f7', '#06b6d4', '#f59e0b', '#22c55e'] },
  { key: 'phatsangkhoet', name: 'Vị trí của bạn', note: 'Ghim phát sáng khoét lỗ giữa, nhịp như nhịp tim', shape: 'neonhole', color: 'auto', anim: 'nhiptim', demo: ['nha', 'sao', 'dot'] },
  { key: 'giotkinh', name: 'Giọt kính trong', note: 'Kính mờ nhìn xuyên thấy bản đồ — nhẹ và sang', shape: 'giotkinh', color: '#38bdf8', anim: 'toasang', demo: ['bien', 'resort', 'congvien'], tones: ['#38bdf8', '#C8A14B', '#a855f7', '#22c55e'] },
  { key: 'mensu', name: 'Huy hiệu men sứ', note: 'Vành trắng dày, ruột bóng như huy hiệu cài áo', shape: 'mensu', color: '#e11d48', anim: 'nhun', demo: ['nha', 'ubnd', 'benhvien'], tones: ['#e11d48', '#C8A14B', '#2563eb', '#0f766e'] },
  { key: 'nhantrang', name: 'Nhãn tên · nền trắng', note: 'Tên tiện ích nằm ngay trong ghim — nhìn ra dáng nhãn địa điểm', shape: 'nhantrang', color: '#0A2540', anim: 'nhun', demo: ['truong', 'cho', 'bien'], tones: ['#0A2540', '#e11d48', '#2563eb', '#16a34a'] },
  { key: 'thechip', name: 'Chip nổi', note: 'Chip nhỏ bo tròn nổi phía trên, mũi nhọn chỉ xuống điểm — gọn, ít che ảnh nền', shape: 'thechip', color: '#C8A14B', anim: 'nhun', demo: ['cafe', 'anuong', 'sieuthi'], tones: ['#C8A14B', '#38bdf8', '#e11d48', '#22c55e'] },
  { key: 'thanhduoi', name: 'Thanh dưới chấm', note: 'Chấm neo ở trên, thanh chữ nằm dưới — kiểu chú thích ảnh báo chí', shape: 'thanhduoi', color: '#38bdf8', anim: 'nhun', demo: ['bien', 'nui', 'congvien'], tones: ['#38bdf8', '#C8A14B', '#f472b6', '#22c55e'] },
  { key: 'thevuong', name: 'Thẻ vuông', note: 'Ô biểu tượng nằm trên, tên nằm dưới, nền trắng — đứng đắn và dễ đọc nhất', shape: 'thevuong', color: '#0A2540', anim: 'nhun', demo: ['truong', 'benhvien', 'ubnd'], tones: ['#0A2540', '#e11d48', '#2563eb', '#16a34a'] },
  { key: 'nhanvienthuoc', name: 'Nhãn viên thuốc', note: 'Nhãn bo tròn hai đầu, chấm màu bên trái — nhẹ nhàng, hiện đại, ít che ảnh', shape: 'nhanvienthuoc', color: '#2563eb', anim: 'nhun', demo: ['bien', 'cafe', 'congvien'], tones: ['#2563eb', '#C8A14B', '#e11d48', '#16a34a'] },
  { key: 'bienrao', name: 'Biển rao bán', note: 'Tấm tôn sơn màu — chọn cách gắn: hai chân, một cột, treo xích hay đỉnh vòm', shape: 'bienrao', color: '#e11d48', anim: 'nhun', demo: ['nha', 'toanha', 'dulich'], tones: ['#e11d48', '#C8A14B', '#2563eb', '#16a34a'] },
  { key: 'huyhieuten', name: 'Huy hiệu có tên', note: 'Đĩa kim loại có ánh sáng hắt, tên gắn trong khung ngay dưới — trang trọng', shape: 'huyhieuten', color: '#C8A14B', anim: 'nhun', demo: ['truong', 'ubnd', 'chua'], tones: ['#C8A14B', '#5eb0e5', '#e11d48', '#16a34a'] },
  { key: 'calloutvang', name: 'Biển vàng đuôi nhọn', note: 'Tấm biển bo góc, mũi nhọn chỉ đúng điểm — đọc rõ nhất từ xa', shape: 'calloutvang', color: '#C8A14B', anim: 'nhun', demo: ['nha', 'toanha', 'resort'], tones: ['#C8A14B', '#e5c76b', '#f0a5a5', '#5eb0e5'] },
  { key: 'okinh', name: 'Ô kính mờ', note: 'Tấm kính trong mờ có chân cắm xuống đất — hiện đại, không che ảnh nền', shape: 'okinh', color: '#C8A14B', anim: 'nhun', demo: ['bien', 'golf', 'congvien'], tones: ['#C8A14B', '#5eb0e5', '#6ee7a8', '#f0a5a5'] },
];
// 4 kiểu RADAR (vùng phủ) — chọn ở trong nhóm "Radar".
const RADAR_FX: { key: string; name: string; note: string }[] = [
  { key: 'quetnan', name: 'Radar quét nan', note: 'Nan quạt sáng quay tròn như màn radar thật' },
  { key: 'songlan', name: 'Radar sóng lan', note: 'Ba vòng sóng nở dần rồi tan — nhấn mạnh cả khu' },
  { key: 'quangtho', name: 'Radar quầng thở', note: 'Quầng sáng phập phồng tại chỗ, êm và sang' },
  { key: 'cungxoay', name: 'Radar cung xoay', note: 'Một cung sáng chạy vòng quanh điểm' },
];
// MÀU GỢI Ý THEO LOẠI TIỆN ÍCH — bật "tự đổi màu" thì chọn biểu tượng nào ra màu nấy.
const ICON_COLOR: Record<string, string> = {
  truong: '#3b82f6', cho: '#f59e0b', sieuthi: '#f59e0b', benhvien: '#22c55e', ubnd: '#a855f7', nganhang: '#14b8a6',
  bien: '#06b6d4', congvien: '#22c55e', nui: '#65a30d', golf: '#10b981', resort: '#ec4899', anuong: '#fb7185',
  cafe: '#d97706', sanbay: '#38bdf8', gatau: '#0ea5e9', benxe: '#f97316', duong: '#f97316', xang: '#ef4444',
  kcn: '#64748b', chua: '#d946ef', toanha: '#6366f1', nha: '#8b5cf6', sao: '#eab308', dot: '#C8A14B',
  vitri: '#ef4444', laban: '#0ea5e9', dulich: '#14b8a6', congtruong: '#f59e0b', thoitiet: '#38bdf8',
};
// TỰ ĐOÁN BIỂU TƯỢNG THEO TÊN TIỆN ÍCH — dùng khi cắm hàng loạt ghim từ Excel.
// Đọc từ trên xuống, trúng từ khoá nào lấy biểu tượng nấy; không trúng gì thì ra ngôi sao.
const ICON_GUESS: [string, string[]][] = [
  ['truong', ['trường', 'truong', 'mầm non', 'mam non', 'đại học', 'dai hoc', 'cao đẳng']],
  ['benhvien', ['bệnh viện', 'benh vien', 'y tế', 'y te', 'phòng khám', 'trạm xá', 'trung tâm y']],
  ['vitri', ['vị trí', 'vi tri', 'định vị', 'dinh vi', 'chỗ này', 'toạ độ']],
  ['laban', ['la bàn', 'la ban', 'hướng', 'huong bac', 'phương vị']],
  ['dulich', ['du lịch', 'du lich', 'điểm đến', 'diem den', 'thắng cảnh', 'khu vui chơi']],
  ['congtruong', ['công trường', 'cong truong', 'đang xây', 'dang xay', 'thi công', 'thi cong', 'dự án đang']],
  ['thoitiet', ['thời tiết', 'thoi tiet', 'khí hậu', 'khi hau']],
  ['sieuthi', ['siêu thị', 'sieu thi', 'bách hoá', 'bach hoa', 'coopmart', 'winmart', 'bigc', 'go!']],
  ['cho', ['chợ', 'cho ', 'thương mại', 'thuong mai', 'tttm', 'trung tâm mua']],
  ['nganhang', ['ngân hàng', 'ngan hang', 'atm', 'agribank', 'vietcom', 'bidv', 'vietin']],
  ['ubnd', ['ubnd', 'uỷ ban', 'ủy ban', 'uy ban', 'hành chính', 'công an', 'cong an', 'toà án']],
  ['sanbay', ['sân bay', 'san bay', 'phi trường']],
  ['gatau', ['nhà ga', 'nha ga', 'đường sắt', 'duong sat', 'ga ']],
  ['benxe', ['bến xe', 'ben xe', 'trạm xe', 'xe buýt', 'xe buyt']],
  ['xang', ['xăng', 'xang', 'petrol', 'nhiên liệu']],
  ['golf', ['golf', 'gôn']],
  ['resort', ['resort', 'khách sạn', 'khach san', 'hotel', 'homestay', 'nghỉ dưỡng', 'nghi duong']],
  ['anuong', ['nhà hàng', 'nha hang', 'quán ăn', 'quan an', 'ẩm thực', 'am thuc', 'hải sản', 'hai san']],
  ['cafe', ['cà phê', 'ca phe', 'cafe', 'coffee', 'trà sữa', 'tra sua']],
  ['congvien', ['công viên', 'cong vien', 'quảng trường', 'quang truong', 'vườn hoa', 'cây xanh']],
  ['nui', ['núi', 'nui', 'đồi', 'doi ', 'thác', 'suối', 'hồ ']],
  ['bien', ['biển', 'bien', 'bãi', 'bai ', 'vịnh', 'vinh ', 'đầm', 'dam ', 'bờ kè']],
  ['kcn', ['khu công nghiệp', 'kcn', 'cụm công nghiệp', 'nhà máy', 'nha may', 'xí nghiệp']],
  ['chua', ['chùa', 'chua ', 'nhà thờ', 'nha tho', 'đình', 'miếu', 'thánh thất', 'tịnh xá']],
  ['toanha', ['căn hộ', 'can ho', 'chung cư', 'chung cu', 'toà nhà', 'toa nha', 'văn phòng', 'apartment']],
  ['duong', ['cao tốc', 'cao toc', 'quốc lộ', 'quoc lo', 'tỉnh lộ', 'đại lộ', 'đường ', 'duong ', 'nút giao', 'vòng xoay']],
  ['nha', ['dự án', 'du an', 'khu đô thị', 'khu do thi', 'kdt', 'khu dân cư', 'khu dan cu', 'phân lô', 'villa', 'biệt thự']],
];
function pickIcon(lowName: string): string {
  const t = (lowName || '').toLowerCase();
  for (const [key, words] of ICON_GUESS) if (words.some((w) => t.includes(w))) return key;
  return 'sao';
}
const PIN_COLORS: [string, string][] = [['#C8A14B', 'Vàng'], ['#ff3b30', 'Đỏ'], ['#3b82f6', 'Xanh dương'], ['#22c55e', 'Xanh lá'], ['#ffffff', 'Trắng'], ['#0A2540', 'Xanh đêm']];
// BIỂU TƯỢNG TIỆN ÍCH — dùng bộ icon **Lucide** (lucide.dev, giấy phép ISC, miễn phí cả khi bán hàng).
// Dữ liệu nét được chép sẵn vào đây nên KHÔNG phải tải gì lúc chạy và máy nào cũng hiện y hệt
// (trước đây dùng emoji thì nhiều máy ra ô vuông đen, còn tự vẽ tay thì nét thô, tỉ lệ lệch nhau).
// Mỗi biểu tượng vẽ trong khung 24×24, nét dày 2, đầu nét bo tròn — đúng chuẩn gốc của Lucide.
const GLYPHS: Record<string, { d: string[]; fill?: boolean }> = {
  truong: { d: ['M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z', 'M22 10v6', 'M6 12.5V16a6 3 0 0 0 12 0v-3.5'] },
  cho: { d: ['m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7', 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8', 'M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4', 'M2 7h20', 'M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7'] },
  sieuthi: { d: ['M7 21a1 1 0 1 0 2 0 1 1 0 1 0-2 0Z', 'M18 21a1 1 0 1 0 2 0 1 1 0 1 0-2 0Z', 'M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12'] },
  vitri: { d: ['m3 11 19-9-9 19-2-8-8-2z'] },
  laban: { d: ['M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20', 'm16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z'] },
  dulich: { d: ['M13 8c0-2.76-2.46-5-5.5-5S2 5.24 2 8h2l1-1 1 1h4', 'M13 7.14A5.82 5.82 0 0 1 16.5 6c3.04 0 5.5 2.24 5.5 5h-3l-1-1-1 1h-3', 'M5.89 9.71c-2.15 2.15-2.3 5.06-.35 7.01l4.24-4.24.7-.7.71-.71 2.12-2.12c-1.95-1.95-4.86-1.8-7.02.35z', 'M11 15.5c.5 2.5-.17 4.5-1 6.5h4c2-5.5-.5-12-1-14'] },
  congtruong: { d: ['M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1z', 'M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5', 'M4 15v-3a6 6 0 0 1 6-6', 'M14 6a6 6 0 0 1 6 6v3'] },
  thoitiet: { d: ['M12 2v2', 'm4.93 4.93 1.41 1.41', 'M20 12h2', 'm19.07 4.93-1.41 1.41', 'M15.947 12.65a4 4 0 0 0-5.925-4.128', 'M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z'] },
  benhvien: { d: ['M12 6v4', 'M14 14h-4', 'M14 18h-4', 'M14 8h-4', 'M18 12h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2', 'M18 22V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v18'] },
  ubnd: { d: ['M3 22h18', 'M6 18v-7', 'M10 18v-7', 'M14 18v-7', 'M18 18v-7', 'M12 2 20 7 4 7Z'] },
  nganhang: { d: ['M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z', 'M10 12a2 2 0 1 0 4 0 2 2 0 1 0-4 0Z', 'M6 12h.02', 'M18 12h.02'] },
  bien: { d: ['M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1', 'M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1', 'M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1'] },
  congvien: { d: ['M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z', 'M7 16v6', 'M13 19v3', 'M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5'] },
  nui: { d: ['m8 3 4 8 5-5 5 15H2L8 3z', 'M4.14 15.08c2.62-1.57 5.24-1.43 7.86.42 2.74 1.94 5.49 2 8.23.19'] },
  golf: { d: ['M7 22V2l10 5-10 5'] },
  resort: { d: ['M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z', 'M10 22v-6.57', 'M14 15.43V22', 'M15 16a5 5 0 0 0-6 0', 'M12 11h.02', 'M12 7h.02', 'M16 11h.02', 'M16 7h.02', 'M8 11h.02', 'M8 7h.02'] },
  anuong: { d: ['M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2', 'M7 2v20', 'M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7'] },
  cafe: { d: ['M10 2v2', 'M14 2v2', 'M6 2v2', 'M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1'] },
  sanbay: { d: ['M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z'] },
  gatau: { d: ['M8 3.1V7a4 4 0 0 0 8 0V3.1', 'm9 15-1-1', 'm15 15 1-1', 'M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z', 'm8 19-2 3', 'm16 19 2 3'] },
  benxe: { d: ['M8 6v6', 'M15 6v6', 'M2 12h19.6', 'M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3', 'M5 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0Z', 'M9 18h5', 'M14 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0Z'] },
  duong: { d: ['M3 19a3 3 0 1 0 6 0 3 3 0 1 0-6 0Z', 'M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15', 'M15 5a3 3 0 1 0 6 0 3 3 0 1 0-6 0Z'] },
  xang: { d: ['M3 22h12', 'M4 9h10', 'M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18', 'M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5'] },
  kcn: { d: ['M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z', 'M17 18h1', 'M12 18h1', 'M7 18h1'] },
  chua: { d: ['M10 9h4', 'M12 7v5', 'M14 22v-4a2 2 0 0 0-4 0v4', 'M18 22V5.618a1 1 0 0 0-.553-.894l-4.553-2.277a2 2 0 0 0-1.788 0L6.553 4.724A1 1 0 0 0 6 5.618V22', 'm18 7 3.447 1.724a1 1 0 0 1 .553.894V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.618a1 1 0 0 1 .553-.894L6 7'] },
  toanha: { d: ['M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z', 'M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2', 'M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2', 'M10 6h4', 'M10 10h4', 'M10 14h4', 'M10 18h4'] },
  nha: { d: ['M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8', 'M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'] },
  sao: { fill: true, d: ['M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z'] },
  dot: { fill: true, d: ['M12 6a6 6 0 1 0 0 12 6 6 0 1 0 0-12Z'] },
};
// Dựng sẵn hình rồi nhớ lại — mỗi biểu tượng chỉ phải đọc dữ liệu nét đúng một lần.
const glyphCache = new Map<string, any[]>();
function glyphPaths(name: string): any[] {
  const hit = glyphCache.get(name); if (hit) return hit;
  const g = GLYPHS[name] || GLYPHS.dot;
  const out = typeof Path2D === 'undefined' ? [] : g.d.map((d) => new Path2D(d));
  glyphCache.set(name, out); return out;
}
function drawGlyph(x: CanvasRenderingContext2D, name: string, cx: number, cy: number, r: number, color: string) {
  const g = GLYPHS[name] || GLYPHS.dot;
  const ps = glyphPaths(name);
  x.save();
  x.translate(cx, cy); x.scale(r / 12, r / 12); x.translate(-12, -12);   // đưa khung 24×24 về đúng tâm, đúng cỡ
  x.strokeStyle = color; x.fillStyle = color;
  x.lineWidth = 2; x.lineCap = 'round'; x.lineJoin = 'round'; x.miterLimit = 2;
  if (!ps.length) { x.beginPath(); x.arc(12, 12, 5.4, 0, Math.PI * 2); x.fill(); x.restore(); return; }
  for (const pth of ps) { if (g.fill) x.fill(pth); else x.stroke(pth); }
  x.restore();
}
// ĐỘ NÉT CỦA GHIM — vẽ trên canvas to gấp ngần này rồi thu lại, nên ghim sắc nét cả khi
// phóng to bản đồ lẫn khi xuất video 1080p. Cỡ ghim hiện ra KHÔNG đổi (bù bằng pixelRatio).
const PIN_HD = 1.5;

/**
 * ══ VIỀN NEON HAI LỚP ══
 * Vì sao viền của app kia "ăn hình" hơn: họ không tô một đường sáng, mà chồng BA lớp:
 *   · lớp ngoài  — rất rộng, rất nhoè, rất mờ  → tạo quầng sáng toả ra không khí
 *   · lớp trong  — hẹp hơn, nhoè ít, đậm hơn   → làm phần sáng "có lõi", không bị bệt
 *   · nét chính  — mảnh, sắc, vẽ đè lên trên cùng
 * Bộ ba đó cho ra cảm giác đèn neon thật. Một lớp thôi thì chỉ ra vệt mờ nhạt.
 *
 * do = độ mạnh (1 là chuẩn) · ti = tỉ lệ khung xuất so với khung xem trước (video 1080p thì lớn hơn 1,
 * phải nhân lên, nếu không viền trong video sẽ mảnh hơn lúc xem trước).
 * tienDo = 0..1 để viền sáng dần lên chứ không bật cái rụp.
 */
function neonHaiLop(net: number, do_: number, ti: number, tienDo = 1) {
  const k = Math.max(0, do_);
  return {
    ngoai: { rong: net * ti * (5 + 5 * k), mo: Math.min(1, 0.3 * k) * tienDo, nhoe: (8 + 10 * k) * ti },
    trong: { rong: net * ti * (2.2 + 1.6 * k), mo: Math.min(1, 0.7 * k) * tienDo, nhoe: (2.5 + 2 * k) * ti },
    chinh: { rong: net * ti },
  };
}
// Đổi màu #rrggbb thành dạng có độ trong suốt.
function hexA(hex: string, a: number): string {
  const h = (hex || '#ffffff').replace('#', ''); const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(f, 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
// ẢNH RADAR: nan quạt quét (quet) hoặc cung sáng chạy vòng (cung). Xoay bằng cách quay ảnh theo thời gian.
function radarFxImage(color: string, kind: 'quet' | 'cung'): any {
  if (typeof document === 'undefined') return null;
  const S = 232, c = document.createElement('canvas'); c.width = S; c.height = S;
  const x = c.getContext('2d'); if (!x) return null;
  const m = S / 2, R = m - 6;
  if (kind === 'quet') {
    const steps = 54, span = (74 * Math.PI) / 180;                    // nan quạt 74°, đậm ở mép trước nhạt dần về sau
    for (let i = 0; i < steps; i++) {
      const a0 = -Math.PI / 2 - (span * i) / steps, a1 = a0 - span / steps - 0.012;
      x.beginPath(); x.moveTo(m, m); x.arc(m, m, R, a1, a0); x.closePath();
      x.fillStyle = hexA(color, 0.5 * Math.pow(1 - i / steps, 1.5)); x.fill();
    }
    x.beginPath(); x.moveTo(m, m); x.lineTo(m, m - R);                 // cạnh trước sáng rõ
    x.strokeStyle = hexA(color, 0.95); x.lineWidth = 3; x.lineCap = 'round'; x.stroke();
  } else {
    x.lineCap = 'round';
    for (let i = 0; i < 26; i++) {                                     // cung sáng, đuôi mờ dần
      const a0 = -Math.PI / 2 - i * 0.052;
      x.beginPath(); x.arc(m, m, R * 0.8, a0 - 0.055, a0);
      x.strokeStyle = hexA(color, 0.95 * Math.pow(1 - i / 26, 1.6)); x.lineWidth = 7; x.stroke();
    }
  }
  return x.getImageData(0, 0, S, S);
}
// Hoán đổi ba kênh màu để ra MỘT SẮC ĐỘ KHÁC HẲN mà vẫn cùng độ tươi — dùng cho ghim chuyển sắc hai màu.
// (Xanh dương → tím hồng, vàng → xanh lá… luôn ra cặp màu hợp mắt, không cần bảng tra.)
function xoayMau(hex: string): string {
  const h = (hex || '#888888').replace('#', ''); const f = h.length === 3 ? h.split('').map((ch) => ch + ch).join('') : h;
  const n = parseInt(f, 16); if (isNaN(n)) return hex;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 'rgb(' + b + ',' + r + ',' + g + ')';
}
// Làm màu sáng/tối hơn — dùng cho chuyển sắc kim loại.
function shade(hex: string, amt: number): string {
  const h = hex.replace('#', ''); const full = h.length === 3 ? h.split('').map((ch) => ch + ch).join('') : h;
  const n = parseInt(full, 16); const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return 'rgb(' + cl(((n >> 16) & 255) + amt) + ',' + cl(((n >> 8) & 255) + amt) + ',' + cl((n & 255) + amt) + ')';
}
// Vẽ 1 con ghim SANG TRỌNG: thân chuyển sắc kim loại, viền mảnh, vệt sáng, bóng đổ, biểu tượng nổi trong đĩa tối.
// GHIM PHÁT SÁNG — đầu tròn to, đuôi thon vót nhọn, hào quang neon quanh thân.
function makeNeonPin(color: string, icon: string, hole: boolean): any {
  const W = 152, H = 214, cx = W / 2;
  const c = document.createElement('canvas'); c.width = Math.round(W * PIN_HD); c.height = Math.round(H * PIN_HD);
  const x = c.getContext('2d'); if (!x) return null;
  x.scale(PIN_HD, PIN_HD);
  const rH = 52, cyH = 66, tipY = cyH + rH * 2.16;               // đầu tròn to · mũi nhọn ở dưới
  const path = () => {
    x.beginPath();
    const a = 0.96;                                               // ~55° — chỗ đuôi rời khỏi đầu tròn (đuôi MẬP, không phải cây kim)
    x.arc(cx, cyH, rH, Math.PI / 2 - a, Math.PI / 2 + a, true);   // vòng quanh đầu, chừa chỗ nối đuôi
    const hw = rH * Math.sin(a), hy = cyH + rH * Math.cos(a);      // điểm nối đuôi bên trái
    x.bezierCurveTo(cx - rH * 0.72, cyH + rH * 1.3, cx - rH * 0.13, tipY - rH * 0.5, cx, tipY);  // sườn trái
    x.bezierCurveTo(cx + rH * 0.13, tipY - rH * 0.5, cx + rH * 0.72, cyH + rH * 1.3, cx + hw, hy); // sườn phải
    x.closePath();
  };
  // Bóng đổ mềm dưới chân — ghim trông "đứng" trên mặt đất chứ không dán phẳng lên ảnh.
  x.save(); x.globalAlpha = 0.34; x.fillStyle = '#000'; x.filter = 'blur(5px)';
  x.beginPath(); x.ellipse(cx, tipY - 3, rH * 0.46, rH * 0.15, 0, 0, Math.PI * 2); x.fill(); x.restore();
  // Hào quang: CHỈ MỘT lượt rất nhẹ. Đây là kiểu "Icon động" nên vẫn giữ chút phát sáng cho
  // đúng tên gọi, nhưng bỏ hẳn 3 lượt chồng nhau của bản cũ — thứ làm con ghim mờ như sương.
  x.save();
  x.shadowColor = color; x.shadowBlur = 16; x.globalAlpha = 0.34; path(); x.fillStyle = color; x.fill();
  x.restore();
  // Thân: chuyển sắc rất nhẹ, giữ mảng màu phẳng sạch.
  path();
  const g = x.createLinearGradient(0, cyH - rH, 0, tipY);
  g.addColorStop(0, shade(color, 28)); g.addColorStop(0.55, color); g.addColorStop(1, shade(color, -28));
  x.fillStyle = g; x.fill();
  // VÒNG TRẮNG bao ngoài — đọc được trên mọi nền — rồi một nét tối cực mảnh ngoài cùng.
  path(); x.lineWidth = 5.4; x.strokeStyle = 'rgba(255,255,255,.96)'; x.stroke();
  path(); x.lineWidth = 1.1; x.strokeStyle = 'rgba(6,14,26,.24)'; x.stroke();
  // Ruột: khoét lỗ tối (kiểu "vị trí của bạn") hoặc biểu tượng trắng.
  if (hole) {
    x.save(); x.globalCompositeOperation = 'destination-out';
    x.beginPath(); x.arc(cx, cyH, rH * 0.42, 0, Math.PI * 2); x.fill(); x.restore();
    x.beginPath(); x.arc(cx, cyH, rH * 0.42, 0, Math.PI * 2); x.lineWidth = 2; x.strokeStyle = 'rgba(255,255,255,.35)'; x.stroke();
  } else {
    drawGlyph(x, icon, cx, cyH, rH * 0.7, '#ffffff');   // nét to, sạch, không bóng không viền
  }
  return x.getImageData(0, 0, c.width, c.height);
}
// HUY HIỆU: ô đen viền màu (darkgold) hoặc lục giác đặc màu (goldhex) — kiểu bảng hiệu bất động sản cao cấp.
function makeBadgePin(color: string, icon: string, kind: 'darkgold' | 'goldhex'): any {
  const W = 136, H = 168, cx = W / 2, pad = 12;
  const c = document.createElement('canvas'); c.width = Math.round(W * PIN_HD); c.height = Math.round(H * PIN_HD);
  const x = c.getContext('2d'); if (!x) return null;
  x.scale(PIN_HD, PIN_HD);
  const tipY = H - 8, r = W / 2 - pad, cy = pad + r;
  const hexPath = () => { x.beginPath(); for (let n = 0; n < 6; n++) { const a = (Math.PI / 3) * n - Math.PI / 2; const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a); n ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); };
  const boxPath = () => { const rr = r * 0.34, l = cx - r, rt = cx + r, tp = cy - r, bt = cy + r; x.beginPath(); x.moveTo(l + rr, tp); x.arcTo(rt, tp, rt, bt, rr); x.arcTo(rt, bt, l, bt, rr); x.arcTo(l, bt, l, tp, rr); x.arcTo(l, tp, rt, tp, rr); x.closePath(); };
  // Đuôi nhọn nhỏ nối xuống điểm cắm
  const tail = () => { x.beginPath(); x.moveTo(cx - 9, cy + r - 2); x.lineTo(cx + 9, cy + r - 2); x.lineTo(cx, tipY); x.closePath(); };
  x.save(); x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 14; x.shadowOffsetY = 6;
  if (kind === 'goldhex') {
    tail(); x.fillStyle = shade(color, -24); x.fill();
    hexPath();
    const g = x.createLinearGradient(0, cy - r, 0, cy + r);
    g.addColorStop(0, shade(color, 60)); g.addColorStop(0.5, color); g.addColorStop(1, shade(color, -34));
    x.fillStyle = g; x.fill();
  } else {
    tail(); x.fillStyle = '#0c1622'; x.fill();
    boxPath();
    const g = x.createLinearGradient(0, cy - r, 0, cy + r);
    g.addColorStop(0, '#16263a'); g.addColorStop(1, '#0a1320');
    x.fillStyle = g; x.fill();
  }
  x.restore();
  if (kind === 'goldhex') {
    hexPath(); x.lineWidth = 5; x.strokeStyle = 'rgba(255,255,255,.95)'; x.stroke();     // vòng trắng bao ngoài
    hexPath(); x.lineWidth = 1.1; x.strokeStyle = 'rgba(6,14,26,.22)'; x.stroke();
    drawGlyph(x, icon, cx, cy, r * 0.56, '#0c1622');
  } else {
    boxPath(); x.lineWidth = 3.4; x.strokeStyle = color; x.stroke();
    boxPath(); x.lineWidth = 1.1; x.strokeStyle = 'rgba(255,255,255,.16)'; x.stroke();
    drawGlyph(x, icon, cx, cy, r * 0.56, color);                                          // bỏ quầng sáng, nét sạch
  }
  return x.getImageData(0, 0, c.width, c.height);
}
// ══════════ GHIM CÓ NHÃN TÊN (học từ mapeffect) ══════════
// Bên họ có nhóm "Huy hiệu có tên": tên tiện ích nằm NGAY TRONG con ghim, thành một viên thuốc
// nằm ngang [biểu tượng | Tên tiện ích] có mũi nhọn chỉ xuống đúng chỗ. Hơn hẳn cách cũ của mình
// (chữ rời nằm dưới chân ghim) vì hai thứ dính liền nhau, camera bay kiểu gì cũng không lệch,
// và nhìn ra dáng "nhãn địa điểm" chứ không phải chữ dán tạm.
// Mỗi nhãn một ảnh riêng (tên khác nhau thì bề ngang khác nhau) — vài chục cái vẫn nhẹ tênh.
// Các kiểu ghim mà TÊN NẰM NGAY TRONG THÂN GHIM (không vẽ chữ rời bên dưới).
// Trước đây chỉ nhận ra bằng cách xem tên kiểu có bắt đầu bằng "nhan" hay không — nên 5 bố cục thêm
// sau (huy hiệu có tên, biển vàng, ô kính, hai kiểu biển rao bán) lọt lưới, bị vẽ bằng hàm mặc định
// thành ra cái nào cũng ra ghim giọt nước giống hệt nhau. Giờ liệt kê thẳng ra đây cho chắc.
const GHIM_CO_TEN = ['huyhieuten', 'calloutvang', 'okinh', 'bienrao', 'biencot', 'bienxich', 'bienvom', 'nhanvienthuoc', 'thechip', 'thanhduoi', 'thevuong'];
const laGhimCoTen = (shape: string) => shape.startsWith('nhan') || GHIM_CO_TEN.includes(shape);

const NHAN_KIEU: Record<string, { nen: string; chu: string; vien: string; dam?: boolean }> = {
  trang:  { nen: '#ffffff', chu: '#0A2540', vien: 'rgba(10,37,64,.14)' },   // trắng sạch, chữ xanh đêm
  toi:    { nen: 'rgba(9,20,34,.92)', chu: '#ffffff', vien: 'rgba(255,255,255,.18)' },
  mau:    { nen: '', chu: '#ffffff', vien: 'rgba(255,255,255,.9)', dam: true },  // nền chính là màu ghim
};
/**
 * ══ BA BỐ CỤC GHIM MỚI ══
 * Bộ ghim cũ tuy 27 dáng nhưng chung MỘT bố cục: một cái vỏ, biểu tượng nằm giữa. Đổi vỏ mãi thì
 * vẫn thấy na ná nhau. Ba cái dưới đây xếp đặt khác hẳn, nhìn ra ngay là ba thứ khác nhau:
 *   · huyhieuten  — đĩa tròn kim loại có ánh sáng hắt, TÊN nằm trong khung gắn ngay dưới
 *   · calloutvang — tấm biển bo góc, ĐUÔI NHỌN chỉ xuống đúng điểm
 *   · okinh       — tấm kính mờ trong suốt, viền sáng mảnh, có chân cắm xuống đất
 * Tất cả vẽ bằng máy (hình học + chuyển sắc + bóng đổ), không dùng hình vẽ của ai.
 */
/**
 * ══ DẢI "ĐÃ BÁN" ══
 * Ban đầu tôi làm hẳn một KIỂU BIỂN riêng tên "Bảng ĐÃ BÁN" — sai hướng: chẳng lẽ mỗi dáng biển lại
 * phải đẻ thêm một bản "đã bán" nữa? Đúng ra nó chỉ là một cái TÍCH: biển nào cũng gạch được dải này
 * lên, dáng biển giữ nguyên. Ít mẫu đi mà dùng được nhiều hơn.
 */
function veDaiDaBan(x: CanvasRenderingContext2D, duong: () => void, cx: number, cy: number, W: number) {
  x.save(); duong(); x.clip();
  x.translate(cx, cy); x.rotate(-0.32);
  x.fillStyle = 'rgba(6,12,20,.88)'; x.fillRect(-W, -13, W * 2, 26);
  x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1.2;
  x.beginPath(); x.moveTo(-W, -13); x.lineTo(W, -13); x.moveTo(-W, 13); x.lineTo(W, 13); x.stroke();
  x.fillStyle = '#ffffff'; x.font = '800 17px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('ĐÃ BÁN', 0, 1); x.restore();
}

function makeLabelPin2(color: string, icon: string, label: string, kieu: string, daBan = false): any {
  if (typeof document === 'undefined') return null;
  const chu = (label || '').trim().slice(0, 22) || ' ';
  const do1 = document.createElement('canvas').getContext('2d')!;

  if (kieu === 'thechip' || kieu === 'thanhduoi' || kieu === 'thevuong') {
    // ══ NHÓM "NHÃN ĐỊA ĐIỂM" ══
    // Ba bố cục nữa hay gặp khi chú thích địa điểm trên bản đồ:
    //   thechip    — một CHIP nhỏ nổi phía trên, có mũi nhọn chỉ xuống chấm neo; gọn, ít che ảnh
    //   thanhduoi  — thanh chữ nằm DƯỚI chấm neo, kiểu chú thích ảnh báo chí
    //   thevuong   — thẻ vuông có ô biểu tượng nằm trên, tên nằm dưới; đứng đắn, dễ đọc
    do1.font = '700 20px Arial, sans-serif';
    const wChu = Math.ceil(do1.measureText(chu).width);

    if (kieu === 'thevuong') {
      const W = Math.max(96, wChu + 26), OC = 44, H = OC + 34;
      const c = document.createElement('canvas');
      c.width = Math.round(W * PIN_HD); c.height = Math.round((H + 16) * PIN_HD);
      const x = c.getContext('2d'); if (!x) return null; x.scale(PIN_HD, PIN_HD);
      x.save(); x.shadowColor = 'rgba(6,14,26,.45)'; x.shadowBlur = 11; x.shadowOffsetY = 4;
      x.fillStyle = 'rgba(255,255,255,.96)'; x.beginPath(); x.roundRect(0.5, 0.5, W - 1, H - 1, 10); x.fill(); x.restore();
      x.fillStyle = color; x.beginPath(); x.roundRect(W / 2 - OC / 2, 6, OC, OC - 4, 9); x.fill();
      drawGlyph(x, icon, W / 2, 6 + (OC - 4) / 2, 13, '#ffffff');
      x.fillStyle = '#0A2540'; x.font = '700 20px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(chu, W / 2, H - 15);
      x.strokeStyle = color; x.lineWidth = 2.2; x.beginPath(); x.moveTo(W / 2, H); x.lineTo(W / 2, H + 11); x.stroke();
      x.beginPath(); x.arc(W / 2, H + 13, 3, 0, Math.PI * 2); x.fillStyle = color; x.fill();
      return x.getImageData(0, 0, c.width, c.height);
    }

    const H = 38, W = Math.max(110, wChu + 46), KHE = 14;
    const c = document.createElement('canvas');
    c.width = Math.round(W * PIN_HD); c.height = Math.round((H + KHE + 12) * PIN_HD);
    const x = c.getContext('2d'); if (!x) return null; x.scale(PIN_HD, PIN_HD);
    const yT = kieu === 'thanhduoi' ? KHE + 6 : 0;      // thanh dưới thì chấm neo nằm TRÊN

    if (kieu === 'thanhduoi') {                          // chấm neo trước, thanh chữ nằm dưới
      x.beginPath(); x.arc(W / 2, 7, 5.5, 0, Math.PI * 2); x.fillStyle = color; x.fill();
      x.strokeStyle = '#ffffff'; x.lineWidth = 2; x.stroke();
      x.strokeStyle = color; x.lineWidth = 2; x.beginPath(); x.moveTo(W / 2, 12); x.lineTo(W / 2, yT); x.stroke();
    }

    x.save(); x.shadowColor = 'rgba(6,14,26,.45)'; x.shadowBlur = 11; x.shadowOffsetY = 4;
    x.fillStyle = 'rgba(9,20,34,.92)'; x.beginPath(); x.roundRect(0.5, yT + 0.5, W - 1, H - 1, kieu === 'thechip' ? H / 2 : 7); x.fill(); x.restore();
    x.strokeStyle = color; x.lineWidth = 1.6; x.beginPath(); x.roundRect(0.5, yT + 0.5, W - 1, H - 1, kieu === 'thechip' ? H / 2 : 7); x.stroke();
    x.beginPath(); x.arc(20, yT + H / 2, 9, 0, Math.PI * 2); x.fillStyle = color; x.fill();
    drawGlyph(x, icon, 20, yT + H / 2, 6.5, '#ffffff');
    x.fillStyle = '#ffffff'; x.font = '700 20px Arial, sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle';
    x.fillText(chu, 36, yT + H / 2 + 1);

    if (kieu === 'thechip') {                            // mũi nhọn chỉ xuống chấm neo
      x.beginPath(); x.moveTo(W / 2 - 7, H); x.lineTo(W / 2, H + 10); x.lineTo(W / 2 + 7, H); x.closePath();
      x.fillStyle = 'rgba(9,20,34,.92)'; x.fill(); x.strokeStyle = color; x.lineWidth = 1.4; x.stroke();
      x.beginPath(); x.arc(W / 2, H + KHE, 4, 0, Math.PI * 2); x.fillStyle = color; x.fill();
    }
    return x.getImageData(0, 0, c.width, c.height);
  }

  if (kieu === 'bienxich' || kieu === 'bienvom' || kieu === 'nhanvienthuoc') {
    // ══ BỐN MẪU BIỂN & NHÃN NỮA ══
    // Học đúng bố cục hay gặp ngoài thực địa và trong tờ rơi bất động sản:
    //   bienxich      — tấm biển TREO trên hai sợi xích dưới một thanh ngang
    //   bienvom       — bảng có ĐỈNH VÒM cong, kiểu biển hiệu văn phòng nhà đất
    //   biendaban     — bảng thường nhưng gạch một DẢI CHÉO "ĐÃ BÁN" đè lên
    //   nhanvienthuoc — nhãn bo tròn hai đầu, chấm ghim tròn bên trái, nhìn nhẹ và hiện đại
    do1.font = '800 22px Arial, sans-serif';
    const wChu = Math.ceil(do1.measureText(chu).width);

    if (kieu === 'nhanvienthuoc') {
      const H = 46, W = Math.max(130, wChu + 74), CHAN = 16;
      const c = document.createElement('canvas');
      c.width = Math.round(W * PIN_HD); c.height = Math.round((H + CHAN + 8) * PIN_HD);
      const x = c.getContext('2d'); if (!x) return null; x.scale(PIN_HD, PIN_HD);
      x.save(); x.shadowColor = 'rgba(6,14,26,.5)'; x.shadowBlur = 12; x.shadowOffsetY = 5;
      x.fillStyle = '#ffffff'; x.beginPath(); x.roundRect(0.5, 0.5, W - 1, H - 1, H / 2); x.fill(); x.restore();
      x.strokeStyle = 'rgba(10,37,64,.16)'; x.lineWidth = 1.2; x.beginPath(); x.roundRect(0.5, 0.5, W - 1, H - 1, H / 2); x.stroke();
      x.beginPath(); x.arc(H / 2, H / 2, H * 0.34, 0, Math.PI * 2); x.fillStyle = color; x.fill();
      drawGlyph(x, icon, H / 2, H / 2, H * 0.2, '#ffffff');
      x.fillStyle = '#0A2540'; x.font = '800 22px Arial, sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle';
      x.fillText(chu, H * 0.94, H / 2 + 1);
      x.strokeStyle = color; x.lineWidth = 2.4; x.beginPath(); x.moveTo(W / 2, H); x.lineTo(W / 2, H + CHAN - 4); x.stroke();
      x.beginPath(); x.arc(W / 2, H + CHAN - 1, 3.2, 0, Math.PI * 2); x.fillStyle = color; x.fill();
      return x.getImageData(0, 0, c.width, c.height);
    }

    const W = Math.max(160, wChu + 50), H = kieu === 'bienvom' ? 70 : 60;   // (dải ĐÃ BÁN nay là cái tích, xem veDaiDaBan)
    const TREO = kieu === 'bienxich' ? 26 : 0, CHAN = kieu === 'bienxich' ? 0 : 30;
    const c = document.createElement('canvas');
    c.width = Math.round(W * PIN_HD); c.height = Math.round((H + TREO + CHAN + 12) * PIN_HD);
    const x = c.getContext('2d'); if (!x) return null; x.scale(PIN_HD, PIN_HD);
    const yT = TREO;                                  // mép trên tấm biển

    if (kieu === 'bienxich') {
      x.save(); x.strokeStyle = '#8d99a6'; x.lineWidth = 4; x.lineCap = 'round';
      x.beginPath(); x.moveTo(W * 0.08, 4); x.lineTo(W * 0.92, 4); x.stroke();                 // thanh ngang
      x.lineWidth = 2.4;
      [0.24, 0.76].forEach((k) => { x.beginPath(); x.moveTo(W * k, 5); x.lineTo(W * k, yT); x.stroke(); });   // hai sợi xích
      x.restore();
    } else {
      x.save(); x.strokeStyle = '#8d99a6'; x.lineWidth = 5; x.lineCap = 'round';
      x.beginPath(); x.moveTo(W * 0.3, yT + H - 4); x.lineTo(W * 0.22, yT + H + CHAN - 4);
      x.moveTo(W * 0.7, yT + H - 4); x.lineTo(W * 0.78, yT + H + CHAN - 4); x.stroke(); x.restore();
    }

    const duong = () => {
      x.beginPath();
      if (kieu === 'bienvom') {                        // đỉnh cong
        x.moveTo(2, yT + 16);
        x.quadraticCurveTo(W / 2, yT - 12, W - 2, yT + 16);
        x.lineTo(W - 2, yT + H - 6); x.arcTo(W - 2, yT + H, W - 8, yT + H, 6);
        x.lineTo(8, yT + H); x.arcTo(2, yT + H, 2, yT + H - 6, 6);
        x.closePath();
      } else x.roundRect(1.5, yT + 0.5, W - 3, H - 1, 6);
    };
    x.save(); x.shadowColor = 'rgba(6,14,26,.55)'; x.shadowBlur = 14; x.shadowOffsetY = 6;
    x.fillStyle = color; duong(); x.fill(); x.restore();
    x.save(); duong(); x.clip();
    const g = x.createLinearGradient(0, yT, 0, yT + H);
    g.addColorStop(0, 'rgba(255,255,255,.34)'); g.addColorStop(0.42, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.28)');
    x.fillStyle = g; x.fillRect(0, yT, W, H); x.restore();
    x.strokeStyle = 'rgba(255,255,255,.92)'; x.lineWidth = 2.4;
    x.beginPath(); x.roundRect(5, yT + (kieu === 'bienvom' ? 12 : 4), W - 10, H - (kieu === 'bienvom' ? 17 : 8), 4); x.stroke();
    x.fillStyle = '#ffffff'; x.font = '800 22px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(chu, W / 2, yT + H / 2 + (kieu === 'bienvom' ? 5 : 1));

    if (daBan) veDaiDaBan(x, duong, W / 2, yT + H / 2, W);
    return x.getImageData(0, 0, c.width, c.height);
  }

  if (kieu === 'bienrao' || kieu === 'biencot') {
    // ══ BIỂN RAO BÁN CẮM NGOÀI ĐẤT ══
    // Đây là hình ảnh ai đi xem đất cũng thấy: tấm tôn sơn màu, chữ to, cắm hai chân sắt xuống đất
    // (kiểu 'bienrao') hoặc treo trên một cột (kiểu 'biencot'). Không app nào ở ta có mẫu này —
    // mà lại là thứ khách nhìn phát hiểu ngay đang rao bán lô nào.
    do1.font = '800 24px Arial, sans-serif';
    const wChu = Math.ceil(do1.measureText(chu).width);
    const W = Math.max(160, wChu + 46), H = 62, CHAN = kieu === 'biencot' ? 34 : 30;
    const c = document.createElement('canvas');
    c.width = Math.round(W * PIN_HD); c.height = Math.round((H + CHAN + 10) * PIN_HD);
    const x = c.getContext('2d'); if (!x) return null; x.scale(PIN_HD, PIN_HD);
    // chân cắm vẽ TRƯỚC để tấm biển đè lên trên
    x.save(); x.strokeStyle = '#8d99a6'; x.lineWidth = 5; x.lineCap = 'round';
    if (kieu === 'biencot') { x.beginPath(); x.moveTo(W / 2, H - 4); x.lineTo(W / 2, H + CHAN - 2); x.stroke(); }
    else {
      x.beginPath(); x.moveTo(W * 0.32, H - 4); x.lineTo(W * 0.24, H + CHAN - 2);
      x.moveTo(W * 0.68, H - 4); x.lineTo(W * 0.76, H + CHAN - 2); x.stroke();
      x.lineWidth = 3.4; x.beginPath(); x.moveTo(W * 0.27, H + 12); x.lineTo(W * 0.73, H + 12); x.stroke();   // thanh giằng ngang
    }
    x.restore();
    // tấm biển
    x.save(); x.shadowColor = 'rgba(6,14,26,.55)'; x.shadowBlur = 14; x.shadowOffsetY = 6;
    x.fillStyle = color; x.beginPath(); x.roundRect(0.5, 0.5, W - 1, H - 1, 6); x.fill(); x.restore();
    x.save(); x.beginPath(); x.roundRect(0.5, 0.5, W - 1, H - 1, 6); x.clip();
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,255,255,.34)'); g.addColorStop(0.42, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.28)');
    x.fillStyle = g; x.fillRect(0, 0, W, H); x.restore();
    x.strokeStyle = 'rgba(255,255,255,.92)'; x.lineWidth = 2.6; x.beginPath(); x.roundRect(3.5, 3.5, W - 7, H - 7, 4); x.stroke();
    x.fillStyle = '#ffffff'; x.font = '800 24px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(chu, W / 2, H / 2 + 1);
    return x.getImageData(0, 0, c.width, c.height);   // ImageData TRẦN — đúng kiểu mà cả bản đồ lẫn ô xem trước đều cần
  }

  if (kieu === 'huyhieuten') {
    do1.font = '700 22px Arial, sans-serif';
    const wChu = Math.ceil(do1.measureText(chu).width);
    const W = Math.max(120, wChu + 40), DIA = 62, H = DIA + 46;
    const c = document.createElement('canvas');
    c.width = Math.round(W * PIN_HD); c.height = Math.round((H + 10) * PIN_HD);
    const x = c.getContext('2d'); if (!x) return null; x.scale(PIN_HD, PIN_HD);
    const cx = W / 2, cyD = DIA / 2 + 4, hK = 34, yK = DIA + 6;
    x.save(); x.shadowColor = 'rgba(6,14,26,.5)'; x.shadowBlur = 10; x.shadowOffsetY = 4;
    const gk = x.createLinearGradient(0, yK, 0, yK + hK); gk.addColorStop(0, '#0f2a44'); gk.addColorStop(1, '#061726');
    x.fillStyle = gk; x.beginPath(); x.roundRect(cx - W / 2 + 6, yK, W - 12, hK, 9); x.fill(); x.restore();
    x.strokeStyle = color; x.lineWidth = 1.5; x.beginPath(); x.roundRect(cx - W / 2 + 6, yK, W - 12, hK, 9); x.stroke();
    x.fillStyle = '#ffffff'; x.font = '700 22px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(chu, cx, yK + hK / 2 + 1);
    x.save(); x.shadowColor = 'rgba(6,14,26,.55)'; x.shadowBlur = 14; x.shadowOffsetY = 5;
    const gd = x.createLinearGradient(0, cyD - DIA / 2, 0, cyD + DIA / 2);
    gd.addColorStop(0, color); gd.addColorStop(0.55, color); gd.addColorStop(1, 'rgba(0,0,0,.55)');
    x.fillStyle = gd; x.beginPath(); x.arc(cx, cyD, DIA / 2, 0, Math.PI * 2); x.fill(); x.restore();
    x.save(); x.beginPath(); x.arc(cx, cyD, DIA / 2, 0, Math.PI * 2); x.clip();
    const gs = x.createLinearGradient(0, cyD - DIA / 2, 0, cyD + 6);
    gs.addColorStop(0, 'rgba(255,255,255,.5)'); gs.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gs; x.fillRect(cx - DIA, cyD - DIA / 2, DIA * 2, DIA * 0.62); x.restore();
    x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 1.7; x.beginPath(); x.arc(cx, cyD, DIA / 2, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = 'rgba(0,0,0,.32)'; x.lineWidth = 1; x.beginPath(); x.arc(cx, cyD, DIA / 2 - 5, 0, Math.PI * 2); x.stroke();
    drawGlyph(x, icon, cx, cyD, 15, '#0A2540');
    return x.getImageData(0, 0, c.width, c.height);   // ImageData TRẦN — đúng kiểu mà cả bản đồ lẫn ô xem trước đều cần
  }

  if (kieu === 'calloutvang') {
    do1.font = '700 21px Arial, sans-serif';
    const wChu = Math.ceil(do1.measureText(chu).width);
    const W = Math.max(150, wChu + 92), H = 60, DUOI = 15, r = 11;
    const c = document.createElement('canvas');
    c.width = Math.round(W * PIN_HD); c.height = Math.round((H + DUOI + 8) * PIN_HD);
    const x = c.getContext('2d'); if (!x) return null; x.scale(PIN_HD, PIN_HD);
    const duong = () => {
      x.beginPath();
      x.moveTo(r, 0); x.lineTo(W - r, 0); x.arcTo(W, 0, W, r, r);
      x.lineTo(W, H - r); x.arcTo(W, H, W - r, H, r);
      x.lineTo(W / 2 + DUOI * 0.7, H); x.lineTo(W / 2, H + DUOI); x.lineTo(W / 2 - DUOI * 0.7, H);
      x.lineTo(r, H); x.arcTo(0, H, 0, H - r, r); x.lineTo(0, r); x.arcTo(0, 0, r, 0, r); x.closePath();
    };
    x.save(); x.shadowColor = 'rgba(6,14,26,.5)'; x.shadowBlur = 13; x.shadowOffsetY = 5;
    x.fillStyle = color; duong(); x.fill(); x.restore();
    x.save(); duong(); x.clip();
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,255,255,.45)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.30)');
    x.fillStyle = g; x.fillRect(0, 0, W, H + DUOI); x.restore();
    x.strokeStyle = 'rgba(255,255,255,.62)'; x.lineWidth = 1.4; duong(); x.stroke();
    drawGlyph(x, icon, 30, H / 2, 13, '#0A2540');
    x.fillStyle = '#0A2540'; x.font = '700 21px Arial, sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle';
    x.fillText(chu, 52, H / 2 + 1);
    return x.getImageData(0, 0, c.width, c.height);   // ImageData TRẦN — đúng kiểu mà cả bản đồ lẫn ô xem trước đều cần
  }

  do1.font = '700 21px Arial, sans-serif';
  const wChu = Math.ceil(do1.measureText(chu).width);
  const W = Math.max(140, wChu + 78), H = 54, CHAN = 18, r = 14;
  const c = document.createElement('canvas');
  c.width = Math.round(W * PIN_HD); c.height = Math.round((H + CHAN + 10) * PIN_HD);
  const x = c.getContext('2d'); if (!x) return null; x.scale(PIN_HD, PIN_HD);
  const duong = () => { x.beginPath(); x.roundRect(0.5, 0.5, W - 1, H - 1, r); };
  x.save(); x.shadowColor = 'rgba(6,14,26,.5)'; x.shadowBlur = 15; x.shadowOffsetY = 6;
  x.fillStyle = 'rgba(12,26,42,.55)'; duong(); x.fill(); x.restore();
  x.save(); duong(); x.clip();
  const gk2 = x.createLinearGradient(0, 0, 0, H);
  gk2.addColorStop(0, 'rgba(255,255,255,.30)'); gk2.addColorStop(0.5, 'rgba(255,255,255,.07)'); gk2.addColorStop(1, 'rgba(255,255,255,.02)');
  x.fillStyle = gk2; x.fillRect(0, 0, W, H);
  x.globalAlpha = 0.26; x.fillStyle = color; x.beginPath(); x.arc(30, H / 2, 25, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1;
  x.restore();
  x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1.3; duong(); x.stroke();
  drawGlyph(x, icon, 30, H / 2, 12.5, color);
  x.fillStyle = '#ffffff'; x.font = '700 21px Arial, sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle';
  x.fillText(chu, 54, H / 2 + 1);
  x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(W / 2, H); x.lineTo(W / 2, H + CHAN - 4); x.stroke();
  x.beginPath(); x.arc(W / 2, H + CHAN - 1, 3.4, 0, Math.PI * 2); x.fillStyle = color; x.fill();
  return x.getImageData(0, 0, c.width, c.height);   // ImageData TRẦN — đúng kiểu mà cả bản đồ lẫn ô xem trước đều cần
}

function makeLabelPin(color: string, icon: string, label: string, kieu = 'trang', daBan = false): any {
  if (GHIM_CO_TEN.includes(kieu)) return makeLabelPin2(color, icon, label, kieu, daBan);
  if (typeof document === 'undefined') return null;
  const K = NHAN_KIEU[kieu] || NHAN_KIEU.trang;
  const H = 52, R = H / 2, PAD = 16, ICO = 34, DUOI = 13;       // cao thân · bo tròn · lề · ô biểu tượng · mũi nhọn
  const do1 = document.createElement('canvas').getContext('2d')!;
  const chu = (label || '').trim().slice(0, 26) || ' ';
  do1.font = '700 24px Arial, sans-serif';
  const wChu = Math.ceil(do1.measureText(chu).width);
  const W = PAD + ICO + 10 + wChu + PAD;
  const c = document.createElement('canvas');
  c.width = Math.round(W * PIN_HD); c.height = Math.round((H + DUOI + 8) * PIN_HD);
  const x = c.getContext('2d'); if (!x) return null;
  x.scale(PIN_HD, PIN_HD);
  const than = () => {
    x.beginPath();
    x.moveTo(R, 0); x.lineTo(W - R, 0); x.arc(W - R, R, R, -Math.PI / 2, Math.PI / 2);
    x.lineTo(W / 2 + DUOI * 0.62, H); x.lineTo(W / 2, H + DUOI); x.lineTo(W / 2 - DUOI * 0.62, H);   // mũi nhọn chỉ xuống
    x.lineTo(R, H); x.arc(R, R, R, Math.PI / 2, -Math.PI / 2); x.closePath();
  };
  x.save(); x.shadowColor = 'rgba(6,14,26,.42)'; x.shadowBlur = 12; x.shadowOffsetY = 4;
  than(); x.fillStyle = K.nen || color; x.fill(); x.restore();
  than(); x.lineWidth = K.dam ? 3.4 : 1.4; x.strokeStyle = K.vien; x.stroke();
  // Ô biểu tượng tròn bên trái — nền màu ghim (kiểu nhãn trắng) hoặc nền trắng (kiểu nền màu)
  const cxI = PAD + ICO / 2, cyI = H / 2;
  x.beginPath(); x.arc(cxI, cyI, ICO / 2, 0, Math.PI * 2);
  x.fillStyle = K.dam ? 'rgba(255,255,255,.22)' : color; x.fill();
  drawGlyph(x, icon, cxI, cyI, ICO * 0.32, K.dam ? '#ffffff' : (color === '#ffffff' ? '#0A2540' : '#ffffff'));
  x.font = '700 24px Arial, sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle';
  x.fillStyle = K.chu; x.fillText(chu, PAD + ICO + 10, cyI + 1);
  return x.getImageData(0, 0, c.width, c.height);
}
// KHO NHỚ ẢNH GHIM — cùng dáng + màu + biểu tượng thì chỉ vẽ một lần rồi dùng lại.
// Bảng chọn kiểu ghim hiện hơn 40 con ghim mẫu cùng lúc, không nhớ lại thì mở bảng bị khựng một nhịp.
const PIN_CACHE = new Map<string, any>();
function makePinImage(shape: string, color: string, icon: string): any {
  // Bảng chọn kiểu ghim gọi thẳng hàm này. Nếu không dẫn 5 bố cục mới sang hàm vẽ riêng của chúng thì
  // ô xem trước hiện ra ghim giọt nước — người dùng nhìn thấy "kiểu nào cũng như kiểu nào".
  if (GHIM_CO_TEN.includes(shape)) {
    const ten = (PIN_ICONS.find((v) => v.key === icon)?.name) || 'Tiện ích';
    return makeLabelPin2(color, icon, ten, shape);
  }
  const kho = shape + '|' + color + '|' + icon;
  const cu = PIN_CACHE.get(kho); if (cu) return cu;
  const moi = veAnhGhim(shape, color, icon);
  if (moi && PIN_CACHE.size < 400) PIN_CACHE.set(kho, moi);
  return moi;
}
function veAnhGhim(shape: string, color: string, icon: string): any {
  if (typeof document !== 'undefined' && (shape === 'darkgold' || shape === 'goldhex')) return makeBadgePin(color, icon, shape as any);
  if (typeof document !== 'undefined' && (shape === 'neon' || shape === 'neonhole')) return makeNeonPin(color, icon, shape === 'neonhole');
  if (typeof document === 'undefined') return null;
  const round = shape === 'dot' || shape === 'badge' || shape === 'hex' || shape === 'ring' || shape === 'mensu';
  // Sáu phong cách mới đều tự vẽ trọn vẹn ở dưới (có đuôi riêng), nên dùng khung CAO như ghim thường.
  const W = 132, H = round ? 132 : 176, pad = 11;
  const c = document.createElement('canvas'); c.width = Math.round(W * PIN_HD); c.height = Math.round(H * PIN_HD);
  const x = c.getContext('2d'); if (!x) return null;
  x.scale(PIN_HD, PIN_HD);
  const light = color === '#ffffff';
  const ink = light ? '#0A2540' : '#ffffff';
  const deep = shade(color, -52), soft = shade(color, 52);   // dùng cho kiểu Vòng khuyên
  const tipY = H - pad * 0.5;                                   // mũi ghim = đúng vị trí trên bản đồ
  const cx = W / 2, cyBody = round ? H / 2 : (H - pad) * 0.39, rBody = W / 2 - pad;

  // ══ BÓNG ĐỔ XUỐNG MẶT ĐẤT ══
  // Đây là thứ tạo khác biệt lớn nhất mà lại rẻ nhất. Ghim của app tham chiếu nhìn như CẮM XUỐNG đất;
  // ghim của ta trước giờ dán bẹt lên ảnh vệ tinh như miếng sticker. Khác nhau chỉ ở một vệt bóng
  // hình bầu dục, mờ dần ra ngoài, nằm ngay dưới chân ghim — mắt lập tức hiểu là vật ĐỨNG TRÊN đất.
  {
    const yB = round ? H - pad * 1.2 : tipY - 1;
    const g = x.createRadialGradient(cx, yB, 0, cx, yB, rBody * 0.9);
    g.addColorStop(0, "rgba(4,10,20,.48)");
    g.addColorStop(0.55, "rgba(4,10,20,.2)");
    g.addColorStop(1, "rgba(4,10,20,0)");
    x.save(); x.fillStyle = g;
    x.beginPath(); x.ellipse(cx, yB, rBody * 0.82, rBody * 0.26, 0, 0, Math.PI * 2); x.fill();
    x.restore();
  }

  // Đường bao thân ghim theo từng kiểu.
  const body = (k = 1) => {
    const r = rBody * k, cy = cyBody, bot = round ? 0 : tipY;
    x.beginPath();
    if (shape === 'drop' || shape === 'metal') {
      x.moveTo(cx, bot);
      x.bezierCurveTo(cx - r * 1.02, cy + r * 1.15, cx - r, cy - r * 0.72, cx, cy - r);
      x.bezierCurveTo(cx + r, cy - r * 0.72, cx + r * 1.02, cy + r * 1.15, cx, bot);
    } else if (shape === 'shield') {
      x.moveTo(cx, bot);
      x.bezierCurveTo(cx - r * 1.05, cy + r * 0.95, cx - r, cy - r * 0.5, cx - r, cy - r);
      x.lineTo(cx + r, cy - r);
      x.bezierCurveTo(cx + r, cy - r * 0.5, cx + r * 1.05, cy + r * 0.95, cx, bot);
    } else if (shape === 'kimcuong') {                          // KIM CƯƠNG: bốn cạnh vát, mũi nhọn cắm xuống
      x.moveTo(cx, cy - r); x.lineTo(cx + r * 0.92, cy + r * 0.05); x.lineTo(cx, bot); x.lineTo(cx - r * 0.92, cy + r * 0.05);
    } else if (shape === 'hex') {
      for (let n = 0; n < 6; n++) { const a = (Math.PI / 3) * n - Math.PI / 2; const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a); n ? x.lineTo(px, py) : x.moveTo(px, py); }
    } else if (round) {
      x.arc(cx, cy, r, 0, Math.PI * 2);
    } else if (shape === 'ribbon') {                             // thẻ có đuôi én
      const rr = r * 0.22, t = cy + r * 1.02, l = cx - r, rt = cx + r, tp = cy - r;
      x.moveTo(l + rr, tp);
      x.lineTo(rt - rr, tp); x.quadraticCurveTo(rt, tp, rt, tp + rr);
      x.lineTo(rt, t); x.lineTo(cx, t - r * 0.34); x.lineTo(l, t);
      x.lineTo(l, tp + rr); x.quadraticCurveTo(l, tp, l + rr, tp);
    } else {                                                     // glass · tag · lux
      const rr = shape === 'glass' ? r * 0.42 : shape === 'lux' ? r * 0.3 : r * 0.26;
      const t = cy + r, l = cx - r, rt = cx + r, tp = cy - r;
      x.moveTo(l + rr, tp); x.arcTo(rt, tp, rt, t, rr); x.arcTo(rt, t, l, t, rr);
      x.lineTo(cx + r * 0.2, t); x.lineTo(cx, bot); x.lineTo(cx - r * 0.2, t);
      x.arcTo(l, t, l, tp, rr); x.arcTo(l, tp, rt, tp, rr);
    }
    x.closePath();
  };

  // Bóng đổ dưới chân — làm ghim trông "đứng" trên mặt đất chứ không dán phẳng.
  if (!round && shape !== 'ribbon') {
    x.save(); x.globalAlpha = 0.34; x.fillStyle = '#000';
    x.beginPath(); x.ellipse(cx, tipY - 3, rBody * 0.42, rBody * 0.13, 0, 0, Math.PI * 2);
    x.filter = 'blur(3px)'; x.fill(); x.restore();
  }

  // ══════════ SÁU PHONG CÁCH THIẾT KẾ ĐANG THỊNH ══════════
  // Mỗi kiểu bên dưới bắt chước một trường phái mà giới thiết kế quốc tế đang dùng, chứ không
  // phải đổi màu cho khác nhau. Vẽ riêng từng kiểu để giữ đúng chất của trường phái đó.

  // Ô BO MỀM (Material You của Google): khối bo góc rất mềm, nền màu NHẠT, biểu tượng ĐẬM MÀU.
  // Đây là lối "tonal" — dịu mắt, hợp bản đồ nhiều chi tiết vì không hét vào mặt người xem.
  if (shape === 'material') {
    const r = rBody, cy = cyBody, rr = r * 0.46;
    const khoi = (co = 0) => { const l = cx - r - co, rt = cx + r + co, tp = cy - r - co, bt = cy + r + co;
      x.beginPath(); x.moveTo(l + rr, tp); x.arcTo(rt, tp, rt, bt, rr); x.arcTo(rt, bt, l, bt, rr); x.arcTo(l, bt, l, tp, rr); x.arcTo(l, tp, rt, tp, rr); x.closePath(); };
    x.save(); x.shadowColor = 'rgba(6,14,26,.4)'; x.shadowBlur = 14; x.shadowOffsetY = 5;
    x.beginPath(); x.moveTo(cx - r * 0.26, cy + r * 0.9); x.lineTo(cx + r * 0.26, cy + r * 0.9); x.lineTo(cx, tipY); x.closePath();
    x.fillStyle = shade(color, 74); x.fill(); khoi(); x.fillStyle = shade(color, 74); x.fill(); x.restore();
    khoi(); x.lineWidth = 1.2; x.strokeStyle = hexA(color, 0.45); x.stroke();
    drawGlyph(x, icon, cx, cy, r * 0.56, shade(color, -66));
    return x.getImageData(0, 0, c.width, c.height);
  }
  // TRÒN PHẲNG (lối iOS / Apple Maps): tròn đều, màu no, vòng trắng mảnh, đuôi nhọn nhỏ xíu.
  // Sạch sẽ đến mức tối giản — nhìn là biết đồ Apple.
  if (shape === 'apple') {
    const r = rBody * 0.94, cy = cyBody;
    x.save(); x.shadowColor = 'rgba(6,14,26,.42)'; x.shadowBlur = 12; x.shadowOffsetY = 5;
    x.beginPath(); x.moveTo(cx - r * 0.3, cy + r * 0.86); x.lineTo(cx + r * 0.3, cy + r * 0.86); x.lineTo(cx, tipY); x.closePath(); x.fillStyle = color; x.fill();
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fillStyle = color; x.fill(); x.restore();
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.lineWidth = 4.6; x.strokeStyle = 'rgba(255,255,255,.97)'; x.stroke();
    drawGlyph(x, icon, cx, cy, r * 0.56, '#ffffff');
    return x.getImageData(0, 0, c.width, c.height);
  }
  // VIỀN ĐẬM BÓNG CỨNG (neubrutalism): viền đen dày, bóng đổ CỨNG lệch một góc, màu tươi rói.
  // Trường phái đang rất thịnh ở các trang thiết kế — nổi bật, vui mắt, không lẫn vào đâu được.
  if (shape === 'brutal') {
    const r = rBody, cy = cyBody, rr = r * 0.3;
    const khoi = (dx = 0, dy = 0) => { const l = cx - r + dx, rt = cx + r + dx, tp = cy - r + dy, bt = cy + r + dy;
      x.beginPath(); x.moveTo(l + rr, tp); x.arcTo(rt, tp, rt, bt, rr); x.arcTo(rt, bt, l, bt, rr); x.arcTo(l, bt, l, tp, rr); x.arcTo(l, tp, rt, tp, rr); x.closePath(); };
    x.beginPath(); x.moveTo(cx - r * 0.3 + 5, cy + r + 5); x.lineTo(cx + r * 0.3 + 5, cy + r + 5); x.lineTo(cx + 5, tipY); x.closePath(); x.fillStyle = '#0b1220'; x.fill();
    khoi(5, 5); x.fillStyle = '#0b1220'; x.fill();                       // bóng cứng, không nhoè
    x.beginPath(); x.moveTo(cx - r * 0.3, cy + r); x.lineTo(cx + r * 0.3, cy + r); x.lineTo(cx, tipY - 5); x.closePath();
    x.fillStyle = color; x.fill(); x.lineWidth = 3.4; x.strokeStyle = '#0b1220'; x.stroke();
    khoi(); x.fillStyle = color; x.fill(); khoi(); x.lineWidth = 3.6; x.strokeStyle = '#0b1220'; x.stroke();
    drawGlyph(x, icon, cx, cy, r * 0.54, '#0b1220');
    return x.getImageData(0, 0, c.width, c.height);
  }
  // NÉT MẢNH TỐI GIẢN (lối bản đồ Mapbox sáng): nền TRẮNG, viền màu mảnh, biểu tượng cùng màu viền.
  // Nhẹ nhất trong cả bộ — cắm hai ba chục cái vẫn không rối mắt.
  if (shape === 'netmanh') {
    const r = rBody * 0.92, cy = cyBody;
    x.save(); x.shadowColor = 'rgba(6,14,26,.32)'; x.shadowBlur = 12; x.shadowOffsetY = 4;
    x.beginPath(); x.moveTo(cx - r * 0.26, cy + r * 0.9); x.lineTo(cx + r * 0.26, cy + r * 0.9); x.lineTo(cx, tipY); x.closePath(); x.fillStyle = '#ffffff'; x.fill();
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fillStyle = '#ffffff'; x.fill(); x.restore();
    x.beginPath(); x.arc(cx, cy, r - 1.6, 0, Math.PI * 2); x.lineWidth = 3.2; x.strokeStyle = color; x.stroke();
    drawGlyph(x, icon, cx, cy, r * 0.54, shade(color, -18));
    return x.getImageData(0, 0, c.width, c.height);
  }
  // BÓNG DÀI PHẲNG (flat long-shadow): mảng màu phẳng, một vệt bóng chéo 45° kéo dài bên trong.
  // Lối thiết kế kinh điển của thời phẳng — đơn giản mà có chiều sâu.
  if (shape === 'bongdai') {
    const r = rBody * 0.94, cy = cyBody;
    x.save(); x.shadowColor = 'rgba(6,14,26,.4)'; x.shadowBlur = 12; x.shadowOffsetY = 5;
    x.beginPath(); x.moveTo(cx - r * 0.3, cy + r * 0.88); x.lineTo(cx + r * 0.3, cy + r * 0.88); x.lineTo(cx, tipY); x.closePath(); x.fillStyle = color; x.fill();
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fillStyle = color; x.fill(); x.restore();
    x.save(); x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.clip();     // vệt bóng chéo nằm gọn trong hình tròn
    x.beginPath(); x.moveTo(cx - r * 0.16, cy - r); x.lineTo(cx + r * 1.4, cy + r * 0.5); x.lineTo(cx + r * 1.4, cy + r * 1.4); x.lineTo(cx - r * 1.2, cy + r * 1.4); x.closePath();
    x.fillStyle = 'rgba(0,0,0,.2)'; x.fill(); x.restore();
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.lineWidth = 4.4; x.strokeStyle = 'rgba(255,255,255,.95)'; x.stroke();
    drawGlyph(x, icon, cx, cy, r * 0.56, '#ffffff');
    return x.getImageData(0, 0, c.width, c.height);
  }
  // CHUYỂN SẮC HAI MÀU: hai màu khác hẳn nhau chạy chéo — lối các app đời mới hay dùng cho nút chính.
  // Màu thứ hai lấy bằng cách hoán đổi ba kênh màu, nên luôn ra một sắc độ khác hẳn mà vẫn hợp mắt.
  if (shape === 'haimau') {
    const r = rBody, cy = cyBody, rr = r * 0.42;
    const khoi = () => { const l = cx - r, rt = cx + r, tp = cy - r, bt = cy + r;
      x.beginPath(); x.moveTo(l + rr, tp); x.arcTo(rt, tp, rt, bt, rr); x.arcTo(rt, bt, l, bt, rr); x.arcTo(l, bt, l, tp, rr); x.arcTo(l, tp, rt, tp, rr); x.closePath(); };
    const gg = x.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    gg.addColorStop(0, shade(color, 20)); gg.addColorStop(1, xoayMau(color));
    x.save(); x.shadowColor = 'rgba(6,14,26,.42)'; x.shadowBlur = 14; x.shadowOffsetY = 5;
    x.beginPath(); x.moveTo(cx - r * 0.26, cy + r * 0.92); x.lineTo(cx + r * 0.26, cy + r * 0.92); x.lineTo(cx, tipY); x.closePath(); x.fillStyle = xoayMau(color); x.fill();
    khoi(); x.fillStyle = gg; x.fill(); x.restore();
    khoi(); x.lineWidth = 4.4; x.strokeStyle = 'rgba(255,255,255,.95)'; x.stroke();
    drawGlyph(x, icon, cx, cy, r * 0.56, '#ffffff');
    return x.getImageData(0, 0, c.width, c.height);
  }

  // ══ GIỌT KÍNH TRONG ══ Kính mờ thật thì phải: nền rất nhạt, viền trắng mảnh sáng rõ,
  // một vệt sáng cong ở vai giọt, và BIỂU TƯỢNG ĂN MÀU CHÍNH (không phải trắng) — nhờ vậy nhìn
  // xuyên thấy được ảnh vệ tinh bên dưới mà chữ vẫn rõ.
  if (shape === 'giotkinh') {
    x.save(); x.globalAlpha = 0.3; x.fillStyle = '#000';
    x.beginPath(); x.ellipse(cx, tipY - 3, rBody * 0.4, rBody * 0.12, 0, 0, Math.PI * 2); x.filter = 'blur(3px)'; x.fill(); x.restore();
    x.save(); x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 14; x.shadowOffsetY = 5; body(); x.fillStyle = 'rgba(255,255,255,.10)'; x.fill(); x.restore();
    body(); const gk = x.createLinearGradient(0, cyBody - rBody, 0, tipY);
    gk.addColorStop(0, hexA(color, 0.56)); gk.addColorStop(0.55, hexA(color, 0.34)); gk.addColorStop(1, hexA(color, 0.52));
    x.fillStyle = gk; x.fill();
    body(); x.lineWidth = 4.4; x.strokeStyle = 'rgba(255,255,255,.92)'; x.stroke();   // vòng trắng dày = chất kính hiện đại
    body(); x.lineWidth = 1; x.strokeStyle = hexA(color, 0.6); x.stroke();
    drawGlyph(x, icon, cx, cyBody, rBody * 0.6, '#ffffff');
    return x.getImageData(0, 0, c.width, c.height);
  }
  // ══ MEN SỨ ══ Huy hiệu tròn kiểu men nung: vành trắng dày bao ngoài, ruột màu bóng,
  // một vòm sáng ở nửa trên. Nhìn "đắt" như huy hiệu cài áo.
  if (shape === 'mensu') {
    x.save(); x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 14; x.shadowOffsetY = 5;
    x.beginPath(); x.arc(cx, cyBody, rBody, 0, Math.PI * 2); x.fillStyle = '#ffffff'; x.fill(); x.restore();
    const gm = x.createLinearGradient(0, cyBody - rBody, 0, cyBody + rBody);
    gm.addColorStop(0, shade(color, 26)); gm.addColorStop(0.55, color); gm.addColorStop(1, shade(color, -26));
    x.beginPath(); x.arc(cx, cyBody, rBody * 0.84, 0, Math.PI * 2); x.fillStyle = gm; x.fill();
    x.beginPath(); x.arc(cx, cyBody, rBody * 0.84, 0, Math.PI * 2); x.lineWidth = 1.1; x.strokeStyle = 'rgba(6,14,26,.2)'; x.stroke();
    drawGlyph(x, icon, cx, cyBody, rBody * 0.56, light ? '#0A2540' : '#ffffff');
    return x.getImageData(0, 0, c.width, c.height);
  }
  if (shape === 'ring') {                                        // vòng khuyên: chỉ viền, nhìn xuyên qua
    x.save(); x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 12; x.shadowOffsetY = 4;
    x.beginPath(); x.arc(cx, cyBody, rBody * 0.86, 0, Math.PI * 2);
    x.lineWidth = rBody * 0.26; const rg = x.createLinearGradient(0, cyBody - rBody, 0, cyBody + rBody);
    rg.addColorStop(0, soft); rg.addColorStop(0.5, color); rg.addColorStop(1, deep);
    x.strokeStyle = rg; x.stroke(); x.restore();
    x.beginPath(); x.arc(cx, cyBody, rBody * 0.99, 0, Math.PI * 2); x.lineWidth = 3; x.strokeStyle = 'rgba(255,255,255,.92)'; x.stroke();
    x.beginPath(); x.arc(cx, cyBody, rBody * 0.73, 0, Math.PI * 2); x.lineWidth = 2.4; x.strokeStyle = 'rgba(255,255,255,.9)'; x.stroke();
    x.beginPath(); x.arc(cx, cyBody, rBody * 0.6, 0, Math.PI * 2); x.fillStyle = light ? 'rgba(255,255,255,.9)' : 'rgba(8,18,30,.72)'; x.fill();
    drawGlyph(x, icon, cx, cyBody, rBody * 0.42, light ? '#0A2540' : '#ffffff');
    return x.getImageData(0, 0, c.width, c.height);
  }

  // ══ LỐI VẼ HIỆN ĐẠI ══
  // Ghim của Google Maps / Apple Maps đời mới đều theo ba nguyên tắc, mình làm y vậy:
  //   ① MẢNG MÀU PHẲNG — chỉ chuyển sắc rất nhẹ, bỏ hết vòm sáng bóng loáng kiểu nhựa cũ.
  //   ② VÒNG TRẮNG bao quanh — thứ làm ghim đọc được trên MỌI nền: rừng xanh, cát trắng, mái tôn.
  //   ③ MỘT bóng đổ mềm duy nhất, không hào quang nhiều lớp (hào quang làm ghim trông "mù sương").
  // Biểu tượng to hơn, nét dày hơn, không viền không bóng — sạch và rõ.

  // ① Bóng đổ mềm phía sau — một lượt duy nhất, lệch xuống dưới như bóng thật.
  x.save();
  x.shadowColor = 'rgba(6,14,26,.42)'; x.shadowBlur = 13; x.shadowOffsetY = 5;
  body(); x.fillStyle = color; x.fill();
  x.restore();

  // ② Thân: chuyển sắc RẤT NHẸ (sáng hơn chút ở trên, đậm hơn chút ở dưới) — đủ để không bị bẹt
  //    mà vẫn giữ được cảm giác phẳng, sạch của bản đồ đời mới.
  body();
  const g = x.createLinearGradient(0, cyBody - rBody, 0, round ? cyBody + rBody : tipY);
  g.addColorStop(0, shade(color, 26)); g.addColorStop(0.55, color); g.addColorStop(1, shade(color, -26));
  x.fillStyle = g; x.fill();

  // ③ VÒNG TRẮNG bao ngoài + một nét tối cực mảnh phía ngoài cùng để tách khỏi nền sáng chói.
  body(); x.lineWidth = 5.2; x.strokeStyle = light ? 'rgba(10,37,64,.55)' : 'rgba(255,255,255,.96)'; x.stroke();
  body(); x.lineWidth = 1.1; x.strokeStyle = 'rgba(6,14,26,.22)'; x.stroke();
  // Kiểu "Vương miện" giữ thêm một vòng mảnh bên trong cho ra chất sang.
  if (shape === 'lux') { body(0.78); x.lineWidth = 1.4; x.strokeStyle = light ? 'rgba(10,37,64,.28)' : 'rgba(255,255,255,.5)'; x.stroke(); }

  // ④ Biểu tượng: to, nét dày, màu tương phản thẳng với thân — không bóng, không viền.
  //    Nền màu đã đủ đậm nên chữ trắng tự nổi; ghim màu trắng thì đảo lại chữ xanh đêm.
  const rIcon = rBody * (round ? 0.56 : 0.58);
  drawGlyph(x, icon, cx, cyBody, rIcon, ink);
  return x.getImageData(0, 0, c.width, c.height);
}
// Điểm + hướng đi trên MỘT TUYẾN (không khép kín) theo tiến độ p (0 = đầu tuyến, 1 = cuối tuyến).
// ══ RÚT GỌN TUYẾN (Douglas–Peucker) ══
// Bỏ hết những chỗ lồi lõm mà độ lệch nhỏ hơn 'epsM' mét. Đường thật lấy từ bản đồ có hàng trăm
// điểm bám sát từng vết bánh xe; giữ nguyên thì camera đuổi theo từng vết đó → lắc.
function donGianTuyen(pts: [number, number][], epsM: number): [number, number][] {
  if (pts.length < 3 || epsM <= 0) return pts;
  const lat0 = (pts[0][1] * Math.PI) / 180;
  const kx = 111320 * Math.cos(lat0), ky = 110540;
  const xy = pts.map((p) => [p[0] * kx, p[1] * ky] as [number, number]);
  const giu = new Array(pts.length).fill(false);
  giu[0] = true; giu[pts.length - 1] = true;
  const hang: [number, number][] = [[0, pts.length - 1]];
  while (hang.length) {
    const [i, j] = hang.pop() as [number, number];
    if (j <= i + 1) continue;
    const ax = xy[i][0], ay = xy[i][1], dx = xy[j][0] - ax, dy = xy[j][1] - ay;
    const L = Math.hypot(dx, dy) || 1e-9;
    let xa = -1, dMax = -1;
    for (let k = i + 1; k < j; k++) {
      const d = Math.abs((xy[k][0] - ax) * dy - (xy[k][1] - ay) * dx) / L;   // khoảng cách tới dây cung
      if (d > dMax) { dMax = d; xa = k; }
    }
    if (dMax > epsM && xa > 0) { giu[xa] = true; hang.push([i, xa], [xa, j]); }
  }
  return pts.filter((_, i) => giu[i]);
}
// ══ KẾ HOẠCH XOAY CAMERA — tính MỘT LẦN cho cả tuyến, trước khi chạy ══
// Đây là chỗ quyết định "cua hay không cua", làm theo lối người quay phim chứ không theo lối la bàn:
//   1. Bỏ mọi lồi lõm nhỏ hơn epsM mét (tính theo BỀ NGANG MÀN HÌNH — không thấy thì không cần cua).
//   2. GỘP các đoạn có hướng lệch nhau dưới 'gopDo' độ thành MỘT đoạn thẳng dài, hướng lấy trung bình
//      theo độ dài. Gộp đi gộp lại tới khi không gộp được nữa → chục khúc vặt biến thành một hướng duy nhất,
//      còn khúc rẽ thật thì vẫn đứng riêng.
//   3. Trả về danh sách "chặng": mỗi chặng một hướng cố định, chạy từ tiến độ d0 tới d1.
// Camera giữ nguyên hướng suốt cả chặng, chỉ xoay MỘT NHÁT ở ranh giới giữa hai chặng.
function keHoachXoay(pts: [number, number][], epsM: number, gopDo = 25, minDai = 0): { d0: number; d1: number; goc: number }[] {
  const rut = donGianTuyen(pts, epsM);
  if (rut.length < 2) return [];
  const lat0 = (rut[0][1] * Math.PI) / 180, kx = 111320 * Math.cos(lat0), ky = 110540;
  let doan: { dai: number; goc: number }[] = [];
  for (let i = 1; i < rut.length; i++) {
    const dx = (rut[i][0] - rut[i - 1][0]) * kx, dy = (rut[i][1] - rut[i - 1][1]) * ky;
    const dai = Math.hypot(dx, dy);
    if (dai < 0.5) continue;
    doan.push({ dai, goc: (Math.atan2(dx, dy) * 180) / Math.PI });
  }
  if (!doan.length) return [];
  let conGop = true;
  while (conGop) {
    conGop = false;
    const ra: { dai: number; goc: number }[] = [];
    for (const s of doan) {
      const t = ra[ra.length - 1];
      if (t) {
        let d = s.goc - t.goc; while (d > 180) d -= 360; while (d < -180) d += 360;
        if (Math.abs(d) < gopDo) { const tong = t.dai + s.dai; t.goc += d * (s.dai / tong); t.dai = tong; conGop = true; continue; }
      }
      ra.push({ dai: s.dai, goc: s.goc });
    }
    doan = ra;
  }
  // ── NUỐT CHỬNG CHẶNG QUÁ NGẮN ──
  // Một khúc ngoặt chỉ dài 30 m giữa hai đoạn thẳng dài thì KHÔNG đáng để xoay camera: xoay xong
  // chưa kịp nhìn đã phải xoay trả lại. Chặng nào ngắn hơn 'minDai' thì nhập vào chặng hàng xóm có
  // hướng gần nó nhất. Đây chính là chỗ quyết định "khúc nào cần cua, khúc nào bỏ qua".
  if (minDai > 0) {
    let con = true;
    while (con && doan.length > 1) {
      con = false;
      let iNhoNhat = -1, dNhoNhat = Infinity;
      for (let i = 0; i < doan.length; i++) if (doan[i].dai < dNhoNhat) { dNhoNhat = doan[i].dai; iNhoNhat = i; }
      if (dNhoNhat >= minDai || iNhoNhat < 0) break;
      const i = iNhoNhat;
      const lech = (a: number, b: number) => { let d = b - a; while (d > 180) d -= 360; while (d < -180) d += 360; return Math.abs(d); };
      const tr = doan[i - 1], sa = doan[i + 1];
      const vaoTruoc = tr && (!sa || lech(tr.goc, doan[i].goc) <= lech(sa.goc, doan[i].goc));
      const bia = vaoTruoc ? tr : sa;
      if (!bia) break;
      let d = doan[i].goc - bia.goc; while (d > 180) d -= 360; while (d < -180) d += 360;
      const tongDai = bia.dai + doan[i].dai;
      bia.goc += d * (doan[i].dai / tongDai); bia.dai = tongDai;
      doan.splice(i, 1); con = true;
    }
  }
  const tong = doan.reduce((a, s) => a + s.dai, 0) || 1;
  const kq: { d0: number; d1: number; goc: number }[] = [];
  let acc = 0;
  for (const s of doan) { kq.push({ d0: acc / tong, d1: (acc + s.dai) / tong, goc: s.goc }); acc += s.dai; }
  return kq;
}
// Cắt lấy phần đầu của MỘT đường bất kỳ theo tỉ lệ p (0→1). Dùng cho chế độ chạy ngược:
// không phải tráo đổi dữ liệu tuyến gốc nữa (tráo đổi làm hỏng bộ nhớ đệm, mỗi khung hình phải tính lại).
function catTuyen(pts: [number, number][], p: number): [number, number][] {
  if (pts.length < 2) return pts;
  const cong: number[] = [0]; let s2 = 0;
  for (let i = 1; i < pts.length; i++) { s2 += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); cong.push(s2); }
  if (!s2) return [pts[0]];
  const dich = s2 * Math.max(0, Math.min(1, p));
  const ra: [number, number][] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (cong[i] >= dich) { const d = cong[i] - cong[i - 1] || 1e-9; const t = (dich - cong[i - 1]) / d;
      ra.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]); break; }
    ra.push(pts[i]);
  }
  return ra;
}
function linePosDir(pts: [number, number][], p: number): { at: [number, number]; deg: number } | null {
  if (pts.length < 2) return null;
  const seg: number[] = []; let total = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); total += d; }
  if (!total) return { at: pts[0], deg: 0 };
  let target = total * Math.max(0, Math.min(1, p)), acc = 0;
  for (let i = 0; i < seg.length; i++) {
    if (acc + seg[i] >= target) {
      const f = seg[i] ? (target - acc) / seg[i] : 0; const a = pts[i], b = pts[i + 1];
      const deg = (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI;   // 0° = hướng lên bắc
      return { at: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], deg };
    }
    acc += seg[i];
  }
  const a = pts[pts.length - 2], b = pts[pts.length - 1];
  return { at: b, deg: (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI };
}
// Điểm nằm trên chu vi một vòng khép kín theo tiến độ p∈[0,1] — dùng cho đốm sáng chạy quanh viền lô.
function ringPos(ring: [number, number][], p: number): [number, number] | null {
  if (ring.length < 2) return null;
  const pts = [...ring, ring[0]]; const seg: number[] = []; let total = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); total += d; }
  if (!total) return ring[0];
  let target = total * (p - Math.floor(p)), acc = 0;
  for (let i = 1; i < pts.length; i++) {
    if (acc + seg[i - 1] >= target) { const t = seg[i - 1] ? (target - acc) / seg[i - 1] : 0; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]; }
    acc += seg[i - 1];
  }
  return ring[0];
}

// THU_GIAY = xem thử được bao nhiêu giây đầu khi chưa có gói.
const THU_GIAY = 8;
function MapVideoTool({ coQuyen = false, daDangNhap = false }: { coQuyen?: boolean; daDangNhap?: boolean }) {
  const { user } = useAuth();
  const isPro = laAdmin(user); // TODO: sau này mở thêm gói trả phí; bản free LUÔN giữ logo web.
  const boxRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const parcel = useRef<[number, number][]>([]);
  const route = useRef<[number, number][]>([]);
  const markers = useRef<Marker[]>([]); // điểm nhấn (POI) hiện trên bản đồ + video
  const radii = useRef<{ lng: number; lat: number; r: number }[]>([]); // vòng bán kính (r mét)
  const dists = useRef<{ a: [number, number]; b: [number, number] }[]>([]); // đoạn đo khoảng cách
  const distPending = useRef<[number, number] | null>(null); // điểm A đang chờ điểm B
  const callouts = useRef<Callout[]>([]); // thẻ chú thích có dây nối (Trường học · 500m)
  const arrows = useRef<Arrow[]>([]);     // mũi tên gạch đứt từ lô đất bắn ra chỗ nổi tiếng
  const zones = useRef<{ name: string; rings: [number, number][][] }[]>([]); // ranh giới xã/phường/tỉnh đã khoanh
  const dirPending = useRef<[number, number] | null>(null); // điểm A của "chỉ đường A→B"
  // ==== CHỌN PHƯƠNG ÁN ĐƯỜNG ĐI (giống Google Maps) ====
  // Lấy đường A→B xong thường có mấy lối khác nhau. Trước đây máy tự lấy lối đầu tiên, không hỏi gì.
  // Giờ hiện cả danh sách để chọn — bấm vào lối nào thì tuyến trên bản đồ đổi theo ngay, ưng thì chốt.
  const [dsTuyen, setDsTuyen] = useState<Tuyen[] | null>(null);
  const [tuyenChon, setTuyenChon] = useState(0);
  const tuyenCu = useRef<[number, number][]>([]);   // tuyến đang có trước khi tìm — bấm Huỷ thì trả lại
  const dragCard = useRef<{ id: string; ox: number; oy: number } | null>(null); // thẻ callout đang kéo
  const dragVert = useRef<{ kind: 'parcel' | 'route'; idx: number; moved: boolean } | null>(null); // đỉnh đang kéo (chế độ sửa)
  const modeRef = useRef<Mode>('none');
  const markerLabelRef = useRef('Tiện ích');
  const radiusRef = useRef(2000);
  const [mode, setMode] = useState<Mode>('none');
  const [fxPicker, setFxPicker] = useState(false);   // popup thư viện mẫu chữ
  const [fxQuery, setFxQuery] = useState('');
  const [panel, setPanel] = useState<string>('duan'); // bảng cài đặt đang mở ở cột giữa (mỗi lúc CHỈ 1 bảng → đỡ rối)
  const [tool, setTool] = useState('duan');           // ô công cụ đang sáng ở cột trái
  function pickTool(t: Tool) {
    setTool(t.key);
    if (t.mode !== undefined) { setMode(mode === t.mode && t.mode !== 'none' ? 'none' : t.mode); distPending.current = null; dirPending.current = null; }
    // Công cụ CHỈ CÓ BẢNG CÀI ĐẶT (Âm thanh, Chữ & lời, Camera…) thì phải TẮT chế độ vẽ đang bật.
    // Trước đây không tắt nên bấm "Âm thanh" xong bản đồ vẫn ở chế độ "Đo" — hai ô cùng sáng, bấm lên
    // bản đồ lại ra đường đo, người dùng tưởng máy chọn sai chức năng.
    else if (t.panel) { setMode('none'); distPending.current = null; dirPending.current = null; }
    if (t.panel) setPanel(t.panel); else if (t.mode !== undefined) setPanel('');
    // Trên điện thoại bảng cài đặt nằm NGAY DƯỚI thanh công cụ. Bấm một công cụ có bảng thì
    // cuộn tới đúng bảng đó cho khỏi phải tự tìm; công cụ chỉ để VẼ lên bản đồ thì cuộn ngược lên
    // khung xem trước để bấm luôn trên bản đồ.
    // MÁY TÍNH: cột cài đặt phải nhảy về đầu bảng vừa mở. Bảng trước có thể đang cuộn dở tận cuối,
    // không kéo lên thì bấm công cụ mới xong nhìn vào chỉ thấy khoảng trắng, tưởng máy không ăn lệnh.
    // Cuộn 2 lần: ngay lập tức, rồi cuộn lại sau khi bảng mới vẽ xong (bảng mới cao thấp khác nhau).
    if (typeof window !== 'undefined' && !window.matchMedia('(max-width: 1023px)').matches) {
      const lenDau = () => { const bang = document.querySelector('.cl-mb-sheet') as HTMLElement | null; if (bang) bang.scrollTo({ top: 0, behavior: 'smooth' }); };
      lenDau(); setTimeout(lenDau, 60); setTimeout(lenDau, 220);
    }
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      setTimeout(() => {
        const khung = document.querySelector('.cl-mb-stage') as HTMLElement | null;
        const bang = document.querySelector('.cl-mb-sheet') as HTMLElement | null;
        const hd = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cl-hd')) || 57;
        if (!khung) return;
        if (t.panel && bang) {
          // Khung xem truoc DINH o tren, nen phai tru dung chieu cao cua no ra, khong thi
          // bang cai dat bi khung de mat phan dau.
          const y = window.scrollY + bang.getBoundingClientRect().top - khung.getBoundingClientRect().height - hd - 4;
          window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
        } else {
          // Cong cu ve len ban do -> keo len cho thay tron ban do ma bam.
          const y = window.scrollY + khung.getBoundingClientRect().top - hd - 4;
          window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
        }
      }, 70);
    }
  }
  const [ready, setReady] = useState(false);
  const [rec, setRec] = useState(false);
  const [title, setTitle] = useState('Đất nền Cam Lâm');
  const [sub, setSub] = useState('Liên hệ: 0567 442 996');
  const [logo, setLogo] = useState(true);
  const [logoStyle, setLogoStyle] = useState('vienthuoc');  // kiểu thẻ thương hiệu đóng lên video
  const [logoPos, setLogoPos] = useState('auto');           // góc đặt thẻ ('auto' = tự né chỗ có chữ)
  const [labels, setLabels] = useState(true);
  const [base, setBase] = useState<'sat' | 'sat2' | 'street' | 'dark'>('sat');
  const [routeDir, setRouteDir] = useState<'xuoi' | 'nguoc'>('xuoi'); // chiều tuyến chạy trong video
  const [routeEase, setRouteEase] = useState('linear');                // kiểu chạy: đều / mượt / tăng tốc / giảm tốc
  const [routeHead, setRouteHead] = useState(true);                    // chấm sáng chạy ở đầu tuyến
  const [routeColor, setRouteColor] = useState('#ff5a2c');
  const [khungKm, setKhungKm] = useState(0);   // bề ngang mặt đất muốn thấy (km). 0 = theo kịch bản
  const [bienOn, setBienOn] = useState(false);      // chế độ quay ven biển
  const [bienHuong, setBienHuong] = useState(90);   // biển nằm hướng nào (độ, 90 = phía Đông — đúng cho Khánh Hoà)
  // Hai khung ngắm biển đã chốt — người dùng kéo chỉnh được. Rỗng = để máy tự chọn chỗ.
  // Khung ngắm biển = MỘT KEYFRAME chèn giữa kịch bản dẫn đường.
  // Ngoài mấy con số chỉnh nhanh (hướng · bay cao · ngả · dài), nó còn nhớ luôn GÓC MÁY TUYỆT ĐỐI
  // (đứng ở toạ độ nào, phóng bao nhiêu, nghiêng bao nhiêu, xoay về đâu) — giống hệt khung camera.
  // Lúc chạy, camera đang bay theo kịch bản sẽ ghé QUA đúng góc này rồi trả về đường bay cũ.
  //   kieu: 'bien' = khung ngắm biển · 'deo' = khung khoe đèo (bay ra biển, quay ngược vào bờ)
  type KhungBien = { t: number; huong: number; cao: number; nghieng: number; dai: number; lng?: number; lat?: number; zoom?: number; pitch?: number; bearing?: number; kieu?: 'bien' | 'deo' };
  const [bienKhung, setBienKhung] = useState<KhungBien[]>([]);
  const [deoOn, setDeoOn] = useState(false);        // kịch bản khoe đèo: bay ra biển, quay ngược vào núi
  // Chế độ hình ảnh: 'auto' = tự chuyển 2D/3D theo cảnh · '2d' = phẳng hết cho nhẹ · '3d' = núi nổi khối cả video
  const [hinhMode, setHinhMode] = useState<'auto' | '2d' | '3d'>('3d');   // để 3D suốt — không đổi qua lại nên không giật
  // Độ nổi của núi. 1 = đúng độ cao thật. Càng cao càng hùng vĩ nhưng ảnh càng bị kéo méo.
  const [noiKhoi, setNoiKhoi] = useState(1);
  // Render kỹ: dựng TỪNG KHUNG HÌNH một, khung nào vẽ xong hẳn mới ghi — lâu nhưng video mượt tuyệt đối
  const [renderKy, setRenderKy] = useState(true);
  // Sức máy — dò MỘT LẦN lúc mở công cụ, rồi cả bộ dựng video cứ theo đó mà liệu sức.
  const [sucMay, setSucMay] = useState<SucMay | null>(null);
  const sucMayRef = useRef<SucMay | null>(null);
  useEffect(() => { try { const sm = doSucMay(); setSucMay(sm); sucMayRef.current = sm; } catch { /* ignore */ } }, []);
  /**
   * Đặt cấu hình dựng video cho HỢP SỨC MÁY NÀY.
   *  · Máy có card đồ hoạ  → 1080p · 30 hình/giây · núi 3D suốt video (đẹp nhất, máy gánh được).
   *  · Máy vẽ bằng CPU     → 720p · 24 hình/giây · núi chỉ dựng lúc cần. Ít hơn 1/3 số khung phải vẽ,
   *    mỗi khung lại nhẹ hơn hẳn — dựng nhanh hơn nhiều mà video vẫn mượt y như vậy (render kỹ luôn
   *    chụp đủ từng khung, máy chậm chỉ làm mất thời gian chứ không làm video giật).
   */
  function apCaiDatHopMay() {
    const sm = sucMayRef.current || doSucMay();
    setRenderKy(true);
    if (sm.muc === 'yeu') {
      setRes('720'); setFpsQuay(24); setHinhMode('auto');
      toast.info('Máy này vẽ hình bằng CPU (không có card đồ hoạ) → đã đặt 720p · 24 hình/giây · núi chỉ dựng khi cần. Video vẫn mượt, chỉ là dựng lâu hơn máy có card.');
    } else {
      setRes('1080'); setFpsQuay(30); setHinhMode('3d');
      toast.success(sm.muc === 'manh'
        ? 'Máy khoẻ → 1080p · 30 hình/giây · núi 3D suốt video.'
        : 'Máy đủ sức → 1080p · 30 hình/giây · núi 3D suốt video. Thấy dựng lâu thì hạ xuống 24 hình/giây.');
    }
  }
  const [fpsQuay, setFpsQuay] = useState(30);        // số khung hình mỗi giây khi render kỹ
  const fpsRef = useRef(30);
  useEffect(() => { fpsRef.current = fpsQuay; }, [fpsQuay]);
  const renderKyRef = useRef(true);
  // Hai móc nối dùng cho chế độ render từng khung: vẽ lớp chữ/ghim/biểu đồ lên khung ghép, và
  // "chốt" đúng một khung hình vào video. Chỉ có giá trị trong lúc đang quay.
  const [tienDoRender, setTienDoRender] = useState(0);   // 0..1 — đang render tới đâu (chế độ render kỹ)
  // Chi tiết tiến độ: đang ở khung mấy trên tổng bao nhiêu, mỗi khung mất mấy giây, còn chừng bao lâu.
  // Dựng một video có khi mất cả chục phút — không cho người ta thấy con số thì y như máy treo.
  const [tienKhung, setTienKhung] = useState<{ m: number; n: number; giay: number; conLai: number } | null>(null);
  const mocBatDauRender = useRef(0);
  function ghiTienDo(soKhung: number, tongKhung: number) {
    if (soKhung === 1) mocBatDauRender.current = Date.now();
    if (soKhung % 5 !== 0 && soKhung !== tongKhung) return;      // 5 khung cập nhật một lần cho đỡ nặng
    const troi = (Date.now() - mocBatDauRender.current) / 1000;
    const moiKhung = soKhung > 1 ? troi / (soKhung - 1) : 0;
    setTienKhung({ m: soKhung, n: tongKhung, giay: moiKhung, conLai: Math.max(0, Math.round(moiKhung * (tongKhung - soKhung))) });
    setTienDoRender(Math.min(0.999, soKhung / Math.max(1, tongKhung)));
  }
  // Đang quay mà chuyển tab: bản đồ gần như ngừng vẽ → mỗi khung phải chờ hết giờ mới qua, dựng lâu gấp bội.
  useEffect(() => {
    const xem = () => { if (recRef.current && document.hidden) toast.info('Đang dựng video — nên để trang này hiện trên màn hình, chuyển tab khác sẽ chậm hơn nhiều.'); };
    document.addEventListener('visibilitychange', xem);
    return () => document.removeEventListener('visibilitychange', xem);
  }, []);
  const hieuUngRef = useRef<(() => void) | null>(null);   // gọi tay vòng hiệu ứng khi dựng video
  const veKhungRef = useRef<((el: number) => void) | null>(null);
  const ghiKhungRef = useRef<(() => void) | null>(null);
  const choTieuRef = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => { renderKyRef.current = renderKy; }, [renderKy]);
  const [hillshade, setHillshade] = useState(false);   // đổ bóng đồi núi
  const [terrain3d, setTerrain3d] = useState(false);   // dựng địa hình 3D thật (đồi núi nhô lên)
  /**
   * ══ DỰNG NÚI THÌ ĐỔI SANG ẢNH NHẸ ══
   * Ảnh vệ tinh nét (Esri) có tới mức phóng 18. Khi dựng núi, mỗi ô ảnh đó còn phải uốn cong theo mặt
   * đất — máy phải kéo về hàng trăm tấm ảnh nét rồi bẻ cong từng tấm. Đó là lý do bật 3D là nặng hẳn,
   * và cũng là lý do ảnh HD cứ nhảy vào nhảy ra giữa video.
   * Cách app kia làm (và rất đáng học): hễ dựng núi là dùng MỘT nguồn ảnh nhẹ duy nhất, tắt hẳn ảnh
   * nét. Đổi độ nét lấy tốc độ và sự ổn định — mà ở tầm nhìn thấy cả quả núi thì mắt không phân biệt
   * được độ nét nữa.
   * Ai muốn giữ ảnh nét thì bật "3D nét" — chậm hơn, đây là lựa chọn của người dùng.
   */
  const [net3d, setNet3d] = useState(false);
  // Kiểu TÔ chữ tiêu đề (vàng kim, neon, kính mờ…) — khác với 43 kiểu chữ XUẤT HIỆN, hai thứ chồng nhau được.
  const [chuKieu, setChuKieu] = useState('thuong');
  const [ngamLo, setNgamLo] = useState(2.5);   // kịch bản Dẫn đường: dừng lại NGẮM & XOAY quanh thửa đất mấy giây
  const [camTarget, setCamTarget] = useState(false); // camera luôn ngoái nhìn về lô đất (học từ Google Earth Studio)
  const [grade, setGrade] = useState('dienanh');         // lớp màu điện ảnh phủ lên ảnh vệ tinh
  const [toiGoc, setToiGoc] = useState(0.45);            // làm tối bốn góc khung hình (0 = tắt)
  const [moDongMan, setMoDongMan] = useState(true);      // tối dần ở đầu và cuối video
  const [khungAnToan, setKhungAnToan] = useState(false); // vạch vùng bị nút TikTok/Reels che (chỉ hiện lúc dựng)
  const [thuGonDuoi, setThuGonDuoi] = useState(false);   // giấu dòng thời gian để khung xem trước to hết cỡ
  // Trên điện thoại màn hình ngắn: cho phép GẤP khung xem trước lại để bảng cài đặt được rộng.
  // Hai nút ▶ Xem trước / 🎥 Quay & xuất vẫn còn, nên gấp rồi vẫn bấm chạy thử được.
  const [khungThu, setKhungThu] = useState(false);
  // Thanh tua trong khung video, làm giống YouTube: rê vào thì thanh dày lên, kéo thì hiện
  // ô giờ chạy theo ngón tay, và có vạch chia các phân cảnh như "chương" của YouTube.
  const [tuaHover, setTuaHover] = useState(false);
  const [tuaKeo, setTuaKeo] = useState(false);
  const [tuaGio, setTuaGio] = useState<{ x: number; giay: number } | null>(null);
  // Ô nhập THỜI LƯỢNG: giữ nguyên đúng cái người dùng đang gõ (kể cả ô trống), chỉ chốt số khi
  // rời ô hoặc bấm Enter. Trước đây chốt ngay từng ký tự nên xoá số là nó nhảy về 3 — không xoá nổi.
  const [goDai, setGoDai] = useState<string | null>(null);
  // Số điện thoại (che bớt) của người đang xem — in mờ lên bản dùng thử.
  // Ai quay lén màn hình rồi đem clip đi dùng thì trên clip có sẵn dấu vết của chính tài khoản đó.
  const maSoXem = (() => {
    const p = String(user?.phone || '').replace(/\D/g, '');
    if (p.length >= 7) return p.slice(0, 4) + '***' + p.slice(-3);
    return user?.fullName ? String(user.fullName).slice(0, 14) : '';
  })();
  // Bảng mời nâng cấp / mời đăng nhập. '' = không hiện.
  const [moiNangCap, setMoiNangCap] = useState<'' | 'het-thu' | 'tai-video' | 'dang-nhap'>('');
  // Kiểm tra trước khi cho làm việc gì đó. Trả true = được phép đi tiếp.
  function chotQuyen(viec: 'xem' | 'tai'): boolean {
    if (!daDangNhap) { setMoiNangCap('dang-nhap'); return false; }
    if (coQuyen) return true;
    if (viec === 'tai') { setMoiNangCap('tai-video'); return false; }
    return true;                                    // xem thử thì cho chạy, tới giây thứ 8 mới dừng
  }
  // ── BỐ CỤC ĐIỆN THOẠI (học từ CapCut / InShot / VN) ──
  // Màn hình nhỏ thì xếp: KHUNG XEM TRƯỚC trên cùng → DÒNG THỜI GIAN → THANH CÔNG CỤ dính đáy.
  // Bấm một công cụ thì bảng cài đặt TRƯỢT LÊN TỪ DƯỚI (bottom sheet), xong kéo xuống là đóng.
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 1023px)');
    const doi = () => setMobile(mq.matches);
    doi(); try { mq.addEventListener('change', doi); } catch { mq.addListener(doi); }
    return () => { try { mq.removeEventListener('change', doi); } catch { mq.removeListener(doi); } };
  }, []);
  // Trang nay la "xuong dung video": tren dien thoai no can TRON man hinh. Gan dau vao the body de
  // phan trang tri chung cua web (thanh menu duoi, bong bong chat) tu an di - xem quy tac trong globals.css.
  // Dong thoi do chieu cao thanh dau trang roi ghi vao bien --cl-hd: khung xem truoc "dinh" ngay
  // ben duoi no, khong bi thanh dau trang de len.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.add('cl-trang-video');
    // An HAN thanh menu duoi cua web khi dung tren dien thoai: no de len dung cho hay bam nhat.
    // Lam thang bang JS cho chac, khong phu thuoc quy tac CSS.
    const nho: { el: HTMLElement; cu: string }[] = [];
    if (window.matchMedia('(max-width: 1023px)').matches) {
      document.querySelectorAll('nav').forEach((n) => {
        const el = n as HTMLElement;
        if (getComputedStyle(el).position === 'fixed') { nho.push({ el, cu: el.style.display }); el.style.display = 'none'; }
      });
    }
    const dau = document.querySelector('header');
    // Thanh dau trang cua web nay CUON DI MAT (no nam trong mot khung chi cao bang chinh no),
    // chi trang chu moi ghim cung. Nen: ghim cung thi chua cho, khong thi dinh sat mep tren.
    const doCao = () => {
      const ghim = dau ? getComputedStyle(dau).position === 'fixed' : false;
      document.documentElement.style.setProperty('--cl-hd', (ghim ? (dau as HTMLElement).offsetHeight : 0) + 'px');
    };
    doCao();
    let ro: any = null;
    try { ro = new ResizeObserver(doCao); if (dau) ro.observe(dau); } catch {}
    window.addEventListener('resize', doCao);
    return () => {
      document.body.classList.remove('cl-trang-video');
      nho.forEach(({ el, cu }) => { el.style.display = cu; });
      window.removeEventListener('resize', doCao);
      try { ro?.disconnect(); } catch {}
    };
  }, []);
  const [tone, setTone] = useState('tuoi');                       // tông màu bản đồ
  const [toneCustom, setToneCustom] = useState<Tone | null>(null); // người dùng tự chỉnh thanh trượt
  const [parcelFx, setParcelFx] = useState<string>('glow');
  const [routeStyle, setRouteStyle] = useState('net');   // phong cách vẽ tuyến đường
  const [routeName, setRouteName] = useState('');        // tên con đường, in chạy dọc theo tuyến
  const [routeNameCol, setRouteNameCol] = useState('#ffffff');
  const routeNameRef = useRef('');
  const routeStyleRef = useRef('net'), routeColRef = useRef('#ff5a2c');
  const [parcelColor, setParcelColor] = useState('#C8A14B');
  const fxRef = useRef<string>('glow');   // kiểu hiệu ứng lô đất — nay có 8 kiểu nên để kiểu chữ tự do
  const colRef = useRef('#C8A14B');
  const [parcelOpacity, setParcelOpacity] = useState(0.28);
  const opRef = useRef(0.28);
  useEffect(() => { opRef.current = parcelOpacity; }, [parcelOpacity]);
  useEffect(() => { fxRef.current = parcelFx; }, [parcelFx]);
  useEffect(() => { routeStyleRef.current = routeStyle; routeColRef.current = routeColor; }, [routeStyle, routeColor]);
  // Đổi tên đường thì vẽ lại tuyến ngay (tên nằm trong dữ liệu của chính đường tuyến).
  useEffect(() => { routeNameRef.current = routeName; if (ready) drawRoute(tuyenVe()); }, [routeName, ready]);
  useEffect(() => { const m = mapRef.current; if (m?.getLayer?.('route-name')) { try { m.setPaintProperty('route-name', 'text-color', routeNameCol); } catch { /* ignore */ } } }, [routeNameCol, ready]);
  useEffect(() => { colRef.current = parcelColor; }, [parcelColor]);

  // ── State xuất/khổ/biểu đồ/timeline — KHAI BÁO TRƯỚC các effect PHASE 2 (dep array đọc ngay lúc render) ──
  const [q, setQ] = useState('');
  const [markerLabel, setMarkerLabel] = useState('Tiện ích');
  useEffect(() => { markerLabelRef.current = markerLabel; }, [markerLabel]);
  const [radiusM, setRadiusM] = useState(2000);
  useEffect(() => { radiusRef.current = radiusM; }, [radiusM]);
  // Kiểu ghim cho điểm nhấn (chấm / ghim giọt nước / radar) + màu ghim
  const [wPicker, setWPicker] = useState(false); // popup thư viện khối dựng sẵn
  const [pinPaste, setPinPaste] = useState(false); // hộp dán danh sách tiện ích
  const [pinPasteText, setPinPasteText] = useState('');
  const [pinShape, setPinShape] = useState('neon');
  const [pinAutoColor, setPinAutoColor] = useState(true);   // tự đổi màu ghim theo loại tiện ích
  const [pinGround, setPinGround] = useState(false);       // ghim to nhỏ cùng bản đồ (như vẽ lên mặt đất)
  const pinZ0 = useRef(15);
  const [pinAnim, setPinAnim] = useState('nhun');            // kiểu chuyển động của ghim
  const pinAnimRef = useRef('nhun');
  useEffect(() => { pinAnimRef.current = pinAnim; }, [pinAnim]);
  const [pinIcon, setPinIcon] = useState('truong');
  const [pinFamily, setPinFamily] = useState('icondong');   // nhóm kiểu ghim đang dùng
  const [fxFor, setFxFor] = useState<string | null>(null);   // bảng mẫu chữ đang chọn cho ai: null = tiêu đề video · id = dòng chữ trên bản đồ
  const [ghimMenu, setGhimMenu] = useState<{ i: number; x: number; y: number } | null>(null); // menu chuột phải trên một con ghim
  const [choDoiCho, setChoDoiCho] = useState<number | null>(null);   // đang chờ bấm chỗ mới để dời ghim
  const dragPin = useRef<{ i: number; moved: boolean } | null>(null); // đang kéo ghim bằng chuột
  const [pinTone, setPinTone] = useState('');               // tông màu đang chọn trong bảng ghim ('' = tông mặc định của kiểu)
  const [radarFx, setRadarFx] = useState('songlan');        // kiểu radar (chỉ dùng khi ghim là radar)
  // Zoom xa thì hàng chục cái ghim chồng lên nhau, rối mắt. Hai cách trị:
  const [pinMinZ, setPinMinZ] = useState(0);               // 1) mỗi ghim chỉ hiện từ mức phóng này trở lên (0 = luôn hiện)
  const [pinKhongDe, setPinKhongDe] = useState(true);      // 2) ghim/nhãn nào đè lên nhau thì tự giấu bớt
  const pinMinZRef = useRef(0);
  useEffect(() => { pinMinZRef.current = pinMinZ; }, [pinMinZ]);
  const [mapZ, setMapZ] = useState(15);                    // mức phóng hiện tại (hiện cho người dùng biết mà chọn)
  const radarFxRef = useRef('songlan');
  useEffect(() => { radarFxRef.current = radarFx; }, [radarFx]);
  const [pinPicker, setPinPicker] = useState<null | 'root' | string>(null);   // null = đóng · 'root' = mở ở kiểu đang dùng · còn lại = mã kiểu đang xem
  const [pinTim, setPinTim] = useState('');                 // gõ tên tiện ích/kiểu để lọc trong bộ sưu tập ghim
  const [pinColor, setPinColor] = useState('#C8A14B');
  // "Đã bán" là CÁI TÍCH, không phải một kiểu biển riêng — gạch được lên bất kỳ dáng biển nào.
  const [pinDaBan, setPinDaBan] = useState(false);
  const pinRef = useRef<{ shape: string; color: string; icon: string; daBan: boolean }>({ shape: 'drop', color: '#C8A14B', icon: 'truong', daBan: false });
  useEffect(() => { pinRef.current = { shape: pinShape, color: pinColor, icon: pinIcon, daBan: pinDaBan }; }, [pinShape, pinColor, pinIcon, pinDaBan]);
  // Thẻ chú thích (call out) + vùng hành chính + chỉ đường
  const [calloutLabel, setCalloutLabel] = useState('Trường học');
  // Thẻ chú thích nhiều dòng — đây là thứ làm thẻ "ra dáng tờ rơi bất động sản" thay vì chỉ một cái nhãn:
  // dòng đầu tên, dòng hai thông số (diện tích, mặt tiền…), dòng ba là GIÁ, tô vàng cho đập vào mắt.
  const [calloutSub, setCalloutSub] = useState('');
  const [calloutGia, setCalloutGia] = useState('');
  const [calloutDist, setCalloutDist] = useState(true); // thẻ có kèm khoảng cách tới lô đất?
  const [calloutStyle, setCalloutStyle] = useState<'gold' | 'white' | 'navy' | 'red'>('gold');
  const [parcelShape, setParcelShape] = useState<'poly' | 'rect' | 'square' | 'circle'>('poly'); // kiểu khoanh lô
  const parcelShapeRef = useRef<'poly' | 'rect' | 'square' | 'circle'>('poly');
  useEffect(() => { parcelShapeRef.current = parcelShape; }, [parcelShape]);
  const shapePending = useRef<[number, number] | null>(null); // điểm thứ nhất của hình chữ nhật/vuông/tròn
  const [calloutShape, setCalloutShape] = useState('lux'); // kiểu dây nối + khung thẻ
  const [coPicker, setCoPicker] = useState(false);           // popup chọn kiểu thẻ
  const calloutRef = useRef({ label: 'Trường học', dist: true, sub: '', gia: '' });
  useEffect(() => { calloutRef.current = { label: calloutLabel, dist: calloutDist, sub: calloutSub, gia: calloutGia }; }, [calloutLabel, calloutDist, calloutSub, calloutGia]);
  const [selCallout, setSelCallout] = useState<string | null>(null);
  // ── MŨI TÊN CHỈ HƯỚNG: cài đặt cho mũi tên SẮP bắn (mũi đã bắn giữ nguyên kiểu của nó) ──
  const [mtLabel, setMtLabel] = useState('Chỗ nổi tiếng');
  const [mtCol, setMtCol] = useState('#ffffff');        // màu vạch + đầu mũi
  const [mtTcol, setMtTcol] = useState('#ff2d95');      // màu chữ tên chỗ
  const [mtKieu, setMtKieu] = useState('dutdoan');
  const [mtDist, setMtDist] = useState(false);          // in kèm khoảng cách từ lô tới chỗ đó
  const [mtChay, setMtChay] = useState(true);           // vạch đứt bò dần về phía mũi
  const [mtVer, setMtVer] = useState(0);                // ép vẽ lại danh sách mũi tên trong bảng
  const [mtIcon, setMtIcon] = useState('bien');         // biểu tượng tròn gắn ở đầu mũi tên ('none' = không gắn)
  const mtRef = useRef({ label: 'Chỗ nổi tiếng', col: '#ffffff', tcol: '#ff2d95', kieu: 'dutdoan', dist: false, icon: 'bien' });
  useEffect(() => { mtRef.current = { label: mtLabel, col: mtCol, tcol: mtTcol, kieu: mtKieu, dist: mtDist, icon: mtIcon }; }, [mtLabel, mtCol, mtTcol, mtKieu, mtDist, mtIcon]);
  const mtChayRef = useRef(true);
  useEffect(() => { mtChayRef.current = mtChay; }, [mtChay]);
  const [zoneBusy, setZoneBusy] = useState(false);
  const [zoneOpacity, setZoneOpacity] = useState(0.18);
  const [dirBusy, setDirBusy] = useState(false);
  const [parcelPhoto, setParcelPhoto] = useState('');      // ảnh phối cảnh dán vào trong ranh lô đất
  const [photoOpacity, setPhotoOpacity] = useState(0.85);
  const [parcel3d, setParcel3d] = useState(false);   // dựng lô đất thành khối 3D nổi lên
  const [parcelSpark, setParcelSpark] = useState(false); // đốm sáng chạy vòng quanh viền lô
  const [loSoDo, setLoSoDo] = useState(false);           // in số đo từng cạnh + diện tích ngay trên lô
  // ── PHÁT SÁNG THÊM: một quầng sáng rộng nằm DƯỚI viền, bật/tắt bằng ô tick, mạnh yếu theo thanh kéo.
  //    Làm thành lớp riêng nên không phải sửa lại 8 kiểu hiệu ứng viền đang có — bật kiểu nào cũng sáng thêm được.
  const [sangLo, setSangLo] = useState(false);
  const [sangLoDo, setSangLoDo] = useState(0.7);         // 0,2 → 1,5
  const [sangTuyen, setSangTuyen] = useState(false);
  const [sangTuyenDo, setSangTuyenDo] = useState(0.7);
  const sangLoRef = useRef(false), sangLoDoRef = useRef(0.7), sangTuyenRef = useRef(false), sangTuyenDoRef = useRef(0.7);
  useEffect(() => { sangLoRef.current = sangLo; sangLoDoRef.current = sangLoDo; sangTuyenRef.current = sangTuyen; sangTuyenDoRef.current = sangTuyenDo; }, [sangLo, sangLoDo, sangTuyen, sangTuyenDo]);
  const [calloutVer, setCalloutVer] = useState(0);   // ép vẽ lại danh sách thẻ trong bảng thuộc tính
  const sparkRef = useRef(false);
  useEffect(() => { sparkRef.current = parcelSpark; }, [parcelSpark]);
  const [duration, setDuration] = useState(8);            // thời lượng video (giây)
  const [audio, setAudio] = useState<File | null>(null);  // nhạc nền (tuỳ chọn)
  const [voice, setVoice] = useState<File | null>(null);  // giọng đọc (tải lên hoặc thu mic)
  const [voiceRec, setVoiceRec] = useState(false);
  const voiceMediaRef = useRef<MediaRecorder | null>(null);
  const [layout, setLayout] = useState<Layout>('bottomLeft');
  const [res, setRes] = useState<'1080' | '720'>('1080');
  const [orient, setOrient] = useState<'16:9' | '9:16' | '1:1' | '4:5'>('16:9');
  const [khoXuat, setKhoXuat] = useState<string[]>(['16:9', '9:16']);   // các khổ sẽ xuất khi bấm "Xuất đủ khổ"
  const [previewing, setPreviewing] = useState(false);
  const [warming, setWarming] = useState(false); // đang nạp tile (che khung để không thấy camera nhảy)
  // PHASE 3: timeline — mỗi track 1 clip [start, dur] (giây). Điều khiển KHI nào phần tử xuất hiện trong video.
  const [clips, setClips] = useState({ route: [0.5, 5], text: [0, 8], chart: [0, 8], music: [0, 8] });
  const [tracksOn, setTracksOn] = useState<{ route: boolean; text: boolean; chart: boolean; music: boolean }>({ route: true, text: true, chart: true, music: true }); // ẩn/tắt track
  const [tlZoom, setTlZoom] = useState(1); // phóng to timeline
  const [safeArea, setSafeArea] = useState(false); // khung an toàn (guide, không vào video)
  const [playhead, setPlayhead] = useState(0);
  const elapRef = useRef(0); const textVisRef = useRef(true); const chartVisRef = useRef(true);
  const tlRef = useRef<HTMLDivElement | null>(null);
  const stopRef = useRef(false); // dừng "Chạy thử" giữa chừng
  // TẠM DỪNG khi đang chạy thử — đồng hồ bỏ qua đoạn nghỉ nên chạy tiếp là đúng chỗ vừa dừng.
  const [paused, setPaused] = useState(false);
  const pauseRef = useRef(false);      // đang tạm dừng?
  const pauseAccRef = useRef(0);       // tổng số mili-giây đã nghỉ
  const pauseAtRef = useRef(0);        // mốc lúc bắt đầu nghỉ
  // CỠ GIAO DIỆN — thay cho việc phải thu nhỏ trình duyệt về 80%. Chỉ ảnh hưởng màn hình, video xuất ra không đổi.
  // MẶC ĐỊNH LUÔN LÀ 80%: để 100% thì thanh công cụ bị xuống dòng, che mất khung xem trước.
  const [uiScale, setUiScale] = useState(0.8);
  const daNapCoChu = useRef(false);   // đã đọc xong mức đã lưu lần trước chưa (tránh ghi đè nhầm lúc mới mở)
  const [isFs, setIsFs] = useState(false);
  // THANH ĐIỀU KHIỂN trong khung video: hiện khi động chuột, TỰ ẨN sau 2,5 giây nằm im
  // trong lúc đang chạy — đúng kiểu YouTube, để nó khỏi che mất chữ tiêu đề ở đáy video.
  const [hoverStage, setHoverStage] = useState(false);
  const anThanhRef = useRef<any>(null);
  function danhThucThanh() {
    setHoverStage(true);
    if (anThanhRef.current) clearTimeout(anThanhRef.current);
    anThanhRef.current = setTimeout(() => { if (previewingRef.current && !pauseRef.current) setHoverStage(false); }, 2500);
  }
  const previewingRef = useRef(false);
  useEffect(() => { previewingRef.current = previewing; if (previewing) danhThucThanh(); }, [previewing]);
  useEffect(() => () => { if (anThanhRef.current) clearTimeout(anThanhRef.current); }, []);   // đang xem toàn màn hình? (lúc đó bỏ co giao diện cho ảnh kín màn)
  const recRef = useRef(false); // đang QUAY → giảm re-render (không cập nhật playhead) cho mượt + tải tile
  // PHASE 4: Undo/Redo — lịch sử ảnh chụp toàn bộ trạng thái editor (thay đổi hình học báo qua geomVer).
  const [geomVer, setGeomVer] = useState(0);
  const bumpGeom = () => setGeomVer((v) => v + 1);
  const choDoiChoRef = useRef<number | null>(null);
  useEffect(() => { choDoiChoRef.current = choDoiCho; }, [choDoiCho]);
  const histRef = useRef<{ past: string[]; future: string[]; applying: boolean; last: string }>({ past: [], future: [], applying: false, last: '' });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  useEffect(() => { setClips({ route: [0.5, Math.max(1, +(duration * 0.62).toFixed(1))], text: [0, duration], chart: [0, duration], music: [0, duration] }); setPlayhead(0); }, [duration]);
  const clipEnd = (c: number[]) => c[0] + c[1];
  const [exporting, setExporting] = useState(false);
  const [busyAll, setBusyAll] = useState(false); // đang xuất cả 5 video
  const [pct, setPct] = useState(0);
  const [chartOn, setChartOn] = useState(false);
  const [chartTitle, setChartTitle] = useState('Lượt quan tâm theo ngày');
  const [chartType, setChartType] = useState<string>('bar');
  const [chartSeries, setChartSeries] = useState('Đất nền, Nhà phố');   // tên các nhóm — chỉ dùng cho cột xếp chồng / cột nhóm
  const [chartRaw, setChartRaw] = useState('T2:80, T3:120, T4:150, T5:190, T6:250, T7:300');
  const [subs, setSubs] = useState<Sub[]>([]); // phụ đề theo thời gian (riêng từng kịch bản)
  const [camStyle, setCamStyle] = useState(''); // kiểu camera ghi đè (rỗng = theo kịch bản)
  const [textAnim, setTextAnim] = useState('fade'); // hiệu ứng chữ xuất hiện
  const [camKeys, setCamKeys] = useState<CamKeyframe[]>([]); // keyframe camera tự đặt (khi camStyle='custom')
  const [scenes, setScenes] = useState<Scene[]>([]); // phân cảnh (tổng thời lượng = tổng cảnh)
  // MÀN MỞ ĐẦU / KẾT THÚC (đoạn không có bản đồ) — mỗi kịch bản một cấu hình riêng.
  const [intro, setIntro] = useState<ScreenCard>({ on: false, dur: 2, bg: 'navy', title: '', sub: '' });
  const [outro, setOutro] = useState<ScreenCard>({ on: false, dur: 2.5, bg: 'gold', title: '', sub: '' });
  const [sfx, setSfx] = useState<Sfx[]>([]);          // các mốc tiếng động trên dòng thời gian
  const [sfxKind, setSfxKind] = useState('whoosh');
  function trySfx(kind: string) { try { const A: any = new ((window as any).AudioContext || (window as any).webkitAudioContext)(); playSfx(A, A.destination, kind, A.currentTime + 0.02); setTimeout(() => A.close?.(), 2200); } catch { toast.error('Máy không phát được âm thanh thử'); } }
  function addSfx() { setSfx((p) => [...p, { id: 'sx' + Date.now(), t: Math.round(playhead * 10) / 10, kind: sfxKind }].sort((a, b) => a.t - b.t)); }
  const introImgRef = useRef<HTMLImageElement | null>(null);
  const outroImgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => { if (!intro.img) { introImgRef.current = null; return; } const im = new Image(); im.onload = () => { introImgRef.current = im; }; im.src = intro.img; }, [intro.img]);
  useEffect(() => { if (!outro.img) { outroImgRef.current = null; return; } const im = new Image(); im.onload = () => { outroImgRef.current = im; }; im.src = outro.img; }, [outro.img]);
  const [objects, setObjects] = useState<Obj[]>([]); // object chữ/ảnh tự do trên video (theo kịch bản)
  const [selObj, setSelObj] = useState<string | null>(null); // object đang chọn
  type Asset = { id: string; kind: 'image' | 'video' | 'audio'; name: string; src: string; file?: File; fav?: boolean };
  const [library, setLibrary] = useState<Asset[]>([]); // thư viện media tái dùng (phiên làm việc)
  const [libFilter, setLibFilter] = useState('all'); const [libQuery, setLibQuery] = useState('');
  function registerAsset(a: Omit<Asset, 'id' | 'fav'>) { setLibrary((p) => (p.some((x) => x.src === a.src) ? p : [...p, { id: 'a' + Date.now() + Math.random().toString(36).slice(2, 5), fav: false, ...a }])); }
  const [ctxMenu, setCtxMenu] = useState<{ id: string; x: number; y: number } | null>(null); // menu chuột phải
  const objImgRef = useRef<Record<string, HTMLImageElement>>({}); // ảnh đã nạp theo id object
  const objVidRef = useRef<Record<string, HTMLVideoElement>>({}); // video element theo id object
  const objClip = useRef<Obj | null>(null); // clipboard copy/paste object
  const selObjRef = useRef<string | null>(null); const objectsRef = useRef<Obj[]>([]);
  const objElRef = useRef<Record<string, HTMLDivElement | null>>({});
  const playRef = useRef(0);
  useEffect(() => { playRef.current = playhead; }, [playhead]);
  useEffect(() => { selObjRef.current = selObj; objectsRef.current = objects; });
  const stageRef = useRef<HTMLDivElement | null>(null); // khung sân khấu (để tính kéo object)
  const [boxH, setBoxH] = useState(360); // chiều cao khung xem trước (để căn cỡ chữ object khớp video)
  useEffect(() => { objects.forEach((o) => { if (o.type === 'image' && o.src && !objImgRef.current[o.id]) { const im = new Image(); im.onload = () => { objImgRef.current[o.id] = im; setBoxH((h) => h); }; im.src = o.src; } }); }, [objects]);
  const [qrUrl, setQrUrl] = useState(''); // ảnh QR (dataURL) — dùng cho xem trước + vẽ lên video
  const qrImgRef = useRef<HTMLImageElement | null>(null);
  const [brandLogo, setBrandLogo] = useState(''); // logo tuỳ chỉnh (dataURL) — thay logo chữ
  const brandImgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => { if (!brandLogo) { brandImgRef.current = null; return; } const img = new Image(); img.onload = () => { brandImgRef.current = img; }; img.src = brandLogo; }, [brandLogo]);
  useEffect(() => { try { const b = JSON.parse(localStorage.getItem(BRAND_KEY) || 'null'); if (b?.logo) setBrandLogo(b.logo); } catch { /* ignore */ } }, []);
  function saveBrandKit() { try { localStorage.setItem(BRAND_KEY, JSON.stringify({ logo: brandLogo, phone: property.phone, zalo: property.zalo, website: property.website })); toast.success('Đã lưu Brand Kit (dùng cho mọi dự án)'); } catch { toast.error('Không lưu được Brand Kit'); } }

  // PHASE: PHIÊN BẢN (Versions) — lưu/khôi phục các mốc dự án.
  const [versions, setVersions] = useState<{ id: number; name: string; ts: number; data: string }[]>([]);
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem('camlam_versions_v1') || '[]'); if (Array.isArray(v)) setVersions(v); } catch { /* ignore */ } }, []);
  function persistVersions(v: { id: number; name: string; ts: number; data: string }[]) { setVersions(v); try { localStorage.setItem('camlam_versions_v1', JSON.stringify(v)); } catch { /* ignore */ } }
  function saveVersion() { const nm = prompt('Tên phiên bản:', 'Phiên bản ' + (versions.length + 1)); if (nm === null) return; persistVersions([...versions, { id: Date.now(), name: nm || ('Phiên bản ' + (versions.length + 1)), ts: Date.now(), data: snapStr() }]); toast.success('Đã lưu phiên bản'); }
  function restoreVersion(ver: { data: string; name: string }) { histRef.current.applying = true; applySnapshot(ver.data); toast.success('Đã khôi phục: ' + ver.name); }
  function deleteVersion(id: number) { persistVersions(versions.filter((x) => x.id !== id)); }
  const chartProgRef = useRef(0);
  const chartPrevRef = useRef<HTMLCanvasElement | null>(null);
  const layoutRef = useRef<Layout>('bottomLeft');
  useEffect(() => { layoutRef.current = layout; }, [layout]);

  // ── PHASE 2: dự án + 5 kịch bản + tự lưu ──
  const [property, setProperty] = useState<{ name: string; address: string; price: string; area: string; phone: string; zalo: string; website: string; qrOn?: boolean; qrData?: string }>({ name: 'Đất nền Cam Lâm', address: '', price: '', area: '', phone: '0567 442 996', zalo: '', website: '' });
  const [scripts, setScripts] = useState<{ key: string; name: string; focus: string; settings: Settings }[]>(() => SCRIPTS0.map((s) => ({ ...s, settings: mkSettings(s.key) })));
  const [activeScript, setActiveScript] = useState(0);
  // Kịch bản "Bay cao" có sàn riêng: thấp nhất 2,6 km, không cho hạ thấp hơn (hạ nữa thì hết là bay cao).
  const khungMin = ((camStyle || scripts[activeScript]?.key || '') === 'cd_cao') ? 3 : 0;
  useEffect(() => { if (khungMin > 0 && khungKm < khungMin) setKhungKm(12); }, [khungMin]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const hydrated = useRef(false);
  const pendingGeom = useRef<{ parcel: [number, number][]; route: [number, number][]; markers?: { lng: number; lat: number; label: string }[]; radii?: { lng: number; lat: number; r: number }[]; dists?: { a: [number, number]; b: [number, number] }[]; callouts?: Callout[]; arrows?: Arrow[]; zones?: { name: string; rings: [number, number][][] }[] } | null>(null);

  // ĐẶT THỜI LƯỢNG VIDEO (3 → 120 giây).
  // Trước đây khi đã chia phân cảnh thì thanh này bị KHOÁ CỨNG (thời lượng = tổng các cảnh),
  // nên kéo mãi không quá được con số cũ. Giờ vẫn chỉnh được: đổi tổng thời lượng thì
  // các cảnh tự co giãn theo đúng tỉ lệ, không cảnh nào bị mất.
  function datThoiLuong(v: number) {
    const d = Math.max(3, Math.min(120, Math.round(Number(v) || 0)));
    if (scenes.length) {
      const tong = scenes.reduce((a, x) => a + (x.dur || 0), 0) || 1;
      const ti = d / tong;
      setScenes(scenes.map((x) => ({ ...x, dur: Math.max(0.5, +((x.dur || 0) * ti).toFixed(1)) })));
    }
    setDuration(d);
  }
  function settingsNow(): Settings { return { title, sub, layout, orient, res, duration, base, parcelFx, parcelColor, chartOn, chartTitle, chartType, chartRaw, chartSeries, subs, camStyle, textAnim, camKeys, objects, scenes, intro, outro, sfx, tone, toneCustom, camTarget, logoStyle, logoPos, grade, toiGoc, moDongMan, routeDir, routeEase, routeHead, routeColor, routeStyle, routeName, routeNameCol, loSoDo, sangLo, sangLoDo, sangTuyen, sangTuyenDo, hillshade, terrain3d, pinAnim, pinGround, parcelOpacity, parcelSpark, parcel3d, photoOpacity, zoneOpacity, pinShape, pinColor, pinIcon, calloutStyle, calloutShape, labels, pinFamily, radarFx, pinMinZ, pinKhongDe, ngamLo, khungKm, bienOn, bienHuong, bienKhung, deoOn, hinhMode, renderKy, noiKhoi, fpsQuay, net3d, chuKieu }; }
  // Ghi chú: ẢNH dán trong lô (parcelPhoto) cố tình KHÔNG lưu — ảnh nền base64 rất nặng, lưu vào
  // bộ nhớ trình duyệt dễ đầy chỗ làm hỏng luôn việc tự lưu của cả dự án.
  function applySettings(s: Settings) { setTitle(s.title); setSub(s.sub); setLayout(s.layout); setOrient(s.orient); setRes(s.res); setDuration(s.duration); setBase(s.base); setParcelFx(s.parcelFx); setParcelColor(s.parcelColor); setChartOn(s.chartOn); setChartTitle(s.chartTitle); setChartType(s.chartType || 'bar'); setChartRaw(s.chartRaw); setChartSeries(s.chartSeries || 'Đất nền, Nhà phố'); setSubs(s.subs || []); setCamStyle(s.camStyle || ''); setTextAnim(s.textAnim || 'fade'); setCamKeys(s.camKeys || []); setObjects(s.objects || []); setScenes(s.scenes || []); setIntro(s.intro || { on: false, dur: 2, bg: 'navy', title: '', sub: '' }); setOutro(s.outro || { on: false, dur: 2.5, bg: 'gold', title: '', sub: '' }); setSfx(s.sfx || []); setTone(s.tone || 'tuoi'); setToneCustom(s.toneCustom || null); setCamTarget(!!s.camTarget); setLogoStyle(s.logoStyle || 'vienthuoc'); setLogoPos(s.logoPos || 'auto'); setGrade(s.grade || 'dienanh'); setToiGoc(s.toiGoc ?? 0.45); setMoDongMan(s.moDongMan !== false); setRouteDir(s.routeDir || 'xuoi'); setRouteEase(s.routeEase || 'linear'); setRouteHead(s.routeHead !== false); setRouteColor(s.routeColor || '#ff5a2c'); setRouteStyle(s.routeStyle || 'net'); setRouteName(s.routeName || ''); setRouteNameCol(s.routeNameCol || '#ffffff'); setLoSoDo(!!s.loSoDo); setSangLo(!!s.sangLo); setSangLoDo(s.sangLoDo ?? 0.7); setSangTuyen(!!s.sangTuyen); setSangTuyenDo(s.sangTuyenDo ?? 0.7); setHillshade(!!s.hillshade); setTerrain3d(!!s.terrain3d); setPinAnim(s.pinAnim || 'nhun'); setPinGround(!!s.pinGround); setParcelOpacity(s.parcelOpacity ?? 0.28); setParcelSpark(!!s.parcelSpark); setParcel3d(!!s.parcel3d); setPhotoOpacity(s.photoOpacity ?? 0.85); setZoneOpacity(s.zoneOpacity ?? 0.18); setPinShape(s.pinShape || 'neon'); setPinColor(s.pinColor || '#C8A14B'); setPinIcon(s.pinIcon || 'truong'); setCalloutStyle(s.calloutStyle || 'gold'); setCalloutShape(s.calloutShape || 'lux'); setLabels(s.labels !== false); setPinFamily(s.pinFamily || 'icondong'); setRadarFx(s.radarFx || 'songlan'); setPinMinZ(s.pinMinZ ?? 0); setPinKhongDe(s.pinKhongDe !== false); setNgamLo(s.ngamLo ?? 2.5); setKhungKm(s.khungKm ?? 0); setBienOn(!!s.bienOn); setBienHuong(s.bienHuong ?? 90); setBienKhung(s.bienKhung || []); setDeoOn(!!s.deoOn); setHinhMode(s.hinhMode || '3d'); setRenderKy(s.renderKy !== false); setNoiKhoi(s.noiKhoi ?? 1); setFpsQuay(s.fpsQuay ?? 30); setNet3d(!!s.net3d); setChuKieu(s.chuKieu || 'thuong'); setSelObj(null); }
  // ══ NHỮNG THỨ DÙNG CHUNG CHO CẢ DỰ ÁN, không thuộc riêng kịch bản nào ══
  // Cách phối màu lô đất, kiểu vẽ tuyến, kiểu ghim, tông màu bản đồ… là "bộ mặt" của cả dự án:
  // chỉnh một lần rồi mọi kịch bản đều theo. Trước đây mỗi kịch bản giữ một bản riêng nên đổi kịch bản
  // là cách phối vừa chỉnh bị thay bằng mặc định — đúng lỗi "chọn kịch bản khác là bị reset".
  // Riêng: tiêu đề, lời thoại, kiểu bay camera, khung đã chốt, chữ/ảnh, phân cảnh, thời lượng… vẫn của từng kịch bản.
  function phanDungChung(s: Settings): Partial<Settings> {
    return {
      base: s.base, tone: s.tone, toneCustom: s.toneCustom, grade: s.grade, toiGoc: s.toiGoc, labels: s.labels,
      logoStyle: s.logoStyle, logoPos: s.logoPos, moDongMan: s.moDongMan,
      parcelFx: s.parcelFx, parcelColor: s.parcelColor, parcelOpacity: s.parcelOpacity, parcel3d: s.parcel3d,
      parcelSpark: s.parcelSpark, loSoDo: s.loSoDo, sangLo: s.sangLo, sangLoDo: s.sangLoDo, photoOpacity: s.photoOpacity,
      routeStyle: s.routeStyle, routeColor: s.routeColor, routeDir: s.routeDir, routeEase: s.routeEase, routeHead: s.routeHead,
      routeName: s.routeName, routeNameCol: s.routeNameCol, sangTuyen: s.sangTuyen, sangTuyenDo: s.sangTuyenDo,
      pinShape: s.pinShape, pinColor: s.pinColor, pinIcon: s.pinIcon, pinFamily: s.pinFamily, pinAnim: s.pinAnim,
      pinGround: s.pinGround, pinMinZ: s.pinMinZ, pinKhongDe: s.pinKhongDe, radarFx: s.radarFx,
      calloutStyle: s.calloutStyle, calloutShape: s.calloutShape, zoneOpacity: s.zoneOpacity,
      hillshade: s.hillshade, terrain3d: s.terrain3d, ngamLo: s.ngamLo,
    };
  }
  function switchScript(i: number) {
    if (i === activeScript || i < 0 || i >= scripts.length) return;
    const now = settingsNow();
    const chung = phanDungChung(now);                    // giữ nguyên cách phối đang dùng
    const dich: Settings = { ...scripts[i].settings, ...chung };
    // Ghi luôn phần dùng chung vào MỌI kịch bản để lần sau mở ra cũng khớp, khỏi phải chỉnh lại.
    setScripts((prev) => prev.map((s, idx) => (idx === activeScript ? { ...s, settings: now } : { ...s, settings: { ...s.settings, ...chung } })));
    applySettings(dich); setActiveScript(i);
  }
  function renameScript(i: number, name: string) { setScripts((prev) => prev.map((s, idx) => (idx === i ? { ...s, name } : s))); }
  // Chốt cài đặt kịch bản ĐANG mở vào mảng (để các thao tác thêm/nhân bản/xoá không mất chỉnh sửa hiện tại).
  function commitActive() { return scripts.map((s, idx) => (idx === activeScript ? { ...s, settings: settingsNow() } : s)); }
  // Áp thông tin (tên + liên hệ) cho TẤT CẢ kịch bản.
  // AI VIẾT KỊCH BẢN — gọi máy chủ (dùng chung khoá AI), điền lời thoại/tiêu đề cho các kịch bản.
  const [aiBusy, setAiBusy] = useState(false);
  async function aiWriteScripts() {
    if (aiBusy) return; setAiBusy(true);
    try {
      const base = commitActive();
      const r: any = await api('/ai/video-script', { method: 'POST', body: JSON.stringify({ property, duration, scripts: base.map((s) => ({ key: s.key, name: s.name, focus: s.focus })) }) });
      const gen = r?.scripts || {};
      const next = base.map((s) => { const g = gen[s.key]; return g ? { ...s, settings: { ...s.settings, title: g.title || s.settings.title, sub: g.sub || s.settings.sub, subs: Array.isArray(g.subs) && g.subs.length ? g.subs : s.settings.subs } } : s; });
      setScripts(next); const cur = next[activeScript]; if (cur) applySettings(cur.settings);
      toast.success('AI đã viết lời thoại cho các kịch bản');
    } catch (e: any) { toast.error(e?.message || 'AI chưa viết được, thử lại sau'); }
    finally { setAiBusy(false); }
  }

  function applyInfoAll() { const base = commitActive(); const name = property.name?.trim() || 'Dự án'; const ph = property.phone?.trim(); setScripts(base.map((s) => ({ ...s, settings: { ...s.settings, title: name, sub: ph ? 'Liên hệ: ' + ph : s.settings.sub } }))); setTitle(name); if (ph) setSub('Liên hệ: ' + ph); toast.success('Đã áp thông tin cho tất cả kịch bản'); }

  // ── SCENES (phân cảnh) ── tổng thời lượng = tổng các cảnh.
  useEffect(() => { if (scenes.length) { const sum = scenes.reduce((a, s) => a + (s.dur || 0), 0); if (sum > 0) setDuration(Math.min(120, Math.max(1, Math.round(sum)))); } }, [scenes]);
  function addScene() { setScenes((p) => [...p, { id: 's' + Date.now(), name: 'Cảnh ' + (p.length + 1), dur: 4 }]); }
  function updateScene(id: string, patch: Partial<Scene>) { setScenes((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s))); }
  function deleteScene(id: string) { setScenes((p) => p.filter((s) => s.id !== id)); }
  function dupScene(id: string) { setScenes((p) => { const i = p.findIndex((s) => s.id === id); if (i < 0) return p; const c = { ...p[i], id: 's' + Date.now(), name: p[i].name + ' (2)' }; return [...p.slice(0, i + 1), c, ...p.slice(i + 1)]; }); }
  function moveScene(id: string, dir: number) { setScenes((p) => { const i = p.findIndex((s) => s.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= p.length) return p; const a = [...p]; const [x] = a.splice(i, 1); a.splice(j, 0, x); return a; }); }
  function makeDefaultScenes() { setScenes([['Tổng quan', 3], ['Dự án', 3], ['Hạ tầng', 3], ['Tiện ích', 3], ['Kêu gọi (CTA)', 3]].map(([n, d], i) => ({ id: 's' + (Date.now() + i), name: n as string, dur: d as number }))); }
  const sceneStart = (i: number) => scenes.slice(0, i).reduce((a, s) => a + (s.dur || 0), 0);

  // ── OBJECT tự do (chữ/ảnh) ──
  function addTextObj() { const id = 'o' + Date.now(); setObjects((p) => [...p, { id, type: 'text', x: 0.5, y: 0.5, scale: 1, rot: 0, opacity: 1, s: 0, e: duration, text: 'Chữ mới', size: 48, color: '#ffffff', weight: 700, bg: true }]); setSelObj(id); }
  // Thêm một phương tiện: mặc định BẬT SẴN "chạy theo tuyến" và "quay theo hướng đi" —
  // đó là lý do người ta thêm nó, khỏi phải mò hai cái tích đó.
  /**
   * ══ KHO CỜ CÁC NƯỚC ══
   * 271 lá cờ vector (bộ flag-icons, giấy phép MIT — dùng buôn bán thoải mái) nằm sẵn trong web ở
   * /co/<mã nước>.svg. Là ảnh vector nên phóng to cỡ nào cũng nét, khác hẳn cờ emoji (máy nào thiếu
   * phông là ra ô vuông đen).
   * Tên nước tiếng Việt KHÔNG nhập tay — hỏi thẳng trình duyệt, nên luôn đúng và đủ dấu.
   */
  const [dsCo, setDsCo] = useState<{ ma: string; ten: string }[]>([]);
  const [timCo, setTimCo] = useState('');
  const [moKhoCo, setMoKhoCo] = useState(false);
  useEffect(() => {
    if (!moKhoCo || dsCo.length) return;
    (async () => {
      try {
        const ds: string[] = await (await fetch('/co/index.json')).json();
        let ten: any = null;
        try { ten = new (Intl as any).DisplayNames(['vi'], { type: 'region' }); } catch { /* máy cũ thì thôi */ }
        const bang = ds.map((ma) => {
          let t = ma.toUpperCase();
          try { t = ten?.of(ma.toUpperCase()) || t; } catch { /* mã lạ thì giữ nguyên */ }
          return { ma, ten: t };
        }).sort((a, b) => (a.ma === 'vn' ? -1 : b.ma === 'vn' ? 1 : a.ten.localeCompare(b.ten, 'vi')));   // Việt Nam luôn đứng đầu
        setDsCo(bang);
      } catch { toast.error('Không mở được kho cờ'); }
    })();
  }, [moKhoCo, dsCo.length]);

  /** Cắm một vật thể 3D lên video — đứng yên một chỗ, không chạy theo tuyến như xe. */
  function addVat(vk: string) {
    const v = VAT_3D.find((x) => x.key === vk) || VAT_3D[0];
    const id = 'o' + Date.now();
    setObjects((p) => [...p, { id, type: 'xe', xk: 'vat:' + v.key, x: 0.5, y: 0.5, scale: 1, rot: 0, opacity: 1, s: 0, e: duration, color: '#ffffff', runRoute: false, faceDir: false }]);
    setSelObj(id);
    toast.success('Đã thêm ' + v.name + ' — kéo thả để đặt chỗ');
  }

  function addXe(xk: string) {
    const v = XE_LIST.find((x) => x.key === xk) || XE_LIST[0];
    const id = 'o' + Date.now();
    setObjects((p) => [...p, { id, type: 'xe', xk: v.key, x: 0.5, y: 0.5, scale: 1, rot: 0, opacity: 1, s: 0, e: duration, color: v.mau, runRoute: true, faceDir: false }]);   // không quay đầu: giữ dáng chéo 3/4 cho thấy rõ khối xe (đúng cách app tham chiếu làm)
    setSelObj(id);
    toast.success(route.current.length > 1 ? 'Đã thêm ' + v.name + ' — nó tự chạy dọc tuyến đường' : 'Đã thêm ' + v.name + ' — hãy vẽ tuyến đường để nó chạy theo');
  }
  function addWidget(wk: string) {
    const w = WIDGETS.find((x) => x.key === wk) || WIDGETS[0];
    const id = 'o' + Date.now();
    const nd = { ...w.d };
    if (property.name?.trim()) { if (wk === 'ios' || wk === 'lock') nd.t1 = property.name.trim().toUpperCase(); if (wk === 'profile') nd.t1 = property.name.trim(); }
    if (property.phone?.trim() && (wk === 'profile' || wk === 'call')) nd.t3 = property.phone.trim();
    if (wk === 'price') { if (property.area?.trim()) nd.t2 = property.area.trim() + ' m²'; if (property.price?.trim()) nd.t3 = property.price.trim(); }
    setObjects((p) => [...p, { id, type: 'widget', wk, wd: nd, x: 0.5, y: 0.5, scale: 1, rot: 0, opacity: 1, s: 0, e: duration }]);
    setSelObj(id); setPanel('media'); toast.success('Đã thêm: ' + w.name);
  }
  function addImageFromSrc(src: string) { const im = new Image(); im.onload = () => { const id = 'o' + Date.now(); objImgRef.current[id] = im; setObjects((p) => [...p, { id, type: 'image', x: 0.5, y: 0.5, scale: 1, rot: 0, opacity: 1, s: 0, e: duration, src, aspect: im.width / im.height }]); setSelObj(id); }; im.src = src; }
  function addVideoFromSrc(src: string) { const id = 'o' + Date.now(); const v = document.createElement('video'); v.src = src; v.muted = true; v.loop = true; (v as any).playsInline = true; v.onloadedmetadata = () => { objVidRef.current[id] = v; setObjects((p) => [...p, { id, type: 'video', x: 0.5, y: 0.5, scale: 1.4, rot: 0, opacity: 1, s: 0, e: duration, src, aspect: (v.videoWidth / v.videoHeight) || 1.78 }]); setSelObj(id); v.play().catch(() => {}); }; }
  function addImageObj(file: File) { const rd = new FileReader(); rd.onload = () => { const src = String(rd.result); registerAsset({ kind: 'image', name: file.name, src }); addImageFromSrc(src); }; rd.readAsDataURL(file); }
  function addVideoObj(file: File) { const src = URL.createObjectURL(file); registerAsset({ kind: 'video', name: file.name, src, file }); addVideoFromSrc(src); }
  function reuseAsset(a: Asset) { if (a.kind === 'image') addImageFromSrc(a.src); else if (a.kind === 'video') addVideoFromSrc(a.src); else if (a.kind === 'audio' && a.file) { setAudio(a.file); toast.success('Đã dùng nhạc: ' + a.name); } }
  // Kéo chấm góc = phóng to/thu nhỏ (theo khoảng cách tới tâm).
  function beginObjScale(o: Obj, e: React.PointerEvent) {
    e.preventDefault(); e.stopPropagation(); setSelObj(o.id); if (o.locked) return;
    const rc = stageRef.current?.getBoundingClientRect(); if (!rc) return;
    const cx = rc.left + o.x * rc.width, cy = rc.top + o.y * rc.height;
    const d0 = Math.hypot(e.clientX - cx, e.clientY - cy) || 1; const s0 = o.scale || 1;
    const mv = (ev: PointerEvent) => {
      const d = Math.hypot(ev.clientX - cx, ev.clientY - cy);
      updateObj(o.id, { scale: +Math.max(0.15, Math.min(8, (s0 * d) / d0)).toFixed(2) });
    };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
  // Kéo tay cầm trên đỉnh = xoay. Gần 0/45/90… thì tự bám cho thẳng.
  function beginObjRotate(o: Obj, e: React.PointerEvent) {
    e.preventDefault(); e.stopPropagation(); setSelObj(o.id); if (o.locked) return;
    const rc = stageRef.current?.getBoundingClientRect(); if (!rc) return;
    const cx = rc.left + o.x * rc.width, cy = rc.top + o.y * rc.height;
    const a0 = Math.atan2(e.clientY - cy, e.clientX - cx); const r0 = o.rot || 0;
    const mv = (ev: PointerEvent) => {
      const a = Math.atan2(ev.clientY - cy, ev.clientX - cx);
      let r = r0 + ((a - a0) * 180) / Math.PI;
      const snap = Math.round(r / 15) * 15; if (Math.abs(r - snap) < 4) r = snap;   // bám mốc 15°
      updateObj(o.id, { rot: Math.round(((r % 360) + 360) % 360) });
    };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
  function updateObj(id: string, patch: Partial<Obj>) { setObjects((p) => p.map((o) => (o.id === id ? { ...o, ...patch } : o))); }
  function deleteObj(id: string) { setObjects((p) => p.filter((o) => o.id !== id)); setSelObj(null); }
  function duplicateObj(id: string) { const o = objects.find((x) => x.id === id); if (!o) return; const nid = 'o' + Date.now(); if (o.type === 'image' && objImgRef.current[id]) objImgRef.current[nid] = objImgRef.current[id]; setObjects((p) => [...p, { ...o, id: nid, x: Math.min(0.95, o.x + 0.03), y: Math.min(0.95, o.y + 0.03) }]); setSelObj(nid); }
  function moveObjZ(id: string, dir: number) { setObjects((p) => { const i = p.findIndex((o) => o.id === id); if (i < 0) return p; const j = i + dir; if (j < 0 || j >= p.length) return p; const a = [...p]; const [x] = a.splice(i, 1); a.splice(j, 0, x); return a; }); }
  function alignObj(id: string, k: string) { const m: Record<string, Partial<Obj>> = { l: { x: 0.08 }, cx: { x: 0.5 }, r: { x: 0.92 }, t: { y: 0.08 }, cy: { y: 0.5 }, b: { y: 0.92 } }; updateObj(id, m[k] || {}); }
  function cloneMedia(from: string, to: string) { if (objImgRef.current[from]) objImgRef.current[to] = objImgRef.current[from]; if (objVidRef.current[from]) objVidRef.current[to] = objVidRef.current[from]; }
  // Cắt (split) object đang chọn tại playhead → 2 clip.
  function splitObj(id: string) { const o = objects.find((x) => x.id === id); if (!o) return; const p = Math.round(playhead * 10) / 10; if (p <= o.s + 0.1 || p >= o.e - 0.1) { toast.info('Đưa playhead vào GIỮA clip rồi Cắt'); return; } const nid = 'o' + Date.now(); cloneMedia(o.id, nid); setObjects((prev) => prev.flatMap((x) => (x.id === id ? [{ ...x, e: p }, { ...x, id: nid, s: p }] : [x]))); setSelObj(nid); toast.success('Đã cắt clip'); }
  function pasteObj() { const o = objClip.current; if (!o) return; const nid = 'o' + Date.now(); cloneMedia(o.id, nid); setObjects((prev) => [...prev, { ...o, id: nid, x: Math.min(0.95, o.x + 0.04), y: Math.min(0.95, o.y + 0.04) }]); setSelObj(nid); }
  // Kéo/co CLIP object trên timeline.
  function beginObjClipDrag(o: Obj, edge: 'move' | 'l' | 'r', e: React.PointerEvent) { e.preventDefault(); e.stopPropagation(); setSelObj(o.id); if (o.locked) return; const cont = tlRef.current; if (!cont) return; const wpx = cont.getBoundingClientRect().width; const total = Math.max(1, duration); const startX = e.clientX; const os = o.s, oe = o.e, len = oe - os; const snapT = [0, total, Math.round(playhead * 10) / 10]; const snap = (v: number) => { for (const t of snapT) { if (Math.abs(v - t) < total * 0.02 + 0.15) return t; } return v; }; const mv = (ev: PointerEvent) => { const d = ((ev.clientX - startX) / wpx) * total; let s = os, en = oe; if (edge === 'move') { s = Math.min(total - len, Math.max(0, os + d)); s = snap(s); en = s + len; } else if (edge === 'l') { s = Math.min(oe - 0.3, Math.max(0, snap(os + d))); en = oe; } else { en = Math.min(total, Math.max(os + 0.3, snap(oe + d))); s = os; } updateObj(o.id, { s: Math.round(s * 10) / 10, e: Math.round(en * 10) / 10 }); }; const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); }
  function beginObjDrag(o: Obj, e: React.PointerEvent) { e.preventDefault(); e.stopPropagation(); setSelObj(o.id); if (o.locked) return; const rc = stageRef.current?.getBoundingClientRect(); if (!rc) return; const mv = (ev: PointerEvent) => { const nx = Math.max(0, Math.min(1, (ev.clientX - rc.left) / rc.width)); const ny = Math.max(0, Math.min(1, (ev.clientY - rc.top) / rc.height)); const patch: any = { x: +nx.toFixed(3), y: +ny.toFixed(3) };
    if (o.geo && mapRef.current) { try { const g = mapRef.current.unproject([ev.clientX - rc.left, ev.clientY - rc.top]); patch.geo = [+g.lng.toFixed(6), +g.lat.toFixed(6)]; } catch { /* ignore */ } }
    updateObj(o.id, patch); }; const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); }

  // ── Quản lý kịch bản: thêm / nhân bản / xoá / đổi thứ tự (giữ nguyên chỉnh sửa đang mở) ──
  function addScript() {
    const now = settingsNow(); const ns = { key: 'kb' + Date.now(), name: 'Kịch bản ' + (scripts.length + 1), focus: 'Tùy chỉnh', settings: now };
    setScripts((prev) => [...prev.map((x, i) => (i === activeScript ? { ...x, settings: now } : x)), ns]);
    setActiveScript(scripts.length); toast.success('Đã thêm kịch bản');
  }
  function duplicateScript(i: number) {
    const now = settingsNow(); const srcSettings = i === activeScript ? now : scripts[i].settings;
    setScripts((prev) => { const cur = prev.map((x, idx) => (idx === activeScript ? { ...x, settings: now } : x)); const copy = { ...cur[i], key: 'kb' + Date.now(), name: cur[i].name + ' (bản sao)', settings: JSON.parse(JSON.stringify(cur[i].settings)) }; return [...cur.slice(0, i + 1), copy, ...cur.slice(i + 1)]; });
    setActiveScript(i + 1); applySettings(srcSettings); toast.success('Đã nhân bản kịch bản');
  }
  function deleteScript(i: number) {
    if (scripts.length <= 1) { toast.info('Cần giữ ít nhất 1 kịch bản'); return; }
    if (typeof window !== 'undefined' && !window.confirm('Xoá kịch bản "' + scripts[i].name + '"?')) return;
    const now = settingsNow(); const saved = scripts.map((x, idx) => (idx === activeScript ? { ...x, settings: now } : x)); const remaining = saved.filter((_, idx) => idx !== i);
    let na = activeScript; if (i < activeScript) na = activeScript - 1; else if (i === activeScript) na = Math.min(activeScript, remaining.length - 1);
    setScripts(remaining); setActiveScript(na); applySettings(remaining[na].settings); toast.success('Đã xoá kịch bản');
  }
  function moveScript(i: number, dir: number) {
    const j = i + dir; if (j < 0 || j >= scripts.length) return;
    const now = settingsNow(); const out = scripts.map((x, idx) => (idx === activeScript ? { ...x, settings: now } : x));
    const t = out[i]; out[i] = out[j]; out[j] = t; setScripts([...out]);
    setActiveScript(activeScript === i ? j : activeScript === j ? i : activeScript);
  }

  // Tạo NHANH 5 kịch bản KHÁC NHAU từ thông tin dự án: khác chữ + bố cục + khổ + hiệu ứng (kết hợp camera riêng → 5 video khác hẳn).
  function autoFillScripts() {
    const name = property.name?.trim() || 'Dự án'; const phone = property.phone?.trim() || '0567 442 996';
    const price = property.price?.trim(); const addr = property.address?.trim();
    const base0 = { res, duration, base, chartTitle, chartType, chartRaw, chartSeries };
    const P: Record<string, Settings> = {
      vitri:   { ...base0, title: `${name} — Vị trí đắc địa`,     sub: addr || 'Vị trí kết nối vùng',              layout: 'bottomLeft',   orient: '16:9', parcelFx: 'glow',  parcelColor: '#C8A14B', chartOn: false },
      hatang:  { ...base0, title: `${name} — Hạ tầng kết nối`,     sub: 'Cao tốc · Quốc lộ · Sân bay',              layout: 'topLeft',      orient: '16:9', parcelFx: 'ants',  parcelColor: '#ff3b30', chartOn: false },
      tienich: { ...base0, title: `${name} — Tiện ích xung quanh`, sub: 'Trường · Chợ · Biển · Bệnh viện',          layout: 'bottomCenter', orient: '1:1',  parcelFx: 'glow',  parcelColor: '#22c55e', chartOn: false },
      dautu:   { ...base0, title: `${name} — Cơ hội đầu tư`,       sub: price ? `Chỉ từ ${price}` : 'Tiềm năng tăng giá', layout: 'card',    orient: '16:9', parcelFx: 'glow',  parcelColor: '#3b82f6', chartOn: true },
      banhang: { ...base0, title: price ? `${name} — Mở bán ${price}` : `${name} — Mở bán`, sub: `Liên hệ: ${phone}`, layout: 'bottomCenter', orient: '9:16', parcelFx: 'blink', parcelColor: '#C8A14B', chartOn: false },
      chiduong:{ ...base0, title: `${name} — Dẫn đường tới dự án`, sub: addr || 'Lộ trình & vị trí', layout: 'bottomLeft', orient: '16:9', parcelFx: 'glow', parcelColor: '#f97316', chartOn: false },
    };
    Object.keys(P).forEach((k) => { (P[k] as any).subs = genScript(k, property, duration); (P[k] as any).title = name; }); // lời thoại vào video; tiêu đề chỉ là tên dự án (không ghép nhãn kịch bản)
    setScripts((prev) => prev.map((s) => (P[s.key] ? { ...s, settings: P[s.key] } : s)));
    const cur = scripts[activeScript]?.key; if (cur && P[cur]) applySettings(P[cur]);
    toast.success('Đã tạo bộ kịch bản (kèm lời thoại) — bấm từng tab để chỉnh thêm');
  }

  // renderRef: cấu hình quay LUÔN mới sau mỗi render → quay đúng từng kịch bản khi xuất cả bộ (đổi kịch bản giữa chừng không bị "state cũ").
  const renderRef = useRef<any>({});
  useEffect(() => { renderRef.current = { chuKieu, title, sub, orient, res, duration, chartOn, chartTitle, chartType, chartRaw, chartSeries, logo, clips, subs, textAnim, tracksOn, camKeys, objects, intro, outro, sfx, camTarget, logoStyle, logoPos, grade, toiGoc, moDongMan, routeDir, routeEase, routeHead, ngamLo, khungKm, bienOn, bienHuong, bienKhung, camKey: camStyle || scripts[activeScript]?.key || 'vitri' }; });
  // TUYẾN ĐƯỜNG CHỈ HIỆN KHI VIDEO ĐANG CHẠY.
  // Trước đây vẽ tuyến xong là nét màu nằm chình ình trên bản đồ ngay cả lúc chưa bấm gì — nhìn rối,
  // che mất lô đất. Giờ: lúc đang XEM TRƯỚC / QUAY thì tuyến chạy dần như cũ; lúc đang VẼ hoặc SỬA
  // ĐỈNH tuyến vẫn hiện (không thì không biết đường nào mà chỉnh); còn lại ẩn hẳn.
  useEffect(() => {
    const m = mapRef.current; if (!m?.getLayer?.('route-line')) return;
    // Thấy tuyến khi: đang vẽ / đang sửa đỉnh / đang chọn lối đi / ĐANG MỞ BẢNG TUYẾN ĐƯỜNG.
    // (Chốt lối xong là bảng Tuyến đường mở ra, nên tuyến vẫn hiện để còn chỉnh màu, kiểu vẽ.)
    // Sang bảng khác hoặc chạy video thì tuyến lại ẩn như cũ.
    const dangChinhTuyen = mode === 'route' || mode === 'edit' || !!dsTuyen || panel === 'tuyen';
    const v = (tracksOn.route && (previewing || rec || dangChinhTuyen)) ? 'visible' : 'none';
    for (const lop of ['route-line', 'route-glow', 'route-glow2', 'route-name'])
      if (m.getLayer(lop)) try { m.setLayoutProperty(lop, 'visibility', v); } catch { /* ignore */ }
    // CHẤM SÁNG ĐẦU TUYẾN: chỉ hiện lúc video CHẠY. Lúc đang dựng, nó đứng yên ngay giữa thửa đất
    // (điểm đầu tuyến) — chính là cái chấm/vệt màu nằm giữa lô nhìn rất vướng.
    const vHead = (tracksOn.route && (previewing || rec)) ? 'visible' : 'none';
    for (const lop of ['routehead-halo', 'routehead-dot'])
      if (m.getLayer(lop)) try { m.setLayoutProperty(lop, 'visibility', vHead); } catch { /* ignore */ }
    if (v === 'none') datChamDau(null);   // giấu luôn chấm sáng đầu tuyến (nó là lớp HTML riêng)
    // Lúc BAY, tắt bớt tầng lót mờ nhất (mức 12): mỗi lớp ảnh phủ kín màn hình là một lượt vẽ,
    // ba lớp chồng nhau ở khung 1080p là máy phải gồng. Ảnh đã nạp đủ trước khi bay nên bỏ tầng này
    // không sợ trắng — tầng lót mức 15 vẫn đỡ phía dưới. Dựng xong thì bật lại.
    // ⚠ LỖI VỪA SỬA: trước đây lúc BAY tôi tắt hai tầng lót cho nhẹ máy. Hậu quả: chỗ nào ảnh nét chưa
    // về kịp thì KHÔNG CÒN GÌ ĐỠ BÊN DƯỚI — lộ nguyên nền màu, thành mấy ô vuông tối thui (rõ nhất ở
    // đoạn kết kéo ra toàn cảnh và đoạn đầu lao vào thửa, vì mức phóng đổi rất nhanh).
    // Hai tầng lót phải LUÔN BẬT: lót mức 12 đỡ cho lúc nhìn toàn cảnh, lót mức 15 đỡ cho lúc bay sát.
    for (const nen of ['sat', 'sat2', 'street', 'dark']) {
      const dangDung = m.getLayer?.(nen) && m.getLayoutProperty?.(nen, 'visibility') !== 'none';
      for (const lop of ['lot' + nen, 'lot2' + nen]) {
        if (!m.getLayer?.(lop)) continue;
        try { m.setLayoutProperty(lop, 'visibility', dangDung ? 'visible' : 'none'); } catch { /* ignore */ }
      }
    }
    // Lối xám chỉ để CHỌN lúc dựng — chạy thử hay quay video là phải sạch bóng.
    const anLoiPhu = previewing || rec || !dsTuyen;
    for (const lop of ['loiphu-vien', 'loiphu-net'])
      if (m.getLayer(lop)) try { m.setLayoutProperty(lop, 'visibility', anLoiPhu ? 'none' : 'visible'); } catch { /* ignore */ }
    if (anLoiPhu) { nhanLoiRef.current.forEach((x) => { try { (x.getElement() as HTMLElement).style.display = 'none'; } catch { /* ignore */ } }); }
    else { nhanLoiRef.current.forEach((x) => { try { (x.getElement() as HTMLElement).style.display = ''; } catch { /* ignore */ } }); }
  }, [tracksOn.route, ready, previewing, rec, mode, dsTuyen, panel]);

  // Tạo ảnh QR (nạp thư viện từ CDN 1 lần) mỗi khi bật/đổi nội dung QR.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!property.qrOn || !property.qrData) { qrImgRef.current = null; setQrUrl(''); return; }
      try {
        const mod: any = await import('qrcode');
        const QR = mod.default || mod;
        const url: string = await QR.toDataURL(property.qrData, { margin: 1, width: 260, color: { dark: '#0A2540', light: '#ffffff' } });
        if (!alive) return;
        setQrUrl(url); const img = new Image(); img.onload = () => { qrImgRef.current = img; }; img.src = url;
      } catch (e) { console.warn('[qr]', e); }
    })();
    return () => { alive = false; };
  }, [property.qrOn, property.qrData]);

  // Áp MẪU vào kịch bản đang mở: set bố cục/khổ/hiệu ứng/camera + sinh lời thoại theo mẫu.
  function applyTemplate(tpl: Tpl) {
    setLayout(tpl.layout); setOrient(tpl.orient); setParcelFx(tpl.fx); setParcelColor(tpl.color); setChartOn(tpl.chartOn); setCamStyle(tpl.cam);
    setTitle(property.name?.trim() || 'Dự án'); if (property.phone?.trim()) setSub('Liên hệ: ' + property.phone.trim());
    const dur = duration; const n = tpl.lines.length || 1; const seg = Math.max(1, dur) / n;
    setSubs(tpl.lines.map((t, i) => ({ s: +(i * seg).toFixed(1), e: +Math.min(dur, (i + 1) * seg).toFixed(1), t })));
    toast.success('Đã áp mẫu: ' + tpl.name);
  }

  // Nạp dự án đã lưu (nếu có) khi mở trang.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.property) setProperty(p.property);
        if (Array.isArray(p.scripts) && p.scripts.length) {
          let sc = p.scripts;
          // ══ DỌN CÁC THẺ DẪN ĐƯỜNG CŨ (07 → 12) ══
          // Mấy kiểu quay dẫn đường giờ gộp hết vào thẻ 06, chọn bằng danh sách 6.1–6.4 trong bảng
          // Tuyến đường. Nhưng dự án đã lưu từ trước vẫn còn nguyên mấy thẻ cũ trên thanh — dọn đi cho
          // gọn, và nếu đang đứng ở thẻ nào thì chuyển về 06 kèm ĐÚNG kiểu bay của thẻ đó (không mất gì).
          const THE_CU = ['cd_sat', 'cd_ketlo', 'cd_capmat', 'cd_cao', 'cd_cao100', 'cd_cao400'];
          const dangO = sc[Math.min(p.activeScript || 0, sc.length - 1)]?.key || '';
          if (sc.some((x: any) => THE_CU.includes(x.key))) {
            sc = sc.filter((x: any) => !THE_CU.includes(x.key));
            // Về thẻ 06 thì phải là DẪN ĐƯỜNG CHUẨN như xưa nay — không tự nhảy sang kiểu bay cao.
            // Muốn kiểu khác thì tự chọn trong danh sách 6.1–6.4 ở bảng Tuyến đường.
            if (THE_CU.includes(dangO)) setCamStyle('');
          }
          SCRIPTS0.forEach((d) => { if (!sc.some((s: any) => s.key === d.key)) sc = [...sc, { ...d, settings: mkSettings(d.key) }]; }); // bổ sung kịch bản mặc định còn thiếu (vd 06 Dẫn đường ở bản cũ)
          setScripts(sc);
          const iDD = sc.findIndex((x: any) => x.key === 'chiduong');
          const a = THE_CU.includes(dangO) && iDD >= 0 ? iDD : Math.min(p.activeScript || 0, sc.length - 1);
          setActiveScript(a); applySettings(sc[a].settings);
        }
        if (p.geom) pendingGeom.current = p.geom;
      }
    } catch { /* ignore */ }
    hydrated.current = true;
  }, []);

  // Khôi phục lô/tuyến đã lưu sau khi bản đồ sẵn sàng.
  useEffect(() => {
    if (!ready || !pendingGeom.current) return;
    const g = pendingGeom.current; pendingGeom.current = null;
    if (g.parcel?.length) { parcel.current = g.parcel; drawParcel(); }
    if (g.route?.length) { route.current = g.route; drawRoute(g.route); }
    if (g.markers?.length) { markers.current = g.markers; drawMarkers(); }
    if (g.radii?.length) { radii.current = g.radii; drawRadii(); }
    if (g.dists?.length) { dists.current = g.dists; drawDists(); }
    if (g.callouts?.length) { callouts.current = g.callouts; drawCallouts(); setCalloutVer((v) => v + 1); }
    if (g.arrows?.length) { arrows.current = g.arrows; drawArrows(); setMtVer((v) => v + 1); }
    if (g.zones?.length) { zones.current = g.zones; drawZones(); }
    const b = bounds(); if (b) setTimeout(() => mapRef.current?.fitBounds(b, { padding: 120, duration: 0 }), 200);
  }, [ready]);

  // Tự lưu (debounce) — không mất khi F5.
  useEffect(() => {
    if (!hydrated.current) return;
    setSaveState('saving');
    const t = setTimeout(() => {
      try {
        const snap = { property, activeScript, scripts: scripts.map((s, i) => (i === activeScript ? { ...s, settings: settingsNow() } : s)), geom: { parcel: parcel.current, route: route.current, markers: markers.current, radii: radii.current, dists: dists.current, callouts: callouts.current, arrows: arrows.current, zones: zones.current } };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
        setSaveState('saved');
      } catch { setSaveState('idle'); }
    }, 700);
    return () => clearTimeout(t);
  }, [property, scripts, activeScript, title, sub, layout, orient, res, duration, base, parcelFx, parcelColor, chartOn, chartTitle, chartType, chartRaw, chartSeries, subs, camStyle, textAnim, camKeys, objects, scenes, intro, outro, sfx, tone, toneCustom, camTarget, logoStyle, logoPos, grade, toiGoc, moDongMan, routeDir, routeEase, routeHead, routeColor, routeStyle, routeName, routeNameCol, loSoDo, sangLo, sangLoDo, sangTuyen, sangTuyenDo, hillshade, terrain3d, pinAnim, pinGround, parcelOpacity, parcelSpark, parcel3d, photoOpacity, zoneOpacity, pinShape, pinColor, pinIcon, calloutStyle, calloutShape, labels, pinFamily, radarFx, pinMinZ, pinKhongDe, ngamLo, khungKm, bienOn, bienHuong, bienKhung, geomVer]);   // geomVer: vẽ lô/tuyến/ghim xong PHẢI tự lưu ngay, không thì F5 là mất

  // ── PHASE 4: History (Undo/Redo) ──
  // Cất toàn bộ dự án ra một file .json trên máy.
  function saveProjectFile() {
    try {
      const name = (property.name || 'du-an').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'du-an';
      const blob = new Blob([snapStr()], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'video-ban-do-' + name + '.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast.success('Đã lưu file dự án về máy');
    } catch { toast.error('Không lưu được file'); }
  }
  // Mở lại file dự án đã lưu.
  function openProjectFile(f: File) {
    f.text().then((txt) => {
      try { JSON.parse(txt); } catch { toast.error('File này không phải file dự án'); return; }
      applySnapshot(txt); toast.success('Đã mở lại dự án: ' + f.name);
    }).catch(() => toast.error('Không đọc được file'));
  }
  // ĐỌC LỜI THOẠI: dùng giọng đọc sẵn có trong máy/trình duyệt.
  const [voices, setVoices] = useState<any[]>([]);
  const [ttsVoice, setTtsVoice] = useState('');
  const [ttsRate, setTtsRate] = useState(1);
  const [ttsOn, setTtsOn] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).speechSynthesis) return;
    const load = () => {
      const vs = (window as any).speechSynthesis.getVoices() || [];
      const vi = vs.filter((v: any) => /vi/i.test(v.lang));                 // ưu tiên giọng tiếng Việt
      const list = [...vi, ...vs.filter((v: any) => !/vi/i.test(v.lang))];
      setVoices(list); setTtsVoice((cur) => cur || (list[0]?.name || ''));
    };
    load(); (window as any).speechSynthesis.onvoiceschanged = load;
    return () => { try { (window as any).speechSynthesis.onvoiceschanged = null; } catch { /* bỏ qua */ } };
  }, []);
  function speak(text: string) {
    const sy = (window as any).speechSynthesis; if (!sy) { toast.error('Máy này không có giọng đọc sẵn'); return; }
    sy.cancel();
    const u = new (window as any).SpeechSynthesisUtterance(text);
    const v = voices.find((x) => x.name === ttsVoice); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'vi-VN';
    u.rate = ttsRate; u.pitch = 1;
    u.onend = () => setTtsOn(false); u.onerror = () => setTtsOn(false);
    setTtsOn(true); sy.speak(u);
  }
  function speakScript() {
    const lines = (subs || []).map((x: Sub) => x.t).filter(Boolean);
    const all = [title, sub, ...lines].filter(Boolean).join('. ');
    if (!all.trim()) { toast.info('Chưa có chữ nào để đọc'); return; }
    speak(all);
  }
  function stopSpeak() { try { (window as any).speechSynthesis?.cancel(); } catch { /* bỏ qua */ } setTtsOn(false); }
  function snapStr(): string {
    return JSON.stringify({
      property, activeScript, clips,
      scripts: scripts.map((s, i) => (i === activeScript ? { ...s, settings: settingsNow() } : s)),
      geom: { parcel: parcel.current, route: route.current, markers: markers.current, radii: radii.current, dists: dists.current, callouts: callouts.current, arrows: arrows.current, zones: zones.current },
    });
  }
  function applySnapshot(raw: string) {
    let s: any; try { s = JSON.parse(raw); } catch { return; }
    if (s.property) setProperty(s.property);
    if (Array.isArray(s.scripts)) setScripts(s.scripts);
    if (typeof s.activeScript === 'number') setActiveScript(s.activeScript);
    const as = s.scripts?.[s.activeScript]?.settings; if (as) applySettings(as);
    if (s.clips) setClips(s.clips);
    parcel.current = s.geom?.parcel || []; route.current = s.geom?.route || []; markers.current = s.geom?.markers || [];
    radii.current = s.geom?.radii || []; dists.current = s.geom?.dists || [];
    callouts.current = s.geom?.callouts || []; zones.current = s.geom?.zones || []; arrows.current = s.geom?.arrows || [];
    drawParcel(); drawRoute(tuyenVe()); drawMarkers(); drawRadii(); drawDists(); drawCallouts(); drawZones(); drawArrows(); setCalloutVer((v) => v + 1); setMtVer((v) => v + 1); bumpGeom();
  }
  function undoHistory() {
    const h = histRef.current; if (!h.past.length) return;
    h.future.unshift(snapStr()); const prev = h.past.pop() as string; h.last = prev; h.applying = true;
    applySnapshot(prev); setCanUndo(h.past.length > 0); setCanRedo(true); setSaveState('saved');
    setGhimMenu(null); setChoDoiCho(null);            // đóng menu/chế độ đang dở, khỏi thao tác nhầm lên thứ vừa bị đổi
    toast.info('↶ Đã hoàn tác' + (h.past.length ? ' — còn ' + h.past.length + ' bước lùi được' : ' — hết bước để lùi'));
  }
  function redoHistory() {
    const h = histRef.current; if (!h.future.length) return;
    h.past.push(snapStr()); const nxt = h.future.shift() as string; h.last = nxt; h.applying = true;
    applySnapshot(nxt); setCanUndo(true); setCanRedo(h.future.length > 0);
    setGhimMenu(null); setChoDoiCho(null);
    toast.info('↷ Đã làm lại');
  }
  // Chốt "checkpoint" sau khi thao tác lắng xuống (debounce). Bỏ qua lần do chính Undo/Redo gây ra.
  useEffect(() => {
    if (!hydrated.current) return;
    if (histRef.current.applying) { histRef.current.applying = false; histRef.current.last = snapStr(); return; }
    const t = setTimeout(() => {
      const cur = snapStr(); const h = histRef.current;
      if (cur !== h.last) { if (h.last) h.past.push(h.last); if (h.past.length > 80) h.past.shift(); h.future = []; h.last = cur; setCanUndo(h.past.length > 0); setCanRedo(false); }
    }, 450);
    return () => clearTimeout(t);
  }, [property, scripts, activeScript, title, sub, layout, orient, res, duration, base, parcelFx, parcelColor, chartOn, chartTitle, chartType, chartRaw, chartSeries, subs, camStyle, textAnim, camKeys, objects, scenes, intro, outro, sfx, tone, toneCustom, camTarget, logoStyle, logoPos, grade, toiGoc, moDongMan, routeDir, routeEase, routeHead, routeColor, routeStyle, routeName, routeNameCol, loSoDo, sangLo, sangLoDo, sangTuyen, sangTuyenDo, hillshade, terrain3d, pinAnim, pinGround, parcelOpacity, parcelSpark, parcel3d, photoOpacity, zoneOpacity, pinShape, pinColor, pinIcon, calloutStyle, calloutShape, labels, pinFamily, radarFx, pinMinZ, pinKhongDe, ngamLo, khungKm, bienOn, bienHuong, bienKhung, clips, geomVer]);   // ĐỦ MỌI THỨ: thiếu cái nào thì Ctrl+Z không hoàn tác được cái đó
  // Phím tắt editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement; const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName) || el?.isContentEditable;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redoHistory(); else undoHistory(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redoHistory(); }
      else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); toast.success('Dự án tự lưu trên máy bạn'); }
      else if (mod && e.key.toLowerCase() === 'c' && !typing && selObjRef.current) { const o = objectsRef.current.find((x) => x.id === selObjRef.current); if (o) objClip.current = o; }
      else if (mod && e.key.toLowerCase() === 'v' && !typing && objClip.current) { e.preventDefault(); pasteObj(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && selObjRef.current) { e.preventDefault(); deleteObj(selObjRef.current); }
      else if (e.code === 'Space' && !typing) { e.preventDefault(); if (previewing) togglePause(); else preview(); }   // phím cách: chạy ↔ tạm dừng
      // Mũi tên trái/phải: tua lùi/tới 0,5 giây — giống YouTube. (Giữ Shift là ngả camera 3D nên bỏ qua.)
      else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !typing && !e.shiftKey && !mod && !previewing && !rec) { e.preventDefault(); nudgePlayhead(e.key === 'ArrowLeft' ? -0.5 : 0.5); }
      else if (e.key === 'Enter' && !typing && modeRef.current !== 'none') { e.preventDefault(); setMode('none'); shapePending.current = null; distPending.current = null; dirPending.current = null; toast.success('Đã xong'); }
      else if (e.key === 'Escape' && !typing) {
        if (choDoiChoRef.current != null) { setChoDoiCho(null); toast.info('Đã bỏ dời ghim'); }
        else if (previewing) { stopPreview(); }                                    // đang xem thử → Esc là dừng hẳn
        else if (modeRef.current === 'parcel' && parcel.current.length) { parcel.current = parcel.current.slice(0, -1); drawParcel(); bumpGeom(); toast.info('Đã bỏ điểm vừa vẽ'); }
        else if (modeRef.current === 'route' && route.current.length) { route.current = route.current.slice(0, -1); drawRoute(tuyenVe()); bumpGeom(); toast.info('Đã bỏ điểm vừa vẽ'); }
        else if (modeRef.current !== 'none') { setMode('none'); shapePending.current = null; distPending.current = null; dirPending.current = null; }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewing]);

  // ══ NGẢ CAMERA CHO RA CẢM GIÁC 3D — giữ Shift + 4 phím mũi tên ══
  //   Shift + ↑  : ngả camera xuống (nghiêng nhiều hơn) → nhà cửa, đồi núi dựng đứng lên như phim
  //   Shift + ↓  : dựng camera lên (nghiêng ít lại), tới 0° là nhìn thẳng từ trên xuống
  //   Shift + ← → : xoay bản đồ qua trái / qua phải
  //   Shift + 0  : trả về phẳng ngay (nghiêng 0°, hướng Bắc)
  // GIỮ phím là chạy đều tay chứ không giật từng nấc như kiểu phím lặp của Windows —
  // có vậy chốt khung camera mới ra góc mượt, quay video mới đẹp.
  const goc3d = useRef<{ keys: Set<string>; raf: number; t: number }>({ keys: new Set(), raf: 0, t: 0 });
  const [gocHud, setGocHud] = useState<{ pitch: number; bearing: number } | null>(null);
  const hudTimer = useRef<any>(null);
  // GÓC CAMERA HIỆN TẠI — hiện LUÔN ở thanh ngoài khung video.
  // Trước đây chỉ dẫn phím chỉ hiện lúc đang bấm phím trong khung, ai không biết có phím tắt thì
  // không bao giờ thấy. Giờ để hẳn ra ngoài, kèm nút bấm bằng chuột (điện thoại không có bàn phím).
  const [gocNgoai, setGocNgoai] = useState({ pitch: 0, bearing: 0 });
  useEffect(() => {
    const m = mapRef.current; if (!m || !ready) return;
    let lan = 0;
    const capNhat = () => {
      const now = performance.now(); if (now - lan < 110) return; lan = now;   // 9 lần/giây là mắt đủ thấy, máy vẫn nhẹ
      setGocNgoai({ pitch: m.getPitch(), bearing: m.getBearing() });
    };
    m.on('pitch', capNhat); m.on('rotate', capNhat); m.on('moveend', capNhat); capNhat();
    return () => { try { m.off('pitch', capNhat); m.off('rotate', capNhat); m.off('moveend', capNhat); } catch { /* bỏ qua */ } };
  }, [ready]);
  // Ngả / xoay camera bằng nút bấm — mỗi lần một nấc, hoặc trả về phẳng.
  function chinhGoc(dp: number, db: number, vePhang = false) {
    const m = mapRef.current; if (!m) return;
    if (previewing || rec) { toast.info('Đang chạy thử — dừng lại rồi mới chỉnh góc được'); return; }
    const p = vePhang ? 0 : Math.max(0, Math.min(85, m.getPitch() + dp));
    let b = vePhang ? 0 : m.getBearing() + db;
    if (b > 180) b -= 360; if (b < -180) b += 360;
    m.easeTo({ pitch: p, bearing: b, duration: vePhang ? 420 : 200 });
    setGocNgoai({ pitch: p, bearing: b });
  }
  // ĐỊNH VỊ: đưa bản đồ về đúng chỗ bạn đang đứng + cắm một chấm xanh đánh dấu.
  // Cần trang chạy bằng https (tên miền thật) hoặc localhost thì trình duyệt mới cho lấy vị trí.
  const [dangDinhVi, setDangDinhVi] = useState(false);
  const chamToiRef = useRef<any>(null);
  function dinhViToi() {
    const m = mapRef.current; if (!m) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) { toast.error('Máy này không hỗ trợ định vị'); return; }
    setDangDinhVi(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDangDinhVi(false);
        const lng = pos.coords.longitude, lat = pos.coords.latitude;
        try {
          if (chamToiRef.current) chamToiRef.current.remove();
          const el = document.createElement('div');
          el.title = 'Chỗ bạn đang đứng';
          el.style.cssText = 'width:18px;height:18px;border-radius:999px;background:#22c55e;box-shadow:0 0 0 4px rgba(34,197,94,.28),0 0 0 1.5px #fff,0 2px 6px rgba(0,0,0,.5)';
          chamToiRef.current = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(m);
        } catch { /* bỏ qua */ }
        m.flyTo({ center: [lng, lat], zoom: Math.max(m.getZoom(), 16.5), duration: 1200 });
        toast.success('Đã tới chỗ bạn đang đứng — sai số khoảng ' + Math.round(pos.coords.accuracy || 0) + ' m');
      },
      (e) => {
        setDangDinhVi(false);
        toast.error(e.code === 1 ? 'Bạn chưa cho phép trình duyệt lấy vị trí' : e.code === 3 ? 'Lấy vị trí quá lâu — thử lại chỗ thoáng' : 'Không lấy được vị trí');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 },
    );
  }
  useEffect(() => {
    const TOC_NGHIENG = 42, TOC_XOAY = 65;                 // độ mỗi giây khi giữ phím
    const MUI_TEN = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    const dung = () => { const g = goc3d.current; if (g.raf) cancelAnimationFrame(g.raf); g.raf = 0; g.t = 0; };
    const chay = () => {
      const g = goc3d.current; const m = mapRef.current;
      if (!m || !g.keys.size) { dung(); return; }
      const now = performance.now(); const dt = g.t ? Math.min(0.05, (now - g.t) / 1000) : 0; g.t = now;
      let p = m.getPitch(), b = m.getBearing();
      if (g.keys.has('ArrowUp')) p += TOC_NGHIENG * dt;
      if (g.keys.has('ArrowDown')) p -= TOC_NGHIENG * dt;
      if (g.keys.has('ArrowRight')) b += TOC_XOAY * dt;
      if (g.keys.has('ArrowLeft')) b -= TOC_XOAY * dt;
      p = Math.max(0, Math.min(85, p));                     // 85° là mức ngả tối đa của bản đồ
      if (b > 180) b -= 360; if (b < -180) b += 360;
      m.jumpTo({ pitch: p, bearing: b });
      setGocHud({ pitch: p, bearing: b });
      g.raf = requestAnimationFrame(chay);
    };
    const xuong = (e: KeyboardEvent) => {
      if (!e.shiftKey) return;
      const el = e.target as HTMLElement; if (/^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName) || el?.isContentEditable) return;
      if (previewing || rec) return;                        // đang chạy thử / đang quay thì camera do kịch bản điều khiển
      const m = mapRef.current; if (!m) return;
      if (e.code === 'Digit0' || e.code === 'Numpad0') {     // Shift + 0 → về phẳng
        e.preventDefault(); m.easeTo({ pitch: 0, bearing: 0, duration: 420 });
        setGocHud({ pitch: 0, bearing: 0 });
        if (hudTimer.current) clearTimeout(hudTimer.current);
        hudTimer.current = setTimeout(() => setGocHud(null), 1400);
        return;
      }
      if (!MUI_TEN.includes(e.key)) return;
      e.preventDefault();
      const g = goc3d.current; g.keys.add(e.key);
      if (hudTimer.current) clearTimeout(hudTimer.current);
      if (!g.raf) { g.t = 0; g.raf = requestAnimationFrame(chay); }
    };
    const len = (e: KeyboardEvent) => {
      const g = goc3d.current;
      if (e.key === 'Shift') g.keys.clear(); else g.keys.delete(e.key);   // buông Shift là ngưng hẳn
      if (!g.keys.size) { dung(); if (hudTimer.current) clearTimeout(hudTimer.current); hudTimer.current = setTimeout(() => setGocHud(null), 1400); }
    };
    const roiCuaSo = () => { goc3d.current.keys.clear(); dung(); };        // bấm sang cửa sổ khác thì thả hết phím
    window.addEventListener('keydown', xuong); window.addEventListener('keyup', len); window.addEventListener('blur', roiCuaSo);
    return () => { window.removeEventListener('keydown', xuong); window.removeEventListener('keyup', len); window.removeEventListener('blur', roiCuaSo); dung(); if (hudTimer.current) clearTimeout(hudTimer.current); };
  }, [previewing, rec]);
  // Mở ra là 80%. Nếu lần trước tự chỉnh sang mức khác thì dùng lại mức đó.
  useEffect(() => {
    try { const v = parseFloat(localStorage.getItem('clvideo_uiscale_v2') || ''); if (v >= 0.5 && v <= 1.5) setUiScale(v); } catch { /* bỏ qua */ }
    daNapCoChu.current = true;
  }, []);
  useEffect(() => {
    // Chỉ ghi nhớ khi CHÍNH NGƯỜI DÙNG chỉnh. Ghi sớm hơn là đè mất mức đã lưu lần trước.
    if (daNapCoChu.current) { try { localStorage.setItem('clvideo_uiscale_v2', String(uiScale)); } catch { /* bỏ qua */ } }
    const t = setTimeout(() => { try { mapRef.current?.resize(); } catch { /* ignore */ } }, 80);   // đổi cỡ xong bản đồ phải đo lại khung
    return () => clearTimeout(t);
  }, [uiScale]);
  // Gấp khung xem trước rồi mở lại thì bản đồ phải ĐO LẠI khung, không thì nó vẽ lệch một góc.
  useEffect(() => {
    if (khungThu) return;
    const t = setTimeout(() => { try { mapRef.current?.resize(); } catch { /* ignore */ } }, 90);
    return () => clearTimeout(t);
  }, [khungThu]);
  // Theo dõi lúc vào/ra toàn màn hình để bỏ co giao diện và đo lại khung bản đồ.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onFs = () => {
      setIsFs(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
      setTimeout(() => { try { mapRef.current?.resize(); } catch { /* ignore */ } }, 120);
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  useEffect(() => { if (!isPro) setLogo(true); }, [isPro]); // bản MIỄN PHÍ: luôn giữ logo web (không cho tắt)
  useEffect(() => { const m = mapRef.current; if (m) setTimeout(() => m.resize(), 80); }, [orient]); // đổi khổ → map vẽ lại đúng tỉ lệ

  // Vòng lặp HIỆU ỨNG lô đất — chạy liên tục (xem trước, quay, lúc rảnh) theo hiệu ứng + màu đang chọn.
  useEffect(() => {
    if (!ready) return; let raf = 0; const t0 = gioHieuUng(); let lastPinT = -1;
    const tick = () => {
      const m = mapRef.current;
      if (_dungHieuUng) { raf = requestAnimationFrame(tick); return; }   // đang soi khung → giữ nguyên hình
      if (m && m.getLayer) {
        const t = (gioHieuUng() - t0) / 1000; const fx = fxRef.current; const col = colRef.current; const s = 0.5 + 0.5 * Math.sin(t * 3);
        // ── PHÁT SÁNG THÊM cho lô đất & tuyến đường: quầng rộng thở rất chậm, nằm dưới viền chính.
        //    Tắt thì đặt bề rộng = 0 nên không tốn gì. Bật thì mạnh yếu theo thanh kéo (20%–150%).
        try {
          // Kéo thanh là SÁNG HƠN chứ KHÔNG DÀY HƠN: bề rộng gần như giữ nguyên, chỉ tăng độ đậm
          // và độ nhoè của quầng. Nét vẽ to ra thì thành "viền dày", không còn ra ánh sáng nữa.
          if (m.getLayer('parcel-glow2')) {
            const bat = sangLoRef.current && parcel.current.length >= 3;
            const k = sangLoDoRef.current, nhip = 0.82 + 0.18 * Math.sin(t * 1.5);
            m.setPaintProperty('parcel-glow2', 'line-color', col);
            m.setPaintProperty('parcel-glow2', 'line-width', bat ? 24 : 0);
            m.setPaintProperty('parcel-glow2', 'line-blur', bat ? 13 : 0);
            m.setPaintProperty('parcel-glow2', 'line-opacity', bat ? Math.min(0.95, 0.62 * k) * nhip : 0);
          }
          if (m.getLayer('route-glow2')) {
            const bat = sangTuyenRef.current && route.current.length >= 2;
            const k = sangTuyenDoRef.current, nhip = 0.82 + 0.18 * Math.sin(t * 1.85);
            m.setPaintProperty('route-glow2', 'line-color', routeColRef.current);
            m.setPaintProperty('route-glow2', 'line-width', bat ? 26 : 0);
            m.setPaintProperty('route-glow2', 'line-blur', bat ? 15 : 0);
            m.setPaintProperty('route-glow2', 'line-opacity', bat ? Math.min(0.95, 0.6 * k) * nhip : 0);
          }
        } catch { /* ignore */ }
        // Đoạn này CHỈ dành cho lô đất. Chưa khoanh lô thì bỏ qua, nhưng ghim · thẻ chú thích ·
        // radar · chữ ghim xuống đất ở phía dưới VẪN phải chạy (trước đây đứng chết vì bị chặn ở đây).
        if (m.getLayer('parcel-line') && parcel.current.length >= 3) try {
          m.setPaintProperty('parcel-line', 'line-color', col); m.setPaintProperty('parcel-glow', 'line-color', col); m.setPaintProperty('parcel-fill', 'fill-color', col);
          const op = opRef.current;
          // NEON HAI LỚP — dựng theo đúng công thức ở neonHaiLop(). Ba lớp chồng nhau, sáng dần theo s.
          if (fx === 'neon2') {
            const ti = doMinRef.current || 1;
            const n = neonHaiLop(3, 1, ti, 0.35 + 0.65 * s);
            m.setPaintProperty('parcel-glow2', 'line-width', n.ngoai.rong);
            m.setPaintProperty('parcel-glow2', 'line-opacity', n.ngoai.mo);
            m.setPaintProperty('parcel-glow2', 'line-blur', n.ngoai.nhoe);
            m.setPaintProperty('parcel-glow', 'line-width', n.trong.rong);
            m.setPaintProperty('parcel-glow', 'line-opacity', n.trong.mo);
            m.setPaintProperty('parcel-glow', 'line-blur', n.trong.nhoe);
            m.setPaintProperty('parcel-line', 'line-width', n.chinh.rong);
            m.setPaintProperty('parcel-line', 'line-opacity', 1);
            m.setPaintProperty('parcel-line', 'line-dasharray', [999]);
            m.setPaintProperty('parcel-fill', 'fill-opacity', op);
          }
          else if (fx === 'glow') { m.setPaintProperty('parcel-line', 'line-width', 3 + 2 * s); m.setPaintProperty('parcel-line', 'line-opacity', 1); m.setPaintProperty('parcel-line', 'line-dasharray', [999]); m.setPaintProperty('parcel-glow', 'line-opacity', 0.15 + 0.45 * s); m.setPaintProperty('parcel-fill', 'fill-opacity', op); }
          else if (fx === 'blink') { const on = Math.sin(t * 4.5) > 0; m.setPaintProperty('parcel-line', 'line-width', 4); m.setPaintProperty('parcel-line', 'line-opacity', on ? 1 : 0.12); m.setPaintProperty('parcel-line', 'line-dasharray', [999]); m.setPaintProperty('parcel-glow', 'line-opacity', 0); m.setPaintProperty('parcel-fill', 'fill-opacity', on ? Math.min(1, op * 1.6) : op * 0.3); }
          else if (fx === 'ants') { const step = Math.floor(t * 8) % 4; const pats = [[0, 2, 2], [1, 2, 1], [2, 2, 0], [0.5, 2, 1.5]]; m.setPaintProperty('parcel-line', 'line-width', 3.5); m.setPaintProperty('parcel-line', 'line-opacity', 1); m.setPaintProperty('parcel-line', 'line-dasharray', pats[step]); m.setPaintProperty('parcel-glow', 'line-opacity', 0); m.setPaintProperty('parcel-fill', 'fill-opacity', op * 0.75); }
          // ── VIỀN KÉP SANG: một nét trắng mảnh ôm ngoài, một nét màu ở trong. Đây là lối viền của
          //    mấy tờ rơi bất động sản cao cấp — sạch, sang, không loè loẹt.
          else if (fx === 'vienkep') {
            m.setPaintProperty('parcel-glow', 'line-color', '#ffffff'); m.setPaintProperty('parcel-glow', 'line-width', 9);
            m.setPaintProperty('parcel-glow', 'line-blur', 0.4); m.setPaintProperty('parcel-glow', 'line-opacity', 0.92);
            m.setPaintProperty('parcel-line', 'line-width', 3.4); m.setPaintProperty('parcel-line', 'line-opacity', 1);
            m.setPaintProperty('parcel-line', 'line-dasharray', [999]); m.setPaintProperty('parcel-fill', 'fill-opacity', op);
          }
          // ── VỆT SÁNG CHẠY QUANH VIỀN: một quầng sáng trượt vòng quanh lô, kiểu hiệu ứng "viền chạy"
          //    của các app du lịch. Sang hơn kiến bò vì nét liền, chỉ có ánh sáng di chuyển.
          else if (fx === 'chaysang') {
            const pha = (t * 1.6) % 1;
            m.setPaintProperty('parcel-glow', 'line-color', col); m.setPaintProperty('parcel-glow', 'line-blur', 5);
            m.setPaintProperty('parcel-glow', 'line-width', 14); m.setPaintProperty('parcel-glow', 'line-opacity', 0.28 + 0.34 * Math.abs(Math.sin(pha * Math.PI)));
            m.setPaintProperty('parcel-line', 'line-width', 3.2); m.setPaintProperty('parcel-line', 'line-opacity', 1);
            m.setPaintProperty('parcel-line', 'line-dasharray', [0.7, 1.6, 0.7, 6]);
            m.setPaintProperty('parcel-fill', 'fill-opacity', op * 0.85);
          }
          // ── THỞ NHẸ: cả mảng và viền phập phồng RẤT chậm. Không giật, không nháy — hợp video
          //    giới thiệu resort, biệt thự, nơi cần cảm giác êm đềm sang trọng.
          else if (fx === 'nhipnha') {
            const th = 0.5 + 0.5 * Math.sin(t * 1.15);
            m.setPaintProperty('parcel-glow', 'line-color', col); m.setPaintProperty('parcel-glow', 'line-blur', 6);
            m.setPaintProperty('parcel-glow', 'line-width', 16); m.setPaintProperty('parcel-glow', 'line-opacity', 0.1 + 0.3 * th);
            m.setPaintProperty('parcel-line', 'line-width', 2.6); m.setPaintProperty('parcel-line', 'line-opacity', 0.8 + 0.2 * th);
            m.setPaintProperty('parcel-line', 'line-dasharray', [999]);
            m.setPaintProperty('parcel-fill', 'fill-opacity', op * (0.62 + 0.38 * th));
          }
          // ── NÉT MẢNH TỐI GIẢN: viền mảnh, không quầng, ruột gần như trong suốt.
          //    Hợp khi trong khung đã nhiều ghim/thẻ — lô đất chỉ cần "có mặt" chứ không cần hét.
          else if (fx === 'toigian') {
            m.setPaintProperty('parcel-glow', 'line-opacity', 0);
            m.setPaintProperty('parcel-line', 'line-width', 2); m.setPaintProperty('parcel-line', 'line-opacity', 0.95);
            m.setPaintProperty('parcel-line', 'line-dasharray', [999]); m.setPaintProperty('parcel-fill', 'fill-opacity', op * 0.4);
          }
          else { m.setPaintProperty('parcel-line', 'line-width', 3); m.setPaintProperty('parcel-line', 'line-opacity', 1); m.setPaintProperty('parcel-line', 'line-dasharray', [999]); m.setPaintProperty('parcel-glow', 'line-opacity', 0); m.setPaintProperty('parcel-fill', 'fill-opacity', op); }
        } catch { /* ignore */ }
        // ══ PHONG CÁCH TUYẾN ĐƯỜNG ══
        // Mỗi kiểu chỉnh hai lớp: 'route-glow' (lớp dưới, để làm quầng hoặc viền bọc) và
        // 'route-line' (nét chính chạy trên). Vẽ trong vòng lặp vì có kiểu cần chạy động.
        if (m.getLayer('route-line')) try {
          const rs = routeStyleRef.current, rc = routeColRef.current;
          if (rs === 'vienkep') {
            // VIỀN KÉP: một dải trắng dày bọc ngoài, nét màu chạy giữa — đúng lối chỉ đường của
            // Google Maps. Sạch, đọc được trên mọi nền, hợp video hạ tầng · kết nối.
            m.setPaintProperty('route-glow', 'line-color', '#ffffff'); m.setPaintProperty('route-glow', 'line-width', 15);
            m.setPaintProperty('route-glow', 'line-blur', 0); m.setPaintProperty('route-glow', 'line-opacity', 0.96);
            m.setPaintProperty('route-line', 'line-color', rc); m.setPaintProperty('route-line', 'line-width', 7);
            m.setPaintProperty('route-line', 'line-dasharray', undefined as any); m.setPaintProperty('route-line', 'line-opacity', 1);
          } else if (rs === 'neon') {
            // NEON ĐÊM: quầng sáng rộng, ruột mảnh và rực — hợp cảnh chiều tối, video sang.
            // ĐỘ SÁNG chỉnh được bằng thanh kéo trong bảng Tuyến đường (mặc định 70% ≈ như cũ,
            // kéo hết cỡ 150% thì quầng rộng gấp rưỡi và rực hẳn lên).
            const kn = sangTuyenRef.current ? sangTuyenDoRef.current : 0.7;
            // Kéo thanh = SÁNG hơn: quầng đậm hơn và nhoè hơn, bề rộng gần như giữ nguyên.
            m.setPaintProperty('route-glow', 'line-color', rc); m.setPaintProperty('route-glow', 'line-width', 22);
            m.setPaintProperty('route-glow', 'line-blur', 8 + 3 * kn); m.setPaintProperty('route-glow', 'line-opacity', Math.min(0.97, 0.62 * kn + 0.14 * kn * Math.sin(t * 2.2)));
            m.setPaintProperty('route-line', 'line-color', '#ffffff'); m.setPaintProperty('route-line', 'line-width', 3.4);
            m.setPaintProperty('route-line', 'line-dasharray', undefined as any); m.setPaintProperty('route-line', 'line-opacity', 0.95);
          } else if (rs === 'vach') {
            // NÉT ĐỨT CHẠY: từng vạch trôi dọc tuyến như đường bay trên bản đồ du lịch.
            const b = (t * 6) % 4, pats = [[0, 2, 2], [0.5, 2, 1.5], [1, 2, 1], [1.5, 2, 0.5]];
            m.setPaintProperty('route-glow', 'line-color', rc); m.setPaintProperty('route-glow', 'line-width', 14);
            m.setPaintProperty('route-glow', 'line-blur', 6); m.setPaintProperty('route-glow', 'line-opacity', 0.3);
            m.setPaintProperty('route-line', 'line-color', '#ffffff'); m.setPaintProperty('route-line', 'line-width', 5);
            m.setPaintProperty('route-line', 'line-dasharray', pats[Math.floor(b)]); m.setPaintProperty('route-line', 'line-opacity', 1);
          } else if (rs === 'chamtron') {
            // CHUỖI CHẤM TRÒN: kiểu lối đi bộ / lộ trình tham quan — nhẹ nhàng, không nặng nề.
            const b = (t * 4) % 2, pats = [[0, 2], [1, 2]];
            m.setPaintProperty('route-glow', 'line-opacity', 0);
            m.setPaintProperty('route-line', 'line-color', rc); m.setPaintProperty('route-line', 'line-width', 6);
            m.setPaintProperty('route-line', 'line-dasharray', pats[Math.floor(b)]); m.setPaintProperty('route-line', 'line-opacity', 1);
          } else {
            // NÉT ĐẬM (mặc định như trước): nét màu dày + quầng sáng vàng nhẹ.
            m.setPaintProperty('route-glow', 'line-color', '#ffd36b'); m.setPaintProperty('route-glow', 'line-width', 12);
            m.setPaintProperty('route-glow', 'line-blur', 4); m.setPaintProperty('route-glow', 'line-opacity', 0.45);
            m.setPaintProperty('route-line', 'line-color', rc); m.setPaintProperty('route-line', 'line-width', 6);
            m.setPaintProperty('route-line', 'line-dasharray', undefined as any); m.setPaintProperty('route-line', 'line-opacity', 1);
          }
        } catch { /* ignore */ }
          // GHIM: chuyển động theo kiểu người dùng chọn (nhún · nhịp tim · sóng · rơi · toả sáng · lắc · nhấp nháy).
          // Mỗi con ghim tính riêng theo hiệu ứng CỦA NÓ rồi đẩy một lượt xuống bản đồ.
          // Chỉ làm ~30 lần/giây cho nhẹ máy (mắt không phân biệt được với 60).
          if (markerFeats.current.length && t - lastPinT > 0.033) {
            lastPinT = t;
            const sz = Math.max(0.05, pinSzRef.current || 0.5);       // icon-offset tính theo cỡ ghim
            const zNow = m.getZoom();
            for (const f of markerFeats.current) {
              const pr = f.properties;
              // Chưa phóng đủ mức đã đặt cho ghim này → ẩn hẳn (ghim, quầng, vòng, nhãn chữ).
              if ((pr.minz || 0) > 0 && zNow < pr.minz) {
                pr.op = 0; pr.gr = 0; pr.go = 0; pr.sr = 0; pr.so = 0; pr.r1 = 0; pr.o1 = 0; pr.r2 = 0; pr.o2 = 0;
                pr.p1o = 0; pr.p1s = 0; pr.p2o = 0; pr.p2s = 0; pr.swo = 0; pr.aro = 0;
                pr.d1o = 0; pr.d1s = 0; pr.d2o = 0; pr.d2s = 0; pr.d3o = 0; pr.d3s = 0;
                continue;
              }
              if (pr.kind === 'pin') {
                const pa = pr.anim || 'nhun';
                let tx = 0, ty = 0, op = 1, gr = 13, go = 0.1, wave = 0;
                if (pa === 'nhun') { ty = -Math.abs(Math.sin(t * 1.9)) * 6; gr = 15; go = 0.15; }
                else if (pa === 'nhiptim') {
                  const b = (t * 1.05) % 1;
                  const k = b < 0.13 ? Math.sin((b / 0.13) * Math.PI) : b < 0.3 ? 0.62 * Math.sin(((b - 0.13) / 0.17) * Math.PI) : 0;
                  ty = -k * 12; gr = 13 + k * 24; go = 0.1 + k * 0.3; wave = 0.85;
                } else if (pa === 'songlan') { ty = -Math.abs(Math.sin(t * 1.1)) * 2.5; gr = 13; go = 0.12; wave = 1; }
                else if (pa === 'roixuong') {
                  const b = (t / 3.4) % 1;
                  if (b < 0.28) { const k = b / 0.28; ty = -96 * (1 - k * k); op = Math.min(1, k * 3); }
                  else { const e = Math.min(1, (b - 0.28) / 0.18); ty = -Math.abs(Math.sin(e * Math.PI * 2)) * 15 * (1 - e); }
                  gr = 14; go = 0.14;
                } else if (pa === 'toasang') { const k = (Math.sin(t * 2.3) + 1) / 2; ty = -k * 3.5; gr = 13 + k * 27; go = 0.12 + k * 0.3; }
                else if (pa === 'lacnhe') { tx = Math.sin(t * 2.1) * 5.5; ty = -Math.abs(Math.cos(t * 2.1)) * 3.5; gr = 14; go = 0.14; }
                else if (pa === 'nhapnhay') { const k = (Math.sin(t * 3.6) + 1) / 2; op = 0.4 + 0.6 * k; gr = 15; go = 0.08 + k * 0.26; }
                else { gr = 12; go = 0.08; }                                   // đứng yên
                const lift = Math.min(1, -ty / 40), bw = 1 + Math.max(0, -ty) / 90;
                pr.off = [+(tx / sz).toFixed(2), +(ty / sz).toFixed(2)]; pr.op = +op.toFixed(3);
                pr.gr = +gr.toFixed(2); pr.go = +go.toFixed(3);
                pr.sr = +(7 - lift * 2).toFixed(2); pr.so = +(0.3 * (1 - lift * 0.55)).toFixed(3);
                pr.r1 = +(13 * bw).toFixed(2); pr.o1 = +(0.85 - (bw - 1) * 0.5).toFixed(3);
                pr.r2 = +(23 * bw).toFixed(2); pr.o2 = +(0.4 - (bw - 1) * 0.25).toFixed(3);
                for (const i of [1, 2]) {
                  if (!wave) { pr['p' + i + 'o'] = 0; pr['p' + i + 's'] = 0; continue; }
                  const ph = ((t * 0.8) + (i - 1) / 2) % 1;
                  pr['p' + i + 'r'] = +(7 + ph * 34).toFixed(2);
                  pr['p' + i + 'o'] = +(0.15 * (1 - ph) * wave).toFixed(3);
                  pr['p' + i + 's'] = +(0.62 * (1 - ph) * wave).toFixed(3);
                }
              } else {                                                          // RADAR — 4 kiểu, cũng riêng từng điểm
                const rk = pr.rfx || 'songlan';
                const quet = rk === 'quetnan', cung = rk === 'cungxoay';
                pr.swo = quet ? 1 : 0; pr.aro = cung ? 1 : 0;
                pr.rot = quet ? Math.round((t * 84) % 360) : cung ? Math.round((t * 150) % 360) : 0;
                for (const i of [1, 2, 3]) {
                  if (rk === 'quangtho') {
                    const k = (Math.sin(t * 2.1 - i * 0.7) + 1) / 2;
                    pr['d' + i + 'r'] = 15 + i * 13;
                    pr['d' + i + 'o'] = +((i === 1 ? 0.16 : 0) * (0.35 + 0.65 * k)).toFixed(3);
                    pr['d' + i + 's'] = +((0.6 - i * 0.12) * (0.3 + 0.7 * k)).toFixed(3);
                  } else if (quet || cung) {
                    pr['d' + i + 'r'] = 16 + i * 14; pr['d' + i + 'o'] = i === 1 ? 0.09 : 0; pr['d' + i + 's'] = 0.34;
                  } else {
                    const ph = ((t * 0.55) + (i - 1) / 3) % 1;
                    pr['d' + i + 'r'] = +(10 + ph * 52).toFixed(2);
                    pr['d' + i + 'o'] = +(0.22 * (1 - ph)).toFixed(3);
                    pr['d' + i + 's'] = +(0.75 * (1 - ph)).toFixed(3);
                  }
                }
              }
            }
            try { m.getSource('markers')?.setData(fc(markerFeats.current)); } catch { /* ignore */ }
          }
        // THẺ CHÚ THÍCH: sóng lan toả tại điểm neo (kiểu "Sóng lan")
        try {
          [1, 2].forEach((i) => {
            if (!m.getLayer('callout-wave' + i)) return;
            const ph = ((t * 0.7) + (i - 1) / 2) % 1;
            m.setPaintProperty('callout-wave' + i, 'circle-radius', 8 + ph * 42);
            m.setPaintProperty('callout-wave' + i, 'circle-opacity', 0.18 * (1 - ph));
            m.setPaintProperty('callout-wave' + i, 'circle-stroke-opacity', 0.7 * (1 - ph));
          });
        } catch { /* ignore */ }
        // MŨI TÊN GẠCH ĐỨT: vạch bò dần về phía mũi cho có cảm giác "đang chỉ tới đó".
        // Làm bằng cách đổi qua lại 4 kiểu gạch (maplibre không cho dời pha nét đứt trực tiếp).
        try {
          if (m.getLayer('arrow-dash')) {
            const pats = [[1.6, 1.5], [1.2, 1.5, 0.4, 1.5], [0.8, 1.5, 0.8, 1.5], [0.4, 1.5, 1.2, 1.5]];
            m.setPaintProperty('arrow-dash', 'line-dasharray', mtChayRef.current ? pats[Math.floor((t * 7) % 4)] : pats[0]);
          }
        } catch { /* ignore */ }
        // CHỮ/ẢNH ĐÃ GHIM XUỐNG ĐẤT: bám theo mảnh đất khi bản đồ xoay/bay (không vẽ lại cả trang cho nhẹ).
        try {
          const st = stageRef.current;
          if (st) {
            const cw = st.clientWidth || 1, chh = st.clientHeight || 1;
            objectsRef.current.forEach((o) => {
              const el = objElRef.current[o.id]; if (!el) return;
              let g = o.geo as [number, number] | undefined; let deg: number | null = null;
              // Đường đi RIÊNG của phương tiện này (nếu đã vẽ) — không thì đi theo tuyến đường chung.
              const duongDi = (o.duong && o.duong.length > 1) ? o.duong : route.current;
              // ĐỨNG YÊN MỘT CHỖ: vẫn bám tuyến nhưng neo tại đúng phần trăm người dùng chọn,
              // dùng khi muốn cắm một chiếc xe làm cảnh chứ không cho nó chạy.
              if (!o.runRoute && typeof o.viTri === 'number' && duongDi.length > 1) {
                const rp0 = linePosDir(duongDi, Math.max(0, Math.min(1, o.viTri)));
                if (rp0) { g = rp0.at; if (o.faceDir) deg = rp0.deg; }
                datGocXe(o.faceDir ? 'tren' : '34');
              }
              if (o.runRoute && duongDi.length > 1) {
                // TỐC ĐỘ: 1 = đi vừa hết đường đúng lúc lớp kết thúc. Lớn hơn 1 thì tới sớm rồi ĐỨNG LẠI ở cuối
                // đường (không chạy vòng), nhỏ hơn 1 thì đi chậm, hết lớp vẫn chưa tới đích — giống app tham chiếu.
                const toc = Math.max(0.1, o.toc ?? 1);
                const pr = Math.max(0, Math.min(1, ((playRef.current - o.s) / Math.max(0.001, o.e - o.s)) * toc));
                const rp = linePosDir(duongDi, pr); if (rp) { g = rp.at; if (o.faceDir) deg = rp.deg; } datGocXe(o.faceDir ? 'tren' : '34');   // quay đầu → ảnh nhìn từ trên; không thì ảnh chéo 3/4
              }
              if (g) { const pt = m.project(g as any); el.style.left = ((pt.x / cw) * 100) + '%'; el.style.top = ((pt.y / chh) * 100) + '%'; }
              else { el.style.left = (o.x * 100) + '%'; el.style.top = (o.y * 100) + '%'; }   // không ghim đất thì trả về đúng chỗ đã đặt
              el.style.transform = `translate(-50%,-50%) rotate(${deg !== null ? deg : (o.rot || 0)}deg)`;
            });
          }
        } catch { /* ignore */ }
        // ĐỐM SÁNG chạy quanh viền lô — 1 vòng mất 3 giây.
        if (sparkRef.current) {
          const p = ringPos(parcel.current, (t / 3) % 1);
          try { m.getSource('spark')?.setData(fc(p ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: {} }] : [])); } catch { /* ignore */ }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    // Vòng hiệu ứng này chạy nhờ trình duyệt gọi lại mỗi nhịp màn hình — mà tab ẩn thì trình duyệt
    // gần như không gọi nữa. Nên giữ luôn một đường dẫn tới nó: lúc dựng video, mỗi khung tự gọi
    // một cái, hiệu ứng vẫn sống dù anh đang làm việc ở tab khác.
    hieuUngRef.current = () => { try { tick(); } catch { /* ignore */ } };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); hieuUngRef.current = null; };
  }, [ready]);

  // Kích thước video theo KHỔ + độ phân giải.
  function dims() {
    const r = renderRef.current; const base = r.res === '720' ? 720 : 1080;
    if (r.orient === '9:16') return { W: base, H: Math.round((base * 16) / 9) };   // TikTok · Reels · Shorts
    if (r.orient === '1:1') return { W: base, H: base };                            // vuông
    if (r.orient === '4:5') return { W: base, H: Math.round((base * 5) / 4) };      // Instagram dọc
    return { W: Math.round((base * 16) / 9), H: base };                             // ngang
  }
  // Xem trước biểu đồ (vẽ ở progress đầy) mỗi khi đổi dữ liệu/kiểu.
  useEffect(() => {
    const c = chartPrevRef.current; if (!c) return; const cx = c.getContext('2d'); if (!cx) return;
    cx.clearRect(0, 0, c.width, c.height);
    if (chartOn) drawChart(cx, 0, 0, c.width, c.height, parseChart(chartRaw), 1, chartTitle, chartType, chartSeries.split(',').map((x) => x.trim()));
  }, [chartOn, chartRaw, chartTitle, chartType, chartSeries]);

  useEffect(() => { modeRef.current = mode; drawVerts(); }, [mode]);
  // Vào/ra chế độ chạy → cập nhật cờ rồi vẽ lại tuyến, để đoạn nối từ thửa đất xuất hiện đúng lúc chạy.
  useEffect(() => {
    dangChayRef.current = previewing || rec;
    if (ready) { try { drawRoute(tuyenVe()); } catch { /* ignore */ } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewing, rec, ready]);
  // Đường đi riêng chỉ hiện khi ĐANG CHỌN một phương tiện và KHÔNG chạy thử / KHÔNG quay.
  // Nhờ vậy nét đứt hướng dẫn không bao giờ lọt vào video xuất ra.
  useEffect(() => {
    if (!ready) return;
    const o = objects.find((z) => z.id === selObj);
    const hien = !!o && o.type === 'xe' && !previewing && !rec && !busyAll;
    drawXePath(hien ? ((o!.duong || []) as [number, number][]) : []);
  }, [selObj, objects, previewing, rec, busyAll, ready]);   // con trỏ chuột do effect riêng phía dưới lo

  useEffect(() => {
    if (!boxRef.current || mapRef.current) return;
    dangKyTaiAnhCoThuLai();   // ảnh lỗi thì tự thử lại, tải xong cất kho → dựng lần sau nhanh hẳn
    // Dựng video 1080p lâu, card đồ hoạ có thể "rớt" giữa chừng (máy nóng, driver cập nhật, máy ngủ).
    // Không bắt thì trang đứng im không rõ lý do. Bắt được thì dừng gọn và nói rõ nên hạ gì.
    const map = new maplibregl.Map({
      container: boxRef.current,
      style: {
        // PHÔNG CHỮ CỦA BẢN ĐỒ nằm ngay trong web mình (apps/frontend/public/fonts).
        // Trước đây lấy từ fonts.openmaptiles.org — máy chủ đó trả về file hỏng nên MỌI chữ và
        // ghim trên bản đồ đều không vẽ ra được. Tự chứa thì không bao giờ hỏng vì máy người khác.
        version: 8, glyphs: '/fonts/{fontstack}/{range}.pbf',
        sources: {
          // LỚP LÓT chống trắng: CÙNG ảnh nền nhưng chỉ tải tới mức phóng 12 — cả vùng chỉ vài chục
          // ô ảnh nên tải một nhoáng là xong và nằm luôn trong máy. Chỗ nào ảnh nét chưa về kịp
          // (mép khung hình, vùng xa, và nhất là lúc kết video camera vụt về toàn cảnh) thì hiện
          // ảnh HƠI MỜ thay vì MẢNG TRẮNG. Đây là cách Google Earth vẫn làm.
          // Lót tầng 2 (mức 15): khi bay sát mặt đất (mức 17–18) mà ảnh nét chưa về, ảnh mức 15 chỉ bị
          // kéo giãn 4 lần nên mắt gần như không nhận ra — khác hẳn ảnh mức 12 bị giãn 32 lần (mờ tịt,
          // lộ rõ từng ô vuông). Số ô mức 15 chỉ bằng 1/16 mức 18 nên tải rất nhanh.
          lot2sat: { type: 'raster', tiles: SAT, tileSize: 256, maxzoom: 15 },
          lot2street: { type: 'raster', tiles: STREET, tileSize: 256, maxzoom: 15 },
          lot2dark: { type: 'raster', tiles: DARK, tileSize: 256, maxzoom: 15 },
          lot2sat2: { type: 'raster', tiles: SAT_OPEN, tileSize: 256, maxzoom: 13 },
          lotsat: { type: 'raster', tiles: SAT, tileSize: 256, maxzoom: 12 },
          lotsat2: { type: 'raster', tiles: SAT_OPEN, tileSize: 256, maxzoom: 10 },
          lotstreet: { type: 'raster', tiles: STREET, tileSize: 256, maxzoom: 12 },
          lotdark: { type: 'raster', tiles: DARK, tileSize: 256, maxzoom: 12 },
          sat: { type: 'raster', tiles: SAT, tileSize: 256, maxzoom: 18, attribution: '© Esri' },
          sat2: { type: 'raster', tiles: SAT_OPEN, tileSize: 256, maxzoom: 15, attribution: '© Sentinel-2 cloudless (EOX)' },
          // maxzoom 14: nguồn ảnh độ cao có dữ liệu tới mức 15. Trước đây chặn ở 13 nên khi camera hạ
          // xuống thấp, mỗi ô độ cao phải kéo giãn ra gấp 4–8 lần → lưới mặt đất thô, ẢNH BỊ BÓP MÉO,
          // đường thẳng và bờ biển uốn cong hẳn. Lấy tới 14 là lưới mịn gấp đôi, méo giảm rõ.
          dem: { type: 'raster-dem', tiles: DEM_TILES, tileSize: 256, maxzoom: 13, encoding: 'terrarium' } as any,
          // (Trước có thêm nguồn RIÊNG cho lớp đổ bóng theo khuyến nghị của MapLibre. Nhưng đo thật thì
          // nó làm máy TẢI VÀ GIẢI MÃ ảnh độ cao gấp đôi → render chậm hẳn. Dùng chung một nguồn,
          // ảnh xấu đi không đáng kể mà nhanh hơn nhiều.)
          street: { type: 'raster', tiles: STREET, tileSize: 256, maxzoom: 18 },
          dark: { type: 'raster', tiles: DARK, tileSize: 256, maxzoom: 16 },
          lab: { type: 'raster', tiles: LABELS, tileSize: 256, maxzoom: 18 },
        },
        layers: [
          // Nền màu: chỗ nào chưa có gì thì ra màu đất sẫm, không phải màu trắng chói.
          { id: 'nen-mau', type: 'background', paint: { 'background-color': '#2b3a2f' } },
          { id: 'lotsat', type: 'raster', source: 'lotsat', paint: { 'raster-fade-duration': 0 } },
          { id: 'lotsat2', type: 'raster', source: 'lotsat2', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 0 } },
          { id: 'lotstreet', type: 'raster', source: 'lotstreet', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 0 } },
          { id: 'lotdark', type: 'raster', source: 'lotdark', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 0 } },
          // 'raster-fade-duration': 0 — ảnh nét vừa tải xong là HIỆN NGAY.
          // Mặc định của thư viện là mờ dần 0,3 giây: ảnh nét chồng từ từ lên ảnh mờ, nên lúc kéo ra
          // toàn cảnh mắt còn thấy nhoè thêm 1/3 giây nữa dù ảnh đã về tới nơi. Có lớp lót đỡ bên
          // dưới rồi nên tắt hiệu ứng mờ dần này đi là an toàn.
          { id: 'lot2sat', type: 'raster', source: 'lot2sat', paint: { 'raster-fade-duration': 0 } },
          { id: 'lot2sat2', type: 'raster', source: 'lot2sat2', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 0 } },
          { id: 'lot2street', type: 'raster', source: 'lot2street', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 0 } },
          { id: 'lot2dark', type: 'raster', source: 'lot2dark', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 0 } },
          { id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-fade-duration': 0 } },
          { id: 'sat2', type: 'raster', source: 'sat2', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 0 } },
          { id: 'street', type: 'raster', source: 'street', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 0 } },
          { id: 'dark', type: 'raster', source: 'dark', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 0 } },
          { id: 'hillshade', type: 'hillshade', source: 'dem', layout: { visibility: 'none' }, paint: { 'hillshade-exaggeration': 0.45, 'hillshade-shadow-color': '#102030', 'hillshade-highlight-color': '#ffffff', 'hillshade-accent-color': '#2b3d4f' } } as any,
          { id: 'lab', type: 'raster', source: 'lab', layout: { visibility: 'visible' }, paint: { 'raster-fade-duration': 0 } },
        ],
      } as any,
      // maxPitch 85 = mức tối đa thư viện bản đồ cho phép. Trước đây tự chặn ở 70 nên kịch bản
      // "sát mặt đường" có muốn thấp hơn cũng không được. 85° là góc gần như nhìn ngang, thấy rõ
      // hai bên đường và cả đường chân trời — đúng cảm giác ngồi trong xe.
      // maxZoom 18: ĐỪNG nâng lên nữa. Ảnh vệ tinh chỉ nét tới mức 18; phóng quá chỉ là kéo giãn
      // đúng tấm ảnh đó ra cho to, kết quả là nhoè bệt — đã thử 20 và phải trả về.
      center: MAP.center, zoom: 15, maxZoom: 18, maxPitch: 85,
      preserveDrawingBuffer: true, // BẮT BUỘC để quay được canvas
      // Giữ nhiều ô ảnh trong bộ nhớ hơn mặc định: chạy thử / quay lại lần 2, lần 3 thì ảnh
      // đã nằm sẵn trong máy, không phải tải lại từ mạng nữa.
      // Bay tuyến dài + nghiêng sâu là ngốn ảnh khủng khiếp. Để đệm nhỏ thì ảnh vừa tải xong đã bị
      // đẩy ra nhường chỗ, lát sau quay lại đúng chỗ đó là TRẮNG lần nữa. Máy nhiều RAM thì giữ thật nhiều.
      // MỖI NGUỒN ẢNH giữ riêng bấy nhiêu ô, mà bản đồ này có tới 3 nguồn (nét · lót 15 · lót 12)
      // → đặt 2200 là ngốn hàng nghìn tấm ảnh trong bộ nhớ hình, máy nghẹt và sinh giật.
      // 700 là đủ rộng để bay tuyến dài mà không phải tải lại.
      // Giữ bao nhiêu ảnh là do SỨC MÁY quyết định (xem soOAnhNenGiu): máy khoẻ giữ tới vài nghìn tấm,
      // máy yếu mới rút bớt. Không ép mức thấp cho máy mạnh nữa.
      maxTileCacheSize: Math.max(512, soOAnhNenGiu(1)),   // giữ nhiều ảnh hơn: dựng video hay quay lại chỗ cũ
      fadeDuration: 0, // tile hiện NGAY khi tải xong (không mờ dần) → đỡ khoảng trắng khi bay
      refreshExpiredTiles: false,
      attributionControl: false,
    });
    mapRef.current = map;
    // Card đồ hoạ rớt giữa chừng (máy nóng, driver cập nhật, máy ngủ) — không bắt thì trang đứng im
    // không rõ lý do, người dùng ngồi chờ vô ích. Bắt được thì dừng gọn và nói rõ nên hạ cái gì.
    try {
      map.getCanvas().addEventListener('webglcontextlost', (e: any) => {
        try { e.preventDefault(); } catch { /* ignore */ }
        stopRef.current = true;
        toast.error('Card đồ hoạ vừa mất kết nối — đã dừng dựng, phần đã quay vẫn giữ lại. Thử lại với 720p hoặc để 2D cho nhẹ.');
      });
      map.getCanvas().addEventListener('webglcontextrestored', () => toast.info('Card đồ hoạ đã hoạt động lại — dựng lại từ đầu được rồi.'));
    } catch { /* ignore */ }
    // Thư viện bản đồ cũng có sẵn Shift + mũi tên để xoay/nghiêng, nhưng nó chạy giật từng nấc và
    // chỉ ăn khi con trỏ đang ở trong bản đồ. Tắt đi, để bộ điều khiển mượt tự viết ở trên lo hết.
    try { map.keyboard.disableRotation(); } catch { /* bản cũ không có thì thôi */ }
    map.on('load', () => {
      // VÙNG HÀNH CHÍNH (xã/phường/tỉnh lấy từ OpenStreetMap) — vẽ DƯỚI lô đất nên thêm trước.
      map.addSource('zone', { type: 'geojson', data: fc([]) });
      map.addLayer({ id: 'zone-fill', type: 'fill', source: 'zone', paint: { 'fill-color': '#38bdf8', 'fill-opacity': 0.18 } });
      map.addLayer({ id: 'zone-glow', type: 'line', source: 'zone', paint: { 'line-color': '#7dd3fc', 'line-width': 14, 'line-opacity': 0.25, 'line-blur': 8 } });
      map.addLayer({ id: 'zone-line', type: 'line', source: 'zone', paint: { 'line-color': '#38bdf8', 'line-width': 3 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      map.addLayer({ id: 'zone-label', type: 'symbol', source: 'zone', layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 20, 'symbol-placement': 'point' }, paint: { 'text-color': '#e0f2fe', 'text-halo-color': '#0A2540', 'text-halo-width': 3 } });
      map.addSource('parcel', { type: 'geojson', data: fc([]) });
      // Quầng sáng PHỤ của lô — nằm dưới cùng, rộng và nhoè; tắt sẵn, bật bằng ô tick trong bảng Lô đất.
      map.addLayer({ id: 'parcel-glow2', type: 'line', source: 'parcel', paint: { 'line-color': GOLD, 'line-width': 0, 'line-opacity': 0, 'line-blur': 10 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      map.addLayer({ id: 'parcel-fill', type: 'fill', source: 'parcel', paint: { 'fill-color': GOLD, 'fill-opacity': 0.28 } });
      map.addLayer({ id: 'parcel-glow', type: 'line', source: 'parcel', paint: { 'line-color': GOLD, 'line-width': 16, 'line-opacity': 0, 'line-blur': 6 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      map.addLayer({ id: 'parcel-line', type: 'line', source: 'parcel', paint: { 'line-color': GOLD, 'line-width': 3 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      // Đường đi riêng của phương tiện — nét đứt trắng mờ, CHỈ để ngắm lúc dựng.
      // Trước khi quay sẽ xoá sạch dữ liệu lớp này nên nó không bao giờ lọt vào video.
      map.addSource('xepath', { type: 'geojson', data: fc([]) });
      map.addLayer({ id: 'xepath-line', type: 'line', source: 'xepath', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': '#ffffff', 'line-width': 2.5, 'line-opacity': 0.85, 'line-dasharray': [2, 2] }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      map.addLayer({ id: 'xepath-dot', type: 'circle', source: 'xepath', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 5, 'circle-color': '#38bdf8', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });
      // lineMetrics: bản đồ tự đo độ dài dọc đường → mới tô màu dần theo tiến độ được (xem datTienDoTuyen)
      map.addSource('route', { type: 'geojson', data: fc([]), lineMetrics: true } as any);
      // Quầng sáng PHỤ của tuyến — cùng lối làm với lô đất: lớp riêng, tắt sẵn, bật bằng ô tick.
      map.addLayer({ id: 'route-glow2', type: 'line', source: 'route', paint: { 'line-color': '#ff5a2c', 'line-width': 0, 'line-opacity': 0, 'line-blur': 12 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      map.addLayer({ id: 'route-glow', type: 'line', source: 'route', paint: { 'line-color': '#ffd36b', 'line-width': 12, 'line-opacity': 0.45, 'line-blur': 4 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      map.addSource('routehead', { type: 'geojson', data: fc([]) });
      map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#ff5a2c', 'line-width': 6 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      // Chấm sáng chạy ở đầu tuyến (như đầu mũi tên đang tiến tới)
      map.addLayer({ id: 'route-name', type: 'symbol', source: 'route', layout: { 'symbol-placement': 'line', 'symbol-spacing': 480, 'text-field': ['get', 'ten'], 'text-font': ['Noto Sans Bold'], 'text-size': 22, 'text-letter-spacing': 0.1, 'text-transform': 'uppercase', 'text-keep-upright': true, 'text-allow-overlap': false }, paint: { 'text-color': '#ffffff', 'text-halo-color': '#0A2540', 'text-halo-width': 2.8 } });
      // CHẤM SÁNG ĐẦU TUYẾN đọc CHUNG nguồn 'route' với nét tuyến. Trước để nguồn riêng ('routehead'),
      // maplibre xử lý mỗi nguồn một đường riêng nên hai bên cập nhật lệch nhau vài khung hình —
      // mắt thấy thành HAI CHẤM cách nhau. Chung một nguồn thì một lần gửi là cả hai cùng nhảy.
      map.addLayer({ id: 'routehead-halo', type: 'circle', source: 'route', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 16, 'circle-color': '#ffd36b', 'circle-opacity': 0.4, 'circle-blur': 0.6 } });
      map.addLayer({ id: 'routehead-dot', type: 'circle', source: 'route', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 6.5, 'circle-color': '#ffffff', 'circle-stroke-color': '#ff5a2c', 'circle-stroke-width': 3 } });
      // Điểm nhấn (POI) — lớp GL (vẽ TRÊN canvas) nên hiện cả khi xem lẫn khi quay video.
      map.addSource('markers', { type: 'geojson', data: fc([]) });
      // Bóng đổ dưới chân ghim — co lại khi ghim nhấc lên, giúp ghim trông có chiều sâu.
      map.addLayer({ id: 'pin-shadow', type: 'circle', source: 'markers', filter: ['==', ['get', 'kind'], 'pin'], paint: { 'circle-radius': ['get', 'sr'], 'circle-color': '#000000', 'circle-opacity': ['get', 'so'], 'circle-blur': 0.8 } });
      // Hai vòng sáng nằm dưới chân ghim phát sáng (cái đế) — nhìn như ghim đang cắm xuống đất.
      map.addLayer({ id: 'pin-ring2', type: 'circle', source: 'markers', filter: ['==', ['get', 'ring'], 1], paint: { 'circle-radius': ['get', 'r2'], 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 2, 'circle-stroke-opacity': ['get', 'o2'], 'circle-blur': 0.15 } });
      map.addLayer({ id: 'pin-ring1', type: 'circle', source: 'markers', filter: ['==', ['get', 'ring'], 1], paint: { 'circle-radius': ['get', 'r1'], 'circle-color': ['get', 'color'], 'circle-opacity': 0.18, 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 2.6, 'circle-stroke-opacity': ['get', 'o1'], 'circle-blur': 0.1 } });
      // Hai vòng sóng lan từ chân ghim.
      [1, 2].forEach((i) => map.addLayer({ id: 'pin-pulse' + i, type: 'circle', source: 'markers', filter: ['==', ['get', 'kind'], 'pin'], paint: { 'circle-radius': ['get', 'p' + i + 'r'], 'circle-color': ['get', 'color'], 'circle-opacity': ['get', 'p' + i + 'o'], 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 2, 'circle-stroke-opacity': ['get', 'p' + i + 's'] } } as any));
      // Quầng sáng mềm ôm lấy ghim.
      map.addLayer({ id: 'pin-glow', type: 'circle', source: 'markers', filter: ['==', ['get', 'kind'], 'pin'], paint: { 'circle-radius': ['get', 'gr'], 'circle-color': ['get', 'color'], 'circle-opacity': ['get', 'go'], 'circle-blur': 1, 'circle-translate': [0, -14] } });
      // RADAR: 3 vòng lan toả (bán kính/độ mờ chạy theo thời gian trong vòng lặp hiệu ứng).
      [1, 2, 3].forEach((i) => map.addLayer({ id: 'marker-radar' + i, type: 'circle', source: 'markers', filter: ['==', ['get', 'shape'], 'radar'], paint: { 'circle-radius': ['get', 'd' + i + 'r'], 'circle-color': ['get', 'color'], 'circle-opacity': ['get', 'd' + i + 'o'], 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 2, 'circle-stroke-opacity': ['get', 'd' + i + 's'] } } as any));
      // RADAR QUÉT NAN / CUNG XOAY: ảnh tự vẽ, quay tròn theo thời gian (ẩn sẵn, bật theo kiểu radar đang chọn).
      map.addLayer({ id: 'marker-sweep', type: 'symbol', source: 'markers', filter: ['==', ['get', 'shape'], 'radar'], layout: { 'icon-image': ['get', 'sweep'], 'icon-size': 0.5, 'icon-allow-overlap': true, 'icon-rotation-alignment': 'map', 'icon-rotate': ['get', 'rot'] } as any, paint: { 'icon-opacity': ['get', 'swo'] } as any });
      map.addLayer({ id: 'marker-arc', type: 'symbol', source: 'markers', filter: ['==', ['get', 'shape'], 'radar'], layout: { 'icon-image': ['get', 'arc'], 'icon-size': 0.5, 'icon-allow-overlap': true, 'icon-rotation-alignment': 'map', 'icon-rotate': ['get', 'rot'] } as any, paint: { 'icon-opacity': ['get', 'aro'] } as any });
      map.addLayer({ id: 'marker-halo', type: 'circle', source: 'markers', filter: ['==', ['get', 'shape'], 'radar'], paint: { 'circle-radius': 14, 'circle-color': '#ffd36b', 'circle-opacity': 0.35 } });
      map.addLayer({ id: 'marker-dot', type: 'circle', source: 'markers', filter: ['==', ['get', 'shape'], 'radar'], paint: { 'circle-radius': 6, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });
      // GHIM GIỌT NƯỚC: ảnh tự vẽ, cắm đúng điểm (đáy ghim chạm toạ độ).
      map.addLayer({ id: 'marker-pin', type: 'symbol', source: 'markers', filter: ['==', ['get', 'kind'], 'pin'], layout: { 'icon-image': ['get', 'img'], 'icon-size': 0.5, 'icon-anchor': ['case', ['in', ['get', 'shape'], ['literal', ['dot', 'badge', 'hex', 'ring']]], 'center', 'bottom'], 'icon-allow-overlap': true, 'icon-offset': ['array', 'number', 2, ['get', 'off']] } as any, paint: { 'icon-opacity': ['get', 'op'] } as any });
      map.addLayer({ id: 'marker-label', type: 'symbol', source: 'markers', layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Regular'], 'text-size': 16, 'text-offset': ['case', ['==', ['get', 'kind'], 'pin'], ['literal', [0, -3.6]], ['literal', [0, -1.4]]], 'text-anchor': 'bottom', 'text-allow-overlap': true }, paint: { 'text-color': '#ffffff', 'text-halo-color': '#0A2540', 'text-halo-width': 2.5, 'text-opacity': ['get', 'op'] } });
      // Bán kính (vòng tròn km) — polygon + viền + nhãn giữa.
      map.addSource('radius', { type: 'geojson', data: fc([]) });
      map.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius', paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.12 } });
      map.addLayer({ id: 'radius-line', type: 'line', source: 'radius', paint: { 'line-color': '#3b82f6', 'line-width': 2.5, 'line-dasharray': [2, 1.5] } });
      map.addLayer({ id: 'radius-label', type: 'symbol', source: 'radius', layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 15, 'text-allow-overlap': true }, paint: { 'text-color': '#dbeafe', 'text-halo-color': '#0A2540', 'text-halo-width': 2.5 } });
      // Khoảng cách (A→B) — đường + nhãn giữa đoạn.
      map.addSource('dist', { type: 'geojson', data: fc([]) });
      map.addLayer({ id: 'dist-line', type: 'line', source: 'dist', paint: { 'line-color': '#facc15', 'line-width': 3, 'line-dasharray': [1.5, 1] }, layout: { 'line-cap': 'round' } });
      map.addLayer({ id: 'dist-label', type: 'symbol', source: 'dist', layout: { 'symbol-placement': 'line-center', 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 15, 'text-allow-overlap': true }, paint: { 'text-color': '#111827', 'text-halo-color': '#facc15', 'text-halo-width': 3 } });
      // LÔ ĐẤT 3D — dựng ranh lô thành khối nổi lên khỏi mặt đất (chỉ hiện khi bật "3D nổi khối").
      map.addLayer({ id: 'parcel-3d', type: 'fill-extrusion', source: 'parcel', layout: { visibility: 'none' }, paint: { 'fill-extrusion-color': GOLD, 'fill-extrusion-height': 40, 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.55 } });
      // ĐỐM SÁNG chạy vòng quanh viền lô (như MapEffect) — 1 chấm sáng + quầng, chạy theo thời gian.
      map.addSource('spark', { type: 'geojson', data: fc([]) });
      map.addLayer({ id: 'spark-halo', type: 'circle', source: 'spark', layout: { visibility: 'none' }, paint: { 'circle-radius': 18, 'circle-color': '#fff7d6', 'circle-opacity': 0.35, 'circle-blur': 1 } });
      map.addLayer({ id: 'spark-dot', type: 'circle', source: 'spark', layout: { visibility: 'none' }, paint: { 'circle-radius': 6, 'circle-color': '#ffffff' } });
      // THẺ CHÚ THÍCH (call out): dây nối + chấm neo + thẻ chữ. Vẽ trong canvas nên vào cả video.
      map.addSource('callout', { type: 'geojson', data: fc([]) });
      map.addLayer({ id: 'callout-line', type: 'line', source: 'callout', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['!=', ['get', 'dash'], 1]], paint: { 'line-color': ['get', 'col'], 'line-width': ['case', ['==', ['get', 'thin'], 1], 1.3, 2.5], 'line-opacity': ['case', ['==', ['get', 'thin'], 1], 0.85, 0.95] }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      // Dây NÉT ĐỨT phải là lớp riêng: MapLibre không cho đặt nét đứt theo từng đối tượng.
      map.addLayer({ id: 'callout-line-dash', type: 'line', source: 'callout', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'dash'], 1]], paint: { 'line-color': ['get', 'col'], 'line-width': ['case', ['==', ['get', 'thin'], 1], 1.3, 2.5], 'line-opacity': 0.9, 'line-dasharray': [2.4, 2.2] }, layout: { 'line-cap': 'butt', 'line-join': 'round' } });
      map.addLayer({ id: 'callout-dotend', type: 'circle', source: 'callout', filter: ['==', ['get', 'kind'], 'dotend'], paint: { 'circle-radius': 7.5, 'circle-color': ['get', 'col'], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.4, 'circle-opacity': 0.95 } });
      map.addLayer({ id: 'callout-anchor', type: 'circle', source: 'callout', filter: ['all', ['==', ['get', 'kind'], 'anchor'], ['!=', ['get', 'thin'], 1]], paint: { 'circle-radius': 6, 'circle-color': ['get', 'col'], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });
      try { Object.entries(CO_STYLES).forEach(([sk, st]) => { const im = makeStarAnchor(st.col); const id = 'costar-' + sk; if (im && !map.hasImage(id)) map.addImage(id, im as any, { pixelRatio: 2 } as any); }); } catch (e) { console.warn('[sao neo]', e); }
      map.addLayer({ id: 'callout-star', type: 'symbol', source: 'callout', filter: ['all', ['==', ['get', 'kind'], 'anchor'], ['==', ['get', 'thin'], 1]], layout: { 'icon-image': ['get', 'star'], 'icon-size': 0.5, 'icon-allow-overlap': true } });
      // Nền thẻ: ảnh CO GIÃN → khung luôn ôm khít chữ dù chữ dài ngắn, phóng to thu nhỏ.
      try {
        Object.entries(CO_STYLES).forEach(([sk, st]) => ['pill', 'frame', 'bracket', 'underline', 'elbow', 'lux'].forEach((shp) => {
          const im = calloutBoxImage(shp, st.col, st.bg); const id = 'cbox-' + shp + '-' + sk;
          if (im && !map.hasImage(id)) map.addImage(id, im.data as any, { content: im.content, stretchX: im.stretchX, stretchY: im.stretchY, pixelRatio: 2 } as any);
        }));
      } catch (e) { console.warn('[callout box]', e); }
      map.addLayer({ id: 'callout-card', type: 'symbol', source: 'callout', filter: ['==', ['get', 'kind'], 'card'], layout: { 'icon-image': ['get', 'box'], 'icon-text-fit': 'both', 'icon-text-fit-padding': [3, 7, 3, 7], 'icon-allow-overlap': true, 'text-field': ['format',
          ['get', 'label'], { 'font-scale': 1 },
          ['case', ['!=', ['get', 'sub'], ''], ['concat', '\n', ['get', 'sub']], ''], { 'font-scale': 0.78 },
          ['case', ['!=', ['get', 'gia'], ''], ['concat', '\n', ['get', 'gia']], ''], { 'font-scale': 1.06, 'text-color': ['get', 'col'] }
        ], 'text-font': ['Noto Sans Bold'], 'text-size': ['case', ['==', ['get', 'thin'], 1], 14, 16], 'text-line-height': 1.25, 'text-letter-spacing': ['case', ['==', ['get', 'thin'], 1], 0.16, 0], 'text-transform': ['case', ['==', ['get', 'thin'], 1], 'uppercase', 'none'], 'text-allow-overlap': true, 'text-anchor': 'center' }, paint: { 'text-color': ['get', 'fg'], 'text-halo-color': ['get', 'bg'], 'text-halo-width': 1.2 } });
      // Nhãn nhỏ phía trên thẻ (loại tiện ích: KHÁCH SẠN, TRƯỜNG HỌC…) — chi tiết làm thẻ trông cao cấp hẳn.
      map.addLayer({ id: 'callout-cat', type: 'symbol', source: 'callout', filter: ['all', ['==', ['get', 'kind'], 'card'], ['has', 'cat']], layout: { 'text-field': ['get', 'cat'], 'text-font': ['Noto Sans Regular'], 'text-size': 10, 'text-letter-spacing': 0.24, 'text-transform': 'uppercase', 'text-offset': [0, -2.1], 'text-anchor': 'bottom', 'text-allow-overlap': true }, paint: { 'text-color': ['get', 'col'], 'text-halo-color': '#04101c', 'text-halo-width': 2 } });
      // Sóng lan toả tại điểm neo (kiểu 'wave')
      [1, 2].forEach((i) => map.addLayer({ id: 'callout-wave' + i, type: 'circle', source: 'callout', filter: ['all', ['==', ['get', 'kind'], 'anchor'], ['==', ['get', 'shape'], 'wave']], paint: { 'circle-radius': 10, 'circle-color': ['get', 'col'], 'circle-opacity': 0.2, 'circle-stroke-color': ['get', 'col'], 'circle-stroke-width': 2, 'circle-stroke-opacity': 0.6 } }));
      // Đỉnh (vertex) để SỬA — chỉ hiện ở chế độ ✎ Sửa đỉnh.
      // ── SỐ ĐO LÔ ĐẤT: độ dài từng cạnh in dọc cạnh + diện tích in giữa lô ──
      map.addSource('losodo', { type: 'geojson', data: fc([]) });
      map.addLayer({ id: 'lo-canh', type: 'symbol', source: 'losodo', filter: ['==', ['geometry-type'], 'LineString'], layout: { 'symbol-placement': 'line-center', 'text-field': ['get', 'd'], 'text-font': ['Noto Sans Bold'], 'text-size': 16, 'text-allow-overlap': true, 'text-ignore-placement': true, 'text-keep-upright': true }, paint: { 'text-color': '#ffffff', 'text-halo-color': '#0A2540', 'text-halo-width': 2.6 } });
      map.addLayer({ id: 'lo-dt', type: 'symbol', source: 'losodo', filter: ['==', ['geometry-type'], 'Point'], layout: { 'text-field': ['get', 'dt'], 'text-font': ['Noto Sans Bold'], 'text-size': 22, 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': '#ffffff', 'text-halo-color': '#0A2540', 'text-halo-width': 3 } });
      // ── MŨI TÊN CHỈ HƯỚNG: quầng sáng → vạch → đầu nhọn → tên chỗ ──
      map.addSource('arrow', { type: 'geojson', data: fc([]) });
      // ══ BÓNG ĐỔ CHO MŨI TÊN ══
      // Mũi tên vẽ phẳng trên bản đồ nhìn như dán lên ảnh. Đổ một cái bóng lệch xuống dưới-phải,
      // nhoè nhẹ, NEO THEO MÀN HÌNH (không xoay theo bản đồ) — thế là mũi tên như bay lơ lửng bên
      // trên mặt đất. Đây đúng cách app kia làm: lệch 16 sang phải, 22 xuống dưới.
      map.addLayer({ id: 'arrow-shadow', type: 'line', source: 'arrow',
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: { 'line-color': '#000000', 'line-width': 7, 'line-opacity': 0.28, 'line-blur': 6, 'line-translate': [16, 22], 'line-translate-anchor': 'viewport' } as any,
        layout: { 'line-cap': 'round', 'line-join': 'round' } });
      map.addLayer({ id: 'arrow-glow', type: 'line', source: 'arrow', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'sang'], 1]], paint: { 'line-color': ['get', 'col'], 'line-width': 15, 'line-opacity': 0.35, 'line-blur': 7 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      map.addLayer({ id: 'arrow-line', type: 'line', source: 'arrow', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['!=', ['get', 'dash'], 1]], paint: { 'line-color': ['get', 'col'], 'line-width': 5.5, 'line-opacity': 0.98 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      map.addLayer({ id: 'arrow-dash', type: 'line', source: 'arrow', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'dash'], 1]], paint: { 'line-color': ['get', 'col'], 'line-width': 5.5, 'line-opacity': 0.98, 'line-dasharray': [1.6, 1.5] }, layout: { 'line-cap': 'butt', 'line-join': 'round' } });
      map.addLayer({ id: 'arrow-head', type: 'symbol', source: 'arrow', filter: ['==', ['get', 'kind'], 'head'], layout: { 'icon-image': ['get', 'head'], 'icon-size': 0.55, 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-rotation-alignment': 'map', 'icon-rotate': ['get', 'rot'] } as any, paint: {} as any });
      map.addLayer({ id: 'arrow-icon', type: 'symbol', source: 'arrow', filter: ['all', ['==', ['get', 'kind'], 'head'], ['==', ['get', 'co'], 1]], layout: { 'icon-image': ['get', 'ico'], 'icon-size': 0.5, 'icon-offset': [0, 62], 'icon-allow-overlap': true, 'icon-ignore-placement': true } as any, paint: {} as any });
      map.addLayer({ id: 'arrow-label', type: 'symbol', source: 'arrow', filter: ['==', ['get', 'kind'], 'head'], layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 19, 'text-offset': ['case', ['==', ['get', 'co'], 1], ['literal', [0, 3.3]], ['literal', [0, 1.5]]], 'text-anchor': 'top', 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': ['get', 'tcol'], 'text-halo-color': '#0A2540', 'text-halo-width': 2.6 } });
      // ── HOÀNG SA · TRƯỜNG SA: luôn chồng lên trên cùng, mọi video xuất ra đều có ──
      themLopBienDao(map);
      map.addSource('verts', { type: 'geojson', data: fc([]) });
      map.addLayer({ id: 'vert-dots', type: 'circle', source: 'verts', paint: { 'circle-radius': 7, 'circle-color': '#ffffff', 'circle-stroke-color': '#0A2540', 'circle-stroke-width': 3 } });
      // BẦU TRỜI/CHÂN TRỜI (như các web bản đồ pro): lấp vùng chân trời khi nghiêng cao → không còn khoảng trắng. Vẽ trong canvas nên vào cả video.
      try { if (typeof (map as any).setSky === 'function') (map as any).setSky({ 'sky-color': '#8fb4e0', 'sky-horizon-blend': 0.7, 'horizon-color': '#d6e2ee', 'horizon-fog-blend': 0.6, 'fog-color': '#eef4fa', 'fog-ground-blend': 0.1, 'atmosphere-blend': 0.5 }); } catch (e) { console.warn('[sky]', e); }
      setTimeout(() => map.resize(), 200); // đảm bảo bản đồ lấp đầy khung 16:9
      setReady(true);
    });
    const onResize = () => map.resize(); window.addEventListener('resize', onResize);
    (map as any).__onResize = onResize;
    // QUAN TRỌNG: khung dùng aspect-ratio nên chiều cao có thể = 0 lúc khởi tạo → map không vẽ tile (trắng).
    // ResizeObserver bắt đúng lúc khung có kích thước rồi gọi resize() để nạp ảnh vệ tinh.
    try { const ro = new ResizeObserver(() => { map.resize(); if (boxRef.current) setBoxH(boxRef.current.clientHeight); }); ro.observe(boxRef.current!); (map as any).__ro = ro; } catch { /* ignore */ }
    // ══ GHI LỖI BẢN ĐỒ: NÓI RÕ ẢNH NÀO HỎNG, VÀ CHỈ NÓI VÀI LẦN ══
    // Bản trước chỉ in mỗi câu "không tải được ảnh" mà không cho biết ảnh nào — soi cả buổi không ra.
    // Tệ hơn: nó in tới cả NGHÌN lần. Mỗi lần in là một lần trình duyệt phải dựng lại dòng chữ trong
    // bảng điều khiển, đúng lúc đang render thì cướp mất sức máy — chính là một phần lý do video giật.
    // Giờ: in đủ chi tiết để truy (nguồn ảnh nào, địa chỉ nào), nhưng mỗi loại lỗi chỉ in tối đa 5 lần.
    const demLoi = new Map<string, number>();
    map.on('error', (ev: any) => {
      const mo = String(ev?.error?.message || ev?.type || 'lỗi bản đồ');
      const n = (demLoi.get(mo) || 0) + 1;
      demLoi.set(mo, n);
      if (n === 6) { console.warn('[map] lỗi "' + mo.slice(0, 40) + '…" lặp nhiều lần — thôi không in nữa'); return; }
      if (n > 6) return;
      const url = ev?.error?.url || ev?.url || (ev?.tile?.tileID ? JSON.stringify(ev.tile.tileID.canonical) : '');
      console.warn('[map]', mo, '· nguồn:', ev?.sourceId || '?', '· địa chỉ:', url, ev);
    });
    setTimeout(() => setReady(true), 5000); // phòng khi 'load' không kích hoạt → không để nút Quay kẹt
    map.on('click', (e: any) => {
      // Đang chờ dời một con ghim (chọn từ menu chuột phải) → bấm đâu ghim nhảy tới đó
      if (choDoiChoRef.current != null) {
        const i = choDoiChoRef.current; setChoDoiCho(null);
        markers.current = markers.current.map((mk, k) => (k === i ? { ...mk, lng: e.lngLat.lng, lat: e.lngLat.lat } : mk));
        drawMarkers(); bumpGeom(); toast.success('Đã dời ghim tới chỗ mới');
        return;
      }
      const m = modeRef.current; if (m === 'none' || m === 'edit') return; // 'edit' xử lý bằng kéo/thả bên dưới
      const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      if (m === 'parcel') {
        const shp = parcelShapeRef.current;
        if (shp === 'poly') { parcel.current = [...parcel.current, pt]; drawParcel(); bumpGeom(); }
        else if (!shapePending.current) { shapePending.current = pt; toast.info(shp === 'circle' ? 'Bấm điểm thứ 2 để định bán kính' : 'Bấm góc đối diện để hoàn tất'); }
        else {
          const a = shapePending.current; shapePending.current = null;
          const kx = Math.cos((a[1] * Math.PI) / 180) || 1e-6;
          if (shp === 'circle') { const r = haversine(a, pt); parcel.current = circleRing(a[0], a[1], r, 48).slice(0, -1); }
          else if (shp === 'square') { const side = Math.max(Math.abs(pt[0] - a[0]) * kx, Math.abs(pt[1] - a[1])); const dx = (side / kx) * Math.sign(pt[0] - a[0] || 1), dy = side * Math.sign(pt[1] - a[1] || 1); parcel.current = [a, [a[0] + dx, a[1]], [a[0] + dx, a[1] + dy], [a[0], a[1] + dy]]; }
          else parcel.current = [a, [pt[0], a[1]], pt, [a[0], pt[1]]];
          drawParcel(); bumpGeom(); setMode('none'); toast.success('Đã khoanh xong lô — bấm ✎ Sửa đỉnh nếu muốn chỉnh');
        }
      }
      // XOÁ TỪNG GHIM: bấm vào con ghim nào thì chỉ mất con đó, mấy con còn lại y nguyên.
      else if (m === 'xoaghim') {
        const i = ghimGanNhat(pt, 46);
        if (i < 0) { toast.info('Bấm đúng vào con ghim muốn xoá'); return; }
        const ten = markers.current[i]?.label || 'ghim';
        markers.current = markers.current.filter((_, k) => k !== i);
        drawMarkers(); bumpGeom();
        toast.success('Đã xoá ' + ten + (markers.current.length ? ' — còn ' + markers.current.length + ' ghim' : ' — hết ghim') + '. Nhấn Ctrl+Z nếu lỡ tay.');
      }
      // VẼ ĐƯỜNG ĐI RIÊNG cho phương tiện đang chọn: bấm lần lượt các điểm, Enter/nhấp đúp là xong.
      else if (m === 'vexe') {
        const id = selObjRef.current;
        const o = objectsRef.current.find((z) => z.id === id);
        if (!o) { toast.info('Hãy chọn một phương tiện trước'); setMode('none'); return; }
        const duong = [...((o.duong || []) as [number, number][]), pt];
        updateObj(o.id, { duong, runRoute: true });
        drawXePath(duong);
      }
      else if (m === 'marker') { const pr = pinRef.current; markers.current = [...markers.current, { lng: pt[0], lat: pt[1], label: markerLabelRef.current, kind: pr.shape === 'radar' ? 'radar' : 'pin', color: pr.color, shape: pr.shape, icon: pr.icon, anim: pinAnimRef.current, rfx: radarFxRef.current, minz: pinMinZRef.current, daBan: pr.daBan }]; drawMarkers(); bumpGeom(); }
      else if (m === 'radius') { radii.current = [...radii.current, { lng: pt[0], lat: pt[1], r: radiusRef.current }]; drawRadii(); bumpGeom(); }
      else if (m === 'distance') {
        if (!distPending.current) { distPending.current = pt; toast.info('Bấm điểm thứ 2 để đo'); }
        else { dists.current = [...dists.current, { a: distPending.current, b: pt }]; distPending.current = null; drawDists(); bumpGeom(); }
      }
      else if (m === 'callout') { // đặt thẻ chú thích: thẻ tự lệch lên trên-phải, kéo được sau
        const sp = 0.0022 * Math.pow(2, 15 - map.getZoom()); // độ lệch thẻ co theo mức phóng để luôn nhìn cân
        const id = 'c' + Date.now();
        callouts.current = [...callouts.current, { id, lng: pt[0], lat: pt[1], dx: sp * 2.2, dy: sp * 1.6, label: calloutRef.current.label, dist: calloutRef.current.dist, sub: (calloutRef.current as any).sub || '', gia: (calloutRef.current as any).gia || '' }];
        drawCallouts(); setSelCallout(id); setCalloutVer((v) => v + 1); bumpGeom();
      }
      else if (m === 'muiten') { // bắn một mũi tên từ lô đất tới chỗ vừa bấm
        if (!parcelCenter()) { toast.error('Khoanh lô đất trước đã — mũi tên bắn ra từ lô'); return; }
        const r = mtRef.current;
        arrows.current = [...arrows.current, { id: 'mt' + Date.now(), lng: pt[0], lat: pt[1], label: r.label, col: r.col, tcol: r.tcol, kieu: r.kieu, dist: r.dist, icon: r.icon }];
        drawArrows(); setMtVer((v) => v + 1); bumpGeom();
      }
      else if (m === 'dir') { // chỉ đường A→B theo đường bộ thật
        if (!dirPending.current) { dirPending.current = pt; toast.info('Bấm tiếp ĐIỂM ĐẾN'); }
        else { const a = dirPending.current; dirPending.current = null; routeAB(a, pt); }
      }
      else { route.current = [...route.current, pt]; drawRoute(tuyenVe()); bumpGeom(); }
    });
    // SỬA ĐỈNH: kéo đỉnh để dời, bấm (không kéo) để xoá đỉnh.
    map.on('dblclick', (e: any) => { // nhấp đúp = xong (giống mọi phần mềm vẽ)
      if (modeRef.current === 'parcel' || modeRef.current === 'route' || modeRef.current === 'vexe') {
        e.preventDefault(); const laTuyen = modeRef.current === 'route'; setMode('none');
        // Vẽ tuyến xong thì tuyến ẩn đi (chỉ hiện khi video chạy) → nói rõ cho khỏi tưởng mất tuyến.
        if (laTuyen) toast.success('Đã xong — tuyến sẽ hiện khi bấm Chạy thử / Quay video');
        else toast.success('Đã xong');
      }
    });
    // ── BẤM CHUỘT PHẢI LÊN MỘT CON GHIM → mở menu nhỏ: bay tới · đổi tên · dời chỗ · xoá ──
    map.on('contextmenu', (e: any) => {
      const i = ghimGanNhat([e.lngLat.lng, e.lngLat.lat], 46);
      if (i < 0) return;                                   // bấm ra chỗ trống thì để trình duyệt lo
      try { e.preventDefault?.(); e.originalEvent?.preventDefault?.(); } catch { /* bỏ qua */ }
      const oe = e.originalEvent || {};
      setGhimMenu({ i, x: oe.clientX || 0, y: oe.clientY || 0 });
    });
    // ── KÉO THẲNG CON GHIM để dời chỗ (khi không ở chế độ vẽ nào) ──
    map.on('mousedown', (e: any) => {
      if (modeRef.current === 'none' && (e.originalEvent?.button ?? 0) === 0) {
        const i = ghimGanNhat([e.lngLat.lng, e.lngLat.lat], 24);
        if (i >= 0) { e.preventDefault(); map.dragPan.disable(); dragPin.current = { i, moved: false }; return; }
      }
      if (modeRef.current !== 'edit') return;
      // Ưu tiên kéo THẺ CHÚ THÍCH (nếu bấm trúng thẻ), sau đó mới tới đỉnh lô/tuyến.
      const cf = map.queryRenderedFeatures(e.point, { layers: ['callout-card'] })[0];
      if (cf) {
        const near = callouts.current.reduce((best: any, c) => { const d = Math.hypot(c.lng + c.dx - e.lngLat.lng, c.lat + c.dy - e.lngLat.lat); return !best || d < best.d ? { c, d } : best; }, null);
        if (near) { e.preventDefault(); map.dragPan.disable(); dragCard.current = { id: near.c.id, ox: e.lngLat.lng - (near.c.lng + near.c.dx), oy: e.lngLat.lat - (near.c.lat + near.c.dy) }; setSelCallout(near.c.id); return; }
      }
      const f = map.queryRenderedFeatures(e.point, { layers: ['vert-dots'] })[0];
      if (!f) return;
      e.preventDefault(); map.dragPan.disable();
      dragVert.current = { kind: f.properties.kind, idx: f.properties.idx, moved: false };
    });
    map.on('mousemove', (e: any) => {
      const dp = dragPin.current;
      if (dp) { dp.moved = true; markers.current = markers.current.map((mk, i) => (i === dp.i ? { ...mk, lng: e.lngLat.lng, lat: e.lngLat.lat } : mk)); drawMarkers(); return; }
      // Rê chuột qua con ghim thì đổi con trỏ thành bàn tay — để người dùng biết là kéo được
      if (modeRef.current === 'none') { try { map.getCanvas().style.cursor = ghimGanNhat([e.lngLat.lng, e.lngLat.lat], 24) >= 0 ? 'grab' : ''; } catch { /* bỏ qua */ } }
      const dc = dragCard.current;
      if (dc) { callouts.current = callouts.current.map((c) => (c.id === dc.id ? { ...c, dx: e.lngLat.lng - dc.ox - c.lng, dy: e.lngLat.lat - dc.oy - c.lat } : c)); drawCallouts(); return; }
      const d = dragVert.current; if (!d) return;
      d.moved = true; const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      if (d.kind === 'parcel') { parcel.current = parcel.current.map((p, i) => (i === d.idx ? pt : p)); drawParcel(); }
      else { route.current = route.current.map((p, i) => (i === d.idx ? pt : p)); drawRoute(tuyenVe()); }
      drawVerts();
    });
    map.on('mouseup', () => {
      if (dragPin.current) { const moved = dragPin.current.moved; dragPin.current = null; try { map.dragPan.enable(); } catch { /* bỏ qua */ } if (moved) { bumpGeom(); toast.success('Đã dời ghim'); } return; }
      if (dragCard.current) { dragCard.current = null; try { map.dragPan.enable(); } catch { /* ignore */ } setCalloutVer((v) => v + 1); bumpGeom(); return; } // vẽ lại đúng màu đang chọn
      const d = dragVert.current; if (!d) return; dragVert.current = null; try { map.dragPan.enable(); } catch { /* ignore */ }
      if (!d.moved) { // bấm đỉnh (không kéo) = xoá đỉnh
        if (d.kind === 'parcel') { parcel.current = parcel.current.filter((_, i) => i !== d.idx); drawParcel(); }
        else { route.current = route.current.filter((_, i) => i !== d.idx); drawRoute(tuyenVe()); }
      }
      drawVerts(); bumpGeom();
    });
    map.on('mouseenter', 'vert-dots', () => { if (modeRef.current === 'edit') map.getCanvas().style.cursor = 'move'; });
    map.on('mouseleave', 'vert-dots', () => { if (modeRef.current === 'edit') map.getCanvas().style.cursor = CROSS_CUR; });
    return () => { try { window.removeEventListener('resize', (map as any).__onResize); } catch { /* ignore */ } try { (map as any).__ro?.disconnect(); } catch { /* ignore */ } map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const m = mapRef.current; if (!m?.getLayer?.('sat')) return;
    // Dựng núi + đang dùng ảnh vệ tinh nét → tự chuyển sang ảnh nhẹ (xem chú thích ở khai báo net3d).
    const dungNui = hinhMode === '3d';
    const nenDung = (dungNui && !net3d && base === 'sat') ? 'sat2' : base;
    (['sat', 'sat2', 'street', 'dark'] as const).forEach((id) => {
      m.setLayoutProperty(id, 'visibility', nenDung === id ? 'visible' : 'none');
      for (const lot of ['lot' + id, 'lot2' + id])   // hai tầng lót đi theo nền đang chọn
        if (m.getLayer(lot)) m.setLayoutProperty(lot, 'visibility', nenDung === id ? 'visible' : 'none');
    });
    m.setLayoutProperty('lab', 'visibility', labels && (nenDung === 'sat' || nenDung === 'sat2') ? 'visible' : 'none'); // nhãn địa danh chỉ chồng lên vệ tinh
    // ══ DỰNG NÚI THÌ CHẶN PHÓNG QUÁ SÂU ══
    // Ảnh độ cao chỉ chi tiết tới mức 13. Phóng sát hơn mức 16 thì mỗi ô độ cao phải phủ cả chục ô
    // ảnh nền → mặt đất bị vặn như tấm vải nhàu, đường thẳng gãy khúc. Thà chặn lại còn hơn để méo.
    try {
      m.setMaxZoom(dungNui ? 16 : 18);
      if (dungNui && m.getZoom() > 16) { m.setZoom(16); toast.info('Đang dựng núi 3D nên chỉ phóng tới mức 16 — phóng sâu hơn mặt đất sẽ bị vặn méo.'); }
    } catch { /* ignore */ }
  }, [labels, base, hinhMode, net3d]);

  // Áp tông màu lên các lớp ảnh nền. Chạy lại mỗi khi đổi tông hoặc đổi nền.
  useEffect(() => {
    const m = mapRef.current; if (!m?.getLayer?.('sat')) return;
    const v = toneCustom || (TONES.find((t) => t.key === tone)?.v) || TONES[1].v;
    (['sat', 'sat2', 'street', 'dark'] as const).forEach((id) => {
      for (const lop of [id, 'lot' + id, 'lot2' + id]) {   // áp cho cả hai tầng lót, không thì chỗ ảnh mờ lệch màu, nhìn ra ngay
        if (!m.getLayer?.(lop)) continue;
        try {
          m.setPaintProperty(lop, 'raster-saturation', v.sat);
          m.setPaintProperty(lop, 'raster-contrast', v.con);
          m.setPaintProperty(lop, 'raster-brightness-min', v.briMin);
          m.setPaintProperty(lop, 'raster-brightness-max', v.briMax);
          m.setPaintProperty(lop, 'raster-hue-rotate', v.hue);
        } catch { /* ignore */ }
      }
    });
  }, [tone, toneCustom, base, ready]);

  // Bật/tắt đổ bóng đồi núi
  useEffect(() => {
    const m = mapRef.current; if (!m?.getLayer?.('hillshade')) return;
    try { m.setLayoutProperty('hillshade', 'visibility', hillshade ? 'visible' : 'none'); } catch { /* ignore */ }
  }, [hillshade, ready]);
  // Bật/tắt địa hình 3D (đồi núi nhô lên thật khi camera nghiêng)
  useEffect(() => {
    const m = mapRef.current; if (!m || !ready) return;
    try {
      if (terrain3d && typeof (m as any).setTerrain === 'function') (m as any).setTerrain({ source: 'dem', exaggeration: noiKhoi });
      else if (typeof (m as any).setTerrain === 'function') (m as any).setTerrain(null);
    } catch (e) { console.warn('[dia hinh 3D]', e); }
  }, [terrain3d, ready, noiKhoi]);

  // CON TRỎ CHUỘT khi đang vẽ / cắm ghim.
  // Con trỏ chữ thập mặc định của trình duyệt là nét đen rất mảnh — trên ảnh vệ tinh cây cối
  // tối màu thì gần như MẤT TĂM, không biết mình đang trỏ vào đâu. Nên tự vẽ con trỏ:
  // vẽ/tuyến/đo → chữ thập TRẮNG có viền đen · cắm ghim → chính con ghim sắp cắm, mũi ghim đúng điểm.
  const CROSS_CUR = 'url("data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30"><g fill="none" stroke="#000" stroke-width="4.5" stroke-linecap="round" opacity=".6"><path d="M15 2v9M15 19v9M2 15h9M19 15h9"/></g><g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M15 2v9M15 19v9M2 15h9M19 15h9"/></g><circle cx="15" cy="15" r="1.7" fill="#fff" stroke="#000" stroke-width="1"/></svg>') + '") 15 15, crosshair';
  function pinCursor(shape: string, color: string, icon: string): string {
    try {
      if (typeof document === 'undefined' || shape === 'radar') return CROSS_CUR;
      const im = makePinImage(shape, color, icon); if (!im) return CROSS_CUR;
      const t = document.createElement('canvas'); t.width = im.width; t.height = im.height;
      t.getContext('2d')?.putImageData(im, 0, 0);
      const H = 48, W = Math.max(1, Math.round((im.width * H) / im.height));       // Chrome chỉ nhận con trỏ nhỏ
      const o = document.createElement('canvas'); o.width = W; o.height = H;
      const g = o.getContext('2d'); if (!g) return CROSS_CUR;
      g.drawImage(t, 0, 0, W, H);
      const giua = shape === 'dot' || shape === 'badge' || shape === 'hex' || shape === 'ring';
      return 'url(' + o.toDataURL() + ') ' + Math.round(W / 2) + ' ' + (giua ? Math.round(H / 2) : H - 2) + ', crosshair';
    } catch { return CROSS_CUR; }
  }
  useEffect(() => {
    const m = mapRef.current; if (!m || !ready) return;
    const cv = m.getCanvas();
    cv.style.cursor = mode === 'none' ? '' : mode === 'xoaghim' ? 'not-allowed' : mode === 'marker' ? pinCursor(pinShape, pinColor, pinIcon) : CROSS_CUR;
  }, [mode, pinShape, pinColor, pinIcon, ready]);

  const fc = (features: any[]) => ({ type: 'FeatureCollection' as const, features });
  // TÊN ĐƯỜNG in CHẠY DỌC theo tuyến (kiểu video bất động sản: "QUỐC LỘ 27" nằm ngay trên con đường).
  // Gắn thẳng vào chính đường tuyến nên vẽ tới đâu chữ chạy tới đó, không phải canh tay.
  const lineFeat = (coords: [number, number][]) => (coords.length >= 2 ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: { ten: chuBanDo(routeNameRef.current || '') } }] : []);
  function drawParcel() {
    const c = parcel.current; const feats: any[] = [];
    if (c.length >= 3) feats.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...c, c[0]]] }, properties: {} });
    else if (c.length >= 2) feats.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: c }, properties: {} });
    mapRef.current?.getSource('parcel')?.setData(fc(feats));
    drawLoSoDo();
  }
  // SỐ ĐO LÔ ĐẤT: mỗi cạnh in dài bao nhiêu mét ngay trên cạnh đó, giữa lô in diện tích —
  // đúng kiểu video bất động sản hay làm ("5m × 45m · 225 m²"), khỏi phải chèn chữ bằng tay.
  const loSoDoRef = useRef(false);
  useEffect(() => { loSoDoRef.current = loSoDo; if (ready) drawLoSoDo(); }, [loSoDo, ready, geomVer]);
  function drawLoSoDo() {
    const c = parcel.current;
    if (!loSoDoRef.current || c.length < 3) { mapRef.current?.getSource('losodo')?.setData(fc([])); return; }
    const feats: any[] = [];
    for (let i = 0; i < c.length; i++) {
      const a = c[i], b = c[(i + 1) % c.length];
      const d = haversine(a, b);
      if (d < 0.5) continue;                                    // cạnh ngắn quá thì thôi, in vào rối mắt
      feats.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [a, b] }, properties: { d: (d >= 1000 ? fmtDist(d) : Math.round(d) + 'm') } });
    }
    const cen = parcelCenter();
    if (cen) feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: cen }, properties: { dt: fmtArea(ringAreaM2(c)) } });
    mapRef.current?.getSource('losodo')?.setData(fc(feats));
  }
  function drawRoute(coords: [number, number][], dinh?: [number, number] | null) {
    const fs: any[] = lineFeat(coords);
    if (dinh) fs.push({ type: 'Feature', geometry: { type: 'Point', coordinates: dinh }, properties: {} });
    tuyenDaNap.current = null;          // hình học vừa đổi → lần chạy sau phải nạp lại
    datTienDoTuyen(1);                  // trả tuyến về tô màu đầy đủ
    mapRef.current?.getSource('route')?.setData(fc(fs));
  }
  // ══ VẼ TUYẾN CHẠY DẦN BẰNG CÁCH TÔ MÀU DỌC ĐƯỜNG ══
  // Cách cũ: mỗi khung hình gửi lại TOÀN BỘ hình học tuyến xuống bản đồ. maplibre phải đưa sang tiến
  // trình phụ cắt thành ô rồi mới vẽ, nên hình luôn ra sau vài khung — mà ra sau KHÔNG ĐỀU. Đó là gốc
  // của cái giật, và chạy càng chậm càng thấy rõ (mỗi khung nhích một tí nhưng hình vẫn nhảy từng nấc).
  // Cách này: hình học gửi ĐÚNG MỘT LẦN, mỗi khung chỉ đổi một thuộc tính MÀU dọc theo đường —
  // việc này chạy thẳng trên luồng chính, không qua tiến trình phụ, nên mượt ở mọi tốc độ.
  const tuyenDaNap = useRef<{ src: any; dao: boolean } | null>(null);
  const nhipTuyen = useRef({ t: 0, q: 0, v: 0 });   // nhịp chạy của tuyến (phần/giây)
  const chamTruoc = useRef(-1);                    // vị trí chấm lần vẽ trước — đổi ít quá thì khỏi vẽ lại
  function napTuyenDay(dao: boolean) {
    const nen = dao ? tuyenNguoc() : tuyenVe();
    const cu = tuyenDaNap.current;
    if (cu && cu.src === nen && cu.dao === dao) return;
    tuyenDaNap.current = { src: nen, dao };
    mapRef.current?.getSource('route')?.setData(fc(lineFeat(nen)));
  }
  function datTienDoTuyen(q: number) {
    const m = mapRef.current; if (!m) return;
    const t = Math.max(0.0005, Math.min(0.9995, q));
    const trong = 'rgba(0,0,0,0)';
    const doi = (lop: string) => {
      if (!m.getLayer?.(lop)) return;
      let mau: any = routeColRef.current || '#ff5a2c';
      try { const c = m.getPaintProperty(lop, 'line-color'); if (typeof c === 'string') mau = c; } catch { /* ignore */ }
      try {
        m.setPaintProperty(lop, 'line-gradient', q >= 0.999
          ? ['interpolate', ['linear'], ['line-progress'], 0, mau, 1, mau]
          : ['interpolate', ['linear'], ['line-progress'], 0, mau, t, mau, Math.min(1, t + 0.001), trong, 1, trong]);
      } catch { /* ignore */ }
    };
    // Mỗi lần đổi "tô màu dọc đường" là bản đồ phải dựng lại dải màu — làm 3 lớp mỗi khung hình thì
    // 60 lần/giây × 3 = rất tốn. Lớp quầng sáng nào đang tắt (bề rộng hoặc độ đậm bằng 0) thì bỏ qua.
    const dangHien = (lop: string) => {
      if (!m.getLayer?.(lop)) return false;
      try {
        const w = m.getPaintProperty(lop, 'line-width');
        const o = m.getPaintProperty(lop, 'line-opacity');
        if (typeof w === 'number' && w <= 0.01) return false;
        if (typeof o === 'number' && o <= 0.01) return false;
      } catch { /* ignore */ }
      return true;
    };
    if (dangHien('route-glow2')) doi('route-glow2');
    if (dangHien('route-glow')) doi('route-glow');
    doi('route-line');
  }
  // Chấm sáng đầu tuyến — lớp phủ HTML, đổi chỗ tức thì trên luồng chính nên khớp đúng với cách tô màu trên.
  const chamDauRef = useRef<any>(null);
  // Chấm sáng là lớp HTML nằm ĐÈ LÊN bản đồ, không nằm trong ảnh bản đồ. Quay video là chụp ảnh bản
  // đồ nên chấm KHÔNG lọt vào — đó là lý do clip xuất ra mất chấm tròn. Nhớ toạ độ nó ở đây để lúc
  // ghép khung hình còn vẽ lại bằng tay.
  const chamViTriRef = useRef<[number, number] | null>(null);
  function datChamDau(diem: [number, number] | null) {
    const m = mapRef.current; if (!m) return;
    chamViTriRef.current = diem;
    if (!diem) { if (chamDauRef.current) chamDauRef.current.getElement().style.display = 'none'; return; }
    const mau = routeColRef.current || '#ff5a2c';
    if (!chamDauRef.current) {
      const el = document.createElement('div');
      el.style.cssText = 'width:15px;height:15px;border-radius:999px;background:#fff;pointer-events:none';
      chamDauRef.current = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(diem).addTo(m);
    }
    const el = chamDauRef.current.getElement() as HTMLElement;
    el.style.display = '';
    el.style.boxShadow = '0 0 0 4px ' + mau + ', 0 0 14px 5px ' + hexA(mau, 0.5);
    chamDauRef.current.setLngLat(diem);
  }
  // Vẽ tuyến chạy dần theo tiến độ p (0→1) — có tính chiều chạy, kiểu chạy nhanh/chậm và chấm sáng ở đầu tuyến.
  // Vẽ lại tuyến đường TỐN SỨC: mỗi lần gọi là dựng lại toàn bộ hình học rồi đẩy xuống bản đồ.
  // Gọi 60 lần/giây trên tuyến dài vài trăm điểm là máy nghẹt → giật. Chỉ vẽ lại khi tiến độ
  // đã nhích đủ nhiều (0,4%) — mắt không thấy khác, mà máy nhẹ hẳn.
  // NGƯỠNG VẼ LẠI TUYẾN: 0,4% như cũ nghĩa là cả tuyến chỉ được vẽ lại 250 lần — video 50 giây
  // thì mỗi giây chỉ nhích 5 nấc, mắt thấy rõ nét vẽ "nhảy từng đoạn" chạy sau camera.
  // Giờ tuyến ngắn/vừa (dưới 600 điểm) thì vẽ lại dày gấp 3 (mượt như camera), tuyến cực dài
  // mới nới ngưỡng ra cho máy đỡ nặng.
  let rpTruoc = -1;
  let veLuc = 0;          // lần vẽ lại tuyến gần nhất (mili-giây)
  function drawRouteProgress(p: number, buoc = (route.current.length > 900 ? 0.0016 : 0.0006), thoEase = false) {
    const rr = renderRef.current;
    const dir = rr.routeDir || routeDir, ez = rr.routeEase || routeEase, head = rr.routeHead ?? routeHead;
    const q = thoEase ? Math.max(0, Math.min(1, p)) : easeAt(ez === 'linear' ? 'linear' : ez, Math.max(0, Math.min(1, p)));
    const dao = dir === 'nguoc';
    // ══ NÉT TUYẾN VÀ CHẤM SÁNG VẼ CHUNG MỘT LƯỢT ══
    // Từng thử tách chấm ra thành lớp phủ HTML cho mượt, nhưng lớp phủ hiện tức thì còn nét tuyến
    // (dữ liệu bản đồ) phải qua tiến trình phụ nên ra sau vài khung — thành ra chấm chạy trước, nét
    // lẽo đẽo theo sau, rồi bù trừ kiểu gì cũng không khớp. Giờ quay lại cách chắc ăn: chấm lấy ĐÚNG
    // điểm cuối của đoạn tuyến vừa vẽ, cùng đi qua một đường ống → không đời nào lệch nhau được.
    // Tắt chấm thì bỏ ô tick "Chấm sáng chạy ở đầu tuyến" trong bảng Tuyến đường.
    // ── ĐƯỜNG LIỀN: tô màu dọc đường (mượt tuyệt đối) ──
    // Kiểu vẽ nét đứt ("Nét đứt chạy", "Chuỗi chấm tròn") không tô màu dần được — bản đồ không cho
    // vừa kẻ nét đứt vừa tô màu dọc đường — nên hai kiểu đó vẫn dùng cách cũ.
    const kieuDut = ['vach', 'chamtron'].includes(routeStyleRef.current);
    if (!kieuDut) {
      napTuyenDay(dao);                                   // hình học nạp MỘT lần
      datTienDoTuyen(q);                                  // mỗi khung chỉ đổi màu — không qua tiến trình phụ
      const hien = head && q > 0.001 && q < 0.999;
      // ══ CHẤM PHẢI BÁM ĐÚNG ĐẦU NÉT — BÙ THEO THỜI GIAN, KHÔNG PHẢI SỐ CỐ ĐỊNH ══
      // Nét tuyến là hình vẽ trên bản đồ: lệnh đổi màu dọc đường phải qua khâu dựng lại dải màu nên
      // hiện ra CHẬM chừng một phần tư giây. Chấm là lớp phủ HTML, hiện tức thì. Vì thế chấm luôn
      // chạy trước nét một đoạn — và đoạn đó DÀI hay NGẮN tuỳ tuyến chạy nhanh hay chậm, nên bù bằng
      // một con số cố định là sai (tuyến dài thì hụt, tuyến ngắn thì quá tay).
      // Cách đúng: đo xem mỗi giây tuyến chạy được bao nhiêu phần, rồi lùi chấm lại đúng ngần ấy thời gian.
      // ⚠️ ĐỒNG HỒ Ở ĐÂY PHẢI LÀ ĐỒNG HỒ CỦA VIDEO.
      // Đoạn dưới đo "mỗi giây tuyến chạy được bao nhiêu phần" để bù độ trễ cho chấm sáng. Lúc render
      // kỹ, một khung mất cả trăm phần nghìn giây THẬT nhưng chỉ nhích 1/30 giây VIDEO — đo bằng đồng
      // hồ thật thì con số sai gấp mấy lần, chấm bù trật ra khỏi đầu nét. Đúng cảnh "chấm chạy riêng".
      const gioNay = gioHieuUng();
      if (nhipTuyen.current.t > 0) {
        const dtq = (gioNay - nhipTuyen.current.t) / 1000;
        if (dtq > 0.004 && dtq < 0.5) {
          const v = (q - nhipTuyen.current.q) / dtq;                       // phần tuyến chạy được mỗi giây
          if (v >= 0) nhipTuyen.current.v = nhipTuyen.current.v * 0.75 + v * 0.25;   // làm mượt cho khỏi nhảy
        }
      }
      nhipTuyen.current.t = gioNay; nhipTuyen.current.q = q;
      // Render kỹ thì KHÔNG bù gì cả: mỗi khung đều chờ bản đồ vẽ xong hẳn mới chụp, nên nét tuyến
      // và chấm luôn cùng một thời điểm — bù thêm chỉ tổ làm chấm lệch.
      const khongBu = recRef.current && renderKyRef.current;
      const qCham = khongBu ? q : Math.max(0, q - nhipTuyen.current.v * 0.04);
      datChamDau(hien ? diemTaiTienDo(dao ? 1 - qCham : qCham) : null);
      return;
    }
    datChamDau(null);
    // ── Kiểu nét đứt: vẫn phải gửi lại hình học, nên có hãm nhịp theo THỜI GIAN (đều hơn hãm theo tiến độ) ──
    const gio = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const cachNhau = route.current.length > 900 ? 30 : 15;
    // Render kỹ thì mỗi khung BẮT BUỘC phải vẽ lại tuyến, không được hãm — hãm là nét tuyến đứng
    // yên qua vài khung rồi nhảy một phát, xem thấy giật.
    const hamNhip = !(recRef.current && renderKyRef.current);
    if (hamNhip && veLuc > 0 && gio - veLuc < cachNhau && p > 0.001 && p < 0.999) return;
    veLuc = gio; rpTruoc = p;
    const doan = dao ? catTuyen(tuyenNguoc(), q) : routeAt(q);
    const dinh = doan.length ? doan[doan.length - 1] : null;
    tuyenDaNap.current = null;
    const fs: any[] = lineFeat(doan);
    if (head && dinh && q > 0.001 && q < 0.999) fs.push({ type: 'Feature', geometry: { type: 'Point', coordinates: dinh }, properties: {} });
    mapRef.current?.getSource('route')?.setData(fc(fs));
  }
  // Nạp ảnh ghim vào bản đồ nếu chưa có (mỗi tổ hợp kiểu+màu+biểu tượng là một ảnh).
  // Ghim có nhãn: mỗi cái tên một ảnh riêng nên khoá nhớ phải gồm cả cái tên.
  function ensurePinLabel(color: string, icon: string, label: string, kieu: string, daBan = false): string {
    const id = 'pinlb|' + kieu + '|' + color + '|' + (icon || '-') + '|' + label + (daBan ? '|daban' : '');
    const m = mapRef.current;
    try { if (m && !m.hasImage(id)) { const im = makeLabelPin(color, icon, label, kieu, daBan); if (im) m.addImage(id, im as any, { pixelRatio: 2 * PIN_HD } as any); } } catch (e) { console.warn('[pin-nhan]', e); }
    return id;
  }
  function ensurePin(shape: string, color: string, icon: string): string {
    const id = 'pin|' + shape + '|' + color + '|' + (icon || '-');
    const m = mapRef.current;
    try { if (m && !m.hasImage(id)) { const im = makePinImage(shape, color, icon); if (im) m.addImage(id, im as any, { pixelRatio: 2 * PIN_HD } as any); } } catch (e) { console.warn('[pin]', e); }
    return id;
  }
  // Cỡ ghim: bám theo mặt đất (to nhỏ cùng bản đồ) hoặc giữ nguyên trên màn hình.
  const pinSzRef = useRef(0.5);
  function applyPinScale(force = false) {
    const m = mapRef.current; if (!m || !m.getLayer('marker-pin')) return;
    const sz = pinGround ? Math.max(0.05, Math.min(6, 0.5 * Math.pow(2, m.getZoom() - pinZ0.current))) : 0.5;
    if (!force && Math.abs(sz - pinSzRef.current) < 0.02) return;        // đổi không đáng kể thì thôi, tránh giật
    pinSzRef.current = sz;
    try { m.setLayoutProperty('marker-pin', 'icon-size', +sz.toFixed(3)); } catch { /* bỏ qua */ }
  }
  useEffect(() => {
    const m = mapRef.current; if (!m) return;
    if (pinGround) pinZ0.current = m.getZoom();
    applyPinScale(true);
    if (!pinGround) return;
    const h = () => applyPinScale();
    m.on('zoomend', h); m.on('moveend', h);
    return () => { try { m.off('zoomend', h); m.off('moveend', h); } catch { /* bỏ qua */ } };
  }, [pinGround, ready]);
  // Nạp sẵn ảnh nan quạt / cung sáng cho radar (mỗi màu một ảnh).
  function ensureRadarFx(color: string, kind: 'quet' | 'cung'): string {
    const id = 'rdr|' + kind + '|' + color; const m = mapRef.current;
    try { if (m && !m.hasImage(id)) { const im = radarFxImage(color, kind); if (im) m.addImage(id, im as any, { pixelRatio: 2 } as any); } } catch (e) { console.warn('[radar]', e); }
    return id;
  }
  const markerFeats = useRef<any[]>([]);   // giữ sẵn danh sách điểm — mỗi khung hình chỉ sửa mấy con số chuyển động
  // Theo dõi mức phóng để hiện cho người dùng biết đang ở mức mấy.
  useEffect(() => {
    const m = mapRef.current; if (!m || !ready) return;
    const h = () => setMapZ(+m.getZoom().toFixed(1)); h();
    m.on('zoomend', h); return () => { try { m.off('zoomend', h); } catch { /* bỏ qua */ } };
  }, [ready]);
  // Ghim/nhãn đè lên nhau thì tự giấu bớt (bản đồ chuyên nghiệp nào cũng làm vậy).
  useEffect(() => {
    const m = mapRef.current; if (!m?.getLayer?.('marker-pin')) return;
    const cho = !pinKhongDe;
    try {
      m.setLayoutProperty('marker-pin', 'icon-allow-overlap', cho);
      m.setLayoutProperty('marker-label', 'text-allow-overlap', cho);
      m.setLayoutProperty('marker-label', 'icon-allow-overlap', cho);
    } catch { /* bỏ qua */ }
  }, [pinKhongDe, ready]);
  function drawMarkers() {
    markerFeats.current = markers.current.map((mk) => {
      const shape = mk.shape || (mk.kind === 'radar' ? 'radar' : mk.kind === 'dot' ? 'dot' : 'drop');
      const color = mk.color || '#C8A14B';
      const isPin = shape !== 'radar';
      // Vòng sáng mảnh dưới chân ghim — chính là chi tiết làm radar nhìn "đắt". Giờ áp cho MỌI
      // kiểu ghim có mũi cắm xuống đất (kiểu tròn/lục giác/vòng khuyên thì không, vì vòng sẽ đè lên icon).
      const ring = ['dot', 'badge', 'hex', 'ring', 'radar'].includes(shape) ? 0 : 1;
      return { type: 'Feature', geometry: { type: 'Point', coordinates: [mk.lng, mk.lat] }, properties: {
        label: laGhimCoTen(shape) ? '' : chuBanDo(mk.label), kind: isPin ? 'pin' : 'radar', color, shape, ring,
        anim: mk.anim || 'nhun', rfx: mk.rfx || 'songlan', minz: mk.minz || 0,
        // Ba kiểu ghim CÓ NHÃN TÊN: tên nằm trong thân ghim nên KHÔNG vẽ chữ rời bên dưới nữa
        // (label để rỗng), tránh hiện tên hai lần.
        img: isPin ? (laGhimCoTen(shape) ? ensurePinLabel(color, mk.icon || 'dot', mk.label || '', shape.startsWith('nhan') ? (shape.slice(4) || 'trang') : shape, !!mk.daBan) : ensurePin(shape, color, mk.icon || 'dot')) : '', sweep: isPin ? '' : ensureRadarFx(color, 'quet'), arc: isPin ? '' : ensureRadarFx(color, 'cung'),
        // các con số chuyển động (vòng lặp hiệu ứng ghi đè liên tục)
        off: [0, 0], op: 1, gr: 13, go: 0.1, sr: 7, so: 0.3, r1: 13, o1: 0.85, r2: 23, o2: 0.4,
        p1r: 8, p1o: 0, p1s: 0, p2r: 8, p2o: 0, p2s: 0,
        d1r: 10, d1o: 0, d1s: 0, d2r: 10, d2o: 0, d2s: 0, d3r: 10, d3o: 0, d3s: 0,
        swo: 0, aro: 0, rot: 0,
      } };
    });
    mapRef.current?.getSource('markers')?.setData(fc(markerFeats.current));
  }
  // Tìm con ghim gần chỗ vừa bấm nhất (tính bằng khoảng cách TRÊN MÀN HÌNH, không phải theo mét)
  // → phóng to hay thu nhỏ bản đồ thì bấm vẫn trúng như nhau. Trả về -1 nếu bấm ra chỗ trống.
  function ghimGanNhat(pt: [number, number], nguong = 46): number {
    const m = mapRef.current; if (!m || !markers.current.length) return -1;
    try {
      const o = m.project(pt as any);
      let iGan = -1, dGan = Infinity;
      markers.current.forEach((mk, i) => {
        const p = m.project([mk.lng, mk.lat] as any);
        const d = Math.hypot(p.x - o.x, p.y - o.y);
        if (d < dGan) { dGan = d; iGan = i; }
      });
      return dGan <= nguong ? iGan : -1;
    } catch { return -1; }
  }
  // Xoá MỘT ghim theo số thứ tự trong danh sách.
  function xoaGhim(i: number) {
    const ten = markers.current[i]?.label || 'ghim';
    markers.current = markers.current.filter((_, k) => k !== i);
    drawMarkers(); bumpGeom();
    toast.success('Đã xoá ' + ten + '. Nhấn Ctrl+Z nếu lỡ tay.');
  }
  // Xoá TẤT CẢ ghim (chỉ ghim thôi — lô đất, tuyến, thẻ chú thích vẫn còn nguyên).
  function xoaHetGhim() {
    if (!markers.current.length) { toast.info('Chưa cắm ghim nào'); return; }
    if (!confirm('Xoá hết ' + markers.current.length + ' ghim? (Lô đất và tuyến đường vẫn giữ nguyên)')) return;
    markers.current = []; drawMarkers(); bumpGeom(); toast.success('Đã xoá hết ghim');
  }
  // Áp kiểu chuyển động đang chọn cho MỌI ghim đã cắm (dùng khi muốn cả bản đồ đồng bộ một kiểu).
  function apAnimTatCa() {
    if (!markers.current.length) { toast.info('Chưa cắm ghim nào'); return; }
    markers.current = markers.current.map((mk) => ({ ...mk, anim: pinAnimRef.current, rfx: radarFxRef.current, minz: pinMinZRef.current }));
    drawMarkers(); bumpGeom();
    toast.success('Đã áp cho ' + markers.current.length + ' ghim đã cắm');
  }
  // Vẽ đường đi riêng của phương tiện ĐANG CHỌN lên bản đồ (nét đứt + chấm các điểm).
  // Truyền mảng rỗng là xoá sạch — dùng trước khi quay để nó không lọt vào video.
  function drawXePath(pts?: [number, number][]) {
    const p = pts || [];
    const fs: any[] = [];
    if (p.length > 1) fs.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: p }, properties: {} });
    p.forEach((c) => fs.push({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: {} }));
    mapRef.current?.getSource('xepath')?.setData(fc(fs));
  }
  function drawRadii() { mapRef.current?.getSource('radius')?.setData(fc(radii.current.map((c) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [circleRing(c.lng, c.lat, c.r)] }, properties: { label: fmtDist(c.r) } })))); }
  function drawDists() { mapRef.current?.getSource('dist')?.setData(fc(dists.current.map((d) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: [d.a, d.b] }, properties: { label: fmtDist(haversine(d.a, d.b)) } })))); }
  // Hướng (độ) từ một điểm tới tâm lô đất — để camera luôn "ngoái nhìn" về lô.
  function bearingToParcel(from: [number, number]): number | null {
    const c = parcelCenter(); if (!c) return null;
    const lat = ((from[1] + c[1]) / 2) * Math.PI / 180;
    const dx = (c[0] - from[0]) * Math.cos(lat), dy = c[1] - from[1];
    if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return null;
    return (Math.atan2(dx, dy) * 180) / Math.PI;
  }
  // Tâm lô đất (trung bình các đỉnh) — mốc để tính khoảng cách cho thẻ chú thích.
  function parcelCenter(): [number, number] | null {
    const c = parcel.current; if (c.length) return [c.reduce((a, p) => a + p[0], 0) / c.length, c.reduce((a, p) => a + p[1], 0) / c.length];
    if (route.current.length) return route.current[0];
    return null;
  }

  // Vẽ THẺ CHÚ THÍCH theo KIỂU đã chọn: dây nối (gấp khúc/cong/nét đứt) + chấm neo + thẻ chữ có khung.
  function drawCallouts() {
    const st = CO_STYLES[calloutStyle] || CO_STYLES.gold; const cen = parcelCenter();
    const feats: any[] = [];
    callouts.current.forEach((c) => {
      const shape = c.shape || calloutShape;
      const anchor: [number, number] = [c.lng, c.lat];
      const card: [number, number] = [c.lng + c.dx, c.lat + c.dy];
      let path: [number, number][];
      if (shape === 'curve') { // đường cong mềm (Bezier bậc 2)
        const ctrl: [number, number] = [c.lng + c.dx * 0.15, c.lat + c.dy * 1.05];
        path = []; for (let i = 0; i <= 14; i++) { const t = i / 14, u = 1 - t; path.push([u * u * anchor[0] + 2 * u * t * ctrl[0] + t * t * card[0], u * u * anchor[1] + 2 * u * t * ctrl[1] + t * t * card[1]]); }
      } else if (shape === 'stair') {
        // HAI BẬC THANG: đi ngang nửa đường → lên hết chiều cao → đi nốt phần ngang còn lại.
        // Nhìn ngăn nắp như sơ đồ kỹ thuật, hợp khi thẻ đặt chéo và xa điểm neo.
        path = [anchor, [c.lng + c.dx * 0.5, c.lat], [c.lng + c.dx * 0.5, c.lat + c.dy], card];
      } else if (shape === 'underline' || shape === 'pill' || shape === 'wave' || shape === 'dotend') path = [anchor, card]; // dây thẳng
      else path = [anchor, [c.lng + c.dx * 0.55, c.lat + c.dy], card]; // gấp khúc
      const d = c.dist && cen ? ' · ' + fmtDist(haversine(cen, anchor)) : '';
      const thin = shape === 'lux' || shape === 'luxdash' ? 1 : 0;         // kiểu sang trọng: nét mảnh
      const boxShape = thin ? 'lux' : (['pill', 'frame', 'bracket', 'underline', 'nenvang', 'haivach', 'gocvang', 'vienday'].includes(shape) ? shape : 'elbow');
      feats.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: path }, properties: { kind: 'line', col: st.col, thin, dash: shape === 'dashed' || shape === 'luxdash' ? 1 : 0 } });
      feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: anchor }, properties: { kind: 'anchor', col: st.col, shape, thin, star: 'costar-' + calloutStyle } });
      // Kiểu "chấm nhấn ở cuối": thêm một chấm tròn to ngay chỗ dây chạm vào thẻ.
      if (shape === 'dotend') feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: card }, properties: { kind: 'dotend', col: st.col } });
      feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: card }, properties: { kind: 'card', label: chuBanDo((c.label || 'Tiện ích') + d) || 'Tiện ích', sub: c.sub?.trim() ? chuBanDo(c.sub) : '', gia: c.gia?.trim() ? chuBanDo(c.gia) : '', ...(c.cat?.trim() ? { cat: chuBanDo(c.cat) } : {}), bg: st.bg, fg: st.fg, col: st.col, thin, box: 'cbox-' + boxShape + '-' + calloutStyle } });
    });
    mapRef.current?.getSource('callout')?.setData(fc(feats));
  }
  useEffect(() => { drawCallouts(); }, [calloutStyle, calloutShape, ready, calloutVer]);

  // Đầu mũi tên: vẽ một lần cho mỗi màu rồi nhớ lại, khỏi vẽ đi vẽ lại.
  function ensureArrowHead(col: string): string {
    const id = 'mtdau-' + col; const m = mapRef.current;
    try { if (m && !m.hasImage(id)) { const im = makeArrowHead(col); if (im) m.addImage(id, im as any, { pixelRatio: 2 } as any); } } catch (e) { console.warn('[mui ten]', e); }
    return id;
  }
  function ensureArrowIcon(col: string, icon: string): string {
    const id = 'mtico-' + col + '-' + icon; const m = mapRef.current;
    try { if (m && !m.hasImage(id)) { const im = makeArrowIcon(col, icon); if (im) m.addImage(id, im as any, { pixelRatio: 2 } as any); } } catch (e) { console.warn('[mui ten icon]', e); }
    return id;
  }
  // Vẽ MŨI TÊN CHỈ HƯỚNG: vạch bắn từ tâm lô đất tới chỗ nổi tiếng.
  // Vạch chừa hai đầu: đầu gốc khỏi đè lên lô, đầu ngọn nhường chỗ cho mũi nhọn và tên chỗ đó.
  function drawArrows() {
    const cen = parcelCenter();
    const feats: any[] = [];
    arrows.current.forEach((a) => {
      const to: [number, number] = [a.lng, a.lat];
      const from = cen || to;
      const col = a.col || '#ffffff', kieu = a.kieu || 'dutdoan';
      const dx = to[0] - from[0], dy = to[1] - from[1];
      if (!dx && !dy) return;
      const midLat = ((from[1] + to[1]) / 2) * Math.PI / 180;
      const goc = (Math.atan2(dx * Math.cos(midLat), dy) * 180) / Math.PI;   // hướng bay, độ, tính từ hướng Bắc
      const p0: [number, number] = [from[0] + dx * 0.14, from[1] + dy * 0.14];
      const p1: [number, number] = [from[0] + dx * 0.86, from[1] + dy * 0.86];
      const dau: [number, number] = [from[0] + dx * 0.93, from[1] + dy * 0.93];
      const d = a.dist && cen ? '  ' + fmtDist(haversine(cen, to)) : '';
      feats.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [p0, p1] }, properties: { col, dash: kieu === 'dutdoan' ? 1 : 0, sang: kieu === 'sang' ? 1 : 0 } });
      const co = a.icon && a.icon !== 'none' ? 1 : 0;
      feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: dau }, properties: { kind: 'head', head: ensureArrowHead(col), rot: goc, col, tcol: a.tcol || '#ff2d95', label: chuBanDo((a.label || '') + d), co, ico: co ? ensureArrowIcon(col, a.icon as string) : '' } });
    });
    mapRef.current?.getSource('arrow')?.setData(fc(feats));
  }
  useEffect(() => { drawArrows(); }, [ready, mtVer, geomVer]);   // geomVer: sửa lô đất thì mũi tên bắn lại từ tâm lô mới
  // Xoá MỘT mũi tên.
  function xoaMuiTen(id: string) {
    arrows.current = arrows.current.filter((a) => a.id !== id);
    drawArrows(); setMtVer((v) => v + 1); bumpGeom();
    toast.success('Đã xoá mũi tên. Nhấn Ctrl+Z nếu lỡ tay.');
  }
  function xoaHetMuiTen() {
    if (!arrows.current.length) { toast.info('Chưa bắn mũi tên nào'); return; }
    if (!confirm('Xoá hết ' + arrows.current.length + ' mũi tên? (Lô đất, ghim, tuyến vẫn giữ nguyên)')) return;
    arrows.current = []; drawArrows(); setMtVer((v) => v + 1); bumpGeom(); toast.success('Đã xoá hết mũi tên');
  }
  // Vẽ VÙNG HÀNH CHÍNH đã khoanh (xã/phường/tỉnh).
  function drawZones() {
    mapRef.current?.getSource('zone')?.setData(fc(zones.current.map((z) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: z.rings }, properties: { name: chuBanDo(z.name) } }))));
  }
  useEffect(() => { const m = mapRef.current; if (m?.getLayer?.('zone-fill')) m.setPaintProperty('zone-fill', 'fill-opacity', zoneOpacity); }, [zoneOpacity, ready]);
  useEffect(() => { const m = mapRef.current; if (!m?.getLayer?.('route-line')) return; try { m.setPaintProperty('route-line', 'line-color', routeColor); m.setPaintProperty('routehead-dot', 'circle-stroke-color', routeColor); } catch { /* ignore */ } }, [routeColor, ready]);
  // ẢNH TRONG LÔ: dán ảnh phối cảnh/mặt bằng đè lên đúng khu vực lô đất (khung bao quanh lô).
  function parcelQuad(): any {
    const c = parcel.current; if (c.length < 3) return null;
    const lo = c.reduce((a, p) => [Math.min(a[0], p[0]), Math.min(a[1], p[1])], [Infinity, Infinity]);
    const hi = c.reduce((a, p) => [Math.max(a[0], p[0]), Math.max(a[1], p[1])], [-Infinity, -Infinity]);
    return [[lo[0], hi[1]], [hi[0], hi[1]], [hi[0], lo[1]], [lo[0], lo[1]]]; // trên-trái, trên-phải, dưới-phải, dưới-trái
  }
  function applyParcelPhoto() {
    const m = mapRef.current; if (!m || !m.isStyleLoaded?.()) return;
    try {
      const quad = parcelQuad();
      if (!parcelPhoto || !quad) { if (m.getLayer('parcelimg')) m.removeLayer('parcelimg'); if (m.getSource('parcelimg')) m.removeSource('parcelimg'); return; }
      const src: any = m.getSource('parcelimg');
      if (src) { src.updateImage({ url: parcelPhoto, coordinates: quad }); }
      else {
        m.addSource('parcelimg', { type: 'image', url: parcelPhoto, coordinates: quad } as any);
        m.addLayer({ id: 'parcelimg', type: 'raster', source: 'parcelimg', paint: { 'raster-opacity': photoOpacity, 'raster-fade-duration': 0 } }, m.getLayer('parcel-fill') ? 'parcel-fill' : undefined);
      }
      if (m.getLayer('parcelimg')) m.setPaintProperty('parcelimg', 'raster-opacity', photoOpacity);
    } catch (e) { console.warn('[anh trong lo]', e); }
  }
  useEffect(() => { applyParcelPhoto(); }, [parcelPhoto, photoOpacity, geomVer, ready]);
  useEffect(() => { const m = mapRef.current; if (!m?.getLayer?.('parcel-3d')) return; m.setLayoutProperty('parcel-3d', 'visibility', parcel3d ? 'visible' : 'none'); try { m.setPaintProperty('parcel-3d', 'fill-extrusion-color', parcelColor); } catch { /* ignore */ } }, [parcel3d, parcelColor, ready]);
  useEffect(() => { const m = mapRef.current; if (!m?.getLayer?.('spark-dot')) return; const v = parcelSpark ? 'visible' : 'none'; m.setLayoutProperty('spark-dot', 'visibility', v); m.setLayoutProperty('spark-halo', 'visibility', v); }, [parcelSpark, ready]);
  function drawVerts() {
    const show = modeRef.current === 'edit';
    const feats = !show ? [] : [
      ...parcel.current.map((p, i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: { kind: 'parcel', idx: i } })),
      ...route.current.map((p, i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: { kind: 'route', idx: i } })),
    ];
    mapRef.current?.getSource('verts')?.setData(fc(feats));
  }

  function reset() { parcel.current = []; route.current = []; markers.current = []; radii.current = []; dists.current = []; callouts.current = []; arrows.current = []; zones.current = []; distPending.current = null; dirPending.current = null; drawParcel(); drawRoute([]); drawMarkers(); drawRadii(); drawDists(); drawCallouts(); drawArrows(); drawZones(); setSelCallout(null); setCalloutVer((v) => v + 1); setMtVer((v) => v + 1); setMode('none'); bumpGeom(); }

  // Nhập KML/GeoJSON → tự khoanh lô (polygon) + vẽ tuyến (line) từ dữ liệu chuẩn, khỏi vẽ tay.
  async function importGeo(file: File) {
    try {
      let text: string;
      if (/\.kmz$/i.test(file.name)) { // KMZ = zip chứa doc.kml → giải nén lấy KML
        const mod: any = await import('jszip'); const JSZip = mod.default || mod;
        const zip = await JSZip.loadAsync(await file.arrayBuffer());
        const kmlName = Object.keys(zip.files).find((n) => /\.kml$/i.test(n));
        if (!kmlName) { toast.error('KMZ không có file KML'); return; }
        text = await zip.files[kmlName].async('string');
      } else { text = await file.text(); }
      const polys: [number, number][][] = [], lines: [number, number][][] = [];
      const isKml = /\.kml$/i.test(file.name) || text.trim().startsWith('<');
      if (isKml) {
        const doc = new DOMParser().parseFromString(text, 'application/xml');
        const parse = (s: string) => s.trim().split(/\s+/).map((p) => { const a = p.split(',').map(Number); return [a[0], a[1]] as [number, number]; }).filter((c) => isFinite(c[0]) && isFinite(c[1]));
        doc.querySelectorAll('Polygon').forEach((pg) => { const c = pg.querySelector('outerBoundaryIs LinearRing coordinates') || pg.querySelector('coordinates'); if (c?.textContent) polys.push(parse(c.textContent)); });
        doc.querySelectorAll('LineString').forEach((ls) => { const c = ls.querySelector('coordinates'); if (c?.textContent) lines.push(parse(c.textContent)); });
      } else {
        const gj = JSON.parse(text);
        const feats = gj.type === 'FeatureCollection' ? gj.features : gj.type === 'Feature' ? [gj] : [{ geometry: gj }];
        for (const f of feats || []) {
          const g = f?.geometry; if (!g) continue;
          if (g.type === 'Polygon') polys.push(g.coordinates[0]);
          else if (g.type === 'MultiPolygon') polys.push(g.coordinates[0][0]);
          else if (g.type === 'LineString') lines.push(g.coordinates);
          else if (g.type === 'MultiLineString') lines.push(g.coordinates[0]);
        }
      }
      if (!polys.length && !lines.length) { toast.error('File không có vùng/đường hợp lệ'); return; }
      if (polys.length) {
        let ring = polys[0].map((c) => [c[0], c[1]] as [number, number]);
        if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring = ring.slice(0, -1);
        parcel.current = ring; drawParcel();
      }
      if (lines.length) { route.current = lines[0].map((c) => [c[0], c[1]] as [number, number]); drawRoute(tuyenVe()); }
      const b = bounds(); if (b) mapRef.current?.fitBounds(b, { padding: 120, duration: 800, maxZoom: 18, pitch: 0, bearing: 0 });
      bumpGeom();
      toast.success(`Đã nhập ${polys.length ? polys.length + ' lô ' : ''}${lines.length ? lines.length + ' tuyến' : ''}`.trim());
    } catch (e: any) { toast.error('Không đọc được file: ' + (e?.message || '')); }
  }

  async function search() {
    if (!q.trim()) return;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q + ', Khánh Hòa, Việt Nam')}`);
      const j = await r.json();
      if (j?.[0]) mapRef.current?.flyTo({ center: [Number(j[0].lon), Number(j[0].lat)], zoom: 17, duration: 1500 });
      else toast.info('Không tìm thấy địa điểm');
    } catch { toast.error('Lỗi tìm kiếm'); }
  }

  // TÌM VÙNG: gõ tên xã/phường/huyện/tỉnh → lấy ĐÚNG ranh giới hành chính từ OpenStreetMap rồi khoanh lên bản đồ.
  // Không cần gõ chữ "Xã"/"Phường", không dấu vẫn tìm được (OSM tự khớp).
  async function searchZone() {
    const kw = q.trim(); if (!kw) { toast.info('Gõ tên xã/phường vào ô tìm kiếm trước'); return; }
    if (zoneBusy) return; setZoneBusy(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&limit=5&q=${encodeURIComponent(kw + ', Khánh Hòa, Việt Nam')}`;
      const j = await (await fetch(url)).json();
      const hit = (j || []).find((x: any) => x?.geojson && /Polygon/i.test(x.geojson.type));
      if (!hit) { toast.info('Không tìm thấy ranh giới cho "' + kw + '" — thử gõ đầy đủ hơn (vd: Cam Đức, Cam Lâm)'); return; }
      const g = hit.geojson;
      const rings: [number, number][][] = g.type === 'Polygon' ? g.coordinates : g.coordinates.flat(); // MultiPolygon → gộp các vòng
      const nm = String(hit.display_name || kw).split(',')[0].trim();
      zones.current = [...zones.current, { name: nm, rings }];
      drawZones(); bumpGeom();
      const b = bounds(); if (b) mapRef.current?.fitBounds(b, { padding: 90, duration: 900, pitch: 0, bearing: 0, maxZoom: 17 });
      toast.success('Đã khoanh ranh giới: ' + nm);
    } catch { toast.error('Không lấy được ranh giới (mạng chậm?) — thử lại sau vài giây'); }
    finally { setZoneBusy(false); }
  }
  // NHẬP HÀNG LOẠT GHIM từ Excel/CSV. Mỗi dòng: Tên, vĩ độ, kinh độ  (ngăn bằng dấu phẩy, chấm phẩy hoặc Tab).
  function importPins(text: string) {
    const rows = (text || '').split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
    const out: Marker[] = []; let bad = 0;
    for (const r of rows) {
      const cols = r.split(/	|;|,(?=\s*-?\d)/).map((c) => c.trim());
      if (cols.length < 3) { const m = r.match(/^(.*?)[,;\t]\s*(-?\d+[.,]?\d*)\s*[,;\t]\s*(-?\d+[.,]?\d*)/); if (!m) { bad++; continue; } cols.length = 0; cols.push(m[1], m[2], m[3]); }
      const name = cols[0].replace(/^["']|["']$/g, '');
      let a = Number(String(cols[1]).replace(',', '.')), b = Number(String(cols[2]).replace(',', '.'));
      if (!isFinite(a) || !isFinite(b)) { bad++; continue; }
      // Tự đoán đâu là vĩ độ, đâu là kinh độ (Việt Nam: vĩ độ 8–24, kinh độ 102–110)
      let lat = a, lng = b;
      if (Math.abs(a) > 90 || (a > 100 && b < 30)) { lat = b; lng = a; }
      if (lat < 5 || lat > 26 || lng < 100 || lng > 112) { bad++; continue; }
      const low = name.toLowerCase();
      const guess = pickIcon(low);
      out.push({ lng, lat, label: name || 'Tiện ích', kind: 'pin', shape: pinRef.current.shape, color: pinRef.current.color, icon: guess, anim: pinAnimRef.current, rfx: radarFxRef.current, minz: pinMinZRef.current });
    }
    if (!out.length) { toast.error('Không đọc được dòng nào. Mỗi dòng cần: Tên, vĩ độ, kinh độ'); return; }
    markers.current = [...markers.current, ...out]; drawMarkers(); bumpGeom();
    const b = bounds(); if (b) mapRef.current?.fitBounds(b, { padding: 90, duration: 800, maxZoom: 17 });
    toast.success(`Đã cắm ${out.length} ghim${bad ? ` · bỏ qua ${bad} dòng không hợp lệ` : ''}`);
  }
  function clearZones() { zones.current = []; drawZones(); bumpGeom(); }

  // CHỈ ĐƯỜNG A→B theo ĐƯỜNG BỘ THẬT (dịch vụ OSRM của OpenStreetMap) → thành tuyến chạy động trong video.
  async function routeAB(a: [number, number], b: [number, number]) {
    if (dirBusy) return; setDirBusy(true);
    try {
      // Gọi phần chỉ đường của chính web mình: trả TỐI ĐA 3 PHƯƠNG ÁN, có nhớ tạm 10 phút,
      // có máy dự phòng khi máy chính bận, và tự dò thêm lối vòng khi vùng quê chỉ ra 1 đường.
      const r = await timDuong({ lng: a[0], lat: a[1] }, { lng: b[0], lat: b[1] }, 'car');
      const ds = r.tuyen || [];
      if (!ds.length) { toast.error('Không tìm được đường đi giữa 2 điểm này'); return; }
      tuyenCu.current = route.current;          // nhớ tuyến cũ, bấm Huỷ thì trả lại nguyên trạng
      setDsTuyen(ds); setTuyenChon(0);
      apTuyen(ds, 0);
      setMode('none');
      toast.success(ds.length > 1 ? `Tìm được ${ds.length} lối đi — chọn lối ưng ý ở bảng bên trái` : 'Đã lấy tuyến đường thật');
    } catch { toast.error('Dịch vụ chỉ đường bận — thử lại, hoặc vẽ tuyến bằng tay'); }
    finally { setDirBusy(false); }
  }
  // Đưa một phương án lên bản đồ để xem thử (chưa chốt).
  function apTuyen(ds: Tuyen[], i: number) {
    const co = ds[i]?.hinh?.coordinates as number[][] | undefined;
    if (!co?.length) return;
    route.current = co.map((c) => [c[0], c[1]] as [number, number]);
    drawRoute(tuyenVe()); bumpGeom();
    veLoiPhu(ds, i);
    const bb = bounds(); if (bb) mapRef.current?.fitBounds(bb, { padding: 100, duration: 700, pitch: 0, bearing: 0, maxZoom: 17 });
  }

  // ══ CÁC LỐI KHÔNG ĐƯỢC CHỌN — vẽ XÁM MỜ, bấm vào là đổi sang lối đó (y như Google Maps) ══
  // Lối đang chọn đã là tuyến chính (màu của bảng Tuyến đường), nên ở đây chỉ vẽ mấy lối còn lại.
  const dsTuyenRef = useRef<Tuyen[] | null>(null);
  const nhanLoiRef = useRef<any[]>([]);
  function veLoiPhu(ds: Tuyen[] | null, chon: number) {
    const m = mapRef.current; if (!m) return;
    dsTuyenRef.current = ds;
    const feats = (ds || []).map((t, i) => ({ type: 'Feature', properties: { i }, geometry: t.hinh } as any)).filter((f: any) => f.properties.i !== chon);
    const data = { type: 'FeatureCollection', features: feats } as any;
    if (!m.getSource('loiphu')) {
      try {
        m.addSource('loiphu', { type: 'geojson', data });
        const truoc = m.getLayer('route-glow2') ? 'route-glow2' : undefined;   // nằm DƯỚI tuyến chính
        m.addLayer({ id: 'loiphu-vien', type: 'line', source: 'loiphu', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.75 } } as any, truoc);
        m.addLayer({ id: 'loiphu-net', type: 'line', source: 'loiphu', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#9aa0a6', 'line-width': 4.5 } } as any, truoc);
        const bam = (e: any) => {
          const f = e.features?.[0]; if (!f) return;
          const i = Number(f.properties?.i);
          const cur = dsTuyenRef.current; if (!cur) return;
          setTuyenChon(i); apTuyen(cur, i);
        };
        for (const id of ['loiphu-vien', 'loiphu-net']) {
          m.on('click', id, bam);
          m.on('mouseenter', id, () => { m.getCanvas().style.cursor = 'pointer'; });
          m.on('mouseleave', id, () => { m.getCanvas().style.cursor = ''; });
        }
      } catch { /* ignore */ }
    } else (m.getSource('loiphu') as any).setData(data);

    // Nhãn "13 phút" trên từng lối — bấm nhãn cũng đổi được lối (dễ trúng hơn nét đường).
    nhanLoiRef.current.forEach((x) => x.remove()); nhanLoiRef.current = [];
    for (const [i, t] of (ds || []).entries()) {
      const c = (t.hinh?.coordinates || []) as [number, number][];
      if (c.length < 2) continue;
      let tong = 0; const kc = (a: number[], b: number[]) => Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let k = 1; k < c.length; k++) tong += kc(c[k - 1], c[k]);
      let di = 0, giua = c[Math.floor(c.length / 2)];
      for (let k = 1; k < c.length; k++) { di += kc(c[k - 1], c[k]); if (di >= tong / 2) { giua = c[k]; break; } }
      const el = document.createElement('div');
      el.style.cssText = `font:700 11px/1 system-ui,Arial,sans-serif;padding:4px 8px;border-radius:999px;white-space:nowrap;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.4);${i === chon ? 'background:#38bdf8;color:#08243c;' : 'background:#fff;color:#3c4043;'}`;
      el.textContent = docThoiGian(t.thoiGian);
      el.addEventListener('click', (ev) => { ev.stopPropagation(); const cur = dsTuyenRef.current; if (cur) { setTuyenChon(i); apTuyen(cur, i); } });
      nhanLoiRef.current.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(giua).addTo(m));
    }
    try { m.triggerRepaint(); } catch { /* ignore */ }
  }
  // Đóng bảng chọn lối (chốt hoặc huỷ) → xoá hết lối xám và nhãn, không để lọt vào video.
  function xoaLoiPhu() {
    const m = mapRef.current;
    nhanLoiRef.current.forEach((x) => x.remove()); nhanLoiRef.current = [];
    dsTuyenRef.current = null;
    try { (m?.getSource('loiphu') as any)?.setData({ type: 'FeatureCollection', features: [] }); } catch { /* ignore */ }
  }

  // ── BẢNG ĐỘ DÀI CỘNG DỒN của tuyến — tính MỘT LẦN rồi nhớ lại ──
  // Trước đây mỗi lần hỏi "điểm ở 37% tuyến nằm đâu" là máy phải cộng lại độ dài của CẢ TUYẾN.
  // Một khung hình hỏi hàng chục lần (camera, hướng, kế hoạch xoay, chấm sáng…), tuyến vài trăm điểm
  // là mỗi giây cộng cả triệu phép — máy nghẹt, hình giật. Có bảng này thì mỗi lần hỏi chỉ mất
  // vài bước tìm nhị phân, gần như không tốn gì.
  // ══ BO TRÒN GÓC TUYẾN — BO THEO BÁN KÍNH CỐ ĐỊNH (mét), KHÔNG theo tỉ lệ đoạn ══
  // Lần trước dùng Chaikin (cắt ở 1/4 và 3/4 mỗi đoạn) là SAI: đoạn đường dài 100 m thì nó cắt vào
  // tận 25 m, đường lượn phình ra khỏi lòng đường, băng ngang qua nhà dân.
  // Cách đúng — giống hệt cách người ta bo vỉa hè ở ngã tư: giữ NGUYÊN các đoạn thẳng, chỉ bo một
  // cung tròn bán kính vài mét ĐÚNG TẠI đỉnh góc. Bán kính còn bị chặn không quá 35% đoạn ngắn hơn,
  // nên đoạn nào ngắn quá thì tự bo ít lại, không bao giờ ăn lẹm sang đoạn bên cạnh.
  const R_BO_GOC = 4;   // mét — bo hẹp thôi: cốt làm mất góc nhọn chứ KHÔNG được lệch khỏi lòng đường
  const dangChayRef = useRef(false);   // true khi đang xem thử hoặc đang quay
  const tuyenMuotRef = useRef<{ src: any; lo: any; noi: boolean; pts: [number, number][] } | null>(null);
  function tuyenVe(): [number, number][] {
    let c = route.current;
    const lo = parcel.current;
    const noi = dangChayRef.current;              // chỉ nối đoạn từ lô KHI ĐANG CHẠY
    const cu = tuyenMuotRef.current;
    if (cu && cu.src === c && cu.lo === lo && cu.noi === noi) return cu.pts;
    // ── ĐOẠN CHẠY RA TỪ THỬA ĐẤT — CHỈ CÓ LÚC VIDEO CHẠY ──
    // Khi video chạy, đường đi nên BẮT ĐẦU TỪ MẢNH ĐẤT: hiện một chấm nhỏ ngay giữa thửa rồi bò dần
    // ra tới đường. Nhưng lúc đang dựng thì KHÔNG được vẽ sẵn đoạn này — nó nằm chình ình cắt ngang
    // lô, nhìn rất vướng (đúng cái vệt màu đang bị kêu). Nên chỉ nối khi đang xem thử / đang quay.
    if (noi && lo.length >= 3 && c.length >= 2) {
      const tam: [number, number] = [lo.reduce((a, q) => a + q[0], 0) / lo.length, lo.reduce((a, q) => a + q[1], 0) / lo.length];
      if (haversine(tam, c[0]) > 5) c = [tam, ...c];
    }
    if (c.length < 3 || c.length > 900) { tuyenMuotRef.current = { src: route.current, lo, noi, pts: c }; return c; }
    const ra: [number, number][] = [c[0]];
    for (let i = 1; i < c.length - 1; i++) {
      const p0 = c[i - 1], p1 = c[i], p2 = c[i + 1];
      const d1 = haversine(p0, p1), d2 = haversine(p1, p2);
      // Góc đổi hướng tại đỉnh này bao nhiêu độ — gần thẳng thì khỏi bo cho đỡ tốn điểm.
      const g1 = Math.atan2(p1[0] - p0[0], p1[1] - p0[1]), g2 = Math.atan2(p2[0] - p1[0], p2[1] - p1[1]);
      let dg = (g2 - g1) * 180 / Math.PI; while (dg > 180) dg -= 360; while (dg < -180) dg += 360;
      const r = Math.min(R_BO_GOC, d1 * 0.25, d2 * 0.25);   // không bao giờ ăn quá 1/4 đoạn ngắn hơn
      if (Math.abs(dg) < 8 || r < 0.6 || d1 < 1 || d2 < 1) { ra.push(p1); continue; }
      const t1 = r / d1, t2 = r / d2;
      const a: [number, number] = [p1[0] + (p0[0] - p1[0]) * t1, p1[1] + (p0[1] - p1[1]) * t1];
      const b: [number, number] = [p1[0] + (p2[0] - p1[0]) * t2, p1[1] + (p2[1] - p1[1]) * t2];
      ra.push(a);
      const N = Math.abs(dg) > 60 ? 9 : 6;                       // chia thành nhiều đoạn RẤT ngắn: cung tròn mượt mà vẫn bám sát đường
      for (let k = 1; k < N; k++) {
        const t = k / N, u = 1 - t;
        ra.push([u * u * a[0] + 2 * u * t * p1[0] + t * t * b[0], u * u * a[1] + 2 * u * t * p1[1] + t * t * b[1]]);
      }
      ra.push(b);
    }
    ra.push(c[c.length - 1]);
    tuyenMuotRef.current = { src: route.current, lo, noi, pts: ra };
    return ra;
  }
  const bangTuyen = useRef<{ src: any; cong: number[]; tong: number } | null>(null);
  function bangDaiTuyen() {
    const c = tuyenVe();
    const cu = bangTuyen.current;
    if (cu && cu.src === c) return cu;
    const cong: number[] = [0]; let s = 0;
    for (let i = 1; i < c.length; i++) { s += haversine(c[i - 1], c[i]); cong.push(s); }   // tính bằng MÉT thật
    const o = { src: c, cong, tong: s };
    bangTuyen.current = o; return o;
  }
  // Tổng chiều dài tuyến (mét) và điểm nằm cách đầu tuyến đúng m mét.
  // Mọi tính toán bay drone đều quy về MÉT — nhờ vậy tuyến 300 m hay 30 km đều cho cùng một cảm giác.
  function daiTuyenM(): number { return bangDaiTuyen().tong; }
  function diemTaiMet(m: number): [number, number] {
    const tong = daiTuyenM();
    return diemTaiTienDo(tong ? m / tong : 0);
  }
  // Bản ĐẢO NGƯỢC của tuyến, cũng nhớ lại — chạy ngược mà mỗi khung hình đảo lại một mảng mới
  // thì vừa tốn vừa làm hỏng bộ nhớ đệm bảng độ dài ở trên.
  const tuyenDao = useRef<{ src: any; rev: [number, number][] } | null>(null);
  function tuyenNguoc(): [number, number][] {
    const c = tuyenVe();
    if (tuyenDao.current && tuyenDao.current.src === c) return tuyenDao.current.rev;
    const rev = [...c].reverse() as [number, number][];
    tuyenDao.current = { src: c, rev }; return rev;
  }
  // Điểm nằm ở tiến độ p (0→1) trên tuyến — tìm nhị phân, KHÔNG dựng lại mảng nào.
  function diemTaiTienDo(p: number): [number, number] {
    const c = tuyenVe();
    if (c.length < 2) return (c[0] || [0, 0]) as [number, number];
    const { cong, tong } = bangDaiTuyen();
    if (!tong) return c[0];
    const d = Math.max(0, Math.min(1, p)) * tong;
    let lo = 0, hi = cong.length - 1;
    while (lo < hi - 1) { const giua = (lo + hi) >> 1; if (cong[giua] <= d) lo = giua; else hi = giua; }
    const dai = cong[hi] - cong[lo] || 1e-9; const f = (d - cong[lo]) / dai;
    return [c[lo][0] + (c[hi][0] - c[lo][0]) * f, c[lo][1] + (c[hi][1] - c[lo][1]) * f];
  }
  // ── Nội suy tuyến theo tiến độ p∈[0,1] để vẽ "chạy dần" ──
  function routeAt(p: number): [number, number][] {
    const c = tuyenVe(); if (c.length < 2) return c;
    const { cong, tong } = bangDaiTuyen();
    if (!tong) return [c[0]];
    const target = tong * Math.max(0, Math.min(1, p));
    const out: [number, number][] = [c[0]];
    for (let i = 1; i < c.length; i++) {
      if (cong[i] >= target) { const dai = cong[i] - cong[i - 1] || 1e-9; const t = (target - cong[i - 1]) / dai; out.push([c[i - 1][0] + (c[i][0] - c[i - 1][0]) * t, c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t]); break; }
      out.push(c[i]);
    }
    return out;
  }

  // Vị trí 1 điểm trên tuyến theo tiến độ p (dùng cho camera bám tuyến).
  function routePos(p: number): [number, number] { return diemTaiTienDo(p); }
  // HƯỚNG ĐI trên tuyến (độ, 0 = Bắc) — dùng để xoay camera theo chiều chạy.
  // Trước đây chỉ lấy hướng của ĐOẠN ĐANG ĐỨNG, nên tới ngã rẽ vuông góc là góc nhảy cái rụp 90°
  // → camera quăng một phát, xem chóng mặt. Giờ lấy TRUNG BÌNH CÓ TRỌNG SỐ của nhiều mẫu PHÍA TRƯỚC:
  // người lái xe nhìn xa chứ không dán mắt vào mũi xe, nên vào cua là bắt đầu xoay từ trước và xoay đều.
  function routeHeading(p: number, nhinTruoc = 0.05): number {
    const n = 6, mau: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const t0 = p + (nhinTruoc * i) / n, t1 = t0 + nhinTruoc / n + 0.004;
      const a = routePos(Math.max(0, Math.min(1, t0))), b = routePos(Math.max(0, Math.min(1, t1)));
      const lat = ((a[1] + b[1]) / 2) * Math.PI / 180, dx = (b[0] - a[0]) * Math.cos(lat), dy = b[1] - a[1];
      if (Math.abs(dx) < 1e-12 && Math.abs(dy) < 1e-12) continue;
      mau.push([Math.atan2(dx, dy) * 180 / Math.PI, 1 - i / (n + 2)]);          // mẫu gần hơn thì nặng ký hơn
    }
    if (!mau.length) { const a = routePos(Math.max(0, p - 0.02)), b = routePos(Math.min(1, p + 0.02)); const lat = ((a[1] + b[1]) / 2) * Math.PI / 180; return Math.atan2((b[0] - a[0]) * Math.cos(lat), b[1] - a[1]) * 180 / Math.PI; }
    // Cộng góc phải cộng bằng VECTƠ (sin/cos) — cộng thẳng số độ sẽ sai bét khi góc vượt qua mốc ±180°.
    let sx = 0, sy = 0;
    mau.forEach(([g, w]) => { sx += Math.sin((g * Math.PI) / 180) * w; sy += Math.cos((g * Math.PI) / 180) * w; });
    return (Math.atan2(sx, sy) * 180) / Math.PI;
  }
  // Độ GẮT của khúc cua tại tiến độ p (độ) — so hướng nhìn xa với hướng nhìn gần.
  function doCua(p: number, nhinTruoc: number): number {
    let d = routeHeading(p, nhinTruoc) - routeHeading(p, nhinTruoc * 0.34);
    while (d > 180) d -= 360; while (d < -180) d += 360;
    return Math.abs(d);
  }

  function bounds(): any {
    const all = [...parcel.current, ...route.current, ...markers.current.map((mk) => [mk.lng, mk.lat] as [number, number]), ...radii.current.flatMap((c) => [[c.lng + c.r / (111320 * Math.cos((c.lat * Math.PI) / 180) || 1e-6), c.lat], [c.lng - c.r / (111320 * Math.cos((c.lat * Math.PI) / 180) || 1e-6), c.lat], [c.lng, c.lat + c.r / 111320], [c.lng, c.lat - c.r / 111320]] as [number, number][]), ...dists.current.flatMap((d) => [d.a, d.b]), ...callouts.current.flatMap((c) => [[c.lng, c.lat], [c.lng + c.dx, c.lat + c.dy]] as [number, number][]), ...arrows.current.map((a) => [a.lng, a.lat] as [number, number]), ...zones.current.flatMap((z) => z.rings.flat() as [number, number][])]; if (!all.length) return null;
    const b = new maplibregl.LngLatBounds(all[0] as any, all[0] as any); all.forEach((p) => b.extend(p as any)); return b;
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Chờ bản đồ tải xong tile (sự kiện 'idle') — có timeout để không kẹt.
  /**
   * CHỜ KHUNG HÌNH VẼ XONG — dùng cho chế độ render từng khung.
   *
   * ⚠️ VÌ SAO KHÔNG DÙNG SỰ KIỆN 'idle' CỦA BẢN ĐỒ:
   * 'idle' chỉ báo khi bản đồ RẢNH HOÀN TOÀN — không tải gì, không có hiệu ứng nào đang chạy.
   * Mà video của mình LÚC NÀO cũng có hiệu ứng chạy (chấm sáng nhấp nháy, lô đất thở, sóng radar…),
   * nên bản đồ KHÔNG BAO GIỜ rảnh → mỗi khung phải chờ hết giờ mới thôi. Đó là lý do một khung ngốn
   * 2 giây, cả video 2 tiếng đồng hồ.
   *
   * Cái thật sự cần chờ chỉ là: ẢNH BẢN ĐỒ ĐÃ TẢI VỀ ĐỦ CHƯA. Hỏi thẳng bản đồ câu đó
   * (areTilesLoaded) sau mỗi lần nó vẽ. Ảnh đã nạp sẵn thì chỉ mất 1–2 nhịp vẽ ≈ vài chục phần nghìn
   * giây, nhanh gấp mấy chục lần cách cũ.
   */
  // Thống kê chất lượng của lần render này — cuối buổi in ra để biết video có chỗ nào chưa hoàn hảo.
  const thongKeKhung = useRef({ tong: 0, choLau: 0, chuaXong: 0, conTrong: 0, nuiTre: 0 });

  /**
   * CHỜ TỚI KHI KHUNG HÌNH THẬT SỰ XONG.
   * Ba điều kiện phải đủ cả ba thì mới chụp:
   *   1. Bản đồ nói đã tải đủ ảnh.
   *   2. Hai lượt vẽ liên tiếp cho ra ảnh GIỐNG NHAU (cảnh đã đứng yên, không còn gì đang hiện dần).
   *   3. Trong khung không còn mảng nền trống lớn (chỗ ảnh chưa về).
   * Thiếu điều nào thì vẽ lại và soi tiếp, tới khi hết giờ thì đành chụp (và ghi vào sổ để báo lại).
   */
  /**
   * ══ CHỜ NÚI DỰNG XONG ══
   *
   * Chỗ giật nặng nhất là mấy cảnh đồi núi, và đây là lý do:
   * Bản đồ dựng núi bằng "ảnh độ cao" tải riêng. Ảnh đó về CHẬM hơn ảnh vệ tinh. Chưa có nó thì
   * bản đồ tạm coi mặt đất PHẲNG — camera đứng ở cao độ 0. Ảnh về rồi, mặt đất nhô lên, camera bị
   * đẩy theo → khung sau lệch hẳn so với khung trước. Bay tiếp sang vùng chưa có ảnh độ cao thì
   * lại tụt xuống. Xem lại thấy đúng như anh tả: **một khung nhảy qua nhảy lại**.
   *
   * Hai câu hỏi cũ ("ảnh tải đủ chưa", "kiểu vẽ xong chưa") KHÔNG bắt được chuyện này — chúng chỉ
   * tính ảnh vệ tinh, không tính ảnh độ cao.
   *
   * Nên hỏi thêm hai câu nữa, và đây mới là hai câu đúng:
   *   1. Kho ảnh độ cao đã tải xong chưa?
   *   2. Cao độ mặt đất ngay dưới camera có còn nhảy không? Đứng yên hai lượt liền mới tin.
   * Chỉ khi cả hai đều xong mới chụp khung đó.
   */
  async function choNuiXong(map: any, toiDa = 3000): Promise<boolean> {
    let coNui = false;
    try { coNui = !!(map.getTerrain?.() || (map as any).terrain); } catch { /* bản đồ không có núi */ }
    if (!coNui) return true;
    // Kho ảnh độ cao nằm ở vài chỗ khác nhau tuỳ phiên bản bản đồ — thử lần lượt, không thấy thì bỏ qua.
    const anhCaoDaVe = (): boolean => {
      try {
        // Kho ảnh độ cao nằm sâu HAI tầng: phần dựng núi → kho ảnh độ cao → kho ảnh gốc.
        const kho = (map as any).terrain?.sourceCache?.sourceCache || (map as any).style?.sourceCaches?.dem;
        if (kho && typeof kho.loaded === 'function') return kho.loaded();
      } catch { /* ignore */ }
      return true;
    };
    const caoDo = (): number | null => {
      try {
        const c = map.getCenter();
        const h = map.queryTerrainElevation?.([c.lng, c.lat]);
        return typeof h === 'number' && isFinite(h) ? h : null;
      } catch { return null; }
    };
    // Đo thật trên bản đồ mới thấy: câu "kho ảnh độ cao tải xong chưa" NHẤP NHÁY liên tục
    // true/false (bản đồ vừa vẽ vừa xin thêm ảnh). Tin mình nó thì lúc chờ hụt lúc chờ thừa.
    // Thứ đáng tin là CAO ĐỘ MẶT ĐẤT ngay dưới camera: nó chỉ đứng yên khi núi đã dựng đúng.
    // Nên lấy cao độ làm chính, câu hỏi kia chỉ để xác nhận thêm.
    const het = Date.now() + toiDa;
    let truoc: number | null = null, yen = 0, vong = 0;
    while (Date.now() < het) {
      const h = caoDo();
      // Lệch dưới 20cm coi như đứng yên — đủ chặt để bắt cú nhảy, đủ lỏng để không chờ vô ích.
      if (truoc !== null && h !== null && Math.abs(h - truoc) < 0.2) yen++; else yen = 0;
      truoc = h;
      if (h === null) return true;                 // bản đồ không trả cao độ → chẳng có gì để chờ
      if (yen >= 3 && anhCaoDaVe()) return true;   // đứng yên VÀ ảnh về đủ — chụp được rồi
      if (yen >= 8) return true;                   // đứng yên đã lâu mà câu kia cứ nhấp nháy → tin mắt
      // Giục vẽ thưa thôi: giục mỗi vòng chính là thứ làm câu hỏi trên nhấp nháy.
      if (vong % 3 === 0) { try { map.triggerRepaint(); } catch { /* ignore */ } }
      vong++;
      await nhip0();
    }
    // Hết giờ mà mặt đất vẫn còn nhấp nhô — ghi sổ để cuối buổi báo lại, đừng im lặng cho qua.
    thongKeKhung.current.nuiTre++;
    return false;
  }

  async function choKhungVeXong(map: any, toiDa = 2500): Promise<boolean> {
    const veNgay = () => { try { if (typeof map.redraw === 'function') map.redraw(); else map.triggerRepaint(); } catch { /* ignore */ } };
    const anhDu = () => { try { return map.areTilesLoaded?.() !== false; } catch { return true; } };
    const canvas: HTMLCanvasElement = map.getCanvas();
    const tk = thongKeKhung.current;
    const het = Date.now() + toiDa;
    let truoc: Uint8ClampedArray | null = null;
    let lanSoi = 0;
    // ══ CẢNH 3D PHẢI SOI KỸ HƠN ══
    // Mặt đất 3D dựng xong dần: lưới thô về trước, ảnh độ cao chi tiết về sau rồi núi mới đúng hình.
    // Mấy nhịp cuối cùng đó chỉ làm ảnh đổi RẤT ÍT — ngưỡng dùng cho cảnh phẳng không bắt được, nên
    // máy tưởng "xong rồi" và chụp sớm. Đang dựng núi thì siết ngưỡng lại và đòi đứng yên HAI LƯỢT
    // LIỀN mới tin là xong.
    const dangDungNui = !!dang3d.current;
    const nguongYen = dangDungNui ? 0.0015 : 0.004;
    const canYen = dangDungNui ? 2 : 1;
    let yenLienTiep = 0;
    while (Date.now() < het) {
      veNgay();
      await nhip0();
      lanSoi++;
      const vt = vanTayKhung(canvas);
      if (!vt) { if (anhDu() && lanSoi >= 2) return true; continue; }
      const trong = phanTrong(vt);
      const dungYen = truoc !== null && khacNhauBaoNhieu(truoc, vt) < nguongYen;
      yenLienTiep = dungYen ? yenLienTiep + 1 : 0;
      truoc = vt;
      // Đủ cả ba điều kiện → chụp. (Cho phép tối đa 1,5% khung là nền trống — mép màn hình lúc bay
      // cao rất khó phủ kín, đòi 0% thì khung nào cũng phải chờ hết giờ.)
      if (yenLienTiep >= canYen && anhDu() && trong < 0.015) {
        if (lanSoi > 6) tk.choLau++;
        return true;
      }
    }
    return false;   // hết giờ mà cảnh vẫn chưa đứng yên — người gọi quyết định chờ tiếp hay đành chịu
  }

  /**
   * ══ KHÔNG BAO GIỜ CHỤP MỘT KHUNG CÒN VẼ DỞ ══
   * Bản trước chờ tối đa 3 giây, không xong thì CỨ CHỤP. Cảnh 3D nặng nên nhiều khung liền nhau bị
   * chụp lúc hình còn y như cũ → xem lại thấy "đứng hình" mấy nhịp, rồi tới khi ảnh về thì hiện
   * đúng chỗ camera đã đi xa → "nhảy vọt". Đó chính là kiểu giật anh gặp.
   * Giờ chưa xong thì CHỜ TIẾP một đợt dài gấp ba. Dựng lâu thêm chút, đổi lấy video không giật —
   * đúng cách các phần mềm dựng phim làm: thà máy chậm, chứ khung hình thì không được sai.
   */
  async function choKhungThatXong(map: any, khungDau: boolean): Promise<void> {
    const tk = thongKeKhung.current; tk.tong++;
    // ══ HỎI BẢN ĐỒ, KHÔNG SOI ẢNH ══
    // Soi từng điểm ảnh phải kéo hình từ card đồ hoạ về máy hàng chục lần mỗi khung — chính là chỗ
    // ăn hết thời gian. Hỏi thẳng bản đồ "ảnh đủ chưa, vẽ xong chưa" gần như không tốn gì, nên trần
    // chờ hạ từ 3 giây xuống 0,9 giây mà vẫn chắc ăn.
    // Cách soi ảnh cũ vẫn giữ: mở trang kèm ?debugStability=1 là dùng lại để đối chứng khi nghi ngờ.
    if (!soiBangDiemAnh()) {
      const heSoM = sucMayRef.current?.muc === 'yeu' ? 2 : 1;
      const so: SoKhung = { choLau: 0, thieuAnh: 0 };
      await choMotKhung(map, so, (khungDau ? 2500 : 900) * heSoM, 2500 * heSoM);
      // Ảnh vệ tinh xong chưa đủ — cảnh núi còn phải chờ mặt đất nhô lên đúng hình đã.
      await choNuiXong(map, (khungDau ? 6000 : 3000) * heSoM);
      tk.choLau += so.choLau; tk.chuaXong += so.thieuAnh;
      return;
    }
    // Máy vẽ bằng phần mềm (không card đồ hoạ) chậm gấp mấy lần — cho nó gấp đôi thời gian, đừng vội
    // kết luận "chưa xong" rồi chụp bừa. Dựng lâu hơn không sao, video sai khung mới là hỏng.
    const heSo = sucMayRef.current?.muc === 'yeu' ? 2 : 1;
    await choNuiXong(map, (khungDau ? 6000 : 3000) * heSo);   // núi trước, rồi mới soi ảnh
    if (await choKhungVeXong(map, (khungDau ? 8000 : 3000) * heSo)) return;
    if (await choKhungVeXong(map, 9000 * heSo)) { tk.choLau++; return; }
    // Đợi cả 12 giây vẫn chưa xong (mạng hỏng, ảnh không về) — đành chụp, nhưng ghi sổ để cuối buổi báo.
    tk.chuaXong++;
    const vtCuoi = vanTayKhung(map.getCanvas());
    if (vtCuoi && phanTrong(vtCuoi) >= 0.015) tk.conTrong++;
  }
  function tilesIdle(map: any, timeout = 1500): Promise<void> {
    return new Promise((res) => { let done = false; const on = () => { if (!done) { done = true; map.off('idle', on); res(); } }; map.on('idle', on); setTimeout(() => { if (!done) { done = true; map.off('idle', on); res(); } }, timeout); });
  }
  // VÂN TAY của vùng cần nạp ảnh: đổi một trong mấy thứ này thì mới phải nạp lại.
  const daNapRef = useRef('');
  function vanTayVung(): string {
    const b = bounds(); const r = (n: number) => Math.round(n * 1000) / 1000;
    const bb = b ? [r(b.getWest()), r(b.getSouth()), r(b.getEast()), r(b.getNorth())].join(',') : 'trong';
    // Các kịch bản KHÔNG chạy tuyến dùng chung một bộ ảnh (chỉ khác góc bay, cùng vùng) → gộp làm một
    // để lúc "Xuất cả bộ" khỏi phải nạp lại 8 lần. Riêng mấy kiểu Dẫn đường mới cần bộ ảnh riêng vì bay sát đường.
    const ck = renderRef.current?.camKey || '';
    return [bb, base, laDanDuong(ck) ? ck : 'thuong', route.current.length, parcel.current.length, terrain3d ? 't' : '', hillshade ? 'h' : ''].join('|');
  }
  // "Làm nóng" tile TRƯỚC khi bay/quay: nạp sẵn tile toàn vùng + dọc tuyến (kịch bản Dẫn đường) để hết khoảng trắng.
  // CHỈ NẠP MỘT LẦN cho mỗi vùng + kiểu bay. Lần chạy sau, nếu không đổi lô/tuyến/nền/kiểu camera thì
  // bỏ qua hẳn bước này — ảnh đã nằm sẵn trong máy, khỏi phải ngồi đợi "Đang tải bản đồ…" mỗi lần.
  // ══════════════════════════════════════════════════════════════════════════════════════
  // 🌊 ĐÂY LÀ BIỂN THẬT HAY CHỈ LÀ CON SÔNG?
  // Thuật toán chọn cảnh biển chỉ nhìn HƯỚNG, nên gặp khúc đường chạy dọc con sông là nó cũng tưởng
  // biển rồi quay ra khoe — nhìn rất vô duyên. Cách phân biệt chắc ăn: đo ĐỘ CAO MẶT ĐẤT.
  // Mặt nước (biển, sông, hồ) đều ở độ cao 0, nhưng SÔNG THÌ HẸP — đi ra vài km là gặp đất liền cao lên;
  // còn BIỂN thì ra xa 8–10 km vẫn là nước. Nên lấy mẫu độ cao ở nhiều khoảng cách về phía biển:
  // gần hết đều ở mức 0 thì mới là biển thật.
  // Dữ liệu độ cao lấy từ bộ ảnh mở AWS Terrain (chính bộ đang dùng để đổ bóng đồi núi).
  // Hỏi máy chủ độ cao của MỘT LOẠT điểm cùng lúc (một lần gọi cho cả trăm điểm — nhanh gọn).
  const nhoCao = useRef<Map<string, number | null>>(new Map());
  async function docCaoNhieuDiem(dsDiem: [number, number][]): Promise<(number | null)[]> {
    const canHoi: [number, number][] = [];
    for (const d of dsDiem) {
      const k = d[0].toFixed(4) + ',' + d[1].toFixed(4);
      if (!nhoCao.current.has(k)) canHoi.push(d);
    }
    if (canHoi.length) {
      try {
        const q = canHoi.map((d) => d[0].toFixed(5) + ',' + d[1].toFixed(5)).join(';');
        const r = await api<{ cao: (number | null)[] }>('/do-cao?p=' + encodeURIComponent(q));
        canHoi.forEach((d, i2) => nhoCao.current.set(d[0].toFixed(4) + ',' + d[1].toFixed(4), r.cao?.[i2] ?? null));
      } catch {
        canHoi.forEach((d) => nhoCao.current.set(d[0].toFixed(4) + ',' + d[1].toFixed(4), null));
      }
    }
    return dsDiem.map((d) => nhoCao.current.get(d[0].toFixed(4) + ',' + d[1].toFixed(4)) ?? null);
  }

  /**
   * TỰ DÒ HƯỚNG BIỂN NGAY TẠI CHỖ ĐỨNG — không đoán mò theo hướng cố định nữa.
   * Làm hai vòng:
   *   Vòng 1 — đứng tại điểm trên tuyến, ngó ra 12 hướng, mỗi hướng đo độ cao mặt đất ở 10 mốc từ
   *            0,4 km tới 14 km. Hướng nào có mép nước trong vòng 2 km và nhìn thông ra tới 11 km
   *            thì giữ lại làm ứng viên.
   *   Vòng 2 — với từng ứng viên, XOÈ HÌNH QUẠT ba tia để xem vùng nước đó rộng hay hẹp. Biển thì mở
   *            toang, còn đầm/sông/cửa biển chỉ là dải nước hẹp — đây mới là chỗ phân biệt được.
   * Nhờ vậy vừa loại được đầm với sông, vừa không loại oan mấy khúc biển nằm chếch (bờ Khánh Hoà chạy
   * xiên, có chỗ biển ở hướng đông-nam chứ không phải chính đông).
   */
  async function doHuongBien(lng: number, lat: number): Promise<{ huong: number; xa: number; gan: number } | null> {
    const latR = (lat * Math.PI) / 180;
    // Có cả MỐC RẤT GẦN (0,4 → 1,4 km) để đo xem đường cách mép nước bao xa — "đường sát biển" theo
    // đúng nghĩa là chỉ cách bờ chừng 1 km, chứ đường cách biển 5–10 km thì quay ra chỉ thấy đồng ruộng.
    const moc = [0.4, 0.7, 1, 1.4, 2, 3, 5, 8, 11, 14];
    const huongs: number[] = [];
    for (let h = 0; h < 360; h += 30) huongs.push(h);
    const diem: [number, number][] = [];
    for (const h of huongs) {
      const r = (h * Math.PI) / 180;
      for (const km of moc) {
        diem.push([
          lng + (Math.sin(r) * km * 1000) / (111320 * Math.cos(latR) || 1e-6),
          lat + (Math.cos(r) * km * 1000) / 110540,
        ]);
      }
    }
    const cao = await docCaoNhieuDiem(diem);
    // ══ NHẬN RA BIỂN BẰNG ĐỘ CAO ÂM ══
    // Đo thử ngoài thực tế mới thấy: nước biển luôn cho độ cao ÂM (âm vài mét tới âm mấy chục mét),
    // còn đất liền — kể cả ruộng trũng, đầm, đồng bằng ven biển — thì luôn DƯƠNG.
    //   · Ngay trên đường ven biển, nhìn ra đông:  −7 · 2 · −4 · 4 · −25 · −53  → nhiều mốc âm rõ.
    //   · Trên Quốc lộ 1 trong đất liền, cùng hướng: 753 · 516 · 359 · 131 · 7 · 2 → không mốc nào âm.
    // Lần trước tôi lấy mốc "thấp dưới 5 m" là nước — hoá ra cả cánh đồng trũng cũng lọt, nên máy
    // tưởng giữa đồng ruộng là biển. Giờ chỉ tính mốc ÂM, phân biệt gọn gàng.
    // Vòng 1 — chọn ra mấy hướng "có vẻ là nước": sát chỗ đứng (mép nước trong 2 km) và nhìn thông ra xa.
    const laNuoc = (c: number | null) => c !== null && c < -1;
    const ungVien: { huong: number; xa: number; gan: number; sau: number }[] = [];
    let doDuoc = false;
    for (let hi = 0; hi < huongs.length; hi++) {
      let nuoc = 0, xaNhat = 0, ganNhat = 99, sauXa = 0;
      for (let mi = 0; mi < moc.length; mi++) {
        const c = cao[hi * moc.length + mi];
        if (c === null) continue;
        doDuoc = true;
        if (laNuoc(c)) { nuoc++; xaNhat = Math.max(xaNhat, moc[mi]); ganNhat = Math.min(ganNhat, moc[mi]); }
        if (moc[mi] >= 8 && c < sauXa) sauXa = c;         // chỗ sâu nhất ở vùng ngoài xa
      }
      // ĐƯỜNG SÁT BIỂN = mép nước chỉ cách chừng 1 km. Xa hơn 2 km thì quay ra chỉ thấy đồng ruộng, nhà cửa.
      if (nuoc >= 3 && xaNhat >= 11 && ganNhat <= 2) ungVien.push({ huong: huongs[hi], xa: xaNhat, gan: ganNhat, sau: sauXa });
    }
    if (!doDuoc) return null;                            // không lấy được dữ liệu → để bên ngoài tự xử
    if (!ungVien.length) return { huong: -1, xa: 0, gan: 99 };

    // ══ VÒNG 2 — MỞ HÌNH QUẠT ĐỂ TÁCH BIỂN KHỎI ĐẦM ══
    // Đây mới là chỗ mấu chốt. Đầm Thuỷ Triều cũng nước mặn, cũng dưới mực nước biển, mà đứng bên đầm
    // ngó thẳng ra xa 11–14 km thì vượt qua đầm, qua dải cát, ra tới biển thật — nên đo bằng MỘT TIA
    // kiểu gì cũng bị đầm lừa.
    // Khác nhau nằm ở BỀ NGANG: đầm là dải nước hẹp (rộng chừng 2 km), biển thì mở toang.
    // Nên thay vì ngó một tia, ta xoè ba tia lệch nhau 35 độ, mỗi tia dò ở 3 · 5 · 8 km — chín điểm.
    // Đo thật trên mười tuyến quanh Cam Lâm, con số tách bạch rất rõ:
    //   · Bên đầm Thuỷ Triều:                4/9 · 5/9 · 7/9 điểm là nước
    //   · Trên đường ven biển Bãi Dài:       8/9 và 9/9 điểm là nước
    //   · Chỗ cửa sông gần Nha Trang:        1/9 và 2/9
    // Chỗ khó nhất là mạn BẮC đầm, nơi đầm phình rộng ra: quạt lọt tới 7/9. Nhưng chỗ đó nước chỉ
    // sâu 9 m, còn biển thật ngoài Bãi Dài đo được từ 14 m tới 58 m. Nên chốt hai điều kiện cùng lúc:
    // quạt phải đạt 8/9 VÀ nước ngoài xa phải sâu quá 12 m. Hai điều đó cộng lại thì đầm hết đường lọt.
    const QUAT_LECH = [-35, 0, 35];
    const QUAT_MOC = [3, 5, 8];
    const diem2: [number, number][] = [];
    for (const uv of ungVien) {
      for (const dh of QUAT_LECH) {
        const r = ((uv.huong + dh) * Math.PI) / 180;
        for (const km of QUAT_MOC) {
          diem2.push([
            lng + (Math.sin(r) * km * 1000) / (111320 * Math.cos(latR) || 1e-6),
            lat + (Math.cos(r) * km * 1000) / 110540,
          ]);
        }
      }
    }
    const cao2 = await docCaoNhieuDiem(diem2);
    const SO_QUAT = QUAT_LECH.length * QUAT_MOC.length;      // 9 điểm mỗi hướng
    let tot: { huong: number; xa: number; gan: number; quat: number } | null = null;
    for (let i = 0; i < ungVien.length; i++) {
      let quat = 0;
      for (let k = 0; k < SO_QUAT; k++) { const c = cao2[i * SO_QUAT + k]; if (c !== null && c < 0) quat++; }
      const uv = ungVien[i];
      if (quat < 8) continue;                     // nước hẹp → đầm, vũng, cửa sông → bỏ
      if (uv.sau > -12) continue;                 // nông quá → đầm, không phải biển khơi
      // Trong mấy hướng đạt chuẩn thì lấy hướng nhìn ra được NHIỀU biển nhất, hoà nhau thì lấy hướng sát bờ hơn.
      if (!tot || quat > tot.quat || (quat === tot.quat && uv.gan < tot.gan)) tot = { huong: uv.huong, xa: uv.xa, gan: uv.gan, quat };
    }
    if (!tot) return { huong: -1, xa: ungVien[0].xa, gan: ungVien[0].gan };
    return { huong: tot.huong, xa: tot.xa, gan: tot.gan };
  }




  // Ngủ/chờ mà VẪN NGHE nút Dừng: cứ 80 mili giây ngó một lần, người dùng bấm Dừng là thoát ngay.
  async function nghi(ms: number) {
    const het = Date.now() + ms;
    while (Date.now() < het) { if (stopRef.current) return; await sleep(Math.min(80, het - Date.now())); }
  }
  async function choAnhVe(map: any, ms: number) {
    const het = Date.now() + ms;
    while (Date.now() < het) { if (stopRef.current) return; await tilesIdle(map, Math.min(200, het - Date.now())); }
  }
  // Chờ tải xong nhưng vẫn nghe nút Dừng.
  async function choTaiXongCoDung(ms: number) {
    const het = Date.now() + ms;
    while (Date.now() < het) { if (stopRef.current) return; await choTaiXong(Math.min(200, het - Date.now())); if (conLai() === 0) return; }
  }
  // Nhớ xem địa hình 3D đang bật hay tắt — chỉ gọi lệnh đổi khi TRẠNG THÁI THAY ĐỔI.
  // Gọi mỗi khung hình thì chính cái lệnh đó lại làm giật, hỏng đúng thứ mình đang muốn chữa.
  const dang3d = useRef<boolean | null>(null);
  const muc3d = useRef(0);          // độ nổi đang áp thật sự — nâng/hạ từ từ cho khỏi nảy hình
  function can3d(map: any, k: any, el: number, bo: any) {
    if (typeof map?.setTerrain !== 'function') return;
    const kb = (renderRef.current?.bienKhung ?? bienKhung) as any[];
    // Gần khung cảnh đèo (rộng thêm 2 giây mỗi bên để địa hình kịp dựng trước khi vào cảnh)
    let ganDeo = false;
    if (kb && kb.length && bo) {
      const p3 = bo.p3 ?? 0, p4 = bo.p4 ?? 0;
      for (const mk of kb) {
        if (mk.kieu !== 'deo' || mk.zoom == null) continue;
        const moc = p3 + mk.t * Math.max(0.001, p4 - p3);
        if (Math.abs(el - moc) < Math.max(3, mk.dai || 7) + 2) { ganDeo = true; break; }
      }
    }
    // ══ VÙNG PHÓNG MÀ ĐỊA HÌNH 3D CÒN CÓ NGHĨA ══
    // Ảnh độ cao chỉ chi tiết tới mức phóng 14. Camera hạ xuống sát nhà cửa (mức 16–17) thì mỗi ô độ
    // cao phải phủ 8–16 ô ảnh nền → lưới mặt đất thô hơn ảnh rất nhiều, ảnh căng lên lưới đó bị VẶN
    // như tấm vải nhàu: đường thẳng gãy khúc, nhà cửa méo mó. Mà ở tầm đó chênh cao chỉ vài mét,
    // dựng 3D CHẲNG THẤY GÌ — được cái méo, mất cái đẹp.
    // Núi chỉ ra khối ở TẦM TRUNG (mức 11–15), lúc nhìn được cả quả núi. Ngoài khoảng đó thì để phẳng.
    const Z_THAP = 11, Z_CAO = 15.3, Z_CAO_GIU = 15.9;   // giữ thêm chút khi ĐANG bật, cho khỏi nhấp nháy bật/tắt
    const tranTren = dang3d.current ? Z_CAO_GIU : Z_CAO;
    const hopTam = k.zoom >= Z_THAP && k.zoom <= tranTren;
    // ══ ĐOẠN MỞ ĐẦU (lao vào lô + ngắm lô) THÌ TUYỆT ĐỐI KHÔNG DỰNG NÚI ══
    // Đây chính là chỗ hai thuật toán giẫm chân nhau. Lúc lao từ toàn cảnh vào thửa đất, mức phóng
    // chạy vụt từ 9 lên 17 — nó ĐI XUYÊN QUA khoảng 11–15 là khoảng mà máy hiểu "nên dựng núi".
    // Thế là núi vừa kịp mọc lên đã phải xẹp xuống ngay, tất cả gói trong đúng một hai giây: cảnh nảy
    // lên nảy xuống. Mà ở đoạn này núi cũng chẳng để làm gì — người xem đang nhìn thửa đất.
    // Nên: chỉ dựng núi từ lúc BẮT ĐẦU CHẠY TUYẾN trở đi.
    const batDauTuyen = (bo?.p3 ?? 0);
    const daVaoTuyen = el >= batDauTuyen - 0.5;
    const canhGan = hopTam && k.pitch >= 40 && daVaoTuyen;
    // ══ CHỌN 3D THÌ DỰNG NÚI SUỐT VIDEO, KHÔNG ĐỔI QUA LẠI ══
    // Mỗi lần đổi 2D↔3D là cả mặt đất phải dựng lại — bản đồ khựng một nhịp, nặng máy thì đứng hẳn
    // vài khung. Đổi càng nhiều lần càng nhiều chỗ giật, mà mắt lại chẳng thấy đẹp thêm.
    // Nên: chọn 3D là dựng một lần rồi giữ nguyên tới hết. Chọn 2D thì phẳng suốt. Chỉ chế độ
    // "Tự động" mới cân đối qua lại — dành cho máy yếu.
    const muon = hinhMode === '2d' ? false
      : hinhMode === '3d' ? true
      : (terrain3d && ((ganDeo && daVaoTuyen && k.zoom <= tranTren) || canhGan));
    // ══ CHUYỂN 2D ↔ 3D PHẢI DẦN DẦN, KHÔNG ĐƯỢC BẬT TẮT CÁI RỤP ══
    // Bật/tắt đột ngột thì cả mặt đất nhô lên (hoặc xẹp xuống) trong ĐÚNG MỘT KHUNG HÌNH — cảnh nảy
    // một cái, mắt bắt được ngay. Đó chính là mấy chỗ "giật" còn sót lại: không phải máy yếu, mà là
    // núi mọc lên quá nhanh.
    // Giờ nâng/hạ độ nổi từ từ qua chừng 8 khung (khoảng một phần tư giây video) — núi dâng lên êm
    // như nước lên, không ai nhận ra lúc nào chuyển.
    const dich = muon ? noiKhoi : 0;
    const buoc = Math.max(0.02, noiKhoi * 0.13);
    let m = muc3d.current;
    if (Math.abs(dich - m) <= buoc) m = dich;
    else m += (dich > m ? buoc : -buoc);
    if (Math.abs(m - muc3d.current) < 0.001) return;      // không đổi gì thì thôi, khỏi động vào bản đồ
    muc3d.current = m;
    dang3d.current = m > 0.01;
    try { map.setTerrain(m > 0.01 ? { source: 'dem', exaggeration: m } : null); } catch { /* ignore */ }
  }

  /**
   * ══ CHUẨN BỊ ĐỊA HÌNH 3D TRƯỚC KHI BAY ══
   * Đây là chỗ các phần mềm dựng phim bản đồ (Google Earth Studio, Cesium) làm khác hẳn web thường:
   * chúng KHÔNG vừa bay vừa tải. Mọi thứ nặng phải xong TRƯỚC khi máy quay lăn bánh.
   * Ở đây làm ba việc:
   *   1. Tải sẵn ảnh độ cao (DEM) dọc đường bay — thứ dùng để dựng núi.
   *   2. Cho camera "chạy nháp" qua đúng mấy cảnh 3D với địa hình đã bật, để bản đồ dựng sẵn lưới
   *      mặt đất và uốn ảnh nền lên đó. Lần bay thật thì nó lấy ra dùng ngay.
   *   3. Chờ tới khi bản đồ báo vẽ xong hẳn mới thôi.
   */
  async function chuanBiDiaHinh(map: any, bo: any, T: number) {
    if (hinhMode === '2d') return;
    if (typeof map?.setTerrain !== 'function') return;
    // Chọn 3D suốt: bật ngay từ bây giờ và để nguyên. Có bật sẵn thì bước chạy nháp dưới đây mới
    // dựng đúng lưới mặt đất, lúc bay không phải dựng lại giữa chừng (dựng giữa chừng là khựng).
    if (hinhMode === '3d') { try { map.setTerrain({ source: 'dem', exaggeration: noiKhoi }); dang3d.current = true; muc3d.current = noiKhoi; } catch { /* ignore */ } }
    const kb = (renderRef.current?.bienKhung ?? bienKhung) as any[];
    const mocDeo = (kb || []).filter((x) => x.kieu === 'deo' && x.zoom != null);
    if (hinhMode !== '3d' && !mocDeo.length && !terrain3d) return;
    // 1) Ảnh độ cao dọc đường bay
    try {
      // ⚠️ LƯỢNG ẢNH PHẢI VỪA ĐỦ — LẤY THAM LÀ MÁY SẬP.
      // Lượt trước tôi lấy dày quá (40 chỗ × 4 mức phóng × 49 ô mỗi chỗ) — cả nghìn tấm ảnh nằm chật
      // bộ nhớ, trình duyệt hết chỗ rồi báo "Out of Memory", trang trắng luôn.
      // Ảnh độ cao ở mức phóng THẤP phủ rất rộng: một ô mức 12 bằng 16 ô mức 14. Nên chỉ cần lấy hai
      // mức thấp là đã phủ kín cả đường bay, vừa nhẹ vừa đủ để mặt đất không nhô lên hạ xuống.
      const buoc = Math.max(2, Math.round(T / 16));
      for (let t = 0; t <= T; t += buoc) {
        const k = bo.at(t, null, null);
        if (k?.center) napTruocDem(DEM_TILES, k.center[0], k.center[1], 2, [12, 13]);
      }
      for (const mk of mocDeo) napTruocDem(DEM_TILES, mk.lng, mk.lat, 2, [12, 13]);
      await choTaiXongCoDung(30000);   // chờ cho ảnh độ cao về đủ — thà chờ một lần còn hơn rung cả video
    } catch { /* ignore */ }
    // 2) Bật địa hình rồi ghé qua từng cảnh 3D cho bản đồ dựng sẵn
    try {
      map.setTerrain({ source: 'dem', exaggeration: noiKhoi });
      dang3d.current = true; muc3d.current = noiKhoi;
      const ghe: any[] = mocDeo.map((mk) => ({ center: [mk.lng, mk.lat], zoom: mk.zoom, pitch: mk.pitch, bearing: mk.bearing }));
      if (hinhMode === '3d' || (!ghe.length && terrain3d)) {
        for (let t = 0; t <= T; t += Math.max(1, T / 10)) {
          const k = bo.at(t, null, null);
          if (k?.center && k.pitch >= 30) ghe.push({ center: k.center, zoom: k.zoom, pitch: k.pitch, bearing: k.bearing });
        }
      }
      for (const g of ghe) {
        if (stopRef.current) break;
        map.jumpTo(g);
        await nghi(120);
        await choAnhVe(map, 2500);
      }
    } catch { /* ignore */ }
  }

  /** Chạy xong (hoặc bấm Dừng) thì trả địa hình về đúng như ô tích người dùng đang chọn. */
  function traLai3d() {
    const map = mapRef.current;
    dang3d.current = null; muc3d.current = 0;
    if (!map || typeof map.setTerrain !== 'function') return;
    const bat = hinhMode === '2d' ? false : hinhMode === '3d' ? true : terrain3d;
    try { map.setTerrain(bat ? { source: 'dem', exaggeration: noiKhoi } : null); } catch { /* ignore */ }
  }

  /**
   * ⛰️ CHỐT KHUNG CẢNH ĐÈO — cú máy hoành tráng nhất của công cụ.
   * Đoạn đèo ven biển (như đèo Cù Hin) có ba dấu hiệu cùng lúc: đường CUA liên tục, mặt đất LÊN CAO
   * và DỐC, một bên là BIỂN. Máy đi dọc tuyến tìm đúng chỗ hội đủ ba thứ đó.
   * Cú máy: bay vọt hẳn RA NGOÀI BIỂN rồi QUAY NGƯỢC VÀO BỜ, ngửa máy gần hết cỡ để lấy được cả
   * đường chân trời — trong một khung có đủ mặt biển ở gần, dải bờ cong, con đèo vắt ngang sườn núi
   * và dãy núi phía sau. Chốt hai mốc liền nhau (xa → gần) nên camera TRÔI dần vào bờ, không đứng
   * yên như ảnh chụp.
   */
  async function chotKhungDeo() {
    const map = mapRef.current; if (!map) return;
    if (route.current.length < 2) { toast.error('Vẽ tuyến hoặc lấy đường thật trước đã'); return; }
    setWarming(true);
    try {
      if (!deoOn) setDeoOn(true);
      const T = Math.max(4, duration);
      const kieuCam = camStyle || scripts[activeScript]?.key || 'chiduong';
      const bo: any = boKhungDanDuong(map, T, laDanDuong(kieuCam) ? kieuCam : 'chiduong');

      // ── B1: đo ĐỘ CAO MẶT ĐẤT dọc tuyến (một lượt, ~24 điểm) ──
      const qs: number[] = [];
      for (let q = 0.04; q <= 0.965; q += 0.04) qs.push(q);
      const cao = await docCaoNhieuDiem(qs.map((q) => routePos(q) as [number, number]));

      // ── B2: chấm điểm "chất đèo" = LÊN CAO × DỐC × CUA NHIỀU ──
      const ung: { q: number; cao: number; doc: number; cua: number; diem: number }[] = [];
      for (let i = 1; i < qs.length - 1; i++) {
        const c = cao[i], c0 = cao[i - 1], c1 = cao[i + 1];
        if (c === null) continue;
        const doc = (c0 !== null && c1 !== null) ? Math.max(Math.abs(c - c0), Math.abs(c - c1)) : 0;
        // Độ cua: cộng góc bẻ lái qua 6 chặng ngắn quanh chỗ này.
        let cua = 0;
        for (let k = -3; k <= 2; k++) {
          const a1 = routePos(Math.max(0, Math.min(1, qs[i] + k * 0.012)));
          const a2 = routePos(Math.max(0, Math.min(1, qs[i] + (k + 1) * 0.012)));
          const a3 = routePos(Math.max(0, Math.min(1, qs[i] + (k + 2) * 0.012)));
          const g1 = (Math.atan2(a2[0] - a1[0], a2[1] - a1[1]) * 180) / Math.PI;
          const g2 = (Math.atan2(a3[0] - a2[0], a3[1] - a2[1]) * 180) / Math.PI;
          cua += Math.abs(((g2 - g1) % 360 + 540) % 360 - 180);
        }
        if (c < 25) continue;                                   // đồng bằng, không phải đèo
        ung.push({ q: qs[i], cao: c, doc, cua, diem: Math.min(c, 400) * 0.35 + doc * 1.6 + cua * 1.4 });
      }
      if (!ung.length) { toast.info('Tuyến này không đi qua đoạn đèo nào (đường chạy toàn vùng thấp)'); return; }
      ung.sort((a, b) => b.diem - a.diem);

      // ── B3: mấy chỗ điểm cao nhất — chỗ nào có BIỂN bên cạnh thì mới quay được cảnh đèo–biển ──
      let chon: { q: number; huongBien: number; cao: number } | null = null;
      for (const u of ung.slice(0, 7)) {
        const p = routePos(u.q);
        const kq = await doHuongBien(p[0], p[1]);
        if (kq && kq.huong >= 0) { chon = { q: u.q, huongBien: kq.huong, cao: u.cao }; break; }
      }
      if (!chon) {
        toast.info('Có đoạn đèo nhưng không nhìn ra biển — cảnh này cần đèo chạy sát biển');
        return;
      }

      // ── B4: dựng hai mốc máy quay ──
      // ⚠️ BÀI HỌC: bay xa 6 km + ngửa máy 78° thì ẢNH BẢN ĐỒ BỊ BẸT VÀ MỜ — vì nền là ảnh chụp thẳng
      // từ trên xuống, nhìn gần đường chân trời là nó kéo giãn, lại lộ nguyên mảng mây trắng của ảnh
      // vệ tinh, con đường thì bé xíu. Nên đứng GẦN hơn nhiều và ngửa VỪA PHẢI, không lấy chân trời.
      // Cái làm nên độ hùng vĩ không phải bay cao, mà là ĐỊA HÌNH 3D — núi nhô lên khối thật, có bóng đổ.
      if (!terrain3d) setTerrain3d(true);
      if (!hillshade) setHillshade(true);
      const pDeo = routePos(chon.q);
      const latR = (pDeo[1] * Math.PI) / 180;
      // Lùi ra biển theo hướng biển, nhưng CHẾCH đi một chút để con đèo chạy chéo qua khung
      // (nhìn vuông góc thì đường nằm ngang giữa hình, khô cứng như bản đồ).
      const doiCho = (km: number, lechGoc: number): [number, number] => {
        const r = ((chon!.huongBien + lechGoc) * Math.PI) / 180;
        return [pDeo[0] + (Math.sin(r) * km * 1000) / (111320 * Math.cos(latR) || 1e-6),
                pDeo[1] + (Math.cos(r) * km * 1000) / 110540];
      };
      // Mức phóng sao cho khung ôm chừng 2,6 lần khoảng cách đứng — đủ thấy đèo, núi và biển mà ảnh còn nét.
      const mucPhong = (km: number) =>
        Math.max(11.5, Math.min(15.5, Math.log2((1200 * 156543 * Math.cos(latR)) / (2.6 * km * 1000)) - 1.2));
      const nhinVao = (g: number) => ((chon!.huongBien + 180 + g) % 360 + 360) % 360;
      const ra: KhungBien[] = [
        // Mốc 1 — đứng ngoài biển 2,4 km, chếch sang một bên, ngửa 64°: thấy trọn sườn núi và đường đèo vắt ngang.
        { t: chon.q, kieu: 'deo', huong: nhinVao(0), cao: 2.4, nghieng: 19, dai: 7,
          lng: doiCho(2.4, 26)[0], lat: doiCho(2.4, 26)[1], zoom: mucPhong(2.4), pitch: 64, bearing: nhinVao(26) },
        // Mốc 2 — trôi vào còn 1,3 km và đảo sang phía bên kia: núi lướt qua ống kính, nhìn ra chiều sâu thật.
        { t: Math.min(0.97, chon.q + 0.05), kieu: 'deo', huong: nhinVao(0), cao: 1.3, nghieng: 12, dai: 7,
          lng: doiCho(1.3, -14)[0], lat: doiCho(1.3, -14)[1], zoom: mucPhong(1.3), pitch: 57, bearing: nhinVao(-14) },
      ];
      // Giữ nguyên khung ngắm biển đã có, chỉ thay mấy khung đèo cũ.
      setBienKhung([...bienKhung.filter((k) => k.kieu !== 'deo'), ...ra].sort((a, b) => a.t - b.t));
      toast.success('Đã chốt cảnh đèo ở độ cao ' + Math.round(chon.cao) + ' m · đã bật Địa hình 3D cho núi nhô lên thật');
    } catch { toast.error('Chưa chốt được cảnh đèo, thử lại'); }
    finally { setWarming(false); }
  }

  // Chốt sẵn 2 khung ngắm biển để người dùng tự kéo chỉnh (giây · hướng · độ cao · độ ngả · thời lượng).
  async function chotKhungBien() {
    const map = mapRef.current; if (!map) return;
    if (route.current.length < 2) { toast.error('Vẽ tuyến hoặc lấy đường thật trước đã'); return; }
    setWarming(true);
    try {
      if (!bienOn) setBienOn(true);
      const T = Math.max(4, duration);
      const kieu = camStyle || scripts[activeScript]?.key || 'chiduong';
      const bo: any = boKhungDanDuong(map, T, laDanDuong(kieu) ? kieu : 'chiduong');
      // ══ DÒ THẲNG TRÊN TUYẾN, KHÔNG PHỤ THUỘC BỘ CHẤM ĐIỂM ══
      // Bản trước chỉ lấy mấy chỗ mà bộ chấm điểm chọn sẵn — mà bộ đó lọc rất chặt (tránh cua, phải
      // thẳng, phải đủ điểm), nên tuyến chạy sát biển vẫn có thể ra rỗng rồi báo "không có biển".
      // Giờ đi dọc CẢ TUYẾN, cứ 5% một chỗ, hỏi máy chủ xem chỗ đó nhìn ra biển được bao xa.
      // Chỗ nào nước liền mạch xa nhất thì lấy — chắc chắn không bỏ sót.
      const ungVienBien: { t: number; huong: number; xa: number; thang: number; beLai: number; docBo: number; gan: number }[] = [];
      for (let q = 0.06; q <= 0.94; q += 0.05) {
        const p = routePos(q);
        const kq = await doHuongBien(p[0], p[1]);
        if (kq === null) {                       // không đo được độ cao → dùng chỗ bộ chấm điểm chọn
          const mk = (bo.mocKhoeBien || [])[0];
          if (mk) ungVienBien.push({ t: mk.t, huong: Math.round(mk.goc + 90), xa: 8, thang: 1, beLai: 0, docBo: 1, gan: 1 });
          break;
        }
        if (kq.huong >= 0) {
          // ══ ĐO ĐỘ THẲNG BẰNG CHÍNH HÌNH DÁNG CON ĐƯỜNG ══
          // Trước tôi lấy "hướng tuyến" đã được làm mượt để so — mà thứ đó vốn đã san phẳng mấy khúc
          // cua nên đo ra chỗ nào cũng thẳng, thành ra chọn trúng ngay khúc cua (đúng lỗi đang gặp).
          // Giờ lấy thẳng các điểm trên tuyến: đi 5 chặng ngắn quanh chỗ này, cộng tổng số độ mà
          // đường bẻ lái. Cộng lại quá 18 độ nghĩa là đang cua → BỎ HẲN, không chấm điểm nữa.
          let beLai = 0;
          for (let k = -2; k <= 1; k++) {
            const a1 = routePos(Math.max(0, Math.min(1, q + k * 0.02)));
            const a2 = routePos(Math.max(0, Math.min(1, q + (k + 1) * 0.02)));
            const a3 = routePos(Math.max(0, Math.min(1, q + (k + 2) * 0.02)));
            const g1 = (Math.atan2(a2[0] - a1[0], a2[1] - a1[1]) * 180) / Math.PI;
            const g2 = (Math.atan2(a3[0] - a2[0], a3[1] - a2[1]) * 180) / Math.PI;
            beLai += Math.abs(((g2 - g1) % 360 + 540) % 360 - 180);
          }
          // Ghi nhận hết, KHÔNG loại vội — đường ven biển vốn uốn nhè nhẹ liên tục, loại cứng theo
          // một ngưỡng là sạch bách (đúng lỗi vừa gặp). Lọc dần ở bước sau.
          // ══ ƯU TIÊN ĐOẠN CHẠY DỌC BỜ BIỂN ══
          // So hướng con đường với hướng ra biển: vuông góc (90°) nghĩa là đang chạy SONG SONG bờ,
          // biển nằm ngay bên hông — quay ra là thấy trọn mặt nước, đúng cảnh cần. Còn đường đâm
          // thẳng ra biển hoặc quay lưng vào bờ thì mở khung chỉ thấy đường với nhà.
          const gA = routePos(Math.max(0, q - 0.02)), gB = routePos(Math.min(1, q + 0.02));
          const gocDuongQ = (Math.atan2(gB[0] - gA[0], gB[1] - gA[1]) * 180) / Math.PI;
          const lechQ = ((kq.huong - gocDuongQ) % 360 + 540) % 360 - 180;
          const docBo = Math.abs(Math.sin((lechQ * Math.PI) / 180));   // 1 = chạy song song bờ · 0 = đâm ra biển
          // BẮT BUỘC phải SONG SONG với bờ. Đường đâm thẳng ra biển hay chạy chéo nhiều thì bỏ hẳn:
          // quay ngang ra chỉ thấy đường lao thẳng vào khung, không ra cảnh chạy dọc bờ biển.
          if (docBo < 0.6) continue;
          ungVienBien.push({ t: q, huong: kq.huong, xa: kq.xa, thang: 1 - Math.min(1, beLai / 40), beLai, docBo, gan: kq.gan });
        }
      }
      // ══ LỌC DẦN CHO KHỎI HỤT ══
      // Ưu tiên đoạn THẲNG nhất (bẻ lái dưới 20°). Không có chỗ nào đạt thì nới lên 45°, vẫn không có
      // thì lấy tất — thà cảnh hơi cong còn hơn báo "không có biển" trong khi tuyến chạy sát mép nước.
      let loc = ungVienBien.filter((x) => x.beLai <= 20);
      if (loc.length < 2) loc = ungVienBien.filter((x) => x.beLai <= 45);
      if (!loc.length) loc = ungVienBien;
      // Chấm điểm cuối cùng: CHẠY DỌC BỜ là quan trọng nhất, rồi tới đường thẳng, rồi tới nhìn xa.
      // Sát biển nhất được ưu tiên cao nhất, rồi tới chạy dọc bờ, rồi tới đường thẳng.
      const cham = (x: typeof loc[number]) => (2 - Math.min(2, x.gan)) * 22 + x.docBo * 26 + x.thang * 12 + x.xa * 0.5;
      loc.sort((a, b) => cham(b) - cham(a));
      ungVienBien.length = 0; ungVienBien.push(...loc);
      const ra: KhungBien[] = [];
      for (const uv of ungVienBien) {
        if (ra.length >= 2) break;
        if (ra.some((x) => Math.abs(x.t - uv.t) < 0.25)) continue;   // hai cảnh phải cách xa nhau
        // Tính sẵn GÓC MÁY của khung: đứng ngay trên tuyến, bay cao hơn thường, xoay thẳng ra biển.
        const p2 = routePos(uv.t);
        const kFrame: any = bo.at(0.5 * (T), null, null);           // lấy tạm một khung để biết mức phóng/độ nghiêng đang dùng
        const zNen = kFrame?.zoom ?? 15, pNen = kFrame?.pitch ?? 45;
        ra.push({ t: uv.t, huong: uv.huong, cao: 4.4, nghieng: 16, dai: 12,
          lng: p2[0], lat: p2[1], zoom: Math.max(6, zNen - 4.4), pitch: Math.max(0, Math.min(85, pNen + 16)), bearing: uv.huong });
      }
      ra.sort((a, b) => a.t - b.t);
      if (!ra.length) { toast.info('Tuyến này không có đoạn nào thật sự nhìn ra biển'); return; }
      setBienKhung(ra);
      toast.success('Đã chốt ' + ra.length + ' khung ngắm biển — kéo thanh bên dưới để chỉnh');
    } catch { toast.error('Chưa chốt được, thử lại'); }
    finally { setWarming(false); }
  }

  async function warmTiles(map: any, batBuoc = false) {
    const vt = vanTayVung();
    const daNap = !batBuoc && daNapRef.current === vt;
    // ══ RENDER KỸ THÌ CHUẨN BỊ NGẮN LẠI ══
    // Bước làm nóng có hai phần: (a) TẢI TRƯỚC ảnh theo lịch đường bay — tải hàng loạt song song,
    // nhanh gấp nhiều lần tải lẻ từng tấm, nên VẪN RẤT CẦN; (b) cho camera CHẠY NHÁP qua các cảnh
    // để ép bản đồ vẽ thật — phần này sinh ra hồi còn quay theo đồng hồ thật, lúc đó không chờ được
    // nên phải vẽ sẵn. Render kỹ thì mỗi khung đã tự chờ vẽ xong rồi, chạy nháp chỉ tổ mất thời gian.
    const ngan = !!(recRef.current && renderKyRef.current);
    setWarming(true);
    if (!daNap) toast.info('Đang render video… vui lòng chờ');
    // ══ NẠP THEO BẢNG LỊCH ĐƯỜNG BAY — chạy NGAY TỪ ĐẦU, song song với mấy bước quét bên dưới ══
    // Bảng lịch cho biết giây nào camera ở toạ độ nào, phóng mức mấy — nên lấy đúng từng tấm ảnh cần,
    // kể cả mấy mức phóng TRUNG GIAN lúc mở đầu (từ ngoài lao vào thửa) và lúc kết (kéo ra tổng thể),
    // vốn là hai chỗ hay nhoè nhất. Ảnh về sẵn trong máy nên lúc bay không phải chờ tải tấm nào.
    try {
      const kieuBay = renderRef.current?.camKey || 'vitri';
      if (laDanDuong(kieuBay) && route.current.length >= 2) {
        const Tb = Math.max(4, Number(renderRef.current?.duration || duration) || 8);
        datCheDoBay(true);
        taiTheoLich(map, lapLichBay(boKhungDanDuong(map, Tb, kieuBay), Tb), 0, 1e9);
      }
    } catch { /* ignore */ }
    // Vùng này nạp rồi thì chỉ cần quét NHANH lại mấy mức phóng của đoạn mở đầu và đoạn kết.
    if (daNap) {
      try {
        // Quét THẬT hai đoạn hay nhoè (mở đầu lao vào thửa · đoạn kết kéo ra) theo đúng đường bay.
        const kieuR = renderRef.current?.camKey || 'vitri';
        if (laDanDuong(kieuR) && route.current.length >= 2) {
          const Tr = Math.max(4, Number(renderRef.current?.duration || duration) || 8);
          const boR = boKhungDanDuong(map, Tr, kieuR);
          for (const dai of [[0, Tr * 0.28], [Tr * 0.72, Tr]]) {
            for (let t = dai[0]; t <= dai[1]; t += Math.max(0.15, (dai[1] - dai[0]) / 12)) {
              if (stopRef.current) break;
              const k = boR.at(t, null, null);
              if (!k?.center) continue;
              map.jumpTo({ center: k.center, zoom: k.zoom, pitch: k.pitch, bearing: k.bearing });
              await nghi(70);
            }
          }
          await choAnhVe(map, 1200);
        }
        const b2 = bounds();
        const cam2: any = b2 && map.cameraForBounds(b2, { padding: 120, maxZoom: 18 });
        const c2 = cam2 ? (Array.isArray(cam2.center) ? cam2.center : [cam2.center.lng, cam2.center.lat]) : null;
        const cLo = parcelCenter();
        const zA = Math.round(cam2?.zoom ?? map.getZoom());
        for (let z = zA; z <= 18; z++) {
          if (stopRef.current) break;
          if (cLo) { map.jumpTo({ center: cLo as any, zoom: z, pitch: 0, bearing: 0 }); await nghi(70); }
          if (c2) { map.jumpTo({ center: c2 as any, zoom: z, pitch: 0, bearing: 0 }); await nghi(55); }
        }
        await choAnhVe(map, 1200);
        await choTaiXongCoDung(9000);
      } catch { /* ignore */ }
      dungTaiTruoc(); datCheDoBay(false);
      setWarming(false);
      return;
    }
    try {
      const b = bounds();
      // 1) Tổng thể (tile nền mức thấp/vừa)
      if (b) { map.fitBounds(b, { padding: 120, duration: 0, pitch: 0, bearing: 0, maxZoom: 18 }); await choAnhVe(map, 1800); }
      // 1b) Nếu có keyframe tự đặt → nạp tile tại các khung đó
      const ck = renderRef.current?.camKeys;
      if (Array.isArray(ck) && ck.length) { for (const k of ck) { try { map.jumpTo({ center: [k.lng, k.lat], zoom: Math.min(18, k.zoom), pitch: Math.min(60, k.pitch), bearing: k.bearing }); } catch { /* ignore */ } await nghi(200); } await choAnhVe(map, 1400); }
      // 2) Cận lô ở ĐÚNG góc nghiêng camera sẽ dùng → nạp tile chi tiết quanh lô (dùng cho hầu hết kịch bản)
      let cc: [number, number] | null = null; let zPar = map.getZoom();
      if (parcel.current.length) { const bp = new maplibregl.LngLatBounds(parcel.current[0] as any, parcel.current[0] as any); parcel.current.forEach((p) => bp.extend(p as any)); const cp: any = map.cameraForBounds(bp, { padding: 90, maxZoom: 18 }); if (cp) { cc = Array.isArray(cp.center) ? cp.center : [cp.center.lng, cp.center.lat]; zPar = Math.min(18, cp.zoom); } }
      else if (route.current.length) { cc = route.current[0]; zPar = Math.min(18, (b && map.cameraForBounds(b, { padding: 120, maxZoom: 18 })?.zoom || zPar) + 1.5); }
      if (cc) { for (const br of [0, 45, 90]) { map.jumpTo({ center: cc, zoom: zPar, pitch: 48, bearing: br }); await nghi(180); } await choAnhVe(map, 1400); }
      // 2a) QUÉT THẲNG ĐOẠN MỞ ĐẦU VÀ ĐOẠN KẾT THEO ĐÚNG ĐƯỜNG BAY.
      // Nạp vào bộ nhớ đệm của trình duyệt thôi là CHƯA ĐỦ: bản đồ vẫn phải tự tải rồi giải mã tấm
      // ảnh đó lần đầu, mà đúng lúc đang lao vào thửa thì không kịp → nhoè. Cách chắc ăn nhất là cho
      // camera CHẠY THỬ trước đúng đoạn đó (mỗi mốc một nhịp ngắn) để bản đồ nạp thật sự.
      try {
        const kieuB = renderRef.current?.camKey || 'vitri';
        if (laDanDuong(kieuB) && route.current.length >= 2) {
          const Tq = Math.max(4, Number(renderRef.current?.duration || duration) || 8);
          const boQ = boKhungDanDuong(map, Tq, kieuB);
          let demQ = 0;
          for (const dai of [[0, Tq * 0.3], [Tq * 0.7, Tq]]) {
            for (let t = dai[0]; t <= dai[1]; t += Math.max(0.08, (dai[1] - dai[0]) / 22)) {
              if (stopRef.current) break;
              const k = boQ.at(t, null, null);
              if (!k?.center) continue;
              map.jumpTo({ center: k.center, zoom: k.zoom, pitch: k.pitch, bearing: k.bearing });
              await nghi(140);                       // dừng lâu hơn để bản đồ kịp tải & giải mã
              if (++demQ % 5 === 0) await choAnhVe(map, 900);   // cứ 5 mốc lại đợi ảnh về hết
            }
          }
          await choAnhVe(map, 2000);
        }
      } catch { /* ignore */ }
      // 2b) CÁC MỨC PHÓNG TRUNG GIAN — chỗ hay bị nhoè nhất.
      // Mở đầu video camera phóng từ toàn cảnh vào cận lô, kết video thì kéo ngược ra. Đường đi đó
      // ĐI QUA từng nấc phóng một; nấc nào chưa có ảnh là lướt qua thấy nhoè. Nên dừng lại ở từng nấc
      // (cả tại lô lẫn tại tâm toàn cảnh) để bản đồ nạp đủ, mỗi nấc chờ một nhịp ngắn.
      {
        const camAll: any = b && map.cameraForBounds(b, { padding: 120, maxZoom: 18 });
        const zAllTho = Math.round(camAll?.zoom ?? map.getZoom());
        const cAll = camAll ? (Array.isArray(camAll.center) ? camAll.center : [camAll.center.lng, camAll.center.lat]) : null;
        const zCan = Math.round(zPar);
        for (let z = Math.min(zAllTho, zCan); z <= Math.max(zAllTho, zCan); z++) {
          if (stopRef.current) break;
          if (cc) { map.jumpTo({ center: cc, zoom: z, pitch: 0, bearing: 0 }); await nghi(110); }
          if (cAll) { map.jumpTo({ center: cAll as any, zoom: z, pitch: 0, bearing: 0 }); await nghi(90); }
        }
        await choAnhVe(map, 1600);
      }
      // 3) Dọc tuyến (kịch bản Dẫn đường) — nạp DÀY ĐẶC đúng zoom/góc nghiêng camera sẽ bay (che nên quét kỹ được).
      if (route.current.length >= 2) {
        const cam: any = b && map.cameraForBounds(b, { padding: 120, maxZoom: 18 });
        const zAll = cam?.zoom || map.getZoom();
        const kieuDD = renderRef.current?.camKey || 'chiduong';
        const KD = DAN_DUONG[kieuDD] || DAN_DUONG.chiduong;
        const zFollow = zoomBamTuyenMet(map, KD); // KHỚP với animateDirections (cùng một công thức)
        // Nghiêng càng sâu thì tầm nhìn càng xa → phải tải rất nhiều ảnh. Với mấy kiểu sát mặt đường
        // (nghiêng ≥ 70°) thì quét dày gấp đôi và chờ lâu hơn, không thì lúc bay thật sẽ khựng vì đợi ảnh.
        const sau = KD.pitch >= 70;
        // Quét DÀY hơn bản cũ (nấc nhỏ hơn) và cứ 8 nấc lại đứng đợi ảnh về hết. Bản cũ nhảy liên tục
        // rồi chỉ đợi ở nấc cuối, nên nhiều đoạn giữa tuyến ảnh chưa kịp về → bay tới là trắng.
        let dem = 0;
        for (let t = 0; t <= 1.0001; t += (sau ? 0.02 : 0.035)) {
          if (stopRef.current) break;
          map.jumpTo({ center: routePos(t), zoom: zFollow, pitch: KD.pitch, bearing: routeHeading(t) });
          await nghi(sau ? 120 : 85);
          if (++dem % 8 === 0) await choAnhVe(map, sau ? 900 : 650);
          // Cứ 6 nấc lại ngoái máy sang trái/phải 40°: khúc cua nào cũng có sẵn ảnh hai bên,
          // không thì đúng lúc vào cua bản đồ mới đi tải — đó là chỗ giật nặng nhất.
          if (dem % 6 === 0) {
            for (const lech of [40, -40]) { map.jumpTo({ center: routePos(t), zoom: zFollow, pitch: KD.pitch, bearing: routeHeading(t) + lech }); await nghi(60); }
          }
        }
        await choAnhVe(map, sau ? 2800 : 1600);
        // Quét thêm một lượt ở mức phóng THẤP HƠN 2 NẤC: đây là ảnh dùng cho phần chân trời phía xa
        // khi camera nghiêng — thiếu nó thì nửa trên khung hình trắng dù ngay dưới chân đã có ảnh.
        for (let t = 0; t <= 1.0001; t += 0.09) {
          map.jumpTo({ center: routePos(t), zoom: Math.max(10, zFollow - 2), pitch: KD.pitch, bearing: routeHeading(t) });
          await nghi(70);
        }
        await choAnhVe(map, 1200);
      }
      if (b) { map.fitBounds(b, { padding: 120, duration: 0, pitch: 0, bearing: 0, maxZoom: 18 }); await nghi(150); }
      await choTaiXongCoDung(18000);                // đợi nốt mấy tấm của bảng lịch
      daNapRef.current = vt;                 // nhớ là vùng này đã nạp xong
    } catch { /* ignore */ }
    dungTaiTruoc(); datCheDoBay(false);       // dọn sạch: lúc bay không còn việc tải chạy nền
    setWarming(false);
  }

  // ĐỘ PHÓNG KHI BÁM TUYẾN — chọn sao cho khoảng 1/5 quãng đường vừa đúng khung hình.
  // Trước đây tính theo ô đất nên tuyến dài là camera sát rạt, cảnh chạy vun vút không kịp nhìn.
  // ══ ĐỘ CAO DRONE — tính theo BỀ NGANG MẶT ĐẤT muốn thấy, không theo độ dài tuyến ══
  // Nghiêng càng sâu thì cùng một mức phóng lại nhìn được xa hơn nhiều (nhìn dọc theo mặt đất),
  // nên phải kéo drone lại gần theo độ nghiêng — không thì kiểu "sát mặt đường" vẫn thành bay cao.
  // Bề ngang mặt đất mà khung hình phải bao được, tính bằng mét — dùng chung cho cả mức phóng
  // lẫn cách ngắm hướng, nên hai thứ luôn khớp nhau.
  function khungMetCuaKieu(K: { met: number; pitch: number }): number {
    const dai = daiTuyenM();
    // Tầm bay do người dùng đặt CHỈ dành cho kiểu 6.4 (Bay cao). Trước đây nó áp cho mọi kiểu dẫn
    // đường, nên đặt 12 km một lần là kiểu 06 chuẩn cũng bay vọt lên cao — mất hết cảm giác bám đường
    // và ôm cua như cũ. Giờ kiểu nào ra kiểu nấy.
    const laBayCao = (renderRef.current?.camKey || '') === 'cd_cao';
    const kmTay = laBayCao ? (Number(renderRef.current?.khungKm ?? khungKm) || 0) : 0;
    // ⚠ CHỖ NÀY TỪNG LÀM SỐ KM "KHÔNG THỰC":
    // Có một luật cũ chặn khung hình không được rộng quá 60% chiều dài tuyến (để tuyến ngắn khỏi bị
    // thu bé tí giữa vùng trống). Nhưng luật đó cũng chặn luôn con số người dùng tự đặt: tuyến 38 km
    // thì đặt 400 hay 995 km đều bị ép về ~23 km — nên nhìn y hệt nhau.
    // Giờ: TỰ ĐẶT thì nghe theo đúng con số, không chặn, cũng không trừ bù độ nghiêng.
    if (kmTay > 0) return kmTay * 1000;
    // Chế độ tự động (theo kịch bản) thì vẫn giữ luật cũ.
    let met = Math.max(120, Math.min(K.met, Math.max(160, dai * 0.6)));
    met *= 1 - Math.min(0.42, (K.pitch / 90) * 0.5);        // bù cho độ nghiêng
    return met;
  }
  function zoomBamTuyenMet(map: any, K: { met: number; pitch: number }): number {
    const c = route.current;
    if (c.length < 2) return map.getZoom();
    const lat = c[Math.floor(c.length / 2)][1];
    const met = khungMetCuaKieu(K);
    const rong = (map.getContainer?.()?.clientWidth) || 960;
    const mpp = Math.max(0.05, met / rong);
    const z = Math.log2((156543.03392 * Math.cos((lat * Math.PI) / 180)) / mpp);
    return Math.max(0, Math.min(18, z));   // tầm bay tới 100.000 km thì mức phóng phải xuống tận 0 (nhìn cả quả địa cầu)
  }
  function zoomBamTuyen(map: any, zAll: number, phan = 0.16): number {
    let z = Math.min(16.5, Math.max(zAll + 0.8, 12));
    try {
      const doan = routeAt(phan);
      if (doan.length >= 2) {
        const bs = new maplibregl.LngLatBounds(doan[0] as any, doan[0] as any); doan.forEach((q) => bs.extend(q as any));
        const cf: any = map.cameraForBounds(bs, { padding: 150, maxZoom: 17 });
        if (cf?.zoom) z = Math.min(17, Math.max(11, cf.zoom));
      }
    } catch { /* ignore */ }
    return z;
  }
  // Hoạt ảnh THEO KỊCH BẢN + TIMELINE: mỗi kịch bản có đường bay camera RIÊNG (điều khiển từng khung).
  async function animateCamera(map: any, D: number) {
    const rr = renderRef.current; const cl = rr.clips || clips; const total = Math.max(200, D);
    const key = rr.camKey || 'vitri';
    if (key === 'custom' && (rr.camKeys?.length || 0) >= 2) { await animateKeyframes(map, total, cl, rr); return; }
    if (laDanDuong(key) && route.current.length >= 2) { await animateDirections(map, total, cl, rr, key); return; }
    const kf = CAM[key] || CAM.vitri;
    const b = bounds(); if (b) map.fitBounds(b, { padding: CAM_PAD[key] ?? 170, duration: 0, maxZoom: 18, pitch: 0, bearing: 0 });
    await sleep(300);
    const zf = map.getZoom(); const bear0 = map.getBearing();
    const apply = (p: number) => {
      const c = camAt(kf, p); let bear = bear0 + c.bear;
      if (rr.camTarget) { const ctr = map.getCenter(); const b = bearingToParcel([ctr.lng, ctr.lat]); if (b !== null) bear = b; }
      try { map.jumpTo({ zoom: Math.max(3, Math.min(18, zf + c.dz)), pitch: c.pitch, bearing: bear }); } catch { /* ignore */ }
    };
    apply(0); // khung mở đầu theo kịch bản
    // ══ ĐI CHỢ TRƯỚC CẢ ĐƯỜNG BAY ══ (trước đây chỉ kiểu "Dẫn đường" mới có bước này)
    // Ghé camera qua chừng 60 mốc dọc đường bay cho ảnh về hết, rồi mới cho máy quay lăn bánh —
    // lúc quay không phải chờ mạng tấm nào nữa.
    if (recRef.current && renderKyRef.current) {
      await nayAnhDocDuongBay(map, (giay) => apply(Math.min(1, giay / Math.max(0.001, total / 1000))), total / 1000,
        (pt) => { if (pt % 10 === 0) console.log('[nạp trước đường bay]', pt + '%'); }, () => stopRef.current);
      apply(0);
    }
    let lastPh = -1; let napLuc2 = -9999; let elTruocKB: number | null = null;
    dungTaiTruoc(); datCheDoBay(false);   // ảnh đã nạp ở bước làm nóng; lúc chạy không tải gì thêm
    const clock = startClock();           // bấm giờ sau cùng, không để trôi mất đoạn đầu
    await new Promise<void>((res) => {
      // ══ RENDER TỪNG KHUNG — CÁCH CÁC PHẦN MỀM DỰNG PHIM LÀM ══
      // Quay theo đồng hồ thật thì máy yếu vẽ không kịp, khung nào chậm là RỚT luôn → xem thấy giật,
      // mà giật kiểu đó không cách nào chữa bằng tối ưu vặt.
      // Google Earth Studio, Cesium, Blender đều làm ngược lại: bỏ đồng hồ thật đi. Đặt camera vào
      // khung số 1, CHỜ tới khi bản đồ vẽ xong hoàn toàn, chụp lấy khung đó, rồi mới sang khung số 2.
      // Máy chậm thì render lâu hơn, nhưng video xuất ra mượt tuyệt đối vì không khung nào bị rớt.
      const kyLuong = recRef.current && renderKyRef.current && !!ghiKhungRef.current;
      const FPS = fpsRef.current || 30;
      let soKhung = 0;
      const step = async () => {
        const elMs = kyLuong ? (soKhung * 1000) / FPS : clock();
        const el = elMs / 1000; elapRef.current = el;
        apply(Math.min(1, elMs / total)); // ← camera đi theo keyframe của kịch bản
        const rp = cl.route[1] > 0 ? Math.min(1, Math.max(0, (el - cl.route[0]) / cl.route[1])) : 1;
        chartProgRef.current = cl.chart[1] > 0 ? Math.min(1, Math.max(0, (el - cl.chart[0]) / cl.chart[1])) : 1;
        textVisRef.current = el >= cl.text[0] && el <= cl.text[0] + cl.text[1];
        chartVisRef.current = rr.chartOn && el >= cl.chart[0] && el <= cl.chart[0] + cl.chart[1];
        drawRouteProgress(rp);
        // (không tải ảnh trong lúc chạy — đã nạp trước hết rồi)
        if (!recRef.current) { const ph = Math.round(el * 10) / 10; if (ph !== lastPh) { lastPh = ph; setPlayhead(el); } }
        if (stopRef.current) { res(); return; } // người dùng bấm Dừng
        if (elMs < total) requestAnimationFrame(step); else res();
      };
      step();
    });
    datCheDoBay(false);
  }

  // CAMERA KEYFRAME TỰ ĐẶT: bay mượt qua các khung do người dùng chốt (theo mốc giây).
  // Nạp sẵn ảnh cho chỗ camera SẮP tới (dùng cho các kiểu bay không đi theo tuyến).
  // Lấy tâm khung hình hiện tại rồi trườn về phía trước theo đúng hướng máy đang nhìn.
  function napTruocTheoHuong(map: any) {
    try {
      const c = map.getCenter(), z = map.getZoom(), br = (map.getBearing() * Math.PI) / 180;
      const b = map.getBounds();
      const rong = b.getEast() - b.getWest(), cao = b.getNorth() - b.getSouth();
      napTruocKhungNhin(map, 2, 44);      // phủ kín khung hình + 2 ô ra ngoài mỗi mép → hết trắng ở viền
      napTruocQuanhDiem(map, c.lng, c.lat, z, 2, 24);
      for (const xa of [0.6, 1.2]) {
        const lng = c.lng + Math.sin(br) * rong * xa, lat = c.lat + Math.cos(br) * cao * xa;
        napTruocQuanhDiem(map, lng, lat, z, 1, 16);
        napTruocQuanhDiem(map, lng, lat, Math.max(10, z - 2), 1, 12);   // ảnh cho vùng xa (chân trời)
      }
    } catch { /* ignore */ }
  }

  // Cuối video camera vụt ra TOÀN CẢNH — mức phóng tụt mấy nấc một lúc nên toàn bộ ảnh đều là ảnh
  // mới, chưa từng tải → trắng xoá đúng cảnh chốt. Ảnh ở mức phóng thấp rất ít ô nên cứ nạp sẵn
  // ngay từ lúc bắt đầu bay, tốn không đáng kể mà kết video lúc nào cũng có hình.
  function napTruocToanCanh(map: any) {
    try {
      const b = bounds(); if (!b) return;
      const cam: any = map.cameraForBounds(b, { padding: 120, maxZoom: 18 });
      if (!cam) return;
      const c = Array.isArray(cam.center) ? cam.center : [cam.center.lng, cam.center.lat];
      const zCuoi = Math.round(cam.zoom);
      // Zoom ra là đi QUA từng mức phóng một: 17 → 16 → 15 → … → mức toàn cảnh. Mức nào thiếu ảnh
      // là mức đó nhoè. Nên nạp sẵn TẤT CẢ các mức trung gian, mức càng thấp thì phủ càng rộng
      // (ô ít nên rẻ), mức cao chỉ cần quanh tâm.
      for (let z = zCuoi - 1; z <= zCuoi + 5 && z <= 18; z++) {
        if (z < 8) continue;
        const banKinh = z <= zCuoi + 1 ? 4 : z <= zCuoi + 3 ? 2 : 1;   // mức toàn cảnh phủ rộng nhất, đó là khung chốt của video
        napTruocQuanhDiem(map, c[0], c[1], z, banKinh, 32);
      }
    } catch { /* ignore */ }
  }

  async function animateKeyframes(map: any, total: number, cl: any, rr: any) {
    const keys = [...(rr.camKeys || [])].sort((a: CamKeyframe, b: CamKeyframe) => a.t - b.t); if (keys.length < 2) return;
    const c0 = keys[0]; try { map.jumpTo({ center: [c0.lng, c0.lat], zoom: c0.zoom, pitch: c0.pitch, bearing: c0.bearing }); } catch { /* ignore */ }
    await sleep(200);
    let lastPh = -1; let napLuc3 = -9999; let elTruocKF: number | null = null;
    dungTaiTruoc(); datCheDoBay(false);   // ảnh đã nạp ở bước làm nóng
    const clock = startClock();           // bấm giờ sau cùng
    // Render kỹ: bỏ đồng hồ thật, chạy theo SỐ KHUNG — mỗi khung chờ bản đồ vẽ xong hẳn mới chụp.
    const kyLuong = recRef.current && renderKyRef.current && !!ghiKhungRef.current;
    const FPS = fpsRef.current || 30;
    let soKhung = 0;
    await new Promise<void>((resolve) => {
      const step = async () => {
        const elMs = kyLuong ? (soKhung * 1000) / FPS : clock();
        const el = elMs / 1000; elapRef.current = el;
        if (kyLuong) _gioVideo = el;      // mọi thứ tính theo giây VIDEO ngay từ đầu khung
        const c = camAtTime(keys, el);
        let bear = c.bearing;
        if (rr.camTarget) { const b = bearingToParcel([c.lng, c.lat]); if (b !== null) bear = b; } // luôn ngoái nhìn về lô đất
        try { map.jumpTo({ center: [c.lng, c.lat], zoom: Math.max(1, Math.min(20, c.zoom)), pitch: c.pitch, bearing: bear }); } catch { /* ignore */ }
        const rp = cl.route[1] > 0 ? Math.min(1, Math.max(0, (el - cl.route[0]) / cl.route[1])) : 1;
        chartProgRef.current = cl.chart[1] > 0 ? Math.min(1, Math.max(0, (el - cl.chart[0]) / cl.chart[1])) : 1;
        textVisRef.current = el >= cl.text[0] && el <= cl.text[0] + cl.text[1];
        chartVisRef.current = rr.chartOn && el >= cl.chart[0] && el <= cl.chart[0] + cl.chart[1];
        if (rr.tracksOn?.route ?? true) drawRouteProgress(rp); else drawRoute([]);
        // (không tải ảnh trong lúc chạy — đã nạp trước hết rồi)
        if (!recRef.current) { const ph = Math.round(el * 10) / 10; if (ph !== lastPh) { lastPh = ph; setPlayhead(el); } }
        if (stopRef.current) { resolve(); return; }
        if (elMs >= total) { resolve(); return; }
        if (kyLuong) {
          // Chờ bản đồ vẽ XONG HẲN (ảnh nền, địa hình 3D, mọi lớp) rồi mới chốt khung này vào video.
          _dungHieuUng = true;             // giữ hiệu ứng đứng yên để phép so hai lượt vẽ được chính xác
          // ══ VỪA DỰNG VỪA ĐI CHỢ TRƯỚC ══
          // Render kỹ chạy chậm hơn thời gian thật rất nhiều, nên trong lúc lo khung này thì THỪA SỨC
          // đi lấy sẵn ảnh cho khung của hai giây sau. Tới lượt nó thì ảnh đã nằm trong máy, khỏi chờ
          // mạng — đây là lý do càng về sau render càng nhanh và càng ít chỗ phải chờ.
          if (soKhung % 8 === 0) {
            try {
              const cSau: any = camAtTime(keys, Math.min(total / 1000, el + 2));
              if (cSau) {
                datCheDoBay(true);
                napTruocQuanhDiem(map, cSau.lng, cSau.lat, Math.round(cSau.zoom), dang3d.current && sucMayRef.current?.muc !== 'yeu' ? 2 : 1, dang3d.current && sucMayRef.current?.muc !== 'yeu' ? 12 : 9);
                // Dựng núi thì ảnh độ cao phải về TRƯỚC ảnh nền, nếu không mặt đất còn phẳng là chụp hỏng.
                napTruocDem(DEM_TILES, cSau.lng, cSau.lat, dang3d.current && sucMayRef.current?.muc !== 'yeu' ? 2 : 1, dang3d.current ? [12, 13] : [13]);
              }
            } catch { /* ignore */ }
          }
          doDeu.moc = performance.now();
          await choKhungThatXong(map, soKhung === 0);   // khung mở đầu là cảnh rộng nhất, cho nó nhiều thời gian nhất
          // Cảnh đã đứng yên → giờ mới cho hiệu ứng nhích đúng một nhịp, vẽ lại một lượt rồi chụp.
          _dungHieuUng = false;
          try { hieuUngRef.current?.(); } catch { /* ignore */ }
          try { if (typeof map.redraw === 'function') map.redraw(); else map.triggerRepaint(); } catch { /* ignore */ }
          await nhip0();
          try { veKhungRef.current?.(el); } catch { /* ignore */ }
          try { ghiKhungRef.current?.(); } catch { /* ignore */ }
          if (choTieuRef.current) await choTieuRef.current();     // bộ mã hoá đang ùn thì chờ nó tiêu bớt
          soKhung++;
          ghiTienDo(soKhung, Math.max(1, Math.round((total / 1000) * FPS)));
          step();
        } else requestAnimationFrame(step);
      };
      step();
    });
    datCheDoBay(false);
  }

  // ĐỒNG HỒ CHẠY THỬ — biết tạm dừng. Lúc nghỉ thì cộng dồn thời gian nghỉ rồi trừ đi,
  // nên bấm "Chạy tiếp" là chạy đúng từ chỗ vừa dừng chứ không nhảy vọt.
  function startClock(): () => number {
    const t0 = performance.now(); pauseAccRef.current = 0; pauseAtRef.current = 0; tuaBuRef.current = 0;
    return () => {
      const now = performance.now();
      if (pauseRef.current) { if (!pauseAtRef.current) pauseAtRef.current = now; }
      else if (pauseAtRef.current) { pauseAccRef.current += now - pauseAtRef.current; pauseAtRef.current = 0; }
      const nghi = pauseAccRef.current + (pauseAtRef.current ? now - pauseAtRef.current : 0);
      return now - t0 - nghi + tuaBuRef.current;   // tuaBu = kéo tua giữa chừng (kiểu YouTube)
    };
  }
  // ══ KÉO TUA NGAY KHI ĐANG CHẠY — như YouTube ══
  // Đồng hồ chạy thử vốn tính bằng "giờ hiện tại trừ giờ bắt đầu", không nhảy được. Thêm một khoản
  // BÙ vào là kéo tới đâu nhảy tới đó mà vẫn chạy tiếp bình thường, không phải dừng lại.
  const tuaBuRef = useRef(0);
  const tuaVerRef = useRef(0);          // đếm số lần kéo tua — để camera bỏ đà cũ, khỏi bị "trôi" tới chỗ mới
  function tuaKhiDangChay(giay: number) {
    tuaBuRef.current += (giay - elapRef.current) * 1000;
    tuaVerRef.current++;
    elapRef.current = giay;
    setPlayhead(Math.round(giay * 10) / 10);
  }
  // Bấm Tạm dừng / Chạy tiếp (chỉ dùng khi đang xem thử, lúc đang QUAY thì không cho dừng kẻo hỏng file).
  function togglePause() { if (!previewing || rec) return; const v = !pauseRef.current; pauseRef.current = v; setPaused(v); }
  function stopPreview() { stopRef.current = true; pauseRef.current = false; setPaused(false); }

  // Chốt khung camera hiện tại thành keyframe tại vị trí playhead.
  function captureKeyframe() { const m = mapRef.current; if (!m) return; const c = m.getCenter(); const kf: CamKeyframe = { t: Math.round(playhead * 10) / 10, lng: +c.lng.toFixed(6), lat: +c.lat.toFixed(6), zoom: +m.getZoom().toFixed(2), pitch: +m.getPitch().toFixed(1), bearing: +m.getBearing().toFixed(1) }; setCamKeys((prev) => [...prev.filter((k) => Math.abs(k.t - kf.t) > 0.05), kf].sort((a, b) => a.t - b.t)); if (camStyle !== 'custom') setCamStyle('custom'); toast.success('Đã chốt khung tại ' + kf.t + 's'); }
  // KÉO mốc camera trên dòng thời gian để đổi thời điểm (như app dựng phim).
  function beginKfDrag(kf: CamKeyframe, e: React.PointerEvent) {
    e.preventDefault(); e.stopPropagation();
    const cont = tlRef.current; if (!cont) return;
    const rc = cont.getBoundingClientRect(); const total = Math.max(1, duration);
    const mv = (ev: PointerEvent) => {
      let t = Math.max(0, Math.min(total, ((ev.clientX - rc.left) / rc.width) * total));
      t = Math.round(t * 10) / 10;
      let ok = true;
      setCamKeys((prev) => {
        if (prev.some((k) => k.t !== kf.t && Math.abs(k.t - t) < 0.05)) { ok = false; return prev; }   // đã có mốc ở đúng giây đó → không cho đè lên nhau
        return prev.map((k) => (k.t === kf.t ? { ...k, t } : k)).sort((a, b) => a.t - b.t);
      });
      if (ok) kf = { ...kf, t };
    };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
  function setKfEase(t: number, ease: string) { setCamKeys((prev) => prev.map((k) => (k.t === t ? { ...k, ease } : k))); }
  // Sửa một khung camera (thời điểm/zoom/nghiêng/xoay/kiểu chuyển).
  function editKf(t: number, patch: Partial<CamKeyframe>) { setCamKeys((prev) => prev.map((k) => (k.t === t ? { ...k, ...patch } : k)).sort((a, b) => a.t - b.t)); }
  // Ghi đè khung bằng góc nhìn bản đồ đang hiện.
  function recaptureKf(t: number) { const m = mapRef.current; if (!m) return; const c = m.getCenter(); editKf(t, { lng: +c.lng.toFixed(6), lat: +c.lat.toFixed(6), zoom: +m.getZoom().toFixed(2), pitch: +m.getPitch().toFixed(1), bearing: +m.getBearing().toFixed(1) }); toast.success('Đã ghi đè khung ' + t + 's bằng góc hiện tại'); }
  // KÉO THANH TRƯỢT sửa một khung camera (giây · phóng · nghiêng · xoay).
  // Chỉnh tới đâu bản đồ nhảy về đúng góc đó ngay tới đó — nhìn thấy liền, khỏi phải đoán.
  function tweakKf(t: number, patch: Partial<CamKeyframe>) {
    const k = camKeys.find((x) => x.t === t); if (!k) return;
    if (patch.t != null) {
      // Chỉ cho dời TRONG KHOẢNG giữa khung liền trước và khung liền sau → thứ tự các khung không bao giờ
      // đảo lộn giữa chừng lúc đang kéo (kéo mạnh tay cũng không sợ nhảy nhầm sang khung khác).
      const ks = [...camKeys].sort((a, b) => a.t - b.t); const idx = ks.findIndex((x) => x.t === t);
      const lo = idx > 0 ? Math.round((ks[idx - 1].t + 0.1) * 10) / 10 : 0;
      const hi = idx >= 0 && idx < ks.length - 1 ? Math.round((ks[idx + 1].t - 0.1) * 10) / 10 : Math.max(1, duration);
      let v = Math.max(0, Math.min(Math.max(1, duration), patch.t));
      v = hi < lo ? t : Math.max(lo, Math.min(hi, v));          // hết chỗ chen thì đứng yên
      const nt = Math.round(v * 10) / 10;
      patch = { ...patch, t: nt }; if (!previewing && !rec) setPlayhead(nt);
    }
    const nk = { ...k, ...patch }; editKf(t, patch);
    if (!previewing && !rec) mapRef.current?.jumpTo({ center: [nk.lng, nk.lat], zoom: nk.zoom, pitch: nk.pitch, bearing: nk.bearing });
  }
  // Nhảy tới khung liền trước / liền sau vạch đứng.
  function jumpKf(dir: -1 | 1) {
    const ks = [...camKeys].sort((a, b) => a.t - b.t); if (!ks.length) return;
    const k = dir > 0 ? ks.find((x) => x.t > playhead + 0.01) : [...ks].reverse().find((x) => x.t < playhead - 0.01);
    if (k) gotoKeyframe(k); else toast.info(dir > 0 ? 'Hết khung phía sau' : 'Hết khung phía trước');
  }
  function gotoKeyframe(kf: CamKeyframe) { mapRef.current?.jumpTo({ center: [kf.lng, kf.lat], zoom: kf.zoom, pitch: kf.pitch, bearing: kf.bearing }); setPlayhead(kf.t); }
  // 🔴 GHI HÀNH TRÌNH: khách di chuyển bản đồ tự do → tự ghi keyframe theo thời gian, phát lại y hệt.
  const [recPath, setRecPath] = useState(false);
  const recPathRef = useRef<{ t0: number; samples: CamKeyframe[]; timer: any } | null>(null);
  function toggleRecPath() {
    const m = mapRef.current; if (!m) return;
    if (recPath) {
      const rp = recPathRef.current; recPathRef.current = null; if (rp?.timer) clearInterval(rp.timer); setRecPath(false);
      if (rp && rp.samples.length >= 2) {
        const last = rp.samples[rp.samples.length - 1].t; const dur = Math.min(120, Math.max(3, Math.round(last)));
        setCamKeys(rp.samples.map((s) => ({ ...s, t: +Math.min(dur, s.t).toFixed(1) }))); setCamStyle('custom'); setDuration(dur);
        toast.success('Đã ghi hành trình ' + dur + 's — bấm ▶ Xem trước để chạy lại');
      } else toast.info('Hành trình quá ngắn — thử lại và di chuyển bản đồ lâu hơn');
    } else {
      setMode('none'); setCamStyle('custom'); setCamKeys([]);
      const rp: { t0: number; samples: CamKeyframe[]; timer: any } = { t0: performance.now(), samples: [], timer: null };
      const sample = () => { const c = m.getCenter(); rp.samples.push({ t: +((performance.now() - rp.t0) / 1000).toFixed(1), lng: +c.lng.toFixed(6), lat: +c.lat.toFixed(6), zoom: +m.getZoom().toFixed(2), pitch: +m.getPitch().toFixed(1), bearing: +m.getBearing().toFixed(1) }); if (rp.samples.length > 520) toggleRecPath(); };
      sample(); rp.timer = setInterval(sample, 250); recPathRef.current = rp; setRecPath(true);
      toast.info('Đang ghi… di chuyển bản đồ (kéo · lăn để zoom · GIỮ CHUỘT PHẢI kéo để nghiêng/xoay). Bấm lại để dừng.');
    }
  }

  // KỊCH BẢN "DẪN ĐƯỜNG": tổng thể → zoom cận thửa → mở ra → chạy dọc tuyến tới đích → mở rộng xem xung quanh.
  // BỘ KHUNG KỊCH BẢN "DẪN ĐƯỜNG" — đưa vào giây nào thì trả về góc máy + tiến độ tuyến của giây đó.
  // Tách riêng ra để LÚC BAY THẬT và LÚC KÉO VẠCH THỜI GIAN dùng chung một công thức, không lệch nhau.
  const choKhongPhaiBien = useRef<number[]>([]);   // các vị trí trên tuyến đã kiểm tra: hoá ra là sông/hồ, không phải biển
  const huongBienRieng = useRef<Map<number, number>>(new Map());   // hướng biển ĐO ĐƯỢC tại từng mốc
  function boKhungDanDuong(map: any, T: number, kieu = 'chiduong') {
    const K = { ...(DAN_DUONG[kieu] || DAN_DUONG.chiduong) };   // bản sao: có thể chỉnh độ nghiêng theo tầm bay
    const bAll = bounds();
    const camAll: any = (bAll && map.cameraForBounds(bAll, { padding: 120, maxZoom: 18 })) || { center: map.getCenter(), zoom: map.getZoom() };
    const cc = (c: any): [number, number] => (Array.isArray(c) ? (c as [number, number]) : [c.lng, c.lat]);
    const centerAll = cc(camAll.center); const zAll = camAll.zoom;
    let bParcel = bAll;
    if (parcel.current.length) { const bp = new maplibregl.LngLatBounds(parcel.current[0] as any, parcel.current[0] as any); parcel.current.forEach((q) => bp.extend(q as any)); bParcel = bp; }
    else { const st = route.current[0]; const bp = new maplibregl.LngLatBounds(st as any, st as any); bp.extend([st[0] + 0.0015, st[1] + 0.0015] as any); bp.extend([st[0] - 0.0015, st[1] - 0.0015] as any); bParcel = bp; }
    const camPar: any = map.cameraForBounds(bParcel, { padding: 90, maxZoom: 18 }) || camAll;
    const centerPar = cc(camPar.center); const zPar = Math.min(18, camPar.zoom + 0.2);
    // Bay càng cao thì phải DỰNG CAMERA LÊN dần (nghiêng ít lại): ở tầm 100–400 km mà vẫn nghiêng 32°
    // thì nửa khung hình chỉ toàn trời, nhìn không ra gì. Tự chỉnh theo bề ngang khung đang đặt.
    const bienOnR = !!(renderRef.current?.bienOn ?? bienOn);
    const bienHuongR = Number(renderRef.current?.bienHuong ?? bienHuong) || 90;
    const khungBienR = (renderRef.current?.bienKhung ?? bienKhung) as any[];
    const metKhungDat = khungMetCuaKieu(K);
    if (metKhungDat >= 150000) K.pitch = Math.min(K.pitch, 10);
    else if (metKhungDat >= 50000) K.pitch = Math.min(K.pitch, 18);
    else if (metKhungDat >= 20000) K.pitch = Math.min(K.pitch, 26);
    const zFollow = zoomBamTuyenMet(map, K);   // độ cao drone theo bề ngang mặt đất muốn thấy
    // ══ CÙNG MỘT CÚ DẠT, KHUNG DỌC LẠI VĂNG MẤT CHẤM ══
    // Khung ngang 16:9 rộng thênh thang nên camera dạt ngang cỡ nào chấm vẫn nằm trong.
    // Khung dọc 9:16 chỉ rộng bằng khoảng 1/3 → y hệt cú dạt đó là chấm ra khỏi mép.
    // Nên đo tỉ lệ khung đang chọn rồi giảm biên độ dạt cho vừa: dọc thì dạt nhẹ, ngang thì giữ nguyên.
    const _cvKhung: any = map.getCanvas?.();
    const _rong = _cvKhung?.clientWidth || 960, _cao = _cvKhung?.clientHeight || 540;
    const tyKhung = Math.max(0.3, Math.min(1, (_rong / Math.max(1, _cao)) / (16 / 9)));
    const tongM = daiTuyenM();                 // tổng chiều dài tuyến, mét
    const metKhung = khungMetCuaKieu(K);       // bề ngang mặt đất mà khung hình bao được, mét
    // HƯỚNG NGẮM tại mét thứ m: dây cung thẳng từ đó tới điểm cách một khung hình phía trước.
    const gocDayCung = (m: number): number => {
      // Dây cung LUÔN giữ nguyên độ dài, kể cả ở cuối tuyến. Nếu để nó ngắn dần khi sắp hết đường
      // thì hai đầu dây chụm vào nhau, góc tính ra nhảy loạn — camera quay tít ở đoạn kết.
      const L = metKhung * (K.pitch >= 62 ? 0.9 : 1.15);
      const mB = Math.max(0, Math.min(tongM, m + L));
      const mA = Math.max(0, Math.min(mB - L, Math.max(0, Math.min(tongM, m))));
      const a = diemTaiMet(mA);
      const b = diemTaiMet(mB);
      const dx = b[0] - a[0], dy = b[1] - a[1];
      if (Math.abs(dx) < 1e-12 && Math.abs(dy) < 1e-12) return 0;
      const lat = ((a[1] + b[1]) / 2) * Math.PI / 180;
      return (Math.atan2(dx * Math.cos(lat), dy) * 180) / Math.PI;
    };
    const start = route.current[0], dest = route.current[route.current.length - 1];
    const lerp = (x: number, y: number, t: number) => x + (y - x) * t;
    const lerpC = (x: [number, number], y: [number, number], t: number): [number, number] => [lerp(x[0], y[0], t), lerp(x[1], y[1], t)];
    const ss = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
    // Xoay camera theo ĐƯỜNG NGẮN NHẤT. Góc chạy từ -180 tới 180: đi từ 179° sang -179° thực ra
    // chỉ nhích 2°, nhưng tính thẳng thì thành 358° → camera quay ngoặt một vòng (lỗi "góc quay sai").
    const gocGan = (x: number, y: number, t: number) => { let d = y - x; while (d > 180) d -= 360; while (d < -180) d += 360; return x + d * t; };
    // ══ KẾ HOẠCH XOAY: tính SẴN cho cả tuyến ngay tại đây, camera cứ thế mà theo ══
    // Ngưỡng bỏ qua lấy theo BỀ NGANG MÀN HÌNH thật: một khúc lồi ra chưa tới 7% bề ngang khung hình
    // thì mắt gần như không nhận ra — cua theo nó chỉ tổ làm người xem nhức đầu.
    // Bỏ qua mọi chỗ lồi lõm nhỏ hơn 12% bề ngang khung hình, gộp các đoạn lệch nhau dưới 28°,
    // và nuốt luôn những chặng ngắn hơn MỘT khung hình → chỉ còn lại ĐÚNG những khúc cua đáng cua.
    // Nói cách khác: một khúc rẽ chỉ được xoay camera nếu sau khi rẽ còn đi thẳng ít nhất một màn hình.
    const keHoach = keHoachXoay(route.current, Math.max(12, metKhung * 0.14), 30, metKhung * 1.0);
    // Đường cong chuyển tiếp BẬC 5 (smootherstep): không những vận tốc mà cả GIA TỐC cũng bằng 0
    // ở hai đầu. Bậc 3 quen dùng vẫn còn cú "nảy" gia tốc lúc bắt đầu và lúc kết thúc — mắt bắt được
    // cái đó dưới dạng "hơi gượng". Đây là đường cong mấy bộ gimbal xịn dùng.
    const ss5 = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * t * (t * (t * 6 - 15) + 10); };
    // ══ LÒ XO GIẢM CHẤN TỚI HẠN ══ Cách một tay lái drone giỏi bám mục tiêu: tăng tốc mềm,
    // giảm tốc mềm, KHÔNG vọt quá, không bao giờ giật. f = số dao động mỗi giây — càng nhỏ càng "nặng tay".
    // Chia nhỏ bước tính để dù máy tụt khung hình (dt to) thì lò xo vẫn không bị bung.
    const buocLoXo = (x: number, v: number, dich: number, f: number, dt: number): [number, number] => {
      const w = 2 * Math.PI * f;
      const n = Math.max(1, Math.ceil(dt * 90));
      const h = dt / n;
      for (let i = 0; i < n; i++) { const a = -2 * w * v - w * w * (x - dich); v += a * h; x += v * h; }
      return [x, v];
    };
    // ══ DANH SÁCH MỐC CUA — biết TRƯỚC mỗi khúc cua nằm ở đâu, gắt bao nhiêu, có đáng làm "cú xịn" không ══
    // CÚ CUA XỊN dành riêng cho GÓC VUÔNG (85°–95°) mà đoạn đường chạy tiếp sau đó CÒN DÀI:
    // đây là kiểu khúc cua đẹp nhất trong video bất động sản (rẽ vào một con đường lớn khác),
    // đáng để camera lấy đà xoay dài hơi + lùi máy ra + ngẩng lên khoe con đường mới.
    // Còn góc vuông mà rẽ xong đường cụt ngay thì KHÔNG làm — lùi máy ra chưa kịp thấy gì đã phải rẽ tiếp.
    let cuoiKb = -1;   // nhớ kiểu ôm cua của khúc trước để khúc sau không lặp lại y hệt
    const mocCua = keHoach.slice(0, -1).map((a, i) => {
      const b = keHoach[i + 1];
      let d = b.goc - a.goc; while (d > 180) d -= 360; while (d < -180) d += 360;
      const gocCua = Math.abs(d);
      const daiTruoc = (a.d1 - a.d0) * tongM, daiSau = (b.d1 - b.d0) * tongM;
      // ══ QUAY VỀ ĐÚNG CÁCH BAY KHÚC CUA CỦA BẢN CHẠY ỔN ══
      // Có thời gian tôi nới ra cho MỌI khúc cua từ 55° đều được làm "cú cua xịn" (dạt ra, lùi máy,
      // lấy đà xoay). Kết quả: cua nào cũng có động tác, camera lắc lư gần như suốt video.
      // Giờ trả lại đúng như cũ: CHỈ góc vuông (80–100°) và phải có đoạn đường đủ dài phía sau mới
      // làm cú cua xịn — cả video chỉ vài lần, mỗi lần một kiểu (vẫn bốc trong 20 kiểu cho đỡ trùng),
      // còn lại camera xoay êm ru như bản chạy ổn.
      const laVuong = gocCua >= 80 && gocCua <= 100;
      const duDai = daiSau >= metKhung * 1.4 && daiTruoc >= metKhung * 0.8;
      const xin = laVuong && duDai;
      const manh = 1;   // đúng cường độ của bản cũ (không giảm theo độ gắt nữa)
      // Bề rộng (nửa) cửa sổ xoay, tính theo MÉT rồi đổi sang tiến độ.
      // Cú xịn: lấy đà suốt 1,25 khung hình mỗi bên → xoay rất dài hơi, rất êm.
      // Bốc kịch bản: dựa trên VỊ TRÍ khúc cua nên trông như ngẫu nhiên, nhưng chạy lại bao nhiêu lần
      // cũng ra đúng kiểu đó (xem trước thế nào thì xuất video y vậy) — mỗi khúc cua một kiểu khác nhau.
      const bam = Math.abs(Math.sin((i + 1) * 12.9898 + a.d1 * 78.233) * 43758.5453);
      let iKb = Math.floor(bam % KIEU_OM_CUA.length);
      if (iKb === cuoiKb) iKb = (iKb + 1 + Math.floor(bam * 7) % (KIEU_OM_CUA.length - 1)) % KIEU_OM_CUA.length; // hai cua liền nhau không được trùng kiểu
      cuoiKb = iKb;
      const kb = KIEU_OM_CUA[iKb];
      const wMet = xin ? metKhung * 1.6 : metKhung * (0.35 + Math.min(0.55, (gocCua / 90) * 0.5));   // như bản cũ: lấy đà 1,6 khung hình
      const w = Math.min(tongM ? wMet / tongM : 0.05, (a.d1 - a.d0) * 0.45, (b.d1 - b.d0) * 0.45);
      return { d: a.d1, w, xin, gocCua, g0: a.goc, g1: b.goc, kb, manh };
    });
    // Góc camera tại tiến độ t: giữa chặng thì ĐỨNG YÊN, tới mốc cua mới xoay — xoay theo đường cong bậc 5.
    const gocKeHoach = (t: number): number => {
      if (!keHoach.length) return routeHeading(t, K.look);
      let i = keHoach.findIndex((s) => t <= s.d1);
      if (i < 0) i = keHoach.length - 1;
      // ĐƯỜNG CONG XOAY. Cua thường: bậc 5 êm ru. CÚ CUA XỊN: thêm nhịp LẤY ĐÀ NGƯỢC —
      // camera hơi ngoái về phía ngược lại một chút rồi mới quét sang, đúng như người quay phim
      // "lấy đà" trước một cú lia. Chỉ 7% góc thôi nhưng mắt bắt được ngay, và đó chính là thứ tạo
      // cảm giác đã mắt chứ không phải xoay to hơn.
      const duong = (m2: any, u: number) => {
        if (!m2.xin) return ss5(u);
        const kieu = m2.kb?.xoay || 'layda';
        if (kieu === 'tre') return ss5(Math.max(0, (u - 0.38) / 0.62));        // giữ hướng cũ thật lâu rồi quét dứt khoát
        if (kieu === 'som') return ss5(Math.min(1, u / 0.58));                 // xoay xong sớm, ngắm sẵn hướng mới
        if (kieu === 'deu') return ss5(u);
        // Quét VƯỢT một chút qua hướng mới rồi trả lại — tật rất "người" của tay quay phim thật.
        if (kieu === 'trot') return ss5(u) + 0.08 * Math.sin(Math.PI * Math.max(0, Math.min(1, (u - 0.5) * 2)));
        // Hai nhịp: quét dứt khoát 60% góc, khựng lại nửa nhịp rồi mới quét nốt phần còn lại.
        if (kieu === 'hai') {
          if (u < 0.45) return 0.6 * ss5(u / 0.45);
          if (u < 0.6) return 0.6;
          return 0.6 + 0.4 * ss5((u - 0.6) / 0.4);
        }
        const chinh = ss5(Math.max(0, (u - 0.2) / 0.8));                       // 'layda': cú quét chính vào muộn hơn chút
        const nguoc = u < 0.4 ? -0.075 * Math.sin((u / 0.4) * Math.PI) : 0;    // + nhịp ngoái ngược lấy đà
        return chinh + nguoc;
      };
      const mSau = mocCua[i], mTruoc = mocCua[i - 1];
      if (mSau && mSau.w > 0 && t > mSau.d - mSau.w) return gocGan(mSau.g0, mSau.g1, duong(mSau, (t - (mSau.d - mSau.w)) / (2 * mSau.w)));
      if (mTruoc && mTruoc.w > 0 && t < mTruoc.d + mTruoc.w) return gocGan(mTruoc.g0, mTruoc.g1, duong(mTruoc, (t - (mTruoc.d - mTruoc.w)) / (2 * mTruoc.w)));
      return keHoach[i].goc;
    };
    // Đang ở giữa một CÚ CUA XỊN mạnh cỡ nào (0 → 1 → 0, hình quả chuông) và rẽ về phía nào.
    // Biết chiều rẽ mới dạt camera ra ĐÚNG phía ngoài khúc cua được.
    const cuaXinTai = (t: number): { do: number; chieu: number; kb: typeof KIEU_OM_CUA[number]; u: number; manh: number } => {
      for (const m of mocCua) {
        if (!m.xin || m.w <= 0) continue;
        if (t > m.d - m.w && t < m.d + m.w) {
          let d = m.g1 - m.g0; while (d > 180) d -= 360; while (d < -180) d += 360;
          const u = (t - (m.d - m.w)) / (2 * m.w);
          return { do: Math.sin(u * Math.PI), chieu: Math.sign(d), kb: m.kb, u, manh: m.manh };
        }
      }
      return { do: 0, chieu: 0, kb: KIEU_OM_CUA[0], u: 0, manh: 0 };
    };
    // Mốc thời gian TUYỆT ĐỐI (giây) → mở đầu luôn nhanh, không phụ thuộc video dài/ngắn.
    // ── MỐC THỜI GIAN THÔ (hợp cho video dài) ──
    const p1t = Math.min(0.5, T * 0.08);                      // giữ tổng thể (ngắn)
    const p2t = p1t + Math.min(1.4, T * 0.18);                // zoom tới lô (nhanh)
    // ĐOẠN NGẮM THỬA ĐẤT — dừng lại xoay quanh miếng đất cho khách nhìn kỹ. Bán đất mà chỉ
    // chạy đường không thì khách không thấy đất đâu cả. Không có lô thì bỏ qua đoạn này.
    const coLo = parcel.current.length >= 3;
    const ngamT = coLo ? Math.max(0, Math.min(renderRef.current?.ngamLo ?? 2.5, T * 0.22)) : 0;
    const pNgamT = p2t + ngamT;
    const p3t = pNgamT + Math.min(0.7, T * 0.08);             // mở ra tí, vào đầu tuyến
    // Đoạn kết dài hơn bản cũ (1,8 → 2,4 giây): kéo ra toàn cảnh là tụt 5 nấc phóng một lúc, ảnh
    // phải tải và giải mã cả mấy chục ô mới — nhanh quá thì mắt kịp thấy ảnh còn nhoè.
    const p4 = Math.max(p3t + 0.5, T - Math.min(2.4, T * 0.26)); // chạy tuyến tới trước đoạn kết
    // ── VIDEO NGẮN: CO PHẦN MỞ ĐẦU LẠI ──
    // Mấy mốc trên tính bằng GIÂY CỐ ĐỊNH nên với video 8 giây thì riêng phần mở đầu đã ngốn 4,3 giây,
    // tuyến chỉ còn 2,1 giây rồi hết — người xem tưởng "không có tuyến, chỉ thấy chấm sáng".
    // Giờ ép đoạn chạy tuyến phải chiếm ÍT NHẤT 45% thời lượng: thiếu bao nhiêu thì co toàn bộ phần
    // mở đầu lại bấy nhiêu (co đều nên vẫn đủ 4 bước, chỉ là mỗi bước nhanh hơn).
    const toiThieuTuyen = Math.min(T * 0.45, Math.max(0.4, p4 - 0.4));
    const coLai = (p4 - p3t) < toiThieuTuyen ? Math.max(0.15, (p4 - toiThieuTuyen) / Math.max(0.001, p3t)) : 1;
    const p1 = p1t * coLai, p2 = p2t * coLai, ngam = ngamT * coLai, pNgam = pNgamT * coLai, p3 = p3t * coLai;

    // ══════════════════════════════════════════════════════════════════════════════════
    // 🌊 CHỌN GÓC ĐẸP ĐỂ KHOE BIỂN — tối đa 2 lần cả video, không hơn
    // Trước tôi rải đều mấy cú vươn lên theo thời gian: cứ ~22 giây một cú, bất kể chỗ đó có đẹp hay
    // không — thành ra lạm dụng, chỗ đường quay lưng ra biển cũng vươn lên, nhìn vô duyên.
    // Giờ QUÉT TRƯỚC cả tuyến rồi chấm điểm từng chỗ, chỉ lấy 1–2 chỗ đẹp nhất. Chấm theo 4 tiêu chí,
    // đúng những gì người quay phim để ý khi tìm chỗ dừng khoe cảnh:
    //   · Biển có nằm ngay bên hông không (đường chạy DỌC bờ) — quan trọng nhất;
    //   · Đoạn đường có THẲNG không — đường đang lượn thì mở khung ra chỉ thấy loạn;
    //   · Có đang bận ÔM CUA không — đang cua mà vươn lên nữa là rối;
    //   · Trước đó có đoạn ngoằn ngoèo không — đó thường là đèo, mà đèo nhìn xuống biển thì đẹp nhất.
    // Điểm chưa tới ngưỡng thì THÔI KHÔNG KHOE, thà không có còn hơn khoe chỗ xấu.
    const mocKhoeBien: { t: number; goc: number }[] = [];
    // Cảnh khoe biển kéo dài 8 giây nên CHỈ hợp video từ 60 giây trở lên. Video ngắn mà chèn vào là
    // ngốn mất một phần bảy thời lượng cho mỗi cú, xem cụt lủn — nên video ngắn thì bỏ qua hẳn.
    if (bienOnR && tongM > 0 && T >= 60) {
      const ungVien: { t: number; diem: number }[] = [];
      for (let q = 0.1; q <= 0.9; q += 0.015) {
        const g = gocKeHoach(q);
        const lech = ((bienHuongR - g) % 360 + 540) % 360 - 180;
        const docBo = Math.abs(Math.sin((lech * Math.PI) / 180));            // 1 = biển ngay bên hông
        if (docBo < 0.6) continue;                                           // phải chạy SONG SONG bờ mới nhận
        // Đo độ thẳng bằng chính hình dáng con đường (không dùng hướng đã làm mượt — nó san phẳng
        // mất khúc cua, đo ra chỗ nào cũng thẳng).
        let beLai = 0;
        for (let k2 = -2; k2 <= 1; k2++) {
          const a1 = diemTaiTienDo(Math.max(0, Math.min(1, q + k2 * 0.02)));
          const a2 = diemTaiTienDo(Math.max(0, Math.min(1, q + (k2 + 1) * 0.02)));
          const a3 = diemTaiTienDo(Math.max(0, Math.min(1, q + (k2 + 2) * 0.02)));
          const gg1 = (Math.atan2(a2[0] - a1[0], a2[1] - a1[1]) * 180) / Math.PI;
          const gg2 = (Math.atan2(a3[0] - a2[0], a3[1] - a2[1]) * 180) / Math.PI;
          beLai += Math.abs(((gg2 - gg1) % 360 + 540) % 360 - 180);
        }
        const thang = 1 - Math.min(1, beLai / 40);        // càng ít bẻ lái càng cao điểm (không loại cứng)                              // 1 = đang chạy thẳng
        // Tránh xa mọi khúc cua đã có cảnh riêng: cảnh ôm cua và cảnh khoe biển mà chồng lên nhau thì
        // camera vừa lượn vừa ngoái, rối mắt. Trừ hẳn vùng quanh mỗi khúc cua (rộng gấp rưỡi cửa sổ cua).
        // BIỂN ĐƯỢC ƯU TIÊN HƠN CUA: không né khúc cua nữa. Chỗ nào nhìn ra biển đẹp thì cứ khoe,
        // còn cảnh ôm cua ở đó sẽ tự nhường (xem chỗ tính "manhBien" bên dưới) — cảnh biển đắt hơn
        // nhiều so với một cú lượn cua, mà cua thì cả tuyến chỗ nào cũng có.
        // Chỗ đã kiểm tra ra là SÔNG (không phải biển) thì loại thẳng.
        if (choKhongPhaiBien.current.some((x) => Math.abs(x - q) < 0.06)) continue;
        // Đèo: nhìn ngược lại 8% tuyến, đếm xem hướng đổi nhiều không.
        let ngoan = 0;
        for (let k = 1; k <= 4; k++) {
          const a = gocKeHoach(Math.max(0, q - k * 0.02)), b2 = gocKeHoach(Math.max(0, q - (k - 1) * 0.02));
          ngoan += Math.abs(((b2 - a) % 360 + 540) % 360 - 180);
        }
        const laDeo = Math.min(1, ngoan / 90);                               // 1 = vừa qua đoạn đèo quanh co
        // ƯU TIÊN ĐOẠN ĐƯỜNG THẲNG chạy dọc biển. Chỗ cua thì cảnh loạn: đường uốn éo, biển nghiêng
        // qua nghiêng lại, mở khung ra chẳng thấy gì gọn gàng. Nên "thẳng" giờ nặng ngang với "dọc bờ",
        // còn chỗ ngoằn ngoèo bị TRỪ điểm thẳng tay.
        const diem = docBo * 2.6 + thang * 1.8 - (1 - thang) * 1.2 + laDeo * 0.2;   // chạy dọc bờ được ưu tiên nhất
        ungVien.push({ t: q, diem });
      }
      ungVien.sort((a, b) => b.diem - a.diem);
      // Hướng TRUNG BÌNH của cả khúc sẽ khoe biển. Lấy trung bình thay vì hướng tức thời vì đường ven
      // biển luôn uốn lượn nhè nhẹ: bám hướng tức thời thì camera lắc theo từng khúc uốn, mặt biển
      // trong khung cứ nghiêng qua nghiêng lại. Lấy hướng trung bình thì camera đứng yên một hướng,
      // ĐƯỜNG BỜ NẰM NGANG SONG SONG với mép trên và mép dưới màn hình suốt cả cảnh.
      const gocTrungBinh = (q: number) => {
        let x = 0, y = 0;
        for (let k = -4; k <= 4; k++) {
          const g = (gocKeHoach(Math.max(0, Math.min(1, q + k * 0.012))) * Math.PI) / 180;
          x += Math.cos(g); y += Math.sin(g);
        }
        return (Math.atan2(y, x) * 180) / Math.PI;
      };
      for (const uv of ungVien) {
        if (mocKhoeBien.length >= 2) break;
        if (uv.diem < 1.15) break;                                              // chưa đủ đẹp → thôi, không khoe
        if (mocKhoeBien.some((m) => Math.abs(m.t - uv.t) < 0.3)) continue;      // hai cú phải cách xa nhau
        mocKhoeBien.push({ t: uv.t, goc: gocTrungBinh(uv.t) });
      }
      // Đã bật chế độ ven biển mà chấm mãi không ra chỗ nào thì vẫn lấy chỗ ĐẸP NHẤT có được —
      // ít nhất một cú, để người dùng thấy rõ là chế độ có chạy.
      if (!mocKhoeBien.length && ungVien.length) mocKhoeBien.push({ t: ungVien[0].t, goc: gocTrungBinh(ungVien[0].t) });
    }
    // bearTruoc = góc của khung hình trước (để vào cua cho mềm). Tua tay thì truyền null = lấy thẳng hướng tuyến.
    // Độ gắt của cua sau khi làm mượt. Phải nhớ giữa các khung hình, không thì mỗi khung tính ra
    // một con số khác nhau → mức phóng nhảy liên tục, nhìn "giật giật" ở mọi khúc cua.
    let cuaMuot: number | null = null;
    // Góc camera ở đúng khoảnh khắc VỪA BƯỚC VÀO đoạn kết. Bắt buộc phải nhớ lại một lần,
    // vì đoạn kết tính góc theo kiểu "góc lúc vào + xoay thêm bao nhiêu".
    let bearVaoKet: number | null = null;
    // Vị trí camera ĐÃ LÀM MƯỢT + mức phóng đã làm mượt. Giữ giữa các khung hình để lọc nốt
    // mấy cái giật li ti khi tuyến đi qua từng đỉnh.
    let cenMuot: [number, number] | null = null;
    let cenBam: [number, number] | null = null;   // vị trí bám tuyến đã làm mượt — KHÔNG chứa phần dạt của cú ôm cua
    let datMet = 0;          // khoảng dạt ngang đã giảm chấn (mét)
    let chieuDat = 0;        // cú cua gần nhất rẽ phía nào (+1 / -1)
    let zoomMuot: number | null = null;
    // Vận tốc của từng thứ — lò xo cần nhớ đang chạy nhanh chậm ra sao thì mới giảm tốc mềm được.
    let bearMuotN: number | null = null, bearVan = 0;
    let zoomVan = 0, pitchMuot: number | null = null, pitchVan = 0;
    const cenVan: [number, number] = [0, 0];
    let tuaDaThay = tuaVerRef.current;
    const at = (el: number, bearTruoc: number | null, dt: number | null = null) => {
      // Vừa KÉO TUA giữa chừng → bỏ hết đà cũ (vận tốc lò xo). Không bỏ thì camera "trôi" từ chỗ cũ
      // sang chỗ mới mất mấy giây, nhìn như bị kéo lê.
      if (tuaVerRef.current !== tuaDaThay) {
        tuaDaThay = tuaVerRef.current;
        cenMuot = null; zoomMuot = null; pitchMuot = null; bearMuotN = null; cuaMuot = null;
        bearVan = 0; zoomVan = 0; pitchVan = 0; cenVan[0] = 0; cenVan[1] = 0;
      }
      let center: [number, number], zoom: number, pitch: number, bearing: number, rp: number;
      if (el < p1) { center = centerAll; zoom = zAll; pitch = 0; bearing = 0; rp = 0; }                       // tổng thể (ngắn)
      else if (el < p2) { const t = ss((el - p1) / (p2 - p1)); center = lerpC(centerAll, centerPar, t); zoom = lerp(zAll, zPar, t); pitch = lerp(0, 40, t); bearing = lerp(0, -12, t); rp = 0; }   // zoom nhanh tới lô
      else if (el < pNgam) {                                                  // NGẮM & XOAY QUANH THỬA ĐẤT
        const t = ss((el - p2) / Math.max(0.001, ngam));
        center = centerPar; zoom = zPar + 0.15 * Math.sin(t * Math.PI);         // nhích vào rồi lùi ra một chút cho có hơi thở
        pitch = lerp(40, 52, Math.min(1, t * 2));                               // hạ thấp góc nhìn để thấy mặt đất và xung quanh
        bearing = -12 + K.xoayLo * t;                                           // lượn quanh lô, khoe đủ các mặt
        rp = 0;
      }
      else if (el < p3) { const t = ss((el - pNgam) / Math.max(0.001, p3 - pNgam)); center = lerpC(centerPar, start, t); zoom = lerp(zPar, zFollow, t); pitch = lerp(52, K.pitch, t); bearing = gocGan(-12 + K.xoayLo, gocKeHoach(0), t); rp = 0; }  // rời lô, vào đúng hướng chặng đầu của kế hoạch
      else if (el < p4) {                                                     // CHẠY THEO TUYẾN
        // KHỞI HÀNH ÊM, VỀ ĐÍCH ÊM: xe thật không bao giờ đang đứng yên mà vọt ngay tốc độ tối đa,
        // cũng không đang chạy mà dừng khựng. Đường cong này cho tăng tốc/giảm tốc mềm ở hai đầu,
        // giữa đoạn vẫn chạy đều — đây là thứ tạo cảm giác "quay bằng máy xịn" rõ nhất.
        const tpTho = Math.max(0, Math.min(1, (el - p3) / Math.max(0.001, p4 - p3)));
        const vao = 0.16, ra = 0.16;                       // 16% đầu để tăng tốc, 16% cuối để giảm tốc
        const tp = tpTho < vao ? (tpTho * tpTho) / (2 * vao) * (1 / (1 - (vao + ra) / 2))
          : tpTho > 1 - ra ? 1 - ((1 - tpTho) * (1 - tpTho)) / (2 * ra) * (1 / (1 - (vao + ra) / 2))
          : (vao / 2 + (tpTho - vao)) * (1 / (1 - (vao + ra) / 2));
        // Camera đứng ĐÚNG chỗ đang chạy tới (chỉ nhìn trước một chút). Trước nhìn trước tới 12% quãng
        // đường nên đoạn tuyến vừa vẽ nằm tít phía sau, ra ngoài màn hình → "không thấy đường".
        // Kiểu nghiêng sâu (sát mặt đường): camera đứng NGAY SÁT đầu tuyến đang chạy tới, chỉ nhìn
        // nhích lên trước một chút. Đứng giữa quãng như các kiểu khác thì đầu tuyến trôi ra xa,
        // nhìn cứ như đứng cách một đoạn — đúng cái cảm giác "xa quá" đang gặp.
        // ══ VỊ TRÍ CAMERA — bám ĐÚNG đầu tuyến đang chạy, KHÔNG dùng lò xo ══
        // Lò xo cho vị trí là sai lầm: nó luôn bị trễ một khoảng tỉ lệ với tốc độ, nên tuyến càng dài
        // (chạy càng nhanh) camera càng tụt lại phía sau → "chạy chậm so với dẫn tuyến", rồi mất luôn tuyến.
        // Thay bằng LÀM MƯỢT THEO KHÔNG GIAN: lấy trung bình có trọng số 3 điểm quanh chỗ đang chạy.
        // Cách này xoá được vết gấp ở mỗi đỉnh của tuyến mà KHÔNG trễ một mili-giây nào.
        const mHienTai = Math.max(0, Math.min(1, tp)) * tongM;
        const mLech = Math.max(4, metKhung * 0.08);
        const pA = diemTaiMet(mHienTai - mLech), pB = diemTaiMet(mHienTai), pC = diemTaiMet(mHienTai + mLech);
        // Camera ngắm ĐÚNG chỗ đầu tuyến đang chạy → chấm sáng nằm GIỮA khung hình.
        // Trước đây còn nhích lên trước một quãng, cộng thêm phối cảnh do camera nghiêng,
        // nên chấm sáng bị đẩy lên sát mép trên màn hình.
        let cenDich: [number, number] = [
          pA[0] * 0.22 + pB[0] * 0.56 + pC[0] * 0.22,
          pA[1] * 0.22 + pB[1] * 0.56 + pC[1] * 0.22,
        ];
        // ══ BAY LỆCH KHỎI TIM ĐƯỜNG ══
        // Drone thật KHÔNG bao giờ bay đúng trên tim đường suốt cả chặng — người lái luôn dạt qua dạt
        // lại, khi thì bay bên này khoe dãy nhà, khi thì bay bên kia lấy hậu cảnh. Bám đúng tim đường
        // mới là thứ tạo cảm giác "máy chạy trên ray". Đây là dạt NGANG, biên độ tới 1/4 bề ngang khung
        // hình, chu kỳ ~24 giây nên rất thong thả. Vào cú ôm cua thì tắt để không phá pha bay chính.
        const thoMuc = 1 - Math.min(1, cuaXinTai(Math.max(0, Math.min(1, tp))).do * 1.6);
        const gocHienTai = gocKeHoach(Math.max(0, Math.min(1, tp)));
        // Giảm còn một nửa biên độ cũ (0,24 → 0,12 bề ngang khung): vẫn thấy drone "có hồn", nhưng
        // chấm sáng đầu tuyến không bị trôi ra mép màn hình nữa.
        // Nhịp bay lượn: biên độ nhỏ lại và bị chặn cứng, để chấm đầu tuyến luôn quanh quẩn giữa khung.
        const datNgang = metKhung * 0.04 * Math.sin(el * 0.26 + 0.7) * thoMuc * tyKhung;   // dạt ngang chỉ còn phảng phất
        if (Math.abs(datNgang) > 0.01) {
          const gv = ((gocHienTai + 90) * Math.PI) / 180;
          const latR = (cenDich[1] * Math.PI) / 180;
          cenDich = [
            cenDich[0] + (Math.sin(gv) * datNgang) / (111320 * Math.cos(latR) || 1e-6),
            cenDich[1] + (Math.cos(gv) * datNgang) / 110540,
          ];
        }
        // ══ LỌC NHẸ VỊ TRÍ CAMERA ══
        // Góc xoay, mức phóng, độ nghiêng đều đã đi qua lò xo nên rất êm; riêng VỊ TRÍ thì trước đây
        // lấy thẳng điểm trên tuyến. Tuyến là đường gấp khúc: mỗi lần đi qua một đỉnh là vị trí đổi
        // hướng đột ngột một tí — dồn lại thành cảm giác rung lăn tăn suốt video.
        // Lọc thông thấp rất nhẹ (khoảng 55 phần nghìn giây) đủ triệt rung mà mắt không thấy trễ.
        // ⚠ LỖI VỪA SỬA — HAI THUẬT TOÁN GIẪM CHÂN NHAU:
        // Bộ lọc này nhớ vị trí khung trước (cenMuot). Nhưng cú ôm cua bên dưới lại GHI ĐÈ vị trí đã
        // cộng thêm khoảng dạt vào chính biến nhớ đó. Khung sau, bộ lọc lấy vị trí "đã dạt" làm điểm
        // xuất phát rồi lại cộng dạt tiếp — cứ thế CỘNG DỒN: camera trôi mỗi lúc một xa khỏi tuyến
        // (đúng cảnh "bay hẳn ra ngoài") và giằng co với bộ lọc thành rung lắc mạnh ở khúc cua.
        // Cách chữa: bộ lọc CHỈ lo vị trí bám tuyến, giữ riêng trong cenBam. Khoảng dạt của cú ôm cua
        // cộng vào SAU CÙNG, mỗi khung tính lại từ đầu, KHÔNG bao giờ ghi ngược vào bộ nhớ của bộ lọc.
        if (cenBam === null || dt === null) cenBam = cenDich;
        else {
          const k2 = 1 - Math.exp(-dt / 0.055);
          cenBam = [cenBam[0] + (cenDich[0] - cenBam[0]) * k2, cenBam[1] + (cenDich[1] - cenBam[1]) * k2];
        }
        cenDich = cenBam;          // vị trí bám tuyến ĐÃ làm mượt (chưa có dạt cua)
        center = cenBam;
        cenMuot = cenBam;
        // ══ CÚ ÔM CUA: DẠT RA PHÍA NGOÀI ══
        // Chỉ lùi máy ra sau thì mới chỉ là "thu nhỏ lại". Muốn ra dáng drone thật thì camera phải
        // ĐI VÒNG RA PHÍA NGOÀI khúc cua — như người lái ôm một vòng cung rộng để khoe cả ngã rẽ và
        // vùng xung quanh, rồi mới ập lại bám sát đường. Dạt bao nhiêu tính theo bề ngang khung hình
        // nên tuyến to nhỏ gì cũng cân đối; hết cua thì tự về 0.
        // ══ BIỂN ƯU TIÊN HƠN CUA ══
        // Tính trước xem lúc này cú khoe biển đang mạnh cỡ nào. Nếu đang giữa cảnh biển thì cảnh ôm
        // cua PHẢI NHƯỜNG (nhạt dần rồi tắt) — cảnh biển đắt hơn nhiều, còn cua thì cả tuyến chỗ nào
        // cũng có. Hết cảnh biển thì cua lại làm việc bình thường.
        let manhBien = 0;
        if (bienOnR) {
          const dsK = (khungBienR && khungBienR.length) ? khungBienR : mocKhoeBien;
          for (const mk of dsK as any[]) {
            const moc = p3 + mk.t * Math.max(0.001, p4 - p3);
            const u = (el - moc) / Math.max(3, mk.dai || 12);
            if (u > -1 && u < 1) manhBien = Math.max(manhBien, Math.cos((u * Math.PI) / 2) ** 2);
          }
        }
        const cuaNhuong = 1 - manhBien;
        const cxNgoai = cuaXinTai(Math.max(0, Math.min(1, tp)));
        // Khoảng dạt CẦN CÓ ở khung hình này (0 nếu không ở trong cú cua nào).
        let datCan = 0;
        if (cxNgoai.do > 0.001 && cxNgoai.chieu !== 0 && Math.abs(cxNgoai.kb.dat) > 0.001) {
          const tranDat = metKhung * 0.12;   // dạt vừa đủ thấy ngã rẽ, tuyến luôn nằm trong khung
          datCan = Math.max(-tranDat, Math.min(tranDat, metKhung * cxNgoai.kb.dat * cxNgoai.do * cxNgoai.manh * tyKhung)) * cuaNhuong;
          chieuDat = cxNgoai.chieu;          // nhớ rẽ phía nào, để lúc ập lại vẫn đúng hướng
        }
        // ══ (1) DẠT RA / ẬP VÀO PHẢI TỪ TỪ ══
        // Trước đây camera trượt ngang gần như tức thì theo độ gắt của cua — vào cua một cái là hất
        // sang một bên. Giờ khoảng dạt đi qua bộ giảm chấn ~0,8 giây: nghiêng người ra ngoài cua rất
        // chậm rãi rồi ập lại cũng chậm rãi, đúng kiểu người lái drone lượn một vòng cung.
        if (dt === null) datMet = datCan;
        else datMet += (datCan - datMet) * (1 - Math.exp(-dt / 0.8));
        if (Math.abs(datMet) > 0.05 && chieuDat !== 0) {
          const gocNgoaiCua = ((gocKeHoach(Math.max(0, Math.min(1, tp))) - 90 * chieuDat) * Math.PI) / 180;
          const latRad = (cenBam![1] * Math.PI) / 180;
          center = [
            cenBam![0] + (Math.sin(gocNgoaiCua) * datMet) / (111320 * Math.cos(latRad) || 1e-6),
            cenBam![1] + (Math.cos(gocNgoaiCua) * datMet) / 110540,
          ];
          // (KHÔNG ghi ngược vào cenBam — dạt chỉ là phần cộng thêm của riêng khung hình này)
        }
        zoom = zFollow; pitch = K.pitch;
        // ══ HƯỚNG CAMERA — NGẮM THEO DÂY CUNG, không bám theo tiếp tuyến của đường ══
        // Đây là chỗ trước đây sai gốc. Bám tiếp tuyến = hướng của đoạn đường ngay dưới chân:
        // đường vặt một cái là hướng đổi một cái, nên "cứ cua là quay".
        // Người lái drone thật thì NGẮM VÀO CHỖ MÌNH SẮP TỚI: kẻ một dây cung thẳng từ chỗ đang đứng
        // tới điểm cách đó đúng một khung hình phía trước. Mọi khúc vặt nằm giữa dây cung ĐỀU TỰ TRIỆT TIÊU,
        // mà đường phía trước thì luôn nằm gọn trong khung — không bao giờ mất tuyến.
        // Hướng lấy từ KẾ HOẠCH đã tính sẵn: giữa chặng thì đứng yên tuyệt đối, chỉ xoay ở đúng
        // khúc cua đã được chọn từ trước. (Lối "ngắm dây cung liên tục" thử trước đó tuy mượt nhưng
        // xoay suốt cả tuyến — đường cong nhẹ cũng bò theo, nên bỏ.)
        // ══ NHỊP THỞ CỦA DRONE ══ Người lái giỏi cỡ nào thì máy vẫn "thở": độ cao nhích lên xuống rất
        // chậm, mũi máy đảo qua lại vài phần độ. Không có nhịp này thì cảnh trông như máy chạy trên ray —
        // đúng kỹ thuật nhưng vô hồn. Ba nhịp đặt lệch chu kỳ nhau (không chia hết cho nhau) nên không
        // bao giờ lặp lại y hệt. Vào cú ôm cua thì TẮT hẳn để không phá pha bay chính.
        // Ba nhịp lên xuống chậm, chu kỳ lệch nhau (21s · 17s · 28s) nên không bao giờ lặp lại y hệt.
        // ══ NHỊP THỞ CỦA DRONE — HẠ XUỐNG MỨC RẤT NHẸ ══
        // Ba nhịp này cố ý cho camera "có hồn": nhích độ cao, ngóc lên chúi xuống, mũi máy đảo qua lại.
        // Nhưng để biên độ cũ (0,3 mức phóng · 5 độ ngả · 4 độ đảo) thì cộng với dạt ngang và cú ôm
        // cua, cả khung hình lắc lư — nhìn say. Giảm còn khoảng 1/3: vẫn không phải "máy chạy trên ray",
        // mà cảnh thì đứng vững như tay máy chuyên nghiệp.
        const thoZoom = 0.10 * Math.sin(el * 0.30) * thoMuc;              // lên xuống độ cao
        const thoNga = 1.6 * Math.sin(el * 0.37 + 1.1) * thoMuc;          // ngóc lên / chúi xuống
        const thoHuong = 1.2 * Math.sin(el * 0.22 + 2.2) * thoMuc;        // mũi máy đảo nhẹ
        // ══ (2) DẠT RA THÌ XOAY MŨI MÁY VÀO TRONG — CHẤM LUÔN Ở GIỮA KHUNG ══
        // Camera dịch sang ngang mà vẫn giữ nguyên hướng nhìn thì cả tuyến (và chấm sáng đầu tuyến)
        // trôi sang một bên khung — đúng cái gây khó chịu. Người lái drone thật khi lượn vòng cung
        // luôn XOAY MŨI MÁY về phía chủ thể để giữ nó giữa khung. Ở đây cũng vậy: dạt ngang bao nhiêu
        // mét thì xoay bù bấy nhiêu độ (tính theo tầm nhìn của khung hình), nên chấm không lệch nữa.
        const buXoay = (chieuDat !== 0 && Math.abs(datMet) > 0.05)
          ? (Math.atan2(datMet, Math.max(1, metKhung * 0.75)) * 180) / Math.PI * chieuDat : 0;
        // ══════════════════════════════════════════════════════════════════════════════
        // 🌊 CHẾ ĐỘ QUAY VEN BIỂN — làm như tay máy chuyên nghiệp quay cung đường biển
        // Ba việc, y như cách người ta quay phim du lịch:
        //   1. NGOÁI RA BIỂN: không nhìn chằm chằm dọc mặt đường nữa mà hơi xoay mũi máy về phía biển,
        //      để nửa khung hình luôn có mặt nước — chỉ ngoái khi tuyến đang CHẠY DỌC bờ (còn lúc
        //      tuyến quay lưng ra biển thì thôi, ngoái nữa là mất đường).
        //   2. CÚ VƯƠN LÊN KHOE BIỂN: vài lần trong video, camera dâng lên cao, ngả ra sau và quay
        //      hẳn ra biển chừng 3 giây — cảnh mở ra bao la rồi lại hạ xuống bám đường như cũ.
        //   3. Vào cú đó thì lùi máy ra thêm cho tuyến vẫn nằm trong khung, không bị mất dấu.
        let bienXoay = 0, bienLui = 0, bienNga = 0;
        // Đang trong cú ôm cua thì NHƯỜNG hẳn cho cua — không ngoái ra biển, không vươn lên.
        const dangOmCua = cuaXinTai(Math.max(0, Math.min(1, tp))).do;
        const nhuongCua = 1;   // KHÔNG nhường cua nữa — biển được ưu tiên (xem manhBien bên dưới: cua mới là bên nhường)
        if (bienOnR) {
          const gocDuong = gocKeHoach(Math.max(0, Math.min(1, tp)));
          // Tuyến có đang chạy dọc bờ không? So hướng đi với hướng ra biển: vuông góc (90°) nghĩa là
          // biển nằm ngay bên hông — lúc đó ngoái ra biển mới đẹp.
          let lech = ((bienHuongR - gocDuong) % 360 + 540) % 360 - 180;   // -180..180
          const docBo = Math.max(0, Math.sin((Math.abs(lech) * Math.PI) / 180));   // 1 khi vuông góc
          const phia = lech >= 0 ? 1 : -1;                                          // biển bên phải hay bên trái
          bienXoay = 26 * docBo * phia * nhuongCua;                                 // ngoái ra biển suốt đoạn dọc bờ
          // Cú vươn lên CHỈ ở mấy chỗ đã chấm là đẹp nhất (tối đa 2 lần cả video), mỗi cú 3,6 giây.
          // Có khung do người dùng chốt thì nghe theo, không thì dùng chỗ máy tự chấm.
          const dsKhung = (khungBienR && khungBienR.length)
            ? khungBienR
            : mocKhoeBien.map((m) => ({ t: m.t, huong: -1, cao: 4.4, nghieng: 16, dai: 12, goc: m.goc }));
          for (const mk of (dsKhung as any[]).filter((x) => x.zoom == null)) {
            const moc = p3 + mk.t * Math.max(0.001, p4 - p3);   // đổi vị trí trên tuyến → giây thứ mấy
            const u = (el - moc) / Math.max(3, mk.dai || 12);   // thời lượng mỗi cú (người dùng kéo được)
            if (u > -1 && u < 1) {
              const manhCu = Math.cos((u * Math.PI) / 2) ** 2 * docBo * nhuongCua;   // 0 → 1 → 0, êm ru
              // ══ XOAY TỚI ĐÚNG HƯỚNG NHÌN THẲNG RA BIỂN ══
              // Đích cần tới = hướng trung bình của khúc đường này, cộng 90° về phía biển. Vì là hướng
              // CỐ ĐỊNH (không phải hướng tức thời), camera đứng yên một hướng suốt 12 giây → đường bờ
              // nằm ngang song song mép màn hình, con đường cũng nằm ngang giữa khung.
              // Ưu tiên hướng biển ĐO ĐƯỢC tại chỗ này (chính xác nhất); không có thì lấy vuông góc với đường.
              const huongDo = mk.huong >= 0 ? mk.huong : huongBienRieng.current.get(Math.round(mk.t * 1000));
              const dichBien = huongDo != null ? huongDo : (mk.goc ?? gocDuong) + 90 * phia;
              let dLech = ((dichBien - gocDuong) % 360 + 540) % 360 - 180;
              bienXoay += dLech * manhCu;
              bienLui += (mk.cao ?? 4.4) * manhCu;                                   // bay CAO hẳn lên: khung rộng ra, thấy cả vùng biển mênh mông
              bienNga += (mk.nghieng ?? 16) * manhCu;                                    // ngả vừa phải: tuyến vẫn nằm giữa khung, biển trải lên phía trên
            }
          }
        }
        const dich = gocKeHoach(Math.max(0, Math.min(1, tp))) + thoHuong + buXoay;
        if (bearMuotN === null || dt === null) { bearMuotN = dich; bearVan = 0; bearing = dich; }   // tua tay: nhảy thẳng tới nơi
        else {
          // LÒ XO thay cho bộ giảm chấn cũ. Giảm chấn kiểu cũ xoay nhanh ngay từ nhịp đầu rồi chậm dần —
          // nhìn ra ngay là "máy tự chỉnh". Lò xo thì bắt đầu từ 0, nhanh dần, rồi chậm dần về 0:
          // đúng cách cổ tay người lái drone đẩy cần, và cũng là lý do cua bớt gượng.
          let d = dich - bearMuotN; while (d > 180) d -= 360; while (d < -180) d += 360;
          const [x2, v2] = buocLoXo(bearMuotN, bearVan, bearMuotN + d, 0.4, dt);   // 0,4 Hz = tay máy nặng, rất êm
          bearMuotN = x2; bearVan = v2; bearing = x2;
        }
        // ⚠ HIỆU ỨNG BIỂN PHẢI CỘNG Ở ĐÂY — SAU bộ giảm chấn.
        // Trước tôi cộng vào trước, thế là bộ giảm chấn (rất nặng tay, 0,4 Hz) nuốt gần hết: cú quay
        // ra biển 3,6 giây chỉ còn lại chút xíu, xem như không thấy gì. Bản thân hiệu ứng biển đã êm
        // sẵn (lên xuống theo hình chuông) nên cộng thẳng vào là vừa mượt vừa đủ đô.
        bearing += bienXoay;
        // Vào cua GẮT thì lùi máy ra một chút và ngẩng lên — đúng cái người quay phim làm để
        // người xem kịp thấy đường rẽ đi đâu. NHƯNG con số "độ gắt" nhảy lung tung giữa các khung
        // (vì mấy điểm lấy mẫu cứ trượt qua từng đỉnh của tuyến), nên phải LÀM MƯỢT nó y như góc xoay:
        // không có bước này thì mức phóng rung liên tục, nhìn giật giật rất khó chịu.
        // Độ gắt của cua sắp tới — đo NGAY TRÊN KẾ HOẠCH, nên đường lượn nhẹ ra kết quả bằng 0,
        // mức phóng đứng im. Trước đây đo trên đường thật nên số này nhảy liên tục → phóng phập phồng.
        let dCua = gocKeHoach(Math.min(1, tongM ? (mHienTai + metKhung * 0.6) / tongM : 1)) - dich;
        while (dCua > 180) dCua -= 360; while (dCua < -180) dCua += 360;
        const cuaTho = Math.abs(dCua);
        if (cuaMuot === null || dt === null) cuaMuot = cuaTho;
        else cuaMuot += (cuaTho - cuaMuot) * (1 - Math.exp(-dt / 0.85));   // đổi từ từ trong ~0,85 giây
        // CÚ CUA XỊN: lùi máy ra và ngẩng lên giữa khúc cua rồi trả về như cũ — giống hệt cú "kéo lùi
        // khoe cảnh" của người quay drone khi rẽ vào một con đường lớn. Cả hai đều đi qua lò xo nên rất êm.
        // CÚ CUA XỊN: lùi máy ra XA hẳn giữa khúc cua rồi ập lại — biên độ đủ lớn mới thành "đã mắt".
        const xin = cxNgoai.do * cxNgoai.manh * cuaNhuong;   // cua nhẹ thì động tác nhẹ; đang khoe biển thì cua nhường hẳn
        // ══ CHẶN BA THỨ HAY LÀM CAMERA "BAY RA NGOÀI" Ở KHÚC CUA GẮT ══
        // Trong bảng 20 kiểu ôm cua có mấy kiểu rất bốc: lùi máy tới 1,9 mức phóng, ngóc lên 34 độ,
        // rồi lao tới. Gặp khúc cua lớn là ba thứ dồn vào nhau: camera vọt lên cao, lùi ra xa, tuyến
        // rơi khỏi khung và khung hình lắc mạnh. Giữ cái chất của từng kiểu, nhưng chặn biên độ lại.
        // NỚI TRẦN CHO HAI ĐỘNG TÁC AN TOÀN: lùi máy (lên cao nhìn toàn cảnh) và ngóc/chúi.
        // Hai thứ này KHÔNG đẩy tuyến ra khỏi khung — lên cao còn thấy rộng hơn. Thứ từng làm camera
        // văng khỏi tuyến là DẠT NGANG, cái đó vẫn giữ chặt ở mức 12% bề ngang khung.
        // Nhờ vậy hai kiểu tương phản mới ra chất: "Lao sát mặt đường" hạ xuống nhìn ngang như ngồi
        // trong xe, còn "Vọt lên nhìn xuống / Cần cẩu vọt lên cao" thì bay lên khoe cả con đường.
        const luiToiDa = Math.max(-1.0, Math.min(1.35, cxNgoai.kb.lui));   // âm = ập xuống gần · dương = lùi lên cao
        const ngangToiDa = Math.max(-22, Math.min(22, cxNgoai.kb.ngang));  // âm = nhìn ngang (sát đường) · dương = nhìn từ trên xuống
        const apToiDa = Math.min(0.45, cxNgoai.kb.ap);                     // lao tới nhẹ thôi
        const apVao = apToiDa > 0 ? apToiDa * Math.max(0, (cxNgoai.u - 0.5) * 2) : 0;   // qua đỉnh cua thì lao tới
        const zoomDich = zFollow - Math.min(0.45, cuaMuot / 150) - luiToiDa * xin + apVao + thoZoom;
        if (zoomMuot === null || dt === null) { zoomMuot = zoomDich; zoomVan = 0; }
        else { const [z2, zv] = buocLoXo(zoomMuot, zoomVan, zoomDich, 0.38, dt); zoomMuot = z2; zoomVan = zv; }   // tay máy nặng hơn → vào cua không nảy
        zoom = zoomMuot - bienLui;   // dâng lên khoe biển: cộng sau giảm chấn cho đủ đô
        const pitchDich = Math.max(0, Math.min(85, K.pitch - Math.min(6, cuaMuot / 16) - ngangToiDa * xin + thoNga));
        if (pitchMuot === null || dt === null) { pitchMuot = pitchDich; pitchVan = 0; }
        else { const [p2, pv] = buocLoXo(pitchMuot, pitchVan, pitchDich, 0.38, dt); pitchMuot = p2; pitchVan = pv; }
        pitch = Math.max(0, Math.min(85, pitchMuot + bienNga));   // ngả máy khoe biển: cộng sau giảm chấn
        // Nét tuyến vẽ trước camera đúng NỬA KHUNG HÌNH (tính bằng mét). Trước đây vẽ trước 5% cả tuyến:
        // tuyến 10 km thì đầu nét chạy trước tận 500 m — bay tít ra ngoài màn hình, thành ra "mất dẫn tuyến".
        // Nét tuyến vẽ tới ĐÚNG chỗ camera đang ngắm (không nhích lên trước nữa) → đầu nét và chấm
        // sáng nằm CHÍNH GIỮA khung hình. Trước đây nhích trước 6% bề ngang khung, cộng thêm phối
        // cảnh của camera nghiêng nên chấm bị đẩy lên phía trên giữa màn hình.
        rp = Math.max(0, Math.min(1, tongM ? mHienTai / tongM : 1));
      }
      else if (K.ketLo) {                                                     // ĐOẠN KẾT: hạ cánh vòng quanh thửa đất
        const t = ss((el - p4) / Math.max(0.001, T - p4));
        const cen = parcelCenter() || centerAll;
        const tz = 1 - Math.pow(1 - t, 2.4);   // ra xa DỨT KHOÁT lúc đầu, khoảng 1 giây cuối gần như đứng yên → ảnh nét lên kịp
        center = lerpC(dest, cen, t); zoom = lerp(zFollow, zPar, tz); pitch = lerp(K.pitch, 52, t);
        // LỖI CŨ: lấy góc CỦA KHUNG HÌNH TRƯỚC rồi cộng thêm 70·t — mỗi khung lại cộng thêm một lần
        // nên camera quay tít mấy vòng ở đoạn kết, nhìn hoa mắt. Đúng ra phải lấy góc lúc VỪA VÀO
        // đoạn kết (nhớ một lần) rồi xoay thêm đúng 70° cho tới hết.
        if (bearVaoKet === null) bearVaoKet = bearTruoc ?? routeHeading(1, K.look);
        bearing = bearVaoKet + 70 * t;
        rp = 1;
      }
      else {
        const t = ss((el - p4) / Math.max(0.001, T - p4));
        const tz = 1 - Math.pow(1 - t, 2.4);   // như trên: ra xa dứt khoát rồi đứng yên chờ ảnh nét
        center = lerpC(dest, centerAll, t); zoom = lerp(zFollow, Math.max(3, zAll - 0.3), tz); pitch = lerp(K.pitch, 8, t);
        // Cũng vậy: xoay về hướng Bắc phải tính từ GÓC LÚC VÀO đoạn kết. Cách cũ lấy góc khung trước
        // rồi nhích dần theo t — máy chạy nhanh thì xoay nhanh, tới cuối lại giật một phát về 0.
        if (bearVaoKet === null) bearVaoKet = bearTruoc ?? routeHeading(1, K.look);
        bearing = gocGan(bearVaoKet, 0, t);
        rp = 1;
      }
      // ══ GHÉ QUA KEYFRAME NGẮM BIỂN ══
      // Camera vẫn bay theo kịch bản dẫn đường như thường. Tới gần giây của keyframe thì nó "ghé" dần
      // sang đúng góc máy đã chốt (vị trí · mức phóng · độ nghiêng · hướng xoay), giữ ở đó, rồi trả về
      // đường bay cũ — mềm mại theo hình chuông nên không có chỗ nào giật.
      if (khungBienR && khungBienR.length) {
        for (const mk of khungBienR as any[]) {
          if (mk.zoom == null) continue;                       // khung chưa chốt góc máy → bỏ qua (dùng cách tự động)
          const moc = p3 + mk.t * Math.max(0.001, p4 - p3);
          const u = (el - moc) / Math.max(3, mk.dai || 12);
          if (u <= -1 || u >= 1) continue;
          const m = Math.cos((u * Math.PI) / 2) ** 2;          // 0 → 1 → 0
          center = [center[0] + (mk.lng - center[0]) * m, center[1] + (mk.lat - center[1]) * m];
          zoom = zoom + (mk.zoom - zoom) * m;
          pitch = pitch + (mk.pitch - pitch) * m;
          bearing = gocGan(bearing, mk.bearing, m);
        }
      }
      return { center, zoom: Math.max(3, Math.min(18, zoom)), pitch, bearing, rp };
    };
    return { at, centerAll, zAll, mocKhoeBien, mocCua, p3, p4 };   // p3·p4 = giây bắt đầu/kết thúc đoạn chạy tuyến (dùng để biết khi nào tới cảnh đèo)
  }

  // ══ LẬP LỊCH TẢI ẢNH THEO KỊCH BẢN BAY ══
  // Ý tưởng: đường bay của drone đã được TÍNH SẴN TRƯỚC khi chạy (giây thứ mấy thì camera ở toạ độ
  // nào, phóng mức mấy). Vậy thì thay vì vừa bay vừa đoán, ta chạy thử cả đường bay trên giấy —
  // chỉ toán học, không vẽ gì, mất vài phần nghìn giây — rồi lập một BẢNG LỊCH:
  //     giây 0,0 → chỗ này, mức 17   ·   giây 0,3 → chỗ kia, mức 17   ·  …  ·  giây 28 → toàn cảnh, mức 13
  // Lúc bay thật, cứ nhìn bảng mà tải trước cho 8 giây sắp tới, ĐÚNG mức phóng sẽ dùng, không thừa
  // một ô nào và không thiếu ô nào. Đây là cách chắc ăn nhất, hơn hẳn lối đoán theo hướng.
  type MocLich = { t: number; lng: number; lat: number; z: number; xong?: boolean };
  function lapLichBay(bo: any, T: number, buoc = 0.3): MocLich[] {
    const lich: MocLich[] = [];
    try {
      // Hai đầu video (25% đầu: lao từ toàn cảnh vào thửa · 25% cuối: kéo ra toàn cảnh) là lúc mức
      // phóng đổi nhanh nhất — chấm mốc THƯA là hụt ảnh, thành nhoè. Nên ở hai đoạn đó chấm dày gấp 3.
      for (let t = 0; t <= T + 0.001; t += (t < T * 0.25 || t > T * 0.75) ? buoc / 3 : buoc) {
        const k = bo.at(t, null, null);
        if (!k?.center) continue;
        lich.push({ t, lng: k.center[0], lat: k.center[1], z: Math.round(k.zoom) });
      }
    } catch { /* ignore */ }
    return lich;
  }
  // Tới giây thứ `el` thì lo trước cho `truoc` giây nữa: nạp ảnh của mọi mốc trong khoảng đó.
  function taiTheoLich(map: any, lich: MocLich[], el: number, truoc = 8) {
    for (const m of lich) {
      if (m.xong || m.t < el || m.t > el + truoc) continue;
      m.xong = true;
      // Bán kính 3 ô: lúc vào cua camera quét ngang, vùng nhìn nhảy sang hướng khác — thiếu ảnh ở
      // mấy ô bên hông là khựng đúng lúc đang cua (chỗ giật nặng nhất). Nạp trước nên không tốn gì lúc bay.
      napTruocQuanhDiem(map, m.lng, m.lat, m.z, 3, 40);
      napTruocQuanhDiem(map, m.lng, m.lat, Math.max(9, m.z - 1), 2, 24);
      napTruocQuanhDiem(map, m.lng, m.lat, Math.max(9, m.z - 2), 2, 20);   // ảnh mức thấp cho vùng xa / chân trời
      napTruocQuanhDiem(map, m.lng, m.lat, Math.max(8, m.z - 3), 2, 16);   // và mức thấp hơn nữa — dùng khi kéo ra toàn cảnh
      napTruocQuanhDiem(map, m.lng, m.lat, Math.max(8, m.z - 4), 1, 10);
    }
  }

  // ══ ĐỘ MỊN CỦA BẢN ĐỒ — chỗ này quyết định MƯỢT hay GIẬT khi xem khung lớn ══
  // Màn hình càng to thì máy phải vẽ càng nhiều điểm ảnh: khung ngang mở rộng có thể gấp 4–8 lần
  // khung dọc nhỏ. Đó chính là lý do khung dọc chạy êm mà khung ngang lớn lại giật.
  // Cách chữa của mọi phần mềm dựng phim: lúc XEM THỬ thì hạ độ mịn cho chạy mượt, lúc QUAY THẬT
  // mới kéo độ mịn lên cho nét. Người xem thử không cần từng chi tiết, còn video xuất ra thì cần.
  function datDoMin(cheDo: 'xem' | 'quay' | 'dung') {
    const m = mapRef.current; if (!m || typeof (m as any).setPixelRatio !== 'function') return;
    try {
      const cv = m.getCanvas();
      const rongCss = cv.clientWidth || 960;
      const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
      let ti = dpr;
      if (cheDo === 'xem') {
        // KHÔNG hạ độ mịn khi xem thử nữa. Hạ xuống thì ảnh mờ hẳn mà vẫn giật — tức giật không nằm ở
        // khâu vẽ ảnh, hạ chỉ tổ làm xấu. Giữ đúng độ nét của máy.
        return;
      } else if (cheDo === 'quay') {
        // Quay thật: canvas phải đủ rộng so với khung video (1920 hoặc 1280) để ảnh không bị phóng mờ.
        const rongVideo = dims().W;
        ti = Math.max(1, Math.min(2, rongVideo / Math.max(1, rongCss)));
      }
      doMinRef.current = ti;
      dungKhungRef.current = { tong: 0, dem: 0, lanCuoi: Date.now() };
      (m as any).setPixelRatio(ti);
    } catch { /* ignore */ }
  }

  // ══ TỰ ĐO ĐỘ MƯỢT — MÁY YẾU THÌ TỰ HẠ ĐỘ MỊN CHO ĐẾN KHI HẾT GIẬT ══
  // Không đoán mò máy khoẻ hay yếu nữa: cứ chạy rồi ĐO. Đếm thời gian giữa các khung hình; nếu
  // khung nào cũng lâu hơn 20 mili giây (tức dưới 50 hình/giây) thì hạ độ mịn xuống một nấc.
  // Hạ tới khi nào chạy êm thì thôi (thấp nhất 45% — dưới nữa thì mờ quá). Đang quay video thì
  // KHÔNG hạ, vì chất lượng video quan trọng hơn.
  const doMinRef = useRef(1);
  const dungKhungRef = useRef({ tong: 0, dem: 0, lanCuoi: 0 });
  // QUAN TRỌNG: chỉ ĐO, TUYỆT ĐỐI KHÔNG đổi độ mịn giữa chừng.
  // Đổi độ mịn khiến bản đồ phải cấp lại vùng vẽ — màn hình CHỚP TRẮNG một nhịp và khựng theo.
  // Bản trước tôi cho nó tự chỉnh trong lúc đang chạy, thành ra vừa giật vừa chớp. Giờ chỉ ghi nhớ
  // máy chạy nhanh chậm cỡ nào, rồi LẦN CHẠY SAU mới đặt mức phù hợp ngay từ đầu (đặt một lần duy nhất).
  const mucNhoRef = useRef<number | null>(null);
  function doMuot(dt: number | null, dangQuay: boolean) {
    if (!dt || dangQuay) return;
    const st = dungKhungRef.current;
    st.tong += dt; st.dem++;
    if (st.dem < 40) return;
    const tb = st.tong / st.dem;                   // giây/khung trung bình
    st.tong = 0; st.dem = 0;
    if (tb > 0.024) mucNhoRef.current = Math.max(0.6, (mucNhoRef.current ?? doMinRef.current) * 0.85);
    else if (tb < 0.0135) mucNhoRef.current = Math.min(1, (mucNhoRef.current ?? doMinRef.current) * 1.06);
  }

  async function animateDirections(map: any, total: number, cl: any, rr: any, kieu = 'chiduong') {
    const T = total / 1000;
    let bo = boKhungDanDuong(map, T, kieu);
    try { map.jumpTo({ center: bo.centerAll, zoom: bo.zAll, pitch: 0, bearing: 0 }); } catch { /* ignore */ }
    await sleep(250);
    let lastPh = -1; let bearMuot: number | null = null; let elTruoc: number | null = null;
    let dtMuot: number | null = null;   // nhịp khung hình đã làm mượt
    // ══ KIỂM TRA THẬT: MẤY CHỖ ĐỊNH KHOE BIỂN CÓ PHẢI BIỂN KHÔNG ══
    // Thuật toán chọn cảnh chỉ nhìn hướng nên có lúc nhầm con sông là biển. Ở đây đo ĐỘ CAO MẶT ĐẤT
    // ra xa tới 11 km về phía biển: vẫn là mặt nước thì mới đúng biển, còn gặp đất liền cao lên thì
    // đó là sông — ghi nhớ lại rồi dựng khung lần nữa để bỏ chỗ đó đi.
    try {
      if ((renderRef.current?.bienOn ?? bienOn) && (bo as any).mocKhoeBien?.length) {
        const boSung: number[] = [];
        for (const mk of (bo as any).mocKhoeBien) {
          const p = routePos(mk.t);
          const kq = await doHuongBien(p[0], p[1]);
          if (kq === null) continue;                       // không đo được → cứ để nguyên, dùng hướng người dùng chọn
          if (kq.huong < 0) { boSung.push(mk.t); continue; }  // nước chỉ liền vài km → sông, bỏ chỗ này
          huongBienRieng.current.set(Math.round(mk.t * 1000), kq.huong);   // nhớ hướng biển thật ở chỗ này
        }
        if (boSung.length) {
          choKhongPhaiBien.current = [...choKhongPhaiBien.current, ...boSung];
          bo = boKhungDanDuong(map, T, kieu);        // dựng lại khung, lần này bỏ mấy chỗ là sông
        }
      }
    } catch { /* ignore */ }
    // Ảnh đã được bước "làm nóng bản đồ" (chạy ngay trước đó) nạp đủ cho cả đường bay rồi, nên ở đây
    // KHÔNG nạp lại lần nữa — trước có hai lần nạp liên tiếp, người dùng phải chờ hai lượt.
    await chuanBiDiaHinh(map, bo, T);          // dựng sẵn núi 3D cho mấy cảnh cần — làm xong hết rồi mới bay
    // ĐƯA CAMERA VỀ ĐÚNG KHUNG ĐẦU rồi chờ ảnh về đủ.
    // Mấy bước dò ảnh phía trên để camera nằm lung tung sát mặt đất. Không kéo nó về chỗ cũ và chờ
    // cho tử tế thì khung hình đầu tiên chụp phải cảnh sát đất còn sót lại — đầu video thành ra
    // "đã ở ngay lô đất", mất hẳn đoạn từ toàn cảnh lao vào.
    try {
      const k0: any = bo.at(0, null, null);
      if (k0?.center) map.jumpTo({ center: k0.center, zoom: k0.zoom, pitch: k0.pitch, bearing: k0.bearing });
    } catch { /* ignore */ }
    await choAnhVe(map, 4000);
    dungTaiTruoc(); datCheDoBay(false);        // dọn sạch: lúc bay không còn việc chạy nền
    // ĐỒNG HỒ BẤM CUỐI CÙNG — sau khi mọi việc chuẩn bị xong.
    // Trước đây bấm đồng hồ TRƯỚC lúc chờ tải, nên tải xong là video đã trôi mất mấy giây đầu
    // (mất luôn đoạn ngắm lô đất). Giờ chuẩn bị xong hết mới bấm giờ chạy.
    const clock = startClock();
    // ══ RENDER TỪNG KHUNG — CÁCH CÁC PHẦN MỀM DỰNG PHIM LÀM ══
    // Quay theo đồng hồ thật thì máy yếu vẽ không kịp, khung nào chậm là RỚT luôn → xem thấy giật,
    // mà giật kiểu đó không cách nào chữa bằng tối ưu vặt.
    // Google Earth Studio, Cesium, Blender đều làm ngược lại: bỏ đồng hồ thật đi. Đặt camera vào
    // khung số 1, CHỜ tới khi bản đồ vẽ xong hoàn toàn, chụp lấy khung đó, rồi mới sang khung số 2.
    // Máy chậm thì render lâu hơn, nhưng video xuất ra mượt tuyệt đối vì không khung nào bị rớt.
    const kyLuong = recRef.current && renderKyRef.current && !!ghiKhungRef.current;
    const FPS = fpsRef.current || 30;
    let soKhung = 0;
    // Nạp sẵn ảnh cả đường bay (xem chú thích ở hàm animateCamera) — một lần, trước khi quay.
    if (kyLuong) {
      await nayAnhDocDuongBay(map, (giay) => {
        const kk = bo.at(Math.min(total / 1000, giay), null, null);
        if (kk?.center) { try { map.jumpTo({ center: kk.center, zoom: kk.zoom, pitch: kk.pitch, bearing: kk.bearing }); } catch { /* ignore */ } }
      }, total / 1000, (pt) => { if (pt % 10 === 0) console.log('[nạp trước đường bay]', pt + '%'); }, () => stopRef.current);
    }
    await new Promise<void>((resolve) => {
      const step = async () => {
        const elMs = kyLuong ? (soKhung * 1000) / FPS : clock();
        const el = elMs / 1000; elapRef.current = el;
        if (kyLuong) _gioVideo = el;      // mọi thứ tính theo giây VIDEO ngay từ đầu khung
        // ══ NHỊP KHUNG HÌNH KHÔNG BAO GIỜ ĐỀU — PHẢI LÀM MƯỢT TRƯỚC KHI DÙNG ══
        // Trình duyệt gọi vẽ khi 14ms, khi 19ms, thỉnh thoảng 30ms. Đưa thẳng con số nhấp nhô đó vào
        // các bộ lọc chuyển động thì camera nhích lúc nhanh lúc chậm — mắt bắt được ngay, thành "giật"
        // dù máy vẫn chạy đủ khung hình. Nên lấy trung bình trượt của nhịp khung: chuyển động đều tăm tắp.
        // Render từng khung thì nhịp giữa hai khung LUÔN đúng bằng 1/30 giây — chuyển động đều tăm tắp.
        const dtTho = kyLuong ? (elTruoc === null ? null : 1 / FPS)
          : (elTruoc === null ? null : Math.min(0.2, Math.max(0.001, el - elTruoc)));
        elTruoc = el;
        if (dtTho !== null) dtMuot = dtMuot === null ? dtTho : dtMuot + (dtTho - dtMuot) * 0.15;
        const dt = dtTho === null ? null : (dtMuot ?? dtTho);
        const bearKhungTruoc = bearMuot;
        const k = bo.at(el, bearMuot, dt); bearMuot = k.bearing;
        // Đang cua mạnh hay không thì cứ nhìn TỐC ĐỘ XOAY của camera: xoay 35°/giây trở lên coi như
        // đang giữa khúc cua. (Dùng cách này vì bảng mốc cua nằm bên trong bộ tính khung, ngoài này không với tới.)
        let dBear = (bearKhungTruoc === null ? 0 : k.bearing - bearKhungTruoc);
        while (dBear > 180) dBear -= 360; while (dBear < -180) dBear += 360;
        const dangCua = Math.min(1, Math.abs(dBear) / Math.max(0.001, dt ?? 0.016) / 35);
        // ══ ĐỊA HÌNH 3D: CHỈ BẬT ĐÚNG LÚC CẦN ══
        // Núi nổi khối rất đẹp, nhưng dựng địa hình 3D là việc NẶNG: máy phải tải thêm ảnh độ cao rồi
        // uốn cong từng ô ảnh nền theo mặt đất. Bật suốt video thì cảnh tổng quát (nhìn cả tỉnh, hàng
        // trăm ô ảnh) sẽ giật.
        // Mà cảnh tổng quát nhìn từ trên xuống thì có 3D cũng chẳng thấy gì — phẳng lì.
        // Nên: cảnh tổng quát để PHẲNG (2D) cho nhẹ, chỉ dựng 3D khi camera hạ xuống thấp và ngả nhiều
        // (đúng lúc thấy sườn núi), và luôn dựng ở mấy giây quanh khung cảnh đèo.
        can3d(map, k, el, bo);
        // Đặt camera MỘT LẦN DUY NHẤT mỗi khung hình — không ai kéo giật nó nữa.
        try { map.jumpTo({ center: k.center, zoom: k.zoom, pitch: k.pitch, bearing: k.bearing }); } catch { /* ignore */ }
        // ══ VÌ SAO KHÔNG CÒN "DÂY AN TOÀN" NỮA ══
        // Bản trước mỗi khung đo xem chấm nằm đâu rồi bù camera lại một chút. Nghe thì hay, nhưng đó
        // là một VÒNG PHẢN HỒI: camera nhích → chấm nhích → lại bù → cứ thế rung khe khẽ suốt video,
        // đúng kiểu "giật giật đau mắt" mà không phải do máy yếu.
        // Giờ chặn ngay từ gốc: giới hạn biên độ dạt của camera (bên dưới), nên chấm không bao giờ
        // đi quá xa giữa khung — mà camera thì chạy trơn tru đúng như công thức, không ai kéo giật nó.
        // (KHÔNG tải ảnh gì trong vòng lặp này — mọi thứ đã nạp xong từ trước khi cất cánh.)
        chartProgRef.current = cl.chart[1] > 0 ? Math.min(1, Math.max(0, (el - cl.chart[0]) / cl.chart[1])) : 1;
        textVisRef.current = el >= cl.text[0] && el <= cl.text[0] + cl.text[1];
        chartVisRef.current = rr.chartOn && el >= cl.chart[0] && el <= cl.chart[0] + cl.chart[1];
        drawRouteProgress(k.rp, undefined, true);   // dẫn đường: nét tuyến chạy ĐÚNG nhịp với drone
        if (!recRef.current) { const ph = Math.round(el * 10) / 10; if (ph !== lastPh) { lastPh = ph; setPlayhead(el); } } // đang quay thì không cập nhật (mượt hơn)
        if (stopRef.current) { resolve(); return; }
        if (elMs >= total) { resolve(); return; }
        if (kyLuong) {
          // Chờ tới khi bản đồ báo "vẽ xong" (thường 20–60 phần nghìn giây vì ảnh đã nạp sẵn),
          // tối đa 1,5 giây cho khung nào phải tải thêm. KHÔNG chờ cứng — chờ cứng thì 3.600 khung
          // của video 2 phút sẽ ngốn hàng giờ.
          _dungHieuUng = true;             // giữ hiệu ứng đứng yên để phép so hai lượt vẽ được chính xác
          // ══ VỪA DỰNG VỪA ĐI CHỢ TRƯỚC ══
          // Render kỹ chạy chậm hơn thời gian thật rất nhiều, nên trong lúc lo khung này thì THỪA SỨC
          // đi lấy sẵn ảnh cho khung của hai giây sau. Tới lượt nó thì ảnh đã nằm trong máy, khỏi chờ
          // mạng — đây là lý do càng về sau render càng nhanh và càng ít chỗ phải chờ.
          if (soKhung % 8 === 0) {
            try {
              const kSau: any = bo.at(Math.min(total / 1000, el + 2), null, null);
              if (kSau?.center) {
                datCheDoBay(true);
                napTruocQuanhDiem(map, kSau.center[0], kSau.center[1], Math.round(kSau.zoom), dang3d.current && sucMayRef.current?.muc !== 'yeu' ? 2 : 1, dang3d.current && sucMayRef.current?.muc !== 'yeu' ? 12 : 9);
                // Dựng núi thì ảnh độ cao phải về TRƯỚC ảnh nền, nếu không mặt đất còn phẳng là chụp hỏng.
                napTruocDem(DEM_TILES, kSau.center[0], kSau.center[1], dang3d.current && sucMayRef.current?.muc !== 'yeu' ? 2 : 1, dang3d.current ? [12, 13] : [13]);
              }
            } catch { /* ignore */ }
          }
          doDeu.moc = performance.now();
          await choKhungThatXong(map, soKhung === 0);   // khung mở đầu là cảnh rộng nhất, cho nó nhiều thời gian nhất
          // Cảnh đã đứng yên → giờ mới cho hiệu ứng nhích đúng một nhịp, vẽ lại một lượt rồi chụp.
          _dungHieuUng = false;
          try { hieuUngRef.current?.(); } catch { /* ignore */ }
          try { if (typeof map.redraw === 'function') map.redraw(); else map.triggerRepaint(); } catch { /* ignore */ }
          await nhip0();
          try { veKhungRef.current?.(el); } catch { /* ignore */ }
          try { ghiKhungRef.current?.(); } catch { /* ignore */ }
          if (choTieuRef.current) await choTieuRef.current();     // bộ mã hoá đang ùn thì chờ nó tiêu bớt
          soKhung++;
          ghiTienDo(soKhung, Math.max(1, Math.round((total / 1000) * FPS)));
          step();
        } else requestAnimationFrame(step);
      };
      step();
    });
    datCheDoBay(false);   // bay xong: trả bộ tải trước về mức nhẹ nhàng
  }

  // ══ TUA: kéo vạch thời gian tới giây nào thì BẢN ĐỒ NHẢY TỚI ĐÚNG CẢNH của giây đó ══
  // (camera bay tới đâu, tuyến đường đã chạy tới đâu, chữ/biểu đồ hiện hay chưa).
  function tuaToiGiay(el: number) {
    const map = mapRef.current; if (!map || previewing || rec || busyAll) return;
    const rr = renderRef.current; const cl = rr.clips || clips;
    const D = Math.max(1, duration); const t = Math.max(0, Math.min(D, el));
    const key = rr.camKey || 'vitri';
    let rp = cl.route[1] > 0 ? Math.min(1, Math.max(0, (t - cl.route[0]) / cl.route[1])) : 1;
    try {
      if (key === 'custom' && (rr.camKeys?.length || 0) >= 2) {                 // camera tự chốt khung
        const c = camAtTime(rr.camKeys, t);
        map.jumpTo({ center: [c.lng, c.lat], zoom: Math.max(1, Math.min(20, c.zoom)), pitch: c.pitch, bearing: c.bearing });
      } else if (laDanDuong(key) && route.current.length >= 2) {                // kịch bản Dẫn đường (mọi kiểu)
        const k = boKhungDanDuong(map, D, key).at(t, null);
        map.jumpTo({ center: k.center, zoom: k.zoom, pitch: k.pitch, bearing: k.bearing });
        rp = k.rp;
      } else {                                                                  // các kịch bản còn lại
        const b = bounds();
        const cam: any = b ? map.cameraForBounds(b, { padding: CAM_PAD[key] ?? 170, maxZoom: 18 }) : null;
        const ctr: any = cam ? (Array.isArray(cam.center) ? cam.center : [cam.center.lng, cam.center.lat]) : map.getCenter();
        const zf = cam?.zoom ?? map.getZoom();
        const c = camAt(CAM[key] || CAM.vitri, t / D);
        let bear = c.bear;
        if (rr.camTarget) { const bb = bearingToParcel((Array.isArray(ctr) ? ctr : [ctr.lng, ctr.lat]) as [number, number]); if (bb !== null) bear = bb; }
        map.jumpTo({ center: ctr, zoom: Math.max(3, Math.min(18, zf + c.dz)), pitch: c.pitch, bearing: bear });
      }
    } catch { /* ignore */ }
    drawRouteProgress(rp);
    elapRef.current = t;
    chartProgRef.current = cl.chart[1] > 0 ? Math.min(1, Math.max(0, (t - cl.chart[0]) / cl.chart[1])) : 1;
    textVisRef.current = t >= cl.text[0] && t <= cl.text[0] + cl.text[1];
    chartVisRef.current = rr.chartOn && t >= cl.chart[0] && t <= cl.chart[0] + cl.chart[1];
  }

  // Thu GIỌNG ĐỌC từ micro (bấm lần nữa để dừng). Không lên máy chủ.
  async function recVoice() {
    if (voiceRec) { try { voiceMediaRef.current?.stop(); } catch { /* ignore */ } return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: BlobPart[] = []; mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      mr.onstop = () => { stream.getTracks().forEach((t) => t.stop()); const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' }); setVoice(new File([blob], 'voice.webm', { type: blob.type })); setVoiceRec(false); toast.success('Đã thu giọng đọc'); };
      voiceMediaRef.current = mr; mr.start(); setVoiceRec(true); toast.info('Đang thu… bấm ■ để dừng');
    } catch { toast.error('Không truy cập được micro'); setVoiceRec(false); }
  }

  // Phóng khung xem trước ra TOÀN MÀN HÌNH (và thu lại). Bọc try/catch vì trình duyệt có thể
  // từ chối (vd: trang nhúng chưa được cấp quyền) — từ chối thì vẫn xem bình thường, không lỗi.
  async function moToanManHinh(): Promise<void> {
    const el: any = stageRef.current; if (!el || typeof document === 'undefined') return;
    try {
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        await (el.requestFullscreen?.({ navigationUI: 'hide' }) ?? el.webkitRequestFullscreen?.());
      }
    } catch { /* trình duyệt từ chối → bỏ qua, xem ở khung thường */ }
    setTimeout(() => { try { mapRef.current?.resize(); } catch { /* ignore */ } }, 150);
  }
  function thoatToanManHinh(): void {
    if (typeof document === 'undefined') return;
    try {
      if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
        (document.exitFullscreen?.() ?? (document as any).webkitExitFullscreen?.());
      }
    } catch { /* ignore */ }
    setTimeout(() => { try { mapRef.current?.resize(); } catch { /* ignore */ } }, 150);
  }

  // XEM TRƯỚC: chạy hoạt ảnh trên bản đồ, KHÔNG quay/xuất.
  // KHÔNG tự phóng toàn màn hình nữa — muốn xem to thì bấm nút ⛶ Toàn màn hình ở thanh trên.
  async function preview() {
    const map = mapRef.current; if (!map || rec || previewing) return;
    if (!chotQuyen('xem')) return;
    if (!parcel.current.length && route.current.length < 2 && !zones.current.length && !callouts.current.length) { toast.error('Hãy vẽ lô đất, khoanh vùng hoặc vẽ tuyến trước'); return; }
    setMode('none'); setPreviewing(true); stopRef.current = false; pauseRef.current = false; setPaused(false);
    datDoMin('xem');    // xem thử: hạ độ mịn cho chạy mượt (nhất là khi mở khung lớn)
    // BẢN DÙNG THỬ: canh đồng hồ, tới giây thứ 8 là dừng và mời nâng cấp.
    let dongHo: any = null;
    if (!coQuyen && duration > THU_GIAY) {
      dongHo = setInterval(() => {
        if (elapRef.current >= THU_GIAY) { clearInterval(dongHo); dongHo = null; stopRef.current = true; setMoiNangCap('het-thu'); }
      }, 120);
    }
    try {
      await warmTiles(map);
      if (stopRef.current) { dungTaiTruoc(); datCheDoBay(false); toast.info('Đã dừng'); return; }   // bấm Dừng giữa lúc nạp → thôi luôn
      // Trong lúc đang nạp ảnh, người dùng hay bấm thêm phát nữa (tưởng máy đứng) — cú bấm đó rơi vào
      // nút "tạm dừng" nên nạp xong video nằm im, phải bấm lại lần nữa mới chạy. Gạt lại mấy cờ này
      // ngay trước khi cất cánh để lần bấm đầu tiên là chạy luôn.
      pauseRef.current = false; setPaused(false);
      await animateCamera(map, Math.max(4, duration) * 1000);
    }
    finally { if (dongHo) clearInterval(dongHo); datDoMin('dung'); setPreviewing(false); stopRef.current = false; pauseRef.current = false; setPaused(false); traLai3d(); try { map.easeTo({ pitch: 0, bearing: 0, duration: 500 }); } catch { /* ignore */ } }
  }

  // Kéo PLAYHEAD để tua tới thời điểm bất kỳ (bấm/kéo trên nền timeline).
  function scrubAt(clientX: number) {
    const cont = tlRef.current; if (!cont) return; const rc = cont.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientX - rc.left) / rc.width)) * duration;
    setPlayhead(Math.round(t * 10) / 10);
    tuaToiGiay(t);            // ← bản đồ nhảy tới đúng cảnh của giây đó (camera + tuyến chạy dần)
  }
  function scrubStart(e: React.PointerEvent) { if (rec) return; scrubAt(e.clientX); const mv = (ev: PointerEvent) => scrubAt(ev.clientX); const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); }

  // Tua theo MỘT thanh bất kỳ (thước giây dưới dòng thời gian, thanh tua trong khung video…).
  // Tính theo đúng bề ngang của thanh vừa bấm — trước đây thanh trong khung video mượn kích thước
  // của dòng thời gian nên phóng to dòng thời gian là bấm ra sai giây.
  function scrubOnRect(rc: DOMRect, clientX: number, snap: boolean) {
    const total = Math.max(1, duration);
    let t = Math.max(0, Math.min(1, (clientX - rc.left) / rc.width)) * total;
    if (snap) { for (const m of snapTimes()) if (Math.abs(t - m) < total * 0.012) { t = m; break; } }
    t = Math.round(t * 10) / 10;
    // Đang chạy thử → nhảy tới giây đó rồi CHẠY TIẾP (không dừng, không phải bấm lại) — kiểu YouTube.
    if (previewing && !rec) { tuaKhiDangChay(t); return t; }
    setPlayhead(t); tuaToiGiay(t); return t;
  }
  // Các mốc để núm thời gian HÍT vào cho dễ canh: đầu/cuối video · khung camera · lời thoại · clip · đầu mỗi cảnh.
  function snapTimes() { const a: number[] = [0, Math.max(1, duration)]; camKeys.forEach((k) => a.push(k.t)); subs.forEach((x) => { a.push(x.s, x.e); }); objects.forEach((o) => { a.push(o.s, o.e); }); scenes.forEach((_, i) => a.push(sceneStart(i))); return a; }
  // KÉO NÚM THỜI GIAN (giọt vàng có ghi số giây). Giữ Shift trong lúc kéo = không hít vào mốc nào.
  function beginPlayheadDrag(e: React.PointerEvent, el?: HTMLElement | null) {
    e.preventDefault(); e.stopPropagation(); if (rec) return;
    const box = el || tlRef.current; if (!box) return; const rc = box.getBoundingClientRect();
    const mv = (ev: PointerEvent) => { scrubOnRect(rc, ev.clientX, !ev.shiftKey); };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
  // Nhích thời gian từng nấc 1/10 giây bằng nút ◀ ▶ (canh cho thật chuẩn khi chốt khung camera).
  function nudgePlayhead(d: number) { if (previewing || rec) return; const t = Math.round(Math.max(0, Math.min(duration, playhead + d)) * 10) / 10; setPlayhead(t); tuaToiGiay(t); }
  // Nhảy thẳng tới một giây (gõ số hoặc kéo thanh trượt trong bảng Camera).
  function gotoGiay(t: number) { if (previewing || rec) return; const v = Math.round(Math.max(0, Math.min(duration, t || 0)) * 10) / 10; setPlayhead(v); tuaToiGiay(v); }

  // Kéo clip trên timeline (dời / co cạnh trái / co cạnh phải).
  function beginDrag(track: 'route' | 'text' | 'chart' | 'music', edge: 'move' | 'l' | 'r', e: React.PointerEvent) {
    e.preventDefault(); const cont = tlRef.current; if (!cont) return;
    const wpx = cont.getBoundingClientRect().width; const total = Math.max(1, duration); const startX = e.clientX;
    const [os, od] = (clips as any)[track];
    // Điểm HÍT (snap): đầu/cuối video · playhead · cạnh các clip khác.
    const targets = [0, total, Math.round(playhead * 10) / 10];
    (['route', 'text', 'chart', 'music'] as const).forEach((tk) => { if (tk !== track) { const c = (clips as any)[tk]; if (c) { targets.push(c[0], c[0] + c[1]); } } });
    const thr = total * 0.02 + 0.15; const snap = (v: number) => { for (const t of targets) { if (Math.abs(v - t) < thr) return t; } return v; };
    const onMove = (ev: PointerEvent) => {
      const dSec = ((ev.clientX - startX) / wpx) * total; let s = os, d = od;
      if (edge === 'move') { s = Math.min(total - od, Math.max(0, os + dSec)); s = snap(s); const en = snap(s + od); if (en !== s + od) s = Math.min(total - od, Math.max(0, en - od)); }
      else if (edge === 'l') { s = Math.min(os + od - 0.5, Math.max(0, snap(os + dSec))); d = od + (os - s); }
      else { d = Math.min(total - os, Math.max(0.5, snap(os + od + dSec) - os)); }
      setClips((c) => ({ ...c, [track]: [Math.round(s * 10) / 10, Math.round(d * 10) / 10] }));
    };
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
  }

  async function record(collect = false): Promise<Blob | null> {
    const map = mapRef.current; if (!map) return null;
    if (!chotQuyen('tai')) return null;
    if (!parcel.current.length && route.current.length < 2 && !markers.current.length && !radii.current.length && !dists.current.length && !callouts.current.length && !zones.current.length) { toast.error('Hãy vẽ lô/tuyến hoặc thêm điểm trước'); return null; }
    // Xin chỗ lưu NGAY khi vừa bấm nút — trình duyệt chỉ cho mở hộp thoại chọn file ngay sau cú bấm.
    // Có chỗ lưu thì video được ghi thẳng xuống đĩa, bộ nhớ máy gần như không phải gánh gì.
    let choLuu: any = null;
    // Ghi THẲNG xuống đĩa chỉ làm được khi video không có tiếng — có tiếng thì còn một bước ghép
    // nữa, phải giữ bản hình trong bộ nhớ đã.
    if (renderKyRef.current && !audio && !voice && !(renderRef.current.sfx || []).length) {
      choLuu = await xinChoLuu('video-ban-do.mp4');
    }
    setMode('none'); setRec(true); recRef.current = true; stopRef.current = false;
    datDoMin('quay');   // quay thật: kéo độ mịn lên cho video nét
    const r = renderRef.current; // chốt cấu hình quay tại thời điểm này
    // Khổ video phải CHẴN cả hai cạnh — bộ mã hoá H.264 từ chối cạnh lẻ, mà từ chối là hỏng khung.
    const d0 = dims();
    const W = Math.floor(d0.W / 2) * 2, H = Math.floor(d0.H / 2) * 2;
    // Bộ mã hoá WebCodecs nén tốt hơn hẳn máy ghi cũ, nên nâng độ nét lên mà file vẫn không quá nặng.
    // Cảnh bản đồ nhiều chi tiết nhỏ (nhà cửa, cây cối) rất "ăn" dữ liệu — thiếu là ảnh nhoè bệt.
    // Độ nét cao thì đẹp, nhưng cả file phải nằm trong bộ nhớ máy cho tới lúc lưu — video dài mà để
    // quá cao là bộ nhớ phình, bộ mã hoá nghẹt rồi hỏng khung. Nên video càng dài thì hạ bớt.
    const dai = Math.max(4, Number(r.duration) || 8);
    const bitrate = r.res === '720'
      ? (dai > 90 ? 6_000_000 : 8_000_000)
      : (dai > 90 ? 9_000_000 : dai > 45 ? 13_000_000 : 18_000_000);
    const comp = document.createElement('canvas'); comp.width = W; comp.height = H;
    const ctx = comp.getContext('2d')!;
    const mapCanvas: HTMLCanvasElement = map.getCanvas();
    const cdata = r.chartOn ? parseChart(r.chartRaw) : []; // dữ liệu biểu đồ (chốt lúc bấm quay)
    chartProgRef.current = 0;
    const sc = Math.min(W, H) / 1080; // hệ số co theo cạnh ngắn (đúng cho mọi khổ dọc/vuông/ngang)

    function frame() {
      // MÀN MỞ ĐẦU / KẾT THÚC: những giây đầu (và cuối) không vẽ bản đồ, chỉ nền động + chữ.
      const elNow = elapRef.current, D = Math.max(4, r.duration);
      const iv: ScreenCard | undefined = r.intro, ov: ScreenCard | undefined = r.outro;
      if (iv?.on && iv.dur > 0 && elNow < iv.dur) { drawScreen(ctx, W, H, iv, elNow / iv.dur, elNow, introImgRef.current); drawFade(ctx, W, H, elNow, D, r.moDongMan !== false); return; }
      if (ov?.on && ov.dur > 0 && elNow > D - ov.dur) { drawScreen(ctx, W, H, ov, (elNow - (D - ov.dur)) / ov.dur, elNow, outroImgRef.current); drawFade(ctx, W, H, elNow, D, r.moDongMan !== false); return; }
      // Nền trời→đất lấp vùng tile chưa tải (phòng hờ cho cả máy không hỗ trợ setSky).
      const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#a6c4e2'); bg.addColorStop(0.55, '#cdd8e0'); bg.addColorStop(1, '#aeb6ad'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      try { ctx.drawImage(mapCanvas, 0, 0, W, H); } catch { /* ignore */ }
      // NHÌN ĐIỆN ẢNH: phủ màu + tối 4 góc NGAY SAU khi vẽ bản đồ, TRƯỚC khi vẽ chữ —
      // để chữ, ghim, biểu đồ vẫn trong trẻo, chỉ ảnh nền được "chỉnh màu".
      drawGrade(ctx, W, H, r.grade, r.toiGoc);
      // Chữ hiện đúng clip; logo luôn hiện. Biểu đồ hiện đúng clip.
      const useBrand = isPro && !!brandImgRef.current; // bản miễn phí luôn giữ logo web (chữ)
      const to = r.tracksOn || { text: true, chart: true }; const showText = textVisRef.current && to.text;
      // Tiến độ hiện chữ. Kiểu "chạy chậm" (đánh máy, lộ dần, quét sáng, đóng dấu) cho 1,4 giây để nhìn rõ hiệu ứng.
      const tcl = (r.clips || clips).text; const tdur = ['typewriter', 'wipe', 'shine', 'stamp'].includes(r.textAnim) ? 1.4 : 0.6;
      const tap = (r.textAnim === 'none') ? 1 : Math.max(0, Math.min(1, (elapRef.current - tcl[0]) / tdur)); // tiến độ hiện chữ
      drawOverlay(ctx, W, H, layoutRef.current, showText ? r.title : '', showText ? r.sub : '', r.logo && !useBrand, r.textAnim || 'fade', tap, r.logoStyle || 'vienthuoc', r.logoPos || 'auto', r.chuKieu || 'thuong');
      if (r.logo && useBrand) { const im = brandImgRef.current!; const lh = Math.round(84 * sc); const lw = Math.round(lh * ((im.width / im.height) || 3)); const mg = Math.round(40 * sc); ctx.drawImage(im, W - lw - mg, mg, lw, lh); } // logo tuỳ chỉnh (góc trên phải)
      if (cdata.length && chartVisRef.current && to.chart) drawChart(ctx, W - 560 * sc - 40 * sc, 130 * sc, 560 * sc, 300 * sc, cdata, chartProgRef.current, r.chartTitle, r.chartType, (r.chartSeries || '').split(',').map((x: string) => x.trim()));
      const el = elapRef.current; const cap = (r.subs || []).find((x: Sub) => el >= x.s && el <= x.e); if (cap?.t) drawSub(ctx, W, H, cap.t);
      if (qrImgRef.current) { const qs = Math.round(180 * sc), m = Math.round(36 * sc), pad = Math.round(10 * sc), x = W - qs - m, y = H - qs - m; ctx.fillStyle = '#fff'; roundRect(ctx, x - pad, y - pad, qs + pad * 2, qs + pad * 2, Math.round(12 * sc)); ctx.fill(); ctx.drawImage(qrImgRef.current, x, y, qs, qs); }
      (r.objects || []).forEach((o: Obj) => {
        let oo = o;                                              // object đã ghim đất thì vị trí tính lại theo bản đồ
        let g = o.geo as [number, number] | undefined; let deg: number | null = null;
        const duongDi = (o.duong && o.duong.length > 1) ? o.duong : route.current;
        // Đứng yên một chỗ: neo tại phần trăm đã chọn trên tuyến (xem chú thích ở phần xem trước).
        if (!o.runRoute && typeof o.viTri === 'number' && duongDi.length > 1) {
          const rp0 = linePosDir(duongDi, Math.max(0, Math.min(1, o.viTri)));
          if (rp0) { g = rp0.at; if (o.faceDir) deg = rp0.deg; }
          datGocXe(o.faceDir ? 'tren' : '34');
        }
        if (o.runRoute && duongDi.length > 1) {
          const tocQ = Math.max(0.1, o.toc ?? 1);
          const tuNhien = ((el - o.s) / Math.max(0.001, o.e - o.s)) * tocQ;
          // Có chốt vị trí thì nghe theo chốt, không thì cứ chạy đều như cũ.
          const coChotViTri = (o.chot || []).some((c) => typeof c.viTri === 'number');
          const pr = Math.max(0, Math.min(1, coChotViTri ? giaTriChot(o, el, 'viTri', tuNhien) : tuNhien));
          const rp = linePosDir(duongDi, pr); if (rp) { g = rp.at; if (o.faceDir) deg = rp.deg; } datGocXe(o.faceDir ? 'tren' : '34');   // quay đầu → ảnh nhìn từ trên; không thì ảnh chéo 3/4
        }
        if (g) { try { const cont = map.getContainer(); const pt = map.project(g as any); oo = { ...o, x: pt.x / (cont.clientWidth || 1), y: pt.y / (cont.clientHeight || 1), rot: deg !== null ? deg : o.rot }; } catch { /* ignore */ } }
        // Video chèn cũng phải chạy theo GIÂY CỦA VIDEO. Render kỹ thì một giây video ngốn mấy giây
        // thật, cứ để nó tự phát thì trong clip nó chạy nhanh vọt lên rồi lệch hẳn khỏi cảnh.
        const vid = objVidRef.current[o.id];
        if (vid && recRef.current && renderKyRef.current) {
          try {
            if (!vid.paused) vid.pause();
            const dai = vid.duration || 0;
            const t = Math.max(0, el - o.s);
            const muon = dai > 0 ? t % dai : t;                       // video ngắn thì lặp lại
            if (Math.abs(vid.currentTime - muon) > 0.03) vid.currentTime = muon;
          } catch { /* ignore */ }
        }
        drawObj(ctx, W, H, oo, objImgRef.current[o.id] || vid, el);
      });
      // ── CHẤM SÁNG ĐẦU TUYẾN ── vẽ tay vào khung hình, vì lớp HTML không lọt vào ảnh bản đồ.
      const cd = chamViTriRef.current;
      if (cd && (r.routeHead !== false)) {
        try {
          const cont = map.getContainer();
          // Lấy vị trí từ chính chấm HTML mà bản đồ đã đặt sẵn — nó tính cả độ cao địa hình 3D.
          // Nếu tính lại bằng map.project thì khi bật núi 3D, chấm sẽ rơi xuống chân núi trong khi
          // tuyến đường nằm trên sườn — hai thứ lệch hẳn nhau (đúng lỗi vừa thấy).
          let sx = 0, sy = 0, coCham = false;
          const elCham: HTMLElement | null = chamDauRef.current?.getElement?.() || null;
          if (elCham && elCham.style.display !== 'none') {
            const rc = elCham.getBoundingClientRect(), rk = cont.getBoundingClientRect();
            if (rc.width > 0) {
              sx = ((rc.left + rc.width / 2 - rk.left) / (rk.width || 1)) * W;
              sy = ((rc.top + rc.height / 2 - rk.top) / (rk.height || 1)) * H;
              coCham = true;
            }
          }
          if (!coCham) {
            const pt = map.project(cd as any);
            sx = (pt.x / (cont.clientWidth || 1)) * W; sy = (pt.y / (cont.clientHeight || 1)) * H;
          }
          if (sx > -50 && sy > -50 && sx < W + 50 && sy < H + 50) {
            const mau = r.routeColor || routeColRef.current || '#ff5a2c';
            const R = Math.max(6, Math.round(W / 190));         // to nhỏ theo khổ video cho cân
            ctx.save();
            ctx.shadowColor = mau; ctx.shadowBlur = R * 2.6;    // quầng sáng
            ctx.beginPath(); ctx.arc(sx, sy, R * 1.55, 0, Math.PI * 2);
            ctx.fillStyle = mau; ctx.fill();
            ctx.shadowBlur = 0;
            ctx.beginPath(); ctx.arc(sx, sy, R, 0, Math.PI * 2);
            ctx.fillStyle = '#fff'; ctx.fill();
            ctx.restore();
          }
        } catch { /* ignore */ }
      }
      drawFade(ctx, W, H, el, D, r.moDongMan !== false);   // mở màn / đóng màn — vẽ sau cùng, phủ lên tất cả
    }
    // ── RENDER KỸ: KHÔNG vẽ theo đồng hồ nữa ──
    // Chế độ thường: vòng lặp dưới đây vẽ liên tục hết sức máy, ai theo kịp thì theo.
    // Chế độ render kỹ: vòng lặp này NGHỈ. Bộ bay camera sẽ tự gọi vẽ đúng một lần cho mỗi khung
    // hình, sau khi bản đồ đã vẽ xong hẳn — nên không khung nào bị vẽ dở.
    // Giọng đọc và tiếng động NAY KHÔNG CÒN cản render kỹ nữa: cả ba thứ tiếng (nhạc, giọng đọc,
    // tiếng động) được dựng sẵn thành một bản tiếng hoàn chỉnh ở bước cuối rồi ghép vào — xem
    // dungTiengOffline(). Nhờ vậy dù kịch bản có lồng tiếng, hình vẫn quay theo kiểu render kỹ,
    // không còn cảnh đứng hình rồi nhảy vọt trên máy yếu.
    const kyLuong = renderKyRef.current;
    let running = !kyLuong;
    const loop = () => { if (!running) return; frame(); map.triggerRepaint(); requestAnimationFrame(loop); };
    if (!kyLuong) requestAnimationFrame(loop);
    else { doDeu.bat = true; doDeu.xoa(); veKhungRef.current = () => { frame(); doDeu.ghi(comp); }; }

    // Ưu tiên quay THẲNG MP4 (iPhone/Safari + Chrome mới dùng mã hoá phần cứng) → khỏi cần chuyển đổi. Không hỗ trợ thì WebM.
    const mime = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => (window as any).MediaRecorder?.isTypeSupported?.(m)) || '';
    const isMp4 = mime.includes('mp4');
    // Trộn NHẠC/tiếng (từ file nhạc hoặc video) vào NGAY lúc quay → video ra đã có nhạc, không cần ghép sau.
    // ── MÁY GHI ──
    // Render kỹ: ưu tiên máy ghi WebCodecs (tự đóng dấu thời gian từng khung → video ra ĐÚNG thời
    // lượng dù render mất bao lâu). Trình duyệt không có thì đành dùng máy ghi thường.
    const fpsQ = kyLuong ? (fpsRef.current || 30) : 30;
    // Render lâu, để máy tự ngủ hay tắt màn là công toi. Xin trình duyệt giữ màn hình sáng.
    let khoaNgu: any = null;
    try { khoaNgu = await (navigator as any)?.wakeLock?.request?.('screen'); } catch { /* máy không hỗ trợ thì thôi */ }
    // ── DỰNG TIẾNG TRƯỚC ──
    // Trộn nhạc + giọng đọc + tiếng động thành một bản tiếng dài đúng bằng video. Làm trước để bản
    // tiếng đi THẲNG vào cùng file với hình, khỏi phải nén lại lần hai ở bước sau.
    // Việc này tính rất nhanh (không phải phát ra loa giây nào) nên không làm chậm lúc bấm quay.
    let tiengGoc: any = null;
    if (kyLuong && (audio || voice || (r.sfx || []).length)) {
      try {
        const mus = r.clips?.music || clips.music;
        tiengGoc = await dungTiengOffline({
          nhac: audio, giong: voice, sfx: r.sfx || [], thoiLuong: Math.max(4, r.duration),
          nhacTu: mus?.[0] ?? 0, nhacDai: mus?.[1], batNhac: r.tracksOn?.music ?? true,
        });
      } catch (e) { console.warn('[dựng tiếng]', e); }
      if (!tiengGoc) toast.info('Máy chưa dựng được phần tiếng — video sẽ không có tiếng');
    }
    let mayChuan = kyLuong ? await taoMayGhiChuan(W, H, fpsQ, bitrate, choLuu, tiengGoc) : null;   // đúng khổ của khung ghép
    if (mayChuan) {
      // Vẽ thử một khung rồi nén thử luôn. Nén được thì mới đi tiếp; không thì bỏ máy ghi này, dùng
      // cách ghi thường — biết ngay từ giây đầu, khỏi render cả tiếng rồi mới phát hiện hỏng.
      try { frame(); } catch { /* ignore */ }
      if (!mayChuan.thuTruoc(comp)) {
        mayChuan.huy(); mayChuan = null;
        toast.info('Máy này không nén được kiểu chuẩn — chuyển sang cách ghi thường');
      }
    }
    if (mayChuan) { const mc = mayChuan; ghiKhungRef.current = () => mc.ghiKhung(comp); choTieuRef.current = () => mc.choTieu(); }
    const luong: MediaStream = mayChuan ? new MediaStream() : (comp as any).captureStream(kyLuong ? 0 : 30);
    let tracks: MediaStreamTrack[] = mayChuan ? [] : luong.getVideoTracks();
    if (kyLuong && !mayChuan) {
      const tr: any = tracks[0];
      // requestFrame() = "chốt khung này lại" — máy quay chỉ ghi đúng những khung mình gọi.
      ghiKhungRef.current = () => { try { tr?.requestFrame?.(); } catch { /* ignore */ } };
    }
    let actx: any = null, musicEl: HTMLMediaElement | null = null, voiceEl: HTMLMediaElement | null = null, audioMixed = false;
    let sfxDest: any = null; const sfxList: Sfx[] = r.sfx || [];
    if (!kyLuong && (audio || voice || sfxList.length)) {
      try {
        actx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
        const destNode = actx.createMediaStreamDestination(); await actx.resume?.();
        if (audio) {
          musicEl = document.createElement(audio.type.startsWith('video') ? 'video' : 'audio') as HTMLMediaElement;
          musicEl.src = URL.createObjectURL(audio); (musicEl as any).loop = true; (musicEl as any).playsInline = true;
          const g = actx.createGain(); g.gain.value = voice ? 0.32 : 0.9; // có giọng đọc → hạ nhạc nền
          actx.createMediaElementSource(musicEl).connect(g); g.connect(destNode);
        }
        if (voice) {
          voiceEl = document.createElement('audio') as HTMLMediaElement;
          voiceEl.src = URL.createObjectURL(voice); (voiceEl as any).playsInline = true;
          const g = actx.createGain(); g.gain.value = 1.0;
          actx.createMediaElementSource(voiceEl).connect(g); g.connect(destNode);
        }
        sfxDest = destNode; // tiếng động cũng bắn vào đây → nằm sẵn trong video
        tracks = [...tracks, ...destNode.stream.getAudioTracks()]; audioMixed = true; // đưa vào luồng quay, KHÔNG ra loa
      } catch (err) { console.warn('[mix audio]', err); }
    }
    const stream = new MediaStream(tracks);
    const mr = mayChuan ? null : new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: bitrate } : { videoBitsPerSecond: bitrate });
    const chunks: BlobPart[] = []; if (mr) mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done: Promise<Blob> = mayChuan
      ? Promise.resolve(new Blob())        // máy ghi chuẩn trả file ở bước kết thúc bên dưới
      : new Promise<Blob>((res) => { mr!.onstop = () => res(new Blob(chunks, { type: isMp4 ? 'video/mp4' : 'video/webm' })); });
    await warmTiles(map); // nạp sẵn tile trước khi bắt đầu ghi → video không bị khoảng trắng
    // Video chèn: quay thường thì để nó tự phát; render kỹ thì DỪNG lại, mỗi khung mình tự tua tới
    // đúng giây cần — có vậy nó mới khớp với cảnh trong clip.
    try {
      Object.values(objVidRef.current).forEach((v) => {
        v.currentTime = 0; v.muted = true;
        if (kyLuong) { try { v.pause(); } catch { /* ignore */ } } else v.play().catch(() => {});
      });
    } catch { /* ignore */ }
    mr?.start(100);
    // Nhạc phát đúng CLIP nhạc trên timeline.
    const musT: any[] = [];
    const mus = r.clips?.music || clips.music;
    if (musicEl && (r.tracksOn?.music ?? true)) { musT.push(setTimeout(() => musicEl?.play().catch(() => {}), mus[0] * 1000)); musT.push(setTimeout(() => musicEl?.pause(), (mus[0] + mus[1]) * 1000)); }
    if (voiceEl) { voiceEl.play().catch(() => {}); } // giọng đọc phát từ đầu
    // TIẾNG ĐỘNG: hẹn giờ theo đúng mốc giây đã đặt trên dòng thời gian.
    if (actx && sfxDest && sfxList.length) { const t0a = actx.currentTime + 0.05; sfxList.forEach((x) => { try { playSfx(actx, sfxDest, x.kind, t0a + Math.max(0, x.t)); } catch { /* ignore */ } }); }

    try {
      await animateCamera(map, Math.max(4, r.duration) * 1000); // bay theo keyframe của kịch bản
    } finally {
      _dungHieuUng = false;
      try { khoaNgu?.release?.(); } catch { /* ignore */ }
      running = false; _gioVideo = null; _mocVideo = null; veKhungRef.current = null; ghiKhungRef.current = null; choTieuRef.current = null; setTienDoRender(0); mr?.stop(); musT.forEach(clearTimeout);
      try { musicEl?.pause(); voiceEl?.pause(); } catch { /* ignore */ }
      try { map.easeTo({ pitch: 0, bearing: 0, duration: 600 }); } catch { /* ignore */ } // trả về phẳng để vẽ tiếp cho chính xác
    }
    // ══ BÁO CÁO CHẤT LƯỢNG — NÓI THẬT ══
    // Render xong thì cho biết luôn có bao nhiêu khung chưa kịp hoàn hảo, thay vì im lặng để người
    // dùng tự phát hiện lúc xem. Biết số liệu thì mới biết nên render lại hay chấp nhận.
    try {
      const tk = thongKeKhung.current;
      if (tk.tong > 0) {
        console.warn(`[chất lượng] ${tk.tong} khung · chờ lâu: ${tk.choLau} · chưa kịp hoàn hảo: ${tk.chuaXong} · còn mảng trống: ${tk.conTrong} · núi chưa dựng kịp: ${tk.nuiTre}`);
        if (tk.nuiTre > tk.tong * 0.02) {
          toast.info(`Có ${tk.nuiTre} khung mặt đất 3D chưa dựng kịp — đó là chỗ hình hay nhảy. Render lại lần nữa sẽ đỡ hẳn vì ảnh độ cao đã nằm sẵn trong máy.`);
        }
        if (tk.conTrong > tk.tong * 0.02) {
          toast.info(`Có ${tk.conTrong} khung ảnh chưa về kịp (${Math.round(tk.conTrong / tk.tong * 100)}%). Mạng nhanh hơn hoặc render lại lần nữa sẽ hết — lần sau ảnh đã nằm sẵn trong máy.`);
        }
      }
      const dd = doDeu.tongKet(fpsQ);
      if (dd) {
        const g = (ds: number[]) => ds.length > 12 ? ds.slice(0, 12).join('s · ') + 's …' : ds.join('s · ') + 's';
        console.warn(`[độ đều] ${dd.soKhung} khung · mức đổi trung bình ${dd.trungBinh} · ĐỨNG HÌNH ${dd.dungHinh.length} khung · NHẢY VỌT ${dd.nhayVot.length} khung · chờ trung bình ${dd.choTB}ms · khựng vì chờ lâu: ${dd.khuenDoChoLau}`);
        if (dd.dungHinh.length) console.warn('[độ đều] khựng ở giây: ' + g(dd.dungHinh));
        if (dd.nhayVot.length) console.warn('[độ đều] nhảy ở giây: ' + g(dd.nhayVot));
        const hong = dd.dungHinh.length + dd.nhayVot.length;
        if (hong > dd.soKhung * 0.03) {
          toast.info(`Máy đo thấy ${hong} khung không đều (khựng ${dd.dungHinh.length} · nhảy ${dd.nhayVot.length}). Mở bảng điều khiển trình duyệt (phím F12) xem dòng [độ đều] để biết giây nào.`);
        }
      }
      doDeu.bat = false; doDeu.xoa();
      thongKeKhung.current = { tong: 0, choLau: 0, chuaXong: 0, conTrong: 0, nuiTre: 0 };
      setTienKhung(null);
    } catch { /* ignore */ }
    let blob: Blob; let raMp4 = isMp4;
    if (mayChuan) {
      setExporting(true); setPct(0);
      try { blob = await mayChuan.ketThuc(); raMp4 = true; }
      catch (e) { console.error('[WebCodecs]', e); mayChuan.huy(); blob = new Blob(); }
      finally { setExporting(false); }
      if (mayChuan.raDia) {
        toast.success('Đã ghi xong video vào đúng chỗ bạn chọn — mở thư mục đó là thấy file MP4');
        setRec(false); recRef.current = false; return null;
      }
      if (!blob.size) { toast.error('Không ghi được video — thử tắt Render kỹ rồi quay lại'); setRec(false); recRef.current = false; return null; }
    } else blob = await done;
    datDoMin('dung'); setRec(false); recRef.current = false;
    try { if (musicEl?.src) URL.revokeObjectURL(musicEl.src); if (voiceEl?.src) URL.revokeObjectURL(voiceEl.src); actx?.close?.(); } catch { /* ignore */ }
    // Tiếng đã được nhét thẳng vào file lúc ghi rồi thì khỏi làm gì thêm. Máy nào không nén được
    // tiếng theo cách đó thì mới đóng bản tiếng thành file WAV rồi ghép bằng bộ chuyển đổi.
    const tiengRieng: Blob | null = (tiengGoc && !mayChuan?.coTieng) ? wavTuBuffer(tiengGoc) : null;
    if (tiengRieng) toast.info('Máy này ghép tiếng theo cách chậm hơn một chút — chờ thêm chút xíu');
    if (collect) return await finishToMp4(blob, raMp4, audioMixed, tiengRieng); // xuất cả bộ: trả blob để nén ZIP
    await exportVideo(blob, raMp4, audioMixed, tiengRieng); return null;
  }

  // Đưa bản quay về MP4 (nếu cần đổi từ WebM). Trả về blob MP4, hoặc WebM khi máy không đổi được.
  async function finishToMp4(blob: Blob, isMp4: boolean, audioMixed: boolean, tiengRieng?: Blob | null): Promise<Blob> {
    // Có bản tiếng dựng sẵn thì ghép nó vào — hình chỉ chép lại chứ không nén lại nên rất nhanh.
    if (tiengRieng) {
      setExporting(true); setPct(0);
      try { return await ghepTiengVaoMp4(blob, tiengRieng, (p) => setPct(Math.round(p * 100))); }
      catch (e) { console.error('[ghép tiếng]', e); toast.error('Không ghép được phần tiếng — đã giữ bản hình'); return blob; }
      finally { setExporting(false); }
    }
    // Quay kiểu render kỹ thì nhạc CHƯA nằm trong video (lúc quay không phát nhạc) → phải ghép vào đây,
    // dù file đã là MP4 sẵn.
    if (isMp4 && (audioMixed || !audio)) return blob;
    setExporting(true); setPct(0);
    try { return await encodeMp4Browser(blob, audioMixed ? null : audio, (p) => setPct(Math.round(p * 100))); }
    catch (e: any) { console.error('[wasm]', e); return blob; }
    finally { setExporting(false); }
  }

  async function exportVideo(blob: Blob, isMp4: boolean, audioMixed: boolean, tiengRieng?: Blob | null) {
    if (!tiengRieng && isMp4 && (audioMixed || !audio)) { dl(blob, 'video-ban-do.mp4'); toast.success('Đã xuất MP4 — quay thẳng trên máy bạn, không lên máy chủ'); return; }
    toast.info(tiengRieng ? 'Đang ghép phần tiếng vào video…' : 'Đang xuất MP4 ngay trên máy bạn…');
    const out = await finishToMp4(blob, isMp4, audioMixed, tiengRieng);
    if (out.type.includes('mp4')) { dl(out, 'video-ban-do.mp4'); toast.success('Đã xuất MP4 — xử lý & lưu tại máy bạn, không lên máy chủ'); }
    else { toast.info('Máy chưa đổi được MP4 — đã lưu bản WebM tại máy bạn (vẫn xem/đăng & cắt ghép được).'); dl(out, 'video-ban-do.webm'); }
  }

  // XUẤT CẢ 5 VIDEO → nén ZIP. Quay TUẦN TỰ từng kịch bản (không nặng cùng lúc), gom lại rồi tải 1 file.
  async function exportAll() {
    if (!chotQuyen('tai')) return;
    const map = mapRef.current; if (!map || rec || exporting || busyAll) return;
    if (!parcel.current.length && route.current.length < 2 && !markers.current.length && !radii.current.length && !dists.current.length && !callouts.current.length && !zones.current.length) { toast.error('Hãy vẽ lô/tuyến hoặc thêm điểm trước'); return; }
    const savedActive = activeScript; const savedSettings = settingsNow();
    const all = commitActive(); setScripts(all);   // chốt chỉnh sửa đang dở của kịch bản đang mở, không thì nó bị quay bằng cài đặt cũ
    setBusyAll(true); setMode('none');
    const files: { name: string; blob: Blob }[] = [];
    try {
      for (let i = 0; i < all.length; i++) {
        setActiveScript(i); applySettings(all[i].settings);
        await sleep(750); // đợi đổi khổ + map resize + renderRef cập nhật theo kịch bản
        toast.info(`Đang xuất ${i + 1}/${all.length}: ${all[i].name}`);
        const blob = await record(true);
        if (blob) files.push({ name: `${String(i + 1).padStart(2, '0')}_${KEYSLUG[all[i].key] || slugName(all[i].name)}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`, blob });
      }
      if (!files.length) { toast.error('Không quay được video nào'); return; }
      toast.info('Đang nén ZIP…');
      const mod: any = await import('jszip');
      const JSZip = mod.default || mod; const zip = new JSZip();
      files.forEach((f) => zip.file(f.name, f.blob));
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      dl(zipBlob, `${slugName(property.name || 'du-an')}.zip`);
      toast.success(`Đã xuất ${files.length} video (ZIP) — lưu tại máy bạn, không lên máy chủ`);
    } catch (e: any) { console.error('[exportAll]', e); toast.error('Lỗi xuất bộ video: ' + (e?.message || '')); }
    finally { setBusyAll(false); setActiveScript(savedActive); applySettings(savedSettings); }
  }

  // XUẤT THEO TỪNG LOẠI MÀN HÌNH — quay lại kịch bản ĐANG MỞ cho mỗi khổ đã chọn.
  // Cùng một dự án, một lần bấm ra đủ file cho YouTube · TikTok · Instagram… khỏi phải chỉnh tay từng khổ.
  async function exportTheoKho() {
    const map = mapRef.current; if (!map || rec || exporting || busyAll) return;
    if (!khoXuat.length) { toast.info('Chọn ít nhất một khổ màn hình'); return; }
    if (!parcel.current.length && route.current.length < 2 && !markers.current.length && !radii.current.length && !dists.current.length && !callouts.current.length && !zones.current.length) { toast.error('Hãy vẽ lô/tuyến hoặc thêm điểm trước'); return; }
    const khoCu = orient;
    setBusyAll(true); setMode('none');
    const files: { name: string; blob: Blob }[] = [];
    try {
      const ten = slugName(property.name || 'video');
      for (let i = 0; i < khoXuat.length; i++) {
        const k = khoXuat[i] as any;
        setOrient(k); await sleep(800);                       // đợi khung đổi tỉ lệ + bản đồ đo lại
        toast.info(`Đang xuất ${i + 1}/${khoXuat.length}: ${KHO_MAN.find((x) => x.key === k)?.ten || k}`);
        const blob = await record(true);
        if (blob) files.push({ name: `${ten}_${String(k).replace(':', 'x')}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`, blob });
      }
      if (!files.length) { toast.error('Không quay được video nào'); return; }
      if (files.length === 1) { dl(files[0].blob, files[0].name); toast.success('Đã xuất xong — lưu tại máy bạn'); return; }
      toast.info('Đang nén ZIP…');
      const mod: any = await import('jszip');
      const JSZip = mod.default || mod; const zip = new JSZip();
      files.forEach((f) => zip.file(f.name, f.blob));
      dl(await zip.generateAsync({ type: 'blob' }), `${ten}_du-kho.zip`);
      toast.success(`Đã xuất ${files.length} khổ màn hình (ZIP) — lưu tại máy bạn`);
    } catch (e: any) { console.error('[xuat kho]', e); toast.error('Lỗi xuất: ' + (e?.message || '')); }
    finally { setBusyAll(false); setOrient(khoCu); }
  }

  // XUẤT RIÊNG 1 kịch bản (tải ngay khi người dùng đang xem tab đó). Chuyển sang kịch bản i rồi quay & tải file của nó.
  async function exportOne(i: number) {
    if (!chotQuyen('tai')) return;
    const map = mapRef.current; if (!map || rec || exporting || busyAll) return;
    if (!parcel.current.length && route.current.length < 2 && !markers.current.length && !radii.current.length && !dists.current.length && !callouts.current.length && !zones.current.length) { toast.error('Hãy vẽ lô/tuyến hoặc thêm điểm trước'); return; }
    if (i !== activeScript) { switchScript(i); await sleep(650); } else { await sleep(80); } // đợi đổi khổ + renderRef cập nhật
    toast.info(`Đang xuất: ${scripts[i].name}`);
    const blob = await record(true);
    if (blob) { dl(blob, `${String(i + 1).padStart(2, '0')}_${KEYSLUG[scripts[i].key] || slugName(scripts[i].name)}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`); toast.success(`Đã xuất ${scripts[i].name} — lưu tại máy bạn`); }
  }
  function dl(blob: Blob, name: string) { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000); }

  const btn = (active: boolean) => ({ background: active ? GOLD : FIELD, color: active ? NAVY : INK, border: '1px solid ' + (active ? GOLD : LINE), fontWeight: 600 });

  const seg = (active: boolean) => ({ background: active ? GOLD : 'transparent', color: active ? NAVY : '#cbd5e1' });
  // Vạch chia của THƯỚC GIÂY: thưa hay dày tuỳ thời lượng video và mức phóng to dòng thời gian.
  const tlStep = (() => { const want = Math.max(1, duration) / (8 * Math.max(1, tlZoom)); return [0.5, 1, 2, 5, 10, 15, 30, 60].find((c) => c >= want) || 60; })();
  const tlTicks = (() => { const a: number[] = []; for (let t = 0; t <= duration + 1e-6; t += tlStep) a.push(Math.round(t * 10) / 10); return a; })();
  const inText = playhead >= clips.text[0] && playhead <= clips.text[0] + clips.text[1]; // chữ có hiện tại vị trí playhead?
  const inChart = playhead >= clips.chart[0] && playhead <= clips.chart[0] + clips.chart[1];
  const so = objects.find((o) => o.id === selObj) || null; // object đang chọn (cho inspector)
  return (
    <div className={'cl-video-tool overflow-hidden rounded-2xl shadow-lg' + (thuGonDuoi ? ' cl-rong-khung' : '')} style={{ background: '#0f1e30', zoom: isFs || mobile ? 1 : uiScale, ['--cl-zoom' as any]: isFs || mobile ? 1 : uiScale } as any}>
      {/* THANH TRÊN */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" style={{ background: '#0b1826' }}>
        <div className="flex items-center gap-2 font-bold text-white">🎬 Tạo video bản đồ <span className="text-[11px] font-normal" style={{ color: saveState === 'saved' ? '#7bd88f' : '#94a3b8' }}>{saveState === 'saving' ? '· Đang lưu…' : saveState === 'saved' ? '· Đã lưu' : ''}</span></div>
        <div className="cl-tb-nut flex items-center gap-3">
          <div className="cl-tb-kho flex overflow-hidden rounded-lg border" style={{ borderColor: '#2a3f57' }}>
            {(['16:9', '9:16', '4:5', '1:1'] as const).map((o) => <button key={o} onClick={() => setOrient(o)} className="px-3 py-1.5 text-xs font-bold" style={seg(orient === o)} title={KHO_MAN.find((k) => k.key === o)?.note}>{o === '16:9' ? 'Ngang' : o === '9:16' ? 'Dọc' : o === '4:5' ? '4:5' : 'Vuông'}</button>)}
          </div>
          {/* CỠ GIAO DIỆN — thu nhỏ/phóng to toàn bộ công cụ cho vừa màn hình, khỏi phải chỉnh zoom của trình duyệt */}
          <div className="cl-tb-zoom flex items-center overflow-hidden rounded-lg border" style={{ borderColor: '#2a3f57' }} title="Thu nhỏ / phóng to giao diện cho vừa màn hình. Không ảnh hưởng video xuất ra.">
            <button onClick={() => setUiScale((v) => Math.max(0.5, +(v - 0.05).toFixed(2)))} className="px-2.5 py-1.5 text-sm font-bold text-slate-200 hover:bg-white/10" title="Thu nhỏ giao diện">−</button>
            <button onClick={() => setUiScale(0.8)} className="min-w-[46px] px-1 py-1.5 text-[11px] font-bold" style={{ color: GOLD }} title="Bấm để về cỡ mặc định 80%">{Math.round(uiScale * 100)}%</button>
            <button onClick={() => setUiScale((v) => Math.min(1.5, +(v + 0.05).toFixed(2)))} className="px-2.5 py-1.5 text-sm font-bold text-slate-200 hover:bg-white/10" title="Phóng to giao diện">+</button>
          </div>
          <button onClick={() => { if (typeof document !== 'undefined' && (document.fullscreenElement || (document as any).webkitFullscreenElement)) thoatToanManHinh(); else moToanManHinh(); }}
            className="rounded-lg border px-2.5 py-1.5 text-sm font-bold text-slate-200 hover:bg-white/10" style={{ borderColor: '#2a3f57' }} title="Phóng khung xem ra toàn màn hình (bấm lần nữa hoặc Esc để thu lại)">⛶</button>
          <button onClick={() => record()} disabled={!ready || rec || exporting || previewing || busyAll} className="cl-tb-xuat cl-btn-vang rounded-xl px-4 py-2 text-sm font-bold transition disabled:opacity-60" style={{ background: 'linear-gradient(180deg, #dcb768, ' + GOLD + ')', color: NAVY, boxShadow: '0 8px 22px -10px rgba(200,161,75,.95)' }}>{rec ? 'Đang quay…' : exporting ? `Xuất ${pct}%` : '⬇ Xuất video'}</button>
          <button onClick={exportAll} disabled={!ready || rec || exporting || previewing || busyAll} className="cl-tb-zip cl-btn-vang rounded-xl px-4 py-2 text-sm font-bold transition disabled:opacity-60" style={{ background: 'linear-gradient(180deg, #4ade80, #22c55e)', color: '#052e16', boxShadow: '0 8px 22px -10px rgba(34,197,94,.95)' }} title="Quay lần lượt TẤT CẢ kịch bản rồi nén vào một file ZIP">{busyAll ? '⏳ Đang xuất bộ…' : '📦 Xuất cả bộ (ZIP)'}</button>
        </div>
      </div>

      {/* KỊCH BẢN: 1 dự án → 5 video (dùng chung bản đồ + thông tin, mỗi kịch bản chữ/khổ/nhạc/hiệu ứng riêng) */}
      <div className="flex items-center gap-2 overflow-x-auto px-4 py-2" style={{ background: '#0d2033', borderTop: '1px solid #1b3149' }}>
        <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-slate-400">Kịch bản:</span>
        {scripts.map((s, i) => (
          // Thẻ 06 tự ẩn khi đang mở chính nó — ô sổ xuống bên cạnh đã ghi tên rồi, để cả hai là trùng.
          s.key === 'chiduong' && i === activeScript ? null : (
          <div key={s.key} className="flex shrink-0 items-center overflow-hidden rounded-full transition" style={i === activeScript
            ? { background: 'linear-gradient(180deg, #dcb768, ' + GOLD + ')', boxShadow: '0 6px 18px -8px rgba(200,161,75,.9)' }
            : { background: '#16283d', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.06)' }}>
            <button onClick={() => switchScript(i)} onDoubleClick={() => { const n = prompt('Đổi tên kịch bản:', s.name); if (n) renameScript(i, n); }} className="px-3 py-1.5 text-xs font-semibold" style={{ color: i === activeScript ? NAVY : '#cbd5e1' }} title="Bấm để chuyển · bấm đúp để đổi tên">{s.name}</button>
          </div>
          )
        ))}
        {/* Chọn KIỂU QUAY của kịch bản Dẫn đường — để ngay đây cho dễ thấy, khỏi phải mở bảng nào */}
        {(scripts[activeScript]?.key === 'chiduong') && (
          <>
            {/* Bề ngang CHỐT CỨNG cho bằng mấy thẻ kịch bản bên cạnh — nhìn mới đều hàng. */}
            <select value={laDanDuong(camStyle) ? camStyle : ''} onChange={(e) => setCamStyle(e.target.value)}
              title="Kiểu quay dẫn đường"
              className="shrink-0 rounded-full pl-3 pr-6 py-1.5 text-xs font-bold"
              style={{ width: 132, maxWidth: 132, background: 'linear-gradient(180deg, #dcb768, ' + GOLD + ')', color: NAVY, border: 'none', boxShadow: '0 6px 18px -8px rgba(200,161,75,.9)' }}>
              {KIEU_DAN_DUONG.map((k) => <option key={k.key || 'chuan'} value={k.key}>{k.ten}</option>)}
            </select>
            {/* 6.4 · BAY CAO — kéo thanh này tự chọn tầm bay, từ 3 km tới 1000 km. Thang logarit nên
                kéo đều tay là đi hết dải: nửa đầu thanh lo mấy chục km, nửa sau lo mấy trăm km. */}
            {camStyle === 'cd_cao' && (
              <div className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: '#16283d', border: '1px solid #2a3f57' }} title="Khung hình bao bao nhiêu km mặt đất">
                <span className="text-[11px] text-slate-400">🛩</span>
                {/* Thanh chạy từ 0 tới 1 rồi mới đổi ra km. Trước đây để thẳng thang logarit (0,477 → 3)
                    với bước 0,005 — hai đầu KHÔNG chia hết cho bước nên kéo hết cỡ cũng chỉ tới 995 km.
                    Chạy 0→1 thì nấc cuối luôn đúng bằng 1, đổi ra tròn 1000 km. */}
                <input type="range" min={0} max={1} step={0.001}
                  value={Math.min(1, Math.max(0, Math.log((khungKm || 12) / 3) / Math.log(100000 / 3)))}
                  onChange={(e) => { const km = 3 * Math.pow(100000 / 3, Number(e.target.value)); setKhungKm(km >= 10000 ? Math.round(km / 500) * 500 : km >= 1000 ? Math.round(km / 50) * 50 : km >= 100 ? Math.round(km / 5) * 5 : Math.round(km * 10) / 10); }}
                  className="w-40 accent-amber-400" />
                <input type="number" min={3} max={100000} step={1} value={khungKm || 12}
                  onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) setKhungKm(Math.max(3, Math.min(100000, v))); }}
                  title="Bấm vào đây gõ thẳng số km cũng được"
                  className="w-[58px] rounded bg-transparent px-1 text-right text-[11px] font-bold outline-none"
                  style={{ color: GOLD, border: '1px solid #2a3f57' }} />
                <span className="text-[11px] font-bold" style={{ color: GOLD }}>km</span>
              </div>
            )}
          </>
        )}
        {/* Quản lý kịch bản */}
        <div className="flex shrink-0 items-center gap-1 pl-1">
          <button onClick={addScript} title="Thêm kịch bản" className="rounded-lg px-2 py-1.5 text-xs font-bold" style={{ background: '#16283d', color: '#7bd88f' }}>＋</button>
          <button onClick={() => duplicateScript(activeScript)} title="Nhân bản kịch bản đang mở" className="rounded-lg px-2 py-1.5 text-xs" style={{ background: '#16283d', color: '#cbd5e1' }}>⧉</button>
          <button onClick={() => moveScript(activeScript, -1)} title="Dời trái" className="rounded-lg px-2 py-1.5 text-xs" style={{ background: '#16283d', color: '#cbd5e1' }}>◀</button>
          <button onClick={() => moveScript(activeScript, 1)} title="Dời phải" className="rounded-lg px-2 py-1.5 text-xs" style={{ background: '#16283d', color: '#cbd5e1' }}>▶</button>
          <button onClick={() => deleteScript(activeScript)} title="Xoá kịch bản đang mở" className="rounded-lg px-2 py-1.5 text-xs" style={{ background: '#16283d', color: '#f87171' }}>✕</button>
        </div>
      </div>

      {/* THÂN: cột công cụ (trái) · bảng cài đặt (giữa) · bản đồ (phải) — bố cục 3 khu cho đỡ rối */}
      <div className={'cl-video-body flex flex-col lg:flex-row lg:items-stretch' + (mobile ? ' cl-mb' : '')}>
        {/* ① CỘT CÔNG CỤ — mỗi ô một hàng: biểu tượng bên trái, tên bên phải (chữ tiếng Việt dài nên không ép 2 cột) */}
        <div className="cl-mb-tools flex shrink-0 gap-1 overflow-x-auto px-2 py-2 lg:w-[158px] lg:flex-col lg:gap-0 lg:overflow-y-auto lg:overflow-x-hidden" style={{ background: '#0a1523', borderRight: '1px solid #16283d' }}>
          {TOOLGROUPS.map((g) => (
            <div key={g.title} className="shrink-0 lg:mb-1.5 lg:w-full">
              <div className="hidden px-1.5 pb-1 pt-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 lg:block" style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}>{g.title}</div>
              <div className="flex gap-1 lg:flex-col lg:gap-0.5">
                {g.items.map((t) => {
                  const on = tool === t.key || (t.mode !== undefined && t.mode !== 'none' && mode === t.mode) || (!!t.panel && panel === t.panel && !t.mode);
                  return (
                    <button key={t.key} onClick={() => pickTool(t)} title={t.hint}
                      className="cl-tool-btn relative flex shrink-0 items-center gap-1.5 rounded-xl px-1.5 py-1.5 transition lg:w-full"
                      style={on
                        ? { background: 'linear-gradient(90deg, rgba(200,161,75,.22), rgba(200,161,75,.05))', boxShadow: 'inset 0 0 0 1px rgba(200,161,75,.4)', color: GOLD }
                        : { background: 'transparent', color: '#93a4b8' }}>
                      {on && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full" style={{ background: GOLD }} />}
                      <span className="w-5 shrink-0 text-center text-[15px] leading-none">{t.icon}</span>
                      <span className="cl-mb-toolname hidden whitespace-nowrap text-[11px] font-semibold leading-none lg:block">{t.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ③ SÂN KHẤU (bản đồ) — đẩy sang phải trên màn hình rộng */}
        <div className="cl-mb-stage flex min-h-0 min-w-0 flex-1 flex-col p-4 lg:order-3">
          <div className="flex gap-2" style={mobile && khungThu ? { display: 'none' } : undefined}>
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Tìm địa điểm (vd: Cam Đức, Cam Lâm)" className="min-w-0 flex-1 rounded-lg border-0 px-3 py-2 text-sm" style={{ background: '#1b3149', color: '#e2e8f0' }} />
            <button onClick={search} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: GOLD, color: NAVY }}>Tìm</button>
            <button onClick={searchZone} disabled={zoneBusy} className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60" style={{ background: '#0ea5e9', color: '#fff' }} title="Gõ tên xã/phường/huyện rồi bấm đây — tự khoanh đúng ranh giới, khỏi vẽ tay">{zoneBusy ? '⏳' : mobile ? '🗺' : '🗺 Khoanh vùng'}</button>
          </div>
          <div className="cl-mb-an mt-1 text-[11px] text-slate-400">Mẹo: gõ <b>Cam Đức</b> rồi bấm <b>Khoanh vùng</b> — ranh giới xã tự hiện lên, không phải vẽ tay. Không cần gõ chữ “Xã”, không dấu cũng được.</div>
          {/* Thanh gọn trên bản đồ: việc hay dùng + chọn nền. Các công cụ VẼ đã nằm ở cột trái. */}
          <div className="cl-mb-maptools mt-2 flex flex-wrap items-center gap-1.5 text-xs" style={mobile && khungThu ? { display: 'none' } : undefined}>
            <button onClick={undoHistory} disabled={!canUndo} className="rounded-lg px-2.5 py-1.5 font-semibold disabled:opacity-40" style={seg(false)} title="Hoàn tác (Ctrl+Z)">↶</button>
            <button onClick={redoHistory} disabled={!canRedo} className="rounded-lg px-2.5 py-1.5 font-semibold disabled:opacity-40" style={seg(false)} title="Làm lại (Ctrl+Shift+Z)">↷</button>
            <button onClick={() => { const b = bounds(); if (b) mapRef.current?.fitBounds(b, { padding: 60, pitch: 0, bearing: 0, duration: 600, maxZoom: 18 }); else toast.info('Chưa có gì trên bản đồ'); }} className="rounded-lg px-2.5 py-1.5 font-semibold" style={seg(false)} title="Đưa tất cả vào 1 khung">⛶ Vừa khung</button>
            <button onClick={reset} className="rounded-lg px-2.5 py-1.5 font-semibold" style={seg(false)} title="Xoá sạch những gì đã vẽ">↺ Xoá</button>
            <span className="mx-1 h-4 w-px" style={{ background: '#2a3f57' }} />
            {([['sat', 'Vệ tinh'], ['sat2', 'Vệ tinh (mở)'], ['street', 'Đường'], ['dark', 'Tối']] as const).map(([k, n]) => (
              <button key={k} onClick={() => setBase(k)} className="rounded-lg px-2.5 py-1.5 font-semibold" style={seg(base === k)} title={k === 'sat2' ? 'Ảnh nguồn mở — yên tâm bản quyền khi làm video bán hàng' : k === 'sat' ? 'Ảnh Esri — nét nhất' : ''}>{n}</button>
            ))}
            <span className="mx-1 h-4 w-px" style={{ background: '#2a3f57' }} />
            <span className="mx-1 h-4 w-px" style={{ background: '#2a3f57' }} />
            <span className="text-slate-400">Màu:</span>
            {TONES.slice(0, 4).map((t) => (
              <button key={t.key} onClick={() => { setTone(t.key); setToneCustom(null); }} className="rounded-lg px-2 py-1.5 font-semibold" style={seg(!toneCustom && tone === t.key)} title={t.note}>{t.name}</button>
            ))}
            <button onClick={() => setPanel('mau')} className="rounded-lg px-2 py-1.5 font-semibold" style={seg(panel === 'mau')} title="Thêm tông màu + tự chỉnh">…</button>
            <span className="mx-1 h-4 w-px" style={{ background: '#2a3f57' }} />
            <label className="flex items-center gap-1 text-slate-300"><input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} /> Nhãn</label>
            <label className="flex items-center gap-1 text-slate-300" title="Khung an toàn (chỉ để canh, không vào video)"><input type="checkbox" checked={safeArea} onChange={(e) => setSafeArea(e.target.checked)} /> Khung an toàn</label>
            <label className="flex items-center gap-1 text-slate-300" title={isPro ? '' : 'Bản miễn phí luôn giữ logo'}><input type="checkbox" checked={logo} disabled={!isPro} onChange={(e) => setLogo(e.target.checked)} /> Logo{!isPro && '🔒'}</label>
          </div>
          {mode !== 'none' && <div className="mt-1 text-xs" style={{ color: GOLD }}>{mode === 'parcel' ? (parcelShape === 'poly' ? 'Bấm lần lượt các đỉnh quanh lô · Enter hoặc nhấp đúp để xong · Esc bỏ điểm vừa vẽ.' : parcelShape === 'circle' ? 'Bấm tâm, rồi bấm ra ngoài để định bán kính.' : 'Bấm 2 điểm để tạo hình.') : mode === 'route' ? 'Bấm lần lượt các điểm dọc tuyến · Enter hoặc nhấp đúp để xong · Esc bỏ điểm vừa vẽ.' : mode === 'marker' ? 'Bấm để đặt điểm nhấn.' : mode === 'radius' ? 'Bấm 1 điểm làm tâm vòng bán kính.' : mode === 'edit' ? 'Kéo đỉnh (chấm trắng) để dời · bấm đỉnh để xoá · kéo được cả thẻ chú thích.' : mode === 'callout' ? 'Bấm vào tiện ích trên bản đồ (trường, chợ, biển…) để đặt thẻ. Muốn dời thẻ: chuyển sang ✎ Sửa đỉnh rồi kéo.' : mode === 'dir' ? 'Bấm ĐIỂM ĐI, rồi bấm ĐIỂM ĐẾN — máy tự lấy tuyến đường bộ thật.' : mode === 'muiten' ? 'Bấm vào chỗ nổi tiếng trên bản đồ — mũi tên tự bắn từ lô đất tới đó.' :'Bấm điểm A rồi điểm B để đo khoảng cách.'} Bấm lại nút để dừng.</div>}

      {/* Bản đồ — CHIẾM HẾT chiều cao khối (canvas lớn, không để trống); tối thiểu 320px. */}
      <div ref={stageRef} onPointerDown={() => setSelObj(null)} onMouseEnter={danhThucThanh} onMouseMove={danhThucThanh} onMouseLeave={() => { if (anThanhRef.current) clearTimeout(anThanhRef.current); setHoverStage(false); }} className="cl-video-stage relative mt-3 overflow-hidden rounded-xl border" style={{ borderColor: '#2a3f57', ['--cl-ar' as any]: orient.replace(':', ' / '),
          // Ti le duoi dang MOT CON SO (ngang chia doc) — de CSS tren dien thoai tinh be ngang
          // tu chieu cao cho phep, nho vay khung doc van dung hinh doc chu khong bi beo ra.
          ['--cl-arn' as any]: orient === '9:16' ? 0.5625 : orient === '4:5' ? 0.8 : orient === '1:1' ? 1 : 1.7778,
          ...(mobile && khungThu ? { display: 'none' } : {}) }}>
        {/* Lớp bọc absolute lấp đầy khung; ô bản đồ để height:100% TƯỜNG MINH (CSS MapLibre đặt .maplibregl-map{position:relative} nên không dùng absolute cho ô map được). */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div ref={boxRef} style={{ width: '100%', height: '100%', background: 'linear-gradient(#a6c4e2, #cdd8e0 55%, #aeb6ad)' }} />
        </div>
        {!ready && <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-slate-400">Đang tải bản đồ vệ tinh…</div>}
        {/* ==== BẢNG CHỌN LỐI ĐI (sau khi bấm "Lấy đường thật A→B") ==== */}
        {dsTuyen && (
          <div className="absolute left-2 top-2 z-20 w-[212px] overflow-hidden rounded-xl border border-white/10 bg-[#0d2033]/92 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between px-3 py-2 text-[12px] font-bold text-white">
              <span>🚗 Chọn lối đi ({dsTuyen.length})</span>
              <button onClick={() => { route.current = tuyenCu.current; drawRoute(tuyenVe()); bumpGeom(); xoaLoiPhu(); setDsTuyen(null); }}
                className="rounded px-1.5 text-white/60 hover:text-white" title="Huỷ, trả lại tuyến cũ">✕</button>
            </div>
            <div className="max-h-[34vh] overflow-y-auto">
              {dsTuyen.map((t, i) => (
                <button key={i} onClick={() => { setTuyenChon(i); apTuyen(dsTuyen, i); }}
                  className={'flex w-full items-start gap-2 border-t border-white/5 px-3 py-2 text-left ' + (i === tuyenChon ? 'bg-sky-500/15' : 'hover:bg-white/5')}>
                  <span className={'mt-0.5 h-8 w-1 shrink-0 rounded-full ' + (i === tuyenChon ? 'bg-sky-400' : 'bg-white/25')} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <b className={i === tuyenChon ? 'text-sky-300' : 'text-white'}>{docThoiGian(t.thoiGian)}</b>
                      <span className="text-[11px] text-white/60">{docKhoangCach(t.khoangCach)}</span>
                      {t.nhan === 'Nhanh nhất' && <span className="rounded-full bg-emerald-500/20 px-1.5 text-[10px] font-bold text-emerald-300">Nhanh nhất</span>}
                      {t.nhan === 'Ngắn nhất' && <span className="rounded-full bg-amber-500/20 px-1.5 text-[10px] font-bold text-amber-300">Ngắn nhất</span>}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-white/50">{t.tomTat ? 'qua ' + t.tomTat : 'đường nội bộ'}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="border-t border-white/10 p-2">
              <button onClick={() => { xoaLoiPhu(); setDsTuyen(null); setPanel('tuyen'); setTool('route'); toast.success('Đã chốt tuyến — chỉnh kiểu vẽ, màu, chiều chạy ở bảng bên phải'); }}
                className="w-full rounded-lg bg-sky-500 py-1.5 text-[12px] font-bold text-white hover:bg-sky-400">Dùng lối này</button>
              <p className="mt-1 text-center text-[10px] text-white/40">Bấm từng lối để xem thử trên bản đồ</p>
            </div>
          </div>
        )}
        {/* LỚP MÀU ĐIỆN ẢNH — phủ y hệt lúc xuất video, để "nhìn thấy sao thì video ra vậy".
            Đặt NGAY TRÊN bản đồ và DƯỚI chữ/ghim/biểu đồ, đúng thứ tự như lúc vẽ khung hình video. */}
        {(() => { const g = GRADES.find((x) => x.key === grade); if (!g || !g.dam) return null;
          return <div className="pointer-events-none absolute inset-0 z-[5]" style={{ background: 'linear-gradient(180deg, ' + g.tren + ', ' + g.duoi + ')', mixBlendMode: g.tron as any, opacity: g.dam }} />; })()}
        {toiGoc > 0.01 && <div className="pointer-events-none absolute inset-0 z-[6]" style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 42%, rgba(0,0,0,' + (0.22 * toiGoc).toFixed(3) + ') 65%, rgba(0,0,0,' + (0.8 * toiGoc).toFixed(3) + ') 100%)' }} />}
        {/* KHUNG AN TOÀN — vùng bị nút bấm của TikTok/Reels che mất. Chỉ hiện lúc dựng, KHÔNG lọt vào video. */}
        {khungAnToan && (
          <div className="pointer-events-none absolute inset-0 z-[7]">
            <div className="absolute inset-x-0 top-0" style={{ height: '11%', background: 'rgba(239,68,68,.16)', borderBottom: '1px dashed rgba(255,255,255,.5)' }} />
            <div className="absolute inset-x-0 bottom-0" style={{ height: '21%', background: 'rgba(239,68,68,.16)', borderTop: '1px dashed rgba(255,255,255,.5)' }} />
            <div className="absolute bottom-[21%] right-0 top-[11%]" style={{ width: '15%', background: 'rgba(239,68,68,.12)', borderLeft: '1px dashed rgba(255,255,255,.4)' }} />
            <span className="absolute left-1/2 top-1 -translate-x-1/2 rounded bg-black/60 px-1.5 text-[9px] font-semibold text-white">tên tài khoản · nút quay lại</span>
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/60 px-1.5 text-[9px] font-semibold text-white">chú thích · nhạc · thanh tiến độ</span>
            <span className="absolute right-1 top-1/2 -translate-y-1/2 rounded bg-black/60 px-1.5 text-[9px] font-semibold text-white" style={{ writingMode: 'vertical-rl' }}>tim · bình luận · chia sẻ</span>
          </div>
        )}
        {/* ══ DẤU CHÌM BẢN DÙNG THỬ ══
            Trình duyệt KHÔNG có cách nào cấm quay màn hình. Cách duy nhất có tác dụng thật là làm cho
            bản xem thử không dùng được: phủ dấu chìm kín khung + ghi số điện thoại tài khoản đang xem,
            ai quay lén đem đi dùng là lộ ngay. Có gói thì dấu này biến mất. */}
        {!coQuyen && (
          <div className="pointer-events-none absolute inset-0 z-[34] grid select-none place-items-center overflow-hidden">
            {/* MỘT khối duy nhất nằm giữa khung — đủ để nhìn là biết bản dùng thử, mà không che mất
                cảnh quay nên khách vẫn đánh giá được video có đẹp hay không. */}
            <div className="text-center" style={{ transform: 'rotate(-12deg)' }}>
              <div className="whitespace-nowrap font-extrabold uppercase" style={{ color: 'rgba(255,255,255,.30)', letterSpacing: '.16em', fontSize: 'clamp(13px, 3.2vw, 38px)', textShadow: '0 2px 8px rgba(0,0,0,.5)' }}>BẢN DÙNG THỬ</div>
              <div className="mt-0.5 whitespace-nowrap font-bold uppercase" style={{ color: 'rgba(255,255,255,.24)', letterSpacing: '.28em', fontSize: 'clamp(9px, 1.6vw, 18px)', textShadow: '0 2px 6px rgba(0,0,0,.45)' }}>CAM LÂM LAND{maSoXem ? ' · ' + maSoXem : ''}</div>
            </div>
            <div className="absolute left-2 top-2 max-w-[62%] truncate whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold sm:left-1/2 sm:max-w-none sm:-translate-x-1/2 sm:text-[11px]"
              style={{ background: 'rgba(4,10,18,.72)', color: GOLD, boxShadow: 'inset 0 0 0 1px rgba(200,161,75,.5)' }}
              title={'Bản dùng thử: xem được ' + THU_GIAY + ' giây đầu. Nâng cấp để xem trọn và tải video về máy.'}>
              Bản dùng thử · {THU_GIAY} giây
            </div>
          </div>
        )}
        {/* Bảng nhỏ báo góc nghiêng / góc xoay khi đang chỉnh bằng Shift + phím mũi tên */}
        {gocHud && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2 rounded-xl px-3 py-1.5 text-center" style={{ background: 'rgba(4,10,18,.8)', boxShadow: '0 0 0 1px rgba(255,255,255,.14)' }}>
            <div className="font-mono text-[13px] font-bold" style={{ color: GOLD }}>⛰ Nghiêng {Math.round(gocHud.pitch)}° · 🧭 Xoay {Math.round(gocHud.bearing)}°</div>
            <div className="text-[10px] text-white/60">Shift + ↑↓ ngả camera · Shift + ←→ xoay · Shift + 0 về phẳng</div>
          </div>
        )}
        {/* ── THANH ĐIỀU KHIỂN NẰM TRONG KHUNG VIDEO (kiểu YouTube) ──
            Chỉ là lớp HTML phủ lên trên, KHÔNG lọt vào video xuất ra (video chỉ chụp khung bản đồ). */}
        <div className="absolute inset-x-0 bottom-0 z-40 transition-opacity duration-200"
          style={{ opacity: hoverStage || rec ? 1 : 0, pointerEvents: 'none', background: 'linear-gradient(0deg, rgba(4,10,18,.82), rgba(4,10,18,.35) 55%, transparent)' }}>
          {/* Nền thanh KHÔNG chặn chuột — chỉ riêng mấy cái nút mới bắt, và chỉ khi đang rê chuột vào
              khung. Không thì nửa dưới khung bị chắn, vẽ lô ở đáy bấm không ăn. */}
          {(hoverStage || rec) && (<>
          {/* ══ THANH TUA KIỂU YOUTUBE ══
              · Vùng bấm cao 18px (dễ trúng bằng ngón tay) nhưng thanh nhìn thấy chỉ mảnh.
              · Rê vào thì thanh DÀY LÊN và núm to ra — đúng cảm giác của YouTube.
              · Kéo thì hiện ô giờ chạy theo tay.
              · Có vạch chia phân cảnh, y như "chương" trên YouTube. */}
          {(() => {
            const pct = Math.max(0, Math.min(100, (playhead / Math.max(1, duration)) * 100));
            const to = tuaHover || tuaKeo;
            const doiGio = (clientX: number, el: HTMLElement) => {
              const rc = el.getBoundingClientRect();
              const g = Math.max(0, Math.min(1, (clientX - rc.left) / rc.width)) * duration;
              setTuaGio({ x: clientX - rc.left, giay: g });
            };
            return (
              <div className="pointer-events-auto relative mx-3 mb-1 flex cursor-pointer items-center"
                style={{ height: 18, touchAction: 'none' }}
                onPointerDown={(e) => { if (rec) return; const el = e.currentTarget as HTMLElement; setTuaKeo(true); doiGio(e.clientX, el); scrubOnRect(el.getBoundingClientRect(), e.clientX, false); beginPlayheadDrag(e, el); const up = () => { setTuaKeo(false); window.removeEventListener('pointerup', up); }; window.addEventListener('pointerup', up); }}
                onPointerMove={(e) => doiGio(e.clientX, e.currentTarget as HTMLElement)}
                onPointerEnter={() => setTuaHover(true)}
                onPointerLeave={() => { setTuaHover(false); setTuaGio(null); }}
                title="Bấm hoặc kéo để tua tới giây bất kỳ">
                <div className="relative w-full rounded-full transition-all" style={{ height: to ? 6 : 3, background: 'rgba(255,255,255,.3)' }}>
                  <div className="h-full rounded-full" style={{ width: pct + '%', background: GOLD }} />
                  {/* Vạch chia phân cảnh — như chương trên YouTube */}
                  {scenes.length > 1 && scenes.slice(1).map((sc, i) => (
                    <span key={sc.id} className="pointer-events-none absolute top-0 h-full w-[2px]" style={{ left: (sceneStart(i + 1) / Math.max(1, duration)) * 100 + '%', background: 'rgba(4,10,18,.75)' }} />
                  ))}
                  <div className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all"
                    style={{ left: pct + '%', width: to ? 16 : 11, height: to ? 16 : 11, background: GOLD, boxShadow: '0 0 0 2px rgba(4,10,18,.55), 0 1px 5px rgba(0,0,0,.55)' }} />
                </div>
                {/* Ô giờ chạy theo tay khi rê/kéo */}
                {tuaGio && (
                  <span className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded-md px-2 py-0.5 font-mono text-[11px] font-bold"
                    style={{ left: tuaGio.x, background: 'rgba(4,10,18,.9)', color: '#fff', boxShadow: '0 0 0 1px rgba(255,255,255,.15)' }}>{tuaGio.giay.toFixed(1)}s</span>
                )}
              </div>
            );
          })()}
          <div className="flex items-center gap-2 px-3 pb-2">
            <button onClick={() => { if (previewing) togglePause(); else preview(); }} disabled={!ready || rec || exporting || busyAll}
              className="pointer-events-auto grid h-8 w-8 place-items-center rounded-full text-[13px] font-bold disabled:opacity-50" style={{ background: GOLD, color: NAVY }}
              title={!previewing ? 'Chạy thử (phím cách)' : paused ? 'Chạy tiếp' : 'Tạm dừng'}>{!previewing ? '▶' : paused ? '▶' : '❚❚'}</button>
            {previewing && <button onClick={stopPreview} className="pointer-events-auto grid h-8 w-8 place-items-center rounded-full text-[12px] font-bold text-white" style={{ background: 'rgba(239,68,68,.9)' }} title="Dừng hẳn (Esc)">■</button>}
            <span className="select-none text-[12px] font-semibold text-white/90">{playhead.toFixed(1)}s <span className="text-white/50">/ {duration}s</span></span>
            <span className="flex-1" />
            <button onClick={() => mapRef.current?.zoomOut({ duration: 300 })} className="pointer-events-auto grid h-8 w-8 place-items-center rounded-lg text-lg font-bold text-white hover:bg-white/15" title="Thu nhỏ bản đồ">−</button>
            <button onClick={() => mapRef.current?.zoomIn({ duration: 300 })} className="pointer-events-auto grid h-8 w-8 place-items-center rounded-lg text-lg font-bold text-white hover:bg-white/15" title="Phóng to bản đồ">＋</button>
            <button onClick={() => { const b = bounds(); if (b) mapRef.current?.fitBounds(b, { padding: 90, duration: 600 }); }} className="pointer-events-auto grid h-8 w-8 place-items-center rounded-lg text-sm text-white hover:bg-white/15" title="Đưa tất cả vào vừa khung">⤢</button>
            <button onClick={() => { const m = mapRef.current; if (m) warmTiles(m, true); }} disabled={warming || rec || previewing}
              className="pointer-events-auto grid h-8 w-8 place-items-center rounded-lg text-sm text-white hover:bg-white/15 disabled:opacity-40"
              title="Nạp lại ảnh bản đồ (chỉ cần khi thấy ô ảnh bị thiếu/mờ)">⟳</button>
            <button onClick={() => { if (typeof document !== 'undefined' && (document.fullscreenElement || (document as any).webkitFullscreenElement)) thoatToanManHinh(); else moToanManHinh(); }}
              className="pointer-events-auto grid h-8 w-8 place-items-center rounded-lg text-sm text-white hover:bg-white/15" title="Toàn màn hình (Esc để thoát)">⛶</button>
          </div>
          </>)}
        </div>
        {warming && <div className="absolute inset-0 z-30 grid place-items-center" style={{ background: 'rgba(11,24,38,.94)' }}><div className="flex items-center gap-2 text-sm font-semibold text-slate-100"><span className="h-3 w-3 animate-ping rounded-full" style={{ background: GOLD }} /> Đang render video… vui lòng chờ</div></div>}
        {/* Render kỹ: dựng từng khung nên lâu — phải cho người dùng thấy còn bao nhiêu, kẻo tưởng treo máy */}
        {tienDoRender > 0 && (
          <div className="absolute inset-x-0 bottom-0 z-30 px-3 py-2" style={{ background: 'rgba(11,24,38,.92)' }}>
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-bold text-slate-200">
              <span>
                🎬 Đang dựng từng khung hình — {Math.round(tienDoRender * 100)}%
                {tienKhung && <span className="ml-2 font-mono text-slate-300">khung {tienKhung.m}/{tienKhung.n} · {tienKhung.giay.toFixed(2)}s/khung · còn ~{Math.floor(tienKhung.conLai / 60)}:{String(tienKhung.conLai % 60).padStart(2, '0')}</span>}
              </span>
              <button onClick={() => { stopRef.current = true; toast.info('Đang dừng — phần đã dựng vẫn được xuất thành video.'); }}
                className="pointer-events-auto shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold text-white"
                style={{ background: 'rgba(239,68,68,.9)' }} title="Dừng dựng — giữ lại phần đã quay">■ Dừng</button>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: '#1b3149' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(tienDoRender * 100)}%`, background: GOLD }} />
            </div>
          </div>
        )}
        {/* Xem trước chữ/logo theo MẪU BỐ CỤC (khớp video) */}
        {/* Dải tối chia nhiều chặng cho tan vào ảnh (đúng như lúc xuất video, không thấy mép cắt ngang) */}
        {tracksOn.text && inText && (layout === 'bottomLeft' || layout === 'bottomCenter') && (
          <div className={`pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-4 pt-16 ${layout === 'bottomCenter' ? 'text-center' : ''}`} style={{ background: 'linear-gradient(0deg, rgba(10,37,64,.9) 0%, rgba(10,37,64,.54) 22%, rgba(10,37,64,.25) 45%, rgba(10,37,64,0) 100%)' }}>
            {title && <span className={`mb-1.5 block h-[3px] rounded-full ${layout === 'bottomCenter' ? 'mx-auto' : ''}`} style={{ width: 46, background: GOLD }} />}
            {title && <div className="text-lg font-bold text-white sm:text-2xl" style={{ textShadow: '0 3px 16px rgba(2,8,18,.62)' }}>{title}</div>}
            {sub && <div className="text-sm font-semibold sm:text-base" style={{ color: GOLD }}>{sub}</div>}
          </div>
        )}
        {tracksOn.text && inText && layout === 'topLeft' && (
          <div className="pointer-events-none absolute inset-x-0 top-0 px-4 pb-16 pt-4" style={{ background: 'linear-gradient(180deg, rgba(10,37,64,.9) 0%, rgba(10,37,64,.42) 45%, rgba(10,37,64,0) 100%)' }}>
            {title && <span className="mb-1.5 block h-[3px] rounded-full" style={{ width: 46, background: GOLD }} />}
            {title && <div className="text-lg font-bold text-white sm:text-2xl" style={{ textShadow: '0 3px 16px rgba(2,8,18,.62)' }}>{title}</div>}
            {sub && <div className="text-sm font-semibold sm:text-base" style={{ color: GOLD }}>{sub}</div>}
          </div>
        )}
        {tracksOn.text && inText && layout === 'card' && (title || sub) && (
          <div className="pointer-events-none absolute bottom-4 left-4 flex items-stretch gap-2.5 rounded-2xl py-2.5 pl-2.5 pr-4" style={{ background: 'linear-gradient(180deg, rgba(14,34,58,.88), rgba(6,18,32,.88))', boxShadow: '0 18px 40px -18px rgba(0,0,0,.85), inset 0 0 0 1px rgba(255,255,255,.12)' }}>
            <span className="w-[4px] shrink-0 rounded-full" style={{ background: GOLD }} />
            <span>
              {title && <div className="text-base font-bold text-white sm:text-xl" style={{ textShadow: '0 3px 16px rgba(2,8,18,.62)' }}>{title}</div>}
              {sub && <div className="text-xs font-semibold sm:text-sm" style={{ color: GOLD }}>{sub}</div>}
            </span>
          </div>
        )}
        {logo && isPro && brandLogo && <img src={brandLogo} alt="logo" className="pointer-events-none absolute right-3 top-3 h-8 sm:h-10" />}
        {/* Thẻ thương hiệu xem trước — vẽ bằng ĐÚNG hàm dùng cho video, nên nhìn sao thì video ra vậy */}
        {logo && !(isPro && brandLogo) && (
          <div className={'pointer-events-none absolute ' + (logoPos === 'tt' ? 'left-3 top-3' : logoPos === 'tp' ? 'right-3 top-3' : logoPos === 'dt' ? 'bottom-3 left-3' : logoPos === 'dp' ? 'bottom-3 right-3'
            : layout === 'topLeft' ? 'bottom-3 right-3' : layout === 'bottomCenter' ? 'top-3 left-1/2 -translate-x-1/2' : 'top-3 right-3')}>
            {/* Co the phai TI LE THEO KHUNG XEM TRUOC. De cung 26 diem anh thi tren dien thoai
                the to gap doi so voi video that, che mat ca ban do. Trong video the cao 62 diem anh
                tren chieu cao video, nen o day quy dung ti le do. */}
            <LogoBadge style={logoStyle} cao={Math.max(10, Math.round(62 * boxH / (orient === '9:16' ? 1920 : orient === '4:5' ? 1350 : 1080)))} />
          </div>
        )}
        {/* PHU DE (cau chu chay theo thoi gian). Truoc day dat cach day khung DUNG 96 diem anh —
            tren man hinh may tinh thi dep, nhung khung xem truoc tren dien thoai chi cao khoang 200
            diem anh nen cau chu roi tot vao GIUA video, trong nhu bi loi. Nay dat theo TI LE, dung y
            het cho luc xuat video, va co chu cung thu nho theo khung. */}
        {(() => {
          const cap = subs.find((x) => playhead >= x.s && playhead <= x.e); if (!cap?.t) return null;
          const vhh = orient === '9:16' ? 1920 : orient === '4:5' ? 1350 : 1080;
          const vww = orient === '9:16' || orient === '1:1' || orient === '4:5' ? 1080 : 1920;
          const kk = Math.min(vww, vhh) / 1080;                 // dung cong thuc cua drawSub
          const duoi = (300 * kk / vhh) * 100;                  // cach day bao nhieu phan tram
          const co = Math.max(9, (boxH / vhh) * 40 * kk);       // co chu that su se thay trong video
          return (
            <div className="pointer-events-none absolute left-1/2 max-w-[86%] rounded-full text-center font-semibold text-white"
              style={{ bottom: duoi + '%', transform: 'translate(-50%, 50%)', fontSize: co, lineHeight: 1.25,
                       padding: Math.max(3, co * 0.45) + 'px ' + Math.max(8, co * 0.85) + 'px', whiteSpace: 'nowrap',
                       background: 'rgba(6,16,28,.72)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.16), 0 8px 22px -10px rgba(0,0,0,.8)' }}>{cap.t}</div>
          );
        })()}
        {property.qrOn && qrUrl && <img src={qrUrl} alt="QR" className="pointer-events-none absolute bottom-3 right-3 w-14 rounded bg-white p-0.5 sm:w-16" />}
        {(() => { // MÀN MỞ ĐẦU / KẾT THÚC — xem trước cho khớp video
          const iOn = intro.on && intro.dur > 0 && playhead < intro.dur;
          const oOn = outro.on && outro.dur > 0 && playhead > duration - outro.dur;
          const c = iOn ? intro : oOn ? outro : null; if (!c) return null;
          const bgCss: Record<string, string> = { navy: 'radial-gradient(circle at 50% 42%, #12395e, #050f1b)', gold: 'linear-gradient(135deg,#1b1405,#3d2d0a,#120d03)', grid: '#04101c', contour: 'linear-gradient(#07182a,#0d2b45)', paper: 'linear-gradient(#f3ead6,#ded2b8)', black: '#05080c' };
          return (
            <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center overflow-hidden text-center" style={{ background: bgCss[c.bg] || bgCss.navy }}>
              {c.img && <img src={c.img} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />}
              <div className="relative px-4">
                <div className="mx-auto mb-3 h-1 w-16" style={{ background: GOLD }} />
                <div className="text-xl font-extrabold sm:text-3xl" style={{ color: c.bg === 'paper' ? '#20304a' : '#fff' }}>{c.title}</div>
                {c.sub && <div className="mt-2 text-xs font-semibold sm:text-base" style={{ color: GOLD }}>{c.sub}</div>}
                <div className="mt-3 text-[10px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,.5)' }}>{iOn ? 'Màn mở đầu' : 'Màn kết thúc'}</div>
              </div>
            </div>
          );
        })()}
        {safeArea && <div className="pointer-events-none absolute inset-[7%] rounded border-2 border-dashed" style={{ borderColor: 'rgba(255,255,255,.55)' }} />}
        {/* OBJECT tự do (chữ/ảnh) — kéo để dời, bấm để chọn */}
        {objects.map((o) => {
          const vis = playhead >= o.s && playhead <= o.e; const sel = selObj === o.id; const ghost = !!o.hidden; const shown = ghost || vis;
          const ctx = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setSelObj(o.id); setCtxMenu({ id: o.id, x: e.clientX, y: e.clientY }); };
          const base: React.CSSProperties = { position: 'absolute', left: `${o.x * 100}%`, top: `${o.y * 100}%`, transform: `translate(-50%,-50%) rotate(${o.rot}deg)`, opacity: ghost ? 0.22 : (vis ? o.opacity : 0), cursor: o.locked ? 'default' : 'move', touchAction: 'none', outline: sel ? '2px solid #C8A14B' : ghost ? '1px dashed #94a3b8' : 'none', outlineOffset: 2, visibility: shown ? 'visible' : 'hidden', lineHeight: 0 };
          const px = 300 * (boxH / 1080) * o.scale;                    // bề ngang ảnh/video trên khung xem trước
          const wkw = WIDGETS.find((x) => x.key === o.wk) || WIDGETS[0];
          const vh = orient === '9:16' ? 1920 : orient === '4:5' ? 1350 : 1080, vw = orient === '9:16' || orient === '1:1' || orient === '4:5' ? 1080 : 1920;
          const wpx = (boxH / vh) * vw * wkw.w * (o.scale || 1);        // bề ngang khối dựng sẵn
          const inner: React.ReactNode =
            o.type === 'video' ? <video ref={(el) => { if (el) objVidRef.current[o.id] = el; }} src={o.src} muted loop autoPlay playsInline style={{ width: px, display: 'block' }} />
            : o.type === 'xe' ? <XeLive kind={o.xk || 'xecon'} mau={o.color || ''} co={(boxH / 1080) * (o.scale || 1)} el={playhead - o.s} />
            : o.type === 'widget' ? <WidgetLive kind={wkw.key} data={o.wd || wkw.d} width={wpx} playhead={playhead - o.s} />
            : o.type === 'text' ? <TextLive o={o} k={boxH / 1080} ap={Math.max(0, Math.min(1, (playhead - o.s) / (['typewriter', 'wipe', 'shine', 'stamp', 'maskUp', 'boxShine', 'underline', 'goldline', 'ribbon'].includes(o.fx || '') ? 1.4 : 0.6)))} />
            : <img src={o.src} alt="" style={{ width: px, display: 'block' }} />;
          // Chấm góc + tay cầm xoay — chỉ hiện ở object đang chọn, giống app dựng video chuyên nghiệp.
          const dot: React.CSSProperties = { position: 'absolute', width: 11, height: 11, borderRadius: 99, background: '#fff', boxShadow: '0 0 0 2px #C8A14B, 0 1px 3px rgba(0,0,0,.5)', touchAction: 'none' };
          const handles = sel && !o.locked && shown ? (
            <>
              <span onPointerDown={(e) => beginObjScale(o, e)} style={{ ...dot, left: -6, top: -6, cursor: 'nwse-resize' }} />
              <span onPointerDown={(e) => beginObjScale(o, e)} style={{ ...dot, right: -6, top: -6, cursor: 'nesw-resize' }} />
              <span onPointerDown={(e) => beginObjScale(o, e)} style={{ ...dot, left: -6, bottom: -6, cursor: 'nesw-resize' }} />
              <span onPointerDown={(e) => beginObjScale(o, e)} style={{ ...dot, right: -6, bottom: -6, cursor: 'nwse-resize' }} />
              <span style={{ position: 'absolute', left: '50%', top: -24, width: 2, height: 20, marginLeft: -1, background: '#C8A14B' }} />
              <span onPointerDown={(e) => beginObjRotate(o, e)} title="Kéo để xoay" style={{ position: 'absolute', left: '50%', top: -36, marginLeft: -9, width: 18, height: 18, borderRadius: 99, background: GOLD, color: NAVY, fontSize: 11, fontWeight: 900, lineHeight: '18px', textAlign: 'center', cursor: 'grab', touchAction: 'none', boxShadow: '0 1px 4px rgba(0,0,0,.5)' }}>↻</span>
            </>
          ) : null;
          if (o.type !== 'video' && !shown) return null;
          return (
            <div key={o.id} ref={(el) => { objElRef.current[o.id] = el; }} onPointerDown={(e) => beginObjDrag(o, e)} onContextMenu={ctx} style={base}>
              {inner}
              {handles}
            </div>
          );
        })}
        {chartOn && tracksOn.chart && inChart && <canvas ref={chartPrevRef} width={320} height={172} className="pointer-events-none absolute right-3 top-11 w-[40%] max-w-[320px]" />}
        {rec && <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white"><span className="h-2 w-2 animate-pulse rounded-full bg-white" /> ĐANG QUAY…</div>}
      </div>

          {/* Thanh GẤP / MỞ khung xem trước — chỉ hiện trên điện thoại (máy tính màn rộng, không cần) */}
          <button onClick={() => setKhungThu((v) => !v)} className="cl-mb-gapkhung mt-2 hidden w-full rounded-lg py-1 text-[11px] font-bold text-slate-300"
            style={{ background: '#16283d' }} title="Gấp khung xem trước lại cho bảng cài đặt rộng ra">
            {khungThu ? '⌄ Mở khung xem trước' : '⌃ Gấp khung xem trước'}
          </button>
          {/* Điều khiển dưới sân khấu */}
          <div className="cl-mb-nutstage mt-3 flex flex-wrap items-center gap-3">
            <button onClick={() => { if (khungThu) { setKhungThu(false); return; } if (previewing) togglePause(); else preview(); }} disabled={!ready || rec || exporting || busyAll} className="rounded-xl border px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60" style={{ borderColor: GOLD, color: GOLD }}
              title="Chạy thử ngay trên bản đồ (phím cách). Đang chạy thì bấm để tạm dừng.">{!previewing ? '▶ Xem trước' : paused ? '▶ Chạy tiếp' : '⏸ Tạm dừng'}</button>
            {previewing && <button onClick={stopPreview} className="rounded-xl border px-4 py-2.5 text-sm font-bold" style={{ borderColor: '#ef4444', color: '#fca5a5' }} title="Dừng hẳn, quay về đầu (phím Esc)">⏹ Dừng</button>}
            <button onClick={() => { if (khungThu) { setKhungThu(false); return; } record(); }} disabled={!ready || rec || exporting || previewing || busyAll} className="cl-btn-vang rounded-xl px-6 py-2.5 text-sm font-bold transition disabled:opacity-60" style={rec || exporting ? { background: '#64748b', color: '#e2e8f0' } : { background: 'linear-gradient(180deg, #dcb768, ' + GOLD + ')', color: NAVY, boxShadow: '0 10px 26px -10px rgba(200,161,75,.95)' }}>{rec ? '⏳ Đang quay…' : exporting ? `⏳ Xuất ${pct}%` : '🎥 Quay & xuất MP4'}</button>
            {/* 🎬 RENDER KỸ — bấm ngay cạnh nút Quay, vì đây là thứ quyết định video mượt hay giật */}
            <button onClick={() => setRenderKy(!renderKy)} disabled={rec || exporting}
              className="rounded-xl border px-3 py-2.5 text-sm font-bold disabled:opacity-60"
              style={renderKy ? { borderColor: GOLD, background: 'rgba(200,161,75,.16)', color: GOLD } : { borderColor: '#334b66', color: '#94a3b8' }}
              title={renderKy
                ? 'ĐANG BẬT — quay xong từng khung một, khung nào vẽ xong hẳn mới ghi. Video 120 giây mất chừng 5–10 phút nhưng mượt tuyệt đối, không rớt khung nào. Bấm để tắt.'
                : 'ĐANG TẮT — quay theo thời gian thật, nhanh bằng đúng thời lượng video, nhưng máy vẽ không kịp thì rớt khung, xem sẽ giật. Bấm để bật.'}>
              {renderKy ? '🎬 Render kỹ: BẬT' : '🎬 Render kỹ: tắt'}
            </button>
            {/* ⚙️ LIỆU SỨC MÁY — máy có card đồ hoạ và máy không có cần hai cấu hình khác hẳn nhau */}
            {sucMay && (
              <button onClick={apCaiDatHopMay} disabled={rec || exporting}
                className="rounded-xl border px-3 py-2.5 text-sm font-bold disabled:opacity-60"
                style={sucMay.coGpu ? { borderColor: '#2f6d4f', color: '#86efac' } : { borderColor: '#7a4a1f', color: '#fdba74' }}
                title={'Bộ vẽ hình của máy: ' + sucMay.ten + ' · ' + sucMay.nhan + ' nhân · khoảng ' + sucMay.boNho + 'GB bộ nhớ. · '
                  + (sucMay.coGpu
                    ? 'Có card đồ hoạ — gánh được 1080p, 30 hình/giây, núi 3D suốt video.'
                    : 'KHÔNG có card đồ hoạ, máy vẽ bằng CPU nên chậm hơn nhiều — nên hạ xuống 720p, 24 hình/giây, chỉ dựng núi lúc cần.')
                  + ' · Bấm để đặt luôn cho hợp máy này.'}>
                {sucMay.coGpu ? '⚙️ Hợp máy này (có card)' : '⚙️ Hợp máy này (không card)'}
              </button>
            )}
            {/* Số khung mỗi giây — 24 là chuẩn điện ảnh, render nhanh hơn 1/5 */}
            {renderKy && (
              <span className="flex items-center gap-0.5 rounded-xl p-0.5" style={{ background: '#0d2033', boxShadow: 'inset 0 0 0 1px #1b3149' }}>
                {[[30, '30 hình/s', 'Mượt nhất — chuẩn cho video mạng xã hội'], [24, '24 hình/s', 'Chuẩn điện ảnh, hơi "phim" hơn — render NHANH HƠN 1/5 vì ít khung hơn']].map(([v, ten, mo]) => (
                  <button key={String(v)} onClick={() => setFpsQuay(Number(v))} title={String(mo)}
                    className="rounded-lg px-2 py-2 text-[12px] font-bold"
                    style={fpsQuay === v ? { background: GOLD, color: NAVY } : { color: '#94a3b8' }}>{String(ten)}</button>
                ))}
              </span>
            )}
            {/* 2D / 3D — để ngoài này cho dễ đổi, khỏi vào bảng cài đặt */}
            <span className="flex items-center gap-0.5 rounded-xl p-0.5" style={{ background: '#0d2033', boxShadow: 'inset 0 0 0 1px #1b3149' }}>
              {([['auto', 'Tự động', 'Cảnh xa để phẳng cho nhẹ, cảnh gần và cảnh đèo mới dựng núi 3D — cân bằng nhất'],
                 ['2d', '2D', 'Không dựng núi. Nhẹ nhất, chạy mượt trên mọi máy, ảnh không bị kéo méo'],
                 ['3d', '3D', 'Núi nổi khối SUỐT video, không đổi qua lại nên không có chỗ nào khựng — nên dùng cái này']] as [string, string, string][]).map(([v, ten, mo]) => (
                <button key={v} onClick={() => setHinhMode(v as any)} title={mo}
                  className="rounded-lg px-2.5 py-2 text-[12px] font-bold"
                  style={hinhMode === v ? { background: GOLD, color: NAVY } : { color: '#94a3b8' }}>{ten}</button>
              ))}
              {hinhMode === '3d' && (
                <button onClick={() => setNet3d(!net3d)} disabled={rec || exporting}
                  className="ml-0.5 rounded-lg px-2.5 py-2 text-[12px] font-bold disabled:opacity-60"
                  style={net3d ? { background: '#7a4a1f', color: '#fdba74' } : { color: '#94a3b8' }}
                  title={net3d
                    ? 'ĐANG BẬT — giữ ảnh vệ tinh nét khi dựng núi. Đẹp hơn nhưng NẶNG hơn nhiều và dựng lâu hơn.'
                    : 'Đang dùng ảnh nhẹ khi dựng núi (nhanh, ổn định, không nhảy ảnh). Bấm để giữ ảnh nét — chậm hơn.'}>
                  {net3d ? '🔎 3D nét (chậm)' : '🔎 3D nhẹ'}
                </button>
              )}
            </span>
            <span className="text-xs text-slate-400">{orient} · {res}p · {duration}s · xử lý trên máy bạn</span>
            {/* ══ GÓC CAMERA & ĐỊNH VỊ ══ Đặt ở hàng nút dưới khung xem trước: hàng này còn rất nhiều
                chỗ trống nên KHÔNG tốn thêm dòng nào, mà cũng không bị hàng công cụ bản đồ cắt mất. */}
            <span className="ml-auto flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1" style={{ background: '#0d2033', boxShadow: 'inset 0 0 0 1px #1b3149' }}>
                <span className="font-mono text-[11px] font-bold" style={{ color: GOLD }} title="Độ ngả của camera: 0° là nhìn thẳng từ trên xuống, 85° gần như nằm ngang">⛰{Math.round(gocNgoai.pitch)}°</span>
                <span className="font-mono text-[11px] font-bold" style={{ color: GOLD }} title="Hướng bản đồ: 0° là hướng Bắc ở phía trên">🧭{Math.round(gocNgoai.bearing)}°</span>
                <button onClick={() => chinhGoc(8, 0)} className="rounded px-1.5 py-1 font-bold text-slate-200 hover:bg-white/10" title="Ngả camera xuống thấp hơn (thấy xa hơn, có chiều sâu)">⛰＋</button>
                <button onClick={() => chinhGoc(-8, 0)} className="rounded px-1.5 py-1 font-bold text-slate-200 hover:bg-white/10" title="Dựng camera lên (nhìn thẳng từ trên xuống)">⛰－</button>
                <button onClick={() => chinhGoc(0, -12)} className="rounded px-1.5 py-1 font-bold text-slate-200 hover:bg-white/10" title="Xoay bản đồ sang trái">↺</button>
                <button onClick={() => chinhGoc(0, 12)} className="rounded px-1.5 py-1 font-bold text-slate-200 hover:bg-white/10" title="Xoay bản đồ sang phải">↻</button>
                <button onClick={() => chinhGoc(0, 0, true)} className="rounded px-1.5 py-1 font-bold" style={{ background: 'rgba(200,161,75,.2)', color: GOLD }} title="Trả bản đồ về hướng Bắc và hết nghiêng">🧭 Bắc</button>
                <button onClick={dinhViToi} disabled={dangDinhVi} className="rounded px-1.5 py-1 font-bold transition disabled:opacity-50" style={{ background: '#134e33', color: '#bbf7d0' }} title="Đưa bản đồ về đúng chỗ bạn đang đứng">{dangDinhVi ? '⏳' : '📍 Vị trí'}</button>
              </span>
              <span className="text-[10px] leading-tight text-slate-400" title="Giữ Shift rồi bấm phím mũi tên: lên/xuống ngả camera, trái/phải xoay. Shift + 0 trả về phẳng.">
                Giữ <b className="text-slate-200">Shift</b> + <b className="text-slate-200">↑↓</b> ngả · <b className="text-slate-200">←→</b> xoay · <b className="text-slate-200">Shift+0</b> phẳng
              </span>
            </span>
          </div>
          {exporting && (
            <div className="mt-2">
              <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: '#1b3149' }}><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: GOLD }} /></div>
              <div className="mt-1 text-xs text-slate-400">Đang đổi MP4 & ghép nhạc trên máy bạn… {pct}%</div>
            </div>
          )}
        </div>

        {/* ② BẢNG CÀI ĐẶT — mỗi lúc CHỈ hiện đúng bảng của việc đang làm */}
        <div className="cl-mb-sheet w-full shrink-0 space-y-3 overflow-y-auto p-3 lg:order-2 lg:max-h-full lg:w-[336px]" style={{ background: '#0b1826', borderRight: '1px solid #16283d' }}>
                    {(() => {
            const T: Record<string, [string, string]> = {
              duan: ['🏡', 'Thông tin dự án'], chu: ['✏️', 'Chữ & lời thoại'], lodat: ['✨', 'Lô đất'], the: ['💬', 'Thẻ chú thích'],
              vung: ['🗺', 'Vùng hành chính'], ghim: ['📍', 'Ghim tiện ích'], bankinh: ['⭕', 'Vòng bán kính'], manhinh: ['🎬', 'Mở đầu & Kết thúc'],
              amthanh: ['🔊', 'Âm thanh'], bieudo: ['📊', 'Biểu đồ'], media: ['🖼', 'Ảnh · Video'], xuat: ['⚙️', 'Xuất video'],
              mau: ['🎨', 'Màu bản đồ'], camera: ['🎥', 'Camera & khung hình'], tuyen: ['➛', 'Tuyến đường'],
            };
            if (so) return <PanelHead icon={so.type === 'text' ? '✏️' : so.type === 'widget' ? '✨' : so.type === 'xe' ? '🚗' : '🖼'} ten={'Đang chỉnh ' + (so.type === 'text' ? 'một dòng chữ' : so.type === 'widget' ? 'một khối dựng sẵn' : so.type === 'xe' ? 'một phương tiện' : 'một ảnh/video')} goiY="Bấm ra chỗ trống trên khung hình để thôi chọn." />;
            if (!panel) return null;
            const [ic, ten] = T[panel] || ['⚙️', ''];
            const goiY = TOOLGROUPS.flatMap((g) => g.items).find((x) => x.panel === panel)?.hint;
            return <PanelHead icon={ic} ten={ten} goiY={goiY} />;
          })()}
          {!panel && !so && (
            <div className="rounded-xl p-4 text-center" style={{ background: '#0f2033', border: '1px dashed #2a3f57' }}>
              <div className="text-3xl">👈</div>
              <div className="mt-2 text-sm font-bold text-slate-200">Chọn một việc ở cột bên trái</div>
              <div className="mt-1 text-xs leading-relaxed text-slate-400">Ví dụ: bấm <b style={{ color: GOLD }}>▱ Khoanh lô</b> rồi nhấp quanh lô đất trên bản đồ. Hoặc gõ tên xã và bấm <b style={{ color: GOLD }}>🗺 Khoanh vùng</b> cho nhanh.</div>
            </div>
          )}
          {(panel === 'the') && (
            <div className="cl-card rounded-xl p-3">
              <div className="mb-2 text-sm font-bold" style={{ color: INK }}>💬 Thẻ chú thích</div>
              <div className="text-[11px] text-slate-400">Chọn nội dung rồi bấm vào tiện ích trên bản đồ. Thẻ tự kèm khoảng cách tới lô đất.</div>
              <div className="mt-2 cl-dark-chips">
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-400">Nội dung thẻ:</span>
                <input value={calloutLabel} onChange={(e) => setCalloutLabel(e.target.value)} className="w-40 rounded border-0 px-2 py-1 text-xs" style={{ background: '#fff', color: NAVY, border: '1px solid #d8cfbc' }} />
                <input value={calloutSub} onChange={(e) => setCalloutSub(e.target.value)} placeholder="Thông số (120 m² · 5x24)" title="Dòng thứ hai, chữ nhỏ hơn — diện tích, mặt tiền, hướng…" className="w-44 rounded border-0 px-2 py-1 text-xs" style={{ background: '#fff', color: NAVY, border: '1px solid #d8cfbc' }} />
                <input value={calloutGia} onChange={(e) => setCalloutGia(e.target.value)} placeholder="Giá (2,8 tỷ)" title="Dòng giá — tô màu nhấn cho đập vào mắt" className="w-28 rounded border-0 px-2 py-1 text-xs" style={{ background: '#fff', color: NAVY, border: '1px solid #d8cfbc' }} />
                {['Trường học', 'Chợ', 'Bãi biển', 'Bệnh viện', 'Sân bay', 'Cao tốc', 'UBND xã', 'Trung tâm'].map((t) => (
                  <button key={t} onClick={() => setCalloutLabel(t)} className="rounded px-2 py-0.5 text-[11px] font-semibold" style={btn(calloutLabel === t)}>{t}</button>
                ))}
                <label className="flex items-center gap-1 text-xs text-slate-300" title="Tự tính khoảng cách từ lô đất tới điểm này"><input type="checkbox" checked={calloutDist} onChange={(e) => setCalloutDist(e.target.checked)} /> Kèm khoảng cách</label>
                <span className="text-xs text-slate-400">Màu:</span>
                {([['gold', 'Vàng'], ['white', 'Trắng'], ['navy', 'Xanh'], ['red', 'Đỏ']] as const).map(([k, n]) => (
                  <button key={k} onClick={() => setCalloutStyle(k)} className="rounded px-2 py-0.5 text-[11px] font-semibold" style={btn(calloutStyle === k)}>{n}</button>
                ))}
                  <button onClick={() => setCoPicker(true)} className="rounded px-2 py-0.5 text-[11px] font-bold" style={{ background: GOLD, color: NAVY }} title="8 kiểu dây nối + khung thẻ">Kiểu: {CO_SHAPES.find((x) => x.key === calloutShape)?.name} ▾</button>
              </div>
              </div>
            </div>
          )}
          {(panel === 'ghim') && (
            <div className="cl-card rounded-xl p-3">
              <div className="mb-2 text-sm font-bold" style={{ color: INK }}>📍 Ghim tiện ích</div>
              <div className="text-[11px] text-slate-400">Chọn nội dung + kiểu ghim rồi bấm lên bản đồ chỗ có tiện ích đó.</div>
              <div className="mt-2 cl-dark-chips">
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-400">Nhãn điểm:</span>
                <input value={markerLabel} onChange={(e) => setMarkerLabel(e.target.value)} className="w-32 rounded border-0 px-2 py-1 text-xs" style={{ background: '#fff', color: NAVY, border: '1px solid #d8cfbc' }} />
                {['Trường', 'Chợ', 'Biển', 'Bệnh viện', 'Sân bay', 'UBND', 'Cao tốc'].map((t) => (
                  <button key={t} onClick={() => setMarkerLabel(t)} className="rounded px-2 py-0.5 text-[11px] font-semibold" style={btn(markerLabel === t)}>{t}</button>
                ))}
                  <div className="mt-1 w-full">
                    {/* BỘ SƯU TẬP GHIM — bấm một nút mở ra: chọn kiểu → chọn tiện ích theo tên (màu & chuyển động tự đặt sẵn) */}
                    <button onClick={() => setPinPicker('root')} className="group flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition hover:-translate-y-px"
                      style={{ background: 'linear-gradient(180deg, rgba(200,161,75,.16), rgba(200,161,75,.03))', boxShadow: '0 0 0 1.5px ' + GOLD + ', 0 10px 26px -14px rgba(200,161,75,.7)' }}>
                      <PinStage size={64}>{pinShape === 'radar' ? <RadarPreview kind={radarFx} color={pinColor} size={48} /> : <PinPreview shape={pinShape} color={pinColor} icon={pinIcon} size={46} />}</PinStage>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Ghim đang dùng</span>
                        <span className="block truncate text-[13px] font-bold leading-snug" style={{ color: GOLD }}>{PIN_FAMILIES.find((f) => f.key === pinFamily)?.name || 'Chọn kiểu ghim'}</span>
                        <span className="mt-0.5 flex items-center gap-1">
                          <span className="rounded-full px-1.5 py-[2px] text-[10px] font-semibold text-slate-200" style={{ background: 'rgba(255,255,255,.09)' }}>{pinShape === 'radar' ? (RADAR_FX.find((r) => r.key === radarFx)?.name || '') : (PIN_ICONS.find((i) => i.key === pinIcon)?.name || '')}</span>
                          <i className="block h-2.5 w-2.5 rounded-full" style={{ background: pinColor, boxShadow: '0 0 0 1px rgba(0,0,0,.45)' }} />
                        </span>
                      </span>
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-base text-slate-400 transition group-hover:bg-white/10 group-hover:text-white">›</span>
                    </button>
                    <div className="mt-1 text-[10px] text-slate-500">Bấm vào thẻ trên để mở bộ sưu tập — {PIN_FAMILIES.length} kiểu ghim, mỗi kiểu {PIN_ICONS.length} tiện ích.</div>
                    <div className="mb-1 mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-400">Chuyển động</span>
                      <span className="text-[10px] text-slate-500">{PIN_ANIMS.find((a) => a.key === pinAnim)?.note}</span>
                      <button onClick={apAnimTatCa} className="ml-auto rounded px-2 py-0.5 text-[10px] font-semibold" style={btn(false)} title="Ghim đã cắm giữ hiệu ứng riêng của nó. Bấm nút này nếu muốn tất cả dùng chung một kiểu.">Áp cho tất cả ghim</button>
                    </div>
                    <div className="mb-1 text-[10px] text-slate-500">Kiểu chọn ở đây áp cho <b style={{ color: INK }}>ghim sắp cắm</b> — ghim đã cắm vẫn giữ nguyên hiệu ứng của nó.</div>
                    <div className="grid grid-cols-4 gap-1">
                      {PIN_ANIMS.map((a) => (
                        <button key={a.key} onClick={() => setPinAnim(a.key)} title={a.note}
                          className="flex flex-col items-center gap-1 overflow-hidden rounded-xl p-1 transition hover:-translate-y-px" style={{ background: pinAnim === a.key ? 'rgba(200,161,75,.16)' : '#16283d', boxShadow: pinAnim === a.key ? 'inset 0 0 0 1.5px ' + GOLD : 'inset 0 0 0 1px rgba(255,255,255,.05)' }}>
                          <PinStage size={56}><span className={'clpin clpin-' + a.key} style={{ display: 'block', lineHeight: 0 }}><PinPreview shape={pinShape} color={pinColor} icon={pinIcon} size={40} /></span></PinStage>
                          <span className="text-center text-[9px] leading-tight" style={{ color: pinAnim === a.key ? GOLD : '#93a4b8' }}>{a.name}</span>
                        </button>
                      ))}
                    </div>
                    {/* ── GHIM ĐÃ CẮM: xoá từng con, không phải xoá sạch như trước ── */}
                    <div className="mb-1 mt-3 flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-400">Ghim đã cắm</span>
                      <span className="rounded-full px-1.5 py-[1px] text-[10px] font-bold" style={{ background: 'rgba(255,255,255,.09)', color: INK }}>{markers.current.length}</span>
                      <button onClick={() => setMode(mode === 'xoaghim' ? 'none' : 'xoaghim')} disabled={!markers.current.length}
                        className="ml-auto rounded-lg px-2 py-1 text-[11px] font-bold transition disabled:opacity-40"
                        style={mode === 'xoaghim' ? { background: '#b91c1c', color: '#fff' } : { background: 'rgba(255,255,255,.09)', color: '#e2e8f0' }}
                        title="Bật lên rồi bấm vào con ghim nào trên bản đồ là xoá đúng con đó">{mode === 'xoaghim' ? '■ Đang tẩy ghim' : '🧹 Tẩy ghim'}</button>
                    </div>
                    {mode === 'xoaghim' && <div className="mb-1 rounded-lg px-2 py-1.5 text-[10px] leading-tight" style={{ background: 'rgba(185,28,28,.16)', color: '#fecaca' }}>Bấm thẳng vào con ghim trên bản đồ để xoá <b>đúng con đó</b>. Xong thì bấm lại nút đỏ (hoặc phím Esc) để tắt.</div>}
                    <div className="mb-1 rounded-lg px-2 py-1.5 text-[10px] leading-tight" style={{ background: 'rgba(255,255,255,.05)', color: '#94a7bd' }}>
                      💡 Trên bản đồ: <b style={{ color: INK }}>bấm chuột phải</b> vào một con ghim để <b style={{ color: INK }}>đổi tên · dời chỗ · nhân bản · xoá</b>. Hoặc <b style={{ color: INK }}>bấm giữ rồi kéo</b> chính con ghim đó là dời được ngay.
                    </div>
                    {markers.current.length === 0 ? (
                      <div className="mb-1 text-[10px] text-slate-500">Chưa cắm ghim nào. Chọn kiểu ghim ở trên rồi bấm lên bản đồ.</div>
                    ) : (
                      <div className="mb-1 max-h-40 overflow-y-auto rounded-lg" style={{ background: 'rgba(255,255,255,.04)', boxShadow: 'inset 0 0 0 1px ' + LINE }}>
                        {markers.current.map((mk, i) => (
                          <div key={i} className="flex items-center gap-1.5 px-2 py-1 text-[11px]" style={{ borderBottom: i < markers.current.length - 1 ? '1px solid rgba(255,255,255,.06)' : 'none' }}>
                            <i className="block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: mk.color || GOLD, boxShadow: '0 0 0 1px rgba(0,0,0,.45)' }} />
                            <span className="min-w-0 flex-1 truncate" style={{ color: INK }}>{mk.label || 'Ghim ' + (i + 1)}</span>
                            <button onClick={() => { mapRef.current?.flyTo({ center: [mk.lng, mk.lat], zoom: Math.max(mapRef.current.getZoom(), 16.5), duration: 700 }); }} className="shrink-0 px-1 text-slate-300 hover:text-white" title="Bay tới xem ghim này">⌖</button>
                            <button onClick={() => xoaGhim(i)} className="shrink-0 px-1 font-bold text-red-400 hover:text-red-300" title="Xoá riêng ghim này">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {markers.current.length > 0 && (
                      <button onClick={xoaHetGhim} className="mb-1 w-full rounded-lg px-2 py-1 text-[11px] font-semibold" style={{ background: '#3a1c22', color: '#fca5a5' }} title="Chỉ xoá ghim — lô đất, tuyến đường, thẻ chú thích vẫn còn">🗑 Xoá hết ghim (giữ lô & tuyến)</button>
                    )}
                    <div className="mb-1 mt-2 text-[11px] font-bold text-slate-400">Cắm hàng loạt từ Excel</div>
                    <div className="flex flex-wrap gap-1.5">
                      <button onClick={() => setPinPaste(true)} className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={btn(false)} title="Có sẵn danh sách tiện ích trong Excel? Dán vào là cắm hết một lượt">📋 Dán danh sách</button>
                      <label className="cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold" style={btn(false)}>📂 Mở file CSV<input type="file" accept=".csv,.txt" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) f.text().then(importPins); (e.target as HTMLInputElement).value = ''; }} /></label>
                    </div>
                    <div className="mb-1 mt-2 flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-400">Màu ghim</span>
                      <label className="flex items-center gap-1 text-[10px] text-slate-400" title="Bật thì chọn biểu tượng nào ra màu nấy: trường xanh dương, chợ cam, biển xanh ngọc…"><input type="checkbox" checked={pinAutoColor} onChange={(e) => setPinAutoColor(e.target.checked)} /> tự đổi theo loại tiện ích</label>
                    </div>
                    {/* BẢNG MÀU — 27 màu xếp theo họ + màu vừa dùng + tự pha màu riêng */}
                    <BangMau mau={pinColor} doiMau={(c) => { setPinColor(c); setPinAutoColor(false); }} goiY={PIN_COLORS.map(([c]) => c)} nhanGoiY="Màu hay dùng cho ghim" nhan="Màu ghim sắp cắm" />
                    {pinAutoColor && <div className="mt-1 text-[10px] text-slate-500">Đang bật <b style={{ color: INK }}>tự đổi màu theo tiện ích</b> — chọn màu tay ở đây sẽ tự tắt nó đi.</div>}
                    {/* CHỐNG RỐI KHI THU NHỎ BẢN ĐỒ */}
                    <div className="mb-1 mt-2 text-[11px] font-bold text-slate-400">Khi thu nhỏ bản đồ</div>
                    <label className="mb-1 flex items-center gap-1.5 text-[11px] text-slate-300" title="Zoom xa thì hàng chục ghim chồng lên nhau. Bật cái này thì ghim/nhãn nào bị đè sẽ tự giấu bớt, phóng gần lại là hiện đủ — bản đồ chuyên nghiệp nào cũng làm vậy.">
                      <input type="checkbox" checked={pinKhongDe} onChange={(e) => setPinKhongDe(e.target.checked)} /> Tự <b style={{ color: INK }}>giấu bớt ghim đè nhau</b>
                    </label>
                    <div className="flex items-center gap-2 text-[11px] text-slate-300">
                      <span className="shrink-0">Hiện từ mức</span>
                      <input type="range" min={0} max={18} step={1} value={pinMinZ} onChange={(e) => setPinMinZ(Number(e.target.value))} className="flex-1" style={{ accentColor: GOLD }} />
                      <b className="shrink-0 text-right" style={{ color: INK, minWidth: 58 }}>{pinMinZ === 0 ? 'luôn hiện' : 'z ≥ ' + pinMinZ}</b>
                    </div>
                    <div className="mb-1.5 text-[10px] leading-tight text-slate-500">
                      Bản đồ đang ở mức <b style={{ color: INK }}>z {mapZ}</b> — đặt bằng mức này thì ghim chỉ hiện khi phóng gần bằng lúc này trở lên,
                      thu nhỏ ra là tự biến mất cho đỡ rối. Áp cho <b style={{ color: INK }}>ghim sắp cắm</b>; muốn áp cho ghim đã cắm thì bấm
                      <b style={{ color: INK }}> Áp cho tất cả ghim</b> ở trên.
                      <button onClick={() => setPinMinZ(Math.round(mapZ))} className="ml-1 underline" style={{ color: GOLD }}>lấy mức hiện tại</button>
                    </div>
                    <label className="mb-1 flex items-center gap-1.5 text-[11px] text-slate-300" title="Bật: ghim to nhỏ cùng bản đồ như được vẽ lên mặt đất. Tắt: ghim luôn một cỡ trên màn hình dù zoom xa hay gần.">
                      <input type="checkbox" checked={pinGround} onChange={(e) => setPinGround(e.target.checked)} /> Ghim <b style={{ color: INK }}>dính mặt đất</b> (to nhỏ cùng bản đồ)
                    </label>
                  </div>
              </div>
              </div>
            </div>
          )}
          {(panel === 'muiten') && (
            <div className="cl-card rounded-xl p-3">
              <div className="mb-2 text-sm font-bold" style={{ color: INK }}>➤ Mũi tên chỉ hướng</div>
              <div className="text-[11px] leading-snug text-slate-400">Vạch bắn từ <b style={{ color: INK }}>lô đất</b> ra chỗ nổi tiếng — nhìn một cái là biết lô nằm giữa, xung quanh có gì.</div>
              {!parcel.current.length && (
                <div className="mt-2 rounded-lg px-2 py-1.5 text-[11px] leading-snug" style={{ background: 'rgba(185,28,28,.16)', color: '#fecaca' }}>
                  Chưa khoanh lô đất nên chưa bắn được. Bấm <b>▱ Khoanh lô</b> vẽ lô trước đã.
                </div>
              )}
              <div className="mt-2 cl-dark-chips">
                {/* TÊN CHỖ — chữ này in ngay cạnh đầu mũi tên */}
                <div className="mb-1 text-[11px] font-bold text-slate-400">Tên chỗ sắp chỉ tới</div>
                <input value={mtLabel} onChange={(e) => setMtLabel(e.target.value)} placeholder="VD: Biển Bãi Dài"
                  className="w-full rounded border-0 px-2 py-1 text-xs" style={{ background: '#fff', color: NAVY, border: '1px solid #d8cfbc' }} />
                <div className="mt-1 flex flex-wrap gap-1">
                  {['Biển', 'Sân bay', 'Cao tốc', 'Chợ', 'Trung tâm', 'Trường học', 'Bệnh viện', 'Khu công nghiệp'].map((t) => (
                    <button key={t} onClick={() => setMtLabel(t)} className="rounded px-2 py-0.5 text-[11px] font-semibold" style={btn(mtLabel === t)}>{t}</button>
                  ))}
                </div>
                {/* BIỂU TƯỢNG gắn ngay dưới đầu mũi — bấm cái nào thì lấy luôn tên cái đó */}
                <div className="mb-1 mt-2 flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400">Biểu tượng đầu mũi</span>
                  <button onClick={() => setMtIcon('none')} className="ml-auto rounded px-2 py-0.5 text-[10px] font-semibold" style={btn(mtIcon === 'none')} title="Chỉ có mũi tên và chữ, không gắn biểu tượng">Không gắn</button>
                </div>
                <div className="grid max-h-36 grid-cols-6 gap-1 overflow-y-auto rounded-lg p-1" style={{ background: 'rgba(255,255,255,.04)', boxShadow: 'inset 0 0 0 1px ' + LINE }}>
                  {PIN_ICONS.map((ic) => (
                    <button key={ic.key} onClick={() => { setMtIcon(ic.key); setMtLabel(ic.name); }} title={ic.name}
                      className="grid place-items-center rounded-lg p-0.5" style={{ background: mtIcon === ic.key ? 'rgba(200,161,75,.18)' : 'transparent', boxShadow: mtIcon === ic.key ? 'inset 0 0 0 1.5px ' + GOLD : 'none' }}>
                      <PinStage size={34}><PinPreview shape="dot" color={mtCol} icon={ic.key} size={24} /></PinStage>
                    </button>
                  ))}
                </div>
                {/* KIỂU VẠCH */}
                <div className="mb-1 mt-2 text-[11px] font-bold text-slate-400">Kiểu vạch</div>
                <div className="grid grid-cols-3 gap-1">
                  {MT_KIEU.map((k) => (
                    <button key={k.key} onClick={() => setMtKieu(k.key)} title={k.note}
                      className="rounded-lg px-2 py-1.5 text-[11px] font-semibold leading-tight" style={btn(mtKieu === k.key)}>{k.name}</button>
                  ))}
                </div>
                <div className="mt-1 text-[10px] leading-snug text-slate-500">{MT_KIEU.find((k) => k.key === mtKieu)?.note}</div>
                {/* MÀU VẠCH & MÀU CHỮ */}
                <div className="mb-1 mt-2 flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400">Màu vạch</span>
                  <span className="text-[10px] text-slate-500">{MT_MAU.find(([c]) => c === mtCol)?.[1] || mtCol}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {MT_MAU.map(([c, ten]) => (
                    <button key={c} onClick={() => setMtCol(c)} title={ten} className="grid h-7 w-7 place-items-center rounded-full"
                      style={{ boxShadow: mtCol === c ? '0 0 0 2px ' + GOLD : '0 0 0 1px rgba(255,255,255,.2)' }}>
                      <i className="block h-[18px] w-[18px] rounded-full" style={{ background: c, boxShadow: '0 0 0 1px rgba(0,0,0,.45)' }} />
                    </button>
                  ))}
                </div>
                <div className="mb-1 mt-2 flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400">Màu chữ tên chỗ</span>
                  <span className="text-[10px] text-slate-500">{MT_MAU.find(([c]) => c === mtTcol)?.[1] || mtTcol}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {MT_MAU.map(([c, ten]) => (
                    <button key={c} onClick={() => setMtTcol(c)} title={ten} className="grid h-7 w-7 place-items-center rounded-full"
                      style={{ boxShadow: mtTcol === c ? '0 0 0 2px ' + GOLD : '0 0 0 1px rgba(255,255,255,.2)' }}>
                      <i className="block h-[18px] w-[18px] rounded-full" style={{ background: c, boxShadow: '0 0 0 1px rgba(0,0,0,.45)' }} />
                    </button>
                  ))}
                </div>
                <label className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-300" title="In thêm khoảng cách đo từ lô đất tới chỗ đó, ngay dưới tên">
                  <input type="checkbox" checked={mtDist} onChange={(e) => setMtDist(e.target.checked)} /> Ghi kèm <b style={{ color: INK }}>khoảng cách</b> tới lô
                </label>
                <label className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-300" title="Vạch đứt bò dần về phía mũi — tắt đi nếu muốn đứng yên">
                  <input type="checkbox" checked={mtChay} onChange={(e) => setMtChay(e.target.checked)} /> Vạch <b style={{ color: INK }}>chạy dần</b> về phía mũi
                </label>
                <button onClick={() => setMode(mode === 'muiten' ? 'none' : 'muiten')} disabled={!parcel.current.length}
                  className="mt-2 w-full rounded-lg px-3 py-2 text-xs font-bold transition disabled:opacity-40"
                  style={mode === 'muiten' ? { background: '#b91c1c', color: '#fff' } : { background: GOLD, color: NAVY }}>
                  {mode === 'muiten' ? '■ Đang bắn — bấm lên bản đồ' : '➤ Bắn mũi tên tới một chỗ'}
                </button>
                {/* ĐÃ BẮN NHỮNG ĐÂU */}
                <div className="mb-1 mt-3 flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400">Mũi tên đã bắn</span>
                  <span className="rounded-full px-1.5 py-[1px] text-[10px] font-bold" style={{ background: 'rgba(255,255,255,.09)', color: INK }}>{arrows.current.length}</span>
                </div>
                {arrows.current.length === 0 ? (
                  <div className="text-[10px] text-slate-500">Chưa bắn mũi tên nào. Đặt tên chỗ ở trên rồi bấm nút vàng, sau đó bấm lên bản đồ.</div>
                ) : (
                  <>
                    <div className="max-h-40 overflow-y-auto rounded-lg" style={{ background: 'rgba(255,255,255,.04)', boxShadow: 'inset 0 0 0 1px ' + LINE }}>
                      {arrows.current.map((a) => (
                        <div key={a.id} className="flex items-center gap-1.5 px-2 py-1" style={{ borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                          <i className="block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.col || '#fff', boxShadow: '0 0 0 1px rgba(0,0,0,.45)' }} />
                          <input value={a.label} onChange={(e) => { arrows.current = arrows.current.map((x) => (x.id === a.id ? { ...x, label: e.target.value } : x)); drawArrows(); setMtVer((v) => v + 1); }}
                            className="min-w-0 flex-1 rounded border-0 px-1.5 py-0.5 text-[11px]" style={{ background: '#fff', color: NAVY, border: '1px solid #d8cfbc' }} />
                          <button onClick={() => { mapRef.current?.flyTo({ center: [a.lng, a.lat], zoom: Math.max(mapRef.current.getZoom(), 15), duration: 700 }); }} className="shrink-0 px-1 text-slate-300 hover:text-white" title="Bay tới xem chỗ này">⌖</button>
                          <button onClick={() => xoaMuiTen(a.id)} className="shrink-0 px-1 text-[11px] font-bold text-red-400 hover:text-red-300" title="Xoá mũi tên này">✕</button>
                        </div>
                      ))}
                    </div>
                    <button onClick={xoaHetMuiTen} className="mt-1 w-full rounded-lg px-2 py-1 text-[11px] font-semibold" style={{ background: '#3a1c22', color: '#fca5a5' }}>🗑 Xoá hết mũi tên</button>
                  </>
                )}
              </div>
            </div>
          )}
          {(panel === 'bankinh') && (
            <div className="cl-card rounded-xl p-3">
              <div className="mb-2 text-sm font-bold" style={{ color: INK }}>⭕ Vòng bán kính</div>
              <div className="text-[11px] text-slate-400">Chọn bán kính rồi bấm 1 điểm trên bản đồ làm tâm.</div>
              <div className="mt-2 cl-dark-chips">
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-400">Bán kính:</span>
                {[500, 1000, 2000, 3000, 5000].map((r) => (
                  <button key={r} onClick={() => setRadiusM(r)} className="rounded px-2 py-0.5 text-[11px] font-semibold" style={btn(radiusM === r)}>{fmtDist(r)}</button>
                ))}
                <input type="number" min={100} step={100} value={radiusM} onChange={(e) => setRadiusM(Math.max(100, Number(e.target.value) || 0))} className="w-20 rounded border-0 px-2 py-1 text-xs" style={{ background: '#fff', color: NAVY, border: '1px solid #d8cfbc' }} title="mét" />
                <span className="text-[11px] text-slate-400">m</span>
              </div>
              </div>
            </div>
          )}
          {(panel === 'tuyen') && (
            <div className="cl-card rounded-xl p-3">
              <div className="mb-1 text-sm font-bold" style={{ color: INK }}>➛ Tuyến đường</div>
              <div className="mb-2 text-[11px] leading-snug text-slate-400">Hai cách lấy tuyến — <b style={{ color: INK }}>vẽ tay</b> hoặc <b style={{ color: INK }}>lấy đường thật</b> — đều dùng chung mọi cài đặt trong bảng này.</div>
              {/* HAI CÁCH LẤY TUYẾN nằm ngay đây, khỏi phải chạy qua chạy lại cột công cụ */}
              <div className="mb-2 flex flex-wrap gap-1.5">
                <button onClick={() => { setMode(mode === 'route' ? 'none' : 'route'); }} className="rounded-lg px-2.5 py-1.5 text-xs font-bold" style={btn(mode === 'route')} title="Bấm lần lượt các điểm dọc tuyến · Enter hoặc nhấp đúp là xong">✏️ Vẽ tay</button>
                <button onClick={() => { dirPending.current = null; setMode(mode === 'dir' ? 'none' : 'dir'); }} disabled={dirBusy} className="rounded-lg px-2.5 py-1.5 text-xs font-bold disabled:opacity-50" style={btn(mode === 'dir')} title="Bấm ĐIỂM ĐI rồi ĐIỂM ĐẾN — máy tự lấy tuyến đường bộ có thật">{dirBusy ? '⏳ Đang lấy…' : '🚗 Lấy đường thật A→B'}</button>
                <button onClick={() => { setMode('edit'); }} className="rounded-lg px-2.5 py-1.5 text-xs font-bold" style={btn(mode === 'edit')} title="Kéo chấm trắng để dời đỉnh · bấm vào đỉnh để xoá">✎ Sửa đỉnh</button>
                {route.current.length > 0 && <button onClick={() => { route.current = []; drawRoute([]); bumpGeom(); toast.success('Đã xoá tuyến'); }} className="rounded-lg px-2.5 py-1.5 text-xs font-bold" style={{ background: '#3a1c22', color: '#fca5a5' }} title="Chỉ xoá tuyến — lô đất, ghim, mũi tên vẫn còn">🗑 Xoá tuyến</button>}
              </div>
              {/* KIỂU BAY của kịch bản 06 — gộp 5 thẻ cũ (06→10) vào một danh sách sổ xuống cho gọn */}
              {(scripts[activeScript]?.key === 'chiduong' || laDanDuong(camStyle || scripts[activeScript]?.key || '')) && (
                <div className="mb-2 rounded-lg p-2" style={{ background: '#0d2033', border: '1px solid #24405c' }}>
                  <div className="mb-1 text-[12px] font-bold" style={{ color: GOLD }}>🎬 Kiểu quay dẫn đường</div>
                  {/* Ô này từng để giá trị dạng "cd_cao@12" (thời còn menu con) — giờ bỏ menu con rồi mà
                      giá trị vẫn kiểu cũ nên KHÔNG khớp mục nào, ô hiện nhầm "06 · Dẫn đường" trong khi
                      máy vẫn đang chạy kiểu 6.4 → thanh khung hình lòi ra dù đang chọn 06. Sửa cho khớp. */}
                  <select value={laDanDuong(camStyle) ? camStyle : ''} onChange={(e) => setCamStyle(e.target.value)}
                    className="w-full rounded-lg px-2 py-1.5 text-[12px] font-semibold"
                    style={{ background: '#12283c', color: '#e2e8f0', border: '1px solid #24405c' }}>
                    {KIEU_DAN_DUONG.map((k) => <option key={k.key || 'chuan'} value={k.key}>{k.ten}</option>)}
                  </select>
                  {camStyle === 'cd_cao' && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">🛩 Khung hình bao</span>
                        <span className="flex items-center gap-1">
                          <input type="number" min={3} max={100000} step={1} value={khungKm || 12}
                            onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) setKhungKm(Math.max(3, Math.min(100000, v))); }}
                            title="Gõ thẳng số km vào đây cũng được"
                            className="w-[62px] rounded bg-transparent px-1 text-right font-bold outline-none"
                            style={{ color: GOLD, border: '1px solid #24405c' }} />
                          <b style={{ color: GOLD }}>km mặt đất</b>
                        </span>
                      </div>
                      <input type="range" min={0} max={1} step={0.001}
                        value={Math.min(1, Math.max(0, Math.log((khungKm || 12) / 3) / Math.log(100000 / 3)))}
                        onChange={(e) => { const km = 3 * Math.pow(100000 / 3, Number(e.target.value)); setKhungKm(km >= 10000 ? Math.round(km / 500) * 500 : km >= 1000 ? Math.round(km / 50) * 50 : km >= 100 ? Math.round(km / 5) * 5 : Math.round(km * 10) / 10); }}
                        className="w-full accent-amber-400" />
                      <div className="text-[11px] text-slate-400">3 km khu dân cư · 12 km mấy xã · 50 km cả huyện · 200 km cả tỉnh · 2.000 km cả nước · 40.000 km trọn quả địa cầu</div>
                    </div>
                  )}
                  <div className="mt-1 text-[11px] text-slate-400">
                    {(KIEU_DAN_DUONG.find((k) => k.key === (laDanDuong(camStyle) ? camStyle : ''))?.mo) || ''}
                  </div>
                  {/* 🌊 QUAY VEN BIỂN — dành cho cung đường chạy dọc bờ */}
                  <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-bold"
                    style={{ background: bienOn ? 'rgba(56,189,248,.16)' : '#12283c', color: bienOn ? '#7dd3fc' : '#cbd5e1', border: '1px solid ' + (bienOn ? '#38bdf8' : '#24405c') }}>
                    <input type="checkbox" checked={bienOn} onChange={(e) => setBienOn(e.target.checked)} /> 🌊 Cảnh ven biển
                  </label>
                  {bienOn && (
                    <div className="mt-1 rounded-lg p-2" style={{ background: '#0d2033', border: '1px solid #24405c' }}>
                      <div className="text-[11px] text-slate-400">
                        Camera ngoái mũi ra biển cho nửa khung hình luôn có mặt nước, và <b style={{ color: '#7dd3fc' }}>1–2 lần</b> trong video
                        <b style={{ color: '#7dd3fc' }}> bay vọt lên cao, xoay TRỰC DIỆN ra biển suốt 12 giây</b> — con đường nằm ngang
                        giữa màn hình (đi tới đâu camera xoay theo tới đó), biển trải lên phía trên, rồi hạ xuống bám đường như cũ.
                        Máy tự chấm điểm chọn 1–2 chỗ đẹp nhất, tránh xa mấy khúc cua (chỗ đó đã có cảnh ôm cua riêng).
                        <b style={{ color: '#fca5a5' }}> Chỉ chạy với video từ 60 giây trở lên.</b> Dùng được cho mọi kiểu quay dẫn đường (06 · 6.1 · 6.2 · 6.3 · 6.4).
                      </div>
                      <div className="mt-1.5 text-[11px] font-bold text-slate-300">Biển nằm phía nào?</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {[[90, 'Đông ▶'], [270, '◀ Tây'], [0, 'Bắc ▲'], [180, 'Nam ▼']].map(([g, ten]) => (
                          <button key={String(g)} onClick={() => setBienHuong(Number(g))}
                            className="rounded px-2 py-0.5 text-[11px] font-semibold"
                            style={{ background: bienHuong === g ? '#38bdf8' : '#12283c', color: bienHuong === g ? '#08243c' : '#cbd5e1' }}>{ten}</button>
                        ))}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">Khánh Hoà thì để <b style={{ color: '#7dd3fc' }}>Đông</b> — biển luôn nằm bên phải khi đi từ Cam Lâm ra Nha Trang.</div>
                      {/* CHỐT 2 KHUNG NGẮM BIỂN — rồi tự kéo chỉnh cho vừa ý */}
                      <button onClick={chotKhungBien} disabled={warming || rec || previewing}
                        className="mt-2 w-full rounded-lg py-1.5 text-[12px] font-bold disabled:opacity-50"
                        style={{ background: '#38bdf8', color: '#08243c' }}>
                        {warming ? '⏳ Đang dò biển…' : '🎯 Chốt 2 khung ngắm biển'}
                      </button>
                      <div className="mt-1 text-[11px] text-slate-500">
                        Máy dò 16 hướng quanh tuyến, đo độ cao mặt đất ra tới 14 km — nước liền một mạch thì mới là biển thật
                        (cửa sông, đầm phá bị loại). Chốt xong, hai khung hiện ở <b style={{ color: '#7dd3fc' }}>dòng thời gian phía dưới</b>,
                        nằm cùng hàng với Khung hình camera — kéo chỉnh ở đó.
                      </div>
                    </div>
                  )}
                  {/* 🏔️ CẢNH ĐÈO — cú máy hoành tráng: bay ra biển rồi quay ngược vào núi */}
                  <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-bold"
                    style={{ background: deoOn ? 'rgba(251,191,36,.16)' : '#12283c', color: deoOn ? '#fcd34d' : '#cbd5e1', border: '1px solid ' + (deoOn ? '#fbbf24' : '#24405c') }}>
                    <input type="checkbox" checked={deoOn} onChange={(e) => setDeoOn(e.target.checked)} /> 🏔️ Cảnh đèo núi – biển
                  </label>
                  {deoOn && (
                    <div className="mt-1 rounded-lg p-2" style={{ background: '#0d2033', border: '1px solid #3d3520' }}>
                      <div className="text-[11px] text-slate-400">
                        Dành cho cung đường vượt đèo sát biển (đèo Cù Hin, Đại Lãnh…). Tới đoạn đèo, camera
                        <b style={{ color: '#fcd34d' }}> ra ngoài biển 2,4 km, đứng chếch một bên rồi quay vào bờ</b> — khung có
                        <b style={{ color: '#fcd34d' }}> mặt biển ở gần, con đèo vắt chéo sườn núi, dãy núi dựng phía sau</b>, rồi trôi vào
                        còn 1,3 km và đảo sang phía bên kia cho núi lướt qua ống kính.
                        Bấm chốt là máy <b style={{ color: '#fcd34d' }}>tự bật Địa hình 3D</b> — núi nhô lên khối thật, có bóng đổ, mới ra chất hùng vĩ.
                      </div>
                      <button onClick={chotKhungDeo} disabled={warming || rec || previewing}
                        className="mt-2 w-full rounded-lg py-1.5 text-[12px] font-bold disabled:opacity-50"
                        style={{ background: '#fbbf24', color: '#3d2c05' }}>
                        {warming ? '⏳ Đang dò đèo…' : '🏔️ Chốt khung cảnh đèo'}
                      </button>
                      <div className="mt-1 text-[11px] text-slate-500">
                        Máy đo độ cao mặt đất dọc tuyến rồi tìm chỗ hội đủ ba dấu hiệu của đèo:
                        <b style={{ color: '#fcd34d' }}> đường cua liên tục · mặt đất lên cao và dốc · một bên là biển</b>.
                        Chốt xong, khung hiện ở <b style={{ color: '#fcd34d' }}>dòng thời gian phía dưới</b> — kéo chỉnh được như mọi khung khác.
                      </div>
                    </div>
                  )}
                </div>
              )}
              <label className="mt-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold" style={{ background: camTarget ? 'rgba(124,58,237,.12)' : '#f6f1e6', color: NAVY }} title="Dù camera bay đi đâu cũng luôn xoay mặt về lô đất — như Google Earth Studio">
                <input type="checkbox" checked={camTarget} onChange={(e) => setCamTarget(e.target.checked)} /> 🎯 Luôn ngoái nhìn về lô đất
              </label>
              {camTarget && <div className="mt-1 text-[11px] text-slate-400">Camera bay đâu cũng xoay mặt về lô. Hợp cảnh lướt qua khu vực mà vẫn khoe được lô đất.</div>}
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400">🎥 Camera:</span>
                <select value={camStyle} onChange={(e) => setCamStyle(e.target.value)} className="min-w-0 flex-1 rounded-lg border px-2 py-1 text-xs" style={{ borderColor: LINE }}>
                  {CAMSTYLES.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
                </select>
              </div>
              {/* NGẮM THỬA ĐẤT — chỉ có tác dụng với các kịch bản/kiểu camera Dẫn đường */}
              <div className="mt-2 rounded-lg p-2" style={{ background: '#0d2033', border: '1px solid #24405c' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400">🏞 Ngắm thửa đất</span>
                  <b className="ml-auto text-xs" style={{ color: GOLD }}>{ngamLo === 0 ? 'bỏ qua' : ngamLo.toFixed(1) + ' giây'}</b>
                </div>
                <input type="range" min={0} max={8} step={0.5} value={ngamLo} onChange={(e) => setNgamLo(Number(e.target.value))} className="mt-1 w-full" style={{ accentColor: GOLD }} />
                <div className="text-[10px] leading-tight text-slate-400">
                  Trong kịch bản <b style={{ color: INK }}>Dẫn đường</b>: tới nơi thì camera <b style={{ color: INK }}>dừng lại lượn quanh miếng đất</b> chừng này giây
                  rồi mới chạy tuyến. Mình làm video để <b style={{ color: INK }}>bán đất</b> — phải cho khách ngắm đất, chứ chạy đường không thì họ không thấy đất đâu.
                </div>
              </div>
              {/* Mẫu chữ động đã dời sang mục "✏️ Chữ & lời" — chỗ đó mới đúng, để đây không ai tìm ra */}
              <button onClick={() => setPanel('chu')} className="mt-2 w-full rounded-lg px-2 py-1.5 text-left text-[11px]" style={{ background: 'rgba(255,255,255,.05)', color: '#cbd5e1', boxShadow: 'inset 0 0 0 1px ' + LINE }}>
                ✨ <b style={{ color: INK }}>Mẫu chữ động</b> đã chuyển sang mục <b style={{ color: GOLD }}>✏️ Chữ &amp; lời</b> — bấm vào đây để sang đó.
              </button>
              {camStyle === 'custom' && (
                <div className="mt-2 rounded-lg border p-2" style={{ borderColor: LINE }}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: INK }}>🎯 Đường bay tự đặt</span>
                    <div className="flex gap-1">
                      <button onClick={toggleRecPath} className="rounded px-2 py-1 text-xs font-bold text-white" style={{ background: recPath ? '#ef4444' : '#7c3aed' }} title="Ghi lại chuyển động bản đồ của bạn thành đường bay">{recPath ? '■ Dừng ghi' : '🔴 Ghi hành trình'}</button>
                      <button onClick={captureKeyframe} className="rounded px-2 py-1 text-xs font-bold" style={{ background: GOLD, color: NAVY }} title="Chỉnh bản đồ rồi chốt 1 khung tại mốc giây">＋ Chốt {playhead.toFixed(1)}s</button>
                    </div>
                  </div>
                  {/* THANH THỜI GIAN NGAY TRONG BẢNG CAMERA — khỏi phải với xuống dòng thời gian phía dưới */}
                  <div className="mb-1.5 rounded-lg p-1.5" style={{ background: '#0d2033', border: '1px solid #24405c' }}>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <span className="font-semibold">⏱ Đang xem giây</span>
                      <b className="font-mono" style={{ color: GOLD }}>{playhead.toFixed(1)}s / {duration}s</b>
                      <button onClick={() => nudgePlayhead(-0.1)} className="ml-auto rounded px-1.5 py-0.5 text-[11px] font-bold text-slate-200" style={{ background: '#1b3149' }} title="Lùi 0,1 giây">◀</button>
                      <button onClick={() => nudgePlayhead(0.1)} className="rounded px-1.5 py-0.5 text-[11px] font-bold text-slate-200" style={{ background: '#1b3149' }} title="Tiến 0,1 giây">▶</button>
                    </div>
                    <input type="range" min={0} max={Math.max(1, duration)} step={0.1} value={playhead} onChange={(e) => gotoGiay(Number(e.target.value))} className="mt-1 w-full" style={{ accentColor: GOLD }} title="Kéo để tua tới giây muốn chốt khung" />
                  </div>
                  {camKeys.length < 2 && <div className="text-[11px] text-slate-400">Kéo thanh thời gian tới giây muốn đặt → chỉnh bản đồ cho đẹp → bấm “Chốt”. Cần ít nhất 2 khung camera mới bay được.</div>}
                  <div className="space-y-1">
                    {camKeys.map((k, i) => (
                      <div key={i} className="rounded-lg border p-1.5" style={{ borderColor: LINE }}>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="w-11 font-mono font-bold" style={{ color: INK }}>{k.t.toFixed(1)}s</span>
                          <span className="min-w-0 flex-1 truncate text-slate-400">z{k.zoom.toFixed(1)} · nghiêng {Math.round(k.pitch)}° · xoay {Math.round(k.bearing)}°</span>
                          <button onClick={() => gotoKeyframe(k)} className="font-semibold" style={{ color: INK }} title="Đưa bản đồ về đúng khung này">xem</button>
                          <button onClick={() => { const m = mapRef.current; if (!m) return; const c = m.getCenter(); setCamKeys((p) => p.map((x, j) => (j === i ? { ...x, lng: +c.lng.toFixed(6), lat: +c.lat.toFixed(6), zoom: +m.getZoom().toFixed(2), pitch: +m.getPitch().toFixed(1), bearing: +m.getBearing().toFixed(1) } : x))); toast.success('Đã cập nhật khung ' + k.t.toFixed(1) + 's'); }} className="font-semibold" style={{ color: '#7c3aed' }} title="Ghi đè khung này bằng góc nhìn bản đồ hiện tại">ghi đè</button>
                          <button onClick={() => setCamKeys(camKeys.filter((_, j) => j !== i))} className="font-bold text-red-600" title="Xoá mốc">×</button>
                        </div>
                        {/* Kéo để dời mốc này sớm/muộn — bản đồ nhảy về đúng góc của mốc để xem luôn */}
                        <div className="mt-1 flex items-center gap-1">
                          <span className="w-11 shrink-0 text-[10px] text-slate-400">dời giây</span>
                          <input type="range" min={i > 0 ? camKeys[i - 1].t + 0.1 : 0} max={i < camKeys.length - 1 ? camKeys[i + 1].t - 0.1 : Math.max(1, duration)} step={0.1} value={k.t} onChange={(e) => tweakKf(k.t, { t: Number(e.target.value) })} className="min-w-0 flex-1" style={{ accentColor: '#7c3aed' }} title="Kéo để đổi thời điểm của mốc này (trong khoảng giữa hai mốc kế bên)" />
                        </div>
                        {i < camKeys.length - 1 && (
                          <div className="mt-1 flex items-center gap-1">
                            <span className="text-[10px] text-slate-400">tới mốc sau:</span>
                            {EASES.map((e) => <button key={e.key} onClick={() => setKfEase(k.t, e.key)} className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={btn((k.ease || 'smooth') === e.key)} title={e.note}>{e.name}</button>)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PROPERTY INSPECTOR — khi chọn 1 object chữ/ảnh */}
          {so && (
            <div className="cl-card rounded-xl p-3" style={{ boxShadow: '0 0 0 2px ' + GOLD }}>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-bold" style={{ color: INK }}>🎛️ {so.type === 'text' ? 'Chữ' : so.type === 'widget' ? 'Khối dựng sẵn' : 'Ảnh'}</div>
                <div className="flex items-center gap-1 text-sm">
                  <button onClick={() => moveObjZ(so.id, 1)} title="Lên trên">⬆</button>
                  <button onClick={() => moveObjZ(so.id, -1)} title="Xuống dưới">⬇</button>
                  <button onClick={() => duplicateObj(so.id)} title="Nhân bản">⧉</button>
                  <button onClick={() => deleteObj(so.id)} className="text-red-600" title="Xoá">🗑</button>
                </div>
              </div>
              {so.type === 'xe' && (() => {
                const v = XE_LIST.find((x) => x.key === so.xk) || XE_LIST[0];
                return (
                  <>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-[11px] font-bold" style={{ color: GOLD }}>{v.name}</span>
                      <span className="min-w-0 flex-1 truncate text-[10px] text-slate-500">{v.note}</span>
                    </div>
                    <div className="mb-2 flex flex-wrap gap-1">
                      {XE_LIST.map((y) => (
                        <button key={y.key} onClick={() => updateObj(so.id, { xk: y.key, color: y.mau })} className="rounded-lg px-2 py-0.5 text-[10px] font-semibold transition"
                          style={so.xk === y.key ? { background: GOLD, color: NAVY } : { background: 'rgba(255,255,255,.08)', color: '#cbd5e1' }}>{y.name}</button>
                      ))}
                    </div>
                    <BangMau mau={so.color || v.mau} doiMau={(c) => updateObj(so.id, { color: c })} goiY={['#e11d48', '#f59e0b', '#0ea5e9', '#22c55e', '#ffffff']} nhanGoiY="Màu dễ thấy trên ảnh vệ tinh" nhan="Màu phương tiện" />
                    {/* ══ ĐƯỜNG ĐI RIÊNG — chọn đúng mấy điểm mình muốn nó đi qua ══ */}
                    <div className="mt-2 rounded-lg p-2" style={{ background: 'rgba(255,255,255,.05)', boxShadow: 'inset 0 0 0 1px ' + LINE }}>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-[11px] font-bold" style={{ color: INK }}>🛤 Đường đi của xe này</span>
                        <b className="text-[10px]" style={{ color: (so.duong?.length || 0) > 1 ? GOLD : '#64798f' }}>
                          {(so.duong?.length || 0) > 1 ? 'riêng · ' + so.duong!.length + ' điểm' : 'đang đi theo tuyến chung'}
                        </b>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <button onClick={() => { setMode(mode === 'vexe' ? 'none' : 'vexe'); if (mode !== 'vexe') toast.info('Bấm lần lượt các điểm trên bản đồ · nhấp đúp hoặc Enter là xong'); }}
                          className="rounded-lg px-2 py-1 text-[11px] font-bold transition"
                          style={mode === 'vexe' ? { background: '#7c3aed', color: '#fff' } : { background: GOLD, color: NAVY }}>
                          {mode === 'vexe' ? '■ Đang chấm điểm…' : ((so.duong?.length || 0) > 1 ? '✏️ Chấm thêm điểm' : '✏️ Chấm điểm đường đi')}
                        </button>
                        {(so.duong?.length || 0) > 0 && (
                          <>
                            <button onClick={() => { const d = (so.duong || []).slice(0, -1); updateObj(so.id, { duong: d }); drawXePath(d as any); }}
                              className="rounded-lg px-2 py-1 text-[11px] font-semibold" style={btn(false)} title="Bỏ điểm vừa chấm">↩ Bỏ điểm cuối</button>
                            <button onClick={() => { updateObj(so.id, { duong: [] }); drawXePath([]); toast.success('Đã xoá — xe quay về đi theo tuyến đường chung'); }}
                              className="rounded-lg px-2 py-1 text-[11px] font-semibold" style={{ background: '#3a1c22', color: '#fca5a5' }}>🗑 Xoá đường riêng</button>
                          </>
                        )}
                      </div>
                      <div className="mt-1 text-[10px] leading-tight text-slate-500">
                        Chưa chấm điểm nào thì xe <b style={{ color: INK }}>đi theo tuyến đường chung</b> bạn đã vẽ. Chấm từ <b style={{ color: INK }}>2 điểm trở lên</b> là nó đi theo đường riêng —
                        mỗi xe một đường khác nhau cũng được. Nét đứt trắng trên bản đồ là đường riêng đó, <b style={{ color: INK }}>không lọt vào video</b>.
                      </div>
                    </div>
                    <div className="mt-1 text-[10px] leading-tight text-slate-500">Kéo thanh <b style={{ color: INK }}>Cỡ</b> ở dưới để to nhỏ. Muốn nó chạy chậm hơn thì kéo dài clip của nó trên dòng thời gian.</div>
                  </>
                );
              })()}
              {so.type === 'widget' && (() => {
                const wk = WIDGETS.find((x) => x.key === so.wk) || WIDGETS[0];
                const d = so.wd || wk.d;
                const set = (k: string, v: string) => updateObj(so.id, { wd: { ...d, [k]: v } });
                const fields: [string, string][] = wk.key === 'chat'
                  ? [['t1', 'Tên người nhắn'], ['t2', 'Câu 1 (khách)'], ['t3', 'Câu 2 (mình)'], ['t4', 'Câu 3 (khách)']]
                  : wk.key === 'price' ? [['t1', 'Tên lô'], ['t2', 'Diện tích'], ['t3', 'Giá bán'], ['t4', 'Pháp lý']]
                  : wk.key === 'call' ? [['t1', 'Tên người gọi'], ['t2', 'Dòng trạng thái'], ['t3', 'Số điện thoại']]
                  : wk.key === 'profile' ? [['t1', 'Tên trang'], ['t2', 'Mô tả'], ['t3', 'Số điện thoại']]
                  : wk.key === 'lock' ? [['t1', 'Tên ứng dụng'], ['t2', 'Tiêu đề báo'], ['t3', 'Nội dung'], ['t4', 'Giờ trên máy']]
                  : [['t1', 'Tên ứng dụng'], ['t2', 'Tiêu đề báo'], ['t3', 'Nội dung']];
                return (
                  <>
                    <div className="mb-1 text-[11px] font-bold" style={{ color: GOLD }}>{wk.name}</div>
                    {fields.map(([k, lb]) => (
                      <div key={k} className="mb-1.5">
                        <div className="mb-0.5 text-[11px] text-slate-400">{lb}</div>
                        <input value={d[k] || ''} onChange={(e) => set(k, e.target.value)} className="w-full rounded-lg px-2 py-1 text-sm" />
                      </div>
                    ))}
                    <button onClick={() => setWPicker(true)} className="mb-1 w-full rounded-lg px-2 py-1 text-xs font-semibold" style={btn(false)}>Đổi sang mẫu khác</button>
                  </>
                );
              })()}
              {so.type === 'text' && (
                <>
                  <input value={so.text || ''} onChange={(e) => updateObj(so.id, { text: e.target.value })} className="w-full rounded-lg border px-2 py-1 text-sm" style={{ borderColor: LINE }} />
                  <div className="mt-2 flex items-center gap-2 text-xs"><span className="w-10 text-slate-400">Cỡ</span><input type="range" min={16} max={180} value={so.size || 48} onChange={(e) => updateObj(so.id, { size: Number(e.target.value) })} className="flex-1" /></div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs"><span className="text-slate-400">Màu</span>{['#ffffff', '#C8A14B', '#ff3b30', '#22c55e', '#3b82f6', '#0A2540'].map((c) => <button key={c} onClick={() => updateObj(so.id, { color: c })} className="h-5 w-5 rounded-full border-2" style={{ background: c, borderColor: so.color === c ? GOLD : LINE }} />)}<label className="ml-auto flex items-center gap-1"><input type="checkbox" checked={!!so.bg} onChange={(e) => updateObj(so.id, { bg: e.target.checked })} /> Nền</label></div>
                  <div className="mt-1 flex gap-1 text-xs">{([['400', 'Thường'], ['700', 'Đậm'], ['800', 'Rất đậm']] as const).map(([w, n]) => <button key={w} onClick={() => updateObj(so.id, { weight: Number(w) })} className="rounded px-2 py-0.5 font-semibold" style={btn(so.weight === Number(w))}>{n}</button>)}</div>
                  <div className="mt-2 text-[11px] font-bold text-slate-400">Phông chữ</div>
                  <div className="mt-1 grid grid-cols-4 gap-1">
                    {FONTS.map((f) => (
                      <button key={f.key} onClick={() => updateObj(so.id, { font: f.key })} title={f.name}
                        className="truncate rounded px-1 py-1 text-[11px]" style={{ ...btn((so.font || 'sans') === f.key), fontFamily: f.css }}>Aa</button>
                    ))}
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-500">Đang dùng: {FONTS.find((f) => f.key === (so.font || 'sans'))?.name}</div>
                  <div className="mt-1.5 flex items-center gap-2 text-xs"><span className="w-14 text-slate-400">Giãn chữ</span><input type="range" min={-8} max={40} value={so.ls || 0} onChange={(e) => updateObj(so.id, { ls: Number(e.target.value) })} className="flex-1" /><span className="w-6 text-right text-[10px] text-slate-500">{so.ls || 0}</span></div>
                  <div className="flex items-center gap-2 text-xs"><span className="w-14 text-slate-400">Uốn cong</span><input type="range" min={-60} max={60} value={so.curve || 0} onChange={(e) => updateObj(so.id, { curve: Number(e.target.value) })} className="flex-1" /><button onClick={() => updateObj(so.id, { curve: 0 })} className="text-[10px] text-slate-400 underline">thẳng</button></div>
                  {/* ══ MẪU CHỮ ĐỘNG cho chính dòng chữ này — dùng chung bộ 44 mẫu với tiêu đề video ══ */}
                  <div className="mt-2 rounded-lg p-1.5" style={{ background: 'rgba(255,255,255,.05)', boxShadow: 'inset 0 0 0 1px ' + LINE }}>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-[11px] font-bold" style={{ color: INK }}>✨ Mẫu chữ động</span>
                      <b className="text-[10px]" style={{ color: GOLD }}>{TEXTANIMS.find((x) => x.key === (so.fx || 'none'))?.name || 'Không hiệu ứng'}</b>
                      <button onClick={() => { setFxFor(so.id); setFxPicker(true); }} className="ml-auto rounded-lg px-2 py-0.5 text-[11px] font-bold" style={{ background: GOLD, color: NAVY }}>Chọn mẫu</button>
                    </div>
                    <button onClick={() => { setFxFor(so.id); setFxPicker(true); }} className="w-full overflow-hidden rounded-lg" style={{ boxShadow: '0 0 0 1.5px ' + LINE }} title="Bấm để chọn mẫu khác">
                      <FxPreview anim={so.fx || 'none'} text={(so.text || 'Dòng chữ').slice(0, 18)} />
                    </button>
                    {so.fx && so.fx !== 'none' && <button onClick={() => updateObj(so.id, { fx: 'none' })} className="mt-1 w-full rounded-lg px-2 py-0.5 text-[10px] font-semibold" style={{ background: '#3a1c22', color: '#fca5a5' }}>Bỏ hiệu ứng</button>}
                    <div className="mt-1 text-[10px] leading-tight text-slate-500">Hiệu ứng chạy từ lúc dòng chữ này hiện ra trên dòng thời gian. {so.geo ? <b style={{ color: INK }}>Chữ đang ghim xuống đất nên camera bay thì nó đi theo mảnh đất.</b> : 'Bấm 📍 ở dưới để ghim chữ xuống bản đồ.'}</div>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                    <label className="flex items-center gap-1"><input type="checkbox" checked={!!so.outline} onChange={(e) => updateObj(so.id, { outline: e.target.checked })} /> Viền chữ</label>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={!!so.shadow} onChange={(e) => updateObj(so.id, { shadow: e.target.checked })} /> Đổ bóng</label>
                  </div>
                </>
              )}
              <div className="mt-2 rounded-lg p-1.5" style={{ background: '#132a43' }}>
                <label className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: INK }}>
                  <input type="checkbox" checked={!!so.runRoute} onChange={(e) => updateObj(so.id, { runRoute: e.target.checked })} /> 🛣 Cho chạy theo tuyến đường
                </label>
                {so.runRoute ? (
                  <>
                    <label className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-300"><input type="checkbox" checked={!!so.faceDir} onChange={(e) => updateObj(so.id, { faceDir: e.target.checked })} /> quay đầu theo hướng đi</label>
                    {/* ══ TỐC ĐỘ ══ Học từ app tham chiếu: 1 = đi vừa hết đường đúng lúc lớp kết thúc.
                        Nhanh hơn thì tới đích sớm rồi đứng lại, chậm hơn thì hết lớp vẫn còn giữa đường. */}
                    <div className="mt-2">
                      <div className="mb-0.5 flex items-center justify-between text-[11px]">
                        <span className="font-semibold" style={{ color: INK }}>Tốc độ</span>
                        <span className="font-mono text-slate-400">{(so.toc ?? 1).toFixed(1)}×</span>
                      </div>
                      <input type="range" min={0.2} max={3} step={0.1} value={so.toc ?? 1}
                        onChange={(e) => updateObj(so.id, { toc: Number(e.target.value) })}
                        className="w-full" style={{ accentColor: GOLD }} />
                      <div className="text-[10px] leading-tight text-slate-500">
                        1× = đi hết đường vừa đúng lúc lớp kết thúc · nhanh hơn thì tới sớm rồi dừng ở cuối đường
                      </div>
                    </div>
                    {/* ══ CHO ĐỨNG YÊN MỘT CHỖ ══ Cắm xe làm cảnh chứ không cho chạy — neo tại % tuyến tự chọn. */}
                    <button onClick={() => updateObj(so.id, { runRoute: !so.runRoute, viTri: so.viTri ?? 0.5 })}
                      className="mt-2 w-full rounded-lg px-2.5 py-1.5 text-[11px] font-bold"
                      style={so.runRoute ? { color: '#94a3b8', boxShadow: 'inset 0 0 0 1px ' + LINE } : { background: GOLD, color: NAVY }}>
                      {so.runRoute ? '📍 Cho đứng yên một chỗ' : '🚗 Đang đứng yên — cho chạy lại'}
                    </button>
                    {/* ══ CHỐT KHUNG ══ Bấm ◇ là ghi lại "tại giây này, giá trị là chừng này".
                        Giữa hai chốt máy tự tính dần đều nên chuyển động mượt, không nhảy cóc.
                        Nhờ nó mới làm được kiểu "giây 2 xe tới ngã ba, giây 4 phóng to rồi dừng". */}
                    <div className="mt-2 rounded-lg p-2" style={{ background: 'rgba(255,255,255,.04)', boxShadow: 'inset 0 0 0 1px ' + LINE }}>
                      <div className="mb-1 flex items-center gap-1.5">
                        <span className="text-[11px] font-bold" style={{ color: INK }}>◇ Chốt khung</span>
                        <span className="text-[10px] text-slate-500">tại giây {Math.max(0, playhead - so.s).toFixed(1)}s của lớp</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {([['viTri', 'Vị trí tuyến'], ['scale', 'Cỡ'], ['rot', 'Xoay']] as [string, string][]).map(([ten, nhan]) => (
                          <button key={ten} onClick={() => {
                            const t = Math.max(0, Math.round((playhead - so.s) * 10) / 10);
                            const gt = ten === 'viTri'
                              ? (so.viTri ?? Math.max(0, Math.min(1, (playhead - so.s) / Math.max(0.001, so.e - so.s))))
                              : ten === 'scale' ? (so.scale || 1) : (so.rot || 0);
                            const ds = (so.chot || []).filter((c) => !(Math.abs(c.t - t) < 0.05 && typeof (c as any)[ten] === 'number'));
                            updateObj(so.id, { chot: [...ds, { t, [ten]: gt } as any] });
                            toast.success('Đã chốt ' + nhan.toLowerCase() + ' tại giây ' + t.toFixed(1));
                          }}
                            className="rounded-lg px-2 py-1 text-[11px] font-bold"
                            style={{ color: GOLD, boxShadow: 'inset 0 0 0 1px ' + LINE }}>◇ {nhan}</button>
                        ))}
                        {!!(so.chot || []).length && (
                          <button onClick={() => updateObj(so.id, { chot: [] })}
                            className="rounded-lg px-2 py-1 text-[11px] font-bold" style={{ color: '#fca5a5', boxShadow: 'inset 0 0 0 1px #7f1d1d' }}>Xoá hết</button>
                        )}
                      </div>
                      {!!(so.chot || []).length && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {[...(so.chot || [])].sort((a, b) => a.t - b.t).map((c, i) => {
                            const ten = typeof c.viTri === 'number' ? 'vị trí' : typeof c.scale === 'number' ? 'cỡ' : 'xoay';
                            const gt = typeof c.viTri === 'number' ? Math.round(c.viTri * 100) + '%' : typeof c.scale === 'number' ? (c.scale).toFixed(2) + '×' : Math.round(c.rot || 0) + '°';
                            return (
                              <button key={i} onClick={() => updateObj(so.id, { chot: (so.chot || []).filter((z) => z !== c) })}
                                title="Bấm để xoá chốt này"
                                className="rounded-md px-1.5 py-0.5 text-[10px] font-mono"
                                style={{ background: '#0b1826', color: '#94a3b8', boxShadow: '0 0 0 1px ' + LINE }}>
                                {c.t.toFixed(1)}s · {ten} {gt} ✕
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <div className="mt-1 text-[10px] leading-tight text-slate-500">
                        Kéo vạch thời gian tới giây muốn chốt → chỉnh cỡ/xoay/vị trí → bấm ◇. Cần ít nhất <b style={{ color: INK }}>2 chốt</b> thì mới thành chuyển động.
                      </div>
                    </div>
                    {!so.runRoute && (
                      <div className="mt-1.5">
                        <div className="mb-0.5 flex items-center justify-between text-[11px]">
                          <span className="font-semibold" style={{ color: INK }}>Đứng ở đâu trên tuyến</span>
                          <span className="font-mono text-slate-400">{Math.round((so.viTri ?? 0.5) * 100)}%</span>
                        </div>
                        <input type="range" min={0} max={1} step={0.01} value={so.viTri ?? 0.5}
                          onChange={(e) => updateObj(so.id, { viTri: Number(e.target.value) })}
                          className="w-full" style={{ accentColor: GOLD }} />
                        <div className="text-[10px] leading-tight text-slate-500">0% = đầu tuyến · 100% = cuối tuyến</div>
                      </div>
                    )}
                    <div className="mt-0.5 text-[10px] leading-tight text-slate-400">{route.current.length > 1 ? `Sẽ bò từ đầu tới cuối tuyến trong khoảng ${so.s}s → ${so.e}s.` : '⚠ Chưa vẽ tuyến đường nào — vào công cụ 🛣 Tuyến để vẽ trước.'}</div>
                  </>
                ) : <div className="mt-0.5 text-[10px] leading-tight text-slate-400">Bật lên là ảnh/chữ này tự bò dọc tuyến đường đã vẽ — hợp để làm xe chạy, mũi tên dẫn đường.</div>}
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs"><span className="w-12 text-slate-400">Kích cỡ</span><input type="range" min={0.2} max={4} step={0.05} value={so.scale} onChange={(e) => updateObj(so.id, { scale: Number(e.target.value) })} className="flex-1" /></div>
              <div className="mt-1 flex items-center gap-2 text-xs"><span className="w-12 text-slate-400">Xoay</span><input type="range" min={-180} max={180} value={so.rot} onChange={(e) => updateObj(so.id, { rot: Number(e.target.value) })} className="flex-1" /></div>
              <div className="mt-1 flex items-center gap-2 text-xs"><span className="w-12 text-slate-400">Độ mờ</span><input type="range" min={0} max={1} step={0.05} value={so.opacity} onChange={(e) => updateObj(so.id, { opacity: Number(e.target.value) })} className="flex-1" /></div>
              <div className="mt-1 flex items-center gap-1 text-xs"><span className="w-12 text-slate-400">Hiện</span><input type="number" min={0} max={duration} step={0.5} value={so.s} onChange={(e) => updateObj(so.id, { s: Math.max(0, Math.min(so.e - 0.1, Number(e.target.value) || 0)) })} className="w-14 rounded border px-1 py-0.5" style={{ borderColor: LINE }} /> → <input type="number" min={0} max={duration} step={0.5} value={so.e} onChange={(e) => updateObj(so.id, { e: Math.max(so.s + 0.1, Number(e.target.value) || 0) })} className="w-14 rounded border px-1 py-0.5" style={{ borderColor: LINE }} /> s</div>
              <div className="mt-2 flex items-center gap-1 text-xs">
                <span className="w-12 text-slate-400">Căn</span>
                {([['l', '⇤'], ['cx', '↔'], ['r', '⇥'], ['t', '⤒'], ['cy', '↕'], ['b', '⤓']] as const).map(([k, ic]) => <button key={k} onClick={() => alignObj(so.id, k)} className="rounded border px-1.5 py-0.5" style={{ borderColor: LINE, color: NAVY }} title="Căn">{ic}</button>)}
                <button onClick={() => {
                  if (so.geo) { updateObj(so.id, { geo: undefined }); toast.info('Đã bỏ ghim — chữ đứng yên trên màn hình'); return; }
                  const st = stageRef.current, mp = mapRef.current; if (!st || !mp) return;
                  try { const g = mp.unproject([so.x * st.clientWidth, so.y * st.clientHeight]); updateObj(so.id, { geo: [+g.lng.toFixed(6), +g.lat.toFixed(6)] }); toast.success('Đã ghim xuống đất — camera bay thì chữ đi theo mảnh đất'); } catch { /* ignore */ }
                }} className="rounded px-1.5 py-0.5" title={so.geo ? 'Đang dính vào mảnh đất — bấm để thả ra' : 'Ghim xuống bản đồ: camera bay thì chữ đi theo đất'}>{so.geo ? '📌' : '📍'}</button>
                <button onClick={() => updateObj(so.id, { locked: !so.locked })} className="ml-auto rounded px-1.5 py-0.5" title="Khoá/mở">{so.locked ? '🔒' : '🔓'}</button>
                <button onClick={() => updateObj(so.id, { hidden: !so.hidden })} className="rounded px-1.5 py-0.5" title="Ẩn/hiện">{so.hidden ? '🚫' : '👁'}</button>
              </div>
            </div>
          )}

          {/* Thông tin dự án (nhập 1 lần — dùng cho cả 5 kịch bản) */}
          {(panel === 'duan') && (<div className="cl-card rounded-xl p-3">
            <div className="mb-2 text-sm font-bold" style={{ color: INK }}>💾 File dự án</div>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={saveProjectFile} className="rounded-lg px-2.5 py-1 text-xs font-bold" style={{ background: GOLD, color: NAVY }} title="Cất toàn bộ công việc ra một file trên máy">💾 Lưu ra file</button>
              <label className="cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold" style={btn(false)} title="Mở lại file đã lưu — thay toàn bộ nội dung đang làm">📂 Mở file<input type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) openProjectFile(f); (e.target as HTMLInputElement).value = ''; }} /></label>
            </div>
            <div className="mt-1 text-[11px] leading-tight text-slate-400">File chứa đủ: lô đất, tuyến, ghim, thẻ, chữ, khung camera, cài đặt xuất. Gửi file này cho người khác là họ mở ra làm tiếp được.</div>
          </div>)}

          {(panel === 'duan') && (<div className="cl-card rounded-xl p-3">
            <div className="mb-2 text-sm font-bold" style={{ color: INK }}>🏡 Thông tin dự án</div>
            <div className="grid grid-cols-2 gap-2">
              <input value={property.name} onChange={(e) => setProperty({ ...property, name: e.target.value })} placeholder="Tên dự án" className="col-span-2 rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: LINE }} />
              <input value={property.price} onChange={(e) => setProperty({ ...property, price: e.target.value })} placeholder="Giá (vd 1,2 tỷ)" className="rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: LINE }} />
              <input value={property.area} onChange={(e) => setProperty({ ...property, area: e.target.value })} placeholder="Diện tích (m²)" className="rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: LINE }} />
              <input value={property.phone} onChange={(e) => setProperty({ ...property, phone: e.target.value })} placeholder="SĐT" className="rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: LINE }} />
              <input value={property.zalo} onChange={(e) => setProperty({ ...property, zalo: e.target.value })} placeholder="Zalo" className="rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: LINE }} />
              <input value={property.address} onChange={(e) => setProperty({ ...property, address: e.target.value })} placeholder="Địa chỉ" className="col-span-2 rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: LINE }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button onClick={autoFillScripts} className="rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: GOLD, color: NAVY }}>✨ Tạo bộ kịch bản khác nhau</button>
              <button onClick={aiWriteScripts} disabled={aiBusy} className="rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-60" style={{ background: '#7c3aed', color: '#fff' }} title="AI viết lời thoại cho các kịch bản (dùng dữ liệu bạn nhập)">{aiBusy ? '⏳ AI đang viết…' : '🤖 AI viết kịch bản'}</button>
              <button onClick={() => { setSub('Liên hệ: ' + property.phone); setTitle(property.name); toast.success('Đã áp thông tin vào kịch bản này'); }} className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={btn(false)}>Chỉ kịch bản này</button>
              <button onClick={applyInfoAll} className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={btn(false)}>Áp cho TẤT CẢ</button>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm font-semibold" style={{ color: INK }}>
              <input type="checkbox" checked={!!property.qrOn} onChange={(e) => { const on = e.target.checked; const d = property.qrData || property.website || (property.zalo ? 'https://zalo.me/' + property.zalo.replace(/\D/g, '') : '') || property.phone || ''; setProperty({ ...property, qrOn: on, qrData: d }); }} /> 🔳 Mã QR liên hệ (hiện góc video)
            </label>
            {property.qrOn && (
              <div className="mt-2 flex items-start gap-2">
                <input value={property.qrData || ''} onChange={(e) => setProperty({ ...property, qrData: e.target.value })} placeholder="Website / https://zalo.me/... / SĐT" className="min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: LINE }} />
                {qrUrl && <img src={qrUrl} alt="QR" className="h-12 w-12 rounded border" style={{ borderColor: LINE }} />}
              </div>
            )}
          </div>)}

          {/* Chữ + bố cục */}
          {(panel === 'chu') && (<div className="cl-card rounded-xl p-3">
            <div className="mb-2 text-sm font-bold" style={{ color: INK }}>✏️ Chữ trên video (kịch bản: {scripts[activeScript]?.name})</div>
            <label className="text-xs font-semibold text-slate-400">Tiêu đề</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 mb-2 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: LINE }} />
            <label className="text-xs font-semibold text-slate-400">Dòng phụ (giá / liên hệ)</label>
            <input value={sub} onChange={(e) => setSub(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: LINE }} />
            {/* ══ KIỂU TÔ CHỮ — khác hẳn "mẫu chữ động" bên dưới: cái này là CÁCH TÔ, cái kia là CÁCH HIỆN RA ══ */}
            <div className="mt-3 rounded-xl p-2" style={{ background: 'rgba(255,255,255,.04)', boxShadow: 'inset 0 0 0 1px ' + LINE }}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[11px] font-bold" style={{ color: INK }}>🎨 Kiểu tô chữ</span>
                <span className="text-[10px] text-slate-500">{CHU_KIEU.length} kiểu · chồng được lên mẫu chữ động</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {CHU_KIEU.map((k) => (
                  <button key={k.key} onClick={() => setChuKieu(k.key)} title={k.note}
                    className="overflow-hidden rounded-lg px-1 py-1.5 text-center transition hover:-translate-y-px"
                    style={chuKieu === k.key ? { background: 'rgba(200,161,75,.16)', boxShadow: '0 0 0 1.5px ' + GOLD } : { background: '#0b1826', boxShadow: '0 0 0 1px ' + LINE }}>
                    <span className="block text-[15px] font-extrabold leading-tight" style={
                      k.key === 'vangkim' ? { background: 'linear-gradient(180deg,#fff3c4,#e6c46a 42%,#a67c25 62%,#f0d68a)', WebkitBackgroundClip: 'text', color: 'transparent' }
                      : k.key === 'vang24k' ? { background: 'linear-gradient(180deg,#fff8d8,#ffd75e 35%,#b8860b 66%,#ffe9a3)', WebkitBackgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 0 6px rgba(255,196,60,.75))' }
                      : k.key === 'neon' ? { color: '#fff', textShadow: '0 0 8px ' + GOLD + ', 0 0 16px ' + GOLD }
                      : k.key === 'kinhmo' ? { color: '#fff', background: 'rgba(255,255,255,.14)', borderRadius: 6, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.4)' }
                      : k.key === 'vienday' ? { color: NAVY, WebkitTextStroke: '3px #fff', paintOrder: 'stroke' as any }
                      : { color: INK }
                    }>Aa</span>
                    <span className="mt-0.5 block truncate text-[10px] font-semibold" style={{ color: chuKieu === k.key ? GOLD : '#94a3b8' }}>{k.name}</span>
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[10px] leading-tight text-slate-500">
                Đây là <b style={{ color: INK }}>cách tô</b> chữ. Còn <b style={{ color: INK }}>mẫu chữ động</b> bên dưới là <b style={{ color: INK }}>cách chữ hiện ra</b> — hai thứ dùng chung lúc nào cũng được.
              </p>
            </div>
            {/* ══ MẪU CHỮ ĐỘNG — chỗ này mới đúng là nơi người ta đi tìm ══ */}
            <div className="mt-3 rounded-xl p-2" style={{ background: 'rgba(255,255,255,.04)', boxShadow: 'inset 0 0 0 1px ' + LINE }}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[11px] font-bold" style={{ color: INK }}>✨ Mẫu chữ động</span>
                <span className="text-[10px] text-slate-500">{TEXTANIMS.length} mẫu</span>
                <button onClick={() => setFxPicker(true)} className="ml-auto rounded-lg px-2.5 py-1 text-[11px] font-bold" style={{ background: GOLD, color: NAVY }}>Xem tất cả mẫu</button>
              </div>
              <button onClick={() => setFxPicker(true)} className="w-full overflow-hidden rounded-lg transition hover:-translate-y-px" style={{ boxShadow: '0 0 0 1.5px ' + GOLD }} title="Bấm để chọn mẫu khác">
                <FxPreview anim={textAnim} text={title || 'Tên Dự Án'} />
              </button>
              <div className="mt-1 text-center text-[11px] font-semibold" style={{ color: GOLD }}>{TEXTANIMS.find((x) => x.key === textAnim)?.name || textAnim}</div>
              {/* Mấy mẫu hay dùng nhất bày sẵn ra ngoài, khỏi phải mở bảng */}
              <div className="mt-1.5 flex flex-wrap gap-1">
                {['fade', 'typewriter', 'gold24', 'neon', 'shine', 'glass'].map((k) => {
                  const t = TEXTANIMS.find((x) => x.key === k); if (!t) return null;
                  return <button key={k} onClick={() => setTextAnim(k)} className="rounded-lg px-2 py-0.5 text-[10px] font-semibold transition" style={textAnim === k ? { background: GOLD, color: NAVY } : { background: 'rgba(255,255,255,.08)', color: '#cbd5e1' }}>{t.name}</button>;
                })}
              </div>
            </div>
            {/* ══ THẺ THƯƠNG HIỆU — 8 kiểu, ô xem trước vẽ bằng chính hàm dùng cho video ══ */}
            <div className="mt-3 rounded-xl p-2" style={{ background: 'rgba(255,255,255,.04)', boxShadow: 'inset 0 0 0 1px ' + LINE }}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[11px] font-bold" style={{ color: INK }}>🏷️ Thẻ thương hiệu</span>
                <span className="text-[10px] text-slate-500">{LOGO_STYLES.length} kiểu</span>
                <select value={logoPos} onChange={(e) => setLogoPos(e.target.value)} className="ml-auto rounded-lg px-1.5 py-1 text-[11px]" style={{ background: '#0d2033', border: '1px solid ' + LINE, color: INK }} title="Đặt thẻ ở góc nào của khung hình">
                  <option value="auto">Tự né chỗ có chữ</option>
                  <option value="tt">Góc trên · trái</option>
                  <option value="tp">Góc trên · phải</option>
                  <option value="dt">Góc dưới · trái</option>
                  <option value="dp">Góc dưới · phải</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {LOGO_STYLES.map((L) => (
                  <button key={L.key} onClick={() => setLogoStyle(L.key)} title={L.note}
                    className="overflow-hidden rounded-xl p-1.5 text-left transition hover:-translate-y-px"
                    style={{ background: logoStyle === L.key ? 'linear-gradient(180deg, rgba(200,161,75,.16), rgba(200,161,75,.03))' : '#0b1826', boxShadow: logoStyle === L.key ? '0 0 0 1.5px ' + GOLD + ', 0 10px 26px -14px rgba(200,161,75,.7)' : '0 0 0 1px ' + LINE }}>
                    <span className="grid h-11 w-full place-items-center overflow-hidden rounded-lg" style={{ background: 'linear-gradient(135deg, #43603f 0%, #6f7f5c 45%, #2b5670 100%)' }}>
                      <LogoBadge style={L.key} cao={22} />
                    </span>
                    <span className="mt-1 block text-[11px] font-bold leading-tight" style={{ color: logoStyle === L.key ? GOLD : INK }}>{L.name}</span>
                    <span className="block text-[9px] leading-tight text-slate-500">{L.note}</span>
                  </button>
                ))}
              </div>
              <div className="mt-1 text-[10px] leading-tight text-slate-500">Đây là dấu của web đóng lên video bạn làm ra. {isPro ? 'Tài khoản của bạn thay được bằng logo riêng ở mục 🏷️ Brand Kit.' : 'Bản miễn phí luôn giữ thẻ — chọn kiểu nào hợp mắt thì chọn.'}</div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {LAYOUTS.map((l) => <button key={l.key} onClick={() => setLayout(l.key)} className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={btn(layout === l.key)}>{l.name}</button>)}
            </div>
          </div>)}

          {/* Brand Kit (logo + liên hệ dùng chung) — CHỈ bản trả phí */}
          {(panel === 'xuat') && (<div className="cl-card rounded-xl p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-bold" style={{ color: INK }}>🏷️ Brand Kit (logo){!isPro && ' 🔒'}</div>
              {isPro && <button onClick={saveBrandKit} className="rounded-lg px-2 py-1 text-xs font-semibold" style={btn(false)}>Lưu</button>}
            </div>
            {isPro ? (
              <>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold" style={btn(false)}>Tải logo<input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { const rd = new FileReader(); rd.onload = () => setBrandLogo(String(rd.result)); rd.readAsDataURL(f); } (e.target as HTMLInputElement).value = ''; }} /></label>
                  {brandLogo && <img src={brandLogo} alt="logo" className="h-8 rounded border" style={{ borderColor: LINE }} />}
                  {brandLogo && <button onClick={() => setBrandLogo('')} className="text-xs font-semibold underline" style={{ color: '#9b2d2d' }}>bỏ</button>}
                </div>
                <div className="mt-1 text-[11px] text-slate-400">Logo thay dòng chữ mặc định, hiện góc trên phải video. “Lưu” để dùng cho mọi dự án.</div>
              </>
            ) : (
              <div className="text-[11px] text-slate-400">Logo riêng là tính năng trả phí. Bản miễn phí giữ logo <b>CAM LÂM LAND</b>.</div>
            )}
          </div>)}

          {/* Phiên bản (Versions) */}
          {(panel === 'xuat') && (<div className="cl-card rounded-xl p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-bold" style={{ color: INK }}>🗂️ Phiên bản</div>
              <button onClick={saveVersion} className="rounded-lg px-2 py-1 text-xs font-semibold" style={btn(false)}>Lưu mốc</button>
            </div>
            {versions.length === 0 && <div className="text-[11px] text-slate-400">Chưa có. Bấm “Lưu mốc” để chụp trạng thái, khôi phục lại sau.</div>}
            <div className="space-y-1">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate" title={new Date(v.ts).toLocaleString()}>{v.name}</span>
                  <button onClick={() => restoreVersion(v)} className="font-semibold" style={{ color: INK }}>Khôi phục</button>
                  <button onClick={() => deleteVersion(v.id)} className="font-bold text-red-600" title="Xoá">×</button>
                </div>
              ))}
            </div>
          </div>)}

          {/* Thư viện media (tái dùng ảnh/video/nhạc đã tải) */}
          {(panel === 'media') && (<div className="cl-card rounded-xl p-3">
            {/* ══ PHƯƠNG TIỆN CHẠY DỌC TUYẾN — thêm phát là nó tự bám đường mà chạy ══ */}
            <div className="mb-3 rounded-xl p-2" style={{ background: 'rgba(255,255,255,.04)', boxShadow: 'inset 0 0 0 1px ' + LINE }}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[11px] font-bold" style={{ color: INK }}>🚗 Phương tiện chạy trên tuyến</span>
                <span className="text-[10px] text-slate-500">{XE_LIST.length} loại</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {XE_LIST.map((v) => (
                  <button key={v.key} onClick={() => addXe(v.key)} title={v.note}
                    className="overflow-hidden rounded-xl p-1.5 text-center transition hover:-translate-y-px"
                    style={{ background: '#0b1826', boxShadow: '0 0 0 1px ' + LINE }}>
                    <span className="grid h-14 w-full place-items-center overflow-hidden rounded-lg" style={{ background: 'linear-gradient(135deg, #43603f 0%, #6f7f5c 45%, #2b5670 100%)' }}>
                      <XeLive kind={v.key} co={0.42} />
                    </span>
                    <span className="mt-1 block text-[10px] font-bold leading-tight" style={{ color: INK }}>{v.name}</span>
                  </button>
                ))}
              </div>
              <div className="mt-1 text-[10px] leading-tight text-slate-500">
                Bấm một loại là thêm vào video, <b style={{ color: INK }}>tự bật sẵn</b> "chạy theo tuyến" và "quay theo hướng đi" — nó bám đúng đường bạn vẽ, tới khúc cua tự xoay đầu.
                {route.current.length < 2 && <b style={{ color: GOLD }}> Nhớ vẽ tuyến đường trước.</b>}
              </div>
            </div>
            {/* ══ VẬT THỂ 3D — thứ làm video "kể chuyện": chỗ này là biển, chỗ kia trường học, góc này giá đang tăng ══ */}
            <div className="mb-3 rounded-xl p-2" style={{ background: 'rgba(255,255,255,.04)', boxShadow: 'inset 0 0 0 1px ' + LINE }}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[11px] font-bold" style={{ color: INK }}>🏝 Vật thể 3D</span>
                <span className="text-[10px] text-slate-500">{VAT_3D.length} món · đứng yên một chỗ</span>
              </div>
              {[...new Set(VAT_3D.map((v) => v.nhom))].map((nhom) => (
                <div key={nhom} className="mb-1.5">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{nhom}</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {VAT_3D.filter((v) => v.nhom === nhom).map((v) => (
                      <button key={v.key} onClick={() => addVat(v.key)} title={v.name}
                        className="overflow-hidden rounded-lg p-1 text-center transition hover:-translate-y-px"
                        style={{ background: '#0b1826', boxShadow: '0 0 0 1px ' + LINE }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={'/vat3d/' + v.key + '.png'} alt={v.name} loading="lazy" className="mx-auto h-9 w-9 object-contain" />
                        <span className="mt-0.5 block truncate text-[9px] font-semibold" style={{ color: INK }}>{v.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {/* ══ CỜ CÁC NƯỚC — cắm lên bản đồ như một vật thể, kéo thả và đặt thời điểm hiện như ảnh ══ */}
            <div className="mb-3 rounded-xl p-2" style={{ background: 'rgba(255,255,255,.04)', boxShadow: 'inset 0 0 0 1px ' + LINE }}>
              <button onClick={() => setMoKhoCo(!moKhoCo)} className="flex w-full items-center gap-2 text-left">
                <span className="text-[11px] font-bold" style={{ color: INK }}>🏳️ Cờ các nước</span>
                <span className="text-[10px] text-slate-500">{dsCo.length ? dsCo.length + ' lá' : '271 lá'}</span>
                <span className="flex-1" />
                <span className="text-[11px] text-slate-400">{moKhoCo ? '⌃ Thu' : '⌄ Mở'}</span>
              </button>
              {moKhoCo && (
                <>
                  <input value={timCo} onChange={(e) => setTimCo(e.target.value)} placeholder="Gõ tên nước… (Việt Nam, Nhật Bản, Hàn…)"
                    className="mt-2 w-full rounded-lg px-2.5 py-1.5 text-[12px] outline-none"
                    style={{ background: FIELD, color: INK, boxShadow: 'inset 0 0 0 1px ' + LINE }} />
                  <div className="mt-2 grid max-h-64 grid-cols-4 gap-1.5 overflow-y-auto pr-1">
                    {dsCo.filter((c) => !timCo.trim() || c.ten.toLowerCase().includes(timCo.trim().toLowerCase()) || c.ma.includes(timCo.trim().toLowerCase())).slice(0, 120).map((c) => (
                      <button key={c.ma} onClick={() => { addImageFromSrc('/co/' + c.ma + '.svg'); toast.success('Đã thêm cờ ' + c.ten + ' — kéo thả để đặt chỗ'); }}
                        title={c.ten} className="overflow-hidden rounded-lg p-1 text-center transition hover:-translate-y-px"
                        style={{ background: '#0b1826', boxShadow: '0 0 0 1px ' + LINE }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={'/co/' + c.ma + '.svg'} alt={c.ten} loading="lazy" className="h-8 w-full rounded object-cover" />
                        <span className="mt-0.5 block truncate text-[9px] font-semibold" style={{ color: INK }}>{c.ten}</span>
                      </button>
                    ))}
                  </div>
                  {!!timCo.trim() && dsCo.filter((c) => c.ten.toLowerCase().includes(timCo.trim().toLowerCase())).length === 0 && (
                    <p className="mt-2 text-[11px] text-slate-400">Không có nước nào tên như vậy.</p>
                  )}
                </>
              )}
            </div>
            <div className="mb-2 text-sm font-bold" style={{ color: INK }}>🖼 Thêm vào video</div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              <button onClick={addTextObj} className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={btn(false)} title="Thêm dòng chữ tự do, kéo đặt chỗ nào cũng được">＋ Chữ</button>
              <label className="cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold" style={btn(false)}>＋ Ảnh<input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) addImageObj(f); (e.target as HTMLInputElement).value = ''; }} /></label>
              <label className="cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold" style={btn(false)}>＋ Video<input type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) addVideoObj(f); (e.target as HTMLInputElement).value = ''; }} /></label>
              <button onClick={() => setWPicker(true)} className="rounded-lg px-2.5 py-1 text-xs font-bold" style={{ background: GOLD, color: NAVY }} title="Thông báo điện thoại, khung chat, bảng giá lô đất…">✨ Khối dựng sẵn</button>
              <label className="cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold" style={btn(false)} title="Có sẵn file ranh thửa từ bên khác thì nhập thẳng vào">📂 Nhập KML/KMZ<input type="file" accept=".geojson,.json,.kml,.kmz,application/geo+json,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importGeo(f); (e.target as HTMLInputElement).value = ''; }} /></label>
            </div>
            <div className="mb-1 border-t pt-2 text-sm font-bold" style={{ color: NAVY, borderColor: LINE }}>📚 Đã dùng gần đây</div>
            <div className="mb-1 flex flex-wrap gap-1">
              {(['all', 'image', 'video', 'audio', 'fav'] as const).map((f) => <button key={f} onClick={() => setLibFilter(f)} className="rounded px-2 py-0.5 text-[11px] font-semibold" style={btn(libFilter === f)}>{f === 'all' ? 'Tất cả' : f === 'image' ? 'Ảnh' : f === 'video' ? 'Video' : f === 'audio' ? 'Nhạc' : '⭐'}</button>)}
            </div>
            <input value={libQuery} onChange={(e) => setLibQuery(e.target.value)} placeholder="Tìm tên…" className="mb-1 w-full rounded border px-2 py-1 text-xs" style={{ borderColor: LINE }} />
            {library.length === 0 && <div className="text-[11px] text-slate-400">Tải ảnh/video/nhạc là tự lưu vào đây để tái dùng cho kịch bản khác.</div>}
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {library.filter((a) => (libFilter === 'all' || (libFilter === 'fav' ? a.fav : a.kind === libFilter)) && a.name.toLowerCase().includes(libQuery.toLowerCase())).map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-xs">
                  <span>{a.kind === 'image' ? '🖼' : a.kind === 'video' ? '🎬' : '🎵'}</span>
                  <span className="min-w-0 flex-1 truncate" title={a.name}>{a.name}</span>
                  <button onClick={() => setLibrary((p) => p.map((x) => (x.id === a.id ? { ...x, fav: !x.fav } : x)))} title="Yêu thích">{a.fav ? '⭐' : '☆'}</button>
                  <button onClick={() => reuseAsset(a)} className="font-semibold" style={{ color: INK }}>dùng</button>
                </div>
              ))}
            </div>
          </div>)}

          {/* Mẫu BĐS 1-chạm */}
          {(panel === 'duan') && (<div className="cl-card rounded-xl p-3">
            <div className="mb-2 text-sm font-bold" style={{ color: INK }}>🎬 Mẫu nhanh (áp vào kịch bản đang mở)</div>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => <button key={t.key} onClick={() => applyTemplate(t)} className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={btn(false)}>{t.name}</button>)}
            </div>
          </div>)}

          {/* THƯ VIỆN TIẾNG ĐỘNG */}
          {(panel === 'amthanh') && (<div className="cl-card rounded-xl p-3">
            <div className="mb-1 text-sm font-bold" style={{ color: INK }}>🗣 Đọc lời thoại thành giọng nói</div>
            {voices.length === 0 ? (
              <div className="text-[11px] text-slate-400">Máy này chưa có giọng đọc nào. Trên Windows: Cài đặt → Thời gian &amp; ngôn ngữ → Giọng nói → thêm giọng tiếng Việt.</div>
            ) : (
              <>
                <select value={ttsVoice} onChange={(e) => setTtsVoice(e.target.value)} className="w-full rounded-lg px-2 py-1 text-xs">
                  {voices.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
                </select>
                <div className="mt-1 flex items-center gap-2 text-xs"><span className="w-12 text-slate-400">Tốc độ</span><input type="range" min={0.6} max={1.6} step={0.05} value={ttsRate} onChange={(e) => setTtsRate(Number(e.target.value))} className="flex-1" /><span className="w-8 text-right text-[10px] text-slate-500">{ttsRate.toFixed(2)}×</span></div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <button onClick={speakScript} className="rounded-lg px-2.5 py-1 text-xs font-bold" style={{ background: GOLD, color: NAVY }}>▶ Đọc thử cả bài</button>
                  <button onClick={() => speak(title || 'Chưa có tiêu đề')} className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={btn(false)}>Đọc tiêu đề</button>
                  {ttsOn && <button onClick={stopSpeak} className="rounded-lg px-2.5 py-1 text-xs font-bold text-white" style={{ background: '#ef4444' }}>■ Dừng đọc</button>}
                </div>
                <div className="mt-1 text-[11px] leading-tight text-slate-400">
                  ⚠ Giọng này <b style={{ color: INK }}>chỉ nghe thử được</b>, trình duyệt không cho ghi thẳng vào video. Muốn có giọng trong video: nghe thử để chốt lời, rồi bấm <b style={{ color: INK }}>● Thu âm</b> ở mục Cài đặt xuất và đọc lại bằng mic.
                </div>
              </>
            )}
            <div className="mb-1 mt-3 border-t pt-2 text-sm font-bold" style={{ color: INK, borderColor: LINE }}>🔊 Tiếng động ({sfx.length})</div>
            <div className="text-[11px] text-slate-400">Tiếng do máy tự tạo — không phải tải file, không lo bản quyền. Kéo vạch đứng tới giây muốn có tiếng rồi bấm “Đặt tại …s”.</div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {SFX_LIST.map((x) => (
                <button key={x.key} onClick={() => { setSfxKind(x.key); trySfx(x.key); }} className="rounded px-2 py-0.5 text-[11px] font-semibold" style={btn(sfxKind === x.key)} title="Bấm để nghe thử và chọn">{x.name}</button>
              ))}
            </div>
            <button onClick={addSfx} className="mt-1.5 w-full rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: GOLD, color: NAVY }}>＋ Đặt tiếng tại {playhead.toFixed(1)}s</button>
            <div className="mt-1.5 max-h-32 space-y-1 overflow-y-auto">
              {sfx.map((x) => (
                <div key={x.id} className="flex items-center gap-2 text-xs">
                  <span className="w-12 font-mono">{x.t.toFixed(1)}s</span>
                  <span className="min-w-0 flex-1 truncate">{SFX_LIST.find((y) => y.key === x.kind)?.name || x.kind}</span>
                  <button onClick={() => trySfx(x.kind)} title="Nghe thử">🔈</button>
                  <button onClick={() => setSfx((p) => p.filter((y) => y.id !== x.id))} className="font-bold text-red-600" title="Xoá">×</button>
                </div>
              ))}
            </div>
          </div>)}

          {/* MÀN MỞ ĐẦU & KẾT THÚC (đoạn không có bản đồ) */}
          {(panel === 'manhinh') && (<div className="cl-card rounded-xl p-3">
            <div className="mb-2 text-sm font-bold" style={{ color: INK }}>🎬 Mở đầu & Kết thúc</div>
            <div className="text-[11px] text-slate-400">Đoạn đầu/cuối video KHÔNG có bản đồ — chỉ nền động + chữ (+ ảnh nếu muốn). Hợp để giới thiệu tên dự án và chốt số điện thoại.</div>
            {([['Mở đầu', intro, setIntro], ['Kết thúc', outro, setOutro]] as const).map(([nm, c, setC]) => (
              <div key={nm} className="mt-2 rounded-lg border p-2" style={{ borderColor: LINE }}>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs font-bold" style={{ color: INK }}><input type="checkbox" checked={c.on} onChange={(e) => setC({ ...c, on: e.target.checked, title: c.title || (nm === 'Mở đầu' ? (property.name || 'Dự án') : 'Liên hệ ngay'), sub: c.sub || (nm === 'Mở đầu' ? (property.address || '') : (property.phone || '')) })} /> {nm}</label>
                  {c.on && <><span className="ml-auto text-[11px] text-slate-400">dài</span><input type="number" min={0.5} max={8} step={0.5} value={c.dur} onChange={(e) => setC({ ...c, dur: Math.max(0.5, Number(e.target.value) || 1) })} className="w-14 rounded border px-1 py-0.5 text-xs" style={{ borderColor: LINE }} /><span className="text-[11px] text-slate-400">giây</span></>}
                </div>
                {c.on && (
                  <div className="mt-1.5 space-y-1.5">
                    <input value={c.title} onChange={(e) => setC({ ...c, title: e.target.value })} placeholder="Dòng chữ lớn" className="w-full rounded border px-2 py-1 text-sm" style={{ borderColor: LINE }} />
                    <input value={c.sub} onChange={(e) => setC({ ...c, sub: e.target.value })} placeholder="Dòng nhỏ (địa chỉ / SĐT)" className="w-full rounded border px-2 py-1 text-xs" style={{ borderColor: LINE }} />
                    <div className="flex flex-wrap gap-1">
                      {BGS.map((b) => <button key={b.key} onClick={() => setC({ ...c, bg: b.key })} className="rounded px-2 py-0.5 text-[11px] font-semibold" style={btn(c.bg === b.key)}>{b.name}</button>)}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer rounded px-2 py-0.5 text-[11px] font-semibold" style={btn(false)}>🖼 Ảnh nền<input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { const rd = new FileReader(); rd.onload = () => setC({ ...c, img: String(rd.result) }); rd.readAsDataURL(f); } (e.target as HTMLInputElement).value = ''; }} /></label>
                      {c.img && <img src={c.img} alt="" className="h-7 w-11 rounded border object-cover" style={{ borderColor: LINE }} />}
                      {c.img && <button onClick={() => setC({ ...c, img: '' })} className="text-[11px] font-semibold underline" style={{ color: '#9b2d2d' }}>bỏ</button>}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {(intro.on || outro.on) && <div className="mt-2 text-[11px] text-slate-400">Hai đoạn này nằm TRONG tổng thời lượng {duration}s — phần bản đồ còn lại {Math.max(0, duration - (intro.on ? intro.dur : 0) - (outro.on ? outro.dur : 0)).toFixed(1)}s.</div>}
          </div>)}

          {/* Hiệu ứng lô đất */}
          {(panel === 'mau') && (
            <div className="cl-card rounded-xl p-3">
              <div className="mb-1 text-sm font-bold" style={{ color: INK }}>🎨 Màu bản đồ</div>
              <div className="mb-2 text-[11px] text-slate-400">Ảnh vệ tinh chụp về thường hơi nhạt. Chọn tông cho cây xanh mướt, biển trong — video nhìn bắt mắt hơn hẳn.</div>
              <div className="space-y-1">
                {TONES.map((t) => (
                  <button key={t.key} onClick={() => { setTone(t.key); setToneCustom(null); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left" style={{ background: !toneCustom && tone === t.key ? NAVY : '#f6f1e6' }}>
                    <span className="text-sm font-bold" style={{ color: !toneCustom && tone === t.key ? '#fff' : NAVY }}>{t.name}</span>
                    <span className="min-w-0 flex-1 truncate text-[11px]" style={{ color: !toneCustom && tone === t.key ? '#cbd5e1' : '#64748b' }}>{t.note}</span>
                  </button>
                ))}
              </div>
              {/* ══ NHÌN ĐIỆN ẢNH — thứ làm video khác hẳn ảnh vệ tinh thô ══ */}
              <div className="mt-3 border-t pt-2" style={{ borderColor: LINE }}>
                <div className="mb-1 text-xs font-bold" style={{ color: INK }}>🎬 Nhìn điện ảnh</div>
                <div className="mb-1.5 text-[11px] leading-tight text-slate-400">Phủ một lớp màu rất mỏng lên ảnh vệ tinh và làm tối bốn góc — mắt người xem tự dồn vào giữa khung, chỗ có lô đất. Chỉ ảnh nền đổi màu, chữ và ghim vẫn trong trẻo.</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {GRADES.map((g) => (
                    <button key={g.key} onClick={() => setGrade(g.key)} title={g.note}
                      className="overflow-hidden rounded-xl p-1.5 text-left transition hover:-translate-y-px"
                      style={{ background: grade === g.key ? 'linear-gradient(180deg, rgba(200,161,75,.16), rgba(200,161,75,.03))' : '#0b1826', boxShadow: grade === g.key ? '0 0 0 1.5px ' + GOLD + ', 0 10px 26px -14px rgba(200,161,75,.7)' : '0 0 0 1px ' + LINE }}>
                      {/* Ô xem trước: một mảnh "ảnh vệ tinh" giả lập, phủ đúng lớp màu của tông đó */}
                      <span className="relative block h-11 w-full overflow-hidden rounded-lg" style={{ background: 'linear-gradient(135deg, #4a6b52 0%, #7d8f6a 42%, #2f5d7a 100%)' }}>
                        {g.dam > 0 && <span className="absolute inset-0" style={{ background: 'linear-gradient(180deg, ' + g.tren + ', ' + g.duoi + ')', mixBlendMode: g.tron as any, opacity: g.dam }} />}
                        <span className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 40%, rgba(0,0,0,' + (0.7 * toiGoc).toFixed(2) + ') 100%)' }} />
                      </span>
                      <span className="mt-1 block text-[11px] font-bold leading-tight" style={{ color: grade === g.key ? GOLD : INK }}>{g.name}</span>
                      <span className="block text-[9px] leading-tight text-slate-500">{g.note}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-300">
                  <span className="shrink-0 font-semibold">Tối 4 góc</span>
                  <input type="range" min={0} max={1} step={0.05} value={toiGoc} onChange={(e) => setToiGoc(Number(e.target.value))} className="min-w-0 flex-1" style={{ accentColor: GOLD }} title="Kéo cao thì bốn góc tối lại, khung hình như có khung viền mềm" />
                  <b className="w-10 shrink-0 text-right font-mono" style={{ color: INK }}>{Math.round(toiGoc * 100)}%</b>
                </div>
                <label className="mt-1.5 flex items-center gap-2 text-xs font-semibold" style={{ color: INK }} title="Video mở đầu bằng cảnh tối dần sáng lên và kết thúc bằng tối dần — thiếu cái này video nhìn cụt ngủn như quay dở">
                  <input type="checkbox" checked={moDongMan} onChange={(e) => setMoDongMan(e.target.checked)} /> 🎞 Mở màn · đóng màn (tối dần 0,5 giây)
                </label>
                <label className="mt-1 flex items-center gap-2 text-xs font-semibold" style={{ color: INK }} title="Vạch vùng bị nút bấm của TikTok/Reels che — chỉ hiện lúc dựng, không lọt vào video">
                  <input type="checkbox" checked={khungAnToan} onChange={(e) => setKhungAnToan(e.target.checked)} /> 📱 Khung an toàn TikTok · Reels
                </label>
                {khungAnToan && <div className="mt-1 text-[10px] leading-tight text-slate-500">Vùng đỏ là chỗ TikTok/Reels đè nút bấm và chú thích lên. Đừng để tên dự án hay số điện thoại lọt vào đó. <b style={{ color: INK }}>Vạch này không lọt vào video.</b></div>}
              </div>
              <div className="mt-3 border-t pt-2" style={{ borderColor: LINE }}>
                <div className="mb-1 text-xs font-bold" style={{ color: INK }}>Đồi núi</div>
                <label className="flex items-center gap-2 text-xs font-semibold" style={{ color: INK }} title="Đổ bóng theo độ cao — đồi núi Cam Lâm hiện rõ khối, ảnh có chiều sâu">
                  <input type="checkbox" checked={hillshade} onChange={(e) => setHillshade(e.target.checked)} /> ⛰ Đổ bóng đồi núi
                </label>
                <label className="mt-1 flex items-center gap-2 text-xs font-semibold" style={{ color: INK }} title="Dựng địa hình nổi lên thật — thấy rõ nhất khi camera nghiêng">
                  <input type="checkbox" checked={terrain3d} onChange={(e) => setTerrain3d(e.target.checked)} /> 🏔 Địa hình 3D thật
                </label>
                {terrain3d && <div className="mt-1 text-[11px] text-slate-400">Đồi núi nhô lên thật. Nhớ chọn kiểu camera có nghiêng để thấy rõ. Máy yếu có thể chạy chậm hơn.</div>}
                {/* Ba nút Tự động · 2D · 3D nằm ở hàng nút dưới khung xem trước — đây chỉ là phần giải thích. */}
                <div className="mt-2 text-[11px] text-slate-400">
                  <b style={{ color: INK }}>Chế độ hình ảnh: {hinhMode === 'auto' ? 'Tự động' : hinhMode === '2d' ? '2D' : '3D'}</b> (đổi ở hàng nút dưới khung xem trước).{' '}
                  {hinhMode === 'auto' ? 'Máy tự cân: nhìn từ trên xuống thì để phẳng (có 3D cũng không thấy gì), hạ thấp và ngả máy mới dựng núi.'
                    : hinhMode === '2d' ? 'Tắt hẳn địa hình 3D — nhẹ nhất, hợp máy yếu và cảnh tổng quát.'
                    : 'Dựng núi suốt video — máy phải khoẻ, nên bật kèm “Render kỹ” bên dưới.'}
                </div>
                {/* ĐỘ NỔI CỦA NÚI — càng cao càng hùng vĩ nhưng ảnh càng bị kéo méo */}
                <div className="mt-2 flex items-center justify-between text-[11px] font-bold" style={{ color: INK }}>
                  <span>Độ nổi của núi</span>
                  <span style={{ color: GOLD }}>{noiKhoi.toFixed(2)}×</span>
                </div>
                <input type="range" min={0.4} max={2} step={0.05} value={noiKhoi} onChange={(e) => setNoiKhoi(Number(e.target.value))}
                  className="mt-1 w-full" style={{ accentColor: GOLD }} />
                <div className="mt-1 text-[11px] text-slate-400">
                  1× là đúng độ cao thật ngoài đời. Kéo cao thì núi dựng đứng trông hùng vĩ, nhưng ảnh bản đồ
                  bị kéo giãn theo — <b style={{ color: INK }}>đường và bờ biển sẽ cong</b>. Thấy méo thì hạ về 0,8–1×.
                </div>
                <div className="mt-1 text-[11px] text-slate-500">Muốn video mượt tuyệt đối thì bật thêm <b style={{ color: INK }}>🎬 Render kỹ từng khung</b> ở mục ⚙️ Xuất.</div>
              </div>
              <div className="mt-3 border-t pt-2" style={{ borderColor: LINE }}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-bold" style={{ color: INK }}>Tự chỉnh</span>
                  {toneCustom && <button onClick={() => setToneCustom(null)} className="text-[11px] font-semibold underline" style={{ color: '#9b2d2d' }}>bỏ, dùng tông sẵn</button>}
                </div>
                {([['sat', 'Độ rực', -0.5, 1, 0.02], ['con', 'Tương phản', -0.5, 0.8, 0.02], ['briMin', 'Nâng vùng tối', 0, 0.35, 0.01], ['hue', 'Ngả màu', -30, 30, 1]] as const).map(([k, n, mn, mx, st]) => {
                  const cur = toneCustom || (TONES.find((t) => t.key === tone)?.v) || TONES[1].v;
                  return (
                    <div key={k} className="flex items-center gap-2">
                      <span className="w-20 text-[11px] text-slate-400">{n}</span>
                      <input type="range" min={mn} max={mx} step={st} value={(cur as any)[k]} onChange={(e) => setToneCustom({ ...cur, [k]: Number(e.target.value) } as Tone)} className="flex-1" style={{ accentColor: GOLD }} />
                      <span className="w-9 text-right text-[11px] text-slate-400">{Number((cur as any)[k]).toFixed(k === 'hue' ? 0 : 2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(panel === 'lodat') && (<div className="cl-card rounded-xl p-3">
            <div className="mb-2 text-sm font-bold" style={{ color: INK }}>▱ Kiểu khoanh lô</div>
            <div className="mb-1 flex flex-wrap gap-1.5">
              {([['poly', 'Đa giác', 'Bấm từng đỉnh quanh lô — Enter hoặc nhấp đúp là xong'], ['rect', 'Chữ nhật', 'Bấm 2 góc đối diện'], ['square', 'Vuông', 'Bấm tâm rồi bấm ra ngoài'], ['circle', 'Tròn', 'Bấm tâm rồi bấm để định bán kính']] as const).map(([k, n, h]) => (
                <button key={k} onClick={() => { setParcelShape(k); shapePending.current = null; setMode('parcel'); }} className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={btn(parcelShape === k)} title={h}>{n}</button>
              ))}
            </div>
            <div className="mb-3 text-[11px] text-slate-400">{parcelShape === 'poly' ? 'Bấm lần lượt các đỉnh quanh lô. Xong thì bấm Enter hoặc nhấp đúp. Bấm Esc để bỏ điểm vừa vẽ.' : parcelShape === 'circle' ? 'Bấm tâm rồi bấm ra ngoài để định bán kính.' : 'Bấm 2 điểm để tạo hình.'}</div>
            <div className="mb-2 border-t pt-2 text-sm font-bold" style={{ color: NAVY, borderColor: LINE }}>✨ Hiệu ứng lô đất</div>
            <div className="flex flex-wrap gap-1.5">
              {([['neon2', 'Neon 2 lớp'], ['glow', 'Phát sáng'], ['vienkep', 'Viền kép sang'], ['chaysang', 'Vệt sáng chạy'], ['nhipnha', 'Thở nhẹ'], ['toigian', 'Nét mảnh'], ['ants', 'Viền chạy'], ['blink', 'Chớp nháy'], ['static', 'Tĩnh']] as const).map(([k, n]) => (
                <button key={k} onClick={() => setParcelFx(k)} className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={btn(parcelFx === k)}>{n}</button>
              ))}
            </div>
            <div className="mt-2">
              <BangMau mau={parcelColor} doiMau={setParcelColor} goiY={['#C8A14B', '#ff3b30', '#22c55e', '#3b82f6', '#ffffff']} nhanGoiY="Màu viền nổi rõ trên ảnh vệ tinh" nhan="Màu viền lô đất" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-slate-400">Độ đậm nền:</span>
              <input type="range" min={0} max={0.8} step={0.02} value={parcelOpacity} onChange={(e) => setParcelOpacity(Number(e.target.value))} className="flex-1" style={{ accentColor: GOLD }} />
              <span className="w-8 text-right text-xs text-slate-400">{Math.round(parcelOpacity * 100)}%</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 border-t pt-2" style={{ borderColor: LINE }}>
              <label className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: INK }} title="Đốm sáng chạy vòng quanh viền lô"><input type="checkbox" checked={parcelSpark} onChange={(e) => setParcelSpark(e.target.checked)} /> ✨ Đốm sáng chạy viền</label>
              {/* SỐ ĐO LÔ — in dài từng cạnh ngay trên cạnh đó + diện tích ở giữa lô, kiểu video hay làm */}
              <label className="mt-1 flex items-center gap-1.5 text-xs font-semibold" style={{ color: INK }} title="In dài bao nhiêu mét lên từng cạnh lô và diện tích ở giữa — máy tự đo từ hình lô bạn khoanh"><input type="checkbox" checked={loSoDo} onChange={(e) => setLoSoDo(e.target.checked)} /> 📐 Số đo cạnh &amp; diện tích</label>
              {loSoDo && <div className="mt-1 text-[10px] leading-snug text-slate-500">Máy tự đo theo hình lô bạn khoanh. Khoanh càng đúng ranh thì số càng sát — nên khoanh bằng bảng toạ độ VN-2000 cho chuẩn.</div>}
              {/* PHÁT SÁNG — ô tick và thanh kéo NẰM CHUNG MỘT DÒNG cho đỡ tốn chỗ */}
              <div className="mt-1 flex items-center gap-2">
                <label className="flex shrink-0 items-center gap-1.5 text-xs font-semibold" style={{ color: INK }} title="Thêm một quầng sáng rộng quanh lô — chồng lên kiểu viền đang chọn, kéo thanh để chỉnh mạnh yếu">
                  <input type="checkbox" checked={sangLo} onChange={(e) => setSangLo(e.target.checked)} /> ✨ Phát sáng
                </label>
                {sangLo && <input type="range" min={20} max={150} step={5} value={Math.round(sangLoDo * 100)} onChange={(e) => setSangLoDo(Number(e.target.value) / 100)} className="min-w-0 flex-1" style={{ accentColor: GOLD }} title="Kéo để tăng giảm độ sáng" />}
                {sangLo && <b className="shrink-0 text-right text-[11px]" style={{ color: GOLD, minWidth: 36 }}>{Math.round(sangLoDo * 100)}%</b>}
              </div>
              <label className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: INK }} title="Dựng lô đất thành khối nổi — nhìn rõ nhất khi camera nghiêng"><input type="checkbox" checked={parcel3d} onChange={(e) => setParcel3d(e.target.checked)} /> 🧊 3D nổi khối</label>
            </div>
            {parcel3d && <div className="mt-1 text-[11px] text-slate-400">Khối 3D chỉ thấy rõ khi camera nghiêng — chọn kiểu camera có nghiêng (vd “Flycam xoay 360°”).</div>}
            <div className="mt-2 border-t pt-2" style={{ borderColor: LINE }}>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold" style={btn(false)} title="Dán ảnh phối cảnh / mặt bằng phân lô đè lên đúng khu vực lô đất">🖼 Thêm ảnh vào lô<input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { const rd = new FileReader(); rd.onload = () => { setParcelPhoto(String(rd.result)); toast.success('Đã dán ảnh vào lô đất'); }; rd.readAsDataURL(f); } (e.target as HTMLInputElement).value = ''; }} /></label>
                {parcelPhoto && <img src={parcelPhoto} alt="" className="h-8 w-12 rounded border object-cover" style={{ borderColor: LINE }} />}
                {parcelPhoto && <button onClick={() => setParcelPhoto('')} className="text-xs font-semibold underline" style={{ color: '#9b2d2d' }}>bỏ ảnh</button>}
              </div>
              {parcelPhoto && (
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-slate-400">Độ rõ ảnh:</span>
                  <input type="range" min={0.15} max={1} step={0.05} value={photoOpacity} onChange={(e) => setPhotoOpacity(Number(e.target.value))} className="flex-1" style={{ accentColor: GOLD }} />
                  <span className="w-8 text-right text-xs text-slate-400">{Math.round(photoOpacity * 100)}%</span>
                </div>
              )}
              {parcelPhoto && <div className="mt-1 text-[11px] text-slate-400">Ảnh phủ đúng khung bao quanh lô. Muốn khớp hơn thì cắt ảnh cho vuông vắn trước khi tải lên.</div>}
            </div>
            <button onClick={() => { const c = parcel.current; if (!c.length) { toast.info('Chưa khoanh lô đất'); return; } const b = new maplibregl.LngLatBounds(c[0] as any, c[0] as any); c.forEach((p) => b.extend(p as any)); mapRef.current?.fitBounds(b, { padding: 80, duration: 800, maxZoom: 18 }); }} className="mt-2 w-full rounded-lg px-3 py-1.5 text-xs font-semibold" style={btn(false)} title="Đưa camera tới đúng lô đất">🎯 Đưa camera tới lô đất</button>
          </div>)}

          {/* THẺ CHÚ THÍCH & VÙNG HÀNH CHÍNH */}
          {(panel === 'the' || panel === 'vung') && (<div className="cl-card rounded-xl p-3">
            <div className="mb-2 text-sm font-bold" style={{ color: INK }}>💬 Thẻ chú thích ({callouts.current.length})</div>
            {callouts.current.length === 0 && <div className="text-[11px] text-slate-400">Bấm <b>💬 Thẻ chú thích</b> trên bản đồ rồi nhấp vào tiện ích (trường, chợ, biển…). Thẻ có dây nối và tự ghi khoảng cách tới lô đất.</div>}
            <div className="space-y-1.5">
              {callouts.current.map((c) => (
                <div key={c.id} className={`rounded-lg border p-1.5 ${selCallout === c.id ? 'ring-2' : ''}`} style={{ borderColor: LINE, ...(selCallout === c.id ? { boxShadow: '0 0 0 2px ' + GOLD } : {}) }}>
                  <div className="flex items-center gap-1">
                    <input value={c.label} onChange={(e) => { callouts.current = callouts.current.map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x)); drawCallouts(); setCalloutVer((v) => v + 1); }} className="min-w-0 flex-1 rounded border px-1.5 py-0.5 text-xs" style={{ borderColor: LINE }} />
                    <button onClick={() => { mapRef.current?.flyTo({ center: [c.lng, c.lat], zoom: 16.5, duration: 700 }); setSelCallout(c.id); }} className="px-1 text-xs font-semibold" style={{ color: INK }} title="Đi tới">⌖</button>
                    <button onClick={() => { callouts.current = callouts.current.filter((x) => x.id !== c.id); drawCallouts(); setCalloutVer((v) => v + 1); bumpGeom(); }} className="px-1 text-xs font-bold text-red-600" title="Xoá thẻ">×</button>
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    <span className="shrink-0 text-[10px] text-slate-400">Nhãn nhỏ</span>
                    <input value={c.cat || ''} placeholder="VD: KHÁCH SẠN · TRƯỜNG HỌC" onChange={(e) => { callouts.current = callouts.current.map((x) => (x.id === c.id ? { ...x, cat: e.target.value } : x)); drawCallouts(); setCalloutVer((v) => v + 1); }} className="min-w-0 flex-1 rounded border px-1.5 py-0.5 text-[11px]" style={{ borderColor: LINE }} title="Dòng chữ nhỏ hiện phía trên thẻ — chi tiết này làm thẻ trông cao cấp hẳn" />
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <label className="flex items-center gap-1 text-[11px] text-slate-300"><input type="checkbox" checked={c.dist} onChange={(e) => { callouts.current = callouts.current.map((x) => (x.id === c.id ? { ...x, dist: e.target.checked } : x)); drawCallouts(); setCalloutVer((v) => v + 1); }} /> khoảng cách</label>
                    <span className="ml-auto text-[11px] text-slate-400">dời thẻ:</span>
                    {([['◀', -1, 0], ['▶', 1, 0], ['▲', 0, 1], ['▼', 0, -1]] as const).map(([ic, sx, sy]) => (
                      <button key={ic} onClick={() => { const st = 0.0004 * Math.pow(2, 15 - (mapRef.current?.getZoom() || 15)); callouts.current = callouts.current.map((x) => (x.id === c.id ? { ...x, dx: x.dx + sx * st, dy: x.dy + sy * st } : x)); drawCallouts(); setCalloutVer((v) => v + 1); }} className="rounded border px-1 text-[10px]" style={{ borderColor: LINE, color: NAVY }}>{ic}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t pt-2" style={{ borderColor: LINE }}>
              <div className="mb-1 text-sm font-bold" style={{ color: INK }}>🗺 Vùng đã khoanh ({zones.current.length})</div>
              {zones.current.length === 0 && <div className="text-[11px] text-slate-400">Gõ tên xã/phường vào ô tìm kiếm rồi bấm <b>🗺 Khoanh vùng</b>.</div>}
              {zones.current.map((z, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate">{z.name}</span>
                  <button onClick={() => { zones.current = zones.current.filter((_, j) => j !== i); drawZones(); setCalloutVer((v) => v + 1); bumpGeom(); }} className="font-bold text-red-600" title="Xoá vùng">×</button>
                </div>
              ))}
              {zones.current.length > 0 && (
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-slate-400">Độ đậm:</span>
                  <input type="range" min={0} max={0.6} step={0.02} value={zoneOpacity} onChange={(e) => setZoneOpacity(Number(e.target.value))} className="flex-1" style={{ accentColor: GOLD }} />
                  <button onClick={clearZones} className="rounded px-2 py-0.5 text-[11px] font-semibold" style={btn(false)}>Xoá hết</button>
                </div>
              )}
            </div>
          </div>)}

          {/* Biểu đồ */}
          {(panel === 'bieudo') && (<div className="cl-card rounded-xl p-3">
            <label className="flex items-center gap-2 text-sm font-bold" style={{ color: INK }}><input type="checkbox" checked={chartOn} onChange={(e) => setChartOn(e.target.checked)} /> 📊 Biểu đồ động</label>
            {chartOn && (
              <div className="mt-2 space-y-2">
                <input value={chartTitle} onChange={(e) => setChartTitle(e.target.value)} placeholder="Tiêu đề biểu đồ" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: LINE }} />
                {/* CHỌN KIỂU — mỗi ô là hình VẼ THẬT bằng đúng bộ vẽ dùng cho video, nhìn là biết ra sao */}
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400">Kiểu biểu đồ</span>
                    <span className="text-[10px] text-slate-500">{CHART_TYPES.length} kiểu · bấm để đổi</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {CHART_TYPES.map((t) => {
                      const dung = chartType === t.key;
                      return (
                        <button key={t.key} onClick={() => setChartType(t.key)} title={t.note}
                          className="overflow-hidden rounded-xl p-1.5 text-left transition hover:-translate-y-px"
                          style={{ background: dung ? 'linear-gradient(180deg, rgba(200,161,75,.16), rgba(200,161,75,.03))' : '#0b1826', boxShadow: dung ? '0 0 0 1.5px ' + GOLD + ', 0 10px 26px -14px rgba(200,161,75,.7)' : '0 0 0 1px ' + LINE }}>
                          <span className="block overflow-hidden rounded-lg"><ChartPreview type={t.key} w={104} h={62} /></span>
                          <span className="mt-1 block text-[11px] font-bold leading-tight" style={{ color: dung ? GOLD : INK }}>{t.name}</span>
                          <span className="block text-[9px] leading-tight text-slate-500">{t.note}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[11px] font-bold text-slate-400">{chartType === 'radial' ? 'Số phần trăm' : chartType === 'kpi' ? 'Ba con số muốn khoe' : 'Số liệu'}</div>
                  <input value={chartRaw} onChange={(e) => setChartRaw(e.target.value)} placeholder="T2:80, T3:120, T4:150" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: LINE }} />
                  <div className="mt-1 text-[10px] leading-tight text-slate-500">
                    {chartType === 'radial' ? <>Gõ <b style={{ color: INK }}>Đã bán:72</b> — một dòng duy nhất, số từ 0 đến 100.</>
                      : chartType === 'kpi' ? <>Mỗi con số một cặp, cách nhau dấu phẩy: <b style={{ color: INK }}>phút ra biển:5, km tới sân bay:12, % tăng giá:18</b></>
                      : (chartType === 'stack' || chartType === 'group') ? <>Mỗi mốc nhiều nhóm thì viết các số cách nhau bằng <b style={{ color: INK }}>dấu gạch chéo</b>: <b style={{ color: INK }}>2024:70/45, 2025:95/60</b></>
                      : <>Viết <b style={{ color: INK }}>Nhãn:số</b>, cách nhau dấu phẩy. Vd <b style={{ color: INK }}>T2:80, T3:120, T4:150</b></>}
                  </div>
                </div>
                {(chartType === 'stack' || chartType === 'group') && (
                  <div>
                    <div className="mb-1 text-[11px] font-bold text-slate-400">Tên các nhóm</div>
                    <input value={chartSeries} onChange={(e) => setChartSeries(e.target.value)} placeholder="Đất nền, Nhà phố" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: LINE }} />
                    <div className="mt-1 text-[10px] leading-tight text-slate-500">Tên hiện ở phần chú thích màu phía trên biểu đồ, theo đúng thứ tự các số bạn gõ.</div>
                  </div>
                )}
              </div>
            )}
          </div>)}

          {/* Phụ đề (caption theo thời gian) */}
          {(panel === 'chu') && (<div className="cl-card rounded-xl p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-bold" style={{ color: INK }}>💬 Lời thoại / phụ đề</div>
              <div className="flex gap-1.5">
                <button onClick={() => setSubs(genScript(scripts[activeScript]?.key || 'vitri', property, duration))} className="rounded-lg px-2 py-1 text-xs font-bold" style={{ background: GOLD, color: NAVY }} title="Tự viết lời thoại theo kịch bản này">✍️ Tự viết</button>
                <label className="cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold" style={btn(false)} title="Nhập SRT/VTT">📥 SRT<input type="file" accept=".srt,.vtt,text/vtt" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const s = parseSrtVtt(await f.text()); if (s.length) { setSubs(s); toast.success('Đã nhập ' + s.length + ' phụ đề'); } else toast.error('File SRT/VTT không hợp lệ'); } (e.target as HTMLInputElement).value = ''; }} /></label>
                <button onClick={() => { const last = subs[subs.length - 1]; const s0 = last ? last.e : 0; setSubs([...subs, { s: s0, e: Math.min(duration, s0 + 2), t: '' }]); }} className="rounded-lg px-2 py-1 text-xs font-semibold" style={btn(false)}>+ Dòng</button>
              </div>
            </div>
            {subs.length === 0 && <div className="text-xs text-slate-400">Chưa có phụ đề. Bấm “+ Dòng” để thêm caption hiện đúng khoảng giây.</div>}
            <div className="space-y-1.5">
              {subs.map((c, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input type="number" min={0} max={duration} step={0.5} value={c.s} onChange={(e) => { const v = Number(e.target.value) || 0; setSubs(subs.map((x, j) => (j === i ? { ...x, s: v } : x))); }} className="w-12 rounded border px-1 py-1 text-xs" style={{ borderColor: LINE }} title="giây bắt đầu" />
                  <input type="number" min={0} max={duration} step={0.5} value={c.e} onChange={(e) => { const v = Number(e.target.value) || 0; setSubs(subs.map((x, j) => (j === i ? { ...x, e: v } : x))); }} className="w-12 rounded border px-1 py-1 text-xs" style={{ borderColor: LINE }} title="giây kết thúc" />
                  <input value={c.t} onChange={(e) => { const v = e.target.value; setSubs(subs.map((x, j) => (j === i ? { ...x, t: v } : x))); }} placeholder="Nội dung caption" className="min-w-0 flex-1 rounded border px-2 py-1 text-xs" style={{ borderColor: LINE }} />
                  <button onClick={() => setSubs(subs.filter((_, j) => j !== i))} className="px-1 text-sm font-bold text-red-600" title="Xoá dòng">×</button>
                </div>
              ))}
            </div>
          </div>)}

          {/* Phân cảnh (Scenes) */}
          {(panel === 'chu') && (<div className="cl-card rounded-xl p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-bold" style={{ color: INK }}>🎬 Phân cảnh</div>
              <div className="flex gap-1">
                <button onClick={makeDefaultScenes} className="rounded px-2 py-1 text-xs font-semibold" style={btn(false)}>Mẫu 5 cảnh</button>
                <button onClick={addScene} className="rounded px-2 py-1 text-xs font-bold" style={{ background: GOLD, color: NAVY }}>＋</button>
              </div>
            </div>
            {scenes.length === 0 && <div className="text-[11px] text-slate-400">Chưa có cảnh. Thêm cảnh để chia video; tổng thời lượng = tổng các cảnh.</div>}
            <div className="space-y-1">
              {scenes.map((s, i) => (
                <div key={s.id} className="flex items-center gap-1 text-xs">
                  <span className="w-3 text-slate-400">{i + 1}</span>
                  <input value={s.name} onChange={(e) => updateScene(s.id, { name: e.target.value })} className="min-w-0 flex-1 rounded border px-1.5 py-1" style={{ borderColor: LINE }} />
                  <input type="number" min={1} max={60} value={s.dur} onChange={(e) => updateScene(s.id, { dur: Math.max(1, Number(e.target.value) || 1) })} className="w-11 rounded border px-1 py-1" style={{ borderColor: LINE }} title="giây" />
                  <button onClick={() => moveScene(s.id, -1)} title="Lên">⬆</button>
                  <button onClick={() => moveScene(s.id, 1)} title="Xuống">⬇</button>
                  <button onClick={() => dupScene(s.id)} title="Nhân bản">⧉</button>
                  <button onClick={() => deleteScene(s.id)} className="text-red-600" title="Xoá">×</button>
                </div>
              ))}
            </div>
            {scenes.length > 0 && <div className="mt-1 text-[11px] text-slate-400">Tổng {scenes.reduce((a, s) => a + (s.dur || 0), 0)}s → thời lượng video. Bấm cảnh trên timeline để nhảy tới.</div>}
          </div>)}

          {/* Thời lượng + độ phân giải + nhạc */}
          {(panel === 'xuat' || panel === 'amthanh') && (<div className="cl-card rounded-xl p-3">
            <div className="mb-2 text-sm font-bold" style={{ color: INK }}>⚙️ Cài đặt xuất</div>
            {/* Nút bật/tắt nằm NGAY CẠNH nút Quay ở dưới khung xem trước — đây chỉ là phần giải thích. */}
            <div className="mb-2 text-[11px] leading-snug text-slate-400">
              <b style={{ color: renderKy ? GOLD : '#94a3b8' }}>🎬 Render kỹ đang {renderKy ? 'BẬT' : 'tắt'}</b> — bật/tắt bằng nút cạnh nút Quay.{' '}
              {renderKy
                ? <>Bấm <b style={{ color: INK }}>Quay &amp; xuất MP4</b> là máy đặt camera vào từng khung, <b style={{ color: INK }}>chờ bản đồ vẽ xong hẳn</b> rồi mới chụp khung đó — đúng cách phần mềm dựng phim làm.
                    Video 120 giây mất chừng <b style={{ color: INK }}>5–10 phút</b>, đổi lại <b style={{ color: INK }}>không khung nào bị rớt</b>, mượt kể cả máy yếu.
                    Nhạc nền, giọng đọc và tiếng động đều dùng được bình thường — máy trộn sẵn cả bản tiếng rồi nhét vào cùng file, khớp đúng từng giây.</>
                : <>Quay theo thời gian thật — nhanh (đúng bằng thời lượng video), nhưng máy vẽ không kịp thì <b style={{ color: '#fca5a5' }}>rớt khung, xem sẽ thấy giật</b>.</>}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-400">Thời lượng</label>
              <input type="text" inputMode="numeric" value={goDai ?? String(duration)}
                onFocus={(e) => { setGoDai(String(duration)); requestAnimationFrame(() => e.target.select()); }}
                onChange={(e) => setGoDai(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                onBlur={() => { const v = Number(goDai); setGoDai(null); if (goDai !== null && goDai !== '' && v >= 1) datThoiLuong(v); }}
                className="w-16 rounded-lg px-2 py-1 text-center font-mono text-sm font-bold" style={{ background: '#0d2033', border: '1px solid ' + LINE, color: INK }} title="Gõ số giây rồi bấm Enter (từ 3 đến 120)" />
              <span className="text-xs text-slate-400">giây</span>
              <span className="ml-auto text-[10px] text-slate-500">tối đa 120s</span>
            </div>
            <input type="range" min={3} max={120} step={1} value={duration} onChange={(e) => datThoiLuong(Number(e.target.value))} className="mt-1 w-full" style={{ accentColor: GOLD }} />
            <div className="mt-1 flex flex-wrap gap-1">
              {[8, 15, 20, 30, 45, 60, 90, 120].map((v) => (
                <button key={v} onClick={() => datThoiLuong(v)} className="rounded-lg px-2 py-0.5 text-[11px] font-semibold transition" style={duration === v ? { background: GOLD, color: NAVY } : { background: 'rgba(255,255,255,.08)', color: '#cbd5e1' }}>{v}s</button>
              ))}
            </div>
            {scenes.length > 0 && <div className="mt-1 text-[10px] leading-tight text-slate-500">Đang chia <b style={{ color: INK }}>{scenes.length} phân cảnh</b> — đổi thời lượng ở đây thì các cảnh <b style={{ color: INK }}>tự co giãn theo tỉ lệ</b>, không cảnh nào mất.</div>}
            {/* KHỔ MÀN HÌNH THEO NƠI ĐĂNG — mỗi nơi một tỉ lệ, đăng sai khổ là bị cắt mất chữ */}
            <div className="mb-1 mt-3 text-xs font-bold text-slate-400">Khổ màn hình (đăng ở đâu?)</div>
            <div className="grid grid-cols-1 gap-1">
              {KHO_MAN.map((k) => (
                <button key={k.key} onClick={() => setOrient(k.key)} title={k.note}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left" style={{ background: orient === k.key ? 'rgba(200,161,75,.18)' : '#16283d', boxShadow: orient === k.key ? 'inset 0 0 0 1.5px ' + GOLD : 'none' }}>
                  <span className="shrink-0 rounded" style={{ width: k.key === '16:9' ? 26 : k.key === '9:16' ? 10 : k.key === '4:5' ? 14 : 17, height: k.key === '16:9' ? 15 : k.key === '9:16' ? 18 : k.key === '4:5' ? 17 : 17, background: orient === k.key ? GOLD : '#3d5470' }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-bold" style={{ color: orient === k.key ? GOLD : INK }}>{k.ten}</span>
                    <span className="block truncate text-[10px] text-slate-400">{k.px} · {k.note}</span>
                  </span>
                  <label className="shrink-0 cursor-pointer p-1" title="Tích để đưa khổ này vào nút Xuất đủ khổ" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={khoXuat.includes(k.key)} onChange={(e) => setKhoXuat((p2) => (e.target.checked ? [...p2, k.key] : p2.filter((x) => x !== k.key)))} />
                  </label>
                </button>
              ))}
            </div>
            <button onClick={exportTheoKho} disabled={!ready || rec || exporting || busyAll || !khoXuat.length}
              className="mt-1.5 w-full rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50" style={{ background: '#7c3aed', color: '#fff' }}
              title="Quay kịch bản đang mở lần lượt cho từng khổ đã tích, rồi nén hết vào một file ZIP">
              {busyAll ? '⏳ Đang xuất…' : `🖥 Xuất đủ khổ đã tích (${khoXuat.length})`}
            </button>
            <div className="mb-2 mt-1 text-[10px] text-slate-500">Tích ô vuông bên phải để chọn khổ. Một lần bấm ra đủ file cho từng nơi đăng — khỏi phải chỉnh tay rồi quay lại từng khổ.</div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">Chất lượng:</span>
              <button onClick={() => setRes('1080')} className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={btn(res === '1080')}>1080p</button>
              <button onClick={() => setRes('720')} className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={btn(res === '720')}>720p</button>
            </div>
            <label className="mt-3 block text-xs font-semibold text-slate-400">Nhạc nền (file nhạc hoặc trích tiếng từ video)</label>
            <input type="file" accept="audio/*,video/*" onChange={(e) => { const f = e.target.files?.[0] || null; setAudio(f); if (f) registerAsset({ kind: 'audio', name: f.name, src: 'aud:' + f.name + f.size, file: f }); }} className="mt-1 w-full text-xs" />
            {audio && <div className="mt-1 flex items-center gap-2 truncate text-xs text-slate-400">🎵 {audio.name} <button onClick={() => setAudio(null)} className="font-semibold underline" style={{ color: '#9b2d2d' }}>bỏ</button></div>}
            <label className="mt-3 block text-xs font-semibold text-slate-400">Giọng đọc (tải lên hoặc thu mic)</label>
            <div className="mt-1 flex items-center gap-2">
              <input type="file" accept="audio/*" onChange={(e) => setVoice(e.target.files?.[0] || null)} className="min-w-0 flex-1 text-xs" />
              <button onClick={recVoice} className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold text-white" style={{ background: voiceRec ? '#ef4444' : NAVY }}>{voiceRec ? '■ Dừng' : '● Thu âm'}</button>
            </div>
            {voice && <div className="mt-1 flex items-center gap-2 truncate text-xs text-slate-400">🎤 {voice.name} <button onClick={() => setVoice(null)} className="font-semibold underline" style={{ color: '#9b2d2d' }}>bỏ</button></div>}
          </div>)}
        </div>
      </div>

      {/* TIMELINE — kéo clip để dời, kéo cạnh để co giãn; điều khiển KHI phần tử hiện trong video */}
      {/* Nút gọi lại dòng thời gian khi đang thu gọn */}
      {thuGonDuoi && (
        <div className="shrink-0 px-4 py-1.5 text-center" style={{ background: '#0b1826', borderTop: '1px solid #1b3149' }}>
          <button onClick={() => setThuGonDuoi(false)} className="rounded-lg px-3 py-1 text-[11px] font-bold" style={{ background: GOLD, color: NAVY }}>⌃ Mở lại dòng thời gian</button>
          <span className="ml-2 text-[11px] text-slate-400">Đang phóng to khung hình — {playhead.toFixed(1)}s / {duration}s</span>
        </div>
      )}
      <div className="cl-mb-tl shrink-0 px-4 py-3" style={{ background: '#0b1826', borderTop: '1px solid #1b3149', display: thuGonDuoi ? 'none' : undefined }}>
        <div className="cl-tl-hang mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <button onClick={() => { if (previewing) togglePause(); else preview(); }} disabled={!ready || rec || exporting || busyAll} className="cl-btn-vang rounded-xl px-3.5 py-1.5 text-xs font-bold transition" style={previewing && !paused ? { background: '#64748b', color: '#e2e8f0' } : { background: 'linear-gradient(180deg, #dcb768, ' + GOLD + ')', color: NAVY, boxShadow: '0 8px 20px -10px rgba(200,161,75,.9)' }}
            title="Phím cách: chạy ↔ tạm dừng">{!previewing ? '▶ Chạy thử' : paused ? '▶ Chạy tiếp' : '⏸ Tạm dừng'}</button>
          {previewing && <button onClick={stopPreview} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-white" style={{ background: '#ef4444' }} title="Dừng hẳn (Esc)">⏹ Dừng</button>}
          <button onClick={() => (selObj ? splitObj(selObj) : toast.info('Chọn 1 object rồi Cắt'))} disabled={!selObj} className="rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-40" style={{ background: '#1b3149', color: '#e2e8f0' }} title="Cắt clip object tại playhead (phím S không dùng — bấm nút)">✂ Cắt</button>
          {/* ĐANG XEM GIÂY MẤY — chỉ là CHỮ, không phải ô nhập. Trước đây để hai ô số cạnh nhau
              (một ô vạch thời gian, một ô thời lượng) nên người mới hay gõ nhầm ô. */}
          <div className="flex items-center gap-1">
            <button onClick={() => nudgePlayhead(-0.1)} disabled={previewing || rec} className="rounded px-1.5 py-1 text-[11px] font-bold text-slate-200 disabled:opacity-40" style={{ background: '#1b3149' }} title="Lùi 0,1 giây">◀</button>
            <span className="min-w-[74px] text-center font-mono text-xs text-slate-200" title="Đang xem tới giây này. Kéo núm vàng trên thước để tua nhanh.">{playhead.toFixed(1)}s <span className="text-slate-500">/ {duration}s</span></span>
            <button onClick={() => nudgePlayhead(0.1)} disabled={previewing || rec} className="rounded px-1.5 py-1 text-[11px] font-bold text-slate-200 disabled:opacity-40" style={{ background: '#1b3149' }} title="Tiến 0,1 giây">▶</button>
          </div>
          {/* THỜI LƯỢNG VIDEO — ô số DUY NHẤT trên dòng thời gian */}
          <div className="flex items-center gap-1" title="Video dài bao nhiêu giây (từ 3 đến 120). Gõ xong bấm Enter hoặc bấm ra ngoài.">
            <span className="text-[11px] font-semibold text-slate-400">Video dài</span>
            <input type="text" inputMode="numeric" value={goDai ?? String(duration)} disabled={previewing || rec}
              onFocus={(e) => { setGoDai(String(duration)); requestAnimationFrame(() => e.target.select()); }}
              onChange={(e) => setGoDai(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              onBlur={() => { const v = Number(goDai); setGoDai(null); if (goDai !== null && goDai !== '' && v >= 1) datThoiLuong(v); }}
              className="w-14 rounded px-1 py-0.5 text-center font-mono text-xs font-bold" style={{ background: '#0d2033', border: '1px solid #24405c', color: GOLD }} />
            <span className="text-[11px] text-slate-400">giây</span>
            {[15, 30, 60].map((v) => <button key={v} onClick={() => datThoiLuong(v)} disabled={previewing || rec} className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-300 disabled:opacity-40" style={{ background: '#1b3149' }}>{v}s</button>)}
          </div>
          <button onClick={() => setThuGonDuoi(true)} className="rounded-lg px-2 py-1 text-[11px] font-bold text-slate-200" style={{ background: '#1b3149' }} title="Giấu dòng thời gian để khung xem trước to hết cỡ — hợp nhất khi làm video khổ dọc">{mobile ? '⌄ Thu gọn' : '⌄ Thu gọn · phóng to khung'}</button>
          <span className="cl-tl-hint text-[11px] text-slate-400">Kéo núm vàng trên thước để tua · kéo clip để dời/co giãn</span>
          <div className="ml-auto flex items-center gap-1 text-xs">
            <button onClick={() => setTlZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))} className="rounded px-2 py-0.5 font-bold text-slate-300">－</button>
            <span className="text-slate-400">{tlZoom}×</span>
            <button onClick={() => setTlZoom((z) => Math.min(6, +(z + 0.5).toFixed(1)))} className="rounded px-2 py-0.5 font-bold text-slate-300">＋</button>
          </div>
        </div>
        {/* Thêm bao nhiêu lớp cũng không bị tràn: vùng này TỰ CUỘN DỌC khi dài quá,
            và thước giây dính lại trên cùng nên cuộn xuống vẫn biết đang ở giây nào. */}
        {/* Thanh trượt NGANG chỉ hiện khi đã phóng to dòng thời gian (trên 1×). Để 1× mà vẫn bật
            thì trình duyệt chừa sẵn một dải trống dưới đáy — mất toi một dòng mà chẳng để làm gì. */}
        <div className="cl-scroll-thin max-h-[42vh] overflow-y-auto" style={{ overflowX: tlZoom > 1 ? 'auto' : 'hidden' }}>
        <div ref={tlRef} onPointerDown={scrubStart} className="relative select-none" style={{ width: `${tlZoom * 100}%` }}>
          {/* ── THƯỚC GIÂY — bấm vào đâu nhảy tới đó, hoặc bấu vào NÚM VÀNG mà kéo qua lại ── */}
          <div className="cl-tl-ruler sticky top-0 z-30 mb-1 h-7 rounded" style={{ background: '#0a1a2b', boxShadow: 'inset 0 0 0 1px #16324b', cursor: 'ew-resize' }} title="Bấm hoặc kéo để tua">
            {tlTicks.map((t) => (
              <div key={t} className="pointer-events-none absolute inset-y-0" style={{ left: `${(t / Math.max(1, duration)) * 100}%` }}>
                <div className="absolute bottom-0 h-2.5 w-[1px]" style={{ background: '#2b4a67' }} />
                <div className="absolute bottom-3 whitespace-nowrap pl-1 text-[9px] font-semibold text-slate-500">{Number.isInteger(t) ? t : t.toFixed(1)}s</div>
              </div>
            ))}
            {/* Mốc khung camera in mờ lên thước cho dễ canh (núm sẽ tự hít vào mấy mốc này) */}
            {camKeys.map((k, i) => <div key={'kt' + i} className="pointer-events-none absolute bottom-0 top-0 w-[1px]" style={{ left: `${(k.t / Math.max(1, duration)) * 100}%`, background: 'rgba(196,181,253,.45)' }} />)}
            <button onPointerDown={(e) => beginPlayheadDrag(e)} className="absolute top-1 z-30 -translate-x-1/2 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold"
              style={{ left: `${(playhead / Math.max(1, duration)) * 100}%`, background: GOLD, color: NAVY, cursor: 'ew-resize', touchAction: 'none', boxShadow: '0 1px 6px rgba(0,0,0,.55)' }}
              title="Kéo qua trái/phải để tua. Núm tự hít vào đầu/cuối video, mốc camera, lời thoại — giữ Shift nếu muốn kéo tự do.">{playhead.toFixed(1)}s</button>
          </div>
          {scenes.length > 0 && (
            <div className="cl-tl-scenes relative mb-1 h-5">
              {scenes.map((s, i) => { const st = sceneStart(i); const w = (s.dur / Math.max(1, duration)) * 100; return <button key={s.id} onPointerDown={(e) => { e.stopPropagation(); setPlayhead(+st.toFixed(1)); }} className="absolute inset-y-0 overflow-hidden whitespace-nowrap rounded px-1 text-left text-[9px] font-semibold text-white" style={{ left: `${(st / Math.max(1, duration)) * 100}%`, width: `${w}%`, background: i % 2 ? '#3b4b63' : '#2c3a4f', borderRight: '1px solid #0b1826' }} title={s.name}>{s.name}</button>; })}
            </div>
          )}
          {/* Mỗi hàng: [mã, tên hiện ra, màu thanh clip, biểu tượng in trong thanh clip] */}
          {([['camera', 'Camera', '#475569', '🎥'], ['route', 'Tuyến', '#ff5a2c', '〰'], ['text', 'Chữ', '#C8A14B', 'T'], ['chart', 'Biểu đồ', '#22c55e', '📊'], ['music', 'Nhạc', '#3b82f6', '🎵']] as const).map(([tk, label, color, icon]) => (
            <div key={tk} className="cl-tl-track relative mb-1 h-7 overflow-hidden rounded-lg" style={{ background: 'linear-gradient(180deg, #0e2337, #0b1c2d)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.05)' }}>
              {/* Hàng Camera không phải là clip kéo được nên tên vẫn in ở nền. Các hàng khác:
                  tên nằm TRONG thanh clip, kéo clip đi đâu tên chạy theo đó (học từ MapEffect). */}
              {tk === 'camera' && <span className="pointer-events-none absolute left-2 top-1.5 z-10 text-[10px] font-semibold text-slate-400">{label}{camKeys.length > 0 ? ` · ${camKeys.length} khung` : ''}</span>}
              {tk === 'camera' && camKeys.length === 0 && <span className="cl-mb-an pointer-events-none absolute left-[70px] top-1.5 z-10 text-[10px] text-slate-400">chỉnh bản đồ tới góc đẹp rồi bấm ＋ Chốt khung →</span>}
              {tk !== 'camera' && <button onClick={() => setTracksOn((t) => ({ ...t, [tk]: !(t as any)[tk] }))} className="absolute right-1 top-1 z-20 text-[11px]" title={(tracksOn as any)[tk] ? (tk === 'music' ? 'Tắt tiếng' : 'Ẩn') : 'Bật'}>{(tracksOn as any)[tk] ? (tk === 'music' ? '🔊' : '👁') : (tk === 'music' ? '🔇' : '🚫')}</button>}
              {tk === 'camera' ? (
                <>
                  <div className="absolute inset-y-2 rounded" style={{ left: '0%', width: '100%', background: camKeys.length >= 2 ? 'linear-gradient(90deg,#4c1d95,#7c3aed)' : color, opacity: camKeys.length >= 2 ? 0.55 : 0.35 }} />
                  {/* Mỗi mốc = một hình thoi, kéo được để đổi thời điểm · bấm để nhảy tới · chuột phải để xoá */}
                  {camKeys.map((k, i) => (
                    <button key={i} onPointerDown={(e) => beginKfDrag(k, e)} onClick={(e) => { e.stopPropagation(); gotoKeyframe(k); }}
                      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCamKeys(camKeys.filter((_, j) => j !== i)); }}
                      className="absolute top-1/2 z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-sm"
                      style={{ left: `${(k.t / Math.max(1, duration)) * 100}%`, background: k.ease === 'hold' ? '#f59e0b' : '#c4b5fd', boxShadow: '0 0 0 1.5px #4c1d95', cursor: 'ew-resize', touchAction: 'none' }}
                      title={`Khung tại ${k.t.toFixed(1)}s · ${EASES.find((x) => x.key === (k.ease || 'smooth'))?.name} — kéo để dời · bấm để xem · chuột phải để xoá`} />
                  ))}
                  {/* MỐC NGẮM BIỂN — kéo ngang để đổi giây, bấm để xem, chuột phải để bỏ */}
                  {bienKhung.map((k, i) => {
                    const g0 = clips?.route?.[0] ?? 0.5, gDai = Math.max(1, clips?.route?.[1] ?? duration);
                    const giay = g0 + k.t * gDai;
                    return (
                      <button key={'bk' + i}
                        onPointerDown={(e) => {
                          e.stopPropagation(); e.preventDefault();
                          const cont = (e.currentTarget.parentElement as HTMLElement); const rc = cont.getBoundingClientRect();
                          const keo = (ev: PointerEvent) => {
                            const gy = Math.max(0, Math.min(duration, ((ev.clientX - rc.left) / Math.max(1, rc.width)) * duration));
                            setBienKhung((cu) => cu.map((x, j) => (j === i ? { ...x, t: Math.max(0, Math.min(1, (gy - g0) / gDai)) } : x)));
                          };
                          const nha = () => { window.removeEventListener('pointermove', keo); window.removeEventListener('pointerup', nha); };
                          window.addEventListener('pointermove', keo); window.addEventListener('pointerup', nha);
                        }}
                        onClick={(e) => { e.stopPropagation(); setPlayhead(Math.round(giay * 10) / 10); if (k.zoom != null && mapRef.current) mapRef.current.jumpTo({ center: [k.lng!, k.lat!], zoom: k.zoom, pitch: k.pitch, bearing: k.bearing } as any); }}
                        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setBienKhung(bienKhung.filter((_, j) => j !== i)); }}
                        className="absolute top-1/2 z-30 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full text-[10px] leading-[18px]"
                        style={{ left: `${(giay / Math.max(1, duration)) * 100}%`, background: k.kieu === 'deo' ? '#fbbf24' : '#38bdf8', boxShadow: '0 0 0 1.5px ' + (k.kieu === 'deo' ? '#b45309' : '#0369a1'), cursor: 'ew-resize', touchAction: 'none' }}
                        title={`${k.kieu === 'deo' ? 'Cảnh đèo núi' : 'Cảnh ngắm biển'} tại ${giay.toFixed(1)}s (dài ${k.dai}s) — kéo để dời · bấm để xem · chuột phải để bỏ`}>{k.kieu === 'deo' ? '🏔️' : '🌊'}</button>
                    );
                  })}
                  <button onClick={(e) => { e.stopPropagation(); captureKeyframe(); }} className="absolute right-1 top-0.5 z-20 rounded-md px-2 py-1 text-[10px] font-bold shadow" style={{ background: '#7c3aed', color: '#fff' }} title="Chốt góc nhìn bản đồ hiện tại thành một khung tại vạch đứng">{mobile ? '＋' : '＋ Chốt khung'}</button>
                </>
              ) : (
                <div className="absolute inset-y-1 flex items-center justify-between overflow-hidden rounded" style={{ left: `${((clips as any)[tk][0] / Math.max(1, duration)) * 100}%`, width: `${((clips as any)[tk][1] / Math.max(1, duration)) * 100}%`, background: color, opacity: (tracksOn as any)[tk] ? 1 : 0.3, cursor: 'grab', touchAction: 'none' }} onPointerDown={(e) => { e.stopPropagation(); beginDrag(tk as any, 'move', e); }}>
                  <div className="h-full w-2 shrink-0 rounded-l" style={{ cursor: 'ew-resize', background: 'rgba(0,0,0,.25)' }} onPointerDown={(e) => { e.stopPropagation(); beginDrag(tk as any, 'l', e); }} />
                  <span className="pointer-events-none min-w-0 flex-1 truncate px-1 text-[10px] font-bold text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,.6)' }} title={label}>{icon} {label}</span>
                  <div className="h-full w-2 shrink-0 rounded-r" style={{ cursor: 'ew-resize', background: 'rgba(0,0,0,.25)' }} onPointerDown={(e) => { e.stopPropagation(); beginDrag(tk as any, 'r', e); }} />
                </div>
              )}
            </div>
          ))}
          {objects.length > 0 && <div className="mb-1 mt-1 text-[10px] font-semibold text-slate-400">{mobile ? 'ĐỐI TƯỢNG' : 'ĐỐI TƯỢNG (kéo/co · chọn rồi ✂ Cắt · Ctrl+C/V · Delete)'}</div>}
          {objects.map((o) => {
            const col = o.type === 'text' ? '#C8A14B' : o.type === 'image' ? '#8b5cf6' : o.type === 'widget' ? '#f472b6' : o.type === 'xe' ? '#38bdf8' : '#06b6d4'; const sel = selObj === o.id; const total = Math.max(1, duration);
            // Tên in TRONG thanh clip — kéo clip đi đâu tên chạy theo đó (học từ MapEffect).
            const ten = o.type === 'text' ? 'T ' + (o.text || 'Chữ').slice(0, 22)
              : o.type === 'image' ? '🖼 Ảnh'
              : o.type === 'xe' ? '🚗 ' + ((XE_LIST.find((x) => x.key === o.xk) || XE_LIST[0]).name)
              : o.type === 'widget' ? '✨ ' + ((WIDGETS.find((x) => x.key === o.wk) || WIDGETS[0]).name).slice(0, 18)
              : '🎬 Video';
            return (
              <div key={o.id} className="cl-tl-obj relative mb-1 h-6 overflow-hidden rounded-lg" style={{ background: 'linear-gradient(180deg, #0e2337, #0b1c2d)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.05)' }}>
                {/* Nút nhanh của từng lớp: con mắt ẩn/hiện · ổ khoá · dấu ba chấm mở menu đầy đủ */}
                <span className="absolute right-1 top-0.5 z-30 flex items-center gap-1">
                  <button onClick={(e) => { e.stopPropagation(); updateObj(o.id, { hidden: !o.hidden }); }} className="text-[11px] leading-none" title={o.hidden ? 'Đang ẩn — bấm để hiện lại' : 'Đang hiện — bấm để ẩn'}>{o.hidden ? '🚫' : '👁'}</button>
                  <button onClick={(e) => { e.stopPropagation(); updateObj(o.id, { locked: !o.locked }); }} className="text-[11px] leading-none" title={o.locked ? 'Đang khoá — bấm để mở khoá' : 'Khoá lại cho khỏi kéo nhầm'}>{o.locked ? '🔒' : '🔓'}</button>
                  <button onClick={(e) => { e.stopPropagation(); setSelObj(o.id); setCtxMenu({ id: o.id, x: e.clientX, y: e.clientY }); }} className="px-1 text-[11px] font-bold leading-none text-slate-300" title="Thêm lựa chọn (nhân đôi, đưa lên trên, xoá…)">⋯</button>
                </span>
                <div className="absolute inset-y-0.5 flex items-center justify-between overflow-hidden rounded" style={{ left: `${(o.s / total) * 100}%`, width: `${((o.e - o.s) / total) * 100}%`, background: col, opacity: o.hidden ? 0.35 : 1, outline: sel ? '2px solid #fff' : 'none', cursor: 'grab', touchAction: 'none' }} onPointerDown={(e) => beginObjClipDrag(o, 'move', e)}>
                  <div className="h-full w-2 shrink-0 rounded-l" style={{ cursor: 'ew-resize', background: 'rgba(0,0,0,.25)' }} onPointerDown={(e) => { e.stopPropagation(); beginObjClipDrag(o, 'l', e); }} />
                  <span className="pointer-events-none min-w-0 flex-1 truncate px-1 text-[10px] font-bold text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,.6)' }} title={ten}>{ten}</span>
                  <div className="h-full w-2 shrink-0 rounded-r" style={{ cursor: 'ew-resize', background: 'rgba(0,0,0,.25)' }} onPointerDown={(e) => { e.stopPropagation(); beginObjClipDrag(o, 'r', e); }} />
                </div>
              </div>
            );
          })}
          <div className="pointer-events-none absolute top-0 z-20 w-[2px] bg-red-500" style={{ left: `${(playhead / Math.max(1, duration)) * 100}%`, height: '100%' }} />
        </div>
        </div>

        {/* ====== KHUNG HÌNH CAMERA (KEYFRAME) — chỉnh bằng số ngay dưới dòng thời gian ====== */}
        <div className="mt-2 rounded-lg p-2" style={{ background: '#0d2033', boxShadow: 'inset 0 0 0 1px #1b3149' }}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold" style={{ color: '#c4b5fd' }}>🎥 Khung hình camera</span>
            <span className="text-[11px] text-slate-400">{camKeys.length} khung</span>
            <button onClick={captureKeyframe} className="rounded-md px-2.5 py-1 text-[11px] font-bold text-white" style={{ background: '#7c3aed' }} title="Chỉnh bản đồ tới góc đẹp rồi bấm nút này">＋ Chốt khung tại {playhead.toFixed(1)}s</button>
            <button onClick={() => jumpKf(-1)} disabled={!camKeys.length} className="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-200 disabled:opacity-40" style={{ background: '#1b3149' }} title="Nhảy tới khung liền trước">◀ Khung trước</button>
            <button onClick={() => jumpKf(1)} disabled={!camKeys.length} className="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-200 disabled:opacity-40" style={{ background: '#1b3149' }} title="Nhảy tới khung liền sau">Khung sau ▶</button>
            {bienKhung.some((k) => k.kieu !== 'deo') && <span className="rounded-md px-2 py-1 text-[11px] font-bold" style={{ background: 'rgba(56,189,248,.16)', color: '#7dd3fc' }}>🌊 {bienKhung.filter((k) => k.kieu !== 'deo').length} khung ngắm biển</span>}
            {bienKhung.some((k) => k.kieu === 'deo') && <span className="rounded-md px-2 py-1 text-[11px] font-bold" style={{ background: 'rgba(251,191,36,.16)', color: '#fcd34d' }}>🏔️ {bienKhung.filter((k) => k.kieu === 'deo').length} khung cảnh đèo</span>}
          </div>
          {(camKeys.length === 0 && bienKhung.length === 0) ? (
            <div className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
              Chưa có khung nào — camera đang bay theo kiểu dựng sẵn.<br />
              Cách làm: kéo <b style={{ color: INK }}>vạch đỏ</b> tới giây muốn đặt → xoay/nghiêng/phóng bản đồ tới góc đẹp → bấm <b style={{ color: '#c4b5fd' }}>＋ Chốt khung</b>. Chốt ít nhất <b style={{ color: INK }}>2 khung</b> thì camera mới tự bay từ khung này sang khung kia.
            </div>
          ) : (
            <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1">
              {/* Khung ngắm biển đứng CHUNG HÀNG với khung camera — cùng một dãy thẻ, kéo ngang xem hết */}
              {bienKhung.map((k, i) => {
                  // Đổi qua lại giữa "phần trăm quãng đường" (cách máy tính bên trong) và "giây thứ mấy"
                  // (cách người dùng nhìn dòng thời gian) — để thẻ này chỉnh y hệt một khung camera.
                  const g0 = clips?.route?.[0] ?? 0.5, gDai = Math.max(1, clips?.route?.[1] ?? duration);
                  const giay = Math.round((g0 + k.t * gDai) * 10) / 10;
                  const datGiay = (v: number) => setBienKhung(bienKhung.map((x, j) => (j === i ? { ...x, t: Math.max(0, Math.min(1, (v - g0) / gDai)) } : x)));
                  return (
                    <div key={i} className="shrink-0 rounded-lg p-2" style={{ background: k.kieu === 'deo' ? '#2e2617' : '#0e2b3d', boxShadow: 'inset 0 0 0 1px ' + (Math.abs(playhead - giay) < 0.6 ? (k.kieu === 'deo' ? '#fcd34d' : '#7dd3fc') : (k.kieu === 'deo' ? '#5c4a1f' : '#24405c')), minWidth: 232 }}>
                      <div className="mb-1 flex items-center gap-1">
                        {k.kieu === 'deo'
                          ? <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: '#b45309', color: '#fef3c7' }}>🏔️ Khung đèo {bienKhung.filter((x, j) => x.kieu === 'deo' && j <= i).length}</span>
                          : <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: '#0369a1', color: '#e0f2fe' }}>🌊 Khung biển {bienKhung.filter((x, j) => x.kieu !== 'deo' && j <= i).length}</span>}
                        <button onClick={() => { setPlayhead(giay); if (k.zoom != null && mapRef.current) mapRef.current.jumpTo({ center: [k.lng!, k.lat!], zoom: k.zoom, pitch: k.pitch, bearing: k.bearing } as any); else tuaToiGiay(giay); }}
                          className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-200" style={{ background: '#1b3149' }} title="Đưa bản đồ + vạch đỏ về đúng cảnh này">Xem</button>
                        <button onClick={() => { const m = mapRef.current; if (!m) return; const c = m.getCenter();
                          setBienKhung(bienKhung.map((x, j) => (j === i ? { ...x, lng: c.lng, lat: c.lat, zoom: m.getZoom(), pitch: m.getPitch(), bearing: ((m.getBearing() % 360) + 360) % 360, huong: Math.round(((m.getBearing() % 360) + 360) % 360) } : x)));
                          toast.success('Đã chốt góc máy cho khung này'); }}
                          className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-200" style={{ background: '#1b3149' }} title="Chỉnh bản đồ tới góc ngắm biển ưng ý rồi bấm — khung này sẽ ghé đúng góc đó">Ghi đè</button>
                        <button onClick={() => setBienKhung(bienKhung.filter((_, j) => j !== i))} className="ml-auto px-1 text-[11px] font-bold text-red-400" title="Bỏ khung này">✕</button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-[54px] shrink-0 text-[10px] text-slate-400">⏱ Giây</span>
                        <input type="range" min={0} max={Math.max(1, duration)} step={0.1} value={giay}
                          onChange={(e) => datGiay(Number(e.target.value))} className="h-1 flex-1 accent-sky-400" />
                        <b className="w-[44px] shrink-0 text-right text-[10px]" style={{ color: GOLD }}>{giay.toFixed(1)}s</b>
                      </div>
                      {([
                        ['🧭 Xoay', 'huong', 0, 359, 1, (v: number) => Math.round(v) + '°'],
                        ['🔍 Phóng', 'cao', 0, 7, 0.1, (v: number) => v.toFixed(1)],
                        ['📐 Nghiêng', 'nghieng', 0, 40, 1, (v: number) => Math.round(v) + '°'],
                        ['⏳ Dài', 'dai', 4, 25, 0.5, (v: number) => v + 's'],
                      ] as const).map(([ten, khoa, min, max, buoc, hien]) => (
                        <div key={khoa as string} className="flex items-center gap-1.5">
                          <span className="w-[54px] shrink-0 text-[10px] text-slate-400">{ten}</span>
                          <input type="range" min={min} max={max} step={buoc} value={(k as any)[khoa]}
                            onChange={(e) => { const v = Number(e.target.value);
                              setBienKhung(bienKhung.map((x, j) => {
                                if (j !== i) return x;
                                const y: any = { ...x, [khoa as string]: v };
                                // Kéo mấy thanh nhanh thì góc máy của khung cũng đổi theo cho khớp.
                                if (y.zoom != null) {
                                  if (khoa === 'huong') y.bearing = v;
                                  if (khoa === 'cao') y.zoom = (x.zoom! + (x.cao - v));
                                  if (khoa === 'nghieng') y.pitch = Math.max(0, Math.min(85, x.pitch! + (v - x.nghieng)));
                                }
                                return y;
                              }));
                            }}
                            className="h-1 flex-1 accent-sky-400" />
                          <b className="w-[44px] shrink-0 text-right text-[10px]" style={{ color: GOLD }}>{hien((k as any)[khoa])}</b>
                        </div>
                      ))}
                    </div>
                  );
              })}
              {[...camKeys].sort((a, b) => a.t - b.t).map((k, i, arr) => (
                <div key={i} className="shrink-0 rounded-lg p-2" style={{ background: '#132a43', boxShadow: 'inset 0 0 0 1px ' + (Math.abs(playhead - k.t) < 0.06 ? '#c4b5fd' : '#24405c'), minWidth: 224 }}>
                  <div className="mb-1 flex items-center gap-1">
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: '#4c1d95', color: '#ddd6fe' }}>Khung {i + 1}</span>
                    <button onClick={() => gotoKeyframe(k)} className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-200" style={{ background: '#1b3149' }} title="Đưa bản đồ về đúng góc của khung này">Xem</button>
                    <button onClick={() => recaptureKf(k.t)} className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-200" style={{ background: '#1b3149' }} title="Lấy góc bản đồ đang hiện ghi đè lên khung này">Ghi đè</button>
                    <button onClick={() => setCamKeys(camKeys.filter((x) => x.t !== k.t))} className="ml-auto px-1 text-[11px] font-bold text-red-400" title="Xoá khung này">✕</button>
                  </div>
                  {/* KÉO THANH TRƯỢT — kéo tới đâu bản đồ nhảy tới đó ngay, nhìn thấy liền chứ không phải gõ số rồi đoán */}
                  <div className="space-y-1 text-[10px] text-slate-400">
                    <label className="flex items-center gap-1">
                      <span className="w-11 shrink-0 font-semibold">⏱ Giây</span>
                      <input type="range" min={i > 0 ? arr[i - 1].t + 0.1 : 0} max={i < arr.length - 1 ? arr[i + 1].t - 0.1 : Math.max(1, duration)} step={0.1} value={k.t} onChange={(e) => tweakKf(k.t, { t: Number(e.target.value) })} className="min-w-0 flex-1" style={{ accentColor: '#c4b5fd' }} title="Kéo để dời khung này sớm hơn / muộn hơn (chỉ chạy được trong khoảng giữa hai khung kế bên)" />
                      <input type="number" step={0.1} min={0} max={duration} value={k.t} onChange={(e) => tweakKf(k.t, { t: Number(e.target.value) })} className="w-12 shrink-0 rounded px-1 py-0.5 text-[11px]" style={{ background: '#0d2033', border: '1px solid #24405c', color: INK }} title="Hoặc gõ thẳng số giây" />
                    </label>
                    {([['zoom', '🔍 Phóng', 8, 20, 0.1, ''], ['pitch', '📐 Nghiêng', 0, 85, 1, '°'], ['bearing', '🧭 Xoay', -180, 180, 1, '°']] as const).map(([kk, lb, mn, mx, st, unit]) => (
                      <label key={kk} className="flex items-center gap-1">
                        <span className="w-11 shrink-0 font-semibold">{lb}</span>
                        <input type="range" min={mn} max={mx} step={st} value={(k as any)[kk]} onChange={(e) => tweakKf(k.t, { [kk]: Number(e.target.value) } as any)} className="min-w-0 flex-1" style={{ accentColor: '#c4b5fd' }} title={'Kéo để chỉnh — bản đồ đổi theo ngay'} />
                        <b className="w-10 shrink-0 text-right font-mono" style={{ color: INK }}>{st < 1 ? Number((k as any)[kk]).toFixed(1) : Math.round(Number((k as any)[kk]))}{unit}</b>
                      </label>
                    ))}
                  </div>
                  <select value={k.ease || 'smooth'} onChange={(e) => editKf(k.t, { ease: e.target.value })} className="mt-1 w-full rounded px-1 py-0.5 text-[10px]" style={{ background: '#0d2033', border: '1px solid #24405c', color: INK }} title="Cách bay từ khung này sang khung kế tiếp">
                    {EASES.map((x) => <option key={x.key} value={x.key}>{x.name} — {x.note}</option>)}
                  </select>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[10px] text-slate-400">Chỉnh riêng từng thứ</summary>
                    {([['easeZoom', 'Phóng to'], ['easePitch', 'Nghiêng'], ['easeBearing', 'Xoay']] as const).map(([kk, lb]) => (
                      <label key={kk} className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                        <span className="w-12 shrink-0">{lb}</span>
                        <select value={(k as any)[kk] || ''} onChange={(e) => editKf(k.t, { [kk]: e.target.value || undefined } as any)} className="min-w-0 flex-1 rounded px-1 py-0.5 text-[10px]" style={{ background: '#0d2033', border: '1px solid #24405c', color: INK }}>
                          <option value="">theo kiểu chung</option>
                          {EASES.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}
                        </select>
                      </label>
                    ))}
                    <div className="mt-0.5 text-[9px] leading-tight text-slate-500">Ví dụ: cho “Phóng to” chậm dần còn “Xoay” đều tay → cảnh bay mượt như phim.</div>
                  </details>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* THƯ VIỆN KHỐI DỰNG SẴN */}
      {wPicker && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(3,8,14,.75)' }} onClick={() => setWPicker(false)} />
          <div className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[min(880px,95vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl p-4 shadow-2xl" style={{ background: CARD, border: '1px solid ' + LINE }}>
            <div className="mb-1 flex items-center gap-3">
              <div className="text-base font-bold" style={{ color: INK }}>✨ Khối dựng sẵn</div>
              <span className="text-xs text-slate-400">{WIDGETS.length} mẫu · bấm để thêm vào video</span>
              <button onClick={() => setWPicker(false)} className="ml-auto rounded-lg px-2 py-1 text-lg leading-none text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="mb-3 text-[11px] text-slate-400">Mấy khối này bắt chước giao diện điện thoại nên người xem thấy quen mắt, dừng lại xem lâu hơn. Nội dung sửa được hết.</div>
            <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
              {WIDGETS.map((w) => (
                <button key={w.key} onClick={() => { if (so && so.type === 'widget') { updateObj(so.id, { wk: w.key, wd: { ...w.d } }); toast.success('Đã đổi mẫu'); } else addWidget(w.key); setWPicker(false); }}
                  className="rounded-xl p-2 text-left" style={{ background: '#0b1826', boxShadow: '0 0 0 1px ' + LINE }}>
                  <WidgetPreview kind={w.key} data={w.d} />
                  <div className="mt-1 text-xs font-bold" style={{ color: INK }}>{w.name}</div>
                  <div className="text-[10px] leading-tight text-slate-400">{w.note}</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ══ BỘ SƯU TẬP GHIM — GỘP VỀ MỘT MÀN HÌNH ══
          Bản cũ bắt đi hai tầng: bấm kiểu → xem tiện ích → muốn đổi kiểu phải bấm "quay lại", và không tìm được theo tên.
          Bản này: kiểu nằm luôn ở cột trái (điện thoại thì thành hàng chạy ngang), bấm kiểu nào lưới đổi ngay;
          gõ tên vào ô tìm là lọc cả kiểu lẫn tiện ích; thanh dưới cùng luôn cho biết sẽ cắm con ghim nào. */}
      {pinPicker && (() => {
        // 'root' = mở ra ở đúng kiểu đang dùng, khỏi bắt người ta chọn lại từ đầu
        const fam = PIN_FAMILIES.find((f) => f.key === (pinPicker === 'root' ? pinFamily : pinPicker)) || PIN_FAMILIES[0];
        // Kiểu 'auto' → màu chạy theo loại tiện ích; kiểu còn lại → theo tông màu đang chọn (chưa chọn thì tông gốc).
        const mauCua = (f: PinFamily, ic: string) => (f.color === 'auto' ? (ICON_COLOR[ic] || '#C8A14B') : (pinTone || f.color));
        // bỏ dấu để gõ "truong" cũng ra "Trường học"
        const boDau = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
        const tim = boDau(pinTim.trim());
        const dsKieu = tim ? PIN_FAMILIES.filter((f) => boDau(f.name + ' ' + f.note).includes(tim)) : PIN_FAMILIES;
        const dsIcon = tim ? PIN_ICONS.filter((i) => boDau(i.name).includes(tim)) : PIN_ICONS;
        const laRadar = fam.key === 'radar';
        const tenIcon = PIN_ICONS.find((i) => i.key === pinIcon)?.name || 'Tiện ích';
        const mauXem = laRadar ? (pinTone || fam.color) : mauCua(fam, pinIcon);
        const dongBang = () => { setPinPicker(null); setPinTim(''); };
        const xemKieu = (f: PinFamily) => { setPinPicker(f.key); setPinTone(''); };
        const camGhim = (icKey: string, ten: string) => {
          setPinFamily(fam.key); setPinShape(fam.shape); setPinIcon(icKey); setPinColor(mauCua(fam, icKey));
          setPinAnim(fam.anim); setMarkerLabel(ten); setMode('marker'); dongBang();
          toast.success('Đã chọn ghim: ' + ten + ' — bấm lên bản đồ để cắm');
        };
        const camRadar = (r: { key: string; name: string }) => {
          setPinFamily(fam.key); setPinShape('radar'); setPinColor(pinTone || fam.color); setRadarFx(r.key);
          setMode('marker'); dongBang();
          toast.success('Đã chọn: ' + r.name + ' — bấm lên bản đồ để cắm');
        };
        // MỘT DÒNG KIỂU — dùng chung cho cột trái (máy tính) và hàng chạy ngang (điện thoại)
        const dongKieu = (f: PinFamily, gon?: boolean) => {
          const dang = f.key === fam.key;
          const tn = f.tones && f.tones.length ? f.tones : [];
          const dan = f.demo[0] || 'sao';
          const mauDan = f.color === 'auto' ? (ICON_COLOR[dan] || '#3b82f6') : (tn[0] || f.color);
          return (
            <button key={f.key} onClick={() => xemKieu(f)} title={f.note}
              className={'flex shrink-0 items-center rounded-xl text-left transition ' + (gon ? 'gap-1.5 px-2 py-1.5' : 'w-full gap-2.5 p-2 hover:-translate-y-px')}
              style={{ background: dang ? 'linear-gradient(180deg, rgba(200,161,75,.18), rgba(200,161,75,.04))' : 'rgba(255,255,255,.03)', boxShadow: dang ? 'inset 0 0 0 1.5px ' + GOLD : 'inset 0 0 0 1px ' + LINE }}>
              <PinStage size={gon ? 34 : 44}>
                {f.key === 'radar' ? <RadarPreview kind="quetnan" color={tn[0] || f.color} size={gon ? 24 : 32} /> : <PinPreview shape={f.shape} color={mauDan} icon={dan} size={gon ? 22 : 30} />}
              </PinStage>
              <span className="min-w-0 flex-1">
                <span className={'block truncate font-bold leading-tight ' + (gon ? 'text-[11px]' : 'text-[12px]')} style={{ color: dang ? GOLD : INK }}>{f.name}</span>
                {!gon && <span className="mt-0.5 block truncate text-[10px] leading-tight text-slate-400">{f.note}</span>}
              </span>
            </button>
          );
        };
        return (
          <>
            <div className="cl-fade-in fixed inset-0 z-40" style={{ background: 'rgba(3,8,14,.66)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} onClick={dongBang} />
            <div className="cl-pop-in fixed bottom-0 left-1/2 z-50 flex h-[93vh] w-full max-w-[1000px] -translate-x-1/2 flex-col overflow-hidden rounded-t-2xl sm:bottom-auto sm:top-1/2 sm:h-[min(660px,90vh)] sm:w-[95vw] sm:-translate-y-1/2 sm:rounded-2xl"
              style={{ background: CARD, border: '1px solid ' + LINE, boxShadow: '0 32px 80px -24px rgba(0,0,0,.85), 0 0 0 1px rgba(255,255,255,.04)' }}>
              {/* ── ĐẦU BẢNG: tên · ô tìm · nút đóng ── */}
              <div className="flex shrink-0 items-center gap-2 px-3 py-2.5" style={{ borderBottom: '1px solid ' + LINE }}>
                <span className="hidden h-9 w-9 shrink-0 place-items-center rounded-xl text-lg sm:grid" style={{ background: 'linear-gradient(160deg, rgba(200,161,75,.28), rgba(200,161,75,.06))', boxShadow: 'inset 0 0 0 1px rgba(200,161,75,.35)' }}>📍</span>
                <div className="hidden min-w-0 shrink-0 sm:block">
                  <div className="truncate text-[14px] font-bold leading-tight" style={{ color: INK }}>Bộ sưu tập ghim</div>
                  <div className="truncate text-[10px] leading-tight text-slate-400">{PIN_FAMILIES.length} kiểu · {PIN_ICONS.length} tiện ích</div>
                </div>
                {/* GÕ TÊN LÀ RA — lọc cùng lúc cả danh sách kiểu lẫn lưới tiện ích, gõ không dấu cũng trúng */}
                <label className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl px-2.5 py-1.5" style={{ background: FIELD, boxShadow: 'inset 0 0 0 1px ' + LINE }}>
                  <span className="shrink-0 text-[13px] opacity-70">🔎</span>
                  <input value={pinTim} onChange={(e) => setPinTim(e.target.value)} placeholder="Tìm tiện ích hoặc kiểu ghim: trường, chợ, biển…"
                    className="min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none placeholder:text-slate-500" style={{ color: INK }} />
                  {!!pinTim && <button onClick={() => setPinTim('')} className="shrink-0 px-1 text-slate-400 hover:text-white" title="Xoá chữ vừa gõ">✕</button>}
                </label>
                <button onClick={dongBang} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-lg leading-none text-slate-400 transition hover:bg-white/10 hover:text-white" title="Đóng">✕</button>
              </div>

              {/* ── ĐIỆN THOẠI: kiểu ghim thành một hàng chạy ngang, khối mỏng cho đỡ chiếm chỗ ── */}
              <div className="cl-scroll-thin flex shrink-0 gap-1.5 overflow-x-auto px-3 py-2 sm:hidden" style={{ borderBottom: '1px solid ' + LINE }}>
                {dsKieu.map((f) => dongKieu(f, true))}
                {!dsKieu.length && <span className="py-2 text-[11px] text-slate-500">Không có kiểu nào tên như vậy</span>}
              </div>

              <div className="flex min-h-0 flex-1">
                {/* ── MÁY TÍNH: cột kiểu luôn nằm bên trái, bấm cái nào lưới bên phải đổi ngay ── */}
                <div className="cl-scroll-thin hidden w-[248px] shrink-0 flex-col gap-1.5 overflow-y-auto p-2.5 sm:flex" style={{ borderRight: '1px solid ' + LINE }}>
                  <div className="px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Kiểu ghim ({dsKieu.length})</div>
                  {dsKieu.map((f) => dongKieu(f))}
                  {!dsKieu.length && <div className="px-1 py-2 text-[11px] leading-snug text-slate-500">Không có kiểu nào tên như vậy. Xoá bớt chữ trong ô tìm.</div>}
                </div>

                {/* ── GIỮA: tông màu + lưới tiện ích của kiểu đang xem ── */}
                <div className="cl-scroll-thin flex min-w-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[13px] font-bold" style={{ color: GOLD }}>{fam.name}</span>
                    <span className="min-w-0 flex-1 truncate text-[10px] text-slate-400">{fam.note}</span>
                  </div>
                  {/* ══ TUỲ CHỌN RIÊNG CỦA BIỂN ══
                      Bốn cái biển trước đây (hai chân · một cột · treo xích · đỉnh vòm) thật ra chung một
                      tấm biển, chỉ khác CÁCH GẮN. Bày thành bốn mẫu thì nhìn cái nào cũng như cái nào.
                      Gộp lại: một mẫu biển, cách gắn là tuỳ chọn — ít mẫu mà dùng được nhiều hơn. */}
                  {['bienrao', 'biencot', 'bienxich', 'bienvom'].includes(fam.shape || '') && (
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Cách gắn</span>
                      {([['bienrao', 'Hai chân'], ['biencot', 'Một cột'], ['bienxich', 'Treo xích'], ['bienvom', 'Đỉnh vòm']] as [string, string][]).map(([sh, ten]) => (
                        <button key={sh} onClick={() => setPinShape(sh)}
                          className="rounded-lg px-2 py-1 text-[11px] font-bold"
                          style={pinShape === sh ? { background: GOLD, color: NAVY } : { color: '#94a3b8', boxShadow: 'inset 0 0 0 1px ' + LINE }}>{ten}</button>
                      ))}
                      <button onClick={() => setPinDaBan(!pinDaBan)} title="Gạch dải ĐÃ BÁN chéo qua biển — dùng cho lô đã chốt"
                        className="ml-1 rounded-lg px-2 py-1 text-[11px] font-bold"
                        style={pinDaBan ? { background: '#e11d48', color: '#fff' } : { color: '#94a3b8', boxShadow: 'inset 0 0 0 1px ' + LINE }}>✓ ĐÃ BÁN</button>
                    </div>
                  )}
                  {/* TÔNG MÀU bày ngay trên lưới — bấm màu nào là cả lưới đổi theo, nhìn thấy liền */}
                  {fam.color !== 'auto' && !!(fam.tones && fam.tones.length) && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Tông màu</span>
                      {fam.tones.map((c) => {
                        const dang = (pinTone || fam.color) === c;
                        return (
                          <button key={c} onClick={() => setPinTone(c)} title="Đổi màu cho cả bảng ghim"
                            className="grid h-7 w-7 shrink-0 place-items-center rounded-full transition hover:scale-110"
                            style={{ boxShadow: dang ? '0 0 0 2px ' + GOLD : '0 0 0 1px rgba(255,255,255,.18)' }}>
                            <i className="block h-[18px] w-[18px] rounded-full" style={{ background: c, boxShadow: '0 0 0 1px rgba(0,0,0,.45)' }} />
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {fam.color === 'auto' && (
                    <div className="rounded-xl px-2.5 py-1.5 text-[10px] leading-snug text-slate-400" style={{ background: 'rgba(255,255,255,.04)', boxShadow: 'inset 0 0 0 1px ' + LINE }}>
                      🎨 Kiểu này <b style={{ color: INK }}>tự đổi màu theo loại tiện ích</b> — trường xanh dương, chợ cam, biển xanh ngọc…
                    </div>
                  )}
                  {laRadar ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {RADAR_FX.map((r) => (
                        <button key={r.key} onClick={() => camRadar(r)} title={r.note}
                          className="rounded-2xl p-2 text-center transition hover:-translate-y-px"
                          style={{ background: radarFx === r.key ? 'linear-gradient(180deg, rgba(200,161,75,.16), rgba(200,161,75,.03))' : '#0b1826', boxShadow: radarFx === r.key ? '0 0 0 1.5px ' + GOLD + ', 0 10px 26px -14px rgba(200,161,75,.7)' : '0 0 0 1px ' + LINE }}>
                          <span className="mx-auto block w-fit"><PinStage size={78}><RadarPreview kind={r.key} color={pinTone || fam.color} size={60} /></PinStage></span>
                          <span className="mt-1.5 block text-[11px] font-bold" style={{ color: radarFx === r.key ? GOLD : INK }}>{r.name}</span>
                          <span className="block text-[10px] leading-tight text-slate-400">{r.note}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                      {dsIcon.map((ic) => {
                        const dang = pinFamily === fam.key && pinIcon === ic.key;
                        return (
                          <button key={ic.key} onClick={() => camGhim(ic.key, ic.name)} title={'Cắm ghim ' + ic.name}
                            className="rounded-2xl p-1.5 text-center transition hover:-translate-y-px"
                            style={{ background: dang ? 'linear-gradient(180deg, rgba(200,161,75,.16), rgba(200,161,75,.03))' : '#0b1826', boxShadow: dang ? '0 0 0 1.5px ' + GOLD + ', 0 10px 26px -14px rgba(200,161,75,.7)' : '0 0 0 1px ' + LINE }}>
                            <span className="mx-auto block w-fit"><PinStage size={72}><PinPreview shape={fam.shape} color={mauCua(fam, ic.key)} icon={ic.key} size={54} /></PinStage></span>
                            <span className="mt-1 block truncate text-[10px] font-semibold leading-tight" style={{ color: dang ? GOLD : INK }}>{ic.name}</span>
                          </button>
                        );
                      })}
                      {!dsIcon.length && <div className="col-span-full py-6 text-center text-[11px] text-slate-500">Không có tiện ích nào tên như vậy. Thử gõ ngắn hơn, ví dụ "truong".</div>}
                    </div>
                  )}
                </div>
              </div>

              {/* ── THANH DƯỚI: luôn cho biết sẽ cắm con ghim nào, bấm một phát là vào chế độ cắm ── */}
              <div className="flex shrink-0 items-center gap-2.5 px-3 py-2" style={{ borderTop: '1px solid ' + LINE, background: 'rgba(255,255,255,.03)' }}>
                <PinStage size={46}>{laRadar ? <RadarPreview kind={radarFx} color={mauXem} size={34} /> : <PinPreview shape={fam.shape} color={mauXem} icon={pinIcon} size={32} />}</PinStage>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Sẽ cắm ghim này</span>
                  <span className="block truncate text-[12px] font-bold" style={{ color: INK }}>{fam.name} · {laRadar ? (RADAR_FX.find((r) => r.key === radarFx)?.name || '') : tenIcon}</span>
                </span>
                <button onClick={() => (laRadar ? camRadar(RADAR_FX.find((r) => r.key === radarFx) || RADAR_FX[0]) : camGhim(pinIcon, tenIcon))}
                  className="shrink-0 rounded-xl px-3.5 py-2 text-[12px] font-bold transition hover:brightness-110"
                  style={{ background: GOLD, color: NAVY, boxShadow: '0 10px 26px -14px rgba(200,161,75,.9)' }}>Cắm lên bản đồ</button>
              </div>
            </div>
          </>
        );
      })()}

      {/* ══ MENU KHI BẤM CHUỘT PHẢI LÊN MỘT CON GHIM ══ */}
      {ghimMenu && (() => {
        const mk = markers.current[ghimMenu.i];
        if (!mk) { return null; }
        const dong = (bieu: string, chu: string, lam: () => void, do_ = false) => (
          <button onClick={() => { setGhimMenu(null); lam(); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-white/10" style={{ color: do_ ? '#f87171' : INK }}>
            <span className="w-4 text-center">{bieu}</span>{chu}
          </button>
        );
        return (
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setGhimMenu(null)} onContextMenu={(e) => { e.preventDefault(); setGhimMenu(null); }} />
            <div className="fixed z-[61] w-52 overflow-hidden rounded-xl py-1 shadow-2xl" style={{ left: Math.min(ghimMenu.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 220), top: Math.min(ghimMenu.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 200), background: CARD, boxShadow: '0 0 0 1px ' + LINE + ', 0 24px 60px -20px rgba(0,0,0,.9)' }}>
              <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ borderBottom: '1px solid ' + LINE }}>
                <i className="block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: mk.color || GOLD, boxShadow: '0 0 0 1px rgba(0,0,0,.45)' }} />
                <span className="truncate text-[11px] font-bold" style={{ color: GOLD }}>{mk.label || 'Ghim ' + (ghimMenu.i + 1)}</span>
              </div>
              {dong('⌖', 'Bay tới xem ghim', () => mapRef.current?.flyTo({ center: [mk.lng, mk.lat], zoom: Math.max(mapRef.current.getZoom(), 16.5), duration: 700 }))}
              {dong('🖐', 'Dời chỗ (bấm chỗ mới)', () => { setChoDoiCho(ghimMenu.i); toast.info('Bấm lên bản đồ chỗ muốn dời ghim tới — hoặc Esc để bỏ'); })}
              {dong('✏️', 'Đổi tên ghim', () => {
                const t = prompt('Tên hiện trên ghim:', mk.label || '');
                if (t !== null) { markers.current = markers.current.map((x, k) => (k === ghimMenu.i ? { ...x, label: t } : x)); drawMarkers(); bumpGeom(); }
              })}
              {dong('🎨', 'Đổi kiểu ghim này', () => { setPinPicker('root'); toast.info('Chọn kiểu xong, ghim MỚI cắm sẽ theo kiểu đó'); })}
              {dong('⧉', 'Nhân bản ghim', () => {
                const sp = 0.0009 * Math.pow(2, 15 - (mapRef.current?.getZoom() || 15));
                markers.current = [...markers.current, { ...mk, lng: mk.lng + sp, lat: mk.lat - sp }];
                drawMarkers(); bumpGeom(); toast.success('Đã nhân bản — kéo con mới tới chỗ khác');
              })}
              <div style={{ borderTop: '1px solid ' + LINE }} />
              {dong('🗑', 'Xoá ghim này', () => xoaGhim(ghimMenu.i), true)}
            </div>
          </>
        );
      })()}
      {/* Dải nhắc khi đang chờ bấm chỗ mới cho ghim */}
      {choDoiCho != null && (
        <div className="pointer-events-none fixed left-1/2 top-4 z-[62] -translate-x-1/2 rounded-full px-4 py-2 text-xs font-semibold text-white shadow-2xl" style={{ background: 'rgba(124,58,237,.95)' }}>
          🖐 Bấm lên bản đồ chỗ muốn dời ghim <b>{markers.current[choDoiCho]?.label || ''}</b> tới — bấm Esc để bỏ
        </div>
      )}
      {/* ══ MỜI ĐĂNG NHẬP / MỜI NÂNG CẤP ══ */}
      {moiNangCap && (() => {
        const chuaDN = moiNangCap === 'dang-nhap';
        const tai = moiNangCap === 'tai-video';
        const tieuDe = chuaDN ? 'Đăng nhập để dùng tiếp' : tai ? 'Nâng cấp để tải video về' : 'Hết đoạn xem thử';
        const loi = chuaDN
          ? 'Bạn hãy đăng nhập bằng tài khoản Cam Lâm Land để hệ thống ghi nhận video bạn đang dựng. Chưa có tài khoản thì đăng ký nhanh trong một phút, hoàn toàn miễn phí.'
          : tai
            ? 'Video bạn dựng đã sẵn sàng. Tài khoản của bạn chưa có gói Tạo video bản đồ nên chưa tải file MP4 về được. Nâng cấp một lần là tải thoải mái, không dấu chìm, đủ mọi khổ đăng bài.'
            : 'Bản dùng thử chỉ xem được ' + THU_GIAY + ' giây đầu. Phần hay nhất — camera bay tới lô đất, tuyến đường chạy, chữ và biểu đồ hiện lên — nằm ở đoạn sau. Nâng cấp để xem trọn và tải video về máy.';
        return (
          <>
            <div className="cl-fade-in fixed inset-0 z-[70]" style={{ background: 'rgba(3,8,14,.7)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} onClick={() => setMoiNangCap('')} />
            <div className="cl-pop-in fixed left-1/2 top-1/2 z-[71] w-[min(460px,94vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl" style={{ background: CARD, boxShadow: '0 0 0 1px ' + LINE + ', 0 32px 80px -24px rgba(0,0,0,.9)' }}>
              <div className="px-5 py-5 text-center" style={{ background: 'linear-gradient(160deg, rgba(200,161,75,.22), rgba(200,161,75,.04))' }}>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl text-2xl" style={{ background: 'rgba(200,161,75,.18)' }}>{chuaDN ? '🔑' : tai ? '⬇' : '🎬'}</div>
                <div className="mt-3 text-[17px] font-extrabold" style={{ color: INK }}>{tieuDe}</div>
              </div>
              <div className="px-5 pb-5 pt-4">
                <p className="text-[13px] leading-relaxed text-slate-300">{loi}</p>
                {!chuaDN && (
                  <ul className="mt-3 space-y-1.5 text-[12px] text-slate-400">
                    {['Xem và tải video trọn thời lượng, tối đa 120 giây', 'Không còn dấu chìm "bản dùng thử" trên hình', 'Xuất MP4 1080p · đủ khổ Facebook · TikTok · YouTube', 'Xuất cả bộ nhiều kịch bản một lần thành file ZIP'].map((t) => (
                      <li key={t} className="flex items-start gap-2"><span className="mt-[1px] shrink-0" style={{ color: GOLD }}>✓</span>{t}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex flex-col gap-2">
                  {chuaDN ? (
                    <>
                      <a href={'/login?next=' + encodeURIComponent('/tao-video-ban-do')} className="rounded-xl px-4 py-2.5 text-center text-sm font-bold" style={{ background: GOLD, color: NAVY }}>Đăng nhập tài khoản Cam Lâm Land</a>
                      <a href={'/login?next=' + encodeURIComponent('/tao-video-ban-do')} className="rounded-xl px-4 py-2 text-center text-[13px] font-semibold" style={{ background: 'rgba(255,255,255,.08)', color: INK }}>Chưa có tài khoản? Đăng ký miễn phí</a>
                    </>
                  ) : (
                    <>
                      <a href="/dichvu" className="rounded-xl px-4 py-2.5 text-center text-sm font-bold" style={{ background: GOLD, color: NAVY }}>Xem gói &amp; nâng cấp</a>
                      <a href="tel:0567442996" className="rounded-xl px-4 py-2 text-center text-[13px] font-semibold" style={{ background: 'rgba(255,255,255,.08)', color: INK }}>Gọi 0567 442 996 để được tư vấn</a>
                    </>
                  )}
                  <button onClick={() => setMoiNangCap('')} className="rounded-xl px-4 py-2 text-center text-[12px] font-semibold text-slate-400 hover:text-white">Để sau — quay lại dựng tiếp</button>
                </div>
                <div className="mt-3 text-center text-[11px] leading-tight text-slate-500">Mọi thứ bạn đã dựng vẫn được giữ nguyên trên máy, nâng cấp xong quay lại là làm tiếp.</div>
              </div>
            </div>
          </>
        );
      })()}
      {coPicker && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(3,8,14,.72)' }} onClick={() => setCoPicker(false)} />
          <div className="fixed left-1/2 top-1/2 z-50 flex max-h-[86vh] w-[min(680px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl p-4 shadow-2xl" style={{ background: CARD, border: '1px solid ' + LINE }}>
            <div className="mb-3 flex items-center gap-3">
              <div className="text-base font-bold" style={{ color: INK }}>💬 Chọn kiểu thẻ chú thích</div>
              <button onClick={() => setCoPicker(false)} className="ml-auto rounded-lg px-2 py-1 text-lg leading-none text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
              {CO_SHAPES.map((x) => (
                <button key={x.key} onClick={() => { setCalloutShape(x.key); callouts.current = callouts.current.map((c) => ({ ...c, shape: x.key })); drawCallouts(); setCalloutVer((v) => v + 1); setCoPicker(false); toast.success('Đã đổi kiểu thẻ: ' + x.name); }}
                  className="rounded-xl p-2 text-left" style={{ background: '#0b1826', boxShadow: calloutShape === x.key ? '0 0 0 2px ' + GOLD : '0 0 0 1px ' + LINE }}>
                  <CoPreview shape={x.key} col={CO_STYLES[calloutStyle]?.col || '#C8A14B'} />
                  <div className="mt-1 text-[11px] font-bold" style={{ color: calloutShape === x.key ? GOLD : INK }}>{x.name}</div>
                  <div className="text-[10px] leading-tight text-slate-400">{x.note}</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* DÁN DANH SÁCH TIỆN ÍCH TỪ EXCEL */}
      {pinPaste && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(3,8,14,.72)' }} onClick={() => setPinPaste(false)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-[min(620px,94vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-4 shadow-2xl" style={{ background: CARD, border: '1px solid ' + LINE }}>
            <div className="mb-2 flex items-center gap-3">
              <div className="text-base font-bold" style={{ color: INK }}>📋 Cắm hàng loạt ghim từ Excel</div>
              <button onClick={() => setPinPaste(false)} className="ml-auto rounded-lg px-2 py-1 text-lg leading-none text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="mb-2 text-xs leading-relaxed text-slate-400">
              Mỗi dòng một tiện ích: <b style={{ color: INK }}>Tên, vĩ độ, kinh độ</b>. Copy thẳng 3 cột từ Excel dán vào cũng được.
              Máy tự đoán biểu tượng theo tên (trường → mũ tốt nghiệp, chợ → giỏ hàng…).
            </div>
            <textarea value={pinPasteText} onChange={(e) => setPinPasteText(e.target.value)} rows={8} spellCheck={false}
              placeholder={'Trường tiểu học Cam Đức, 12.0771, 109.0917'}
              className="w-full rounded-lg px-3 py-2 font-mono text-xs" style={{ background: FIELD, border: '1px solid ' + LINE, color: INK }} />
            <div className="mt-2 flex items-center gap-2">
              <button onClick={() => { importPins(pinPasteText); setPinPaste(false); setPinPasteText(''); }} className="rounded-lg px-4 py-2 text-sm font-bold" style={{ background: GOLD, color: NAVY }}>Cắm ghim</button>
              <span className="text-[11px] text-slate-400">Dòng nào sai định dạng sẽ được bỏ qua, không làm hỏng dòng khác.</span>
            </div>
          </div>
        </>
      )}

      {/* THƯ VIỆN MẪU CHỮ — mỗi ô chạy thật, bấm là áp ngay */}
      {fxPicker && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(3,8,14,.72)' }} onClick={() => setFxPicker(false)} />
          <div className="fixed left-1/2 top-1/2 z-50 flex max-h-[86vh] w-[min(760px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl p-4 shadow-2xl" style={{ background: '#0f1e30', border: '1px solid #24405c' }}>
            <div className="mb-2 flex items-center gap-3">
              <div className="text-base font-bold text-white">✨ Chọn mẫu chữ động {fxFor && <span style={{ color: GOLD }}>— cho dòng chữ trên bản đồ</span>}</div>
              <span className="text-xs text-slate-400">{TEXTANIMS.length} mẫu · bấm để dùng ngay</span>
              <button onClick={() => { setFxPicker(false); setFxFor(null); }} className="ml-auto rounded-lg px-2 py-1 text-lg leading-none text-slate-400 hover:text-white">✕</button>
            </div>
            <input value={fxQuery} onChange={(e) => setFxQuery(e.target.value)} placeholder="Tìm mẫu… (vd: vàng, neon, lửa, khung)" className="mb-3 w-full rounded-lg border-0 px-3 py-2 text-sm" style={{ background: '#1b3149', color: '#e2e8f0' }} />
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {['Xuất hiện', 'Chữ sang', 'Có khung'].map((grp) => {
                const items = TEXTANIMS.filter((x) => x.group === grp && (!fxQuery.trim() || x.name.toLowerCase().includes(fxQuery.trim().toLowerCase())));
                if (!items.length) return null;
                return (
                  <div key={grp} className="mb-3">
                    <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">{grp}</div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {items.map((x) => (
                        <button key={x.key} onClick={() => { if (fxFor) updateObj(fxFor, { fx: x.key }); else setTextAnim(x.key); setFxPicker(false); setFxFor(null); toast.success('Đã chọn mẫu: ' + x.name); }}
                          className="overflow-hidden rounded-xl p-1 text-left transition"
                          style={{ background: '#0b1826', boxShadow: (fxFor ? (objects.find((o) => o.id === fxFor)?.fx || 'none') : textAnim) === x.key ? '0 0 0 2px ' + GOLD : '0 0 0 1px #24405c' }}>
                          <FxPreview anim={x.key} text="Tên Dự Án" />
                          <div className="px-1 py-1 text-[11px] font-semibold" style={{ color: textAnim === x.key ? GOLD : '#cbd5e1' }}>{x.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* CONTEXT MENU chuột phải cho object */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }} />
          <div className="fixed z-50 min-w-[168px] rounded-xl py-1 text-sm shadow-2xl" style={{ left: Math.min(ctxMenu.x, (typeof window !== 'undefined' ? window.innerWidth : 9999) - 170), top: ctxMenu.y, background: CARD, boxShadow: '0 10px 30px rgba(0,0,0,.5), inset 0 0 0 1px ' + LINE }}>
            {(() => { const o = objects.find((x) => x.id === ctxMenu.id); if (!o) return null; const close = () => setCtxMenu(null); const ph = Math.round(playhead * 10) / 10; const len = Math.max(0.3, o.e - o.s);
              const items: [string, () => void][] = [
                ['✂ Cắt tại vạch đứng', () => splitObj(o.id)],
                ['→ Đưa clip về vạch đứng', () => updateObj(o.id, { s: Math.min(duration - len, ph), e: Math.min(duration, ph + len) })],
                ['⊢ Bắt đầu tại vạch đứng', () => updateObj(o.id, { s: Math.min(o.e - 0.3, ph) })],
                ['⊣ Kết thúc tại vạch đứng', () => updateObj(o.id, { e: Math.max(o.s + 0.3, ph) })],
                ['📋 Sao chép', () => { objClip.current = o; toast.success('Đã sao chép — Ctrl+V để dán'); }],
                ['⧉ Nhân bản', () => duplicateObj(o.id)], ['⬆ Đưa lên trên', () => moveObjZ(o.id, 1)], ['⬇ Đưa xuống dưới', () => moveObjZ(o.id, -1)],
                [o.locked ? '🔓 Mở khoá' : '🔒 Khoá', () => updateObj(o.id, { locked: !o.locked })],
                [o.hidden ? '👁 Hiện' : '🚫 Ẩn', () => updateObj(o.id, { hidden: !o.hidden })], ['🗑 Xoá', () => deleteObj(o.id)]]; return items.map(([label, fn], i) => <button key={i} onClick={() => { fn(); close(); }} className="block w-full px-3 py-1.5 text-left hover:bg-white/5" style={{ color: label.includes('Xoá') ? '#f87171' : INK }}>{label}</button>); })()}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  QUYỀN DÙNG — kiểu "dùng thử rồi hẵng mua", KHÔNG khoá cửa ngay từ đầu nữa.
//    · Ai cũng vào dựng được: khoanh lô, vẽ tuyến, cắm ghim, chỉnh chữ… thoải mái.
//    · Chưa đăng nhập  → bấm Xem thử / Tải video thì mời đăng nhập.
//    · Đăng nhập, chưa có gói → xem được 8 GIÂY ĐẦU, khung hình phủ dấu chìm "bản dùng thử"
//      kèm số điện thoại người xem; hết 8 giây thì mời nâng cấp. Không tải file về được.
//    · Có gói (hoặc admin) → xem trọn, không dấu chìm, tải thoải mái.
//  Cho dùng thử thì khách thấy được cái hay rồi mới quyết định — bán được nhiều hơn hẳn
//  so với dựng bức tường ngay cửa như trước.
// ═══════════════════════════════════════════════════════════════════════════════

export default function MapVideoPage() {
  const { user, loading } = useAuth();
  const [conHan, setConHan] = useState<boolean | null>(null); // null = đang hỏi máy chủ

  useEffect(() => {
    if (loading) return;
    if (!user) { setConHan(false); return; }
    if (laAdmin(user)) { setConHan(true); return; }   // admin luôn dùng được
    let huy = false;
    api<{ current: { videoExpiresAt?: string | null } | null }>('/payments/my')
      .then((r) => { if (huy) return; const h = r?.current?.videoExpiresAt; setConHan(!!h && new Date(h).getTime() > Date.now()); })
      .catch(() => { if (!huy) setConHan(false); });
    return () => { huy = true; };
  }, [user, loading]);

  if (loading || conHan === null) {
    return <div className="grid min-h-[70vh] place-items-center text-sm text-slate-400">Đang kiểm tra tài khoản…</div>;
  }
  // Ai cũng vào dựng được. Chỉ hai thứ là của người có gói: XEM QUÁ 8 GIÂY và TẢI VIDEO VỀ.
  return <MapVideoTool coQuyen={!!conHan} daDangNhap={!!user} />;
}


// ── ffmpeg.wasm: đổi WebM→MP4 (+ ghép nhạc) NGAY TRONG TRÌNH DUYỆT. Nạp 1 lần, lõi single-thread (không cần cấu hình đặc biệt). ──
let _ff: any = null;
let _prog: ((p: number) => void) | null = null;
/**
 * Bộ chuyển đổi này tải từ kho trên mạng. Trước đây chỉ có MỘT địa chỉ — kho đó chậm hoặc bị chặn
 * là cả bước xuất video hỏng, mà lỗi báo ra thì khó hiểu. Nay thử LẦN LƯỢT ba kho phổ biến, kho nào
 * chạy được thì dùng kho đó; hỏng hết mới báo lỗi, và báo bằng lời dễ hiểu.
 * (Đây chỉ là đường lui: máy đời mới nén thẳng cả hình lẫn tiếng, không đụng tới bộ này.)
 */
const KHO_FF = [
  { mod: 'https://esm.sh/@ffmpeg/ffmpeg@0.12.10', util: 'https://esm.sh/@ffmpeg/util@0.12.1', core: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm' },
  { mod: 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/+esm', util: 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/+esm', core: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm' },
  { mod: 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js', util: 'https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js', core: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm' },
];
async function getFF(): Promise<any> {
  if (_ff) return _ff;
  let loiCuoi: any = null;
  for (const kho of KHO_FF) {
    try {
      const ffMod: any = await import(/* webpackIgnore: true */ /* @vite-ignore */ kho.mod);
      const util: any = await import(/* webpackIgnore: true */ /* @vite-ignore */ kho.util);
      const ff = new ffMod.FFmpeg();
      ff.on('progress', (e: any) => { if (_prog) _prog(Math.max(0, Math.min(1, e?.progress || 0))); });
      await ff.load({
        coreURL: await util.toBlobURL(`${kho.core}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await util.toBlobURL(`${kho.core}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      _ff = { ff, util }; return _ff;
    } catch (e) { loiCuoi = e; console.warn('[ffmpeg] kho này không tải được:', kho.mod, e); }
  }
  throw new Error('Không tải được bộ chuyển đổi video (thử cả 3 kho đều hỏng — nhiều khả năng do mạng). Lỗi cuối: ' + (loiCuoi?.message || loiCuoi));
}
/**
 * ══ MÁY GHI VIDEO CHUẨN XÁC (WebCodecs) — cách các phần mềm dựng phim trên web làm ══
 *
 * ⚠️ VÌ SAO PHẢI CÓ CÁI NÀY:
 * Máy ghi sẵn có của trình duyệt (MediaRecorder) ghi theo ĐỒNG HỒ THẬT. Render kỹ thì mỗi khung mất
 * cả trăm phần nghìn giây, nên video 120 giây render trong 6 phút sẽ ra file... dài 6 phút, chuyển
 * động chậm như quay chậm. Sai hoàn toàn.
 *
 * WebCodecs thì khác: mình TỰ ĐÓNG DẤU THỜI GIAN cho từng khung — khung số 30 là giây thứ 1, khung
 * số 60 là giây thứ 2 — bất kể ngoài đời mất bao lâu để vẽ. Render nhanh hay chậm không còn ảnh
 * hưởng gì tới video. Đây đúng là cách Google Earth Studio, Remotion, Figma xuất video.
 * Thêm cái lợi: mã hoá thẳng H.264 chất lượng cao, khỏi qua bước đổi định dạng.
 *
 * Trình duyệt cũ không có WebCodecs thì tự quay về cách ghi thường (bên ngoài lo).
 */
/**
 * ══ DÒ SỨC MÁY: MÁY NÀY CÓ CARD ĐỒ HOẠ THẬT KHÔNG? ══
 * Cùng một video, máy có card rời dựng nhanh gấp hàng chục lần máy vẽ bằng CPU. Không hỏi trước thì
 * máy yếu phải gánh đúng cấu hình của máy khoẻ: mỗi khung vẽ không kịp trong thời gian cho phép,
 * đành chụp hình còn dở — ra đúng cảnh "đứng hình rồi nhảy vọt".
 * Cách hỏi: xin trình duyệt cho biết TÊN bộ vẽ hình nó đang dùng. Mấy cái tên dưới đây nghĩa là
 * KHÔNG có card thật, đang vẽ bằng phần mềm.
 */
export type SucMay = { coGpu: boolean; ten: string; nhan: number; boNho: number; muc: 'manh' | 'vua' | 'yeu' };
function doSucMay(): SucMay {
  const nhan = (navigator as any)?.hardwareConcurrency || 4;
  const boNho = (navigator as any)?.deviceMemory || 4;
  let ten = '';
  try {
    const c = document.createElement('canvas');
    const gl: any = c.getContext('webgl2') || c.getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    ten = (ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl?.getParameter(gl.RENDERER) || '';
  } catch { /* ignore */ }
  const veBangPhanMem = !ten || /swiftshader|llvmpipe|software|basic render|microsoft basic|mesa offscreen/i.test(String(ten));
  const coGpu = !veBangPhanMem;
  const muc: 'manh' | 'vua' | 'yeu' = !coGpu ? 'yeu' : (nhan >= 8 && boNho >= 8) ? 'manh' : 'vua';
  return { coGpu, ten: String(ten || 'không đọc được tên'), nhan, boNho, muc };
}
function coWebCodecs(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).VideoEncoder === 'function';
}
type MayGhi = { raDia?: boolean; coTieng?: boolean; thuTruoc: (canvas: HTMLCanvasElement) => boolean; ghiKhung: (canvas: HTMLCanvasElement) => void; choTieu: () => Promise<void>; ketThuc: () => Promise<Blob>; huy: () => void };
/**
 * ══ CHỌN CÁCH NÉN MÀ MÁY NÀY THẬT SỰ LÀM ĐƯỢC ══
 * Không đoán. Hỏi thẳng trình duyệt xem nó nhận cấu hình nào, thử lần lượt từ chuẩn phổ biến nhất.
 * Hỏi trước như vậy thì tránh được cảnh render cả tiếng xong mới biết máy không nén nổi.
 */
async function chonKieuNen(W: number, H: number, fps: number, bitrate: number): Promise<any | null> {
  const ds = [
    'avc1.4D0032',   // H.264 Main 5.0 — máy nào cũng mở được, hợp 1080p
    'avc1.640032',   // H.264 High 5.0 — nén đẹp hơn nếu máy hỗ trợ
    'avc1.42E032',   // H.264 Baseline — dự phòng cuối, máy yếu vẫn chạy
  ];
  // Hỏi CARD ĐỒ HOẠ trước: nén bằng card nhanh hơn nén bằng CPU nhiều lần, mà máy lại rảnh tay vẽ
  // hình cho khung sau. Máy không có card thì tự rơi xuống cách nén bằng phần mềm.
  for (const codec of ds) {
    for (const cach of ['prefer-hardware', 'no-preference']) {
      const cfg = { codec, width: W, height: H, bitrate, framerate: fps, latencyMode: 'quality', hardwareAcceleration: cach } as any;
      try {
        const kq = await (window as any).VideoEncoder.isConfigSupported(cfg);
        if (kq?.supported) return kq.config || cfg;
      } catch { /* thử kiểu kế tiếp */ }
    }
  }
  return null;
}

/** Khung hình có "dính" ảnh từ nơi khác không cho đọc không? Dính thì KHÔNG nén được, phải biết sớm. */
function khungBiKhoa(canvas: HTMLCanvasElement): boolean {
  try { canvas.getContext('2d')?.getImageData(0, 0, 1, 1); return false; }
  catch { return true; }
}

/**
 * ══ GHI THẲNG RA Ổ ĐĨA ══
 * Mặc định cả file video nằm trong BỘ NHỚ máy tới lúc lưu. Video 2 phút nét cao là gần 300 MB —
 * cộng với ảnh bản đồ, ảnh độ cao thì trình duyệt hết chỗ, báo "Out of Memory" rồi trắng trang.
 * Cách chữa triệt để: xin người dùng chọn sẵn chỗ lưu, rồi mỗi khung nén xong là GHI LUÔN XUỐNG ĐĨA,
 * không giữ lại gì. Quay bao lâu cũng được, bộ nhớ gần như không nhúc nhích.
 * Trình duyệt cũ không cho ghi thẳng thì tự quay về cách cũ (giữ trong bộ nhớ).
 */
async function xinChoLuu(tenGoiY: string): Promise<any | null> {
  try {
    const api = (window as any).showSaveFilePicker;
    if (typeof api !== 'function') return null;
    const tay = await api({
      suggestedName: tenGoiY,
      types: [{ description: 'Video MP4', accept: { 'video/mp4': ['.mp4'] } }],
    });
    return await tay.createWritable();
  } catch { return null; }        // người dùng bấm Huỷ, hoặc trình duyệt không cho
}

/**
 * Nén sẵn cả bản tiếng rồi nhét vào cùng file với hình.
 * Đây là cách gọn nhất: hình và tiếng cùng đi vào MỘT bộ đóng gói, ra thẳng một file MP4 hoàn chỉnh —
 * không phải nén lại lần hai, không cần tới bộ chuyển đổi tải qua mạng. Máy nào thiếu bộ nén tiếng
 * thì hàm này trả false, chỗ gọi tự quay về cách ghép bằng ffmpeg.
 */
async function nenTiengVaoMuxer(muxer: any, tieng: any): Promise<boolean> {
  try {
    const AE: any = (window as any).AudioEncoder, AD: any = (window as any).AudioData;
    if (!AE || !AD || !tieng) return false;
    const SR = tieng.sampleRate, kenh = Math.min(2, tieng.numberOfChannels);
    const cau = { codec: 'mp4a.40.2', sampleRate: SR, numberOfChannels: kenh, bitrate: 192000 };
    const ho = await AE.isConfigSupported?.(cau);
    if (ho && ho.supported === false) return false;
    let loi: any = null;
    const enc = new AE({ output: (c: any, m: any) => { try { muxer.addAudioChunk(c, m); } catch (e) { loi = e; } }, error: (e: any) => { loi = e; } });
    enc.configure(cau);
    // Cắt thành từng miếng 1024 mẫu — cỡ miếng chuẩn của bộ nén tiếng AAC
    const MIENG = 1024, tong = tieng.length;
    const kd: Float32Array[] = []; for (let c = 0; c < kenh; c++) kd.push(tieng.getChannelData(c));
    for (let i = 0; i < tong; i += MIENG) {
      const n = Math.min(MIENG, tong - i);
      const gop = new Float32Array(n * kenh);
      for (let c = 0; c < kenh; c++) gop.set(kd[c].subarray(i, i + n), c * n);
      const d = new AD({ format: 'f32-planar', sampleRate: SR, numberOfFrames: n, numberOfChannels: kenh, timestamp: Math.round((i / SR) * 1e6), data: gop });
      enc.encode(d); d.close();
      if (loi) throw loi;
      if (enc.encodeQueueSize > 24) await new Promise((r) => setTimeout(r, 0));
    }
    await enc.flush(); enc.close();
    if (loi) throw loi;
    return true;
  } catch (e) { console.warn('[nén tiếng]', e); return false; }
}

async function taoMayGhiChuan(W: number, H: number, fps: number, bitrate: number, choLuu?: any, tieng?: any): Promise<MayGhi | null> {
  if (!coWebCodecs()) return null;
  if (W % 2 || H % 2) { console.warn('[ghi video] khổ video lẻ, bộ mã hoá không nhận'); return null; }
  try {
    const CAU_HINH = await chonKieuNen(W, H, fps, bitrate);
    if (!CAU_HINH) { console.warn('[ghi video] máy không nén được khổ này'); return null; }
    const mod: any = await import('mp4-muxer');
    const Muxer = mod.Muxer, ArrayBufferTarget = mod.ArrayBufferTarget;
    const FileTarget = mod.FileSystemWritableFileStreamTarget;
    // Có chỗ lưu → ghi thẳng xuống đĩa. Không có → giữ trong bộ nhớ như cũ.
    const raDia = !!(choLuu && FileTarget);
    const target = raDia ? new FileTarget(choLuu) : new ArrayBufferTarget();
    // Có bản tiếng thì khai báo sẵn một rãnh tiếng trong file — phải khai lúc tạo, sau không thêm được.
    // Ghi thẳng ra đĩa thì file phải viết một mạch từ đầu tới cuối, không quay lại chèn được —
    // mà rãnh tiếng lại nén sau cùng. Nên hai thứ này không đi chung; ở ngoài đã lo không cho
    // xin chỗ lưu khi có tiếng, đây chỉ là chốt thêm cho chắc.
    const coTieng = !!(tieng && !raDia && (window as any).AudioEncoder && (window as any).AudioData);
    const muxer = new Muxer({
      target,
      video: { codec: 'avc', width: W, height: H, frameRate: fps },
      ...(coTieng ? { audio: { codec: 'aac', numberOfChannels: Math.min(2, tieng.numberOfChannels), sampleRate: tieng.sampleRate } } : {}),
      // Ghi ra đĩa thì phải ghi tuần tự từ đầu tới cuối (không nhảy về đầu file để chèn mục lục).
      fastStart: raDia ? false : 'in-memory',
    });
    let soHong = 0, soCuu = 0, soKhung = 0;

    // ══ BỘ MÃ HOÁ TỰ PHỤC HỒI ══
    // Một khung hỏng KHÔNG được phép làm hỏng cả video. Chỉ "bỏ qua khung hỏng" thì chưa đủ: khi bộ
    // mã hoá gặp sự cố nó TỰ ĐÓNG, mọi khung sau đều trượt — đó mới là thứ làm video cụt ngang.
    // Nên: hễ thấy nó đóng thì dựng ngay bộ mới và ép khung kế tiếp làm khung mốc. Video chạy tiếp
    // bình thường, người xem không nhận ra gì.
    let enc: any = null;
    const dungBoMoi = () => {
      try { if (enc && enc.state !== 'closed') enc.close(); } catch { /* ignore */ }
      enc = new (window as any).VideoEncoder({
        output: (chunk: any, meta: any) => {
          try { muxer.addVideoChunk(chunk, meta); }
          catch (e) { soHong++; if (soHong <= 3) console.warn('[gói khung]', e); }
        },
        error: (e: any) => { console.warn('[bộ mã hoá gặp sự cố, sẽ dựng lại]', e); },
      });
      enc.configure(CAU_HINH);
    };
    dungBoMoi();
    const conSong = () => { try { return enc && enc.state === 'configured'; } catch { return false; } };

    const nen1Khung = (canvas: HTMLCanvasElement, moc: boolean, stt: number) => {
      const vf = new (window as any).VideoFrame(canvas, {
        timestamp: Math.round((stt * 1e6) / fps),          // dấu thời gian tự đặt — đây là mấu chốt
        duration: Math.round(1e6 / fps),
      });
      try { enc.encode(vf, { keyFrame: moc || stt % (fps * 2) === 0 }); }
      finally { vf.close(); }                               // LUÔN đóng, kể cả khi lỗi — không thì rò bộ nhớ
    };

    return {
      // Thử nén một khung THẬT trước khi bắt đầu. Có trục trặc gì thì biết ngay từ giây đầu, còn kịp
      // quay về cách ghi thường — chứ không phải render cả tiếng xong mới phát hiện hỏng.
      thuTruoc: (canvas: HTMLCanvasElement) => {
        if (khungBiKhoa(canvas)) { console.warn('[ghi video] khung hình dính ảnh không cho đọc'); return false; }
        if (canvas.width !== W || canvas.height !== H) return false;
        // CHỈ thử dựng khung, KHÔNG nén vào video. Trước đây tôi nén luôn khung thử — hoá ra nó thành
        // khung đầu tiên của clip, mà lúc ấy camera còn ở chỗ dò ảnh, tức 1/30 giây hình rác ngay đầu.
        // Dựng được khung là đủ biết máy làm được: mọi trục trặc hay gặp (khung dính ảnh cấm đọc,
        // khổ lệch, khổ lẻ) đều lộ ra ngay ở bước này.
        try { const vf = new (window as any).VideoFrame(canvas, { timestamp: 0, duration: 1 }); vf.close(); return true; }
        catch (e) { console.warn('[ghi video] thử khung đầu không được:', e); return false; }
      },
      ghiKhung: (canvas: HTMLCanvasElement) => {
        // Khung phải ĐÚNG khổ đã khai với bộ mã hoá — lệch một pixel là nó từ chối.
        if (!canvas || canvas.width !== W || canvas.height !== H) { soHong++; soKhung++; return; }
        let epMoc = false;
        if (!conSong()) { dungBoMoi(); soCuu++; epMoc = true; }
        try { nen1Khung(canvas, epMoc, soKhung); }
        catch (e) {
          // Cứu ngay tại chỗ: dựng bộ mã hoá mới rồi nén lại CHÍNH khung này.
          if (soHong < 3) console.warn('[ghi khung lỗi, đang cứu]', e);
          try { dungBoMoi(); soCuu++; nen1Khung(canvas, true, soKhung); }
          catch (e2) { soHong++; if (soHong <= 3) console.warn('[cứu khung không được]', e2); }
        }
        soKhung++;
      },
      // Hàng đợi dồn ứ thì phải CHỜ tiêu bớt. Không chờ thì bộ nhớ phình, bộ mã hoá nghẹt rồi tự
      // đóng — đó chính là nguồn gốc của mấy khung hỏng.
      choTieu: async () => {
        let vong = 0;
        while (conSong() && enc.encodeQueueSize > 8 && vong < 4000) { await nhip0(); vong++; }
      },
      raDia,
      coTieng,
      ketThuc: async () => {
        try { if (conSong()) await enc.flush(); } catch (e) { console.warn('[dồn nốt khung]', e); }
        // Nén phần tiếng vào cùng file, làm sau cùng cho khỏi tranh sức máy với phần hình
        if (coTieng) { const ok = await nenTiengVaoMuxer(muxer, tieng); if (!ok) console.warn('[ghi video] không nén được tiếng — sẽ ghép bằng cách khác'); }
        try { if (enc && enc.state !== 'closed') enc.close(); } catch { /* ignore */ }
        muxer.finalize();
        if (soHong || soCuu) console.warn(`[ghi video] khung hỏng: ${soHong} · số lần dựng lại bộ mã hoá: ${soCuu}`);
        if (raDia) { try { await choLuu.close(); } catch (e) { console.warn('[đóng file]', e); } return new Blob(); }
        return new Blob([(target as any).buffer], { type: 'video/mp4' });
      },
      huy: () => { try { if (enc && enc.state !== 'closed') enc.close(); } catch { /* ignore */ } },
    };
  } catch (e) {
    console.warn('[WebCodecs] không dùng được, quay về cách ghi thường:', e);
    return null;
  }
}

/**
 * ══ DỰNG TIẾNG KHÔNG CẦN NGHE ══
 * Trước đây hễ có giọng đọc hoặc tiếng động là máy phải quay theo ĐỒNG HỒ THẬT — vì hai thứ đó
 * được thu bằng cách cho loa phát rồi hứng lại. Mà quay theo đồng hồ thật thì máy yếu vẽ không kịp,
 * video ra đứng hình rồi nhảy vọt. Đúng cái bệnh chủ dự án gặp.
 *
 * Hàm này chữa tận gốc: nhạc, giọng đọc và tiếng động được TRỘN SẴN thành một file tiếng hoàn chỉnh,
 * bằng bộ trộn chạy ngầm của trình duyệt (OfflineAudioContext) — nó tính toàn bộ bản tiếng trong
 * chớp mắt, không phải phát ra loa giây nào. Hình quay riêng theo kiểu render kỹ (chậm bao lâu cũng
 * được), tiếng dựng riêng, cuối cùng ghép lại. Hình và tiếng vẫn khớp từng giây vì cả hai đều tính
 * theo cùng một mốc thời gian của video, không phụ thuộc máy nhanh hay chậm.
 *
 * Trả về dữ liệu tiếng thô. Máy không làm được (định dạng nhạc lạ, trình duyệt cũ) thì trả null —
 * lúc đó chỗ gọi tự quay về cách cũ, không ai mất gì.
 */
async function dungTiengOffline(opt: {
  nhac: File | null; giong: File | null; sfx: Sfx[]; thoiLuong: number;
  nhacTu?: number; nhacDai?: number; batNhac?: boolean;
}): Promise<any | null> {
  try {
    const OC: any = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    if (!OC) return null;
    const SR = 48000, giay = Math.max(1, opt.thoiLuong);
    const ac = new OC(2, Math.ceil(SR * giay), SR);
    const doc = async (f: File) => {
      const buf = await f.arrayBuffer();
      return await new Promise<any>((ok, hong) => { try { const r = ac.decodeAudioData(buf, ok, hong); if (r?.then) r.then(ok, hong); } catch (e) { hong(e); } });
    };
    let coGi = false;
    if (opt.nhac && (opt.batNhac ?? true)) {
      try {
        const b = await doc(opt.nhac);
        const src = ac.createBufferSource(); src.buffer = b; src.loop = true;
        const g = ac.createGain(); g.gain.value = opt.giong ? 0.32 : 0.9;   // có giọng đọc thì hạ nhạc xuống
        const tu = Math.max(0, opt.nhacTu ?? 0), dai = Math.max(0.1, Math.min(giay - tu, opt.nhacDai ?? giay));
        // Vào êm / ra êm 0,4 giây cho khỏi cụt ngang
        g.gain.setValueAtTime(0.0001, tu);
        g.gain.linearRampToValueAtTime(opt.giong ? 0.32 : 0.9, tu + 0.4);
        g.gain.setValueAtTime(opt.giong ? 0.32 : 0.9, Math.max(tu + 0.4, tu + dai - 0.4));
        g.gain.linearRampToValueAtTime(0.0001, tu + dai);
        src.connect(g); g.connect(ac.destination);
        src.start(tu); src.stop(tu + dai); coGi = true;
      } catch (e) { console.warn('[tiếng] không đọc được file nhạc:', e); }
    }
    if (opt.giong) {
      try {
        const b = await doc(opt.giong);
        const src = ac.createBufferSource(); src.buffer = b;
        const g = ac.createGain(); g.gain.value = 1;
        src.connect(g); g.connect(ac.destination); src.start(0); coGi = true;
      } catch (e) { console.warn('[tiếng] không đọc được giọng đọc:', e); }
    }
    (opt.sfx || []).forEach((x) => {
      if (x.t > giay) return;
      try { playSfx(ac, ac.destination, x.kind, Math.max(0, x.t)); coGi = true; } catch { /* bỏ qua tiếng động lỗi */ }
    });
    if (!coGi) return null;
    return await ac.startRendering();
  } catch (e) { console.warn('[tiếng offline]', e); return null; }
}

// Đóng gói dữ liệu tiếng thô thành file WAV 16 bit — ffmpeg đọc được ngay, khỏi nén thêm bước nào.
function wavTuBuffer(buf: any): Blob {
  const kenh = Math.min(2, buf.numberOfChannels), soMau = buf.length, SR = buf.sampleRate;
  const byte = soMau * kenh * 2;
  const ab = new ArrayBuffer(44 + byte), dv = new DataView(ab);
  const chu = (v: number, t: string) => { for (let i = 0; i < t.length; i++) dv.setUint8(v + i, t.charCodeAt(i)); };
  chu(0, 'RIFF'); dv.setUint32(4, 36 + byte, true); chu(8, 'WAVE');
  chu(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, kenh, true);
  dv.setUint32(24, SR, true); dv.setUint32(28, SR * kenh * 2, true); dv.setUint16(32, kenh * 2, true); dv.setUint16(34, 16, true);
  chu(36, 'data'); dv.setUint32(40, byte, true);
  const ds: Float32Array[] = []; for (let c = 0; c < kenh; c++) ds.push(buf.getChannelData(c));
  let v = 44;
  for (let i = 0; i < soMau; i++) for (let c = 0; c < kenh; c++) {
    const m = Math.max(-1, Math.min(1, ds[c][i]));
    dv.setInt16(v, m < 0 ? m * 0x8000 : m * 0x7fff, true); v += 2;
  }
  return new Blob([ab], { type: 'audio/wav' });
}

/** Ghép sẵn file tiếng vào MP4. Hình GIỮ NGUYÊN (chỉ chép lại, không nén lại) nên rất nhanh. */
async function ghepTiengVaoMp4(video: Blob, tieng: Blob, onProgress?: (p: number) => void): Promise<Blob> {
  const { ff, util } = await getFF();
  _prog = onProgress || null;
  const laMp4 = video.type.includes('mp4');
  const ten = laMp4 ? 'in.mp4' : 'in.webm';
  await ff.writeFile(ten, await util.fetchFile(video));
  await ff.writeFile('tieng.wav', await util.fetchFile(tieng));
  const args = laMp4
    ? ['-i', ten, '-i', 'tieng.wav', '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', 'out.mp4']
    : ['-i', ten, '-i', 'tieng.wav', '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', 'out.mp4'];
  await ff.exec(args);
  const data = await ff.readFile('out.mp4');
  try { await ff.deleteFile(ten); await ff.deleteFile('tieng.wav'); await ff.deleteFile('out.mp4'); } catch { /* ignore */ }
  _prog = null;
  return new Blob([(data as any).buffer ?? data], { type: 'video/mp4' });
}

async function encodeMp4Browser(webm: Blob, audio: File | null, onProgress?: (p: number) => void): Promise<Blob> {
  const { ff, util } = await getFF();
  _prog = onProgress || null;
  await ff.writeFile('in.webm', await util.fetchFile(webm));
  let args: string[];
  if (audio) {
    await ff.writeFile('aud', await util.fetchFile(audio)); // nhận cả file NHẠC hoặc VIDEO (ffmpeg tự trích luồng tiếng)
    args = ['-i', 'in.webm', '-stream_loop', '-1', '-i', 'aud', '-map', '0:v:0', '-map', '1:a:0?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', 'out.mp4'];
  } else {
    // Không đưa nhạc riêng: nếu WebM đã có tiếng (trộn lúc quay) thì tự chuyển sang AAC; không có tiếng cũng không sao.
    args = ['-i', 'in.webm', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', 'out.mp4'];
  }
  await ff.exec(args);
  const data = await ff.readFile('out.mp4');
  try { await ff.deleteFile('in.webm'); await ff.deleteFile('out.mp4'); if (audio) await ff.deleteFile('aud'); } catch { /* ignore */ }
  _prog = null;
  return new Blob([(data as any).buffer ?? data], { type: 'video/mp4' });
}

// Phân tích chuỗi "Nhãn:giá trị, ..." → mảng dữ liệu biểu đồ.
// ══════════════════ BIỂU ĐỒ ĐỘNG ══════════════════
// Cách gõ dữ liệu:  "T2:80, T3:120, T4:150"  — mỗi cặp là "Nhãn:số", cách nhau bởi dấu phẩy.
// Muốn nhiều nhóm trong một mốc (cột chồng / cột nhóm) thì viết nhiều số cách nhau dấu gạch chéo:
//   "2024:70/45, 2025:95/60"  → nhóm 1 là 70 và 95, nhóm 2 là 45 và 60.
type ChartRow = { label: string; values: number[] };
function parseChart(raw: string): ChartRow[] {
  const so = (v: string) => {
    const t = String(v).replace(/[^0-9.,-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');   // "1.200" = 1200 · "1,5" = 1.5
    return Number(t) || 0;
  };
  return (raw || '').split(',').map((chuoi) => {
    const i = chuoi.indexOf(':');
    const label = (i >= 0 ? chuoi.slice(0, i) : chuoi).trim();
    const vals = (i >= 0 ? chuoi.slice(i + 1) : '').split('/').map(so);
    return { label, values: vals.length ? vals : [0] };
  }).filter((d) => d.label);
}

// BỘ MÀU BIỂU ĐỒ — KHÔNG chọn bằng mắt mà chạy máy kiểm: mỗi màu đủ tương phản trên nền thẻ tối,
// nằm trong dải sáng hợp mắt, và hai màu đứng cạnh nhau người MÙ MÀU vẫn phân biệt được.
// Thứ tự CỐ ĐỊNH: nhóm 1 luôn màu 1, nhóm 2 luôn màu 2 — không xáo trộn, không lặp vòng.
const CHART_COLORS = ['#c98500', '#199e70', '#3987e5', '#d55181', '#9085e9', '#d95926'];
const CHART_TYPES: { key: string; name: string; note: string; nhieuNhom?: boolean }[] = [
  { key: 'bar', name: 'Cột dọc', note: 'So sánh vài mốc — ai cũng hiểu ngay' },
  { key: 'barh', name: 'Thanh ngang', note: 'Nhãn dài (tên tiện ích) đọc thoải mái' },
  { key: 'line', name: 'Đường xu hướng', note: 'Giá đất tăng theo năm / theo tháng' },
  { key: 'area', name: 'Vùng tô', note: 'Như đường nhưng đầy đặn, ăn hình' },
  { key: 'stack', name: 'Cột xếp chồng', note: 'Nhiều nhóm cộng lại trong một cột', nhieuNhom: true },
  { key: 'group', name: 'Cột nhóm', note: 'Hai ba nhóm đứng cạnh nhau để so', nhieuNhom: true },
  { key: 'pie', name: 'Hình tròn', note: 'Cơ cấu: phần nào chiếm bao nhiêu' },
  { key: 'donut', name: 'Vành khuyên', note: 'Như hình tròn, có tổng số ở giữa' },
  { key: 'radial', name: 'Vòng tiến độ', note: 'Đã bán 72% — số to nằm giữa vòng' },
  { key: 'kpi', name: 'Số nổi bật', note: '3 con số to: 5 phút ra biển · 12km sân bay…' },
];
// Dữ liệu mẫu cho ô xem trước trong bảng chọn kiểu.
function chartMauVD(type: string): ChartRow[] {
  if (type === 'radial') return [{ label: 'Đã bán', values: [72] }];
  if (type === 'kpi') return [{ label: 'phút ra biển', values: [5] }, { label: 'km tới sân bay', values: [12] }, { label: '% tăng giá/năm', values: [18] }];
  if (type === 'stack' || type === 'group') return [{ label: '2022', values: [40, 25] }, { label: '2023', values: [55, 30] }, { label: '2024', values: [70, 45] }, { label: '2025', values: [95, 60] }];
  if (type === 'pie' || type === 'donut') return [{ label: 'Đất nền', values: [45] }, { label: 'Nhà phố', values: [30] }, { label: 'Biệt thự', values: [25] }];
  if (type === 'barh') return [{ label: 'Biển Bãi Dài', values: [3] }, { label: 'Sân bay', values: [12] }, { label: 'Chợ Cam Đức', values: [2] }, { label: 'Cao tốc', values: [6] }];
  return [{ label: 'T2', values: [80] }, { label: 'T3', values: [120] }, { label: 'T4', values: [150] }, { label: 'T5', values: [190] }, { label: 'T6', values: [250] }, { label: 'T7', values: [300] }];
}
// Số kiểu Việt Nam: 1.234 · 12,5
function fmtSo(n: number): string {
  const r = Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10;
  const [a, b] = String(r).split('.');
  return a.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (b ? ',' + b : '');
}
// Chữ dài quá thì cắt bớt, thêm dấu …
function cheChu(ctx: CanvasRenderingContext2D, t: string, rong: number): string {
  if (ctx.measureText(t).width <= rong) return t;
  let s = t;
  while (s.length > 1 && ctx.measureText(s + '…').width > rong) s = s.slice(0, -1);
  return s + '…';
}

// VẼ BIỂU ĐỒ lên canvas, chạy dần theo progress (0 → 1). Dùng chung cho ô xem trước lẫn video xuất ra.
// Nguyên tắc bám theo chuẩn làm biểu đồ: nét mảnh, lưới mờ, số ghi thẳng lên hình (khỏi phải dò trục),
// các mảng màu luôn chừa khe hở, và không bao giờ dùng hai trục số khác nhau trên cùng một hình.
function drawChart(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, data: ChartRow[], progress: number, title: string, type: string, tenNhom?: string[]) {
  if (!data.length) return;
  const s = h / 300, f = (n: number) => n * s;
  const P = Math.max(0, Math.min(1, progress));
  const eo = (p: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, p)), 3);   // chạy nhanh lúc đầu, êm lúc cuối
  const E = eo(P);
  const MUC = 'rgba(255,255,255,.72)';                                          // chữ phụ
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  // ── Thẻ nền: chuyển sắc rất nhẹ + viền tóc, bo góc lớn cho hiện đại ──
  const bg = ctx.createLinearGradient(0, y, 0, y + h);
  bg.addColorStop(0, 'rgba(13,31,52,.93)'); bg.addColorStop(1, 'rgba(7,18,33,.93)');
  ctx.fillStyle = bg; roundRect(ctx, x, y, w, h, f(18)); ctx.fill();
  ctx.lineWidth = Math.max(1, f(1.4)); ctx.strokeStyle = 'rgba(255,255,255,.10)';
  roundRect(ctx, x + f(0.7), y + f(0.7), w - f(1.4), h - f(1.4), f(17.4)); ctx.stroke();
  const coTieu = !!(title || '').trim();
  if (coTieu) {
    ctx.fillStyle = CHART_COLORS[0]; roundRect(ctx, x + f(20), y + f(21), f(5), f(21), f(2.5)); ctx.fill();
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = `700 ${f(24)}px Arial, sans-serif`;
    ctx.fillText(cheChu(ctx, title, w - f(60)), x + f(34), y + f(39));
  }
  const soNhom = Math.max(1, ...data.map((d) => d.values.length));
  const ten = (k: number) => (tenNhom && tenNhom[k] ? tenNhom[k] : 'Nhóm ' + (k + 1));
  const mau = (k: number) => CHART_COLORS[k % CHART_COLORS.length];
  let T = y + (coTieu ? f(62) : f(24));
  const L = x + f(26), R = x + w - f(24), B = y + h - f(34);

  // ── Chú thích màu (chỉ khi có từ 2 nhóm trở lên — một nhóm thì tiêu đề đã nói rồi) ──
  if (soNhom > 1 && type !== 'pie' && type !== 'donut') {
    ctx.font = `600 ${f(14)}px Arial, sans-serif`; ctx.textAlign = 'left';
    let cx2 = L;
    for (let k = 0; k < soNhom; k++) {
      ctx.fillStyle = mau(k); ctx.beginPath(); ctx.arc(cx2 + f(5), T + f(4), f(5), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = MUC; ctx.fillText(ten(k), cx2 + f(15), T + f(9));
      cx2 += f(15) + ctx.measureText(ten(k)).width + f(18);
    }
    T += f(24);
  }

  const nhipCot = (i: number, n: number) => eo(P * (1 + n * 0.05) - i * 0.05);   // cột mọc so le cho sinh động
  // Số chạy dần từ 0 lên: số cuối tròn thì lúc chạy cũng để tròn, không hiện "83,4" rồi mới ra "100".
  const demSo = (v: number, p: number) => (Number.isInteger(v) ? Math.round(v * p) : v * p);
  const luoi = () => {
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = Math.max(1, f(1));
    for (let k = 0; k <= 3; k++) { const gy = T + (B - T) * (k / 3); ctx.beginPath(); ctx.moveTo(L, gy); ctx.lineTo(R, gy); ctx.stroke(); }
  };
  const nhanX = (t: string, cx: number, rong: number) => { ctx.fillStyle = MUC; ctx.font = `${f(15)}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(cheChu(ctx, t, rong), cx, B + f(21)); };
  // Cột bo tròn ở ĐẦU MÚT (phía trên), chân vẫn phẳng đứng trên vạch đáy — đúng kiểu biểu đồ hiện đại.
  const cotBo = (bx: number, by: number, bw: number, bh: number, r0: number) => {
    const r = Math.max(0, Math.min(r0, bw / 2, bh));
    ctx.beginPath(); ctx.moveTo(bx, by + bh); ctx.lineTo(bx, by + r);
    ctx.quadraticCurveTo(bx, by, bx + r, by); ctx.lineTo(bx + bw - r, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r); ctx.lineTo(bx + bw, by + bh); ctx.closePath();
  };

  // ══ CỘT DỌC · CỘT NHÓM · CỘT XẾP CHỒNG ══
  if (type === 'bar' || type === 'group' || type === 'stack') {
    const n = data.length, o = (R - L) / n;
    const maxV = type === 'stack'
      ? Math.max(...data.map((d) => d.values.reduce((a, b) => a + b, 0)), 1)
      : Math.max(...data.map((d) => Math.max(...d.values)), 1);
    luoi();
    data.forEach((d, i) => {
      const p = nhipCot(i, n), cx = L + o * i + o / 2;
      if (type === 'stack') {
        let duoi = 0;
        d.values.forEach((v, k) => {
          const bw = Math.min(f(54), o * 0.56);
          const bh = (B - T) * (v / maxV) * p, by = B - (B - T) * (duoi / maxV) * p - bh;
          ctx.fillStyle = mau(k); cotBo(cx - bw / 2, by, bw, Math.max(0, bh - f(2)), f(6)); ctx.fill();   // chừa khe 2px giữa các mảng
          duoi += v;
        });
        const tong = d.values.reduce((a, b) => a + b, 0);
        if (p > 0.6) { ctx.fillStyle = '#fff'; ctx.font = `700 ${f(15)}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(fmtSo(tong), cx, B - (B - T) * (tong / maxV) * p - f(8)); }
      } else {
        const m = type === 'group' ? d.values.length : 1;
        const rong = Math.min(f(54), (o * 0.62) / m), khe = f(3);
        const tong = rong * m + khe * (m - 1);
        for (let k = 0; k < m; k++) {
          const v = d.values[k] || 0, bh = (B - T) * (v / maxV) * p;
          const bx = cx - tong / 2 + k * (rong + khe);
          const g = ctx.createLinearGradient(0, B - bh, 0, B);
          g.addColorStop(0, mau(type === 'group' ? k : 0)); g.addColorStop(1, hexA(mau(type === 'group' ? k : 0), 0.55));
          ctx.fillStyle = g; cotBo(bx, B - bh, rong, bh, f(6)); ctx.fill();
          if (p > 0.55 && rong > f(24)) { ctx.fillStyle = '#fff'; ctx.font = `700 ${f(15)}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(fmtSo(v), bx + rong / 2, B - bh - f(8)); }
        }
      }
      nhanX(d.label, cx, o * 0.95);
    });
  }

  // ══ THANH NGANG ══
  else if (type === 'barh') {
    const n = data.length, maxV = Math.max(...data.map((d) => Math.max(...d.values)), 1);
    ctx.font = `${f(15)}px Arial, sans-serif`;
    const cotNhan = Math.min((R - L) * 0.34, Math.max(...data.map((d) => ctx.measureText(d.label).width)) + f(10));
    const x0 = L + cotNhan, cao = (B - T) / n, day = Math.min(f(26), cao * 0.56);
    data.forEach((d, i) => {
      const p = nhipCot(i, n), cy = T + cao * i + cao / 2;
      ctx.fillStyle = 'rgba(255,255,255,.07)'; roundRect(ctx, x0, cy - day / 2, R - x0 - f(46), day, day / 2); ctx.fill();   // rãnh nền cho thấy độ dài tối đa
      const bw = (R - x0 - f(46)) * (d.values[0] / maxV) * p;
      const g = ctx.createLinearGradient(x0, 0, x0 + Math.max(1, bw), 0);
      g.addColorStop(0, hexA(mau(0), 0.65)); g.addColorStop(1, mau(0));
      ctx.fillStyle = g; roundRect(ctx, x0, cy - day / 2, Math.max(day / 2, bw), day, day / 2); ctx.fill();
      ctx.fillStyle = MUC; ctx.textAlign = 'right'; ctx.font = `${f(15)}px Arial, sans-serif`; ctx.fillText(cheChu(ctx, d.label, cotNhan - f(10)), x0 - f(10), cy + f(5));
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = `700 ${f(16)}px Arial, sans-serif`; ctx.fillText(fmtSo(demSo(d.values[0], p)), x0 + Math.max(day / 2, bw) + f(9), cy + f(6));
    });
  }

  // ══ ĐƯỜNG · VÙNG TÔ ══
  else if (type === 'line' || type === 'area') {
    const n = data.length, maxV = Math.max(...data.map((d) => Math.max(...d.values)), 1);
    luoi();
    for (let k = 0; k < soNhom; k++) {
      const pts = data.map((d, i) => [L + (R - L) * (i / (n - 1 || 1)), B - (B - T) * ((d.values[k] || 0) / maxV)] as [number, number]);
      const het = (pts.length - 1) * E, dut = Math.floor(het), le = het - dut;
      const duong: [number, number][] = pts.slice(0, dut + 1);
      if (dut < pts.length - 1) duong.push([pts[dut][0] + (pts[dut + 1][0] - pts[dut][0]) * le, pts[dut][1] + (pts[dut + 1][1] - pts[dut][1]) * le]);
      if (duong.length < 2) continue;
      if (type === 'area' && k === 0) {
        const g = ctx.createLinearGradient(0, T, 0, B);
        g.addColorStop(0, hexA(mau(k), 0.42)); g.addColorStop(1, hexA(mau(k), 0.02));
        ctx.beginPath(); duong.forEach((p2, i) => (i ? ctx.lineTo(p2[0], p2[1]) : ctx.moveTo(p2[0], p2[1])));
        ctx.lineTo(duong[duong.length - 1][0], B); ctx.lineTo(duong[0][0], B); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
      }
      ctx.strokeStyle = mau(k); ctx.lineWidth = f(3); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); duong.forEach((p2, i) => (i ? ctx.lineTo(p2[0], p2[1]) : ctx.moveTo(p2[0], p2[1]))); ctx.stroke();
      if (n <= 9) duong.slice(0, dut + 1).forEach((p2) => { ctx.fillStyle = '#0d1f34'; ctx.beginPath(); ctx.arc(p2[0], p2[1], f(5.5), 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = mau(k); ctx.lineWidth = f(2.5); ctx.stroke(); });
      // Chỉ ghi số ở ĐIỂM CUỐI đang chạy tới — ghi hết mọi điểm là rối mắt
      const cuoi = duong[duong.length - 1], vCuoi = data[Math.min(dut + (le > 0.5 ? 1 : 0), n - 1)].values[k] || 0;
      ctx.fillStyle = mau(k); ctx.beginPath(); ctx.arc(cuoi[0], cuoi[1], f(6.5), 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = f(2); ctx.stroke();
      if (k === 0) {
        ctx.font = `700 ${f(16)}px Arial, sans-serif`; const t = fmtSo(vCuoi), tw = ctx.measureText(t).width;
        const px = Math.max(L, Math.min(cuoi[0] - tw / 2, R - tw - f(8))), py = Math.max(T + f(16), cuoi[1] - f(22));
        ctx.fillStyle = 'rgba(255,255,255,.14)'; roundRect(ctx, px - f(6), py - f(13), tw + f(12), f(20), f(6)); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(t, px, py + f(2));
      }
    }
    data.forEach((d, i) => nhanX(d.label, L + (R - L) * (i / (n - 1 || 1)), (R - L) / n));
  }

  // ══ TRÒN · VÀNH KHUYÊN ══
  else if (type === 'pie' || type === 'donut') {
    const gt = data.map((d) => Math.max(0, d.values[0] || 0)), tong = gt.reduce((a, b) => a + b, 0) || 1;
    const bk = Math.min((B - T) / 2, (R - L) * 0.27), cx = L + bk + f(6), cy = (T + B) / 2;
    let goc = -Math.PI / 2;
    gt.forEach((v, i) => {
      const quet = (v / tong) * Math.PI * 2 * E;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, bk, goc, goc + quet); ctx.closePath();
      ctx.fillStyle = mau(i); ctx.fill();
      ctx.strokeStyle = '#0b1c31'; ctx.lineWidth = f(3); ctx.stroke();                 // khe hở giữa các miếng
      goc += quet;
    });
    if (type === 'donut') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(cx, cy, bk * 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = `800 ${f(30)}px Arial, sans-serif`; ctx.fillText(fmtSo(demSo(tong, E)), cx, cy + f(4));
      ctx.fillStyle = MUC; ctx.font = `${f(13)}px Arial, sans-serif`; ctx.fillText('TỔNG', cx, cy + f(22));
    }
    // Chú thích bên phải: tên · số · phần trăm (đọc bằng chữ, không phải dò màu)
    const lx = cx + bk + f(22), dong = Math.min(f(30), (B - T) / data.length);
    const ty = (T + B) / 2 - (data.length * dong) / 2 + dong / 2;
    data.forEach((d, i) => {
      const cy2 = ty + dong * i;
      ctx.fillStyle = mau(i); roundRect(ctx, lx, cy2 - f(6), f(12), f(12), f(3)); ctx.fill();
      ctx.textAlign = 'left'; ctx.font = `600 ${f(15)}px Arial, sans-serif`; ctx.fillStyle = '#fff';
      ctx.fillText(cheChu(ctx, d.label, R - lx - f(90)), lx + f(19), cy2 + f(5));
      ctx.textAlign = 'right'; ctx.fillStyle = MUC; ctx.font = `${f(14)}px Arial, sans-serif`;
      ctx.fillText(Math.round((gt[i] / tong) * 100 * E) + '%', R - f(4), cy2 + f(5));
    });
  }

  // ══ VÒNG TIẾN ĐỘ ══
  else if (type === 'radial') {
    const pct = Math.max(0, Math.min(100, data[0].values[0] || 0));
    const bk = Math.min((B - T) / 2 - f(4), (R - L) / 2 - f(4)), cx = (L + R) / 2, cy = (T + B) / 2;
    const day = Math.max(f(14), bk * 0.22);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = day;
    ctx.beginPath(); ctx.arc(cx, cy, bk - day / 2, 0, Math.PI * 2); ctx.stroke();
    const g = ctx.createLinearGradient(cx - bk, cy - bk, cx + bk, cy + bk);
    g.addColorStop(0, CHART_COLORS[0]); g.addColorStop(1, hexA(CHART_COLORS[0], 0.75));
    ctx.strokeStyle = g; ctx.beginPath(); ctx.arc(cx, cy, bk - day / 2, -Math.PI / 2, -Math.PI / 2 + (pct / 100) * Math.PI * 2 * E); ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = `800 ${f(52)}px Arial, sans-serif`;
    ctx.fillText(Math.round(pct * E) + '%', cx, cy + f(12));
    ctx.fillStyle = MUC; ctx.font = `600 ${f(16)}px Arial, sans-serif`; ctx.fillText(cheChu(ctx, data[0].label, bk * 1.7), cx, cy + f(38));
  }

  // ══ SỐ NỔI BẬT (tối đa 4 ô) ══
  else if (type === 'kpi') {
    const ds = data.slice(0, 4), n = ds.length, o = (R - L) / n;
    ds.forEach((d, i) => {
      const cx = L + o * i + o / 2, p = eo(P * 1.2 - i * 0.12);
      if (i) { ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = Math.max(1, f(1)); ctx.beginPath(); ctx.moveTo(L + o * i, T + f(10)); ctx.lineTo(L + o * i, B - f(4)); ctx.stroke(); }
      ctx.textAlign = 'center'; ctx.fillStyle = CHART_COLORS[0]; ctx.font = `800 ${f(Math.min(58, 150 / Math.max(1, n)))}px Arial, sans-serif`;
      ctx.fillText(fmtSo(demSo(d.values[0] || 0, p)), cx, (T + B) / 2 + f(8));
      ctx.fillStyle = MUC; ctx.font = `600 ${f(15)}px Arial, sans-serif`;
      ctx.fillText(cheChu(ctx, d.label, o - f(12)), cx, (T + B) / 2 + f(34));
    });
  }
  ctx.restore();
}

// Ô XEM TRƯỚC một phương tiện — vẽ bằng ĐÚNG hàm dùng cho video (kể cả cánh quạt đang quay).
function XeLive({ kind, mau, co = 1, el = 0, khung = 0 }: { kind: string; mau?: string; co?: number; el?: number; khung?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [anhVe, setAnhVe] = useState(0);            // đổi số này là vẽ lại — dùng khi ảnh xe 3D vừa tải xong
  useEffect(() => {
    napTruocAnhXe();
    const khiXong = () => setAnhVe((n) => n + 1);
    window.addEventListener('cl-xe3d-xong', khiXong);
    return () => window.removeEventListener('cl-xe3d-xong', khiXong);
  }, []);
  const xe = XE_LIST.find((v) => v.key === kind) || XE_LIST[0];
  const L = Math.max(18, 96 * co * xe.co);
  const S = Math.ceil(L * 1.5) + 8;
  useEffect(() => {
    const c = ref.current; if (!c) return; const g = c.getContext('2d'); if (!g) return;
    let raf = 0; const t0 = gioHieuUng();
    const ve = () => {
      const t = el >= 0 ? el : 0, tq = kind === 'tructhang' ? (gioHieuUng() - t0) / 1000 : t;
      g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, S, S);
      g.save(); g.translate(S / 2, S / 2); drawXe(g, xe.key, L, mau || xe.mau, tq); g.restore();
      if (kind === 'tructhang') raf = requestAnimationFrame(ve);       // chỉ trực thăng mới cần vẽ lại liên tục
    };
    ve();
    return () => cancelAnimationFrame(raf);
  }, [kind, mau, L, S, el, xe, anhVe]);   // anhVe: ảnh xe 3D vừa tải xong thì vẽ lại
  return <canvas ref={ref} width={S * 2} height={S * 2} style={{ width: S, height: S, display: 'block' }} />;
}
// Ô XEM TRƯỚC một kiểu biểu đồ (dùng trong bảng chọn kiểu) — vẽ bằng đúng hàm dùng cho video.
function ChartPreview({ type, w = 104, h = 62 }: { type: string; w?: number; h?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return; const g = c.getContext('2d'); if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); g.scale(2, 2);
    drawChart(g, 0, 0, w, h, chartMauVD(type), 1, '', type, ['Nhóm 1', 'Nhóm 2']);
  }, [type, w, h]);
  return <canvas ref={ref} width={w * 2} height={h * 2} style={{ width: w, height: h, display: 'block', borderRadius: 10 }} />;
}

// ── THƯ VIỆN TIẾNG ĐỘNG ──
// Tiếng được TẠO RA bằng bộ tổng hợp âm thanh của trình duyệt (không tải file, không vướng bản quyền).
type Sfx = { id: string; t: number; kind: string };
const SFX_LIST: { key: string; name: string }[] = [
  { key: 'whoosh', name: '💨 Vút (chuyển cảnh)' }, { key: 'pop', name: '🫧 Bụp (hiện chữ)' }, { key: 'click', name: '🔘 Tách (bấm)' },
  { key: 'ding', name: '🔔 Leng keng (nhấn mạnh)' }, { key: 'riser', name: '📈 Dâng lên (trước cao trào)' }, { key: 'boom', name: '💥 Uỵch (chốt cảnh)' },
  { key: 'sparkle', name: '✨ Lấp lánh (khoe tiện ích)' },
];
function noiseBuffer(actx: any, sec = 1) {
  const n = Math.floor(actx.sampleRate * sec), b = actx.createBuffer(1, n, actx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
// Phát 1 tiếng động vào đích 'dest' tại thời điểm 'when' (giây theo đồng hồ của AudioContext).
function playSfx(actx: any, dest: any, kind: string, when: number, vol = 0.9) {
  const g = actx.createGain(); g.connect(dest); g.gain.setValueAtTime(0.0001, when);
  const env = (peak: number, atk: number, dec: number) => { g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak * vol), when + atk); g.gain.exponentialRampToValueAtTime(0.0001, when + atk + dec); };
  if (kind === 'whoosh' || kind === 'click') {
    const src = actx.createBufferSource(); src.buffer = noiseBuffer(actx, 1.2);
    const f = actx.createBiquadFilter(); f.type = kind === 'click' ? 'highpass' : 'bandpass'; f.Q.value = kind === 'click' ? 1 : 1.6;
    if (kind === 'whoosh') { f.frequency.setValueAtTime(320, when); f.frequency.exponentialRampToValueAtTime(2600, when + 0.35); f.frequency.exponentialRampToValueAtTime(420, when + 0.75); env(0.45, 0.12, 0.6); }
    else { f.frequency.setValueAtTime(2400, when); env(0.5, 0.004, 0.05); }
    src.connect(f); f.connect(g); src.start(when); src.stop(when + (kind === 'click' ? 0.1 : 0.9));
    return;
  }
  if (kind === 'sparkle') {
    [1400, 2100, 2800].forEach((f0, i) => { const o = actx.createOscillator(); const gg = actx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f0, when + i * 0.07); gg.gain.setValueAtTime(0.0001, when + i * 0.07); gg.gain.exponentialRampToValueAtTime(0.22 * vol, when + i * 0.07 + 0.01); gg.gain.exponentialRampToValueAtTime(0.0001, when + i * 0.07 + 0.35); o.connect(gg); gg.connect(dest); o.start(when + i * 0.07); o.stop(when + i * 0.07 + 0.4); });
    return;
  }
  const o = actx.createOscillator(); o.connect(g);
  if (kind === 'pop') { o.type = 'sine'; o.frequency.setValueAtTime(520, when); o.frequency.exponentialRampToValueAtTime(150, when + 0.14); env(0.55, 0.008, 0.16); o.start(when); o.stop(when + 0.25); }
  else if (kind === 'ding') { o.type = 'sine'; o.frequency.setValueAtTime(1180, when); env(0.4, 0.006, 0.9); o.start(when); o.stop(when + 1.0); }
  else if (kind === 'riser') { o.type = 'sawtooth'; o.frequency.setValueAtTime(180, when); o.frequency.exponentialRampToValueAtTime(1500, when + 1.2); g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(0.35 * vol, when + 1.1); g.gain.exponentialRampToValueAtTime(0.0001, when + 1.35); o.start(when); o.stop(when + 1.4); }
  else { o.type = 'sine'; o.frequency.setValueAtTime(150, when); o.frequency.exponentialRampToValueAtTime(38, when + 0.5); env(0.75, 0.01, 0.7); o.start(when); o.stop(when + 0.9); } // boom
}

// Vẽ NỀN ĐỘNG cho màn mở đầu/kết thúc (không có bản đồ). t = giây đã trôi → nền chuyển động.
function drawBG(ctx: CanvasRenderingContext2D, W: number, H: number, kind: string, t: number) {
  const k = Math.min(W, H) / 1080;
  if (kind === 'paper') {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f3ead6'); g.addColorStop(1, '#ded2b8'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.06; ctx.fillStyle = '#4a3a1a';
    for (let i = 0; i < 90; i++) { const x = ((i * 977) % W), y = ((i * 613 + Math.floor(t * 12)) % H); ctx.fillRect(x, y, 2 * k, 2 * k); }
    ctx.globalAlpha = 1; return;
  }
  if (kind === 'black') { ctx.fillStyle = '#05080c'; ctx.fillRect(0, 0, W, H); return; }
  if (kind === 'gold') {
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1b1405'); g.addColorStop(0.5, '#3d2d0a'); g.addColorStop(1, '#120d03'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 5; i++) { // tia sáng chéo chạy ngang
      const x = ((t * 90 + i * W / 5) % (W * 1.6)) - W * 0.3;
      const gg = ctx.createLinearGradient(x, 0, x + 160 * k, H); gg.addColorStop(0, 'rgba(200,161,75,0)'); gg.addColorStop(0.5, 'rgba(240,210,130,0.16)'); gg.addColorStop(1, 'rgba(200,161,75,0)');
      ctx.fillStyle = gg; ctx.fillRect(x, 0, 160 * k, H);
    }
    return;
  }
  if (kind === 'grid') {
    ctx.fillStyle = '#04101c'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(56,189,248,0.35)'; ctx.lineWidth = Math.max(1, 2 * k);
    const step = 90 * k, off = (t * 26) % step;
    for (let x = -step + off; x < W + step; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 60 * k, H); ctx.stroke(); }
    for (let y = -step + off; y < H + step; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + 30 * k); ctx.stroke(); }
    return;
  }
  if (kind === 'contour') { // đường bình độ lượn sóng — hợp chủ đề bản đồ
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#07182a'); g.addColorStop(1, '#0d2b45'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = Math.max(1, 2.2 * k);
    for (let i = 0; i < 16; i++) {
      ctx.strokeStyle = `rgba(200,161,75,${0.10 + (i % 4) * 0.05})`;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 12 * k) {
        const y = H * (i / 16) + Math.sin((x / (W || 1)) * 6.5 + t * 0.6 + i * 0.6) * 34 * k + Math.sin(x / (140 * k) + i) * 10 * k;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    return;
  }
  const g = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, Math.max(W, H) * 0.75); // 'navy' mặc định
  g.addColorStop(0, '#12395e'); g.addColorStop(1, '#050f1b'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
// Vẽ trọn màn mở đầu/kết thúc: nền động + ảnh (nếu có) + chữ hiện dần.
function drawScreen(ctx: CanvasRenderingContext2D, W: number, H: number, c: ScreenCard, p: number, t: number, img: HTMLImageElement | null) {
  const k = Math.min(W, H) / 1080, px = (n: number) => Math.round(n * k);
  drawBG(ctx, W, H, c.bg || 'navy', t);
  if (img) { // ảnh phủ kín khung (cắt vừa), làm mờ để chữ nổi lên
    const r = Math.max(W / img.width, H / img.height), iw = img.width * r, ih = img.height * r;
    ctx.save(); ctx.globalAlpha = 0.55; ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih); ctx.restore();
    ctx.fillStyle = 'rgba(5,15,27,0.45)'; ctx.fillRect(0, 0, W, H);
  }
  const ap = Math.max(0, Math.min(1, p * 3.2)); // chữ hiện nhanh trong 1/3 đầu đoạn
  const out = Math.max(0, Math.min(1, (1 - p) * 4)); // mờ đi ở cuối đoạn
  const light = (c.bg === 'paper'); // nền sáng → chữ tối
  ctx.save(); ctx.globalAlpha = Math.min(ap, out);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.translate(0, (1 - ap) * px(30));
  if (c.title) { ctx.font = `800 ${px(92)}px Arial, sans-serif`; ctx.fillStyle = light ? '#20304a' : '#ffffff'; ctx.fillText(c.title, W / 2, H / 2); }
  if (c.sub) { ctx.font = `600 ${px(46)}px Arial, sans-serif`; ctx.fillStyle = '#C8A14B'; ctx.fillText(c.sub, W / 2, H / 2 + px(84)); }
  ctx.fillStyle = '#C8A14B'; ctx.fillRect(W / 2 - px(70), H / 2 - px(150), px(140), px(7)); // gạch trang trí
  ctx.restore(); ctx.textAlign = 'left';
}

// Vẽ phụ đề (caption) giữa-dưới, có nền mờ để dễ đọc trên mọi nền.
// ══════ NHÌN ĐIỆN ẢNH ══════
// Ảnh vệ tinh thô nhìn bẹt và hơi xám. Hai thứ làm nó "có nghề" ngay mà không đụng gì tới bản đồ:
//   1) phủ một lớp màu RẤT MỎNG (bóng ngả lạnh, vùng sáng ngả ấm) — đúng cách người ta chỉnh màu phim;
//   2) làm TỐI 4 GÓC (vignette) để mắt người xem tự dồn vào giữa khung, chỗ có lô đất.
const GRADES: { key: string; name: string; note: string; tren: string; duoi: string; tron: string; dam: number }[] = [
  { key: 'none', name: 'Nguyên bản', note: 'Giữ đúng màu ảnh vệ tinh gốc', tren: '', duoi: '', tron: '', dam: 0 },
  { key: 'dienanh', name: 'Điện ảnh', note: 'Bóng ngả lam, nắng ngả vàng — kiểu phim', tren: '#ffd9a0', duoi: '#0b2a4a', tron: 'soft-light', dam: 0.55 },
  { key: 'hoanghon', name: 'Hoàng hôn', note: 'Ấm vàng cam, hợp cảnh biển buổi chiều', tren: '#ffb066', duoi: '#7a3b1f', tron: 'soft-light', dam: 0.5 },
  { key: 'xanhbien', name: 'Xanh biển', note: 'Mát và sạch, hợp dự án ven biển', tren: '#9fe8ff', duoi: '#06304f', tron: 'soft-light', dam: 0.5 },
  { key: 'damnet', name: 'Đậm nét', note: 'Tăng tương phản, màu no — xem trên điện thoại rất nổi', tren: '#ffffff', duoi: '#000000', tron: 'overlay', dam: 0.3 },
  { key: 'coxua', name: 'Hoài cổ', note: 'Ngả nâu vàng, êm mắt, hợp video kể chuyện', tren: '#f5d9a8', duoi: '#3b2a1a', tron: 'overlay', dam: 0.34 },
];
function drawGrade(ctx: CanvasRenderingContext2D, W: number, H: number, key?: string, toiGoc?: number) {
  const g = GRADES.find((x) => x.key === (key || 'none'));
  if (g && g.dam > 0) {
    ctx.save();
    try { ctx.globalCompositeOperation = g.tron as GlobalCompositeOperation; } catch { /* máy cũ không hỗ trợ thì bỏ qua */ }
    ctx.globalAlpha = g.dam;
    const lg = ctx.createLinearGradient(0, 0, 0, H); lg.addColorStop(0, g.tren); lg.addColorStop(1, g.duoi);
    ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  const v = Math.max(0, Math.min(1, toiGoc ?? 0));
  if (v > 0.01) {
    ctx.save();
    const r = Math.hypot(W, H) / 2;
    const rg = ctx.createRadialGradient(W / 2, H / 2, r * 0.42, W / 2, H / 2, r);
    rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(0.65, 'rgba(0,0,0,' + (0.22 * v).toFixed(3) + ')'); rg.addColorStop(1, 'rgba(0,0,0,' + (0.8 * v).toFixed(3) + ')');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}
// MỞ MÀN / ĐÓNG MÀN: tối dần ở đầu và cuối video. Chi tiết nhỏ nhưng thiếu nó là video nhìn
// cụt ngủn như quay dở chừng — mọi video chuyên nghiệp đều có.
function drawFade(ctx: CanvasRenderingContext2D, W: number, H: number, el: number, D: number, bat: boolean) {
  if (!bat) return;
  const fd = 0.5;
  const a = el < fd ? 1 - el / fd : (el > D - fd ? 1 - Math.max(0, D - el) / fd : 0);
  if (a > 0.002) { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,' + Math.max(0, Math.min(1, a)).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
}
function drawSub(ctx: CanvasRenderingContext2D, W: number, H: number, text: string) {
  if (!text) return; const k = Math.min(W, H) / 1080; const px = (n: number) => Math.round(n * k);
  ctx.save(); ctx.font = `600 ${px(40)}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tw = ctx.measureText(text).width; const padX = px(34), padY = px(18);
  const bw = Math.min(W - px(80), tw + padX * 2), bh = px(40) + padY * 2; const cx = W / 2, cy = H - px(300);
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = px(22); ctx.shadowOffsetY = px(6);
  ctx.fillStyle = 'rgba(6,16,28,0.72)'; roundRect(ctx, cx - bw / 2, cy - bh / 2, bw, bh, bh / 2); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = Math.max(1, px(1.5)); roundRect(ctx, cx - bw / 2, cy - bh / 2, bw, bh, bh / 2); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.fillText(text, cx, cy); ctx.restore();
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Chữ trên khung xem trước — vẽ bằng canvas y hệt lúc xuất video (uốn cong, giãn cách, viền đều đúng).
function TextLive({ o, k, ap = 1 }: { o: Obj; k: number; ap?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [dim, setDim] = useState({ w: 20, h: 20 });
  useEffect(() => {
    const c = ref.current; if (!c) return; const x = c.getContext('2d'); if (!x) return;
    const fs = Math.max(6, (o.size || 48) * k * (o.scale || 1));
    const fam = FONTS.find((f) => f.key === (o.font || 'sans'))?.css || FONTS[0].css;
    x.font = `${o.weight || 700} ${fs}px ${fam}`;
    try { (x as any).letterSpacing = (((o.ls || 0) * fs) / 100).toFixed(2) + 'px'; } catch { /* bỏ qua */ }
    const tw = x.measureText(o.text || ' ').width;
    const w = Math.ceil(tw + fs * 0.9), h = Math.ceil(fs * (o.curve ? 2.6 : 1.6));
    if (dim.w !== w || dim.h !== h) { setDim({ w, h }); return; }
    x.setTransform(2, 0, 0, 2, 0, 0); x.clearRect(0, 0, c.width, c.height);
    x.save(); x.translate(w / 2, h / 2); paintObjText(x, o, fs, ap); x.restore();
  });
  return <canvas ref={ref} width={dim.w * 2} height={dim.h * 2} style={{ width: dim.w, height: dim.h, display: 'block' }} />;
}

// Ô xem trước một mẫu khối trong bảng chọn (chạy lặp).
function WidgetPreview({ kind, data }: { kind: string; data: any }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return; const x = c.getContext('2d'); if (!x) return;
    let raf = 0; const t0 = gioHieuUng();
    const loop = () => {
      const t = ((gioHieuUng() - t0) / 1000) % 5;
      x.clearRect(0, 0, c.width, c.height);
      const g = x.createLinearGradient(0, 0, 0, c.height); g.addColorStop(0, '#16324e'); g.addColorStop(1, '#0a1626');
      x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
      x.save(); x.translate(c.width / 2, c.height / 2);
      const tall = kind !== 'ios' && kind !== 'price';
      drawWidget(x, kind, 0, 0, tall ? c.height * 0.42 : c.width * 0.88, data, Math.min(1, t / 0.5), t);
      x.restore();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [kind, data]);
  return <canvas ref={ref} width={240} height={200} className="w-full rounded-lg" />;
}

// Khối dựng sẵn hiện trên khung xem trước — vẽ bằng ĐÚNG hàm dựng video nên khớp hoàn toàn.
function WidgetLive({ kind, data, width, playhead }: { kind: string; data: any; width: number; playhead: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const H = Math.round(width * (kind === 'ios' ? 0.34 : kind === 'price' ? 0.68 : 2.14));
  useEffect(() => {
    const c = ref.current; if (!c) return; const x = c.getContext('2d'); if (!x) return;
    let raf = 0;
    const loop = () => {
      x.clearRect(0, 0, c.width, c.height);
      x.save(); x.translate(c.width / 2, c.height / 2);
      drawWidget(x, kind, 0, 0, width * 2, data, Math.max(0, Math.min(1, playhead / 0.5)), Math.max(0, playhead));
      x.restore();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [kind, data, width, playhead]);
  return <canvas ref={ref} width={Math.round(width * 2)} height={H * 2} style={{ width: width, height: H, display: 'block' }} />;
}

// Ô xem trước một biểu tượng tiện ích (nét nhỏ, dùng trong bảng chọn).

// ══════════ BẢNG MÀU DÙNG CHUNG (kiểu Canva) ══════════
// Xếp theo CỘT: mỗi cột một họ màu, ba dòng là đậm → chuẩn → nhạt. Nhìn xuống là thấy hết
// sắc độ của một màu, nhìn ngang là đổi màu — mắt tìm nhanh hơn hẳn một mớ chấm xếp lộn xộn.
const HO_MAU: [string, [string, string, string]][] = [
  ['Đỏ', ['#b91c1c', '#ef4444', '#fca5a5']],
  ['Cam', ['#c2410c', '#f97316', '#fdba74']],
  ['Vàng kim', ['#a16207', '#C8A14B', '#fde68a']],
  ['Xanh lá', ['#15803d', '#22c55e', '#86efac']],
  ['Xanh ngọc', ['#0f766e', '#14b8a6', '#5eead4']],
  ['Xanh dương', ['#1d4ed8', '#3b82f6', '#93c5fd']],
  ['Tím', ['#6d28d9', '#a855f7', '#d8b4fe']],
  ['Hồng', ['#be185d', '#ec4899', '#f9a8d4']],
  ['Nâu đất', ['#78350f', '#b45309', '#fcd34d']],
];
const MAU_TRUNG_TINH = ['#ffffff', '#e2e8f0', '#94a3b8', '#475569', '#0A2540', '#0b1220'];
const MAU_NHANH = ['#C8A14B', '#ef4444', '#3b82f6', '#22c55e'];   // bày sẵn ngoài cho bấm một phát là xong
// Màu sáng hay tối? Dùng để chọn màu cho dấu tích ở giữa chấm màu đang chọn (trắng trên nền tối, xanh đêm trên nền sáng).
function mauSang(hex: string): boolean {
  const h = (hex || '').replace('#', ''); if (h.length < 6) return false;
  const n = parseInt(h.slice(0, 6), 16); if (isNaN(n)) return false;
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 165;
}
// goiY = mấy màu HỢP VỚI THỨ ĐANG CHỈNH (vd tông màu của kiểu ghim) — hiện trước bảng màu chung.
function BangMau({ mau, doiMau, goiY, nhanGoiY, nhan }: { mau: string; doiMau: (c: string) => void; goiY?: string[]; nhanGoiY?: string; nhan?: string }) {
  const [mo, setMo] = useState(false);
  const [ganDay, setGanDay] = useState<string[]>([]);
  const [go, setGo] = useState('');                              // đang gõ mã màu bằng tay
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem('clvideo_mau_gandy') || '[]'); if (Array.isArray(v)) setGanDay(v.slice(0, 10)); } catch { /* chưa có thì thôi */ } }, []);
  const trung = (a: string, b: string) => (a || '').toLowerCase() === (b || '').toLowerCase();
  // Chọn màu nào thì nhớ lại màu đó — lần sau mở ra có ngay, khỏi dò lại trong bảng.
  const chon = (c: string) => { doiMau(c); setGanDay((p) => { const n = [c, ...p.filter((x) => !trung(x, c))].slice(0, 10); try { localStorage.setItem('clvideo_mau_gandy', JSON.stringify(n)); } catch { /* bỏ qua */ } return n; }); };
  const Cham = ({ c, co = 24 }: { c: string; co?: number }) => (
    <button onClick={() => chon(c)} title={c.toUpperCase()} className="grid shrink-0 place-items-center rounded-full transition hover:scale-110"
      style={{ width: co, height: co, background: c, boxShadow: trung(mau, c) ? '0 0 0 2px ' + GOLD + ', 0 0 0 4px rgba(200,161,75,.2)' : '0 0 0 1px rgba(255,255,255,.22)' }}>
      {trung(mau, c) && <i className="block rounded-full" style={{ width: co * 0.3, height: co * 0.3, background: mauSang(c) ? NAVY : '#fff' }} />}
    </button>
  );
  const Tieu = ({ t }: { t: string }) => <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t}</div>;
  return (
    <div className="rounded-xl" style={{ background: 'rgba(255,255,255,.04)', boxShadow: 'inset 0 0 0 1px ' + LINE }}>
      <div className="flex items-center gap-2 px-2.5 py-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: mau, boxShadow: '0 0 0 1px rgba(255,255,255,.28), 0 2px 8px rgba(0,0,0,.45)' }} />
        <span className="min-w-0">
          <span className="block text-[11px] font-bold leading-none" style={{ color: INK }}>{nhan || 'Màu đang dùng'}</span>
          <span className="block font-mono text-[10px] leading-tight text-slate-400">{(mau || '').toUpperCase()}</span>
        </span>
        <span className="ml-auto flex items-center gap-1">
          {((goiY && goiY.length ? goiY : MAU_NHANH)).slice(0, 4).map((c) => <Cham key={c} c={c} co={22} />)}
          <button onClick={() => setMo(!mo)} className="ml-1 shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold transition" style={{ background: mo ? GOLD : 'rgba(255,255,255,.09)', color: mo ? NAVY : '#cbd5e1' }} title="Mở bảng màu đầy đủ">🎨 Bảng màu</button>
        </span>
      </div>
      {mo && (
        <div className="px-2.5 pb-2.5" style={{ borderTop: '1px solid ' + LINE, paddingTop: 8 }}>
          {goiY && goiY.length > 0 && (<><Tieu t={nhanGoiY || 'Màu hợp với kiểu này'} /><div className="mb-2 flex flex-wrap gap-1.5">{goiY.map((c) => <Cham key={c} c={c} />)}</div></>)}
          {ganDay.length > 0 && (<><Tieu t="Màu vừa dùng" /><div className="mb-2 flex flex-wrap gap-1.5">{ganDay.map((c) => <Cham key={'g' + c} c={c} />)}</div></>)}
          <Tieu t="Bảng màu" />
          <div className="mb-2 grid gap-1" style={{ gridTemplateColumns: 'repeat(9, minmax(0, 1fr))' }}>
            {[0, 1, 2].map((dong) => HO_MAU.map(([ten, ds]) => <span key={ten + dong} className="grid place-items-center" title={ten}><Cham c={ds[dong]} co={22} /></span>))}
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">{MAU_TRUNG_TINH.map((c) => <Cham key={c} c={c} co={22} />)}</div>
          <Tieu t="Tự pha màu riêng" />
          <div className="flex items-center gap-2">
            <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(mau || '') ? mau : '#C8A14B'} onChange={(e) => chon(e.target.value)} className="h-8 w-11 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0" title="Mở bảng pha màu của máy" />
            <input value={go || (mau || '').toUpperCase()} onChange={(e) => { const v = e.target.value; setGo(v); const t = v.trim(); if (/^#[0-9a-fA-F]{6}$/.test(t)) { chon(t); setGo(''); } }} onBlur={() => setGo('')}
              placeholder="#C8A14B" className="w-28 rounded-lg px-2 py-1 font-mono text-[11px]" style={{ background: '#0d2033', border: '1px solid ' + LINE, color: INK }} title="Gõ mã màu 6 ký tự, vd #C8A14B" />
            <span className="text-[10px] leading-tight text-slate-500">Gõ mã màu hoặc bấm ô vuông để pha màu bất kỳ.</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════ PHƯƠNG TIỆN CHẠY DỌC TUYẾN ĐƯỜNG ══════════
// Vẽ NHÌN TỪ TRÊN XUỐNG (như nhìn từ flycam) vì chúng chạy trên bản đồ. Mỗi cái vẽ trong khung
// vuông, ĐẦU LUÔN HƯỚNG LÊN — nhờ vậy bật "quay theo hướng đi" là tự xoay đúng chiều đường.
/**
 * ══ VẬT THỂ 3D ĐẶT LÊN BẢN ĐỒ ══
 * Ngoài phương tiện chạy trên tuyến, app tham chiếu còn cả một kho vật thể đứng yên: bãi biển, núi,
 * toà nhà, túi tiền, biểu đồ tăng… Chúng làm video "kể chuyện" được: chỉ vào chỗ này là biển, chỗ kia
 * là trường học, góc này giá đang tăng.
 * Bộ ảnh lấy từ Fluent Emoji 3D của Microsoft (giấy phép MIT — bán hàng thoải mái, chỉ cần giữ dòng
 * bản quyền, xem /vat3d/GIAY-PHEP.txt). Cùng lối vẽ 3D bo tròn nên nhìn đồng bộ với nhau.
 */
const VAT_3D: { key: string; name: string; nhom: string }[] = [
  { key: 'bai-bien', name: 'Bãi biển', nhom: 'Biển đảo · du lịch' },
  { key: 'dao', name: 'Đảo dừa', nhom: 'Biển đảo · du lịch' },
  { key: 'song-bien', name: 'Sóng biển', nhom: 'Biển đảo · du lịch' },
  { key: 'co-dua', name: 'Cây dừa', nhom: 'Biển đảo · du lịch' },
  { key: 'nui', name: 'Núi', nhom: 'Biển đảo · du lịch' },
  { key: 'nui-tuyet', name: 'Núi cao', nhom: 'Biển đảo · du lịch' },
  { key: 'binh-minh', name: 'Bình minh trên núi', nhom: 'Biển đảo · du lịch' },
  { key: 'leu-trai', name: 'Lều trại', nhom: 'Biển đảo · du lịch' },
  { key: 'nha', name: 'Nhà ở', nhom: 'Nhà đất · hạ tầng' },
  { key: 'nha-vuon', name: 'Nhà vườn', nhom: 'Nhà đất · hạ tầng' },
  { key: 'toa-nha', name: 'Toà nhà văn phòng', nhom: 'Nhà đất · hạ tầng' },
  { key: 'chung-cu', name: 'Đang xây dựng', nhom: 'Nhà đất · hạ tầng' },
  { key: 'thanh-pho', name: 'Khu đô thị', nhom: 'Nhà đất · hạ tầng' },
  { key: 'cau', name: 'Cầu', nhom: 'Nhà đất · hạ tầng' },
  { key: 'nha-may', name: 'Nhà máy', nhom: 'Nhà đất · hạ tầng' },
  { key: 'khach-san', name: 'Khách sạn', nhom: 'Tiện ích quanh lô' },
  { key: 'truong-hoc', name: 'Trường học', nhom: 'Tiện ích quanh lô' },
  { key: 'benh-vien', name: 'Bệnh viện', nhom: 'Tiện ích quanh lô' },
  { key: 'ngan-hang', name: 'Ngân hàng', nhom: 'Tiện ích quanh lô' },
  { key: 'cua-hang', name: 'Cửa hàng', nhom: 'Tiện ích quanh lô' },
  { key: 'tui-tien', name: 'Túi tiền', nhom: 'Tiền · giao dịch' },
  { key: 'xap-tien', name: 'Xấp tiền', nhom: 'Tiền · giao dịch' },
  { key: 'bieu-do-tang', name: 'Giá tăng', nhom: 'Tiền · giao dịch' },
  { key: 'bieu-do-giam', name: 'Giá giảm', nhom: 'Tiền · giao dịch' },
  { key: 'tay-bat', name: 'Chốt deal', nhom: 'Tiền · giao dịch' },
  { key: 'chia-khoa', name: 'Chìa khoá', nhom: 'Tiền · giao dịch' },
  { key: 'hop-dong', name: 'Hợp đồng', nhom: 'Tiền · giao dịch' },
  { key: 'ghim-do', name: 'Ghim đỏ', nhom: 'Nhấn mạnh' },
  { key: 'ngoi-sao', name: 'Ngôi sao', nhom: 'Nhấn mạnh' },
  { key: 'canh-bao', name: 'Cảnh báo', nhom: 'Nhấn mạnh' },
  { key: 'lua', name: 'Lửa (hot)', nhom: 'Nhấn mạnh' },
];
const KHO_VAT_3D = new Map<string, HTMLImageElement>();
function anhVat3D(key: string): HTMLImageElement | null {
  if (typeof document === 'undefined') return null;
  const co = KHO_VAT_3D.get(key);
  if (co) return co.complete && co.naturalWidth > 0 ? co : null;
  const im = new Image();
  im.onload = () => { try { window.dispatchEvent(new CustomEvent('cl-xe3d-xong')); } catch { /* ignore */ } };
  im.src = '/vat3d/' + key + '.png';
  KHO_VAT_3D.set(key, im);
  return null;
}

const XE_LIST: { key: string; name: string; note: string; mau: string; co: number }[] = [
  { key: 'xemay-shipper', name: 'Xe máy giao hàng', note: 'Xe máy có thùng hàng sau — cảnh shipper giao tận nơi trong khu dân cư', mau: '#e0442e', co: 0.8 },
  { key: 'xemay', name: 'Xe máy', note: 'Phương tiện phổ biến nhất — hợp mọi cảnh đường trong khu dân cư', mau: '#e0442e', co: 0.78 },
  { key: 'xedap', name: 'Xe đạp', note: 'Cảnh yên bình: đường nội khu, ven công viên', mau: '#e0442e', co: 0.72 },
  { key: 'nguoi', name: 'Người đi bộ', note: 'Cảnh dạo bộ ven biển, khách đi xem đất', mau: '#2f7fd8', co: 0.55 },
  { key: 'maybay', name: 'Máy bay', note: 'Cảnh gần sân bay Cam Ranh', mau: '#eef2f7', co: 1.7 },
  { key: 'tructhang', name: 'Trực thăng', note: 'Cảnh bay ngắm toàn khu từ trên cao', mau: '#2f7fd8', co: 1.3 },
  { key: 'thuyenbuom', name: 'Thuyền buồm', note: 'Cảnh vịnh biển, du lịch — hợp đất ven biển', mau: '#eef2f7', co: 1.1 },
  { key: 'ship-cargo-a', name: 'Tàu container', note: 'Ảnh dựng 3D — cảnh cảng biển, khu công nghiệp ven biển', mau: '#0ea5e9', co: 1.9 },
  { key: 'ship-large', name: 'Tàu hàng lớn', note: 'Ảnh dựng 3D — tàu vận tải cỡ lớn ngoài khơi', mau: '#64748b', co: 2 },
  { key: 'ship-ocean-liner', name: 'Tàu du lịch biển', note: 'Ảnh dựng 3D — cảnh du lịch, cảng tàu khách', mau: '#e2e8f0', co: 2 },
  { key: 'boat-speed-a', name: 'Ca nô cao tốc', note: 'Ảnh dựng 3D — cảnh biển, khu nghỉ dưỡng', mau: '#f59e0b', co: 0.9 },
  { key: 'boat-sail-a', name: 'Thuyền buồm', note: 'Ảnh dựng 3D — cảnh vịnh, du lịch biển', mau: '#22c55e', co: 0.95 },
  { key: 'boat-fishing-small', name: 'Thuyền cá', note: 'Ảnh dựng 3D — cảnh làng chài, đầm Thuỷ Triều', mau: '#eab308', co: 0.9 },
  { key: 'train-electric-bullet-a', name: 'Tàu cao tốc', note: 'Ảnh dựng 3D — cảnh hạ tầng đường sắt tốc độ cao', mau: '#2563eb', co: 1.6 },
  { key: 'train-locomotive-a', name: 'Tàu hoả', note: 'Ảnh dựng 3D — đầu máy cổ điển, cảnh ga tàu', mau: '#16a34a', co: 1.5 },
  { key: 'train-tram-modern', name: 'Tàu điện', note: 'Ảnh dựng 3D — cảnh giao thông đô thị hiện đại', mau: '#94a3b8', co: 1.4 },
  { key: 'xebuyt', name: 'Xe buýt', note: 'Xe buýt thành phố — cảnh có tuyến xe công cộng chạy qua', mau: '#16a34a', co: 1.45 },
  { key: 'taxi', name: 'Taxi', note: 'Xe taxi vàng — cảnh phố, dịch vụ đưa đón', mau: '#f59e0b', co: 1 },
  { key: 'van', name: 'Xe van', note: 'Xe van chở khách/hàng — cảnh khu dân cư, dịch vụ', mau: '#2563eb', co: 1.1 },
  { key: 'truck', name: 'Xe tải', note: 'Xe tải thùng — cảnh vận chuyển vật liệu', mau: '#16a34a', co: 1.25 },
  { key: 'delivery', name: 'Xe giao hàng', note: 'Xe thùng giao hàng — cảnh dịch vụ tận nơi', mau: '#16a34a', co: 1.15 },
  { key: 'ambulance', name: 'Xe cứu thương (3D)', note: 'Ảnh dựng 3D — cảnh gần bệnh viện', mau: '#ffffff', co: 1.15 },
  { key: 'firetruck', name: 'Xe cứu hoả', note: 'Xe chữa cháy — cảnh hạ tầng, an toàn khu dân cư', mau: '#e11d48', co: 1.3 },
  { key: 'police', name: 'Xe cảnh sát', note: 'Cảnh an ninh khu dân cư', mau: '#e2e8f0', co: 1.05 },
  { key: 'garbage-truck', name: 'Xe rác', note: 'Cảnh hạ tầng dịch vụ đô thị', mau: '#16a34a', co: 1.3 },
  { key: 'tractor', name: 'Máy kéo', note: 'Cảnh đất nông nghiệp, trang trại', mau: '#eab308', co: 1.15 },
  { key: 'tractor-shovel', name: 'Máy xúc (3D)', note: 'Ảnh dựng 3D — cảnh công trường đang thi công', mau: '#eab308', co: 1.25 },
  { key: 'sedan-sports', name: 'Xe thể thao', note: 'Xe sang — cảnh dự án cao cấp', mau: '#e11d48', co: 1 },
  { key: 'sedan', name: 'Xe con (3D)', note: 'Ảnh dựng 3D — nhìn có khối, hợp mọi cảnh đường bộ', mau: '#e11d48', co: 1 },
  { key: 'suv', name: 'Xe SUV', note: 'Xe gầm cao — cảnh đường lớn, khu đô thị mới', mau: '#64748b', co: 1.1 },
  { key: 'xekhach', name: 'Xe khách', note: 'Xe 45 chỗ — cảnh đưa đón, tour du lịch', mau: '#f59e0b', co: 1.35 },
];
// Vẽ một phương tiện: tâm ở (0,0), đầu hướng lên, cao khoảng 'L' điểm ảnh. el = giây đã trôi (để quay cánh quạt).
/**
 * ══ XE DỰNG SẴN BẰNG ẢNH 3D ══
 * Xe vẽ bằng nét (drawXe bên dưới) tuy sạch nhưng nhìn ra ngay là hình vẽ. Mấy app dựng video xịn
 * dùng ảnh render từ model 3D thật — có khối, có bóng, có ánh sáng hắt trên nóc.
 * Ở đây làm y vậy nhưng bằng bộ model "Car Kit" của Kenney (giấy phép CC0 — dùng buôn bán thoải mái),
 * máy tự dựng ra ảnh nhìn từ trên xuống, để sẵn trong /xe3d/. Xem thêm /xe3d/GIAY-PHEP.txt.
 * Xe nào có ảnh thì dán ảnh; xe nào chưa có thì vẫn vẽ nét như cũ, không mất gì.
 */
const XE_3D = new Set(['sedan', 'suv', 'taxi', 'van', 'truck', 'delivery', 'ambulance', 'firetruck', 'police', 'garbage-truck', 'tractor', 'tractor-shovel', 'sedan-sports', 'race',
  'ship-cargo-a', 'ship-large', 'ship-ocean-liner', 'boat-speed-a', 'boat-sail-a', 'boat-fishing-small', 'train-electric-bullet-a', 'train-locomotive-a', 'train-tram-modern']);
const KHO_ANH_XE = new Map<string, HTMLImageElement>();
/**
 * ══ HAI GÓC NHÌN CHO MỖI XE ══
 * Học từ cách app tham chiếu đặt xe lên bản đồ: sprite của họ nhìn CHÉO 3/4 (thấy nóc, mặt trước và
 * một mặt bên) chứ không nhìn thẳng từ trên xuống, và khi chạy thì xe KHÔNG quay đầu — nó giữ nguyên
 * dáng, chỉ trượt đi, nên lúc nào cũng thấy được hình khối chiếc xe.
 * Ta để sẵn cả hai bộ ảnh:
 *   /xe34/  — góc 3/4, dùng khi xe KHÔNG quay đầu theo hướng (mặc định, giống họ)
 *   /xe3d/  — nhìn từ trên xuống, dùng khi người dùng bật "quay đầu theo hướng đi" (lúc đó mới đúng)
 */
// Năm món dưới đây Kenney không có nên TỰ DỰNG bằng khối hình (three.js), rồi render bằng ĐÚNG
// ánh sáng, đúng góc máy, đúng bóng đổ như bộ xe Kenney — nhờ vậy đặt cạnh nhau nhìn cùng một nhà.
// (Trước đó tôi lấy emoji cho mấy món này: sai, vì emoji vẽ NGANG và PHẲNG, lạc hẳn khỏi bộ xe.)
const XE_34 = new Set(['xemay-shipper', 'xemay', 'nguoi', 'maybay', 'xedap', 'tructhang', 'thuyenbuom', 'sedan', 'suv', 'taxi', 'van', 'truck', 'delivery', 'ambulance', 'firetruck', 'police', 'garbage-truck', 'tractor', 'tractor-shovel', 'sedan-sports', 'race']);
let _gocXe = '34';                       // '34' = nhìn chéo · 'tren' = nhìn từ trên xuống
function datGocXe(g: '34' | 'tren') { _gocXe = g; }

function anhXe3D(kind: string): HTMLImageElement | null {
  if (typeof document === 'undefined') return null;
  const dungGoc34 = _gocXe === '34' && XE_34.has(kind);
  if (!dungGoc34 && !XE_3D.has(kind)) return null;
  const khoa = (dungGoc34 ? '34|' : '') + kind;
  const co = KHO_ANH_XE.get(khoa);
  if (co) return co.complete && co.naturalWidth > 0 ? co : null;
  const im = new Image();
  im.onload = () => { try { window.dispatchEvent(new CustomEvent('cl-xe3d-xong')); } catch { /* ignore */ } };
  im.src = (dungGoc34 ? '/xe34/' : '/xe3d/') + kind + '.png';
  KHO_ANH_XE.set(khoa, im);
  return null;                       // lần đầu chưa có thì thôi, ảnh về sẽ báo để vẽ lại
}

/** Nạp sẵn cả bộ ảnh xe ngay khi mở công cụ — lúc quay video khỏi phải chờ tấm nào. */
// Nạp sẵn ảnh xe ngay khi mở trang: nạp cả bộ nhìn từ trên lẫn bộ nhìn chéo 3/4,
// để lúc kéo xe ra bản đồ là có hình ngay, không bị lỡ mấy khung đầu.
function napTruocAnhXe() {
  XE_3D.forEach((k) => anhXe3D(k));
  const goc = _gocXe; _gocXe = '34'; XE_34.forEach((k) => anhXe3D(k)); _gocXe = goc;
}

function drawXe(x: CanvasRenderingContext2D, kind: string, L: number, mau: string, el = 0) {
  // Vật thể đứng yên (bãi biển, toà nhà, túi tiền…) — dán ảnh kèm bóng nhẹ, không có chấm sáng đuôi
  // vì chúng đâu có chạy.
  if (kind.startsWith('vat:')) {
    const av = anhVat3D(kind.slice(4));
    if (av) {
      const tl = av.naturalHeight / av.naturalWidth;
      const w2 = L * 1.25, h2 = w2 * tl;
      x.save();
      x.shadowColor = 'rgba(4,10,20,.42)'; x.shadowBlur = L * 0.16; x.shadowOffsetY = L * 0.07;
      x.drawImage(av, -w2 / 2, -h2 / 2, w2, h2);
      x.restore();
    }
    return;
  }
  const anh = anhXe3D(kind);
  if (anh) {                          // có ảnh 3D thì dán ảnh, khỏi vẽ nét
    const tl = anh.naturalHeight / anh.naturalWidth;
    const w = L * 1.15, h = w * tl;
    // CHẤM SÁNG Ở ĐUÔI — xem kỹ 4 khung liên tiếp của app tham chiếu thì thấy họ KHÔNG kéo vệt dài,
    // chỉ có một chấm sáng nhỏ nhấp nháy ngay sau xe. Vệt dài nhìn rối và làm xe như đang cháy.
    x.save();
    const cs = x.createRadialGradient(-w * 0.42, h * 0.06, 0, -w * 0.42, h * 0.06, w * 0.16);
    cs.addColorStop(0, 'rgba(255,240,190,.95)'); cs.addColorStop(0.45, 'rgba(255,206,90,.5)'); cs.addColorStop(1, 'rgba(255,196,60,0)');
    x.fillStyle = cs;
    x.beginPath(); x.arc(-w * 0.42, h * 0.06, w * 0.16, 0, Math.PI * 2); x.fill();
    x.restore();
    // ══ TÁCH XE KHỎI NỀN ẢNH VỆ TINH ══
    // Ảnh vệ tinh lổn nhổn cây cối nhà cửa, xe dán lên dễ bị "chìm" vào nền. Hai lớp dưới đây chữa:
    //   · quầng sáng trắng rất mảnh ôm quanh xe → mép xe luôn đọc được dù nền màu gì
    //   · bóng đổ đậm hơn chút → xe như đứng trên mặt đất chứ không lơ lửng
    x.save();
    x.shadowColor = 'rgba(255,255,255,.85)'; x.shadowBlur = L * 0.07; x.shadowOffsetY = 0;
    x.drawImage(anh, -w / 2, -h / 2, w, h);
    x.drawImage(anh, -w / 2, -h / 2, w, h);
    x.restore();
    x.save();
    x.shadowColor = 'rgba(4,10,20,.58)'; x.shadowBlur = L * 0.2; x.shadowOffsetY = L * 0.09;
    x.drawImage(anh, -w / 2, -h / 2, w, h);
    x.restore();
    return;
  }
  const u = L / 100;                          // mọi số đo bên dưới tính theo thang 100
  const p = (n: number) => n * u;
  const toi = shade(mau, -58), sang = shade(mau, 42), dam = shade(mau, -28);
  const kinh = 'rgba(10,20,34,.88)', trang = 'rgba(255,255,255,.92)';
  const hop = (w: number, h: number, r: number, mauNen: string | CanvasGradient) => {
    x.beginPath(); const l = -w / 2, t = -h / 2; const rr = Math.min(r, w / 2, h / 2);
    x.moveTo(l + rr, t); x.arcTo(l + w, t, l + w, t + h, rr); x.arcTo(l + w, t + h, l, t + h, rr);
    x.arcTo(l, t + h, l, t, rr); x.arcTo(l, t, l + w, t, rr); x.closePath();
    x.fillStyle = mauNen as any; x.fill();
  };
  // VIỀN SÁNG MẢNH chạy quanh mép — chi tiết nhỏ này làm xe nhìn có khối, không bị bẹt như hình dán.
  const vienSang = (w: number, h: number, r: number, do_ = 0.45) => {
    x.beginPath(); const l = -w / 2, t = -h / 2; const rr = Math.min(r, w / 2, h / 2);
    x.moveTo(l + rr, t); x.arcTo(l + w, t, l + w, t + h, rr); x.arcTo(l + w, t + h, l, t + h, rr);
    x.arcTo(l, t + h, l, t, rr); x.arcTo(l, t, l + w, t, rr); x.closePath();
    x.strokeStyle = 'rgba(255,255,255,' + do_ + ')'; x.lineWidth = p(1.3); x.stroke();
  };
  // DẢI ĐÈN LED mảnh vắt ngang đầu/đuôi — lối thiết kế xe đời mới, thay cho hai chấm đèn tròn kiểu cũ.
  const daiDen = (dy: number, w: number, mauDen: string, quang: string) => {
    x.save(); x.shadowColor = quang; x.shadowBlur = p(6);
    x.translate(0, p(dy)); hop(p(w), p(3.4), p(1.7), mauDen); x.restore();
  };
  // MỘT vệt bóng mềm dưới gầm cho cả chiếc xe. Trước đây mỗi mảnh tự đổ bóng riêng nên chồng lên nhau
  // thành quầng đen xỉn; giờ chỉ một vệt, xe nổi lên khỏi mặt đất mà vẫn sạch.
  const bongGam = (w: number, h: number) => {
    const g = x.createRadialGradient(0, p(4), 0, 0, p(4), p(w / 2));
    g.addColorStop(0, 'rgba(4,10,20,.5)'); g.addColorStop(0.6, 'rgba(4,10,20,.2)'); g.addColorStop(1, 'rgba(4,10,20,0)');
    x.save(); x.translate(0, p(4)); x.scale(1, h / w);
    x.beginPath(); x.arc(0, 0, p(w / 2), 0, Math.PI * 2); x.fillStyle = g; x.fill(); x.restore();
  };
  // Bánh xe nhìn từ trên: chỉ thấy mép lốp thò ra hai bên thân.
  const banhXe = (dy: number, rong: number, dai = 9) => {
    [-1, 1].forEach((sx) => { x.save(); x.translate(sx * p(rong / 2 + 1), p(dy)); hop(p(4.6), p(dai), p(2.2), '#0d141f'); x.restore(); });
  };
  x.save();

  if (kind === 'xedap') {
    bongGam(46, 78);
    [-1, 1].forEach((sy) => { x.strokeStyle = '#141c28'; x.lineWidth = p(3.6);   // hai bánh mảnh
      x.beginPath(); x.ellipse(0, sy * p(29), p(4.5), p(15), 0, 0, Math.PI * 2); x.stroke(); });
    x.strokeStyle = shade(mau, -6); x.lineWidth = p(4.4); x.lineCap = 'round';   // khung xe
    x.beginPath(); x.moveTo(0, -p(24)); x.lineTo(0, p(24)); x.stroke();
    x.strokeStyle = '#0d141f'; x.lineWidth = p(3.6);                             // ghi-đông
    x.beginPath(); x.moveTo(-p(15), -p(21)); x.lineTo(p(15), -p(21)); x.stroke();
    x.save(); x.translate(0, -p(2));                                             // lưng người đạp
    hop(p(21), p(29), p(10), mau); vienSang(p(21), p(29), p(10), 0.3); x.restore();
    x.beginPath(); x.arc(0, -p(13), p(8), 0, Math.PI * 2); x.fillStyle = '#101a2b'; x.fill();            // mũ bảo hiểm
    x.beginPath(); x.arc(-p(2.6), -p(15.4), p(2.6), 0, Math.PI * 2); x.fillStyle = 'rgba(255,255,255,.4)'; x.fill();  // loé sáng trên mũ
    x.restore(); return;
  }
  // ══ NĂM PHƯƠNG TIỆN BỔ SUNG ══
  // Nhìn từ trên xuống, cái làm nên "ra hình" không phải chi tiết vụn mà là BA thứ: bóng đổ dưới gầm,
  // mặt trên chuyển sắc (sáng một bên, tối một bên như có nắng chiếu), và viền sáng mảnh quanh mép.
  // Ba thứ đó đã có sẵn helper bên trên, nên mấy chiếc dưới đây chỉ việc ghép khối cho đúng dáng.
  if (kind === 'shipper' || kind === 'cuuthuong' || kind === 'xebuyt' || kind === 'mayxuc' || kind === 'containership') {
    if (kind === 'shipper') {
      // XE MÁY GIAO HÀNG: xe máy + thùng hàng vuông cột phía sau — dáng ai cũng nhận ra ngay.
      const dai = 76, rong = 26;
      bongGam(rong * 1.7, dai * 1.15);
      banhXe(-dai * 0.34, rong * 0.5, 11); banhXe(dai * 0.34, rong * 0.5, 11);
      hop(p(rong * 0.66), p(dai * 0.74), p(9), dam);
      x.save(); x.translate(0, p(dai * 0.02));
      hop(p(rong * 1.02), p(dai * 0.32), p(10), mau); vienSang(p(rong * 1.02), p(dai * 0.32), p(10), 0.32);
      x.restore();
      x.save(); x.translate(0, p(dai * 0.3));                                   // thùng hàng sau lưng
      const gt = x.createLinearGradient(-p(rong * 0.6), 0, p(rong * 0.6), 0);
      gt.addColorStop(0, shade(mau, -35)); gt.addColorStop(0.45, shade(mau, 25)); gt.addColorStop(1, shade(mau, -10));
      hop(p(rong * 1.22), p(dai * 0.3), p(4), gt); vienSang(p(rong * 1.22), p(dai * 0.3), p(4), 0.5);
      x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = p(1.4);
      x.beginPath(); x.moveTo(-p(rong * 0.5), 0); x.lineTo(p(rong * 0.5), 0); x.stroke();
      x.restore();
      x.beginPath(); x.arc(0, -p(dai * 0.17), p(rong * 0.34), 0, Math.PI * 2); x.fillStyle = '#101a2b'; x.fill();
      x.beginPath(); x.arc(-p(rong * 0.1), -p(dai * 0.21), p(rong * 0.11), 0, Math.PI * 2); x.fillStyle = 'rgba(255,255,255,.42)'; x.fill();
      daiDen(-dai * 0.45, rong * 0.44, '#fff6d8', 'rgba(255,240,190,.95)');
    } else if (kind === 'cuuthuong') {
      // XE CỨU THƯƠNG: thân trắng, chữ thập đỏ trên nóc, đèn nóc xanh–đỏ.
      const dai = 100, rong = 44;
      bongGam(rong * 1.5, dai * 1.1);
      banhXe(-dai * 0.28, rong); banhXe(dai * 0.3, rong);
      const gw = x.createLinearGradient(-p(rong / 2), 0, p(rong / 2), 0);
      gw.addColorStop(0, '#cfd8e3'); gw.addColorStop(0.45, '#ffffff'); gw.addColorStop(1, '#e8eef5');
      hop(p(rong), p(dai * 0.92), p(10), gw); vienSang(p(rong), p(dai * 0.92), p(10), 0.5);
      x.save(); x.translate(0, -p(dai * 0.3)); hop(p(rong * 0.78), p(dai * 0.16), p(5), kinh); x.restore();
      x.fillStyle = '#e11d48';                                                   // chữ thập đỏ
      x.fillRect(-p(3), -p(dai * 0.06) - p(11), p(6), p(22));
      x.fillRect(-p(11), -p(dai * 0.06) - p(3), p(22), p(6));
      x.fillStyle = '#e11d48'; x.fillRect(-p(rong * 0.34), p(dai * 0.16), p(rong * 0.68), p(4));
      x.save(); x.translate(0, -p(dai * 0.42));                                  // đèn nóc
      x.fillStyle = '#2563eb'; x.fillRect(-p(11), -p(2.6), p(10), p(5.2));
      x.fillStyle = '#e11d48'; x.fillRect(p(1), -p(2.6), p(10), p(5.2)); x.restore();
      daiDen(-dai * 0.46, rong * 0.66, '#fff6d8', 'rgba(255,240,190,.95)');
    } else if (kind === 'xebuyt') {
      // XE BUÝT THÀNH PHỐ: dài, mui bằng, một dải cửa sổ chạy suốt hai bên.
      const dai = 128, rong = 46;
      bongGam(rong * 1.45, dai * 1.06);
      banhXe(-dai * 0.32, rong, 9); banhXe(dai * 0.26, rong, 9);
      const gb = x.createLinearGradient(-p(rong / 2), 0, p(rong / 2), 0);
      gb.addColorStop(0, toi); gb.addColorStop(0.42, mau); gb.addColorStop(1, sang);
      hop(p(rong), p(dai * 0.94), p(11), gb); vienSang(p(rong), p(dai * 0.94), p(11), 0.45);
      x.save(); x.translate(0, -p(dai * 0.36)); hop(p(rong * 0.8), p(dai * 0.13), p(4), kinh); x.restore();
      x.fillStyle = 'rgba(12,22,38,.62)';                                        // dải cửa sổ hai bên
      x.fillRect(-p(rong * 0.46), -p(dai * 0.24), p(4.5), p(dai * 0.56));
      x.fillRect(p(rong * 0.46) - p(4.5), -p(dai * 0.24), p(4.5), p(dai * 0.56));
      x.strokeStyle = 'rgba(255,255,255,.34)'; x.lineWidth = p(1.2);
      [-0.1, 0.1].forEach((k) => { x.beginPath(); x.moveTo(-p(rong * 0.44), p(dai * k)); x.lineTo(p(rong * 0.44), p(dai * k)); x.stroke(); });
      daiDen(-dai * 0.47, rong * 0.66, '#fff6d8', 'rgba(255,240,190,.95)');
    } else if (kind === 'mayxuc') {
      // MÁY XÚC: thân vàng công trường, hai dải bánh xích, cần và gầu chìa ra phía trước.
      const dai = 96, rong = 46;
      bongGam(rong * 1.5, dai * 1.1);
      x.fillStyle = '#2b3441';                                                   // bánh xích
      x.fillRect(-p(rong * 0.56), -p(dai * 0.3), p(9), p(dai * 0.6));
      x.fillRect(p(rong * 0.56) - p(9), -p(dai * 0.3), p(9), p(dai * 0.6));
      x.strokeStyle = 'rgba(255,255,255,.2)'; x.lineWidth = p(1);
      for (let k = -3; k <= 3; k++) {
        x.beginPath(); x.moveTo(-p(rong * 0.56), p(dai * 0.08 * k)); x.lineTo(-p(rong * 0.56) + p(9), p(dai * 0.08 * k)); x.stroke();
        x.beginPath(); x.moveTo(p(rong * 0.56) - p(9), p(dai * 0.08 * k)); x.lineTo(p(rong * 0.56), p(dai * 0.08 * k)); x.stroke();
      }
      const gm = x.createLinearGradient(-p(rong / 2), 0, p(rong / 2), 0);
      gm.addColorStop(0, shade(mau, -40)); gm.addColorStop(0.45, mau); gm.addColorStop(1, shade(mau, 35));
      hop(p(rong * 0.86), p(dai * 0.52), p(7), gm); vienSang(p(rong * 0.86), p(dai * 0.52), p(7), 0.45);
      x.save(); x.translate(0, -p(dai * 0.06)); hop(p(rong * 0.5), p(dai * 0.2), p(4), kinh); x.restore();
      x.save(); x.strokeStyle = shade(mau, -18); x.lineWidth = p(7); x.lineCap = 'round';   // cần
      x.beginPath(); x.moveTo(0, -p(dai * 0.2)); x.lineTo(0, -p(dai * 0.44)); x.stroke(); x.restore();
      x.save(); x.translate(0, -p(dai * 0.52)); hop(p(rong * 0.46), p(dai * 0.14), p(3), shade(mau, -30));   // gầu
      x.strokeStyle = 'rgba(255,255,255,.45)'; x.lineWidth = p(1.4); x.beginPath();
      x.moveTo(-p(rong * 0.2), p(dai * 0.06)); x.lineTo(p(rong * 0.2), p(dai * 0.06)); x.stroke(); x.restore();
    } else {
      // TÀU CONTAINER: thân dài mũi nhọn, các thùng hàng xếp thành hàng trên boong.
      const dai = 150, rong = 46;
      bongGam(rong * 1.4, dai * 1.04);
      x.beginPath();                                                             // thân tàu
      x.moveTo(0, -p(dai * 0.5));
      x.lineTo(p(rong * 0.46), -p(dai * 0.26)); x.lineTo(p(rong * 0.46), p(dai * 0.44));
      x.quadraticCurveTo(0, p(dai * 0.54), -p(rong * 0.46), p(dai * 0.44));
      x.lineTo(-p(rong * 0.46), -p(dai * 0.26)); x.closePath();
      const gs2 = x.createLinearGradient(-p(rong / 2), 0, p(rong / 2), 0);
      gs2.addColorStop(0, shade(mau, -45)); gs2.addColorStop(0.45, mau); gs2.addColorStop(1, shade(mau, 30));
      x.fillStyle = gs2; x.fill();
      x.strokeStyle = 'rgba(255,255,255,.4)'; x.lineWidth = p(1.4); x.stroke();
      const cot = ['#e11d48', '#2563eb', '#16a34a', '#f59e0b', '#0ea5e9'];       // thùng hàng
      for (let r2 = 0; r2 < 5; r2++) for (let c2 = 0; c2 < 3; c2++) {
        x.fillStyle = cot[(r2 + c2) % cot.length];
        x.fillRect(-p(rong * 0.33) + c2 * p(rong * 0.22), -p(dai * 0.18) + r2 * p(dai * 0.1), p(rong * 0.19), p(dai * 0.085));
      }
      x.save(); x.translate(0, p(dai * 0.34)); hop(p(rong * 0.56), p(dai * 0.11), p(3), '#e8eef5');   // cabin lái
      x.restore();
      daiDen(-dai * 0.5, rong * 0.4, '#fff6d8', 'rgba(255,240,190,.9)');
    }
    return;
  }
  if (kind === 'xecon' || kind === 'xekhach' || kind === 'xetai' || kind === 'xemay') {
    const dai = kind === 'xekhach' ? 104 : kind === 'xetai' ? 110 : kind === 'xemay' ? 72 : 88;
    const rong = kind === 'xemay' ? 24 : kind === 'xekhach' || kind === 'xetai' ? 44 : 42;
    bongGam(rong * 1.55, dai * 1.12);
    if (kind === 'xemay') {
      // XE MÁY nhìn từ trên: chỉ thấy người lái ngồi giữa hai bánh mảnh.
      banhXe(-dai * 0.34, rong * 0.5, 11); banhXe(dai * 0.34, rong * 0.5, 11);
      hop(p(rong * 0.66), p(dai * 0.74), p(9), dam);                                        // thân xe
      x.save(); x.translate(0, p(dai * 0.05));
      hop(p(rong * 1.05), p(dai * 0.36), p(11), mau); vienSang(p(rong * 1.05), p(dai * 0.36), p(11), 0.32);
      x.restore();
      x.beginPath(); x.arc(0, -p(dai * 0.19), p(rong * 0.36), 0, Math.PI * 2); x.fillStyle = '#101a2b'; x.fill();   // mũ bảo hiểm
      x.beginPath(); x.arc(-p(rong * 0.12), -p(dai * 0.23), p(rong * 0.12), 0, Math.PI * 2); x.fillStyle = 'rgba(255,255,255,.42)'; x.fill();
      daiDen(-dai * 0.45, rong * 0.44, '#fff6d8', 'rgba(255,240,190,.95)');
    } else if (kind === 'xetai') {
      // XE CONTAINER: rơ-moóc bạc phía sau, đầu kéo màu phía trước — hai khối chạm nhau thành một chiếc xe.
      banhXe(-dai * 0.3, rong, 8); banhXe(dai * 0.06, rong, 8); banhXe(dai * 0.28, rong, 8);
      x.save(); x.translate(0, p(dai * 0.19));
      const gt = x.createLinearGradient(-p(rong / 2), 0, p(rong / 2), 0);
      gt.addColorStop(0, '#c3cedc'); gt.addColorStop(0.45, '#eef3f8'); gt.addColorStop(1, '#ffffff');
      hop(p(rong * 0.96), p(dai * 0.6), p(5), gt); vienSang(p(rong * 0.96), p(dai * 0.6), p(5), 0.5);
      x.strokeStyle = 'rgba(110,130,155,.32)'; x.lineWidth = p(1.2);                        // gân thùng, chỉ 2 vạch cho gọn
      [-0.17, 0.17].forEach((k) => { x.beginPath(); x.moveTo(-p(rong * 0.42), p(dai * 0.6 * k)); x.lineTo(p(rong * 0.42), p(dai * 0.6 * k)); x.stroke(); });
      x.restore();
      x.save(); x.translate(0, -p(dai * 0.3));
      const gc = x.createLinearGradient(-p(rong / 2), 0, p(rong / 2), 0);
      gc.addColorStop(0, toi); gc.addColorStop(0.4, mau); gc.addColorStop(1, sang);
      hop(p(rong), p(dai * 0.36), p(9), gc); vienSang(p(rong), p(dai * 0.36), p(9), 0.45);
      x.save(); x.translate(0, -p(dai * 0.05)); hop(p(rong * 0.76), p(dai * 0.13), p(5), kinh); x.restore();   // kính lái
      x.restore();
      daiDen(-dai * 0.46, rong * 0.66, '#fff6d8', 'rgba(255,240,190,.95)');
    } else {
      // XE CON / XE KHÁCH: khối bo tròn rộng kiểu xe điện đời mới, kính là MỘT dải liền từ trước ra sau.
      banhXe(-dai * 0.28, rong); banhXe(dai * 0.3, rong);
      const g = x.createLinearGradient(-p(rong / 2), 0, p(rong / 2), 0);
      g.addColorStop(0, toi); g.addColorStop(0.38, mau); g.addColorStop(1, sang);
      const bo = kind === 'xekhach' ? 12 : 16;
      hop(p(rong), p(dai), p(bo), g); vienSang(p(rong), p(dai), p(bo), 0.45);
      x.save(); x.translate(0, -p(dai * 0.02));                                             // dải kính liền khối
      hop(p(rong * 0.78), p(dai * (kind === 'xekhach' ? 0.7 : 0.52)), p(8), kinh); x.restore();
      x.save(); x.globalAlpha = 0.15; x.translate(-p(rong * 0.17), -p(dai * 0.09)); x.rotate(-0.5);
      hop(p(rong * 0.52), p(dai * 0.09), p(3), '#ffffff'); x.restore();                     // vệt phản chiếu chéo trên kính
      [-1, 1].forEach((sx) => { x.save(); x.translate(sx * p(rong * 0.56), -p(dai * 0.2)); hop(p(5.4), p(3.4), p(1.6), dam); x.restore(); });  // gương chiếu hậu
      daiDen(-dai * 0.46, rong * 0.62, '#fff6d8', 'rgba(255,240,190,.95)');
      daiDen(dai * 0.46, rong * 0.62, '#ff4d3d', 'rgba(255,70,60,.85)');
    }
  } else if (kind === 'tauhoa') {
    bongGam(46, 128);
    const g = x.createLinearGradient(-p(15), 0, p(15), 0); g.addColorStop(0, toi); g.addColorStop(0.4, mau); g.addColorStop(1, sang);
    x.beginPath();                                                             // thân THON DÀI, mũi vót nhọn kiểu tàu cao tốc
    x.moveTo(0, -p(58)); x.bezierCurveTo(p(13), -p(42), p(15), -p(26), p(15), -p(12));
    x.lineTo(p(15), p(52)); x.quadraticCurveTo(p(15), p(56), p(11), p(56));
    x.lineTo(-p(11), p(56)); x.quadraticCurveTo(-p(15), p(56), -p(15), p(52));
    x.lineTo(-p(15), -p(12));
    x.bezierCurveTo(-p(15), -p(26), -p(13), -p(42), 0, -p(58)); x.closePath();
    x.fillStyle = g; x.fill();
    x.save(); x.clip();                                                        // DẢI KÍNH liền chạy suốt thân, cắt gọn trong thân tàu
    x.save(); x.translate(0, p(8)); hop(p(21), p(84), p(6), kinh); x.restore();
    x.save(); x.globalAlpha = 0.13; x.translate(-p(5), -p(10)); x.rotate(-0.35); hop(p(7), p(70), p(3), '#ffffff'); x.restore();
    x.restore();
    x.save(); x.translate(0, -p(34)); hop(p(18), p(9), p(4), kinh); x.restore();      // kính lái
    x.save(); x.translate(0, -p(4)); hop(p(30), p(2.4), p(1.2), 'rgba(255,255,255,.85)'); x.restore();   // sọc trắng vắt ngang thân
    daiDen(-46, 16, '#fff6d8', 'rgba(255,240,190,.95)');
  } else if (kind === 'duthuyen') {
    bongGam(52, 104);
    x.beginPath();                                                             // thân thuyền: mũi nhọn, đuôi vuông
    x.moveTo(0, -p(52)); x.bezierCurveTo(p(17), -p(26), p(19), p(6), p(17), p(38));
    x.quadraticCurveTo(p(17), p(42), p(13), p(42));
    x.lineTo(-p(13), p(42)); x.quadraticCurveTo(-p(17), p(42), -p(17), p(38));
    x.bezierCurveTo(-p(19), p(6), -p(17), -p(26), 0, -p(52)); x.closePath();
    const g = x.createLinearGradient(-p(18), 0, p(18), 0); g.addColorStop(0, '#c3cedc'); g.addColorStop(0.42, mau); g.addColorStop(1, '#ffffff');
    x.fillStyle = g; x.fill();
    x.save(); x.clip();
    x.save(); x.translate(0, p(14)); hop(p(26), p(34), p(8), 'rgba(190,140,80,.5)'); x.restore();   // sàn gỗ phía đuôi
    x.restore();
    x.save(); x.translate(0, -p(8)); hop(p(19), p(20), p(7), '#0d1e30'); vienSang(p(19), p(20), p(7), 0.3); x.restore();   // ca-bin kính tối
    x.save(); x.globalAlpha = 0.2; x.translate(-p(4), -p(12)); x.rotate(-0.4); hop(p(5), p(14), p(2.5), '#ffffff'); x.restore();
    x.save(); x.globalAlpha = 0.5;                                             // vệt nước rẽ sau đuôi, mờ dần
    const gw = x.createRadialGradient(0, p(52), 0, 0, p(52), p(20));
    gw.addColorStop(0, 'rgba(255,255,255,.75)'); gw.addColorStop(1, 'rgba(255,255,255,0)');
    x.beginPath(); x.ellipse(0, p(52), p(17), p(9), 0, 0, Math.PI * 2); x.fillStyle = gw; x.fill(); x.restore();
  } else if (kind === 'maybay') {
    bongGam(110, 110);
    const g = x.createLinearGradient(-p(10), 0, p(10), 0); g.addColorStop(0, '#a7b4c4'); g.addColorStop(0.42, mau); g.addColorStop(1, '#ffffff');
    x.beginPath();                                                             // cánh xuôi về sau, có gờ chắn đầu cánh (winglet)
    x.moveTo(0, -p(6)); x.lineTo(p(48), p(22)); x.lineTo(p(53), p(16)); x.lineTo(p(55), p(20));
    x.lineTo(p(52), p(31)); x.lineTo(0, p(18));
    x.lineTo(-p(52), p(31)); x.lineTo(-p(55), p(20)); x.lineTo(-p(53), p(16)); x.lineTo(-p(48), p(22)); x.closePath();
    x.fillStyle = g; x.fill();
    [-1, 1].forEach((sx) => { x.save(); x.translate(sx * p(28), p(20)); hop(p(7), p(15), p(3.4), '#8fa0b4'); vienSang(p(7), p(15), p(3.4), 0.35); x.restore(); });   // hai động cơ
    x.beginPath();                                                             // đuôi ngang
    x.moveTo(0, p(28)); x.lineTo(p(18), p(45)); x.lineTo(p(18), p(50)); x.lineTo(-p(18), p(50)); x.lineTo(-p(18), p(45)); x.closePath(); x.fillStyle = g; x.fill();
    x.beginPath();                                                             // thân
    x.moveTo(0, -p(54)); x.bezierCurveTo(p(10), -p(30), p(10), p(24), p(7), p(52));
    x.lineTo(-p(7), p(52)); x.bezierCurveTo(-p(10), p(24), -p(10), -p(30), 0, -p(54)); x.closePath(); x.fillStyle = g; x.fill();
    x.save(); x.translate(0, -p(38)); hop(p(11), p(15), p(5), kinh); x.restore();          // buồng lái
    x.save(); x.globalAlpha = 0.35; x.translate(0, p(4)); hop(p(2.4), p(70), p(1.2), '#ffffff'); x.restore();   // sọc sáng dọc sống lưng
  } else if (kind === 'tructhang') {
    bongGam(60, 96);
    hop(p(27), p(56), p(13), mau); vienSang(p(27), p(56), p(13), 0.4);         // thân bo tròn
    x.beginPath(); x.moveTo(-p(5), p(24)); x.lineTo(p(5), p(24)); x.lineTo(p(3.4), p(54)); x.lineTo(-p(3.4), p(54)); x.closePath(); x.fillStyle = dam; x.fill();  // cần đuôi
    x.save(); x.translate(0, p(50)); hop(p(4), p(12), p(2), toi); x.restore();             // cánh đứng đuôi
    x.save(); x.translate(0, -p(17)); hop(p(19), p(22), p(9), kinh); x.restore();          // kính buồng lái
    x.save(); x.globalAlpha = 0.22; x.translate(-p(5), -p(21)); x.rotate(-0.4); hop(p(5), p(14), p(2.5), '#ffffff'); x.restore();
    x.save(); x.rotate(el * 15);                                               // CÁNH QUẠT QUAY THẬT — thêm vệt mờ cho ra chuyển động
    x.beginPath(); x.arc(0, 0, p(46), 0, Math.PI * 2);
    x.strokeStyle = 'rgba(226,232,240,.16)'; x.lineWidth = p(9); x.stroke();
    x.strokeStyle = 'rgba(238,244,250,.62)'; x.lineWidth = p(3.6); x.lineCap = 'round';
    for (let i = 0; i < 4; i++) { x.save(); x.rotate((Math.PI / 2) * i); x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -p(46)); x.stroke(); x.restore(); }
    x.restore();
    x.beginPath(); x.arc(0, 0, p(5), 0, Math.PI * 2); x.fillStyle = '#0b1220'; x.fill();
    x.save(); x.translate(0, p(52)); x.rotate(el * 22);                        // cánh quạt đuôi
    x.strokeStyle = 'rgba(226,232,240,.5)'; x.lineWidth = p(2.6); x.beginPath(); x.moveTo(-p(11), 0); x.lineTo(p(11), 0); x.stroke(); x.restore();
  } else {                                                                     // NGƯỜI ĐI BỘ (nhìn từ trên: đầu + hai vai)
    bongGam(46, 52);
    x.save(); x.translate(0, p(7)); hop(p(34), p(38), p(15), mau); vienSang(p(34), p(38), p(15), 0.3); x.restore();   // vai/áo
    x.beginPath(); x.arc(0, -p(10), p(12.5), 0, Math.PI * 2); x.fillStyle = '#f0d2b0'; x.fill();        // đầu
    x.beginPath(); x.arc(0, -p(11.5), p(12), Math.PI * 1.05, Math.PI * 1.95); x.strokeStyle = '#20262f'; x.lineWidth = p(6.5); x.stroke();  // tóc
  }
  x.restore();
}

// ĐẦU MỖI BẢNG CÀI ĐẶT — một mẫu duy nhất cho cả 15 bảng: huy hiệu biểu tượng + tên bảng
// + một dòng nói bảng này làm gì + gạch phân cách. Trước đây mỗi bảng tự viết một kiểu nên
// nhìn như 15 người khác nhau làm.
function PanelHead({ icon, ten, goiY }: { icon: string; ten: string; goiY?: string }) {
  return (
    <div className="mb-1 flex items-start gap-2.5 pb-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,.07)' }}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[17px]" style={{ background: 'linear-gradient(160deg, rgba(200,161,75,.26), rgba(200,161,75,.05))', boxShadow: 'inset 0 0 0 1px rgba(200,161,75,.32)' }}>{icon}</span>
      <span className="min-w-0 flex-1 pt-0.5">
        <span className="block text-[13px] font-bold leading-tight" style={{ color: INK }}>{ten}</span>
        {goiY && <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">{goiY}</span>}
      </span>
    </div>
  );
}

// BỆ TRƯNG BÀY GHIM — ô vuông nền trời chiều, có lưới bản đồ mờ và bóng đổ dưới chân.
// Mọi ô trong bảng chọn dùng chung một bệ nên cả bảng nhìn đều tăm tắp như một bộ sưu tập,
// và con ghim màu gì cũng nổi lên rõ (nền tối làm nền, không tranh màu với ghim).
function PinStage({ children, size = 76 }: { children: any; size?: number }) {
  return (
    <span className="relative grid shrink-0 place-items-center overflow-hidden rounded-xl" style={{ width: size, height: size, background: 'radial-gradient(115% 85% at 50% 0%, #23486f 0%, #12283f 52%, #0a1727 100%)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.07)' }}>
      <span className="pointer-events-none absolute inset-0 opacity-[.14]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)', backgroundSize: '15px 15px' }} />
      <span className="pointer-events-none absolute bottom-[13%] h-[9px] w-[48%] rounded-full" style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,.62), rgba(0,0,0,0) 72%)' }} />
      <span className="relative leading-none">{children}</span>
    </span>
  );
}
// Ô XEM TRƯỚC con ghim — vẽ bằng đúng hàm dùng cho bản đồ nên nhìn sao thì trên bản đồ y vậy.
/**
 * ══ CHỈ VẼ Ô NÀO ĐANG NHÌN THẤY ══
 * Bảng chọn ghim có 20 kiểu × 29 tiện ích. Nếu ô nào cũng vẽ ngay thì một lần mở bảng là máy phải
 * dựng gần năm chục con ghim (mỗi con: vẽ canvas → đọc điểm ảnh → vẽ lại), cuộn cái là ĐƠ CỨNG —
 * đơ thật, tôi thử trên máy khoẻ vẫn treo tới mức không chụp nổi màn hình.
 * Chữa bằng hai việc rẻ tiền:
 *   1. Ô nào chưa lọt vào tầm mắt thì CHƯA VẼ (nhờ trình duyệt báo khi nó hiện ra).
 *   2. Vẽ xong thì NHỚ LẠI thành ảnh — cuộn qua cuộn lại chỉ dán ảnh cũ, không vẽ lần hai.
 */
const KHO_ANH_XEM_TRUOC = new Map<string, string>();

function PinPreview({ shape, color, icon, size = 44 }: { shape: string; color: string; icon: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [hienRa, setHienRa] = useState(false);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    if (typeof IntersectionObserver !== 'function') { setHienRa(true); return; }
    const theoDoi = new IntersectionObserver((ds) => { if (ds.some((v) => v.isIntersecting)) { setHienRa(true); theoDoi.disconnect(); } }, { rootMargin: '120px' });
    theoDoi.observe(c);
    return () => theoDoi.disconnect();
  }, []);
  useEffect(() => {
    if (!hienRa) return;
    const c = ref.current; if (!c) return; const x = c.getContext('2d'); if (!x) return;
    x.clearRect(0, 0, c.width, c.height);
    const khoa = shape + '|' + color + '|' + icon + '|' + size;
    const daCo = KHO_ANH_XEM_TRUOC.get(khoa);
    if (daCo) { const im = new Image(); im.onload = () => { try { x.clearRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0); } catch { /* ignore */ } }; im.src = daCo; return; }
    const nhoLai = () => { try { if (KHO_ANH_XEM_TRUOC.size < 600) KHO_ANH_XEM_TRUOC.set(khoa, c.toDataURL()); } catch { /* ignore */ } };
    setTimeout(nhoLai, 0);
    if (shape === 'radar') { // vòng sóng
      const cx = c.width / 2, cy = c.height / 2;
      [0.45, 0.75, 1].forEach((r, i) => { x.beginPath(); x.arc(cx, cy, r * 13, 0, Math.PI * 2); x.strokeStyle = color; x.globalAlpha = 0.8 - i * 0.25; x.lineWidth = 1.6; x.stroke(); });
      x.globalAlpha = 1; x.beginPath(); x.arc(cx, cy, 3.4, 0, Math.PI * 2); x.fillStyle = color; x.fill();
      return;
    }
    const im = makePinImage(shape, color, icon); if (!im) return;
    const tmp = document.createElement('canvas'); tmp.width = im.width; tmp.height = im.height;
    tmp.getContext('2d')?.putImageData(im, 0, 0);
    const r = Math.min(c.width / im.width, c.height / im.height) * 0.94;
    x.drawImage(tmp, (c.width - im.width * r) / 2, (c.height - im.height * r) / 2, im.width * r, im.height * r);
  }, [shape, color, icon, size, hienRa]);
  return <canvas ref={ref} width={size} height={Math.round(size * 1.14)} />;
}

// Ô XEM TRƯỚC 4 kiểu radar — chạy thật (quay/nở/thở) để nhìn là biết ngay kiểu nào.
function RadarPreview({ kind, color, size = 62 }: { kind: string; color: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return; const x = c.getContext('2d'); if (!x) return;
    let raf = 0; const t0 = gioHieuUng();
    const ve = () => {
      const t = (gioHieuUng() - t0) / 1000;
      const W = c.width, m = W / 2, R = m - 3;
      x.clearRect(0, 0, W, W);
      x.strokeStyle = hexA(color, 0.35); x.lineWidth = 1;
      [0.45, 0.72, 1].forEach((k) => { x.beginPath(); x.arc(m, m, R * k, 0, Math.PI * 2); x.stroke(); });
      if (kind === 'quetnan' || kind === 'cungxoay') {
        x.save(); x.translate(m, m); x.rotate((t * (kind === 'quetnan' ? 1.5 : 2.6)) % (Math.PI * 2)); x.translate(-m, -m);
        if (kind === 'quetnan') { const g = x.createLinearGradient(m, m - R, m, m); g.addColorStop(0, hexA(color, 0.55)); g.addColorStop(1, hexA(color, 0)); x.beginPath(); x.moveTo(m, m); x.arc(m, m, R, -Math.PI / 2 - 0.65, -Math.PI / 2); x.closePath(); x.fillStyle = g; x.fill(); x.beginPath(); x.moveTo(m, m); x.lineTo(m, m - R); x.strokeStyle = hexA(color, 0.9); x.lineWidth = 1.6; x.stroke(); }
        else { x.beginPath(); x.arc(m, m, R * 0.78, -Math.PI / 2 - 1.1, -Math.PI / 2); x.strokeStyle = hexA(color, 0.9); x.lineWidth = 3; x.lineCap = 'round'; x.stroke(); }
        x.restore();
      } else if (kind === 'quangtho') {
        const k = (Math.sin(t * 2.1) + 1) / 2;
        x.beginPath(); x.arc(m, m, R * (0.55 + 0.12 * k), 0, Math.PI * 2); x.fillStyle = hexA(color, 0.1 + 0.16 * k); x.fill();
        x.strokeStyle = hexA(color, 0.35 + 0.5 * k); x.lineWidth = 1.6; x.stroke();
      } else {
        [0, 1, 2].forEach((i) => { const ph = ((t * 0.6) + i / 3) % 1; x.beginPath(); x.arc(m, m, 3 + ph * (R - 3), 0, Math.PI * 2); x.strokeStyle = hexA(color, 0.75 * (1 - ph)); x.lineWidth = 1.6; x.stroke(); });
      }
      x.beginPath(); x.arc(m, m, 3.2, 0, Math.PI * 2); x.fillStyle = color; x.fill();
      raf = requestAnimationFrame(ve);
    };
    ve();
    return () => cancelAnimationFrame(raf);
  }, [kind, color, size]);
  return <canvas ref={ref} width={size} height={size} />;
}

// Ô XEM TRƯỚC kiểu thẻ chú thích — vẽ minh hoạ dây nối + khung chữ.
function CoPreview({ shape, col }: { shape: string; col: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return; const x = c.getContext('2d'); if (!x) return;
    let raf = 0; const t0 = gioHieuUng();
    const draw = () => {
      const t = (gioHieuUng() - t0) / 1000;
      const W = c.width, H = c.height;
      x.clearRect(0, 0, W, H); x.fillStyle = '#0d1b2a'; x.fillRect(0, 0, W, H);
      const A = [W * 0.16, H * 0.78], B = [W * 0.62, H * 0.3]; // điểm neo → thẻ
      x.strokeStyle = col; x.lineWidth = 1.6; x.lineCap = 'round'; x.lineJoin = 'round';
      x.setLineDash(shape === 'dashed' ? [4, 3] : []);
      x.lineDashOffset = shape === 'dashed' ? -(t * 14) % 7 : 0;
      x.beginPath();
      if (shape === 'curve') { x.moveTo(A[0], A[1]); x.quadraticCurveTo(A[0] + 6, B[1] - 4, B[0], B[1]); }
      else if (shape === 'underline' || shape === 'pill' || shape === 'wave') { x.moveTo(A[0], A[1]); x.lineTo(B[0], B[1]); }
      else { x.moveTo(A[0], A[1]); x.lineTo(A[0] + (B[0] - A[0]) * 0.45, B[1]); x.lineTo(B[0], B[1]); }
      x.stroke(); x.setLineDash([]);
      if (shape === 'wave') { for (let i = 0; i < 2; i++) { const ph = ((t * 0.8) + i / 2) % 1; x.beginPath(); x.arc(A[0], A[1], 3 + ph * 16, 0, Math.PI * 2); x.strokeStyle = col; x.globalAlpha = 0.7 * (1 - ph); x.stroke(); x.globalAlpha = 1; } }
      x.beginPath(); x.arc(A[0], A[1], 3.2, 0, Math.PI * 2); x.fillStyle = col; x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 1.4; x.stroke();
      // thẻ chữ
      x.font = '700 10px Arial, sans-serif'; const tx = 'DỰ ÁN', tw = x.measureText(tx).width;
      const bx = B[0] - 4, by = B[1] - 9, bw = tw + 14, bh = 18;
      x.strokeStyle = col; x.lineWidth = 1.4; x.fillStyle = 'rgba(10,37,64,.9)';
      if (shape === 'pill') { x.beginPath(); x.roundRect ? x.roundRect(bx, by, bw, bh, 9) : x.rect(bx, by, bw, bh); x.fill(); x.stroke(); }
      else if (shape === 'frame') { x.fillRect(bx, by, bw, bh); const L = 6; x.beginPath(); [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]].forEach(([cx, cy, sx, sy]) => { x.moveTo(cx + sx * L, cy); x.lineTo(cx, cy); x.lineTo(cx, cy + sy * L); }); x.stroke(); }
      else if (shape === 'bracket') { x.fillRect(bx, by, bw, bh); const L = 5; x.beginPath(); x.moveTo(bx + L, by); x.lineTo(bx, by); x.lineTo(bx, by + bh); x.lineTo(bx + L, by + bh); x.moveTo(bx + bw - L, by); x.lineTo(bx + bw, by); x.lineTo(bx + bw, by + bh); x.lineTo(bx + bw - L, by + bh); x.stroke(); }
      else if (shape === 'underline') { x.fillRect(bx, by, bw, bh); x.fillStyle = col; x.fillRect(bx, by + bh - 2, bw, 2); }
      else { x.fillRect(bx, by, bw, bh); x.strokeRect(bx, by, bw, bh); }
      x.fillStyle = '#ffe6a8'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(tx, bx + bw / 2, by + bh / 2 + 0.5);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [shape, col]);
  return <canvas ref={ref} width={190} height={92} className="w-full rounded-lg" />;
}

// Ô XEM TRƯỚC mẫu chữ — vẽ bằng ĐÚNG hàm dựng video nên "thấy sao, video ra vậy". Chạy lặp 2,6 giây.
function FxPreview({ anim, text = 'Tên Dự Án', size = 26 }: { anim: string; text?: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return; const ctx = c.getContext('2d'); if (!ctx) return;
    let raf = 0; const t0 = gioHieuUng();
    const loop = () => {
      const t = ((gioHieuUng() - t0) / 1000) % 2.6;
      const g = ctx.createLinearGradient(0, 0, 0, c.height); g.addColorStop(0, '#123047'); g.addColorStop(1, '#0b1826');
      ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      paintTextFx(ctx, text, c.width / 2, c.height / 2 + size * 0.36, size, 700, '#ffffff', anim, Math.min(1, t / 1.15));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [anim, text, size]);
  return <canvas ref={ref} width={210} height={70} className="w-full rounded-lg" />;
}

// ── VẼ MỘT DÒNG CHỮ CÓ KIỂU (dùng chung cho video xuất ra VÀ ô xem trước trong thư viện mẫu) ──
// anim = tên mẫu chữ, ap = tiến độ hiện chữ 0→1. Mọi kiểu đều vẽ bằng canvas nên xem trước = y hệt video.
/**
 * ══ KIỂU TÔ CHỮ ══
 * Trước giờ chữ tiêu đề chỉ tô MỘT MÀU phẳng rồi thêm bóng mềm cho dễ đọc. Chữ trong video của mấy
 * app dựng phim đẹp hơn là nhờ tô kiểu: vàng kim có chuyển sắc như kim loại, neon có quầng sáng,
 * kính mờ có tấm nền trong suốt phía sau. Đây là NHÓM KHÁC với 43 "cách chữ xuất hiện" đang có
 * (mờ dần, trượt lên, đánh máy…) — hai thứ chồng lên nhau được, nên 43 × 6 là số tổ hợp thật sự.
 */
const CHU_KIEU: { key: string; name: string; note: string }[] = [
  { key: 'thuong', name: 'Thường', note: 'Tô một màu, có bóng mềm — rõ ràng, hợp mọi nền' },
  { key: 'vangkim', name: 'Vàng kim', note: 'Chuyển sắc vàng như kim loại đánh bóng, viền tối mảnh' },
  { key: 'vang24k', name: 'Vàng 24K', note: 'Vàng đậm hơn, có quầng sáng vàng quanh chữ — sang, hợp dự án lớn' },
  { key: 'neon', name: 'Neon', note: 'Chữ sáng với quầng đèn toả ra — nổi bật trên nền tối' },
  { key: 'kinhmo', name: 'Thẻ kính mờ', note: 'Tấm kính trong mờ phía sau chữ — đọc rõ trên mọi ảnh nền' },
  { key: 'vienday', name: 'Viền dày trắng', note: 'Chữ có viền trắng dày bao quanh — kiểu bảng hiệu, đọc được từ xa' },
];

/** Áp kiểu tô lên chữ. Trả về màu tô cuối cùng (có thể là chuyển sắc). */
function apKieuToChu(ctx: CanvasRenderingContext2D, kieu: string, text: string, ax: number, y: number, w: number, size: number, color: any): any {
  if (!kieu || kieu === 'thuong') return color;
  if (kieu === 'vangkim' || kieu === 'vang24k') {
    const g = ctx.createLinearGradient(0, y - size, 0, y + size * 0.25);
    if (kieu === 'vangkim') { g.addColorStop(0, '#fff3c4'); g.addColorStop(0.42, '#e6c46a'); g.addColorStop(0.62, '#a67c25'); g.addColorStop(1, '#f0d68a'); }
    else { g.addColorStop(0, '#fff8d8'); g.addColorStop(0.35, '#ffd75e'); g.addColorStop(0.66, '#b8860b'); g.addColorStop(1, '#ffe9a3'); }
    if (kieu === 'vang24k') { ctx.save(); ctx.shadowColor = 'rgba(255,196,60,.75)'; ctx.shadowBlur = size * 0.5; ctx.fillStyle = '#c8a14b'; ctx.fillText(text, ax + w / 2 - w / 2, y); ctx.restore(); }
    ctx.save(); ctx.strokeStyle = 'rgba(60,40,6,.55)'; ctx.lineWidth = Math.max(1, size * 0.035); ctx.lineJoin = 'round'; ctx.strokeText(text, ax + w / 2 - w / 2, y); ctx.restore();
    return g;
  }
  if (kieu === 'neon') {
    ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = size * 0.62; ctx.fillStyle = color;
    ctx.fillText(text, ax + w / 2 - w / 2, y); ctx.fillText(text, ax + w / 2 - w / 2, y); ctx.restore();
    return '#ffffff';
  }
  if (kieu === 'kinhmo') {
    const padX = size * 0.42, padY = size * 0.3, bx = ax - padX, by = y - size - padY * 0.1, bw = w + padX * 2, bh = size + padY * 1.7;
    ctx.save(); ctx.shadowColor = 'rgba(4,10,20,.45)'; ctx.shadowBlur = size * 0.35; ctx.shadowOffsetY = size * 0.09;
    ctx.fillStyle = 'rgba(14,28,46,.42)'; roundRect(ctx, bx, by, bw, bh, size * 0.26); ctx.fill(); ctx.restore();
    ctx.save(); roundRect(ctx, bx, by, bw, bh, size * 0.26); ctx.clip();
    const gk = ctx.createLinearGradient(0, by, 0, by + bh);
    gk.addColorStop(0, 'rgba(255,255,255,.26)'); gk.addColorStop(0.55, 'rgba(255,255,255,.05)'); gk.addColorStop(1, 'rgba(255,255,255,.02)');
    ctx.fillStyle = gk; ctx.fillRect(bx, by, bw, bh); ctx.restore();
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = Math.max(1, size * 0.028);
    roundRect(ctx, bx, by, bw, bh, size * 0.26); ctx.stroke(); ctx.restore();
    return color;
  }
  if (kieu === 'vienday') {
    ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(3, size * 0.14); ctx.lineJoin = 'round';
    ctx.strokeText(text, ax + w / 2 - w / 2, y); ctx.restore();
    return color;
  }
  return color;
}

function paintTextFx(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, weight: number, color: string, anim: string, ap: number, fam = 'Arial, sans-serif', kieuTo = 'thuong') {
  if (!text) return;
  const _ap = anim === 'none' ? 1 : Math.max(0, Math.min(1, ap));
  const GOLD = '#C8A14B';
  if (anim === 'typewriter') text = text.slice(0, Math.max(1, Math.ceil(_ap * text.length)));
  ctx.font = `${weight} ${size}px ${fam}`;
  const w = ctx.measureText(text).width;
  const ax = ctx.textAlign === 'center' ? x - w / 2 : ctx.textAlign === 'right' ? x - w : x; // mép trái thật của chữ
  const cl = (v: number) => Math.max(0, Math.min(1, v));
  ctx.save();
  // ── chuyển động vào khung ──
  if (anim === 'zoomIn' || anim === 'stamp' || anim === 'bounce' || anim === 'rotate') {
    let sc = 1, rot = 0;
    if (anim === 'stamp') sc = 1 + (1 - _ap) * 0.7;
    else if (anim === 'zoomIn') sc = 0.82 + _ap * 0.18;
    else if (anim === 'bounce') { const b = 1 - Math.pow(1 - _ap, 3); sc = 0.6 + b * 0.4 + Math.sin(_ap * Math.PI) * 0.12; }
    else { sc = 0.9 + _ap * 0.1; rot = (1 - _ap) * -0.22; }
    ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc); ctx.translate(-x, -y);
  }
  // Rơi xuống rồi nảy nhẹ: đi quá đà một chút rồi lùi lại — kiểu chữ rơi trong phim quảng cáo.
  if (anim === 'dropIn') { const b = 1 - Math.pow(1 - _ap, 3); const nay = Math.sin(_ap * Math.PI * 1.6) * (1 - _ap) * size * 0.22; ctx.translate(0, -(1 - b) * size * 2.2 + nay); ctx.globalAlpha *= cl(_ap * 2); }
  // Lật quanh trục ngang như tấm biển xoay
  if (anim === 'flipX') { const sy = Math.max(0.04, Math.sin(cl(_ap) * Math.PI / 2)); ctx.translate(0, y); ctx.scale(1, sy); ctx.translate(0, -y); }
  // Giãn chữ ra từ hẹp — chữ như "thở" ra
  if (anim === 'expand') { const sx = 0.62 + 0.38 * (1 - Math.pow(1 - _ap, 3)); ctx.translate(x, 0); ctx.scale(sx, 1); ctx.translate(-x, 0); ctx.globalAlpha *= cl(_ap * 1.6); }
  // Lộ dần từ dưới lên (như chữ trồi lên khỏi mặt nước)
  if (anim === 'maskUp') { const hh = size * 1.8 * cl(_ap); ctx.beginPath(); ctx.rect(ax - size * 0.3, y + size * 0.4 - hh, w + size * 0.6, hh); ctx.clip(); }
  // Tách đôi ghép lại: nửa trên và nửa dưới trượt từ hai phía vào khớp nhau
  if (anim === 'splitIn') {
    const d = (1 - _ap) * size * 0.9;
    ctx.save(); ctx.beginPath(); ctx.rect(ax - size, y - size * 1.4, w + size * 2, size * 1.4 - size * 0.06); ctx.clip();
    ctx.translate(-d, 0); ctx.globalAlpha = cl(_ap * 1.4); ctx.fillStyle = color; ctx.fillText(text, x, y); ctx.restore();
    ctx.beginPath(); ctx.rect(ax - size, y - size * 0.06, w + size * 2, size * 1.4); ctx.clip(); ctx.translate(d, 0); ctx.globalAlpha *= cl(_ap * 1.4);
  }
  if (anim === 'wipe') { ctx.beginPath(); ctx.rect(ax - size * 0.25, y - size * 1.25, (w + size * 0.5) * _ap, size * 1.8); ctx.clip(); }
  if (anim === 'blur') ctx.filter = `blur(${(1 - _ap) * size * 0.18}px)`;
  // ── nền / khung sau chữ ──
  const padX = size * 0.42, padY = size * 0.3;
  if (anim === 'glass') {
    ctx.fillStyle = 'rgba(255,255,255,0.16)'; roundRect(ctx, ax - padX, y - size - padY * 0.2, w + padX * 2, size + padY * 2, size * 0.26); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = Math.max(1, size * 0.028); ctx.stroke();
  }
  if (anim === 'ribbon') { ctx.fillStyle = GOLD; roundRect(ctx, ax - padX, y - size - padY * 0.15, (w + padX * 2) * _ap, size + padY * 1.9, size * 0.12); ctx.fill(); }
  if (anim === 'boxLeft') { ctx.fillStyle = 'rgba(10,37,64,0.82)'; roundRect(ctx, ax - padX, y - size - padY * 0.15, w + padX * 2, size + padY * 1.9, size * 0.1); ctx.fill(); ctx.fillStyle = GOLD; ctx.fillRect(ax - padX, y - size - padY * 0.15, size * 0.14, (size + padY * 1.9)); }
  if (anim === 'darkgold') { ctx.fillStyle = 'rgba(6,12,20,0.86)'; roundRect(ctx, ax - padX, y - size - padY * 0.15, w + padX * 2, size + padY * 1.9, size * 0.16); ctx.fill(); ctx.strokeStyle = GOLD; ctx.lineWidth = Math.max(1, size * 0.05); ctx.stroke(); }
  if (anim === 'underline') { ctx.fillStyle = GOLD; ctx.fillRect(ax, y + size * 0.24, w * _ap, Math.max(2, size * 0.09)); }
  // Viên thuốc: bo tròn hết cỡ, nền tối, viền vàng mảnh
  if (anim === 'chip') {
    const bh = size + padY * 1.9, by = y - size - padY * 0.15;
    ctx.fillStyle = 'rgba(6,16,28,.74)'; roundRect(ctx, ax - padX, by, (w + padX * 2), bh, bh / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(200,161,75,.6)'; ctx.lineWidth = Math.max(1, size * 0.035); ctx.stroke();
  }
  // Dấu ngoặc kép lớn hai bên — kiểu trích dẫn tạp chí
  if (anim === 'quote') {
    ctx.save(); ctx.globalAlpha = 0.55 * _ap; ctx.fillStyle = GOLD; ctx.font = `800 ${size * 1.5}px Georgia, serif`;
    ctx.fillText('“', ax - size * 0.92, y + size * 0.08); ctx.fillText('”', ax + w + size * 0.06, y + size * 0.08);
    ctx.restore(); ctx.font = `${weight} ${size}px ${fam}`;
  }
  // Sọc chéo vàng chạy sau chữ
  if (anim === 'stripe') {
    ctx.save(); ctx.beginPath(); ctx.rect(ax - padX, y - size - padY * 0.15, (w + padX * 2) * _ap, size + padY * 1.9); ctx.clip();
    ctx.fillStyle = 'rgba(10,37,64,.8)'; ctx.fillRect(ax - padX, y - size - padY * 0.15, w + padX * 2, size + padY * 1.9);
    ctx.fillStyle = 'rgba(200,161,75,.32)';
    for (let sx = ax - padX - size * 2; sx < ax + w + padX; sx += size * 0.62) { ctx.beginPath(); ctx.moveTo(sx, y + size * 0.75); ctx.lineTo(sx + size * 0.5, y - size * 1.05); ctx.lineTo(sx + size * 0.66, y - size * 1.05); ctx.lineTo(sx + size * 0.16, y + size * 0.75); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  // Khung tối có vệt sáng quét ngang qua
  if (anim === 'boxShine') {
    const bh = size + padY * 1.9, by = y - size - padY * 0.15, bw = w + padX * 2;
    ctx.fillStyle = 'rgba(8,20,36,.82)'; roundRect(ctx, ax - padX, by, bw, bh, size * 0.16); ctx.fill();
    ctx.strokeStyle = 'rgba(200,161,75,.55)'; ctx.lineWidth = Math.max(1, size * 0.03); ctx.stroke();
    ctx.save(); roundRect(ctx, ax - padX, by, bw, bh, size * 0.16); ctx.clip();
    const p = _ap * 1.7 - 0.35, gx = ax - padX + bw * p;
    const gg = ctx.createLinearGradient(gx - bw * 0.18, 0, gx + bw * 0.18, 0);
    gg.addColorStop(0, 'rgba(255,255,255,0)'); gg.addColorStop(0.5, 'rgba(255,255,255,.22)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gg; ctx.fillRect(ax - padX, by, bw, bh); ctx.restore();
  }
  if (anim === 'bracket') { // ngoặc vuông hai bên
    const bw = size * 0.3, t = Math.max(2, size * 0.07); ctx.fillStyle = color;
    [ax - padX, ax + w + padX - bw].forEach((bx) => { ctx.fillRect(bx, y - size, bw, t); ctx.fillRect(bx, y + size * 0.28, bw, t); ctx.fillRect(bx === ax - padX ? bx : bx + bw - t, y - size, t, size * 1.35); });
  }
  if (anim === 'neon') { ctx.shadowColor = color; ctx.shadowBlur = size * 0.6; }
  if (anim === 'fire') { ctx.shadowColor = '#ff7a18'; ctx.shadowBlur = size * 0.55; }
  // ── màu chữ ──
  let fill: string | CanvasGradient = anim === 'ribbon' ? '#0A2540' : color;
  if (anim === 'gold' || anim === 'gold24') {
    const g = ctx.createLinearGradient(0, y - size, 0, y + size * 0.28);
    if (anim === 'gold24') { g.addColorStop(0, '#fff8d0'); g.addColorStop(0.4, '#ffd257'); g.addColorStop(0.62, '#b57e18'); g.addColorStop(1, '#ffe08a'); }
    else { g.addColorStop(0, '#fff3bd'); g.addColorStop(0.45, '#eccb70'); g.addColorStop(0.56, '#C8A14B'); g.addColorStop(1, '#8a6a1f'); }
    fill = g;
  }
  if (anim === 'silver') { const g = ctx.createLinearGradient(0, y - size, 0, y + size * 0.28); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#c7d2dd'); g.addColorStop(0.58, '#8a97a5'); g.addColorStop(1, '#e8eef4'); fill = g; }
  if (anim === 'fire') { const g = ctx.createLinearGradient(0, y - size, 0, y + size * 0.3); g.addColorStop(0, '#fff1a8'); g.addColorStop(0.45, '#ff9d2e'); g.addColorStop(1, '#e0341c'); fill = g; }
  if (anim === 'ocean') { const g = ctx.createLinearGradient(ax, 0, ax + w, 0); g.addColorStop(0, '#7dd3fc'); g.addColorStop(0.5, '#38bdf8'); g.addColorStop(1, '#2563eb'); fill = g; }
  if (anim === 'chrome') { const g = ctx.createLinearGradient(0, y - size, 0, y + size * 0.3); g.addColorStop(0, '#ffffff'); g.addColorStop(0.34, '#d7e3ee'); g.addColorStop(0.5, '#6f8296'); g.addColorStop(0.56, '#c9d7e4'); g.addColorStop(1, '#ffffff'); fill = g; }
  if (anim === 'sunset') { const g = ctx.createLinearGradient(ax, y - size, ax + w, y + size * 0.3); g.addColorStop(0, '#ffd166'); g.addColorStop(0.45, '#fb7185'); g.addColorStop(1, '#a855f7'); fill = g; }
  if (anim === 'emerald') { const g = ctx.createLinearGradient(0, y - size, 0, y + size * 0.3); g.addColorStop(0, '#d1fae5'); g.addColorStop(0.45, '#34d399'); g.addColorStop(1, '#047857'); fill = g; }
  if (anim === 'holo') { const g = ctx.createLinearGradient(ax, 0, ax + w, 0); g.addColorStop(0, '#a5f3fc'); g.addColorStop(0.3, '#c4b5fd'); g.addColorStop(0.6, '#f9a8d4'); g.addColorStop(1, '#a5f3fc'); fill = g; ctx.shadowColor = 'rgba(180,220,255,.55)'; ctx.shadowBlur = size * 0.3; }
  if (anim === 'goldline') {
    const g = ctx.createLinearGradient(0, y - size, 0, y + size * 0.28); g.addColorStop(0, '#fff3bd'); g.addColorStop(0.5, '#e0bd68'); g.addColorStop(1, '#8a6a1f'); fill = g;
    ctx.fillStyle = GOLD; ctx.fillRect(ax, y + size * 0.26, w * _ap, Math.max(1.5, size * 0.05)); ctx.fillRect(ax, y + size * 0.38, w * _ap * 0.55, Math.max(1.5, size * 0.045));
  }
  if (anim === 'shine') { const p = _ap * 1.6 - 0.3; const g = ctx.createLinearGradient(ax, 0, ax + w, 0); g.addColorStop(0, color); g.addColorStop(cl(p - 0.14), color); g.addColorStop(cl(p), '#ffffff'); g.addColorStop(cl(p + 0.14), color); g.addColorStop(1, color); fill = g; }
  // ── chữ nổi khối / viền ──
  if (anim === 'emboss') { ctx.fillStyle = 'rgba(0,0,0,0.55)'; for (let i = 1; i <= Math.max(2, size * 0.09); i++) ctx.fillText(text, x + i, y + i); }
  if (anim === 'outline') { ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, size * 0.045); ctx.lineJoin = 'round'; ctx.strokeText(text, x, y); ctx.restore(); return; }
  if (anim === 'flash') { const on = _ap >= 1 || Math.sin(_ap * 34) > -0.3; if (!on) { ctx.restore(); return; } }
  // Trắng viền đậm kiểu bìa tạp chí: viền đen dày vẽ trước, chữ trắng đè lên
  if (anim === 'ink') { ctx.strokeStyle = 'rgba(6,12,20,.92)'; ctx.lineWidth = Math.max(3, size * 0.16); ctx.lineJoin = 'round'; ctx.strokeText(text, x, y); fill = '#ffffff'; }
  // Nhiễu số: hai bản lệch màu đỏ / lam rung nhẹ, hết hiệu ứng thì biến mất
  if (anim === 'glitch' && _ap < 1) {
    const d = (1 - _ap) * size * 0.16, r = Math.sin(_ap * 47) * d;
    ctx.save(); ctx.globalAlpha = 0.75; ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#ff2d55'; ctx.fillText(text, x - d - r, y);
    ctx.fillStyle = '#22d3ee'; ctx.fillText(text, x + d + r, y);
    ctx.restore();
  }
  // Kiểu tô (vàng kim / neon / kính mờ…) vẽ phần nền và viền của nó, rồi trả lại màu tô cho chữ chính.
  const toCuoi = apKieuToChu(ctx, kieuTo, text, ax, y, w, size, fill);
  ctx.fillStyle = toCuoi as any;
  if (anim === 'neon' || anim === 'fire') ctx.fillText(text, x, y); // vẽ 2 lượt cho quầng sáng đậm
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Vẽ chữ + logo lên video theo MẪU BỐ CỤC chọn. Mọi kích thước nhân hệ số k=H/1080 để 720p vẫn cân đối.
// ══════════ THẺ THƯƠNG HIỆU (dấu logo đóng lên video) ══════════
// Bản miễn phí luôn giữ thẻ này. Trước chỉ có MỘT kiểu dán vào mọi cảnh; giờ có 8 kiểu để
// thẻ hợp tông với từng video — cảnh sáng dùng thẻ đặc, cảnh tối dùng thẻ viền, cảnh cần kín đáo
// thì dùng dấu chìm. Kiểu "Viên thuốc" là kiểu đang dùng, giữ nguyên làm mặc định.
const LOGO_TEXT = 'CAM LÂM LAND';
const LOGO_SUB = 'batdongsancamlam.vn';
const LOGO_STYLES: { key: string; name: string; note: string }[] = [
  { key: 'vienthuoc', name: 'Viên thuốc', note: 'Nền tối bo tròn, chấm vàng — hợp mọi cảnh' },
  { key: 'vangdac', name: 'Vàng đặc', note: 'Nền vàng chữ xanh đêm — nổi nhất trên cảnh sáng' },
  { key: 'vienmanh', name: 'Viền mảnh', note: 'Chỉ có viền vàng, nhìn xuyên qua thấy bản đồ' },
  { key: 'kinhmo', name: 'Kính mờ', note: 'Nền trắng mờ như kính — nhẹ và sang' },
  { key: 'chutron', name: 'Chữ trơn', note: 'Không khung, chữ vàng có bóng — kín đáo' },
  { key: 'hailong', name: 'Hai dòng', note: 'Tên thương hiệu kèm địa chỉ web bên dưới' },
  { key: 'ruybang', name: 'Ruy băng', note: 'Thẻ vát góc, sọc vàng — kiểu bảng hiệu' },
  { key: 'dongdau', name: 'Dấu chìm', note: 'Chữ to mờ chìm vào ảnh, gần như không che cảnh' },
];
// Đo trước bề ngang / bề cao của thẻ để còn biết đặt nó vào góc nào cho vừa.
function badgeSize(ctx: CanvasRenderingContext2D, style: string, k: number): { w: number; h: number } {
  const px = (n: number) => n * k;
  ctx.font = `800 ${px(34)}px Arial, sans-serif`;
  const tw = ctx.measureText(LOGO_TEXT).width;
  if (style === 'chutron') return { w: tw + px(6), h: px(46) };
  if (style === 'dongdau') { ctx.font = `800 ${px(48)}px Arial, sans-serif`; return { w: ctx.measureText(LOGO_TEXT).width + px(6), h: px(62) }; }
  if (style === 'hailong') { ctx.font = `600 ${px(20)}px Arial, sans-serif`; const sw = ctx.measureText(LOGO_SUB).width; return { w: Math.max(tw, sw) + px(58), h: px(86) }; }
  if (style === 'ruybang') return { w: tw + px(62), h: px(64) };
  return { w: tw + px(52), h: px(62) };
}
// Vẽ thẻ, góc trên-trái của thẻ đặt tại (x, y).
function drawBadge(ctx: CanvasRenderingContext2D, style: string, x: number, y: number, k: number) {
  const px = (n: number) => n * k;
  const GOLD = '#C8A14B', NAVY = '#0A2540';
  const s = badgeSize(ctx, style, k);
  ctx.save();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const bongVao = () => { ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = px(18); ctx.shadowOffsetY = px(4); };
  const bongRa = () => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; };
  if (style === 'chutron') {
    ctx.font = `800 ${px(34)}px Arial, sans-serif`;
    ctx.shadowColor = 'rgba(2,8,18,.7)'; ctx.shadowBlur = px(16); ctx.shadowOffsetY = px(3);
    ctx.fillStyle = GOLD; ctx.fillText(LOGO_TEXT, x + px(3), y + px(33));
  } else if (style === 'dongdau') {
    ctx.font = `800 ${px(48)}px Arial, sans-serif`;
    ctx.globalAlpha = 0.3; ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = px(10);
    ctx.fillStyle = '#ffffff'; ctx.fillText(LOGO_TEXT, x + px(3), y + px(46));
    ctx.globalAlpha = 1; bongRa();
    ctx.strokeStyle = 'rgba(200,161,75,.5)'; ctx.lineWidth = Math.max(1, px(2));
    ctx.beginPath(); ctx.moveTo(x + px(3), y + px(58)); ctx.lineTo(x + s.w - px(3), y + px(58)); ctx.stroke();
  } else if (style === 'vangdac') {
    bongVao();
    const g = ctx.createLinearGradient(x, y, x, y + s.h); g.addColorStop(0, '#e6c988'); g.addColorStop(1, GOLD);
    ctx.fillStyle = g; roundRect(ctx, x, y, s.w, s.h, s.h / 2); ctx.fill(); bongRa();
    ctx.font = `800 ${px(34)}px Arial, sans-serif`; ctx.fillStyle = NAVY; ctx.fillText(LOGO_TEXT, x + px(26), y + px(42));
  } else if (style === 'vienmanh') {
    ctx.strokeStyle = GOLD; ctx.lineWidth = Math.max(1, px(2.4)); roundRect(ctx, x, y, s.w, s.h, s.h / 2); ctx.stroke();
    ctx.font = `800 ${px(34)}px Arial, sans-serif`;
    ctx.shadowColor = 'rgba(2,8,18,.6)'; ctx.shadowBlur = px(12);
    ctx.fillStyle = GOLD; ctx.fillText(LOGO_TEXT, x + px(26), y + px(42));
  } else if (style === 'kinhmo') {
    bongVao();
    ctx.fillStyle = 'rgba(255,255,255,.16)'; roundRect(ctx, x, y, s.w, s.h, px(16)); ctx.fill(); bongRa();
    ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = Math.max(1, px(1.6)); roundRect(ctx, x, y, s.w, s.h, px(16)); ctx.stroke();
    ctx.font = `800 ${px(34)}px Arial, sans-serif`; ctx.fillStyle = '#ffffff'; ctx.fillText(LOGO_TEXT, x + px(26), y + px(42));
  } else if (style === 'hailong') {
    bongVao();
    const g = ctx.createLinearGradient(x, y, x, y + s.h); g.addColorStop(0, 'rgba(14,34,58,.88)'); g.addColorStop(1, 'rgba(6,18,32,.88)');
    ctx.fillStyle = g; roundRect(ctx, x, y, s.w, s.h, px(16)); ctx.fill(); bongRa();
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = Math.max(1, px(1.5)); roundRect(ctx, x, y, s.w, s.h, px(16)); ctx.stroke();
    ctx.fillStyle = GOLD; roundRect(ctx, x + px(16), y + px(18), px(5), s.h - px(36), px(3)); ctx.fill();
    ctx.font = `800 ${px(32)}px Arial, sans-serif`; ctx.fillStyle = GOLD; ctx.fillText(LOGO_TEXT, x + px(34), y + px(40));
    ctx.font = `600 ${px(20)}px Arial, sans-serif`; ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.fillText(LOGO_SUB, x + px(34), y + px(68));
  } else if (style === 'ruybang') {
    bongVao();
    const vat = px(18);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s.w, y); ctx.lineTo(x + s.w - vat, y + s.h / 2); ctx.lineTo(x + s.w, y + s.h); ctx.lineTo(x, y + s.h); ctx.closePath();
    ctx.fillStyle = 'rgba(8,22,38,.86)'; ctx.fill(); bongRa();
    ctx.fillStyle = GOLD; ctx.fillRect(x, y, px(7), s.h);
    ctx.font = `800 ${px(34)}px Arial, sans-serif`; ctx.fillStyle = '#ffffff'; ctx.fillText(LOGO_TEXT, x + px(26), y + px(43));
  } else {   // vienthuoc — kiểu đang dùng, giữ nguyên
    bongVao();
    ctx.fillStyle = 'rgba(6,16,28,.70)'; roundRect(ctx, x, y, s.w, s.h, s.h / 2); ctx.fill(); bongRa();
    ctx.strokeStyle = 'rgba(200,161,75,.55)'; ctx.lineWidth = Math.max(1, px(1.6)); roundRect(ctx, x, y, s.w, s.h, s.h / 2); ctx.stroke();
    ctx.font = `800 ${px(34)}px Arial, sans-serif`; ctx.fillStyle = GOLD; ctx.fillText(LOGO_TEXT, x + px(26), y + px(42));
  }
  ctx.restore();
}
// Ô xem trước một kiểu thẻ — vẽ bằng ĐÚNG hàm dùng cho video nên nhìn sao thì video ra vậy.
function LogoBadge({ style, cao = 30 }: { style: string; cao?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [kt, setKt] = useState({ w: 200, h: 44 });
  useEffect(() => {
    const c = ref.current; if (!c) return; const g = c.getContext('2d'); if (!g) return;
    const k = cao / 62;                                  // 62 = chiều cao thẻ chuẩn khi k = 1
    const s = badgeSize(g, style, k);
    const W = Math.ceil(s.w + 10), H = Math.ceil(s.h + 10);
    if (kt.w !== W || kt.h !== H) { setKt({ w: W, h: H }); return; }
    c.width = W * 2; c.height = H * 2;
    g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, W, H);
    drawBadge(g, style, 5, 5, k);
  }, [style, cao, kt.w, kt.h]);
  return <canvas ref={ref} style={{ width: kt.w, height: kt.h, display: 'block' }} />;
}

function drawOverlay(ctx: CanvasRenderingContext2D, W: number, H: number, layout: Layout, title: string, sub: string, logo: boolean, anim = 'fade', ap = 1, lStyle = 'vienthuoc', lPos = 'auto', kieuTo = 'thuong') {
  const GOLD = '#C8A14B', NAVY = 'rgba(10,37,64,'; const k = Math.min(W, H) / 1080;
  const px = (n: number) => Math.round(n * k);
  // DẢI TỐI DƯỚI CHỮ — trước đây là một dải chuyển sắc thẳng nên nhìn thấy rõ "mép" cắt ngang khung hình.
  // Giờ chia 5 chặng theo đường cong (đậm dần chậm ở trên, nhanh ở dưới) → tan vào ảnh, không thấy mép.
  const grad = (y0: number, y1: number, a: number) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    [[0, 0], [0.35, 0.1], [0.6, 0.28], [0.82, 0.6], [1, 1]].forEach(([p, m]) => g.addColorStop(p, NAVY + (a * m).toFixed(3) + ')'));
    return g;
  };
  // Chữ trên ảnh vệ tinh sáng rất dễ bị "chìm". Đổ một lớp bóng mềm phía sau là đọc được ở mọi nền.
  const bongChu = (bat: boolean) => { if (bat) { ctx.shadowColor = 'rgba(2,8,18,.62)'; ctx.shadowBlur = px(26); ctx.shadowOffsetY = px(5); } else { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; } };
  // GẠCH VÀNG — nét mảnh chạy dài dần theo chữ. Chi tiết nhỏ này là thứ phân biệt bản tin truyền hình
  // với chữ dán tạm lên ảnh: nó cho con chữ một cái "chân" để đứng.
  const gachVang = (x: number, y: number, dai: number, giua = false) => {
    const w = Math.max(px(10), dai * _ap);
    ctx.save(); bongChu(false); ctx.fillStyle = GOLD;
    roundRect(ctx, giua ? x - w / 2 : x, y, w, px(5), px(3)); ctx.fill(); ctx.restore();
  };
  // Đặt thẻ thương hiệu. Người dùng chọn góc nào thì theo góc đó; để "tự động" thì đặt theo bố cục chữ
  // sao cho thẻ không đè lên tiêu đề.
  const drawLogo = (tuDongX: number, tuDongY: number) => {
    if (!logo) return;
    const sz = badgeSize(ctx, lStyle, k), mg = px(48);
    const p = lPos === 'tt' ? { x: mg, y: mg }
      : lPos === 'tp' ? { x: W - sz.w - mg, y: mg }
      : lPos === 'dt' ? { x: mg, y: H - sz.h - mg }
      : lPos === 'dp' ? { x: W - sz.w - mg, y: H - sz.h - mg }
      : { x: tuDongX, y: tuDongY };
    drawBadge(ctx, lStyle, p.x, p.y, k);
    ctx.textAlign = 'left';
  };
  const logoW = () => badgeSize(ctx, lStyle, k).w;
  ctx.textBaseline = 'alphabetic';
  if (!title && !sub) { if (logo) drawLogo(W - logoW() - px(48), px(48)); ctx.textAlign = 'left'; return; } // chữ đang ẩn (ngoài clip) → chỉ thẻ thương hiệu
  // HIỆU ỨNG CHỮ XUẤT HIỆN
  const _ap = anim === 'none' ? 1 : Math.max(0, Math.min(1, ap));
  if (anim === 'typewriter' && title) title = title.slice(0, Math.max(1, Math.ceil(_ap * title.length)));
  const paintFx = (text: string, x: number, y: number, size: number, weight: number, color: string) => paintTextFx(ctx, text, x, y, size, weight, color, anim, _ap, 'Arial, sans-serif', kieuTo);
  ctx.save();
  if (anim !== 'none') { ctx.globalAlpha = anim === 'wipe' ? 1 : _ap; if (anim === 'slideUp') ctx.translate(0, (1 - _ap) * px(36)); if (anim === 'slideLeft') ctx.translate(-(1 - _ap) * px(90), 0); }
  if (layout === 'bottomCenter') {
    ctx.fillStyle = grad(H - px(400), H, 0.9); ctx.fillRect(0, H - px(400), W, px(400));
    ctx.textAlign = 'center';
    if (title) gachVang(W / 2, H - px(186), px(120), true);
    bongChu(true); paintFx(title, W / 2, H - px(120), px(70), 700, '#fff'); bongChu(false);
    paintFx(sub, W / 2, H - px(60), px(42), 600, GOLD);
    drawLogo(W / 2 - logoW() / 2, px(48));
  } else if (layout === 'topLeft') {
    const g = ctx.createLinearGradient(0, 0, 0, px(340));
    [[0, 0.9], [0.45, 0.42], [0.75, 0.12], [1, 0]].forEach(([p, m]) => g.addColorStop(p, NAVY + m + ')'));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, px(340));
    ctx.textAlign = 'left';
    if (title) gachVang(px(70), px(58), px(110));
    bongChu(true); paintFx(title, px(70), px(126), px(64), 700, '#fff'); bongChu(false);
    paintFx(sub, px(70), px(184), px(40), 600, GOLD);
    drawLogo(W - logoW() - px(48), H - px(120));
  } else if (layout === 'card') {
    ctx.textAlign = 'left'; ctx.font = `700 ${px(60)}px Arial, sans-serif`; const tw = title ? ctx.measureText(title).width : 0; ctx.font = `600 ${px(40)}px Arial, sans-serif`; const sw = sub ? ctx.measureText(sub).width : 0;
    const cardW = Math.max(tw, sw) + px(96), cardH = (title ? px(78) : 0) + (sub ? px(56) : 0) + px(48); const cx = px(64), cy = H - cardH - px(64);
    // Thẻ chữ: nền chuyển sắc + viền tóc + bóng đổ sâu → nổi hẳn lên khỏi ảnh vệ tinh thay vì dán bẹt
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = px(40); ctx.shadowOffsetY = px(12);
    const cg = ctx.createLinearGradient(cx, cy, cx, cy + cardH); cg.addColorStop(0, 'rgba(14,34,58,.86)'); cg.addColorStop(1, 'rgba(6,18,32,.86)');
    ctx.fillStyle = cg; roundRect(ctx, cx, cy, cardW, cardH, px(22)); ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = Math.max(1, px(1.6)); roundRect(ctx, cx, cy, cardW, cardH, px(22)); ctx.stroke();
    ctx.fillStyle = GOLD; roundRect(ctx, cx + px(18), cy + px(20), px(6), cardH - px(40), px(3)); ctx.fill();
    let yy = cy + px(34);
    if (title) { yy += px(60); bongChu(true); paintFx(title, cx + px(40), yy, px(60), 700, '#fff'); bongChu(false); }
    if (sub) { yy += px(54); paintFx(sub, cx + px(40), yy, px(40), 600, GOLD); }
    drawLogo(W - logoW() - px(48), px(48));
  } else { // bottomLeft (mặc định)
    ctx.fillStyle = grad(H - px(380), H, 0.9); ctx.fillRect(0, H - px(380), W, px(380));
    ctx.textAlign = 'left';
    if (title) gachVang(px(70), H - px(196), px(110));
    bongChu(true); paintFx(title, px(70), H - px(130), px(64), 700, '#fff'); bongChu(false);
    paintFx(sub, px(70), H - px(70), px(40), 600, GOLD);
    drawLogo(W - logoW() - px(48), px(48));
  }
  ctx.restore();
  ctx.textAlign = 'left';
}
