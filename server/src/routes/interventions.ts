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
  const rows = db.prepare('SELECT * FROM interventions WHERE user_id = ? ORDER BY created_at DESC').all(req.user!.userId) as any[];
  logAudit(req.user!.userId, 'list', 'interventions', undefined, req.ip);
  const data = rows.map((r) => ({ ...r, contenu: safeJson(r.contenu, {}) }));
  res.json({ data });
});

router.post('/', (req: Request, res: Response) => {
  const { titre, type, age, problematique, contenu, client_id, is_draft } = req.body;
  const db = getDb();
  const id = uuid();
  db.prepare(
    'INSERT INTO interventions (id, user_id, client_id, titre, type, age, problematique, contenu, is_draft) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, req.user!.userId, client_id ? String(client_id) : null, String(titre || 'Sans titre'), type ? String(type) : null, age ? Number(age) : null, problematique ? String(problematique) : null, JSON.stringify(contenu || {}), is_draft ? 1 : 0);
  logAudit(req.user!.userId, 'create', 'intervention', id, req.ip);
  res.status(201).json({ data: { id, titre, type, age, problematique, contenu, is_draft: !!is_draft, created_at: new Date().toISOString() } });
});

router.get('/:id', (req: Request, res: Response) => {
  const id = sid(req.params.id);
  const db = getDb();
  const row = db.prepare('SELECT * FROM interventions WHERE id = ? AND user_id = ?').get(id, req.user!.userId) as any;
  if (!row) { res.status(404).json({ error: 'Introuvable' }); return; }
  logAudit(req.user!.userId, 'read', 'intervention', id, req.ip);
  res.json({ data: { ...row, contenu: safeJson(row.contenu, {}) } });
});

router.put('/:id', (req: Request, res: Response) => {
  const id = sid(req.params.id);
  const { titre, type, age, problematique, contenu, client_id, is_draft } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT id FROM interventions WHERE id = ? AND user_id = ?').get(id, req.user!.userId);
  if (!existing) { res.status(404).json({ error: 'Introuvable' }); return; }
  db.prepare(
    'UPDATE interventions SET titre = ?, type = ?, age = ?, problematique = ?, contenu = ?, client_id = ?, is_draft = ?, updated_at = datetime(\'now\') WHERE id = ? AND user_id = ?'
  ).run(String(titre), type ? String(type) : null, age ? Number(age) : null, problematique ? String(problematique) : null, JSON.stringify(contenu || {}), client_id ? String(client_id) : null, is_draft ? 1 : 0, id, req.user!.userId);
  logAudit(req.user!.userId, 'update', 'intervention', id, req.ip);
  res.json({ ok: true });
});

router.delete('/:id', (req: Request, res: Response) => {
  const id = sid(req.params.id);
  const db = getDb();
  db.prepare('DELETE FROM interventions WHERE id = ? AND user_id = ?').run(id, req.user!.userId);
  logAudit(req.user!.userId, 'delete', 'intervention', id, req.ip);
  res.json({ ok: true });
});

function safeJson(val: unknown, fallback: unknown): unknown {
  try { return JSON.parse(String(val)); } catch { return fallback; }
}

export default router;