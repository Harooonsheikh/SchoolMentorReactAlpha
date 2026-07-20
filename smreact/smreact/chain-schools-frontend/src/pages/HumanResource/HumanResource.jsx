import { Fragment, useEffect, useMemo, useState } from 'react'
import TutorialButton from '../../components/TutorialButton'
import { createPortal } from 'react-dom'
import {
  loadHr, saveHr, MONTHS, EMP_TYPES, PAY_METHODS,
  rs, num, fmtDate, fullName, initials, deptName, desigName,
  allowances, deductions, gross, netPay,
  empLoans, loanRemaining, loanTotalReturned, activeLoanCount, monthlyLoanDeduct, payKey,
} from './data'
import { loadChainProfile, chainInitials } from '../../config/chainProfile'
import './HumanResource.css'

export default function HumanResource() {
  const [hr, setHr] = useState(null)
  const [tab, setTab] = useState('basics')
  const [toast, setToast] = useState(null)

  useEffect(() => { setHr(loadHr()) }, [])
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t) }, [toast])
  const fire = (text, type = 'success') => setToast({ text, type })
  const commit = (next) => { setHr(next); saveHr(next) }
  if (!hr) return null

  return (
    <>
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}><i className="fa-solid fa-users-gear" /></div>
          <div><div className="page-title">Human Resource</div><div className="page-sub">Manage departments, designations, employees and payroll.</div></div>
        </div>
        <TutorialButton />
      </div>

      <div className="hr-tabs">
        {[['basics', 'fa-building', 'HR Basics'], ['employees', 'fa-user-tie', 'Employee Management'], ['payroll', 'fa-coins', 'Payroll'], ['reports', 'fa-chart-line', 'Reports']].map(([k, ic, lbl]) => (
          <button key={k} className={`hr-tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}><i className={`fa-solid ${ic}`} /> {lbl}</button>
        ))}
      </div>

      {tab === 'basics' && <Basics hr={hr} commit={commit} fire={fire} />}
      {tab === 'employees' && <Employees hr={hr} commit={commit} fire={fire} />}
      {tab === 'payroll' && <Payroll hr={hr} commit={commit} fire={fire} />}
      {tab === 'reports' && <Reports hr={hr} fire={fire} />}

      {toast && createPortal(
        <div className="ss-toast-wrap"><div className={`ss-toast ${toast.type}`}><i className={`fa-solid ${toast.type === 'success' ? 'fa-circle-check' : toast.type === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-info'}`} /> {toast.text}</div></div>,
        document.body,
      )}
    </>
  )
}

/* ════════ HR BASICS ════════ */
function Basics({ hr, commit, fire }) {
  const [open, setOpen] = useState({})
  const [deptModal, setDeptModal] = useState(null)
  const [desigModal, setDesigModal] = useState(null)
  const [del, setDel] = useState(null)

  const saveDept = (data, id) => {
    if (id) commit({ ...hr, depts: hr.depts.map((d) => (d.id === id ? { ...d, ...data } : d)) })
    else { const nid = hr.nextDeptId + 1; commit({ ...hr, nextDeptId: nid, depts: [...hr.depts, { id: nid, ...data }] }) }
    setDeptModal(null); fire(id ? 'Department updated' : 'Department added')
  }
  const saveDesig = (data, id) => {
    if (id) commit({ ...hr, desigs: hr.desigs.map((d) => (d.id === id ? { ...d, ...data } : d)) })
    else { const nid = hr.nextDesigId + 1; commit({ ...hr, nextDesigId: nid, desigs: [...hr.desigs, { id: nid, ...data }] }) }
    setDesigModal(null); fire(id ? 'Designation updated' : 'Designation added')
  }
  const doDel = () => {
    if (del.kind === 'dept') commit({ ...hr, depts: hr.depts.filter((d) => d.id !== del.id), desigs: hr.desigs.filter((d) => d.dId !== del.id) })
    else commit({ ...hr, desigs: hr.desigs.filter((d) => d.id !== del.id) })
    setDel(null); fire('Deleted', 'info')
  }

  return (
    <>
      <div className="hr-bar">
        <div style={{ flex: 1, fontSize: 14, fontWeight: 800, color: 'var(--t1)', alignSelf: 'center' }}><i className="fa-solid fa-building" style={{ color: 'var(--brand)', marginRight: 7 }} /> Departments &amp; Designations</div>
        <button className="btn-primary" onClick={() => setDeptModal({ mode: 'add' })}><i className="fa-solid fa-plus" /> Add Department</button>
      </div>
      {hr.depts.map((d) => {
        const ds = hr.desigs.filter((x) => x.dId === d.id)
        return (
          <div className="hr-dept-card" key={d.id}>
            <div className="hr-dept-head" onClick={() => setOpen((o) => ({ ...o, [d.id]: !o[d.id] }))}>
              <div className="hr-dept-ic"><i className="fa-solid fa-building" /></div>
              <div style={{ flex: 1 }}><div className="hr-dept-name">{d.name}</div><div className="hr-dept-sub">{d.desc}</div></div>
              <span className="badge b-blue">{ds.length} designation{ds.length !== 1 ? 's' : ''}</span>
              <button className="btn-sm" style={{ height: 30 }} onClick={(e) => { e.stopPropagation(); setDeptModal({ mode: 'edit', dept: d }) }}><i className="fa-solid fa-pen" /></button>
              <button className="btn-sm" style={{ height: 30, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={(e) => { e.stopPropagation(); setDel({ kind: 'dept', id: d.id, name: d.name }) }}><i className="fa-solid fa-trash-can" /></button>
              <i className={`fa-solid fa-chevron-${open[d.id] ? 'up' : 'down'}`} style={{ color: 'var(--tm)' }} />
            </div>
            {open[d.id] && (
              <div className="hr-dept-body">
                {ds.map((x) => (
                  <div className="hr-desig-row" key={x.id}>
                    <div style={{ flex: 1 }}><div style={{ fontWeight: 700, color: 'var(--t1)', fontSize: 13 }}>{x.name}</div><div style={{ fontSize: 11, color: 'var(--tm)' }}>{x.qual} · {x.desc}</div></div>
                    <button className="btn-sm" style={{ height: 28 }} onClick={() => setDesigModal({ mode: 'edit', desig: x })}><i className="fa-solid fa-pen" /></button>
                    <button className="btn-sm" style={{ height: 28, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={() => setDel({ kind: 'desig', id: x.id, name: x.name })}><i className="fa-solid fa-trash-can" /></button>
                  </div>
                ))}
                <button className="btn-primary" style={{ marginTop: 4 }} onClick={() => setDesigModal({ mode: 'add', dId: d.id })}><i className="fa-solid fa-plus" /> Add Designation</button>
              </div>
            )}
          </div>
        )
      })}
      {deptModal && <DeptModal modal={deptModal} onClose={() => setDeptModal(null)} onSave={saveDept} onToast={fire} />}
      {desigModal && <DesigModal modal={desigModal} depts={hr.depts} onClose={() => setDesigModal(null)} onSave={saveDesig} onToast={fire} />}
      {del && <ConfirmModal title={`Delete ${del.kind === 'dept' ? 'Department' : 'Designation'}?`} body={`“${del.name}” will be removed${del.kind === 'dept' ? ' along with its designations' : ''}.`} onClose={() => setDel(null)} onConfirm={doDel} />}
    </>
  )
}

function DeptModal({ modal, onClose, onSave, onToast }) {
  const d = modal.dept
  const [name, setName] = useState(d?.name || ''); const [desc, setDesc] = useState(d?.desc || '')
  const save = () => { if (!name.trim()) return onToast('Enter a department name', 'warn'); onSave({ name: name.trim(), desc: desc.trim() }, d?.id) }
  return (
    <Shell title={d ? 'Edit Department' : 'Add Department'} icon="fa-building" onClose={onClose} maxWidth={440}
      foot={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save</button></>}>
      <div className="hr-field" style={{ marginBottom: 12 }}><label>Department Name</label><input className="hr-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Administration" /></div>
      <div className="hr-field"><label>Description</label><input className="hr-input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description" /></div>
    </Shell>
  )
}
function DesigModal({ modal, depts, onClose, onSave, onToast }) {
  const x = modal.desig
  const [v, setV] = useState({ dId: x?.dId || modal.dId || depts[0]?.id, name: x?.name || '', qual: x?.qual || '', desc: x?.desc || '' })
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: k === 'dId' ? Number(e.target.value) : e.target.value }))
  const save = () => { if (!v.name.trim()) return onToast('Enter a designation name', 'warn'); onSave({ dId: Number(v.dId), name: v.name.trim(), qual: v.qual.trim(), desc: v.desc.trim() }, x?.id) }
  return (
    <Shell title={x ? 'Edit Designation' : 'Add Designation'} icon="fa-user-tag" onClose={onClose} maxWidth={460}
      foot={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save</button></>}>
      <div className="hr-field" style={{ marginBottom: 12 }}><label>Department</label><select className="hr-input" value={v.dId} onChange={set('dId')}>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
      <div className="hr-grid2">
        <div className="hr-field"><label>Designation Name</label><input className="hr-input" value={v.name} onChange={set('name')} placeholder="e.g. Teacher" /></div>
        <div className="hr-field"><label>Qualification</label><input className="hr-input" value={v.qual} onChange={set('qual')} placeholder="e.g. BEd" /></div>
      </div>
      <div className="hr-field" style={{ marginTop: 12 }}><label>Description</label><input className="hr-input" value={v.desc} onChange={set('desc')} placeholder="Short description" /></div>
    </Shell>
  )
}

/* ════════ EMPLOYEE MANAGEMENT ════════ */
function Employees({ hr, commit, fire }) {
  const [seg, setSeg] = useState('active')
  const [search, setSearch] = useState('')
  const [fd, setFd] = useState(''); const [fdes, setFdes] = useState('')
  const [empModal, setEmpModal] = useState(null)
  const [del, setDel] = useState(null)

  const active = hr.emps.filter((e) => e.status === 'Active')
  const inactive = hr.emps.filter((e) => e.status !== 'Active')
  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (seg === 'active' ? active : inactive).filter((e) => (!fd || e.dId === Number(fd)) && (!fdes || e.desId === Number(fdes))
      && (!q || `${fullName(e)}${e.eid}${e.cnic}${e.phone}${deptName(hr, e.dId)}${desigName(hr, e.desId)}`.toLowerCase().includes(q)))
  }, [hr, seg, search, fd, fdes])

  const saveEmp = (data, id) => {
    if (id) commit({ ...hr, emps: hr.emps.map((e) => (e.id === id ? { ...e, ...data } : e)) })
    else { const nid = hr.nextEmpId + 1; commit({ ...hr, nextEmpId: nid, emps: [...hr.emps, { id: nid, eid: `EMP-${String(nid).padStart(3, '0')}`, status: 'Active', ...data }] }) }
    setEmpModal(null); fire(id ? 'Employee updated' : 'Employee added')
  }
  const toggleStatus = (e) => { const status = e.status === 'Active' ? 'Inactive' : 'Active'; commit({ ...hr, emps: hr.emps.map((x) => (x.id === e.id ? { ...x, status } : x)) }); fire(status === 'Active' ? 'Employee reactivated' : 'Employee marked inactive', 'info') }
  const doDel = () => { commit({ ...hr, emps: hr.emps.filter((e) => e.id !== del.id) }); setDel(null); fire('Employee deleted', 'info') }

  return (
    <>
      <div className="hr-seg">
        <button className={`hr-seg-btn${seg === 'active' ? ' active' : ''}`} onClick={() => setSeg('active')}><i className="fa-solid fa-user-check" /> Active <span className="hr-seg-count">{active.length}</span></button>
        <button className={`hr-seg-btn${seg === 'inactive' ? ' active' : ''}`} onClick={() => setSeg('inactive')}><i className="fa-solid fa-user-slash" /> Inactive <span className="hr-seg-count">{inactive.length}</span></button>
      </div>

      <div className="hr-bar">
        <div className="hr-field" style={{ flex: 1, minWidth: 220 }}><label>Search</label><div className="search-box"><i className="fa-solid fa-magnifying-glass" /><input className="search-input" placeholder="Search name, ID, CNIC, phone, dept or designation" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
        <div className="hr-field"><label>Department</label><select className="hr-input" value={fd} onChange={(e) => { setFd(e.target.value); setFdes('') }}><option value="">All Departments</option>{hr.depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div className="hr-field"><label>Designation</label><select className="hr-input" value={fdes} onChange={(e) => setFdes(e.target.value)}><option value="">All Designations</option>{hr.desigs.filter((x) => !fd || x.dId === Number(fd)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
        <button className="btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setEmpModal({ mode: 'add' })}><i className="fa-solid fa-user-plus" /> Add Employee</button>
      </div>

      <div className="section-card">
        <div className="tbl-wrap">
          <table className="hr-table">
            <thead><tr><th>#</th><th>Name / ID</th><th>Department</th><th>Designation</th><th>Contact</th><th className="r">Net Salary</th><th>Status</th><th className="c">Actions</th></tr></thead>
            <tbody>
              {list.length === 0 ? <tr><td colSpan={8}><div className="hr-empty"><i className="fa-solid fa-user-tie" /><div style={{ fontSize: 13, fontWeight: 700 }}>No employees found</div></div></td></tr>
                : list.map((e, i) => (
                  <tr key={e.id}>
                    <td style={{ color: 'var(--tm)', fontWeight: 700 }}>{i + 1}</td>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><div className="hr-avatar">{initials(e)}</div><div><div style={{ fontWeight: 700, color: 'var(--t1)' }}>{fullName(e)}</div><div style={{ fontSize: 11, color: 'var(--tm)' }}>{e.eid}</div></div></div></td>
                    <td>{deptName(hr, e.dId)}</td>
                    <td>{desigName(hr, e.desId)}</td>
                    <td>{e.phone || '—'}</td>
                    <td className="r" style={{ fontWeight: 800 }}>{rs(netPay(e))}</td>
                    <td><span className={`badge ${e.status === 'Active' ? 'b-green' : 'b-gray'}`}>{e.status}</span></td>
                    <td className="c">
                      <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
                        <button className="btn-sm" style={{ height: 28 }} title="Salary slip" onClick={() => printSalarySlip(e, hr, fire)}><i className="fa-solid fa-file-invoice-dollar" /></button>
                        <button className="btn-sm" style={{ height: 28 }} title="Edit" onClick={() => setEmpModal({ mode: 'edit', emp: e })}><i className="fa-solid fa-pen" /></button>
                        <button className="btn-sm" style={{ height: 28, color: e.status === 'Active' ? 'var(--warn)' : 'var(--success)', borderColor: e.status === 'Active' ? 'var(--warn)' : 'var(--success)' }} title={e.status === 'Active' ? 'Mark inactive' : 'Reactivate'} onClick={() => toggleStatus(e)}><i className={`fa-solid ${e.status === 'Active' ? 'fa-user-slash' : 'fa-user-check'}`} /></button>
                        <button className="btn-sm" style={{ height: 28, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} title="Delete" onClick={() => setDel(e)}><i className="fa-solid fa-trash-can" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {empModal && <EmployeeModal modal={empModal} hr={hr} onClose={() => setEmpModal(null)} onSave={saveEmp} onToast={fire} />}
      {del && <ConfirmModal title="Delete Employee?" body={`“${fullName(del)}” and their records will be permanently deleted.`} onClose={() => setDel(null)} onConfirm={doDel} />}
    </>
  )
}

const EMP_TABS = [['personal', 'Personal'], ['official', 'Official'], ['salary', 'Salary'], ['leave', 'Leave']]
function EmployeeModal({ modal, hr, onClose, onSave, onToast }) {
  const e = modal.emp
  const [mt, setMt] = useState('personal')
  const [v, setV] = useState(() => ({
    firstName: e?.firstName || '', lastName: e?.lastName || '', fn: e?.fn || '', cnic: e?.cnic || '', dob: e?.dob || '', gender: e?.gender || 'Male', marital: e?.marital || 'Single', phone: e?.phone || '', email: e?.email || '', address: e?.address || '', blood: e?.blood || '', emergency: e?.emergency || '',
    dId: e?.dId || hr.depts[0]?.id, desId: e?.desId || hr.desigs[0]?.id, join: e?.join || '', type: e?.type || 'Permanent', manager: e?.manager || '', qual: e?.qual || '', exp: e?.exp || '', shift: e?.shift || '', city: e?.city || '', role: e?.role || '',
    basicSalary: e?.basicSalary ?? '', payMethod: e?.payMethod || 'Bank Transfer', bankName: e?.bankName || '', bankAcc: e?.bankAcc || '',
    salaryHeads: e?.salaryHeads ? JSON.parse(JSON.stringify(e.salaryHeads)) : [{ name: 'House Allowance', type: 'allow', amount: 0 }],
    leaves: e?.leaves ? { ...e.leaves } : { annual: 20, casual: 8, sick: 6, balance: 18, policy: 'Standard', absentDed: 150, unpaidDed: 1200 },
    financial: e?.financial ? { ...e.financial } : { salaryAdvance: 0, loanBalance: 0, securityDeposit: 0, clearanceStatus: 'pending' },
  }))
  const set = (k) => (ev) => setV((s) => ({ ...s, [k]: ev.target.value }))
  const setLeave = (k) => (ev) => setV((s) => ({ ...s, leaves: { ...s.leaves, [k]: ev.target.value } }))
  const setHead = (i, k, val) => setV((s) => ({ ...s, salaryHeads: s.salaryHeads.map((h, j) => (j === i ? { ...h, [k]: val } : h)) }))
  const addHead = () => setV((s) => ({ ...s, salaryHeads: [...s.salaryHeads, { name: '', type: 'allow', amount: 0 }] }))
  const rmHead = (i) => setV((s) => ({ ...s, salaryHeads: s.salaryHeads.filter((_, j) => j !== i) }))

  const desigOpts = hr.desigs.filter((x) => x.dId === Number(v.dId))
  const previewEmp = { basicSalary: Number(v.basicSalary) || 0, salaryHeads: v.salaryHeads.map((h) => ({ ...h, amount: Number(h.amount) || 0 })) }

  const save = () => {
    if (!v.firstName.trim()) return onToast('Enter the employee first name', 'warn')
    if (!desigOpts.find((x) => x.id === Number(v.desId)) && desigOpts[0]) v.desId = desigOpts[0].id
    onSave({ ...v, firstName: v.firstName.trim(), lastName: v.lastName.trim(), dId: Number(v.dId), desId: Number(v.desId), basicSalary: Number(v.basicSalary) || 0, salaryHeads: v.salaryHeads.filter((h) => h.name.trim()).map((h) => ({ name: h.name.trim(), type: h.type, amount: Number(h.amount) || 0 })) }, e?.id)
  }

  return (
    <Shell title={e ? 'Edit Employee' : 'Add Employee'} sub={e ? `${fullName(e)} · ${e.eid}` : 'New staff member'} icon="fa-user-tie" onClose={onClose} maxWidth={620}
      foot={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save Employee</button></>}>
      <div className="hr-modal-tabs">{EMP_TABS.map(([k, lbl]) => <button key={k} className={`hr-modal-tab${mt === k ? ' active' : ''}`} onClick={() => setMt(k)}>{lbl}</button>)}</div>

      {mt === 'personal' && (
        <div className="hr-grid2">
          <div className="hr-field"><label>First Name *</label><input className="hr-input" value={v.firstName} onChange={set('firstName')} /></div>
          <div className="hr-field"><label>Last Name</label><input className="hr-input" value={v.lastName} onChange={set('lastName')} /></div>
          <div className="hr-field"><label>Father / Husband Name</label><input className="hr-input" value={v.fn} onChange={set('fn')} /></div>
          <div className="hr-field"><label>CNIC</label><input className="hr-input" value={v.cnic} onChange={set('cnic')} placeholder="35201-XXXXXXX-X" /></div>
          <div className="hr-field"><label>Date of Birth</label><input className="hr-input" type="date" value={v.dob} onChange={set('dob')} /></div>
          <div className="hr-field"><label>Gender</label><select className="hr-input" value={v.gender} onChange={set('gender')}><option>Male</option><option>Female</option></select></div>
          <div className="hr-field"><label>Phone</label><input className="hr-input" value={v.phone} onChange={set('phone')} /></div>
          <div className="hr-field"><label>Email</label><input className="hr-input" value={v.email} onChange={set('email')} /></div>
          <div className="hr-field"><label>Blood Group</label><input className="hr-input" value={v.blood} onChange={set('blood')} /></div>
          <div className="hr-field"><label>Emergency Contact</label><input className="hr-input" value={v.emergency} onChange={set('emergency')} /></div>
          <div className="hr-field" style={{ gridColumn: '1/-1' }}><label>Address</label><input className="hr-input" value={v.address} onChange={set('address')} /></div>
        </div>
      )}
      {mt === 'official' && (
        <div className="hr-grid2">
          <div className="hr-field"><label>Department</label><select className="hr-input" value={v.dId} onChange={set('dId')}>{hr.depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div className="hr-field"><label>Designation</label><select className="hr-input" value={v.desId} onChange={set('desId')}>{desigOpts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
          <div className="hr-field"><label>Joining Date</label><input className="hr-input" type="date" value={v.join} onChange={set('join')} /></div>
          <div className="hr-field"><label>Employment Type</label><select className="hr-input" value={v.type} onChange={set('type')}>{EMP_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div className="hr-field"><label>Reporting Manager</label><input className="hr-input" value={v.manager} onChange={set('manager')} /></div>
          <div className="hr-field"><label>Qualification</label><input className="hr-input" value={v.qual} onChange={set('qual')} /></div>
          <div className="hr-field"><label>Experience</label><input className="hr-input" value={v.exp} onChange={set('exp')} placeholder="e.g. 5 yrs" /></div>
          <div className="hr-field"><label>Shift</label><input className="hr-input" value={v.shift} onChange={set('shift')} placeholder="e.g. 8:00 AM – 2:00 PM" /></div>
          <div className="hr-field" style={{ gridColumn: '1/-1' }}><label>Role / Responsibilities</label><input className="hr-input" value={v.role} onChange={set('role')} /></div>
        </div>
      )}
      {mt === 'salary' && (
        <>
          <div className="hr-grid3" style={{ marginBottom: 14 }}>
            <div className="hr-field"><label>Basic Salary (Rs)</label><input className="hr-input" type="number" value={v.basicSalary} onChange={set('basicSalary')} /></div>
            <div className="hr-field"><label>Pay Method</label><select className="hr-input" value={v.payMethod} onChange={set('payMethod')}>{PAY_METHODS.map((m) => <option key={m}>{m}</option>)}</select></div>
            <div className="hr-field"><label>Bank Name</label><input className="hr-input" value={v.bankName} onChange={set('bankName')} /></div>
          </div>
          <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--t2)', display: 'block', marginBottom: 6 }}>Allowances &amp; Deductions</label>
          {v.salaryHeads.map((h, i) => (
            <div className="hr-head-row" key={i}>
              <input className="hr-input" style={{ flex: 1 }} value={h.name} onChange={(ev) => setHead(i, 'name', ev.target.value)} placeholder="Head name" />
              <select className="hr-input" style={{ width: 120 }} value={h.type} onChange={(ev) => setHead(i, 'type', ev.target.value)}><option value="allow">Allowance</option><option value="deduct">Deduction</option></select>
              <input className="hr-input" style={{ width: 110 }} type="number" value={h.amount} onChange={(ev) => setHead(i, 'amount', ev.target.value)} placeholder="0" />
              <button className="btn-sm" style={{ height: 38, borderColor: 'var(--err)', color: 'var(--err)' }} onClick={() => rmHead(i)}><i className="fa-solid fa-xmark" /></button>
            </div>
          ))}
          <button className="btn-secondary" onClick={addHead}><i className="fa-solid fa-plus" /> Add Head</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, padding: '12px 14px', background: 'var(--muted)', borderRadius: 'var(--r-md)', fontSize: 13 }}>
            <span>Gross <strong>{rs(gross(previewEmp))}</strong></span><span>Deductions <strong style={{ color: 'var(--err)' }}>{rs(deductions(previewEmp))}</strong></span><span>Net <strong style={{ color: 'var(--success)' }}>{rs(netPay(previewEmp))}</strong></span>
          </div>
        </>
      )}
      {mt === 'leave' && (
        <div className="hr-grid3">
          {[['annual', 'Annual Leave'], ['casual', 'Casual Leave'], ['sick', 'Sick Leave'], ['balance', 'Current Balance']].map(([k, l]) => (
            <div className="hr-field" key={k}><label>{l}</label><input className="hr-input" type="number" value={v.leaves[k]} onChange={setLeave(k)} /></div>
          ))}
          <div className="hr-field"><label>Policy</label><input className="hr-input" value={v.leaves.policy} onChange={setLeave('policy')} /></div>
          <div className="hr-field"><label>Absent Deduction/day</label><input className="hr-input" type="number" value={v.leaves.absentDed} onChange={setLeave('absentDed')} /></div>
          <div className="hr-field"><label>Unpaid Leave Deduction</label><input className="hr-input" type="number" value={v.leaves.unpaidDed} onChange={setLeave('unpaidDed')} /></div>
        </div>
      )}
    </Shell>
  )
}

/* ════════ PAYROLL ════════ */
function payStatus(rec) {
  if (!rec) return { label: 'Not Generated', cls: 'st-pending' }
  const paid = (rec.payments || []).reduce((a, p) => a + Number(p.amount || 0), 0)
  if (paid >= (rec.netPayable || 0) && rec.netPayable > 0) return { label: 'Paid', cls: 'st-paid' }
  if (paid > 0) return { label: 'Partially Paid', cls: 'st-partial' }
  return { label: 'Generated', cls: 'st-generated' }
}

function Payroll({ hr, commit, fire }) {
  const [month, setMonth] = useState(4) // May (0-based)
  const [year, setYear] = useState(2026)
  const [openMenu, setOpenMenu] = useState(null) // { id, kind }
  const [expanded, setExpanded] = useState({})
  const [prModal, setPrModal] = useState(null)
  const [alModal, setAlModal] = useState(null)

  useEffect(() => { const h = () => setOpenMenu(null); document.addEventListener('click', h); return () => document.removeEventListener('click', h) }, [])

  const active = hr.emps.filter((e) => e.status === 'Active')
  const recOf = (id) => hr.payroll[payKey(id, year, month)]
  const totals = active.reduce((a, e) => { a.gross += gross(e); a.ded += deductions(e); a.net += netPay(e); return a }, { gross: 0, ded: 0, net: 0 })

  const saveSetup = (empId, setup) => {
    const key = payKey(empId, year, month); const existing = hr.payroll[key] || {}
    commit({ ...hr, payroll: { ...hr.payroll, [key]: { ...existing, month: MONTHS[month], year, ...setup, payments: existing.payments || [], generatedAt: existing.generatedAt || new Date().toISOString().slice(0, 10) } } })
    fire('Payroll saved')
  }
  const recordPayment = (empId, payment) => {
    const key = payKey(empId, year, month); const rec = hr.payroll[key]; if (!rec) return
    const payments = [...(rec.payments || []), payment]
    const paid = payments.reduce((a, p) => a + Number(p.amount || 0), 0)
    let nextHr = { ...hr, payroll: { ...hr.payroll, [key]: { ...rec, payments } } }
    // when fully paid, apply the loan installment deduction against active loans (once)
    const effLoan = (rec.customLoan > 0 ? rec.customLoan : rec.loanDeduct) || 0
    if (paid >= rec.netPayable && !rec.loanRecorded && effLoan > 0) {
      nextHr = { ...nextHr, loans: applyLoanDeduction(hr, empId, effLoan), payroll: { ...nextHr.payroll, [key]: { ...rec, payments, loanRecorded: true } } }
    }
    commit(nextHr); fire(`Payment of ${rs(payment.amount)} recorded`)
  }
  const generateAll = () => {
    const p = { ...hr.payroll }
    active.forEach((e) => { const key = payKey(e.id, year, month); if (!p[key]) { const ld = monthlyLoanDeduct(hr, e.id); p[key] = { month: MONTHS[month], year, basicPay: Number(e.basicSalary || 0), bonus: 0, totalGross: gross(e), stdDeductions: deductions(e), loanDeduct: ld, customLoan: 0, fineDeduct: 0, leaveDeduct: 0, absentDeduct: 0, totalDeductions: deductions(e) + ld, netPayable: gross(e) - deductions(e) - ld, payments: [], generatedAt: new Date().toISOString().slice(0, 10) } } })
    commit({ ...hr, payroll: p }); fire('Payroll generated for all pending')
  }
  const saveLoans = (empId, list, bumpId) => commit({ ...hr, ...(bumpId ? { nextLoanId: (hr.nextLoanId || 1002) + 1 } : {}), loans: { ...hr.loans, [empId]: list } })

  return (
    <>
      <div className="hr-bar">
        <div className="hr-field"><label>Month</label><select className="hr-input" value={month} onChange={(e) => setMonth(Number(e.target.value))}>{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select></div>
        <div className="hr-field"><label>Year</label><select className="hr-input" value={year} onChange={(e) => setYear(Number(e.target.value))}>{[2024, 2025, 2026, 2027].map((y) => <option key={y}>{y}</option>)}</select></div>
        <button className="btn-primary" style={{ marginLeft: 'auto' }} onClick={generateAll}><i className="fa-solid fa-bolt" /> Generate All</button>
      </div>

      <div className="hr-kpis">
        <div className="hr-kpi info"><div className="hr-kpi-top"><i className="fa-solid fa-users" /> Employees</div><div className="hr-kpi-val">{active.length}</div></div>
        <div className="hr-kpi"><div className="hr-kpi-top"><i className="fa-solid fa-sack-dollar" /> Gross Payroll</div><div className="hr-kpi-val" style={{ fontSize: 16 }}>{rs(totals.gross)}</div></div>
        <div className="hr-kpi red"><div className="hr-kpi-top"><i className="fa-solid fa-minus" /> Deductions</div><div className="hr-kpi-val" style={{ fontSize: 16 }}>{rs(totals.ded)}</div></div>
        <div className="hr-kpi green"><div className="hr-kpi-top"><i className="fa-solid fa-money-bill-wave" /> Net Payable</div><div className="hr-kpi-val" style={{ fontSize: 16 }}>{rs(totals.net)}</div></div>
      </div>

      <div className="section-card">
        <div className="card-header"><div className="card-title"><i className="fa-solid fa-coins" /> Payroll — {MONTHS[month]} {year}</div></div>
        <div className="tbl-wrap">
          <table className="hr-table">
            <thead><tr><th>#</th><th>Employee</th><th>Designation</th><th className="r">Net Payable</th><th>Status</th><th className="c">Reports</th><th className="c">Actions</th><th className="c">▾</th></tr></thead>
            <tbody>
              {active.map((e, i) => {
                const rec = recOf(e.id); const st = payStatus(rec)
                const paid = (rec?.payments || []).reduce((a, p) => a + Number(p.amount || 0), 0)
                const isPaid = st.label === 'Paid'
                return (
                  <Fragment key={e.id}>
                    <tr>
                      <td style={{ color: 'var(--tm)', fontWeight: 700 }}>{i + 1}</td>
                      <td><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><div className="hr-avatar">{initials(e)}</div><div><div style={{ fontWeight: 700, color: 'var(--t1)' }}>{fullName(e)}</div><div style={{ fontSize: 11, color: 'var(--tm)' }}>{e.eid}</div></div></div></td>
                      <td>{desigName(hr, e.desId)}</td>
                      <td className="r" style={{ fontWeight: 800 }}>{num(rec?.netPayable ?? netPay(e))}</td>
                      <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                      <td className="c">
                        <div className="hr-menu-wrap" onClick={(ev) => ev.stopPropagation()}>
                          <button className="hr-rep-btn" onClick={() => setOpenMenu(openMenu?.id === e.id && openMenu.kind === 'reports' ? null : { id: e.id, kind: 'reports' })}><i className="fa-solid fa-chart-line" /> Reports <i className="fa-solid fa-chevron-down" style={{ fontSize: 9 }} /></button>
                          {openMenu?.id === e.id && openMenu.kind === 'reports' && (
                            <div className="hr-drop">
                              <button className="hr-drop-item" onClick={() => { setOpenMenu(null); printSalarySlip(e, hr, fire, `${MONTHS[month]} ${year}`) }}><i className="fa-solid fa-file-invoice-dollar" style={{ color: '#1E40AF' }} /> Salary Slip</button>
                              <button className="hr-drop-item" onClick={() => { setOpenMenu(null); printPayHistory(e, hr, fire) }}><i className="fa-solid fa-clock-rotate-left" style={{ color: '#7C3AED' }} /> Pay History Ledger</button>
                              <button className="hr-drop-item" onClick={() => { setOpenMenu(null); printLoanStatement(e, hr, fire) }}><i className="fa-solid fa-hand-holding-dollar" style={{ color: '#16A34A' }} /> Loan / Advance Report</button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="c">
                        <div className="hr-menu-wrap" onClick={(ev) => ev.stopPropagation()}>
                          <button className="hr-dots" onClick={() => setOpenMenu(openMenu?.id === e.id && openMenu.kind === 'dots' ? null : { id: e.id, kind: 'dots' })}><i className="fa-solid fa-ellipsis-vertical" /></button>
                          {openMenu?.id === e.id && openMenu.kind === 'dots' && (
                            <div className="hr-drop">
                              <button className="hr-drop-item" disabled={isPaid} onClick={() => { setOpenMenu(null); setPrModal({ empId: e.id }) }}><i className="fa-solid fa-money-check-dollar" style={{ color: '#1E40AF' }} /> {st.label === 'Partially Paid' ? 'Pay Roll (Add Payment)' : isPaid ? 'Pay Roll (Already Paid)' : 'Pay Roll'}</button>
                              <button className="hr-drop-item" onClick={() => { setOpenMenu(null); setAlModal({ empId: e.id }) }}><i className="fa-solid fa-hand-holding-dollar" style={{ color: '#16A34A' }} /> Advance / Loan</button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="c"><button className="hr-dots" onClick={() => setExpanded((s) => ({ ...s, [e.id]: !s[e.id] }))}><i className={`fa-solid fa-chevron-${expanded[e.id] ? 'up' : 'down'}`} /></button></td>
                    </tr>
                    {expanded[e.id] && (
                      <tr><td colSpan={8} style={{ padding: 0 }}><div className="hr-pay-detail"><PayDetail e={e} hr={hr} rec={rec} paid={paid} month={month} year={year} /></div></td></tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot><tr><td colSpan={3}>TOTAL (standard net)</td><td className="r">{num(totals.net)}</td><td colSpan={4} /></tr></tfoot>
          </table>
        </div>
      </div>

      {prModal && <PayRollModal empId={prModal.empId} hr={hr} month={month} year={year} onSaveSetup={saveSetup} onRecordPayment={recordPayment} onClose={() => setPrModal(null)} onToast={fire} />}
      {alModal && <AdvLoanModal empId={alModal.empId} hr={hr} onSaveLoans={saveLoans} onClose={() => setAlModal(null)} onToast={fire} />}
    </>
  )
}

function applyLoanDeduction(hr, empId, amount) {
  let rem = amount
  const list = (hr.loans[empId] || []).map((l) => ({ ...l, received: [...(l.received || [])] }))
  list.forEach((l) => {
    if (l.status === 'active' && l.repaymentType === 'Installment' && rem > 0) {
      const take = Math.min(rem, l.remaining); l.remaining -= take; rem -= take
      l.received.push({ amount: take, date: new Date().toISOString().slice(0, 10), comment: 'Payroll loan installment' })
      if (l.remaining <= 0) { l.remaining = 0; l.status = 'returned' }
    }
  })
  return { ...hr.loans, [empId]: list }
}

function PayDetail({ e, hr, rec, paid, month, year }) {
  const r = rec || {}
  const gross_ = r.totalGross ?? gross(e)
  const totDed = r.totalDeductions ?? deductions(e)
  const net = r.netPayable ?? netPay(e)
  const remaining = Math.max(0, net - paid)
  const cell = (label, val, cls) => <div className="hr-pd-item"><label>{label}</label><div className={`val ${cls || ''}`}>{rs(val)}</div></div>
  return (
    <>
      <div className="hr-pd-grid">
        <div className="hr-pd-item"><label>Month</label><div className="val">{MONTHS[month]} {year}</div></div>
        {cell('Basic Pay', e.basicSalary)}
        {cell('Bonus', r.bonus || 0, r.bonus ? '' : 'zero')}
        {cell('Total Gross', gross_, 'pos')}
        {cell('Loan Outstanding', loanRemaining(hr, e.id), loanRemaining(hr, e.id) ? 'neg' : 'zero')}
        {cell('Loan Deduction', (r.customLoan > 0 ? r.customLoan : r.loanDeduct) || 0, (r.customLoan || r.loanDeduct) ? 'neg' : 'zero')}
        {cell('Fine Deduction', r.fineDeduct || 0, r.fineDeduct ? 'neg' : 'zero')}
        {cell('Leave Deduction', r.leaveDeduct || 0, r.leaveDeduct ? 'neg' : 'zero')}
        {cell('Absent Deduction', r.absentDeduct || 0, r.absentDeduct ? 'neg' : 'zero')}
        {cell('Total Deductions', totDed, totDed ? 'neg' : 'zero')}
        {cell('Net Payable', net, 'pos')}
        {cell('Paid', paid, paid ? 'pos' : 'zero')}
        {cell('Remaining', remaining, remaining > 0 ? 'neg' : 'pos')}
        <div className="hr-pd-item"><label>Status</label><div className="val">{payStatus(rec).label}</div></div>
      </div>
      {(r.payments || []).length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}><i className="fa-solid fa-receipt" /> Payment Transactions ({r.payments.length})</div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--bl)', borderRadius: 'var(--r-md)' }}>
            {r.payments.map((p, i) => <div className="hr-txn-row" key={i}><span style={{ fontWeight: 800, color: 'var(--brand)' }}>#{i + 1}</span><span style={{ fontWeight: 800, color: 'var(--success)' }}>+ {rs(p.amount)}</span><span style={{ color: 'var(--tm)', fontStyle: 'italic' }}>{p.comment || 'No comment'}</span><span style={{ textAlign: 'right', color: 'var(--t2)' }}>{fmtDate(p.date)}</span></div>)}
          </div>
        </div>
      )}
    </>
  )
}

/* ── Pay Roll modal (Setup + Make Payment) ── */
function PayRollModal({ empId, hr, month, year, onSaveSetup, onRecordPayment, onClose, onToast }) {
  const e = hr.emps.find((x) => x.id === empId)
  const rec = hr.payroll[payKey(empId, year, month)] || {}
  const hasPayments = (rec.payments || []).length > 0
  const [tab, setTab] = useState(hasPayments ? 'payment' : 'setup')
  const [v, setV] = useState({
    bonus: rec.bonus || 0, loanDeduct: rec.loanDeduct ?? monthlyLoanDeduct(hr, empId), customLoan: rec.customLoan || 0,
    fineDeduct: rec.fineDeduct || 0, fineComment: rec.fineComment || '', leaveCount: rec.leaveCount || 0, leaveDeduct: rec.leaveDeduct || 0, leaveComment: rec.leaveComment || '',
    absentCount: rec.absentCount || 0, absentDeduct: rec.absentDeduct || 0, absentComment: rec.absentComment || '',
  })
  const set = (k) => (ev) => setV((s) => ({ ...s, [k]: ev.target.value }))
  const setLeaveCount = (ev) => { const c = Number(ev.target.value) || 0; setV((s) => ({ ...s, leaveCount: ev.target.value, leaveDeduct: c * (Number(e.leaves?.absentDed) || 0) })) }
  const setAbsentCount = (ev) => { const c = Number(ev.target.value) || 0; setV((s) => ({ ...s, absentCount: ev.target.value, absentDeduct: c * (Number(e.leaves?.unpaidDed) || 0) })) }

  const N = (x) => Number(x) || 0
  const totalGross = gross(e) + N(v.bonus)
  const effLoan = N(v.customLoan) > 0 ? N(v.customLoan) : N(v.loanDeduct)
  const totalDed = deductions(e) + effLoan + N(v.fineDeduct) + N(v.leaveDeduct) + N(v.absentDeduct)
  const net = totalGross - totalDed
  const paid = (rec.payments || []).reduce((a, p) => a + N(p.amount), 0)
  const remaining = Math.max(0, (rec.netPayable ?? net) - paid)

  const [payAmt, setPayAmt] = useState('')
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))
  const [payComment, setPayComment] = useState('')

  const saveSetup = () => {
    onSaveSetup(empId, { basicPay: Number(e.basicSalary || 0), bonus: N(v.bonus), totalGross, stdDeductions: deductions(e), loanDeduct: N(v.loanDeduct), customLoan: N(v.customLoan), fineDeduct: N(v.fineDeduct), fineComment: v.fineComment, leaveCount: N(v.leaveCount), leaveDeduct: N(v.leaveDeduct), leaveComment: v.leaveComment, absentCount: N(v.absentCount), absentDeduct: N(v.absentDeduct), absentComment: v.absentComment, totalDeductions: totalDed, netPayable: net })
    setTab('payment')
  }
  const makePayment = () => {
    const amt = N(payAmt)
    if (amt <= 0) return onToast('Enter a valid payment amount', 'warn')
    if (amt > remaining + 0.01) return onToast(`Amount cannot exceed remaining ${rs(remaining)}`, 'warn')
    onRecordPayment(empId, { amount: amt, date: payDate, comment: payComment.trim() })
    onClose()
  }

  return (
    <Shell title="Pay Roll" sub={`${fullName(e)} · ${MONTHS[month]} ${year}`} icon="fa-money-check-dollar" onClose={onClose} maxWidth={620}
      foot={tab === 'setup'
        ? <><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={saveSetup}><i className="fa-solid fa-floppy-disk" /> Save &amp; Next</button></>
        : <><button className="btn-secondary" onClick={onClose}>Close</button><button className="btn-primary" disabled={!rec.netPayable && !hasPayments} onClick={makePayment}><i className="fa-solid fa-money-bill-wave" /> Make Payment</button></>}>
      <div className="hr-mtabs">
        <button className={`hr-mtab${tab === 'setup' ? ' active' : ''}`} onClick={() => setTab('setup')}><i className="fa-solid fa-sliders" /> Setup</button>
        <button className={`hr-mtab${tab === 'payment' ? ' active' : ''}`} onClick={() => { if (rec.netPayable || hasPayments) setTab('payment'); else onToast('Save setup first', 'warn') }}><i className="fa-solid fa-money-bill-wave" /> Make Payment</button>
      </div>

      {tab === 'setup' && (
        <>
          <div className="hr-grid3" style={{ marginBottom: 12 }}>
            <div className="hr-field"><label>Basic Pay</label><input className="hr-input" value={num(e.basicSalary)} readOnly style={{ background: 'var(--muted)' }} /></div>
            <div className="hr-field"><label>Allowances</label><input className="hr-input" value={num(allowances(e))} readOnly style={{ background: 'var(--muted)' }} /></div>
            <div className="hr-field"><label>Std. Deductions</label><input className="hr-input" value={num(deductions(e))} readOnly style={{ background: 'var(--muted)' }} /></div>
            <div className="hr-field"><label>Bonus (+)</label><input className="hr-input" type="number" value={v.bonus} onChange={set('bonus')} /></div>
            <div className="hr-field"><label>Loan Outstanding</label><input className="hr-input" value={num(loanRemaining(hr, empId))} readOnly style={{ background: 'var(--muted)' }} /></div>
            <div className="hr-field"><label>Loan Deduction (–)</label><input className="hr-input" type="number" value={v.loanDeduct} onChange={set('loanDeduct')} /></div>
            <div className="hr-field"><label>Custom Loan Deduction (–)</label><input className="hr-input" type="number" value={v.customLoan} onChange={set('customLoan')} /></div>
            <div className="hr-field"><label>Fine Deduction (–)</label><input className="hr-input" type="number" value={v.fineDeduct} onChange={set('fineDeduct')} /></div>
            <div className="hr-field"><label>Fine Comment</label><input className="hr-input" value={v.fineComment} onChange={set('fineComment')} /></div>
            <div className="hr-field"><label>Leave Days</label><input className="hr-input" type="number" value={v.leaveCount} onChange={setLeaveCount} /></div>
            <div className="hr-field"><label>Leave Deduction (–)</label><input className="hr-input" type="number" value={v.leaveDeduct} onChange={set('leaveDeduct')} /></div>
            <div className="hr-field"><label>Leave Comment</label><input className="hr-input" value={v.leaveComment} onChange={set('leaveComment')} /></div>
            <div className="hr-field"><label>Absent Days</label><input className="hr-input" type="number" value={v.absentCount} onChange={setAbsentCount} /></div>
            <div className="hr-field"><label>Absent Deduction (–)</label><input className="hr-input" type="number" value={v.absentDeduct} onChange={set('absentDeduct')} /></div>
            <div className="hr-field"><label>Absent Comment</label><input className="hr-input" value={v.absentComment} onChange={set('absentComment')} /></div>
          </div>
          <div className="hr-net-bar">
            <div className="b"><div className="l">Total Gross</div><div className="v">{rs(totalGross)}</div></div>
            <div className="b"><div className="l">Total Deductions</div><div className="v" style={{ color: 'var(--err)' }}>{rs(totalDed)}</div></div>
            <div className="b"><div className="l">Net Payable</div><div className="v" style={{ color: 'var(--success)' }}>{rs(net)}</div></div>
          </div>
        </>
      )}

      {tab === 'payment' && (
        <>
          <div className="hr-sum-cards">
            <div className="hr-sum-card"><div className="l">Net Payable</div><div className="v">{rs(rec.netPayable ?? net)}</div></div>
            <div className="hr-sum-card"><div className="l">Paid</div><div className="v" style={{ color: 'var(--success)' }}>{rs(paid)}</div></div>
            <div className="hr-sum-card"><div className="l">Remaining</div><div className="v" style={{ color: remaining > 0 ? 'var(--err)' : 'var(--success)' }}>{rs(remaining)}</div></div>
          </div>
          <div className="hr-grid3">
            <div className="hr-field"><label>Payment Amount (Rs)</label><input className="hr-input" type="number" value={payAmt} onChange={(ev) => setPayAmt(ev.target.value)} placeholder="0" /></div>
            <div className="hr-field"><label>Payment Date</label><input className="hr-input" type="date" value={payDate} onChange={(ev) => setPayDate(ev.target.value)} /></div>
            <div className="hr-field"><label>Comment</label><input className="hr-input" value={payComment} onChange={(ev) => setPayComment(ev.target.value)} placeholder="e.g. Bank transfer" /></div>
          </div>
          {(rec.payments || []).length > 0 && <div style={{ marginTop: 12, fontSize: 12, color: 'var(--tm)' }}>{rec.payments.length} payment(s) recorded. Loan installment auto-deducts on full settlement.</div>}
        </>
      )}
    </Shell>
  )
}

/* ── Advance / Loan modal (Set Up · Repayment · History) ── */
function AdvLoanModal({ empId, hr, onSaveLoans, onClose, onToast }) {
  const e = hr.emps.find((x) => x.id === empId)
  const [tab, setTab] = useState('setup')
  const loans = empLoans(hr, empId)
  const activeLoans = loans.filter((l) => l.status === 'active')

  const [nl, setNl] = useState({ amount: '', comment: '', repaymentType: '', deductDate: new Date().toISOString().slice(0, 10), installmentType: '', installmentAmount: '' })
  const setNlv = (k) => (ev) => setNl((s) => ({ ...s, [k]: ev.target.value }))
  const [rp, setRp] = useState({ loanId: activeLoans[0]?.id || '', amount: '', date: new Date().toISOString().slice(0, 10), comment: '' })
  const setRpv = (k) => (ev) => setRp((s) => ({ ...s, [k]: ev.target.value }))
  // Always resolve to a valid active loan so the form never breaks after loans change.
  const selLoanId = activeLoans.some((l) => l.id === Number(rp.loanId)) ? Number(rp.loanId) : (activeLoans[0]?.id || '')
  const selLoan = activeLoans.find((l) => l.id === selLoanId)
  const repayAfter = selLoan ? Math.max(0, selLoan.remaining - (Number(rp.amount) || 0)) : 0

  const saveNewLoan = () => {
    const amt = Number(nl.amount) || 0
    if (amt <= 0) return onToast('Enter a valid loan amount', 'warn')
    if (!nl.repaymentType) return onToast('Select a repayment type', 'warn')
    if (nl.repaymentType === 'Installment' && (!nl.installmentType || !Number(nl.installmentAmount))) return onToast('Complete the installment details', 'warn')
    const id = hr.nextLoanId || (1000 + loans.length + 1)
    const next = [...loans, { id, loanNumber: loans.length + 1, amount: amt, comment: nl.comment.trim() || 'N/A', repaymentType: nl.repaymentType, deductDate: nl.deductDate, installmentType: nl.repaymentType === 'Installment' ? nl.installmentType : null, installmentAmount: nl.repaymentType === 'Installment' ? Number(nl.installmentAmount) : amt, status: 'active', received: [], remaining: amt, createdAt: new Date().toISOString().slice(0, 10) }]
    onSaveLoans(empId, next, true)
    setNl({ amount: '', comment: '', repaymentType: '', deductDate: new Date().toISOString().slice(0, 10), installmentType: '', installmentAmount: '' })
    onToast(`Loan of ${rs(amt)} set up`)
  }
  const saveRepay = () => {
    const amt = Number(rp.amount) || 0; const loan = loans.find((l) => l.id === selLoanId)
    if (!loan) return onToast('Select a loan', 'warn')
    if (amt <= 0) return onToast('Enter a valid amount', 'warn')
    if (amt > loan.remaining) return onToast(`Amount cannot exceed remaining ${rs(loan.remaining)}`, 'warn')
    const next = loans.map((l) => { if (l.id !== loan.id) return l; const remaining = l.remaining - amt; return { ...l, received: [...(l.received || []), { amount: amt, date: rp.date, comment: rp.comment.trim() }], remaining: Math.max(0, remaining), status: remaining <= 0 ? 'returned' : 'active' } })
    onSaveLoans(empId, next); setRp((s) => ({ ...s, amount: '', comment: '' })); onToast(`Repayment of ${rs(amt)} recorded`)
  }
  const markReturned = (loan) => {
    const next = loans.map((l) => { if (l.id !== loan.id) return l; const received = [...(l.received || [])]; if (l.remaining > 0) received.push({ amount: l.remaining, date: new Date().toISOString().slice(0, 10), comment: 'Final settlement — marked returned' }); return { ...l, received, remaining: 0, status: 'returned' } })
    onSaveLoans(empId, next); onToast('Loan marked returned', 'info')
  }

  return (
    <Shell title="Advance / Loan" sub={`For: ${fullName(e)}`} icon="fa-hand-holding-dollar" onClose={onClose} maxWidth={620}
      foot={tab === 'setup'
        ? <><button className="btn-secondary" onClick={onClose}>Close</button><button className="btn-primary" onClick={saveNewLoan}><i className="fa-solid fa-floppy-disk" /> Save Loan</button></>
        : tab === 'repay'
          ? <><button className="btn-secondary" onClick={onClose}>Close</button><button className="btn-primary" disabled={!activeLoans.length} onClick={saveRepay}><i className="fa-solid fa-money-bill-transfer" /> Record Repayment</button></>
          : <button className="btn-secondary" onClick={onClose}>Close</button>}>
      <div className="hr-sum-cards">
        <div className="hr-sum-card"><div className="l">Active Loans</div><div className="v">{activeLoanCount(hr, empId)}</div></div>
        <div className="hr-sum-card"><div className="l">Outstanding</div><div className="v" style={{ color: 'var(--err)' }}>{rs(loanRemaining(hr, empId))}</div></div>
        <div className="hr-sum-card"><div className="l">Returned</div><div className="v" style={{ color: 'var(--success)' }}>{rs(loanTotalReturned(hr, empId))}</div></div>
      </div>
      <div className="hr-mtabs">
        <button className={`hr-mtab${tab === 'setup' ? ' active' : ''}`} onClick={() => setTab('setup')}><i className="fa-solid fa-plus" /> Set Up Loan</button>
        <button className={`hr-mtab${tab === 'repay' ? ' active' : ''}`} onClick={() => setTab('repay')}><i className="fa-solid fa-money-bill-transfer" /> Repayment</button>
        <button className={`hr-mtab${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}><i className="fa-solid fa-clock-rotate-left" /> History</button>
      </div>

      {tab === 'setup' && (
        <div className="hr-grid2">
          <div className="hr-field"><label>Loan / Advance Amount (Rs)</label><input className="hr-input" type="number" value={nl.amount} onChange={setNlv('amount')} placeholder="0" /></div>
          <div className="hr-field"><label>Repayment Type</label><select className="hr-input" value={nl.repaymentType} onChange={setNlv('repaymentType')}><option value="">Select…</option><option>Lump Sum</option><option>Installment</option></select></div>
          <div className="hr-field"><label>Deduction Start Date</label><input className="hr-input" type="date" value={nl.deductDate} onChange={setNlv('deductDate')} /></div>
          <div className="hr-field"><label>Comment</label><input className="hr-input" value={nl.comment} onChange={setNlv('comment')} placeholder="Purpose of loan" /></div>
          {nl.repaymentType === 'Installment' && <>
            <div className="hr-field"><label>Installment Type</label><select className="hr-input" value={nl.installmentType} onChange={setNlv('installmentType')}><option value="">Select…</option><option>Monthly</option><option>Weekly</option></select></div>
            <div className="hr-field"><label>Installment Amount (Rs)</label><input className="hr-input" type="number" value={nl.installmentAmount} onChange={setNlv('installmentAmount')} placeholder="0" /></div>
          </>}
        </div>
      )}

      {tab === 'repay' && (activeLoans.length === 0
        ? <div className="hr-empty"><i className="fa-solid fa-circle-info" /><div style={{ fontSize: 13, fontWeight: 700 }}>No active loans to repay</div><div style={{ fontSize: 12, marginTop: 4 }}>Set up a loan first from the “Set Up Loan” tab.</div></div>
        : (
          <>
            <div className="hr-field" style={{ marginBottom: 12 }}><label>Select Loan</label>
              <select className="hr-input" value={selLoanId} onChange={setRpv('loanId')}>{activeLoans.map((l) => <option key={l.id} value={l.id}>Loan #{l.loanNumber} — {l.comment} · {num(l.amount)} (Remaining {num(l.remaining)})</option>)}</select>
            </div>
            {selLoan && (
              <div className="hr-sum-cards" style={{ marginBottom: 12 }}>
                <div className="hr-sum-card"><div className="l">Loan Amount</div><div className="v">{rs(selLoan.amount)}</div></div>
                <div className="hr-sum-card"><div className="l">Remaining</div><div className="v" style={{ color: 'var(--err)' }}>{rs(selLoan.remaining)}</div></div>
                <div className="hr-sum-card"><div className="l">Installment</div><div className="v">{selLoan.repaymentType === 'Installment' ? rs(selLoan.installmentAmount) : '—'}</div></div>
              </div>
            )}
            <div className="hr-grid3">
              <div className="hr-field"><label>Received Amount (Rs)</label><input className="hr-input" type="number" value={rp.amount} onChange={setRpv('amount')} placeholder="0" /></div>
              <div className="hr-field"><label>Received Date</label><input className="hr-input" type="date" value={rp.date} onChange={setRpv('date')} /></div>
              <div className="hr-field"><label>Comment</label><input className="hr-input" value={rp.comment} onChange={setRpv('comment')} placeholder="e.g. Cash / bank transfer" /></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              {selLoan?.repaymentType === 'Installment' && <button className="btn-secondary" onClick={() => setRp((s) => ({ ...s, amount: Math.min(selLoan.installmentAmount, selLoan.remaining) }))}><i className="fa-solid fa-coins" /> Use Installment ({num(selLoan.installmentAmount)})</button>}
              {selLoan && <button className="btn-secondary" onClick={() => setRp((s) => ({ ...s, amount: selLoan.remaining }))}><i className="fa-solid fa-flag-checkered" /> Pay Full ({num(selLoan.remaining)})</button>}
              {Number(rp.amount) > 0 && <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--tm)', marginLeft: 'auto' }}>Remaining after: <strong style={{ color: repayAfter > 0 ? 'var(--err)' : 'var(--success)' }}>{rs(repayAfter)}</strong></span>}
            </div>
          </>
        ))}

      {tab === 'history' && (loans.length === 0
        ? <div className="hr-empty"><i className="fa-solid fa-clock-rotate-left" /><div style={{ fontSize: 13, fontWeight: 700 }}>No loan history yet</div></div>
        : loans.map((l) => (
          <div className={`hr-loan-card ${l.status}`} key={l.id}>
            <div className="hr-loan-head"><div className="hr-loan-title"><i className="fa-solid fa-hand-holding-dollar" /> Loan #{l.loanNumber}</div><span className={`badge ${l.status === 'active' ? 'b-green' : 'b-gray'}`}>{l.status === 'active' ? 'Active' : 'Returned'}</span></div>
            <div style={{ fontSize: 11.5, color: 'var(--tm)', fontStyle: 'italic', marginBottom: 8 }}>{l.comment}</div>
            <div className="hr-loan-grid">
              <div className="hr-loan-f"><label>Total Amount</label><div className="v">{rs(l.amount)}</div></div>
              <div className="hr-loan-f"><label>Remaining</label><div className="v" style={{ color: l.remaining > 0 ? 'var(--err)' : 'var(--success)' }}>{rs(l.remaining)}</div></div>
              <div className="hr-loan-f"><label>Repayment</label><div className="v">{l.repaymentType}{l.installmentType ? ` (${l.installmentType})` : ''}</div></div>
              <div className="hr-loan-f"><label>Installment</label><div className="v">{l.repaymentType === 'Installment' ? rs(l.installmentAmount) : '—'}</div></div>
            </div>
            {(l.received || []).length > 0 && <div style={{ marginTop: 10 }}><div style={{ fontSize: 10, fontWeight: 800, color: 'var(--tm)', textTransform: 'uppercase' }}><i className="fa-solid fa-receipt" /> Repayments ({l.received.length})</div>{l.received.map((r, i) => <div className="hr-repay-row" key={i}><span style={{ fontWeight: 800, color: 'var(--success)' }}>+ {rs(r.amount)}</span><span style={{ color: 'var(--tm)', fontStyle: 'italic' }}>{r.comment || 'No comment'}</span><span style={{ textAlign: 'right' }}>{fmtDate(r.date)}</span></div>)}</div>}
            {l.status === 'active' && <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--bl)' }}><button className="btn-sm" style={{ height: 30, borderColor: 'var(--success)', color: 'var(--success)' }} onClick={() => markReturned(l)}><i className="fa-solid fa-circle-check" /> Mark Returned</button></div>}
          </div>
        )))}
    </Shell>
  )
}

/* ════════ REPORTS ════════ */
const HR_REPORTS = [
  { key: 'directory', name: 'Employee Directory', desc: 'Full staff list with personal details, departments, designations & contact info', icon: 'fa-users', color: '#1E40AF', period: false },
  { key: 'salary-register', name: 'Salary Register', desc: 'Month-wise gross pay, allowances, deductions & net payable for all employees', icon: 'fa-file-invoice-dollar', color: '#16A34A', period: true },
  { key: 'loan-summary', name: 'Loan & Advance Ledger', desc: 'All employee loans — issued amounts, repayments & outstanding balances', icon: 'fa-hand-holding-dollar', color: '#D97706', period: false },
  { key: 'dept-summary', name: 'Department Summary', desc: 'Headcount, designations, salary cost & breakdown per department', icon: 'fa-building', color: '#0284C7', period: false },
  { key: 'leave-register', name: 'Leave & Attendance Register', desc: 'Leave balances, entitlements, deductions & policy per employee', icon: 'fa-plane-departure', color: '#7C3AED', period: false },
  { key: 'payroll-summary', name: 'Payroll Summary', desc: 'Month-wise payroll totals — gross, deductions, net payable & status', icon: 'fa-chart-pie', color: '#0F766E', period: true },
]

function Reports({ hr, fire }) {
  const [type, setType] = useState(null)
  const [ctrl, setCtrl] = useState({ month: 4, year: 2026 })
  const meta = HR_REPORTS.find((r) => r.key === type)
  const report = useMemo(() => (type ? buildHrReport(hr, type, ctrl) : null), [hr, type, ctrl])

  if (!type) {
    return (
      <div className="hr-rpt-grid">
        {HR_REPORTS.map((r) => (
          <div className="hr-rpt-card" key={r.key} onClick={() => setType(r.key)}>
            <div className="hr-rpt-icon" style={{ background: `${r.color}1a`, color: r.color }}><i className={`fa-solid ${r.icon}`} /></div>
            <div style={{ flex: 1 }}><div className="hr-rpt-name">{r.name}</div><div className="hr-rpt-desc">{r.desc}</div></div>
            <div className="hr-rpt-arrow"><i className="fa-solid fa-chevron-right" /></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="hr-rpt-bar">
        <button className="btn-secondary" onClick={() => setType(null)}><i className="fa-solid fa-arrow-left" /> All Reports</button>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 800, color: 'var(--t1)', alignSelf: 'center' }}><i className={`fa-solid ${meta.icon}`} style={{ color: meta.color, marginRight: 8 }} />{report.title}</div>
        {meta.period && <>
          <div className="hr-field"><label>Month</label><select className="hr-input" value={ctrl.month} onChange={(e) => setCtrl((s) => ({ ...s, month: Number(e.target.value) }))}>{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select></div>
          <div className="hr-field"><label>Year</label><select className="hr-input" value={ctrl.year} onChange={(e) => setCtrl((s) => ({ ...s, year: Number(e.target.value) }))}>{[2024, 2025, 2026, 2027].map((y) => <option key={y}>{y}</option>)}</select></div>
        </>}
        <button className="hr-pdf-btn" onClick={() => printHrReport(report, fire)}><i className="fa-solid fa-file-pdf" /> Download A4 Report</button>
      </div>

      {report.kpis?.length > 0 && (
        <div className="hr-kpis">{report.kpis.map((k, i) => <div key={i} className={`hr-kpi ${k.cls || ''}`}><div className="hr-kpi-top"><i className={`fa-solid ${k.icon || 'fa-circle'}`} /> {k.label}</div><div className="hr-kpi-val" style={{ fontSize: 16 }}>{k.value}</div></div>)}</div>
      )}

      <div className="section-card">
        <div className="card-header"><div><div className="card-title"><i className={`fa-solid ${meta.icon}`} /> {report.title}</div>{report.period && <div className="card-sub">{report.period}</div>}</div></div>
        <div style={{ padding: '4px 16px 16px' }}>
          {report.sections.every((s) => s.rows.length === 0) ? <div className="hr-empty"><i className="fa-solid fa-chart-line" /><div style={{ fontSize: 13, fontWeight: 700 }}>No data for this report</div></div>
            : report.sections.map((sec, si) => (
              <div key={si}>
                {sec.title && <div className="hr-sect-title">{sec.title}</div>}
                <div className="tbl-wrap" style={{ marginBottom: 6 }}>
                  <table className="hr-table">
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

function buildHrReport(hr, type, ctrl) {
  const C = (label, a) => ({ label, a: a || 'l' })
  if (type === 'directory') {
    const active = hr.emps.filter((e) => e.status === 'Active').length
    return { title: 'Employee Directory', filters: [['Total Staff', String(hr.emps.length)], ['Active', String(active)], ['Inactive', String(hr.emps.length - active)], ['Departments', String(hr.depts.length)]],
      kpis: [{ label: 'Total Staff', value: hr.emps.length, icon: 'fa-users', cls: 'info' }, { label: 'Active', value: active, icon: 'fa-user-check', cls: 'green' }, { label: 'Inactive', value: hr.emps.length - active, icon: 'fa-user-slash', cls: 'amber' }],
      sections: [{ title: 'Full Staff Directory', columns: [C('#', 'c'), C('Name'), C('ID'), C('Gender'), C('Department'), C('Designation'), C('Phone'), C('Joined'), C('Type'), C('Status')], rows: hr.emps.map((e, i) => [i + 1, fullName(e), e.eid, e.gender || '—', deptName(hr, e.dId), desigName(hr, e.desId), e.phone || '—', fmtDate(e.join), e.type || '—', e.status]), totals: null }] }
  }
  if (type === 'salary-register') {
    const list = hr.emps.filter((e) => e.status === 'Active')
    let tB = 0; let tA = 0; let tD = 0; let tN = 0
    const rows = list.map((e, i) => { const b = Number(e.basicSalary || 0); const a = allowances(e); const d = deductions(e); const n = b + a - d; tB += b; tA += a; tD += d; tN += n; return [i + 1, fullName(e), desigName(hr, e.desId), num(b), num(a), num(d), num(n)] })
    return { title: 'Salary Register', period: `${MONTHS[ctrl.month]} ${ctrl.year}`, filters: [['Period', `${MONTHS[ctrl.month]} ${ctrl.year}`], ['Employees', String(list.length)], ['Net Payroll', rs(tN)]],
      kpis: [{ label: 'Gross', value: rs(tB + tA), icon: 'fa-sack-dollar', cls: 'info' }, { label: 'Deductions', value: rs(tD), icon: 'fa-minus', cls: 'red' }, { label: 'Net Payable', value: rs(tN), icon: 'fa-money-bill-wave', cls: 'green' }],
      sections: [{ columns: [C('#', 'c'), C('Employee'), C('Designation'), C('Basic', 'r'), C('Allowances', 'r'), C('Deductions', 'r'), C('Net Payable', 'r')], rows, totals: ['', '', 'TOTAL', num(tB), num(tA), num(tD), num(tN)] }] }
  }
  if (type === 'loan-summary') {
    const rows = []
    let tAmt = 0; let tRem = 0
    Object.entries(hr.loans || {}).forEach(([empId, loans]) => { const e = hr.emps.find((x) => x.id === Number(empId)); loans.forEach((l) => { tAmt += l.amount; tRem += l.remaining; rows.push([e ? fullName(e) : empId, l.comment || '—', num(l.amount), num(l.installmentAmount), num(l.remaining), l.status]) }) })
    return { title: 'Loan & Advance Ledger', filters: [['Loans', String(rows.length)], ['Issued', rs(tAmt)], ['Outstanding', rs(tRem)]],
      kpis: [{ label: 'Active Loans', value: rows.length, icon: 'fa-hand-holding-dollar', cls: 'amber' }, { label: 'Total Issued', value: rs(tAmt), icon: 'fa-arrow-up', cls: 'info' }, { label: 'Outstanding', value: rs(tRem), icon: 'fa-clock', cls: 'red' }],
      sections: [{ columns: [C('Employee'), C('Purpose'), C('Amount', 'r'), C('Installment', 'r'), C('Outstanding', 'r'), C('Status')], rows, totals: ['', 'TOTAL', num(tAmt), '', num(tRem), ''] }] }
  }
  if (type === 'dept-summary') {
    let tHead = 0; let tCost = 0
    const rows = hr.depts.map((d) => { const es = hr.emps.filter((e) => e.dId === d.id && e.status === 'Active'); const cost = es.reduce((a, e) => a + netPay(e), 0); const desigCount = hr.desigs.filter((x) => x.dId === d.id).length; tHead += es.length; tCost += cost; return [d.name, es.length, desigCount, num(cost)] })
    return { title: 'Department Summary', filters: [['Departments', String(hr.depts.length)], ['Total Staff', String(tHead)], ['Monthly Cost', rs(tCost)]],
      kpis: [{ label: 'Departments', value: hr.depts.length, icon: 'fa-building', cls: 'info' }, { label: 'Active Staff', value: tHead, icon: 'fa-users', cls: 'green' }, { label: 'Monthly Salary Cost', value: rs(tCost), icon: 'fa-sack-dollar', cls: 'amber' }],
      sections: [{ columns: [C('Department'), C('Headcount', 'c'), C('Designations', 'c'), C('Monthly Salary Cost', 'r')], rows, totals: ['TOTAL', tHead, '', num(tCost)] }] }
  }
  if (type === 'leave-register') {
    const list = hr.emps.filter((e) => e.status === 'Active')
    return { title: 'Leave & Attendance Register', filters: [['Employees', String(list.length)]],
      kpis: [{ label: 'Employees', value: list.length, icon: 'fa-users', cls: 'info' }],
      sections: [{ columns: [C('Employee'), C('Annual', 'c'), C('Casual', 'c'), C('Sick', 'c'), C('Balance', 'c'), C('Policy'), C('Absent Ded', 'r'), C('Unpaid Ded', 'r')], rows: list.map((e) => [fullName(e), e.leaves?.annual ?? 0, e.leaves?.casual ?? 0, e.leaves?.sick ?? 0, e.leaves?.balance ?? 0, e.leaves?.policy || '—', num(e.leaves?.absentDed), num(e.leaves?.unpaidDed)]), totals: null }] }
  }
  // payroll-summary
  const list = hr.emps.filter((e) => e.status === 'Active')
  const recOf = (id) => hr.payroll[`${id}-${ctrl.year}-${ctrl.month}`] || { status: 'pending' }
  let tN = 0; let paid = 0
  const rows = list.map((e, i) => { const r = recOf(e.id); const n = netPay(e); tN += n; if (r.status === 'paid') paid += n; const lbl = r.status === 'pending' ? 'Not Generated' : r.status.charAt(0).toUpperCase() + r.status.slice(1); return [i + 1, fullName(e), desigName(hr, e.desId), num(gross(e)), num(deductions(e)), num(n), lbl] })
  return { title: 'Payroll Summary Report', period: `${MONTHS[ctrl.month]} ${ctrl.year}`, filters: [['Period', `${MONTHS[ctrl.month]} ${ctrl.year}`], ['Employees', String(list.length)], ['Net Payroll', rs(tN)], ['Paid', rs(paid)]],
    kpis: [{ label: 'Net Payroll', value: rs(tN), icon: 'fa-money-bill-wave', cls: 'info' }, { label: 'Paid', value: rs(paid), icon: 'fa-circle-check', cls: 'green' }, { label: 'Outstanding', value: rs(tN - paid), icon: 'fa-clock', cls: 'red' }],
    sections: [{ columns: [C('#', 'c'), C('Employee'), C('Designation'), C('Gross', 'r'), C('Deductions', 'r'), C('Net Payable', 'r'), C('Status')], rows, totals: ['', '', 'TOTAL', '', '', num(tN), ''] }] }
}

/* ════════ A4 BRANDED PRINT ════════ */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

function printSalarySlip(e, hr, onToast, period) {
  const chain = loadChainProfile()
  const allow = (e.salaryHeads || []).filter((h) => h.type === 'allow')
  const ded = (e.salaryHeads || []).filter((h) => h.type === 'deduct')
  const rows = (arr, sign) => arr.map((h) => `<tr><td>${esc(h.name)}</td><td style="text-align:right">${sign}${num(h.amount)}</td></tr>`).join('')
  const report = {
    title: 'Salary Slip', period: period || '',
    filters: [['Employee', fullName(e)], ['ID', e.eid], ['Department', deptName(hr, e.dId)], ['Designation', desigName(hr, e.desId)]],
    sections: [{ columns: [{ label: 'Earnings', a: 'l' }, { label: 'Amount (Rs)', a: 'r' }], rows: [['Basic Salary', num(e.basicSalary)], ...allow.map((h) => [h.name, num(h.amount)]), ['Gross Pay', num(gross(e))]], totals: null },
      { title: 'Deductions', columns: [{ label: 'Deduction', a: 'l' }, { label: 'Amount (Rs)', a: 'r' }], rows: ded.length ? ded.map((h) => [h.name, num(h.amount)]) : [['—', '0']], totals: ['Net Payable', num(netPay(e))] }],
  }
  void rows
  printHrReport(report, onToast)
}

function printPayHistory(e, hr, onToast) {
  const recs = Object.entries(hr.payroll).filter(([k]) => k.startsWith(`${e.id}-`)).map(([, r]) => r)
    .sort((a, b) => (a.year - b.year) || (MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month)))
  let tN = 0; let tP = 0
  const rows = recs.map((r, i) => { const paid = (r.payments || []).reduce((a, p) => a + Number(p.amount || 0), 0); tN += r.netPayable || 0; tP += paid; return [i + 1, `${r.month} ${r.year}`, num(r.totalGross), num(r.totalDeductions), num(r.netPayable), num(paid), payStatus(r).label] })
  printHrReport({
    title: 'Pay History Ledger', period: `${recs.length} payroll record(s)`,
    filters: [['Employee', fullName(e)], ['ID', e.eid], ['Designation', desigName(hr, e.desId)], ['Net Total', rs(tN)]],
    sections: [{ columns: [{ label: '#', a: 'c' }, { label: 'Month', a: 'l' }, { label: 'Gross', a: 'r' }, { label: 'Deductions', a: 'r' }, { label: 'Net Payable', a: 'r' }, { label: 'Paid', a: 'r' }, { label: 'Status', a: 'l' }], rows, totals: ['', 'TOTAL', '', '', num(tN), num(tP), ''] }],
  }, onToast)
}

function printLoanStatement(e, hr, onToast) {
  const loans = empLoans(hr, e.id)
  const sections = loans.length ? loans.map((l) => ({
    title: `Loan #${l.loanNumber} · ${l.comment} · ${l.status === 'active' ? 'Active' : 'Returned'}`,
    columns: [{ label: 'Date', a: 'l' }, { label: 'Type', a: 'l' }, { label: 'Amount', a: 'r' }, { label: 'Comment', a: 'l' }],
    rows: [[fmtDate(l.createdAt), 'Loan Issued', num(l.amount), `${l.repaymentType}${l.installmentType ? ` (${l.installmentType})` : ''}`], ...(l.received || []).map((r) => [fmtDate(r.date), 'Repayment', `-${num(r.amount)}`, r.comment || '—'])],
    totals: ['', 'Remaining', num(l.remaining), ''],
  })) : [{ columns: [{ label: 'Info', a: 'l' }], rows: [], totals: null }]
  printHrReport({
    title: 'Loan / Advance Account Statement', period: `${loans.length} loan(s)`,
    filters: [['Employee', fullName(e)], ['ID', e.eid], ['Outstanding', rs(loanRemaining(hr, e.id))], ['Returned', rs(loanTotalReturned(hr, e.id))]],
    sections,
  }, onToast)
}

function printHrReport(report, onToast) {
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
function Shell({ title, sub, icon, maxWidth, foot, children, onClose }) {
  return createPortal(
    <div className="pay-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pay-modal" style={{ maxWidth: maxWidth || 600 }}>
        <div className="pay-modal-hdr">
          <div className="pay-modal-av"><i className={`fa-solid ${icon}`} /></div>
          <div><div className="pay-modal-title">{title}</div>{sub && <div className="pay-modal-sub">{sub}</div>}</div>
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
