'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface N { title: string; url: string; source?: string; image?: string; summary?: string; publishedAt?: string; slug: string }

export default function NewsIndex() {
  const [news, setNews] = useState<N[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch('/feed/news').then((r) => r.json()).then((d) => setNews(d.news || [])).catch(() => {}).finally(() => setLoading(false)); }, []);

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-56px)]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-xs text-slate-400 mb-2"><Link href="/" className="hover:text-[#0A2540]">Trang chủ</Link> › <span className="text-slate-600">Tin tức thị trường</span></div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-[#0A2540]">Tin tức thị trường bất động sản</h1>
        <p className="text-slate-500 mt-1 text-sm">Tổng hợp từ nguồn uy tín: VnExpress, CafeF, Báo Xây dựng — cập nhật tự động.</p>

        {loading ? (
          <p className="text-slate-400 mt-10">Đang tải tin…</p>
        ) : news.length === 0 ? (
          <p className="text-slate-400 mt-10">Chưa có tin. Vui lòng quay lại sau.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
            {news.map((n) => {
              const date = n.publishedAt ? new Date(n.publishedAt).toLocaleDateString('vi-VN') : '';
              return (
                <Link key={n.slug} href={`/tin-tuc/${n.slug}`} className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg hover:border-slate-300 transition flex flex-col">
                  <div className="aspect-[16/10] bg-slate-100 overflow-hidden">
                    {n.image && <img src={n.image} alt={n.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />}
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-bold text-[#0A2540] leading-snug line-clamp-3 group-hover:text-red-600">{n.title}</h3>
                    {n.summary && <p className="text-sm text-slate-500 mt-2 line-clamp-2 flex-1">{n.summary}</p>}
                    <p className="text-xs text-slate-400 mt-3">{n.source}{n.source && date ? ' · ' : ''}{date}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
