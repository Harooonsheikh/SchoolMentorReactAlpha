/* ═══════════════════════════════════════════════════════════════════
   docKit / normalize — turns whatever the backend sends into ONE
   canonical block list. Every renderer (screen preview, PDF, Word)
   reads only the canonical shape, so they can never drift apart.

   Accepted input for any "content" value:
     • string            → HTML (sanitised) OR markdown-lite
                            (# headings, - / 1. lists, | pipe | tables |,
                             **bold**, *italic*, ![alt](src), > quote)
     • string[]          → bullet list
     • block / block[]   → { type: 'paragraph' | 'list' | 'table' | … }
     • plain object      → each key becomes a labelled sub-section
     • number / boolean  → paragraph

   Canonical blocks (see LESSON_DOC_JSON_GUIDE.md for the full contract):
     heading{text,level} paragraph{text} list{ordered,items[{text,items}]}
     numbered{items} callout{variant,label,text} definitions{items[{label,text}]}
     table{columns,rows,caption} image{src,alt,caption,width} video{url,title}
     link{url,title} resources{items} subsection{title,minutes,blocks}
     quote{text} divider page_break html{html}
     questions{qtype,title,instruction,marks,items,...}  (question set)
   Inline text (`text`, list items, cells) is sanitised inline HTML.
   ═══════════════════════════════════════════════════════════════════ */

const BLOCK_TAGS = /<(p|div|ul|ol|li|table|h[1-6]|img|blockquote|br|section|figure|iframe|video|hr|pre)\b/i;

const ALLOWED_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup', 'br', 'span', 'a', 'mark', 'small', 'code',
  'p', 'div', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'blockquote', 'figure', 'figcaption', 'hr', 'pre',
  'section', 'iframe', 'video', 'source',
]);
const INLINE_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup', 'br', 'span', 'a', 'mark', 'small', 'code']);

export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const safeUrl = (u) => {
  const s = String(u || '').trim();
  if (/^(https?:|data:image\/|blob:|\/|\.\/|#)/i.test(s)) return s;
  return '';
};

/* ── Inline: sanitise HTML down to formatting tags, or convert
      markdown-lite (**b**, *i*, __u__, [t](url), ___ blanks). ── */
export function inline(value) {
  if (value == null) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return esc(String(value));
  if (Array.isArray(value)) return value.map(inline).join(', ');
  if (typeof value === 'object') return inline(value.text ?? value.label ?? value.value ?? '');
  const s = String(value);
  if (/<[a-z][\s\S]*>/i.test(s)) return sanitizeInlineHtml(s);
  return mdInline(s);
}

function mdInline(s) {
  let out = esc(s);
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>');
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => {
    const url = safeUrl(u.replace(/&amp;/g, '&'));
    return url ? `<a href="${esc(url)}">${t}</a>` : t;
  });
  out = out.replace(/_{3,}/g, '<span class="dk-blank"></span>');
  out = out.replace(/\n/g, '<br>');
  return out;
}

function sanitizeNode(node, allowBlocks) {
  const doc = node.ownerDocument;
  const out = doc.createDocumentFragment();
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) { out.appendChild(doc.createTextNode(child.textContent)); return; }
    if (child.nodeType !== 1) return;
    const tag = child.tagName.toLowerCase();
    if (['script', 'style', 'noscript', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'link', 'meta'].includes(tag)) return;
    const allowed = allowBlocks ? ALLOWED_TAGS.has(tag) : INLINE_TAGS.has(tag);
    if (!allowed) { out.appendChild(sanitizeNode(child, allowBlocks)); if (!allowBlocks && /^(p|div|li|h\d)$/.test(tag)) out.appendChild(doc.createElement('br')); return; }
    const el = doc.createElement(tag);
    if (tag === 'a') { const h = safeUrl(child.getAttribute('href')); if (h) el.setAttribute('href', h); }
    if (tag === 'img' || tag === 'source' || tag === 'iframe' || tag === 'video') {
      const src = safeUrl(child.getAttribute('src')); if (src) el.setAttribute('src', src);
      if (child.getAttribute('alt')) el.setAttribute('alt', child.getAttribute('alt'));
    }
    if (tag === 'td' || tag === 'th') {
      ['colspan', 'rowspan'].forEach(a => { const v = child.getAttribute(a); if (v && /^\d+$/.test(v)) el.setAttribute(a, v); });
    }
    const st = child.getAttribute('style') || '';
    const keep = [];
    if (/font-weight\s*:\s*(bold|[6-9]00)/i.test(st)) keep.push('font-weight:700');
    if (/font-style\s*:\s*italic/i.test(st)) keep.push('font-style:italic');
    if (/text-decoration[^;]*underline/i.test(st)) keep.push('text-decoration:underline');
    const align = st.match(/text-align\s*:\s*(left|right|center|justify)/i);
    if (align) keep.push(`text-align:${align[1]}`);
    if (keep.length) el.setAttribute('style', keep.join(';'));
    const cls = (child.getAttribute('class') || '').split(/\s+/).filter(c => /^(dk-|v-)/.test(c));
    if (cls.length) el.setAttribute('class', cls.join(' '));
    el.appendChild(sanitizeNode(child, allowBlocks));
    out.appendChild(el);
  });
  return out;
}

