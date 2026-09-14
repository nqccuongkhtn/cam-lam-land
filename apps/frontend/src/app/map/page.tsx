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
import { useAuth, laAdmin, coVaiTro } from '@/lib/auth';
import { listMyPlaces, listAllPlaces, addPlace, removePlace, type SavedPlace } from '@/lib/savedPlaces';
import { listCustomers, listInterests, addInterest, removeInterest, type Customer, type Interest } from '@/lib/crm';
import { Skeleton } from '@/components/ui';
import type { Diem } from '@/components/ChiDuongPanel';

// Bỏ dấu tiếng Việt để gõ tìm không cần dấu: gõ "cam lam" vẫn ra "Cam Lâm".
const boDauVn = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

// Ô CHỌN CÓ GÕ TÌM — nhìn như ô sổ xuống bình thường, nhưng bấm vào là gõ tìm được ngay
// (gõ không dấu cũng ra). Dùng cho ô chọn huyện/TP cũ và ô chọn xã/phường.
// Đặt NGOÀI trang chính: nếu để bên trong, mỗi lần trang vẽ lại thì ô này bị dựng lại từ đầu
// và con trỏ đang gõ sẽ nhảy ra ngoài.
function OChonCoGo({ nhan, dsMuc, giaTri, khiChon, className, dienThoai = false }: {
  nhan: string;
  dsMuc: { id: string; ten: string; phu?: string }[];
  giaTri: string;
  khiChon: (id: string) => void;
  className?: string;
  // dienThoai: bảng đáy Tra cứu trên điện thoại — chữ 16px (iPhone tự PHÓNG TO cả trang khi bấm ô chữ
  // nhỏ hơn 16px) và danh sách SỔ LÊN TRÊN (bảng nằm sát bàn phím, sổ xuống là bị bàn phím che mất).
  dienThoai?: boolean;
}) {
  const [go, setGo] = useState('');
  const [daGo, setDaGo] = useState(false);   // đã bắt đầu gõ hay chưa (chưa gõ thì sổ ĐỦ danh sách)
  const [mo, setMo] = useState(false);
  const boc = useRef<HTMLDivElement>(null);
  const dongDangChon = useRef<HTMLButtonElement>(null);

  const dong = () => { setMo(false); setGo(''); setDaGo(false); };
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
  const chon = (id: string) => { khiChon(id); dong(); oNhap.current?.blur(); };

  return (
    <div ref={boc} className={`relative ${className || ''}`}>
      {/* Có CẢ onFocus lẫn onClick: bấm lần đầu thì onFocus lo, còn khi con trỏ đã sẵn trong ô
          (vừa chọn xong) thì trình duyệt không báo "vừa bấm vào ô" nữa nên phải nhờ onClick. */}
      <input
        ref={oNhap}
        value={daGo ? go : dangChon}
        placeholder={nhan}
        onFocus={(e) => { setMo(true); setDaGo(false); e.currentTarget.select(); }}
        onClick={(e) => { setMo(true); setDaGo(false); e.currentTarget.select(); }}
        onChange={(e) => { setGo(e.target.value); setDaGo(true); setMo(true); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && loc.length) { e.preventDefault(); chon(loc[0].id); (e.target as HTMLInputElement).blur(); }
          if (e.key === 'Escape') dong();
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
            {loc.map((m) => (
              <button key={m.id} type="button" ref={m.id === giaTri ? dongDangChon : undefined}
                onMouseDown={(e) => e.preventDefault()} onClick={() => chon(m.id)}
                className={`w-full text-left px-2.5 hover:bg-slate-50 border-b last:border-b-0 border-slate-100 ${dienThoai ? 'py-2' : 'py-1.5'} ${m.id === giaTri ? 'bg-amber-50' : ''}`}>
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
    tiles: ['/tiles/qd205v11/{z}/{x}/{y}.png'], minzoom: 10, maxzoom: 18,
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
    tiles: ['/tiles/qd893v1/{z}/{x}/{y}.png'], minzoom: 8, maxzoom: 18,   // đã cắt bù thêm z8–11 (12/9/2026) để thu nhỏ vẫn thấy
    coordinates: [[108.9335, 12.2239], [109.2624, 12.2239], [109.2624, 11.9328], [108.9335, 11.9328]] as [[number, number], [number, number], [number, number], [number, number]] },
];
// MỤC CHỌN trên bảng "Bản đồ quy hoạch". Ba bản phân khu 1/2000 (QĐ2076 phía Bắc · QĐ2101 trung tâm ·
// QĐ2222 ven biển · QĐ918 phức hợp phía Tây) là BỐN MẢNH CỦA CÙNG MỘT BỘ quy hoạch phân khu —
// nên gộp thành MỘT dòng, bật là bật cả ba. Ảnh của chúng nền trong suốt, vùng lại không trùm
// nhau đáng kể nên chồng lên nhau ra một tấm liền mạch.
// `tenNgan` = chữ trên thanh nút nổi của ĐIỆN THOẠI: màn hẹp ~360px, để tên đầy đủ thì 3 nút
// không vừa, nút đầu và nút cuối bị cắt mất chữ (chủ dự án chụp màn hình báo lỗi 14/9/2026).
// `tenApp` = tên ghi trong BẢNG ĐÁY chọn bản đồ + dòng tên góc trái dưới bản đồ (điện thoại) —
// viết tắt đúng kiểu app tham chiếu cho gọn MỘT DÒNG (chủ dự án chê chữ to, xuống 2 dòng, 14/9/2026).
// `zBay` = mức phóng bay tới khi chọn bản này mà đang nhìn xa hơn (không ghi thì tự tính = minzoom − 1).
const MUC_QH: { id: string; ten: string; tenNgan: string; tenApp: string; gom: string[]; zBay?: number }[] = [
  { id: 'qh-qd205', ten: 'Quy hoạch chung 2045 (QĐ205)', tenNgan: 'QH chung 205', tenApp: 'Quy hoạch chung 2045', gom: ['qh-qd205'], zBay: 10 },   // chủ dự án cho thử z10 (14/9/2026)
  { id: 'phan-khu', ten: 'Quy hoạch phân khu 1/2000', tenNgan: 'Phân khu 1/2000', tenApp: 'QHXD Phân khu', gom:['qh-qd2076', 'qh-qd2101', 'qh-qd2222', 'qh-qd918', 'qh-cuhin', 'qh-taynam', 'qh-taybac'] },
  { id: 'qh-qd893', ten: 'Quy hoạch sử dụng đất 2030 (QĐ893)', tenNgan: 'Sử dụng đất 893', tenApp: 'QH Sử dụng đất 2030', gom: ['qh-qd893'] },
];
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
  parcel: { properties: Record<string, any>; soTo?: string | null; soThua?: string | null; xa?: string | null; areaM2?: number } | null;
  zoning: Record<string, any> | null;
  overlaps?: { layer: string; type: string; hz?: string; areaM2: number }[];
  // true = thửa nằm NGOÀI vùng đã có dữ liệu quy hoạch (hiện mới có huyện Cam Lâm cũ).
  // Phải nói thẳng cho người xem biết là "chưa có dữ liệu", đừng để trống.
  qhNgoaiVung?: boolean;
  listings: { id: number; title: string; price: number }[];
}
const fmtLen = (m: number) => (m >= 1000 ? (m / 1000).toFixed(3) + ' km' : m.toFixed(1) + ' m');
const fmtArea = (m2: number) => (m2 >= 10000 ? (m2 / 10000).toFixed(4) + ' ha (' + m2.toFixed(0) + ' m²)' : m2.toFixed(1) + ' m²');
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
    const tinh = () => {
      if (!dangGo()) caoGoc = Math.max(window.innerHeight, vv.height);   // chưa gõ → ghi lại chiều cao đủ
      const phanBiChe = caoGoc - vv.height;                              // bàn phím (và thanh công cụ của nó) chiếm
      const mo = phanBiChe > 150 && window.innerWidth < 1024 && dangGo();
      document.documentElement.classList.toggle('cl-ban-phim', mo);
      setBanPhim((c) => {
        if (!mo) return c ? null : c;
        // Mép trên bàn phím tính theo toạ độ của vật `fixed`: nếu khung trang đã co theo bàn phím thì chính là
    // đáy khung (innerHeight); nếu không co thì là đáy vùng nhìn thấy (offsetTop + height). Lấy số NHỎ hơn.
    const moi = { dinh: Math.round(Math.min(window.innerHeight, vv.offsetTop + vv.height)), caoNhin: Math.round(vv.height) };
        return c && c.dinh === moi.dinh && c.caoNhin === moi.caoNhin ? c : moi;
      });
    };
    vv.addEventListener('resize', tinh); vv.addEventListener('scroll', tinh);
    document.addEventListener('focusin', tinh); document.addEventListener('focusout', () => setTimeout(tinh, 50));
    return () => {
      vv.removeEventListener('resize', tinh); vv.removeEventListener('scroll', tinh);
      document.removeEventListener('focusin', tinh);
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
      const coMenu = !!nav && getComputedStyle(nav).display !== 'none';
      const dinhMenu = coMenu ? nav!.getBoundingClientRect().top : window.innerHeight;
      const de = Math.max(0, Math.round(k.getBoundingClientRect().bottom - dinhMenu));
      const cao = Math.max(0, Math.round(window.innerHeight - dinhMenu));
      setMenuDo((c) => (c && c.de === de && c.cao === cao ? c : { de, cao }));
    };
    // KHOÁ CUỘN CẢ TRANG khi ở bản đồ (điện thoại): trang gói trong MỘT khung hình như app, vuốt chỉ
    // để kéo bản đồ. Không khoá thì trên iPhone cú vuốt làm trang nhích/nảy → thanh "Cam Lâm Land" và
    // thanh menu đáy tự ẩn (chủ dự án báo 14/9/2026). Rời trang là trả lại như cũ.
    const html = document.documentElement, body = document.body;
    const cu = [html.style.overflow, html.style.overscrollBehavior, body.style.overflow, body.style.overscrollBehavior];
    const cuBody = [body.style.position, body.style.top, body.style.left, body.style.right, body.style.width];
    html.style.overflow = 'hidden'; html.style.overscrollBehavior = 'none';
    body.style.overflow = 'hidden'; body.style.overscrollBehavior = 'none';
    // iPhone (Safari) KHÔNG nghe overflow:hidden khi vuốt — trang dài hơn màn hình dù 1px là vẫn kéo trôi
    // được, thanh "Cam Lâm Land" trượt mất (chủ dự án chụp lần 2, 14/9/2026). GHIM THÂN TRANG
    // (position:fixed) là cách chắc ăn duy nhất. Chỉ áp ở màn < 1024px; máy tính không cần.
    if (window.innerWidth < 1024) {
      body.style.position = 'fixed'; body.style.top = '0'; body.style.left = '0'; body.style.right = '0'; body.style.width = '100%';
    }
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
      [body.style.position, body.style.top, body.style.left, body.style.right, body.style.width] = cuBody;
      html.classList.remove('cl-ban-do');
    };
  }, []);
  const [qhSheet, setQhSheet] = useState(false);   // điện thoại: bảng đáy "Chọn bản đồ quy hoạch" đang mở
  const [tcTab, setTcTab] = useState<'goc' | 'to' | 'toado' | 'gmap'>('to'); // thẻ đang mở của bảng đáy Tra cứu
  const [gocTab, setGocTab] = useState<'bang' | 'anh' | 'dan'>('bang'); // 3 thẻ con của Góc ranh
  const [canDelete, setCanDelete] = useState(false);
  // BẢNG CHÚ GIẢI của bản đồ quy hoạch phân khu. Từ 12/9/2026 bốn bản phân khu được tô màu
  // theo LOẠI ĐẤT (xem ghi chú ở RASTER_OVERLAYS) nên phải có chú giải, không thì người xem
  // chỉ thấy một rừng màu mà không biết màu nào là gì.
  // File `/chu-giai-qh.json` do scripts/qh-pipeline/8-tao-chu-giai.py sinh ra, chỉ liệt kê
  // những loại đất THẬT SỰ có trên bản đồ. Nạp LÚC BẤM MỞ chứ không nạp sẵn — ai không xem
  // chú giải thì không phải tải thêm gì.
  const [chuGiai, setChuGiai] = useState<{ nhom: string; muc: { mau: string; ten: string; dayDu?: string; so: number }[] }[] | null>(null);
  const [chuGiaiOpen, setChuGiaiOpen] = useState(false);
  // Ảnh PNG QĐ205 là lớp CHÍNH (đúng màu/ký hiệu gốc) — bật mặc định, hiển thị TRÊN lớp vector.
  // Hai lớp phân khu MẶC ĐỊNH TẮT: chúng nằm đè lên vùng QĐ205, bật sẵn cả ba thì màu chồng màu.
  // Người dùng tự tích vào mới hiện.
  const [ovOn, setOvOn] = useState<Record<string, boolean>>({ 'qh-qd205': true, 'qh-qd2076': false, 'qh-qd2101': false, 'qh-qd2222': false, 'qh-qd918': false, 'qh-cuhin': false, 'qh-taynam': false, 'qh-taybac': false, 'qh-qd893': false });
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
  const [cap, setCap] = useState<'2' | '3'>('3'); // cấp hành chính, mặc định 3 cấp (Cam Đức hiện tại)

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
  const dsHuyen = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of dsXaCap) m.set(x.huyen, (m.get(x.huyen) || 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'vi'));
  }, [dsXaCap]);
  // Chọn huyện nào thì ô xã chỉ sổ ra xã của huyện đó
  const xaTheoHuyen = useMemo(
    () => (huyenChon ? dsXaCap.filter((x) => x.huyen === huyenChon) : dsXaCap),
    [dsXaCap, huyenChon],
  );
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
  const [drawResult, setDrawResult] = useState<{ n: number; area: number; perim: number; lat: number; lng: number } | null>(null);
  const [tool, setTool] = useState<'none' | 'search' | 'chugiai' | 'measure'>('none'); // bảng công cụ trên mobile
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
  }, [refreshFeatures]);
  // BẬT MỘT MỤC QUY HOẠCH. Mỗi lúc chỉ một mục; mục "phân khu" bật cùng lúc cả ba bản 2076/2101/2222.
  // ⚠️ KHÔNG tự thu/dời bản đồ nữa. Trước đây bật lớp ở nơi khác thì bản đồ tự lùi ra cho thấy cả lớp,
  // nhưng từ khi ba bản phân khu được ghép lại thì lớp nào cũng phủ gần kín huyện — tự nhảy khung chỉ
  // làm người xem mất chỗ đang xem.
  const chonLopQh = useCallback((muc: { gom: string[]; zBay?: number }, bat: boolean) => {
    const tat: Record<string, boolean> = Object.fromEntries(RASTER_OVERLAYS.map((x) => [x.id, false]));
    if (bat) for (const id of muc.gom) tat[id] = true;
    setOvOn(tat);
    // BẬT BẢN QUY HOẠCH MÀ ĐANG NHÌN QUÁ XA (chủ dự án yêu cầu 14/9/2026):
    // mức phóng hiện tại NHỎ HƠN mức phóng tối thiểu của bản đó (ảnh chưa vẽ ở mức này → nhìn như không có gì)
    // thì bay tới TÂM VÙNG QUY HOẠCH và phóng đúng tới mức tối thiểu. Đang phóng đủ gần thì giữ nguyên chỗ đang xem.
    // Bản gộp nhiều mảnh (Phân khu 1/2000): lấy khung bao chung của mọi mảnh, mức tối thiểu nhỏ nhất.
    if (!bat) return;
    const cac = RASTER_OVERLAYS.filter((o) => muc.gom.includes(o.id));
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
    if (m && zThay > 0 && m.getZoom() < zThay) m.easeTo({ center: tam, zoom: zThay, duration: 900 });
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
  useEffect(() => {
    const go = () => fetch('/qh_vector.geojson').then((r) => r.json()).then(setQhVector).catch(() => {});
    const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, o?: any) => number);
    const id = ric ? ric(go, { timeout: 4000 }) : window.setTimeout(go, 1800);
    return () => { const cic = (window as any).cancelIdleCallback; if (ric && cic) cic(id); else clearTimeout(id); };
  }, []);
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

  const overlays: ImageOverlay[] = useMemo(
    () => RASTER_OVERLAYS.map((o) => ({ id: o.id, url: o.url, coordinates: o.coordinates, opacity, visible: !!ovOn[o.id], pmtiles: (o as any).pmtiles, fillMaxzoom: (o as any).fillMaxzoom, tiles: (o as any).tiles, minzoom: (o as any).minzoom, maxzoom: (o as any).maxzoom })), [opacity, ovOn]);

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
  const allMarkers = useMemo(() => clickVN ? [...placeMarkers, { lng: clickVN.lng, lat: clickVN.lat, color: '#2563eb' }] : placeMarkers, [placeMarkers, clickVN]);
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
    const vn = wgs84ToVn2000(lng, lat);
    setClickVN({ x: vn.y, y: vn.x, lng, lat }); // sổ: X=Bắc(Northing), Y=Đông(Easting)
    setFlyPoint({ lng, lat }); // bay tới + zoom cận, pin nằm giữa vùng trống phía trên bảng
    setSheetExpanded(false); // mỗi lần click: thu gọn bảng để thấy bản đồ, muốn xem đầy đủ thì kéo lên
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
      // Diện tích QH giờ do BACKEND tính theo ĐƯỜNG THẬT (robust khi đổi địa chính) → dùng thẳng r.overlaps.
      // Fallback: nếu backend chưa cập nhật (overlaps rỗng) thì tạm overlay vector phía client.
      if ((!(r as any).overlaps || !(r as any).overlaps.length) && pg) {
        const ring = pg.type === 'Polygon' ? (pg.coordinates?.[0] || [])
          : pg.type === 'MultiPolygon' ? ((pg.coordinates || []).reduce((a: number[][], poly: any) => ((poly?.[0]?.length || 0) > (a?.length || 0) ? poly[0] : a), [] as number[][])) : [];
        const areas = qhAreasFromVector(ring as number[][]);
        if (areas.length) (r as any).overlaps = areas;
      }
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
        setFocusPoint({ lng, lat, label: `Tờ ${sp.get('to') || '?'} · Thửa ${sp.get('thua') || '?'}` });
        setTimeout(() => { onMapClick(lng, lat).catch(() => {}); }, 700);
      }
    } catch { /* bỏ qua */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mở một thửa trong danh sách tìm được: tô sáng, bay tới, nạp đầy đủ thông tin.
  const moThuaTim = useCallback(async (p: any) => {
    const props = { to: p.soTo, thua: p.soThua, xa: p.tenXa, xaCu: p.tenXaCu,
                    dienTich_m2: p.dienTich, mucDichSuDung: p.mdsd, nhan: `Tờ ${p.soTo}, thửa ${p.soThua}` };
    if (p.hinh) setHighlight({ type: 'Feature', properties: props, geometry: p.hinh });
    setFocusPoint({ lng: p.lng, lat: p.lat, label: `Tờ ${p.soTo} · Thửa ${p.soThua}${p.tenXa ? ' · ' + p.tenXa : ''}` });
    setPanelOpen(false); setTool('none');
    // Nạp ĐẦY ĐỦ thông tin thửa (quy hoạch, chồng lấn, toạ độ, tin BĐS…) giống bấm trực tiếp trên bản đồ.
    await onMapClick(p.lng, p.lat);
    if (p.hinh) setHighlight({ type: 'Feature', properties: props, geometry: p.hinh }); // giữ đúng ranh thửa đã tìm
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doSearch() {
    if (searchMode === 'parcel') {
      // Tra trên bảng địa chính toàn tỉnh (/dc/tim) — có chỉ mục theo số tờ/số thửa nên rất nhanh.
      const params = new URLSearchParams();
      if (c1.trim()) params.set('to', c1.trim());
      if (c2.trim()) params.set('thua', c2.trim());
      if (c3.trim()) params.set('xaId', c3.trim());   // c3 giờ là MÃ XÃ, không phải tên (10 cặp xã trùng tên)
      if (!c3.trim() && cap) params.set('cap', cap);   // chưa chọn xã thì lọc theo cấp cho gọn kết quả
      if (!c1.trim() && !c2.trim()) return alert('Nhập số tờ và/hoặc số thửa.');
      try {
        const r = await api<{ soLuong: number; thuaDat: ThuaTim[] }>(`/dc/tim?${params.toString()}`);
        if (!r.soLuong) { setKetQuaTim([]); return alert('Không tìm thấy thửa nào khớp. Thử bỏ bớt điều kiện, hoặc chọn đúng xã/phường.'); }
        setKetQuaTim(r.soLuong > 1 ? r.thuaDat : []);   // nhiều kết quả → hiện bảng cho chọn
        await moThuaTim(r.thuaDat[0]);                  // vẫn mở sẵn thửa đầu tiên
      } catch (e: any) { alert('Lỗi tra cứu: ' + e.message); }
      return;
    }
    if (searchMode === 'gmap') {
      const g = parseGmap(c1.trim());
      if (!g) return alert('Không đọc được toạ độ từ link. Hãy dán link Google Maps có dạng …/@12.34,109.12,… hoặc copy toạ độ. (Link rút gọn goo.gl cần mở ra để lấy link đầy đủ.)');
      setFocusPoint({ lng: g.lng, lat: g.lat, label: `${g.lat.toFixed(6)}, ${g.lng.toFixed(6)}` });
      setTool('none'); return;
    }
    let lng: number, lat: number;
    if (searchMode === 'vn2000') {
      const a = parseFloat(c1), b = parseFloat(c2);
      if (Number.isNaN(a) || Number.isNaN(b)) return alert('Nhập X (Bắc), Y (Đông) hệ VN-2000.');
      const E = a < 900000 ? a : b, N = a < 900000 ? b : a; // sổ: X=Bắc(>900k), Y=Đông(<900k) — tự nhận, không lo nhầm X/Y
      const w = vn2000ToWgs84(E, N); lng = w.lng; lat = w.lat;
    } else {
      lat = parseFloat(c1); lng = parseFloat(c2);
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
    setDrawResult({ n: pts.length, area: polyAreaM2(pts), perim: perimeterM(pts), lat: ll[0][1], lng: ll[0][0] });
    setClickVN(null); setInfo(null); setFocusPoint(null); setDrawOpen(false);
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
  const nhanOSoTo = (cap === '2' && dsXaCap.find((x) => x.xaId === c3)?.coBangTo) ? 'Số tờ (mới)' : 'Số tờ';
  // anChon = true: bảng đáy Tra cứu của điện thoại — kiểu tra đã chọn bằng THẺ nên ẩn ô sổ xuống.
  const searchCtrl = (full = false, anChon = false) => (
    <div className={`flex items-center gap-1.5 ${full ? 'flex-wrap' : ''}`}>
      <select value={searchMode} hidden={anChon} onChange={(e) => setSearchMode(e.target.value as any)} className={`border rounded-lg px-2 py-1.5 text-xs bg-white ${full ? 'w-full' : ''}`}>
        <option value="parcel">Số tờ / thửa</option>
        <option value="vn2000">Toạ độ VN-2000</option>
        <option value="latlng">Lat / Lng (WGS-84)</option>
        <option value="gmap">Link Google Maps</option>
      </select>
      {searchMode === 'gmap' ? (
        <input value={c1} onChange={(e) => setC1(e.target.value)} placeholder="Dán link Google Maps (…/@12.34,109.12…)" className={`border rounded-lg px-2.5 ${full ? 'py-2 text-[16px] w-full' : 'py-1.5 text-xs w-56'}`} />
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
                className={full ? 'flex-1 min-w-[160px]' : 'w-48'} />
            </>
          )}
          {/* Tra theo THỬA thì gõ SỐ THỬA trước rồi mới tới SỐ TỜ — đúng thói quen đọc sổ.
              Các kiểu tra khác (toạ độ VN-2000, kinh/vĩ độ) vẫn giữ thứ tự cũ.
              Ô số tờ luôn là c1, ô số thửa luôn là c2 — chỉ đổi chỗ HIỂN THỊ, không đổi ruột. */}
          {searchMode === 'parcel' ? (
            <>
              <input value={c2} onChange={(e) => setC2(e.target.value)} placeholder="Số thửa" className={`border rounded-lg px-2.5 ${full ? 'py-2 text-[16px] flex-1 min-w-[80px]' : 'py-1.5 text-xs w-24'}`} />
              <input value={c1} onChange={(e) => setC1(e.target.value)} placeholder={nhanOSoTo} className={`border rounded-lg px-2.5 ${full ? 'py-2 text-[16px] flex-1 min-w-[80px]' : 'py-1.5 text-xs w-24'}`} />
            </>
          ) : (
            <>
              <input value={c1} onChange={(e) => setC1(e.target.value)} inputMode="decimal" placeholder={searchMode === 'vn2000' ? 'X (Bắc)' : 'Vĩ độ'} className={`border rounded-lg px-2.5 ${full ? 'py-2 text-[16px] flex-1 min-w-[80px]' : 'py-1.5 text-xs w-24'}`} />
              <input value={c2} onChange={(e) => setC2(e.target.value)} inputMode="decimal" placeholder={searchMode === 'vn2000' ? 'Y (Đông)' : 'Kinh độ'} className={`border rounded-lg px-2.5 ${full ? 'py-2 text-[16px] flex-1 min-w-[80px]' : 'py-1.5 text-xs w-24'}`} />
            </>
          )}
        </>
      )}
      {/* Điện thoại (full): tra xong đóng bảng đáy để thấy kết quả trên bản đồ. */}
      <button onClick={() => { doSearch(); if (full) setTool('none'); }} className={`cl-press bg-[#0A2540] hover:bg-[#0d2f54] text-white px-4 rounded-lg font-bold whitespace-nowrap ${full ? 'w-full mt-1.5 py-2.5 text-sm' : 'py-1.5 text-xs'}`}>Tra cứu</button>
    </div>
  );
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
  // Nạp bảng chú giải MỘT LẦN, lúc người dùng bấm mở (ai không xem thì khỏi tải thêm gì).
  const napChuGiai = () => {
    if (chuGiai) return;
    fetch('/chu-giai-qh.json').then((r) => r.json())
      .then((d) => setChuGiai(d?.nhom || []))
      .catch(() => setChuGiai([]));
  };
  // Ruột bảng chú giải — dùng chung cho bảng bên trái (máy tính) và nhóm trên thanh (điện thoại).
  const chuGiaiNoiDung = () => (
    <div className="max-h-72 overflow-y-auto rounded-lg border bg-slate-50/60 p-2">
      {chuGiai === null && <p className="text-[11px] text-slate-400 py-1">Đang tải…</p>}
      {chuGiai !== null && chuGiai.length === 0 && (
        <p className="text-[11px] text-slate-400 py-1">Chưa có dữ liệu chú giải.</p>
      )}
      {(chuGiai || []).map((n) => (
        <div key={n.nhom} className="mb-2 last:mb-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">{n.nhom}</p>
          {n.muc.map((m) => (
            /* title = tên đầy đủ: một màu hay gánh 3–4 loại đất, dòng chú giải chỉ ghi 2 tên
               đầu cho gọn, rê chuột vào mới hiện hết. */
            <div key={m.mau + m.ten} title={m.dayDu || m.ten} className="flex items-start gap-2 py-[3px]">
              <span className="mt-[3px] inline-block w-3.5 h-3.5 rounded-sm shrink-0 border border-black/10"
                style={{ background: m.mau }} />
              <span className="min-w-0 flex-1 text-[11px] leading-snug text-slate-600">{m.ten}</span>
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
  // Thanh nút ĐIỆN THOẠI — KIỂU APP THAM CHIẾU (14/9/2026): một hàng nút BO TRÒN, không icon,
  // "Lớp Q.Hoạch (n)" ghi kèm số bản đồ quy hoạch chọn được. Bấm nó mở BẢNG ĐÁY chọn bản đồ
  // (không mở bảng lớp trượt che nửa màn hình nữa).
  const tabBtn = (key: string, label: string, active: boolean, dot = false) => (
    // MỖI LÚC CHỈ MỘT NHÓM MỞ: bấm nhóm nào là đóng bảng "Lớp Q.Hoạch" + tắt đo của nhóm khác.
    // Trước đây mở "Đo - vẽ" mà bảng lớp vẫn nằm đè nửa màn hình (chủ dự án chụp màn hình báo).
    <button onClick={
      key === 'layers' ? () => { setQhSheet(true); setPanelOpen(false); setTool('none'); setMeasure('off'); setMResult(null); setNenOpen(false); }
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
      {/* Toolbar tra cứu quy hoạch — dính cố định; desktop đầy đủ, mobile gọn theo nhóm */}
      <div className="bg-white border-b border-slate-200 shrink-0 z-20">
        {/* MÁY TÍNH (lg+): một hàng đầy đủ, tự xuống dòng khi hẹp */}
        <div className="hidden lg:flex items-center gap-x-3 gap-y-2 px-4 py-2.5 flex-wrap">
          {baseMapCtrl()}
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
          {tabBtn('layers', `Lớp Q.Hoạch (${MUC_QH.length})`, qhSheet)}
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

        <aside className={`${panelOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-200 absolute lg:static inset-y-0 left-0 z-30 w-72 max-w-[82%] shrink-0 bg-white border-r border-slate-200 overflow-y-auto scroll-soft p-4 shadow-xl lg:shadow-none`}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold">Lớp Q.Hoạch</h2>
            <button onClick={() => setPanelOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
          </div>
          <p className="text-xs text-slate-500 mb-2.5">Cam Lâm, Khánh Hòa · EPSG:4326</p>
          {/* Máy tính: giữ nguyên nút này ở bảng lớp như cũ. Điện thoại thì nó đã nằm trong
              nhóm "Đo - vẽ" ở thanh trên rồi, để thêm ở đây là thừa. */}
          <button onClick={() => setDrawOpen(true)} className="cl-press hidden lg:flex w-full mb-3 items-center justify-center gap-2 bg-[#0A2540] hover:bg-[#0d2f54] text-white text-sm font-bold py-2.5 rounded-lg">✏️ Vẽ thửa từ toạ độ</button>
          {/* Ô chọn nền bản đồ nằm ở đây vì trên điện thoại nhóm 'Bản đồ' ở thanh trên đã được
              nhường chỗ cho Chú giải. Máy tính vẫn có ô này ở thanh trên, để đây thêm cũng không
              thừa: người dùng hay mở bảng lớp rồi mới nghĩ đến chuyện đổi nền. */}
          {/* Điện thoại: ô chọn NỀN BẢN ĐỒ + "Nhãn & đường" đã đưa ra NỔI TRÊN BẢN ĐỒ (nút "Nền"
              góc trái dưới) giống app tham chiếu — không còn nằm trong bảng này. */}
          <div className="pt-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Bản đồ quy hoạch</p>
            {MUC_QH.map((o) => (
              <label key={o.id} className="flex items-start gap-2.5 py-1.5 text-sm cursor-pointer">
                {/* MỖI LÚC CHỈ MỘT lớp quy hoạch — chọn lớp này là tự tắt lớp kia. Các bản quy hoạch
                    phủ đè lên nhau (QĐ205 trùm cả huyện, 3 bản 1/2000 nằm lọt bên trong), bật cùng
                    lúc là màu chồng màu, không đọc được gì. Bấm lại vào lớp đang bật để TẮT HẾT,
                    khi đó chỉ còn ảnh nền — nhìn thực địa để đối chiếu. */}
                {/* Ô VUÔNG cho đồng bộ với các lớp dữ liệu bên dưới, nhưng vẫn chỉ chọn được MỘT:
                    tích lớp này là các lớp kia tự bỏ tích; bỏ tích thì tắt hết, chỉ còn ảnh nền. */}
                <input type="checkbox" checked={o.gom.every((id) => !!ovOn[id])}
                  onChange={(e) => chonLopQh(o, e.target.checked)}
                  className="accent-emerald-600 w-4 h-4 rounded-sm" />
                <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0 bg-amber-500" /><span className="min-w-0 flex-1 text-slate-700 leading-snug">{o.ten}</span>
              </label>
            ))}
            <div className="mt-1 pl-[26px]">
              <div className="flex justify-between text-[11px] text-slate-400 mb-1"><span>Độ mờ</span><span className="font-semibold text-slate-500">{Math.round(opacity * 100)}%</span></div>
              <input type="range" min={0} max={100} value={Math.round(opacity * 100)} onChange={(e) => setOpacity(Number(e.target.value) / 100)} className="w-full accent-emerald-600" />
            </div>
            {/* ── CHÚ GIẢI ─────────────────────────────────────────────────────────────
                Chỉ hiện khi đang bật một lớp phân khu 1/2000 — bốn bản đó mới là bản được
                tô theo loại đất. QĐ205 và QĐ893 vẫn giữ màu bản vẽ gốc nên bảng này không
                đúng cho chúng, hiện ra là dẫn người xem đọc sai. */}
            {/* Điện thoại KHÔNG hiện khối này (chủ dự án yêu cầu 14/9/2026): đã có nhóm "Chú giải"
                riêng trên thanh trên, để thêm trong bảng lớp là trùng. */}
            {(MUC_QH.find((x) => x.id === 'phan-khu')?.gom || []).some((id) => !!ovOn[id]) && (
              <div className="mt-2 hidden lg:block">
                <button
                  onClick={() => { setChuGiaiOpen((v) => !v); napChuGiai(); }}
                  className="cl-press w-full flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  <span>📖 Chú giải loại đất</span>
                  <span className="text-slate-400">{chuGiaiOpen ? '▲' : '▼'}</span>
                </button>
                {chuGiaiOpen && <div className="mt-1.5">{chuGiaiNoiDung()}</div>}
              </div>
            )}
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
          {layers.map((l) => (
            <div key={l.slug} className="flex items-center gap-2.5 py-1.5 text-sm">
              <input type="checkbox" checked={visible[l.slug] ?? false} onChange={(e) => setVisible((v) => ({ ...v, [l.slug]: e.target.checked }))} className="accent-emerald-600 w-4 h-4" />
              <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: (l.style?.color as string) || DEFAULT_COLORS[l.layerType] }} />
              <span className="flex-1 truncate text-slate-700" title={l.name}>{l.name}</span>
              <span className="text-xs text-slate-400">{l.featureCount}</span>
              {canDelete && <button onClick={() => deleteLayer(l.slug, l.name)} title="Xoá lớp" className="text-slate-300 hover:text-red-600">🗑</button>}
            </div>
          ))}
          {user && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">📌 {adminAll ? 'Tất cả đã lưu' : 'Sản phẩm của tôi'} ({places.length})</p>
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
          )}
          <p className="text-xs text-slate-400 mt-4">💡 Nhấp vào bản đồ để xem toạ độ + lưu sản phẩm + tra cứu thửa/quy hoạch.</p>
        </aside>

        <div ref={khungBanDoRef} className="relative flex-1">
          <MapView layers={geoLayers} overlays={overlays} markers={allMarkers} baseMap={baseMap} labels={labels} measureMode={measure}
            focusPoint={focusPoint} flyToPoint={flyPoint} highlight={highlight} onMapClick={onMapClick} onMeasure={setMResult} onViewport={onViewport} initialBounds={QH_BOUNDS} adMarkers={ads} adOpacity={1} fitTo={fitTo} textLabels={textLabels}
            routes={dirTuyen} onPickRoute={setDirChon} diaChinhTiles={dcTiles} />

          {/* ── BẢNG ĐÁY "TRA CỨU" — CHỈ ĐIỆN THOẠI, học theo app tham chiếu (14/9/2026) ───────────
              4 thẻ: Góc ranh (bảng toạ độ VN-2000 → vẽ thửa) · Tờ thửa · Toạ độ · Google Maps.
              Nằm sát trên thanh menu đáy, cuộn được, bản đồ vẫn thấy phía trên. Trước đây là khối
              xổ xuống dưới thanh nút trên cùng, đẩy bản đồ và che mất phần đầu. */}
          {tool === 'search' && (
            <div style={kieuBangDay} className="lg:hidden absolute inset-x-0 bottom-[var(--menu-de,calc(56px+env(safe-area-inset-bottom)))] z-30 max-h-[62%] flex flex-col rounded-t-2xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,.18)]">
              <div className="flex items-center border-b border-slate-200 pl-2 pr-1">
                {([['goc', 'Góc ranh'], ['to', 'Tờ thửa'], ['toado', 'Toạ độ'], ['gmap', 'Google Maps']] as [typeof tcTab, string][]).map(([k, lb]) => (
                  <button key={k} onClick={() => { setTcTab(k); if (k === 'to') setSearchMode('parcel'); else if (k === 'gmap') setSearchMode('gmap'); else if (k === 'toado' && searchMode !== 'latlng') setSearchMode('vn2000'); }}
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
                  <div className="space-y-2">
                    {([
                      ['Hệ thống hành chính', (
                        <select value={cap} onChange={(e) => { setCap(e.target.value as any); setC3(''); setHuyenChon(''); donKetQuaCu(); }}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-[16px]">
                          <option value="3">3 cấp (huyện – xã)</option>
                          <option value="2">2 cấp (xã mới)</option>
                        </select>
                      )],
                      [cap === '3' ? 'Huyện / TP cũ' : 'Khu vực', (
                        <OChonCoGo dienThoai nhan={cap === '3' ? 'Chọn huyện/TP cũ' : 'Chọn khu vực'} giaTri={huyenChon}
                          dsMuc={dsHuyen.map(([h, n]) => ({ id: h, ten: h, phu: `${n} xã/phường` }))}
                          khiChon={(h) => { setHuyenChon(h); setC3(''); donKetQuaCu(); }} />
                      )],
                      ['Xã / phường', (
                        <OChonCoGo dienThoai nhan="Gõ hoặc chọn xã/phường" giaTri={c3}
                          dsMuc={xaTheoHuyen.map((x) => ({ id: x.xaId, ten: x.ten, phu: x.soThua ? `${x.huyen} · ${x.soThua.toLocaleString('vi-VN')} thửa` : x.huyen }))}
                          khiChon={(ma) => { donKetQuaCu(); setC3(ma); const x = dsXaCap.find((y) => y.xaId === ma) || null; if (x) { setHuyenChon(x.huyen); bayToiXa(x); } }} />
                      )],
                      [nhanOSoTo, (
                        <input value={c1} onChange={(e) => setC1(e.target.value)} inputMode="numeric" enterKeyHint="next" placeholder="Nhập số tờ"
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-[16px] outline-none focus:border-[#0A2540]" />
                      )],
                      ['Số thửa', (
                        <input value={c2} onChange={(e) => setC2(e.target.value)} inputMode="numeric" enterKeyHint="search" placeholder="Nhập số thửa"
                          onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); doSearch(); setTool('none'); } }}
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-[16px] outline-none focus:border-[#0A2540]" />
                      )],
                    ] as [string, React.ReactNode][]).map(([nhan, o]) => (
                      <div key={nhan} className="grid grid-cols-[42%_1fr] items-center gap-2">
                        <span className="text-[13.5px] text-slate-600">{nhan}</span>{o}
                      </div>
                    ))}
                    <button onClick={() => { (document.activeElement as HTMLElement | null)?.blur(); doSearch(); setTool('none'); }}
                      className="cl-press mt-1 w-full rounded-xl bg-[#0A2540] py-2.5 text-[14px] font-semibold text-white">Tra cứu</button>
                  </div>
                )}
                {tcTab === 'toado' && (
                  <div>
                    <div className="mb-2 inline-flex rounded-lg bg-slate-100 p-0.5 text-[13px]">
                      {([['vn2000', 'VN-2000 (X, Y)'], ['latlng', 'Kinh / vĩ độ']] as const).map(([k, lb]) => (
                        <button key={k} onClick={() => setSearchMode(k)} className={`rounded-md px-3 py-1.5 ${searchMode === k ? 'bg-white font-semibold text-[#0A2540] shadow-sm' : 'text-slate-500'}`}>{lb}</button>
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

          {/* ── CỘT NÚT BÊN PHẢI — CHỈ ĐIỆN THOẠI (14/9/2026, làm theo app tham chiếu) ─────────
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
          <div className="lg:hidden absolute right-[10px] top-[121px] z-10 flex w-[31px] flex-col items-center gap-2.5">
            <button onClick={() => setBaseMap(baseMap === 'satellite' ? 'street' : 'satellite')}
              aria-label={baseMap === 'satellite' ? 'Chuyển sang bản đồ đường' : 'Chuyển sang ảnh vệ tinh'}
              className="cl-press h-[31px] w-[31px] overflow-hidden rounded-full border-2 border-white bg-slate-200 bg-cover bg-center shadow-[0_1px_5px_rgba(0,0,0,.35)]"
              style={{ backgroundImage: `url(https://mt0.google.com/vt/lyrs=${baseMap === 'satellite' ? 'm' : 's'}&x=3289&y=1910&z=12)` }} />
            {/* Thanh ĐỘ MỜ dọc — hiện khi bật BẤT KỲ lớp quy hoạch nào. Kéo LÊN = đậm, XUỐNG = mờ.
                Màu ĐỎ như bản cũ (chủ dự án 14/9/2026). Phần DƯỚI núm (mức đậm đang chọn) đỏ, phần TRÊN
                núm xám — kéo xuống thấy ngay phần trên đổi màu. Vì thanh xoay -90° nên "to right" của
                dải màu chính là từ dưới lên. Nền màu vẽ lên chính ô trượt, rãnh để trong suốt. */}
            {(qhFillOn || RASTER_OVERLAYS.some((o) => !!ovOn[o.id])) && (
              <div className="relative h-[123px] w-7">{/* 160px → 2/3 (107px) → +15% (123px), chủ dự án chỉnh 14/9/2026 */}
                <input type="range" min={0} max={100} value={Math.round(opacity * 100)} onChange={(e) => setOpacity(Number(e.target.value) / 100)} aria-label="Độ đậm lớp quy hoạch"
                  style={{ background: `linear-gradient(to right, #dc2626 ${Math.round(opacity * 100)}%, rgba(255,255,255,.85) ${Math.round(opacity * 100)}%)` }}
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
              <span className="truncate font-medium">{(() => { const m = MUC_QH.find((o) => o.gom.every((id) => !!ovOn[id])); return m ? `H.Cam Lâm - ${m.tenApp}` : ''; })()}</span>
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
                <div className="max-h-[62dvh] overflow-y-auto overscroll-contain rounded-[14px] bg-white/95 backdrop-blur-xl shadow-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onClick={(e) => e.stopPropagation()}>
                  <p className="sticky top-0 z-20 bg-white/90 backdrop-blur px-4 py-2.5 text-center text-[12px] text-[#8a8a8e] border-b border-black/10">Chọn bản đồ quy hoạch</p>
                  {MUC_QH.map((o) => {
                    const bat = o.gom.every((id) => !!ovOn[id]);
                    return (
                      <button key={o.id} onClick={() => { chonLopQh(o, !bat); setQhSheet(false); }}
                        className={`relative block w-full truncate whitespace-nowrap border-b border-black/10 px-8 py-[11px] text-center text-[14px] text-[#0A2540] active:bg-black/5 ${bat ? 'font-medium' : ''}`}>
                        {bat && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] font-bold text-[#C8A14B]">✓</span>}H.Cam Lâm - {o.tenApp}
                      </button>
                    );
                  })}
                  {tieuDe('Lớp dữ liệu')}
                  <div className="bg-[#f2f2f7] px-3 pb-3">
                    <div className="overflow-hidden rounded-[10px] bg-white">
                      {ranhXa && (
                        <div className="flex min-h-[42px] items-center gap-3 border-b border-black/10 px-3 py-1.5 last:border-b-0">
                          <span className="h-3 w-3 shrink-0 rounded-[3px] bg-[#C8A14B]" />
                          <span className="min-w-0 flex-1 truncate text-[14px] text-black">Ranh giới xã</span>
                          {congTac(ranhOn, () => setRanhOn(!ranhOn), 'Ranh giới xã')}
                        </div>
                      )}
                      {layers.length === 0 && !ranhXa && (
                        <p className="px-3 py-3 text-[14px] text-[#8a8a8e]">Đang tải các lớp…</p>
                      )}
                      {layers.map((l) => {
                        const bat = visible[l.slug] ?? false;
                        return (
                          <div key={l.slug} className="flex min-h-[42px] items-center gap-3 border-b border-black/10 px-3 py-1.5 last:border-b-0">
                            <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: (l.style?.color as string) || DEFAULT_COLORS[l.layerType] }} />
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
                        className="mt-3 flex w-full items-center justify-between rounded-[10px] bg-white px-3 py-3 text-[14px] text-black active:bg-black/5">
                        <span>📌 Sản phẩm đã lưu ({places.length})</span><span className="text-[#c7c7cc] text-xl leading-none">›</span>
                      </button>
                    )}
                  </div>
                </div>
                <button onClick={() => setQhSheet(false)} className="mt-2 w-full rounded-[14px] bg-white py-[11px] text-[14px] font-semibold text-[#0A2540] shadow-2xl active:bg-[#e5e5ea]">Đóng</button>
              </div>
            );
          })()}
          {/* ── DANH SÁCH THỬA TÌM ĐƯỢC ── hiện khi có nhiều thửa cùng số tờ/số thửa.
              Rất hay gặp khi tra theo XÃ MỚI, vì một xã mới gộp nhiều xã cũ mà mỗi xã cũ
              lại có bộ số tờ/số thửa riêng — trùng số là chuyện bình thường. ── */}
          {ketQuaTim.length > 1 && (
            <div className="absolute top-2 left-2 z-20 w-64 max-w-[calc(100%-1rem)] bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-[#0A2540] text-white">
                <span className="text-xs font-bold">Tìm thấy {ketQuaTim.length} thửa trùng số</span>
                <button onClick={() => setKetQuaTim([])} aria-label="Đóng" className="text-white/70 hover:text-white text-base leading-none">✕</button>
              </div>
              <div className="max-h-56 overflow-y-auto scroll-soft">
                {ketQuaTim.map((t) => (
                  <button key={t.id} onClick={() => moThuaTim(t)}
                    className="w-full text-left px-3 py-2 hover:bg-amber-50 border-b last:border-b-0 border-slate-100">
                    <span className="block text-xs font-bold text-[#0A2540]">Tờ {t.soTo} · Thửa {t.soThua}
                      {t.dienTich != null && <span className="font-normal text-slate-500"> · {t.dienTich.toFixed(1)} m²</span>}
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
          {zoomNow > 0 && zoomNow < PARCEL_SHOW_ZOOM && (
            // Hàng nút quy hoạch nổi trên bản đồ đã bỏ (14/9/2026) nên về lại top-2 như máy tính.
            <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap bg-[#0A2540]/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow">🔍 Phóng to để hiện thửa đất</div>
          )}
          {/* BẢNG ĐẦY ĐỦ khi bấm gim tin lưu — như giỏ hàng */}
          {selPlace && (
            <div className="absolute bottom-[60px] sm:bottom-3 left-1/2 -translate-x-1/2 w-[360px] max-w-[94%] max-h-[64%] sm:max-h-[72%] overflow-y-auto z-20 bg-white rounded-2xl border-2 border-[#7c3aed]/40 shadow-2xl p-3.5 text-xs">
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
            <div className="pointer-events-none absolute z-20 left-2 right-2 bottom-[70px] sm:bottom-auto sm:top-3 sm:left-3 sm:right-auto sm:w-[380px]">
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
            <div className="absolute top-3 left-1/2 z-30 -translate-x-1/2 rounded-full bg-[#0A2540] px-4 py-2 text-sm font-bold text-white shadow-lg">
              Bấm lên bản đồ để chọn {dirNhat === 'di' ? 'điểm đi' : 'điểm đến'}
              <button onClick={() => setDirNhat(null)} className="ml-3 text-white/70 hover:text-white">✕</button>
            </div>
          )}
          {focusPoint && (
            <div className="absolute bottom-[60px] sm:bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-white rounded-full shadow-lg border border-slate-200 pl-4 pr-2 py-1.5 max-w-[92%]">
              <span className="text-sm font-semibold text-[#0A2540] truncate max-w-[42vw]">📍 {focusPoint.label || 'Vị trí tìm kiếm'}</span>
              <button onClick={() => moChiDuong(focusPoint.lat, focusPoint.lng, focusPoint.label || 'Vị trí tìm kiếm')} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-full px-3.5 py-1.5 whitespace-nowrap">🧭 Chỉ đường</button>
              <button onClick={() => setFocusPoint(null)} className="text-slate-400 hover:text-slate-700 w-7 h-7 grid place-items-center shrink-0">✕</button>
            </div>
          )}
          {drawResult && (
            <div className="absolute top-3 left-3 z-10 bg-white rounded-xl shadow-xl border border-slate-200 p-3 text-sm max-w-[250px]">
              <div className="flex justify-between items-center mb-1">
                <b className="text-[#0A2540]">📐 Thửa đất đã vẽ</b>
                <button onClick={() => { setDrawResult(null); setHighlight(null); }} className="text-slate-400 hover:text-slate-700">✕</button>
              </div>
              <p className="text-slate-600">Số điểm: <b>{drawResult.n}</b></p>
              <p className="text-slate-600">Diện tích: <b className="text-emerald-700">{fmtArea(drawResult.area)}</b></p>
              <p className="text-slate-600">Chu vi: <b>{fmtLen(drawResult.perim)}</b></p>
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
              <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100 rounded-t-2xl">
                <button onClick={() => setSheetExpanded((v) => !v)} className="sm:hidden w-full flex flex-col items-center pt-2 pb-0.5" aria-label={sheetExpanded ? 'Thu gọn' : 'Kéo lên xem đầy đủ'}>
                  <span className="w-10 h-1.5 rounded-full bg-slate-300" />
                  <span className="text-[10px] font-bold text-slate-400 mt-1">{sheetExpanded ? '▼ Thu gọn' : '▲ Kéo lên xem đầy đủ'}</span>
                </button>
                <div className="flex justify-between items-center px-4 py-1.5">
                  <h3 className="font-extrabold text-[#0A2540] text-[15px]">Thông tin thửa</h3>
                  <button onClick={() => setInfo(null)} className="text-slate-400 hover:text-slate-700 w-7 h-7 grid place-items-center rounded-lg hover:bg-slate-100 text-lg leading-none">✕</button>
                </div>
              </div>
              {/* ĐẦU BẢNG — ĐỨNG YÊN KHI CUỘN.
                  Số tờ · số thửa · diện tích · tên xã là thứ người xem cần thấy SUỐT, kể cả lúc
                  kéo xuống đọc các bản quy hoạch bên dưới. Trước đây cả bảng cùng cuộn nên kéo
                  một cái là mất luôn số tờ/số thửa — đang đối chiếu với sổ đỏ thì phải kéo lên
                  kéo xuống liên tục. */}
              <div className="shrink-0 px-4 pt-1.5 pb-2 text-sm border-b border-slate-100">
                {info.parcel ? (() => {
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
                  const nhanSoTo = !toMoi ? 'Số tờ' : (xemXaCu ? 'Số tờ (cũ)' : 'Số tờ (mới)');
                  // Mã loại đất CỦA LỚP GIS tự tải lên (lớp do admin upload có sẵn mấy trường này).
                  // Thửa địa chính KHÔNG hiện mục đích sử dụng — chủ dự án không muốn in dòng đó ra.
                  const code = pickProp(props, ['KyHieu', 'MaLoaiDat', 'MDSD', 'MDSDD', 'LoaiDat', 'ky_hieu', 'ma_loai_dat']);
                  const name = pickProp(props, ['TenLoaiDat', 'TenMDSD', 'ten_loai_dat', 'MoTa', 'GhiChu']);
                  return (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        <div><div className="text-[11px] text-slate-400">{nhanSoTo}</div><div className="font-bold text-[#0A2540]">{soToChinh || '—'}</div></div>
                        <div><div className="text-[11px] text-slate-400">Số thửa</div><div className="font-bold text-[#0A2540]">{info.parcel.soThua || '—'}</div></div>
                        <div><div className="text-[11px] text-slate-400">Diện tích</div><div className="font-bold text-[#0A2540]">{info.parcel.areaM2 != null ? info.parcel.areaM2.toFixed(1) + ' m²' : '—'}</div></div>
                      </div>
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
                          {thieuBangTra && <div className="text-slate-400 text-[10px] mt-0.5">Xã mới chưa có bảng tra số tờ</div>}
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
                          {thieuBangTra && <div className="text-slate-400 text-[10px] mt-0.5">Xã này chưa có bảng tra số tờ mới — số đang hiện là số tờ cũ</div>}
                        </>
                      )}
                      {/* BỎ nút "Xem thêm" — hiện thẳng luôn phần tên chủ + toạ độ. Bấm vào thửa là
                          muốn xem cho đủ, bắt bấm thêm một nút nữa chỉ tổ vướng. */}
                      {true && (
                        <div className="mt-1">
                          {owner && <div className="text-slate-600 mt-1"><span className="text-slate-400">Tên chủ: </span><b className="text-[#0A2540]">{owner}</b></div>}
                          {(code || name) && (
                            <div className="mt-2.5 flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                              {info.parcel.areaM2 != null && <b className="text-[#0A2540] shrink-0">{info.parcel.areaM2.toFixed(0)} m²</b>}
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
              <div className="px-4 py-2 text-sm flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]">
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

                {/* Ngoài huyện Cam Lâm cũ thì CHƯA có dữ liệu quy hoạch. Nói thẳng ra, vì trước đây
                    máy chủ đoán bừa mọi thửa ngoài vùng thành "Đất giao thông" phủ kín cả thửa. */}
                {info.parcel && info.qhNgoaiVung && (
                  <div className="mt-2 pt-1.5 border-t border-slate-100">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">Quy hoạch</p>
                    <p className="text-slate-500 leading-relaxed">
                      Khu vực này <b>chưa có dữ liệu quy hoạch</b> trong hệ thống.
                      Hiện mới có <b>Quy hoạch chung đô thị mới Cam Lâm đến 2045</b> (QĐ 205/QĐ-TTg) cho huyện Cam Lâm cũ.
                    </p>
                  </div>
                )}


                {clickVN && (
                  <div className="mt-2 pt-1.5 border-t border-slate-100">
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
              <div className="shrink-0 px-4 pt-1.5 pb-2 bg-white border-t border-slate-100">
                {/* Phiếu trích lục ghi rõ "Quy hoạch chung đô thị mới Cam Lâm 2045" nên chỉ cho xuất
                    khi thửa nằm trong vùng có dữ liệu — ngoài vùng mà in ra là phiếu sai. */}
                {info.parcel && !info.qhNgoaiVung && (
                  <button
                    onClick={() => {
                      const g = (highlight as any)?.geometry || (info.parcel as any)?.geometry;
                      const mapScen = qhScenario === 'all' ? '2045' : qhScenario;
                      // Ranh WGS84 của thửa (để đo diện tích theo ảnh QĐ205).
                      const ring: number[][] = g?.type === 'Polygon' ? (g.coordinates?.[0] || [])
                        : g?.type === 'MultiPolygon' ? ((g.coordinates || []).reduce((a: number[][], poly: any) => ((poly?.[0]?.length || 0) > (a?.length || 0) ? poly[0] : a), [] as number[][])) : [];
                      // MỞ cửa sổ TRƯỚC (tránh chặn pop-up) → tính diện tích theo ẢNH QH (bất đồng bộ) → ghi phiếu.
                      const win = window.open('', '_blank');
                      if (!win) { alert('Trình duyệt đang chặn cửa sổ. Hãy cho phép pop-up rồi thử lại.'); return; }
                      try { win.document.write('<!doctype html><meta charset="utf-8"><body style="font:14px sans-serif;color:#334155;padding:24px">Đang tạo phiếu kiểm tra quy hoạch…</body>'); } catch { /* */ }
                      const finish = (overlaps: any[]) => {
                        const hzA: Record<string, number> = {};
                        for (const x of (overlaps || []) as any[]) if (x?.hz) hzA[String(x.hz)] = (hzA[String(x.hz)] || 0) + (Number(x.areaM2) || 0);
                        const pieceHz = Object.keys(hzA).sort((a, b) => hzA[b] - hzA[a])[0] || mapScen;
                        const html = phieuQhHtml({ parcel: info.parcel as any, geometry: g, overlaps, qhCacBan: (info as any).qhCacBan, qhPieces: qhPiecesFor(g, pieceHz), roadFeats: roadFeatsFor(g), neighbors: (info as any).neighbors || [], point: info.point, user: user as any, scenario: mapScen, roadHz: pieceHz });
                        try { win.document.open(); win.document.write(html); win.document.close(); win.focus(); } catch { /* */ }
                      };
                      const areas = (info.overlaps && info.overlaps.length) ? info.overlaps : qhAreasFromVector(ring); finish(areas.length ? areas : []);
                    }}
                    className="mb-1.5 w-full flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold bg-[#0A2540] hover:bg-[#0d3a6b] text-white">
                    🖨 Xuất phiếu kiểm tra quy hoạch
                  </button>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {user ? (
                    <button onClick={() => setShowSave((v) => { const nv = !v; if (nv) { setSheetExpanded(true); setParcelMore(true); } return nv; })} className={`flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-bold transition ${showSave ? 'bg-[#7c3aed] text-white' : 'bg-[#7c3aed]/10 text-[#7c3aed] hover:bg-[#7c3aed]/20'}`}>📌 Lưu điểm</button>
                  ) : (
                    <Link href="/login" className="flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-bold bg-[#7c3aed]/10 text-[#7c3aed]">🔒 Lưu điểm</Link>
                  )}
                  <button onClick={() => { const t = `Tờ ${info.parcel?.soTo || '?'}, Thửa ${info.parcel?.soThua || '?'} — ${info.parcel?.xa || 'Cam Lâm'}${info.point ? ` (${info.point.lat.toFixed(6)},${info.point.lng.toFixed(6)})` : ''}`; navigator.clipboard?.writeText(t).then(() => alert('Đã sao chép mã chia sẻ:\n' + t)).catch(() => alert(t)); }} className="flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200">🔗 Chia sẻ</button>
                  {info.point && <button onClick={() => moChiDuong(info.point!.lat, info.point!.lng, 'Thửa đang xem')} className="flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200">🧭 Chỉ đường</button>}
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
