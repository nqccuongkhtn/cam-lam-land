'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

/** CTA "Cần sang tên sổ đỏ / pháp lý? Tư vấn miễn phí" — đặt ĐÚNG KHOẢNH KHẮC (cẩm nang, sau công cụ hợp đồng cọc).
 *  Khách để lại SĐT → lưu vào danh sách khách (dùng chung /api/consignments, gắn nhãn [TƯ VẤN PHÁP LÝ]). */
export default function LegalConsultCTA({ topic, className }: { topic?: string; className?: string }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    const p = phone.trim();
    if (!/^0\d{8,10}$/.test(p)) { setErr('Nhập số điện thoại hợp lệ (bắt đầu bằng 0).'); return; }
    setBusy(true);
    try {
      await api('/consignments', { method: 'POST', body: JSON.stringify({ name: name.trim() || 'Khách cần tư vấn pháp lý', phone: p, description: `[TƯ VẤN PHÁP LÝ]${topic ? ' — ' + topic : ''}` }) });
      setSent(true);
    } catch (e: any) { setErr(e?.message || 'Không gửi được, vui lòng thử lại.'); } finally { setBusy(false); }
  };

  const openChat = () => { try { window.dispatchEvent(new CustomEvent('cl-open-chat', { detail: { tab: 'advisory' } })); } catch { /* ignore */ } };
  const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base outline-none focus:border-emerald-500 bg-white';
  return (
    <div className={`bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-2xl p-4 sm:p-5 ${className || ''}`}>
      {sent ? (
        <div className="text-center py-2">
          <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mx-auto text-2xl font-bold">✓</div>
          <p className="font-extrabold text-emerald-700 mt-2">Đã nhận yêu cầu tư vấn!</p>
          <p className="text-sm text-slate-500 mt-0.5">Cam Lâm Land sẽ gọi lại sớm nhất. Cần gấp: <a href="tel:0567442996" className="font-bold text-[#0A2540]">0567 442 996</a>.</p>
        </div>
      ) : (
        <>
          <p className="font-extrabold text-[#0A2540] flex items-center gap-2">📋 Cần sang tên sổ đỏ / xử lý pháp lý?</p>
          <p className="text-[13px] text-slate-500 mt-0.5">Để lại số điện thoại — <b className="text-emerald-700">tư vấn miễn phí</b>, đội ngũ Cam Lâm Land gọi lại &amp; báo phí trọn gói.</p>
          <div className="mt-3 grid sm:grid-cols-[1fr_1fr_auto] gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Họ tên (tuỳ chọn)" className={inp} />
            <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ''))} placeholder="Số điện thoại *" inputMode="tel" className={inp} onKeyDown={(e) => e.key === 'Enter' && submit()} />
            <button onClick={submit} disabled={busy} className="cl-press bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold px-5 py-2.5 rounded-lg whitespace-nowrap">{busy ? 'Đang gửi…' : 'Nhận tư vấn'}</button>
          </div>
          {err && <p className="text-xs text-red-600 mt-1.5 font-semibold">{err}</p>}
          <p className="text-[12px] text-slate-500 mt-2">Hoặc <button type="button" onClick={openChat} className="font-bold text-emerald-700 underline underline-offset-2 hover:text-emerald-800">💬 chat tư vấn trực tiếp</button> · gọi <b>0567 442 996</b> · <a href="https://zalo.me/0582594956" target="_blank" rel="noreferrer" className="font-bold text-[#0068FF]">Zalo admin</a> · Bảo mật thông tin.</p>
        </>
      )}
    </div>
  );
}
