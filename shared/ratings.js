/* Ratings & reviews — shared by the website and the app (tables/functions: migration 0014).
   - KLRatings.load()                      fetch star averages for every book/podcast
   - KLRatings.badgeHTML(type, id)         "★ 4.6 (12)" — tap to read approved reviews
   - KLRatings.loadMine(readerId)          the signed-in reader's own ratings (app)
   - KLRatings.rateButtonHTML(type, id)    "☆ Rate" / "★★★★☆ Your rating" button (app, owned items)
   Taps on these are handled here (capture phase, so a card underneath doesn't also open).
   Setup: KLRatings.init({ getLang: () => 'en'|'hi'|'pa', readerId, onChange: () => rerender(), findItem: (type, id) => ({ title }) }) */
(function () {
  const STRINGS = {
    en: {
      rate: 'Rate', yourRating: 'Your rating', ratings: (n) => `${n} rating${n === 1 ? '' : 's'}`,
      rateTitle: (t) => `Rate “${t}”`, tapStars: 'Tap the stars to rate', stars: ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'],
      reviewLabel: 'Write a review (optional)', reviewPlaceholder: 'What did you like? Who would you recommend it to?',
      nameLabel: 'Name to show with your review (optional)', namePlaceholder: 'e.g. Priya from Ludhiana',
      reviewNote: 'Your stars count right away. A written review appears on the website after it is approved.',
      save: 'Save rating', remove: 'Remove my rating', close: 'Close', saved: 'Thank you! Your rating is saved.',
      removed: 'Your rating was removed.', error: "Couldn't save — please check your connection and try again.", pickStars: 'Please choose 1 to 5 stars.',
      reviewsTitle: (t) => `Reviews of “${t}”`, noReviews: 'No written reviews yet.', average: (a, n) => `★ ${a} out of 5 · ${n}`,
      pendingNote: 'Your review is waiting for approval.', rejectedNote: "Your review wasn't approved for the website — your stars still count.",
    },
    hi: {
      rate: 'रेटिंग दें', yourRating: 'आपकी रेटिंग', ratings: (n) => `${n} रेटिंग`,
      rateTitle: (t) => `“${t}” को रेटिंग दें`, tapStars: 'रेटिंग के लिए सितारे दबाएं', stars: ['खराब', 'ठीक-ठाक', 'अच्छी', 'बहुत अच्छी', 'शानदार'],
      reviewLabel: 'समीक्षा लिखें (वैकल्पिक)', reviewPlaceholder: 'आपको क्या पसंद आया? आप इसे किसे सुझाएंगे?',
      nameLabel: 'समीक्षा के साथ दिखाने के लिए नाम (वैकल्पिक)', namePlaceholder: 'जैसे, लुधियाना से प्रिया',
      reviewNote: 'आपके सितारे तुरंत गिने जाते हैं। लिखी हुई समीक्षा स्वीकृत होने के बाद वेबसाइट पर दिखती है।',
      save: 'रेटिंग सेव करें', remove: 'मेरी रेटिंग हटाएं', close: 'बंद करें', saved: 'धन्यवाद! आपकी रेटिंग सेव हो गई।',
      removed: 'आपकी रेटिंग हटा दी गई।', error: 'सेव नहीं हो सका — कृपया इंटरनेट जांचें और फिर कोशिश करें।', pickStars: 'कृपया 1 से 5 सितारे चुनें।',
      reviewsTitle: (t) => `“${t}” की समीक्षाएं`, noReviews: 'अभी कोई लिखी हुई समीक्षा नहीं है।', average: (a, n) => `★ 5 में से ${a} · ${n}`,
      pendingNote: 'आपकी समीक्षा स्वीकृति की प्रतीक्षा में है।', rejectedNote: 'आपकी समीक्षा वेबसाइट के लिए स्वीकृत नहीं हुई — आपके सितारे फिर भी गिने जाते हैं।',
    },
    pa: {
      rate: 'ਰੇਟਿੰਗ ਦਿਓ', yourRating: 'ਤੁਹਾਡੀ ਰੇਟਿੰਗ', ratings: (n) => `${n} ਰੇਟਿੰਗ`,
      rateTitle: (t) => `“${t}” ਨੂੰ ਰੇਟਿੰਗ ਦਿਓ`, tapStars: 'ਰੇਟਿੰਗ ਲਈ ਤਾਰੇ ਦਬਾਓ', stars: ['ਮਾੜੀ', 'ਠੀਕ-ਠਾਕ', 'ਚੰਗੀ', 'ਬਹੁਤ ਚੰਗੀ', 'ਸ਼ਾਨਦਾਰ'],
      reviewLabel: 'ਸਮੀਖਿਆ ਲਿਖੋ (ਵਿਕਲਪਿਕ)', reviewPlaceholder: 'ਤੁਹਾਨੂੰ ਕੀ ਪਸੰਦ ਆਇਆ? ਤੁਸੀਂ ਇਹ ਕਿਸਨੂੰ ਸੁਝਾਓਗੇ?',
      nameLabel: 'ਸਮੀਖਿਆ ਨਾਲ ਦਿਖਾਉਣ ਲਈ ਨਾਮ (ਵਿਕਲਪਿਕ)', namePlaceholder: 'ਜਿਵੇਂ, ਲੁਧਿਆਣਾ ਤੋਂ ਪ੍ਰਿਆ',
      reviewNote: 'ਤੁਹਾਡੇ ਤਾਰੇ ਤੁਰੰਤ ਗਿਣੇ ਜਾਂਦੇ ਹਨ। ਲਿਖੀ ਸਮੀਖਿਆ ਮਨਜ਼ੂਰੀ ਤੋਂ ਬਾਅਦ ਵੈੱਬਸਾਈਟ \'ਤੇ ਦਿਖਦੀ ਹੈ।',
      save: 'ਰੇਟਿੰਗ ਸੇਵ ਕਰੋ', remove: 'ਮੇਰੀ ਰੇਟਿੰਗ ਹਟਾਓ', close: 'ਬੰਦ ਕਰੋ', saved: 'ਧੰਨਵਾਦ! ਤੁਹਾਡੀ ਰੇਟਿੰਗ ਸੇਵ ਹੋ ਗਈ।',
      removed: 'ਤੁਹਾਡੀ ਰੇਟਿੰਗ ਹਟਾ ਦਿੱਤੀ ਗਈ।', error: 'ਸੇਵ ਨਹੀਂ ਹੋ ਸਕਿਆ — ਕਿਰਪਾ ਕਰਕੇ ਇੰਟਰਨੈੱਟ ਜਾਂਚੋ ਅਤੇ ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ।', pickStars: 'ਕਿਰਪਾ ਕਰਕੇ 1 ਤੋਂ 5 ਤਾਰੇ ਚੁਣੋ।',
      reviewsTitle: (t) => `“${t}” ਦੀਆਂ ਸਮੀਖਿਆਵਾਂ`, noReviews: 'ਅਜੇ ਕੋਈ ਲਿਖੀ ਸਮੀਖਿਆ ਨਹੀਂ ਹੈ।', average: (a, n) => `★ 5 ਵਿੱਚੋਂ ${a} · ${n}`,
      pendingNote: 'ਤੁਹਾਡੀ ਸਮੀਖਿਆ ਮਨਜ਼ੂਰੀ ਦੀ ਉਡੀਕ ਵਿੱਚ ਹੈ।', rejectedNote: 'ਤੁਹਾਡੀ ਸਮੀਖਿਆ ਵੈੱਬਸਾਈਟ ਲਈ ਮਨਜ਼ੂਰ ਨਹੀਂ ਹੋਈ — ਤੁਹਾਡੇ ਤਾਰੇ ਫਿਰ ਵੀ ਗਿਣੇ ਜਾਂਦੇ ਹਨ।',
    },
  };

  const CSS = `
  .klrt-badge { display: inline-flex; align-items: center; gap: 4px; background: none; border: none; padding: 2px 0; cursor: pointer;
    color: #F0C25E; font: 600 12px/1.2 'Inter', -apple-system, sans-serif; }
  .klrt-badge span { color: inherit; opacity: .75; font-weight: 400; }
  .klrt-badge:hover { text-decoration: underline; }
  .klrt-rate-btn { display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; padding: 5px 10px; border-radius: 14px; cursor: pointer;
    background: none; border: 1px solid rgba(240,194,94,0.4); color: #F0C25E; font: 600 11.5px/1.2 'Inter', -apple-system, sans-serif; }
  .klrt-rate-btn:hover { background: rgba(240,194,94,0.1); }
  .klrt-overlay { position: fixed; inset: 0; z-index: 220; background: rgba(0,0,0,0.55); display: none; align-items: flex-end; justify-content: center; }
  .klrt-overlay.open { display: flex; }
  .klrt-sheet { position: relative; width: 100%; max-width: 440px; max-height: 90vh; overflow-y: auto; background: #141F2C; color: #E9E2D0;
    border-radius: 16px 16px 0 0; padding: 22px 20px calc(22px + env(safe-area-inset-bottom, 0px)); font-family: 'Inter', -apple-system, sans-serif;
    box-shadow: 0 -10px 40px rgba(0,0,0,0.35); }
  @media (min-width: 600px) { .klrt-overlay { align-items: center; } .klrt-sheet { border-radius: 16px; } }
  .klrt-close { position: absolute; top: 8px; right: 10px; width: 34px; height: 34px; background: none; border: none; color: #93A0A8; font-size: 24px; line-height: 1; cursor: pointer; }
  .klrt-title { font: 600 18px/1.3 'Literata', Georgia, serif; margin: 0 28px 6px 0; }
  .klrt-sub { font-size: 12.5px; color: #93A0A8; margin-bottom: 14px; }
  .klrt-stars { display: flex; justify-content: center; gap: 6px; margin: 6px 0 4px; }
  .klrt-star { background: none; border: none; cursor: pointer; font-size: 38px; line-height: 1; color: #3A4756; padding: 0 2px; }
  .klrt-star.on { color: #F0C25E; }
  .klrt-star-label { text-align: center; font-size: 13px; color: #F0C25E; min-height: 18px; margin-bottom: 14px; }
  .klrt-field { display: block; font-size: 12px; color: #93A0A8; margin: 12px 0 6px; }
  .klrt-input { width: 100%; box-sizing: border-box; background: #0A121C; color: #E9E2D0; border: 1px solid rgba(233,226,208,0.14); border-radius: 10px;
    padding: 10px 12px; font: 14px/1.45 'Inter', -apple-system, sans-serif; outline: none; -webkit-user-select: text; user-select: text; }
  .klrt-input:focus { border-color: #F0C25E; }
  textarea.klrt-input { min-height: 90px; resize: vertical; }
  .klrt-note { font-size: 11.5px; color: #93A0A8; line-height: 1.5; margin: 10px 0 14px; }
  .klrt-status { font-size: 12px; color: #F0C25E; margin-top: 8px; }
  .klrt-save { width: 100%; padding: 12px; border: none; border-radius: 10px; cursor: pointer; font: 700 15px 'Inter', -apple-system, sans-serif; color: #1B140A;
    background: linear-gradient(180deg, #F0C25E, #C79A42); }
  .klrt-save:disabled { opacity: .6; cursor: default; }
  .klrt-remove { display: block; margin: 12px auto 0; background: none; border: none; color: #93A0A8; font-size: 12.5px; text-decoration: underline; cursor: pointer; }
  .klrt-msg { text-align: center; font-size: 13px; color: #F0C25E; min-height: 18px; margin-top: 10px; }
  .klrt-review { padding: 12px 0; border-top: 1px solid rgba(233,226,208,0.08); }
  .klrt-review-head { display: flex; justify-content: space-between; gap: 10px; font-size: 12.5px; margin-bottom: 5px; }
  .klrt-review-stars { color: #F0C25E; letter-spacing: 1px; }
  .klrt-review-text { font-size: 14px; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; }
  .klrt-empty { font-size: 13px; color: #93A0A8; padding: 12px 0; }`;

  // Styles go in straight away — the badges and Rate buttons on cards need them before any panel opens.
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  let opts = { getLang: () => 'en', readerId: null, onChange: () => {}, findItem: () => null };
  let summaries = {};   // 'book:<id>' → { average, count }
  let mine = {};        // 'book:<id>' → { stars, review, reviewer_name, review_status }
  let sheet = null;
  let available = false; // true once the ratings database (migration 0014) answers

  const s = () => STRINGS[opts.getLang()] || STRINGS.en;
  const key = (type, id) => `${type}:${id}`;
  const escape = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const starText = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

  async function load() {
    const { data, error } = await window.sb.rpc('rating_summaries');
    if (error) return; // ratings not set up yet — badges and Rate buttons simply don't show
    available = true;
    summaries = Object.fromEntries((data || []).map((r) => [key(r.item_type, r.item_id), { average: Number(r.average), count: r.rating_count }]));
  }

  async function loadMine(readerId) {
    opts.readerId = readerId || opts.readerId;
    if (!opts.readerId) { mine = {}; return; }
    const { data, error } = await window.sb.from('ratings').select('item_type, item_id, stars, review, reviewer_name, review_status').eq('reader_id', opts.readerId);
    if (error) return;
    mine = Object.fromEntries((data || []).map((r) => [key(r.item_type, r.item_id), r]));
  }

  function badgeHTML(type, id) {
    const sum = summaries[key(type, id)];
    if (!sum || !sum.count) return '';
    return `<button type="button" class="klrt-badge" data-klrt-reviews="${type}" data-id="${escape(id)}" title="${escape(s().ratings(sum.count))}">★ ${sum.average.toFixed(1)} <span>(${sum.count})</span></button>`;
  }

  function rateButtonHTML(type, id) {
    if (!available) return '';
    const m = mine[key(type, id)];
    const label = m ? `${starText(m.stars)} ${s().yourRating}` : `☆ ${s().rate}`;
    return `<button type="button" class="klrt-rate-btn" data-klrt-rate="${type}" data-id="${escape(id)}">${escape(label)}</button>`;
  }

  function ensureSheet() {
    if (sheet) return sheet;
    const overlay = document.createElement('div');
    overlay.className = 'klrt-overlay';
    overlay.innerHTML = '<div class="klrt-sheet" role="dialog" aria-modal="true"><button class="klrt-close" type="button">×</button><div class="klrt-body"></div></div>';
    document.body.appendChild(overlay);
    sheet = { overlay, body: overlay.querySelector('.klrt-body'), close: overlay.querySelector('.klrt-close') };
    sheet.close.addEventListener('click', closeSheet);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSheet(); });
    overlay.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') closeSheet(); });
    return sheet;
  }
  function closeSheet() { if (sheet) sheet.overlay.classList.remove('open'); }
  function openSheet(html) {
    const sh = ensureSheet();
    sh.close.setAttribute('aria-label', s().close);
    sh.body.innerHTML = html;
    sh.overlay.classList.add('open');
    return sh.body;
  }

  async function openReviews(type, id) {
    const item = opts.findItem(type, id) || {};
    const str = s();
    const sum = summaries[key(type, id)];
    const body = openSheet(`<div class="klrt-title">${escape(str.reviewsTitle(item.title || ''))}</div>
      <div class="klrt-sub">${sum ? escape(str.average(sum.average.toFixed(1), str.ratings(sum.count))) : ''}</div><div class="klrt-list"></div>`);
    const { data } = await window.sb.rpc('approved_reviews', { p_item_type: type, p_item_id: id });
    const list = body.querySelector('.klrt-list');
    list.innerHTML = (data || []).length
      ? data.map((r) => `<div class="klrt-review"><div class="klrt-review-head"><strong>${escape(r.reviewer_name)}</strong><span class="klrt-review-stars">${starText(r.stars)}</span></div><div class="klrt-review-text">${escape(r.review)}</div></div>`).join('')
      : `<div class="klrt-empty">${escape(str.noReviews)}</div>`;
  }

  function openRate(type, id) {
    const item = opts.findItem(type, id) || {};
    const str = s();
    const existing = mine[key(type, id)];
    let stars = existing ? existing.stars : 0;
    const statusNote = existing && existing.review_status === 'pending' ? str.pendingNote
      : existing && existing.review_status === 'rejected' ? str.rejectedNote : '';
    const body = openSheet(`<div class="klrt-title">${escape(str.rateTitle(item.title || ''))}</div>
      <div class="klrt-sub">${escape(str.tapStars)}</div>
      <div class="klrt-stars">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="klrt-star" data-n="${n}" aria-label="${n}">★</button>`).join('')}</div>
      <div class="klrt-star-label"></div>
      <label class="klrt-field">${escape(str.reviewLabel)}</label>
      <textarea class="klrt-input klrt-review-input" maxlength="1000" placeholder="${escape(str.reviewPlaceholder)}">${escape(existing?.review || '')}</textarea>
      <label class="klrt-field">${escape(str.nameLabel)}</label>
      <input class="klrt-input klrt-name-input" maxlength="40" placeholder="${escape(str.namePlaceholder)}" value="${escape(existing?.reviewer_name || '')}">
      ${statusNote ? `<div class="klrt-status">${escape(statusNote)}</div>` : ''}
      <div class="klrt-note">${escape(str.reviewNote)}</div>
      <button type="button" class="klrt-save">${escape(str.save)}</button>
      ${existing ? `<button type="button" class="klrt-remove">${escape(str.remove)}</button>` : ''}
      <div class="klrt-msg" aria-live="polite"></div>`);
    const paint = () => {
      body.querySelectorAll('.klrt-star').forEach((b) => b.classList.toggle('on', Number(b.dataset.n) <= stars));
      body.querySelector('.klrt-star-label').textContent = stars ? str.stars[stars - 1] : '';
    };
    body.querySelectorAll('.klrt-star').forEach((b) => b.addEventListener('click', () => { stars = Number(b.dataset.n); paint(); }));
    paint();
    const msg = body.querySelector('.klrt-msg');
    const saveBtn = body.querySelector('.klrt-save');
    saveBtn.addEventListener('click', async () => {
      if (!stars) { msg.textContent = str.pickStars; return; }
      saveBtn.disabled = true;
      const { error } = await window.sb.from('ratings').upsert({
        reader_id: opts.readerId, item_type: type, item_id: id, stars,
        review: body.querySelector('.klrt-review-input').value.trim() || null,
        reviewer_name: body.querySelector('.klrt-name-input').value.trim() || null,
      }, { onConflict: 'reader_id,item_type,item_id' });
      saveBtn.disabled = false;
      if (error) { msg.textContent = str.error; return; }
      msg.textContent = str.saved;
      await Promise.all([load(), loadMine()]);
      opts.onChange();
      setTimeout(closeSheet, 900);
    });
    body.querySelector('.klrt-remove')?.addEventListener('click', async () => {
      const { error } = await window.sb.from('ratings').delete().eq('reader_id', opts.readerId).eq('item_type', type).eq('item_id', id);
      if (error) { msg.textContent = str.error; return; }
      msg.textContent = str.removed;
      await Promise.all([load(), loadMine()]);
      opts.onChange();
      setTimeout(closeSheet, 900);
    });
  }

  // One listener for every badge/button on the page (capture: a card underneath must not open too).
  document.addEventListener('click', (e) => {
    const reviews = e.target.closest('[data-klrt-reviews]');
    const rate = e.target.closest('[data-klrt-rate]');
    if (!reviews && !rate) return;
    e.stopPropagation();
    e.preventDefault();
    if (reviews) openReviews(reviews.dataset.klrtReviews, reviews.dataset.id);
    else openRate(rate.dataset.klrtRate, rate.dataset.id);
  }, true);

  window.KLRatings = { init: (o) => { opts = Object.assign(opts, o || {}); }, load, loadMine, badgeHTML, rateButtonHTML, openReviews, openRate, close: closeSheet };
})();
