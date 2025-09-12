import express from 'express';
import type Database from 'better-sqlite3';
import { makeDbHelpers } from '../utils.js';

export function createPostsApiRouter(db: Database) {
  const r = express.Router();
  const { first, run } = makeDbHelpers(db);

  r.post('/upsert', (req, res) => {
    const b = req.body as { slug: string; html: string; plain_text: string; revision?: number; content_hash?: string|null; published_at?: string|null };
    if (!b?.slug || !b.html || !b.plain_text) return res.status(400).json({ error: 'invalid_input' });
    try {
      const ex = first<{ id: number }>('SELECT id FROM posts WHERE slug = ?', [b.slug]);
      if (ex?.id) {
        run('UPDATE posts SET html = ?, plain_text = ?, revision = COALESCE(?, revision + 1), content_hash = ?, published_at = ? WHERE id = ?', [b.html, b.plain_text, b.revision ?? null, b.content_hash ?? null, b.published_at ?? null, ex.id]);
        return res.json({ updated: true, id: ex.id });
      } else {
        const info = run('INSERT INTO posts (slug, html, plain_text, revision, content_hash, published_at) VALUES (?, ?, ?, ?, ?, ?)', [b.slug, b.html, b.plain_text, b.revision ?? 1, b.content_hash ?? null, b.published_at ?? null]);
        return res.json({ created: true, id: Number(info.lastInsertRowid) });
      }
    } catch (e: any) { return res.status(500).json({ error: 'internal_error', message: e.message }); }
  });

  return r;
}

