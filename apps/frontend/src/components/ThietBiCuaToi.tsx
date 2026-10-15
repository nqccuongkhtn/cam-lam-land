'use client';
// Mục "Thiết bị đang đăng nhập" ở trang /account (10/10/2026) — máy chủ: routes/thietBi.ts (GET /api/thiet-bi/cua-toi).
// Người dùng CHỈ XEM, không tự gỡ được (tự gỡ được thì lách được phí reset). Muốn đổi máy → liên hệ Zalo admin.
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type May = { id: number; ten: string; loai: string; heDieuHanh: string; trinhDuyet: string; chiTiet: Record<string, any>; ipCuoi: string; lanDau: string; lanCuoi: string; mayNay: boolean };
const gio = (s: string) => new Date(s).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });

export default function ThietBiCuaToi() {
  const [d, setD] = useState<{ may: May[]; toiDa: number; batGioiHan: boolean; zalo: string; phi: number } | null>(null);
  useEffect(() => { api<any>('/thiet-bi/cua-toi').then(setD).catch(() => setD(null)); }, []);
  if (!d || !d.may.length) return null;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
      <h2 className="font-bold text-[#0A2540]">Thiết bị đang đăng nhập</h2>
      <p className="mt-0.5 text-[13px] text-slate-500">
        {d.batGioiHan ? <>Mỗi tài khoản dùng tối đa <b>{d.toiDa}</b> thiết bị. </> : null}
        Đang dùng <b>{d.may.length}{d.batGioiHan ? `/${d.toiDa}` : ''}</b> thiết bị.
      </p>
      <ul className="mt-3 space-y-2">
        {d.may.map((m) => (
          <li key={m.id} className={`rounded-lg border px-3 py-2 text-[13px] ${m.mayNay ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}>
            <div className="font-semibold text-slate-800">
              {m.loai === 'Điện thoại' ? '📱' : m.loai === 'Máy tính bảng' ? '📲' : '💻'} {m.chiTiet?.model ? `${m.chiTiet.model} · ${m.trinhDuyet}` : m.ten}
              {m.mayNay && <span className="ml-2 rounded bg-emerald-600 px-1.5 py-0.5 text-[11px] font-bold text-white">Máy này</span>}
            </div>
            <div className="text-slate-500">{m.heDieuHanh} · đăng nhập lần đầu {gio(m.lanDau)} · gần nhất {gio(m.lanCuoi)}</div>
          </li>
        ))}
      </ul>
      {d.batGioiHan && (
        <p className="mt-3 text-[12px] leading-snug text-slate-500">
          Muốn đổi sang thiết bị khác, vui lòng liên hệ Zalo admin{' '}
          <a href={String(d.zalo).startsWith('http') ? d.zalo : `https://zalo.me/${d.zalo}`} target="_blank" rel="noreferrer" className="font-bold text-[#0068FF]">(bấm để kết bạn Zalo)</a>{' '}
          để reset thiết bị (phí {d.phi.toLocaleString('vi-VN')}đ/lần).
        </p>
      )}
    </div>
  );
}
