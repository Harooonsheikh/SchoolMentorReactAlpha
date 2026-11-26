import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import { renderStandalone, prepareDoc } from './render';
import { downloadPdf, printDocument, safeFileName } from './exportPdf';
import { downloadDocx } from './exportDocx';

/* ═══════════════════════════════════════════════════════════════════
   DocViewer — one viewer for Lesson Plans, Question Bank and Question
   Papers. What you see here is exactly what downloads:
     • Colourful / Inkless
     • Paper: Question paper · With answer sheet · + Answer key
     • Question bank: Teacher copy (answers) · Student worksheet
     • Download PDF (real file) · Download Word (.docx) · Print
   Props:
     doc        canonical document JSON (see LESSON_DOC_JSON_GUIDE.md)
     onClose, toast
     initialTheme 'color' | 'ink'
     initialAnswers  'none' | 'space' | 'inline'
     focus      'pdf' | 'word'  (which download button is highlighted)
     fileName   base file name (no extension)
   ═══════════════════════════════════════════════════════════════════ */
const VARIANTS = {
  paper: [
    { id: 'none', label: 'Question paper', icon: 'fa-file-lines', tip: 'Questions only, as printed for the exam' },
    { id: 'space', label: 'With answer sheet', icon: 'fa-pen-to-square', tip: 'Adds answer space under every question' },
  ],
  question_bank: [
    { id: 'inline', label: 'Teacher copy', icon: 'fa-chalkboard-user', tip: 'Shows the correct answer for every question' },
    { id: 'space', label: 'Student worksheet', icon: 'fa-user-graduate', tip: 'Answers hidden, with space to write' },
  ],
};

