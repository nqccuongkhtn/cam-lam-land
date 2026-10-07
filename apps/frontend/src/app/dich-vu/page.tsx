'use client';
// Trang /dich-vu không dùng riêng nữa — nội dung dịch vụ nằm trong /cam-nang?toi=dich-vu-phap-ly. Tự chuyển hướng.
import { useEffect } from 'react';

export default function DichVuRedirect() {
  useEffect(() => { window.location.replace('/cam-nang?toi=dich-vu-phap-ly'); }, []);
  return <div style={{ minHeight: '60vh' }} className="grid place-items-center text-slate-400">Đang chuyển tới Dịch vụ pháp lý…</div>;
}
