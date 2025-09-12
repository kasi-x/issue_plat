import type { Env } from '../../src/lib/types.js';

function htmlPage(title: string, bodyHtml: string): string {
  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${title}</title>
      <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'">
      <style>
        body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:72ch;margin:2rem auto;padding:0 1rem}
        .meta{color:#666;font-size:.9rem;margin-bottom:1rem}
      </style>
    </head>
    <body>
      <article>
        ${bodyHtml}
      </article>
    </body>
  </html>`;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, params, env } = context;
  const slug = String(params?.slug || '');
  if (!slug) return new Response('Not Found', { status: 404 });

  const cacheKey = new Request(new URL(request.url).toString(), { method: 'GET' });
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;

  try {
    const post = await env.DB.prepare(`SELECT html FROM posts WHERE slug = ?`).bind(slug).first<{ html: string }>();
    if (!post?.html) return new Response('Not Found', { status: 404 });

    const res = new Response(htmlPage(slug, post.html), {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        // Edge cache for 60s per spec
        'cache-control': 'public, max-age=0, s-maxage=60',
      },
    });
    // Populate cache asynchronously
    context.waitUntil(caches.default.put(cacheKey, res.clone()));
    return res;
  } catch (e) {
    return new Response('Internal Error', { status: 500 });
  }
};
