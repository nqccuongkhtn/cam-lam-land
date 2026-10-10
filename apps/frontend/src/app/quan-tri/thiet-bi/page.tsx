'use client';
// ════════════════════════════════════════════════════════════════════════════════════════════
//  QUẢN LÝ THIẾT BỊ ĐĂNG NHẬP (10/10/2026) — CHỈ ADMIN. Máy chủ: apps/backend/src/routes/thietBi.ts + lib/thietBi.ts
//  Chủ dự án: khoá mỗi tài khoản tối đa 3 thiết bị (tính năng ẨN, bật ở đây), reset thiết bị qua Zalo admin (phí 100k),
//  và "quản lý thiết bị đang đăng nhập của tài khoản 1 cách chi tiết nhất … để có thể nói chuyện khi khách chối".
//  Trang cho xem: từng máy (loại máy, hệ điều hành, trình duyệt, màn hình, IP, lần đầu / lần đăng nhập cuối / lần hoạt
//  động cuối), LẦN ĐĂNG NHẬP CUỐI của tài khoản (kể cả lần BỊ CHẶN vì quá số máy), 10 TRA CỨU GẦN NHẤT, sổ reset / gỡ máy.
//  Chủ dự án dặn chỉ lưu chừng đó cho đỡ tốn dung lượng (không lưu lịch sử dài).
// ════════════════════════════════════════════════════════════════════════════════════════════
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth, laAdmin } from '@/lib/auth';

type TongQuan = { id: number; email: string; ten: string | null; phone: string | null; soMay: number; lanCuoi: string; soIp: number; vuaBiChan: boolean | null; soLanReset: number; toiDaRieng: number | null };
type May = { id: number; ten: string; loai: string; heDieuHanh: string; trinhDuyet: string; chiTiet: Record<string, any>; ipDau: string; ipCuoi: string; quocGia: string | null;
  lanDau: string; lanCuoi: string; soLanDangNhap: number; dnCuoi: string | null; ipDnCuoi: string | null; ma: string; ua: string };
type DangNhap = { may: number | null; ma: string; luc: string; ip: string; quocGia: string | null; ten: string; ua: string | null; cach: string; ketQua: string };
type TraCuu = { id: number; may: number | null; luc: string; ip: string; viec: string; moTa: string | null };
type Reset = { id: number; luc: string; soMay: number; dsMay: May[]; phi: number; ghiChu: string | null; admin: string | null };
type ChiTiet = { taiKhoan: { id: number; email: string; ten: string | null; phone: string | null; taoLuc: string; toiDaRieng: number | null }; toiDa: number;
  may: May[]; dnCuoi: DangNhap | null; traCuu: TraCuu[]; reset: Reset[]; batGioiHan: boolean; phi: number };

const gio = (s?: string | null) => s ? new Date(s).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }) : '—';
const CACH: Record<string, string> = { 'mat-khau': 'Mật khẩu', 'van-tay': 'Vân tay / khuôn mặt', 'dang-ky': 'Đăng ký tài khoản' };
const icon = (loai: string) => loai === 'Điện thoại' ? '📱' : loai === 'Máy tính bảng' ? '📲' : '💻';
const tien = (n: number) => n.toLocaleString('vi-VN') + 'đ';

