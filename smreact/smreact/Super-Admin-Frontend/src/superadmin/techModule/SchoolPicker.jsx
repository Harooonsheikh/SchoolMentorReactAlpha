import React, { useMemo, useState } from 'react';
import { SCHOOLS as TEST_SCHOOLS } from '../techTicketsData';
import { INITIAL_ERP } from '../statusData';

/* ═══════════════════════════════════════════════════════════════════
   SchoolPicker — search + list combining the demo/test schools
   (techTicketsData.SCHOOLS, isTestSchool:true) with real member
   schools (statusData.INITIAL_ERP, normalized here as isTestSchool:false).
   Used by TicketCreateForm to link a ticket to a school + surface its
   login info when available.
   ═══════════════════════════════════════════════════════════════════ */

function normalizedSchools() {
  const real = INITIAL_ERP.map((s) => ({
    id: `erp-${s.id}`, name: s.name, branch: '', contact: s.principal, phone: s.contact,
    loginId: null, password: null, isTestSchool: false,
  }));
  const test = TEST_SCHOOLS.map((s) => ({ ...s, isTestSchool: true }));
  return [...real, ...test];
}

export default function SchoolPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const all = useMemo(() => normalizedSchools(), []);
  const filtered = useMemo(() => {
    if (!q.trim()) return all.slice(0, 30);
    const s = q.trim().toLowerCase();
    return all.filter((sc) => sc.name.toLowerCase().includes(s)).slice(0, 30);
  }, [all, q]);

  const selected = value ? all.find((s) => s.id === value) : null;

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

export { normalizedSchools };
