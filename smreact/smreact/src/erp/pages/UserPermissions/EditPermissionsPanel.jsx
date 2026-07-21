import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import {
  MODULE_TREE,
  PRIMARY_ACTIONS,
  ADVANCED_ACTIONS,
  ACTION_LABELS,
  ROLE_TEMPLATES,
  effectivePermsForUser,
  permStats,
  findRole,
  permsFromTemplate,
  permsFromModules,
  getApplicablePerms,
  isPermApplicable,
  getActiveModuleTree,
  permsFromApiPermissions,
  apiPermissionsFromKeys,
} from './permissionsData';
import { useModules } from '../../context/ModuleContext';
import { buildUrl } from '../../../utils/apiConfig';

/* ═══════════════════════════════════════════════════════════════════
   EDIT PERMISSIONS PANEL — full-screen XL modal

   Left  : module tree (sticky list) + global Select All / Deselect All
   Right : permission matrix for the currently-selected module — cells
           that aren't applicable for a given screen render disabled
           (greyed, never stored in state).
   Foot  : summary chips + Save Permissions

   ── LAYOUT CONTRACT ──
   Header + data rows live inside ONE horizontal-scroll container so
   columns stay locked at every scroll position and viewport width.
   Every cell has explicit width + min-width + max-width + flex-shrink
   0 so row content never pushes columns sideways.
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Fixed column widths (in px) ─── */
const COL_SCREEN = 160;
const COL_PERM   = 72;
const COL_ACTION = 90;     /* "More ▶" header cell + "Deselect All" data cell share this column */