function parseHtml(html) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  return doc.body;
}

export function sanitizeInlineHtml(html) {
  const body = parseHtml(html);
  const wrap = body.ownerDocument.createElement('div');
  wrap.appendChild(sanitizeNode(body, false));
  return wrap.innerHTML.replace(/(<br>\s*)+$/, '');
}

export function sanitizeHtml(html) {
  const body = parseHtml(html);
  const wrap = body.ownerDocument.createElement('div');
  wrap.appendChild(sanitizeNode(body, true));
  return wrap.innerHTML;
}

/* ── HTML (e.g. rich-text editor output) → canonical blocks ── */
function htmlToBlocks(html) {
  const body = parseHtml(sanitizeHtml(html));
  const blocks = [];
  let para = [];
  const flush = () => {
    const h = para.join('').trim();
    if (h && h.replace(/<br\s*\/?>/g, '').trim()) blocks.push({ type: 'paragraph', text: h });
    para = [];
  };
  const listItems = (listEl) => Array.from(listEl.children).filter(li => li.tagName === 'LI').map((li) => {
    const nested = Array.from(li.children).find(c => c.tagName === 'UL' || c.tagName === 'OL');
    const clone = li.cloneNode(true);
    Array.from(clone.children).forEach(c => { if (c.tagName === 'UL' || c.tagName === 'OL') c.remove(); });
    const item = { text: sanitizeInlineHtml(clone.innerHTML) };
    if (nested) item.items = listItems(nested);
    return item;
  });
  const walk = (parent) => {
    parent.childNodes.forEach((n) => {
      if (n.nodeType === 3) { if (n.textContent.trim()) para.push(esc(n.textContent)); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName.toLowerCase();
      if (INLINE_TAGS.has(tag) && !n.querySelector('img,table,ul,ol')) {
        if (tag === 'br') { para.push('<br>'); return; }
        para.push(sanitizeInlineHtml(n.outerHTML)); return;
      }
      flush();
      const cl = n.classList;
      if (cl.contains('dk-callout')) {
        const v = Array.from(cl).find(c => c.startsWith('v-'));
        const lab = n.querySelector('b.dk-cl');
        const label = lab ? lab.textContent.replace(/:\s*$/, '') : '';
        if (lab) lab.remove();
        blocks.push({ type: 'callout', variant: v ? v.slice(2) : 'info', label: esc(label), text: sanitizeInlineHtml(n.innerHTML).trim() });
        return;
      }
      if (cl.contains('dk-video') || (tag === 'div' && n.querySelector(':scope > a.dk-video'))) {
        const a = cl.contains('dk-video') ? n : n.querySelector('a.dk-video');
        blocks.push({ type: 'video', url: a.getAttribute('href') || '', title: esc(a.textContent.trim()) });
        return;
      }
      if (cl.contains('dk-res')) { blocks.push({ type: 'resources', items: Array.from(n.children).map(li => sanitizeInlineHtml(li.innerHTML)) }); return; }
      if (cl.contains('dk-num')) { blocks.push({ type: 'numbered', items: Array.from(n.children).map(li => sanitizeInlineHtml((li.querySelector('div') || li).innerHTML)) }); return; }
      if (cl.contains('dk-sub-h')) { blocks.push({ type: 'heading', level: 3, text: sanitizeInlineHtml(n.innerHTML) }); return; }
      if (cl.contains('dk-defs')) { Array.from(n.children).forEach(d => blocks.push({ type: 'paragraph', text: sanitizeInlineHtml(d.innerHTML) })); return; }
      if (/^h[1-6]$/.test(tag)) blocks.push({ type: 'heading', level: +tag[1], text: sanitizeInlineHtml(n.innerHTML) });
      else if (tag === 'ul' || tag === 'ol') blocks.push({ type: 'list', ordered: tag === 'ol', items: listItems(n) });
      else if (tag === 'table') {
        const rows = Array.from(n.querySelectorAll('tr')).map(tr => Array.from(tr.children).map(c => sanitizeInlineHtml(c.innerHTML)));
        const hasHead = !!n.querySelector('thead th, tr:first-child th');
        blocks.push({ type: 'table', columns: hasHead ? rows.shift() : [], rows, caption: n.querySelector('caption')?.textContent || '' });
      } else if (tag === 'img') blocks.push({ type: 'image', src: n.getAttribute('src') || '', alt: n.getAttribute('alt') || '' });
      else if (tag === 'figure') {
        const img = n.querySelector('img');
        if (img) blocks.push({ type: 'image', src: img.getAttribute('src') || '', alt: img.getAttribute('alt') || '', caption: n.querySelector('figcaption')?.textContent || '' });
      } else if (tag === 'blockquote') blocks.push({ type: 'quote', text: sanitizeInlineHtml(n.innerHTML) });
      else if (tag === 'hr') blocks.push({ type: 'divider' });
      else if (tag === 'iframe' || tag === 'video') {
        const src = n.getAttribute('src') || n.querySelector('source')?.getAttribute('src') || '';
        if (src) blocks.push({ type: 'video', url: src, title: n.getAttribute('title') || 'Video' });
      } else if (tag === 'pre') blocks.push({ type: 'paragraph', text: esc(n.textContent).replace(/\n/g, '<br>') });
      else { walk(n); flush(); }
    });
  };
  walk(body);
  flush();
  return blocks;
}

/* ── Markdown-lite → canonical blocks ── */
function markdownToBlocks(src) {
  const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  let para = [];
  const flush = () => { if (para.length) { blocks.push({ type: 'paragraph', text: mdInline(para.join('\n')) }); para = []; } };
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (!t) { flush(); i++; continue; }
    let m;
    if ((m = t.match(/^(#{1,4})\s+(.*)$/))) { flush(); blocks.push({ type: 'heading', level: m[1].length, text: mdInline(m[2]) }); i++; continue; }
    if (/^(-{3,}|\*{3,})$/.test(t)) { flush(); blocks.push({ type: 'divider' }); i++; continue; }
    if ((m = t.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/))) { flush(); blocks.push({ type: 'image', alt: m[1], src: m[2], caption: m[1] }); i++; continue; }
    if (t.startsWith('>')) {
      flush(); const q = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) { q.push(lines[i].trim().replace(/^>\s?/, '')); i++; }
      blocks.push({ type: 'quote', text: mdInline(q.join('\n')) }); continue;
    }
    if (t.startsWith('|') && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1].trim())) {
      flush();
      const cells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => mdInline(c.trim()));
      const columns = cells(t); i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(cells(lines[i])); i++; }
      blocks.push({ type: 'table', columns, rows }); continue;
    }
    if (/^([-*•]|\d+[.)])\s+/.test(t)) {
      flush();
      const ordered = /^\d+[.)]/.test(t);
      const items = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
        const raw = lines[i];
        const indent = raw.match(/^\s*/)[0].length;
        const text = mdInline(raw.trim().replace(/^([-*•]|\d+[.)])\s+/, ''));
        if (indent >= 2 && items.length) (items[items.length - 1].items = items[items.length - 1].items || []).push({ text });
        else items.push({ text });
        i++;
      }
      blocks.push({ type: 'list', ordered, items }); continue;
    }
    para.push(line); i++;
  }
  flush();
  return blocks;
}

