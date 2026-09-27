(() => {
  'use strict';

  const G = window.GUIDE;
  const view = document.getElementById('view');
  const navbar = document.getElementById('navbar');
  const params = new URLSearchParams(location.search);

  // ---------- helpers ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hash = s => { let x = 5381; for (const c of s) x = ((x << 5) + x + c.codePointAt(0)) | 0; return (x >>> 0).toString(36); };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const WD = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const WDS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
  const parseD = d => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)); };
  const wd = d => parseD(d).getUTCDay();
  const dm = d => { const [, m, dd] = d.split('-'); return `${+dd}/${+m}`; };
  const dayLabel = d => `${WDS[wd(d)]} ${dm(d)}`;
  const diffDays = (a, b) => Math.round((parseD(b) - parseD(a)) / 864e5);
  const cityName = c => T.cities[c]?.name || '';

  function nowRome() {
    if (params.get('date')) return { date: params.get('date'), time: params.get('time') || '12:00' };
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const p = Object.fromEntries(f.formatToParts(new Date()).map(x => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
  }

  // ---------- symbols (SF Symbols-like, 24pt grid) ----------
  const S = (d, w = 1.9) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const F = d => `<path d="${d}" fill="currentColor" fill-rule="evenodd"/>`;
  const ICONS = {
    building: S('M3.5 9.5L12 4.5l8.5 5M5.5 10v7.5M9.8 10v7.5M14.2 10v7.5M18.5 10v7.5M3.5 19.5h17'),
    fork: S('M7 3.5v6a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2v-6M9 3.5v17M17 20.5V3.5c-2.2 1.3-3.3 3.8-3.3 6.8v2.7H17'),
    cup: S('M4.5 9h11.5v4.5a4.5 4.5 0 0 1-4.5 4.5H9a4.5 4.5 0 0 1-4.5-4.5zM16 10.5h1.5a2.3 2.3 0 0 1 0 4.6H16M3.5 20.5h15M8.5 3.5c-.8 1 .8 2 0 3M12 3.5c-.8 1 .8 2 0 3'),
    basket: S('M3.5 10h17l-1.8 8.8a1.5 1.5 0 0 1-1.5 1.2H6.8a1.5 1.5 0 0 1-1.5-1.2zM8.3 10l3-5.5M15.7 10l-3-5.5M9 13.5v3.5M12 13.5v3.5M15 13.5v3.5'),
    tree: S('M12 3l4.3 5.8h-2.4l3.9 5.2h-2.9l3.4 4.5H5.7l3.4-4.5H6.2l3.9-5.2H7.7zM12 18.5v3'),
    map: S('M9 4.5l-5 2v13l5-2 6 2 5-2v-13l-5 2zM9 4.5v13M15 6.5v13'),
    sparkles: S('M11 3.5l1.7 4.8 4.8 1.7-4.8 1.7L11 16.5l-1.7-4.8L4.5 10l4.8-1.7zM18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z'),
    airplane: F('M21 15.6v-2.1l-7.6-4.8V4.2a1.4 1.4 0 0 0-2.8 0v4.5L3 13.5v2.1l7.6-2.4v4.3l-2.1 1.5v1.6l3.5-1 3.5 1v-1.6l-2.1-1.5v-4.3z'),
    bed: S('M3 18.5V7M3 14.5h18v4M21 14.5v-2.8a2.7 2.7 0 0 0-2.7-2.7H11v5.5M7 13a1.9 1.9 0 1 0 0-3.8A1.9 1.9 0 0 0 7 13z'),
    lock: S('M6.5 11h11a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V12a1 1 0 0 1 1-1zM8.5 11V8a3.5 3.5 0 0 1 7 0v3'),
    sync: S('M19.5 9.5A8 8 0 0 0 5 7.5M4.5 14.5A8 8 0 0 0 19 16.5M5 3.5v4h4M19 20.5v-4h-4'),
    train: S('M7.5 3.5h9A2.5 2.5 0 0 1 19 6v9a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 15V6a2.5 2.5 0 0 1 2.5-2.5zM5 11h14M8.5 14.3h.01M15.5 14.3h.01M8 17.5l-2 3M16 17.5l2 3', 2),
    metro: S('M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zM8 16V8.5l4 5 4-5V16'),
    cloudsun: S('M8 3.5v1.6M3.5 9.5h1.6M4.8 5.8l1.1 1.1M11.2 5.8l-1.1 1.1M5.8 11.8a3.2 3.2 0 0 1 5.6-3M8.5 20.5h9a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6 1.3 2.9 2.9 0 0 0 .3 5.7z'),
    bulb: S('M9 17.5h6M10 20.5h4M12 3.5a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1v.6h5v-.6c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3.5z'),
    bubble: S('M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z'),
    grid: S('M5.5 4.5h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zM14.5 4.5h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zM5.5 13.5h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zM14.5 13.5h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z'),
    cross: F('M9.3 3.5h5.4v5.8h5.8v5.4h-5.8v5.8H9.3v-5.8H3.5V9.3h5.8z'),
    phone: F('M6.6 3.3h2.2c.4 0 .8.3.9.7l1 3.6c.1.4 0 .8-.3 1l-1.6 1.3a11.5 11.5 0 0 0 5.3 5.3l1.3-1.6c.3-.3.7-.4 1-.3l3.6 1c.4.1.7.5.7.9v2.2a2.1 2.1 0 0 1-2.3 2.1A16.6 16.6 0 0 1 4.5 5.6a2.1 2.1 0 0 1 2.1-2.3z'),
    envelope: S('M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17V7A1.5 1.5 0 0 1 5 5.5zM4 6.5l8 6.5 8-6.5'),
    globe: S('M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zM3.5 12h17M12 3.5c2.4 2.3 3.6 5.1 3.6 8.5S14.4 18.2 12 20.5M12 3.5C9.6 5.8 8.4 8.6 8.4 12s1.2 6.2 3.6 8.5'),
    directions: S('M12 2.8l9.2 9.2-9.2 9.2L2.8 12zM9.2 15v-2.3a1.5 1.5 0 0 1 1.5-1.5h5M13.5 8.8l2.4 2.4-2.4 2.4'),
    car: S('M5 16.5V19M19 16.5V19M4 16.5h16v-4.2L18 7H6l-2 5.3zM4 12.3h16M7.5 14.4h.01M16.5 14.4h.01', 2),
    heart: S('M12 20.2s-7.6-4.6-9.2-9.5C1.7 7.2 3.9 4 7.3 4c2 0 3.6 1.1 4.7 2.7C13.1 5.1 14.7 4 16.7 4c3.4 0 5.6 3.2 4.5 6.7-1.6 4.9-9.2 9.5-9.2 9.5z'),
    heartFill: F('M12 20.2s-7.6-4.6-9.2-9.5C1.7 7.2 3.9 4 7.3 4c2 0 3.6 1.1 4.7 2.7C13.1 5.1 14.7 4 16.7 4c3.4 0 5.6 3.2 4.5 6.7-1.6 4.9-9.2 9.5-9.2 9.5z'),
    plus: S('M12 5v14M5 12h14', 2.2),
    xmark: S('M7 7l10 10M17 7L7 17', 2.3),
    check: S('M5 12.5l4.5 4.5L19 7.5', 2.4),
    clock: S('M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zM12 7.5V12l3 2'),
    tag: S('M3.5 12.3V4.5a1 1 0 0 1 1-1h7.8l8.2 8.2a1 1 0 0 1 0 1.4l-7.4 7.4a1 1 0 0 1-1.4 0zM8 8h.01', 2),
    link: S('M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'),
    share: S('M12 14.5v-11M8 7.5l4-4 4 4M7.5 10.5H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1.5'),
    doc: S('M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5zM14 3.5v4h4M8.5 12h7M8.5 15.5h7'),
    suitcase: S('M4.5 7.5h15a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1zM9 7.5V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2.5M8 7.5v12.5M16 7.5v12.5'),
    key: S('M14.5 3.5a5 5 0 1 1-4.3 7.5L3.5 17.7v2.8h2.8v-2h2v-2h2l1.4-1.4A5 5 0 0 1 14.5 3.5zM16 8h.01', 2),
    pin: F('M12 2.5a7 7 0 0 0-7 7c0 5.2 7 12 7 12s7-6.8 7-12a7 7 0 0 0-7-7zm0 4.3a2.7 2.7 0 1 1 0 5.4 2.7 2.7 0 0 1 0-5.4z'),
    calendar: S('M6 4.5h12A2 2 0 0 1 20 6.5v11.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2zM4 9.5h16M8 3v3M16 3v3'),
    list: S('M3.5 6.3l1.6 1.6 2.9-3.2M3.5 12.3l1.6 1.6 2.9-3.2M3.5 18.3l1.6 1.6 2.9-3.2M11 6.8h9.5M11 12.8h9.5M11 18.8h9.5'),
    star: F('M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z'),
    info: S('M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zM12 11v5.5M12 7.8v.1', 2),
    umbrella: S('M12 3.5a8.5 8.5 0 0 1 8.5 8.5h-17A8.5 8.5 0 0 1 12 3.5zM12 12v6.5a2 2 0 0 1-4 0')
  };
  const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  const CAT_STYLE = {
    sight: ['building', 'var(--orange)'], food: ['fork', 'var(--red)'], sweet: ['cup', 'var(--brown)'],
    market: ['basket', 'var(--green)'], xmas: ['tree', 'var(--teal)'], area: ['map', 'var(--blue)'], exp: ['sparkles', 'var(--purple)']
  };
  const catIcon = cat => { const [n, c] = CAT_STYLE[cat] || ['pin', 'var(--gray)']; return `<span class="row-icon" style="background:${c}">${icon(n)}</span>`; };
  const catGlyph = cat => icon((CAT_STYLE[cat] || ['pin'])[0]);
  const sqIcon = (name, color) => `<span class="row-icon" style="background:${color}">${icon(name)}</span>`;
  const glyph = name => `<span class="row-glyph">${icon(name)}</span>`;
  const chevron = '<span class="chevron" aria-hidden="true"></span>';

  // ---------- local store: every value is [value, timestamp] so two phones can merge ----------
  const KEY = 'rome26';
  let kv = {};
  try { kv = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { kv = {}; }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(kv)); } catch { toast('לא הצלחתי לשמור בטלפון'); } };
  const get = k => (kv[k] ? kv[k][0] : undefined);
  const set = (k, v) => { kv[k] = [v, Date.now()]; persist(); };
  const del = k => set(k, null);
  const prefixed = prefix => Object.entries(kv)
    .filter(([k, e]) => k.startsWith(prefix) && e[0] !== null && e[0] !== undefined)
    .map(([k, e]) => ({ key: k, id: k.slice(prefix.length), val: e[0], ts: e[1] }));
  function merge(incoming) {
    let n = 0;
    for (const [k, e] of Object.entries(incoming || {})) {
      if (!Array.isArray(e) || typeof e[1] !== 'number') continue;
      if (!kv[k] || kv[k][1] < e[1]) { kv[k] = e; n++; }
    }
    persist();
    return n;
  }
  // change a value and offer Undo (instead of asking "are you sure?")
  function changeWithUndo(key, value, msg) {
    const prev = get(key);
    set(key, value);
    refresh();
    toast(msg, () => { set(key, prev === undefined ? null : prev); refresh(); });
  }

  // ---------- data: the public guide + the private trip (stored under "trip", arrives only via a link) ----------
  // Hebrew text with Latin names: keep "←" chains and "Name (…)" in reading order by adding RLM marks.
  // Only display fields are touched; ids, map queries and list items (used as keys) stay as written.
  const BIDI_KEYS = new Set(['title', 'note', 'short', 'desc', 'tips', 'intro', 'text', 'skipReason', 'hours', 'price', 'metro', 'name']);
  const bidi = s => s
    .replace(/\s*←\s*/g, ' ‏←‏ ')
    .replace(/([A-Za-zÀ-ɏ'’.])(\s*)\(/g, '$1‏$2(');
  function walk(o) {
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (typeof v === 'string') { if (BIDI_KEYS.has(k)) o[k] = bidi(v); }
      else if (Array.isArray(v)) v.forEach((x, i) => { if (typeof x === 'string') { if (BIDI_KEYS.has(k)) v[i] = bidi(x); } else if (x && typeof x === 'object') walk(x); });
      else if (v && typeof v === 'object') walk(v);
    }
    return o;
  }

  let T, P, CAT, basePlan, hasTrip;
  function rebuild() {
    const guide = JSON.parse(JSON.stringify(G));
    const trip = get('trip') ? JSON.parse(JSON.stringify(get('trip'))) : null;
    hasTrip = !!trip;
    const t = trip || {};
    const ov = t.overrides || {};
    const places = [...guide.places, ...(t.places || [])].map(p => {
      const o = ov[p.id];
      const out = o ? { ...p, ...o, tips: [...(p.tips || []), ...(o.tips || [])] } : { ...p };
      if (out.status === 'rec') delete out.status;   // "recommendation" is simply no status
      return out;
    });
    const lists = guide.lists.map(l => ({ ...l, items: (t.lists || []).find(x => x.id === l.id)?.items || [] }));
    T = walk({
      ...guide, ...t,
      title: t.title || 'רומא',
      days: t.days || [], reminders: t.reminders || [], flights: t.flights || [], flightNotes: t.flightNotes || [],
      vault: t.vault || [], prepaid: t.prepaid || [], airportNotes: t.airportNotes || [],
      hotel: t.hotel || null, apps: [...(t.apps || []), ...guide.apps.filter(a => !(t.apps || []).some(x => x.name === a.name))],
      emergency: [...guide.emergency, ...(t.hotel ? [{ name: 'המלון', phone: t.hotel.phone }] : [])],
      lists, places
    });
    P = Object.fromEntries(T.places.map(p => [p.id, p]));
    CAT = Object.fromEntries(T.categories.map(c => [c.id, c]));
    basePlan = {};
    for (const d of T.days) for (const it of d.items || []) if (it.place) (basePlan[it.place] ||= new Set()).add(d.date);
    for (const d of T.days) {
      const refs = [...(d.items || []), ...(d.suggestions || []).flatMap(s => s.items)];
      for (const it of refs) for (const id of [it.place, ...(it.alts || [])]) if (id && !P[id]) console.warn('Unknown place id:', id, 'on', d.date);
    }
  }
  rebuild();

  function planDays(pid) {
    const s = new Set(basePlan[pid] || []);
    for (const a of prefixed('add:')) if (a.val.place === pid) s.add(a.id.split(':')[0]);
    return [...s].sort();
  }

  // ---------- links ----------
  const placeQuery = p => p.q || (p.en.includes(',') ? p.en : `${p.en}, ${T.cities[p.city].en}`);
  const mapUrl = q => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  const navUrl = q => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}&travelmode=transit`;
  const hotelQ = () => `${T.hotel.name}, ${T.hotel.address}`;
  const telUrl = p => 'tel:' + p.replace(/[^\d+]/g, '');
  const ext = 'target="_blank" rel="noopener"';

  // ---------- building blocks ----------
  let navActions = '';
  const largeTitle = (text, kicker) => `${kicker ? `<p class="kicker">${kicker}</p>` : ''}<h1 class="large-title">${esc(text)}</h1>`;
  const section = (body, { header = '', action = '', footer = '', tag = 'div' } = {}) =>
    `<section class="list-section">${header || action ? `<h2 class="list-header"><span>${header}</span>${action}</h2>` : ''}<${tag} class="list">${body}</${tag}>${footer ? `<p class="list-footer">${footer}</p>` : ''}</section>`;
  const tile = ({ href, act, icon: ic, label, prominent, external }) => href
    ? `<a class="tile ${prominent ? 'prominent' : ''}" href="${href}" ${external ? ext : ''}>${icon(ic)}${label}</a>`
    : `<button class="tile ${prominent ? 'prominent' : ''}" data-act="${act}">${icon(ic)}${label}</button>`;
  const tiles = arr => `<div class="tiles">${arr.join('')}</div>`;
  const dateTile = (date, today) => `<span class="date-tile ${today ? 'today' : ''}"><span>${WDS[wd(date)]}</span><b>${parseD(date).getUTCDate()}</b></span>`;
  const STATUS = { booked: ['הוזמן', 't-ok'], paid: ['שולם', 't-ok'], pay: ['לשלם', 't-warn'], check: ['לבדוק', 't-warn'], idea: ['פתוח', 't-idea'] };
  const tag = s => STATUS[s] ? `<span class="tag ${STATUS[s][1]}">${STATUS[s][0]}</span>` : '';

  function toast(msg, undo) {
    const t = document.getElementById('toast');
    t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button">ביטול</button>' : ''}`;
    if (undo) t.querySelector('button').onclick = () => { t.classList.remove('show'); undo(); };
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), undo ? 5000 : 2400);
  }

  // sheet: grabber, Close leading, title, Done trailing; swipe down to dismiss
  const sheet = document.getElementById('sheet');
  const sheetBackdrop = document.getElementById('sheet-backdrop');
  function openSheet({ title, body, done }) {
    sheet.innerHTML = `<div class="sheet-grabber" aria-hidden="true"></div>
      <header class="sheet-bar">
        <button class="icon-btn glass-circle" data-act="close" aria-label="סגירה">${icon('xmark')}</button>
        <h2>${esc(title)}</h2>
        ${done ? `<button class="icon-btn done" type="submit" form="sheet-form" aria-label="${esc(done)}">${icon('check')}</button>` : '<span></span>'}
      </header>${body}`;
    sheet.hidden = false; sheetBackdrop.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => { sheet.classList.add('open'); sheetBackdrop.classList.add('open'); }));
  }
  function closeSheet() {
    sheet.style.transform = '';
    sheet.classList.remove('open', 'dragging'); sheetBackdrop.classList.remove('open');
    setTimeout(() => { if (!sheet.classList.contains('open')) { sheet.hidden = true; sheetBackdrop.hidden = true; sheet.innerHTML = ''; } }, 300);
  }
  sheetBackdrop.addEventListener('click', closeSheet);
  (function swipeToDismiss() {
    let startY = 0, dy = 0, t0 = 0, dragging = false;
    sheet.addEventListener('pointerdown', e => {
      if (!e.target.closest('.sheet-grabber, .sheet-bar') || e.target.closest('button')) return;
      dragging = true; startY = e.clientY; dy = 0; t0 = performance.now();
      sheet.classList.add('dragging'); sheet.setPointerCapture(e.pointerId);
    });
    sheet.addEventListener('pointermove', e => {
      if (!dragging) return;
      dy = e.clientY - startY;
      sheet.style.transform = `translateY(${dy > 0 ? dy : dy / 6}px)`;
    });
    const end = () => {
      if (!dragging) return;
      dragging = false; sheet.classList.remove('dragging');
      const v = dy / (performance.now() - t0);
      if (dy > sheet.offsetHeight * 0.25 || v > 0.5) closeSheet(); else sheet.style.transform = '';
    };
    sheet.addEventListener('pointerup', end);
    sheet.addEventListener('pointercancel', end);
  })();

  // alert: only for things that need a decision now (loading a link, erasing the phone)
  const alertEl = document.getElementById('alert');
  const alertBackdrop = document.getElementById('alert-backdrop');
  function openAlert({ title, message, buttons }) {
    alertEl.innerHTML = `<h2 id="alert-title">${esc(title)}</h2>${message ? `<p>${message}</p>` : ''}
      <div class="alert-actions">${buttons.map(b => `<button class="btn ${b.cls || 'btn-gray'}" data-act="${b.act}" ${b.data || ''}>${esc(b.label)}</button>`).join('')}</div>`;
    alertEl.setAttribute('aria-labelledby', 'alert-title');
    alertEl.hidden = false; alertBackdrop.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => { alertEl.classList.add('open'); alertBackdrop.classList.add('open'); alertEl.focus(); }));
  }
  function closeAlert() {
    alertEl.classList.remove('open'); alertBackdrop.classList.remove('open');
    setTimeout(() => { if (!alertEl.classList.contains('open')) { alertEl.hidden = true; alertBackdrop.hidden = true; } }, 220);
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('הועתק'); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('הועתק'); } catch { toast('לא הצלחתי להעתיק'); }
      ta.remove();
    }
  }

  // ---------- timeline ----------
  function dayItems(d) {
    const base = (d.items || []).map(it => ({ ...it }));
    const mine = prefixed(`add:${d.date}:`).map(a => ({ ...a.val, mine: a.key }));
    return [...base, ...mine].sort((a, b) => (a.t || '99:99').localeCompare(b.t || '99:99'));
  }

  function tlRow(it, cls = '') {
    const p = it.place && P[it.place];
    const vaultVal = it.vault && get('vault:' + it.vault);
    const q = p ? placeQuery(p) : it.map;
    let actions = '';
    if (p) actions += `<a class="inline-link" href="#/place/${p.id}">${catGlyph(p.cat)}${esc(p.name)}</a>`;
    if (q) actions += `<a class="inline-link" href="${navUrl(q)}" ${ext}>${icon('directions')}נווט</a>`;
    if (it.mine) actions += `<button class="inline-link destructive" data-act="del-add" data-key="${esc(it.mine)}">הסרה</button>`;
    const alts = (it.alts || []).filter(id => P[id]).map(id => `<a class="small-chip" href="#/place/${id}">${esc(P[id].name)}</a>`).join('');
    return `<li class="tl-row ${cls}">
      <div class="tl-time"><span>${esc(it.t || '')}</span>${it.end ? `<small>${esc(it.end)}</small>` : ''}</div>
      <div class="tl-main">
        <div class="tl-title">${esc(it.title)} ${tag(it.status)}${it.mine ? ' <span class="tag t-gray">שלי</span>' : ''}${cls === 'now' ? ' <span class="tag t-now">עכשיו</span>' : ''}</div>
        ${it.note ? `<div class="tl-note">${esc(it.note)}</div>` : ''}
        ${it.vault ? `<div class="tl-note">${vaultVal ? esc(vaultVal) : '<a href="#/info/vault">להשלים פרטים</a>'}</div>` : ''}
        ${actions ? `<div class="tl-actions">${actions}</div>` : ''}
        ${alts ? `<div class="alts"><span class="alts-label">אפשר גם</span>${alts}</div>` : ''}
      </div>
    </li>`;
  }

  function timeline(items, now) {
    let cur = -1;
    if (now) items.forEach((it, i) => { if (it.t && it.t <= now) cur = i; });
    return items.map((it, i) => {
      let cls = '';
      if (now) {
        if (i < cur) cls = 'past';
        else if (i === cur) cls = (it.end && it.end <= now) ? 'past' : 'now';
        else if (i === cur + 1) cls = 'next';
      }
      return tlRow(it, cls);
    }).join('');
  }

  // ---------- weather (Open-Meteo, no key needed) ----------
  const WX = {
    0: ['☀️', 'בהיר'], 1: ['🌤️', 'בהיר ברובו'], 2: ['⛅', 'מעונן חלקית'], 3: ['☁️', 'מעונן'],
    45: ['🌫️', 'ערפל'], 48: ['🌫️', 'ערפל'], 51: ['🌦️', 'טפטוף'], 53: ['🌦️', 'טפטוף'], 55: ['🌦️', 'טפטוף'],
    56: ['🌧️', 'טפטוף קפוא'], 57: ['🌧️', 'טפטוף קפוא'], 61: ['🌧️', 'גשם קל'], 63: ['🌧️', 'גשם'], 65: ['🌧️', 'גשם חזק'],
    66: ['🌧️', 'גשם קפוא'], 67: ['🌧️', 'גשם קפוא'], 71: ['🌨️', 'שלג קל'], 73: ['🌨️', 'שלג'], 75: ['🌨️', 'שלג כבד'], 77: ['🌨️', 'שלג'],
    80: ['🌦️', 'ממטרים'], 81: ['🌦️', 'ממטרים'], 82: ['⛈️', 'ממטרים חזקים'], 85: ['🌨️', 'שלג'], 86: ['🌨️', 'שלג'],
    95: ['⛈️', 'סופת רעמים'], 96: ['⛈️', 'סופת רעמים'], 99: ['⛈️', 'סופת רעמים']
  };
  const WXKEY = 'rome26-wx';
  async function fetchCity(city) {
    let cache = {};
    try { cache = JSON.parse(localStorage.getItem(WXKEY)) || {}; } catch { }
    const c = cache[city];
    if (c && Date.now() - c.at < 3 * 3600e3) return c.data;
    const { lat, lon } = T.cities[city];
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FRome&forecast_days=16`);
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      const data = {};
      j.daily.time.forEach((d, i) => { data[d] = { code: j.daily.weather_code[i], max: j.daily.temperature_2m_max[i], min: j.daily.temperature_2m_min[i], rain: j.daily.precipitation_probability_max[i] }; });
      cache[city] = { at: Date.now(), data };
      try { localStorage.setItem(WXKEY, JSON.stringify(cache)); } catch { }
      return data;
    } catch { return c ? c.data : null; }
  }
  async function fillWeather(el, fromDate) {
    if (!el) return;
    const [rome, flo] = await Promise.all([fetchCity('rome'), fetchCity('florence')]);
    const days = hasTrip ? T.days.filter(d => d.date >= fromDate)
      : Array.from({ length: 7 }, (_, i) => ({ date: new Date(parseD(fromDate).getTime() + i * 864e5).toISOString().slice(0, 10), city: 'rome' }));
    const cells = days.map(d => {
      const w = (d.city === 'florence' ? flo : rome)?.[d.date];
      if (!w) return '';
      const [ic, txt] = WX[w.code] || ['🌡️', ''];
      return `<div class="wx-day" title="${esc(txt)}"><b>${dayLabel(d.date)}</b><span class="wx-ic">${ic}</span><span>${Math.round(w.max)}°/${Math.round(w.min)}°</span><small>${w.rain ?? 0}% גשם</small>${d.city === 'florence' ? '<small>פירנצה</small>' : ''}</div>`;
    }).filter(Boolean);
    if (!el.isConnected) return;
    el.innerHTML = cells.length
      ? `<div class="wx-row">${cells.join('')}</div>`
      : `<div class="text-cell">${hasTrip ? `${esc(T.weatherAvg || '')}<p class="row-sub" style="margin-top:6px">תחזית אמיתית תופיע כאן כשבועיים לפני הטיול.</p>` : '<span class="row-sub">אין כרגע תחזית (צריך אינטרנט).</span>'}</div>`;
  }
  const weatherSection = (header, from) => {
    setTimeout(() => fillWeather(document.getElementById('wx'), from));
    return section('<div id="wx"><div class="text-cell row-sub">טוען…</div></div>', { header, footer: 'תחזית מ-Open-Meteo, מתעדכנת כשיש אינטרנט.' });
  };

  // ---------- views ----------
  const V = {};

  const importRows = () => `<div class="text-cell"><textarea class="row-input" id="imp-code" rows="2" placeholder="הדביקו כאן את הקישור" aria-label="קישור"></textarea></div>
      <button class="row action" data-act="import-paste">${glyph('link')}<span class="row-body">טעינת הקישור</span></button>`;
  const importSection = () => section(importRows(),
    { header: 'קישור הטיול', footer: 'פרטי הטיול לא שמורים באתר. הם נטענים רק מקישור פרטי ונשמרים בטלפון הזה בלבד.' });

  const quickTiles = () => tiles([
    ...(T.hotel
      ? [tile({ href: navUrl(hotelQ()), external: true, icon: 'bed', label: 'למלון' }), tile({ act: 'taxi', icon: 'car', label: 'לנהג' })]
      : [tile({ href: '#/places', icon: 'pin', label: 'מקומות' }), tile({ href: '#/info/tips', icon: 'bulb', label: 'טיפים' })]),
    tile({ href: '#/info/metro', icon: 'metro', label: 'מטרו' }),
    tile({ href: '#/info/emergency', icon: 'cross', label: 'חירום' })
  ]);

  V.today = () => {
    const n = nowRome();
    let h = largeTitle('היום');
    if (!hasTrip) {
      return h + `<section class="hero"><div class="hero-kicker">ברוכים הבאים</div><div class="hero-title">רומא ופירנצה</div>
          <div class="hero-sub">מדריך מקומות, מסעדות ומידע שימושי.</div></section>`
        + importSection() + quickTiles() + weatherSection('מזג אוויר ברומא', n.date);
    }
    const di = T.days.findIndex(d => d.date === n.date);
    if (n.date < T.start) {
      const left = diffDays(n.date, T.start);
      h += `<section class="hero">
        <div class="hero-kicker">${left === 1 ? 'מחר טסים' : 'עוד'}</div>
        ${left === 1 ? '' : `<div class="hero-num">${left}<span>ימים</span></div>`}
        ${T.hero ? `<div class="hero-sub">${esc(T.hero)}</div>` : ''}
      </section>`;
      const rem = T.reminders.filter(r => r.date >= n.date).slice(0, 5);
      if (rem.length) h += section(rem.map(r => {
        const dd = diffDays(n.date, r.date);
        const when = dd === 0 ? 'היום' : dd === 1 ? 'מחר' : `בעוד ${dd} ימים`;
        const inner = `${dateTile(r.date, dd === 0)}<span class="row-body"><span class="row-title">${esc(r.text)}</span><span class="row-sub">${dm(r.date)} · ${when}</span></span>`;
        return r.place ? `<a class="row" href="#/place/${r.place}">${inner}${chevron}</a>` : `<div class="row">${inner}</div>`;
      }).join(''), { header: 'תזכורות' });
      const open = T.days.filter(d => d.suggestions);
      const tl = T.lists.find(x => x.id === 'tasks');
      const tasksLeft = tl ? listItems(tl).filter(it => !get(it.chk)).length : 0;
      h += section(open.map(d => `<a class="row" href="#/day/${d.date}">${dateTile(d.date)}<span class="row-body"><span class="row-title">${esc(d.title)}</span><span class="row-sub">${WD[wd(d.date)]} ${dm(d.date)} · יש הצעה</span></span>${chevron}</a>`).join('')
        + `<a class="row" href="#/lists/tasks">${sqIcon('list', 'var(--orange)')}<span class="row-body"><span class="row-title">משימות לפני הטיול</span></span><span class="row-value">${tasksLeft}</span>${chevron}</a>`,
      { header: 'עוד פתוח' });
      h += quickTiles();
    } else if (n.date > T.end) {
      const been = prefixed('been:').filter(x => x.val).length;
      return h + `<section class="hero"><div class="hero-kicker">ברוכים השבים</div><div class="hero-sub">היו ${T.days.length} ימים, ${been} מקומות סומנו ״היינו״.</div></section>`;
    } else {
      const d = T.days[di];
      h += `<section class="hero">
        <div class="hero-kicker">יום ${di + 1} מתוך ${T.days.length} · ${WD[wd(d.date)]} ${dm(d.date)}${d.city !== 'rome' ? ` · ${cityName(d.city)}` : ''}</div>
        <div class="hero-title">${esc(d.title)}</div>
      </section>`;
      h += quickTiles();
      if (d.tasks) h += section(checkRows(d.tasks, 'day:' + d.date), { header: 'לא לשכוח היום' });
      h += section(timeline(dayItems(d), n.time), { header: 'התוכנית של היום', action: `<a href="#/day/${d.date}">הכל</a>`, tag: 'ol', footer: d.suggestions ? 'יש הצעות ליום הזה במסך הלו״ז.' : '' });
      const tm = T.days[di + 1];
      if (tm) {
        const first = dayItems(tm).find(it => it.t);
        h += section(`<a class="row" href="#/day/${tm.date}">${dateTile(tm.date)}<span class="row-body"><span class="row-title">${esc(tm.title)}</span>${first ? `<span class="row-sub">מתחילים ב-${esc(first.t)} · ${esc(first.title)}</span>` : ''}</span>${chevron}</a>`, { header: 'מחר' });
      }
    }
    return h + weatherSection('מזג אוויר', n.date < T.start ? T.start : n.date);
  };

  V.plan = () => {
    const n = nowRome();
    let h = largeTitle('לו״ז');
    if (!hasTrip) return h + section(importRows(), { header: 'קישור הטיול', footer: 'הלו״ז מופיע כאן אחרי טעינת קישור הטיול.' });
    const unplanned = T.places.filter(p => p.status === 'idea' && !planDays(p.id).length).length;
    if (T.lead) h += `<p class="subtitle">${esc(T.lead)}</p>`;
    h += section(T.days.map((d, i) => {
      const booked = dayItems(d).filter(it => ['booked', 'paid', 'pay'].includes(it.status)).length;
      const tags = `${d.city === 'florence' ? '<span class="tag t-rec">פירנצה</span>' : ''}${d.suggestions ? '<span class="tag t-idea">פתוח + הצעה</span>' : ''}`;
      return `<a class="row ${d.date < n.date && n.date <= T.end ? 'dim' : ''}" href="#/day/${d.date}">${dateTile(d.date, d.date === n.date)}
        <span class="row-body"><span class="row-title">${esc(d.title)}</span><span class="row-sub">יום ${i + 1}${booked ? ` · ${booked} הזמנות` : ''}</span>${tags ? `<span class="tags">${tags}</span>` : ''}</span>${chevron}</a>`;
    }).join(''));
    h += section(`<a class="row" href="#/places" data-act="show-unplanned">${sqIcon('star', 'var(--indigo)')}<span class="row-body"><span class="row-title">מהרשימה שלכם, עוד לא בלו״ז</span></span><span class="row-value">${unplanned}</span>${chevron}</a>`);
    return h;
  };

  V.day = date => {
    const i = T.days.findIndex(d => d.date === date);
    const d = T.days[i];
    if (!d) return largeTitle('לא נמצא');
    const n = nowRome();
    const prev = T.days[i - 1], next = T.days[i + 1];
    navActions = `<button class="icon-btn" data-act="add-item" data-date="${d.date}" aria-label="הוספה ללו״ז">${icon('plus')}</button>`;
    let h = largeTitle(d.title, `יום ${i + 1} · ${WD[wd(d.date)]} ${dm(d.date)}${d.city !== 'rome' ? ` · ${cityName(d.city)}` : ''}`);
    if (d.intro) h += `<div class="callout">${icon('info')}<span>${esc(d.intro)}</span></div>`;
    if (d.tasks) h += section(checkRows(d.tasks, 'day:' + d.date), { header: 'לא לשכוח' });
    h += section(timeline(dayItems(d), d.date === n.date ? n.time : null), { header: 'התוכנית', tag: 'ol', footer: 'להוספת פריט: כפתור ה-＋ למעלה.' });
    for (const s of d.suggestions || []) h += section(timeline(s.items.map(x => ({ ...x })), null), { header: `💡 ${esc(s.title)}`, tag: 'ol' });
    h += section(`<div class="text-cell"><textarea class="row-input" data-save="dnote:${d.date}" rows="3" placeholder="איפה נפגשים, מה לקנות, מה היה מעולה…" aria-label="הערות ליום">${esc(get('dnote:' + d.date) || '')}</textarea></div>`, { header: 'הערות' });
    h += `<div class="btn-row" style="margin:0 var(--margin) 24px">${prev ? `<a class="btn btn-gray" href="#/day/${prev.date}">→ ${dayLabel(prev.date)}</a>` : '<span style="flex:1"></span>'}${next ? `<a class="btn btn-gray" href="#/day/${next.date}">${dayLabel(next.date)} ←</a>` : '<span style="flex:1"></span>'}</div>`;
    return h;
  };

  // places list state (kept while the app is open)
  const pf = { q: '', city: 'all', cat: 'all', fav: false, mine: false, rain: false, unplanned: false };
  const segmented = (items, current, attrs) => {
    const idx = Math.max(0, items.findIndex(x => x[0] === current));
    return `<div class="segmented" role="radiogroup" style="--count:${items.length};--index:${idx}">${items.map(([v, label, href]) => href
      ? `<a role="radio" aria-checked="${v === current}" href="${href}">${label}</a>`
      : `<button role="radio" aria-checked="${v === current}" ${attrs(v)}>${label}</button>`).join('')}</div>`;
  };

  V.places = () => {
    const chip = (key, val, label, ic) => `<button class="chip" aria-pressed="${pf[key] === val}" data-act="pf" data-k="${key}" data-v="${val}">${ic ? icon(ic) : ''}${label}</button>`;
    const tog = (key, label, ic) => `<button class="chip" aria-pressed="${!!pf[key]}" data-act="pft" data-k="${key}">${icon(ic)}${label}</button>`;
    return largeTitle('מקומות')
      + `<input class="search" type="search" id="q" placeholder="חיפוש: פסטה, קולוסיאום, גלידה" value="${esc(pf.q)}" autocomplete="off" aria-label="חיפוש מקומות">`
      + segmented([['all', 'הכל'], ['rome', 'רומא'], ['florence', 'פירנצה']], pf.city, v => `data-act="pf" data-k="city" data-v="${v}"`)
      + `<div class="chips">${tog('fav', 'מועדפים', 'heart')}${hasTrip ? tog('mine', 'הרשימה שלנו', 'star') + tog('unplanned', 'לא בלו״ז', 'calendar') : ''}${tog('rain', 'ליום גשום', 'umbrella')}</div>`
      + `<div class="chips">${chip('cat', 'all', 'כל הסוגים')}${T.categories.map(c => chip('cat', c.id, c.name, CAT_STYLE[c.id]?.[0])).join('')}</div>`
      + `<div id="results">${placesResults()}</div>`;
  };

  function placesResults() {
    const words = pf.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = T.places.filter(p => {
      if (pf.city !== 'all' && p.city !== pf.city) return false;
      if (pf.cat !== 'all' && p.cat !== pf.cat) return false;
      if (pf.fav && !get('fav:' + p.id)) return false;
      if (pf.mine && !(p.status === 'idea' || planDays(p.id).length)) return false;
      if (pf.rain && !p.rain) return false;
      if (pf.unplanned && (planDays(p.id).length || p.status === 'skip')) return false;
      if (words.length) {
        const hay = `${p.name} ${p.en} ${p.short || ''} ${p.area || ''} ${p.desc || ''} ${(p.tips || []).join(' ')} ${CAT[p.cat]?.name || ''} ${cityName(p.city)}`.toLowerCase();
        if (!words.every(w => hay.includes(w))) return false;
      }
      return true;
    });
    if (!list.length) return '<p class="count">לא נמצאו מקומות. אפשר לנקות את הסינון.</p>';
    const groups = hasTrip ? [
      ['בלו״ז', list.filter(p => planDays(p.id).length && p.status !== 'skip').sort((a, b) => planDays(a.id)[0].localeCompare(planDays(b.id)[0]))],
      ['מהרשימה שלכם', list.filter(p => !planDays(p.id).length && p.status === 'idea')],
      ['המלצות', list.filter(p => !planDays(p.id).length && !p.status)],
      ['ויתרנו', list.filter(p => p.status === 'skip')]
    ] : [['', list]];
    return `<p class="count">${list.length} מקומות</p>` + groups.filter(g => g[1].length).map(([header, arr]) => section(arr.map(placeRow).join(''), { header })).join('');
  }

  function placeRow(p) {
    const days = planDays(p.id);
    const tags = `${days.length ? `<span class="tag t-ok">${days.map(dayLabel).join(', ')}</span>` : ''}${p.city === 'florence' && pf.city === 'all' ? '<span class="tag t-rec">פירנצה</span>' : ''}${get('been:' + p.id) ? '<span class="tag t-gray">✓ היינו</span>' : ''}`;
    return `<a class="row ${p.status === 'skip' ? 'dim' : ''}" href="#/place/${p.id}">${catIcon(p.cat)}
      <span class="row-body"><span class="row-title">${esc(p.name)}${get('fav:' + p.id) ? `<span class="fav-mark" role="img" aria-label="מועדף">${icon('heartFill')}</span>` : ''}</span>
        <span class="row-sub clamp">${esc(p.status === 'skip' ? p.skipReason || p.short : p.short)}</span>${tags ? `<span class="tags">${tags}</span>` : ''}</span>${chevron}</a>`;
  }

  V.place = id => {
    const p = P[id];
    if (!p) return largeTitle('לא נמצא');
    const fav = !!get('fav:' + p.id), been = !!get('been:' + p.id);
    navActions = `<button class="icon-btn" data-act="fav" data-id="${p.id}" aria-pressed="${fav}" aria-label="מועדף">${icon(fav ? 'heartFill' : 'heart')}</button>`;
    const days = planDays(p.id);
    const statusTag = days.length ? `<span class="tag t-ok">בלו״ז · ${days.map(dayLabel).join(', ')}</span>` : p.status === 'idea' ? '<span class="tag t-idea">מהרשימה שלכם</span>' : p.status === 'skip' ? '<span class="tag t-gray">ויתרנו</span>' : '';
    const facts = [['clock', p.hours], ['tag', p.price], ['metro', p.metro]].filter(r => r[1]);
    const appears = T.days.filter(d => [...(d.items || []), ...(d.suggestions || []).flatMap(s => s.items)].some(it => it.place === p.id || (it.alts || []).includes(p.id)));
    let h = largeTitle(p.name, `${esc(CAT[p.cat]?.name || '')} · ${esc(p.area || '')}${p.area ? ' · ' : ''}${cityName(p.city)}`);
    h += `<p class="subtitle en-name">${esc(p.en.split(',')[0])}</p>`;
    if (statusTag) h += `<div class="tags" style="margin:-8px var(--margin) 16px">${statusTag}</div>`;
    h += tiles([
      tile({ href: navUrl(placeQuery(p)), external: true, icon: 'directions', label: 'נווט', prominent: true }),
      tile({ href: mapUrl(placeQuery(p)), external: true, icon: 'map', label: 'מפה' }),
      ...(p.web ? [tile({ href: esc(p.web), external: true, icon: 'globe', label: 'אתר' })] : [])
    ]);
    if (p.status === 'skip' && p.skipReason) h += `<div class="callout">${icon('info')}<span>למה ויתרנו: ${esc(p.skipReason)}</span></div>`;
    h += section(`<div class="text-cell"><p class="lead">${esc(p.short)}</p>${p.desc ? `<p>${esc(p.desc)}</p>` : ''}</div>`);
    if (facts.length) h += section(facts.map(([ic, v]) => `<div class="row">${glyph(ic)}<span class="row-body"><span class="row-title">${esc(v)}</span></span></div>`).join(''), { header: 'פרטים' });
    if (p.tips?.length) h += section(p.tips.map(t => `<div class="row"><span class="row-body"><span class="row-title">${esc(t)}</span></span></div>`).join(''), { header: 'טיפים' });
    if (appears.length) h += section(appears.map(d => `<a class="row" href="#/day/${d.date}">${dateTile(d.date)}<span class="row-body"><span class="row-title">${esc(d.title)}</span><span class="row-sub">${WD[wd(d.date)]} ${dm(d.date)}</span></span>${chevron}</a>`).join(''), { header: 'בלו״ז' });
    h += section(`<label class="row"><span class="row-body"><span class="row-title">היינו כאן</span></span><input type="checkbox" role="switch" class="switch" data-toggle="been:${p.id}" ${been ? 'checked' : ''}></label>
      ${hasTrip ? `<label class="row"><span class="row-body"><span class="row-title">הוספה ליום</span></span><select class="row-select" data-input="add-to-day" data-id="${p.id}"><option value="">בחירה</option>${T.days.map(d => `<option value="${d.date}">${WDS[wd(d.date)]} ${dm(d.date)} · ${esc(d.title)}</option>`).join('')}</select></label>` : ''}`);
    h += section(`<div class="text-cell"><textarea class="row-input" data-save="pnote:${p.id}" rows="2" placeholder="מה הזמנו, מה טעים, מה לא לשכוח…" aria-label="הערה אישית">${esc(get('pnote:' + p.id) || '')}</textarea></div>`, { header: 'הערה אישית' });
    return h;
  };

  // ---------- info: a Settings-style index, each topic on its own page ----------
  const vaultRow = id => {
    const f = T.vault.find(x => x.id === id);
    if (!f) return '';
    const v = get('vault:' + id);
    return v ? `<button class="row" data-act="copy" data-text="${esc(v)}">${glyph('doc')}<span class="row-body"><span class="row-sub">${esc(f.label)}</span><span class="row-title strong ltr">${esc(v)}</span></span><span class="row-value">העתקה</span></button>`
      : `<a class="row" href="#/info/vault">${glyph('doc')}<span class="row-body"><span class="row-title">${esc(f.label)}</span></span><span class="row-value">להוספה</span>${chevron}</a>`;
  };
  const textRows = arr => arr.map(x => `<div class="row"><span class="row-body"><span class="row-title">${esc(x)}</span></span></div>`).join('');
  const textCell = html => `<div class="text-cell">${html}</div>`;

  const INFO = {
    flights: { title: 'טיסות', icon: 'airplane', color: 'var(--blue)', trip: true, render: () =>
      T.flights.map(f => section(`${textCell(`<p class="lead">${esc(f.airline)}</p><p style="font-size:1.176rem;font-weight:700">${esc(f.from)} <span style="color:var(--label-2)">←</span> ${esc(f.to)}</p>`)}
        <div class="row">${glyph('doc')}<span class="row-body"><span class="row-sub">צ׳ק-אין</span><span class="row-title">${esc(f.checkin)}</span></span></div>
        <div class="row">${glyph('suitcase')}<span class="row-body"><span class="row-sub">כבודה</span><span class="row-title">${esc(f.bags)}</span></span></div>
        ${f.vault ? vaultRow(f.vault) : ''}`, { header: `${esc(f.dir)} · ${WD[wd(f.date)]} ${dm(f.date)}` })).join('')
      + (T.vault.some(v => v.flight) ? section(T.vault.filter(v => v.flight).map(v => vaultRow(v.id)).join(''), { header: 'הזמנה' }) : '')
      + (T.flightNotes.length ? section(textRows(T.flightNotes), { header: 'חשוב לדעת' }) : '') },
    hotel: { title: 'המלון', icon: 'bed', color: 'var(--indigo)', trip: true, render: () => {
      const hh = T.hotel;
      return section(`${textCell(`<p class="lead">${esc(hh.name)}</p>${hh.room ? `<p class="row-sub">${esc(hh.room)}</p>` : ''}`)}
          <a class="row" href="${mapUrl(hotelQ())}" ${ext}>${glyph('pin')}<span class="row-body"><span class="row-title ltr">${esc(hh.address)}</span></span>${chevron}</a>
          ${hh.near ? `<div class="row">${glyph('metro')}<span class="row-body"><span class="row-title">${esc(hh.near)}</span></span></div>` : ''}
          ${hh.checkin ? `<div class="row">${glyph('key')}<span class="row-body"><span class="row-title">${esc(hh.checkin)}</span></span></div>` : ''}
          ${vaultRow('hotel')}`)
        + tiles([
          tile({ href: navUrl(hotelQ()), external: true, icon: 'directions', label: 'נווט', prominent: true }),
          ...(hh.phone ? [tile({ href: telUrl(hh.phone), icon: 'phone', label: 'התקשרות' })] : []),
          ...(hh.email ? [tile({ href: `mailto:${esc(hh.email)}`, icon: 'envelope', label: 'מייל' })] : []),
          tile({ act: 'taxi', icon: 'car', label: 'לנהג' })
        ])
        + (hh.notes?.length ? section(textRows(hh.notes), { header: 'חשוב לדעת' }) : '');
    } },
    vault: { title: 'פרטי הזמנות', icon: 'lock', color: 'var(--gray)', trip: true, render: () =>
      section(T.vault.map(f => f.multi
        ? `<div class="text-cell"><p class="row-sub" style="margin-bottom:6px">${esc(f.label)}</p><textarea class="row-input" rows="3" data-save="vault:${f.id}" aria-label="${esc(f.label)}">${esc(get('vault:' + f.id) || '')}</textarea></div>`
        : `<label class="row"><span class="row-body"><span class="row-sub">${esc(f.label)}</span><input class="row-input" data-save="vault:${f.id}" value="${esc(get('vault:' + f.id) || '')}" dir="auto" autocomplete="off" placeholder="להוספה"></span></label>`).join(''),
      { footer: 'נשמר רק בטלפון הזה, לא באתר. סיסמאות עדיף לשמור באפליקציית הסיסמאות של האייפון ולא כאן.' }) },
    airport: { title: 'מהשדה לעיר', icon: 'train', color: 'var(--orange)', render: () =>
      section(textCell('<p>רכבת ישירה בין פיומיצ׳ינו לטרמיני, בערך 32 דק׳, כל 15–30 דק׳ מהבוקר המוקדם עד הלילה. כרטיס (14€) קונים בתחנה או באפליקציית Trenitalia, ומתקפים לפני העלייה.</p>'), { header: 'Leonardo Express (רכבת)' })
      + section(textCell('<p>יש תעריף קבוע מפיומיצ׳ינו למרכז רומא (בתוך החומות), בערך 55€, וכדאי לוודא לפני הנסיעה. לוקחים רק מונית לבנה רשמית מהתור, לא ממי שמציע נסיעה בטרמינל.</p>'), { header: 'מונית' })
      + (T.airportNotes.length ? section(textRows(T.airportNotes), { header: 'אצלנו' }) : '') },
    metro: { title: 'מטרו ותחבורה', icon: 'metro', color: 'var(--red)', render: () => {
      const hh = T.hotel;
      return section(`<div class="text-cell">${metroMap()}</div>
          <div class="row"><span class="line-dot" style="background:var(--metro-a)"></span><span class="row-body"><span class="row-title"><b>A</b> ותיקן (Ottaviano), מדרגות ספרד (Spagna), פיאצה דל פופולו (Flaminio), טרווי (Barberini)</span></span></div>
          <div class="row"><span class="line-dot" style="background:var(--metro-b)"></span><span class="row-body"><span class="row-title"><b>B</b> ${hh?.metro ? `המלון (${esc(hh.metro)}), ` : ''}קולוסיאום, קרקס מקסימוס, טסטאצ׳ו (Piramide)</span></span></div>
          <div class="row"><span class="line-dot" style="background:var(--metro-c)"></span><span class="row-body"><span class="row-title"><b>C</b> הקו החדש: תחנות-המוזיאון ליד הקולוסיאום</span></span></div>`,
      { footer: 'מפה סכמטית, רק התחנות הרלוונטיות.' })
        + (hh?.stations?.length ? section(hh.stations.map(x => `<div class="row">${glyph('metro')}<span class="row-body"><span class="row-title">${esc(x)}</span></span></div>`).join(''), { header: 'הכי קרוב למלון' }) : '')
        + section(textCell('<p>נסיעות ללא הגבלה במטרו, באוטובוסים, בחשמליות וברכבות האזוריות בתוך רומא. <b>29€ לאדם</b>. תקף עד חצות של היום השביעי, כולל יום התיקוף.</p>')
          + textRows(['קונים במכונות ATAC בתחנות, בקופות, או בטבק/קיוסק עם שלט T. בוחרים ״CIS״ או ״Weekly ticket״. נמכר רק כנייר', 'תיקוף ראשון בשער המטרו או במכונה באוטובוס. באוטובוס שומרים אותו ומראים בביקורת', 'קנס על נסיעה בלי כרטיס תקף: 100–500€', 'אפשר גם להיכנס עם כרטיס אשראי ללא מגע ישירות בשער, כרטיס אחד לכל אחד']),
        { header: 'כרטיס שבועי CIS' })
        + section(textCell('<p>בערך 05:30–23:30, ובשישי ושבת עד 01:30. ביום עצמו כדאי לבדוק בגוגל מפות או ב-Moovit, שמראים עיכובים ושביתות.</p>'), { header: 'שעות' })
        + section(textCell('<p>המוניות הרשמיות לבנות, עם ״TAXI״ על הגג ו״Roma Capitale״ על הדלת, ויש בהן מונה. לבקש להפעיל מונה. להזמנה: itTaxi.</p>'), { header: 'מוניות' })
        + section(textCell('<p>Frecciarossa (Trenitalia) ו-Italo יוצאות מטרמיני כל היום, כשעה וחצי נסיעה.</p>'), { header: 'רכבות לפירנצה' });
    } },
    weather: { title: 'מזג אוויר', icon: 'cloudsun', color: 'var(--cyan)', render: () =>
      weatherSection('', hasTrip && T.start > nowRome().date ? T.start : nowRome().date) },
    tips: { title: 'טיפים', icon: 'bulb', color: 'var(--yellow)', render: () =>
      section(T.tips.map(t => `<div class="row"><span class="row-emoji" aria-hidden="true">${t.icon}</span><span class="row-body"><span class="row-title strong">${esc(t.title)}</span><span class="row-sub">${esc(t.text)}</span></span></div>`).join('')) },
    phrases: { title: 'משפטים באיטלקית', icon: 'bubble', color: 'var(--purple)', render: () =>
      section(T.phrases.map(p => `<div class="row"><span class="row-body"><span class="row-title phrase-it" dir="ltr">${esc(p.it)}</span><span class="row-sub">${esc(p.he)} · ${esc(p.say)}</span></span></div>`).join('')) },
    apps: { title: 'אפליקציות', icon: 'grid', color: 'var(--blue)', render: () =>
      section(T.apps.map(a => `<div class="row"><span class="row-body"><span class="row-title strong" dir="auto">${esc(a.name)}</span><span class="row-sub">${esc(a.why)}</span></span></div>`).join('')) },
    emergency: { title: 'חירום', icon: 'cross', color: 'var(--red)', render: () =>
      section(T.emergency.map(e => `<div class="row"><span class="row-body"><span class="row-title">${esc(e.name)}</span>${e.note ? `<span class="row-sub">${esc(e.note)}</span>` : ''}</span><a class="btn" href="${telUrl(e.phone)}" dir="ltr">${icon('phone')}${esc(e.phone)}</a></div>`).join(''),
      { footer: T.emergencyNote ? esc(T.emergencyNote) : '' }) },
    sync: { title: 'קישור וסנכרון', icon: 'sync', color: 'var(--green)', render: () => {
      const tripTs = kv.trip?.[1];
      return (hasTrip ? section(`<div class="row"><span class="row-body"><span class="row-title">גרסת הטיול בטלפון</span></span><span class="row-value">${new Date(tripTs).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>`) : '')
        + section(importRows(), { header: 'קיבלתם קישור?', footer: 'קישור טיול מעודכן, או קישור סנכרון מהטלפון השני. בכל טעינה העדכון החדש יותר מנצח. באייפון עדיף להדביק כאן מתוך האפליקציה ולא לפתוח בספארי, כי אפליקציה שבמסך הבית שומרת נתונים בנפרד.' })
        + section(`<label class="row"><span class="row-body"><span class="row-title">לכלול פרטי הזמנות</span></span><input type="checkbox" role="switch" class="switch" id="exp-vault" checked></label>
            <button class="row action" data-act="export">${glyph('share')}<span class="row-body">שליחת קישור סנכרון</span></button>`,
        { header: 'שליחה לטלפון השני', footer: 'יוצר קישור עם כל מה שיש בטלפון הזה. לשלוח רק בצ׳אט פרטי.' })
        + section('<button class="row destructive" data-act="wipe">מחיקת כל נתוני הטיול מהטלפון</button>');
    } }
  };
  const INFO_GROUPS = [
    ['הטיול', ['flights', 'hotel', 'vault']],
    ['להתנייד', ['airport', 'metro']],
    ['שימושי', ['weather', 'tips', 'phrases', 'apps', 'emergency']],
    ['נתונים', ['sync']]
  ];
  const infoPage = sub => INFO[sub] && (!INFO[sub].trip || hasTrip) ? INFO[sub] : null;

  V.info = sub => {
    const page = infoPage(sub);
    if (page) return largeTitle(page.title) + page.render();
    return largeTitle('מידע') + INFO_GROUPS.map(([header, ids]) => {
      const rows = ids.filter(id => !INFO[id].trip || hasTrip)
        .map(id => `<a class="row" href="#/info/${id}">${sqIcon(INFO[id].icon, INFO[id].color)}<span class="row-body"><span class="row-title">${INFO[id].title}</span></span>${chevron}</a>`).join('');
      return rows ? section(rows, { header }) : '';
    }).join('');
  };

  function metroMap() {
    const A = [['Ottaviano', 38, 62, 'b', 'ותיקן'], ['Lepanto', 68, 52, 'b'], ['Flaminio', 102, 46, 't', 'פופולו'], ['Spagna', 134, 68, 'r', 'מדרגות ספרד'], ['Barberini', 157, 92, 'r', 'טרווי'], ['Repubblica', 177, 112, 'l'], ['Termini', 197, 132, 'T'], ['Vittorio Emanuele', 219, 157, 'r'], ['Manzoni', 239, 181, 'r'], ['San Giovanni', 259, 205, 'r']];
    const B = [['Policlinico', 266, 64, 'r'], ['Castro Pretorio', 233, 98, 'r'], ['Termini', 197, 132], ['Cavour', 173, 160, 'l', 'מונטי'], ['Colosseo', 151, 188, 'l', 'קולוסיאום'], ['Circo Massimo', 129, 218, 'l', 'קרקלה'], ['Piramide', 107, 248, 'l', 'טסטאצ׳ו']];
    const C = [['San Giovanni', 259, 205], ['Porta Metronia', 207, 226, 'b'], ['Colosseo', 151, 188]];
    const line = (st, color) => `<polyline points="${st.map(s => s[1] + ',' + s[2]).join(' ')}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
    const label = ([name, x, y, pos, hint]) => {
      if (!pos) return '';
      let tx = x, ty = y, anchor = 'middle';
      if (pos === 'r') { tx = x + 9; ty = y + 3.5; anchor = 'start'; }
      if (pos === 'l') { tx = x - 9; ty = y + 3.5; anchor = 'end'; }
      if (pos === 't') { ty = y - 10; }
      if (pos === 'b') { ty = y + 17; }
      if (pos === 'T') { tx = x + 12; ty = y + 4; anchor = 'start'; }
      const hy = pos === 't' ? y + 18 : ty + 10.5;
      // side labels: push the hint away from the diagonal line that continues below the station
      const hx = pos === 'r' ? tx + 10 : pos === 'l' ? tx - 10 : tx;
      return `<text x="${tx}" y="${ty}" text-anchor="${anchor}" class="st${pos === 'T' ? ' st-big' : ''}">${name}</text>${hint ? `<text x="${hx}" y="${hy}" text-anchor="${anchor}" class="hint${hint === 'המלון' ? ' hint-hotel' : ''}">${hint}</text>` : ''}`;
    };
    const hotelSt = T.hotel?.metro;
    for (const st of [...A, ...B, ...C]) if (st[0] === hotelSt && st[3]) st[4] = 'המלון';
    const hs = [...A, ...B, ...C].find(st => st[0] === hotelSt && st[0] !== 'Termini');
    const dots = st => st.map(([n, x, y]) => n === 'Termini' ? '' : `<circle cx="${x}" cy="${y}" r="3.6" class="dot"/>`).join('');
    return `<svg class="metro" viewBox="0 0 340 280" role="img" aria-label="מפת מטרו סכמטית של רומא" direction="ltr">
      ${line(C, 'var(--metro-c)')}${line(A, 'var(--metro-a)')}${line(B, 'var(--metro-b)')}
      ${dots(A)}${dots(B)}${dots(C)}
      <circle cx="197" cy="132" r="7.5" class="dot dot-big"/>
      ${hs ? `<circle cx="${hs[1]}" cy="${hs[2]}" r="6" class="dot dot-hotel"/>` : ''}
      ${[...A, ...B, ...C].map(label).join('')}
    </svg>`;
  }

  // ---------- lists ----------
  let listTab = 'pack';
  let editing = false;
  function listItems(l) {
    const base = l.items.map(text => ({ text, chk: `chk:${l.id}:${hash(text)}`, key: `hide:${l.id}:${hash(text)}`, builtIn: true })).filter(it => !get(it.key));
    const mine = prefixed(`li:${l.id}:`).sort((a, b) => a.ts - b.ts).map(x => ({ text: x.val, chk: `chk:${l.id}:${x.id}`, key: x.key }));
    return [...base, ...mine];
  }
  function checkRows(texts, ns) {
    return texts.map(t => {
      const k = `chk:${ns}:${hash(t)}`;
      return `<label class="row"><input type="checkbox" class="check" data-check="${k}" ${get(k) ? 'checked' : ''}><span class="row-body"><span class="row-title">${esc(t)}</span></span></label>`;
    }).join('');
  }

  V.lists = tab => {
    if (tab) listTab = tab;
    navActions = `<button class="text-btn" data-act="edit">${editing ? 'סיום' : 'עריכה'}</button>`;
    const tabs = [...T.lists.map(l => [l.id, l.name, `#/lists/${l.id}`]), ['money', 'הוצאות', '#/lists/money']];
    let h = largeTitle('רשימות') + segmented(tabs, listTab);
    if (listTab === 'money') return h + moneyView();
    const l = T.lists.find(x => x.id === listTab) || T.lists[0];
    const items = listItems(l);
    const done = items.filter(it => get(it.chk)).length;
    const hidden = l.items.filter(t => get(`hide:${l.id}:${hash(t)}`)).length;
    h += `<p class="count">${done} מתוך ${items.length}</p><div class="progress" style="margin-inline:calc(var(--margin) + 16px) calc(var(--margin) + 16px)"><div style="inline-size:${items.length ? Math.round(done / items.length * 100) : 0}%"></div></div>`;
    const rows = items.map(it => editing
      ? `<div class="row"><button class="minus" data-act="del-li" data-key="${esc(it.key)}" data-builtin="${it.builtIn ? 1 : 0}" aria-label="מחיקה: ${esc(it.text)}"></button><span class="row-body"><span class="row-title">${esc(it.text)}</span></span></div>`
      : `<label class="row"><input type="checkbox" class="check" data-check="${it.chk}" ${get(it.chk) ? 'checked' : ''}><span class="row-body"><span class="row-title">${esc(it.text)}</span></span></label>`).join('');
    h += section(rows + `<form class="row" data-form="add-li" data-list="${l.id}"><span class="row-icon" style="background:var(--accent);border-radius:50%;inline-size:24px;block-size:24px;font-size:15px;color:var(--on-accent)">${icon('plus')}</span><input class="row-input" name="text" placeholder="פריט חדש" autocomplete="off" aria-label="פריט חדש"><button class="text-btn">הוספה</button></form>`,
      { footer: hidden ? `<button data-act="unhide" data-list="${l.id}">החזרת ${hidden} פריטים שהוסרו</button>` : (editing ? 'מחיקה בכפתור האדום. אפשר לבטל מיד אחרי.' : '') });
    return h;
  };

  function moneyView() {
    const pre = T.prepaid;
    const preIls = pre.reduce((s, x) => s + x.ils, 0);
    const rate = T.eurToIls || 3.5;
    const exps = prefixed('exp:').sort((a, b) => b.ts - a.ts);
    const eur = exps.reduce((s, x) => s + (+x.val.eur || 0), 0);
    let h = '';
    if (pre.length) h += section(pre.map(x => `<div class="row"><span class="row-body"><span class="row-title">${esc(x.name)}</span><span class="row-sub">${esc(x.status)}</span></span><span class="row-value" dir="ltr">${esc(x.orig)}<small>${x.ils.toLocaleString('he-IL')}₪</small></span></div>`).join('')
      + `<div class="row total-row"><span class="row-body"><span class="row-title">סה״כ</span></span><span class="row-value">${Math.round(preIls).toLocaleString('he-IL')}₪</span></div>`,
    { header: 'שולם לפני הטיול', footer: T.due ? esc(T.due) : '' });
    h += section(`<form class="row" data-form="add-exp"><input class="row-input" name="what" placeholder="על מה? (גלידה, מונית…)" autocomplete="off" required aria-label="על מה"><input class="row-input trailing" style="flex:0 0 72px" name="eur" type="number" inputmode="decimal" step="0.01" min="0" placeholder="€" required aria-label="סכום באירו"><button class="text-btn">הוספה</button></form>`
      + exps.map(x => `<div class="row">${editing ? `<button class="minus" data-act="del-exp" data-key="${esc(x.key)}" aria-label="מחיקה"></button>` : ''}<span class="row-body"><span class="row-title">${esc(x.val.what)}</span><span class="row-sub">${dayLabel(x.val.d)}</span></span><span class="row-value" dir="ltr">${(+x.val.eur).toFixed(2)}€</span></div>`).join('')
      + (exps.length ? `<div class="row total-row"><span class="row-body"><span class="row-title">סה״כ בטיול</span></span><span class="row-value" dir="ltr">${eur.toFixed(2)}€<small>≈ ${Math.round(eur * rate).toLocaleString('he-IL')}₪</small></span></div>` : ''),
    { header: 'הוצאות בטיול', footer: exps.length ? '' : 'מה שמוסיפים כאן נשמר בטלפון.' });
    return h;
  }

  // ---------- router ----------
  const TAB = { today: 'today', plan: 'plan', day: 'plan', places: 'places', place: 'places', info: 'info', lists: 'lists' };
  const PARENT = { day: '#/plan', place: '#/places', info: '#/info' };
  const scrolls = {};
  let current = '';
  let titleObserver;

  function parseRoute() {
    const [, name = 'today', arg] = (location.hash.slice(1) || '/today').split('/');
    return { name: V[name] ? name : 'today', arg: arg ? decodeURIComponent(arg) : undefined };
  }

  function render(keepScroll) {
    const { name, arg } = parseRoute();
    const key = location.hash;
    if (!keepScroll && current) scrolls[current] = window.scrollY;
    if (name !== 'lists') editing = false;
    navActions = '';
    view.innerHTML = V[name](arg);
    const lt = view.querySelector('.large-title');
    document.getElementById('title').textContent = lt ? lt.textContent : '';
    document.getElementById('nav-actions').innerHTML = (navigator.onLine ? '' : '<span class="offline">אופליין</span>') + navActions;
    const isSub = name === 'day' || name === 'place' || (name === 'info' && !!infoPage(arg));
    document.getElementById('back').hidden = !isSub;
    document.querySelectorAll('.tabbar .tab').forEach(a => {
      if (a.dataset.tab === TAB[name]) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (!keepScroll) window.scrollTo(0, scrolls[key] && (name === 'places' || name === 'plan' || (name === 'info' && !arg)) ? scrolls[key] : 0);
    current = key;
    // the small title and the bar's edge appear once the large title scrolls under the bar
    titleObserver?.disconnect();
    if (lt && 'IntersectionObserver' in window) {
      titleObserver = new IntersectionObserver(([e]) => { navbar.dataset.scrolled = String(!e.isIntersecting); },
        { rootMargin: `-${navbar.offsetHeight}px 0px 0px 0px` });
      titleObserver.observe(lt);
    }
    if (name === 'places') bindSearch();
  }

  function bindSearch() {
    const q = document.getElementById('q');
    if (!q) return;
    q.addEventListener('input', () => { pf.q = q.value; document.getElementById('results').innerHTML = placesResults(); });
  }

  // back goes to the previous screen if we navigated inside the app, otherwise to the parent
  let inAppNavs = 0;
  document.getElementById('back').addEventListener('click', () => {
    const { name } = parseRoute();
    if (inAppNavs > 0) history.back();
    else location.hash = PARENT[name] || '#/today';
  });

  // ---------- import / export ----------
  const b64e = bytes => { let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const b64d = str => { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; return Uint8Array.from(atob(str), c => c.charCodeAt(0)); };
  async function packState(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    if (window.CompressionStream) {
      try {
        const buf = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
        return 'z' + b64e(new Uint8Array(buf));
      } catch { }
    }
    return 'j' + b64e(bytes);
  }
  async function unpackState(code) {
    const bytes = b64d(code.slice(1));
    let text;
    if (code[0] === 'z') text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    else if (code[0] === 'j') text = new TextDecoder().decode(bytes);
    else throw new Error('bad code');
    return JSON.parse(text);
  }
  const extractCode = s => { s = (s || '').trim(); const i = s.indexOf('import='); return (i >= 0 ? s.slice(i + 7) : s).split(/[&\s]/)[0]; };

  async function askImport(code) {
    try {
      const data = await unpackState(code);
      const keys = Object.keys(data.kv || {});
      const trip = data.kv?.trip;
      const isNewer = trip && (!kv.trip || kv.trip[1] < trip[1]);
      const others = keys.filter(k => k !== 'trip').length;
      const parts = [];
      if (trip) parts.push(isNewer ? 'בקישור יש גרסה חדשה של הטיול.' : 'הטיול בקישור לא חדש יותר ממה שכבר יש בטלפון.');
      if (others) parts.push(`ועוד ${others} פריטים: מועדפים, רשימות, הערות ופרטי הזמנות. העדכון החדש יותר מנצח.`);
      openAlert({
        title: 'לטעון את הקישור?', message: esc(parts.join(' ')),
        buttons: [{ label: 'ביטול', act: 'alert-close' }, { label: 'טעינה', act: 'do-import', cls: 'btn-prominent', data: `data-code="${esc(code)}"` }]
      });
    } catch { toast('הקישור לא תקין'); }
  }

  // ---------- events ----------
  const ACT = {
    fav: el => { const k = 'fav:' + el.dataset.id; set(k, !get(k)); refresh(); },
    pf: el => { pf[el.dataset.k] = el.dataset.v; render(true); },
    pft: el => { pf[el.dataset.k] = !pf[el.dataset.k]; render(true); },
    'show-unplanned': () => { Object.assign(pf, { q: '', city: 'all', cat: 'all', fav: false, mine: true, rain: false, unplanned: true }); },
    'del-add': el => changeWithUndo(el.dataset.key, null, 'הוסר מהלו״ז'),
    'del-li': el => changeWithUndo(el.dataset.key, el.dataset.builtin === '1' ? true : null, 'הפריט נמחק'),
    'del-exp': el => changeWithUndo(el.dataset.key, null, 'ההוצאה נמחקה'),
    edit: () => { editing = !editing; refresh(); },
    unhide: el => { const l = T.lists.find(x => x.id === el.dataset.list); l.items.forEach(t => { const k = `hide:${l.id}:${hash(t)}`; if (get(k)) del(k); }); refresh(); },
    copy: el => copy(el.dataset.text),
    close: closeSheet,
    'alert-close': closeAlert,
    taxi: () => openSheet({
      title: 'כתובת לנהג', body: `<div class="taxi"><p class="it" dir="ltr">Buongiorno! Per favore, mi porti a questo indirizzo:</p>
        <p class="big" dir="ltr">${(T.hotel.taxi || [T.hotel.name, T.hotel.address]).map(esc).join('<br>')}</p>
        ${T.hotel.taxiNear ? `<p class="it" dir="ltr">(${esc(T.hotel.taxiNear)})</p>` : ''}
        <p class="list-footer" style="margin-top:16px">״בבקשה, קח אותי לכתובת הזו״. אפשר להראות לנהג את המסך.</p></div>`
    }),
    'add-item': el => {
      const groups = T.categories.map(c => `<optgroup label="${esc(c.name)}">${T.places.filter(p => p.cat === c.id && p.status !== 'skip').map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</optgroup>`).join('');
      openSheet({
        title: `הוספה ל${WD[wd(el.dataset.date)]} ${dm(el.dataset.date)}`, done: 'הוספה',
        body: `<form id="sheet-form" data-form="add-item" data-date="${el.dataset.date}">${section(`
          <label class="row"><input class="row-input" name="title" placeholder="מה? למשל גלידה ב-Giolitti" autocomplete="off" aria-label="מה"></label>
          <label class="row"><span class="row-body"><span class="row-title">שעה</span></span><input class="row-input trailing" type="time" name="t" style="flex:0 0 auto" aria-label="שעה"></label>
          <label class="row"><span class="row-body"><span class="row-title">מקום</span></span><select class="row-select" name="place" aria-label="מקום"><option value="">בלי</option>${groups}</select></label>`,
        { footer: 'אם בוחרים מקום, לא חייבים לכתוב כלום.' })}</form>`
      });
    },
    export: async () => {
      const withVault = document.getElementById('exp-vault')?.checked;
      const out = {};
      for (const [k, e] of Object.entries(kv)) if (withVault || !k.startsWith('vault:')) out[k] = e;
      if (!Object.keys(out).length) { toast('עוד אין מה לשלוח'); return; }
      const url = `${location.origin}${location.pathname}#import=${await packState({ v: 1, kv: out })}`;
      if (navigator.share) {
        try { await navigator.share({ title: 'סנכרון', text: 'קישור סנכרון לאפליקציית הטיול', url }); return; } catch (e) { if (e.name === 'AbortError') return; }
      }
      copy(url);
    },
    'import-paste': () => { const code = extractCode(document.getElementById('imp-code')?.value); if (code) askImport(code); else toast('הדביקו קישור קודם'); },
    'do-import': async el => {
      try {
        const data = await unpackState(el.dataset.code);
        const n = merge(data.kv);
        rebuild(); closeAlert();
        toast(n ? `עודכנו ${n} פריטים` : 'הכל כבר מעודכן');
        refresh();
      } catch { closeAlert(); toast('הטעינה נכשלה'); }
    },
    wipe: () => openAlert({
      title: 'למחוק את נתוני הטיול מהטלפון?',
      message: 'יימחקו פרטי הטיול, פרטי ההזמנות וכל הסימונים וההערות. אפשר לטעון שוב מהקישור.',
      buttons: [{ label: 'ביטול', act: 'alert-close' }, { label: 'מחיקה', act: 'do-wipe', cls: 'btn-prominent btn-destructive' }]
    }),
    'do-wipe': () => {
      kv = {};
      try { localStorage.removeItem(KEY); localStorage.removeItem(WXKEY); } catch { }
      rebuild(); closeAlert(); toast('נמחק');
      location.hash = '#/today';
      refresh();
    }
  };
  const refresh = () => render(true);

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || !ACT[el.dataset.act]) return;
    if (el.tagName === 'BUTTON') e.preventDefault();
    ACT[el.dataset.act](el, e);
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!alertEl.hidden) closeAlert(); else if (!sheet.hidden) closeSheet();
  });

  document.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.check) { set(el.dataset.check, el.checked); if (parseRoute().name === 'lists') refresh(); }
    if (el.dataset.toggle) set(el.dataset.toggle, el.checked);
    if (el.dataset.input === 'add-to-day' && el.value) {
      const p = P[el.dataset.id];
      set(`add:${el.value}:${uid()}`, { t: '', title: p.name, place: p.id });
      toast(`נוסף ל${WD[wd(el.value)]} ${dm(el.value)}`);
      refresh();
    }
  });

  let saveT;
  document.addEventListener('input', e => {
    const el = e.target;
    if (!el.dataset.save) return;
    clearTimeout(saveT);
    saveT = setTimeout(() => set(el.dataset.save, el.value.trim() ? el.value : null), 350);
  });

  document.addEventListener('submit', e => {
    const f = e.target;
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(f));
    if (f.dataset.form === 'add-item') {
      const title = fd.title.trim() || (fd.place && P[fd.place]?.name);
      if (!title) { toast('כתבו מה להוסיף או בחרו מקום'); return; }
      set(`add:${f.dataset.date}:${uid()}`, { t: fd.t || '', title, place: fd.place || undefined });
      closeSheet(); refresh(); toast('נוסף ללו״ז');
    }
    if (f.dataset.form === 'add-li' && fd.text.trim()) {
      set(`li:${f.dataset.list}:${uid()}`, fd.text.trim());
      refresh();
      document.querySelector('form[data-form="add-li"] .row-input')?.focus();
    }
    if (f.dataset.form === 'add-exp') {
      const eur = parseFloat(String(fd.eur).replace(',', '.'));
      if (!fd.what.trim() || !(eur >= 0)) return;
      set(`exp:${uid()}`, { d: nowRome().date, what: fd.what.trim(), eur });
      refresh();
    }
  });

  // ---------- boot ----------
  function boot() {
    const h = location.hash;
    if (h.startsWith('#import=')) {
      const code = extractCode(h);
      history.replaceState(null, '', location.pathname + location.search + '#/today');
      render();
      askImport(code);
    } else render();
  }
  window.addEventListener('hashchange', () => {
    if (location.hash.startsWith('#import=')) { boot(); return; }
    inAppNavs++;
    render();
  });
  window.addEventListener('online', () => refresh());
  window.addEventListener('offline', () => refresh());

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => { });
  }

  boot();
})();
