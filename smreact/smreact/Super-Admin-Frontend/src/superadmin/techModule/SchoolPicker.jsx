import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as techTicketsApi from '../api/services/techTickets';
import { useDownwardMenu } from './TmDropdown';

/* ═══════════════════════════════════════════════════════════════════
   SchoolPicker — the server's school list (README §7 ?action=schools).
   The full list is loaded ONCE (shared across the page) and filtered
   on the page, so typing is instant. The chosen school is remembered
   so the form can send its real branch id (schoolBranchId).
   ═══════════════════════════════════════════════════════════════════ */

const picked = new Map();   // picker id → school object
let schoolsPromise = null;  // one shared request for the whole page
let schoolsCache = null;    // mapped picker rows once loaded

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

/** Loads the whole list once. Later calls reuse the same result. */
export function loadSchools() {
  if (schoolsCache) return Promise.resolve(schoolsCache);
  if (!schoolsPromise) {
    schoolsPromise = techTicketsApi.getSchools('')
      .then((rows) => {
        schoolsCache = rows.map(toPick);
        schoolsCache.forEach((s) => picked.set(s.id, s));
        return schoolsCache;
      })
      .catch((err) => { schoolsPromise = null; throw err; });
  }
  return schoolsPromise;
}

export default function SchoolPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [all, setAll] = useState(schoolsCache);
  const [failed, setFailed] = useState(false);

  /* Start loading as soon as the picker is shown, so it is ready by the time it is opened. */
  useEffect(() => {
    let alive = true;
    if (!all) {
      loadSchools()
        .then((rows) => { if (alive) setAll(rows); })
        .catch(() => { if (alive) setFailed(true); });
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!all) return [];
    const s = q.trim().toLowerCase();
    /* Search by school name only. */
    const list = s ? all.filter((sc) => sc.name.toLowerCase().includes(s)) : all;
    return list.slice(0, 50);
  }, [all, q]);

  const selected = value ? findSchool(value) : null;
  /* Menu always opens below the field (portalled, never clipped by the modal). */
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const { pos, portal } = useDownwardMenu({ open, onClose: () => { setOpen(false); setQ(''); }, triggerRef, menuRef, maxHeight: 300 });

  return (
    <div style={{ position: 'relative' }}>
      <div ref={triggerRef} className={`um-input${open ? ' tm-sel open' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', height: 'auto', minHeight: 38, padding: '6px 13px' }} onClick={() => setOpen((o) => !o)}>
        <i className="fa-solid fa-school" style={{ color: 'var(--tm)' }} />
        {selected ? (
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: 'var(--t1)', fontSize: 13 }}>{selected.name}</div>
            {selected.loginId && <div style={{ fontSize: 11, color: 'var(--tm)' }}>Login: {selected.loginId}</div>}
          </div>
        ) : <span style={{ color: 'var(--tm)', fontSize: 13 }}>Search and select a school…</span>}
        <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: 11, color: 'var(--tm)' }} />
      </div>

      {portal(
        <div ref={menuRef} className="tm-sel-menu" style={{ top: pos?.top, left: pos?.left, width: pos?.width, maxHeight: pos?.maxHeight, padding: 0 }}>
          <div style={{ padding: 8, borderBottom: '1px solid var(--bl)', position: 'sticky', top: 0, background: 'var(--card)' }}>
            <div className="search-box"><i className="fa-solid fa-magnifying-glass" /><input className="search-input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search school name…" /></div>
          </div>
          {!all && !failed ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--tm)', fontSize: 12.5 }}><i className="fa-solid fa-spinner fa-spin" /> Loading schools…</div>
          ) : failed ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--err)', fontSize: 12.5 }}>Could not load schools. Close and open again.</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--tm)', fontSize: 12.5 }}>No schools found</div>
          ) : filtered.map((s) => (
            <div key={s.id} style={{ padding: '9px 13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottom: '1px solid var(--bl)' }}
              onClick={() => { onChange(s.id); setOpen(false); setQ(''); }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--t1)' }}>{s.name}</div>
                <div style={{ fontSize: 11, color: 'var(--tm)' }}>{s.phone || 'No phone'}</div>
              </div>
            </div>
          ))}
        </div>,
      )}
    </div>
  );
}
