import { Router } from 'express';
import { query } from '../lib/db.ts';
import { authRequired, type AuthedRequest } from '../middleware/auth.ts';

export const crmRouter = Router();

const uid = (req: AuthedRequest) => req.user!.id;
// Giới hạn độ dài chuỗi trước khi lưu (chống dữ liệu quá khổ). null giữ nguyên null.
const clip = (v: any, n = 500) => (v === undefined || v === null ? null : String(v).slice(0, n));
async function owns(table: string, id: number, req: AuthedRequest): Promise<boolean> {
  const [r] = await query(`SELECT user_id FROM ${table} WHERE id=$1`, [id]);
  return !!r && (r.user_id === uid(req) || req.user!.role === 'admin');
}

// ===================== KHÁCH HÀNG =====================
const CUS = `id, name, phone, source, note, created_at AS "createdAt"`;

// GET /api/crm/customers — danh sách khách của tôi + số nhu cầu + số tin quan tâm
crmRouter.get('/customers', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const all = req.query.all === '1' && req.user!.role === 'admin';
    const rows = await query(
      `SELECT c.id, c.name, c.phone, c.source, c.note, c.created_at AS "createdAt",
              (SELECT count(*) FROM customer_needs n WHERE n.customer_id=c.id)::int AS "needCount",
              (SELECT count(*) FROM property_interests i WHERE i.customer_id=c.id)::int AS "interestCount",
              (SELECT CASE max(CASE i.deal_status WHEN 'Đã chốt' THEN 5 WHEN 'Thương lượng' THEN 4 WHEN 'Đang tư vấn' THEN 3 WHEN 'Không thành' THEN 1 ELSE 2 END)
                        WHEN 5 THEN 'Đã chốt' WHEN 4 THEN 'Thương lượng' WHEN 3 THEN 'Đang tư vấn' WHEN 1 THEN 'Không thành' ELSE 'Mới' END
                 FROM property_interests i WHERE i.customer_id=c.id) AS "dealStage"
              ${all ? `, COALESCE(NULLIF(u.full_name,''), split_part(u.email,'@',1)) AS "salesName"` : ''}
         FROM customers c ${all ? 'LEFT JOIN users u ON u.id=c.user_id' : ''}
        ${all ? '' : 'WHERE c.user_id=$1'} ORDER BY c.id DESC LIMIT 3000`, all ? [] : [uid(req)]);
    res.json({ customers: rows });
  } catch (e) { next(e); }
});

// POST /api/crm/customers — tạo khách
crmRouter.post('/customers', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const b = req.body ?? {};
    const [row] = await query(
      `INSERT INTO customers (user_id, name, phone, source, note) VALUES ($1,$2,$3,$4,$5) RETURNING ${CUS}`,
      [uid(req), clip(b.name, 120), clip(b.phone, 30), clip(b.source, 60), clip(b.note, 2000)]);
    res.status(201).json({ customer: row });
  } catch (e) { next(e); }
});

// GET /api/crm/customers/:id — 1 khách + nhu cầu + các tin đang quan tâm
crmRouter.get('/customers/:id', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!(await owns('customers', id, req))) return res.status(403).json({ error: 'Không có quyền' });
    const [customer] = await query(`SELECT ${CUS} FROM customers WHERE id=$1`, [id]);
    const needs = await query(
      `SELECT id, deal_type AS "dealType", prop_type AS "propType", budget, area_need AS "areaNeed", location, status, note, created_at AS "createdAt"
         FROM customer_needs WHERE customer_id=$1 ORDER BY id DESC`, [id]);
    const interests = await query(
      `SELECT i.id, i.interest, i.deal_status AS "dealStatus", i.note, i.place_id AS "placeId", i.created_at AS "createdAt",
              sp.features, sp.parcel_no AS parcel, sp.sheet_no AS sheet, sp.ward, sp.price, sp.area, sp.lng, sp.lat
         FROM property_interests i JOIN saved_places sp ON sp.id=i.place_id
        WHERE i.customer_id=$1 ORDER BY i.id DESC`, [id]);
    const activities = await query(`SELECT id, kind, note, created_at AS "createdAt" FROM crm_activities WHERE customer_id=$1 ORDER BY id DESC LIMIT 100`, [id]);
    const appointments = await query(
      `SELECT a.id, a.appoint_at AS "appointAt", a.location, a.note, a.status, a.sms_reminder AS "smsReminder", a.sms_sent_at AS "smsSentAt", a.place_id AS "placeId",
              sp.features, sp.parcel_no AS parcel, sp.sheet_no AS sheet
         FROM notary_appointments a LEFT JOIN saved_places sp ON sp.id=a.place_id
        WHERE a.customer_id=$1 ORDER BY a.appoint_at ASC`, [id]);
    res.json({ customer, needs, interests, activities, appointments });
  } catch (e) { next(e); }
});

