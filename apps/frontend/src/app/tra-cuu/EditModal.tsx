'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// Modal Thêm/Sửa bản ghi danh sách nóng. Hỗ trợ 1 thửa NHIỀU CHỦ (đồng sở hữu) và 1 chủ NHIỀU THỬA (thêm/bớt dòng).
// Lưu: chủ nối bằng " + "; thửa & tờ nối bằng ", " (theo vị trí). Trường công văn đến theo NĐ 30/2020.
import { useState } from 'react';
import { api, uploadFile } from '@/lib/api';
import type { Added } from './parts';
import { SHORT } from './parts';
import { useLockBody } from '@/lib/useLockBody';

const Sec = ({ children }: any) => <div className="col-span-2 mt-1 border-t pt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">{children}</div>;
const Sub = ({ children }: any) => <div className="col-span-2 mt-1.5 flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-[12px] font-bold text-[#0A2540]">{children}</div>;
const fmtDate = (s: string) => { const d = String(s).replace(/\D/g, '').slice(0, 8); let o = d.slice(0, 2); if (d.length > 2) o += '/' + d.slice(2, 4); if (d.length > 4) o += '/' + d.slice(4, 8); return o; };
const splitM = (s: any) => String(s ?? '').split(/[,\n]/).map((x) => x.trim());

