/* "Refer a friend" — shared by the website and the app.
   KLRefer.open({ type: 'book' | 'podcast', id, title, by }) shows a small panel to send a
   ready-written recommendation by WhatsApp, email, the phone's share menu, or a copied link.
   The link opens the website on that exact book/podcast (see openItemFromHash in
   site/index.html), where the friend can read a free sample / hear a preview and buy.
   Setup (after the page's language is known): KLRefer.init({ getLang: () => 'en' | 'hi' | 'pa' }) */
(function () {
  const SITE = 'https://kingslibrary.online/';
  const STRINGS = {
    en: {
      title: 'Refer a friend', whatsapp: 'WhatsApp', email: 'Email', more: 'More…', copy: 'Copy link', close: 'Close',
      copied: 'Link copied — paste it anywhere to share.',
      subtitle: (item) => `Share “${item.title}” with someone who'll enjoy it.`,
      subject: (item) => `You might enjoy “${item.title}” on King's Library`,
      message: (item, url) => item.type === 'podcast'
        ? `I loved “${item.title}”${item.by ? ` by ${item.by}` : ''} on King's Library and thought you'd enjoy it too. Hear a free preview here: ${url}`
        : `I loved “${item.title}”${item.by ? ` by ${item.by}` : ''} on King's Library and thought you'd enjoy it too. Read a free sample here: ${url}`,
    },
    hi: {
      title: 'दोस्त को रेफ़र करें', whatsapp: 'WhatsApp', email: 'ईमेल', more: 'और…', copy: 'लिंक कॉपी करें', close: 'बंद करें',
      copied: 'लिंक कॉपी हो गया — कहीं भी पेस्ट करके भेजें।',
      subtitle: (item) => `“${item.title}” किसी ऐसे व्यक्ति के साथ साझा करें जिसे यह पसंद आएगा।`,
      subject: (item) => `King's Library पर “${item.title}” आपको पसंद आ ${item.type === 'podcast' ? 'सकता' : 'सकती'} है`,
      message: (item, url) => item.type === 'podcast'
        ? `King's Library पर “${item.title}”${item.by ? ` (${item.by})` : ''} मुझे बहुत पसंद आया, और मुझे लगा आपको भी पसंद आएगा। यहां मुफ़्त प्रीव्यू सुनें: ${url}`
        : `King's Library पर “${item.title}”${item.by ? ` (${item.by})` : ''} मुझे बहुत पसंद आई, और मुझे लगा आपको भी पसंद आएगी। यहां मुफ़्त नमूना पढ़ें: ${url}`,
    },
    pa: {
      title: 'ਦੋਸਤ ਨੂੰ ਰੈਫ਼ਰ ਕਰੋ', whatsapp: 'WhatsApp', email: 'ਈਮੇਲ', more: 'ਹੋਰ…', copy: 'ਲਿੰਕ ਕਾਪੀ ਕਰੋ', close: 'ਬੰਦ ਕਰੋ',
      copied: 'ਲਿੰਕ ਕਾਪੀ ਹੋ ਗਿਆ — ਕਿਤੇ ਵੀ ਪੇਸਟ ਕਰਕੇ ਭੇਜੋ।',
      subtitle: (item) => `“${item.title}” ਕਿਸੇ ਅਜਿਹੇ ਵਿਅਕਤੀ ਨਾਲ ਸਾਂਝਾ ਕਰੋ ਜਿਸਨੂੰ ਇਹ ਪਸੰਦ ਆਵੇਗਾ।`,
      subject: (item) => `King's Library 'ਤੇ “${item.title}” ਤੁਹਾਨੂੰ ਪਸੰਦ ਆ ${item.type === 'podcast' ? 'ਸਕਦਾ' : 'ਸਕਦੀ'} ਹੈ`,
      message: (item, url) => item.type === 'podcast'
        ? `King's Library 'ਤੇ “${item.title}”${item.by ? ` (${item.by})` : ''} ਮੈਨੂੰ ਬਹੁਤ ਪਸੰਦ ਆਇਆ, ਅਤੇ ਮੈਨੂੰ ਲੱਗਿਆ ਤੁਹਾਨੂੰ ਵੀ ਪਸੰਦ ਆਵੇਗਾ। ਇੱਥੇ ਮੁਫ਼ਤ ਪ੍ਰੀਵਿਊ ਸੁਣੋ: ${url}`
        : `King's Library 'ਤੇ “${item.title}”${item.by ? ` (${item.by})` : ''} ਮੈਨੂੰ ਬਹੁਤ ਪਸੰਦ ਆਈ, ਅਤੇ ਮੈਨੂੰ ਲੱਗਿਆ ਤੁਹਾਨੂੰ ਵੀ ਪਸੰਦ ਆਵੇਗੀ। ਇੱਥੇ ਮੁਫ਼ਤ ਨਮੂਨਾ ਪੜ੍ਹੋ: ${url}`,
    },
  };

  const ICONS = {
    whatsapp: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.43 9.43 0 0 1-4.8-1.32l-.35-.2-3.57.93.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.24-9.44 9.45-9.44 2.52 0 4.89.99 6.67 2.77a9.37 9.37 0 0 1 2.76 6.68c0 5.2-4.24 9.44-9.44 9.44m8.04-17.48A11.3 11.3 0 0 0 12.05.7C5.78.7.68 5.8.68 12.06c0 2 .52 3.96 1.52 5.68L.58 23.64l6.05-1.59a11.3 11.3 0 0 0 5.42 1.38h.01c6.26 0 11.36-5.1 11.36-11.37 0-3.04-1.18-5.89-3.33-8.04"/></svg>',
    email: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    more: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-3.9M8.6 13.5l6.8 3.9"/></svg>',
    copy: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 14a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1 1"/><path d="M14 10a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1-1"/></svg>',
  };

  const CSS = `
  .klr-overlay { position: fixed; inset: 0; z-index: 210; background: rgba(0,0,0,0.55); display: none; align-items: flex-end; justify-content: center; }
  .klr-overlay.open { display: flex; }
  .klr-sheet { position: relative; width: 100%; max-width: 420px; background: #141F2C; color: #E9E2D0; border-radius: 16px 16px 0 0;
    padding: 22px 20px calc(22px + env(safe-area-inset-bottom, 0px)); text-align: center; font-family: 'Inter', -apple-system, sans-serif;
    box-shadow: 0 -10px 40px rgba(0,0,0,0.35); }
  @media (min-width: 600px) { .klr-overlay { align-items: center; } .klr-sheet { border-radius: 16px; } }
  .klr-close { position: absolute; top: 8px; right: 10px; width: 34px; height: 34px; background: none; border: none; color: #93A0A8; font-size: 24px; line-height: 1; cursor: pointer; }
  .klr-title { font: 600 19px/1.3 'Literata', Georgia, serif; margin-bottom: 6px; }
  .klr-sub { font-size: 13px; color: #93A0A8; line-height: 1.5; margin-bottom: 18px; }
  .klr-options { display: grid; grid-template-columns: repeat(auto-fit, minmax(76px, 1fr)); gap: 10px; }
  .klr-opt { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px 6px; border-radius: 12px; cursor: pointer;
    background: #1B2836; border: 1px solid rgba(233,226,208,0.08); color: #E9E2D0; font-size: 12.5px; text-decoration: none; font-family: inherit; }
  .klr-opt:hover { border-color: rgba(240,194,94,0.45); }
  .klr-icon { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #1B140A;
    background: linear-gradient(180deg, #F0C25E, #C79A42); }
  .klr-opt-whatsapp .klr-icon { background: #25D366; color: #fff; }
  .klr-toast { margin-top: 14px; font-size: 12.5px; color: #F0C25E; min-height: 18px; }`;

  let opts = { getLang: () => 'en', getReferrerId: null };
  let els = null;

  const s = () => STRINGS[opts.getLang()] || STRINGS.en;
  const escape = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // &ref=<reader id> (app only) lets the admin see which reader brought each new contact.
  const linkFor = (item) => {
    const ref = opts.getReferrerId ? opts.getReferrerId() : null;
    return `${SITE}#${item.type === 'podcast' ? 'podcast' : 'book'}=${encodeURIComponent(item.id)}${ref ? `&ref=${encodeURIComponent(ref)}` : ''}`;
  };

  function build() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    const overlay = document.createElement('div');
    overlay.className = 'klr-overlay';
    overlay.innerHTML = `<div class="klr-sheet" role="dialog" aria-modal="true">
      <button class="klr-close" type="button">×</button>
      <div class="klr-title"></div><div class="klr-sub"></div>
      <div class="klr-options"></div><div class="klr-toast" aria-live="polite"></div></div>`;
    document.body.appendChild(overlay);
    els = { overlay, title: overlay.querySelector('.klr-title'), sub: overlay.querySelector('.klr-sub'), options: overlay.querySelector('.klr-options'), toast: overlay.querySelector('.klr-toast'), close: overlay.querySelector('.klr-close') };
    els.close.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') close(); });
  }

  function close() { if (els) els.overlay.classList.remove('open'); }

  function open(item) {
    if (!item || !item.id || !item.title) return;
    if (!els) build();
    const str = s();
    const url = linkFor(item);
    const message = str.message(item, url);
    els.title.textContent = str.title;
    els.sub.textContent = str.subtitle(item);
    els.close.setAttribute('aria-label', str.close);
    els.toast.textContent = '';
    const option = (key, label, attrs) => `<${attrs.href ? 'a' : 'button type="button"'} class="klr-opt klr-opt-${key}" ${attrs.href ? `href="${escape(attrs.href)}" target="_blank" rel="noopener"` : `data-action="${key}"`}>
        <span class="klr-icon">${ICONS[key]}</span>${escape(label)}</${attrs.href ? 'a' : 'button'}>`;
    els.options.innerHTML =
      option('whatsapp', str.whatsapp, { href: `https://wa.me/?text=${encodeURIComponent(message)}` }) +
      option('email', str.email, { href: `mailto:?subject=${encodeURIComponent(str.subject(item))}&body=${encodeURIComponent(message)}` }) +
      (navigator.share ? option('more', str.more, {}) : '') +
      option('copy', str.copy, {});
    els.options.querySelector('[data-action="more"]')?.addEventListener('click', () => {
      navigator.share({ title: item.title, text: message }).then(close, () => {});
    });
    els.options.querySelector('[data-action="copy"]').addEventListener('click', () => {
      const done = () => { els.toast.textContent = str.copied; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(message).then(done, done);
      else done();
    });
    els.options.querySelectorAll('a.klr-opt').forEach((a) => a.addEventListener('click', () => setTimeout(close, 300)));
    els.overlay.classList.add('open');
  }

  window.KLRefer = { init: (o) => { opts = Object.assign(opts, o || {}); }, open, close, linkFor };
})();
