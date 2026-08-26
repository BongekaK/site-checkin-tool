import { Router, Request, Response } from 'express';
import { db } from '../database';

const router = Router();

// POST /api/visits - Log a new visit
router.post('/', (req: Request, res: Response) => {
  const { site_name, technician_name, visit_datetime, status, notes } = req.body;

  // Validation
  const errors: string[] = [];

  if (!site_name || typeof site_name !== 'string' || site_name.trim() === '') {
    errors.push('site_name is required and must be a non-empty string.');
  }

  if (!technician_name || typeof technician_name !== 'string' || technician_name.trim() === '') {
    errors.push('technician_name is required and must be a non-empty string.');
  }

  if (!visit_datetime || typeof visit_datetime !== 'string' || visit_datetime.trim() === '') {
    errors.push('visit_datetime is required and must be a non-empty string.');
  }

  if (!status || (status !== 'completed' && status !== 'issue found')) {
    errors.push("status is required and must be either 'completed' or 'issue found'.");
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO visits (site_name, technician_name, visit_datetime, status, notes)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(
      site_name.trim(),
      technician_name.trim(),
      visit_datetime.trim(),
      status,
      notes && typeof notes === 'string' ? notes.trim() : null
    );

    const createdVisit = db.prepare('SELECT * FROM visits WHERE id = ?').get(info.lastInsertRowid);

    return res.status(201).json(createdVisit);
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// GET /api/visits - Get visits with optional filters
router.get('/', (req: Request, res: Response) => {
  const { site, startDate, endDate } = req.query;

  let query = 'SELECT * FROM visits';
  const params: any[] = [];
  const conditions: string[] = [];

  if (site && typeof site === 'string' && site.trim() !== '') {
    conditions.push('site_name LIKE ?');
    params.push(`%${site.trim()}%`);
  }

  if (startDate && typeof startDate === 'string' && startDate.trim() !== '') {
    conditions.push('visit_datetime >= ?');
    params.push(startDate.trim());
  }

  if (endDate && typeof endDate === 'string' && endDate.trim() !== '') {
    conditions.push('visit_datetime <= ?');
    params.push(endDate.trim());
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY visit_datetime DESC';

  try {
    const stmt = db.prepare(query);
    const visits = stmt.all(...params);
    return res.json(visits);
  } catch (err: any) {
    return res.status(500).json({ error: 'Database error', details: err.message });
  }
});

export default router;
