/* Rich text editor for book content (admin panel).
   Edits the same stored format the reader app displays: paragraphs separated by blank
   lines, each either inline text (<b> <i> <u> <sup> <sub> <br>, colours as <kl-red> etc.) or wrapped as
   <p class="…"> with layout classes, plus two marker paragraphs:
     [[pagebreak]]  — the reader starts a new page here
     [[contents]]   — the reader shows the book's chapter list here
   Paragraph classes: center right left justify indent inset tight (layout),
   heading (sub-heading inside a section), section (starts a NEW section — the admin
   splits the text into separate chapters there when saving).

   KLEditor.create(container, { content, placeholder }) → { getContent(), setContent(s), focus(), element }
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
  .kle-help { font-size: 11.5px; color: #93A0A8; padding: 6px 10px; border-top: 1px solid rgba(233,226,208,0.08); }`;

  // Alignment icons drawn as lines (like Word) — symbol characters don't display on every computer.
  const lines = (rows) => `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">${rows.map(([x1, x2], i) => `<path d="M${x1} ${3 + i * 4}h${x2 - x1}"/>`).join('')}</svg>`;
  const ICONS = {
    left: lines([[2, 16], [2, 11], [2, 16], [2, 11]]),
    center: lines([[2, 16], [5, 13], [2, 16], [5, 13]]),
    right: lines([[2, 16], [7, 16], [2, 16], [7, 16]]),
    justify: lines([[2, 16], [2, 16], [2, 16], [2, 16]]),
  };

  let styleAdded = false;
  const escapeText = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

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
      const c = paletteColor(n.getAttribute('color') || st.color);
      if (c !== undefined) f.color = c;
      collectRuns(n, f, runs);
    });
    return runs;
  }
  function renderRuns(runs) {
    const same = (a, b) => !a.br && !b.br && !!a.b === !!b.b && !!a.i === !!b.i && !!a.u === !!b.u && (a.va || '') === (b.va || '') && (a.color || '') === (b.color || '');
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
        if (n.tagName === 'UL' || n.tagName === 'OL' || n.tagName === 'TABLE' || n.tagName === 'TBODY') { flushLoose(); walk(n); return; }
        if (BLOCK_TAGS.has(n.tagName)) {
          flushLoose();
          // A block that itself contains blocks (e.g. a wrapper div) — go inside instead.
          if ([...n.children].some((c) => BLOCK_TAGS.has(c.tagName) || (c.dataset && c.dataset.marker))) { walk(n); return; }
          const text = n.textContent.trim();
          if (/^\[\[(pagebreak|contents)\]\]$/.test(text)) { paras.push(text); return; }
          let inner = tidyInline(inlineHtml(n));
          if (!inner.replace(/<br>/g, '').trim()) return;
          if (n.tagName === 'LI') inner = '• ' + inner;
          const cls = classesOf(n);
          paras.push(cls.length ? `<p class="${cls.join(' ')}">${inner}</p>` : inner);
          return;
        }
        if (n.tagName === 'BR') { loose += '<br>'; return; }
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
          <button type="button" class="kle-btn" data-cmd="clear" title="Clear formatting of the selection / paragraph">⌫ Format</button>
          <span class="kle-sep"></span>
          <button type="button" class="kle-btn" data-cmd="undo" title="Undo (Ctrl+Z)">↶</button>
          <button type="button" class="kle-btn" data-cmd="redo" title="Redo (Ctrl+Y)">↷</button>
        </div>
        <div class="kle-editor${options.tall ? ' tall' : ''}" contenteditable="true" spellcheck="true" data-placeholder="${escapeText(options.placeholder || 'Type or paste here…')}"></div>
        <div class="kle-help">Enter = new paragraph · Shift+Enter = line break · “Section title” starts a new section on a new page · pasting from Word keeps bold, italics, headings and centring.</div>
      </div>`;
    const ed = container.querySelector('.kle-editor');
    const bar = container.querySelector('.kle-toolbar');
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
        if (c.classList.contains('kle-marker')) return;
        if (c.tagName !== 'P') {
          const p = document.createElement('p');
          p.className = [...c.classList].filter((x) => ALLOWED.has(x)).join(' ');
          while (c.firstChild) p.appendChild(c.firstChild);
          c.replaceWith(p);
        }
      });
      if (!ed.firstChild) ed.innerHTML = '<p><br></p>';
    };

    const updateState = () => {
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
    document.addEventListener('mousedown', (e) => { if (!e.target.closest || !e.target.closest('.kle-color')) palette.hidden = true; });

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
      let clean;
      if (html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        clean = toEditorHtml(paragraphsFrom(doc.body).join('\n\n'));
      } else {
        clean = plainTextToHtml(cd.getData('text/plain') || '');
      }
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
  window.KLEditor = { create, toEditorHtml, paletteColor, paragraphsFromHtml: (html) => paragraphsFrom(new DOMParser().parseFromString(html, 'text/html').body) };
})();
