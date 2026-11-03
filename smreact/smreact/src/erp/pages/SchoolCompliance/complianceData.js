import { STATUS, COMPLIANCE_AREAS } from '../../mock/compliance';

/* ═══════════════════════════════════════════════════════════════════
   School Compliance — pure computation, same role as this app's other
   *Data.js / *DashboardExtra.js helper modules (auditLogsData.js,
   academicsDashboardExtra.js): no hooks, no side effects, called from
   useMemo in each page. Every number here is derived from real
   instance records (see complianceService.js) — nothing is a second,
   independently hand-typed total.
   ═══════════════════════════════════════════════════════════════════ */

export function pct(done, total) { return total ? Math.round((done / total) * 100) : 0; }

export function countByStatus(instances) {
  const c = { [STATUS.COMPLETED]: 0, [STATUS.NOT_CHECKED]: 0, [STATUS.ISSUE_FOUND]: 0, [STATUS.NOT_APPLICABLE]: 0 };
  instances.forEach(i => { c[i.status] = (c[i.status] || 0) + 1; });
  return c;
}

/* A task "counts" toward completion only when Completed or Not
   Applicable — Not Checked never counts as done, per the brief. */
export function completionPct(instances) {
  const done = instances.filter(i => i.status === STATUS.COMPLETED || i.status === STATUS.NOT_APPLICABLE);
  return pct(done.length, instances.length);
}

export function computeOverview({ todayInstances, overdueInstances, problems }) {
  const byStatus = countByStatus(todayInstances);
  const openProblems = problems.filter(p => p.status !== 'Resolved' && p.status !== 'Verified and Closed');
  return {
    totalToday: todayInstances.length,
    completed: byStatus[STATUS.COMPLETED],
    pending: byStatus[STATUS.NOT_CHECKED],
    overdue: overdueInstances.filter(i => i.status === STATUS.NOT_CHECKED).length,
    issuesFound: byStatus[STATUS.ISSUE_FOUND],
    openProblems: openProblems.length,
    criticalProblems: openProblems.filter(p => p.priority === 'Critical').length,
    completionPct: completionPct(todayInstances),
  };
}

export function computeAreaCompletion(instances) {
  return COMPLIANCE_AREAS.map(a => {
    const items = instances.filter(i => i.dashArea === a.id);
    return { ...a, total: items.length, completionPct: completionPct(items) };
  });
}

export function groupByArea(instances) {
  const map = new Map();
  instances.forEach(i => {
    if (!map.has(i.area)) map.set(i.area, { area: i.area, areaLabel: i.areaLabel, items: [] });
    map.get(i.area).items.push(i);
  });
  return [...map.values()].sort((a, b) => a.items[0]?.label < b.items[0]?.label ? -1 : 0);
}

export function filterInstances(instances, f = {}) {
  return instances.filter(i => {
    if (f.area && i.area !== f.area) return false;
    if (f.assignedTo && i.assignedTo !== f.assignedTo) return false;
    if (f.status && i.status !== f.status) return false;
    if (f.search) {
      const needle = f.search.toLowerCase();
      if (!`${i.label} ${i.assignedTo} ${i.remark}`.toLowerCase().includes(needle)) return false;
    }
    return true;
  });
}
