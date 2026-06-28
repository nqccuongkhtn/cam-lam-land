'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Article { title: string; url: string; source?: string; image?: string; summary?: string; publishedAt?: string }

// Giải mã slug base64url (UTF-8) → dữ liệu bài. Không cần backend.
function decodeSlug(s: string): Article | null {
  try {
    const b = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
}

export default function NewsReader() {
  const { id } = useParams<{ id: string }>();
  const a = id ? decodeSlug(decodeURIComponent(id)) : null;

  if (!a) return <div className="mx-auto max-w-3xl p-12 text-center text-slate-500">Không tìm thấy bài viết. <Link href="/" className="text-[#0A2540] font-semibold underline">Về trang chủ</Link></div>;

  const date = a.publishedAt ? new Date(a.publishedAt).toLocaleDateString('vi-VN') : '';

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-56px)]">
      <article className="mx-auto max-w-3xl px-4 py-8">
        <div className="text-xs text-slate-400 mb-3"><Link href="/" className="hover:text-[#0A2540]">Trang chủ</Link> › <span className="text-slate-600">Tin tức thị trường BĐS</span></div>

        <h1 className="text-2xl md:text-3xl font-extrabold text-[#0A2540] leading-tight">{a.title}</h1>
        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-sm text-slate-400 mt-3">
          {a.source && <span className="font-semibold text-[#0A2540]">{a.source}</span>}
          {a.source && date && <span>·</span>}
          {date && <span>🕒 {date}</span>}
          <span className="ml-auto text-[11px] bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">Tổng hợp</span>
        </div>

        {a.image && <img src={a.image} alt={a.title} className="w-full rounded-2xl mt-5 bg-slate-100 object-cover max-h-[460px]" />}

        {a.summary && <p className="text-slate-700 leading-relaxed mt-5 text-[17px] whitespace-pre-line">{a.summary}</p>}

        {/* GHI NGUỒN Ở DƯỚI + đọc bài gốc */}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">Nội dung được tổng hợp từ báo chí. Để đọc <b>toàn bộ bài viết</b>, vui lòng xem tại trang nguồn:</p>
          <a href={a.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 bg-[#0A2540] hover:bg-[#0d2f54] text-white font-bold px-5 py-2.5 rounded-xl">Đọc bài gốc tại {a.source || 'nguồn'} →</a>
          <p className="text-[11px] text-slate-400 mt-3">Nguồn: <a href={a.url} target="_blank" rel="noreferrer" className="underline break-all hover:text-[#0A2540]">{a.url}</a></p>
        </div>

        <div className="mt-6"><Link href="/" className="text-sm font-semibold text-red-600 hover:text-red-700">← Về trang chủ</Link></div>
      </article>
    </div>
  );
}
