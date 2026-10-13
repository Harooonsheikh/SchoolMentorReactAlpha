import React, { useMemo, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/* ═══════════════════════════════════════════════════════════════════
   MarkdownMessage — renders AI Markdown for the Mentor AI chat.

   Safety: the parser builds React elements, never an HTML string, so
   anything the model (or a prompt-injected document) writes as HTML is
   shown as text — there is no innerHTML path for model output. Link
   URLs are allow-listed (http/https/mailto/tel/relative). The only
   injected markup is KaTeX's own output, rendered with trust:false
   (KaTeX escapes its input and disables \href, \htmlClass, etc.).

   Streaming: the whole text is re-parsed on every chunk. An unclosed
   ``` fence renders as an open code block, an unclosed $$ block
   renders as pending source, and unmatched ** / ` stay literal until
   their closer arrives — so partial output never breaks the layout.

   Supported: headings, paragraphs (single newlines kept as line
   breaks), **bold**, *italic*, ~~strike~~, `code`, fenced code with
   highlighting + copy, bullet/numbered/nested/task lists, GFM tables,
   blockquotes, horizontal rules, links/autolinks, $inline$ / $$block$$
   / \( \) / \[ \] math, <br> inside tables, [placeholder] highlighting.
   Styling: .msai-md* rules in MentorAI.jsx's MENTORAI_CSS.
   ═══════════════════════════════════════════════════════════════════ */

export default function MarkdownMessage({ text, streaming = false, className = '' }) {
  const blocks = useMemo(() => parseMarkdown(text || ''), [text]);
  return (
    <div className={`msai-md${className ? ` ${className}` : ''}`}>
      {renderBlocks(blocks, 'b')}
      {streaming && <span className="msai-md-caret" aria-hidden="true" />}
    </div>
  );
}

/* Inline-only version for single values inside other layouts — list
   items, questions, answers, table cells. Renders **bold**, *italic*,
   `code`, math and links (and keeps line breaks) with the same safety
   rules, without adding paragraph/block spacing. */
export function InlineMarkdown({ text }) {
  const nodes = useMemo(() => parseInline(text == null ? '' : String(text)), [text]);
  return <span className="msai-md msai-md-inline">{renderInline(nodes, 'i')}</span>;
}

/* ══════════════════════ Block parser ══════════════════════ */

const RE_FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)[^`]*$/;
const RE_HEADING = /^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const RE_HR = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const RE_QUOTE = /^ {0,3}>\s?/;
const RE_LIST = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const RE_TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

export function parseMarkdown(src) {
  const lines = String(src).replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  return parseBlocks(lines);
}

function isMathStart(line) {
  const t = line.trim();
  return t.startsWith('$$') || t.startsWith('\\[');
}

function startsBlock(line, next) {
  return RE_FENCE.test(line) || RE_HEADING.test(line) || RE_HR.test(line) || RE_QUOTE.test(line)
    || RE_LIST.test(line) || isMathStart(line) || isTableStart(line, next);
}

function isTableStart(line, next) {
  return line.includes('|') && next !== undefined && next.includes('-') && RE_TABLE_SEP.test(next) && (next.includes('|') || line.trim().startsWith('|'));
}

function parseBlocks(lines) {
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }

    // Fenced code
    const fence = line.match(RE_FENCE);
    if (fence) {
      const marker = fence[1];
      const lang = (fence[2] || '').toLowerCase();
      const body = [];
      let j = i + 1;
      let closed = false;
      while (j < lines.length) {
        const t = lines[j].trim();
        if (t.startsWith(marker[0].repeat(marker.length)) && /^([`~])\1*$/.test(t)) { closed = true; break; }
        body.push(lines[j]);
        j += 1;
      }
      blocks.push({ type: 'code', lang, code: body.join('\n'), closed });
      i = closed ? j + 1 : j;
      continue;
    }

    // Display math $$…$$ or \[…\]
    if (isMathStart(line)) {
      const t = line.trim();
      const open = t.startsWith('$$') ? '$$' : '\\[';
      const close = open === '$$' ? '$$' : '\\]';
      const rest = t.slice(2);
      const sameLine = rest.indexOf(close);
      if (sameLine !== -1) {
        blocks.push({ type: 'math', tex: rest.slice(0, sameLine).trim(), closed: true });
        const after = rest.slice(sameLine + 2).trim();
        if (after) blocks.push({ type: 'paragraph', text: after });
        i += 1;
        continue;
      }
      const body = rest ? [rest] : [];
      let j = i + 1;
      let closed = false;
      while (j < lines.length) {
        const idx = lines[j].indexOf(close);
        if (idx !== -1) { body.push(lines[j].slice(0, idx)); closed = true; break; }
        body.push(lines[j]);
        j += 1;
      }
      blocks.push({ type: 'math', tex: body.join('\n').trim(), closed });
      i = j + 1;
      continue;
    }

    const heading = line.match(RE_HEADING);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      i += 1;
      continue;
    }

    if (RE_HR.test(line)) { blocks.push({ type: 'hr' }); i += 1; continue; }

    if (RE_QUOTE.test(line)) {
      const inner = [];
      while (i < lines.length && lines[i].trim() && RE_QUOTE.test(lines[i])) {
        inner.push(lines[i].replace(RE_QUOTE, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', children: parseBlocks(inner) });
      continue;
    }

    if (isTableStart(line, lines[i + 1])) {
      const header = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map(c => {
        const l = c.startsWith(':'); const r = c.endsWith(':');
        return l && r ? 'center' : r ? 'right' : l ? 'left' : null;
      });
      const rows = [];
      let j = i + 2;
      while (j < lines.length && lines[j].trim() && lines[j].includes('|')) {
        const cells = splitRow(lines[j]);
        while (cells.length < header.length) cells.push('');
        rows.push(cells.slice(0, Math.max(header.length, 1)));
        j += 1;
      }
      blocks.push({ type: 'table', header, aligns, rows });
      i = j;
      continue;
    }

    if (RE_LIST.test(line)) {
      const { node, next } = parseList(lines, i);
      blocks.push(...node);
      i = next;
      continue;
    }

    // Paragraph
    const para = [line.trim()];
    let j = i + 1;
    while (j < lines.length && lines[j].trim() && !startsBlock(lines[j], lines[j + 1])) {
      para.push(lines[j].trim());
      j += 1;
    }
    blocks.push({ type: 'paragraph', text: para.join('\n') });
    i = j;
  }
  return blocks;
}

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells = [];
  let cur = '';
  let inCode = false;
  for (let k = 0; k < s.length; k += 1) {
    const ch = s[k];
    if (ch === '\\' && s[k + 1] === '|') { cur += '|'; k += 1; continue; }
    if (ch === '`') inCode = !inCode;
    if (ch === '|' && !inCode) { cells.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

/* Lists: builds nested list nodes from indentation. */
function parseList(lines, start) {
  const entries = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(RE_LIST);
    if (m && !RE_HR.test(line)) {
      const marker = m[2];
      const ordered = /\d/.test(marker);
      entries.push({ indent: m[1].length, ordered, start: ordered ? parseInt(marker, 10) : 1, lines: [m[3]] });
      i += 1;
      continue;
    }
    if (!line.trim()) {
      // A blank line ends the list unless an item / indented text follows.
      let k = i + 1;
      while (k < lines.length && !lines[k].trim()) k += 1;
      if (k < lines.length && (RE_LIST.test(lines[k]) || /^\s{2,}\S/.test(lines[k]))) { i = k; continue; }
      break;
    }
    // Continuation text: indented, or a lazy line right after an item.
    if (entries.length && (/^\s{2,}\S/.test(line) || !startsBlock(line, lines[i + 1]))) {
      entries[entries.length - 1].lines.push(line.trim());
      i += 1;
      continue;
    }
    break;
  }

  const roots = [];
  const stack = [{ indent: -1, list: null, item: null }];
  entries.forEach(e => {
    let text = e.lines.join('\n');
    let checked = null;
    const task = text.match(/^\[( |x|X)\]\s+/);
    if (task) { checked = task[1] !== ' '; text = text.slice(task[0].length); }
    const item = { text, checked, children: [] };
    while (stack.length > 1 && stack[stack.length - 1].indent > e.indent) stack.pop();
    const top = stack[stack.length - 1];
    if (top.list && top.indent === e.indent && top.list.ordered === e.ordered) {
      top.list.items.push(item);
      top.item = item;
      return;
    }
    const list = { type: 'list', ordered: e.ordered, start: e.start, items: [item] };
    if (top.list && top.indent === e.indent) {
      // Same level, different list type — sibling list.
      const parent = stack[stack.length - 2];
      if (parent.item) parent.item.children.push(list); else roots.push(list);
      stack[stack.length - 1] = { indent: e.indent, list, item };
      return;
    }
    if (top.item) top.item.children.push(list); else roots.push(list);
    stack.push({ indent: e.indent, list, item });
  });
  return { node: roots, next: i };
}

/* ══════════════════════ Inline parser ══════════════════════ */

const ESCAPABLE = '\\`*_{}[]()#+-.!|~$<>';

function findClosing(s, delim, from) {
  let k = from;
  while (k < s.length) {
    const idx = s.indexOf(delim, k);
    if (idx === -1) return -1;
    if (s[idx - 1] === '\\') { k = idx + 1; continue; }
    // single * / _ must not match half of a ** / __ pair
    if (delim.length === 1 && s[idx + 1] === delim) { k = idx + 2; continue; }
    if (/\s/.test(s[idx - 1] || '')) { k = idx + 1; continue; }
    if (delim[0] === '_' && /[A-Za-z0-9]/.test(s[idx + delim.length] || '')) { k = idx + 1; continue; }
    return idx;
  }
  return -1;
}

function findBracketEnd(s, from, open, close) {
  let depth = 0;
  for (let k = from; k < s.length; k += 1) {
    if (s[k] === '\\') { k += 1; continue; }
    if (s[k] === open) depth += 1;
    else if (s[k] === close) { depth -= 1; if (depth === 0) return k; }
  }
  return -1;
}

export function parseInline(s) {
  const out = [];
  let buf = '';
  const flush = () => { if (buf) { out.push({ t: 'text', v: buf }); buf = ''; } };
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    const prev = s[i - 1] || '';

    if (ch === '\\' && i + 1 < s.length) {
      const nx = s[i + 1];
      if (nx === '(' || nx === '[') {
        const close = nx === '(' ? '\\)' : '\\]';
        const end = s.indexOf(close, i + 2);
        if (end !== -1) {
          flush();
          out.push({ t: 'math', v: s.slice(i + 2, end), display: nx === '[' });
          i = end + 2;
          continue;
        }
      }
      if (ESCAPABLE.includes(nx)) { buf += nx; i += 2; continue; }
    }

    if (ch === '`') {
      let n = 1;
      while (s[i + n] === '`') n += 1;
      const tick = '`'.repeat(n);
      let end = s.indexOf(tick, i + n);
      while (end !== -1 && s[end + n] === '`') end = s.indexOf(tick, end + n + 1);
      if (end !== -1) {
        flush();
        let code = s.slice(i + n, end).replace(/\n/g, ' ');
        if (code.length > 2 && code.startsWith(' ') && code.endsWith(' ')) code = code.slice(1, -1);
        out.push({ t: 'code', v: code });
        i = end + n;
        continue;
      }
      buf += tick; i += n; continue;
    }

    if (ch === '$') {
      if (s[i + 1] === '$') {
        const end = s.indexOf('$$', i + 2);
        if (end !== -1 && end > i + 2) {
          flush();
          out.push({ t: 'math', v: s.slice(i + 2, end), display: true });
          i = end + 2;
          continue;
        }
      } else if (s[i + 1] && !/\s/.test(s[i + 1])) {
        let end = s.indexOf('$', i + 1);
        while (end !== -1 && (s[end - 1] === '\\' || /\s/.test(s[end - 1]) || /\d/.test(s[end + 1] || ''))) {
          end = s.indexOf('$', end + 1);
        }
        if (end !== -1 && !s.slice(i + 1, end).includes('\n\n')) {
          flush();
          out.push({ t: 'math', v: s.slice(i + 1, end), display: false });
          i = end + 1;
          continue;
        }
      }
    }

    if (ch === '*' || ch === '_') {
      let n = 1;
      while (s[i + n] === ch && n < 3) n += 1;
      const intraword = ch === '_' && /[A-Za-z0-9]/.test(prev);
      const nextCh = s[i + n] || '';
      if (!intraword && nextCh && !/\s/.test(nextCh)) {
        if (n >= 2) {
          const d = ch.repeat(n >= 3 ? 3 : 2);
          const end = findClosing(s, d, i + d.length);
          if (end !== -1) {
            flush();
            const inner = parseInline(s.slice(i + d.length, end));
            out.push(d.length === 3 ? { t: 'strong', c: [{ t: 'em', c: inner }] } : { t: 'strong', c: inner });
            i = end + d.length;
            continue;
          }
          if (n === 3) {
            const end2 = findClosing(s, ch.repeat(2), i + 2);
            if (end2 !== -1) {
              flush();
              out.push({ t: 'strong', c: parseInline(s.slice(i + 2, end2)) });
              i = end2 + 2;
              continue;
            }
          }
        } else {
          const end = findClosing(s, ch, i + 1);
          if (end !== -1) {
            flush();
            out.push({ t: 'em', c: parseInline(s.slice(i + 1, end)) });
            i = end + 1;
            continue;
          }
        }
      }
      buf += ch.repeat(n); i += n; continue;
    }

    if (ch === '~' && s[i + 1] === '~') {
      const end = s.indexOf('~~', i + 2);
      if (end > i + 2) {
        flush();
        out.push({ t: 'del', c: parseInline(s.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    if (ch === '[') {
      const end = findBracketEnd(s, i, '[', ']');
      if (end !== -1) {
        const label = s.slice(i + 1, end);
        if (s[end + 1] === '(') {
          const pEnd = findBracketEnd(s, end + 1, '(', ')');
          if (pEnd !== -1) {
            const target = s.slice(end + 2, pEnd).trim().split(/\s+"/)[0].replace(/^<|>$/g, '');
            flush();
            const href = safeHref(target);
            out.push(href ? { t: 'link', href, c: parseInline(label) } : { t: 'text', v: label });
            i = pEnd + 1;
            continue;
          }
        } else if (label.trim() && label.length <= 80 && !label.includes('\n')) {
          // [insert enrollment number] — unfilled template placeholder
          flush();
          out.push({ t: 'placeholder', v: `[${label}]` });
          i = end + 1;
          continue;
        }
      }
    }

    if (ch === '<') {
      const br = s.slice(i).match(/^<br\s*\/?>/i);
      if (br) { flush(); out.push({ t: 'br' }); i += br[0].length; continue; }
      const auto = s.slice(i).match(/^<(https?:\/\/[^\s>]+)>/i);
      if (auto) {
        flush();
        out.push({ t: 'link', href: safeHref(auto[1]), c: [{ t: 'text', v: auto[1] }] });
        i += auto[0].length;
        continue;
      }
    }

    if ((ch === 'h' || ch === 'H') && !/[A-Za-z0-9]/.test(prev)) {
      const m = s.slice(i).match(/^https?:\/\/[^\s<>"']+/i);
      if (m) {
        const url = m[0].replace(/[.,;:!?)\]]+$/, '');
        flush();
        out.push({ t: 'link', href: safeHref(url), c: [{ t: 'text', v: url }] });
        i += url.length;
        continue;
      }
    }

    if (ch === '\n') { flush(); out.push({ t: 'br' }); i += 1; continue; }

    buf += ch;
    i += 1;
  }
  flush();
  return out;
}

export function safeHref(raw) {
  // eslint-disable-next-line no-control-regex
  const url = String(raw || '').replace(/[\u0000-\u001F\u007F\s]+/g, '');
  if (!url) return null;
  if (/^(https?:|mailto:|tel:)/i.test(url)) return url;
  if (/^(\/|#|\.\/|\.\.\/)/.test(url)) return url;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) return url; // relative, no scheme
  return null; // javascript:, data:, vbscript:, …
}

/* ══════════════════════ Renderers ══════════════════════ */

function renderInline(nodes, key) {
  return nodes.map((n, i) => {
    const k = `${key}-${i}`;
    switch (n.t) {
      case 'text': return <React.Fragment key={k}>{n.v}</React.Fragment>;
      case 'br': return <br key={k} />;
      case 'code': return <code key={k} className="msai-md-icode">{n.v}</code>;
      case 'strong': return <strong key={k}>{renderInline(n.c, k)}</strong>;
      case 'em': return <em key={k}>{renderInline(n.c, k)}</em>;
      case 'del': return <del key={k}>{renderInline(n.c, k)}</del>;
      case 'math': return <MathTex key={k} tex={n.v} display={n.display} />;
      case 'placeholder': return <span key={k} className="msai-placeholder">{n.v}</span>;
      case 'link': {
        if (!n.href) return <React.Fragment key={k}>{renderInline(n.c, k)}</React.Fragment>;
        const external = /^https?:/i.test(n.href);
        return (
          <a key={k} href={n.href} {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}>
            {renderInline(n.c, k)}
          </a>
        );
      }
      default: return null;
    }
  });
}

function renderBlocks(blocks, key) {
  return blocks.map((b, i) => {
    const k = `${key}-${i}`;
    switch (b.type) {
      case 'heading': {
        const Tag = `h${Math.min(6, b.level)}`;
        return <Tag key={k} className={`msai-md-h msai-md-h${b.level}`}>{renderInline(parseInline(b.text), k)}</Tag>;
      }
      case 'paragraph': return <p key={k} className="msai-md-p">{renderInline(parseInline(b.text), k)}</p>;
      case 'hr': return <hr key={k} className="msai-md-hr" />;
      case 'quote': return <blockquote key={k} className="msai-md-quote">{renderBlocks(b.children, k)}</blockquote>;
      case 'code': return <CodeBlock key={k} code={b.code} lang={b.lang} closed={b.closed} />;
      case 'math': return b.closed
        ? <div key={k} className="msai-md-math"><MathTex tex={b.tex} display /></div>
        : <pre key={k} className="msai-md-math-pending">{b.tex}</pre>;
      case 'list': return renderList(b, k);
      case 'table': return (
        <div key={k} className="msai-md-table-wrap">
          <table className="msai-md-table">
            <thead>
              <tr>{b.header.map((c, ci) => <th key={ci} style={b.aligns[ci] ? { textAlign: b.aligns[ci] } : undefined}>{renderInline(parseInline(c), `${k}-h${ci}`)}</th>)}</tr>
            </thead>
            <tbody>
              {b.rows.map((r, ri) => (
                <tr key={ri}>{r.map((c, ci) => <td key={ci} style={b.aligns[ci] ? { textAlign: b.aligns[ci] } : undefined}>{renderInline(parseInline(c), `${k}-${ri}-${ci}`)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      default: return null;
    }
  });
}

function renderList(list, k) {
  const Tag = list.ordered ? 'ol' : 'ul';
  const hasTasks = list.items.some(it => it.checked !== null);
  return (
    <Tag key={k} className={`msai-md-list${hasTasks ? ' msai-md-list--tasks' : ''}`} start={list.ordered && list.start !== 1 ? list.start : undefined}>
      {list.items.map((it, i) => (
        <li key={i}>
          {it.checked !== null && (
            <span className={`msai-md-task${it.checked ? ' is-done' : ''}`} aria-label={it.checked ? 'Done' : 'Not done'}>
              <i className={`fa-${it.checked ? 'solid fa-square-check' : 'regular fa-square'}`} aria-hidden="true" />
            </span>
          )}
          {renderInline(parseInline(it.text), `${k}-${i}`)}
          {it.children.map((c, ci) => renderList(c, `${k}-${i}-c${ci}`))}
        </li>
      ))}
    </Tag>
  );
}

function MathTex({ tex, display }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, { displayMode: !!display, throwOnError: false, strict: 'ignore', trust: false, output: 'html' });
    } catch {
      return null;
    }
  }, [tex, display]);
  if (html == null) return <code className="msai-md-icode">{tex}</code>;
  // KaTeX output with trust:false — escaped by KaTeX itself.
  return <span className={display ? 'msai-md-math-display' : 'msai-md-math-inline'} dangerouslySetInnerHTML={{ __html: html }} />;
}

/* ─── Fenced code block with syntax highlighting + copy ─── */
function CodeBlock({ code, lang, closed }) {
  const [copied, setCopied] = useState(false);
  const tokens = useMemo(() => highlight(code, lang), [code, lang]);
  const copy = async () => {
    const ok = await copyText(code);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1600); }
  };
  return (
    <div className="msai-md-code">
      <div className="msai-md-code-head">
        <span>{lang || 'code'}</span>
        <button type="button" onClick={copy} disabled={!closed} aria-label="Copy code">
          <i className={`fa-${copied ? 'solid fa-check' : 'regular fa-copy'}`} aria-hidden="true" /> {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre><code>{tokens.map((t, i) => (t.c ? <span key={i} className={`msai-tok-${t.c}`}>{t.v}</span> : t.v))}</code></pre>
    </div>
  );
}

export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

/* ─── Tiny regex highlighter (no dependency) ─── */
const KW = {
  js: 'const let var function return if else for while do switch case break continue new class extends import export from default async await try catch finally throw typeof instanceof in of this super null undefined true false yield delete void static get set interface type enum implements readonly as',
  py: 'def return if elif else for while in not and or is import from as class try except finally raise with lambda pass break continue global nonlocal yield async await None True False self print',
  java: 'public private protected static final void class interface extends implements new return if else for while do switch case break continue try catch finally throw throws int long double float boolean char byte short String null true false this super import package',
  c: 'int long double float char void short unsigned signed struct union enum typedef const static extern return if else for while do switch case break continue goto sizeof include define auto bool true false nullptr namespace using class public private protected template typename new delete std cout cin endl',
  sql: 'select from where insert into values update set delete create table drop alter add join left right inner outer on group by order having limit offset as and or not null is in like between distinct count sum avg min max primary key foreign references index union all case when then else end',
  sh: 'if then else elif fi for while do done case esac function in echo export local return cd ls cat grep sed awk sudo npm pip git',
  css: '',
};
const LANG_FAMILY = {
  js: 'js', jsx: 'js', javascript: 'js', ts: 'js', tsx: 'js', typescript: 'js', json: 'js', node: 'js',
  py: 'py', python: 'py',
  java: 'java', kotlin: 'java', cs: 'java', csharp: 'java', 'c#': 'java', go: 'c', rust: 'c', swift: 'java', php: 'js',
  c: 'c', cpp: 'c', 'c++': 'c', h: 'c',
  sql: 'sql', mysql: 'sql', postgres: 'sql', postgresql: 'sql',
  sh: 'sh', bash: 'sh', shell: 'sh', zsh: 'sh', console: 'sh',
  html: 'html', xml: 'html', svg: 'html', css: 'css', scss: 'css',
};
const HASH_COMMENT = new Set(['py', 'sh']);

export function highlight(code, lang) {
  const fam = LANG_FAMILY[lang] || (lang ? 'js' : null);
  if (!fam) return [{ v: code }];
  if (fam === 'html') return highlightHtml(code);
  const kw = new Set((KW[fam] || '').split(' ').filter(Boolean));
  const commentRe = fam === 'sql' ? '--[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/' : HASH_COMMENT.has(fam) ? '#[^\\n]*' : '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/';
  const stringRe = fam === 'py' ? '"""[\\s\\S]*?"""|\'\'\'[\\s\\S]*?\'\'\'|"(?:\\\\.|[^"\\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\\n])*\'' : '`(?:\\\\.|[^`\\\\])*`|"(?:\\\\.|[^"\\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\\n])*\'';
  const re = new RegExp(`(${commentRe})|(${stringRe})|(\\b\\d+(?:\\.\\d+)?\\b)|([A-Za-z_$][\\w$]*)`, 'g');
  const out = [];
  let last = 0;
  let m;
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) out.push({ v: code.slice(last, m.index) });
    if (m[1]) out.push({ v: m[1], c: 'comment' });
    else if (m[2]) out.push({ v: m[2], c: 'string' });
    else if (m[3]) out.push({ v: m[3], c: 'number' });
    else if (m[4]) out.push(kw.has(fam === 'sql' ? m[4].toLowerCase() : m[4]) ? { v: m[4], c: 'keyword' } : (code[re.lastIndex] === '(' ? { v: m[4], c: 'fn' } : { v: m[4] }));
    last = re.lastIndex;
  }
  if (last < code.length) out.push({ v: code.slice(last) });
  return out;
}

function highlightHtml(code) {
  const re = /(<!--[\s\S]*?-->)|(<\/?[A-Za-z][\w:-]*)|("[^"]*"|'[^']*')|(\/?>)/g;
  const out = [];
  let last = 0;
  let m;
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) out.push({ v: code.slice(last, m.index) });
    if (m[1]) out.push({ v: m[1], c: 'comment' });
    else if (m[2] || m[4]) out.push({ v: m[0], c: 'keyword' });
    else if (m[3]) out.push({ v: m[3], c: 'string' });
    last = re.lastIndex;
  }
  if (last < code.length) out.push({ v: code.slice(last) });
  return out;
}

/* Plain-text version for Copy / Save when rendering isn't wanted. */
export function markdownToPlain(text) {
  return String(text || '')
    .replace(/```[^\n]*\n?/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '');
}
