import React, { useMemo, useState } from 'react';

/* ═══════════════════════════════════════════════════════════════════
   SCHOOL LIST REPORT — School Overview cards ki "View Report"

   Dashboard ke School Overview cards (Active, ERP, Launch Set-Up,
   Inactive, Active Login, Fully Trained, In Process) isi ek component
   ko kholte hain. Rows `d.schoolLists[key]` se aati hain jo
   api/services/dashboard.js ki mapping banati hai.

   Row shape (jo field na ho wo column khud chhup jata hai):
     { id, name, city?, date?, lastLogin?, note? }

   Agar admin_dashboard us card ki list deta hi nahi (rows === undefined)
   to report khali table ki jagah saaf batati hai ke sirf count aaya hai.
   ═══════════════════════════════════════════════════════════════════ */

export default function SchoolListReport({ title, description, count, rows, schoolName }) {
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    if (!Array.isArray(rows)) return null;
    const named = rows.map((r) => ({ ...r, name: r.name || (schoolName && schoolName(r.id)) || `Branch #${r.id}` }));
    const s = q.trim().toLowerCase();
    return s ? named.filter((r) => String(r.name).toLowerCase().includes(s) || String(r.id).includes(s)) : named;
  }, [rows, q, schoolName]);

  /* API ne is card ki list hi nahi bheji. */
  if (list === null) {
    return (
      <div className="db-block" style={{ margin: 0 }}>
        <i className="fa-solid fa-circle-info" />
        <div className="db-block-ttl">{title}: {count}</div>
        <div className="db-block-sub">
          <code>admin_dashboard</code> is card ka sirf <b>count</b> deta hai, schools ki list nahi.
          Report dikhane ke liye API ko is card ki school list bhejni hogi (ya
          <code> api/services/dashboard.js</code> me <code>schoolLists</code> ki mapping lagani hogi).
        </div>
      </div>
    );
  }

  const has = (f) => list.some((r) => r[f] != null && r[f] !== '');
  const cols = [
    { f: 'city', h: 'City' },
    { f: 'date', h: 'Signup Date' },
    { f: 'logins', h: 'Logins (This Month)' },
    { f: 'lastLogin', h: 'Last Login' },
    { f: 'note', h: 'Detail' },
  ].filter((c) => has(c.f));

  return (
    <div className="section-card sa-print-area" style={{ margin: 0 }}>
      <div className="card-header">
        <div>
          <div className="card-title"><i className="fa-solid fa-school" /> {title}</div>
          {description && <div className="card-sub" style={{ fontSize: 11.5, color: 'var(--tm)', marginTop: 3 }}>{description}</div>}
        </div>
        <div className="card-header-right">
               <div className="tbl-search sa-no-print">
            <i className="fa-solid fa-magnifying-glass" />
            <input type="text" placeholder="Search school..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </div>

      {rows.length !== count && (
        <div className="db-locked" style={{ margin: '0 16px 10px' }}>
          <i className="fa-solid fa-circle-info" />
          <span>Card par <b>{count}</b> hai magar API ki list me <b>{rows.length}</b> schools aaye hain.</span>
        </div>
      )}

      <div className="tbl-wrap">
         <table className="mentor-table" style={{ minWidth: 0, width: '100%', tableLayout: 'auto' }}>
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th>School Name</th>
              <th>Branch ID</th>
              {cols.map((c) => <th key={c.f}>{c.h}</th>)}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={3 + cols.length} style={{ textAlign: 'center', color: 'var(--tm)', padding: 24 }}>
                {rows.length === 0 ? 'Is card me koi school nahi.' : 'No schools match your search.'}
              </td></tr>
            ) : list.map((r, i) => (
              <tr key={`${r.id}-${i}`}>
                <td>{i + 1}</td>
                <td>{r.name}</td>
                <td>{r.id ?? '—'}</td>
                          {cols.map((c) => <td key={c.f} style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{r[c.f] ?? '—'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pag-bar">
        <div className="pag-info">{list.length} of {rows.length} schools</div>
      </div>
    </div>
  );
}
