export function siteHeader(): string {
  return `
    <header class="site-header">
      <a class="skip-link" href="#main">Skip to content</a>
      <div class="brand">
        <div class="logo" aria-hidden="true">RA</div>
        <div class="title">Read + Annotate</div>
      </div>
      <nav class="primary-nav" aria-label="Primary">
        <a href="/">Feed</a>
        <a href="/posts/hello-world">Demo post</a>
        <a href="/api/annotations/list?slug=hello-world">API</a>
      </nav>
      <div class="search"><input placeholder="Search articles" aria-label="Search articles" /></div>
      <div class="actions">
        <button class="btn btn-ghost theme-toggle" type="button" data-theme-toggle="true">Toggle theme</button>
        <a class="btn btn-primary" href="#comment-row">Add annotation</a>
      </div>
    </header>
  `;
}

export function renderShell(opts: { title: string; main: string; head?: string; scripts?: string[] }): string {
  const headExtra = opts.head ? opts.head : '';
  const scriptList = ['/ui.js', ...(opts.scripts ?? [])];
  const scripts = scriptList.map(src => `<script type="module" src="${src}"></script>`).join('\n');
  return `<!doctype html><html><head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${opts.title}</title>
    <link rel="stylesheet" href="/styles/style.css" />
    ${headExtra}
  </head>
  <body class="app-shell">
    ${siteHeader()}
    ${opts.main}
    ${scripts}
  </body></html>`;
}
