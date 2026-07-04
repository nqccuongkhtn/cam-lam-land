'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Listing } from '@/lib/types';
import ListingRow from '@/components/ListingRow';
import SiteFooter from '@/components/SiteFooter';

interface Agent { id: number; name: string | null; phone: string | null; avatar: string | null; role: string | null; createdAt: string; }
interface Data { agent: Agent; active: Listing[]; expired: Listing[]; }

function joinedLabel(iso: string) {
  const d = new Date(iso);
  if (isNaN(+d)) return '';
  return `Tham gia ${d.getMonth() + 1}/${d.getFullYear()}`;
}

export default function AgentProfilePage() {
  const params = useParams();
  const id = String(params?.id || '');
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!id) return;
    setData(null); setErr('');
    api<Data>(`/listings/agent/${id}`).then(setData).catch((e) => setErr(e?.message || 'Không tải được'));
  }, [id]);

  if (err) return (
    <div className="max-w-3xl mx-auto px-4 py-24 text-center">
      <p className="text-slate-500">Không tìm thấy trang cá nhân này.</p>
      <Link href="/listings" className="text-red-600 font-semibold mt-3 inline-block">← Về danh sách nhà đất</Link>
    </div>
  );
  if (!data) return <div className="max-w-3xl mx-auto px-4 py-24 text-center text-slate-400">Đang tải…</div>;

  const { agent, active, expired } = data;
  const initial = (agent.name || 'C').charAt(0).toUpperCase();
  const total = active.length + expired.length;

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#0A2540] to-[#081B30] text-white">
        <div className="max-w-5xl mx-auto px-4 py-8 sm:py-10 flex items-center gap-4 sm:gap-5">
          {agent.avatar
            ? <img src={agent.avatar} alt="" className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-4 ring-[#C8A14B]/40" />
            : <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white/10 text-[#C8A14B] grid place-items-center text-3xl font-extrabold ring-4 ring-[#C8A14B]/40">{initial}</div>}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold truncate">{agent.name || 'Người đăng tin'}</h1>
              {agent.role === 'admin' && <span className="bg-[#C8A14B] text-[#0A2540] text-[11px] font-bold px-2 py-0.5 rounded-full">Chính chủ sàn</span>}
            </div>
            <p className="text-white/60 text-sm mt-1">Người đăng tin · Cam Lâm Land{agent.createdAt ? ' · ' + joinedLabel(agent.createdAt) : ''}</p>
            <p className="text-[#C8A14B] font-semibold text-sm mt-1">{active.length} tin đang bán · {total} tin tổng cộng</p>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="max-w-5xl mx-auto px-4 -mt-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-2.5">
          <a href="https://zalo.me/0988888888" target="_blank" rel="noreferrer" className="flex-1 min-w-[140px] flex items-center justify-center gap-2 bg-[#0068FF] hover:bg-[#0058d6] text-white font-bold py-2.5 rounded-xl">💬 Chat qua Zalo</a>
          {agent.phone
            ? <a href={`tel:${agent.phone.replace(/\s/g, '')}`} className="flex-1 min-w-[140px] flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold py-2.5 rounded-xl">📞 Gọi ngay</a>
            : <Link href="/login" className="flex-1 min-w-[140px] flex items-center justify-center gap-2 bg-[#0A2540] text-white font-bold py-2.5 rounded-xl">🔒 Đăng nhập để xem số</Link>}
        </div>
      </div>

      {/* Active listings */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <h2 className="text-lg font-extrabold text-[#0A2540] mb-3">Tin đang hiển thị ({active.length})</h2>
        {active.length
          ? <div className="space-y-3">{active.map((l) => <ListingRow key={l.id} l={l} />)}</div>
          : <p className="text-slate-400 text-sm bg-white rounded-xl border border-slate-200 p-6 text-center">Hiện chưa có tin đang bán.</p>}

        {/* Expired / hidden — ở cuối trang */}
        {expired.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-extrabold text-slate-500">Tin đã hết hạn / đã ẩn ({expired.length})</h2>
            <p className="text-xs text-slate-400 mt-1 mb-3">Những tin dưới đây đã hết hạn hiển thị hoặc được ẩn khỏi danh sách chung — vẫn lưu tại trang cá nhân để tham khảo.</p>
            <div className="space-y-3">
              {expired.map((l) => (
                <div key={l.id} className="relative opacity-60 hover:opacity-90 transition">
                  <span className="absolute top-2 right-2 z-10 bg-slate-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">⛔ Hết hạn</span>
                  <ListingRow l={l} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
