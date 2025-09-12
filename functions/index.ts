import type { Env } from '../src/lib/types.js';

function page(body: string): string {
  return `<!doctype html><html><head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Articles</title>
    <link rel="stylesheet" href="/styles/style.css" />
  </head><body>
    <header class="site-header">
      <div class="brand"><div class="logo" aria-hidden="true"></div><div class="title">Read + Anno</div></div>
      <div class="search"><input placeholder="Search articles" /></div>
      <div class="actions"></div>
    </header>
    ${body}
  </body></html>`;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const rows = await env.DB.prepare(`SELECT slug, html, published_at FROM posts ORDER BY COALESCE(published_at, '1970-01-01') DESC, id DESC LIMIT 200`).all<{ slug: string; html: string; published_at: string | null }>();
    const items = rows.results?.map(r => {
      const m = String(r.html || '').match(/<h1[^>]*>(.*?)<\/h1>/i);
      const title = (m?.[1] || r.slug).replace(/<[^>]+>/g, '');
      const date = r.published_at || '';
      return `<article class="content-card" style="margin:16px 0"><div class="content-body"><h2 style=\"margin:0 0 6px\"><a href=\"/posts/${r.slug}\" style=\"color:inherit;text-decoration:none\">${title}</a></h2><div style=\"font-size:13px;opacity:.8\">${date}</div></div></article>`;
    }).join('') || '';
    const body = `<main class="layout"><div></div><section class="post"><h1>記事一覧</h1>${items}</section><aside class="sidebar"><div class="side-card"><div class="title">About</div><div style="font-size:14px;opacity:.85">Welcome. Select text to annotate.</div></div></aside></main>`;
    return new Response(page(body), { headers: { 'content-type': 'text/html; charset=utf-8' } });
  } catch (e) {
    return new Response('Internal Error', { status: 500 });
  }
};

