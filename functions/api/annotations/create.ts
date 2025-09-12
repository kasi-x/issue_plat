import { error, json, sameOriginOnly, getIp, setCookie, getCookie } from '../../../src/lib/http.js';
import sanitizeHtml from '../../../src/lib/sanitizer.js';
import { hmacIpHash, isoDateUTC } from '../../../src/lib/crypto.js';
import { verifyTurnstile } from '../../../src/lib/turnstile.js';
import type { CreateAnnotationBody, Env } from '../../../src/lib/types.js';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const headers = new Headers();
  if (!sameOriginOnly(request, env.ORIGIN_HOST)) {
    return json({ error: 'bad_origin', message: 'forbidden' }, { status: 403, headers });
  }

  let body: CreateAnnotationBody;
  try {
    body = await request.json<CreateAnnotationBody>();
  } catch {
    return json({ error: 'invalid_input', message: 'invalid json' }, { status: 400, headers });
  }

  if (!body.post_slug || !body.body_html || !body.selectors || !body.quote || !body.turnstile_token || !body.idempotency_key) {
    return json({ error: 'invalid_input', message: 'missing fields' }, { status: 400, headers });
  }
  if (body.display_name && body.display_name.length > 32) {
    return json({ error: 'too_long', message: 'display name too long' }, { status: 400, headers });
  }

  // Validate selectors include both TextQuote and TextPosition
  const sels = Array.isArray((body as any).selectors?.target?.selector)
    ? (body as any).selectors.target.selector
    : [];
  const hasQuote = sels.some((s: any) => s?.type === 'TextQuoteSelector');
  const hasPos = sels.some((s: any) => s?.type === 'TextPositionSelector');
  if (!hasQuote || !hasPos) return json({ error: 'missing_selector' }, { status: 400, headers });

  // Turnstile verify
  try {
    const ip = getIp(request) || undefined;
    const secret = env.TURNSTILE_SECRET || '';
    if (!secret) return json({ error: 'internal_error', message: 'missing TURNSTILE_SECRET' }, { status: 500, headers });
    const v = await verifyTurnstile(secret, body.turnstile_token, ip);
    if (!v.success) return json({ error: 'bot_suspected' }, { status: 403, headers });
  } catch (e) {
    return json({ error: 'internal_error', message: 'turnstile failed' }, { status: 500, headers });
  }

  // Visitor cookie
  let visitorId = getCookie(request, 'visitor_id');
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    setCookie(headers, 'visitor_id', visitorId, { maxAge: 60 * 60 * 24 * 365 });
  }

  const urlCount = (body.body_html.match(/https?:\/\//gi) || []).length;
  const tooLong = body.body_html.length > 2000;
  const sanitized = sanitizeHtml(body.body_html.slice(0, 8000));

  // Moderation: default published; hold if long/URL-heavy
  let state: 'published' | 'pending' = 'published';
  if (tooLong || urlCount > 3) state = 'pending';

  // Look up post
  const post = await env.DB.prepare('SELECT id FROM posts WHERE slug = ?').bind(body.post_slug).first<{ id: number }>();
  if (!post?.id) return json({ error: 'not_found' }, { status: 404, headers });

  // Rate limits: 5 rpm per IP (approx) and >=15s per visitor
  const ip = getIp(request) || '';
  const salt = env.SALT_IP_HASH || 'dev-salt';
  const ipHash = ip ? await hmacIpHash(salt, ip, isoDateUTC()) : '';
  // per-minute by ip
  if (ipHash) {
    const c1 = await env.DB.prepare(
      `SELECT COUNT(1) AS c FROM annotations WHERE ip_hash = ? AND created_at > datetime('now', '-60 seconds')`
    ).bind(ipHash).first<{ c: number }>();
    if ((c1?.c || 0) >= 5) return json({ error: 'rate_limited' }, { status: 429, headers });
  }
  // 15s per visitor
  const last = await env.DB.prepare(
    `SELECT created_at FROM annotations WHERE visitor_id = ? ORDER BY created_at DESC LIMIT 1`
  ).bind(visitorId).first<{ created_at: string }>();
  if (last?.created_at) {
    const lastTs = Date.parse(last.created_at + 'Z');
    if (!Number.isNaN(lastTs) && Date.now() - lastTs < 15_000) return json({ error: 'rate_limited' }, { status: 429, headers });
  }

  // Idempotency via settings key
  const idemKey = `idem:${visitorId}:${body.idempotency_key}`;
  const existing = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(idemKey).first<{ value: string }>();
  if (existing?.value) {
    const priorId = Number(existing.value) || undefined;
    return json({ error: 'conflict', id: priorId }, { status: 409, headers });
  }
  // Reserve idempotency key
  try {
    await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').bind(idemKey, 'reserved').run();
  } catch {
    return json({ error: 'conflict' }, { status: 409, headers });
  }

  // Optional spam heuristic: rapid repeat on same quote within 30s
  const repeat = await env.DB.prepare(
    `SELECT COUNT(1) AS c FROM annotations WHERE quote = ? AND created_at > datetime('now', '-30 seconds')`
  ).bind(body.quote).first<{ c: number }>();
  if ((repeat?.c || 0) > 0) state = 'pending';

  const signals = JSON.stringify({ url_count: urlCount, too_long: tooLong, idempotency_key: body.idempotency_key });

  try {
    const res = await env.DB.prepare(
      `INSERT INTO annotations (post_id, display_name, body_html, selectors, quote, parent_id, state, visitor_id, ip_hash, signals)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`
    )
      .bind(
        post.id,
        body.display_name ?? null,
        sanitized,
        JSON.stringify(body.selectors),
        body.quote,
        state,
        visitorId,
        ipHash || null,
        signals
      )
      .run();

    const id = res.meta.last_row_id;
    await env.DB.prepare('UPDATE settings SET value = ? WHERE key = ?').bind(String(id), idemKey).run();

    // Purge SSR cache for post
    try {
      const u = new URL(`/posts/${body.post_slug}`, request.url);
      await caches.default.delete(new Request(u.toString(), { method: 'GET' }));
    } catch {}

    return json({ id, state }, { status: 200, headers });
  } catch (e) {
    return json({ error: 'internal_error', message: (e as Error).message }, { status: 500, headers });
  }
};
