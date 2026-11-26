/* ═══════════════════════════════════════════════════════════════════
   docKit / exportDocx — a REAL, editable Word (.docx) file built from
   the same canonical JSON as the preview and the PDF (headings, lists,
   tables, images, links, question layouts, answer key, footer with
   page numbers). Colourful and Inkless palettes. RTL for Urdu.
   ═══════════════════════════════════════════════════════════════════ */
import { prepareDoc, correctOptionIndex, tfValue, shuffledOrder, setMarksLabel, roman, QTYPE_LABEL } from './render';
import { makeFormat, answerSpace } from './locale';
import { normalizeQtype, plain, inline } from './normalize';

const PAL = {
  col: { navy: '0F1F3D', navy2: '1A2B4D', gold: 'B8882A', goldLt: 'F6EAD3', teal: '0E5A52', tealLt: 'E6F2F1', blue: '1A3A6B', blueLt: 'E8EFF8', red: 'B42323', redLt: 'FDECEC', rule: 'E2E5EC', text: '2B2F38', muted: '7A8090', pillText: 'FFFFFF', tone: { navy: '0F1F3D', gold: 'B8882A', blue: '1E3A6B', red: 'B42323', teal: '0E5A52' } },
  ink: { navy: '111111', navy2: 'FFFFFF', gold: '555555', goldLt: 'F5F5F5', teal: '111111', tealLt: 'F5F5F5', blue: '333333', blueLt: 'F0F0F0', red: '111111', redLt: 'F5F5F5', rule: 'CCCCCC', text: '111111', muted: '666666', pillText: '111111', tone: {} },
};

