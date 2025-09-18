(() => {
  const root = document.documentElement;
  const storageKey = 'read-annotate-theme';

  function persistTheme(theme) {
    try {
      if (theme === null) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, theme);
      }
    } catch {
      /* ignore */
    }
  }

  function applyTheme(theme) {
    if (theme === 'light' || theme === 'dark') {
      root.dataset.theme = theme;
      persistTheme(theme);
    } else {
      root.removeAttribute('data-theme');
      persistTheme(null);
    }
  }

  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'light' || saved === 'dark') {
      applyTheme(saved);
    }
  } catch {
    /* localStorage unavailable */
  }

  const themeToggle = document.querySelector('[data-theme-toggle]');
  if (themeToggle) {
    themeToggle.setAttribute('aria-pressed', root.dataset.theme === 'dark' ? 'true' : 'false');
    themeToggle.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      themeToggle.setAttribute('aria-pressed', next === 'dark' ? 'true' : 'false');
    });
  }

  const triggers = document.querySelectorAll('[data-scroll-trigger]');
  triggers.forEach((el) => {
    el.addEventListener('click', () => {
      const targetSel = el.getAttribute('data-scroll-trigger');
      if (!targetSel) return;
      const target = document.querySelector(targetSel);
      if (target?.scrollIntoView) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
})();
