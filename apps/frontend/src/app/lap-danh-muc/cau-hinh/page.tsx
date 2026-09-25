'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// TRANG CẤU HÌNH QUẢN TRỊ cho công cụ Lập danh mục — CHỈ admin. Không đặt trên trang khách để tránh lộ khoá/giá.
import { useEffect, useState } from 'react';
import { useAuth, laAdmin } from '@/lib/auth';
import { apiBase } from '@/lib/api';
import { getToken } from '@/lib/token';
import { toast } from '@/lib/toast';

const NAVY = '#0B4045';
const authHead = () => ({ Authorization: `Bearer ${getToken() || ''}` });

export default function CauHinhPage() {
  const { user, loading } = useAuth();
  const [cfg, setCfg] = useState<any>(null);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [effort, setEffort] = useState('low');
  const [price, setPrice] = useState(568);
  const [servicePrice, setServicePrice] = useState(200);
  const [saving, setSaving] = useState(false);
  const isAdmin = laAdmin(user);

  async function load() {
    try {
      const res = await fetch(`${apiBase}/danh-muc/config`, { headers: authHead() });
      const j = await res.json();
      setCfg(j); setModel(j.model || ''); setEffort(j.effort || 'low');
      setPrice(j.pricePerPage ?? 568); setServicePrice(j.servicePricePerPage ?? 200);
    } catch { /* ignore */ }
  }
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  async function save(extra: any = {}) {
    setSaving(true);
    try {
      const body: any = { model, effort, pricePerPage: price, servicePricePerPage: servicePrice, ...extra };
      if (apiKey.trim()) body.apiKey = apiKey.trim();
      const res = await fetch(`${apiBase}/danh-muc/config`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHead() }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Lưu thất bại');
      setApiKey(''); await load(); toast.success('Đã lưu cấu hình');
    } catch (e: any) { toast.error(e?.message || 'Lưu thất bại'); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="p-10 text-center text-slate-400">Đang tải…</div>;
  if (!isAdmin) return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="text-5xl">🔒</div>
      <h1 className="mt-3 text-xl font-bold" style={{ color: NAVY }}>Không có quyền truy cập</h1>
      <p className="mt-2 text-sm text-slate-500">Trang cấu hình chỉ dành cho quản trị viên.</p>
      <a href="/lap-danh-muc" className="mt-4 inline-block rounded-lg px-4 py-2 text-sm font-bold text-white" style={{ background: NAVY }}>Về công cụ</a>
    </div>
  );

  const inputCls = 'w-full rounded-md border px-3 py-2 text-sm';
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: NAVY }}>⚙️ Cấu hình — Lập danh mục hồ sơ</h1>
        <a href="/lap-danh-muc" className="text-sm font-semibold text-slate-400 hover:text-slate-600">← Về công cụ</a>
      </div>

      <div className="mt-4 rounded-xl border bg-white p-4 text-sm" style={{ borderColor: '#e6e0d4' }}>
        <div className="mb-3 text-slate-600">
          Khoá chung: {cfg?.hasKey ? <b>đã đặt ({cfg.keyHint})</b> : <b style={{ color: '#9b2d2d' }}>chưa đặt</b>}
          {' · '}Trạng thái: <b>{cfg?.enabled === false ? 'ĐANG TẮT' : 'đang bật'}</b>
        </div>

        <label className="mb-1 block font-semibold">Khoá API chung (dùng cho khách không có khoá riêng)</label>
        <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={cfg?.hasKey ? 'Để trống nếu giữ khoá hiện tại' : 'sk-ant-...'} className={inputCls} style={{ borderColor: '#d8cfbc' }} />

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block font-semibold">Model</label>
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="claude-sonnet-5" className={inputCls} style={{ borderColor: '#d8cfbc' }} />
          </div>
          <div>
            <label className="mb-1 block font-semibold">Mức xử lý (effort)</label>
            <select value={effort} onChange={(e) => setEffort(e.target.value)} className={inputCls} style={{ borderColor: '#d8cfbc', background: '#fff' }}>
              <option value="low">Low — nhanh, tiết kiệm</option>
              <option value="medium">Medium — cân bằng</option>
              <option value="high">High — kỹ hơn</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block font-semibold">Giá / trang — khoá chung (đồng)</label>
            <input type="number" value={price} min={0} step={1} onChange={(e) => setPrice(Number(e.target.value))} className={inputCls} style={{ borderColor: '#d8cfbc' }} />
          </div>
          <div>
            <label className="mb-1 block font-semibold">Phí dịch vụ / trang — khoá riêng (đồng)</label>
            <input type="number" value={servicePrice} min={0} step={1} onChange={(e) => setServicePrice(Number(e.target.value))} className={inputCls} style={{ borderColor: '#d8cfbc' }} />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2.5">
          <button onClick={() => save()} disabled={saving} className="rounded-md px-4 py-2 font-bold text-white" style={{ background: NAVY }}>{saving ? 'Đang lưu…' : 'Lưu cấu hình'}</button>
          <button onClick={() => save({ enabled: cfg?.enabled === false })} disabled={saving} className="rounded-md border px-4 py-2" style={{ borderColor: '#d8cfbc' }}>{cfg?.enabled === false ? 'Bật lại' : 'Tạm tắt'}</button>
          {cfg?.hasKey && <button onClick={() => save({ clearKey: true })} disabled={saving} className="rounded-md border px-4 py-2" style={{ borderColor: '#e0a3a3', color: '#9b2d2d' }}>Xoá khoá chung</button>}
        </div>
      </div>
    </div>
  );
}
