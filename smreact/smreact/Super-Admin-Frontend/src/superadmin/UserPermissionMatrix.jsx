import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { moduleAccessApi } from './api';
import { ACTIONS, ACTION_LABELS, PERM_MODULES, TOTAL_PERMS, pkey, isOn, permsToApiList, apiListToPerms, setModule, buildInitialPerms, moduleStat, overallStats, isHeadUser, roleLabel } from './permissionModel';
import { useSaPerms, lockTip } from './saPerms';

export { ACTIONS, PERM_MODULES };

/* ═══════════════════════════════════════════════════════════════════
   USER PERMISSION — ERP jaisa design (User Management ▸ User Permission)

   • Table: har Super Admin user + uske kitne modules khule hain + Edit icon.
   • Edit icon → modal:
       left  = Super Admin sidebar ke modules (15 modules)
       right = us module ke screens × actions
               (View / Create / Edit / Delete / Approve / Download)
       Jo action kisi screen par lagu nahi wo greyed-out.

   ── Save / load ──
     • screen × action → POST /api/Auth/save-superadmin-module-permission
         { userID, modifiedBy, permissions:[{ menuName, subMenuName, action, isAccessable }] }
       modal khulte hi GET /api/Auth/get-superadmin-module-permission-byuserid/{userId}
       (404 "No permissions found" = abhi kuch save nahi).
     • module flag (us module me koi bhi action on) — isi list se nikalta hai
       (UserModuleAccess API backend se hat chuki hai); sidebar isi se chalta hai.
   ═══════════════════════════════════════════════════════════════════ */

const initials = (name) => (name || '').trim().split(/\s+/).filter(Boolean).map((p) => p[0]).join('').toUpperCase().slice(0, 2) || '?';

