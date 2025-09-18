import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { getRuntimeTarget, isCloudflareRuntime } from '../lib/runtime.js';

const runtimeTarget = getRuntimeTarget();
const skipMigrations = isCloudflareRuntime(runtimeTarget);

export function openDb(dbPath: string) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  return db;
}

export function applyMigrations(db: Database, migrationsDir: string) {
  if (skipMigrations) {
    console.warn('[db] skipping migrations for Cloudflare runtime; manage schema via Wrangler migrations instead.');
    return;
  }
  db.exec('CREATE TABLE IF NOT EXISTS __migrations (name TEXT PRIMARY KEY)');
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const found = db.prepare('SELECT 1 FROM __migrations WHERE name = ?').get(file) as { 1: number } | undefined;
    if (found) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    try {
      db.exec('BEGIN');
      db.exec(sql);
      db.prepare('INSERT INTO __migrations (name) VALUES (?)').run(file);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      const message = (err as Error).message || '';
      if (/duplicate column name/i.test(message)) {
        console.warn(`[db] migration ${file} skipped: ${message}`);
        db.prepare('INSERT OR IGNORE INTO __migrations (name) VALUES (?)').run(file);
        continue;
      }
      throw err;
    }
  }
}

export type DB = Database;
