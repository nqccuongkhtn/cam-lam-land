'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
// LẬP DANH MỤC HỒ SƠ LƯU TRỮ (trả phí theo trang). Nạp ví trước → chạy trừ tiền (admin miễn phí).
// Khoá AI + giá/trang do QUẢN TRỊ đặt trong bảng cấu hình. Tông màu đồng bộ web.
// LÀM THEO LÔ: thêm nhiều bộ hồ sơ → chạy lần lượt → mỗi bộ ra một tệp Excel → làm mới cho khách sau.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth, laAdmin, coVaiTro } from '@/lib/auth';
import { apiBase } from '@/lib/api';
import { getToken } from '@/lib/token';
import { toast } from '@/lib/toast';
import KhoDanhMuc from '@/components/KhoDanhMuc';

const NAVY = '#0A2540', GOLD = '#C8A14B';
const fmt = (n: number) => (n || 0).toLocaleString('vi-VN') + 'đ';
// Nút của thanh chuyển tab — nút đang chọn nền trắng nổi lên, giống trang Tra cứu số tờ bản đồ.
const nutTab = (on: boolean) => `flex-1 rounded-md px-2 py-2 text-[12px] sm:text-sm font-bold transition ${on ? 'bg-white text-[#0A2540] shadow-sm' : 'text-slate-500 hover:text-[#0A2540]'}`;
const authHead = () => ({ Authorization: `Bearer ${getToken() || ''}` });

// Một "bộ hồ sơ" = 1 tệp PDF khách mang tới.
type Bo = {
  id: string;
  file: File;
  trang?: number;                 // số trang (máy chủ đếm khi báo giá)
  phi?: number;                   // phí riêng của bộ này
  loiBaoGia?: string;
  trangThai: 'cho' | 'dangChay' | 'xong' | 'loi';
  loi?: string;
  ketQua?: { url: string; ten: string; soVb: string; phi: number };
};
const maBo = () => 'b' + Math.random().toString(36).slice(2, 9);

