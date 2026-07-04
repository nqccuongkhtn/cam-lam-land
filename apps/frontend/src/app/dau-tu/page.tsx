'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

const TENURES = ['2 năm', '3 năm', '4 năm', '5 năm'];

export default function DauTuPage() {
  const [f, setF] = useState({ name: '', phone: '', amount: '', tenure: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim() || !f.phone.trim()) { setErr('Vui lòng nhập họ tên và số điện thoại.'); return; }
    setBusy(true); setErr('');
    try { await api('/invest', { method: 'POST', body: JSON.stringify(f) }); setDone(true); }
    catch (e2: any) { setErr(e2?.message || 'Gửi không thành công, vui lòng thử lại.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-56px)]">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#0A2540] to-[#0d3a6b] text-white">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <span className="inline-block bg-[#C8A14B] text-[#0A2540] font-extrabold text-xs px-3 py-1 rounded-full mb-3">CamInvest</span>
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight">Góp vốn đầu tư bất động sản cùng Cam Lâm Land</h1>
          <p className="text-white/85 mt-3 max-w-2xl">Hình thức uỷ thác đầu tư: nhà đầu tư góp vốn cùng Cam Lâm Land mua những bất động sản tiềm năng tại Cam Lâm – Khánh Hòa, được cam kết lợi nhuận theo thời gian góp vốn.</p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 grid lg:grid-cols-5 gap-6">
        {/* Nội dung */}
        <div className="lg:col-span-3 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="font-extrabold text-[#0A2540] text-lg mb-3">CamInvest hoạt động thế nào?</h2>
            <ul className="space-y-2 text-slate-700 text-sm">
              <li className="flex gap-2"><span className="text-[#C8A14B] font-bold">•</span><span><b>Cam kết trả lãi suất</b> cho nhà đầu tư theo thời gian góp vốn — kỳ hạn càng dài, lợi nhuận càng cao.</span></li>
              <li className="flex gap-2"><span className="text-[#C8A14B] font-bold">•</span><span><b>Gói đầu tư đa dạng</b>, từ <b>*</b> trở lên.</span></li>
              <li className="flex gap-2"><span className="text-[#C8A14B] font-bold">•</span><span>Có <b>hợp đồng góp vốn</b> rõ ràng, tài sản đầu tư minh bạch.</span></li>
            </ul>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="font-extrabold text-[#0A2540] mb-1">Bảng ví dụ minh hoạ</h3>
            <p className="text-sm text-slate-500 mb-3">Gói đầu tư: <b>*</b></p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2 font-semibold">Kỳ hạn</th>
                    <th className="py-2 font-semibold text-right">Lợi nhuận TB/năm</th>
                    <th className="py-2 font-semibold text-right">Thu về (dự kiến)</th>
                  </tr>
                </thead>
                <tbody>
                  {TENURES.map((t) => (
                    <tr key={t} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 font-semibold text-[#0A2540]">{t}</td>
                      <td className="py-2.5 text-right text-slate-400">*</td>
                      <td className="py-2.5 text-right text-slate-400">*</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">(*) Mức đầu tư tối thiểu và lãi suất cụ thể sẽ được tư vấn trực tiếp — vui lòng để lại thông tin để nhận báo giá & mẫu hợp đồng.</p>
          </div>

          {/* Lưu ý rủi ro & pháp lý */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <h3 className="font-bold text-amber-800 text-sm mb-1">Lưu ý rủi ro &amp; pháp lý</h3>
            <p className="text-[13px] text-amber-800/90 leading-relaxed">Đây là thông tin giới thiệu chương trình hợp tác góp vốn của Cam Lâm Land, không phải lời mời chào đầu tư chứng khoán và Cam Lâm Land không phải tổ chức tín dụng. Mọi hoạt động góp vốn đều có rủi ro; lợi nhuận phụ thuộc hợp đồng cụ thể và kết quả kinh doanh thực tế. Vui lòng đọc kỹ hợp đồng, cân nhắc khả năng tài chính và tham khảo ý kiến luật sư/chuyên gia trước khi tham gia.</p>
          </div>
        </div>

        {/* Form đăng ký */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 lg:sticky lg:top-20">
            <h2 className="font-extrabold text-[#0A2540] text-lg mb-1">Đăng ký nhận tư vấn</h2>
            <p className="text-sm text-slate-500 mb-4">Để lại thông tin, đội ngũ Cam Lâm Land sẽ liên hệ tư vấn gói góp vốn phù hợp.</p>
            {done ? (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-4 text-sm font-semibold text-center">
                ✓ Đã gửi đăng ký thành công!<br />Cam Lâm Land sẽ liên hệ với bạn sớm nhất.
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Họ và tên *" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#0A2540]" />
                <input value={f.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" placeholder="Số điện thoại *" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#0A2540]" />
                <input value={f.amount} onChange={(e) => set('amount', e.target.value)} placeholder="Số tiền dự kiến góp (tuỳ chọn)" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#0A2540]" />
                <select value={f.tenure} onChange={(e) => set('tenure', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#0A2540] text-slate-600">
                  <option value="">Kỳ hạn quan tâm (tuỳ chọn)</option>
                  {TENURES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <textarea value={f.note} onChange={(e) => set('note', e.target.value)} rows={3} placeholder="Ghi chú (tuỳ chọn)" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#0A2540]" />
                {err && <p className="text-sm text-red-600">{err}</p>}
                <button disabled={busy} className="w-full bg-[#C8A14B] hover:bg-[#b8923f] disabled:opacity-60 text-[#0A2540] font-extrabold py-3 rounded-xl text-sm">{busy ? 'Đang gửi…' : 'Gửi đăng ký'}</button>
                <p className="text-[11px] text-slate-400 text-center">Thông tin của bạn được bảo mật, chỉ dùng để tư vấn.</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
