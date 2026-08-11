import { Router } from 'express';
import { query } from '../lib/db.ts';
import { adminRequired } from '../middleware/auth.ts';
import { PUBLIC_FLAGS, allFlags } from '../lib/flags.ts';

export const flagsRouter = Router();

flagsRouter.get('/', async (_req, res) => { res.json({ flags: await allFlags() }); });

flagsRouter.post('/', adminRequired, async (req, res) => {
  const { key, on } = req.body || {};
  if (!PUBLIC_FLAGS.includes(key)) return res.status(400).json({ error: 'Cờ không hợp lệ' });
  // BẮT LỖI: Express 4 KHÔNG tự bắt lỗi của hàm async → thiếu try/catch là request treo vĩnh viễn.
  try {
    if (on) {
      await query('INSERT INTO app_flags (key) VALUES ($1) ON CONFLICT (key) DO UPDATE SET created_at = now()', [key]);
      // Bật lại = bắt đầu đếm hạn mức tin/đẩy lại từ thời điểm này (trong tháng hiện tại)
      if (key === 'services_live')
        await query(`DELETE FROM listing_usage WHERE ym = to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM')`);
    } else {
      await query('DELETE FROM app_flags WHERE key=$1', [key]);
    }
    res.json({ ok: true, key, on: !!on });
  } catch (e: any) {
    console.error('[flags] bật/tắt cờ lỗi:', e?.message || e);
    res.status(500).json({ error: 'Không đổi được trạng thái tính năng. Vui lòng thử lại.' });
  }
});
