import React, { useState } from 'react';

/* Examination → Reports. Six monitoring screens fed LIVE by
   services/examReportsService (every term's exams + per-class date sheet,
   syllabus and result upload status), merged with whatever the other tabs
   have just edited. Class rows are objects, keys are cls_|scls_|rcls_. */

const XR_TABS = [
  { id: 'dashboard', label: 'Dashboard Summary', icon: 'fa-gauge-high' },
  { id: 'overview', label: 'Exam Overview', icon: 'fa-list-check' },
  { id: 'datesheet', label: 'Date Sheet Status', icon: 'fa-calendar-days' },
  { id: 'syllabus', label: 'Syllabus Sharing', icon: 'fa-book-open' },
  { id: 'results', label: 'Result Upload Status', icon: 'fa-chart-bar' },
  { id: 'teacher', label: 'Teacher Pending Work', icon: 'fa-chalkboard-user' },
];
const XR_WORK_TYPES = [
  { id: '', label: 'Overall Pending Work' },
  { id: 'datesheet', label: 'Date Sheet Status' },
  { id: 'syllabus', label: 'Syllabus Status' },
  { id: 'results', label: 'Results Status' },
];

const xrToday = () => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

export function xrClassList(ex) {
  const raw = Array.isArray(ex?.classes) ? ex.classes : [];
  return raw.map((c, idx) => {
    if (c == null) return { idx, name: `Class ${idx + 1}`, classID: null, sectionID: null };
    if (typeof c === 'string') return { idx, name: c, classID: null, sectionID: null };
    const name = c.className
      || `${c.gradeName || ''}${c.sectionName ? ' - ' + c.sectionName : ''}`.trim()
      || `Class ${idx + 1}`;
    return { idx, name, classID: c.classID ?? null, sectionID: c.sectionID ?? null };
  });
}
export function xrExamTerm(ex) {
  return ex?.term || ex?.termName || '';
}
function xrHasContent(html) {
  return String(html || '').replace(/<[^>]+>/g, '').trim().length > 0;
}
function xrBag(store, examId) {
  return (store && examId != null && store[examId]) || {};
}
/* Date-sheet keys are cls_, syllabus scls_, results rcls_. `cls` must not match scls. */
function xrFindEntries(store, examId, prefix, cls) {
  const bag = xrBag(store, examId);
  const keys = Object.keys(bag);
  const hit = keys.find((k) => {
    if (!k.startsWith(`${prefix}_`)) return false;
    if (prefix === 'cls' && (k.startsWith('scls_') || k.startsWith('rcls_'))) return false;
    if (cls.sectionID != null && k.includes(`_${cls.sectionID}_`)) return true;
    return k.endsWith(`_${cls.idx}`);
  });
  if (!hit) return null;
  const rows = bag[hit];
  return Array.isArray(rows) ? rows : null;
}
function xrResultKey(ex, cls) {
  return `rcls_${ex.id}_${cls.sectionID}_${cls.idx}`;
}
function xrResultPack(packs, ex, cls) {
  if (!packs) return null;
  return packs[xrResultKey(ex, cls)] || null;
}
function xrStudentName(st) {
  return st?.name || st?.studentName || st?.StudentName || st?.fullName || '—';
}
function xrStudentRoll(st) {
  return st?.rollNo || st?.rollNumber || st?.registrationNumber || st?.RegistrationNumber || st?.grNo || '—';
}
function xrStudentId(st) {
  return st?.id ?? st?.studentID ?? st?.StudentID ?? st?.studentId;
}
/* A loaded Single Assessment pack: student has marks when the branch-sum list has a row. */
function xrMarksRow(pack, st) {
  const id = xrStudentId(st);
  if (id == null) return null;
  const rows = Array.isArray(pack?.marks) ? pack.marks : [];
  return rows.find((m) => {
    const mid = m?.studentID ?? m?.StudentID ?? m?.studentId;
    return mid != null && String(mid) === String(id);
  }) || null;
}
function xrObtained(m) {
  const obt = m?.obtainedMarks ?? m?.obtainMarks ?? m?.marks ?? m?.ObtainedMarks;
  return obt == null || obt === '' ? null : Number(obt);
}
function xrStudentUploaded(pack, st) {
  return xrObtained(xrMarksRow(pack, st)) != null;
}
function xrPackTotal(pack) {
  const subs = Array.isArray(pack?.subjects) ? pack.subjects : [];
  const sum = Number(subs[0]?.totalMarksSum ?? subs[0]?.TotalMarksSum);
  if (sum > 0) return sum;
  return subs.reduce((a, x) => a + (Number(x?.totalMarks ?? x?.TotalMarks) || 0), 0);
}
function xrTermNames(terms) {
  return terms.map((t) => t.term).filter(Boolean);
}
function xrInTerm(ex, term) {
  return !term || xrExamTerm(ex) === term;
}
function XrTermSelect({ terms, value, onChange }) {
  return (
    <div className="xr-field"><label>Term</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All Terms</option>
        {xrTermNames(terms).map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    </div>
  );
}

function xrDateSheetRow(ex, cls, dateSheets) {
  const entries = xrFindEntries(dateSheets, ex.id, 'cls', cls);
  if (entries == null) {
    return { class: cls.name, exam: ex.name, status: 'Not loaded', pct: 0, created: '—', subjectsList: '—', pendingList: '—', loaded: false };
  }
  const named = entries.filter((e) => e && e.subject);
  const covered = named.filter((e) => e.date);
  const pending = named.filter((e) => !e.date).map((e) => e.subject);
  const pct = named.length ? Math.round((covered.length / named.length) * 100) : 0;
  const status = named.length === 0 ? 'Pending' : pending.length === 0 ? 'Completed' : covered.length === 0 ? 'Pending' : 'Partial';
  const created = covered.map((e) => e.date).filter(Boolean).sort()[0] || '—';
  return {
    class: cls.name, exam: ex.name, status, pct, created, loaded: true,
    subjectsList: covered.map((e) => e.subject).join(', ') || '—',
    pendingList: named.length === 0 ? 'Date sheet not prepared' : (pending.join(', ') || 'None'),
  };
}
function xrSyllabusSubjects(ex, cls, syllabusData) {
  const entries = xrFindEntries(syllabusData, ex.id, 'scls', cls);
  if (entries == null) return null;
  return entries.filter((e) => e && e.subject).map((e) => ({
    subject: e.subject,
    uploaded: xrHasContent(e.content),
  }));
}

export default function ExaminationReportsTab({
  reportsSubTab, setReportsSubTab, exams = [], terms = [],
  dateSheets = {}, syllabusData = {}, resultPacks = {},
  loading = false, progress = null, loadedAt = null, onRefresh, onExport,
}) {
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <>
      <style>{XR_CSS}</style>
      <div className="xr-toolbar">
        <div className="xr-toolbar-info">
          {loading ? (
            <><i className="fa-solid fa-spinner fa-spin"></i> Loading live exam data{progress && progress.total ? ` — ${progress.done}/${progress.total} classes (${pct}%)` : '…'}</>
          ) : loadedAt ? (
            <><i className="fa-solid fa-circle-check"></i> Live data · {exams.length} exam{exams.length === 1 ? '' : 's'} across {terms.length} term{terms.length === 1 ? '' : 's'} · updated {loadedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</>
          ) : (
            <><i className="fa-solid fa-circle-info"></i> Waiting for terms…</>
          )}
        </div>
        {onRefresh && (
          <button type="button" className="xr-refresh" onClick={onRefresh} disabled={loading}>
            <i className={`fa-solid fa-rotate-right${loading ? ' fa-spin' : ''}`}></i> Refresh
          </button>
        )}
      </div>
      {loading && progress && progress.total > 0 && (
        <div className="xr-progress"><div className="xr-progress-fill" style={{ width: `${pct}%` }} /></div>
      )}
      <div className="xr-subtabs">
        {XR_TABS.map((t) => (
          <button key={t.id} type="button" className={`xr-stab${reportsSubTab === t.id ? ' active' : ''}`} onClick={() => setReportsSubTab(t.id)}>
            <i className={`fa-solid ${t.icon}`}></i> {t.label}
          </button>
        ))}
      </div>
      {reportsSubTab === 'dashboard' && (
        <XrDashboardSummary exams={exams} terms={terms} dateSheets={dateSheets} syllabusData={syllabusData} resultPacks={resultPacks} loading={loading} />
      )}
      {reportsSubTab === 'overview' && <XrExamOverview exams={exams} terms={terms} onExport={onExport} />}
      {reportsSubTab === 'datesheet' && <XrDateSheetStatus exams={exams} terms={terms} dateSheets={dateSheets} onExport={onExport} />}
      {reportsSubTab === 'syllabus' && <XrSyllabusSharing exams={exams} terms={terms} syllabusData={syllabusData} onExport={onExport} />}
      {reportsSubTab === 'results' && <XrResultUploadStatus exams={exams} terms={terms} resultPacks={resultPacks} loading={loading} onExport={onExport} />}
      {reportsSubTab === 'teacher' && (
        <XrTeacherPendingWork exams={exams} terms={terms} dateSheets={dateSheets} syllabusData={syllabusData} resultPacks={resultPacks} onExport={onExport} />
      )}
    </>
  );
}

function XrDashboardSummary({ exams: allExams, terms, dateSheets, syllabusData, resultPacks, loading }) {
  const [term, setTerm] = useState('');
  const exams = allExams.filter((e) => xrInTerm(e, term));
  const completedExams = exams.filter((ex) => ex._statusCls === 'past').length;
  let pendingDateSheetClasses = 0;
  let pendingSyllabusClasses = 0;
  let pendingResultStudents = 0;
  let uploadedResultStudents = 0;
  let resultClassesSeen = 0;
  let subjectsScheduled = 0;
  let subjectsDated = 0;

  exams.forEach((ex) => {
    xrClassList(ex).forEach((cls) => {
      const ds = xrDateSheetRow(ex, cls, dateSheets);
      if (ds.loaded && ds.status !== 'Completed') pendingDateSheetClasses += 1;
      const named = (xrFindEntries(dateSheets, ex.id, 'cls', cls) || []).filter((e) => e && e.subject);
      subjectsScheduled += named.length;
      subjectsDated += named.filter((e) => e.date).length;
      const subs = xrSyllabusSubjects(ex, cls, syllabusData);
      if (subs && subs.some((s) => !s.uploaded)) pendingSyllabusClasses += 1;
      const pack = xrResultPack(resultPacks, ex, cls);
      if (pack && Array.isArray(pack.students)) {
        resultClassesSeen += 1;
        const up = pack.students.filter((st) => xrStudentUploaded(pack, st)).length;
        uploadedResultStudents += up;
        pendingResultStudents += pack.students.length - up;
      }
    });
  });

  const cards = [
    { label: 'Total Exams', value: exams.length, icon: 'fa-file-pen', tone: 'blue' },
    { label: 'Completed Exams', value: completedExams, icon: 'fa-flag-checkered', tone: 'green' },
    { label: 'Date Sheets Pending', value: loading ? '…' : `${pendingDateSheetClasses} Class${pendingDateSheetClasses === 1 ? '' : 'es'}`, icon: 'fa-calendar-days', tone: 'amber' },
    { label: 'Syllabus Pending', value: loading ? '…' : `${pendingSyllabusClasses} Class${pendingSyllabusClasses === 1 ? '' : 'es'}`, icon: 'fa-book-open', tone: 'amber' },
    { label: 'Results Pending', value: loading && !resultClassesSeen ? '…' : resultClassesSeen ? `${pendingResultStudents} Student${pendingResultStudents === 1 ? '' : 's'}` : '—', icon: 'fa-chart-bar', tone: 'red' },
    { label: term ? 'Exam Classes In Term' : 'Exam Classes (All Terms)', value: exams.reduce((n, ex) => n + xrClassList(ex).length, 0), icon: 'fa-chalkboard-user', tone: 'blue' },
    { label: 'Date Sheet Coverage', value: subjectsScheduled ? `${Math.round((subjectsDated / subjectsScheduled) * 100)}%` : '—', icon: 'fa-clock', tone: 'green' },
    { label: 'Results Uploaded', value: resultClassesSeen ? `${uploadedResultStudents} / ${uploadedResultStudents + pendingResultStudents}` : '—', icon: 'fa-user-check', tone: 'green' },
    { label: 'Upcoming / Ongoing Exams', value: exams.filter((ex) => ex._statusCls && ex._statusCls !== 'past').length, icon: 'fa-hourglass-half', tone: 'amber' },
  ];

  return (
    <div className="section-card">
      <div className="xr-card-head">
        <div className="xr-card-title"><i className="fa-solid fa-gauge-high"></i> Examination Dashboard Summary</div>
      </div>
      <div className="xr-filter-bar">
        <XrTermSelect terms={terms} value={term} onChange={setTerm} />
      </div>
      <div className="xr-kpi-grid">
        {cards.map((c) => (
          <div key={c.label} className={`xr-kpi xr-kpi--${c.tone}`}>
            <div className="xr-kpi-ic"><i className={`fa-solid ${c.icon}`}></i></div>
            <div className="xr-kpi-val">{c.value}</div>
            <div className="xr-kpi-lbl">{c.label}</div>
          </div>
        ))}
      </div>
      <div className="xr-note"><i className="fa-solid fa-circle-info"></i> All counts come live from the exams, date sheets, syllabi and uploaded marks of every term in this session. Press Refresh after changes made on another device.</div>
    </div>
  );
}

function XrExamOverview({ exams, terms, onExport }) {
  const [term, setTerm] = useState('');
  const [examId, setExamId] = useState('');
  const termNames = terms.map((t) => t.term).filter(Boolean);

  const rows = exams
    .filter((e) => !term || xrExamTerm(e) === term)
    .filter((e) => !examId || String(e.id) === examId)
    .map((ex) => ({
      name: ex.name,
      from: ex._fromLabel || '—',
      to: ex._toLabel || '—',
      duration: ex._duration || '—',
      classes: xrClassList(ex).map((c) => c.name),
      status: ex._statusLabel || '—',
      statusCls: ex._statusCls || '',
    }));

  const exportSpec = () => ({
    title: 'Exam Overview Report',
    subtitle: term || 'All Terms',
    columns: [
      { key: 'name', label: 'Exam Name', width: '18%' },
      { key: 'from', label: 'Start Date', width: '12%', align: 'center' },
      { key: 'to', label: 'End Date', width: '12%', align: 'center' },
      { key: 'duration', label: 'Duration', width: '12%', align: 'center' },
      { key: 'classesLbl', label: 'Classes Included', width: '32%' },
      { key: 'status', label: 'Status', width: '14%', align: 'center' },
    ],
    rows: rows.map((r) => ({ ...r, classesLbl: r.classes.join(', ') })),
    filename: 'Exam-Overview-Report.xlsx',
    metaLine: `Term: ${term || 'All'}  ·  Exams: ${rows.length}`,
  });

  return (
    <div className="section-card">
      <div className="xr-card-head">
        <div className="xr-card-title"><i className="fa-solid fa-list-check"></i> Exam Overview Report</div>
        <button type="button" className="export-btn pdf" onClick={() => onExport(exportSpec())}><i className="fa-solid fa-download"></i> Export</button>
      </div>
      <div className="xr-filter-bar">
        <div className="xr-field"><label>Term</label>
          <select value={term} onChange={(e) => { setTerm(e.target.value); setExamId(''); }}>
            <option value="">All Terms</option>
            {termNames.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="xr-field"><label>Exam</label>
          <select value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">All Exams</option>
            {exams.filter((e) => !term || xrExamTerm(e) === term).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>
      <div className="xr-table-wrap">
        <table className="xr-table">
          <thead><tr>
            <th>Exam Name</th><th style={{ textAlign: 'center' }}>Start</th><th style={{ textAlign: 'center' }}>End</th>
            <th style={{ textAlign: 'center' }}>Duration</th><th>Classes Included</th><th style={{ textAlign: 'center' }}>Status</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={6} className="xr-empty">No exams match these filters.</td></tr> : rows.map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 700 }}>{r.name}</td>
                <td style={{ textAlign: 'center' }}>{r.from}</td>
                <td style={{ textAlign: 'center' }}>{r.to}</td>
                <td style={{ textAlign: 'center' }}>{r.duration}</td>
                <td><div className="xr-chip-wrap">{r.classes.map((c, ci) => <span key={ci} className="xr-chip">{c}</span>)}</div></td>
                <td style={{ textAlign: 'center' }}><span className={`exam-status-badge ${r.statusCls}`}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="xr-note"><i className="fa-solid fa-circle-info"></i> Generated {xrToday()}. Live list of exams across all terms of this session.</div>
    </div>
  );
}

function XrDateSheetStatus({ exams, terms, dateSheets, onExport }) {
  const [term, setTerm] = useState('');
  const [examId, setExamId] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const termNames = terms.map((t) => t.term).filter(Boolean);
  const filteredExams = exams.filter((e) => !term || xrExamTerm(e) === term).filter((e) => !examId || String(e.id) === examId);
  const allClassNames = Array.from(new Set(exams.flatMap((e) => xrClassList(e).map((c) => c.name))));

  const rows = [];
  filteredExams.forEach((ex) => {
    xrClassList(ex).forEach((cls) => {
      if (classFilter && cls.name !== classFilter) return;
      rows.push(xrDateSheetRow(ex, cls, dateSheets));
    });
  });

  const exportSpec = () => ({
    title: 'Date Sheet Status Report',
    subtitle: term || 'All Terms',
    columns: [
      { key: 'class', label: 'Class', width: '16%' },
      { key: 'exam', label: 'Exam', width: '18%' },
      { key: 'status', label: 'Status', width: '12%', align: 'center' },
      { key: 'created', label: 'First Date', width: '12%', align: 'center' },
      { key: 'subjectsList', label: 'Subjects Scheduled', width: '21%' },
      { key: 'pendingList', label: 'Pending Subjects', width: '21%' },
    ],
    rows,
    filename: 'Date-Sheet-Status-Report.xlsx',
    metaLine: `Term: ${term || 'All'}  ·  ${rows.length} class rows`,
  });

  return (
    <div className="section-card">
      <div className="xr-card-head">
        <div className="xr-card-title"><i className="fa-solid fa-calendar-days"></i> Date Sheet Status Report</div>
        <button type="button" className="export-btn pdf" onClick={() => onExport(exportSpec())}><i className="fa-solid fa-download"></i> Export</button>
      </div>
      <div className="xr-filter-bar">
        <div className="xr-field"><label>Term</label>
          <select value={term} onChange={(e) => { setTerm(e.target.value); setExamId(''); }}>
            <option value="">All Terms</option>{termNames.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="xr-field"><label>Exam</label>
          <select value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">All Exams</option>
            {exams.filter((e) => !term || xrExamTerm(e) === term).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div className="xr-field"><label>Class</label>
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="">All Classes</option>{allClassNames.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="xr-table-wrap">
        <table className="xr-table">
          <thead><tr>
            <th>Class</th><th>Exam</th><th style={{ textAlign: 'center' }}>Status</th><th style={{ textAlign: 'center' }}>First Date</th>
            <th>Subjects Scheduled</th><th>Pending Subjects</th><th style={{ textAlign: 'center', width: 90 }}>Completion</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={7} className="xr-empty">No classes match these filters.</td></tr> : rows.map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 700 }}>{r.class}</td>
                <td>{r.exam}</td>
                <td style={{ textAlign: 'center' }}><span className={`xr-status-pill ${String(r.status).toLowerCase().replace(' ', '-')}`}>{r.status}</span></td>
                <td style={{ textAlign: 'center' }}>{r.created}</td>
                <td style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{r.subjectsList}</td>
                <td style={{ fontSize: 11.5, color: r.pendingList === 'None' ? 'var(--text-muted)' : '#DC2626' }}>{r.pendingList}</td>
                <td>
                  <div className="xr-pct-bar"><div className="xr-pct-fill" style={{ width: `${r.pct}%` }} /></div>
                  <div style={{ fontSize: 10, textAlign: 'center', color: 'var(--text-muted)', marginTop: 2 }}>{r.loaded ? `${r.pct}%` : '—'}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="xr-note"><i className="fa-solid fa-circle-info"></i> Completion is the share of date-sheet subjects that already have a date. An empty sheet is Pending.</div>
    </div>
  );
}

function XrSyllabusSharing({ exams, terms, syllabusData, onExport }) {
  const [term, setTerm] = useState('');
  const [examId, setExamId] = useState('');
  const termNames = terms.map((t) => t.term).filter(Boolean);
  const filteredExams = exams.filter((e) => !term || xrExamTerm(e) === term).filter((e) => !examId || String(e.id) === examId);

  const classBlocks = [];
  filteredExams.forEach((ex) => {
    xrClassList(ex).forEach((cls) => {
      const subjects = xrSyllabusSubjects(ex, cls, syllabusData);
      const subjectRows = subjects || [];
      const uploadedCount = subjectRows.filter((r) => r.uploaded).length;
      classBlocks.push({
        blockKey: `${ex.id}-${cls.idx}-${cls.sectionID}`,
        class: cls.name,
        exam: ex.name,
        loaded: !!subjects,
        subjectRows,
        uploadedCount,
        total: subjectRows.length,
      });
    });
  });
  const flatRows = classBlocks.flatMap((b) => b.subjectRows.map((r) => ({ ...r, class: b.class, exam: b.exam, blockKey: b.blockKey })));
  const pendingByClass = {};
  flatRows.forEach((r) => { if (!r.uploaded) pendingByClass[r.class] = (pendingByClass[r.class] || 0) + 1; });

  const exportSpec = () => ({
    title: 'Syllabus Sharing Report',
    subtitle: term || 'All Terms',
    groupKey: 'blockKey',
    groupLabel: (r) => `${r.class}  ·  ${r.exam}`,
    columns: [
      { key: 'subject', label: 'Subject', width: '34%' },
      { key: 'uploadedLbl', label: 'Syllabus Uploaded', width: '33%', align: 'center' },
      { key: 'statusLbl', label: 'Status', width: '33%', align: 'center' },
    ],
    rows: flatRows.map((r) => ({ ...r, uploadedLbl: r.uploaded ? 'Yes' : 'No', statusLbl: r.uploaded ? 'Uploaded' : 'Pending' })),
    filename: 'Syllabus-Sharing-Report.xlsx',
    metaLine: `Term: ${term || 'All'}  ·  ${classBlocks.length} classes`,
  });

  return (
    <div className="section-card">
      <div className="xr-card-head">
        <div className="xr-card-title"><i className="fa-solid fa-book-open"></i> Syllabus Sharing Report</div>
        <button type="button" className="export-btn pdf" onClick={() => onExport(exportSpec())}><i className="fa-solid fa-download"></i> Export</button>
      </div>
      <div className="xr-filter-bar">
        <div className="xr-field"><label>Term</label>
          <select value={term} onChange={(e) => { setTerm(e.target.value); setExamId(''); }}>
            <option value="">All Terms</option>{termNames.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="xr-field"><label>Exam</label>
          <select value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">All Exams</option>
            {exams.filter((e) => !term || xrExamTerm(e) === term).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>
      {classBlocks.length === 0 ? (
        <div className="xr-empty">No classes match these filters.</div>
      ) : classBlocks.map((b) => (
        <div className="xr-class-block" key={b.blockKey}>
          <div className="xr-class-block-head">
            <div className="xr-class-block-name"><i className="fa-solid fa-chalkboard"></i> {b.class}</div>
            <div className="xr-class-block-meta">{b.exam}</div>
            <div className="xr-class-block-badge">{b.loaded ? `${b.uploadedCount}/${b.total} uploaded` : 'Not loaded'}</div>
          </div>
          {!b.loaded ? <div className="xr-empty">Syllabus has not loaded for this class yet.</div> : !b.subjectRows.length ? <div className="xr-empty">No syllabus subjects on file.</div> : (
            <table className="xr-table xr-table--nested">
              <thead><tr><th>Subject</th><th style={{ textAlign: 'center' }}>Syllabus</th></tr></thead>
              <tbody>
                {b.subjectRows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700 }}>{r.subject}</td>
                    <td style={{ textAlign: 'center' }}>{r.uploaded ? <span className="xr-status-pill completed"><i className="fa-solid fa-check"></i> Uploaded</span> : <span className="xr-status-pill pending">Pending</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
      <div className="xr-subhead"><i className="fa-solid fa-book-open"></i> Classes With Pending Syllabus</div>
      <div className="xr-table-wrap">
        <table className="xr-table">
          <thead><tr><th>Class</th><th style={{ textAlign: 'center' }}>Pending Subjects</th></tr></thead>
          <tbody>
            {Object.keys(pendingByClass).length === 0 ? <tr><td colSpan={2} className="xr-empty">Nothing pending.</td></tr> :
              Object.entries(pendingByClass).sort((a, b) => b[1] - a[1]).map(([cls, count]) => (
                <tr key={cls}><td style={{ fontWeight: 700 }}>{cls}</td><td style={{ textAlign: 'center' }}>{count}</td></tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function XrResultUploadStatus({ exams, terms, resultPacks, loading, onExport }) {
  const [term, setTerm] = useState('');
  const [examId, setExamId] = useState('');
  const [classKey, setClassKey] = useState('');
  const ex = exams.find((e) => String(e.id) === examId);
  const classOptions = ex ? xrClassList(ex).map((c) => ({ key: `${c.sectionID}-${c.idx}`, cls: c })) : [];
  const active = classKey ? classOptions.filter((c) => c.key === classKey) : classOptions;

  const classBlocks = ex ? active.map((c) => {
    const pack = xrResultPack(resultPacks, ex, c.cls);
    const students = pack && Array.isArray(pack.students) ? pack.students : null;
    const subjectTotal = pack
      ? (Array.isArray(pack.mappedSubjectIDs) && pack.mappedSubjectIDs.length
        ? pack.mappedSubjectIDs.length
        : (Array.isArray(pack.subjects) ? pack.subjects.length : 0))
      : 0;
    const maxMarks = pack ? xrPackTotal(pack) : 0;
    const rows = students ? students.map((st) => {
      const obt = xrObtained(xrMarksRow(pack, st));
      const uploaded = obt != null;
      return {
        name: xrStudentName(st),
        rollNo: xrStudentRoll(st),
        total: subjectTotal || '—',
        marks: uploaded ? `${obt}${maxMarks ? ` / ${maxMarks}` : ''}` : '—',
        score: uploaded && maxMarks ? `${Math.round((obt / maxMarks) * 1000) / 10}%` : '—',
        uploaded: uploaded ? 'Yes' : 'No',
        pending: uploaded ? 0 : 1,
        pct: uploaded ? 100 : 0,
        blockKey: c.key,
        class: c.cls.name,
      };
    }) : [];
    return { blockKey: c.key, class: c.cls.name, hasData: !!students, rows, up: rows.filter((r) => r.uploaded === 'Yes').length };
  }) : [];
  const flatRows = classBlocks.flatMap((b) => b.rows);

  const exportSpec = () => ({
    title: 'Result Upload Status Report',
    subtitle: ex ? ex.name : '',
    groupKey: 'blockKey',
    groupLabel: (r) => r.class,
    columns: [
      { key: 'name', label: 'Student Name', width: '30%' },
      { key: 'rollNo', label: 'Roll Number', width: '16%', align: 'center' },
      { key: 'total', label: 'Subjects', width: '12%', align: 'center' },
      { key: 'uploaded', label: 'Marks Uploaded', width: '14%', align: 'center' },
      { key: 'marks', label: 'Obtained', width: '16%', align: 'center' },
      { key: 'score', label: 'Score', width: '12%', align: 'center' },
    ],
    rows: flatRows.map((r) => ({ ...r, pctLbl: `${r.pct}%` })),
    filename: 'Result-Upload-Status-Report.xlsx',
    metaLine: ex ? ex.name : '',
  });

  return (
    <div className="section-card">
      <div className="xr-card-head">
        <div className="xr-card-title"><i className="fa-solid fa-chart-bar"></i> Result Upload Status Report</div>
        {ex && flatRows.length > 0 && <button type="button" className="export-btn pdf" onClick={() => onExport(exportSpec())}><i className="fa-solid fa-download"></i> Export</button>}
      </div>
      <div className="xr-filter-bar">
        <XrTermSelect terms={terms} value={term} onChange={(v) => { setTerm(v); setExamId(''); setClassKey(''); }} />
        <div className="xr-field"><label>Exam</label>
          <select value={examId} onChange={(e) => { setExamId(e.target.value); setClassKey(''); }}>
            <option value="">Select Exam…</option>
            {exams.filter((e) => xrInTerm(e, term)).map((e) => <option key={e.id} value={e.id}>{e.name}{term ? '' : ` (${xrExamTerm(e) || '—'})`}</option>)}
          </select>
        </div>
        <div className="xr-field"><label>Class</label>
          <select value={classKey} onChange={(e) => setClassKey(e.target.value)} disabled={!ex}>
            <option value="">All Classes</option>{classOptions.map((c) => <option key={c.key} value={c.key}>{c.cls.name}</option>)}
          </select>
        </div>
      </div>
      {!ex ? (
        <div className="xr-empty" style={{ padding: '40px 0' }}>Select an exam to generate the report.</div>
      ) : classBlocks.map((b) => (
        <div className="xr-class-block" key={b.blockKey}>
          <div className="xr-class-block-head">
            <div className="xr-class-block-name"><i className="fa-solid fa-chalkboard"></i> {b.class}</div>
            <div className="xr-class-block-meta">{ex.name}</div>
            {b.hasData && <div className="xr-class-block-badge">{b.up}/{b.rows.length} uploaded</div>}
          </div>
          {!b.hasData ? (
            <div className="xr-empty">{loading ? 'Loading students and marks…' : 'Could not load students for this class. Press Refresh to try again.'}</div>
          ) : (
            <table className="xr-table xr-table--nested">
              <thead><tr>
                <th>Student Name</th><th style={{ textAlign: 'center' }}>Roll Number</th>
                <th style={{ textAlign: 'center' }}>Subjects</th><th style={{ textAlign: 'center' }}>Marks</th>
                <th style={{ textAlign: 'center' }}>Obtained</th><th style={{ textAlign: 'center' }}>Score</th>
                <th style={{ textAlign: 'center', width: 90 }}>Completion</th>
              </tr></thead>
              <tbody>
                {b.rows.map((r, i) => (
                  <tr key={i} className={r.pending > 0 ? 'xr-row-incomplete' : ''}>
                    <td style={{ fontWeight: 700 }}>{r.name}</td>
                    <td style={{ textAlign: 'center' }}>{r.rollNo}</td>
                    <td style={{ textAlign: 'center' }}>{r.total}</td>
                    <td style={{ textAlign: 'center' }}>{r.uploaded === 'Yes' ? <span className="xr-status-pill completed">Uploaded</span> : <span className="xr-status-pill pending">Pending</span>}</td>
                    <td style={{ textAlign: 'center' }}>{r.marks}</td>
                    <td style={{ textAlign: 'center' }}>{r.score}</td>
                    <td>
                      <div className="xr-pct-bar"><div className={`xr-pct-fill${r.pending > 0 ? ' incomplete' : ''}`} style={{ width: `${r.pct}%` }} /></div>
                      <div style={{ fontSize: 10, textAlign: 'center', marginTop: 2 }}>{r.pct}%</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}

function xrRealPending(ex, cls, dateSheets, syllabusData, resultPacks) {
  const tasks = [];
  const ds = xrFindEntries(dateSheets, ex.id, 'cls', cls);
  if (ds) {
    const named = ds.filter((e) => e && e.subject);
    if (!named.length) tasks.push({ type: 'datesheet', label: 'Date sheet not prepared' });
    else if (named.some((e) => !e.date)) tasks.push({ type: 'datesheet', label: 'Date sheet incomplete' });
  }
  const syl = xrSyllabusSubjects(ex, cls, syllabusData);
  if (syl) {
    const missing = syl.filter((s) => !s.uploaded);
    if (!syl.length || missing.length === syl.length) tasks.push({ type: 'syllabus', label: 'Syllabus not uploaded' });
    else if (missing.length) tasks.push({ type: 'syllabus', label: `Syllabus pending (${missing.map((s) => s.subject).join(', ')})` });
  }
  const pack = xrResultPack(resultPacks, ex, cls);
  if (pack && Array.isArray(pack.students) && pack.students.some((st) => !xrStudentUploaded(pack, st))) {
    tasks.push({ type: 'results', label: 'Result marks not uploaded' });
  }
  return tasks;
}

function XrTeacherPendingWork({ exams: allExams, terms, dateSheets, syllabusData, resultPacks, onExport }) {
  const [term, setTerm] = useState('');
  const exams = allExams.filter((e) => xrInTerm(e, term));
  const [workType, setWorkType] = useState('');
  const [examId, setExamId] = useState('');
  const [classFilter, setClassFilter] = useState('');

  const rows = [];
  exams.filter((ex) => !examId || String(ex.id) === examId).forEach((ex) => {
    xrClassList(ex).forEach((cls) => {
      if (classFilter && cls.name !== classFilter) return;
      xrRealPending(ex, cls, dateSheets, syllabusData, resultPacks)
        .filter((task) => !workType || task.type === workType)
        .forEach((task) => rows.push({ class: cls.name, task: task.label, exam: ex.name }));
    });
  });
  const classNames = Array.from(new Set(exams.flatMap((e) => xrClassList(e).map((c) => c.name)))).sort();
  const workTypeLabel = XR_WORK_TYPES.find((w) => w.id === workType)?.label || 'Overall Pending Work';
  const examLabel = exams.find((e) => String(e.id) === examId)?.name || 'All Exams';

  const exportSpec = () => ({
    title: 'Pending Work Report',
    subtitle: `${workTypeLabel} · ${classFilter || 'All Classes'}`,
    columns: [
      { key: 'class', label: 'Class', width: '28%' },
      { key: 'task', label: 'Pending Task', width: '44%' },
      { key: 'exam', label: 'Exam', width: '28%' },
    ],
    rows,
    filename: 'Exam-Pending-Work-Report.xlsx',
    metaLine: `Term: ${term || 'All'}  ·  ${workTypeLabel}  ·  Class: ${classFilter || 'All'}  ·  Exam: ${examLabel}  ·  ${rows.length} pending items`,
  });

  return (
    <div className="section-card">
      <div className="xr-card-head">
        <div className="xr-card-title"><i className="fa-solid fa-chalkboard-user"></i> Pending Work Report</div>
        <button type="button" className="export-btn pdf" onClick={() => onExport(exportSpec())}><i className="fa-solid fa-download"></i> Export</button>
      </div>
      <div className="xr-filter-bar">
        <XrTermSelect terms={terms} value={term} onChange={(v) => { setTerm(v); setExamId(''); }} />
        <div className="xr-field"><label>Class</label>
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="">All Classes</option>{classNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="xr-field"><label>Work Type</label>
          <select value={workType} onChange={(e) => setWorkType(e.target.value)}>
            {XR_WORK_TYPES.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
          </select>
        </div>
        <div className="xr-field"><label>Exam</label>
          <select value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">All Exams</option>{exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>
      <div className="xr-table-wrap">
        <table className="xr-table">
          <thead><tr><th>Class</th><th>Pending Task</th><th>Exam</th></tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={3} className="xr-empty">No pending work found for these filters.</td></tr> : rows.map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 700 }}>{r.class}</td>
                <td><span className="xr-status-pill pending">{r.task}</span></td>
                <td>{r.exam}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="xr-note"><i className="fa-solid fa-circle-info"></i> Lists classes whose date sheet, syllabus, or result marks upload is still incomplete. Generated {xrToday()}.</div>
    </div>
  );
}

const XR_CSS = `
.xr-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.xr-toolbar-info { font-size: 12px; color: var(--text-muted); font-weight: 600; display: flex; align-items: center; gap: 7px; }
.xr-toolbar-info i { color: var(--brand-solid, #1E40AF); }
.xr-refresh { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border: 1.5px solid var(--border-light); border-radius: 8px; background: var(--bg-card); color: var(--text-secondary); font-family: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
.xr-refresh:hover:not(:disabled) { border-color: #93C5FD; color: var(--brand-solid, #1E40AF); }
.xr-refresh:disabled { opacity: .6; cursor: progress; }
.xr-progress { height: 4px; border-radius: 99px; background: var(--border-light); overflow: hidden; margin-bottom: 14px; }
.xr-progress-fill { height: 100%; background: linear-gradient(90deg,#1E40AF,#3B82F6); transition: width .25s ease; }
.xr-subtabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.xr-stab {
  display: inline-flex; align-items: center; gap: 7px;
  height: 36px; padding: 0 14px;
  border: 1.5px solid var(--border-light); border-radius: 10px;
  background: var(--bg-card); color: var(--text-secondary);
  font-family: inherit; font-size: 12.5px; font-weight: 700;
  cursor: pointer; transition: all .15s ease;
}
.xr-stab:hover { border-color: #93C5FD; color: var(--brand-solid, #1E40AF); }
.xr-stab.active { background: var(--brand-gradient, linear-gradient(135deg,#1E3A8A,#1E40AF)); color: #fff; border-color: transparent; box-shadow: var(--shadow-flatten, 0 4px 12px rgba(var(--brand-primary-rgb), .25)); }
[data-theme="dark"] .xr-stab { background: var(--bg-card); color: var(--text-muted); }
.xr-card-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; padding: 16px 18px; border-bottom: 1px solid var(--border-light); }
.xr-card-title { font-size: 14.5px; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 9px; }
.xr-card-title i { color: var(--brand-solid, #1E40AF); }
.xr-filter-bar { display: flex; flex-wrap: wrap; gap: 12px; padding: 16px 18px; border-bottom: 1px solid var(--border-light); }
.xr-field { display: flex; flex-direction: column; gap: 5px; min-width: 170px; }
.xr-field label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .3px; }
.xr-field select { height: 36px; padding: 0 10px; border: 1.5px solid var(--border-light); border-radius: 8px; background: var(--bg-card); color: var(--text-primary); font-family: inherit; font-size: 12.5px; }
.xr-field select:disabled { opacity: .6; cursor: not-allowed; }
.xr-table-wrap { overflow-x: auto; padding: 0 18px 18px; }
.xr-table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-top: 14px; }
.xr-table thead tr { background: #EFF6FF; }
[data-theme="dark"] .xr-table thead tr { background: rgba(255,255,255,.04); }
.xr-table th { padding: 9px 10px; text-align: left; font-size: 10px; font-weight: 800; color: var(--brand-solid, #1E40AF); text-transform: uppercase; letter-spacing: .4px; border-bottom: 2px solid #BFDBFE; white-space: nowrap; }
.xr-table td { padding: 10px; border-bottom: 1px solid var(--border-light); color: var(--text-primary); vertical-align: middle; }
.xr-table tbody tr:hover td { background: rgba(var(--brand-dark-rgb), .03); }
.xr-empty { text-align: center; padding: 30px; color: var(--text-muted); font-size: 12.5px; }
.xr-chip-wrap { display: flex; flex-wrap: wrap; gap: 4px; }
.xr-chip { display: inline-block; padding: 2px 9px; border-radius: 99px; background: #EFF6FF; color: var(--brand-solid, #1E40AF); font-size: 10px; font-weight: 700; border: 1px solid #BFDBFE; }
[data-theme="dark"] .xr-chip { background: rgba(96,165,250,.12); border-color: rgba(96,165,250,.25); }
.xr-status-pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 99px; font-size: 10.5px; font-weight: 700; white-space: nowrap; }
.xr-status-pill.completed { background: rgba(22,163,74,.1); color: #16A34A; border: 1px solid rgba(22,163,74,.25); }
.xr-status-pill.pending { background: rgba(220,38,38,.1); color: #DC2626; border: 1px solid rgba(220,38,38,.25); }
.xr-status-pill.partial { background: rgba(217,119,6,.1); color: #D97706; border: 1px solid rgba(217,119,6,.25); }
.xr-status-pill.not-loaded { background: rgba(100,116,139,.12); color: #64748B; border: 1px solid rgba(100,116,139,.25); }
.xr-pct-bar { width: 100%; height: 6px; border-radius: 99px; background: var(--border-light); overflow: hidden; }
.xr-pct-fill { height: 100%; background: linear-gradient(90deg,#1E40AF,#3B82F6); border-radius: 99px; }
.xr-pct-fill.incomplete { background: linear-gradient(90deg,#B91C1C,#DC2626); }
.xr-row-incomplete td { background: rgba(220,38,38,.06) !important; }
[data-theme="dark"] .xr-row-incomplete td { background: rgba(248,113,113,.08) !important; }
.xr-subhead { font-size: 12.5px; font-weight: 800; color: var(--brand-solid, #1E40AF); padding: 4px 18px 0; text-transform: uppercase; letter-spacing: .4px; display: flex; align-items: center; gap: 7px; }
.xr-note { display: flex; align-items: flex-start; gap: 8px; margin: 0 18px 16px; padding: 10px 13px; background: #F8FAFF; border: 1px solid #DBEAFE; border-radius: 10px; font-size: 11px; color: var(--text-muted); line-height: 1.5; }
.xr-note i { color: var(--brand-solid, #1E40AF); margin-top: 1px; flex-shrink: 0; }
[data-theme="dark"] .xr-note { background: rgba(96,165,250,.05); border-color: var(--border-light); }
.xr-kpi-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; padding: 18px; }
.xr-kpi { border: 1.5px solid var(--border-light); border-radius: 12px; padding: 16px; background: var(--bg-card); }
.xr-kpi-ic { width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-size: 14px; margin-bottom: 10px; }
.xr-kpi--blue .xr-kpi-ic { background: rgba(var(--brand-dark-rgb), .1); color: var(--brand-solid, #1E40AF); }
.xr-kpi--green .xr-kpi-ic { background: rgba(22,163,74,.1); color: #16A34A; }
.xr-kpi--amber .xr-kpi-ic { background: rgba(217,119,6,.1); color: #D97706; }
.xr-kpi--red .xr-kpi-ic { background: rgba(220,38,38,.1); color: #DC2626; }
.xr-kpi-val { font-size: 22px; font-weight: 800; color: var(--text-primary); }
.xr-kpi-lbl { font-size: 11.5px; color: var(--text-muted); font-weight: 600; margin-top: 4px; }
.xr-class-block { margin: 0 18px 16px; border: 1.5px solid var(--border-light); border-radius: 12px; overflow: hidden; }
.xr-class-block-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 11px 14px; background: var(--brand-gradient, linear-gradient(135deg,#1E3A8A,#1E40AF)); }
.xr-class-block-name { font-size: 13px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 7px; }
.xr-class-block-meta { font-size: 11px; color: rgba(255,255,255,.75); font-weight: 600; }
.xr-class-block-badge { margin-left: auto; font-size: 10.5px; font-weight: 700; color: var(--brand-solid, #1E40AF); background: #fff; padding: 3px 10px; border-radius: 99px; }
.xr-table--nested { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-top: 0; }
.xr-table--nested thead tr { background: #EFF6FF; }
.xr-table--nested th { padding: 8px 10px; text-align: left; font-size: 9.5px; font-weight: 800; color: var(--brand-solid, #1E40AF); text-transform: uppercase; letter-spacing: .4px; border-bottom: 1.5px solid #BFDBFE; }
.xr-table--nested td { padding: 9px 10px; border-bottom: 1px solid var(--border-light); color: var(--text-primary); vertical-align: middle; }
.xr-class-block .xr-empty { padding: 20px; }
@media (max-width: 900px) { .xr-kpi-grid { grid-template-columns: repeat(2,1fr); } .xr-field { min-width: 140px; } }
@media (max-width: 560px) { .xr-kpi-grid { grid-template-columns: 1fr; } .xr-class-block-badge { margin-left: 0; } }
`;
