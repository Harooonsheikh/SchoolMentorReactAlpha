import React, { useMemo, useState } from 'react';
import useAsync from '../../hooks/useAsync';
import * as complianceService from '../../services/complianceService';
import { TODAY_ISO, isoWeekKey } from '../../services/complianceService';
import { filterInstances } from './complianceData';
import { ChecklistGroup, FilterBar, Field, ProblemModal, EmptyState } from './ComplianceShared';
import { STATUS, ROLE_STAFF, COMPLIANCE_AREAS } from '../../mock/compliance';

const WEEKLY_STAFF = [...new Set(Object.values(ROLE_STAFF).flat())];

function shiftWeek(weekKey, delta) {
  const d = new Date(`${weekKey}T00:00:00`);
  d.setDate(d.getDate() + delta * 7);
  return d.toISOString().slice(0, 10);
}
function weekLabel(weekKey) {
  const start = new Date(`${weekKey}T00:00:00`);
  const end = new Date(start); end.setDate(end.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

/* ═══════════════════════════════════════════════════════════════════
   WEEKLY CHECKS — the 11-item weekly review, grouped by the same 6
   dashboard areas as Overview's "Compliance by Area" (Academics,
   Cleanliness & Hygiene, Staff & Attendance, Building & Facilities,
   Safety & Security, Administration) so the grouping stays meaningful
   even though weekly items don't have the daily routine's 8 areas.
   The school can choose which weekday weekly checks are due on from
   Compliance Setup (WEEKLY_TEMPLATES' dueDay field).
   ═══════════════════════════════════════════════════════════════════ */
export default function WeeklyChecks({ toast }) {
  const [weekKey, setWeekKey] = useState(isoWeekKey(TODAY_ISO));
  const { data: instances = [], refetch } = useAsync(() => complianceService.getWeeklyInstances(weekKey), [weekKey]);
  const { data: templates = [] } = useAsync(complianceService.getWeeklyTemplates, []);

  const [assignedTo, setAssignedTo] = useState('');
  const [status, setStatus] = useState('');
  const [problemModal, setProblemModal] = useState(null);

  const dueDay = templates[0]?.dueDay || 'Friday';
  const filtered = useMemo(() => filterInstances(instances, { assignedTo, status }), [instances, assignedTo, status]);
  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach(i => {
      if (!map.has(i.dashArea)) map.set(i.dashArea, { area: i.dashArea, areaLabel: COMPLIANCE_AREAS.find(a => a.id === i.dashArea)?.label || i.dashArea, items: [] });
      map.get(i.dashArea).items.push(i);
    });
    return COMPLIANCE_AREAS.map(a => map.get(a.id)).filter(Boolean);
  }, [filtered]);

  const update = async (id, patch) => {
    await complianceService.updateInstance('weekly', id, patch);
    refetch();
    if (patch.status) toast(`Marked "${patch.status.replace('_', ' ')}"`, 'success');
  };

  const reportProblem = (item, remark, photo) => {
    setProblemModal({ title: item.label, description: remark || 'Issue found during the weekly review.', category: 'Administration', location: 'Weekly Review', priority: 'Medium', photo });
  };
  const saveProblem = async (payload) => {
    await complianceService.createProblem({ ...payload, reportedBy: 'Dr. Islahudin' });
    setProblemModal(null);
    toast('Problem reported — visible in Problems & Follow-ups.', 'success');
  };

  return (
    <>
      <FilterBar>
        <Field label="Week">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" className="btn btn-secondary" style={{ height: 38, padding: '0 10px' }} onClick={() => setWeekKey(w => shiftWeek(w, -1))}><i className="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
            <span style={{ fontWeight: 700, fontSize: 12.5, whiteSpace: 'nowrap' }}>{weekLabel(weekKey)}</span>
            <button type="button" className="btn btn-secondary" style={{ height: 38, padding: '0 10px' }} onClick={() => setWeekKey(w => shiftWeek(w, 1))}><i className="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
          </div>
        </Field>
        <Field label="Assigned Staff">
          <select className="form-input" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
            <option value="">All Staff</option>
            {WEEKLY_STAFF.map(s => <option key={s} value={s}>{s}</option>)}
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

      <div className="cmp-card-sub" style={{ marginBottom: 14 }}>
        {filtered.length} task{filtered.length === 1 ? '' : 's'} due every <b>{dueDay}</b>
      </div>

      {groups.length === 0 ? (
        <EmptyState icon="fa-calendar-week" title="No weekly checks match these filters" />
      ) : groups.map(g => (
        <ChecklistGroup key={g.area} group={g} onUpdate={update} onReportProblem={reportProblem} defaultOpen />
      ))}

      <ProblemModal
        open={!!problemModal} initial={problemModal}
        categories={['Cleanliness', 'Facilities', 'Safety', 'Staff', 'Academics', 'Administration']}
        staffOptions={WEEKLY_STAFF}
        onClose={() => setProblemModal(null)} onSave={saveProblem}
      />
    </>
  );
}
