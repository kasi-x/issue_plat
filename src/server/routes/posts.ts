import express from 'express';
import type Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { makeDbHelpers } from '../utils.js';
import { renderHomePage } from '../views/home.js';
import { renderPostPage } from '../views/post.js';

export function createPostsRouter(db: Database) {
  const r = express.Router();
  const { first, run, select } = makeDbHelpers(db);

  // Note: API upsert route is defined in posts-api router

  // Top page
  r.get('/', (_req, res) => {
    try {
      const rows = select<{ slug: string; html: string; plain_text: string | null; published_at: string | null; annoCount: number }>(
        `SELECT p.slug, p.html, p.plain_text, p.published_at, COUNT(a.id) AS annoCount
         FROM posts p
         LEFT JOIN annotations a ON a.post_id = p.id AND a.state = 'published'
         GROUP BY p.id
         ORDER BY COALESCE(p.published_at, '1970-01-01') DESC, p.id DESC
         LIMIT 200`
      );
      const items = rows.map(rw => {
        const m = rw.html.match(/<h1[^>]*>(.*?)<\/h1>/i);
        const title = (m?.[1] || rw.slug).replace(/<[^>]+>/g, '');
        const date = rw.published_at || '';
        const text = (rw.plain_text || rw.html.replace(/<[^>]+>/g, ' '))
          .replace(/\s+/g, ' ')
          .trim();
        const excerpt = text.slice(0, 220) + (text.length > 220 ? '…' : '');
        const words = text ? text.split(/\s+/).length : 0;
        const readingMinutes = Math.max(1, Math.round(words / 225));
        return {
          slug: rw.slug,
          title,
          date,
          count: Number(rw.annoCount || 0),
          excerpt,
          readingMinutes,
        };
      });
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.send(renderHomePage(items));
    } catch (e) { return res.status(500).send('Internal Error'); }
  });

  // Post page SSR
  r.get('/posts/:slug', (req, res) => {
    const slug = req.params.slug;
    try {
      const post = first<{
        html: string;
        plain_text: string | null;
        published_at: string | null;
        anno_count: number;
      }>(
        `SELECT p.html, p.plain_text, p.published_at,
          (
            SELECT COUNT(1)
            FROM annotations a
            WHERE a.post_id = p.id AND a.state = 'published'
          ) AS anno_count
         FROM posts p
         WHERE slug = ?`,
        [slug]
      );
      if (!post?.html) return res.status(404).send('Not Found');

      const headingMatch = post.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const title = headingMatch ? headingMatch[1].replace(/<[^>]+>/g, '').trim() : slug;
      const bodyHtml = headingMatch ? post.html.replace(headingMatch[0], '') : post.html;
      const plain = post.plain_text || bodyHtml.replace(/<[^>]+>/g, ' ');
      const words = plain ? plain.trim().split(/\s+/).length : 0;
      const readingMinutes = Math.max(1, Math.round(words / 225));

      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.send(
        renderPostPage({
          slug,
          title,
          html: bodyHtml,
          publishedAt: post.published_at || undefined,
          annotationCount: Number(post.anno_count || 0),
          readingMinutes,
        })
      );
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
