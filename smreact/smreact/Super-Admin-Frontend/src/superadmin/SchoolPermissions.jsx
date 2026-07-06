import React, { useMemo, useState } from 'react';
import {
  CORE_PERMS, MODULE_GROUPS, ALL_MODULE_KEYS, SOURCE_BADGE,
  SCHOOLS, buildInitialPerms,
} from './permissionsData';

/* ═══════════════════════════════════════════════════════════════════
   SCHOOL PERMISSIONS — Super Admin module (frontend only)

   Control ERP access, core feature permissions, and module visibility
   per school. A stat strip + searchable/filterable table; "Manage" opens
   a modal with core toggles + grouped module toggles (All On / All Off,
   live active/inactive counts). Faithful port of the HTML design; all
   state is in-component (see ./permissionsData). No backend.
   ═══════════════════════════════════════════════════════════════════ */

export default function SchoolPermissions({ toast }) {
  const [permMap, setPermMap] = useState(buildInitialPerms);
  const [search, setSearch] = useState('');
  const [erpFilter, setErpFilter] = useState('');     // '' | 'active' | 'inactive'
  const [editId, setEditId] = useState(null);          // school being managed

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return SCHOOLS.filter((s) => {
      const matches = !q || s.name.toLowerCase().includes(q) || (s.principal || '').toLowerCase().includes(q) || (s.contact || '').includes(q);
      if (!matches) return false;
      const on = permMap[s.id]?.erpAccess;
      if (erpFilter === 'active' && !on) return false;
      if (erpFilter === 'inactive' && on) return false;
      return true;
    });
  }, [search, erpFilter, permMap]);

  const totalAll = SCHOOLS.length;
  const activeAll = SCHOOLS.filter((s) => permMap[s.id]?.erpAccess).length;

  const savePerms = (id, perms) => {
    setPermMap((prev) => ({ ...prev, [id]: perms }));
    setEditId(null);
    const s = SCHOOLS.find((x) => x.id === id);
    toast?.(`Permissions saved for ${s ? s.name : 'school'}`, 'success');
  };

  const editSchool = editId != null ? SCHOOLS.find((s) => s.id === editId) : null;

  return (
    <div className="page-content">
      {/* PAGE HEADER */}
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon"><i className="fa-solid fa-key" /></div>
          <div>
            <div className="page-title">School Permissions</div>
            <div className="page-sub">Control ERP access, feature permissions, and module visibility for each school.</div>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="stat-card"><div className="stat-icon"><i className="fa-solid fa-school" /></div><div className="stat-val">{totalAll}</div><div className="stat-lbl">Total Schools</div></div>
        <div className="stat-card s-green"><div className="stat-icon"><i className="fa-solid fa-circle-check" /></div><div className="stat-val">{activeAll}</div><div className="stat-lbl">ERP Active</div></div>
        <div className="stat-card s-warn"><div className="stat-icon"><i className="fa-solid fa-ban" /></div><div className="stat-val">{totalAll - activeAll}</div><div className="stat-lbl">ERP Inactive</div></div>
      </div>

      {/* TABLE CARD */}
      <div className="section-card">
        <div className="sp-search-bar">
          <div className="f-field-grow">
            <div className="search-box">
              <i className="fa-solid fa-magnifying-glass" />
              <input className="search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by school name, owner, or contact…" />
            </div>
          </div>
          <select className="f-input" value={erpFilter} onChange={(e) => setErpFilter(e.target.value)} style={{ width: 160, height: 38 }}>
            <option value="">All ERP Status</option>
            <option value="active">ERP Active</option>
            <option value="inactive">ERP Inactive</option>
          </select>
        </div>

        <div className="tbl-wrap">
          <table className="sp-table">
            <thead>
              <tr>
                <th style={{ width: 44 }}>#</th>
                <th>School Name</th>
                <th style={{ width: 90 }}>Code / ID</th>
                <th>Owner &amp; Contact</th>
                <th style={{ width: 120, textAlign: 'center' }}>ERP Status</th>
                <th style={{ width: 130, textAlign: 'center' }}>Permissions</th>
                <th style={{ width: 140, textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 44, color: 'var(--tm)' }}>
                  <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 28, display: 'block', margin: '0 auto 12px', opacity: 0.3 }} />
                  <div style={{ fontSize: 14, fontWeight: 700 }}>No schools found</div>
                </td></tr>
              ) : filtered.map((s, idx) => {
                const perms = permMap[s.id];
                const erpOn = perms.erpAccess;
                const modCount = ALL_MODULE_KEYS.filter((k) => perms.modules[k]).length;
                const src = SOURCE_BADGE[s.source] || SOURCE_BADGE.launch;
                return (
                  <tr key={s.id}>
                    <td className="td-bold" style={{ color: 'var(--tm)' }}>{idx + 1}</td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--t1)', fontSize: 13 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 2 }}><span className={`badge ${src.cls}`} style={{ fontSize: 9.5 }}>{src.label}</span></div>
                    </td>
                    <td><span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)' }}>{s.schoolCode}</span></td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--t1)', fontSize: 12.5 }}>{s.principal || '—'}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--tm)' }}>{s.contact || '—'}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {erpOn
                        ? <span className="badge b-green"><i className="fa-solid fa-circle-check" style={{ fontSize: 8 }} /> Active</span>
                        : <span className="badge b-red"><i className="fa-solid fa-ban" style={{ fontSize: 8 }} /> Inactive</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--brand)' }}>{modCount}/{ALL_MODULE_KEYS.length}</div>
                      <div style={{ fontSize: 10, color: 'var(--tm)' }}>modules on</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn-sm" style={{ height: 30, fontSize: 11.5 }} onClick={() => setEditId(s.id)}>
                        <i className="fa-solid fa-sliders" /> Manage
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editSchool && (
        <PermModal
          school={editSchool}
          initial={permMap[editSchool.id]}
          onClose={() => setEditId(null)}
          onSave={(perms) => savePerms(editSchool.id, perms)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════ TOGGLE SWITCH ═══════════════════════ */
function Switch({ checked, onChange }) {
  return (
    <label className="sw">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className="sw-track" />
      <div className="sw-thumb" />
    </label>
  );
}

/* ═══════════════════════ PERMISSIONS MODAL ═══════════════════════ */
function PermModal({ school, initial, onClose, onSave }) {
  const [draft, setDraft] = useState(() => ({
    erpAccess: initial.erpAccess,
    transport: initial.transport,
    headFee: initial.headFee,
    modules: { ...initial.modules },
  }));

  const setCore = (key, val) => setDraft((d) => ({ ...d, [key]: val }));
  const setModule = (key, val) => setDraft((d) => ({ ...d, modules: { ...d.modules, [key]: val } }));
  const setAll = (val) => setDraft((d) => ({ ...d, modules: Object.fromEntries(ALL_MODULE_KEYS.map((k) => [k, val])) }));

  const activeCount = ALL_MODULE_KEYS.filter((k) => draft.modules[k]).length;
  const inactiveCount = ALL_MODULE_KEYS.length - activeCount;

  return (
    <div className="perm-ov open" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="perm-modal">
        {/* Header */}
        <div className="pm-hdr">
          <div className="pm-av">{school.initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="pm-school-name">{school.name}</div>
            <div className="pm-school-meta">
              <span><i className="fa-solid fa-hashtag" style={{ color: 'var(--brand)' }} />{school.schoolCode}</span>
              <span><i className="fa-solid fa-user" style={{ color: 'var(--brand)' }} />{school.principal || '—'}</span>
              <span><i className="fa-solid fa-phone" style={{ color: 'var(--brand)' }} />{school.contact || '—'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--brand)' }}><i className="fa-solid fa-key" /> School Permissions</div>
            <button className="pm-close" data-tip="Close" data-tip-pos="left" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
          </div>
        </div>

        {/* Body */}
        <div className="pm-body">
          {/* Core permissions */}
          <div className="pm-top-section">
            <div className="pm-top-title"><i className="fa-solid fa-shield-halved" /> Core Permissions</div>
            <div className="pm-top-grid">
              {CORE_PERMS.map((p) => (
                <div className={`pm-top-card${draft[p.key] ? ' enabled' : ''}`} key={p.key}>
                  <div className="pm-top-card-top">
                    <div className="pm-top-card-icon"><i className={`fa-solid ${p.icon}`} /></div>
                    <Switch checked={draft[p.key]} onChange={(v) => setCore(p.key, v)} />
                  </div>
                  <div className="pm-top-card-name">{p.name}</div>
                  <div className="pm-top-card-desc">{p.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Module permissions */}
          <div>
            <div className="pm-modules-title">
              <i className="fa-solid fa-table-cells-large" /> Module Permissions
              <div className="pm-mod-badges">
                <span className="badge b-green">{activeCount} Active</span>
                <span className="badge b-gray">{inactiveCount} Inactive</span>
              </div>
              <button className="btn-sm" style={{ marginLeft: 8, height: 28, fontSize: 11 }} onClick={() => setAll(true)}><i className="fa-solid fa-toggle-on" /> All On</button>
              <button className="btn-sm" style={{ height: 28, fontSize: 11, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={() => setAll(false)}><i className="fa-solid fa-toggle-off" /> All Off</button>
            </div>

            {MODULE_GROUPS.map((g) => (
              <React.Fragment key={g.label}>
                <div className="pm-section-label">{g.label}</div>
                <div className="pm-mod-grid">
                  {g.modules.map((m) => (
                    <div className={`pm-mod-card${draft.modules[m.key] ? ' enabled' : ''}`} key={m.key}>
                      <div className="pm-mod-icon"><i className={`fa-solid ${m.icon}`} /></div>
                      <div className="pm-mod-name">{m.name}</div>
                      <Switch checked={draft.modules[m.key]} onChange={(v) => setModule(m.key, v)} />
                    </div>
                  ))}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="pm-foot">
          <button className="btn-secondary" onClick={onClose}><i className="fa-solid fa-xmark" /> Cancel</button>
          <button className="btn-primary" onClick={() => onSave(draft)}><i className="fa-solid fa-floppy-disk" /> Save Permissions</button>
        </div>
      </div>
    </div>
  );
}
