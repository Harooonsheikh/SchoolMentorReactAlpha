import React, { useMemo, useState } from 'react';
import useAsync from '../hooks/useAsync';
import * as academicsService from '../services/academicsReportsService';
import { nbUnitItems, nbUnitStatus } from './academicsReportsUnits';
import {
  StandardReportPicker, buildReportTableHtml, reportPalette, reportStatusPill,
} from '../reports/reportKit';
import { usePermissions } from '../context/PermissionsContext';
import {
  ACADEMICS_REPORTS_CSS, deliverAcademicsHtmlReport, deliverAcademicsExcelReport,
} from './academicsReportsShared';
import TeacherPerformanceReportPanel from './AcademicsTeacherPerformanceReport';

/* ═══════════════════════════════════════════════════════════════════
   ACADEMICS MODULE — REPORTS TAB

   5 comprehensive, highly customizable reports, together covering
   every real data area the Academics module manages:
     1. Lesson Plan Submission Report      (Lesson Plans)
     2. Question Bank Submission Report    (Question Bank)
     3. Teacher Workload & Compliance      (cross-cutting: both, per teacher)
     4. Academic Activities Report         (Activity Calendar)
     5. Academic Setup Report              (Session, Terms, Vacations, Textbooks)

   Every report reads REAL data from academicsService (the same
   service the Dashboard's Academics section and LessonPlans.js use —
   see mock/lessonPlans.js's header comment for the class/subject/
   teacher linkage) — nothing here is a hand-typed placeholder. The
   Question Bank report reuses the exact same "a unit counts as
   submitted once every item inside it is submitted" rule the
   Dashboard already established (nbUnitStatus, imported, not
   redefined), so the two never drift apart.

   Every report follows the same shape every other module's Reports
   tab already uses in this app (Fee.jsx's ReportPanelX functions):
   its own local filter state, a KPI strip, a results table, and a
   "Generate Report" button that opens the shared StandardReportPicker
   (style + format) from reportKit.js — PDF/Word render through
   buildStandardReportHtml/openReportWindow/downloadReportAsWord,
   Excel through downloadReportExcel. Nothing here touches Academics.js's
   own pre-existing single reportPicker/generateAcademicsReport
   mechanism (still used by Textbooks/Calendar/Activities' own ad-hoc
   per-item export buttons) — this tab manages its own picker instance
   per report, same as Fee's RepActions pattern.
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Shared filter primitives ─── */

