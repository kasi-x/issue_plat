import { json, sameOriginOnly, getIp, getCookie, setCookie } from '../../../src/lib/http.js';
import { prepareAnnotationContent } from '../../../src/lib/annotations/content.js';
import { validateAnnotationBody } from '../../../src/lib/annotations/validation.js';
import { hmacIpHash, isoDateUTC } from '../../../src/lib/crypto.js';
import { verifyTurnstile } from '../../../src/lib/turnstile.js';
import type { Env } from '../../../src/lib/types.js';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const headers = new Headers();
  if (!sameOriginOnly(request, env.ORIGIN_HOST)) return json({ error: 'bad_origin' }, { status: 403, headers });
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ error: 'invalid_input' }, { status: 400, headers });
  }

  // Use shared validator to mirror Express reply requirements.
  const validation = validateAnnotationBody(rawBody, { isReply: true });
  if (!validation.ok) {
    const payload: Record<string, unknown> = { error: validation.error.error };
    if (validation.error.message) payload.message = validation.error.message;
    return json(payload, { status: validation.error.status, headers });
  }
  const body = validation.body;

  // Turnstile verify
  try {
    const ip = getIp(request) || undefined;
    const secret = env.TURNSTILE_SECRET || '';
    if (!secret) return json({ error: 'internal_error' }, { status: 500, headers });
    const v = await verifyTurnstile(secret, body.turnstile_token, ip);
    if (!v.success) return json({ error: 'bot_suspected' }, { status: 403, headers });
  } catch { return json({ error: 'internal_error' }, { status: 500, headers }); }

  // Visitor cookie
  let visitorId = getCookie(request, 'visitor_id');
  if (!visitorId) { visitorId = crypto.randomUUID(); setCookie(headers, 'visitor_id', visitorId, { maxAge: 60 * 60 * 24 * 365 }); }

  // Shared sanitizer + moderation pipeline.
  const prepared = prepareAnnotationContent(body.body_html, body.idempotency_key, body.kind);
  let state = prepared.state;

  // Validate parent exists and get post_id
  const parent = await env.DB.prepare('SELECT id, post_id FROM annotations WHERE id = ?').bind(body.parent_id).first<{ id: number; post_id: number }>();
  if (!parent?.id) return json({ error: 'not_found' }, { status: 404, headers });
  const post = await env.DB.prepare('SELECT id FROM posts WHERE slug = ?').bind(body.post_slug).first<{ id: number }>();
  if (!post?.id || post.id !== parent.post_id) return json({ error: 'invalid_input', message: 'post mismatch' }, { status: 400, headers });

  // Rate limits
  const ip = getIp(request) || '';
  const salt = env.SALT_IP_HASH || 'dev-salt';
  const ipHash = ip ? await hmacIpHash(salt, ip, isoDateUTC()) : '';
  if (ipHash) {
    const c1 = await env.DB.prepare(`SELECT COUNT(1) AS c FROM annotations WHERE ip_hash = ? AND created_at > datetime('now', '-60 seconds')`).bind(ipHash).first<{ c: number }>();
    if ((c1?.c || 0) >= 5) return json({ error: 'rate_limited' }, { status: 429, headers });
  }
  const last = await env.DB.prepare(`SELECT created_at FROM annotations WHERE visitor_id = ? ORDER BY created_at DESC LIMIT 1`).bind(visitorId).first<{ created_at: string }>();
  if (last?.created_at) {
    const lastTs = Date.parse(last.created_at + 'Z');
    if (!Number.isNaN(lastTs) && Date.now() - lastTs < 15_000) return json({ error: 'rate_limited' }, { status: 429, headers });
  }

  // Idempotency
  const idemKey = `idem:${visitorId}:${body.idempotency_key}`;
  const existing = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(idemKey).first<{ value: string }>();
  if (existing?.value) return json({ error: 'conflict', id: Number(existing.value) || undefined }, { status: 409, headers });
  try { await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').bind(idemKey, 'reserved').run(); } catch { return json({ error: 'conflict' }, { status: 409, headers }); }

  const signals = JSON.stringify(prepared.signals);

  try {
    const res = await env.DB.prepare(
      `INSERT INTO annotations (post_id, display_name, body_html, selectors, quote, parent_id, state, visitor_id, ip_hash, signals, kind)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        parent.post_id,
        body.display_name ?? null,
        prepared.sanitizedHtml,
        JSON.stringify(body.selectors),
        body.quote,
        body.parent_id,
        state,
        visitorId,
        ipHash || null,
        signals,
        prepared.kind
      )
      .run();
    const id = res.meta.last_row_id;
    await env.DB.prepare('UPDATE settings SET value = ? WHERE key = ?').bind(String(id), idemKey).run();

    // Purge SSR cache for post
    try { const u = new URL(`/posts/${body.post_slug}`, request.url); await caches.default.delete(new Request(u.toString(), { method: 'GET' })); } catch {}

    return json({ id, state }, { status: 200, headers });
  } catch (e) {
    return json({ error: 'internal_error', message: (e as Error).message }, { status: 500, headers });
  }
};
