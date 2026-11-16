import React, { useMemo } from 'react';

/* ═══════════════════════════════════════════════════════════════════
   AnalyticsCards — quick-glance stat row above the Tech Module's tab
   bar. Pure derived data (no separate stats endpoint) — same "compute
   from the already-loaded ticket list" pattern as Dashboard.jsx's own
   ticketStats() usage.
   ═══════════════════════════════════════════════════════════════════ */
export default function AnalyticsCards({ tickets }) {
  const stats = useMemo(() => {
    const total = tickets.length;
    const bugs = tickets.filter((t) => t.type === 'bug').length;
    const improvements = tickets.filter((t) => t.type === 'improvement').length;
    const inProgress = tickets.filter((t) => t.stage === 'in_progress').length;
    const inQa = tickets.filter((t) => t.stage === 'qa_review').length;
    const readyForRelease = tickets.filter((t) => t.stage === 'ready_for_release').length;
    const released = tickets.filter((t) => t.stage === 'released');
    const avgDevTime = released.length
      ? Math.round(released.reduce((sum, t) => sum + (t.releaseInfo?.devTimeDays || 0), 0) / released.length)
      : 0;
    const allReviews = tickets.flatMap((t) => t.qaReview || []);
    const rejections = allReviews.filter((r) => r.decision === 'rejected').length;
    const rejectionRate = allReviews.length ? Math.round((rejections / allReviews.length) * 100) : 0;
    return { total, bugs, improvements, inProgress, inQa, readyForRelease, released: released.length, avgDevTime, rejectionRate, totalReviews: allReviews.length };
  }, [tickets]);

  const cards = [
    { icon: 'fa-layer-group', bg: 'linear-gradient(135deg,#1E3A8A,#1E40AF)', val: stats.total, lbl: 'Total Tickets', sub: `${stats.bugs} bugs · ${stats.improvements} new dev` },
    { icon: 'fa-spinner', bg: 'linear-gradient(135deg,#D97706,#B45309)', val: stats.inProgress, lbl: 'In Progress', sub: 'Being developed' },
    { icon: 'fa-vial-circle-check', bg: 'linear-gradient(135deg,#0891B2,#0E7490)', val: stats.inQa, lbl: 'In QA Review', sub: 'Awaiting decision' },
    { icon: 'fa-box-open', bg: 'linear-gradient(135deg,#0F766E,#14B8A6)', val: stats.readyForRelease, lbl: 'Ready for Release', sub: 'QA approved' },
    { icon: 'fa-circle-check', bg: 'linear-gradient(135deg,#16A34A,#15803D)', val: stats.released, lbl: 'Released', sub: `Avg ${stats.avgDevTime}d dev time` },
    { icon: 'fa-rotate-left', bg: 'linear-gradient(135deg,#BE185D,#9D174D)', val: `${stats.rejectionRate}%`, lbl: 'QA Rejection Rate', sub: `${stats.totalReviews} review${stats.totalReviews === 1 ? '' : 's'} so far` },
  ];

  return (
    <div className="tm-stat-row">
      {cards.map((c) => (
        <div key={c.lbl} className="tm-stat-card">
          <div className="tm-stat-ic" style={{ background: c.bg }}><i className={`fa-solid ${c.icon}`} /></div>
          <div className="tm-stat-tx">
            <div className="tm-stat-val">{c.val}</div>
            <div className="tm-stat-lbl">{c.lbl}</div>
            <div className="tm-stat-sub">{c.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
