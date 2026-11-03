import React, { useMemo, useState } from 'react';
import useAsync from '../../hooks/useAsync';
import * as complianceService from '../../services/complianceService';
import { TODAY_ISO, monthKey } from '../../services/complianceService';
import { filterInstances } from './complianceData';
import { ChecklistGroup, FilterBar, Field, ProblemModal, EmptyState } from './ComplianceShared';
import { STATUS, ROLE_STAFF } from '../../mock/compliance';

const MONTHLY_STAFF = [...new Set(Object.values(ROLE_STAFF).flat())];

function shiftMonth(mKey, delta) {
  const [y, m] = mKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(mKey) {
  const [y, m] = mKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/* ═══════════════════════════════════════════════════════════════════
   MONTHLY REVIEW — the 6 categories from the brief (Staff Planning &
   Review, Academic Review, Meetings, Building & Safety, Administration
   & Records, Finance & Resources), each a ChecklistGroup. "Meeting
   notes" / "discussion points" / "action items" are captured through
   each Meetings item's own remark field (e.g. the remark on "Record
   meeting date and attendees" IS the meeting note) rather than a
   second, separate notes system — the same generic status+remark+
   evidence model every checklist item already has covers this
   without duplicating functionality.

   Finance & Resources is flagged `restrictedToPermission: 'cmp.finance'`
   on its templates (see mock/compliance.js) — this app has no signed-
   in user/auth concept anywhere (confirmed), so, consistent with how
   every other module here declares permissions without a runtime
   gate to enforce them against, this group is always rendered but
   clearly labelled so a real backend's permission check has an
   obvious place to plug in.
   ═══════════════════════════════════════════════════════════════════ */
export default function MonthlyReview({ toast }) {
  const [mKey, setMKey] = useState(monthKey(TODAY_ISO));
  const { data: instances = [], refetch } = useAsync(() => complianceService.getMonthlyInstances(mKey), [mKey]);

  const [assignedTo, setAssignedTo] = useState('');
  const [status, setStatus] = useState('');
  const [problemModal, setProblemModal] = useState(null);

  const filtered = useMemo(() => filterInstances(instances, { assignedTo, status }), [instances, assignedTo, status]);
  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach(i => {
      if (!map.has(i.area)) map.set(i.area, { area: i.area, areaLabel: i.areaLabel, items: [] });
      map.get(i.area).items.push(i);
    });
    return [...map.values()];
  }, [filtered]);

  const update = async (id, patch) => {
    await complianceService.updateInstance('monthly', id, patch);
    refetch();
    if (patch.status) toast(`Marked "${patch.status.replace('_', ' ')}"`, 'success');
  };
  const reportProblem = (item, remark, photo) => {
    setProblemModal({ title: item.label, description: remark || 'Issue found during the monthly review.', category: 'Administration', location: item.areaLabel, priority: 'Medium', photo });
  };
  const saveProblem = async (payload) => {
    await complianceService.createProblem({ ...payload, reportedBy: 'Dr. Islahudin' });
    setProblemModal(null);
    toast('Problem reported — visible in Problems & Follow-ups.', 'success');
  };

  return (
    <>
      <FilterBar>
        <Field label="Month">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" className="btn btn-secondary" style={{ height: 38, padding: '0 10px' }} onClick={() => setMKey(k => shiftMonth(k, -1))}><i className="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
            <span style={{ fontWeight: 700, fontSize: 12.5, whiteSpace: 'nowrap' }}>{monthLabel(mKey)}</span>
            <button type="button" className="btn btn-secondary" style={{ height: 38, padding: '0 10px' }} onClick={() => setMKey(k => shiftMonth(k, 1))}><i className="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
          </div>
        </Field>
        <Field label="Responsible Person">
          <select className="form-input" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
            <option value="">All Staff</option>
            {MONTHLY_STAFF.map(s => <option key={s} value={s}>{s}</option>)}
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

      <div className="cmp-card-sub" style={{ marginBottom: 14 }}>{filtered.length} task{filtered.length === 1 ? '' : 's'} for {monthLabel(mKey)}</div>

      {groups.length === 0 ? (
        <EmptyState icon="fa-calendar-days" title="No monthly review items match these filters" />
      ) : groups.map(g => (
        <ChecklistGroup key={g.area} group={g} onUpdate={update} onReportProblem={reportProblem} defaultOpen={g.area === 'staff'} />
      ))}

      <ProblemModal
        open={!!problemModal} initial={problemModal}
        categories={['Cleanliness', 'Facilities', 'Safety', 'Staff', 'Academics', 'Administration']}
        staffOptions={MONTHLY_STAFF}
        onClose={() => setProblemModal(null)} onSave={saveProblem}
      />
    </>
  );
}
