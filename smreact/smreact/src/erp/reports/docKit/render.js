/* ═══════════════════════════════════════════════════════════════════
   docKit / render — canonical document JSON → HTML (screen preview,
   print and the source the PDF exporter rasterises).

   renderDocument(doc, opts) → { html, css, sheets }
     opts.theme   : 'color' | 'ink'
     opts.answers : 'none'   question only (exam paper default)
                    'space'  answer area under each question (answer sheet)
                    'inline' show the correct answers (teacher copy)
     opts.answerKey : true → appends a "Teacher copy — Answer key" sheet
     opts.mode    : 'screen' | 'pdf' | 'print'
   ═══════════════════════════════════════════════════════════════════ */
import { normalizeBlocks, normalizeQtype, inline, esc, plain } from './normalize';
import { DK_CSS, DK_FONTS } from './theme';
import { makeFormat, answerSpace, UR_LETTERS } from './locale';

const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx'];
export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const roman = (i) => ROMAN[i] || String(i + 1);

export const QTYPE_LABEL = {
  mcq: 'Multiple Choice Questions', true_false: 'True / False', fill_blanks: 'Fill in the Blanks',
  match: 'Match the Columns', word_pair: 'Word Pairs', word_sentence: 'Use in Sentences',
  circle: 'Circle the Correct Word', punctuation: 'Punctuation', short: 'Short Answer Questions',
  long: 'Long Answer Questions', calculation: 'Calculation', diagram: 'Label the Diagram',
  composition: 'Composition', passage: 'Comprehension',
};

