import React, { useRef, useState } from 'react';
import { ExportMenu, SecondaryActions } from './MentorAIResponseParts';
import { printReport, exportWord, exportExcel } from './mentorAiExport';

/* ─── Chhota markdown renderer (koi package nahi) ───
   Support: **bold**, *italic*, `code`, # headings, - / 1. lists,
   | tables |, --- line, paragraphs. React elements banata hai
   (dangerouslySetInnerHTML nahi), is liye HTML injection ka khatra nahi. */

function renderInline(text, keyPrefix) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m;
  let n = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyPrefix}-${n++}`;
    if (tok.startsWith('**') || tok.startsWith('__')) out.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('`')) out.push(<code key={k}>{tok.slice(1, -1)}</code>);
    else out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const RE_HEADING = /^(#{1,6})\s+(.*)$/;
const RE_UL = /^\s*[-*+]\s+(.*)$/;
const RE_OL = /^\s*\d+[.)]\s+(.*)$/;
const RE_HR = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const RE_TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

const splitRow = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

function renderMarkdown(src) {
  const lines = String(src || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  let key = 0;

  const startsBlock = (idx) => {
    const l = lines[idx];
    return RE_HEADING.test(l) || RE_UL.test(l) || RE_OL.test(l) || RE_HR.test(l)
      || (l.includes('|') && RE_TABLE_SEP.test(lines[idx + 1] || ''));
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }

    if (RE_HR.test(line)) { blocks.push(<hr key={key++} />); i += 1; continue; }

    const h = line.match(RE_HEADING);
    if (h) {
      const Tag = `h${Math.min(h[1].length + 2, 6)}`;
      blocks.push(<Tag key={key++}>{renderInline(h[2], `h${key}`)}</Tag>);
      i += 1;
      continue;
    }

    /* Table */
    if (line.includes('|') && RE_TABLE_SEP.test(lines[i + 1] || '')) {
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      const k = key++;
      blocks.push(
        <div className="mai-table-wrap" key={k}>
          <table className="mai-table">
            <thead><tr>{head.map((c, j) => <th key={j}>{renderInline(c, `th${k}-${j}`)}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>{r.map((c, j) => <td key={j}>{renderInline(c, `td${k}-${ri}-${j}`)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    /* Lists */
    if (RE_UL.test(line) || RE_OL.test(line)) {
      const ordered = RE_OL.test(line);
      const re = ordered ? RE_OL : RE_UL;
      const items = [];
      while (i < lines.length && re.test(lines[i])) {
        items.push(lines[i].match(re)[1]);
        i += 1;
      }
      const k = key++;
      const Tag = ordered ? 'ol' : 'ul';
      blocks.push(<Tag key={k}>{items.map((it, j) => <li key={j}>{renderInline(it, `li${k}-${j}`)}</li>)}</Tag>);
      continue;
    }

    /* Paragraph — blank line ya agle block tak */
    const para = [];
    while (i < lines.length && lines[i].trim() && (para.length === 0 || !startsBlock(i))) {
      para.push(lines[i]);
      i += 1;
    }
    const k = key++;
    blocks.push(
      <p key={k}>
        {para.map((l, j) => (
          <React.Fragment key={j}>
            {j > 0 && <br />}
            {renderInline(l, `p${k}-${j}`)}
          </React.Fragment>
        ))}
      </p>,
    );
  }
  return blocks;
}

export default function MentorAIAgentResponse({ response, schoolName, onFollowUp }) {
  const [copied, setCopied] = useState(false);
  const mdRef = useRef(null);

  if (!response) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(response.text || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard denied — non-critical */ }
  };

const handleExport = async (format) => {
  const ctx = {
    schoolName,
    query: response.query,          
    bodyHtml: mdRef.current?.innerHTML || '',
    container: mdRef.current,
  };
  try {
    if (format === 'pdf') await printReport(ctx);
    else if (format === 'word') await exportWord(ctx);
    else if (format === 'excel') await exportExcel(ctx);
  } catch (e) {
    console.error('Mentor AI export failed', e);
  }
};

  return (
    <div className="mai-response">
      <div className="mai-print-head">
        <div className="mai-print-school">{schoolName || 'School Mentor ERP'}</div>
        <div className="mai-print-meta">
          <span>Mentor AI Report</span>
          {response.query && <span>Query: “{response.query}”</span>}
          <span>Generated: {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      <div className="mai-response-head">
        <div className="mai-response-title">Mentor AI</div>
        <ExportMenu onExport={handleExport} />
      </div>

      <div className="mai-markdown" ref={mdRef}>
        {renderMarkdown(response.text)}
      </div>

      <SecondaryActions onCopy={handleCopy} onFollowUp={onFollowUp} copied={copied} />
    </div>
  );
}