// PATCH /api/crm/customers/:id
crmRouter.patch('/customers/:id', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id); const b = req.body ?? {};
    if (!(await owns('customers', id, req))) return res.status(403).json({ error: 'Không có quyền' });
    const [row] = await query(
      `UPDATE customers SET name=COALESCE($2,name), phone=COALESCE($3,phone), source=COALESCE($4,source), note=COALESCE($5,note) WHERE id=$1 RETURNING ${CUS}`,
      [id, b.name ?? null, b.phone ?? null, b.source ?? null, b.note ?? null]);
    res.json({ customer: row });
  } catch (e) { next(e); }
});

// DELETE /api/crm/customers/:id (xoá kèm nhu cầu + quan tâm nhờ ON DELETE CASCADE)
crmRouter.delete('/customers/:id', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!(await owns('customers', id, req))) return res.status(403).json({ error: 'Không có quyền' });
    await query('DELETE FROM customers WHERE id=$1', [id]);
    res.json({ deleted: id });
  } catch (e) { next(e); }
});

// ===================== LỊCH SỬ CHĂM SÓC =====================
crmRouter.post('/customers/:id/activities', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const cid = Number(req.params.id); const b = req.body ?? {};
    if (!(await owns('customers', cid, req))) return res.status(403).json({ error: 'Không có quyền' });
    const [row] = await query(`INSERT INTO crm_activities (customer_id, user_id, kind, note) VALUES ($1,$2,$3,$4) RETURNING id, kind, note, created_at AS "createdAt"`,
      [cid, uid(req), clip(b.kind, 40), clip(b.note, 2000)]);
    res.status(201).json({ activity: row });
  } catch (e) { next(e); }
});
crmRouter.delete('/activities/:id', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!(await owns('crm_activities', id, req))) return res.status(403).json({ error: 'Không có quyền' });
    await query('DELETE FROM crm_activities WHERE id=$1', [id]);
    res.json({ deleted: id });
  } catch (e) { next(e); }
});
// Sửa nội dung / loại 1 hoạt động
crmRouter.patch('/activities/:id', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id); const b = req.body ?? {};
    if (!(await owns('crm_activities', id, req))) return res.status(403).json({ error: 'Không có quyền' });
    const [row] = await query(`UPDATE crm_activities SET note=COALESCE($2,note), kind=COALESCE($3,kind) WHERE id=$1 RETURNING id, kind, note, created_at AS "createdAt"`, [id, b.note ?? null, b.kind ?? null]);
    res.json({ activity: row });
  } catch (e) { next(e); }
});
// Xoá TẤT CẢ hoạt động của 1 khách
crmRouter.delete('/customers/:id/activities', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const cid = Number(req.params.id);
    if (!(await owns('customers', cid, req))) return res.status(403).json({ error: 'Không có quyền' });
    await query('DELETE FROM crm_activities WHERE customer_id=$1', [cid]);
    res.json({ deleted: 'all' });
  } catch (e) { next(e); }
});

// ===================== NHU CẦU =====================
const NEED = `id, deal_type AS "dealType", prop_type AS "propType", budget, area_need AS "areaNeed", location, status, note, created_at AS "createdAt"`;

