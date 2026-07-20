import { useEffect, useMemo, useState } from 'react'
import TutorialButton from '../../components/TutorialButton'
import { createPortal } from 'react-dom'
import {
  loadAtt, saveAtt, getStaff, MONTHS, DAYS_FULL, DAYS_SHORT, STATUSES,
  todayISO, dowMon, fmtDate, fmtTime, monthDates, isoOf, dayType, recKey,
} from './data'
import { loadChainProfile, chainInitials } from '../../config/chainProfile'
import './Attendance.css'

const DAY_ICON = ['📅', '📆', '📅', '📆', '📅', '🏖️', '🏡']
const initialsOf = (name = '') => name.split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2)

export default function Attendance() {
  const [att, setAtt] = useState(null)
  const [tab, setTab] = useState('holidays')
  const [toast, setToast] = useState(null)
  const staff = useMemo(() => getStaff(), [])

  useEffect(() => { setAtt(loadAtt()) }, [])
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t) }, [toast])
  const fire = (text, type = 'success') => setToast({ text, type })
  const commit = (next) => { setAtt(next); saveAtt(next) }
  if (!att) return null

  return (
    <>
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}><i className="fa-solid fa-calendar-check" /></div>
          <div><div className="page-title">Attendance</div><div className="page-sub">Holiday setup &amp; staff attendance with printable reports.</div></div>
        </div>
        <TutorialButton />
      </div>

      <div className="att-tabs">
        {[['holidays', 'fa-umbrella-beach', 'Holidays Setup'], ['staff', 'fa-users', 'Staff Attendance'], ['reports', 'fa-chart-bar', 'Reports']].map(([k, ic, lbl]) => (
          <button key={k} className={`att-tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}><i className={`fa-solid ${ic}`} /> {lbl}</button>
        ))}
      </div>

      {tab === 'holidays' && <Holidays att={att} commit={commit} fire={fire} />}
      {tab === 'staff' && <StaffAttendance att={att} staff={staff} commit={commit} fire={fire} />}
      {tab === 'reports' && <Reports att={att} staff={staff} fire={fire} />}

      {toast && createPortal(
        <div className="ss-toast-wrap"><div className={`ss-toast ${toast.type}`}><i className={`fa-solid ${toast.type === 'success' ? 'fa-circle-check' : toast.type === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-info'}`} /> {toast.text}</div></div>,
        document.body,
      )}
    </>
  )
}

/* ════════ HOLIDAYS SETUP ════════ */
function Holidays({ att, commit, fire }) {
  const [holModal, setHolModal] = useState(null)
  const [del, setDel] = useState(null)

  const toggleDay = (i) => { const set = att.weeklyOff.includes(i) ? att.weeklyOff.filter((d) => d !== i) : [...att.weeklyOff, i]; commit({ ...att, weeklyOff: set }); fire('Weekly off days updated') }
  const saveHol = (data, id) => {
    if (id) commit({ ...att, holidays: att.holidays.map((h) => (h.id === id ? { ...h, ...data } : h)) })
    else { const nid = att.nextHolId; commit({ ...att, nextHolId: nid + 1, holidays: [...att.holidays, { id: nid, ...data }] }) }
    setHolModal(null); fire(id ? 'Holiday updated' : 'Holiday added')
  }
  const doDel = () => { commit({ ...att, holidays: att.holidays.filter((h) => h.id !== del.id) }); setDel(null); fire('Holiday deleted', 'info') }

  const byMonth = {}
  att.holidays.slice().sort((a, b) => (a.from < b.from ? -1 : 1)).forEach((h) => { const m = new Date(h.from).getMonth(); (byMonth[m] = byMonth[m] || []).push(h) })

  return (
    <>
      <div className="section-card">
        <div className="card-header"><div className="card-title"><i className="fa-solid fa-calendar-week" /> Weekly Off Days</div></div>
        <div style={{ padding: 18 }}>
          <div className="att-days-grid">
            {DAYS_FULL.map((d, i) => {
              const sel = att.weeklyOff.includes(i)
              return (
                <div key={d} className={`att-day-card${sel ? ' selected' : ''}`} onClick={() => toggleDay(i)}>
                  <div className="att-day-icon">{DAY_ICON[i]}</div>
                  <div className="att-day-name">{d}</div>
                  <div className="att-day-tag">{sel ? '● Off Day' : 'Working'}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="card-header">
          <div className="card-title"><i className="fa-solid fa-star" /> Special Holidays</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="att-pdf-btn" onClick={() => printHolidayReport(att, fire)}><i className="fa-solid fa-file-pdf" /> Yearly Report</button>
            <button className="btn-primary" onClick={() => setHolModal({ mode: 'add' })}><i className="fa-solid fa-plus" /> Add Holiday</button>
          </div>
        </div>
        <div style={{ padding: 18 }}>
          {att.holidays.length === 0 ? <div className="att-empty"><i className="fa-solid fa-star" /><div style={{ fontSize: 13, fontWeight: 700 }}>No holidays added</div></div>
            : Object.keys(byMonth).sort((a, b) => a - b).map((m) => (
              <div className="att-hol-month" key={m}>
                <div className="att-hol-month-title">{MONTHS[m]}</div>
                {byMonth[m].map((h) => (
                  <div className="att-hol-row" key={h.id}>
                    <div className="att-hol-info"><div className="att-hol-name">{h.title}</div>{h.desc && <div className="att-hol-desc">{h.desc}</div>}</div>
                    <span className="att-hol-date">{fmtDate(h.from)}{h.to !== h.from ? ` → ${fmtDate(h.to)}` : ''}</span>
                    <button className="btn-sm" style={{ height: 30 }} onClick={() => setHolModal({ mode: 'edit', hol: h })}><i className="fa-solid fa-pen" /></button>
                    <button className="btn-sm" style={{ height: 30, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={() => setDel(h)}><i className="fa-solid fa-trash-can" /></button>
                  </div>
                ))}
              </div>
            ))}
        </div>
      </div>

      {holModal && <HolidayModal modal={holModal} onClose={() => setHolModal(null)} onSave={saveHol} onToast={fire} />}
      {del && <ConfirmModal title="Delete Holiday?" body={`“${del.title}” will be removed.`} onClose={() => setDel(null)} onConfirm={doDel} />}
    </>
  )
}

function HolidayModal({ modal, onClose, onSave, onToast }) {
  const h = modal.hol
  const [v, setV] = useState({ title: h?.title || '', desc: h?.desc || '', from: h?.from || todayISO(), to: h?.to || todayISO() })
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }))
  const save = () => {
    if (!v.title.trim()) return onToast('Enter a holiday title', 'warn')
    if (v.to < v.from) return onToast('“To” date must be after “From” date', 'warn')
    onSave({ title: v.title.trim(), desc: v.desc.trim(), from: v.from, to: v.to }, h?.id)
  }
  return (
    <Shell title={h ? 'Edit Holiday' : 'Add Holiday'} icon="fa-star" onClose={onClose} maxWidth={480}
      foot={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save</button></>}>
      <div className="att-field" style={{ marginBottom: 12 }}><label>Holiday Title</label><input className="att-input" value={v.title} onChange={set('title')} placeholder="e.g. Eid ul Fitr" /></div>
      <div className="att-field" style={{ marginBottom: 12 }}><label>Description</label><input className="att-input" value={v.desc} onChange={set('desc')} placeholder="Short description" /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="att-field"><label>From</label><input className="att-input" type="date" value={v.from} onChange={set('from')} /></div>
        <div className="att-field"><label>To</label><input className="att-input" type="date" value={v.to} onChange={set('to')} /></div>
      </div>
    </Shell>
  )
}

/* ════════ STAFF ATTENDANCE ════════ */
function StaffAttendance({ att, staff, commit, fire }) {
  const now = new Date()
  const [year, setYear] = useState(2026)
  const [month, setMonth] = useState(4) // May
  const [selISO, setSelISO] = useState(() => { const t = todayISO(); return t.startsWith('2026-05') ? t : '2026-05-15' })
  const [draft, setDraft] = useState({})

  const dates = useMemo(() => monthDates(year, month), [year, month])
  useEffect(() => {
    const d = {}; staff.forEach((s) => { const r = att.records[recKey(s.empId, selISO)]; if (r) d[s.empId] = { ...r } })
    setDraft(d)
  }, [selISO, att.records, staff])

  const selDate = new Date(`${selISO}T00:00:00`)
  const selType = dayType(att, selDate)

  const setRow = (empId, k, val) => setDraft((s) => ({ ...s, [empId]: { ...(s[empId] || { status: 'present', inTime: '08:00', outTime: '14:30' }), [k]: val } }))
  const markAllPresent = () => { const d = {}; staff.forEach((s) => { d[s.empId] = { status: 'present', inTime: '08:00', outTime: '14:30' } }); setDraft(d) }
  const save = () => {
    const records = { ...att.records }
    staff.forEach((s) => { const r = draft[s.empId]; if (r && r.status) records[recKey(s.empId, selISO)] = { ...r, markedBy: 'Admin', markedTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) }; else delete records[recKey(s.empId, selISO)] })
    commit({ ...att, records }); fire(`Attendance saved for ${fmtDate(selISO)}`)
  }

  const startDow = dowMon(new Date(year, month, 1))
  const monthlyReport = () => printStaffMonthly(att, staff, year, month, fire)

  return (
    <>
      <div className="att-bar">
        <div className="att-field"><label>Month</label><select className="att-input" value={month} onChange={(e) => setMonth(Number(e.target.value))}>{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select></div>
        <div className="att-field"><label>Year</label><select className="att-input" value={year} onChange={(e) => setYear(Number(e.target.value))}>{[2025, 2026, 2027].map((y) => <option key={y}>{y}</option>)}</select></div>
        <button className="att-pdf-btn" style={{ marginLeft: 'auto' }} onClick={monthlyReport}><i className="fa-solid fa-file-pdf" /> Monthly Staff Report</button>
      </div>

      <div className="section-card">
        <div className="card-header"><div className="card-title"><i className="fa-solid fa-calendar-days" /> {MONTHS[month]} {year} — Staff Calendar</div><div className="card-sub" style={{ marginLeft: 'auto', fontSize: 12 }}>Tap a working day to mark attendance</div></div>
        <div style={{ padding: 18 }}>
          <div className="att-cal-legend">
            {[['#16A34A', 'Marked'], ['#DC2626', 'Pending'], ['#CBD5E1', 'Weekly Off'], ['#3B82F6', 'Holiday'], ['#7C3AED', 'Today']].map(([c, l]) => <div className="att-legend-item" key={l}><div className="att-legend-dot" style={{ background: c }} />{l}</div>)}
          </div>
          <div className="att-cal-grid">
            {DAYS_SHORT.map((d) => <div className="att-cal-dow" key={d}>{d}</div>)}
            {Array.from({ length: startDow }).map((_, i) => <div className="att-cal-cell empty" key={`e${i}`} />)}
            {dates.map((d) => {
              const iso = isoOf(d); const dt = dayType(att, d)
              const isToday = iso === todayISO()
              const marked = staff.some((s) => att.records[recKey(s.empId, iso)])
              const cls = dt.type === 'off' ? 'off' : dt.type === 'holiday' ? 'holiday' : marked ? 'marked' : 'pending'
              const dotColor = isToday ? '#7C3AED' : { off: '#CBD5E1', holiday: '#3B82F6', marked: '#16A34A', pending: '#DC2626' }[cls]
              return (
                <div key={iso} className={`att-cal-cell ${cls}${selISO === iso ? ' sel' : ''}${isToday ? ' today' : ''}`} onClick={() => dt.type === 'working' && setSelISO(iso)}>
                  <div className="att-cal-num">{d.getDate()}</div>
                  <div className="att-cal-day">{DAYS_SHORT[dowMon(d)]}</div>
                  {dt.type === 'holiday' ? <div className="att-cal-tag">{dt.label}</div> : <div className="att-cal-dot" style={{ background: dotColor }} />}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="card-header">
          <div><div className="card-title"><i className="fa-solid fa-id-badge" /> Staff Attendance — {fmtDate(selISO)}</div><div className="card-sub">{DAYS_FULL[dowMon(selDate)]} · {selType.label}</div></div>
          {selType.type === 'working' && <div style={{ display: 'flex', gap: 8 }}><button className="btn-secondary" onClick={markAllPresent}><i className="fa-solid fa-check-double" /> Mark All Present</button><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save</button></div>}
        </div>
        {selType.type !== 'working' ? (
          <div className="att-empty"><i className="fa-solid fa-umbrella-beach" /><div style={{ fontSize: 13, fontWeight: 700 }}>{selType.label}</div><div style={{ fontSize: 12, marginTop: 4 }}>No attendance is marked on a {selType.type === 'off' ? 'weekly off' : 'holiday'}.</div></div>
        ) : (
          <div className="tbl-wrap">
            <table className="att-table">
              <thead><tr><th>#</th><th>Staff Name</th><th>Designation</th><th>Department</th><th>Status</th><th>In Time</th><th>Out Time</th></tr></thead>
              <tbody>
                {staff.length === 0 ? <tr><td colSpan={7}><div className="att-empty"><i className="fa-solid fa-users" /><div style={{ fontSize: 13, fontWeight: 700 }}>No staff found</div><div style={{ fontSize: 12, marginTop: 4 }}>Add employees in the Human Resource module.</div></div></td></tr>
                  : staff.map((s, i) => {
                    const r = draft[s.empId] || {}
                    return (
                      <tr key={s.empId}>
                        <td style={{ color: 'var(--tm)', fontWeight: 700 }}>{i + 1}</td>
                        <td><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><div className="att-avatar">{initialsOf(s.name)}</div><div><div style={{ fontWeight: 700, color: 'var(--t1)' }}>{s.name}</div><div style={{ fontSize: 11, color: 'var(--tm)' }}>{s.empId}</div></div></div></td>
                        <td>{s.desig}</td>
                        <td>{s.dept}</td>
                        <td><select className="att-status-sel" value={r.status || ''} onChange={(e) => setRow(s.empId, 'status', e.target.value)}><option value="">— Unmarked</option>{STATUSES.map((st) => <option key={st.key} value={st.key}>{st.label}</option>)}</select></td>
                        <td><input className="att-time" type="time" value={r.inTime || ''} disabled={r.status !== 'present'} onChange={(e) => setRow(s.empId, 'inTime', e.target.value)} /></td>
                        <td><input className="att-time" type="time" value={r.outTime || ''} disabled={r.status !== 'present'} onChange={(e) => setRow(s.empId, 'outTime', e.target.value)} /></td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

/* ════════ REPORTS (staff only) ════════ */
const ATT_REPORTS = [
  { key: 'monthly', label: 'Monthly Staff Attendance', icon: 'fa-users', period: true },
  { key: 'individual', label: 'Individual Staff Report', icon: 'fa-user', period: true, staff: true },
  { key: 'holiday', label: 'Yearly Holiday Report', icon: 'fa-star', period: false },
  { key: 'weeklyoff', label: 'Working / Off Days Summary', icon: 'fa-calendar-week', period: false },
]

function Reports({ att, staff, fire }) {
  const [type, setType] = useState('monthly')
  const [ctrl, setCtrl] = useState({ month: 4, year: 2026, staffId: staff[0]?.empId || '' })
  const meta = ATT_REPORTS.find((r) => r.key === type)
  const report = useMemo(() => buildAttReport(att, staff, type, ctrl), [att, staff, type, ctrl])

  return (
    <>
      <div className="att-rep-types">
        {ATT_REPORTS.map((r) => <button key={r.key} className={`att-rep-type${type === r.key ? ' active' : ''}`} onClick={() => setType(r.key)}><i className={`fa-solid ${r.icon}`} /> {r.label}</button>)}
      </div>
      <div className="att-bar">
        {meta.period && <>
          <div className="att-field"><label>Month</label><select className="att-input" value={ctrl.month} onChange={(e) => setCtrl((s) => ({ ...s, month: Number(e.target.value) }))}>{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select></div>
          <div className="att-field"><label>Year</label><select className="att-input" value={ctrl.year} onChange={(e) => setCtrl((s) => ({ ...s, year: Number(e.target.value) }))}>{[2025, 2026, 2027].map((y) => <option key={y}>{y}</option>)}</select></div>
        </>}
        {meta.staff && <div className="att-field"><label>Staff Member</label><select className="att-input" value={ctrl.staffId} onChange={(e) => setCtrl((s) => ({ ...s, staffId: e.target.value }))}>{staff.map((s) => <option key={s.empId} value={s.empId}>{s.name}</option>)}</select></div>}
        <button className="att-pdf-btn" onClick={() => printAttReport(report, fire)}><i className="fa-solid fa-file-pdf" /> Download A4 Report</button>
      </div>

      {report.kpis?.length > 0 && <div className="att-kpis">{report.kpis.map((k, i) => <div key={i} className={`att-kpi ${k.cls || ''}`}><div className="att-kpi-top"><i className={`fa-solid ${k.icon || 'fa-circle'}`} /> {k.label}</div><div className="att-kpi-val" style={{ fontSize: 17 }}>{k.value}</div></div>)}</div>}

      <div className="section-card">
        <div className="card-header"><div><div className="card-title"><i className={`fa-solid ${meta.icon}`} /> {report.title}</div>{report.period && <div className="card-sub">{report.period}</div>}</div></div>
        <div style={{ padding: '4px 16px 16px' }}>
          {report.sections.every((s) => s.rows.length === 0) ? <div className="att-empty"><i className="fa-solid fa-chart-bar" /><div style={{ fontSize: 13, fontWeight: 700 }}>No data for this report</div></div>
            : report.sections.map((sec, si) => (
              <div key={si}>
                {sec.title && <div className="att-sect-title">{sec.title}</div>}
                <div className="tbl-wrap" style={{ marginBottom: 6 }}>
                  <table className="att-table">
                    <thead><tr>{sec.columns.map((c, i) => <th key={i} className={c.a === 'r' ? 'r' : c.a === 'c' ? 'c' : ''}>{c.label}</th>)}</tr></thead>
                    <tbody>{sec.rows.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci} className={sec.columns[ci].a === 'r' ? 'r' : sec.columns[ci].a === 'c' ? 'c' : ''}>{cell}</td>)}</tr>)}</tbody>
                    {sec.totals && sec.rows.length > 0 && <tfoot><tr>{sec.totals.map((cell, i) => <td key={i} className={sec.columns[i].a === 'r' ? 'r' : sec.columns[i].a === 'c' ? 'c' : ''}>{cell}</td>)}</tr></tfoot>}
                  </table>
                </div>
              </div>
            ))}
        </div>
      </div>
    </>
  )
}

function workingDays(att, year, month0) { return monthDates(year, month0).filter((d) => dayType(att, d).type === 'working') }

function staffMonthStats(att, empId, year, month0) {
  const wd = workingDays(att, year, month0); let p = 0; let a = 0; let l = 0
  wd.forEach((d) => { const r = att.records[recKey(empId, isoOf(d))]; if (r?.status === 'present') p += 1; else if (r?.status === 'absent') a += 1; else if (r?.status === 'leave') l += 1 })
  return { working: wd.length, present: p, absent: a, leave: l, unmarked: wd.length - p - a - l, pct: wd.length ? Math.round((p / wd.length) * 100) : 0 }
}

function buildAttReport(att, staff, type, ctrl) {
  const C = (label, a) => ({ label, a: a || 'l' })
  if (type === 'monthly') {
    let tP = 0; let tA = 0; let tL = 0
    const rows = staff.map((s, i) => { const st = staffMonthStats(att, s.empId, ctrl.year, ctrl.month); tP += st.present; tA += st.absent; tL += st.leave; return [i + 1, s.name, s.desig, st.working, st.present, st.absent, st.leave, st.unmarked, `${st.pct}%`] })
    const wd = workingDays(att, ctrl.year, ctrl.month).length
    return {
      title: 'Monthly Staff Attendance Report', period: `${MONTHS[ctrl.month]} ${ctrl.year}`,
      filters: [['Period', `${MONTHS[ctrl.month]} ${ctrl.year}`], ['Working Days', String(wd)], ['Staff', String(staff.length)]],
      kpis: [{ label: 'Working Days', value: wd, icon: 'fa-calendar-day', cls: 'info' }, { label: 'Total Present', value: tP, icon: 'fa-user-check', cls: 'green' }, { label: 'Absent', value: tA, icon: 'fa-user-xmark', cls: 'red' }, { label: 'On Leave', value: tL, icon: 'fa-plane-departure', cls: 'amber' }],
      sections: [{ columns: [C('#', 'c'), C('Staff'), C('Designation'), C('Working', 'c'), C('Present', 'c'), C('Absent', 'c'), C('Leave', 'c'), C('Unmarked', 'c'), C('%', 'c')], rows, totals: ['', 'TOTAL', '', String(wd), String(tP), String(tA), String(tL), '', ''] }],
    }
  }
  if (type === 'individual') {
    const s = staff.find((x) => x.empId === ctrl.staffId) || staff[0]
    if (!s) return { title: 'Individual Staff Report', period: '', filters: [], kpis: [], sections: [{ columns: [C('Info')], rows: [], totals: null }] }
    const dates = monthDates(ctrl.year, ctrl.month)
    const rows = dates.map((d) => { const iso = isoOf(d); const dt = dayType(att, d); const r = att.records[recKey(s.empId, iso)]; const status = dt.type === 'off' ? 'Weekly Off' : dt.type === 'holiday' ? dt.label : (r ? (STATUSES.find((x) => x.key === r.status)?.label || '—') : 'Unmarked'); return [d.getDate(), DAYS_FULL[dowMon(d)], status, r?.inTime ? fmtTime(r.inTime) : '—', r?.outTime ? fmtTime(r.outTime) : '—'] })
    const st = staffMonthStats(att, s.empId, ctrl.year, ctrl.month)
    return {
      title: 'Individual Staff Attendance', period: `${s.name} · ${MONTHS[ctrl.month]} ${ctrl.year}`,
      filters: [['Staff', s.name], ['ID', s.empId], ['Designation', s.desig], ['Department', s.dept]],
      kpis: [{ label: 'Present', value: st.present, icon: 'fa-user-check', cls: 'green' }, { label: 'Absent', value: st.absent, icon: 'fa-user-xmark', cls: 'red' }, { label: 'Leave', value: st.leave, icon: 'fa-plane-departure', cls: 'amber' }, { label: 'Attendance %', value: `${st.pct}%`, icon: 'fa-percent', cls: 'info' }],
      sections: [{ columns: [C('Date', 'c'), C('Day'), C('Status'), C('In', 'c'), C('Out', 'c')], rows, totals: null }],
    }
  }
  if (type === 'holiday') {
    const rows = att.holidays.slice().sort((a, b) => (a.from < b.from ? -1 : 1)).map((h, i) => { const days = Math.round((new Date(h.to) - new Date(h.from)) / 86400000) + 1; return [i + 1, h.title, h.desc || '—', fmtDate(h.from), fmtDate(h.to), days] })
    return {
      title: 'Yearly Holiday Report', period: 'All special holidays',
      filters: [['Holidays', String(att.holidays.length)], ['Weekly Off', att.weeklyOff.map((i) => DAYS_FULL[i]).join(', ') || 'None']],
      kpis: [{ label: 'Holidays', value: att.holidays.length, icon: 'fa-star', cls: 'info' }, { label: 'Off Days', value: att.weeklyOff.length, icon: 'fa-calendar-week', cls: 'amber' }],
      sections: [{ columns: [C('#', 'c'), C('Holiday'), C('Description'), C('From'), C('To'), C('Days', 'c')], rows, totals: null }],
    }
  }
  // weeklyoff summary
  const rows = MONTHS.map((m, mi) => { const dates = monthDates(ctrl.year, mi); const off = dates.filter((d) => att.weeklyOff.includes(dowMon(d))).length; const hol = dates.filter((d) => dayType(att, d).type === 'holiday').length; const work = dates.length - off - hol; return [m, dates.length, off, hol, work] })
  return {
    title: 'Working / Off Days Summary', period: String(ctrl.year || 2026),
    filters: [['Year', String(ctrl.year || 2026)], ['Weekly Off', att.weeklyOff.map((i) => DAYS_FULL[i]).join(', ') || 'None']],
    kpis: [], sections: [{ columns: [C('Month'), C('Total Days', 'c'), C('Weekly Off', 'c'), C('Holidays', 'c'), C('Working Days', 'c')], rows, totals: null }],
  }
}

/* helper printers reuse the generic A4 printer */
function printHolidayReport(att, fire) { printAttReport(buildAttReport(att, [], 'holiday', {}), fire) }
function printStaffMonthly(att, staff, year, month, fire) { printAttReport(buildAttReport(att, staff, 'monthly', { year, month }), fire) }

/* ════════ A4 BRANDED PRINT (head-office header + footer on each page) ════════ */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
function printAttReport(report, onToast) {
  const chain = loadChainProfile()
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) + ' · ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const logo = chain.logo ? `<img class="rep-logo-img" src="${chain.logo}" alt="">` : `<div class="rep-logo">${esc(chainInitials(chain.chainName))}</div>`
  const filters = (report.filters || []).map(([l, v]) => `<span><b>${esc(l)}:</b> ${esc(v)}</span>`).join('')
  const sectionsHtml = report.sections.map((sec) => {
    const thead = sec.columns.map((c) => `<th class="${c.a === 'r' ? 'r' : c.a === 'c' ? 'c' : ''}">${esc(c.label)}</th>`).join('')
    const tbody = sec.rows.length ? sec.rows.map((row) => `<tr>${row.map((cell, i) => `<td class="${sec.columns[i].a === 'r' ? 'r' : sec.columns[i].a === 'c' ? 'c' : ''}">${esc(cell)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${sec.columns.length}" style="text-align:center;color:#999;padding:14px">No records.</td></tr>`
    const tfoot = sec.totals && sec.rows.length ? `<tfoot><tr class="rep-tot">${sec.totals.map((cell, i) => `<td class="${sec.columns[i].a === 'r' ? 'r' : sec.columns[i].a === 'c' ? 'c' : ''}">${esc(cell)}</td>`).join('')}</tr></tfoot>` : ''
    return `${sec.title ? `<div class="rep-secttl">${esc(sec.title)}</div>` : ''}<table class="data"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody>${tfoot}</table>`
  }).join('')
  const header = `<div class="rep-head">${logo}<div class="rep-head-txt"><div class="rep-name">${esc(chain.chainName)}</div><div class="rep-org-line">${esc(chain.address || '')}</div><div class="rep-org-line">${esc(chain.contact || '')}${chain.email ? ' · ' + esc(chain.email) : ''}</div></div><div class="rep-meta"><div class="rep-title">${esc(report.title)}</div><div class="rep-period">${esc(report.period || '')}</div></div></div>${filters ? `<div class="rep-filters">${filters}</div>` : ''}`
  const footer = `<div class="rep-foot"><span>${esc(chain.chainName)}${chain.contact ? ' · ' + esc(chain.contact) : ''}</span><span>Computer-generated report · ${esc(report.title)} · ${esc(dateStr)}</span></div>`
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(chain.chainName)} — ${esc(report.title)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}html,body{background:#e9eef6}body{font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#111;font-size:10.5px;line-height:1.4}
.a4{width:210mm;min-height:297mm;margin:14px auto;background:#fff;padding:13mm;box-shadow:0 6px 28px rgba(15,23,42,.18)}
.wrap{width:100%;border-collapse:collapse}.wrap > thead{display:table-header-group}.wrap > tfoot{display:table-footer-group}
.rep-head{display:flex;align-items:flex-start;gap:13px;border-bottom:2.5px solid #1E3A8A;padding-bottom:10px;margin-bottom:10px}
.rep-logo{width:48px;height:48px;border:2px solid #1E3A8A;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;color:#1E3A8A;font-size:15px;flex-shrink:0}
.rep-logo-img{width:48px;height:48px;border-radius:12px;object-fit:cover;flex-shrink:0;border:1px solid #e2e8f0}
.rep-head-txt{flex:1}.rep-name{font-size:18px;font-weight:800;color:#1E3A8A;line-height:1.1}.rep-org-line{font-size:10.5px;color:#555;margin-top:2px}
.rep-meta{text-align:right}.rep-title{font-size:13px;font-weight:800;color:#1E3A8A}.rep-period{font-size:11px;color:#555;margin-top:2px}
.rep-filters{display:flex;flex-wrap:wrap;gap:5px 20px;font-size:10.5px;color:#333;margin-bottom:12px;background:#F1F5FB;padding:9px 13px;border-radius:6px}
.rep-secttl{font-size:12px;font-weight:800;color:#1E3A8A;margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid #cdd7ea}
.data{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:4px}
.data th{background:#1E3A8A;color:#fff;padding:6px 8px;text-align:left;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px}
.data th.r,.data td.r{text-align:right}.data th.c,.data td.c{text-align:center}
.data td{padding:5px 8px;border-bottom:1px solid #e5e9f2;vertical-align:top}.data tbody tr:nth-child(even) td{background:#f8fafc}
.data .rep-tot td{background:#EAF0FA;font-weight:800;border-top:2px solid #1E3A8A}
.rep-foot{display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-top:14px;font-size:9px;color:#888;border-top:1px solid #e5e9f2;padding-top:8px}
@media print{html,body{background:#fff}.a4{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}@page{size:A4 portrait;margin:13mm}}</style></head>
<body><div class="a4"><table class="wrap"><thead><tr><td>${header}</td></tr></thead><tfoot><tr><td>${footer}</td></tr></tfoot><tbody><tr><td>${sectionsHtml}</td></tr></tbody></table></div>
<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},300);};<\/script></body></html>`
  const w = window.open('', '_blank')
  if (!w) { onToast?.('Allow pop-ups to download / print the report', 'warn'); return }
  w.document.open(); w.document.write(html); w.document.close()
}

/* ════════ shared shells ════════ */
function Shell({ title, icon, maxWidth, foot, children, onClose }) {
  return createPortal(
    <div className="pay-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pay-modal" style={{ maxWidth: maxWidth || 540 }}>
        <div className="pay-modal-hdr">
          <div className="pay-modal-av"><i className={`fa-solid ${icon}`} /></div>
          <div><div className="pay-modal-title">{title}</div></div>
          <button className="pay-modal-x" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="pay-modal-body">{children}</div>
        <div className="pay-modal-foot">{foot}</div>
      </div>
    </div>,
    document.body,
  )
}
function ConfirmModal({ title, body, onClose, onConfirm }) {
  return createPortal(
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-body" style={{ textAlign: 'center', padding: '40px 30px' }}>
          <div className="confirm-icon" style={{ background: 'rgba(220,38,38,.1)', border: '2px solid rgba(220,38,38,.25)', color: '#DC2626' }}><i className="fa-solid fa-trash-can" /></div>
          <div className="confirm-title">{title}</div>
          <div className="confirm-sub">{body}</div>
          <div className="confirm-btns">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-danger" onClick={onConfirm}><i className="fa-solid fa-trash-can" /> Delete</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
