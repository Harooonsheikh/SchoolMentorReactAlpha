import React, { useCallback, useEffect, useState } from 'react';
import { useMentorAIActions } from './mentorAIPermissions';
import { GeneratingProgress, EditViaAIPanel, VersionBadge, VoiceDictationButton, SaveToLibraryButton, downloadFile } from './MentorAIShared';
import { STAGE_SETS, useJobProgress } from './services/aiProgress';
import { GENERATING_FACTS } from './mentorAiStudioData';
import { getHrGrades, getHrSubjects } from '../../services/hrService';
import * as qpService from './services/mentorAIQuestionPaperService';
import { WorksheetPages } from './Worksheets';
import { InlineMarkdown } from './MarkdownMessage';
import { fetchReportHeader } from '../../../utils/pdfReports';

/* ═══════════════════════════════════════════════════════════════════
   MENTOR AI — QUESTION PAPERS
   Postman collection ke "QuestionPaper" folder ki UI: generate (objective /
   subjective / mixed), progress, preview, Edit via AI, Save to Library,
   Delete aur "My Papers" list. Look & feel Worksheets tab jaisa — wahi
   msai-* classes; sirf list rows ke liye chhoti local CSS neeche hai.
   ═══════════════════════════════════════════════════════════════════ */

const QP_TYPES = [
  { id: 'objective',  name: 'Objective',  description: 'MCQs and short-answer style objective questions.' },
  { id: 'subjective', name: 'Subjective', description: 'Short and long written-answer questions.' },
  { id: 'mixed',      name: 'Mixed',      description: 'Objective section plus subjective section.' },
];
const QP_DIFFICULTIES = [
  { id: 'easy', name: 'Easy' },
  { id: 'balanced', name: 'Balanced' },
  { id: 'challenging', name: 'Challenging' },
];
const QP_LANGUAGES = ['English', 'Urdu'];
const QP_QUICK_EDITS = ['Make it easier', 'Make it harder', 'Add more questions', 'Reduce length', 'Fix grammar', 'Change language'];

const INITIAL_FORM = {
  title: '', paperType: 'mixed', difficulty: 'balanced', language: 'English', board: '', region: '',
  objDuration: 20, objMarks: 20, objCount: 20, objInstructions: '',
  subjDuration: 40, subjMarks: 30, subjCount: 10, subjInstructions: '',
  includeAnswerKey: false, includeAnswerSheet: false, includeBranding: true,
};

/* Server ka asli error dikhao. DRF validation errors { field: ["msg"] } ki shakl me
   aate hain — pehle sirf axios ka "Request failed with status code 400" dikhta tha. */
