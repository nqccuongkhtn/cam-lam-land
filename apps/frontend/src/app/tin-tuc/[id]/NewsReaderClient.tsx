'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useBoQc, BillboardAd, NativeAd, SidebarAd } from '@/components/newsAds';
import { decodeEntities } from '@/lib/htmlEntities';

interface Article { title: string; url: string; source?: string; image?: string; images?: string[]; summary?: string; body?: string; publishedAt?: string; slug: string }

// Ảnh có watermark Cam Lâm Land + SĐT, dải mờ che logo/credit của báo gốc.
function WmImg({ src, alt, wrap, img }: { src: string; alt?: string; wrap?: string; img?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-slate-100 ${wrap || ''}`}>
      <img src={src} alt={alt || ''} className={`w-full object-cover block ${img || ''}`} />
      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        <span className="text-white/15 font-black text-2xl sm:text-4xl tracking-widest -rotate-6 select-none" style={{ textShadow: '0 1px 6px rgba(0,0,0,.3)' }}>CAM LÂM LAND</span>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/55 to-transparent pointer-events-none" />
      <div className="absolute right-2.5 bottom-2 flex items-center gap-1.5 pointer-events-none">
        <img src="/icons/icon-192.png" alt="" className="w-4 h-4 rounded-sm" />
        <span className="text-white text-[11px] font-bold" style={{ textShadow: '0 1px 2px rgba(0,0,0,.7)' }}>Cam Lâm Land · 0988 888 888</span>
      </div>
    </div>
  );
}

// ══ CHIA SẺ BÀI ══
// Điện thoại: bấm "Chia sẻ" là mở đúng bảng chia sẻ của máy — có sẵn Zalo, Messenger, tin nhắn…
// Máy tính: không có bảng đó nên bày thẳng Facebook, Zalo và nút chép đường dẫn.
function ChiaSe({ tieuDe, gon }: { tieuDe: string; gon?: boolean }) {
  const [daChep, setDaChep] = useState(false);
  const [hienLink, setHienLink] = useState('');   // chép không được thì bày đường dẫn ra cho tự chép
  const [coMayChiaSe, setCoMayChiaSe] = useState(false);
  useEffect(() => { setCoMayChiaSe(typeof navigator !== 'undefined' && !!(navigator as any).share); }, []);
  const diaChi = () => (typeof window === 'undefined' ? '' : window.location.href);

  const chep = async () => {
    const u = diaChi();
    // Lệnh chép của trình duyệt có lúc TREO (cửa sổ không được chọn, hoặc đang chờ hỏi quyền) —
    // treo thì nút bấm như không có tác dụng. Nên đặt hạn 1,2 giây, quá hạn là chuyển cách khác.
    const coHan = (p: Promise<any>) => Promise.race([p, new Promise((_, ng) => setTimeout(() => ng(new Error('quá hạn')), 1200))]);
    try { await coHan(navigator.clipboard.writeText(u)); }
    catch {
      // Cách cũ: mượn một ô nhập tạm rồi ra lệnh chép
      let ok = false;
      try {
        const t = document.createElement('textarea'); t.value = u;
        t.style.position = 'fixed'; t.style.top = '0'; t.style.opacity = '0';
        document.body.appendChild(t); t.focus(); t.select();
        ok = document.execCommand('copy');
        document.body.removeChild(t);
      } catch { ok = false; }
      // Cả hai cách đều không xong thì BÀY ĐƯỜNG DẪN RA cho người dùng tự chép —
      // đừng để nút bấm mà chẳng thấy gì xảy ra.
      if (!ok) { setHienLink(u); return; }
    }
    setHienLink(''); setDaChep(true); setTimeout(() => setDaChep(false), 2000);
  };
  const mayChiaSe = async () => {
    try { await (navigator as any).share({ title: tieuDe, text: tieuDe, url: diaChi() }); } catch { /* người dùng đóng bảng chia sẻ */ }
  };
  const moCuaSo = (u: string) => { try { window.open(u, '_blank', 'noopener,width=640,height=560'); } catch { /* trình duyệt chặn cửa sổ bật */ } };

  const nut = 'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-bold transition';
  return (
    <div className={`flex flex-wrap items-center gap-2 ${gon ? '' : 'rounded-2xl border border-slate-200 bg-white p-3 sm:p-4'}`}>
      {!gon && <span className="mr-1 text-sm font-bold text-[#0A2540]">Chia sẻ bài này:</span>}
      {coMayChiaSe && (
        <button onClick={mayChiaSe} className={`${nut} bg-[#0A2540] text-white hover:bg-[#0d2f54]`} aria-label="Chia sẻ">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
          Chia sẻ
        </button>
      )}
      <button onClick={() => moCuaSo('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(diaChi()))}
        className={`${nut} ${coMayChiaSe ? 'hidden sm:inline-flex' : ''} bg-[#1877F2] text-white hover:brightness-110`} aria-label="Chia sẻ lên Facebook">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 10-11.6 9.9v-7h-2.5V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0022 12z" /></svg>
        Facebook
      </button>
      <button onClick={() => moCuaSo('https://sp.zalo.me/plugins/share?u=' + encodeURIComponent(diaChi()))}
        className={`${nut} ${coMayChiaSe ? 'hidden sm:inline-flex' : ''} bg-[#0068FF] text-white hover:brightness-110`} aria-label="Chia sẻ qua Zalo">
        <span className="font-black tracking-tight">Zalo</span>
      </button>
      <button onClick={chep} className={`${nut} ${daChep ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-[#0A2540] hover:bg-slate-200'}`} aria-label="Sao chép đường dẫn">
        {daChep ? (
          <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>Đã chép</>
        ) : (
          <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" /></svg>Chép đường dẫn</>
        )}
      </button>
      {hienLink && (
        <div className="mt-1 flex w-full items-center gap-2">
          <input readOnly value={hienLink} onFocus={(e) => e.currentTarget.select()} autoFocus
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[12px] text-slate-600" />
          <span className="shrink-0 text-[11px] text-slate-500">Bấm Ctrl+C để chép</span>
        </div>
      )}
    </div>
  );
}

function RelatedList({ items }: { items: Article[] }) {
  if (!items.length) return null;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <p className="px-4 py-2.5 border-b-2 border-red-600 font-extrabold text-[#0A2540] text-sm uppercase tracking-tight">Tin liên quan</p>
      <div className="divide-y divide-slate-100">
        {items.map((n) => (
          <Link key={n.slug} href={`/tin-tuc/${n.slug}`} className="group flex gap-3 items-start p-3 hover:bg-slate-50">
            <div className="w-20 h-14 rounded-lg overflow-hidden bg-slate-100 shrink-0">
              {n.image ? <img src={n.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-slate-300">📰</div>}
            </div>
            <p className="text-[13px] font-semibold text-[#0A2540] leading-snug line-clamp-3 group-hover:text-red-600">{decodeEntities(n.title)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function NewsReaderClient() {
  const { id } = useParams<{ id: string }>();
  const slug = id ? decodeURIComponent(id) : '';
  const [a, setA] = useState<Article | null>(null);
  const [related, setRelated] = useState<Article[]>([]);
  const [done, setDone] = useState(false);
  const boQc = useBoQc(); // kho quảng cáo chung với 2 ô trang chủ

  useEffect(() => {
    let huy = false;
    // Không thấy bài thì THỬ LẠI một lần sau 3 giây rồi mới kết luận.
    // Lý do: máy chủ vừa dựng lại thì kho tin đang được tải lại ở nền — lần hỏi đầu có thể chưa có
    // bài, mà báo ngay "bài không còn được lưu" là báo oan (bấm F5 lại thấy).
    const hoi = async (lanCuoi: boolean) => {
      try {
        const d = await (await fetch('/feed/news', { cache: 'no-store' })).json();
        const list: Article[] = d.news || [];
        const bai = list.find((x: any) => x.slug === slug) || null;
        if (huy) return true;
        if (bai || lanCuoi) {
          setA(bai);
          setRelated(list.filter((x: any) => x.slug !== slug).slice(0, 8));
          setDone(true);
          return true;
        }
      } catch { if (lanCuoi && !huy) setDone(true); return true; }
      return false;
    };
    hoi(false).then((xong) => { if (!xong && !huy) setTimeout(() => { if (!huy) hoi(true); }, 3000); });
    return () => { huy = true; };
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
  const hero = (a.images && a.images[0]) || a.image;
  // Cắt bỏ phần "rác" cào kèm từ trang nguồn (widget copy link, menu chuyên mục, lịch 1–31, footer công ty, copyright…) lẫn trong body.
  const JUNK = ['Copy link', 'Lấy link', 'CÙNG CHUYÊN MỤC', 'Từ Khóa:', 'Xem theo ngày', 'Chịu trách nhiệm nội dung', '© Copyright', 'Giấy phép thiết lập', 'Bản quyền thuộc', 'Tin tức Lãnh đạo'];
  const rawBody = decodeEntities(String(a.body || a.summary || ''));
  const cutAt = JUNK.reduce((min, m) => { const i = rawBody.indexOf(m); return i >= 0 && i < min ? i : min; }, rawBody.length);
  const paras = rawBody.slice(0, cutAt).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const extra = (a.images || []).slice(1);
  const body: any[] = []; let ip = 0;
  paras.forEach((para, i) => {
    body.push(<p key={'p' + i}>{para}</p>);
    if (i === 2 && boQc.length) body.push(<div key="adin" className="my-4 border-y border-slate-100"><NativeAd ds={boQc} batDau={1} /></div>);
    if ((i + 1) % 2 === 0 && ip < extra.length) body.push(<WmImg key={'i' + i} src={extra[ip++]} wrap="my-1" img="max-h-[440px]" />);
  });
  // Bài ngắn (dưới 3 đoạn) thì ô quảng cáo giữa bài chưa được chèn → chèn cuối bài. Trước đây điện thoại đọc bài ngắn
  // KHÔNG thấy quảng cáo nào, vì ô to trên đầu bài và ô cột phải đều chỉ hiện trên máy tính (5/10/2026).
  if (paras.length < 3 && boQc.length) body.push(<div key="adin" className="my-4 border-y border-slate-100"><NativeAd ds={boQc} batDau={1} /></div>);

  return (
    <div className="bg-slate-50 min-h-[calc(100dvh-56px)]">
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        <div className="text-xs text-slate-400 mb-3"><Link href="/" className="hover:text-[#0A2540]">Trang chủ</Link> › <Link href="/tin-tuc" className="hover:text-[#0A2540]">Tin tức</Link> › <span className="text-slate-600">Bài viết</span></div>

        {boQc.length > 0 && <div className="mb-5 hidden md:block"><BillboardAd ds={boQc} batDau={0} /></div>}

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
          <article className="min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[#0A2540] leading-tight">{decodeEntities(a.title)}</h1>
            <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-sm text-slate-400 mt-3">
              <span className="font-semibold text-[#0A2540]">Cam Lâm Land</span>
              {date && <span>· 🕒 {date}</span>}
              <span className="ml-auto text-[11px] bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">Biên tập</span>
            </div>

            <div className="mt-3 border-y border-slate-200 py-2.5"><ChiaSe tieuDe={decodeEntities(a.title)} gon /></div>

            {hero && <WmImg src={hero} alt={a.title} wrap="mt-5" img="max-h-[460px]" />}

            {a.summary && <p className="mt-5 text-[17px] font-semibold text-[#0A2540] leading-relaxed">{decodeEntities(a.summary)}</p>}

            <div className="mt-4 text-slate-700 leading-relaxed text-[16px] sm:text-[18px] space-y-4">{body}</div>

            {/* Bài Cam Lâm Land tự tổng hợp, biên tập (không có đường dẫn gốc) thì không hiện khung "đọc bản gốc" */}
            {a.url ? (
            <div className="mt-6 sm:mt-8 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <p className="text-sm text-slate-600">Bài do Cam Lâm Land biên tập, dựa trên thông tin từ <b>{a.source || 'báo chí'}</b>. Xem bản gốc đầy đủ tại nguồn:</p>
              <a href={a.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 bg-[#0A2540] hover:bg-[#0d2f54] text-white font-bold px-5 py-2.5 rounded-xl">Đọc bản gốc tại {a.source || 'nguồn'} →</a>
              <p className="text-[11px] text-slate-400 mt-3">Nguồn: <a href={a.url} target="_blank" rel="noreferrer" className="underline break-all hover:text-[#0A2540]">{a.url}</a></p>
            </div>
            ) : (
            <p className="mt-6 text-sm text-slate-500 sm:mt-8">Bài do Cam Lâm Land tổng hợp và biên tập.</p>
            )}

            <div className="mt-5"><ChiaSe tieuDe={decodeEntities(a.title)} /></div>

            {/* Điện thoại / máy tính bảng: thay cho ô quảng cáo cột phải (cột phải chỉ có từ khổ lg) — dạng dòng tin gọn */}
            {boQc.length > 0 && <div className="lg:hidden mt-6 border-y border-slate-100"><NativeAd ds={boQc} batDau={2} /></div>}
            <div className="lg:hidden mt-6"><RelatedList items={related.slice(0, 6)} /></div>
            <div className="mt-6"><Link href="/tin-tuc" className="text-sm font-semibold text-red-600 hover:text-red-700">← Tất cả tin tức</Link></div>
          </article>

          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-5">
              {boQc.length > 0 && <SidebarAd ds={boQc} batDau={2} />}
              <RelatedList items={related} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
