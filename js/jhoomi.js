/* Jhoomi: JHOOMWAVE's multilingual welcome guide. Pre-recorded voice (synthetic, labelled), no network calls,
   no tracking of what people type. Also provides window.jwSolo(media) so only one sound plays at a time. */
(function () {
  let solo = null;
  window.jwSolo = function (m) { if (solo && solo !== m) { try { solo.pause(); } catch (e) {} } solo = m; };

  if (document.body.dataset.nojhoomi !== undefined) return;
  const L = {
    hi: { n: 'हिंदी', hello: 'Namaste! Main Jhoomi hoon, JHOOMWAVE ki aawaz. Yahan aapke naam ka gaana banta hai. Kuch bhi poochiye!', a: 'hi' },
    en: { n: 'English', hello: "Hi! I'm Jhoomi, the voice of JHOOMWAVE. We make songs with your name in them. Ask me anything!", a: 'en' },
    pa: { n: 'ਪੰਜਾਬੀ', hello: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ ਜੀ! ਮੈਂ ਝੂਮੀ ਹਾਂ, JHOOMWAVE ਦੀ ਆਵਾਜ਼। ਇੱਥੇ ਤੁਹਾਡੇ ਨਾਮ ਦਾ ਗੀਤ ਬਣਦਾ ਹੈ। ਕੁਝ ਵੀ ਪੁੱਛੋ!', a: 'hi' },
    mr: { n: 'मराठी', hello: 'नमस्कार! मी झूमी, JHOOMWAVE चा आवाज. इथे तुमच्या नावाचं गाणं बनतं. काहीही विचारा!', a: 'hi' },
    gu: { n: 'ગુજરાતી', hello: 'નમસ્તે! હું ઝૂમી છું, JHOOMWAVE નો અવાજ. અહીં તમારા નામનું ગીત બને છે. કંઈ પણ પૂછો!', a: 'hi' },
    bn: { n: 'বাংলা', hello: 'নমস্কার! আমি ঝুমি, JHOOMWAVE-এর কণ্ঠ। এখানে আপনার নামে গান তৈরি হয়। যা খুশি জিজ্ঞেস করুন!', a: 'en' },
    ta: { n: 'தமிழ்', hello: 'வணக்கம்! நான் ஜூமி, JHOOMWAVE-இன் குரல். இங்கே உங்கள் பெயரில் பாடல் உருவாகும். எதுவும் கேளுங்கள்!', a: 'en' },
    te: { n: 'తెలుగు', hello: 'నమస్కారం! నేను ఝూమి, JHOOMWAVE గొంతు. ఇక్కడ మీ పేరుతో పాట తయారవుతుంది. ఏదైనా అడగండి!', a: 'en' }
  };
  const Q = {
    hi: [
      ['JHOOMWAVE kya hai?', 'JHOOMWAVE aapke apno ke liye gaana banata hai, unke naam aur kahani ke saath. Birthday, shaadi, anniversary, bacchon ki lori, sab kuch.'],
      ['Order kaise karein?', 'Bas teen step. Naam aur kahani batao, free preview suno, aur pasand aaye tabhi lo. "Make my song" dabaiye, ya Instagram pe DM kijiye.'],
      ['Kitne ka hai?', 'Ready songs ₹9 se, naam wala gaana ₹99 se, aur shaadi ki entry ₹299 mein. Preview hamesha free hai.'],
      ['Kitna time lagta hai?', 'Zyada tar gaane kuch hi minute mein ready ho jaate hain. Bade wedding packs mein thoda zyada time lag sakta hai.'],
      ['Gaata kaun hai?', 'Gaane JHOOMWAVE Voices gaate hain, yaani hamari synthetic aawazein. Lyrics hum khud likhte hain, kisi ka gaana copy nahi karte.'],
      ['Kaunsi bhasha?', 'Gaane Hindi, Hinglish, Punjabi aur English mein bante hain. Baaki bhashaon ke liye humein message kijiye.']],
    en: [
      ['What is JHOOMWAVE?', 'JHOOMWAVE makes songs for the people you love, with their name and their story. Birthdays, weddings, anniversaries, lullabies and more.'],
      ['How do I order?', 'Just three steps. Tell us the name and the story, hear a free preview, and pay only if you love it. Tap "Make my song", or message us on Instagram.'],
      ['How much?', 'Ready songs start at ₹9, a name song at ₹99, and a wedding entry at ₹299. The preview is always free.'],
      ['How long does it take?', 'Most songs are ready in a few minutes. Big wedding packs can take a little longer.'],
      ['Who sings?', "Songs are sung by JHOOMWAVE Voices, our synthetic voices. We write every lyric ourselves and never copy anyone's song."],
      ['Which languages?', 'We make songs in Hindi, Hinglish, Punjabi and English. Message us for other languages.']]
  };
  const KEYS = [/kya|what|about|hai kya|jhoomwave/i, /order|kaise|how do|buy|book|khareed|banwa/i, /price|kitne|cost|rate|₹|rs|paisa|charge|kitna paisa/i,
    /time|kab|kitni der|how long|minute|jaldi|fast/i, /sing|gaata|gaati|voice|aawaz|awaaz|ai|real/i, /language|bhasha|hindi|english|punjabi|tamil|marathi|gujarati|bengali|telugu/i];

  const pick = () => {
    try { const s = localStorage.getItem('jw_lang'); if (s && L[s]) return s; } catch (e) {}
    const n = (navigator.language || 'hi').toLowerCase().slice(0, 2);
    return L[n] ? n : (n === 'en' ? 'en' : 'hi');
  };
  let lang = pick();
  const BARS = '<i></i><i></i><i></i><i></i><i></i>';
  const face = `<span class="jh-face" aria-hidden="true"><span class="jh-eyes"><b></b><b></b></span><span class="jh-bars">${BARS}</span></span>`;

  const root = document.createElement('div');
  root.className = 'jh';
  root.innerHTML = `
  <div class="jh-bub" hidden><button class="jh-x" type="button" aria-label="Close">×</button><p></p><button class="jh-hear" type="button">▶ <span>Suno</span></button></div>
  <section class="jh-pan" hidden role="dialog" aria-label="Jhoomi, JHOOMWAVE guide">
    <header>${face}<div><b>Jhoomi</b><small>JHOOMWAVE ki aawaz · voice guide</small></div><button class="jh-x2" type="button" aria-label="Close">×</button></header>
    <div class="jh-langs" role="group" aria-label="Language"></div>
    <div class="jh-msg" aria-live="polite"></div>
    <div class="jh-qs"></div>
    <form class="jh-ask"><input maxlength="120" placeholder="Kuch bhi poochho… / Ask anything…" aria-label="Ask Jhoomi"><button type="submit" aria-label="Ask">➜</button></form>
    <p class="jh-note">Jhoomi speaks with a JHOOMWAVE synthetic voice and answers common questions. For anything else: <a href="https://www.instagram.com/jhoomwave/" target="_blank" rel="noopener">DM @jhoomwave</a></p>
  </section>
  <button class="jh-btn" type="button" aria-label="Open Jhoomi, voice guide" aria-expanded="false">${face}<em>Jhoomi</em></button>`;
  document.body.append(root);
  const $ = s => root.querySelector(s);
  const btn = $('.jh-btn'), pan = $('.jh-pan'), bub = $('.jh-bub'), msg = $('.jh-msg');

  const audio = new Audio(); audio.preload = 'none';
  let ctx = null, an = null, raf = 0;
  function meter() {
    const bars = root.querySelectorAll('.jh-bars i');
    if (!an) { root.classList.toggle('talk', !audio.paused); return; }
    const d = new Uint8Array(an.frequencyBinCount);
    const loop = () => {
      an.getByteFrequencyData(d);
      bars.forEach((b, i) => { const v = d[2 + i * 4] / 255; b.style.transform = `scaleY(${0.25 + v * 1.1})`; });
      if (!audio.paused) raf = requestAnimationFrame(loop); else bars.forEach(b => (b.style.transform = ''));
    };
    cancelAnimationFrame(raf); loop();
  }
  function say(src, text) {
    if (text) { msg.textContent = text; msg.hidden = false; }
    try {
      if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; ctx = new C(); const s = ctx.createMediaElementSource(audio); an = ctx.createAnalyser(); an.fftSize = 64; s.connect(an); an.connect(ctx.destination); }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { an = null; }
    audio.src = src; audio.currentTime = 0;
    window.jwSolo(audio);
    audio.play().then(() => { root.classList.add('talk'); meter(); }).catch(() => {});
  }
  audio.addEventListener('pause', () => root.classList.remove('talk'));
  audio.addEventListener('ended', () => root.classList.remove('talk'));

  function render() {
    const lg = L[lang], qs = Q[lg.a];
    $('.jh-langs').innerHTML = '';
    Object.entries(L).forEach(([k, v]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = v.n; b.setAttribute('aria-pressed', k === lang);
      b.addEventListener('click', () => { lang = k; try { localStorage.setItem('jw_lang', k); } catch (e) {} render(); say(`/audio/jhoomi/hello_${k}.mp3`, L[k].hello); });
      $('.jh-langs').append(b);
    });
    msg.textContent = lg.hello;
    $('.jh-qs').innerHTML = '';
    qs.forEach(([q, ans], i) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = q;
      b.addEventListener('click', () => { say(`/audio/jhoomi/q${i + 1}_${lg.a}.mp3`, ans); try { window.track && track('jhoomi_q', { q: i + 1, lang }); } catch (e) {} });
      $('.jh-qs').append(b);
    });
    bub.querySelector('p').textContent = lg.hello;
    bub.querySelector('.jh-hear span').textContent = lg.a === 'hi' ? 'Suno' : 'Listen';
  }
  function open(o) {
    pan.hidden = !o; bub.hidden = true; btn.setAttribute('aria-expanded', o); root.classList.toggle('open', o);
    if (!o) audio.pause();
  }
  btn.addEventListener('click', () => {
    const o = pan.hidden; open(o);
    if (o) say(`/audio/jhoomi/hello_${lang}.mp3`, L[lang].hello);
  });
  $('.jh-x2').addEventListener('click', () => open(false));
  $('.jh-x').addEventListener('click', () => { bub.hidden = true; try { sessionStorage.setItem('jw_bub', '1'); } catch (e) {} });
  $('.jh-hear').addEventListener('click', () => { open(true); say(`/audio/jhoomi/hello_${lang}.mp3`, L[lang].hello); });
  $('.jh-ask').addEventListener('submit', e => {
    e.preventDefault();
    const inp = $('.jh-ask input'), t = inp.value.trim(); if (!t) return;
    const qs = Q[L[lang].a], i = KEYS.findIndex(r => r.test(t));
    if (i >= 0) say(`/audio/jhoomi/q${i + 1}_${L[lang].a}.mp3`, qs[i][1]);
    else { msg.innerHTML = ''; msg.append(L[lang].a === 'hi' ? 'Iska jawab main abhi nahi jaanti. Hamari team Instagram pe turant batayegi: ' : "I don't know that one yet. Our team will answer on Instagram: ");
      const a = document.createElement('a'); a.href = 'https://www.instagram.com/jhoomwave/'; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'DM @jhoomwave'; msg.append(a); }
    inp.value = '';
  });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !pan.hidden) open(false); });
  render();
  let seen = false; try { seen = !!sessionStorage.getItem('jw_bub'); } catch (e) {}
  if (!seen) setTimeout(() => { if (pan.hidden) { bub.hidden = false; try { sessionStorage.setItem('jw_bub', '1'); } catch (e) {} } }, 2500);
})();
