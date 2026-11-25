/* Download buttons that work on phones.
   - Inside WhatsApp / Instagram / Facebook in-app browsers downloads are blocked: we explain how to open in Chrome/Safari,
     and still offer to open the file so it can be saved with a long-press.
   - iPhone/iPad: fetch the file and open the share sheet ("Save Video" / "Save Image").
   - Android and desktop: fetch as a blob and save with the right file name. */
(function () {
  var ua = navigator.userAgent || '';
  var inApp = /WhatsApp|Instagram|FBAN|FBAV|FB_IAB|Line\/|Snapchat|wv\)/i.test(ua);
  var iOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var css = '.dlm{position:fixed;inset:0;z-index:9998;display:grid;place-items:end center;background:rgb(0 0 0/.55);padding:16px}'
    + '.dlm .card{width:min(440px,100%);background:#1C0B33;color:#FFF8F0;border:1px solid rgb(255 209 102/.4);border-radius:22px;padding:20px 18px;font:400 16px/1.55 Poppins,"Tiro Devanagari Hindi",system-ui,sans-serif;box-shadow:0 -10px 40px rgb(0 0 0/.4)}'
    + '.dlm h3{margin:0 0 6px;font:700 19px/1.3 Poppins,"Tiro Devanagari Hindi",sans-serif;color:#FFD166}.dlm ol{margin:8px 0 14px;padding-left:20px}.dlm li{margin:4px 0}'
    + '.dlm a,.dlm button{display:block;width:100%;box-sizing:border-box;text-align:center;border:0;border-radius:12px;padding:13px;margin-top:8px;font:700 15px Poppins,"Tiro Devanagari Hindi",sans-serif;cursor:pointer;text-decoration:none}'
    + '.dlm .p{background:#FFD166;color:#1C0B33}.dlm .g{background:transparent;color:#fff;border:1px solid rgb(255 255 255/.25)}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function sheet(html, buttons) {
    var m = document.createElement('div'); m.className = 'dlm'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    var c = document.createElement('div'); c.className = 'card'; c.innerHTML = html; m.appendChild(c);
    buttons.forEach(function (b) { c.appendChild(b); });
    var x = document.createElement('button'); x.className = 'g'; x.type = 'button'; x.textContent = 'बंद करें'; x.onclick = function () { m.remove(); }; c.appendChild(x);
    m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
    document.body.appendChild(m); return m;
  }
  function link(text, href, cls) { var a = document.createElement('a'); a.className = cls; a.textContent = text; a.href = href; a.target = '_blank'; a.rel = 'noopener'; return a; }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-dl]');
    if (!a) return;
    e.preventDefault();
    var url = a.href, name = a.getAttribute('download') || url.split('/').pop().split('?')[0];
    var isVideo = /\.mp4/i.test(url);
    if (inApp) {
      sheet('<h3>यहाँ से डाउनलोड नहीं होगा 🙏</h3><p>WhatsApp/Instagram के अंदर वाला ब्राउज़र डाउनलोड रोक देता है।</p><ol><li>ऊपर कोने में <b>⋮</b> या <b>…</b> दबाइए</li><li><b>' + (iOS ? 'Open in Safari' : 'Open in Chrome / Open in browser') + '</b> चुनिए</li><li>फिर यही बटन दोबारा दबाइए ✅</li></ol>',
        [link(isVideo ? 'या वीडियो खोलें (दबाकर रखें → सेव करें)' : 'या फ़ोटो खोलें (दबाकर रखें → सेव करें)', url, 'p')]);
      return;
    }
    var old = a.textContent; a.textContent = 'डाउनलोड हो रहा है…'; a.style.pointerEvents = 'none';
    var done = function () { a.textContent = old; a.style.pointerEvents = ''; };
    fetch(url).then(function (r) { if (!r.ok) throw 0; return r.blob(); }).then(function (blob) {
      var file = new File([blob], name, { type: blob.type || (isVideo ? 'video/mp4' : 'image/jpeg') });
      if (iOS && navigator.canShare && navigator.canShare({ files: [file] })) {
        done();
        var b = document.createElement('button'); b.className = 'p'; b.type = 'button'; b.textContent = isVideo ? '📥 Save Video' : '📥 Save Image';
        var m = sheet('<h3>तैयार है ✅</h3><p>नीचे दबाइए, फिर <b>' + (isVideo ? 'Save Video' : 'Save Image') + '</b> चुनिए।</p>', [b]);
        b.onclick = function () { navigator.share({ files: [file] }).then(function () { m.remove(); }).catch(function () {}); }; // share needs a fresh tap on iOS
        return;
      }
      var u = URL.createObjectURL(blob), t = document.createElement('a'); t.href = u; t.download = name; document.body.appendChild(t); t.click(); t.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
      a.textContent = '✓ डाउनलोड हो गया'; setTimeout(done, 2500);
    }).catch(function () { done(); window.open(url, '_blank'); });
  });
})();