/* Reusable cell-style fragments. Inline only — no new CSS rules. */
const permCellStyle = {
  width: COL_PERM, minWidth: COL_PERM, maxWidth: COL_PERM,
  flexShrink: 0, flexGrow: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 0,
};
const permHeadStyle = {
  ...permCellStyle,
  padding: '10px 0',
  fontSize: 9.5, fontWeight: 800,
  textTransform: 'uppercase', letterSpacing: '0.5px',
  color: 'var(--text-muted, #64748B)',
  textAlign: 'center',
};
const screenHeadStyle = {
  width: COL_SCREEN, minWidth: COL_SCREEN, maxWidth: COL_SCREEN,
  flexShrink: 0, flexGrow: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
  padding: '10px 14px',
  fontSize: 9.5, fontWeight: 800,
  textTransform: 'uppercase', letterSpacing: '0.5px',
  color: 'var(--text-muted, #64748B)',
};
const screenDataStyle = {
  width: COL_SCREEN, minWidth: COL_SCREEN, maxWidth: COL_SCREEN,
  flexShrink: 0, flexGrow: 0,
  padding: '8px 14px',
  fontSize: 12.5, fontWeight: 600,
  color: 'var(--text-primary)',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  display: 'flex', alignItems: 'center',
};
const actionCellStyle = {
  width: COL_ACTION, minWidth: COL_ACTION, maxWidth: COL_ACTION,
  flexShrink: 0, flexGrow: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const checkboxStyle = {
  width: 18, height: 18,
  margin: 0, padding: 0,
  accentColor: '#1E40AF',
  borderRadius: 4,
  display: 'block',
  flexShrink: 0,
  cursor: 'pointer',
};

export default function EditPermissionsPanel({ user, roles, readOnly, onClose, onSave, toast }) {
  const role = findRole(roles, user.role);

  /* ─── Filter MODULE_TREE by the runtime module-activation state.
     Disabled modules disappear from both the left rail and the
     matrix; the user only sees / can edit permissions for modules
     their school has switched on in Launch Setup. Core-locked
     modules always stay because ModuleContext refuses to flip
     them off. */
  const { moduleState } = useModules();
  /* Agar user ko role assigned hai jiske modules defined hain, to Edit
     Permissions ki left menu + matrix sirf UNHI modules tak limit rahein
     (role ke against jo modules banaye the) — baaki saare modules chhupe.
     Role ke bina (ya bina modules) → poora active tree dikhao. */
  const visibleTree = useMemo(() => {
    const active = getActiveModuleTree(moduleState);
    if (role && Array.isArray(role.modules) && role.modules.length) {
      const wanted = new Set(role.modules);
      const filtered = active.filter((m) => wanted.has(m.id));
      return filtered.length ? filtered : active;
    }
    return active;
  }, [moduleState, role]);

  /* Seed the editable permission map from the user's effective perms. */
  const [perms,     setPerms]     = useState(() => ({ ...effectivePermsForUser(user, roles) }));
  const [selModId,  setSelModId]  = useState(visibleTree[0]?.id || MODULE_TREE[0].id);
  const [showAdv,   setShowAdv]   = useState(false);
  /* API se aayi permissions ke keys (`${childId}.${action}`). Frontend applicability
     config (MODULE_PERMISSIONS) backend se out-of-sync ho sakti hai, is liye jo perm
     API ne di ho use bhi applicable maano — warna checkbox greyed reh kar checked
     nahi dikhta. */
  const [apiKeys,   setApiKeys]   = useState(() => new Set());

  /* Config-applicable actions + jo API ne is screen ke liye di hain. */
  const applicableFor = (childId) => {
    const base = getApplicablePerms(childId);
    if (!apiKeys.size) return base;
    let extra = null;
    const prefix = `${childId}.`;
    apiKeys.forEach((k) => {
      if (k.startsWith(prefix)) {
        const act = k.slice(prefix.length);
        if (act && !act.includes('.') && !base.includes(act)) { (extra || (extra = [])).push(act); }
      }
    });
    return extra ? [...base, ...extra] : base;
  };

  /* View / Edit kholte hi is user ki real permissions API se laao aur checkboxes
     seed karo: menuName → module (left), subMenuName → screen (right), action ka
     isAccessable=true → checkbox checked. */
  useEffect(() => {
    /* Role-based user (role ke modules defined): permissions role ki base
       par hoti hain — role ke har module ki har applicable action checked.
       Yahi source of truth hai, is liye purani saved custom perms ko
       fetch/override NAHI karte (warna sab checked nahi dikhte). */
    if (role && Array.isArray(role.modules) && role.modules.length) {
      const seeded = permsFromModules(role.modules);
      setPerms(seeded);
      setApiKeys(new Set(Object.keys(seeded)));
      return undefined;
    }
    const empId = user.empId;
    if (empId == null) return undefined;
    let alive = true;
    const branchId = sessionStorage.getItem('branchID') || '1';
    const token = sessionStorage.getItem('token');
    fetch(buildUrl(`/get-user-menu-permissions-by-branch/${branchId}`), {
      method: 'GET',
      headers: { Accept: '*/*', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
      .then((r) => r.json())
      .then((json) => {
        if (!alive) return;
        const entry = (json?.data || []).find((d) => String(d.employeeID) === String(empId));
        if (!entry) return;
        const mapped = permsFromApiPermissions(entry.permissions);
        setPerms(mapped);
        const keys = Object.keys(mapped);
        setApiKeys(new Set(keys));
        /* Jis module me perm hai usi tab ko active kar do. */
        const grantedChildIds = new Set(keys.map((k) => k.slice(0, k.lastIndexOf('.'))));
        const modWithPerm = visibleTree.find((m) => m.children.some((c) => grantedChildIds.has(c.id)));
        if (modWithPerm) setSelModId(modWithPerm.id);
      })
      .catch((err) => console.error('Could not load user menu permissions:', err));
    return () => { alive = false; };
  }, [user, role]);

  /* If the currently-selected module gets switched off while the
     panel is open, snap to the first visible module instead of
     rendering an empty matrix. */
  useEffect(() => {
    if (visibleTree.length === 0) return;
    if (!visibleTree.some(m => m.id === selModId)) {
      setSelModId(visibleTree[0].id);
    }
  }, [visibleTree, selModId]);

  /* ─── Mobile single-panel toggle ───
     On viewports ≤ 600 px only ONE panel is visible at a time. Tapping
     a module slides to the matrix; the Back button returns to the
     module list. On desktop the state is read but visually ignored —
     CSS-free, driven by a media-query listener. */
  const [mobilePanelView, setMobilePanelView] = useState('left');
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mqMobile = window.matchMedia('(max-width: 600px)');
    const mqTablet = window.matchMedia('(min-width: 601px) and (max-width: 900px)');
    const update = () => {
      setIsMobile(mqMobile.matches);
      setIsTablet(mqTablet.matches);
    };
    update();
    const subscribe = (mq) => {
      if (mq.addEventListener) mq.addEventListener('change', update);
      else mq.addListener(update);
    };
    const unsubscribe = (mq) => {
      if (mq.removeEventListener) mq.removeEventListener('change', update);
      else mq.removeListener(update);
    };
    subscribe(mqMobile);
    subscribe(mqTablet);
    return () => {
      unsubscribe(mqMobile);
      unsubscribe(mqTablet);
    };
  }, []);
  const leftPanelWidth = isMobile ? '100%' : (isTablet ? 220 : 260);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const selectedModule =
    visibleTree.find(m => m.id === selModId) || visibleTree[0] || null;

  /* ─── Bulk operations — only ever touch *applicable* permissions. ───
     Non-applicable cells are skipped entirely so they never end up in
     state, never count in the summary, never appear checked. */
  const selectAllForModule = (mod, on) => {
    setPerms(p => {
      const next = { ...p };
      mod.children.forEach(c => {
        applicableFor(c.id).forEach(a => {
          next[`${c.id}.${a}`] = !!on;
        });
      });
      return next;
    });
  };
  const selectAllForRow = (childId, on) => {
    setPerms(p => {
      const next = { ...p };
      applicableFor(childId).forEach(a => {
        next[`${childId}.${a}`] = !!on;
      });
      return next;
    });
  };
  const handleGlobalSelectAll = () => {
    /* Iterate visibleTree (active modules only) so the global
       Select All / Deselect All never touches permissions for
       modules the school has disabled. */
    setPerms(p => {
      const next = { ...p };
      visibleTree.forEach(mod => {
        mod.children.forEach(c => {
          applicableFor(c.id).forEach(a => {
            next[`${c.id}.${a}`] = true;
          });
        });
      });
      return next;
    });
  };
  const handleGlobalDeselectAll = () => {
    setPerms(p => {
      const next = { ...p };
      visibleTree.forEach(mod => {
        mod.children.forEach(c => {
          applicableFor(c.id).forEach(a => {
            next[`${c.id}.${a}`] = false;
          });
        });
      });
      return next;
    });
  };
  const applyTemplate = (templateKey) => {
    if (!templateKey || !selectedModule) return;
    const tplPerms = permsFromTemplate(templateKey);
    /* Merge the template into the current module only — and only at
       cells that are applicable for the given screen. */
    setPerms(p => {
      const next = { ...p };
      selectedModule.children.forEach(c => {
        applicableFor(c.id).forEach(a => {
          const key = `${c.id}.${a}`;
          next[key] = !!tplPerms[key];
        });
      });
      return next;
    });
    toast(`Template applied to ${selectedModule.label}`, 'info');
  };

  /* Module-level "all" / "any" state for the side tree count —
     applicable cells only. Renamed from `moduleState` so it doesn't
     shadow the `moduleState` map coming from useModules(). */
  const moduleCounts = useMemo(() => {
    const out = {};
    visibleTree.forEach(mod => {
      let total = 0;
      let on = 0;
      mod.children.forEach(c => {
        const applicable = applicableFor(c.id);
        applicable.forEach(a => {
          total += 1;
          if (perms[`${c.id}.${a}`]) on += 1;
        });
      });
      out[mod.id] = { total, on, allOn: on === total && total > 0, anyOn: on > 0 };
    });
    return out;
  }, [perms, visibleTree, apiKeys]);

  const stats = useMemo(() => permStats(perms), [perms]);

  const [saving, setSaving] = useState(false);

  const onSubmit = async () => {
    if (readOnly) { onClose(); return; }
    if (saving) return;
    /* Defensive: filter out any non-applicable keys that may have been
       carried over from an older saved state. We intentionally iterate
       the FULL MODULE_TREE here (not visibleTree) so permissions for
       modules the school has temporarily disabled survive the
       round-trip — they'll reappear correctly if the module is
       reactivated later. */
    const cleaned = {};
    MODULE_TREE.forEach(mod => {
      mod.children.forEach(c => {
        applicableFor(c.id).forEach(a => {
          const key = `${c.id}.${a}`;
          if (perms[key]) cleaned[key] = true;
        });
      });
    });
    const summary = `${stats.modules} modules · ${stats.screens} screens · ${stats.active} permissions`;

    /* Real API save — /save-user-menu-permissions. Payload backend ki shape me. */
    setSaving(true);
    try {
      const branchId = sessionStorage.getItem('branchID') || '1';
      const token = sessionStorage.getItem('token');
      /* Sirf un menus/submenus ko bhejo jo user ne actually touch/grant kiye:
         abhi checked (true) + jo API se load hue the (apiKeys — taake unchecking bhi
         false ke saath persist ho). Poore module-tree ki entries nahi. */
      const relevantKeys = new Set(apiKeys);
      Object.keys(perms).forEach((k) => { if (perms[k]) relevantKeys.add(k); });
      const payload = {
        branchID: Number(branchId) || 0,
        employeeID: Number(user.empId) || 0,
        permissions: apiPermissionsFromKeys(perms, [...relevantKeys]),
      };
      const res = await fetch(buildUrl('/save-user-menu-permissions'), {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || (json && json.success === false)) {
        toast((json && json.message) || 'Could not save permissions', 'error');
        setSaving(false);
        return;
      }
    } catch (err) {
      console.error('Could not save permissions:', err);
      toast('Could not save permissions', 'error');
      setSaving(false);
      return;
    }
    setSaving(false);
    onSave(cleaned, summary);
  };

  const modOn = moduleCounts[selModId]?.allOn;

  const visibleActions = showAdv
    ? [...PRIMARY_ACTIONS, ...ADVANCED_ACTIONS]
    : PRIMARY_ACTIONS;

  /* Visibility helpers for mobile single-panel mode. */
  const showLeft  = !isMobile || mobilePanelView === 'left';
  const showRight = !isMobile || mobilePanelView === 'right';

  return createPortal((
    <div
      className="up-modal-back"
      role="dialog" aria-modal="true" aria-labelledby="up-edit-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="up-modal up-modal--xl"
        style={isMobile ? { width: '100vw', height: '100vh', maxHeight: '100vh', borderRadius: 0 } : undefined}
      >
        <div className="up-modal-head">
          <div className="up-modal-head-l">
            <div className="up-modal-icn"><i className="fa-solid fa-shield-halved" aria-hidden="true"></i></div>
            <div>
              <div className="up-modal-title" id="up-edit-title">
                {readOnly ? 'View Permissions' : 'Edit Permissions'} — {user.name}
              </div>
              <div className="up-modal-sub">
                {role && (
                  <span
                    className="up-role-pill"
                    style={{ background: `${role.color}33`, color: '#fff', border: '1px solid rgba(255,255,255,.25)' }}
                  >
                    <span className="up-role-dot" style={{ background: role.color }} />
                    {role.name}
                  </span>
                )}
                {user.permType === 'custom' && (
                  <span className="up-badge up-badge--purple" style={{ background: 'rgba(255,255,255,.25)', color: '#fff' }}>
                    <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> Custom Access
                  </span>
                )}
              </div>
            </div>
          </div>
          <Tooltip text="Close (Esc)">
            <button className="up-modal-x" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>

        <div
          className="up-modal-body up-modal-body--row"
          style={{
            display: 'flex',
            flexDirection: 'row',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* ════════════════════ LEFT — module tree ════════════════════ */}
          {showLeft && (
          <aside
            className="up-edit-side"
            style={{
              width: leftPanelWidth,
              minWidth: leftPanelWidth,
              flexShrink: 0,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              borderRight: isMobile ? 'none' : '1px solid var(--border-light, #E2E8F0)',
            }}
          >
            <div className="up-edit-side-h">ERP Modules</div>

            {/* Global Select All / Deselect All — stacked, full width,
                no overlap. Both buttons skip non-applicable cells. */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                padding: '10px 12px',
                borderBottom: '1px solid var(--border-light, #E2E8F0)',
                marginBottom: '6px',
              }}
            >
              <Tooltip text="Toggle every applicable permission on across every active module">
                <button
                  type="button"
                  className="up-btn up-btn-primary up-btn-sm"
                  style={{ width: '100%', height: 36, justifyContent: 'center' }}
                  onClick={handleGlobalSelectAll}
                  disabled={readOnly}
                >
                  <i className="fa-solid fa-check-double" aria-hidden="true"></i> Select All Modules
                </button>
              </Tooltip>
              <Tooltip text="Clear every permission across every active module">
                <button
                  type="button"
                  className="up-btn up-btn-ghost up-btn-sm"
                  style={{ width: '100%', height: 36, justifyContent: 'center' }}
                  onClick={handleGlobalDeselectAll}
                  disabled={readOnly}
                >
                  <i className="fa-solid fa-xmark" aria-hidden="true"></i> Deselect All
                </button>
              </Tooltip>
            </div>

            <div className="up-edit-side-list">
              {visibleTree.map(m => {
                const st = moduleCounts[m.id];
                return (
                  <button
                    type="button"
                    key={m.id}
                    className={`up-edit-mod${m.id === selModId ? ' on' : ''}`}
                    onClick={() => {
                      setSelModId(m.id);
                      if (isMobile) setMobilePanelView('right');
                    }}
                    aria-pressed={m.id === selModId}
                    style={{ display: 'flex', alignItems: 'center', width: '100%' }}
                  >
                    <span
                      className="up-edit-mod-chev"
                      style={{ width: 20, minWidth: 20, textAlign: 'center', flexShrink: 0 }}
                    >
                      <i className={`fa-solid ${m.id === selModId ? 'fa-chevron-right' : ''}`} aria-hidden="true"></i>
                    </span>
                    <span
                      className="up-edit-mod-ic"
                      style={{ width: 20, minWidth: 20, textAlign: 'center', flexShrink: 0, fontSize: 16 }}
                    >
                      <i className={`fa-solid ${m.icon}`} aria-hidden="true"></i>
                    </span>
                    <span style={{ flex: 1, fontSize: 12.5, minWidth: 0, textAlign: 'left' }}>{m.label}</span>
                    <span
                      style={{
                        marginLeft: 'auto', flexShrink: 0,
                        fontSize: 9.5, fontWeight: 800,
                        color: st?.allOn ? '#15803D' : st?.anyOn ? '#1E40AF' : '#94A3B8',
                      }}
                    >
                      {st?.on || 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>
          )}

          {/* ════════════════════ RIGHT — matrix ════════════════════ */}
          {showRight && (
          <section
            className="up-edit-content"
            style={{
              flex: 1,
              minWidth: 0,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* ─── Module header row — sticky at top of right panel ─── */}
            <div
              className="up-edit-mod-h"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'nowrap',
                gap: 10,
                padding: '14px 16px',
                borderBottom: '1px solid var(--border-light, #E2E8F0)',
                background: 'var(--bg-card, #fff)',
                position: 'sticky',
                top: 0,
                zIndex: 11,
              }}
            >
              <div
                className="up-edit-mod-title"
                style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, minWidth: 0 }}
              >
                {isMobile && (
                  <Tooltip text="Back to modules">
                    <button
                      type="button"
                      onClick={() => setMobilePanelView('left')}
                      aria-label="Back to module list"
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        background: 'transparent',
                        border: '1px solid var(--border-light, #E2E8F0)',
                        color: 'var(--brand-primary, #1E40AF)',
                        cursor: 'pointer', flexShrink: 0,
                      }}
                    >
                      <i className="fa-solid fa-arrow-left" aria-hidden="true"></i>
                    </button>
                  </Tooltip>
                )}
                <span className="up-edit-mod-title-ic" style={{ flexShrink: 0 }}>
                  <i className={`fa-solid ${selectedModule?.icon || 'fa-shield-halved'}`} aria-hidden="true"></i>
                </span>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedModule?.label || 'No modules active'}
                </span>
              </div>
              <div
                className="up-edit-mod-actions"
                style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', flexShrink: 0 }}
              >
                <Tooltip text={modOn ? 'Switch off every applicable permission for this module' : 'Switch on every applicable permission for this module'}>
                  <button
                    type="button"
                    className={`up-edit-mod-toggle${modOn ? ' on' : ''}`}
                    onClick={() => selectedModule && selectAllForModule(selectedModule, !modOn)}
                    disabled={readOnly || !selectedModule}
                    style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    <i className={`fa-solid ${modOn ? 'fa-toggle-on' : 'fa-toggle-off'}`} aria-hidden="true"></i>
                    Select ALL for this Module
                  </button>
                </Tooltip>
                <Tooltip text="Apply a preset template to this module's permissions">
                  <select
                    className="up-select"
                    style={{
                      height: 32, padding: '0 28px 0 10px', fontSize: 11.5,
                      whiteSpace: 'nowrap', flexShrink: 0, minWidth: 160,
                    }}
                    defaultValue=""
                    onChange={(e) => { applyTemplate(e.target.value); e.target.value = ''; }}
                    disabled={readOnly}
                  >
                    <option value="">Apply Role Template…</option>
                    {Object.entries(ROLE_TEMPLATES).map(([k, t]) => (
                      <option key={k} value={k}>{t.label}</option>
                    ))}
                  </select>
                </Tooltip>
              </div>
            </div>

            {/* Helper text — explains why some cells are greyed out. */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                color: 'var(--text-muted, #64748B)',
                margin: '12px 16px',
                padding: '8px 12px',
                background: 'var(--bg-muted, #F8FAFF)',
                borderRadius: '8px',
                border: '1px solid var(--border-light, #BFDBFE)',
              }}
            >
              <i
                className="fa-solid fa-circle-info"
                style={{ color: 'var(--brand-primary, #1E40AF)', fontSize: '12px', flexShrink: 0 }}
                aria-hidden="true"
              ></i>
              <span>
                Greyed-out permissions are <strong>not available</strong> for this module. Only applicable permissions can be assigned.
              </span>
            </div>

            {/* ════════════════════ MATRIX ════════════════════
                Single horizontal-scroll container holds BOTH the
                header row and every data row. `min-width: max-content`
                on each row ensures they all share the same scroll
                width so columns stay locked at any scroll position. */}
            <div
              className="up-matrix"
              style={{
                flex: 1,
                margin: '0 16px 12px',
                border: '1px solid var(--border-light, #E2E8F0)',
                borderRadius: 10,
                overflowX: 'auto',
                overflowY: 'visible',
                width: 'calc(100% - 32px)',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <div className="up-matrix-scroll" style={{ display: 'block', minWidth: 'max-content' }}>
                {/* ─── Sticky header row ─── */}
                <div
                  className="up-matrix-head"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    background: 'var(--bg-muted, #F8FAFF)',
                    borderBottom: '2px solid var(--border-light, #BFDBFE)',
                    padding: 0,
                    minWidth: 'max-content',
                  }}
                >
                  <div className="up-matrix-h-cell" style={screenHeadStyle}>
                    Screen / Section
                  </div>
                  {visibleActions.map(a => (
                    <div key={a} className="up-matrix-h-cell" style={permHeadStyle}>
                      {ACTION_LABELS[a]}
                    </div>
                  ))}
                  <div className="up-matrix-h-cell" style={actionCellStyle}>
                    <Tooltip text={showAdv ? 'Hide advanced actions (Approve, Export, Print, etc.)' : 'Show advanced actions (Approve, Export, Print, etc.)'}>
                      <button
                        type="button"
                        className="up-matrix-row-link"
                        onClick={() => setShowAdv(s => !s)}
                        style={{
                          fontSize: 10, fontWeight: 700,
                          color: 'var(--brand-primary, #1E40AF)',
                          border: 'none', background: 'transparent', cursor: 'pointer',
                          whiteSpace: 'nowrap', padding: '4px 6px', borderRadius: 4,
                        }}
                      >
                        {showAdv ? '◀ Less' : 'More ▶'}
                      </button>
                    </Tooltip>
                  </div>
                </div>

                {/* ─── Data rows ─── */}
                {(selectedModule?.children || []).map(child => {
                  const applicable = applicableFor(child.id);
                  const someOn = applicable.some(a => perms[`${child.id}.${a}`]);
                  return (
                    <div
                      key={child.id}
                      className="up-matrix-row"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        minHeight: 48,
                        borderBottom: '1px solid var(--border-light, #F1F5F9)',
                        minWidth: 'max-content',
                        transition: 'background 0.15s',
                      }}
                    >
                      <div
                        className="up-matrix-screen"
                        title={child.label}
                        style={screenDataStyle}
                      >
                        {child.label}
                      </div>
                      {visibleActions.map(a => renderCell(child, a, perms, setPerms, readOnly, applicable.includes(a)))}
                      <div className="up-matrix-cell" style={actionCellStyle}>
                        <Tooltip text={someOn ? `Clear every applicable permission on the ${child.label} row` : `Toggle every applicable permission on the ${child.label} row`}>
                          <button
                            type="button"
                            className="up-matrix-row-link"
                            onClick={() => selectAllForRow(child.id, !someOn)}
                            disabled={readOnly}
                            style={{
                              fontSize: 10.5, fontWeight: 700,
                              color: 'var(--brand-primary, #1E40AF)',
                              border: 'none', background: 'transparent', cursor: 'pointer',
                              whiteSpace: 'nowrap', padding: '4px 6px', borderRadius: 4,
                            }}
                          >
                            {someOn ? 'Deselect All' : 'Select All'}
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="up-edit-summary" style={{ padding: '8px 16px 12px' }}>
              <i className="fa-solid fa-info-circle" style={{ marginRight: 6, color: '#1E40AF' }}></i>
              <b>{stats.modules}</b> modules · <b>{stats.screens}</b> screens · <b>{stats.active}</b> permissions active
            </div>
          </section>
          )}
        </div>

        <div className="up-modal-foot up-modal-foot--split">
          <div className="up-modal-foot-l">
            <Tooltip text="Top-level modules with at least one permission enabled">
              <span className="up-badge up-badge--blue">Modules: {stats.modules}</span>
            </Tooltip>
            <Tooltip text="Individual screens with at least one permission enabled">
              <span className="up-badge up-badge--blue">Screens: {stats.screens}</span>
            </Tooltip>
            <Tooltip text="Screens where every permission is off — user has no access">
              <span className="up-badge up-badge--red">Restricted: {stats.restricted}</span>
            </Tooltip>
            {user.permType === 'custom' && (
              <Tooltip text="This user has custom permissions overriding the role defaults">
                <span className="up-badge up-badge--purple">
                  <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> Custom
                </span>
              </Tooltip>
            )}
          </div>
          <div className="up-modal-foot-r">
            <Tooltip text={readOnly ? 'Close this panel' : 'Discard pending changes and close'}>
              <button type="button" className="up-btn up-btn-ghost" onClick={onClose}>
                {readOnly ? 'Close' : 'Cancel'}
              </button>
            </Tooltip>
            {!readOnly && (
              <Tooltip text="Save these custom permissions for this user">
                <button type="button" className="up-btn up-btn-primary" onClick={onSubmit} disabled={saving}
                  style={saving ? { opacity: .7, cursor: 'not-allowed' } : undefined}>
                  {saving
                    ? <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Saving…</>
                    : <><i className="fa-solid fa-floppy-disk" aria-hidden="true"></i> Save Permissions</>}
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  ), document.body);
}

/* ─── Render a single matrix cell ───
   Applicable cells get a normal 18×18 blue checkbox; non-applicable
   cells render disabled, dimmed, with a "Not applicable" tooltip and
   never reach setPerms. The cell itself always has fixed width so
   columns stay aligned. */
function renderCell(child, action, perms, setPerms, readOnly, applicable = isPermApplicable(child.id, action)) {
  const key        = `${child.id}.${action}`;

  return (
    <div
      key={action}
      className="up-matrix-cell"
      title={!applicable ? 'Not applicable for this module' : undefined}
      style={{
        ...permCellStyle,
        ...(applicable ? {} : { opacity: 0.25, cursor: 'not-allowed' }),
      }}
    >
      <input
        type="checkbox"
        className="up-cb"
        checked={applicable && !!perms[key]}
        onChange={(e) => {
          if (!applicable) return;
          setPerms(p => ({ ...p, [key]: e.target.checked }));
        }}
        disabled={readOnly || !applicable}
        aria-label={`${ACTION_LABELS[action]} ${child.label}`}
        style={{
          ...checkboxStyle,
          ...(applicable ? {} : { pointerEvents: 'none', cursor: 'not-allowed' }),
        }}
      />
    </div>
  );
}
