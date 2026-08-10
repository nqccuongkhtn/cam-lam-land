'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
// LẬP DANH MỤC HỒ SƠ LƯU TRỮ (trả phí theo trang). Nạp ví trước → chạy trừ tiền (admin miễn phí).
// Khoá AI + giá/trang do QUẢN TRỊ đặt trong bảng cấu hình. Tông màu đồng bộ web.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { apiBase } from '@/lib/api';
import { getToken } from '@/lib/token';
import { toast } from '@/lib/toast';

const NAVY = '#0A2540', GOLD = '#C8A14B';
const fmt = (n: number) => (n || 0).toLocaleString('vi-VN') + 'đ';
const authHead = () => ({ Authorization: `Bearer ${getToken() || ''}` });

export default function LapDanhMucPage() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const [wallet, setWallet] = useState<any>(null);
  const [quote, setQuote] = useState<any>(null);
  const [quoting, setQuoting] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isAdmin = user?.role === 'admin';

  const loadWallet = useCallback(async () => {
    if (!user) return;
    try { const r = await fetch(`${apiBase}/danh-muc/wallet`, { headers: authHead() }); if (r.ok) setWallet(await r.json()); } catch { /* ignore */ }
  }, [user]);
  useEffect(() => { loadWallet(); }, [loadWallet]);

  async function pick(f: File | null) {
    if (!f) return;
    if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { toast.error('Chỉ nhận tệp PDF'); return; }
    setFile(f); setMsg(null); setQuote(null);
    if (!user) return;
    // Báo giá ngay: đếm trang + tính phí (không trừ tiền).
    setQuoting(true);
    try {
      const fd = new FormData(); fd.append('file', f);
      const r = await fetch(`${apiBase}/danh-muc/quote`, { method: 'POST', headers: authHead(), body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(j.error || 'Không báo giá được'); if (j.pages) setQuote({ error: j.error }); }
      else setQuote(j);
    } catch { /* ignore */ } finally { setQuoting(false); }
  }

  async function run() {
    if (!user) { setTopupOpen(true); return; }
    if (!file) { toast.error('Hãy chọn tệp PDF hồ sơ'); return; }
    if (quote && !quote.enough && !isAdmin) { setTopupOpen(true); return; }
    setBusy(true); setMsg({ ok: true, text: 'Đang nạp & phân tích hồ sơ… (hồ sơ nhiều trang có thể mất 1–3 phút)' });
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch(`${apiBase}/danh-muc/run`, { method: 'POST', headers: authHead(), body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as any));
        if (res.status === 402) { setTopupOpen(true); await loadWallet(); throw new Error(j.error || 'Số dư không đủ'); }
        throw new Error(j.error || `Lỗi máy chủ (${res.status})`);
      }
      const cd = res.headers.get('Content-Disposition') || '';
      const m = cd.match(/filename="?([^"]+)"?/);
      const name = m ? decodeURIComponent(m[1]) : 'Danh muc ho so.xlsx';
      const count = res.headers.get('X-Doc-Count');
      const cost = Number(res.headers.get('X-Cost') || 0);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setMsg({ ok: true, text: `Xong! Đã lập danh mục ${count || ''} văn bản${cost ? ` · trừ ${fmt(cost)}` : ' (miễn phí)'} → tải về: ${name}` });
      toast.success('Đã tạo danh mục Excel');
      await loadWallet();
    } catch (e: any) { setMsg({ ok: false, text: e?.message || 'Thất bại' }); toast.error(e?.message || 'Lập danh mục thất bại'); }
    finally { setBusy(false); }
  }

  const runDisabled = busy || (isAdmin && !file);
  const runLabel = busy ? '⏳ Đang lập danh mục…'
    : (quote && !quote.enough && !isAdmin) ? 'Nạp thêm tiền để chạy'
    : (!isAdmin && quote?.cost) ? `Chạy lập danh mục — trừ ${fmt(quote.cost)}` : 'Chạy lập danh mục';

  const steps = [
    { t: 'Phát hiện ranh giới', d: 'Tách từng văn bản trong tập' },
    { t: 'OCR chọn lọc', d: 'Đọc số, ngày, tiêu đề, chữ ký' },
    { t: 'Đối chiếu chéo', d: 'Kiểm tra ≥2 tín hiệu, không sót trang' },
  ];
  const price = wallet?.pricePerPage ?? quote?.pricePerPage ?? 568;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-5 py-6 sm:py-8">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-2xl p-6 sm:p-7 text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #14456e 100%)` }}>
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full" style={{ background: 'radial-gradient(circle, rgba(200,161,75,.35), transparent 70%)' }} />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl" style={{ background: 'rgba(200,161,75,.18)', border: '1px solid rgba(200,161,75,.5)' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l1.5-2.5A2 2 0 0 1 6.2 3.5h11.6a2 2 0 0 1 1.7 1L21 7" /><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 12h8M8 15.5h5" /></svg>
            </div>
            <div>
              <h1 className="text-2xl sm:text-[28px] font-bold leading-tight">Lập danh mục hồ sơ lưu trữ</h1>
              <p className="mt-1 text-[13.5px] text-slate-200/90">Scan PDF → danh mục Excel tự động, đúng mẫu lưu trữ nhà nước.</p>
            </div>
          </div>
          <span className="hidden sm:inline-block shrink-0 rounded-full border px-3 py-[3px] text-[11px] font-bold" style={{ color: GOLD, borderColor: GOLD, transform: 'rotate(-5deg)' }}>BẢN CHÍNH</span>
        </div>
        <div className="relative mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div key={i} className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)' }}>
              <div className="flex items-center gap-2 text-[13px] font-semibold">
                <span className="grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold" style={{ background: GOLD, color: NAVY }}>{i + 1}</span>{s.t}
              </div>
              <div className="mt-1 pl-7 text-[11.5px] text-slate-300/80">{s.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bước 1 — nạp tài liệu */}
      <div className="mt-6">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>
          <span className="grid h-5 w-5 place-items-center rounded-full text-white" style={{ background: NAVY }}>1</span>Nạp tài liệu
        </div>
        <div className="mt-2 mb-3 text-lg font-bold" style={{ color: NAVY }}>Tải lên hồ sơ scan (PDF)</div>
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0] || null); }}
          onClick={() => inputRef.current?.click()}
          className="group cursor-pointer rounded-2xl border-2 border-dashed px-4 py-10 text-center transition"
          style={{ borderColor: drag ? NAVY : '#cdbfa6', background: drag ? '#eef3f9' : '#fffdf8' }}
        >
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full transition group-hover:scale-105" style={{ background: file ? 'rgba(200,161,75,.16)' : '#f1ede2' }}>
            {file
              ? <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 15l2 2 4-4" /></svg>
              : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>}
          </div>
          <div className="text-base font-bold" style={{ color: NAVY }}>{file ? file.name : 'Bấm để chọn hoặc kéo-thả PDF vào đây'}</div>
          <div className="mt-1.5 text-xs text-slate-400">{file ? 'Đã sẵn sàng — kiểm tra phí bên dưới rồi bấm chạy' : 'Hỗ trợ hồ sơ nhiều trang, ảnh scan/chụp, kể cả trang xoay lệch'}</div>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => pick(e.target.files?.[0] || null)} />
        </div>

        {/* Báo giá */}
        {quoting && <div className="mt-3 text-sm text-slate-500">Đang tính phí…</div>}
        {quote && !quote.error && (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border px-4 py-3 text-sm" style={{ background: quote.enough || isAdmin ? '#f2f8f2' : '#fdf6ec', borderColor: quote.enough || isAdmin ? '#cfe6cf' : '#f0dcb8' }}>
            <span>📄 <b>{quote.pages}</b> trang</span>
            <span>Phí: <b style={{ color: NAVY }}>{isAdmin ? 'Miễn phí (admin)' : fmt(quote.cost)}</b></span>
            {!isAdmin && <span>Số dư: <b>{fmt(quote.balance)}</b></span>}
            {!isAdmin && !quote.enough && <span className="font-bold text-amber-700">Số dư không đủ — cần nạp thêm {fmt(quote.cost - quote.balance)}</span>}
          </div>
        )}
      </div>

      {/* Chạy */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button onClick={run} disabled={runDisabled}
          className="group inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[15px] font-bold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:shadow-none"
          style={{ background: runDisabled ? '#9fb0c2' : NAVY }}>
          {busy ? runLabel : <>{runLabel}<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="transition group-hover:translate-x-0.5"><path d="M5 12h14M13 6l6 6-6 6" /></svg></>}
        </button>
        {file && !busy && <button onClick={() => { setFile(null); setMsg(null); setQuote(null); }} className="rounded-xl border px-4 py-2.5 text-slate-600 transition hover:bg-slate-50" style={{ borderColor: '#d8cfbc' }}>Chọn tệp khác</button>}
      </div>

      {msg && (
        <div className="mt-4 rounded-xl border px-4 py-3 text-sm" style={{ background: msg.ok ? '#f3f6fb' : '#fdf1f1', borderColor: msg.ok ? '#cfe0f0' : '#f0c9c9', color: msg.ok ? NAVY : '#9b2d2d' }}>
          {msg.ok ? '✅ ' : '❌ '}{msg.text}
        </div>
      )}

      <p className="mt-7 rounded-xl px-4 py-3 text-[12.5px] leading-relaxed text-slate-500" style={{ background: '#faf8f2', border: '1px solid #efe9dc' }}>
        Kết quả xuất ra tệp Excel đúng mẫu danh mục: mỗi văn bản một dòng (số & ký hiệu, ngày tháng, tác giả, trích yếu, tờ số, ghi chú). Mọi trang được gán vào văn bản, không bỏ sót, không chồng lấn. Tên tệp tự đặt theo <i>Người sử dụng · số tờ · số thửa</i>.
      </p>

      {/* VÍ — đặt cuối trang */}
      {!user ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3.5" style={{ borderColor: '#e6e0d4' }}>
          <div className="text-sm text-slate-600">Đăng nhập để bắt đầu lập danh mục. <button onClick={() => setTopupOpen(true)} className="font-semibold underline" style={{ color: NAVY }}>Xem bảng giá</button></div>
          <a href="/login?next=/lap-danh-muc" className="rounded-lg px-4 py-2 text-sm font-bold text-white" style={{ background: NAVY }}>Đăng nhập</a>
        </div>
      ) : wallet?.isAdmin ? (
        <div className="mt-4 rounded-xl border bg-white p-3.5" style={{ borderColor: '#e6e0d4' }}>
          <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: 'rgba(200,161,75,.18)', color: '#8a6d1f' }}>Tài khoản quản trị — dùng không giới hạn</span>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3.5" style={{ borderColor: '#e6e0d4' }}>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: 'rgba(200,161,75,.16)' }}>💳</span>
            Số dư ví: <b style={{ color: NAVY }}>{fmt(wallet?.balance ?? 0)}</b>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setTopupOpen(true)} className="text-sm font-semibold underline" style={{ color: '#8a7c67' }}>Bảng giá</button>
            <button onClick={() => setTopupOpen(true)} className="rounded-lg px-4 py-2 text-sm font-bold text-white" style={{ background: NAVY }}>Nạp ví</button>
          </div>
        </div>
      )}

      {topupOpen && <PayModal loggedIn={!!user} price={price} onClose={() => setTopupOpen(false)} onPaid={() => { loadWallet(); if (file) pick(file); }} />}
      {isAdmin && <div className="mt-8 border-t border-dashed pt-4 text-right" style={{ borderColor: '#d8cfbc' }}><a href="/lap-danh-muc/cau-hinh" className="text-[13px] font-semibold text-slate-400 hover:text-slate-600">⚙️ Cấu hình (Quản trị)</a></div>}
    </div>
  );
}

