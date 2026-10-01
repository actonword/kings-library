/* Rich text editor for book content (admin panel).
   Edits the same stored format the reader app displays: paragraphs separated by blank
   lines, each either inline text (<b> <i> <u> <sup> <sub> <br>, colours as <kl-red> etc., text sizes
   as <kl-small> <kl-large> <kl-xl> <kl-xxl>) or wrapped as
   <p class="…"> with layout classes, plus two marker paragraphs:
     [[pagebreak]]  — the reader starts a new page here
     [[contents]]   — the reader shows the book's chapter list here
   Paragraph classes: center right left justify indent inset tight (layout),
   heading (sub-heading inside a section), section (starts a NEW section — the admin
   splits the text into separate chapters there when saving).

   Pictures are a paragraph of their own:
     [[image:URL|WIDTHxHEIGHT|size|caption]]   size = small | medium | full
   and only pictures stored in the library's own storage are kept (see isLibraryImage).

   KLEditor.create(container, { content, placeholder, uploadImage }) → { getContent(), setContent(s), focus(), element }
   uploadImage(file) → Promise<{ url, w, h }> turns on the Image button, pasting and dropping pictures.
   Pasting from Word / Google Docs keeps bold, italics, underline, headings, alignment. */
(function () {
  const LAYOUT = ['center', 'right', 'left', 'justify'];
  const TOGGLES = ['indent', 'inset', 'tight'];
  const KINDS = ['heading', 'section'];
  const ALLOWED = new Set([...LAYOUT, ...TOGGLES, ...KINDS]);
  const MARKERS = { pagebreak: 'Page break — the next text starts on a new page', contents: 'Contents — the list of chapters appears here automatically' };
  const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'PRE', 'TR', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER']);

  const CSS = `
  .kle { border: 1px solid rgba(233,226,208,0.14); border-radius: 10px; background: #0F1823; }
  .kle-color { position: relative; display: inline-flex; }
  .kle-btn[data-cmd="colormenu"] { position: relative; font: 700 15px/1 Georgia, serif; padding: 0 9px 3px; }
  .kle-color-bar { position: absolute; left: 7px; right: 7px; bottom: 4px; height: 3px; border-radius: 2px; }
  .kle-palette { position: absolute; top: 34px; left: 0; z-index: 10; display: grid; grid-template-columns: repeat(3, 30px); gap: 7px; padding: 9px;
    background: #141F2C; border: 1px solid rgba(233,226,208,0.18); border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
  .kle-palette[hidden] { display: none; }
  .kle-swatch { width: 30px; height: 30px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.25); cursor: pointer; padding: 0; }
  .kle-swatch:hover { transform: scale(1.1); border-color: #fff; }
  .kle-swatch-default { grid-column: 1 / -1; height: 28px; border-radius: 6px; border: 1px solid rgba(233,226,208,0.25); background: none; color: #E9E2D0; cursor: pointer; font: 600 12px 'Inter', sans-serif; }
  .kle-editor kl-red { color: #B3261E; } .kle-editor kl-blue { color: #1F5FA8; } .kle-editor kl-green { color: #2E7D32; }
  .kle-editor kl-gold { color: #9A6A00; } .kle-editor kl-purple { color: #6A3BA0; } .kle-editor kl-grey { color: #6B6B6B; }
  /* In pixels (the editor's text is 16px) so a size inside another size doesn't multiply. */
  .kle-editor kl-small, .kle-editor font[size="1"], .kle-editor font[size="2"] { font-size: 13.6px; }
  .kle-editor font[size="3"] { font-size: 16px; }
  .kle-editor kl-large, .kle-editor font[size="4"] { font-size: 19.2px; }
  .kle-editor kl-xl, .kle-editor font[size="5"] { font-size: 23.2px; }
  .kle-editor kl-xxl, .kle-editor font[size="6"], .kle-editor font[size="7"] { font-size: 28.8px; }
  .kle-btn[data-cmd="smaller"], .kle-btn[data-cmd="bigger"] { font-family: Georgia, serif; font-weight: 700; padding: 0 7px; }
  .kle-btn[data-cmd="smaller"] small { font-size: 11px; } .kle-btn[data-cmd="bigger"] span { font-size: 17px; }
  .kle-size-name { align-self: center; min-width: 52px; text-align: center; font: 600 11px 'Inter', sans-serif; color: #93A0A8; }
  .kle-toolbar { border-radius: 10px 10px 0 0; display: flex; flex-wrap: wrap; gap: 4px; padding: 6px; border-bottom: 1px solid rgba(233,226,208,0.1); background: #141F2C; position: sticky; top: 0; z-index: 2; }
  .kle-btn { min-width: 32px; height: 30px; padding: 0 8px; border-radius: 6px; border: 1px solid transparent; background: none; color: #E9E2D0; cursor: pointer; font: 600 13px/1 'Inter', sans-serif; }
  .kle-btn:hover { background: rgba(240,194,94,0.1); }
  .kle-icon { display: inline-flex; align-items: center; justify-content: center; padding: 0 6px; }
  .kle-btn[aria-pressed="true"] { background: rgba(240,194,94,0.18); border-color: rgba(240,194,94,0.5); color: #F0C25E; }
  .kle-sep { width: 1px; background: rgba(233,226,208,0.12); margin: 3px 3px; }
  .kle-select { height: 30px; border-radius: 6px; background: #0A121C; color: #E9E2D0; border: 1px solid rgba(233,226,208,0.16); font: 13px 'Inter', sans-serif; padding: 0 6px; }
  .kle-editor { min-height: 220px; max-height: 70vh; overflow-y: auto; padding: 18px 22px; outline: none; background: #F4ECDA; color: #241E14;
    font: 16px/1.75 'Literata', Georgia, serif; }
  .kle-editor.tall { min-height: 420px; }
  .kle-editor:empty::before { content: attr(data-placeholder); color: #8C8270; }
  .kle-editor p { margin: 0 0 12px; text-align: justify; min-height: 1em; }
  .kle-editor p.center { text-align: center; } .kle-editor p.right { text-align: right; } .kle-editor p.left { text-align: left; } .kle-editor p.justify { text-align: justify; }
  .kle-editor p.indent { text-indent: 1.6em; } .kle-editor p.inset { margin-left: 2em; margin-right: 2em; } .kle-editor p.tight { margin-bottom: 0; }
  .kle-editor p.heading { font-weight: 700; font-size: 1.12em; margin-top: 10px; }
  .kle-editor p.section { font-weight: 700; font-size: 1.3em; text-align: center; margin-top: 18px; padding-top: 22px; border-top: 2px dashed #C79A42; position: relative; }
  .kle-editor p.section::before { content: 'NEW SECTION · starts on a new page'; position: absolute; top: 4px; left: 0; right: 0; text-align: center;
    font: 700 9.5px/1 'Inter', sans-serif; letter-spacing: .08em; color: #A07A2C; }
  .kle-marker { margin: 14px 0; padding: 8px; border: 2px dashed #C79A42; border-radius: 6px; text-align: center; color: #8A6A2A;
    font: 600 12px 'Inter', sans-serif; background: rgba(199,154,66,0.08); user-select: none; cursor: default; }
  .kle-editor .kle-figure { margin: 14px auto; padding: 8px; text-align: center; border: 1px dashed transparent; border-radius: 8px; user-select: none; }
  .kle-editor .kle-figure:hover, .kle-editor .kle-figure:focus-within { border-color: #C79A42; background: rgba(199,154,66,0.06); }
  .kle-figure img { display: block; margin: 0 auto 8px; height: auto; max-height: 420px; object-fit: contain; border-radius: 3px; }
  .kle-figure.kle-size-small img { width: 40%; } .kle-figure.kle-size-medium img { width: 70%; } .kle-figure.kle-size-full img { width: 100%; }
  .kle-fig-tools { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; margin-bottom: 6px; }
  .kle-fig-btn { height: 24px; padding: 0 9px; border-radius: 5px; border: 1px solid rgba(36,30,20,0.25); background: #FFF8EA; color: #3A3020; cursor: pointer; font: 600 11.5px 'Inter', sans-serif; }
  .kle-fig-btn[aria-pressed="true"] { background: #241E14; color: #F0C25E; border-color: #241E14; }
  .kle-fig-remove { color: #B3261E; }
  .kle-caption { width: 80%; border: none; border-bottom: 1px dashed #C79A42; background: transparent; text-align: center; padding: 3px 4px; outline: none;
    font: italic 14px 'Literata', Georgia, serif; color: #5A5040; }
  .kle-pop-wrap { position: relative; display: inline-flex; }
  .kle-emoji-pop { position: absolute; top: 34px; left: 0; z-index: 10; display: grid; grid-template-columns: repeat(7, 34px); gap: 2px; padding: 8px;
    background: #141F2C; border: 1px solid rgba(233,226,208,0.18); border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
  .kle-emoji-pop[hidden] { display: none; }
  .kle-emoji { width: 34px; height: 34px; border: none; border-radius: 6px; background: none; cursor: pointer; font-size: 20px; line-height: 1;
    font-family: 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif; }
  .kle-emoji:hover { background: rgba(240,194,94,0.15); }
  .kle-emoji-note { grid-column: 1 / -1; font: 11px 'Inter', sans-serif; color: #93A0A8; padding-top: 4px; }
  .kle-help.busy { color: #F0C25E; } .kle-help.error { color: #F28B82; }
  .kle-help { font-size: 11.5px; color: #93A0A8; padding: 6px 10px; border-top: 1px solid rgba(233,226,208,0.08); }`;

  // Alignment icons drawn as lines (like Word) — symbol characters don't display on every computer.
  const lines = (rows) => `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">${rows.map(([x1, x2], i) => `<path d="M${x1} ${3 + i * 4}h${x2 - x1}"/>`).join('')}</svg>`;
  const ICONS = {
    left: lines([[2, 16], [2, 11], [2, 16], [2, 11]]),
    center: lines([[2, 16], [5, 13], [2, 16], [5, 13]]),
    right: lines([[2, 16], [7, 16], [2, 16], [7, 16]]),
    justify: lines([[2, 16], [2, 16], [2, 16], [2, 16]]),
  };

  ICONS.image = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="2" y="3" width="14" height="12" rx="1.5"/><circle cx="6.5" cy="7" r="1.4"/><path d="M2.5 13.5l4-4 3 3 2-2 4 3.5"/></svg>';
  ICONS.emoji = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="9" cy="9" r="7"/><path d="M6 10.5c.8 1.3 1.8 2 3 2s2.2-.7 3-2"/><path d="M6.5 7h0M11.5 7h0" stroke-width="2.2"/></svg>';
  const EMOJIS = ['🙏', '✝️', '❤️', '📖', '✨', '⭐', '🕊️', '🔥', '🌿', '🌅', '👑', '🙌', '👉', '✅', '✔️', '❗', '❓', '💡', '📌', '🎯', '😊', '👏', '💪', '🌍', '🎉', '💧', '🍞', '⛪'];

  let styleAdded = false;
  const escapeText = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const escapeAttr = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- Pictures ----------
  const IMAGE_SIZES = ['small', 'medium', 'full'];
  const IMAGE_SIZE_NAMES = { small: 'Small', medium: 'Medium', full: 'Full width' };
  const IMAGE_RE = /^\[\[image:([^|\]\s]+)\|(\d+)x(\d+)\|(small|medium|full)\|([^\]|]*)\]\]$/;
  // Pictures must live in the library's storage (the public "covers" bucket) — never links to other sites.
  const imageBase = () => window.KL_IMAGE_BASE || ((typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '') + '/storage/v1/object/public/covers/');
  const isLibraryImage = (src) => { const base = imageBase(); return /^https:\/\//.test(base) && String(src || '').startsWith(base) && !/[\s|\]"'<>]/.test(src); };
  const cleanCaption = (s) => String(s || '').replace(/[|[\]]/g, '').replace(/[\s ]+/g, ' ').trim().slice(0, 300);
  // A starting size from the picture's width in pixels (small clipart stays small).
  const sizeFor = (w) => (Number(w) && w < 360 ? 'small' : 'medium');
  function imageMarker(img) {
    const w = Math.max(1, Math.round(Number(img.w) || 800)), h = Math.max(1, Math.round(Number(img.h) || 600));
    return `[[image:${img.src}|${w}x${h}|${IMAGE_SIZES.includes(img.size) ? img.size : sizeFor(w)}|${cleanCaption(img.caption)}]]`;
  }
  function parseImageMarker(p) {
    const m = String(p || '').trim().match(IMAGE_RE);
    if (!m || !isLibraryImage(m[1])) return null;
    return { src: m[1], w: Number(m[2]), h: Number(m[3]), size: m[4], caption: m[5].trim() };
  }
  const figureHtml = (img) => `<figure class="kle-figure kle-size-${img.size}" contenteditable="false" data-src="${escapeAttr(img.src)}" data-w="${img.w}" data-h="${img.h}" data-size="${img.size}">`
    + `<img src="${escapeAttr(img.src)}" alt="" draggable="false" style="max-width:min(100%, ${img.w}px)">`
    + `<div class="kle-fig-tools">${IMAGE_SIZES.map((s) => `<button type="button" class="kle-fig-btn" data-fig-size="${s}" aria-pressed="${s === img.size}">${IMAGE_SIZE_NAMES[s]}</button>`).join('')}`
    + `<button type="button" class="kle-fig-btn kle-fig-remove" data-fig-remove="1">Remove</button></div>`
    + `<input type="text" class="kle-caption" placeholder="Caption under the picture (optional)" value="${escapeAttr(img.caption || '')}">`
    + `</figure>`;
  // Picture data from the editor's own <figure>, or from an <img> in pasted / imported HTML.
  function figureData(fig) {
    if (!isLibraryImage(fig.dataset.src)) return null;
    const cap = fig.querySelector('.kle-caption');
    return { src: fig.dataset.src, w: fig.dataset.w, h: fig.dataset.h, size: fig.dataset.size, caption: cap ? cap.value : '' };
  }
  function imgData(img, captionEl) {
    const src = img.getAttribute('src');
    if (!isLibraryImage(src)) return null;
    const w = Number(img.dataset.w || img.getAttribute('width')) || img.naturalWidth || 0;
    const h = Number(img.dataset.h || img.getAttribute('height')) || img.naturalHeight || 0;
    return { src, w, h, size: img.dataset.size || sizeFor(w), caption: img.dataset.caption || (captionEl ? captionEl.textContent : '') };
  }
  // Is there any text in `root` before `target`?
  function textBefore(root, target) {
    const tw = (root.ownerDocument || document).createTreeWalker(root, 5 /* elements + text */);
    let node;
    while ((node = tw.nextNode())) {
      if (node === target) return false;
      if (node.nodeType === 3 && node.nodeValue.trim()) return true;
    }
    return false;
  }

  // ---------- Text colours ----------
  // A fixed palette (stored as <kl-red> … tags) so colours stay readable on the reader's
  // parchment, sepia and dark themes. Colours from Word or the colour button are matched to
  // the nearest palette colour; black / dark grey / white count as normal text.
  const PALETTE = {
    red: [179, 38, 30], blue: [31, 95, 168], green: [46, 125, 50],
    gold: [154, 106, 0], purple: [106, 59, 160], grey: [107, 107, 107],
  };
  const PALETTE_NAMES = { red: 'Red', blue: 'Blue', green: 'Green', gold: 'Gold', purple: 'Purple', grey: 'Grey' };
  const DEFAULT_COLOR = '#010203'; // what the "Default" swatch applies — read back as "no colour"
  const hex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');

  // ---------- Text size ----------
  // Five steps, stored as <kl-small> <kl-large> <kl-xl> <kl-xxl> (normal = no tag). Sizes are
  // relative, so the reader's own text-size setting still makes everything bigger or smaller.
  const SIZE_STEPS = ['small', '', 'large', 'xl', 'xxl'];
  const SIZE_NAMES = { small: 'Small', '': 'Normal', large: 'Large', xl: 'Larger', xxl: 'Largest' };
  // The browser's "font size" command (1–7) is how the A− / A+ buttons size the selection.
  const FONT_TAG_SIZE = { 1: 'small', 2: 'small', 3: '', 4: 'large', 5: 'xl', 6: 'xxl', 7: 'xxl' };
  const SIZE_FONT_TAG = { small: '2', '': '3', large: '4', xl: '5', xxl: '6' };

  function parseColor(s) {
    s = String(s || '').trim().toLowerCase();
    let m = s.match(/^#?([0-9a-f]{6})$/);
    if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    m = s.match(/^#?([0-9a-f]{3})$/);
    if (m) return [...m[1]].map((c) => parseInt(c + c, 16));
    m = s.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (m) return [m[1], m[2], m[3]].map(Number);
    return null;
  }
  // → palette name, '' for "normal text colour", or undefined if the value means nothing.
  function paletteColor(value) {
    const s = String(value || '').trim().toLowerCase();
    if (!s) return undefined;
    if (['auto', 'inherit', 'initial', 'currentcolor', 'windowtext', 'black'].includes(s)) return '';
    const rgb = parseColor(s);
    if (!rgb) return undefined;
    if (hex(rgb) === DEFAULT_COLOR) return '';
    const spread = Math.max(...rgb) - Math.min(...rgb);
    if (spread < 40) { // a grey
      const level = Math.max(...rgb);
      return level < 90 || level > 200 ? '' : 'grey';
    }
    let best = '', bestDist = Infinity;
    for (const [name, p] of Object.entries(PALETTE)) {
      if (name === 'grey') continue;
      const dist = p.reduce((sum, v, i) => sum + (v - rgb[i]) ** 2, 0);
      if (dist < bestDist) { best = name; bestDist = dist; }
    }
    return best;
  }

  // ---------- inline formatting: anything → <b> <i> <u> <sup> <sub> <kl-colour> <br> ----------
  // Text is flattened into runs with their effective formatting (inner settings win), then
  // rebuilt in one fixed nesting order — so pasted or edited HTML always comes out tidy.
  function collectRuns(node, fmt, runs) {
    node.childNodes.forEach((n) => {
      // Line breaks and runs of spaces in HTML source are just spacing (as a browser shows them) —
      // Word's copied HTML wraps lines mid-paragraph, which must not become breaks in the book.
      if (n.nodeType === 3) { if (n.nodeValue) runs.push({ ...fmt, t: n.nodeValue.replace(/[\s\u00a0]+/g, ' ') }); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (tag === 'BR') { runs.push({ br: true }); return; }
      if (tag === 'STYLE' || tag === 'SCRIPT' || tag === 'META' || tag === 'TITLE' || tag.includes(':')) return; // Word's <o:p> etc.
      const f = { ...fmt };
      const st = n.style || {};
      const weight = String(st.fontWeight || '');
      if (tag === 'B' || tag === 'STRONG') f.b = true;
      if (weight === 'bold' || Number(weight) >= 600) f.b = true;
      if (weight === 'normal' || (Number(weight) && Number(weight) < 600)) f.b = false; // e.g. Google Docs' outer <b style="font-weight:normal">
      if (tag === 'I' || tag === 'EM' || st.fontStyle === 'italic') f.i = true;
      if (st.fontStyle === 'normal') f.i = false;
      if (tag === 'U' || /underline/.test(st.textDecoration || st.textDecorationLine || '')) f.u = true;
      if (tag === 'SUP' || st.verticalAlign === 'super') f.va = 'sup';
      if (tag === 'SUB' || st.verticalAlign === 'sub') f.va = 'sub';
      const kl = tag.match(/^KL-([A-Z]+)$/);
      if (kl && PALETTE[kl[1].toLowerCase()]) f.color = kl[1].toLowerCase();
      if (kl && SIZE_STEPS.includes(kl[1].toLowerCase())) f.sz = kl[1].toLowerCase();
      if (tag === 'FONT' && n.getAttribute('size') in FONT_TAG_SIZE) f.sz = FONT_TAG_SIZE[n.getAttribute('size')];
      const c = paletteColor(n.getAttribute('color') || st.color);
      if (c !== undefined) f.color = c;
      collectRuns(n, f, runs);
    });
    return runs;
  }
  function renderRuns(runs) {
    const same = (a, b) => !a.br && !b.br && !!a.b === !!b.b && !!a.i === !!b.i && !!a.u === !!b.u && (a.va || '') === (b.va || '') && (a.color || '') === (b.color || '') && (a.sz || '') === (b.sz || '');
    const merged = [];
    runs.forEach((r) => { const last = merged[merged.length - 1]; if (last && same(last, r)) last.t += r.t; else merged.push({ ...r }); });
    return merged.map((r) => {
      if (r.br) return '<br>';
      let h = escapeText(r.t);
      if (!r.t.trim()) return h;
      if (r.va) h = `<${r.va}>${h}</${r.va}>`;
      if (r.u) h = `<u>${h}</u>`;
      if (r.i) h = `<i>${h}</i>`;
      if (r.b) h = `<b>${h}</b>`;
      if (r.sz) h = `<kl-${r.sz}>${h}</kl-${r.sz}>`;
      if (r.color) h = `<kl-${r.color}>${h}</kl-${r.color}>`;
      return h;
    }).join('');
  }
  const inlineHtml = (node) => renderRuns(collectRuns(node, {}, []));
  // Trim leading/trailing line breaks and spaces.
  const tidyInline = (h) => h.replace(/^(\s|<br>)+|(\s|<br>)+$/g, '');

  function classesOf(el) {
    const cls = new Set([...el.classList].filter((c) => ALLOWED.has(c)));
    const align = (el.style && el.style.textAlign) || el.getAttribute('align') || '';
    if (/center/i.test(align)) cls.add('center');
    else if (/right/i.test(align)) cls.add('right');
    else if (/justify/i.test(align)) cls.add('justify');
    if (/^H[1-6]$/.test(el.tagName) && !cls.has('section')) cls.add('heading');
    if (/MsoTitle|Title/.test(el.className) && !cls.has('section')) cls.add('heading');
    // Word marks indents with margins; a clear first-line indent or block indent becomes ours.
    const ti = parseFloat((el.style && el.style.textIndent) || '0');
    if (ti > 8) cls.add('indent');
    const ml = parseFloat((el.style && el.style.marginLeft) || '0');
    if (ml > 24 && !cls.has('indent')) cls.add('inset');
    // Only one alignment.
    const aligns = LAYOUT.filter((a) => cls.has(a));
    aligns.slice(0, -1).forEach((a) => cls.delete(a));
    return [...cls];
  }

  // ---------- DOM (editor or pasted HTML) → stored paragraphs ----------
  function paragraphsFrom(root) {
    const paras = [];
    let loose = '';
    const flushLoose = () => { const t = tidyInline(loose); if (t.replace(/<br>/g, '').trim()) paras.push(t); loose = ''; };
    const walk = (parent) => {
      parent.childNodes.forEach((n) => {
        if (n.nodeType === 3) { loose += escapeText(n.nodeValue.replace(/[\s\u00a0]+/g, ' ')); return; }
        if (n.nodeType !== 1) return;
        if (n.dataset && n.dataset.marker) { flushLoose(); paras.push(`[[${n.dataset.marker}]]`); return; }
        // Pictures: always a paragraph of their own.
        if (n.tagName === 'FIGURE') {
          flushLoose();
          const im = n.querySelector('img');
          const img = n.dataset.src ? figureData(n) : (im ? imgData(im, n.querySelector('figcaption')) : null);
          if (img) paras.push(imageMarker(img));
          else if (!n.dataset.src) walk(n);
          return;
        }
        if (n.tagName === 'IMG') { flushLoose(); const img = imgData(n); if (img) paras.push(imageMarker(img)); return; }
        if (n.tagName === 'UL' || n.tagName === 'OL' || n.tagName === 'TABLE' || n.tagName === 'TBODY') { flushLoose(); walk(n); return; }
        if (BLOCK_TAGS.has(n.tagName)) {
          flushLoose();
          // A block that itself contains blocks (e.g. a wrapper div) — go inside instead.
          if ([...n.children].some((c) => BLOCK_TAGS.has(c.tagName) || c.tagName === 'FIGURE' || (c.dataset && c.dataset.marker))) { walk(n); return; }
          const text = n.textContent.trim();
          if (/^\[\[(pagebreak|contents)\]\]$/.test(text) || parseImageMarker(text)) { paras.push(text); return; }
          let inner = tidyInline(inlineHtml(n));
          let textPara = null;
          if (inner.replace(/<br>/g, '').trim()) {
            if (n.tagName === 'LI') inner = '• ' + inner;
            const cls = classesOf(n);
            textPara = cls.length ? `<p class="${cls.join(' ')}">${inner}</p>` : inner;
          }
          // Pictures inside a paragraph come out as their own paragraphs, before or after its text.
          const imgs = [...n.querySelectorAll('img')];
          const pics = imgs.map((i) => imgData(i)).filter(Boolean).map(imageMarker);
          if (pics.length && !textBefore(n, imgs[0])) paras.push(...pics, ...(textPara ? [textPara] : []));
          else paras.push(...(textPara ? [textPara] : []), ...pics);
          return;
        }
        if (n.tagName === 'BR') { loose += '<br>'; return; }
        if (n.querySelector && n.querySelector('img')) { walk(n); return; } // e.g. <span><img></span>
        const tmp = document.createElement('span');
        tmp.appendChild(n.cloneNode(true));
        loose += inlineHtml(tmp);
      });
    };
    walk(root);
    flushLoose();
    return paras;
  }

  // ---------- stored paragraphs → editor HTML ----------
  function toEditorHtml(content) {
    const paras = String(content || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    return paras.map((p) => {
      const marker = p.match(/^\[\[(pagebreak|contents)\]\]$/);
      if (marker) return markerHtml(marker[1]);
      const img = parseImageMarker(p);
      if (img) return figureHtml(img);
      let cls = '';
      let inner = p;
      const m = p.match(/^<p(?:\s+class="([^"]*)")?\s*>([\s\S]*)<\/p>$/i);
      if (m) { cls = (m[1] || '').split(/\s+/).filter((c) => ALLOWED.has(c)).join(' '); inner = m[2]; }
      const tmp = document.createElement('div');
      tmp.innerHTML = inner.replace(/\n/g, '<br>');
      return `<p${cls ? ` class="${cls}"` : ''}>${tidyInline(inlineHtml(tmp)) || '<br>'}</p>`;
    }).join('') || '<p><br></p>';
  }
  const markerHtml = (kind) => `<div class="kle-marker" data-marker="${kind}" contenteditable="false">${MARKERS[kind]}</div>`;

  // Pasted plain text: blank lines separate paragraphs; single line breaks become new paragraphs too
  // (that's how most pasted text is laid out), except very short wrapped lines are kept as they are.
  function plainTextToHtml(text) {
    return text.replace(/\r\n?/g, '\n').split(/\n\s*\n|\n/).map((l) => l.trim()).filter(Boolean)
      .map((l) => `<p>${escapeText(l)}</p>`).join('');
  }

  function create(container, options = {}) {
    if (!styleAdded) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); styleAdded = true; }
    container.innerHTML = `
      <div class="kle">
        <div class="kle-toolbar" role="toolbar" aria-label="Formatting">
          <select class="kle-select" data-cmd="kind" title="Paragraph type">
            <option value="">Normal text</option>
            <option value="heading">Sub-heading</option>
            <option value="section">Section title (new page)</option>
          </select>
          <span class="kle-sep"></span>
          <button type="button" class="kle-btn" data-cmd="bold" title="Bold (Ctrl+B)"><b>B</b></button>
          <button type="button" class="kle-btn" data-cmd="italic" title="Italic (Ctrl+I)"><i>I</i></button>
          <button type="button" class="kle-btn" data-cmd="underline" title="Underline (Ctrl+U)"><u>U</u></button>
          <button type="button" class="kle-btn" data-cmd="smaller" title="Make the selected text smaller" aria-label="Smaller text"><small>A</small>−</button>
          <span class="kle-size-name" title="Size of the text where the cursor is">Normal</span>
          <button type="button" class="kle-btn" data-cmd="bigger" title="Make the selected text bigger" aria-label="Bigger text"><span>A</span>+</button>
          <span class="kle-color">
            <button type="button" class="kle-btn" data-cmd="colormenu" title="Text colour" aria-label="Text colour" aria-haspopup="true">A<span class="kle-color-bar" style="background:${hex(PALETTE.red)}"></span></button>
            <div class="kle-palette" hidden>
              ${Object.entries(PALETTE).map(([name, rgb]) => `<button type="button" class="kle-swatch" data-color="${name}" title="${PALETTE_NAMES[name]}" aria-label="${PALETTE_NAMES[name]}" style="background:${hex(rgb)}"></button>`).join('')}
              <button type="button" class="kle-swatch-default" data-color="">Default colour</button>
            </div>
          </span>
          <span class="kle-sep"></span>
          <button type="button" class="kle-btn kle-icon" data-align="left" title="Align left" aria-label="Align left">${ICONS.left}</button>
          <button type="button" class="kle-btn kle-icon" data-align="center" title="Align centre" aria-label="Align centre">${ICONS.center}</button>
          <button type="button" class="kle-btn kle-icon" data-align="right" title="Align right" aria-label="Align right">${ICONS.right}</button>
          <button type="button" class="kle-btn kle-icon" data-align="justify" title="Justify — both edges straight (the default)" aria-label="Justify">${ICONS.justify}</button>
          <span class="kle-sep"></span>
          <button type="button" class="kle-btn" data-toggle="indent" title="First-line indent">¶→</button>
          <button type="button" class="kle-btn" data-toggle="inset" title="Indented block (quotes, verses)">⇥</button>
          <button type="button" class="kle-btn" data-toggle="tight" title="Verse line — no gap after this line">≣</button>
          <span class="kle-sep"></span>
          <button type="button" class="kle-btn" data-cmd="linebreak" title="Line break inside the paragraph (Shift+Enter)">↵</button>
          <button type="button" class="kle-btn" data-cmd="pagebreak" title="Page break — start a new page here">⤓ Page</button>
          ${options.uploadImage ? `<button type="button" class="kle-btn kle-icon" data-cmd="image" title="Add a picture, diagram or clipart (you can also paste or drag one in)" aria-label="Add picture">${ICONS.image}&nbsp;Image</button>` : ''}
          <span class="kle-pop-wrap">
            <button type="button" class="kle-btn kle-icon" data-cmd="emojimenu" title="Emoji" aria-label="Emoji" aria-haspopup="true">${ICONS.emoji}</button>
            <div class="kle-emoji-pop" hidden>
              ${EMOJIS.map((em) => `<button type="button" class="kle-emoji" data-emoji="${em}">${em}</button>`).join('')}
              <div class="kle-emoji-note">More: press Windows key + . (full stop)</div>
            </div>
          </span>
          <button type="button" class="kle-btn" data-cmd="clear" title="Clear formatting of the selection / paragraph">⌫ Format</button>
          <span class="kle-sep"></span>
          <button type="button" class="kle-btn" data-cmd="undo" title="Undo (Ctrl+Z)">↶</button>
          <button type="button" class="kle-btn" data-cmd="redo" title="Redo (Ctrl+Y)">↷</button>
        </div>
        <div class="kle-editor${options.tall ? ' tall' : ''}" contenteditable="true" spellcheck="true" data-placeholder="${escapeText(options.placeholder || 'Type or paste here…')}"></div>
        <div class="kle-help">Enter = new paragraph · Shift+Enter = line break · “Section title” starts a new section on a new page · pasting from Word keeps bold, italics, headings and centring.</div>
        <input type="file" class="kle-file" accept="image/*" multiple hidden>
      </div>`;
    const ed = container.querySelector('.kle-editor');
    const bar = container.querySelector('.kle-toolbar');
    const help = container.querySelector('.kle-help');
    const helpText = help.textContent;
    const fileInput = container.querySelector('.kle-file');
    const setStatus = (msg, kind) => { help.textContent = msg || helpText; help.className = 'kle-help' + (msg && kind ? ' ' + kind : ''); };
    const kindSelect = bar.querySelector('[data-cmd="kind"]');
    ed.innerHTML = toEditorHtml(options.content);

    const exec = (cmd, val = null) => { ed.focus(); try { document.execCommand(cmd, false, val); } catch (e) { /* unsupported */ } };
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { /* older browsers */ }

    // The paragraph(s) the cursor or selection is in (direct children of the editor).
    const currentBlocks = () => {
      const sel = window.getSelection();
      if (!sel.rangeCount || !ed.contains(sel.anchorNode)) return [];
      const top = (node) => { while (node && node.parentNode !== ed) node = node.parentNode; return node && node.nodeType === 1 ? node : null; };
      const a = top(sel.anchorNode), b = top(sel.focusNode);
      if (!a) return [];
      const blocks = [];
      let n = a, end = b || a;
      if (a.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_PRECEDING) { n = end; end = a; }
      while (n) { if (n.tagName === 'P') blocks.push(n); if (n === end) break; n = n.nextElementSibling; }
      return blocks;
    };
    // Browsers sometimes produce <div>s for new lines — keep everything as <p>.
    const normalize = () => {
      [...ed.children].forEach((c) => {
        if (c.classList.contains('kle-marker') || c.classList.contains('kle-figure')) return;
        if (c.tagName !== 'P') {
          const p = document.createElement('p');
          p.className = [...c.classList].filter((x) => ALLOWED.has(x)).join(' ');
          while (c.firstChild) p.appendChild(c.firstChild);
          c.replaceWith(p);
        }
      });
      if (!ed.firstChild) ed.innerHTML = '<p><br></p>';
    };

    // Text size where the cursor is: the nearest size tag around it ('' = normal).
    const sizeName = bar.querySelector('.kle-size-name');
    const sizeAtCursor = () => {
      const sel = window.getSelection();
      let n = sel.rangeCount ? sel.focusNode : null;
      for (; n && n !== ed; n = n.parentNode) {
        if (n.nodeType !== 1) continue;
        const kl = n.tagName.match(/^KL-(SMALL|LARGE|XL|XXL)$/);
        if (kl) return kl[1].toLowerCase();
        if (n.tagName === 'FONT' && n.getAttribute('size') in FONT_TAG_SIZE) return FONT_TAG_SIZE[n.getAttribute('size')];
      }
      return '';
    };

    const updateState = () => {
      sizeName.textContent = SIZE_NAMES[sizeAtCursor()];
      const blocks = currentBlocks();
      const first = blocks[0];
      bar.querySelectorAll('[data-align]').forEach((btn) => {
        const a = btn.dataset.align;
        const on = first ? (first.classList.contains(a) || (a === 'justify' && !LAYOUT.some((x) => first.classList.contains(x)) && !first.classList.contains('section'))) : false;
        btn.setAttribute('aria-pressed', String(on));
      });
      bar.querySelectorAll('[data-toggle]').forEach((btn) => btn.setAttribute('aria-pressed', String(!!first && first.classList.contains(btn.dataset.toggle))));
      ['bold', 'italic', 'underline'].forEach((c) => {
        let on = false; try { on = document.queryCommandState(c); } catch (e) { /* ignore */ }
        bar.querySelector(`[data-cmd="${c}"]`).setAttribute('aria-pressed', String(on));
      });
      kindSelect.value = first ? (KINDS.find((k) => first.classList.contains(k)) || '') : '';
    };

    bar.addEventListener('mousedown', (e) => { if (e.target.closest('.kle-btn')) e.preventDefault(); }); // keep the selection in the editor
    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('.kle-btn');
      if (!btn) return;
      const cmd = btn.dataset.cmd;
      if (btn.dataset.align) {
        currentBlocks().forEach((p) => { LAYOUT.forEach((a) => p.classList.remove(a)); if (btn.dataset.align !== 'justify') p.classList.add(btn.dataset.align); });
      } else if (btn.dataset.toggle) {
        const blocks = currentBlocks();
        const on = !(blocks[0] && blocks[0].classList.contains(btn.dataset.toggle));
        blocks.forEach((p) => p.classList.toggle(btn.dataset.toggle, on));
      } else if (cmd === 'colormenu') {
        palette.hidden = !palette.hidden;
        return;
      } else if (cmd === 'smaller' || cmd === 'bigger') {
        const step = SIZE_STEPS.indexOf(sizeAtCursor());
        const next = SIZE_STEPS[Math.max(0, Math.min(SIZE_STEPS.length - 1, step + (cmd === 'bigger' ? 1 : -1)))];
        try { document.execCommand('styleWithCSS', false, false); } catch (err) { /* ignore */ }
        exec('fontSize', SIZE_FONT_TAG[next]);
        sizeName.textContent = SIZE_NAMES[next];
        return;
      } else if (cmd === 'emojimenu') {
        emojiPop.hidden = !emojiPop.hidden;
        return;
      } else if (cmd === 'image') {
        imageAnchor = cursorBlock();
        fileInput.click();
        return;
      } else if (cmd === 'bold' || cmd === 'italic' || cmd === 'underline' || cmd === 'undo' || cmd === 'redo') {
        exec(cmd);
      } else if (cmd === 'linebreak') {
        exec('insertLineBreak');
      } else if (cmd === 'pagebreak') {
        exec('insertHTML', markerHtml('pagebreak') + '<p><br></p>');
      } else if (cmd === 'clear') {
        exec('removeFormat');
        currentBlocks().forEach((p) => { p.className = ''; });
      }
      normalize();
      updateState();
    });
    // Text colour: the browser colours the selection; reading it back maps it to the palette.
    const palette = bar.querySelector('.kle-palette');
    const colorBar = bar.querySelector('.kle-color-bar');
    palette.addEventListener('mousedown', (e) => e.preventDefault()); // keep the text selected
    palette.addEventListener('click', (e) => {
      const sw = e.target.closest('[data-color]');
      if (!sw) return;
      const name = sw.dataset.color;
      try { document.execCommand('styleWithCSS', false, false); } catch (err) { /* ignore */ }
      exec('foreColor', name ? hex(PALETTE[name]) : DEFAULT_COLOR);
      if (name) colorBar.style.background = hex(PALETTE[name]);
      palette.hidden = true;
    });
    document.addEventListener('mousedown', (e) => {
      if (!e.target.closest || !e.target.closest('.kle-color')) palette.hidden = true;
      if (!e.target.closest || !e.target.closest('.kle-pop-wrap')) emojiPop.hidden = true;
    });

    // Emoji: typed into the text like any letter.
    const emojiPop = bar.querySelector('.kle-emoji-pop');
    emojiPop.addEventListener('mousedown', (e) => e.preventDefault());
    emojiPop.addEventListener('click', (e) => {
      const b = e.target.closest('[data-emoji]');
      if (!b) return;
      exec('insertText', b.dataset.emoji);
      emojiPop.hidden = true;
    });

    // ---------- Pictures ----------
    const changed = () => ed.dispatchEvent(new Event('input', { bubbles: true }));
    // The top-level block (paragraph, picture, marker) holding the cursor, if any.
    const topBlock = (node) => { while (node && node.parentNode !== ed) node = node.parentNode; return node && node.nodeType === 1 ? node : null; };
    const cursorBlock = () => { const sel = window.getSelection(); return sel.rangeCount && ed.contains(sel.anchorNode) ? topBlock(sel.anchorNode) : null; };
    let imageAnchor = null;
    const isEmptyPara = (el) => el && el.tagName === 'P' && !el.textContent.trim() && !el.querySelector('img');
    // Put blocks (pictures and paragraphs, as editor HTML) after `after` — or in place of it when
    // it's an empty line, or at the end. Returns the last block put in.
    function insertBlocks(html, after) {
      const tpl = document.createElement('template');
      tpl.innerHTML = html;
      const nodes = [...tpl.content.childNodes].filter((n) => n.nodeType === 1);
      if (!nodes.length) return after;
      if (!after || !ed.contains(after) || after.parentNode !== ed) after = ed.lastElementChild;
      if (isEmptyPara(after) && ed.children.length > 1) { const prev = after.previousElementSibling; after.replaceWith(...nodes); after = prev; }
      else if (after) after.after(...nodes);
      else ed.append(...nodes);
      const last = nodes[nodes.length - 1];
      // Always leave a line after a picture to carry on typing.
      if (last.classList.contains('kle-figure') && (!last.nextElementSibling || last.nextElementSibling.tagName !== 'P')) {
        const p = document.createElement('p'); p.innerHTML = '<br>'; last.after(p);
      }
      changed();
      return last;
    }
    async function addImageFiles(files, after) {
      const list = [...files].filter((f) => /^image\//.test(f.type));
      if (!list.length || !options.uploadImage) return;
      let failed = 0, lastError = '';
      for (let i = 0; i < list.length; i++) {
        setStatus(`Adding picture ${i + 1} of ${list.length}…`, 'busy');
        try {
          const r = await options.uploadImage(list[i]);
          after = insertBlocks(figureHtml({ src: r.url, w: r.w, h: r.h, size: sizeFor(r.w), caption: '' }), after);
        } catch (e) { failed++; lastError = e.message || String(e); }
      }
      setStatus(failed ? `${failed} picture${failed === 1 ? '' : 's'} could not be added (${lastError}).` : '', 'error');
    }
    fileInput.addEventListener('change', () => { const files = [...fileInput.files]; fileInput.value = ''; addImageFiles(files, imageAnchor); });
    ed.addEventListener('drop', (e) => {
      const files = [...((e.dataTransfer && e.dataTransfer.files) || [])].filter((f) => /^image\//.test(f.type));
      if (!files.length || !options.uploadImage) return;
      e.preventDefault();
      addImageFiles(files, topBlock(e.target));
    });
    // Picture buttons: size and remove; the caption is typed straight into its box.
    ed.addEventListener('click', (e) => {
      const btn = e.target.closest && e.target.closest('.kle-fig-btn');
      if (!btn) return;
      const fig = btn.closest('.kle-figure');
      if (btn.dataset.figRemove) {
        fig.remove();
        if (!ed.firstChild) ed.innerHTML = '<p><br></p>';
      } else {
        const size = btn.dataset.figSize;
        fig.dataset.size = size;
        IMAGE_SIZES.forEach((s) => fig.classList.toggle('kle-size-' + s, s === size));
        fig.querySelectorAll('[data-fig-size]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.figSize === size)));
      }
      changed();
    });
    ed.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('kle-caption')) e.preventDefault(); });

    // Pictures inside pasted HTML: ones already in the library's storage are kept; pictures
    // carried inside the copy (data:) are uploaded; links to web pictures are copied in if the
    // site allows it. Word's own copies point at files on the computer that a web page can't
    // read — those are counted so the person knows to add them with the Image button.
    async function bringInPastedImages(doc) {
      let skipped = 0;
      for (const img of [...doc.querySelectorAll('img')]) {
        const src = img.getAttribute('src') || '';
        if (isLibraryImage(src)) continue;
        let done = false;
        if (options.uploadImage && /^(data:image\/|https?:)/i.test(src)) {
          try {
            const res = await fetch(src);
            if (!res.ok) throw new Error('not available');
            const blob = await res.blob();
            if (!/^image\//.test(blob.type)) throw new Error('not a picture');
            const r = await options.uploadImage(blob);
            img.setAttribute('src', r.url);
            img.dataset.w = r.w; img.dataset.h = r.h;
            done = true;
          } catch (err) { /* counted below */ }
        }
        if (!done) {
          // Tiny spacer images and bullets aren't real pictures — drop them quietly.
          const w = Number(img.getAttribute('width')) || 0;
          if (!(w && w < 24)) skipped++;
          img.remove();
        }
      }
      return skipped;
    }

    kindSelect.addEventListener('change', () => {
      const kind = kindSelect.value;
      currentBlocks().forEach((p) => { KINDS.forEach((k) => p.classList.remove(k)); if (kind) p.classList.add(kind); });
      ed.focus();
      updateState();
    });

    ed.addEventListener('paste', (e) => {
      const cd = e.clipboardData;
      if (!cd) return;
      e.preventDefault();
      const html = cd.getData('text/html');
      const doc = html ? new DOMParser().parseFromString(html, 'text/html') : null;
      // A copied picture (screenshot, picture copied from a website or Word on its own).
      const files = [...(cd.files || [])].filter((f) => /^image\//.test(f.type));
      if (files.length && options.uploadImage && (!doc || !doc.body.textContent.trim())) {
        addImageFiles(files, cursorBlock());
        return;
      }
      if (doc && doc.querySelector('img')) {
        const anchor = cursorBlock();
        setStatus('Adding the pasted pictures…', 'busy');
        bringInPastedImages(doc).then((skipped) => {
          insertBlocks(toEditorHtml(paragraphsFrom(doc.body).join('\n\n')), anchor);
          normalize();
          setStatus(skipped ? `${skipped} picture${skipped === 1 ? '' : 's'} couldn't be copied (Word keeps them on your computer). Add ${skipped === 1 ? 'it' : 'them'} with the Image button — or upload the whole .docx file, which brings pictures in automatically.` : '', 'error');
        });
        return;
      }
      const clean = doc ? toEditorHtml(paragraphsFrom(doc.body).join('\n\n')) : plainTextToHtml(cd.getData('text/plain') || '');
      exec('insertHTML', clean);
      normalize();
    });
    ed.addEventListener('keydown', (e) => {
      e.stopPropagation(); // keep typing away from page-level shortcuts
      if (e.key === 'Backspace' || e.key === 'Delete') setTimeout(normalize, 0);
    });
    ed.addEventListener('input', () => { if (!ed.firstChild) ed.innerHTML = '<p><br></p>'; });
    document.addEventListener('selectionchange', () => { if (ed.contains(document.activeElement) || ed === document.activeElement) updateState(); });

    return {
      element: ed,
      getContent: () => paragraphsFrom(ed).join('\n\n'),
      setContent: (s) => { ed.innerHTML = toEditorHtml(s); },
      focus: () => ed.focus(),
    };
  }

  // Also exposed for converting pasted/uploaded HTML without an editor.
  window.KLEditor = {
    create, toEditorHtml, paletteColor,
    paragraphsFromHtml: (html) => paragraphsFrom(new DOMParser().parseFromString(html, 'text/html').body),
    imageMarker, parseImageMarker, isLibraryImage, sizeFor,
  };
})();
