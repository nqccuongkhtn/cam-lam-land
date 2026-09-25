'use client';
import { useEffect, useRef, useState } from 'react';
import { chatFileBlob } from '@/lib/api';

/** Hiện ẢNH hoặc TỆP PDF đính kèm trong một tin nhắn.
 *  Vì sao phải tải bằng JS chứ không dùng thẳng <img src="/api/chat/file/12">:
 *  đường đó bắt buộc gửi kèm thẻ đăng nhập để kiểm tra người xem có thuộc phòng chat này không,
 *  mà thẻ <img> thì không gửi kèm được → máy chủ sẽ từ chối. Nên phải tải về rồi mới hiện. */

// Nhớ tệp đã tải trong phiên làm việc → đổi qua đổi lại giữa các khách không phải tải lại.
const kho = new Map<number, string>();
const KHO_TOI_DA = 40;
async function layBlob(id: number): Promise<string> {
  const co = kho.get(id);
  if (co) return co;
  const url = await chatFileBlob(id);
  kho.set(id, url);
  if (kho.size > KHO_TOI_DA) {
    const cu = kho.keys().next().value as number | undefined;
    if (cu !== undefined) { try { URL.revokeObjectURL(kho.get(cu)!); } catch {} kho.delete(cu); }
  }
  return url;
}

function coChu(n?: number | null): string {
  if (!n) return '';
  return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
}

export default function ChatDinhKem({ fileId, fileName, fileMime, fileSize, mine }: {
  fileId?: number | null; fileName?: string | null; fileMime?: string | null; fileSize?: number | null; mine?: boolean;
}) {
  const laAnh = String(fileMime || '').startsWith('image/');
  const [src, setSrc] = useState('');
  const [loi, setLoi] = useState('');
  const [dangTai, setDangTai] = useState(false);
  const [to, setTo] = useState(false); // đang xem phóng to
  const song = useRef(true);
  useEffect(() => () => { song.current = false; }, []);

  // Ảnh thì tải ngay (không tải thì không hiện được gì). PDF chờ người dùng bấm mới tải — file nặng.
  useEffect(() => {
    if (!laAnh || !fileId) return;
    let bo = false;
    layBlob(fileId).then((u) => { if (!bo) setSrc(u); }).catch(() => { if (!bo) setLoi('Không tải được ảnh'); });
    return () => { bo = true; };
  }, [laAnh, fileId]);

  useEffect(() => {
    if (!to) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setTo(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [to]);

  async function moTep(tai: boolean) {
    if (!fileId) return;
    setDangTai(true); setLoi('');
    try {
      const u = await layBlob(fileId);
      const a = document.createElement('a');
      a.href = u;
      if (tai) a.download = fileName || 'tai-lieu.pdf'; else { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      document.body.appendChild(a); a.click(); a.remove();
    } catch { setLoi('Không tải được tệp'); }
    finally { if (song.current) setDangTai(false); }
  }

  if (!fileId) return <p className="text-xs italic opacity-70">Tệp không còn</p>;

  if (laAnh) {
    return (
      <>
        {loi ? <p className="text-xs italic opacity-70">{loi}</p>
          : src ? (
            /* Bọc ảnh trong khung có bo góc + lớp phủ hiện tên tệp và nút tải khi rê chuột.
               Trước đây chỉ có mỗi tấm ảnh trơ, muốn tải về phải bấm phóng to rồi mới thấy nút. */
            <div className="group relative inline-block overflow-hidden rounded-xl">
              <img src={src} alt={fileName || 'Hình ảnh'} onClick={() => setTo(true)}
                className="block max-h-56 w-auto max-w-full cursor-zoom-in bg-white/10 transition duration-200 group-hover:brightness-[.88]" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/65 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
                <span className="min-w-0 truncate text-[11px] font-semibold text-white/90">{fileName || 'Hình ảnh'}</span>
                <button onClick={(e) => { e.stopPropagation(); moTep(true); }}
                  title="Tải ảnh về máy"
                  className="pointer-events-auto shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur hover:bg-white/35">⬇ Tải</button>
              </div>
            </div>
          ) : (
            <div className="w-40 h-28 rounded-xl bg-slate-200 animate-pulse grid place-items-center text-xs text-slate-500">Đang tải ảnh…</div>
          )}
        {to && src && (
          <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col" onClick={() => setTo(false)}>
            <div className="flex items-center justify-between px-4 py-3 text-white shrink-0">
              <span className="text-sm truncate">{fileName || 'Hình ảnh'}</span>
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={(e) => { e.stopPropagation(); moTep(true); }} className="text-xs font-bold bg-white/15 hover:bg-white/25 rounded-full px-3 py-1.5">Tải về</button>
                <button onClick={() => setTo(false)} aria-label="Đóng" className="text-2xl leading-none">✕</button>
              </div>
            </div>
            <div className="flex-1 min-h-0 grid place-items-center p-3">
              <img src={src} alt={fileName || ''} onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full object-contain" />
            </div>
            <p className="text-center text-white/40 text-[11px] pb-3 shrink-0">Bấm ra ngoài để đóng</p>
          </div>
        )}
      </>
    );
  }

  // PDF (và mọi tệp không phải ảnh)
  // Thẻ tài liệu: ô biểu tượng vuông bo góc + tên tệp + dung lượng, hai NÚT BẤM thật
  // (trước là hai chữ gạch chân bé xíu, trên điện thoại rất khó bấm trúng).
  return (
    <div className={`flex items-start gap-2.5 rounded-xl p-2.5 min-w-[200px] ${mine ? 'bg-white/10' : 'bg-white border border-slate-200 shadow-sm'}`}>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[11px] font-extrabold tracking-wide ${mine ? 'bg-white/15 text-white' : 'bg-red-50 text-red-600 border border-red-100'}`}>PDF</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold truncate leading-snug">{fileName || 'Tài liệu.pdf'}</p>
        <p className={`text-[11px] ${mine ? 'text-white/60' : 'text-slate-400'}`}>{coChu(fileSize) || 'PDF'}</p>
        <div className="flex gap-1.5 mt-1.5">
          <button onClick={() => moTep(false)} disabled={dangTai}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-50 ${mine ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-[#0B4045] hover:bg-[#0e5157] text-white'}`}>{dangTai ? 'Đang mở…' : 'Mở'}</button>
          <button onClick={() => moTep(true)} disabled={dangTai}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-50 ${mine ? 'bg-white/10 hover:bg-white/20 text-white/90' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>⬇ Tải về</button>
        </div>
        {loi && <p className="text-[11px] text-red-400 mt-0.5">{loi}</p>}
      </div>
    </div>
  );
}
