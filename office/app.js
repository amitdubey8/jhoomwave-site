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
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storage: window.sessionStorage },
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
    await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } }); // same answer either way: don't reveal who is on the team
    $('b-send').disabled = false;
    $('f-email').hidden = true; $('f-code').hidden = false; $('in-code').focus();
    $('login-msg').textContent = 'If this email is on the team, a code is on its way. Check spam too.';
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
    for (const [k, r] of Object.entries(ROUTES)) if (allowed(k)) nav.append(h('a', { href: '#' + k, 'data-r': k }, r.label));
  }
  addEventListener('hashchange', route);
  async function route() {
    if (!ME) return;
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

  // ---------------------------------------------------------------- Office
  async function pageOffice(page) {
    const [k, a, act, fa] = await Promise.all([
      sb.from('kpis').select('*').order('sort'),
      sb.from('agents').select('*').order('sort'),
      sb.from('activity').select('*').order('at', { ascending: false }).limit(30),
      ME.role === 'owner' ? sb.from('founder_actions').select('*').order('status', { ascending: false }).order('urgency').order('sort') : Promise.resolve({ data: [] }),
    ]);
    const kids = [h('h1', {}, 'Office'), h('p', { class: 'mut' }, 'Who is doing what right now. Numbers come only from real records.')];
    kids.push(h('div', { class: 'tiles' }, (k.data || []).map((x) => h('div', { class: 'tile' }, h('span', { class: 'l' }, x.label), h('span', { class: 'v' }, x.value), h('span', { class: 'n' }, x.note || '')))));
    kids.push(h('h2', {}, 'AI team'));
    const word = { working: 'Working', waiting: 'Waiting', blocked: 'Blocked', planned: 'Not started' };
    kids.push(h('div', { class: 'cards' }, (a.data || []).map((x) => h('article', { class: 'card' },
      h('div', { class: 'hd' }, h('span', { class: 'av' }, x.name.replace(/^AI\s*/, '').slice(0, 3).toUpperCase()), h('div', {}, h('b', {}, x.name), h('div', { class: 'mut small' }, x.role)),
        h('span', { class: 'chip ' + x.status }, x.status === 'working' ? h('span', { class: 'dot' }) : null, word[x.status] || x.status)),
      [['Now', x.now_doing], ['Last done', x.last_done], ['Next', x.next_up], ['Goal', x.goal]].filter((p) => p[1]).map((p) => h('div', { class: 'kv' }, h('span', {}, p[0]), h('span', {}, p[1]))),
      h('div', { class: 'mut small' }, 'Updated ' + fmtDate(x.updated_at))))));
    if (ME.role === 'owner') {
      kids.push(h('h2', {}, 'Your desk'));
      kids.push(h('div', { class: 'desk' }, (fa.data || []).map((x) => h('div', { class: 'task' + (x.status === 'done' ? ' done' : '') },
        h('span', { class: 'u u' + x.urgency, title: ['', 'Urgent', 'This week', 'Later'][x.urgency] }),
        h('div', {}, h('b', {}, x.title), h('div', { class: 'mut small' }, x.how || ''),
          h('div', { class: 'mut small' }, [x.cost && 'Cost: ' + x.cost, x.unblocks && 'Unblocks: ' + x.unblocks, x.owner && 'Owner: ' + x.owner].filter(Boolean).join(' · '))),
        h('button', { class: 'btn2', type: 'button', onclick: async () => { if (await save('founder_actions', x.id, x.status === 'done' ? { status: 'todo', done_at: null } : { status: 'done', done_at: new Date().toISOString().slice(0, 10) })) rerender(); } }, x.status === 'done' ? 'Undo' : 'Mark done')))));
    }
    kids.push(h('h2', {}, 'Activity'));
    kids.push((act.data || []).length ? h('ul', { class: 'feed' }, act.data.map((x) => h('li', {}, h('span', {}, fmtDate(x.at)), h('span', {}, x.who), h('div', {}, x.what)))) : h('p', { class: 'mut' }, 'No activity yet.'));
    page.replaceChildren(...kids);
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
    if (session) afterLogin(); else show('v-login');
  })();
})();
