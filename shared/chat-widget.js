/* King's Library help chat — shared by the app and the website.
   A floating button opens a small chat panel; questions go to the support-chat Edge
   Function (Claude), which answers from the site's own policies and catalog.
   Usage (after supabaseClient.js):
     KLChat.init({ getLang: () => 'en' | 'hi' | 'pa', isHidden: () => boolean, bottomOffset: 84 })
   The chat history lives only in this page (and this tab's sessionStorage). */
(function () {
  const STRINGS = {
    en: {
      button: 'Help', title: "King's Library Help", sub: 'Ask about the app, buying, delivery or refunds',
      greeting: "Hi! I can help with signing in, installing the app, reading, buying, delivery and refunds. What would you like to know?",
      placeholder: 'Type your question…', send: 'Send', close: 'Close', thinking: 'Typing…',
      limit: "You've reached today's limit for chat questions. Please try again tomorrow, or contact us directly on the Contact Us page.",
      busy: 'The help chat is very busy right now. Please try again in a little while, or contact us directly.',
      error: "Sorry, I couldn't answer just now. Please try again, or contact us directly on the Contact Us page.",
      disclaimer: 'Answers are automatic and can make mistakes — for payments or your order, contact us.',
      newChat: 'New chat',
      suggestions: ["I didn't get my sign-in code", 'How do I install the app?', 'What is your refund policy?', 'How do I buy a book?', 'Which books and podcasts are available?', 'How long does delivery take?'],
    },
    hi: {
      button: 'मदद', title: 'King\'s Library सहायता', sub: 'ऐप, खरीदारी, डिलीवरी या रिफंड के बारे में पूछें',
      greeting: 'नमस्ते! मैं साइन इन, ऐप इंस्टॉल करने, पढ़ने, खरीदने, डिलीवरी और रिफंड में मदद कर सकता हूं। आप क्या जानना चाहेंगे?',
      placeholder: 'अपना सवाल लिखें…', send: 'भेजें', close: 'बंद करें', thinking: 'लिख रहा है…',
      limit: 'आज के लिए चैट सवालों की सीमा पूरी हो गई है। कृपया कल फिर कोशिश करें, या "संपर्क करें" पेज से सीधे हमसे संपर्क करें।',
      busy: 'सहायता चैट अभी बहुत व्यस्त है। कृपया थोड़ी देर बाद कोशिश करें, या सीधे हमसे संपर्क करें।',
      error: 'माफ़ कीजिए, अभी जवाब नहीं दे सका। कृपया फिर कोशिश करें, या "संपर्क करें" पेज से सीधे हमसे संपर्क करें।',
      disclaimer: 'जवाब अपने-आप बनते हैं और गलत हो सकते हैं — भुगतान या ऑर्डर के लिए हमसे संपर्क करें।',
      newChat: 'नई चैट',
      suggestions: ['मुझे साइन-इन कोड नहीं मिला', 'ऐप कैसे इंस्टॉल करें?', 'रिफंड नीति क्या है?', 'किताब कैसे खरीदें?', 'कौन-सी किताबें और पॉडकास्ट उपलब्ध हैं?', 'डिलीवरी में कितना समय लगता है?'],
    },
    pa: {
      button: 'ਮਦਦ', title: "King's Library ਸਹਾਇਤਾ", sub: 'ਐਪ, ਖਰੀਦ, ਡਿਲੀਵਰੀ ਜਾਂ ਰਿਫੰਡ ਬਾਰੇ ਪੁੱਛੋ',
      greeting: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਸਾਈਨ ਇਨ, ਐਪ ਇੰਸਟਾਲ ਕਰਨ, ਪੜ੍ਹਨ, ਖਰੀਦਣ, ਡਿਲੀਵਰੀ ਅਤੇ ਰਿਫੰਡ ਵਿੱਚ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ। ਤੁਸੀਂ ਕੀ ਜਾਣਨਾ ਚਾਹੋਗੇ?',
      placeholder: 'ਆਪਣਾ ਸਵਾਲ ਲਿਖੋ…', send: 'ਭੇਜੋ', close: 'ਬੰਦ ਕਰੋ', thinking: 'ਲਿਖ ਰਿਹਾ ਹੈ…',
      limit: 'ਅੱਜ ਲਈ ਚੈਟ ਸਵਾਲਾਂ ਦੀ ਸੀਮਾ ਪੂਰੀ ਹੋ ਗਈ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਕੱਲ੍ਹ ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ, ਜਾਂ "ਸੰਪਰਕ ਕਰੋ" ਪੰਨੇ ਤੋਂ ਸਿੱਧਾ ਸਾਡੇ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।',
      busy: 'ਸਹਾਇਤਾ ਚੈਟ ਇਸ ਵੇਲੇ ਬਹੁਤ ਰੁੱਝੀ ਹੋਈ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਥੋੜ੍ਹੀ ਦੇਰ ਬਾਅਦ ਕੋਸ਼ਿਸ਼ ਕਰੋ, ਜਾਂ ਸਿੱਧਾ ਸਾਡੇ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।',
      error: 'ਮਾਫ਼ ਕਰਨਾ, ਹੁਣੇ ਜਵਾਬ ਨਹੀਂ ਦੇ ਸਕਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ, ਜਾਂ "ਸੰਪਰਕ ਕਰੋ" ਪੰਨੇ ਤੋਂ ਸਿੱਧਾ ਸਾਡੇ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।',
      disclaimer: 'ਜਵਾਬ ਆਪਣੇ-ਆਪ ਬਣਦੇ ਹਨ ਅਤੇ ਗਲਤ ਹੋ ਸਕਦੇ ਹਨ — ਭੁਗਤਾਨ ਜਾਂ ਆਰਡਰ ਲਈ ਸਾਡੇ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।',
      newChat: 'ਨਵੀਂ ਚੈਟ',
      suggestions: ['ਮੈਨੂੰ ਸਾਈਨ-ਇਨ ਕੋਡ ਨਹੀਂ ਮਿਲਿਆ', 'ਐਪ ਕਿਵੇਂ ਇੰਸਟਾਲ ਕਰੀਏ?', 'ਰਿਫੰਡ ਨੀਤੀ ਕੀ ਹੈ?', 'ਕਿਤਾਬ ਕਿਵੇਂ ਖਰੀਦੀਏ?', 'ਕਿਹੜੀਆਂ ਕਿਤਾਬਾਂ ਅਤੇ ਪੌਡਕਾਸਟ ਉਪਲਬਧ ਹਨ?', 'ਡਿਲੀਵਰੀ ਵਿੱਚ ਕਿੰਨਾ ਸਮਾਂ ਲੱਗਦਾ ਹੈ?'],
    },
  };
  const STORE_KEY = 'kl-chat-history';

  const CSS = `
  .klc-btn { position: fixed; right: 18px; z-index: 95; height: 48px; padding: 0 18px 0 14px; border-radius: 24px; border: none; cursor: pointer;
    display: flex; align-items: center; gap: 8px; font: 700 14px/1 'Inter', -apple-system, sans-serif; color: #1B140A;
    background: linear-gradient(180deg, #F0C25E, #C79A42); box-shadow: 0 6px 18px rgba(0,0,0,0.3); transition: transform .2s ease; }
  .klc-btn:hover { transform: translateY(-2px); }
  .klc-panel { position: fixed; right: 18px; z-index: 96; width: min(380px, calc(100vw - 24px)); height: min(560px, calc(100vh - 110px));
    display: none; flex-direction: column; overflow: hidden; border-radius: 14px; background: #141F2C; color: #E9E2D0;
    border: 1px solid rgba(240,194,94,0.25); box-shadow: 0 16px 48px rgba(0,0,0,0.45); font-family: 'Inter', -apple-system, sans-serif; }
  .klc-panel.open { display: flex; }
  .klc-head { display: flex; align-items: flex-start; gap: 10px; padding: 14px 14px 12px; border-bottom: 1px solid rgba(233,226,208,0.08); }
  .klc-head-text { flex: 1; min-width: 0; }
  .klc-title { font: 600 16px/1.3 'Literata', Georgia, serif; }
  .klc-sub { font-size: 11.5px; color: #93A0A8; margin-top: 2px; }
  .klc-new { flex-shrink: 0; background: none; border: 1px solid rgba(240,194,94,0.4); color: #F0C25E; border-radius: 14px;
    padding: 4px 10px; font-size: 12px; cursor: pointer; white-space: nowrap; align-self: center; }
  .klc-close { background: none; border: none; color: #93A0A8; font-size: 24px; line-height: 1; cursor: pointer; padding: 0 4px; }
  .klc-log { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
  .klc-msg { max-width: 86%; padding: 9px 12px; border-radius: 12px; font-size: 14px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
  .klc-msg a { color: #F0C25E; }
  .klc-bot { align-self: flex-start; background: #1B2836; border-bottom-left-radius: 4px; }
  .klc-user { align-self: flex-end; background: #C79A42; color: #1B140A; border-bottom-right-radius: 4px; }
  .klc-user a { color: #1B140A; }
  .klc-typing { color: #93A0A8; font-style: italic; }
  .klc-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .klc-chip { background: none; border: 1px solid rgba(240,194,94,0.4); color: #F0C25E; border-radius: 16px; padding: 6px 10px; font-size: 12.5px; cursor: pointer; text-align: left; }
  .klc-form { display: flex; gap: 8px; padding: 10px; border-top: 1px solid rgba(233,226,208,0.08); }
  .klc-input { flex: 1; min-width: 0; resize: none; max-height: 96px; background: #0A121C; color: #E9E2D0; border: 1px solid rgba(233,226,208,0.14);
    border-radius: 10px; padding: 10px 12px; font: 14px/1.4 'Inter', -apple-system, sans-serif; outline: none;
    -webkit-user-select: text; user-select: text; } /* the app disables selection page-wide */
  .klc-input:focus { border-color: #F0C25E; }
  .klc-send { flex-shrink: 0; border: none; border-radius: 10px; padding: 0 14px; font-weight: 700; cursor: pointer; color: #1B140A; background: linear-gradient(180deg, #F0C25E, #C79A42); }
  .klc-send:disabled { opacity: .5; cursor: default; }
  .klc-note { font-size: 10.5px; color: #93A0A8; padding: 0 12px 10px; text-align: center; }
  @media (max-width: 480px) {
    .klc-btn { right: 14px; height: 44px; padding: 0 14px 0 12px; font-size: 13px; }
    .klc-panel { right: 8px; left: 8px; width: auto; height: calc(100vh - 90px); }
  }
  @media (prefers-reduced-motion: reduce) { .klc-btn, .klc-btn:hover { transition: none; transform: none; } }`;

  let opts = { getLang: () => 'en', isHidden: () => false, bottomOffset: 18 };
  let history = [];   // [{ role: 'user' | 'assistant', content }]
  let sending = false;
  let els = {};
  let ready = false; // true once the server confirms the chat is set up (see init)

  const s = () => STRINGS[opts.getLang()] || STRINGS.en;
  const escape = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Plain text with clickable links and emails, plus **bold** — nothing else is rendered as HTML.
  const linkify = (t) => escape(t)
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[\s(])([\w.+-]+@[\w-]+\.[\w.]+[\w])/g, '$1<a href="mailto:$2">$2</a>')
    // The model sometimes uses **bold** or # headings despite instructions — show them tidily.
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/^#{1,4}\s+/gm, '');

  function load() {
    try { history = JSON.parse(sessionStorage.getItem(STORE_KEY) || '[]').filter((m) => m && (m.role === 'user' || m.role === 'assistant')); }
    catch (e) { history = []; }
  }
  function save() { try { sessionStorage.setItem(STORE_KEY, JSON.stringify(history.slice(-20))); } catch (e) { /* private mode — fine */ } }

  function render() {
    const str = s();
    els.btnLabel.textContent = str.button;
    els.title.textContent = str.title;
    els.sub.textContent = str.sub;
    els.close.setAttribute('aria-label', str.close);
    els.input.placeholder = str.placeholder;
    els.send.textContent = str.send;
    els.note.textContent = str.disclaimer;
    els.newChat.textContent = '↺ ' + str.newChat;
    els.newChat.style.display = history.length ? '' : 'none';
    const chips = (list) => `<div class="klc-chips">${list.map((q) => `<button class="klc-chip" type="button">${escape(q)}</button>`).join('')}</div>`;
    let html = `<div class="klc-msg klc-bot">${escape(str.greeting)}</div>`;
    if (!history.length) html += chips(str.suggestions.slice(0, 3));
    html += history.map((m) => `<div class="klc-msg ${m.role === 'user' ? 'klc-user' : 'klc-bot'}">${linkify(m.content)}</div>`).join('');
    if (sending) html += `<div class="klc-msg klc-bot klc-typing">${escape(str.thinking)}</div>`;
    else if (history.length) {
      // After each answer, offer the suggested questions not asked yet.
      const asked = new Set(history.filter((m) => m.role === 'user').map((m) => m.content));
      const more = str.suggestions.filter((q) => !asked.has(q)).slice(0, 3);
      if (more.length) html += chips(more);
    }
    els.log.innerHTML = html;
    els.log.querySelectorAll('.klc-chip').forEach((c) => c.addEventListener('click', () => ask(c.textContent)));
    els.log.scrollTop = els.log.scrollHeight;
    els.send.disabled = sending;
  }

  async function ask(text) {
    const question = String(text || '').trim();
    if (!question || sending) return;
    history.push({ role: 'user', content: question.slice(0, 1500) });
    sending = true;
    save();
    render();
    let reply, local = false; // local: an error notice shown here but never sent to the AI
    try {
      const { data, error } = await window.sb.functions.invoke('support-chat', { body: { messages: history.filter((m) => !m.local).slice(-8), lang: opts.getLang() } });
      if (data && data.reply) reply = data.reply;
      else {
        // functions.invoke reports non-2xx as an error whose context holds the response.
        let code = data && data.error;
        if (!code && error && error.context && typeof error.context.json === 'function') {
          try { code = (await error.context.json()).error; } catch (e) { /* ignore */ }
        }
        reply = code === 'limit' ? s().limit : code === 'busy' ? s().busy : s().error;
        local = true;
      }
    } catch (e) {
      reply = s().error;
      local = true;
    }
    history.push(local ? { role: 'assistant', content: reply, local: true } : { role: 'assistant', content: reply });
    sending = false;
    save();
    render();
  }

  function newChat() {
    if (sending) return;
    history = [];
    save();
    render();
    els.input.focus();
  }

  function setOpen(open) {
    els.panel.classList.toggle('open', open);
    els.btn.style.display = open ? 'none' : '';
    if (open) { render(); setTimeout(() => els.input.focus(), 50); }
  }

  function position() {
    const hidden = !ready || opts.isHidden();
    els.btn.style.bottom = `calc(${opts.bottomOffset}px + env(safe-area-inset-bottom, 0px))`;
    els.panel.style.bottom = `calc(${opts.bottomOffset}px + env(safe-area-inset-bottom, 0px))`;
    if (hidden) { els.btn.style.display = 'none'; els.panel.classList.remove('open'); }
    else if (!els.panel.classList.contains('open')) els.btn.style.display = '';
  }

  function init(options) {
    if (!window.sb) return;
    opts = Object.assign(opts, options || {});
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <button class="klc-btn" type="button" aria-haspopup="dialog">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>
        <span class="klc-btn-label"></span>
      </button>
      <div class="klc-panel" role="dialog" aria-modal="false">
        <div class="klc-head">
          <div class="klc-head-text"><div class="klc-title"></div><div class="klc-sub"></div></div>
          <button class="klc-new" type="button"></button>
          <button class="klc-close" type="button">×</button>
        </div>
        <div class="klc-log" aria-live="polite"></div>
        <form class="klc-form">
          <textarea class="klc-input" rows="1" maxlength="1500"></textarea>
          <button class="klc-send" type="submit"></button>
        </form>
        <div class="klc-note"></div>
      </div>`;
    document.body.appendChild(wrap);
    els = {
      btn: wrap.querySelector('.klc-btn'), btnLabel: wrap.querySelector('.klc-btn-label'),
      panel: wrap.querySelector('.klc-panel'), title: wrap.querySelector('.klc-title'), sub: wrap.querySelector('.klc-sub'),
      close: wrap.querySelector('.klc-close'), newChat: wrap.querySelector('.klc-new'), log: wrap.querySelector('.klc-log'), form: wrap.querySelector('.klc-form'),
      input: wrap.querySelector('.klc-input'), send: wrap.querySelector('.klc-send'), note: wrap.querySelector('.klc-note'),
    };
    els.btn.addEventListener('click', () => setOpen(true));
    els.close.addEventListener('click', () => setOpen(false));
    els.newChat.addEventListener('click', newChat);
    els.form.addEventListener('submit', (e) => { e.preventDefault(); const q = els.input.value; els.input.value = ''; ask(q); });
    els.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); els.form.requestSubmit ? els.form.requestSubmit() : els.form.dispatchEvent(new Event('submit')); }
    });
    // Keyboard/touch events inside the chat must not reach page handlers (e.g. the reader's arrow keys).
    els.panel.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') setOpen(false); });
    load();
    render();
    position(); // hidden until the server says the chat is ready
    setInterval(position, 400); // follow page changes (e.g. hide while reading a book)
    window.sb.functions.invoke('support-chat', { method: 'GET' })
      .then(({ data }) => { ready = !!(data && data.ready); position(); })
      .catch(() => { /* not deployed yet — stay hidden */ });
  }

  window.KLChat = { init, refresh: () => { if (els.btn) { render(); position(); } } };
})();
