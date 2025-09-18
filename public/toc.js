// Build a Table of Contents from h2/h3 in the article and render in the right sidebar
(() => {
  const qs = (sel, el=document) => el.querySelector(sel);
  const qsa = (sel, el=document) => Array.from(el.querySelectorAll(sel));

  function slugify(text, used) {
    let s = (text || '').toLowerCase().trim()
      .replace(/[^\p{Letter}\p{Number}]+/gu, '-').replace(/^-+|-+$/g, '');
    if (!s) s = 'section';
    let base = s, i = 1;
    while (used.has(s)) { s = `${base}-${i++}`; }
    used.add(s);
    return s;
  }

  function ensureHeadingIds(root) {
    const used = new Set(qsa('[id]').map(el => el.id));
    const heads = qsa('h2, h3', root);
    for (const h of heads) {
      if (!h.id) h.id = slugify(h.textContent, used);
    }
    return heads;
  }

  function renderToc(heads) {
    const card = qs('#toc-card');
    const toc = qs('#toc');
    if (!card || !toc) return;
    if (!heads.length) { card.style.display = 'none'; return; }

    const ul = document.createElement('ul');
    ul.className = 'toc-list';
    for (const h of heads) {
      const li = document.createElement('li');
      li.className = 'toc-item ' + (h.tagName.toLowerCase());
      if (h.tagName.toLowerCase() === 'h3') li.classList.add('toc-h3');
      const a = document.createElement('a');
      a.className = 'toc-link';
      a.href = `#${h.id}`;
      a.textContent = h.textContent || '';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', `#${h.id}`);
      });
      li.appendChild(a);
      ul.appendChild(li);
    }
    toc.innerHTML = '';
    toc.appendChild(ul);

    // Scroll spy
    const links = qsa('.toc-link', toc);
    const map = new Map(heads.map((h, i) => [h.id, links[i]]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const link = map.get(en.target.id);
        if (!link) return;
        if (en.isIntersecting) {
          links.forEach(l => l.classList.remove('active'));
          link.classList.add('active');
        }
      });
    }, { rootMargin: '-64px 0px -70% 0px', threshold: [0, 1] });
    heads.forEach(h => io.observe(h));
  }

  function init() {
    const content = qs('#post .content-body');
    if (!content) return;
    const heads = ensureHeadingIds(content);
    renderToc(heads);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();

