(() => {
  'use strict';

  const G = window.GUIDE;
  const view = document.getElementById('view');
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

  function toRoman(n) {
    const map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let out = '';
    for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
    return out;
  }

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
      return o ? { ...p, ...o, tips: [...(p.tips || []), ...(o.tips || [])] } : p;
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

  // ---------- small UI pieces ----------
  const STATUS = {
    booked: ['הוזמן', 'ok'], paid: ['שולם', 'ok'], pay: ['לשלם', 'warn'],
    check: ['לבדוק', 'warn'], idea: ['פתוח', 'idea']
  };
  const badge = s => STATUS[s] ? `<span class="badge b-${STATUS[s][1]}">${STATUS[s][0]}</span>` : '';
  function placeBadges(p) {
    const days = planDays(p.id);
    let out = '';
    if (days.length) out += `<span class="badge b-ok">בלו״ז · ${days.map(dayLabel).join(', ')}</span>`;
    else if (p.status === 'idea') out += '<span class="badge b-idea">מהרשימה שלכם</span>';
    else if (hasTrip && !p.status) out += '<span class="badge b-rec">המלצה</span>';
    if (p.status === 'skip') out += '<span class="badge b-skip">ויתרנו</span>';
    if (p.city === 'florence') out += '<span class="badge b-city">פירנצה</span>';
    if (get('been:' + p.id)) out += '<span class="badge b-been">✓ היינו</span>';
    return out;
  }
  const catIcon = c => CAT[c]?.icon || '📍';
  const heart = on => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.2-9.6C1.6 7.3 3.9 4 7.3 4c2 0 3.6 1.1 4.7 2.7C13.1 5.1 14.7 4 16.7 4c3.4 0 5.7 3.3 4.5 6.9-1.7 5-9.2 9.6-9.2 9.6z" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2400);
  }

  const sheet = document.getElementById('sheet');
  const backdrop = document.getElementById('sheet-backdrop');
  function openSheet(html) {
    sheet.innerHTML = `<div class="sheet-grip"></div>${html}`;
    sheet.hidden = false; backdrop.hidden = false;
    requestAnimationFrame(() => { sheet.classList.add('open'); backdrop.classList.add('open'); });
  }
  function closeSheet() {
    sheet.classList.remove('open'); backdrop.classList.remove('open');
    setTimeout(() => { sheet.hidden = true; backdrop.hidden = true; sheet.innerHTML = ''; }, 200);
  }
  backdrop.addEventListener('click', closeSheet);

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

  function itemHtml(it, cls = '') {
    const p = it.place && P[it.place];
    const vaultVal = it.vault && get('vault:' + it.vault);
    const q = p ? placeQuery(p) : it.map;
    let links = '';
    if (p) links += `<a class="chip chip-place" href="#/place/${p.id}"><span>${catIcon(p.cat)}</span>${esc(p.name)}</a>`;
    if (q) links += `<a class="chip chip-nav" href="${navUrl(q)}" target="_blank" rel="noopener">נווט ←</a>`;
    const alts = (it.alts || []).filter(id => P[id]).map(id => `<a class="chip chip-alt" href="#/place/${id}">${catIcon(P[id].cat)} ${esc(P[id].name)}</a>`).join('');
    return `<li class="tl-item ${cls}">
      <div class="tl-time">${esc(it.t || '')}${it.end ? `<small>${esc(it.end)}</small>` : ''}</div>
      <div class="tl-dot"></div>
      <div class="tl-body">
        <div class="tl-title">${esc(it.title)} ${badge(it.status)}${it.mine ? '<span class="badge b-mine">שלי</span>' : ''}</div>
        ${it.note ? `<div class="tl-note">${esc(it.note)}</div>` : ''}
        ${it.vault ? `<div class="tl-note">${vaultVal ? `📌 ${esc(vaultVal)}` : `<a href="#/info/vault">להשלים פרטים ←</a>`}</div>` : ''}
        ${links ? `<div class="tl-links">${links}</div>` : ''}
        ${alts ? `<div class="alts"><span class="alts-label">אפשר גם:</span>${alts}</div>` : ''}
        ${it.mine ? `<button class="link-btn danger" data-act="del-key" data-key="${esc(it.mine)}">הסרה</button>` : ''}
      </div>
    </li>`;
  }

  function timeline(items, now) {
    let cur = -1;
    if (now) items.forEach((it, i) => { if (it.t && it.t <= now) cur = i; });
    return `<ol class="timeline">${items.map((it, i) => {
      let cls = '';
      if (now) {
        if (i < cur) cls = 'past';
        else if (i === cur) cls = (it.end && it.end <= now) ? 'past' : 'now';
        else if (i === cur + 1) cls = 'next';
      }
      return itemHtml(it, cls);
    }).join('')}</ol>`;
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
      ? `<div class="wx-row">${cells.join('')}</div><p class="muted small">תחזית מ-Open-Meteo. מתעדכנת כשיש אינטרנט.</p>`
      : hasTrip ? `<p>${esc(T.weatherAvg || '')}</p><p class="muted small">תחזית אמיתית תופיע כאן כשבועיים לפני הטיול.</p>`
        : '<p class="muted">אין כרגע תחזית (צריך אינטרנט).</p>';
  }

  // ---------- views ----------
  const V = {};

  function importBox() {
    return `<textarea class="note-input" id="imp-code" rows="2" placeholder="הדביקו כאן את הקישור הפרטי"></textarea>
      <div class="actions"><button class="btn primary" data-act="import-paste">טעינה</button></div>`;
  }

  V.today = () => {
    const n = nowRome();
    if (!hasTrip) {
      setTimeout(() => fillWeather(document.getElementById('wx'), n.date));
      return `<section class="hero"><div class="hero-kicker">ברוכים הבאים</div><div class="hero-title">רומא ופירנצה</div>
          <div class="hero-sub">מדריך מקומות, מסעדות ומידע שימושי.</div></section>
        <section class="card"><h2>יש לכם קישור טיול?</h2>
          <p>פרטי הטיול לא שמורים באתר. הם נטענים רק מקישור פרטי ונשמרים בטלפון הזה בלבד. אפשר לפתוח את הקישור, או להדביק אותו כאן:</p>
          ${importBox()}</section>
        <section class="quick"><a class="q" href="#/places"><span>📍</span>מקומות</a><a class="q" href="#/info/metro"><span>🚇</span>מפת מטרו</a><a class="q" href="#/info/tips"><span>💡</span>טיפים</a><a class="q" href="#/info/emergency"><span>🆘</span>חירום</a></section>
        <section class="card"><h2>מזג אוויר ברומא</h2><div id="wx"><p class="muted">טוען…</p></div></section>`;
    }
    const di = T.days.findIndex(d => d.date === n.date);
    let html = '';
    if (n.date < T.start) {
      const left = diffDays(n.date, T.start);
      html += `<section class="hero">
        <div class="hero-kicker">${left === 1 ? 'מחר טסים' : 'עוד'}</div>
        ${left === 1 ? '' : `<div class="hero-num">${left}<span>ימים</span></div>`}
        <div class="hero-roman" aria-hidden="true">${toRoman(left)}</div>
        ${T.hero ? `<div class="hero-sub">${esc(T.hero)}</div>` : ''}
      </section>`;
      const rem = T.reminders.filter(r => r.date >= n.date).slice(0, 5);
      if (rem.length) html += `<section class="card"><h2>תזכורות קרובות</h2><ul class="rem">${rem.map(r => {
        const dd = diffDays(n.date, r.date);
        const when = dd === 0 ? 'היום' : dd === 1 ? 'מחר' : `בעוד ${dd} ימים`;
        return `<li><span class="rem-date">${dm(r.date)}<small>${when}</small></span><span>${esc(r.text)}${r.place ? ` <a href="#/place/${r.place}">פרטים</a>` : ''}</span></li>`;
      }).join('')}</ul></section>`;
      const open = T.days.filter(d => d.suggestions);
      html += `<section class="card"><h2>עוד פתוח בלו״ז</h2><div class="open-days">${open.map(d => `<a class="open-day" href="#/day/${d.date}"><b>${WD[wd(d.date)]} ${dm(d.date)}</b><span>${esc(d.title)} · יש הצעה</span></a>`).join('')}</div>
        ${tasksLeft()}</section>`;
    } else if (n.date > T.end) {
      const been = prefixed('been:').filter(x => x.val).length;
      html += `<section class="hero"><div class="hero-kicker">ברוכים השבים</div><div class="hero-sub">היו ${T.days.length} ימים, ${been} מקומות סומנו ״היינו״.</div></section>`;
    } else {
      const d = T.days[di];
      html += `<section class="hero hero-trip">
        <div class="hero-kicker">יום ${di + 1} מתוך ${T.days.length} · ${WD[wd(d.date)]} ${dm(d.date)}${d.city !== 'rome' ? ` · ${cityName(d.city)}` : ''}</div>
        <div class="hero-title">${esc(d.title)}</div>
      </section>`;
      const items = dayItems(d);
      const cur = items.filter(it => it.t && it.t <= n.time).pop();
      const next = items.find(it => it.t && it.t > n.time);
      if (cur || next) html += `<section class="card now-next">${cur ? `<div><span class="nn-label">עכשיו</span><b>${esc(cur.t)}</b> ${esc(cur.title)}</div>` : ''}${next ? `<div><span class="nn-label nn-next">הבא</span><b>${esc(next.t)}</b> ${esc(next.title)}</div>` : ''}</section>`;
      html += quickActions();
      if (d.tasks) html += `<section class="card"><h2>לא לשכוח היום</h2>${checklist(d.tasks, 'day:' + d.date)}</section>`;
      html += `<section class="card"><h2>התוכנית של היום <a class="h-link" href="#/day/${d.date}">הכל ←</a></h2>${timeline(items, n.time)}
        ${d.suggestions ? `<p class="muted small">יש הצעות ליום הזה במסך <a href="#/day/${d.date}">הלו״ז</a>.</p>` : ''}</section>`;
      const tm = T.days[di + 1];
      if (tm) {
        const first = dayItems(tm).find(it => it.t);
        html += `<section class="card tomorrow"><h2>מחר · ${dayLabel(tm.date)}</h2><p><b>${esc(tm.title)}</b>${first ? ` · מתחילים ב-${esc(first.t)} (${esc(first.title)})` : ''}</p><a href="#/day/${tm.date}">לתוכנית של מחר ←</a></section>`;
      }
    }
    if (n.date <= T.end) {
      html += `<section class="card"><h2>מזג אוויר</h2><div id="wx"><p class="muted">טוען…</p></div></section>`;
      if (n.date < T.start) html += quickActions();
      setTimeout(() => fillWeather(document.getElementById('wx'), n.date < T.start ? T.start : n.date));
    }
    return html;
  };

  function tasksLeft() {
    const l = T.lists.find(x => x.id === 'tasks');
    const all = listItems(l);
    const left = all.filter(it => !get(it.chk)).length;
    return `<a class="row-link" href="#/lists/tasks">נשארו ${left} משימות לפני הטיול ←</a>`;
  }

  function quickActions() {
    return `<section class="quick">
      ${T.hotel ? `<a class="q" href="${navUrl(hotelQ())}" target="_blank" rel="noopener"><span>🏨</span>נווט למלון</a>
      <button class="q" data-act="taxi"><span>🚕</span>כתובת לנהג</button>` : ''}
      <a class="q" href="#/info/metro"><span>🚇</span>מפת מטרו</a>
      <a class="q" href="#/info/emergency"><span>🆘</span>חירום</a>
    </section>`;
  }

  V.plan = () => {
    const n = nowRome();
    if (!hasTrip) return `<section class="card"><h2>עוד אין לו״ז בטלפון הזה</h2><p>הלו״ז נטען מהקישור הפרטי של הטיול. פתחו אותו, או הדביקו אותו כאן:</p>${importBox()}</section>`;
    const unplanned = T.places.filter(p => p.status === 'idea' && !planDays(p.id).length).length;
    return `${T.lead ? `<p class="lead">${esc(T.lead)}</p>` : ''}
      <div class="days">${T.days.map((d, i) => {
      const items = dayItems(d);
      const booked = items.filter(it => ['booked', 'paid', 'pay'].includes(it.status)).length;
      return `<a class="day-card ${d.date === n.date ? 'is-today' : ''} ${d.date < n.date && n.date <= T.end ? 'is-past' : ''}" href="#/day/${d.date}">
          <div class="day-date"><span>${WDS[wd(d.date)]}</span><b>${parseD(d.date).getUTCDate()}</b></div>
          <div class="day-main">
            <div class="day-title">${esc(d.title)}</div>
            <div class="day-meta">יום ${i + 1}${d.city === 'florence' ? ' · <span class="badge b-city">פירנצה</span>' : ''}${booked ? ` · ${booked} הזמנות` : ''}${d.suggestions ? ' · <span class="badge b-idea">פתוח + הצעה</span>' : ''}${d.date === n.date ? ' · <span class="badge b-ok">היום</span>' : ''}</div>
          </div>
        </a>`;
    }).join('')}</div>
      <a class="row-link card" href="#/places" data-act="show-unplanned">${unplanned} מקומות מהרשימה שלכם עוד לא בלו״ז ←</a>`;
  };

  V.day = date => {
    const i = T.days.findIndex(d => d.date === date);
    const d = T.days[i];
    if (!d) return '<p>היום לא נמצא.</p>';
    const n = nowRome();
    const prev = T.days[i - 1], next = T.days[i + 1];
    let html = `<section class="day-head">
      <div class="day-kicker">יום ${i + 1} · ${WD[wd(d.date)]} ${dm(d.date)}${d.city !== 'rome' ? ` · ${cityName(d.city)}` : ''}</div>
      <h2 class="day-h">${esc(d.title)}</h2>
    </section>`;
    if (d.intro) html += `<p class="note">${esc(d.intro)}</p>`;
    if (d.tasks) html += `<section class="card"><h3>לא לשכוח</h3>${checklist(d.tasks, 'day:' + d.date)}</section>`;
    html += `<section class="card"><h3>התוכנית</h3>${timeline(dayItems(d), d.date === n.date ? n.time : null)}
      <button class="btn ghost" data-act="add-item" data-date="${d.date}">＋ הוספה ללו״ז</button></section>`;
    for (const s of d.suggestions || []) {
      html += `<details class="card sugg" open><summary><h3>${esc(s.title)}</h3></summary>${timeline(s.items.map(x => ({ ...x })), null)}</details>`;
    }
    html += `<section class="card"><h3>הערות ליום</h3><textarea class="note-input" data-save="dnote:${d.date}" rows="3" placeholder="למשל: איפה נפגשים, מה לקנות, מה היה מעולה…">${esc(get('dnote:' + d.date) || '')}</textarea></section>`;
    html += `<nav class="pager">${prev ? `<a href="#/day/${prev.date}">→ ${dayLabel(prev.date)}</a>` : '<span></span>'}${next ? `<a href="#/day/${next.date}">${dayLabel(next.date)} ←</a>` : '<span></span>'}</nav>`;
    return html;
  };

  // places list state (kept while the app is open)
  const pf = { q: '', city: 'all', cat: 'all', fav: false, mine: false, rain: false, unplanned: false };

  V.places = () => {
    const chip = (key, val, label) => `<button class="fchip ${pf[key] === val ? 'on' : ''}" data-act="pf" data-k="${key}" data-v="${val}">${label}</button>`;
    const tog = (key, label) => `<button class="fchip ${pf[key] ? 'on' : ''}" data-act="pft" data-k="${key}">${label}</button>`;
    return `<div class="search"><input type="search" id="q" placeholder="חיפוש: פסטה, קולוסיאום, גלידה…" value="${esc(pf.q)}" autocomplete="off"></div>
      <div class="seg">${chip('city', 'all', 'הכל')}${chip('city', 'rome', 'רומא')}${chip('city', 'florence', 'פירנצה')}</div>
      <div class="chips">${chip('cat', 'all', 'כל הסוגים')}${T.categories.map(c => chip('cat', c.id, `${c.icon} ${c.name}`)).join('')}</div>
      <div class="chips">${tog('fav', '❤️ מועדפים')}${hasTrip ? tog('mine', '⭐ הרשימה שלנו') + tog('unplanned', '📅 עוד לא בלו״ז') : ''}${tog('rain', '☔ ליום גשום')}</div>
      <div id="results">${placesResults()}</div>`;
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
    const rank = p => { const d = planDays(p.id); return d.length ? '0' + d[0] : p.status === 'idea' ? '1' : '2'; };
    const active = list.filter(p => p.status !== 'skip').sort((a, b) => rank(a).localeCompare(rank(b)));
    const skipped = list.filter(p => p.status === 'skip');
    if (!list.length) return '<p class="empty">לא נמצאו מקומות. אפשר לנקות את הסינון.</p>';
    return `<p class="muted small">${active.length} מקומות</p><div class="places">${active.map(placeCard).join('')}</div>
      ${skipped.length ? `<details class="skipped"><summary>ויתרנו (${skipped.length})</summary><div class="places">${skipped.map(placeCard).join('')}</div></details>` : ''}`;
  }

  function placeCard(p) {
    const fav = get('fav:' + p.id);
    return `<article class="place ${p.status === 'skip' ? 'is-skip' : ''}">
      <a class="place-link" href="#/place/${p.id}">
        <span class="place-ic">${catIcon(p.cat)}</span>
        <span class="place-txt">
          <b>${esc(p.name)}</b>
          <small>${esc(p.area || '')}${p.area ? ' · ' : ''}${cityName(p.city)}</small>
          <span class="place-short">${esc(p.status === 'skip' ? p.skipReason || p.short : p.short)}</span>
          <span class="badges">${placeBadges(p)}</span>
        </span>
      </a>
      <button class="fav ${fav ? 'on' : ''}" data-act="fav" data-id="${p.id}" aria-label="מועדף" aria-pressed="${!!fav}">${heart(fav)}</button>
    </article>`;
  }

  V.place = id => {
    const p = P[id];
    if (!p) return '<p>המקום לא נמצא.</p>';
    const fav = get('fav:' + p.id), been = get('been:' + p.id);
    const rows = [['🕘', p.hours], ['💶', p.price], ['🚇', p.metro]].filter(r => r[1]);
    const alsoAlt = T.days.filter(d => [...(d.items || []), ...(d.suggestions || []).flatMap(s => s.items)].some(it => it.place === p.id || (it.alts || []).includes(p.id)));
    return `<section class="place-head">
        <div class="place-kicker">${catIcon(p.cat)} ${esc(CAT[p.cat]?.name || '')} · ${esc(p.area || '')}${p.area ? ' · ' : ''}${cityName(p.city)}</div>
        <h2>${esc(p.name)}</h2>
        <div class="en">${esc(p.en.split(',')[0])}</div>
        <div class="badges">${placeBadges(p)}</div>
      </section>
      <div class="actions">
        <a class="btn primary" href="${navUrl(placeQuery(p))}" target="_blank" rel="noopener">נווט</a>
        <a class="btn" href="${mapUrl(placeQuery(p))}" target="_blank" rel="noopener">במפה</a>
        ${p.web ? `<a class="btn" href="${esc(p.web)}" target="_blank" rel="noopener">אתר</a>` : ''}
      </div>
      <div class="toggles">
        <button class="tbtn ${fav ? 'on' : ''}" data-act="fav" data-id="${p.id}">${heart(fav)} ${fav ? 'במועדפים' : 'למועדפים'}</button>
        <button class="tbtn ${been ? 'on' : ''}" data-act="been" data-id="${p.id}">${been ? '✓ היינו כאן' : 'סמנו ״היינו״'}</button>
      </div>
      <section class="card">
        ${p.status === 'skip' && p.skipReason ? `<p class="note">למה ויתרנו: ${esc(p.skipReason)}</p>` : ''}
        <p class="lead">${esc(p.short)}</p>
        ${p.desc ? `<p>${esc(p.desc)}</p>` : ''}
        ${rows.length ? `<ul class="facts">${rows.map(r => `<li><span>${r[0]}</span>${esc(r[1])}</li>`).join('')}</ul>` : ''}
        ${p.tips?.length ? `<h3>טיפים</h3><ul class="tips">${p.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      </section>
      ${alsoAlt.length ? `<section class="card"><h3>מופיע בלו״ז</h3><div class="tl-links">${alsoAlt.map(d => `<a class="chip" href="#/day/${d.date}">${dayLabel(d.date)} · ${esc(d.title)}</a>`).join('')}</div></section>` : ''}
      ${hasTrip ? `<section class="card">
        <h3>הוספה ללו״ז</h3>
        <select class="select" data-input="add-to-day" data-id="${p.id}">
          <option value="">בחרו יום…</option>
          ${T.days.map(d => `<option value="${d.date}">${WD[wd(d.date)]} ${dm(d.date)} · ${esc(d.title)}</option>`).join('')}
        </select>
      </section>` : ''}
      <section class="card"><h3>הערה אישית</h3><textarea class="note-input" data-save="pnote:${p.id}" rows="2" placeholder="מה הזמנו, מה טעים, מה לא לשכוח…">${esc(get('pnote:' + p.id) || '')}</textarea></section>`;
  };

  V.info = open => {
    const sec = (id, icon, title, body) => `<details class="card acc" id="sec-${id}" ${open === id ? 'open' : ''}><summary><h2><span>${icon}</span>${title}</h2></summary><div class="acc-body">${body}</div></details>`;
    const vaultRow = id => {
      const f = T.vault.find(x => x.id === id);
      if (!f) return '';
      const v = get('vault:' + id);
      return v ? `<button class="code" data-act="copy" data-text="${esc(v)}"><small>${esc(f.label)}</small><b>${esc(v)}</b><span>העתקה</span></button>`
        : `<a class="code empty" href="#/info/vault"><small>${esc(f.label)}</small><span>להוסיף ←</span></a>`;
    };
    const ul = (arr, cls = 'tips') => arr?.length ? `<ul class="${cls}">${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
    const h = T.hotel;
    let html = '';
    if (T.flights.length) html += sec('flights', '✈️', 'טיסות', `${T.flights.map(f => `<div class="flight">
        <div class="flight-head"><span class="badge b-ok">${esc(f.dir)}</span><b>${WD[wd(f.date)]} ${dm(f.date)}</b><span>${esc(f.airline)}</span></div>
        <div class="flight-route"><span>${esc(f.from)}</span><span class="arrow">←</span><span>${esc(f.to)}</span></div>
        <ul class="facts"><li><span>🧾</span>צ׳ק-אין: ${esc(f.checkin)}</li><li><span>🧳</span>${esc(f.bags)}</li></ul>
        ${f.vault ? vaultRow(f.vault) : ''}
      </div>`).join('')}
      ${T.vault.filter(v => v.flight).map(v => vaultRow(v.id)).join('')}
      ${ul(T.flightNotes)}`);

    if (h) html += sec('hotel', '🏨', 'המלון', `<p class="lead"><b>${esc(h.name)}</b>${h.room ? `<br>${esc(h.room)}` : ''}</p>
      <ul class="facts"><li><span>📍</span>${esc(h.address)}</li>${h.near ? `<li><span>🚇</span>${esc(h.near)}</li>` : ''}${h.checkin ? `<li><span>🔑</span>${esc(h.checkin)}</li>` : ''}</ul>
      ${ul(h.notes)}
      ${vaultRow('hotel')}
      <div class="actions">
        <a class="btn primary" href="${navUrl(hotelQ())}" target="_blank" rel="noopener">נווט</a>
        ${h.phone ? `<a class="btn" href="${telUrl(h.phone)}">התקשרות</a>` : ''}
        ${h.email ? `<a class="btn" href="mailto:${esc(h.email)}">מייל</a>` : ''}
        <button class="btn" data-act="taxi">כתובת לנהג</button>
      </div>`);

    html += sec('airport', '🛬', 'מהשדה לעיר ובחזרה', `
      <h3>Leonardo Express (רכבת)</h3>
      <p>רכבת ישירה בין פיומיצ׳ינו לטרמיני, בערך 32 דק׳, כל 15–30 דק׳ מהבוקר המוקדם עד הלילה. כרטיס (14€) קונים בתחנה או באפליקציית Trenitalia, ומתקפים לפני העלייה.</p>
      <h3>מונית</h3>
      <p>יש תעריף קבוע מפיומיצ׳ינו למרכז רומא (בתוך החומות), בערך 55€, וכדאי לוודא לפני הנסיעה. לוקחים רק מונית לבנה רשמית מהתור, לא ממי שמציע נסיעה בטרמינל.</p>
      ${ul(T.airportNotes)}`);

    html += sec('metro', '🚇', 'מטרו ותחבורה', `${metroMap()}
      <div class="legend">
        <span><i style="background:var(--mA)"></i><b>A</b> ותיקן (Ottaviano), מדרגות ספרד (Spagna), פיאצה דל פופולו (Flaminio), טרווי (Barberini)</span>
        <span><i style="background:var(--mB)"></i><b>B</b> ${h?.metro ? `המלון (${esc(h.metro)}), ` : ''}קולוסיאום, קרקס מקסימוס, טסטאצ׳ו (Piramide)</span>
        <span><i style="background:var(--mC)"></i><b>C</b> הקו החדש: תחנות-המוזיאון ליד הקולוסיאום</span>
      </div>
      <p class="muted small">מפה סכמטית, רק התחנות הרלוונטיות.</p>
      ${h?.stations?.length ? `<h3>הכי קרוב למלון</h3><ul class="facts">${h.stations.map(x => `<li><span>🚶</span>${esc(x)}</li>`).join('')}</ul>` : ''}
      <h3>כרטיס שבועי CIS</h3>
      <p>נסיעות ללא הגבלה במטרו, באוטובוסים, בחשמליות וברכבות האזוריות בתוך רומא. <b>29€ לאדם</b>. תקף עד חצות של היום השביעי, כולל יום התיקוף.</p>
      <ul class="tips">
        <li>קונים במכונות ATAC בתחנות, בקופות, או בטבק/קיוסק עם שלט T. בוחרים ״CIS״ או ״Weekly ticket״. נמכר רק כנייר</li>
        <li>תיקוף ראשון בשער המטרו או במכונה באוטובוס. באוטובוס צריך לשמור אותו ולהראות בביקורת</li>
        <li>קנס על נסיעה בלי כרטיס תקף: 100–500€</li>
        <li>אפשר גם להיכנס עם כרטיס אשראי ללא מגע ישירות בשער, כרטיס אחד לכל אחד</li>
      </ul>
      <h3>שעות</h3>
      <p>בערך 05:30–23:30, ובשישי ושבת עד 01:30. ביום עצמו כדאי לבדוק בגוגל מפות או ב-Moovit, שמראים עיכובים ושביתות.</p>
      <h3>מוניות</h3>
      <p>המוניות הרשמיות לבנות, עם ״TAXI״ על הגג ו״Roma Capitale״ על הדלת, ויש בהן מונה. לבקש להפעיל מונה. להזמנה: itTaxi.</p>
      <h3>רכבות לפירנצה</h3>
      <p>Frecciarossa (Trenitalia) ו-Italo יוצאות מטרמיני כל היום, כשעה וחצי נסיעה.</p>`);

    html += sec('weather', '🌦️', 'מזג אוויר', `<div id="wx"><p class="muted">טוען…</p></div>`);
    html += sec('tips', '💡', 'טיפים', `<ul class="tip-cards">${T.tips.map(t => `<li><span>${t.icon}</span><div><b>${esc(t.title)}</b><p>${esc(t.text)}</p></div></li>`).join('')}</ul>`);
    html += sec('phrases', '🗣️', 'משפטים באיטלקית', `<ul class="phrases">${T.phrases.map(p => `<li><b dir="ltr">${esc(p.it)}</b><span>${esc(p.he)}</span><small>${esc(p.say)}</small></li>`).join('')}</ul>`);
    html += sec('apps', '📱', 'אפליקציות להורדה', `<ul class="facts">${T.apps.map(a => `<li><span>•</span><div><b dir="ltr">${esc(a.name)}</b>: ${esc(a.why)}</div></li>`).join('')}</ul>`);
    html += sec('emergency', '🆘', 'חירום', `<ul class="emerg">${T.emergency.map(e => `<li><div><b>${esc(e.name)}</b>${e.note ? `<small>${esc(e.note)}</small>` : ''}</div><a class="btn" href="${telUrl(e.phone)}" dir="ltr">${esc(e.phone)}</a></li>`).join('')}</ul>
      ${T.emergencyNote ? `<p class="muted small">${esc(T.emergencyNote)}</p>` : ''}`);
    if (hasTrip) html += sec('vault', '🔐', 'פרטי הזמנות', `<p class="note">נשמר רק בטלפון הזה, לא באתר. סיסמאות עדיף לשמור באפליקציית הסיסמאות של האייפון ולא כאן.</p>
      ${T.vault.map(f => `<label class="field"><span>${esc(f.label)}</span>${f.multi
        ? `<textarea class="note-input" rows="3" data-save="vault:${f.id}">${esc(get('vault:' + f.id) || '')}</textarea>`
        : `<input class="input" data-save="vault:${f.id}" value="${esc(get('vault:' + f.id) || '')}" dir="auto" autocomplete="off">`}</label>`).join('')}`);
    const tripTs = kv.trip?.[1];
    html += sec('sync', '🔄', 'קישור הטיול וסנכרון', `<p>פרטי הטיול וכל מה שמסמנים באפליקציה (מועדפים, וי ברשימות, הערות, הוצאות ופרטי הזמנות) נשמרים רק בטלפון הזה. באתר עצמו יש רק מדריך כללי.</p>
      ${hasTrip ? `<p class="note">גרסת הטיול בטלפון: ${new Date(tripTs).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>` : ''}
      <h3>קיבלתם קישור?</h3>
      <p class="small muted">קישור טיול מעודכן, או קישור סנכרון מהטלפון השני. בכל טעינה העדכון החדש יותר מנצח.</p>
      ${importBox()}
      <h3>שליחה לטלפון השני</h3>
      <p class="small muted">יוצר קישור עם כל מה שיש בטלפון הזה. לשלוח רק בצ׳אט פרטי.</p>
      <label class="check"><input type="checkbox" id="exp-vault" checked> לכלול את פרטי ההזמנות</label>
      <div class="actions"><button class="btn" data-act="export">שליחת קישור סנכרון</button></div>
      <p class="muted small">באייפון, אפליקציה שנשמרה במסך הבית שומרת את הנתונים בנפרד מספארי. לכן אם הקישור נפתח בספארי, עדיף להעתיק אותו ולהדביק כאן מתוך האפליקציה.</p>
      <h3>מחיקה</h3>
      <button class="link-btn danger" data-act="wipe">מחיקת כל נתוני הטיול מהטלפון הזה</button>`);
    setTimeout(() => fillWeather(document.getElementById('wx'), hasTrip && T.start > nowRome().date ? T.start : nowRome().date));
    return html;
  };

  function metroMap() {
    const A = [['Ottaviano', 38, 62, 'b', 'ותיקן'], ['Lepanto', 68, 52, 't'], ['Flaminio', 102, 46, 't', 'פופולו'], ['Spagna', 134, 68, 'r', 'מדרגות ספרד'], ['Barberini', 157, 92, 'r', 'טרווי'], ['Repubblica', 177, 112, 'l'], ['Termini', 197, 132, 'T'], ['Vittorio Emanuele', 219, 157, 'r'], ['Manzoni', 239, 181, 'r'], ['San Giovanni', 259, 205, 'r']];
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
      ${line(C, 'var(--mC)')}${line(A, 'var(--mA)')}${line(B, 'var(--mB)')}
      ${dots(A)}${dots(B)}${dots(C)}
      <circle cx="197" cy="132" r="7.5" class="dot dot-big"/>
      ${hs ? `<circle cx="${hs[1]}" cy="${hs[2]}" r="6" class="dot dot-hotel"/>` : ''}
      ${[...A, ...B, ...C].map(label).join('')}
    </svg>`;
  }

  // ---------- lists ----------
  let listTab = 'pack';
  function listItems(l) {
    const base = l.items.map(text => ({ text, chk: `chk:${l.id}:${hash(text)}`, hide: `hide:${l.id}:${hash(text)}` })).filter(it => !get(it.hide));
    const mine = prefixed(`li:${l.id}:`).sort((a, b) => a.ts - b.ts).map(x => ({ text: x.val, chk: `chk:${l.id}:${x.id}`, mine: x.key }));
    return [...base, ...mine];
  }
  function checklist(texts, ns) {
    return `<ul class="checks">${texts.map(t => {
      const k = `chk:${ns}:${hash(t)}`;
      return `<li><label class="check"><input type="checkbox" data-check="${k}" ${get(k) ? 'checked' : ''}><span>${esc(t)}</span></label></li>`;
    }).join('')}</ul>`;
  }

  V.lists = tab => {
    if (tab) listTab = tab;
    const tabs = [...T.lists.map(l => [l.id, l.name]), ['money', 'הוצאות']];
    let html = `<div class="seg seg-4">${tabs.map(([id, name]) => `<a class="fchip ${listTab === id ? 'on' : ''}" href="#/lists/${id}">${name}</a>`).join('')}</div>`;
    if (listTab === 'money') return html + moneyView();
    const l = T.lists.find(x => x.id === listTab) || T.lists[0];
    const items = listItems(l);
    const done = items.filter(it => get(it.chk)).length;
    const hidden = l.items.filter(t => get(`hide:${l.id}:${hash(t)}`)).length;
    html += `<section class="card">
      <div class="progress"><div style="width:${items.length ? Math.round(done / items.length * 100) : 0}%"></div></div>
      <p class="muted small">${done} מתוך ${items.length}</p>
      <ul class="checks">${items.map(it => `<li><label class="check"><input type="checkbox" data-check="${it.chk}" ${get(it.chk) ? 'checked' : ''}><span>${esc(it.text)}</span></label>
        <button class="x" data-act="${it.mine ? 'del-key' : 'hide'}" data-key="${esc(it.mine || it.hide)}" aria-label="הסרה">×</button></li>`).join('')}</ul>
      <form class="add-row" data-form="add-li" data-list="${l.id}"><input class="input" name="text" placeholder="הוספת פריט…" autocomplete="off"><button class="btn primary">הוספה</button></form>
      ${hidden ? `<button class="link-btn" data-act="unhide" data-list="${l.id}">החזרת ${hidden} פריטים שהוסרו</button>` : ''}
    </section>`;
    return html;
  };

  function moneyView() {
    const pre = T.prepaid;
    const preIls = pre.reduce((s, x) => s + x.ils, 0);
    const rate = T.eurToIls || 3.5;
    const exps = prefixed('exp:').sort((a, b) => b.ts - a.ts);
    const eur = exps.reduce((s, x) => s + (+x.val.eur || 0), 0);
    return `${pre.length ? `<section class="card">
        <h3>שולם לפני הטיול</h3>
        <ul class="money">${pre.map(x => `<li><div><b>${esc(x.name)}</b><small>${esc(x.status)}</small></div><span dir="ltr">${esc(x.orig)}<small>${x.ils.toLocaleString('he-IL')}₪</small></span></li>`).join('')}</ul>
        <div class="total"><span>סה״כ</span><b>${Math.round(preIls).toLocaleString('he-IL')}₪</b></div>
        ${T.due ? `<p class="note">${esc(T.due)}</p>` : ''}
      </section>` : ''}
      <section class="card">
        <h3>הוצאות בטיול</h3>
        <form class="add-row add-exp" data-form="add-exp">
          <input class="input" name="what" placeholder="על מה? (גלידה, מונית…)" autocomplete="off" required>
          <input class="input num" name="eur" type="number" inputmode="decimal" step="0.01" min="0" placeholder="€" required>
          <button class="btn primary">הוספה</button>
        </form>
        ${exps.length ? `<ul class="money">${exps.map(x => `<li><div><b>${esc(x.val.what)}</b><small>${dayLabel(x.val.d)}</small></div><span dir="ltr">${(+x.val.eur).toFixed(2)}€</span><button class="x" data-act="del-key" data-key="${esc(x.key)}" aria-label="מחיקה">×</button></li>`).join('')}</ul>
          <div class="total"><span>סה״כ בטיול</span><b dir="ltr">${eur.toFixed(2)}€ <small>≈ ${Math.round(eur * rate).toLocaleString('he-IL')}₪</small></b></div>` : '<p class="muted small">עוד אין הוצאות. מה שמוסיפים כאן נשמר בטלפון.</p>'}
      </section>`;
  }

  // ---------- router ----------
  const TITLES = { plan: 'לו״ז', places: 'מקומות ומסעדות', info: 'מידע שימושי', lists: 'רשימות' };
  const TAB = { today: 'today', plan: 'plan', day: 'plan', places: 'places', place: 'places', info: 'info', lists: 'lists' };
  const scrolls = {};
  let current = '';

  function parseRoute() {
    const [, name = 'today', arg] = (location.hash.slice(1) || '/today').split('/');
    return { name: V[name] ? name : 'today', arg: arg ? decodeURIComponent(arg) : undefined };
  }

  function render(keepScroll) {
    const { name, arg } = parseRoute();
    const key = location.hash;
    if (!keepScroll && current) scrolls[current] = window.scrollY;
    view.innerHTML = V[name](arg);
    let title = name === 'today' ? T.title : TITLES[name];
    if (name === 'day') title = T.days.find(d => d.date === arg) ? `${WD[wd(arg)]} ${dm(arg)}` : 'לו״ז';
    if (name === 'place') title = P[arg]?.name || 'מקום';
    document.getElementById('title').textContent = title;
    document.getElementById('back').hidden = !(name === 'day' || name === 'place');
    document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === TAB[name]));
    if (!keepScroll) {
      if (name === 'info' && arg) {
        document.getElementById('sec-' + arg)?.scrollIntoView({ block: 'start' });
      } else window.scrollTo(0, scrolls[key] && (name === 'places' || name === 'plan') ? scrolls[key] : 0);
    }
    current = key;
    if (name === 'places') bindSearch();
  }

  function bindSearch() {
    const q = document.getElementById('q');
    if (!q) return;
    q.addEventListener('input', () => { pf.q = q.value; document.getElementById('results').innerHTML = placesResults(); });
  }

  // back goes to the previous screen if we navigated inside the app, otherwise to the parent tab
  let inAppNavs = 0;
  document.getElementById('back').addEventListener('click', () => {
    const { name } = parseRoute();
    if (inAppNavs > 0) history.back();
    else location.hash = name === 'day' ? '#/plan' : '#/places';
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
      openSheet(`<h2>טעינת קישור</h2>
        ${trip ? `<p>${isNewer ? '<b>גרסה חדשה של הטיול</b>' : 'הטיול בקישור לא חדש יותר ממה שכבר יש בטלפון'} (לו״ז, לינה, טיסות).</p>` : ''}
        ${others ? `<p>ועוד ${others} פריטים: מועדפים, רשימות, הערות, פרטי הזמנות. העדכון החדש יותר מנצח.</p>` : ''}
        <div class="actions"><button class="btn primary" data-act="do-import" data-code="${esc(code)}">טעינה</button><button class="btn" data-act="close">ביטול</button></div>`);
    } catch { toast('הקישור לא תקין'); }
  }

  // ---------- events ----------
  const ACT = {
    fav: el => { const k = 'fav:' + el.dataset.id; set(k, !get(k)); refresh(); },
    been: el => { const k = 'been:' + el.dataset.id; set(k, !get(k)); refresh(); },
    pf: el => { pf[el.dataset.k] = el.dataset.v; render(true); },
    pft: el => { pf[el.dataset.k] = !pf[el.dataset.k]; render(true); },
    'show-unplanned': () => { Object.assign(pf, { q: '', city: 'all', cat: 'all', fav: false, mine: true, rain: false, unplanned: true }); },
    'del-key': el => { del(el.dataset.key); refresh(); },
    hide: el => { set(el.dataset.key, true); refresh(); },
    unhide: el => { const l = T.lists.find(x => x.id === el.dataset.list); l.items.forEach(t => { const k = `hide:${l.id}:${hash(t)}`; if (get(k)) del(k); }); refresh(); },
    copy: el => copy(el.dataset.text),
    close: closeSheet,
    taxi: () => openSheet(`<div class="taxi"><p class="it" dir="ltr">Buongiorno! Per favore, mi porti a questo indirizzo:</p>
      <p class="big" dir="ltr">${(T.hotel.taxi || [T.hotel.name, T.hotel.address]).map(esc).join('<br>')}</p>
      ${T.hotel.taxiNear ? `<p class="muted" dir="ltr">(${esc(T.hotel.taxiNear)})</p>` : ''}
      <p class="small">״בבקשה, קח אותי לכתובת הזו״. אפשר להראות לנהג את המסך.</p></div>
      <div class="actions"><button class="btn" data-act="close">סגירה</button></div>`),
    'add-item': el => {
      const groups = T.categories.map(c => `<optgroup label="${esc(c.icon + ' ' + c.name)}">${T.places.filter(p => p.cat === c.id && p.status !== 'skip').map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</optgroup>`).join('');
      openSheet(`<h2>הוספה ללו״ז · ${dayLabel(el.dataset.date)}</h2>
        <form class="form" data-form="add-item" data-date="${el.dataset.date}">
          <label class="field"><span>שעה (לא חובה)</span><input class="input" type="time" name="t"></label>
          <label class="field"><span>מה?</span><input class="input" name="title" placeholder="למשל: גלידה ב-Giolitti" autocomplete="off"></label>
          <label class="field"><span>מקום מהרשימה (לא חובה)</span><select class="select" name="place"><option value="">בלי</option>${groups}</select></label>
          <div class="actions"><button class="btn primary">הוספה</button><button class="btn" type="button" data-act="close">ביטול</button></div>
        </form>`);
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
        rebuild(); closeSheet();
        toast(n ? `עודכנו ${n} פריטים` : 'הכל כבר מעודכן');
        const box = document.getElementById('imp-code'); if (box) box.value = '';
        refresh();
      } catch { toast('הטעינה נכשלה'); }
    },
    wipe: () => openSheet(`<h2>למחוק מהטלפון הזה?</h2><p>יימחקו פרטי הטיול, פרטי ההזמנות וכל הסימונים וההערות. אפשר לטעון שוב מהקישור.</p>
      <div class="actions"><button class="btn primary" data-act="do-wipe">מחיקה</button><button class="btn" data-act="close">ביטול</button></div>`),
    'do-wipe': () => {
      kv = {};
      try { localStorage.removeItem(KEY); localStorage.removeItem(WXKEY); } catch { }
      rebuild(); closeSheet(); toast('נמחק');
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

  document.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.check) { set(el.dataset.check, el.checked); if (parseRoute().name === 'lists') refresh(); }
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
    if (f.dataset.form === 'add-li' && fd.text.trim()) { set(`li:${f.dataset.list}:${uid()}`, fd.text.trim()); refresh(); document.querySelector('.add-row .input')?.focus(); }
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

  const off = document.getElementById('offline');
  const netState = () => { off.hidden = navigator.onLine; };
  window.addEventListener('online', netState);
  window.addEventListener('offline', netState);
  netState();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => { });
  }

  boot();
})();
