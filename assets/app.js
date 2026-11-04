/* ============================================================
   SHAMSI web menu
   сайдбар слева + показывается только текущий раздел
   данные: assets/menu-data.js (window.MENU_DATA)
   ============================================================ */
(function () {
  'use strict';

  const DATA = window.MENU_DATA || { categories: [] };
  const CATS = DATA.categories || [];
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => new Intl.NumberFormat('ru-RU').format(n);
  const pad2 = (n) => String(n).padStart(2, '0');

  $('#year').textContent = new Date().getFullYear();

  const sidebarNav = $('#sidebarNav');
  const chipsTrack = $('#chipsTrack');
  const content = $('#content');

  /* ---------- цена ---------- */
  const priceHtml = (prices) =>
    (prices || [])
      .map(
        (p) =>
          `<span class="price">${p.label ? `<span class="price__label">${esc(p.label)}</span>` : ''}` +
          `<span class="price__value">${fmt(p.value)}<small>₽</small></span></span>`
      )
      .join('');

  /* ---------- навигация: сайдбар + чипы ---------- */
  CATS.forEach((cat, i) => {
    const btn = document.createElement('button');
    btn.className = 'nav-item';
    btn.type = 'button';
    btn.dataset.slug = cat.id;
    btn.innerHTML = `<span class="nav-item__num">${pad2(i + 1)}</span>
      <span class="nav-item__name">${esc(cat.name)}</span>
      <span class="nav-item__count">${cat.items.length}</span>`;
    sidebarNav.appendChild(btn);

    const chip = document.createElement('a');
    chip.className = 'chip';
    chip.href = '#/' + cat.id;
    chip.dataset.slug = cat.id;
    chip.textContent = cat.name;
    chipsTrack.appendChild(chip);
  });

  /* ---------- карточка позиции ---------- */
  const cardHtml = (item) => {
    const media = item.photo
      ? `<img src="assets/photos/${esc(item.photo)}.jpg" alt="${esc(item.name)}" width="800" height="800" loading="lazy" decoding="async">`
      : `<div class="card__placeholder" aria-hidden="true">${esc(item.name.slice(0, 1).toUpperCase())}</div>`;
    return `<article class="card">
      <div class="card__media">${media}</div>
      <div class="card__body">
        <h3 class="card__name">${esc(item.name)}</h3>
        <div class="card__prices">${priceHtml(item.prices)}</div>
      </div>
    </article>`;
  };

  /* ---------- отрисовка раздела ---------- */
  let current = null;

  function render(slug, opts) {
    const idx = Math.max(0, CATS.findIndex((c) => c.id === slug));
    const cat = CATS[idx];
    if (!cat) return;
    const prev = CATS[idx - 1];
    const next = CATS[idx + 1];

    content.innerHTML = `
      <header class="cat-head">
        <div>
          <span class="cat-head__num">${pad2(idx + 1)} / ${pad2(CATS.length)}</span>
          <h1 class="cat-head__title">${esc(cat.name)}</h1>
        </div>
        <span class="cat-head__count">${cat.items.length} ${plural(cat.items.length)}</span>
      </header>
      <div class="grid">${cat.items.map(cardHtml).join('')}</div>
      <nav class="pager" aria-label="Соседние разделы">
        ${prev ? `<button class="pager__btn" data-go="${esc(prev.id)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6l-6 6 6 6"/></svg>
            <span>${esc(prev.name)}</span></button>` : '<span></span>'}
        ${next ? `<button class="pager__btn" data-go="${esc(next.id)}">
            <span>${esc(next.name)}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6l6 6-6 6"/></svg></button>` : '<span></span>'}
      </nav>`;

    // состояние навигации
    $$('.nav-item').forEach((b) => b.classList.toggle('is-active', b.dataset.slug === cat.id));
    $$('.chip').forEach((c) => c.classList.toggle('is-active', c.dataset.slug === cat.id));

    current = cat.id;
    document.title = cat.name + ' — SHAMSI';

    if (opts && opts.scroll !== false) window.scrollTo({ top: 0, behavior: 'smooth' });

    // активный чип — в центр ленты
    const chip = $$('.chip').find((c) => c.dataset.slug === cat.id);
    if (chip && chipsTrack.offsetParent !== null) {
      const left = chip.offsetLeft - chipsTrack.clientWidth / 2 + chip.clientWidth / 2;
      chipsTrack.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    }
  }

  const plural = (n) => {
    const m = n % 10, h = n % 100;
    if (m === 1 && h !== 11) return 'позиция';
    if (m >= 2 && m <= 4 && (h < 12 || h > 14)) return 'позиции';
    return 'позиций';
  };

  /* ---------- маршрутизация через hash ---------- */
  const slugFromHash = () => (location.hash.replace(/^#\/?/, '') || CATS[0].id);

  function goto(slug, push) {
    if (push) location.hash = '#/' + slug;
    else render(slug);
  }

  sidebarNav.addEventListener('click', (e) => {
    const b = e.target.closest('[data-slug]');
    if (b) goto(b.dataset.slug, true);
  });

  content.addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (b) goto(b.dataset.go, true);
  });

  window.addEventListener('hashchange', () => render(slugFromHash()));

  /* ---------- поиск ---------- */
  const searchSheet = $('#searchSheet');
  const searchInput = $('#searchInput');
  const searchResults = $('#searchResults');

  const index = [];
  CATS.forEach((cat) => cat.items.forEach((it) => index.push({ cat: cat.name, catId: cat.id, name: it.name, prices: it.prices })));

  const summarize = (prices) => {
    const vals = (prices || []).map((p) => p.value);
    if (!vals.length) return '';
    return Math.min.apply(null, vals) === Math.max.apply(null, vals)
      ? fmt(vals[0]) + ' ₽'
      : fmt(Math.min.apply(null, vals)) + '–' + fmt(Math.max.apply(null, vals)) + ' ₽';
  };

  function renderResults(q) {
    const query = q.trim().toLowerCase();
    const rows = !query ? index.slice(0, 9) : index.filter((it) => it.name.toLowerCase().includes(query) || it.cat.toLowerCase().includes(query));
    if (!rows.length) {
      searchResults.innerHTML = '<p class="sr-empty">ничего не нашлось — спросите бариста</p>';
      return;
    }
    let lastCat = null, html = '';
    rows.slice(0, 40).forEach((it) => {
      if (it.cat !== lastCat) { html += `<p class="sr-cat">${esc(it.cat)}</p>`; lastCat = it.cat; }
      html += `<button class="sr-item" data-jump="${esc(it.catId)}">
        <span class="sr-item__name">${esc(it.name)}</span>
        <span class="sr-item__price">${summarize(it.prices)}</span></button>`;
    });
    searchResults.innerHTML = html;
  }

  const openSearch = () => {
    searchSheet.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => searchInput.focus(), 60);
    renderResults('');
  };
  const closeSheets = () => {
    searchSheet.hidden = true;
    qrSheet.hidden = true;
    document.body.style.overflow = '';
  };

  $('#searchBtn').addEventListener('click', openSearch);
  searchInput.addEventListener('input', (e) => renderResults(e.target.value));
  searchResults.addEventListener('click', (e) => {
    const b = e.target.closest('[data-jump]');
    if (!b) return;
    closeSheets();
    goto(b.dataset.jump, true);
  });

  /* ---------- QR ---------- */
  const qrSheet = $('#qrSheet');
  const qrFrame = $('#qrFrame');
  const qrUrl = $('#qrUrl');
  const menuUrl = location.origin + location.pathname;

  const LOADERS = [
    'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js',
    'https://unpkg.com/qrcode-generator@1.4.4/qrcode.js'
  ];

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function qrSvg(url) {
    const qr = window.qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    const svg = qr.createSvgTag({ cellSize: 8, margin: 0, scalable: true });
    return svg.replace(/fill="#000000"/g, 'fill="#0b1712"').replace(/fill="#000"/g, 'fill="#0b1712"');
  }

  async function drawQr() {
    qrFrame.innerHTML = '<div class="qr__spinner">готовим код…</div>';
    if (!window.qrcode) {
      for (const src of LOADERS) {
        try { await loadScript(src); if (window.qrcode) break; } catch (e) { /* следующий CDN */ }
      }
    }
    if (window.qrcode) {
      try { qrFrame.innerHTML = qrSvg(menuUrl); return; } catch (e) { /* резерв ниже */ }
    }
    qrFrame.innerHTML =
      '<img alt="QR-код меню" src="https://api.qrserver.com/v1/create-qr-code/?size=560x560&margin=8&data=' +
      encodeURIComponent(menuUrl) + '">';
  }

  $('#qrBtn').addEventListener('click', () => {
    qrUrl.textContent = menuUrl.replace(/^https?:\/\//, '');
    qrSheet.hidden = false;
    document.body.style.overflow = 'hidden';
    if (!qrFrame.dataset.ready) { drawQr(); qrFrame.dataset.ready = '1'; }
  });

  $('#copyLink').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    try {
      await navigator.clipboard.writeText(menuUrl);
      const t = btn.textContent;
      btn.textContent = 'Скопировано';
      setTimeout(() => (btn.textContent = t), 1600);
    } catch (err) { qrUrl.textContent = menuUrl; }
  });

  $('#printQr').addEventListener('click', () => window.print());

  /* ---------- закрытие модалок / хоткеи ---------- */
  $$('[data-close]').forEach((el) => el.addEventListener('click', closeSheets));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSheets();
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); openSearch(); }
    if (searchSheet.hidden && qrSheet.hidden) {
      const i = CATS.findIndex((c) => c.id === current);
      if (e.key === 'ArrowRight' && CATS[i + 1]) goto(CATS[i + 1].id, true);
      if (e.key === 'ArrowLeft' && CATS[i - 1]) goto(CATS[i - 1].id, true);
    }
  });

  /* ---------- старт ---------- */
  render(slugFromHash(), { scroll: false });
})();