const errMessage = (error) => {
  const d = error?.response?.data;
  if (error?.response) console.error('Question paper API error', error.response.status, d);
  if (error?.response?.status === 500) {
    return 'The Mentor AI server crashed while creating this paper (500). Your request was accepted but the server failed — please report it to the backend team (request details are in the browser console).';
  }
  if (typeof d === 'string') return d.length > 300 ? `Server error (${error.response.status})` : d;
  if (d && typeof d === 'object') {
    const direct = d.error || d.message || d.detail;
    if (direct) return typeof direct === 'string' ? direct : JSON.stringify(direct);
    const fields = Object.entries(d)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : (typeof v === 'string' ? v : JSON.stringify(v))}`);
    if (fields.length) return fields.join(' | ');
  }
  return error?.message || 'Something went wrong.';
};

const QP_CSS = `
.msai-qp-list { display:flex; flex-direction:column; gap:10px; }
.msai-qp-row { display:flex; align-items:center; gap:14px; padding:14px 16px; border:1.5px solid var(--border-light); border-radius:var(--radius-md); background:var(--bg-card); cursor:pointer; transition:var(--tr); text-align:left; width:100%; }
.msai-qp-row:hover { border-color:var(--brand-primary); box-shadow:var(--shadow-sm); }
.msai-qp-row-ic { width:40px; height:40px; border-radius:var(--radius-md); display:flex; align-items:center; justify-content:center; background:var(--brand-light); color:var(--brand-primary); flex-shrink:0; }
.msai-qp-row-txt { flex:1; min-width:0; }
.msai-qp-row-title { font:800 13.5px/1.3 var(--font-body); color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.msai-qp-row-meta { font:600 11.5px/1.4 var(--font-body); color:var(--text-muted); margin-top:2px; }
.msai-qp-row-del { border:none; background:none; color:var(--text-muted); cursor:pointer; padding:8px; border-radius:var(--radius-sm); }
.msai-qp-row-del:hover { color:#DC2626; background:rgba(220,38,38,.08); }
.msai-qp-section { border:1.5px solid var(--border-light); border-radius:var(--radius-lg); padding:16px; display:flex; flex-direction:column; gap:12px; background:var(--bg-muted); }
.msai-qp-section-h { font:800 13px/1.3 var(--font-body); color:var(--text-primary); display:flex; align-items:center; gap:8px; }
.msai-qp-switch { display:inline-flex; gap:6px; }
.msai-qpp { display:flex; flex-direction:column; gap:18px; }
.msai-qpp-page { background:#fff; color:#111; border:1px solid var(--border-light); border-top:5px solid var(--brand-primary); border-radius:var(--radius-md); box-shadow:var(--shadow-sm); padding:28px 32px; font-family:'Segoe UI',Arial,Helvetica,sans-serif; -webkit-font-smoothing:antialiased; }
.msai-qpp-head { display:flex; align-items:center; gap:16px; border-bottom:2.5px solid #111; padding-bottom:12px; margin-bottom:14px; }
.msai-qpp-htxt { flex:1; min-width:0; text-align:center; }
.msai-qpp-school { font:700 13px/1.25 'Segoe UI',Arial,Helvetica,sans-serif; letter-spacing:.08em; text-transform:uppercase; color:var(--brand-primary); margin-bottom:3px; }
.msai-qpp-logo { width:68px; height:68px; flex-shrink:0; border-radius:50%; object-fit:cover; background:#fff; border:2px solid var(--brand-primary); padding:2px; box-sizing:border-box; }
.msai-qpp-title { font-size:21px; font-weight:800; line-height:1.25; color:#000; }
.msai-qpp-sub { font-size:13px; color:#444; margin-top:2px; }
.msai-qpp-meta { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:6px 16px; border:1.5px solid #111; border-radius:6px; padding:9px 14px; margin-bottom:12px; font-size:13px; }
.msai-qpp-student { display:flex; flex-wrap:wrap; gap:8px 24px; margin-bottom:16px; font-size:13px; font-weight:600; }
.msai-qpp-student span { flex:1; min-width:150px; border-bottom:1px solid #777; padding-bottom:2px; color:#444; }
.msai-qpp-sec-h { background:var(--brand-light); border-left:4px solid var(--brand-primary); padding:6px 12px; font-weight:800; font-size:14.5px; margin:16px 0 8px; border-radius:0 4px 4px 0; }
.msai-qpp-qs { margin:0; padding-left:22px; display:flex; flex-direction:column; gap:8px; font-size:13.5px; line-height:1.55; }
.msai-qpp-foot { display:flex; justify-content:space-between; margin-top:16px; padding-top:6px; border-top:1px solid #ccc; font:600 11px/1 var(--font-body); color:#777; }
.msai-qpp-sec-h { margin-bottom:4px !important; }
.msai-qpp-inst { font-style:italic; color:#444; font-size:12.5px; margin:0 0 8px 14px; }
.msai-qpp-q { display:flex; gap:10px; margin:10px 0; }
.msai-qpp-qno { width:26px; font-weight:800; flex-shrink:0; font-size:14px; }
.msai-qpp-qbody { flex:1; min-width:0; }
.msai-qpp-qtext { font-size:14px; line-height:1.6; color:#111; }
.msai-qpp-marks { font-weight:800; font-size:13px; white-space:nowrap; }
.msai-qpp-opts { display:grid; grid-template-columns:1fr 1fr; gap:5px 20px; margin-top:6px; font-size:13.5px; }
.msai-qpp-wb { margin-top:4px; font-size:12px; color:#444; background:#f6f6f6; border:1px dashed #bbb; padding:3px 8px; border-radius:4px; }
.msai-qpp-line { border-bottom:1px solid #888; height:24px; }
@media (max-width:560px) { .msai-qpp-opts { grid-template-columns:1fr; } .msai-qpp-page { padding:18px; } }
.msai-qpp-end { text-align:center; font-weight:700; font-size:12px; letter-spacing:.2em; margin-top:10px; }
`;

/* ─── Exam-style design (preview + print) ─── */
const plain = (t) => String(t ?? '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
const escH = (s) => String(s ?? '').replace(/[<>&"']/g, (m) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[m]));
const optLabel = (o) => (typeof o === 'string' ? o : (o?.text || o?.label || o?.value || ''));

/* Sawal ke text me inline "(A) .. (B) .." / "A) .. B) .." ho to stem + options alag karo. */
function splitInlineOptions(text) {
  for (const re of [/\(\s*([A-Da-d])\s*\)\s*/g, /(?:^|\s)([A-Da-d])[).]\s+/g]) {
    const marks = [...text.matchAll(re)];
    if (marks.length >= 2 && marks[0][1].toUpperCase() === 'A' && marks.every((m, i) => m[1].toUpperCase() === String.fromCharCode(65 + i))) {
      const options = marks.map((m, i) => text.slice(m.index + m[0].length, i + 1 < marks.length ? marks[i + 1].index : undefined).trim());
      return { stem: text.slice(0, marks[0].index).trim(), options };
    }
  }
  return { stem: text, options: [] };
}

/* Server ka paper (pageContent + optional structured sections) → saaf display model. */
function buildPaperModel(paper) {
  const structured = new Map();
  (Array.isArray(paper?.sections) ? paper.sections : []).forEach((sec) => (sec?.questions || []).forEach((q) => structured.set(String(q?.number ?? q?.no), q)));
  return (Array.isArray(paper?.pageContent) ? paper.pageContent : []).map((page, pi) => ({
    pageNo: page?.pageNo || pi + 1,
    sections: (page?.sections || []).map((sec) => {
      const heading = plain(sec?.heading || '');
      let instruction = '';
      const hm = heading.match(/^(.*?)\s*\(([^()]{12,})\)\s*$/);
      const title = hm ? hm[1] : heading;
      if (hm) instruction = hm[2];
      const questions = (sec?.questions || []).map((q) => {
        const st = structured.get(String(q?.no));
        let text = String(q?.text || '');
        let marks = q?.marks ?? st?.marks ?? null;
        const mm = text.match(/\s*[\[(]\s*(\d+)\s*(?:marks?)?\s*[\])]\s*$/i);
        if (mm && marks == null) { marks = mm[1]; text = text.slice(0, mm.index); }
        let wordBank = Array.isArray(st?.word_bank) && st.word_bank.length ? st.word_bank.map(optLabel).join(', ') : '';
        const wb = text.match(/\s*\[Word bank:\s*([^\]]*)\]/i);
        if (wb) { wordBank = wordBank || wb[1].trim(); text = text.replace(wb[0], ''); }
        let options = Array.isArray(q?.options) && q.options.length ? q.options.map(optLabel) : (Array.isArray(st?.options) && st.options.length ? st.options.map(optLabel) : []);
        if (!options.length) { const sp = splitInlineOptions(text); text = sp.stem || text; options = sp.options; }
        const long = /long|essay|detail|descriptive/i.test(title);
        const written = !options.length && !wordBank && /short|long|subjective|essay|descriptive|answer|explain|write/i.test(title);
        const lines = Number(st?.answer_lines) || (written ? (long ? 5 : 2) : 0);
        return { no: q?.no, text: text.trim(), marks, options, wordBank, lines };
      });
      return { title, instruction, questions };
    }),
  }));
}

export function QuestionPaperPages({ paper, meta, brand }) {
  const pages = buildPaperModel(paper);
  const title = paper?.title || 'Question Paper';
  const school = brand?.name || '';
  return (
    <div className="msai-qpp">
      {pages.map((page, i) => (
        <div key={page.pageNo} className="msai-qpp-page">
          {i === 0 && (
            <>
              <div className="msai-qpp-head">
                {brand?.logo && <img className="msai-qpp-logo" src={brand.logo} alt="School logo" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                <div className="msai-qpp-htxt">
                  {school && <div className="msai-qpp-school">{school}</div>}
                  <div className="msai-qpp-title">{title}</div>
                  {paper?.subtitle && <div className="msai-qpp-sub">{paper.subtitle}</div>}
                </div>
              </div>
              <div className="msai-qpp-meta">
                {meta.map(([k, v]) => (v ? <div key={k}><b>{k}:</b> {v}</div> : null))}
              </div>
              <div className="msai-qpp-student"><span>Name:</span><span>Roll No:</span><span>Date:</span></div>
            </>
          )}
          {page.sections.map((sec, si) => (
            <div key={si} className="msai-qpp-sec">
              {sec.title && <div className="msai-qpp-sec-h">{sec.title}</div>}
              {sec.instruction && <div className="msai-qpp-inst">{sec.instruction}</div>}
              {sec.questions.map((q, qi) => (
                <div key={q.no ?? qi} className="msai-qpp-q">
                  <div className="msai-qpp-qno">{q.no ?? qi + 1}.</div>
                  <div className="msai-qpp-qbody">
                    <div className="msai-qpp-qtext"><InlineMarkdown text={q.text} /></div>
                    {q.wordBank && <div className="msai-qpp-wb"><b>Word bank:</b> {q.wordBank}</div>}
                    {q.options.length > 0 && (
                      <div className="msai-qpp-opts">
                        {q.options.map((o, oi) => <div key={oi}><b>({String.fromCharCode(65 + oi)})</b> {o}</div>)}
                      </div>
                    )}
                    {Array.from({ length: Math.min(q.lines, 8) }).map((_, li) => <div key={li} className="msai-qpp-line" />)}
                  </div>
                  {q.marks != null && <div className="msai-qpp-marks">[{q.marks}]</div>}
                </div>
              ))}
            </div>
          ))}
          {i === pages.length - 1 && <div className="msai-qpp-end">— END OF PAPER —</div>}
          <div className="msai-qpp-foot"><span>{title}</span><span>Page {page.pageNo} of {pages.length}</span></div>
        </div>
      ))}
    </div>
  );
}

/* Library item (server se aaya ho ya local save) → header ki meta rows. Marks sawalon ka jod. */
export function libraryPaperMeta(c = {}) {
  const m = c.meta || {};
  let marks = Number(c.totalMarks) || 0;
  if (!marks) {
    (c.paper?.pageContent || []).forEach((pg) => (pg?.sections || []).forEach((s) => (s?.questions || []).forEach((q) => { marks += Number(q?.marks) || 0; })));
  }
  return [
    ['Class', m.cls], ['Subject', m.subject], ['Time', c.timeLabel || ''],
    ['Max Marks', marks || ''], ['Type', String(m.paperType || '').replace(/^./, (ch) => ch.toUpperCase())],
  ];
}

export function openQuestionPaperPrintWindow(paper, meta, brand) {
  const pages = buildPaperModel(paper);
  if (!pages.length) return false;
  const title = escH(paper?.title || 'Question Paper');
  const school = escH(brand?.name || '');
  const logo = brand?.logo ? `<img class="logo" src="${escH(brand.logo)}" alt="">` : '';
  const body = pages.map((page, i) => `
    <section class="pg">
      ${i === 0 ? `<div class="head">${logo}<div class="htxt">${school ? `<div class="sch">${school}</div>` : ''}<h1>${title}</h1></div></div>
        <div class="meta">${meta.filter(([, v]) => v).map(([k, v]) => `<div><b>${escH(k)}:</b> ${escH(v)}</div>`).join('')}</div>
        <div class="stu"><span>Name:</span><span>Roll No:</span><span>Date:</span></div>` : ''}
      ${page.sections.map((sec) => `
        ${sec.title ? `<div class="sh">${escH(sec.title)}</div>` : ''}
        ${sec.instruction ? `<div class="si">${escH(sec.instruction)}</div>` : ''}
        ${sec.questions.map((q, qi) => `<div class="q"><div class="qn">${escH(q.no ?? qi + 1)}.</div><div class="qb">
          <div>${escH(plain(q.text))}</div>
          ${q.wordBank ? `<div class="wb"><b>Word bank:</b> ${escH(q.wordBank)}</div>` : ''}
          ${q.options.length ? `<div class="opts">${q.options.map((o, oi) => `<div><b>(${String.fromCharCode(65 + oi)})</b> ${escH(plain(o))}</div>`).join('')}</div>` : ''}
          ${Array.from({ length: Math.min(q.lines, 8) }).map(() => '<div class="ln"></div>').join('')}
        </div>${q.marks != null ? `<div class="mk">[${escH(q.marks)}]</div>` : ''}</div>`).join('')}`).join('')}
      ${i === pages.length - 1 ? '<div class="end">— END OF PAPER —</div>' : ''}
    </section>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
    @page { size:A4; margin:15mm; }
    body { font-family:'Segoe UI',Arial,Helvetica,sans-serif; color:#111; font-size:13.5px; line-height:1.6; }
    .pg { page-break-after:always; } .pg:last-child { page-break-after:auto; }
    .head { display:flex; align-items:center; gap:16px; border-bottom:2.5px solid #111; padding-bottom:10px; margin-bottom:12px; } .htxt { flex:1; text-align:center; }
    .sch { font:700 13px Arial,sans-serif; letter-spacing:.08em; text-transform:uppercase; color:#4f46e5; }
    .logo { width:68px; height:68px; flex-shrink:0; border-radius:50%; object-fit:cover; border:2px solid #4f46e5; padding:2px; box-sizing:border-box; }
    h1 { font-size:21px; font-weight:800; margin:2px 0; }
    .meta { display:flex; flex-wrap:wrap; gap:4px 28px; border:1.5px solid #111; border-radius:6px; padding:7px 12px; margin-bottom:8px; font-size:12.5px; }
    .stu { display:flex; gap:20px; margin-bottom:12px; font-size:12.5px; } .stu span { flex:1; border-bottom:1px solid #777; }
    .sh { background:#eef2ff; border-left:4px solid #4f46e5; padding:5px 12px; font-weight:800; margin:14px 0 4px; }
    .si { font-style:italic; color:#444; font-size:12px; margin:0 0 6px 14px; }
    .q { display:flex; gap:8px; margin:9px 0; page-break-inside:avoid; } .qn { width:24px; font-weight:800; flex-shrink:0; } .qb { flex:1; } .mk { font-weight:700; white-space:nowrap; }
    .opts { display:grid; grid-template-columns:1fr 1fr; gap:3px 20px; margin-top:4px; } .wb { margin-top:3px; font-size:12px; color:#444; }
    .ln { border-bottom:1px solid #777; height:24px; }
    .end { text-align:center; font-weight:700; letter-spacing:.2em; margin-top:14px; font-size:12px; }
  </style></head><body>${body}<script>window.onload=function(){setTimeout(function(){window.print();},300);};</script></body></html>`;
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.open(); win.document.write(html); win.document.close();
  return true;
}

/* Har sawal ke marks (marks ÷ sawal). Whole number na ho to server (marks barabar baant kar)
   crash / reject kar sakta hai — is liye yahan saaf dikhate hain. */
function PerQuestionHint({ marks, count }) {
  if (!count || !marks) return null;
  const per = marks / count;
  const whole = Number.isInteger(per);
  return (
    <div className="msai-hint-text" style={{ textAlign: 'left', marginTop: -4, color: whole ? undefined : '#B45309' }}>
      {whole ? `= ${per} mark${per === 1 ? '' : 's'} per question` : `= ${per.toFixed(2)} marks per question — use marks that divide evenly by the number of questions`}
    </div>
  );
}

function Field({ label, children }) {
  return <div className="msai-field"><label>{label}</label>{children}</div>;
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="msai-toggle-row">
      <span>{label}</span>
      <span className="msai-toggle-wrap">
        <input type="checkbox" className="msai-toggle-input" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span className="msai-toggle-track"><span className="msai-toggle-knob" /></span>
      </span>
    </label>
  );
}

function Stepper({ value, onChange, min = 1, max = 300, step = 5 }) {
  return (
    <div className="msai-stepper">
      <button type="button" onClick={() => onChange(Math.max(min, value - step))}>−</button>
      <span>{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + step))}>+</button>
    </div>
  );
}

export default function QuestionPapers({ toast, onConsumed }) {
  const { canCreate, canEdit, canDownload, canDelete, deny } = useMentorAIActions('questionpapers', toast);
  const [view, setView] = useState('form');            // form | generating | result | list
  const [f, setF] = useState(INITIAL_FORM);
  const [sel, setSel] = useState({ cls: '', clsId: '', sectionId: '', subject: '', subjectId: '' });
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [paper, setPaper] = useState(null);
  const [branchHeader, setBranchHeader] = useState(null);
  useEffect(() => { let alive = true; fetchReportHeader().then(h => { if (alive) setBranchHeader(h); }); return () => { alive = false; }; }, []);
  const [undoPaper, setUndoPaper] = useState(null);
  const [editing, setEditing] = useState(false);
  const [list, setList] = useState({ loading: false, items: [], error: '' });
  const [fromList, setFromList] = useState(false);     // result opened from "My Papers"
  const job = useJobProgress();
  const set = (patch) => setF(prev => ({ ...prev, ...patch }));

  /* ── classes → subjects (same HR lookups the Worksheets tab uses) ── */
  useEffect(() => {
    let alive = true;
    getHrGrades().then(data => {
      if (!alive) return;
      setClasses(data || []);
      const c = data?.[0];
      if (c) setSel(p => ({ ...p, cls: c.name || '', clsId: c.id || '', sectionId: c.sections?.[0]?.id || '' }));
    }).catch(e => console.error('QP class load error:', e?.response?.data || e?.message));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!sel.clsId || !sel.sectionId) { setSubjects([]); return undefined; }
    let alive = true;
    getHrSubjects(sel.clsId, sel.sectionId).then(res => {
      if (!alive) return;
      const data = Array.isArray(res) ? res : res?.data || res?.results || [];
      setSubjects(data);
      const s = data[0];
      if (s) setSel(p => ({ ...p, subject: s.subject_name || s.name || '', subjectId: s.id || s.subject_id || '' }));
    }).catch(() => { if (alive) setSubjects([]); });
    return () => { alive = false; };
  }, [sel.clsId, sel.sectionId]);

  const pickClass = (id) => {
    const c = classes.find(x => String(x.id) === String(id));
    setSubjects([]);
    setSel({ cls: c?.name || '', clsId: c?.id || '', sectionId: c?.sections?.[0]?.id || '', subject: '', subjectId: '' });
  };

  /* ── generate ── */
  const runGenerate = async () => {
    if (!canCreate) { deny('create'); return; }
    if (!sel.cls) { toast?.('Please select a class.'); return; }
    if (!sel.subject) { toast?.('Please select a subject.'); return; }
    if (!f.title.trim()) { toast?.('Please enter an exam title.'); return; }
    if (job.running) return;

    setView('generating');
    const signal = job.start(STAGE_SETS.worksheet);
    const opts = { signal, onProgress: job.report };
    try {
      const response = await qpService.generateQuestionPaper({
        grade: sel.cls, subject: sel.subject, ...f,
        title: f.title,
        /* Server dono sections ki instructions ZAROORI maangta hai (khali par 400). Khali ho to
           title / count se ek default bana kar bhejte hain. */
        objInstructions: f.objInstructions.trim()
          || `Generate ${f.objCount} objective questions (MCQs) on ${f.title.trim()} for ${sel.cls} ${sel.subject}.`,
        subjInstructions: f.subjInstructions.trim()
          || `Generate ${f.subjCount} subjective questions (short and long answer) on ${f.title.trim()} for ${sel.cls} ${sel.subject}.`,
      }, opts);
      console.log('Question paper generate response:', response);
      const result = await qpService.resolvePaper(response, null, opts);
      job.report({ stage: 'finalizing' });
      job.complete();
      setPaper(result); setUndoPaper(null); setEditing(false); setFromList(false);
      setView('result');
      onConsumed?.();
    } catch (error) {
      const message = errMessage(error);
      if (job.fail(error, message) === 'cancelled') setView('form');
      else toast?.(message);
    }
  };

  /* ── my papers ── */
  const loadList = useCallback(async () => {
    setList(l => ({ ...l, loading: true, error: '' }));
    try {
      const items = await qpService.getQuestionPapers();
      setList({ loading: false, items, error: '' });
    } catch (error) {
      setList({ loading: false, items: [], error: errMessage(error) });
    }
  }, []);
  useEffect(() => { if (view === 'list') loadList(); }, [view, loadList]);

  const openPaper = async (item) => {
    try {
      const full = await qpService.getQuestionPaperById(item.id);
      setPaper({ ...item, ...full }); setUndoPaper(null); setEditing(false); setFromList(true);
      setView('result');
    } catch (error) { toast?.(errMessage(error)); }
  };

  const removePaper = async (item) => {
    if (!canDelete) { deny('delete'); return; }
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete "${item.title || 'this question paper'}"? This cannot be undone.`)) return;
    try {
      await qpService.deleteQuestionPaper(item.id);
      toast?.('Question paper deleted');
      if (view === 'list') loadList(); else { setPaper(null); setView(fromList ? 'list' : 'form'); }
    } catch (error) { toast?.(errMessage(error)); }
  };

  const startOver = () => { job.reset(); setPaper(null); setUndoPaper(null); setEditing(false); setView('form'); };
  const showObjective = f.paperType !== 'subjective';
  const showSubjective = f.paperType !== 'objective';
  const brand = f.includeBranding ? { name: branchHeader?.branchName || '', logo: branchHeader?.branchLogo || '' } : null;
  const totalMarks = (f.paperType !== 'subjective' ? Number(f.objMarks) || 0 : 0) + (f.paperType !== 'objective' ? Number(f.subjMarks) || 0 : 0);
  const totalMins = (f.paperType !== 'subjective' ? Number(f.objDuration) || 0 : 0) + (f.paperType !== 'objective' ? Number(f.subjDuration) || 0 : 0);
  const paperMeta = [
    ['Class', paper?.grade_label || sel.cls],
    ['Subject', paper?.subject_label || sel.subject],
    ['Time', totalMins ? `${totalMins} min` : ''],
    ['Max Marks', totalMarks || ''],
    ['Type', String(paper?.paper_type || f.paperType || '').replace(/^./, (c) => c.toUpperCase())],
  ];
  const paperTitle = paper?.title || [sel.cls, sel.subject, 'Question Paper'].filter(Boolean).join(' · ');

  return (
    <div className="msai-qp">
      <style>{QP_CSS}</style>

      {view !== 'form' && view !== 'generating' && (
        <button type="button" className="msai-back-link" onClick={() => (view === 'result' && fromList ? setView('list') : startOver())}>
          <i className="fa-solid fa-arrow-left" aria-hidden="true" /> {view === 'result' && fromList ? 'Back to My Papers' : 'New Question Paper'}
        </button>
      )}
      {view === 'generating' && (
        <button type="button" className="msai-back-link" onClick={() => { job.cancel(); setView('form'); }}>
          <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Back
        </button>
      )}

      {view === 'form' && (
        <div className="msai-card msai-ws-step">
          <div className="msai-lp-result-head">
            <div className="msai-step-title">Question Paper Generator</div>
            <button type="button" className="msai-btn-secondary" onClick={() => setView('list')}>
              <i className="fa-solid fa-folder-open" aria-hidden="true" /> My Papers
            </button>
          </div>

          <div className="msai-field"><label>Select Class</label>
            <div className="msai-chip-row">{classes.map(c => (
              <button key={c.id} type="button" className={`msai-chip${sel.clsId === c.id ? ' msai-chip--active' : ''}`} onClick={() => pickClass(c.id)}>{c.name}</button>
            ))}</div>
          </div>
          <div className="msai-field"><label>Select Subject</label>
            <div className="msai-chip-row">{subjects.map(s => (
              <button key={s.id} type="button" className={`msai-chip${sel.subjectId === s.id ? ' msai-chip--active' : ''}`}
                onClick={() => setSel(p => ({ ...p, subject: s.subject_name || s.name, subjectId: s.id }))}>{s.subject_name || s.name}</button>
            ))}</div>
          </div>

          <Field label="Exam Title">
            <input type="text" value={f.title} onChange={e => set({ title: e.target.value })} placeholder="e.g. Chemical Bonding — Monthly Test" />
          </Field>

          <div className="msai-field"><label>Paper Type</label>
            <div className="msai-content-type-grid">
              {QP_TYPES.map(t => (
                <button key={t.id} type="button" className={`msai-content-type-card msai-content-type-card--sm${f.paperType === t.id ? ' selected' : ''}`} onClick={() => set({ paperType: t.id })}>
                  <div className="msai-ctc-title">{t.name}</div>
                  <div className="msai-ctc-desc">{t.description}</div>
                </button>
              ))}
            </div>
          </div>

          {showObjective && (
            <div className="msai-qp-section">
              <div className="msai-qp-section-h"><i className="fa-solid fa-list-check" aria-hidden="true" /> Objective Section</div>
              <div className="msai-form-grid">
                <Field label="Duration (minutes)"><Stepper value={f.objDuration} onChange={v => set({ objDuration: v })} /></Field>
                <Field label="Number of Questions"><Stepper value={f.objCount} step={1} max={200} onChange={v => set({ objCount: v })} /></Field>
                <Field label="Total Marks"><Stepper value={f.objMarks} step={1} max={500} onChange={v => set({ objMarks: v })} /></Field>
              </div>
              <PerQuestionHint marks={f.objMarks} count={f.objCount} />
              <Field label="What should the objective section cover? (a default is used if left empty)">
                <div className="msai-field-voice-wrap">
                  <textarea rows={2} value={f.objInstructions} onChange={e => set({ objInstructions: e.target.value })} placeholder="e.g. 20 MCQs from chapter 3, 4 options each" />
                  <VoiceDictationButton onResult={t => set({ objInstructions: f.objInstructions.trim() ? `${f.objInstructions.trim()} ${t}` : t })} />
                </div>
              </Field>
            </div>
          )}

          {showSubjective && (
            <div className="msai-qp-section">
              <div className="msai-qp-section-h"><i className="fa-solid fa-pen-to-square" aria-hidden="true" /> Subjective Section</div>
              <div className="msai-form-grid">
                <Field label="Duration (minutes)"><Stepper value={f.subjDuration} onChange={v => set({ subjDuration: v })} /></Field>
                <Field label="Number of Questions"><Stepper value={f.subjCount} step={1} max={100} onChange={v => set({ subjCount: v })} /></Field>
                <Field label="Total Marks"><Stepper value={f.subjMarks} step={1} max={500} onChange={v => set({ subjMarks: v })} /></Field>
              </div>
              <PerQuestionHint marks={f.subjMarks} count={f.subjCount} />
              <Field label="What should the subjective section cover? (a default is used if left empty)">
                <div className="msai-field-voice-wrap">
                  <textarea rows={2} value={f.subjInstructions} onChange={e => set({ subjInstructions: e.target.value })} placeholder="e.g. 8 short questions and 2 long questions" />
                  <VoiceDictationButton onResult={t => set({ subjInstructions: f.subjInstructions.trim() ? `${f.subjInstructions.trim()} ${t}` : t })} />
                </div>
              </Field>
            </div>
          )}

          <div className="msai-field"><label>Difficulty</label>
            <div className="msai-chip-row">{QP_DIFFICULTIES.map(d => (
              <button key={d.id} type="button" className={`msai-chip${f.difficulty === d.id ? ' msai-chip--active' : ''}`} onClick={() => set({ difficulty: d.id })}>{d.name}</button>
            ))}</div>
          </div>

          <div className="msai-form-grid">
            <Field label="Language"><select value={f.language} onChange={e => set({ language: e.target.value })}>{QP_LANGUAGES.map(l => <option key={l}>{l}</option>)}</select></Field>
            <Field label="Board (optional)"><input type="text" value={f.board} onChange={e => set({ board: e.target.value })} placeholder="e.g. Federal Board" /></Field>
            <Field label="Region (optional)"><input type="text" value={f.region} onChange={e => set({ region: e.target.value })} placeholder="e.g. Punjab" /></Field>
          </div>

          <Toggle label="Include Answer Key" checked={f.includeAnswerKey} onChange={v => set({ includeAnswerKey: v })} />
          <Toggle label="Include Answer Sheet" checked={f.includeAnswerSheet} onChange={v => set({ includeAnswerSheet: v })} />
          <Toggle label="Include School Name & Logo" checked={f.includeBranding} onChange={v => set({ includeBranding: v })} />

          <button type="button" className="msai-btn-primary" style={{ alignSelf: 'flex-end' }} disabled={!canCreate || !f.title.trim()} onClick={runGenerate}>
            <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> Generate Question Paper
          </button>
          <div className="msai-hint-text">Usually generates in a minute or two.</div>
        </div>
      )}

      {view === 'generating' && (
        <div className="msai-card">
          <GeneratingProgress
            title="Generating your question paper…"
            progress={job.progress}
            facts={GENERATING_FACTS}
            onCancel={job.cancel}
            onRetry={runGenerate}
            onDismiss={() => { job.reset(); setView('form'); }}
          />
        </div>
      )}

      {view === 'list' && (
        <div className="msai-card msai-ws-step">
          <div className="msai-step-title">My Question Papers</div>
          {list.loading && <div className="msai-empty-state"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Loading…</div>}
          {!list.loading && list.error && <div className="msai-tip-card"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {list.error}</div>}
          {!list.loading && !list.error && list.items.length === 0 && <div className="msai-empty-state">No question papers yet — generate your first one.</div>}
          <div className="msai-qp-list">
            {list.items.map(item => (
              <div key={item.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button type="button" className="msai-qp-row" onClick={() => openPaper(item)}>
                  <span className="msai-qp-row-ic"><i className="fa-solid fa-file-lines" aria-hidden="true" /></span>
                  <span className="msai-qp-row-txt">
                    <div className="msai-qp-row-title">{item.title || `Question Paper #${item.id}`}</div>
                    <div className="msai-qp-row-meta">
                      {[item.grade_label || item.grade, item.subject_label || item.subject, item.paper_type,
                        item.created_at ? new Date(item.created_at).toLocaleDateString() : ''].filter(Boolean).join(' · ')}
                    </div>
                  </span>
                  <i className="fa-solid fa-chevron-right msai-feature-chev" aria-hidden="true" />
                </button>
                {canDelete && (
                  <button type="button" className="msai-qp-row-del" aria-label="Delete question paper" onClick={() => removePaper(item)}>
                    <i className="fa-regular fa-trash-can" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'result' && paper && (
        <div className="msai-card msai-ws-result">
          <div className="msai-lp-result-head">
            <div>
              <div className="msai-step-title">Question Paper Ready <i className="fa-solid fa-circle-check" style={{ color: '#16A34A', marginLeft: 6 }} aria-hidden="true" /></div>
              <div className="msai-lp-meta">{[paper.grade_label || sel.cls, paper.subject_label || sel.subject, paper.paper_type || f.paperType].filter(Boolean).join(' · ')}{paper.pdfUrl ? ' · PDF Ready' : ''}</div>
            </div>
            <VersionBadge version={paper.version} />
          </div>

          {paper.pdfUrl || paper.pageContent.length
            ? (paper.pageContent.length ? <QuestionPaperPages paper={paper} meta={paperMeta} brand={brand} /> : <WorksheetPages worksheet={paper} />)
            : <div className="msai-empty-state">The question paper was created, but the server did not return a PDF or page content to preview yet.</div>}

          {!(editing && canEdit) ? (
            <div className="msai-result-actions">
              {paper.pdfUrl ? (
                <a className="msai-btn-primary" href={paper.pdfUrl} target="_blank" rel="noreferrer"><i className="fa-regular fa-file-pdf" aria-hidden="true" /> View PDF</a>
              ) : (paper.pageContent.length > 0 && (
                <button type="button" className="msai-btn-primary" onClick={() => { if (!openQuestionPaperPrintWindow(paper, paperMeta, brand)) toast?.('Please allow pop-ups to view the paper.'); }}>
                  <i className="fa-regular fa-file-pdf" aria-hidden="true" /> View PDF
                </button>
              ))}
              {paper.answerKeyUrl && (
                <a className="msai-btn-secondary" href={paper.answerKeyUrl} target="_blank" rel="noreferrer"><i className="fa-solid fa-key" aria-hidden="true" /> Answer Key</a>
              )}
              {canEdit && paper.id != null && (
                <button type="button" className="msai-btn-secondary" onClick={() => setEditing(true)}><i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> Edit via AI</button>
              )}
              {canEdit && undoPaper && (
                <button type="button" className="msai-btn-secondary" onClick={() => { setPaper(undoPaper); setUndoPaper(null); toast?.('Reverted to the previous version'); }}>
                  <i className="fa-solid fa-rotate-left" aria-hidden="true" /> Undo AI edit
                </button>
              )}
              {canDownload && (
                <button type="button" className="msai-btn-secondary" disabled={!paper.pdfUrl && !paper.pageContent.length}
                  onClick={() => (paper.pdfUrl ? downloadFile(paper.pdfUrl, `${paperTitle}.pdf`) : (openQuestionPaperPrintWindow(paper, paperMeta, brand) || toast?.('Please allow pop-ups to download the paper.')))}>
                  <i className="fa-solid fa-download" aria-hidden="true" /> Download PDF
                </button>
              )}
              <SaveToLibraryButton
                toast={toast}
                resetKey={`${paper.id}:${paper.version || 1}`}
                build={() => {
                  if (paper.id == null) throw new Error('This question paper has no id yet, so it cannot be saved.');
                  return {
                    type: 'questionpaper',
                    title: paperTitle,
                    content: {
                      paper,
                      meta: { cls: paper.grade_label || sel.cls || '', subject: paper.subject_label || sel.subject || '', paperType: paper.paper_type || f.paperType || '' },
                      brand,
                      timeLabel: totalMins ? `${totalMins} min` : '',
                      totalMarks: totalMarks || '',
                    },
                    sourceKey: `questionpaper:${paper.id}`,
                  };
                }}
              />
              {canDelete && paper.id != null && (
                <button type="button" className="msai-btn-secondary" onClick={() => removePaper(paper)}><i className="fa-regular fa-trash-can" aria-hidden="true" /> Delete</button>
              )}
            </div>
          ) : (
            <EditViaAIPanel
              contextLabel={[paperTitle, paper.pageContent.length ? `${paper.pageContent.length} pages` : ''].filter(Boolean).join(' · ')}
              quickChips={QP_QUICK_EDITS}
              onSubmitInstruction={async (instruction, { base, signal, onProgress }) => {
                const { paper: updated, changes } = await qpService.editQuestionPaperViaAI(base || paper, instruction, { signal, onProgress });
                return { result: updated, changes };
              }}
              onDiscard={() => setEditing(false)}
              onApply={(proposal) => {
                setUndoPaper(paper);
                setPaper({ ...proposal.result, version: (paper.version || 1) + 1 });
                setEditing(false);
                onConsumed?.();
                toast?.(`Question paper updated — ${proposal.changes.length} change${proposal.changes.length === 1 ? '' : 's'} applied`);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
