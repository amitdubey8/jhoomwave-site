/* JHOOMWAVE Booth · Anchor mode: pick an event, answer a few questions, get a timed run-of-show with the anchor's
   script, music cues, games and timers. Recorded studio lines go through the console's single voice queue (no overlaps); no device voice.
   No network calls; the show is kept in this browser only. */
(function () {
  const $ = id => document.getElementById(id);
  const css = `
  .anchor{display:none}
  body.mode-anchor .anchor{display:grid}
  body.mode-anchor .booth .console,body.mode-anchor .booth .dock,body.mode-anchor .tabs,body.mode-anchor .party,body.mode-anchor .tb-in .ctl,body.mode-anchor .tb-in .mode{display:none!important}
  body.mode-anchor{height:auto!important;overflow:auto!important}
  .anchor{max-width:1240px;margin:0 auto;padding:12px max(16px,env(safe-area-inset-left,0px)) 40px;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:16px}
  .ac{background:var(--panel);border:1px solid var(--line);border-radius:20px;padding:16px}
  .ac h3{margin:0 0 12px;font:700 12px var(--mono);letter-spacing:.14em;color:var(--mute);text-transform:uppercase;display:flex;justify-content:space-between;gap:8px}
  .evs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
  .evs button{min-height:64px;padding:10px;border-radius:14px;border:1px solid var(--line);background:var(--panel-2);color:var(--ink);text-align:left;font:800 14px var(--display);cursor:pointer}
  .evs button small{display:block;font:500 12px var(--body);color:var(--mute);margin-top:3px}
  .evs button[aria-pressed="true"]{border-color:transparent;background:var(--wave)}
  .evs button[aria-pressed="true"] small{color:#fff}
  .qf{display:grid;gap:10px}
  .qf label{display:grid;gap:5px;font:600 12.5px var(--body);color:var(--mute)}
  .qf input,.qf select{height:44px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--ink);padding:0 12px;font:500 16px var(--body);min-width:0}
  .row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .chipsx{display:flex;flex-wrap:wrap;gap:6px}
  .chipsx button{height:36px;padding:0 12px;border-radius:999px;border:1px solid var(--line);background:none;color:var(--ink);font:700 12.5px var(--body);cursor:pointer}
  .chipsx button[aria-pressed="true"]{background:var(--wave);border-color:transparent}
  .bigb{height:52px;border-radius:14px;border:0;background:var(--wave);color:#fff;font:800 15px var(--display);cursor:pointer;width:100%}
  .ghostb{height:44px;padding:0 14px;border-radius:12px;border:1px solid var(--line);background:none;color:var(--ink);font:700 13px var(--body);cursor:pointer}
  .tele{position:relative;min-height:210px;display:flex;flex-direction:column;gap:10px;background:radial-gradient(90% 90% at 90% 0%,rgb(255 46 136/.22),transparent 60%),var(--panel)}
  .tele .seg{font:700 12px var(--mono);letter-spacing:.14em;color:#FFC2DD}
  .tele .line{font:800 clamp(22px,2.4vw,32px)/1.25 var(--display);margin:0}
  .tele .meta{display:flex;flex-wrap:wrap;gap:8px;color:#D9D0EC;font:600 12.5px var(--body)}
  .tele .meta span{padding:4px 10px;border-radius:999px;background:rgb(255 255 255/.08)}
  .ctl3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
  .ctl3 button{height:64px;border-radius:16px;border:1px solid var(--line);background:var(--panel-2);color:var(--ink);font:800 14px var(--display);cursor:pointer}
  .ctl3 .say{background:linear-gradient(135deg,#FF2E88,#FF8A00);border:0}
  .timer{display:none;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-radius:14px;background:var(--panel-2)}
  .timer.on{display:flex}.timer b{font:900 34px var(--mono)}
  .ros{list-style:none;margin:0;padding:0;display:grid;gap:6px;max-height:430px;overflow:auto}
  .ros li{display:grid;grid-template-columns:62px 1fr auto;gap:10px;align-items:center;padding:9px 12px;border-radius:12px;background:var(--panel-2);cursor:pointer}
  .ros li b{font:700 14px var(--display)}.ros li small{color:var(--mute);font:600 11.5px var(--mono)}.ros li .t{font:700 12px var(--mono);color:var(--gold)}
  .ros li.cur{outline:1.5px solid var(--b)}.ros li.done{opacity:.5}
  .acol{display:grid;gap:12px;align-content:start;min-width:0}
  .note2{color:var(--mute);font-size:12px;margin:8px 0 0}
  @media (max-width:900px){.anchor{grid-template-columns:1fr;padding-bottom:calc(90px + env(safe-area-inset-bottom,0px))}.evs{grid-template-columns:1fr 1fr}}
  @media print{body *{visibility:hidden}#a-print,#a-print *{visibility:visible}#a-print{position:absolute;inset:0;padding:24px;color:#000;background:#fff;display:block!important}}
  #a-print{display:none}`;
  const st = document.createElement('style'); st.textContent = css; document.head.append(st);

  const EV = {
    wedding: { t: '💍 Wedding reception', d: 'Entry, jaimala, couple dance, games, dinner', q: [['a', 'Groom name', 'Rahul'], ['b', 'Bride name', 'Priya'], ['c', 'Host family', 'Sharma parivaar']] },
    sangeet: { t: '💃 Sangeet', d: 'Dance-off, family acts, antakshari', q: [['a', 'Groom name', 'Rahul'], ['b', 'Bride name', 'Priya'], ['c', 'Performers (comma separated)', 'Bua ji, Cousins gang, Mummy-Papa']] },
    friday: { t: '🏢 Office Fun Friday', d: 'Ice-breaker, games, desk Zumba, shout-outs', q: [['a', 'Company / team', 'Team Phoenix'], ['b', 'Host name', 'Neha'], ['c', 'Star of the week', 'Arjun']] },
    morning: { t: '☀️ Office morning energiser', d: 'Stretch, 5-min Zumba, breathing, focus', q: [['a', 'Company / team', 'Team Phoenix'], ['b', 'Host name', 'Neha'], ['c', "Today's goal", 'ship the new release']] }
  };
  // [minute offset, segment, [lines], music cue: chill|hype|entry|none, timer seconds]
  const T = {
    wedding: v => [
      [0, 'Welcome', [`Namaskar aur swagat hai aap sabhi ka, ${v.c} ki taraf se!`, `Aaj ki shaam sirf ek kahani ke naam hai: ${v.a} aur ${v.b}.`, 'Phones ready rakhiye, kyunki kuch hi der mein hoga sabse khoobsurat pal.'], 'chill', 0],
      [20, 'Couple entry', [`Lights low… torches on! Please welcome… ${v.a} aur ${v.b}!`], 'entry', 0],
      [30, 'Jaimala', ['Ab waqt hai jaimala ka! Dosto, taaliyaan zor se!', 'Uthao uthao… dulhe ko uthao! Aur dulhan ko bhi!'], 'hype', 0],
      [45, 'Family welcome', [`Ab milte hain un logon se jinki wajah se ${v.a} aur ${v.b} aaj yahan hain. Dono parivaron ka zor-daar swagat!`], 'chill', 0],
      [60, 'First dance', [`Dance floor khaali kijiye… pehla dance sirf ${v.a} aur ${v.b} ka!`], 'chill', 0],
      [75, 'Game: couple quiz', ['Couple quiz! Har sawaal pe dono ek saath jawab denge.', "Pehle 'I love you' kisne bola?", 'Kaun zyada late aata hai?', 'Shopping mein zyada kharcha kaun karta hai?', 'Gussa pehle kaun hota hai, aur manata kaun hai?'], 'none', 120],
      [90, 'Open dance floor', ['Ab koi nahi baithega! Dance floor khul gaya hai, haath upar!'], 'hype', 0],
      [120, 'Dinner', ['Khaana lag chuka hai! Aaram se khaiye, music chalta rahega.'], 'chill', 0],
      [165, 'Vote of thanks', [`Aap sabhi ka dil se shukriya. ${v.a} aur ${v.b} ko dher saara pyaar aur aashirwaad dete rahiye!`], 'chill', 0]],
    sangeet: v => {
      const acts = (v.c || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 6);
      return [
        [0, 'Welcome', [`Sangeet mein aapka swagat hai! Aaj ki raat ${v.a} aur ${v.b} ke naam!`, 'Aaj sirf ek rule: koi bhi baithega nahi!'], 'hype', 0],
        [10, 'Dance-off', ['Ladke wale versus ladki wale! Dono taraf se ek-ek team, 60 second ka dance.', 'Taaliyon se faisla hoga, kaun jeeta?'], 'hype', 120],
        ...acts.map((a, i) => [20 + i * 8, `Performance ${i + 1}`, [`Ab stage pe aa rahe hain… ${a}! Zor se taaliyaan!`], 'none', 0]),
        [20 + acts.length * 8, 'Antakshari', ['Antakshari time! Ladke wale versus ladki wale. Pehla akshar: M!'], 'none', 300],
        [30 + acts.length * 8, 'Couple performance', [`Aur ab, jiska sabko intezaar tha… ${v.a} aur ${v.b}!`], 'chill', 0],
        [40 + acts.length * 8, 'Open floor', ['Ab poora dance floor aapka! Volume full!'], 'hype', 0],
        [90 + acts.length * 8, 'Thank you', ['Kya raat thi! Shukriya aap sabhi ka. Kal shaadi mein milte hain!'], 'chill', 0]];
    },
    friday: v => [
      [0, 'Kickoff', [`Happy Fun Friday, ${v.a}! Laptops thode neeche, energy thodi upar!`, `Aaj ki host hain ${v.b}, aur DJ hai JHOOMWAVE.`], 'hype', 0],
      [5, 'Ice-breaker: two truths, one lie', ['Har koi apne baare mein teen baatein bolega: do sach, ek jhooth. Team guess karegi!'], 'chill', 180],
      [10, 'Game: guess the song', ['Guess the song! Pehle 5 second sunke naam batao. Jo pehle bolega, point uska!'], 'hype', 180],
      [15, 'Game: emoji movie', ['Emoji movie! Screen pe emojis, aapko film ka naam batana hai.', '🦁👑 … kaunsi film?', '🚂❤️💃 … kaunsi film?', '👻🏠 … kaunsi film?'], 'none', 120],
      [20, '60-second challenges', ['60 second challenge! Ek haath se tower banao, ya ek line mein apni team ki tareef karo!'], 'hype', 60],
      [25, 'Desk Zumba', ['Sab khade ho jao! 5 minute desk Zumba. Kandhe ghumao, haath upar, aur smile!'], 'hype', 300],
      [32, 'Shout-outs', [`Star of the week: ${v.c}! Zor se taaliyaan!`, 'Kisi ne kisi ki help ki is hafte? Ek line mein shukriya bolo!'], 'chill', 0],
      [40, 'Wrap-up', [`Bas itna hi aaj ke liye, ${v.a}. Happy weekend, aur Monday ko phir milte hain!`], 'chill', 0]],
    morning: v => [
      [0, 'Good morning', [`Good morning, ${v.a}! Chai side mein rakho, 10 minute sirf energy ke liye.`], 'chill', 0],
      [1, 'Stretch', ['Gardan dheere se left, phir right. Kandhe ghumao. Gehri saans lo.'], 'chill', 120],
      [3, 'Zumba', ['Ab 5 minute Zumba! Steps simple hain, bas music ke saath chalo!'], 'hype', 300],
      [8, 'Breathing', ['Aankhein band. 4 second saans andar, 4 second roko, 4 second bahar. Teen baar.'], 'chill', 60],
      [9, 'Focus', [`Aaj ka goal: ${v.c}. ${v.b} ke saath, chalo shuru karte hain!`], 'chill', 0]]
  };

  let ev = 'wedding', show = null, si = 0, li = 0, tmr = null, left = 0, style = 'classy';
  try { const s = JSON.parse(localStorage.getItem('jw_anchor') || 'null'); if (s && T[s.ev]) { ev = s.ev; show = s; } } catch (e) {}

  const root = document.createElement('main'); root.className = 'anchor'; root.id = 'anchor'; root.setAttribute('aria-label', 'Anchor mode');
  root.innerHTML = `
  <div class="acol">
    <section class="ac"><h3>🎤 Plan the event <span>1 · choose</span></h3><div class="evs" id="a-evs"></div>
      <div class="qf" id="a-qf"></div>
      <div class="qf" style="margin-top:10px"><div class="row2"><label>Starts at<input id="a-time" type="time" value="19:30"></label>
        <label>Host voice<select id="a-voice"><option value="f">Female</option><option value="m">Male</option></select></label></div>
        <label>Style<div class="chipsx" id="a-style"><button type="button" data-s="classy">Classy</button><button type="button" data-s="masti">Masti</button><button type="button" data-s="corporate">Corporate</button></div></label>
        <button class="bigb" id="a-build" type="button">✨ Build my show</button></div>
      <p class="note2">You read the line from the screen; the Booth plays the music cue and the JHOOMWAVE studio voice where a line is recorded. Studio voice for every script line (and Punjabi) is coming next.</p></section>
  </div>
  <div class="acol">
    <section class="ac tele"><span class="seg" id="a-seg">No show yet</span><p class="line" id="a-line">Pick an event, fill the names and tap "Build my show".</p>
      <div class="meta"><span id="a-at">—</span><span id="a-mus">—</span><span id="a-pos">—</span></div>
      <div class="timer" id="a-timer"><span>⏱ Activity timer</span><b id="a-tl">0:00</b><button class="ghostb" id="a-tgo" type="button">Start</button></div>
      <div class="ctl3"><button type="button" id="a-prev">⏮ Back</button><button type="button" class="say" id="a-say">🎬 Cue it</button><button type="button" id="a-next">Next ⏭</button></div></section>
    <section class="ac"><h3>📋 Run of show <span><button class="ghostb" id="a-print-b" type="button" style="height:32px">🖨 Print / PDF</button></span></h3><ol class="ros" id="a-ros"></ol></section>
  </div>
  <div id="a-print"></div>`;
  const booth = document.getElementById('booth'); booth.parentNode.insertBefore(root, booth);

  function renderEv() {
    $('a-evs').innerHTML = '';
    Object.entries(EV).forEach(([k, o]) => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-pressed', k === ev); b.innerHTML = `${o.t}<small>${o.d}</small>`; b.addEventListener('click', () => { ev = k; renderEv(); setStyle(k === 'friday' || k === 'morning' ? 'corporate' : k === 'sangeet' ? 'masti' : 'classy'); }); $('a-evs').append(b); });
    $('a-qf').innerHTML = '';
    EV[ev].q.forEach(([k, l, ph]) => { const lab = document.createElement('label'); lab.textContent = l; const i = document.createElement('input'); i.id = 'a-q-' + k; i.placeholder = ph; i.maxLength = 120; if (show && show.ev === ev && show.v[k]) i.value = show.v[k]; lab.append(i); $('a-qf').append(lab); });
  }
  function setStyle(s) { style = s; document.querySelectorAll('#a-style button').forEach(b => b.setAttribute('aria-pressed', b.dataset.s === s)); const vp = window.jwVP; if (vp) vp.tone = s === 'masti' ? 'hype' : 'smooth'; }
  document.querySelectorAll('#a-style button').forEach(b => b.addEventListener('click', () => setStyle(b.dataset.s)));
  const hm = (start, min) => { const [h, m] = (start || '19:30').split(':').map(Number); const d = new Date(2000, 0, 1, h, m + min); return d.toTimeString().slice(0, 5); };
  const MUS = { chill: '😌 Chill music', hype: '🔥 Hype music', entry: '💥 Entry beat', none: '🔇 Music low' };

  function build() {
    const v = {}; EV[ev].q.forEach(([k, , ph]) => { v[k] = ($('a-q-' + k).value || '').trim() || ph; });
    show = { ev, v, start: $('a-time').value, segs: T[ev](v) }; si = 0; li = 0;
    try { localStorage.setItem('jw_anchor', JSON.stringify(show)); } catch (e) {}
    if (ev === 'wedding' || ev === 'sangeet') { const n = $('ent-name'); if (n) { n.value = `${v.a} & ${v.b}`; $('name-save') && $('name-save').click(); } }
    if (window.jwVP) { window.jwVP.gender = $('a-voice').value; }
    renderRos(); paint(); if (innerWidth < 900) document.getElementById('a-seg').scrollIntoView({ behavior: 'smooth', block: 'start' }); try { window.track && track('anchor_build', { ev }); } catch (e) {}
  }
  function renderRos() {
    $('a-ros').innerHTML = ''; if (!show) return;
    show.segs.forEach((g, i) => { const l = document.createElement('li'); l.className = i < si ? 'done' : i === si ? 'cur' : ''; l.innerHTML = '<span class="t"></span><b></b><small></small>';
      l.querySelector('.t').textContent = hm(show.start, g[0]); l.querySelector('b').textContent = g[1]; l.querySelector('small').textContent = MUS[g[3]].split(' ')[0] + (g[4] ? ' ⏱' : '');
      l.addEventListener('click', () => { si = i; li = 0; renderRos(); paint(); }); $('a-ros').append(l); });
    $('a-print').innerHTML = `<h1>JHOOMWAVE · ${EV[show.ev].t}</h1>` + show.segs.map(g => `<h3>${hm(show.start, g[0])} · ${g[1]} (${MUS[g[3]]})</h3>` + g[2].map(x => `<p>${x.replace(/</g, '&lt;')}</p>`).join('')).join('');
  }
  function paint() {
    if (!show) return; const g = show.segs[si];
    $('a-seg').textContent = `${g[1].toUpperCase()} · ${si + 1}/${show.segs.length}`; $('a-line').textContent = g[2][li];
    $('a-at').textContent = '🕒 ' + hm(show.start, g[0]); $('a-mus').textContent = MUS[g[3]]; $('a-pos').textContent = `Line ${li + 1}/${g[2].length}`;
    $('a-timer').classList.toggle('on', !!g[4]); if (g[4] && !tmr) { left = g[4]; $('a-tl').textContent = fmt(left); }
  }
  const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  function cue(g) {
    const click = id => { const b = $(id); if (b) b.click(); };
    if (g[3] === 'hype') click('hype'); else if (g[3] === 'chill') click('chill');
    else if (g[3] === 'entry') { const t = document.querySelector('#ent-btns button'); if (t) t.click(); }
  }
  function sayLine() { if (!show) return; const g = show.segs[si]; if (li === 0) cue(g); if (g[3] === 'entry') return; window.jwSpeak && window.jwSpeak(g[2][li], {}); }
  function step(d) {
    if (!show) return; const g = show.segs[si];
    if (d > 0) { if (li < g[2].length - 1) li++; else if (si < show.segs.length - 1) { si++; li = 0; stopT(); } }
    else { if (li > 0) li--; else if (si > 0) { si--; li = show.segs[si][2].length - 1; stopT(); } }
    renderRos(); paint();
  }
  function stopT() { clearInterval(tmr); tmr = null; $('a-tgo').textContent = 'Start'; }
  $('a-tgo').addEventListener('click', () => { if (tmr) { stopT(); return; } $('a-tgo').textContent = 'Pause'; tmr = setInterval(() => { left = Math.max(0, left - 1); $('a-tl').textContent = fmt(left); if (!left) { stopT(); const h = $('fx-horn'); if (h) h.click();  } }, 1000); });
  $('a-build').addEventListener('click', build);
  $('a-say').addEventListener('click', sayLine);
  $('a-next').addEventListener('click', () => step(1)); $('a-prev').addEventListener('click', () => step(-1));
  $('a-print-b').addEventListener('click', () => { if (show) window.print(); });
  addEventListener('keydown', e => { if (!document.body.classList.contains('mode-anchor') || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return; if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); if (e.key === 'Enter') sayLine(); });

  // mode switch: Party / Anchor / Pro
  function setMode(m) {
    document.body.classList.toggle('mode-anchor', m === 'anchor');
    if (m === 'anchor') document.body.classList.remove('easy');
    ['easy', 'anchor', 'pro'].forEach(k => { const b = $('ms-' + k); if (b) b.setAttribute('aria-pressed', k === m); });
    try { localStorage.setItem('jw_mode', m); } catch (e) {}
  }
  $('ms-anchor').addEventListener('click', () => { setMode('anchor'); try { window.track && track('console_anchor'); } catch (e) {} });
  $('ms-easy').addEventListener('click', () => setMode('easy'));
  $('ms-pro').addEventListener('click', () => setMode('pro'));
  let m0 = 'easy'; try { m0 = localStorage.getItem('jw_mode') || 'easy'; } catch (e) {}
  if (m0 === 'anchor') setMode('anchor');
  renderEv(); setStyle(ev === 'friday' || ev === 'morning' ? 'corporate' : 'classy'); if (show) { renderRos(); paint(); }
})();
