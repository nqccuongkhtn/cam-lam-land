import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import BangGiaSection from '@/components/BangGiaSection';
import ServicesSection from '@/components/ServicesSection';
import LegalConsultCTA from '@/components/LegalConsultCTA';

export const metadata: Metadata = {
  title: 'Bảng giá đất Khánh Hòa 2026 (Cam Lâm) — Tra cứu & tính giá chính thức theo NQ 15/2025',
  description: 'Tra cứu bảng giá đất ở chính thức từng tuyến đường (VT1–VT5) cho 4 xã vùng Cam Lâm theo Nghị quyết 15/2025/NQ-HĐND, kèm công cụ tính giá trị thửa theo vị trí, chiều sâu, loại đất và tiền chuyển mục đích.',
  keywords: ['bảng giá đất Khánh Hòa 2026', 'bảng giá đất Cam Lâm', 'Nghị quyết 15/2025/NQ-HĐND', 'giá đất xã Cam Lâm', 'bảng giá đất Suối Dầu', 'tính tiền chuyển mục đích đất'],
  alternates: { canonical: '/bang-gia-dat' },
};

const XA_MOI: [string, string][] = [
  ['Xã Cam Lâm', 'TT Cam Đức, Cam Hải Đông, Cam Hải Tây, Cam Thành Bắc + một phần Cam Hiệp Bắc, Cam Hiệp Nam, Cam Hòa, Cam Tân, Cam An Bắc, Cam An Nam, Suối Tân'],
  ['Xã Suối Dầu', 'Suối Cát + một phần Cam Hòa, Cam Tân, Suối Tân'],
  ['Xã Cam Hiệp', 'Sơn Tân + phần còn lại Cam Hiệp Bắc, Cam Hiệp Nam, Cam Hòa, Cam Tân, Suối Tân'],
  ['Xã Cam An', 'Cam Phước Tây + phần còn lại Cam An Bắc, Cam An Nam'],
];
const OFFICIAL = 'https://cosodulieugia.khanhhoa.gov.vn/CongBo/BangGiaDat';
const PDF_NQ = 'https://cdn.thuviennhadat.vn/upload/hinh-anh-bai-viet/2026/nhom3/PHQD/thang1/06/nghi-quyet-15-2025-hdnd.pdf';
const PDF_FULL = 'https://cdn.thuviennhadat.vn/upload/hinh-anh-bai-viet/2026/nhom3/PHQD/thang1/06/tron-bo-bang-gia-dat-khanh-hoa-2026.pdf';
const QD50 = 'https://cdn.thuvienphapluat.vn/uploads/tintuc/2026/07/09/qd50.pdf';

function Acc({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <summary className="cursor-pointer list-none px-4 py-3 font-bold text-[#0A2540] flex items-center justify-between hover:bg-slate-50">
        <span>{title}</span>
        <span className="text-[#C8A14B] transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="px-4 pb-4 pt-1 text-[13px] text-slate-600">{children}</div>
    </details>
  );
}

