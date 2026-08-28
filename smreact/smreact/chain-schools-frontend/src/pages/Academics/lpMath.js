/* ═══════════════════════════════════════════════════════════════════
   MATH FORMULA (∑) — ERP ke LessonPlans.js se hu-ba-hu port.

   Editor ke ∑ button par ek chhota MathLive popup khulta hai: user
   equation visually banata hai (fraction, power, root, ∫ …) aur Insert
   par LaTeX → rendered HTML ban kar editor me chala jata hai.

   Popup me do apne submenu bhi lagte hain:
     • Formulas  — class 5–10 level school formulas (SCHOOL_FORMULAS)
     • Shortcuts — kya type karne se kya banta hai (MATH_SHORTCUTS)

   Smart paste: website se copy kiya hua rendered formula bhi theek
   aata hai — clipboard ke HTML/MathML me chhupa LaTeX nikal liya jata
   hai, taake user ko LaTeX likhna na pare.
   ═══════════════════════════════════════════════════════════════════ */

import 'mathlive'   // <math-field> custom element register karta hai
import { convertLatexToMarkup } from 'mathlive'   // LaTeX → rendered HTML
import 'mathlive/static.css'                      // static render CSS (fractions, powers …)


/* Jab user kisi WEBSITE se rendered formula copy karta ha, clipboard ke text/html
   me aksar MathML + chhupa hua LaTeX (annotation) hota ha. Ye helpers us HTML se
   LaTeX ya MathML nikaalte hain taake NON-TECHNICAL user ko LaTeX likhne ki zaroorat na ho. */
function extractLatexFromHtml(html) {
  if (!html) return '';
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    // MathJax / MathML: <annotation encoding="application/x-tex">…latex…</annotation>
    const ann = doc.querySelector('annotation[encoding="application/x-tex"],annotation[encoding="application/x-latex"]');
    if (ann && ann.textContent && ann.textContent.trim()) return ann.textContent.trim();
    // KaTeX / hamare apne .lp-math spans: data-latex attribute
    const dl = doc.querySelector('[data-latex]');
    if (dl && dl.getAttribute('data-latex')) return dl.getAttribute('data-latex').trim();
    const dt = doc.querySelector('[data-tex]');
    if (dt && dt.getAttribute('data-tex')) return dt.getAttribute('data-tex').trim();
  } catch (e) { /* ignore */ }
  return '';
}
function extractMathmlFromHtml(html) {
  if (!html) return '';
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const m = doc.querySelector('math');
    if (m) return m.outerHTML;
  } catch (e) { /* ignore */ }
  return '';
}

/* Class 5–10 level basic school formulas — MathLive ke Insert menu me add hote hain.
   Har entry: [display label, LaTeX]. Click par editor me insert. */
const SCHOOL_FORMULAS = [
  { group: 'Algebra Identities', items: [
    ['(a + b)²', '(a+b)^2 = a^2 + 2ab + b^2'],
    ['(a − b)²', '(a-b)^2 = a^2 - 2ab + b^2'],
    ['a² − b²', 'a^2 - b^2 = (a-b)(a+b)'],
    ['(a + b)³', '(a+b)^3 = a^3 + 3a^2 b + 3a b^2 + b^3'],
    ['(a − b)³', '(a-b)^3 = a^3 - 3a^2 b + 3a b^2 - b^3'],
    ['Quadratic formula', 'x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}'],
    ['Pythagoras', 'a^2 + b^2 = c^2'],
  ] },
  { group: 'Area', items: [
    ['Square', 'A = a^2'],
    ['Rectangle', 'A = l \\times w'],
    ['Triangle', 'A = \\frac{1}{2} \\times b \\times h'],
    ['Circle', 'A = \\pi r^2'],
    ['Parallelogram', 'A = b \\times h'],
    ['Trapezium', 'A = \\frac{1}{2}(a+b) \\times h'],
  ] },
  { group: 'Perimeter & Volume', items: [
    ['Rectangle Perimeter', 'P = 2(l + w)'],
    ['Circle Circumference', 'C = 2 \\pi r'],
    ['Cube Volume', 'V = a^3'],
    ['Cuboid Volume', 'V = l \\times w \\times h'],
    ['Cylinder Volume', 'V = \\pi r^2 h'],
    ['Sphere Volume', 'V = \\frac{4}{3} \\pi r^3'],
  ] },
  { group: 'Arithmetic', items: [
    ['Percentage', '\\text{Percentage} = \\frac{\\text{Part}}{\\text{Whole}} \\times 100'],
    ['Simple Interest', 'I = \\frac{P \\times R \\times T}{100}'],
    ['Average (Mean)', '\\text{Mean} = \\frac{\\text{Sum of values}}{\\text{Number of values}}'],
    ['Speed', '\\text{Speed} = \\frac{\\text{Distance}}{\\text{Time}}'],
    ['Profit %', '\\text{Profit \\%} = \\frac{\\text{Profit}}{\\text{Cost Price}} \\times 100'],
  ] },
];