export default function DocViewer({ doc, onClose, toast = () => {}, initialTheme = 'color', initialAnswers, initialLines = 'single', focus = 'pdf', fileName, subtitle }) {
  const prepared = useMemo(() => prepareDoc(doc), [doc]);
  const kind = prepared.kind;
  const variants = VARIANTS[kind] || null;
  const [theme, setTheme] = useState(initialTheme === 'ink' || initialTheme === 'bw' ? 'ink' : 'color');
  const [answers, setAnswers] = useState(variants ? (variants.some(v => v.id === initialAnswers) ? initialAnswers : variants[0].id) : 'inline');
  const [answerKey, setAnswerKey] = useState(false);
  const [lines, setLines] = useState(initialLines === 'four' ? 'four' : 'single');
  const isUrdu = prepared.locale === 'ur';
  const [busy, setBusy] = useState('');
  const [zoom, setZoom] = useState(null); // null = fit
  const [fit, setFit] = useState(1);
  const frameRef = useRef(null);
  const bodyRef = useRef(null);

  const opts = useMemo(() => ({ theme, answers, answerKey: kind === 'paper' ? answerKey : false, lines }), [theme, answers, answerKey, kind, lines]);
  const srcDoc = useMemo(() => renderStandalone(prepared, { ...opts, mode: 'screen' }), [prepared, opts]);
  const scale = zoom ?? fit;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose, busy]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return undefined;
    const calc = () => setFit(Math.min(1, Math.max(0.3, (el.clientWidth - 8) / 830)));
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const applyZoom = useCallback(() => {
    const d = frameRef.current?.contentDocument;
    if (d?.documentElement) d.documentElement.style.zoom = String(scale);
  }, [scale]);
  useEffect(() => { applyZoom(); }, [applyZoom, srcDoc]);

  const base = safeFileName(fileName || prepared.title || prepared.paper?.exam || 'Document');
  const suffix = `${theme === 'ink' ? 'Inkless' : 'Colourful'}${answers === 'space' && lines === 'four' && !isUrdu ? '-4Line' : ''}${answers === 'space' && kind === 'paper' ? '-AnswerSheet' : ''}${answers === 'space' && kind === 'question_bank' ? '-Worksheet' : ''}${opts.answerKey ? '-AnswerKey' : ''}`;

  const run = async (what) => {
    if (busy) return;
    setBusy(what);
    try {
      if (what === 'pdf') { const pages = await downloadPdf(prepared, opts, `${base} (${suffix}).pdf`); toast(`PDF downloaded — ${pages} page${pages === 1 ? '' : 's'}`, 'success'); }
      else if (what === 'word') { await downloadDocx(prepared, opts, `${base} (${suffix}).docx`); toast('Word file (.docx) downloaded', 'success'); }
      else await printDocument(prepared, opts);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      toast(`Could not create the ${what === 'word' ? 'Word file' : what === 'pdf' ? 'PDF' : 'print view'}. Please try again.`, 'error');
    } finally { setBusy(''); }
  };

  const kindLabel = kind === 'paper' ? 'Question Paper' : kind === 'question_bank' ? 'Question Bank' : 'Lesson Plan';

  return createPortal(
    <div className="dkv-overlay" role="dialog" aria-modal="true" aria-label={`${kindLabel} preview`} onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <style>{DKV_CSS}</style>
      <div className="dkv">
        <div className="dkv-head">
          <div className="dkv-ico"><i className={`fa-solid ${kind === 'paper' ? 'fa-file-signature' : kind === 'question_bank' ? 'fa-circle-question' : 'fa-book-open'}`} /></div>
          <div className="dkv-ttl">
            <div className="dkv-t1">{kindLabel} preview</div>
            <div className="dkv-t2" title={base}>{subtitle || base}</div>
          </div>
          <Tooltip text="Close preview">
            <button type="button" className="dkv-x" onClick={onClose} disabled={!!busy} aria-label="Close preview"><i className="fa-solid fa-xmark" /></button>
          </Tooltip>
        </div>

        <div className="dkv-bar">
          <div className="dkv-grp">
            <span className="dkv-lbl">Style</span>
            <div className="dkv-seg" role="radiogroup" aria-label="Print style">
              <Tooltip text="Full colour — navy, gold and teal school branding">
                <button type="button" role="radio" aria-checked={theme === 'color'} className={theme === 'color' ? 'on' : ''} onClick={() => setTheme('color')}><i className="fa-solid fa-palette" /> Colourful</button>
              </Tooltip>
              <Tooltip text="Inkless — black outlines on white, saves printer ink">
                <button type="button" role="radio" aria-checked={theme === 'ink'} className={theme === 'ink' ? 'on' : ''} onClick={() => setTheme('ink')}><i className="fa-solid fa-print" /> Inkless</button>
              </Tooltip>
            </div>
          </div>

          {variants && (
            <div className="dkv-grp">
              <span className="dkv-lbl">{kind === 'paper' ? 'Format' : 'Copy'}</span>
              <div className="dkv-seg" role="radiogroup" aria-label="Format">
                {variants.map(v => (
                  <Tooltip key={v.id} text={v.tip}>
                    <button type="button" role="radio" aria-checked={answers === v.id} className={answers === v.id ? 'on' : ''} onClick={() => setAnswers(v.id)}><i className={`fa-solid ${v.icon}`} /> {v.label}</button>
                  </Tooltip>
                ))}
              </div>
              {kind === 'paper' && (
                <Tooltip text="Adds a Teacher Copy page with all correct answers and marks">
                  <label className={`dkv-chk${answerKey ? ' on' : ''}`}>
                    <input type="checkbox" checked={answerKey} onChange={e => setAnswerKey(e.target.checked)} />
                    <i className={`fa-solid ${answerKey ? 'fa-square-check' : 'fa-square'}`} /> Answer key
                  </label>
                </Tooltip>
              )}
            </div>
          )}

          {answers === 'space' && kind !== 'lesson' && (
            <div className="dkv-grp">
              <span className="dkv-lbl">Lines</span>
              {isUrdu ? (
                <Tooltip text="Urdu answers get a single ruled line, written from the right">
                  <span className="dkv-chk on" style={{ cursor: 'default' }}><i className="fa-solid fa-grip-lines" /> Single line (Urdu)</span>
                </Tooltip>
              ) : (
                <div className="dkv-seg" role="radiogroup" aria-label="Answer lines">
                  <Tooltip text="One ruled line per answer row">
                    <button type="button" role="radio" aria-checked={lines === 'single'} className={lines === 'single' ? 'on' : ''} onClick={() => setLines('single')}><i className="fa-solid fa-minus" /> Single</button>
                  </Tooltip>
                  <Tooltip text="Standard 4-line handwriting copy under every question">
                    <button type="button" role="radio" aria-checked={lines === 'four'} className={lines === 'four' ? 'on' : ''} onClick={() => setLines('four')}><i className="fa-solid fa-bars" /> 4-line</button>
                  </Tooltip>
                </div>
              )}
            </div>
          )}

          <div className="dkv-grp dkv-zoom">
            <Tooltip text="Zoom out"><button type="button" onClick={() => setZoom(Math.max(0.3, +(scale - 0.1).toFixed(2)))} aria-label="Zoom out"><i className="fa-solid fa-magnifying-glass-minus" /></button></Tooltip>
            <Tooltip text="Fit to width"><button type="button" className="dkv-pct" onClick={() => setZoom(null)}>{Math.round(scale * 100)}%</button></Tooltip>
            <Tooltip text="Zoom in"><button type="button" onClick={() => setZoom(Math.min(1.6, +(scale + 0.1).toFixed(2)))} aria-label="Zoom in"><i className="fa-solid fa-magnifying-glass-plus" /></button></Tooltip>
          </div>

          <div className="dkv-acts">
            <Tooltip text="Open the print dialog">
              <button type="button" className="dkv-btn" onClick={() => run('print')} disabled={!!busy}>
                {busy === 'print' ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-print" />} <span>Print</span>
              </button>
            </Tooltip>
            <Tooltip text="Download an editable Word document (.docx)">
              <button type="button" className={`dkv-btn word${focus === 'word' ? ' pri' : ''}`} onClick={() => run('word')} disabled={!!busy}>
                {busy === 'word' ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-file-word" />} <span>{busy === 'word' ? 'Preparing…' : 'Word'}</span>
              </button>
            </Tooltip>
            <Tooltip text="Download a PDF file, exactly as shown">
              <button type="button" className={`dkv-btn pdf${focus !== 'word' ? ' pri' : ''}`} onClick={() => run('pdf')} disabled={!!busy}>
                {busy === 'pdf' ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-file-pdf" />} <span>{busy === 'pdf' ? 'Preparing…' : 'PDF'}</span>
              </button>
            </Tooltip>
          </div>
        </div>

        <div className="dkv-body" ref={bodyRef}>
          <iframe ref={frameRef} title={`${kindLabel} document`} srcDoc={srcDoc} onLoad={applyZoom} className="dkv-frame" />
          {busy && busy !== 'print' && (
            <div className="dkv-busy"><div><i className="fa-solid fa-spinner fa-spin" /> Creating your {busy === 'word' ? 'Word file' : 'PDF'}…</div></div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const DKV_CSS = `
.dkv-overlay{position:fixed;inset:0;z-index:10050;background:rgba(15,23,42,.55);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:18px;animation:dkvIn .16s ease-out}
@keyframes dkvIn{from{opacity:0}to{opacity:1}}
.dkv{width:min(1120px,100%);height:min(94vh,1100px);background:var(--bg-card,#fff);border-radius:16px;box-shadow:0 24px 70px rgba(15,23,42,.35);display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--border-light,#E2E8F0)}
.dkv-head{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--border-light,#E2E8F0)}
.dkv-ico{width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#0F1F3D,#1A3A6B);color:#E9C46A;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.dkv-ttl{min-width:0;flex:1}
.dkv-t1{font-size:15px;font-weight:800;color:var(--text-primary,#0F172A)}
.dkv-t2{font-size:12px;color:var(--text-muted,#64748B);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dkv-x{width:34px;height:34px;border-radius:9px;border:1px solid var(--border-light,#E2E8F0);background:transparent;color:var(--text-muted,#64748B);cursor:pointer;font-size:15px}
.dkv-x:hover{background:var(--bg-hover,#F1F5F9);color:var(--text-primary,#0F172A)}
.dkv-bar{display:flex;align-items:center;flex-wrap:wrap;gap:10px 16px;padding:10px 18px;border-bottom:1px solid var(--border-light,#E2E8F0);background:var(--bg-subtle,#F8FAFC)}
.dkv-grp{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dkv-lbl{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted,#64748B)}
.dkv-seg{display:inline-flex;background:var(--bg-card,#fff);border:1px solid var(--border-light,#E2E8F0);border-radius:10px;padding:3px;gap:2px}
.dkv-seg button{border:0;background:transparent;padding:6px 12px;border-radius:7px;font-size:12px;font-weight:600;color:var(--text-secondary,#475569);cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.dkv-seg button:hover{color:var(--text-primary,#0F172A)}
.dkv-seg button.on{background:#0F1F3D;color:#fff;box-shadow:0 2px 6px rgba(15,31,61,.25)}
.dkv-seg button.on .fa-palette{color:#E9C46A}
.dkv-chk{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--text-secondary,#475569);border:1px solid var(--border-light,#E2E8F0);background:var(--bg-card,#fff);border-radius:9px;padding:6px 11px;cursor:pointer;user-select:none}
.dkv-chk input{position:absolute;opacity:0;width:0;height:0}
.dkv-chk.on{border-color:#0E5A52;color:#0E5A52;background:#E6F2F1}
.dkv-chk:focus-within{outline:2px solid #0E5A52;outline-offset:2px}
.dkv-zoom{gap:2px}
.dkv-zoom button{border:1px solid var(--border-light,#E2E8F0);background:var(--bg-card,#fff);color:var(--text-secondary,#475569);height:30px;min-width:30px;border-radius:8px;cursor:pointer;font-size:12px}
.dkv-zoom .dkv-pct{min-width:52px;font-weight:700}
.dkv-acts{display:flex;gap:8px;margin-left:auto}
.dkv-btn{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 15px;border-radius:10px;border:1px solid var(--border-light,#E2E8F0);background:var(--bg-card,#fff);color:var(--text-primary,#0F172A);font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap;transition:transform .12s,box-shadow .12s}
.dkv-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 12px rgba(15,23,42,.1)}
.dkv-btn:disabled{opacity:.6;cursor:progress}
.dkv-btn.word i{color:#2B579A}
.dkv-btn.pdf i{color:#DC2626}
.dkv-btn.pri.pdf{background:#B42323;border-color:#B42323;color:#fff}
.dkv-btn.pri.word{background:#2B579A;border-color:#2B579A;color:#fff}
.dkv-btn.pri i{color:#fff}
.dkv-body{flex:1;min-height:0;position:relative;background:#E8EBF0}
.dkv-frame{width:100%;height:100%;border:0;display:block;background:#E8EBF0}
.dkv-busy{position:absolute;inset:0;background:rgba(232,235,240,.72);display:flex;align-items:center;justify-content:center}
.dkv-busy div{background:#0F1F3D;color:#fff;padding:12px 20px;border-radius:12px;font-weight:700;font-size:13px;box-shadow:0 10px 30px rgba(15,31,61,.35)}
.dkv-busy i{color:#E9C46A;margin-right:6px}
[data-theme="dark"] .dkv-seg button.on{background:#E9C46A;color:#0F1F3D}
@media (max-width:760px){
  .dkv-overlay{padding:0}
  .dkv{height:100%;border-radius:0}
  .dkv-bar{padding:10px 12px;gap:8px}
  .dkv-acts{width:100%;margin-left:0}
  .dkv-acts .dkv-btn{flex:1;justify-content:center}
  .dkv-zoom{display:none}
  .dkv-seg button{padding:6px 9px}
}
`;
