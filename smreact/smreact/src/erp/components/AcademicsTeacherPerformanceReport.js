import React, { useMemo, useState } from 'react';
import useAsync from '../hooks/useAsync';
import * as academicsService from '../services/academicsReportsService';
import { computeTeacherPerformance } from './academicsTeacherPerformance';
import { nbUnitStatus } from './academicsReportsUnits';
import { usePermissions } from '../context/PermissionsContext';
import { deliverAcademicsHtmlReport } from './academicsReportsShared';
import {
  StandardReportPicker, buildReportTableHtml, reportPalette,
} from '../reports/reportKit';

/* ═══════════════════════════════════════════════════════════════════
   TEACHER PERFORMANCE & ACTIVITY REPORT (Academics → Reports, tile 6)

   Teacher selection UI follows the exact same pattern as the
   Examination module's Result History: a searchable grid of entity
   cards (there: students; here: teachers), click a card to open an
   inline detail view in its place (no modal, no route change) with a
   "← All Teachers" back button — same interaction, cloned under a new
   "tp-" CSS prefix (not shared classes) so this file has no runtime
   dependency on Examination.jsx ever being mounted.

   The detail view renders every section computed by
   computeTeacherPerformance (academicsTeacherPerformance.js) — see
   that file's header comment for which sections read real, structural
   app data versus which read from the demo extras (removed from this port).
   "Generate Report" builds a matching PDF/Word document via the same
   reportKit.js every other Academics report already uses.
   ═══════════════════════════════════════════════════════════════════ */