/* Keyboard shortcuts jo math editor me chalte hain — [label (kya type karo), example LaTeX].
   Click par example insert ho jata ha (seekhne + istemal dono). */
const MATH_SHORTCUTS = [
  ['^   →   Power / superscript  (x²)', 'x^2'],
  ['_   →   Subscript  (x₁)', 'x_1'],
  ['/   →   Fraction  (a/b)', '\\frac{a}{b}'],
  ['sqrt   →   Square root  (√)', '\\sqrt{x}'],
  ['cbrt   →   Cube / nth root', '\\sqrt[3]{x}'],
  ['pm   →   Plus-minus  (±)', '\\pm'],
  ['times   →   Multiply  (×)', '\\times'],
  ['div   →   Divide  (÷)', '\\div'],
  ['<=   →   ≤     >=   →   ≥', '\\le'],
  ['!=   →   Not equal  (≠)', '\\ne'],
  ['pi   →   Pi  (π)', '\\pi'],
  ['theta   →   Theta  (θ)', '\\theta'],
  ['int   →   Integral  (∫)', '\\int'],
  ['sum   →   Summation  (Σ)', '\\sum'],
  ['inf   →   Infinity  (∞)', '\\infty'],
];

/* MathLive menu me "Shortcuts" submenu — har item ka label shortcut batata ha,
   click par example insert. */
function buildShortcutsMenu(mf) {
  return {
    label: 'Shortcuts (how to type)',
    submenu: MATH_SHORTCUTS.map(([label, latex]) => ({
      label,
      onMenuSelect: () => { try { mf.focus(); mf.insert(latex, { format: 'latex', focus: true }); } catch (e) { /* ignore */ } },
    })),
  };
}

/* MathLive Insert menu me "School Formulas" submenu banao (defaults ke saath). */
function buildSchoolFormulaMenu(mf) {
  return {
    label: 'Formulas',
    submenu: SCHOOL_FORMULAS.map(g => ({
      label: g.group,
      submenu: g.items.map(([label, latex]) => ({
        label,
        onMenuSelect: () => { try { mf.focus(); mf.insert(latex, { format: 'latex', focus: true }); } catch (e) { /* ignore */ } },
      })),
    })),
  };
}

/* Visual math editor (MathLive) — anchor button ke neeche ek `<math-field>` popup
   kholta ha. User equation visually banata ha (fraction, power, root, ∫ …), phir
   "Insert" par MathML milta ha jo Chrome native render karta ha (editor + view +
   report sab jagah, bina extra CSS/library ke). onInsert(mathmlString) call hota ha. */
/* Collapsed caret (ya selection) ka viewport rect — popup ko caret ke side me kholne ke liye. */
function caretRectFromRange(range) {
  if (!range) return null;
  try {
    const rects = range.getClientRects();
    if (rects && rects.length) return rects[rects.length - 1];
    const r = range.getBoundingClientRect();
    if (r && (r.width || r.height || r.top || r.left)) return r;
  } catch (e) { /* ignore */ }
  return null;
}

/* Math popup ka anchor rect: horizontally field ke RIGHT edge se align, vertically caret
   line ke saath (na mile to field top). Popup width ~360 (+12 gap). */
export function mathPopupAnchor(range, ed) {
  const c = caretRectFromRange(range);
  const f = ed ? ed.getBoundingClientRect() : null;
  const v = c || f;
  if (!v) return null;
  if (!f) return v;
  const left = f.right - 372;                 // 360 popup width + 12 gap → right side
  return { top: v.top, bottom: v.bottom, left, right: f.right, height: c ? c.height : 0 };
}