export async function downloadDocx(rawDoc, opts, filename) {
  const D = await import('docx');
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
    AlignmentType, ImageRun, TableLayoutType, ExternalHyperlink, Footer, PageNumber, TabStopType, VerticalAlign, PageBreak,
  } = D;

  const doc = rawDoc.__prepared ? rawDoc : prepareDoc(rawDoc);
  const ink = opts.theme === 'ink';
  const P = ink ? PAL.ink : PAL.col;
  const rtl = doc.dir === 'rtl';
  const isPaper = doc.kind === 'paper';
  const answers = opts.answers || (isPaper ? 'none' : 'inline');
  const F = makeFormat(doc.locale);
  const T = F.T;
  const lineMode = opts.lines === 'four' ? 'four' : 'single';
  const BODY_FONT = rtl ? 'Jameel Noori Nastaleeq' : 'Calibri';
  const SERIF = rtl ? 'Jameel Noori Nastaleeq' : 'Georgia';
  const CONTENT_W = 11906 - 1700; // twips (A4 width − margins)

  const BODY_W = CONTENT_W - 620 - 300;
  /* Fixed-width tables (DXA grid) so Word, Pages, Google Docs and
     LibreOffice all lay them out the same. */
  const TBL = (fr, w = CONTENT_W) => (o) => new Table({ ...o, width: { size: w, type: WidthType.DXA }, columnWidths: fr.map(f => Math.round(w * f)), layout: TableLayoutType.FIXED });
  const eq = (n) => Array.from({ length: Math.max(1, n) }, () => 1 / Math.max(1, n));
  const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const noBorders = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };
  const line = (color, size = 6) => ({ style: BorderStyle.SINGLE, size, color });
  const shade = (fill) => (fill ? { type: ShadingType.CLEAR, color: 'auto', fill } : undefined);

  /* ── inline HTML → runs ── */
  const runs = (html, base = {}) => {
    const out = [];
    if (html == null || html === '') return out;
    const body = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
    const walk = (node, st) => {
      node.childNodes.forEach((n) => {
        if (n.nodeType === 3) {
          if (n.textContent) out.push(new TextRun({ text: n.textContent, font: BODY_FONT, rightToLeft: rtl, ...base, ...st }));
          return;
        }
        if (n.nodeType !== 1) return;
        const tag = n.tagName.toLowerCase();
        if (tag === 'br') { out.push(new TextRun({ text: '', break: 1 })); return; }
        if (n.classList.contains('dk-blank') || n.classList.contains('qp-blank')) { out.push(new TextRun({ text: ' ____________ ', font: BODY_FONT, ...base, ...st })); return; }
        const next = { ...st };
        if (tag === 'b' || tag === 'strong' || /font-weight:7/.test(n.getAttribute('style') || '')) next.bold = true;
        if (tag === 'i' || tag === 'em') next.italics = true;
        if (tag === 'u') next.underline = {};
        if (tag === 's') next.strike = true;
        if (tag === 'sub') next.subScript = true;
        if (tag === 'sup') next.superScript = true;
        if (tag === 'a' && /^https?:/i.test(n.getAttribute('href') || '')) {
          out.push(new ExternalHyperlink({ link: n.getAttribute('href'), children: [new TextRun({ text: n.textContent, style: 'Hyperlink', font: BODY_FONT, ...base, ...next })] }));
          return;
        }
        walk(n, next);
      });
    };
    walk(body, {});
    return out;
  };
  const para = (children, o = {}) => new Paragraph({ children, bidirectional: rtl, spacing: { after: 100, line: rtl ? 360 : 276 }, ...o });
  const text = (html, o = {}, base = {}) => para(runs(html, { size: 21, color: P.text, ...base }), o);

  /* ── images: anything the browser can load → PNG bytes ── */
  const imageCache = new Map();
  const loadImage = (src) => {
    if (imageCache.has(src)) return imageCache.get(src);
    const p = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const w = img.naturalWidth || 600; const h = img.naturalHeight || 400;
          const c = document.createElement('canvas'); c.width = w; c.height = h;
          const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
          if (ink) { const d = g.getImageData(0, 0, w, h); for (let i = 0; i < d.data.length; i += 4) { const y = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2]; d.data[i] = d.data[i + 1] = d.data[i + 2] = y; } g.putImageData(d, 0, 0); }
          const bin = atob(c.toDataURL('image/png').split(',')[1]);
          const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          resolve({ bytes, w, h });
        } catch (e) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      setTimeout(() => resolve(null), 8000);
      img.src = src;
    });
    imageCache.set(src, p);
    return p;
  };
  const imageParagraph = async (src, maxW = 520, maxH = 320, caption = '') => {
    const im = await loadImage(src);
    const out = [];
    if (!im) { out.push(text(`[Image] <a href="${src}">${src.slice(0, 80)}</a>`, {}, { color: P.muted })); return out; }
    const k = Math.min(1, maxW / im.w, maxH / im.h);
    out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: caption ? 40 : 160 }, children: [new ImageRun({ type: 'png', data: im.bytes, transformation: { width: Math.round(im.w * k), height: Math.round(im.h * k) } })] }));
    if (caption) out.push(text(caption, { alignment: AlignmentType.CENTER, spacing: { after: 160 } }, { italics: true, size: 18, color: P.muted }));
    return out;
  };

  /* ── building blocks ── */
  const cellTable = (children, { fill, left, borders, margins, w } = {}) => TBL([1], w)({
    visuallyRightToLeft: rtl,
    borders: borders || noBorders,
    rows: [new TableRow({ children: [new TableCell({ children, shading: shade(fill), margins: margins || { top: 100, bottom: 100, left: 220, right: 220 }, borders: { top: NONE, bottom: NONE, right: rtl && left ? left : NONE, left: !rtl && left ? left : NONE } })] })],
  });
  const spacer = (after = 120) => new Paragraph({ children: [], spacing: { after } });

  const pill = (label, tone, extra = []) => para([
    new TextRun({ text: `  ${plain(label).toUpperCase()}  `, bold: true, size: 17, color: P.pillText, characterSpacing: 40, font: BODY_FONT, shading: shade(ink ? 'F0F0F0' : (P.tone[tone] || P.navy)), border: ink ? line('111111', 6) : undefined }),
    ...extra,
  ], { spacing: { before: 240, after: 160 } });

  /* List markers are written as text (not Word auto-numbering) so every
     list restarts at 1 in Word, Google Docs, Pages and LibreOffice. */
  const listParas = (items, ordered, level = 0) => items.flatMap((it, i) => {
    const marker = ordered ? (level === 0 ? `${i + 1}.` : level === 1 ? `${'abcdefghijklmnopqrstuvwxyz'[i % 26]}.` : `${roman(i)}.`) : ['•', '◦', '▪'][level % 3];
    const left = 420 + level * 380;
    return [
      para([new TextRun({ text: marker, bold: ordered, color: P.navy, size: 21 }), new TextRun({ text: '\t' }), ...runs(it.text, { size: 21, color: P.text })], {
        indent: rtl ? { right: left, hanging: 320 } : { left, hanging: 320 },
        tabStops: [{ type: rtl ? TabStopType.RIGHT : TabStopType.LEFT, position: left }],
        spacing: { after: 70 },
      }),
      ...(it.items ? listParas(it.items, ordered, level + 1) : []),
    ];
  });

  const dataTable = (columns, rows, opt = {}) => {
    const ncol = Math.max(columns.length, ...rows.map(r => r.length), 1);
    const mk = (cells, header, ri) => new TableRow({
      tableHeader: header,
      children: Array.from({ length: ncol }, (_, i) => new TableCell({
        children: [para(runs(cells[i] ?? '', header ? { bold: true, size: 17, color: ink ? '111111' : (opt.headColor || 'FFFFFF'), characterSpacing: 20 } : { size: 20, color: P.text }), { spacing: { after: 0 } })],
        shading: shade(header ? (ink ? 'EEEEEE' : (opt.headFill || P.navy)) : (ri % 2 === 1 ? (ink ? 'F8F8F8' : 'F7F8FB') : undefined)),
        margins: { top: 80, bottom: 80, left: 140, right: 140 },
        verticalAlign: VerticalAlign.TOP,
      })),
    });
    const tRows = [];
    if (columns.length) tRows.push(mk(columns, true, 0));
    rows.forEach((r, i) => tRows.push(mk(r, false, i)));
    const b = line(ink ? '999999' : P.rule, 6);
    return TBL(opt.fr || eq(ncol), opt.w)({ visuallyRightToLeft: rtl, rows: tRows, borders: { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b } });
  };

  /* ── questions ── */
  const ctx = { n: 0, keys: [] };
  const ruleLines = (n) => Array.from({ length: Math.max(1, n) }, () => new Paragraph({ children: [], bidirectional: rtl, spacing: { before: rtl ? 300 : 230, after: 0 }, border: { bottom: line(ink ? 'BBBBBB' : 'AAD8D4', 6) } }));
  /* Standard 4-line handwriting band: 4 rules ~3.2 mm apart (1, 2, 4 blue; baseline 3 red) */
  const fourBand = () => [0, 1, 2, 3].map(i => new Paragraph({
    children: [],
    spacing: { before: 0, after: 0, line: 181, lineRule: 'exact' },
    border: { top: line(ink ? (i === 2 ? '555555' : 'AAAAAA') : (i === 2 ? 'E07070' : '8DB0DC'), 4) },
  })).concat([new Paragraph({ children: [], spacing: { before: 0, after: 0, line: 120, lineRule: 'exact' } })]);
  const space = (kind, itemLines) => {
    const sp = answerSpace(kind, { locale: doc.locale, lines: lineMode, itemLines });
    return sp.style === 'four' ? Array.from({ length: sp.count }, fourBand).flat() : ruleLines(sp.count);
  };
  const ansLabel = (label) => para([new TextRun({ text: ` ${label} `, bold: true, size: 16, color: ink ? '333333' : P.teal, shading: shade(ink ? 'F0F0F0' : P.tealLt) })], { spacing: { before: 100, after: 40 } });
  const answerBox = (label, html) => (html ? [cellTable([para([new TextRun({ text: `${label.toUpperCase()}  `, bold: true, size: 16, color: ink ? '111111' : P.teal }), ...runs(html, { size: 20, color: ink ? '111111' : '163E3A' })], { spacing: { after: 0 } })], { w: BODY_W, fill: ink ? 'F5F5F5' : P.tealLt, margins: { top: 70, bottom: 70, left: 160, right: 160 } }), spacer(60)] : []);
  const markRun = (m) => (m != null && m !== '' ? [new TextRun({ text: '\t' }), new TextRun({ text: ` [${F.num(m)}] `, bold: true, size: 17, color: P.blue, shading: shade(P.blueLt) })] : []);
  const qText = (html, m) => para([...runs(html, { size: 22, color: '1A1A1A' }), ...markRun(m)], { tabStops: [{ type: rtl ? TabStopType.LEFT : TabStopType.RIGHT, position: CONTENT_W - 900 }], spacing: { after: 80 } });

  const qRow = (n, children) => new TableRow({
    cantSplit: false,
    children: [
      new TableCell({ width: { size: 620, type: WidthType.DXA }, margins: { top: 120, bottom: 120, left: 80, right: 80 }, children: [para([new TextRun({ text: ` ${F.num(n)} `, bold: true, size: 18, color: ink ? '111111' : 'FFFFFF', shading: shade(ink ? undefined : P.teal), border: ink ? line('333333', 8) : undefined })], { alignment: AlignmentType.CENTER, spacing: { after: 0 } })] }),
      new TableCell({ margins: { top: 120, bottom: 120, left: 120, right: 160 }, children }),
    ],
  });
  const qTable = (rows) => TBL([620 / CONTENT_W, 1 - 620 / CONTENT_W])({ visuallyRightToLeft: rtl, rows, borders: { top: line(ink ? 'BBBBBB' : P.rule, 8), bottom: line(ink ? 'BBBBBB' : P.rule, 8), left: line(ink ? 'BBBBBB' : P.rule, 8), right: line(ink ? 'BBBBBB' : P.rule, 8), insideHorizontal: line(ink ? 'DDDDDD' : P.rule, 4), insideVertical: NONE } });

  const optionsGrid = (opts2, ci) => {
    const cells = opts2.map((o, oi) => para([new TextRun({ text: `${F.opt(oi)} `, bold: true, color: P.teal, size: 20 }), ...runs(o, { size: 20, color: '333333', bold: answers === 'inline' && oi === ci }), ...(answers === 'inline' && oi === ci ? [new TextRun({ text: '  ✓', bold: true, color: P.teal })] : [])], { spacing: { after: 30 } }));
    const rows = [];
    for (let i = 0; i < cells.length; i += 2) rows.push(new TableRow({ children: [0, 1].map(k => new TableCell({ children: [cells[i + k] || para([])], borders: noBorders, shading: shade(answers === 'inline' && (i + k) === ci ? P.tealLt : undefined), margins: { top: 20, bottom: 20, left: 60, right: 60 } })) }));
    return TBL([0.5, 0.5], BODY_W)({ visuallyRightToLeft: rtl, rows, borders: noBorders });
  };

  const questionRows = async (set) => {
    const q = normalizeQtype(set.qtype);
    const rows = [];
    const key = [];
    const per = set.perItem;
    const itemLevel = ['mcq', 'true_false', 'fill_blanks', 'circle', 'punctuation', 'word_sentence', 'short', 'long', 'calculation', 'diagram'];
    if (itemLevel.includes(q)) {
      for (const it of set.items) {
        const n = ++ctx.n;
        const m = it.marks ?? per;
        const kids = [];
        const t = q === 'word_sentence' ? T.sentencePrompt(it.text) : it.text + (q === 'fill_blanks' && !/dk-blank|qp-blank/.test(it.text) ? ' <span class="dk-blank"></span>' : '');
        kids.push(qText(t, m));
        let ans = it.answer || '';
        if (q === 'mcq') {
          const ci = correctOptionIndex(it);
          kids.push(optionsGrid(it.options || [], ci));
          if (answers === 'space') { kids.push(ansLabel(T.answerLbl)); kids.push(para([new TextRun({ text: (it.options || []).map((_, oi) => F.opt(oi)).join('    ') + `     ${T.circleOne}`, size: 17, color: P.teal })])); }
          ans = ci >= 0 ? `${F.opt(ci)} ${it.options[ci]}` : ans;
        } else if (q === 'true_false') {
          const v = tfValue(it.answer);
          kids.push(para(['True', 'False'].flatMap(x => [new TextRun({ text: `  ${answers === 'inline' && v === x ? '☑' : '☐'} ${x === 'True' ? T.tTrue : T.tFalse}  `, size: 21, bold: answers === 'inline' && v === x, color: answers === 'inline' && v === x ? P.teal : '555555', border: line(answers === 'inline' && v === x ? P.teal : (ink ? 'BBBBBB' : P.rule), 6) }), new TextRun({ text: '     ' })])));
          if (answers === 'space') { kids.push(ansLabel(T.answerLbl)); kids.push(para([new TextRun({ text: `${T.tTrue}      ${T.tFalse}      ${T.circleOne}`, size: 17, color: P.teal })])); }
          ans = v === 'True' ? T.tTrue : v === 'False' ? T.tFalse : ans;
          if (it.explanation) ans += ` — ${inline(it.explanation)}`;
        } else if (q === 'circle') {
          const a = plain(it.answer || '').trim().toLowerCase();
          kids.push(para((it.options || []).flatMap(o => { const ok = answers === 'inline' && plain(o).trim().toLowerCase() === a; return [new TextRun({ text: `  ${plain(o)}  `, size: 21, bold: ok, color: ok ? P.teal : '333333', border: line(ok ? P.teal : (ink ? 'AAAAAA' : 'C9D6EA'), 6), shading: shade(ok ? P.tealLt : undefined) }), new TextRun({ text: '   ' })]; })));
        } else if (q === 'calculation') {
          kids.push(cellTable([para([new TextRun({ text: T.working, size: 19, color: P.muted })]), spacer(600)], { w: BODY_W, borders: { top: line(P.rule), bottom: line(P.rule), left: line(P.rule), right: line(P.rule) } }));
          if (answers === 'space') { kids.push(ansLabel(T.finalAnswer)); kids.push(...space('calculation')); }
        } else if (q === 'diagram') {
          if (it.image) kids.push(...await imageParagraph(it.image, 440, 260));
          else kids.push(para([new TextRun({ text: T.diagram, color: P.muted })], { alignment: AlignmentType.CENTER }));
          const nL = +it.labels || 0;
          for (let i = 0; i < nL; i += 2) kids.push(para([i, i + 1].filter(x => x < nL).flatMap(x => [new TextRun({ text: ` ${F.num(x + 1)} `, bold: true, size: 17, border: line(P.teal, 6), color: P.teal }), new TextRun({ text: ' ______________________        ' })])));
        } else if (answers === 'space') {
          kids.push(ansLabel(T.answerLbl)); kids.push(...space(q, it.lines));
        }
        if (answers === 'inline' && q !== 'mcq' && q !== 'true_false') kids.push(...answerBox(T.answer, ans));
        if (answers === 'inline' && q === 'true_false' && it.explanation) kids.push(...answerBox(T.why, inline(it.explanation)));
        rows.push(qRow(n, kids));
        key.push({ n, answer: ans, marks: m });
      }
      return { rows, key };
    }
    const n = ++ctx.n;
    const m = set.marks ?? (per && set.items.length ? per * set.items.length : null);
    const kids = [];
    let ans = '';
    if (q === 'match') {
      const left = set.items.map(it => it.left ?? it.a ?? it.text ?? '');
      const right = set.items.map(it => it.right ?? it.b ?? it.answer ?? '');
      const order = answers === 'inline' ? right.map((_, i) => i) : shuffledOrder(right.length, ctx.n + right.length);
      const posOf = (i) => order.indexOf(i);
      kids.push(qText(set.instruction || T.matchDefault, m));
      const mrows = left.map((l, i) => new TableRow({ children: [
        new TableCell({ children: [para([new TextRun({ text: `${F.col(i)}.  `, bold: true, color: P.teal }), ...runs(l, { size: 20 }), new TextRun({ text: `\t[ ${answers === 'inline' ? F.num(posOf(i) + 1) : '   '} ]`, bold: true, color: P.teal })], { tabStops: [{ type: rtl ? TabStopType.LEFT : TabStopType.RIGHT, position: Math.round(CONTENT_W / 2) - 900 }], spacing: { after: 0 } })], margins: { top: 60, bottom: 60, left: 80, right: 80 } }),
        new TableCell({ children: [para([new TextRun({ text: `${F.num(i + 1)}.  `, bold: true, color: P.teal }), ...runs(right[order[i]], { size: 20 })], { spacing: { after: 0 } })], margins: { top: 60, bottom: 60, left: 200, right: 80 } }),
      ] }));
      kids.push(TBL([0.5, 0.5], BODY_W)({ visuallyRightToLeft: rtl, rows: mrows, borders: { ...noBorders, insideHorizontal: line(P.rule, 4) } }));
      ans = left.map((_, i) => `${F.col(i)}–${F.num(posOf(i) + 1)}`).join(F.ur ? '، ' : ', ');
    } else if (q === 'word_pair') {
      const cols = set.columns && set.columns.length >= 2 ? set.columns : [T.word, T.answer];
      kids.push(qText(set.instruction || '', m));
      kids.push(dataTable(['#', cols[0], cols[1]], set.items.map((it, i) => {
        const a = it.a ?? it.text ?? ''; const b = it.b ?? it.answer ?? ''; const hideA = it.blank === 'a';
        return [F.sub(i), hideA && answers !== 'inline' ? '' : a, !hideA && answers !== 'inline' ? '' : b];
      }), { headFill: P.blueLt, headColor: P.blue, w: BODY_W, fr: [0.12, 0.44, 0.44] }));
      ans = set.items.map((it, i) => `${F.sub(i)}. ${plain(it.a ?? it.text)} ${F.ur ? '←' : '→'} ${plain(it.b ?? it.answer)}`).join(F.ur ? '؛ ' : '; ');
    } else if (q === 'passage') {
      kids.push(qText(set.instruction || T.passageDefault, m));
      if (set.passage) kids.push(cellTable([text(set.passage, { spacing: { after: 0, line: 300 } })], { w: BODY_W, fill: ink ? 'FAFAFA' : 'FAFBFD', left: line(ink ? '555555' : P.gold, 18) }), spacer(80));
      set.items.forEach((it, i) => {
        kids.push(para([new TextRun({ text: `${F.sub(i)}. `, bold: true }), ...runs(it.text, { size: 21 }), ...(it.marks != null ? [new TextRun({ text: ` [${F.num(it.marks)}]`, color: P.muted })] : [])], { spacing: { before: 80, after: 40 } }));
        if (answers === 'space') kids.push(...space('passage', it.lines));
        if (answers === 'inline') kids.push(...answerBox(T.answer, it.answer));
      });
      ans = set.items.map((it, i) => `${F.sub(i)}. ${plain(it.answer || '—')}`).join('  ');
    } else if (q === 'composition') {
      kids.push(qText(set.instruction || T.compositionDefault, m));
      set.items.forEach((it, i) => { if (it.text) kids.push(para([new TextRun({ text: `${F.sub(i)}.  `, bold: true, color: P.teal }), ...runs(it.text, { size: 21 })], { spacing: { after: 40 } })); });
      if (set.choiceNote) kids.push(text(set.choiceNote, {}, { color: P.muted, size: 19 }));
      if (answers === 'space') { kids.push(ansLabel(T.answerLbl)); kids.push(...space('composition', set.lines)); }
      if (answers === 'inline') set.items.forEach(it => { if (it.answer) kids.push(...answerBox(plain(it.text).slice(0, 40), it.answer)); });
      ans = set.items.some(it => it.answer) ? set.items.map(it => plain(it.answer || '')).filter(Boolean).join(' / ') : T.compositionKey;
    } else {
      kids.push(qText(set.instruction, m));
      set.items.forEach(it => kids.push(text(it.text)));
    }
    rows.push(qRow(n, kids));
    key.push({ n, answer: ans, marks: m });
    return { rows, key };
  };

  const secHead = (title, marks) => TBL([0.7, 0.3])({
    visuallyRightToLeft: rtl,
    borders: ink ? { top: line('BBBBBB', 8), left: line('BBBBBB', 8), right: line('BBBBBB', 8), bottom: NONE, insideHorizontal: NONE, insideVertical: NONE } : noBorders,
    rows: [new TableRow({ children: [
      new TableCell({ shading: shade(ink ? 'F0F0F0' : P.navy), margins: { top: 110, bottom: 110, left: 220, right: 100 }, children: [para([new TextRun({ text: plain(title).toUpperCase(), bold: true, size: 17, characterSpacing: 16, color: ink ? '111111' : 'FFFFFF' })], { spacing: { after: 0 } })] }),
      new TableCell({ shading: shade(ink ? 'F0F0F0' : P.navy), margins: { top: 110, bottom: 110, left: 100, right: 220 }, children: [para([new TextRun({ text: marks || '', size: 16, color: ink ? '555555' : 'C9D0DC' })], { alignment: rtl ? AlignmentType.LEFT : AlignmentType.RIGHT, spacing: { after: 0 } })] }),
    ] })],
  });

  const questionBox = async (set, title, marksLabel, note) => {
    const out = [];
    out.push(new Paragraph({ children: [], spacing: { before: 200, after: 0 } }));
    out.push(secHead(title, marksLabel));
    if (note) out.push(cellTable([text(note, { spacing: { after: 0 } }, { italics: true, size: 19, color: P.muted })], { margins: { top: 80, bottom: 20, left: 220, right: 220 } }));
    const { rows, key } = await questionRows(set);
    out.push(qTable(rows));
    return { out, key };
  };

  /* ── generic blocks ── */
  const blockParas = async (b) => {
    switch (b.type) {
      case 'heading': return [text(b.text, { spacing: { before: 200, after: 100 } }, { bold: true, size: [0, 32, 28, 24, 22][b.level || 3], color: P.navy })];
      case 'paragraph': return b.text ? [text(b.text)] : [];
      case 'list': return listParas(b.items, b.ordered);
      case 'numbered': return b.items.map((t, i) => para([new TextRun({ text: ` ${i + 1} `, bold: true, size: 18, color: ink ? '111111' : 'FFFFFF', shading: shade(ink ? undefined : P.navy), border: ink ? line('333333', 6) : undefined }), new TextRun({ text: '   ' }), ...runs(t, { size: 21, color: P.text })], { spacing: { after: 120 } }));
      case 'callout': {
        const v = b.variant;
        const warm = ['warning', 'teacher', 'gold'].includes(v); const cool = ['note', 'blue'].includes(v); const hot = ['alert', 'danger'].includes(v);
        const fill = ink ? 'F5F5F5' : warm ? P.goldLt : cool ? P.blueLt : hot ? P.redLt : P.tealLt;
        const bar = ink ? '555555' : warm ? P.gold : cool ? P.blue : hot ? P.red : P.teal;
        const lc = ink ? '111111' : warm ? '8A5F12' : bar;
        return [cellTable([para([...(b.label ? [new TextRun({ text: `${plain(b.label).replace(/:?\s*$/, '')}: `, bold: true, size: 21, color: lc })] : []), ...runs(b.text, { size: 21, color: P.text })], { spacing: { after: 0 } })], { fill, left: line(bar, 24) }), spacer(140)];
      }
      case 'definitions': return b.items.map(d => para([new TextRun({ text: `${plain(d.label).replace(/:?\s*$/, '')}: `, bold: true, size: 21, color: P.navy }), ...runs(d.text, { size: 21, color: P.text })], { spacing: { after: 120 } }));
      case 'table': return [dataTable(b.columns || [], b.rows || []), ...(b.caption ? [text(b.caption, {}, { italics: true, size: 18, color: P.muted })] : [spacer(140)])];
      case 'image': return b.src ? imageParagraph(b.src, 520, 340, b.caption) : [];
      case 'video': return [para([new TextRun({ text: ' ▶  ', color: P.red, bold: true, shading: shade(P.redLt) }), new ExternalHyperlink({ link: b.url, children: [new TextRun({ text: `${plain(b.title)} `, color: P.red, underline: {}, shading: shade(P.redLt), size: 21 })] })], { spacing: { before: 80, after: 160 } })];
      case 'link': return [para([new ExternalHyperlink({ link: b.url, children: [new TextRun({ text: plain(b.title), style: 'Hyperlink' })] })])];
      case 'resources': {
        const half = Math.ceil(b.items.length / 2);
        const col = (arr) => arr.map(t => para([new TextRun({ text: '●  ', color: P.gold, size: 14 }), ...runs(t, { size: 21, color: P.text })], { spacing: { after: 60 } }));
        return [TBL([0.5, 0.5])({ visuallyRightToLeft: rtl, borders: noBorders, rows: [new TableRow({ children: [new TableCell({ children: col(b.items.slice(0, half)) }), new TableCell({ children: col(b.items.slice(half)).length ? col(b.items.slice(half)) : [para([])] })] })] }), spacer(120)];
      }
      case 'quote': return [text(b.text, { indent: { left: 360 }, border: { left: line(P.gold, 12) } }, { italics: true })];
      case 'divider': return [new Paragraph({ children: [], border: { bottom: line(P.rule, 6) }, spacing: { before: 120, after: 200 } })];
      case 'subsection': {
        const out = [para([...runs(b.title, { bold: true, size: 22, color: P.blue }), ...(b.minutes ? [new TextRun({ text: ` — ${b.minutes} minutes`, bold: true, size: 22, color: P.blue })] : [])], { border: rtl ? { right: line(P.navy, 18) } : { left: line(P.navy, 18) }, indent: rtl ? { right: 120 } : { left: 120 }, spacing: { before: 220, after: 100 } })];
        for (const x of b.blocks) out.push(...await blockParas(x));
        return out;
      }
      case 'lesson_title': return lessonTitle(b);
      case 'questions': {
        const title = b.title || QTYPE_LABEL[normalizeQtype(b.qtype)] || 'Questions';
        const note = b.instruction && !['match', 'word_pair', 'passage', 'composition'].includes(normalizeQtype(b.qtype)) ? b.instruction : '';
        const { out, key } = await questionBox(b, title, setMarksLabel(b, F), note);
        ctx.keys.push({ title: plain(title), rows: key });
        return [...out, spacer(160)];
      }
      default: return [];
    }
  };

  const lessonTitle = (b) => [
    ...(b.kicker ? [para([new TextRun({ text: plain(b.kicker).toUpperCase(), bold: true, size: 17, characterSpacing: 60, color: P.gold })], { spacing: { after: 60 } })] : []),
    para([...runs(b.title, { font: SERIF, bold: true, size: 44, color: P.navy }), ...(b.badge ? [new TextRun({ text: `   ${b.badge}  `, size: 16, bold: true, color: b.badge === 'Mentor AI' ? '6D28D9' : '15803D', shading: shade(ink ? undefined : (b.badge === 'Mentor AI' ? 'EDE9FE' : 'DCFCE7')) })] : [])], { spacing: { after: 80 } }),
    ...(b.duration ? [para([new TextRun({ text: `⏱  ${b.duration}`, size: 19, color: P.muted })])] : []),
    new Paragraph({ children: [], border: { bottom: line(P.rule, 8) }, spacing: { after: 300 } }),
  ];

  /* ── mastheads ── */
  const lessonMast = () => {
    const out = [];
    const L = new TableCell({ shading: shade(ink ? undefined : P.navy), margins: { top: 300, bottom: 260, left: 400, right: 100 }, verticalAlign: VerticalAlign.CENTER, children: [
      para([new TextRun({ text: doc.school.name, font: SERIF, bold: true, size: 36, color: ink ? '111111' : 'FFFFFF' })], { spacing: { after: 40 } }),
      ...(doc.school.tagline ? [para([new TextRun({ text: doc.school.tagline.toUpperCase(), size: 14, characterSpacing: 60, color: ink ? '555555' : P.gold })], { spacing: { after: 0 } })] : []),
    ] });
    const R = new TableCell({ shading: shade(ink ? undefined : P.navy), margins: { top: 300, bottom: 260, left: 100, right: 400 }, verticalAlign: VerticalAlign.CENTER, children: [
      para([new TextRun({ text: doc.docType || 'Document', font: SERIF, bold: true, size: 28, color: ink ? '111111' : P.gold })], { alignment: rtl ? AlignmentType.LEFT : AlignmentType.RIGHT, spacing: { after: 20 } }),
      ...(doc.docSub ? [para([new TextRun({ text: doc.docSub.toUpperCase(), size: 14, characterSpacing: 40, color: ink ? '777777' : 'A9B1C2' })], { alignment: rtl ? AlignmentType.LEFT : AlignmentType.RIGHT, spacing: { after: 0 } })] : []),
    ] });
    out.push(TBL([0.64, 0.36])({ visuallyRightToLeft: rtl, borders: ink ? { ...noBorders, bottom: line('111111', 18) } : noBorders, rows: [new TableRow({ children: [L, R] })] }));
    if (!ink) out.push(new Paragraph({ children: [], border: { top: line(P.gold, 24) }, spacing: { after: 0 } }));
    const meta = (doc.meta || []).filter(m => m && m.value != null && m.value !== '');
    if (meta.length) {
      out.push(TBL(eq(meta.length))({ visuallyRightToLeft: rtl, borders: ink ? { ...noBorders, bottom: line('CCCCCC', 6), insideVertical: line('CCCCCC', 6) } : { ...noBorders, insideVertical: line('3A4866', 6) }, rows: [new TableRow({ children: meta.map(m => new TableCell({ shading: shade(ink ? undefined : P.navy2), margins: { top: 120, bottom: 120, left: 260, right: 160 }, children: [para([new TextRun({ text: `${String(m.label).toUpperCase()}  `, bold: true, size: 14, characterSpacing: 40, color: ink ? '555555' : P.gold }), new TextRun({ text: String(m.value), size: 19, color: ink ? '111111' : 'FFFFFF' })], { spacing: { after: 0 } })] })) })] }));
    }
    out.push(spacer(240));
    return out;
  };

  const paperMast = (teacher) => {
    const p = doc.paper || {};
    return [
      cellTable([
        para([new TextRun({ text: `${doc.school.name}${teacher ? ` — ${T.teacherCopy}` : ''}`.toUpperCase(), size: 16, characterSpacing: 40, color: ink ? '555555' : 'B5BDCC' })], { spacing: { after: 30 } }),
        para([new TextRun({ text: `${teacher ? `${T.answerKey} · ` : ''}${p.exam || plain(doc.title) || 'Question Paper'}`, bold: true, size: 32, color: ink ? '111111' : 'FFFFFF' })], { spacing: { after: 0 } }),
      ], { fill: ink ? undefined : P.navy, margins: { top: 220, bottom: 200, left: 300, right: 300 }, borders: ink ? { top: line('111111', 16), left: line('111111', 16), right: line('111111', 16), bottom: line('111111', 24) } : noBorders }),
      new Paragraph({ children: [], border: { top: line(ink ? '111111' : P.gold, 24) }, spacing: { after: 160 } }),
    ];
  };

  /* ── assemble ── */
  const children = [];
  const groups = [[]];
  doc.sections.forEach((s, i) => { if (s.newPage && i > 0 && groups[groups.length - 1].length) groups.push([]); groups[groups.length - 1].push(s); });

  for (let gi = 0; gi < groups.length; gi++) {
    if (gi > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    if (isPaper) {
      children.push(...paperMast(false && gi));
      if (gi === 0) {
        const p = doc.paper || {};
        if ((p.pills || []).length) children.push(para(p.pills.flatMap(x => [new TextRun({ text: `  ${x}  `, bold: true, size: 18, color: ink ? '333333' : P.blue, shading: shade(ink ? undefined : P.blueLt), border: ink ? line('CCCCCC', 6) : undefined }), new TextRun({ text: '  ' })]), { spacing: { after: 160 } }));
        const fields = p.fields || ['Student Name', 'Roll No.', 'Section'];
        if (fields.length) {
          const b = line(ink ? 'BBBBBB' : P.rule, 10);
          children.push(TBL(eq(fields.length))({ visuallyRightToLeft: rtl, borders: { top: b, bottom: b, left: b, right: b, insideVertical: b, insideHorizontal: NONE }, rows: [new TableRow({ children: fields.map(f => new TableCell({ margins: { top: 100, bottom: 120, left: 200, right: 200 }, children: [para([new TextRun({ text: f.toUpperCase(), size: 14, characterSpacing: 20, color: P.muted })], { spacing: { after: 180 } }), new Paragraph({ children: [], border: { bottom: line(ink ? 'CCCCCC' : P.rule, 6) } })] })) })] }));
          children.push(spacer(160));
        }
        if (p.instructions) children.push(cellTable([para([new TextRun({ text: F.ur ? T.instructions : 'INSTRUCTIONS', bold: true, size: 16, characterSpacing: 30, color: ink ? '111111' : P.teal })], { spacing: { after: 40 } }), text(p.instructions, { spacing: { after: 0 } }, { size: 19, color: ink ? '333333' : P.teal })], { fill: ink ? undefined : P.tealLt, left: line(ink ? '111111' : P.teal, 24) }));
      }
      for (const s of groups[gi]) {
        const sets = s.blocks.filter(b => b.type === 'questions');
        children.push(new Paragraph({ children: [], spacing: { before: 200, after: 0 } }));
        children.push(secHead(s.title, s.marks || (sets.length === 1 ? setMarksLabel(sets[0], F) : '')));
        const rows = []; const keyRows = [];
        for (let i = 0; i < sets.length; i++) {
          const set = sets[i];
          const showNote = set.instruction && !['match', 'word_pair', 'passage', 'composition'].includes(normalizeQtype(set.qtype));
          if (showNote) rows.push(new TableRow({ children: [new TableCell({ columnSpan: 2, margins: { top: 80, bottom: 20, left: 220, right: 220 }, children: [text(set.instruction, { spacing: { after: 0 } }, { italics: true, size: 19, color: P.muted })] })] }));
          const r = await questionRows(set);
          rows.push(...r.rows); keyRows.push(...r.key);
        }
        ctx.keys.push({ title: plain(s.title), rows: keyRows });
        if (rows.length) children.push(qTable(rows));
      }
    } else {
      if (gi === 0) {
        children.push(...lessonMast());
        if (doc.title) children.push(...lessonTitle({ kicker: doc.kicker, title: inline(doc.title), duration: (doc.subtitleBits || []).join('   ·   ') }));
        if (doc.studentInfo && answers !== 'inline') {
          const b = line('CCCCCC', 6);
          children.push(TBL(eq(4))({ borders: { top: b, bottom: b, left: b, right: b, insideVertical: b, insideHorizontal: NONE }, rows: [new TableRow({ children: [T.studentName, T.date, T.classSection, T.rollNo].map(f => new TableCell({ margins: { top: 90, bottom: 110, left: 160, right: 160 }, children: [para([new TextRun({ text: f.toUpperCase(), bold: true, size: 14, color: '666666' })], { spacing: { after: 180 } }), new Paragraph({ children: [], border: { bottom: line('333333', 8) } })] })) })] }), spacer(200));
        }
      }
      for (const s of groups[gi]) {
        if (s.lessonTitle) children.push(...lessonTitle({ ...s.lessonTitle, kicker: inline(s.lessonTitle.kicker || ''), title: inline(s.lessonTitle.title || '') }));
        if (s.title) children.push(pill(s.title, s.tone, [...(s.minutes ? [new TextRun({ text: `    ${s.minutes} minutes`, size: 19, color: P.muted })] : []), ...(s.marks ? [new TextRun({ text: `    ${s.marks}`, size: 18, bold: true, color: P.blue })] : [])]));
        if (!s.blocks.length && s.emptyText) children.push(text(s.emptyText, {}, { italics: true, color: '9AA0AC' }));
        for (const b of s.blocks) children.push(...await blockParas(b));
      }
    }
  }

  if (opts.answerKey && ctx.keys.some(k => k.rows.length)) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    if (isPaper) children.push(...paperMast(true));
    children.push(cellTable([para([new TextRun({ text: `${T.answerKey}${doc.paper?.subjectLine ? ` — ${doc.paper.subjectLine}` : ''}`, bold: true, size: 26, color: ink ? '111111' : 'FFFFFF' }), ...(doc.paper?.totalMarks ? [new TextRun({ text: `\t${T.total}: ${F.num(doc.paper.totalMarks)} ${T.marks}`, size: 20, color: ink ? '555555' : 'D7EAE7' })] : [])], { tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W - 500 }], spacing: { after: 0 } })], { fill: ink ? undefined : P.teal, borders: ink ? { top: line('111111', 16), bottom: line('111111', 16), left: line('111111', 16), right: line('111111', 16) } : noBorders }), spacer(160));
    ctx.keys.filter(k => k.rows.length).forEach((k) => {
      children.push(para([new TextRun({ text: k.title.toUpperCase(), bold: true, size: 17, characterSpacing: 30, color: P.teal })], { spacing: { before: 200, after: 80 } }));
      k.rows.forEach(r => children.push(para([new TextRun({ text: `${F.num(r.n)}.  `, bold: true, color: P.teal, size: 21 }), ...runs(r.answer || '—', { size: 21, color: '1A1A1A' }), ...(r.marks != null ? [new TextRun({ text: `\t[${F.num(r.marks)}]`, bold: true, size: 18, color: P.blue })] : [])], { tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W - 100 }], border: { bottom: line(ink ? 'DDDDDD' : P.rule, 4) }, spacing: { after: 60 } })));
    });
  }

  const footerColor = ink ? '666666' : P.muted;
  const footer = new Footer({ children: [new Paragraph({
    bidirectional: rtl,
    border: { top: line(ink ? '111111' : P.gold, isPaper ? 18 : 12) },
    tabStops: [{ type: TabStopType.CENTER, position: Math.round(CONTENT_W / 2) }, { type: TabStopType.RIGHT, position: CONTENT_W }],
    spacing: { before: 80 },
    children: [
      new TextRun({ text: isPaper ? '' : (doc.footer?.brand || 'Mentor AI'), font: 'Georgia', bold: true, size: 18, color: ink ? '111111' : P.gold }),
      new TextRun({ text: `${isPaper ? '' : '\t'}${doc.footer?.center || ''}`, size: 15, color: footerColor }),
      new TextRun({ children: ['\tPage ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], size: 15, color: footerColor }),
    ],
  })] });

  const file = new Document({
    creator: 'Mentor AI · School Mentor ERP',
    title: plain(doc.title || doc.paper?.exam || 'Document'),
    styles: { default: { document: { run: { font: BODY_FONT, size: 21, color: P.text } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 720, bottom: 900, left: 850, right: 850, footer: 400 } }, bidi: rtl },
      footers: { default: footer },
      children,
    }],
  });
  const blob = await fixCellWidths(await Packer.toBlob(file));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* Give every table cell an explicit width from its table grid. Word
   copes without it, but Google Docs / Pages / LibreOffice shrink cells
   to their content when <w:tcW> is "auto". */
async function fixCellWidths(blob) {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(blob);
    const path = 'word/document.xml';
    const xml = await zip.file(path).async('string');
    const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const dom = new DOMParser().parseFromString(xml, 'application/xml');
    const kids = (el, name) => Array.from(el.childNodes).filter(n => n.nodeType === 1 && n.localName === name);
    Array.from(dom.getElementsByTagNameNS(W, 'tbl')).forEach((tbl) => {
      const grid = kids(tbl, 'tblGrid')[0];
      if (!grid) return;
      const cols = kids(grid, 'gridCol').map(g => +g.getAttributeNS(W, 'w') || 0);
      if (!cols.length) return;
      kids(tbl, 'tr').forEach((tr) => {
        let ci = 0;
        kids(tr, 'tc').forEach((tc) => {
          let pr = kids(tc, 'tcPr')[0];
          if (!pr) { pr = dom.createElementNS(W, 'w:tcPr'); tc.insertBefore(pr, tc.firstChild); }
          const spanEl = kids(pr, 'gridSpan')[0];
          const span = spanEl ? (+spanEl.getAttributeNS(W, 'val') || 1) : 1;
          const width = cols.slice(ci, ci + span).reduce((a, b) => a + b, 0);
          ci += span;
          let tcW = kids(pr, 'tcW')[0];
          if (!tcW) { tcW = dom.createElementNS(W, 'w:tcW'); pr.insertBefore(tcW, pr.firstChild); }
          tcW.setAttributeNS(W, 'w:w', String(width));
          tcW.setAttributeNS(W, 'w:type', 'dxa');
        });
      });
    });
    zip.file(path, new XMLSerializer().serializeToString(dom));
    return await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  } catch (e) {
    return blob;
  }
}
