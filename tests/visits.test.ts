import path from 'path';
import fs from 'fs';
import request from 'supertest';

const TEST_DB_PATH = path.join(__dirname, 'test-data.db');
process.env.DB_PATH = TEST_DB_PATH;

import app from '../src/index';
import { db } from '../src/database';

describe('Visits API Endpoints', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM visit_history').run();
    db.prepare('DELETE FROM visits').run();
  });

  afterAll(async () => {
    db.close();
    try {
      if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    } catch (err) {
      console.error('Failed to delete test database file:', err);
    }
  });

  describe('POST /api/visits', () => {
    it('should log a valid visit and return 201 with the created object', async () => {
      const payload = {
        site_name: 'HQ Campus',
        technician_name: 'Sarah Connor',
        visit_datetime: '2026-08-26T10:00',
        status: 'completed',
        notes: 'Checked all HVAC systems'
      };
      const res = await request(app).post('/api/visits').send(payload);
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.site_name).toBe(payload.site_name);
      expect(res.body.technician_name).toBe(payload.technician_name);
      expect(res.body.visit_datetime).toBe(payload.visit_datetime);
      expect(res.body.status).toBe(payload.status);
      expect(res.body.notes).toBe(payload.notes);
      expect(res.body).toHaveProperty('created_at');
    });

    it('should log a visit when notes are omitted', async () => {
      const payload = {
        site_name: 'North Hub',
        technician_name: 'John Doe',
        visit_datetime: '2026-08-26T11:00',
        status: 'issue found'
      };
      const res = await request(app).post('/api/visits').send(payload);
      expect(res.status).toBe(201);
      expect(res.body.notes).toBeNull();
    });

    it('should return 400 for missing required fields', async () => {
      const payload = {
        site_name: '',
        technician_name: 'Jane Doe',
        status: 'completed'
      };
      const res = await request(app).post('/api/visits').send(payload);
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Validation failed');
      expect(res.body).toHaveProperty('details');
      expect(res.body.details.length).toBeGreaterThanOrEqual(2);
    });

    it('should return 400 for an invalid status value', async () => {
      const payload = {
        site_name: 'West Warehouse',
        technician_name: 'Bob Ross',
        visit_datetime: '2026-08-26T12:00',
        status: 'in progress'
      };
      const res = await request(app).post('/api/visits').send(payload);
      expect(res.status).toBe(400);
      expect(res.body.details).toContain("status is required and must be either 'completed' or 'issue found'.");
    });
  });

  describe('GET /api/visits with Filtering', () => {
    beforeEach(() => {
      const insert = db.prepare(`
        INSERT INTO visits (site_name, technician_name, visit_datetime, status, notes)
        VALUES (?, ?, ?, ?, ?)
      `);
      insert.run('Alpha Plaza', 'Alice', '2026-08-20T10:00', 'completed', 'No issues');
      insert.run('Beta Tower', 'Bob', '2026-08-22T14:00', 'issue found', 'Leak detected');
      insert.run('Alpha Station', 'Alice', '2026-08-25T09:00', 'completed', 'Routine check');
    });

    it('should return all visits ordered by visit_datetime DESC', async () => {
      const res = await request(app).get('/api/visits');
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(3);
      expect(res.body[0].site_name).toBe('Alpha Station');
      expect(res.body[1].site_name).toBe('Beta Tower');
      expect(res.body[2].site_name).toBe('Alpha Plaza');
    });

    it('should filter fuzzy on site name', async () => {
      const res = await request(app).get('/api/visits').query({ site: 'Alpha' });
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
      expect(res.body[0].site_name).toBe('Alpha Station');
      expect(res.body[1].site_name).toBe('Alpha Plaza');
    });

    it('should filter by startDate', async () => {
      const res = await request(app).get('/api/visits').query({ startDate: '2026-08-21T00:00' });
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
      expect(res.body[0].site_name).toBe('Alpha Station');
      expect(res.body[1].site_name).toBe('Beta Tower');
    });

    it('should filter by endDate', async () => {
      const res = await request(app).get('/api/visits').query({ endDate: '2026-08-23T00:00' });
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
      expect(res.body[0].site_name).toBe('Beta Tower');
      expect(res.body[1].site_name).toBe('Alpha Plaza');
    });

    it('should filter by both startDate and endDate', async () => {
      const res = await request(app).get('/api/visits').query({ startDate: '2026-08-21T00:00', endDate: '2026-08-23T00:00' });
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].site_name).toBe('Beta Tower');
    });

    it('should return empty list if nothing matches filters', async () => {
      const res = await request(app).get('/api/visits').query({ site: 'Nonexistent Site' });
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(0);
    });
  });

  describe('Phase 2 Requirements', () => {
    it('should handle duplicates by returning 200 and existing visit info (preventing duplicate row creation)', async () => {
      const payload = {
        site_name: 'Unique Site',
        technician_name: 'Unique Tech',
        visit_datetime: '2026-08-30T10:00',
        status: 'completed',
        notes: 'Routine maintenance'
      };
      // First submission
      const res1 = await request(app).post('/api/visits').send(payload);
      expect(res1.status).toBe(201);
      
      // Exact duplicate submission
      const res2 = await request(app).post('/api/visits').send(payload);
      expect(res2.status).toBe(200);
      expect(res2.body.duplicate).toBe(true);
      expect(res2.body.id).toBe(res1.body.id);
      expect(res2.body.message).toBe('Visit already logged');
      
      // Same site, technician, calendar date, and notes, but DIFFERENT time
      const res3 = await request(app).post('/api/visits').send({
        ...payload,
        visit_datetime: '2026-08-30T16:45'
      });
      expect(res3.status).toBe(200);
      expect(res3.body.duplicate).toBe(true);
      expect(res3.body.id).toBe(res1.body.id);

      const visits = db.prepare('SELECT * FROM visits WHERE site_name = ?').all('Unique Site');
      expect(visits.length).toBe(1);
    });

    it('should allow editing a visit and tracking history', async () => {
      const insert = db.prepare(`
        INSERT INTO visits (site_name, technician_name, visit_datetime, status, notes)
        VALUES (?, ?, ?, ?, ?)
      `);
      const info = insert.run('Edit Site', 'Tech', '2026-08-31T10:00', 'completed', 'Original notes');
      const visitId = info.lastInsertRowid;

      const res = await request(app)
        .put(`/api/visits/${visitId}`)
        .send({ status: 'issue found', notes: 'Corrected notes' });
      
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('issue found');
      expect(res.body.notes).toBe('Corrected notes');

      const history = db.prepare('SELECT * FROM visit_history WHERE visit_id = ?').all(visitId) as any[];
      expect(history.length).toBe(1);
      expect(history[0].previous_status).toBe('completed');
      expect(history[0].previous_notes).toBe('Original notes');
    });

    it('should aggregate weekly summary', async () => {
       db.prepare(`DELETE FROM visits`).run();
       const insert = db.prepare(`
        INSERT INTO visits (site_name, technician_name, visit_datetime, status, notes)
        VALUES (?, ?, ?, ?, ?)
      `);
      insert.run('Site A', 'Tech', '2026-08-01T10:00', 'completed', '');
      insert.run('Site A', 'Tech', '2026-08-02T10:00', 'issue found', '');

      const res = await request(app).get('/api/visits/summary');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      const summary = res.body.find((s: any) => s.site_name === 'Site A');
      expect(summary.total_visits).toBe(2);
      expect(summary.issues_found).toBe(1);
    });
  });
});
