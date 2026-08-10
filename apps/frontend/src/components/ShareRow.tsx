'use client';
import { useState } from 'react';

/** Nút chia sẻ (Facebook · Zalo · Chép link). GIAO DIỆN icon như cũ, nhưng:
 *  bấm Facebook/Zalo → nếu máy hỗ trợ sẽ mở BẢNG CHIA SẺ NATIVE (giống iPhone) cho đẹp;
 *  máy không hỗ trợ (thường là desktop) mới mở popup riêng của Facebook/Zalo. */
export default function ShareRow({ title, className }: { title?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://batdongsancamlam.dpdns.org';
  const url = () => { if (typeof window === 'undefined') return SITE; try { const u = new URL(window.location.href); u.searchParams.delete('embed'); return SITE + u.pathname + u.search + u.hash; } catch { return SITE; } };
  const enc = () => encodeURIComponent(url());
  const b64 = (s: string) => { try { return btoa(unescape(encodeURIComponent(s))); } catch { return btoa(s); } };

  // Mở bảng chia sẻ native. Trả TRUE nếu máy hỗ trợ (đã xử lý) → khỏi mở popup riêng.
  const nativeShare = async (): Promise<boolean> => {
    if (!(navigator as any).share) return false;
    try { await (navigator as any).share({ title: title || (typeof document !== 'undefined' ? document.title : 'Cam Lâm Land'), url: url() }); } catch { /* người dùng huỷ */ }
    return true;
  };
  const fb = async () => { if (await nativeShare()) return; window.open(`https://www.facebook.com/sharer/sharer.php?u=${enc()}`, '_blank', 'noopener,width=660,height=560'); };
  const zalo = async () => { if (await nativeShare()) return; window.open(`https://button-share.zalo.me/share_external?d=${encodeURIComponent(b64(JSON.stringify({ url: url() })))}`, '_blank', 'noopener,width=660,height=560'); };
  const copy = async () => { try { await navigator.clipboard.writeText(url()); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ } };

  const iconBtn = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition';
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className || ''}`}>
      <span className="text-[13px] font-semibold text-slate-500">Chia sẻ:</span>
      <button onClick={fb} aria-label="Chia sẻ Facebook" title="Chia sẻ Facebook" className={`${iconBtn} bg-[#1877F2] text-white hover:brightness-110`}>
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]"><path d="M22 12a10 10 0 1 0-11.5 9.9v-7H8v-2.9h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6v1.8h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z" /></svg>
      </button>
      <button onClick={zalo} aria-label="Chia sẻ Zalo" title="Chia sẻ Zalo" className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-[#0068FF] px-2.5 text-[13px] font-extrabold tracking-tight text-white transition hover:brightness-110">Zalo</button>
      <button onClick={copy} aria-label="Sao chép link" title={copied ? 'Đã chép link' : 'Chép link'} className={`${iconBtn} border bg-white ${copied ? 'border-emerald-400 text-emerald-600' : 'border-slate-300 text-slate-600 hover:border-[#C8A14B]'}`}>
        {copied
          ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]"><path d="M20 6 9 17l-5-5" /></svg>
          : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>}
      </button>
      <button onClick={async () => { if (!(await nativeShare())) copy(); }} aria-label="Chia sẻ" title="Chia sẻ…" className={`${iconBtn} border border-slate-300 bg-white text-slate-600 hover:border-[#C8A14B]`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>
      </button>
    </div>
  );
}
