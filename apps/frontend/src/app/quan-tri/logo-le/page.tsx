'use client';
/* ============================================================================
 *  LỊCH ĐỔI LOGO THEO NGÀY LỄ — trang quản lý
 * ----------------------------------------------------------------------------
 *  Ngày thường web dùng logo gốc. Tới dịp lễ thì thanh menu tự đổi sang bản
 *  logo có trang trí (cành mai Tết, cờ Tổ quốc 2/9, mũ Noel…).
 *
 *  Trang này bày theo KHUNG LỊCH THÁNG cho dễ nhìn: ngày nào có logo lễ thì ô
 *  ngày đó hiện luôn cái logo ấy. Bấm vào ngày là thêm dịp mới bắt đầu từ ngày
 *  đó; bấm vào dòng trong danh sách bên dưới là sửa hoặc xoá.
 *
 *  BA KIỂU LẶP (ứng với ba loại ngày lễ ở Việt Nam):
 *    · Ngày dương, lặp hàng năm  — vd Quốc khánh 2/9
 *    · Ngày ÂM, lặp hàng năm     — vd mùng 1 Tết, Giỗ Tổ 10/3 âm, Trung thu 15/8 âm
 *      (máy chủ tự đổi sang ngày dương từng năm, không chép bảng nên đúng mãi)
 *    · Một khoảng ngày cụ thể    — dịp riêng của công ty, không lặp
 *
 *  "Hiện sớm / còn hiện" = trước và sau ngày chính mấy ngày. Trùng ngày thì dịp
 *  có ƯU TIÊN lớn hơn thắng.
 * ========================================================================== */
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth, laAdmin } from '@/lib/auth';
import LogoLe from '@/components/LogoLe';

type Dip = {
  id: number; ma: string; ten: string; kieu: 'duong' | 'am' | 'ngay';
  thang: number | null; ngay: number | null;
  tu: string | null; den: string | null;
  truoc: number; sau: number; uuTien: number; bat: boolean;
};
type ONgay = { ngay: string; ma: string | null; ten: string | null; id: number | null };
type BanLogo = { ma: string; ten: string };

const THU = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const KIEU: Record<string, string> = {
  duong: 'Ngày dương · lặp hàng năm',
  am: 'Ngày ÂM LỊCH · lặp hàng năm',
  ngay: 'Một khoảng ngày · không lặp',
};

const thangCua = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const homNay = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

const MOI: Omit<Dip, 'id'> = {
  ma: '', ten: '', kieu: 'duong', thang: 1, ngay: 1,
  tu: null, den: null, truoc: 0, sau: 0, uuTien: 10, bat: true,
};