// POST /api/crm/customers/:id/needs — thêm nhu cầu cho 1 khách
crmRouter.post('/customers/:id/needs', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const cid = Number(req.params.id); const b = req.body ?? {};
    if (!(await owns('customers', cid, req))) return res.status(403).json({ error: 'Không có quyền' });
    const [row] = await query(
      `INSERT INTO customer_needs (customer_id, user_id, deal_type, prop_type, budget, area_need, location, status, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${NEED}`,
      [cid, uid(req), clip(b.dealType, 40), clip(b.propType, 40), clip(b.budget, 60), clip(b.areaNeed, 60), clip(b.location, 300), clip(b.status, 40), clip(b.note, 2000)]);
    res.status(201).json({ need: row });
  } catch (e) { next(e); }
});

crmRouter.patch('/needs/:id', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id); const b = req.body ?? {};
    if (!(await owns('customer_needs', id, req))) return res.status(403).json({ error: 'Không có quyền' });
    const [row] = await query(
      `UPDATE customer_needs SET deal_type=COALESCE($2,deal_type), prop_type=COALESCE($3,prop_type), budget=COALESCE($4,budget),
              area_need=COALESCE($5,area_need), location=COALESCE($6,location), status=COALESCE($7,status), note=COALESCE($8,note)
        WHERE id=$1 RETURNING ${NEED}`,
      [id, b.dealType ?? null, b.propType ?? null, b.budget ?? null, b.areaNeed ?? null, b.location ?? null, b.status ?? null, b.note ?? null]);
    res.json({ need: row });
  } catch (e) { next(e); }
});

crmRouter.delete('/needs/:id', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!(await owns('customer_needs', id, req))) return res.status(403).json({ error: 'Không có quyền' });
    await query('DELETE FROM customer_needs WHERE id=$1', [id]);
    res.json({ deleted: id });
  } catch (e) { next(e); }
});

// ===================== QUAN TÂM (tin ↔ khách) =====================
// GET /api/crm/interests?placeId=X — khách đang quan tâm 1 tin
crmRouter.get('/interests', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const placeId = Number(req.query.placeId);
    const rows = await query(
      `SELECT i.id, i.interest, i.deal_status AS "dealStatus", i.note, i.follow_up_at AS "followUpAt", i.created_at AS "createdAt",
              i.customer_id AS "customerId", c.name AS "custName", c.phone AS "custPhone"
         FROM property_interests i JOIN customers c ON c.id=i.customer_id
        WHERE i.place_id=$1 AND i.user_id=$2 ORDER BY i.id DESC`, [placeId, uid(req)]);
    res.json({ interests: rows });
  } catch (e) { next(e); }
});

// POST /api/crm/interests — gắn 1 khách vào 1 tin (chọn khách có sẵn HOẶC tạo mới)
crmRouter.post('/interests', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const b = req.body ?? {};
    if (!b.placeId) return res.status(400).json({ error: 'Thiếu tin (placeId)' });
    let customerId = b.customerId;
    if (!customerId) {
      if (!b.name && !b.phone) return res.status(400).json({ error: 'Cần chọn khách hoặc nhập tên/SĐT khách mới' });
      // GỘP THEO SĐT: nếu môi giới này đã có khách trùng SĐT thì gắn tin vào khách đó (KHÔNG tạo khách trùng).
      const phoneDigits = String(b.phone ?? '').replace(/\D/g, '');
      if (phoneDigits) {
        const [existing] = await query(
          `SELECT id FROM customers WHERE user_id=$1 AND regexp_replace(COALESCE(phone,''), '[^0-9]', '', 'g') = $2 ORDER BY id LIMIT 1`,
          [uid(req), phoneDigits]);
        if (existing) {
          customerId = existing.id;
          if (b.name) await query(`UPDATE customers SET name = COALESCE(NULLIF(name,''), $2) WHERE id=$1`, [customerId, b.name]); // bổ sung tên nếu khách cũ chưa có
        }
      }
      if (!customerId) {
        const [c] = await query(`INSERT INTO customers (user_id, name, phone) VALUES ($1,$2,$3) RETURNING id`, [uid(req), clip(b.name, 120), clip(b.phone, 30)]);
        customerId = c.id;
      }
    }
    const [row] = await query(
      `INSERT INTO property_interests (place_id, customer_id, user_id, interest, deal_status, note)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, interest, deal_status AS "dealStatus", note, place_id AS "placeId", customer_id AS "customerId", created_at AS "createdAt"`,
      [b.placeId, customerId, uid(req), clip(b.interest, 200), clip(b.dealStatus, 40), clip(b.note, 2000)]);
    const [cust] = await query(`SELECT name AS "custName", phone AS "custPhone" FROM customers WHERE id=$1`, [customerId]);
    res.status(201).json({ interest: { ...row, ...cust } });
  } catch (e) { next(e); }
});

