'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ocrCertInfo } from '@/lib/api';
import { useAuth } from '@/lib/auth';

function toJpeg(img: HTMLImageElement, maxDim = 2000, q = 0.9): Promise<Blob> {
  const w0 = img.naturalWidth || 1, h0 = img.naturalHeight || 1;
  const sc = Math.min(1, maxDim / Math.max(w0, h0));
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(w0 * sc)); cv.height = Math.max(1, Math.round(h0 * sc));
  cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/jpeg', q));
}

export default function DocSoDoPage() {
  const { user } = useAuth();
  const [preview, setPreview] = useState('');
  const [fields, setFields] = useState<[string, string][]>([]);
  const [engine, setEngine] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    if (!user) { setErr('🔒 Vui lòng đăng nhập để dùng tính năng đọc sổ bằng AI.'); return; }
    setErr(''); setFields([]); setEngine(''); setBusy(true);
    try {
      const dataUrl: string = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsDataURL(f); });
      setPreview(dataUrl);
      const img = new Image(); img.src = dataUrl; await img.decode();
      const blob = await toJpeg(img);
      const r = await ocrCertInfo(blob);
      setEngine(r.engine);
      const parsed: [string, string][] = [];
      for (const line of (r.text || '').split(/\r?\n/)) {
        const m = line.match(/^\s*[-*•]?\s*([^:：]{2,40})[:：]\s*(.+?)\s*$/);
        if (m && m[2] && m[2].trim() !== '...') parsed.push([m[1].trim(), m[2].trim()]);
      }
      setFields(parsed);
      if (parsed.length === 0) setErr('AI chưa tách được trường thông tin nào. Hãy chụp gần, thẳng, đủ sáng phần chữ trên sổ rồi thử lại.');
    } catch (e2: any) {
      const m = String(e2?.message || e2);
      setErr(/unauthor|forbidden|401|403/i.test(m) ? '🔒 Vui lòng đăng nhập để dùng tính năng này.' : m);
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-[#0A2540]">Đọc thông tin Sổ đỏ bằng AI</h1>
        <Link href="/qr" className="text-sm font-semibold text-slate-500 hover:text-[#0A2540]">Tra cứu QR →</Link>
      </div>
      <p className="text-sm text-slate-500 mb-4">Chụp hoặc tải ảnh Giấy chứng nhận — AI tự đọc các thông tin chính (chủ sử dụng, thửa đất, diện tích, địa chỉ, loại đất…). Đọc trực tiếp từ ảnh của bạn, không cần đăng nhập cổng nào.</p>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <h2 className="font-semibold text-[#0A2540] mb-3">1. Ảnh Giấy chứng nhận</h2>
          <div className="aspect-[4/3] rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center mb-3">
            {preview ? <img src={preview} alt="Sổ đỏ" className="w-full h-full object-contain" /> : <span className="text-slate-400 text-sm">Chưa có ảnh</span>}
          </div>
          <div className="flex gap-2">
            <label className="flex-1 text-center bg-[#0A2540] hover:bg-[#0d2f54] text-white font-bold py-2.5 rounded-xl text-sm cursor-pointer">📷 Chụp ảnh sổ
              <input type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
            </label>
            <label className="flex-1 text-center border-2 border-slate-300 hover:border-[#C8A14B] text-slate-700 font-bold py-2.5 rounded-xl text-sm cursor-pointer">🖼️ Tải ảnh
              <input type="file" accept="image/*" onChange={onFile} className="hidden" />
            </label>
          </div>
          {busy && <p className="text-sm text-[#0A2540] font-semibold mt-3">⏳ AI đang đọc ảnh sổ…</p>}
          {err && <p className="text-sm text-red-600 mt-3">{err}</p>}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <h2 className="font-semibold text-[#0A2540] mb-3">2. Thông tin đọc được</h2>
          {fields.length === 0 ? (
            <p className="text-sm text-slate-400">Kết quả sẽ hiện ở đây sau khi chụp/tải ảnh.</p>
          ) : (
            <>
              <dl className="divide-y divide-slate-100 text-sm">
                {fields.map(([k, v], i) => (
                  <div key={i} className="py-2 grid grid-cols-[130px_1fr] gap-2">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="font-semibold text-[#0A2540] break-words">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-[11px] text-slate-400 mt-3">Nguồn đọc: AI Cam Lâm Land{engine ? ' · ' + engine : ''} — đang trong giai đoạn thử nghiệm.</p>
            </>
          )}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mt-4">
        <p className="text-[13px] text-amber-800/90 leading-relaxed"><b>Lưu ý:</b> Thông tin do AI đọc từ ảnh nên <b>có thể sai sót</b> — vui lòng đối chiếu lại với sổ gốc. Đây là thông tin <b>in trên sổ</b>, không phải trạng thái mới nhất trong cơ sở dữ liệu đất đai (ví dụ thế chấp/biến động cập nhật sau). Để kiểm tra thật/giả và trạng thái pháp lý, dùng thêm <Link href="/qr" className="underline font-semibold">Tra cứu QR</Link> rồi đối chiếu trên cổng VBĐLIS chính thức.</p>
      </div>
    </div>
  );
}