export default function BangGiaDatPage() {
  return (
    <>
    <div className="mx-auto max-w-3xl px-3 sm:px-4 py-5 sm:py-8">
      <h1 className="text-xl sm:text-3xl font-extrabold text-[#0A2540]">Bảng giá đất Khánh Hòa 2026 — Cam Lâm</h1>
      <p className="text-slate-600 mt-2 text-sm leading-relaxed">Giá đất <b>Nhà nước</b> theo Nghị quyết 15/2025/NQ-HĐND (áp dụng <b>01/01/2026</b>) — dùng tính thuế, phí, tiền sử dụng đất, bồi thường. Tra đúng tuyến đường, tính ngay giá trị thửa.</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <a href={OFFICIAL} target="_blank" rel="noreferrer" className="cl-press bg-[#0A2540] hover:bg-[#0d2f54] text-white font-bold text-[13px] px-3.5 py-2 rounded-lg">🔎 CSDL giá đất tỉnh</a>
        <a href={PDF_NQ} target="_blank" rel="noreferrer" className="bg-slate-100 hover:bg-slate-200 text-[#0A2540] font-semibold text-[13px] px-3.5 py-2 rounded-lg">📄 Nghị quyết (PDF)</a>
        <a href={PDF_FULL} target="_blank" rel="noreferrer" className="bg-slate-100 hover:bg-slate-200 text-[#0A2540] font-semibold text-[13px] px-3.5 py-2 rounded-lg">📚 Trọn bộ phụ lục</a>
        <a href={QD50} target="_blank" rel="noreferrer" className="bg-slate-100 hover:bg-slate-200 text-[#0A2540] font-semibold text-[13px] px-3.5 py-2 rounded-lg">📊 QĐ 50/2026 (hệ số K)</a>
      </div>

      {/* CÔNG CỤ CHÍNH: bảng tra cứu hiện sẵn + công cụ tính (nhiều tab theo từng Điều) */}
      <div className="mt-5">
        <BangGiaSection />
      </div>

      {/* QUY ĐỊNH ĐẦY ĐỦ — gom vào mục xổ ra cho gọn */}
      <div className="mt-6 space-y-2.5">
        <h2 className="text-lg font-bold text-[#0A2540]">Quy định &amp; cách tính đầy đủ</h2>

        <div className="rounded-2xl border border-[#C8A14B]/40 bg-[#C8A14B]/[0.06] p-4">
          <p className="font-bold text-[#0A2540]">🧭 Cách tính giá trị thửa — 6 bước</p>
          <p className="text-[13px] text-slate-600 mt-1"><b>Đơn giá</b> = Giá nền × tỷ lệ loại đất × điều chỉnh đặc biệt (× hệ số chiều sâu nếu thửa sâu). <b>Giá trị</b> = Đơn giá × diện tích, rồi cộng các loại đất trong thửa.</p>
          <ol className="text-[13px] text-slate-600 mt-2 space-y-1 list-decimal pl-5">
            <li><b>Tra giá nền</b> theo tuyến đường + vị trí (VT1–VT5) ở bảng trên — bấm vào ô giá để đưa xuống công cụ tính.</li>
            <li><b>Chọn loại đất:</b> đất ở 100% · thương mại–dịch vụ 80% · sản xuất – kinh doanh 60% · đất nông nghiệp lấy giá ở bảng riêng bên dưới.</li>
            <li><b>Điều chỉnh đặc biệt</b> (nếu có): 2 mặt tiền <b>×1,1</b> (3 mặt <b>×1,15–1,2</b>) · VT1+hẻm <b>×1,05</b> · đất khuất <b>×0,7</b> · không vào trực tiếp / hẻm chưa nhựa <b>×0,9</b>.</li>
            <li><b>Thửa ven trục sâu:</b> chia lớp theo chiều sâu — 0–30m ×1,0 · &gt;30–60m ×0,6 · &gt;60–100m ×0,4 · &gt;100m ×0,3.</li>
            <li><b>Nhân diện tích</b> từng phần rồi <b>cộng các loại đất</b> = tổng giá trị thửa.</li>
            <li><b>Tiền sử dụng đất / bồi thường / đấu giá:</b> nhân thêm <b>hệ số điều chỉnh giá đất</b> = Hệ số biến động thị trường × Hệ số quy hoạch × Hệ số yếu tố ảnh hưởng (Cam Lâm: hệ số biến động thị trường = 1,6).</li>
          </ol>
          <div className="mt-3 rounded-xl bg-white border border-slate-200 p-3 text-[13px] text-slate-600">
            <p className="font-bold text-[#0A2540]">Ví dụ: thửa 300 m² = 100 m² đất ở + 200 m² vườn</p>
            <p className="mt-1">• Đất ở (VT1 Bà Huyện Thanh Quan = 2.390.960 đ/m²): 2.390.960 × 100 = <b>239.096.000 đ</b></p>
            <p>• Vườn (cây lâu năm 54.000 đ/m²): 54.000 × 200 = <b>10.800.000 đ</b></p>
            <p className="mt-1 text-[#0A2540] font-bold">→ Tổng ≈ 249,9 triệu · bình quân 832.987 đ/m²</p>
          </div>
          <p className="text-[12px] text-slate-500 mt-2">Chuyển mục đích nông nghiệp → đất ở (vườn ao liền kề): <b>Tiền nộp = (giá đất ở − giá đất nông nghiệp) × diện tích × tỷ lệ thu</b> — 30% trong hạn mức · 50% vượt ≤1 lần · 100% vượt &gt;1 lần.</p>
        </div>

        <Acc title="🗺️ Cam Lâm sau sáp nhập — 4 xã mới">
          <p className="mb-2">Từ 01/7/2025 (Nghị quyết 1667/NQ-UBTVQH15), huyện Cam Lâm cũ được sắp xếp thành 4 xã. Bảng giá tra theo <b>tên xã mới</b>:</p>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-[13px]">
              <tbody>
                {XA_MOI.map(([m, c]) => (
                  <tr key={m} className="border-t border-slate-100 first:border-t-0 align-top">
                    <td className="py-2 px-3 font-bold text-[#0A2540] whitespace-nowrap">{m}</td>
                    <td className="py-2 px-3 text-slate-600">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Acc>

        <Acc title="📐 Xác định vị trí & hệ số (Điều 3–4)">
          <p className="font-bold text-[#0A2540] mb-1">Điều 3 — Đất nông nghiệp (2 vị trí)</p>
          <ul className="space-y-1 mb-3">
            <li>• <b>Vị trí 1:</b> thửa trong phạm vi <b>350m</b> từ mép (hoặc lề trong) quốc lộ, tỉnh lộ, hương lộ, đường liên xã, liên thôn, kênh chính hồ thủy lợi — chỉ cần một phần thửa nằm trong 350m thì <b>cả thửa</b> tính VT1. Ngoài ra VT1 còn gồm: đất trồng lúa <b>2 vụ/năm</b>; đất làm muối cách đường nội đồng ≤100m &amp; đường nội đồng ≥6m.</li>
            <li>• <b>Vị trí 2:</b> các thửa còn lại.</li>
          </ul>
          <p className="font-bold text-[#0A2540] mb-1">Điều 4 — Đất phi nông nghiệp</p>
          <p className="font-semibold text-slate-700">a) Trong xã (không ven trục): 2 khu vực × 3 vị trí</p>
          <ul className="space-y-1 mb-2">
            <li>• <b>Khu vực 1:</b> trung tâm xã/cụm xã (gần UBND, trường, chợ, trạm y tế, khu TMDV, du lịch, KCN/CCN, đầu mối giao thông…) — sinh lợi cao nhất. <b>Khu vực 2:</b> các khu vực còn lại.</li>
            <li>• <b>VT1</b> đường liên xã / đường trong xã ≥6m · <b>VT2</b> đường trong xã 3,5m–&lt;6m · <b>VT3</b> còn lại.</li>
          </ul>
          <p className="font-semibold text-slate-700">b) Ven trục chính (quốc lộ, tỉnh lộ, đại lộ, cao tốc, đường liên xã): 3 vị trí</p>
          <ul className="space-y-1 mb-2">
            <li>• <b>VT1</b> tiếp giáp trục chính (giá theo phụ lục ven trục).</li>
            <li>• <b>VT2</b> hẻm ≥3,5m &amp; cách lề trong trục &lt;100m → <b>×0,5</b> giá VT1.</li>
            <li>• <b>VT3</b> hẻm &lt;3,5m &amp; cách lề trong trục &lt;100m → <b>×0,3</b> giá VT1. Nhánh rẽ của hẻm trong cự ly 100m cũng áp VT2/VT3.</li>
          </ul>
          <p className="font-semibold text-slate-700">c) Đất ở ven trục có chiều sâu lớn (từ lề trong lộ giới):</p>
          <ul className="space-y-1 mb-2"><li>• 0–30m: giá bảng · &gt;30–60m <b>×0,6</b> · &gt;60–100m <b>×0,4</b> · &gt;100m <b>×0,3</b> (so với phần mặt tiền). Một vị trí có nhiều cách tính → áp cách cho <b>giá cao nhất</b>.</li></ul>
          <p className="font-semibold text-slate-700">d) Khu quy hoạch / dân cư / đô thị mới: 4 vị trí</p>
          <ul className="space-y-1 mb-2"><li>• VT1 đường trong khu · VT2 nội bộ 5m–&lt;8m · VT3 nội bộ 3m–&lt;5m · VT4 còn lại.</li></ul>
          <p className="font-semibold text-slate-700">đ) Đô thị (phường): mỗi đường phố 5 vị trí</p>
          <ul className="space-y-1 mb-2">
            <li>• VT1 mặt phố · VT2 hẻm ≥6m · VT3 hẻm 3,5m–&lt;6m · VT4 hẻm 2m–&lt;3,5m · VT5 hẻm &lt;2m hoặc còn lại.</li>
            <li>• <b>Đường hẹp đặc biệt:</b> đường 4–6m → VT2 hẻm ≥3,5m, VT3 hẻm 2–&lt;3,5m, VT4 hẻm &lt;2m (không VT5); đường 2–4m → VT2 hẻm ≥2m, VT3 hẻm &lt;2m (không VT4,5); đường ≤2m → VT2 nhánh rẽ hẻm (không VT3,4,5).</li>
          </ul>
          <p className="font-semibold text-slate-700">Hệ số điều chỉnh thêm:</p>
          <ul className="space-y-1">
            <li>• <b>Kmđ mặt đường = R/D</b> (R bề rộng mặt tiền, D chiều sâu). Kmđ ≥0,25: giá bảng. Kmđ &lt;0,25: phần mặt tiền tính theo Kmđ=0,25, phần còn lại <b>×0,9</b>.</li>
            <li>• VT2–5 <b>cách đường phố &gt;200m</b> → <b>×0,9</b>. · VT2–5 hẻm <b>chưa trải nhựa/bê tông</b> → <b>×0,9</b> giá đường chính cùng vị trí.</li>
          </ul>
          <p className="text-[12px] text-slate-400 mt-2">Độ rộng hẻm = mặt cắt ngang nơi hẹp nhất giữa 2 bờ tường/rào (gồm vỉa hè, cống có đan đậy), tính từ đầu hẻm đến thửa.</p>
        </Acc>

        <Acc title="⚖️ Trường hợp đặc biệt & giáp ranh (Điều 5–6)">
          <p className="font-bold text-[#0A2540] mb-1">Điều 6 — Một số trường hợp đặc biệt</p>
          <p className="mb-2 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[12px] text-amber-900"><b>Quy tắc khi có nhiều hệ số:</b> hệ số nhiều mặt tiền / giáp biển <b>đã gộp sẵn</b> — chọn đúng 1 tổ hợp, KHÔNG tự nhân từng cái. Nhiều yếu tố ảnh hưởng (KYTAHGD) hoặc nhiều cách xác định giá cho cùng vị trí → <b>lấy cao nhất</b>. Chỉ nhân giữa các nhóm KHÁC nhau: giá nền × tỷ lệ loại đất × điều chỉnh, rồi × hệ số K (= biến động thị trường × quy hoạch × yếu tố ảnh hưởng).</p>
          <ul className="space-y-1 mb-3">
            <li>• <b>2 mặt tiền</b> (2 đường hoặc 2 hẻm): lấy giá bên <b>cao hơn ×1,1</b>.</li>
            <li>• <b>2 đường + 1 hẻm</b> (hoặc 2 hẻm + 1 đường): giá cao hơn <b>×1,15</b>. <b>3 mặt tiền trở lên</b>: giá cao nhất <b>×1,2</b>.</li>
            <li>• <b>Giáp biển / sông rộng &gt;100m</b> thuận lợi: 1 mặt đường + biển <b>×1,1</b>; 2 mặt + biển <b>×1,15</b>; 3 mặt + biển <b>×1,2</b>.</li>
            <li>• <b>1 mặt đường (VT1) + 1 mặt hẻm</b> (VT2–5): giá VT1 <b>×1,05</b>.</li>
            <li>• <b>Phần đất bị che khuất</b> sau thửa mặt tiền của chủ khác (bề rộng khuất ≥2m) = <b>×0,7</b> giá mặt tiền. Thửa độc lập phía sau, lối đi riêng &lt;2m → tính giá <b>vị trí 3</b>.</li>
            <li>• <b>Không tiếp cận trực tiếp trục chính</b> (đường gom nền thấp, mương &gt;1m, đường sắt không gác chắn): <b>90%</b> giá VT1.</li>
            <li>• <b>Nền thấp trũng hơn mặt đường:</b> giảm theo tỷ lệ % quy định theo khu vực &amp; độ trũng.</li>
            <li>• <b>Chưa quy định</b> / không áp được tương đương: UBND cấp xã báo cáo UBND tỉnh quyết định.</li>
          </ul>
          <p className="font-bold text-[#0A2540] mb-1">Điều 5 — Giá đất giáp ranh</p>
          <p className="font-semibold text-slate-700">1) Giữa các đường phố / đoạn đường phố (đô thị)</p>
          <ul className="space-y-1 mb-2">
            <li>• Cùng trục chia đoạn giá khác nhau: thửa trong <b>20m</b> giáp ranh của đoạn giá thấp → tính <b>bình quân</b> giá 2 đoạn.</li>
            <li>• Đường phố giao nhau giá khác nhau: thửa trong <b>20m</b> thuộc đường giá thấp → <b>×1,1</b> (không vượt giá đường cao nhất tại nơi giao); mốc tính từ chỉ giới đường đỏ của đường có lộ giới lớn hơn.</li>
            <li>• Mặt tiếp xúc đường nằm trong phạm vi hệ số cao ≥50% bề rộng → áp cả thửa; &lt;50% → áp giá đường thấp cho cả thửa.</li>
          </ul>
          <p className="font-semibold text-slate-700">2) Giữa đô thị và nông thôn (phường ↔ xã)</p>
          <ul className="space-y-1 mb-2">
            <li>• Khu giáp ranh: từ đường phân chia địa giới vào <b>100m</b> mỗi bên (ranh là đường/sông/suối thì tính từ hành lang bảo vệ vào 100m). Ranh là sông/hồ/kênh/đồi/đèo/núi rộng &gt;100m → <b>không</b> xếp giáp ranh.</li>
            <li>• Thửa bên có giá thấp = <b>trung bình cộng</b> giá 2 khu.</li>
          </ul>
          <p className="font-semibold text-slate-700">3) Ven trục chính ở nông thôn (đoạn giá khác nhau)</p>
          <ul className="space-y-1">
            <li>• Thửa trong <b>50m</b> của đoạn giá thấp (từ điểm tiếp giáp 2 đoạn) = <b>trung bình cộng</b> giá 2 đoạn. Thửa chỉ một phần trong 50m → cả thửa áp giá giáp ranh.</li>
          </ul>
        </Acc>

        <Acc title="🏷️ Tỷ lệ loại đất & giá KCN (Điều 8–9)">
          <ul className="space-y-1">
            <li>• Đất thương mại – dịch vụ = <b>80%</b> giá đất ở cùng vị trí.</li>
            <li>• Đất sản xuất, kinh doanh phi nông nghiệp = <b>60%</b> giá đất ở.</li>
            <li>• Đất trụ sở / tôn giáo / nghĩa trang = <b>100%</b> giá đất ở.</li>
            <li>• Đất công trình sự nghiệp: chưa tự chủ 100% · tự chủ tài chính 60%.</li>
            <li>• Đất sông, ngòi, mặt nước (dùng phi nông nghiệp) = 60% giá đất ở.</li>
            <li>• Đất công cộng <b>có mục đích kinh doanh</b> (giao thông, thủy lợi, chợ, năng lượng, bưu chính…) = <b>60%</b> giá đất ở (Điều 9.3).</li>
            <li>• Đất <b>phi nông nghiệp khác</b> (kho nông sản, lán trại người lao động…) = <b>60%</b> (Điều 9.7).</li>
            <li>• Đất <b>nghĩa trang</b>: ngoài khu dân cư = giá nông nghiệp liền kề; xen kẽ khu dân cư = 60% giá đất ở (Điều 9.8).</li>
          </ul>
          <div className="mt-3 rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-500 uppercase">Giá KCN/CCN vùng Cam Lâm — SXKD (đồng/m²)</div>
            <table className="w-full text-[13px]"><tbody>
              {[['KCN Suối Dầu (xã Cam Lâm)', '≈ 415.860 *'], ['CCN Trảng É 1 (Suối Dầu & Cam Lâm)', '234.000'], ['CCN Trảng É 2 (Suối Dầu & Cam Lâm)', '234.000']].map(([n, g]) => (
                <tr key={n} className="border-t border-slate-100"><td className="py-1.5 px-3 text-slate-600">{n}</td><td className="py-1.5 px-3 text-right font-bold text-[#0A2540] whitespace-nowrap">{g}</td></tr>
              ))}
            </tbody></table>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">* Số đã đính chính (QĐ 09/QĐ-TT). Giá TMDV các KCN = giá SXKD × 4/3 (≈133%).</p>
        </Acc>

        <Acc title="📊 Hệ số điều chỉnh K (Quyết định 50/2026/QĐ-UBND)">
          <p className="mb-2">Áp cho tính tiền sử dụng đất, bồi thường, giá khởi điểm đấu giá… (khoản 1 Điều 7 NQ 254/2025/QH15), <b>hiệu lực 01/7/2026</b>. Giá tính = <b>giá theo bảng giá × hệ số điều chỉnh</b>, với <b>hệ số điều chỉnh giá đất = Hệ số biến động thị trường × Hệ số quy hoạch × Hệ số yếu tố ảnh hưởng</b>.</p>
          <ul className="space-y-1">
            <li>• <b>Hệ số biến động thị trường</b>: 4 xã Cam Lâm / Suối Dầu / Cam Hiệp / Cam An thuộc Khu vực 1 (các xã) = <b>1,6</b>; phường Khu vực 1 = 1,5; xã Khu vực 2 = 1,3; phường Khu vực 2 = 1,2.</li>
            <li>• <b>Hệ số quy hoạch</b> (theo hệ số sử dụng đất): &lt;7 lần = 1,00 · 7–&lt;9 = 1,05 · 9–&lt;11 = 1,10 · 11–13 = 1,15 · &gt;13 lần → định giá cụ thể.</li>
            <li>• <b>Hệ số yếu tố ảnh hưởng</b>: đất phi nông nghiệp = 1,0 · đất nông nghiệp cùng thửa có nhà ở (không phải đất ở) = 1,5 · đất nông nghiệp vị trí 1 giáp Quốc lộ 1 / tỉnh lộ / đường liên xã / liên phường = 1,3 (nhiều hệ số → lấy cao nhất).</li>
          </ul>
          <p className="text-[12px] text-slate-400 mt-2">Hệ số điều chỉnh hiện sẵn ở <b>từng phần đất</b> trong công cụ Định giá bên trên.</p>
        </Acc>

        <Acc title="📏 Hạn mức đất (Quyết định 28/2024/QĐ-UBND)">
          <p className="font-bold text-[#0A2540] mb-1">Hạn mức giao đất ở (Điều 3)</p>
          <ul className="space-y-1 mb-3">
            <li>• Phường (Nha Trang, Cam Ranh, Ninh Hòa): <b>150 m²</b>.</li>
            <li>• Thị trấn cũ Diên Khánh, Vạn Ninh, Cam Đức (nay thuộc Cam Lâm): <b>180 m²</b>.</li>
            <li>• Thị trấn cũ Khánh Sơn, Khánh Vĩnh: <b>200 m²</b>.</li>
            <li>• <b>Xã đồng bằng</b> (4 xã Cam Lâm / Suối Dầu / Cam Hiệp / Cam An): <b>400 m²</b>. Xã miền núi / hải đảo: <b>1.000 m²</b>.</li>
          </ul>
          <p className="font-bold text-[#0A2540] mb-1">Hạn mức công nhận đất ở (Điều 4)</p>
          <ul className="space-y-1">
            <li>• Thửa hình thành <b>trước 18/12/1980</b>: bằng <b>5 lần</b> hạn mức giao đất ở (không quá diện tích thửa).</li>
            <li>• Từ 18/12/1980 – trước 15/10/1993: phường 300 · TT Cam Đức/Diên Khánh/Vạn Ninh 360 · TT Khánh Sơn/Khánh Vĩnh 400 · xã Khánh Sơn/Khánh Vĩnh &amp; hải đảo 500 · các xã còn lại <b>400 m²</b>.</li>
          </ul>
          <p className="text-[12px] text-slate-400 mt-2">Hạn mức nông nghiệp (Điều 5): cây hàng năm/NTTS/muối ≤ 2 ha; cây lâu năm ≤ 10 ha (đồng bằng) / 30 ha (miền núi); rừng SX/phòng hộ ≤ 30 ha. Hạn mức nhận chuyển QSDĐ: 10–15 lần hạn mức giao.</p>
        </Acc>

        <p className="text-[12px] text-slate-500 bg-amber-50 border border-amber-200 rounded-xl p-3">⚠️ Giá đất là số liệu pháp lý, có bản đính chính &amp; cập nhật (bản 27/5/2026) và <b>hệ số K (QĐ 50/2026, từ 01/7/2026)</b>. Luôn đối chiếu Quyết định/CSDL giá đất hiện hành của tỉnh trước khi tính nghĩa vụ tài chính.</p>
      </div>

    </div>
    <div className="mx-auto max-w-7xl px-3 sm:px-6 pb-6 sm:pb-8">
      <ServicesSection className="mt-6 sm:mt-8" />
      <LegalConsultCTA topic="Dịch vụ pháp lý (từ Bảng giá đất)" className="mt-4" />
    </div>
    </>
  );
}