/* ─────────── Document preparation ─────────── */
export function prepareDoc(raw) {
  const doc = { ...raw };
  doc.kind = doc.kind || 'lesson';
  doc.school = { name: 'School', tagline: 'Excellence · Integrity · Knowledge', ...(doc.school || {}) };
  doc.school.initials = doc.school.initials || doc.school.name.split(/[\s,]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  const sections = Array.isArray(doc.sections) ? doc.sections : [];
  doc.sections = sections.map((s) => ({
    ...s,
    title: s.title ? inline(s.title) : '',
    blocks: normalizeBlocks(s.blocks ?? s.content ?? s.items ?? []),
  }));
  if (doc.blocks) doc.sections.unshift({ title: '', blocks: normalizeBlocks(doc.blocks) });
  if (!doc.dir) {
    const probe = [doc.title, ...doc.sections.slice(0, 3).map(s => s.title + JSON.stringify(s.blocks).slice(0, 400))].join(' ');
    const ar = (probe.match(/[؀-ۿ]/g) || []).length;
    const la = (probe.match(/[A-Za-z]/g) || []).length;
    doc.dir = ar > la * 0.6 && ar > 20 ? 'rtl' : 'ltr';
  }
  doc.footer = { brand: 'Mentor AI', center: doc.school.name, ...(doc.footer || {}) };
  doc.locale = doc.locale || (doc.dir === 'rtl' ? 'ur' : 'en');
  delete doc.blocks;
  doc.__prepared = true;
  return doc;
}

/* ─────────── Inline blocks ─────────── */
function renderList(items, ordered) {
  const tag = ordered ? 'ol' : 'ul';
  return `<${tag}>${items.map((it, i) => `<li class="${i ? 'dk-brk' : ''}">${it.text}${it.items ? renderList(it.items, ordered) : ''}</li>`).join('')}</${tag}>`;
}

const PLAY_SVG = '<svg width="12" height="14" viewBox="0 0 12 14"><path d="M0 0L12 7L0 14Z" fill="currentColor"/></svg>';

function renderBlock(b, ctx, idx) {
  const brk = idx ? ' dk-brk' : '';
  switch (b.type) {
    case 'heading': return `<div class="dk-h dk-h${b.level || 3}${brk}">${b.text}</div>`;
    case 'paragraph': return b.text ? `<p class="${brk.trim()}">${b.text}</p>` : '';
    case 'list': return `<div class="${brk.trim()}">${renderList(b.items, b.ordered)}</div>`;
    case 'numbered': return `<ol class="dk-num${brk}">${b.items.map((t, i) => `<li class="${i ? 'dk-brk' : ''}"><i>${i + 1}</i><div>${t}</div></li>`).join('')}</ol>`;
    case 'callout': return `<div class="dk-callout v-${esc(b.variant)}${brk}">${b.label ? `<b class="dk-cl">${b.label.replace(/:?\s*$/, '')}:</b> ` : ''}${b.text}</div>`;
    case 'definitions': return `<div class="dk-defs${brk}">${b.items.map((d, i) => `<div class="${i ? 'dk-brk' : ''}"><b>${d.label.replace(/:?\s*$/, '')}:</b> ${d.text}</div>`).join('')}</div>`;
    case 'table': {
      const head = b.columns && b.columns.length ? `<thead><tr>${b.columns.map(c => `<th>${c}</th>`).join('')}</tr></thead>` : '';
      return `<div class="${brk.trim()}"><table class="dk-table">${head}<tbody>${b.rows.map((r, i) => `<tr class="${i ? 'dk-brk' : ''}">${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>${b.caption ? `<div class="dk-cap">${b.caption}</div>` : ''}</div>`;
    }
    case 'image': return b.src ? `<figure class="dk-fig${brk}"><img src="${esc(b.src)}" alt="${esc(b.alt)}" crossorigin="anonymous"${b.width ? ` style="width:${esc(b.width)}"` : ''}>${b.caption ? `<figcaption>${b.caption}</figcaption>` : ''}</figure>` : '';
    case 'video': return `<div class="${brk.trim()}"><a class="dk-video" href="${esc(b.url)}" target="_blank" rel="noopener">${PLAY_SVG}<span>${b.title}</span></a></div>`;
    case 'link': return `<p class="${brk.trim()}"><a href="${esc(b.url)}" target="_blank" rel="noopener">${b.title}</a></p>`;
    case 'resources': return `<ul class="dk-res${brk}">${b.items.map(t => `<li>${t}</li>`).join('')}</ul>`;
    case 'quote': return `<blockquote class="dk-quote${brk}">${b.text}</blockquote>`;
    case 'divider': return '<hr class="dk-divider">';
    case 'subsection': return `<div class="${brk.trim()}"><div class="dk-sub-h">${b.title}${b.minutes ? ` — ${esc(b.minutes)} minutes` : ''}</div>${b.blocks.map((x, i) => renderBlock(x, ctx, i)).join('')}</div>`;
    case 'lesson_title': return renderLessonTitle(b, ctx);
    case 'questions': return renderQuestionBox(b, ctx, idx);
    default: return '';
  }
}

function renderLessonTitle(b, ctx) {
  const src = b.badge ? `<span class="dk-src ${b.badge === 'Mentor AI' ? 'ai' : 'manual'}">${esc(b.badge)}</span>` : '';
  return `<div class="dk-lesson-h">${b.kicker ? `<div class="dk-kicker">${b.kicker}</div>` : ''}<h1 class="dk-title">${b.title}${src}</h1>${b.duration ? `<div class="dk-sub"><i>${clockSvg()}</i> ${esc(b.duration)}</div>` : ''}<hr class="dk-hr"></div>`;
}
const clockSvg = () => '<svg width="13" height="13" viewBox="0 0 16 16" style="vertical-align:-2px"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 4.5V8l2.5 1.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

/* ─────────── Questions ─────────── */
const lines = (n) => `<div class="ans-lines">${'<div class="qp-line"></div>'.repeat(Math.max(1, n))}</div>`;
const fourBands = (n) => `<div class="qp-four-wrap">${'<div class="qp-four"><i></i><i></i><i></i><i></i></div>'.repeat(Math.max(1, n))}</div>`;
/* Writing space under a question — single lines, 4-line copy bands, or Urdu single lines */
function space(kind, ctx, itemLines) {
  const sp = answerSpace(kind, { locale: ctx.locale, lines: ctx.lines, itemLines });
  return sp.style === 'four' ? fourBands(sp.count) : lines(sp.count);
}
const blanks = (t) => String(t || '').replace(/<span class="dk-blank"><\/span>/g, '<span class="qp-blank"></span>');

export function correctOptionIndex(it) {
  const a = plain(it.answer ?? it.correct ?? '').trim();
  if (!a) return -1;
  const m = a.match(/^\(?([a-hA-H])\)?\.?$/);
  if (m) return LETTERS.indexOf(m[1].toUpperCase());
  const u = a.replace(/[()]/g, '').trim();
  const ui = UR_LETTERS.indexOf(u);
  if (ui >= 0) return ui;
  if (/^\d+$/.test(a)) return +a - 1;
  return (it.options || []).findIndex(o => plain(o).trim().toLowerCase() === a.toLowerCase());
}
export const tfValue = (v) => {
  const s = plain(v).trim().toLowerCase();
  if (['true', 't', 'yes', 'درست', 'صحیح', 'ہاں'].includes(s)) return 'True';
  if (['false', 'f', 'no', 'غلط', 'نہیں'].includes(s)) return 'False';
  return '';
};

function itemRow(n, inner, F) {
  return `<div class="qp-q dk-brk"><div class="qp-qnum">${F.num(n)}</div><div class="qp-qbody">${inner}</div></div>`;
}

/* Deterministic shuffle so a printed match column is never already in order */
export function shuffledOrder(len, seed) {
  const idx = Array.from({ length: len }, (_, i) => i);
  if (len < 2) return idx;
  let s = (seed * 9301 + 49297) % 233280 || 7;
  for (let i = len - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor((s / 233280) * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  if (idx.every((v, i) => v === i)) idx.push(idx.shift());
  return idx;
}

/* Returns { html, key[] } for one question set. ctx.n = running number. */
function renderQuestionRows(set, ctx) {
  const q = normalizeQtype(set.qtype);
  const mode = ctx.answers;
  const F = ctx.F; const T = F.T;
  const key = [];
  const per = set.perItem;
  const markTag = (m) => (m != null && m !== '' ? `<span class="qp-mark">[${esc(F.num(m))}]</span>` : '');
  const answerBox = (label, html) => (html ? `<div class="qp-ans"><b>${label}</b>${html}</div>` : '');
  const ansLabel = (l = T.answerLbl) => `<div class="ans-label">${l}</div>`;
  let html = '';

  const itemLevel = ['mcq', 'true_false', 'fill_blanks', 'circle', 'punctuation', 'word_sentence', 'short', 'long', 'calculation', 'diagram'];
  if (itemLevel.includes(q)) {
    set.items.forEach((it) => {
      const n = ++ctx.n;
      const m = it.marks ?? per;
      let body = `<div class="qp-qtext">${q === 'word_sentence' ? T.sentencePrompt(it.text) : blanks(it.text)}${q === 'fill_blanks' && !/qp-blank|dk-blank/.test(it.text) ? ' <span class="qp-blank"></span>' : ''} ${markTag(m)}</div>`;
      let ans = '';
      if (q === 'mcq') {
        const ci = correctOptionIndex(it);
        body += `<div class="qp-opts">${(it.options || []).map((o, oi) => `<div class="qp-opt${mode === 'inline' && oi === ci ? ' ok' : ''}"><span class="qp-opt-lbl">${F.opt(oi)}</span> ${o}${mode === 'inline' && oi === ci ? ' ✓' : ''}</div>`).join('')}</div>`;
        if (mode === 'space') body += `<div class="ans-space">${ansLabel()}<div class="ans-chip">${(it.options || []).map((_, oi) => `<span>${F.opt(oi)}</span>`).join('')}<small>${T.circleOne}</small></div></div>`;
        ans = ci >= 0 ? `${F.opt(ci)} ${it.options[ci]}` : (it.answer || '');
      } else if (q === 'true_false') {
        const v = tfValue(it.answer);
        body += `<div class="qp-tf"><div class="qp-tf-btn${mode === 'inline' && v === 'True' ? ' ok' : ''}">${T.tTrue}</div><div class="qp-tf-btn${mode === 'inline' && v === 'False' ? ' ok' : ''}">${T.tFalse}</div></div>`;
        if (mode === 'space') body += `<div class="ans-space">${ansLabel()}<div class="ans-chip"><span>${T.tTrue}</span><span>${T.tFalse}</span><small>${T.circleOne}</small></div></div>`;
        ans = v === 'True' ? T.tTrue : v === 'False' ? T.tFalse : (it.answer || '');
        if (it.explanation) ans += ` — ${inline(it.explanation)}`;
      } else if (q === 'circle') {
        const a = plain(it.answer || '').trim().toLowerCase();
        body += `<div class="qp-circle">${(it.options || []).map(o => `<span class="${mode === 'inline' && plain(o).trim().toLowerCase() === a ? 'ok' : ''}">${o}</span>`).join('')}</div>`;
        ans = it.answer || '';
      } else if (q === 'calculation') {
        body += `<div class="qp-calcbox">${T.working}</div>`;
        if (mode === 'space') body += `<div class="ans-space">${ansLabel(T.finalAnswer)}${space('calculation', ctx)}</div>`;
        ans = it.answer || '';
      } else if (q === 'diagram') {
        body += `<div class="qp-diagram">${it.image ? `<img src="${esc(it.image)}" alt="Diagram" crossorigin="anonymous">` : `<span>${T.diagram}</span>`}</div>`;
        const nLabels = +it.labels || 0;
        if (nLabels) body += `<div class="qp-labels">${Array.from({ length: nLabels }, (_, i) => `<div><i>${F.num(i + 1)}</i><u></u></div>`).join('')}</div>`;
        ans = it.answer || '';
      } else {
        ans = it.answer || '';
        if (mode === 'space') body += `<div class="ans-space">${ansLabel()}${space(q, ctx, it.lines)}</div>`;
      }
      if (mode === 'inline' && q !== 'mcq' && q !== 'true_false') body += answerBox(T.answer, ans);
      if (mode === 'inline' && q === 'true_false' && it.explanation) body += answerBox(T.why, inline(it.explanation));
      html += itemRow(n, body, F);
      key.push({ n, answer: ans, marks: m });
    });
    return { html, key };
  }

  /* ── set-level questions: one number for the whole set ── */
  const n = ++ctx.n;
  const m = set.marks ?? (per && set.items.length ? per * set.items.length : null);
  let body = '';
  let ans = '';
  if (q === 'match') {
    const left = set.items.map(it => it.left ?? it.a ?? it.text ?? '');
    const right = set.items.map(it => it.right ?? it.b ?? it.answer ?? '');
    const order = mode === 'inline' ? right.map((_, i) => i) : shuffledOrder(right.length, ctx.n + right.length);
    const posOf = (i) => order.indexOf(i);
    body += `<div class="qp-qtext">${set.instruction || T.matchDefault} ${markTag(m)}</div>`;
    body += `<div class="qp-match"><div>${left.map((l, i) => `<div class="qp-match-row"><span class="qp-match-lbl">${F.col(i)}.</span> ${l}<div class="qp-match-box">${mode === 'inline' ? F.num(posOf(i) + 1) : ''}</div></div>`).join('')}</div><div>${order.map((orig, i) => `<div class="qp-match-row"><span class="qp-match-lbl">${F.num(i + 1)}.</span> ${right[orig]}</div>`).join('')}</div></div>`;
    ans = left.map((_, i) => `${F.col(i)}–${F.num(posOf(i) + 1)}`).join(F.ur ? '، ' : ', ');
  } else if (q === 'word_pair') {
    const cols = set.columns && set.columns.length >= 2 ? set.columns : [T.word, T.answer];
    body += `<div class="qp-qtext">${set.instruction || ''} ${markTag(m)}</div>`;
    body += `<table class="qp-table"><thead><tr><th style="width:44px">#</th><th>${cols[0]}</th><th>${cols[1]}</th></tr></thead><tbody>${set.items.map((it, i) => {
      const a = it.a ?? it.text ?? ''; const b = it.b ?? it.answer ?? '';
      const hideA = it.blank === 'a';
      const show = (v, hidden) => (hidden && mode !== 'inline' ? '' : v);
      return `<tr class="${i ? 'dk-brk' : ''}"><td>${F.sub(i)}</td><td>${show(a, hideA)}</td><td>${show(b, !hideA)}</td></tr>`;
    }).join('')}</tbody></table>`;
    ans = set.items.map((it, i) => `${F.sub(i)}. ${plain(it.a ?? it.text)} ${F.ur ? '←' : '→'} ${plain(it.b ?? it.answer)}`).join(F.ur ? '؛ ' : '; ');
  } else if (q === 'passage') {
    body += `<div class="qp-qtext">${set.instruction || T.passageDefault} ${markTag(m)}</div>`;
    if (set.passage) body += `<div class="qp-passage">${set.passage}</div>`;
    body += set.items.map((it, i) => {
      let x = `<div class="dk-brk" style="margin:6px 0 2px"><b>${F.sub(i)}.</b> ${it.text}${it.marks != null ? ` <span style="opacity:.7">[${esc(F.num(it.marks))}]</span>` : ''}</div>`;
      if (mode === 'space') x += space('passage', ctx, it.lines);
      if (mode === 'inline') x += answerBox(T.answer, it.answer);
      return x;
    }).join('');
    ans = set.items.map((it, i) => `${F.sub(i)}. ${plain(it.answer || '—')}`).join('  ');
  } else if (q === 'composition') {
    body += `<div class="qp-qtext">${set.instruction || T.compositionDefault} ${markTag(m)}</div>`;
    const topics = set.items.map(it => it.text).filter(Boolean);
    if (topics.length) body += `<div class="qp-topics">${topics.map((t, i) => `<div><b>${F.sub(i)}.</b> ${t}</div>`).join('')}</div>`;
    if (set.choiceNote) body += `<div style="font-size:10pt;opacity:.75">${set.choiceNote}</div>`;
    if (mode === 'space') body += `<div class="ans-space">${ansLabel()}${space('composition', ctx, set.lines)}</div>`;
    if (mode === 'inline') set.items.forEach(it => { if (it.answer) body += answerBox(plain(it.text).slice(0, 40), it.answer); });
    ans = set.items.some(it => it.answer) ? set.items.map(it => plain(it.answer || '')).filter(Boolean).join(' / ') : T.compositionKey;
  } else {
    body += `<div class="qp-qtext">${set.instruction} ${markTag(m)}</div>`;
    body += set.items.map(it => `<div>${it.text}</div>`).join('');
  }
  html += itemRow(n, body, F);
  key.push({ n, answer: ans, marks: m });
  return { html, key };
}

/** "5 × 1 = 5 marks" — English unless a formatter for another locale is passed. */
export function setMarksLabel(set, F = makeFormat('en')) { return F.marksLabel(set); }

/* A question set used inside a lesson / question bank: boxed with its own head */
function renderQuestionBox(set, ctx, idx) {
  const { html, key } = renderQuestionRows(set, ctx);
  ctx.keys.push({ title: set.title || QTYPE_LABEL[normalizeQtype(set.qtype)] || 'Questions', rows: key });
  const head = set.title || QTYPE_LABEL[normalizeQtype(set.qtype)] || 'Questions';
  const marks = setMarksLabel(set, ctx.F);
  const showNote = set.instruction && !['match', 'word_pair', 'passage', 'composition'].includes(normalizeQtype(set.qtype));
  return `<div class="dk-brk" style="margin:0 0 18px"><div class="qp-sec-head"><span>${head}</span><span>${marks}</span></div><div class="qp-sec-body">${showNote ? `<div class="qp-sec-note">${set.instruction}</div>` : ''}${html}</div></div>`;
}

/* ─────────── Sheets ─────────── */
function crest(doc) {
  if (doc.school.logoUrl) return `<div class="dk-crest"><img src="${esc(doc.school.logoUrl)}" alt="" crossorigin="anonymous"></div>`;
  const letter = esc((doc.school.initials || 'S')[0]);
  return `<div class="dk-crest"><svg viewBox="0 0 64 64" width="64" height="64" fill="none"><polygon points="32,4 58,18 58,46 32,60 6,46 6,18" stroke="#B8882A" stroke-width="1.8" fill="rgba(255,255,255,.04)"/><polygon points="32,11 51,22 51,42 32,53 13,42 13,22" stroke="#B8882A" stroke-opacity=".45" stroke-width=".8"/><text x="32" y="40" text-anchor="middle" font-family="Georgia,serif" font-size="21" font-weight="bold" fill="#B8882A">${letter}</text><line x1="21" y1="46" x2="43" y2="46" stroke="#B8882A" stroke-opacity=".6" stroke-width=".8"/></svg></div>`;
}

function lessonMasthead(doc) {
  const meta = (doc.meta || []).filter(m => m && m.value != null && m.value !== '');
  return `<header class="dk-mast"><div class="dk-mast-l">${crest(doc)}<div><div class="dk-school">${esc(doc.school.name)}</div>${doc.school.tagline ? `<div class="dk-tag">${esc(doc.school.tagline)}</div>` : ''}</div></div><div class="dk-mast-r"><div class="dk-doctype">${esc(doc.docType || 'Document')}</div>${doc.docSub ? `<div class="dk-docsub">${esc(doc.docSub)}</div>` : ''}</div></header><div class="dk-rule"></div>${meta.length ? `<div class="dk-meta">${meta.map(m => `<div class="dk-mi"><b>${esc(m.label)}</b><span>${esc(m.value)}</span></div>`).join('')}</div>` : ''}`;
}

function paperMasthead(doc, teacherCopy, F = makeFormat('en')) {
  const p = doc.paper || {};
  const logo = doc.school.logoUrl ? `<img src="${esc(doc.school.logoUrl)}" alt="" crossorigin="anonymous">` : esc((doc.school.initials || 'SM').slice(0, 3));
  return `<div class="qp-masthead"><div class="qp-logo">${logo}</div><div><div class="qp-school">${esc(doc.school.name)}${teacherCopy ? ` — ${F.T.teacherCopy}` : ''}</div><div class="qp-examname">${teacherCopy ? `${F.T.answerKey} · ` : ''}${esc(p.exam || doc.title || 'Question Paper')}</div></div></div><div class="qp-gold-bar"></div>`;
}

function footerHtml(doc, page, total, paper) {
  if (paper) return `<div class="qp-foot"><span>${esc(doc.footer.center)}</span><span>Page ${page} of ${total}${doc.footer.pageNote ? ` · ${esc(doc.footer.pageNote)}` : ''}</span></div>`;
  return `<footer class="dk-foot"><b>${esc(doc.footer.brand)}</b><span>${esc(doc.footer.center)}</span><span>Page ${page} of ${total}</span></footer>`;
}

function renderSections(sections, ctx) {
  return sections.map((s, si) => {
    if (s.lessonTitle) return renderLessonTitle({ ...s.lessonTitle, kicker: inline(s.lessonTitle.kicker || ''), title: inline(s.lessonTitle.title || '') }, ctx) + renderSections([{ ...s, lessonTitle: null }], ctx);
    const body = s.blocks.length ? s.blocks.map((b, i) => renderBlock(b, ctx, i)).join('') : (s.emptyText ? `<div class="dk-empty">${esc(s.emptyText)}</div>` : '');
    if (!s.title) return `<div class="dk-sec dk-brk">${body}</div>`;
    const tone = s.tone ? ` t-${s.tone}` : '';
    return `<section class="dk-sec dk-brk"><div class="dk-sec-h"><span class="dk-pill${tone}">${s.title}</span>${s.minutes ? `<span class="dk-mins">${esc(s.minutes)} minutes</span>` : ''}${s.marks ? `<span class="dk-sec-marks">${esc(s.marks)}</span>` : ''}</div>${body}</section>`;
  }).join('');
}

/* Paper body: sections are "Section A · Multiple Choice" with question sets */
function renderPaperSections(sections, ctx) {
  return sections.map((s) => {
    const sets = s.blocks.filter(b => b.type === 'questions');
    const other = s.blocks.filter(b => b.type !== 'questions');
    let rows = '';
    const keyRows = [];
    sets.forEach((set, i) => {
      const showNote = set.instruction && !['match', 'word_pair', 'passage', 'composition'].includes(normalizeQtype(set.qtype));
      if (showNote && (sets.length > 1 || i === 0)) rows += `<div class="qp-sec-note">${set.instruction}</div>`;
      const r = renderQuestionRows(set, ctx);
      rows += r.html; keyRows.push(...r.key);
    });
    ctx.keys.push({ title: plain(s.title), rows: keyRows });
    const marks = s.marks || (sets.length === 1 ? setMarksLabel(sets[0], ctx.F) : '');
    return `<div class="dk-brk">${other.map((b, i) => renderBlock(b, ctx, i)).join('')}<div class="qp-sec-head"><span>${s.title}</span><span>${esc(marks)}</span></div><div class="qp-sec-body">${rows}</div></div>`;
  }).join('');
}

function answerKeySheet(doc, keys, total, F = makeFormat('en')) {
  const rows = keys.filter(k => k.rows.length).map(k => `<div class="dk-brk"><div class="qp-ak-sec-lbl">${esc(k.title)}</div>${k.rows.map(r => `<div class="qp-ak-row dk-brk"><span class="qp-ak-n">${F.num(r.n)}.</span><span class="qp-ak-ans">${r.answer || '—'}</span>${r.marks != null ? `<span class="qp-ak-mark">[${esc(F.num(r.marks))}]</span>` : ''}</div>`).join('')}</div>`).join('');
  return `<div class="qp-ak-head">${F.T.answerKey}${doc.paper?.subjectLine ? ` — ${esc(doc.paper.subjectLine)}` : ''}<small>${total ? `${F.T.total}: ${esc(F.num(total))} ${F.T.marks}` : ''}</small></div>${rows}`;
}

export function renderDocument(rawDoc, opts = {}) {
  const doc = rawDoc.__prepared ? rawDoc : prepareDoc(rawDoc);
  const theme = opts.theme === 'ink' ? 'ink' : 'col';
  const isPaper = doc.kind === 'paper';
  const F = makeFormat(doc.locale);
  const ctx = { n: 0, answers: opts.answers || (isPaper ? 'none' : 'inline'), keys: [], F, locale: doc.locale, lines: opts.lines === 'four' ? 'four' : 'single' };

  /* Split sections into sheets at newPage */
  const groups = [[]];
  doc.sections.forEach((s, i) => { if (s.newPage && i > 0 && groups[groups.length - 1].length) groups.push([]); groups[groups.length - 1].push(s); });

  const sheets = [];
  groups.forEach((g, gi) => {
    let inner = '';
    if (isPaper) {
      if (gi === 0) {
        const p = doc.paper || {};
        const pills = (p.pills || []).map(x => `<div class="qp-meta-pill">${esc(x)}</div>`).join('');
        const fields = p.fields || ['Student Name', 'Roll No.', 'Section'];
        inner += paperMasthead(doc, false, F);
        if (pills) inner += `<div class="qp-meta-row">${pills}</div>`;
        if (fields.length) inner += `<div class="qp-fields" style="--qpf:${fields.length}">${fields.map(f => `<div><label>${esc(f)}</label><span>&nbsp;</span></div>`).join('')}</div>`;
        if (p.instructions) inner += `<div class="qp-instr"><b>${F.T.instructions}</b>${inline(p.instructions)}</div>`;
      } else inner += paperMasthead(doc, false, F);
      inner += renderPaperSections(g, ctx);
      sheets.push({ body: `<div class="qp-body">${inner}</div>`, paper: true });
    } else {
      let head = '';
      if (gi === 0) {
        head = lessonMasthead(doc);
        if (doc.title) inner += `${doc.kicker ? `<div class="dk-kicker">${esc(doc.kicker)}</div>` : ''}<h1 class="dk-title">${inline(doc.title)}</h1>${(doc.subtitleBits || []).length ? `<div class="dk-sub">${doc.subtitleBits.map((t, i) => `<span>${i === 0 && doc.durationFirst ? `<i>${clockSvg()}</i> ` : ''}${esc(t)}</span>`).join('')}</div>` : ''}<hr class="dk-hr">`;
        if (doc.studentInfo && ctx.answers !== 'inline') inner += `<div class="dk-student">${[F.T.studentName, F.T.date, F.T.classSection, F.T.rollNo].map(l => `<div><label>${l}</label><span></span></div>`).join('')}</div>`;
      }
      inner += renderSections(g, ctx);
      sheets.push({ body: `${head}<div class="dk-sheet-body">${inner}</div>`, paper: false });
    }
  });

  if (opts.answerKey && ctx.keys.some(k => k.rows.length)) {
    const body = isPaper
      ? `<div class="qp-body">${paperMasthead(doc, true, F)}${answerKeySheet(doc, ctx.keys, doc.paper?.totalMarks, F)}</div>`
      : `<div class="dk-sheet-body">${answerKeySheet(doc, ctx.keys, null, F)}</div>`;
    sheets.push({ body, paper: isPaper });
  }

  const total = sheets.length;
  const dir = doc.dir === 'rtl' ? 'rtl' : 'ltr';
  const sheetHtml = sheets.map((s, i) => `<div class="dk-sheet" data-sheet="${i}">${s.body}${footerHtml(doc, i + 1, total, s.paper)}</div>`).join('');
  const html = `<div class="dk-stage${opts.mode === 'pdf' ? ' flat dk-pdf' : ''}${opts.mode === 'print' ? ' flat' : ''}"><div class="dk ${theme}" dir="${dir}" lang="${dir === 'rtl' ? 'ur' : 'en'}">${sheetHtml}</div></div>`;
  return { html, css: DK_CSS, sheets: total, doc, keys: ctx.keys, dir };
}

export function renderStandalone(doc, opts = {}) {
  const r = renderDocument(doc, opts);
  const title = esc(plain(doc.title || doc.paper?.exam || 'Document'));
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="${DK_FONTS}" rel="stylesheet"><style>${r.css}</style></head><body>${r.html}</body></html>`;
}

/* Any section value (HTML, markdown, JSON blocks, {minutes, content}) →
   HTML for the lesson rich-text editor. Plain HTML strings pass through. */
export function contentToHtml(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string' && /<[a-z][\s\S]*>/i.test(value)) return value;
  let v = value;
  if (v && typeof v === 'object' && !Array.isArray(v) && !v.type && ('content' in v || 'blocks' in v)) v = v.content ?? v.blocks;
  const ctx = { n: 0, answers: 'inline', keys: [], F: makeFormat('en'), locale: 'en', lines: 'single' };
  return normalizeBlocks(v).map((b, i) => renderBlock(b, ctx, i)).join('');
}

export { normalizeBlocks };