function ChipMultiSelect({ label, icon, options, selected, onChange }) {
  const allActive = selected.length === 0;
  return (
    <div className="aca-rep-field">
      <div className="aca-rep-flabel">{icon && <i className={`fa-solid ${icon}`}></i>} {label}</div>
      <div className="aca-rep-chiprow">
        <button type="button" className={`aca-rep-chip${allActive ? ' active' : ''}`} onClick={() => onChange([])}>
          All
        </button>
        {options.map(o => {
          const active = selected.includes(o);
          return (
            <button
              type="button" key={o} className={`aca-rep-chip${active ? ' active' : ''}`}
              onClick={() => onChange(active ? selected.filter(x => x !== o) : [...selected, o])}
            >
              {active && <i className="fa-solid fa-check"></i>} {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ColumnToggles({ label, options, selected, onChange }) {
  return (
    <div className="aca-rep-field">
      <div className="aca-rep-flabel"><i className="fa-solid fa-table-columns"></i> {label}</div>
      <div className="aca-rep-coltoggles">
        {options.map(o => {
          const active = selected.includes(o.key);
          return (
            <label key={o.key} className={`aca-rep-coltoggle${active ? ' active' : ''}`}>
              <input
                type="checkbox" checked={active}
                onChange={() => onChange(active ? selected.filter(k => k !== o.key) : [...selected, o.key])}
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function SegmentedControl({ label, icon, options, value, onChange }) {
  return (
    <div className="aca-rep-field">
      {label && <div className="aca-rep-flabel">{icon && <i className={`fa-solid ${icon}`}></i>} {label}</div>}
      <div className="aca-rep-seg">
        {options.map(o => (
          <button
            type="button" key={o.value}
            className={`aca-rep-seg-btn${value === o.value ? ' active' : ''}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function DateRangeField({ from, to, onFrom, onTo }) {
  return (
    <div className="aca-rep-field">
      <div className="aca-rep-flabel"><i className="fa-solid fa-calendar-days"></i> Date Range</div>
      <div className="aca-rep-daterow">
        <input type="date" className="form-input" value={from} onChange={e => onFrom(e.target.value)} />
        <span>to</span>
        <input type="date" className="form-input" value={to} onChange={e => onTo(e.target.value)} />
      </div>
    </div>
  );
}

function KpiStrip({ items }) {
  return (
    <div className="aca-rep-kpis">
      {items.map((k, i) => (
        <div key={i} className="aca-rep-kpi" style={k.color ? { '--kc': k.color } : undefined}>
          <div className="aca-rep-kpi-val">{k.value}</div>
          <div className="aca-rep-kpi-lbl">{k.label}</div>
        </div>
      ))}
    </div>
  );
}

function kpiStripHtml(items, p) {
  return `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px">${items.map(k => `
    <div style="flex:1;min-width:130px;border:1px solid ${p.border};border-radius:10px;padding:12px 14px;background:${p.rowBaseBg}">
      <div style="font-size:20px;font-weight:800;color:${k.color || p.textD}">${k.value}</div>
      <div style="font-size:11px;font-weight:700;color:${p.textM};text-transform:uppercase;letter-spacing:.3px;margin-top:2px">${k.label}</div>
    </div>`).join('')}</div>`;
}

function sectionHeadingHtml(title, p) {
  return `<div style="${p.sectionAccent};font-size:14px;font-weight:800;color:${p.textD};margin:22px 0 10px">${title}</div>`;
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function inRange(dateStr, from, to) {
  if (!dateStr) return true;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return true;
  if (from && d < new Date(from)) return false;
  if (to && d > new Date(to)) return false;
  return true;
}

/* ─── Shared "Generate Report" trigger + builder, reused by every
   report below so the PDF/Word/Excel plumbing is written once. ─── */
function ReportActions({ title, disabled, formats = ['pdf', 'word', 'excel'], onGenerate }) {
  const [open, setOpen] = useState(false);
  const { can } = usePermissions();
  /* Hide the control (not the data) when the user may view but not download. */
  if (!can('Academics', 'Reports', 'Download')) return null;
  return (
    <div className="aca-rep-actions">
      <button type="button" className="btn btn-primary" disabled={disabled} onClick={() => setOpen(true)}>
        <i className="fa-solid fa-file-lines"></i> Generate Report
      </button>
      <StandardReportPicker
        open={open} title={title} subtitle="Choose style and format, then generate."
        formats={formats}
        onClose={() => setOpen(false)}
        onGenerate={(style, format) => { onGenerate(style, format); setOpen(false); }}
      />
    </div>
  );
}

function useTableReportGenerator({ title, columns, data, rowMapper, groupBy, kpis, emptyText }) {
  return (style, format) => {
    const isColor = style === 'color';
    if (format === 'excel') {
      const rows = data.map(d => rowMapper(d, 'excel'));
      deliverAcademicsExcelReport({
        title, columns, rows, isColor,
        groupKey: groupBy || undefined, groupLabel: groupBy ? (r => r[groupBy]) : undefined,
      });
      return;
    }
    const palette = reportPalette(isColor);
    const rows = data.map(d => rowMapper(d, 'display', palette));
    const bodyHtml = (kpis ? kpiStripHtml(kpis, palette) : '') +
      buildReportTableHtml({
        columns, rows, isColor,
        groupKey: groupBy || undefined, groupLabel: groupBy ? (r => r[groupBy]) : undefined,
        emptyText,
      });
    deliverAcademicsHtmlReport({ title, format, isColor, bodyHtml });
  };
}

/* ═══════════════════════════════════════════════════════════════════
   1. LESSON PLAN SUBMISSION REPORT
   ═══════════════════════════════════════════════════════════════════ */
const LP_COLUMNS = [
  { key: 'class', label: 'Class' }, { key: 'subject', label: 'Subject' }, { key: 'teacher', label: 'Teacher' },
  { key: 'unit', label: 'Unit' }, { key: 'topic', label: 'Topic' }, { key: 'term', label: 'Term' },
  { key: 'date', label: 'Date' }, { key: 'status', label: 'Status' }, { key: 'submittedDate', label: 'Submitted Date' },
];

function LessonPlanReportPanel({ lpData, classList, subjectList, teacherList }) {
  const [fClasses, setFClasses] = useState([]);
  const [fSubjects, setFSubjects] = useState([]);
  const [fTeachers, setFTeachers] = useState([]);
  const [fStatus, setFStatus] = useState('all');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');
  const [groupBy, setGroupBy] = useState('none');
  const [cols, setCols] = useState(LP_COLUMNS.map(c => c.key));

  const filtered = useMemo(() => lpData.filter(r => {
    if (fClasses.length && !fClasses.includes(r.class)) return false;
    if (fSubjects.length && !fSubjects.includes(r.subject)) return false;
    if (fTeachers.length && !fTeachers.includes(r.teacher)) return false;
    if (fStatus !== 'all' && r.status !== fStatus) return false;
    if (!inRange(r.date, fFrom, fTo)) return false;
    return true;
  }), [lpData, fClasses, fSubjects, fTeachers, fStatus, fFrom, fTo]);

  const sorted = useMemo(() => {
    if (groupBy === 'none') return filtered;
    return [...filtered].sort((a, b) => String(a[groupBy]).localeCompare(String(b[groupBy])));
  }, [filtered, groupBy]);

  const total = filtered.length;
  const submitted = filtered.filter(r => r.status === 'submitted').length;
  const pending = total - submitted;
  const pct = total ? Math.round((submitted / total) * 100) : 0;

  const columns = LP_COLUMNS.filter(c => cols.includes(c.key));
  const rowMapper = (r, mode, palette) => ({
    class: r.class, subject: r.subject, teacher: r.teacher, unit: r.unit, topic: r.topic, term: r.term,
    date: fmtDate(r.date),
    status: mode === 'excel' ? (r.status === 'submitted' ? 'Submitted' : 'Pending') : reportStatusPill(r.status, r.status === 'submitted' ? 'green' : 'amber', palette),
    submittedDate: r.submittedDate ? fmtDate(r.submittedDate) : '—',
  });
  const generate = useTableReportGenerator({
    title: 'Lesson Plan Submission Report',
    columns, data: sorted, rowMapper,
    groupBy: groupBy !== 'none' ? groupBy : null,
    kpis: [
      { label: 'Total Lesson Plans', value: total },
      { label: 'Submitted', value: submitted, color: '#16A34A' },
      { label: 'Pending', value: pending, color: '#DC2626' },
      { label: 'Submission Rate', value: `${pct}%` },
    ],
    emptyText: 'No lesson plans match the selected filters.',
  });

  return (
    <div className="section-card aca-rep-panel">
      <div className="aca-rep-panel-h">
        <div className="aca-rep-panel-t"><i className="fa-solid fa-chalkboard"></i> Lesson Plan Submission Report</div>
        <div className="aca-rep-panel-d">Every lesson plan recorded, across every class, subject and teacher — filter, group and choose exactly which columns to include.</div>
      </div>

      <KpiStrip items={[
        { label: 'Total', value: total },
        { label: 'Submitted', value: submitted, color: '#16A34A' },
        { label: 'Pending', value: pending, color: '#DC2626' },
        { label: 'Submission Rate', value: `${pct}%` },
      ]} />

      <div className="aca-rep-filters">
        <ChipMultiSelect label="Class" icon="fa-school" options={classList} selected={fClasses} onChange={setFClasses} />
        <ChipMultiSelect label="Subject" icon="fa-book" options={subjectList} selected={fSubjects} onChange={setFSubjects} />
        <ChipMultiSelect label="Teacher" icon="fa-chalkboard-user" options={teacherList} selected={fTeachers} onChange={setFTeachers} />
        <SegmentedControl
          label="Status" icon="fa-circle-check"
          options={[{ value: 'all', label: 'All' }, { value: 'submitted', label: 'Submitted' }, { value: 'pending', label: 'Pending' }]}
          value={fStatus} onChange={setFStatus}
        />
        <DateRangeField from={fFrom} to={fTo} onFrom={setFFrom} onTo={setFTo} />
        <SegmentedControl
          label="Group By" icon="fa-layer-group"
          options={[{ value: 'none', label: 'None' }, { value: 'class', label: 'Class' }, { value: 'subject', label: 'Subject' }, { value: 'teacher', label: 'Teacher' }]}
          value={groupBy} onChange={setGroupBy}
        />
        <ColumnToggles label="Columns To Include" options={LP_COLUMNS} selected={cols} onChange={setCols} />
      </div>

      <ReportActions title="Lesson Plan Submission Report" disabled={cols.length === 0} onGenerate={generate} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   2. QUESTION BANK SUBMISSION REPORT
   ═══════════════════════════════════════════════════════════════════ */
const NB_UNIT_COLUMNS = [
  { key: 'class', label: 'Class' }, { key: 'subject', label: 'Subject' }, { key: 'teacher', label: 'Teacher' },
  { key: 'unit', label: 'Unit' }, { key: 'totalItems', label: 'Total Items' },
  { key: 'submittedItems', label: 'Submitted Items' }, { key: 'pendingItems', label: 'Pending Items' },
  { key: 'status', label: 'Status' },
];
const NB_ITEM_COLUMNS = [
  { key: 'class', label: 'Class' }, { key: 'subject', label: 'Subject' }, { key: 'teacher', label: 'Teacher' },
  { key: 'unit', label: 'Unit' }, { key: 'questionType', label: 'Question Type' },
  { key: 'item', label: 'Item' }, { key: 'status', label: 'Status' },
];

function NotebookPlanReportPanel({ nbData, classList, subjectList, teacherList }) {
  const [fClasses, setFClasses] = useState([]);
  const [fSubjects, setFSubjects] = useState([]);
  const [fTeachers, setFTeachers] = useState([]);
  const [fStatus, setFStatus] = useState('all');
  const [granularity, setGranularity] = useState('unit'); // 'unit' | 'item'
  const [groupBy, setGroupBy] = useState('none');
  const [cols, setCols] = useState(NB_UNIT_COLUMNS.map(c => c.key));

  const columnOptions = granularity === 'unit' ? NB_UNIT_COLUMNS : NB_ITEM_COLUMNS;
  const effectiveCols = useMemo(
    () => cols.filter(k => columnOptions.some(c => c.key === k)),
    [cols, columnOptions]
  );

  const unitsFiltered = useMemo(() => nbData.filter(u => {
    if (fClasses.length && !fClasses.includes(u.class)) return false;
    if (fSubjects.length && !fSubjects.includes(u.subject)) return false;
    if (fTeachers.length && !fTeachers.includes(u.teacher)) return false;
    return true;
  }), [nbData, fClasses, fSubjects, fTeachers]);

  const unitRows = useMemo(() => unitsFiltered.map(u => {
    const items = nbUnitItems(u);
    const subStatus = nbUnitStatus(u);
    return {
      class: u.class, subject: u.subject, teacher: u.teacher, unit: u.unitName,
      totalItems: items.length,
      submittedItems: items.filter(i => i.status === 'submitted').length,
      pendingItems: items.filter(i => i.status !== 'submitted').length,
      status: subStatus,
    };
  }).filter(r => fStatus === 'all' || r.status === fStatus), [unitsFiltered, fStatus]);

  const itemRows = useMemo(() => unitsFiltered.flatMap(u => (u.questionTypes || []).flatMap(qt =>
    (qt.items || []).map(it => ({
      class: u.class, subject: u.subject, teacher: u.teacher, unit: u.unitName,
      questionType: qt.mainQ, item: it.preview, status: it.status,
    }))
  )).filter(r => fStatus === 'all' || r.status === fStatus), [unitsFiltered, fStatus]);

  const rows = granularity === 'unit' ? unitRows : itemRows;
  const sorted = useMemo(() => {
    if (groupBy === 'none') return rows;
    return [...rows].sort((a, b) => String(a[groupBy]).localeCompare(String(b[groupBy])));
  }, [rows, groupBy]);

  const totalUnits = unitRows.length;
  const submittedUnits = unitRows.filter(r => r.status === 'submitted').length;
  const pendingUnits = totalUnits - submittedUnits;
  const totalItemsCount = unitsFiltered.reduce((s, u) => s + nbUnitItems(u).length, 0);

  const columns = columnOptions.filter(c => effectiveCols.includes(c.key));
  const rowMapper = (r, mode, palette) => {
    const out = { ...r };
    out.status = mode === 'excel'
      ? (r.status === 'submitted' ? 'Submitted' : 'Pending')
      : reportStatusPill(r.status, r.status === 'submitted' ? 'green' : 'amber', palette);
    return out;
  };
  const generate = useTableReportGenerator({
    title: granularity === 'unit' ? 'Question Bank Submission Report (Unit Level)' : 'Question Bank Submission Report (Item Level)',
    columns, data: sorted, rowMapper,
    groupBy: groupBy !== 'none' ? groupBy : null,
    kpis: [
      { label: 'Total Units', value: totalUnits },
      { label: 'Total Items', value: totalItemsCount },
      { label: 'Submitted', value: submittedUnits, color: '#16A34A' },
      { label: 'Pending', value: pendingUnits, color: '#DC2626' },
    ],
    emptyText: 'No question bank units match the selected filters.',
  });

  return (
    <div className="section-card aca-rep-panel">
      <div className="aca-rep-panel-h">
        <div className="aca-rep-panel-t"><i className="fa-solid fa-book"></i> Question Bank Submission Report</div>
        <div className="aca-rep-panel-d">A question bank unit counts as submitted once every item inside it has been submitted. Switch to Item Level to see every individual item instead.</div>
      </div>

      <KpiStrip items={[
        { label: 'Total Units', value: totalUnits },
        { label: 'Total Items', value: totalItemsCount },
        { label: 'Submitted', value: submittedUnits, color: '#16A34A' },
        { label: 'Pending', value: pendingUnits, color: '#DC2626' },
      ]} />

      <div className="aca-rep-filters">
        <SegmentedControl
          label="Report Level" icon="fa-layer-group"
          options={[{ value: 'unit', label: 'Unit Level' }, { value: 'item', label: 'Item Level' }]}
          value={granularity} onChange={setGranularity}
        />
        <ChipMultiSelect label="Class" icon="fa-school" options={classList} selected={fClasses} onChange={setFClasses} />
        <ChipMultiSelect label="Subject" icon="fa-book" options={subjectList} selected={fSubjects} onChange={setFSubjects} />
        <ChipMultiSelect label="Teacher" icon="fa-chalkboard-user" options={teacherList} selected={fTeachers} onChange={setFTeachers} />
        <SegmentedControl
          label="Status" icon="fa-circle-check"
          options={[{ value: 'all', label: 'All' }, { value: 'submitted', label: 'Submitted' }, { value: 'pending', label: 'Pending' }]}
          value={fStatus} onChange={setFStatus}
        />
        <SegmentedControl
          label="Group By" icon="fa-layer-group"
          options={[{ value: 'none', label: 'None' }, { value: 'class', label: 'Class' }, { value: 'subject', label: 'Subject' }, { value: 'teacher', label: 'Teacher' }]}
          value={groupBy} onChange={setGroupBy}
        />
        <ColumnToggles label="Columns To Include" options={columnOptions} selected={effectiveCols} onChange={setCols} />
      </div>

      <ReportActions title="Question Bank Submission Report" disabled={effectiveCols.length === 0} onGenerate={generate} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   3. TEACHER WORKLOAD & COMPLIANCE REPORT
   ═══════════════════════════════════════════════════════════════════ */
const TW_COLUMNS_ALL = [
  { key: 'teacher', label: 'Teacher' }, { key: 'classes', label: 'Classes' }, { key: 'subjects', label: 'Subjects' },
  { key: 'lpTotal', label: 'Lesson Plans Total' }, { key: 'lpSubmitted', label: 'Lesson Plans Submitted' }, { key: 'lpPending', label: 'Lesson Plans Pending' },
  { key: 'nbTotal', label: 'Question Bank Total' }, { key: 'nbSubmitted', label: 'Question Bank Submitted' }, { key: 'nbPending', label: 'Question Bank Pending' },
];

function TeacherWorkloadReportPanel({ lpData, nbData, teacherAssignments, classList, subjectList, teacherList }) {
  const [fClasses, setFClasses] = useState([]);
  const [fSubjects, setFSubjects] = useState([]);
  const [fTeachers, setFTeachers] = useState([]);
  const [includeLp, setIncludeLp] = useState(true);
  const [includeNb, setIncludeNb] = useState(true);
  const [sortBy, setSortBy] = useState('teacher');

  const scopedAssignments = useMemo(() => teacherAssignments.filter(a =>
    (!fClasses.length || fClasses.includes(a.class)) && (!fSubjects.length || fSubjects.includes(a.subject))
  ), [teacherAssignments, fClasses, fSubjects]);

  const teacherNames = useMemo(() => {
    const names = Array.from(new Set(scopedAssignments.map(a => a.teacher)));
    return fTeachers.length ? names.filter(n => fTeachers.includes(n)) : names;
  }, [scopedAssignments, fTeachers]);

  const rows = useMemo(() => teacherNames.map(teacher => {
    const pairs = scopedAssignments.filter(a => a.teacher === teacher);
    const matches = rec => pairs.some(p => p.class === rec.class && p.subject === rec.subject);
    const tLp = lpData.filter(matches);
    const tNbUnits = nbData.filter(matches);
    const nbSub = tNbUnits.filter(u => nbUnitStatus(u) === 'submitted').length;
    return {
      teacher,
      classes: Array.from(new Set(pairs.map(p => p.class))).join(', '),
      subjects: Array.from(new Set(pairs.map(p => p.subject))).join(', '),
      lpTotal: tLp.length,
      lpSubmitted: tLp.filter(r => r.status === 'submitted').length,
      lpPending: tLp.filter(r => r.status !== 'submitted').length,
      nbTotal: tNbUnits.length,
      nbSubmitted: nbSub,
      nbPending: tNbUnits.length - nbSub,
    };
  }), [teacherNames, scopedAssignments, lpData, nbData]);

  const sorted = useMemo(() => [...rows].sort((a, b) => {
    if (sortBy === 'teacher') return a.teacher.localeCompare(b.teacher);
    return (b[sortBy] || 0) - (a[sortBy] || 0);
  }), [rows, sortBy]);

  const columns = TW_COLUMNS_ALL.filter(c => {
    if (!includeLp && c.key.startsWith('lp')) return false;
    if (!includeNb && c.key.startsWith('nb')) return false;
    return true;
  });
  const rowMapper = (r) => r;
  const generate = useTableReportGenerator({
    title: 'Teacher Workload & Compliance Report',
    columns, data: sorted, rowMapper,
    kpis: [
      { label: 'Teachers', value: sorted.length },
      { label: 'Lesson Plans Total', value: sorted.reduce((s, r) => s + r.lpTotal, 0) },
      { label: 'Question Bank Total', value: sorted.reduce((s, r) => s + r.nbTotal, 0) },
    ],
    emptyText: 'No teachers match the selected filters.',
  });

  return (
    <div className="section-card aca-rep-panel">
      <div className="aca-rep-panel-h">
        <div className="aca-rep-panel-t"><i className="fa-solid fa-chalkboard-user"></i> Teacher Workload &amp; Compliance Report</div>
        <div className="aca-rep-panel-d">Every teacher&apos;s lesson plans and question bank, summed across every class and subject they are assigned to teach.</div>
      </div>

      <KpiStrip items={[
        { label: 'Teachers', value: sorted.length },
        { label: 'Lesson Plans Total', value: sorted.reduce((s, r) => s + r.lpTotal, 0) },
        { label: 'Question Bank Total', value: sorted.reduce((s, r) => s + r.nbTotal, 0) },
      ]} />

      <div className="aca-rep-filters">
        <ChipMultiSelect label="Teacher" icon="fa-chalkboard-user" options={teacherList} selected={fTeachers} onChange={setFTeachers} />
        <ChipMultiSelect label="Class" icon="fa-school" options={classList} selected={fClasses} onChange={setFClasses} />
        <ChipMultiSelect label="Subject" icon="fa-book" options={subjectList} selected={fSubjects} onChange={setFSubjects} />
        <ColumnToggles
          label="Include"
          options={[{ key: 'lp', label: 'Lesson Plans' }, { key: 'nb', label: 'Question Bank' }]}
          selected={[includeLp && 'lp', includeNb && 'nb'].filter(Boolean)}
          onChange={(sel) => { setIncludeLp(sel.includes('lp')); setIncludeNb(sel.includes('nb')); }}
        />
        <SegmentedControl
          label="Sort By" icon="fa-arrow-down-wide-short"
          options={[{ value: 'teacher', label: 'Teacher Name' }, { value: 'lpTotal', label: 'Lesson Plans' }, { value: 'nbTotal', label: 'Question Bank' }]}
          value={sortBy} onChange={setSortBy}
        />
      </div>

      <ReportActions title="Teacher Workload & Compliance Report" disabled={!includeLp && !includeNb} onGenerate={generate} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   4. ACADEMIC ACTIVITIES REPORT
   ═══════════════════════════════════════════════════════════════════ */
const ACT_STATUSES = ['upcoming', 'ongoing', 'completed'];
const ACT_COLUMNS = [
  { key: 'name', label: 'Activity' }, { key: 'start', label: 'Start' }, { key: 'end', label: 'End' },
  { key: 'status', label: 'Status' }, { key: 'purpose', label: 'Purpose' },
  { key: 'development', label: 'Development' }, { key: 'resource', label: 'Resource' },
];
const ACT_TONE = { upcoming: 'amber', ongoing: 'green', completed: 'gray' };

function ActivitiesReportPanel({ activities }) {
  const [fStatuses, setFStatuses] = useState([]);
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');
  const [q, setQ] = useState('');
  const [groupBy, setGroupBy] = useState('none');
  const [cols, setCols] = useState(ACT_COLUMNS.map(c => c.key));

  const filtered = useMemo(() => activities.filter(a => {
    if (fStatuses.length && !fStatuses.includes(a.status)) return false;
    if (!inRange(a.start, fFrom, fTo)) return false;
    const term = q.trim().toLowerCase();
    if (term) {
      const hay = `${a.name} ${a.purpose || ''} ${a.development || ''} ${a.resource || ''}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  }), [activities, fStatuses, fFrom, fTo, q]);

  const sorted = useMemo(() => {
    if (groupBy === 'none') return [...filtered].sort((a, b) => new Date(a.start) - new Date(b.start));
    return [...filtered].sort((a, b) => String(a[groupBy]).localeCompare(String(b[groupBy])));
  }, [filtered, groupBy]);

  const counts = { upcoming: 0, ongoing: 0, completed: 0 };
  filtered.forEach(a => { if (counts[a.status] !== undefined) counts[a.status] += 1; });

  const columns = ACT_COLUMNS.filter(c => cols.includes(c.key));
  const rowMapper = (a, mode, palette) => ({
    name: a.name, start: fmtDate(a.start), end: fmtDate(a.end),
    status: mode === 'excel' ? (a.status[0].toUpperCase() + a.status.slice(1)) : reportStatusPill(a.status, ACT_TONE[a.status] || 'gray', palette),
    purpose: a.purpose || '—', development: a.development || '—', resource: a.resource || '—',
  });
  const generate = useTableReportGenerator({
    title: 'Academic Activities Report',
    columns, data: sorted, rowMapper,
    groupBy: groupBy !== 'none' ? groupBy : null,
    kpis: [
      { label: 'Total Activities', value: filtered.length },
      { label: 'Upcoming', value: counts.upcoming, color: '#D97706' },
      { label: 'Ongoing', value: counts.ongoing, color: '#16A34A' },
      { label: 'Completed', value: counts.completed, color: '#64748B' },
    ],
    emptyText: 'No activities match the selected filters.',
  });

  return (
    <div className="section-card aca-rep-panel">
      <div className="aca-rep-panel-h">
        <div className="aca-rep-panel-t"><i className="fa-solid fa-calendar-days"></i> Academic Activities Report</div>
        <div className="aca-rep-panel-d">Every activity on the Activity Calendar, filterable by status, date range and free text.</div>
      </div>

      <KpiStrip items={[
        { label: 'Total', value: filtered.length },
        { label: 'Upcoming', value: counts.upcoming, color: '#D97706' },
        { label: 'Ongoing', value: counts.ongoing, color: '#16A34A' },
        { label: 'Completed', value: counts.completed, color: '#64748B' },
      ]} />

      <div className="aca-rep-filters">
        <ChipMultiSelect label="Status" icon="fa-circle-check" options={ACT_STATUSES} selected={fStatuses} onChange={setFStatuses} />
        <DateRangeField from={fFrom} to={fTo} onFrom={setFFrom} onTo={setFTo} />
        <div className="aca-rep-field">
          <div className="aca-rep-flabel"><i className="fa-solid fa-magnifying-glass"></i> Search</div>
          <input className="form-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, purpose, development or resource…" />
        </div>
        <SegmentedControl
          label="Group By" icon="fa-layer-group"
          options={[{ value: 'none', label: 'None (By Date)' }, { value: 'status', label: 'Status' }]}
          value={groupBy} onChange={setGroupBy}
        />
        <ColumnToggles label="Columns To Include" options={ACT_COLUMNS} selected={cols} onChange={setCols} />
      </div>

      <ReportActions title="Academic Activities Report" disabled={cols.length === 0} onGenerate={generate} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   5. ACADEMIC SETUP REPORT — Session, Terms, Vacations, Textbooks
   (multi-section, PDF/Word only — no single flat table, so Excel
   is intentionally not offered rather than faked.)
   ═══════════════════════════════════════════════════════════════════ */
function AcademicSetupReportPanel({ session, terms, termData, vacations }) {
  /* Live classes + textbooks (replaces the demo's static CLASSES array). */
  const { data: CLASSES = [], loading: classesLoading } = useAsync(academicsService.getClassesWithSubjects, []);
  const [includeSession, setIncludeSession] = useState(true);
  const [includeTerms, setIncludeTerms] = useState(true);
  const [includeVacations, setIncludeVacations] = useState(true);
  const [includeTextbooks, setIncludeTextbooks] = useState(true);
  const [fClasses, setFClasses] = useState([]);

  const classList = CLASSES.map(c => c.name);
  const anySection = includeSession || includeTerms || includeVacations || includeTextbooks;

  const entriesCountFor = (termName) => {
    const t = terms.find(t => t.label === termName);
    return t ? (t.entries || []).length : 0;
  };

  const generate = (style, format) => {
    const isColor = style === 'color';
    const palette = reportPalette(isColor);
    const title = 'Academic Setup Report';
    let bodyHtml = '';

    if (includeSession && session) {
      bodyHtml += sectionHeadingHtml('Session Settings', palette);
      bodyHtml += buildReportTableHtml({
        columns: [{ key: 'field', label: 'Field' }, { key: 'value', label: 'Value' }],
        rows: [
          { field: 'Academic Year', value: session.year || '—' },
          { field: 'Session Start', value: fmtDate(session.start) },
          { field: 'Session End', value: fmtDate(session.end) },
          { field: 'Working Days Per Week', value: session.workingDaysPerWeek ?? '—' },
          { field: 'Total On Days', value: session.totalOnDays ?? '—' },
          { field: 'Working Days', value: session.workingDays ?? '—' },
          { field: 'Working Weeks', value: session.workingWeeks ?? '—' },
          { field: 'Holidays', value: session.holidays ?? '—' },
        ],
        isColor, emptyText: 'No session data.',
      });
    }

    if (includeTerms) {
      bodyHtml += sectionHeadingHtml('Terms', palette);
      bodyHtml += buildReportTableHtml({
        columns: [{ key: 'name', label: 'Term' }, { key: 'start', label: 'Start' }, { key: 'end', label: 'End' }, { key: 'entries', label: 'Calendar Entries' }],
        rows: termData.map(t => ({ name: t.name, start: fmtDate(t.start), end: fmtDate(t.end), entries: entriesCountFor(t.name) })),
        isColor, emptyText: 'No terms configured.',
      });
    }

    if (includeVacations) {
      bodyHtml += sectionHeadingHtml('Vacations', palette);
      bodyHtml += buildReportTableHtml({
        columns: [{ key: 'name', label: 'Vacation' }, { key: 'start', label: 'Start' }, { key: 'end', label: 'End' }],
        rows: vacations.map(v => ({ name: v.name, start: fmtDate(v.start), end: fmtDate(v.end) })),
        isColor, emptyText: 'No vacations configured.',
      });
    }

    if (includeTextbooks) {
      bodyHtml += sectionHeadingHtml('Textbooks', palette);
      const scopedClasses = fClasses.length ? CLASSES.filter(c => fClasses.includes(c.name)) : CLASSES;
      const rows = scopedClasses.flatMap(c => c.subjects.map(s => ({ class: c.name, subject: s.name, book: s.book || 'No textbook assigned' })));
      bodyHtml += buildReportTableHtml({
        columns: [{ key: 'class', label: 'Class' }, { key: 'subject', label: 'Subject' }, { key: 'book', label: 'Textbook' }],
        rows, isColor, groupKey: 'class', groupLabel: r => r.class,
        emptyText: 'No textbooks configured.',
      });
    }

    deliverAcademicsHtmlReport({ title, format, isColor, bodyHtml });
  };

  return (
    <div className="section-card aca-rep-panel">
      <div className="aca-rep-panel-h">
        <div className="aca-rep-panel-t"><i className="fa-solid fa-gears"></i> Academic Setup Report</div>
        <div className="aca-rep-panel-d">A combined snapshot of Session Settings, Terms, Vacations and Textbooks — choose which sections to include.</div>
      </div>

      <div className="aca-rep-filters">
        <ColumnToggles
          label="Sections To Include"
          options={[
            { key: 'session', label: 'Session Settings' }, { key: 'terms', label: 'Terms' },
            { key: 'vacations', label: 'Vacations' }, { key: 'textbooks', label: 'Textbooks' },
          ]}
          selected={[includeSession && 'session', includeTerms && 'terms', includeVacations && 'vacations', includeTextbooks && 'textbooks'].filter(Boolean)}
          onChange={(sel) => {
            setIncludeSession(sel.includes('session')); setIncludeTerms(sel.includes('terms'));
            setIncludeVacations(sel.includes('vacations')); setIncludeTextbooks(sel.includes('textbooks'));
          }}
        />
        {includeTextbooks && (
          <ChipMultiSelect label="Textbooks — Class" icon="fa-school" options={classList} selected={fClasses} onChange={setFClasses} />
        )}
      </div>

      <ReportActions title="Academic Setup Report" formats={['pdf', 'word']} disabled={!anySection || (includeTextbooks && classesLoading)} onGenerate={generate} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN TAB — tile selector + selected report panel
   ═══════════════════════════════════════════════════════════════════ */
const REPORT_TILES = [
  { id: 'lp', icon: 'fa-chalkboard', name: 'Lesson Plan Submission', desc: 'Submission status by class, subject and teacher' },
  { id: 'nb', icon: 'fa-book', name: 'Question Bank Submission', desc: 'Unit level or item level submission detail' },
  { id: 'tw', icon: 'fa-chalkboard-user', name: 'Teacher Workload & Compliance', desc: 'Every teacher, summed across classes and subjects' },
  { id: 'act', icon: 'fa-calendar-days', name: 'Academic Activities', desc: 'Activity Calendar, filterable by status and date' },
  { id: 'setup', icon: 'fa-gears', name: 'Academic Setup', desc: 'Session, Terms, Vacations and Textbooks' },
  { id: 'teacher', icon: 'fa-id-card', name: 'Teacher Performance & Activity', desc: 'A complete per-teacher workload and activity profile' },
];

export default function AcademicsReportsTab() {
  const [active, setActive] = useState('lp');
  const { can } = usePermissions();
  const canView = can('Academics', 'Reports', 'View');

  const { data: lpData = [] }              = useAsync(academicsService.getSubLpData, []);
  const { data: nbData = [] }              = useAsync(academicsService.getSubNbData, []);
  const { data: teacherAssignments = [] }  = useAsync(academicsService.getAcademicsTeacherAssignments, []);
  const { data: activities = [] }          = useAsync(academicsService.getActivities, []);
  const { data: terms = [] }               = useAsync(academicsService.getTerms, []);
  const { data: termData = [] }            = useAsync(academicsService.getTermData, []);
  const { data: session }                  = useAsync(academicsService.getSession, []);
  const { data: vacations = [] }           = useAsync(academicsService.getVacations, []);

  const classList = useMemo(() => Array.from(new Set(teacherAssignments.map(a => a.class))).sort(), [teacherAssignments]);
  const subjectList = useMemo(() => Array.from(new Set(teacherAssignments.map(a => a.subject))).sort(), [teacherAssignments]);
  const teacherList = useMemo(() => Array.from(new Set(teacherAssignments.map(a => a.teacher))).sort(), [teacherAssignments]);

  if (!canView) {
    return (
      <div className="section-card" style={{ padding: 20, color: 'var(--text-muted)' }}>
        You do not have permission to view Academics reports.
      </div>
    );
  }

  return (
    <>
      <style>{ACADEMICS_REPORTS_CSS}</style>
      <div className="aca-rep-tiles">
        {REPORT_TILES.map(t => (
          <button
            type="button" key={t.id}
            className={`aca-rep-tile${active === t.id ? ' active' : ''}`}
            onClick={() => setActive(t.id)}
          >
            <div className="aca-rep-tile-icon"><i className={`fa-solid ${t.icon}`}></i></div>
            <div className="aca-rep-tile-text">
              <div className="aca-rep-tile-name">{t.name}</div>
              <div className="aca-rep-tile-desc">{t.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {active === 'lp' && (
        <LessonPlanReportPanel lpData={lpData} classList={classList} subjectList={subjectList} teacherList={teacherList} />
      )}
      {active === 'nb' && (
        <NotebookPlanReportPanel nbData={nbData} classList={classList} subjectList={subjectList} teacherList={teacherList} />
      )}
      {active === 'tw' && (
        <TeacherWorkloadReportPanel
          lpData={lpData} nbData={nbData} teacherAssignments={teacherAssignments}
          classList={classList} subjectList={subjectList} teacherList={teacherList}
        />
      )}
      {active === 'act' && <ActivitiesReportPanel activities={activities} />}
      {active === 'setup' && (
        <AcademicSetupReportPanel session={session} terms={terms} termData={termData} vacations={vacations} />
      )}
      {active === 'teacher' && <TeacherPerformanceReportPanel />}
    </>
  );
}