crmRouter.patch('/interests/:id', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id); const b = req.body ?? {};
    if (!(await owns('property_interests', id, req))) return res.status(403).json({ error: 'Không có quyền' });
    const [row] = await query(
      `UPDATE property_interests SET interest=COALESCE($2,interest), deal_status=COALESCE($3,deal_status), note=COALESCE($4,note), follow_up_at=COALESCE($5,follow_up_at)
        WHERE id=$1 RETURNING id, interest, deal_status AS "dealStatus", note, follow_up_at AS "followUpAt", place_id AS "placeId", customer_id AS "customerId"`,
      [id, b.interest ?? null, b.dealStatus ?? null, b.note ?? null, b.followUpAt ?? null]);
    res.json({ interest: row });
  } catch (e) { next(e); }
});

crmRouter.delete('/interests/:id', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!(await owns('property_interests', id, req))) return res.status(403).json({ error: 'Không có quyền' });
    await query('DELETE FROM property_interests WHERE id=$1', [id]);
    res.json({ deleted: id });
  } catch (e) { next(e); }
});

// ===================== DASHBOARD / PIPELINE =====================
// GET /api/crm/stats — tổng hợp pipeline
crmRouter.get('/stats', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const all = req.query.all === '1' && req.user!.role === 'admin';
    const p = all ? [] : [uid(req)];
    const uw = all ? '' : 'WHERE user_id=$1';
    const ua = all ? 'WHERE' : 'WHERE user_id=$1 AND';
    const byStatus = await query(`SELECT COALESCE(NULLIF(deal_status,''),'(chưa đặt)') AS status, count(*)::int AS n FROM property_interests ${uw} GROUP BY 1`, p);
    const [tot] = await query(
      `SELECT (SELECT count(*) FROM customers ${uw})::int AS "customers",
              (SELECT count(*) FROM customer_needs ${uw})::int AS "needs",
              (SELECT count(*) FROM property_interests ${uw})::int AS "interests",
              (SELECT count(*) FROM property_interests ${ua} deal_status='Đã chốt')::int AS "closed",
              (SELECT count(*) FROM property_interests ${ua} follow_up_at IS NOT NULL AND follow_up_at <= now())::int AS "dueFollow"`, p);
    res.json({ byStatus, ...tot });
  } catch (e) { next(e); }
});

// GET /api/crm/board — mọi quan tâm (khách + tin + follow-up) cho bảng pipeline
crmRouter.get('/board', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const all = req.query.all === '1' && req.user!.role === 'admin';
    const rows = await query(
      `SELECT i.id, i.interest, i.deal_status AS "dealStatus", i.note, i.follow_up_at AS "followUpAt", i.created_at AS "createdAt",
              i.customer_id AS "customerId", c.name AS "custName", c.phone AS "custPhone",
              i.place_id AS "placeId", sp.features, sp.parcel_no AS parcel, sp.sheet_no AS sheet, sp.ward, sp.price, sp.area, sp.commission, sp.lng, sp.lat
              ${all ? `, COALESCE(NULLIF(u.full_name,''), split_part(u.email,'@',1)) AS "salesName"` : ''}
         FROM property_interests i JOIN customers c ON c.id=i.customer_id JOIN saved_places sp ON sp.id=i.place_id
         ${all ? 'LEFT JOIN users u ON u.id=i.user_id' : ''}
        ${all ? '' : 'WHERE i.user_id=$1'} ORDER BY i.id DESC LIMIT 3000`, all ? [] : [uid(req)]);
    res.json({ items: rows });
  } catch (e) { next(e); }
});

