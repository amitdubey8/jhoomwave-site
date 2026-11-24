/* JHOOMWAVE Booth: "Add your songs". Songs the user owns are analysed in this browser (nothing is uploaded):
   tempo + beat grid, where the loud part starts (long intros are skipped), loudness/energy and a waveform.
   Then they join the set and the DJ mixes them like its own tracks. Runs off the audio graph (no audio-thread work). */
(function () {
  const $ = id => document.getElementById(id);
  const GEN = ["Yeh wala sabko nachayega. Ready?", "Volume full, sharam band. Chalo!", "Haath upar! Shor machao!", "Doston ko bulao, circle banao.",
    "Yeh moment record karo! Phones up!", "Phone torches on. Vibe banao.", "Groove mein raho, drop aa raha hai.", "Sabse tez beat, sabse tez dance!",
    "Thoda chill, phir blast.", "Ek baar aur… zor se!", "Next track, same energy. Bas naacho!"];
  const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);

  function decode(buf) {
    const C = window.OfflineAudioContext || window.webkitOfflineAudioContext; const ctx = new C(1, 2, 44100);
    return new Promise((res, rej) => { const p = ctx.decodeAudioData(buf, res, rej); if (p && p.then) p.then(res, rej); });
  }

  /* tempo + phase: onset envelope (kick band + full band flux), autocorrelation for the coarse tempo,
     then a comb search over tempo and phase for the exact grid. Octave choice prefers 88–135 BPM (Indian party range). */
  function analyse(ab) {
    const sr = ab.sampleRate, c0 = ab.getChannelData(0), c1 = ab.numberOfChannels > 1 ? ab.getChannelData(1) : c0;
    const D = Math.max(1, Math.round(sr / 11025)), fs = sr / D, n = Math.floor(c0.length / D), hop = 256, F = Math.floor(n / hop), fr = fs / hop;
    const lo = new Float32Array(F), full = new Float32Array(F), on = new Float32Array(F), pk = new Float32Array(480);
    const a = 1 - Math.exp(-2 * Math.PI * 150 / fs); let lp = 0;
    for (let f = 0; f < F; f++) { let sl = 0, sf = 0;
      for (let j = 0; j < hop; j++) { const i = (f * hop + j) * D, x = (c0[i] + c1[i]) * .5; lp += a * (x - lp); sl += lp * lp; sf += x * x;
        const b = Math.min(479, Math.floor((f * hop + j) / n * 480)); const ax = Math.abs(x); if (ax > pk[b]) pk[b] = ax; }
      lo[f] = Math.log(1e-9 + sl); full[f] = sf / hop; }
    for (let f = 1; f < F; f++) on[f] = Math.max(0, lo[f] - lo[f - 1]) + .5 * Math.max(0, Math.log(1e-9 + full[f]) - Math.log(1e-9 + full[f - 1]));
    let mean = 0; for (const v of on) mean += v; mean /= F; for (let f = 0; f < F; f++) on[f] = Math.max(0, on[f] - mean);
    const val = t => { const i = t * fr, k = Math.floor(i); return k + 1 < F ? on[k] + (on[k + 1] - on[k]) * (i - k) : 0; };
    // coarse tempo by autocorrelation
    let bestL = 0, bestV = -1; for (let L = Math.floor(60 * fr / 185); L <= Math.ceil(60 * fr / 68); L++) { let v = 0; for (let i = 0; i + L < F; i++) v += on[i] * on[i + L]; v /= (F - L); if (v > bestV) { bestV = v; bestL = L; } }
    const coarse = 60 * fr / bestL;
    // comb score for a tempo: best phase, mean onset on the beats
    function comb(bpm) { const sp = 60 / bpm, dur = F / fr; let best = 0, ph0 = 0;
      for (let k = 0; k < 40; k++) { const ph = sp * k / 40; let v = 0, c = 0; for (let t = ph; t < dur; t += sp) { v += val(t); c++; } v /= c || 1; if (v > best) { best = v; ph0 = ph; } }
      return [best, ph0]; }
    // full scan 78–165 BPM (the autocorrelation guess can land on a 4:5 or 2:3 cousin), then a fine search around the winner
    function scan(lo, hi, step, phases) { let b0 = lo, v0 = -1; for (let b = lo; b <= hi + 1e-9; b += step) { const sp = 60 / b, dur = F / fr; let best = 0;
      for (let k = 0; k < phases; k++) { const ph = sp * k / phases; let v = 0, c = 0; for (let t = ph; t < dur; t += sp) { v += val(t); c++; } v /= c || 1; if (v > best) best = v; }
      const w = best * (b >= 88 && b <= 135 ? 1 : .9); if (w > v0) { v0 = w; b0 = b; } } return [b0, v0]; }
    const [wide] = scan(78, 165, .25, 24);
    let bpm = wide, sc = -1;
    for (const c of [wide, coarse, coarse * 2, coarse / 2, coarse * 1.5, coarse / 1.5, coarse * 1.25, coarse / 1.25].filter(b => b >= 76 && b <= 168)) {
      const [b, v] = scan(c * .985, c * 1.015, .05, 40); if (v > sc) { sc = v; bpm = b; } }
    // precise period: autocorrelation at a 32-beat lag with parabolic interpolation (≈0.05% accuracy)
    { const L = 32 * 60 * fr / bpm, l0 = Math.floor(L) - 4, ac = [];
      for (let l = l0; l <= l0 + 9; l++) { let v = 0; for (let i = 0; i + l < F; i++) v += on[i] * on[i + l]; ac.push(v / (F - l)); }
      let k = 1; for (let i = 1; i < ac.length - 1; i++) if (ac[i] > ac[k]) k = i;
      const y0 = ac[k - 1], y1 = ac[k], y2 = ac[k + 1], d = (y0 - 2 * y1 + y2) ? .5 * (y0 - y2) / (y0 - 2 * y1 + y2) : 0;
      const bp = 32 * 60 * fr / (l0 + k + Math.max(-.5, Math.min(.5, d)));
      if (Math.abs(bp / bpm - 1) < .005) bpm = bp; }
    bpm = Math.round(bpm * 10) / 10; const spb = 60 / bpm;
    /* beat phase from sharp attacks: 5 ms sliding full-band envelope, rising edges, ±4.5 ms per beat, 2 ms phase steps.
       (the 23 ms kick-band envelope above is good for tempo but can lock onto a syncopated dhol hit) */
    const W = Math.max(8, Math.round(fs * .005)), R = Math.round(fs * .0045), cs = new Float64Array(n + 1);
    { let acc = 0, prev = 0; const buf = new Float32Array(W); let bi = 0;
      for (let i = 0; i < n; i++) { const x = (c0[i * D] + c1[i * D]) * .5, q = x * x; acc += q - buf[bi]; buf[bi] = q; bi = (bi + 1) % W;
        const e = Math.sqrt(Math.max(0, acc) / W); cs[i + 1] = cs[i] + Math.max(0, e - prev); prev = e; } }
    let phase = 0, pv = -1; const durS = n / fs;
    for (let ph = 0; ph < spb; ph += .002) { let v = 0;
      for (let t = ph; t < durS - .05; t += spb) { const i = Math.round(t * fs); v += cs[Math.min(n, i + R)] - cs[Math.max(0, i - R)]; }
      if (v > pv) { pv = v; phase = ph; } }
    // where the music really starts: first bar at 35% of the busy bars' energy (silent/ambient intros skipped, max 45 s)
    const bars = []; for (let t = phase; t + 4 * spb < F / fr; t += 4 * spb) { let s = 0, c = 0; for (let f = Math.floor(t * fr); f < Math.floor((t + 4 * spb) * fr); f++) { s += full[f]; c++; } bars.push(s / (c || 1)); }
    const sorted = bars.slice().sort((x, y) => x - y), p75 = sorted[Math.floor(sorted.length * .75)] || 0;
    let cueBar = bars.findIndex(v => v >= .35 * p75); if (cueBar < 0) cueBar = 0; cueBar = Math.min(cueBar, Math.floor(45 / (4 * spb)));
    const cue = phase + cueBar * 4 * spb, offset = Math.max(phase, cue - 16 * spb);
    const busy = bars.filter(v => v >= .6 * p75), pow = busy.reduce((x, y) => x + y, 0) / (busy.length || 1), dB = 10 * Math.log10(pow + 1e-12);
    const energy = +(.61 + .1 * Math.min(1, Math.max(0, (dB + 16) / 8))).toFixed(3);
    const pm = Math.max(...pk) || 1;
    return { bpm, offset: +offset.toFixed(3), cue: +cue.toFixed(2), energy, peaks: Array.from(pk, v => +(v / pm).toFixed(2)), dur: ab.duration, conf: +(sc / (mean || 1)).toFixed(2) };
  }

  async function addFiles(files) {
    const B = window.jwBooth; if (!B) return; const list = [...files].filter(f => /^audio\//.test(f.type) || /\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(f.name));
    if (!list.length) { msg('Those files are not songs. Pick MP3, M4A or WAV files.'); return; }
    let done = 0, added = [];
    for (const f of list) {
      msg(`Listening to "${f.name}" (${done + 1}/${list.length}): finding the beat, the tempo and where it kicks in…`);
      try {
        const ab = await decode(await f.arrayBuffer()); const r = analyse(ab);
        const t = { id: 'u_' + Date.now().toString(36) + done, title: f.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 42) || 'Your song',
          bpm: r.bpm, offset: r.offset, dur: r.dur, key: '—', energy: r.energy, src: URL.createObjectURL(f), peaks: r.peaks, tag: 'Your song', mc: shuffle(GEN).slice(0, 3), user: true };
        B.addTrack(t); added.push(`${t.title} · ${Math.round(t.bpm)} BPM` + (r.cue > 8 ? ` · intro ${Math.round(r.cue)}s skipped` : ''));
      } catch (e) { added.push(`${f.name}: could not read this file`); }
      done++;
    }
    msg('✓ Added: ' + added.join(' | ') + '. They play next, mixed in on the beat.');
    try { window.track && track('console_byo', { n: list.length }); } catch (e) {}
  }
  function msg(t) { document.querySelectorAll('.byo-msg').forEach(m => m.textContent = t); }
  const inp = $('byo-in'); if (!inp) return;
  inp.addEventListener('change', () => { if (inp.files.length) addFiles(inp.files); inp.value = ''; });
  document.querySelectorAll('[data-byo]').forEach(b => b.addEventListener('click', () => inp.click()));
  window.jwAnalyse = analyse; window.jwAddFiles = addFiles;
})();
