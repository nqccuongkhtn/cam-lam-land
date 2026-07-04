import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GUIDES, getGuide } from '../guides';

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const g = getGuide(params.slug);
  if (!g) return { title: 'Không tìm thấy bài viết' };
  return { title: g.title, description: g.desc, alternates: { canonical: `/cam-nang/${g.slug}` } };
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
    <div className="mx-auto max-w-3xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
      <nav className="text-sm text-slate-400 mb-3">
        <Link href="/cam-nang" className="hover:text-[#0A2540]">Cẩm nang</Link> <span className="mx-1">/</span> <span className="text-slate-500">{g.title}</span>
      </nav>

      <article>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0A2540] leading-tight">{g.title}</h1>
        <p className="text-slate-600 mt-3 leading-relaxed">{g.intro}</p>

        {g.body.map((b, i) => (
          <section key={i} className="mt-5">
            <h2 className="text-lg font-bold text-[#0A2540] mb-2">{b.h}</h2>
            {b.p && <p className="text-slate-600 leading-relaxed">{b.p}</p>}
            {b.list && (
              <ul className="mt-1 space-y-1.5">
                {b.list.map((it, j) => (
                  <li key={j} className="flex gap-2 text-slate-600"><span className="text-[#C8A14B] font-bold shrink-0">•</span><span>{it}</span></li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </article>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-6">
        <p className="text-[13px] text-amber-800/90">Nội dung mang tính tham khảo, hướng dẫn chung; quy định pháp luật có thể thay đổi (đặc biệt theo Luật Đất đai 2024). Vui lòng đối chiếu quy định hiện hành hoặc hỏi cơ quan chức năng trước khi thực hiện.</p>
      </div>

      {/* Công cụ liên quan */}
      <div className="grid sm:grid-cols-2 gap-3 mt-6">
        <Link href="/qr" className="bg-white border border-slate-200 rounded-xl p-4 hover:border-[#C8A14B]">
          <p className="font-bold text-[#0A2540] text-sm">🔎 Tra cứu QR &amp; kiểm tra sổ</p>
          <p className="text-xs text-slate-500 mt-1">Quét mã QR trên sổ để đối chiếu thông tin xác thực.</p>
        </Link>
        <Link href="/map" className="bg-white border border-slate-200 rounded-xl p-4 hover:border-[#C8A14B]">
          <p className="font-bold text-[#0A2540] text-sm">🗺️ Bản đồ quy hoạch</p>
          <p className="text-xs text-slate-500 mt-1">Kiểm tra quy hoạch, vẽ ranh thửa từ toạ độ VN-2000.</p>
        </Link>
      </div>

      {others.length > 0 && (
        <div className="mt-8">
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