// GET /api/crm/match?customerId= — gợi ý tin phù hợp nhu cầu của 1 khách
crmRouter.get('/match', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const cid = Number(req.query.customerId);
    if (!(await owns('customers', cid, req))) return res.status(403).json({ error: 'Không có quyền' });
    const needs = await query(`SELECT id, deal_type AS "dealType", prop_type AS "propType", budget, area_need AS "areaNeed", location FROM customer_needs WHERE customer_id=$1`, [cid]);
    const places = await query(`SELECT id, features, parcel_no AS parcel, sheet_no AS sheet, ward, price, area, lng, lat FROM saved_places WHERE user_id=$1 ORDER BY id DESC LIMIT 500`, [uid(req)]);
    const norm = (s: any) => String(s ?? '').toLowerCase();
    const matches = needs.map((n: any) => ({
      need: n,
      places: places.filter((p: any) => {
        const loc = norm(n.location), pt = norm(n.propType);
        if (!loc && !pt) return false;
        const okLoc = !loc || norm(p.ward).includes(loc) || norm(p.features).includes(loc);
        const okType = !pt || norm(p.features).includes(pt);
        return okLoc && okType;
      }).slice(0, 8),
    }));
    res.json({ matches });
  } catch (e) { next(e); }
});

// ===================== LỊCH CÔNG CHỨNG =====================
const APPT = `id, appoint_at AS "appointAt", location, note, status, sms_reminder AS "smsReminder", sms_sent_at AS "smsSentAt", customer_id AS "customerId", place_id AS "placeId"`;

// GET /api/crm/appointments — danh sách (toàn đội nếu admin ?all=1)
crmRouter.get('/appointments', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const all = req.query.all === '1' && req.user!.role === 'admin';
    const rows = await query(
      `SELECT a.id, a.appoint_at AS "appointAt", a.location, a.note, a.status, a.sms_reminder AS "smsReminder", a.sms_sent_at AS "smsSentAt",
              a.customer_id AS "customerId", c.name AS "custName", c.phone AS "custPhone",
              a.place_id AS "placeId", sp.features, sp.parcel_no AS parcel, sp.sheet_no AS sheet
              ${all ? `, COALESCE(NULLIF(u.full_name,''), split_part(u.email,'@',1)) AS "salesName"` : ''}
         FROM notary_appointments a LEFT JOIN customers c ON c.id=a.customer_id LEFT JOIN saved_places sp ON sp.id=a.place_id
         ${all ? 'LEFT JOIN users u ON u.id=a.user_id' : ''}
        ${all ? '' : 'WHERE a.user_id=$1'} ORDER BY a.appoint_at ASC LIMIT 2000`, all ? [] : [uid(req)]);
    res.json({ appointments: rows });
  } catch (e) { next(e); }
});

crmRouter.post('/appointments', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const b = req.body ?? {};
    if (!b.appointAt) return res.status(400).json({ error: 'Thiếu ngày giờ hẹn' });
    const [row] = await query(
      `INSERT INTO notary_appointments (user_id, customer_id, place_id, appoint_at, location, note, status, sms_reminder)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,'Chờ'),COALESCE($8,false)) RETURNING ${APPT}`,
      [uid(req), b.customerId ?? null, b.placeId ?? null, b.appointAt, clip(b.location, 300), clip(b.note, 2000), clip(b.status, 40), b.smsReminder ?? false]);
    res.status(201).json({ appointment: row });
  } catch (e) { next(e); }
});

crmRouter.patch('/appointments/:id', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id); const b = req.body ?? {};
    if (!(await owns('notary_appointments', id, req))) return res.status(403).json({ error: 'Không có quyền' });
    const [row] = await query(
      `UPDATE notary_appointments SET appoint_at=COALESCE($2,appoint_at), location=COALESCE($3,location), note=COALESCE($4,note),
              status=COALESCE($5,status), sms_reminder=COALESCE($6,sms_reminder) WHERE id=$1 RETURNING ${APPT}`,
      [id, b.appointAt ?? null, b.location ?? null, b.note ?? null, b.status ?? null, (typeof b.smsReminder === 'boolean' ? b.smsReminder : null)]);
    res.json({ appointment: row });
  } catch (e) { next(e); }
});

crmRouter.delete('/appointments/:id', authRequired, async (req: AuthedRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!(await owns('notary_appointments', id, req))) return res.status(403).json({ error: 'Không có quyền' });
    await query('DELETE FROM notary_appointments WHERE id=$1', [id]);
    res.json({ deleted: id });
  } catch (e) { next(e); }
});
