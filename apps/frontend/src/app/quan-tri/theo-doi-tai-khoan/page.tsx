'use client';
// ════════════════════════════════════════════════════════════════════════════════════════════
//  BÁO CÁO HOẠT ĐỘNG TÀI KHOẢN — TẠM THỜI, DỄ GỠ (chủ dự án 1/10/2026). CHỈ ADMIN xem được
//  (máy chủ kiểm quyền ở /api/theo-doi/bao-cao, trang này chỉ là phần hiển thị).
//  Gỡ: xoá thư mục này + mục 'theo-doi-tk' trong app/quan-tri/page.tsx — xem apps/backend/src/routes/theoDoiTk.ts.
//
//  Viết cho NGƯỜI BÌNH THƯỜNG đọc (chủ dự án: "đọc sao hiểu được"): không hiện đường dẫn kỹ thuật.
//  · Mọi lần gọi máy chủ cách nhau dưới 10 phút = MỘT LẦN VÀO WEB (có giờ vào, giờ ra, bao lâu).
//  · Tín hiệu "đang mở web" (/api/auth/ping, ~30 giây/lần) và các lần tải TỰ ĐỘNG khi mở trang KHÔNG phải
//    thao tác của người dùng → chỉ dùng để tính thời gian, không liệt kê. (Bản đầu gọi nhầm ping là
//    "đổi mật khẩu" → chủ dự án hỏi "đổi mk gì mà tận 136 lần".)
// ════════════════════════════════════════════════════════════════════════════════════════════
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth, laAdmin, TEN_VAI_TRO } from '@/lib/auth';

// moTa: máy chủ đã dịch sẵn lần tra cứu ra chữ, vd "Thửa 45 · Tờ 12 · Xã Cam Lâm" (xem giaiNghia trong theoDoiTk.ts).
type HoatDong = { luc: string; loai: string; pt: string | null; duong: string; ma: number | null; ip: string; thietBi: string; moTa?: string };
type TaiKhoan = {
  id: number; email: string; ten: string | null; phone: string | null; role: string; roles: string[] | null; status: string;
  taoLuc: string; lanCuoi: string | null; batDauTheoDoi: string;
  duLieuCu: { ten: string; so: number; ganNhat: string | null }[];
  hoatDong: HoatDong[]; tongHoatDong: number; ghiTu: string | null;
};

