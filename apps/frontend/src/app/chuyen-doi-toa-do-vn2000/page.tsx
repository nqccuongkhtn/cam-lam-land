import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import { ldJson } from '@/lib/jsonld';
import { SITE } from '@/lib/tenMien';
import ChuyenDoiToaDo from './ChuyenDoiToaDo';

// TRANG ĐÍCH CÔNG CỤ (13/10/2026): "chuyển tọa độ VN2000 sang WGS84" — chủ dự án: mỗi công cụ một trang đích nhắm một cụm từ khoá
// (học từ qhviet.com). Khác qhviet: công cụ chạy thật ngay trên trang, có hướng dẫn + hỏi đáp trong HTML (Google đọc được).
const TITLE = 'Chuyển tọa độ VN2000 sang WGS84 (Google Maps) – Khánh Hòa, xem vị trí sổ đỏ';
const DESC = 'Đổi tọa độ VN-2000 trên sổ đỏ (kinh tuyến trục 108°15′ Khánh Hòa, Ninh Thuận) sang kinh độ, vĩ độ WGS84 để xem vị trí thửa đất trên Google Maps, và đổi ngược lại. Dán cả bảng tọa độ, tự tính diện tích. Miễn phí, không cần đăng nhập.';
const URL = '/chuyen-doi-toa-do-vn2000';

export const metadata: Metadata = {
  title: TITLE, description: DESC,
  keywords: ['chuyển tọa độ VN2000 sang WGS84', 'đổi tọa độ VN2000 sang Google Map', 'xem vị trí sổ đỏ trên Google Map', 'kinh tuyến trục Khánh Hòa', 'tọa độ VN2000 Khánh Hòa', 'chuyển đổi tọa độ sổ đỏ'],
  alternates: { canonical: URL },
  openGraph: { type: 'website', title: TITLE, description: DESC, url: `${SITE}${URL}`, images: [{ url: '/icons/icon-512.png' }] },
};

const HOI = [
  { q: 'Tọa độ trên sổ đỏ ở Khánh Hòa là hệ gì?',
    a: 'Là hệ tọa độ quốc gia VN-2000, phép chiếu UTM múi 3°, kinh tuyến trục 108°15′ (dùng chung cho Khánh Hòa và Ninh Thuận cũ), hệ số k = 0,9999. Google Maps dùng hệ WGS84 (kinh độ, vĩ độ) nên phải chuyển đổi mới đặt đúng vị trí.' },
  { q: 'Trên sổ đỏ, X và Y cái nào là kinh độ, vĩ độ?',
    a: 'Trên sổ đỏ, X là tọa độ theo hướng Bắc (ở Khánh Hòa khoảng 1.250.000–1.450.000 m), Y là tọa độ theo hướng Đông (khoảng 550.000–650.000 m). X tương ứng vĩ độ, Y tương ứng kinh độ. Công cụ tự nhận theo độ lớn của số nên dán đảo cột vẫn đúng.' },
  { q: 'Chuyển đổi có chính xác không?',
    a: 'Công cụ dùng đúng 7 tham số chuyển đổi giữa VN-2000 và WGS84 theo Quyết định 05/2007/QĐ-BTNMT và phép chiếu UTM của kinh tuyến trục 108°15′, sai số cỡ dưới 1 m — đủ để xác định vị trí thửa đất. Hình nền vệ tinh của Google có thể lệch vài mét so với thực địa.' },
  { q: 'Làm sao xem vị trí thửa đất của sổ đỏ trên bản đồ?',
    a: 'Dán bảng tọa độ các góc thửa (in ở trang sơ đồ của sổ đỏ) vào ô bên trên, bấm "Mở trên Google Maps" hoặc "Xem thửa trên bản đồ Cam Lâm Land" — bản đồ của Cam Lâm Land còn có ranh thửa địa chính, số tờ, số thửa và quy hoạch (khu vực Cam Lâm).' },
  { q: 'Tỉnh khác (không phải Khánh Hòa) dùng được không?',
    a: 'Công cụ này cài sẵn kinh tuyến trục 108°15′ của Khánh Hòa và Ninh Thuận cũ. Tỉnh có kinh tuyến trục khác (vd Bình Thuận, Phú Yên 108°30′; Lâm Đồng 107°45′) sẽ cho kết quả lệch, cần công cụ đặt đúng kinh tuyến trục của tỉnh đó.' },
];

