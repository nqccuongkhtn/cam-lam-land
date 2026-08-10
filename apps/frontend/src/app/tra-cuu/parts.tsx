'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// Helper + Linkify cho trang tra cứu Danh sách nóng (tách nhỏ để tránh lỗi ghi file). EditModal/GuideModal ở file riêng.
import { Fragment } from 'react';

export type Added = { id: number; nguon: string; ten: string; soThua: string; soTo: string; xa: string; noiDung: string; ghiChu: string; link: string; mucDo: string; nguoiThem: string; createdAt: string; soDen: string; ngayDen: string; soKyHieu: string; ngayVb: string; donViGui: string; loaiVb: string; soVbGoc: string; soGiayTo: string; namSinh: string; diaChi: string; soPhatHanh: string; soVaoSo: string; ngayCap: string; hetHieuLucAt?: string | null; hetHieuLucBoi?: string | null };

export const norm = (s: any) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/đ/g, 'd');
export const digits = (s: any) => String(s ?? '').match(/\d+/g) || [];
export const SHORT: Record<string, string> = { 'NGĂN CHẶN giao dịch': 'Ngăn chặn', 'Hồ sơ không đủ ĐK': 'Hồ sơ', 'Công ích/Lâm trường': 'Công ích', 'Thành Mậu (bđ201)': 'Thành Mậu', 'Bản đồ 201↔VN2000': 'BĐ 201↔VN', 'Người (Sheet3)': 'Người' };
export function sevOf(src: string, mucDo?: string) {
  const m = norm(mucDo || ''); // bản ghi thêm mới: ưu tiên MỨC ĐỘ đã chọn (ngan-chan / canh-bao / thuong)
  if (m.includes('ngan')) return { c: 'red', label: 'NGĂN CHẶN' };
  if (m.includes('canh')) return { c: 'amber', label: 'Cảnh báo' };
  if (m.includes('thuong')) return { c: 'slate', label: '' };
  const s = norm(src); // bản ghi gốc: suy ra theo nguồn
  if (s.includes('ngan chan')) return { c: 'red', label: 'NGĂN CHẶN' };
  if (s.includes('khong du') || s.includes('ho so') || s.includes('canh bao')) return { c: 'amber', label: 'Cảnh báo' };
  if (s.includes('cong ich') || s.includes('lam truong')) return { c: 'blue', label: '' };
  return { c: 'slate', label: '' };
}
export const rowBg: Record<string, string> = { red: 'bg-red-50 hover:bg-red-100/70', amber: 'bg-amber-50/60 hover:bg-amber-100/60', blue: 'bg-sky-50/50 hover:bg-sky-100/50', slate: 'hover:bg-slate-50' };
export const chipCls: Record<string, string> = { red: 'bg-red-600 text-white', amber: 'bg-amber-500 text-white', blue: 'bg-sky-600 text-white', slate: 'bg-slate-500 text-white' };
export const chipSoft: Record<string, string> = { red: 'bg-red-100 text-red-700', amber: 'bg-amber-100 text-amber-700', blue: 'bg-sky-100 text-sky-700', slate: 'bg-slate-100 text-slate-600' };
export const toHref = (l: string) => (String(l).startsWith('http') ? l : 'https://' + l);

const URLRE = /((?:https?:\/\/|www\.)[^\s|]+)/gi;
export function Linkify({ text }: { text: string }) {
  const parts = String(text).split(URLRE);
  return <>{parts.map((p, i) => (URLRE.test(p) ? <a key={i} href={toHref(p)} target="_blank" rel="noopener noreferrer" className="text-sky-600 underline">{p}</a> : <Fragment key={i}>{p}</Fragment>))}</>;
}