// ── Đổi lần gọi máy chủ → VIỆC NGƯỜI DÙNG LÀM. null = tự động / nền, không phải thao tác. ──
// `quanTrong`: các việc chủ dự án cần để ý, luôn ghi Có / Không cho từng ngày.
const QUAN_TRONG = ['Tra cứu thửa đất', 'Mở danh sách nóng', 'Tra mã xác thực', 'Tải file kho hồ sơ', 'Lập danh mục hồ sơ'] as const;
type Viec = { ten: string; quanTrong?: (typeof QUAN_TRONG)[number]; ct?: string } | null;
function viecCua(h: HoatDong): Viec {
  if (h.loai === 'dang-nhap') return { ten: 'Đăng nhập' };
  const [duong, q = ''] = h.duong.split('?');
  const p = new URLSearchParams(q);
  const pt = h.pt || 'GET';
  const doc = pt === 'GET';
  // Tín hiệu "đang mở web" + các lần trang TỰ tải khi mở (không phải người dùng bấm)
  if (/^\/api\/auth\/(ping|me)\b|^\/api\/track\b|^\/api\/(partners|flags|config|news|map-ads|logo-le)\b|^\/api\/listings\/areas\b|^\/api\/chat\/(advisory-access|mention|unread)/.test(duong)) return null;
  if (/^\/api\/projects\b/.test(duong) && doc) return null;
  if (/^\/api\/dc\/tim/.test(duong)) {
    const ct = h.moTa || [p.get('thua') && `Thửa ${p.get('thua')}`, p.get('to') && `Tờ ${p.get('to')}`].filter(Boolean).join(' · ');
    return { ten: 'Gõ số tờ / số thửa để tìm thửa đất', quanTrong: 'Tra cứu thửa đất', ct: ct || undefined };
  }
  if (/^\/api\/parcels\/at/.test(duong)) return { ten: 'Bấm vào thửa đất trên bản đồ để xem thông tin', quanTrong: 'Tra cứu thửa đất', ct: h.moTa };
  if (/^\/api\/dc\//.test(duong) || /^\/api\/parcels/.test(duong)) return { ten: 'Xem bản đồ thửa đất' };
  if (/^\/api\/hotlist\/goc/.test(duong)) return { ten: 'Mở danh sách nóng', quanTrong: 'Mở danh sách nóng' };
  if (/^\/api\/hotlist/.test(duong)) return { ten: doc ? 'Xem danh sách nóng' : 'Thêm / sửa danh sách nóng', quanTrong: 'Mở danh sách nóng' };
  if (/^\/api\/totp/.test(duong)) return { ten: 'Tra mã xác thực 2 lớp', quanTrong: 'Tra mã xác thực' };
  if (/^\/api\/kho-ho-so\/\d+\/tai/.test(duong)) return { ten: 'Tải một file trong kho hồ sơ', quanTrong: 'Tải file kho hồ sơ' };
  if (/^\/api\/kho-ho-so/.test(duong)) return { ten: doc ? 'Xem kho hồ sơ' : 'Thêm / xoá file kho hồ sơ' };
  if (/^\/api\/danh-muc\/(run|quote)/.test(duong)) return { ten: 'Lập danh mục hồ sơ', quanTrong: 'Lập danh mục hồ sơ' };
  if (/^\/api\/danh-muc/.test(duong)) return { ten: 'Mở công cụ lập danh mục' };
  if (/^\/api\/van-ban\/[^/]+\/pdf/.test(duong)) return { ten: 'Tải một văn bản' };
  if (/^\/api\/van-ban/.test(duong)) return { ten: 'Tra cứu văn bản' };
  if (/^\/api\/pdftools\//.test(duong)) return { ten: 'Dùng công cụ sửa PDF' };
  if (/^\/api\/ocr/.test(duong)) return { ten: 'Đọc chữ từ ảnh (sổ đỏ / bảng toạ độ)' };
  if (/^\/api\/qr/.test(duong)) return { ten: 'Tra cứu QR sổ đỏ' };
  if (/\/reveal$/.test(duong)) return { ten: 'Bấm "Hiện số" điện thoại người đăng tin' };
  if (/^\/api\/listings\/\d+$/.test(duong)) return { ten: doc ? 'Xem chi tiết một tin nhà đất' : 'Sửa / xoá tin đăng' };
  if (/^\/api\/listings/.test(duong)) return { ten: doc ? 'Xem danh sách nhà đất' : 'Đăng tin / sửa tin' };
  if (/^\/api\/chat/.test(duong)) return { ten: doc ? 'Mở khung chat' : 'Gửi tin nhắn chat' };
  if (/^\/api\/crm/.test(duong)) return { ten: 'Dùng sổ khách hàng (CRM)' };
  if (/^\/api\/saved-places/.test(duong)) return { ten: doc ? 'Xem điểm đã lưu' : 'Lưu / xoá điểm trên bản đồ' };
  if (/^\/api\/chi-duong/.test(duong)) return { ten: 'Tìm đường đi' };
  if (/^\/api\/do-cao/.test(duong)) return { ten: 'Tra độ cao mặt đất' };
  if (/^\/api\/ai\//.test(duong)) return { ten: 'Nhờ AI viết kịch bản video' };
  if (/^\/api\/payments/.test(duong)) return { ten: 'Xem / mua gói dịch vụ' };
  if (/^\/api\/projects/.test(duong)) return { ten: 'Xem dự án' };
  if (/^\/api\/layers/.test(duong)) return { ten: 'Xem lớp bản đồ quy hoạch' };
  if (/^\/api\/auth\/me/.test(duong) && !doc) return { ten: 'Sửa thông tin tài khoản' };
  if (/^\/api\/auth\/login/.test(duong)) return { ten: 'Đăng nhập' };
  if (/^\/api\/admin/.test(duong)) return { ten: 'Vào trang quản trị' };
  return doc ? null : { ten: 'Thao tác khác' };
}

const TZ = { timeZone: 'Asia/Ho_Chi_Minh' } as const;
const gio = (s: string | number) => new Date(s).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', ...TZ });
const ngayDai = (s: string | number) => new Date(s).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', ...TZ });
const ngayGio = (s?: string | null) => (s ? new Date(s).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', ...TZ }) : '—');
function baoLau(ms: number) {
  const ph = Math.round(ms / 60_000);
  if (ph < 1) return 'dưới 1 phút';
  if (ph < 60) return `${ph} phút`;
  return `${Math.floor(ph / 60)} giờ ${ph % 60 ? `${ph % 60} phút` : ''}`.trim();
}

type LanVao = { tu: number; den: number; may: string; ip: string; viec: Map<string, { so: number; ct: string[] }>; quanTrong: Map<string, number> };
type Ngay = { ngay: string; lan: LanVao[]; tongMs: number; quanTrong: Map<string, number>; soViec: number };

// Gom thành "các lần vào web": hai lần gọi cách nhau > 10 phút = lần vào mới.
function phanTich(ds: HoatDong[]): Ngay[] {
  const tang = [...ds].sort((a, b) => +new Date(a.luc) - +new Date(b.luc));
  const lan: LanVao[] = [];
  for (const h of tang) {
    const t = +new Date(h.luc);
    let cur = lan[lan.length - 1];
    if (!cur || t - cur.den > 10 * 60_000 || ngayDai(cur.den) !== ngayDai(t)) {
      cur = { tu: t, den: t, may: h.thietBi, ip: h.ip, viec: new Map(), quanTrong: new Map() };
      lan.push(cur);
    }
    cur.den = t;
    const v = viecCua(h);
    if (!v) continue;
    const ten = h.ma != null && h.ma >= 400 ? `${v.ten} (bị từ chối)` : v.ten;
    const o = cur.viec.get(ten) || { so: 0, ct: [] };
    o.so++; if (v.ct && !o.ct.includes(v.ct) && o.ct.length < 20) o.ct.push(v.ct);
    cur.viec.set(ten, o);
    if (v.quanTrong && !(h.ma != null && h.ma >= 400)) cur.quanTrong.set(v.quanTrong, (cur.quanTrong.get(v.quanTrong) || 0) + 1);
  }
  const theoNgay = new Map<string, Ngay>();
  for (const l of lan) {
    const k = ngayDai(l.tu);
    const n: Ngay = theoNgay.get(k) || { ngay: k, lan: [] as LanVao[], tongMs: 0, quanTrong: new Map(), soViec: 0 };
    n.lan.push(l);
    n.tongMs += Math.max(l.den - l.tu, 30_000);
    l.quanTrong.forEach((so, ten) => n.quanTrong.set(ten, (n.quanTrong.get(ten) || 0) + so));
    l.viec.forEach((v) => (n.soViec += v.so));
    theoNgay.set(k, n);
  }
  return Array.from(theoNgay.values()).reverse();                     // ngày mới nhất lên đầu
}

export default function TheoDoiTaiKhoanPage() {
  const { user, loading } = useAuth();
  const [dl, setDl] = useState<TaiKhoan[] | null>(null);
  const [loi, setLoi] = useState('');
  const [chon, setChon] = useState(0);
  const [ngayMo, setNgayMo] = useState<string | null>(null);
  const [tai, setTai] = useState(0);

  useEffect(() => {
    if (!laAdmin(user)) return;
    setLoi('');
    api<{ taiKhoan: TaiKhoan[] }>('/theo-doi/bao-cao').then((d) => setDl(d.taiKhoan || [])).catch((e) => setLoi(e?.message || 'Không tải được báo cáo'));
  }, [user, tai]);

  const tk = dl?.[chon];
  const ngayDs = useMemo(() => (tk ? phanTich(tk.hoatDong) : []), [tk]);
  const ngayDangXem = ngayDs.find((n) => n.ngay === ngayMo) || ngayDs[0];

  if (loading) return <div className="p-10 text-center text-slate-400">Đang tải…</div>;
  if (!laAdmin(user)) return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="text-4xl">🔒</div>
      <p className="mt-2 font-extrabold text-[#0A2540]">Chỉ quản trị viên được xem trang này</p>
      <Link href="/" className="mt-4 inline-block font-semibold text-[#C8A14B]">← Về trang chủ</Link>
    </div>
  );

  const Co = ({ so }: { so?: number }) => so
    ? <span className="inline-block rounded bg-red-50 px-1.5 py-0.5 text-[12px] font-bold text-red-700 ring-1 ring-red-200">Có · {so} lần</span>
    : <span className="text-[12px] text-slate-400">Không</span>;

  return (
    <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[#0A2540]">Theo dõi hoạt động tài khoản</h1>
          <p className="mt-0.5 text-[13px] text-slate-500">Chỉ admin xem được · tính năng tạm thời · giờ Việt Nam.</p>
        </div>
        <button onClick={() => setTai((n) => n + 1)} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">↻ Làm mới</button>
      </div>

      {loi && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">{loi}</p>}
      {!dl && !loi && <p className="mt-8 text-center text-slate-400">Đang tải báo cáo…</p>}

      {dl && dl.length > 0 && (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {dl.map((t, i) => (
              <button key={t.id} onClick={() => { setChon(i); setNgayMo(null); }}
                className={`rounded-md border px-4 py-2 text-left text-[14px] font-bold ${i === chon ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                {t.ten || t.email}
              </button>
            ))}
          </div>

          {tk && (
            <>
              {/* Thông tin tài khoản — một dải ngang gọn */}
              <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-[13.5px]">
                <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  <p><span className="text-slate-400">Họ tên: </span><b className="text-[#0A2540]">{tk.ten || '—'}</b></p>
                  <p><span className="text-slate-400">Điện thoại: </span>{tk.phone || '—'}</p>
                  <p className="break-all"><span className="text-slate-400">Email: </span>{tk.email}</p>
                  <p><span className="text-slate-400">Quyền: </span>{(tk.roles?.length ? tk.roles : [tk.role]).map((r) => (TEN_VAI_TRO[r] || r).replace(/^\S+\s/, '')).join(', ')}</p>
                  <p><span className="text-slate-400">Tạo tài khoản: </span>{ngayGio(tk.taoLuc)}</p>
                  <p><span className="text-slate-400">Vào web gần nhất: </span><b className="text-[#0A2540]">{ngayGio(tk.lanCuoi)}</b></p>
                </div>
                <p className="mt-2 text-[12px] text-slate-400">Bắt đầu ghi nhận từ {ngayGio(tk.batDauTheoDoi)} — trước thời điểm này web không lưu lại các lần sử dụng.</p>
              </section>

              {/* BẢNG TỪNG NGÀY */}
              <section className="mt-4 rounded-lg border border-slate-200 bg-white">
                <h2 className="border-b border-slate-100 px-4 py-3 font-bold text-[#0A2540]">Tổng hợp theo ngày <span className="font-normal text-[12.5px] text-slate-400">— bấm vào một ngày để xem chi tiết</span></h2>
                {!ngayDs.length ? <p className="px-4 py-6 text-center text-[13px] text-slate-400">Chưa vào web lần nào kể từ lúc bắt đầu ghi nhận.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-[13px]">
                      <thead className="bg-slate-50 text-left text-[12px] text-slate-500">
                        <tr>
                          <th className="px-4 py-2 font-semibold">Ngày</th>
                          <th className="px-3 py-2 font-semibold">Số lần vào web</th>
                          <th className="px-3 py-2 font-semibold">Thời gian ở trên web</th>
                          {QUAN_TRONG.map((q) => <th key={q} className="px-3 py-2 font-semibold">{q}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {ngayDs.map((n) => (
                          <tr key={n.ngay} onClick={() => setNgayMo(n.ngay)}
                            className={`cursor-pointer border-t border-slate-100 ${n === ngayDangXem ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                            <td className="px-4 py-2.5 font-semibold capitalize text-[#0A2540]">{n.ngay}</td>
                            <td className="px-3 py-2.5 tabular-nums">{n.lan.length} lần</td>
                            <td className="px-3 py-2.5">{baoLau(n.tongMs)}</td>
                            {QUAN_TRONG.map((q) => <td key={q} className="px-3 py-2.5"><Co so={n.quanTrong.get(q)} /></td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* CHI TIẾT MỘT NGÀY: từng lần vào web */}
              {ngayDangXem && (
                <section className="mt-4 rounded-lg border border-slate-200 bg-white">
                  <h2 className="border-b border-slate-100 px-4 py-3 font-bold capitalize text-[#0A2540]">Chi tiết {ngayDangXem.ngay}</h2>
                  <ol className="divide-y divide-slate-100">
                    {ngayDangXem.lan.map((l, i) => {
                      const viec = Array.from(l.viec.entries());
                      return (
                        <li key={i} className="px-4 py-3.5 text-[13.5px]">
                          <p className="font-bold text-[#0A2540]">
                            Lần {i + 1}: từ {gio(l.tu)} đến {gio(l.den)} <span className="font-normal text-slate-500">({baoLau(l.den - l.tu)})</span>
                          </p>
                          <p className="mt-0.5 text-[12.5px] text-slate-500">Dùng {l.may} · địa chỉ mạng {l.ip}</p>
                          {viec.length ? (
                            <ul className="mt-2 space-y-1">
                              {viec.map(([ten, v]) => (
                                <li key={ten} className="flex gap-2">
                                  <span className="text-slate-400">•</span>
                                  <span className="min-w-0">
                                    <span className={/từ chối/.test(ten) ? 'text-red-600' : 'text-slate-700'}>{ten}</span>
                                    {v.so > 1 && <span className="text-slate-400"> — {v.so} lần</span>}
                                    {v.ct.length > 0 && (
                                      <span className="mt-0.5 flex flex-wrap gap-1">
                                        {v.ct.map((c) => <span key={c} className="rounded bg-sky-50 px-1.5 py-0.5 text-[12px] font-semibold text-sky-800 ring-1 ring-sky-200">{c}</span>)}
                                      </span>
                                    )}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : <p className="mt-2 text-slate-500">Chỉ mở web để xem, <b>không bấm hay tra cứu gì</b>.</p>}
                        </li>
                      );
                    })}
                  </ol>
                </section>
              )}

              {tk.duLieuCu.length > 0 && (
                <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-[13px]">
                  <h2 className="font-bold text-[#0A2540]">Những thứ tài khoản đã tạo từ trước</h2>
                  <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {tk.duLieuCu.map((c) => <li key={c.ten}>{c.ten}: <b>{c.so}</b> <span className="text-slate-400">(gần nhất {ngayGio(c.ganNhat)})</span></li>)}
                  </ul>
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
