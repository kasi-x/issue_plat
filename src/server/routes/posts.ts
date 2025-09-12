import express from 'express';
import type Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { makeDbHelpers } from '../utils.js';

export function createPostsRouter(db: Database) {
  const r = express.Router();
  const { first, run, select } = makeDbHelpers(db);

  // Note: API upsert route is defined in posts-api router

  // Top page
  r.get('/', (_req, res) => {
    try {
      const rows = select<{ slug: string; html: string; published_at: string | null }>(
        `SELECT slug, html, published_at FROM posts ORDER BY COALESCE(published_at, '1970-01-01') DESC, id DESC LIMIT 200`
      );
      const items = rows.map(rw => {
        const m = rw.html.match(/<h1[^>]*>(.*?)<\/h1>/i);
        const title = (m?.[1] || rw.slug).replace(/<[^>]+>/g, '');
        const date = rw.published_at || '';
        return { slug: rw.slug, title, date };
      });
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.send(`<!doctype html><html><head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Articles</title>
        <link rel="stylesheet" href="/styles/style.css" />
      </head>
      <body>
        <header class="site-header">
          <div class="brand"><div class="logo" aria-hidden="true"></div><div class="title">Read + Anno</div></div>
          <div class="search"><input placeholder="Search articles" /></div>
          <div class="actions"></div>
        </header>
        <main class="layout">
          <div></div>
          <section class="post">
            <h1>記事一覧</h1>
            ${items.map(i => `
              <article class="content-card" style="margin:16px 0">
                <div class="content-body">
                  <h2 style="margin:0 0 6px"><a href="/posts/${i.slug}" style="color:inherit;text-decoration:none">${i.title}</a></h2>
                  <div style="font-size:13px;opacity:.8">${i.date || ''}</div>
                </div>
              </article>`).join('')}
          </section>
          <aside class="sidebar">
            <div class="side-card"><div class="title">About</div><div style="font-size:14px;opacity:.85">Welcome. Select any text in articles to annotate.</div></div>
          </aside>
        </main>
      </body></html>`);
    } catch (e) { return res.status(500).send('Internal Error'); }
  });

  // Post page SSR
  r.get('/posts/:slug', (req, res) => {
    const slug = req.params.slug;
    try {
      const post = first<{ html: string }>('SELECT html FROM posts WHERE slug = ?', [slug]);
      if (!post?.html) return res.status(404).send('Not Found');
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.send(`<!doctype html><html><head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${slug}</title>
        <link rel="stylesheet" href="/styles/style.css" />
      </head>
      <body>
        <header class="site-header">
          <div class="brand"><div class="logo" aria-hidden="true"></div><div class="title">Read + Anno</div></div>
          <div class="search"><input placeholder="Search articles" /></div>
          <div class="actions"></div>
        </header>
        <main class="layout">
          <div class="left-rail"></div>
          <article id="post" class="post content-card">
            <h1>${slug}</h1>
            <div class="content-body">${post.html}</div>
          </article>
          <aside class="sidebar"><div id="comments-root"></div></aside>
        </main>
        <script type="module" src="/assets/app.js"></script>
      </body></html>`);
    } catch { return res.status(500).send('Internal Error'); }
  });

  // Static alias for latest assets
  r.get('/assets/app.js', (_req, res) => {
    try {
      const dir = path.resolve('public/assets');
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort((a, b) => {
        const sa = fs.statSync(path.join(dir, a)).mtimeMs;
        const sb = fs.statSync(path.join(dir, b)).mtimeMs;
        return sb - sa;
      });
      if (files.length === 0) return res.status(404).send('Not Found');
      res.type('application/javascript');
      fs.createReadStream(path.join(dir, files[0])).pipe(res);
    } catch {
      res.status(404).send('Not Found');
    }
  });

  return r;
}
