import React, { useEffect, useState } from 'react';
import * as techTicketsApi from '../api/services/techTickets';

/* ═══════════════════════════════════════════════════════════════════
   SchoolPicker — searches the SERVER's school list (README §7,
   ?action=schools&search=). The chosen school is remembered so the form can
   send its real branch id (schoolBranchId) with the ticket.
   ═══════════════════════════════════════════════════════════════════ */

const picked = new Map();   // picker id → school object

/** The school object chosen earlier in the picker (or null). */
export function findSchool(id) {
  return picked.get(id) || null;
}

const toPick = (s) => ({
  id: `srv-${s.branchId}`,
  branchId: s.branchId,
  name: String(s.branchName || '').trim(),
  branch: s.branchCode || '',
  contact: s.ownerName || '',
  phone: s.phone || '',
  loginId: s.loginId || null,
  password: null,
  isTestSchool: false,
});

export default function SchoolPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  /* Search the server while the list is open (debounced). */
  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      techTicketsApi.getSchools(q.trim())
        .then((rows) => {
          if (!alive) return;
          const list = rows.map(toPick);
          list.forEach((s) => picked.set(s.id, s));
          setResults(list);
        })
        .catch(() => { if (alive) setResults([]); })
        .finally(() => { if (alive) setLoading(false); });
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [open, q]);

  const selected = value ? findSchool(value) : null;
  const filtered = results;

  return (
    <div style={{ position: 'relative' }}>
      <div className="um-input" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', height: 'auto', minHeight: 38, padding: '6px 13px' }} onClick={() => setOpen((o) => !o)}>
        <i className="fa-solid fa-school" style={{ color: 'var(--tm)' }} />
        {selected ? (
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: 'var(--t1)', fontSize: 13 }}>{selected.name}{selected.isTestSchool && <span className="badge b-warn" style={{ marginLeft: 6, fontSize: 10 }}>Test School</span>}</div>
            {selected.loginId && <div style={{ fontSize: 11, color: 'var(--tm)' }}>Login: {selected.loginId}</div>}
          </div>
        ) : <span style={{ color: 'var(--tm)', fontSize: 13 }}>Search and select a school…</span>}
        <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: 11, color: 'var(--tm)' }} />
      </div>

      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, background: 'var(--card)', border: '1.5px solid var(--bl)', borderRadius: 'var(--r-md)', boxShadow: 'var(--s-lg)', marginTop: 4, maxHeight: 280, overflow: 'auto' }}>
          <div style={{ padding: 8, borderBottom: '1px solid var(--bl)', position: 'sticky', top: 0, background: 'var(--card)' }}>
            <div className="search-box"><i className="fa-solid fa-magnifying-glass" /><input className="search-input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search school name…" /></div>
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--tm)', fontSize: 12.5 }}>No schools found</div>
          ) : filtered.map((s) => (
            <div key={s.id} style={{ padding: '9px 13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottom: '1px solid var(--bl)' }}
              onClick={() => { onChange(s.id); setOpen(false); setQ(''); }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--t1)' }}>{s.name}</div>
                <div style={{ fontSize: 11, color: 'var(--tm)' }}>{s.contact || '—'}{s.phone ? ` · ${s.phone}` : ''}</div>
              </div>
              {s.isTestSchool && <span className="badge b-warn" style={{ fontSize: 10, flexShrink: 0 }}>Test</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