export default function ThietBiPage() {
  const { user, loading } = useAuth();
  const [ds, setDs] = useState<TongQuan[] | null>(null);
  const [meta, setMeta] = useState<{ toiDaMacDinh: number; batGioiHan: boolean; zalo: string; phi: number } | null>(null);
  const [q, setQ] = useState('');
  const [chon, setChon] = useState<number | null>(null);
  const [ct, setCt] = useState<ChiTiet | null>(null);
  const [loi, setLoi] = useState('');
  const [tai, setTai] = useState(0);
  const [dangLam, setDangLam] = useState(false);

  useEffect(() => {
    if (!laAdmin(user)) return;
    const t = setTimeout(() => {
      api<any>(`/thiet-bi/admin/tong-quan?q=${encodeURIComponent(q)}`)
        .then((d) => { setDs(d.ds || []); setMeta({ toiDaMacDinh: d.toiDaMacDinh, batGioiHan: d.batGioiHan, zalo: d.zalo, phi: d.phi }); })
        .catch((e) => setLoi(e?.message || 'Không tải được'));
    }, 250);
    return () => clearTimeout(t);
  }, [user, q, tai]);
  useEffect(() => {
    if (chon == null) { setCt(null); return; }
    api<ChiTiet>(`/thiet-bi/admin/tai-khoan/${chon}`).then(setCt).catch((e) => setLoi(e?.message || 'Không tải được'));
  }, [chon, tai]);

  const batTat = async () => {
    if (!meta) return;
    const bat = !meta.batGioiHan;
    if (!confirm(bat
      ? `BẬT giới hạn ${meta.toiDaMacDinh} thiết bị?\n\n· Mọi tài khoản (trừ admin) phải ĐĂNG NHẬP LẠI một lần.\n· Thiết bị mới vượt giới hạn sẽ bị chặn và được nhắn liên hệ Zalo ${meta.zalo}.`
      : 'TẮT giới hạn thiết bị? (Sổ thiết bị vẫn tiếp tục ghi.)')) return;
    setDangLam(true);
    try { await api('/flags', { method: 'POST', body: JSON.stringify({ key: 'gioi_han_thiet_bi', on: bat }) }); await api('/thiet-bi/admin/ap-dung-co', { method: 'POST', body: '{}' }); setTai((n) => n + 1); }
    catch (e: any) { alert(e?.message || 'Không đổi được'); } finally { setDangLam(false); }
  };
  const goMay = async (m: May) => {
    const phi = prompt(`Gỡ thiết bị "${m.ten}" khỏi tài khoản?\nMáy này sẽ bị đăng xuất ngay.\n\nSố tiền đã thu cho lần này (đồng, để 0 nếu miễn phí):`, '0');
    if (phi === null) return;
    const ghiChu = prompt('Ghi chú (vd: khách đổi điện thoại, đã chuyển khoản…):', '') || '';
    setDangLam(true);
    try { await api(`/thiet-bi/admin/may/${m.id}`, { method: 'DELETE', body: JSON.stringify({ phi: Number(phi) || 0, ghiChu: ghiChu || 'Gỡ 1 thiết bị' }) }); setTai((n) => n + 1); }
    catch (e: any) { alert(e?.message || 'Không gỡ được'); } finally { setDangLam(false); }
  };
  const resetHet = async () => {
    if (!ct) return;
    const phi = prompt(`RESET TOÀN BỘ ${ct.may.length} thiết bị của ${ct.taiKhoan.email}?\nMọi máy sẽ bị đăng xuất; khách đăng nhập lại được trên ${ct.toiDa} máy mới.\n\nSố tiền đã thu (đồng):`, String(ct.phi));
    if (phi === null) return;
    const ghiChu = prompt('Ghi chú (vd: đã chuyển khoản 100k qua Zalo ngày …):', '') || '';
    setDangLam(true);
    try { await api(`/thiet-bi/admin/tai-khoan/${ct.taiKhoan.id}/reset`, { method: 'POST', body: JSON.stringify({ phi: Number(phi) || 0, ghiChu: ghiChu || 'Reset toàn bộ thiết bị' }) }); setTai((n) => n + 1); }
    catch (e: any) { alert(e?.message || 'Không reset được'); } finally { setDangLam(false); }
  };
  const doiGioiHan = async () => {
    if (!ct) return;
    const v = prompt(`Số thiết bị tối đa RIÊNG cho ${ct.taiKhoan.email} (để trống = theo mặc định ${meta?.toiDaMacDinh ?? 3}):`, ct.taiKhoan.toiDaRieng == null ? '' : String(ct.taiKhoan.toiDaRieng));
    if (v === null) return;
    try { await api(`/thiet-bi/admin/tai-khoan/${ct.taiKhoan.id}/gioi-han`, { method: 'PATCH', body: JSON.stringify({ toiDa: v.trim() === '' ? null : Number(v) }) }); setTai((n) => n + 1); }
    catch (e: any) { alert(e?.message || 'Không đổi được'); }
  };

  const tenMay = (id: number | null) => { const i = ct ? ct.may.findIndex((m) => m.id === id) : -1; return i >= 0 ? `Thiết bị ${i + 1}` : id ? 'máy đã gỡ' : '—'; };

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
          <h1 className="text-xl font-extrabold text-[#0A2540]">Thiết bị đăng nhập</h1>
          <p className="mt-0.5 text-[13px] text-slate-500">Mọi thiết bị từng đăng nhập của từng tài khoản · giờ Việt Nam · chỉ admin xem được.</p>
        </div>
        <button onClick={() => setTai((n) => n + 1)} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">↻ Làm mới</button>
      </div>

      {meta && (
        <div className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${meta.batGioiHan ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
          <div className="text-[13px] leading-snug">
            <b>Giới hạn {meta.toiDaMacDinh} thiết bị / tài khoản: {meta.batGioiHan ? 'ĐANG BẬT' : 'ĐANG TẮT (tính năng ẩn)'}</b><br />
            {meta.batGioiHan
              ? <>Máy mới vượt giới hạn bị chặn, khách được nhắn liên hệ Zalo {meta.zalo} (phí reset {tien(meta.phi)}). Admin không bị giới hạn.</>
              : <>Đang chỉ GHI SỔ thiết bị, chưa chặn ai. Bật lên thì mọi tài khoản phải đăng nhập lại một lần.</>}
          </div>
          <button disabled={dangLam} onClick={batTat} className={`h-9 rounded-md px-4 text-[13px] font-bold text-white ${meta.batGioiHan ? 'bg-slate-600' : 'bg-emerald-600'} disabled:opacity-50`}>
            {meta.batGioiHan ? 'Tắt giới hạn' : 'Bật giới hạn'}
          </button>
        </div>
      )}

      {loi && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">{loi}</p>}

      <div className="mt-4 grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* ── Danh sách tài khoản ── */}
        <div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm email / tên / số điện thoại"
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-[14px]" />
          {!ds && <p className="mt-4 text-center text-slate-400">Đang tải…</p>}
          {ds && !ds.length && <p className="mt-4 text-center text-[13px] text-slate-400">Chưa có thiết bị nào được ghi (sổ bắt đầu ghi từ lần đăng nhập kế tiếp).</p>}
          <div className="mt-2 max-h-[70vh] space-y-1 overflow-y-auto">
            {(ds || []).map((t) => {
              const toiDa = t.toiDaRieng ?? meta?.toiDaMacDinh ?? 3;
              return (
                <button key={t.id} onClick={() => setChon(t.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left ${chon === t.id ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                  <div className="truncate text-[13px] font-bold">{t.ten || t.email}</div>
                  <div className={`truncate text-[11px] ${chon === t.id ? 'text-slate-200' : 'text-slate-500'}`}>{t.email}{t.phone ? ` · ${t.phone}` : ''}</div>
                  <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                    <span className={`rounded px-1.5 font-bold ${t.soMay >= toiDa ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>{t.soMay}/{toiDa} máy</span>
                    <span className="rounded bg-slate-100 px-1.5 text-slate-700">{t.soIp} IP khác nhau</span>
                    {t.vuaBiChan && <span className="rounded bg-amber-100 px-1.5 font-bold text-amber-800">lần đăng nhập cuối bị chặn</span>}
                    {t.soLanReset > 0 && <span className="rounded bg-sky-100 px-1.5 text-sky-800">reset {t.soLanReset} lần</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Chi tiết một tài khoản ── */}
        <div className="min-w-0">
          {!ct && <p className="mt-10 text-center text-[13px] text-slate-400">Chọn một tài khoản bên trái để xem chi tiết.</p>}
          {ct && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg border bg-white p-3">
                <div className="text-[13px] leading-relaxed">
                  <div className="text-[15px] font-extrabold text-[#0A2540]">{ct.taiKhoan.ten || ct.taiKhoan.email}</div>
                  <div className="text-slate-600">{ct.taiKhoan.email}{ct.taiKhoan.phone ? ` · ${ct.taiKhoan.phone}` : ''} · tạo {gio(ct.taiKhoan.taoLuc)}</div>
                  <div className="text-slate-600">Đang có <b>{ct.may.length}/{ct.toiDa}</b> thiết bị{ct.taiKhoan.toiDaRieng != null && ' (giới hạn riêng)'}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={doiGioiHan} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-[13px] font-semibold">Đổi giới hạn riêng</button>
                  <button disabled={dangLam || !ct.may.length} onClick={resetHet} className="h-9 rounded-md bg-red-600 px-3 text-[13px] font-bold text-white disabled:opacity-40">Reset toàn bộ thiết bị</button>
                </div>
              </div>

              {/* Từng thiết bị */}
              <div className="space-y-2">
                {ct.may.map((m, i) => {
                  const c = m.chiTiet || {};
                  return (
                    <div key={m.id} className="rounded-lg border bg-white p-3 text-[13px]">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="font-bold text-[#0A2540]">{icon(m.loai)} Thiết bị {i + 1}: {c.model ? `${c.model} · ${m.trinhDuyet}` : m.ten}</div>
                        <button disabled={dangLam} onClick={() => goMay(m)} className="h-8 rounded-md border border-red-300 px-2.5 text-[12px] font-semibold text-red-700 hover:bg-red-50">Gỡ máy này</button>
                      </div>
                      <div className="mt-1.5 grid gap-x-6 gap-y-0.5 text-slate-700 sm:grid-cols-2">
                        <div>Loại: <b>{m.loai}</b> · {m.heDieuHanh}{c.banNenTang ? ` (${c.nenTang || ''} ${c.banNenTang})` : ''}</div>
                        <div>Trình duyệt: <b>{m.trinhDuyet}</b></div>
                        <div>Đăng nhập lần đầu: <b>{gio(m.lanDau)}</b></div>
                        <div>Đăng nhập gần nhất: <b>{gio(m.dnCuoi)}</b>{m.ipDnCuoi ? ` · IP ${m.ipDnCuoi}` : ''}</div>
                        <div>Hoạt động gần nhất: <b>{gio(m.lanCuoi)}</b></div>
                        <div>Số lần đăng nhập: <b>{m.soLanDangNhap}</b></div>
                        <div>IP lần đầu: <b>{m.ipDau || '—'}</b>{m.quocGia ? ` · ${m.quocGia}` : ''}</div>
                        <div>IP gần nhất: <b>{m.ipCuoi || '—'}</b></div>
                        {(c.manHinh || c.muiGio) && <div>Màn hình: {c.manHinh || '—'}{c.tiLe ? ` (×${c.tiLe})` : ''} · múi giờ {c.muiGio || '—'} · {c.ngonNgu || ''}</div>}
                        {(c.nhanCpu || c.ram) && <div>CPU {c.nhanCpu || '?'} nhân · RAM ~{c.ram || '?'} GB · cảm ứng {c.cham ? `${c.cham} điểm` : 'không'}</div>}
                        <div className="sm:col-span-2 break-all text-[11px] text-slate-400">Mã thiết bị: {m.ma}</div>
                        <div className="sm:col-span-2 break-all text-[11px] text-slate-400">Trình duyệt tự khai: {m.ua}</div>
                      </div>
                    </div>
                  );
                })}
                {!ct.may.length && <p className="text-[13px] text-slate-400">Tài khoản đang không có thiết bị nào.</p>}
              </div>

              {/* Lần đăng nhập cuối */}
              <div className="rounded-lg border bg-white p-3 text-[13px]">
                <h2 className="text-[14px] font-extrabold text-[#0A2540]">Lần đăng nhập cuối</h2>
                {!ct.dnCuoi && <p className="mt-1 text-slate-400">Chưa ghi nhận (sổ bắt đầu ghi từ lần đăng nhập kế tiếp).</p>}
                {ct.dnCuoi && (
                  <div className={`mt-1 rounded-md px-2 py-1.5 ${ct.dnCuoi.ketQua === 'bi-chan' ? 'bg-amber-50' : ''}`}>
                    <b>{gio(ct.dnCuoi.luc)}</b> · {ct.dnCuoi.ketQua === 'bi-chan' ? <b className="text-amber-700">BỊ CHẶN (đã đủ số máy)</b> : <span className="text-emerald-700">thành công</span>}
                    {' '}· {ct.dnCuoi.ten} ({ct.dnCuoi.ketQua === 'bi-chan' ? 'máy mới, chưa có trong danh sách' : tenMay(ct.dnCuoi.may)})
                    {' '}· IP {ct.dnCuoi.ip}{ct.dnCuoi.quocGia ? ` · ${ct.dnCuoi.quocGia}` : ''} · {CACH[ct.dnCuoi.cach] || ct.dnCuoi.cach}
                    {ct.dnCuoi.ua && <div className="break-all text-[11px] text-slate-400">Trình duyệt tự khai: {ct.dnCuoi.ua}</div>}
                  </div>
                )}
              </div>

              {/* 10 tra cứu gần nhất */}
              <div className="rounded-lg border bg-white p-3">
                <h2 className="text-[14px] font-extrabold text-[#0A2540]">10 lần tra cứu gần nhất</h2>
                {!ct.traCuu.length && <p className="mt-1 text-[13px] text-slate-400">Chưa có lần tra cứu nào được ghi.</p>}
                {ct.traCuu.length > 0 && (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-[12px]">
                      <thead className="text-slate-500"><tr><th className="py-1 pr-2">Thời gian</th><th className="pr-2">Việc</th><th className="pr-2">Chi tiết</th><th className="pr-2">Thiết bị</th><th>IP</th></tr></thead>
                      <tbody>
                        {ct.traCuu.map((t) => (
                          <tr key={t.id} className="border-t">
                            <td className="py-1 pr-2 whitespace-nowrap">{gio(t.luc)}</td>
                            <td className="pr-2">{t.viec}</td>
                            <td className="pr-2">{t.moTa || '—'}</td>
                            <td className="pr-2 whitespace-nowrap">{tenMay(t.may)}</td>
                            <td className="whitespace-nowrap">{t.ip}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Sổ reset */}
              {ct.reset.length > 0 && (
                <div className="rounded-lg border bg-white p-3">
                  <h2 className="text-[14px] font-extrabold text-[#0A2540]">Các lần reset / gỡ thiết bị</h2>
                  <ul className="mt-2 space-y-1.5 text-[12px] text-slate-700">
                    {ct.reset.map((r) => (
                      <li key={r.id} className="border-t pt-1.5">
                        <b>{gio(r.luc)}</b> · gỡ {r.soMay} máy · thu <b>{tien(r.phi)}</b> · bởi {r.admin || '—'}{r.ghiChu ? ` · “${r.ghiChu}”` : ''}
                        <div className="text-slate-500">{r.dsMay.map((m) => `${m.ten} (từ ${gio(m.lanDau)}, IP ${m.ipCuoi || '—'})`).join(' · ')}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
