import React, { useMemo, useState } from 'react';
import { filterInstances } from './complianceData';
import { ChecklistGroup, FilterBar, Field, ProblemModal, EmptyState } from './ComplianceShared';
import useComplianceChecks, { groupItems, staffOptionsOf, filterByStaff, categoryOf } from './useComplianceChecks';
import { useComplianceActions } from './compliancePermissions';
import { STATUS, PROBLEM_CATEGORIES, DAILY_AREA_OPTIONS } from '../../mock/compliance';
import { todayIso, areasOfType, norm } from '../../services/complianceApi';

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
export default function DailyChecks({ toast, areas = [], tasks = null, onTasksChange = () => {}, employees: branchEmployees = [], employeesLoading: branchEmployeesLoading = false, onProblemsChange = () => {} }) {
  const [date, setDate] = useState(todayIso);

  const { instances, employees, employeesLoading, busy, update, bulkComplete, saveProblem } = useComplianceChecks({
    frequency: 'daily', periodKey: date, checkDate: date, tasks, areas, onTasksChange, toast,
    employees: branchEmployees, employeesLoading: branchEmployeesLoading, onProblemsChange,
  });

  const [area, setArea] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [status, setStatus] = useState('');
  const [problemModal, setProblemModal] = useState(null);

  /* Permissions — Edit: status/remark/photo/Save; Create: Issue Found par
     Report-a-Problem; Approve: Verify Completion. Sirf View = read-only. */
  const perms = useComplianceActions('daily');

  const list = instances || [];

  /* Inspection Area dropdown — branch ke SAARE daily areas (area-list),
     chahe us din un mein task ho ya na ho. Id wahi banti hai jo
     toTemplate task ko deta hai (fixed area ki id, warna area-<naam>),
     ta ke filter match kare. */
  const areaOptions = useMemo(() => {
    const map = new Map();
    areasOfType(areas, 'daily').forEach(a => {
      const local = DAILY_AREA_OPTIONS.find(o => norm(o.label) === norm(a.name));
      const id = local?.id ?? `area-${norm(a.name)}`;
      if (a.name && !map.has(id)) map.set(id, { id, label: a.name });
    });
    /* Kisi task ka area list mein na ho (purana data) to wo bhi rahe */
    groupItems(list).forEach(g => { if (!map.has(g.area)) map.set(g.area, { id: g.area, label: g.areaLabel }); });
    const opts = [...map.values()];
    return [
      ...DAILY_ORDER.map(id => opts.find(o => o.id === id)).filter(Boolean),
      ...opts.filter(o => !DAILY_ORDER.includes(o.id)),
    ];
  }, [areas, list]);
  const staffOptions = useMemo(() => staffOptionsOf(employees), [employees]);

  const filtered = useMemo(() => filterInstances(filterByStaff(list, assignedTo, employees), { area, status }), [list, area, assignedTo, status, employees]);
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
          <select className="form-input" value={assignedTo} onChange={e => setAssignedTo(e.target.value)} disabled={employeesLoading}>
            <option value="">{employeesLoading ? "Loading staff…" : "All Staff"}</option>
            {staffOptions.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
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
              title={list.length ? 'No tasks match these filters' : (date === todayIso() ? 'Tasks are not added today' : `Tasks are not added on ${date}`)}
              sub={list.length ? 'Try widening the area, staff, or status filter.' : 'Pick another date to see other records, or add daily items from the Compliance Setup tab.'}
            />
          ) : groups.map(g => (
            <ChecklistGroup key={g.area} group={g} onUpdate={update} onReportProblem={reportProblem} perms={perms} defaultOpen />
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