/* anchorRect: DOM element | DOMRect | function()=>DOMRect (live caret ke liye). */
export function openMathFieldPopup(anchorRect, initialLatex, onInsert) {
  /* Sirf MathLive ka virtual-keyboard toggle button hide (menu/matrix wala rehne do). */
  if (!document.getElementById('lp-mathfield-style')) {
    const st = document.createElement('style');
    st.id = 'lp-mathfield-style';
    st.textContent = 'math-field::part(virtual-keyboard-toggle){display:none!important}';
    document.head.appendChild(st);
  }
  const wrap = document.createElement('div');
  /* Popup ko us ∑ button/field ke saath GLUE karo — button ke theek neeche khule aur
     scroll par button ke SAATH move kare (screen-center nahi). Jagah kam ho to upar.
     anchorRect ELEMENT ho to live getBoundingClientRect (scroll par follow), warna
     static rect (backward compat). transform use nahi (MathLive menu na toote). */
  const POP_W = 360;
  const anchorFn = (typeof anchorRect === 'function') ? anchorRect : null;
  const anchorEl = (anchorRect && anchorRect.nodeType === 1) ? anchorRect : null;
  const place = () => {
    const a = anchorFn ? anchorFn() : (anchorEl ? anchorEl.getBoundingClientRect() : (anchorRect || null));
    const aTop = (a && a.top) != null ? a.top : 100;
    const aBottom = (a && a.bottom) != null ? a.bottom : aTop + 20;
    const aLeft = (a && a.left) != null ? a.left : 20;
    const aHeight = (a && a.height) || 0;
    const popH = wrap.offsetHeight || 190;
    // caret/line-rect (chhota) ho to us line ke NEECHE (equation ke side); pura field box ho to top par.
    const caretLike = aHeight > 0 && aHeight < 80;
    let top = caretLike ? aBottom + 6 : aTop + 6;
    if (top + popH > window.innerHeight - 8) top = aTop - popH - 6;   // neeche jagah kam → upar
    top = Math.max(8, Math.min(window.innerHeight - popH - 8, top));
    const left = Math.max(8, Math.min(window.innerWidth - POP_W - 8, aLeft));
    wrap.style.top = top + 'px';
    wrap.style.left = left + 'px';
  };
  wrap.style.cssText = `position:fixed;z-index:100002;background:#fff;border:1px solid #1E40AF;border-radius:12px;box-shadow:0 10px 34px rgba(2,6,23,.28);padding:12px;width:${POP_W}px;max-width:92vw`;
  place();
  window.addEventListener('scroll', place, true);           // scroll par button ke saath follow
  window.addEventListener('resize', place);

  const hint = document.createElement('div');
  hint.textContent = 'Insert Formula';
  hint.style.cssText = 'font-size:11px;color:#64748B;font-weight:700;margin-bottom:7px;letter-spacing:.3px';

  const mf = document.createElement('math-field');
  mf.style.cssText = 'display:block;width:100%;min-height:52px;font-size:22px;border:1.5px solid #BAE6FD;border-radius:9px;padding:8px 10px;background:#fff';
  /* Context menu (matrix/mode/color …) rehne do — bas virtual keyboard auto-pop na ho. */
  try { mf.mathVirtualKeyboardPolicy = 'manual'; } catch (e) { /* ignore */ }
  if (initialLatex) { try { mf.value = initialLatex; } catch (e) { /* ignore */ } }

  /* SMART PASTE — website se copy kiya rendered formula bhi exact aaye (LaTeX likhne ki
     zaroorat nahi). Priority: HTML/MathML me chhupa LaTeX → MathML → plain text. */
  mf.addEventListener('paste', (ev) => {
    try {
      const cd = ev.clipboardData || window.clipboardData;
      if (!cd) return;
      const html   = cd.getData('text/html') || '';
      const mmlRaw = cd.getData('application/mathml+xml') || cd.getData('text/mathml') || '';
      const texRaw = cd.getData('application/x-latex') || cd.getData('text/x-latex') || '';

      // 1) HTML/MathML me chhupa LaTeX (Wikipedia/MathJax/KaTeX/hamare spans)
      const latex = texRaw || extractLatexFromHtml(html) || extractLatexFromHtml(mmlRaw);
      if (latex) { ev.preventDefault(); try { mf.insert(latex, { format: 'latex' }); } catch (e) { mf.value = latex; } return; }

      // 2) Direct MathML
      const mml = mmlRaw || extractMathmlFromHtml(html);
      if (mml) { ev.preventDefault(); try { mf.insert(mml, { format: 'math-ml' }); return; } catch (e) { /* fallthrough */ } }

      // 3) Plain text — MathLive khud LaTeX/ASCII-math ki tarah handle karega (native).
      //    Kuch na mile to default paste hone do (preventDefault nahi).
    } catch (e) { /* default paste */ }
  }, true);

  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:9px';
  const mkBtn = (label, primary) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label;
    b.style.cssText = primary
      ? 'padding:7px 18px;border:none;background:#1E40AF;color:#fff;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer'
      : 'padding:7px 14px;border:1px solid #CBD5E1;background:#fff;color:#475569;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer';
    return b;
  };
  const cancelBtn = mkBtn('Cancel', false);
  const insBtn = mkBtn('Insert', true);
  bar.appendChild(cancelBtn); bar.appendChild(insBtn);

  wrap.appendChild(hint); wrap.appendChild(mf); wrap.appendChild(bar);
  document.body.appendChild(wrap);
  setTimeout(() => {
    try {
      /* "Formulas" + "Shortcuts" submenu ko default menu ke UPAR add karo (defaults rehne den). */
      const defaults = Array.isArray(mf.menuItems) ? mf.menuItems : [];
      // Ye 4 default items menu se hata do: Mode, Font Style (variant), Color, Background.
      const HIDE_IDS = ['mode', 'variant', 'color', 'background-color'];
      const kept = defaults.filter(it => !(it && HIDE_IDS.includes(it.id)));
      mf.menuItems = [buildSchoolFormulaMenu(mf), buildShortcutsMenu(mf), { type: 'divider' }, ...kept];
    } catch (e) { /* ignore — default menu hi rahega */ }
    try { place(); } catch (e) { /* ignore */ }   // asli height ke saath dobara position
    try { mf.focus(); } catch (e) { /* ignore */ }
  }, 40);

  /* Popup band karo jab bahar click ho — magar MathLive ke apne overlays (virtual
     keyboard / menu) body me alag lagte hain, unke click par band na ho. */
  const onDown = (ev) => {
    if (wrap.contains(ev.target)) return;
    if (ev.target.closest && ev.target.closest('.ML__keyboard,.ML__menu,[part="menu"],[role="menu"],math-field')) return;
    close();
  };
  const close = () => { document.removeEventListener('mousedown', onDown, true); window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); wrap.remove(); };
  setTimeout(() => document.addEventListener('mousedown', onDown, true), 0);

  const doInsert = () => {
    let latex = '';
    try { latex = mf.value || (mf.getValue ? mf.getValue('latex') : '') || ''; } catch (e) { latex = ''; }
    close();
    if (!latex || !latex.trim()) return;
    /* LaTeX → rendered HTML (MathLive static). Fail ho to plain text fallback. */
    let html = '';
    try { html = convertLatexToMarkup(latex); } catch (e) { html = ''; }
    onInsert(html || latex, latex);
  };
  insBtn.onclick = doInsert;
  cancelBtn.onclick = close;
  wrap.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { ev.preventDefault(); close(); }
    else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey || ev.shiftKey)) { ev.preventDefault(); doInsert(); }
  });
}


