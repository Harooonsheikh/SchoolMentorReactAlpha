import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  MODULE_TREE, PRIMARY_ACTIONS, ADVANCED_ACTIONS, ACTION_LABELS,
  getApplicablePerms, isPermApplicable, permStats, permsForUser,
} from './permissionsData'

/* ═══════════════════════════════════════════════════════════════════
   EDIT PERMISSIONS — full-screen matrix modal.

   Same layout School-Mentor-Front-end's EditPermissionsPanel uses:
   left = module tree (sticky list) + global Select All / Deselect
   All, right = the screen×action matrix for the selected module —
   cells that aren't applicable for a screen render disabled/greyed,
   never hidden. Footer = summary chips + Cancel/Save.

   Scoped down per spec: no role pill, no Mobile App Access tab, no
   "Apply Role Template" dropdown (no roles here) — a user's matrix
   IS their permissions, edited directly.
   ═══════════════════════════════════════════════════════════════════ */
export default function PermissionMatrixModal({ empId, empName, onClose, onSave }) {
  const [perms, setPerms] = useState(() => ({ ...permsForUser(empId) }))
  const [selModId, setSelModId] = useState(MODULE_TREE[0].id)
  const [showAdv, setShowAdv] = useState(false)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  const selectedModule = MODULE_TREE.find((m) => m.id === selModId) || MODULE_TREE[0]

  const selectAllForModule = (mod, on) => {
    setPerms((p) => {
      const next = { ...p }
      mod.children.forEach((c) => { getApplicablePerms(c.id).forEach((a) => { next[`${c.id}.${a}`] = !!on }) })
      return next
    })
  }
  const selectAllForRow = (childId, on) => {
    setPerms((p) => {
      const next = { ...p }
      getApplicablePerms(childId).forEach((a) => { next[`${childId}.${a}`] = !!on })
      return next
    })
  }
  const handleGlobalSelectAll = () => {
    setPerms((p) => {
      const next = { ...p }
      MODULE_TREE.forEach((mod) => mod.children.forEach((c) => { getApplicablePerms(c.id).forEach((a) => { next[`${c.id}.${a}`] = true }) }))
      return next
    })
  }
  const handleGlobalDeselectAll = () => {
    setPerms((p) => {
      const next = { ...p }
      MODULE_TREE.forEach((mod) => mod.children.forEach((c) => { getApplicablePerms(c.id).forEach((a) => { next[`${c.id}.${a}`] = false }) }))
      return next
    })
  }

  const moduleCounts = useMemo(() => {
    const out = {}
    MODULE_TREE.forEach((mod) => {
      let total = 0; let on = 0
      mod.children.forEach((c) => {
        getApplicablePerms(c.id).forEach((a) => { total += 1; if (perms[`${c.id}.${a}`]) on += 1 })
      })
      out[mod.id] = { total, on, allOn: on === total && total > 0, anyOn: on > 0 }
    })
    return out
  }, [perms])

  const stats = useMemo(() => permStats(perms), [perms])

  const onSubmit = () => {
    const cleaned = {}
    MODULE_TREE.forEach((mod) => {
      mod.children.forEach((c) => {
        getApplicablePerms(c.id).forEach((a) => {
          const key = `${c.id}.${a}`
          if (perms[key]) cleaned[key] = true
        })
      })
    })
    onSave(cleaned)
  }

  const modOn = moduleCounts[selModId]?.allOn
  const visibleActions = showAdv ? [...PRIMARY_ACTIONS, ...ADVANCED_ACTIONS] : PRIMARY_ACTIONS

  return createPortal((
    <div className="up-modal-back" role="dialog" aria-modal="true" aria-labelledby="up-edit-title" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="up-modal up-modal--xl">
        <div className="up-modal-head">
          <div className="up-modal-head-l">
            <div className="up-modal-icn"><i className="fa-solid fa-shield-halved" aria-hidden="true" /></div>
            <div>
              <div className="up-modal-title" id="up-edit-title">Edit Permissions — {empName}</div>
              <div className="up-modal-sub">Choose which modules, screens and actions this staff member can access</div>
            </div>
          </div>
          <button className="up-modal-x" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
        </div>

        <div className="up-modal-body up-modal-body--row">
          {/* ── LEFT — module tree ── */}
          <aside className="up-edit-side">
            <div className="up-edit-side-h">Modules</div>
            <div className="up-edit-side-top">
              <button type="button" className="up-btn up-btn-primary up-btn-sm" style={{ width: '100%', justifyContent: 'center', marginBottom: 6 }} onClick={handleGlobalSelectAll}>
                <i className="fa-solid fa-check-double" aria-hidden="true" /> Select All Modules
              </button>
              <button type="button" className="up-btn up-btn-ghost up-btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={handleGlobalDeselectAll}>
                <i className="fa-solid fa-xmark" aria-hidden="true" /> Deselect All
              </button>
            </div>
            <div className="up-edit-side-list">
              {MODULE_TREE.map((m) => {
                const st = moduleCounts[m.id]
                return (
                  <button type="button" key={m.id} className={`up-edit-mod${m.id === selModId ? ' on' : ''}`} onClick={() => setSelModId(m.id)} aria-pressed={m.id === selModId}>
                    <span className="up-edit-mod-chev"><i className={`fa-solid ${m.id === selModId ? 'fa-chevron-right' : ''}`} aria-hidden="true" /></span>
                    <span className="up-edit-mod-ic"><i className={`fa-solid ${m.icon}`} aria-hidden="true" /></span>
                    <span className="up-edit-mod-lbl">{m.label}</span>
                    <span className="up-edit-mod-count" style={{ color: st?.allOn ? 'var(--success)' : st?.anyOn ? 'var(--brand)' : 'var(--tm)' }}>{st?.on || 0}</span>
                  </button>
                )
              })}
            </div>
          </aside>

          {/* ── RIGHT — matrix ── */}
          <section className="up-edit-content">
            <div className="up-edit-mod-h">
              <div className="up-edit-mod-title">
                <span className="up-edit-mod-title-ic"><i className={`fa-solid ${selectedModule.icon}`} aria-hidden="true" /></span>
                <span>{selectedModule.label}</span>
              </div>
              <button type="button" className={`up-edit-mod-toggle${modOn ? ' on' : ''}`} onClick={() => selectAllForModule(selectedModule, !modOn)}>
                <i className={`fa-solid ${modOn ? 'fa-toggle-on' : 'fa-toggle-off'}`} aria-hidden="true" /> Select ALL for this Module
              </button>
            </div>

            <div className="up-hint"><i className="fa-solid fa-circle-info" aria-hidden="true" /> Greyed-out permissions are <strong>not available</strong> for this module. Only applicable permissions can be assigned.</div>

            <div className="up-matrix">
              <div className="up-matrix-scroll">
                <div className="up-matrix-head" style={{ gridTemplateColumns: `160px repeat(${visibleActions.length},72px) 90px` }}>
                  <div className="up-matrix-h-cell l">Screen / Section</div>
                  {visibleActions.map((a) => <div key={a} className="up-matrix-h-cell">{ACTION_LABELS[a]}</div>)}
                  <div className="up-matrix-h-cell">
                    <button type="button" className="up-matrix-row-link" onClick={() => setShowAdv((s) => !s)}>{showAdv ? '◀ Less' : 'More ▶'}</button>
                  </div>
                </div>
                {selectedModule.children.map((child) => {
                  const applicable = getApplicablePerms(child.id)
                  const someOn = applicable.some((a) => perms[`${child.id}.${a}`])
                  return (
                    <div key={child.id} className="up-matrix-row" style={{ gridTemplateColumns: `160px repeat(${visibleActions.length},72px) 90px` }}>
                      <div className="up-matrix-screen" title={child.label}>{child.label}</div>
                      {visibleActions.map((a) => {
                        const key = `${child.id}.${a}`
                        const ok = isPermApplicable(child.id, a)
                        return (
                          <div key={a} className="up-matrix-cell" title={!ok ? 'Not applicable for this module' : undefined} style={ok ? undefined : { opacity: .3, cursor: 'not-allowed' }}>
                            <input
                              type="checkbox" className="up-cb"
                              checked={ok && !!perms[key]}
                              disabled={!ok}
                              onChange={(e) => { if (ok) setPerms((p) => ({ ...p, [key]: e.target.checked })) }}
                              aria-label={`${ACTION_LABELS[a]} ${child.label}`}
                            />
                          </div>
                        )
                      })}
                      <div className="up-matrix-cell">
                        <button type="button" className="up-matrix-row-link" onClick={() => selectAllForRow(child.id, !someOn)}>{someOn ? 'Deselect All' : 'Select All'}</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="up-edit-summary"><i className="fa-solid fa-info-circle" aria-hidden="true" /> <b>{stats.modules}</b> modules · <b>{stats.screens}</b> screens · <b>{stats.active}</b> permissions active</div>
          </section>
        </div>

        <div className="up-modal-foot up-modal-foot--split">
          <div className="up-modal-foot-l">
            <span className="up-badge up-badge--blue">Modules: {stats.modules}</span>
            <span className="up-badge up-badge--blue">Screens: {stats.screens}</span>
            <span className="up-badge up-badge--red">Restricted: {stats.restricted}</span>
          </div>
          <div className="up-modal-foot-r">
            <button type="button" className="up-btn up-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="up-btn up-btn-primary" onClick={onSubmit}><i className="fa-solid fa-floppy-disk" aria-hidden="true" /> Save Permissions</button>
          </div>
        </div>
      </div>
    </div>
  ), document.body)
}
