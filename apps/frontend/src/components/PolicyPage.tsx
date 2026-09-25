import Link from 'next/link';
import type { ReactNode } from 'react';

export default function PolicyPage({ title, updated, intro, sections }: { title: string; updated?: string; intro?: string; sections: { h: string; body: ReactNode }[] }) {
  return (
    <div className="bg-slate-50 min-h-[calc(100dvh-56px)]">
      <div className="max-w-3xl mx-auto px-3 py-5 sm:px-4 sm:py-8">
        <div className="text-xs text-slate-400 mb-3"><Link href="/" className="hover:text-[#0B4045]">Trang chủ</Link> › <span className="text-slate-600">{title}</span></div>
        <article className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 md:p-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[#0B4045]">{title}</h1>
          {updated ? <p className="text-xs text-slate-400 mt-2">Cập nhật lần cuối: {updated}</p> : null}
          {intro ? <p className="text-sm sm:text-base text-slate-600 mt-3 sm:mt-4 leading-relaxed">{intro}</p> : null}
          <div className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
            {sections.map((s, i) => (
              <section key={i}>
                <h2 className="text-sm sm:text-base md:text-lg font-bold text-[#0B4045] mb-2">{i + 1}. {s.h}</h2>
                <div className="text-sm sm:text-[15px] text-slate-700 leading-relaxed space-y-2">{s.body}</div>
              </section>
            ))}
          </div>
        </article>
        <div className="mt-4 sm:mt-6 text-center"><Link href="/" className="inline-block text-red-600 font-semibold text-sm hover:underline">← Về trang chủ</Link></div>
      </div>
    </div>
  );
}
