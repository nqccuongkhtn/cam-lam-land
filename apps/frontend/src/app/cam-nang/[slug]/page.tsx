import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GUIDES, getGuide } from '../guides';
import ShareRow from '@/components/ShareRow';
import LegalConsultCTA from '@/components/LegalConsultCTA';

import { ldJson } from '@/lib/jsonld';
export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const g = getGuide(params.slug);
  if (!g) return { title: 'Không tìm thấy bài viết' };
  return {
    title: g.title, description: g.desc,
    alternates: { canonical: `/cam-nang/${g.slug}` },
    openGraph: { type: 'article', url: `/cam-nang/${g.slug}`, title: g.title, description: g.desc, images: ['/icons/icon-512.png'] },
    twitter: { card: 'summary_large_image', title: g.title, description: g.desc, images: ['/icons/icon-512.png'] },
  };
}

export default function GuidePage({ params }: { params: { slug: string } }) {
  const g = getGuide(params.slug);
  if (!g) notFound();

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: g.title,
    description: g.desc,
    inLanguage: 'vi-VN',
    author: { '@type': 'Organization', name: 'Cam Lâm Land' },
    publisher: { '@type': 'Organization', name: 'Cam Lâm Land' },
  };

  const others = GUIDES.filter((x) => x.slug !== g.slug).slice(0, 3);

  return (
    <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4 sm:py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(jsonld) }} />
      <nav className="text-sm text-slate-400 mb-3">
        <Link href="/cam-nang" className="hover:text-[#0A2540]">Cẩm nang</Link> <span className="mx-1">/</span> <span className="text-slate-500">{g.title}</span>
      </nav>

      <article>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0A2540] leading-tight">{g.title}</h1>
        <p className="text-sm sm:text-base text-slate-600 mt-3 leading-relaxed">{g.intro}</p>

        {g.body.map((b, i) => (
          <section key={i} className="mt-5">
            <h2 className="text-lg font-bold text-[#0A2540] mb-2">{b.h}</h2>
            {b.p && <p className="text-sm sm:text-base text-slate-600 leading-relaxed">{b.p}</p>}
            {b.list && (
              <ul className="mt-1 space-y-1.5">
                {b.list.map((it, j) => (
                  <li key={j} className="flex gap-2 text-slate-600"><span className="text-[#C8A14B] font-bold shrink-0">•</span><span>{it}</span></li>
                ))}
              </ul>
            )}
            {b.links && (
              <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                {b.links.map(([ten, url]) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-[#0A2540] hover:border-[#C8A14B] hover:text-red-600">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-slate-100 text-xs">{/youtu/.test(url) ? '▶' : 'PDF'}</span>{ten}
                  </a>
                ))}
              </div>
            )}
          </section>
        ))}
      </article>

      <div className="mt-5 sm:mt-6 flex items-center justify-between gap-3 flex-wrap border-t border-slate-100 pt-4">
        <p className="text-[13px] text-slate-500 font-semibold">Thấy hữu ích? Gửi cho người đang cần mua/bán đất:</p>
        <ShareRow title={g.title} />
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-6">
        <p className="text-[13px] text-amber-800/90">Nội dung mang tính tham khảo, hướng dẫn chung; quy định pháp luật có thể thay đổi (đặc biệt theo Luật Đất đai 2024). Vui lòng đối chiếu quy định hiện hành hoặc hỏi cơ quan chức năng trước khi thực hiện.</p>
      </div>

      {/* CTA để lại SĐT — đặt ĐÚNG KHOẢNH KHẮC: khách vừa đọc xong bài hướng dẫn pháp lý */}
      <LegalConsultCTA topic={g.title} className="mt-6" />

      {others.length > 0 && (
        <div className="mt-6 sm:mt-8">
          <h2 className="font-bold text-[#0A2540] mb-2">Bài viết khác</h2>
          <ul className="space-y-1.5">
            {others.map((o) => (
              <li key={o.slug}><Link href={`/cam-nang/${o.slug}`} className="text-[#0A2540] hover:text-[#C8A14B] font-semibold text-sm">→ {o.title}</Link></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
