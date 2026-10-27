import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import TutorialButton from '../../components/TutorialButton'
import {
  moduleIcon, moduleLabel,
  loadRequests, saveRequests, loadChainApprovers, saveChainApprovers,
  getChainVisible, getPending, getHistory, decideRequest,
} from './data'
import { loadHr, fullName, initials } from '../HumanResource/data'
import { hasPerm } from '../UserPermissions/permissionsData'
import './Approvals.css'

const TABS = [
  { id: 'pending', label: 'Pending Approvals', icon: 'fa-hourglass-half' },
  { id: 'history', label: 'History',           icon: 'fa-clock-rotate-left' },
]

const fmtDateTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}
const statusTone = (s) => (s === 'approved' ? 'green' : s === 'rejected' ? 'red' : 'amber')

/* ═══════════════════════════════════════════════════════════════════
   Payload/before rendering — ported 1:1 from School-Mentor-Front-
   end's src/components/Approvals.jsx. A payload value counts as a
   "group" (its own titled sub-card) when it's a plain object, or a
   "table" (its own titled grid) when it's a non-empty array of plain
   objects — anything else (string/number/etc.) stays a simple
   label/value row. Lets a data-rich payload like Pre-Enrollment
   Admission's organize its fee breakdown instead of drowning it in
   one long flat list, while simple flat payloads (Fee Discount,
   Accounts, HR, Inventory) render exactly as plain rows.
   ═══════════════════════════════════════════════════════════════════ */
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isObjectTable = (v) => Array.isArray(v) && v.length > 0 && v.every(isPlainObject)
const isGroupValue = (v) => isPlainObject(v) || isObjectTable(v)

const GROUP_ICONS = [
  [/fee|challan|payment|discount|due/i, 'fa-money-bill-wave'],
  [/parent|guardian|father|mother/i,    'fa-people-roof'],
  [/student|admission|personal/i,       'fa-user-graduate'],
  [/academic|class|exam/i,              'fa-book-open-reader'],
  [/contact|address|email/i,            'fa-address-card'],
]
function groupIcon(label = '') {
  const hit = GROUP_ICONS.find(([re]) => re.test(label))
  return hit ? hit[1] : 'fa-layer-group'
}

