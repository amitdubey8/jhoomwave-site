/* JHOOMWAVE brand motion for wish pages: a 1.2 s logo intro, equalizer bars on every logo,
   and the bars dance faster while a song or video is playing. Respects "reduce motion". */
(function () {
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LOGO = '<svg class="jw-eq" viewBox="0 0 260 240" aria-hidden="true"><defs><linearGradient id="jwg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7B2FF7"/><stop offset=".55" stop-color="#FF2E88"/><stop offset="1" stop-color="#FF8A00"/></linearGradient></defs><path d="M68 52 V150 a27 27 0 0 1 -54 0" fill="none" stroke="url(#jwg)" stroke-width="30" stroke-linecap="round"/><rect x="100" y="45" width="22" height="150" rx="11" fill="url(#jwg)"/><rect x="132" y="70" width="22" height="100" rx="11" fill="url(#jwg)"/><rect x="164" y="52" width="22" height="136" rx="11" fill="url(#jwg)"/><rect x="196" y="83" width="22" height="74" rx="11" fill="url(#jwg)"/><rect x="228" y="65" width="22" height="110" rx="11" fill="url(#jwg)"/></svg>';
  var css = ''
    + '.jw-eq rect{transform-box:fill-box;transform-origin:50% 50%;animation:jweq 1.4s ease-in-out infinite alternate}'
    + '.jw-eq rect:nth-of-type(1){animation-delay:-.2s}.jw-eq rect:nth-of-type(2){animation-delay:-.7s}.jw-eq rect:nth-of-type(3){animation-delay:-.4s}.jw-eq rect:nth-of-type(4){animation-delay:-1s}.jw-eq rect:nth-of-type(5){animation-delay:-.55s}'
    + 'html.jw-playing .jw-eq rect{animation-duration:.42s}'
    + '@keyframes jweq{0%{transform:scaleY(.45)}50%{transform:scaleY(1)}100%{transform:scaleY(.7)}}'
    + '.jw-word{background:linear-gradient(90deg,#B98CFF,#FF2E88,#FF8A00,#FFD166,#B98CFF);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:jwshine 6s linear infinite}'
    + '@keyframes jwshine{to{background-position:300% 0}}'
    + '#jwsplash{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:radial-gradient(80% 60% at 50% 45%,#2A0E4A,#0C0414);transition:opacity .5s ease,visibility .5s}'
    + '#jwsplash.out{opacity:0;visibility:hidden}'
    + '#jwsplash .in{display:flex;flex-direction:column;align-items:center;gap:14px;animation:jwrise .7s cubic-bezier(.2,.8,.2,1) both}'
    + '#jwsplash svg{width:92px;height:85px;filter:drop-shadow(0 0 24px rgb(255 46 136/.55))}'
    + '#jwsplash .w{font:900 30px/1 Poppins,system-ui,sans-serif;letter-spacing:4px}'
    + '#jwsplash .t{font:400 15px/1 "Tiro Devanagari Hindi",serif;color:rgb(255 255 255/.75);letter-spacing:.5px;opacity:0;animation:jwfade .6s .35s ease forwards}'
    + '@keyframes jwrise{from{opacity:0;transform:translateY(14px) scale(.94)}to{opacity:1;transform:none}}@keyframes jwfade{to{opacity:1}}'
    + '.jw-mark{display:flex;flex-direction:column;align-items:center;gap:6px;margin:26px auto 8px;text-decoration:none}.jw-mark svg{width:46px;height:42px}.jw-mark .jw-word{font:900 20px/1 Poppins,system-ui,sans-serif;letter-spacing:3px}.jw-mark small{font:400 13px "Tiro Devanagari Hindi",serif;color:rgb(255 255 255/.7)}'
    + '@media (prefers-reduced-motion:reduce){.jw-eq rect,.jw-word{animation:none}#jwsplash{display:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function init() {
    // logos already on the page dance too
    document.querySelectorAll('svg[viewBox="0 0 260 240"]').forEach(function (s) { s.classList.add('jw-eq'); });
    document.querySelectorAll('.brand,.bc .wd').forEach(function (n) { if (n.classList.contains('wd')) n.classList.add('jw-word'); });
    // a brand mark at the end of pages that do not have one
    if (!document.querySelector('.bc')) {
      var foot = document.querySelector('.foot, footer');
      var m = document.createElement('a'); m.className = 'jw-mark'; m.href = 'https://jhoomwave.com'; m.setAttribute('aria-label', 'JHOOMWAVE');
      m.innerHTML = LOGO + '<span class="jw-word">JHOOMWAVE</span><small>अब हर खुशी का अपना गाना!</small>';
      if (foot) foot.parentNode.insertBefore(m, foot); else document.body.appendChild(m);
    }
    // faster bars while anything plays
    document.addEventListener('play', function () { document.documentElement.classList.add('jw-playing'); }, true);
    ['pause', 'ended'].forEach(function (ev) { document.addEventListener(ev, function () { if (![].some.call(document.querySelectorAll('audio,video'), function (x) { return !x.paused; })) document.documentElement.classList.remove('jw-playing'); }, true); });
  }

  // intro splash (once per browser tab session)
  var seen = false; try { seen = sessionStorage.getItem('jw_splash') === '1'; sessionStorage.setItem('jw_splash', '1'); } catch (e) {}
  if (!reduce && !seen && document.body) {
    var sp = document.createElement('div'); sp.id = 'jwsplash'; sp.setAttribute('aria-hidden', 'true');
    sp.innerHTML = '<div class="in">' + LOGO + '<div class="w jw-word">JHOOMWAVE</div><div class="t">अब हर खुशी का अपना गाना!</div></div>';
    document.body.appendChild(sp);
    var bye = function () { sp.classList.add('out'); setTimeout(function () { sp.remove(); }, 600); };
    setTimeout(bye, 1300); sp.addEventListener('click', bye);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
