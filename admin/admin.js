/* ============================================================
   SHAMSI admin — редактирование меню и фото прямо в репозитории
   Пишет через GitHub API в tulpana26/shamsi-menu:
     assets/menu-data.js       — тексты и цены
     assets/photos/<slot>.jpg  — фото (800×667, 6:5)
   Токен хранится только в localStorage этого браузера.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- где мы и в какой репозиторий пишем ---------- */
  const host = location.hostname;                    // tulpana26.github.io
  const seg = location.pathname.split('/').filter(Boolean)[0] || '';
  const OWNER = host.endsWith('github.io') ? host.split('.')[0] : 'tulpana26';
  const REPO = host.endsWith('github.io') && seg ? seg : 'shamsi-menu';
  const BRANCH = 'main';
  const API = 'https://api.github.com';
  const DATA_PATH = 'assets/menu-data.js';
  const PHOTO_DIR = 'assets/photos';
  const PHOTO_W = 800, PHOTO_H = 667;               // родная пропорция фото 6:5
  const TOKEN_KEY = 'shamsi.admin.token';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  $('#repoLabel').textContent = OWNER + '/' + REPO;
  $('#siteLink').href = '../index.html';

  let token = localStorage.getItem(TOKEN_KEY) || '';
  let data = null;          // { brand, categories:[{id,name,items:[{name,desc,prices,photo}]}] }
  let dataSha = null;       // sha файла menu-data.js
  let activeCat = 0;
  let dirty = false;

  /* ---------- helpers ---------- */
  const toast = (msg, opts) => {
    const el = $('#toast');
    el.className = 'toast' + (opts && opts.error ? ' is-error' : '');
    el.innerHTML = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, opts && opts.sticky ? 20000 : 4200);
  };

  const b64encode = (bytes) => {
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  };
  const b64decode = (str) => {
    const bin = atob(str.replace(/\n/g, ''));
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  };

  async function api(path, options) {
    const opts = Object.assign({}, options);
    opts.headers = Object.assign({
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    }, opts.headers || {});
    const res = await fetch(API + path, opts);
    if (res.status === 204) return null;
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.message || ('HTTP ' + res.status));
      err.status = res.status;
      throw err;
    }
    return body;
  }

  /* ---------- вход ---------- */
  const gate = $('#gate'), app = $('#app');
  const gateMsg = $('#gateMsg');

  async function login(candidate) {
    token = candidate;
    gateMsg.textContent = 'Проверяем доступ…';
    gateMsg.className = 'gate__msg';
    try {
      const repo = await api(`/repos/${OWNER}/${REPO}`);
      if (!repo.permissions || !repo.permissions.push) {
        throw new Error('У токена нет права записи в этот репозиторий (нужно Contents: Read and write)');
      }
      localStorage.setItem(TOKEN_KEY, token);
      gate.hidden = true; app.hidden = false;
      $('#forgetBtn').hidden = false;
      await loadAll();
    } catch (e) {
      let m = e.message;
      if (e.status === 401) m = 'Токен не принят GitHub. Проверьте, что он скопирован целиком и не истёк.';
      if (e.status === 404) m = 'Токен не видит репозиторий ' + OWNER + '/' + REPO + '. Добавьте его в доступные этому токену репозитории.';
      gateMsg.textContent = m;
      gateMsg.className = 'gate__msg is-error';
    }
  }

  $('#loginBtn').addEventListener('click', () => {
    const v = $('#tokenInput').value.trim();
    if (!v) { gateMsg.textContent = 'Вставьте токен'; gateMsg.className = 'gate__msg is-error'; return; }
    login(v);
  });
  $('#tokenInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#loginBtn').click(); });
  $('#forgetBtn').addEventListener('click', () => {
    localStorage.removeItem(TOKEN_KEY); token = ''; location.reload();
  });

  /* ---------- чтение данных из репозитория ---------- */
  async function loadAll() {
    const file = await api(`/repos/${OWNER}/${REPO}/contents/${DATA_PATH}?ref=${BRANCH}`);
    dataSha = file.sha;
    const text = new TextDecoder().decode(b64decode(file.content));
    const json = text.replace(/^[\s\S]*?=\s*/, '').replace(/;\s*$/, '');
    data = JSON.parse(json);
    dirty = false;
    render();
  }

  /* ---------- отрисовка ---------- */
  const catNav = $('#catNav'), main = $('#main'), stats = $('#stats');

  function render() {
    catNav.innerHTML = data.categories
      .map((c, i) => `<button class="catbtn${i === activeCat ? ' is-active' : ''}" data-cat="${i}">
        <span>${esc(c.name)}</span><span class="catbtn__n">${c.items.length}</span></button>`)
      .join('');

    const noPhoto = data.categories.reduce((n, c) => n + c.items.filter((i) => !i.photo).length, 0);
    stats.innerHTML = `${data.categories.length} разделов · ${data.categories.reduce((n, c) => n + c.items.length, 0)} позиций` +
      (noPhoto ? ` · без фото: ${noPhoto}` : '');

    main.innerHTML = '';
    const cat = data.categories[activeCat];
    if (!cat) return;

    const head = document.createElement('div');
    head.className = 'head';
    head.innerHTML = `<h1 class="head__title">${esc(cat.name)}</h1>
      <span class="head__count">${cat.items.length} позиций</span>`;
    main.appendChild(head);

    const list = document.createElement('div');
    list.className = 'list';
    list.dataset.role = 'list';
    main.appendChild(list);

    cat.items.forEach((item, idx) => list.appendChild(itemNode(item, idx)));

    const add = document.createElement('button');
    add.className = 'btn btn--ghost';
    add.textContent = '+ Добавить позицию';
    add.style.marginTop = '18px';
    add.addEventListener('click', () => {
      const slug = nextSlot(cat);
      cat.items.push({ name: 'Новая позиция', desc: '', prices: [{ value: 0 }], photo: null, __slot: slug });
      markDirty();
      render();
      list.lastChild && list.lastChild.scrollIntoView({ block: 'center' });
    });
    main.appendChild(add);
  }

  const tpl = $('#itemTpl');

  function itemNode(item, idx) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    const img = $('img', node);
    const input = $('input[type=file]', node);
    const btn = $('.item__replace', node);

    if (item.photo) {
      img.src = `../assets/photos/${item.photo}.jpg?v=${Date.now()}`;
      img.alt = item.name;
      img.removeAttribute('data-empty');
    } else {
      img.setAttribute('data-empty', '1');
    }

    $('[data-f=name]', node).value = item.name || '';
    $('[data-f=desc]', node).value = item.desc || '';
    $('[data-f=name]', node).addEventListener('input', (e) => { item.name = e.target.value; markDirty(); });
    $('[data-f=desc]', node).addEventListener('input', (e) => { item.desc = e.target.value; markDirty(); });

    const pricesBox = $('[data-role=prices]', node);
    if (!item.prices || !item.prices.length) item.prices = [{ value: 0 }];
    item.prices.forEach((p, pi) => pricesBox.appendChild(priceRow(item, p, pi)));

    node.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'addprice') {
        item.prices.push({ label: '', value: 0 });
        pricesBox.appendChild(priceRow(item, item.prices[item.prices.length - 1], item.prices.length - 1));
        markDirty();
      }
      if (act.dataset.act === 'remove') {
        if (!confirm('Удалить «' + (item.name || 'позицию') + '»?')) return;
        const cat = data.categories[activeCat];
        cat.items.splice(cat.items.indexOf(item), 1);
        markDirty(); render();
      }
    });

    btn.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        btn.disabled = true; btn.textContent = 'Готовим…';
        const blob = await normalize(file);
        const slot = item.photo || item.__slot || nextSlot(data.categories[activeCat]);
        btn.textContent = 'Загружаем…';
        const sha = await existingSha(`${PHOTO_DIR}/${slot}.jpg`);
        const res = await putFile(`${PHOTO_DIR}/${slot}.jpg`, blob, `фото: ${item.name || slot}`, sha);
        item.photo = slot;
        delete item.__slot;
        img.src = `../assets/photos/${slot}.jpg?v=${Date.now()}`;
        img.removeAttribute('data-empty');
        markDirty();
        toast(`Фото обновлено. <a href="${res.commit.html_url}" target="_blank" rel="noopener">коммит</a> · сайт обновится через минуту`);
      } catch (e) {
        toast('Не удалось загрузить фото: ' + esc(e.message), { error: true });
      } finally {
        btn.disabled = false; btn.textContent = 'Заменить фото';
        input.value = '';
      }
    });

    return node;
  }

  function priceRow(item, price, index) {
    const row = document.createElement('div');
    row.className = 'prow';
    row.innerHTML = `
      <label class="field field--label"><span>метка</span>
        <input data-p="label" type="text" maxlength="3" placeholder="Б." value="${esc(price.label || '')}"></label>
      <label class="field"><span>цена ₽</span>
        <input data-p="value" type="number" inputmode="numeric" min="0" step="10" value="${price.value || 0}"></label>
      <button class="prow__del" type="button" title="Убрать цену">×</button>`;
    $('[data-p=label]', row).addEventListener('input', (e) => {
      price.label = e.target.value.trim();
      if (!price.label) delete price.label;
      markDirty();
    });
    $('[data-p=value]', row).addEventListener('input', (e) => {
      price.value = Math.max(0, parseInt(e.target.value || '0', 10));
      markDirty();
    });
    $('.prow__del', row).addEventListener('click', () => {
      if (item.prices.length === 1) { toast('Нужна хотя бы одна цена', { error: true }); return; }
      item.prices.splice(item.prices.indexOf(price), 1);
      row.remove(); markDirty();
    });
    return row;
  }

  /* ---------- фото: кроп 6:5 и сжатие в браузере ---------- */
  async function normalize(file) {
    const bmp = await createImageBitmap(file);
    const targetRatio = PHOTO_W / PHOTO_H;
    const srcRatio = bmp.width / bmp.height;
    let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height;
    if (srcRatio > targetRatio) {           // шире — режем по бокам
      sw = Math.round(bmp.height * targetRatio);
      sx = Math.round((bmp.width - sw) / 2);
    } else if (srcRatio < targetRatio) {    // выше — режем сверху/снизу
      sh = Math.round(bmp.width / targetRatio);
      sy = Math.round((bmp.height - sh) / 2);
    }
    const canvas = document.createElement('canvas');
    canvas.width = PHOTO_W; canvas.height = PHOTO_H;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, PHOTO_W, PHOTO_H);
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
  }

  async function existingSha(path) {
    try {
      const f = await api(`/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`);
      return f.sha;
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  async function putFile(path, blobOrBytes, message, sha) {
    const bytes = blobOrBytes instanceof Blob ? new Uint8Array(await blobOrBytes.arrayBuffer()) : blobOrBytes;
    const body = { message, content: b64encode(bytes), branch: BRANCH };
    if (sha) body.sha = sha;
    try {
      return await api(`/repos/${OWNER}/${REPO}/contents/${path}`, { method: 'PUT', body: JSON.stringify(body) });
    } catch (e) {
      if (e.status === 409) {                        // кто-то успел раньше — повтор с новым sha
        const fresh = await existingSha(path);
        body.sha = fresh;
        return await api(`/repos/${OWNER}/${REPO}/contents/${path}`, { method: 'PUT', body: JSON.stringify(body) });
      }
      throw e;
    }
  }

  /* ---------- имена файлов для новых фото ---------- */
  const translit = (s) => (s || '')
    .toLowerCase()
    .replace(/[а-яё]/g, (c) => ({ 'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya' }[c] || ''))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'item';

  function nextSlot(cat) {
    const catIdx = data.categories.indexOf(cat) + 1;
    const name = (cat.items[cat.items.length - 1] || {}).name || '';
    const base = translit(name) || 'item';
    let s = base, n = 2;
    const taken = () => cat.items.some((i) => i.photo === s || i.__slot === s);
    while (taken()) { s = base + '-' + n; n++; }
    return s.length > 26 ? s.slice(0, 26) : s;
  }

  /* ---------- сохранение данных ---------- */
  const saveBtn = $('#saveBtn');

  function markDirty() {
    dirty = true;
    saveBtn.disabled = false;
    saveBtn.textContent = 'Сохранить *';
    $('#stats').classList.add('is-dirty');
  }

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Сохраняем…';
    try {
      const clean = {
        brand: data.brand,
        categories: data.categories.map((c) => ({
          id: c.id,
          name: c.name,
          items: c.items.map((i) => {
            const out = { name: i.name, desc: i.desc || '', prices: i.prices.filter((p) => p && p.value != null) };
            if (i.photo) out.photo = i.photo;
            return out;
          })
        }))
      };
      const text = 'window.MENU_DATA = ' + JSON.stringify(clean, null, 2) + ';\n';
      const bytes = new TextEncoder().encode(text);
      const res = await putFile(DATA_PATH, bytes, 'меню: правки из админки', dataSha);
      dataSha = res.content.sha;
      data = clean;
      dirty = false;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Сохранить';
      toast(`Сохранено. <a href="${res.commit.html_url}" target="_blank" rel="noopener">коммит</a> · сайт обновится через минуту`);
    } catch (e) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Сохранить *';
      toast('Не удалось сохранить: ' + esc(e.message), { error: true, sticky: true });
    }
  });

  $('#reloadBtn').addEventListener('click', async () => {
    if (dirty && !confirm('Есть несохранённые правки. Загрузить заново и потерять их?')) return;
    try { await loadAll(); toast('Данные перечитаны из репозитория'); }
    catch (e) { toast('Не удалось прочитать: ' + esc(e.message), { error: true }); }
  });

  catNav.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    activeCat = +b.dataset.cat;
    render();
  });

  window.addEventListener('beforeunload', (e) => {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });


  /* отладочный доступ к чистым функциям (не влияет на работу) */
  window.__shamsiAdmin = { normalize, translit, nextSlot: () => nextSlot({ items: [] }), OWNER, REPO };

  /* ---------- автостарт ---------- */
  if (token) {
    gate.hidden = true; app.hidden = false;
    $('#forgetBtn').hidden = false;
    loadAll().catch((e) => {
      gate.hidden = false; app.hidden = true;
      gateMsg.textContent = 'Не удалось загрузить меню: ' + e.message;
      gateMsg.className = 'gate__msg is-error';
    });
  }
})();
