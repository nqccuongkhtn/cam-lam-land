'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// Popup xác nhận / thông báo dùng chung (thay cho confirm()/alert() của trình duyệt).
import { useLockBody } from '@/lib/useLockBody';

export function ConfirmModal({ title, message, confirmLabel = 'Xoá', danger = true, busy, onConfirm, onCancel }: any) {
  useLockBody(); // khoá cuộn nền khi mở hộp xác nhận
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" onClick={busy ? undefined : onCancel}>
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <p className="mb-1 text-base font-bold text-[#0B4045]">{title || 'Xác nhận'}</p>
        <p className="mb-4 text-sm text-slate-600" style={{ whiteSpace: 'pre-line' }}>{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} disabled={busy} className="rounded border px-4 py-1.5 text-sm disabled:opacity-40">Huỷ</button>
          <button onClick={onConfirm} disabled={busy} className={`rounded px-5 py-1.5 text-sm font-bold text-white disabled:opacity-40 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{busy ? 'Đang xử lý…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function Toast({ text, onClose }: any) {
  if (!text) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-[70] -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg" onClick={onClose}>
      {text}
    </div>
  );
}
