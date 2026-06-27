import webpush from 'web-push';
import { query } from './db.ts';

const VAPID_PUBLIC = process.env.VAPID_PUBLIC || 'BIkYC2tS6lR-uFYXcW4UFzc2cm1xlIRuxVIjy6Uzjb3li-KDikae5bg2CL-r_gALIea6rKOTNBByRNGqGuAWB0A';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE || 'e-KR3CFbn_f0c4CoBYKXCr-N1qYl8kpRGodVgE4Kqv0';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@camlam.local';

let ready = false;
try { webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE); ready = true; }
catch (e) { console.error('VAPID init failed:', e); }

export const vapidPublicKey = VAPID_PUBLIC;

async function deliver(subs: any[], payload: any) {
  if (!subs.length) return;
  const data = JSON.stringify(payload);
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } } as any, data);
    } catch (e: any) {
      const code = e?.statusCode;
      if (code === 404 || code === 410) { try { await query('DELETE FROM push_subscriptions WHERE id=$1', [s.id]); } catch {} }
    }
  }));
}

// Gửi tới danh sách user nhất định (trừ người gửi)
export async function pushToUsers(userIds: number[], payload: any, exceptUserId?: number) {
  if (!ready) return;
  const ids = [...new Set(userIds.filter((id) => id && id !== exceptUserId))];
  if (!ids.length) return;
  const subs = await query('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ANY($1::int[])', [ids]);
  await deliver(subs, payload);
}

// Gửi tới mọi người đã đăng ký (trừ người gửi) — dùng cho nhóm cộng đồng
export async function pushAllExcept(exceptUserId: number, payload: any) {
  if (!ready) return;
  const subs = await query('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id <> $1', [exceptUserId || 0]);
  await deliver(subs, payload);
}
