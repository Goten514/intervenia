import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb, logAudit } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

function sid(val: string | string[] | undefined): string {
  return Array.isArray(val) ? val[0] : String(val ?? '');
}

const router = Router();
router.use(requireAuth);

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM clients WHERE user_id = ? ORDER BY created_at DESC').all(req.user!.userId) as any[];
  logAudit(req.user!.userId, 'list', 'clients', undefined, req.ip);
  const data = rows.map((r) => ({
    ...r,
    problematiques: safeJson(r.problematiques, []),
    contenu: safeJson(r.contenu, {}),
  }));
  res.json({ data });
});

router.post('/', (req: Request, res: Response) => {
  const { prenom, age, problematiques, contexte, notes } = req.body;
  if (!prenom || !age) { res.status(400).json({ error: 'Prénom et âge requis' }); return; }
  const db = getDb();
  const id = uuid();
  const probs = Array.isArray(problematiques) ? problematiques : [];
  db.prepare(
    'INSERT INTO clients (id, user_id, prenom, age, problematiques, contexte, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, req.user!.userId, String(prenom), Number(age), JSON.stringify(probs), contexte ? String(contexte) : null, notes ? String(notes) : null);
  logAudit(req.user!.userId, 'create', 'client', id, req.ip);
  res.status(201).json({ data: { id, prenom, age, problematiques: probs, contexte, notes } });
});

router.put('/:id', (req: Request, res: Response) => {
  const { prenom, age, problematiques, contexte, notes } = req.body;
  const db = getDb();
  const id = sid(req.params.id);
  const existing = db.prepare('SELECT id FROM clients WHERE id = ? AND user_id = ?').get(id, req.user!.userId);
  if (!existing) { res.status(404).json({ error: 'Introuvable' }); return; }
  const probs = Array.isArray(problematiques) ? problematiques : [];
  db.prepare(
    'UPDATE clients SET prenom = ?, age = ?, problematiques = ?, contexte = ?, notes = ?, updated_at = datetime(\'now\') WHERE id = ? AND user_id = ?'
  ).run(String(prenom), Number(age), JSON.stringify(probs), contexte ? String(contexte) : null, notes ? String(notes) : null, id, req.user!.userId);
  logAudit(req.user!.userId, 'update', 'client', id, req.ip);
  res.json({ ok: true });
});

router.delete('/:id', (req: Request, res: Response) => {
  const id = sid(req.params.id);
  const db = getDb();
  db.prepare('DELETE FROM clients WHERE id = ? AND user_id = ?').run(id, req.user!.userId);
  logAudit(req.user!.userId, 'delete', 'client', id, req.ip);
  res.json({ ok: true });
});

function safeJson(val: unknown, fallback: unknown): unknown {
  try { return JSON.parse(String(val)); } catch { return fallback; }
}

export default router;