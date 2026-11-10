import React, { useMemo, useState } from 'react';
import { filterInstances } from './complianceData';
import { ChecklistGroup, FilterBar, Field, ProblemModal, EmptyState } from './ComplianceShared';
import useComplianceChecks, { groupItems, staffOptionsOf, categoryOf } from './useComplianceChecks';
import { STATUS, PROBLEM_CATEGORIES, COMPLIANCE_AREAS } from '../../mock/compliance';
import { todayIso, weekKeyOf, shiftWeekKey } from '../../services/complianceApi';

const DASH_ORDER = COMPLIANCE_AREAS.map(a => a.id);
const DASH_LABEL = new Map(COMPLIANCE_AREAS.map(a => [a.id, a.label]));

function weekLabel(weekKey) {
  const start = new Date(`${weekKey}T00:00:00`);
  const end = new Date(start); end.setDate(end.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

/* ═══════════════════════════════════════════════════════════════════
   WEEKLY CHECKS — Compliance Setup ke "Weekly Checks" tasks (backend
   task-list, type = weekly). Grouping Overview ke 6 dashboard areas
   par hai (Academics, Cleanliness & Hygiene, Staff & Attendance,
   Building & Facilities, Safety & Security, Administration) kyunke
   weekly tasks sab ek hi "Weekly Review" area mein rehte hain; har
   task ka Due Day Setup se aata hai.
   ═══════════════════════════════════════════════════════════════════ */
export default function WeeklyChecks({ toast, areas = [], tasks = null, onTasksChange = () => {} }) {
  const [weekKey, setWeekKey] = useState(() => weekKeyOf(todayIso()));

  /* Jo hafta dekh rahe hain wo chal raha ho to check aaj ki tareekh par
     save hota hai, warna us hafte ke Monday par */
  const checkDate = weekKey === weekKeyOf(todayIso()) ? todayIso() : weekKey;

  const { instances, employees, employeesLoading, update, saveProblem } = useComplianceChecks({
    frequency: 'weekly', periodKey: weekKey, checkDate, tasks, areas, onTasksChange, toast,
  });

  const [assignedTo, setAssignedTo] = useState('');
  const [status, setStatus] = useState('');
  const [problemModal, setProblemModal] = useState(null);

  const list = instances || [];
  const staffOptions = useMemo(() => staffOptionsOf(list), [list]);

  /* Due days — har task ka apna hai, is liye jo mojood hain wohi likhte hain */
  const dueDays = useMemo(() => [...new Set(list.map(i => i.dueDay).filter(Boolean))], [list]);

  const filtered = useMemo(() => filterInstances(list, { assignedTo, status }), [list, assignedTo, status]);
  const groups = useMemo(() => groupItems(filtered, {
    keyOf: i => i.dashArea,
    labelOf: i => DASH_LABEL.get(i.dashArea) || i.areaLabel || i.dashArea,
    order: DASH_ORDER,
  }), [filtered]);

  const reportProblem = (item, remark, photo) => {
    setProblemModal({
      title: item.label,
      description: remark || 'Issue found during the weekly review.',
      category: categoryOf(item.dashArea),
      location: item.areaLabel || 'Weekly Review',
      priority: item.verificationRequired ? 'High' : 'Medium',
      photo,
    });
  };

  const onSaveProblem = async (payload) => {
    if (await saveProblem(payload)) setProblemModal(null);
  };

  return (
    <>
      <FilterBar>
        <Field label="Week">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" className="btn btn-secondary" style={{ height: 38, padding: '0 10px' }} onClick={() => setWeekKey(w => shiftWeekKey(w, -1))}><i className="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
            <span style={{ fontWeight: 700, fontSize: 12.5, whiteSpace: 'nowrap' }}>{weekLabel(weekKey)}</span>
            <button type="button" className="btn btn-secondary" style={{ height: 38, padding: '0 10px' }} onClick={() => setWeekKey(w => shiftWeekKey(w, 1))}><i className="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
          </div>
        </Field>
        <Field label="Assigned Staff">
          <select className="form-input" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
            <option value="">All Staff</option>
            {staffOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select className="form-input" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value={STATUS.NOT_CHECKED}>Not Checked</option>
            <option value={STATUS.COMPLETED}>Completed</option>
            <option value={STATUS.ISSUE_FOUND}>Issue Found</option>
            <option value={STATUS.NOT_APPLICABLE}>Not Applicable</option>
          </select>
        </Field>
      </FilterBar>

      {!instances ? (
        <div className="cmp-card">Loading the weekly checklist…</div>
      ) : (
        <>
          <div className="cmp-card-sub" style={{ marginBottom: 14 }}>
            {filtered.length} task{filtered.length === 1 ? '' : 's'} for {weekLabel(weekKey)}
            {dueDays.length === 1 && <> — due every <b>{dueDays[0]}</b></>}
          </div>

          {groups.length === 0 ? (
            <EmptyState
              icon="fa-calendar-week"
              title={list.length ? 'No weekly checks match these filters' : 'No weekly checklist items yet'}
              sub={list.length ? 'Try widening the staff or status filter.' : 'Add weekly items from the Compliance Setup tab.'}
            />
          ) : groups.map(g => (
            <ChecklistGroup key={g.area} group={g} onUpdate={update} onReportProblem={reportProblem} defaultOpen />
          ))}
        </>
      )}

      <ProblemModal
        open={!!problemModal} initial={problemModal}
        categories={PROBLEM_CATEGORIES}
        employees={employees} employeesLoading={employeesLoading}
        onClose={() => setProblemModal(null)} onSave={onSaveProblem}
      />
    </>
  );
}
