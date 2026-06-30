'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Article { title: string; url: string; source?: string; image?: string; images?: string[]; summary?: string; body?: string; publishedAt?: string; slug: string }

export default function NewsReaderClient() {
  const { id } = useParams<{ id: string }>();
  const slug = id ? decodeURIComponent(id) : '';
  const [a, setA] = useState<Article | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch('/feed/news').then((r) => r.json()).then((d) => { setA((d.news || []).find((x: any) => x.slug === slug) || null); }).catch(() => {}).finally(() => setDone(true));
  }, [slug]);

  if (!done) return <div className="mx-auto max-w-5xl p-12 text-center text-slate-400">Đang tải…</div>;

  if (!a) return (
    <div className="mx-auto max-w-5xl px-4 py-16 text-center">
      <p className="text-5xl">🗞️</p>
      <p className="text-lg font-bold text-[#0A2540] mt-3">Bài viết không còn được lưu</p>
      <p className="text-slate-500 mt-1 text-sm">Tin tức chỉ được lưu trong 7 ngày.</p>
      <div className="mt-5"><Link href="/tin-tuc" className="text-sm font-semibold text-red-600">← Tất cả tin tức</Link></div>
    </div>
  );

  const date = a.publishedAt ? new Date(a.publishedAt).toLocaleDateString('vi-VN') : '';

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-56px)]">
      <article className="mx-auto max-w-5xl px-4 py-8">
        <div className="text-xs text-slate-400 mb-3"><Link href="/" className="hover:text-[#0A2540]">Trang chủ</Link> › <Link href="/tin-tuc" className="hover:text-[#0A2540]">Tin tức</Link> › <span className="text-slate-600">Bài viết</span></div>

        <h1 className="text-2xl md:text-3xl font-extrabold text-[#0A2540] leading-tight">{a.title}</h1>
        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-sm text-slate-400 mt-3">
          <span className="font-semibold text-[#0A2540]">Cam Lâm Land</span>
          {date && <span>· 🕒 {date}</span>}
          <span className="ml-auto text-[11px] bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">Biên tập</span>
        </div>

        {(() => { const hero = (a.images && a.images[0]) || a.image; return hero ? <img src={hero} alt={a.title} className="w-full rounded-2xl mt-5 bg-slate-100 object-cover max-h-[460px]" /> : null; })()}

        {(a.body || a.summary) && (() => {
          const paras = String(a.body || a.summary).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
          const extra = (a.images || []).slice(1);
          const out: any[] = []; let ip = 0;
          paras.forEach((para, i) => {
            out.push(<p key={'p' + i}>{para}</p>);
            if ((i + 1) % 2 === 0 && ip < extra.length) { const src = extra[ip++]; out.push(<img key={'i' + i} src={src} alt="" className="w-full rounded-2xl bg-slate-100 object-cover max-h-[440px] my-1" />); }
          });
          return <div className="mt-5 text-slate-700 leading-relaxed text-[18px] space-y-4">{out}</div>;
        })()}

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">Bài do Cam Lâm Land biên tập, dựa trên thông tin từ <b>{a.source || 'báo chí'}</b>. Xem bản gốc đầy đủ tại nguồn:</p>
          <a href={a.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 bg-[#0A2540] hover:bg-[#0d2f54] text-white font-bold px-5 py-2.5 rounded-xl">Đọc bản gốc tại {a.source || 'nguồn'} →</a>
          <p className="text-[11px] text-slate-400 mt-3">Nguồn: <a href={a.url} target="_blank" rel="noreferrer" className="underline break-all hover:text-[#0A2540]">{a.url}</a></p>
        </div>

        <div className="mt-6"><Link href="/tin-tuc" className="text-sm font-semibold text-red-600 hover:text-red-700">← Tất cả tin tức</Link></div>
      </article>
    </div>
  );
}