export default function LichLogoLePage() {
  const { user, loading } = useAuth();
  const [thang, setThang] = useState(() => thangCua(new Date()));
  const [ngays, setNgays] = useState<ONgay[]>([]);
  const [dips, setDips] = useState<Dip[]>([]);
  const [banLogo, setBanLogo] = useState<BanLogo[]>([]);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState('');
  const [sua, setSua] = useState<(Omit<Dip, 'id'> & { id?: number }) | null>(null);
  const [dangLuu, setDangLuu] = useState(false);

  const tai = useCallback(async () => {
    setDangTai(true); setLoi('');
    try {
      const r = await api<{ ngays: ONgay[]; dips: Dip[]; banLogo: BanLogo[] }>(
        `/logo-le/lich?thang=${thang}`);
      setNgays(r.ngays); setDips(r.dips); setBanLogo(r.banLogo);
    } catch (e: any) { setLoi(e?.message || 'Không tải được lịch'); }
    setDangTai(false);
  }, [thang]);

  useEffect(() => { if (laAdmin(user)) tai(); }, [user, tai]);

  /* Lưới 7 cột: đệm mấy ô trống đầu tháng cho thứ 2 nằm đúng cột đầu. */
  const luoi = useMemo(() => {
    if (!ngays.length) return [] as (ONgay | null)[];
    const dau = new Date(ngays[0].ngay + 'T00:00:00');
    const chen = (dau.getDay() + 6) % 7;             // CN = 0 → đẩy về cuối tuần
    return [...Array(chen).fill(null), ...ngays];
  }, [ngays]);

  const doiThang = (b: number) => {
    const [y, m] = thang.split('-').map(Number);
    setThang(thangCua(new Date(y, m - 1 + b, 1)));
  };

  const luu = async () => {
    if (!sua) return;
    setDangLuu(true); setLoi('');
    try {
      if (sua.id) await api(`/logo-le/${sua.id}`, { method: 'PUT', body: JSON.stringify(sua) });
      else await api('/logo-le', { method: 'POST', body: JSON.stringify(sua) });
      setSua(null); await tai();
    } catch (e: any) { setLoi(e?.message || 'Lưu không được'); }
    setDangLuu(false);
  };

  const xoa = async (id: number) => {
    if (!window.confirm('Xoá dịp này khỏi lịch? Logo sẽ không còn tự đổi vào dịp đó nữa.')) return;
    setLoi('');
    try { await api(`/logo-le/${id}`, { method: 'DELETE' }); setSua(null); await tai(); }
    catch (e: any) { setLoi(e?.message || 'Xoá không được'); }
  };

  const bat = async (d: Dip) => {
    try { await api(`/logo-le/${d.id}`, { method: 'PUT', body: JSON.stringify({ ...d, bat: !d.bat }) }); await tai(); }
    catch (e: any) { setLoi(e?.message || 'Không đổi được'); }
  };

  if (loading) return <div className="mx-auto max-w-lg px-4 py-16 text-center text-slate-400">Đang tải…</div>;
  if (!laAdmin(user)) return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="mb-3 text-4xl">🔒</div>
      <p className="text-lg font-extrabold text-[#0A2540]">Chỉ quản trị viên</p>
      <div className="mt-4"><Link href="/quan-tri" className="font-semibold text-[#C8A14B]">← Về bảng quản trị</Link></div>
    </div>
  );

  const [ty, tm] = thang.split('-');

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-1 text-sm">
        <Link href="/quan-tri" className="font-semibold text-slate-400 hover:text-[#C8A14B]">← Quản trị</Link>
      </div>
      <h1 className="text-2xl font-extrabold text-[#0A2540]">🎏 Lịch đổi logo ngày lễ</h1>
      <p className="mt-1 text-sm text-slate-500">
        Ngày thường web dùng logo gốc. Tới những ngày dưới đây, logo trên thanh menu tự đổi
        sang bản có trang trí. Bấm vào một ngày để thêm dịp mới.
      </p>

      {loi && <div className="mt-4 rounded-md bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">{loi}</div>}

      {/* ── Khung lịch tháng ─────────────────────────────────────────────── */}
      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => doiThang(-1)} aria-label="Tháng trước"
            className="h-9 w-9 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50">‹</button>
          <div className="text-center">
            <div className="text-base font-extrabold text-[#0A2540]">Tháng {Number(tm)} · {ty}</div>
            <button onClick={() => setThang(thangCua(new Date()))}
              className="text-xs font-semibold text-[#C8A14B]">về tháng này</button>
          </div>
          <button onClick={() => doiThang(1)} aria-label="Tháng sau"
            className="h-9 w-9 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50">›</button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400">
          {THU.map((t) => <div key={t} className="py-1">{t}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {dangTai && <div className="col-span-7 py-10 text-center text-sm text-slate-400">Đang tải…</div>}
          {!dangTai && luoi.map((o, i) => {
            if (!o) return <div key={'x' + i} />;
            const d = Number(o.ngay.slice(8));
            const nay = o.ngay === homNay();
            return (
              <button key={o.ngay} onClick={() => {
                const dip = o.id ? dips.find((x) => x.id === o.id) : null;
                setSua(dip ? { ...dip } : { ...MOI, kieu: 'ngay', tu: o.ngay, den: o.ngay });
              }}
                title={o.ten || 'Chưa có dịp nào — bấm để thêm'}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-md border text-sm
                  ${o.ma ? 'border-[#C8A14B]/60 bg-[#C8A14B]/10' : 'border-slate-100 hover:bg-slate-50'}
                  ${nay ? 'ring-2 ring-[#0A2540]' : ''}`}>
                <span className={`text-[11px] font-bold ${o.ma ? 'text-[#0A2540]' : 'text-slate-400'}`}>{d}</span>
                {/* Hiện ĐÚNG hiệu ứng động sẽ chạy ngoài web, để xem trước
                    ngay trong lịch — khỏi phải chờ tới ngày mới biết nó ra sao. */}
                {o.ma && <span className="mt-0.5"><LogoLe ma={o.ma} light={false} cao={24} /></span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Danh sách dịp ────────────────────────────────────────────────── */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-extrabold text-[#0A2540]">Các dịp đã đặt ({dips.length})</h2>
        <button onClick={() => setSua({ ...MOI })}
          className="rounded-md bg-[#0A2540] px-4 py-2 text-sm font-bold text-white hover:bg-[#0d3057]">+ Thêm dịp</button>
      </div>
      <div className="mt-3 space-y-2">
        {dips.map((d) => (
          <div key={d.id} className={`flex items-center gap-3 rounded-lg border p-3 ${d.bat ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
            <LogoLe ma={d.ma} light={false} cao={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold text-[#0A2540]">{d.ten}</div>
              <div className="truncate text-xs text-slate-500">
                {d.kieu === 'ngay'
                  ? `${d.tu}${d.den && d.den !== d.tu ? ' → ' + d.den : ''}`
                  : `${d.ngay}/${d.thang} ${d.kieu === 'am' ? 'âm lịch' : 'dương lịch'} · hàng năm`}
                {(d.truoc || d.sau) ? ` · sớm ${d.truoc} ngày, còn ${d.sau} ngày` : ''}
                {` · ưu tiên ${d.uuTien}`}
              </div>
            </div>
            <button onClick={() => bat(d)}
              className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-bold ${d.bat ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
              {d.bat ? 'Đang bật' : 'Đang tắt'}
            </button>
            <button onClick={() => setSua({ ...d })}
              className="shrink-0 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50">Sửa</button>
          </div>
        ))}
        {!dips.length && !dangTai && (
          <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
            Chưa có dịp nào. Bấm “+ Thêm dịp”.
          </div>
        )}
      </div>

      {/* ── Bảng thêm / sửa ──────────────────────────────────────────────── */}
      {sua && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSua(null); }}>
          <div className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white p-5 sm:rounded-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-extrabold text-[#0A2540]">{sua.id ? 'Sửa dịp' : 'Thêm dịp'}</h3>
              <button onClick={() => setSua(null)} className="h-8 w-8 rounded-md text-slate-400 hover:bg-slate-100">✕</button>
            </div>

            <label className="mb-1 block text-xs font-bold text-slate-500">Tên dịp</label>
            <input value={sua.ten} onChange={(e) => setSua({ ...sua, ten: e.target.value })}
              placeholder="Vd: Quốc khánh 2/9"
              className="mb-4 w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm" />

            <label className="mb-1 block text-xs font-bold text-slate-500">Dùng bản logo nào</label>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {banLogo.map((b) => (
                <button key={b.ma} onClick={() => setSua({ ...sua, ma: b.ma, ten: sua.ten || b.ten.split('—')[0].trim() })}
                  className={`flex items-center gap-2 rounded-md border p-2 text-left text-xs
                    ${sua.ma === b.ma ? 'border-[#C8A14B] bg-[#C8A14B]/10 font-bold' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <LogoLe ma={b.ma} light={false} cao={28} />
                  <span className="min-w-0 flex-1 leading-tight text-slate-600">{b.ten}</span>
                </button>
              ))}
            </div>

            <label className="mb-1 block text-xs font-bold text-slate-500">Cách tính ngày</label>
            <div className="mb-4 space-y-1.5">
              {(['duong', 'am', 'ngay'] as const).map((k) => (
                <button key={k} onClick={() => setSua({ ...sua, kieu: k })}
                  className={`block w-full rounded-md border px-3 py-2 text-left text-sm
                    ${sua.kieu === k ? 'border-[#0A2540] bg-[#0A2540]/5 font-bold text-[#0A2540]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {KIEU[k]}
                </button>
              ))}
            </div>

            {sua.kieu === 'ngay' ? (
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">Từ ngày</label>
                  <input type="date" value={sua.tu || ''} onChange={(e) => setSua({ ...sua, tu: e.target.value })}
                    className="w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">Đến ngày</label>
                  <input type="date" value={sua.den || ''} onChange={(e) => setSua({ ...sua, den: e.target.value })}
                    className="w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm" />
                </div>
              </div>
            ) : (
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">
                    Ngày {sua.kieu === 'am' ? 'âm' : 'dương'}
                  </label>
                  <input type="number" min={1} max={31} value={sua.ngay ?? 1}
                    onChange={(e) => setSua({ ...sua, ngay: Number(e.target.value) })}
                    className="w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">
                    Tháng {sua.kieu === 'am' ? 'âm' : 'dương'}
                  </label>
                  <input type="number" min={1} max={12} value={sua.thang ?? 1}
                    onChange={(e) => setSua({ ...sua, thang: Number(e.target.value) })}
                    className="w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm" />
                </div>
              </div>
            )}

            <div className="mb-4 grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Hiện sớm (ngày)</label>
                <input type="number" min={0} max={60} value={sua.truoc}
                  onChange={(e) => setSua({ ...sua, truoc: Number(e.target.value) })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Còn hiện (ngày)</label>
                <input type="number" min={0} max={60} value={sua.sau}
                  onChange={(e) => setSua({ ...sua, sau: Number(e.target.value) })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-500">Ưu tiên</label>
                <input type="number" min={0} max={999} value={sua.uuTien}
                  onChange={(e) => setSua({ ...sua, uuTien: Number(e.target.value) })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm" />
              </div>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-slate-400">
              “Hiện sớm / còn hiện” là logo lễ xuất hiện trước và còn giữ sau ngày chính mấy ngày.
              Hai dịp trùng ngày thì dịp có <b>ưu tiên</b> lớn hơn được dùng.
            </p>

            <div className="flex items-center gap-2">
              <button onClick={luu} disabled={dangLuu}
                className="flex-1 rounded-md bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
                {dangLuu ? 'Đang lưu…' : 'Lưu'}
              </button>
              {sua.id && (
                <button onClick={() => xoa(sua.id!)}
                  className="rounded-md border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50">Xoá</button>
              )}
              <button onClick={() => setSua(null)}
                className="rounded-md border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50">Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
