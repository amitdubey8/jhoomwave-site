/* JHOOMWAVE site player: one sticky "player mode" bar for every .pb[data-src] button on a page.
   Smooth playback: songs up to 6 MB are fully downloaded (with a % shown) before they play, so weak mobile
   networks cannot make them stop mid-song; the next song is pre-loaded in the background (skipped on Save-Data).
   Bigger files stream. One <audio> element is reused, works with window.jwSolo, and shows lock-screen controls. */
(function () {
  const btns = [...document.querySelectorAll('.pb[data-src]')];
  if (!btns.length) return;
  const MAX_BLOB = 6 * 1024 * 1024;
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const tracks = btns.map((b, i) => {
    const card = b.closest('article, .rc, section') || document.body;
    const h = card.querySelector('h2, h3');
    const img = card.querySelector('img');
    const title = h ? h.childNodes[0].textContent.trim() : (b.dataset.title || 'JHOOMWAVE');
    return { i, b, src: b.dataset.src, title, cover: img ? img.currentSrc || img.src : '/apple-touch-icon.png', label: b.textContent.trim() };
  });

  const css = `
  .jwp{position:fixed;left:0;right:0;bottom:0;z-index:60;background:rgba(16,10,24,.96);color:#fff;backdrop-filter:blur(10px);
    border-top:1px solid rgba(255,255,255,.12);padding:10px max(14px,env(safe-area-inset-right,0px)) calc(10px + env(safe-area-inset-bottom,0px)) max(14px,env(safe-area-inset-left,0px));
    display:grid;grid-template-columns:48px 1fr auto;gap:12px;align-items:center;font:14px Poppins,system-ui,sans-serif;transform:translateY(110%);transition:transform .25s ease}
  .jwp.on{transform:none}
  .jwp img{width:48px;height:48px;border-radius:10px;object-fit:cover}
  .jwp .tt{min-width:0}.jwp .nm{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .jwp .st{font-size:12px;opacity:.75;font-variant-numeric:tabular-nums}
  .jwp .bar{position:relative;height:6px;border-radius:3px;background:rgba(255,255,255,.15);margin-top:6px;cursor:pointer;touch-action:none}
  .jwp .buf,.jwp .pos{position:absolute;left:0;top:0;bottom:0;border-radius:3px}
  .jwp .buf{background:rgba(255,255,255,.28)}.jwp .pos{background:linear-gradient(90deg,#7B2FF7,#FF2E88,#FF8A00)}
  .jwp .ct{display:flex;gap:6px;align-items:center}
  .jwp button{all:unset;cursor:pointer;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-size:18px}
  .jwp button.pp{background:#FF2E88;width:46px;height:46px;font-size:20px}
  .jwp button:focus-visible{outline:2px solid #FF8A00;outline-offset:2px}
  .jwp .x{font-size:15px;opacity:.7}
  .jwp .spin{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:jwspin .8s linear infinite;vertical-align:-2px;margin-right:6px}
  @keyframes jwspin{to{transform:rotate(360deg)}}
  @media (max-width:420px){.jwp{grid-template-columns:40px 1fr auto;gap:8px}.jwp img{width:40px;height:40px}.jwp button{width:34px;height:34px;font-size:16px}.jwp button.pp{width:40px;height:40px}.jwp .x{width:26px}}
  @media (prefers-reduced-motion:reduce){.jwp{transition:none}.jwp .spin{animation:none}}
  body.jwp-pad{padding-bottom:96px}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const el = document.createElement('div');
  el.className = 'jwp'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Music player');
  el.innerHTML = '<img alt=""><div class="tt"><div class="nm"></div><div class="st"></div><div class="bar" role="slider" aria-label="Seek" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="buf"></div><div class="pos"></div></div></div>' +
    '<div class="ct"><button class="pv" type="button" aria-label="Previous">⏮</button><button class="pp" type="button" aria-label="Play">▶</button><button class="nx" type="button" aria-label="Next">⏭</button><button class="x" type="button" aria-label="Close player">✕</button></div>';
  document.body.appendChild(el);
  const $ = s => el.querySelector(s);
  const a = new Audio(); a.preload = 'auto';
  const blobs = new Map(), loading = new Map();
  let cur = -1, want = -1;

  const fmt = s => { if (!isFinite(s)) return '0:00'; s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const setStatus = html => { $('.st').innerHTML = html; };

  function fetchBlob(src, onp) {
    if (blobs.has(src)) return Promise.resolve(blobs.get(src));
    if (loading.has(src)) return loading.get(src);
    const p = (async () => {
      const r = await fetch(src); if (!r.ok) throw new Error('http ' + r.status);
      const len = +r.headers.get('content-length') || 0;
      if (len > MAX_BLOB || !r.body || !r.body.getReader) throw new Error('stream');
      const rd = r.body.getReader(), parts = []; let got = 0;
      for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; onp && len && onp(got / len); }
      const url = URL.createObjectURL(new Blob(parts, { type: 'audio/mpeg' }));
      blobs.set(src, url); return url;
    })();
    loading.set(src, p); p.catch(() => {}).finally(() => loading.delete(src));
    return p;
  }

  function mark() {
    tracks.forEach(t => { const on = t.i === cur && !a.paused; t.b.setAttribute('aria-pressed', on ? 'true' : 'false'); t.b.textContent = (on ? '⏸ Pause' : t.label); });
    $('.pp').textContent = a.paused ? '▶' : '⏸'; $('.pp').setAttribute('aria-label', a.paused ? 'Play' : 'Pause');
  }

  async function play(i) {
    const t = tracks[i]; if (!t) return;
    want = i; cur = i;
    el.classList.add('on'); document.body.classList.add('jwp-pad');
    $('img').src = t.cover; $('.nm').textContent = t.title;
    a.pause(); mark();
    setStatus('<span class="spin"></span>Loading…');
    let url = t.src;
    try { url = await fetchBlob(t.src, f => { if (want === i) setStatus('<span class="spin"></span>Loading ' + Math.round(f * 100) + '%'); }); }
    catch (e) { url = t.src; } /* big file or fetch blocked: stream it */
    if (want !== i) return;
    a.src = url; window.jwSolo && window.jwSolo(a);
    try { await a.play(); } catch (e) { setStatus('Tap ▶ to play'); }
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: 'JHOOMWAVE', album: 'JHOOMWAVE Music', artwork: [{ src: t.cover, sizes: '512x512' }] });
        navigator.mediaSession.setActionHandler('play', () => a.play());
        navigator.mediaSession.setActionHandler('pause', () => a.pause());
        navigator.mediaSession.setActionHandler('previoustrack', () => play((cur - 1 + tracks.length) % tracks.length));
        navigator.mediaSession.setActionHandler('nexttrack', () => play((cur + 1) % tracks.length));
      } catch (e) {}
    }
    try { window.gtag && gtag('event', 'music_play', { src: t.src }); } catch (e) {}
    /* pre-load the next song quietly, unless the visitor saves data */
    const n = tracks[(i + 1) % tracks.length];
    if (!saveData && n && n.src !== t.src) setTimeout(() => fetchBlob(n.src).catch(() => {}), 1500);
  }

  tracks.forEach(t => t.b.addEventListener('click', e => {
    e.preventDefault(); e.stopImmediatePropagation();
    if (t.i === cur && a.src) { a.paused ? a.play().catch(() => {}) : a.pause(); return; }
    play(t.i);
  }, true));
  $('.pp').addEventListener('click', () => { if (cur < 0) return play(0); a.paused ? a.play().catch(() => {}) : a.pause(); });
  $('.pv').addEventListener('click', () => play((cur - 1 + tracks.length) % tracks.length));
  $('.nx').addEventListener('click', () => play((cur + 1) % tracks.length));
  $('.x').addEventListener('click', () => { a.pause(); el.classList.remove('on'); document.body.classList.remove('jwp-pad'); });

  const bar = $('.bar');
  const seekTo = x => { const r = bar.getBoundingClientRect(); const f = Math.min(1, Math.max(0, (x - r.left) / r.width)); if (isFinite(a.duration)) a.currentTime = f * a.duration; };
  bar.addEventListener('pointerdown', e => { seekTo(e.clientX); bar.setPointerCapture(e.pointerId); });
  bar.addEventListener('pointermove', e => { if (e.buttons) seekTo(e.clientX); });
  bar.addEventListener('keydown', e => { if (e.key === 'ArrowRight') a.currentTime += 5; if (e.key === 'ArrowLeft') a.currentTime -= 5; });

  a.addEventListener('timeupdate', () => {
    const f = a.duration ? a.currentTime / a.duration : 0;
    $('.pos').style.width = (f * 100) + '%'; bar.setAttribute('aria-valuenow', Math.round(f * 100));
    if (!a.paused) setStatus(fmt(a.currentTime) + ' / ' + fmt(a.duration));
  });
  a.addEventListener('progress', () => { try { const b = a.buffered; if (b.length && a.duration) $('.buf').style.width = (b.end(b.length - 1) / a.duration * 100) + '%'; } catch (e) {} });
  a.addEventListener('loadeddata', () => { if (a.src.startsWith('blob:')) $('.buf').style.width = '100%'; });
  a.addEventListener('waiting', () => setStatus('<span class="spin"></span>Buffering…'));
  a.addEventListener('play', mark); a.addEventListener('pause', mark);
  a.addEventListener('ended', () => { if (cur < tracks.length - 1) play(cur + 1); else mark(); });
})();
