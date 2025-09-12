import type express from 'express';
import type Database from 'better-sqlite3';

export function sameOriginOnly(req: express.Request, originHost: string): boolean {
  const origin = req.headers.origin || req.headers.referer;
  if (!origin) return false;
  try {
    const u = new URL(String(origin));
    return u.host === originHost;
  } catch {
    return false;
  }
}

export function getIp(req: express.Request): string | undefined {
  const xf = (req.headers['x-forwarded-for'] as string) || '';
  const ip = (req.socket.remoteAddress || '').replace('::ffff:', '');
  return (xf.split(',')[0] || ip || '').trim() || undefined;
}

export function setCookie(res: express.Response, name: string, value: string, opts: { maxAge?: number } = {}): void {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ];
  if (opts.maxAge) parts.push(`Max-Age=${opts.maxAge}`);
  res.append('Set-Cookie', parts.join('; '));
}

export function getCookie(req: express.Request, name: string): string | undefined {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : undefined;
}

export function makeDbHelpers(db: Database) {
  function select<T = any>(sql: string, params: any[] = []): T[] {
    return db.prepare(sql).all(...params) as T[];
  }
  function first<T = any>(sql: string, params: any[] = []): T | undefined {
    return db.prepare(sql).get(...params) as T | undefined;
  }
  function run(sql: string, params: any[] = []) {
    return db.prepare(sql).run(...params);
  }
  return { select, first, run } as const;
}