export default function Page() {
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'Chuyển tọa độ VN2000 sang WGS84', item: `${SITE}${URL}` },
      ] },
      { '@type': 'WebApplication', name: 'Chuyển đổi tọa độ VN-2000 ↔ WGS84 (Khánh Hòa)', url: `${SITE}${URL}`, applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Web', inLanguage: 'vi', offers: { '@type': 'Offer', price: 0, priceCurrency: 'VND' } },
      { '@type': 'FAQPage', mainEntity: HOI.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    ],
  };
  const h2 = 'text-[17px] sm:text-lg font-bold text-[#0A2540]';
  const chip = 'rounded-full bg-slate-100 px-3 py-1.5 text-[13px] text-slate-700 hover:bg-[#C8A14B]/20';
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(ld) }} />
      <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4 sm:py-7">
        <nav aria-label="Đường dẫn" className="mb-3 flex flex-wrap items-center gap-1 text-[12px] text-slate-500">
          <Link href="/" className="hover:text-[#C8A14B]">Trang chủ</Link><span>›</span><span className="font-medium text-slate-700">Chuyển tọa độ VN2000</span>
        </nav>
        <h1 className="text-2xl font-extrabold leading-tight text-[#0A2540] sm:text-3xl">Chuyển tọa độ VN-2000 sang WGS84 – Khánh Hòa</h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">
          Đổi tọa độ in trên sổ đỏ (hệ VN-2000, kinh tuyến trục 108°15′ của Khánh Hòa) sang vĩ độ, kinh độ WGS84 để <b>xem vị trí thửa đất trên
          Google Maps</b> — và đổi ngược lại. Dán nguyên bảng tọa độ, công cụ tự nhận số hiệu điểm, X, Y và tính luôn diện tích để đối chiếu với sổ.
        </p>

        <div className="mt-4"><ChuyenDoiToaDo /></div>

        <section className="mt-6">
          <h2 className={h2}>Cách dùng</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[14px] leading-relaxed text-slate-600">
            <li>Mở trang sơ đồ thửa đất trên sổ đỏ, tìm <b>bảng tọa độ</b> các điểm góc thửa (cột Số hiệu điểm, X, Y).</li>
            <li>Gõ hoặc dán từng dòng vào ô <b>VN-2000 → WGS84</b> (chép từ Excel, Zalo, ảnh đã nhận chữ đều được).</li>
            <li>Kết quả hiện ngay: vĩ độ, kinh độ từng điểm, diện tích và chiều dài từng cạnh.</li>
            <li>Bấm <b>Mở trên Google Maps</b> hoặc <b>Xem thửa trên bản đồ Cam Lâm Land</b> để thấy vị trí thật của thửa đất.</li>
          </ol>
          <p className="mt-2 text-[13px] text-slate-500">Có ảnh chụp bảng tọa độ? Trên <Link href="/map" className="font-semibold text-[#0A2540] underline">Bản đồ</Link> có chức năng đọc ảnh bảng tọa độ và vẽ thẳng thửa đất lên bản đồ.</p>
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className={h2}>Thông số hệ tọa độ VN-2000 của Khánh Hòa</h2>
          <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-[14px]">
            <dt className="text-slate-500">Hệ quy chiếu</dt><dd className="text-slate-800">VN-2000 (elipxoit WGS84)</dd>
            <dt className="text-slate-500">Phép chiếu</dt><dd className="text-slate-800">UTM, múi chiếu 3°</dd>
            <dt className="text-slate-500">Kinh tuyến trục</dt><dd className="font-semibold text-[#0A2540]">108°15′ (Khánh Hòa, Ninh Thuận cũ)</dd>
            <dt className="text-slate-500">Hệ số tỷ lệ</dt><dd className="text-slate-800">k₀ = 0,9999</dd>
            <dt className="text-slate-500">Dịch về phía Đông</dt><dd className="text-slate-800">500.000 m</dd>
            <dt className="text-slate-500">Chuyển sang WGS84</dt><dd className="text-slate-800">7 tham số theo Quyết định 05/2007/QĐ-BTNMT</dd>
          </dl>
        </section>

        <section className="mt-6">
          <h2 className={h2}>Câu hỏi thường gặp</h2>
          <div className="mt-3 space-y-2.5">
            {HOI.map((f, i) => (
              <details key={i} className="group rounded-xl border border-slate-200 bg-white p-4" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold text-[#0A2540]">{f.q}<span className="text-[#C8A14B] transition group-open:rotate-45">＋</span></summary>
                <p className="mt-2 text-[14px] leading-relaxed text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-6 border-t border-slate-200 pt-5">
          <h3 className="mb-2 text-[15px] font-bold text-[#0A2540]">Công cụ liên quan</h3>
          <div className="flex flex-wrap gap-2">
            <Link href="/map" className={chip}>🗺️ Bản đồ quy hoạch, thửa đất</Link>
            <Link href="/ban-do" className={chip}>📍 Bản đồ 65 xã, phường Khánh Hòa</Link>
            <Link href="/tra-so-ban-do" className={chip}>🔢 Tra số tờ bản đồ mới ↔ cũ</Link>
            <Link href="/bang-gia-dat" className={chip}>📊 Bảng giá đất Khánh Hòa</Link>
          </div>
        </section>
      </div>
      <SiteFooter />
    </>
  );
}
