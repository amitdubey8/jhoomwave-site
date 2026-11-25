/* JHOOMWAVE first-visit experience: consent banner, prelaunch offer, 3-step welcome tour, returning-visitor hello.
   Privacy: nothing leaves the browser unless the visitor taps "OK". Then we send an anonymous visit line
   (random id, region guessed from time zone, language, page, referrer site, utm) to our own database. No IP, no ad trackers. */
(function () {
  if (/^\/(office|console)(\/|$)/.test(location.pathname)) return;
  const URL = 'https://srcclctqfkagpolhocqf.supabase.co';
  const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyY2NsY3RxZmthZ3BvbGhvY3FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU1NDY1OTYsImV4cCI6MjExMTEyMjU5Nn0.0_T3iBE2ssrABWWbL8hkLqOOvpany5uP2LSFlhi0G54';
  const OFFER_END = new Date('2026-12-31T23:59:59+05:30');
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }; // html here is our own fixed copy only

  // ---- who is this (kept in this browser only)
  const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '');
  const region = /Kolkata|Calcutta/.test(tz) ? 'India' : /Dubai|Muscat|Qatar|Riyadh|Bahrain|Kuwait/.test(tz) ? 'Gulf' : /London|Dublin/.test(tz) ? 'UK' : /^Europe\//.test(tz) ? 'Europe'
    : /^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|Regina)/.test(tz) ? 'Canada' : /^America\//.test(tz) ? 'USA' : /Australia/.test(tz) ? 'Australia' : /Singapore|Kuala/.test(tz) ? 'SE Asia' : 'Other';
  const visits = Number(ls.get('jw_visits') || 0) + 1; ls.set('jw_visits', String(visits));
  const first = visits === 1;
  const interest = /weddings/.test(location.pathname) ? 'weddings' : /kids/.test(location.pathname) ? 'kids' : /business/.test(location.pathname) ? 'business' : null;
  if (interest) ls.set('jw_interest', interest);

  // ---- consent banner
  const consent = ls.get('jw_consent'); // 'all' | 'essential' | null
  function logVisit() {
    let id = ls.get('jw_anon'); if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/-/g, '').slice(0, 24); ls.set('jw_anon', id); }
    const q = new URLSearchParams(location.search), utm = ['utm_source', 'utm_medium', 'utm_campaign'].map((k) => q.get(k)).filter(Boolean).join('/');
    let ref = ''; try { ref = document.referrer ? new window.URL(document.referrer).hostname : ''; } catch (e) {}
    if (ref === location.hostname) ref = '';
    fetch(URL + '/rest/v1/rpc/log_visit', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + KEY },
      body: JSON.stringify({ p_anon: id, p_region: region, p_tz: tz.slice(0, 60), p_lang: (navigator.language || '').slice(0, 20), p_page: location.pathname.slice(0, 120), p_ref: ref.slice(0, 120), p_utm: utm.slice(0, 120), p_returning: !first }) }).catch(() => {});
  }
  function banner() {
    const b = el('div', 'jw-cc', `<p>🍪 We use your browser's storage to remember your choices. With your OK we also count visits and remember your region and interests to show the right songs. No ad trackers, no selling data. <a href="/privacy/">Privacy</a></p><div><button type="button" class="jw-cc-ok">OK</button><button type="button" class="jw-cc-no">Only essential</button></div>`);
    b.setAttribute('role', 'region'); b.setAttribute('aria-label', 'Cookie choice');
    b.querySelector('.jw-cc-ok').addEventListener('click', () => { ls.set('jw_consent', 'all'); b.remove(); logVisit(); next(); });
    b.querySelector('.jw-cc-no').addEventListener('click', () => { ls.set('jw_consent', 'essential'); b.remove(); next(); });
    document.body.append(b);
  }

  // ---- prelaunch offer + welcome tour (first visit only, after the visitor shows interest)
  const offerOn = Date.now() < OFFER_END.getTime();
  const pitch = { weddings: 'a wedding entry song with your names', kids: 'a lori or birthday song with your child\'s name', business: 'your brand jingle' }[ls.get('jw_interest')] || 'a song with your name in it';
  const quietJhoomi = () => { try { sessionStorage.setItem('jw_bub', '1'); } catch (e) {} document.querySelectorAll('.jh-bub').forEach((b) => { b.hidden = true; }); };
  function offer() {
    if (ls.get('jw_offer_seen') || !offerOn || /^\/account/.test(location.pathname)) return tourIfHome();
    ls.set('jw_offer_seen', '1'); quietJhoomi();
    const abroad = region !== 'India' && region !== 'Other';
    const m = el('div', 'jw-pop', `<div class="jw-pop-card" role="dialog" aria-modal="true" aria-labelledby="jw-pop-h">
      <button type="button" class="jw-pop-x" aria-label="Close">×</button>
      <span class="jw-pop-tag">✨ Prelaunch offer · till 31 Dec</span>
      <h2 id="jw-pop-h">Welcome to <span class="g">JHOOMWAVE</span>${abroad ? ', from the desi family abroad 🌍' : ' 👋'}</h2>
      <p>Hear <b>${pitch}</b> before you pay. Join now and get:</p>
      <ul><li>🎧 <b>Free 20-second preview</b> of your song</li><li>🏷️ <b>Prelaunch prices</b> on your first song</li><li>🎙️ <b>First access</b> to "song in my own voice"</li></ul>
      <a class="btn pri jw-pop-go" href="/account/">Create my free account</a>
      <button type="button" class="jw-pop-tour">Show me around first (30 sec)</button>
      <small>No payment needed to join. Free previews are made by our team in order, so they can take a few hours.</small></div>`);
    const close = () => { m.remove(); document.removeEventListener('keydown', esc); };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    m.querySelector('.jw-pop-x').addEventListener('click', close);
    m.addEventListener('click', (e) => { if (e.target === m) close(); });
    m.querySelector('.jw-pop-tour').addEventListener('click', () => { close(); tour(true); });
    document.addEventListener('keydown', esc);
    document.body.append(m); m.querySelector('.jw-pop-go').focus();
  }

  // 3 steps on the home page: spotlight + bubble
  function tourIfHome() {} // the tour runs only when the visitor asks for it
  function tour(asked) {
    if (location.pathname !== '/') { if (asked) location.href = '/?tour=1'; return; }
    const steps = [
      ['.hero .btn.pri, .hero a.btn, main a.btn', '🎵 Tap here to make your song. Type a name, we make a free preview.'],
      ['[class*="anthem"], .player, .mini, main audio, [data-src]', '🎧 Hear real JHOOMWAVE songs first. Tap play.'],
      ['.jh-btn', '💬 Questions? Jhoomi answers, and a real person from our team chats with you here.'],
    ].map(([sel, text]) => [document.querySelector(sel), text]).filter(([n]) => n);
    if (!steps.length) return;
    quietJhoomi(); let i = 0; const shade = el('div', 'jw-tour'), tip = el('div', 'jw-tip');
    tip.setAttribute('role', 'dialog'); tip.setAttribute('aria-live', 'polite');
    const done = () => { shade.remove(); tip.remove(); ls.set('jw_tour_done', '1'); };
    function draw() {
      const [n, text] = steps[i]; n.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(() => {
        const r = n.getBoundingClientRect(), pad = 8;
        Object.assign(shade.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
        tip.innerHTML = '';
        tip.append(el('p', '', ''), el('div', 'jw-tip-b', ''));
        tip.querySelector('p').textContent = text;
        const nav = tip.querySelector('.jw-tip-b');
        const skip = el('button', 'jw-skip', 'Skip'); skip.type = 'button'; skip.addEventListener('click', done);
        const nx = el('button', 'jw-next', i < steps.length - 1 ? `Next (${i + 1}/${steps.length})` : 'Got it 🎉'); nx.type = 'button';
        nx.addEventListener('click', () => { if (++i < steps.length) draw(); else done(); });
        nav.append(skip, nx);
        const below = r.bottom + 160 < innerHeight;
        Object.assign(tip.style, { left: Math.max(12, Math.min(innerWidth - 312, r.left)) + 'px', top: (below ? r.bottom + 14 : Math.max(12, r.top - 150)) + 'px' });
        nx.focus();
      }, 350);
    }
    document.body.append(shade, tip); draw();
  }

  // returning visitor: a small hello in Jhoomi's bubble
  function hello() {
    if (first || visits % 3 !== 2) return;
    const bub = document.querySelector('.jh-bub p');
    if (bub) bub.textContent = 'Welcome back! 💜 Ready for your song? Tap "Chat with our team" or make it now, the preview is free.';
  }

  function next() { setTimeout(offer, first ? 6000 : 0); }
  function start() {
    hello();
    if (consent === 'all') logVisit();
    if (/[?&]tour=1/.test(location.search)) return tour(true);
    if (!consent) { banner(); return; }
    if (first || !ls.get('jw_offer_seen')) next(); else tourIfHome();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
