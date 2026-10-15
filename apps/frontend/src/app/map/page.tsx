'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ocrImage, uploadImages, thumbUrl } from '@/lib/api';
import type { GeoLayer, ImageOverlay, BaseMap, MeasureMode, MeasureResult, TuyenVe } from '@/components/MapView';
import { GisLayer, formatVnd } from '@/lib/types';
import { vn2000ToWgs84, wgs84ToVn2000 } from '@/lib/vn2000';
import { openPhieuQh, phieuQhHtml } from '@/lib/phieuQh';
import { getToken } from '@/lib/token';
import { API_BASE } from '@/lib/config';
import { useAuth, laAdmin, coVaiTro, coGoiChung } from '@/lib/auth';
import HopTraPhi from '@/components/HopTraPhi';
import { listMyPlaces, listAllPlaces, addPlace, removePlace, type SavedPlace } from '@/lib/savedPlaces';
import { listCustomers, listInterests, addInterest, removeInterest, type Customer, type Interest } from '@/lib/crm';
import { Skeleton } from '@/components/ui';
import type { Diem } from '@/components/ChiDuongPanel';
import { useDayCotNutBanDo } from '@/lib/cotNutBanDo';

// Bỏ dấu tiếng Việt để gõ tìm không cần dấu: gõ "cam lam" vẫn ra "Cam Lâm".
const boDauVn = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

// Ô CHỌN CÓ GÕ TÌM — nhìn như ô sổ xuống bình thường, nhưng bấm vào là gõ tìm được ngay
// (gõ không dấu cũng ra). Dùng cho ô chọn huyện/TP cũ và ô chọn xã/phường.
// Đặt NGOÀI trang chính: nếu để bên trong, mỗi lần trang vẽ lại thì ô này bị dựng lại từ đầu
// và con trỏ đang gõ sẽ nhảy ra ngoài.
function OChonCoGo({ nhan, dsMuc, giaTri, khiChon, className, dienThoai = false, oRef, khiXong }: {
  nhan: string;
  dsMuc: { id: string; ten: string; phu?: string }[];
  giaTri: string;
  khiChon: (id: string) => void;
  className?: string;
  // BÀN PHÍM (11/10/2026): oRef = cho trang chính đặt con trỏ vào ô này; khiXong = chọn xong (bằng phím hoặc chuột) thì
  // làm gì tiếp — thường là đặt con trỏ sang ô kế (huyện → xã → số thửa) để gõ liền một mạch, khỏi cầm chuột.
  oRef?: (el: HTMLInputElement | null) => void;
  khiXong?: () => void;
  // dienThoai: bảng đáy Tra cứu trên điện thoại — chữ 16px (iPhone tự PHÓNG TO cả trang khi bấm ô chữ
  // nhỏ hơn 16px) và danh sách SỔ LÊN TRÊN (bảng nằm sát bàn phím, sổ xuống là bị bàn phím che mất).
  dienThoai?: boolean;
}) {
  const [go, setGo] = useState('');
  const [daGo, setDaGo] = useState(false);   // đã bắt đầu gõ hay chưa (chưa gõ thì sổ ĐỦ danh sách)
  const [mo, setMo] = useState(false);
  const [chiSo, setChiSo] = useState(-1);   // dòng đang được tô (đi bằng phím ↑↓); -1 = chưa tô dòng nào
  const boc = useRef<HTMLDivElement>(null);
  const dongDangChon = useRef<HTMLButtonElement>(null);
  const dongTo = useRef<HTMLButtonElement>(null);

  const dong = () => { setMo(false); setGo(''); setDaGo(false); setChiSo(-1); };
  // Điện thoại: danh sách vẽ TÁCH RA body (portal) và đặt `fixed` ngay TRÊN ô đang gõ. Để trong bảng
  // đáy thì khung bảng (cuộn được) CẮT MẤT danh sách, chỉ còn thấy 1 dòng (chủ dự án chụp 14/9/2026).
  const dsRef = useRef<HTMLDivElement>(null);
  const [viTri, setViTri] = useState<{ left: number; width: number; bottom: number; maxH: number } | null>(null);
  useEffect(() => {
    if (!dienThoai || !mo) return;
    const tinh = () => {
      const r = oNhap.current?.getBoundingClientRect(); if (!r) return;
      const vv = window.visualViewport;
      const dinhNhin = vv ? vv.offsetTop : 0;
      setViTri({ left: r.left, width: r.width, bottom: window.innerHeight - r.top + 4, maxH: Math.max(120, Math.min(300, r.top - dinhNhin - 10)) });
    };
    tinh();
    window.visualViewport?.addEventListener('resize', tinh); window.visualViewport?.addEventListener('scroll', tinh);
    const t = setInterval(tinh, 250);   // bảng đáy đang trượt theo bàn phím thì ô cũng đổi chỗ
    return () => { window.visualViewport?.removeEventListener('resize', tinh); window.visualViewport?.removeEventListener('scroll', tinh); clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dienThoai, mo]);
  useEffect(() => {
    const bamRaNgoai = (e: MouseEvent) => { if (boc.current && !boc.current.contains(e.target as Node) && !(dsRef.current && dsRef.current.contains(e.target as Node))) dong(); };
    document.addEventListener('mousedown', bamRaNgoai);
    return () => document.removeEventListener('mousedown', bamRaNgoai);
  }, []);
  // Mở ra là cuộn thẳng tới xã đang chọn, khỏi phải lăn chuột tìm giữa cả trăm dòng.
  useEffect(() => { if (mo && dongDangChon.current) dongDangChon.current.scrollIntoView({ block: 'center' }); }, [mo]);

  const dangChon = dsMuc.find((m) => m.id === giaTri)?.ten || '';
  // HAI CÁCH DÙNG: (1) bấm vào rồi lăn chọn trong danh sách đầy đủ — ô vẫn hiện xã đang chọn;
  //                (2) gõ tên để lọc nhanh — gõ chữ đầu tiên là danh sách rút gọn lại ngay.
  const q = daGo ? boDauVn(go.trim()) : '';
  const loc = q ? dsMuc.filter((m) => boDauVn(m.ten).includes(q) || (m.phu ? boDauVn(m.phu).includes(q) : false)) : dsMuc;
  const oNhap = useRef<HTMLInputElement>(null);
  // Chọn xong thì nhả con trỏ ra khỏi ô, nếu không lần bấm sau sẽ không mở lại được danh sách
  // (vì ô vẫn đang được chọn nên trình duyệt không báo "vừa bấm vào ô" nữa).
  const chon = (id: string) => { khiChon(id); dong(); oNhap.current?.blur(); if (khiXong && !dienThoai) setTimeout(khiXong, 0); };
  // Dòng đang tô luôn nằm trong tầm nhìn khi đi bằng phím ↑↓
  useEffect(() => { if (mo && chiSo >= 0) dongTo.current?.scrollIntoView({ block: 'nearest' }); }, [mo, chiSo]);
  const moRa = () => { setMo(true); setDaGo(false); setChiSo(dsMuc.findIndex((m) => m.id === giaTri)); };

  return (
    <div ref={boc} className={`relative ${className || ''}`}>
      {/* Có CẢ onFocus lẫn onClick: bấm lần đầu thì onFocus lo, còn khi con trỏ đã sẵn trong ô
          (vừa chọn xong) thì trình duyệt không báo "vừa bấm vào ô" nữa nên phải nhờ onClick. */}
      <input
        ref={(el) => { (oNhap as any).current = el; oRef?.(el); }}
        value={daGo ? go : dangChon}
        placeholder={nhan}
        onFocus={(e) => { moRa(); e.currentTarget.select(); }}
        onClick={(e) => { if (!mo) moRa(); e.currentTarget.select(); }}
        onChange={(e) => { setGo(e.target.value); setDaGo(true); setMo(true); setChiSo(e.target.value.trim() ? 0 : -1); }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;   // bộ gõ tiếng Việt đang ghép chữ — chưa phải phím thật
          const n = loc.length;
          if (e.key === 'ArrowDown') { e.preventDefault(); if (!mo) { moRa(); return; } setChiSo((i) => (n ? Math.min(n - 1, i + 1) : -1)); return; }
          if (e.key === 'ArrowUp') { e.preventDefault(); if (!mo) { moRa(); return; } setChiSo((i) => (n ? Math.max(0, i - 1) : -1)); return; }
          if (e.key === 'Enter') {
            e.preventDefault();
            if (!mo) { moRa(); return; }
            if (n) chon(loc[chiSo >= 0 && chiSo < n ? chiSo : 0].id);
            return;
          }
          // Tab: đã gõ để lọc (hoặc đã đi phím tới một dòng) thì NHẬN dòng đó rồi để con trỏ đi tiếp như thường
          if (e.key === 'Tab' && mo && n && (daGo || chiSo >= 0)) { const id = loc[chiSo >= 0 && chiSo < n ? chiSo : 0].id; khiChon(id); dong(); if (khiXong && !dienThoai && !e.shiftKey) { e.preventDefault(); setTimeout(khiXong, 0); } return; }
          if (e.key === 'Tab') { dong(); return; }
          // Esc: đang sổ danh sách thì chỉ ĐÓNG DANH SÁCH (preventDefault báo cho trang chính đừng đóng cả khung tìm)
          if (e.key === 'Escape' && mo) { e.preventDefault(); dong(); }
        }}
        className={`border rounded-lg pl-2.5 pr-6 w-full bg-white truncate ${dienThoai ? 'py-2 text-[16px]' : 'py-1.5 text-xs'} ${giaTri ? 'border-[#0A2540] font-semibold text-[#0A2540]' : 'border-slate-300'}`} />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[9px]">▼</span>
      {mo && (() => {
        const ds = (
          <div ref={dsRef}
            style={dienThoai && viTri ? { position: 'fixed', left: viTri.left, width: viTri.width, bottom: viTri.bottom, maxHeight: viTri.maxH, zIndex: 90 } : undefined}
            className={`bg-white border border-slate-200 rounded-lg shadow-xl overflow-y-auto scroll-soft ${dienThoai ? '' : 'absolute left-0 right-0 z-50 top-full mt-1 max-h-60'}`}>
            {giaTri && (
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => chon('')}
                className={`w-full text-left px-2.5 text-slate-400 hover:bg-slate-50 border-b border-slate-100 sticky top-0 bg-white ${dienThoai ? 'py-2 text-[13px]' : 'py-1.5 text-[11px]'}`}>— Bỏ chọn —</button>
            )}
            {loc.length === 0 && <div className={`px-2.5 py-2 text-slate-400 ${dienThoai ? 'text-[13px]' : 'text-[11px]'}`}>Không tìm thấy</div>}
            {loc.map((m, i) => (
              <button key={m.id} type="button" ref={i === chiSo ? dongTo : (m.id === giaTri ? dongDangChon : undefined)}
                onMouseDown={(e) => e.preventDefault()} onClick={() => chon(m.id)} onMouseEnter={() => setChiSo(i)}
                className={`w-full text-left px-2.5 hover:bg-slate-50 border-b last:border-b-0 border-slate-100 ${dienThoai ? 'py-2' : 'py-1.5'} ${i === chiSo ? '!bg-slate-100' : m.id === giaTri ? 'bg-amber-50' : ''}`}>
                <span className={`block truncate ${dienThoai ? 'text-[14px]' : 'text-xs'} ${m.id === giaTri ? 'font-bold text-[#0A2540]' : 'font-medium text-slate-800'}`}>
                  {m.id === giaTri ? '✓ ' : ''}{m.ten}
                </span>
                {m.phu && <span className={`block text-slate-400 truncate ${dienThoai ? 'text-[11.5px]' : 'text-[10px]'}`}>{m.phu}</span>}
              </button>
            ))}
          </div>
        );
        return dienThoai ? (viTri ? createPortal(ds, document.body) : null) : ds;
      })()}
    </div>
  );
}

// Ô CHỌN BẰNG BẢNG DANH SÁCH — CHỈ ĐIỆN THOẠI (học theo app, chủ dự án yêu cầu 14/9/2026).
// KHÔNG CHO GÕ: bấm vào ô là bật bảng "Chọn …" phủ màn hình, chạm một dòng là chọn xong → bàn phím
// không bao giờ bật lên (gõ tìm xã trên điện thoại làm bàn phím đẩy cả trang, rất rối).
// Bảng vẽ tách ra body (portal) nên không bị khung bảng Tra cứu cắt mất.
function OChonBang({ nhan, tieuDe, dsMuc, giaTri, khiChon }: {
  nhan: string; tieuDe: string;
  dsMuc: { id: string; ten: string; phu?: string }[];
  giaTri: string; khiChon: (id: string) => void;
}) {
  const [mo, setMo] = useState(false);
  const dongChon = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (mo) requestAnimationFrame(() => dongChon.current?.scrollIntoView({ block: 'center' })); }, [mo]);
  const ten = dsMuc.find((m) => m.id === giaTri)?.ten || '';
  return (
    <>
      <button type="button" onClick={() => { (document.activeElement as HTMLElement | null)?.blur(); setMo(true); }}
        // KÉO HẾT DÒNG, cao 34px — bằng đúng ô Số thửa / Số tờ bên dưới cho các ô thẳng hàng (chủ dự án 15/9/2026:
        // "các ô tra cứu chưa đều nhau"; trước rộng vừa chữ nên dài ngắn lởm chởm). Mũi tên ▼ dạt về mép phải.
        className={`flex h-[34px] w-full items-center gap-2 rounded-lg border bg-white px-2.5 text-left text-[15px] ${giaTri ? 'border-slate-300 font-medium text-[#0A2540]' : 'border-slate-300 text-slate-400'}`}>
        <span className="min-w-0 flex-1 truncate">{ten || nhan}</span><span className="shrink-0 text-[10px] text-slate-400">▼</span>
      </button>
      {mo && createPortal(
        <div className="fixed inset-0 z-[95] flex flex-col justify-end bg-black/40 px-3 pb-[calc(12px+env(safe-area-inset-bottom))]" onClick={() => setMo(false)}>
          <div className="max-h-[70dvh] overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onClick={(e) => e.stopPropagation()}>
            <p className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-4 py-3 text-center text-[13px] text-slate-400 backdrop-blur">{tieuDe}</p>
            {dsMuc.length === 0 && <p className="px-4 py-4 text-center text-[14px] text-slate-400">Chưa có mục nào để chọn</p>}
            {dsMuc.map((m) => (
              <button key={m.id} type="button" ref={m.id === giaTri ? dongChon : undefined}
                onClick={() => { khiChon(m.id); setMo(false); }}
                className={`relative block w-full border-b border-slate-100 px-10 py-3 text-center last:border-b-0 active:bg-slate-100 ${m.id === giaTri ? 'bg-amber-50/60' : ''}`}>
                {m.id === giaTri && <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-[#C8A14B]">✓</span>}
                <span className={`block truncate text-[16px] ${m.id === giaTri ? 'font-semibold text-[#0A2540]' : 'text-[#0A2540]'}`}>{m.ten}</span>
                {m.phu && <span className="block truncate text-[11.5px] text-slate-400">{m.phu}</span>}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setMo(false)} className="mt-2 w-full rounded-2xl bg-white py-3 text-[16px] font-semibold text-[#0A2540] shadow-2xl active:bg-slate-100">Đóng</button>
        </div>, document.body)}
    </>
  );
}

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false, loading: () => <div className="grid h-full w-full place-items-center bg-slate-100 text-slate-400"><div className="flex flex-col items-center gap-3"><svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.5" /></svg><span className="text-sm">Đang tải bản đồ…</span></div></div> });

const ChiDuongPanel = dynamic(() => import('@/components/ChiDuongPanel'), { ssr: false });

const DEFAULT_COLORS: Record<string, string> = {
  parcel: '#1e88e5', zoning: '#fb8c00', admin: '#7e57c2', road: '#455a64', custom: '#16a34a',
};
const RASTER_OVERLAYS = [
  { id: 'qh-qd205', name: 'Ảnh quy hoạch QĐ205', url: '/overlays/QD205.png',
    // Dùng TILE PNG RỜI (đuôi .png) → Cloudflare tự cache ở biên, mở quy hoạch cực nhanh trên điện thoại.
    // (Trước dùng pmtiles 147MB range-request động, không cache được, self-host còn phải tải runtime.)
    // Bộ tile render từ DGN (QD205) → z10-18, ĐẦY ĐỦ mọi zone.
    // minzoom = ĐÚNG mức thấp nhất đã cắt (bộ này bắt đầu từ z12). Khai 10 như trước là thừa:
    // ở mức 10–11 trình duyệt đi đòi những ô không hề tồn tại, lần nào cũng nhận 404.
    // minzoom 10: 14/9/2026 dựng bù ô ảnh mức 11 (9 ô) + mức 10 (4 ô) bằng cách GHÉP 4 ô mức dưới rồi thu
    // nhỏ (bộ gốc chỉ có từ mức 12) — để lùi bản đồ ra xa vẫn thấy quy hoạch. Chỉ thêm file, không đụng ô cũ.
    // "?v=2" (15/9/2026): ĐỔI ĐỊA CHỈ để điện thoại + Cloudflare bỏ qua câu trả lời "không có ô" đã lỡ nhớ 1 năm
    // từ hồi chưa cắt bù mức 10–11 (xem map $cache_anh trong nginx/nginx.conf). Đổi bộ ảnh sau này thì tăng số.
    tiles: ['/tiles/qd205v11/{z}/{x}/{y}.png?v=7'], minzoom: 10, maxzoom: 18,
    // "?v=7" (10/10/2026, mức 16 dải cây xanh chép theo CHU KỲ hoa văn dọc đường cong đo từ 2 nét — hết gãy) · "?v=6" (mức 13–16 chép dải + mặt nước trượt theo đường cong đo tại chính mức đó) · "?v=5" (mức 15 dải cây xanh theo đường cong chuẩn, bỏ mảng xanh đặc) · "?v=4" (sửa lại mức 11–16 cho dải cây xanh đúng đường cong) · "?v=3": xoá vòng tròn xanh có chấm đen (ký hiệu quên xoá trước khi xuất tile) ở 18 ô z10–18 quanh
    // 109.16972, 12.05229 — ô gốc sao lưu ở backup/tile-qd205v11-truoc-xoa-vong-tron-2026-10-10. Nhớ đổi cả lib/phieuQh.ts.
    coordinates: [[108.9401268, 12.217594], [109.2563886, 12.217594], [109.2563886, 11.9257021], [108.9401268, 11.9257021]] as [[number, number], [number, number], [number, number], [number, number]] },
  // ⚠️ MÀU BẢN ĐỒ QUY HOẠCH LẤY ĐÚNG TỪ BẢN VẼ — ĐỌC KỸ TRƯỚC KHI ĐỔI (13/9/2026)
  // Bốn bộ tile phân khu (qd2076v21 · qd2101v22 · qd2222v22 · qd918v18) dùng BẢNG MÀU AUTOCAD.
  // Đã thử bảng MicroStation (chủ dự án tự xuất ra từ Settings → Color Table) nhưng đối chiếu
  // với bản vẽ mở bằng MicroStation thì bảng AutoCAD vẽ ĐÚNG HƠN — nên giữ AutoCAD.
  // Muốn thử lại bảng khác: python 9-doi-bang-mau.py <vao.geojson> <ra.geojson> <tên-bảng>
  // (dữ liệu đã ghi sẵn SỐ HIỆU MÀU nên đổi bảng chỉ mất vài giây, khỏi đọc lại DXF).
  //
  // ⚠️ THỨ TỰ VẼ: MẢNG TO VẼ TRƯỚC, MẢNG NHỎ VẼ SAU. Ảnh tile vẽ theo đúng thứ tự trong file
  // nên mảng nào nằm cuối là nằm trên cùng. Bản vẽ CAD KHÔNG xếp theo diện tích: QĐ2222 có
  // mảng rừng 1.046 ha ở vị trí 492/531, QĐ918 có mảng 932 ha ở vị trí 319/454 — vẽ gần cuối
  // nên trùm kín các ô đất chi tiết vẽ trước (chủ dự án phát hiện "có vài chỗ màu bị đè").
  // 1b-doc-dxf.py nay tự sắp theo diện tích giảm dần trước khi ghi file.
  //
  // ⚠️ HAI VIỆC NỮA ĐÃ LÀM CHO BỘ v10/v7/v11/v11 (13/9/2026):
  // 1. LỚP HIỆN TRẠNG NẰM DƯỚI LỚP QUY HOẠCH. Sắp mỗi theo diện tích thì một mảnh hiện trạng
  //    nhỏ vẫn đè lên ô đất quy hoạch bên dưới nó — mà người xem cần thấy phần QUY HOẠCH.
  //    Nay xếp BA BẬC: (0) hiện trạng HT_* nằm dưới · (1) khối quy hoạch QH2030_/QH2045_/
  //    QHDD_/QHDH_ ở giữa · (2) phần CHIA NHỎ CHI TIẾT bên trong khối (level DAT_*) nằm trên.
  //    Trong mỗi bậc: mảng to vẽ trước. Đo trên QĐ2076 có tới 16,7% diện tích bị hai ô đất
  //    chồng nhau đúng kiểu 'DAT_O_Nhomnhao Thaptang' nằm trong 'QH2045_DAT_DVO moiTB' —
  //    sắp mỗi theo diện tích thì khối lớn vẽ sau trùm kín cả khu chi tiết.
  // 2. LÀM TƯƠI MÀU mà GIỮ NGUYÊN TÔNG. Bảng AutoCAD có rất nhiều màu ở mức tối 15-30% (vẽ để
  //    xem trên nền đen của MicroStation), đưa lên nền vệ tinh thì thành mảng nâu-đen.
  //    Bảng `bang-mau/autocad-tuoi.tbl` kéo độ sáng theo đường cong L^0.72: màu tối sáng lên
  //    hẳn, màu sáng gần như không đổi, tông màu (hue) giữ nguyên nên vẫn đúng bản vẽ.
  //    Đất ở #a57c00→#e2aa00 · cây xanh #52a500→#70e200 · mặt nước #0052a5→#0070e2.
  //
  // Vì sao quan trọng: bản vẽ CAD không ghi màu thật, nó chỉ ghi SỐ HIỆU MÀU (1–255), muốn
  // biết số đó là màu gì phải tra bảng màu. AutoCAD và MicroStation có bảng KHÁC NHAU, mà bản
  // vẽ này vẽ bằng MicroStation. Cùng số hiệu 42 (đất ở): MicroStation ra vàng nhạt #ffdf7f,
  // AutoCAD ra nâu xỉn #a57c00. Tra nhầm bảng là cả bản đồ lệch màu so với bản vẽ được duyệt,
  // mà KHÔNG có lỗi nào báo ra.
  // Bảng đúng: scripts/qh-pipeline/bang-mau/mau-microstation.tbl — chính chủ dự án xuất ra từ
  // MicroStation (Settings → Color Table → Save As) ngày 13/9/2026. Đối chiếu: trùng 255/256 ô
  // với acadcolor.tbl (bảng MicroStation dùng khi mở file DWG/DXF), chỉ khác ô 0 là màu nền.
  // Dựng lại bằng:  python 1b-doc-dxf.py <ban-ve.dxf> <ra.geojson> --bang=mau-microstation
  //
  // ĐÃ THỬ VÀ ĐÃ BỎ: từng tô lại theo LOẠI ĐẤT bằng bộ màu tự đặt cho tươi hơn
  // (scripts/qh-pipeline/7-to-mau-loai-dat.py). Nhìn thì đẹp nhưng chủ dự án đối chiếu với
  // MicroStation và app tra cứu thì lệch — bản đồ quy hoạch phải giống bản vẽ được duyệt,
  // không được làm đẹp theo ý mình. Script vẫn để lại nhưng KHÔNG dùng trong quy trình.
  //
  // Cắt từ z8 (trước là z12) để thu nhỏ nhìn cả huyện vẫn thấy quy hoạch.
  // Đổi tên thư mục mỗi lần cắt lại là BẮT BUỘC: nginx đặt /tiles/ là "immutable, 1 năm".
  // ⚠️ BA BỘ TILE DƯỚI ĐÂY (qd2076v4 · qd2101v5 · qd2222v5) DỰNG TỪ BỘ ĐỌC DXF MỚI
  // (scripts/qh-pipeline/1b-doc-dxf.py). Bộ cũ đi qua ogr2ogr và LÀM RƠI mọi level có tên
  // tiếng Việt có dấu — riêng QĐ2076 mất 416/2.064 vùng tô (20%), QĐ2101 mất cả level
  // 'QHDD_mặt nước sử dụng công cộng_DVO'. Hậu quả: thửa có 1.084 m² là mặt nước mà web báo
  // "nằm ngoài phạm vi quy hoạch". Đừng quay lại dùng ogr2ogr cho khâu này.
  // Bản v4/v5 còn sửa thêm lỗi MÀU THEO LỚP (BYLAYER): bộ đọc mới lúc đầu không hỏi màu của level
  // nên 2.027/2.225 vùng của QĐ2076 và 404/670 vùng của QĐ2222 ra TRẮNG XOÁ.
  // ── QĐ2076 · quy hoạch phân khu PHÍA BẮC 1/2000 ────────────────────────────────────
  // Dựng từ chính file CAD gốc: DGN V8 → DXF → rút 1.792 vùng đất kèm MÀU GỐC trong bản vẽ
  // → cắt tile z12–17. Trong một bản vẽ có nhiều nhóm (QH2030, QH2045, HT, QHDD) nhưng đo
  // hình học thấy chúng KHÔNG đè nhau chút nào — là phân kỳ thời gian thực hiện, ghép cạnh
  // nhau thành một bản đồ liền, nên gộp chung một lớp.
  // Bản "v2" = ĐÃ CÓ LỚP NÉT. Bản v1 chỉ có vùng tô nên thiếu hẳn mạng lưới đường: riêng QĐ2076
  // có 1.792 vùng nhưng tới 48.411 nét (chỉ giới đường đỏ, lề đường, ranh phân khu). Bỏ nét đi thì
  // nhìn chỉ thấy mấy mảng màu rời rạc, khác hẳn lúc mở file CAD gốc.
  { id: 'qh-qd2076', name: 'Quy hoạch phân khu phía Bắc QĐ2076 (1/2000)', url: '',
    tiles: ['/tiles/qd2076v21/{z}/{x}/{y}.png'], minzoom: 8, maxzoom: 18,
    coordinates: [[109.0288, 12.2004], [109.2513, 12.2004], [109.2513, 12.0527], [109.0288, 12.0527]] as [[number, number], [number, number], [number, number], [number, number]] },
  // ── QĐ2101 · quy hoạch phân khu trung tâm 1/2000 ────────────────────────────────────
  // Bản "v3" sửa hai lỗi của v2:
  //   1. v2 vẽ kèm cả lớp KÝ HIỆU của bản vẽ CAD → mỗi ô đất bị đóng một vòng tròn đen
  //      (ký hiệu lô đất), mà chữ bên trong thì không xuất được → chỉ còn vòng tròn vô nghĩa
  //      phủ kín bản đồ. v3 chỉ vẽ VÙNG TÔ + NÉT, bỏ hẳn ký hiệu.
  //   2. v2 vẽ cả những gì nằm NGOÀI ranh giới lập quy hoạch: ô chú giải (mảng sọc màu lơ lửng
  //      giữa đầm Thuỷ Triều) và mạng đường/ký hiệu lan ra vùng Cam Đức — nhìn thành "vùng này
  //      có đường có ký hiệu mà thiếu ô đất". v3 cắt sạch theo ranh giới (bước
  //      scripts/qh-pipeline/4-cat-theo-ranh.py).
  // ĐỔI TÊN THƯ MỤC (v2 → v3) LÀ BẮT BUỘC, không được ghi đè lên chỗ cũ: nginx đặt
  // /tiles/ là `immutable, max-age=1 năm` nên trình duyệt và Cloudflare sẽ giữ nguyên ảnh cũ
  // cả năm, sửa xong mà người dùng vẫn thấy y như trước.
  { id: 'qh-qd2101', name: 'Quy hoạch phân khu trung tâm QĐ2101 (1/2000)', url: '',
    tiles: ['/tiles/qd2101v22/{z}/{x}/{y}.png'], minzoom: 8, maxzoom: 18,
    coordinates: [[109.1187, 12.0793], [109.2041, 12.0793], [109.2041, 11.99], [109.1187, 11.99]] as [[number, number], [number, number], [number, number], [number, number]] },
  // ── QĐ2222 · quy hoạch 1/2000 ──────────────────────────────────────────────────────
  // Bản "v3" sửa lỗi "mảng xám" của v2: v2 được cắt từ bản dữ liệu CŨ, lúc đó một số ô đất
  // chưa dò ra màu trong bản vẽ nên bị tô màu XÁM MẶC ĐỊNH (#9aa0a6) — nhìn như bản đồ hỏng.
  // Trong đó 71% mảng xám thật ra là Ô CHÚ GIẢI của tờ vẽ, nằm lơ lửng ngoài biển; phần còn
  // lại là mấy ô đất giữa bản đồ mà dữ liệu mới đã có màu đúng (Đất du lịch, Cây xanh).
  // v3 cắt lại từ dữ liệu mới + cắt theo ranh giới lập quy hoạch (bỏ ô chú giải và sơ đồ đảo
  // vẽ kèm ngoài biển) + bỏ lớp ký hiệu. Xem scripts/qh-pipeline/README.md bước 2b/2c.
  // Khung bao thu hẹp theo đúng ranh giới thật: trước ghi vươn ra tận 109.33 chỉ vì ô chú giải
  // nằm ngoài đó, chứ quy hoạch không hề trải tới chỗ ấy.
  { id: 'qh-qd2222', name: 'Quy hoạch QĐ2222 (1/2000)', url: '',
    tiles: ['/tiles/qd2222v22/{z}/{x}/{y}.png'], minzoom: 8, maxzoom: 18,
    coordinates: [[109.1630, 12.1505], [109.2237, 12.1505], [109.2237, 12.0258], [109.1630, 12.0258]] as [[number, number], [number, number], [number, number], [number, number]] },
  // ── QĐ918 · quy hoạch phân khu PHỨC HỢP PHÍA TÂY 1/2000 ────────────────────────────
  // Bản gốc là DGN V8, không công cụ nào trên máy đọc nổi; chủ dự án xuất ra DXF rồi mới nạp được.
  { id: 'qh-qd918', name: 'Quy hoạch phân khu phức hợp phía Tây QĐ918 (1/2000)', url: '',
    tiles: ['/tiles/qd918v18/{z}/{x}/{y}.png'], minzoom: 8, maxzoom: 18,
    coordinates: [[109.0372, 12.1265], [109.1454, 12.1265], [109.1454, 11.9569], [109.0372, 11.9569]] as [[number, number], [number, number], [number, number], [number, number]] },
  // ── Phân khu CÙ HIN 1/2000 (nạp 14/9/2026, chưa có số quyết định) ───────────────────
  // Bản gốc: quyhoach2025/phân khu cù hin 1.2000.dxf. Nằm phía Bắc, ôm sát đầu Bắc của QĐ2076.
  // Dựng đúng quy trình + bảng màu của bốn bản trên (mốc moc-mau-4-phan-khu-v1) nên cùng loại
  // đất là cùng màu. Bản vẽ có HAI vòng ranh 1.250 điểm (ranh thật + sơ đồ vị trí thu nhỏ) và
  // level 'gop y So nganh' (khung ghi chú thẩm định) — xem 4-cat-theo-ranh.py / 1b-doc-dxf.py.
  { id: 'qh-cuhin', name: 'Quy hoạch phân khu Cù Hin (1/2000)', url: '',
    tiles: ['/tiles/qdcuhinv1/{z}/{x}/{y}.png'], minzoom: 8, maxzoom: 18,
    coordinates: [[109.0323, 12.2142], [109.1698, 12.2142], [109.1698, 12.1189], [109.0323, 12.1189]] as [[number, number], [number, number], [number, number], [number, number]] },
  // ── Phân khu TÂY NAM 1/2000 (nạp 14/9/2026) ──────────────────────────────────────────
  // Bản gốc: quyhoach2025/Tay Nam da sua - ban cuoi.dxf. Cùng quy trình + bảng màu với 5 bản trên
  // (25/27 loại đất trùng màu; Đất chưa sử dụng + Đồi núi chỉ bản này có). Chồng ~7% lên QĐ918 ở
  // rìa phía Tây — đặt SAU QĐ918 nên chỗ chồng hiện theo Tây Nam (bản mới hơn).
  // Bản vẽ có HAI vòng ranh 2.529 điểm (một vòng là bản sao dịch sang kinh độ 108,6) và một vùng
  // tô sọc phủ kín trên level ranh giới — xem 4-cat-theo-ranh.py / 1b-doc-dxf.py.
  { id: 'qh-taynam', name: 'Quy hoạch phân khu Tây Nam (1/2000)', url: '',
    tiles: ['/tiles/qdtaynamv1/{z}/{x}/{y}.png'], minzoom: 8, maxzoom: 18,
    coordinates: [[108.9930, 12.1849], [109.1219, 12.1849], [109.1219, 11.9366], [108.9930, 11.9366]] as [[number, number], [number, number], [number, number], [number, number]] },
  // ── Phân khu TÂY BẮC 1/2000 (nạp 14/9/2026) ──────────────────────────────────────────
  // Bản gốc: quyhoach2025/1-2000 Phan khu Tay Bac.dxf. Bản vẽ KHÔNG có ranh lập quy hoạch và không
  // có ô chú giải (chỉ có phần đất) nên không cắt theo ranh. Không chồng phân khu nào (chạm Tây
  // Nam 0,1%). Ép màu: Đất rừng đặc dụng #093748 (gần đen, 9.374 ha) → #2a7e7e; 2 ô level
  // DAT_O_Honhop_Nhomo tô lạ màu → #cc4619 như 6 bản kia (xem mau-sua-rieng.json).
  { id: 'qh-taybac', name: 'Quy hoạch phân khu Tây Bắc (1/2000)', url: '',
    tiles: ['/tiles/qdtaybacv1/{z}/{x}/{y}.png'], minzoom: 8, maxzoom: 18,
    coordinates: [[108.9401, 12.1926], [109.0834, 12.1926], [109.0834, 12.0522], [108.9401, 12.0522]] as [[number, number], [number, number], [number, number], [number, number]] },
  // ── QĐ893 · quy hoạch SỬ DỤNG ĐẤT đến 2030, phủ TOÀN huyện Cam Lâm cũ ───────
  // Bản này KHÔNG cần lớp nét: nó vốn là các mảng tô kín (nông nghiệp, đất ở, giao thông, mặt
  // nước) chứ không phải bản vẽ nét như ba bản 1/2000 ở trên.
  { id: 'qh-qd893', name: 'Quy hoạch sử dụng đất QĐ893 (đến 2030)', url: '',
    tiles: ['/tiles/qd893v1/{z}/{x}/{y}.png?v=3'], minzoom: 8, maxzoom: 18,   // ?v=3 (15/10/2026): vá 242 ô THỦNG (vùng tô hỏng viền của bản vẽ — điện mặt trời Cam An, đất quốc phòng Cam Hòa…; scratchpad va_lo_thung.py, sao lưu D:\KhoQH\sao-luu\qd893v1-truoc-va-thung-15-10) — đổi số để trình duyệt / Cloudflare tải ô mới   // ?v=2: như QĐ205 — bỏ "không có ô" đã nhớ từ trước ngày cắt bù   // đã cắt bù thêm z8–11 (12/9/2026) để thu nhỏ vẫn thấy
    coordinates: [[108.9335, 12.2239], [109.2624, 12.2239], [109.2624, 11.9328], [108.9335, 11.9328]] as [[number, number], [number, number], [number, number], [number, number]] },
  // ── NINH HÒA · QUY HOẠCH SỬ DỤNG ĐẤT đến 2030 (thị xã Ninh Hòa) ─────────────────────
  // Dựng 13/10/2026 từ bản đồ PDF CHÍNH THỨC của Sở NN&MT Khánh Hòa (bản vẽ NÉT VECTOR, tỉ lệ
  // 1:25.000, không phải ảnh scan). Nắn toạ độ theo LƯỚI KM VN-2000 in sẵn trên bản vẽ (số lưới
  // 4 cạnh, khớp bình phương tối thiểu R²=1,0, đúng 113,37 pt/km = khít tỉ lệ) → đổi sang WGS84
  // bằng đúng công thức lib/vn2000.ts nên trùng khít lớp Cam Lâm + địa chính. Cắt gọn theo ranh
  // thị xã lấy từ chính vùng màu của bản đồ (bỏ chú giải/sơ đồ vị trí/chữ ký ở góc).
  // ⚠️ ĐÂY LÀ BẢN XEM THỬ: mới có ẢNH tile, CHƯA tách lớp vector loại đất, CHƯA tính trên từng thửa
  //    (phần tính quy hoạch theo thửa QĐ205/893 hiện chỉ cho huyện Cam Lâm cũ).
  // Quy trình dựng: scripts ở scratchpad quy-hoach-tinh (nan.py khớp lưới, tiler2.py cắt tile).
  // 14/10/2026: MỌI lớp QHSDĐ 2030 + 1/500 cắt lại bằng scripts/qh-tinh/tiler3.py — ô ảnh 512 điểm (WebP) mà vẫn khai
  // tileSize 256 → nét GẤP ĐÔI trên điện thoại (chủ dự án chê bản cũ "mờ, không thấy được"); mỗi mức phóng vẽ lại thẳng
  // từ PDF nên mức xa không còn lấm tấm; thêm mức 17 (mức xem thửa). Bộ cũ (…v1, ninhhoa2030v2, PNG 256) đã xoá.
  { id: 'qh-ninhhoa2030', name: 'QHSDĐ 2030 thị xã Ninh Hòa', url: '',
    tiles: ['/tiles/ninhhoa2030v3/{z}/{x}/{y}.webp'], minzoom: 9, maxzoom: 17,
    coordinates: [[108.868, 12.755], [109.345, 12.755], [109.345, 12.341], [108.868, 12.341]] as [[number, number], [number, number], [number, number], [number, number]] },
  // ── CẢ TỈNH · QHSDĐ 2030 từ PDF chính thức Sở NN&MT (cùng cách Ninh Hòa: nắn theo lưới km, cắt
  //    theo ranh lấy từ vùng màu bản đồ). Tính quy hoạch theo thửa: bảng qh_pdf (máy chủ lib/qhPdf.ts), chỉ tham khảo.
  { id: 'qh-nhatrang2030', name: 'QHSDĐ 2030 TP Nha Trang', url: '',
    tiles: ['/tiles/nhatrang2030v2/{z}/{x}/{y}.webp'], minzoom: 9, maxzoom: 17,
    coordinates: [[109.109, 12.379], [109.244, 12.379], [109.244, 12.136], [109.109, 12.136]] as [[number, number], [number, number], [number, number], [number, number]] },
  { id: 'qh-khanhson2030', name: 'QHSDĐ 2030 huyện Khánh Sơn', url: '',
    tiles: ['/tiles/khanhson2030v2/{z}/{x}/{y}.webp'], minzoom: 9, maxzoom: 17,
    coordinates: [[108.781, 12.162], [109.008, 12.162], [109.008, 11.914], [108.781, 11.914]] as [[number, number], [number, number], [number, number], [number, number]] },
  { id: 'qh-vanninh2030', name: 'QHSDĐ 2030 huyện Vạn Ninh', url: '',
    tiles: ['/tiles/vanninh2030v2/{z}/{x}/{y}.webp'], minzoom: 9, maxzoom: 17,
    coordinates: [[109.083, 12.871], [109.471, 12.871], [109.471, 12.536], [109.083, 12.536]] as [[number, number], [number, number], [number, number], [number, number]] },
  // Cam Ranh: nhãn lưới vẽ thành nét (không đọc được chữ) → nắn bằng cách đọc tay 1 nhãn rồi dò ĐƯỜNG LƯỚI
  // trong nét vector (tránh nước biển cùng màu cyan). Khớp R²=1,0, 113,38 pt/km. Xem scripts/qh-tinh/README.md.
  { id: 'qh-camranh2030', name: 'QHSDĐ 2030 TP Cam Ranh', url: '',
    tiles: ['/tiles/camranh2030v2/{z}/{x}/{y}.webp'], minzoom: 9, maxzoom: 17,
    coordinates: [[108.989, 12.032], [109.286, 12.032], [109.286, 11.801], [108.989, 11.801]] as [[number, number], [number, number], [number, number], [number, number]] },
  // Diên Khánh + Khánh Vĩnh (14/10/2026): lưới km in KHÔNG đều → nắn THEO TỪNG Ô LƯỚI ("luoi" trong nan/<pdf>.nan.json).
  { id: 'qh-dienkhanh2030', name: 'QHSDĐ 2030 huyện Diên Khánh', url: '',
    tiles: ['/tiles/dienkhanh2030v2/{z}/{x}/{y}.webp'], minzoom: 9, maxzoom: 17,
    coordinates: [[108.931, 12.397], [109.144, 12.397], [109.144, 12.164], [108.931, 12.164]] as [[number, number], [number, number], [number, number], [number, number]] },
  { id: 'qh-khanhvinh2030', name: 'QHSDĐ 2030 huyện Khánh Vĩnh', url: '',
    tiles: ['/tiles/khanhvinh2030v2/{z}/{x}/{y}.webp'], minzoom: 9, maxzoom: 17,
    coordinates: [[108.668, 12.515], [109.069, 12.515], [109.069, 12.086], [108.668, 12.086]] as [[number, number], [number, number], [number, number], [number, number]] },
  // ── ĐIỀU CHỈNH QHPK 1/2000 TÂY NHA TRANG · TIỂU PHÂN KHU 2.2 (377 ha, đất xã Diên Khánh) — CÔNG KHAI từ 15/10/2026 (chủ dự án chọn;
  //    trước chỉ admin xem). Hồ sơ Sở Xây dựng công bố, thuyết minh ghi "Kèm theo Quyết định số …… năm 2025" để TRỐNG → tên lớp + thẻ căn
  //    cứ ghi rõ "chưa xác minh quyết định". Nắn theo bảng toạ độ N1–N50 của chính bản vẽ (scripts/qh-tinh/nan_theo_bang_ranh.py), ô 512 WebP.
  { id: 'qh-nt-tay-pk22', name: 'ĐC phân khu 1/2000 Tây Nha Trang · tiểu phân khu 2.2', url: '',
    tiles: ['/tiles/nttaypk22v1/{z}/{x}/{y}.webp'], minzoom: 12, maxzoom: 18,
    coordinates: [[109.09844, 12.2651], [109.12705, 12.2651], [109.12705, 12.24377], [109.09844, 12.24377]] as [[number, number], [number, number], [number, number], [number, number]] },
  // (14/10/2026: đã GỠ lớp 1/500 DỰ THẢO lấy ý kiến 9 khu — thay bằng 1/500 CHÍNH THỨC 6 đồ án, CHỈ ADMIN XEM: danh sách
  //  lớp + ô ảnh lấy từ máy chủ /api/qh-rieng (routes/qhRieng.ts), không ghi ở đây — xem `lopRieng` trong MapPage.)
];
// ── KHOÁ QUY HOẠCH CAM LÂM (15/10/2026, chủ dự án: "ở Cam Lâm chỉ cho 893 là được xem free, còn lại khoá lại, sửa cả phần thông tin
// kiểm tra quy hoạch") ── 8 lớp dưới đây KHÔNG còn ở đường công khai /tiles/… (nginx chặn): chỉ người có VÉ (admin — GET /api/qh-rieng/ve)
// xem được, qua /api/qh-rieng/t/<thư mục>/… (máy chủ kiểm vé từng ô; đường /tiles/… ghi ở trên chỉ để lấy TÊN THƯ MỤC). Người khác: dòng
// có 🔒 trong danh sách + hộp "liên hệ admin"; bảng thửa chỉ có số liệu QĐ893 (máy chủ không gửi QĐ205 / phân khu, chỉ gửi dấu khoá);
// phiếu kiểm tra quy hoạch (in ảnh QĐ205) cũng khoá. Ai được xem đủ: một chỗ duy nhất ở máy chủ — `xemDuQhCamLam` (routes/parcels.ts).
const KHOA_CAM_LAM = new Set(['qh-qd205', 'qh-qd2076', 'qh-qd2101', 'qh-qd2222', 'qh-qd918', 'qh-cuhin', 'qh-taynam', 'qh-taybac']);
const MUC_KHOA_CAM_LAM = new Set(['qh-qd205', 'phan-khu']);
// GÓI CHỨC NĂNG CHUNG (15/10/2026 tối) — ai có gói (lib/auth coGoiChung, gồm admin) nhận vé xem đủ 8 lớp trên. Tài khoản thường:
//  · vẫn CHỌN được 8 lớp nhưng chỉ XEM THỬ tới MỨC XEM THỬ CHUNG `Z_XEM_THU` = mức ô xa nhất của QĐ205 (chủ dự án: "các quy hoạch còn lại
//    khi chọn vẫn cho hiện …, khi zoom lại gần hơn thì sẽ bị khoá và hiện bảng tính năng trả phí" → chốt: "lấy mức của 205 là mức phóng chung
//    cho tài khoản free" — trước phân khu theo mức xa nhất của chính nó là 8, nhìn nhỏ xíu). Máy chủ cũng chỉ phát ô tới mức đó khi không có
//    vé (routes/qhRieng.ts Z_XEM_THU). Phóng gần hơn → ẩn lớp + hộp "tính năng trả phí" (xem `xemThu` trong MapPage);
//  · lớp Cam Lâm (cả QĐ893 miễn phí) KHÔNG chỉnh được độ mờ (chủ dự án: "ở 893 cứ cho tra cứu tới thửa như bình thường, chỉ khoá không cho
//    làm mờ bản đồ quy hoạch") — lớp luôn đậm đủ, chạm thanh độ mờ là hộp trả phí.
const LOP_CAM_LAM = new Set(['qh-qd893', ...KHOA_CAM_LAM]);
const Z_XEM_THU = 10;   // mức ô xem thử chung của 8 lớp khoá (= mức ô xa nhất của QĐ205) — PHẢI khớp Z_XEM_THU ở routes/qhRieng.ts
// MỤC CHỌN trên bảng "Bản đồ quy hoạch". Ba bản phân khu 1/2000 (QĐ2076 phía Bắc · QĐ2101 trung tâm ·
// QĐ2222 ven biển · QĐ918 phức hợp phía Tây) là BỐN MẢNH CỦA CÙNG MỘT BỘ quy hoạch phân khu —
// nên gộp thành MỘT dòng, bật là bật cả ba. Ảnh của chúng nền trong suốt, vùng lại không trùm
// nhau đáng kể nên chồng lên nhau ra một tấm liền mạch.
// `tenNgan` = chữ trên thanh nút nổi của ĐIỆN THOẠI: màn hẹp ~360px, để tên đầy đủ thì 3 nút
// không vừa, nút đầu và nút cuối bị cắt mất chữ (chủ dự án chụp màn hình báo lỗi 14/9/2026).
// `tenApp` = tên ghi trong BẢNG ĐÁY chọn bản đồ + dòng tên góc trái dưới bản đồ (điện thoại) —
// viết tắt đúng kiểu app tham chiếu cho gọn MỘT DÒNG (chủ dự án chê chữ to, xuống 2 dòng, 14/9/2026).
//   Chỗ hiện tự ghép TÊN VÙNG đứng trước ("Nha Trang · QH Sử dụng đất 2030") nên `tenApp` đừng ghi lại tên vùng.
// `vung` = địa giới hành chính (huyện/thị cũ) của bản quy hoạch này. Dùng để LỌC danh sách lớp:
//   người xem chọn một địa giới thì chỉ hiện quy hoạch của địa giới đó, khỏi loạn vì quá nhiều bản.
//   `tamXem` = [lng, lat, zoom] để BAY TỚI khi chọn địa giới (chưa bật lớp nào cụ thể).
const VUNG_QH: { id: string; ten: string; tenNgan: string; tamXem: [number, number, number] }[] = [
  { id: 'cam-lam',   ten: 'Huyện Cam Lâm',       tenNgan: 'Cam Lâm',   tamXem: [109.0917, 12.0771, 12] },   // bỏ chữ "(cũ)" — chủ dự án 14/10/2026
  { id: 'nha-trang', ten: 'TP. Nha Trang',        tenNgan: 'Nha Trang', tamXem: [109.1900, 12.2450, 12] },
  { id: 'cam-ranh',  ten: 'TP. Cam Ranh',         tenNgan: 'Cam Ranh',  tamXem: [109.1500, 11.9050, 11] },
  { id: 'ninh-hoa',  ten: 'Thị xã Ninh Hòa',      tenNgan: 'Ninh Hòa',  tamXem: [109.1300, 12.4900, 11] },
  { id: 'van-ninh',  ten: 'Huyện Vạn Ninh',       tenNgan: 'Vạn Ninh',  tamXem: [109.2200, 12.7000, 11] },
  { id: 'khanh-son', ten: 'Huyện Khánh Sơn',      tenNgan: 'Khánh Sơn', tamXem: [108.9500, 12.0300, 11] },
  { id: 'dien-khanh', ten: 'Huyện Diên Khánh',    tenNgan: 'Diên Khánh', tamXem: [109.0381, 12.2753, 11] },
  { id: 'khanh-vinh', ten: 'Huyện Khánh Vĩnh',    tenNgan: 'Khánh Vĩnh', tamXem: [108.8414, 12.3126, 10] },
];
// `zBay` = mức phóng bay tới khi chọn bản này mà đang nhìn xa hơn (không ghi thì tự tính = minzoom − 1).
// `pdf` = mã bản trong bảng qh_pdf (máy chủ lib/qhPdf.ts): thửa trong vùng bản này có trang "Quy hoạch sử dụng đất 2030"
//   tính từ vùng loại đất BÓC TỪ BẢN ĐỒ PDF của Sở (14/10/2026) — chỉ tham khảo, không in phiếu.
// `khoa` = dòng lớp CHỈ ADMIN hiện cho người khác xem tên (máy chủ GET /api/qh-rieng/gioi-thieu): bấm vào là hộp "liên hệ admin", không bật gì.
// `xemThu` = lớp khoá mà tài khoản thường chỉ xem thử ở mức nhìn xa (gắn trong MapPage, xem LOP_CAM_LAM).
const MUC_QH: { id: string; ten: string; tenNgan: string; tenApp: string; gom: string[]; zBay?: number; vung: string; pdf?: string; khoa?: boolean; xemThu?: boolean }[] = [
  // (15/10/2026) chủ dự án: "đưa 2030 lên đầu" — QĐ893 (bản Cam Lâm xem miễn phí) đứng ĐẦU danh sách lớp, kéo theo cả thứ tự trang
  // quy hoạch trong bảng thửa (trangQhCuaThua đi theo đúng thứ tự mảng này).
  { id: 'qh-qd893', ten: 'Quy hoạch sử dụng đất 2030 (QĐ893)', tenNgan: 'Sử dụng đất 893', tenApp: 'QH Sử dụng đất 2030', gom: ['qh-qd893'], vung: 'cam-lam' },
  { id: 'qh-qd205', ten: 'Quy hoạch chung 2045 (QĐ205)', tenNgan: 'QH chung 205', tenApp: 'Quy hoạch chung 2045', gom: ['qh-qd205'], zBay: 10, vung: 'cam-lam' },   // chủ dự án cho thử z10 (14/9/2026)
  { id: 'phan-khu', ten: 'Quy hoạch phân khu 1/2000', tenNgan: 'Phân khu 1/2000', tenApp: 'QHXD Phân khu', gom:['qh-qd2076', 'qh-qd2101', 'qh-qd2222', 'qh-qd918', 'qh-cuhin', 'qh-taynam', 'qh-taybac'], vung: 'cam-lam' },
  // Ninh Hòa — bản xem thử (bật là bay tới thị xã Ninh Hòa). zBay 11 = nhìn gần hết thị xã.
  { id: 'qh-ninhhoa2030', ten: 'QHSDĐ 2030 · Thị xã Ninh Hòa', tenNgan: 'Ninh Hòa 2030', tenApp: 'QH Sử dụng đất 2030', pdf: 'ninhhoa2030', gom: ['qh-ninhhoa2030'], zBay: 11, vung: 'ninh-hoa' },
  { id: 'qh-nhatrang2030', ten: 'QHSDĐ 2030 · TP Nha Trang', tenNgan: 'Nha Trang 2030', tenApp: 'QH Sử dụng đất 2030', pdf: 'nhatrang2030', gom: ['qh-nhatrang2030'], zBay: 12, vung: 'nha-trang' },
  { id: 'qh-khanhson2030', ten: 'QHSDĐ 2030 · Huyện Khánh Sơn', tenNgan: 'Khánh Sơn 2030', tenApp: 'QH Sử dụng đất 2030', pdf: 'khanhson2030', gom: ['qh-khanhson2030'], zBay: 11, vung: 'khanh-son' },
  { id: 'qh-vanninh2030', ten: 'QHSDĐ 2030 · Huyện Vạn Ninh', tenNgan: 'Vạn Ninh 2030', tenApp: 'QH Sử dụng đất 2030', pdf: 'vanninh2030', gom: ['qh-vanninh2030'], zBay: 11, vung: 'van-ninh' },
  { id: 'qh-camranh2030', ten: 'QHSDĐ 2030 · TP Cam Ranh', tenNgan: 'Cam Ranh 2030', tenApp: 'QH Sử dụng đất 2030', pdf: 'camranh2030', gom: ['qh-camranh2030'], zBay: 11, vung: 'cam-ranh' },
  { id: 'qh-dienkhanh2030', ten: 'QHSDĐ 2030 · Huyện Diên Khánh', tenNgan: 'Diên Khánh 2030', tenApp: 'QH Sử dụng đất 2030', pdf: 'dienkhanh2030', gom: ['qh-dienkhanh2030'], zBay: 11, vung: 'dien-khanh' },
  { id: 'qh-khanhvinh2030', ten: 'QHSDĐ 2030 · Huyện Khánh Vĩnh', tenNgan: 'Khánh Vĩnh 2030', tenApp: 'QH Sử dụng đất 2030', pdf: 'khanhvinh2030', gom: ['qh-khanhvinh2030'], zBay: 10, vung: 'khanh-vinh' },
  { id: 'qh-nt-tay-pk22', ten: 'ĐC phân khu 1/2000 Tây Nha Trang 2.2 (chưa xác minh quyết định)', tenNgan: 'Tây NT 2.2', tenApp: 'ĐC phân khu 1/2000 Tây NT 2.2', gom: ['qh-nt-tay-pk22'], zBay: 13, vung: 'dien-khanh' },
  // (1/500 chính thức: mục chọn do máy chủ gửi riêng cho admin — `mucQh` trong MapPage)
];
// CĂN CỨ PHÁP LÝ của từng bản quy hoạch đang chồng lên bản đồ.
// Người xem hay hỏi "cái màu này dựa vào đâu?" — nên phải chỉ thẳng ra quyết định phê duyệt,
// và đính luôn bản gốc để bấm vào đọc được, khỏi phải tin lời web.
// Số hiệu và ngày ĐỌC TỪ CHÍNH BẢN GỐC (trang đầu mỗi quyết định). Riêng QĐ 2101 và QĐ 2222:
// bản quét đóng dấu ngày bằng tay, chữ số ngày KHÔNG đọc ra được — chỉ ghi "tháng 8/2024" cho
// đúng sự thật, không đoán. Bản gốc vẫn đính kèm để ai cần thì tự xem.
const TL_QH = '/tai-lieu/quy-hoach/';
// `loai` = loại văn bản ghi ở dòng đầu thẻ (mặc định "Quyết định"); `cac` = nhiều văn bản cho CÙNG một lớp (1/500 chính thức: 6 quyết định)
// → thẻ liệt kê từng văn bản, mỗi dòng một đường mở bản gốc.
type CanCu = { so: string; ngay: string; coQuan: string; ten: string; tep: string; loai?: string;
  cac?: { so: string; ngay: string; ten: string; tep: string }[] };
// Thẻ căn cứ cho bản QHSDĐ 2030 do Sở NN&MT đăng: dòng đầu = quyết định phê duyệt, bên dưới hai dòng mở bản gốc (quyết định + bản đồ)
const SNNMT = 'https://snnmt.khanhhoa.gov.vn';
function qdQhsdd(so: string, ngay: string, ten: string, tepQd: string, tenBanDo: string, tepBanDo: string): CanCu {
  return { so, ngay, coQuan: 'UBND tỉnh Khánh Hòa', ten, tep: SNNMT + tepQd,
    cac: [{ so: 'Quyết định', ngay, ten: so + ' (bản quét có chữ ký)', tep: SNNMT + tepQd },
      { so: 'Bản đồ', ngay, ten: tenBanDo + ' (Sở NN&MT công bố)', tep: SNNMT + tepBanDo }] };
}
const CAN_CU_QH: Record<string, CanCu> = {
  'qh-qd205': { so: '205/QĐ-TTg', ngay: '28/02/2024', coQuan: 'Thủ tướng Chính phủ',
    ten: 'Phê duyệt Quy hoạch chung đô thị mới Cam Lâm, tỉnh Khánh Hòa đến năm 2045',
    tep: TL_QH + 'QD-205-QD-TTg-2024-quy-hoach-chung-do-thi-moi-Cam-Lam-2045.pdf' },
  'qh-qd2076': { so: '2076/QĐ-UBND', ngay: '12/8/2024', coQuan: 'UBND tỉnh Khánh Hòa',
    ten: 'Phê duyệt đồ án Quy hoạch phân khu (tỷ lệ 1/2000) Phân khu đô thị phía Bắc, đô thị mới Cam Lâm',
    tep: TL_QH + 'QD-2076-2024-phan-khu-do-thi-phia-Bac.pdf' },
  'qh-qd2101': { so: '2101/QĐ-UBND', ngay: 'tháng 8/2024', coQuan: 'UBND tỉnh Khánh Hòa',
    ten: 'Phê duyệt đồ án Quy hoạch phân khu (tỷ lệ 1/2000) Phân khu đô thị trung tâm, đô thị mới Cam Lâm',
    tep: TL_QH + 'QD-2101-2024-phan-khu-do-thi-trung-tam.pdf' },
  'qh-qd2222': { so: '2222/QĐ-UBND', ngay: 'tháng 8/2024', coQuan: 'UBND tỉnh Khánh Hòa',
    ten: 'Phê duyệt đồ án Quy hoạch phân khu (tỷ lệ 1/2000) Phân khu đô thị ven biển, đô thị mới Cam Lâm',
    tep: TL_QH + 'QD-2222-2024-phan-khu-do-thi-ven-bien.pdf' },
  'qh-qd918': { so: '918/QĐ-UBND', ngay: '19/3/2026', coQuan: 'UBND tỉnh Khánh Hòa',
    ten: 'Phê duyệt quy hoạch phân khu (tỷ lệ 1/2000) Phân khu phức hợp phía Tây, đô thị mới Cam Lâm',
    tep: TL_QH + 'QD-918-2026-phan-khu-phuc-hop-phia-Tay.pdf' },
  'qh-taybac': { so: '919/QĐ-UBND', ngay: '19/3/2026', coQuan: 'UBND tỉnh Khánh Hòa',
    ten: 'Phê duyệt quy hoạch phân khu (tỷ lệ 1/2000) Phân khu sinh thái phía Tây Bắc, đô thị mới Cam Lâm',
    tep: TL_QH + 'QD-919-2026-phan-khu-sinh-thai-Tay-Bac.pdf' },
  'qh-taynam': { so: '920/QĐ-UBND', ngay: '19/3/2026', coQuan: 'UBND tỉnh Khánh Hòa',
    ten: 'Phê duyệt quy hoạch phân khu (tỷ lệ 1/2000) Phân khu sinh thái phía Tây Nam, đô thị mới Cam Lâm',
    tep: TL_QH + 'QD-920-2026-phan-khu-sinh-thai-Tay-Nam.pdf' },
  'qh-cuhin': { so: '30/QĐ-UBND', ngay: '15/01/2026', coQuan: 'UBND xã Suối Dầu',
    ten: 'Phê duyệt quy hoạch phân khu (tỷ lệ 1/2000) Phân khu sinh thái núi Cù Hin, đô thị mới Cam Lâm',
    tep: TL_QH + 'QD-30-2026-phan-khu-sinh-thai-nui-Cu-Hin.pdf' },
  // Tây Nha Trang 2.2: hồ sơ Sở Xây dựng công bố, THUYẾT MINH ĐỂ TRỐNG SỐ QUYẾT ĐỊNH → ghi đúng như vậy, không đoán số (15/10/2026)
  'qh-nt-tay-pk22': { loai: 'Hồ sơ', so: '(chưa ghi số quyết định)', ngay: '2025', coQuan: 'UBND xã Diên Khánh (theo hồ sơ Sở Xây dựng công bố)',
    ten: 'Điều chỉnh Quy hoạch phân khu (tỷ lệ 1/2.000) Khu đô thị phía Tây Nha Trang (Tiểu phân khu 2.2), 377,2 ha — thuyết minh ghi "Kèm theo Quyết định số …… năm 2025" để trống, CHƯA XÁC MINH đã phê duyệt',
    tep: TL_QH + 'DC-QHPK-1-2000-Tay-Nha-Trang-tieu-phan-khu-2-2-ban-do-SDD.pdf',
    cac: [{ so: 'Bản đồ', ngay: '2025', ten: 'Bản đồ sử dụng đất quy hoạch (tờ dùng để dựng lớp)', tep: TL_QH + 'DC-QHPK-1-2000-Tay-Nha-Trang-tieu-phan-khu-2-2-ban-do-SDD.pdf' },
      { so: 'Thuyết minh', ngay: '2025', ten: 'Thuyết minh quy hoạch (100 trang)', tep: TL_QH + 'DC-QHPK-1-2000-Tay-Nha-Trang-tieu-phan-khu-2-2-thuyet-minh.pdf' }] },
  // Ngày 04/4/2025 (KHÔNG phải 2026): đọc trên bản quét QĐ 893 Sở NN&MT đăng (bài id 10974), chữ ký số ngày 09/4/2025 — xác minh 14/10/2026
  'qh-qd893': { so: '893/QĐ-UBND', ngay: '04/4/2025', coQuan: 'UBND tỉnh Khánh Hòa',
    ten: 'Phê duyệt Điều chỉnh Quy hoạch sử dụng đất đến năm 2030 huyện Cam Lâm',
    tep: 'https://congbaokhanhhoa.gov.vn/vi-vn/noi-dung-van-ban/vanbanid/22060' },
  // 7 BẢN QHSDĐ 2030 BÓC TỪ PDF — số + ngày quyết định ĐÃ XÁC MINH 14/10/2026: Sở NN&MT đăng mỗi bản đồ CÙNG BÀI với quyết định phê duyệt
  // của nó (snnmt.khanhhoa.gov.vn → Quy hoạch - Kế hoạch sử dụng đất, id bài ghi ở từng dòng); file bản đồ web dùng trùng TỪNG BYTE file
  // trong bài; số + ngày đọc trên chính bản quét quyết định (chữ viết tay / dấu — lớp chữ máy đọc của bản quét bị lỗi, đừng tin).
  'qh-ninhhoa2030': qdQhsdd('1653/QĐ-UBND', '17/6/2025', 'Phê duyệt Điều chỉnh Quy hoạch sử dụng đất đến năm 2030 và Kế hoạch sử dụng đất năm đầu của điều chỉnh quy hoạch sử dụng đất thị xã Ninh Hòa',   // bài 11416
    '/Portals/0/QD%201653%20ngay%2017_6_2025%20cua%20UB%20tinh%20phe%20duyt%20diu%20chnh%20quy%20hoch%20SDD%202030%20TX%20Ninh%20Hoa.pdf',
    'Bản đồ Điều chỉnh Quy hoạch sử dụng đất đến năm 2030 — Thị xã Ninh Hòa', '/Portals/0/2b_%20Ban%20do%20DCQHSD%20dat%20den%20nam%202030%20Tx%20Ninh%20Hoa.pdf'),
  'qh-nhatrang2030': qdQhsdd('2978/QĐ-UBND', '31/10/2022', 'Phê duyệt quy hoạch sử dụng đất đến năm 2030 và kế hoạch sử dụng đất năm đầu của quy hoạch sử dụng đất thành phố Nha Trang',   // bài 6077
    '/Portals/0/2022/Dat-dai/QD%202978.pdf',
    'Bản đồ Quy hoạch sử dụng đất đến năm 2030 — TP Nha Trang', '/Portals/0/2022/Dat-dai/NhaTrang2030.pdf'),
  'qh-khanhson2030': qdQhsdd('4178/QĐ-UBND', '15/11/2021', 'Phê duyệt quy hoạch sử dụng đất đến năm 2030 và kế hoạch sử dụng đất năm 2021 của huyện Khánh Sơn',   // bài 5609
    '/Portals/0/2022/Dat-dai/4178_QD_UBND.pdf',
    'Bản đồ Quy hoạch sử dụng đất đến năm 2030 — Huyện Khánh Sơn', '/Portals/0/2022/Dat-dai/KhanhSon2030.pdf'),
  'qh-vanninh2030': qdQhsdd('701/QĐ-UBND', '14/3/2024', 'Phê duyệt Điều chỉnh Quy hoạch sử dụng đất đến năm 2030 và Kế hoạch sử dụng đất năm đầu của điều chỉnh quy hoạch sử dụng đất huyện Vạn Ninh',   // bài 9377
    '/Portals/0/701_QD_UBND.pdf',
    'Bản đồ Điều chỉnh Quy hoạch sử dụng đất đến năm 2030 — Huyện Vạn Ninh', '/Portals/0/DCQH2030%20VAN%20NINH.pdf'),
  'qh-camranh2030': qdQhsdd('860/QĐ-UBND', '31/3/2022', 'Phê duyệt quy hoạch sử dụng đất đến năm 2030 và kế hoạch sử dụng đất năm đầu của quy hoạch sử dụng đất thành phố Cam Ranh',   // bài 3412
    '/Resources/Docs/2022/%C4%90%E1%BA%A5t%20%C4%91ai/860.signed.pdf',
    'Bản đồ Quy hoạch sử dụng đất đến năm 2030 — TP Cam Ranh', '/Portals/0/2022/Dat-dai/CamRanh2030.pdf'),
  'qh-dienkhanh2030': qdQhsdd('1564/QĐ-UBND', '10/6/2025', 'Phê duyệt Điều chỉnh Quy hoạch sử dụng đất đến năm 2030 và Kế hoạch sử dụng đất năm đầu của điều chỉnh quy hoạch sử dụng đất huyện Diên Khánh',   // bài 11302
    '/Portals/0/1564-QD-UBND_signed.pdf',
    'Bản đồ Điều chỉnh Quy hoạch sử dụng đất đến năm 2030 — Huyện Diên Khánh', '/Portals/0/3%20Ban%20do%20Dieu%20chinh%20Quy%20hoach%20su%20dung%20dat%20huyen%20Dien%20Khanh%20den%202030.pdf'),
  'qh-khanhvinh2030': qdQhsdd('1650/QĐ-UBND', '16/6/2025', 'Phê duyệt Điều chỉnh Quy hoạch sử dụng đất đến năm 2030 và Kế hoạch sử dụng đất năm đầu của điều chỉnh quy hoạch sử dụng đất huyện Khánh Vĩnh',   // bài 11348
    '/Portals/0/1650_signed.pdf',
    'Bản đồ Điều chỉnh Quy hoạch sử dụng đất đến năm 2030 — Huyện Khánh Vĩnh (tỷ lệ 1/25.000)', '/Portals/0/DCQH%20SDD%20DEN%2020330%2008052025.pdf'),
};

const QH_BOUNDS: [[number, number], [number, number]] = [[108.9401268, 11.9257021], [109.2563886, 12.217594]];
// Khung bao [tây, nam, đông, bắc] của một hình GeoJSON bất kỳ (điểm, đường, vùng, nhiều vùng).
// Dùng để biết thửa đang xem nằm ở đâu mà so với phạm vi từng bản quy hoạch.
function bboxHinh(g: any): [number, number, number, number] | null {
  if (!g || !g.coordinates) return null;
  let tay = Infinity, nam = Infinity, dong = -Infinity, bac = -Infinity;
  const di = (o: any) => {
    if (!Array.isArray(o)) return;
    if (typeof o[0] === 'number') {
      if (o[0] < tay) tay = o[0]; if (o[0] > dong) dong = o[0];
      if (o[1] < nam) nam = o[1]; if (o[1] > bac) bac = o[1];
    } else for (const i of o) di(i);
  };
  di(g.coordinates);
  return Number.isFinite(tay) ? [tay, nam, dong, bac] : null;
}
const PARCEL_MIN_ZOOM = 14; // TẢI TRƯỚC dữ liệu thửa từ z14 (sẵn sàng, không lag khi zoom tới)
const PARCEL_SHOW_ZOOM = 16; // chỉ HIỂN THỊ ranh thửa khi zoom ≥ z16
const ZONING_MIN_ZOOM = 14; // lớp quy hoạch (vector) chỉ tải khi zoom gần — ở xa dùng ẢNH quy hoạch cho nhẹ

// (Đã BỎ hai danh sách xã ghi cứng ở đây.) Trước kia ô "Chọn xã" chỉ có 4 xã mới + 14 xã cũ
// của riêng huyện Cam Lâm, gõ tay trong mã nguồn. Nay dữ liệu địa chính phủ cả 147 xã/phường
// toàn tỉnh nên danh sách lấy THẲNG TỪ DATABASE qua /api/dc/danh-muc — thêm bớt xã không phải sửa code.

interface ParcelInfo {
  found: boolean; point: { lng: number; lat: number };
  // giaDinh = THỬA KHÁCH TỰ VẼ từ bảng toạ độ (15/10/2026, POST /parcels/qh-tu-ve) — không có số thửa / số tờ
  parcel: { properties: Record<string, any>; soTo?: string | null; soThua?: string | null; xa?: string | null; areaM2?: number; giaDinh?: boolean } | null;
  zoning: Record<string, any> | null;
  overlaps?: { layer: string; type: string; hz?: string; areaM2: number }[];
  // true = thửa nằm NGOÀI vùng đã có dữ liệu quy hoạch (hiện mới có huyện Cam Lâm cũ).
  // Phải nói thẳng cho người xem biết là "chưa có dữ liệu", đừng để trống.
  qhNgoaiVung?: boolean;
  listings: { id: number; title: string; price: number }[];
}
const fmtLen = (m: number) => (m >= 1000 ? (m / 1000).toFixed(3) + ' km' : m.toFixed(1) + ' m');
const fmtArea = (m2: number) => (m2 >= 10000 ? (m2 / 10000).toFixed(4) + ' ha (' + m2.toFixed(0) + ' m²)' : m2.toFixed(1) + ' m²');
// Diện tích GỌN MỘT DÒNG cho bảng thửa trên điện thoại: chỉ m², có DẤU CHẤM NGĂN HÀNG NGHÌN kiểu Việt Nam
// (241.343 m² · 565,4 m²) — chủ dự án 14/9/2026: "24.1343 ha (241343 m²)" dài, xuống dòng, khó đọc số lớn.
// KHÔNG làm tròn về số nguyên (chủ dự án: diện tích phải đúng số) — giữ tối đa 2 chữ số thập phân:
// 1255.9 → "1.255,9 m²" · 241343 → "241.343 m²" · 565.456 → "565,46 m²".
const fmtM2 = (m2: number) => m2.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' m²';
// Lấy trường đầu tiên có giá trị trong properties (dữ liệu địa chính đặt tên khoá không thống nhất).
const pickProp = (p: Record<string, any> | undefined, keys: string[]) => { for (const k of keys) { const v = p?.[k]; if (v != null && String(v).trim() && String(v).trim() !== '0') return String(v).trim(); } return ''; };
// Màu badge loại đất theo ký hiệu (ODT/đất ở → hồng, lúa → vàng, cây/rừng → xanh…).
const landColor = (code: string) => { const c = (code || '').toUpperCase(); if (/^(ODT|OTC|ONT|TMD|SKC|TSC)/.test(c)) return 'bg-pink-100 text-pink-700'; if (/^(LUC|LUK|BHK|NHK|LUA)/.test(c)) return 'bg-amber-100 text-amber-700'; if (/^(CLN|RSX|RPH|RDD|LNP|NTS|COC|BCS)/.test(c)) return 'bg-emerald-100 text-emerald-700'; return 'bg-slate-100 text-slate-600'; };
// Tách toạ độ từ link Google Maps (…/@lat,lng…, !3dlat!4dlng, q=lat,lng, hoặc "lat,lng").
function parseGmap(url: string): { lat: number; lng: number } | null {
  if (!url) return null;
  let m = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/); if (m) return { lat: +m[1], lng: +m[2] };
  m = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/); if (m) return { lat: +m[1], lng: +m[2] };
  m = url.match(/(?:[?&](?:q|query|ll|sll|destination)=|loc:)(-?\d+(?:\.\d+)?)[,+\s]+(-?\d+(?:\.\d+)?)/i); if (m) return { lat: +m[1], lng: +m[2] };
  m = url.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/); if (m) return { lat: +m[1], lng: +m[2] };
  return null;
}
function parseNum(tok: string): number {
  let t = tok.replace(/,/g, '.');
  const parts = t.split('.');
  if (parts.length > 2) t = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
  return parseFloat(t);
}
// Đọc bảng toạ độ VN-2000 (mỗi dòng 1 điểm), tự nhận biết Y(Đông ~5-6 chữ số) và X(Bắc >900k).
function parseVnTable(text: string): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (const line of text.split(/[\n;]/)) {
    const big = (line.match(/-?[\d.,]+/g) || []).map(parseNum).filter((n) => Number.isFinite(n) && n > 90000);
    if (big.length >= 2) {
      const a2 = big[big.length - 2], b2 = big[big.length - 1];
      const E = a2 > 900000 ? b2 : a2, N = a2 > 900000 ? a2 : b2;
      if (E > 90000 && E < 900000 && N > 900000) pts.push({ x: E, y: N });
    }
  }
  return pts;
}
function polyAreaM2(pts: { x: number; y: number }[]): number {
  let s = 0; for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length; s += pts[i].x * pts[j].y - pts[j].x * pts[i].y; } return Math.abs(s) / 2;
}
function perimeterM(pts: { x: number; y: number }[]): number {
  let p = 0; for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length; p += Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y); } return p;
}
let _tess: any = null;
function loadTesseract(): Promise<any> {
  if ((window as any).Tesseract) return Promise.resolve((window as any).Tesseract);
  if (_tess) return _tess;
  _tess = new Promise((resolve, reject) => {
    const sc = document.createElement('script');
    sc.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    sc.onload = () => resolve((window as any).Tesseract);
    sc.onerror = () => reject(new Error('Không tải được bộ đọc ảnh (OCR).'));
    document.body.appendChild(sc);
  });
  return _tess;
}
let _worker: any = null;
async function getWorker(T: any): Promise<any> {
  if (_worker) return _worker;
  const w = await T.createWorker('eng');
  await w.setParameters({ tessedit_char_whitelist: '0123456789.,-: ', tessedit_pageseg_mode: '6' });
  _worker = w; return w;
}
async function runRecognize(src: HTMLCanvasElement | HTMLImageElement): Promise<string> {
  const T = await loadTesseract();
  try { const w = await getWorker(T); const out = await w.recognize(src); return String(out?.data?.text || ''); }
  catch { const out = await T.recognize(src, 'eng'); return String(out?.data?.text || ''); } // dự phòng API cũ
}
function preprocess(src: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement {
  const w0 = (src as HTMLImageElement).naturalWidth || (src as HTMLCanvasElement).width;
  const h0 = (src as HTMLImageElement).naturalHeight || (src as HTMLCanvasElement).height;
  const scl = Math.max(1, Math.min(3, 2200 / Math.max(w0, h0)));
  const w = Math.max(1, Math.round(w0 * scl)), h = Math.max(1, Math.round(h0 * scl));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D;
  (ctx as any).imageSmoothingQuality = 'high'; ctx.drawImage(src, 0, 0, w, h);
  const im = ctx.getImageData(0, 0, w, h), d = im.data, n = w * h;
  const g = new Float64Array(n);
  for (let p = 0; p < n; p++) { const k = p * 4; g[p] = 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]; }
  const integ = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) { let rs = 0; for (let x = 0; x < w; x++) { rs += g[y * w + x]; integ[(y + 1) * (w + 1) + (x + 1)] = integ[y * (w + 1) + (x + 1)] + rs; } }
  const half = Math.max(8, Math.floor(w / 28)), th = 0.15;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x1 = Math.max(0, x - half), x2 = Math.min(w - 1, x + half), y1 = Math.max(0, y - half), y2 = Math.min(h - 1, y + half);
    const cnt = (x2 - x1 + 1) * (y2 - y1 + 1);
    const sum = integ[(y2 + 1) * (w + 1) + (x2 + 1)] - integ[y1 * (w + 1) + (x2 + 1)] - integ[(y2 + 1) * (w + 1) + x1] + integ[y1 * (w + 1) + x1];
    const v = (g[y * w + x] * cnt <= sum * (1 - th)) ? 0 : 255;
    const k = (y * w + x) * 4; d[k] = d[k + 1] = d[k + 2] = v;
  }
  ctx.putImageData(im, 0, 0);
  return cv;
}
function normalizeDigits(t: string): string {
  return t.replace(/[OoQ]/g, '0').replace(/[Il|]/g, '1').replace(/[Ss]/g, '5').replace(/B/g, '8').replace(/[Zz]/g, '2').replace(/g/g, '9');
}
function toBlob(src: HTMLImageElement | HTMLCanvasElement): Promise<Blob> {
  const w0 = src instanceof HTMLCanvasElement ? src.width : ((src as HTMLImageElement).naturalWidth || 1);
  const h0 = src instanceof HTMLCanvasElement ? src.height : ((src as HTMLImageElement).naturalHeight || 1);
  const sc = Math.min(3, 2400 / Math.max(w0, h0));
  const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w0 * sc)); cv.height = Math.max(1, Math.round(h0 * sc));
  cv.getContext('2d')!.drawImage(src, 0, 0, cv.width, cv.height);
  return new Promise((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/png'));
}
// Ảnh GỐC nén JPEG (<1MB) — cho engine mạnh (máy nội bộ / OCR.space / Gemini) đọc ảnh tự nhiên, ít nhầm số hơn ảnh nhị phân hoá.
function toJpeg(src: HTMLImageElement | HTMLCanvasElement, maxDim = 2200, q = 0.9): Promise<Blob> {
  const w0 = src instanceof HTMLCanvasElement ? src.width : ((src as HTMLImageElement).naturalWidth || 1);
  const h0 = src instanceof HTMLCanvasElement ? src.height : ((src as HTMLImageElement).naturalHeight || 1);
  const sc = Math.min(1, maxDim / Math.max(w0, h0));
  const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w0 * sc)); cv.height = Math.max(1, Math.round(h0 * sc));
  cv.getContext('2d')!.drawImage(src, 0, 0, cv.width, cv.height);
  return new Promise((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/jpeg', q));
}
// Ảnh ĐÃ LÀM SẠCH cho AI đọc dễ nhất: xám hoá → LÀM PHẲNG NỀN (khử bóng/ánh sáng lệch + nền hoa văn bảo an của sổ đỏ) → tăng tương phản → LÀM NÉT (unsharp) → phóng to.
// Giữ ảnh XÁM (không nhị phân) nên Gemini/OCR.space vẫn đọc tự nhiên nhưng rõ hơn hẳn ảnh gốc. Kỹ thuật: chia cho trung bình cục bộ (illumination correction) + gamma + unsharp 3x3.
function enhanceForAI(src: HTMLImageElement | HTMLCanvasElement, maxDim = 2200, q = 0.92): Promise<Blob> {
  const w0 = (src as HTMLImageElement).naturalWidth || (src as HTMLCanvasElement).width;
  const h0 = (src as HTMLImageElement).naturalHeight || (src as HTMLCanvasElement).height;
  const scl = Math.max(1, Math.min(2, maxDim / Math.max(w0, h0)));
  const w = Math.max(1, Math.round(w0 * scl)), h = Math.max(1, Math.round(h0 * scl));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D;
  (ctx as any).imageSmoothingQuality = 'high'; ctx.drawImage(src, 0, 0, w, h);
  const im = ctx.getImageData(0, 0, w, h), d = im.data, n = w * h;
  // 1) Xám hoá.
  const g = new Float64Array(n);
  for (let p = 0; p < n; p++) { const k = p * 4; g[p] = 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]; }
  // 2) Làm phẳng nền: nền = trung bình cục bộ cửa sổ LỚN (ảnh tích phân) → CHIA → nền về gần trắng đều, khử bóng & làm mờ hoa văn bảo an; chữ giữ đậm.
  const integ = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) { let rs = 0; for (let x = 0; x < w; x++) { rs += g[y * w + x]; integ[(y + 1) * (w + 1) + (x + 1)] = integ[y * (w + 1) + (x + 1)] + rs; } }
  const half = Math.max(12, Math.floor(w / 12));
  const wm = new Float64Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x1 = Math.max(0, x - half), x2 = Math.min(w - 1, x + half), y1 = Math.max(0, y - half), y2 = Math.min(h - 1, y + half);
    const cnt = (x2 - x1 + 1) * (y2 - y1 + 1);
    const sum = integ[(y2 + 1) * (w + 1) + (x2 + 1)] - integ[y1 * (w + 1) + (x2 + 1)] - integ[(y2 + 1) * (w + 1) + x1] + integ[y1 * (w + 1) + x1];
    const bg = Math.max(1, sum / cnt);
    let v = (g[y * w + x] / bg) * 250; if (v > 255) v = 255;   // chia cho nền → trắng đều
    wm[y * w + x] = v;
  }
  // 3) Làm nét (unsharp 3x3) + gamma nhẹ cho chữ đậm hơn; xuất ảnh xám.
  const amt = 0.6;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const blur = (wm[x > 0 ? i - 1 : i] + wm[x < w - 1 ? i + 1 : i] + wm[y > 0 ? i - w : i] + wm[y < h - 1 ? i + w : i]) * 0.25;
    let v = wm[i] + amt * (wm[i] - blur);                        // unsharp
    v = 255 * Math.pow(Math.min(1, Math.max(0, v / 255)), 1.25); // gamma → chữ đậm
    if (v < 0) v = 0; else if (v > 255) v = 255;
    const k = i * 4; d[k] = d[k + 1] = d[k + 2] = v;
  }
  ctx.putImageData(im, 0, 0);
  return new Promise((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/jpeg', q));
}
function engineLabel(e: string): string { return e === 'paste' ? 'dán tay' : 'AI Cam Lâm Land'; }
async function ocrToPoints(img: HTMLImageElement | HTMLCanvasElement): Promise<{ pts: { x: number; y: number }[]; msg: string; engine: string; raw: string }> {
  let status = '', engine = '', raw = '', firstText = '', firstEngine = '';
  let best: { x: number; y: number }[] = [];
  const keep = (pts: { x: number; y: number }[], eng: string, text: string) => { if (pts.length > best.length) { best = pts; engine = eng; raw = text; } };
  let pre: HTMLCanvasElement | null = null;
  const getPre = () => (pre ||= preprocess(img)); // chỉ nhị phân hoá khi cần (tiết kiệm CPU đường thành công)
  try {
    // Lần 1: ảnh ĐÃ LÀM SẠCH (xám + phẳng nền + tăng tương phản + làm nét) — engine mạnh (máy nội bộ/OCR.space/Gemini) đọc RÕ NHẤT, ít nhầm số.
    let r = await ocrImage(await enhanceForAI(img));
    firstText = r.text; firstEngine = r.engine;
    keep(parseBigPairs(r.text), r.engine, r.text);
    // Lần 2: chưa đủ → ảnh nhị phân hoá (đỡ cho Tesseract khi không có engine mạnh).
    if (best.length < 3) { r = await ocrImage(await toBlob(getPre())); keep(parseBigPairs(r.text), r.engine, r.text); }
    // Lần 3: vẫn thiếu → ảnh GỐC tự nhiên (phòng khi ảnh vốn đã sạch, tránh xử lý quá tay).
    if (best.length < 3) { r = await ocrImage(await toJpeg(img)); keep(parseBigPairs(r.text), r.engine, r.text); }
  } catch (e: any) {
    const m = String(e?.message || e);
    status = /unauthor|forbidden|401|403/i.test(m)
      ? '🔒 Vui lòng ĐĂNG NHẬP để dùng tính năng đọc ảnh bảng toạ độ (chỉ tài khoản đã đăng nhập).'
      : '⛔ SERVER OCR CHƯA CHẠY:\n' + m + '\n\n→ Backend camlam-api cần cài Tesseract. Đang tạm dùng OCR trình duyệt.';
  }
  // OCR trình duyệt (whitelist chỉ số) — bổ sung khi server thiếu/không chạy
  if (best.length < 3) {
    try { const t = await runRecognize(getPre()); if (!firstText) { firstText = t; firstEngine = 'browser'; } keep(parseBigPairs(t), 'browser', t); } catch {}
    if (best.length < 3) { try { const t = await runRecognize(img); keep(parseBigPairs(t), 'browser', t); } catch {} }
  }
  if (!best.length && firstText) { raw = firstText; engine = firstEngine; }
  if (best.length >= 3) return { pts: best, msg: '', engine, raw };
  return { pts: best, msg: status || ('Chỉ đọc được ' + best.length + ' điểm — chưa đủ.\nHãy chụp GẦN, THẲNG, đủ sáng, chỉ lấy phần bảng số; hoặc nhập tay ở tab "Nhập bảng".'), engine, raw };
}
function showOcrResult(r: { pts: { x: number; y: number }[]; msg: string; engine?: string; raw?: string }, apply: (pts: { x: number; y: number }[], engine?: string) => void) {
  if (r.pts.length) { apply(r.pts, r.engine); return; }
  const eng = r.engine ? '\n\nĐọc bằng: ' + engineLabel(r.engine) : '';
  const rawShow = r.raw ? '\n\nChữ đọc được:\n' + r.raw.replace(/\s*\n\s*/g, '\n').trim().slice(0, 300) : '';
  alert('Chưa tách được toạ độ.' + eng + '\n\n' + r.msg + rawShow);
}
// VN-2000 Khánh Hòa: Đông (E) ~6 chữ số nguyên [380k–720k]; Bắc (N) ~7 chữ số (thường bắt đầu bằng 1) [1.20M–1.48M].
const E_MIN = 380000, E_MAX = 720000, N_MIN = 1200000, N_MAX = 1480000;
// Dựng lại 1 số toạ độ từ CHUỖI CHỈ CÒN SỐ theo SỐ CHỮ SỐ phần nguyên → tự đặt lại dấu thập phân (bất kể OCR có bắt được dấu chấm/phẩy hay không) + kiểm tra biên vùng để loại số rác.
function reconstructCoord(run: string): { v: number; kind: 'E' | 'N' } | null {
  const s = String(run).replace(/\D/g, '');
  if (s.length < 6) return null;
  if (s.length >= 7) { const n = parseFloat(s.slice(0, 7) + (s.length > 7 ? '.' + s.slice(7) : '')); if (n >= N_MIN && n <= N_MAX) return { v: n, kind: 'N' }; }
  const e = parseFloat(s.slice(0, 6) + (s.length > 6 ? '.' + s.slice(6) : ''));
  if (e >= E_MIN && e <= E_MAX) return { v: e, kind: 'E' };
  return null;
}
// Đọc bảng toạ độ: ưu tiên THEO DÒNG (mỗi dòng 1 điểm = 1 Đông + 1 Bắc, bỏ STT/nhiễu); nếu mất cấu trúc dòng thì ghép phẳng cặp E–N.
function parseBigPairs(text: string): { x: number; y: number }[] {
  const t = normalizeDigits(text);
  const RUN = /\d[\d.,]*\d|\d/g;
  const byLine: { x: number; y: number }[] = [];
  for (const line of t.split(/[\n\r;]+/)) {
    let E: number | null = null, N: number | null = null;
    for (const run of (line.match(RUN) || [])) { const r = reconstructCoord(run); if (!r) continue; if (r.kind === 'E' && E == null) E = r.v; else if (r.kind === 'N' && N == null) N = r.v; }
    if (E != null && N != null) byLine.push({ x: N, y: E }); // x=Bắc, y=Đông (đúng sổ)
  }
  if (byLine.length >= 3) return byLine;
  const items: { v: number; kind: 'E' | 'N' }[] = [];
  for (const run of (t.match(RUN) || [])) { const r = reconstructCoord(run); if (r) items.push(r); }
  const flat: { x: number; y: number }[] = [];
  for (let i = 0; i < items.length - 1; i++) { const a = items[i], b = items[i + 1]; if (a.kind === b.kind) continue; const E = a.kind === 'E' ? a.v : b.v, N = a.kind === 'N' ? a.v : b.v; flat.push({ x: N, y: E }); i++; }
  return flat.length > byLine.length ? flat : byLine;
}

// Điểm có nằm trong vòng đa giác không (ray casting) — để click ra loại đất QH vector ngay ở trình duyệt.
function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > lat) !== (yj > lat)) && (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

export default function MapPage() {
  const { user } = useAuth();
  // ── LỚP QUY HOẠCH CHỈ QUẢN TRỊ VIÊN XEM (14/10/2026) — đầu tiên: QH chi tiết 1/500 CHÍNH THỨC xã Cam Lâm (QĐ 2043–2048/QĐ-UBND
  // ngày 25/9/2026, 6 đồ án). Chủ dự án: "chỉ tài khoản admin được xem tất cả, còn lại không cho xem" → danh sách lớp + VÉ xem lấy
  // từ máy chủ (GET /api/qh-rieng/ve — chỉ admin, routes/qhRieng.ts); người khác không nhận được gì, mã trang cũng không ghi tên lớp.
  // Ô ảnh tải qua /api/qh-rieng/o/… kèm vé (máy chủ kiểm vé TỪNG Ô) — không nằm ở /tiles/ công khai. Vé hạn 24 giờ (tải lại trang là có vé mới).
  // `chuGiai` (15/10/2026): chú giải màu của lớp riêng (vd 1/500 tô màu theo loại đất) gửi kèm vé — không nằm trong /chu-giai-qh.json công khai.
  type LopRieng = { id: string; thuMuc: string; ten: string; tenNgan: string; tenApp: string; vung: string; zBay?: number;
    minzoom: number; maxzoom: number; khung: [number, number, number, number]; canCu?: CanCu;
    chuGiai?: { nhom: string; muc: { mau: string; tenDs: string[]; so: number }[] }[] };
  const [lopRieng, setLopRieng] = useState<{ ve: string; lop: LopRieng[] } | null>(null);
  const laQuanTri = laAdmin(user);
  // GÓI CHỨC NĂNG CHUNG (15/10/2026): admin + khách có gói còn hạn đều xin vé — máy chủ cấp vé xem đủ QĐ205 / phân khu; riêng admin
  // nhận thêm danh sách lớp 1/500. Tài khoản thường không xin vé (xem thử ở mức nhìn xa — LOP_CAM_LAM).
  const coGoi = coGoiChung(user);
  useEffect(() => {
    if (!coGoi) { setLopRieng(null); return; }
    let con = true;
    api<{ ve: string; lop: LopRieng[] }>('/qh-rieng/ve').then((r) => { if (con) setLopRieng(r?.ve ? r : null); }).catch(() => { if (con) setLopRieng(null); });
    return () => { con = false; };
  }, [coGoi, laQuanTri]);
  // 15/10/2026 chủ dự án: lớp 1/500 "vẫn hiện ra chỗ chọn nhưng chỉ tài khoản admin được chọn, còn những tài khoản khác thì hiện popup
  // liên hệ admin". Máy chủ gửi TÊN lớp nào được phép lộ tên (GET /api/qh-rieng/gioi-thieu — chỉ tên + khu vực, không có ô / vé) →
  // hiện thành dòng có ổ khoá; bấm vào mở hộp `hopKhoa`. Ô ảnh vẫn đòi vé của admin nên biết tên cũng không tải được gì.
  const [lopKhoa, setLopKhoa] = useState<{ id: string; ten: string; tenNgan: string; tenApp: string; vung: string }[]>([]);
  const [hopKhoa, setHopKhoa] = useState<string | null>(null);   // tên lớp vừa bấm mà không có quyền xem
  useEffect(() => {
    let con = true;
    api<{ lop: typeof lopKhoa }>('/qh-rieng/gioi-thieu').then((r) => { if (con) setLopKhoa(Array.isArray(r?.lop) ? r.lop : []); }).catch(() => {});
    return () => { con = false; };
  }, []);
  // Gộp lớp riêng vào ba danh sách tĩnh (RASTER_OVERLAYS · MUC_QH · CAN_CU_QH). Địa chỉ ô ghi ĐẦY ĐỦ (có tên miền) như ô địa chính.
  const rasterOverlays = useMemo<typeof RASTER_OVERLAYS>(() => {
    const goc = typeof window !== 'undefined' ? window.location.origin : '';
    const duong = API_BASE.startsWith('http') ? API_BASE : goc + API_BASE;
    // KHOÁ CAM LÂM (15/10/2026): có vé → ảnh 8 lớp lấy qua đường có vé. Không có vé (tài khoản thường) → XEM THỬ: chỉ ô ở mức nhìn xa
    // nhất của bộ ảnh (minzoom = maxzoom = mức đó → gần hơn thì bản đồ tự phóng to ô đó lên, không xin ô mức khác — máy chủ cũng từ chối),
    // `xemThu` = mức đó, dùng để ẩn lớp khi phóng gần (overlays bên dưới). Có gói mà vé chưa về → chờ vé (khỏi dựng ảnh xem thử rồi thay).
    const ve = lopRieng?.ve ? encodeURIComponent(lopRieng.ve) : '';
    const coBan = RASTER_OVERLAYS.flatMap((o) => {
      if (!KHOA_CAM_LAM.has(o.id)) return [o];
      const thuMuc = /\/tiles\/([^/]+)\//.exec(String(((o as any).tiles || [])[0] || ''))?.[1];
      if (!thuMuc) return [];
      if (ve) return [{ ...o, url: '', tiles: [`${duong}/qh-rieng/t/${thuMuc}/{z}/{x}/{y}?v=${ve}`] }];
      if (coGoi) return [];
      // nguồn: từ mức xa nhất của bộ ảnh tới Z_XEM_THU (gần hơn thì bản đồ tự phóng to ô mức Z_XEM_THU, không xin ô mức khác)
      return [{ ...o, url: '', tiles: [`${duong}/qh-rieng/t/${thuMuc}/{z}/{x}/{y}`],
        minzoom: Math.min(Number((o as any).minzoom ?? Z_XEM_THU), Z_XEM_THU), maxzoom: Z_XEM_THU, xemThu: Z_XEM_THU } as any];
    });
    if (!lopRieng?.lop?.length) return coBan;
    return [...coBan, ...lopRieng.lop.map((l) => ({ id: l.id, name: l.ten, url: '',
      tiles: [`${duong}/qh-rieng/o/${l.thuMuc}/{z}/{x}/{y}?v=${encodeURIComponent(lopRieng.ve)}`], minzoom: l.minzoom, maxzoom: l.maxzoom,
      coordinates: [[l.khung[0], l.khung[3]], [l.khung[2], l.khung[3]], [l.khung[2], l.khung[1]], [l.khung[0], l.khung[1]]] as [[number, number], [number, number], [number, number], [number, number]] }))];
  }, [lopRieng, coGoi]);
  const rasterOverlaysRef = useRef(rasterOverlays); rasterOverlaysRef.current = rasterOverlays;
  // Bỏ phần tên miền khỏi một đường ảnh (phiếu in tự ghép gốc trang vào trước — lib/phieuQh.ts)
  const tuongDoi = (u?: string): string | undefined => {
    const g = typeof window !== 'undefined' ? window.location.origin : '';
    return u && g && u.startsWith(g) ? u.slice(g.length) : u;
  };
  const mucQh = useMemo<typeof MUC_QH>(() => {
    const rieng = (lopRieng?.lop || []).map((l) => ({ id: l.id, ten: l.ten, tenNgan: l.tenNgan, tenApp: l.tenApp, gom: [l.id], zBay: l.zBay, vung: l.vung }));
    const daCo = new Set(rieng.map((l) => l.id));
    // dòng có khoá: lớp admin đã có thật thì thôi (không hiện hai dòng). `gom` giữ đúng mã lớp (không để rỗng — mảng rỗng
    // thì `gom.every(...)` luôn đúng, dòng sẽ tưởng là đang bật).
    const khoa = lopKhoa.filter((l) => !daCo.has(l.id)).map((l) => ({ id: l.id, ten: l.ten, tenNgan: l.tenNgan, tenApp: l.tenApp, gom: [l.id], vung: l.vung, khoa: true }));
    // KHOÁ CAM LÂM: QĐ205 + phân khu 1/2000 với tài khoản thường (không gói, không vé) → dòng XEM THỬ (có 🔒, vẫn chọn được)
    const coBan = MUC_QH.map((m) => (MUC_KHOA_CAM_LAM.has(m.id) && !lopRieng?.ve && !coGoi ? { ...m, xemThu: true } : m));
    return [...coBan, ...rieng, ...khoa];
  }, [lopRieng, lopKhoa, coGoi]);
  // Mức xem thử (mức ô xa nhất) + khung bao của một mục đang chọn — từ danh sách ảnh (rasterOverlays)
  const xemThuCua = (gom: string[]) => {
    const cac = rasterOverlaysRef.current.filter((o) => gom.includes(o.id) && (o as any).xemThu != null);
    if (!cac.length) return null;
    const xs = cac.flatMap((o) => o.coordinates.map((c) => c[0])), ys = cac.flatMap((o) => o.coordinates.map((c) => c[1]));
    return { z: Math.min(...cac.map((o) => Number((o as any).xemThu))), khung: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
  };
  // Bấm một dòng quy hoạch: dòng có khoá → hộp "liên hệ admin", không bật lớp nào. Dòng XEM THỬ → bật như thường nhưng bản đồ đi theo
  // mức xem thử: ô mức N hiện đúng nét ở mức bản đồ N − 1 (ô 256px — xem chonLopQh), nên đang nhìn gần hơn thì LÙI RA mức đó (giữ tâm);
  // đứng ngoài vùng / nhìn quá xa thì chonLopQh tự bay tới (không truyền zBay để nó bay theo mức xem thử).
  const bamMucQh = (o: (typeof MUC_QH)[number], bat: boolean) => {
    // dòng có khoá (QH chi tiết 1/500 với người chưa có gói) → hộp "tính năng trả phí" — chủ dự án 15/10/2026: "đăng ký thành viên để xem
    // chứ liên hệ admin cái gì". Có gói mà vé chưa về kịp (vài giây đầu) → hộp cũ báo tải lại.
    if (o.khoa) { if (coGoi) setHopKhoa(o.tenApp || o.ten); else setTraPhiQh(o.tenApp || o.ten); return; }
    if (!o.xemThu) { chonLopQh(o, bat); return; }
    chonLopQh({ gom: o.gom, zBay: (xemThuCua(o.gom)?.z ?? Z_XEM_THU) - 1 }, bat);   // nhìn quá xa / đứng ngoài vùng → bay tới đúng mức xem thử
    if (!bat) return;
    const m: any = (window as any).__banDo, xt = xemThuCua(o.gom);
    if (!m?.getZoom || !xt) return;
    const c = m.getCenter(), [x0, y0, x1, y1] = xt.khung;
    if (m.getZoom() >= xt.z - 0.5 && c.lng >= x0 && c.lng <= x1 && c.lat >= y0 && c.lat <= y1) m.easeTo({ zoom: xt.z - 1, duration: 800 });
  };
  // Tính năng trả phí vừa chạm (xem gần lớp khoá, kéo độ mờ, xuất phiếu…) → hộp HopTraPhi
  const [traPhiQh, setTraPhiQh] = useState<string | null>(null);
  const canCuQh = useMemo(() => {
    const ve = encodeURIComponent(lopRieng?.ve || '');
    // bản quét quyết định nằm ở thư mục riêng trên máy chủ → mở qua /api/qh-rieng/tai-lieu/<tên>?v=<vé>
    const lk = (t: string) => (t && !/^https?:/.test(t) && !t.startsWith('/') ? `${API_BASE}/qh-rieng/tai-lieu/${encodeURIComponent(t)}?v=${ve}` : t);
    const them = Object.fromEntries((lopRieng?.lop || []).filter((l) => l.canCu).map((l) => [l.id,
      { ...l.canCu!, tep: lk(l.canCu!.tep), cac: l.canCu!.cac?.map((v) => ({ ...v, tep: lk(v.tep) })) }]));
    return { ...CAN_CU_QH, ...them } as Record<string, CanCu>;
  }, [lopRieng]);
  const [layers, setLayers] = useState<GisLayer[]>([]);
  const [data, setData] = useState<Record<string, GeoJSON.FeatureCollection>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [zoomNow, setZoomNow] = useState(0);
  const layersRef = useRef<GisLayer[]>([]); layersRef.current = layers;
  const visibleRef = useRef<Record<string, boolean>>({}); visibleRef.current = visible;
  const viewRef = useRef<{ west: number; south: number; east: number; north: number; zoom: number } | null>(null);
  const featTimer = useRef<any>(null);
  const [info, setInfo] = useState<ParcelInfo | null>(null);
  const [showSave, setShowSave] = useState(false); // chỉ hiện form lưu sản phẩm khi bấm "Lưu tin này"
  const [clickVN, setClickVN] = useState<{ x: number; y: number; lng: number; lat: number } | null>(null);
  const [flyPoint, setFlyPoint] = useState<{ lng: number; lat: number } | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false); // bottom sheet: thu gọn (bản đồ to) ↔ kéo lên xem đầy đủ (kiểu Guland)
  // NẤC THU NHỎ của bảng thửa (điện thoại, 14/9/2026): chỉ còn dòng "Tờ · Thửa · Diện tích" + tên xã,
  // ẩn trang quy hoạch + hàng nút → bản đồ gần như hiện hết. Ba nấc: thu nhỏ ⇄ vừa ⇄ đầy đủ.
  const [sheetNho, setSheetNho] = useState(false);
  // CHỐT KIỂU "TỰ THU NHỎ" (chủ dự án chọn 14/9/2026 sau khi so 3 kiểu): ngón tay KÉO / PHÓNG bản đồ là bảng
  // tự thu còn 2–3 dòng; chạm dòng đó mở lại; vuốt đầu bảng lên/xuống vẫn đổi nấc bằng tay được.
  // Hai kiểu đã thử rồi GỠ: "Vuốt tay" (bảng đứng yên, chỉ tự vuốt) và "Thẻ ngang" (bảng thấp cố định, thẻ hẹp
  // ló mép, nút biểu tượng) — đừng dựng lại nếu chủ dự án không yêu cầu.
  const vuotBangY = useRef<number | null>(null);
  const vuotBang = {
    onTouchStart: (e: React.TouchEvent) => { vuotBangY.current = e.touches[0].clientY; },
    onTouchEnd: (e: React.TouchEvent) => {
      const y0 = vuotBangY.current; vuotBangY.current = null;
      if (y0 == null) return;
      const dy = e.changedTouches[0].clientY - y0;
      if (dy > 28) {                         // vuốt XUỐNG: đầy đủ → vừa → thu nhỏ
        if (sheetExpanded) setSheetExpanded(false); else setSheetNho(true);
      } else if (dy < -28) {                 // vuốt LÊN: thu nhỏ → vừa → đầy đủ
        if (sheetNho) setSheetNho(false); else setSheetExpanded(true);
      }
    },
  };
  // Màu từng loại đất theo bản quy hoạch (public/mau-loai-dat-qh.json) — tô ô diện tích trong trang lướt.
  const [mauQh, setMauQh] = useState<Record<string, Record<string, string>> | null>(null);
  useEffect(() => { fetch('/mau-loai-dat-qh.json').then((r) => r.json()).then(setMauQh).catch(() => setMauQh({})); }, []);
  // TỰ THU NHỎ: nghe bản đồ — người dùng KÉO / PHÓNG / XOAY (sự kiện có originalEvent, tức do ngón tay,
  // không phải do máy tự bay tới thửa) thì thu bảng thửa về nấc nhỏ. Chỉ điện thoại (< 640px).
  useEffect(() => {
    let m: any = null, hen: any = null;
    const thu = (e: any) => { if (window.innerWidth < 640 && (e?.originalEvent || e?.type === 'dragstart')) { setSheetNho(true); setSheetExpanded(false); } };
    const gan = () => {
      m = (window as any).__banDo;
      if (!m) { hen = setTimeout(gan, 500); return; }
      m.on('dragstart', thu); m.on('zoomstart', thu); m.on('rotatestart', thu); m.on('pitchstart', thu);
    };
    gan();
    return () => { clearTimeout(hen); if (m) { m.off('dragstart', thu); m.off('zoomstart', thu); m.off('rotatestart', thu); m.off('pitchstart', thu); } };
  }, []);
  const trangQhRef = useRef<HTMLDivElement>(null);
  const [trangQh, setTrangQh] = useState(0);
  const [parcelMore, setParcelMore] = useState(true);  // giữ lại cho mấy nút cũ gọi tới; bảng thửa nay hiện đủ, không còn thu gọn
  // Mặc định 70% chứ không phải đặc kín: bật lớp quy hoạch ở 100% thì ranh thửa và số thửa
  // bên dưới bị chìm hẳn, mà người xem chủ yếu cần đối chiếu THỬA với quy hoạch.
  // Ai muốn xem màu thật thì kéo thanh 'Độ mờ' lên 100%.
  // Độ mờ lớp quy hoạch — MẶC ĐỊNH 100%, đừng hạ xuống.
  // Để 80% thì MỌI MÀU đều bị trộn với ảnh vệ tinh bên dưới nên lệch hẳn so với bản vẽ gốc:
  // đất ở #ffdf7f hoá #dac373, dịch vụ #ff7f7f hoá #da7673 — nhìn xỉn đi và KHÔNG còn khớp
  // với màu thấy trong MicroStation. Mà đây là bản đồ quy hoạch, màu phải đúng bản vẽ được
  // duyệt. Ai muốn thấy nhà cửa bên dưới thì tự kéo thanh "Độ mờ" xuống.
  const [opacity, setOpacity] = useState(1);
  // Cột nút đổi nền + thanh độ mờ (điện thoại) TỰ NỐI ngay dưới cụm nút +/−/định vị — xem lib/cotNutBanDo.ts
  const cotNutRef = useRef<HTMLDivElement>(null);
  const cotNutTop = useDayCotNutBanDo(cotNutRef);
  const [canCuOpen, setCanCuOpen] = useState(false);   // bảng Căn cứ pháp lý (nút dấu hỏi trên bản đồ)
  const [nenOpen, setNenOpen] = useState(false);   // điện thoại: bảng chọn nền nổi trên bản đồ đang mở
  // ĐO THẬT THANH MENU ĐÁY (điện thoại). Chiều cao của nó khác nhau theo từng đời iPhone (vạch vuốt
  // về màn hình chính) và theo trình duyệt; đặt cứng "56px + vùng an toàn" thì trên iPhone thật nó vẫn
  // CHE MẤT nút "Tra cứu" / "Vẽ & zoom tới thửa" ở đáy các bảng (chủ dự án chụp màn hình 14/9/2026).
  //   menuDe  = phần thanh menu đè lên KHUNG BẢN ĐỒ (px) → cho các bảng đặt `absolute` trong khung
  //   menuCao = chiều cao thanh menu tính từ đáy MÀN HÌNH (px) → cho bảng đặt `fixed`
  // BÀN PHÍM ĐIỆN THOẠI ĐANG MỞ (học theo app, chủ dự án chê "đẩy lên hết gớm quá" 14/9/2026).
  // Bàn phím iPhone bật lên thì Safari đẩy cả trang lên: thanh menu đáy nổi lơ lửng trên bàn phím,
  // bảng Tra cứu bị kéo mất nửa trên. Cách làm như app: đo MÉP TRÊN BÀN PHÍM bằng visualViewport,
  // bảng đáy dính đúng vào mép đó (fixed), thanh menu đáy + bong bóng chat tạm ẨN (lớp `cl-ban-phim`).
  //   dinh = toạ độ (px, tính từ đầu trang) của mép trên bàn phím; caoNhin = chiều cao vùng còn thấy.
  const [banPhim, setBanPhim] = useState<{ dinh: number; caoNhin: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    // Chiều cao màn hình LÚC CHƯA CÓ BÀN PHÍM. Không so với window.innerHeight được: trên nhiều iPhone,
    // bàn phím bật lên thì innerHeight CŨNG CO LẠI bằng vùng nhìn thấy → hiệu số ≈ 0 → tưởng chưa có
    // bàn phím (lần đầu làm bị đúng lỗi này: menu đáy vẫn nổi trên bàn phím, chủ dự án chụp 14/9/2026).
    let caoGoc = Math.max(window.innerHeight, vv.height);
    const dangGo = () => !!document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName);
    // NỀN ĐỨNG YÊN KHI BẬT BÀN PHÍM (như app, chủ dự án chụp 14/9/2026 18:51): Safari tự CUỘN CẢ TRANG
    // để ô đang gõ không bị bàn phím che → bản đồ + thanh "Cam Lâm Land" trượt lên theo. Trang đã ghim
    // đứng yên, nên hễ Safari cuộn là kéo về 0 ngay; bảng đáy thì đã dính mép bàn phím nên ô gõ vẫn thấy.
    const veDinh = () => { if (window.innerWidth < 1024 && (window.scrollY !== 0 || document.documentElement.scrollTop !== 0)) window.scrollTo(0, 0); };
    const khiBamO = () => { if (!dangGo()) return; [0, 60, 200, 420].forEach((ms) => setTimeout(veDinh, ms)); };
    document.addEventListener('focusin', khiBamO);
    // CHỜ YÊN MỚI XỬ LÝ (chủ dự án 15/9/2026: bấm ô gõ "màn hình rất rung"). Bàn phím trượt lên là Safari bắn
    // hàng chục sự kiện liên tiếp; trước đây sự kiện nào cũng kéo trang về 0 + dời bảng → Safari lại cuộn tiếp
    // → giằng co thành rung. Giờ đợi 120ms không còn sự kiện nào (bàn phím đã yên chỗ) mới làm MỘT lần.
    const hens: any[] = [];
    const cho = (fn: () => void) => { const i = hens.push(0) - 1; return () => { clearTimeout(hens[i]); hens[i] = setTimeout(fn, 120); }; };
    const veDinhCho = cho(veDinh);
    window.addEventListener('scroll', veDinhCho, { passive: true });
    const tinhNgay = () => {
      if (!dangGo()) caoGoc = Math.max(window.innerHeight, vv.height);   // chưa gõ → ghi lại chiều cao đủ
      else veDinh();
      const phanBiChe = caoGoc - vv.height;                              // bàn phím (và thanh công cụ của nó) chiếm
      const mo = phanBiChe > 150 && window.innerWidth < 1024 && dangGo();
      document.documentElement.classList.toggle('cl-ban-phim', mo);
      setBanPhim((c) => {
        if (!mo) return c ? null : c;
        // Mép trên bàn phím theo toạ độ của vật `fixed` = đầu vùng nhìn thấy (offsetTop) + chiều cao vùng nhìn thấy.
    // ⚠️ ĐỪNG lấy min với innerHeight: trên iPhone của chủ dự án, bàn phím bật lên thì innerHeight CO LẠI
    // mà vùng nhìn thấy CŨNG TRƯỢT xuống (offsetTop > 0) → min() trừ mất đoạn trượt, bảng dính cao hơn
    // bàn phím ~230px, nửa trên bị đẩy ra ngoài màn hình (chụp màn hình 14/9/2026, 18:32).
    const moi = { dinh: Math.round(vv.offsetTop + vv.height), caoNhin: Math.round(vv.height) };
        return c && c.dinh === moi.dinh && c.caoNhin === moi.caoNhin ? c : moi;
      });
    };
    const tinh = cho(tinhNgay);
    vv.addEventListener('resize', tinh); vv.addEventListener('scroll', tinh);
    document.addEventListener('focusin', tinh); document.addEventListener('focusout', tinh);
    return () => {
      hens.forEach(clearTimeout);
      vv.removeEventListener('resize', tinh); vv.removeEventListener('scroll', tinh);
      document.removeEventListener('focusin', tinh); document.removeEventListener('focusout', tinh);
      document.removeEventListener('focusin', khiBamO);
      window.removeEventListener('scroll', veDinhCho);
      document.documentElement.classList.remove('cl-ban-phim');
    };
  }, []);
  // Kiểu đặt bảng đáy khi bàn phím mở: dính mép trên bàn phím, cao tối đa 72% vùng còn thấy.
  const kieuBangDay: React.CSSProperties | undefined = banPhim
    ? { position: 'fixed', left: 0, right: 0, bottom: 'auto', top: banPhim.dinh, transform: 'translateY(-100%)', maxHeight: Math.round(banPhim.caoNhin * 0.72), zIndex: 70 }
    : undefined;
  const khungBanDoRef = useRef<HTMLDivElement>(null);
  const [menuDo, setMenuDo] = useState<{ de: number; cao: number } | null>(null);
  useEffect(() => {
    const tinh = () => {
      const k = khungBanDoRef.current;
      const nav = document.querySelector('nav.fixed.bottom-0') as HTMLElement | null;
      if (!k) return;
      // Xét cả KÍCH THƯỚC thật: trang bị NHÚNG trong khung (Tiện ích, ?embed=1) thì thanh menu bị ẩn từ thẻ cha
      // (html.embed .cl-chrome{display:none}) — display của chính nó vẫn 'block' nhưng cao 0, đỉnh = 0 → trước đây
      // tính ra "menu cao bằng cả màn hình", bảng chọn lớp quy hoạch bị đẩy ra ngoài màn hình (thử 14/10/2026).
      const rNav = nav ? nav.getBoundingClientRect() : null;
      const coMenu = !!nav && getComputedStyle(nav).display !== 'none' && !!rNav && rNav.height > 0;
      const dinhMenu = coMenu ? rNav!.top : window.innerHeight;
      const de = Math.max(0, Math.round(k.getBoundingClientRect().bottom - dinhMenu));
      const cao = Math.max(0, Math.round(window.innerHeight - dinhMenu));
      setMenuDo((c) => (c && c.de === de && c.cao === cao ? c : { de, cao }));
    };
    // KHOÁ CUỘN CẢ TRANG khi ở bản đồ (điện thoại): trang gói trong MỘT khung hình như app, vuốt chỉ
    // để kéo bản đồ. Không khoá thì trên iPhone cú vuốt làm trang nhích/nảy → thanh "Cam Lâm Land" và
    // thanh menu đáy tự ẩn (chủ dự án báo 14/9/2026). Rời trang là trả lại như cũ.
    const html = document.documentElement, body = document.body;
    const cu = [html.style.overflow, html.style.overscrollBehavior, body.style.overflow, body.style.overscrollBehavior];
    html.style.overflow = 'hidden'; html.style.overscrollBehavior = 'none';
    body.style.overflow = 'hidden'; body.style.overscrollBehavior = 'none';
    // iPhone (Safari) KHÔNG nghe overflow:hidden khi vuốt — trang vẫn kéo trôi được, thanh "Cam Lâm Land"
    // trượt mất (chủ dự án chụp 14/9/2026). ĐỪNG ghim thân trang bằng position:fixed: đã thử, Safari tính
    // sai chiều cao màn hình → thanh menu đáy bị đẩy lên, hở ~45px dưới đáy (chủ dự án chụp 18:52).
    // Cách dùng: CHẶN CÚ VUỐT kéo trang ngay từ gốc, TRỪ khi ngón tay đang ở trong vùng có nội dung cần
    // cuộn thật (danh sách trong bảng, trang quy hoạch lướt ngang…). Bản đồ tự xử lý cú vuốt của nó
    // nên chặn ở gốc không ảnh hưởng việc kéo/phóng bản đồ.
    const choCuon = (el: EventTarget | null): boolean => {
      let n = el as HTMLElement | null;
      while (n && n !== body && n !== html) {
        const s = getComputedStyle(n);
        if ((/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1) ||
            (/(auto|scroll)/.test(s.overflowX) && n.scrollWidth > n.clientWidth + 1)) return true;
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName)) return true;
        n = n.parentElement;
      }
      return false;
    };
    const chanVuot = (e: TouchEvent) => { if (window.innerWidth < 1024 && e.cancelable && !choCuon(e.target)) e.preventDefault(); };
    document.addEventListener('touchmove', chanVuot, { passive: false });
    html.classList.add('cl-ban-do');   // globals.css: ẩn mọi thanh cuộn xám trên điện thoại
    window.scrollTo(0, 0);
    tinh();
    const t1 = setTimeout(tinh, 400), t2 = setTimeout(tinh, 1500);   // đợi thanh địa chỉ Safari thu gọn xong
    window.addEventListener('resize', tinh);
    window.visualViewport?.addEventListener('resize', tinh);
    const nav = document.querySelector('nav.fixed.bottom-0');
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(tinh) : null;
    if (ro) { if (nav) ro.observe(nav); if (khungBanDoRef.current) ro.observe(khungBanDoRef.current); }
    return () => {
      clearTimeout(t1); clearTimeout(t2); window.removeEventListener('resize', tinh); window.visualViewport?.removeEventListener('resize', tinh); ro?.disconnect();
      [html.style.overflow, html.style.overscrollBehavior, body.style.overflow, body.style.overscrollBehavior] = cu;
      document.removeEventListener('touchmove', chanVuot);
      html.classList.remove('cl-ban-do');
    };
  }, []);
  const [qhSheet, setQhSheet] = useState(false);   // điện thoại: bảng đáy "Chọn bản đồ quy hoạch" đang mở
  const [tcTab, setTcTab] = useState<'goc' | 'to' | 'toado' | 'gmap'>('to'); // thẻ đang mở của bảng đáy Tra cứu
  // Ô số (thửa / tờ) đang gõ bằng BÀN PHÍM SỐ RIÊNG trong bảng Tra cứu điện thoại; null = bàn phím số đóng.
  const [oSo, setOSo] = useState<'thua' | 'to' | null>(null);
  const oSoGia = (loai: 'thua' | 'to', giaTri: string, goiY: string) => (
    <button type="button" onClick={() => { (document.activeElement as HTMLElement | null)?.blur(); setOSo(loai); }}
      className={`flex h-[34px] w-full items-center rounded-lg border px-2.5 text-left text-[16px] ${oSo === loai ? 'border-[#0A2540] ring-1 ring-[#0A2540]' : 'border-slate-300'}`}>
      {giaTri ? <span className="text-[#0A2540]">{giaTri}</span> : <span className="text-slate-400">{goiY}</span>}
      {oSo === loai && <span className="ml-px h-[18px] w-[1.5px] animate-pulse bg-[#0A2540]" />}
    </button>
  );
  const [gocTab, setGocTab] = useState<'bang' | 'anh' | 'dan'>('bang'); // 3 thẻ con của Góc ranh
  const [canDelete, setCanDelete] = useState(false);
  // BẢNG CHÚ GIẢI của bản đồ quy hoạch phân khu. Từ 12/9/2026 bốn bản phân khu được tô màu
  // theo LOẠI ĐẤT (xem ghi chú ở RASTER_OVERLAYS) nên phải có chú giải, không thì người xem
  // chỉ thấy một rừng màu mà không biết màu nào là gì.
  // File `/chu-giai-qh.json` do scripts/qh-pipeline/8-tao-chu-giai.py sinh ra, chỉ liệt kê
  // những loại đất THẬT SỰ có trên bản đồ. Nạp LÚC BẤM MỞ chứ không nạp sẵn — ai không xem
  // chú giải thì không phải tải thêm gì.
  // 10/10/2026: mỗi màu ghi ĐỦ MỌI TÊN (tenDs) — bỏ kiểu "2 tên + 3 loại nữa"; file có thêm `ban` = chú giải RIÊNG
  // từng bản phân khu để chỉ hiện loại đất của bản đang bật.
  type NhomChuGiai = { nhom: string; muc: { mau: string; tenDs: string[]; so: number }[] };
  const [chuGiai, setChuGiai] = useState<{ nhom: NhomChuGiai[]; ban: Record<string, NhomChuGiai[]> } | null>(null);
  const [chuGiaiOpen, setChuGiaiOpen] = useState(false);
  // LỚP MẶC ĐỊNH (15/10/2026): QĐ893 — bản Cam Lâm duy nhất xem miễn phí (chủ dự án: "ở Cam Lâm chỉ cho 893 là được xem free") — cho MỌI
  // tài khoản, kể cả admin (chủ dự án "đưa 2030 lên đầu", "đang mở 893 mà"): trước admin tự đổi sang QĐ205 khi vé về — đã bỏ.
  // Các lớp khác MẶC ĐỊNH TẮT: chồng lên nhau thì màu chồng màu. Người dùng tự tích vào mới hiện.
  const [ovOn, setOvOn] = useState<Record<string, boolean>>({ 'qh-qd205': false, 'qh-qd2076': false, 'qh-qd2101': false, 'qh-qd2222': false, 'qh-qd918': false, 'qh-cuhin': false, 'qh-taynam': false, 'qh-taybac': false, 'qh-qd893': true, 'qh-ninhhoa2030': false, 'qh-nhatrang2030': false, 'qh-khanhson2030': false, 'qh-vanninh2030': false, 'qh-camranh2030': false, 'qh-dienkhanh2030': false, 'qh-khanhvinh2030': false });
  // ĐỊA GIỚI đang chọn để LỌC danh sách lớp quy hoạch — giờ nhiều bản quá, gom theo huyện/thị cho gọn
  // (chủ dự án 14/10/2026: "chọn địa giới rồi hiện quy hoạch ở địa giới đó thôi để đỡ loạn"). Mặc định Cam Lâm.
  const [vungQh, setVungQh] = useState<string>('cam-lam');
  const mucHienThi = useMemo(() => mucQh.filter((o) => o.vung === vungQh), [vungQh, mucQh]);
  // LỚP DỮ LIỆU riêng Cam Lâm (vd "Ranh Thôn Cam Lâm Tháng 7/2026") CHỈ HIỆN khi địa giới đang chọn là Cam Lâm
  // (chủ dự án 14/10/2026). Đổi sang vùng khác thì tắt luôn lớp đó trên bản đồ. "Ranh giới xã" là cả tỉnh nên vẫn hiện.
  const laLopCamLam = (ten: string) => /cam\s*l[aâ]m/i.test(String(ten || '').normalize('NFC'));
  const layersHienThi = useMemo(() => layers.filter((l) => vungQh === 'cam-lam' || !laLopCamLam(l.name)), [layers, vungQh]);
  useEffect(() => {
    if (vungQh === 'cam-lam') return;
    setVisible((v) => { const tat = layers.filter((l) => laLopCamLam(l.name) && v[l.slug]); if (!tat.length) return v; const n = { ...v }; for (const l of tat) n[l.slug] = false; return n; });
  }, [vungQh, layers]);
  const [qhFillOn, setQhFillOn] = useState(false);        // TẮT mặc định — giống Guland: hiển thị bằng ẢNH raster. Bật tay nếu muốn lấp chỗ trống.
  // 'all' = gộp cả 3 kịch bản (phủ kín nhất). Từng kịch bản riêng lẻ chỉ phủ một phần.
  const [qhScenario, setQhScenario] = useState<'all' | 'HT' | '2030' | '2045'>('all');
  const [baseMap, setBaseMap] = useState<BaseMap>('satellite');
  const [labels, setLabels] = useState(true);
  const [ranhXa, setRanhXa] = useState<GeoJSON.FeatureCollection | null>(null);
  const [ranhOn, setRanhOn] = useState(false); // tắt mặc định — ranh xã chờ dữ liệu chuẩn (làm sau)
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [adminAll, setAdminAll] = useState(false);
  const router = useRouter();
  const [pName, setPName] = useState(''); const [pPrice, setPPrice] = useState(''); const [pArea, setPArea] = useState('');
  const [pPhone, setPPhone] = useState(''); const [pComm, setPComm] = useState('');
  const [pOwner, setPOwner] = useState(''); const [pCust, setPCust] = useState('');
  const [pParcel, setPParcel] = useState(''); const [pSheet, setPSheet] = useState(''); const [pWard, setPWard] = useState('');
  const [pFeat, setPFeat] = useState(''); const [pCustName, setPCustName] = useState(''); const [pCustPhone, setPCustPhone] = useState('');
  const [pInterest, setPInterest] = useState(''); const [pDeal, setPDeal] = useState('');
  const dealColor = (s?: string | null) => s === 'Đã chốt' ? '#16a34a' : s === 'Thương lượng' ? '#ea580c' : s === 'Đang tư vấn' ? '#0891b2' : s === 'Không thành' ? '#9ca3af' : '#7c3aed';
  // Bảng đầy đủ khi bấm gim tin lưu (như giỏ hàng) + khách quan tâm
  const [selPlace, setSelPlace] = useState<SavedPlace | null>(null);
  const pinClickRef = useRef(0);
  // Lượt hỏi thông tin thửa: mỗi lần bấm thửa / vẽ thửa tăng 1. Kết quả "thửa tự vẽ" về muộn (máy chủ cắt hình mất vài giây) mà
  // người dùng đã bấm sang thửa khác thì bỏ, không đè lên bảng đang xem.
  const luotThuaRef = useRef(0);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [showAddInt, setShowAddInt] = useState(false);
  const [custList, setCustList] = useState<Customer[]>([]);
  const [iCustId, setICustId] = useState(''); const [iName, setIName] = useState(''); const [iPhone, setIPhone] = useState('');
  const [iInterest, setIInterest] = useState(''); const [iDeal, setIDeal] = useState('');
  const [pImages, setPImages] = useState<string[]>([]); const [pUp, setPUp] = useState(false);
  const [measure, setMeasure] = useState<MeasureMode>('off');
  const [mResult, setMResult] = useState<MeasureResult | null>(null);
  const [focusPoint, setFocusPoint] = useState<{ lng: number; lat: number; label?: string } | null>(null);
  const [highlight, setHighlight] = useState<any>(null);
  // Giữ bản mới nhất của thửa đang tô sáng để hàm chọn lớp quy hoạch đọc được mà không phải
  // dựng lại theo mỗi lần đổi thửa.
  const highlightRef = useRef<any>(null); highlightRef.current = highlight;
  const [searchMode, setSearchMode] = useState<'parcel' | 'vn2000' | 'latlng' | 'gmap'>('parcel');
  const [c1, setC1] = useState(''); const [c2, setC2] = useState('');
  const [c3, setC3] = useState(''); // = XÃ đang chọn (dropdown)
  const [cap, setCap] = useState<'2' | '3'>('2'); // cấp hành chính — MẶC ĐỊNH 2 CẤP (đơn vị hiện hành, chủ dự án 11/10/2026); người dùng tự chuyển 3 cấp

  // ══ BẢN ĐỒ ĐỊA CHÍNH TOÀN TỈNH ═══════════════════════════════════════════════
  // Lớp này LUÔN BẬT, không có nút tắt và không hiện trong bảng "Lớp bản đồ".
  // Muốn xem được phải có "vé" ngắn hạn xin từ máy chủ; vé gắn với máy người xem và
  // tự động xin lại trước khi hết hạn, người dùng không phải làm gì.
  const [ve, setVe] = useState<string>('');
  useEffect(() => {
    let con = true; let hen: any;
    const xinVe = () => {
      api<{ ve: string; songThem: number }>('/dc/ve')
        .then((r) => {
          if (!con) return;
          setVe(r.ve || '');
          // Xin vé mới khi còn khoảng 1/5 thời gian — không bao giờ để đứt quãng giữa chừng.
          hen = setTimeout(xinVe, Math.max(60, (r.songThem || 2700) * 0.8) * 1000);
        })
        .catch(() => { if (con) hen = setTimeout(xinVe, 30000); });   // hỏng mạng thì thử lại sau 30 giây
    };
    xinVe();
    return () => { con = false; clearTimeout(hen); };
  }, []);
  // Địa chỉ ô bản đồ PHẢI ghi ĐẦY ĐỦ (có http://tên-miền), không được ghi tắt kiểu "/api/dc/...".
  // Lý do: bản đồ nạp ô ở một luồng chạy nền riêng; luồng đó không biết trang web đang ở đâu
  // nên đường dẫn ghi tắt sẽ hỏng và KHÔNG ô nào tải được (ranh thửa mất sạch, không báo lỗi gì).
  const dcTiles = useMemo(() => {
    if (!ve) return null;
    const goc = typeof window !== 'undefined' ? window.location.origin : '';
    const duong = API_BASE.startsWith('http') ? API_BASE : goc + API_BASE;
    return [`${duong}/dc/{z}/{x}/{y}.mvt?v=${encodeURIComponent(ve)}`];
  }, [ve]);

  // Danh mục xã/phường lấy THẲNG TỪ DỮ LIỆU (không ghi cứng trong code nữa) — 147 xã toàn tỉnh,
  // chia hai nhóm: 2 cấp (đơn vị mới sau sáp nhập) và 3 cấp (đơn vị cũ).
  // soThua có thể KHÔNG có: máy chủ chỉ gửi số thửa cho tài khoản quản trị.
  type XaDc = { xaId: string; ten: string; tenKd: string; huyen: string; soThua?: number; coBangTo?: boolean; bbox: number[]; tam: number[] };
  const [dsXa, setDsXa] = useState<{ cap2: XaDc[]; cap3: XaDc[] }>({ cap2: [], cap3: [] });
  useEffect(() => { api<{ cap2: XaDc[]; cap3: XaDc[] }>('/dc/danh-muc').then(setDsXa).catch(() => {}); }, []);

  const [huyenChon, setHuyenChon] = useState('');   // huyện/TP cũ đang chọn
  // Danh sách thửa tìm được. Từ khi tra theo XÃ MỚI, một số tờ/số thửa rất hay trùng nhau
  // giữa các xã cũ nay cùng thuộc một xã mới → phải cho người dùng chọn, không thể tự lấy cái đầu.
  type ThuaTim = { id: string; soTo: string; soThua: string; tenXa: string; tenXaCu: string | null;
                   huyenCu: string | null; dienTich: number | null; lng: number; lat: number; hinh: any };
  const [ketQuaTim, setKetQuaTim] = useState<ThuaTim[]>([]);
  // Danh sách xã của cấp đang chọn (2 cấp = đơn vị mới, 3 cấp = đơn vị cũ)
  const dsXaCap = useMemo(() => (cap === '2' ? dsXa.cap2 : dsXa.cap3), [dsXa, cap]);
  // Danh sách huyện/TP cũ (hoặc khu vực với nhóm 2 cấp), kèm số xã trong đó
  // CAM LÂM LUÔN LÊN ĐẦU danh sách huyện và xã (chủ dự án yêu cầu 14/9/2026 — web của Cam Lâm, người
  // dùng tra đất Cam Lâm là chủ yếu). Nhận ra bằng: tên huyện có "Cam Lâm" (3 cấp), hoặc đúng 4 mã xã
  // mới của huyện Cam Lâm cũ (2 cấp: danh mục ghi huyện chung "Khánh Hoà (cũ)" nên phải dựa vào mã).
  const XA_MOI_CAM_LAM = ['22453', '22708', '22435', '22465'];   // Xã Cam Lâm · Suối Dầu · Cam Hiệp · Cam An
  const laCamLam = (s: string) => boDauVn(s || '').includes('cam lam');
  const dsHuyen = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of dsXaCap) m.set(x.huyen, (m.get(x.huyen) || 0) + 1);
    return [...m.entries()].sort((a, b) => (Number(laCamLam(b[0])) - Number(laCamLam(a[0]))) || a[0].localeCompare(b[0], 'vi'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dsXaCap]);
  // Chọn huyện nào thì ô xã chỉ sổ ra xã của huyện đó
  const xaTheoHuyen = useMemo(() => {
    const ds = huyenChon ? dsXaCap.filter((x) => x.huyen === huyenChon) : dsXaCap;
    const uuTien = (x: { xaId: string; huyen: string }) => Number(laCamLam(x.huyen) || XA_MOI_CAM_LAM.includes(x.xaId));
    return [...ds].sort((a, b) => uuTien(b) - uuTien(a));   // sort ổn định: trong mỗi nhóm giữ thứ tự cũ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dsXaCap, huyenChon]);
  // Đổi huyện/xã là DỌN SẠCH mọi thứ của địa bàn cũ: bảng "Thông tin thửa" đang mở, ranh thửa
  // đang tô sáng, ô số tờ/số thửa vừa gõ, ghim vị trí cũ... Nếu không dọn, người dùng chọn xã khác
  // mà vẫn thấy thửa của xã trước — rất dễ nhìn nhầm thành thửa của xã mới chọn.
  const donKetQuaCu = useCallback(() => {
    setInfo(null); setHighlight(null); setFocusPoint(null); setClickVN(null);
    setSelPlace(null); setParcelMore(false); setSheetExpanded(false);
    setC1(''); setC2(''); setKetQuaTim([]);   // xoá số tờ / số thửa + danh sách kết quả của lần tra trước
    setMResult(null);
  }, []);

  // Chọn xã (từ ô gõ tên hoặc từ danh sách sổ xuống) → bản đồ bay thẳng tới xã đó.
  const bayToiXa = useCallback((x: XaDc | null) => {
    if (!x || !x.bbox || x.bbox.length !== 4 || !Number.isFinite(x.bbox[0])) return;
    setFitTo([[x.bbox[0], x.bbox[1]], [x.bbox[2], x.bbox[3]]]);
    setPanelOpen(false);
  }, []);
  // Mở từ TRANG ĐỊA DANH (/ban-do/<xã>, 13/10/2026): /map?xa=<mã xã> → chọn sẵn xã đó trong ô tra cứu (đúng cấp: mã xã mới = 2 cấp,
  // xã cũ = 3 cấp, 'g' + mã = đơn vị cũ gốc) rồi bay tới VỪA KHUNG CẢ XÃ. Không mở bảng thửa nào (khác ?lng=&lat= của mã QR).
  const daMoTheoXa = useRef(false);
  useEffect(() => {
    if (daMoTheoXa.current || !(dsXa.cap2.length || dsXa.cap3.length)) return;
    daMoTheoXa.current = true;
    let ma = '';
    try { ma = (new URLSearchParams(window.location.search).get('xa') || '').trim(); } catch { /* */ }
    if (!ma) return;
    const x2 = dsXa.cap2.find((y) => y.xaId === ma);
    const x = x2 || dsXa.cap3.find((y) => y.xaId === ma);
    if (!x) return;
    setCap(x2 ? '2' : '3'); setC3(ma); setHuyenChon(x.huyen);
    // Danh mục xã về TRƯỚC khi bản đồ dựng xong → lệnh "vừa khung" gửi sớm bị MapView bỏ qua (nó chỉ nhận khi đã có bản đồ),
    // rồi bước tự khớp khung vùng quy hoạch lúc mở còn ghi đè. Chờ KIỂU BẢN ĐỒ nạp xong (isStyleLoaded — đúng mốc MapView khởi tạo lớp
    // + tự khớp khung; ĐỪNG chờ loaded(): Chrome có lúc báo false mãi, xem ghi chú khoiTaoLop trong MapView) rồi mới bay.
    let lan = 0;
    const cho = () => {
      const bd = (window as any).__banDo;
      if (bd && typeof bd.isStyleLoaded === 'function' && bd.isStyleLoaded()) { setTimeout(() => bayToiXa(x), 400); return; }
      if (++lan < 80) setTimeout(cho, 250);
    };
    cho();
  }, [dsXa, bayToiXa]);

  // ── TỰ CHỌN ĐỊA GIỚI THEO CHỖ ĐANG XEM (chủ dự án 11/10/2026) ──
  // Phóng tới mức THẤY THỬA (≥ 16) thì ô tìm kiếm tự chọn xã/phường (và huyện) của thửa ở GIỮA MÀN HÌNH — mặc định theo 2 cấp
  // (xã mới); người dùng đã chuyển sang 3 cấp thì chọn theo xã CŨ (đơn vị gốc của xã mới có dòng riêng mã 'g…').
  // Chỉ điền ô chọn — KHÔNG dọn kết quả đang xem, KHÔNG bay bản đồ (khác với khi người dùng tự chọn xã).
  const [tamXem, setTamXem] = useState<{ lng: number; lat: number } | null>(null);
  const xaTaiNho = useRef<Map<string, { xaId?: string; cap?: number; xaMoiId?: string }>>(new Map());
  useEffect(() => {
    if (!tamXem || !(dsXa.cap2.length || dsXa.cap3.length)) return;
    let huy = false;
    const t = setTimeout(async () => {
      const k = `${tamXem.lng.toFixed(3)},${tamXem.lat.toFixed(3)}`;
      let kq = xaTaiNho.current.get(k);
      if (!kq) {
        kq = await api<{ xaId?: string; cap?: number; xaMoiId?: string }>(`/dc/xa-tai?lng=${tamXem.lng.toFixed(6)}&lat=${tamXem.lat.toFixed(6)}`).catch(() => ({}));
        if (xaTaiNho.current.size > 300) xaTaiNho.current.clear();
        xaTaiNho.current.set(k, kq);
      }
      if (huy || !kq?.xaId) return;
      const ma = cap === '2' ? (kq.xaMoiId || kq.xaId) : (kq.cap === 3 ? kq.xaId : 'g' + kq.xaId);
      const x = (cap === '2' ? dsXa.cap2 : dsXa.cap3).find((y) => y.xaId === ma);
      if (!x) return;
      setC3((cu) => (cu === ma ? cu : ma));
      setHuyenChon((cu) => (cu === x.huyen ? cu : x.huyen));
    }, 600);
    return () => { huy = true; clearTimeout(t); };
  }, [tamXem, cap, dsXa]);

  const [panelOpen, setPanelOpen] = useState(false);
  const [ads, setAds] = useState<any[]>([]);
  const [qhVector, setQhVector] = useState<GeoJSON.FeatureCollection | null>(null);
  const qhVectorRef = useRef<GeoJSON.FeatureCollection | null>(null); qhVectorRef.current = qhVector;
  const [qhvHit, setQhvHit] = useState<{ lo: string; hz: string }[]>([]);
  const [fitTo, setFitTo] = useState<[[number, number], [number, number]] | null>(null);
  const [drawOpen, setDrawOpen] = useState(false);
  const [drawTab, setDrawTab] = useState<'table' | 'import'>('table');
  const [rows, setRows] = useState<{ x: string; y: string }[]>([{ x: '', y: '' }, { x: '', y: '' }, { x: '', y: '' }]);
  const [camOpen, setCamOpen] = useState(false);
  const [camFlash, setCamFlash] = useState(false);
  const camVideoRef = useRef<HTMLVideoElement>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const [ocrBusy, setOcrBusy] = useState('');
  const [ocrPct, setOcrPct] = useState(0);
  const ocrTimer = useRef<any>(null);
  const [ocrOk, setOcrOk] = useState(0);
  const [ocrEngine, setOcrEngine] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [drawResult, setDrawResult] = useState<{ n: number; area: number; perim: number; lat: number; lng: number; hinh?: { type: 'Polygon'; coordinates: number[][][] } } | null>(null);
  const [dangKiemVe, setDangKiemVe] = useState(false);   // đang chờ máy chủ tính quy hoạch cho thửa vừa vẽ
  const [tool, setTool] = useState<'none' | 'search' | 'chugiai' | 'measure'>('none'); // bảng công cụ trên mobile
  const [bangMuc, setBangMuc] = useState<'lop' | 'luu'>('lop'); // mẫu 51: khung nổi đang hiện LỚP hay ĐÃ LƯU (tách cho khỏi trùng)
  const [timMo, setTimMo] = useState(false); // mẫu 51: khung tìm mở rộng dưới ô tìm nổi (máy tính)
  useEffect(() => { if (tool !== 'search' || tcTab !== 'to') setOSo(null); }, [tool, tcTab]);
  useEffect(() => { document.documentElement.classList.toggle('cl-bang-day', tool === 'search' || tool === 'measure'); return () => document.documentElement.classList.remove('cl-bang-day'); }, [tool]);   // globals.css: ẩn bong bóng chat khi bảng đáy mở   // đóng bảng / đổi thẻ → tắt bàn phím số
  // ==== CHỈ ĐƯỜNG NHIỀU TUYẾN ====
  const [dirDen, setDirDen] = useState<Diem | null>(null);     // điểm đến (bấm nút 🧭 là có) — có nó thì bảng chỉ đường mở
  const [dirDi, setDirDi] = useState<Diem | null>(null);       // điểm đi (mặc định lấy vị trí hiện tại)
  const [dirTuyen, setDirTuyen] = useState<TuyenVe[]>([]);     // các phương án đường đi để vẽ lên bản đồ
  const [dirChon, setDirChon] = useState<number | null>(null); // tuyến vừa bấm chọn NGAY TRÊN bản đồ
  const [dirNhat, setDirNhat] = useState<'di' | 'den' | null>(null); // đang chờ người dùng bấm lên bản đồ để nhặt điểm
  const dirNhatRef = useRef<'di' | 'den' | null>(null); dirNhatRef.current = dirNhat;
  // Mở bảng chỉ đường tới một chỗ. Thay cho kiểu cũ là nhảy thẳng sang Google Maps.
  const moChiDuong = useCallback((lat: number, lng: number, ten?: string) => {
    setDirDen({ lat, lng, ten }); setDirChon(null); setTool('none'); setSheetExpanded(false);
  }, []);

  const refreshFeatures = useCallback((v: { west: number; south: number; east: number; north: number; zoom: number }) => {
    const bbox = `${v.west},${v.south},${v.east},${v.north}`;
    // Máy chủ TỪ CHỐI (400) khung nhìn rộng quá 0,6° (chống cào — routes/layers.ts). Thu nhỏ bản đồ ra
    // quá mức đó thì đừng gửi: trước đây vẫn gửi → nhật ký nginx đầy lỗi 400 vô ích. Lớp giữ nguyên
    // dữ liệu đang có, phóng to lại là tải tiếp.
    if (Math.abs(v.east - v.west) > 0.6 || Math.abs(v.north - v.south) > 0.6) return;
    for (const l of layersRef.current) {
      const vis = visibleRef.current[l.slug] ?? false;
      if (!vis) continue;
      const minZ = (l.layerType === 'parcel' || l.layerType === 'custom') ? PARCEL_MIN_ZOOM : (l.layerType === 'zoning' ? ZONING_MIN_ZOOM : 0);
      if (minZ && v.zoom < minZ) { setData((d) => ({ ...d, [l.slug]: { type: 'FeatureCollection', features: [] } })); continue; }
      api<GeoJSON.FeatureCollection>(`/layers/${l.slug}/features?bbox=${bbox}&z=${Math.round(v.zoom)}`).then((fc) => setData((d) => ({ ...d, [l.slug]: fc }))).catch(() => {});
    }
  }, []);
  const onViewport = useCallback((v: { west: number; south: number; east: number; north: number; zoom: number }) => {
    viewRef.current = v; setZoomNow(v.zoom);
    clearTimeout(featTimer.current); featTimer.current = setTimeout(() => refreshFeatures(v), 350);
    // tâm màn hình khi đã phóng tới mức thấy thửa → ô tìm kiếm tự chọn địa giới (xem tamXem)
    setTamXem(v.zoom >= 16 ? { lng: (v.west + v.east) / 2, lat: (v.south + v.north) / 2 } : null);
  }, [refreshFeatures]);
  // BẬT MỘT MỤC QUY HOẠCH. Mỗi lúc chỉ một mục; mục "phân khu" bật cùng lúc cả ba bản 2076/2101/2222.
  // ⚠️ KHÔNG tự thu/dời bản đồ nữa. Trước đây bật lớp ở nơi khác thì bản đồ tự lùi ra cho thấy cả lớp,
  // nhưng từ khi ba bản phân khu được ghép lại thì lớp nào cũng phủ gần kín huyện — tự nhảy khung chỉ
  // làm người xem mất chỗ đang xem.
  const chonLopQh = useCallback((muc: { gom: string[]; zBay?: number }, bat: boolean) => {
    const tat: Record<string, boolean> = Object.fromEntries(rasterOverlaysRef.current.map((x) => [x.id, false]));
    if (bat) for (const id of muc.gom) tat[id] = true;
    setOvOn(tat);
    // BẬT BẢN QUY HOẠCH MÀ ĐANG NHÌN QUÁ XA (chủ dự án yêu cầu 14/9/2026):
    // mức phóng hiện tại NHỎ HƠN mức phóng tối thiểu của bản đó (ảnh chưa vẽ ở mức này → nhìn như không có gì)
    // thì bay tới TÂM VÙNG QUY HOẠCH và phóng đúng tới mức tối thiểu. Đang phóng đủ gần thì giữ nguyên chỗ đang xem.
    // Bản gộp nhiều mảnh (Phân khu 1/2000): lấy khung bao chung của mọi mảnh, mức tối thiểu nhỏ nhất.
    if (!bat) return;
    const cac = rasterOverlaysRef.current.filter((o) => muc.gom.includes(o.id));
    if (!cac.length) return;
    const zMin = Math.min(...cac.map((o) => (o as any).minzoom ?? 0));
    const xs = cac.flatMap((o) => o.coordinates.map((c) => c[0]));
    const ys = cac.flatMap((o) => o.coordinates.map((c) => c[1]));
    const tam: [number, number] = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
    // ⚠️ minzoom khai ở trên là mức của BỘ ẢNH (ô 256px). Thư viện bản đồ tính mức phóng theo ô 512px,
    // nên ô ảnh mức N đã hiện ở mức phóng BẢN ĐỒ N−1. Bay tới đúng N là sâu thừa 1 nấc (chủ dự án thấy
    // QĐ205 "zoom hơi sâu", 14/9/2026) → mức nhỏ nhất thấy được ảnh = N − 1.
    const zThay = muc.zBay ?? zMin - 1;
    const m: any = (window as any).__banDo;
    // Bay tới lớp khi: (a) đang nhìn QUÁ XA (zoom < zThay) HOẶC (b) tâm bản đồ đang Ở NGOÀI vùng lớp.
    // (b) thêm 13/10/2026 cho các lớp ở XA Cam Lâm (vd QHSDĐ Ninh Hòa): người dùng đang xem Cam Lâm,
    // bật lớp Ninh Hòa mà mức phóng vẫn ≥ zThay thì trước đây KHÔNG bay → tưởng lớp trống. Nay đứng
    // ngoài vùng là bay tới, dù đang phóng gần.
    const c0 = m && m.getCenter ? m.getCenter() : null;
    const ngoaiVung = !!c0 && (c0.lng < Math.min(...xs) || c0.lng > Math.max(...xs) || c0.lat < Math.min(...ys) || c0.lat > Math.max(...ys));
    if (!(m && zThay > 0 && (m.getZoom() < zThay || ngoaiVung))) return;
    // TẢI TRƯỚC ẢNH QUY HOẠCH rồi mới bay (chủ dự án 15/9/2026: điện thoại mạng chậm, bay tới nơi mà ảnh chưa
    // về kịp → bản đồ hiện LỖ CHỖ từng mảng vuông). Tính đúng những ô sẽ cần ở mức phóng đích (ảnh 256px nên
    // mức ô = mức bản đồ + 1, làm tròn như thư viện bản đồ), tải sẵn vào bộ nhớ đệm trình duyệt, xong thì bay.
    // Chờ tối đa 1,8 giây — mạng quá chậm cũng không bắt người dùng đợi lâu.
    const urls: string[] = [];
    for (const o of cac as any[]) {
      if (!o.tiles?.[0]) continue;
      const tzDich = Math.max(o.minzoom ?? 0, Math.min(o.maxzoom ?? 18, Math.round(zThay + 1)));
      // Tải cả mức ngay dưới: trên đường bay bản đồ đi qua mức đó trước, thiếu thì cũng lỗ chỗ.
      for (const tz of [tzDich - 1, tzDich]) {
      if (tz < (o.minzoom ?? 0)) continue;
      const n = 2 ** tz;
      const ox = (lng: number) => Math.floor(((lng + 180) / 360) * n);
      const oy = (lat: number) => { const r = (lat * Math.PI) / 180; return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n); };
      const lx = o.coordinates.map((c: number[]) => c[0]), ly = o.coordinates.map((c: number[]) => c[1]);
      for (let x = ox(Math.min(...lx)); x <= ox(Math.max(...lx)); x++)
        for (let y = oy(Math.max(...ly)); y <= oy(Math.min(...ly)); y++)
          urls.push(o.tiles[0].replace('{z}', String(tz)).replace('{x}', String(x)).replace('{y}', String(y)));
      }
    }
    let daBay = false;
    const bay = () => { if (daBay) return; daBay = true; m.easeTo({ center: tam, zoom: zThay, duration: 900 }); };
    if (!urls.length || urls.length > 60) { bay(); return; }
    let con = urls.length;
    for (const u of urls) { const im = new Image(); im.onload = im.onerror = () => { if (--con <= 0) bay(); }; im.src = u; }
    setTimeout(bay, 1800);
  }, []);
  // ĐỔI ĐỊA GIỚI đang lọc: tắt mọi lớp đang bật (vì danh sách lớp đổi theo vùng mới), đổi vùng,
  // rồi BAY TỚI tâm địa giới đó cho người xem thấy ngay mình đang ở đâu. Không tự bật lớp nào —
  // để người xem tự chọn bản muốn xem trong vùng (tránh chồng màu loạn).
  const doiVung = useCallback((idVung: string) => {
    setVungQh(idVung);
    setOvOn(Object.fromEntries(rasterOverlaysRef.current.map((x) => [x.id, false])));  // tắt overlay vùng cũ cho khỏi chồng
    const v = VUNG_QH.find((x) => x.id === idVung);
    const m: any = (window as any).__banDo;
    if (v && m && m.easeTo) m.easeTo({ center: [v.tamXem[0], v.tamXem[1]], zoom: v.tamXem[2], duration: 900 });
  }, []);
  // ĐẨY BẢN ĐỒ KHI THỬA BỊ BẢNG CHE.
  // Bảng "Thông tin thửa" nằm giữa-dưới, hay đè lên đúng thửa vừa bấm. Hàm này đo vị trí bảng,
  // chiếu tâm thửa ra toạ độ màn hình; nếu tâm thửa rơi vào trong bảng thì trượt bản đồ đúng đoạn
  // NGẮN NHẤT để thửa lọt ra ngoài. Không đổi mức phóng, và KHÔNG chạy nếu thửa vốn đã nhìn thấy.
  const tranhBiChe = useCallback((hinh: any) => {
    setTimeout(() => {
      const m: any = (window as any).__banDo;
      const el = document.getElementById('bang-thua');
      const kh = bboxHinh(hinh);
      if (!m || !el || !kh) return;
      const r = el.getBoundingClientRect();
      const c = m.getContainer().getBoundingClientRect();
      const p = m.project([(kh[0] + kh[2]) / 2, (kh[1] + kh[3]) / 2]);
      const x = p.x + c.left, y = p.y + c.top;
      const LE = 28;
      if (x < r.left - LE || x > r.right + LE || y < r.top - LE || y > r.bottom + LE) return;
      const sangTrai = x - (r.left - LE);
      const lenTren = y - (r.top - LE);
      const conTrai = r.left - c.left, conTren = r.top - c.top;
      // Bảng nằm GIỮA-DƯỚI nên chỗ trống nhiều nhất là PHÍA TRÊN → ưu tiên đẩy lên.
      if (conTren > 150 && lenTren <= sangTrai * 1.8) m.panBy([0, lenTren], { duration: 420 });
      else if (conTrai > 200) m.panBy([sangTrai, 0], { duration: 420 });
      else m.panBy([0, lenTren], { duration: 420 });
    }, 80);
  }, []);
  const load = useCallback(() => {
    api<{ layers: GisLayer[] }>('/layers').then(({ layers }) => {
      setLayers(layers);
      setVisible((prev) => Object.fromEntries(layers.map((l) => [l.slug, prev[l.slug] ?? false])));
      if (viewRef.current) refreshFeatures(viewRef.current);
    }).catch(() => {});
  }, [refreshFeatures]);
  useEffect(() => { load(); api<any>('/map-ads/active').then((r) => setAds(r.ads || [])).catch(() => {}); }, [load]);
  // qh_vector (2.1MB) chủ yếu để TRA loại đất khi bấm (giống "dữ liệu ô đất" của Meey Map);
  // phần HIỂN THỊ do ảnh raster lo (giống Guland) → nạp TRỄ lúc rảnh cho nhẹ.
  // (15/10/2026) KHOÁ CAM LÂM: đây là ô đất QĐ205 → chỉ người có vé mới tải, qua /api/qh-rieng/tep/qh_vector (đường /qh_vector.geojson
  // công khai đã bị nginx chặn). Người khác không tải gì.
  useEffect(() => {
    if (!lopRieng?.ve) { setQhVector(null); return; }
    const ve = encodeURIComponent(lopRieng.ve);
    const go = () => fetch(`${API_BASE}/qh-rieng/tep/qh_vector?v=${ve}`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setQhVector(d); }).catch(() => {});
    const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, o?: any) => number);
    const id = ric ? ric(go, { timeout: 4000 }) : window.setTimeout(go, 1800);
    return () => { const cic = (window as any).cancelIdleCallback; if (ric && cic) cic(id); else clearTimeout(id); };
  }, [lopRieng]);
  useEffect(() => { if (viewRef.current) refreshFeatures(viewRef.current); }, [visible, refreshFeatures]);
  useEffect(() => { setCanDelete(laAdmin(user) || coVaiTro(user, 'gis')); }, [user]);
  // Chỉ tải ranh xã (384KB) KHI người dùng bật lớp — mặc định tắt nên không tốn dữ liệu trên điện thoại.
  useEffect(() => { if (!ranhOn || ranhXa) return; fetch('/ranh-xa.geojson').then((r) => (r.ok ? r.json() : null)).then(setRanhXa).catch(() => {}); }, [ranhOn, ranhXa]);
  const loadPlaces = useCallback(async () => {
    if (!user) { setPlaces([]); return; }
    try { setPlaces((adminAll && laAdmin(user)) ? await listAllPlaces() : await listMyPlaces()); } catch { setPlaces([]); }
  }, [user, adminAll]);
  useEffect(() => { loadPlaces(); }, [loadPlaces]);
  // "Đăng tin này": mang sản phẩm đã lưu sang form đăng tin (đổ sẵn tên/giá/diện tích/ảnh/vị trí).
  function publishPlace(p: SavedPlace) {
    try { sessionStorage.setItem('camlam_draft', JSON.stringify({ id: p.id, note: p.note, price: p.price, area: p.area, images: p.images, lng: p.lng, lat: p.lat, x: p.x, y: p.y })); } catch { /* ignore */ }
    router.push('/sales/post');
  }
  async function savePlace() {
    if (!clickVN) return;
    const miss: string[] = [];
    if (!pName.trim()) miss.push('Tên/mô tả'); if (!pParcel.trim()) miss.push('Thửa'); if (!pSheet.trim()) miss.push('Tờ'); if (!pWard.trim()) miss.push('Xã');
    if (!pFeat.trim()) miss.push('Đặc điểm'); if (!pPrice.trim()) miss.push('Giá'); if (!pArea.trim()) miss.push('Diện tích');
    if (!pOwner.trim()) miss.push('Tên chủ'); if (!pPhone.trim()) miss.push('SĐT chủ');
    if (miss.length) { alert('Vui lòng nhập đầy đủ: ' + miss.join(', ') + '.\n(Chỉ "Hoa hồng" không bắt buộc)'); return; }
    try {
      await addPlace({ lng: clickVN.lng, lat: clickVN.lat, x: clickVN.x, y: clickVN.y, note: pName.trim(),
        parcel: pParcel.trim() || undefined, sheet: pSheet.trim() || undefined, ward: pWard.trim() || undefined, features: pFeat.trim() || undefined,
        price: pPrice.trim() || undefined, area: pArea.trim() || undefined, owner: pOwner.trim() || undefined, phone: pPhone.trim() || undefined,
        commission: pComm.trim() || undefined, images: pImages });
      setPName(''); setPPrice(''); setPArea(''); setPOwner(''); setPPhone(''); setPComm(''); setPParcel(''); setPSheet(''); setPWard(''); setPFeat(''); setPImages([]); loadPlaces();
    } catch (e: any) { alert('Lỗi lưu: ' + (e?.message || e)); }
  }
  async function onPlaceFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []); e.target.value = '';
    if (!files.length) return;
    const room = Math.max(0, 5 - pImages.length);
    if (room <= 0) { alert('Tối đa 5 ảnh.'); return; }
    setPUp(true);
    try { const up = await uploadImages(files.slice(0, room)); setPImages((p) => [...p, ...up.map((u) => u.url)].slice(0, 5)); }
    catch (err: any) { alert('Lỗi tải ảnh: ' + (err?.message || err)); } finally { setPUp(false); }
  }
  useEffect(() => { if (!camOpen) return; const v = camVideoRef.current, st = camStreamRef.current; if (!v || !st) return; v.srcObject = st; v.setAttribute('playsinline', 'true'); v.play().catch(() => {}); }, [camOpen]);
  // Giải phóng camera khi rời trang (tránh giữ camera chạy ngầm trên điện thoại).
  useEffect(() => () => { camStreamRef.current?.getTracks().forEach((t) => t.stop()); camStreamRef.current = null; if (ocrTimer.current) clearInterval(ocrTimer.current); }, []);

  // XEM THỬ lớp khoá (tài khoản thường): mức bản đồ ≥ mức ô xa nhất − 0,5 là thư viện bản đồ đã muốn ô mức gần hơn → lớp bị khoá (ẩn).
  // `quaXemThu` = các mức xem thử đã vượt (chuỗi) — chỉ đổi khi VƯỢT NGƯỠNG, không đổi theo từng lần kéo bản đồ.
  const quaXemThu = useMemo(() => [...new Set(rasterOverlays.map((o) => (o as any).xemThu).filter((z) => z != null) as number[])]
    .filter((z) => zoomNow >= z - 0.5).sort().join(','), [rasterOverlays, zoomNow]);
  const overlays: ImageOverlay[] = useMemo(() => {
    const qua = new Set(quaXemThu ? quaXemThu.split(',').map(Number) : []);
    return rasterOverlays.map((o) => {
      const zXa = (o as any).xemThu;
      return { id: o.id, url: o.url, coordinates: o.coordinates,
        opacity: !coGoi && LOP_CAM_LAM.has(o.id) ? 1 : opacity,                  // tài khoản thường: lớp Cam Lâm luôn đậm đủ
        visible: !!ovOn[o.id] && !(zXa != null && qua.has(Number(zXa))),        // xem thử: phóng gần quá mức → ẩn
        pmtiles: (o as any).pmtiles, fillMaxzoom: (o as any).fillMaxzoom, tiles: (o as any).tiles, minzoom: (o as any).minzoom, maxzoom: (o as any).maxzoom };
    });
  }, [opacity, ovOn, rasterOverlays, coGoi, quaXemThu]);
  // Lớp xem thử đang bật (tài khoản thường) + đã phóng gần quá mức chưa → nhãn 🔒 trên bản đồ; VỪA vượt ngưỡng (do phóng to) thì bật
  // hộp "tính năng trả phí" một lần. Mới chọn lớp khi đang ở gần thì KHÔNG bật hộp (bản đồ tự lùi ra — bamMucQh).
  const xemThuDangBat = useMemo(() => {
    const cac = rasterOverlays.filter((o) => (o as any).xemThu != null && !!ovOn[o.id]);
    if (!cac.length) return null;
    const z = Math.min(...cac.map((o) => Number((o as any).xemThu)));
    const muc = MUC_QH.find((m) => m.gom.includes(cac[0].id));
    return { z, ten: muc?.ten || 'Bản đồ quy hoạch' };
  }, [rasterOverlays, ovOn]);
  const khoaGan = !!xemThuDangBat && zoomNow >= xemThuDangBat.z - 0.5;
  const zoomTruocRef = useRef(zoomNow);
  useEffect(() => {
    const truoc = zoomTruocRef.current; zoomTruocRef.current = zoomNow;
    if (!xemThuDangBat) return;
    const nguong = xemThuDangBat.z - 0.5;
    if (zoomNow >= nguong && truoc > 0 && truoc < nguong) setTraPhiQh(`Xem ${xemThuDangBat.ten}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomNow]);
  // Thanh độ mờ: tài khoản thường + đang bật lớp Cam Lâm → khoá (chạm vào là hộp trả phí)
  const khoaDoMo = !coGoi && rasterOverlays.some((o) => LOP_CAM_LAM.has(o.id) && !!ovOn[o.id]);
  const doMoHien = khoaDoMo ? 1 : opacity;

  // Lớp TÔ MÀU quy hoạch từ qh_vector: lọc theo kịch bản (hz), tô theo màu sẵn (thuộc tính c).
  // Sắp xếp thửa DIỆN TÍCH LỚN vẽ trước → thửa nhỏ (cụ thể) nằm trên, không bị che.
  const qhFillFC = useMemo(() => {
    const all = (qhVector?.features as any[]) || [];
    const fs = qhScenario === 'all' ? all : all.filter((f) => String(f?.properties?.hz) === qhScenario);
    const ringArea = (f: any) => {
      const g = f.geometry; if (!g) return 0;
      const ring = g.type === 'Polygon' ? g.coordinates?.[0] : g.coordinates?.[0]?.[0];
      if (!ring || ring.length < 4) return 0;
      let s = 0; for (let i = 0; i < ring.length - 1; i++) s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
      return Math.abs(s);
    };
    const sorted = [...fs].sort((a, b) => ringArea(b) - ringArea(a));
    return { type: 'FeatureCollection', features: sorted } as GeoJSON.FeatureCollection;
  }, [qhVector, qhScenario]);

  // Chú giải: các loại đất đang hiện + màu (gộp trùng), sắp theo số thửa nhiều → ít.
  const qhLegend = useMemo(() => {
    const cnt = new Map<string, { c: string; n: number }>();
    for (const f of qhFillFC.features as any[]) {
      const lo = f.properties?.lo, c = f.properties?.c;
      if (!lo || !c) continue;
      const e = cnt.get(lo); if (e) e.n++; else cnt.set(lo, { c, n: 1 });
    }
    return [...cnt.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [qhFillFC]);

  const geoLayers: GeoLayer[] = useMemo(() => {
    const out: GeoLayer[] = [];
    // Lớp quy hoạch tô màu (nằm DƯỚI cùng các lớp vector khác) — phủ kín, hết "thủng".
    if (qhFillFC.features.length) {
      // beforeId 'qh-qd205' → lớp vector nằm DƯỚI ảnh PNG: ảnh PNG hiển thị nguyên bản bên trên,
      // vector chỉ lộ ra ở chỗ ảnh trong suốt (lấp "thủng").
      out.push({ id: 'qh-fill', type: 'fill', data: qhFillFC, visible: qhFillOn, beforeId: 'qh-qd205', paint: { 'fill-color': ['coalesce', ['get', 'c'], '#9ca3af'] as any, 'fill-opacity': opacity } });
      out.push({ id: 'qh-fill-line', type: 'line', data: qhFillFC, visible: qhFillOn, beforeId: 'qh-qd205', paint: { 'line-color': 'rgba(23,37,64,0.30)', 'line-width': 0.4 } });
    }
    for (const l of layers) {
      const fc = data[l.slug]; if (!fc) continue;
      const base = (l.style?.color as string) || DEFAULT_COLORS[l.layerType] || '#16a34a';
      const colorExpr: any = ['coalesce', ['get', 'color'], base];
      const gtype = (l.geometryType || '').toLowerCase();
      const vis = visible[l.slug] ?? false;
      if (gtype.includes('line')) out.push({ id: `${l.slug}-line`, type: 'line', data: fc, visible: vis, paint: { 'line-color': colorExpr, 'line-width': (l.style?.weight as number) ?? 2.5 } });
      else if (gtype.includes('point')) out.push({ id: `${l.slug}-pt`, type: 'circle', data: fc, visible: vis, paint: { 'circle-color': colorExpr, 'circle-radius': 5, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 } });
      else if (l.layerType === 'parcel' || l.layerType === 'custom') {
        // Ranh thửa: nền XANH nhạt + viền XANH ĐẬM. Thửa DÍNH (GhepChuaTach=true, thiếu ranh chia) tô ĐỎ nổi bật để dễ tìm chỗ cần kẻ ranh.
        const dinh = ['==', ['get', 'GhepChuaTach'], true];
        // 'zoom' PHẢI ở top-level của interpolate; case nằm trong từng mốc (không được bọc interpolate-zoom trong case).
        out.push({ id: `${l.slug}-fill`, type: 'fill', data: fc, visible: vis, minzoom: PARCEL_SHOW_ZOOM, paint: { 'fill-color': ['case', dinh, '#ff5252', '#1e88e5'] as any, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, ['case', dinh, 0.5, 0.06], 16, ['case', dinh, 0.5, 0.13], 18, ['case', dinh, 0.5, 0.18]] as any } });
        out.push({ id: `${l.slug}-line`, type: 'line', data: fc, visible: vis, minzoom: PARCEL_SHOW_ZOOM, paint: { 'line-color': ['case', dinh, '#c62828', '#1565c0'] as any, 'line-width': ['interpolate', ['linear'], ['zoom'], 14, ['case', dinh, 2.6, 1], 16, ['case', dinh, 2.6, 1.7], 18, ['case', dinh, 2.6, 2.6]] as any, 'line-opacity': 1 } });
        out.push({ id: `${l.slug}-label`, type: 'symbol', data: fc, visible: vis, minzoom: PARCEL_SHOW_ZOOM, paint: { 'text-color': '#1e3a8a', 'text-halo-color': 'rgba(255,255,255,0.7)', 'text-halo-width': 1 }, layout: { 'text-field': ['coalesce', ['get', 'SoThua'], ['get', 'so_thua'], ['get', 'SOTHUA'], ['get', 'sothua'], ['get', 'thua'], ['get', 'THUA'], ['get', 'SHThua'], ['get', 'ThuaDat'], ''], 'text-size': ['interpolate', ['linear'], ['zoom'], 15, 9, 18, 12] as any, 'text-font': ['Noto Sans Regular'], 'symbol-placement': 'point', 'text-allow-overlap': false } });
      }
      else {
        // Lớp quy hoạch / ranh giới CHỈ VẼ VIỀN (không tô nền) -> rất nhẹ, hết lag.
        // Ranh giới hành chính (admin, vd ranh thôn): đường ĐẬM RÕ ở mọi mức zoom; ranh xã đậm hơn ranh thôn.
        const adminW: any = ['interpolate', ['linear'], ['zoom'], 10, ['case', ['==', ['get', 'loai'], 'ranh_xa'], 2.6, 1.8], 14, ['case', ['==', ['get', 'loai'], 'ranh_xa'], 4.2, 3], 17, ['case', ['==', ['get', 'loai'], 'ranh_xa'], 5.5, 4]];
        out.push({ id: `${l.slug}-line`, type: 'line', data: fc, visible: vis, paint: { 'line-color': colorExpr, 'line-width': (l.style?.weight as number) ?? (l.layerType === 'admin' ? adminW : 0.8), 'line-opacity': 0.95 } });
      }
      // Nhãn tên (vd tên thôn) KHÔNG vẽ bằng symbol nữa (symbol cần glyph từ font server, hay bị chặn/mất chữ).
      // Thay vào đó truyền xuống MapView qua prop textLabels để vẽ bằng marker HTML — luôn hiện, không cần font server.
    }
    if (ranhXa && ranhXa.features?.length) {
      const f6 = ranhXa.features.filter((x: any) => x?.properties?.color === 6);
      const fc = (f6.length ? { type: 'FeatureCollection', features: f6 } : ranhXa) as GeoJSON.FeatureCollection;
      out.push({ id: 'ranh-xa', type: 'line', data: fc, visible: ranhOn, paint: { 'line-color': '#C8A14B', 'line-width': 2.2, 'line-opacity': 0.95, 'line-dasharray': [3, 1.5] } });
    }
    return out;
  }, [layers, data, visible, opacity, ranhXa, ranhOn, qhFillFC, qhFillOn]);

  // Nhãn tên (vd tên thôn) vẽ bằng marker HTML trong MapView — KHÔNG cần glyph/font server (hay bị chặn → mất chữ).
  // Gom điểm có trường tên (ten/name…) của các lớp đang bật (trừ parcel dùng nhãn số thửa riêng).
  const textLabels = useMemo(() => {
    const arr: { lng: number; lat: number; text: string }[] = [];
    for (const l of layers) {
      if (l.layerType === 'parcel') continue;
      if (!(visible[l.slug] ?? false)) continue;
      const fc: any = data[l.slug]; if (!fc?.features) continue;
      for (const f of fc.features) {
        if (f?.geometry?.type !== 'Point') continue;
        const p: any = f.properties || {};
        const nm = p.ten || p.name || p.ten_thon || p.NAME || p.label || '';
        if (!nm) continue;
        const c = f.geometry.coordinates as number[];
        arr.push({ lng: c[0], lat: c[1], text: String(nm) });
      }
    }
    return arr;
  }, [layers, data, visible]);

  // Bấm gim tin lưu → mở BẢNG ĐẦY ĐỦ (selPlace) như giỏ hàng, thay cho popup nhỏ.
  const placeMarkers = useMemo(() => places.map((p) => ({
    lng: p.lng, lat: p.lat, color: dealColor(p.dealStatus),
    onClick: () => { pinClickRef.current = Date.now(); setInfo(null); setSelPlace(p); },
  })), [places]);
  // Ghim XANH tại điểm vừa bấm (điểm đang chọn) — như /listings.
  // Ghim xanh tại điểm bấm CHỈ HIỆN KHI ĐANG LƯU ĐIỂM (showSave) — chủ dự án 14/9/2026: bấm/tìm thửa mà cắm
  // ghim thì ghim che mất chính thửa đó; ranh thửa đã được tô sáng là đủ biết đang xem thửa nào.
  const allMarkers = useMemo(() => (clickVN && showSave) ? [...placeMarkers, { lng: clickVN.lng, lat: clickVN.lat, color: '#2563eb' }] : placeMarkers, [placeMarkers, clickVN, showSave]);
  useEffect(() => {
    setShowAddInt(false);
    if (!selPlace) { setInterests([]); return; }
    listInterests(selPlace.id).then(setInterests).catch(() => setInterests([]));
  }, [selPlace]);
  const openAddInt = () => { setShowAddInt(true); if (!custList.length) listCustomers().then(setCustList).catch(() => { }); };
  async function saveInterest() {
    if (!selPlace) return;
    try {
      const payload: any = { placeId: selPlace.id, interest: iInterest || undefined, dealStatus: iDeal || undefined };
      if (iCustId) payload.customerId = Number(iCustId);
      else { if (!iName.trim() && !iPhone.trim()) { alert('Chọn khách có sẵn hoặc nhập tên/SĐT khách mới.'); return; } payload.name = iName.trim() || undefined; payload.phone = iPhone.trim() || undefined; }
      const it = await addInterest(payload);
      setInterests((a) => [it, ...a]);
      setShowAddInt(false); setICustId(''); setIName(''); setIPhone(''); setIInterest(''); setIDeal('');
    } catch (e: any) { alert('Lỗi: ' + (e?.message || e)); }
  }
  async function delIntMap(id: number) {
    try { await removeInterest(id); setInterests((a) => a.filter((x) => x.id !== id)); } catch (e: any) { alert(e.message); }
  }

  async function onMapClick(lng: number, lat: number) {
    // Đang chờ nhặt điểm đi/điểm đến cho phần chỉ đường → lấy điểm rồi thôi, không mở bảng quy hoạch.
    if (dirNhatRef.current) {
      const d: Diem = { lng, lat, ten: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
      if (dirNhatRef.current === 'di') setDirDi(d); else setDirDen(d);
      setDirNhat(null); return;
    }
    if (Date.now() - pinClickRef.current < 350) return; // vừa bấm gim tin lưu → không mở bảng quy hoạch
    setSelPlace(null); setShowSave(false); // click mới → thu gọn, chỉ hiện điểm + nút "Lưu tin này"
    luotThuaRef.current++; setDangKiemVe(false);
    const vn = wgs84ToVn2000(lng, lat);
    setClickVN({ x: vn.y, y: vn.x, lng, lat }); // sổ: X=Bắc(Northing), Y=Đông(Easting)
    setFlyPoint({ lng, lat }); // bay tới + zoom cận, pin nằm giữa vùng trống phía trên bảng
    setSheetExpanded(false); setSheetNho(false); // mỗi lần click: bảng ở nấc VỪA (thấy trang quy hoạch), muốn xem đầy đủ thì kéo lên
    // Loại đất quy hoạch (vector) tại điểm — tính ngay ở trình duyệt, không cần server.
    const gv = qhVectorRef.current;
    if (gv) {
      const hits: { lo: string; hz: string; area: number }[] = [];
      let inMask = false; // điểm nằm trong mặt nạ "nội thị" (vùng đã có QH)
      for (const ft of gv.features as any[]) {
        const ring = ft.geometry?.coordinates?.[0]; if (!ring) continue;
        if (pointInRing(lng, lat, ring)) {
          const pr = ft.properties || {};
          if (pr.bg === true || pr.lo === 'Noi thi' || pr.lo === 'Đất nội thị (chưa phân loại)') { inMask = true; continue; } // bỏ mặt nạ, không phải loại đất
          let sArea = 0; for (let i = 0; i < ring.length - 1; i++) sArea += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
          hits.push({ lo: pr.lo, hz: pr.hz, area: Math.abs(sArea) });
        }
      }
      hits.sort((x, y) => x.area - y.area); // vùng nhỏ (cụ thể) hiện trước
      const seen = new Set<string>(); const uniq: { lo: string; hz: string }[] = [];
      for (const h of hits) { const k = h.lo + h.hz; if (!seen.has(k)) { seen.add(k); uniq.push({ lo: h.lo, hz: h.hz }); } }
      if (uniq.length === 0 && inMask) uniq.push({ lo: 'Đất giao thông', hz: '' }); // trống giữa các ô đất = đường
      setQhvHit(uniq.slice(0, 4));
    } else setQhvHit([]);
    try {
      const r = await api<ParcelInfo>(`/parcels/at?lng=${lng}&lat=${lat}`);
      const pg = (r.parcel as any)?.geometry; // click TRÚNG thửa → highlight + hiện cạnh/diện tích (kiểu Guland)
      // Diện tích QH do MÁY CHỦ tính (cắt hình đúng bản vẽ) → dùng thẳng r.overlaps. ĐÃ BỎ (12/10/2026) đoạn "tính bù" từ file cũ
      // public/qh_vector.geojson (dựng tháng 7 bằng chuỗi cũ: lấp lỗ, tên cũ, vẽ cả ngoài ranh) khi máy chủ không trả dòng QĐ205: máy chủ
      // CỐ Ý không trả khi thửa nằm trọn ngoài ranh QĐ205 (sửa 10/10) — tính bù là dựng lại một dòng QĐ205 sai từ dữ liệu cũ, in cả lên phiếu.
      setInfo(r); setParcelMore(false); // mỗi lần click thửa mới → thu gọn lại
      // Kèm luôn diện tích CHÍNH THỨC do máy chủ đo, để con số ghi trên bản đồ khớp y hệt
      // con số trong bảng "Thông tin thửa" (trước đây bản đồ tự tính lấy nên lệch vài mét vuông).
      setHighlight(pg ? {
        type: 'Feature',
        properties: { ...((r.parcel as any).properties || {}), dienTichChinhThuc: (r.parcel as any).areaM2 ?? null },
        geometry: pg,
      } : null);
      if (pg) tranhBiChe(pg);
    }
    catch { setInfo({ found: false, point: { lng, lat }, parcel: null, zoning: null, listings: [] }); setHighlight(null); }
  }

  // Gom các ô quy hoạch (vector) cắt qua thửa → TÔ MÀU đúng loại đất lên sơ đồ phiếu (như bản đồ QH).
  // scen = kịch bản QH đang áp (HT/2030/2045); chỉ lấy ô đúng kịch bản để sơ đồ khớp thông tin.
  function qhPiecesFor(geometry: any, scen?: string): { lo: string; hz?: string; c?: string; ring: number[][] }[] {
    const gv = qhVectorRef.current as any; if (!gv?.features || !geometry) return [];
    let pr: number[][] = [];
    if (geometry.type === 'Polygon') pr = geometry.coordinates?.[0] || [];
    else if (geometry.type === 'MultiPolygon') { let bA = -1; for (const poly of geometry.coordinates || []) { const r = poly?.[0] || []; if (r.length > bA) { bA = r.length; pr = r; } } }
    if (pr.length < 3) return [];
    const xs = pr.map((c) => c[0]), ys = pr.map((c) => c[1]);
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    const out: { lo: string; hz?: string; c?: string; ring: number[][] }[] = [];
    for (const ft of gv.features as any[]) {
      const ring = ft.geometry?.coordinates?.[0]; if (!ring || ring.length < 3) continue;
      const pp = ft.properties || {};
      if (pp.bg === true || pp.lo === 'Noi thi' || pp.lo === 'Đất nội thị (chưa phân loại)') continue; // bỏ mặt nạ nội thị
      if (scen && scen !== 'all' && String(pp.hz || '') !== scen) continue; // chỉ đúng kịch bản đang áp
      const rxs = ring.map((c: number[]) => c[0]), rys = ring.map((c: number[]) => c[1]);
      if (Math.max(...rxs) < minx || Math.min(...rxs) > maxx || Math.max(...rys) < miny || Math.min(...rys) > maxy) continue; // bbox không giao
      out.push({ lo: String(pp.lo || pp.loai || ''), hz: pp.hz ? String(pp.hz) : undefined, c: pp.c ? String(pp.c) : undefined, ring });
      if (out.length >= 120) break;
    }
    return out;
  }

  // Gom feature LỚP ĐƯỜNG THẬT (layerType='road', nét mảnh) gần thửa → vẽ đúng con đường lên sơ đồ trích lục.
  function roadFeatsFor(geometry: any): { t: string; c: any }[] {
    if (!geometry) return [];
    let pr: number[][] = [];
    if (geometry.type === 'Polygon') pr = geometry.coordinates?.[0] || [];
    else if (geometry.type === 'MultiPolygon') { let bA = -1; for (const poly of geometry.coordinates || []) { const r = poly?.[0] || []; if (r.length > bA) { bA = r.length; pr = r; } } }
    if (pr.length < 3) return [];
    const xs = pr.map((c) => c[0]), ys = pr.map((c) => c[1]);
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    const ex = (maxx - minx) * 0.7 || 1e-3, ey = (maxy - miny) * 0.7 || 1e-3;   // mở rộng bbox để lấy đường giáp cạnh
    const bx0 = minx - ex, bx1 = maxx + ex, by0 = miny - ey, by1 = maxy + ey;
    const flat = (g: any): number[][] => { const a: number[][] = []; const rec = (v: any) => { if (typeof v?.[0] === 'number') a.push(v as number[]); else if (Array.isArray(v)) v.forEach(rec); }; rec(g?.coordinates); return a; };
    const out: { t: string; c: any }[] = [];
    for (const l of layersRef.current) {
      if (l.layerType !== 'road') continue;
      const fc: any = data[l.slug]; if (!fc?.features) continue;
      for (const ft of fc.features as any[]) {
        const g = ft.geometry; if (!g) continue;
        const cs = flat(g); if (!cs.length) continue;
        const fxs = cs.map((c) => c[0]), fys = cs.map((c) => c[1]);
        if (Math.max(...fxs) < bx0 || Math.min(...fxs) > bx1 || Math.max(...fys) < by0 || Math.min(...fys) > by1) continue; // bbox không giao
        out.push({ t: String(g.type), c: g.coordinates });
        if (out.length >= 40) break;
      }
    }
    return out;
  }

  // ĐO DIỆN TÍCH QH theo LỚP VECTOR qh_vector (overlay điểm-trong-đa-giác) — phủ KÍN, hết "giao thông ảo".
  // Ảnh QĐ205 chỉ là NÉT HATCH (đa số pixel trong suốt) nên không đếm pixel được; qh_vector mới là dữ liệu thật,
  // đã kiểm chứng phủ 100% (vd thửa 556/326 = 100% đất hỗn hợp). Ưu tiên polygon LOẠI ĐẤT thật (QH > hiện trạng)
  // đè lên nền "nội thị/khác"; trong cùng bậc chọn polygon NHỎ nhất (cụ thể nhất); chuẩn hoá tổng = diện tích thửa.
  function qhAreasFromVector(ring: number[][]): { type: string; hz?: string; areaM2: number }[] {
    try {
      const gv = qhVectorRef.current as any;
      const feats = gv?.features || [];
      if (!feats.length || ring.length < 3) return [];
      const BG = new Set(['Noi thi', 'Đất nội thị (chưa phân loại)', 'Khác', '', '?']);
      const lngs = ring.map((c) => c[0]), lats = ring.map((c) => c[1]);
      const minLng = Math.min(...lngs), maxLng = Math.max(...lngs), minLat = Math.min(...lats), maxLat = Math.max(...lats);
      const ringArea = (r: number[][]) => { let a = 0; for (let i = 0; i < r.length; i++) { const p1 = r[i], p2 = r[(i + 1) % r.length]; a += p1[0] * p2[1] - p2[0] * p1[1]; } return Math.abs(a) / 2; };
      const pip = (x: number, y: number, r: number[][]) => { let ins = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins; } return ins; };
      type Cand = { minx: number; miny: number; maxx: number; maxy: number; r: number[][]; lo: string; ar: number; tier: number };
      const cand: Cand[] = [];
      for (const ft of feats) {
        const gm = ft.geometry; if (!gm) continue; const pr = ft.properties || {};
        const lo = String(pr.lo || pr.loai || '?');
        const isBg = pr.bg === true || BG.has(lo);
        const plan = pr.hz === '2045' || pr.hz === '2030' || pr.hz === 'QH';
        const tier = isBg ? 0 : (plan ? 2 : 1);
        const polys = gm.type === 'Polygon' ? [gm.coordinates] : gm.type === 'MultiPolygon' ? gm.coordinates : [];
        for (const poly of polys) {
          const r = (poly?.[0] || []) as number[][]; if (r.length < 3) continue;
          let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
          for (const c of r) { if (c[0] < mnx) mnx = c[0]; if (c[0] > mxx) mxx = c[0]; if (c[1] < mny) mny = c[1]; if (c[1] > mxy) mxy = c[1]; }
          if (mxx < minLng || mnx > maxLng || mxy < minLat || mny > maxLat) continue;
          cand.push({ minx: mnx, miny: mny, maxx: mxx, maxy: mxy, r, lo, ar: ringArea(r), tier });
        }
      }
      if (!cand.length) return [];
      const R = 6378137, rad = Math.PI / 180;
      let ga = 0; for (let i = 0; i < ring.length; i++) { const p1 = ring[i], p2 = ring[(i + 1) % ring.length]; ga += (p2[0] - p1[0]) * rad * (2 + Math.sin(p1[1] * rad) + Math.sin(p2[1] * rad)); }
      const parcelA = Math.abs(ga * R * R / 2); if (parcelA < 1) return [];
      const N = 96; const cnt: Record<string, number> = {}; let inside = 0;
      for (let iy = 0; iy < N; iy++) for (let ix = 0; ix < N; ix++) {
        const x = minLng + (maxLng - minLng) * (ix + 0.5) / N, y = minLat + (maxLat - minLat) * (iy + 0.5) / N;
        if (!pip(x, y, ring)) continue; inside++;
        let bestLo: string | null = null, bestTier = -1, bestAr = Infinity;
        for (const c of cand) {
          if (c.tier < bestTier) continue;
          if (x < c.minx || x > c.maxx || y < c.miny || y > c.maxy) continue;
          if (!pip(x, y, c.r)) continue;
          if (c.tier > bestTier || c.ar < bestAr) { bestTier = c.tier; bestAr = c.ar; bestLo = c.lo; }
        }
        // NỀN/mask "nội thị" (tier 0) = khoảng trống giữa các ô đất = ĐẤT GIAO THÔNG (giống qhviet/Meey).
        if (bestLo) { const lbl = bestTier === 0 ? 'Đất giao thông' : bestLo; cnt[lbl] = (cnt[lbl] || 0) + 1; }
      }
      if (inside < 20) return [];
      const denom = Object.values(cnt).reduce((s, n) => s + n, 0); if (denom < 1) return [];
      const out = Object.entries(cnt).map(([lo, n]) => ({ type: lo, hz: '2045', areaM2: Math.round((parcelA * n / denom) * 10) / 10 }));
      return out.filter((x) => x.areaM2 > 0.5).sort((a, b) => b.areaM2 - a.areaM2);
    } catch { return []; }
  }

  // Mở từ mã QR trên phiếu (/map?lng=&lat=&to=&thua=) → tự bay tới + tra cứu đúng thửa.
  const didDeepLink = useRef(false);
  useEffect(() => {
    if (didDeepLink.current) return; didDeepLink.current = true;
    try {
      const sp = new URLSearchParams(window.location.search);
      const lng = parseFloat(sp.get('lng') || ''), lat = parseFloat(sp.get('lat') || '');
      if (!Number.isNaN(lng) && !Number.isNaN(lat)) {
        // Bay tới, KHÔNG cắm ghim (ghim che mất thửa — chủ dự án 14/9/2026; ghim chỉ dùng cho "Lưu điểm").
        setFlyPoint({ lng, lat });
        setTimeout(() => { onMapClick(lng, lat).catch(() => {}); }, 700);
      }
    } catch { /* bỏ qua */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mở một thửa trong danh sách tìm được: tô sáng, bay tới, nạp đầy đủ thông tin.
  const moThuaTim = useCallback(async (p: any) => {
    const props = { to: p.soTo, thua: p.soThua, xa: p.tenXa, xaCu: p.tenXaCu,
                    dienTich_m2: p.dienTich, mucDichSuDung: p.mdsd, nhan: `Thửa ${p.soThua}, tờ ${p.soTo}` };
    if (p.hinh) setHighlight({ type: 'Feature', properties: props, geometry: p.hinh });
    // Bay tới + tô sáng ranh thửa, KHÔNG cắm ghim (ghim che mất thửa — chủ dự án 14/9/2026).
    setFocusPoint(null); setFlyPoint({ lng: p.lng, lat: p.lat });
    setPanelOpen(false); setTool('none');
    // Nạp ĐẦY ĐỦ thông tin thửa (quy hoạch, chồng lấn, toạ độ, tin BĐS…) giống bấm trực tiếp trên bản đồ.
    await onMapClick(p.lng, p.lat);
    if (p.hinh) setHighlight({ type: 'Feature', properties: props, geometry: p.hinh }); // giữ đúng ranh thửa đã tìm
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doSearch(ghiDe?: { c1?: string; c2?: string }) {
    const v1 = ghiDe?.c1 ?? c1, v2 = ghiDe?.c2 ?? c2;   // số vừa tự tách (95/15) — trạng thái c1/c2 chưa kịp đổi
    if (searchMode === 'parcel') {
      // Tra trên bảng địa chính toàn tỉnh (/dc/tim) — có chỉ mục theo số tờ/số thửa nên rất nhanh.
      const params = new URLSearchParams();
      if (v1.trim()) params.set('to', v1.trim());
      if (v2.trim()) params.set('thua', v2.trim());
      if (c3.trim()) params.set('xaId', c3.trim());   // c3 giờ là MÃ XÃ, không phải tên (10 cặp xã trùng tên)
      if (!c3.trim() && cap) params.set('cap', cap);   // chưa chọn xã thì lọc theo cấp cho gọn kết quả
      if (!v1.trim() && !v2.trim()) return alert('Nhập số thửa và/hoặc số tờ.');
      try {
        const r = await api<{ soLuong: number; thuaDat: ThuaTim[] }>(`/dc/tim?${params.toString()}`);
        if (!r.soLuong) { setKetQuaTim([]); return alert('Không tìm thấy thửa nào khớp. Thử bỏ bớt điều kiện, hoặc chọn đúng xã/phường.'); }
        setKetQuaTim(r.soLuong > 1 ? r.thuaDat : []);   // nhiều kết quả → hiện bảng cho chọn
        await moThuaTim(r.thuaDat[0]);                  // vẫn mở sẵn thửa đầu tiên
      } catch (e: any) { alert('Lỗi tra cứu: ' + e.message); }
      return;
    }
    if (searchMode === 'gmap') {
      const g = parseGmap(v1.trim());
      if (!g) return alert('Không đọc được toạ độ từ link. Hãy dán link Google Maps có dạng …/@12.34,109.12,… hoặc copy toạ độ. (Link rút gọn goo.gl cần mở ra để lấy link đầy đủ.)');
      setFocusPoint({ lng: g.lng, lat: g.lat, label: `${g.lat.toFixed(6)}, ${g.lng.toFixed(6)}` });
      setTool('none'); return;
    }
    let lng: number, lat: number;
    if (searchMode === 'vn2000') {
      const a = parseFloat(v1), b = parseFloat(v2);
      if (Number.isNaN(a) || Number.isNaN(b)) return alert('Nhập X (Bắc), Y (Đông) hệ VN-2000.');
      const E = a < 900000 ? a : b, N = a < 900000 ? b : a; // sổ: X=Bắc(>900k), Y=Đông(<900k) — tự nhận, không lo nhầm X/Y
      const w = vn2000ToWgs84(E, N); lng = w.lng; lat = w.lat;
    } else {
      lat = parseFloat(v1); lng = parseFloat(v2);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return alert('Nhập Vĩ độ (lat), Kinh độ (lng).');
    }
    setFocusPoint({ lng, lat, label: `${lat.toFixed(6)}, ${lng.toFixed(6)}` });
    setTool('none');
  }
  async function deleteLayer(slug: string, name: string) {
    if (!window.confirm(`Xoá lớp "${name}"?`)) return;
    try { await api(`/layers/${slug}`, { method: 'DELETE' }); setData((d) => { const n = { ...d }; delete n[slug]; return n; }); load(); }
    catch (e: any) { alert(/Admin|401|403/i.test(String(e.message)) ? 'Cần đăng nhập Quản trị để xoá.' : 'Lỗi: ' + e.message); }
  }
  function pointsFromRows(): { x: number; y: number }[] {
    const pts: { x: number; y: number }[] = [];
    for (const r of rows) {
      const a = parseNum(r.x), b = parseNum(r.y);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      const E = a < 900000 ? a : b, N = a < 900000 ? b : a;
      if (E > 90000 && E < 900000 && N > 900000) pts.push({ x: E, y: N });
    }
    return pts;
  }
  function applyParsed(parsed: { x: number; y: number }[], engine?: string) {
    if (!parsed.length) return alert('Chưa nhận được toạ độ từ ảnh. Hãy chụp GẦN, THẲNG, đủ sáng — chỉ lấy phần bảng số. Hoặc nhập tay ở tab "Nhập bảng".');
    setRows(parsed.map((p) => ({ x: String(p.x), y: String(p.y) })));
    setOcrOk(parsed.length);
    setOcrEngine(engine || '');
    setDrawTab('table');
    setGocTab('bang');   // điện thoại: đọc xong quay về thẻ bảng toạ độ để kiểm số
  }
  function applyPaste() {
    const pts = parseBigPairs(pasteText);
    if (!pts.length) return alert('Không tìm thấy cặp toạ độ hợp lệ.\nMỗi dòng cần 1 số Bắc (~1,2–1,48 triệu) và 1 số Đông (~380–720 nghìn). Ví dụ:\n1  1335000.50  567890.12');
    setRows(pts.map((p) => ({ x: String(p.x), y: String(p.y) })));
    setOcrOk(pts.length);
    setOcrEngine('paste');
    setPasteText('');
    setGocTab('bang');
  }
  function loadImage(f: File): Promise<HTMLImageElement> {
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(f); });
  }
  async function onCoordFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    if (f.type.startsWith('image/') && !requireLogin()) return;
    setOcrBusy('Đang đọc…'); startProgress();
    try {
      if (f.type.startsWith('image/')) {
        const img = await loadImage(f);
        setOcrBusy('Đang tải & đọc ảnh…');
        showOcrResult(await ocrToPoints(img), applyParsed);
      } else { applyParsed(parseBigPairs(await f.text())); }
    } catch (er: any) { alert('Không đọc được tệp: ' + (er?.message || er)); }
    finally { endProgress(); }
  }
  // Vẽ ranh bằng CHỤP/ẢNH toạ độ cần đăng nhập (dùng API OCR). Chưa đăng nhập → nhắc đăng nhập đơn giản.
  function requireLogin(): boolean {
    if (user) return true;
    if (confirm('🔒 Tính năng vẽ ranh bằng chụp/ảnh toạ độ cần đăng nhập.\n\nĐăng nhập ngay?')) window.location.href = '/login?next=/map';
    return false;
  }
  async function startCam() {
    if (!requireLogin()) return;
    try { const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1440 } } }); try { await st.getVideoTracks()[0]?.applyConstraints({ advanced: [{ focusMode: 'continuous' }] as any }); } catch {} camStreamRef.current = st; setCamOpen(true); }
    catch (e: any) { alert('Không mở được camera: ' + (e?.message || e)); }
  }
  function stopCam() { camStreamRef.current?.getTracks().forEach((t) => t.stop()); camStreamRef.current = null; setCamOpen(false); }
  function startProgress() {
    if (ocrTimer.current) clearInterval(ocrTimer.current);
    setOcrPct(0);
    let p = 0;
    ocrTimer.current = setInterval(() => { p += Math.max(0.7, (92 - p) * 0.06); if (p > 92) p = 92; setOcrPct(Math.round(p)); }, 180);
  }
  function endProgress() {
    if (ocrTimer.current) { clearInterval(ocrTimer.current); ocrTimer.current = null; }
    setOcrPct(100);
    setTimeout(() => { setOcrBusy(''); setOcrPct(0); }, 350);
  }
  async function capture() {
    const v = camVideoRef.current; if (!v || !v.videoWidth) return;
    const vw = v.videoWidth, vh = v.videoHeight, cw = Math.round(vw * 0.96), ch = Math.round(vh * 0.86);
    const cap = document.createElement('canvas'); cap.width = cw; cap.height = ch;
    cap.getContext('2d')!.drawImage(v, Math.round((vw - cw) / 2), Math.round((vh - ch) / 2), cw, ch, 0, 0, cw, ch);
    // Phản hồi "đã chụp": rung nhẹ + nháy trắng màn hình (như camera iPhone), rồi mới chuyển sang đọc.
    try { navigator.vibrate?.(35); } catch {}
    setCamFlash(true); setTimeout(() => setCamFlash(false), 110);
    await new Promise((r) => setTimeout(r, 180));
    stopCam(); setOcrBusy('Đang tải & đọc ảnh…'); startProgress();
    try { showOcrResult(await ocrToPoints(cap), applyParsed); }
    catch (e: any) { alert('Không đọc được: ' + (e?.message || e)); }
    finally { endProgress(); }
  }
  function drawParcel() {
    const pts = pointsFromRows();
    if (pts.length < 3) return alert('Cần ít nhất 3 điểm hợp lệ (X Đông ~5-6 chữ số, Y Bắc ~7 chữ số).');
    const ll = pts.map((p) => { const w = vn2000ToWgs84(p.x, p.y); return [w.lng, w.lat]; });
    const ring = [...ll, ll[0]];
    setHighlight({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } } as any);
    const lngs = ll.map((c) => c[0]), lats = ll.map((c) => c[1]);
    setFitTo([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]]);
    const hinh = { type: 'Polygon' as const, coordinates: [ring] };
    setDrawResult({ n: pts.length, area: polyAreaM2(pts), perim: perimeterM(pts), lat: ll[0][1], lng: ll[0][0], hinh });
    setClickVN(null); setInfo(null); setFocusPoint(null); setDrawOpen(false);
    kiemQhThuaVe(hinh);
  }
  // ── KIỂM TRA QUY HOẠCH CHO THỬA KHÁCH TỰ VẼ (15/10/2026) ──
  // Chủ dự án: "nếu người dùng vẽ thửa từ toạ độ thì vẫn kiểm tra quy hoạch được, phần thửa tờ thông tin ghi thửa giả định do khách hàng
  // tự vẽ". Máy chủ (POST /parcels/qh-tu-ve) tính y như thửa địa chính — cùng các bản quy hoạch, cùng luật khoá Cam Lâm — rồi trả về đúng
  // khuôn của /parcels/at với parcel.giaDinh = true → mở chính bảng "Thông tin thửa", đầu bảng ghi "Thửa giả định do khách hàng tự vẽ".
  // Toạ độ gửi đi là toạ độ khách nhập đổi thẳng sang WGS84 (lib/vn2000.ts) — máy chủ KHÔNG dịch hình như thửa địa chính.
  async function kiemQhThuaVe(hinh: { type: 'Polygon'; coordinates: number[][][] }) {
    const luot = ++luotThuaRef.current;
    const t0 = Date.now();
    setDangKiemVe(true);
    try {
      const r = await api<ParcelInfo>('/parcels/qh-tu-ve', { method: 'POST', body: JSON.stringify({ geometry: hinh }) });
      if (luot !== luotThuaRef.current) return;
      setInfo(r); setParcelMore(false); setSheetExpanded(false); setSheetNho(false); setShowSave(false);
      // "Lưu điểm" + dòng toạ độ VN-2000 dùng điểm GIỮA thửa (máy chủ chọn điểm chắc chắn nằm trong thửa)
      const vn = wgs84ToVn2000(r.point.lng, r.point.lat);
      setClickVN({ x: vn.y, y: vn.x, lng: r.point.lng, lat: r.point.lat });
      setHighlight({ type: 'Feature', properties: { dienTichChinhThuc: r.parcel?.areaM2 ?? null }, geometry: hinh } as any);
      // bản đồ đang bay khít vào thửa (0,8 giây) — bay xong mới đo xem bảng có che thửa không
      setTimeout(() => tranhBiChe(hinh), Math.max(0, 900 - (Date.now() - t0)));
    } catch (e: any) {
      if (luot !== luotThuaRef.current) return;
      alert('Chưa kiểm tra được quy hoạch cho thửa vừa vẽ: ' + (e?.message || e));
    } finally {
      if (luot === luotThuaRef.current) setDangKiemVe(false);
    }
  }
  const mBtn = (m: MeasureMode, label: string) => (
    <button onClick={() => { setMeasure(measure === m ? 'off' : m); setMResult(null); }}
      className={`px-2 py-1 rounded text-xs font-medium border whitespace-nowrap ${measure === m ? 'bg-orange-600 text-white border-orange-600' : 'bg-white border-slate-300 text-slate-700'}`}>{label}</button>
  );

  // ---- Nhóm điều khiển dùng chung cho desktop (inline) và mobile (bảng mở rộng) ----
  // Nền bản đồ. MÁY TÍNH giữ 3 nút như cũ (màn rộng, bấm một phát là xong).
  // ĐIỆN THOẠI dùng Ô SỔ XUỐNG: màn hẹp, 3 nút chiếm gần hết một hàng, mà từ khi nhóm
  // 'Bản đồ' trên thanh trên được nhường chỗ cho Chú giải thì ô này nằm trong bảng lớp,
  // chỗ đó càng phải gọn.  (full = true nghĩa là đang vẽ cho điện thoại.)
  const baseMapCtrl = (full = false) => (full ? (
    <select value={baseMap} onChange={(e) => setBaseMap(e.target.value as BaseMap)}
      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-600">
      {([['street', '🗺 Nền: Đường'], ['satellite', '🛰 Nền: Vệ tinh'], ['terrain', '⛰ Nền: Địa hình']] as [BaseMap, string][]).map(([b, l]) => (
        <option key={b} value={b}>{l}</option>
      ))}
    </select>
  ) : (
    <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
      {([['street', 'Đường'], ['satellite', 'Vệ tinh'], ['terrain', 'Địa hình']] as [BaseMap, string][]).map(([b, l]) => (
        <button key={b} onClick={() => setBaseMap(b)} className={`px-3 py-1 rounded-md text-xs font-semibold transition ${baseMap === b ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{l}</button>
      ))}
    </div>
  ));
  const labelsCtrl = () => (
    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer whitespace-nowrap">
      <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} className="accent-emerald-600 w-4 h-4" />Nhãn & đường
    </label>
  );
  // Nhãn ô số tờ: chỉ dám ghi "(mới)" khi xã đang chọn ĐÃ CÓ bảng tra số tờ,
  // vì xã chưa có bảng thì số nhập vào vẫn được hiểu là số tờ cũ.
  const nhanOSoTo = (cap === '2' && dsXaCap.find((x) => x.xaId === c3)?.coBangTo) ? 'Số tờ mới' : 'Số tờ';
  // anChon = true: bảng đáy Tra cứu của điện thoại — kiểu tra đã chọn bằng THẺ nên ẩn ô sổ xuống.
  // ── BÀN PHÍM Ô TRA CỨU (chủ dự án 11/10/2026: "nhập đủ thông tin thì bấm Enter tra cứu được, không cần dùng chuột") ──
  //   Enter ở ô SỐ THỬA: ô số tờ còn trống → nhảy sang ô số tờ; đủ rồi → tra luôn. Enter ở ô SỐ TỜ → tra.
  //   Gõ gộp "95/15", "95 15", "thửa 95 tờ 15", "tờ 15 thửa 95" vào ô số thửa → tự tách thửa 95, tờ 15.
  //   Ô huyện / xã: ↑↓ đi trong danh sách, Enter hoặc Tab chọn, chọn xong con trỏ tự sang ô kế (huyện → xã → số thửa).
  //   Esc: đóng danh sách đang sổ; bấm lần nữa đóng khung tìm. Phím "/" hoặc Ctrl+K: mở khung tìm, con trỏ vào ô số thửa.
  const oTimRef = useRef<Record<string, HTMLElement | null>>({});
  const datTro = (k: string) => setTimeout(() => { const el = oTimRef.current[k] as HTMLInputElement | undefined; if (el) { el.focus(); el.select?.(); } }, 30);
  const tachThuaTo = (s: string): { thua: string; to: string } | null => {
    const k = boDauVn(s || '').trim();
    let m = /^(?:thua\s*)?(\d+[a-z]?)\s*(?:[\/\-,;.]\s*|\s+)(?:to\s*)?(\d+)$/.exec(k);
    if (m) return { thua: m[1], to: m[2] };
    m = /^to\s*(\d+)\s*[,;]?\s*thua\s*(\d+[a-z]?)$/.exec(k);
    return m ? { thua: m[2], to: m[1] } : null;
  };
  const traCuu = (full: boolean, ghiDe?: { c1?: string; c2?: string }) => { doSearch(ghiDe); if (full) setTool('none'); };
  const phimEnter = (full: boolean, o: 'thua' | 'to' | 'mot' | 'hai', kp: string) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;   // isComposing: bộ gõ tiếng Việt đang ghép chữ
    e.preventDefault();
    if (o === 'thua') {
      const t = tachThuaTo(c2);
      if (t) { setC2(t.thua); setC1(t.to); traCuu(full, { c1: t.to, c2: t.thua }); return; }
      if (c2.trim() && !c1.trim()) { datTro('to-' + kp); return; }
    }
    if (o === 'mot' && c1.trim() && !c2.trim()) { datTro('hai-' + kp); return; }
    traCuu(full);
  };
  useEffect(() => {
    const nghe = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && timMo && !e.defaultPrevented) { setTimMo(false); return; }
      const t = e.target as HTMLElement | null;
      if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]')) return;
      const moTim = (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) || ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K'));
      if (!moTim || !laMayTinh()) return;
      e.preventDefault();
      setPanelOpen(false); setTimMo(true);
      datTro(searchMode === 'parcel' ? (c3 ? 'thua-mt' : 'xa-mt') : 'mot-mt');
    };
    window.addEventListener('keydown', nghe);
    return () => window.removeEventListener('keydown', nghe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timMo, c3, searchMode]);
  const searchCtrl = (full = false, anChon = false) => {
    const kp = full ? 'dt' : anChon ? 'mt' : 'cu';   // khoá giữ ô: điện thoại / khung tìm máy tính / thanh cũ (đang ẩn)
    const giu = (k: string) => (el: HTMLElement | null) => { oTimRef.current[k + '-' + kp] = el; };
    return (
    <div className={`flex items-center gap-1.5 ${full ? 'flex-wrap' : ''}`}>
      <select value={searchMode} hidden={anChon} onChange={(e) => { setC1(''); setC2(''); setSearchMode(e.target.value as any); }} className={`border rounded-lg px-2 py-1.5 text-xs bg-white ${full ? 'w-full' : ''}`}>
        <option value="parcel">Số tờ / thửa</option>
        <option value="vn2000">Toạ độ VN-2000</option>
        <option value="latlng">Lat / Lng (WGS-84)</option>
        <option value="gmap">Link Google Maps</option>
      </select>
      {searchMode === 'gmap' ? (
        <input ref={giu('mot')} value={c1} onChange={(e) => setC1(e.target.value)} onKeyDown={phimEnter(full, 'hai', kp)} enterKeyHint="search" placeholder="Dán link Google Maps (…/@12.34,109.12…)" className={`col-span-2 border rounded-lg px-2.5 ${full ? 'py-2 text-[16px] w-full' : 'py-1.5 text-xs w-56'}`} />
      ) : (
        <>
          {searchMode === 'parcel' && (
            <select value={cap} onChange={(e) => { setCap(e.target.value as any); setC3(''); setHuyenChon(''); donKetQuaCu(); }} className={`border rounded-lg px-2 py-1.5 text-xs bg-white ${full ? 'flex-1 min-w-[84px]' : 'w-[96px]'}`} title="Cấp hành chính">
              <option value="3">3 cấp (huyện–xã)</option>
              <option value="2">2 cấp (xã mới)</option>
            </select>
          )}
          {/* ── THỨ TỰ: chọn ĐỊA GIỚI HÀNH CHÍNH TRƯỚC (huyện → xã), rồi mới tới số tờ/số thửa.
              Vì số tờ, số thửa chỉ có nghĩa khi đã biết đang hỏi ở xã nào. ── */}
          {searchMode === 'parcel' && (
            <>
              {/* ── CHỌN HUYỆN/TP CŨ ── bấm vào là GÕ TÌM được luôn, gõ không dấu cũng ra.
                  Nhóm 3 cấp sổ ra huyện/thị xã/TP cũ; nhóm 2 cấp sổ ra khu vực. ── */}
              <OChonCoGo
                nhan={cap === '3' ? '— Chọn huyện/TP cũ —' : '— Chọn khu vực —'}
                giaTri={huyenChon}
                dsMuc={dsHuyen.map(([h, n]) => ({ id: h, ten: h, phu: `${n} xã/phường` }))}
                khiChon={(h) => { setHuyenChon(h); setC3(''); donKetQuaCu(); }}
                oRef={giu('huyen')} khiXong={() => datTro('xa-' + kp)}
                className={full ? 'flex-1 min-w-[150px]' : 'w-44'} />

              {/* ── RỒI CHỌN XÃ/PHƯỜNG ── chọn huyện rồi thì chỉ sổ ra xã của huyện đó;
                  chưa chọn huyện thì sổ ra hết, gõ tên là lọc ngay. Chọn xong bản đồ bay tới.
                  Dòng phụ ghi tên huyện để phân biệt 10 cặp xã TRÙNG TÊN. Số thửa CHỈ hiện với
                  tài khoản quản trị — máy chủ không gửi con số đó cho người dùng thường. ── */}
              <OChonCoGo
                nhan={huyenChon ? `— Chọn xã/phường (${xaTheoHuyen.length}) —` : '— Gõ hoặc chọn xã/phường —'}
                giaTri={c3}
                dsMuc={xaTheoHuyen.map((x) => ({
                  id: x.xaId,
                  ten: x.ten,
                  phu: x.soThua ? `${x.huyen} · ${x.soThua.toLocaleString('vi-VN')} thửa` : x.huyen,
                }))}
                khiChon={(ma) => {
                  donKetQuaCu();                                    // xoá kết quả của xã trước
                  setC3(ma);
                  const x = dsXaCap.find((y) => y.xaId === ma) || null;
                  if (x) { setHuyenChon(x.huyen); bayToiXa(x); }   // bay thẳng tới xã đó
                }}
                oRef={giu('xa')} khiXong={() => datTro('thua-' + kp)}
                className={full ? 'flex-1 min-w-[160px]' : 'w-48'} />
            </>
          )}
          {/* Tra theo THỬA thì gõ SỐ THỬA trước rồi mới tới SỐ TỜ — đúng thói quen đọc sổ.
              Các kiểu tra khác (toạ độ VN-2000, kinh/vĩ độ) vẫn giữ thứ tự cũ.
              Ô số tờ luôn là c1, ô số thửa luôn là c2 — chỉ đổi chỗ HIỂN THỊ, không đổi ruột. */}
          {searchMode === 'parcel' ? (
            <>
              <input ref={giu('thua')} value={c2} onChange={(e) => setC2(e.target.value)} onKeyDown={phimEnter(full, 'thua', kp)}
                onBlur={() => { const t = tachThuaTo(c2); if (t) { setC2(t.thua); setC1(t.to); } }}
                enterKeyHint={c1.trim() ? 'search' : 'next'} autoComplete="off" placeholder="Số thửa" title="Gõ số thửa rồi Enter (gõ gộp 95/15 cũng được)" className={`border rounded-lg px-2.5 ${full ? 'py-2 text-[16px] flex-1 min-w-[80px]' : 'py-1.5 text-xs w-24'}`} />
              <input ref={giu('to')} value={c1} onChange={(e) => setC1(e.target.value)} onKeyDown={phimEnter(full, 'to', kp)} enterKeyHint="search" autoComplete="off" placeholder={nhanOSoTo} className={`border rounded-lg px-2.5 ${full ? 'py-2 text-[16px] flex-1 min-w-[80px]' : 'py-1.5 text-xs w-24'}`} />
            </>
          ) : (
            <>
              <input ref={giu('mot')} value={c1} onChange={(e) => setC1(e.target.value)} onKeyDown={phimEnter(full, 'mot', kp)} enterKeyHint="next" inputMode="decimal" placeholder={searchMode === 'vn2000' ? 'X (Bắc)' : 'Vĩ độ (vd 12.0771)'} className={`border rounded-lg px-2.5 ${full ? 'py-2 text-[16px] flex-1 min-w-[80px]' : 'py-1.5 text-xs w-24'}`} />
              <input ref={giu('hai')} value={c2} onChange={(e) => setC2(e.target.value)} onKeyDown={phimEnter(full, 'hai', kp)} enterKeyHint="search" inputMode="decimal" placeholder={searchMode === 'vn2000' ? 'Y (Đông)' : 'Kinh độ (vd 109.0917)'} className={`border rounded-lg px-2.5 ${full ? 'py-2 text-[16px] flex-1 min-w-[80px]' : 'py-1.5 text-xs w-24'}`} />
            </>
          )}
        </>
      )}
      {/* Điện thoại (full): tra xong đóng bảng đáy để thấy kết quả trên bản đồ. */}
      <button onClick={() => traCuu(full)} title="Tra cứu (phím Enter)" className={`cl-press bg-[#0A2540] hover:bg-[#0d2f54] text-white px-4 rounded-lg font-bold whitespace-nowrap ${full ? 'w-full mt-1.5 py-2.5 text-sm' : 'py-1.5 text-xs'}`}>Tra cứu</button>
    </div>
    );
  };
  // dt = true: đang vẽ cho ĐIỆN THOẠI. Chỉ ở điện thoại mới gộp "Vẽ thửa từ toạ độ" vào
  // nhóm này (màn hẹp, gom ba công cụ TỰ TẠO HÌNH vào một chỗ cho dễ tìm). Máy tính giữ
  // nguyên như cũ: nhãn "Đo:" và nút vẽ thửa nằm ở bảng lớp bên trái.
  // Thứ tự trên ĐIỆN THOẠI (chủ dự án chốt 14/9/2026): hàng trên "Dài · Diện tích · Xong",
  // "Vẽ thửa từ toạ độ" xuống hàng riêng bên dưới dòng hướng dẫn. Trước đó nút vẽ thửa chen
  // giữa làm "Xong" rớt xuống một mình một hàng.
  const measureCtrl = (dt = false) => (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-slate-400">{dt ? 'Đo - vẽ:' : 'Đo:'}</span>
      {mBtn('distance', '📏 Dài')}{mBtn('area', '⬛ Diện tích')}
      {measure !== 'off' && <button onClick={() => { setMeasure('off'); setMResult(null); }} className="px-2 py-1 rounded text-xs border border-slate-300 whitespace-nowrap">Xong</button>}
      {mResult && mResult.points > 0 && (
        <span className="text-xs font-bold text-orange-700 ml-1 whitespace-nowrap">{mResult.mode === 'distance' ? `Dài: ${fmtLen(mResult.distance)}` : `S: ${fmtArea(mResult.area)}`}</span>
      )}
      {measure !== 'off' && <span className="text-[11px] text-slate-400 w-full">Nhấp lần lượt các điểm trên bản đồ…</span>}
      {dt && (
        <button onClick={() => setDrawOpen(true)}
          className="cl-press px-2 py-1 rounded text-xs font-medium border bg-white border-slate-300 text-slate-700 whitespace-nowrap hover:bg-slate-50">✏️ Vẽ thửa từ toạ độ</button>
      )}
    </div>
  );
  // ── MỘT KHỐI QUY HOẠCH trong bảng "Thông tin thửa" ─────────────────────────
  // TRÌNH BÀY GIẢN DỊ NHƯ BẢN TRƯỚC 12/8/2026: tiêu đề xám nhỏ, mỗi loại đất một dòng
  // "tên loại đất — diện tích". Ngày 12/9 từng đổi sang chữ to + huy hiệu % + thanh tỉ lệ màu,
  // chủ dự án chê "quá lòe loẹt" (13/9) → trả về kiểu cũ. Đừng thêm lại màu mè ở đây.
  // Vẫn giữ việc liệt kê RIÊNG từng bản quy hoạch (QĐ205 · QĐ893 · phân khu) — đó là dữ liệu.
  const khoiQh = (ten: string, areas: { type: string; areaM2: number }[], khoa: string) => {
    const ds = [...(areas || [])].filter((a) => a && a.areaM2 > 0).sort((a, b) => b.areaM2 - a.areaM2);
    if (!ds.length) return null;
    return (
      <div key={khoa} className="mt-3 pt-2.5 border-t border-slate-100">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">{ten}</p>
        {ds.map((a, i) => (
          <div key={i} className="flex justify-between items-center gap-2 py-0.5">
            <span className="text-slate-600">{a.type}</span>
            <span className="font-medium shrink-0">{fmtArea(a.areaM2)}</span>
          </div>
        ))}
      </div>
    );
  };
  // ── TRANG QUY HOẠCH LƯỚT NGANG — CHỈ ĐIỆN THOẠI (chủ dự án học theo app, 14/9/2026) ─────────
  // Mỗi trang = MỘT mục bản đồ quy hoạch (Quy hoạch chung 2045 · Phân khu · Sử dụng đất 2030), đúng
  // thứ tự MUC_QH. Lướt sang trang nào thì BẢN ĐỒ ĐỔI SANG LỚP ĐÓ, và trang chỉ hiện loại đất của bản đó:
  // mỗi dòng = ô diện tích TÔ ĐÚNG MÀU loại đất (màu lấy ở mau-loai-dat-qh.json) + tên loại đất.
  // Khác khối khoiQh() của máy tính (giản dị, không màu) — ở đây chủ dự án chủ động muốn ô màu như app.
  const trangQhCuaThua = (): { muc: (typeof MUC_QH)[number]; tieuDe: string; phu?: string; areas: { type: string; areaM2: number }[]; bangMau: string; mauRieng?: Record<string, string>; khoa?: boolean; traPhi?: boolean }[] => {
    if (!info?.parcel) return [];
    const cacBan: any[] = (info as any).qhCacBan || [];
    const PK = ['2076', '2101', '2222', '918', 'cuhin', 'taynam', 'taybac'];
    const gop = (ds: { type: string; areaM2: number }[]) => {
      const m = new Map<string, number>();
      for (const a of ds) if (a && a.areaM2 > 0 && a.type !== 'Nằm ngoài phạm vi bản quy hoạch này') m.set(a.type, (m.get(a.type) || 0) + a.areaM2);
      return [...m.entries()].map(([type, areaM2]) => ({ type, areaM2 })).sort((a, b) => b.areaM2 - a.areaM2);
    };
    const ra: ReturnType<typeof trangQhCuaThua> = [];
    for (const muc of MUC_QH) {
      // Trang "Quy hoạch chung 2045" (QĐ205) của thửa Cam Lâm — PHẢI GIỮ. 13/10/2026 phiên trước hiểu nhầm lời dặn "bỏ dòng
      // 'Hiện mới có Quy hoạch chung đô thị mới Cam Lâm đến 2045 (QĐ 205/QĐ-TTg)…'" thành bỏ cả trang này; chủ dự án hỏi lại
      // 14/10 "sao xoá mất cái Cam Lâm". Thứ phải bỏ chỉ là CÂU ghi chú cho thửa ngoài vùng (xem khối qhNgoaiVung).
      // KHOÁ CAM LÂM (15/10/2026): người không được xem đủ thì máy chủ chỉ gửi dấu khoá (mã '205' / 'pk', khoa:true) cho bản có phủ thửa
      // → trang có 🔒 + nút "Đăng ký thành viên để xem" (traPhi → hộp HopTraPhi), không có loại đất / diện tích.
      const khoaMa = (ma: string) => cacBan.some((x) => String(x.ma) === ma && x.khoa);
      if (muc.id === 'qh-qd205') {
        if (info.overlaps?.length) ra.push({ muc, tieuDe: 'Quy hoạch chung 2045', areas: gop(info.overlaps as any), bangMau: 'qd205' });
        else if (khoaMa('205')) ra.push({ muc: { ...muc, khoa: true }, tieuDe: 'Quy hoạch chung 2045', areas: [], bangMau: 'qd205', khoa: true, traPhi: true });
      }
      if (muc.id === 'phan-khu') {
        const ban = cacBan.filter((b) => PK.includes(String(b.ma)));
        const areas = gop(ban.flatMap((b) => b.areas || []));
        if (areas.length) ra.push({ muc, tieuDe: 'Quy hoạch phân khu 1/2000', phu: ban.map((b) => String(b.ten).split(' — ')[0].replace(/ 1\/2000$/, '')).join(' · '), areas, bangMau: 'phankhu' });
        else if (khoaMa('pk')) ra.push({ muc: { ...muc, khoa: true }, tieuDe: 'Quy hoạch phân khu 1/2000', areas: [], bangMau: 'phankhu', khoa: true, traPhi: true });
      }
      if (muc.id === 'qh-qd893') {
        const b = cacBan.find((x) => String(x.ma) === '893');
        const areas = b ? gop(b.areas || []) : [];
        if (areas.length) ra.push({ muc, tieuDe: 'Quy hoạch sử dụng đất 2030', areas, bangMau: 'qd893' });
      }
      // QHSDĐ 2030 các huyện/thị ngoài Cam Lâm — BÓC TỪ BẢN ĐỒ PDF (máy chủ lib/qhPdf.ts, mục nguon:'pdf'). Màu ô = màu chính
      // bản vẽ đó (máy chủ gửi kèm), không lấy bảng màu Cam Lâm. Ghi rõ "tham khảo" vì ranh vùng lấy từ bản in 1:25.000.
      if (muc.pdf) {
        const b = cacBan.find((x) => String(x.ma) === 'pdf-' + muc.pdf);
        const areas = b ? gop(b.areas || []) : [];
        if (areas.length) ra.push({ muc, tieuDe: 'Quy hoạch sử dụng đất 2030', phu: 'bóc từ bản đồ PDF · tham khảo', areas, bangMau: 'pdf',
          mauRieng: Object.fromEntries(((b.areas || []) as any[]).filter((a) => a.mau).map((a) => [a.type, a.mau])) });
      }
    }
    // QH CHI TIẾT 1/500 (15/10/2026, chủ dự án: "thông tin thửa chưa hiện thông tin quy hoạch 1-500") — máy chủ lib/qh500.ts, mục ma 'ct500'.
    // Admin: loại đất + diện tích (màu = màu lớp "QH chi tiết 1/500 · tô màu", máy chủ gửi kèm); lướt tới trang này là bật lớp tô màu.
    // Người khác: máy chủ chỉ gửi dấu khoa (thửa nằm trong ranh 1/500) → trang có khoá, bấm "Liên hệ admin" mở hộp hopKhoa.
    const b500 = cacBan.find((x) => String(x.ma) === 'ct500');
    if (b500) {
      const muc = mucQh.find((m) => m.id === 'qh-ct500-mau') || mucQh.find((m) => m.id === 'qh-ct500')
        || { id: 'qh-ct500', ten: 'QH chi tiết 1/500', tenNgan: 'Chi tiết 1/500', tenApp: 'QH chi tiết 1/500', gom: ['qh-ct500'], vung: 'cam-lam', khoa: true };
      if (b500.khoa) ra.push({ muc: { ...muc, khoa: true }, tieuDe: 'Quy hoạch chi tiết 1/500', areas: [], bangMau: 'pdf', khoa: true, traPhi: true });
      else {
        const areas = gop(b500.areas || []);
        if (areas.length) ra.push({ muc, tieuDe: 'Quy hoạch chi tiết 1/500', phu: b500.qd ? `QĐ ${b500.qd}` : undefined, areas, bangMau: 'pdf',
          mauRieng: Object.fromEntries(((b500.areas || []) as any[]).filter((a) => a.mau).map((a) => [a.type, a.mau])) });
      }
    }
    return ra;
  };
  // Chữ trên ô màu: nền tối thì chữ trắng, nền sáng thì chữ đen (tính theo độ sáng cảm nhận).
  const chuTrenMau = (hex: string) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return '#0A2540';
    const n = parseInt(m[1], 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return 0.299 * r + 0.587 * g + 0.114 * b < 140 ? '#fff' : '#0A2540';
  };
  // Mở bảng thửa: nhảy tới trang của bản quy hoạch ĐANG BẬT (nếu thửa có), không thì trang đầu.
  useEffect(() => {
    if (!info?.parcel) return;
    const ds = trangQhCuaThua();
    const i = Math.max(0, ds.findIndex((t) => t.muc.gom.every((id) => !!ovOn[id])));
    setTrangQh(i);
    requestAnimationFrame(() => { const el = trangQhRef.current; if (el) el.scrollTo({ left: i * buocTrang(el), behavior: 'auto' }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info]);
  // Đổi quy hoạch ở bảng "Lớp Q.Hoạch" trong lúc bảng thửa đang mở → bảng thửa lướt theo tới đúng trang đó
  // (chủ dự án 15/9/2026). Trang đang xem mà lớp của nó vẫn bật thì đứng yên, khỏi nhảy lung tung.
  useEffect(() => {
    if (!info?.parcel) return;
    const ds = trangQhCuaThua();
    const dangBat = (t: (typeof ds)[number]) => t.muc.gom.every((id) => !!ovOn[id]);
    if (ds[trangQh] && dangBat(ds[trangQh])) return;
    const i = ds.findIndex(dangBat);
    if (i < 0) return;
    setTrangQh(i);
    requestAnimationFrame(() => { const el = trangQhRef.current; if (el) el.scrollTo({ left: i * buocTrang(el), behavior: 'smooth' }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ovOn]);
  // Một bước lướt = bề rộng một thẻ + khoảng hở (kiểu Thẻ ngang thẻ hẹp hơn khung, các kiểu khác = cả khung).
  function buocTrang(el: HTMLDivElement) {
    const a = el.children[0] as HTMLElement | undefined, b = el.children[1] as HTMLElement | undefined;
    return Math.max(1, b && a ? b.offsetLeft - a.offsetLeft : el.clientWidth);
  }
  const khiLuotTrangQh = () => {
    const el = trangQhRef.current; if (!el) return;
    const i = Math.min(el.children.length - 1, Math.round(el.scrollLeft / buocTrang(el)));
    if (i === trangQh) return;
    setTrangQh(i);
    const t = trangQhCuaThua()[i];
    if (t && !t.khoa && !t.muc.gom.every((id) => !!ovOn[id])) chonLopQh(t.muc, true);   // lướt tới đâu, bản đồ đổi lớp tới đó (trang có khoá thì thôi)
  };
  // Nạp bảng chú giải MỘT LẦN, lúc người dùng bấm mở (ai không xem thì khỏi tải thêm gì).
  const napChuGiai = () => {
    if (chuGiai) return;
    fetch('/chu-giai-qh.json').then((r) => r.json())
      .then((d) => setChuGiai({ nhom: d?.nhom || [], ban: d?.ban || {} }))
      .catch(() => setChuGiai({ nhom: [], ban: {} }));
  };
  // Tải SẴN chú giải ~1,5 giây sau khi mở trang (file chỉ ~12 KB) → bấm "Chú giải" là hiện ngay,
  // không phải chờ tải lúc bấm (chủ dự án thấy "tải hơi lâu", 6/10/2026).
  useEffect(() => { const t = setTimeout(napChuGiai, 1500); return () => clearTimeout(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Ruột bảng chú giải — dùng chung cho bảng bên trái (máy tính) và nhóm trên thanh (điện thoại).
  // Gộp chú giải của các bản phân khu ĐANG BẬT: cùng nhóm + cùng màu thì gộp tên (không lặp), xếp màu nhiều ô trước.
  const chuGiaiDangBat = (): NhomChuGiai[] | null => {
    if (!chuGiai) return null;
    // Mọi bản đang bật (QĐ205 · phân khu · QĐ893 — 11/10/2026: trước chỉ có phân khu, chủ dự án hỏi "205 và 893 chưa có chú giải")
    // + lớp chỉ-admin có chú giải riêng (1/500 tô màu — máy chủ gửi kèm vé, 15/10/2026).
    const banCG: Record<string, NhomChuGiai[]> = { ...chuGiai.ban };
    for (const l of lopRieng?.lop || []) if (l.chuGiai?.length) banCG[l.id] = l.chuGiai;
    const ids = mucQh.flatMap((x) => x.gom).filter((id) => !!ovOn[id] && banCG[id]);
    if (!ids.length) return [];
    const thuTu = chuGiai.nhom.map((n) => n.nhom);
    const gom = new Map<string, Map<string, { mau: string; ten: Map<string, number>; so: number }>>();
    for (const id of ids) for (const n of banCG[id]) {
      const g = gom.get(n.nhom) || new Map(); gom.set(n.nhom, g);
      for (const m of n.muc) {
        const o = g.get(m.mau) || { mau: m.mau, ten: new Map<string, number>(), so: 0 }; g.set(m.mau, o);
        o.so += m.so; m.tenDs.forEach((t, i) => o.ten.set(t, (o.ten.get(t) || 0) + (m.tenDs.length - i)));
      }
    }
    return Array.from(gom.entries())
      .sort((a, b) => thuTu.indexOf(a[0]) - thuTu.indexOf(b[0]))
      .map(([nhom, g]) => ({ nhom, muc: Array.from(g.values()).sort((a, b) => b.so - a.so)
        .map((o) => ({ mau: o.mau, so: o.so, tenDs: Array.from(o.ten.entries()).sort((a, b) => b[1] - a[1]).map(([t]) => t) })) }));
  };
  const chuGiaiNoiDung = () => {
    const ds = chuGiaiDangBat();
    return (
    <div className="max-h-72 overflow-y-auto rounded-lg border bg-slate-50/60 p-2">
      {ds === null && <p className="text-[11px] text-slate-400 py-1">Đang tải…</p>}
      {ds !== null && ds.length === 0 && (
        <p className="text-[11px] text-slate-500 py-1 leading-snug">
          Bật một lớp quy hoạch (nút <b>Lớp Q.Hoạch</b>) để xem chú giải màu của bản đó. Bấm vào thửa đất để biết loại đất và diện tích quy hoạch.
        </p>
      )}
      {(ds || []).map((n) => (
        <div key={n.nhom} className="mb-2 last:mb-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">{n.nhom}</p>
          {n.muc.map((m) => (
            /* Một màu có thể dùng cho nhiều loại đất (bản vẽ tô chung màu) → ghi ĐỦ từng tên, mỗi tên một dòng. */
            <div key={m.mau} className="flex items-start gap-2 py-[3px]">
              <span className="mt-[3px] inline-block w-3.5 h-3.5 rounded-sm shrink-0 border border-black/10"
                style={{ background: m.mau }} />
              <span className="min-w-0 flex-1 text-[11px] leading-snug text-slate-600">
                {m.tenDs.map((t) => <span key={t} className="block">{t}</span>)}
              </span>
            </div>
          ))}
        </div>
      ))}
      <p className="mt-2 pt-2 border-t text-[10px] leading-snug text-slate-400">
        Màu lấy đúng từ bản vẽ quy hoạch được duyệt (bảng màu MicroStation).
        Thông tin chỉ mang tính tham khảo.
      </p>
    </div>
    );
  };
  // Thanh nút ĐIỆN THOẠI — KIỂU APP THAM CHIẾU (14/9/2026): một hàng nút BO TRÒN, không icon,
  // "Lớp Q.Hoạch (n)" ghi kèm số bản đồ quy hoạch chọn được. Bấm nó mở BẢNG ĐÁY chọn bản đồ
  // (không mở bảng lớp trượt che nửa màn hình nữa).
  // ── MẪU 51: chip nhỏ nổi trên bản đồ + vài hàm phụ ──
  const laMayTinh = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
  const tenLopDangBat = () => {
    const o = mucQh.find((x) => x.gom.length && x.gom.every((id) => !!ovOn[id]));
    if (!o) return 'Lớp QH';
    return o.ten.replace(/^Quy hoạch /, 'QH ').replace(/\s*\(.*\)$/, '');
  };
  // Tra ra thửa (hoặc ra danh sách thửa trùng số) thì tự gập khung tìm cho thấy bản đồ; phím Esc cũng gập.
  useEffect(() => { if (info || ketQuaTim.length > 1) setTimMo(false); }, [info, ketQuaTim]);
  useEffect(() => {
    if (!timMo) return;
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') setTimMo(false); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [timMo]);
  // Chip "Lớp" luôn nền đậm (nút chính); các chip khác đậm khi đang mở.
  // Mở công cụ khác (Vẽ, Chú giải, Đã lưu, ô tìm) thì TẮT thước đo đang mở (chủ dự án 6/10/2026). Riêng chip Lớp vẫn giữ phép đo
  // (quy định 17/9/2026: đo xong đổi lớp quy hoạch để so, không bắt đo lại).
  const tatDo = () => { if (measure !== 'off') { setMeasure('off'); setMResult(null); } if (tool === 'measure') setTool('none'); };
  // Biểu tượng chip — CÙNG MỘT KIỂU nét mảnh đơn sắc (trước lẫn emoji màu ⭐📏 với ký tự đen ✎◧ → không thống nhất, 6/10/2026)
  const ICO: Record<string, JSX.Element> = {
    lop: <><path d="m12 3 9 5-9 5-9-5 9-5z" /><path d="m3 13 9 5 9-5" /></>,
    do: <><path d="M3 17 17 3l4 4L7 21z" /><path d="m7 13 2 2M10 10l2 2M13 7l2 2" /></>,
    ve: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13 7 4 4" /></>,
    chugiai: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h2M8 13h2M8 17h2M13 9h3M13 13h3M13 17h3" /></>,
    luu: <path d="M6 3h12v18l-6-4-6 4z" />,
  };
  const chip = (ico: string, nhan: string, on: boolean, bam: () => void) => (
    <button type="button" onClick={bam}
      className={`flex h-[30px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[12px] font-semibold shadow-[0_4px_12px_-8px_rgba(10,37,64,.5)] transition active:scale-[.97] ${on ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden>{ICO[ico]}</svg>{nhan}</button>
  );
  // KHUNG NỔI DÙNG CHUNG cho Lớp · Đã lưu · Đo · Chú giải (máy tính): cùng chỗ, cùng rộng, cùng kiểu đầu khung
  // Mọi khung (kể cả khung Tìm) cùng RỘNG 480px = đúng bằng ô tìm, căn GIỮA thẳng dưới ô tìm, cùng chiều cao tối đa
  // (trước lệch hẳn sang trái và mỗi khung một cỡ — chủ dự án 6/10/2026).
  // MẪU KÍNH MỜ (chủ dự án chọn mẫu 4, 6/10/2026) → sau đổi NỀN TRẮNG ĐẶC, giữ bo 12px, dòng chọn tô nhạt, bóng mềm.
  const KINH_MO = 'bg-white border border-slate-200/80 rounded-xl shadow-[0_12px_32px_-10px_rgba(10,37,64,.45)]'; // kiểu kính mờ nhưng NỀN TRẮNG ĐẶC (chủ dự án 6/10/2026)
  const KHUNG_NOI = `absolute top-[96px] z-30 hidden w-[480px] max-h-[calc(100%-110px)] overflow-y-auto p-3.5 lg:left-1/2 lg:block lg:-translate-x-1/2 ${KINH_MO}`;
  const dauKhung = (ten: string, dong: () => void) => (
    <div className="mb-2.5 flex items-center justify-between"><h2 className="text-[15px] font-bold text-[#0A2540]">{ten}</h2><button type="button" onClick={dong} aria-label="Đóng" className="text-xl leading-none text-slate-400 hover:text-slate-700">✕</button></div>
  );
  const tabBtn = (key: string, label: string, active: boolean, dot = false) => (
    // MỖI LÚC CHỈ MỘT NHÓM MỞ: bấm nhóm nào là đóng bảng "Lớp Q.Hoạch" + tắt đo của nhóm khác.
    // Trước đây mở "Đo - vẽ" mà bảng lớp vẫn nằm đè nửa màn hình (chủ dự án chụp màn hình báo).
    <button onClick={
      // ĐANG ĐO thì mở bảng Lớp Q.Hoạch KHÔNG được tắt thước đo (chủ dự án 17/9/2026):
      // người ta hay đo xong rồi đổi lớp quy hoạch để xem cùng một khoảng đất trên bản khác —
      // tắt mất là phải đo lại từ đầu. Chỉ người dùng bấm ✕ hay "Xong" mới tắt đo.
      // Bảng lớp là lớp phủ kín màn hình (z-58) nên để bảng đo nằm dưới cũng không vướng gì;
      // đóng bảng lớp là thấy lại đúng phép đo đang dở.
      key === 'layers' ? () => { setQhSheet(true); setPanelOpen(false); setNenOpen(false); if (measure === 'off') { setTool('none'); setMResult(null); } }
        : key === 'measure' ? () => { const open = tool !== 'measure'; setPanelOpen(false); setTool(open ? 'measure' : 'none'); setMeasure(open ? 'distance' : 'off'); setMResult(null); }
          : key === 'chugiai' ? () => { napChuGiai(); setPanelOpen(false); setTool(tool === 'chugiai' ? 'none' : 'chugiai'); }
            : () => { setPanelOpen(false); setTool(tool === key ? 'none' : (key as any)); }}
      // grow: 4 nút GIÃN ĐỀU kín cả hàng — trước để shrink-0 nên dồn trái, bên phải hở một khúc.
      className={`relative grow rounded-full border px-2.5 py-1.5 text-[12.5px] font-semibold whitespace-nowrap shadow-sm transition active:scale-[.96] ${active ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
      {label}
      {dot && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-500 ring-2 ring-white" />}
    </button>
  );

  // Mở bảng đáy Tra cứu (điện thoại) thì kiểu tra phải khớp THẺ đang chọn — vì ô sổ xuống chọn
  // kiểu tra đã bị ẩn trong bảng đáy, lệch là bấm "Tra cứu" ra kiểu khác mà không biết.
  useEffect(() => {
    if (tool !== 'search') return;
    if (tcTab === 'to') setSearchMode('parcel');
    else if (tcTab === 'gmap') setSearchMode('gmap');
    else if (tcTab === 'toado' && searchMode !== 'latlng' && searchMode !== 'vn2000') setSearchMode('vn2000');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, tcTab]);

  return (
    // Cao = màn hình − thanh trên (56px) − phần TAI THỎ phía trên (thanh trên có đệm vùng an toàn).
    // Trước chỉ trừ 56px nên trên iPhone trang DƯ ra đúng phần tai thỏ → còn chỗ để trượt.
    <div className="flex flex-col h-[calc(100dvh-56px-env(safe-area-inset-top))] overflow-hidden mb-[calc(-48px-env(safe-area-inset-bottom))] md:mb-0"
      style={menuDo ? ({ '--menu-de': menuDo.de + 'px', '--menu-cao': menuDo.cao + 'px' } as React.CSSProperties) : undefined}>
      {/* MÁY TÍNH (lg+) xếp dạng LƯỚI 2 cột (30/9/2026, chủ dự án đề xuất): bảng lớp bên trái chạy SUỐT từ trên xuống
        (lấp ô trống cũ phía trên nó), thanh công cụ chỉ nằm trên phần bản đồ. Điện thoại giữ nguyên cột dọc.
        Thân trang dùng lg:contents để bảng lớp + bản đồ thành ô của lưới này. */}
      {/* MẪU 51 (chủ dự án chọn 6/10/2026, bản gọn của biến thể 2 từ mẫu 157): BỎ thanh công cụ trên cùng + cột "Lớp Q.Hoạch"
          cố định bên trái. Thay bằng Ô TÌM NỔI giữa phía trên bản đồ + HÀNG CHIP nhỏ (Lớp · Đo · Vẽ · Chú giải · Đã lưu · Nhãn),
          bảng lớp thành khung nổi mở khi bấm chip, thẻ thông tin thửa dời sang trái. Lõi bản đồ + mọi chức năng GIỮ NGUYÊN —
          chỉ đổi chỗ đặt nút. Bản trước khi đổi: xem git (lần lưu ngay trước "Ban do: ap mau 51"). */}
      {/* Điện thoại GIỮ NGUYÊN thanh nút cũ (chủ dự án 6/10/2026: mẫu 51 chỉ cho bản máy tính) */}
      {/* Toolbar tra cứu quy hoạch — dính cố định; desktop đầy đủ, mobile gọn theo nhóm */}
      <div className="lg:hidden bg-white border-b border-slate-200 shrink-0 z-20">
        {/* MÁY TÍNH (lg+): một hàng đầy đủ, tự xuống dòng khi hẹp */}
        <div className="hidden lg:flex items-center gap-x-3 gap-y-2 px-4 py-2.5 flex-wrap">
          {/* Nút đổi nền (Đường/Vệ tinh) + thanh độ mờ đã dời ra CỘT NÚT BÊN PHẢI bản đồ y như điện thoại
              (chủ dự án 30/9/2026: "cho gọn"). Ở đây chỉ còn "Nhãn & đường".
              Ô trống chỗ khối nền cũ nay được BẢNG LỚP bên trái kéo lên lấp (xem lưới ở thẻ ngoài cùng). */}
          {labelsCtrl()}
          <span className="h-5 w-px bg-slate-200" />
          {searchCtrl()}
          <span className="h-5 w-px bg-slate-200" />
          {measureCtrl()}
        </div>

        {/* ĐIỆN THOẠI / iPad dọc (<lg): 4 nút gọn, bấm để mở từng nhóm */}
        <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto px-2.5 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabBtn('search', 'Tra cứu', tool === 'search')}
          {tabBtn('measure', 'Đo', tool === 'measure', measure !== 'off')}
          {tabBtn('chugiai', 'Chú giải', tool === 'chugiai')}
          {tabBtn('layers', `Lớp Q.Hoạch (${mucHienThi.length})`, qhSheet)}
        </div>
        {/* Tra cứu + Đo - vẽ trên điện thoại đã chuyển thành BẢNG ĐÁY kiểu app (xem dưới bản đồ);
            ở đây chỉ còn Chú giải xổ xuống. */}
        {tool === 'chugiai' && (
          <div className="lg:hidden border-t border-slate-100 bg-slate-50 px-3 py-3">
            <p className="text-[11px] font-semibold text-slate-500 mb-1.5">Chú giải loại đất</p>{chuGiaiNoiDung()}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 relative">
        {panelOpen && <div className="lg:hidden absolute inset-0 bg-black/30 z-20" onClick={() => setPanelOpen(false)} />}

        <aside className={`${panelOpen ? 'translate-x-0' : '-translate-x-full lg:hidden'} transition-transform duration-200 absolute inset-y-0 left-0 z-30 w-72 max-w-[82%] shrink-0 bg-white border-r border-slate-200 overflow-y-auto scroll-soft p-4 shadow-xl lg:inset-y-auto lg:top-[96px] lg:left-1/2 lg:-translate-x-1/2 lg:max-h-[calc(100%-110px)] lg:w-[480px] lg:rounded-xl lg:border lg:p-3.5 lg:text-[13px] lg:bg-white lg:border-slate-200/80 lg:shadow-[0_12px_32px_-10px_rgba(10,37,64,.45)]`}>
          {/* Mẫu 51 (máy tính): chip "Lớp" chỉ hiện phần LỚP, chip "Đã lưu" chỉ hiện phần SẢN PHẨM ĐÃ LƯU — trước đây
              cả hai cùng hiện chung một bảng nên trùng (chủ dự án 6/10/2026). Điện thoại ngăn kéo vẫn đủ cả hai. */}
          <div className={bangMuc === 'luu' ? 'lg:hidden' : ''}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold lg:text-[15px] lg:text-[#0A2540]">Lớp Q.Hoạch</h2>
            <button onClick={() => setPanelOpen(false)} aria-label="Đóng" className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
          </div>
          {/* Máy tính (mẫu 51): bỏ nút "Vẽ thửa từ toạ độ" (trùng chip "Vẽ") + dòng gợi ý cuối bảng — chủ dự án thấy dư, 6/10/2026 */}
          <p className="text-xs text-slate-500 mb-2.5 lg:hidden">Cam Lâm, Khánh Hòa · EPSG:4326</p>
          {/* Máy tính: giữ nguyên nút này ở bảng lớp như cũ. Điện thoại thì nó đã nằm trong
              nhóm "Đo - vẽ" ở thanh trên rồi, để thêm ở đây là thừa. */}
          <button onClick={() => setDrawOpen(true)} className="cl-press hidden w-full mb-3 items-center justify-center gap-2 bg-[#0A2540] hover:bg-[#0d2f54] text-white text-sm font-bold py-2.5 rounded-lg">✏️ Vẽ thửa từ toạ độ</button>
          {/* Ô chọn nền bản đồ nằm ở đây vì trên điện thoại nhóm 'Bản đồ' ở thanh trên đã được
              nhường chỗ cho Chú giải. Máy tính vẫn có ô này ở thanh trên, để đây thêm cũng không
              thừa: người dùng hay mở bảng lớp rồi mới nghĩ đến chuyện đổi nền. */}
          {/* Điện thoại: ô chọn NỀN BẢN ĐỒ + "Nhãn & đường" đã đưa ra NỔI TRÊN BẢN ĐỒ (nút "Nền"
              góc trái dưới) giống app tham chiếu — không còn nằm trong bảng này. */}
          <div className="pt-1">
            {/* ĐỊA GIỚI: chọn huyện/thị để CHỈ HIỆN quy hoạch của vùng đó — giờ nhiều bản quá, gom cho gọn
                (chủ dự án 14/10/2026). Đổi vùng là bay tới đó, chưa bật lớp nào. */}
            <label className="block mb-2.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Địa giới</span>
              <select value={vungQh} onChange={(e) => doiVung(e.target.value)}
                className="mt-1 w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm font-semibold text-[#0A2540] bg-white focus:border-emerald-500 focus:outline-none">
                {VUNG_QH.map((v) => (<option key={v.id} value={v.id}>{v.ten}</option>))}
              </select>
            </label>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Bản đồ quy hoạch</p>
            {mucHienThi.length === 0 && (<p className="text-sm text-slate-400 py-1.5">Chưa có bản quy hoạch cho địa giới này.</p>)}
            {mucHienThi.map((o) => (
              <label key={o.id} className={`flex items-start gap-2.5 py-1.5 text-sm cursor-pointer lg:-mx-2 lg:rounded-lg lg:px-2 lg:py-2 lg:transition lg:hover:bg-[#0A2540]/[.05] ${o.gom.every((id) => !!ovOn[id]) ? 'lg:bg-[#0A2540]/[.07]' : ''}`}>
                {/* MỖI LÚC CHỈ MỘT lớp quy hoạch — chọn lớp này là tự tắt lớp kia. Các bản quy hoạch
                    phủ đè lên nhau (QĐ205 trùm cả huyện, 3 bản 1/2000 nằm lọt bên trong), bật cùng
                    lúc là màu chồng màu, không đọc được gì. Bấm lại vào lớp đang bật để TẮT HẾT,
                    khi đó chỉ còn ảnh nền — nhìn thực địa để đối chiếu. */}
                {/* Ô VUÔNG cho đồng bộ với các lớp dữ liệu bên dưới, nhưng vẫn chỉ chọn được MỘT:
                    tích lớp này là các lớp kia tự bỏ tích; bỏ tích thì tắt hết, chỉ còn ảnh nền. */}
                <input type="checkbox" checked={!o.khoa && o.gom.every((id) => !!ovOn[id])}
                  onChange={(e) => bamMucQh(o, e.target.checked)}
                  className="accent-emerald-600 w-4 h-4 rounded-sm" />
                <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0 bg-amber-500" /><span className="min-w-0 flex-1 text-slate-700 leading-snug">{o.ten}{(o.khoa || o.xemThu) && <span className="ml-1 text-[11px]" aria-label={o.xemThu ? 'xem ở mức nhìn xa' : 'liên hệ admin'}>🔒</span>}</span>
              </label>
            ))}
            {/* Máy tính: thanh độ mờ nằm ở cột nút bên phải bản đồ (như điện thoại) → ẩn bản ở bảng này. */}
            <div className="mt-1 pl-[26px] lg:hidden">
              <div className="flex justify-between text-[11px] text-slate-400 mb-1"><span>Độ mờ</span><span className="font-semibold text-slate-500">{Math.round(doMoHien * 100)}%</span></div>
              <div className="relative">
                <input type="range" min={0} max={100} value={Math.round(doMoHien * 100)} disabled={khoaDoMo} onChange={(e) => setOpacity(Number(e.target.value) / 100)} className="w-full accent-emerald-600" />
                {khoaDoMo && <button type="button" aria-label="Chỉnh độ mờ là tính năng trả phí" onClick={() => setTraPhiQh('Chỉnh độ mờ bản đồ quy hoạch')} className="absolute inset-0" />}
              </div>
            </div>
            {/* ── CHÚ GIẢI ─────────────────────────────────────────────────────────────
                Chỉ hiện khi đang bật một lớp phân khu 1/2000 — bốn bản đó mới là bản được
                tô theo loại đất. QĐ205 và QĐ893 vẫn giữ màu bản vẽ gốc nên bảng này không
                đúng cho chúng, hiện ra là dẫn người xem đọc sai. */}
            {/* Điện thoại KHÔNG hiện khối này (chủ dự án yêu cầu 14/9/2026): đã có nhóm "Chú giải"
                riêng trên thanh trên, để thêm trong bảng lớp là trùng. */}
            {/* Máy tính: KHÔNG còn khối chú giải trong khung Lớp — đã có nút "Chú giải" riêng trên hàng chip (chủ dự án 6/10/2026). */}
          </div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mt-3 mb-1.5 pt-3 border-t">Lớp dữ liệu</p>
          {ranhXa && (
            <label className="flex items-center gap-2.5 py-1.5 text-sm cursor-pointer">
              <input type="checkbox" checked={ranhOn} onChange={(e) => setRanhOn(e.target.checked)} className="accent-emerald-600 w-4 h-4" />
              <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0 bg-[#C8A14B]" /><span className="flex-1 text-slate-700">🗺️ Ranh giới xã</span>
            </label>
          )}
          {layers.length === 0 && (
            <div className="space-y-2 py-1" aria-hidden>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <Skeleton className="h-4 w-4 shrink-0" rounded="rounded" />
                  <Skeleton className="h-2.5 w-2.5 shrink-0" rounded="rounded-sm" />
                  <Skeleton h={12} className="flex-1" />
                </div>
              ))}
            </div>
          )}
          {layersHienThi.map((l) => (
            <div key={l.slug} className="flex items-center gap-2.5 py-1.5 text-sm">
              <input type="checkbox" checked={visible[l.slug] ?? false} onChange={(e) => setVisible((v) => ({ ...v, [l.slug]: e.target.checked }))} className="accent-emerald-600 w-4 h-4" />
              <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: (l.style?.color as string) || DEFAULT_COLORS[l.layerType] }} />
              <span className="flex-1 truncate text-slate-700" title={l.name}>{l.name}</span>
              <span className="text-xs text-slate-400">{l.featureCount}</span>
              {canDelete && <button onClick={() => deleteLayer(l.slug, l.name)} title="Xoá lớp" className="text-slate-300 hover:text-red-600">🗑</button>}
            </div>
          ))}
          </div>
          {user && (<>
            {/* MÁY TÍNH — khung "Sản phẩm đã lưu" làm lại (chủ dự án 6/10/2026 "làm đẹp hơn"): thẻ từng điểm có ghim vàng,
                tên + toạ độ hai dòng, giá thành nhãn vàng, nút "Đăng tin" viền xanh đậm (bỏ màu tím lạc tông), nút xoá hiện khi rê chuột. */}
            {bangMuc === 'luu' && (
              <div className="hidden lg:block">
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-[15px] font-bold text-[#0A2540]">Sản phẩm đã lưu</h2>
                  <span className="rounded-full bg-[#0A2540]/8 px-2 py-0.5 text-[11px] font-bold text-[#0A2540] ring-1 ring-[#0A2540]/15">{places.length}</span>
                  {laAdmin(user) && (
                    <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[12px] text-slate-500"><input type="checkbox" checked={adminAll} onChange={(e) => setAdminAll(e.target.checked)} className="h-3.5 w-3.5 accent-[#0A2540]" />Xem của mọi người</label>
                  )}
                  <button onClick={() => setPanelOpen(false)} aria-label="Đóng" className={`${laAdmin(user) ? 'ml-2' : 'ml-auto'} text-xl leading-none text-slate-400 hover:text-slate-700`}>✕</button>
                </div>
                {places.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-[13px] text-slate-500">Chưa lưu điểm nào.<br /><span className="text-[12px] text-slate-400">Bấm vào bản đồ rồi chọn &quot;Lưu sản phẩm&quot;.</span></div>
                ) : (
                  <div className="-mx-2 max-h-[calc(100vh-260px)] space-y-0.5 overflow-y-auto scroll-soft">
                    {places.map((p) => (
                      <div key={p.id} className="group flex items-center gap-2.5 rounded-lg px-2 py-2 transition hover:bg-[#0A2540]/[.06]">
                        <button onClick={() => { setFocusPoint({ lng: p.lng, lat: p.lat }); setFitTo([[p.lng - 0.004, p.lat - 0.004], [p.lng + 0.004, p.lat + 0.004]]); }} className="flex min-w-0 flex-1 items-center gap-2.5 text-left" title="Bay tới điểm này">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#C8A14B]/15 text-[#a8822f]">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-[#0A2540]">{p.note || 'Điểm đã lưu'}</span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                              <span className="truncate tabular-nums">X {(p.x ?? 0).toFixed(0)}{(p as any).y != null ? ` · Y ${Number((p as any).y).toFixed(0)}` : ''}</span>
                              {p.price && <span className="shrink-0 rounded bg-[#C8A14B]/15 px-1.5 py-px font-bold text-[#8a6a22]">{p.price}</span>}
                            </span>
                            {adminAll && p.ownerName && <span className="mt-0.5 block truncate text-[11px] text-slate-500">Người lưu: {p.ownerName}{p.ownerPhone ? ' · ' + p.ownerPhone : ''}</span>}
                          </span>
                        </button>
                        {!adminAll && <button onClick={() => publishPlace(p)} title="Đăng tin bán cho điểm này" className="shrink-0 rounded-md border border-[#0A2540]/25 px-2.5 py-1 text-[12px] font-semibold text-[#0A2540] hover:border-[#0A2540] hover:bg-[#0A2540] hover:text-white">Đăng tin</button>}
                        <button onClick={async () => { await removePlace(p.id).catch(() => {}); loadPlaces(); }} aria-label="Xoá điểm đã lưu" title="Xoá" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* Khối cũ bên dưới: giữ cho ĐIỆN THOẠI; trên máy tính chỉ hiện ở khung Lớp (không ở khung Đã lưu) */}
            <div className={`mt-3 pt-3 border-t ${bangMuc === 'lop' || bangMuc === 'luu' ? 'lg:hidden' : ''}`}>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-[11px] font-bold text-slate-400 uppercase tracking-wide ${bangMuc === 'luu' ? 'lg:invisible' : ''}`}>📌 {adminAll ? 'Tất cả đã lưu' : 'Sản phẩm của tôi'} ({places.length})</p>
                {laAdmin(user) && (
                  <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer"><input type="checkbox" checked={adminAll} onChange={(e) => setAdminAll(e.target.checked)} className="accent-[#7c3aed]" /> Xem tất cả</label>
                )}
              </div>
              <div className="space-y-1 max-h-44 overflow-y-auto scroll-soft">
                {places.length === 0 && <p className="text-[11px] text-slate-400">Chưa có. Bấm vào bản đồ rồi &quot;Lưu sản phẩm&quot;.</p>}
                {places.map((p) => (
                  <div key={p.id} className="flex items-center gap-1.5 text-xs bg-slate-50 rounded px-2 py-1">
                    <button onClick={() => { setFocusPoint({ lng: p.lng, lat: p.lat }); setFitTo([[p.lng - 0.004, p.lat - 0.004], [p.lng + 0.004, p.lat + 0.004]]); }} className="flex-1 min-w-0 text-left hover:text-[#7c3aed]" title={p.note || ''}>
                      <span className="block truncate font-medium">{p.note || `X=${(p.x ?? 0).toFixed(0)}`}{p.price ? ` · ${p.price}` : ''}</span>
                      {adminAll && p.ownerName && <span className="block text-[10px] text-[#7c3aed] truncate">👤 {p.ownerName}{p.ownerPhone ? ' · ' + p.ownerPhone : ''}</span>}
                    </button>
                    {!adminAll && <button onClick={() => publishPlace(p)} title="Đăng tin này" className="shrink-0 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[10px] font-bold px-2 py-0.5 rounded">＋ Đăng</button>}
                    <button onClick={async () => { await removePlace(p.id).catch(() => {}); loadPlaces(); }} aria-label="Xoá" className="text-slate-300 hover:text-red-600 shrink-0">✕</button>
                  </div>
                ))}
              </div>
            </div>
          </>)}
          <p className="text-xs text-slate-400 mt-4 lg:hidden">💡 Nhấp vào bản đồ để xem toạ độ + lưu sản phẩm + tra cứu thửa/quy hoạch.</p>
        </aside>

        <div ref={khungBanDoRef} className="relative flex-1 min-h-0">
          <MapView layers={geoLayers} overlays={overlays} markers={allMarkers} baseMap={baseMap} labels={labels} measureMode={measure}
            focusPoint={focusPoint} flyToPoint={flyPoint} highlight={highlight} onMapClick={onMapClick} onMeasure={setMResult} onViewport={onViewport} initialBounds={QH_BOUNDS} adMarkers={ads} adOpacity={1} fitTo={fitTo} textLabels={textLabels}
            routes={dirTuyen} onPickRoute={setDirChon} diaChinhTiles={dcTiles} />

          {/* ══ MẪU 51: Ô TÌM NỔI + HÀNG CHIP ══════════════════════════════════════════════════════
              Điện thoại: ô tìm chừa cột nút bên phải (nút ?, phóng to…) → bấm mở BẢNG ĐÁY Tra cứu sẵn có.
              Máy tính: ô 440px giữa trên → bấm sổ khung tìm ngay dưới (4 cách tìm + đủ ô cấp/huyện/xã/thửa/tờ). */}
          <button type="button" onClick={() => { if (laMayTinh()) { tatDo(); setPanelOpen(false); if (tool === 'chugiai') setTool('none'); setTimMo((v) => !v); } else { setPanelOpen(false); setTcTab('to'); setTool('search'); } }}
            className="absolute top-2 left-2 right-[50px] z-30 hidden h-[38px] items-center lg:flex gap-2 rounded-full border border-slate-200 bg-white px-3.5 text-left text-[13px] shadow-[0_6px_18px_-8px_rgba(10,37,64,.45)] lg:left-1/2 lg:right-auto lg:w-[480px] lg:-translate-x-1/2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4 shrink-0 text-slate-400" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <span className="min-w-0 flex-1 truncate text-slate-500">{(c2 || c1) && searchMode === 'parcel' ? `${dsXaCap.find((x) => x.xaId === c3)?.ten || ''}${c2 ? ' · Thửa ' + c2 : ''}${c1 ? ' · Tờ ' + c1 : ''}` : 'Xã, số thửa, số tờ…'}</span>
          </button>
          <div className="absolute top-[52px] left-2 right-[50px] z-20 hidden gap-1.5 overflow-x-auto lg:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:left-1/2 lg:right-auto lg:-translate-x-1/2 lg:overflow-visible">
            {chip('lop', `${tenLopDangBat()} ▾`, true, () => { if (laMayTinh()) { setTimMo(false); if (tool === 'chugiai') setTool('none'); setBangMuc('lop'); setPanelOpen((v) => !(v && bangMuc === 'lop')); } else { setQhSheet(true); setPanelOpen(false); if (measure === 'off') { setTool('none'); setMResult(null); } } })}
            {chip('do', 'Đo', tool === 'measure', () => { const open = tool !== 'measure'; setPanelOpen(false); setTimMo(false); setTool(open ? 'measure' : 'none'); setMeasure(open ? 'distance' : 'off'); setMResult(null); })}
            {chip('ve', 'Vẽ', false, () => { setTimMo(false); tatDo(); setPanelOpen(false); if (tool === 'chugiai') setTool('none'); if (laMayTinh()) setDrawOpen(true); else { setPanelOpen(false); setTcTab('goc'); setTool('search'); } })}
            {chip('chugiai', 'Chú giải', tool === 'chugiai', () => { napChuGiai(); setPanelOpen(false); setTimMo(false); if (measure !== 'off') { setMeasure('off'); setMResult(null); } setTool(tool === 'chugiai' ? 'none' : 'chugiai'); })}
            {user && chip('luu', `Đã lưu${places.length ? ` (${places.length})` : ''}`, panelOpen && bangMuc === 'luu', () => { setTimMo(false); tatDo(); if (tool === 'chugiai') setTool('none'); setBangMuc('luu'); setPanelOpen((v) => !(v && bangMuc === 'luu')); })}
            {/* Chip "Nhãn" đã bỏ (chủ dự án 6/10/2026): nhãn & đường mặc định luôn bật; điện thoại vẫn tắt/bật được ở thanh cũ. */}
          </div>
          {timMo && (
            <div className={`absolute top-[96px] left-1/2 z-40 hidden w-[600px] max-w-[calc(100%-120px)] -translate-x-1/2 p-3 lg:block ${KINH_MO}`}>
              <div className="flex items-center gap-2">
                <div className="grid flex-1 grid-cols-4 gap-0.5 rounded-lg bg-slate-100 p-0.5 text-[12px] font-bold">
                  {([['parcel', 'Số thửa · tờ'], ['vn2000', 'Toạ độ VN-2000'], ['latlng', 'Toạ độ WGS-84'], ['gmap', 'Link Google Maps']] as const).map(([k, t]) => (
                    <button key={k} type="button" onClick={() => { setC1(''); setC2(''); setSearchMode(k as any); }}
                      className={`whitespace-nowrap rounded-md px-2.5 py-1.5 ${searchMode === k ? 'bg-white text-[#0A2540] shadow-sm' : 'text-slate-500 hover:text-[#0A2540]'}`}>{t}</button>
                  ))}
                </div>
                <button type="button" onClick={() => setTimMo(false)} aria-label="Đóng" className="ml-auto grid h-7 w-7 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700">✕</button>
              </div>
              {/* Lưới 3 cột đều, kín khung (hàng 1: cấp · huyện · xã; hàng 2: thửa · tờ · Tra cứu) — bản đầu xếp hàng dồn trái, hở nhiều (chủ dự án 6/10/2026) */}
              <div className="mt-2.5 [&>div]:grid [&>div]:grid-cols-3 [&>div]:gap-2 [&>div>*]:!w-full [&>div>*]:min-w-0 [&>div>*]:!py-2 [&>div>*]:!text-[13px]">{searchCtrl(false, true)}</div>
              <p className="mt-1.5 text-[11px] leading-snug text-slate-400">Phím tắt: <b className="font-semibold text-slate-500">Enter</b> tra cứu · <b className="font-semibold text-slate-500">Tab</b> sang ô sau · <b className="font-semibold text-slate-500">↑↓</b> chọn xã · <b className="font-semibold text-slate-500">Esc</b> đóng · gõ gộp <b className="font-semibold text-slate-500">95/15</b> = thửa 95 tờ 15 · phím <b className="font-semibold text-slate-500">/</b> mở ô tìm</p>
            </div>
          )}
          {/* Đang đo mà mở khung Lớp / Đã lưu: thước đo VẪN chạy (đổi lớp xem cùng khoảng đất), chỉ GIẤU khung Đo
              cho khỏi chồng hai khung lên nhau (chủ dự án 6/10/2026); đóng khung Lớp là khung Đo hiện lại. */}
          {tool === 'measure' && !panelOpen && (
            <div className={KHUNG_NOI}>
              {dauKhung('Đo khoảng cách · diện tích', () => { setMeasure('off'); setMResult(null); setTool('none'); })}
              {/* Mẫu kính mờ: nút chọn 2 phần · kết quả số to · Đo lại / Xong (bản điện thoại vẫn dùng measureCtrl cũ) */}
              <div className="grid grid-cols-2 gap-[3px] rounded-lg bg-[#0A2540]/[.07] p-[3px]">
                {([['distance', 'Khoảng cách', <path key="d" d="M4 17l13-13 3 3L7 20H4v-3zM13 8l2 2M10 11l2 2" />], ['area', 'Diện tích', <path key="a" d="M4 7l6-3 10 5-3 11-11-2z" />]] as [MeasureMode, string, any][]).map(([m, ten, ico]) => (
                  <button key={m} type="button" onClick={() => { setMeasure(m); setMResult(null); }}
                    className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-[13px] font-semibold transition ${measure === m ? 'bg-white text-[#0A2540] shadow-[0_1px_3px_rgba(10,37,64,.18)]' : 'text-slate-500 hover:text-[#0A2540]'}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>{ico}</svg>{ten}
                  </button>
                ))}
              </div>
              <div className="mt-3.5 flex items-baseline gap-2.5">
                <span className="text-2xl font-extrabold tabular-nums text-[#0A2540]">{mResult && mResult.points > 0 ? (mResult.mode === 'distance' ? fmtLen(mResult.distance) : fmtArea(mResult.area)) : '—'}</span>
                <span className="text-xs tabular-nums text-slate-500">{mResult && mResult.points > 0 ? `${mResult.points} điểm đã chấm` : 'chưa chấm điểm nào'}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{measure === 'area' ? 'Bấm lần lượt các góc trên bản đồ — tự khép kín để tính diện tích.' : 'Bấm lần lượt các điểm trên bản đồ để đo độ dài.'}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => { const m = measure === 'off' ? 'distance' : measure; setMeasure('off'); setMResult(null); setTimeout(() => setMeasure(m), 0); }}
                  className="h-8 flex-1 rounded-md border border-slate-300 bg-white/70 text-[13px] font-semibold text-[#0A2540] hover:bg-white">Đo lại</button>
                <button type="button" onClick={() => { setMeasure('off'); setMResult(null); setTool('none'); }}
                  className="h-8 flex-1 rounded-md bg-[#0A2540] text-[13px] font-semibold text-white hover:bg-[#13365c]">Xong</button>
              </div>
            </div>
          )}
          {tool === 'chugiai' && (
            <div className={KHUNG_NOI}>
              {dauKhung('Chú giải loại đất', () => setTool('none'))}
              {chuGiaiNoiDung()}
            </div>
          )}

          {/* ── BẢNG ĐÁY "TRA CỨU" — CHỈ ĐIỆN THOẠI, học theo app tham chiếu (14/9/2026) ───────────
              4 thẻ: Góc ranh (bảng toạ độ VN-2000 → vẽ thửa) · Tờ thửa · Toạ độ · Google Maps.
              Nằm sát trên thanh menu đáy, cuộn được, bản đồ vẫn thấy phía trên. Trước đây là khối
              xổ xuống dưới thanh nút trên cùng, đẩy bản đồ và che mất phần đầu. */}
          {tool === 'search' && (
            <div style={kieuBangDay} className="lg:hidden absolute inset-x-0 bottom-[var(--menu-de,calc(56px+env(safe-area-inset-bottom)))] z-30 max-h-[62%] flex flex-col rounded-t-2xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,.18)]">
              <div className="flex items-center border-b border-slate-200 pl-2 pr-1">
                {([['goc', 'Góc ranh'], ['to', 'Thửa tờ'], ['toado', 'Toạ độ'], ['gmap', 'Google Maps']] as [typeof tcTab, string][]).map(([k, lb]) => (
                  // ĐỔI THẺ LÀ XOÁ Ô NHẬP: 3 thẻ Thửa tờ · Toạ độ · Google Maps dùng CHUNG hai ô c1/c2, không xoá thì
                  // số thửa/tờ vừa gõ DÍNH sang ô toạ độ và ô link (chủ dự án báo lỗi 14/9/2026).
                  <button key={k} onClick={() => { if (k !== tcTab) { setC1(''); setC2(''); } setTcTab(k); if (k === 'to') setSearchMode('parcel'); else if (k === 'gmap') setSearchMode('gmap'); else if (k === 'toado' && searchMode !== 'latlng') setSearchMode('vn2000'); }}
                    // flex-1: 4 thẻ CHIA ĐỀU bề ngang (trước dồn trái, bên phải hở — chủ dự án báo 14/9/2026)
                    className={`relative flex-1 whitespace-nowrap px-1 py-2.5 text-center text-[13px] ${tcTab === k ? 'font-semibold text-[#0A2540]' : 'text-slate-500'}`}>
                    {lb}{tcTab === k && <span className="absolute inset-x-2 bottom-0 h-[2.5px] rounded-full bg-[#C8A14B]" />}
                  </button>
                ))}
                <button onClick={() => setTool('none')} aria-label="Đóng" className="grid h-9 w-8 shrink-0 place-items-center text-xl text-slate-400">✕</button>
              </div>
              <div className="overflow-y-auto overscroll-contain px-3 py-3">
                {tcTab === 'goc' && (
                  <div>
                    {/* THẺ GÓC RANH = TRỌN TÍNH NĂNG "VẼ THỬA TỪ TOẠ ĐỘ" của web, đặt ngay trong bảng đáy
                        (chủ dự án 14/9/2026: góc ranh của app chính là tính năng này). Không mở khung riêng:
                        chụp / chọn ảnh → đọc số (có thanh tiến độ) → đổ vào bảng; dán hàng loạt; bảng X/Y;
                        "Vẽ & zoom tới thửa". Máy tính vẫn dùng khung "Vẽ ranh thửa" như cũ. */}
                    {/* BA THẺ CON, không bật cửa sổ nào (chủ dự án 14/9/2026):
                          · Nhập toạ độ  — bảng X/Y từng dòng
                          · Chụp / Ảnh    — mở camera toàn màn hình hoặc chọn ảnh/tệp; đọc xong TỰ về thẻ bảng
                          · Nhập hàng loạt — ô dán; bấm "Tách số vào bảng" là TỰ về thẻ bảng
                        Nút "Vẽ & zoom tới thửa" DÍNH ở đáy, thẻ nào cũng bấm được (một tên duy nhất, trước
                        đây ngoài ghi "Kiểm tra" trong ghi "Vẽ & zoom" mà cùng một việc). */}
                    <div className="grid grid-cols-3 rounded-lg bg-slate-100 p-0.5 text-[12.5px]">
                      {([['bang', 'Nhập toạ độ'], ['anh', 'Chụp / Ảnh'], ['dan', 'Nhập hàng loạt']] as [typeof gocTab, string][]).map(([k, lb]) => (
                        <button key={k} onClick={() => setGocTab(k)} className={`whitespace-nowrap rounded-md py-1.5 ${gocTab === k ? 'bg-white font-semibold text-[#0A2540] shadow-sm' : 'text-slate-500'}`}>{lb}</button>
                      ))}
                    </div>
                    {ocrBusy && (
                      <div className="mt-2">
                        <div className="mb-1 flex justify-between text-[12px] font-medium text-[#0A2540]"><span>{ocrBusy}</span><span>{ocrPct}%</span></div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-[#C8A14B] transition-all duration-200" style={{ width: ocrPct + '%' }} /></div>
                      </div>
                    )}
                    {gocTab === 'anh' && (
                      <div className="mt-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={startCam} className="cl-press flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-[#0A2540] py-4 text-[13px] font-semibold text-[#0A2540]"><span className="text-xl">📷</span>Chụp bằng camera</button>
                          <label className="cl-press flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 py-4 text-[13px] font-semibold text-slate-600">
                            <input type="file" accept="image/*,.txt,.csv" onChange={onCoordFile} className="hidden" /><span className="text-xl">🖼️</span>Chọn ảnh / tệp
                          </label>
                        </div>
                        <p className="mt-2 text-[12px] leading-snug text-slate-400">Chụp gần, thẳng, đủ sáng, chỉ lấy phần bảng số (hoặc tệp .txt/.csv). Đọc xong số tự vào thẻ "Nhập toạ độ" để kiểm tra.</p>
                      </div>
                    )}
                    {gocTab === 'dan' && (
                      <div className="mt-2.5">
                        <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={5}
                          placeholder={'Dán từ Excel/Word/Zalo, mỗi dòng 1 điểm:\n1  1335000.50  567890.12\n2  1335010.20  567900.35'}
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-2 font-mono text-[16px] leading-snug outline-none focus:border-[#0A2540]" />
                        <button onClick={applyPaste} className="cl-press mt-1.5 w-full rounded-lg bg-[#0A2540] py-2.5 text-[13.5px] font-semibold text-white">Tách số vào bảng</button>
                      </div>
                    )}
                    {gocTab === 'bang' && ocrOk > 0 && (
                      <p className="mt-2 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[12px] font-medium text-emerald-700">✅ Đã nhận {ocrOk} điểm{ocrEngine && ocrEngine !== 'paste' ? ' (đọc ảnh đang thử nghiệm)' : ''} — kiểm tra lại số trước khi vẽ.</p>
                    )}
                    {gocTab === 'bang' && (<>
                    <div className="mt-2 grid grid-cols-[18px_1fr_1fr_24px] gap-x-2 text-[12px] text-slate-500"><span>#</span><span>Toạ độ X (Bắc)</span><span>Toạ độ Y (Đông)</span><span /></div>
                    <div className="mt-1 space-y-0.5">
                      {rows.map((r, i2) => (
                        <div key={i2} className="grid grid-cols-[18px_1fr_1fr_24px] items-center gap-x-2">
                          <span className="text-[12px] text-slate-400">{i2 + 1}</span>
                          <input value={r.x} onChange={(e) => setRows((rs) => rs.map((v, j2) => (j2 === i2 ? { ...v, x: e.target.value } : v)))} inputMode="decimal" placeholder="1334050.00"
                            className="w-full min-w-0 border-0 border-b border-slate-200 bg-transparent px-0.5 py-1.5 text-[16px] outline-none focus:border-[#0A2540]" />
                          <input value={r.y} onChange={(e) => setRows((rs) => rs.map((v, j2) => (j2 === i2 ? { ...v, y: e.target.value } : v)))} inputMode="decimal" placeholder="596100.00"
                            className="w-full min-w-0 border-0 border-b border-slate-200 bg-transparent px-0.5 py-1.5 text-[16px] outline-none focus:border-[#0A2540]" />
                          <button onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j2) => j2 !== i2) : [{ x: '', y: '' }]))} aria-label="Xoá dòng" className="text-lg text-slate-300">✕</button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-1.5 flex items-center gap-4 text-[12.5px]">
                      <button onClick={() => setRows([{ x: '596100.0', y: '1334050.0' }, { x: '596150.0', y: '1334035.0' }, { x: '596138.0', y: '1333985.0' }, { x: '596088.0', y: '1334000.0' }])} className="text-slate-400 underline">Điền ví dụ</button>
                      <button onClick={() => { setRows([{ x: '', y: '' }, { x: '', y: '' }, { x: '', y: '' }]); setOcrOk(0); }} className="text-slate-400 underline">Xoá bảng</button>
                    </div>
                    </>)}
                    <div className="sticky -bottom-3 -mx-3 mt-2.5 grid grid-cols-[1.35fr_1fr] gap-2 border-t border-slate-100 bg-white px-3 pb-3 pt-2">
                      <button onClick={() => { const du = pointsFromRows().length >= 3; drawParcel(); if (du) setTool('none'); }} className="cl-press rounded-xl bg-[#0A2540] py-2.5 text-[14px] font-semibold text-white">Vẽ & zoom tới thửa ({pointsFromRows().length})</button>
                      <button onClick={() => { setGocTab('bang'); setRows((rs) => [...rs, { x: '', y: '' }]); }} className="cl-press rounded-xl bg-slate-100 py-2.5 text-[14px] font-semibold text-[#0A2540]">+ Thêm toạ độ</button>
                    </div>
                  </div>
                )}
                {/* THẺ TỜ THỬA — trình bày KIỂU APP: mỗi ô một dòng, nhãn bên trái, ô bên phải; số tờ / số thửa
                    bật BÀN PHÍM SỐ. Thứ tự vẫn giữ quy tắc cũ: chọn địa giới trước (cấp → huyện → xã) rồi mới
                    tới số tờ, số thửa. Ruột (c1 = số tờ, c2 = số thửa, doSearch) dùng chung với máy tính. */}
                {tcTab === 'to' && (
                  <div className="space-y-1.5">
                    {([
                      ['Hệ thống hành chính', (
                        <OChonBang nhan="Chọn" tieuDe="Chọn hệ thống hành chính" giaTri={cap}
                          dsMuc={[{ id: '3', ten: '3 cấp (huyện – xã)' }, { id: '2', ten: '2 cấp (xã mới)' }]}
                          khiChon={(v) => { if (v === cap) return; setCap(v as any); setC3(''); setHuyenChon(''); donKetQuaCu(); }} />
                      )],
                      [cap === '3' ? 'Huyện / TP cũ' : 'Khu vực', (
                        <OChonBang nhan={cap === '3' ? 'Chọn huyện/TP cũ' : 'Chọn khu vực'} tieuDe={cap === '3' ? 'Chọn huyện / thành phố cũ' : 'Chọn khu vực'} giaTri={huyenChon}
                          dsMuc={dsHuyen.map(([h, n]) => ({ id: h, ten: h, phu: `${n} xã/phường` }))}
                          khiChon={(h) => { setHuyenChon(h); setC3(''); donKetQuaCu(); }} />
                      )],
                      ['Xã / phường', (
                        <OChonBang nhan="Chọn xã/phường" tieuDe={huyenChon ? `Chọn xã / phường · ${huyenChon}` : 'Chọn xã / phường'} giaTri={c3}
                          dsMuc={xaTheoHuyen.map((x) => ({ id: x.xaId, ten: x.ten, phu: x.soThua ? `${x.huyen} · ${x.soThua.toLocaleString('vi-VN')} thửa` : x.huyen }))}
                          khiChon={(ma) => { donKetQuaCu(); setC3(ma); const x = dsXaCap.find((y) => y.xaId === ma) || null; if (x) { setHuyenChon(x.huyen); bayToiXa(x); } }} />
                      )],
                      // THỬA TRƯỚC, TỜ SAU (quy tắc chung toàn web): ô số thửa đứng trên, ô số tờ dưới.
                      // Ô SỐ = NÚT GIẢ Ô NHẬP + BÀN PHÍM SỐ RIÊNG trong bảng (chủ dự án 15/9/2026: bấm ô thửa/tờ thì
                      // "màn hình rất rung", nền phía sau trượt). Bàn phím iPhone bật lên là Safari tự cuộn trang cho
                      // ô khỏi bị che, trang lại bị ghim đứng yên → hai bên giằng co → rung. Không gọi bàn phím hệ thống
                      // thì Safari không có gì để cuộn: bảng đứng im, nền đứng im.
                      ['Số thửa', oSoGia('thua', c2, 'Nhập số thửa')],
                      [nhanOSoTo, oSoGia('to', c1, 'Nhập số tờ')],
                    ] as [string, React.ReactNode][]).map(([nhan, o]) => (
                      <div key={nhan} className="grid grid-cols-[40%_1fr] items-center gap-2">
                        <span className="text-[13.5px] text-slate-600">{nhan}</span>{o}
                      </div>
                    ))}
                    {oSo ? (
                      <div className="grid grid-cols-4 gap-1.5 pt-1">
                        {['1', '2', '3', '⌫', '4', '5', '6', '0', '7', '8', '9', 'OK'].map((k) => (
                          <button key={k} type="button"
                            onClick={() => {
                              const doi = oSo === 'thua' ? setC2 : setC1;
                              if (k === '⌫') doi((v) => v.slice(0, -1));
                              else if (k === 'OK') { if (oSo === 'thua') setOSo('to'); else { setOSo(null); doSearch(); setTool('none'); } }
                              else doi((v) => (v.length >= 6 ? v : v + k));
                            }}
                            className={`cl-press h-[38px] rounded-lg text-[17px] ${k === 'OK' ? 'bg-[#0A2540] text-[14px] font-semibold text-white' : k === '⌫' ? 'bg-slate-200 text-[#0A2540]' : 'bg-slate-100 font-medium text-[#0A2540]'}`}>
                            {k === 'OK' ? (oSo === 'thua' ? 'Tiếp' : 'Tra cứu') : k}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button onClick={() => { (document.activeElement as HTMLElement | null)?.blur(); doSearch(); setTool('none'); }}
                        className="cl-press mt-1 w-full rounded-xl bg-[#0A2540] py-2.5 text-[14px] font-semibold text-white">Tra cứu</button>
                    )}
                  </div>
                )}
                {tcTab === 'toado' && (
                  <div>
                    <div className="mb-2 inline-flex rounded-lg bg-slate-100 p-0.5 text-[13px]">
                      {([['vn2000', 'VN-2000 (X, Y)'], ['latlng', 'Kinh / vĩ độ']] as const).map(([k, lb]) => (
                        <button key={k} onClick={() => { if (k !== searchMode) { setC1(''); setC2(''); } setSearchMode(k); }} className={`rounded-md px-3 py-1.5 ${searchMode === k ? 'bg-white font-semibold text-[#0A2540] shadow-sm' : 'text-slate-500'}`}>{lb}</button>
                      ))}
                    </div>
                    {searchCtrl(true, true)}
                  </div>
                )}
                {tcTab === 'gmap' && (
                  <div>
                    <p className="mb-2 text-[13px] text-slate-500">Dán đường link vị trí copy từ Google Maps.</p>
                    {searchCtrl(true, true)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── BẢNG ĐÁY "ĐO" (thước đo) — CHỈ ĐIỆN THOẠI ─────────────────────────────────────────────
              Người dùng CHẠM THẲNG lên bản đồ để chọn từng điểm (lướt bản đồ không bị tính là chạm —
              xem MapView). Từng có dấu ngắm giữa bản đồ + nút "Chọn điểm" kiểu app, chủ dự án bỏ
              (14/9/2026): "người dùng tự lướt và chọn điểm trên bản đồ chứ cần gì chọn điểm". */}
          {tool === 'measure' && measure !== 'off' && (
            <div style={kieuBangDay} className="lg:hidden absolute inset-x-0 bottom-[var(--menu-de,calc(56px+env(safe-area-inset-bottom)))] z-30 rounded-t-2xl bg-white px-3.5 pb-3 pt-2.5 shadow-[0_-8px_30px_rgba(0,0,0,.18)]">
              <div className="flex items-center gap-2">
                <p className="text-[14px] font-semibold text-slate-700">Hướng dẫn</p>
                <div className="ml-2 inline-flex rounded-lg bg-slate-100 p-0.5 text-[12.5px]">
                  {([['distance', 'Đo dài'], ['area', 'Diện tích']] as const).map(([k, lb]) => (
                    <button key={k} onClick={() => { setMeasure(k); setMResult(null); }} className={`rounded-md px-2.5 py-1 ${measure === k ? 'bg-white font-semibold text-[#0A2540] shadow-sm' : 'text-slate-500'}`}>{lb}</button>
                  ))}
                </div>
                <button onClick={() => { setMeasure('off'); setMResult(null); setTool('none'); }} aria-label="Đóng" className="ml-auto grid h-8 w-8 place-items-center text-xl text-slate-400">✕</button>
              </div>
              <p className="mt-1.5 text-[13px] leading-snug text-slate-500">
                Chạm lần lượt các điểm cần đo trên bản đồ. Lướt bản đồ để di chuyển, không bị tính là chọn điểm.
              </p>
              {mResult && mResult.points > 0 && (
                <p className="mt-1.5 text-[13px] font-bold text-orange-700">
                  {mResult.points} điểm · {mResult.mode === 'distance' ? `Dài: ${fmtLen(mResult.distance)}` : mResult.points >= 3 ? `Diện tích: ${fmtArea(mResult.area)}` : 'cần ít nhất 3 điểm'}
                </p>
              )}
              {/* Không có nút "Xong": trùng việc với dấu ✕ ở góc (chủ dự án 14/9/2026). Vẽ thửa từ toạ độ
                  đã nằm ở Tra cứu → Góc ranh nên bảng này CHỈ ĐO. */}
              <button onClick={() => { const m = measure; setMeasure('off'); setMResult(null); requestAnimationFrame(() => setMeasure(m)); }} className="cl-press mt-2.5 w-full rounded-xl bg-slate-100 py-2.5 text-[14px] font-semibold text-[#0A2540]">Đo lại</button>
            </div>
          )}

          {/* ── CỘT NÚT BÊN PHẢI — điện thoại (14/9/2026) + MÁY TÍNH (30/9/2026, cho gọn thanh trên) ─────────
              Nút TRÒN chọn nền bản đồ, ngay dưới là thanh ĐỘ MỜ dọc (khi bật lớp quy hoạch).
              Bấm nút nền → bảng nhỏ bật sang TRÁI: Đường · Vệ tinh · Địa hình + "Nhãn & đường".
              Hàng nút quy hoạch nổi trên bản đồ (QH chung 205 / Phân khu / SDĐ) ĐÃ BỎ: app chọn bản đồ
              qua bảng đáy "Chọn bản đồ quy hoạch" (nút "Lớp Q.Hoạch" trên thanh), bản đồ thoáng hơn.
              Lúc mở bảng nền phải nổi trên bong bóng "Có nhà đất cần bán" của ChatWidget (fixed z-[55]). */}
          {/* Sửa lần 2 cùng ngày, chủ dự án chụp app gửi lại "chưa giống":
                · Nút nền = ẢNH THU NHỎ THẬT (một ô ảnh Google vùng Cam Lâm) của nền SẼ CHUYỂN SANG — đang
                  xem vệ tinh thì nút là ảnh bản đồ đường, và ngược lại (như Google Maps). BẤM LÀ ĐỔI NGAY,
                  không bật bảng chọn. Nền "Địa hình" + "Nhãn & đường" vẫn có ở máy tính.
                · Thanh độ mờ = một VẠCH DỌC MẢNH màu xanh + núm tròn trắng, không khung, không chữ. */}
          {/* Vị trí ĐO THẬT trên khổ 375px: cụm nút bản đồ (+/− cao 60px ở top 10, nút định vị 31px ở top 80)
              rộng 31px, cách mép phải 10px, cách nhau 10px → cột này bắt đầu ở 111 + 10 = 121px, cùng bề
              rộng 31px, nối liền ngay dưới. Trước đặt top 42% nên bị hở một khúc (chủ dự án báo 14/9/2026). */}
          {/* Neo vào ĐÁY CỘT NÚT maplibre (biến --cot-nut-day trong globals.css) chứ KHÔNG để số cứng.
              Số cứng 121px cũ đo hồi nút maplibre còn 31px; trên điện thoại nút to 42px nên cột cao
              hơn 40px, nút định vị tụt xuống đè lên nút đổi nền — chủ dự án thấy "ô vuông trắng lạ". */}
          <div ref={cotNutRef} style={cotNutTop != null ? { top: cotNutTop } : undefined} className="absolute right-[10px] top-[var(--cot-nut-day)] z-10 flex w-[31px] flex-col items-center gap-2.5">
            <button onClick={() => setBaseMap(baseMap === 'satellite' ? 'street' : 'satellite')}
              aria-label={baseMap === 'satellite' ? 'Chuyển sang bản đồ đường' : 'Chuyển sang ảnh vệ tinh'}
              className="cl-press h-[31px] w-[31px] overflow-hidden rounded-full border-2 border-white bg-slate-200 bg-cover bg-center shadow-[0_1px_5px_rgba(0,0,0,.35)]"
              style={{ backgroundImage: `url(https://mt0.google.com/vt/lyrs=${baseMap === 'satellite' ? 'm' : 's'}&x=3289&y=1910&z=12)` }} />
            {/* Thanh ĐỘ MỜ dọc — hiện khi bật BẤT KỲ lớp quy hoạch nào. Kéo LÊN = đậm, XUỐNG = mờ.
                Màu ĐỎ như bản cũ (chủ dự án 14/9/2026). Phần DƯỚI núm (mức đậm đang chọn) đỏ, phần TRÊN
                núm xám — kéo xuống thấy ngay phần trên đổi màu. Vì thanh xoay -90° nên "to right" của
                dải màu chính là từ dưới lên. Nền màu vẽ lên chính ô trượt, rãnh để trong suốt. */}
            {(qhFillOn || rasterOverlays.some((o) => !!ovOn[o.id])) && (
              <div className="relative h-[123px] w-7">{/* 160px → 2/3 (107px) → +15% (123px), chủ dự án chỉnh 14/9/2026 */}
                {/* tài khoản thường + lớp Cam Lâm: thanh bị khoá — lớp phủ trong suốt bắt cú chạm → hộp trả phí. KHÔNG vẽ ổ khoá / làm mờ thanh
                    (chủ dự án 15/10/2026 khoanh ổ khoá: "bỏ cái khoá đi") — thanh nhìn như thường, chạm vào mới biết. */}
                {khoaDoMo && <button type="button" aria-label="Chỉnh độ mờ là tính năng trả phí" onClick={() => setTraPhiQh('Chỉnh độ mờ bản đồ quy hoạch')}
                  className="absolute inset-0 z-10" />}
                <input type="range" min={0} max={100} value={Math.round(doMoHien * 100)} disabled={khoaDoMo} onChange={(e) => setOpacity(Number(e.target.value) / 100)} aria-label="Độ đậm lớp quy hoạch"
                  style={{ background: `linear-gradient(to right, #dc2626 ${Math.round(doMoHien * 100)}%, rgba(255,255,255,.85) ${Math.round(doMoHien * 100)}%)` }}
                  className="absolute left-1/2 top-1/2 h-1 w-[123px] -translate-x-1/2 -translate-y-1/2 -rotate-90 cursor-pointer appearance-none rounded-full shadow-[0_0_2px_rgba(0,0,0,.5)]
                    [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-transparent
                    [&::-webkit-slider-thumb]:-mt-[8px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#dc2626] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md
                    [&::-moz-range-track]:h-1 [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#dc2626] [&::-moz-range-thumb]:bg-white" />
              </div>
            )}
          </div>
          {/* Tên bản quy hoạch đang bật ở góc trái dưới + dòng "tham khảo" góc phải — như app.
              Ẩn khi đang mở bảng đáy Tra cứu / Thước đo (bị che, lại rối mắt). */}
          {tool !== 'search' && !(tool === 'measure' && measure !== 'off') && (
            <div className="lg:hidden pointer-events-none absolute inset-x-2 bottom-[calc(var(--menu-de,56px)+4px)] z-10 flex items-end justify-between gap-2 text-[11px] text-white [text-shadow:0_0_3px_#000,0_0_2px_#000]">
              <span className="truncate font-medium">{(() => { const m = mucQh.find((o) => o.gom.every((id) => !!ovOn[id])); if (!m) return ''; const tv = VUNG_QH.find((v) => v.id === m.vung)?.tenNgan || ''; return `${tv} · ${m.tenApp}`; })()}</span>
              <span className="shrink-0 text-right text-[10px] leading-tight opacity-90">Thông tin chỉ mang<br />tính tham khảo</span>
            </div>
          )}
          {/* ── BẢNG ĐÁY "CHỌN BẢN ĐỒ QUY HOẠCH" — CHỈ ĐIỆN THOẠI, kiểu iPhone (Action Sheet) ─────────
              Thẻ trên CUỘN ĐƯỢC (tối đa ~62% chiều cao màn hình, cuộn không kéo theo bản đồ):
                · Bản đồ quy hoạch: mỗi bản một dòng chữ xanh căn giữa, bản đang bật có ✓; chọn xong tự đóng,
                  bấm lại bản đang bật là TẮT.
                · LỚP DỮ LIỆU (chủ dự án yêu cầu 14/9/2026 đưa vào đây, khỏi mở bảng trượt): mỗi lớp một
                  dòng + CÔNG TẮC kiểu iPhone; bật/tắt KHÔNG đóng bảng để chỉnh nhiều lớp một lượt.
              Tiêu đề từng phần DÍNH trên đầu khi cuộn (sticky + nền mờ) như danh sách iOS.
              Thẻ "Đóng" tách riêng bên dưới. z-[58]: nằm trên bong bóng ChatWidget (z-[55]) + menu đáy. */}
          {qhSheet && (() => {
            const congTac = (bat: boolean, doi: () => void, nhan: string) => (
              <button type="button" role="switch" aria-checked={bat} aria-label={nhan} onClick={doi}
                className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ${bat ? 'bg-[#0A2540]' : 'bg-slate-200'}`}>
                <span className={`absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,.15),0_1px_1px_rgba(0,0,0,.16)] transition-transform duration-200 ${bat ? 'translate-x-[20px]' : ''}`} />
              </button>
            );
            const tieuDe = (chu: string) => (
              <p className="sticky top-0 z-10 bg-[#f2f2f7]/90 backdrop-blur px-4 pt-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-[#6d6d72]">{chu}</p>
            );
            return (
              <div className="lg:hidden fixed inset-0 z-[58] flex flex-col justify-end bg-black/35 px-2.5 pb-[calc(var(--menu-cao,calc(56px+env(safe-area-inset-bottom)))+10px)] animate-[fadeIn_.15s_ease-out]" onClick={() => setQhSheet(false)}>
                <div className="max-h-[62dvh] overflow-y-auto overscroll-contain rounded-lg bg-white/95 backdrop-blur-xl shadow-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onClick={(e) => e.stopPropagation()}>
                  <p className="sticky top-0 z-20 bg-white/90 backdrop-blur px-4 py-2.5 text-center text-[12px] text-[#8a8a8e] border-b border-black/10">Chọn bản đồ quy hoạch</p>
                  {/* Chọn ĐỊA GIỚI để lọc danh sách quy hoạch (chủ dự án 14/10/2026) */}
                  <div className="flex items-center gap-2 border-b border-black/10 px-4 py-2.5">
                    <span className="shrink-0 text-[12px] font-medium text-[#6d6d72]">Địa giới</span>
                    <select value={vungQh} onChange={(e) => doiVung(e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-[14px] font-semibold text-[#0A2540]">
                      {VUNG_QH.map((v) => (<option key={v.id} value={v.id}>{v.ten}</option>))}
                    </select>
                  </div>
                  {mucHienThi.length === 0 && (<p className="px-4 py-3 text-center text-[13px] text-[#8a8a8e]">Chưa có bản quy hoạch cho địa giới này.</p>)}
                  {mucHienThi.map((o) => {
                    const bat = !o.khoa && o.gom.every((id) => !!ovOn[id]);
                    const tenVung = VUNG_QH.find((v) => v.id === o.vung)?.tenNgan || '';
                    return (
                      <button key={o.id} onClick={() => { bamMucQh(o, !bat); setQhSheet(false); }}
                        className={`relative block w-full truncate whitespace-nowrap border-b border-black/10 px-8 py-[11px] text-center text-[14px] text-[#0A2540] active:bg-black/5 ${bat ? 'font-medium' : ''}`}>
                        {bat && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] font-bold text-[#C8A14B]">✓</span>}{tenVung} · {o.tenApp}{(o.khoa || o.xemThu) && <span className="ml-1 text-[12px]" aria-label={o.xemThu ? 'xem ở mức nhìn xa' : 'liên hệ admin'}>🔒</span>}
                      </button>
                    );
                  })}
                  {tieuDe('Lớp dữ liệu')}
                  <div className="bg-[#f2f2f7] px-3 pb-3">
                    <div className="overflow-hidden rounded bg-white">
                      {ranhXa && (
                        <div className="flex min-h-[42px] items-center gap-3 border-b border-black/10 px-3 py-1.5 last:border-b-0">
                          <span className="h-3 w-3 shrink-0 rounded-sm bg-[#C8A14B]" />
                          <span className="min-w-0 flex-1 truncate text-[14px] text-black">Ranh giới xã</span>
                          {congTac(ranhOn, () => setRanhOn(!ranhOn), 'Ranh giới xã')}
                        </div>
                      )}
                      {layers.length === 0 && !ranhXa && (
                        <p className="px-3 py-3 text-[14px] text-[#8a8a8e]">Đang tải các lớp…</p>
                      )}
                      {layersHienThi.map((l) => {
                        const bat = visible[l.slug] ?? false;
                        return (
                          <div key={l.slug} className="flex min-h-[42px] items-center gap-3 border-b border-black/10 px-3 py-1.5 last:border-b-0">
                            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: (l.style?.color as string) || DEFAULT_COLORS[l.layerType] }} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14px] text-black">{l.name}</span>
                              {l.featureCount ? <span className="block text-[11px] text-[#8a8a8e]">{l.featureCount} đối tượng</span> : null}
                            </span>
                            {congTac(bat, () => setVisible((v) => ({ ...v, [l.slug]: !bat })), l.name)}
                          </div>
                        );
                      })}
                    </div>
                    {user && (
                      <button onClick={() => { setQhSheet(false); setPanelOpen(true); }}
                        className="mt-3 flex w-full items-center justify-between rounded bg-white px-3 py-3 text-[14px] text-black active:bg-black/5">
                        <span>📌 Sản phẩm đã lưu ({places.length})</span><span className="text-[#c7c7cc] text-xl leading-none">›</span>
                      </button>
                    )}
                  </div>
                </div>
                <button onClick={() => setQhSheet(false)} className="mt-2 w-full rounded-lg bg-white py-[11px] text-[14px] font-semibold text-[#0A2540] shadow-2xl active:bg-[#e5e5ea]">Đóng</button>
              </div>
            );
          })()}
          {traPhiQh && <HopTraPhi ten={traPhiQh} onDong={() => setTraPhiQh(null)} />}
          {/* ── HỘP "LIÊN HỆ ADMIN" (15/10/2026): bấm dòng quy hoạch có khoá (lớp chỉ quản trị viên, vd QH chi tiết 1/500) ── */}
          {hopKhoa && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4 animate-[fadeIn_.15s_ease-out]" onClick={() => setHopKhoa(null)}>
              {/* 15/10/2026 chủ dự án: "liên hệ admin chứ đừng có nói là tài khoản nào được xem" → KHÔNG nhắc ai được xem / quyền gì,
                  chỉ mời liên hệ admin. */}
              <div role="dialog" aria-modal="true" aria-label="Liên hệ admin" className="w-full max-w-[340px] rounded-lg bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <p className="text-[15px] font-bold text-[#0A2540]">🔒 {hopKhoa}</p>
                {coGoi ? (
                  <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">Chưa tải được lớp này. Tải lại trang hoặc đăng nhập lại rồi thử lần nữa.</p>
                ) : (
                  <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">Vui lòng liên hệ admin Cam Lâm Land để được xem.</p>
                )}
                {!coGoi && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <a href="tel:0567442996" className="rounded bg-[#0A2540] py-2 text-center text-[13px] font-semibold text-white">📞 0567 442 996</a>
                    <a href="https://zalo.me/0582594956" target="_blank" rel="noreferrer" className="rounded border border-[#0068FF] py-2 text-center text-[13px] font-semibold text-[#0068FF]">Zalo admin</a>
                    <button type="button" onClick={() => { setHopKhoa(null); try { window.dispatchEvent(new CustomEvent('cl-open-chat', { detail: { tab: 'support' } })); } catch { /* bỏ qua */ } }}
                      className="col-span-2 rounded border border-slate-300 py-2 text-[13px] font-semibold text-[#0A2540]">💬 Nhắn tin cho admin</button>
                    <div className="col-span-2 hidden items-center gap-3 rounded border border-slate-200 p-2 sm:flex">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/zalo-admin-qr.png" alt="Mã QR kết bạn Zalo admin" width={88} height={88} className="h-[88px] w-[88px]" />
                      <p className="text-[12px] leading-snug text-slate-500">Quét mã bằng điện thoại để <b className="text-[#0A2540]">kết bạn Zalo admin</b>.</p>
                    </div>
                  </div>
                )}
                <button type="button" onClick={() => setHopKhoa(null)} className="mt-2 w-full rounded py-2 text-[13px] font-semibold text-slate-500 active:bg-slate-100">Đóng</button>
              </div>
            </div>
          )}
          {/* ── DANH SÁCH THỬA TÌM ĐƯỢC ── hiện khi có nhiều thửa cùng số tờ/số thửa.
              Rất hay gặp khi tra theo XÃ MỚI, vì một xã mới gộp nhiều xã cũ mà mỗi xã cũ
              lại có bộ số tờ/số thửa riêng — trùng số là chuyện bình thường. ── */}
          {ketQuaTim.length > 1 && (
            <div className="absolute top-2 left-2 lg:top-[96px] lg:left-auto lg:right-14 z-20 w-64 max-w-[calc(100%-1rem)] bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-[#0A2540] text-white">
                <span className="text-xs font-bold">Tìm thấy {ketQuaTim.length} thửa trùng số</span>
                <button onClick={() => setKetQuaTim([])} aria-label="Đóng" className="text-white/70 hover:text-white text-base leading-none">✕</button>
              </div>
              <div className="max-h-56 overflow-y-auto scroll-soft">
                {ketQuaTim.map((t) => (
                  <button key={t.id} onClick={() => moThuaTim(t)}
                    className="w-full text-left px-3 py-2 hover:bg-amber-50 border-b last:border-b-0 border-slate-100">
                    <span className="block text-xs font-bold text-[#0A2540]">Thửa {t.soThua} · Tờ {t.soTo}
                      {t.dienTich != null && <span className="font-normal text-slate-500"> · {fmtM2(t.dienTich)}</span>}
                    </span>
                    <span className="block text-[10px] text-slate-400 truncate">
                      {t.tenXaCu ? `${t.tenXaCu}${t.huyenCu ? ' · ' + t.huyenCu : ''}` : t.tenXa}
                    </span>
                  </button>
                ))}
              </div>
              <p className="px-3 py-1.5 text-[10px] text-slate-400 bg-slate-50">Bấm để xem từng thửa</p>
            </div>
          )}
          {khoaGan && xemThuDangBat && (
            // lớp xem thử đang bật nhưng đã phóng gần quá mức xem thử → lớp ẩn; nhãn này nói rõ lý do, bấm vào là hộp trả phí
            <button type="button" onClick={() => setTraPhiQh(`Xem ${xemThuDangBat.ten}`)}
              className="absolute top-11 lg:top-[136px] left-1/2 -translate-x-1/2 z-10 max-w-[92vw] truncate bg-amber-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow">
              🔒 {xemThuDangBat.ten}: tính năng trả phí</button>
          )}
          {zoomNow > 0 && zoomNow < PARCEL_SHOW_ZOOM && (
            // Hàng nút quy hoạch nổi trên bản đồ đã bỏ (14/9/2026) nên về lại top-2 như máy tính.
            <div className="pointer-events-none absolute top-2 lg:top-[96px] left-1/2 -translate-x-1/2 z-10 whitespace-nowrap bg-[#0A2540]/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow">🔍 Phóng to để hiện thửa đất</div>
          )}
          {/* ── NÚT DẤU HỎI: CĂN CỨ PHÁP LÝ ────────────────────────────────────────────
              Để RIÊNG một nút tròn nổi trên bản đồ (kiểu app VN-2000), KHÔNG gộp vào bảng
              "Lớp Q.Hoạch". Lý do: bảng lớp là chỗ BẬT/TẮT bản đồ, còn đây là chỗ TRA CỨU
              xem màu đang nhìn dựa vào quyết định nào — hai việc khác nhau, gộp vào thì
              bảng lớp dài ra mà người muốn xem căn cứ lại phải mở bảng lớp mới thấy. */}
          <button
            onClick={() => setCanCuOpen((v) => !v)}
            title="Căn cứ pháp lý của bản quy hoạch đang xem"
            aria-label="Căn cứ pháp lý"
            // Nhẹ tay: KHÔNG viền, bóng đổ mềm, dấu hỏi mảnh — bản đầu để viền xám + chữ đậm 19px
            // nhìn "to và thô" hơn hẳn app tham chiếu (chủ dự án chê 17/9/2026).
            // Nút GIỮ NGUYÊN MỘT KIỂU dù bảng đang mở hay đóng (chủ dự án 17/9/2026: "dấu ? đừng đổi màu").
            // Trước đây mở bảng thì nút đảo thành nền xanh chữ trắng — nhấp nháy, rối mắt.
            className="absolute right-2 top-2 z-30 grid h-8 w-8 place-items-center rounded-full bg-white text-[15px] font-semibold leading-none text-[#0A2540] shadow-[0_1px_2px_rgba(0,0,0,.10),0_3px_10px_rgba(10,37,64,.14)] transition hover:bg-slate-50 active:scale-95 max-[1023px]:h-[34px] max-[1023px]:w-[34px] max-[1023px]:text-base">
            ?
          </button>
          {canCuOpen && (() => {
            // Đang bật bản quy hoạch nào thì hiện căn cứ của bản đó; chưa bật gì thì hiện đủ.
            const dangBat = Object.keys(canCuQh).filter((id) => !!ovOn[id]);
            const ds = dangBat.length ? dangBat : Object.keys(canCuQh);
            return (
              <div className="absolute right-2 top-[46px] z-30 w-[380px] max-w-[calc(100%-1rem)] max-h-[70%] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-white/95 px-3.5 py-2.5 backdrop-blur">
                  <span className="text-[14px] font-bold text-[#0A2540]">Căn cứ pháp lý</span>
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">{ds.length}</span>
                  <button onClick={() => setCanCuOpen(false)} aria-label="Đóng" className="ml-auto text-lg leading-none text-slate-400 hover:text-slate-700">✕</button>
                </div>
                <p className="px-3.5 pt-2 text-[11.5px] leading-snug text-slate-500">
                  {dangBat.length ? 'Bản quy hoạch đang hiện trên bản đồ được duyệt theo quyết định dưới đây.'
                    : 'Bấm vào từng dòng để mở bản gốc (PDF) của quyết định phê duyệt.'}
                </p>
                <div className="space-y-1.5 p-3">
                  {ds.map((id) => { const c = canCuQh[id]; if (!c) return null;
                    // Nhiều văn bản cho một lớp (1/500: 9 thông báo) → thẻ liệt kê, mỗi dòng mở một bản gốc.
                    if (c.cac?.length) return (
                      <div key={id} className="rounded-xl border border-slate-200 px-2.5 py-2">
                        <span className="block text-[12.5px] font-bold text-[#0A2540]">📄 {c.loai || 'Quyết định'} {c.so} — {c.ngay}</span>
                        <span className="block text-[11.5px] leading-snug text-slate-500">{c.coQuan}</span>
                        <span className="mt-0.5 block text-[11.5px] leading-snug text-slate-600">{c.ten}</span>
                        <div className="mt-1.5 divide-y divide-slate-100 border-t border-slate-100">
                          {c.cac.map((v) => (
                            <a key={v.so} href={v.tep} target="_blank" rel="noreferrer" className="flex items-baseline gap-2 py-1 text-[11.5px] leading-snug hover:bg-slate-50">
                              <b className="shrink-0 text-[#0A2540]">{v.so}</b><span className="text-slate-600">{v.ten} · {v.ngay}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    );
                    return (
                    <a key={id} href={c.tep} target="_blank" rel="noreferrer"
                      className="block rounded-xl border border-slate-200 px-2.5 py-2 transition hover:border-[#0A2540] hover:bg-slate-50">
                      <span className="block text-[12.5px] font-bold text-[#0A2540]">{c.so ? `📄 ${c.loai || 'Quyết định'} ${c.so} — ${c.ngay}` : '📄 Bản đồ quy hoạch (Sở công bố)'}</span>
                      <span className="block text-[11.5px] leading-snug text-slate-500">{c.coQuan}</span>
                      <span className="mt-0.5 block text-[11.5px] leading-snug text-slate-600">{c.ten}</span>
                    </a>
                  ); })}
                </div>
                <p className="border-t px-3.5 py-2 text-[10.5px] leading-snug text-slate-400">
                  Thông tin chỉ mang tính tham khảo, khi làm hồ sơ phải đối chiếu bản gốc.
                </p>
              </div>
            );
          })()}
          {/* BẢNG ĐẦY ĐỦ khi bấm gim tin lưu — như giỏ hàng */}
          {selPlace && (
            <div className="absolute bottom-[calc(var(--menu-de,calc(56px+env(safe-area-inset-bottom)))+10px)] sm:bottom-3 left-1/2 -translate-x-1/2 w-[360px] max-w-[94%] max-h-[64%] sm:max-h-[72%] overflow-y-auto z-20 bg-white rounded-2xl border-2 border-[#7c3aed]/40 shadow-2xl p-3.5 text-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <b className="text-sm" style={{ color: dealColor(selPlace.dealStatus) }}>📌 Tin lưu</b>
                  {selPlace.dealStatus ? <span className="text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: dealColor(selPlace.dealStatus) }}>{selPlace.dealStatus}</span> : null}
                </div>
                <button onClick={() => setSelPlace(null)} className="text-slate-400 hover:text-slate-700 text-base leading-none">✕</button>
              </div>
              {selPlace.images && selPlace.images.length > 0 && (
                <div className="flex gap-1 mb-2 overflow-x-auto">
                  {selPlace.images.map((u) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={u} src={thumbUrl(u)} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0 border border-slate-200" />
                  ))}
                </div>
              )}
              <p className="font-bold text-[#0A2540] text-sm">{selPlace.features || selPlace.note || (selPlace.parcel ? `Thửa ${selPlace.parcel}` : 'Tin lưu')}</p>
              <div className="mt-1.5 space-y-1 text-slate-600">
                {(selPlace.parcel || selPlace.sheet || selPlace.ward) ? <div>🗺 {[selPlace.parcel && `Thửa ${selPlace.parcel}`, selPlace.sheet && `Tờ ${selPlace.sheet}`, selPlace.ward].filter(Boolean).join(' · ')}</div> : null}
                {(selPlace.price || selPlace.area) ? <div>{selPlace.price ? <>💰 <b className="text-red-600">{selPlace.price}</b></> : null}{selPlace.area ? <span className="text-slate-500"> · {selPlace.area} m²</span> : null}</div> : null}
                {(selPlace.owner || selPlace.phone) ? <div>👤 Chủ: <b>{selPlace.owner || '—'}</b>{selPlace.phone ? <> · <a href={`tel:${selPlace.phone}`} className="text-[#7c3aed] font-bold">{selPlace.phone}</a></> : null}</div> : null}
                {selPlace.commission ? <div>🤝 Hoa hồng: <b>{selPlace.commission}</b></div> : null}
                <div className="text-slate-400">📍 {selPlace.lat.toFixed(5)}, {selPlace.lng.toFixed(5)}</div>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-extrabold text-emerald-600">KHÁCH QUAN TÂM ({interests.length})</span>
                  <button onClick={openAddInt} className="text-[#7c3aed] font-bold">＋ Thêm khách</button>
                </div>
                {interests.map((it) => (
                  <div key={it.id} className="flex items-center gap-1 py-0.5">
                    <span className="flex-1 truncate">🧑 <b>{it.custName || 'Khách'}</b>{it.custPhone ? <> · <a href={`tel:${it.custPhone}`} className="text-emerald-600 font-semibold">{it.custPhone}</a></> : null}</span>
                    {it.interest ? <span className="text-[9px] font-bold px-1 rounded bg-amber-100 text-amber-600">{it.interest}</span> : null}
                    {it.dealStatus ? <span className="text-[9px] font-bold px-1 rounded text-white" style={{ backgroundColor: dealColor(it.dealStatus) }}>{it.dealStatus}</span> : null}
                    <button onClick={() => delIntMap(it.id)} className="text-red-400 hover:text-red-600">✕</button>
                  </div>
                ))}
                {interests.length === 0 && !showAddInt ? <p className="text-slate-400 text-[11px]">Chưa có khách quan tâm — bấm ＋ Thêm khách.</p> : null}
                {showAddInt && (
                  <div className="mt-1 bg-slate-50 rounded-lg p-2 space-y-1">
                    <select value={iCustId} onChange={(e) => setICustId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white outline-none">
                      <option value="">— Khách mới —</option>
                      {custList.map((c) => <option key={c.id} value={c.id}>{c.name || 'Khách'}{c.phone ? ' · ' + c.phone : ''}</option>)}
                    </select>
                    {!iCustId && (
                      <div className="flex gap-1">
                        <input value={iName} onChange={(e) => setIName(e.target.value)} placeholder="Tên khách" className="w-1/2 border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none" />
                        <input value={iPhone} onChange={(e) => setIPhone(e.target.value)} placeholder="SĐT khách" inputMode="tel" className="w-1/2 border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none" />
                      </div>
                    )}
                    <div className="flex gap-1">
                      <select value={iInterest} onChange={(e) => setIInterest(e.target.value)} className="w-1/2 border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white outline-none"><option value="">Mức QT…</option><option>Cao</option><option>Vừa</option><option>Thấp</option></select>
                      <select value={iDeal} onChange={(e) => setIDeal(e.target.value)} className="w-1/2 border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white outline-none"><option value="">Trạng thái…</option><option>Mới</option><option>Đang tư vấn</option><option>Thương lượng</option><option>Đã chốt</option><option>Không thành</option></select>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={saveInterest} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 rounded">Lưu khách</button>
                      <button onClick={() => setShowAddInt(false)} className="px-3 bg-white border border-slate-200 rounded">Huỷ</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-1.5 mt-2.5">
                <button onClick={() => publishPlace(selPlace)} className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-bold py-1.5 rounded-lg">＋ Đăng tin này</button>
                <button onClick={() => moChiDuong(selPlace.lat, selPlace.lng, selPlace.note || 'Sản phẩm đã lưu')} className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 rounded-lg">🧭 Chỉ đường</button>
                <button onClick={async () => { const id = selPlace.id; setSelPlace(null); await removePlace(id).catch(() => { }); loadPlaces(); }} className="bg-white border border-red-200 text-red-600 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-50">🗑</button>
              </div>
            </div>
          )}
          {/* ==== BẢNG CHỈ ĐƯỜNG: nhiều phương án, bấm chọn 1 tuyến (giống Google Maps) ==== */}
          {dirDen && (
            <div className="pointer-events-none absolute z-20 left-2 right-2 bottom-[70px] sm:bottom-auto sm:top-3 lg:top-[96px] sm:left-3 sm:right-auto sm:w-[380px]">
              <ChiDuongPanel
                diemDi={dirDi} diemDen={dirDen}
                onDoiDiemDi={setDirDi} onDoiDiemDen={setDirDen}
                onChonTrenBanDo={(v) => setDirNhat(v)}
                onTuyen={setDirTuyen}
                onFit={(b) => setFitTo(b)}
                onDong={() => { setDirDen(null); setDirTuyen([]); setDirNhat(null); }}
                chonNgoai={dirChon}
                tamBanDo={viewRef.current ? { lng: (viewRef.current.west + viewRef.current.east) / 2, lat: (viewRef.current.south + viewRef.current.north) / 2 } : null}
              />
            </div>
          )}
          {dirNhat && (
            <div className="absolute top-3 lg:top-[96px] left-1/2 z-30 -translate-x-1/2 rounded-full bg-[#0A2540] px-4 py-2 text-sm font-bold text-white shadow-lg">
              Bấm lên bản đồ để chọn {dirNhat === 'di' ? 'điểm đi' : 'điểm đến'}
              <button onClick={() => setDirNhat(null)} className="ml-3 text-white/70 hover:text-white">✕</button>
            </div>
          )}
          {focusPoint && (
            <div className="absolute bottom-[calc(var(--menu-de,calc(56px+env(safe-area-inset-bottom)))+10px)] sm:bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-white rounded-full shadow-lg border border-slate-200 pl-4 pr-2 py-1.5 max-w-[92%]">
              <span className="text-sm font-semibold text-[#0A2540] truncate max-w-[42vw]">📍 {focusPoint.label || 'Vị trí tìm kiếm'}</span>
              <button onClick={() => moChiDuong(focusPoint.lat, focusPoint.lng, focusPoint.label || 'Vị trí tìm kiếm')} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-full px-3.5 py-1.5 whitespace-nowrap">🧭 Chỉ đường</button>
              <button onClick={() => setFocusPoint(null)} className="text-slate-400 hover:text-slate-700 w-7 h-7 grid place-items-center shrink-0">✕</button>
            </div>
          )}
          {drawResult && (
            <div className="absolute top-3 lg:top-[96px] left-3 z-10 bg-white rounded-xl shadow-xl border border-slate-200 p-3 text-sm max-w-[250px]">
              <div className="flex justify-between items-center mb-1">
                <b className="text-[#0A2540]">📐 Thửa đất đã vẽ</b>
                <button onClick={() => { luotThuaRef.current++; setDangKiemVe(false); setDrawResult(null); setHighlight(null); if (info?.parcel?.giaDinh) setInfo(null); }} className="text-slate-400 hover:text-slate-700">✕</button>
              </div>
              <p className="text-slate-600">Số điểm: <b>{drawResult.n}</b></p>
              <p className="text-slate-600">Diện tích: <b className="text-emerald-700">{fmtArea(drawResult.area)}</b></p>
              <p className="text-slate-600">Chu vi: <b>{fmtLen(drawResult.perim)}</b></p>
              {/* Kiểm tra quy hoạch cho thửa vừa vẽ (15/10/2026) — tự chạy ngay khi vẽ; đóng bảng rồi muốn xem lại thì bấm nút này. */}
              {dangKiemVe ? (
                <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1.5 text-center text-[12.5px] font-medium text-slate-600">⏳ Đang kiểm tra quy hoạch…</p>
              ) : drawResult.hinh && !info?.parcel?.giaDinh && (
                <button onClick={() => kiemQhThuaVe(drawResult.hinh!)} className="mt-2 w-full rounded-lg bg-[#0A2540] py-2 text-sm font-bold text-white hover:bg-[#0d3a6b]">📋 Kiểm tra quy hoạch</button>
              )}
              <button onClick={() => moChiDuong(drawResult.lat, drawResult.lng, 'Thửa đã vẽ')} className="mt-2 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg py-2">🧭 Chỉ đường tới thửa</button>
            </div>
          )}
          {drawOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/50" onClick={() => setDrawOpen(false)} />
              <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto scroll-soft">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
                  <h3 className="font-extrabold text-[#0A2540] text-lg">Vẽ ranh thửa từ toạ độ VN-2000</h3>
                  <button onClick={() => setDrawOpen(false)} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
                </div>
                <div className="flex border-b border-slate-100 px-3">
                  {([['table', '⌗ Nhập bảng'], ['import', '📷 Chụp / Ảnh']] as [typeof drawTab, string][]).map(([k, lb]) => (
                    <button key={k} onClick={() => { setDrawTab(k); setOcrOk(0); }} className={`px-3 py-2.5 text-sm font-semibold border-b-2 ${drawTab === k ? 'border-red-600 text-[#0A2540]' : 'border-transparent text-slate-500'}`}>{lb}</button>
                  ))}
                </div>
                <div className="p-5 space-y-3">
                  {drawTab === 'table' && (
                    <div className="space-y-2">
                      <div className="rounded-lg border border-[#C8A14B]/40 bg-[#C8A14B]/[0.06] p-2.5">
                        <p className="text-xs font-bold text-[#0A2540] mb-1.5">📋 Dán nhanh toạ độ (chính xác 100%, không cần chụp)</p>
                        <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={3} placeholder={'Dán từ Excel/Word/Zalo, mỗi dòng 1 điểm:\n1  1335000.50  567890.12\n2  1335010.20  567900.35'} className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-mono outline-none focus:border-[#0A2540]" />
                        <button onClick={applyPaste} className="mt-1.5 w-full bg-[#0A2540] hover:bg-[#0d2f54] text-white font-bold py-2 rounded-lg text-sm">Tách số vào bảng ↓</button>
                      </div>
                      {ocrOk > 0 && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-lg px-3 py-2">✅ Đã nhận {ocrOk} điểm{ocrEngine ? ' · nguồn: ' + engineLabel(ocrEngine) : ''}{ocrEngine && ocrEngine !== 'paste' ? ' đang trong giai đoạn thử nghiệm' : ''}. Vui lòng kiểm tra lại số rồi bấm “Vẽ & zoom tới thửa”.</div>}
                      <div className="grid grid-cols-[26px_1fr_1fr_26px] gap-2 text-xs font-semibold text-slate-500 px-1"><span>#</span><span>X (Bắc)</span><span>Y (Đông)</span><span /></div>
                      <div className="space-y-1.5 max-h-52 overflow-y-auto scroll-soft pr-1">
                        {rows.map((r, i2) => (
                          <div key={i2} className="grid grid-cols-[26px_1fr_1fr_26px] gap-2 items-center">
                            <span className="text-xs text-slate-400 text-center">{i2 + 1}</span>
                            {/* min-w-0 + w-full: ô nhập trình duyệt có bề rộng tối thiểu ~150px, không đặt thì
                                trên điện thoại hai ô tràn khỏi khung, ô Y bị cắt mất (chủ dự án chụp màn hình 14/9/2026). */}
                            <input value={r.x} onChange={(e) => setRows((rs) => rs.map((v, j2) => (j2 === i2 ? { ...v, x: e.target.value } : v)))} inputMode="decimal" className="w-full min-w-0 border border-slate-300 rounded-lg px-2 py-1.5 text-[16px] sm:text-sm" placeholder="596100.0" />
                            <input value={r.y} onChange={(e) => setRows((rs) => rs.map((v, j2) => (j2 === i2 ? { ...v, y: e.target.value } : v)))} inputMode="decimal" className="w-full min-w-0 border border-slate-300 rounded-lg px-2 py-1.5 text-[16px] sm:text-sm" placeholder="1334050.0" />
                            <button onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j2) => j2 !== i2) : rs))} className="text-slate-300 hover:text-red-600 text-center">✕</button>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setRows((rs) => [...rs, { x: '', y: '' }])} className="text-sm font-semibold text-[#0A2540]">+ Thêm điểm</button>
                        <button onClick={() => setRows([{ x: '596100.0', y: '1334050.0' }, { x: '596150.0', y: '1334035.0' }, { x: '596138.0', y: '1333985.0' }, { x: '596088.0', y: '1334000.0' }])} className="text-xs text-slate-400 underline">Điền ví dụ</button>
                      </div>
                    </div>
                  )}
                  {drawTab === 'import' && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={startCam} className="flex flex-col items-center justify-center gap-1 border-2 border-[#0A2540] rounded-xl py-6 text-sm font-bold text-[#0A2540] hover:bg-slate-50"><span className="text-2xl">📷</span>Chụp bằng camera</button>
                        <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-slate-300 rounded-xl py-6 cursor-pointer hover:border-[#C8A14B] text-sm font-bold text-slate-600 text-center">
                          <input type="file" accept="image/*,.txt,.csv" onChange={onCoordFile} className="hidden" /><span className="text-2xl">🖼️</span>Tải ảnh / tệp
                        </label>
                      </div>
                      {ocrBusy && (
                        <div className="pt-1">
                          <div className="flex items-center justify-between text-sm text-[#0A2540] font-semibold mb-1"><span>{ocrBusy}</span><span>{ocrPct}%</span></div>
                          <div className="h-2 rounded-full bg-slate-200 overflow-hidden"><div className="h-full bg-[#0A2540] rounded-full transition-all duration-200 ease-out" style={{ width: ocrPct + '%' }} /></div>
                        </div>
                      )}
                      <p className="text-[11px] text-slate-400">Chụp/chọn ảnh bảng toạ độ rõ nét (hoặc tệp .txt/.csv). Hệ thống tự tách số → đưa vào tab &quot;Nhập bảng&quot; để bạn kiểm tra trước khi vẽ.</p>
                    </div>
                  )}
                </div>
                <div className="px-5 pb-5 pt-1 flex items-center gap-2 sticky bottom-0 bg-white">
                  <button onClick={drawParcel} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl">Vẽ & zoom tới thửa ({pointsFromRows().length} điểm)</button>
                  <button onClick={() => setRows([{ x: '', y: '' }, { x: '', y: '' }, { x: '', y: '' }])} className="px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-slate-600">Xoá</button>
                </div>
              </div>
            </div>
          )}
          {camOpen && (
            <div className="fixed inset-0 z-[70] bg-black h-[100dvh] overflow-hidden">
              <video ref={camVideoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-2 border-emerald-400 rounded-lg" style={{ width: '96%', height: '86%', boxShadow: '0 0 0 100vmax rgba(0,0,0,0.5)' }} />
              </div>
              <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 pb-4 text-white bg-gradient-to-b from-black/70 to-transparent" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
                <span className="font-semibold text-lg drop-shadow">Chụp bảng toạ độ</span>
                <button onClick={stopCam} aria-label="Đóng" className="w-10 h-10 rounded-full bg-white/15 backdrop-blur grid place-items-center text-2xl leading-none">✕</button>
              </div>
              <div className="absolute bottom-0 inset-x-0 px-6 pt-10 text-center bg-gradient-to-t from-black/80 via-black/40 to-transparent" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}>
                <p className="text-white/90 text-sm mb-4 drop-shadow">Đưa bảng toạ độ vừa khít trong khung — chụp thẳng, rõ nét.</p>
                <button onClick={capture} aria-label="Chụp" className="group relative mx-auto block w-[76px] h-[76px] rounded-full active:scale-90 transition-transform duration-150">
                  <span className="absolute inset-0 rounded-full border-[3px] border-white/95 shadow-lg" />
                  <span className="absolute inset-[5px] rounded-full bg-white transition-all duration-150 group-active:inset-[10px] group-active:bg-white/70" />
                </button>
              </div>
              <div className={`absolute inset-0 z-[75] bg-white pointer-events-none transition-opacity ${camFlash ? 'opacity-80 duration-0' : 'opacity-0 duration-300'}`} />
              {ocrBusy && <div className="absolute inset-0 z-[76] bg-black/70 grid place-items-center text-white font-semibold px-6"><div className="w-64 max-w-[80%]"><div className="flex items-center justify-between text-sm mb-2"><span>{ocrBusy}</span><span>{ocrPct}%</span></div><div className="h-2 rounded-full bg-white/25 overflow-hidden"><div className="h-full bg-white rounded-full transition-all duration-200 ease-out" style={{ width: ocrPct + '%' }} /></div></div></div>}
            </div>
          )}
          {info && (
            /* Bảng nằm GIỮA màn hình, sát đáy — chủ dự án muốn vậy cho cân đối.
               Để không che mất thửa vừa bấm thì làm hai việc:
                 · hạ trần chiều cao trên máy tính xuống 56% (trước 72%) → luôn chừa gần nửa bản đồ phía trên;
                 · sau khi bảng hiện ra, hàm tranhBiChe() đo vị trí bảng rồi TRƯỢT bản đồ đúng đoạn
                   ngắn nhất để thửa lọt ra ngoài bảng (không đổi mức phóng, không giật).
               id="bang-thua" chính là để đo vị trí bảng. */
            <div id="bang-thua" className={`absolute left-2 right-2 bottom-[calc(var(--menu-de,calc(56px+env(safe-area-inset-bottom)))+4px)] sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:bottom-3 sm:w-96 sm:max-w-[calc(100%-1.5rem)] ${sheetExpanded ? 'max-h-[80%]' : 'max-h-[50%]'} sm:max-h-[42%] flex flex-col overflow-hidden z-20 bg-white rounded-2xl shadow-2xl border border-slate-200 transition-[max-height] duration-300`}>
              <div {...vuotBang} className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100 rounded-t-2xl">
                {/* Chạm vạch kéo: đang thu nhỏ → mở nấc vừa; còn lại → vừa ⇄ đầy đủ. Vuốt lên/xuống: xem vuotBang. */}
                <button onClick={() => { if (sheetNho) setSheetNho(false); else setSheetExpanded((v) => !v); }} className="sm:hidden w-full flex flex-col items-center pt-1.5 pb-1" aria-label={sheetNho ? 'Mở bảng' : sheetExpanded ? 'Thu gọn' : 'Kéo lên xem đầy đủ'}>
                  <span className="w-9 h-1 rounded-full bg-slate-300" />
                  {/* Điện thoại: bỏ chữ "Kéo lên…" + dòng tiêu đề "Thông tin thửa" cho gọn như app — chừa
                      chỗ cho trang quy hoạch (trước đầu bảng + chân bảng chiếm hết, không thấy ô diện tích). */}
                  <span className="hidden sm:inline text-[10px] font-bold text-slate-400 mt-1">{sheetExpanded ? '▼ Thu gọn' : '▲ Kéo lên xem đầy đủ'}</span>
                </button>
                <div className="flex justify-between items-center px-4 py-0 sm:py-1.5 absolute right-0 top-0 sm:static sm:w-full">
                  <h3 className="hidden sm:block font-extrabold text-[#0A2540] text-[15px]">Thông tin thửa</h3>
                  <button onClick={() => setInfo(null)} className="text-slate-400 hover:text-slate-700 w-7 h-7 grid place-items-center rounded-lg hover:bg-slate-100 text-lg leading-none">✕</button>
                </div>
              </div>
              {/* ĐẦU BẢNG — ĐỨNG YÊN KHI CUỘN.
                  Số tờ · số thửa · diện tích · tên xã là thứ người xem cần thấy SUỐT, kể cả lúc
                  kéo xuống đọc các bản quy hoạch bên dưới. Trước đây cả bảng cùng cuộn nên kéo
                  một cái là mất luôn số tờ/số thửa — đang đối chiếu với sổ đỏ thì phải kéo lên
                  kéo xuống liên tục. */}
              <div {...vuotBang} onClick={() => { if (sheetNho) setSheetNho(false); }} className="shrink-0 px-4 pt-0 pb-1.5 sm:pt-1.5 sm:pb-2 text-sm border-b border-slate-100">
                {info.parcel?.giaDinh ? (
                  /* THỬA KHÁCH TỰ VẼ từ bảng toạ độ (15/10/2026): không có số thửa / số tờ → ghi rõ "Thửa giả định do khách hàng tự vẽ"
                     (chủ dự án dặn), kèm diện tích + khu vực (xã của thửa địa chính ở giữa hình) để người xem khỏi tưởng là thửa thật. */
                  <>
                    <div className="font-bold leading-snug text-[#0A2540] pr-8 sm:pr-0 text-[15px]">
                      Thửa giả định do khách hàng tự vẽ
                      {info.parcel.areaM2 != null && <> · <span className="font-normal text-slate-500">Diện tích</span> <span className="whitespace-nowrap">{fmtM2(info.parcel.areaM2)}</span></>}
                    </div>
                    {info.parcel.xa && (
                      <div className="text-[12px] sm:text-[13px] leading-snug text-slate-500 mt-0.5">
                        <span className="text-slate-400">Khu vực: </span><b className="font-semibold text-slate-700">{info.parcel.xa}</b>
                        {(info.parcel as any).xaCu && (info.parcel as any).xaCu !== info.parcel.xa && (
                          <span className="text-slate-400"> · trước sáp nhập: {(info.parcel as any).xaCu}</span>
                        )}
                      </div>
                    )}
                    <div className="text-[11px] leading-snug text-amber-700 mt-0.5">Vẽ từ toạ độ khách nhập — không phải thửa địa chính.</div>
                  </>
                ) : info.parcel ? (() => {
                  const props = info.parcel.properties || {};
                  const owner = pickProp(props, ['TenChu', 'ten_chu', 'ChuSuDung', 'ChuSDD', 'TenChuSuDung', 'chusdd', 'HoTen', 'ho_ten', 'NguoiSDD', 'TEN_CHU']);
                  // "Khu vực mới" = đơn vị hành chính HIỆN HÀNH (sau sáp nhập 1/7/2025).
                  // "Khu vực cũ"  = tên xã/phường + huyện TRƯỚC sáp nhập, chỉ hiện khi thửa nằm ở xã cũ.
                  // Máy chủ tra bảng sáp nhập rồi trả về sẵn, không suy đoán ở đây.
                  const cuTen = (info.parcel as any).xaCu as string | null;
                  const cuHuyen = (info.parcel as any).huyenCu as string | null;
                  const khuCu = pickProp(props, ['KhuVucCu', 'khu_vuc_cu', 'DiaChiCu', 'TenTT', 'ten_tt'])
                    || (cuTen ? (cuHuyen ? `${cuTen} · ${cuHuyen}` : cuTen) : '');
                  const khuMoi = pickProp(props, ['KhuVucMoi', 'khu_vuc_moi', 'DiaChiMoi']) || info.parcel.xa || '';
                  // Số tờ trong DỮ LIỆU luôn là số tờ CŨ. Số tờ MỚI chỉ có khi xã đó đã có bảng tra.
                  // Số tờ CŨ: ưu tiên con số máy chủ lấy từ bảng tra (đúng theo giấy tờ), vì ở
                  // Ninh Hoà / Vạn Ninh số đang lưu trong dữ liệu chính là số tờ MỚI rồi.
                  const toCu = ((info.parcel as any).soToCu as string | null) || info.parcel.soTo || '';
                  const toMoi = ((info.parcel as any).soToMoi as string | null) || '';
                  // Chỉ nhắc "chưa có bảng tra" ở xã GỘP TỪ NHIỀU XÃ CŨ. Xã chỉ gồm 1 xã cũ thì
                  // số tờ vốn không đổi, nhắc vào chỉ tổ rối.
                  const thieuBangTra = !!(info.parcel as any).canBangTraSoTo;
                  // Đang xem theo lớp 3 CẤP (xã cũ) hay 2 CẤP (xã mới)? Dữ liệu chưa phủ kín nên ở
                  // chế độ 3 cấp thì TÊN XÃ CŨ mới là danh tính chính — phải cho lên trước.
                  const xemXaCu = cap === '3';
                  const soToChinh = xemXaCu ? toCu : (toMoi || toCu);
                  const nhanSoTo = !toMoi ? 'Số tờ' : (xemXaCu ? 'Số tờ cũ' : 'Số tờ mới');   // viết "tờ cũ/tờ mới", KHÔNG "(cũ)/(mới)"
                  // Mã loại đất CỦA LỚP GIS tự tải lên (lớp do admin upload có sẵn mấy trường này).
                  // Thửa địa chính KHÔNG hiện mục đích sử dụng — chủ dự án không muốn in dòng đó ra.
                  const code = pickProp(props, ['KyHieu', 'MaLoaiDat', 'MDSD', 'MDSDD', 'LoaiDat', 'ky_hieu', 'ma_loai_dat']);
                  const name = pickProp(props, ['TenLoaiDat', 'TenMDSD', 'ten_loai_dat', 'MoTa', 'GhiChu']);
                  return (
                    <>
                      {/* Điện thoại: MỘT DÒNG như app — "Tờ 149 · Thửa 83 · 1.255,9 m²". Máy tính giữ 3 ô.
                          CHỌN THỬA TRÊN BẢN ĐỒ LUÔN HIỆN SỐ TỜ MỚI TRƯỚC (chủ dự án 14/9/2026), bất kể đang ở lớp
                          3 cấp hay 2 cấp; số tờ cũ + xã cũ ghi ở dòng dưới. Xã chưa có bảng tra thì chỉ có số tờ đang có. */}
                      <div className={`sm:hidden font-bold leading-snug text-[#0A2540] pr-8 text-[15px]`}>
                        Thửa {info.parcel.soThua || '—'} · Tờ {toMoi || toCu || '—'}
                        {info.parcel.areaM2 != null && <> · <span className="font-normal text-slate-500">Diện tích</span> <span className="whitespace-nowrap">{fmtM2(info.parcel.areaM2)}</span></>}
                      </div>
                      <div className="hidden sm:grid grid-cols-3 gap-2">
                        {/* THỬA TRƯỚC, TỜ SAU — quy tắc chung toàn web. */}
                        <div><div className="text-[11px] text-slate-400">Số thửa</div><div className="font-bold text-[#0A2540]">{info.parcel.soThua || '—'}</div></div>
                        <div><div className="text-[11px] text-slate-400">{nhanSoTo}</div><div className="font-bold text-[#0A2540]">{soToChinh || '—'}</div></div>
                        <div><div className="text-[11px] text-slate-400">Diện tích</div><div className="font-bold text-[#0A2540]">{info.parcel.areaM2 != null ? fmtM2(info.parcel.areaM2) : '—'}</div></div>
                      </div>
                      {/* Điện thoại: xã MỚI trước, rồi "trước sáp nhập: xã cũ · huyện cũ · tờ cũ". KHÔNG CẮT CHỮ (trước
                          để truncate nên mất đuôi "tờ mới …" — chủ dự án báo thiếu thông tin), dài thì xuống dòng. */}
                      {(khuCu || khuMoi) && (
                        <div className="sm:hidden text-[12px] leading-snug text-slate-500">
                          <b className="font-semibold text-slate-700">{khuMoi || khuCu}</b>
                          {/* Giữ ĐỦ thông tin như bảng máy tính: ghi chú xã chưa có bảng tra số tờ (rút gọn). */}
                          {thieuBangTra && <span className="text-slate-400"> · chưa có bảng tra số tờ</span>}
                          {/* "Trước sáp nhập" XUỐNG DÒNG RIÊNG và CỐ NẰM GỌN 1 DÒNG (chủ dự án 14/9/2026): chữ 11px, không
                              xuống dòng, "Huyện" viết "H." cho ngắn. Vẫn dài quá thì vuốt ngang được, KHÔNG cắt mất chữ. */}
                          {(khuCu && khuMoi) || (toMoi && toCu && toMoi !== toCu) ? (
                            <div className="overflow-x-auto whitespace-nowrap text-[11px] text-slate-400 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                              Trước sáp nhập: {khuCu && khuMoi ? <span className="text-slate-500">{khuCu.replace(/Huyện /g, 'H. ').replace(/Thành phố /g, 'TP. ').replace(/Thị xã /g, 'TX. ')}</span> : null}
                              {toMoi && toCu && toMoi !== toCu ? <> · tờ cũ <b className="font-semibold text-slate-500">{toCu}</b></> : null}
                            </div>
                          ) : null}
                        </div>
                      )}
                      <div className="hidden sm:block">
                      {/* ── XEM THEO LỚP 3 CẤP: tên xã CŨ lên trước, khu vực mới + số tờ mới ghi ở dưới ── */}
                      {xemXaCu ? (
                        <>
                          {khuCu
                            ? <div className="text-slate-600 mt-1"><b className="text-[#0A2540]">{khuCu}</b></div>
                            : (khuMoi && <div className="text-slate-600 mt-1"><b className="text-[#0A2540]">{khuMoi}</b></div>)}
                          {khuMoi && khuCu && (
                            <div className="text-slate-500 text-[11px] mt-0.5">
                              <span className="text-slate-400">Khu vực mới: </span>{khuMoi}
                              {toMoi && toMoi !== toCu && <> · <span className="text-slate-400">tờ mới </span><b className="text-[#0A2540]">{toMoi}</b></>}
                            </div>
                          )}
                          {thieuBangTra && <div className="hidden sm:block text-slate-400 text-[10px] mt-0.5">Xã mới chưa có bảng tra số tờ</div>}
                        </>
                      ) : (
                        /* ── XEM THEO LỚP 2 CẤP: tên xã MỚI lên trước, tên cũ + số tờ cũ ghi ở dưới ── */
                        <>
                          {khuMoi && <div className="text-slate-600 mt-1"><b className="text-[#0A2540]">{khuMoi}</b></div>}
                          {(khuCu || toMoi) && (
                            <div className="text-slate-500 text-[11px] mt-0.5">
                              <span className="text-slate-400">Trước sáp nhập: </span>{khuCu || '—'}
                              {/* Xã nào sáp nhập mà số tờ GIỮ NGUYÊN (vd Vạn Ninh, Ninh Hoà) thì tờ mới
                                  trùng tờ cũ — ghi lại lần nữa chỉ tổ rối, nên bỏ. */}
                              {toMoi && toCu && toMoi !== toCu && <> · <span className="text-slate-400">tờ cũ </span><b className="text-[#0A2540]">{toCu}</b></>}
                            </div>
                          )}
                          {thieuBangTra && <div className="hidden sm:block text-slate-400 text-[10px] mt-0.5">Xã này chưa có bảng tra số tờ mới — số đang hiện là số tờ cũ</div>}
                        </>
                      )}
                      </div>
                      {/* BỎ nút "Xem thêm" — hiện thẳng luôn phần tên chủ + toạ độ. Bấm vào thửa là
                          muốn xem cho đủ, bắt bấm thêm một nút nữa chỉ tổ vướng. */}
                      {true && (
                        <div className="mt-1">
                          {owner && <div className="text-slate-600 mt-1"><span className="text-slate-400">Tên chủ: </span><b className="text-[#0A2540]">{owner}</b></div>}
                          {(code || name) && (
                            <div className="mt-2.5 flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                              {info.parcel.areaM2 != null && <b className="text-[#0A2540] shrink-0">{fmtM2(info.parcel.areaM2)}</b>}
                              {code && <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded ${landColor(code)}`}>{code}</span>}
                              {name && <span className="text-slate-600 truncate">{name}</span>}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  );
                })() : (
                  /* Điểm bấm rơi vào ĐẤT HẠ TẦNG CÔNG CỘNG (đường, sông suối, thuỷ lợi) — máy chủ
                     cố tình không trả về thửa (xem CHAN_TRA_CUU ở routes/parcels.ts). Nói thẳng
                     đó là gì, đừng báo "không có dữ liệu" vì dữ liệu thì có, chỉ là chưa mở tra cứu. */
                  (info as any).khongTraCuu
                    ? <p className="text-slate-500">Điểm này nằm trong <b className="text-[#0A2540]">{(info as any).khongTraCuu}</b> — tạm thời chưa mở tra cứu thửa.</p>
                    : <p className="text-slate-500">Không có dữ liệu thửa tại điểm này{clickVN ? ` · ${clickVN.lat.toFixed(6)}, ${clickVN.lng.toFixed(6)}` : ''}.</p>
                )}
              </div>
              {/* CHỈ PHẦN QUY HOẠCH NÀY CUỘN. Một thửa hay dính 3–4 bản quy hoạch (QĐ205 + QĐ893
                  + phân khu 1/2000) nên đoạn này dài không đoán trước được. Cho nó cuộn riêng thì
                  bảng không cao thêm, mà đầu bảng và hai hàng nút ở đáy vẫn đứng yên. */}
              <div className={`${sheetNho ? 'max-sm:hidden' : ''} px-4 py-1.5 sm:py-2 text-sm flex-1 min-h-[92px] sm:min-h-0 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]`}>
                {/* TRANG LƯỚT NGANG, mỗi trang một bản quy hoạch (xem trangQhCuaThua) — CẢ ĐIỆN THOẠI LẪN MÁY TÍNH
                    (chủ dự án 14/9/2026: web làm giống mobile, kéo qua để xem, kéo tới đâu bản đồ đổi lớp tới đó).
                    Máy tính không vuốt được nên có thêm: NHẤN GIỮ CHUỘT KÉO NGANG, nút mũi tên ‹ ›, bấm dấu chấm. */}
                {info.parcel && (() => {
                  const ds = trangQhCuaThua();
                  if (!ds.length) return null;
                  const toiTrang = (i: number) => { const el = trangQhRef.current; if (el) el.scrollTo({ left: Math.max(0, Math.min(ds.length - 1, i)) * buocTrang(el), behavior: 'smooth' }); };
                  return (
                    <div className="group/qh relative -mx-4">
                      {ds.length > 1 && (
                        <div className="mb-1 flex items-center justify-center gap-1">
                          {ds.map((t, i) => (
                            <button key={t.muc.id} aria-label={t.tieuDe} title={t.tieuDe}
                              onClick={() => toiTrang(i)}
                              className={`h-1 rounded-full transition-all ${i === trangQh ? 'w-6 bg-[#0A2540]' : 'w-3.5 bg-slate-300 sm:hover:bg-slate-400'}`} />
                          ))}
                        </div>
                      )}
                      {/* GỢI Ý LƯỚT KIỂU C (chủ dự án chọn 15/9/2026), CHỈ trên máy tính — điện thoại vuốt tay nên không cần:
                          • mép bên còn trang thì MỜ DẦN → nhìn là biết nội dung còn chạy tiếp sang bên đó;
                          • mũi tên mảnh ‹ › nhỏ ở góc phải ngang tiêu đề, CHỈ hiện khi rê chuột vào bảng. */}
                      {ds.length > 1 && trangQh > 0 && (
                        <div className="pointer-events-none absolute bottom-0 left-0 top-2 z-10 hidden w-8 bg-gradient-to-r from-white to-transparent sm:block" />
                      )}
                      {ds.length > 1 && trangQh < ds.length - 1 && (
                        <div className="pointer-events-none absolute bottom-0 right-0 top-2 z-10 hidden w-8 bg-gradient-to-l from-white to-transparent sm:block" />
                      )}
                      {ds.length > 1 && (
                        <div className="absolute right-3 top-[7px] z-20 hidden items-center gap-0.5 opacity-0 transition-opacity group-hover/qh:opacity-100 sm:flex">
                          <button type="button" aria-label="Bản quy hoạch trước" disabled={trangQh === 0} onClick={() => toiTrang(trangQh - 1)}
                            className="grid h-5 w-5 place-items-center rounded text-[16px] leading-none text-[#0A2540] hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent">‹</button>
                          <button type="button" aria-label="Bản quy hoạch sau" disabled={trangQh === ds.length - 1} onClick={() => toiTrang(trangQh + 1)}
                            className="grid h-5 w-5 place-items-center rounded text-[16px] leading-none text-[#0A2540] hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent">›</button>
                        </div>
                      )}
                      <div ref={trangQhRef} onScroll={() => { clearTimeout((trangQhRef as any).t); (trangQhRef as any).t = setTimeout(khiLuotTrangQh, 90); }}
                        // KÉO BẰNG CHUỘT (máy tính): tắt tạm "hít trang" trong lúc kéo cho mượt, thả chuột thì trôi về trang gần nhất.
                        onMouseDown={(e) => {
                          const el = trangQhRef.current; if (!el || e.button !== 0 || ds.length < 2) return;
                          const x0 = e.clientX, s0 = el.scrollLeft; let daKeo = false;
                          el.style.scrollSnapType = 'none'; el.style.cursor = 'grabbing';
                          const di = (ev: MouseEvent) => { const dx = ev.clientX - x0; if (Math.abs(dx) > 3) daKeo = true; el.scrollLeft = s0 - dx; };
                          const tha = () => {
                            window.removeEventListener('mousemove', di); window.removeEventListener('mouseup', tha);
                            el.style.cursor = '';
                            const w = buocTrang(el); const i = Math.max(0, Math.min(ds.length - 1, Math.round(el.scrollLeft / w)));
                            el.scrollTo({ left: i * w, behavior: 'smooth' });
                            setTimeout(() => { el.style.scrollSnapType = ''; }, 350);
                            if (daKeo) { const chan = (ce: MouseEvent) => { ce.stopPropagation(); ce.preventDefault(); }; el.addEventListener('click', chan, { capture: true, once: true }); }
                          };
                          window.addEventListener('mousemove', di); window.addEventListener('mouseup', tha);
                        }}
                        className={`flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain select-none sm:cursor-grab [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
                        {ds.map((t) => (
                          <div key={t.muc.id} className={`w-full shrink-0 snap-center ${ds.length > 1 ? 'px-4 sm:pr-14' : 'px-4'}`}>{/* sm:pr-14: chừa góc phải cho mũi tên nhỏ khỏi đè tiêu đề */}
                            {/* Tiêu đề + tên các mảnh phân khu gộp MỘT dòng cho gọn. */}
                            <p className={`truncate font-bold leading-snug text-[#0A2540] text-[13px]`}>{t.tieuDe}{t.khoa && <span className="ml-1 text-[12px]" aria-label="liên hệ admin">🔒</span>}{t.phu && <span className="ml-1.5 text-[10.5px] font-normal text-slate-400">{t.phu}</span>}</p>
                            {t.khoa && (
                              <button type="button" onClick={() => (t.traPhi ? setTraPhiQh(`Thông tin ${t.tieuDe}`) : setHopKhoa(t.tieuDe))}
                                className="mt-1.5 rounded border border-slate-300 px-2.5 py-1 text-[12.5px] font-semibold text-[#0A2540] active:bg-slate-100">
                                {t.traPhi ? 'Đăng ký thành viên để xem' : 'Liên hệ admin để xem'}
                              </button>
                            )}
                            <div className="mt-1 space-y-[3px]">
                              {t.areas.map((a) => {
                                const mau = t.mauRieng?.[a.type] || mauQh?.[t.bangMau]?.[a.type] || '#e2e8f0';
                                return (
                                  <div key={a.type} className="flex min-w-0 items-start gap-2" title={`${fmtM2(a.areaM2)} · ${a.type}`}>
                                    <span className="min-w-[64px] shrink-0 rounded border border-black/10 px-1.5 py-px text-right text-[12px] font-bold leading-[18px] tabular-nums"
                                      style={{ background: mau, color: chuTrenMau(mau) }}>{fmtM2(a.areaM2)}</span>
                                    {/* 15/10/2026: tên dài XUỐNG DÒNG cho đủ chữ — trước cắt "…" ("Đất sử dụng cho hoạt động khoán…"), điện thoại không
                                        rê chuột xem được chữ đầy đủ. Tên ngắn vẫn một dòng; ô diện tích đứng ngang dòng đầu. */}
                                    <span className="min-w-0 break-words py-px text-[12.5px] font-medium leading-[18px] text-slate-700">{a.type}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                {/* Cách liệt kê cũ từng bản một khối (khoiQh) — MÁY TÍNH ĐÃ CHUYỂN SANG TRANG LƯỚT NGANG ở trên
                    (14/9/2026). Giữ lại ẩn phòng khi cần quay về; muốn bỏ hẳn thì xoá khối này + hàm khoiQh. */}
                <div className="hidden">
                {info.parcel && info.overlaps && info.overlaps.length > 0
                  && khoiQh('Quy hoạch chung 2045 · QĐ205', info.overlaps, 'qd205')}

                {/* MỘT THỬA THƯỜNG DÍNH NHIỀU BẢN QUY HOẠCH CHỒNG LÊN NHAU: QĐ205 trùm cả huyện,
                    bên trong còn quy hoạch sử dụng đất QĐ893 và các bản phân khu 1/2000.
                    Không bản nào được phép giấu bản nào — liệt kê RIÊNG từng bản, ghi rõ loại đất
                    và diện tích, để người xem tự đối chiếu. */}
                {/* KHÔNG hiện "chỉ phủ X% thửa" — đó là chữ nghề, người mua đất đọc không hiểu.
                    Con số phần trăm vẫn có trong dữ liệu trả về (phuTramPhanTram) để dò lỗi khi cần. */}
                {info.parcel && (info as any).qhCacBan?.length > 0
                  && (info as any).qhCacBan.map((b: any) => khoiQh(b.ten, b.areas, b.ma))}
                </div>

                {/* Ngoài huyện Cam Lâm cũ thì CHƯA có số liệu quy hoạch tính theo từng thửa. Nói thẳng ra, vì trước đây
                    máy chủ đoán bừa mọi thửa ngoài vùng thành "Đất giao thông" phủ kín cả thửa.
                    (14/10/2026) Bỏ câu "Hiện mới có Quy hoạch chung đô thị mới Cam Lâm đến 2045 (QĐ 205/QĐ-TTg)…" theo yêu cầu
                    chủ dự án (CHỈ bỏ câu này — trang QĐ205 của thửa Cam Lâm vẫn giữ). Ghi "tính theo từng thửa" vì vài huyện/thị đã có
                    ẢNH bản đồ QHSDĐ 2030 (nút Lớp Q.Hoạch), chỉ chưa có số diện tích theo thửa. */}
                {info.parcel && info.qhNgoaiVung && (
                  <div className="mt-2 pt-1.5 border-t border-slate-100">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">Quy hoạch</p>
                    <p className="text-slate-500 leading-relaxed">
                      Khu vực này <b>chưa có dữ liệu quy hoạch</b> tính theo từng thửa.
                    </p>
                  </div>
                )}


                {clickVN && (
                  /* Điện thoại: ẩn dòng VN-2000 cho gọn — chỉ hiện khi đang mở phần Lưu điểm. */
                  <div className={`mt-2 pt-1.5 border-t border-slate-100 ${showSave ? '' : 'hidden sm:block'}`}>
                    <div className="text-[11px] text-slate-400">VN-2000: <b className="text-slate-600">X={clickVN.x.toFixed(2)}</b> · <b className="text-slate-600">Y={clickVN.y.toFixed(2)}</b></div>
                    {user && showSave && (
                      <div className="mt-2 space-y-1">
                        <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Tên / mô tả sản phẩm *" className="w-full text-xs border border-slate-300 rounded px-2 py-1 outline-none focus:border-[#7c3aed]" />
                        <div className="flex gap-1">
                          <input value={pParcel} onChange={(e) => setPParcel(e.target.value)} placeholder="Thửa *" className="w-1/3 text-xs border border-slate-300 rounded px-2 py-1 outline-none focus:border-[#7c3aed]" />
                          <input value={pSheet} onChange={(e) => setPSheet(e.target.value)} placeholder="Tờ *" className="w-1/3 text-xs border border-slate-300 rounded px-2 py-1 outline-none focus:border-[#7c3aed]" />
                          <input value={pWard} onChange={(e) => setPWard(e.target.value)} placeholder="Xã *" className="w-1/3 text-xs border border-slate-300 rounded px-2 py-1 outline-none focus:border-[#7c3aed]" />
                        </div>
                        <input value={pFeat} onChange={(e) => setPFeat(e.target.value)} placeholder="Đặc điểm & lưu ý *" className="w-full text-xs border border-slate-300 rounded px-2 py-1 outline-none focus:border-[#7c3aed]" />
                        <div className="flex gap-1">
                          <input value={pPrice} onChange={(e) => setPPrice(e.target.value)} placeholder="Giá * (vd 2 tỷ)" className="flex-1 min-w-0 text-xs border border-slate-300 rounded px-2 py-1 outline-none focus:border-[#7c3aed]" />
                          <input value={pArea} onChange={(e) => setPArea(e.target.value)} placeholder="DT m² *" className="w-16 text-xs border border-slate-300 rounded px-2 py-1 outline-none focus:border-[#7c3aed]" />
                        </div>
                        <div className="flex gap-1">
                          <input value={pOwner} onChange={(e) => setPOwner(e.target.value)} placeholder="Tên chủ *" className="flex-1 min-w-0 text-xs border border-slate-300 rounded px-2 py-1 outline-none focus:border-[#7c3aed]" />
                          <input value={pPhone} onChange={(e) => setPPhone(e.target.value)} placeholder="SĐT chủ *" inputMode="tel" className="flex-1 min-w-0 text-xs border border-slate-300 rounded px-2 py-1 outline-none focus:border-[#7c3aed]" />
                        </div>
                        <input value={pComm} onChange={(e) => setPComm(e.target.value)} placeholder="Hoa hồng (vd 1%)" className="w-full text-xs border border-slate-300 rounded px-2 py-1 outline-none focus:border-[#7c3aed]" />
                        <div className="flex items-center gap-1 flex-wrap">
                          {pImages.map((u) => (
                            <div key={u} className="relative w-9 h-9 rounded overflow-hidden border border-slate-200">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={u} alt="" className="w-full h-full object-cover" />
                              <button onClick={() => setPImages((p) => p.filter((x) => x !== u))} className="absolute top-0 right-0 bg-black/60 text-white text-[9px] w-3.5 h-3.5 grid place-items-center">✕</button>
                            </div>
                          ))}
                          {pImages.length < 5 && (
                            <label className="w-9 h-9 rounded border border-dashed border-slate-300 grid place-items-center text-slate-400 cursor-pointer hover:border-[#7c3aed]">
                              {pUp ? '…' : '＋'}
                              <input type="file" accept="image/*" multiple onChange={onPlaceFiles} className="hidden" />
                            </label>
                          )}
                          <span className="text-[10px] text-slate-400">Ảnh {pImages.length}/5</span>
                        </div>
                        <button onClick={savePlace} disabled={pUp} className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-60 text-white font-bold py-1.5 rounded text-xs">💾 Lưu sản phẩm này</button>
                      </div>
                    )}
                  </div>
                )}

              </div>
              {/* CHÂN BẢNG CỐ ĐỊNH — nằm NGOÀI vùng cuộn nên đứng yên tuyệt đối khi kéo.
                  Trước ghim bằng "sticky" với khoảng cách đoán sẵn nên vẫn nhúc nhích. */}
              {/* Điện thoại: TẤT CẢ NÚT MỘT HÀNG NGANG gọn như app (Phiếu QH · Lưu · Chia sẻ · Chỉ đường),
                  lướt ngang nếu thiếu chỗ. Máy tính giữ nút phiếu to + hàng 3 nút. */}
              <div className={`${sheetNho ? 'max-sm:hidden' : ''} shrink-0 px-2.5 sm:px-4 pt-1.5 pb-2 bg-white border-t border-slate-100 grid grid-cols-4 gap-1 sm:block`}>
                {/* Phiếu trích lục ghi rõ "Quy hoạch chung đô thị mới Cam Lâm 2045" nên chỉ cho xuất
                    khi thửa nằm trong vùng có dữ liệu — ngoài vùng mà in ra là phiếu sai.
                    (14/10/2026) Thửa chỉ có số liệu BÓC TỪ PDF (huyện/thị ngoài Cam Lâm, nguon:'pdf') cũng KHÔNG in phiếu. */}
                {info.parcel && !info.qhNgoaiVung && ((info.overlaps?.length || 0) > 0 || (((info as any).qhCacBan || []) as any[]).some((b) => b?.nguon !== 'pdf' && b?.nguon !== '1/500')) && (
                  <button
                    onClick={() => {
                      // KHOÁ CAM LÂM (15/10/2026): phiếu in ảnh + số liệu QĐ205 / phân khu → chỉ người có vé; người khác: hộp "liên hệ admin"
                      if (!lopRieng?.ve) { if (coGoi) setHopKhoa('Phiếu kiểm tra quy hoạch'); else setTraPhiQh('Xuất phiếu kiểm tra quy hoạch'); return; }
                      const g = (highlight as any)?.geometry || (info.parcel as any)?.geometry;
                      const mapScen = qhScenario === 'all' ? '2045' : qhScenario;
                      // Ranh WGS84 của thửa (để đo diện tích theo ảnh QĐ205).
                      const ring: number[][] = g?.type === 'Polygon' ? (g.coordinates?.[0] || [])
                        : g?.type === 'MultiPolygon' ? ((g.coordinates || []).reduce((a: number[][], poly: any) => ((poly?.[0]?.length || 0) > (a?.length || 0) ? poly[0] : a), [] as number[][])) : [];
                      // MỞ cửa sổ TRƯỚC (tránh chặn pop-up) → tính diện tích theo ẢNH QH (bất đồng bộ) → ghi phiếu.
                      const win = window.open('', '_blank');
                      if (!win) { alert('Trình duyệt đang chặn cửa sổ. Hãy cho phép pop-up rồi thử lại.'); return; }
                      try { win.document.write('<!doctype html><meta charset="utf-8"><body style="font:14px sans-serif;color:#334155;padding:24px">Đang tạo phiếu kiểm tra quy hoạch…</body>'); } catch { /* */ }
                      const finish = (overlaps: any[], manh?: { lo: string; ring: number[][] }[] | null) => {
                        const hzA: Record<string, number> = {};
                        for (const x of (overlaps || []) as any[]) if (x?.hz) hzA[String(x.hz)] = (hzA[String(x.hz)] || 0) + (Number(x.areaM2) || 0);
                        const pieceHz = Object.keys(hzA).sort((a, b) => hzA[b] - hzA[a])[0] || mapScen;
                        // PHỤ LỤC: mỗi bản quy hoạch KHÁC đè lên thửa một trang trích lục trên ảnh của chính bản đó (lib/phieuQh.ts)
                        const phuLuc = (((info as any).qhCacBan || []) as any[]).filter((bn) => bn?.nguon !== 'pdf' && bn?.nguon !== '1/500').map((bn) => {
                          const ma = String(bn.ma);
                          const id = /^\d+$/.test(ma) ? 'qh-qd' + ma : 'qh-' + ma;
                          // ảnh lấy từ danh sách ĐANG DÙNG (phân khu bị khoá → đường có vé), bỏ phần tên miền vì phiếu tự ghép gốc trang
                          const tile = tuongDoi(((rasterOverlaysRef.current.find((x) => x.id === id) as any)?.tiles || [])[0] as string | undefined);
                          const cc = CAN_CU_QH[id];
                          const bang = ma === '893' ? 'qd893' : 'phankhu';
                          return tile ? {
                            ma, tile, tieuDe: String(bn.ten || ma),
                            canCu: cc ? `Quyết định số ${cc.so} ngày ${cc.ngay} của ${cc.coQuan} về việc ${cc.ten.charAt(0).toLowerCase()}${cc.ten.slice(1)}` : String(bn.ten || ma),
                            areas: ((bn.areas || []) as { type: string; areaM2: number }[]).map((a) => ({ ...a, mau: mauQh?.[bang]?.[a.type] })),
                          } : null;
                        }).filter(Boolean) as any[];
                        const html = phieuQhHtml({ parcel: info.parcel as any, geometry: g, overlaps, qhCacBan: (((info as any).qhCacBan || []) as any[]).filter((bn) => bn?.nguon !== 'pdf' && bn?.nguon !== '1/500'), qhPieces: manh ? manh.map((m) => ({ lo: m.lo, c: mauQh?.qd205?.[m.lo], ring: m.ring })) : qhPiecesFor(g, pieceHz), roadFeats: roadFeatsFor(g), neighbors: (info as any).neighbors || [], point: info.point, user: user as any, scenario: mapScen, roadHz: pieceHz, phuLuc,
                          tile205: tuongDoi(((rasterOverlaysRef.current.find((x) => x.id === 'qh-qd205') as any)?.tiles || [])[0]) });
                        try { win.document.open(); win.document.write(html); win.document.close(); win.focus(); } catch { /* */ }
                      };
                      // chỉ dùng số máy chủ (12/10/2026: bỏ tính bù từ qh_vector cũ — xem chỗ gọi /parcels/at)
                      const areas = info.overlaps || [];
                      // SƠ ĐỒ ô đất lấy HÌNH MỚI từ máy chủ (12/10/2026) — trước vẽ từ file cũ qh_vector.geojson nên có thể khác con số in cạnh bên
                      const idThua = (info.parcel as any)?.id;
                      // thửa khách tự vẽ chưa có mã thửa → gửi thẳng vòng ranh (đúng toạ độ khách nhập, máy chủ không dịch)
                      const hoiManh = idThua ? api<{ manh: { lo: string; ring: number[][] }[] }>(`/parcels/${idThua}/qh-manh`)
                        : info.parcel?.giaDinh && ring.length >= 4 ? api<{ manh: { lo: string; ring: number[][] }[] }>('/parcels/qh-manh-hinh', { method: 'POST', body: JSON.stringify({ ring }) })
                        : null;
                      (hoiManh ? hoiManh.then((r) => r.manh || null).catch(() => null) : Promise.resolve(null)).then((manh) => finish(areas.length ? areas : [], manh));
                    }}
                    id="nut-phieu-qh"
                    className="min-w-0 whitespace-nowrap px-1 sm:px-0 sm:mb-1.5 sm:w-full flex items-center justify-center gap-1.5 sm:gap-2 rounded-full sm:rounded-lg py-1.5 sm:py-2 text-[11px] sm:text-sm font-bold bg-[#0A2540] hover:bg-[#0d3a6b] text-white">
                    🖨<span className="sm:hidden">Phiếu QH</span><span className="hidden sm:inline">Xuất phiếu kiểm tra quy hoạch</span>{!lopRieng?.ve && <span className="text-[10px]" aria-label="liên hệ admin">🔒</span>}
                  </button>
                )}
                <div className="contents sm:grid sm:grid-cols-3 sm:gap-2">
                  {user ? (
                    <button id="nut-luu-diem" onClick={() => setShowSave((v) => { const nv = !v; if (nv) { setSheetExpanded(true); setParcelMore(true); } return nv; })} className={`min-w-0 whitespace-nowrap px-1 sm:px-0 flex items-center justify-center gap-1 rounded-full sm:rounded-lg py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold transition ${showSave ? 'bg-[#7c3aed] text-white' : 'bg-[#7c3aed]/10 text-[#7c3aed] hover:bg-[#7c3aed]/20'}`}>📌<span className="sm:hidden">Lưu</span><span className="hidden sm:inline"> Lưu điểm</span></button>
                  ) : (
                    <Link id="nut-luu-diem" href="/login" className="min-w-0 whitespace-nowrap px-1 sm:px-0 flex items-center justify-center gap-1 rounded-full sm:rounded-lg py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold bg-[#7c3aed]/10 text-[#7c3aed]">🔒<span className="sm:hidden">Lưu</span><span className="hidden sm:inline"> Lưu điểm</span></Link>
                  )}
                  <button id="nut-chia-se" onClick={() => { const t = `${info.parcel?.giaDinh ? 'Thửa giả định do khách hàng tự vẽ' : `Thửa ${info.parcel?.soThua || '?'}, Tờ ${info.parcel?.soTo || '?'}`} —${info.parcel?.xa || 'Cam Lâm'}${info.point ? ` (${info.point.lat.toFixed(6)},${info.point.lng.toFixed(6)})` : ''}`; navigator.clipboard?.writeText(t).then(() => alert('Đã sao chép mã chia sẻ:\n' + t)).catch(() => alert(t)); }} className="min-w-0 whitespace-nowrap px-1 sm:px-0 flex items-center justify-center gap-1 rounded-full sm:rounded-lg py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200">🔗 Chia sẻ</button>
                  {info.point && <button id="nut-chi-duong" onClick={() => moChiDuong(info.point!.lat, info.point!.lng, 'Thửa đang xem')} className="min-w-0 whitespace-nowrap px-1 sm:px-0 flex items-center justify-center gap-1 rounded-full sm:rounded-lg py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200">🧭 Chỉ đường</button>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mb-3"><p className="font-semibold text-slate-700 border-b pb-1 mb-1">{title}</p>{children}</div>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-2 py-0.5"><span className="text-slate-500">{k}</span><span className="text-right font-medium">{v}</span></div>;
}
