'use client';
/* eslint-disable react-hooks/exhaustive-deps */
// TRA CỨU & HỌC LUẬT ĐẤT ĐAI — CHỈ QUẢN TRỊ VIÊN XEM ĐƯỢC.
//
// Nguyên tắc số một: NGUYÊN VĂN LÀ NGUYÊN VĂN. Chữ luật lấy từ bản PDF ký số đăng Công báo,
// tách máy ra JSON, KHÔNG viết lại một chữ nào. Phần "giải thích cho dễ hiểu" để RIÊNG một
// khung màu khác, ghi rõ "không phải văn bản luật" — người đọc không bao giờ lẫn hai thứ.
// (Bản HTML toàn văn trên cổng Chính phủ THIẾU 3 điều mà không báo gì — xem scripts/luat.)
//
// Cách bày cho dễ nhớ: cây CHƯƠNG → MỤC → ĐIỀU lấy thẳng từ cấu trúc của chính đạo luật,
// không tự chế "chủ đề" theo cảm tính. Muốn tra nhanh theo việc thật (sổ đỏ, đền bù, tách thửa…)
// thì dùng hàng CHỦ ĐỀ NHANH — bản chất là câu tìm sẵn, bấm một cái ra đúng nhóm điều.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth, coVaiTro } from '@/lib/auth';

type Diem = { ky: string; chu: string };
type Khoan = { so: number; chu: string; diem: Diem[] };
type Dieu = { so: number; tieuDe: string; chuong: string; chuongTen: string; muc: string | null; mucTen: string; khoan: Khoan[] };
type VanBan = { ma: string; soHieu: string; ngay: string; ten: string; nguon: string; chuong: { so: string; ten: string }[]; dieu: Dieu[] };

type VanBanNgan = { id: number; loai: string; so: string; ten: string; tep: string[]; link: string };

const KHO = [
  { ma: 'ldd2024', ten: 'Luật Đất đai 2024', soHieu: '31/2024/QH15', tep: '/luat/ldd2024.json', hieuLuc: 'Hiệu lực 01/8/2024' },
];

// Bỏ dấu để gõ "dat dai" vẫn ra "đất đai".
const kd = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

// CHỦ ĐỀ NHANH = câu tìm sẵn theo việc người ta hay hỏi. Không phải phân loại pháp lý,
// chỉ là lối tắt — nên để nguyên chữ trong luật để tìm cho trúng.
const CHU_DE: { ten: string; icon: string; tim: string }[] = [
  { ten: 'Sổ đỏ / cấp giấy chứng nhận', icon: '📗', tim: 'giấy chứng nhận quyền sử dụng đất' },
  { ten: 'Thu hồi đất', icon: '🚧', tim: 'thu hồi đất' },
  { ten: 'Bồi thường, tái định cư', icon: '💵', tim: 'bồi thường' },
  { ten: 'Giá đất, bảng giá đất', icon: '🏷️', tim: 'giá đất' },
  { ten: 'Giao đất, cho thuê đất', icon: '🤝', tim: 'giao đất, cho thuê đất' },
  { ten: 'Chuyển mục đích sử dụng', icon: '🔁', tim: 'chuyển mục đích sử dụng đất' },
  { ten: 'Hạn mức & thời hạn', icon: '📏', tim: 'hạn mức' },
  { ten: 'Đất nông nghiệp', icon: '🌾', tim: 'đất nông nghiệp' },
  { ten: 'Đất ở', icon: '🏠', tim: 'đất ở' },
  { ten: 'Tách thửa, hợp thửa', icon: '✂️', tim: 'tách thửa' },
  { ten: 'Tranh chấp, khiếu nại', icon: '⚖️', tim: 'tranh chấp đất đai' },
  { ten: 'Quy hoạch sử dụng đất', icon: '🗺️', tim: 'quy hoạch sử dụng đất' },
  { ten: 'Tiền sử dụng đất, thuê đất', icon: '🧾', tim: 'tiền sử dụng đất' },
  { ten: 'Thừa kế, tặng cho, chuyển nhượng', icon: '📜', tim: 'chuyển nhượng' },
];

