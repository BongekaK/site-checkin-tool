import { Router, Request, Response } from 'express';
import { db } from '../database';

const router = Router();

router.get('/summary', (req: Request, res: Response) => {
  try {
    const stmt = db.prepare(`
      SELECT site_name, strftime('%Y-%W', visit_datetime) as week,
      COUNT(*) as total_visits,
      SUM(CASE WHEN status = 'issue found' THEN 1 ELSE 0 END) as issues_found
      FROM visits GROUP BY site_name, week ORDER BY week DESC, site_name ASC
    `);
    return res.json(stmt.all());
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', details: err.message });
  }
});

router.get('/:id/history', (req: Request, res: Response) => {
  const visitId = Number(req.params.id);
  if (isNaN(visitId)) return res.status(400).json({ error: 'Invalid visit ID' });
  try {
    const visit = db.prepare('SELECT * FROM visits WHERE id = ?').get(visitId);
    if (!visit) return res.status(404).json({ error: 'Visit not found' });
    const history = db.prepare('SELECT * FROM visit_history WHERE visit_id = ? ORDER BY changed_at DESC').all(visitId);
    return res.json(history);
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', details: err.message });
  }
});

router.post('/', (req: Request, res: Response) => {
  const { site_name, technician_name, visit_datetime, status, notes } = req.body;
  const errors: string[] = [];
  if (!site_name || typeof site_name !== 'string' || !site_name.trim()) errors.push('site_name is required.');
  if (!technician_name || typeof technician_name !== 'string' || !technician_name.trim()) errors.push('technician_name is required.');
  if (!visit_datetime || typeof visit_datetime !== 'string' || !visit_datetime.trim()) errors.push('visit_datetime is required.');
  if (!status || (status !== 'completed' && status !== 'issue found')) errors.push("status is required and must be either 'completed' or 'issue found'.");
  if (errors.length > 0) return res.status(400).json({ error: 'Validation failed', details: errors });

  try {
    const s = site_name.trim();
    const t = technician_name.trim();
    const d = visit_datetime.trim();
    const n = notes && typeof notes === 'string' && notes.trim() !== '' ? notes.trim() : null;

    const checkStmt = db.prepare(`
      SELECT id FROM visits 
      WHERE site_name = ? 
        AND technician_name = ? 
        AND date(visit_datetime) = date(?) 
        AND (notes = ? OR (notes IS NULL AND ? IS NULL) OR (COALESCE(notes, '') = '' AND COALESCE(?, '') = ''))
    `);
    const existing = checkStmt.get(s, t, d, n, n, n) as { id: number } | undefined;
    if (existing) {
      return res.status(200).json({ duplicate: true, id: existing.id, message: 'Visit already logged' });
    }

    const insertStmt = db.prepare(`
      INSERT INTO visits (site_name, technician_name, visit_datetime, status, notes)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = insertStmt.run(s, t, d, status, n);
    return res.status(201).json(db.prepare('SELECT * FROM visits WHERE id = ?').get(info.lastInsertRowid));
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', details: err.message });
  }
});

router.get('/', (req: Request, res: Response) => {
  const { site, startDate, endDate } = req.query;
  let query = 'SELECT * FROM visits';
  const params: any[] = [];
  const conditions: string[] = [];
  if (site && typeof site === 'string' && site.trim()) { conditions.push('site_name LIKE ?'); params.push(`%${site.trim()}%`); }
  if (startDate && typeof startDate === 'string' && startDate.trim()) { conditions.push('visit_datetime >= ?'); params.push(startDate.trim()); }
  if (endDate && typeof endDate === 'string' && endDate.trim()) { conditions.push('visit_datetime <= ?'); params.push(endDate.trim()); }
  if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY visit_datetime DESC';
  try {
    return res.json(db.prepare(query).all(...params));
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', details: err.message });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  const visitId = Number(req.params.id);
  if (isNaN(visitId)) return res.status(400).json({ error: 'Invalid visit ID' });
  const { status, notes } = req.body;
  if (!status || (status !== 'completed' && status !== 'issue found')) {
    return res.status(400).json({ error: 'Validation failed', details: ["status must be 'completed' or 'issue found'."] });
  }
  try {
    const updateTx = db.transaction(() => {
      const current: any = db.prepare('SELECT * FROM visits WHERE id = ?').get(visitId);
      if (!current) return null;
      db.prepare('INSERT INTO visit_history (visit_id, previous_status, previous_notes) VALUES (?, ?, ?)').run(visitId, current.status, current.notes);
      const trimmedNotes = notes !== undefined && notes !== null && typeof notes === 'string' ? notes.trim() : (notes === null ? null : current.notes);
      db.prepare('UPDATE visits SET status = ?, notes = ? WHERE id = ?').run(status, trimmedNotes, visitId);
      return db.prepare('SELECT * FROM visits WHERE id = ?').get(visitId);
    });
    const updated = updateTx();
    if (!updated) return res.status(404).json({ error: 'Visit not found' });
    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', details: err.message });
  }
});

export default router;

