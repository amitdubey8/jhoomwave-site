/* JHOOMWAVE website → Office. Sends a form straight to the team's Office (Supabase RPC submit_enquiry).
   Off until JW_OFFICE has a url + publishable key; then forms show a "Send to JHOOMWAVE" button.
   The publishable key can only call submit_enquiry (it can't read anything) — see office-app migrations. */
window.JW_OFFICE = window.JW_OFFICE || { url: '', key: '' };
window.jwOfficeOn = () => !!(window.JW_OFFICE.url && window.JW_OFFICE.key);
window.jwSendEnquiry = async function (e) {
  if (!window.jwOfficeOn()) return { ok: false, why: 'off' };
  if (e.trap) return { ok: true }; // honeypot filled: a bot. Pretend success, send nothing.
  const body = {
    p_name: (e.name || '').slice(0, 120), p_contact: (e.contact || '').slice(0, 160), p_message: (e.message || '').slice(0, 2000),
    p_kind: e.kind || 'question', p_business: e.business ? e.business.slice(0, 160) : null, p_city: e.city ? e.city.slice(0, 80) : null, p_consent: !!e.consent,
  };
  try {
    const r = await fetch(window.JW_OFFICE.url.replace(/\/$/, '') + '/rest/v1/rpc/submit_enquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: window.JW_OFFICE.key, Authorization: 'Bearer ' + window.JW_OFFICE.key },
      body: JSON.stringify(body),
    });
    return { ok: r.ok, why: r.ok ? '' : 'http ' + r.status };
  } catch (x) { return { ok: false, why: 'network' }; }
};
/* Wire a form: adds contact + consent fields and a Send button after the message is prepared. */
window.jwWireForm = function (cfg) {
  if (!window.jwOfficeOn()) return;
  const form = document.getElementById(cfg.form), act = document.getElementById(cfg.actions);
  if (!form || !act) return;
  const mk = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
  const contact = mk('<label>Your WhatsApp number or email<input id="' + cfg.form + '-contact" maxlength="80" autocomplete="tel" placeholder="e.g. +91 98xxxxxx10"></label>');
  const consent = mk('<label class="jw-consent" style="display:flex;gap:8px;align-items:flex-start;font-size:14px"><input type="checkbox" id="' + cfg.form + '-ok" style="width:auto;margin-top:4px"> OK to contact me about this request</label>');
  const trap = mk('<input type="text" name="website" id="' + cfg.form + '-web" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">');
  const submit = form.querySelector('button[type=submit]');
  form.insertBefore(contact, submit); form.insertBefore(consent, submit); form.append(trap);
  const send = mk('<button class="btn pri" type="button">Send to JHOOMWAVE ✓</button>');
  const note = mk('<p class="muted" style="font-size:13px;margin:0" role="status"></p>');
  act.prepend(send); act.after(note);
  send.addEventListener('click', async () => {
    const c = document.getElementById(cfg.form + '-contact').value.trim();
    if (c.length < 6) { note.textContent = 'Add your WhatsApp number or email so we can reply.'; return; }
    if (!document.getElementById(cfg.form + '-ok').checked) { note.textContent = 'Tick "OK to contact me" so we can reply.'; return; }
    send.disabled = true; note.textContent = 'Sending…';
    const r = await window.jwSendEnquiry(Object.assign(cfg.collect(), { contact: c, consent: true, trap: document.getElementById(cfg.form + '-web').value }));
    send.disabled = r.ok; /* sent once: no double sends */
    note.textContent = r.ok ? 'Sent ✓ We reply within a day on WhatsApp or email.' : 'Could not send right now. Copy the message and DM @jhoomwave instead.';
    if (r.ok) send.textContent = 'Sent ✓';
    try { window.gtag && gtag('event', 'enquiry_sent', { form: cfg.form, ok: r.ok }); } catch (x) {}
  });
};
