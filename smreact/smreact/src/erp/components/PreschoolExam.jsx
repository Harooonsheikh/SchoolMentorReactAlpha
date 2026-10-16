import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from './Tooltip';
import * as preschoolService from '../services/preschoolService';

function CharField({ value, max, placeholder, multiline = false, onChange, toast }) {
  const warnRef = useRef(false);
  const limitRef = useRef(false);
  const len = (value || '').length;
  const pct = max > 0 ? len / max : 0;
  const barCol = pct >= 1 ? '#DC2626' : pct >= 0.8 ? '#D97706' : '#1E40AF';
  const cntCol = pct >= 1 ? '#DC2626' : pct >= 0.8 ? '#D97706' : 'var(--text-muted)';
  const bdrCol = pct >= 1 ? '#DC2626' : pct >= 0.8 ? '#D97706' : 'var(--border-light)';
  const barW = Math.min(100, Math.round(pct * 100));
  const label = multiline ? 'Final Remarks' : 'Comment';
  const handle = next => {
    const nlen = next.length;
    const npct = max > 0 ? nlen / max : 0;
    if (npct >= 0.8 && npct < 1 && !warnRef.current) {
      warnRef.current = true;
      limitRef.current = false;
      toast && toast(`${label}: only ${max - nlen} characters remaining.`, 'info');
    }
    if (npct >= 1 && !limitRef.current) {
      limitRef.current = true;
      toast && toast(`${label} limit reached — max ${max} characters.`, 'error');
    }
    if (npct < 0.8) { warnRef.current = false; limitRef.current = false; }
    onChange(next.slice(0, max));
  };
  return (
    <div className="rs-cf-wrap">
      {multiline ? (
        <textarea className="rs-input rs-input-area" maxLength={max} placeholder={placeholder} value={value || ''} onChange={e => handle(e.target.value)} style={{ borderColor: bdrCol }} />
      ) : (
        <input className="rs-input" maxLength={max} placeholder={placeholder} value={value || ''} onChange={e => handle(e.target.value)} style={{ borderColor: bdrCol }} />
      )}
      <div className="rs-cf-meter">
        <div className="rs-cf-bar"><div style={{ width: `${barW}%`, background: barCol }} /></div>
        <span className="rs-cf-count" style={{ color: cntCol }}>{len}/{max}{multiline ? ' chars' : ''}</span>
      </div>
    </div>
  );
}

export {
  pProgressForStudent,
  pTemplateForExam,
  pFindPreviousResult,
  PreschoolResultSetup,
  PreschoolLevelPickModal,
  PreschoolAssessmentModal,
  PreschoolResultCardViewer,
  PreschoolTemplatePreviewModal,
  PreschoolHelpModal,
};

const P_TEMPLATES = [
  { id: 'monthly', name: 'Preschool Monthly Assessment', desc: 'One month\'s achievement snapshot per learning area.', icon: 'fa-calendar-day', accent: '#1E40AF' },
  { id: 'term', name: 'Preschool Term Report', desc: 'Achievement summary across the whole term.', icon: 'fa-calendar-week', accent: '#7C3AED' },
  { id: 'annual', name: 'Preschool Annual Report', desc: 'Full-year achievement & development overview.', icon: 'fa-calendar', accent: '#D97706' },
];

/* ─── Sample/fallback data for template previews (no real assessment
   picked yet) — mirrors SAMPLE_RC_STUDENT/SAMPLE_RC_RD/SAMPLE_RC_EX
   above, same "preview with representative data" convention. ──────── */
const SAMPLE_P_STUDENT = { id: 1, rollNo: '245-N-101', admissionNo: 'ADM-1025', name: 'Ali Ahmed', father: 'Kashif Ahmed', dob: '2022-01-18', campus: 'Main Campus', teacher: 'Ms. Hira Khan', attendance: '91%' };
const SAMPLE_P_CLS = { key: 'pcls_nursery_a', cls: 'Nursery', sec: 'A' };
const SAMPLE_P_ASSESSMENT = { id: 'pex_sample', name: 'September Monthly Assessment', period: 'monthly', label: 'September 2026' };
const SAMPLE_P_AD = {
  studentId: 1,
  attendance: { workingDays: 22, presentDays: 20 },
  achievements: {
    la_1: { slo_1_1: 'E', slo_1_2: 'M', slo_1_3: 'M', slo_1_4: 'E' },
    la_3: { slo_3_1: 'E', slo_3_2: 'M', slo_3_3: 'E', slo_3_4: 'A' },
    la_7: { slo_7_1: 'M', slo_7_2: 'E' },
  },
  psd: { psd_1: 'E', psd_2: 'M', psd_3: 'M', psd_4: 'E', psd_5: 'M', psd_6: 'M', psd_7: 'A', psd_8: 'E', psd_9: 'M', psd_10: 'E' },
  teacherRemarks: 'Ali is a cheerful, curious learner who engages well with numeracy activities and is beginning to build confidence in early writing.',
  finalRemarks: 'Outstanding progress across most learning areas. Keep encouraging this enthusiasm at home.',
  ptm: { enabled: true, date: '2026-09-20', parentAttendance: true, parentComments: 'Happy with the progress, will practice numbers at home too.', teacherComments: 'Continue reinforcing letter sounds through picture books at home.' },
  promotion: { status: 'promoted', toClass: 'Montessori I' },
};
/* Sample "last exam" comparison figure, for the template preview only. */
const SAMPLE_P_PREVIOUS = { examId: 'pex_prev', examName: 'August Monthly Assessment', pct: 79, code: 'M' };

/* Derives a short code from a grading-level label — initials of each
   word, uppercased (e.g. "Excellent Performance" → "EP", "Mastered"
   → "M"). Used by PGradingScaleCard so the code stays in sync with
   whatever name a school gives that achievement level, instead of
   being a fixed/hardcoded letter. */
