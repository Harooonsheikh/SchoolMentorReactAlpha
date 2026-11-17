import React, { useCallback, useEffect, useState } from 'react';
import * as techNotificationsApi from '../superadmin/api/services/techNotifications';

/* Tech → Support release notices (TECH_TICKETS_API_README §9).
   Shows each "New Update Released" notice until Support acknowledges it. */
export default function TechReleaseNotices() {
  const [rows, setRows] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    techNotificationsApi.getNotifications('support', { unacknowledgedOnly: true })
      .then((list) => setRows(list || []))
      .catch(() => setRows([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  const acknowledge = (id) => {
    setBusyId(id);
    techNotificationsApi.acknowledgeNotification(id)
      .then(load)
      .catch(() => {})
      .finally(() => setBusyId(null));
  };

  if (!rows.length) return null;
  return (
    <div className="ov-card" style={{ marginBottom: 16, padding: 14 }}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>
        <i className="fa-solid fa-bell" aria-hidden="true" /> Tech release notices ({rows.length})
      </div>
      {rows.map((n) => (
        <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: '1px solid var(--ov-line, #e5e7eb)' }}>
          <div>
            <div style={{ fontWeight: 600 }}>{n.ticketNumber} — {n.title}</div>
            <div style={{ fontSize: 13, opacity: 0.85, whiteSpace: 'pre-line' }}>{n.message}</div>
            {n.meta?.school && <div style={{ fontSize: 12, opacity: 0.7 }}>School: {n.meta.school}</div>}
          </div>
          <button className="btn-sm" disabled={busyId === n.id} onClick={() => acknowledge(n.id)}>
            <i className="fa-solid fa-check" aria-hidden="true" /> Acknowledge
          </button>
        </div>
      ))}
    </div>
  );
}