const titleCase = (k) => String(k).replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, c => c.toUpperCase());

const TYPE_ALIASES = {
  p: 'paragraph', text: 'paragraph', para: 'paragraph', h: 'heading', title: 'heading',
  bullets: 'list', ul: 'list', ol: 'list', steps: 'list', checklist: 'list',
  note: 'callout', tip: 'callout', info: 'callout', warning: 'callout', alert: 'callout',
  img: 'image', picture: 'image', photo: 'image', diagram_image: 'image',
  youtube: 'video', grid: 'table', kv: 'definitions', key_value: 'definitions', labels: 'definitions',
  materials: 'resources', homework: 'numbered', numbered_list: 'numbered', section: 'subsection', group: 'subsection',
  hr: 'divider', pagebreak: 'page_break', question_set: 'questions', question: 'questions',
};

function normalizeListItems(items) {
  return (items || []).map((it) => {
    if (it == null) return { text: '' };
    if (typeof it !== 'object') return { text: inline(it) };
    const out = { text: inline(it.text ?? it.label ?? it.title ?? it.value ?? '') };
    if (it.items || it.children) out.items = normalizeListItems(it.items || it.children);
    return out;
  });
}

function normalizeTable(b) {
  let columns = b.columns || b.headers || b.head || [];
  let rows = b.rows || b.data || b.body || [];
  if (rows.length && !Array.isArray(rows[0]) && typeof rows[0] === 'object') {
    if (!columns.length) columns = Object.keys(rows[0]);
    const keys = columns.map(c => (typeof c === 'object' ? (c.key ?? c.label) : c));
    rows = rows.map(r => keys.map(k => r[k] ?? r[String(k).toLowerCase()] ?? ''));
  }
  columns = columns.map(c => inline(typeof c === 'object' ? (c.label ?? c.key) : c));
  return { type: 'table', columns, rows: rows.map(r => (Array.isArray(r) ? r : [r]).map(inline)), caption: b.caption ? inline(b.caption) : '' };
}