function pDeriveCodeFromLabel(label) {
  const words = (label || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  return words.map(w => w[0].toUpperCase()).join('');
}
function pGradeInfo(gradingScale, code) {
  return (gradingScale || []).find(g => g.code === code) || { code, label: code || '—', color: '#94A3B8' };
}
/* Count of E/M/A/NY across every scored SLO + PSD field in one assessment. */
function pAchievementCounts(gradingScale, ad) {
  const counts = {};
  (gradingScale || []).forEach(g => { counts[g.code] = 0; });
  Object.values(ad?.achievements || {}).forEach(area => Object.values(area).forEach(code => { if (code in counts) counts[code] += 1; }));
  Object.values(ad?.psd || {}).forEach(code => { if (code in counts) counts[code] += 1; });
  return counts;
}
function pProgressForStudent(ad, learningAreasCount, sloTotal) {
  if (!ad) return { done: 0, total: sloTotal };
  const done = Object.values(ad.achievements || {}).reduce((a, area) => a + Object.keys(area).length, 0);
  return { done, total: sloTotal };
}
/* ─── Final Remarks — the Preschool equivalent of the Grade 1-12 system's
   percentage-band auto remark (RC_FINAL_REMARKS_SETUP/rcGetFinalRemarks):
   an editable, auto-suggested summary based on the child's most frequent
   achievement level across everything rated so far. ────────────────── */
const P_FINAL_REMARKS_SETUP = {
  E: 'Outstanding progress across most learning areas. Keep encouraging this enthusiasm at home.',
  M: 'Consistently meeting expectations. Continue building on this steady progress.',
  A: 'Approaching expectations — with a little more practice, will catch up quickly.',
  NY: 'Needs additional support and practice. Please work closely with the teacher.',
};
function pGetFinalRemarks(gradingScale, ad) {
  const counts = pAchievementCounts(gradingScale, ad);
  let topCode = null, topN = 0;
  (gradingScale || []).forEach(g => { if ((counts[g.code] || 0) > topN) { topN = counts[g.code]; topCode = g.code; } });
  if (!topCode) return '';
  return P_FINAL_REMARKS_SETUP[topCode] || `Overall performance: ${pGradeInfo(gradingScale, topCode).label}.`;
}

/* ─── Overall Performance — an indicative percentage + dominant grade
   for the result card's summary strip (Preschool has no marks/totals to
   average like Grade 1-12, so each achievement level is projected onto
   the midpoint of its own percentage range instead). ─────────────────── */
const P_LEVEL_PCT_MIDPOINT = { E: 95, M: 82, A: 62, NY: 35 };
function pOverallPerformance(gradingScale, ad) {
  const counts = pAchievementCounts(gradingScale, ad);
  const totalRated = Object.values(counts).reduce((a, b) => a + b, 0);
  if (!totalRated) return { pct: 0, code: null };
  let sum = 0, topCode = null, topN = 0;
  (gradingScale || []).forEach(g => {
    const n = counts[g.code] || 0;
    sum += n * (P_LEVEL_PCT_MIDPOINT[g.code] ?? 50);
    if (n > topN) { topN = n; topCode = g.code; }
  });
  return { pct: Math.round(sum / totalRated), code: topCode };
}
/* Same midpoint-projection idea as pOverallPerformance, scoped to one
   learning area's statements (or the whole PSD set) — drives the small
   progress bars on the result card so a section's strength reads at a
   glance before the detailed per-statement chips below it. */
function pAreaScore(ad, laId) {
  const ratings = Object.values(ad?.achievements?.[laId] || {});
  if (!ratings.length) return null;
  return Math.round(ratings.reduce((a, code) => a + (P_LEVEL_PCT_MIDPOINT[code] ?? 50), 0) / ratings.length);
}
function pPsdScore(ad) {
  const ratings = Object.values(ad?.psd || {});
  if (!ratings.length) return null;
  return Math.round(ratings.reduce((a, code) => a + (P_LEVEL_PCT_MIDPOINT[code] ?? 50), 0) / ratings.length);
}
/* 'DD/MM/YYYY' (mock/exams.js's exam.from/.to format) → Date, for
   chronologically finding "the last exam" for a comparison. */
function pParseExamDate(dmy) {
  const [d, m, y] = (dmy || '').split('/').map(Number);
  return new Date(y || 0, (m || 1) - 1, d || 1);
}
/* Which P_TEMPLATES variant (monthly/term/annual) a real exam's card
   should render in — inferred from the exam's own name rather than the
   admin's last-picked Result Card Options default, so a Preschool
   child's Monthly, Term and Annual assessments each print in their own
   matching style instead of all sharing one global template. */
function pTemplateForExam(examName) {
  const n = (examName || '').toLowerCase();
  if (n.includes('annual')) return 'annual';
  if (n.includes('term')) return 'term';
  return 'monthly';
}
/* Finds the most recent EARLIER Preschool-toggled assessment for the
   same class (by name) + same student, across every exam — used for
   the result card's "vs last exam" comparison. */
function pFindPreviousResult({ exams, resultData, pResultData, pClassTypes, gradingScale, currentExamId, className, studentId }) {
  const current = exams.find(e => e.id === currentExamId);
  if (!current) return null;
  const curDate = pParseExamDate(current.from);
  let best = null, bestDate = null;
  exams.forEach(ex => {
    if (ex.id === currentExamId) return;
    const exDate = pParseExamDate(ex.from);
    if (!(exDate < curDate)) return;
    const idx = (ex.classes || []).indexOf(className);
    if (idx < 0) return;
    const key = `rcls_${ex.id}_${idx}`;
    if (pClassTypes[key] !== 'preschool') return;
    const ad = pResultData[key]?.students.find(s => s.studentId === studentId);
    if (!ad) return;
    if (!bestDate || exDate > bestDate) { bestDate = exDate; best = { examId: ex.id, examName: ex.name, ...pOverallPerformance(gradingScale, ad) }; }
  });
  return best;
}
/* System-Fetch attendance is read straight off the same student record
   the Grade 1-12 system already carries (st.attendance, a percentage
   string, see RES_SAMPLE_STUDENTS) and projected onto the school's
   standard working-days count for the period. A teacher can still
   switch to Manual Entry per student when the auto-fetched figure
   needs correcting (PreschoolAssessmentModal's attendanceMode). */
const P_PERIOD_WORKING_DAYS = 22;
function pAutoAttendance(student) {
  const pct = Math.max(0, Math.min(100, parseInt(student?.attendance, 10) || 0));
  const workingDays = P_PERIOD_WORKING_DAYS;
  const presentDays = Math.round((pct / 100) * workingDays);
  return { workingDays, presentDays, pct };
}

/* ─── "What is Preschool Assessment?" guidance modal — mirrors
   Accounts.jsx's BooksHelpModal (numbered-steps help pattern). ────── */
function PreschoolHelpModal({ onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const steps = [
    { t: 'Setup', d: 'Define Learning Areas (subjects), your Assessment Criteria (the E/M/A/NY grading scale and percentage ranges) and Personal & Social Development fields — one-time, school-wide.' },
    { t: 'Create Assessment Areas', d: 'For each Learning Area, add the SLO / activity statements teachers will assess a child against — e.g. "Counts objects with one-to-one correspondence".' },
    { t: 'Create Criteria', d: 'Customize the achievement-level labels, percentage ranges and colours if needed (defaults: Exceeding / Meeting / Approaching / Not Yet Meeting Expectations).' },
    { t: 'Mark a Class as Preschool', d: 'In Single Assessment Result, pick a Term and Exam as usual, then switch a class row\'s toggle to Preschool / Montessori — it stays in the same class list as Grade 1-12.' },
    { t: 'Enter Student Assessment', d: 'Expand the class and for each child mark E / M / A / NY against every SLO statement, plus Personal & Social Development. Attendance is fetched automatically — only remarks are typed manually.' },
    { t: 'Generate Report Card', d: 'Publish the class, then preview or download each child\'s Preschool report card — Monthly, Term or Annual.' },
  ];

  return createPortal(
    <div className="exam-modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="exam-modal" style={{ maxWidth: 620 }}>
        <div className="exam-modal-header">
          <div className="exam-modal-header-left">
            <div className="exam-modal-header-icon"><i className="fa-solid fa-shapes"></i></div>
            <div>
              <div className="exam-modal-title">What is Preschool Assessment?</div>
              <div className="exam-modal-sub">Achievement-based assessment for Playgroup through KG — no marks, no percentages.</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="exam-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>
        <div className="exam-modal-body">
          <div style={{ display: 'flex', gap: 10, padding: '11px 14px', background: 'rgba(30,64,175,.08)', border: '1px solid rgba(30,64,175,.2)', borderRadius: 10, marginBottom: 18 }}>
            <i className="fa-solid fa-circle-info" style={{ color: '#1E40AF', fontSize: 13, marginTop: 1, flexShrink: 0 }}></i>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
              Instead of obtained/total marks, teachers rate each child against simple activity statements using four achievement levels — Exceeding, Meeting, Approaching, or Not Yet Meeting Expectations.
            </div>
          </div>
          <div className="acc-help-steps">
            {steps.map((s, i) => (
              <div key={i} className="acc-help-step">
                <div className="acc-help-step-no">{i + 1}</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>{s.t}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="exam-modal-footer">
          <button className="exam-submit-btn" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── "Which class's SLOs apply here?" — shown the moment a Single
   Assessment Result row is switched to Preschool, since a real class
   name (e.g. "Nursery - A") doesn't always map cleanly onto one of the
   three canonical levels admin set SLOs up for. The row only actually
   becomes Preschool once a level is confirmed here — cancelling leaves
   it as Grade 1-12. ─────────────────────────────────────────────────── */
function PreschoolLevelPickModal({ className, pLevels, onClose, onConfirm }) {
  const [levelId, setLevelId] = useState(pLevels[0]?.id || null);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="exam-modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="exam-modal" style={{ maxWidth: 440 }}>
        <div className="exam-modal-header">
          <div className="exam-modal-header-left">
            <div className="exam-modal-header-icon"><i className="fa-solid fa-shapes"></i></div>
            <div>
              <div className="exam-modal-title">Which class's SLOs?</div>
              <div className="exam-modal-sub">{className} · Preschool / Montessori</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="exam-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>
        <div className="exam-modal-body">
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
            Pick which level's SLO / Activity-Based Assessment statements (set up in Result Setup) this class should be rated against.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pLevels.map(lvl => (
              <button
                key={lvl.id}
                type="button"
                onClick={() => setLevelId(lvl.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10,
                  border: `1.5px solid ${levelId === lvl.id ? '#7C3AED' : 'var(--border-light)'}`,
                  background: levelId === lvl.id ? 'rgba(124,58,237,.08)' : 'var(--bg-card)',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                }}
              >
                <span style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${levelId === lvl.id ? '#7C3AED' : 'var(--border-med)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {levelId === lvl.id && <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#7C3AED' }} />}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{lvl.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="exam-modal-footer">
          <button className="exam-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="exam-submit-btn" disabled={!levelId} onClick={() => onConfirm(levelId)}>
            <i className="fa-solid fa-check"></i> Confirm
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── Decorative template preview box — simpler than TemplateHero
   above (3 period-scope variants, not 3 visual designs) but same
   inline-style wireframe technique. ─────────────────────────────── */
function PreschoolTemplateHero({ id, large = false }) {
  const t = P_TEMPLATES.find(x => x.id === id) || P_TEMPLATES[0];
  const h = large ? 220 : 110;
  return (
    <div style={{ height: h, background: `linear-gradient(135deg,${t.accent} 0%,${t.accent}CC 100%)`, padding: large ? '20px 22px' : '12px 14px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,.08)' }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
        <div style={{ width: large ? 38 : 22, height: large ? 38 : 22, borderRadius: 8, background: 'rgba(255,255,255,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: large ? 16 : 10, flexShrink: 0 }}>
          <i className={`fa-solid ${t.icon}`}></i>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ height: large ? 9 : 5, borderRadius: 3, background: 'rgba(255,255,255,.95)', width: '72%', marginBottom: 4 }} />
          <div style={{ height: large ? 5 : 3, borderRadius: 2, background: 'rgba(255,255,255,.45)', width: '46%' }} />
        </div>
      </div>
      <div style={{ position: 'relative', display: 'flex', gap: 5, marginBottom: 8 }}>
        {['E', 'M', 'A', 'N'].map(c => (
          <div key={c} style={{ flex: 1, height: large ? 24 : 14, borderRadius: 4, background: 'rgba(255,255,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: large ? 10 : 7, fontWeight: 800, color: '#fff' }}>{c}</div>
        ))}
      </div>
      <div style={{ position: 'relative', background: 'rgba(255,255,255,.1)', borderRadius: 4, overflow: 'hidden' }}>
        {[0, 1, 2].map(rowI => (
          <div key={rowI} style={{ display: 'flex', gap: 4, padding: large ? '6px 9px' : '2px 5px', borderBottom: rowI < 2 ? '1px solid rgba(255,255,255,.08)' : 'none' }}>
            <div style={{ height: large ? 4 : 2.5, borderRadius: 1, background: 'rgba(255,255,255,.6)', flex: 3 }} />
            <div style={{ height: large ? 4 : 2.5, borderRadius: 1, background: 'rgba(255,255,255,.4)', flex: 1 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Generic "editable list" card body — used for Learning Areas and
   Personal & Social Development fields (identical shape: id+label,
   add/rename/delete, one Save button). ─────────────────────────────── */
function PEditableListCard({ icon, title, sub, items, onSaved, service, toast, showIcons }) {
  const [draft, setDraft] = useState(items || []);
  const [newLabel, setNewLabel] = useState('');
  const [removedDbIds, setRemovedDbIds] = useState([]);
  useEffect(() => { setDraft(items || []); setRemovedDbIds([]); }, [items]);

  const rename = (id, name) => setDraft(d => d.map(x => (x.id === id ? { ...x, name } : x)));
  const relabel = (id, label) => setDraft(d => d.map(x => (x.id === id ? { ...x, label } : x)));
  const remove = id => {
    setDraft(d => {
      const item = d.find(x => x.id === id);
      if (item?.dbId) setRemovedDbIds(r => [...r, item.dbId]);
      return d.filter(x => x.id !== id);
    });
  };
  const add = () => {
    const v = newLabel.trim();
    if (!v) { toast('Enter a name first', 'error'); return; }
    const item = showIcons ? { id: `la_${Date.now()}`, name: v, icon: 'fa-book' } : { id: `psd_${Date.now()}`, label: v };
    setDraft(d => [...d, item]);
    setNewLabel('');
  };
  const save = async () => {
    const saved = await service(draft, removedDbIds);
    onSaved(saved);
    setRemovedDbIds([]);
    toast('Saved successfully!', 'success');
  };
  return (
    <div className="rs-card">
      <div className="rs-card-head">
        <div className="rs-card-icon"><i className={`fa-solid ${icon}`}></i></div>
        <div style={{ flex: 1 }}>
          <div className="rs-card-title">{title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>
        </div>
      </div>
      <div style={{ padding: '16px 20px' }}>
        {draft.map(item => (
          <div key={item.id} className="pms-list-row">
            {showIcons && <i className={`fa-solid ${item.icon || 'fa-book'}`} style={{ color: '#1E40AF', width: 16, flexShrink: 0 }}></i>}
            <input
              className="rs-input"
              value={showIcons ? item.name : item.label}
              onChange={e => (showIcons ? rename(item.id, e.target.value) : relabel(item.id, e.target.value))}
            />
            <Tooltip text="Remove">
              <button type="button" className="exam-del-btn" onClick={() => remove(item.id)}><i className="fa-solid fa-trash-can"></i></button>
            </Tooltip>
          </div>
        ))}
        {draft.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>None added yet.</div>}
        <div className="pms-add-row">
          <input
            className="rs-input"
            placeholder={showIcons ? 'Add a new learning area…' : 'Add a new field…'}
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add(); }}
          />
          <button type="button" className="exam-add-btn" onClick={add}><i className="fa-solid fa-plus"></i> Add</button>
        </div>
        <div className="pms-save-row">
          <button type="button" className="exam-submit-btn" onClick={save}><i className="fa-solid fa-floppy-disk"></i> Save Changes</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Assessment Criteria / Grading Scale editor — 4 fixed codes,
   customizable label + colour. ─────────────────────────────────────── */
function PGradingScaleCard({ gradingScale, onSaved, toast }) {
  const [draft, setDraft] = useState(gradingScale || []);
  /* Rows whose code the admin has typed into directly — once touched,
     that row's code stops auto-following its label (an explicit
     override), same "auto until overridden" pattern as a slug field. */
  const [manualCode, setManualCode] = useState({});
  useEffect(() => { setDraft(gradingScale || []); setManualCode({}); }, [gradingScale]);

  const setLabel = (idx, val) => setDraft(d => d.map((g, i) => {
    if (i !== idx) return g;
    const next = { ...g, label: val };
    if (!manualCode[idx]) next.code = pDeriveCodeFromLabel(val); // code is dynamically linked to the label — not hardcoded
    return next;
  }));
  const setCode = (idx, val) => {
    setManualCode(m => ({ ...m, [idx]: true }));
    setDraft(d => d.map((g, i) => (i === idx ? { ...g, code: val.toUpperCase() } : g)));
  };
  const setField = (idx, key, val) => setDraft(d => d.map((g, i) => (i === idx ? { ...g, [key]: val } : g)));

  const save = async () => {
    const codes = draft.map(g => (g.code || '').trim());
    if (codes.some(c => !c)) { toast('Every grading level needs a code — rename the label to generate one', 'error'); return; }
    if (new Set(codes).size !== codes.length) { toast('Two grading levels generated the same code — adjust a label or code to make them unique', 'error'); return; }

    /* Build an old→new rename map (by original row position) so every
       E/M/A/NY already saved against a real student's assessment gets
       updated to the new code too — a renamed criterion never breaks
       assessments already entered under the old code. */
    const original = gradingScale || [];
    const renameMap = {};
    draft.forEach((g, i) => {
      const oldCode = original[i]?.code;
      const newCode = codes[i];
      if (oldCode && oldCode !== newCode) renameMap[oldCode] = newCode;
    });

    const cleaned = draft.map((g, i) => ({ ...g, code: codes[i] }));
    const saved = await preschoolService.saveGradingScale(cleaned, renameMap);
    onSaved(saved);
    toast(Object.keys(renameMap).length ? 'Grading scale saved — existing assessments updated to match!' : 'Grading scale saved!', 'success');
  };

  return (
    <div className="rs-card">
      <div className="rs-card-head">
        <div className="rs-card-icon"><i className="fa-solid fa-layer-group"></i></div>
        <div style={{ flex: 1 }}>
          <div className="rs-card-title">Assessment Criteria</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>Achievement-based grading scale — the code is generated from the label as you rename it (e.g. "Excellent Performance" → EP), or type a code directly to set it manually. Renaming updates every rating button, chip and result card, including assessments already saved.</div>
        </div>
      </div>
      <div style={{ padding: '16px 20px' }}>
        {draft.map((g, idx) => (
          <div key={idx} className="pms-list-row">
            <span className="rs-grade-chip" style={{ background: g.color, minWidth: 34, flexShrink: 0 }}>{g.code || '?'}</span>
            <input
              className="rs-input"
              style={{ maxWidth: 56, textAlign: 'center', fontWeight: 800, flex: 'none' }}
              maxLength={6}
              placeholder="Code"
              value={g.code}
              onChange={e => setCode(idx, e.target.value)}
            />
            <input className="rs-input" value={g.label} onChange={e => setLabel(idx, e.target.value)} />
            <input className="rs-input" style={{ maxWidth: 130 }} placeholder="e.g. 90% - 100%" value={g.range || ''} onChange={e => setField(idx, 'range', e.target.value)} />
            <input type="color" value={g.color} onChange={e => setField(idx, 'color', e.target.value)} style={{ width: 34, height: 30, border: '1.5px solid var(--border-light)', borderRadius: 6, padding: 2, cursor: 'pointer' }} />
          </div>
        ))}
        <div className="pms-save-row">
          <button type="button" className="exam-submit-btn" onClick={save}><i className="fa-solid fa-floppy-disk"></i> Save Changes</button>
        </div>
      </div>
    </div>
  );
}

/* ─── SLO / Activity Statements editor — pick a class LEVEL, then a
   Learning Area within it, edit that level's statement list. A Play
   Group child and a KG child are assessed against different statements
   even in the same Learning Area, so statements are scoped by level
   (mockSloStatements[levelId][laId]), not one shared list. ─────────── */
function PSloCard({ pLevels, pActiveLevel, setPActiveLevel, pLearningAreas, pSlo, pActiveLA, setPActiveLA, onSaved, toast }) {
  const activeLevel = pActiveLevel || pLevels[0]?.id;
  const activeId = pActiveLA || pLearningAreas[0]?.id;
  const levelSlo = pSlo[activeLevel] || {};
  const [draft, setDraft] = useState(levelSlo[activeId] || []);
  const [newText, setNewText] = useState('');
  const [removedDbIds, setRemovedDbIds] = useState([]);
  useEffect(() => {
    setDraft(pSlo[activeLevel]?.[activeId] || []);
    setNewText('');
    setRemovedDbIds([]);
  }, [activeLevel, activeId, pSlo]);

  const activeLevelIdx = pLevels.findIndex(l => l.id === activeLevel);
  const prevLevel = activeLevelIdx > 0 ? pLevels[activeLevelIdx - 1] : null;
  const activeLevelObj = pLevels[activeLevelIdx];

  const change = (id, text) => setDraft(d => d.map(s => (s.id === id ? { ...s, text } : s)));
  const remove = id => {
    setDraft(d => {
      const item = d.find(s => s.id === id);
      if (item?.dbId) setRemovedDbIds(r => [...r, item.dbId]);
      return d.filter(s => s.id !== id);
    });
  };
  const add = () => {
    const v = newText.trim();
    if (!v) { toast('Enter an assessment statement first', 'error'); return; }
    setDraft(d => [...d, { id: `slo_${activeLevel}_${activeId}_${Date.now()}`, text: v }]);
    setNewText('');
  };
  const save = async () => {
    await preschoolService.saveSloStatements(activeLevel, activeId, draft, removedDbIds);
    onSaved({ ...pSlo, [activeLevel]: { ...levelSlo, [activeId]: draft } });
    setRemovedDbIds([]);
    toast('Assessment points saved!', 'success');
  };
  const copyFromPrevious = async () => {
    if (!prevLevel) return;
    const hasExisting = Object.values(levelSlo).some(list => list?.length);
    if (hasExisting && !window.confirm(`Copy every learning area's SLOs from "${prevLevel.name}" into "${activeLevelObj.name}"? This replaces everything currently set up for ${activeLevelObj.name}.`)) return;
    const fresh = await preschoolService.copyLevelSlo(prevLevel.id, activeLevel);
    onSaved(fresh);
    toast(`Copied all SLOs from ${prevLevel.name}!`, 'success');
  };

  return (
    <div className="rs-card">
      <div className="rs-card-head">
        <div className="rs-card-icon"><i className="fa-solid fa-list-check"></i></div>
        <div style={{ flex: 1 }}>
          <div className="rs-card-title">SLO / Activity-Based Assessment</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>Pick a class level, then a learning area, and add the assessment statements teachers rate against.</div>
        </div>
        {prevLevel && (
          <Tooltip text={`Copy every learning area's SLOs from ${prevLevel.name}`}>
            <button type="button" className="acc-link-btn" onClick={copyFromPrevious}>
              <i className="fa-solid fa-clone"></i> Copy from {prevLevel.name}
            </button>
          </Tooltip>
        )}
      </div>
      <div style={{ padding: '16px 20px' }}>
        <div className="rs-l2-tabs" style={{ marginBottom: 14 }}>
          {pLevels.map(lvl => (
            <button key={lvl.id} className={`rs-l2-tab${activeLevel === lvl.id ? ' active' : ''}`} onClick={() => setPActiveLevel(lvl.id)}>{lvl.name}</button>
          ))}
        </div>
        <div className="exam-term-chips" style={{ marginBottom: 14 }}>
          {pLearningAreas.map(la => (
            <button key={la.id} className={`exam-term-chip${activeId === la.id ? ' active' : ''}`} onClick={() => setPActiveLA(la.id)}>{la.name}</button>
          ))}
        </div>
        {draft.map(s => (
          <div key={s.id} className="pms-list-row">
            <i className="fa-solid fa-circle-dot" style={{ color: '#1E40AF', fontSize: 6, width: 16, flexShrink: 0 }}></i>
            <input className="rs-input" value={s.text} onChange={e => change(s.id, e.target.value)} />
            <Tooltip text="Remove"><button type="button" className="exam-del-btn" onClick={() => remove(s.id)}><i className="fa-solid fa-trash-can"></i></button></Tooltip>
          </div>
        ))}
        {draft.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>No assessment points yet for this learning area.</div>}
        <div className="pms-add-row">
          <input className="rs-input" placeholder="e.g. Counts objects with one-to-one correspondence" value={newText} onChange={e => setNewText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} />
          <button type="button" className="exam-add-btn" onClick={add}><i className="fa-solid fa-plus"></i> Add</button>
        </div>
        <div className="pms-save-row">
          <button type="button" className="exam-submit-btn" onClick={save}><i className="fa-solid fa-floppy-disk"></i> Save Changes</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PreschoolResultSetup — the two Preschool sub-screens (Setup / Result
   Card Options), mirroring the Grade 1-12 rsL2 pair exactly.
   ═══════════════════════════════════════════════════════════════════ */
function PreschoolResultSetup({
  pRsL2, setPRsL2,
  pLearningAreas, setPLearningAreas,
  pGradingScale, setPGradingScale,
  pSlo, setPSlo,
  pLevels, pActiveLevel, setPActiveLevel,
  pActiveLA, setPActiveLA,
  pPsdFields, setPPsdFields,
  pRco, setPRco,
  pReportType, setPReportType,   // ← NAYI LINE
  rsSigs,
  setPPreviewId,
  pHelpOpen, setPHelpOpen,
  toast,
}) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 4 }}>
        <div className="rs-l2-tabs">
          <button className={`rs-l2-tab${pRsL2 === 'setup' ? ' active' : ''}`} onClick={() => setPRsL2('setup')}>Result Setup</button>
          <button className={`rs-l2-tab${pRsL2 === 'cardoptions' ? ' active' : ''}`} onClick={() => setPRsL2('cardoptions')}>Result Card Options</button>
        </div>
        <button type="button" className="acc-link-btn" onClick={() => setPHelpOpen(true)}>
          <i className="fa-solid fa-circle-question"></i> What is Preschool Assessment?
        </button>
      </div>
      {pHelpOpen && <PreschoolHelpModal onClose={() => setPHelpOpen(false)} />}

      {pRsL2 === 'setup' && (
        <>
          <div style={{ display: 'flex', gap: 10, padding: '11px 14px', background: 'rgba(30,64,175,.08)', border: '1px solid rgba(30,64,175,.2)', borderRadius: 10, marginBottom: 16 }}>
            <i className="fa-solid fa-circle-info" style={{ color: '#1E40AF', fontSize: 13, marginTop: 1, flexShrink: 0 }}></i>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
              How to create a Montessori Result: configure Learning Areas and the Grading Scale below, add SLO statements per area, then head to <strong>Single Assessment Result → Preschool Montessori</strong> to assign an assessment to a class and enter student performance.
            </div>
          </div>

          <PEditableListCard
            icon="fa-book-open" title="Learning Areas / Subjects"
            sub="The subjects children are assessed in — reorder-free list, add or remove as needed."
            items={pLearningAreas} onSaved={setPLearningAreas}
            service={preschoolService.saveLearningAreas} toast={toast} showIcons
          />
          <PGradingScaleCard gradingScale={pGradingScale} onSaved={setPGradingScale} toast={toast} />
          <PSloCard pLevels={pLevels} pActiveLevel={pActiveLevel} setPActiveLevel={setPActiveLevel} pLearningAreas={pLearningAreas} pSlo={pSlo} pActiveLA={pActiveLA} setPActiveLA={setPActiveLA} onSaved={setPSlo} toast={toast} />
          <PEditableListCard
            icon="fa-people-arrows" title="Personal &amp; Social Development Fields"
            sub="Configurable behaviour/development fields shown on every Preschool report card."
            items={pPsdFields} onSaved={setPPsdFields}
            service={preschoolService.savePsdFields} toast={toast}
          />

          <div className="rs-card">
            <div className="rs-card-head">
              <div className="rs-card-icon"><i className="fa-solid fa-signature"></i></div>
              <div style={{ flex: 1 }}>
                <div className="rs-card-title">Signatures</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>Preschool report cards use the same school signatures as Grade 1-12.</div>
              </div>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {(rsSigs || []).map(s => (
                <div key={s.id} style={{ padding: '8px 14px', border: '1.5px solid var(--border-light)', borderRadius: 10, fontSize: 12 }}>
                  <b>{s.name}</b><span style={{ color: 'var(--text-muted)' }}> · {s.desig}</span>
                </div>
              ))}
              {(!rsSigs || rsSigs.length === 0) && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No signatures configured yet.</div>}
            </div>
          </div>
        </>
      )}

      {pRsL2 === 'cardoptions' && (
        <>
          <div className="rct-grid">
            {P_TEMPLATES.map(t => (
              <div
                key={t.id}
                className="rct-card"
                style={{
                  '--rct-accent': t.accent, '--rct-accent-light': `${t.accent}22`, '--rct-accent-bg': `${t.accent}14`,
                  cursor: 'pointer',
                  border: pReportType === t.id ? `2px solid ${t.accent}` : '2px solid transparent',
                  borderRadius: 12,
                }}
                onClick={() => setPReportType(t.id)}
              >
                <div className="rct-preview"><PreschoolTemplateHero id={t.id} /></div>
                <div className="rct-body">
                  <div className="rct-title-row">
                    <div className="rct-title">{t.name}</div>
                    {pReportType === t.id && (
                      <span style={{ fontSize: 10, fontWeight: 800, color: t.accent, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <i className="fa-solid fa-circle-check"></i> Selected
                      </span>
                    )}
                  </div>
                  <div className="rct-desc">{t.desc}</div>
                  <Tooltip text="Preview this Preschool report">
                    <button
                      type="button" className="rct-preview-btn"
                      onClick={e => { e.stopPropagation(); setPPreviewId(t.id); }}
                    >
                      <i className="fa-solid fa-eye"></i> Preview
                    </button>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>

          <div className="rs-card" style={{ marginTop: 16 }}>
            <div className="rs-card-head">
              <div className="rs-card-icon"><i className="fa-solid fa-sliders"></i></div>
              <div style={{ flex: 1 }}>
                <div className="rs-card-title">Visibility Options</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>Choose what appears on the generated Preschool report card.</div>
              </div>
            </div>
            <div style={{ padding: '18px 20px' }}>
              <div className="rco-grid">
                {pRco.map((item, idx) => (
                  <div key={item.label} className="rco-row">
                    <span className="rco-row-lbl">
                      <i className={`fa-solid ${item.icon}`} style={{ color: '#1E40AF', width: 14 }}></i>
                      {item.label}
                    </span>
                    <Tooltip text={item.on ? `Hide "${item.label}" on report card` : `Show "${item.label}" on report card`}>
                      <button
                        className={`rco-toggle${item.on ? ' on' : ''}`}
                        onClick={() => setPRco(g => g.map((it, i) => (i === idx ? { ...it, on: !it.on } : it)))}
                        aria-pressed={item.on}
                      >
                        <span className="rco-dot"></span>
                      </button>
                    </Tooltip>
                  </div>
                ))}
              </div>
              <div className="rco-foot">
                <div className="rco-foot-hint">
                  <i className="fa-solid fa-circle-info" style={{ color: '#1E40AF', marginRight: 5 }}></i>
                  Applies to Monthly, Term &amp; Annual Preschool report cards.
                </div>
                <button className="rco-save-btn" onClick={async () => { await preschoolService.savePRco(pRco, pReportType); toast('Preferences saved!', 'success'); }}>
                  <i className="fa-solid fa-floppy-disk"></i> Save Preferences
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PreschoolAssessmentModal — E/M/A/NY entry, mirrors
   ResultUpdateMarksModal's structure (subject/area tabs strip + a
   per-item picker + footer Save & Next / Save & Close). Attendance is
   read-only (auto-fetched from the same student record the Grade
   1-12 system already carries, pAutoAttendance) — teachers only add
   the free-text Observation Remarks. ────────────────────────────── */
function PreschoolAssessmentModal({ assessment, cls, student, existing, pLearningAreas, pSlo, pGradingScale, pPsdFields, allClasses, onClose, onSave, toast }) {
  const areaTabs = [...pLearningAreas.map(la => ({ id: la.id, label: la.name })), { id: '__psd', label: 'Personal & Social Dev.' }, { id: '__meta', label: 'Attendance, Remarks & PTM' }];
  const [tabIdx, setTabIdx] = useState(0);
  const [achievements, setAchievements] = useState(existing?.achievements || {});
  const [psd, setPsd] = useState(existing?.psd || {});
  const autoAttendance = pAutoAttendance(student);
  const [attendanceMode, setAttendanceMode] = useState(existing?.attendance?.mode === 'manual' ? 'manual' : 'auto'); // 'auto' | 'manual'
  const [manualAttendance, setManualAttendance] = useState({
    workingDays: existing?.attendance?.workingDays ?? autoAttendance.workingDays,
    presentDays: existing?.attendance?.presentDays ?? autoAttendance.presentDays,
  });
  const attendance = attendanceMode === 'manual'
    ? { mode: 'manual', workingDays: manualAttendance.workingDays, presentDays: manualAttendance.presentDays, pct: manualAttendance.workingDays ? Math.round((manualAttendance.presentDays / manualAttendance.workingDays) * 100) : 0 }
    : { mode: 'auto', ...autoAttendance };
  const [teacherRemarks, setTeacherRemarks] = useState(existing?.teacherRemarks || '');
  const [finalRemarks, setFinalRemarks] = useState(existing?.finalRemarks || pGetFinalRemarks(pGradingScale, existing) || '');
  const [ptm, setPtm] = useState(existing?.ptm || { enabled: false, date: '', parentAttendance: false, parentComments: '', teacherComments: '' });
  const [promotion, setPromotion] = useState(existing?.promotion || { status: null, toClass: '' }); // status: null | 'retained' | 'promoted' — null = "unselected", hidden from the result card

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
const [sloDbIds, setSloDbIds] = useState({});   // { [laId]: { [sloId]: realDbRowId } }
  const [sloSaving, setSloSaving] = useState({});  // { 'laId_sloId': true } jab tak save ho raha ho

  // Modal khulte hi is student ki asal (real API) SLO ratings load karo —
  // taake pehle se save hui selection buttons par highlighted dikhe.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const map = await preschoolService.getStudentSloAssessments({
          gradeId: cls.classID, sectionId: cls.sectionID, studentId: student.id,
        });
        if (cancelled) return;
        setAchievements(prev => {
          const next = { ...prev };
          Object.keys(map).forEach(laId => {
            next[laId] = { ...(next[laId] || {}) };
            Object.keys(map[laId]).forEach(sloId => {
              if (next[laId][sloId] == null) next[laId][sloId] = map[laId][sloId].code;
            });
          });
          return next;
        });
        setSloDbIds(prev => {
          const next = { ...prev };
          Object.keys(map).forEach(laId => {
            next[laId] = { ...(next[laId] || {}) };
            Object.keys(map[laId]).forEach(sloId => { next[laId][sloId] = map[laId][sloId].id; });
          });
          return next;
        });
      } catch (e) {
        console.error('Could not load existing SLO assessments:', e);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeTab = areaTabs[tabIdx];
  const setPsdCode = (fieldId, code) => setPsd(p => ({ ...p, [fieldId]: code }));
   const setSlo = (laId, sloId, code) => {
    setAchievements(a => ({ ...a, [laId]: { ...(a[laId] || {}), [sloId]: code } }));

    // Agar Learning Area / SLO abhi tak backend par save hi nahi hua (local-only
    // id jaisa "la_171234"), to real DB id nahi milegi — asli assessment API
    // call skip kar do (warna galat subjectId/sloId=0 save ho jayega).
    const subIdNum = Number(laId);
    const sloIdNum = Number(sloId);
    if (Number.isNaN(subIdNum) || Number.isNaN(sloIdNum)) return;

    const rowId = sloDbIds[laId]?.[sloId] || 0;
    const key = `${laId}_${sloId}`;
    setSloSaving(s => ({ ...s, [key]: true }));
    preschoolService.saveSloAssessment({
      id: rowId,
      gradeId: cls.classID, sectionId: cls.sectionID, studentId: student.id,
      preSubjectId: subIdNum, preSLOId: sloIdNum, code,
    }).then(newId => {
      if (!rowId && newId) setSloDbIds(prev => ({ ...prev, [laId]: { ...(prev[laId] || {}), [sloId]: newId } }));
    }).catch(e => {
      console.error('Could not save SLO assessment:', e);
      toast('Could not save this rating — please try again', 'error');
    }).finally(() => {
      setSloSaving(s => { const n = { ...s }; delete n[key]; return n; });
    });
  };

  const buildPayload = () => ({ achievements, psd, attendance, teacherRemarks, finalRemarks, ptm, promotion });
  /* shouldClose lets the footer tell onSave whether this was "Save & Next"
     (stay open, just move tabs) or "Save & Close" (dismiss the modal) —
     previously both used the same onSave and it always closed, so
     "Save & Next" incorrectly closed the modal too. */
  const saveAndNext = () => { onSave(buildPayload(), false); if (tabIdx < areaTabs.length - 1) setTabIdx(tabIdx + 1); };
  const saveAndClose = () => onSave(buildPayload(), true);

  return createPortal(
    <div className="exam-modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="exam-modal" style={{ maxWidth: 760 }}>
        <div className="exam-modal-header">
          <div className="exam-modal-header-left">
            <div className="exam-modal-header-icon"><i className="fa-solid fa-shapes"></i></div>
            <div>
              <div className="exam-modal-title">{student.name}</div>
              <div className="exam-modal-sub">{cls.cls} - {cls.sec} · {assessment.name} ({assessment.label})</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="exam-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>
        <div className="exam-modal-body">
          <div className="syl-subj-tabs">
            {areaTabs.map((t, i) => (
              <button key={t.id} type="button" className={`syl-subj-tab${tabIdx === i ? ' active' : ''}`} onClick={() => setTabIdx(i)}>{t.label}</button>
            ))}
          </div>

          {activeTab.id === '__meta' ? (
            <>
              <div className="rs-field-row">
                <label className="rs-field-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  Attendance
                  <div className="exam-term-chips" style={{ marginBottom: 0 }}>
                    <button type="button" className={`exam-term-chip${attendanceMode === 'auto' ? ' active' : ''}`} onClick={() => setAttendanceMode('auto')}>
                      <i className="fa-solid fa-arrows-rotate" style={{ marginRight: 6 }}></i> System Fetch
                    </button>
                    <button type="button" className={`exam-term-chip${attendanceMode === 'manual' ? ' active' : ''}`} onClick={() => setAttendanceMode('manual')}>
                      <i className="fa-solid fa-pen" style={{ marginRight: 6 }}></i> Manual Entry
                    </button>
                  </div>
                </label>
                {attendanceMode === 'auto' ? (
                  <>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 8 }}>Auto-fetched from attendance records</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <div className="pms-auto-stat"><span>{attendance.workingDays}</span>Working Days</div>
                      <div className="pms-auto-stat"><span>{attendance.presentDays}</span>Present Days</div>
                      <div className="pms-auto-stat"><span>{attendance.pct}%</span>Attendance</div>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 140 }}>
                      <label className="rs-field-label" style={{ fontWeight: 600, fontSize: 10.5 }}>Working Days</label>
                      <input type="number" min="0" className="rs-input" value={manualAttendance.workingDays} onChange={e => setManualAttendance(a => ({ ...a, workingDays: Math.max(0, +e.target.value || 0) }))} />
                    </div>
                    <div style={{ minWidth: 140 }}>
                      <label className="rs-field-label" style={{ fontWeight: 600, fontSize: 10.5 }}>Present Days</label>
                      <input type="number" min="0" className="rs-input" value={manualAttendance.presentDays} onChange={e => setManualAttendance(a => ({ ...a, presentDays: Math.max(0, +e.target.value || 0) }))} />
                    </div>
                    <div className="pms-auto-stat" style={{ alignSelf: 'flex-end' }}><span>{attendance.pct}%</span>Attendance</div>
                  </div>
                )}
              </div>
              <div className="rs-field-row">
                <label className="rs-field-label">Teacher Observation Remarks</label>
                <CharField value={teacherRemarks} max={300} multiline placeholder="Share how this child is progressing…" onChange={setTeacherRemarks} toast={toast} />
              </div>
              <div className="rs-field-row">
                <label className="rs-field-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  Final Remarks
                  <Tooltip text="Fill in the summary based on this child's current ratings">
                    <button type="button" className="acc-link-btn" style={{ fontSize: 10.5 }} onClick={() => setFinalRemarks(pGetFinalRemarks(pGradingScale, { achievements, psd }))}>
                      <i className="fa-solid fa-wand-magic-sparkles"></i> Suggest
                    </button>
                  </Tooltip>
                </label>
                <CharField value={finalRemarks} max={250} multiline placeholder="Overall summary remark for this assessment…" onChange={setFinalRemarks} toast={toast} />
              </div>
              <div className="rs-card" style={{ marginTop: 4 }}>
                <div className="rs-card-head">
                  <div className="rs-card-icon"><i className="fa-solid fa-handshake"></i></div>
                  <div className="rs-card-title" style={{ flex: 1 }}>Parent Teacher Meeting <span style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-muted)' }}>(optional)</span></div>
                  <Tooltip text={ptm.enabled ? 'This section will print on the result card' : 'This section will be hidden from the result card'}>
                    <button type="button" className={`rco-toggle${ptm.enabled ? ' on' : ''}`} onClick={() => setPtm(p => ({ ...p, enabled: !p.enabled }))} aria-pressed={ptm.enabled}>
                      <span className="rco-dot"></span>
                    </button>
                  </Tooltip>
                </div>
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <i className="fa-solid fa-circle-info"></i>
                    {ptm.enabled ? 'Included on the result card.' : 'Not included on the result card — switch on above to show it.'}
                  </div>
                  <div className="rs-field-row">
                    <label className="rs-field-label">Meeting Date</label>
                    <input type="date" className="rs-input" value={ptm.date || ''} onChange={e => setPtm(p => ({ ...p, date: e.target.value }))} />
                  </div>
                  <div className="rs-field-row">
                    <label className="rs-field-label">Parent Attendance</label>
                    <button type="button" className={`rco-toggle${ptm.parentAttendance ? ' on' : ''}`} onClick={() => setPtm(p => ({ ...p, parentAttendance: !p.parentAttendance }))} aria-pressed={ptm.parentAttendance}>
                      <span className="rco-dot"></span>
                    </button>
                  </div>
                  <div className="rs-field-row">
                    <label className="rs-field-label">Parent Comments</label>
                    <CharField value={ptm.parentComments} max={200} multiline placeholder="Parent's comments during the meeting…" onChange={v => setPtm(p => ({ ...p, parentComments: v }))} toast={toast} />
                  </div>
                  <div className="rs-field-row">
                    <label className="rs-field-label">Teacher Comments</label>
                    <CharField value={ptm.teacherComments} max={200} multiline placeholder="Teacher's comments during the meeting…" onChange={v => setPtm(p => ({ ...p, teacherComments: v }))} toast={toast} />
                  </div>
                </div>
              </div>

              <div className="rs-card" style={{ marginTop: 4 }}>
                <div className="rs-card-head">
                  <div className="rs-card-icon"><i className="fa-solid fa-route"></i></div>
                  <div className="rs-card-title" style={{ flex: 1 }}>Promotion Decision <span style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-muted)' }}>(optional)</span></div>
                </div>
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <i className="fa-solid fa-circle-info"></i>
                    {promotion.status ? 'Included on the result card.' : 'Not set — hidden from the result card until a decision is chosen below.'}
                  </div>
                  <div className="exam-term-chips" style={{ marginBottom: 0 }}>
                    <button type="button" className={`exam-term-chip${!promotion.status ? ' active' : ''}`} onClick={() => setPromotion({ status: null, toClass: '' })}>
                      <i className="fa-solid fa-ban" style={{ marginRight: 6 }}></i> Not Set
                    </button>
                    <button type="button" className={`exam-term-chip${promotion.status === 'retained' ? ' active' : ''}`} onClick={() => setPromotion({ status: 'retained', toClass: '' })}>
                      <i className="fa-solid fa-rotate-left" style={{ marginRight: 6 }}></i> Retained
                    </button>
                    <button type="button" className={`exam-term-chip${promotion.status === 'promoted' ? ' active' : ''}`} onClick={() => setPromotion(p => ({ status: 'promoted', toClass: p.toClass || '' }))}>
                      <i className="fa-solid fa-arrow-up-right-from-square" style={{ marginRight: 6 }}></i> Promoted
                    </button>
                  </div>
                  {promotion.status === 'promoted' && (
                    <div className="rs-field-row">
                      <label className="rs-field-label">Promote To</label>
                      <select className="rs-input" value={promotion.toClass} onChange={e => setPromotion(p => ({ ...p, toClass: e.target.value }))}>
                        <option value="">Select class…</option>
                        {(allClasses || []).filter(c => c !== cls.cls).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}
                  {promotion.status === 'retained' && (
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Will remain in <strong>{cls.cls} - {cls.sec}</strong> next session.</div>
                  )}
                </div>
              </div>
            </>
          ) : activeTab.id === '__psd' ? (
            <div className="pms-slo-list">
              {pPsdFields.map(f => (
                <div key={f.id} className="pms-slo-row">
                  <span className="pms-slo-text">{f.label}</span>
                  <div className="pms-grade-picker">
                    {pGradingScale.map(g => (
                      <button key={g.code} type="button" className={`pms-grade-btn${psd[f.id] === g.code ? ' active' : ''}`} style={{ '--g-color': g.color }} onClick={() => setPsdCode(f.id, g.code)}>
                        {g.code}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ):(
            <div className="pms-slo-list">
              {(pSlo[activeTab.id] || []).map(s => (
                <div key={s.id} className="pms-slo-row">
                  <span className="pms-slo-text">{s.text}</span>
                  <div className="pms-grade-picker">
                    {pGradingScale.map(g => (
  <button
    key={g.code}
    type="button"
    className={`pms-grade-btn${achievements[activeTab.id]?.[s.id] === g.code ? ' active' : ''}`}
    style={{ '--g-color': g.color }}
    disabled={!!sloSaving[`${activeTab.id}_${s.id}`]}
    onClick={() => setSlo(activeTab.id, s.id, g.code)}
  >
    {g.code}
  </button>
))}
                  </div>
                </div>
              ))}
              {(!pSlo[activeTab.id] || pSlo[activeTab.id].length === 0) && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20, fontSize: 12.5 }}>No assessment points configured for this learning area yet.</div>
              )}
            </div>
          )}

          <div className="pms-grading-legend">
            {pGradingScale.map(g => (
              <span key={g.code}><span className="rs-grade-chip" style={{ background: g.color }}>{g.code}</span> {g.label}{g.range ? ` (${g.range})` : ''}</span>
            ))}
          </div>
        </div>
        <div className="exam-modal-footer">
          <button className="exam-cancel-btn" onClick={onClose}>Cancel</button>
          {tabIdx < areaTabs.length - 1 && (
            <button className="exam-cancel-btn" onClick={saveAndNext}>Save &amp; Next <i className="fa-solid fa-arrow-right"></i></button>
          )}
          <button className="exam-submit-btn" onClick={saveAndClose}><i className="fa-solid fa-floppy-disk"></i> Save &amp; Close</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function pAgeFromDob(dob) {
  if (!dob) return '—';
  const b = new Date(dob), n = new Date();
  let years = n.getFullYear() - b.getFullYear();
  const m = n.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < b.getDate())) years -= 1;
  return `${years} yrs`;
}

/* ═══════════════════════════════════════════════════════════════════
   PreschoolResultCard — the one shared render for all 3 report
   "templates" (Monthly / Term / Annual). They differ only in period
   scope/label, not in visual structure, per the brief — a single
   variant-aware component instead of 3 near-duplicate ones. Plain
   JSX, inline-styled (same convention as ClassicResultCard etc.) so
   PreschoolResultCardViewer.printPdf() can serialise it the same way.
   ═══════════════════════════════════════════════════════════════════ */
function PreschoolResultCard({ variant = 'monthly', pRco, sigs, student = SAMPLE_P_STUDENT, cls = SAMPLE_P_CLS, ad = SAMPLE_P_AD, la, slo, gradingScale, psdFields, assessment = SAMPLE_P_ASSESSMENT, previous = null }) {
  const opt = {};
  (pRco || []).forEach(o => { opt[o.label] = o.on; });
  const t = P_TEMPLATES.find(x => x.id === variant) || P_TEMPLATES[0];
  const counts = pAchievementCounts(gradingScale, ad);
  const totalRated = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const attPct = ad.attendance?.workingDays ? Math.round((ad.attendance.presentDays / ad.attendance.workingDays) * 100) : 0;
  const overall = pOverallPerformance(gradingScale, ad);
  const overallInfo = overall.code ? pGradeInfo(gradingScale, overall.code) : null;
  const delta = previous ? overall.pct - previous.pct : null;

  const accentBg = `${t.accent}0D`;
  const accentBdr = `${t.accent}33`;
  const textMut = '#64748B';
  const rowAlt = '#F8FAFF';

  // Document-style section heading — accent bar + icon + uppercase label,
  // matching the shared report vocabulary used across the ERP's other
  // result cards (ClassicResultCard, rhBuildSingleCardReport).
  const SecHead = ({ icon, children, sub }) => (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 3, height: 12, borderRadius: 2, background: t.accent, flexShrink: 0 }} />
        <i className={`fa-solid ${icon}`} style={{ color: t.accent, fontSize: 11 }}></i>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '.5px' }}>{children}</span>
      </div>
      {sub && <div style={{ fontSize: 9.5, color: '#94A3B8', marginTop: 2, marginLeft: 21 }}>{sub}</div>}
    </div>
  );
  const gradeChip = code => {
    const g = pGradeInfo(gradingScale, code);
    return <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 24, padding: '2px 8px', borderRadius: 6, background: g.color, color: '#fff', fontSize: 10.5, fontWeight: 800, flexShrink: 0 }}>{g.code}</span>;
  };
  // Small circular progress ring for the one headline stat (Overall
  // Performance) — same 0-36-viewBox convention as the dashboard's
  // MiniRing. Everywhere else on the card uses flat div/CSS bars: a
  // bigger inline-SVG donut was tried and dropped elsewhere in this
  // app because it clipped in narrow card columns, so bars stay the
  // default for anything wider than a small badge.
  const Ring = ({ pct, color, size = 54 }) => {
    const c = Math.max(0, Math.min(100, pct));
    return (
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg viewBox="0 0 36 36" width={size} height={size}>
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E2E8F0" strokeWidth="3.5" />
          <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round"
            strokeDasharray={`${c}, 100`} transform="rotate(-90 18 18)" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 900, color }}>{c}%</div>
      </div>
    );
  };
  // Flat horizontal bar — the card's default "score at a glance" visual
  // (attendance %, per-learning-area strength, PSD summary), matching
  // the app's own established pi-bar-track/pi-bar-fill convention.
  const Bar = ({ pct, color }) => (
    <div style={{ height: 6, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, background: color, borderRadius: 3 }} />
    </div>
  );
  const scoreCol = pct => (pct >= 90 ? '#16A34A' : pct >= 75 ? '#1E40AF' : pct >= 50 ? '#D97706' : '#DC2626');

  return (
    <div style={{ background: '#fff', fontFamily: "'Plus Jakarta Sans','Segoe UI',Arial,sans-serif", color: '#0F172A', maxWidth: 700, margin: '0 auto', boxShadow: '0 4px 20px rgba(0,0,0,.08)' }}>
      {/* Header */}
      <div className="pms-card-head" style={{ background: `linear-gradient(135deg,${t.accent} 0%,${t.accent}CC 100%)`, color: '#fff', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {opt['Show School Logo'] && (
          <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(255,255,255,.2)', border: '1.5px solid rgba(255,255,255,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
            <i className="fa-solid fa-school"></i>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>The Oxford System, Lahore Campus</div>
          <div style={{ fontSize: 10.5, opacity: 0.8, marginTop: 2 }}>{t.name} · {assessment.label}</div>
        </div>
        {opt['Show Student Photo'] && (
          <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(255,255,255,.2)', border: '2px solid rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, flexShrink: 0 }}>
            {(student.name || '').split(' ').map(w => w[0]).slice(0, 2).join('')}
          </div>
        )}
      </div>
      <div style={{ height: 3, background: `linear-gradient(90deg,${t.accent},${t.accent}88,${t.accent}33)` }} />

      {/* Student info strip */}
      <div style={{ padding: '9px 18px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px 14px', borderBottom: `1px solid ${accentBdr}`, background: accentBg }}>
        {[
          ['Student Name', student.name], ['Father Name', student.father],
          ['Roll Number', student.rollNo], ['Class / Section', `${cls.cls} - ${cls.sec}`],
          ['Admission No', student.admissionNo || '—'], ['Date of Birth', `${student.dob || '—'}${student.dob ? ` (${pAgeFromDob(student.dob)})` : ''}`],
          ['Teacher', student.teacher || '—'], ['Campus', student.campus || '—'],
        ].map(([l, v]) => (
          <div key={l}>
            <div style={{ fontSize: 8, fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '.4px' }}>{l}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '14px 18px' }}>
        {/* Overall Performance — indicative grade + percentage summary, with
            a comparison against the child's last Preschool assessment. */}
        {opt['Show Overall Performance Summary'] && overallInfo && (
          <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: accentBg, border: `1px solid ${accentBdr}`, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Ring pct={overall.pct} color={overallInfo.color} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 22, padding: '2px 7px', borderRadius: 6, background: overallInfo.color, color: '#fff', fontSize: 11.5, fontWeight: 800 }}>{overallInfo.code}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: '#0F172A' }}>{overallInfo.label}</span>
                </div>
                <div style={{ fontSize: 9.5, color: textMut, marginTop: 3 }}>Overall Performance</div>
              </div>
            </div>
            {previous && (
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 800, color: delta > 0 ? '#16A34A' : delta < 0 ? '#DC2626' : textMut }}>
                  <i className={`fa-solid ${delta > 0 ? 'fa-arrow-trend-up' : delta < 0 ? 'fa-arrow-trend-down' : 'fa-minus'}`}></i>
                  {delta > 0 ? `+${delta}` : delta}%
                </div>
                <div style={{ fontSize: 9, color: textMut, marginTop: 1 }}>vs {previous.examName} ({previous.pct}%)</div>
              </div>
            )}
          </div>
        )}

        {/* Grading Scale — always visible (not gated by any Result Card
            Options toggle) as a single compact legend row, so parents and
            teachers always know what each achievement level means. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 14px', padding: '7px 12px', marginBottom: 14, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8 }}>
          {(gradingScale || []).map(g => (
            <span key={g.code} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9.5, fontWeight: 600, color: '#475569' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 16, padding: '0 4px', borderRadius: 4, background: g.color, color: '#fff', fontSize: 8.5, fontWeight: 800 }}>{g.code}</span>
              {g.label}{g.range ? ` (${g.range})` : ''}
            </span>
          ))}
        </div>

        {/* Attendance Summary */}
        {opt['Show Attendance Summary'] && (
          <div style={{ marginBottom: 14 }}>
            <SecHead icon="fa-calendar-check" sub={ad.attendance?.mode === 'manual' ? 'Entered manually by teacher' : 'Auto-fetched from attendance records'}>Attendance Summary</SecHead>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
              {[['Working Days', ad.attendance?.workingDays ?? 0], ['Present Days', ad.attendance?.presentDays ?? 0], ['Attendance %', `${attPct}%`]].map(([l, v]) => (
                <div key={l} style={{ padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: t.accent }}>{v}</div>
                  <div style={{ fontSize: 9, color: textMut, marginTop: 1 }}>{l}</div>
                </div>
              ))}
            </div>
            <Bar pct={attPct} color={scoreCol(attPct)} />
          </div>
        )}

        {/* Performance Summary + chart */}
        {opt['Show Performance Chart'] && (
          <div style={{ marginBottom: 14 }}>
            <SecHead icon="fa-chart-pie">Performance Summary</SecHead>
            <div style={{ display: 'flex', borderRadius: 999, overflow: 'hidden', height: 10, marginBottom: 8 }}>
              {(gradingScale || []).map(g => (
                <div key={g.code} style={{ width: `${(counts[g.code] / totalRated) * 100}%`, background: g.color }} title={g.label}></div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {(gradingScale || []).map(g => (
                <div key={g.code} style={{ padding: '6px 8px', borderRadius: 7, background: `${g.color}14`, border: `1px solid ${g.color}33`, textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: g.color }}>{counts[g.code] || 0}</div>
                  <div style={{ fontSize: 8.5, color: textMut, marginTop: 1 }}>{g.code}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subject-wise Assessment */}
        {opt['Show Subject-wise Assessment'] && (la || []).some(area => ad.achievements?.[area.id] && Object.keys(ad.achievements[area.id]).length) && (
          <div style={{ marginBottom: 14 }}>
            <SecHead icon="fa-book">Subject-wise Assessment</SecHead>
            {(la || []).filter(area => ad.achievements?.[area.id] && Object.keys(ad.achievements[area.id]).length).map(area => {
              const stmts = (slo[area.id] || []).filter(s => ad.achievements[area.id][s.id]);
              const areaScore = pAreaScore(ad, area.id);
              return (
                <div key={area.id} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 800, color: t.accent, flexShrink: 0 }}>{area.name}</div>
                    {areaScore !== null && (
                      <>
                        <div style={{ flex: 1 }}><Bar pct={areaScore} color={scoreCol(areaScore)} /></div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: scoreCol(areaScore), flexShrink: 0, width: 30, textAlign: 'right' }}>{areaScore}%</div>
                      </>
                    )}
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E2E8F0', fontSize: 11 }}>
                    <tbody>
                      {stmts.map((s, i) => (
                        <tr key={s.id} style={{ background: i % 2 === 0 ? '#fff' : rowAlt }}>
                          <td style={{ padding: '6px 10px', borderBottom: i < stmts.length - 1 ? '1px solid #EEF2F6' : 'none', color: '#334155' }}>{s.text}</td>
                          <td style={{ padding: '6px 10px', borderBottom: i < stmts.length - 1 ? '1px solid #EEF2F6' : 'none', textAlign: 'right', width: 40 }}>{gradeChip(ad.achievements[area.id][s.id])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}

        {/* Personal & Social Development */}
        {opt['Show Personal & Social Development'] && (psdFields || []).some(f => ad.psd?.[f.id]) && (
          <div style={{ marginBottom: 14 }}>
            <SecHead icon="fa-people-arrows">Personal &amp; Social Development</SecHead>
            {pPsdScore(ad) !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ flex: 1 }}><Bar pct={pPsdScore(ad)} color={scoreCol(pPsdScore(ad))} /></div>
                <div style={{ fontSize: 10, fontWeight: 800, color: scoreCol(pPsdScore(ad)), flexShrink: 0, width: 30, textAlign: 'right' }}>{pPsdScore(ad)}%</div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[0, 1].map(col => {
                const fields = (psdFields || []).filter(f => ad.psd?.[f.id]);
                const half = Math.ceil(fields.length / 2);
                const colFields = col === 0 ? fields.slice(0, half) : fields.slice(half);
                return (
                  <table key={col} style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E2E8F0', fontSize: 11 }}>
                    <tbody>
                      {colFields.map((f, i) => (
                        <tr key={f.id} style={{ background: i % 2 === 0 ? '#fff' : rowAlt }}>
                          <td style={{ padding: '5px 9px', borderBottom: i < colFields.length - 1 ? '1px solid #EEF2F6' : 'none', color: '#334155' }}>{f.label}</td>
                          <td style={{ padding: '5px 9px', borderBottom: i < colFields.length - 1 ? '1px solid #EEF2F6' : 'none', textAlign: 'right', width: 40 }}>{gradeChip(ad.psd[f.id])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })}
            </div>
          </div>
        )}

        {/* Final Remarks — overall summary, mirrors the Grade 1-12
            percentage-band final remarks concept but achievement-based. */}
        {opt['Show Teacher Observation Remarks'] && ad.finalRemarks && (
          <div style={{ marginBottom: 14 }}>
            <SecHead icon="fa-star">Final Remarks</SecHead>
            <div style={{ padding: '10px 12px', background: accentBg, border: `1px solid ${accentBdr}`, borderRadius: 8, fontSize: 12, fontWeight: 600, lineHeight: 1.55, color: '#334155' }}>{ad.finalRemarks}</div>
          </div>
        )}

        {/* Teacher Observation Remarks */}
        {opt['Show Teacher Observation Remarks'] && ad.teacherRemarks && (
          <div style={{ marginBottom: 14 }}>
            <SecHead icon="fa-comment-dots">Teacher Observation Remarks</SecHead>
            <div style={{ padding: '10px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 11.5, lineHeight: 1.55, color: '#334155' }}>{ad.teacherRemarks}</div>
          </div>
        )}

        {/* Parent Teacher Meeting */}
        {opt['Show Parent Teacher Meeting Section'] && ad.ptm?.enabled && (
          <div style={{ marginBottom: 14 }}>
            <SecHead icon="fa-handshake">Parent Teacher Meeting</SecHead>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px', padding: '10px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 11 }}>
              <div><b>Meeting Date:</b> {ad.ptm.date || '—'}</div>
              <div><b>Parent Attendance:</b> {ad.ptm.parentAttendance ? 'Attended' : 'Did not attend'}</div>
              <div style={{ gridColumn: '1 / -1' }}><b>Parent Comments:</b> {ad.ptm.parentComments || '—'}</div>
              <div style={{ gridColumn: '1 / -1' }}><b>Teacher Comments:</b> {ad.ptm.teacherComments || '—'}</div>
            </div>
          </div>
        )}

        {/* Promotion / Retention Status — hidden entirely if the teacher
            left it "Not Set" for this student, regardless of the
            admin-wide toggle. */}
        {opt['Show Promotion / Retention Status'] && ad.promotion?.status && (
          <div style={{ marginBottom: 4 }}>
            <SecHead icon="fa-route">Promotion Status</SecHead>
            {ad.promotion.status === 'promoted' ? (
              <div style={{ padding: '9px 12px', background: 'rgba(22,163,74,.08)', border: '1px solid rgba(22,163,74,.25)', borderRadius: 8, fontSize: 11.5, color: '#16A34A', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}>
                <i className="fa-solid fa-arrow-up-right-from-square"></i> Promoted to {ad.promotion.toClass || '—'}
              </div>
            ) : (
              <div style={{ padding: '9px 12px', background: 'rgba(217,119,6,.08)', border: '1px solid rgba(217,119,6,.25)', borderRadius: 8, fontSize: 11.5, color: '#D97706', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}>
                <i className="fa-solid fa-rotate-left"></i> Retained in {cls.cls} - {cls.sec}
              </div>
            )}
          </div>
        )}

        {/* Signatures */}
        {sigs && sigs.length > 0 && (
          <div style={{ display: 'flex', gap: 18, marginTop: 20, paddingTop: 14, borderTop: '1px solid #E2E8F0' }}>
            {sigs.map(s => (
              <div key={s.id} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ borderBottom: '1.5px solid #94A3B8', height: 28 }}></div>
                <div style={{ fontSize: 10.5, fontWeight: 800, marginTop: 5 }}>{s.name}</div>
                <div style={{ fontSize: 9, color: textMut }}>{s.desig}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '8px 18px', background: accentBg, borderTop: `1px solid ${accentBdr}`, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: textMut, flexWrap: 'wrap', gap: 5 }}>
        <span>School Mentor ERP · Preschool / Montessori Result</span>
        <span>Confidential · The Oxford System, Lahore Campus</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PreschoolResultCardViewer — mirrors ResultCardViewer exactly
   (same live-DOM-innerHTML print approach, same A4 print CSS shell). ─
   ═══════════════════════════════════════════════════════════════════ */
/* Single source of truth for the print/PDF window shell around a
   rendered PreschoolResultCard — used both by the on-screen viewer's
   own PDF button AND by the Result History Download icon, so a
   downloaded report can never drift from what the preview shows. */
function pPrintPreschoolCard(html, studentName, toast) {
  const w = window.open('', '_blank', 'width=960,height=820');
  if (!w) { toast('Pop-up blocker prevented opening', 'error'); return false; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Preschool Result — ${studentName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#fff;font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;color:#0F172A}
@page{size:A4 portrait;margin:12mm}
@media print{ body{-webkit-print-color-adjust:exact;print-color-adjust:exact} .no-print{display:none!important} }
.wrap{width:100%;max-width:210mm;margin:0 auto}
.print-bar{text-align:center;padding:14px;background:#F8FAFF;border-top:1px solid #BFDBFE;margin-top:10px}
.print-bar button{background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;border:none;padding:10px 22px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;margin-right:8px}
.print-bar .close-btn{background:transparent;border:1.5px solid #CBD5E1;color:#64748B}
</style></head><body>
<div class="wrap">${html}</div>
<div class="print-bar no-print">
  <button onclick="window.print()">🖨 Save as PDF</button>
  <button class="close-btn" onclick="window.close()">Close</button>
</div>
</body></html>`);
  w.document.close();
  return true;
}

function PreschoolResultCardViewer({ assessment, cls, student, ad, template, pRco, pLearningAreas, pSlo, pGradingScale, pPsdFields, rsSigs, previous, onClose, toast }) {
  const cardRef = useRef(null);
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const t = P_TEMPLATES.find(x => x.id === template) || P_TEMPLATES[0];

  const printPdf = () => {
    const node = cardRef.current;
    if (!node) return;
    pPrintPreschoolCard(node.innerHTML, student.name, toast);
  };

  return createPortal(
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(10,22,40,.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 18, width: '100%', maxWidth: 820, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.4)', animation: 'fadeSlide .22s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-muted)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${t.accent}22`, color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
              <i className="fa-solid fa-id-card"></i>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Preschool Result — {student.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{t.name} · {assessment.name}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={printPdf} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 9, background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)', border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              <i className="fa-solid fa-file-pdf"></i> PDF
            </button>
            <button type="button" onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--border-light)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#F1F5F9' }}>
          <div ref={cardRef} style={{ maxWidth: 720, margin: '0 auto', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,.14)' }}>
            <PreschoolResultCard variant={template} pRco={pRco} sigs={rsSigs} student={student} cls={cls} ad={ad} la={pLearningAreas} slo={pSlo} gradingScale={pGradingScale} psdFields={pPsdFields} assessment={assessment} previous={previous} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PreschoolCardDownloader — the Result History Download icon's target.
   Renders the exact same <PreschoolResultCard> the "View" button shows
   (off-screen, never visible to the user) and immediately runs it
   through pPrintPreschoolCard — the SAME helper the on-screen viewer's
   own PDF button uses — so the downloaded report can never drift from
   the preview. One click, no intermediate picker, byte-for-byte match.
   ═══════════════════════════════════════════════════════════════════ */
function PreschoolCardDownloader({ assessment, cls, student, ad, template, pRco, pLearningAreas, pSlo, pGradingScale, pPsdFields, rsSigs, previous, onDone, toast }) {
  const cardRef = useRef(null);
  useEffect(() => {
    const node = cardRef.current;
    if (node) pPrintPreschoolCard(node.innerHTML, student.name, toast);
    onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div style={{ position: 'fixed', left: -99999, top: 0, width: 720 }} aria-hidden="true">
      <div ref={cardRef}>
        <PreschoolResultCard variant={template} pRco={pRco} sigs={rsSigs} student={student} cls={cls} ad={ad} la={pLearningAreas} slo={pSlo} gradingScale={pGradingScale} psdFields={pPsdFields} assessment={assessment} previous={previous} />
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PreschoolTemplatePreviewModal — mirrors TemplatePreviewModal, sample
   data (no real student picked yet). ────────────────────────────────
   ═══════════════════════════════════════════════════════════════════ */
function PreschoolTemplatePreviewModal({ templateId, pRco, pLearningAreas, pSlo, pGradingScale, pPsdFields, rsSigs, onClose, onSelect }) {
  const t = P_TEMPLATES.find(x => x.id === templateId);
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!t) return null;

  return createPortal(
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 9900, background: 'rgba(10,22,40,.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 18, width: '100%', maxWidth: 820, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.4)', animation: 'fadeSlide .22s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-muted)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${t.accent}22`, color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
              <i className="fa-solid fa-eye"></i>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{t.name} — Preview</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Sample data shown — select to use for real Preschool reports.</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => onSelect(t.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 9, background: t.accent, border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              <i className="fa-solid fa-check"></i> Select
            </button>
            <button type="button" onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--border-light)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#F1F5F9' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,.14)' }}>
            <PreschoolResultCard variant={t.id} pRco={pRco} sigs={rsSigs} la={pLearningAreas} slo={pSlo} gradingScale={pGradingScale} psdFields={pPsdFields} previous={SAMPLE_P_PREVIOUS} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Preschool Result History — mirrors the Grade 1-12 Result History tab
   (.rh-* CSS classes reused verbatim) but derived live from real
   pResultData/pClassTypes/resultData instead of a static seed array,
   since Preschool has no separate sample-history dataset: every
   assessed Preschool-toggled class row, across every exam, becomes one
   history record per student. ─────────────────────────────────────── */