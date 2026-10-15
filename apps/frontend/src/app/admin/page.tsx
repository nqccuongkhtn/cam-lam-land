'use client';
import { TheQc, CssQc, MAU_QC, dangChay, dsCua, type OQc } from '@/components/OQuangCaoTrangChu';
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
      <p className="text-xl font-bold text-[#0A2540]">Không có quyền truy cập</p>
      <p className="text-slate-500 mt-2 text-sm">Trang này chỉ dành cho admin / biên tập bản đồ. <Link href="/" target="_top" className="text-[#0A2540] font-semibold underline">Về trang chủ</Link></p>
    </div>
  );
  const isGis = coVaiTro(user, 'gis') && !laAdmin(user);   // chỉ có mỗi vai trò GIS → rút gọn màn hình
  const shownTabs = isGis ? TABS.filter(([t]) => t === 'upload' || t === 'logs') : TABS;
  return (
    <div className={`mx-auto max-w-6xl px-4 ${embedded ? 'py-4' : 'py-6'}`}>
      {!embedded && <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-[#0A2540]">{isGis ? 'Quản lý bản đồ GIS' : 'Bảng điều khiển quản trị'}</h1>
        <button onClick={() => { logout(); router.replace('/login'); }} className="text-sm text-slate-500 hover:text-slate-800">Đăng xuất</button>
      </div>}
      {!embedded && <div className="flex gap-1 border-b mb-5 overflow-x-auto">
        {shownTabs.map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold border-b-2 whitespace-nowrap ${tab === t ? 'border-[#C8A14B] text-[#0A2540]' : 'border-transparent text-slate-500'}`}>{l}</button>
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
  const [ad, setAd] = useState<any>({ enabled: true, images: ['/tin-mau/nha-01.webp'], link: '/sales/post', title: 'ĐĂNG TIN NHÀ ĐẤT MIỄN PHÍ', sub: 'Tiếp cận hàng nghìn khách mua tại Cam Lâm', cta: 'Đăng ngay' });
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
          <p className="font-bold text-[#0A2540]">🗺️ Quảng cáo trên bản đồ</p>
          <p className="text-sm text-slate-500 mt-0.5">Logo ghim điểm / chữ mờ trên bản đồ quy hoạch — đang chạy <b>{mapCount ?? '…'}</b> quảng cáo.</p>
        </div>
        <Link href="/map-ads" className="shrink-0 bg-[#0A2540] hover:bg-[#0d2f54] text-white font-bold px-4 py-2 rounded-xl text-sm whitespace-nowrap">Quản lý →</Link>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <p className="font-bold text-[#0A2540]">📢 Banner trang Tin tức (2 bên)</p>
          <button onClick={() => setAd((a: any) => ({ ...a, enabled: a.enabled === false }))} aria-label="Bật/tắt" className={`w-12 h-7 rounded-full relative transition ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}><span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${on ? 'left-6' : 'left-1'}`} /></button>
        </div>
        <p className="text-xs text-slate-500 mt-1">Bật thì quảng cáo này được xếp ĐẦU hàng quảng cáo trang Tin tức, chạy luân phiên cùng các quảng cáo của 2 ô trang chủ (dải trên đầu, giữa danh sách tin, cột bên). Chỉ lấy ảnh đầu tiên — nên dùng ảnh ngang, vd 800×500.</p>
        <div className="grid sm:grid-cols-[1fr_170px] gap-4 mt-3 items-start">
          <div className="space-y-2.5">
            <textarea value={(ad.images && ad.images.length ? ad.images : ad.image ? [ad.image] : []).join('\n')} onChange={(e) => setAd((a: any) => ({ ...a, images: e.target.value.split('\n').map((x: string) => x.trim()).filter(Boolean) }))} rows={3} placeholder="URL ảnh — MỖI DÒNG 1 ẢNH (nhiều ảnh = chạy slideshow động)" className={inp} />
            <input value={ad.link || ''} onChange={(e) => setF('link', e.target.value)} placeholder="Link khi bấm (vd /sales/post)" className={inp} />
            <input value={ad.title || ''} onChange={(e) => setF('title', e.target.value)} placeholder="Tiêu đề" className={inp} />
            <input value={ad.sub || ''} onChange={(e) => setF('sub', e.target.value)} placeholder="Mô tả ngắn" className={inp} />
            <input value={ad.cta || ''} onChange={(e) => setF('cta', e.target.value)} placeholder="Chữ nút" className={inp} />
            <div className="flex items-center gap-3"><button onClick={save} className="bg-[#0A2540] hover:bg-[#0d2f54] text-white font-bold px-4 py-2 rounded-xl text-sm">Lưu</button>{adMsg && <span className="text-xs font-medium text-slate-600">{adMsg}</span>}</div>
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
                    <span className="mt-1.5 block bg-[#C8A14B] text-[#0A2540] text-[11px] font-bold py-1 rounded">{ad.cta || 'Xem'} →</span>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#0A2540] to-[#10355f] text-white p-2 flex flex-col justify-center text-center">
                  <p className="font-extrabold text-sm">{ad.title}</p>
                  {ad.sub && <p className="text-[10px] text-white/80 mt-1">{ad.sub}</p>}
                  <span className="mt-2 inline-block bg-[#C8A14B] text-[#0A2540] text-[11px] font-bold px-2 py-1 rounded">{ad.cta || 'Xem'} →</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <QcTrangChu />

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <p className="font-bold text-[#0A2540]">📣 Banner liên hệ quảng cáo (trang chủ)</p>
        <p className="text-sm text-slate-500 mt-0.5">Hiện ở cuối trang chủ khi <b>Dịch vụ</b> đang bật. Bật/tắt ở tab <b>Cấu hình</b>.</p>
      </div>
    </div>
  );
}
// HAI Ô QUẢNG CÁO CẠNH TIN TỨC Ở TRANG CHỦ (khoá trangchu_ad) — xem components/OQuangCaoTrangChu.tsx.
// Mỗi ô chứa NHIỀU quảng cáo, trang chủ tự trượt luân phiên.
const maMoi = () => Math.random().toString(36).slice(2, 9);
function QcTrangChu() {
  const [ch, setCh] = useState<{ o1: OQc[]; o2: OQc[]; kieu: 'dong' | 'the' }>({ o1: [], o2: [], kieu: 'dong' });
  const [msg, setMsg] = useState('');
  useEffect(() => { api<{ value: any }>('/config/trangchu_ad').then((r) => { if (r.value && typeof r.value === 'object') setCh({ o1: dsCua(r.value.o1).map((o) => ({ id: maMoi(), ...o })), o2: dsCua(r.value.o2).map((o) => ({ id: maMoi(), ...o })), kieu: r.value.kieu === 'the' ? 'the' : 'dong' }); }).catch(() => {}); }, []);
  const sua = (k: 'o1' | 'o2', id: string, f: keyof OQc, v: any) => setCh((c) => ({ ...c, [k]: c[k].map((o) => (o.id === id ? { ...o, [f]: v } : o)) }));
  const them = (k: 'o1' | 'o2') => setCh((c) => ({ ...c, [k]: [...c[k], { id: maMoi(), bat: true, mau: k === 'o1' ? 'do' : 'xanh' }] }));
  const xoa = (k: 'o1' | 'o2', id: string) => { if (confirm('Xoá quảng cáo này khỏi ô? (bấm Lưu mới có hiệu lực)')) setCh((c) => ({ ...c, [k]: c[k].filter((o) => o.id !== id) })); };
  const doiCho = (k: 'o1' | 'o2', id: string, d: number) => setCh((c) => { const a = [...c[k]]; const i = a.findIndex((o) => o.id === id); const j = i + d; if (j < 0 || j >= a.length) return c; [a[i], a[j]] = [a[j], a[i]]; return { ...c, [k]: a }; });
  async function save() { setMsg('Đang lưu…'); try { await api('/config/trangchu_ad', { method: 'POST', body: JSON.stringify({ value: ch }) }); setMsg('✓ Đã lưu — trang chủ đổi sau khoảng 1 phút.'); } catch (e: any) { setMsg('✗ ' + (e?.message || 'Lỗi')); } }
  const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm';
  const homNay = new Date().toISOString().slice(0, 10);
  // Gọi như hàm thường (không phải <MotQc/>) để ô nhập không bị dựng lại mất chữ đang gõ
  const MotQc = (k: 'o1' | 'o2', o: OQc, thu: number, tong: number) => {
    const id = o.id!;
    const chay = dangChay(o);
    const quaHan = !!o.hanDen && o.hanDen < homNay;
    return (
      <div key={id} className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-[#0A2540]">Quảng cáo {thu + 1}{o.khach ? <span className="font-normal text-slate-500"> · {o.khach}</span> : null}</p>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => doiCho(k, id, -1)} disabled={thu === 0} title="Lên trước" className="w-7 h-7 rounded border border-slate-200 text-slate-500 disabled:opacity-30">↑</button>
            <button onClick={() => doiCho(k, id, 1)} disabled={thu === tong - 1} title="Xuống sau" className="w-7 h-7 rounded border border-slate-200 text-slate-500 disabled:opacity-30">↓</button>
            <button onClick={() => xoa(k, id)} className="px-2 h-7 rounded border border-red-200 text-red-600 text-xs font-semibold">Xoá</button>
            <button onClick={() => sua(k, id, 'bat', !o.bat)} aria-label="Bật/tắt" className={`w-12 h-7 rounded-full relative transition ${o.bat ? 'bg-emerald-500' : 'bg-slate-300'}`}><span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${o.bat ? 'left-6' : 'left-1'}`} /></button>
          </div>
        </div>
        <p className={`text-xs mt-1 font-medium ${chay ? 'text-emerald-600' : quaHan ? 'text-red-600' : 'text-slate-500'}`}>
          {chay ? '● Đang chạy' : quaHan ? '● Đã hết hạn — không hiện nữa' : !o.tieuDe?.trim() ? '● Chưa có tiêu đề — chưa hiện' : '● Đang tắt'}
        </p>
        <div className="grid sm:grid-cols-[1fr_210px] gap-3 mt-2 items-start">
          <div className="space-y-2">
            <input defaultValue={o.khach || ''} onBlur={(e) => sua(k, id, 'khach', e.target.value)} placeholder="Tên khách đặt + SĐT (chỉ để nhớ, không hiện ra web)" className={inp} />
            <input defaultValue={o.nhan || ''} onBlur={(e) => sua(k, id, 'nhan', e.target.value)} placeholder="Nhãn nhỏ — vd: DỰ ÁN MỚI · ĐẤT NỀN BÃI DÀI" className={inp} />
            <input defaultValue={o.tieuDe || ''} onBlur={(e) => sua(k, id, 'tieuDe', e.target.value)} placeholder="Tiêu đề (bắt buộc) — vd: Đất nền ven biển Bãi Dài, sổ riêng" className={inp} />
            <input defaultValue={o.moTa || ''} onBlur={(e) => sua(k, id, 'moTa', e.target.value)} placeholder="Một dòng mô tả — chỉ hiện trên máy tính" className={inp} />
            <div className="grid grid-cols-2 gap-2">
              <input defaultValue={o.nut || ''} onBlur={(e) => sua(k, id, 'nut', e.target.value)} placeholder="Chữ nút — vd: Xem dự án" className={inp} />
              <label className="flex items-center gap-2 text-xs text-slate-500">Hết hạn<input type="date" value={o.hanDen || ''} onChange={(e) => sua(k, id, 'hanDen', e.target.value)} className={inp} /></label>
            </div>
            <input defaultValue={o.link || ''} onBlur={(e) => sua(k, id, 'link', e.target.value)} placeholder="Bấm vào đi đâu — /listings/123 · https://... · tel:0567442996 · https://zalo.me/0582594956" className={inp} />
            <input defaultValue={o.anh || ''} onBlur={(e) => sua(k, id, 'anh', e.target.value)} placeholder="Link ảnh nền (nên có — ảnh chạy động) — ảnh ngang, vd 800×500" className={inp} />
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">Màu (khi không có ảnh):
              {Object.entries(MAU_QC).map(([mid, m]) => <button key={mid} onClick={() => sua(k, id, 'mau', mid)} className={`px-2 py-1 rounded text-[11px] font-bold ${(o.mau || 'xanh') === mid ? 'ring-2 ring-offset-1 ring-[#0A2540]' : ''}`} style={{ background: m.nen, color: m.chu }}>{m.ten}</button>)}
            </div>
          </div>
          <div>
            <p className="text-[11px] text-slate-400 mb-1.5 text-center">Xem trước (máy tính)</p>
            {o.tieuDe?.trim() ? <TheQc o={o} xemTruoc /> : <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">Nhập tiêu đề để xem trước</div>}
          </div>
        </div>
      </div>
    );
  };
  const MotO = (k: 'o1' | 'o2', ten: string, macDinh: string) => {
    const ds = ch[k];
    const soChay = ds.filter((o) => dangChay(o)).length;
    return (
      <div className="rounded-xl border border-slate-200 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-bold text-[#0A2540] text-sm">{ten}</p>
          <p className={`text-xs font-medium ${soChay ? 'text-emerald-600' : 'text-slate-500'}`}>{soChay ? `${soChay} quảng cáo đang chạy${soChay > 1 ? ' — tự trượt luân phiên 5 giây/cái' : ''}` : `Chưa có quảng cáo chạy → đang hiện thẻ của web (${macDinh})`}</p>
        </div>
        <div className="space-y-2.5 mt-2.5">
          {ds.map((o, i) => MotQc(k, o, i, ds.length))}
          <button onClick={() => them(k)} className="w-full rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">＋ Thêm quảng cáo vào ô này</button>
        </div>
      </div>
    );
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <CssQc />
      <p className="font-bold text-[#0A2540]">🏠 2 ô quảng cáo trang chủ (cạnh Tin tức)</p>
      <p className="text-xs text-slate-500 mt-1">Vị trí đẹp nhất web — ngay màn hình đầu, ai vào trang chủ cũng thấy. Mỗi ô nhận <b>nhiều quảng cáo, tự trượt luân phiên</b> (điện thoại vuốt được). Quảng cáo tắt hoặc <b>quá ngày hết hạn là tự bỏ ra</b>; ô hết quảng cáo thì quay về thẻ của web.</p>
      {/* Cách hiện trên MÁY TÍNH (điện thoại luôn là 1 dòng như tin tức) — xem QcMayTinh trong OQuangCaoTrangChu.tsx */}
      <div className="mt-3 rounded-lg border border-slate-200 p-3">
        <p className="text-sm font-semibold text-[#0A2540]">Cách hiện trên máy tính</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {([['dong', 'Dòng tin (mặc định)', 'Chữ "QUẢNG CÁO" xám + 2 dòng: ảnh nhỏ trái, tiêu đề đậm — giống dòng tin tức bên cạnh. 6 giây đổi 2 quảng cáo kế tiếp.'],
             ['the', 'Thẻ kiểu báo (dự phòng)', 'Một thẻ: ảnh to sáng phía trên, tiêu đề, mô tả, nút xanh đậm. 6 giây đổi một quảng cáo.']] as const).map(([k, t, m]) => (
            <label key={k} className={`flex cursor-pointer gap-2 rounded-lg border p-2.5 text-sm ${ch.kieu === k ? 'border-[#0A2540] bg-slate-50' : 'border-slate-200'}`}>
              <input type="radio" name="kieu-qc" checked={ch.kieu === k} onChange={() => setCh((c) => ({ ...c, kieu: k }))} className="mt-0.5" />
              <span><b className="block text-[#0A2540]">{t}</b><span className="text-xs text-slate-500">{m}</span></span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Điện thoại luôn hiện 1 dòng như tin tức. Ô xem trước bên dưới chỉ để xem nội dung, không phải hình dạng thật trên trang chủ.</p>
      </div>
      <div className="space-y-3 mt-3">
        {MotO('o1', 'Ô 1 — trên (chỗ ô đỏ)', 'Bản đồ quy hoạch')}
        {MotO('o2', 'Ô 2 — dưới (chỗ ô xanh)', 'Đăng tin miễn phí')}
      </div>
      <div className="sticky bottom-0 bg-white/95 py-2 flex items-center gap-3 mt-3"><button onClick={save} className="bg-[#0A2540] hover:bg-[#0d2f54] text-white font-bold px-4 py-2 rounded-xl text-sm">Lưu</button>{msg && <span className="text-xs font-medium text-slate-600">{msg}</span>}</div>
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
            <p className="font-bold text-[#0A2540]">{title}</p>
            <p className="text-sm text-slate-500 mt-0.5">{desc}</p>
          </div>
          <button onClick={() => toggle(key, !flags[key])} disabled={busy === key} aria-label="Bật/tắt"
            className={`shrink-0 w-14 h-8 rounded-full transition relative ${flags[key] ? 'bg-emerald-500' : 'bg-slate-300'}`}>
            <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${flags[key] ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
      ))}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <p className="font-bold text-[#0A2540]">📰 Tin tức thị trường (trang chủ)</p>
        <p className="text-sm text-slate-500 mt-0.5">Tự lấy bài BĐS từ nguồn uy tín (VnExpress, CafeF, Báo Xây dựng) và hiển thị ở tab “Thị trường BĐS” — chạy sẵn trong web, không cần thao tác.</p>
      </div>
      <p className="text-xs text-slate-400">{flags.services_live ? '🟢 Dịch vụ đang công khai với khách.' : '🔒 Dịch vụ đang ẩn — chỉ admin xem được.'}</p>
    </div>
  );
}
function Stat({ label, value, sub }: { label: string; value: any; sub?: string }) {
  return <div className="bg-white rounded-2xl border border-slate-200 p-4"><p className="text-2xl md:text-3xl font-extrabold text-[#0A2540]">{value}</p><p className="text-sm text-slate-500">{label}</p>{sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}</div>;
}
function Row({ k, v }: { k: string; v: number }) {
  return <div className="flex justify-between text-sm py-1 border-b border-slate-50"><span className="text-slate-600">{k}</span><b className="text-[#0A2540]">{v}</b></div>;
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
      <h3 className="font-bold text-[#0A2540] mb-1">📊 Lượt đọc toạ độ (OCR) hôm nay · {dmy(d.ymd)}</h3>
      <p className="text-xs text-slate-400 mb-3">Reset mỗi ngày (giờ VN). Theo dõi để không vượt hạn miễn phí của từng nguồn.</p>
      <table className="w-full text-sm">
        <thead className="text-left text-slate-500"><tr><th className="py-1">Nguồn AI</th><th className="py-1 text-right">Đã dùng</th><th className="py-1 text-right">Giới hạn free/ngày</th></tr></thead>
        <tbody>
          {['gemini', 'groq', 'openrouter', 'ocrspace', 'self', 'tesseract'].map((eng) => {
            const c = today.find((r) => r.engine === eng)?.count ?? 0;
            return <tr key={eng} className="border-t border-slate-50"><td className="py-1.5 text-slate-600">{OCR_LABELS[eng]}</td><td className="py-1.5 text-right font-bold text-[#0A2540]">{c}</td><td className="py-1.5 text-right text-slate-400 text-xs">{OCR_LIMITS[eng]}</td></tr>;
          })}
        </tbody>
      </table>
      {Array.isArray(d.last7) && d.last7.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-500 mb-1.5">7 ngày gần đây (tổng/ngày)</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            {d.last7.map((r: any) => <span key={r.ymd}>{dmy(String(r.ymd).slice(5))}: <b className="text-[#0A2540]">{r.total}</b></span>)}
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
      <Link href="/admin/traffic" className="flex items-center justify-between bg-gradient-to-r from-[#0A2540] to-[#16324f] text-white rounded-2xl p-4 hover:opacity-95">
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
        <div className="bg-white rounded-2xl border border-slate-200 p-4"><h3 className="font-bold text-[#0A2540] mb-2">Tin theo loại hình</h3>{s.byType.map((r: any) => <Row key={r.type} k={PROPERTY_LABELS[r.type as keyof typeof PROPERTY_LABELS] || r.type} v={r.n} />)}</div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4"><h3 className="font-bold text-[#0A2540] mb-2">Tin theo xã</h3>{s.byWard.map((r: any) => <Row key={r.ward} k={r.ward} v={r.n} />)}</div>
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
    <div className="bg-gradient-to-r from-[#0A2540] to-[#10355f] text-white rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold">🧪 Dữ liệu mẫu để kiểm thử</p>
          <p className="text-sm text-white/70 mt-0.5">Tạo nhanh 347 tin (179 bán + 168 thuê, giá sát thị trường, đủ loại + VIP, 80% ở xã ven biển/trung tâm) + 168 chat cộng đồng (~10 người) + nhiều luồng hỗ trợ/tư vấn + khách gửi bán + đăng ký đầu tư. Xoá sạch khi test xong.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button onClick={seed} disabled={!!busy} className="flex-1 sm:flex-none whitespace-nowrap bg-[#C8A14B] hover:bg-[#b8923f] disabled:opacity-60 text-[#0A2540] font-bold px-4 py-2 rounded-xl">{busy === 'seed' ? 'Đang tạo…' : '＋ Tạo 347 tin mẫu'}</button>
          <button onClick={clearAll} disabled={!!busy} className="flex-1 sm:flex-none whitespace-nowrap bg-white/10 hover:bg-white/20 disabled:opacity-60 border border-white/30 text-white font-bold px-4 py-2 rounded-xl">{busy === 'clear' ? 'Đang xoá…' : 'Xoá dữ liệu mẫu'}</button>
        </div>
      </div>
      {msg && <p className="text-sm mt-2 font-semibold text-[#FFD56A]">{msg}</p>}
    </div>
  );
}

// ══ QUẢN LÝ TÀI KHOẢN TRẢ PHÍ (15/10/2026) ══
// Chủ dự án: "trả phí chia ra là các chức năng chung, còn trả phí mua gói số tin đăng, đẩy tin hay quảng cáo bản đồ là chức năng riêng".
//  · CHỨC NĂNG CHUNG = MỘT gói có hạn dùng: tra cứu văn bản · tính giá đền bù · bản đồ quy hoạch Cam Lâm (trừ 1/500). Admin cấp / gia hạn
//    (cộng dồn) / thu hồi — POST /api/admin/users/:id/goi-chung.
//  · CHỨC NĂNG RIÊNG = gói số tin đăng · gói đẩy tin · tạo video bản đồ (kích hoạt bằng tay như đơn đã trả tiền — /kich-hoat, có dấu vết ở
//    thẻ Thanh toán; thu hồi — /thu-hoi) · quảng cáo bản đồ (không gắn tài khoản — quản lý ở thẻ "Quảng cáo").
const conNgay = (iso?: string | null) => { if (!iso) return 0; const ms = new Date(iso).getTime() - Date.now(); return ms > 0 ? Math.ceil(ms / 86400000) : 0; };
const ngayVn = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('vi-VN') : '');
const TEN_HANG: Record<string, string> = { normal: 'Đẩy Thường', silver: 'VIP Bạc', gold: 'VIP Vàng', diamond: 'VIP Kim Cương' };
/** Ô tóm tắt trong bảng người dùng: mỗi gói còn hạn một nhãn nhỏ; không có gì → "Miễn phí". */
function TomTatTraPhi({ u }: { u: any }) {
  const nhan: [string, string][] = [];
  const c = conNgay(u.goiChungHetHan);
  if (c) nhan.push([`⭐ Gói chung · ${c} ngày`, 'bg-[#C8A14B]/15 text-[#7a5c17]']);
  if (conNgay(u.postExpiresAt)) nhan.push([`📝 ${u.postQuota} tin`, 'bg-emerald-50 text-emerald-700']);
  if (conNgay(u.boostExpiresAt)) nhan.push([`🚀 ${TEN_HANG[u.pkgTier] || 'Đẩy tin'}`, 'bg-sky-50 text-sky-700']);
  if (conNgay(u.videoExpiresAt)) nhan.push(['🎬 Video', 'bg-violet-50 text-violet-700']);
  return (
    <span className="flex flex-wrap items-center gap-1">
      {nhan.length ? nhan.map(([t, m]) => <span key={t} className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold ${m}`}>{t}</span>)
        : <span className="text-[11px] text-slate-400">Miễn phí</span>}
      <span className="whitespace-nowrap text-[11px] font-semibold text-[#0A2540] underline decoration-dotted">Quản lý ›</span>
    </span>
  );
}
function QuanLyTraPhi({ u, onDong, onDoi }: { u: any; onDong: () => void; onDoi: () => void }) {
  const [goi, setGoi] = useState<any[]>([]);
  const [ban, setBan] = useState('');
  const [chonTin, setChonTin] = useState(''); const [chonDay, setChonDay] = useState(''); const [chonTv, setChonTv] = useState(''); const [ngayTay, setNgayTay] = useState('');
  useEffect(() => { api<{ packages: any[] }>('/payments/packages').then((r) => setGoi(r.packages || [])).catch(() => {}); }, []);
  const goiTin = goi.filter((p) => p.kind === 'post'), goiDay = goi.filter((p) => p.kind === 'boost'), goiTv = goi.filter((p) => p.kind === 'chung');
  const ten = u.fullName || u.email;
  async function lam(viec: string, duong: string, body: any, hoi?: string) {
    if (hoi && !confirm(hoi)) return;
    setBan(viec);
    try { await api(`/admin/users/${u.id}/${duong}`, { method: 'POST', body: JSON.stringify(body) }); onDoi(); }
    catch (e: any) { alert(e.message); } finally { setBan(''); }
  }
  const nut = 'rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-[#0A2540] hover:border-[#0A2540] disabled:opacity-40';
  const nutThuHoi = 'rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40';
  const TrangThai = ({ iso, con }: { iso?: string | null; con: string }) => {
    const n = conNgay(iso);
    return n ? <p className="text-[12.5px] font-semibold text-emerald-700">✓ {con} · còn {n} ngày (đến {ngayVn(iso)})</p>
      : <p className="text-[12.5px] text-slate-400">{iso ? `Đã hết hạn ngày ${ngayVn(iso)}` : 'Chưa có'}</p>;
  };
  const c = conNgay(u.goiChungHetHan);
  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/50 p-3" onClick={onDong}>
      <div role="dialog" aria-modal="true" aria-label="Quản lý trả phí" onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-[440px] overflow-y-auto rounded-lg bg-white p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="text-[15px] font-bold text-[#0A2540]">Quản lý trả phí</p>
            <p className="truncate text-xs text-slate-500">{ten}{u.fullName ? ` · ${u.email}` : ''}</p></div>
          <button type="button" onClick={onDong} aria-label="Đóng" className="grid h-8 w-8 shrink-0 place-items-center rounded text-slate-400 hover:bg-slate-100">✕</button>
        </div>

        <div className="mt-3 rounded-lg border border-[#C8A14B]/50 bg-[#C8A14B]/5 p-3">
          <p className="text-[13px] font-bold text-[#0A2540]">⭐ Gói chức năng chung</p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">Tra cứu văn bản · tính giá đền bù · bản đồ quy hoạch Cam Lâm đầy đủ (trừ 1/500)</p>
          <div className="mt-1.5"><TrangThai iso={u.goiChungHetHan} con="Đang dùng" /></div>
          {/* GÓI THÀNH VIÊN (lib/packages.ts kind 'chung': 3 tháng 299K · 6 tháng 568K · 1 năm 1068K · 2 năm 1968K) — kích hoạt = ghi đơn "ADMIN" ở
              thẻ Thanh toán (biết đã bán gói nào, bao nhiêu tiền). Cộng tay số ngày (dùng thử / bù ngày) KHÔNG ghi đơn. */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <select value={chonTv} onChange={(e) => setChonTv(e.target.value)} className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-1.5 py-1 text-xs">
              <option value="">Chọn gói thành viên…</option>{goiTv.map((p) => <option key={p.id} value={p.id}>{p.name} · {Math.round(p.price / 1000)}K</option>)}
            </select>
            <button type="button" disabled={!chonTv || !!ban} onClick={() => lam('chung', 'kich-hoat', { packageId: chonTv },
              `Kích hoạt "${goiTv.find((p) => p.id === chonTv)?.name}" (${Math.round((goiTv.find((p) => p.id === chonTv)?.price || 0) / 1000)}K) cho ${ten}? Ghi một đơn "ADMIN" ở thẻ Thanh toán; gói còn hạn thì cộng dồn.`)} className={nut}>Kích hoạt</button>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <input value={ngayTay} onChange={(e) => setNgayTay(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="số ngày"
              className="w-20 rounded border border-slate-300 px-1.5 py-1 text-xs" />
            <button type="button" disabled={!Number(ngayTay) || !!ban} onClick={() => lam('chung', 'goi-chung', { ngay: Number(ngayTay) },
              `Cộng tay ${Number(ngayTay)} ngày Gói chức năng chung cho ${ten}? (không ghi đơn thanh toán — dùng cho dùng thử / bù ngày)`)} className={nut}>Cộng tay</button>
            {c > 0 && <button type="button" disabled={!!ban} onClick={() => lam('chung', 'goi-chung', { ngay: 0 }, `Thu hồi Gói chức năng chung của ${ten}? Tài khoản bị khoá lại các tính năng trả phí chung ngay.`)} className={nutThuHoi}>Thu hồi</button>}
          </div>
          <p className="mt-1.5 text-[10.5px] text-slate-400">Gói còn hạn thì cộng dồn từ ngày hết hạn. Áp dụng ngay, khách không phải đăng nhập lại.</p>
        </div>

        <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-slate-400">Chức năng riêng · mua riêng từng gói</p>
        <div className="mt-1.5 divide-y divide-slate-100 rounded-lg border border-slate-200">
          <div className="p-3">
            <p className="text-[13px] font-bold text-[#0A2540]">📝 Gói số tin đăng</p>
            <TrangThai iso={u.postExpiresAt} con={`${u.postQuota} tin/tháng · đã đăng ${u.postUsed ?? 0}`} />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <select value={chonTin} onChange={(e) => setChonTin(e.target.value)} className="min-w-0 flex-1 rounded border border-slate-300 px-1.5 py-1 text-xs">
                <option value="">Chọn gói…</option>{goiTin.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.days} ngày</option>)}
              </select>
              <button type="button" disabled={!chonTin || !!ban} onClick={() => lam('post', 'kich-hoat', { packageId: chonTin },
                `Kích hoạt gói "${goiTin.find((p) => p.id === chonTin)?.name}" cho ${ten}? (ghi một đơn "ADMIN" ở thẻ Thanh toán; gói đăng tin đang dùng sẽ được thay)`)} className={nut}>Kích hoạt</button>
              {conNgay(u.postExpiresAt) > 0 && <button type="button" disabled={!!ban} onClick={() => lam('post', 'thu-hoi', { loai: 'post' }, `Thu hồi gói số tin đăng của ${ten}?`)} className={nutThuHoi}>Thu hồi</button>}
            </div>
          </div>
          <div className="p-3">
            <p className="text-[13px] font-bold text-[#0A2540]">🚀 Gói đẩy tin</p>
            <TrangThai iso={u.boostExpiresAt} con={`${TEN_HANG[u.pkgTier] || 'Đẩy tin'} · đã đẩy ${u.boostUsed ?? 0}/${u.boostQuota ?? 0}`} />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <select value={chonDay} onChange={(e) => setChonDay(e.target.value)} className="min-w-0 flex-1 rounded border border-slate-300 px-1.5 py-1 text-xs">
                <option value="">Chọn gói…</option>{goiDay.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.days} ngày</option>)}
              </select>
              <button type="button" disabled={!chonDay || !!ban} onClick={() => lam('boost', 'kich-hoat', { packageId: chonDay },
                `Kích hoạt gói "${goiDay.find((p) => p.id === chonDay)?.name}" cho ${ten}? (ghi một đơn "ADMIN" ở thẻ Thanh toán; gói đẩy tin đang dùng sẽ được thay)`)} className={nut}>Kích hoạt</button>
              {conNgay(u.boostExpiresAt) > 0 && <button type="button" disabled={!!ban} onClick={() => lam('boost', 'thu-hoi', { loai: 'boost' }, `Thu hồi gói đẩy tin của ${ten}?`)} className={nutThuHoi}>Thu hồi</button>}
            </div>
          </div>
          <div className="p-3">
            <p className="text-[13px] font-bold text-[#0A2540]">🎬 Tạo video bản đồ</p>
            <TrangThai iso={u.videoExpiresAt} con="Đang dùng" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button type="button" disabled={!!ban} onClick={() => lam('video', 'video', { videoDays: 30 }, `Cấp thêm 30 ngày tạo video bản đồ cho ${ten}?`)} className={nut}>+30 ngày</button>
              {conNgay(u.videoExpiresAt) > 0 && <button type="button" disabled={!!ban} onClick={() => lam('video', 'video', { videoDays: 0 }, `Thu hồi quyền tạo video của ${ten}?`)} className={nutThuHoi}>Thu hồi</button>}
            </div>
          </div>
          <div className="p-3">
            <p className="text-[13px] font-bold text-[#0A2540]">📍 Quảng cáo trên bản đồ</p>
            <p className="text-[12px] leading-snug text-slate-500">Quảng cáo gắn theo nhà quảng cáo (tên + số điện thoại), không theo tài khoản — đặt / gia hạn ở thẻ <b>Quảng cáo</b>.</p>
          </div>
        </div>
        {ban && <p className="mt-2 text-center text-xs text-slate-500">Đang lưu…</p>}
      </div>
    </div>
  );
}

function Users() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(''); const [dq, setDq] = useState(''); const [page, setPage] = useState(1); const [total, setTotal] = useState(0); const per = 30;
  const [chiTraPhi, setChiTraPhi] = useState(false);              // chỉ hiện tài khoản đang có gói trả phí còn hạn
  const [dangQl, setDangQl] = useState<number | null>(null);      // tài khoản đang mở khung Quản lý trả phí
  useEffect(() => { const t = setTimeout(() => { setDq(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const load = useCallback(() => { setLoading(true); api<{ users: any[]; total: number }>(`/admin/users?q=${encodeURIComponent(dq)}&page=${page}&per=${per}${chiTraPhi ? '&traPhi=1' : ''}`).then((d) => { setRows(d.users); setTotal(d.total || 0); }).catch(() => {}).finally(() => setLoading(false)); }, [dq, page, chiTraPhi]);
  useEffect(() => { load(); }, [load]);
// ── CẤP VAI TRÒ: MỘT NGƯỜI CÓ THỂ GIỮ NHIỀU VAI TRÒ ──
// Một ô bấm vào là SỔ XUỐNG danh sách vai trò, mỗi dòng có ô tích. Tích bao nhiêu vai trò cũng được
// (ví dụ vừa tra danh sách nóng vừa vào kho danh mục). Không tích gì thì là khách thường.
const VAI_TRO_DS: [string, string, string][] = [
  ['gis', '🗺️', 'Biên tập GIS'], ['vanban', '📄', 'Quản lý văn bản'],
  ['hotlist', '🔥', 'Tra cứu danh sách nóng'], ['danhmuc', '🗄️', 'Kho danh mục hồ sơ'],
  ['xacthuc', '🔐', 'Tra mã xác thực 2 lớp'],
  // Tính năng TRẢ PHÍ không nằm ở đây — xem cột "Trả phí" → khung Quản lý trả phí (gói chức năng chung + các gói riêng).
  ['admin', '👑', 'Admin — toàn quyền'],
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
            : daChon.length === 1 ? <span className="font-semibold text-[#0A2540]">{daChon[0][1]} {daChon[0][2].split(' — ')[0]}</span>
            : <span className="font-semibold text-[#0A2540]">{daChon.map(([, i]) => i).join(' ')} {daChon.length} vai trò</span>}
        </span>
        <span className="text-slate-400 text-[10px]">▾</span>
      </button>
      {mo && (
        <div className="absolute z-30 mt-1 w-[228px] bg-white border border-slate-200 rounded-xl shadow-xl p-1">
          {VAI_TRO_DS.map(([v, icon, ten]) => {
            const on = dang.includes(v);
            return (
              <button key={v} onClick={() => bat(v)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left transition ${on ? 'bg-[#0A2540]/5' : 'hover:bg-slate-50'}`}>
                <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center text-[10px] font-bold ${on
                  ? (v === 'admin' ? 'bg-[#C8A14B] border-[#C8A14B] text-white' : 'bg-[#0A2540] border-[#0A2540] text-white')
                  : 'border-slate-300 text-transparent'}`}>✓</span>
                <span>{icon}</span>
                <span className={on ? 'font-semibold text-[#0A2540]' : 'text-slate-600'}>{ten}</span>
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
        <label className="flex shrink-0 items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={chiTraPhi} onChange={(e) => { setChiTraPhi(e.target.checked); setPage(1); }} className="h-4 w-4" /> Chỉ tài khoản trả phí
        </label>
        <span className="shrink-0 text-sm text-slate-500">{total.toLocaleString('vi')} người dùng</span>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
      <table className="w-full text-sm min-w-[660px]">
        <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-2">Tài khoản</th><th className="p-2">Vai trò</th><th className="p-2">Trả phí</th><th className="p-2">Trạng thái</th><th className="p-2">Gói đẩy/th</th><th className="p-2">Tư vấn ĐT</th></tr></thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="p-2"><div className="font-semibold text-[#0A2540]">{u.fullName || u.email}</div><div className="text-xs text-slate-400">{u.email} · {u.phone || '—'}</div></td>
              <td className="p-2"><OVaiTro u={u} luu={(roles) => upd(u.id, { roles })} /></td>
              <td className="p-2"><button type="button" onClick={() => setDangQl(u.id)} title="Quản lý trả phí: gói chức năng chung + các gói riêng" className="text-left"><TomTatTraPhi u={u} /></button></td>
              <td className="p-2"><select value={u.status} onChange={(e) => { const status = e.target.value; if (status === 'suspended' && !confirm(`Khoá tài khoản ${u.email}? Người dùng sẽ không đăng nhập được.`)) return; upd(u.id, { status }); }} className={sel}><option value="active">Hoạt động</option><option value="suspended">Khoá</option></select></td>
              <td className="p-2"><input type="number" min="0" defaultValue={u.boostQuota ?? 0} onBlur={(e) => upd(u.id, { boostQuota: Math.max(0, Number(e.target.value) || 0) })} title="Số lượt đẩy tin/tháng" className="w-16 border border-slate-300 rounded px-1.5 py-1 text-xs" /></td>
              <td className="p-2"><button onClick={() => upd(u.id, { isAdvisor: !u.isAdvisor })} className={`px-2.5 py-1 rounded-full text-xs font-bold ${u.isAdvisor ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`} title="Cho phép tài khoản này trả lời kênh Tư vấn đầu tư">{u.isAdvisor ? '✓ Tư vấn' : 'Tắt'}</button> <select value={String(u.rating ?? 0)} onChange={(e) => upd(u.id, { rating: Number(e.target.value) })} title="Chấm sao môi giới (Cam Lâm Land)" className={sel}><option value="0">☆ chưa</option><option value="3">★★★</option><option value="3.5">★★★½</option><option value="4">★★★★</option><option value="4.5">★★★★½</option><option value="5">★★★★★</option></select></td>
            </tr>
          ))}
          {loading ? <tr><td colSpan={6} className="p-6 text-center text-slate-400"><span className="inline-block w-5 h-5 border-2 border-slate-200 border-t-[#0A2540] rounded-full animate-spin align-[-3px]" /> Đang tải…</td></tr> : rows.length === 0 ? <tr><td colSpan={6} className="p-4 text-slate-500">Không tìm thấy người dùng.</td></tr> : null}
        </tbody>
      </table>
      </div>
      {dangQl != null && rows.some((r) => r.id === dangQl) && (
        <QuanLyTraPhi u={rows.find((r) => r.id === dangQl)} onDong={() => setDangQl(null)} onDoi={load} />
      )}
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
              <td className="p-2"><div className="font-semibold text-[#0A2540] truncate max-w-[280px]">{l.title}</div><div className="text-xs text-slate-400">{formatVnd(l.price)} · {l.ward || 'Cam Lâm'}</div></td>
              <td className="p-2"><select value={l.status} onChange={(e) => patch(l.id, { status: e.target.value })} className="border border-slate-300 rounded px-1.5 py-1 text-xs"><option value="active">Hiển thị</option><option value="pending">Chờ duyệt</option><option value="hidden">Ẩn</option><option value="sold">Đã bán</option></select></td>
              <td className="p-2 whitespace-nowrap"><select value={l.tier || 'normal'} onChange={(e) => patch(l.id, { tier: e.target.value })} className="border border-slate-300 rounded px-1.5 py-1 text-xs"><option value="normal">Thường</option><option value="silver">VIP Bạc</option><option value="gold">VIP Vàng</option><option value="diamond">VIP Kim cương</option></select><button onClick={() => patch(l.id, { bump: true })} title="Đẩy lên đầu" className="ml-1.5 text-xs font-bold px-2 py-1 rounded bg-[#0A2540] text-white hover:bg-[#0d2f54]">↑ Đẩy</button></td>
              <td className="p-2 text-right whitespace-nowrap"><button onClick={() => patch(l.id, { verified: !l.verified })} title="Xác thực bởi Cam Lâm Land" className={`text-xs font-bold px-2 py-1 rounded mr-2 ${l.verified ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{l.verified ? '✔ Đã XT' : 'Xác thực'}</button><Link href={`/listings/${l.id}`} className="text-xs text-[#0A2540] font-semibold mr-3">Xem</Link><button onClick={() => del(l.id)} className="text-xs text-red-600 font-semibold">Xoá</button></td>
            </tr>
          ))}
          {loading ? <tr><td colSpan={4} className="p-6 text-center text-slate-400"><span className="inline-block w-5 h-5 border-2 border-slate-200 border-t-[#0A2540] rounded-full animate-spin align-[-3px]" /> Đang tải…</td></tr> : rows.length === 0 ? <tr><td colSpan={4} className="p-4 text-slate-500">Chưa có tin nào.</td></tr> : null}
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
      <h2 className="font-bold text-[#0A2540] mb-3">Tải lên dữ liệu bản đồ</h2>
      <p className="text-sm text-slate-500 mb-3">Nạp trực tiếp <b>.geojson</b>, <b>Shapefile nén .zip</b> hoặc <b>DGN</b> — toạ độ <b>VN-2000/WGS84</b> đều được (tự quy đổi). DGN <b>V8 tự đổi qua mạng</b>; file DGN được xử lý nền, xem tiến độ ở danh sách import.</p>
      <input type="file" accept=".dgn,.shp,.zip,.geojson,.json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mb-3 block w-full text-sm" />
      <input className="border border-slate-300 rounded-md px-3 py-2 w-full mb-2 text-sm" placeholder="Tên lớp (vd: Quy hoạch 2030)" value={name} onChange={(e) => setName(e.target.value)} />
      <select className="border border-slate-300 rounded-md px-3 py-2 w-full mb-3 text-sm" value={layerType} onChange={(e) => setLayerType(e.target.value)}>
        <option value="parcel">Thửa đất</option><option value="zoning">Quy hoạch</option><option value="admin">Ranh giới hành chính</option><option value="road">Giao thông</option><option value="custom">Khác</option>
      </select>
      <button onClick={submit} className="bg-[#0A2540] hover:bg-[#0d2f54] text-white px-4 py-2 rounded-md text-sm font-semibold">Tải lên & xử lý</button>
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
              <td className="p-2"><div className="font-semibold text-[#0A2540]">{p.userName}</div><div className="text-xs text-slate-400">{p.email}</div></td>
              <td className="p-2 uppercase">{p.packageId}</td>
              <td className="p-2 font-bold text-red-600">{fmt(p.amount)}</td>
              <td className="p-2 font-mono text-xs">{p.note}</td>
              <td className={`p-2 font-semibold ${p.status === 'paid' ? 'text-emerald-700' : 'text-amber-600'}`}>{p.status === 'paid' ? 'Đã thanh toán' : 'Chờ thanh toán'}</td>
              <td className="p-2 text-right">{p.status !== 'paid' && <button onClick={() => confirm(p.id)} className="text-xs font-bold text-white bg-[#0A2540] hover:bg-[#0d2f54] rounded px-2.5 py-1">✓ Xác nhận</button>}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={7} className="p-4 text-slate-500">Chưa có đơn nào.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
