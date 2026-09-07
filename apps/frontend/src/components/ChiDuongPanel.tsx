'use client';
// BẢNG CHỈ ĐƯỜNG — hiện nhiều phương án đi, người dùng bấm chọn 1 tuyến (giống Google Maps).
// Bảng này TỰ hỏi máy chủ và tự giữ danh sách tuyến; trang bản đồ chỉ việc nhận lại danh sách
// tuyến qua onTuyen() để vẽ lên bản đồ.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TuyenVe } from '@/components/MapView';
import { timDuong, docKhoangCach, docThoiGian, gioToiNoi, khungTuyen, viTriCuaToi, type PhuongTien, type Tuyen } from '@/lib/chiDuong';

export interface Diem { lng: number; lat: number; ten?: string }

interface Props {
  diemDi: Diem | null;                       // null = chưa có, bảng sẽ tự xin vị trí hiện tại
  diemDen: Diem;
  onDoiDiemDi: (p: Diem | null) => void;
  onChonTrenBanDo: (vaiTro: 'di' | 'den') => void;  // bật chế độ "bấm lên bản đồ để chọn điểm"
  onDoiDiemDen: (p: Diem) => void;
  onTuyen: (t: TuyenVe[]) => void;           // trả danh sách tuyến cho bản đồ vẽ
  onFit: (b: [[number, number], [number, number]]) => void; // zoom khít tuyến đang chọn
  onDong: () => void;
  chonNgoai?: number | null;                 // người dùng bấm thẳng lên tuyến ở bản đồ → đồng bộ về đây
  tamBanDo?: { lng: number; lat: number } | null;  // chỗ đang xem — dùng làm điểm đi khi máy không cho lấy vị trí
}

const PHUONG_TIEN: { id: PhuongTien; icon: string; ten: string }[] = [
  { id: 'motorbike', icon: '🏍️', ten: 'Xe máy' },
  { id: 'car', icon: '🚗', ten: 'Ô tô' },
  { id: 'bike', icon: '🚲', ten: 'Xe đạp' },
  { id: 'foot', icon: '🚶', ten: 'Đi bộ' },
];

const toaDo = (p: Diem | null) => (p ? p.ten || `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` : '');

