/* Contact form ("leads", migration 0015) — used on the website when:
   - a friend opens a referral link (compulsory — the form can't be closed), and
   - a visitor taps "Buy Now" (can be cancelled).
   Collects name, email, phone and consent to be contacted, saves them for the admin's
   Contacts page, and remembers them on this device so the visitor isn't asked twice.
   KLLead.ask({ source: 'referral'|'buy', itemType, itemId, itemTitle, referredBy, compulsory })
     → Promise resolving to { name, email, phone } once saved, or null if cancelled.
   Setup: KLLead.init({ getLang: () => 'en'|'hi'|'pa', privacyUrl }) */
(function () {
  const STORE_KEY = 'kl-contact';
  const STRINGS = {
    en: {
      referralTitle: "You've been invited to King's Library",
      referralSub: (item) => `Someone thought you'd enjoy “${item.itemTitle}”. Tell us who you are to see it — ${item.itemType === 'podcast' ? 'and hear a free preview' : 'and read a free sample'}.`,
      buyTitle: (item) => `Buy “${item.itemTitle}”`,
      buySub: 'Share your details so we can send you payment details and your access.',
      name: 'Your name', email: 'Email address', phone: 'Phone / WhatsApp number', phonePlaceholder: '+91 98765 43210',
      consent: 'I agree that King\'s Library may contact me by email, phone or WhatsApp about books and podcasts.', privacy: 'Privacy Policy',
      referralBtn: 'Continue', buyBtn: 'Continue to buy', cancel: 'Cancel', saving: 'Saving…',
      errName: 'Please enter your name.', errEmail: 'Please enter a valid email address.', errPhone: 'Please enter a valid phone number (at least 10 digits).',
      errConsent: 'Please tick the box to continue.', errSave: "Couldn't save — please check your connection and try again.",
    },
    hi: {
      referralTitle: 'आपको King\'s Library पर आमंत्रित किया गया है',
      referralSub: (item) => `किसी को लगा आपको “${item.itemTitle}” पसंद आएगी। इसे देखने के लिए अपनी जानकारी दें — ${item.itemType === 'podcast' ? 'और मुफ़्त प्रीव्यू सुनें' : 'और मुफ़्त नमूना पढ़ें'}।`,
      buyTitle: (item) => `“${item.itemTitle}” खरीदें`,
      buySub: 'अपनी जानकारी दें ताकि हम आपको भुगतान की जानकारी और एक्सेस भेज सकें।',
      name: 'आपका नाम', email: 'ईमेल पता', phone: 'फ़ोन / WhatsApp नंबर', phonePlaceholder: '+91 98765 43210',
      consent: 'मैं सहमत हूं कि King\'s Library किताबों और पॉडकास्ट के बारे में मुझसे ईमेल, फ़ोन या WhatsApp पर संपर्क कर सकती है।', privacy: 'गोपनीयता नीति',
      referralBtn: 'आगे बढ़ें', buyBtn: 'खरीदने के लिए आगे बढ़ें', cancel: 'रद्द करें', saving: 'सेव हो रहा है…',
      errName: 'कृपया अपना नाम लिखें।', errEmail: 'कृपया सही ईमेल पता लिखें।', errPhone: 'कृपया सही फ़ोन नंबर लिखें (कम से कम 10 अंक)।',
      errConsent: 'आगे बढ़ने के लिए कृपया बॉक्स पर टिक करें।', errSave: 'सेव नहीं हो सका — कृपया इंटरनेट जांचें और फिर कोशिश करें।',
    },
    pa: {
      referralTitle: 'ਤੁਹਾਨੂੰ King\'s Library \'ਤੇ ਸੱਦਾ ਦਿੱਤਾ ਗਿਆ ਹੈ',
      referralSub: (item) => `ਕਿਸੇ ਨੂੰ ਲੱਗਿਆ ਤੁਹਾਨੂੰ “${item.itemTitle}” ਪਸੰਦ ਆਵੇਗੀ। ਇਸਨੂੰ ਵੇਖਣ ਲਈ ਆਪਣੀ ਜਾਣਕਾਰੀ ਦਿਓ — ${item.itemType === 'podcast' ? 'ਅਤੇ ਮੁਫ਼ਤ ਪ੍ਰੀਵਿਊ ਸੁਣੋ' : 'ਅਤੇ ਮੁਫ਼ਤ ਨਮੂਨਾ ਪੜ੍ਹੋ'}।`,
      buyTitle: (item) => `“${item.itemTitle}” ਖਰੀਦੋ`,
      buySub: 'ਆਪਣੀ ਜਾਣਕਾਰੀ ਦਿਓ ਤਾਂ ਜੋ ਅਸੀਂ ਤੁਹਾਨੂੰ ਭੁਗਤਾਨ ਦੀ ਜਾਣਕਾਰੀ ਅਤੇ ਐਕਸੈਸ ਭੇਜ ਸਕੀਏ।',
      name: 'ਤੁਹਾਡਾ ਨਾਮ', email: 'ਈਮੇਲ ਪਤਾ', phone: 'ਫ਼ੋਨ / WhatsApp ਨੰਬਰ', phonePlaceholder: '+91 98765 43210',
      consent: 'ਮੈਂ ਸਹਿਮਤ ਹਾਂ ਕਿ King\'s Library ਕਿਤਾਬਾਂ ਅਤੇ ਪੌਡਕਾਸਟ ਬਾਰੇ ਮੇਰੇ ਨਾਲ ਈਮੇਲ, ਫ਼ੋਨ ਜਾਂ WhatsApp \'ਤੇ ਸੰਪਰਕ ਕਰ ਸਕਦੀ ਹੈ।', privacy: 'ਪਰਦੇਦਾਰੀ ਨੀਤੀ',
      referralBtn: 'ਅੱਗੇ ਵਧੋ', buyBtn: 'ਖਰੀਦਣ ਲਈ ਅੱਗੇ ਵਧੋ', cancel: 'ਰੱਦ ਕਰੋ', saving: 'ਸੇਵ ਹੋ ਰਿਹਾ ਹੈ…',
      errName: 'ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਨਾਮ ਲਿਖੋ।', errEmail: 'ਕਿਰਪਾ ਕਰਕੇ ਸਹੀ ਈਮੇਲ ਪਤਾ ਲਿਖੋ।', errPhone: 'ਕਿਰਪਾ ਕਰਕੇ ਸਹੀ ਫ਼ੋਨ ਨੰਬਰ ਲਿਖੋ (ਘੱਟੋ-ਘੱਟ 10 ਅੰਕ)।',
      errConsent: 'ਅੱਗੇ ਵਧਣ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਬਾਕਸ \'ਤੇ ਟਿੱਕ ਕਰੋ।', errSave: 'ਸੇਵ ਨਹੀਂ ਹੋ ਸਕਿਆ — ਕਿਰਪਾ ਕਰਕੇ ਇੰਟਰਨੈੱਟ ਜਾਂਚੋ ਅਤੇ ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
    },
  };

  const CSS = `
  .kll-overlay { position: fixed; inset: 0; z-index: 230; background: rgba(5,9,14,0.82); display: none; align-items: center; justify-content: center; padding: 16px; }
  .kll-overlay.open { display: flex; }
  .kll-card { width: 100%; max-width: 420px; max-height: 92vh; overflow-y: auto; background: #141F2C; color: #E9E2D0; border-radius: 16px;
    border: 1px solid rgba(240,194,94,0.25); padding: 24px 22px; font-family: 'Inter', -apple-system, sans-serif; box-shadow: 0 16px 48px rgba(0,0,0,0.5); }
  .kll-title { font: 600 20px/1.3 'Literata', Georgia, serif; margin-bottom: 8px; }
  .kll-sub { font-size: 13.5px; color: #93A0A8; line-height: 1.55; margin-bottom: 16px; }
  .kll-label { display: block; font-size: 12px; color: #93A0A8; margin: 12px 0 6px; }
  .kll-input { width: 100%; box-sizing: border-box; background: #0A121C; color: #E9E2D0; border: 1px solid rgba(233,226,208,0.16); border-radius: 10px;
    padding: 11px 12px; font: 15px/1.4 'Inter', -apple-system, sans-serif; outline: none; }
  .kll-input:focus { border-color: #F0C25E; }
  .kll-input.bad { border-color: #C4574A; }
  .kll-consent { display: flex; gap: 10px; align-items: flex-start; margin: 16px 0 6px; font-size: 12.5px; line-height: 1.5; color: #C9C2B0; cursor: pointer; }
  .kll-consent input { margin-top: 3px; width: 18px; height: 18px; accent-color: #F0C25E; flex-shrink: 0; }
  .kll-consent a { color: #F0C25E; }
  .kll-hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
  .kll-error { min-height: 18px; font-size: 12.5px; color: #E08A7E; margin: 8px 0; }
  .kll-btn { width: 100%; padding: 13px; border: none; border-radius: 10px; cursor: pointer; font: 700 15px 'Inter', -apple-system, sans-serif; color: #1B140A;
    background: linear-gradient(180deg, #F0C25E, #C79A42); }
  .kll-btn:disabled { opacity: .6; cursor: default; }
  .kll-cancel { display: block; margin: 12px auto 0; background: none; border: none; color: #93A0A8; font-size: 13px; cursor: pointer; text-decoration: underline; }`;

  let opts = { getLang: () => 'en', privacyUrl: 'https://kingslibrary.online/#privacy' };
  let els = null;

  const s = () => STRINGS[opts.getLang()] || STRINGS.en;
  const escape = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const remembered = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { return null; } };
  const remember = (c) => { try { localStorage.setItem(STORE_KEY, JSON.stringify(c)); } catch (e) { /* private mode */ } };
  const validEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && e.length <= 200;
  const validPhone = (p) => /^\+?[0-9 ()-]{7,20}$/.test(p) && p.replace(/\D/g, '').length >= 10;

  async function save(contact, req) {
    const row = {
      name: contact.name, email: contact.email, phone: contact.phone, consent: true,
      source: req.source, item_type: req.itemType || null, item_id: req.itemId || null, referred_by: req.referredBy || null,
    };
    let { error } = await window.sb.from('leads').insert(row);
    // A referral link whose referrer no longer exists (or was edited) — keep the contact anyway.
    if (error && error.code === '23503' && row.referred_by) ({ error } = await window.sb.from('leads').insert({ ...row, referred_by: null }));
    if (!error) return 'ok';
    // Contacts table not created yet (database update not run) — never trap visitors behind the form.
    if (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|could not find the table/i.test(error.message || '')) return 'unavailable';
    return 'failed';
  }

  function build() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    const overlay = document.createElement('div');
    overlay.className = 'kll-overlay';
    overlay.innerHTML = '<form class="kll-card" role="dialog" aria-modal="true" novalidate></form>';
    document.body.appendChild(overlay);
    overlay.addEventListener('keydown', (e) => e.stopPropagation());
    els = { overlay, card: overlay.querySelector('.kll-card') };
  }

  function ask(req) {
    return new Promise((resolve) => {
      const saved = remembered();
      // A returning visitor opening another referral link: record it quietly, don't ask again.
      if (req.source === 'referral' && saved && saved.name && validEmail(saved.email) && validPhone(saved.phone)) {
        save(saved, req).finally(() => resolve(saved));
        return;
      }
      if (!els) build();
      const str = s();
      const isBuy = req.source === 'buy';
      els.card.innerHTML = `
        <div class="kll-title">${escape(isBuy ? str.buyTitle(req) : str.referralTitle)}</div>
        <div class="kll-sub">${escape(isBuy ? str.buySub : str.referralSub(req))}</div>
        <label class="kll-label" for="kllName">${escape(str.name)}</label>
        <input class="kll-input" id="kllName" autocomplete="name" maxlength="80" value="${escape(saved?.name || '')}">
        <label class="kll-label" for="kllEmail">${escape(str.email)}</label>
        <input class="kll-input" id="kllEmail" type="email" autocomplete="email" maxlength="200" value="${escape(saved?.email || '')}">
        <label class="kll-label" for="kllPhone">${escape(str.phone)}</label>
        <input class="kll-input" id="kllPhone" type="tel" autocomplete="tel" maxlength="20" placeholder="${escape(str.phonePlaceholder)}" value="${escape(saved?.phone || '')}">
        <input class="kll-hp" id="kllWebsite" tabindex="-1" autocomplete="off" aria-hidden="true">
        <label class="kll-consent"><input type="checkbox" id="kllConsent" ${saved ? 'checked' : ''}>
          <span>${escape(str.consent)} <a href="${escape(opts.privacyUrl)}" target="_blank" rel="noopener">${escape(str.privacy)}</a></span></label>
        <div class="kll-error" aria-live="polite"></div>
        <button class="kll-btn" type="submit">${escape(isBuy ? str.buyBtn : str.referralBtn)}</button>
        ${req.compulsory ? '' : `<button class="kll-cancel" type="button">${escape(str.cancel)}</button>`}`;
      const $ = (id) => els.card.querySelector('#' + id);
      const err = els.card.querySelector('.kll-error');
      const btn = els.card.querySelector('.kll-btn');
      const finish = (value) => { els.overlay.classList.remove('open'); els.card.onsubmit = null; resolve(value); };
      els.card.querySelector('.kll-cancel')?.addEventListener('click', () => finish(null));
      els.card.onsubmit = async (e) => {
        e.preventDefault();
        els.card.querySelectorAll('.kll-input').forEach((i) => i.classList.remove('bad'));
        const contact = { name: $('kllName').value.trim(), email: $('kllEmail').value.trim().toLowerCase(), phone: $('kllPhone').value.trim() };
        const fail = (msg, id) => { err.textContent = msg; if (id) { $(id).classList.add('bad'); $(id).focus(); } };
        if (!contact.name) return fail(str.errName, 'kllName');
        if (!validEmail(contact.email)) return fail(str.errEmail, 'kllEmail');
        if (!validPhone(contact.phone)) return fail(str.errPhone, 'kllPhone');
        if (!$('kllConsent').checked) return fail(str.errConsent);
        if ($('kllWebsite').value) { remember(contact); return finish(contact); } // hidden trap field: a bot filled it — don't store
        err.textContent = '';
        btn.disabled = true;
        btn.textContent = str.saving;
        const result = await save(contact, req);
        btn.disabled = false;
        btn.textContent = isBuy ? str.buyBtn : str.referralBtn;
        if (result === 'failed') return fail(str.errSave);
        remember(contact);
        finish(contact);
      };
      els.overlay.classList.add('open');
      setTimeout(() => (saved ? btn : $('kllName')).focus(), 50);
    });
  }

  window.KLLead = { init: (o) => { opts = Object.assign(opts, o || {}); }, ask };
})();
