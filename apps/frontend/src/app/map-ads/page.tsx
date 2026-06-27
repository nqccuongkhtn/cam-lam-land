'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, uploadImages } from '@/lib/api';
import { resizeImage } from '@/lib/img';
import { useAuth } from '@/lib/auth';
import { WARDS } from '@/lib/types';
import ImageCropper from '@/components/ImageCropper';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });
const QH_BOUNDS: [[number, number], [number, number]] = [[108.9401268, 11.9257021], [109.2563886, 12.217594]];
const MONTHS = [1, 3, 6, 12];

interface Ad {
  id: number; advertiserName: string; advertiserPhone: string; imageUrl: string | null;
  wards: string[]; points: any[]; package: string; status: string; expiresAt: string; active: boolean;
}

export default function MapAdsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [wards, setWards] = useState<string[]>([]);
  const [months, setMonths] = useState(6);
  const [points, setPoints] = useState<{ lng: number; lat: number }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [list, setList] = useState<Ad[]>([]);
  const [cropFile, setCropFile] = useState<File | null>(null);

  useEffect(() => { if (!loading && (!user || user.role !== 'admin')) router.replace('/'); }, [loading, user, router]);
  function reload() { api<{ ads: Ad[] }>('/map-ads').then((r) => setList(r.ads || [])).catch(() => {}); }
  useEffect(() => { if (user?.role === 'admin') reload(); }, [user]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''; if (f) setCropFile(f);
  }
  async function onCropDone(blob: Blob) {
    setCropFile(null); setUploading(true); setErr('');
    try { const file = new File([blob], 'ad.jpg', { type: 'image/jpeg' }); const up = await uploadImages([file]); setImageUrl(up[0].url); }
    catch (e: any) { setErr('Lỗi tải ảnh: ' + e.message); } finally { setUploading(false); }
  }
  function toggleWard(w: string) { setWards((s) => (s.includes(w) ? s.filter((x) => x !== w) : [...s, w])); }

  async function submit() {
    setErr(''); setOk('');
    if (!name.trim() || !phone.trim()) return setErr('Nhập tên và SĐT người quảng cáo.');
    if (!wards.length) return setErr('Chọn ít nhất 1 xã.');
    if (!points.length) return setErr('Bấm vào bản đồ để ghim ít nhất 1 điểm hiển thị.');
    setBusy(true);
    try {
      await api('/map-ads', { method: 'POST', body: JSON.stringify({ advertiserName: name, advertiserPhone: phone, imageUrl, wards, months, points }) });
      setOk('Đã tạo quảng cáo — logo sẽ xuất hiện trên bản đồ.');
      setName(''); setPhone(''); setImageUrl(null); setWards([]); setPoints([]); setMonths(6);
      reload();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  async function del(id: number) {
    if (!confirm('Xoá quảng cáo này?')) return;
    try { await api(`/map-ads/${id}`, { method: 'DELETE' }); reload(); } catch (e: any) { alert(e.message); }
  }

  if (loading || !user || user.role !== 'admin') return <div className="py-24 text-center text-slate-500">Đang tải…</div>;

  const taken = new Set(list.filter((a) => a.active).flatMap((a) => a.wards || []));
  const preview = points.map((p, i) => ({ id: i, lng: p.lng, lat: p.lat, name: name || 'Tên sales', phone: phone || '09xx', image: imageUrl }));
  const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm';
  const lbl = 'text-sm font-semibold text-slate-700';

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-56px)] py-8">
      <div className="mx-auto max-w-5xl px-4 space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-[#0A2540]">Quảng cáo trên bản đồ</h1>
          <Link href="/admin" className="text-sm font-semibold text-slate-500 hover:text-[#0A2540]">← Quản trị</Link>
        </div>
        <p className="text-sm text-slate-500">Quảng cáo <b>độc quyền theo xã</b>: mỗi xã chỉ 1 người trong thời hạn gói, không bán đại trà. Logo hiển thị thưa tại các điểm bạn ghim trên bản đồ.</p>

        <div className="grid lg:grid-cols-2 gap-5">
          <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h2 className="font-bold text-[#0A2540]">Tạo quảng cáo</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className={lbl}>Tên sales *</label><input className={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Quốc Cường" /></div>
              <div><label className={lbl}>SĐT *</label><input className={inp} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0988…" /></div>
            </div>
            <div>
              <label className={lbl}>Ảnh / avatar nhận diện</label>
              <div className="flex items-center gap-4 mt-2">
                <svg width="118" height="118" viewBox="0 0 100 100" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.3))' }}><defs><clipPath id="cpv"><circle cx="50" cy="50" r="28" /></clipPath><path id="tpv" d="M 11 50 A 39 39 0 0 1 89 50" /><path id="bpv" d="M 4 50 A 46 46 0 0 0 96 50" /></defs><circle cx="50" cy="50" r="49" fill="#0A2540" /><circle cx="50" cy="50" r="47.5" fill="none" stroke="#C8A14B" strokeWidth="1" />{imageUrl ? <image href={imageUrl} x="18" y="18" width="64" height="64" clipPath="url(#cpv)" preserveAspectRatio="xMidYMid slice" /> : <text x="50" y="51" textAnchor="middle" dominantBaseline="middle" fontSize="26" fontWeight="800" fill="#C8A14B">{(name || 'C').charAt(0).toUpperCase()}</text>}<circle cx="50" cy="50" r="29" fill="none" stroke="#C8A14B" strokeWidth="1.4" /><text fontSize="11" fontWeight="800" fill="#fff"><textPath href="#tpv" startOffset="50%" textAnchor="middle" textLength="96" lengthAdjust="spacingAndGlyphs">{(name || 'Tên sales').slice(0, 26)}</textPath></text><text fontSize="11" fontWeight="800" fill="#fff"><textPath href="#bpv" startOffset="50%" textAnchor="middle" textLength="96" lengthAdjust="spacingAndGlyphs">{phone || 'SĐT'}</textPath></text><text x="7.5" y="50" textAnchor="middle" dominantBaseline="central" fontSize="8" fill="#C8A14B">★</text><text x="92.5" y="50" textAnchor="middle" dominantBaseline="central" fontSize="8" fill="#C8A14B">★</text></svg>
                <label className="bg-white border border-slate-300 px-3 py-2 rounded-lg text-sm cursor-pointer hover:bg-slate-50">{uploading ? 'Đang tải…' : '🖼️ Tải ảnh'}<input type="file" accept="image/*" onChange={onFile} className="hidden" /></label>
                {imageUrl && <button onClick={() => setImageUrl(null)} className="text-xs text-red-600">Xoá ảnh</button>}
              </div>
            </div>
            <div>
              <label className={lbl}>Xã đăng ký (độc quyền) *</label>
              <div className="grid grid-cols-2 gap-1.5 mt-1 max-h-44 overflow-y-auto scroll-soft border border-slate-200 rounded-lg p-2">
                {WARDS.map((w) => {
                  const locked = taken.has(w) && !wards.includes(w);
                  return (
                    <label key={w} className={`flex items-center gap-1.5 text-sm ${locked ? 'text-slate-300 cursor-not-allowed' : 'cursor-pointer'}`}>
                      <input type="checkbox" disabled={locked} checked={wards.includes(w)} onChange={() => toggleWard(w)} className="accent-[#0A2540]" />
                      <span>{w}{locked && <span className="text-[10px] text-red-400 ml-0.5">(đã thuê)</span>}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div>
              <label className={lbl}>Gói thời hạn</label>
              <select className={inp} value={months} onChange={(e) => setMonths(Number(e.target.value))}>{MONTHS.map((m) => <option key={m} value={m}>{m} tháng</option>)}</select>
            </div>
            {err && <p className="text-sm text-red-600 font-semibold">{err}</p>}
            {ok && <p className="text-sm text-emerald-700 font-semibold">{ok}</p>}
            <button disabled={busy || uploading} onClick={submit} className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-red-600/30">{busy ? 'Đang lưu…' : 'Tạo quảng cáo'}</button>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <h2 className="font-bold text-[#0A2540]">Ghim điểm hiển thị <span className="font-normal text-slate-400 text-sm">(bấm vào bản đồ)</span></h2>
            <div className="relative h-80 rounded-xl overflow-hidden border border-slate-200">
              <MapView baseMap="satellite" initialBounds={QH_BOUNDS} adMarkers={preview} onMapClick={(lng, lat) => setPoints((p) => [...p, { lng, lat }])} className="absolute inset-0 h-full w-full" />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500"><b className="text-[#0A2540]">{points.length}</b> điểm đã ghim · xem trước logo ngay trên bản đồ</span>
              {points.length > 0 && <button onClick={() => setPoints([])} className="text-red-600 font-semibold">Xoá hết điểm</button>}
            </div>
          </section>
        </div>

        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-bold text-[#0A2540] mb-3">Quảng cáo đang có ({list.length})</h2>
          {list.length === 0 ? <p className="text-sm text-slate-400">Chưa có quảng cáo nào.</p> : (
            <div className="space-y-2">
              {list.map((a) => (
                <div key={a.id} className="flex items-center gap-3 border border-slate-100 rounded-xl p-3">
                  <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-[#C8A14B]/40 shrink-0 bg-[#0A2540] grid place-items-center text-[#C8A14B] font-bold">{a.imageUrl ? <img src={a.imageUrl} alt="" className="w-full h-full object-cover" /> : (a.advertiserName || 'C').charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#0A2540] text-sm truncate">{a.advertiserName} · <span className="text-red-600">{a.advertiserPhone}</span></p>
                    <p className="text-xs text-slate-500 truncate">{(a.wards || []).join(', ')}</p>
                    <p className="text-[11px] text-slate-400">{(a.points || []).length} điểm · {a.package} · {a.active ? <span className="text-emerald-600 font-semibold">Đang chạy</span> : <span>Hết hạn</span>} · đến {new Date(a.expiresAt).toLocaleDateString('vi-VN')}</p>
                  </div>
                  <button onClick={() => del(a.id)} className="text-slate-400 hover:text-red-600 text-sm shrink-0">🗑 Xoá</button>
                </div>
              ))}
            </div>
          )}
        </section>

        {cropFile && <ImageCropper file={cropFile} title="Cân chỉnh ảnh quảng cáo" onCancel={() => setCropFile(null)} onDone={onCropDone} />}
      </div>
    </div>
  );
}
