import React, { useMemo, useState } from 'react';
import { filterInstances } from './complianceData';
import { ChecklistGroup, FilterBar, Field, ProblemModal, EmptyState } from './ComplianceShared';
import useComplianceChecks, { groupItems, staffOptionsOf, categoryOf } from './useComplianceChecks';
import { useComplianceActions } from './compliancePermissions';
import { STATUS, PROBLEM_CATEGORIES, MONTHLY_CATEGORY_OPTIONS } from '../../mock/compliance';
import { todayIso, monthKeyOf, shiftMonthKey } from '../../services/complianceApi';

const MONTHLY_ORDER = MONTHLY_CATEGORY_OPTIONS.map(c => c.id);

function monthLabel(mKey) {
  const [y, m] = String(mKey).split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/* ═══════════════════════════════════════════════════════════════════
   MONTHLY REVIEW — Compliance Setup ke "Monthly Review" tasks (backend
   task-list, type = monthly), apni apni category ke group mein (Staff
   Planning & Review, Academic Review, Meetings, Building & Safety,
   Administration & Records, Finance & Resources — aur school ki apni
   banayi hui koi bhi nayi category).

   "Meeting notes" / "discussion points" har Meetings item ke apne
   remark field se aate hain (wohi remark backend par task ke saath
   save hota hai) — koi alag notes system nahi.
   ═══════════════════════════════════════════════════════════════════ */
export default function MonthlyReview({ toast, areas = [], tasks = null, onTasksChange = () => {} }) {
  const [mKey, setMKey] = useState(() => monthKeyOf(todayIso()));

  /* Chalta mahina ho to check aaj ki tareekh par, warna us mahine ki 1 */
  const checkDate = mKey === monthKeyOf(todayIso()) ? todayIso() : `${mKey}-01`;

  const { instances, employees, employeesLoading, update, saveProblem } = useComplianceChecks({
    frequency: 'monthly', periodKey: mKey, checkDate, tasks, areas, onTasksChange, toast,
  });

  const [assignedTo, setAssignedTo] = useState('');
  const [status, setStatus] = useState('');
  const [problemModal, setProblemModal] = useState(null);

  /* Permissions — Edit: status/remark/photo/Save; Create: Issue Found par
     Report-a-Problem; Approve: Verify Completion. Sirf View = read-only. */
  const perms = useComplianceActions('monthly');

  const list = instances || [];
  const staffOptions = useMemo(() => staffOptionsOf(list), [list]);

  const filtered = useMemo(() => filterInstances(list, { assignedTo, status }), [list, assignedTo, status]);
  const groups = useMemo(() => groupItems(filtered, { order: MONTHLY_ORDER }), [filtered]);

  const reportProblem = (item, remark, photo) => {
    setProblemModal({
      title: item.label,
      description: remark || 'Issue found during the monthly review.',
      category: categoryOf(item.dashArea),
      location: item.areaLabel,
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
        <Field label="Month">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" className="btn btn-secondary" style={{ height: 38, padding: '0 10px' }} onClick={() => setMKey(k => shiftMonthKey(k, -1))}><i className="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
            <span style={{ fontWeight: 700, fontSize: 12.5, whiteSpace: 'nowrap' }}>{monthLabel(mKey)}</span>
            <button type="button" className="btn btn-secondary" style={{ height: 38, padding: '0 10px' }} onClick={() => setMKey(k => shiftMonthKey(k, 1))}><i className="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
          </div>
        </Field>
        <Field label="Responsible Person">
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
        <div className="cmp-card">Loading the monthly review…</div>
      ) : (
        <>
          <div className="cmp-card-sub" style={{ marginBottom: 14 }}>
            {filtered.length} task{filtered.length === 1 ? '' : 's'} for {monthLabel(mKey)}
          </div>

          {groups.length === 0 ? (
            <EmptyState
              icon="fa-calendar-days"
              title={list.length ? 'No monthly review items match these filters' : 'No monthly review items yet'}
              sub={list.length ? 'Try widening the staff or status filter.' : 'Add monthly items from the Compliance Setup tab.'}
            />
          ) : groups.map((g, i) => (
            <ChecklistGroup key={g.area} group={g} onUpdate={update} onReportProblem={reportProblem} perms={perms} defaultOpen={i === 0} />
          ))}
        </>
      )}

      <ProblemModal
        open={perms.canCreate && !!problemModal} initial={problemModal}
        categories={PROBLEM_CATEGORIES}
        employees={employees} employeesLoading={employeesLoading}
        onClose={() => setProblemModal(null)} onSave={onSaveProblem}
      />
    </>
  );
}
