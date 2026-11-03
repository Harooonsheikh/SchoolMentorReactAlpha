import React, { useMemo } from 'react';
import useAsync from '../../hooks/useAsync';
import * as complianceService from '../../services/complianceService';
import { TODAY_ISO, isoDaysAgo } from '../../services/complianceService';
import { computeOverview, computeAreaCompletion } from './complianceData';
import { SummaryCard, StatusBadge, ProblemStatusBadge, PriorityBadge, initials } from './ComplianceShared';
import { STATUS } from '../../mock/compliance';

/* ═══════════════════════════════════════════════════════════════════
   OVERVIEW — the compliance dashboard. Every figure here is computed
   from the same real instance/problem records the other tabs read and
   write (complianceService.js) — nothing is a second, independently
   hand-typed total (see complianceData.js's computeOverview).
   ═══════════════════════════════════════════════════════════════════ */
export default function Overview({ toast, onNavigate }) {
  const { data: todayInstances = [] }     = useAsync(() => complianceService.getDailyInstances(TODAY_ISO), []);
  const { data: yesterdayInstances = [] } = useAsync(() => complianceService.getDailyInstances(isoDaysAgo(1)), []);
  const { data: problems = [] }           = useAsync(complianceService.getProblems, []);

  const overview = useMemo(() => computeOverview({ todayInstances, overdueInstances: yesterdayInstances, problems }), [todayInstances, yesterdayInstances, problems]);
  const areaCompletion = useMemo(() => computeAreaCompletion(todayInstances), [todayInstances]);

  const pendingProblems = useMemo(() => problems
    .filter(p => p.status !== 'Resolved' && p.status !== 'Verified and Closed')
    .sort((a, b) => {
      const order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      return (order[a.priority] ?? 9) - (order[b.priority] ?? 9);
    }), [problems]);

  const recentActivity = useMemo(() => {
    const fromProblems = problems.flatMap(p => p.history.map(h => ({ date: h.date, text: `${h.by} — ${h.action}`, ref: p.title })));
    const fromInstances = todayInstances.filter(i => i.updatedAt).map(i => ({ date: i.updatedAt, text: `${i.assignedTo} updated "${i.label}" to ${i.status.replace('_', ' ')}`, ref: i.areaLabel }));
    return [...fromProblems, ...fromInstances].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
  }, [problems, todayInstances]);

  const criticalOpen = pendingProblems.filter(p => p.priority === 'Critical');

  return (
    <>
      {criticalOpen.length > 0 && (
        <div className="cmp-critical-banner">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
          {criticalOpen.length} critical safety {criticalOpen.length === 1 ? 'issue needs' : 'issues need'} immediate attention — see Problems &amp; Follow-ups.
        </div>
      )}

      <div className="cmp-stats">
        <SummaryCard icon="fa-list-check"   label="Total Tasks Today" value={overview.totalToday} tone="brand" />
        <SummaryCard icon="fa-circle-check" label="Completed Tasks"   value={overview.completed}  tone="green" />
        <SummaryCard icon="fa-hourglass-half" label="Pending Tasks"   value={overview.pending}    tone="amber" />
        <SummaryCard icon="fa-clock-rotate-left" label="Overdue Tasks" value={overview.overdue}   tone="red" sub="From yesterday, still not checked" />
        <SummaryCard icon="fa-triangle-exclamation" label="Open Problems" value={overview.openProblems} tone="purple" sub={overview.criticalProblems ? `${overview.criticalProblems} critical` : undefined} />
        <SummaryCard icon="fa-chart-pie"    label="Overall Completion" value={`${overview.completionPct}%`} tone="teal" />
      </div>

      <div className="cmp-card">
        <div className="cmp-card-h">
          <div>
            <div className="cmp-card-title"><i className="fa-solid fa-calendar-day" aria-hidden="true"></i> Today's Checklist</div>
            <div className="cmp-card-sub">Tasks due today, grouped by inspection area</div>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => onNavigate('daily')}>
            Open Daily Checks <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </button>
        </div>
        <div className="cmp-table-wrap">
          <table className="cmp-table">
            <thead><tr><th>Task</th><th>Area</th><th>Assigned</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {todayInstances.slice(0, 10).map(i => (
                <tr key={i.id}>
                  <td>{i.label}</td>
                  <td>{i.areaLabel}</td>
                  <td><span className="cmp-avatar">{initials(i.assignedTo)}</span> {i.assignedTo}</td>
                  <td><StatusBadge status={i.status} /></td>
                  <td>
                    {i.status === STATUS.NOT_CHECKED && (
                      <button type="button" className="btn btn-secondary" style={{ height: 30, padding: '0 10px', fontSize: 11 }} onClick={() => onNavigate('daily')}>
                        Open
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="cmp-card">
        <div className="cmp-card-title"><i className="fa-solid fa-chart-simple" aria-hidden="true"></i> Compliance by Area</div>
        <div style={{ marginTop: 10 }}>
          {areaCompletion.map(a => (
            <div key={a.id} className="cmp-area-row">
              <div className="cmp-area-label"><i className={`fa-solid ${a.icon}`} aria-hidden="true"></i> {a.label}</div>
              <div className="cmp-area-bar-track"><div className="cmp-area-bar-fill" style={{ width: `${a.completionPct}%` }} /></div>
              <div className="cmp-area-pct">{a.completionPct}%</div>
            </div>
          ))}
        </div>
      </div>

      <div className="cmp-card">
        <div className="cmp-card-h">
          <div className="cmp-card-title"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Pending Problems</div>
          <button type="button" className="btn btn-secondary" onClick={() => onNavigate('problems')}>
            Open Problems &amp; Follow-ups <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </button>
        </div>
        <div className="cmp-table-wrap">
          <table className="cmp-table">
            <thead><tr><th>Problem</th><th>Assigned To</th><th>Priority</th><th>Due Date</th><th>Status</th></tr></thead>
            <tbody>
              {pendingProblems.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', fontStyle: 'italic', color: 'var(--text-muted)' }}>No pending problems — nice work.</td></tr>}
              {pendingProblems.slice(0, 8).map(p => (
                <tr key={p.id}>
                  <td>{p.title}</td>
                  <td>{p.assignedTo}</td>
                  <td><PriorityBadge priority={p.priority} /></td>
                  <td>{p.dueDate}</td>
                  <td><ProblemStatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="cmp-card">
        <div className="cmp-card-title"><i className="fa-solid fa-clock" aria-hidden="true"></i> Recent Activity</div>
        <div className="cmp-table-wrap" style={{ marginTop: 10 }}>
          <table className="cmp-table">
            <thead><tr><th>When</th><th>Activity</th><th>Related To</th></tr></thead>
            <tbody>
              {recentActivity.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', fontStyle: 'italic', color: 'var(--text-muted)' }}>No recent activity yet.</td></tr>}
              {recentActivity.map((a, i) => (
                <tr key={i}>
                  <td>{new Date(a.date).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{a.text}</td>
                  <td>{a.ref}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
