import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { getDb, logAudit } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';

const router = Router();

router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password || password.length < 6) {
      res.status(400).json({ error: 'Email requis et mot de passe (min 6 caractères)' });
      return;
    }
    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) {
      res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
      return;
    }
    const hash = await bcrypt.hash(password, 12);
    const id = uuid();
    db.prepare(
      'INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)'
    ).run(id, email.toLowerCase().trim(), hash, fullName || '');

    logAudit(id, 'signup', 'user', id, req.ip);
    const token = signToken({ userId: id, email: email.toLowerCase().trim(), role: 'user' });
    res.status(201).json({ token, user: { id, email: email.toLowerCase().trim(), full_name: fullName || '' } });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de l\'inscription' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email et mot de passe requis' });
      return;
    }
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim()) as any;
    if (!user) {
      res.status(401).json({ error: 'Email ou mot de passe invalide' });
      return;
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      logAudit(user.id, 'login_failed', 'user', user.id, req.ip);
      res.status(401).json({ error: 'Email ou mot de passe invalide' });
      return;
    }
    logAudit(user.id, 'login', 'user', user.id, req.ip);
    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    res.json({ token, user: { id: user.id, email: user.email, full_name: user.full_name } });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

router.get('/me', (req: Request, res: Response) => {
  // Utilisé avec le header Authorization pour vérifier la session
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Non authentifié' });
    return;
  }
  const { verifyToken } = require('../middleware/auth.js');
  const payload = verifyToken(header.slice(7));
  if (!payload) {
    res.status(401).json({ error: 'Session invalide' });
    return;
  }
  const db = getDb();
  const user = db.prepare('SELECT id, email, full_name, role, consent_given FROM users WHERE id = ?').get(payload.userId) as any;
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  res.json({ user });
});

router.post('/consent', (req: Request, res: Response) => {
  // Route ouverte pour enregistrer le consentement (vérifié par l'app frontend)
  const { userId, consent } = req.body;
  if (!userId || consent === undefined) {
    res.status(400).json({ error: 'userId et consent requis' });
    return;
  }
  const db = getDb();
  db.prepare('UPDATE users SET consent_given = ?, consent_date = datetime(\'now\') WHERE id = ?').run(consent ? 1 : 0, userId);
  logAudit(userId, consent ? 'consent_given' : 'consent_withdrawn', 'user', userId, req.ip);
  res.json({ ok: true });
});

export default router;