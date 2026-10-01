'use client';
// ════════════════════════════════════════════════════════════════════════════════════════════
//  BÁO CÁO HOẠT ĐỘNG TÀI KHOẢN — TẠM THỜI, DỄ GỠ (chủ dự án 1/10/2026). CHỈ ADMIN xem được
//  (máy chủ kiểm quyền ở /api/theo-doi/bao-cao, trang này chỉ là phần hiển thị).
//  Gỡ: xoá thư mục này + mục 'theo-doi-tk' trong app/quan-tri/page.tsx — xem apps/backend/src/routes/theoDoiTk.ts.
// ════════════════════════════════════════════════════════════════════════════════════════════
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth, laAdmin, TEN_VAI_TRO } from '@/lib/auth';

type HoatDong = { luc: string; loai: string; pt: string | null; duong: string; ma: number | null; ip: string; thietBi: string };
type TaiKhoan = {
  id: number; email: string; ten: string | null; phone: string | null; role: string; roles: string[] | null; status: string;
  taoLuc: string; lanCuoi: string | null; batDauTheoDoi: string;
  duLieuCu: { ten: string; so: number; ganNhat: string | null }[];
  hoatDong: HoatDong[]; tongHoatDong: number; ghiTu: string | null;
};

// Đổi đường gọi máy chủ → việc người dùng làm, nói bằng lời thường. Xếp từ cụ thể tới chung chung.
const NHAN: [RegExp, string, string?][] = [
  [/^\/api\/dc\/tim/, 'Tra số tờ / số thửa', 'tra'],
  [/^\/api\/dc\/(ve|danh-muc)/, 'Mở bản đồ địa chính'],
  [/^\/api\/parcels\/at/, 'Bấm xem thông tin thửa đất', 'thua'],
  [/^\/api\/parcels/, 'Tra cứu thửa đất'],
  [/^\/api\/hotlist\/goc/, 'Mở danh sách nóng', 'nong'],
  [/^\/api\/hotlist/, 'Thao tác danh sách nóng', 'nong'],
  [/^\/api\/totp/, 'Tra mã xác thực 2 lớp', 'nong'],
  [/^\/api\/kho-ho-so\/\d+\/tai/, 'Tải file trong kho hồ sơ', 'nong'],
  [/^\/api\/kho-ho-so/, 'Xem kho hồ sơ'],
  [/^\/api\/danh-muc\/(run|quote)/, 'Lập danh mục hồ sơ'],
  [/^\/api\/danh-muc/, 'Công cụ lập danh mục'],
  [/^\/api\/van-ban\/[^/?]+\/pdf/, 'Tải văn bản'],
  [/^\/api\/van-ban/, 'Tra cứu văn bản'],
  [/^\/api\/pdftools\//, 'Dùng công cụ PDF'],
  [/^\/api\/ocr/, 'Đọc chữ từ ảnh (sổ đỏ / bảng toạ độ)'],
  [/^\/api\/qr/, 'Tra cứu QR sổ đỏ'],
  [/^\/api\/listings\/agent\/[^/]+\/reveal|^\/api\/listings\/[^/]+\/reveal/, 'Bấm "Hiện số" điện thoại'],
  [/^\/api\/listings\/mine|^\/api\/listings\/my/, 'Xem tin của tôi'],
  [/^\/api\/listings\/\d+$/, 'Xem chi tiết tin đăng'],
  [/^\/api\/listings/, 'Xem / lọc tin nhà đất'],
  [/^\/api\/crm/, 'Dùng CRM khách hàng'],
  [/^\/api\/saved-places/, 'Điểm đã lưu trên bản đồ'],
  [/^\/api\/chat/, 'Chat'],
  [/^\/api\/chi-duong/, 'Chỉ đường'],
  [/^\/api\/do-cao/, 'Tra độ cao mặt đất'],
  [/^\/api\/ai\//, 'AI viết kịch bản video'],
  [/^\/api\/payments/, 'Thanh toán / gói dịch vụ'],
  [/^\/api\/layers/, 'Xem lớp bản đồ'],
  [/^\/api\/projects/, 'Xem dự án'],
  [/^\/api\/auth\//, 'Tài khoản (đổi mật khẩu, thông tin…)'],
  [/^\/api\/admin/, 'Trang quản trị'],
];
function nhanCua(h: HoatDong): { ten: string; nhom?: string } {
  if (h.loai === 'dang-nhap') return { ten: 'Đăng nhập', nhom: 'dn' };
  const duong = h.duong.split('#')[0];
  for (const [re, ten, nhom] of NHAN) if (re.test(duong)) return { ten: h.pt && h.pt !== 'GET' && !/Đăng|Tải|Bấm/.test(ten) ? `${ten} (gửi / sửa)` : ten, nhom };
  return { ten: `${h.pt || ''} ${duong.split('?')[0]}`.trim() };
}
// Phần đáng xem trong địa chỉ: số tờ/thửa đã tra, xã… (bỏ toạ độ dài dòng).
function chiTiet(h: HoatDong): string {
  const q = h.duong.split('?')[1];
  if (!q) return '';
  const p = new URLSearchParams(q);
  const ra: string[] = [];
  if (p.get('thua')) ra.push(`Thửa ${p.get('thua')}`);
  if (p.get('to')) ra.push(`Tờ ${p.get('to')}`);
  if (p.get('xaId')) ra.push(`mã xã ${p.get('xaId')}`);
  if (p.get('q')) ra.push(`"${p.get('q')}"`);
  if (p.get('lat') && p.get('lng')) ra.push(`toạ độ ${Number(p.get('lat')).toFixed(5)}, ${Number(p.get('lng')).toFixed(5)}`);
  return ra.join(' · ');
}

const gio = (s: string) => new Date(s).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
const ngay = (s: string) => new Date(s).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' });
const ngayGio = (s?: string | null) => (s ? new Date(s).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }) : '—');

// Gom các lần LIÊN TIẾP cùng một việc trong vòng 3 phút thành một dòng "× N" cho dễ đọc.
type Dong = { dau: HoatDong; cuoi: HoatDong; so: number; ten: string; nhom?: string; ct: string[]; loi: number };
function gom(ds: HoatDong[]): Dong[] {
  const ra: Dong[] = [];
  for (const h of ds) {                                      // ds xếp MỚI → CŨ
    const { ten, nhom } = nhanCua(h);
    const ct = chiTiet(h);
    const loi = h.ma != null && h.ma >= 400 ? 1 : 0;
    const tr = ra[ra.length - 1];
    if (tr && tr.ten === ten && new Date(tr.cuoi.luc).getTime() - new Date(h.luc).getTime() < 3 * 60_000
        && ngay(tr.cuoi.luc) === ngay(h.luc)) {
      tr.cuoi = h; tr.so++; tr.loi += loi; if (ct && !tr.ct.includes(ct) && tr.ct.length < 12) tr.ct.push(ct);
    } else ra.push({ dau: h, cuoi: h, so: 1, ten, nhom, ct: ct ? [ct] : [], loi });
  }
  return ra;
}

const MAU_NHOM: Record<string, string> = { nong: 'bg-red-50 text-red-700 ring-red-200', dn: 'bg-emerald-50 text-emerald-700 ring-emerald-200', tra: 'bg-sky-50 text-sky-700 ring-sky-200', thua: 'bg-amber-50 text-amber-800 ring-amber-200' };

export default function TheoDoiTaiKhoanPage() {
  const { user, loading } = useAuth();
  const [dl, setDl] = useState<TaiKhoan[] | null>(null);
  const [loi, setLoi] = useState('');
  const [chon, setChon] = useState(0);
  const [tai, setTai] = useState(0);

  useEffect(() => {
    if (!laAdmin(user)) return;
    setLoi('');
    api<{ taiKhoan: TaiKhoan[] }>('/theo-doi/bao-cao').then((d) => setDl(d.taiKhoan || [])).catch((e) => setLoi(e?.message || 'Không tải được báo cáo'));
  }, [user, tai]);

  const tk = dl?.[chon];
  const theoNgay = useMemo(() => {
    if (!tk) return [] as [string, Dong[]][];
    const m = new Map<string, Dong[]>();
    for (const d of gom(tk.hoatDong)) { const k = ngay(d.dau.luc); (m.get(k) || m.set(k, []).get(k)!).push(d); }
    return Array.from(m.entries());
  }, [tk]);
  const thongKe = useMemo(() => {
    if (!tk) return [] as [string, number][];
    const m = new Map<string, number>();
    for (const h of tk.hoatDong) { const t = nhanCua(h).ten; m.set(t, (m.get(t) || 0) + 1); }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [tk]);
  const mayDung = useMemo(() => {
    if (!tk) return [] as [string, number][];
    const m = new Map<string, number>();
    for (const h of tk.hoatDong) { const k = `${h.thietBi} · ${h.ip}`; m.set(k, (m.get(k) || 0) + 1); }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [tk]);

  if (loading) return <div className="p-10 text-center text-slate-400">Đang tải…</div>;
  if (!laAdmin(user)) return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="text-4xl">🔒</div>
      <p className="mt-2 font-extrabold text-[#0A2540]">Chỉ quản trị viên được xem trang này</p>
      <Link href="/" className="mt-4 inline-block font-semibold text-[#C8A14B]">← Về trang chủ</Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[#0A2540]">Theo dõi hoạt động tài khoản</h1>
          <p className="mt-0.5 text-[13px] text-slate-500">Chỉ admin xem được · tính năng tạm thời. Giờ hiển thị theo giờ Việt Nam.</p>
        </div>
        <button onClick={() => setTai((n) => n + 1)} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">↻ Làm mới</button>
      </div>

      {loi && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">{loi}</p>}
      {!dl && !loi && <p className="mt-8 text-center text-slate-400">Đang tải báo cáo…</p>}
      {dl && !dl.length && <p className="mt-8 text-center text-slate-500">Chưa có tài khoản nào trong danh sách theo dõi.</p>}

      {dl && dl.length > 0 && (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {dl.map((t, i) => (
              <button key={t.id} onClick={() => setChon(i)}
                className={`rounded-md border px-3 py-2 text-left text-[13px] ${i === chon ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                <b className="block">{t.ten || t.email}</b>
                <span className={`text-[11.5px] ${i === chon ? 'text-white/75' : 'text-slate-400'}`}>{t.tongHoatDong} lần hoạt động đã ghi</span>
              </button>
            ))}
          </div>

          {tk && (
            <div className="mt-4 grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
              <aside className="space-y-4">
                <section className="rounded-lg border border-slate-200 bg-white p-4 text-[13px]">
                  <h2 className="text-[15px] font-extrabold text-[#0A2540]">{tk.ten || '(chưa đặt tên)'}</h2>
                  <dl className="mt-2 space-y-1.5 text-slate-600">
                    <div><dt className="inline text-slate-400">Email: </dt><dd className="inline break-all">{tk.email}</dd></div>
                    <div><dt className="inline text-slate-400">Điện thoại: </dt><dd className="inline">{tk.phone || '—'}</dd></div>
                    <div><dt className="inline text-slate-400">Quyền: </dt><dd className="inline">{(tk.roles?.length ? tk.roles : [tk.role]).map((r) => TEN_VAI_TRO[r] || r).join(', ')}</dd></div>
                    <div><dt className="inline text-slate-400">Trạng thái: </dt><dd className="inline">{tk.status === 'active' ? 'Đang hoạt động' : tk.status}</dd></div>
                    <div><dt className="inline text-slate-400">Tạo tài khoản: </dt><dd className="inline">{ngayGio(tk.taoLuc)}</dd></div>
                    <div><dt className="inline text-slate-400">Truy cập gần nhất: </dt><dd className="inline font-semibold text-[#0A2540]">{ngayGio(tk.lanCuoi)}</dd></div>
                    <div><dt className="inline text-slate-400">Bắt đầu ghi chi tiết: </dt><dd className="inline">{ngayGio(tk.batDauTheoDoi)}</dd></div>
                  </dl>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-4 text-[13px]">
                  <h3 className="font-bold text-[#0A2540]">Đã dùng những gì (từ lúc ghi)</h3>
                  {thongKe.length ? (
                    <ul className="mt-2 space-y-1">
                      {thongKe.map(([t, n]) => <li key={t} className="flex justify-between gap-2"><span className="text-slate-600">{t}</span><b className="tabular-nums text-[#0A2540]">{n}</b></li>)}
                    </ul>
                  ) : <p className="mt-1 text-slate-400">Chưa có hoạt động nào được ghi.</p>}
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-4 text-[13px]">
                  <h3 className="font-bold text-[#0A2540]">Dữ liệu có sẵn từ trước</h3>
                  <p className="text-[11.5px] text-slate-400">Những thứ tài khoản đã tạo ra, có từ trước khi bật ghi chi tiết.</p>
                  {tk.duLieuCu.length ? (
                    <ul className="mt-2 space-y-1.5">
                      {tk.duLieuCu.map((c) => (
                        <li key={c.ten}><div className="flex justify-between gap-2"><span className="text-slate-600">{c.ten}</span><b className="tabular-nums text-[#0A2540]">{c.so}</b></div>
                          <div className="text-[11px] text-slate-400">gần nhất {ngayGio(c.ganNhat)}</div></li>
                      ))}
                    </ul>
                  ) : <p className="mt-1 text-slate-400">Không có.</p>}
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-4 text-[13px]">
                  <h3 className="font-bold text-[#0A2540]">Thiết bị · địa chỉ mạng</h3>
                  {mayDung.length ? (
                    <ul className="mt-2 space-y-1">{mayDung.map(([k, n]) => <li key={k} className="flex justify-between gap-2"><span className="break-all text-slate-600">{k}</span><b className="tabular-nums">{n}</b></li>)}</ul>
                  ) : <p className="mt-1 text-slate-400">Chưa có.</p>}
                </section>
              </aside>

              <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="font-bold text-[#0A2540]">Dòng thời gian</h3>
                <p className="text-[11.5px] text-slate-400">Mới nhất ở trên. Các lần liên tiếp cùng một việc trong 3 phút được gộp thành một dòng.</p>
                {!theoNgay.length && <p className="mt-6 text-center text-[13px] text-slate-400">Chưa có hoạt động nào kể từ lúc bắt đầu ghi. Khi tài khoản này dùng web, các lần dùng sẽ hiện ở đây.</p>}
                {theoNgay.map(([d, ds]) => (
                  <div key={d} className="mt-4">
                    <h4 className="sticky top-0 z-[1] bg-white py-1 text-[12.5px] font-bold capitalize text-slate-500">{d}</h4>
                    <ol className="mt-1 divide-y divide-slate-100">
                      {ds.map((x, i) => (
                        <li key={i} className="flex gap-3 py-2 text-[13px]">
                          <span className="w-[86px] shrink-0 tabular-nums text-slate-500">{x.so > 1 ? `${gio(x.cuoi.luc)}–${gio(x.dau.luc)}` : gio(x.dau.luc)}</span>
                          <div className="min-w-0 flex-1">
                            <span className={`inline-block rounded px-1.5 py-0.5 font-semibold ring-1 ${x.nhom ? MAU_NHOM[x.nhom] : 'bg-slate-50 text-slate-700 ring-slate-200'}`}>{x.ten}</span>
                            {x.so > 1 && <span className="ml-1.5 text-[12px] text-slate-400">× {x.so}</span>}
                            {x.loi > 0 && <span className="ml-1.5 text-[12px] text-red-500">({x.loi} lần bị từ chối / lỗi)</span>}
                            {x.ct.length > 0 && <p className="mt-0.5 break-words text-[12px] text-slate-500">{x.ct.join(' · ')}</p>}
                            <p className="text-[11px] text-slate-400">{x.dau.thietBi} · {x.dau.ip}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