/* One raw block object → canonical block(s) */
function normalizeBlock(raw) {
  const type0 = String(raw.type || raw.kind || '').toLowerCase();
  const type = TYPE_ALIASES[type0] || type0;
  switch (type) {
    case 'heading': return [{ type, level: Math.min(4, +raw.level || 3), text: inline(raw.text ?? raw.title) }];
    case 'paragraph': {
      const v = raw.text ?? raw.content ?? raw.value ?? '';
      if (typeof v === 'string' && BLOCK_TAGS.test(v)) return htmlToBlocks(v);
      return [{ type, text: inline(v) }];
    }
    case 'list': return [{ type, ordered: !!(raw.ordered ?? (type0 === 'ol' || type0 === 'steps')), items: normalizeListItems(raw.items || raw.list || []) }];
    case 'numbered': return [{ type, items: normalizeListItems(raw.items || raw.list || []).map(x => x.text) }];
    case 'callout': return [{ type, variant: raw.variant || raw.tone || (['tip', 'info', 'warning', 'note', 'alert'].includes(type0) ? type0 : 'info'), label: inline(raw.label ?? raw.title ?? ''), text: inline(raw.text ?? raw.content ?? '') }];
    case 'definitions': {
      const items = Array.isArray(raw.items) ? raw.items : Object.entries(raw.items || raw.data || {}).map(([label, text]) => ({ label, text }));
      return [{ type, items: items.map(x => ({ label: inline(x.label ?? x.key ?? x.term), text: inline(x.text ?? x.value ?? x.description) })) }];
    }
    case 'table': return [normalizeTable(raw)];
    case 'image': return [{ type, src: safeUrl(raw.src || raw.url || raw.image), alt: String(raw.alt || raw.caption || ''), caption: inline(raw.caption || ''), width: raw.width || null }];
    case 'video': return [{ type, url: safeUrl(raw.url || raw.src || raw.link), title: inline(raw.title || raw.label || 'Watch video') }];
    case 'link': return [{ type, url: safeUrl(raw.url || raw.href), title: inline(raw.title || raw.text || raw.url) }];
    case 'resources': return [{ type, items: normalizeListItems(raw.items || raw.list || []).map(x => x.text) }];
    case 'subsection': return [{ type, title: inline(raw.title ?? raw.heading ?? ''), minutes: raw.minutes ?? raw.duration ?? null, blocks: normalizeBlocks(raw.blocks ?? raw.content ?? raw.items ?? []) }];
    case 'quote': return [{ type, text: inline(raw.text ?? raw.content) }];
    case 'divider': return [{ type }];
    case 'page_break': return [{ type }];
    case 'html': return htmlToBlocks(raw.html ?? raw.content ?? '');
    case 'questions': return [normalizeQuestionSet(raw)];
    case 'lesson_title': return [{ type, kicker: inline(raw.kicker || ''), title: inline(raw.title || ''), duration: raw.duration || '', badge: raw.badge || '' }];
    default: {
      if (raw.blocks || raw.content) return [{ type: 'subsection', title: inline(raw.title ?? raw.heading ?? ''), minutes: raw.minutes ?? null, blocks: normalizeBlocks(raw.blocks ?? raw.content) }];
      if (raw.text) return [{ type: 'paragraph', text: inline(raw.text) }];
      return objectToBlocks(raw);
    }
  }
}

