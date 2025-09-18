import express from 'express';
import type Database from 'better-sqlite3';
import { makeDbHelpers } from '../utils.js';
import { sanitizeHtml } from '../../lib/sanitizer.js';

export function createModRouter(db: Database) {
  const r = express.Router();
  const { select, run, first } = makeDbHelpers(db);

  r.get('/list', (_req, res) => {
    try { return res.json(select(`SELECT * FROM annotations WHERE state = 'pending' ORDER BY created_at ASC LIMIT 200`)); }
    catch (e: any) { return res.status(500).json({ error: 'internal_error', message: e.message }); }
  });

  r.post('/update', (req, res) => {
    const { id, state } = req.body as { id: number; state: 'published'|'rejected' };
    if (!id || !['published','rejected'].includes(state as any)) return res.status(400).json({ error: 'invalid_input' });
    try { run('UPDATE annotations SET state = ? WHERE id = ?', [state, id]); return res.json({ ok: true }); }
    catch (e: any) { return res.status(500).json({ error: 'internal_error', message: e.message }); }
  });

  // Seed example post and various annotations for demos
  r.post('/seed-examples', (req, res) => {
    try {
      const slug = (req.body?.slug as string) || 'hello-world';
      const html = `
        <h1>Hello, World</h1>
        <p>This is a sample post to demonstrate annotations. You can select any text and leave a comment.</p>
        <h2>Code</h2>
        <pre><code>const x = 42;\nfunction greet(name) {\n  return 'Hello ' + name;\n}</code></pre>
        <h2>Quote</h2>
        <blockquote>A great quote can change your day.</blockquote>
        <h2>List</h2>
        <ul>
          <li>First item</li>
          <li>Second item</li>
        </ul>
        <p>Inline <strong>bold text</strong> and <em>emphasis</em> also work.</p>
      `;
      // Plain text derivation for selector math
      const plain = html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|h\d)>/gi, '</$1>\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      const ex = first<{ id: number }>('SELECT id FROM posts WHERE slug = ?', [slug]);
      if (ex?.id) {
        run('UPDATE posts SET html = ?, plain_text = ?, published_at = COALESCE(published_at, datetime("now")) WHERE id = ?', [html, plain, ex.id]);
      } else {
        run('INSERT INTO posts (slug, html, plain_text, revision, content_hash, published_at) VALUES (?, ?, ?, 1, NULL, datetime("now"))', [slug, html, plain]);
      }
      const post = first<{ id: number }>('SELECT id FROM posts WHERE slug = ?', [slug]);
      if (!post?.id) return res.status(500).json({ error: 'internal_error', message: 'post not found after upsert' });

      function selectorFromQuote(q: string) {
        const idx = plain.indexOf(q);
        if (idx < 0) return null;
        const start = idx; const end = idx + q.length;
        return {
          type: 'Annotation',
          target: {
            source: `/posts/${slug}`,
            selector: [
              { type: 'TextPositionSelector', start, end, unit: 'codepoint' },
              { type: 'TextQuoteSelector', exact: q, prefix: plain.slice(Math.max(0, start - 30), start), suffix: plain.slice(end, Math.min(plain.length, end + 30)) }
            ]
          }
        } as const;
      }

      const toCreate: Array<{ q: string; body: string; name?: string; state?: string; parent?: number; kind?: string }>= [
        { q: 'sample post', body: 'Nice overview! I like this part.', kind: 'praise' },
        { q: 'const x = 42;', body: 'Nit: consider a more descriptive name.', name: 'Alice', kind: 'critique' },
        { q: 'A great quote', body: 'Indeed. Do you have a source?', kind: 'question' },
        { q: 'First item', body: 'Could you expand on this?', kind: 'question' },
        { q: 'bold text', body: 'Emphasis looks good here.', name: 'Bob', kind: 'comment' },
        { q: 'lambda', body: 'Reference: <a href="https://docs.aws.amazon.com/lambda/">AWS Lambda docs</a>', kind: 'citation' }
      ];

      const createdIds: number[] = [];
      for (const c of toCreate) {
        const env = selectorFromQuote(c.q);
        if (!env) continue;
        const info = db.prepare(
          `INSERT INTO annotations (post_id, display_name, body_html, selectors, quote, parent_id, state, visitor_id, ip_hash, signals, kind)
           VALUES (?, ?, ?, ?, ?, NULL, ?, NULL, NULL, ?, ?)`
        ).run(post.id, c.name ?? null, sanitizeHtml(c.body), JSON.stringify(env), c.q, c.state ?? 'published', JSON.stringify({ seed: true }), c.kind ?? 'comment');
        createdIds.push(Number(info.lastInsertRowid));
      }

      // Add a reply to the first annotation if any
      if (createdIds.length) {
        const parentId = createdIds[0];
        db.prepare(
          `INSERT INTO annotations (post_id, display_name, body_html, selectors, quote, parent_id, state, visitor_id, ip_hash, signals, kind)
           VALUES (?, ?, ?, ?, ?, ?, 'published', NULL, NULL, ?, ?)`
        ).run(post.id, 'Eve', sanitizeHtml('Replying to your point.'), JSON.stringify(selectorFromQuote('sample post')), 'sample post', parentId, JSON.stringify({ seed: true, reply: true }), 'comment');
      }

      return res.json({ ok: true, slug, post_id: post.id, created: createdIds.length, examples: toCreate.length });
    } catch (e: any) {
      return res.status(500).json({ error: 'internal_error', message: e.message });
    }
  });

  return r;
}
