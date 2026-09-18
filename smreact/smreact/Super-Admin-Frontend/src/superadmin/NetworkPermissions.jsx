import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MODULE_GROUPS, ALL_MODULE_KEYS } from './permissionsData';
import { networkPermissionsApi } from './api';
import { Switch, MobileAppPermsModal } from './SchoolPermissions';

/* ═══════════════════════════════════════════════════════════════════
   NETWORK PERMISSIONS — Super Admin module

   School Permissions ka hi design, school ki jagah NETWORK (chain) par:
   stat strip + searchable/filterable table; "Manage" wahi modal kholta hai —
   core cards, Mobile App (nested modal) aur grouped module toggles.

   LIVE SchoolMentorSuperAdminAPI:
     GET  /api/AHM_NetworkUsers                → networks (table)
     POST /api/AHM_NetworkUsers/update-isactive → modal ka "Save Permissions";
          isActive = "Active Network" aur "Chain Portal Access" dono on. Table
          ka Status isi isActive se.
   Baqi permissions (modules / mobile app) ka backend route abhi nahi hai
   (endpoints.js ka networkPermissions note dekhein), is liye wo draft isi
   screen ki state me rehta hai.
   ═══════════════════════════════════════════════════════════════════ */

/* Network ke core cards — School Permissions ke CORE_PERMS jaise. */
const NETWORK_CORE_PERMS = [
  { key: 'activeNetwork', name: 'Active Network', icon: 'fa-circle-check', desc: 'Keep this network active. Switching it off suspends the network.' },
  { key: 'chainPortal',   name: 'Chain Portal Access', icon: 'fa-sitemap', desc: 'Allow this network to log in and use the Chain Management portal.' },
];

