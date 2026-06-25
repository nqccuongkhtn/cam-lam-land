import { Router } from 'express';
import { query } from '../lib/db.ts';
import { hashPassword, verifyPassword, signToken } from '../lib/auth.ts';
import { authRequired, type AuthedRequest } from '../middleware/auth.ts';

export const authRouter = Router();

authRouter.post('/register', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const exists = await query('SELECT id FROM users WHERE email=$1', [email]);
    if (exists.length) return res.status(409).json({ error: 'Email already registered' });
    const hash = await hashPassword(password);
    const [user] = await query(
      `INSERT INTO users (email, password_hash, role) VALUES ($1,$2,'user')
       RETURNING id, email, role`, [email, hash]);
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.status(201).json({ token, user });
  } catch (e) { next(e); }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    const [user] = await query('SELECT * FROM users WHERE email=$1', [email]);
    if (!user || !(await verifyPassword(password ?? '', user.password_hash)))
      return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (e) { next(e); }
});

authRouter.get('/me', authRequired, (req: AuthedRequest, res) => res.json({ user: req.user }));
