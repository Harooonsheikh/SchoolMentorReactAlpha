import { useCallback, useEffect, useRef, useState } from 'react'
import TutorialButton from '../../components/TutorialButton'
import { loadChainProfile, saveChainProfile } from '../../config/chainProfile'
import { useView } from '../../config/viewContext'
import { fetchSchoolRequests, decideSchoolRequest, removeSchoolFromNetwork } from '../../api/networkSchoolsApi'
import ClassesSubjects from './ClassesSubjects'

/* ═══════════════════════════════════════════════════════════════════
   SETTINGS — Chain/Franchise Profile + Connected Schools.

   Schools ka data Chain-Management API se aata hai, wahi source jo Switch
   View aur baqi screens use karti hain:
     • Pending Invitations = jin schools ne network me shamil hone ki request
       bheji aur abhi faisla nahi hua (fetchSchoolRequests)
     • Connected Schools   = shamil ho chuke schools (ViewProvider ka store,
       taake accept karte hi poori app ki list aik saath taza ho jaye)

   Join-requests pehle Switch View me thi — ab wahan sirf view badalna hai
   aur faisla yahan hota hai.

   Chain profile abhi bhi localStorage par hai (dekhein config/chainProfile).
   ═══════════════════════════════════════════════════════════════════ */

const INITIAL_PROFILE = {
  chainName: 'Mentor Education Group',
  regId: 'REG-2024-MEG-001',
  address: 'Plot 12, Bahria Town Phase 4, Rawalpindi, Punjab, Pakistan',
  contact: '+92 300 1234567',
  email: 'admin@mentoredu.pk',
  website: 'https://www.mentoredu.pk',
  bankName: 'HBL – Habib Bank Limited',
  accTitle: 'Mentor Education Group',
  iban: 'PK36HABB0000001234567890',
  branchName: 'Bahria Town Branch',
  branchCode: '0441',
  instructions:
    'Please mention your School Name and Invoice Number in the payment reference. Send proof of payment to accounts@mentoredu.pk within 24 hours of transfer.',
}

const CONFIRM_CFG = {
  accept: { title: 'Accept Invitation?', sub: 'Are you sure you want to accept this school into your chain network?', icon: 'fa-circle-check', iconBg: 'linear-gradient(135deg,#15803d,#16a34a)', btnClass: 'btn-primary', btnLabel: 'Yes, Accept', btnIcon: 'fa-check' },
  reject: { title: 'Reject Invitation?', sub: 'Are you sure you want to reject this invitation?', icon: 'fa-ban', iconBg: 'linear-gradient(135deg,#b91c1c,#dc2626)', btnClass: 'btn-danger', btnLabel: 'Yes, Reject', btnIcon: 'fa-ban' },
  remove: { title: 'Remove School?', sub: 'Are you sure you want to remove this school from your chain network?', icon: 'fa-link-slash', iconBg: 'linear-gradient(135deg,#b91c1c,#dc2626)', btnClass: 'btn-danger', btnLabel: 'Yes, Remove', btnIcon: 'fa-link-slash' },
}

/* Address ka aakhri hissa hi shehar hota hai ("Block C, Gulshan-e-Ravi,
   Lahore" → "Lahore"). API alag city field nahi deti. */
const cityOf = (address) => String(address || '').split(',').pop().trim()

/* API ki ISO tareekh → "12 Jun 2026". Na ho to dash. */
const fmtDate = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const erpLabel = (s) => (s.networkPermission ? 'Active' : 'Inactive')

