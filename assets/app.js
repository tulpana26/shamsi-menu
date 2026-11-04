/* ============================================================
   SHAMSI web menu — rendering, scrollspy, search, QR
   данные: assets/menu-data.js (window.MENU_DATA)
   ============================================================ */
(function () {
  'use strict';

  const DATA = window.MENU_DATA || { categories: [] };
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => new Intl.NumberFormat('ru-RU').format(n);

  $('#year').textContent = new Date().getFullYear();

  /* ---------------- render menu ---------------- */
  const menuEl = $('#menu');
  const railTrack = $('#railTrack');
  const pad2 = (n) => String(n).padStart(2, '0');

  const priceHtml = (prices) =>
    prices
      .map(
        (p) =>
          `<span class="price">${p.label ? `<span class="price__label">${esc(p.label)}</span>` : ''}` +
          `<span class="price__value">${fmt(p.value)}<small>₽</small></span></span>`
      )
      .join('');

  DATA.categories.forEach((cat, i) => {
    const section = document.createElement('section');
    section.className = 'section';
    section.id = cat.id;
    section.innerHTML = `
      <div class="section__head">
        <span class="section__num">${pad2(i + 1)}</span>
        <div>
          <h2 class="section__title">${esc(cat.name)}</h2>
          ${cat.note ? `<p class="section__note">${esc(cat.note)}</p>` : ''}
        </div>
      </div>
      <div class="section__rule"></div>
      <ul class="items">
        ${cat.items
          .map(
            (it) => `
          <li class="item">
            <span class="item__name">${esc(it.name)}</span>
            <span class="item__prices">${priceHtml(it.prices)}</span>
          </li>`
          )
          .join('')}
      </ul>`;
    menuEl.appendChild(section);

    const chip = document.createElement('a');
    chip.className = 'chip';
    chip.href = '#' + cat.id;
    chip.textContent = cat.name;
    chip.dataset.target = cat.id;
    railTrack.appendChild(chip);
  });

  /* ---------------- reveal on scroll ---------------- */
  const revealIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          revealIO.unobserve(e.target);
        }
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
  );
  $$('.item').forEach((el, i) => {
    el.style.transitionDelay = (i % 6) * 45 + 'ms';
    revealIO.observe(el);
  });

  /* ---------------- sticky bar + scrollspy ---------------- */
  const topbar = $('#topbar');
  const addStuck = () => topbar.classList.toggle('is-stuck', window.scrollY > 24);
  addStuck();
  window.addEventListener('scroll', addStuck, { passive: true });

  const chips = $$('.chip');
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const id = e.target.id;
        chips.forEach((c) => c.classList.toggle('is-active', c.dataset.target === id));
        const active = chips.find((c) => c.dataset.target === id);
        if (active) {
          const box = railTrack;
          const left = active.offsetLeft - box.clientWidth / 2 + active.clientWidth / 2;
          box.scrollTo({ left, behavior: 'smooth' });
        }
      });
    },
    { rootMargin: '-45% 0px -50% 0px' }
  );
  $$('.section').forEach((s) => spy.observe(s));

  /* ---------------- search ---------------- */
  const searchSheet = $('#searchSheet');
  const searchInput = $('#searchInput');
  const searchResults = $('#searchResults');
  let index = [];
  DATA.categories.forEach((cat) =>
    cat.items.forEach((it) =>
      index.push({ cat: cat.name, catId: cat.id, name: it.name, prices: it.prices })
    )
  );

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

  const summarize = (prices) => {
    const vals = prices.map((p) => p.value);
    return Math.min.apply(null, vals) === Math.max.apply(null, vals)
      ? fmt(vals[0]) + ' ₽'
      : fmt(Math.min.apply(null, vals)) + '–' + fmt(Math.max.apply(null, vals)) + ' ₽';
  };

  function renderResults(q) {
    const query = q.trim().toLowerCase();
    const rows = !query
      ? index.slice(0, 8)
      : index.filter((it) => it.name.toLowerCase().includes(query) || it.cat.toLowerCase().includes(query));
    if (!rows.length) {
      searchResults.innerHTML = '<p class="sr-empty">ничего не нашлось — спросите бариста</p>';
      return;
    }
    let lastCat = null;
    let html = '';
    rows.slice(0, 40).forEach((it) => {
      if (it.cat !== lastCat) {
        html += `<p class="sr-cat">${esc(it.cat)}</p>`;
        lastCat = it.cat;
      }
      html += `<button class="sr-item" data-jump="${esc(it.catId)}">
        <span class="sr-item__name">${esc(it.name)}</span>
        <span class="sr-item__price">${summarize(it.prices)}</span>
      </button>`;
    });
    searchResults.innerHTML = html;
  }

  $('#searchBtn').addEventListener('click', openSearch);
  searchInput.addEventListener('input', (e) => renderResults(e.target.value));
  searchResults.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-jump]');
    if (!btn) return;
    const id = btn.getAttribute('data-jump');
    closeSheets();
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------------- QR ---------------- */
  const qrSheet = $('#qrSheet');
  const qrFrame = $('#qrFrame');
  const qrUrl = $('#qrUrl');
  const menuUrl = location.origin + location.pathname;

  // QR рисуем через qrcode-generator (SVG — чёткий на печати), с двумя CDN
  // и резервным вариантом через картинку-сервис, если оба CDN недоступны.
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
    // qrcode-generator API: typeNumber 0 = авто, уровень коррекции M
    const qr = window.qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    return qr.createSvgTag({ cellSize: 8, margin: 0, scalable: true });
  }

  async function drawQr() {
    qrFrame.innerHTML = '<div class="qr__spinner">готовим код…</div>';
    if (!window.qrcode) {
      for (const src of LOADERS) {
        try {
          await loadScript(src);
          if (window.qrcode) break;
        } catch (e) {
          /* следующий CDN */
        }
      }
    }
    if (window.qrcode) {
      try {
        qrFrame.innerHTML = qrSvg(menuUrl);
        return;
      } catch (e) {
        /* падаем в резервный вариант */
      }
    }
    // резерв: сервис картинок (тоже сканируется)
    qrFrame.innerHTML =
      '<img alt="QR-код меню" src="https://api.qrserver.com/v1/create-qr-code/?size=560x560&margin=8&data=' +
      encodeURIComponent(menuUrl) +
      '">';
  }

  $('#qrBtn').addEventListener('click', () => {
    qrUrl.textContent = menuUrl.replace(/^https?:\/\//, '');
    qrSheet.hidden = false;
    document.body.style.overflow = 'hidden';
    if (!qrFrame.dataset.ready) {
      drawQr();
      qrFrame.dataset.ready = '1';
    }
  });

  $('#copyLink').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    try {
      await navigator.clipboard.writeText(menuUrl);
      const t = btn.textContent;
      btn.textContent = 'Скопировано';
      setTimeout(() => (btn.textContent = t), 1600);
    } catch (err) {
      qrUrl.textContent = menuUrl;
    }
  });

  $('#printQr').addEventListener('click', () => window.print());

  /* ---------------- sheet closing ---------------- */
  $$('[data-close]').forEach((el) => el.addEventListener('click', closeSheets));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSheets();
    if (e.key === '/' && (document.activeElement.tagName !== 'INPUT')) {
      e.preventDefault();
      openSearch();
    }
  });
})();
