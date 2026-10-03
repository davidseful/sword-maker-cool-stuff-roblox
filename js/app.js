/* ==========================================================================
   Sword Forge - app.js
   The user interface: premade gallery, 3D stage, tabs of controls, effect
   layers, enchantments, export + library dialogs, undo/redo, autosave.
   ========================================================================== */
(function (SF) {
  'use strict';

  const ENV = {
    artifact: !!globalThis.SF_ARTIFACT,           // set by the single-file artifact build
  };
  ENV.canDownload = !ENV.artifact;                  // downloads and #hash links are blocked inside the artifact viewer
  ENV.canShareLink = !ENV.artifact;

  /* ------------------------------------------------------------------ helpers */
  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (let i = 2; i < arguments.length; i++) {
      const kids = [].concat(arguments[i]);
      kids.forEach((c) => { if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c))); });
    }
    return el;
  }
  // Element.append() turns null / false into the visible text "null" / "false"; this skips them the way h() does.
  const put = (el, ...kids) => { kids.forEach((c) => { if (c != null && c !== false) el.append(c); }); return el; };
  const $ = (s, r) => (r || document).querySelector(s);
  const ico = (name, size) => SF.icon(name, size);
  const iconEl = (name, size) => { const s = h('span', { html: ico(name, size), style: { display: 'inline-flex' } }); return s.firstChild; };
  let uidN = 0;
  const uid = () => 'c' + ++uidN;
  const decimals = (step) => (String(step).split('.')[1] || '').length;
  const clamp = SF.clamp;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const store = {
    get(k, d) { try { const v = localStorage.getItem('sf.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('sf.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };

  function toast(msg, kind, icon) {
    const t = h('div', { class: 'toast ' + (kind || 'good'), role: 'status' }, iconEl(icon || 'check', 18), msg);
    $('#toasts').append(t);
    setTimeout(() => { t.style.transition = 'opacity .25s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 260); }, 2600);
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* fall through */ }
    try {
      const ta = h('textarea', { style: { position: 'fixed', top: '0', left: '0', opacity: '0' }, 'aria-hidden': 'true' });
      ta.value = text;
      document.body.append(ta);
      ta.focus(); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }

  /* ------------------------------------------------------------------- state */
  const state = {
    cfg: null, model: null, tab: 'blade', presetId: null,
    mode: store.get('mode', 'script'),
    stage: Object.assign({ avatar: true, spin: true, scene: 0 }, store.get('stage', {})),
    history: [], hIndex: -1,
    open: new Set(),          // open effect layers / enchant cards / groups
    scroll: {},
  };
  const SCENES = ['forge', 'dusk', 'studio', 'daylight'];
  const SCENE_NAMES = ['Forge', 'Dusk', 'Studio', 'Daylight'];
  let preview = null;
  let syncers = [];
  const reg = (fn) => { syncers.push(fn); return fn; };
  const syncAll = () => syncers.forEach((fn) => fn());

  /* ------------------------------------------------------- color palettes (themes) */
  const PALETTES = [
    { id: 'steel', name: 'Steel & gold', blade: '#cdd5df', accent: '#8190a3', metal: '#c9a227', grip: '#4a3322', wrap: '#24160d', glow: '#ffd27a', fx1: '#fff3c4', fx2: '#ffb347', gem: '#ff3355', hint: { material: 'Metal', particles: 'holy', enchant: null } },
    { id: 'ember', name: 'Ember', blade: '#ff6a14', accent: '#ffe27a', metal: '#2b1b1a', grip: '#241513', wrap: '#8a2b12', glow: '#ff8a2a', fx1: '#ffd24a', fx2: '#ff3b00', gem: '#ffae1a', hint: { material: 'Neon', particles: 'flames', enchant: 'burn' } },
    { id: 'frost', name: 'Frost', blade: '#a6e8ff', accent: '#5fd8ff', metal: '#e6f5ff', grip: '#2c4a6b', wrap: '#142a42', glow: '#6fdcff', fx1: '#ffffff', fx2: '#58c9ff', gem: '#52d3ff', hint: { material: 'Ice', particles: 'frost', enchant: 'freeze' } },
    { id: 'toxic', name: 'Toxic', blade: '#46c33a', accent: '#d7ff6a', metal: '#1f2a1f', grip: '#1d2b1b', wrap: '#5fbe3a', glow: '#6dff3a', fx1: '#c8ff7a', fx2: '#1e8a00', gem: '#9dff3c', hint: { material: 'Neon', particles: 'toxic', enchant: 'poison' } },
    { id: 'void', name: 'Void', blade: '#140a22', accent: '#e23bff', metal: '#1a0f26', grip: '#12081c', wrap: '#7a1fff', glow: '#b13cff', fx1: '#f0c7ff', fx2: '#5a0fb0', gem: '#e23bff', hint: { material: 'SmoothPlastic', particles: 'void', enchant: 'stun' } },
    { id: 'royal', name: 'Royal', blade: '#e9e4ff', accent: '#8a5cff', metal: '#d8a929', grip: '#2a1a5c', wrap: '#d8a929', glow: '#b79cff', fx1: '#ffffff', fx2: '#8a5cff', gem: '#6ad0ff', hint: { material: 'Metal', particles: 'magic', enchant: 'lifesteal' } },
    { id: 'crimson', name: 'Crimson', blade: '#35101a', accent: '#ff1f3d', metal: '#121014', grip: '#16090c', wrap: '#a0102a', glow: '#ff1f3d', fx1: '#ff6a7e', fx2: '#7a0018', gem: '#ff1f3d', hint: { material: 'Metal', particles: 'blood', enchant: 'lifesteal' } },
    { id: 'storm', name: 'Storm', blade: '#2a3550', accent: '#ffe94d', metal: '#7482a8', grip: '#1c2236', wrap: '#ffd91f', glow: '#ffe55a', fx1: '#fff6a8', fx2: '#35c4ff', gem: '#ffe94d', hint: { material: 'Metal', particles: 'electric', enchant: 'lightning' } },
    { id: 'sakura', name: 'Sakura', blade: '#ffd1e3', accent: '#ff6fa8', metal: '#f6f0f2', grip: '#5a2a3a', wrap: '#ff9ec3', glow: '#ff9ec3', fx1: '#ffffff', fx2: '#ff6fa8', gem: '#ff6fa8', hint: { material: 'SmoothPlastic', particles: 'magic', enchant: null } },
    { id: 'ocean', name: 'Ocean', blade: '#3ec1d3', accent: '#b9fbff', metal: '#0f3f5a', grip: '#0b2a3d', wrap: '#3ec1d3', glow: '#4fe3ff', fx1: '#d6fbff', fx2: '#1c7fb3', gem: '#b9fbff', hint: { material: 'Glass', particles: 'frost', enchant: 'freeze' } },
    { id: 'bone', name: 'Bone', blade: '#e8e1cf', accent: '#a89b7a', metal: '#4a4338', grip: '#2b2118', wrap: '#6b5a3a', glow: '#e8d9a8', fx1: '#f5f0e0', fx2: '#9a8a66', gem: '#c9d84a', hint: { material: 'Marble', particles: 'smoke', enchant: null } },
    { id: 'gold', name: 'Solid gold', blade: '#ffd45a', accent: '#fff3b0', metal: '#8a5a14', grip: '#3a2a10', wrap: '#ffd45a', glow: '#ffd45a', fx1: '#fff6c2', fx2: '#ffb81f', gem: '#ff3355', hint: { material: 'Neon', particles: 'holy', enchant: 'explosion' } },
  ];

  function paintLayer(l, p) {
    if (l.kind === 'glow' || l.kind === 'aura') l.color = p.glow;
    else if (l.kind === 'arcs') l.color = p.fx1;
    else if (l.kind === 'outline') { l.color = p.fx1; l.fill = p.fx2; }
    else if (l.kind === 'trail') { l.color1 = p.fx1; l.color2 = p.fx2; }
    else if (l.kind === 'particles' && l.style !== 'rainbow') { l.color1 = p.fx1; l.color2 = p.fx2; }
  }
  function applyPalette(cfg, p) {
    cfg.blade.color = cfg.blade.style === 'energy' ? p.glow : p.blade;
    cfg.blade.accent = p.accent;
    cfg.guard.color = p.metal;
    cfg.pommel.color = p.metal;
    cfg.grip.color = p.grip;
    cfg.grip.wrapColor = p.wrap;
    cfg.gem.color = p.gem;
    cfg.effects.forEach((l) => paintLayer(l, p));
    SF.ENCHANT_IDS.forEach((id) => {
      const e = cfg.combat.enchants[id];
      if (e.color && id === 'burn') e.color = p.fx1 === '#ffffff' ? e.color : p.fx2;
    });
  }
  /* a palette-like object derived from the sword's own colours (for freshly added effects) */
  function swordPalette(cfg) {
    const cands = [cfg.blade.style === 'energy' ? cfg.blade.color : cfg.blade.accent, cfg.blade.color, cfg.gem.color, cfg.guard.color];
    let best = cands[0], bestS = -1;
    cands.forEach((c) => {
      const [, s, l] = SF.rgb2hsl(SF.hex2rgb(c));
      const score = s * (1 - Math.abs(l - 0.55));
      if (score > bestS) { bestS = score; best = c; }
    });
    if (bestS < 0.12) best = '#7fc8ff';
    return { glow: best, fx1: SF.lighten(best, 0.55), fx2: best };
  }

  /* ------------------------------------------------------------------ history */
  const snapshot = () => JSON.stringify(state.cfg);
  function pushHistory() {
    const snap = snapshot();
    if (state.history[state.hIndex] === snap) return;
    state.history = state.history.slice(0, state.hIndex + 1);
    state.history.push(snap);
    if (state.history.length > 80) state.history.shift();
    state.hIndex = state.history.length - 1;
    updateHistoryButtons();
  }
  function undo() { if (state.hIndex > 0) { state.hIndex--; loadSnapshot(); } }
  function redo() { if (state.hIndex < state.history.length - 1) { state.hIndex++; loadSnapshot(); } }
  function loadSnapshot() {
    state.cfg = SF.normalize(JSON.parse(state.history[state.hIndex]));
    state.presetId = null;
    refreshAll({ equip: false });
    updateHistoryButtons();
  }
  let undoBtn, redoBtn;
  function updateHistoryButtons() {
    if (undoBtn) undoBtn.disabled = state.hIndex <= 0;
    if (redoBtn) redoBtn.disabled = state.hIndex >= state.history.length - 1;
  }

  /* ---------------------------------------------------------- model + commits */
  function accentHex(model) {
    const cfg = model.cfg;
    const fx = model.effects;
    const glow = fx.find((e) => e.kind === 'glow');
    const trail = fx.find((e) => e.kind === 'trail');
    if (glow) return SF.rgb2hex(glow.color);
    if (trail) return SF.rgb2hex(trail.color[0][1]);
    const b = model.parts.find((p) => p.role === 'blade' && p.m === 'Neon');
    if (b) return b.c;
    return SF.lighten(cfg.blade.color, 0.1) === '#ffffff' ? '#7fb2ff' : '#8fa6c9';
  }

  function rebuildModel(opts) {
    state.model = SF.buildModel(state.cfg);
    if (preview) preview.setModel(state.model, { equip: !!(opts && opts.equip) });
    document.documentElement.style.setProperty('--sword', accentHex(state.model));
    renderStats();
    $('#sword-name').value !== state.cfg.name && ($('#sword-name').value = state.cfg.name);
  }

  function commit(opts) {
    opts = opts || {};
    state.cfg = SF.normalize(state.cfg);
    if (!opts.keepPreset) { state.presetId = null; markPreset(); }
    rebuildModel(opts);
    syncAll();
    scheduleSave();
    if (exportOpen()) scheduleCode();
  }

  /* re-render everything that depends on the whole config (preset load, undo, random...) */
  function refreshAll(opts) {
    opts = opts || {};
    state.cfg = SF.normalize(state.cfg);
    rebuildModel(opts);
    renderTab();
    markPreset();
    scheduleSave();
    if (exportOpen()) scheduleCode();
  }

  function loadConfig(cfg, opts) {
    opts = opts || {};
    state.cfg = SF.normalize(cfg);
    state.presetId = opts.presetId || null;
    refreshAll({ equip: opts.equip !== false });
    pushHistory();
  }

  let saveTimer = 0;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => store.set('current', state.cfg), 350);
  }

  /* accessors used by the controls */
  const cfgAcc = (path) => ({
    get() { let o = state.cfg; for (let i = 0; i < path.length; i++) o = o[path[i]]; return o; },
    set(v) { let o = state.cfg; for (let i = 0; i < path.length - 1; i++) o = o[path[i]]; o[path[path.length - 1]] = v; commit(); },
    obj() { let o = state.cfg; for (let i = 0; i < path.length - 1; i++) o = o[path[i]]; return o; },
  });
  const layerAcc = (id, key) => ({
    get() { const l = state.cfg.effects.find((x) => x.id === id); return l ? l[key] : undefined; },
    set(v) { const l = state.cfg.effects.find((x) => x.id === id); if (l) { l[key] = v; commit(); } },
    obj() { return state.cfg.effects.find((x) => x.id === id) || {}; },
  });

  /* ---------------------------------------------------------------- controls */
  function field(label, controlEl, opts) {
    opts = opts || {};
    const f = h('div', { class: 'field' + (opts.row ? ' row' : '') }, h('div', { class: 'lab' }, label), opts.right || null);
    if (controlEl) { controlEl.classList.add('full'); f.append(controlEl); }
    if (opts.hint) f.append(h('p', { class: 'hint-text full' }, opts.hint));
    return f;
  }
  function showWhen(el, show) { reg(() => { el.hidden = show ? !show(state.cfg) : false; }); }

  function slider(o) {
    const id = uid();
    const out = h('output', { for: id });
    const input = h('input', { type: 'range', id, min: o.min, max: o.max, step: o.step });
    const dec = decimals(o.step);
    const el = h('div', { class: 'field' }, h('label', { for: id }, o.label), out, input);
    if (o.hint) el.append(h('p', { class: 'hint-text full' }, o.hint));
    const paint = () => {
      if (o.acc.get() === undefined) return;
      const v = Number(o.acc.get());
      input.value = v;
      out.textContent = v.toFixed(dec) + (o.unit || '');
      input.style.setProperty('--pct', ((v - o.min) / (o.max - o.min)) * 100 + '%');
    };
    input.addEventListener('input', () => { o.acc.set(parseFloat(input.value)); });
    input.addEventListener('change', pushHistory);
    reg(paint); paint();
    if (o.show) showWhen(el, o.show);
    return el;
  }

  function colorf(o) {
    const sw = h('span', { class: 'sw' });
    const picker = h('input', { type: 'color', 'aria-label': o.label });
    const hex = h('input', { type: 'text', class: 'hex', maxlength: 7, spellcheck: 'false', 'aria-label': o.label + ' hex' });
    sw.append(picker);
    const box = h('div', { class: 'colorf' }, sw, hex);
    const el = h('div', { class: 'field' }, h('div', { class: 'lab' }, o.label), box);
    const paint = () => { const v = o.acc.get(); if (v === undefined) return; picker.value = v; hex.value = v; sw.style.setProperty('--c', v); };
    picker.addEventListener('input', () => { o.acc.set(picker.value); });
    picker.addEventListener('change', pushHistory);
    hex.addEventListener('change', () => {
      let v = hex.value.trim();
      if (/^[0-9a-f]{6}$/i.test(v)) v = '#' + v;
      if (/^#[0-9a-f]{6}$/i.test(v)) { o.acc.set(v.toLowerCase()); pushHistory(); } else paint();
    });
    reg(paint); paint();
    if (o.show) showWhen(el, o.show);
    return el;
  }

  function selectf(o) {
    const sel = h('select', { 'aria-label': o.label });
    o.options.forEach(([v, l]) => sel.append(h('option', { value: v }, l)));
    const wrap = h('span', { class: 'select' }, sel, iconEl('chevron', 14));
    const el = h('div', { class: 'field' }, h('div', { class: 'lab' }, o.label), wrap);
    const paint = () => { const v = o.acc.get(); if (v !== undefined) sel.value = v; };
    sel.addEventListener('change', () => { o.acc.set(sel.value); pushHistory(); if (o.after) o.after(); });
    reg(paint); paint();
    if (o.show) showWhen(el, o.show);
    return el;
  }

  function segf(o) {
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': o.label });
    const btns = o.options.map(([v, l]) => h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => { o.acc.set(v); pushHistory(); } }, l));
    seg.append(...btns);
    const el = h('div', { class: 'field' }, h('div', { class: 'lab' }, o.label), seg);
    const paint = () => { if (o.acc.get() === undefined) return; btns.forEach((b, i) => b.setAttribute('aria-pressed', o.options[i][0] === o.acc.get() ? 'true' : 'false')); };
    reg(paint); paint();
    if (o.show) showWhen(el, o.show);
    return el;
  }

  function switchf(o) {
    const input = h('input', { type: 'checkbox', role: 'switch', 'aria-label': o.label });
    const sw = h('span', { class: 'switch' }, input, h('i'));
    const el = h('div', { class: 'field row' }, h('div', { class: 'lab' }, o.label), sw);
    if (o.hint) el.append(h('p', { class: 'hint-text full' }, o.hint));
    const paint = () => { if (o.acc.get() === undefined) return; input.checked = !!o.acc.get(); };
    input.addEventListener('change', () => { o.acc.set(input.checked); pushHistory(); });
    reg(paint); paint();
    if (o.show) showWhen(el, o.show);
    return el;
  }

  /* one control from a schema param (see SF.P in data.js) */
  function paramField(p, acc) {
    // schema predicates look at the object they belong to (a layer, an enchantment...), tab predicates at the whole sword
    const base = { label: p.label, acc, show: p.show ? () => p.show(acc.obj()) : null };
    if (p.t === 'range') return slider(Object.assign(base, { min: p.min, max: p.max, step: p.step }));
    if (p.t === 'color') return colorf(base);
    if (p.t === 'select') return selectf(Object.assign(base, { options: p.options }));
    return switchf(base);
  }

  function group(title, children, right) {
    return h('section', { class: 'group' }, h('div', { class: 'gtitle' }, h('span', {}, title), right || null), children);
  }

  /* ------------------------------------------------------- picker thumbnails */
  let glOK = false;
  const thumbCache = new Map();
  const thumbQueue = [];
  let thumbRunning = false;
  function queueThumb(key, w, h2, render, canvas) {
    if (!glOK) return;
    const cached = thumbCache.get(key);
    if (cached) { canvas.getContext('2d').drawImage(cached, 0, 0, canvas.width, canvas.height); return; }
    thumbQueue.push({ key, w, h: h2, render, canvas });
    if (!thumbRunning) runThumbs();
  }
  function runThumbs() {
    thumbRunning = true;
    const step = () => {
      const job = thumbQueue.shift();
      if (!job) { thumbRunning = false; return; }
      try {
        let cv = thumbCache.get(job.key);
        if (!cv) {
          const glc = job.render();
          cv = document.createElement('canvas');
          cv.width = job.w; cv.height = job.h;
          cv.getContext('2d').drawImage(glc, 0, 0, job.w, job.h);
          thumbCache.set(job.key, cv);
        }
        if (job.canvas.isConnected) job.canvas.getContext('2d').drawImage(cv, 0, 0, job.canvas.width, job.canvas.height);
      } catch (e) { /* a failed thumbnail just stays empty */ }
      setTimeout(step, 0);
    };
    setTimeout(step, 0);
  }
  const neutral = () => { const c = SF.defaultConfig(); c.effects = []; c.gem.where = 'none'; return c; };
  function bladeThumbCfg(id) {
    const c = SF.applyBladeStyle(neutral(), id);
    if (id === 'energy') { c.blade.color = '#4aa3ff'; c.grip.color = '#a9b2bd'; c.grip.material = 'Metal'; c.guard.style = 'none'; }
    return SF.normalize(c);
  }

  function stylePicker(o) {
    const grid = h('div', { class: 'pick-grid' });
    const btns = o.items.map(([id, label]) => {
      const cv = h('canvas', { width: o.wide ? 160 : 120, height: o.wide ? 120 : 160 });
      const b = h('button', { type: 'button', class: 'pick' + (o.wide ? ' wide' : ''), 'aria-pressed': 'false', title: o.titles ? o.titles[id] : label, onclick: () => { o.pick(id); } }, cv, h('span', {}, label));
      grid.append(b);
      queueThumb(o.prefix + id, cv.width, cv.height, () => o.render(id, cv.width, cv.height), cv);
      return b;
    });
    reg(() => btns.forEach((b, i) => b.setAttribute('aria-pressed', o.items[i][0] === o.get() ? 'true' : 'false')));
    return grid;
  }

  /* ------------------------------------------------------------------- tabs */
  const TABS = [['blade', 'Blade', 'blade'], ['hilt', 'Hilt', 'hilt'], ['fx', 'Effects', 'effects'], ['moves', 'Moves', 'moves'], ['powers', 'Powers', 'powers']];

  function buildTabs() {
    const tabs = $('#tabs');
    tabs.innerHTML = '';
    TABS.forEach(([id, label, icon]) => {
      const b = h('button', {
        class: 'tab', role: 'tab', id: 'tab-' + id, 'aria-selected': String(id === state.tab), 'aria-controls': 'panel',
        onclick: () => selectTab(id),
      }, iconEl(icon, 18), label);
      tabs.append(b);
    });
    tabs.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const i = TABS.findIndex((t) => t[0] === state.tab);
      const n = (i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
      selectTab(TABS[n][0]);
      $('#tab-' + TABS[n][0]).focus();
    });
  }
  function selectTab(id) {
    const panel = $('#panel');
    if (panel) state.scroll[state.tab] = panel.scrollTop;
    state.tab = id;
    store.set('tab', id);
    TABS.forEach(([t]) => $('#tab-' + t).setAttribute('aria-selected', String(t === id)));
    renderTab();
    const p2 = $('#panel');
    if (p2) p2.scrollTop = state.scroll[id] || 0;
  }

  function renderTab() {
    let panel = $('#panel');
    if (!panel) {
      panel = h('div', { class: 'tabpanel', id: 'panel', role: 'tabpanel' });
      $('#panels').append(panel);
    }
    const top = panel.scrollTop;
    panel.innerHTML = '';
    panel.setAttribute('aria-labelledby', 'tab-' + state.tab);
    syncers = [];
    ({ blade: bladeTab, hilt: hiltTab, fx: fxTab, moves: movesTab, powers: powersTab })[state.tab](panel);
    syncAll();
    panel.scrollTop = top;
  }

  /* ---- Blade tab */
  function bladeTab(root) {
    const bs = SF.BLADE_STYLES;
    const isEnergy = (c) => c.blade.style === 'energy';
    root.append(
      group('Blade style', [
        stylePicker({
          items: SF.BLADE_STYLE_IDS.map((id) => [id, bs[id].label]),
          titles: Object.fromEntries(SF.BLADE_STYLE_IDS.map((id) => [id, bs[id].desc])),
          prefix: 'blade:',
          get: () => state.cfg.blade.style,
          pick: (id) => { state.cfg = SF.applyBladeStyle(state.cfg, id); commit(); pushHistory(); },
          render: (id, w, hh) => SF.thumbnail(SF.buildModel(bladeThumbCfg(id)), w, hh, { warm: 0, yaw: 70, pitch: 0.08 }),
        }),
        h('p', { class: 'pick-note' }, 'Picking a style sets sensible proportions. Fine-tune them below.'),
      ]),
      group('Shape', [
        slider({ label: 'Length', unit: ' studs', min: 1.2, max: 10, step: 0.1, acc: cfgAcc(['blade', 'length']) }),
        slider({ label: 'Width', unit: ' studs', min: 0.15, max: 3.5, step: 0.05, acc: cfgAcc(['blade', 'width']) }),
        slider({ label: 'Thickness', unit: ' studs', min: 0.05, max: 0.8, step: 0.01, acc: cfgAcc(['blade', 'thickness']), show: (c) => !isEnergy(c) }),
        slider({ label: 'Pointed tip length', unit: ' studs', min: 0, max: 4, step: 0.05, acc: cfgAcc(['blade', 'tip']), show: (c) => !isEnergy(c) }),
        slider({ label: 'Curve', unit: '°', min: -35, max: 45, step: 1, acc: cfgAcc(['blade', 'curve']), show: (c) => !isEnergy(c), hint: 'Positive curves the tip backwards, like a katana.' }),
        slider({ label: 'Taper', min: 0, max: 0.85, step: 0.01, acc: cfgAcc(['blade', 'taper']), show: (c) => !isEnergy(c) }),
        slider({ label: 'Saw teeth', min: 0, max: 14, step: 1, acc: cfgAcc(['blade', 'serrated']), show: (c) => !isEnergy(c) }),
        selectf({ label: 'Center line', options: SF.FULLER_STYLES, acc: cfgAcc(['blade', 'fuller']), show: (c) => !isEnergy(c) }),
      ]),
      group('Color & material', [
        colorf({ label: (isEnergy(state.cfg) ? 'Beam color' : 'Blade color'), acc: cfgAcc(['blade', 'color']) }),
        colorf({ label: 'Core color', acc: cfgAcc(['blade', 'coreColor']), show: isEnergy }),
        colorf({ label: 'Center line color', acc: cfgAcc(['blade', 'accent']), show: (c) => !isEnergy(c) && c.blade.fuller !== 'none' }),
        selectf({ label: 'Material', options: SF.MATERIALS, acc: cfgAcc(['blade', 'material']), show: (c) => !isEnergy(c) }),
        slider({ label: 'See-through', min: 0, max: 0.9, step: 0.01, acc: cfgAcc(['blade', 'transparency']), hint: 'Great for ice, glass and energy blades.' }),
      ]),
      group('Overall size', [
        slider({ label: 'Whole sword scale', unit: 'x', min: 0.4, max: 3, step: 0.05, acc: cfgAcc(['scale']), hint: 'A character is about 5 studs tall. Anything over 1.5x feels like a greatsword.' }),
      ])
    );
  }

  /* ---- Hilt tab */
  function hiltTab(root) {
    const noGuard = (c) => c.guard.style !== 'none';
    const guardTitles = { cross: 'A straight bar', winged: 'Bar with wings angled up', drooped: 'Bar with wings angled down', crescent: 'Curved upwards like a moon', horned: 'Bar with horns', disc: 'Round plate', none: 'No guard' };
    root.append(
      group('Guard', [
        stylePicker({
          items: SF.GUARD_STYLES, titles: guardTitles, wide: true, prefix: 'guard:',
          get: () => state.cfg.guard.style,
          pick: (id) => { state.cfg.guard.style = id; commit(); pushHistory(); },
          render: (id, w, hh) => {
            const c = neutral();
            c.guard.style = id; c.guard.width = 2.4; c.guard.height = 0.32; c.guard.color = '#d4af37'; c.guard.ends = 'none';
            const m = SF.buildModel(c);
            return SF.thumbnail(m, w, hh, { warm: 0, yaw: 82, pitch: 0.12, focus: { y: m.layout.guardY + 0.3, span: 3.3 } });
          },
        }),
        slider({ label: 'Width', unit: ' studs', min: 0.5, max: 6, step: 0.05, acc: cfgAcc(['guard', 'width']), show: noGuard }),
        slider({ label: 'Height', unit: ' studs', min: 0.1, max: 1.2, step: 0.01, acc: cfgAcc(['guard', 'height']), show: noGuard }),
        slider({ label: 'Thickness', unit: ' studs', min: 0.1, max: 1.4, step: 0.01, acc: cfgAcc(['guard', 'thickness']), show: (c) => noGuard(c) && c.guard.style !== 'disc' }),
        segf({ label: 'End caps', options: [['none', 'None'], ['ball', 'Balls']], acc: cfgAcc(['guard', 'ends']), show: (c) => ['cross', 'horned', 'winged', 'drooped'].includes(c.guard.style) }),
        colorf({ label: 'Color', acc: cfgAcc(['guard', 'color']), show: noGuard }),
        selectf({ label: 'Material', options: SF.MATERIALS, acc: cfgAcc(['guard', 'material']), show: noGuard }),
      ]),
      group('Grip', [
        slider({ label: 'Length', unit: ' studs', min: 0.5, max: 3, step: 0.05, acc: cfgAcc(['grip', 'length']) }),
        slider({ label: 'Thickness', unit: ' studs', min: 0.08, max: 0.6, step: 0.01, acc: cfgAcc(['grip', 'radius']), hint: 'This is the radius of the handle.' }),
        colorf({ label: 'Color', acc: cfgAcc(['grip', 'color']) }),
        selectf({ label: 'Material', options: SF.MATERIALS, acc: cfgAcc(['grip', 'material']) }),
        switchf({ label: 'Wrapped with bands', acc: cfgAcc(['grip', 'wrap']) }),
        colorf({ label: 'Band color', acc: cfgAcc(['grip', 'wrapColor']), show: (c) => c.grip.wrap }),
      ]),
      group('Pommel', [
        segf({ label: 'Style', options: SF.POMMEL_STYLES, acc: cfgAcc(['pommel', 'style']) }),
        slider({ label: 'Size', unit: ' studs', min: 0.2, max: 1.6, step: 0.02, acc: cfgAcc(['pommel', 'size']), show: (c) => c.pommel.style !== 'none' }),
        colorf({ label: 'Color', acc: cfgAcc(['pommel', 'color']), show: (c) => c.pommel.style !== 'none' }),
        selectf({ label: 'Material', options: SF.MATERIALS, acc: cfgAcc(['pommel', 'material']), show: (c) => c.pommel.style !== 'none' }),
      ]),
      group('Gem', [
        selectf({ label: 'Where', options: SF.GEM_PLACES, acc: cfgAcc(['gem', 'where']) }),
        colorf({ label: 'Color', acc: cfgAcc(['gem', 'color']), show: (c) => c.gem.where !== 'none' }),
        slider({ label: 'Size', unit: ' studs', min: 0.12, max: 0.9, step: 0.01, acc: cfgAcc(['gem', 'size']), show: (c) => c.gem.where !== 'none' }),
      ]),
      group('How it is held', [
        slider({ label: 'Tilt forward', unit: '°', min: -60, max: 60, step: 1, acc: cfgAcc(['hold', 'tilt']), hint: 'Leans the blade towards or away from the enemy while you hold it.' }),
      ])
    );
  }

  /* ---- Effects tab */
  function layerSummary(l) {
    const spec = SF.FX_KINDS[l.kind];
    if (l.kind === 'particles') {
      const trig = { idle: 'always', swing: 'on swing', burst: 'swing burst', hit: 'on hit', equip: 'on equip' }[l.trigger];
      return (SF.PARTICLE_STYLES[l.style] || {}).label + ' · ' + trig;
    }
    if (l.kind === 'glow') return 'Brightness ' + l.brightness.toFixed(1) + ' · range ' + Math.round(l.range);
    if (l.kind === 'trail') return (l.always ? 'Always on' : 'On swing') + ' · ' + l.life.toFixed(2) + 's';
    if (l.kind === 'aura') return 'Thickness ' + l.size.toFixed(2);
    if (l.kind === 'arcs') return l.count + ' arcs';
    if (l.kind === 'rainbow') return 'Speed ' + l.speed.toFixed(1);
    return spec.blurb.slice(0, 40);
  }

  /* a particle style that suits the colour of the sword */
  function guessStyle(hex) {
    const [hue, sat, lig] = SF.rgb2hsl(SF.hex2rgb(hex));
    if (sat < 0.18) return lig > 0.6 ? 'magic' : 'smoke';
    if (hue < 18 || hue >= 340) return 'embers';
    if (hue < 45) return 'flames';
    if (hue < 70) return 'holy';
    if (hue < 170) return 'toxic';
    if (hue < 255) return 'frost';
    if (hue < 300) return 'void';
    return 'magic';
  }

  function addLayer(kind) {
    const layer = SF.makeLayer(kind);
    paintLayer(layer, swordPalette(state.cfg));
    if (kind === 'particles') {
      layer.style = guessStyle(swordPalette(state.cfg).glow);
      const st = SF.PARTICLE_STYLES[layer.style];
      if (!st.rainbow) { layer.color1 = st.c1; layer.color2 = st.c2; paintLayer(layer, swordPalette(state.cfg)); }
    }
    state.cfg.effects.push(layer);
    state.open.add(layer.id);
    syncers = [];
    commit();
    pushHistory();
    renderTab();
    const el = document.getElementById('layer-' + layer.id);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function layerCard(id) {
    const layer = state.cfg.effects.find((l) => l.id === id);
    const spec = SF.FX_KINDS[layer.kind];
    const open = state.open.has(id);
    const sub = h('small', {});
    const switchInput = h('input', { type: 'checkbox', role: 'switch', 'aria-label': 'Enable ' + spec.label });
    const card = h('div', { class: 'layer' + (open ? ' open' : ''), id: 'layer-' + id });
    const body = h('div', { class: 'layer-body', hidden: !open });
    const toggle = () => {
      const o = !state.open.has(id);
      if (o) state.open.add(id); else state.open.delete(id);
      card.classList.toggle('open', o);
      body.hidden = !o;
    };
    const head = h('div', { class: 'layer-head' },
      h('span', { class: 'ic', html: ico(spec.icon, 17) }),
      h('button', { type: 'button', class: 'ttl', onclick: toggle, 'aria-expanded': String(open) }, h('b', {}, spec.label), sub),
      h('span', { class: 'switch', title: 'Turn this effect on or off' }, switchInput, h('i')),
      h('button', { type: 'button', class: 'btn ghost small icon', title: 'Duplicate', 'aria-label': 'Duplicate effect', html: ico('dup', 16), onclick: () => {
        const copy = SF.clone(layer); copy.id = SF.newId(); state.cfg.effects.push(copy); state.open.add(copy.id); syncers = []; commit(); pushHistory(); renderTab();
      } }),
      h('button', { type: 'button', class: 'btn ghost small icon danger', title: 'Remove', 'aria-label': 'Remove effect', html: ico('trash', 16), onclick: () => {
        state.cfg.effects = state.cfg.effects.filter((l) => l.id !== id); state.open.delete(id); syncers = []; commit(); pushHistory(); renderTab();
      } }),
      h('button', { type: 'button', class: 'btn ghost small icon chev', title: 'Show settings', 'aria-label': 'Show settings', html: ico('chevron', 16), onclick: toggle })
    );
    switchInput.addEventListener('change', () => { layerAcc(id, 'on').set(switchInput.checked); card.classList.toggle('off', !switchInput.checked); pushHistory(); });
    spec.params.forEach((p) => body.append(paramField(p, layerAcc(id, p.k))));
    reg(() => {
      const l = state.cfg.effects.find((x) => x.id === id);
      if (!l) return;
      switchInput.checked = l.on;
      card.classList.toggle('off', !l.on);
      sub.textContent = layerSummary(l);
    });
    put(card, head, body, spec.blurb ? h('div', { hidden: true }, spec.blurb) : null);
    return card;
  }

  function fxTab(root) {
    const kinds = SF.FX_KIND_IDS;
    root.append(group('Add an effect', [
      h('div', { class: 'addbar' }, kinds.map((k) => {
        const spec = SF.FX_KINDS[k];
        return h('button', { type: 'button', class: 'addbtn', title: spec.blurb, onclick: () => addLayer(k) }, iconEl(spec.icon, 20), h('span', {}, h('b', {}, spec.label), h('small', {}, spec.short)));
      })),
    ]));
    const list = h('div');
    if (!state.cfg.effects.length) {
      list.append(h('div', { class: 'empty-fx' }, h('b', {}, 'No effects yet'), h('p', { class: 'hint-text' }, 'Add a glow, some particles or a swing trail above. Effects stack, so use as many as you like.')));
    }
    state.cfg.effects.forEach((l) => list.append(layerCard(l.id)));
    root.append(group('Your effects (' + state.cfg.effects.length + ')', list));
    if (state.cfg.effects.length > 7) root.append(h('p', { class: 'hint-text' }, 'Lots of effects can slow down low-end phones. Keep it under about 8 for the smoothest result.'));
  }

  /* ---- Powers tab */
  function enchantCard(id) {
    const spec = SF.ENCHANTS[id];
    const open = state.open.has('e:' + id);
    const acc = (k) => cfgAcc(['combat', 'enchants', id, k]);
    const sw = h('input', { type: 'checkbox', role: 'switch', 'aria-label': spec.label });
    const body = h('div', { class: 'ench-body', hidden: !state.cfg.combat.enchants[id].on });
    spec.params.forEach((p) => body.append(paramField(p, acc(p.k))));
    const card = h('div', { class: 'ench' },
      h('div', { class: 'ench-head' },
        h('span', { class: 'ic', html: ico(spec.icon, 18) }),
        h('div', { class: 't' }, h('b', {}, spec.label), h('small', {}, spec.blurb)),
        h('span', { class: 'switch' }, sw, h('i'))),
      body);
    sw.addEventListener('change', () => { acc('on').set(sw.checked); pushHistory(); });
    reg(() => {
      const on = state.cfg.combat.enchants[id].on;
      sw.checked = on; card.classList.toggle('on', on); body.hidden = !on;
    });
    void open;
    return card;
  }

  /* ---- Moves tab: the animations (swing combo, stance, equip flourish) */
  function movesTab(root) {
    const swingIds = SF.movesOf('swing');
    const finisherNote = 'A combo cycles through these in order. The last hit of the combo is the finisher: it hits harder and lunges.';
    const whenOn = (el) => { showWhen(el, (c) => c.anim.on); return el; };
    const edit = (fn, play) => {
      fn(state.cfg.anim);
      state.cfg.anim = SF.normAnim(state.cfg.anim);
      syncers = [];
      commit();
      pushHistory();
      renderTab();
      if (play && preview) preview.playMove(play);
    };

    // one radio-style list for the stance / equip flourish
    const pickList = (kind, key) => {
      const ids = ['none'].concat(SF.movesOf(kind));
      const list = h('div', { class: 'movelist', role: 'radiogroup' });
      const btns = ids.map((id) => {
        const m = SF.MOVES[id];
        const b = h('button', { type: 'button', class: 'move', role: 'radio', 'aria-pressed': 'false',
          onclick: () => edit((a) => { a[key] = id; }, kind === 'equip' && id !== 'none' ? id : null) },
        h('span', { class: 'dot' }),
        h('span', {}, h('b', {}, m ? m.label : 'None (Roblox default)'), h('small', {}, m ? m.blurb : 'No custom ' + (kind === 'idle' ? 'stance' : 'flourish') + '. The character holds the sword like normal.')));
        list.append(b);
        return b;
      });
      reg(() => btns.forEach((b, i) => b.setAttribute('aria-pressed', String(ids[i] === state.cfg.anim[key]))));
      return list;
    };

    const swings = state.cfg.anim.swings;
    const rows = swings.map((id, i) => {
      const sel = h('select', { 'aria-label': 'Swing ' + (i + 1) });
      swingIds.forEach((sid) => sel.append(h('option', { value: sid }, SF.MOVES[sid].label)));
      sel.value = id;
      sel.addEventListener('change', () => edit((a) => { a.swings[i] = sel.value; }, sel.value));
      const last = i === swings.length - 1 && swings.length >= 2;
      const small = (icon, label, fn, flip, off) => {
        const b = h('button', { type: 'button', class: 'btn icon ghost', 'aria-label': label, title: label, onclick: fn }, iconEl(icon, 16));
        if (flip) b.firstChild.style.transform = 'rotate(180deg)';
        if (off) b.disabled = true;
        return b;
      };
      return h('div', { class: 'swingrow' },
        h('span', { class: 'n' + (last ? ' fin' : ''), title: last ? 'The finisher: hits harder and lunges' : 'Hit ' + (i + 1) }, String(i + 1)),
        h('span', { class: 'select' }, sel, iconEl('chevron', 14)),
        small('play', 'Preview this swing', () => preview && preview.playMove(id)),
        small('up', 'Move earlier', () => edit((a) => { const t = a.swings[i]; a.swings[i] = a.swings[i - 1]; a.swings[i - 1] = t; }), false, i === 0),
        small('up', 'Move later', () => edit((a) => { const t = a.swings[i]; a.swings[i] = a.swings[i + 1]; a.swings[i + 1] = t; }), true, i === swings.length - 1),
        small('trash', 'Remove this swing', () => edit((a) => { a.swings.splice(i, 1); })));
    });
    const full = swings.length >= SF.ANIM_MAX_SWINGS;
    const addBar = h('div', { class: 'addbar' }, swingIds.map((id) => h('button', { type: 'button', class: 'addbtn', disabled: full, title: SF.MOVES[id].blurb,
      onclick: () => edit((a) => { a.swings.push(id); }, id) },
    iconEl('swing', 18), h('span', {}, h('b', {}, SF.MOVES[id].label), h('small', {}, SF.MOVES[id].blurb)))));

    root.append(
      group('Animations', [
        switchf({ label: 'Move the character', acc: cfgAcc(['anim', 'on']), hint: 'Swings, a stance and an equip flourish that match your sword. Off = Roblox\'s normal swing.' }),
        whenOn(slider({ label: 'Speed', acc: cfgAcc(['anim', 'speed']), min: SF.ANIM_SPEED.min, max: SF.ANIM_SPEED.max, step: SF.ANIM_SPEED.step, unit: 'x' })),
      ]),
      whenOn(group('Your combo (' + swings.length + ')', [
        rows.length ? h('div', {}, rows) : h('div', { class: 'empty-fx' }, h('b', {}, 'No swings yet'), h('p', { class: 'hint-text' }, 'Add one below, or the sword uses Roblox\'s normal swing.')),
        h('p', { class: 'hint-text', style: { margin: '0 0 8px' } }, finisherNote),
        h('div', { class: 'eyebrow', style: { margin: '10px 0 4px' } }, 'Add a swing'),
        addBar,
        full ? h('p', { class: 'hint-text' }, 'That is the most a combo can hold (' + SF.ANIM_MAX_SWINGS + ').') : null,
      ])),
      whenOn(group('Stance', [h('p', { class: 'hint-text', style: { margin: '0 0 8px' } }, 'How your character stands while holding the sword.'), pickList('idle', 'idle')])),
      whenOn(group('Equip flourish', [h('p', { class: 'hint-text', style: { margin: '0 0 8px' } }, 'What happens when you pull the sword out.'), pickList('equip', 'equip')]))
    );
  }

  function powersTab(root) {
    const c = ['combat'];
    root.append(
      group('Weapon feel', SF.COMBAT_PARAMS.map((p) => paramField(p, cfgAcc(c.concat(p.k))))),
      group('Enchantments', [
        h('p', { class: 'hint-text', style: { margin: '0 0 10px' } }, 'Extra things that happen to whoever you hit. Turn on as many as you like.'),
        h('div', { class: 'ench-grid' }, SF.ENCHANT_IDS.map(enchantCard)),
      ]),
      group('Sword wave', [
        h('p', { class: 'hint-text', style: { margin: '0 0 6px' } }, 'A glowing slash that flies forward and hurts everything in its path.'),
        ...SF.WAVE_PARAMS.map((p) => paramField(p, cfgAcc(['combat', 'wave', p.k]))),
      ]),
      group('Sounds', [
        switchf({ label: 'Swing sound', acc: cfgAcc(['sounds', 'swing']), hint: 'Uses the classic Roblox sword sounds, nothing to upload.' }),
        switchf({ label: 'Equip sound', acc: cfgAcc(['sounds', 'equip']) }),
        (() => {
          const id = uid();
          const input = h('input', { id, type: 'text', inputmode: 'numeric', class: 'textin', style: { width: '130px' }, placeholder: 'Sound ID', 'aria-label': 'Hit sound id' });
          const el = h('div', { class: 'field' }, h('label', { for: id }, 'Hit sound ID'), input, h('p', { class: 'hint-text full' }, 'Optional. Paste the number of any Roblox sound you can use.'));
          input.addEventListener('change', () => { state.cfg.sounds.hit = input.value; commit(); pushHistory(); });
          reg(() => { input.value = state.cfg.sounds.hit || ''; });
          return el;
        })(),
      ])
    );
  }

  /* -------------------------------------------------------------- gallery */
  function buildGallery() {
    const wrap = $('#cards');
    SF.PRESETS.forEach((p) => {
      const cv = h('canvas', { width: 240, height: 320 });
      const b = h('button', { type: 'button', class: 'card', 'data-id': p.id, 'aria-pressed': 'false', title: p.blurb, onclick: () => { loadConfig(SF.clone(p.cfg), { presetId: p.id }); } },
        cv, h('span', { class: 'meta' }, h('span', { class: 'nm' }, p.name), h('span', { class: 'tg' }, p.tag)));
      wrap.append(b);
      queueThumb('preset:' + p.id, 240, 320, () => SF.thumbnail(SF.buildModel(p.cfg), 240, 320, { warm: 1.5, yaw: 66, pitch: 0.08 }), cv);
    });
  }
  function markPreset() {
    document.querySelectorAll('.card').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.id === state.presetId)));
  }

  /* ---------------------------------------------------------------- stage UI */
  function renderStats() {
    const m = state.model;
    if (!m) return;
    const powers = [];
    SF.ENCHANT_IDS.forEach((id) => { if (state.cfg.combat.enchants[id].on) powers.push(SF.ENCHANTS[id].label); });
    if (state.cfg.combat.wave.mode !== 'off') powers.push('Sword wave');
    const sb = $('#statbar');
    sb.innerHTML = '';
    const stat = (n, l) => h('div', { class: 'stat' }, h('b', {}, String(n)), h('span', {}, l));
    sb.append(
      stat(m.stats.parts, 'parts'),
      stat(m.stats.length.toFixed(1), 'studs long'),
      stat(m.effects.filter((e) => e.kind !== 'aura').length + (m.effects.some((e) => e.kind === 'aura') ? 1 : 0), 'effects'),
      stat(state.cfg.combat.damage, 'damage'),
      h('div', { class: 'powers grow' }, powers.length ? h('span', {}, h('b', {}, 'Powers: '), powers.join(', ')) : h('span', {}, 'No special powers yet. Try the Powers tab.')),
      h('button', { class: 'btn gold', type: 'button', onclick: openExport }, iconEl('code', 16), 'Get script')
    );
    const chip = $('#chip-parts');
    if (chip) chip.innerHTML = '<b>' + m.stats.parts + '</b> parts · <b>' + m.stats.length.toFixed(1) + '</b> studs';
  }

  function buildStageUI() {
    const tl = $('#stage-tl'), tr = $('#stage-tr'), bc = $('#stage-bc');
    const mkToggle = (key, label, icon, on) => {
      const b = h('button', { type: 'button', class: 'btn small' + (state.stage[key] ? ' on' : ''), 'aria-pressed': String(!!state.stage[key]), title: label }, iconEl(icon, 15), h('span', { class: 'lab' }, label));
      b.addEventListener('click', () => {
        state.stage[key] = !state.stage[key];
        b.classList.toggle('on', state.stage[key]);
        b.setAttribute('aria-pressed', String(state.stage[key]));
        on(state.stage[key]);
        store.set('stage', state.stage);
      });
      return b;
    };
    tl.append(
      mkToggle('avatar', 'Avatar', 'avatar', (v) => preview && preview.setAvatar(v)),
      mkToggle('spin', 'Spin', 'rotate', (v) => preview && preview.setAutoRotate(v)),
      (() => {
        const b = h('button', { type: 'button', class: 'btn small', title: 'Change the backdrop' }, iconEl('scene', 15), h('span', { class: 'lab' }, SCENE_NAMES[state.stage.scene]));
        b.addEventListener('click', () => {
          state.stage.scene = (state.stage.scene + 1) % SCENES.length;
          b.querySelector('.lab').textContent = SCENE_NAMES[state.stage.scene];
          if (preview) preview.setTheme(SCENES[state.stage.scene]);
          store.set('stage', state.stage);
        });
        return b;
      })()
    );
    tr.append(h('span', { class: 'chip hide-xs', id: 'chip-parts' }));
    bc.append(h('button', { type: 'button', class: 'btn primary swing-btn', onclick: () => preview && preview.swing(), title: 'Swing the sword (Space)' }, iconEl('swing', 18), 'Swing'));
  }

  function buildTopActions() {
    const top = $('#top-actions');
    undoBtn = h('button', { type: 'button', class: 'btn icon ghost', title: 'Undo (Ctrl+Z)', 'aria-label': 'Undo', html: ico('undo'), onclick: undo });
    redoBtn = h('button', { type: 'button', class: 'btn icon ghost', title: 'Redo (Ctrl+Shift+Z)', 'aria-label': 'Redo', html: ico('redo'), onclick: redo });
    put(top,
      undoBtn, redoBtn,
      h('button', { type: 'button', class: 'btn hide-s', onclick: randomize, title: 'Roll a brand new random sword (R)' }, iconEl('dice', 17), 'Surprise me'),
      h('button', { type: 'button', class: 'btn hide-s', onclick: openLibrary, title: 'Save, load and share swords' }, iconEl('save', 17), 'My swords'),
      ENV.artifact ? null : h('button', { type: 'button', class: 'btn icon ghost hide-s', id: 'theme-btn', title: 'Switch light / dark', 'aria-label': 'Switch light or dark theme', html: ico('sun'), onclick: toggleTheme }),
      h('button', { type: 'button', class: 'btn primary cta-desktop', onclick: openExport }, iconEl('code', 17), 'Get script')
    );
    const mob = $('#cta-mobile');
    const mb = (icon, label, fn, cls) => h('button', { type: 'button', class: 'btn' + (cls ? ' ' + cls : ''), 'aria-label': label, onclick: fn }, iconEl(icon, 18), h('span', { class: 'lab' }, label));
    mob.append(
      mb('swing', 'Swing', () => preview && preview.swing()),
      mb('dice', 'Random', randomize),
      mb('save', 'Saved', openLibrary),
      mb('code', 'Get script', openExport, 'primary')
    );
  }

  function toggleTheme() {
    const root = document.documentElement;
    const cur = root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    const next = cur === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    store.set('theme', next);
    paintThemeButton();
  }
  function paintThemeButton() {
    const b = $('#theme-btn');
    if (!b) return;
    const cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    b.innerHTML = ico(cur === 'light' ? 'moon' : 'sun');
  }

  function buildPalettes() {
    const row = $('#pal-row');
    PALETTES.forEach((p) => {
      row.append(h('button', {
        type: 'button', class: 'pal', title: p.name, 'aria-label': 'Apply the ' + p.name + ' color theme',
        onclick: () => { applyPalette(state.cfg, p); const m = p.hint.material; if (state.cfg.blade.style !== 'energy' && m) state.cfg.blade.material = m; commit({ keepPreset: false }); pushHistory(); renderTab(); $('#pal-note').textContent = p.name; },
      }, h('i', { style: { background: p.blade, border: '1px solid rgba(255,255,255,.12)' } }), h('i', { style: { background: p.accent } }), h('i', { style: { background: p.metal } }), h('i', { style: { background: p.glow } }), h('i', { style: { background: p.wrap } })));
    });
  }

  /* -------------------------------------------------------------- randomizer */
  const NAME_A = ['Ember', 'Frost', 'Void', 'Storm', 'Solar', 'Lunar', 'Thorn', 'Crimson', 'Shadow', 'Golden', 'Iron', 'Silent', 'Wild', 'Ancient', 'Royal', 'Cursed', 'Radiant', 'Hollow', 'Jade', 'Obsidian'];
  const NAME_B = ['Fang', 'Brand', 'Edge', 'Reaver', 'Blade', 'Tongue', 'Song', 'Bane', 'Whisper', 'Cleaver', 'Sting', 'Talon', 'Oath', 'Vow', 'Wing', 'Spine', 'Heart', 'Thorn', 'Dawn', 'Gale'];
  function randomize() {
    const rnd = Math.random;
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    let cfg = SF.defaultConfig();
    const style = pick(SF.BLADE_STYLE_IDS.filter((s) => s !== 'energy' || rnd() < 0.5));
    cfg = SF.applyBladeStyle(cfg, style);
    const pal = pick(PALETTES);
    const b = cfg.blade;
    b.length = clamp(b.length * (0.88 + rnd() * 0.3), 1.5, 8);
    b.width = clamp(b.width * (0.85 + rnd() * 0.35), 0.25, 1.6);
    if (style !== 'energy') {
      b.material = pal.hint.material;
      b.fuller = pick(['groove', 'inlay', 'inlay', 'none']);
      if (b.style !== 'katana' && b.style !== 'saber' && rnd() < 0.18) b.curve = Math.round((rnd() - 0.4) * 24);
    }
    cfg.guard.style = style === 'energy' ? pick(['none', 'winged', 'cross']) : pick(['cross', 'winged', 'drooped', 'crescent', 'horned', 'disc']);
    cfg.guard.width = 1.4 + rnd() * 1.6;
    cfg.guard.ends = rnd() < 0.35 ? 'ball' : 'none';
    cfg.grip.length = 0.9 + rnd() * 0.7;
    cfg.pommel.style = pick(['ball', 'ball', 'disc', 'cap', 'spike']);
    cfg.gem.where = pick(['none', 'guard', 'pommel', 'all']);
    applyPalette(cfg, pal);
    cfg.effects = [];
    const kinds = ['glow', 'particles', 'trail', 'aura', 'arcs'];
    const picks = [];
    if (rnd() < 0.9) picks.push('trail');
    if (rnd() < 0.7) picks.push('glow');
    if (rnd() < 0.8) picks.push('particles');
    if (rnd() < 0.25) picks.push('aura');
    if (rnd() < 0.15) picks.push('arcs');
    if (rnd() < 0.08) picks.push('rainbow');
    picks.forEach((k) => {
      const layer = SF.makeLayer(k);
      paintLayer(layer, pal);
      if (k === 'particles') {
        layer.style = pal.hint.particles || pick(SF.PARTICLE_STYLE_IDS);
        layer.trigger = pick(['idle', 'idle', 'swing', 'burst']);
        layer.where = pick(['blade', 'blade', 'tip']);
        layer.density = 0.8 + rnd() * 0.8;
        layer.count = 20 + Math.floor(rnd() * 20);
        if (layer.style === 'rainbow') { layer.color1 = '#ff4d4d'; layer.color2 = '#a24dff'; }
      }
      cfg.effects.push(layer);
    });
    void kinds;
    cfg.combat.damage = 14 + Math.floor(rnd() * 20);
    cfg.combat.cooldown = Math.round((0.3 + rnd() * 0.4) * 20) / 20;
    cfg.combat.swing = pick(['combo', 'combo', 'slash']);
    if (pal.hint.enchant && rnd() < 0.8) cfg.combat.enchants[pal.hint.enchant].on = true;
    if (rnd() < 0.25) cfg.combat.enchants.knockback.on = true;
    if (rnd() < 0.2) { cfg.combat.wave.mode = 'finisher'; cfg.combat.wave.color = pal.glow; }
    cfg.name = pick(NAME_A) + ' ' + pick(NAME_B);
    loadConfig(cfg, {});
    toast('Rolled "' + state.cfg.name + '"', 'good', 'dice');
  }

  /* ------------------------------------------------------- syntax highlighting */
  const LUA_KW = new Set(['and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then', 'true', 'until', 'while', 'continue']);
  const LUA_API = new Set(['game', 'workspace', 'script', 'Instance', 'Vector3', 'Vector2', 'CFrame', 'Color3', 'ColorSequence', 'ColorSequenceKeypoint', 'NumberSequence', 'NumberSequenceKeypoint', 'NumberRange', 'Enum', 'OverlapParams', 'RaycastParams', 'task', 'math', 'table', 'string', 'os', 'pcall', 'pairs', 'ipairs', 'print', 'warn', 'tostring', 'tonumber', 'type', 'select']);
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function highlight(code, depth) {
    const re = /(--\[(=*)\[[\s\S]*?\]\2\])|(--[^\n]*)|(\[(=*)\[[\s\S]*?\]\5\])|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)/g;
    let out = '', last = 0, m;
    while ((m = re.exec(code))) {
      out += esc(code.slice(last, m.index));
      last = m.index + m[0].length;
      if (m[1] || m[3]) out += '<span class="tk-com">' + esc(m[0]) + '</span>';
      else if (m[4]) {
        const eqs = m[5].length;
        if (eqs >= 2 && !depth) {                      // the Script that lives inside the Tool: highlight it as code
          const open = '[' + m[5] + '[', close = ']' + m[5] + ']';
          out += '<span class="tk-str">' + esc(open) + '</span>' + highlight(m[0].slice(open.length, m[0].length - close.length), 1) + '<span class="tk-str">' + esc(close) + '</span>';
        } else out += '<span class="tk-str">' + esc(m[0]) + '</span>';
      } else if (m[6]) out += '<span class="tk-str">' + esc(m[0]) + '</span>';
      else if (m[7]) out += '<span class="tk-num">' + m[0] + '</span>';
      else if (m[8]) {
        const w = m[8];
        if (LUA_KW.has(w)) out += '<span class="tk-kw">' + w + '</span>';
        else if (LUA_API.has(w)) out += '<span class="tk-api">' + w + '</span>';
        else if (code[last] === '(' ) out += '<span class="tk-fn">' + w + '</span>';
        else out += w;
      }
    }
    return out + esc(code.slice(last));
  }

  /* ------------------------------------------------------------ export dialog */
  let codeTimer = 0;
  let lastGen = null;
  let exportPart = 'sword';                       // which script the code view shows: 'sword' or 'animator'
  const shownText = () => {
    const gen = lastGen || SF.generate(state.cfg, state.mode);
    return exportPart === 'animator' && gen.animator && state.mode === 'script' ? gen.animator : gen.code;
  };
  const exportOpen = () => $('#export-dlg').open;
  function scheduleCode() { clearTimeout(codeTimer); codeTimer = setTimeout(updateCode, 140); }

  function updateCode() {
    const dlg = $('#export-dlg');
    if (!dlg.open) return;
    const gen = SF.generate(state.cfg, state.mode);
    lastGen = gen;
    const tabs = $('.part-tabs', dlg);
    const hasTabs = !!gen.animator && state.mode === 'script';
    if (tabs) {
      tabs.hidden = !hasTabs;
      if (!hasTabs) exportPart = 'sword';
      [...tabs.children].forEach((b, i) => b.setAttribute('aria-pressed', String(['sword', 'animator'][i] === exportPart)));
      const copyLab = $('.copy-lab', dlg);
      if (copyLab) copyLab.textContent = hasTabs && exportPart === 'animator' ? 'Copy animator' : 'Copy script';
    }
    const text = shownText();
    const pre = $('.code', dlg), gut = $('.gut', dlg);
    pre.innerHTML = highlight(text);
    const n = text.split('\n').length;
    gut.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n');
    $('.code-meta', dlg).textContent = (n - 1) + ' lines · ' + (text.length / 1024).toFixed(1) + ' KB';
    $('.sheet-head h2', dlg).textContent = state.cfg.name;
    renderSummary();
  }

  function renderSummary() {
    const box = $('#export-summary');
    if (!box) return;
    const d = SF.describe(state.cfg);
    box.innerHTML = '';
    put(box,
      h('li', {}, h('b', {}, d.parts + ' parts'), ' welded into one Tool, ', d.length.toFixed(1), ' studs long'),
      h('li', {}, h('b', {}, d.effects + ' effect' + (d.effects === 1 ? '' : 's')), ' (glow, particles, trails...)'),
      h('li', {}, h('b', {}, state.cfg.combat.damage + ' damage'), ' per hit, ', state.cfg.combat.cooldown + 's cooldown'),
      d.powers.length ? h('li', {}, h('b', {}, 'Powers: '), d.powers.join(' · ')) : null,
      d.animations.length ? h('li', {}, h('b', {}, 'Animations: '), d.animations.join(', ')) : null
    );
  }

  function openExport() {
    const dlg = $('#export-dlg');
    dlg.innerHTML = '';
    exportPart = 'sword';
    const stepsEl = h('ol', { class: 'steps' });
    const modeNote = h('p', { class: 'hint-text', style: { marginTop: '8px' } });
    const animated = !!SF.animData(state.cfg.anim);
    const paintSteps = () => {
      stepsEl.innerHTML = '';
      const S = state.mode === 'script' ? [
        ['Open your game', 'Open Roblox Studio and your place. Show the Explorer (View > Explorer).'],
        ['Add a Script', 'Hover ServerScriptService, click the + and choose Script. Delete the line of code it starts with.'],
        ['Paste and press Play', 'Paste everything you copied. Press Play, then press 1 and click to swing.'],
      ].concat(animated ? [['Add the animator', 'For the animations: right-click your new Script > Insert Object > LocalScript, name it SwordForgeAnimator, then copy the Animator tab here and paste it in. Skip it and the sword still animates, just rougher. (Or use the Studio file: it has it built in.)']] : []) : [
        ['Open the Command Bar', 'In Studio choose View > Command Bar.'],
        ['Paste and press Enter', 'Paste everything you copied into the bar and press Enter.'],
        ['Find your sword', 'It appears in StarterPack. Press Play to try it, or edit its parts first.'],
      ];
      S.forEach(([t, d], i) => stepsEl.append(h('li', {}, h('span', { class: 'n' }, String(i + 1)), h('div', {}, h('b', {}, t), h('p', {}, d)))));
      modeNote.textContent = state.mode === 'script'
        ? 'The easiest way. The script lives in your game and hands the sword to every player.'
        : 'Builds a real Tool you can open up, edit and save to your Toolbox.';
    };
    const modeSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'How to install' });
    [['script', 'In a Script'], ['commandbar', 'Command Bar']].forEach(([v, l]) => {
      modeSeg.append(h('button', { type: 'button', 'aria-pressed': String(state.mode === v), onclick: () => {
        state.mode = v; store.set('mode', v);
        [...modeSeg.children].forEach((b, i) => b.setAttribute('aria-pressed', String(['script', 'commandbar'][i] === v)));
        paintSteps(); updateCode();
      } }, l));
    });
    paintSteps();

    const flip = h('input', { type: 'checkbox', role: 'switch', 'aria-label': 'Flip wedge direction' });
    flip.checked = !!state.cfg.wedgeFlip;
    flip.addEventListener('change', () => { state.cfg.wedgeFlip = flip.checked; commit({ keepPreset: true }); pushHistory(); });

    const doCopy = async () => {
      const ok = await copyText(shownText());
      if (ok) toast('Copied! Now paste it into Studio.', 'good', 'copy');
      else { selectCode(); toast('Press Ctrl+C to copy the selected code', 'warn', 'help'); }
    };
    const copyBtn = h('button', { type: 'button', class: 'btn primary', onclick: doCopy }, iconEl('copy', 17), h('span', { class: 'copy-lab' }, 'Copy script'));
    // Studio file: a .rbxmx you drag into Explorer. The Artifact viewer blocks plain downloads, so it goes through the `downloads` capability as a .zip.
    const studioBtn = h('button', { type: 'button', class: 'btn', title: 'A file you drag into Roblox Studio, no copy and paste', onclick: async () => {
      try {
        const xml = SF.rbxmx(state.cfg), fn = SF.rbxmxFileName(state.cfg);
        if (ENV.canDownload) { downloadText(fn, xml, 'application/xml'); toast('Saved. Drag it into Studio.', 'good', 'check'); return; }
        const dl = await claude.use('downloads');
        if (!dl) { toast('Saving files is not available here. Use Copy script.', 'warn', 'help'); return; }
        await dl.save({ filename: fn.replace(/\.rbxmx$/, '') + '.zip', data: SF.zip([{ name: fn, text: xml }]) });
        toast('Saved. Unzip it, then drag the file into Studio.', 'good', 'check');
      } catch (err) { if (!err || err.code !== 'declined') toast('Could not save the file. Use Copy script.', 'warn', 'help'); }
    } }, iconEl('download', 17), ENV.canDownload ? 'Studio file (.rbxmx)' : 'Studio file (.zip)');
    const dlBtn = ENV.canDownload ? h('button', { type: 'button', class: 'btn', onclick: () => {
      const base = state.cfg.name.replace(/[^A-Za-z0-9]+/g, '_') || 'Sword';
      if (exportPart === 'animator' && state.mode === 'script') downloadText('SwordForgeAnimator.client.lua', shownText());
      else downloadText(base + (state.mode === 'script' ? '.server.lua' : '_builder.lua'), shownText());
    } }, iconEl('download', 17), 'Download .lua') : null;

    dlg.append(
      h('div', { class: 'sheet-head' },
        h('div', { class: 'brand-mark', html: ico('sword', 20), style: { width: '30px', height: '30px' } }),
        h('h2', { id: 'export-title' }, state.cfg.name),
        h('button', { type: 'button', class: 'btn primary head-copy', onclick: doCopy }, iconEl('copy', 16), 'Copy'),
        h('button', { type: 'button', class: 'btn icon ghost', 'aria-label': 'Close', html: ico('close'), onclick: () => dlg.close() })),
      h('div', { class: 'sheet-body' },
        h('div', { class: 'sheet-side' },
          h('div', { class: 'eyebrow', style: { marginBottom: '8px' } }, 'How to install'),
          modeSeg, modeNote, stepsEl,
          h('p', { class: 'hint-text' }, h('b', {}, 'No copy and paste: '), 'press ', h('b', {}, 'Studio file'), ', then drag it onto ServerScriptService in the Explorer (or right-click it > Insert from File). It is the same sword as the In a Script option.'),
          h('details', { class: 'fold', open: true }, h('summary', {}, 'What is in this sword'), h('ul', { class: 'summary-list', id: 'export-summary' })),
          h('details', { class: 'fold' }, h('summary', {}, 'Something is not working?'),
            h('ul', {},
              h('li', {}, 'It must be a ', h('b', {}, 'Script'), ' (not a LocalScript) in ServerScriptService, and you must press Play. Check the Output window for red text.'),
              h('li', {}, 'Click once to swing. With the 3-hit combo, the third swing is a stronger lunge.'),
              h('li', {}, 'To change damage or cooldown, edit the numbers in ', h('b', {}, 'STATS'), ' at the top of the script.')),
            h('div', { class: 'field row', style: { marginTop: '10px' } }, h('div', { class: 'lab' }, 'Blade tip looks broken in Studio?'), h('span', { class: 'switch' }, flip, h('i'))),
            h('p', { class: 'hint-text' }, 'Turn this on to flip every wedge piece. It only matters if the pointed tip or edges look inside-out in Studio.'))
        ),
        h('div', { class: 'sheet-main' },
          h('div', { class: 'code-bar' }, copyBtn, studioBtn, dlBtn, h('span', { class: 'grow' }), h('span', { class: 'code-meta' })),
          h('div', { class: 'part-row' },
            h('div', { class: 'seg part-tabs', role: 'group', 'aria-label': 'Which script to show', hidden: true },
              h('button', { type: 'button', 'aria-pressed': 'true', onclick: () => { exportPart = 'sword'; updateCode(); } }, 'Sword Script'),
              h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => { exportPart = 'animator'; updateCode(); } }, 'Animator (LocalScript)'))),
          h('div', { class: 'code-wrap', tabindex: '0', 'aria-label': 'Generated Luau script' }, h('pre', { class: 'gut', 'aria-hidden': 'true' }), h('pre', { class: 'code' }))
        )
      )
    );
    dlg.showModal();
    updateCode();
  }
  function onBackdrop(e) { if (e.target === e.currentTarget) e.currentTarget.close(); }
  function selectCode() {
    const code = $('#export-dlg .code');
    if (!code) return;
    const r = document.createRange();
    r.selectNodeContents(code);
    const s = getSelection();
    s.removeAllRanges(); s.addRange(r);
  }
  function downloadText(name, text, type) {
    const blob = new Blob([text], { type: type || 'text/plain' });
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ---------------------------------------------------------- library dialog */
  const toB64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const fromB64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));
  function parseSwordCode(text) {
    text = String(text || '').trim();
    const m = text.match(/#s=([A-Za-z0-9_\-]+)/);
    if (m) text = fromB64(m[1]);
    else if (!/^[\[{]/.test(text) && /^[A-Za-z0-9_\-]{40,}$/.test(text)) text = fromB64(text);
    const obj = JSON.parse(text);
    if (!obj || typeof obj !== 'object') throw new Error('not a sword');
    return SF.normalize(obj);
  }
  const saved = () => store.get('saved', []);

  function openLibrary() {
    const dlg = $('#library-dlg');
    const render = () => {
      dlg.innerHTML = '';
      const list = saved();
      const nameIn = h('input', { type: 'text', class: 'textin', maxlength: 32, 'aria-label': 'Name for the saved sword' });
      nameIn.value = state.cfg.name;
      const paste = h('textarea', { rows: 4, class: 'textin', placeholder: 'Paste a sword code here', 'aria-label': 'Sword code', style: { display: 'none', marginTop: '8px' } });
      const pasteGo = h('button', { type: 'button', class: 'btn', style: { display: 'none', marginTop: '8px' }, onclick: () => {
        try { loadConfig(parseSwordCode(paste.value)); dlg.close(); toast('Sword loaded', 'good', 'check'); } catch (e) { toast('That does not look like a sword code', 'warn', 'help'); }
      } }, 'Load this sword');
      const rows = list.length ? list.map((s) => h('div', { class: 'mine-row' },
        h('span', { class: 'nm', title: s.name }, s.name),
        h('button', { type: 'button', class: 'btn small', onclick: () => { loadConfig(s.cfg); dlg.close(); } }, 'Load'),
        h('button', { type: 'button', class: 'btn small icon ghost danger', 'aria-label': 'Delete ' + s.name, html: ico('trash', 15), onclick: () => { store.set('saved', saved().filter((x) => x.id !== s.id)); render(); } })))
        : [h('p', { class: 'empty-note' }, 'Nothing saved yet. Swords you save stay in this browser.')];
      const fileIn = h('input', { type: 'file', accept: '.json,application/json,.txt', class: 'sr', 'aria-label': 'Import a sword file', onchange: async (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        try { loadConfig(parseSwordCode(await f.text())); dlg.close(); toast('Sword loaded', 'good', 'check'); } catch (err) { toast('Could not read that file', 'warn', 'help'); }
      } });
      dlg.append(
        h('div', { class: 'sheet-head' }, h('h2', { id: 'library-title' }, 'My swords'), h('button', { type: 'button', class: 'btn icon ghost', 'aria-label': 'Close', html: ico('close'), onclick: () => dlg.close() })),
        h('div', { style: { padding: '16px', overflow: 'auto', display: 'grid', gap: '20px' } },
          h('section', {}, h('div', { class: 'eyebrow', style: { marginBottom: '8px' } }, 'Save this sword'),
            h('div', { style: { display: 'flex', gap: '8px' } }, h('div', { style: { flex: 1, minWidth: 0 } }, nameIn), h('button', { type: 'button', class: 'btn primary', onclick: () => {
              const name = nameIn.value.trim() || state.cfg.name;
              const copy = SF.clone(state.cfg); copy.name = name;
              store.set('saved', [{ id: SF.newId(), name, cfg: copy, ts: Date.now() }].concat(saved()).slice(0, 40));
              toast('Saved "' + name + '"', 'good', 'save'); render();
            } }, iconEl('save', 16), 'Save'))),
          h('section', {}, h('div', { class: 'eyebrow', style: { marginBottom: '8px' } }, 'Saved swords (' + list.length + ')'), h('div', { class: 'mine-list' }, rows)),
          h('section', {}, h('div', { class: 'eyebrow', style: { marginBottom: '8px' } }, 'Share or back up'),
            h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
              h('button', { type: 'button', class: 'btn', onclick: async () => { (await copyText(JSON.stringify(state.cfg))) ? toast('Sword code copied', 'good', 'copy') : toast('Could not copy', 'warn', 'help'); } }, iconEl('copy', 16), 'Copy sword code'),
              h('button', { type: 'button', class: 'btn', onclick: () => { paste.style.display = 'block'; pasteGo.style.display = 'inline-flex'; paste.focus(); } }, iconEl('upload', 16), 'Paste a code'),
              ENV.canShareLink ? h('button', { type: 'button', class: 'btn', onclick: async () => {
                const url = location.href.split('#')[0] + '#s=' + toB64(JSON.stringify(state.cfg));
                (await copyText(url)) ? toast('Link copied. Anyone who opens it gets this sword.', 'good', 'link') : toast('Could not copy', 'warn', 'help');
              } }, iconEl('link', 16), 'Copy share link') : null,
              ENV.canDownload ? h('button', { type: 'button', class: 'btn', onclick: () => downloadText((state.cfg.name.replace(/[^A-Za-z0-9]+/g, '_') || 'sword') + '.sword.json', JSON.stringify(state.cfg, null, 2), 'application/json') }, iconEl('download', 16), 'Download file') : null,
              h('label', { class: 'btn', style: { position: 'relative' } }, iconEl('upload', 16), 'Open file', fileIn)),
            paste, pasteGo)
        )
      );
    };
    render();
    dlg.showModal();
  }

  /* ------------------------------------------------------------------- init */
  function bindGlobal() {
    $('#sword-name').addEventListener('input', (e) => { state.cfg.name = e.target.value; commit({ keepPreset: true }); });
    $('#sword-name').addEventListener('change', pushHistory);
    document.addEventListener('keydown', (e) => {
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); return; }
      if (typing || mod || e.altKey || document.querySelector('dialog[open]')) return;
      if (e.key === ' ' && (t === document.body || t.classList.contains('stage-canvas'))) { e.preventDefault(); preview && preview.swing(); }
      else if (e.key.toLowerCase() === 'r') randomize();
    });
    ['#export-dlg', '#library-dlg'].forEach((id) => $(id).addEventListener('click', onBackdrop));
    document.addEventListener('visibilitychange', () => { if (preview) { document.hidden ? preview.stop() : preview.start(); } });
  }

  function init() {
    $('#brand-mark').innerHTML = ico('sword', 20);
    const saveTheme = store.get('theme', null);
    if (saveTheme && !ENV.artifact) document.documentElement.setAttribute('data-theme', saveTheme);

    glOK = SF.Preview.supported();
    if (glOK) {
      try {
        preview = new SF.Preview($('#stage'), { autoRotate: state.stage.spin });
        preview.setAvatar(state.stage.avatar);
        preview.setTheme(SCENES[state.stage.scene]);
      } catch (e) { preview = null; glOK = false; }
    }
    if (!glOK) { $('#nogl').classList.add('show'); document.body.classList.add('no-gl'); }

    state.tab = store.get('tab', 'blade');
    if (!TABS.some((t) => t[0] === state.tab)) state.tab = 'blade';

    // starting sword: shared link > last session > the Flame Tongue
    let start = null, fromHash = false;
    if (ENV.canShareLink) {
      const m = location.hash.match(/#s=([A-Za-z0-9_\-]+)/);
      if (m) { try { start = parseSwordCode(m[1]); fromHash = true; } catch (e) { start = null; } }
    }
    if (!start) { const s = store.get('current', null); if (s) { try { start = SF.normalize(s); } catch (e) { start = null; } } }
    let presetId = null;
    if (!start) { const p = SF.presetById('flame'); start = SF.clone(p.cfg); presetId = p.id; }
    state.cfg = SF.normalize(start);
    state.presetId = presetId;
    void fromHash;

    buildTopActions();
    buildStageUI();
    buildTabs();
    buildPalettes();
    buildGallery();
    bindGlobal();
    paintThemeButton();
    refreshAll({ equip: true });
    pushHistory();
    markPreset();
    if (preview) { preview.start(); preview.frameCamera(true); }
    if (!glOK) document.querySelectorAll('.card canvas, .pick canvas').forEach((c) => { c.style.display = 'none'; });
  }

  SF.app = { state, commit, loadConfig, randomize, openExport, openLibrary, undo, redo, highlight, get preview() { return preview; } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})((globalThis.SF = globalThis.SF || {}));
