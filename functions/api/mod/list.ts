import { error, json } from '../../../src/lib/http.js';
import type { Env } from '../../../src/lib/types.js';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  // Note: Protect this route via Cloudflare Access in production.
  try {
    const { results } = await env.DB.prepare(
      `SELECT a.* FROM annotations a WHERE a.state = 'pending' ORDER BY a.created_at ASC LIMIT 200`
    ).all();
    return json(results ?? []);
  } catch (e) {
    return error(500, 'internal_error', (e as Error).message);
  }
};
