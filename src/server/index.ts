import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { openDb, applyMigrations } from './db.js';
import { getRuntimeTarget, isDockerRuntime } from '../lib/runtime.js';
import { createAnnotationsRouter } from './routes/annotations.js';
import { createModRouter } from './routes/mod.js';
import { createPostsRouter } from './routes/posts.js';
import { createPostsApiRouter } from './routes/posts-api.js';

const runtimeTarget = getRuntimeTarget();
const PORT = Number(process.env.PORT || 8788);
const ORIGIN_HOST = process.env.ORIGIN_HOST || `localhost:${PORT}`;
const defaultDbPath = (() => {
  if (isDockerRuntime(runtimeTarget)) return path.resolve('data/docker/app.db');
  return path.resolve('data/app.db');
})();
const DB_PATH = process.env.DB_PATH || defaultDbPath;

console.log(`[local] runtime target=${runtimeTarget} db=${DB_PATH}`);
const SALT = process.env.SALT_IP_HASH || 'dev-salt';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// Static assets early
app.use('/styles', express.static('public/styles'));
app.use('/assets', express.static('public/assets'));

// DB setup
const db = openDb(DB_PATH);
applyMigrations(db, path.resolve('migrations'));

// API routes
app.use('/api/annotations', createAnnotationsRouter(db, { originHost: ORIGIN_HOST, salt: SALT }));
app.use('/api/mod', createModRouter(db));
app.use('/api/posts', createPostsApiRouter(db));

// Pages (home and posts)
app.use('/', createPostsRouter(db));

app.listen(PORT, () => {
  console.log(`[local] server listening on http://localhost:${PORT}`);
});

// Keep generic static serving last, so dynamic routes like /posts/:slug win
app.use(express.static('public'));
