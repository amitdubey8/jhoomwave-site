/* My JHOOMWAVE: customer accounts. Supabase Auth (email link/code, Google when switched on).
   Customers only reach their own rows (row-level security); staff Office access is separate (invite + 2FA). */
(function () {
  const URL = 'https://srcclctqfkagpolhocqf.supabase.co';
  const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyY2NsY3RxZmthZ3BvbGhvY3FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU1NDY1OTYsImV4cCI6MjExMTEyMjU5Nn0.0_T3iBE2ssrABWWbL8hkLqOOvpany5uP2LSFlhi0G54';
  const GOOGLE_ON = false; // switch on after the founder enables Google sign-in in Supabase
  const sb = window.supabase.createClient(URL, KEY, { auth: { storageKey: 'jw-customer-auth', persistSession: true, detectSessionInUrl: true, flowType: 'implicit' } });
  const $ = (id) => document.getElementById(id);
  const show = (id) => ['v-in', 'v-reset', 'v-welcome', 'v-setup', 'v-app'].forEach((v) => { $(v).hidden = v !== id; });
  const recovering = /type=recovery/.test(location.hash);
  const say = (id, t, ok) => { const m = $(id); m.textContent = t || ''; m.classList.toggle('ok', !!ok); };
  const el = (tag, attrs, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); } kids.flat().forEach((c) => c != null && e.append(c)); return e; };
  let me = null, user = null;

  function chips(box, items, value, onPick) {
    box.replaceChildren(...items.map(([v, label]) => el('button', { type: 'button', 'aria-pressed': String(v === value), onclick: () => { box.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false')); box.querySelector(`[data-v="${v}"]`).setAttribute('aria-pressed', 'true'); onPick(v); }, 'data-v': v }, label)));
  }

  // ---------- sign in
  if (GOOGLE_ON) { $('b-google').hidden = false; $('or').hidden = false; }
  $('b-google').addEventListener('click', async () => {
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/account/' } });
    if (error) say('m-in', 'Google sign-in is not ready yet. Please use email.');
  });
  $('f-email').addEventListener('submit', async (e) => {
    e.preventDefault(); say('m-in', '');
    const email = $('in-email').value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return say('m-in', 'Please type a valid email.');
    $('b-send').disabled = true; $('b-send').textContent = 'Sending…';
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: location.origin + '/account/' } });
    $('b-send').disabled = false; $('b-send').textContent = 'Email me a sign-in link';
    if (error) return say('m-in', /rate|limit|seconds/i.test(error.message) ? 'Too many emails just now. Wait a minute and try again.' : 'Could not send the email. Try again or chat with us.');
    $('f-email').hidden = true; $('f-code').hidden = false; $('in-code').focus();
  });
  $('f-code').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = $('in-code').value.trim();
    if (!/^\d{6}$/.test(token)) return say('m-in', 'Type the 6-digit code, or just tap the link in the email.');
    const { error } = await sb.auth.verifyOtp({ email: $('in-email').value.trim().toLowerCase(), token, type: 'email' });
    if (error) return say('m-in', 'That code did not work. Use the newest email.');
  });
  $('b-back').addEventListener('click', () => { $('f-code').hidden = true; $('f-email').hidden = false; say('m-in', ''); });
  // password sign-in (optional; set it in Profile) + forgot password
  $('b-usepass').addEventListener('click', () => { $('f-email').hidden = true; $('f-pass').hidden = false; $('pw-email').value = $('in-email').value; say('m-in', ''); $('pw-email').focus(); });
  $('b-nopass').addEventListener('click', () => { $('f-pass').hidden = true; $('f-email').hidden = false; say('m-in', ''); });
  $('f-pass').addEventListener('submit', async (e) => {
    e.preventDefault(); say('m-in', '');
    const { error } = await sb.auth.signInWithPassword({ email: $('pw-email').value.trim().toLowerCase(), password: $('pw-pass').value });
    if (error) say('m-in', 'Email or password is wrong. Forgot it? Tap "Forgot password" or use the email link.');
  });
  $('b-forgot').addEventListener('click', async () => {
    const email = $('pw-email').value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return say('m-in', 'Type your email first, then tap "Forgot password".');
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/account/' });
    say('m-in', error ? 'Could not send right now. Wait a minute and try again.' : '📩 Check your email for the reset link.', !error);
  });
  $('f-reset').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = $('rs-pass').value; if (pw.length < 8) return say('m-reset', 'Use at least 8 characters.');
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) return say('m-reset', 'Could not save. Open the newest reset email again.');
    history.replaceState(null, '', location.pathname); load();
  });

  // ---------- after sign in
  async function load() {
    const { data: { session } } = await sb.auth.getSession();
    user = session && session.user;
    if (!user) return show('v-in');
    if (recovering && !load.done) { load.done = true; return show('v-reset'); }
    const { data } = await sb.from('customers').select('*').eq('user_id', user.id).maybeSingle();
    me = data;
    if (!me || !me.name) return setup();
    app();
  }
  sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') { load.done = true; show('v-reset'); } else if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') load(); });

  let setupLang = 'hinglish';
  function setup() {
    show('v-setup');
    const guess = (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || '';
    $('s-name').value = (me && me.name) || guess; $('s-phone').value = (me && me.phone) || '';
    chips($('s-lang'), [['hinglish', 'Hinglish'], ['hindi', 'Hindi'], ['punjabi', 'Punjabi'], ['english', 'English']], setupLang, (v) => { setupLang = v; });
    $('s-name').focus();
  }
  $('f-setup').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('s-name').value.trim();
    if (!name) return say('m-setup', 'Please type your name.');
    const row = { user_id: user.id, name, phone: $('s-phone').value.trim() || null, language: setupLang, offers_ok: $('s-offers').checked, updated_at: new Date().toISOString() };
    const { error } = await sb.from('customers').upsert(row);
    if (error) return say('m-setup', 'Could not save. Try again.');
    me = row; welcome();
  });

  // ---------- welcome, once
  function welcome() {
    show('v-welcome'); $('wl-name').textContent = String(me.name).split(' ')[0];
    window.scrollTo(0, 0);
  }
  $('wl-play').addEventListener('click', () => {
    const a = new Audio('/audio/jhoomi/hello_' + ({ english: 'en', punjabi: 'pa' }[me && me.language] || 'hi') + '.mp3');
    try { window.jwSolo && window.jwSolo(a); } catch (e) {} a.play().catch(() => {});
  });
  $('wl-go').addEventListener('click', () => { try { sessionStorage.setItem('jw_acc_tab', 'make'); } catch (e) {} app(); });

  // ---------- account
  const OCC = [['Birthday', '🎂 Birthday'], ['Anniversary', '💍 Anniversary'], ['Wedding entry', '👰 Wedding entry'], ['Love / proposal', '💘 Love'], ['Kids / lori', '🧸 Kids'], ['Devotional', '🙏 Devotional'], ['Just because', '✨ Just because']];
  let occ = 'Birthday', people = [];
  function tab(t) {
    document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.t === t)));
    ['make', 'songs', 'people', 'voice', 'me'].forEach((x) => { $('t-' + x).hidden = x !== t; });
    $('f-setpass').hidden = $('c-delete').hidden = t !== 'me';
    if (t === 'songs') loadSongs(); if (t === 'people') loadPeople(); if (t === 'me') fillMe();
    try { sessionStorage.setItem('jw_acc_tab', t); } catch (e) {}
  }
  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => tab(b.dataset.t)));
  function app() {
    show('v-app');
    $('hello').replaceChildren('Namaste ', el('span', { class: 'g' }, String(me.name).split(' ')[0]), ' 👋');
    chips($('mk-occ'), OCC, occ, (v) => { occ = v; });
    const L = { hinglish: 'Hinglish', hindi: 'Hindi', punjabi: 'Punjabi', english: 'English' }; $('mk-lang').value = L[me.language] || 'Hinglish';
    $('v-interest').checked = !!me.voice_interest;
    loadPeople(true);
    let t = 'make'; try { t = sessionStorage.getItem('jw_acc_tab') || 'make'; } catch (e) {} tab(t);
  }
  $('t-make').addEventListener('submit', async (e) => {
    e.preventDefault(); say('m-make', '');
    const who = $('mk-for').value.trim();
    if (!who) return say('m-make', 'Who is the song for? Type a name.');
    $('mk-go').disabled = true;
    const { error } = await sb.rpc('request_song', { p_product: occ === 'Wedding entry' ? 'Wedding entry song' : 'Name song', p_for: who, p_occasion: occ, p_language: $('mk-lang').value, p_style: $('mk-style').value, p_story: $('mk-story').value.trim() });
    $('mk-go').disabled = false;
    if (error) return say('m-make', /too many/.test(error.message) ? 'That is a lot of songs today! Chat with us for more.' : 'Could not send. Try again or chat with us.');
    $('t-make').reset(); say('m-make', me.phone ? `Done! 🎉 We'll send the free preview on WhatsApp (${me.phone}) soon. Track it in "My songs".` : 'Done! 🎉 Add your WhatsApp number in Profile so we can send the free preview fast.', true);
  });

  const ST = { new: 'Received', paid: 'Paid', making: 'Being made', quality_check: 'Final check', delivered: 'Delivered', refunded: 'Refunded', cancelled: 'Cancelled' };
  async function loadSongs() {
    const box = $('songs'); box.replaceChildren(el('p', { class: 'empty' }, 'Loading…'));
    const { data, error } = await sb.rpc('my_orders');
    if (error) return box.replaceChildren(el('p', { class: 'empty' }, 'Could not load your songs.'));
    if (!data.length) return box.replaceChildren(el('p', { class: 'empty' }, 'No songs yet. Tap "Make a song" to ask for your first free preview.'));
    box.replaceChildren(...data.map((o) => el('div', { class: 'row' },
      el('div', { class: 't' }, el('b', {}, `${o.product} for ${(o.details && o.details.for) || '—'}`), el('small', {}, `${(o.details && o.details.occasion) || ''} · ${new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}${o.price_inr ? ' · ₹' + o.price_inr : ''}`)),
      el('span', { class: 'st ' + o.status }, ST[o.status] || o.status))));
  }
  const fmt = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');
  async function loadPeople(quiet) {
    const { data } = await sb.from('people').select('*').order('created_at');
    people = data || [];
    $('dl-people').replaceChildren(...people.map((p) => el('option', { value: p.pronunciation ? `${p.name} (${p.pronunciation})` : p.name })));
    if (quiet) return;
    const box = $('people');
    box.replaceChildren(...(people.length ? people.map((p) => el('div', { class: 'row' },
      el('div', { class: 't' }, el('b', {}, p.name + (p.relation ? ' · ' + p.relation : '')), el('small', {}, [p.pronunciation && 'Say: ' + p.pronunciation, p.birthday && '🎂 ' + fmt(p.birthday), p.anniversary && '💍 ' + fmt(p.anniversary)].filter(Boolean).join(' · ') || ' ')),
      el('button', { class: 'x', type: 'button', 'aria-label': 'Make a song for ' + p.name, title: 'Make a song', onclick: () => { tab('make'); $('mk-for').value = p.pronunciation ? `${p.name} (${p.pronunciation})` : p.name; $('mk-story').focus(); } }, '🎵'),
      el('button', { class: 'x', type: 'button', 'aria-label': 'Remove ' + p.name, onclick: async () => { await sb.from('people').delete().eq('id', p.id); loadPeople(); } }, '×')))
      : [el('p', { class: 'empty' }, 'Nobody saved yet.')]));
  }
  $('f-person').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('p-name').value.trim(); if (!name) return say('m-person', 'Type a name.');
    const { error } = await sb.from('people').insert({ user_id: user.id, name, relation: $('p-rel').value.trim() || null, pronunciation: $('p-say').value.trim() || null, birthday: $('p-bday').value || null, anniversary: $('p-anniv').value || null });
    if (error) return say('m-person', 'Could not save.');
    $('f-person').reset(); say('m-person', 'Saved ✓', true); loadPeople();
  });
  $('v-interest').addEventListener('change', async (e) => {
    const { error } = await sb.from('customers').update({ voice_interest: e.target.checked, updated_at: new Date().toISOString() }).eq('user_id', user.id);
    say('m-voice', error ? 'Could not save.' : e.target.checked ? "You're on the list ✓" : 'Okay, removed.', !error);
  });
  function fillMe() { $('me-name').value = me.name || ''; $('me-phone').value = me.phone || ''; $('me-lang').value = me.language || 'hinglish'; $('me-offers').checked = !!me.offers_ok; }
  $('t-me').addEventListener('submit', async (e) => {
    e.preventDefault();
    const patch = { name: $('me-name').value.trim() || me.name, phone: $('me-phone').value.trim() || null, language: $('me-lang').value, offers_ok: $('me-offers').checked, updated_at: new Date().toISOString() };
    const { error } = await sb.from('customers').update(patch).eq('user_id', user.id);
    if (error) return say('m-me', 'Could not save.');
    Object.assign(me, patch); say('m-me', 'Saved ✓', true); $('hello').replaceChildren('Namaste ', el('span', { class: 'g' }, String(me.name).split(' ')[0]), ' 👋');
  });
  $('f-setpass').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = $('np-pass').value; if (pw.length < 8) return say('m-pass', 'Use at least 8 characters.');
    const { error } = await sb.auth.updateUser({ password: pw });
    $('np-pass').value = ''; say('m-pass', error ? 'Could not save. Sign out, sign in again with the email link, then try.' : 'Password saved ✓ Next time use "I have a password".', !error);
  });
  $('b-del').addEventListener('click', async () => {
    if ($('del-confirm').value.trim() !== 'DELETE') return say('m-del', 'Type DELETE (in capitals) to confirm.');
    $('b-del').disabled = true; say('m-del', 'Deleting…', true);
    const { data: { session } } = await sb.auth.getSession();
    try {
      const r = await fetch(URL + '/functions/v1/delete-account', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + session.access_token }, body: JSON.stringify({ confirm: 'DELETE' }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { $('b-del').disabled = false; return say('m-del', j.error || 'Could not delete. Please chat with us.'); }
      await sb.auth.signOut(); show('v-in'); say('m-in', 'Your account is deleted. Thank you for being with JHOOMWAVE 🙏', true);
    } catch (x) { $('b-del').disabled = false; say('m-del', 'No internet? Try again.'); }
  });
  $('b-out').addEventListener('click', async () => { await sb.auth.signOut(); show('v-in'); });
  load();
})();
