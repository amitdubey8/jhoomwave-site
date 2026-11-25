/* JHOOMWAVE wish pages: the couple's private "thank you" mode.
   Opens only with the private link ?k=SECRET. Lets the couple approve/hide wishes, reply to each one,
   set one general thank-you note for everyone, and make a Thank You card with all names. */
(function () {
  var me = document.currentScript, SLUG = me && me.getAttribute('data-slug');
  var key = new URLSearchParams(location.search).get('k');
  if (!SLUG || !key || key.length < 16) return;
  var SB = 'https://srcclctqfkagpolhocqf.supabase.co/rest/v1/rpc/';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyY2NsY3RxZmthZ3BvbGhvY3FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU1NDY1OTYsImV4cCI6MjExMTEyMjU5Nn0.0_T3iBE2ssrABWWbL8hkLqOOvpany5uP2LSFlhi0G54';
  function rpc(fn, body) { return fetch(SB + fn, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + KEY }, body: JSON.stringify(body) }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
  function el(tag, attrs, kids) { var e = document.createElement(tag); for (var k in (attrs || {})) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'on') e.addEventListener('click', attrs[k]); else e.setAttribute(k, attrs[k]); } (kids || []).forEach(function (c) { if (c) e.append(c); }); return e; }

  var css = '.ow{margin:18px 0;padding:20px 18px;border-radius:22px;background:rgb(10 4 20/.55);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgb(255 209 102/.35);box-shadow:0 20px 50px rgb(0 0 0/.35);color:#FFF8F0;font-family:Poppins,system-ui,sans-serif}'
    + '.ow .eb{display:inline-flex;align-items:center;gap:6px;font:700 10.5px/1 Poppins;letter-spacing:2.4px;text-transform:uppercase;color:#1C0B33;background:linear-gradient(90deg,#FFE29A,#FFB347);padding:6px 10px;border-radius:99px}'
    + '.ow h2{margin:12px 0 4px;font:400 28px/1.25 "Tiro Devanagari Hindi",serif;color:#fff}.ow .s{margin:0 0 6px;font-size:13px;opacity:.7;line-height:1.5}'
    + '.ow .st{display:flex;align-items:center;gap:10px;margin:26px 0 10px;font:700 15px/1.3 Poppins,"Tiro Devanagari Hindi",sans-serif}.ow .st i{font-style:normal;flex:none;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font:700 12px Poppins;color:#1C0B33;background:#FFD166}'
    + '.ow textarea,.ow input{width:100%;box-sizing:border-box;border-radius:12px;border:1px solid rgb(255 255 255/.18);background:rgb(255 255 255/.05);color:#fff;font:400 16px/1.55 Poppins,"Tiro Devanagari Hindi",sans-serif;padding:11px 13px;margin:6px 0 10px;outline:none;transition:border-color .2s}.ow textarea:focus,.ow input:focus{border-color:#FFD166}'
    + '.ow textarea{min-height:84px;resize:vertical}'
    + '.ow .chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}.ow .chips button{flex:none;border:1px solid rgb(255 255 255/.2);background:transparent;color:#fff;border-radius:99px;padding:7px 13px;font:500 13px Poppins,"Tiro Devanagari Hindi",sans-serif;cursor:pointer;transition:all .2s}.ow .chips button:hover,.ow .chips button.on{border-color:#FFD166;background:rgb(255 209 102/.12)}'
    + '.ow .go{display:block;width:100%;border:0;border-radius:12px;padding:13px;font:700 15px Poppins,"Tiro Devanagari Hindi",sans-serif;cursor:pointer;background:linear-gradient(90deg,#FFD166,#FF8A00);color:#1C0B33;text-align:center;text-decoration:none}.ow .go.ghost{background:transparent;color:#fff;border:1px solid rgb(255 255 255/.25);margin-top:8px}.ow .go.alt{background:#1FAF5A;color:#fff;margin-top:8px}'
    + '.ow .w{padding:14px 0;border-top:1px solid rgb(255 255 255/.08)}.ow .w p{margin:0;font:400 17px/1.6 "Tiro Devanagari Hindi",serif}.ow .w .who{display:flex;align-items:center;gap:8px;margin-top:4px;font:600 13px Poppins,"Tiro Devanagari Hindi",sans-serif;opacity:.85}'
    + '.ow .tag{font:700 10px/1 Poppins;letter-spacing:1.2px;text-transform:uppercase;padding:4px 8px;border-radius:99px;border:1px solid rgb(255 255 255/.25)}.ow .tag.ok2{border-color:#7CF29A;color:#7CF29A}.ow .tag.wait{border-color:#FFD166;color:#FFD166}'
    + '.ow .w .row{display:flex;gap:8px;flex-wrap:wrap}.ow .w .row button{border:1px solid rgb(255 255 255/.22);background:transparent;color:#fff;border-radius:10px;padding:8px 12px;font:600 13px Poppins,"Tiro Devanagari Hindi",sans-serif;cursor:pointer}.ow .w .row button.pri{background:#FFD166;border-color:#FFD166;color:#1C0B33}'
    + '.ow .ok{color:#7CF29A;font-size:13px;min-height:18px;margin:6px 0 0}'
    + '.ow canvas{width:100%;height:auto;border-radius:14px;margin-top:12px;display:none;box-shadow:0 10px 30px rgb(0 0 0/.4)}';
  document.head.append(el('style', { text: css }));

  var THANKS = [
    'आप सभी की शुभकामनाओं और आशीर्वाद के लिए दिल से धन्यवाद 🙏❤️ आपका प्यार ही हमारी सबसे बड़ी ताक़त है।',
    'Thank you so much everyone! आपके प्यार ने हमारा दिन और भी खास बना दिया 💐❤️',
    'बड़ों का आशीर्वाद और छोटों का प्यार, सब सिर आँखों पर 🙏 बहुत-बहुत धन्यवाद!',
    'आप सबकी दुआओं से ही ये जोड़ी सलामत है ❤️ हमेशा यूँ ही साथ रहिए 🙏'];
  var REPLIES = ['धन्यवाद 🙏', 'Thank you so much ❤️', 'आपका आशीर्वाद सिर आँखों पर 🙏', 'बहुत-बहुत शुक्रिया', 'Love you ❤️'];

  var box = el('section', { class: 'ow', 'aria-label': 'Couple mode' });
  var anchor = document.getElementById('bless');
  if (anchor) anchor.parentNode.insertBefore(box, anchor); else document.body.append(box);
  box.append(el('span', { class: 'eb', text: 'Private · Couple mode' }), el('h2', { text: 'सबको धन्यवाद कहिए' }), el('p', { class: 's', text: 'यह हिस्सा सिर्फ़ आपको दिखता है। यह प्राइवेट लिंक किसी से शेयर न करें।' }));

  function step(n, t) { return el('div', { class: 'st' }, [el('i', { text: String(n) }), document.createTextNode(t)]); }
  var data = null;
  function load() { return rpc('wish_owner_list', { p_slug: SLUG, p_key: key }).then(function (d) { if (!d) { box.append(el('p', { class: 's', text: 'यह प्राइवेट लिंक सही नहीं है।' })); return; } data = d; render(); }); }

  function render() {
    while (box.children.length > 2) box.lastChild.remove();
    // 1) general thank-you
    var ta = el('textarea', { maxlength: '400', placeholder: 'सबके लिए अपना धन्यवाद लिखिए…' }); ta.value = data.thanks || '';
    var ok1 = el('p', { class: 'ok', role: 'status' });
    var chips = el('div', { class: 'chips' }, THANKS.map(function (t) { return el('button', { type: 'button', text: ['आभार', 'Thank you all', 'बड़ों का आशीर्वाद', 'दुआओं से'][THANKS.indexOf(t)], on: function (e) { ta.value = t; [].forEach.call(e.target.parentNode.children, function (x) { x.classList.remove('on'); }); e.target.classList.add('on'); } }); }));
    box.append(step(1, 'सबके लिए एक धन्यवाद'), el('p', { class: 's', text: 'पेज पर सबसे ऊपर दिखेगा। तैयार संदेश चुनें या अपने शब्दों में लिखें।' }), chips, ta,
      el('button', { class: 'go', type: 'button', text: 'पेज पर लगाएँ', on: function () { ok1.textContent = 'सेव हो रहा है…'; rpc('wish_owner_act', { p_slug: SLUG, p_key: key, p_id: 0, p_action: 'thanks', p_text: ta.value }).then(function (r) { ok1.textContent = r && r.ok ? 'पेज पर लग गया। सब देख पाएँगे।' : 'नहीं हो पाया, दोबारा कोशिश करें'; }); } }), ok1);

    // 2) each wish
    var list = data.blessings || [];
    box.append(step(2, 'हर शुभकामना का जवाब · ' + list.length));
    if (!list.length) box.append(el('p', { class: 's', text: 'अभी कोई शुभकामना नहीं आई। लिंक ग्रुप में शेयर कीजिए।' }));
    list.forEach(function (b) {
      var st = el('p', { class: 'ok', role: 'status' });
      var inp = el('input', { maxlength: '200', placeholder: 'अपना जवाब लिखें' }); inp.value = b.reply || '';
      var tag = b.hidden ? el('span', { class: 'tag', text: 'Hidden' }) : (b.approved ? el('span', { class: 'tag ok2', text: 'Live' }) : el('span', { class: 'tag wait', text: 'Needs approval' }));
      var act = function (a, txt) { st.textContent = '…'; return rpc('wish_owner_act', { p_slug: SLUG, p_key: key, p_id: b.id, p_action: a, p_text: txt || null }).then(function (r) { if (r && r.ok) { if (a === 'approve') { b.approved = true; b.hidden = false; } if (a === 'hide') b.hidden = true; if (a === 'reply') { b.reply = txt; b.approved = true; b.hidden = false; } render(); } else st.textContent = 'नहीं हो पाया'; }); };
      box.append(el('div', { class: 'w' }, [
        el('p', { text: b.msg }), el('div', { class: 'who' }, [el('span', { translate: 'no', class: 'notranslate', text: '— ' + b.name }), tag]),
        el('div', { class: 'chips', style: 'margin-top:8px' }, REPLIES.map(function (r) { return el('button', { type: 'button', text: r, on: function () { inp.value = r; } }); })),
        inp,
        el('div', { class: 'row' }, [
          el('button', { type: 'button', class: 'pri', text: 'जवाब भेजें', on: function () { if (inp.value.trim()) act('reply', inp.value.trim()); } }),
          b.approved && !b.hidden ? null : el('button', { type: 'button', text: 'सबको दिखाएँ', on: function () { act('approve'); } }),
          b.hidden ? null : el('button', { type: 'button', text: 'छुपाएँ', on: function () { act('hide'); } })]), st]));
    });

    // 3) thank-you card with all names
    var auto = []; list.forEach(function (b) { if (!b.hidden && auto.indexOf(b.name) < 0) auto.push(b.name); });
    var extra = el('textarea', { placeholder: 'ग्रुप में विश करने वालों के नाम जोड़ें, कॉमा लगाकर' });
    var cv = el('canvas', { width: '1080', height: '1350' });
    var dl = el('a', { class: 'go ghost', style: 'display:none', download: 'Thank_You_' + SLUG + '.jpg', text: 'कार्ड डाउनलोड करें' });
    var wa = el('a', { class: 'go alt', style: 'display:none', target: '_blank', rel: 'noopener', text: 'WhatsApp पर भेजें' });
    box.append(step(3, 'सबके नाम वाला Thank You कार्ड'),
      el('p', { class: 's', text: auto.length ? ('पेज से अपने आप जुड़े नाम: ' + auto.join(', ')) : 'पेज पर अभी कोई नाम नहीं। ग्रुप वालों के नाम नीचे जोड़िए।' }), extra,
      el('button', { class: 'go', type: 'button', text: 'कार्ड बनाइए', on: function () {
        var more = extra.value.split(/[,\n]/).map(function (s) { return s.trim(); }).filter(Boolean);
        var names = auto.concat(more.filter(function (n) { return auto.indexOf(n) < 0; }));
        if (!names.length) { extra.focus(); return; }
        drawCard(cv, names, (ta.value || THANKS[0]), data.couple || '').then(function () {
          cv.style.display = 'block'; dl.href = cv.toDataURL('image/jpeg', 0.92); dl.style.display = 'block';
          var msg = '🙏💐 *दिल से धन्यवाद!* 💐🙏\n\n' + (ta.value || THANKS[0]) + '\n\n❤️ ' + names.join(', ') + '\n\n– ' + (data.couple || '') + '\n\n🎵 Made with love by JHOOMWAVE · jhoomwave.com';
          wa.href = 'https://wa.me/?text=' + encodeURIComponent(msg); wa.style.display = 'block';
        });
      } }), cv, dl, wa);
  }

  function wrap(ctx, text, maxW) { var words = text.split(' '), lines = [], cur = ''; words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }); if (cur) lines.push(cur); return lines; }
  function drawCard(cv, names, thanks, couple) {
    var fonts = ['400 60px "Tiro Devanagari Hindi"', '900 60px Poppins', '700 40px Poppins'];
    return Promise.all(fonts.map(function (f) { return document.fonts ? document.fonts.load(f) : Promise.resolve(); })).catch(function () {}).then(function () {
      var c = cv.getContext('2d'), W = 1080, H = 1350;
      var g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#3A106E'); g.addColorStop(0.55, '#1C0B33'); g.addColorStop(1, '#5A0E3C'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      for (var i = 0; i < 70; i++) { c.fillStyle = ['rgba(255,209,102,.25)', 'rgba(255,46,136,.22)', 'rgba(255,255,255,.18)'][i % 3]; c.beginPath(); c.arc(Math.random() * W, Math.random() * H, 4 + Math.random() * 22, 0, 7); c.fill(); }
      for (var x = 0; x < W + 40; x += 44) { var y = 6 + 22 * Math.sin(Math.PI * (x % 440) / 440); for (var k = 0; k < 2; k++) { c.fillStyle = (x / 44 + k) % 2 ? '#FF8A00' : '#FFC400'; c.beginPath(); c.arc(x, y + k * 30, 17, 0, 7); c.fill(); } }
      c.textAlign = 'center'; c.fillStyle = '#FFD166'; c.font = '400 96px "Tiro Devanagari Hindi", serif'; c.fillText('दिल से धन्यवाद', W / 2, 200);
      c.fillStyle = '#FF5CA8'; c.font = '900 52px Poppins, sans-serif'; c.fillText('Thank You! 🙏', W / 2, 275);
      c.fillStyle = '#FFF8F0'; c.font = '400 40px "Tiro Devanagari Hindi", serif';
      var ly = 350; wrap(c, thanks, 900).slice(0, 4).forEach(function (l) { c.fillText(l, W / 2, ly); ly += 56; });
      // names
      var top = ly + 30, bottom = 1130, size = 44, rows;
      size = 52; do { c.font = '400 ' + size + 'px "Tiro Devanagari Hindi", serif'; rows = wrap(c, names.join('  ·  '), 900); if (rows.length * size * 1.45 + 50 <= bottom - top) break; size -= 2; } while (size > 22);
      var bh = rows.length * size * 1.45 + 50, by = top + Math.max(0, (bottom - top - bh) / 2);
      c.fillStyle = 'rgba(255,255,255,.07)'; c.beginPath(); if (c.roundRect) c.roundRect(60, by, W - 120, bh, 28); else c.rect(60, by, W - 120, bh); c.fill();
      c.strokeStyle = 'rgba(255,209,102,.45)'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#FFD166'; var ny = by + 25 + size; rows.forEach(function (r) { c.fillText(r, W / 2, ny); ny += size * 1.45; });
      c.fillStyle = '#FFF8F0'; c.font = '400 46px "Tiro Devanagari Hindi", serif'; c.fillText('– ' + couple + ' ❤️', W / 2, 1210);
      var bg = c.createLinearGradient(380, 0, 700, 0); bg.addColorStop(0, '#B98CFF'); bg.addColorStop(0.5, '#FF2E88'); bg.addColorStop(1, '#FF8A00');
      c.fillStyle = bg; c.font = '900 40px Poppins, sans-serif'; c.fillText('JHOOMWAVE', W / 2, 1290);
      c.fillStyle = 'rgba(255,255,255,.75)'; c.font = '600 24px Poppins, sans-serif'; c.fillText('jhoomwave.com', W / 2, 1325);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
})();
