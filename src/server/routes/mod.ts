import express from 'express';
import type Database from 'better-sqlite3';
import { makeDbHelpers } from '../utils.js';

export function createModRouter(db: Database) {
  const r = express.Router();
  const { select, run } = makeDbHelpers(db);

  r.get('/list', (_req, res) => {
    try { return res.json(select(`SELECT * FROM annotations WHERE state = 'pending' ORDER BY created_at ASC LIMIT 200`)); }
    catch (e: any) { return res.status(500).json({ error: 'internal_error', message: e.message }); }
  });

  r.post('/update', (req, res) => {
    const { id, state } = req.body as { id: number; state: 'published'|'rejected' };
    if (!id || !['published','rejected'].includes(state as any)) return res.status(400).json({ error: 'invalid_input' });
    try { run('UPDATE annotations SET state = ? WHERE id = ?', [state, id]); return res.json({ ok: true }); }
    catch (e: any) { return res.status(500).json({ error: 'internal_error', message: e.message }); }
  });

  return r;
}

