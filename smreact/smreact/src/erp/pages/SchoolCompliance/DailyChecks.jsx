import React, { useMemo, useState } from 'react';
import { filterInstances } from './complianceData';
import { ChecklistGroup, FilterBar, Field, ProblemModal, EmptyState } from './ComplianceShared';
import useComplianceChecks, { groupItems, staffOptionsOf, categoryOf } from './useComplianceChecks';
import { useComplianceActions } from './compliancePermissions';
import { STATUS, PROBLEM_CATEGORIES, DAILY_AREA_OPTIONS } from '../../mock/compliance';
import { todayIso } from '../../services/complianceApi';

const DAILY_ORDER = DAILY_AREA_OPTIONS.map(a => a.id);

/* ═══════════════════════════════════════════════════════════════════
   DAILY CHECKS — School Opening → School Closing routine. Tasks wohi
   hain jo Compliance Setup mein "Daily Checks" ke neeche banti hain
   (backend task-list), areas bhi backend ke hain — school ka apna
   naya area / task bhi yahan khud hi aa jata hai.

   Status / remark / evidence photo seedha backend par save hote hain
   (task-action), aur "Issue Found" asli problem-report API se Problems
   & Follow-ups mein chala jata hai. Tafseel useComplianceChecks.js ke
   header mein hai (per-date history ki backend limitation samet).
   ═══════════════════════════════════════════════════════════════════ */
export default function DailyChecks({ toast, areas = [], tasks = null, onTasksChange = () => {} }) {
  const [date, setDate] = useState(todayIso);

  const { instances, employees, employeesLoading, busy, update, bulkComplete, saveProblem } = useComplianceChecks({
    frequency: 'daily', periodKey: date, checkDate: date, tasks, areas, onTasksChange, toast,
  });

  const [area, setArea] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [status, setStatus] = useState('');
  const [problemModal, setProblemModal] = useState(null);

  /* Permissions — Edit: status/remark/photo/Save; Create: Issue Found par
     Report-a-Problem; Approve: Verify Completion. Sirf View = read-only. */
  const perms = useComplianceActions('daily');

  const list = instances || [];

  /* Area aur staff dropdown — jo asal mein in tasks par mojood hain */
  const areaOptions = useMemo(() => groupItems(list, { order: DAILY_ORDER })
    .map(g => ({ id: g.area, label: g.areaLabel })), [list]);
  const staffOptions = useMemo(() => staffOptionsOf(list), [list]);

  const filtered = useMemo(() => filterInstances(list, { area, assignedTo, status }), [list, area, assignedTo, status]);
  const groups = useMemo(() => groupItems(filtered, { order: DAILY_ORDER }), [filtered]);

  const reportProblem = (item, remark, photo) => {
    setProblemModal({
      title: item.label,
      description: remark || `Issue found during the ${item.areaLabel} daily check.`,
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
        <Field label="Date"><input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value || todayIso())} /></Field>
        <Field label="Inspection Area">
          <select className="form-input" value={area} onChange={e => setArea(e.target.value)}>
            <option value="">All Areas</option>
            {areaOptions.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
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
        <div className="cmp-card">Loading today's checklist…</div>
      ) : (
        <>
          <div className="cmp-card-h" style={{ marginBottom: 14 }}>
            <div className="cmp-card-sub">
              {filtered.length} task{filtered.length === 1 ? '' : 's'} for {date}
              {date !== todayIso() && ' — you are viewing another date'}
            </div>
            {perms.canEdit && (
            <button type="button" className="btn btn-secondary" disabled={busy || !filtered.length} onClick={() => bulkComplete(filtered)}>
              <i className="fa-solid fa-check-double" aria-hidden="true"></i> Mark All Non-Safety Tasks Completed
            </button>
            )}
          </div>

          {groups.length === 0 ? (
            <EmptyState
              icon="fa-clipboard-check"
              title={list.length ? 'No tasks match these filters' : 'No daily checklist items yet'}
              sub={list.length ? 'Try widening the area, staff, or status filter.' : 'Add daily items from the Compliance Setup tab.'}
            />
          ) : groups.map(g => (
            <ChecklistGroup key={g.area} group={g} onUpdate={update} onReportProblem={reportProblem} perms={perms} />
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