export default function Settings() {
  const [mainTab, setMainTab] = useState('profile')
  const [editing, setEditing] = useState(false)
  const [schoolsTab, setSchoolsTab] = useState('pending')

  const [profile, setProfile] = useState(() => ({ ...INITIAL_PROFILE, ...loadChainProfile() }))

  /* Shamil ho chuke schools poori app ke sath share hote hain — accept ya
     remove ke baad reloadSchools se har screen ki list aik saath taza hoti
     hai (Switch View, Payments, Permissions …). */
  const { schools: connected, schoolsLoading: connLoading, schoolsError: connError, reloadSchools } = useView()

  /* Abhi faisla na hui requests — ye sirf isi screen ko chahiye. */
  const [pending, setPending] = useState([])
  const [pendLoading, setPendLoading] = useState(true)
  const [pendError, setPendError] = useState('')
  const [busyId, setBusyId] = useState(null)   // jis row par accept/reject/remove chal raha hai
  const [logoSrc, setLogoSrc] = useState(() => loadChainProfile().logo || null)

  const [invite, setInvite] = useState(null)     // invitation being viewed
  const [conn, setConn] = useState(null)          // connected school being viewed
  const [confirm, setConfirm] = useState(null)    // { action, id }
  const [toast, setToast] = useState(null)        // { type, icon, text }

  const logoInputRef = useRef(null)

  const loadPending = useCallback(async () => {
    setPendLoading(true)
    setPendError('')
    try {
      const { pending: rows } = await fetchSchoolRequests()
      setPending(rows)
    } catch (err) {
      console.error('Pending invitations load failed:', err)
      setPending([])
      setPendError(err?.message || 'Could not load pending invitations')
    } finally {
      setPendLoading(false)
    }
  }, [])

  useEffect(() => { loadPending() }, [loadPending])

  /* Auto-dismiss toast. */
  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const setField = (k, v) => setProfile((p) => ({ ...p, [k]: v }))

  const onPickLogo = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setLogoSrc(ev.target.result)
    reader.readAsDataURL(file)
  }

  const saveProfile = () => {
    /* Persist the chain identity (name + logo + contact) so reports and
       other modules brand themselves with the head-office profile. */
    saveChainProfile({
      chainName: profile.chainName,
      logo: logoSrc,
      address: profile.address,
      contact: profile.contact,
      email: profile.email,
      website: profile.website,
    })
    setEditing(false)
    setToast({ type: 'success', icon: 'fa-floppy-disk', text: 'Profile saved successfully.' })
  }
  const resetProfile = () => setProfile(INITIAL_PROFILE)

  /* Open confirm dialog (also closes the invite modal if open). */
  const askConfirm = (action, id) => { setInvite(null); setConfirm({ action, id }) }

  /* Accept / Reject aik hi `update` call hain (sirf isAccepted ka farq),
     Remove alag `delete` hai. Teenon ke baad list wahin se taza hoti hai
     jahan se aayi thi — local state se andaza nahi lagaya jaata. */
  const executeAction = async () => {
    if (!confirm) return
    const { action, id } = confirm
    setConfirm(null)
    setBusyId(id)
    try {
      if (action === 'accept' || action === 'reject') {
        const inv = pending.find((x) => x.id === id)
        if (!inv) return
        await decideSchoolRequest(inv, action === 'accept')
        setPending((prev) => prev.filter((x) => x.id !== id))
        if (action === 'accept') {
          await reloadSchools()
          setToast({ type: 'success', icon: 'fa-circle-check', text: `${inv.name} connected successfully.` })
        } else {
          setToast({ type: 'error', icon: 'fa-ban', text: 'Invitation rejected.' })
        }
      } else if (action === 'remove') {
        const school = connected.find((x) => (x.rowId ?? x.id) === id)
        if (!school) return
        await removeSchoolFromNetwork(school)
        await reloadSchools()
        setToast({ type: 'error', icon: 'fa-link-slash', text: `${school.name} removed from network.` })
      }
    } catch (err) {
      console.error('Settings action failed:', err)
      setToast({ type: 'error', icon: 'fa-triangle-exclamation', text: err?.message || 'Could not complete that action.' })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon" style={{ background: 'linear-gradient(135deg,#374151,#4B5563)' }}><i className="fa-solid fa-sliders" /></div>
          <div>
            <div className="page-title">Settings</div>
            <div className="page-sub">Manage chain profile, bank details, and connected school network.</div>
          </div>
        </div>
        <div className="page-actions">
          <TutorialButton />
        </div>
      </div>

      {/* Main tabs */}
      <div className="stg-tabs">
        <button className={`stg-tab${mainTab === 'profile' ? ' active' : ''}`} onClick={() => setMainTab('profile')}><i className="fa-solid fa-building" /> Chain / Franchise Profile</button>
        <button className={`stg-tab${mainTab === 'schools' ? ' active' : ''}`} onClick={() => setMainTab('schools')}><i className="fa-solid fa-link" /> Connected Schools</button>
        <button className={`stg-tab${mainTab === 'classes' ? ' active' : ''}`} onClick={() => setMainTab('classes')}><i className="fa-solid fa-chalkboard" /> Classes &amp; Subjects</button>
      </div>

      {/* ── TAB 1: PROFILE ── */}
      {mainTab === 'profile' && (
        <div className="stg-panel">
          {/* Preview card */}
          <div className="stg-preview-card">
            <div className="stg-preview-inner">
              <div className="stg-logo-preview">
                {logoSrc ? <img src={logoSrc} alt="Logo" /> : <i className="fa-solid fa-school" />}
              </div>
              <div className="stg-preview-info">
                <div className="stg-preview-name">{profile.chainName}</div>
                <div className="stg-preview-meta"><i className="fa-solid fa-location-dot" /> {profile.address}</div>
                <div className="stg-preview-meta"><i className="fa-solid fa-phone" /> {profile.contact} &nbsp;·&nbsp; <i className="fa-solid fa-envelope" /> {profile.email}</div>
                <div className="stg-preview-meta"><i className="fa-solid fa-globe" /> {profile.website}</div>
              </div>
              {!editing && (
                <div className="stg-preview-actions">
                  <button className="btn-primary" onClick={() => setEditing(true)}><i className="fa-solid fa-pen" /> Edit Profile</button>
                </div>
              )}
            </div>
          </div>

          {editing ? (
            <>
              {/* Basic profile form */}
              <div className="section-card" style={{ marginBottom: 18 }}>
                <div className="card-header">
                  <div>
                    <div className="card-title"><i className="fa-solid fa-building" /> Basic Profile</div>
                    <div className="card-sub">Franchise / chain head office information</div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="stg-field" style={{ marginBottom: 20 }}>
                    <label className="stg-label">Franchise / Chain Logo</label>
                    <div className="stg-logo-upload" onClick={() => logoInputRef.current?.click()}>
                      <div className="stg-upload-icon"><i className="fa-solid fa-cloud-arrow-up" /></div>
                      <div className="stg-upload-text">Click to upload logo</div>
                      <div className="stg-upload-sub">PNG, JPG up to 2MB · Recommended 200×200px</div>
                      <input type="file" accept="image/*" ref={logoInputRef} style={{ display: 'none' }} onChange={onPickLogo} />
                    </div>
                  </div>

                  <div className="stg-form-grid">
                    <Field label="Franchise / Chain Name" req value={profile.chainName} onChange={(v) => setField('chainName', v)} placeholder="Enter chain/franchise name" />
                    <Field label="Registration / Organization ID" value={profile.regId} onChange={(v) => setField('regId', v)} placeholder="Optional" />
                    <Field full label="Head Office Address" req value={profile.address} onChange={(v) => setField('address', v)} placeholder="Full address" />
                    <Field label="Contact Number" req type="tel" value={profile.contact} onChange={(v) => setField('contact', v)} placeholder="+92 3XX XXXXXXX" />
                    <Field label="Email Address" req type="email" value={profile.email} onChange={(v) => setField('email', v)} placeholder="email@domain.com" />
                    <Field label="Website URL" type="url" value={profile.website} onChange={(v) => setField('website', v)} placeholder="https://yourwebsite.com (optional)" />
                  </div>
                </div>
              </div>

              {/* Bank details form */}
              <div className="section-card" style={{ marginBottom: 18 }}>
                <div className="card-header">
                  <div>
                    <div className="card-title"><i className="fa-solid fa-building-columns" /> Bank Details</div>
                    <div className="card-sub">Payment account information for connected schools</div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="stg-info-box">
                    <i className="fa-solid fa-circle-info" />
                    <span>These bank details will be visible to connected schools for payment purposes.</span>
                  </div>
                  <div className="stg-form-grid" style={{ marginTop: 16 }}>
                    <Field label="Bank Name" req value={profile.bankName} onChange={(v) => setField('bankName', v)} placeholder="Bank name" />
                    <Field label="Account Title" req value={profile.accTitle} onChange={(v) => setField('accTitle', v)} placeholder="Account holder name" />
                    <Field label="Account Number / IBAN" req value={profile.iban} onChange={(v) => setField('iban', v)} placeholder="PK00XXXX0000000000000000" />
                    <Field label="Branch Name" req value={profile.branchName} onChange={(v) => setField('branchName', v)} placeholder="Branch name" />
                    <Field label="Branch Code" value={profile.branchCode} onChange={(v) => setField('branchCode', v)} placeholder="Optional" />
                    <div className="stg-field stg-full">
                      <label className="stg-label">Payment Instructions</label>
                      <textarea className="stg-textarea" value={profile.instructions} onChange={(e) => setField('instructions', e.target.value)} placeholder="Add any instructions for schools sending payment (optional)" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="stg-form-actions">
                <button className="btn-secondary" onClick={() => setEditing(false)}><i className="fa-solid fa-xmark" /> Cancel</button>
                <button className="btn-secondary" onClick={resetProfile}><i className="fa-solid fa-rotate-left" /> Reset</button>
                <button className="btn-primary" onClick={saveProfile}><i className="fa-solid fa-floppy-disk" /> Save Changes</button>
              </div>
            </>
          ) : (
            /* Bank preview */
            <div className="section-card">
              <div className="card-header">
                <div>
                  <div className="card-title"><i className="fa-solid fa-building-columns" /> Bank Account Details</div>
                  <div className="card-sub">Visible to connected schools for payment</div>
                </div>
                <button className="btn-sm" onClick={() => setEditing(true)}><i className="fa-solid fa-pen" /> Edit</button>
              </div>
              <div className="card-body">
                <div className="stg-info-box" style={{ marginBottom: 16 }}>
                  <i className="fa-solid fa-circle-info" />
                  <span>These bank details will be visible to connected schools for payment purposes.</span>
                </div>
                <div className="stg-bank-grid">
                  <BankRow label="Bank Name" value={profile.bankName} />
                  <BankRow label="Account Title" value={profile.accTitle} />
                  <BankRow label="IBAN" value={profile.iban} mono />
                  <BankRow label="Branch" value={`${profile.branchName}${profile.branchCode ? ` (${profile.branchCode})` : ''}`} />
                  <BankRow full label="Payment Instructions" value={profile.instructions} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: CONNECTED SCHOOLS ── */}
      {mainTab === 'schools' && (
        <div className="stg-panel">
          <div className="stg-subtabs">
            <button className={`stg-stab${schoolsTab === 'pending' ? ' active' : ''}`} onClick={() => setSchoolsTab('pending')}>
              <i className="fa-solid fa-clock" /> Pending Invitations
              <span className="stg-stab-cnt">{pending.length}</span>
            </button>
            <button className={`stg-stab${schoolsTab === 'connected' ? ' active' : ''}`} onClick={() => setSchoolsTab('connected')}>
              <i className="fa-solid fa-link" /> Connected Schools
              <span className="stg-stab-cnt">{connected.length}</span>
            </button>
          </div>

          {schoolsTab === 'pending' ? (
            <div className="stg-subpanel">
              <div className="section-card">
                <div className="card-header">
                  <div>
                    <div className="card-title"><i className="fa-solid fa-envelope-open-text" /> Pending Invitations</div>
                    <div className="card-sub">Schools requesting to join your chain network</div>
                  </div>
                </div>
                {pendLoading ? (
                  <div className="stg-empty">
                    <i className="fa-solid fa-spinner fa-spin" />
                    <div className="stg-empty-t">Loading invitations…</div>
                  </div>
                ) : pendError ? (
                  <div className="stg-empty">
                    <i className="fa-solid fa-triangle-exclamation" />
                    <div className="stg-empty-t">Could not load invitations</div>
                    <div className="stg-empty-s">{pendError}</div>
                  </div>
                ) : pending.length === 0 ? (
                  <div className="stg-empty">
                    <i className="fa-solid fa-envelope-open" />
                    <div className="stg-empty-t">No Pending Invitations</div>
                    <div className="stg-empty-s">All invitations have been processed.</div>
                  </div>
                ) : (
                  <div className="stg-tbl-wrap">
                    <table className="stg-table">
                      <thead><tr>
                        <th>#</th><th>School Name</th><th>Email</th><th>City</th><th>Contact</th><th>Requested On</th><th>Status</th><th style={{ textAlign: 'center' }}>Actions</th>
                      </tr></thead>
                      <tbody>
                        {pending.map((inv, i) => (
                          <tr key={inv.id}>
                            <td data-label="#">{i + 1}</td>
                            <td data-label="School" className="stg-td-bold">{inv.name}</td>
                            <td data-label="Email">{inv.email || '—'}</td>
                            <td data-label="City">{cityOf(inv.address) || '—'}</td>
                            <td data-label="Contact">{inv.phone || '—'}</td>
                            <td data-label="Date">{fmtDate(inv.requestedAt)}</td>
                            <td data-label="Status"><span className="stg-badge-pending">Pending</span></td>
                            <td data-label="Actions">
                              <div className="stg-act-row">
                                <button className="stg-btn-view" onClick={() => setInvite(inv)}><i className="fa-solid fa-eye" /> View</button>
                                <button className="stg-btn-accept" disabled={busyId === inv.id} onClick={() => askConfirm('accept', inv.id)}><i className={`fa-solid ${busyId === inv.id ? 'fa-spinner fa-spin' : 'fa-check'}`} /> Accept</button>
                                <button className="stg-btn-reject" disabled={busyId === inv.id} onClick={() => askConfirm('reject', inv.id)}><i className="fa-solid fa-ban" /> Reject</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="stg-subpanel">
              <div className="section-card">
                <div className="card-header">
                  <div>
                    <div className="card-title"><i className="fa-solid fa-network-wired" /> Connected Schools</div>
                    <div className="card-sub">Schools currently part of your chain network</div>
                  </div>
                </div>
                {connLoading ? (
                  <div className="stg-empty">
                    <i className="fa-solid fa-spinner fa-spin" />
                    <div className="stg-empty-t">Loading schools…</div>
                  </div>
                ) : connError ? (
                  <div className="stg-empty">
                    <i className="fa-solid fa-triangle-exclamation" />
                    <div className="stg-empty-t">Could not load connected schools</div>
                    <div className="stg-empty-s">{connError}</div>
                  </div>
                ) : connected.length === 0 ? (
                  <div className="stg-empty">
                    <i className="fa-solid fa-link-slash" />
                    <div className="stg-empty-t">No Connected Schools Yet</div>
                    <div className="stg-empty-s">Accept invitations to connect schools to your network.</div>
                  </div>
                ) : (
                  <div className="stg-tbl-wrap">
                    <table className="stg-table">
                      <thead><tr>
                        <th>#</th><th>School Name</th><th>Email</th><th>City</th><th>Contact</th><th>Connected Since</th><th>ERP Status</th><th style={{ textAlign: 'center' }}>Actions</th>
                      </tr></thead>
                      <tbody>
                        {connected.map((s, i) => {
                          /* Accept / Remove network-school row ki id par chalte
                             hain (rowId), branchID par nahi. */
                          const rowId = s.rowId ?? s.id
                          return (
                            <tr key={rowId}>
                              <td data-label="#">{i + 1}</td>
                              <td data-label="School" className="stg-td-bold">{s.name}</td>
                              <td data-label="Email">{s.email || '—'}</td>
                              <td data-label="City">{cityOf(s.address) || '—'}</td>
                              <td data-label="Contact">{s.phone || '—'}</td>
                              <td data-label="Since">{fmtDate(s.decidedAt || s.requestedAt)}</td>
                              <td data-label="ERP"><span className={s.networkPermission ? 'stg-badge-erp-on' : 'stg-badge-erp-off'}>{erpLabel(s)}</span></td>
                              <td data-label="Actions">
                                <div className="stg-act-row">
                                  <button className="stg-btn-view" onClick={() => setConn(s)}><i className="fa-solid fa-eye" /> View</button>
                                  <button className="stg-btn-remove" disabled={busyId === rowId} onClick={() => askConfirm('remove', rowId)}><i className={`fa-solid ${busyId === rowId ? 'fa-spinner fa-spin' : 'fa-link-slash'}`} /> Remove</button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: CLASSES & SUBJECTS ── */}
      {mainTab === 'classes' && <ClassesSubjects />}

      {/* ── MODALS ── */}
      {invite && <InviteModal inv={invite} onClose={() => setInvite(null)} onConfirm={askConfirm} />}
      {conn && <ConnModal s={conn} onClose={() => setConn(null)} onRemove={(id) => { setConn(null); askConfirm('remove', id) }} />}
      {confirm && <ConfirmModal cfg={CONFIRM_CFG[confirm.action]} onClose={() => setConfirm(null)} onConfirm={executeAction} />}

      {/* ── TOAST ── */}
      {toast && (
        <div className={`stg-toast ${toast.type}`}>
          <i className={`fa-solid ${toast.icon}`} /> {toast.text}
        </div>
      )}
    </>
  )
}

/* ── small helpers ── */
function Field({ label, req, full, type = 'text', value, onChange, placeholder }) {
  return (
    <div className={`stg-field${full ? ' stg-full' : ''}`}>
      <label className="stg-label">{label} {req && <span className="stg-req">*</span>}</label>
      <input className="stg-input" type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function BankRow({ label, value, mono, full }) {
  return (
    <div className={`stg-bank-row${full ? ' stg-bank-full' : ''}`}>
      <div className="stg-bank-lbl">{label}</div>
      <div className={`stg-bank-val${mono ? ' stg-mono' : ''}`}>{value}</div>
    </div>
  )
}

function Overlay({ children, onClose }) {
  return (
    <div className="stg-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      {children}
    </div>
  )
}

function InviteModal({ inv, onClose, onConfirm }) {
  return (
    <Overlay onClose={onClose}>
      <div className="stg-modal">
        <div className="stg-modal-hdr">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="stg-modal-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}><i className="fa-solid fa-envelope-open-text" /></div>
            <div>
              <div className="stg-modal-title">Invitation Details</div>
              <div className="stg-modal-sub">{inv.name}</div>
            </div>
          </div>
          <button className="stg-modal-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="stg-modal-body">
          <div className="stg-det-grid">
            <DetRow label="School Name" value={inv.name} />
            <DetRow label="School Code" value={inv.code || '—'} />
            <DetRow label="Address" value={inv.address || '—'} />
            <DetRow label="Contact" value={inv.phone || '—'} />
            <DetRow label="Email" value={inv.email || '—'} />
            <DetRow label="Requested On" value={fmtDate(inv.requestedAt)} />
            <DetRow label="Status" value={<span className="stg-badge-pending">Pending</span>} />
          </div>
        </div>
        <div className="stg-modal-foot">
          <button className="btn-secondary" onClick={onClose}><i className="fa-solid fa-xmark" /> Close</button>
          <button className="btn-danger" onClick={() => onConfirm('reject', inv.id)}><i className="fa-solid fa-ban" /> Reject</button>
          <button className="btn-primary" onClick={() => onConfirm('accept', inv.id)}><i className="fa-solid fa-check" /> Accept Invitation</button>
        </div>
      </div>
    </Overlay>
  )
}

function ConnModal({ s, onClose, onRemove }) {
  return (
    <Overlay onClose={onClose}>
      <div className="stg-modal">
        <div className="stg-modal-hdr">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="stg-modal-icon" style={{ background: 'linear-gradient(135deg,#15803d,#16a34a)' }}><i className="fa-solid fa-school" /></div>
            <div>
              <div className="stg-modal-title">Connected School Details</div>
              <div className="stg-modal-sub">{s.name}</div>
            </div>
          </div>
          <button className="stg-modal-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="stg-modal-body">
          <div className="stg-school-logo-row">
            <div className="stg-school-logo-ph"><i className="fa-solid fa-school" /></div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)' }}>{s.name}</div>
              <div style={{ fontSize: 12, color: 'var(--tm)', marginTop: 3 }}>{cityOf(s.address) || '—'}</div>
            </div>
          </div>
          <div className="stg-det-grid" style={{ marginTop: 14 }}>
            <DetRow label="School Code" value={s.code || '—'} />
            <DetRow label="Address" value={s.address || '—'} />
            <DetRow label="Contact" value={s.phone || '—'} />
            <DetRow label="Email" value={s.email || '—'} />
            <DetRow label="Connected Since" value={fmtDate(s.decidedAt || s.requestedAt)} />
            <DetRow label="ERP Status" value={<span className={s.networkPermission ? 'stg-badge-erp-on' : 'stg-badge-erp-off'}>{erpLabel(s)}</span>} />
          </div>
        </div>
        <div className="stg-modal-foot">
          <button className="btn-secondary" onClick={onClose}><i className="fa-solid fa-xmark" /> Close</button>
          <button className="btn-danger" onClick={() => onRemove(s.rowId ?? s.id)}><i className="fa-solid fa-link-slash" /> Remove from Network</button>
        </div>
      </div>
    </Overlay>
  )
}

function ConfirmModal({ cfg, onClose, onConfirm }) {
  return (
    <Overlay onClose={onClose}>
      <div className="stg-modal stg-modal-sm">
        <div className="stg-confirm-body">
          <div className="stg-confirm-icon" style={{ background: cfg.iconBg }}><i className={`fa-solid ${cfg.icon}`} /></div>
          <div className="stg-confirm-title">{cfg.title}</div>
          <div className="stg-confirm-sub">{cfg.sub}</div>
          <div className="stg-confirm-btns">
            <button className="btn-secondary" onClick={onClose}><i className="fa-solid fa-xmark" /> Cancel</button>
            <button className={cfg.btnClass} onClick={onConfirm}><i className={`fa-solid ${cfg.btnIcon}`} /> {cfg.btnLabel}</button>
          </div>
        </div>
      </div>
    </Overlay>
  )
}

function DetRow({ label, value }) {
  return (
    <div className="stg-det-row">
      <div className="stg-det-lbl">{label}</div>
      <div className="stg-det-val">{value}</div>
    </div>
  )
}
