/* JHOOMWAVE Office app. Static page; all security is in the database (row-level security per role, 2FA required).
   This file only decides what to show. Every value from the database is shown with textContent (never as HTML). */
(function () {
  'use strict';
  // never run inside someone else's frame (clickjacking): GitHub Pages can't send the header, so check here
  if (window.top !== window.self) { document.documentElement.hidden = true; return; }
  const C = window.JW_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const VIEWS = ['v-login', 'v-mfa', 'v-denied', 'v-app'];
  const show = (v) => VIEWS.forEach((x) => { $(x).hidden = x !== v; });

  // tiny element builder: h('td', {class: 'x'}, 'text', child...)
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style') e.style.cssText = v; // CSSOM: allowed by our CSP (a style attribute would be blocked)
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return e;
  }
  const fmtDate = (s) => (s ? new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
  const inr = (n) => (n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN'));
  let toastT = 0;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3200); }
  function fail(err) { console.error(err); toast(err && err.message ? 'Not saved: ' + err.message : 'Something went wrong. Try again.'); }

  if (!C.supabaseUrl || !C.supabaseKey || !window.supabase) {
    show('v-login');
    $('login-msg').textContent = 'The Office is not connected to its database yet.';
    document.querySelectorAll('#f-email input, #f-email button').forEach((x) => { x.disabled = true; });
    return;
  }
  // session lives in this tab only: closing the tab signs you out
  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit', storage: window.sessionStorage },
  });
  window.__jwSb = sb; // for tests
  let ME = null;
  let factorId = null;

  // ---------------------------------------------------------------- sign in (email code)
  let email = '';
  $('f-email').addEventListener('submit', async (e) => {
    e.preventDefault();
    email = $('in-email').value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { $('login-msg').textContent = 'Type a full email address.'; return; }
    $('b-send').disabled = true;
    await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname } }); // same answer either way: don't reveal who is on the team
    $('b-send').disabled = false;
    $('f-email').hidden = true; $('f-code').hidden = false; $('in-code').focus();
    $('login-msg').textContent = 'If this email is on the team, an email is on its way: tap its sign-in link, or type the code if it has one. Check spam too.';
  });
  $('b-back').addEventListener('click', () => { $('f-code').hidden = true; $('f-email').hidden = false; $('login-msg').textContent = ''; });
  $('f-code').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = $('in-code').value.trim();
    const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
    if (error) { $('login-msg').textContent = 'That code did not work or has expired. Send a new one.'; return; }
    $('in-code').value = '';
    afterLogin();
  });

  // ---------------------------------------------------------------- 2FA (authenticator app)
  async function afterLogin() {
    const { data: aal, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) { show('v-login'); return; }
    if (aal.currentLevel === 'aal2') return loadMember();
    const { data: f } = await sb.auth.mfa.listFactors();
    const verified = ((f && f.totp) || []).find((x) => x.status === 'verified');
    show('v-mfa'); $('mfa-msg').textContent = '';
    if (verified) {
      factorId = verified.id; $('mfa-enroll').hidden = true; $('mfa-title').textContent = 'Two-step check';
    } else {
      for (const x of ((f && f.all) || []).filter((x) => x.status !== 'verified')) await sb.auth.mfa.unenroll({ factorId: x.id });
      const { data, error: e2 } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'JHOOMWAVE Office' });
      if (e2) { $('mfa-msg').textContent = 'Could not start 2-step setup. Reload and try again.'; return; }
      factorId = data.id; $('mfa-qr').src = data.totp.qr_code; $('mfa-secret').textContent = data.totp.secret;
      $('mfa-enroll').hidden = false; $('mfa-title').textContent = 'Set up 2-step login';
    }
    $('in-mfa').focus();
  }
  $('f-mfa').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code: $('in-mfa').value.trim() });
    $('in-mfa').value = '';
    if (error) { $('mfa-msg').textContent = 'Wrong code. Use the newest code in the app.'; return; }
    loadMember();
  });

  // ---------------------------------------------------------------- who am I
  async function loadMember() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return show('v-login');
    const { data, error } = await sb.from('members').select('*').eq('user_id', user.id).maybeSingle();
    if (error || !data || !data.active) return show('v-denied');
    ME = data;
    $('me-email').textContent = data.name || data.email; $('me-role').textContent = data.role;
    buildNav(); show('v-app'); route();
  }
  document.querySelectorAll('[data-signout]').forEach((b) => b.addEventListener('click', signOut));
  async function signOut(msg) {
    await sb.auth.signOut(); ME = null; show('v-login');
    $('f-code').hidden = true; $('f-email').hidden = false;
    $('login-msg').textContent = typeof msg === 'string' ? msg : 'Signed out.';
  }

  // sign out after inactivity
  let lastAct = Date.now();
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((ev) => addEventListener(ev, () => { lastAct = Date.now(); }, { passive: true }));
  setInterval(() => { if (ME && Date.now() - lastAct > (C.idleMinutes || 30) * 60000) signOut('Signed out after ' + (C.idleMinutes || 30) + ' minutes without activity.'); }, 30000);

  // ---------------------------------------------------------------- sections by role
  const ALL = ['owner', 'marketing', 'sales', 'support', 'viewer'];
  const ROUTES = {
    office: { label: '🏢 Office', roles: ALL, render: pageOffice },
    live: { label: '📹 Live cam', roles: ALL, render: pageLive },
    chat: { label: '💬 Team chat', roles: ALL, render: pageChat },
    meetings: { label: '📅 Meetings', roles: ALL, render: pageMeetings },
    tech: { label: '🛠️ Tech board', roles: ['owner', 'viewer'], render: pageTech },
    leads: { label: '💼 Leads', roles: ['owner', 'sales'], render: pageLeads },
    enquiries: { label: '💬 Enquiries', roles: ['owner', 'support', 'sales'], render: pageEnquiries },
    orders: { label: '🎵 Orders', roles: ['owner', 'support'], render: pageOrders },
    social: { label: '📣 Social', roles: ['owner', 'marketing'], render: pageSocial },
    team: { label: '👥 Team', roles: ['owner'], render: pageTeam },
    audit: { label: '🧾 Audit', roles: ['owner'], render: pageAudit },
  };
  const allowed = (r) => ME && ROUTES[r] && ROUTES[r].roles.includes(ME.role);
  function buildNav() {
    const nav = $('nav'); nav.replaceChildren();
    for (const [k, r] of Object.entries(ROUTES)) if (allowed(k)) { const [ic, ...rest] = r.label.split(' '); nav.append(h('a', { href: '#' + k, 'data-r': k }, h('span', { class: 'ni', 'aria-hidden': 'true' }, ic), h('span', { class: 'nl' }, rest.join(' ')))); }
  }
  addEventListener('hashchange', route);
  async function route() {
    if (!ME) return;
    stopLive(); liveTimers.forEach(clearInterval); liveTimers = [];
    let r = location.hash.slice(1);
    if (!allowed(r)) r = 'office';
    document.querySelectorAll('#nav a').forEach((a) => a.setAttribute('aria-current', a.getAttribute('data-r') === r ? 'page' : 'false'));
    const page = $('page'); page.replaceChildren(h('p', { class: 'mut' }, 'Loading…'));
    try { await ROUTES[r].render(page); } catch (e) { page.replaceChildren(h('p', { class: 'msg' }, 'Could not load this section.')); console.error(e); }
  }
  const rerender = () => route();

  // shared bits
  function statusSelect(value, options, onChange) {
    const s = h('select', { 'aria-label': 'Status' }, options.map((o) => h('option', { value: o, selected: o === value }, o.replace('_', ' '))));
    s.addEventListener('change', () => onChange(s.value));
    return s;
  }
  async function save(table, id, patch, key = 'id') {
    const { error } = await sb.from(table).update(patch).eq(key, id);
    if (error) fail(error); else toast('Saved');
    return !error;
  }
  function table(cols, rows, empty) {
    if (!rows.length) return h('div', { class: 'tw' }, h('p', { class: 'empty' }, empty));
    return h('div', { class: 'tw' }, h('table', {}, h('thead', {}, h('tr', {}, cols.map((c) => h('th', {}, c.t)))),
      h('tbody', {}, rows.map((r) => h('tr', {}, cols.map((c) => h('td', {}, c.v(r))))))));
  }
  function addForm(title, fields, onSubmit) {
    const f = h('form', { class: 'fgrid', novalidate: true });
    for (const fd of fields) {
      const id = 'add-' + fd.k;
      const input = fd.options ? h('select', { id }, fd.options.map((o) => h('option', { value: o }, o)))
        : fd.area ? h('textarea', { id, maxlength: fd.max || 2000 }) : h('input', { id, type: fd.type || 'text', maxlength: fd.max || 160, required: fd.req });
      f.append(h('div', { class: fd.area ? 'full' : '' }, h('label', { for: id }, fd.label), input));
    }
    f.append(h('div', { class: 'full' }, h('button', { class: 'btn', type: 'submit' }, 'Save')));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = {}; for (const fd of fields) { const x = f.querySelector('#add-' + fd.k).value.trim(); if (x !== '') v[fd.k] = fd.type === 'number' ? Number(x) : x; }
      if (fields.some((fd) => fd.req && !v[fd.k])) return toast('Fill the required fields.');
      if (await onSubmit(v)) rerender();
    });
    return h('details', { class: 'add' }, h('summary', {}, title), f);
  }

  // ---------------------------------------------------------------- Office floor (studio vibe)
  const DESK = {
    ceo: ['🧭', '#7B2FF7', '#FF2E88'], cto: ['🛠️', '#00C2FF', '#7B2FF7'], music: ['🎵', '#FF2E88', '#FF8A00'],
    growth: ['📣', '#FF8A00', '#FFD23F'], sales: ['🤝', '#2EE59D', '#00C2FF'], finance: ['💰', '#FFD23F', '#2EE59D'],
    'global-us': ['🇺🇸', '#3D7BFF', '#FF2E88'], 'global-gcc': ['🇦🇪', '#00B894', '#FFD23F'], 'global-uk': ['🇬🇧', '#7B2FF7', '#00C2FF'],
    qa: ['🧪', '#2EE59D', '#7B2FF7'], design: ['🎨', '#FF2E88', '#7B2FF7'], engineer: ['💻', '#00C2FF', '#2EE59D'], data: ['📊', '#FFD23F', '#00C2FF'],
    'creator-jhoomi': ['💃', '#FF2E88', '#FFD23F'], 'creator-veer': ['🎧', '#7B2FF7', '#2EE59D'], 'creator-noor': ['🌙', '#3D7BFF', '#FF2E88'],
    'support-anaya': ['💬', '#2EE59D', '#FF8A00'], 'support-sam': ['🧰', '#00C2FF', '#FF8A00'],
    hr: ['🌸', '#FF2E88', '#2EE59D'], perf: ['🎯', '#FF8A00', '#7B2FF7'], seo: ['🔎', '#00C2FF', '#FFD23F'], community: ['🤳', '#FF2E88', '#00C2FF'], video: ['🎬', '#7B2FF7', '#FF8A00'],
  };
  const TEAMS = ['Leadership', 'Tech squad', 'Music studio', 'Marketing & creators', 'Sales & global', 'Support desk', 'Finance', 'People & culture'];
  const monday = (d) => { const x = new Date(d); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); return x.toISOString().slice(0, 10); };
  const MOOD = { working: '🎧 In the zone', waiting: '☕ Waiting on someone', blocked: '🚧 Blocked', planned: '🪑 Joining soon' };
  function ago(s) {
    if (!s) return ''; const m = Math.round((Date.now() - new Date(s).getTime()) / 60000);
    if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); if (h < 24) return h + 'h ago';
    return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
  function nextHuddle() { // autopilot runs every 4 hours at minute 19 (UTC 00,04,08…)
    const n = new Date(), t = new Date(n); t.setUTCMinutes(19, 0, 0);
    while (t <= n || t.getUTCHours() % 4) t.setUTCHours(t.getUTCHours() + 1);
    const m = Math.round((t - n) / 60000); return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + ' min';
  }
  function greet() { const h = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }));
    return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
  function confetti(x, y) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = document.createElement('canvas'); c.id = 'confetti'; c.width = innerWidth; c.height = innerHeight; document.body.append(c);
    const g = c.getContext('2d'), cols = ['#7B2FF7', '#FF2E88', '#FF8A00', '#FFD23F', '#2EE59D', '#00C2FF'];
    const ps = Array.from({ length: 90 }, () => ({ x, y, vx: (Math.random() - .5) * 12, vy: -Math.random() * 12 - 4, r: Math.random() * 6 + 3, c: cols[Math.floor(Math.random() * cols.length)], a: Math.random() * 6 }));
    const t0 = performance.now();
    (function f(t) { g.clearRect(0, 0, c.width, c.height); for (const p of ps) { p.vy += .45; p.x += p.vx; p.y += p.vy; p.a += .2; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c; g.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); g.restore(); }
      if (t - t0 < 1600) requestAnimationFrame(f); else c.remove(); })(t0);
  }
  // Virtual HQ: sea-facing rooftop studio, Bandra, Mumbai. Sunrise/sunset from the NOAA approximation (no network).
  const HQ = { lat: 19.0544, lon: 72.8213, tz: 'Asia/Kolkata' };
  function sunTimes(now) {
    const y = now.getUTCFullYear(), mo = now.getUTCMonth(), d = now.getUTCDate(), rad = Math.PI / 180;
    const day = Math.round((Date.UTC(y, mo, d) - Date.UTC(y, 0, 0)) / 864e5), g = 2 * Math.PI / 365 * (day - 1);
    const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const ha = Math.acos(Math.cos(90.833 * rad) / (Math.cos(HQ.lat * rad) * Math.cos(decl)) - Math.tan(HQ.lat * rad) * Math.tan(decl)) / rad;
    const base = Date.UTC(y, mo, d);
    return { rise: new Date(base + (720 - 4 * (HQ.lon + ha) - eqt) * 60000), set: new Date(base + (720 - 4 * (HQ.lon - ha) - eqt) * 60000) };
  }
  const tfmt = (dt, tz) => dt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: tz || HQ.tz });
  function skyPhase(now) {
    // use the Mumbai calendar day, and compare plain milliseconds (Date + number would turn into text)
    const istDay = new Date(now.getTime() + 5.5 * 3600e3), { rise, set } = sunTimes(new Date(Date.UTC(istDay.getUTCFullYear(), istDay.getUTCMonth(), istDay.getUTCDate(), 12)));
    const t = now.getTime(), r = rise.getTime(), st = set.getTime(), m = 60000;
    if (t < r - 30 * m) return ['night', '🌙', 'Night shift under the stars', `sunrise ${tfmt(rise)}`];
    if (t > st + 40 * m) return ['night', '🌙', 'Night shift under the stars', `sunrise ${tfmt(new Date(r + 864e5))}`];
    if (t < r + 45 * m) return ['dawn', '🌅', 'Sunrise over the Arabian Sea', `sunset ${tfmt(set)}`];
    if (t > st - 60 * m) return ['golden', '🌇', 'Golden hour on the rooftop', `sunset ${tfmt(set)}`];
    return ['day', '☀️', 'Sunny day at the studio', `sunset ${tfmt(set)}`];
  }
  const DESKS = [['Mumbai · HQ', 'Asia/Kolkata', 'All'], ['New York', 'America/New_York', 'Neil'], ['Dubai', 'Asia/Dubai', 'Sara'], ['London', 'Europe/London', 'Jas']];
  // studio radio: only JHOOMWAVE's own original songs; the playlist follows the office theme
  const T = (f, n) => ({ src: f, name: n });
  const BASE = [T('../console/audio/jw_ai_sufi_house.mp3', 'Sufi Sunset'), T('../audio/music/chaand_se_zyada_preview.mp3', 'Chaand Se Zyada'), T('../console/audio/jhoom_04_mehndi_groove.mp3', 'Mehndi Groove'),
    T('media/studio.mp3', 'Jhoom Jhoom JHOOMWAVE'), T('../console/audio/jw_ai_garba_glow.mp3', 'Garba Glow'), T('../console/audio/jw_ai_afro_desi.mp3', 'Afro Desi'), T('../console/audio/jw_ai_bollywood_bounce.mp3', 'Bollywood Bounce')];
  const THEME_SONGS = {
    thanksgiving: [T('../audio/music/grateful_for_you_preview.mp3', 'Grateful For You')], christmas: [T('../audio/music/merry_christmas_yaara_preview.mp3', 'Merry Merry Christmas Yaara')],
    newyear: [T('media/studio.mp3', 'Jhoom Jhoom JHOOMWAVE'), T('../console/audio/jw_ai_bhangra_thunder.mp3', 'Bhangra Thunder')], diwali: [T('../audio/music/mann_mein_shyam_preview.mp3', 'Mann Mein Shyam'), T('../console/audio/jhoom_05_shaadi_anthem.mp3', 'Shaadi Anthem')],
    traditional: [T('../console/audio/jhoom_05_shaadi_anthem.mp3', 'Shaadi Anthem'), T('../console/audio/jhoom_03_sangeet_nights.mp3', 'Sangeet Nights')], holi: [T('../console/audio/jw_ai_bollywood_bounce.mp3', 'Bollywood Bounce')],
    neon80s: [T('../console/audio/jw_ai_desi_trap_royale.mp3', 'Desi Trap Royale')], halloween: [T('../console/audio/jw_ai_desi_trap_royale.mp3', 'Desi Trap Royale')],
  };
  const radio = { el: null, list: [], i: 0, theme: 'studio' };
  function radioList() { const extra = THEME_SONGS[document.body.dataset.theme] || []; return [...extra, ...BASE.filter((b) => !extra.some((e) => e.src === b.src))]; }
  function radioPlay(i) {
    radio.list = radioList(); radio.i = ((i % radio.list.length) + radio.list.length) % radio.list.length;
    if (!radio.el) { radio.el = new Audio(); radio.el.volume = 0.35; radio.el.addEventListener('ended', () => radioPlay(radio.i + 1)); radio.el.addEventListener('error', () => radioPlay(radio.i + 1)); }
    radio.el.src = radio.list[radio.i].src; radio.el.play().catch(() => toast('Tap play again to start the music')); radioUI();
  }
  function radioUI() { document.querySelectorAll('.radioplayer').forEach((w) => { const on = radio.el && !radio.el.paused;
    w.querySelector('.rp-play').textContent = on ? '⏸' : '▶'; w.querySelector('.rp-name').textContent = radio.el && radio.list[radio.i] ? '🎵 ' + radio.list[radio.i].name : '🎵 Studio radio'; w.classList.toggle('on', !!on); }); }
  function studioBtn() {
    const w = h('span', { class: 'radioplayer' },
      h('button', { type: 'button', class: 'rp-play', 'aria-label': 'Play or pause studio radio', onclick: () => { if (!radio.el || !radio.el.src) radioPlay(0); else if (radio.el.paused) { radio.el.play().catch(() => {}); } else radio.el.pause(); setTimeout(radioUI, 50); } }, '▶'),
      h('span', { class: 'rp-name' }, '🎵 Studio radio'),
      h('button', { type: 'button', class: 'rp-next', 'aria-label': 'Next song', onclick: () => radioPlay(radio.i + 1) }, '⏭'));
    setTimeout(radioUI, 0); return w;
  }
  const THEMES = {
    studio: ['🎛️ Studio', ''], thanksgiving: ['🦃 Thanksgiving', '🍂'], christmas: ['🎄 Christmas', '❄️'], diwali: ['🪔 Diwali', '✨'],
    halloween: ['🎃 Halloween', '🦇'], newyear: ['🎆 New Year', '🎉'], holi: ['🎨 Holi', '🌸'], traditional: ['🪷 Traditional', '🪷'], neon80s: ['🌴 Neon City (loading-screen art)', '🌴'],
  };
  function applyTheme(t) { document.body.dataset.theme = THEMES[t] ? t : 'studio'; }
  function themeRain(t) {
    const e = (THEMES[t] || [])[1]; if (!e) return null;
    return h('div', { class: 'rain', 'aria-hidden': 'true' }, Array.from({ length: 14 }, (_, i) => { const s = h('i', {}, e); s.style.left = (i * 7 + Math.random() * 5) + '%'; s.style.animationDelay = (Math.random() * 6).toFixed(1) + 's'; s.style.animationDuration = (6 + Math.random() * 5).toFixed(1) + 's'; return s; }));
  }
  function themePicker(cur) {
    const sel = h('select', { class: 'themesel', 'aria-label': 'Office theme' }, Object.entries(THEMES).map(([k, v]) => h('option', { value: k, selected: k === cur }, v[0])));
    sel.addEventListener('change', async () => { const { error } = await sb.from('office_vibe').upsert({ id: 1, theme: sel.value }); if (error) return fail(error); toast('Office theme: ' + THEMES[sel.value][0]); rerender(); });
    return sel;
  }
  const AV = {}; // agent id -> portrait path (AI-generated faces of people who do not exist)
  function avatar(id, size) {
    const d = DESK[id] || ['✨', '#7B2FF7', '#FF2E88'];
    const a = h('div', { class: 'ava' }, AV[id] ? h('img', { src: AV[id], alt: '', loading: 'lazy' }) : d[0]); a.style.background = `linear-gradient(135deg,${d[1]},${d[2]})`;
    if (AV[id]) { const b = h('span', { class: 'badge' }, d[0]); a.append(b); }
    if (size) { a.style.width = a.style.height = size + 'px'; a.style.fontSize = Math.round(size / 2) + 'px'; a.style.borderRadius = Math.round(size / 3) + 'px'; }
    return a;
  }
  async function pageOffice(page) {
    const [k, a, act, fa] = await Promise.all([
      sb.from('kpis').select('*').order('sort'),
      sb.from('agents').select('*').order('sort'),
      sb.from('activity').select('*').order('at', { ascending: false }).limit(40),
      ME.role === 'owner' ? sb.from('founder_actions').select('*').order('status', { ascending: false }).order('urgency').order('sort') : Promise.resolve({ data: [] }),
    ]);
    const today = new Date().toISOString().slice(0, 10), soon = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
    const [vb, cel, wg] = await Promise.all([sb.from('office_vibe').select('*').maybeSingle(), sb.from('celebrations').select('*').gte('day', today).lte('day', soon).order('day'), sb.from('weekly_goals').select('*').eq('week_start', monday(new Date())).order('id')]);
    const vibe = vb.data; applyTheme(vibe && vibe.theme);
    (a.data || []).forEach((x) => { if (x.avatar) AV[x.id] = x.avatar; });
    const agents = a.data || [], kp = Object.fromEntries((k.data || []).map((x) => [x.id, x]));
    const byName = Object.fromEntries(agents.map((x) => [x.name, x.id]));
    const busy = agents.filter((x) => x.status === 'working').length;
    const cust = parseInt(String((kp.customers || {}).value || '0').replace(/[^0-9]/g, ''), 10) || 0, goal = 10;
    const first = (ME.name || '').split(' ')[0] || 'boss';
    const word = busy >= Math.ceil(agents.length / 2) ? 'buzzing' : busy ? 'warming up' : 'getting ready';
    const kids = [];

    const eq = h('div', { class: 'eqbg', 'aria-hidden': 'true' }, Array.from({ length: 16 }, () => h('i')));
    const bar = h('i'); bar.style.width = Math.min(100, (cust / goal) * 100) + '%';
    const now = new Date(), ph = skyPhase(now);
    const fresh = vibe && vibe.temp_c != null && Date.now() - new Date(vibe.updated_at) < 8 * 3600e3;
    const stars = h('div', { class: 'stars', 'aria-hidden': 'true' }, Array.from({ length: 28 }, () => { const s = h('i'); s.style.left = Math.random() * 100 + '%'; s.style.top = Math.random() * 60 + '%'; s.style.animationDelay = (Math.random() * 3).toFixed(2) + 's'; return s; }));
    const interior = h('img', { class: 'interior', src: 'media/studio.jpg', alt: '', 'aria-hidden': 'true' });
    kids.push(h('section', { class: 'hero sky-' + ph[0] }, interior, h('div', { class: 'shade', 'aria-hidden': 'true' }), stars, themeRain(vibe && vibe.theme), eq,
      h('p', { class: 'hq' }, h('span', {}, '📍 Virtual HQ · Sea-facing rooftop studio, Bandra, Mumbai'),
        h('span', { class: 'hqtime' }, `${ph[1]} ${tfmt(now)} · ${ph[2]} · ${ph[3]}`),
        h('span', { class: 'hqtime' }, fresh ? `🌡️ ${Number(vibe.temp_c).toFixed(0)}°C · ${vibe.condition || ''}` : '🌤️ Weather arrives with the next team huddle'),
        ME.role === 'owner' ? themePicker((vibe && vibe.theme) || 'studio') : h('span', { class: 'hqtime' }, 'Theme: ' + ((THEMES[(vibe && vibe.theme) || 'studio'] || THEMES.studio)[0]))),
      h('p', { class: 'hello' }, `${greet()}, ${first} 👋 `, studioBtn()),
      h('h1', {}, 'The JHOOMWAVE studio is ', h('span', { class: 'g' }, word)),
      h('p', { class: 'sub' }, h('b', {}, `${busy} of ${agents.length}`), ' teammates in the zone · next team huddle in ', h('b', {}, nextHuddle())),
      h('div', { class: 'goal' },
        h('div', { class: 'gh' }, h('b', {}, '🎯 Road to 10 paying customers'), h('span', {}, `${cust} / ${goal}`)),
        h('div', { class: 'track', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': goal, 'aria-valuenow': cust }, bar),
        h('div', { class: 'miles' }, h('span', {}, 'Start'), h('span', {}, '1st sale 🎉'), h('span', {}, '5 🚀'), h('span', {}, '10 🏆')))));

    for (const c of cel.data || []) {
      const days = Math.round((new Date(c.day + 'T00:00:00') - new Date(today + 'T00:00:00')) / 864e5);
      kids.push(h('div', { class: 'party' }, h('span', { class: 'pe' }, c.emoji || '🎉'), h('div', {}, h('b', {}, days === 0 ? `Today: ${c.name}! ` : `${c.name} in ${days} day${days > 1 ? 's' : ''}`), h('div', { class: 'small' }, c.note || ''))));
    }
    kids.push(h('section', { class: 'goals' }, h('div', { class: 'sech' }, h('h2', {}, "🏁 This week's goals"), h('small', {}, 'Set at the Monday all-hands, tracked every huddle')),
      (wg.data || []).length ? h('div', { class: 'glist' }, wg.data.map((g) => { const pct = g.target ? Math.min(100, (Number(g.progress) / Number(g.target)) * 100) : (g.status === 'done' ? 100 : 0); const bi = h('i'); bi.style.width = pct + '%';
        return h('div', { class: 'gitem ' + g.status }, h('div', { class: 'gt' }, h('b', {}, g.title), h('span', {}, g.target ? `${Number(g.progress)}/${Number(g.target)}` : g.status.replace('_', ' '))), h('div', { class: 'track' }, bi), h('div', { class: 'small mut' }, g.owner ? 'Owner: ' + g.owner : '')); }))
        : h('p', { class: 'mut' }, 'No goals for this week yet. Kabir sets them at the next huddle.')));
    kids.push(h('div', { class: 'clocks' }, DESKS.map(([city, tz, who]) => {
      const hr = Number(now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: tz }));
      return h('div', { class: 'clock' }, h('span', { class: 'ct' }, (hr >= 6 && hr < 18 ? '☀️ ' : '🌙 ') + tfmt(now, tz)), h('span', { class: 'cc' }, city), h('span', { class: 'cw' }, who === 'All' ? 'whole team' : who + "'s desk"));
    })));
    const EMO = { revenue: '💸', customers: '🙌', orders: '🧾', spend: '🪙', credits: '🎙️', live: '🟢' };
    kids.push(h('div', { class: 'chips2' }, (k.data || []).map((x) => h('div', { class: 'kchip', title: x.note || '' }, h('span', { class: 'e' }, EMO[x.id] || '📊'), h('div', {}, h('div', { class: 'v' }, x.value), h('div', { class: 'l' }, x.label))))));

    const istToday = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
    const [cb, aw, td] = await Promise.all([sb.from('coin_board').select('*').order('coins', { ascending: false }).limit(5), sb.from('awards').select('*').order('at', { ascending: false }).limit(4), sb.from('todos').select('*').eq('day', istToday).order('id')]);
    const todos = td.data || [], todoOf = (id) => todos.filter((x) => x.agent_id === id);
    const TICK = { done: '✅', doing: '🔨', todo: '⬜' };
    const nameOf = Object.fromEntries(agents.map((x) => [x.id, x.name]));
    const medal = ['🥇', '🥈', '🥉', '4', '5'];
    kids.push(h('div', { class: 'fame' },
      h('section', { class: 'board' }, h('div', { class: 'sech' }, h('h2', {}, '🪙 JhoomCoins'), h('small', {}, 'points for real results, not money')),
        (cb.data || []).length ? h('ol', { class: 'lb' }, cb.data.map((r, i) => { const av = avatar(r.id, 30); return h('li', {}, h('span', { class: 'md' }, medal[i]), av, h('b', {}, r.name), h('span', { class: 'cn' }, `🪙 ${r.coins}`)); })) : h('p', { class: 'mut' }, 'No coins yet.')),
      h('section', { class: 'board' }, h('div', { class: 'sech' }, h('h2', {}, '🏆 Awards wall'), h('small', {}, 'Employee of the Week every Monday')),
        (aw.data || []).length ? h('div', { class: 'aw' }, aw.data.map((r) => h('div', { class: 'cert' }, h('span', { class: 'ce' }, r.emoji || '🏆'), h('div', {}, h('b', {}, `${r.title} · ${nameOf[r.agent_id] || ''}`), h('div', { class: 'small mut' }, r.citation || ''), h('div', { class: 'small mut' }, ago(r.at)))))) : h('p', { class: 'mut' }, 'First awards land at the Monday all-hands.'))));
    const PANTRY = [['☕', 'Masala chai'], ['🍵', 'Filter coffee'], ['🧋', 'Cold brew'], ['🫖', 'Kahwa'], ['🥤', 'Nimbu soda'], ['🥟', 'Samosa'], ['🍘', 'Indori poha'], ['🍪', 'Choco-chip cookies'], ['🌮', 'Vada pav'], ['🍿', 'Masala popcorn'], ['🍰', 'Red velvet'], ['🍉', 'Fruit bowl'], ['🥨', 'Khakhra'], ['🍫', 'Dark chocolate']];
    const dayN = Math.floor(Date.now() / 864e5), pick = [0, 1, 2, 3, 4].map((i) => PANTRY[(dayN * 3 + i * 5) % PANTRY.length]);
    kids.push(h('section', { class: 'pantry' }, h('div', { class: 'sech' }, h('h2', {}, '🍽️ Pantry today'), h('small', {}, 'fresh every day at the rooftop café')),
      h('div', { class: 'menu' }, pick.map(([e, n]) => h('span', { class: 'dish' }, h('b', {}, e), n))), h('p', { class: 'small mut' }, '🪴 34 plants · 🎶 lo-fi on the speakers · 🌊 sea view from every desk')));
    const online = agents.filter((x) => x.status !== 'planned').length;
    kids.push(h('div', { class: 'sech' }, h('h2', {}, '🎛️ On the floor'), h('small', {}, `${online} online · ${agents.length} on the team · green light = in the zone`)));
    const deskCard = (x) => {
      const av = avatar(x.id); av.append(h('span', { class: 'lt' }));
      return h('article', { class: 'desk2 ' + x.status, id: 'desk-' + x.id },
        h('div', { class: 'who' }, av, h('div', {}, h('div', { class: 'nm' }, x.name, h('span', { class: 'aitag', title: x.id === 'dog' ? 'Studio dog' : (x.id || '').startsWith('creator-') ? 'Virtual creator' : 'AI teammate' }, x.id === 'dog' ? '🐾 Dog' : (x.id || '').startsWith('creator-') ? '✦ Virtual' : '✦ AI')), h('div', { class: 'rl' }, x.role))),
        h('div', { class: 'mood' }, x.status === 'working' ? h('span', { class: 'mini', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i')) : null, MOOD[x.status] || x.status),
        x.now_doing ? h('div', { class: 'bubble' }, x.now_doing) : null,
        h('div', { class: 'dl' }, x.last_done ? h('div', {}, h('span', {}, '✅ Just finished: '), x.last_done) : null, x.next_up ? h('div', {}, h('span', {}, '⏭️ Up next: '), x.next_up) : null, x.goal ? h('div', {}, h('span', {}, '🎯 Goal: '), x.goal) : null),
        h('div', { class: 'when' }, (x.base_city ? '📍 ' + x.base_city + ' · ' : '') + 'updated ' + ago(x.updated_at)),
        x.vibe ? h('div', { class: 'offduty' }, '🎈 Off duty: ' + x.vibe) : null,
        todoOf(x.id).length ? h('details', { class: 'tdc' }, h('summary', {}, `📋 Today ${todoOf(x.id).filter((t) => t.status === 'done').length}/${todoOf(x.id).length} done`), h('ul', {}, todoOf(x.id).map((t) => h('li', { class: t.status }, TICK[t.status] + ' ' + t.title)))) : null,
        x.desk ? h('div', { class: 'desktop', title: 'On the desk' }, h('span', { class: 'chair', 'aria-hidden': 'true' }, '🪑'), h('span', {}, x.desk)) : null,
        x.bio ? h('details', { class: 'persona' }, h('summary', {}, 'About ' + x.name), h('p', {}, x.bio)) : null);
    };
    for (const t of [...TEAMS, null]) {
      const group = agents.filter((x) => (t ? x.team === t : !TEAMS.includes(x.team)));
      if (!group.length) continue;
      kids.push(h('h3', { class: 'teamh' }, t || 'Team'), h('div', { class: 'floor' }, group.map(deskCard)));
    }

    if (todos.length) {
      const doneN = todos.filter((t) => t.status === 'done').length, doingN = todos.filter((t) => t.status === 'doing').length;
      kids.push(h('div', { class: 'sech' }, h('h2', {}, "📋 Today's to-dos"), h('small', {}, `${doneN} done · ${doingN} in progress · ${todos.length - doneN - doingN} up next`)));
      kids.push(h('div', { class: 'todoboard' }, agents.filter((x) => todoOf(x.id).length).map((x) => h('div', { class: 'tdcard' },
        h('div', { class: 'tdh' }, avatar(x.id, 28), h('b', {}, x.name), h('small', { class: 'mut' }, `${todoOf(x.id).filter((t) => t.status === 'done').length}/${todoOf(x.id).length}`)),
        h('ul', {}, todoOf(x.id).map((t) => h('li', { class: t.status }, h('span', {}, TICK[t.status]), t.title)))))));
    }
    const radio = h('ul', { class: 'radio' }, (act.data || []).length ? act.data.map((x) => {
      const id = byName[x.who]; const d = DESK[id] || ['📣', '#7B2FF7', '#FF2E88'];
      const dot = h('span', { class: 'dot2' }, d[0]); dot.style.background = `linear-gradient(135deg,${d[1]}55,${d[2]}55)`;
      return h('li', {}, dot, h('div', { class: 'ln' }, h('b', {}, x.who), ' ', x.what, h('small', {}, ago(x.at))));
    }) : h('li', {}, h('span'), h('div', { class: 'ln mut' }, 'Quiet for now. The next huddle fills this up.')));
    const left = h('section', {}, h('div', { class: 'sech' }, h('h2', {}, '📻 Office radio'), h('span', { class: 'onair' }, 'LIVE')), radio);
    const right = h('section', {});
    if (ME.role === 'owner') {
      const open = (fa.data || []).filter((x) => x.status !== 'done').length;
      right.append(h('div', { class: 'sech' }, h('h2', {}, `🎯 For you, ${first}`), h('small', {}, open ? `${open} waiting` : 'all clear ✨')));
      right.append(h('div', { class: 'desk' }, (fa.data || []).map((x) => h('div', { class: 'task' + (x.status === 'done' ? ' done' : '') },
        h('span', { class: 'u u' + x.urgency, title: ['', 'Urgent', 'This week', 'Later'][x.urgency] }),
        h('div', {}, h('b', {}, x.title), h('div', { class: 'mut small' }, x.how || ''),
          h('div', { class: 'mut small' }, [x.cost && 'Cost: ' + x.cost, x.unblocks && 'Unblocks: ' + x.unblocks, x.owner && 'With: ' + x.owner].filter(Boolean).join(' · '))),
        h('button', { class: 'btn2', type: 'button', onclick: async (ev) => {
          const done = x.status !== 'done'; const r = ev.currentTarget.getBoundingClientRect();
          if (await save('founder_actions', x.id, done ? { status: 'done', done_at: new Date().toISOString().slice(0, 10) } : { status: 'todo', done_at: null })) {
            if (done) { confetti(r.left + r.width / 2, r.top); toast('Done! The team can move 🎉'); } rerender(); } } }, x.status === 'done' ? 'Undo' : 'Mark done')))));
    } else {
      right.append(h('div', { class: 'sech' }, h('h2', {}, '👋 Welcome to the studio')), h('p', { class: 'mut' }, 'Pick your section from the menu above. Everything you change is saved for the whole team.'));
    }
    kids.push(h('div', { class: 'split' }, left, right));
    page.replaceChildren(...kids);
  }

  // ---------------------------------------------------------------- Team chat (Slack-style: channels, DMs, reactions, replies, live)
  let liveSub = null;
  function stopLive() { if (liveSub) { try { sb.removeChannel(liveSub); } catch (e) {} liveSub = null; } }
  function richText(t) { // @mentions highlighted; everything else plain text
    return String(t).split(/(@[A-Za-z][\w]*)/g).map((part) => (/^@[A-Za-z]/.test(part) ? h('span', { class: 'mention' }, part) : part));
  }
  const QUICK = ['👍', '🔥', '😂', '❤️', '🎉'];
  let replyTo = null;
  async function pageChat(page) {
    const room = sessionStorage.getItem('jw_ch') || 'team';
    const [ch, ag, m] = await Promise.all([sb.from('channels').select('*').order('sort'), sb.from('agents').select('id,name,avatar,status,role').order('sort'),
      sb.from('messages').select('*').eq('room', room).order('at', { ascending: false }).limit(120)]);
    if (m.error) throw m.error;
    (ag.data || []).forEach((x) => { if (x.avatar) AV[x.id] = x.avatar; });
    const byName = Object.fromEntries((ag.data || []).map((x) => [x.name, x])), msgs = (m.data || []).slice().reverse();
    const rx = msgs.length ? (await sb.from('reactions').select('*').in('message_id', msgs.map((x) => x.id))).data || [] : [];
    const byId = Object.fromEntries(msgs.map((x) => [x.id, x]));
    const go = (r) => { sessionStorage.setItem('jw_ch', r); replyTo = null; rerender(); };
    // sidebar
    const side = h('aside', { class: 'sside' },
      h('div', { class: 'sgroup' }, 'Channels'), (ch.data || []).map((c) => h('button', { type: 'button', class: 'sitem' + (room === c.id ? ' on' : ''), onclick: () => go(c.id) }, h('span', { class: 'hash' }, '#'), c.name)),
      h('div', { class: 'sgroup' }, 'Direct messages'), (ag.data || []).filter((x) => x.id !== 'dog').map((x) => h('button', { type: 'button', class: 'sitem dm' + (room === 'dm-' + x.id ? ' on' : ''), onclick: () => go('dm-' + x.id) },
        h('span', { class: 'pres ' + (x.status === 'planned' ? 'off' : x.status === 'working' ? 'on' : 'away') }), avatar(x.id, 22), x.name)));
    const chan = (ch.data || []).find((c) => c.id === room), dm = room.startsWith('dm-') ? (ag.data || []).find((x) => 'dm-' + x.id === room) : null;
    const head = h('header', { class: 'shead' }, h('b', {}, dm ? dm.name : '# ' + (chan ? chan.name : room)), h('small', { class: 'mut' }, dm ? dm.role + ' · AI teammate, replies at the next huddle' : (chan && chan.topic) || ''));
    // messages, grouped by day and by author
    const list = h('div', { class: 'sfeed', role: 'log', 'aria-live': 'polite' });
    let lastDay = '', prev = null;
    for (const x of msgs) {
      const day = new Date(x.at).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
      if (day !== lastDay) { list.append(h('div', { class: 'sday' }, h('span', {}, day))); lastDay = day; prev = null; }
      const compact = prev && prev.author === x.author && new Date(x.at) - new Date(prev.at) < 5 * 60000 && !x.reply_to;
      const who = byName[x.author], isStaff = x.author_kind === 'staff';
      const av = compact ? h('span', { class: 'stime' }, new Date(x.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }))
        : isStaff ? h('div', { class: 'ava me2' }, (x.author || '?').slice(0, 1).toUpperCase()) : avatar(who ? who.id : '', 36);
      const mine = rx.filter((r) => r.message_id === x.id), groups = {};
      mine.forEach((r) => { (groups[r.emoji] = groups[r.emoji] || []).push(r.who); });
      const parent = x.reply_to ? byId[x.reply_to] : null;
      const actions = h('div', { class: 'sacts' }, QUICK.map((e) => h('button', { type: 'button', title: 'React ' + e, onclick: () => react(x.id, e) }, e)), h('button', { type: 'button', title: 'Reply', onclick: () => { replyTo = x; showReply(); ta.focus(); } }, '↩️'));
      list.append(h('div', { class: 'smsg' + (compact ? ' compact' : '') }, av, h('div', { class: 'sbody' },
        compact ? null : h('div', { class: 'smeta' }, h('b', {}, x.author), isStaff ? h('span', { class: 'aitag founder' }, ME && x.user_id === ME.user_id ? 'you' : 'team') : h('span', { class: 'aitag' }, x.author === 'Bruno' ? '🐾 Dog' : '✦ AI'), h('small', {}, ago(x.at))),
        parent ? h('div', { class: 'squote' }, h('b', {}, parent.author + ': '), String(parent.text).slice(0, 120)) : null,
        h('div', { class: 'stext' }, richText(x.text)),
        Object.keys(groups).length ? h('div', { class: 'srx' }, Object.entries(groups).map(([e, w]) => h('button', { type: 'button', class: 'rx', title: w.join(', '), onclick: () => react(x.id, e) }, e + ' ' + w.length))) : null), actions));
      prev = x;
    }
    if (!msgs.length) list.append(h('p', { class: 'mut', style: 'padding:16px' }, dm ? `Say hi to ${dm.name} 👋` : 'No messages yet.'));
    // composer
    const ta = h('textarea', { id: 'chat-in', maxlength: 2000, rows: 1, placeholder: dm ? `Message ${dm.name}` : `Message #${chan ? chan.name : room} — tag with @name` });
    const rbar = h('div', { class: 'sreply', hidden: true });
    function showReply() { rbar.replaceChildren(); if (!replyTo) { rbar.hidden = true; return; } rbar.hidden = false;
      rbar.append(h('span', {}, '↩️ Replying to ', h('b', {}, replyTo.author), ': ' + String(replyTo.text).slice(0, 80)), h('button', { type: 'button', class: 'lnk', onclick: () => { replyTo = null; showReply(); } }, 'Cancel')); }
    const send = async () => { const t = ta.value.trim(); if (!t) return;
      const { error } = await sb.from('messages').insert({ room, author: ME.name || ME.email, author_kind: 'staff', user_id: ME.user_id, text: t, reply_to: replyTo ? replyTo.id : null });
      if (error) return fail(error); ta.value = ''; replyTo = null; rerender(); };
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    const f = h('form', { class: 'scompose' }, rbar, h('div', { class: 'srow' }, ta, h('button', { class: 'btn', type: 'submit' }, 'Send')));
    f.addEventListener('submit', (e) => { e.preventDefault(); send(); });
    async function react(id, emoji) {
      const who = ME.name || ME.email; const ex = rx.find((r) => r.message_id === id && r.emoji === emoji && r.user_id === ME.user_id);
      const { error } = ex ? await sb.from('reactions').delete().eq('id', ex.id) : await sb.from('reactions').insert({ message_id: id, emoji, who, user_id: ME.user_id });
      if (error) return fail(error); rerender();
    }
    page.replaceChildren(h('div', { class: 'slack' }, side, h('section', { class: 'smain' }, head, list, f)));
    showReply(); list.scrollTop = list.scrollHeight;
    // live: new messages or reactions appear without refresh
    stopLive();
    try {
      let t = 0; const bump = () => { clearTimeout(t); t = setTimeout(() => { if (location.hash.slice(1) === 'chat' || !location.hash) rerender(); }, 400); };
      liveSub = sb.channel('office-chat').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'room=eq.' + room }, bump)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, bump).subscribe();
    } catch (e) { console.warn('live chat off', e); }
  }

  // ---------------------------------------------------------------- Live studio cam (a virtual view built from live data; not real CCTV)
  const SPOTS = [[12, 63, 'desk'], [24, 55, 'desk'], [33, 50, 'desk'], [40, 46, 'desk'], [28, 42, 'window'], [47, 57, 'beanbag'], [55, 49, 'sofa'], [62, 49, 'sofa'],
    [53, 62, 'beanbag'], [74, 56, 'dj'], [81, 53, 'dj'], [86, 72, 'pantry'], [93, 66, 'pantry'], [58, 76, 'rug'], [67, 66, 'lounge'], [44, 70, 'rug']];
  const CAMS = [['CAM 01 · STUDIO FLOOR', 1, '50% 50%'], ['CAM 02 · SEA LOUNGE', 1.9, '56% 52%'], ['CAM 03 · DJ CORNER', 2.1, '80% 56%'], ['CAM 04 · PANTRY', 2.2, '88% 68%']];
  let liveTimers = [], soundOn = false, helloAudio = null;
  async function pageLive(page) {
    liveTimers.forEach(clearInterval); liveTimers = [];
    const [ag, msgs] = await Promise.all([sb.from('agents').select('*').order('sort'), sb.from('messages').select('author,text,at,room').like('room', '%').order('at', { ascending: false }).limit(30)]);
    (ag.data || []).forEach((x) => { if (x.avatar) AV[x.id] = x.avatar; });
    const on = (ag.data || []).filter((x) => x.status !== 'planned' || x.id === 'dog');
    let cam = Number(sessionStorage.getItem('jw_cam') || 0);
    const stage = h('div', { class: 'camstage' }), world = h('div', { class: 'camworld' }, h('img', { class: 'camimg', src: 'media/studio.jpg', alt: 'Virtual JHOOMWAVE studio' }));
    const pins = {};
    on.slice(0, SPOTS.length).forEach((x, i) => {
      const [l, t] = SPOTS[i];
      const pin = h('div', { class: 'pin ' + x.status, style: `left:${l}%;top:${t}%`, tabindex: '0', role: 'button', 'aria-label': 'Say hi to ' + x.name }, h('div', { class: 'bub' }), avatar(x.id, 40), h('span', { class: 'pn' }, x.name));
      pin.querySelector('.bub').textContent = x.now_doing || '';
      const hello = () => {
        Object.values(pins).forEach((q) => q.classList.remove('talk'));
        const first = (ME.name || '').split(' ')[0] || 'boss';
        pin.querySelector('.bub').textContent = x.id === 'dog' ? 'Woof woof! 🐾 *wags tail*' : `Hey ${first}! 👋 ${x.now_doing ? 'Abhi: ' + x.now_doing : 'Sab badhiya!'}`;
        pin.classList.add('talk', 'wave');
        setTimeout(() => pin.classList.remove('wave'), 1200);
        if (soundOn && x.voice && x.voice !== 'dog') { try { if (helloAudio) helloAudio.pause(); helloAudio = new Audio('media/hello_' + x.voice + '.mp3'); helloAudio.volume = 0.8; helloAudio.play().catch(() => {}); } catch (e) {} }
      };
      pin.addEventListener('mouseenter', hello); pin.addEventListener('click', hello); pin.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hello(); } });
      pins[x.name] = pin; world.append(pin);
    });
    const setCam = () => { const [, z, o] = CAMS[cam]; world.style.transformOrigin = o; world.style.setProperty('--z', z); world.style.transform = `scale(${z})`; label.textContent = CAMS[cam][0]; sessionStorage.setItem('jw_cam', cam); };
    const label = h('span', {}), clock = h('span', { class: 'camclock' });
    const tick = () => { clock.textContent = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' IST'; };
    const ticker = h('div', { class: 'camticker' });
    const feed = (msgs.data || []).slice(0, 12);
    const camBtns = h('div', { class: 'cambtns' }, CAMS.map((c, i) => h('button', { type: 'button', onclick: () => { cam = i; setCam(); } }, 'CAM ' + (i + 1))),
      h('button', { type: 'button', onclick: () => { (stage.requestFullscreen ? stage.requestFullscreen() : Promise.reject()).catch(() => toast('Full screen is not available here')); } }, '⛶ Full screen'),
      h('button', { type: 'button', 'aria-pressed': String(soundOn), onclick: (e) => { soundOn = !soundOn; e.currentTarget.textContent = soundOn ? '🔊 Sound on' : '🔈 Sound off'; e.currentTarget.setAttribute('aria-pressed', String(soundOn)); } }, soundOn ? '🔊 Sound on' : '🔈 Sound off'));
    stage.append(world, h('div', { class: 'scan', 'aria-hidden': 'true' }), h('div', { class: 'vig', 'aria-hidden': 'true' }),
      h('div', { class: 'hud tl' }, h('span', { class: 'rec' }, '● REC'), label), h('div', { class: 'hud tr' }, clock), h('div', { class: 'hud bl' }, camBtns),
      h('div', { class: 'hud br' }, h('span', { class: 'mut small' }, 'Virtual studio cam · built live from the team’s real status and chat')), ticker);
    page.replaceChildren(h('div', { class: 'sech' }, h('h1', {}, '📹 Live studio cam'), h('small', {}, `${on.length} at their spots · hover or tap anyone to say hi`)), stage);
    setCam(); tick();
    // speech bubbles cycle between "now doing" and the latest chat lines
    let k = 0;
    liveTimers.push(setInterval(tick, 1000));
    liveTimers.push(setInterval(() => {
      const names = Object.keys(pins); if (!names.length) return;
      const m = feed[k % Math.max(1, feed.length)]; k++;
      Object.values(pins).forEach((p) => p.classList.remove('talk'));
      const pin = m && pins[m.author] ? pins[m.author] : pins[names[k % names.length]];
      if (m && pins[m.author]) { pin.querySelector('.bub').textContent = (m.room !== 'team' && !m.room.startsWith('dm-') ? '#' + m.room + ' · ' : '') + m.text.slice(0, 90); }
      pin.classList.add('talk');
      if (m) { ticker.textContent = `💬 ${m.author}: ${m.text.slice(0, 110)}`; }
    }, 3500));
    if (matchMedia('(prefers-reduced-motion: no-preference)').matches) world.classList.add('pan');
    stopLive();
    try { liveSub = sb.channel('office-live').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (pl) => { const m = pl.new; if (m && m.text) { feed.unshift(m); k = 0; } }).subscribe(); } catch (e) {}
  }

  // ---------------------------------------------------------------- Meetings + goals
  async function pageMeetings(page) {
    const [mt, cal] = await Promise.all([sb.from('meetings').select('*').order('at', { ascending: false }).limit(30), sb.from('celebrations').select('*').gte('day', new Date().toISOString().slice(0, 10)).order('day').limit(8)]);
    if (mt.error) throw mt.error;
    const KIND = { huddle: '⚡ Huddle', weekly: '📣 Monday all-hands', celebration: '🎉 Celebration', review: '🔍 Review', party: '🪩 Office party', trip: '✈️ Team trip', meal: '🍽️ Team meal' };
    const agendaIn = h('input', { id: 'agenda-in', maxlength: 300, placeholder: 'Add a topic for the next meeting' });
    const af = h('form', { class: 'composer one' }, agendaIn, h('button', { class: 'btn', type: 'submit' }, 'Add to agenda'));
    af.addEventListener('submit', async (e) => { e.preventDefault(); const t = agendaIn.value.trim(); if (!t) return;
      const { error } = await sb.from('messages').insert({ room: 'agenda', author: ME.name || ME.email, author_kind: 'staff', user_id: ME.user_id, text: t });
      if (error) return fail(error); agendaIn.value = ''; toast('Added to the agenda'); });
    page.replaceChildren(h('div', { class: 'sech' }, h('h1', {}, '📅 Meetings'), h('small', {}, 'Huddle every 4 hours · all-hands every Monday · notes saved here')), af,
      (mt.data || []).length ? h('div', { class: 'meets' }, mt.data.map((x) => h('details', { class: 'meet', open: x === mt.data[0] }, h('summary', {}, h('span', { class: 'chip' }, KIND[x.kind] || x.kind), ' ', h('b', {}, x.title), h('small', { class: 'mut' }, ' · ' + fmtDate(x.at))), x.agenda ? h('p', { class: 'mut small' }, 'Agenda: ' + x.agenda) : null, h('div', { class: 'notes' }, x.notes || 'No notes.'))))
        : h('p', { class: 'mut' }, 'The first huddle notes appear here after the next run.'),
      h('h2', {}, '🎉 Coming up'), h('div', { class: 'chips2' }, (cal.data || []).map((c) => h('div', { class: 'kchip' }, h('span', { class: 'e' }, c.emoji || '🎉'), h('div', {}, h('div', { class: 'v' }, c.name), h('div', { class: 'l' }, new Date(c.day + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })))))));
  }

  // ---------------------------------------------------------------- Tech board
  async function pageTech(page) {
    const { data, error } = await sb.from('backlog').select('*').order('status').order('priority').order('created_at', { ascending: false }).limit(200); if (error) throw error;
    const cols = [['todo', '📝 To do'], ['doing', '🔨 Doing'], ['review', '👀 Review'], ['done', '✅ Done']];
    page.replaceChildren(h('div', { class: 'sech' }, h('h1', {}, '🛠️ Tech board'), h('small', {}, 'Riya, Ishaan, Tara, Rohan and Kiara: bugs, designs and builds')),
      h('div', { class: 'kanban' }, cols.map(([k, label]) => h('section', { class: 'kcol' }, h('h3', {}, label + ' ', h('small', { class: 'mut' }, String((data || []).filter((x) => x.status === k).length))),
        (data || []).filter((x) => x.status === k).map((x) => h('article', { class: 'kcard p' + x.priority }, h('div', { class: 'small mut' }, `${x.kind} · ${x.area || 'general'} · P${x.priority}`), h('b', {}, x.title), x.detail ? h('details', {}, h('summary', { class: 'small' }, 'Details'), h('p', { class: 'small' }, x.detail)) : null, h('div', { class: 'small mut' }, (x.owner ? x.owner + ' · ' : '') + ago(x.updated_at))))))));
  }

  // ---------------------------------------------------------------- Leads
  const LEAD_ST = ['new', 'contacted', 'demo', 'proposal', 'won', 'lost'];
  async function pageLeads(page) {
    const filter = sessionStorage.getItem('jw_lead_f') || 'open';
    let q = sb.from('leads').select('*').order('created_at', { ascending: false }).limit(300);
    if (filter === 'open') q = q.not('status', 'in', '(won,lost)'); else if (filter !== 'all') q = q.eq('status', filter);
    const { data, error } = await q; if (error) throw error;
    const f = statusSelect(filter, ['open', 'all', ...LEAD_ST], (v) => { sessionStorage.setItem('jw_lead_f', v); rerender(); });
    page.replaceChildren(
      h('div', { class: 'bar' }, h('h1', { class: 'grow' }, 'Leads'), h('label', { for: 'lf' }, 'Show'), Object.assign(f, { id: 'lf' })),
      h('p', { class: 'mut' }, 'Contact only people who agreed or who wrote to us first. The AI drafts; a person sends.'),
      addForm('➕ Add a lead', [
        { k: 'name', label: 'Name *', req: true, max: 120 }, { k: 'business', label: 'Business' }, { k: 'phone', label: 'Phone', max: 40 },
        { k: 'email', label: 'Email' }, { k: 'city', label: 'City', max: 80 },
        { k: 'segment', label: 'Type', options: ['planner', 'dj', 'bakery', 'venue', 'corporate', 'school', 'couple', 'family', 'creator', 'other'] },
        { k: 'source', label: 'Came from', options: ['manual', 'instagram', 'whatsapp', 'referral', 'event', 'website'] },
        { k: 'need', label: 'What they need', area: true },
      ], async (v) => { const { error: e } = await sb.from('leads').insert(v); if (e) { fail(e); return false; } toast('Lead added'); return true; }),
      table([
        { t: 'Lead', v: (r) => [h('b', {}, r.name), r.business ? h('div', { class: 'sub' }, r.business) : null, h('div', { class: 'sub' }, `${r.segment} · ${r.source}${r.city ? ' · ' + r.city : ''}`)] },
        { t: 'Contact', v: (r) => [r.phone ? h('div', {}, r.phone) : null, r.email ? h('div', {}, r.email) : null, h('div', { class: 'sub' }, r.consent ? 'OK to contact' : 'No consent yet')] },
        { t: 'Need', v: (r) => [r.need || '', r.ai_summary ? h('div', { class: 'sub' }, 'AI: ' + r.ai_summary) : null] },
        { t: 'Status', v: (r) => statusSelect(r.status, LEAD_ST, (s) => save('leads', r.id, { status: s })) },
        { t: 'Follow up', v: (r) => { const d = h('input', { type: 'date', value: r.next_follow_up || '', 'aria-label': 'Next follow-up' }); d.addEventListener('change', () => save('leads', r.id, { next_follow_up: d.value || null })); return d; } },
      ], data, 'No leads here yet.'));
  }

  // ---------------------------------------------------------------- Enquiries
  async function pageEnquiries(page) {
    const { data, error } = await sb.from('enquiries').select('*').order('created_at', { ascending: false }).limit(200); if (error) throw error;
    page.replaceChildren(h('h1', {}, 'Enquiries'), h('p', { class: 'mut' }, 'Questions from the website, Instagram and WhatsApp. Open ones first need an answer.'),
      table([
        { t: 'When', v: (r) => [fmtDate(r.created_at), h('div', { class: 'sub' }, `${r.channel} · ${r.kind.replace('_', ' ')}`)] },
        { t: 'From', v: (r) => [r.name || '—', h('div', { class: 'sub' }, r.contact || '')] },
        { t: 'Message', v: (r) => [r.message, r.reply_draft ? h('details', {}, h('summary', { class: 'sub' }, 'AI reply draft'), h('p', {}, r.reply_draft)) : null] },
        { t: 'Status', v: (r) => statusSelect(r.status, ['open', 'answered', 'closed', 'spam'], (s) => save('enquiries', r.id, { status: s })) },
      ], data.sort((a, b) => (a.status !== 'open') - (b.status !== 'open')), 'No enquiries yet.'));
  }

  // ---------------------------------------------------------------- Orders
  async function pageOrders(page) {
    const { data, error } = await sb.from('orders').select('*').order('created_at', { ascending: false }).limit(200); if (error) throw error;
    async function songLink(r) {
      const days = C.songLinkDays || 7;
      const { data: d, error: e } = await sb.storage.from('songs').createSignedUrl(r.song_path, days * 86400, { download: true });
      if (e) return fail(e);
      try { await navigator.clipboard.writeText(d.signedUrl); toast(`Link copied. It works for ${days} days.`); } catch (x) { prompt('Copy this link', d.signedUrl); }
    }
    page.replaceChildren(h('h1', {}, 'Orders'), h('p', { class: 'mut' }, 'Every paid song. Before delivery, listen once: is the name said right?'),
      table([
        { t: 'When', v: (r) => fmtDate(r.created_at) },
        { t: 'Customer', v: (r) => [r.customer_name, h('div', { class: 'sub' }, r.contact || '')] },
        { t: 'Song', v: (r) => [r.product, h('div', { class: 'sub' }, Object.entries(r.details || {}).map(([k, v]) => `${k}: ${v}`).join(' · '))] },
        { t: 'Price', v: (r) => [inr(r.price_inr), r.payment_ref ? h('div', { class: 'sub' }, r.payment_ref) : null] },
        { t: 'Status', v: (r) => statusSelect(r.status, ['new', 'paid', 'making', 'quality_check', 'delivered', 'refunded', 'cancelled'], (s) => save('orders', r.id, { status: s })) },
        { t: 'File', v: (r) => (r.song_path ? h('button', { class: 'btn2', type: 'button', onclick: () => songLink(r) }, 'Copy customer link') : h('span', { class: 'sub' }, 'Not ready')) },
      ], data, 'No orders yet. They appear here once checkout is live.'));
  }

  // ---------------------------------------------------------------- Social
  async function pageSocial(page) {
    const [p, s] = await Promise.all([sb.from('social_posts').select('*').order('planned_for', { ascending: true, nullsFirst: false }).limit(200), sb.rpc('lead_stats')]);
    if (p.error) throw p.error;
    const bySource = {}; for (const r of s.data || []) bySource[r.source] = (bySource[r.source] || 0) + Number(r.n);
    page.replaceChildren(h('h1', {}, 'Social media'),
      h('h2', {}, 'Leads by where they came from'),
      h('div', { class: 'tiles' }, Object.keys(bySource).length ? Object.entries(bySource).map(([k, v]) => h('div', { class: 'tile' }, h('span', { class: 'l' }, k), h('span', { class: 'v' }, v))) : h('p', { class: 'mut' }, 'No leads yet.')),
      h('h2', {}, 'Content plan'),
      addForm('➕ Plan a post', [
        { k: 'title', label: 'Post *', req: true }, { k: 'platform', label: 'Where', options: ['instagram', 'facebook', 'youtube', 'whatsapp', 'other'] },
        { k: 'planned_for', label: 'Date', type: 'date' }, { k: 'caption', label: 'Caption', area: true, max: 4000 },
      ], async (v) => { const { error: e } = await sb.from('social_posts').insert(v); if (e) { fail(e); return false; } toast('Post planned'); return true; }),
      table([
        { t: 'Date', v: (r) => r.planned_for || '—' },
        { t: 'Post', v: (r) => [h('b', {}, r.title), h('div', { class: 'sub' }, r.platform), r.caption ? h('details', {}, h('summary', { class: 'sub' }, 'Caption'), h('p', {}, r.caption)) : null] },
        { t: 'Status', v: (r) => statusSelect(r.status, ['idea', 'draft', 'approved', 'posted', 'dropped'], (st) => save('social_posts', r.id, { status: st })) },
        { t: 'Results', v: (r) => Object.entries(r.results || {}).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—' },
      ], p.data, 'No posts planned yet.'));
  }

  // ---------------------------------------------------------------- Team (owner)
  async function pageTeam(page) {
    const [m, i] = await Promise.all([sb.from('members').select('*').order('created_at'), sb.from('invites').select('*').order('created_at', { ascending: false })]);
    if (m.error) throw m.error;
    page.replaceChildren(h('h1', {}, 'Team access'),
      h('p', { class: 'mut' }, 'Each person sees only their part. Everyone needs the email code and an authenticator app to get in.'),
      table([
        { t: 'Person', v: (r) => [h('b', {}, r.name || r.email), h('div', { class: 'sub' }, r.email)] },
        { t: 'Role', v: (r) => (r.user_id === ME.user_id ? h('span', { class: 'chip' }, r.role + ' (you)') : statusSelect(r.role, ['owner', 'marketing', 'sales', 'support', 'viewer'], (x) => save('members', r.user_id, { role: x }, 'user_id'))) },
        { t: 'Access', v: (r) => (r.user_id === ME.user_id ? 'On' : statusSelect(r.active ? 'on' : 'off', ['on', 'off'], (x) => save('members', r.user_id, { active: x === 'on' }, 'user_id'))) },
      ], m.data, 'No members.'),
      h('h2', {}, 'Invite someone'),
      h('p', { class: 'mut small' }, 'Add their email and role here. Their login is then created by the AI (or in Supabase → Authentication → Invite user). They get exactly this role.'),
      addForm('➕ New invite', [
        { k: 'email', label: 'Email *', req: true, type: 'email' }, { k: 'name', label: 'Name', max: 120 },
        { k: 'role', label: 'Role', options: ['marketing', 'sales', 'support', 'viewer'] },
      ], async (v) => { v.email = v.email.toLowerCase(); const { error: e } = await sb.from('invites').insert(v); if (e) { fail(e); return false; } toast('Invite saved'); return true; }),
      table([
        { t: 'Email', v: (r) => r.email }, { t: 'Role', v: (r) => r.role },
        { t: 'Status', v: (r) => (r.used_at ? 'Joined ' + fmtDate(r.used_at) : 'Waiting for login') },
        { t: '', v: (r) => (r.used_at ? '' : h('button', { class: 'btn2', type: 'button', onclick: async () => { const { error: e } = await sb.from('invites').delete().eq('email', r.email); if (e) fail(e); else rerender(); } }, 'Cancel')) },
      ], i.data || [], 'No pending invites.'));
  }

  // ---------------------------------------------------------------- Audit (owner)
  async function pageAudit(page) {
    const { data, error } = await sb.from('audit_log').select('*').order('at', { ascending: false }).limit(150); if (error) throw error;
    page.replaceChildren(h('h1', {}, 'Audit log'), h('p', { class: 'mut' }, 'Every change, by whom (staff, the AI, or the website form). Newest first.'),
      table([{ t: 'When', v: (r) => fmtDate(r.at) }, { t: 'Who', v: (r) => r.actor }, { t: 'What', v: (r) => `${r.action} ${r.table_name}` }, { t: 'Row', v: (r) => h('code', {}, (r.row_id || '').slice(0, 12)) }], data, 'Nothing yet.'));
  }

  // ---------------------------------------------------------------- start
  (async () => {
    const { data: { session } } = await sb.auth.getSession();
    // arriving from the email sign-in link: drop the one-time tokens from the address bar
    if (/access_token|error_description/.test(location.hash)) history.replaceState(null, '', location.pathname + '#office');
    if (session) afterLogin(); else show('v-login');
  })();
})();