function ObjectTable({ rows }) {
  const cols = Object.keys(rows[0])
  return (
    <div className="ap-table-scroll">
      <table className="ap-mini-table">
        <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i}>{cols.map((c) => <td key={c}>{row[c] ?? '—'}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

/* Renders a group's value one level at a time — a plain object becomes
   flat label/value rows, except any entry that is itself a group
   value, which becomes its own indented sub-block instead of a
   JSON.stringify dump. */
function GroupBody({ value }) {
  if (isObjectTable(value)) return <ObjectTable rows={value} />
  return Object.entries(value).map(([k, v]) => (
    isGroupValue(v) ? (
      <div key={k} className="al-subgroup">
        <div className="al-subgroup-lbl">{k}</div>
        <GroupBody value={v} />
      </div>
    ) : (
      <div key={k} className="ap-kv"><span>{k}</span><b>{String(v)}</b></div>
    )
  ))
}

function GroupCard({ label, value, tone }) {
  return (
    <div className={`al-group-card${tone ? ` al-group-card--${tone}` : ''}`}>
      <div className="al-group-head">
        <div className="al-group-ic"><i className={`fa-solid ${groupIcon(label)}`} /></div>
        <div className="al-group-title">{label}</div>
      </div>
      <div className="al-group-body"><GroupBody value={value} /></div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   APPROVALS — centralized review inbox, not a request-creation
   screen. Requests originate inside each school's own ERP (School
   Mentor) and only ever land here for schools whose School
   Permissions → Approval Settings is set to "Chain Managed" — see
   ./data.js's getChainVisible/isChainManaged, which reads School
   Permissions' own store live, never a copy. A school set to
   "School Managed" reviews its own requests inside its own ERP and
   never appears here; "Disabled" schools raise none.

   Layout/behavior mirrors School-Mentor-Front-end's own
   src/components/Approvals.jsx: stat strip, tab bar, request table,
   detail modal with Approve/Reject — re-themed onto this app's CSS
   tokens. No "New Request" composer and no "My Requests" tab — Chain
   Admin only ever reviews, never raises a request from this screen.

   No login system in this app (see Dashboard.jsx's own "View
   Dashboard As" for the same convention) — a "Reviewing As" selector
   previews a staff member's permissions from the User Permissions
   matrix, gating Approve / Reject / Manage Chain Approvers exactly as
   the User Permissions integration requires. ═══════════════════════════════════════════════════════════════════ */
export default function Approvals() {
  const [requests, setRequests] = useState([])
  const [tab, setTab] = useState('pending')
  const [selected, setSelected] = useState(null)
  const [reviewMode, setReviewMode] = useState(null)
  const [approversOpen, setApproversOpen] = useState(false)
  const [chainApprovers, setChainApprovers] = useState([])
  const [viewerId, setViewerId] = useState('')
  const [toast, setToast] = useState(null)

  const staff = useMemo(() => loadHr().emps, [])
  const viewer = staff.find((e) => e.id === viewerId)

  useEffect(() => { setRequests(loadRequests()); setChainApprovers(loadChainApprovers()) }, [])
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t) }, [toast])
  const fire = (text, type = 'success') => setToast({ text, type })

  const commit = (next) => { setRequests(next); saveRequests(next) }
  const can = (action) => !viewerId || hasPerm(viewerId, `approvals.${action === 'manage_settings' ? 'approvers' : 'review'}`, action)

  const visible = useMemo(() => getChainVisible(requests), [requests])
  const pending = useMemo(() => getPending(visible), [visible])
  const history = useMemo(() => getHistory(visible), [visible])
  const rows = tab === 'pending' ? pending : history

  const stats = {
    pending: pending.length,
    approved: visible.filter((r) => r.status === 'approved').length,
    rejected: visible.filter((r) => r.status === 'rejected').length,
    total: visible.length,
  }

  const openDetail = (r, mode) => { setSelected(r); setReviewMode(mode) }
  const closeDetail = () => { setSelected(null); setReviewMode(null) }

  const decide = (id, decision, comment) => {
    commit(decideRequest(requests, id, decision, { reviewedBy: viewer ? fullName(viewer) : 'Chain Admin', comment }))
    fire(decision === 'approve' ? 'Request approved' : 'Request rejected')
    closeDetail()
  }

  const saveApprovers = (ids) => { setChainApprovers(ids); saveChainApprovers(ids); fire('Chain approvers updated'); setApproversOpen(false) }

  return (
    <>
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}><i className="fa-solid fa-square-check" /></div>
          <div>
            <div className="page-title">Approvals</div>
            <div className="page-sub">Review and manage approval requests submitted by schools under your chain.</div>
          </div>
        </div>
        <TutorialButton />
      </div>

      <div className="ap-toolbar">
        <div className="ap-viewer" title="Preview this page as a staff member's permissions (User Permissions module)">
          <span className="ap-viewer-av">{viewerId ? initials(viewer || {}) : <i className="fa-solid fa-building-shield" />}</span>
          <select className="ap-viewer-sel" value={viewerId} onChange={(e) => setViewerId(e.target.value)} aria-label="Reviewing as">
            <option value="">Chain Admin (full access)</option>
            {staff.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}
          </select>
          <i className="fa-solid fa-chevron-down" aria-hidden="true" />
          <span className="ap-viewer-lbl">Reviewing as</span>
        </div>
        <div style={{ flex: 1 }} />
        {can('manage_settings') && (
          <button className="ap-btn ap-btn-ghost" onClick={() => setApproversOpen(true)}><i className="fa-solid fa-user-shield" /> Manage Chain Approvers</button>
        )}
      </div>

      <div className="al-stats">
        <div className="al-stat al-stat--amber"><div className="al-stat-ic"><i className="fa-solid fa-hourglass-half" /></div><div className="al-stat-lbl">Pending Approvals</div><div className="al-stat-val">{stats.pending}</div></div>
        <div className="al-stat al-stat--green"><div className="al-stat-ic"><i className="fa-solid fa-circle-check" /></div><div className="al-stat-lbl">Approved Requests</div><div className="al-stat-val">{stats.approved}</div></div>
        <div className="al-stat al-stat--red"><div className="al-stat-ic"><i className="fa-solid fa-circle-xmark" /></div><div className="al-stat-lbl">Rejected Requests</div><div className="al-stat-val">{stats.rejected}</div></div>
        <div className="al-stat al-stat--blue"><div className="al-stat-ic"><i className="fa-solid fa-layer-group" /></div><div className="al-stat-lbl">Total Requests</div><div className="al-stat-val">{stats.total}</div></div>
      </div>

      <div className="ap-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`ap-tab${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}>
            <i className={`fa-solid ${t.icon}`} /> {t.label}
            {t.id === 'pending' && stats.pending > 0 && <span className="ap-tab-count">{stats.pending}</span>}
          </button>
        ))}
      </div>

      <div className="al-table-card">
        <div className="al-table-h">
          <div className="al-table-title"><i className="fa-solid fa-list-check" /> {TABS.find((t) => t.id === tab)?.label}<span className="al-count-badge">{rows.length} {rows.length === 1 ? 'request' : 'requests'}</span></div>
        </div>

        {rows.length === 0 ? (
          <div className="up-empty">
            <div className="up-empty-ic"><i className="fa-solid fa-inbox" /></div>
            <div className="up-empty-t">{tab === 'pending' ? 'Nothing waiting on a decision' : 'No reviewed requests yet'}</div>
            <div className="up-empty-s">{tab === 'pending' ? 'New Chain Managed requests from your schools will appear here for review.' : 'Approved and rejected requests will be listed here for reference.'}</div>
          </div>
        ) : (
          <div className="al-table-scroll">
            <table className="al-table">
              <thead>
                <tr>
                  <th>Request ID</th><th>Request Type</th><th>School</th><th>Module</th><th>Details</th>
                  <th>Requested By</th><th>Requested Date</th><th>Status</th>
                  {tab !== 'pending' && <th>Reviewed By</th>}
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="al-td-date">{r.id}</td>
                    <td>{r.actionLabel}</td>
                    <td className="al-td-school">{r.school}</td>
                    <td><span className="al-module-chip"><i className={`fa-solid ${moduleIcon(r.module)}`} /> {moduleLabel(r.module)}</span></td>
                    <td className="al-td-details">{r.entitySummary}</td>
                    <td>{r.requestedBy}</td>
                    <td className="al-td-time">{fmtDateTime(r.requestedAt)}</td>
                    <td><span className={`up-badge up-badge--${statusTone(r.status)}`}>{r.status}</span></td>
                    {tab !== 'pending' && <td>{r.reviewedBy || '—'}</td>}
                    <td style={{ textAlign: 'right' }}>
                      <div className="ap-row-actions">
                        <button className="al-icon-btn" title="View details" onClick={() => openDetail(r, null)}><i className="fa-solid fa-eye" /></button>
                        {tab === 'pending' && can('approve') && <button className="al-icon-btn ap-icon-btn--green" title="Approve" onClick={() => openDetail(r, 'approve')}><i className="fa-solid fa-check" /></button>}
                        {tab === 'pending' && can('reject') && <button className="al-icon-btn ap-icon-btn--red" title="Reject" onClick={() => openDetail(r, 'reject')}><i className="fa-solid fa-xmark" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <ApprovalDetailModal request={selected} mode={reviewMode} onClose={closeDetail} onDecide={decide} />}
      {approversOpen && <ApproversModal staff={staff} selected={chainApprovers} onClose={() => setApproversOpen(false)} onSave={saveApprovers} />}

      {toast && createPortal(
        <div className="ss-toast-wrap"><div className={`ss-toast ${toast.type}`}><i className={`fa-solid ${toast.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} /> {toast.text}</div></div>,
        document.body,
      )}
    </>
  )
}

function ApprovalDetailModal({ request: r, mode, onClose, onDecide }) {
  const [comment, setComment] = useState('')
  const isReview = mode === 'approve' || mode === 'reject'

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const payloadEntries = Object.entries(r.payload || {})
  const beforeEntries = r.before ? Object.entries(r.before) : []
  const scalarEntries = payloadEntries.filter(([, v]) => !isGroupValue(v))
  const groupEntries = payloadEntries.filter(([, v]) => isGroupValue(v))
  const beforeScalarEntries = beforeEntries.filter(([, v]) => !isGroupValue(v))
  const beforeGroupEntries = beforeEntries.filter(([, v]) => isGroupValue(v))

  return createPortal(
    <div className="apm-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="apm-modal apm-modal--lg">
        <div className="apm-head">
          <div className="apm-head-l">
            <div className="apm-icn"><i className={`fa-solid ${moduleIcon(r.module)}`} /></div>
            <div>
              <div className="apm-title">{r.actionLabel}</div>
              <div className="apm-sub">{r.id} · {moduleLabel(r.module)}</div>
            </div>
          </div>
          <button className="apm-x" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>

        <div className="apm-body">
          <div className="al-detail-grid">
            <div className="al-detail-cell"><span className="al-detail-lbl">School</span><span className="al-detail-val">{r.school}</span></div>
            <div className="al-detail-cell"><span className="al-detail-lbl">Module</span><span className="al-detail-val">{moduleLabel(r.module)}</span></div>
            <div className="al-detail-cell"><span className="al-detail-lbl">Requested By</span><span className="al-detail-val">{r.requestedBy}</span></div>
            <div className="al-detail-cell"><span className="al-detail-lbl">Requested At</span><span className="al-detail-val">{fmtDateTime(r.requestedAt)}</span></div>
            <div className="al-detail-cell"><span className="al-detail-lbl">Status</span><span className="al-detail-val"><span className={`up-badge up-badge--${statusTone(r.status)}`}>{r.status}</span></span></div>
            {r.reviewedBy && (
              <>
                <div className="al-detail-cell"><span className="al-detail-lbl">Reviewed By</span><span className="al-detail-val">{r.reviewedBy}</span></div>
                <div className="al-detail-cell"><span className="al-detail-lbl">Reviewed At</span><span className="al-detail-val">{fmtDateTime(r.reviewedAt)}</span></div>
              </>
            )}
          </div>

          <div className="al-detail-block" style={{ marginBottom: 14 }}>
            <div className="al-detail-lbl">Description</div>
            <div className="al-detail-val" style={{ marginTop: 4 }}>{r.entitySummary}</div>
          </div>

          {r.requestComment && (
            <div className="al-detail-block" style={{ marginBottom: 14 }}>
              <div className="al-detail-lbl">Requester's Note</div>
              <div className="al-detail-val" style={{ marginTop: 4 }}>{r.requestComment}</div>
            </div>
          )}

          {(beforeScalarEntries.length > 0 || scalarEntries.length > 0) && (
            <div className="al-detail-row">
              {beforeScalarEntries.length > 0 && (
                <div className="al-detail-block before">
                  <div className="al-detail-lbl">Current State</div>
                  {beforeScalarEntries.map(([k, v]) => <div key={k} className="ap-kv"><span>{k}</span><b>{String(v)}</b></div>)}
                </div>
              )}
              <div className="al-detail-block after">
                <div className="al-detail-lbl">{beforeEntries.length ? 'Requested Change' : 'Change Details'}</div>
                {scalarEntries.map(([k, v]) => <div key={k} className="ap-kv"><span>{k}</span><b>{String(v)}</b></div>)}
              </div>
            </div>
          )}

          {(beforeGroupEntries.length > 0 || groupEntries.length > 0) && (
            <div className="al-detail-groups">
              {beforeGroupEntries.map(([k, v]) => <GroupCard key={`before-${k}`} label={k} value={v} tone="before" />)}
              {groupEntries.map(([k, v]) => <GroupCard key={`after-${k}`} label={k} value={v} tone={beforeGroupEntries.length ? 'after' : undefined} />)}
            </div>
          )}

          {r.status !== 'pending' && r.reviewComment && (
            <div className="al-detail-block">
              <div className="al-detail-lbl">Approval History — Approver's Comment</div>
              <div className="al-detail-val" style={{ marginTop: 4 }}>{r.reviewComment}</div>
            </div>
          )}

          {isReview && (
            <div style={{ marginTop: 16 }}>
              <label className="al-field">
                <span>{mode === 'approve' ? 'Approval Comment (optional)' : 'Reason for Rejection (optional)'}</span>
                <textarea className="apm-input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={mode === 'approve' ? 'Add a note for the record…' : 'Let the school know why…'} />
              </label>
            </div>
          )}
        </div>

        <div className="apm-foot">
          <button type="button" className="ap-btn ap-btn-ghost" onClick={onClose}>{isReview ? 'Cancel' : 'Close'}</button>
          {mode === 'approve' && <button type="button" className="ap-btn ap-btn-approve" onClick={() => onDecide(r.id, 'approve', comment)}><i className="fa-solid fa-check" /> Approve Request</button>}
          {mode === 'reject' && <button type="button" className="ap-btn ap-btn-reject" onClick={() => onDecide(r.id, 'reject', comment)}><i className="fa-solid fa-xmark" /> Reject Request</button>}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function ApproversModal({ staff, selected, onClose, onSave }) {
  const [picked, setPicked] = useState(new Set(selected))
  const toggle = (id) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  return createPortal(
    <div className="apm-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="apm-modal">
        <div className="apm-head">
          <div className="apm-head-l">
            <div className="apm-icn"><i className="fa-solid fa-user-shield" /></div>
            <div>
              <div className="apm-title">Manage Chain Approvers</div>
              <div className="apm-sub">Staff who can approve or reject Chain Managed requests from any school</div>
            </div>
          </div>
          <button className="apm-x" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="apm-body">
          <div className="um-col-grid">
            {staff.filter((e) => e.status === 'Active').map((e) => (
              <label className="um-col-item" key={e.id}><input type="checkbox" checked={picked.has(e.id)} onChange={() => toggle(e.id)} /> {fullName(e)}</label>
            ))}
          </div>
        </div>
        <div className="apm-foot">
          <button className="ap-btn ap-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="ap-btn ap-btn-approve" onClick={() => onSave([...picked])}><i className="fa-solid fa-check" /> Save Approvers</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
