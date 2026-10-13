import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import { ldJson } from '@/lib/jsonld';
import { SITE } from '@/lib/tenMien';
import { CONG_CU, CONG_CU_RIENG } from '@/lib/congCu';

// TRANG TỔNG CÔNG CỤ (13/10/2026) — bản công khai của Tiện ích (Tiện ích phải đăng nhập), để Google đọc được và dẫn khách vào
// từng trang đích /cong-cu/<slug>. Xem lib/congCu.ts.
const TITLE = 'Công cụ nhà đất miễn phí: bản đồ quy hoạch, tọa độ VN2000, số tờ bản đồ';
const DESC = 'Bộ công cụ nhà đất của Cam Lâm Land: tra cứu quy hoạch, chuyển tọa độ VN2000, tra số tờ bản đồ sau sáp nhập, đọc sổ đỏ, mẫu hợp đồng đặt cọc, tạo video bản đồ, chỉnh sửa PDF.';
export const metadata: Metadata = {
  title: TITLE, description: DESC,
  alternates: { canonical: '/cong-cu' },
  openGraph: { type: 'website', title: TITLE, description: DESC, url: `${SITE}/cong-cu`, images: [{ url: '/icons/icon-512.png' }] },
};

export default function Page() {
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'Công cụ nhà đất', item: `${SITE}/cong-cu` },
      ] },
      { '@type': 'ItemList', itemListElement: [
        ...CONG_CU_RIENG.map((x) => ({ name: x.ten, url: `${SITE}${x.href}` })),
        ...CONG_CU.map((c) => ({ name: c.ten, url: `${SITE}/cong-cu/${c.slug}` })),
      ].map((x, i) => ({ '@type': 'ListItem', position: i + 1, ...x })) },
    ],
  };
  const the = 'block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-[#C8A14B]';
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(ld) }} />
      <div className="mx-auto max-w-4xl px-3 py-5 sm:px-4 sm:py-7">
        <nav aria-label="Đường dẫn" className="mb-3 flex flex-wrap items-center gap-1 text-[12px] text-slate-500">
          <Link href="/" className="hover:text-[#C8A14B]">Trang chủ</Link><span>›</span><span className="font-medium text-slate-700">Công cụ nhà đất</span>
        </nav>
        <h1 className="text-2xl font-extrabold leading-tight text-[#0A2540] sm:text-3xl">Công cụ nhà đất miễn phí</h1>
        <p className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-slate-600">
          Các công cụ Cam Lâm Land làm cho người mua bán đất, môi giới và cán bộ địa chính ở Khánh Hòa. Phần lớn chỉ cần đăng ký tài khoản
          miễn phí; chuyển tọa độ VN-2000 và bản đồ 65 xã, phường dùng ngay không cần đăng nhập.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {CONG_CU_RIENG.map((x) => (
            <Link key={x.href} href={x.href} className={the}>
              <p className="text-[15px] font-bold text-[#0A2540]">{x.ten}</p>
              <p className="mt-1 text-[13px] leading-snug text-slate-600">{x.moTa}</p>
            </Link>
          ))}
          {CONG_CU.map((c) => (
            <Link key={c.slug} href={`/cong-cu/${c.slug}`} className={the}>
              <p className="text-[15px] font-bold text-[#0A2540]">{c.ten}</p>
              <p className="mt-1 text-[13px] leading-snug text-slate-600">{c.description}</p>
            </Link>
          ))}
        </div>
        <p className="mt-6 text-[13.5px] text-slate-600">Đã có tài khoản? Mở thẳng <Link href="/tien-ich" className="font-semibold text-[#0A2540] underline">Tiện ích</Link> để dùng mọi công cụ trong một chỗ.</p>
      </div>
      <SiteFooter />
    </>
  );
}
