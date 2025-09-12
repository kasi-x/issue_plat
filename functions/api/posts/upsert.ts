import { error, json } from '../../../src/lib/http.js';
import type { Env } from '../../../src/lib/types.js';

type UpsertBody = {
  slug: string;
  html: string;
  plain_text: string;
  revision?: number;
  content_hash?: string | null;
  published_at?: string | null;
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Note: Protect with Cloudflare Access; this is internal-only.
  let b: UpsertBody;
  try { b = await request.json<UpsertBody>(); } catch { return error(400, 'invalid_input', 'invalid json'); }
  if (!b.slug || !b.html || !b.plain_text) return error(400, 'invalid_input', 'missing fields');

  try {
    const existing = await env.DB.prepare(`SELECT id FROM posts WHERE slug = ?`).bind(b.slug).first<{ id: number }>();
    if (existing?.id) {
      await env.DB.prepare(
        `UPDATE posts SET html = ?, plain_text = ?, revision = COALESCE(?, revision + 1), content_hash = ?, published_at = ? WHERE id = ?`
      )
        .bind(b.html, b.plain_text, b.revision ?? null, b.content_hash ?? null, b.published_at ?? null, existing.id)
        .run();
      return json({ updated: true, id: existing.id });
    } else {
      const res = await env.DB.prepare(
        `INSERT INTO posts (slug, html, plain_text, revision, content_hash, published_at) VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(b.slug, b.html, b.plain_text, b.revision ?? 1, b.content_hash ?? null, b.published_at ?? null)
        .run();
      return json({ created: true, id: res.meta.last_row_id });
    }
  } catch (e) {
    return error(500, 'internal_error', (e as Error).message);
  }
};