export default function TraCuuLuatPage() {
  const { user, loading } = useAuth() as any;
  const duocXem = coVaiTro(user, 'admin');

  const [vb, setVb] = useState<VanBan | null>(null);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState('');
  const [tim, setTim] = useState('');
  const [chon, setChon] = useState<number | null>(null);
  const [moChuong, setMoChuong] = useState<Record<string, boolean>>({});
  const [ghim, setGhim] = useState<number[]>([]);
  const [chiGhim, setChiGhim] = useState(false);
  const [the, setThe] = useState<'luat' | 'danhmuc'>('luat');
  const [dm, setDm] = useState<VanBanNgan[]>([]);
  const [timDm, setTimDm] = useState('');
  const [locLoai, setLocLoai] = useState('');
  const oNoiDung = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!duocXem) return;
    setDangTai(true);
    fetch(KHO[0].tep).then((r) => r.json()).then((d: VanBan) => { setVb(d); setDangTai(false); })
      .catch(() => { setLoi('Không tải được dữ liệu luật.'); setDangTai(false); });
  }, [duocXem]);

  useEffect(() => { try { setGhim(JSON.parse(localStorage.getItem('luat-ghim') || '[]')); } catch { /* */ } }, []);
  // Danh mục văn bản: cào cả dải mã văn bản của Hệ thống văn bản Chính phủ rồi lọc theo từ khoá đất đai
  // (xem scripts/luat/cao-van-ban-dat-dai.py) — nên KHÔNG SÓT như cách dùng ô tìm kiếm của trang gốc.
  useEffect(() => { if (the === 'danhmuc' && !dm.length) fetch('/luat/danh-muc.json').then((r) => r.json()).then((d) => setDm(d.vanBan || [])).catch(() => {}); }, [the, dm.length]);
  const doiGhim = (so: number) => setGhim((g) => {
    const m = g.includes(so) ? g.filter((x) => x !== so) : [...g, so];
    try { localStorage.setItem('luat-ghim', JSON.stringify(m)); } catch { /* */ }
    return m;
  });

  // Chuẩn bị sẵn chuỗi không dấu của từng điều để tìm cho nhanh (260 điều, làm một lần).
  const chiMuc = useMemo(() => {
    if (!vb) return [];
    return vb.dieu.map((d) => ({
      d,
      kho: kd(`Điều ${d.so} ${d.tieuDe} ${d.khoan.map((k) => k.chu + ' ' + k.diem.map((x) => x.chu).join(' ')).join(' ')}`),
    }));
  }, [vb]);

  const ketQua = useMemo(() => {
    const q = kd(tim.trim());
    let ds = chiMuc;
    if (chiGhim) ds = ds.filter((x) => ghim.includes(x.d.so));
    if (!q) return ds.map((x) => x.d);
    // Gõ "điều 75" hay "75" -> nhảy thẳng tới điều đó
    const soDieu = /^(?:dieu\s*)?(\d{1,3})$/.exec(q);
    if (soDieu) {
      const s = Number(soDieu[1]);
      const t = ds.find((x) => x.d.so === s);
      if (t) return [t.d];
    }
    return ds.filter((x) => x.kho.includes(q)).map((x) => x.d);
  }, [chiMuc, tim, chiGhim, ghim]);

  const dieuDangXem = useMemo(() => (vb && chon != null ? vb.dieu.find((d) => d.so === chon) || null : null), [vb, chon]);

  // Tô vàng chỗ khớp từ khoá trong nguyên văn (chỉ tô, không đổi chữ).
  const toVang = (chu: string) => {
    const q = tim.trim();
    if (!q || q.length < 2) return chu;
    const k = kd(chu), qq = kd(q);
    const ra: React.ReactNode[] = [];
    let i = 0, j = k.indexOf(qq);
    while (j >= 0) {
      ra.push(chu.slice(i, j));
      ra.push(<mark key={i + '-' + j} className="rounded bg-amber-200 px-0.5">{chu.slice(j, j + q.length)}</mark>);
      i = j + q.length;
      j = k.indexOf(qq, i);
    }
    ra.push(chu.slice(i));
    return ra;
  };

  const chep = (d: Dieu) => {
    const t = `Điều ${d.so}. ${d.tieuDe}\n` + d.khoan.map((k) =>
      (k.so ? `${k.so}. ` : '') + k.chu + (k.diem.length ? '\n' + k.diem.map((x) => `${x.ky}) ${x.chu}`).join('\n') : '')).join('\n')
      + `\n\n(${vb?.ten} — ${vb?.soHieu})`;
    navigator.clipboard?.writeText(t);
  };

  if (loading) return <div className="p-6 text-slate-500">Đang kiểm tra quyền…</div>;
  if (!duocXem) return (
    <div className="mx-auto max-w-lg p-6 text-center">
      <p className="text-4xl">🔒</p>
      <h1 className="mt-2 text-lg font-bold text-[#0A2540]">Mục này chỉ dành cho quản trị viên</h1>
      <p className="mt-1 text-sm text-slate-500">Hãy đăng nhập bằng tài khoản có quyền quản trị.</p>
      <Link href="/tien-ich" className="mt-4 inline-block rounded-lg border px-4 py-2 text-sm font-semibold text-[#0A2540]">← Về Tiện ích</Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-extrabold text-[#0A2540] sm:text-2xl">⚖️ Tra cứu &amp; học Luật Đất đai</h1>
        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">Nội bộ</span>
      </div>
      <p className="mt-1 text-[12.5px] leading-snug text-slate-500">
        {vb ? <>Đang xem <b className="text-[#0A2540]">{vb.ten}</b> — số {vb.soHieu}, {vb.dieu.length} điều, {vb.chuong.length} chương.
          Nguyên văn lấy từ {vb.nguon}.</> : 'Đang tải…'}
      </p>

      <div className="mt-3 flex gap-1.5">
        {([['luat', '⚖️ Toàn văn Luật Đất đai 2024'], ['danhmuc', '📚 Danh mục văn bản đất đai']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setThe(k)}
            className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${the === k ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{l}</button>
        ))}
      </div>

      {the === 'danhmuc' && (
        <div className="mt-3">
          <p className="text-[12.5px] leading-snug text-slate-500">
            Toàn bộ văn bản về đất đai trên <b>Hệ thống văn bản của Chính phủ</b> — máy quét lần lượt từng mã văn bản
            rồi lọc theo từ khoá nên <b>không sót</b>. Bấm vào từng dòng để mở bản gốc trên cổng Chính phủ,
            hoặc tải thẳng tệp PDF ký số.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input value={timDm} onChange={(e) => setTimDm(e.target.value)} placeholder="Tìm trong danh mục (gõ không dấu cũng được)…"
              className="min-w-[240px] flex-1 rounded-xl border-2 border-slate-200 px-3 py-2 text-[14px] outline-none focus:border-[#0A2540]" />
            <select value={locLoai} onChange={(e) => setLocLoai(e.target.value)} className="rounded-xl border-2 border-slate-200 px-2 py-2 text-[14px]">
              <option value="">Tất cả loại</option>
              {[...new Set(dm.map((x) => x.loai))].sort().map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          {(() => {
            const q = kd(timDm.trim());
            const ds = dm.filter((x) => (!locLoai || x.loai === locLoai) && (!q || kd(x.loai + ' ' + x.so + ' ' + x.ten).includes(q)));
            return (
              <>
                <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">{ds.length} văn bản</p>
                <div className="mt-1 max-h-[64vh] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                  {ds.map((x) => (
                    <div key={x.id} className="px-3 py-2">
                      <p className="text-[13px] font-semibold leading-snug text-[#0A2540]">
                        <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-bold text-slate-500">{x.loai}</span>
                        {x.so ? <span className="mr-1">{x.so}</span> : null}{x.ten}
                      </p>
                      <p className="mt-0.5 flex flex-wrap gap-2 text-[11.5px]">
                        <a href={x.link} target="_blank" rel="noreferrer" className="font-semibold text-sky-700 underline">Xem trên cổng Chính phủ</a>
                        {x.tep.map((u, i) => (
                          <a key={i} href={u} target="_blank" rel="noreferrer" className="font-semibold text-emerald-700 underline">📄 Tải bản gốc{x.tep.length > 1 ? ` (phần ${i + 1})` : ''}</a>
                        ))}
                      </p>
                    </div>
                  ))}
                  {ds.length === 0 && <p className="p-3 text-[13px] text-slate-400">Không có văn bản nào khớp.</p>}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {the === 'luat' && <>
      {/* Ô TÌM — gõ không dấu vẫn ra; gõ số thì nhảy thẳng tới điều đó */}
      <div className="sticky top-0 z-10 -mx-3 mt-3 bg-white/95 px-3 py-2 backdrop-blur sm:mx-0 sm:px-0">
        <div className="flex items-center gap-2 rounded-xl border-2 border-slate-200 px-3 py-2 focus-within:border-[#0A2540]">
          <span className="text-slate-400">🔍</span>
          <input value={tim} onChange={(e) => setTim(e.target.value)}
            placeholder="Gõ từ khoá (không dấu cũng được) hoặc số điều — ví dụ: thu hoi dat, 75, bảng giá đất"
            className="w-full bg-transparent text-[15px] outline-none" />
          {tim && <button onClick={() => setTim('')} className="text-slate-400 hover:text-slate-700">✕</button>}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CHU_DE.map((c) => (
            <button key={c.ten} onClick={() => { setTim(c.tim); setChiGhim(false); setChon(null); }}
              className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition ${kd(tim) === kd(c.tim) ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
              {c.icon} {c.ten}
            </button>
          ))}
          <button onClick={() => { setChiGhim((v) => !v); setChon(null); }}
            className={`rounded-full border px-2.5 py-1 text-[12px] font-bold transition ${chiGhim ? 'border-amber-500 bg-amber-500 text-white' : 'border-amber-300 bg-amber-50 text-amber-700'}`}>
            ⭐ Điều đã ghim ({ghim.length})
          </button>
        </div>
      </div>

      {dangTai && <p className="mt-6 text-slate-400">Đang tải toàn văn luật…</p>}
      {loi && <p className="mt-6 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{loi}</p>}

      {vb && (
        <div className="mt-3 grid gap-3 lg:grid-cols-[360px_1fr]">
          {/* ── CỘT TRÁI: cây chương → điều, hoặc kết quả tìm ── */}
          <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white">
            <p className="sticky top-0 z-10 border-b bg-slate-50/95 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 backdrop-blur">
              {tim || chiGhim ? `${ketQua.length} điều khớp` : `${vb.chuong.length} chương · ${vb.dieu.length} điều`}
            </p>
            {tim || chiGhim ? (
              ketQua.length === 0
                ? <p className="p-3 text-[13px] text-slate-400">Không tìm thấy điều nào. Thử từ khoá khác, hoặc gõ số điều.</p>
                : ketQua.map((d) => (
                  <button key={d.so} onClick={() => { setChon(d.so); oNoiDung.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                    className={`block w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50 ${chon === d.so ? 'bg-[#0A2540]/[0.05]' : ''}`}>
                    <span className="block text-[13px] font-bold text-[#0A2540]">{ghim.includes(d.so) ? '⭐ ' : ''}Điều {d.so}. {d.tieuDe}</span>
                    <span className="block text-[11px] text-slate-400">Chương {d.chuong}{d.muc ? ` · Mục ${d.muc}` : ''}</span>
                  </button>
                ))
            ) : (
              vb.chuong.map((c) => {
                const ds = vb.dieu.filter((d) => d.chuong === c.so);
                const mo = moChuong[c.so];
                return (
                  <div key={c.so} className="border-b border-slate-100">
                    <button onClick={() => setMoChuong((m) => ({ ...m, [c.so]: !m[c.so] }))}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-slate-50">
                      <span className="mt-0.5 text-slate-400">{mo ? '▾' : '▸'}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] font-bold text-[#0A2540]">Chương {c.so}</span>
                        <span className="block text-[11.5px] leading-snug text-slate-500">{c.ten}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-1.5 text-[10.5px] font-semibold text-slate-500">{ds.length}</span>
                    </button>
                    {mo && ds.map((d) => (
                      <button key={d.so} onClick={() => { setChon(d.so); oNoiDung.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                        className={`block w-full px-3 py-1.5 pl-8 text-left text-[12.5px] hover:bg-slate-50 ${chon === d.so ? 'bg-[#0A2540]/[0.05] font-semibold' : 'text-slate-600'}`}>
                        {ghim.includes(d.so) ? '⭐ ' : ''}Điều {d.so}. {d.tieuDe}
                      </button>
                    ))}
                  </div>
                );
              })
            )}
          </div>

          {/* ── CỘT PHẢI: nguyên văn điều đang chọn ── */}
          <div ref={oNoiDung} className="rounded-xl border border-slate-200 bg-white p-4">
            {!dieuDangXem ? (
              <div className="py-10 text-center text-slate-400">
                <p className="text-4xl">⚖️</p>
                <p className="mt-2 text-sm">Chọn một điều ở cột bên trái, hoặc gõ từ khoá để tìm.</p>
                <p className="mt-1 text-[12px]">Mẹo: gõ thẳng <b>số điều</b> (ví dụ <b>79</b>) là nhảy tới ngay.</p>
              </div>
            ) : (
              <article>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Chương {dieuDangXem.chuong} — {dieuDangXem.chuongTen}
                  {dieuDangXem.muc ? <> · Mục {dieuDangXem.muc} — {dieuDangXem.mucTen}</> : null}
                </p>
                <div className="mt-1 flex items-start gap-2">
                  <h2 className="min-w-0 flex-1 text-[17px] font-extrabold leading-snug text-[#0A2540]">
                    Điều {dieuDangXem.so}. {toVang(dieuDangXem.tieuDe)}
                  </h2>
                  <button onClick={() => doiGhim(dieuDangXem.so)} title="Ghim để học lại"
                    className={`shrink-0 rounded-lg border px-2 py-1 text-[12px] font-semibold ${ghim.includes(dieuDangXem.so) ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500'}`}>
                    {ghim.includes(dieuDangXem.so) ? '⭐ Đã ghim' : '☆ Ghim'}
                  </button>
                  <button onClick={() => chep(dieuDangXem)} title="Sao chép nguyên văn"
                    className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-[12px] font-semibold text-slate-500">⧉ Chép</button>
                </div>

                <div className="mt-3 space-y-2.5 text-[14px] leading-relaxed text-slate-800">
                  {dieuDangXem.khoan.map((k, i) => (
                    <div key={i}>
                      <p className="whitespace-pre-line">
                        {k.so ? <b className="text-[#0A2540]">{k.so}. </b> : null}{toVang(k.chu)}
                      </p>
                      {k.diem.length > 0 && (
                        <div className="mt-1 space-y-1 pl-4">
                          {k.diem.map((x, j) => (
                            <p key={j} className="whitespace-pre-line"><b className="text-slate-500">{x.ky}) </b>{toVang(x.chu)}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <p className="mt-4 border-t pt-2 text-[11px] leading-snug text-slate-400">
                  Nguyên văn {vb.ten} (số {vb.soHieu}) — {vb.nguon}. Chữ giữ nguyên, không rút gọn.
                </p>
              </article>
            )}
          </div>
        </div>
      )}
      </>}
    </div>
  );
}
