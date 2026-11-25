/* JHOOMWAVE live chat: website visitors talk to a real person from the team, who answers from the Office.
   Visitors never get database access: they call 4 Supabase functions (chat_status / chat_start / chat_send / chat_poll)
   with a secret token kept only in this browser. The public key below can do nothing else (row-level security). */
(function () {
  if (/^\/(office|console)(\/|$)/.test(location.pathname)) return;
  const CFG = { url: 'https://srcclctqfkagpolhocqf.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyY2NsY3RxZmthZ3BvbGhvY3FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU1NDY1OTYsImV4cCI6MjExMTEyMjU5Nn0.0_T3iBE2ssrABWWbL8hkLqOOvpany5uP2LSFlhi0G54' };
  const rpc = async (fn, body) => {
    const r = await fetch(CFG.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.key, Authorization: 'Bearer ' + CFG.key }, body: JSON.stringify(body || {}) });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error((j && j.message) || 'http ' + r.status);
    return j;
  };
  const store = {
    get() { try { return JSON.parse(localStorage.getItem('jw_chat') || 'null'); } catch (e) { return null; } },
    set(v) { try { v ? localStorage.setItem('jw_chat', JSON.stringify(v)) : localStorage.removeItem('jw_chat'); } catch (e) {} },
  };
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const hhmm = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let chat = store.get(), seen = [], cursor = 0, online = false, timer = 0, isOpen = false, unread = 0; // cursor: newest message drawn on this page

  // ---------- panel
  const pan = el('section', 'lc'); pan.hidden = true; pan.setAttribute('role', 'dialog'); pan.setAttribute('aria-label', 'Chat with the JHOOMWAVE team');
  pan.innerHTML = `<header><span class="lc-ava" aria-hidden="true">JW</span><div><b>JHOOMWAVE Team</b><small class="lc-st"><i></i><span>Checking…</span></small></div><button class="lc-x" type="button" aria-label="Close chat">×</button></header>
  <div class="lc-log" aria-live="polite"></div>
  <form class="lc-start" novalidate>
    <p class="lc-hi">Hi! 👋 Ask us anything: songs with names, wedding entries, the party Booth, prices or business orders.</p>
    <label>Your message<textarea maxlength="1000" rows="3" required placeholder="e.g. Can you make a birthday song for my sister Riya?"></textarea></label>
    <div class="lc-row"><label>Your name<input maxlength="80" autocomplete="name" placeholder="Optional"></label>
    <label>WhatsApp or email<input maxlength="120" autocomplete="tel" placeholder="So we can reply if you leave"></label></div>
    <label class="lc-ok" hidden><input type="checkbox"> OK to contact me about this chat</label>
    <input class="lc-trap" tabindex="-1" autocomplete="off" aria-hidden="true">
    <button class="lc-go" type="submit">Start chat</button>
  </form>
  <form class="lc-contact" hidden><span>📞 Get the reply on WhatsApp/email too</span><div><input maxlength="120" autocomplete="tel" placeholder="WhatsApp number or email" aria-label="WhatsApp number or email"><button type="submit">Save</button></div><small>By saving, you agree we can contact you about this chat.</small></form>
  <form class="lc-send" hidden><input maxlength="1000" placeholder="Type a message…" aria-label="Message"><button type="submit" aria-label="Send">➜</button></form>
  <p class="lc-err" role="status"></p>
  <p class="lc-note">Real people from the JHOOMWAVE team reply here; our AI may help draft some answers. <a href="/privacy/">Privacy</a> · <button class="lc-new" type="button" hidden>New chat</button></p>`;
  const $ = (s) => pan.querySelector(s);
  const log = $('.lc-log'), start = $('.lc-start'), send = $('.lc-send'), err = $('.lc-err');
  const [msgIn] = [start.querySelector('textarea')], [nameIn, contactIn] = start.querySelectorAll('.lc-row input'), okBox = $('.lc-ok');

  // ---------- where the chat lives: inside Jhoomi's corner if she is on the page, else its own button
  const jh = document.querySelector('.jh');
  let launcher = null;
  if (jh) {
    jh.append(pan);
    const qs = jh.querySelector('.jh-qs');
    const b = el('button', 'jh-chat'); b.type = 'button'; b.innerHTML = '<i></i><span>💬 Chat with our team</span>';
    b.addEventListener('click', () => open(true));
    if (qs) qs.after(b);
    const note = jh.querySelector('.jh-note'); if (note) note.lastChild && note.append(' · or chat with the team above.');
    launcher = jh.querySelector('.jh-btn');
  } else {
    const box = el('div', 'lc-solo'); launcher = el('button', 'lc-fab'); launcher.type = 'button'; launcher.setAttribute('aria-label', 'Chat with the JHOOMWAVE team'); launcher.textContent = '💬';
    launcher.addEventListener('click', () => open(pan.hidden)); box.append(pan, launcher); document.body.append(box);
  }
  const badge = el('span', 'lc-badge'); badge.hidden = true; launcher.append(badge);

  function setStatus(on) {
    online = on; pan.classList.toggle('on', on);
    $('.lc-st span').textContent = on ? 'Online now · usually replies in a minute' : 'A real person replies right here';
    document.querySelectorAll('.jh-chat').forEach((b) => b.classList.toggle('on', on));
  }
  async function checkStatus() { try { const r = await rpc('chat_status'); setStatus(!!(r && r.online)); } catch (e) { setStatus(false); } }

  function draw(m) {
    if (seen.includes(m.id)) return; seen.push(m.id);
    const row = el('div', 'lc-m ' + m.sender);
    if (m.sender === 'staff') row.append(el('small', '', (m.author || 'Team') + ' · JHOOMWAVE'));
    row.append(el('p', '', m.text), el('time', '', hhmm(m.at)));
    log.append(row); log.scrollTop = log.scrollHeight;
  }
  function view() {
    const has = !!chat; start.hidden = has; send.hidden = !has; log.hidden = !has; $('.lc-new').hidden = !has;
    $('.lc-contact').hidden = !has || !!chat.contact;
  }
  async function poll() {
    if (!chat) return;
    try {
      const rows = await rpc('chat_poll', { p_id: chat.id, p_token: chat.token, p_after: cursor });
      let fresh = 0;
      (rows || []).forEach((m) => { cursor = Math.max(cursor, m.id); if (m.id > (chat.last || 0)) { chat.last = m.id; if (m.sender === 'staff' && !isOpen) fresh++; } draw(m); });
      if (rows && rows.length) store.set(chat);
      if (fresh) { unread += fresh; badge.textContent = unread; badge.hidden = false; }
    } catch (e) { if (/not found/.test(e.message)) { chat = null; store.set(null); view(); } }
  }
  function schedule() {
    clearTimeout(timer);
    if (!chat || document.hidden) return;
    timer = setTimeout(async () => { await poll(); schedule(); }, isOpen ? 4000 : 30000);
  }
  function open(o) {
    isOpen = o; pan.hidden = !o;
    if (jh) { const jp = jh.querySelector('.jh-pan'); if (o && jp) jp.hidden = true; jh.classList.toggle('open', o || (jp && !jp.hidden)); }
    if (o) { unread = 0; badge.hidden = true; checkStatus(); view(); if (chat) { poll(); } setTimeout(() => (chat ? send.querySelector('input') : msgIn).focus(), 50); }
    schedule();
  }
  $('.lc-x').addEventListener('click', () => open(false));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen) open(false); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && chat) poll(); schedule(); });
  contactIn.addEventListener('input', () => { okBox.hidden = !contactIn.value.trim(); });

  start.addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = '';
    const text = msgIn.value.trim(), contact = contactIn.value.trim();
    if (text.length < 2) { err.textContent = 'Please type your message.'; msgIn.focus(); return; }
    if (contact && !okBox.querySelector('input').checked) { err.textContent = 'Please tick "OK to contact me" so we can reply on WhatsApp/email.'; return; }
    if ($('.lc-trap').value) { start.reset(); return; } // a bot filled the hidden field
    const go = $('.lc-go'); go.disabled = true; go.textContent = 'Starting…';
    try {
      const r = await rpc('chat_start', { p_name: nameIn.value.trim(), p_contact: contact, p_consent: !!contact, p_text: text, p_page: location.pathname.slice(0, 200) });
      chat = { id: r.id, token: r.token, last: 0, contact: !!contact }; store.set(chat); start.reset(); view(); await poll(); schedule();
      try { window.track && window.track('chat_start'); } catch (x) {}
    } catch (x) { err.textContent = 'Could not start the chat right now. Please DM @jhoomwave on Instagram.'; }
    go.disabled = false; go.textContent = 'Start chat';
  });
  send.addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = '';
    const inp = send.querySelector('input'), text = inp.value.trim(); if (!text || !chat) return;
    inp.value = '';
    try { await rpc('chat_send', { p_id: chat.id, p_token: chat.token, p_text: text }); await poll(); }
    catch (x) { inp.value = text; err.textContent = /slow/.test(x.message) ? 'Too many messages at once. Wait a minute.' : 'Not sent. Check your internet and try again.'; }
  });
  $('.lc-contact').addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = '';
    const inp = $('.lc-contact input'), c = inp.value.trim(); if (!chat || c.length < 6) { err.textContent = 'Please type a WhatsApp number or email.'; return; }
    try { await rpc('chat_send', { p_id: chat.id, p_token: chat.token, p_text: '📞 You can also reach me at: ' + c, p_contact: c }); chat.contact = true; store.set(chat); inp.value = ''; view(); await poll(); }
    catch (x) { err.textContent = 'Not saved. Try again.'; }
  });
  $('.lc-new').addEventListener('click', () => { chat = null; seen = []; cursor = 0; store.set(null); log.textContent = ''; view(); msgIn.focus(); });

  window.jwChat = { open: () => open(true) };
  document.querySelectorAll('[data-chat]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); open(true); }));
  view(); checkStatus();
  if (chat) { poll(); schedule(); }
})();
