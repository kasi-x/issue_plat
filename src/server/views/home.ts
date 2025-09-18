import { renderShell } from './layout.js';

export type HomeItem = {
  slug: string;
  title: string;
  date: string;
  count: number;
  excerpt: string;
  readingMinutes: number;
};

export function renderHomePage(items: HomeItem[]): string {
  const totalAnnotations = items.reduce((sum, item) => sum + item.count, 0);
  const trending = [...items].sort((a, b) => b.count - a.count).slice(0, 3);
  const averageReading = items.length ? Math.round(items.reduce((sum, item) => sum + item.readingMinutes, 0) / items.length) : 0;
  const list = items.map((i, idx) => {
    const annotationLabel = i.count === 1 ? 'annotation' : 'annotations';
    return `
      <article class="feed-card content-card" aria-label="${i.title} summary" data-annotations="${i.count}">
        <header class="feed-card__header">
          <div class="feed-rank">${String(idx + 1).padStart(2, '0')}</div>
          <div class="feed-card__meta">
            <span class="feed-card__date">${i.date || 'Draft'}</span>
            <span aria-hidden="true">•</span>
            <span class="feed-card__reading">${i.readingMinutes} min read</span>
          </div>
          <button class="bookmark-btn" type="button" aria-label="Save ${i.title}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </button>
        </header>
        <div class="content-body">
          <h2 class="feed-title"><a href="/posts/${i.slug}">${i.title}</a></h2>
          <p class="feed-excerpt">${i.excerpt}</p>
        </div>
        <footer class="feed-card__footer">
          <div class="feed-card__stats" role="list" aria-label="Engagement stats">
            <span role="listitem" class="feed-chip feed-chip--count">
              ${i.count} ${annotationLabel}
            </span>
            <span role="listitem" class="feed-chip feed-chip--insight">
              ${i.readingMinutes} min journey
            </span>
          </div>
          <a class="btn btn-ghost" href="/posts/${i.slug}">Continue reading</a>
        </footer>
      </article>
    `;
  }).join('\n');

  const hero = `
    <section class="hero content-card">
      <div class="hero__copy">
        <p class="hero__eyebrow">Collaborative reading</p>
        <h1 class="hero__title">Annotate articles, surface context, and learn together.</h1>
        <p class="hero__lead">Select any passage to leave an annotation, question, or citation. The community can respond in-line so discussions always stay grounded.</p>
        <div class="hero__actions">
          <a class="btn btn-primary" href="${items.length ? `/posts/${items[0].slug}` : '#'}#comment-row">Start annotating</a>
          <button class="btn btn-ghost" type="button" data-scroll-trigger="#feed">Browse latest</button>
        </div>
      </div>
      <div class="hero__stats" aria-label="Annotation stats">
        <div class="stat-card">
          <span class="stat-card__label">Active annotations</span>
          <span class="stat-card__value">${totalAnnotations}</span>
          <span class="stat-card__hint">across ${items.length || 0} posts</span>
        </div>
        <div class="stat-card">
          <span class="stat-card__label">Avg. reading time</span>
          <span class="stat-card__value">${averageReading || 1} min</span>
          <span class="stat-card__hint">per featured article</span>
        </div>
        <div class="stat-card">
          <span class="stat-card__label">Top discussion</span>
          <span class="stat-card__value">${trending[0] ? trending[0].count : 0}</span>
          <span class="stat-card__hint">notes on “${trending[0] ? trending[0].title : '—'}”</span>
        </div>
      </div>
    </section>
  `;

  const trendingList = trending.map(t => `
    <li>
      <a href="/posts/${t.slug}">
        <span class="badge-kind badge-${t.count > 4 ? 'critique' : 'comment'}" aria-hidden="true">${t.count}</span>
        <span class="trend-title">${t.title}</span>
      </a>
    </li>
  `).join('');

  const main = `
    <main id="main" class="layout">
      <aside class="left-rail" aria-label="Quick actions">
        <div class="rail-box">
          <button class="rail-btn" type="button" data-scroll-trigger="#feed" aria-label="Jump to feed">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18M5 12h14M8 19h8"/></svg>
          </button>
          <a class="rail-btn" href="${items.length ? `/posts/${items[0].slug}` : '#comment-row'}" aria-label="Open latest post">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3h14a2 2 0 0 1 2 2v14l-5-3-5 3-5-3-5 3V5a2 2 0 0 1 2-2z"/></svg>
          </a>
        </div>
        <div class="left-rail-card">
          <h3>Filters</h3>
          <ul class="rail-links">
            <li><button type="button" class="rail-link" data-filter="recent">Recent</button></li>
            <li><button type="button" class="rail-link" data-filter="annotated">Most annotated</button></li>
            <li><button type="button" class="rail-link" data-filter="short">Quick reads</button></li>
          </ul>
        </div>
      </aside>
      <section class="post feed-column">
        ${hero}
        <div class="feed-toolbar" id="feed" aria-label="Feed controls">
          <div class="feed-toolbar__group">
            <button class="btn btn-ghost" type="button">Timeline</button>
            <button class="btn btn-ghost" type="button">Topics</button>
            <button class="btn btn-ghost" type="button">Collections</button>
          </div>
          <div class="feed-toolbar__summary">${totalAnnotations} annotations logged this week</div>
        </div>
        <div class="feed-grid">
          ${list}
        </div>
      </section>
      <aside class="sidebar sidebar-right">
        <div class="side-card highlight-card">
          <div class="title">Why annotate?</div>
          <p>Keep your insights tethered to the sentences that inspired them. Invite teammates to review citations, critiques, and follow-up ideas in context.</p>
          <ul class="checklist">
            <li>Inline conversations without email threads</li>
            <li>Auto-sanitized HTML to keep notes safe</li>
            <li>Moderation tools for public spaces</li>
          </ul>
        </div>
        <div class="side-card">
          <div class="title">Trending discussions</div>
          <ul class="trend-list">${trendingList || '<li>No annotations yet.</li>'}</ul>
        </div>
        <div class="side-card newsletter-card">
          <div class="title">Weekly digest</div>
          <p>Receive the most annotated articles and standout replies.</p>
          <form class="newsletter-form">
            <label class="sr-only" for="newsletter-email">Email</label>
            <input id="newsletter-email" type="email" name="email" placeholder="you@example.com" required />
            <button class="btn btn-primary" type="submit">Subscribe</button>
          </form>
        </div>
      </aside>
    </main>
  `;

  return renderShell({ title: 'Articles', main });
}
