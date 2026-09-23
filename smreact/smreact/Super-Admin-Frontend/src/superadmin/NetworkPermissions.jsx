import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { networkPermissionsApi } from './api';
import {
  NETWORK_MODULE_GROUPS,
  NETWORK_MODULE_KEYS,
  defaultNetworkPerms,
} from './api/services/networkPermissions';
import { Switch } from './SchoolPermissions';

/* ═══════════════════════════════════════════════════════════════════
   NETWORK PERMISSIONS — Super Admin module

   Stat strip + searchable table. Manage modal:
     • aik card — Active Network (isActive)
     • neeche chain portal ke modules (displayed + commented), ERP modules nahi
   Save → POST /api/SchoolPermissions/network-permissions  (action: SAVE)
   Active Network change → POST /api/AHM_NetworkUsers/update-isactive
   ═══════════════════════════════════════════════════════════════════ */

const fmtDate = (d) => (d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function NetworkPermissions({ toast }) {
  const [networks, setNetworks] = useState([]);
  const [permMap, setPermMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editId, setEditId] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const toastRef = useRef(toast);
  toastRef.current = toast;

  const loadNetworks = useCallback(async () => {
    setLoading(true);
    try {
      const { networks: rows, permMap: defaults } = await networkPermissionsApi.listNetworks();
      setNetworks(rows);
      setPermMap((prev) => {
        const next = { ...defaults };
        rows.forEach((n) => {
          const prevPerms = prev[n.id];
          next[n.id] = {
            ...(prevPerms || next[n.id]),
            activeNetwork: n.isActive,
          };
        });
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

  const openManage = async (id) => {
    setEditId(id);
    setModalLoading(true);
    try {
      const loaded = await networkPermissionsApi.getNetworkPermissions(id);
      setPermMap((prev) => {
        const n = networks.find((x) => x.id === id);
        return {
          ...prev,
          [id]: {
            ...(prev[id] || defaultNetworkPerms(n)),
            permissionId: loaded.permissionId,
            modules: loaded.modules,
            activeNetwork: n ? n.isActive : Boolean(prev[id]?.activeNetwork),
          },
        };
      });
    } catch (err) {
      toastRef.current?.(err?.message || 'Could not load network modules — showing defaults', 'warn');
    } finally {
      setModalLoading(false);
    }
  };

  const savePerms = async (id, perms) => {
    const n = networks.find((x) => x.id === id);
    setSaving(true);
    try {
      const saved = await networkPermissionsApi.saveNetworkPermissions(id, perms);
      /* update-isactive HAR save par chalti hai. Pehle ye sirf tab chalti thi
         jab toggle list wali isActive se ALAG ho — yani jo network pehle se
         Active dikh raha ho, us par save karne se API chalti hi nahi thi (aur
         list ki value khud stale ho sakti hai). Call idempotent hai, is liye
         hamesha bhej dena hi mehfooz hai. */
      await networkPermissionsApi.setNetworkActive(id, perms.activeNetwork);
      setNetworks((prev) => prev.map((x) => (x.id === id ? { ...x, isActive: Boolean(perms.activeNetwork) } : x)));
      setPermMap((prev) => ({ ...prev, [id]: { ...perms, permissionId: saved.permissionId } }));
      setEditId(null);
      toast?.(`Permissions saved for ${n ? n.name : 'network'}`, 'success');
    } catch (err) {
      toast?.(err?.message || 'Could not save network permissions', 'error');
    } finally {
      setSaving(false);
    }
  };

  const editNetwork = editId != null ? networks.find((n) => n.id === editId) : null;

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon"><i className="fa-solid fa-network-wired" /></div>
          <div>
            <div className="page-title">Network Permissions</div>
            <div className="page-sub">Control network status and chain-portal module visibility for each school network.</div>
          </div>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="stat-card"><div className="stat-icon"><i className="fa-solid fa-network-wired" /></div><div className="stat-val">{totalAll}</div><div className="stat-lbl">Total Networks</div></div>
        <div className="stat-card s-green"><div className="stat-icon"><i className="fa-solid fa-circle-check" /></div><div className="stat-val">{activeAll}</div><div className="stat-lbl">Active Networks</div></div>
        <div className="stat-card s-warn"><div className="stat-icon"><i className="fa-solid fa-ban" /></div><div className="stat-val">{totalAll - activeAll}</div><div className="stat-lbl">Inactive Networks</div></div>
      </div>

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
                const modCount = NETWORK_MODULE_KEYS.filter((k) => perms.modules?.[k]).length;
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
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--brand)' }}>{modCount}/{NETWORK_MODULE_KEYS.length}</div>
                      <div style={{ fontSize: 10, color: 'var(--tm)' }}>modules on</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn-sm" style={{ height: 30, fontSize: 11.5 }} onClick={() => openManage(n.id)}>
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

      {editNetwork && modalLoading && (
        <div className="perm-ov open">
          <div className="perm-modal np-load">
            <i className="fa-solid fa-spinner fa-spin" />
            <div className="np-load-title">Loading permissions…</div>
            <div className="np-load-sub">{editNetwork.name}</div>
          </div>
        </div>
      )}

      {editNetwork && !modalLoading && (
        <NetworkPermModal
          network={editNetwork}
          initial={permMap[editNetwork.id] || defaultNetworkPerms(editNetwork)}
          onClose={() => setEditId(null)}
          saving={saving}
          onSave={(perms) => savePerms(editNetwork.id, perms)}
        />
      )}
    </div>
  );
}

function NetworkPermModal({ network, initial, saving, onClose, onSave }) {
  const [activeNetwork, setActiveNetwork] = useState(network.isActive);
  const [permissionId] = useState(initial.permissionId || 0);
  const [modules, setModules] = useState({ ...initial.modules });

  const setModule = (key, val) => setModules((m) => ({ ...m, [key]: val }));
  const setAll = (val) => setModules(Object.fromEntries(NETWORK_MODULE_KEYS.map((k) => [k, val])));

  const activeCount = NETWORK_MODULE_KEYS.filter((k) => modules[k]).length;
  const inactiveCount = NETWORK_MODULE_KEYS.length - activeCount;

  return (
    <div className="perm-ov open" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="perm-modal np-modal">
        <div className="pm-hdr">
          <div className="pm-av">{network.initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="np-kicker">Network Permissions</div>
            <div className="pm-school-name" title={`Network ID: ${network.id}`}>{network.name}</div>
            <div className="pm-school-meta">
              <span><i className="fa-solid fa-hashtag" />{network.id}</span>
              <span><i className="fa-solid fa-user" />{network.owner || '—'}</span>
              <span><i className="fa-solid fa-phone" />{network.contact || '—'}</span>
            </div>
          </div>
          <button className="pm-close" data-tip="Close" data-tip-pos="left" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>

        <div className="pm-body">
          <div className={`np-hero${activeNetwork ? ' on' : ''}`}>
            <div className="np-hero-icon"><i className="fa-solid fa-circle-nodes" /></div>
            <div className="np-hero-copy">
              <div className="np-hero-label">Network status</div>
              <div className="np-hero-name">Active Network</div>
              <div className="np-hero-desc">Keep this network live. When off, the network stays listed but access is paused.</div>
            </div>
            <div className="np-hero-aside">
              <span className={`np-hero-pill${activeNetwork ? ' on' : ''}`}>{activeNetwork ? 'Active' : 'Paused'}</span>
              <Switch checked={activeNetwork} onChange={setActiveNetwork} />
            </div>
          </div>

          <div className="np-modules-head">
            <div>
              <div className="np-modules-title"><i className="fa-solid fa-layer-group" /> Network Modules</div>
              <div className="np-modules-sub">Chain portal modules — including those hidden from the sidebar.</div>
            </div>
            <div className="np-mod-actions">
              <span className="badge b-green">{activeCount} On</span>
              <span className="badge b-gray">{inactiveCount} Off</span>
              <button type="button" className="btn-sm np-mod-btn" onClick={() => setAll(true)}><i className="fa-solid fa-toggle-on" /> All On</button>
              <button type="button" className="btn-sm np-mod-btn np-mod-btn-off" onClick={() => setAll(false)}><i className="fa-solid fa-toggle-off" /> All Off</button>
            </div>
          </div>

          {NETWORK_MODULE_GROUPS.map((g) => (
            <div className="np-sec" key={g.label}>
              <div className="pm-section-label">{g.label}</div>
              <div className="pm-mod-grid">
                {g.modules.map((m) => (
                  <div className={`pm-mod-card${modules[m.key] ? ' enabled' : ''}`} key={m.key}>
                    <div className="pm-mod-icon"><i className={`fa-solid ${m.icon}`} /></div>
                    <div className="pm-mod-name">{m.name}</div>
                    <Switch checked={!!modules[m.key]} onChange={(v) => setModule(m.key, v)} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pm-foot">
          <button className="btn-secondary" onClick={onClose} disabled={saving}><i className="fa-solid fa-xmark" /> Cancel</button>
          <button
            className="btn-primary"
            disabled={saving}
            onClick={() => onSave({ activeNetwork, permissionId, modules })}
          >
            <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} /> {saving ? 'Saving…' : 'Save Permissions'}
          </button>
        </div>
      </div>
    </div>
  );
}
