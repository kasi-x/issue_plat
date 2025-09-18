import { renderShell } from './layout.js';

export function renderPostPage(opts: {
  slug: string;
  title: string;
  html: string;
  publishedAt?: string;
  annotationCount: number;
  readingMinutes: number;
}): string {
  const annotationLabel = opts.annotationCount === 1 ? 'annotation' : 'annotations';
  const main = `
    <main id="main" class="layout layout-post">
      <aside class="sidebar sidebar-left" aria-label="Post tools">
        <div class="side-card post-toolkit">
          <div class="title">Reading toolkit</div>
          <ul class="toolkit-list">
            <li><a href="#comments-root" class="toolkit-link">Open annotation panel</a></li>
            <li><a href="#comment-cta" class="toolkit-link">Jump to discussion prompts</a></li>
            <li><button class="toolkit-link" type="button" data-scroll-trigger="#toc">Scan headings</button></li>
          </ul>
        </div>
        <div class="side-card" id="toc-card">
          <div class="title">Table of Contents</div>
          <nav id="toc"></nav>
        </div>
      </aside>
      <article id="post" class="post content-card">
        <header class="post-hero">
          <p class="post-hero__eyebrow">Live discussion</p>
          <h1 class="post-hero__title">${opts.title}</h1>
          <div class="post-hero__meta">
            <span class="meta-author">Editorial team</span>
            <span aria-hidden="true">•</span>
            <span class="meta-date">${opts.publishedAt || 'Draft'}</span>
            <span aria-hidden="true">•</span>
            <span>${opts.readingMinutes} min read</span>
          </div>
          <div class="post-hero__stats" role="list" aria-label="Post stats">
            <span role="listitem" class="feed-chip feed-chip--count">${opts.annotationCount} ${annotationLabel}</span>
            <span role="listitem" class="feed-chip feed-chip--insight">${opts.readingMinutes} minute journey</span>
          </div>
        </header>
        <div class="content-body">
          ${opts.html}
          <section class="post-cta" id="comment-cta">
            <h2 class="post-cta__title">Ready to leave your mark?</h2>
            <p>Select a sentence to start annotating or open the panel to review existing notes.</p>
            <div class="post-cta__actions">
              <a class="btn btn-primary" href="#comments-root">Open annotations</a>
              <button class="btn btn-ghost" type="button" data-scroll-trigger="#toc">Back to top</button>
            </div>
          </section>
        </div>
      </article>
      <aside class="sidebar sidebar-right" id="anno-sidebar">
        <div class="anno-summary">
          <div class="anno-summary__title">Annotation stream</div>
          <p>${opts.annotationCount} ${annotationLabel} captured for this post.</p>
        </div>
        <div id="comments-root"></div>
      </aside>
    </main>
  `;

  return renderShell({
    title: opts.title || opts.slug,
    main,
    scripts: ['/assets/app.js', '/toc.js', '/annotate.js']
  });
}