/* Plain object with no `type` → labelled sub-sections */
function objectToBlocks(obj) {
  const out = [];
  Object.entries(obj).forEach(([k, v]) => {
    if (v == null || v === '') return;
    if (typeof v !== 'object') { out.push({ type: 'definitions', items: [{ label: esc(titleCase(k)), text: inline(v) }] }); return; }
    out.push({ type: 'subsection', title: esc(titleCase(k)), blocks: normalizeBlocks(v) });
  });
  // merge consecutive single-definition blocks
  const merged = [];
  out.forEach(b => {
    const prev = merged[merged.length - 1];
    if (b.type === 'definitions' && prev && prev.type === 'definitions') prev.items.push(...b.items); else merged.push(b);
  });
  return merged;
}

export function normalizeBlocks(input) {
  if (input == null || input === '') return [];
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return [];
    if ((s.startsWith('{') || s.startsWith('[')) && /[}\]]$/.test(s)) {
      try { return normalizeBlocks(JSON.parse(s)); } catch (e) { /* not JSON */ }
    }
    if (BLOCK_TAGS.test(s) || /<\/(b|strong|i|em|u|span|a)>/i.test(s)) return htmlToBlocks(s);
    return markdownToBlocks(s);
  }
  if (typeof input === 'number' || typeof input === 'boolean') return [{ type: 'paragraph', text: esc(String(input)) }];
  if (Array.isArray(input)) {
    if (input.every(x => x == null || typeof x !== 'object')) return [{ type: 'list', ordered: false, items: normalizeListItems(input) }];
    return input.flatMap(x => (x && typeof x === 'object' && !Array.isArray(x)
      ? ((x.type || x.kind) ? normalizeBlock(x) : (x.text && Object.keys(x).length <= 2 ? [{ type: 'paragraph', text: inline(x.text) }] : objectToBlocks(x)))
      : normalizeBlocks(x)));
  }
  if (input.type || input.kind) return normalizeBlock(input);
  if (input.blocks) return normalizeBlocks(input.blocks);
  return objectToBlocks(input);
}