/* ═══════════════════════════════════════════════════════════════════
   ∑ button ka poora amal — dono editors (Lesson sections aur Notebook
   rich-text fields) isi ko call karte hain.

   `editor`  : contentEditable element ya uska ref
   `rangeRef`: editor ka savedRangeRef (live caret na mile to fallback)
   `after`   : insert ke baad (saveSelection + content sync)
   ═══════════════════════════════════════════════════════════════════ */
export function insertMath(editor, rangeRef, after) {
  const targetEd = (editor && editor.nodeType === 1) ? editor : editor?.current;
  if (!targetEd) return;

  /* ∑ click ke waqt ka LIVE caret pakdo (mousedown ne preventDefault kiya, is
     liye selection abhi bhi editor me hi hai) — savedRangeRef stale ho sakta hai. */
  let capturedRange = null;
  const s0 = window.getSelection();
  if (s0 && s0.rangeCount) {
    const r0 = s0.getRangeAt(0);
    if (targetEd.contains(r0.commonAncestorContainer)) capturedRange = r0.cloneRange();
  }
  if (!capturedRange && rangeRef?.current && targetEd.contains(rangeRef.current.commonAncestorContainer)) {
    capturedRange = rangeRef.current.cloneRange();
  }

  /* Popup field ke RIGHT side me, caret line ke neeche khule (live) — scroll par follow. */
  const anchor = () => mathPopupAnchor(capturedRange, targetEd);
  openMathFieldPopup(anchor, '', (html, latex) => {
    const span = document.createElement('span');
    span.className = 'lp-math';
    span.setAttribute('contenteditable', 'false');
    if (latex) span.setAttribute('data-latex', latex);
    span.style.cssText = 'display:inline-block;vertical-align:middle;margin:0 2px';
    span.innerHTML = html;
    targetEd.focus();
    const sel = window.getSelection();
    if (capturedRange) {
      const r = capturedRange.cloneRange();
      r.collapse(false); r.insertNode(span); r.setStartAfter(span); r.collapse(true);
      sel.removeAllRanges(); sel.addRange(r);
    } else {
      targetEd.appendChild(span);
      const r = document.createRange();
      r.setStartAfter(span); r.collapse(true);
      sel.removeAllRanges(); sel.addRange(r);
    }
    after?.();
  });
}
