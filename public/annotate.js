// Minimal client for selection -> open comment input in sidebar and submit via API
(() => {
  const byId = (id) => document.getElementById(id);
  const qs = (sel, el=document) => el.querySelector(sel);
  const qsa = (sel, el=document) => Array.from(el.querySelectorAll(sel));

  function ensureSidebarOpen() {
    const sidebar = qs('#anno-sidebar') || qs('.sidebar-left') || qs('.sidebar');
    const backdrop = document.body.__sidebarBackdrop || (() => {
      const bd = document.createElement('div');
      bd.className = 'sidebar-backdrop';
      document.body.appendChild(bd);
      document.body.__sidebarBackdrop = bd;
      return bd;
    })();
    if (!sidebar) return;
    sidebar.classList.add('is-open');
    backdrop.classList.add('is-open');
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('is-open');
      backdrop.classList.remove('is-open');
    }, { once: true });
  }

  function mountCommentBar() {
    const root = byId('comments-root');
    if (!root) return null;
    if (root.__mounted) return root.__mounted;
    const wrap = document.createElement('div');
    wrap.className = 'comments';
    wrap.innerHTML = `
      <div class="comment-row" id="comment-row" style="display:none">
        <div class="comment-avatar" aria-hidden="true"></div>
        <div class="comment-box">
          <div style="display:flex; gap:8px; align-items:center;">
            <label for="comment-kind" class="sr-only">Kind</label>
            <select id="comment-kind" class="comment-kind">
              <option value="comment">Comment</option>
              <option value="question">Question</option>
              <option value="citation">Citation</option>
              <option value="critique">Critique</option>
              <option value="praise">Praise</option>
            </select>
            <div class="comment-quote" id="comment-quote" aria-live="polite"></div>
          </div>
          <textarea class="comment-input" id="comment-input" placeholder="Add a comment"></textarea>
          <div class="comment-actions">
            <button class="btn btn-ghost" id="comment-cancel" type="button">Cancel</button>
            <button class="btn btn-primary" id="comment-submit" type="button">Comment</button>
          </div>
        </div>
      </div>
      <ul class="anno-list" id="anno-list"></ul>
    `;
    root.appendChild(wrap);
    root.__mounted = {
      wrap,
      row: qs('#comment-row', wrap),
      quoteEl: qs('#comment-quote', wrap),
      input: qs('#comment-input', wrap),
      submit: qs('#comment-submit', wrap),
      cancel: qs('#comment-cancel', wrap),
      list: qs('#anno-list', wrap),
      kind: qs('#comment-kind', wrap)
    };
    return root.__mounted;
  }

  function getTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let n; while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
  }

  function textContentWithin(root) {
    return getTextNodes(root).map(n => n.textContent).join('');
  }

  function offsetWithin(root, node, nodeOffset) {
    let total = 0;
    for (const n of getTextNodes(root)) {
      if (n === node) return total + nodeOffset;
      total += n.textContent.length;
    }
    return total;
  }

  function serializeSelection(rootEl) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!rootEl.contains(range.startContainer) || !rootEl.contains(range.endContainer)) return null;
    if (range.collapsed) return null;
    const start = offsetWithin(rootEl, range.startContainer, range.startOffset);
    const end = offsetWithin(rootEl, range.endContainer, range.endOffset);
    const startPos = Math.min(start, end);
    const endPos = Math.max(start, end);
    const fullText = textContentWithin(rootEl);
    const exact = fullText.slice(startPos, endPos);
    const prefix = fullText.slice(Math.max(0, startPos - 30), startPos);
    const suffix = fullText.slice(endPos, Math.min(fullText.length, endPos + 30));
    const selectors = {
      type: 'Annotation',
      target: {
        source: location.pathname,
        selector: [
          { type: 'TextPositionSelector', start: startPos, end: endPos, unit: 'codepoint' },
          { type: 'TextQuoteSelector', exact, prefix, suffix }
        ]
      }
    };
    return { selectors, quote: exact };
  }

  async function submitAnnotation({ postSlug, bodyHtml, selectors, quote, kind }) {
    const idem = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(1);
    const res = await fetch('/api/annotations/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        post_slug: postSlug,
        display_name: null,
        body_html: bodyHtml,
        selectors,
        quote,
        kind,
        turnstile_token: 'ok',
        idempotency_key: idem
      })
    });
    if (!res.ok) throw new Error('Failed to create annotation');
    return res.json();
  }

  async function fetchAnnotations(postSlug) {
    const url = `/api/annotations/list?slug=${encodeURIComponent(postSlug)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    return res.json();
  }

  function renderList(ui, items) {
    ui.list.innerHTML = '';
    for (const it of items) {
      const li = document.createElement('li');
      li.className = 'anno-card';
      const kindBadge = it.kind ? `<span class="badge-kind badge-${it.kind}">${it.kind}</span>` : '';
      li.innerHTML = `
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          ${kindBadge}
          <div class="anno-quote">“${(it.quote || '').slice(0, 140)}${(it.quote || '').length > 140 ? '…' : ''}”</div>
        </div>
        <div class="anno-body">${it.body_html || ''}</div>
      `;
      ui.list.appendChild(li);
    }
  }

  function setupSelectionToComment() {
    const content = qs('#post .content-body');
    if (!content) return;
    const ui = mountCommentBar();
    if (!ui) return;

    async function loadList() {
      const postSlug = location.pathname.split('/').filter(Boolean).pop();
      const items = await fetchAnnotations(postSlug);
      renderList(ui, items);
    }

    function openForSelection() {
      const data = serializeSelection(content);
      if (!data || !data.quote || data.quote.trim().length < 1) return;
      ensureSidebarOpen();
      ui.row.style.display = '';
      ui.quoteEl.textContent = `“${data.quote.slice(0, 200)}${data.quote.length > 200 ? '…' : ''}”`;
      ui.input.focus();

      const cleanup = () => {
        ui.input.value = '';
        ui.row.style.display = 'none';
        document.removeEventListener('keydown', onEsc);
      };
      const onEsc = (e) => { if (e.key === 'Escape') cleanup(); };
      document.addEventListener('keydown', onEsc);

      ui.cancel.onclick = () => cleanup();
      ui.submit.onclick = async () => {
        const html = ui.input.value.trim();
        if (!html) return;
        ui.submit.disabled = true;
        try {
          const postSlug = location.pathname.split('/').filter(Boolean).pop();
          const kind = ui.kind?.value || 'comment';
          await submitAnnotation({ postSlug, bodyHtml: html, selectors: data.selectors, quote: data.quote, kind });
          cleanup();
          await loadList();
        } catch (e) {
          console.error(e);
        } finally {
          ui.submit.disabled = false;
        }
      };
    }

    // Trigger on mouse drag selection (mouseup) within post content
    content.addEventListener('mouseup', () => {
      // Delay to allow selection to settle
      setTimeout(openForSelection, 0);
    });

    // Initial list
    loadList().catch(() => {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSelectionToComment);
  } else {
    setupSelectionToComment();
  }
})();