/* ═══════════ Questions ═══════════
   A question set = one numbered question in a paper (Q.1, Q.2 …) or
   one set in the question bank.
   { type:'questions', qtype, title, instruction, marks, perItem,
     passage, wordBank[], columns[], items[] }
   qtype: mcq | true_false | fill_blanks | match | word_pair |
          word_sentence | circle | punctuation | short | long |
          calculation | diagram | composition | passage
   Item shapes (all optional except text):
     { text, options[], answer, marks, lines, image, labels, topics[],
       left, right, a, b }                                             */
const QTYPE_ALIASES = {
  mcqs: 'mcq', multiple_choice: 'mcq', truefalse: 'true_false', tf: 'true_false',
  fill_in_the_blanks: 'fill_blanks', blanks: 'fill_blanks', match_columns: 'match', matching: 'match',
  word_opposite: 'word_pair', word_synonyms: 'word_pair', singular_plural: 'word_pair', opposite: 'word_pair', synonym: 'word_pair',
  word_sentences: 'word_sentence', circle_word: 'circle', circle_words: 'circle',
  short_q: 'short', short_questions: 'short', qa: 'short', long_q: 'long', long_question: 'long', essay: 'composition',
  essays: 'composition', paragraph: 'composition', letter: 'composition', application: 'composition', stories: 'composition',
  comprehension: 'passage', label: 'diagram', label_diagram: 'diagram', numerical: 'calculation',
};
export const normalizeQtype = (q) => { const k = String(q || 'short').toLowerCase(); return QTYPE_ALIASES[k] || k; };

function normalizeQuestionSet(raw) {
  const qtype = normalizeQtype(raw.qtype || raw.questionType || raw.kind2);
  const items = (raw.items || raw.questions || raw.rows || []).map((it) => {
    if (typeof it !== 'object' || it == null) return { text: inline(it) };
    const o = { ...it };
    o.text = inline(it.text ?? it.question ?? it.statement ?? it.prompt ?? it.word ?? it.title ?? '');
    if (it.options || it.choices) o.options = (it.options || it.choices).map(inline);
    if (it.answer != null) o.answer = inline(it.answer);
    if (it.passage) o.passage = inline(it.passage);
    if (it.topics) o.topics = it.topics.map(inline);
    if (it.left != null) o.left = inline(it.left);
    if (it.right != null) o.right = inline(it.right);
    if (it.a != null) o.a = inline(it.a);
    if (it.b != null) o.b = inline(it.b);
    if (it.image) o.image = safeUrl(it.image);
    return o;
  });
  return {
    type: 'questions',
    qtype,
    title: inline(raw.title || ''),
    instruction: inline(raw.instruction ?? raw.mainQ ?? raw.mainQuestion ?? ''),
    marks: raw.marks ?? null,
    perItem: raw.perItem ?? raw.marksEach ?? null,
    passage: raw.passage ? (BLOCK_TAGS.test(raw.passage) ? sanitizeHtml(raw.passage) : inline(raw.passage)) : '',
    wordBank: (raw.wordBank || []).map(inline),
    columns: (raw.columns || []).map(inline),
    choiceNote: raw.choiceNote ? inline(raw.choiceNote) : '',
    items,
  };
}

/* Plain text from inline HTML (for docx fallbacks / titles) */
export function plain(html) {
  if (!html) return '';
  const d = parseHtml(String(html).replace(/<br\s*\/?>/gi, '\n'));
  return d.textContent || '';
}

export const isRtlText = (s) => /[؀-ۿ]/.test(String(s || ''));