const fmtDate = (d) => (d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function NetworkPermissions({ toast }) {
  const [networks, setNetworks] = useState([]);
  const [permMap, setPermMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');  // '' | 'active' | 'inactive'
  const [editId, setEditId] = useState(null);             // network being managed

  const toastRef = useRef(toast);
  toastRef.current = toast;

  /* Refresh par pehle se badli hui (session) permissions na mitayein — sirf
     naye networks ko default milta hai. */
  const loadNetworks = useCallback(async () => {
    setLoading(true);
    try {
      const { networks: rows, permMap: defaults } = await networkPermissionsApi.listNetworks();
      setNetworks(rows);
      /* Chain Portal Access hamesha server ka isActive — baqi session ke badlaav rehte hain. */
      setPermMap((prev) => {
        const next = { ...defaults, ...prev };
        rows.forEach((n) => { next[n.id] = { ...next[n.id], chainPortal: n.isActive }; });
        return next;
      });
      setLoadError('');
    } catch (err) {
      setLoadError(err?.message || 'Could not load networks');
      toastRef.current?.(err?.message || 'Could not load networks', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNetworks(); }, [loadNetworks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return networks.filter((n) => {
      const matches = !q || n.name.toLowerCase().includes(q) || n.owner.toLowerCase().includes(q) || n.contact.includes(q);
      if (!matches) return false;
      if (statusFilter === 'active' && !n.isActive) return false;
      if (statusFilter === 'inactive' && n.isActive) return false;
      return true;
    });
  }, [networks, search, statusFilter]);

  const totalAll = networks.length;
  const activeAll = networks.filter((n) => n.isActive).length;

  /* Save Permissions → POST update-isactive { network_ID, isActive } (modal ka
     "Chain Portal Access" switch). Kamyabi par table ka Status foran badalta
     hai aur modal band; fail ho to modal khula rehta hai. Modules / mobile app
     ka server route abhi nahi — wo sirf is screen ki state me. */
  const [saving, setSaving] = useState(false);
  const savePerms = async (id, perms) => {
    const n = networks.find((x) => x.id === id);
    /* Dono core cards ek hi server flag par hain: network tabhi active jab
       "Active Network" aur "Chain Portal Access" dono on hon. */
    const isActive = Boolean(perms.activeNetwork && perms.chainPortal);
    setSaving(true);
    try {
      await networkPermissionsApi.setNetworkActive(id, isActive);
      setNetworks((prev) => prev.map((x) => (x.id === id ? { ...x, isActive } : x)));
      setPermMap((prev) => ({ ...prev, [id]: perms }));
      setEditId(null);
      toast?.(`Permissions saved for ${n ? n.name : 'network'} — chain portal access ${isActive ? 'on' : 'off'}`, 'success');
    } catch (err) {
      toast?.(err?.message || 'Could not save network permissions', 'error');
    } finally {
      setSaving(false);
    }
  };

  const editNetwork = editId != null ? networks.find((n) => n.id === editId) : null;

  return (
    <div className="page-content">
      {/* PAGE HEADER */}
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon"><i className="fa-solid fa-network-wired" /></div>
          <div>
            <div className="page-title">Network Permissions</div>
            <div className="page-sub">Control portal access, feature permissions, and module visibility for each school network.</div>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="stat-card"><div className="stat-icon"><i className="fa-solid fa-network-wired" /></div><div className="stat-val">{totalAll}</div><div className="stat-lbl">Total Networks</div></div>
        <div className="stat-card s-green"><div className="stat-icon"><i className="fa-solid fa-circle-check" /></div><div className="stat-val">{activeAll}</div><div className="stat-lbl">Active Networks</div></div>
        <div className="stat-card s-warn"><div className="stat-icon"><i className="fa-solid fa-ban" /></div><div className="stat-val">{totalAll - activeAll}</div><div className="stat-lbl">Inactive Networks</div></div>
      </div>

      {/* TABLE CARD */}
      <div className="section-card">
        <div className="sp-search-bar">
          <div className="f-field-grow">
            <div className="search-box">
              <i className="fa-solid fa-magnifying-glass" />
              <input className="search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by network name, owner, or contact…" />
            </div>
          </div>
          <select className="f-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 160, height: 38 }}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button className="btn-sm" style={{ height: 38 }} onClick={loadNetworks} disabled={loading} data-tip="Reload from API">
            <i className={`fa-solid fa-rotate${loading ? ' fa-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="tbl-wrap">
          <table className="sp-table">
            <thead>
              <tr>
                <th style={{ width: 44 }}>#</th>
                <th>Network Name</th>
                <th style={{ width: 90 }}>ID</th>
                <th>Owner &amp; Contact</th>
                <th style={{ width: 120, textAlign: 'center' }}>Created</th>
                <th style={{ width: 120, textAlign: 'center' }}>Status</th>
                <th style={{ width: 130, textAlign: 'center' }}>Permissions</th>
                <th style={{ width: 140, textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 44, color: 'var(--tm)' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24, display: 'block', margin: '0 auto 12px', opacity: 0.5 }} />
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Loading networks…</div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 44, color: 'var(--tm)' }}>
                  <i className={`fa-solid ${loadError ? 'fa-triangle-exclamation' : 'fa-magnifying-glass'}`} style={{ fontSize: 28, display: 'block', margin: '0 auto 12px', opacity: 0.3 }} />
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{loadError ? 'Could not load networks' : 'No networks found'}</div>
                  {loadError && <div style={{ fontSize: 12, marginTop: 4 }}>{loadError}</div>}
                </td></tr>
              ) : filtered.map((n, idx) => {
                const perms = permMap[n.id] || { modules: {} };
                const on = n.isActive;
                const modCount = ALL_MODULE_KEYS.filter((k) => perms.modules?.[k]).length;
                return (
                  <tr key={n.id}>
                    <td className="td-bold" style={{ color: 'var(--tm)' }}>{idx + 1}</td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--t1)', fontSize: 13 }} title={`Network ID: ${n.id}`}>{n.name}</div>
                      {n.address && (
                        <div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 2 }} title={n.address}>
                          <i className="fa-solid fa-location-dot" style={{ marginRight: 4, opacity: 0.6 }} />{n.address}
                        </div>
                      )}
                      {n.isAdmin && (
                        <div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 2 }}><span className="badge b-blue" style={{ fontSize: 9.5 }}>Admin</span></div>
                      )}
                    </td>
                    <td><span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)' }}>{n.id}</span></td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--t1)', fontSize: 12.5 }}>{n.owner || '—'}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--tm)' }}>{n.contact || '—'}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--t1)' }}>{fmtDate(n.createdDate)}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {on
                        ? <span className="badge b-green"><i className="fa-solid fa-circle-check" style={{ fontSize: 8 }} /> Active</span>
                        : <span className="badge b-red"><i className="fa-solid fa-ban" style={{ fontSize: 8 }} /> Inactive</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--brand)' }}>{modCount}/{ALL_MODULE_KEYS.length}</div>
                      <div style={{ fontSize: 10, color: 'var(--tm)' }}>modules on</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn-sm" style={{ height: 30, fontSize: 11.5 }} onClick={() => setEditId(n.id)}>
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

      {editNetwork && (
        <NetworkPermModal
          network={editNetwork}
          initial={permMap[editNetwork.id] || networkPermissionsApi.defaultNetworkPerms(editNetwork)}
          onClose={() => setEditId(null)}
          saving={saving}
          onSave={(perms) => savePerms(editNetwork.id, perms)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════ PERMISSIONS MODAL ═══════════════════════ */
function NetworkPermModal({ network, initial, saving, onClose, onSave }) {
  const [draft, setDraft] = useState(() => ({
    ...initial,
    activeNetwork: network.isActive,
    chainPortal: network.isActive,
    mentorAi: { ...initial.mentorAi },
    etube: { ...initial.etube },
    modules: { ...initial.modules },
  }));
  const [showMobileModal, setShowMobileModal] = useState(false);

  const setCore = (key, val) => setDraft((d) => ({ ...d, [key]: val }));
  const setModule = (key, val) => setDraft((d) => ({ ...d, modules: { ...d.modules, [key]: val } }));
  const setAll = (val) => setDraft((d) => ({ ...d, modules: Object.fromEntries(ALL_MODULE_KEYS.map((k) => [k, val])) }));
  const setMentorAi = (key, val) => setDraft((d) => {
    const next = { ...d.mentorAi, [key]: val };
    if (key === 'enabled' && !val) next.parentsAccess = false;
    return { ...d, mentorAi: next };
  });
  const setEtube = (key, val) => setDraft((d) => {
    const next = { ...d.etube, [key]: val };
    if (key === 'enabled' && !val) { next.viewing = false; next.uploading = false; }
    return { ...d, etube: next };
  });

  const activeCount = ALL_MODULE_KEYS.filter((k) => draft.modules[k]).length;
  const inactiveCount = ALL_MODULE_KEYS.length - activeCount;

  return (
    <div className="perm-ov open" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="perm-modal">
        {/* Header */}
        <div className="pm-hdr">
          <div className="pm-av">{network.initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="pm-school-name" title={`Network ID: ${network.id}`}>{network.name}</div>
            <div className="pm-school-meta">
              <span><i className="fa-solid fa-hashtag" style={{ color: 'var(--brand)' }} />{network.id}</span>
              <span><i className="fa-solid fa-user" style={{ color: 'var(--brand)' }} />{network.owner || '—'}</span>
              <span><i className="fa-solid fa-phone" style={{ color: 'var(--brand)' }} />{network.contact || '—'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--brand)' }}><i className="fa-solid fa-network-wired" /> Network Permissions</div>
            <button className="pm-close" data-tip="Close" data-tip-pos="left" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
          </div>
        </div>

        {/* Body */}
        <div className="pm-body">
          {/* Core permissions */}
          <div className="pm-top-section">
            <div className="pm-top-title"><i className="fa-solid fa-shield-halved" /> Core Permissions</div>
            <div className="pm-top-grid">
              {NETWORK_CORE_PERMS.map((p) => (
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

          {/* Mobile App permissions — wahi nested modal */}
          <div className="pm-top-section">
            <div className="pm-top-title"><i className="fa-solid fa-mobile-screen-button" /> Mobile App</div>
            <div className="pm-manage-card" onClick={() => setShowMobileModal(true)}>
              <div className="pm-top-card-icon"><i className="fa-solid fa-sliders" /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="pm-top-card-name">Manage Mobile App Permissions</div>
                <div className="pm-top-card-desc">Control eTube, Mentor AI and Chat access for this network&rsquo;s mobile application.</div>
              </div>
              <i className="fa-solid fa-chevron-right pm-manage-arrow" />
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
          <button className="btn-secondary" onClick={onClose} disabled={saving}><i className="fa-solid fa-xmark" /> Cancel</button>
          <button className="btn-primary" onClick={() => onSave(draft)} disabled={saving}>
            <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} /> {saving ? 'Saving…' : 'Save Permissions'}
          </button>
        </div>
      </div>

      {showMobileModal && (
        <MobileAppPermsModal
          subject="network"
          draft={draft}
          loading={false}
          saving={false}
          setCore={setCore}
          setMentorAi={setMentorAi}
          setEtube={setEtube}
          onClose={() => setShowMobileModal(false)}
          onDone={() => setShowMobileModal(false)}
        />
      )}
    </div>
  );
}
