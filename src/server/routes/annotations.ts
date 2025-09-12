import express from 'express';
import type Database from 'better-sqlite3';
import { sanitizeHtml } from '../../lib/sanitizer.js';
import type { CreateAnnotationBody, ReplyAnnotationBody, ReportAnnotationBody } from '../../lib/types.js';
import { verifyTurnstileLocal } from '../turnstile.js';
import { makeDbHelpers, sameOriginOnly, getIp, setCookie, getCookie } from '../utils.js';
import { validateAnnotationBody } from '../validators.js';
import { moderationFlags, rateLimit, reserveIdempotency } from '../services.js';

export function createAnnotationsRouter(db: Database, opts: { originHost: string; salt: string }) {
  const r = express.Router();
  const { select, first, run } = makeDbHelpers(db);

  r.get('/list', (req, res) => {
    const { slug } = req.query as any;
    const after = (req.query.after as string) || undefined;
    const limit = Math.min(Number(req.query.limit || '50') || 50, 200);
    if (!slug) return res.status(400).json({ error: 'invalid_input', message: 'missing slug' });
    try {
      const params: any[] = [slug];
      let sql = `SELECT a.* FROM annotations a JOIN posts p ON a.post_id = p.id WHERE p.slug = ? AND a.state = 'published'`;
      if (after) { sql += ' AND a.created_at > ?'; params.push(after); }
      sql += ' ORDER BY a.created_at ASC LIMIT ?'; params.push(limit);
      return res.json(select(sql, params));
    } catch (e: any) { return res.status(500).json({ error: 'internal_error', message: e.message }); }
  });

  async function handleCreateOrReply(req: express.Request, res: express.Response, isReply: boolean) {
    if (!sameOriginOnly(req, opts.originHost)) return res.status(403).json({ error: 'bad_origin' });
    const body = req.body as (CreateAnnotationBody & Partial<ReplyAnnotationBody>);
    const vErr = validateAnnotationBody(body, isReply);
    if (vErr) return res.status(vErr.status).json(vErr);

    try {
      const v = await verifyTurnstileLocal(body.turnstile_token, getIp(req));
      if (!v.success) return res.status(403).json({ error: 'bot_suspected' });
    } catch { return res.status(500).json({ error: 'internal_error', message: 'turnstile failed' }); }

    let visitorId = getCookie(req, 'visitor_id');
    if (!visitorId) { visitorId = crypto.randomUUID(); setCookie(res, 'visitor_id', visitorId, { maxAge: 60 * 60 * 24 * 365 }); }

    const { urlCount, tooLong, state: modState } = moderationFlags(body.body_html);
    let state = modState;
    const sanitized = sanitizeHtml(body.body_html.slice(0, 8000));

    const post = first<{ id: number }>('SELECT id FROM posts WHERE slug = ?', [body.post_slug]);
    if (!post?.id) return res.status(404).json({ error: 'not_found' });

    const rl = await rateLimit(db, opts.salt, getIp(req), visitorId);
    if (rl.limited) return res.status(429).json({ error: 'rate_limited' });

    const idem = reserveIdempotency(db, visitorId, body.idempotency_key);
    if (idem.conflict) return res.status(409).json({ error: 'conflict', id: idem.id });

    let parentId: number | null = null;
    if (isReply) {
      const parent = first<{ id: number; post_id: number }>('SELECT id, post_id FROM annotations WHERE id = ?', [body.parent_id]);
      if (!parent?.id || parent.post_id !== post.id) return res.status(400).json({ error: 'invalid_input', message: 'parent mismatch' });
      parentId = parent.id;
    }

    const repeat = first<{ c: number }>(`SELECT COUNT(1) AS c FROM annotations WHERE quote = ? AND created_at > datetime('now', '-30 seconds')`, [body.quote]);
    if ((repeat?.c || 0) > 0) state = 'pending';

    const signals = JSON.stringify({ url_count: urlCount, too_long: tooLong, idempotency_key: body.idempotency_key });
    try {
      const info = db.prepare(
        `INSERT INTO annotations (post_id, display_name, body_html, selectors, quote, parent_id, state, visitor_id, ip_hash, signals)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(post.id, body.display_name ?? null, sanitized, JSON.stringify(body.selectors), body.quote, parentId, state, visitorId, (rl as any).ipHash || null, signals);
      const id = Number(info.lastInsertRowid);
      db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(id), (idem as any).idemKey);
      return res.json({ id, state });
    } catch (e: any) { return res.status(500).json({ error: 'internal_error', message: e.message }); }
  }

  r.post('/create', (req, res) => { void handleCreateOrReply(req, res, false); });
  r.post('/reply', (req, res) => { void handleCreateOrReply(req, res, true); });

  r.post('/report', (req, res) => {
    if (!sameOriginOnly(req, opts.originHost)) return res.status(403).json({ error: 'bad_origin' });
    const body = req.body as ReportAnnotationBody;
    if (!body?.annotation_id) return res.status(400).json({ error: 'invalid_input' });
    try {
      run('INSERT INTO reports (annotation_id, reason) VALUES (?, ?)', [body.annotation_id, body.reason ?? null]);
      return res.status(202).json({ accepted: true });
    } catch (e: any) { return res.status(500).json({ error: 'internal_error', message: e.message }); }
  });

  return r;
}

