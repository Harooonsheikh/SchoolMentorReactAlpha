import React, { useMemo, useState } from 'react';
import useAsync from '../../hooks/useAsync';
import * as complianceService from '../../services/complianceService';
import { TODAY_ISO } from '../../services/complianceService';
import { filterInstances } from './complianceData';
import { ChecklistGroup, FilterBar, Field, ProblemModal, EmptyState } from './ComplianceShared';
import { STATUS, ROLE_STAFF, DAILY_TEMPLATES } from '../../mock/compliance';

const DAILY_STAFF = [...new Set(Object.values(ROLE_STAFF).flat())];
const DAILY_AREAS = [...new Set(DAILY_TEMPLATES.map(t => t.area))].map(area => ({
  id: area, label: DAILY_TEMPLATES.find(t => t.area === area).areaLabel,
}));

/* ═══════════════════════════════════════════════════════════════════
   DAILY CHECKS — the School Opening → School Closing routine, grouped
   into the 8 areas from the brief, each a collapsible ChecklistGroup.
   Status updates go through complianceService.updateInstance, which
   genuinely persists for the session (see that file's header comment).
   ═══════════════════════════════════════════════════════════════════ */
export default function DailyChecks({ toast }) {
  const [date, setDate] = useState(TODAY_ISO);
  const { data: instances = [], refetch } = useAsync(() => complianceService.getDailyInstances(date), [date]);

  const [area, setArea] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [status, setStatus] = useState('');
  const [problemModal, setProblemModal] = useState(null); // { title, description, category, location, priority } | null

  const filtered = useMemo(() => filterInstances(instances, { area, assignedTo, status }), [instances, area, assignedTo, status]);
  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach(i => {
      if (!map.has(i.area)) map.set(i.area, { area: i.area, areaLabel: i.areaLabel, items: [] });
      map.get(i.area).items.push(i);
    });
    return DAILY_AREAS.map(a => map.get(a.id)).filter(Boolean);
  }, [filtered]);

  const update = async (id, patch) => {
    await complianceService.updateInstance('daily', id, patch);
    refetch();
    if (patch.status) toast(`Marked "${patch.status.replace('_', ' ')}"`, 'success');
  };

  const reportProblem = (item, remark, photo) => {
    setProblemModal({
      title: item.label,
      description: remark || `Issue found during the ${item.areaLabel} daily check.`,
      category: areaToCategory(item.area),
      location: item.areaLabel,
      priority: item.verificationRequired ? 'High' : 'Medium',
      photo,
    });
  };

  const saveProblem = async (payload) => {
    await complianceService.createProblem({ ...payload, reportedBy: 'Dr. Islahudin' });
    setProblemModal(null);
    toast('Problem reported — visible in Problems & Follow-ups.', 'success');
  };

  const bulkCompleteSafe = async () => {
    const todo = filtered.filter(i => i.status === STATUS.NOT_CHECKED && !i.verificationRequired);
    const skipped = filtered.filter(i => i.status === STATUS.NOT_CHECKED && i.verificationRequired).length;
    await Promise.all(todo.map(i => complianceService.updateInstance('daily', i.id, { status: STATUS.COMPLETED })));
    refetch();
    toast(`Marked ${todo.length} task${todo.length === 1 ? '' : 's'} as Completed${skipped ? ` — ${skipped} safety check${skipped === 1 ? '' : 's'} skipped (complete those individually).` : '.'}`, 'success');
  };

  return (
    <>
      <FilterBar>
        <Field label="Date"><input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Inspection Area">
          <select className="form-input" value={area} onChange={e => setArea(e.target.value)}>
            <option value="">All Areas</option>
            {DAILY_AREAS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </Field>
        <Field label="Assigned Staff">
          <select className="form-input" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
            <option value="">All Staff</option>
            {DAILY_STAFF.map(s => <option key={s} value={s}>{s}</option>)}
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

      <div className="cmp-card-h" style={{ marginBottom: 14 }}>
        <div className="cmp-card-sub">{filtered.length} task{filtered.length === 1 ? '' : 's'} for {date}</div>
        <button type="button" className="btn btn-secondary" onClick={bulkCompleteSafe}>
          <i className="fa-solid fa-check-double" aria-hidden="true"></i> Mark All Non-Safety Tasks Completed
        </button>
      </div>

      {groups.length === 0 ? (
        <EmptyState icon="fa-clipboard-check" title="No tasks match these filters" sub="Try widening the area, staff, or status filter." />
      ) : groups.map(g => (
        <ChecklistGroup key={g.area} group={g} onUpdate={update} onReportProblem={reportProblem} />
      ))}

      <ProblemModal
        open={!!problemModal} initial={problemModal}
        categories={['Cleanliness', 'Facilities', 'Safety', 'Staff', 'Academics', 'Administration']}
        staffOptions={DAILY_STAFF}
        onClose={() => setProblemModal(null)} onSave={saveProblem}
      />
    </>
  );
}

function areaToCategory(area) {
  if (area === 'cleanliness') return 'Cleanliness';
  if (area === 'playground') return 'Safety';
  if (area === 'labs') return 'Facilities';
  if (area === 'classrooms' || area === 'assembly') return 'Academics';
  if (area === 'admin_staff') return 'Staff';
  return 'Administration';
}