export default function ChiDuongPanel({ diemDi, diemDen, onDoiDiemDi, onChonTrenBanDo, onDoiDiemDen, onTuyen, onFit, onDong, chonNgoai, tamBanDo }: Props) {
  const [mode, setMode] = useState<PhuongTien>('motorbike');
  const [tuyen, setTuyen] = useState<Tuyen[]>([]);
  const [chon, setChon] = useState(0);
  const [dangTim, setDangTim] = useState(false);
  const [loi, setLoi] = useState('');
  const [xemChang, setXemChang] = useState(false);
  const [dangXinViTri, setDangXinViTri] = useState(false);
  const [nhacNho, setNhacNho] = useState('');   // lời nhắc nhẹ (không phải lỗi), vd đang tạm dùng tâm bản đồ
  const lanTim = useRef(0);

  // Chưa có điểm đi → tự xin vị trí hiện tại (như Google: mặc định đi từ chỗ mình đứng).
  // KHÔNG lấy được (máy tính bàn không có định vị, hoặc người dùng chưa cho phép) thì KHÔNG đứng im:
  // lấy luôn chỗ đang xem trên bản đồ làm điểm đi rồi tìm đường ngay, và nhắc một dòng để đổi nếu muốn.
  // Trước đây gặp cảnh này là bảng đứng yên, chẳng có tuyến nào để chọn — nhìn như hỏng.
  useEffect(() => {
    if (diemDi) return;
    setDangXinViTri(true);
    viTriCuaToi()
      .then((p) => { setNhacNho(''); onDoiDiemDi({ ...p, ten: 'Vị trí của tôi' }); })
      .catch((e) => {
        if (tamBanDo) {
          setNhacNho('Chưa bật định vị nên tạm lấy chỗ anh/chị đang xem làm điểm đi — bấm ô trên để chọn điểm khác.');
          onDoiDiemDi({ ...tamBanDo, ten: 'Chỗ đang xem trên bản đồ' });
        } else setLoi(e?.message || 'Không lấy được vị trí của bạn');
      })
      .finally(() => setDangXinViTri(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diemDi]);

  // Có đủ 2 đầu → đi hỏi đường.
  useEffect(() => {
    if (!diemDi || !diemDen) return;
    const lan = ++lanTim.current;
    setDangTim(true); setLoi(''); setXemChang(false);
    timDuong(diemDi, diemDen, mode)
      .then((r) => {
        if (lan !== lanTim.current) return;                  // đã có lần tìm mới hơn → bỏ kết quả cũ
        const ds = r.tuyen || [];
        setTuyen(ds); setChon(0);
        if (!ds.length) setLoi('Không tìm được đường tới nơi này');
        else onFit(khungTuyen(ds[0]));
      })
      .catch((e) => { if (lan === lanTim.current) { setTuyen([]); setLoi(e?.message || 'Máy tìm đường đang bận, thử lại sau'); } })
      .finally(() => { if (lan === lanTim.current) setDangTim(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diemDi?.lng, diemDi?.lat, diemDen?.lng, diemDen?.lat, mode]);

  // Bấm chọn tuyến ngay trên bản đồ → đồng bộ vào bảng.
  useEffect(() => { if (chonNgoai != null && chonNgoai !== chon && tuyen[chonNgoai]) setChon(chonNgoai); /* eslint-disable-next-line */ }, [chonNgoai]);

  // Mỗi lần danh sách tuyến / tuyến đang chọn đổi → báo cho bản đồ vẽ lại.
  useEffect(() => {
    onTuyen(tuyen.map((t, i) => ({ id: i, hinh: t.hinh, chon: i === chon, nhan: docThoiGian(t.thoiGian) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tuyen, chon]);

  // Đóng bảng thì xoá tuyến khỏi bản đồ.
  useEffect(() => () => onTuyen([]), []); // eslint-disable-line react-hooks/exhaustive-deps

  const doiChieu = useCallback(() => {
    if (!diemDi) return;
    const a = diemDi, b = diemDen;
    onDoiDiemDi({ ...b, ten: b.ten || 'Điểm đã chọn' });
    onDoiDiemDen({ ...a, ten: a.ten });
  }, [diemDi, diemDen, onDoiDiemDi, onDoiDiemDen]);

  const t = tuyen[chon];

  return (
    <div className="pointer-events-auto w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
      {/* ==== Điểm đi / điểm đến ==== */}
      <div className="flex items-start gap-2 border-b border-slate-100 p-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-2.5 py-2">
            <span className="text-base">🔵</span>
            <button onClick={() => onChonTrenBanDo('di')} className="flex-1 truncate text-left text-sm text-slate-700">
              {dangXinViTri ? 'Đang lấy vị trí của bạn…' : toaDo(diemDi) || 'Bấm để chọn điểm đi trên bản đồ'}
            </button>
            <button onClick={() => { setDangXinViTri(true); setNhacNho(''); viTriCuaToi().then((p) => onDoiDiemDi({ ...p, ten: 'Vị trí của tôi' })).catch((e) => setNhacNho(e?.message || 'Chưa bật định vị cho trang web này')).finally(() => setDangXinViTri(false)); }}
              title="Dùng vị trí hiện tại" className="shrink-0 rounded-md px-1.5 py-0.5 text-base hover:bg-slate-200">🎯</button>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-2.5 py-2">
            <span className="text-base">📍</span>
            <button onClick={() => onChonTrenBanDo('den')} className="flex-1 truncate text-left text-sm text-slate-700">{toaDo(diemDen) || 'Chọn điểm đến'}</button>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <button onClick={doiChieu} title="Đổi chiều đi ↔ đến" className="rounded-lg px-2 py-1.5 text-slate-500 hover:bg-slate-100">⇅</button>
          <button onClick={onDong} title="Đóng" className="rounded-lg px-2 py-1.5 text-slate-500 hover:bg-slate-100">✕</button>
        </div>
      </div>

      {nhacNho && <p className="border-b border-amber-100 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-700">{nhacNho}</p>}

      {/* ==== Chọn phương tiện ==== */}
      <div className="flex gap-1 border-b border-slate-100 px-2 py-1.5">
        {PHUONG_TIEN.map((p) => (
          <button key={p.id} onClick={() => setMode(p.id)}
            className={`flex flex-1 flex-col items-center rounded-lg py-1.5 text-[11px] font-semibold ${mode === p.id ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>
            <span className="text-lg leading-none">{p.icon}</span>
            <span className="mt-0.5">{p.ten}</span>
          </button>
        ))}
      </div>

      {/* ==== Danh sách phương án ==== */}
      <div className="max-h-[46vh] overflow-y-auto">
        {dangTim && <div className="p-4 text-center text-sm text-slate-500">Đang tìm đường…</div>}
        {!dangTim && loi && <div className="p-4 text-center text-sm text-rose-600">{loi}</div>}
        {!dangTim && !loi && tuyen.map((r, i) => (
          <button key={i} onClick={() => { setChon(i); onFit(khungTuyen(r)); }}
            className={`flex w-full items-center gap-3 border-b border-slate-50 px-3 py-2.5 text-left ${i === chon ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}>
            <span className={`h-9 w-1.5 shrink-0 rounded-full ${i === chon ? 'bg-blue-600' : 'bg-slate-300'}`} />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <b className={`text-base ${i === chon ? 'text-blue-700' : 'text-slate-800'}`}>{docThoiGian(r.thoiGian)}</b>
                <span className="text-sm text-slate-500">{docKhoangCach(r.khoangCach)}</span>
                {r.nhan === 'Nhanh nhất' && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">Nhanh nhất</span>}
                {r.nhan === 'Ngắn nhất' && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">Ngắn nhất</span>}
              </span>
              <span className="mt-0.5 block truncate text-xs text-slate-500">
                {r.tomTat ? `qua ${r.tomTat}` : 'Đường nội bộ'} · tới lúc {gioToiNoi(r.thoiGian)}
              </span>
            </span>
          </button>
        ))}
        {!dangTim && !loi && tuyen.length > 1 && (
          <p className="px-3 py-2 text-[11px] text-slate-400">Bấm thẳng lên tuyến màu xám trên bản đồ cũng đổi được phương án.</p>
        )}
        {/* Chỉ ra được 1 lối thì nói rõ, không thì người dùng tưởng web hỏng vì "không có gì để chọn". */}
        {!dangTim && !loi && tuyen.length === 1 && (
          <p className="px-3 py-2 text-[11px] text-slate-400">Chỗ này chỉ có một lối đi hợp lý — không có đường vòng nào khác đáng kể.</p>
        )}

        {/* ==== Chỉ dẫn từng chặng của tuyến đang chọn ==== */}
        {xemChang && t && (
          <ol className="border-t border-slate-100">
            {t.chang.map((c, i) => (
              <li key={i} className="flex gap-2 border-b border-slate-50 px-3 py-2 text-sm">
                <span className="w-5 shrink-0 text-center text-slate-400">{i + 1}</span>
                <span className="flex-1">
                  <span className="block text-slate-700">{c.loiDan}</span>
                  {c.khoangCach > 0 && <span className="text-xs text-slate-400">{docKhoangCach(c.khoangCach)}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* ==== Nút dưới cùng ==== */}
      {t && (
        <div className="flex gap-2 border-t border-slate-100 p-2">
          <button onClick={() => setXemChang((v) => !v)} className="flex-1 rounded-lg bg-slate-100 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200">
            {xemChang ? 'Ẩn chỉ dẫn' : 'Xem chỉ dẫn từng chặng'}
          </button>
          <a href={`https://www.google.com/maps/dir/?api=1&origin=${diemDi ? `${diemDi.lat},${diemDi.lng}` : ''}&destination=${diemDen.lat},${diemDen.lng}&travelmode=${mode === 'foot' ? 'walking' : mode === 'bike' ? 'bicycling' : 'driving'}`}
            target="_blank" rel="noreferrer" className="rounded-lg bg-blue-600 px-3 py-2 text-center text-sm font-bold text-white hover:bg-blue-700">
            Mở Google Maps
          </a>
        </div>
      )}
    </div>
  );
}
