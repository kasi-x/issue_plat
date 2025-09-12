import { ok, error } from '../../../src/lib/http.js';
import type { Env } from '../../../src/lib/types.js';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');
  const after = url.searchParams.get('after');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '50') || 50, 200);

  if (!slug) return error(400, 'invalid_input', 'missing slug');

  try {
    const params: any[] = [];
    let sql = `SELECT a.* FROM annotations a JOIN posts p ON a.post_id = p.id WHERE p.slug = ? AND a.state = 'published'`;
    params.push(slug);
    if (after) {
      sql += ' AND a.created_at > ?';
      params.push(after);
    }
    sql += ' ORDER BY a.created_at ASC LIMIT ?';
    params.push(limit);

    const { results } = await env.DB.prepare(sql).bind(...params).all();
    return ok(results ?? []);
  } catch (e) {
    return error(500, 'internal_error', (e as Error).message);
  }
};