function initials(name) {
  return name.replace(/^(Mr\.|Ms\.|Mrs\.|Dr\.)\s*/i, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function NotAvailable({ reason }) {
  return (
    <div className="tp-notavail">
      <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
      <span>{reason}</span>
    </div>
  );
}

function Pct(a, b) {
  return b ? Math.round((a / b) * 100) : 0;
}

function SectionHead({ icon, title, sub }) {
  return (
    <div className="tp-sec-h">
      <div className="tp-sec-title"><i className={`fa-solid ${icon}`} aria-hidden="true"></i> {title}</div>
      {sub && <div className="tp-sec-sub">{sub}</div>}
    </div>
  );
}

function KpiRow({ items }) {
  return (
    <div className="tp-kpis">
      {items.map((k, i) => (
        <div key={i} className="tp-kpi" style={k.color ? { '--kc': k.color } : undefined}>
          <div className="tp-kpi-val">{k.value}</div>
          <div className="tp-kpi-lbl">{k.label}</div>
        </div>
      ))}
    </div>
  );
}

function Table({ columns, rows, emptyText = 'No records.' }) {
  if (!rows.length) return <div className="tp-table-empty">{emptyText}</div>;
  return (
    <div className="tp-table-wrap">
      <table className="tp-table">
        <thead><tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{columns.map(c => <td key={c.key}>{r[c.key] ?? '—'}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


/* ─── Report export — builds a document matching the on-screen
   structure, through the same reportKit.js every other Academics
   report already uses. ─── */
function buildTeacherReportBody(p, isColor) {
  const pal = reportPalette(isColor);
  const kpiHtml = (items) => `<div style="display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 16px">${items.map(k => `
    <div style="flex:1;min-width:120px;border:1px solid ${pal.border};border-radius:8px;padding:10px 12px;background:${pal.rowBaseBg}">
      <div style="font-size:17px;font-weight:800;color:${k.color || pal.textD}">${k.value}</div>
      <div style="font-size:10px;font-weight:700;color:${pal.textM};text-transform:uppercase">${k.label}</div>
    </div>`).join('')}</div>`;
  const heading = (t) => `<div style="${pal.sectionAccent};font-size:14px;font-weight:800;color:${pal.textD};margin:20px 0 8px">${t}</div>`;

  let html = `
    <div style="border:1px solid ${pal.border};border-radius:10px;padding:16px;margin-bottom:10px">
      <div style="font-size:18px;font-weight:800;color:${pal.textD}">${p.teacher}</div>
      <div style="font-size:12px;color:${pal.textM};margin-top:2px">${p.classes.join(', ')} &middot; ${p.subjects.join(', ')}</div>
      <div style="font-size:12px;color:${pal.textM};margin-top:6px">
        ${p.joinDate ? `Joined: <b>${p.joinDate}</b> &nbsp;&middot;&nbsp; Tenure: <b>${p.tenure}</b>` : 'No joining date on file.'}
      </div>
    </div>
  `;
  html += kpiHtml([
    { label: 'Lesson Plans', value: p.summary.lpTotal },
    { label: 'LP Submitted', value: p.summary.lpSubmitted, color: '#16A34A' },
    { label: 'Notebook Plans', value: p.summary.nbTotal },
    { label: 'NB Submitted', value: p.summary.nbSubmitted, color: '#16A34A' },
    { label: 'Activities Created', value: p.summary.activitiesCreated },
    { label: 'Papers Generated', value: p.summary.papersGenerated },
  ]);

  html += heading('Academic Planning &amp; Content Creation');
  html += kpiHtml([
    { label: 'Lesson Plans Created', value: p.content.lpTotal },
    { label: 'Notebook Plans Created', value: p.content.nbTotal },
    { label: 'Worksheets Created', value: p.content.worksheetsTotal },
  ]);

  html += heading('Lesson Plan &amp; Notebook Plan Submissions');
  html += kpiHtml([
    { label: 'LP Assigned', value: p.lpSubmissions.total }, { label: 'LP Submitted', value: p.lpSubmissions.submitted, color: '#16A34A' }, { label: 'LP Pending', value: p.lpSubmissions.pending, color: '#DC2626' },
    { label: 'NB Assigned', value: p.nbSubmissions.total }, { label: 'NB Submitted', value: p.nbSubmissions.submitted, color: '#16A34A' }, { label: 'NB Pending', value: p.nbSubmissions.pending, color: '#DC2626' },
  ]);

  html += heading('Activity Planner &amp; Term Breakups');
  html += kpiHtml([{ label: 'Activities Created', value: p.activityPlanner.activitiesCreated }]);
  html += buildReportTableHtml({
    columns: [{ key: 'subject', label: 'Subject' }, { key: 'term', label: 'Term' }, { key: 'units', label: 'Units Added' }, { key: 'unitNames', label: 'Unit Names' }],
    rows: p.termBreakups.groups.map(g => ({ ...g, unitNames: g.unitNames.join(', ') })),
    isColor, emptyText: 'No term breakup entries.',
  });

  html += heading('Attendance Management');
  html += `<div style="font-size:12px;color:${pal.textM};margin-bottom:8px">Assigned class(es): <b>${p.studentAttendanceMarking.assignedClasses.join(', ') || '—'}</b></div>`;
  html += kpiHtml([
    { label: 'Working Days So Far', value: p.studentAttendanceMarking.workingDaysSoFar },
  ]);
  html += kpiHtml([
    { label: "Today's Status", value: p.personalAttendance.available ? p.personalAttendance.status : '—' },
    { label: 'Leave Entitlement', value: p.leave.available ? p.leave.entitlement : '—' },
    { label: 'Leave Taken', value: p.leave.available ? p.leave.taken : '—', color: '#DC2626' },
    { label: 'Leave Balance', value: p.leave.available ? p.leave.balance : '—', color: '#16A34A' },
  ]);

  html += heading('Question Paper Generation');
  html += buildReportTableHtml({
    columns: [{ key: 'subj', label: 'Subject' }, { key: 'title', label: 'Title' }, { key: 'date', label: 'Date' }],
    rows: p.paperGeneration.papers, isColor, emptyText: 'No question papers generated by this teacher.',
  });

  return html;
}

function TeacherReportActions({ perf }) {
  const [open, setOpen] = useState(false);
  const { can } = usePermissions();
  if (!can('Academics', 'Reports', 'Download')) return null;
  const title = `Teacher Performance & Activity Report — ${perf.teacher}`;
  const generate = (style, format) => {
    const isColor = style === 'color';
    const bodyHtml = buildTeacherReportBody(perf, isColor);
    deliverAcademicsHtmlReport({ title, format, isColor, bodyHtml });
  };
  return (
    <div className="tp-report-actions">
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <i className="fa-solid fa-file-lines" aria-hidden="true"></i> Generate Report
      </button>
      <StandardReportPicker
        open={open} title={title} subtitle="Choose style and format, then generate."
        formats={['pdf', 'word']} onClose={() => setOpen(false)}
        onGenerate={(style, format) => { generate(style, format); setOpen(false); }}
      />
    </div>
  );
}

/* ─── Teacher detail view ─── */
function TeacherDetail({ perf, onBack }) {
  const p = perf;
  return (
    <div className="tp-detail">
      <div className="tp-detail-top">
        <button type="button" className="tp-back-btn" onClick={onBack}>
          <i className="fa-solid fa-arrow-left" aria-hidden="true"></i> All Teachers
        </button>
        <TeacherReportActions perf={p} />
      </div>

      {/* ── Teacher Profile & Overall Summary ── */}
      <div className="tp-profile-card">
        <div className="tp-banner">
          <div className="tp-banner-avatar">{initials(p.teacher)}</div>
          <div className="tp-banner-id">
            <div className="tp-banner-name">{p.teacher}</div>
            <div className="tp-banner-sub">{p.classes.join(', ')} · {p.subjects.join(', ')}</div>
            <div className="tp-banner-tenure">
              {p.joinDate
                ? <><i className="fa-solid fa-calendar-check" aria-hidden="true"></i> Joined <b>{p.joinDate}</b> &nbsp;·&nbsp; Tenure: <b>{p.tenure}</b></>
                : <span className="tp-banner-tenure--muted">No joining date on file.</span>}
            </div>
          </div>
        </div>
        <KpiRow items={[
          { label: 'Lesson Plans', value: p.summary.lpTotal },
          { label: 'LP Submitted', value: p.summary.lpSubmitted, color: '#16A34A' },
          { label: 'Notebook Plans', value: p.summary.nbTotal },
          { label: 'NB Submitted', value: p.summary.nbSubmitted, color: '#16A34A' },
          { label: 'Activities Created', value: p.summary.activitiesCreated },
          { label: 'Papers Generated', value: p.summary.papersGenerated },
        ]} />
      </div>

      {/* ── Academic Planning & Content Creation ── */}
      <div className="section-card tp-panel">
        <SectionHead icon="fa-pen-ruler" title="Academic Planning & Content Creation" />
        <KpiRow items={[
          { label: 'Lesson Plans Created', value: p.content.lpTotal },
          { label: 'Notebook Plans Created', value: p.content.nbTotal },
          { label: 'Worksheets Created', value: p.content.worksheetsTotal },
        ]} />
      </div>

      {/* ── Lesson Plan & Notebook Plan Submissions ── */}
      <div className="section-card tp-panel">
        <SectionHead icon="fa-chalkboard" title="Lesson Plan & Notebook Plan Submissions" />
        <div className="tp-two-col">
          <div>
            <div className="tp-mini-h">Lesson Plans</div>
            <KpiRow items={[
              { label: 'Assigned', value: p.lpSubmissions.total },
              { label: 'Submitted', value: p.lpSubmissions.submitted, color: '#16A34A' },
              { label: 'Pending', value: p.lpSubmissions.pending, color: '#DC2626' },
            ]} />
          </div>
          <div>
            <div className="tp-mini-h">Notebook Plans</div>
            <KpiRow items={[
              { label: 'Assigned', value: p.nbSubmissions.total },
              { label: 'Submitted', value: p.nbSubmissions.submitted, color: '#16A34A' },
              { label: 'Pending', value: p.nbSubmissions.pending, color: '#DC2626' },
            ]} />
          </div>
        </div>
      </div>

      {/* ── Activity Planner & Term Breakups ── */}
      <div className="section-card tp-panel">
        <SectionHead icon="fa-calendar-days" title="Activity Planner & Term Breakups" />
        <KpiRow items={[
          { label: 'Activities Created', value: p.activityPlanner.activitiesCreated },
          { label: 'Term Breakup Entries', value: p.termBreakups.entriesCreated },
          { label: 'Subjects Covered', value: p.termBreakups.subjectsCovered },
          { label: 'Units With Entries', value: p.termBreakups.unitsWithEntries },
        ]} />
        <div className="tp-mini-h">Units Added, by Subject &amp; Term</div>
        <Table
          columns={[{ key: 'subject', label: 'Subject' }, { key: 'term', label: 'Term' }, { key: 'units', label: 'Units Added' }, { key: 'unitNames', label: 'Unit Names' }]}
          rows={p.termBreakups.groups.map(g => ({ ...g, unitNames: g.unitNames.join(', ') }))}
          emptyText="No term breakup entries created by this teacher."
        />
      </div>

      {/* ── Attendance Management ── */}
      <div className="section-card tp-panel">
        <SectionHead icon="fa-clipboard-check" title="Attendance Management" />
        <div className="tp-two-col">
          <div>
            <div className="tp-mini-h">Student Attendance Marked by the Teacher</div>
            <KpiRow items={[
              { label: 'Assigned Class(es)', value: p.studentAttendanceMarking.assignedClasses.join(', ') || '—' },
            ]} />
            <KpiRow items={[
              { label: 'Working Days So Far', value: p.studentAttendanceMarking.workingDaysSoFar },
            ]} />
          </div>
          <div>
            <div className="tp-mini-h">Teacher's Personal Attendance</div>
            {p.personalAttendance.available ? (
              <KpiRow items={[
                { label: "Today's Status", value: p.personalAttendance.status || '—' },
                { label: 'In Time', value: p.personalAttendance.inTime || '—' },
                { label: 'Out Time', value: p.personalAttendance.outTime || '—' },
              ]} />
            ) : <NotAvailable reason={p.personalAttendance.reason} />}
            <div className="tp-mini-h">Leave Balance</div>
            {p.leave.available ? (
              <KpiRow items={[
                { label: 'Entitlement', value: p.leave.entitlement },
                { label: 'Taken', value: p.leave.taken, color: '#DC2626' },
                { label: 'Balance', value: p.leave.balance, color: '#16A34A' },
              ]} />
            ) : <NotAvailable reason={p.leave.reason} />}
          </div>
        </div>
      </div>

      {/* ── Question Paper Generation ── */}
      <div className="section-card tp-panel">
        <SectionHead icon="fa-scroll" title="Question Paper Generation" />
        <KpiRow items={[{ label: 'Papers Generated', value: p.paperGeneration.total }]} />
        <Table
          columns={[{ key: 'subj', label: 'Subject' }, { key: 'title', label: 'Title' }, { key: 'date', label: 'Date' }]}
          rows={p.paperGeneration.papers}
          emptyText="No question papers generated by this teacher."
        />
      </div>

    </div>
  );
}

/* ─── Main panel: search + card grid, or detail view ─── */
export default function TeacherPerformanceReportPanel() {
  const { data: teacherAssignments = [], loading: assignLoading } = useAsync(academicsService.getAcademicsTeacherAssignments, []);
  const { data: lpData = [], loading: lpLoading } = useAsync(academicsService.getSubLpData, []);
  const { data: nbData = [], loading: nbLoading } = useAsync(academicsService.getSubNbData, []);
  const { data: activities = [] }         = useAsync(academicsService.getActivities, []);
  const { data: termBreakups = [] }       = useAsync(academicsService.getTermBreakups, []);
  const { data: studentAttendanceClasses = [] } = useAsync(academicsService.getStudentAttendance, []);
  const { data: staffAttendance = [] }    = useAsync(academicsService.getStaffAttendance, []);
  const { data: hrEmployees = [] }        = useAsync(academicsService.getHrEmployees, []);
  const { data: papers = {} }             = useAsync(academicsService.getAllPapers, []);
  const { data: session = null }          = useAsync(academicsService.getSession, []);
  const { data: vacations = [] }          = useAsync(academicsService.getVacations, []);
  const { data: weeklyOff = [] }          = useAsync(academicsService.getWeeklyOff, []);
  const { data: holidays = [] }           = useAsync(academicsService.getHolidays, []);
  const { data: resources = [] }         = useAsync(academicsService.getTeacherResources, []);

  /* Teacher cards / % ke liye assignments + LP/NB chahiye — pehle spinner. */
  const coreLoading = assignLoading || lpLoading || nbLoading;

  const teacherNames = useMemo(() => Array.from(new Set(teacherAssignments.map(a => a.teacher))).sort(), [teacherAssignments]);

  const [q, setQ] = useState('');
  const [active, setActive] = useState(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? teacherNames.filter(n => n.toLowerCase().includes(term)) : teacherNames;
  }, [teacherNames, q]);

  const dataBundle = {
    teacherAssignments, lpData, nbData, activities, termBreakups, resources, studentAttendanceClasses,
    staffAttendance, hrEmployees, papers,
    session, weeklyOff, holidays, vacations,
  };

  const cardSummary = (name) => {
    const pairs = teacherAssignments.filter(a => a.teacher === name);
    const inScope = rec => pairs.some(p => p.class === rec.class && p.subject === rec.subject);
    const tLp = lpData.filter(inScope);
    const tNb = nbData.filter(inScope);
    const lpSubmitted = tLp.filter(r => r.status === 'submitted').length;
    const nbSubmitted = tNb.filter(u => nbUnitStatus(u) === 'submitted').length;
    const total = tLp.length + tNb.length;
    const submitted = lpSubmitted + nbSubmitted;
    return { classes: Array.from(new Set(pairs.map(p => p.class))), subjects: Array.from(new Set(pairs.map(p => p.subject))), pct: Pct(submitted, total) };
  };

  if (coreLoading) {
    return (
      <div className="section-card tp-panel aca-rep-loading">
        <div className="aca-rep-loading-inner">
          <i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
          <span>Loading teacher performance…</span>
        </div>
      </div>
    );
  }

  if (active) {
    const perf = computeTeacherPerformance(active, dataBundle);
    return <TeacherDetail perf={perf} onBack={() => setActive(null)} />;
  }

  return (
    <div className="section-card tp-panel">
      <div className="tp-sec-h">
        <div className="tp-sec-title"><i className="fa-solid fa-chalkboard-user" aria-hidden="true"></i> Teacher Performance &amp; Activity Report</div>
        <div className="tp-sec-sub">Select a teacher to view their complete academic workload, content creation, submissions, attendance, assessment activity and more.</div>
      </div>

      <div className="tp-search-wrap">
        <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        <input className="form-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search teacher by name…" />
      </div>

      <div className="tp-grid">
        {filtered.map(name => {
          const s = cardSummary(name);
          return (
            <div key={name} className="tp-card" onClick={() => setActive(name)}>
              <div className="tp-card-avatar">{initials(name)}</div>
              <div className="tp-card-id">
                <div className="tp-card-name">{name}</div>
                <div className="tp-card-sub">{s.classes.join(', ')}</div>
                <div className="tp-card-sub tp-card-sub--muted">{s.subjects.join(', ')}</div>
              </div>
              <div className="tp-card-pct">
                <div className="tp-card-pct-val">{s.pct}%</div>
                <div className="tp-card-pct-lbl">Submitted</div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="tp-table-empty">No teacher matches your search.</div>}
      </div>
    </div>
  );
}
