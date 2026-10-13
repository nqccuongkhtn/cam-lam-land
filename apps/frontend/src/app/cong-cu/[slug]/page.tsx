import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SiteFooter from '@/components/SiteFooter';
import { ldJson } from '@/lib/jsonld';
import { SITE } from '@/lib/tenMien';
import { CONG_CU, CONG_CU_THEO_SLUG, CONG_CU_RIENG } from '@/lib/congCu';

// TRANG ĐÍCH TỪNG CÔNG CỤ (13/10/2026) — xem lib/congCu.ts. Dữ liệu tĩnh → dựng sẵn hết lúc đóng gói.
export const dynamicParams = false;
export function generateStaticParams() { return CONG_CU.map((c) => ({ slug: c.slug })); }

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const c = CONG_CU_THEO_SLUG.get(params.slug);
  if (!c) return { title: 'Công cụ nhà đất' };
  const url = `/cong-cu/${c.slug}`;
  return {
    title: c.title, description: c.description, keywords: c.tuKhoa,
    alternates: { canonical: url },
    openGraph: { type: 'website', title: c.title, description: c.description, url: `${SITE}${url}`, images: [{ url: '/icons/icon-512.png' }] },
  };
}

export default function Page({ params }: { params: { slug: string } }) {
  const c = CONG_CU_THEO_SLUG.get(params.slug);
  if (!c) notFound();
  const url = `/cong-cu/${c.slug}`;
  const khac = CONG_CU.filter((x) => x.slug !== c.slug);
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'Công cụ nhà đất', item: `${SITE}/cong-cu` },
        { '@type': 'ListItem', position: 3, name: c.ten, item: `${SITE}${url}` },
      ] },
      { '@type': 'WebApplication', name: c.h1, url: `${SITE}${url}`, applicationCategory: 'BusinessApplication', operatingSystem: 'Web', inLanguage: 'vi',
        description: c.description, featureList: c.tinhNang.join('; ') },
      { '@type': 'FAQPage', mainEntity: c.hoiDap.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    ],
  };
  const h2 = 'text-[17px] sm:text-lg font-bold text-[#0A2540]';
  const chip = 'rounded-full bg-slate-100 px-3 py-1.5 text-[13px] text-slate-700 hover:bg-[#C8A14B]/20';
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(ld) }} />
      <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4 sm:py-7">
        <nav aria-label="Đường dẫn" className="mb-3 flex flex-wrap items-center gap-1 text-[12px] text-slate-500">
          <Link href="/" className="hover:text-[#C8A14B]">Trang chủ</Link><span>›</span>
          <Link href="/cong-cu" className="hover:text-[#C8A14B]">Công cụ nhà đất</Link><span>›</span>
          <span className="font-medium text-slate-700">{c.ten}</span>
        </nav>
        <h1 className="text-2xl font-extrabold leading-tight text-[#0A2540] sm:text-3xl">{c.h1}</h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">{c.gioiThieu}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link href={c.href} className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A2540] px-5 py-2.5 text-[14px] font-bold text-white hover:bg-[#0d2f54]">Mở công cụ →</Link>
          {c.canDangNhap && <span className="text-[12.5px] text-slate-500">Cần đăng nhập tài khoản Cam Lâm Land (đăng ký miễn phí).</span>}
        </div>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className={h2}>Làm được gì</h2>
          <ul className="mt-2 space-y-1.5 text-[14px] leading-relaxed text-slate-700">
            {c.tinhNang.map((t, i) => <li key={i} className="flex gap-2"><span className="mt-[3px] text-emerald-600">✓</span><span>{t}</span></li>)}
          </ul>
        </section>

        <section className="mt-5">
          <h2 className={h2}>Cách dùng</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[14px] leading-relaxed text-slate-600">
            {c.cacBuoc.map((b, i) => <li key={i}>{b}</li>)}
          </ol>
        </section>

        {c.luuY && <p className="mt-4 rounded-xl border-l-4 border-[#C8A14B] bg-amber-50/60 p-3 text-[13.5px] leading-relaxed text-slate-700">{c.luuY}</p>}

        <section className="mt-6">
          <h2 className={h2}>Câu hỏi thường gặp</h2>
          <div className="mt-3 space-y-2.5">
            {c.hoiDap.map((f, i) => (
              <details key={i} className="group rounded-xl border border-slate-200 bg-white p-4" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold text-[#0A2540]">{f.q}<span className="text-[#C8A14B] transition group-open:rotate-45">＋</span></summary>
                <p className="mt-2 text-[14px] leading-relaxed text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="mt-6 text-center">
          <Link href={c.href} className="inline-flex items-center gap-1.5 rounded-xl bg-[#C8A14B] px-5 py-2.5 text-[14px] font-extrabold text-[#0A2540]">Mở {c.ten} →</Link>
        </div>

        <section className="mt-6 border-t border-slate-200 pt-5">
          <h3 className="mb-2 text-[15px] font-bold text-[#0A2540]">Công cụ khác</h3>
          <div className="flex flex-wrap gap-2">
            {CONG_CU_RIENG.map((x) => <Link key={x.href} href={x.href} className={chip}>{x.ten}</Link>)}
            {khac.map((x) => <Link key={x.slug} href={`/cong-cu/${x.slug}`} className={chip}>{x.ten}</Link>)}
          </div>
        </section>
      </div>
      <SiteFooter />
    </>
  );
}