export default function LapDanhMucPage() {
  const { user } = useAuth();
  const [bos, setBos] = useState<Bo[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const [wallet, setWallet] = useState<any>(null);
  const [topupOpen, setTopupOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dungLai = useRef(false);       // bấm "Dừng" giữa chừng
  const bosRef = useRef<Bo[]>([]); bosRef.current = bos;
  const isAdmin = laAdmin(user);

  // ── HAI TAB: "Lập danh mục" và "Kho danh mục hồ sơ" ──
  // Kho chứa hồ sơ ghi tên người dân → chỉ tài khoản được cấp quyền mới thấy tab này
  // (quản trị, hoặc vai trò 'danhmuc' cấp riêng trong trang quản trị).
  const duocVaoKho = laAdmin(user) || coVaiTro(user, 'danhmuc');   // quản lý văn bản là vai trò KHÁC
  const [tab, setTab] = useState<'lap' | 'kho'>('lap');
  // Mở thẳng tab Kho bằng đường dẫn /lap-danh-muc?tab=kho (đọc từ thanh địa chỉ, không dùng
  // useSearchParams để trang không phải bọc Suspense lúc dựng sẵn).
  useEffect(() => {
    try { if (new URLSearchParams(window.location.search).get('tab') === 'kho') setTab('kho'); } catch { /* ignore */ }
  }, []);
  // Đổi tab thì ghi lại thanh địa chỉ để bấm F5 hoặc gửi link cho người khác vẫn đúng chỗ.
  const doiTab = (t: 'lap' | 'kho') => {
    setTab(t);
    try {
      const u = new URL(window.location.href);
      t === 'kho' ? u.searchParams.set('tab', 'kho') : u.searchParams.delete('tab');
      window.history.replaceState(null, '', u.toString());
    } catch { /* ignore */ }
  };
  // Người không có quyền vào kho mà lỡ mở link ?tab=kho thì kéo về tab lập danh mục.
  useEffect(() => { if (tab === 'kho' && user && !duocVaoKho) setTab('lap'); }, [tab, user, duocVaoKho]);

  const loadWallet = useCallback(async () => {
    if (!user) return;
    try { const r = await fetch(`${apiBase}/danh-muc/wallet`, { headers: authHead() }); if (r.ok) setWallet(await r.json()); } catch { /* ignore */ }
  }, [user]);
  useEffect(() => { loadWallet(); }, [loadWallet]);

  const suaBo = (id: string, v: Partial<Bo>) => setBos((p) => p.map((b) => (b.id === id ? { ...b, ...v } : b)));

  // Thêm một hoặc nhiều bộ; báo giá từng bộ ngay (đếm trang + tính phí, KHÔNG trừ tiền).
  async function themTep(ds: File[]) {
    const ok: File[] = [];
    for (const f of ds) {
      if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { toast.error(`"${f.name}" không phải PDF — đã bỏ qua`); continue; }
      ok.push(f);
    }
    if (!ok.length) return;
    const them: Bo[] = ok.map((f) => ({ id: maBo(), file: f, trangThai: 'cho' }));
    setBos((p) => [...p, ...them]);
    setMsg(null);
    if (!user) return;
    for (const b of them) {
      try {
        const fd = new FormData(); fd.append('file', b.file);
        const r = await fetch(`${apiBase}/danh-muc/quote`, { method: 'POST', headers: authHead(), body: fd });
        const j = await r.json().catch(() => ({} as any));
        if (!r.ok) suaBo(b.id, { loiBaoGia: j.error || 'Không báo giá được' });
        else suaBo(b.id, { trang: j.pages, phi: j.cost });
      } catch { suaBo(b.id, { loiBaoGia: 'Không báo giá được' }); }
    }
  }

  const xoaBo = (id: string) => setBos((p) => { const b = p.find((x) => x.id === id); if (b?.ketQua) URL.revokeObjectURL(b.ketQua.url); return p.filter((x) => x.id !== id); });

  // LÀM MỚI: xoá sạch để phục vụ khách tiếp theo (thu hồi đường dẫn tạm cho nhẹ máy).
  const lamMoi = () => { bosRef.current.forEach((b) => b.ketQua && URL.revokeObjectURL(b.ketQua.url)); setBos([]); setMsg(null); loadWallet(); };
  useEffect(() => () => { bosRef.current.forEach((b) => b.ketQua && URL.revokeObjectURL(b.ketQua.url)); }, []);

  const tai = (k: { url: string; ten: string }) => { const a = document.createElement('a'); a.href = k.url; a.download = k.ten; document.body.appendChild(a); a.click(); a.remove(); };
  const taiHet = async () => { for (const b of bosRef.current) { if (b.ketQua) { tai(b.ketQua); await new Promise((r) => setTimeout(r, 400)); } } };

  const tongTrang = bos.reduce((s, b) => s + (b.trang || 0), 0);
  const choChay = bos.filter((b) => b.trangThai === 'cho' || b.trangThai === 'loi');
  const tongPhi = choChay.reduce((s, b) => s + (b.phi || 0), 0);
  const soDu = wallet?.balance ?? 0;
  const duTien = isAdmin || tongPhi <= soDu;
  const soXong = bos.filter((b) => b.trangThai === 'xong').length;

  // CHẠY LẦN LƯỢT từng bộ — tuần tự để mỗi bộ có trạng thái rõ ràng và không nghẽn hàng đợi máy chủ.
  async function chayHet() {
    if (!user) { setTopupOpen(true); return; }
    const canChay = bosRef.current.filter((b) => b.trangThai === 'cho' || b.trangThai === 'loi');
    if (!canChay.length) { toast.error('Chưa có bộ hồ sơ nào để chạy'); return; }
    if (!duTien) { setTopupOpen(true); return; }
    setBusy(true); dungLai.current = false; setMsg(null);
    let xong = 0, hong = 0;
    for (const b0 of canChay) {
      if (dungLai.current) break;
      suaBo(b0.id, { trangThai: 'dangChay', loi: undefined });
      try {
        const fd = new FormData(); fd.append('file', b0.file);
        const res = await fetch(`${apiBase}/danh-muc/run`, { method: 'POST', headers: authHead(), body: fd });
        if (!res.ok) {
          const j = await res.json().catch(() => ({} as any));
          if (res.status === 402) { setTopupOpen(true); await loadWallet(); throw new Error(j.error || 'Số dư không đủ — đã dừng'); }
          throw new Error(j.error || `Lỗi máy chủ (${res.status})`);
        }
        const cd = res.headers.get('Content-Disposition') || '';
        const m = cd.match(/filename="?([^"]+)"?/);
        const ten = m ? decodeURIComponent(m[1]) : `Danh muc - ${b0.file.name.replace(/\.pdf$/i, '')}.xlsx`;
        const soVb = res.headers.get('X-Doc-Count') || '';
        const phi = Number(res.headers.get('X-Cost') || 0);
        const url = URL.createObjectURL(await res.blob());
        suaBo(b0.id, { trangThai: 'xong', ketQua: { url, ten, soVb, phi } });
        tai({ url, ten });    // các bộ cách nhau vài phút nên tải tự động không bị trình duyệt chặn
        xong++;
        await loadWallet();
      } catch (e: any) {
        hong++;
        suaBo(b0.id, { trangThai: 'loi', loi: e?.message || 'Thất bại' });
        if (/Số dư không đủ/.test(e?.message || '')) break;   // hết tiền thì dừng hẳn, khỏi hỏng tiếp
      }
    }
    setBusy(false);
    setMsg({ ok: hong === 0, text: hong === 0 ? `Xong ${xong} bộ hồ sơ. Tệp Excel đã tải về máy.` : `Xong ${xong} bộ · ${hong} bộ lỗi (xem chi tiết bên dưới, bấm chạy lại để thử tiếp).` });
    if (hong === 0 && xong) toast.success(`Đã lập danh mục ${xong} bộ hồ sơ`);
  }

  const steps = [
    { t: 'Phát hiện ranh giới', d: 'Tách từng văn bản trong tập' },
    { t: 'OCR chọn lọc', d: 'Đọc số, ngày, tiêu đề, chữ ký' },
    { t: 'Đối chiếu chéo', d: 'Kiểm tra ≥2 tín hiệu, không sót trang' },
  ];
  const price = wallet?.pricePerPage ?? 568;
  const nhan: Record<Bo['trangThai'], { t: string; c: string; n: string }> = {
    cho: { t: 'Chờ chạy', c: '#64748b', n: '#f1f5f9' },
    dangChay: { t: 'Đang chạy…', c: '#8a6d1f', n: 'rgba(200,161,75,.22)' },
    xong: { t: 'Xong', c: '#166534', n: '#dcfce7' },
    loi: { t: 'Lỗi', c: '#9b2d2d', n: '#fdf1f1' },
  };

  return (
    <div className={`mx-auto px-4 sm:px-5 py-6 sm:py-8 ${tab === 'kho' ? 'max-w-5xl' : 'max-w-3xl'}`}>
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

      {/* THANH CHUYỂN TAB — kiểu giống trang Tra cứu số tờ bản đồ: dải xám, nút đang chọn nền trắng */}
      {duocVaoKho && (
        <div className="mt-5 flex gap-1 rounded-xl bg-slate-100 p-1">
          <button onClick={() => doiTab('lap')} className={nutTab(tab === 'lap')}>🗂️ Lập danh mục</button>
          <button onClick={() => doiTab('kho')} className={nutTab(tab === 'kho')}>🗄️ Kho danh mục hồ sơ</button>
        </div>
      )}

      {tab === 'kho' ? <KhoDanhMuc /> : (<>

      {/* Bước 1 — nạp tài liệu */}
      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>
            <span className="grid h-5 w-5 place-items-center rounded-full text-white" style={{ background: NAVY }}>1</span>Nạp tài liệu
          </div>
          {!!bos.length && !busy && <button onClick={lamMoi} className="rounded-lg border px-3 py-1.5 text-[13px] font-semibold text-slate-500 transition hover:bg-slate-50" style={{ borderColor: '#d8cfbc' }}>🔄 Làm mới (khách khác)</button>}
        </div>
        <div className="mt-2 mb-3 text-lg font-bold" style={{ color: NAVY }}>Tải lên hồ sơ scan (PDF) — chọn được nhiều bộ</div>

        {!bos.length ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); themTep(Array.from(e.dataTransfer.files || [])); }}
            onClick={() => inputRef.current?.click()}
            className="group cursor-pointer rounded-2xl border-2 border-dashed px-4 py-10 text-center transition"
            style={{ borderColor: drag ? NAVY : '#cdbfa6', background: drag ? '#eef3f9' : '#fffdf8' }}
          >
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full transition group-hover:scale-105" style={{ background: '#f1ede2' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
            </div>
            <div className="text-base font-bold" style={{ color: NAVY }}>Bấm để chọn hoặc kéo-thả PDF vào đây</div>
            <div className="mt-1.5 text-xs text-slate-400">Chọn được nhiều tệp một lúc · hỗ trợ hồ sơ nhiều trang, ảnh scan/chụp, kể cả trang xoay lệch</div>
          </div>
        ) : (
          <div className="rounded-2xl border" style={{ borderColor: '#e6e0d4', background: '#fffdf8' }}>
            {bos.map((b, i) => (
              <div key={b.id} className="flex items-center gap-3 border-b px-3.5 py-3 last:border-b-0" style={{ borderColor: '#efe9dc' }}>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[12px] font-bold" style={{ background: '#f1ede2', color: NAVY }}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold" style={{ color: NAVY }}>{b.file.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-slate-500">
                    {b.trang ? <span>{b.trang} trang</span> : b.loiBaoGia ? <span className="text-amber-700">{b.loiBaoGia}</span> : <span>đang tính…</span>}
                    {!isAdmin && b.phi ? <span>phí {fmt(b.phi)}</span> : null}
                    {b.trangThai === 'xong' && b.ketQua?.soVb ? <span>{b.ketQua.soVb} văn bản</span> : null}
                    {b.loi ? <span className="text-red-700">{b.loi}</span> : null}
                  </div>
                </div>
                <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: nhan[b.trangThai].n, color: nhan[b.trangThai].c }}>{nhan[b.trangThai].t}</span>
                {b.trangThai === 'xong' && b.ketQua && <button onClick={() => tai(b.ketQua!)} title="Tải lại tệp Excel" className="shrink-0 rounded-lg border px-2.5 py-1.5 text-[13px] font-semibold transition hover:bg-slate-50" style={{ borderColor: '#d8cfbc', color: NAVY }}>⬇</button>}
                {!busy && <button onClick={() => xoaBo(b.id)} title="Bỏ bộ này" className="shrink-0 rounded-lg px-2 py-1.5 text-[13px] text-slate-400 transition hover:bg-slate-100 hover:text-red-600">✕</button>}
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3">
              <button onClick={() => inputRef.current?.click()} disabled={busy} className="rounded-lg border-2 border-dashed px-3.5 py-2 text-sm font-bold transition hover:bg-white disabled:opacity-40" style={{ borderColor: '#cdbfa6', color: NAVY }}>＋ Thêm bộ hồ sơ</button>
              <div className="text-[13px] text-slate-500">
                <b style={{ color: NAVY }}>{bos.length}</b> bộ · <b style={{ color: NAVY }}>{tongTrang}</b> trang
                {!isAdmin && tongPhi ? <> · còn phải trả <b style={{ color: NAVY }}>{fmt(tongPhi)}</b></> : null}
              </div>
            </div>
          </div>
        )}
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple hidden
          onChange={(e) => { const ds = Array.from(e.target.files || []); e.target.value = ''; themTep(ds); }} />

        {/* Tiền nong */}
        {!!bos.length && !isAdmin && (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border px-4 py-3 text-sm" style={{ background: duTien ? '#f2f8f2' : '#fdf6ec', borderColor: duTien ? '#cfe6cf' : '#f0dcb8' }}>
            <span>Số dư: <b>{fmt(soDu)}</b></span>
            <span>Cần trả: <b style={{ color: NAVY }}>{fmt(tongPhi)}</b></span>
            {!duTien && <span className="font-bold text-amber-700">Thiếu {fmt(tongPhi - soDu)} — nạp thêm để chạy hết</span>}
          </div>
        )}
      </div>

      {/* Chạy */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button onClick={chayHet} disabled={busy || !choChay.length}
          className="group inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[15px] font-bold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:shadow-none"
          style={{ background: busy || !choChay.length ? '#9fb0c2' : NAVY }}>
          {busy ? '⏳ Đang lập danh mục…' : !duTien ? 'Nạp thêm tiền để chạy'
            : <>Chạy {choChay.length} bộ{!isAdmin && tongPhi ? ` — trừ ${fmt(tongPhi)}` : ''}<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="transition group-hover:translate-x-0.5"><path d="M5 12h14M13 6l6 6-6 6" /></svg></>}
        </button>
        {busy && <button onClick={() => { dungLai.current = true; toast.info('Sẽ dừng sau khi xong bộ đang chạy'); }} className="rounded-xl border px-4 py-2.5 text-slate-600 transition hover:bg-slate-50" style={{ borderColor: '#d8cfbc' }}>Dừng sau bộ này</button>}
        {!busy && soXong > 1 && <button onClick={taiHet} className="rounded-xl border px-4 py-2.5 font-semibold transition hover:bg-slate-50" style={{ borderColor: '#d8cfbc', color: NAVY }}>⬇ Tải lại tất cả ({soXong})</button>}
        {!busy && soXong > 0 && <button onClick={lamMoi} className="rounded-xl border px-4 py-2.5 text-slate-600 transition hover:bg-slate-50" style={{ borderColor: '#d8cfbc' }}>🔄 Làm mới</button>}
      </div>

      {msg && (
        <div className="mt-4 rounded-xl border px-4 py-3 text-sm" style={{ background: msg.ok ? '#f3f6fb' : '#fdf1f1', borderColor: msg.ok ? '#cfe0f0' : '#f0c9c9', color: msg.ok ? NAVY : '#9b2d2d' }}>
          {msg.ok ? '✅ ' : '❌ '}{msg.text}
        </div>
      )}

      <p className="mt-7 rounded-xl px-4 py-3 text-[12.5px] leading-relaxed text-slate-500" style={{ background: '#faf8f2', border: '1px solid #efe9dc' }}>
        Mỗi bộ hồ sơ xuất ra một tệp Excel riêng đúng mẫu danh mục: mỗi văn bản một dòng (số &amp; ký hiệu, ngày tháng, tác giả, trích yếu, tờ số, ghi chú). Mọi trang được gán vào văn bản, không bỏ sót, không chồng lấn. Tên tệp tự đặt theo <i>Người sử dụng · số tờ · số thửa</i>. Các bộ chạy lần lượt, xong bộ nào tải về ngay bộ đó — bộ nào lỗi chỉ cần bấm chạy lại, bộ đã xong không bị tính tiền lần nữa.
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

      </>)}

      {topupOpen && <PayModal loggedIn={!!user} price={price} onClose={() => setTopupOpen(false)} onPaid={() => { loadWallet(); }} />}
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