export function EditModal({ initial, onClose, canManage, loggedIn, srcList, newSources = [], onSaved }: any) {
  const isEdit = !!initial?.id;
  useLockBody(); // khoá cuộn nền khi mở form thêm/sửa
  const known: string[] = Array.from(new Set([...(srcList || []), ...(newSources || [])])).filter(Boolean) as string[];
  const [f, setF] = useState({ nguon: initial?.nguon || '', link: initial?.link || '', noiDung: initial?.noiDung || '', ghiChu: initial?.ghiChu || '', mucDo: initial?.mucDo || 'canh-bao', soDen: initial?.soDen || '', ngayDen: initial?.ngayDen || '', soKyHieu: initial?.soKyHieu || '', ngayVb: initial?.ngayVb || '', donViGui: initial?.donViGui || '', loaiVb: initial?.loaiVb || '', soVbGoc: initial?.soVbGoc || '' });
  // Mỗi chủ = 1 bộ thông tin cá nhân riêng; lưu ghép theo VỊ TRÍ bằng " + " (giống tên). Khi sửa: tách các cột ghép ra rồi zip lại.
  const [owners, setOwners] = useState<{ ten: string; giayTo: string; namSinh: string; diaChi: string }[]>(() => {
    const sp = (s: any) => String(s ?? '').split(/\s*\+\s*/);
    const nm = sp(initial?.ten), gt = sp(initial?.soGiayTo), ns = sp(initial?.namSinh), dc = sp(initial?.diaChi);
    const n = Math.max(nm.filter((x: string) => x.trim()).length, 1);
    return Array.from({ length: n }, (_, i) => ({ ten: (nm[i] || '').trim(), giayTo: (gt[i] || '').trim(), namSinh: (ns[i] || '').trim(), diaChi: (dc[i] || '').trim() }));
  });
  // Mỗi thửa có XÃ riêng (có thể khác nhau). Xã ghép theo thứ tự bằng ", "; bản ghi cũ 1 xã -> áp cho mọi thửa.
  const [parcels, setParcels] = useState<{ thua: string; to: string; xa: string }[]>(() => {
    const th = splitM(initial?.soThua), to = splitM(initial?.soTo);
    const xa = String(initial?.xa ?? '').split(/\s*,\s*/);
    const n = Math.max(th.filter(Boolean).length, to.filter(Boolean).length, 1);
    return Array.from({ length: n }, (_, i) => ({ thua: th[i] || '', to: to[i] || '', xa: (xa[i] ?? xa[xa.length - 1] ?? '').trim() }));
  });
  // Giấy chứng nhận: 1 người có thể nhiều giấy; mỗi giấy = số phát hành / số vào sổ / ngày cấp riêng, ghép theo VỊ TRÍ bằng " + ".
  const [gcns, setGcns] = useState<{ ph: string; vs: string; nc: string }[]>(() => {
    const sp = (s: any) => String(s ?? '').split(/\s*\+\s*/);
    const ph = sp(initial?.soPhatHanh), vs = sp(initial?.soVaoSo), nc = sp(initial?.ngayCap);
    const n = Math.max(ph.length, vs.length, nc.length, 1);
    return Array.from({ length: n }, (_, i) => ({ ph: (ph[i] || '').trim(), vs: (vs[i] || '').trim(), nc: (nc[i] || '').trim() }));
  });
  const [creatingNew, setCreatingNew] = useState<boolean>(!!initial?.nguon && !known.includes(initial.nguon));
  const [saving, setSaving] = useState(false); const [e, setE] = useState(''); const [upLoading, setUpLoading] = useState(false);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const setOwner = (i: number, k: 'ten' | 'giayTo' | 'namSinh' | 'diaChi', v: string) => setOwners((a) => a.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const setParcel = (i: number, k: 'thua' | 'to' | 'xa', v: string) => setParcels((a) => a.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const setGcn = (i: number, k: 'ph' | 'vs' | 'nc', v: string) => setGcns((a) => a.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  // Đính kèm ảnh/PDF công văn (nếu không dán link): tải lên rồi lưu URL tệp vào chính trường link.
  const pickFile = async (file?: File) => {
    if (!file) return; setE(''); setUpLoading(true);
    try { const { url } = await uploadFile(file); set('link', url); }
    catch (er: any) { setE(er?.message || 'Tải tệp lỗi'); }
    finally { setUpLoading(false); }
  };
  const save = async () => {
    if (!loggedIn) { setE('Cần đăng nhập.'); return; } if (isEdit && !canManage) { setE('Chỉ admin/người quản lý mới được sửa.'); return; }
    if (!f.nguon.trim()) { setE(creatingNew ? 'Nhập tên sheet mới trước khi lưu.' : 'Chưa chọn nguồn (sheet). Hãy chọn 1 sheet hoặc tạo sheet mới — tránh lưu nhầm.'); return; }
    const act = owners.filter((o) => o.ten.trim()); // chủ tính theo họ tên; CCCD/năm sinh/địa chỉ ghép cùng thứ tự
    const ten = act.map((o) => o.ten.trim()).join(' + ');
    const soGiayTo = act.map((o) => o.giayTo.trim()).join(' + ');
    const namSinh = act.map((o) => o.namSinh.trim()).join(' + ');
    const diaChi = act.map((o) => o.diaChi.trim()).join(' + ');
    const valid = parcels.filter((p) => p.thua.trim() || p.to.trim());
    const soThua = valid.map((p) => p.thua.trim()).join(', '); const soTo = valid.map((p) => p.to.trim()).join(', ');
    const xa = valid.map((p) => p.xa.trim()).join(', ');
    const gact = gcns.filter((g) => g.ph.trim() || g.vs.trim() || g.nc.trim()); // nhiều giấy chứng nhận, ghép cùng thứ tự
    const soPhatHanh = gact.map((g) => g.ph.trim()).join(' + ');
    const soVaoSo = gact.map((g) => g.vs.trim()).join(' + ');
    const ngayCap = gact.map((g) => g.nc.trim()).join(' + ');
    setSaving(true); setE('');
    try { const r = await api<{ record: Added }>(isEdit ? `/hotlist/${initial.id}` : '/hotlist', { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify({ ...f, ten, soThua, soTo, xa, soGiayTo, namSinh, diaChi, soPhatHanh, soVaoSo, ngayCap }) }); onSaved(r.record); }
    catch (er: any) { setE(er?.message || 'Lỗi lưu'); setSaving(false); }
  };
  const inp = 'mt-0.5 w-full rounded border px-2 py-1.5';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 pb-24 sm:pb-4">
      <div className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header CỐ ĐỊNH — không cuộn theo form */}
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-100 px-5 pt-5 pb-3">
          <p className="text-lg font-bold text-[#0A2540]">{isEdit ? '✎ Sửa bản ghi danh sách nóng' : '➕ Thêm vào danh sách nóng'}</p>
          <button type="button" onClick={onClose} aria-label="Đóng" className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
        </div>
        {/* Thân form CUỘN */}
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
        {!loggedIn && <p className="mb-2 rounded bg-amber-50 p-2 text-sm text-amber-700">Cần <b>đăng nhập</b> để lưu.</p>}
        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <Sec>📄 Thông tin công văn đến</Sec>
          <label className="col-span-2">Đơn vị gửi (cơ quan ban hành)<input value={f.donViGui} onChange={(ev) => set('donViGui', ev.target.value)} className={inp} placeholder="VD: UBND xã Cam Đức…" /></label>
          <label>Số, ký hiệu<input value={f.soKyHieu} onChange={(ev) => set('soKyHieu', ev.target.value)} className={inp} placeholder="VD: 1234/QĐ-UBND" /></label>
          <label>Ngày văn bản<input value={f.ngayVb} onChange={(ev) => set('ngayVb', fmtDate(ev.target.value))} inputMode="numeric" maxLength={10} className={inp} placeholder="dd/mm/yyyy" /></label>
          <label>Số đến<input value={f.soDen} onChange={(ev) => set('soDen', ev.target.value)} className={inp} placeholder="VD: 256" /></label>
          <label>Ngày đến<input value={f.ngayDen} onChange={(ev) => set('ngayDen', fmtDate(ev.target.value))} inputMode="numeric" maxLength={10} className={inp} placeholder="dd/mm/yyyy" /></label>
          <label>Loại văn bản ngăn chặn<input value={f.loaiVb} onChange={(ev) => set('loaiVb', ev.target.value)} className={inp} placeholder="VD: Ngăn chặn chuyển nhượng, thế chấp…" /></label>
          <label>Số văn bản gốc<input value={f.soVbGoc} onChange={(ev) => set('soVbGoc', ev.target.value)} className={inp} placeholder="Số văn bản gốc (nếu có)" /></label>

          <Sec>📝 Trích yếu nội dung</Sec>
          <label className="col-span-2">Nội dung / lý do nóng<textarea value={f.noiDung} onChange={(ev) => set('noiDung', ev.target.value)} rows={2} className={inp} placeholder="VD: Ngăn chặn giao dịch theo QĐ số…" /></label>

          <Sec>🚫 Đối tượng bị ngăn chặn</Sec>

          <Sub>👤 Chủ sở hữu <span className="ml-auto text-[10px] font-normal normal-case text-slate-400">(mỗi chủ 1 thông tin riêng)</span></Sub>
          {owners.map((o, i) => (
            <div key={i} className="col-span-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2">
              <div className="mb-1 flex items-center justify-between"><span className="text-xs font-bold text-slate-500">Chủ {i + 1}{owners.length > 1 ? ' (đồng sở hữu)' : ''}</span>{owners.length > 1 && <button type="button" onClick={() => setOwners((a) => a.filter((_, k) => k !== i))} className="text-xs font-semibold text-red-500 hover:text-red-700">× Bỏ</button>}</div>
              <input value={o.ten} onChange={(ev) => setOwner(i, 'ten', ev.target.value)} className="w-full rounded border px-2 py-1.5" placeholder="Họ tên chủ" />
              <div className="mt-1 grid grid-cols-2 gap-1">
                <input value={o.giayTo} onChange={(ev) => setOwner(i, 'giayTo', ev.target.value)} inputMode="numeric" className="rounded border px-2 py-1.5" placeholder="Số CCCD/CMND" />
                <input value={o.namSinh} onChange={(ev) => setOwner(i, 'namSinh', ev.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" maxLength={4} className="rounded border px-2 py-1.5" placeholder="Năm sinh (1985)" />
              </div>
              <input value={o.diaChi} onChange={(ev) => setOwner(i, 'diaChi', ev.target.value)} className="mt-1 w-full rounded border px-2 py-1.5" placeholder="Địa chỉ thường trú" />
            </div>
          ))}
          <div className="col-span-2"><button type="button" onClick={() => setOwners((a) => [...a, { ten: '', giayTo: '', namSinh: '', diaChi: '' }])} className="text-xs font-semibold text-emerald-600">+ Thêm chủ (đồng sở hữu)</button></div>

          <Sub>🏠 Thửa đất &amp; tài sản <span className="ml-auto text-[10px] font-normal normal-case text-slate-400">(mỗi thửa có thể khác xã)</span></Sub>
          {parcels.map((p, i) => (
            <div key={i} className="col-span-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2">
              <div className="mb-1 flex items-center justify-between"><span className="text-xs font-bold text-slate-500">Thửa {i + 1}</span>{parcels.length > 1 && <button type="button" onClick={() => setParcels((a) => a.filter((_, k) => k !== i))} className="text-xs font-semibold text-red-500 hover:text-red-700">× Bỏ</button>}</div>
              <div className="flex gap-1">
                <input value={p.thua} onChange={(ev) => setParcel(i, 'thua', ev.target.value)} className="flex-1 rounded border px-2 py-1.5" placeholder="Số thửa" />
                <input value={p.to} onChange={(ev) => setParcel(i, 'to', ev.target.value)} className="w-24 rounded border px-2 py-1.5" placeholder="Số tờ" />
              </div>
              <input value={p.xa} onChange={(ev) => setParcel(i, 'xa', ev.target.value)} className="mt-1 w-full rounded border px-2 py-1.5" placeholder="Xã / phường (VD: Cam Đức)" />
            </div>
          ))}
          <div className="col-span-2"><button type="button" onClick={() => setParcels((a) => [...a, { thua: '', to: '', xa: a[a.length - 1]?.xa || '' }])} className="text-xs font-semibold text-emerald-600">+ Thêm thửa</button></div>

          <Sub>🏅 Giấy chứng nhận <span className="ml-auto text-[10px] font-normal normal-case text-slate-400">(có thể nhiều giấy)</span></Sub>
          {gcns.map((g, i) => (
            <div key={i} className="col-span-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2">
              <div className="mb-1 flex items-center justify-between"><span className="text-xs font-bold text-slate-500">Giấy {i + 1}</span>{gcns.length > 1 && <button type="button" onClick={() => setGcns((a) => a.filter((_, k) => k !== i))} className="text-xs font-semibold text-red-500 hover:text-red-700">× Bỏ</button>}</div>
              <div className="grid grid-cols-2 gap-1">
                <input value={g.ph} onChange={(ev) => setGcn(i, 'ph', ev.target.value)} className="rounded border px-2 py-1.5" placeholder="Số phát hành (CT 05…)" />
                <input value={g.vs} onChange={(ev) => setGcn(i, 'vs', ev.target.value)} className="rounded border px-2 py-1.5" placeholder="Số vào sổ (CS 12345)" />
              </div>
              <input value={g.nc} onChange={(ev) => setGcn(i, 'nc', fmtDate(ev.target.value))} inputMode="numeric" maxLength={10} className="mt-1 w-full rounded border px-2 py-1.5" placeholder="Ngày cấp: dd/mm/yyyy" />
            </div>
          ))}
          <div className="col-span-2"><button type="button" onClick={() => setGcns((a) => [...a, { ph: '', vs: '', nc: '' }])} className="text-xs font-semibold text-emerald-600">+ Thêm giấy chứng nhận</button></div>

          <Sec>🏷️ Phân loại &amp; liên kết</Sec>
          <div className="col-span-2">Mức độ
            <div className="mt-1 flex flex-wrap gap-1.5">
              {[['ngan-chan', '🔴 Ngăn chặn', 'border-red-500 bg-red-50 text-red-700'], ['canh-bao', '🟠 Cảnh báo', 'border-amber-500 bg-amber-50 text-amber-700'], ['thuong', '⚪ Thường', 'border-slate-400 bg-slate-100 text-slate-600']].map(([v, lb, on]) => (
                <button key={v} type="button" onClick={() => set('mucDo', v)} className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${f.mucDo === v ? on : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>{lb}</button>
              ))}
            </div>
          </div>
          <label className="col-span-2">Nguồn (sheet) <span className="text-[10px] font-bold text-red-500">* bắt buộc chọn</span>
            <select value={creatingNew ? '__new__' : f.nguon} onChange={(ev) => { const v = ev.target.value; if (v === '__new__') { setCreatingNew(true); set('nguon', ''); } else { setCreatingNew(false); set('nguon', v); } }} className={`${inp} ${!f.nguon.trim() ? 'border-red-300 text-slate-500' : ''}`}>
              <option value="" disabled>— Chọn nguồn (sheet) —</option>
              {known.map((s) => <option key={s} value={s}>{(newSources || []).includes(s) ? '🆕 ' : ''}{SHORT[s] || s}</option>)}
              <option value="__new__">➕ Tạo sheet mới…</option>
            </select>
          </label>
          {creatingNew && <label className="col-span-2">Tên sheet mới <span className="text-[10px] font-normal text-emerald-600">(sẽ hiện thành sheet riêng)</span><input autoFocus value={f.nguon} onChange={(ev) => set('nguon', ev.target.value)} className="mt-0.5 w-full rounded border border-emerald-300 px-2 py-1.5" placeholder="VD: Đơn thư khiếu nại 2026…" /></label>}
          {!f.nguon.trim() && !creatingNew && <p className="col-span-2 -mt-1 text-[11px] font-medium text-red-500">⚠ Hãy chọn 1 sheet hoặc tạo sheet mới — để trống sẽ không lưu được (tránh lưu nhầm).</p>}
          <div className="col-span-2">
            <label className="block">🔗 Link công văn liên quan<input value={f.link} onChange={(ev) => set('link', ev.target.value)} className={inp} placeholder="https://… (dán link) — hoặc tải tệp bên dưới" /></label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <input id="hot-file" type="file" accept="image/*,application/pdf,.pdf" className="hidden" onChange={(ev) => { pickFile(ev.target.files?.[0]); ev.target.value = ''; }} />
              <label htmlFor="hot-file" className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed px-3 py-1.5 text-xs font-semibold ${upLoading ? 'border-slate-200 text-slate-400' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>📎 {upLoading ? 'Đang tải tệp…' : 'Tải ảnh / PDF công văn'}</label>
              {/\/api\/images\//.test(f.link) && !upLoading && (
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">✓ Đã đính kèm tệp
                  <a href={f.link} target="_blank" rel="noreferrer" className="underline">Xem</a>
                  <button type="button" onClick={() => set('link', '')} className="font-semibold text-red-500 hover:text-red-700">Bỏ</button>
                </span>
              )}
            </div>
          </div>

          <div className="col-span-2 mt-1 rounded-lg bg-slate-50 p-2.5">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">🗒 Ghi chú nội bộ <span className="font-normal normal-case">(riêng của cán bộ — không thuộc nội dung công văn)</span></div>
            <textarea value={f.ghiChu} onChange={(ev) => set('ghiChu', ev.target.value)} rows={2} className="w-full rounded border px-2 py-1.5" placeholder="VD: Đã báo lãnh đạo, chờ xác minh thực địa…" />
          </div>
        </div>
        </div>
        {/* Footer CỐ ĐỊNH — Huỷ/Lưu luôn thấy, lỗi hiện ngay trên nút */}
        <div className="shrink-0 border-t border-slate-100 px-5 py-3">
          {e && <p className="mb-2 text-sm text-red-600">{e}</p>}
          <div className="flex justify-end gap-2"><button onClick={onClose} className="rounded border px-4 py-1.5 text-sm">Huỷ</button><button onClick={save} disabled={saving || !loggedIn} className="rounded bg-emerald-600 px-5 py-1.5 text-sm font-bold text-white disabled:opacity-40">{saving ? 'Đang lưu…' : 'Lưu'}</button></div>
        </div>
      </div>
    </div>
  );
}
