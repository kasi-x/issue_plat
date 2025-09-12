import type { ApiErrorCode, JsonValue } from './types.js';

export function json(data: JsonValue, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function error(status: number, code: ApiErrorCode, message?: string): Response {
  return json({ error: code, message }, { status });
}

export function ok(data: JsonValue, init: ResponseInit = {}): Response {
  return json(data, { status: 200, ...init });
}

export function methodNotAllowed(): Response {
  return error(405, 'invalid_input', 'method not allowed');
}

export function notImplemented(): Response {
  return error(501, 'internal_error', 'not implemented');
}

export function parseUrl(req: Request): URL {
  return new URL(req.url);
}

export function getIp(request: Request): string | undefined {
  // Cloudflare provides cf-connecting-ip
  const h = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for');
  return h?.split(',')[0]?.trim();
}

export function sameOriginOnly(request: Request, originHost?: string): boolean {
  if (!originHost) return true; // allow during dev if not set
  const origin = request.headers.get('origin') || request.headers.get('referer');
  if (!origin) return false;
  try {
    const u = new URL(origin);
    return u.host === originHost;
  } catch {
    return false;
  }
}

export function getCookie(request: Request, name: string): string | undefined {
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : undefined;
}

export function setCookie(headers: Headers, name: string, value: string, opts: { maxAge?: number } = {}): void {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'Secure',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (opts.maxAge) parts.push(`Max-Age=${opts.maxAge}`);
  headers.append('set-cookie', parts.join('; '));
}
