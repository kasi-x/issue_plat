import type Database from 'better-sqlite3';
import { hmacIpHash, isoDateUTC } from '../lib/crypto.js';

export function moderationFlags(html: string) {
  const urlCount = (html.match(/https?:\/\//gi) || []).length;
  const tooLong = html.length > 2000;
  const state: 'published' | 'pending' = (tooLong || urlCount > 3) ? 'pending' : 'published';
  return { urlCount, tooLong, state };
}

export async function rateLimit(db: Database, salt: string, ip: string | undefined, visitorId: string) {
  const ipHash = ip ? await hmacIpHash(salt, ip, isoDateUTC()) : '';
  if (ipHash) {
    const row = db.prepare(`SELECT COUNT(1) AS c FROM annotations WHERE ip_hash = ? AND created_at > datetime('now', '-60 seconds')`).get(ipHash) as { c: number } | undefined;
    if ((row?.c || 0) >= 5) return { limited: true } as const;
  }
  const last = db.prepare(`SELECT created_at FROM annotations WHERE visitor_id = ? ORDER BY created_at DESC LIMIT 1`).get(visitorId) as { created_at: string } | undefined;
  if (last?.created_at) {
    const lastTs = Date.parse(last.created_at + 'Z');
    if (!Number.isNaN(lastTs) && Date.now() - lastTs < 15_000) return { limited: true } as const;
  }
  return { limited: false, ipHash } as const;
}

export function reserveIdempotency(db: Database, visitorId: string, key: string) {
  const idemKey = `idem:${visitorId}:${key}`;
  const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get(idemKey) as { value: string } | undefined;
  if (existing?.value) return { conflict: true, id: Number(existing.value) || undefined, idemKey } as const;
  try {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(idemKey, 'reserved');
  } catch {
    return { conflict: true, idemKey } as const;
  }
  return { conflict: false, idemKey } as const;
}

