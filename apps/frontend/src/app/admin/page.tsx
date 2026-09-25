'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { refreshFlags } from '@/lib/flags';
import { api, uploadGis } from '@/lib/api';
import { ImportJob, formatVnd, PROPERTY_LABELS } from '@/lib/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, coVaiTro, laAdmin } from '@/lib/auth';

type Tab = 'overview' | 'users' | 'listings' | 'payments' | 'ads' | 'config' | 'upload' | 'logs';
const TABS: [Tab, string][] = [['overview', 'Tổng quan'], ['users', 'Người dùng'], ['listings', 'Tin đăng'], ['payments', 'Thanh toán'], ['ads', 'Quảng cáo'], ['config', 'Cấu hình'], ['upload', 'Tải bản đồ'], ['logs', 'Nhật ký']];

export default function Admin() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [embedded, setEmbedded] = useState(false); // nhúng trong hub Quản lý -> ẩn tiêu đề & tab (điều hướng bằng sidebar ngoài)
  useEffect(() => { if (!loading && !user) router.replace('/login'); }, [loading, user, router]);
  useEffect(() => { if (coVaiTro(user, 'gis') && !laAdmin(user)) setTab('upload'); }, [user]);
  useEffect(() => { try { const p = new URLSearchParams(window.location.search); const t = p.get('tab'); if (t && TABS.some(([x]) => x === t)) setTab(t as Tab); setEmbedded(p.get('embed') === '1' || document.documentElement.classList.contains('embed')); } catch { /* */ } }, []);
  // AN TOÀN: chặn <select> đổi giá trị NGOÀI Ý MUỐN khi LĂN CHUỘT — nếu đang focus 1 select mà cuộn thì bỏ focus
  // để cuộn trang (không lỡ đổi vai trò/hạng/trạng thái). Một chỗ, bảo vệ mọi select trong bảng quản trị.
  useEffect(() => {
    const onWheel = () => { const el = document.activeElement as HTMLElement | null; if (el && el.tagName === 'SELECT') el.blur(); };
    document.addEventListener('wheel', onWheel, { passive: true });
    return () => document.removeEventListener('wheel', onWheel);
  }, []);

  if (loading) return <div className="mx-auto max-w-6xl px-4 py-16 text-center text-slate-500">Đang tải…</div>;
  if (!user) return null;
  if (!coVaiTro(user, 'admin', 'gis')) return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-xl font-bold text-[#0B4045]">Không có quyền truy cập</p>
      <p className="text-slate-500 mt-2 text-sm">Trang này chỉ dành cho admin / biên tập bản đồ. <Link href="/" target="_top" className="text-[#0B4045] font-semibold underline">Về trang chủ</Link></p>
    </div>
  );
  const isGis = coVaiTro(user, 'gis') && !laAdmin(user);   // chỉ có mỗi vai trò GIS → rút gọn màn hình
  const shownTabs = isGis ? TABS.filter(([t]) => t === 'upload' || t === 'logs') : TABS;
  return (
    <div className={`mx-auto max-w-6xl px-4 ${embedded ? 'py-4' : 'py-6'}`}>
      {!embedded && <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-[#0B4045]">{isGis ? 'Quản lý bản đồ GIS' : 'Bảng điều khiển quản trị'}</h1>
        <button onClick={() => { logout(); router.replace('/login'); }} className="text-sm text-slate-500 hover:text-slate-800">Đăng xuất</button>
      </div>}
      {!embedded && <div className="flex gap-1 border-b mb-5 overflow-x-auto">
        {shownTabs.map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold border-b-2 whitespace-nowrap ${tab === t ? 'border-[#C8A14B] text-[#0B4045]' : 'border-transparent text-slate-500'}`}>{l}</button>
        ))}
      </div>}
      {tab === 'overview' && !isGis && <Overview />}
      {tab === 'users' && !isGis && <Users />}
      {tab === 'listings' && !isGis && <ListingsAdmin />}
      {tab === 'payments' && !isGis && <Payments />}
      {tab === 'ads' && !isGis && <AdsManager />}
      {tab === 'config' && !isGis && <Config />}
      {tab === 'upload' && <UploadGis />}
      {tab === 'logs' && <Logs />}
    </div>
  );
}

function AdsManager() {
  const [ad, setAd] = useState<any>({ enabled: true, images: ['https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1280&h=800&q=72'], link: '/sales/post', title: 'ĐĂNG TIN NHÀ ĐẤT MIỄN PHÍ', sub: 'Tiếp cận hàng nghìn khách mua tại Cam Lâm', cta: 'Đăng ngay' });
  const [adMsg, setAdMsg] = useState('');
  const [mapCount, setMapCount] = useState<number | null>(null);
  useEffect(() => { api<{ value: any }>('/config/tintuc_ad').then((r) => { if (r.value && typeof r.value === 'object') setAd((a: any) => ({ ...a, ...r.value })); }).catch(() => {}); }, []);
  useEffect(() => { api<{ ads: any[] }>('/map-ads').then((r) => setMapCount((r.ads || []).length)).catch(() => {}); }, []);
  const setF = (k: string, v: string) => setAd((a: any) => ({ ...a, [k]: v }));
  async function save() { setAdMsg('Đang lưu…'); try { await api('/config/tintuc_ad', { method: 'POST', body: JSON.stringify({ value: ad }) }); setAdMsg('✓ Đã lưu.'); } catch (e: any) { const m = String(e?.message || ''); setAdMsg(/404|not ?found|không tìm/i.test(m) ? '✗ Cần rebuild lại camlam-api.' : '✗ ' + m); } }
  const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm';
  const on = ad.enabled !== false;
  const firstImg = (ad.images && ad.images[0]) || ad.image || '';
  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-sm text-slate-500">Quản lý <b>toàn bộ quảng cáo</b> của web tại đây.</p>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-4">
        <div>
          <p className="font-bold text-[#0B4045]">🗺️ Quảng cáo trên bản đồ</p>
          <p className="text-sm text-slate-500 mt-0.5">Logo ghim điểm / chữ mờ trên bản đồ quy hoạch — đang chạy <b>{mapCount ?? '…'}</b> quảng cáo.</p>
        </div>
        <Link href="/map-ads" className="shrink-0 bg-[#0B4045] hover:bg-[#0e5157] text-white font-bold px-4 py-2 rounded-xl text-sm whitespace-nowrap">Quản lý →</Link>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <p className="font-bold text-[#0B4045]">📢 Banner trang Tin tức (2 bên)</p>
          <button onClick={() => setAd((a: any) => ({ ...a, enabled: a.enabled === false }))} aria-label="Bật/tắt" className={`w-12 h-7 rounded-full relative transition ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}><span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${on ? 'left-6' : 'left-1'}`} /></button>
        </div>
        <p className="text-xs text-slate-500 mt-1">Banner dọc cao như batdongsan. Nhập nhiều ảnh (mỗi dòng 1 URL) để chạy động (slideshow + zoom). Ảnh đứng, vd 600×1400.</p>
        <div className="grid sm:grid-cols-[1fr_170px] gap-4 mt-3 items-start">
          <div className="space-y-2.5">
            <textarea value={(ad.images && ad.images.length ? ad.images : ad.image ? [ad.image] : []).join('\n')} onChange={(e) => setAd((a: any) => ({ ...a, images: e.target.value.split('\n').map((x: string) => x.trim()).filter(Boolean) }))} rows={3} placeholder="URL ảnh — MỖI DÒNG 1 ẢNH (nhiều ảnh = chạy slideshow động)" className={inp} />
            <input value={ad.link || ''} onChange={(e) => setF('link', e.target.value)} placeholder="Link khi bấm (vd /sales/post)" className={inp} />
            <input value={ad.title || ''} onChange={(e) => setF('title', e.target.value)} placeholder="Tiêu đề" className={inp} />
            <input value={ad.sub || ''} onChange={(e) => setF('sub', e.target.value)} placeholder="Mô tả ngắn" className={inp} />
            <input value={ad.cta || ''} onChange={(e) => setF('cta', e.target.value)} placeholder="Chữ nút" className={inp} />
            <div className="flex items-center gap-3"><button onClick={save} className="bg-[#0B4045] hover:bg-[#0e5157] text-white font-bold px-4 py-2 rounded-xl text-sm">Lưu</button>{adMsg && <span className="text-xs font-medium text-slate-600">{adMsg}</span>}</div>
          </div>
          <div>
            <p className="text-[11px] text-slate-400 mb-1.5 text-center">Xem trước</p>
            <div className="relative rounded-xl overflow-hidden border border-slate-200 aspect-[300/600] bg-slate-100">
              {firstImg ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={firstImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 p-2 pt-8 bg-gradient-to-t from-black/85 to-transparent text-white text-center">
                    <p className="font-extrabold text-xs leading-tight">{ad.title}</p>
                    {ad.sub && <p className="text-[10px] text-white/90 mt-0.5">{ad.sub}</p>}
                    <span className="mt-1.5 block bg-[#C8A14B] text-[#0B4045] text-[11px] font-bold py-1 rounded">{ad.cta || 'Xem'} →</span>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#0B4045] to-[#10355f] text-white p-2 flex flex-col justify-center text-center">
                  <p className="font-extrabold text-sm">{ad.title}</p>
                  {ad.sub && <p className="text-[10px] text-white/80 mt-1">{ad.sub}</p>}
                  <span className="mt-2 inline-block bg-[#C8A14B] text-[#0B4045] text-[11px] font-bold px-2 py-1 rounded">{ad.cta || 'Xem'} →</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <p className="font-bold text-[#0B4045]">📣 Banner liên hệ quảng cáo (trang chủ)</p>
        <p className="text-sm text-slate-500 mt-0.5">Hiện ở cuối trang chủ khi <b>Dịch vụ</b> đang bật. Bật/tắt ở tab <b>Cấu hình</b>.</p>
      </div>
    </div>
  );
}
function Config() {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState('');
  const load = useCallback(() => { api<{ flags: Record<string, boolean> }>('/flags').then((r) => setFlags(r.flags || {})).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);
  async function toggle(key: string, on: boolean) {
    setBusy(key);
    try { await api('/flags', { method: 'POST', body: JSON.stringify({ key, on }) }); setFlags((f) => ({ ...f, [key]: on })); refreshFlags(); }
    catch (e: any) { const m = String(e?.message || ''); alert(/404|not ?found|không tìm/i.test(m) ? 'Máy chủ chưa có tính năng này — cần rebuild lại camlam-api rồi thử lại.' : 'Lỗi: ' + m); } finally { setBusy(''); }
  }
  const ITEMS: [string, string, string][] = [
    ['services_live', 'Trang Dịch vụ & Bảng giá (/dichvu)', 'Hiện trang bảng giá, các ô “mua/nâng gói”, banner quảng cáo trang chủ và quảng cáo 2 bên. Tắt = khách thấy “Sắp ra mắt”, admin vẫn xem trước được.'],
  ];
  return (
    <div className="space-y-3 max-w-2xl">
      <p className="text-sm text-slate-500">Bật/tắt các tính năng <b>chưa triển khai</b>. Khi tắt, khách không thấy; bạn (admin) vẫn xem trước được để kiểm tra.</p>
      {ITEMS.map(([key, title, desc]) => (
        <div key={key} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-start justify-between gap-4">
          <div>
            <p className="font-bold text-[#0B4045]">{title}</p>
            <p className="text-sm text-slate-500 mt-0.5">{desc}</p>
          </div>
          <button onClick={() => toggle(key, !flags[key])} disabled={busy === key} aria-label="Bật/tắt"
            className={`shrink-0 w-14 h-8 rounded-full transition relative ${flags[key] ? 'bg-emerald-500' : 'bg-slate-300'}`}>
            <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${flags[key] ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
      ))}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <p className="font-bold text-[#0B4045]">📰 Tin tức thị trường (trang chủ)</p>
        <p className="text-sm text-slate-500 mt-0.5">Tự lấy bài BĐS từ nguồn uy tín (VnExpress, CafeF, Báo Xây dựng) và hiển thị ở tab “Thị trường BĐS” — chạy sẵn trong web, không cần thao tác.</p>
      </div>
      <p className="text-xs text-slate-400">{flags.services_live ? '🟢 Dịch vụ đang công khai với khách.' : '🔒 Dịch vụ đang ẩn — chỉ admin xem được.'}</p>
    </div>
  );
}
function Stat({ label, value, sub }: { label: string; value: any; sub?: string }) {
  return <div className="bg-white rounded-2xl border border-slate-200 p-4"><p className="text-2xl md:text-3xl font-extrabold text-[#0B4045]">{value}</p><p className="text-sm text-slate-500">{label}</p>{sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}</div>;
}
function Row({ k, v }: { k: string; v: number }) {
  return <div className="flex justify-between text-sm py-1 border-b border-slate-50"><span className="text-slate-600">{k}</span><b className="text-[#0B4045]">{v}</b></div>;
}
const OCR_LABELS: Record<string, string> = { gemini: 'Gemini AI', groq: 'Groq (Llama 4)', openrouter: 'OpenRouter', ocrspace: 'OCR.space', self: 'Máy nội bộ', tesseract: 'Tesseract (máy chủ)' };
const OCR_LIMITS: Record<string, string> = { gemini: 'nhiều model', groq: '14.400 / ngày', openrouter: '~200 / ngày', ocrspace: '500 / ngày', self: 'không giới hạn', tesseract: 'không giới hạn' };
function OcrUsage() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { api('/ocr/usage').then(setD).catch(() => {}); }, []);
  if (!d) return null;
  const today: any[] = d.today || [];
  const dmy = (s: string) => (s ? s.split('-').reverse().join('/') : '');
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <h3 className="font-bold text-[#0B4045] mb-1">📊 Lượt đọc toạ độ (OCR) hôm nay · {dmy(d.ymd)}</h3>
      <p className="text-xs text-slate-400 mb-3">Reset mỗi ngày (giờ VN). Theo dõi để không vượt hạn miễn phí của từng nguồn.</p>
      <table className="w-full text-sm">
        <thead className="text-left text-slate-500"><tr><th className="py-1">Nguồn AI</th><th className="py-1 text-right">Đã dùng</th><th className="py-1 text-right">Giới hạn free/ngày</th></tr></thead>
        <tbody>
          {['gemini', 'groq', 'openrouter', 'ocrspace', 'self', 'tesseract'].map((eng) => {
            const c = today.find((r) => r.engine === eng)?.count ?? 0;
            return <tr key={eng} className="border-t border-slate-50"><td className="py-1.5 text-slate-600">{OCR_LABELS[eng]}</td><td className="py-1.5 text-right font-bold text-[#0B4045]">{c}</td><td className="py-1.5 text-right text-slate-400 text-xs">{OCR_LIMITS[eng]}</td></tr>;
          })}
        </tbody>
      </table>
      {Array.isArray(d.last7) && d.last7.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-500 mb-1.5">7 ngày gần đây (tổng/ngày)</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            {d.last7.map((r: any) => <span key={r.ymd}>{dmy(String(r.ymd).slice(5))}: <b className="text-[#0B4045]">{r.total}</b></span>)}
          </div>
        </div>
      )}
    </div>
  );
}
function Overview() {
  const [s, setS] = useState<any>(null);
  useEffect(() => { api('/admin/stats').then(setS).catch(() => {}); }, []);
  if (!s) return (
    <div className="space-y-5 animate-pulse" aria-busy="true" aria-label="Đang tải báo cáo">
      <div className="h-[68px] rounded-2xl bg-slate-200/70" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[76px] rounded-2xl bg-slate-200/70" />)}</div>
      <div className="grid md:grid-cols-2 gap-4"><div className="h-40 rounded-2xl bg-slate-200/70" /><div className="h-40 rounded-2xl bg-slate-200/70" /></div>
    </div>
  );
  return (
    <div className="space-y-5">
      <Link href="/admin/traffic" className="flex items-center justify-between bg-gradient-to-r from-[#0B4045] to-[#16324f] text-white rounded-2xl p-4 hover:opacity-95">
        <div>
          <p className="font-bold text-lg">📊 Lượt truy cập web</p>
          <p className="text-white/70 text-sm">Chi tiết: đang xem, theo ngày, top trang, nguồn truy cập</p>
        </div>
        <span className="text-2xl">→</span>
      </Link>
      <DemoData />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Người dùng" value={s.users.total} sub={`${s.users.gis} biên tập bản đồ · ${s.users.paid} trả phí`} />
        <Stat label="Tin đăng" value={s.listings.total} sub={`${s.listings.active} hiển thị · ${s.listings.boosted} đẩy`} />
        <Stat label="Tổng giá trị tin" value={formatVnd(s.listings.totalValue)} />
        <Stat label="Ảnh trong CSDL" value={s.images.total} sub={`${(Number(s.images.bytes) / 1048576).toFixed(1)} MB`} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4"><h3 className="font-bold text-[#0B4045] mb-2">Tin theo loại hình</h3>{s.byType.map((r: any) => <Row key={r.type} k={PROPERTY_LABELS[r.type as keyof typeof PROPERTY_LABELS] || r.type} v={r.n} />)}</div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4"><h3 className="font-bold text-[#0B4045] mb-2">Tin theo xã</h3>{s.byWard.map((r: any) => <Row key={r.ward} k={r.ward} v={r.n} />)}</div>
      </div>
      <OcrUsage />
    </div>
  );
}

function DemoData() {
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  async function seed() {
    if (!confirm('Tạo ~50 tin mẫu + tin nhắn mẫu để test? (dọn dữ liệu mẫu cũ trước, không đụng tin thật)')) return;
    setBusy('seed'); setMsg('');
    try { const r = await api<any>('/admin/seed-demo', { method: 'POST', body: JSON.stringify({ sale: 179, rent: 168 }) }); setMsg(`✓ Đã tạo ${r.listings} tin (179 bán + 168 thuê), ${r.chat} tin nhắn, ${r.consignments} khách gửi bán, ${r.invest} đăng ký đầu tư.`); }
    catch (e: any) { setMsg('Lỗi: ' + e.message); } finally { setBusy(''); }
  }
  async function clearAll() {
    if (!confirm('Xoá TẤT CẢ dữ liệu mẫu (tin + tin nhắn + tài khoản môi giới mẫu)? Tin thật của bạn không bị ảnh hưởng.')) return;
    setBusy('clear'); setMsg('');
    try { const r = await api<any>('/admin/clear-demo', { method: 'POST' }); setMsg(`✓ Đã xoá sạch dữ liệu mẫu (${r.removedAgents} môi giới mẫu).`); }
    catch (e: any) { setMsg('Lỗi: ' + e.message); } finally { setBusy(''); }
  }
  return (
    <div className="bg-gradient-to-r from-[#0B4045] to-[#10355f] text-white rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold">🧪 Dữ liệu mẫu để kiểm thử</p>
          <p className="text-sm text-white/70 mt-0.5">Tạo nhanh 347 tin (179 bán + 168 thuê, giá sát thị trường, đủ loại + VIP, 80% ở xã ven biển/trung tâm) + 168 chat cộng đồng (~10 người) + nhiều luồng hỗ trợ/tư vấn + khách gửi bán + đăng ký đầu tư. Xoá sạch khi test xong.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button onClick={seed} disabled={!!busy} className="flex-1 sm:flex-none whitespace-nowrap bg-[#C8A14B] hover:bg-[#b8923f] disabled:opacity-60 text-[#0B4045] font-bold px-4 py-2 rounded-xl">{busy === 'seed' ? 'Đang tạo…' : '＋ Tạo 347 tin mẫu'}</button>
          <button onClick={clearAll} disabled={!!busy} className="flex-1 sm:flex-none whitespace-nowrap bg-white/10 hover:bg-white/20 disabled:opacity-60 border border-white/30 text-white font-bold px-4 py-2 rounded-xl">{busy === 'clear' ? 'Đang xoá…' : 'Xoá dữ liệu mẫu'}</button>
        </div>
      </div>
      {msg && <p className="text-sm mt-2 font-semibold text-[#FFD56A]">{msg}</p>}
    </div>
  );
}

function Users() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(''); const [dq, setDq] = useState(''); const [page, setPage] = useState(1); const [total, setTotal] = useState(0); const per = 30;
  useEffect(() => { const t = setTimeout(() => { setDq(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const load = useCallback(() => { setLoading(true); api<{ users: any[]; total: number }>(`/admin/users?q=${encodeURIComponent(dq)}&page=${page}&per=${per}`).then((d) => { setRows(d.users); setTotal(d.total || 0); }).catch(() => {}).finally(() => setLoading(false)); }, [dq, page]);
  useEffect(() => { load(); }, [load]);
// ── CẤP VAI TRÒ: MỘT NGƯỜI CÓ THỂ GIỮ NHIỀU VAI TRÒ ──
// Một ô bấm vào là SỔ XUỐNG danh sách vai trò, mỗi dòng có ô tích. Tích bao nhiêu vai trò cũng được
// (ví dụ vừa tra danh sách nóng vừa vào kho danh mục). Không tích gì thì là khách thường.
const VAI_TRO_DS: [string, string, string][] = [
  ['gis', '🗺️', 'Biên tập GIS'], ['vanban', '📄', 'Quản lý văn bản'],
  ['hotlist', '🔥', 'Tra cứu danh sách nóng'], ['danhmuc', '🗄️', 'Kho danh mục hồ sơ'],
  ['xacthuc', '🔐', 'Tra mã xác thực 2 lớp'], ['admin', '👑', 'Admin — toàn quyền'],
];
function OVaiTro({ u, luu }: { u: any; luu: (roles: string[]) => void }) {
  const [mo, setMo] = useState(false);
  const [dang, setDang] = useState<string[]>(
    Array.isArray(u.roles) && u.roles.length ? u.roles : (u.role ? [u.role] : ['user']));
  const hop = useRef<HTMLDivElement>(null);
  // Máy chủ trả về vai trò mới (sau khi lưu, hoặc khi tải lại bảng) thì cập nhật theo.
  const vanTay = (Array.isArray(u.roles) ? u.roles : []).join(',') + '|' + (u.role || '');
  useEffect(() => {
    setDang(Array.isArray(u.roles) && u.roles.length ? u.roles : (u.role ? [u.role] : ['user']));
  }, [vanTay]);
  // Bấm ra chỗ khác trên trang thì đóng bảng chọn.
  useEffect(() => {
    if (!mo) return;
    const ngoai = (e: MouseEvent) => { if (hop.current && !hop.current.contains(e.target as Node)) setMo(false); };
    document.addEventListener('mousedown', ngoai);
    return () => document.removeEventListener('mousedown', ngoai);
  }, [mo]);
  const bat = (v: string) => {
    const co = dang.includes(v);
    if (v === 'admin' && !co && !confirm(`Cấp quyền ADMIN cho ${u.email}? Tài khoản này sẽ có toàn quyền quản trị.`)) return;
    let moi = co ? dang.filter((x) => x !== v) : [...dang.filter((x) => x !== 'user'), v];
    if (!moi.length) moi = ['user'];                       // bỏ hết vai trò → về khách thường
    setDang(moi);                                          // đổi màu NGAY, khỏi chờ máy chủ trả lời
    luu(moi);
  };
  const daChon = VAI_TRO_DS.filter(([v]) => dang.includes(v));
  return (
    <div className="relative min-w-[168px]" ref={hop}>
      <button onClick={() => setMo(!mo)}
        className="w-full flex items-center justify-between gap-2 border border-slate-300 rounded-lg px-2 py-1 text-xs bg-white hover:border-slate-400">
        <span className="truncate">
          {daChon.length === 0 ? <span className="text-slate-400">Khách thường</span>
            : daChon.length === 1 ? <span className="font-semibold text-[#0B4045]">{daChon[0][1]} {daChon[0][2].split(' — ')[0]}</span>
            : <span className="font-semibold text-[#0B4045]">{daChon.map(([, i]) => i).join(' ')} {daChon.length} vai trò</span>}
        </span>
        <span className="text-slate-400 text-[10px]">▾</span>
      </button>
      {mo && (
        <div className="absolute z-30 mt-1 w-[228px] bg-white border border-slate-200 rounded-xl shadow-xl p-1">
          {VAI_TRO_DS.map(([v, icon, ten]) => {
            const on = dang.includes(v);
            return (
              <button key={v} onClick={() => bat(v)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left transition ${on ? 'bg-[#0B4045]/5' : 'hover:bg-slate-50'}`}>
                <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center text-[10px] font-bold ${on
                  ? (v === 'admin' ? 'bg-[#C8A14B] border-[#C8A14B] text-white' : 'bg-[#0B4045] border-[#0B4045] text-white')
                  : 'border-slate-300 text-transparent'}`}>✓</span>
                <span>{icon}</span>
                <span className={on ? 'font-semibold text-[#0B4045]' : 'text-slate-600'}>{ten}</span>
              </button>
            );
          })}
          <div className="px-2 py-1 text-[10px] text-slate-400 border-t mt-1">Tích được nhiều vai trò cùng lúc</div>
        </div>
      )}
    </div>
  );
}

  async function upd(id: number, patch: any) { try { await api(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }); load(); } catch (e: any) { alert(e.message); } }
  const sel = 'border border-slate-300 rounded px-1.5 py-1 text-xs';
  const pages = Math.max(1, Math.ceil(total / per));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên / email / số điện thoại…" className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <span className="shrink-0 text-sm text-slate-500">{total.toLocaleString('vi')} người dùng</span>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
      <table className="w-full text-sm min-w-[660px]">
        <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-2">Tài khoản</th><th className="p-2">Vai trò</th><th className="p-2">Gói</th><th className="p-2">Trạng thái</th><th className="p-2">Gói đẩy/th</th><th className="p-2">Tư vấn ĐT</th></tr></thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="p-2"><div className="font-semibold text-[#0B4045]">{u.fullName || u.email}</div><div className="text-xs text-slate-400">{u.email} · {u.phone || '—'}</div></td>
              <td className="p-2"><OVaiTro u={u} luu={(roles) => upd(u.id, { roles })} /></td>
              <td className="p-2"><select value={u.tier} onChange={(e) => upd(u.id, { tier: e.target.value })} className={sel}><option value="free">Free</option><option value="paid">Trả phí</option></select></td>
              <td className="p-2"><select value={u.status} onChange={(e) => { const status = e.target.value; if (status === 'suspended' && !confirm(`Khoá tài khoản ${u.email}? Người dùng sẽ không đăng nhập được.`)) return; upd(u.id, { status }); }} className={sel}><option value="active">Hoạt động</option><option value="suspended">Khoá</option></select></td>
              <td className="p-2"><input type="number" min="0" defaultValue={u.boostQuota ?? 0} onBlur={(e) => upd(u.id, { boostQuota: Math.max(0, Number(e.target.value) || 0) })} title="Số lượt đẩy tin/tháng" className="w-16 border border-slate-300 rounded px-1.5 py-1 text-xs" /></td>
              <td className="p-2"><button onClick={() => upd(u.id, { isAdvisor: !u.isAdvisor })} className={`px-2.5 py-1 rounded-full text-xs font-bold ${u.isAdvisor ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`} title="Cho phép tài khoản này trả lời kênh Tư vấn đầu tư">{u.isAdvisor ? '✓ Tư vấn' : 'Tắt'}</button> <select value={String(u.rating ?? 0)} onChange={(e) => upd(u.id, { rating: Number(e.target.value) })} title="Chấm sao môi giới (Cam Lâm Land)" className={sel}><option value="0">☆ chưa</option><option value="3">★★★</option><option value="3.5">★★★½</option><option value="4">★★★★</option><option value="4.5">★★★★½</option><option value="5">★★★★★</option></select></td>
            </tr>
          ))}
          {loading ? <tr><td colSpan={6} className="p-6 text-center text-slate-400"><span className="inline-block w-5 h-5 border-2 border-slate-200 border-t-[#0B4045] rounded-full animate-spin align-[-3px]" /> Đang tải…</td></tr> : rows.length === 0 ? <tr><td colSpan={6} className="p-4 text-slate-500">Không tìm thấy người dùng.</td></tr> : null}
        </tbody>
      </table>
      </div>
      {pages > 1 && <div className="flex items-center justify-center gap-2 text-sm">
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">‹ Trước</button>
        <span className="text-slate-500">Trang {page} / {pages}</span>
        <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Sau ›</button>
      </div>}
    </div>
  );
}

function ListingsAdmin() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => { setLoading(true); api<{ listings: any[] }>('/admin/listings').then((d) => setRows(d.listings)).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(() => { load(); }, [load]);
  async function patch(id: number, p: any) { try { await api(`/admin/listings/${id}`, { method: 'PATCH', body: JSON.stringify(p) }); load(); } catch (e: any) { alert(e.message); } }
  async function del(id: number) { if (!window.confirm('Xoá tin này?')) return; try { await api(`/listings/${id}`, { method: 'DELETE' }); load(); } catch (e: any) { alert(e.message); } }
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
      <table className="w-full text-sm min-w-[720px]">
        <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-2">Tin</th><th className="p-2">Trạng thái</th><th className="p-2">Đẩy tin</th><th className="p-2"></th></tr></thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id} className="border-t">
              <td className="p-2"><div className="font-semibold text-[#0B4045] truncate max-w-[280px]">{l.title}</div><div className="text-xs text-slate-400">{formatVnd(l.price)} · {l.ward || 'Cam Lâm'}</div></td>
              <td className="p-2"><select value={l.status} onChange={(e) => patch(l.id, { status: e.target.value })} className="border border-slate-300 rounded px-1.5 py-1 text-xs"><option value="active">Hiển thị</option><option value="pending">Chờ duyệt</option><option value="hidden">Ẩn</option><option value="sold">Đã bán</option></select></td>
              <td className="p-2 whitespace-nowrap"><select value={l.tier || 'normal'} onChange={(e) => patch(l.id, { tier: e.target.value })} className="border border-slate-300 rounded px-1.5 py-1 text-xs"><option value="normal">Thường</option><option value="silver">VIP Bạc</option><option value="gold">VIP Vàng</option><option value="diamond">VIP Kim cương</option></select><button onClick={() => patch(l.id, { bump: true })} title="Đẩy lên đầu" className="ml-1.5 text-xs font-bold px-2 py-1 rounded bg-[#0B4045] text-white hover:bg-[#0e5157]">↑ Đẩy</button></td>
              <td className="p-2 text-right whitespace-nowrap"><button onClick={() => patch(l.id, { verified: !l.verified })} title="Xác thực bởi Cam Lâm Land" className={`text-xs font-bold px-2 py-1 rounded mr-2 ${l.verified ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{l.verified ? '✔ Đã XT' : 'Xác thực'}</button><Link href={`/listings/${l.id}`} className="text-xs text-[#0B4045] font-semibold mr-3">Xem</Link><button onClick={() => del(l.id)} className="text-xs text-red-600 font-semibold">Xoá</button></td>
            </tr>
          ))}
          {loading ? <tr><td colSpan={4} className="p-6 text-center text-slate-400"><span className="inline-block w-5 h-5 border-2 border-slate-200 border-t-[#0B4045] rounded-full animate-spin align-[-3px]" /> Đang tải…</td></tr> : rows.length === 0 ? <tr><td colSpan={4} className="p-4 text-slate-500">Chưa có tin nào.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function UploadGis() {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState(''); const [layerType, setLayerType] = useState('custom'); const [msg, setMsg] = useState('');
  async function submit() {
    if (!file) return setMsg('Vui lòng chọn tệp .dgn/.shp/.zip/.geojson');
    const fd = new FormData(); fd.append('file', file); fd.append('name', name || file.name); fd.append('layerType', layerType);
    setMsg('⏳ Đang nạp…');
    try { const r = await uploadGis(fd); setMsg(`✅ ${r.message || 'Đã nạp xong'}${r.reprojected ? ' (tự quy đổi VN-2000→WGS84)' : ''}. Mở trang Bản đồ để xem.`); setFile(null); } catch (e: any) { setMsg(`❌ ${e.message}`); }
  }
  return (
    <div className="max-w-lg bg-white border border-slate-200 rounded-xl p-5">
      <h2 className="font-bold text-[#0B4045] mb-3">Tải lên dữ liệu bản đồ</h2>
      <p className="text-sm text-slate-500 mb-3">Nạp trực tiếp <b>.geojson</b>, <b>Shapefile nén .zip</b> hoặc <b>DGN</b> — toạ độ <b>VN-2000/WGS84</b> đều được (tự quy đổi). DGN <b>V8 tự đổi qua mạng</b>; file DGN được xử lý nền, xem tiến độ ở danh sách import.</p>
      <input type="file" accept=".dgn,.shp,.zip,.geojson,.json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mb-3 block w-full text-sm" />
      <input className="border border-slate-300 rounded-md px-3 py-2 w-full mb-2 text-sm" placeholder="Tên lớp (vd: Quy hoạch 2030)" value={name} onChange={(e) => setName(e.target.value)} />
      <select className="border border-slate-300 rounded-md px-3 py-2 w-full mb-3 text-sm" value={layerType} onChange={(e) => setLayerType(e.target.value)}>
        <option value="parcel">Thửa đất</option><option value="zoning">Quy hoạch</option><option value="admin">Ranh giới hành chính</option><option value="road">Giao thông</option><option value="custom">Khác</option>
      </select>
      <button onClick={submit} className="bg-[#0B4045] hover:bg-[#0e5157] text-white px-4 py-2 rounded-md text-sm font-semibold">Tải lên & xử lý</button>
      {msg && <p className="text-sm mt-3">{msg}</p>}
    </div>
  );
}

function Logs() {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const load = () => api<{ jobs: ImportJob[] }>('/imports').then((d) => setJobs(d.jobs)).catch(() => {});
  useEffect(() => { load(); const i = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 4000); return () => clearInterval(i); }, []); // tạm dừng khi tab ẩn
  const color: Record<string, string> = { done: 'text-emerald-700', error: 'text-red-600', processing: 'text-amber-600', pending: 'text-slate-500' };
  async function del(j: ImportJob) {
    if (!window.confirm(`Xoá "${j.layerName || j.originalFilename}" và lớp dữ liệu của nó?`)) return;
    try { await api(`/imports/${j.id}`, { method: 'DELETE' }); load(); } catch (e: any) { alert('Lỗi xoá: ' + e.message); }
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-2">#</th><th className="p-2">Tệp</th><th className="p-2">Định dạng</th><th className="p-2">Trạng thái</th><th className="p-2">Features</th><th className="p-2 text-right">Xoá</th></tr></thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} className="border-t align-top">
              <td className="p-2">{j.id}</td>
              <td className="p-2">{j.originalFilename}<div className="text-xs text-slate-400">{j.layerName}</div></td>
              <td className="p-2 uppercase">{j.sourceFormat}</td>
              <td className={`p-2 font-medium ${color[j.status]}`}>{j.status}</td>
              <td className="p-2">{j.featureCount ?? '—'}</td>
              <td className="p-2 text-right"><button onClick={() => del(j)} className="text-red-600 hover:underline text-xs font-medium">Xoá</button></td>
            </tr>
          ))}
          {jobs.length === 0 && <tr><td colSpan={6} className="p-4 text-slate-500">Chưa có job nào.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Payments() {
  const [rows, setRows] = useState<any[]>([]);
  const load = useCallback(() => { api<{ payments: any[] }>('/payments').then((d) => setRows(d.payments || [])).catch(() => {}); }, []);
  useEffect(() => { load(); const i = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 8000); return () => clearInterval(i); }, [load]); // tạm dừng khi tab ẩn
  async function confirm(id: number) { if (!window.confirm('Xác nhận đã nhận tiền & kích hoạt gói cho khách?')) return; try { await api(`/payments/${id}/confirm`, { method: 'POST' }); load(); } catch (e: any) { alert(e.message); } }
  const fmt = (n: number) => Number(n).toLocaleString('vi-VN') + 'đ';
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
      <table className="w-full text-sm min-w-[720px]">
        <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-2">#</th><th className="p-2">Khách</th><th className="p-2">Gói</th><th className="p-2">Số tiền</th><th className="p-2">Nội dung CK</th><th className="p-2">Trạng thái</th><th className="p-2"></th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="p-2">{p.id}</td>
              <td className="p-2"><div className="font-semibold text-[#0B4045]">{p.userName}</div><div className="text-xs text-slate-400">{p.email}</div></td>
              <td className="p-2 uppercase">{p.packageId}</td>
              <td className="p-2 font-bold text-red-600">{fmt(p.amount)}</td>
              <td className="p-2 font-mono text-xs">{p.note}</td>
              <td className={`p-2 font-semibold ${p.status === 'paid' ? 'text-emerald-700' : 'text-amber-600'}`}>{p.status === 'paid' ? 'Đã thanh toán' : 'Chờ thanh toán'}</td>
              <td className="p-2 text-right">{p.status !== 'paid' && <button onClick={() => confirm(p.id)} className="text-xs font-bold text-white bg-[#0B4045] hover:bg-[#0e5157] rounded px-2.5 py-1">✓ Xác nhận</button>}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={7} className="p-4 text-slate-500">Chưa có đơn nào.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
