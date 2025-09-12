import { error, json } from '../../../src/lib/http.js';
import type { Env } from '../../../src/lib/types.js';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Note: Protect this route via Cloudflare Access in production.
  let payload: { id: number; state: 'published' | 'rejected' };
  try { payload = await request.json(); } catch { return error(400, 'invalid_input'); }
  if (!payload?.id || !['published', 'rejected'].includes(payload.state)) return error(400, 'invalid_input');
  try {
    await env.DB.prepare(`UPDATE annotations SET state = ? WHERE id = ?`).bind(payload.state, payload.id).run();
    return json({ ok: true });
  } catch (e) {
    return error(500, 'internal_error', (e as Error).message);
  }
};