/* ═══════════════════════ TAB (users table) ═══════════════════════ */
export default function UserPermissionMatrix({ users, setPerms, toast, onPermsSaved }) {
  /* access[userId] = { loading, error, id, flags|null } */
  const [access, setAccess] = useState({});
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  /* User Permission ▸ Edit = modal kholna + save. View-only → icon disabled. */
  const P = useSaPerms('userManagement');
  const canEditPerms = P.can('permissions', 'edit');

  const loadOne = useCallback(async (uid) => {
    setAccess((p) => ({ ...p, [uid]: { ...(p[uid] || {}), loading: true, error: '' } }));
    try {
      const rec = await moduleAccessApi.getModuleAccess(uid);
      setAccess((p) => ({ ...p, [uid]: { loading: false, error: '', id: rec?.id || 0, flags: rec ? rec.flags : null, rows: rec?.rows || null } }));
    } catch (err) {
      setAccess((p) => ({ ...p, [uid]: { loading: false, error: err?.message || 'Could not load', id: 0, flags: null } }));
    }
  }, []);

  /* Saare users ki access — ek hi call (GET get-superadmin-module-permission).
     Jo user us list me nahi us ka kuch save nahi = Full Access (default). */
  const idsKey = users.map((u) => u.id).join(',');
  useEffect(() => {
    let alive = true;
    const ids = users.map((u) => u.id).filter(Boolean);
    setAccess((p) => {
      const next = { ...p };
      ids.forEach((id) => { next[id] = { ...(p[id] || {}), loading: true, error: '' }; });
      return next;
    });
    moduleAccessApi.getAllMenuPermissions()
      .then((map) => {
        if (!alive) return;
        setAccess(() => {
          const next = {};
          ids.forEach((id) => {
            const rows = map.get(Number(id));
            next[id] = { loading: false, error: '', id: 0, flags: rows ? moduleAccessApi.flagsFromMenuRows(rows) : null, rows: rows || null };
          });
          return next;
        });
      })
      .catch(async () => {
        /* bulk na chale to ek ek user (4 ek saath) */
        let i = 0;
        const worker = async () => { while (alive && i < ids.length) { const id = ids[i++]; await loadOne(id); } };
        await Promise.all(Array.from({ length: Math.min(4, ids.length) }, worker));
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, loadOne]);

  /* Backfill: jis user ka record nahi (ya kuch screen×action rows missing hain)
     us ki poori effective matrix user ke against save kar do —
       • record nahi → default = poori access (sab true)
       • kuch rows missing → saved rows waisi hi, baqi module flag se.
     Har user ek hi dafa try (session me); sirf wo chalaye jis ke paas Edit ho. */
  const backfilled = useRef(new Set());
  useEffect(() => {
    if (!canEditPerms) return;
    /* Head (isAdmin) ko backfill nahi — un par User Permission lagu hi nahi. */
    const ids = users.filter((u) => !isHeadUser(u)).map((u) => u.id).filter(Boolean);
    if (!ids.length || ids.some((id) => !access[id] || access[id].loading)) return; // load poora hone do
    const todo = ids.filter((id) => {
      const a = access[id];
      if (a.error || backfilled.current.has(id)) return false;
      if (!a.rows) return true;
      const stored = apiListToPerms(a.rows) || {};
      return Object.keys(buildInitialPerms(a.flags ?? null, null)).some((k) => stored[k] === undefined);
    });
    if (!todo.length) return;
    todo.forEach((id) => backfilled.current.add(id));
    let i = 0;
    const worker = async () => {
      while (i < todo.length) {
        const uid = todo[i++];
        const a = access[uid];
        const list = permsToApiList(buildInitialPerms(a.flags ?? null, a.rows ? apiListToPerms(a.rows) : null));
        try {
          await moduleAccessApi.saveMenuPermissions({ userId: uid, permissions: list });
          setAccess((p) => ({ ...p, [uid]: { ...p[uid], flags: moduleAccessApi.flagsFromMenuRows(list), rows: list } }));
          onPermsSaved?.(Number(uid));
        } catch (err) {
          console.warn('[superadmin] permission backfill failed for user', uid, err);
        }
      }
    };
    Promise.all(Array.from({ length: Math.min(3, todo.length) }, worker));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access, idsKey, canEditPerms]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => !q || `${u.fullName} ${u.phone || u.userName || ''}`.toLowerCase().includes(q));
  }, [users, search]);

  const summary = (uid) => {
    const a = access[uid];
    if (!a || a.loading) return <span style={{ color: 'var(--tm)', fontSize: 12 }}><i className="fa-solid fa-spinner fa-spin" /> Loading…</span>;
    if (a.error) return <span className="badge b-gray" title={a.error}>Not loaded</span>;
    /* Modal jaisa hi count: saved rows + module flags → kitne screen×action on hain.
       Koi record nahi (flags null) = default poori access = saare permissions. */
    const perms = buildInitialPerms(a.flags ?? null, a.rows ? apiListToPerms(a.rows) : null);
    const n = overallStats(perms).active;
    const tip = a.flags ? `${n} of ${TOTAL_PERMS} permissions active` : 'Full Access (default)';
    if (n === 0) return <span className="upm-count none" title={tip}>No access</span>;
    return <span className="upm-count" title={tip}>{n} active</span>;
  };

  return (
    <div className="um-panel">
      <style>{UPM_CSS}</style>
      <div className="section-card">
        <div className="card-header">
          <div>
            <div className="card-title"><i className="fa-solid fa-shield-halved" /> User Permission</div>
            <div className="card-sub">Choose which modules, screens and actions each user can access.</div>
          </div>
          <div className="search-box" style={{ width: 220 }}><i className="fa-solid fa-magnifying-glass" /><input className="search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search user…" /></div>
        </div>
        <div className="tbl-wrap">
          <table className="um-table">
            <thead><tr>
              <th style={{ width: 60 }}>Sr.No</th><th>Name</th><th style={{ width: 140 }}>Phone</th>
              <th style={{ width: 90, textAlign: 'center' }}>Role</th>
              <th style={{ width: 90, textAlign: 'center' }}>Status</th>
              <th style={{ width: 190, textAlign: 'center' }}>Permissions</th>
              <th style={{ width: 90, textAlign: 'center' }}>Action</th>
            </tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 36, color: 'var(--tm)' }}>No users found</td></tr>
              ) : rows.map((u, i) => (
                <tr key={u.id}>
                  <td style={{ color: 'var(--tm)', fontWeight: 700 }}>{i + 1}</td>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div className="um-avatar">{initials(u.fullName)}</div>
                    <div style={{ fontWeight: 700, color: 'var(--t1)' }}>{u.fullName}</div>
                  </div></td>
                  <td>{u.phone || u.userName || '—'}</td>
                  <td style={{ textAlign: 'center' }}><span className={`badge ${isHeadUser(u) ? 'b-blue' : 'b-gray'}`}>{roleLabel(u)}</span></td>
                  <td style={{ textAlign: 'center' }}><span className={`badge ${u.active ? 'b-green' : 'b-gray'}`}>{u.active ? 'Active' : 'Inactive'}</span></td>
                  <td style={{ textAlign: 'center' }}>{isHeadUser(u) ? <span className="upm-count" title="Head — always has full access">Full Access</span> : summary(u.id)}</td>
                  <td style={{ textAlign: 'center' }}>
                    {/* Head = poori access, User Permission lagu nahi → icon disabled */}
                    <button className="upm-icon-btn" data-tip={isHeadUser(u) ? 'Head has full access' : canEditPerms ? 'Edit Permissions' : lockTip('edit')} onClick={() => { if (isHeadUser(u)) return; if (P.guard('permissions', 'edit', toast)) setEditing(u); }} disabled={isHeadUser(u) || !canEditPerms || access[u.id]?.loading}>
                      <i className="fa-solid fa-user-shield" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <PermissionMatrixModal
          user={editing}
          record={access[editing.id]}
          onClose={() => setEditing(null)}
          toast={toast}
          onSaved={async (flags) => {
            const uid = editing.id;
            setPerms?.((prev) => ({ ...prev, [uid]: moduleAccessApi.flagsToLegacyMenus(flags) }));
            onPermsSaved?.(Number(uid));
            setEditing(null);
            await loadOne(uid);
          }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════ MODAL (ERP jaisa) ═══════════════════════ */
function PermissionMatrixModal({ user, record, onClose, onSaved, toast }) {
  const [perms, setPermsState] = useState(() => buildInitialPerms(record?.flags ?? null, null));
  const [activeKey, setActiveKey] = useState(PERM_MODULES[0].key);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasSaved, setHasSaved] = useState(false);
  const P = useSaPerms('userManagement');

  /* Modal khulte hi saved screen × action permissions GET karo
     (get-superadmin-module-permission-byuserid). Kuch save na ho to module
     flags se shuru. */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await moduleAccessApi.getMenuPermissions(user.id);
        if (!alive) return;
        const stored = apiListToPerms(rows);
        setHasSaved(!!stored);
        if (stored) setPermsState(buildInitialPerms(record?.flags ?? null, stored));
      } catch (err) {
        if (alive) toast?.(err?.message || 'Could not load permissions', 'error');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const mod = PERM_MODULES.find((m) => m.key === activeKey) || PERM_MODULES[0];
  const mStat = moduleStat(perms, mod);
  const stats = overallStats(perms);
  const noRecord = !record?.flags;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const toggle = (screenId, action) => setPermsState((p) => ({ ...p, [pkey(mod.key, screenId, action)]: !p[pkey(mod.key, screenId, action)] }));
  const setRow = (screen, value) => setPermsState((p) => {
    const next = { ...p };
    screen.actions.forEach((a) => { next[pkey(mod.key, screen.id, a)] = value; });
    return next;
  });
  const setAll = (value) => setPermsState((p) => PERM_MODULES.reduce((acc, m) => setModule(acc, m, value), { ...p }));

  const save = async () => {
    if (saving) return;
    if (!P.guard('permissions', 'edit', toast)) return;
    const flags = {};
    PERM_MODULES.forEach((m) => { flags[m.key] = moduleStat(perms, m).anyOn; });
    setSaving(true);
    try {
      /* Poori matrix (true/false dono). Sidebar bhi isi se chalta hai —
         module me koi action on = module dikhega. */
      await moduleAccessApi.saveMenuPermissions({ userId: user.id, permissions: permsToApiList(perms) });
      toast?.(`Permissions saved for ${user.fullName}`, 'success');
      await onSaved(flags);
    } catch (err) {
      toast?.(err?.message || 'Could not save permissions', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="upm-ov" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="upm-modal" role="dialog" aria-modal="true" aria-labelledby="upm-title">
        {/* Header */}
        <div className="upm-hdr">
          <div className="upm-hdr-ic"><i className="fa-solid fa-shield-halved" /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="upm-hdr-tt" id="upm-title">Edit Permissions — {user.fullName}</div>
            <div className="upm-hdr-chips">
              <span className="upm-chip"><span className={`upm-dot${user.active ? '' : ' off'}`} /> {user.active ? 'Active' : 'Inactive'}</span>
              <span className="upm-chip"><i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`} /> {loading ? 'Loading…' : (hasSaved || !noRecord) ? 'Custom Access' : 'Default (Full Access)'}</span>
            </div>
          </div>
          <button className="upm-x" onClick={onClose} disabled={saving} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
        </div>

        <div className="upm-body">
          {/* Left rail */}
          <aside className="upm-side">
            <div className="upm-side-lbl">SUPER ADMIN MODULES</div>
            <button className="upm-btn-primary" onClick={() => setAll(true)}><i className="fa-solid fa-check-double" /> Select All Modules</button>
            <button className="upm-btn-outline" onClick={() => setAll(false)}><i className="fa-solid fa-xmark" /> Deselect All</button>
            <div className="upm-side-list">
              {PERM_MODULES.map((m) => {
                const st = moduleStat(perms, m);
                const tone = st.allOn ? 'green' : st.anyOn ? 'blue' : 'gray';
                return (
                  <button key={m.key} className={`upm-mod${m.key === activeKey ? ' on' : ''}`} onClick={() => setActiveKey(m.key)}>
                    <span className="upm-mod-ic"><i className={`fa-solid ${m.icon}`} /></span>
                    <span className="upm-mod-lbl">{m.label}</span>
                    <span className={`upm-mod-cnt ${tone}`}>{st.on}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Right pane */}
          <section className="upm-main">
            <div className="upm-main-h">
              <div className="upm-main-tt"><span className="upm-main-ic"><i className={`fa-solid ${mod.icon}`} /></span>{mod.label}</div>
              <button className={`upm-mod-all${mStat.allOn ? ' on' : ''}`} onClick={() => setPermsState((p) => setModule(p, mod, !mStat.allOn))}>
                <i className={`fa-solid ${mStat.allOn ? 'fa-toggle-on' : 'fa-toggle-off'}`} /> {mStat.allOn ? 'Deselect ALL for this Module' : 'Select ALL for this Module'}
              </button>
            </div>

            <div className="upm-info"><i className="fa-solid fa-circle-info" /> Greyed-out permissions are <b>not available</b> for this module. Only applicable permissions can be assigned.</div>

            <div className="upm-matrix-wrap">
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--tm)', fontSize: 13.5 }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} /> Loading saved permissions…
                </div>
              ) : (
              <table className="upm-matrix">
                <thead><tr>
                  <th className="l">Screen / Section</th>
                  {ACTIONS.map((a) => <th key={a}>{ACTION_LABELS[a]}</th>)}
                  <th className="r" />
                </tr></thead>
                <tbody>
                  {mod.screens.map((s) => {
                    const any = s.actions.some((a) => isOn(perms, mod.key, s.id, a));
                    return (
                      <tr key={s.id}>
                        <td className="l">{s.label}</td>
                        {ACTIONS.map((a) => {
                          const ok = s.actions.includes(a);
                          return (
                            <td key={a} className={ok ? '' : 'na'} title={ok ? `${ACTION_LABELS[a]} — ${s.label}` : 'Not applicable for this screen'}>
                              <input type="checkbox" disabled={!ok} checked={ok && isOn(perms, mod.key, s.id, a)} onChange={() => toggle(s.id, a)} />
                            </td>
                          );
                        })}
                        <td className="r"><button type="button" className="upm-row-link" onClick={() => setRow(s, !any)}>{any ? 'Deselect' : 'Select All'}</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              )}
            </div>

            <div className="upm-sum"><i className="fa-solid fa-circle-info" /> <b>{stats.modules}</b> modules · <b>{stats.screens}</b> screens · <b>{stats.active}</b> permissions active</div>
          </section>
        </div>

        {/* Footer */}
        <div className="upm-foot">
          <div className="upm-foot-chips">
            <span className="upm-fchip blue">Modules: {stats.modules}</span>
            <span className="upm-fchip indigo">Screens: {stats.screens}</span>
            <span className="upm-fchip red">Restricted: {stats.restricted}</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={saving || loading}><i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} /> {saving ? 'Saving…' : 'Save Permissions'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const UPM_CSS = `
.sa-root .upm-count{display:inline-block;padding:4px 12px;border-radius:999px;font-size:12.5px;font-weight:700;background:rgba(59,130,246,.12);color:var(--brand);border:1px solid rgba(59,130,246,.35);white-space:nowrap}
.sa-root .upm-count.none{background:rgba(148,163,184,.15);color:var(--tm);border-color:rgba(148,163,184,.4)}
.sa-root .upm-icon-btn{width:34px;height:34px;border-radius:10px;border:1.5px solid var(--brand);background:rgba(30,58,138,.06);color:var(--brand);display:inline-flex;align-items:center;justify-content:center;font-size:14px;cursor:pointer;transition:all .15s}
.sa-root .upm-icon-btn:hover:not(:disabled){background:var(--brand);color:#fff}
.sa-root .upm-icon-btn:disabled{opacity:.45;cursor:not-allowed}
.sa-root .upm-ov{position:fixed;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(2px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px}
.sa-root .upm-modal{background:var(--card);border-radius:20px;width:100%;max-width:1240px;height:min(860px,92vh);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 60px rgba(15,23,42,.35)}
.sa-root .upm-hdr{display:flex;align-items:center;gap:14px;padding:18px 24px;background:linear-gradient(135deg,#1E3A8A,#1D4ED8);color:#fff;flex-shrink:0}
.sa-root .upm-hdr-ic{width:50px;height:50px;border-radius:14px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;font-size:20px}
.sa-root .upm-hdr-tt{font-size:19px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sa-root .upm-hdr-chips{display:flex;gap:8px;margin-top:6px;flex-wrap:wrap}
.sa-root .upm-chip{display:inline-flex;align-items:center;gap:6px;padding:3px 12px;border-radius:999px;background:rgba(255,255,255,.18);font-size:12px;font-weight:700}
.sa-root .upm-dot{width:7px;height:7px;border-radius:50%;background:#22C55E}
.sa-root .upm-dot.off{background:#94A3B8}
.sa-root .upm-x{width:38px;height:38px;border-radius:10px;border:none;background:rgba(255,255,255,.18);color:#fff;font-size:16px;cursor:pointer}
.sa-root .upm-x:hover{background:rgba(255,255,255,.3)}
.sa-root .upm-body{flex:1;min-height:0;display:flex}
.sa-root .upm-side{width:300px;flex-shrink:0;border-right:1px solid var(--bl);display:flex;flex-direction:column;padding:16px 14px;gap:10px;background:var(--card)}
.sa-root .upm-side-lbl{font-size:11.5px;font-weight:800;letter-spacing:.6px;color:var(--tm)}
.sa-root .upm-btn-primary{height:42px;border-radius:10px;border:none;background:var(--brand);color:#fff;font-weight:700;font-size:13.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}
.sa-root .upm-btn-outline{height:42px;border-radius:10px;border:1.5px solid var(--bl);background:var(--card);color:var(--t1);font-weight:700;font-size:13.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}
.sa-root .upm-side-list{flex:1;min-height:0;overflow-y:auto;margin-top:6px;display:flex;flex-direction:column;gap:4px;padding-right:2px}
.sa-root .upm-mod{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;border:none;border-left:3px solid transparent;background:transparent;cursor:pointer;text-align:left;color:var(--t1);font-size:14px;font-weight:600}
.sa-root .upm-mod:hover{background:var(--muted)}
.sa-root .upm-mod.on{background:var(--brand-light);border-left-color:var(--brand);color:var(--brand)}
.sa-root .upm-mod-ic{width:30px;height:30px;border-radius:8px;background:var(--muted);color:var(--brand);display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0}
.sa-root .upm-mod-lbl{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sa-root .upm-mod-cnt{font-size:12px;font-weight:800;min-width:22px;text-align:right}
.sa-root .upm-mod-cnt.green{color:#16A34A}.sa-root .upm-mod-cnt.blue{color:var(--brand)}.sa-root .upm-mod-cnt.gray{color:var(--tm)}
.sa-root .upm-main{flex:1;min-width:0;display:flex;flex-direction:column;padding:18px 24px;gap:14px;overflow:hidden;background:var(--bg)}
.sa-root .upm-main-h{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;background:var(--card);border-radius:12px;padding:14px 18px;border:1px solid var(--bl)}
.sa-root .upm-main-tt{display:flex;align-items:center;gap:12px;font-size:19px;font-weight:800;color:var(--t1)}
.sa-root .upm-main-ic{width:36px;height:36px;border-radius:10px;background:var(--muted);color:var(--brand);display:flex;align-items:center;justify-content:center;font-size:15px}
.sa-root .upm-mod-all{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 16px;border-radius:999px;border:1.5px solid var(--brand-light);background:var(--card);color:var(--brand);font-weight:700;font-size:13.5px;cursor:pointer}
.sa-root .upm-mod-all.on{background:var(--brand);border-color:var(--brand);color:#fff}
.sa-root .upm-info{display:flex;align-items:center;gap:8px;padding:11px 16px;border-radius:10px;background:var(--muted);border:1px solid var(--brand-light);color:var(--tm);font-size:13px}
.sa-root .upm-info i{color:var(--brand)}
.sa-root .upm-info b{color:var(--t1)}
.sa-root .upm-matrix-wrap{flex:1;min-height:0;overflow:auto;background:var(--card);border:1px solid var(--bl);border-radius:12px}
.sa-root .upm-matrix{width:100%;border-collapse:collapse;font-size:14px;min-width:720px}
.sa-root .upm-matrix thead th{position:sticky;top:0;z-index:1;background:var(--muted);color:var(--t2);font-size:11.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;padding:13px 10px;text-align:center;border-bottom:1px solid var(--bl)}
.sa-root .upm-matrix th.l,.sa-root .upm-matrix td.l{text-align:left;padding-left:18px;min-width:220px}
.sa-root .upm-matrix td{padding:16px 10px;text-align:center;border-bottom:1px solid var(--bl);color:var(--t1)}
.sa-root .upm-matrix td.l{font-weight:600}
.sa-root .upm-matrix tbody tr:hover td{background:var(--muted)}
.sa-root .upm-matrix input[type=checkbox]{width:20px;height:20px;accent-color:var(--brand);cursor:pointer}
.sa-root .upm-matrix td.na input{opacity:.3;cursor:not-allowed}
.sa-root .upm-matrix th.r,.sa-root .upm-matrix td.r{width:90px;text-align:right;padding-right:16px}
.sa-root .upm-row-link{border:none;background:none;color:var(--brand);font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}
.sa-root .upm-row-link:hover{text-decoration:underline}
.sa-root .upm-sum{font-size:13.5px;color:var(--tm)}
.sa-root .upm-sum i{color:var(--brand)}.sa-root .upm-sum b{color:var(--t1)}
.sa-root .upm-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 24px;border-top:1px solid var(--bl);background:var(--card);flex-wrap:wrap;flex-shrink:0}
.sa-root .upm-foot-chips{display:flex;gap:8px;flex-wrap:wrap}
.sa-root .upm-fchip{padding:5px 12px;border-radius:999px;font-size:12.5px;font-weight:800}
.sa-root .upm-fchip.blue{background:rgba(30,58,138,.08);color:var(--brand)}
.sa-root .upm-fchip.indigo{background:rgba(79,70,229,.08);color:#4F46E5}
.sa-root .upm-fchip.red{background:rgba(220,38,38,.08);color:#DC2626}
@media (max-width:900px){
  .sa-root .upm-body{flex-direction:column;overflow-y:auto}
  .sa-root .upm-side{width:auto;border-right:none;border-bottom:1px solid var(--bl)}
  .sa-root .upm-side-list{flex-direction:row;overflow-x:auto;overflow-y:hidden}
  .sa-root .upm-mod{flex-shrink:0}
  .sa-root .upm-main{overflow:visible}
  .sa-root .upm-matrix-wrap{min-height:260px}
}
`;
