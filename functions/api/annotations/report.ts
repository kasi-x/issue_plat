import { error, json, sameOriginOnly } from '../../../src/lib/http.js';
import type { Env, ReportAnnotationBody } from '../../../src/lib/types.js';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!sameOriginOnly(request, env.ORIGIN_HOST)) return error(403, 'bad_origin', 'forbidden');
  let body: ReportAnnotationBody;
  try { body = await request.json<ReportAnnotationBody>(); } catch { return error(400, 'invalid_input', 'invalid json'); }
  if (!body.annotation_id) return error(400, 'invalid_input', 'missing annotation_id');
  return json({ accepted: true }, { status: 202 });
};