// ── Modal Bảng giá & Nạp ví (lịch sự): nêu giá trị trước, giá sau; nạp qua VietQR ──
function PayModal({ loggedIn, price, onClose, onPaid }: { loggedIn: boolean; price: number; onClose: () => void; onPaid: () => void }) {
  const [amount, setAmount] = useState(500000);
  const [order, setOrder] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [paid, setPaid] = useState(false);
  const startBal = useRef<number | null>(null);

  async function create() {
    if (amount < 10000) { toast.error('Tối thiểu 10.000đ'); return; }
    setCreating(true);
    try {
      const wr = await fetch(`${apiBase}/danh-muc/wallet`, { headers: authHead() }); startBal.current = wr.ok ? (await wr.json()).balance : 0;
      const r = await fetch(`${apiBase}/danh-muc/topup`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHead() }, body: JSON.stringify({ amount }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Không tạo được đơn');
      setOrder(j);
    } catch (e: any) { toast.error(e?.message || 'Lỗi'); } finally { setCreating(false); }
  }
  // Tự dò số dư tăng để biết đã nạp thành công.
  useEffect(() => {
    if (!order || paid) return;
    const iv = setInterval(async () => {
      try { const r = await fetch(`${apiBase}/danh-muc/wallet`, { headers: authHead() }); if (r.ok) { const b = (await r.json()).balance; if (startBal.current != null && b > startBal.current) { setPaid(true); toast.success('Đã nhận thanh toán — cộng ví thành công'); onPaid(); } } } catch { /* ignore */ }
    }, 4000);
    return () => clearInterval(iv);
  }, [order, paid]);

  const qr = order ? `https://img.vietqr.io/image/${order.bank.bankId}-${order.bank.account}-compact2.png?amount=${order.amount}&addInfo=${encodeURIComponent(order.note)}&accountName=${encodeURIComponent(order.bank.name)}` : '';
  const benefits = ['Tự động tách & lập danh mục đúng mẫu lưu trữ', 'Đối chiếu chéo, không bỏ sót — không chồng trang', 'Xuất Excel tải về ngay, tiết kiệm hàng giờ nhập tay'];
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header giá trị */}
        <div className="relative px-5 pt-5 pb-4 text-white" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #14456e 100%)` }}>
          <button onClick={onClose} className="absolute right-3 top-3 text-white/70 hover:text-white">✕</button>
          <h3 className="text-lg font-bold">Dịch vụ lập danh mục hồ sơ</h3>
          <p className="mt-1 text-[13px] text-slate-200/90">Trả theo mức dùng — chỉ tính trên số trang thực tế của hồ sơ.</p>
          <div className="mt-3 inline-flex items-baseline gap-1 rounded-lg px-3 py-1.5" style={{ background: 'rgba(200,161,75,.18)', border: '1px solid rgba(200,161,75,.5)' }}>
            <span className="text-2xl font-extrabold" style={{ color: GOLD }}>{price.toLocaleString('vi-VN')}đ</span>
            <span className="text-sm text-slate-200">/ trang</span>
          </div>
        </div>

        {!order ? (
          <div className="p-5">
            <ul className="space-y-2 text-sm text-slate-600">
              {benefits.map((b) => <li key={b} className="flex items-start gap-2"><span className="mt-0.5 shrink-0 text-emerald-500">✓</span>{b}</li>)}
            </ul>
            <p className="mt-3 text-[12px] text-slate-400">Thanh toán an toàn qua ngân hàng · Xuất file tức thì · Số dư dùng dần.</p>
            {loggedIn ? (
              <>
                <div className="my-4 h-px bg-slate-100" />
                <div className="text-sm font-semibold text-slate-700">Nạp ví để bắt đầu</div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[300000, 500000, 1000000, 2000000].map((v) => (
                    <button key={v} onClick={() => setAmount(v)} className="rounded-lg border px-2 py-2 text-sm font-semibold transition" style={{ borderColor: amount === v ? NAVY : '#e2e8f0', background: amount === v ? '#eef3f9' : '#fff', color: NAVY }}>{fmt(v)}</button>
                  ))}
                </div>
                <input type="number" value={amount} min={10000} step={10000} onChange={(e) => setAmount(Number(e.target.value))} className="mt-2 w-full rounded-md border px-3 py-2 text-sm" style={{ borderColor: '#d8cfbc' }} placeholder="Nhập số tiền khác" />
                <button onClick={create} disabled={creating} className="mt-4 w-full rounded-lg py-3 font-bold text-white shadow-md" style={{ background: NAVY }}>{creating ? 'Đang tạo…' : `Nạp ${fmt(amount)}`}</button>
              </>
            ) : (
              <a href="/login?next=/lap-danh-muc" className="mt-5 block w-full rounded-lg py-3 text-center font-bold text-white shadow-md" style={{ background: NAVY }}>Đăng nhập để nạp ví</a>
            )}
          </div>
        ) : paid ? (
          <div className="p-6 text-center">
            <div className="text-4xl">✅</div>
            <p className="mt-2 font-bold" style={{ color: NAVY }}>Nạp thành công {fmt(order.amount)}!</p>
            <p className="mt-1 text-sm text-slate-500">Đã cộng vào số dư ví của bạn.</p>
            <button onClick={onClose} className="mt-4 rounded-lg px-6 py-2.5 font-bold text-white" style={{ background: NAVY }}>Bắt đầu dùng</button>
          </div>
        ) : (
          <div className="p-5 text-center">
            <p className="text-sm text-slate-500">Quét mã hoặc chuyển khoản theo thông tin dưới đây</p>
            <img src={qr} alt="VietQR" className="mx-auto mt-3 w-52 rounded-lg border" style={{ borderColor: '#eee' }} />
            <div className="mt-3 rounded-lg border bg-slate-50 p-3 text-left text-sm" style={{ borderColor: '#e2e8f0' }}>
              <div>Ngân hàng: <b>{order.bank.bankId}</b></div>
              <div>Số TK: <b>{order.bank.account}</b> — {order.bank.name}</div>
              <div>Số tiền: <b style={{ color: '#c0392b' }}>{fmt(order.amount)}</b></div>
              <div>Nội dung: <b>{order.note}</b> <span className="text-xs text-slate-400">(giữ nguyên)</span></div>
            </div>
            <p className="mt-3 flex items-center justify-center gap-2 text-sm text-slate-500"><span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Đang chờ thanh toán — tự động cộng ví khi nhận được tiền…</p>
          </div>
        )}
      </div>
    </div>
  );
}
