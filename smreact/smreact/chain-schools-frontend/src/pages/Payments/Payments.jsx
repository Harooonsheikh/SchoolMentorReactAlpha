import { useCallback, useEffect, useMemo, useState } from 'react'
import TutorialButton from '../../components/TutorialButton'
import { createPortal } from 'react-dom'
import {
  toPaymentRows,
  monthlyCharge, PKR, todayPlus, PAY_METHODS, royaltyCount,
  MONTHS, monthLabel, monthStart, monthEnd, monthDay, challanYears,
} from './data'
import { useView } from '../../config/viewContext'
import {
  fetchSetupEach, saveSetup as saveSetupApi, deleteSetup as deleteSetupApi, fetchBranchClasses,
  fetchChallansEach, saveChallan as saveChallanApi, deleteChallan as deleteChallanApi,
  fetchReceivingsEach, saveReceiving as saveReceivingApi, deleteReceiving as deleteReceivingApi,
} from '../../api/schoolPaymentsApi'
import { loadChainProfile, chainInitials } from '../../config/chainProfile'
import './Payments.css'

const USERS = ['Dua Rizvi', 'Neha Bukhari', 'Nimra Fatima']

const totalDuesFor = (school, setup, challan) => (challan ? challan.total : monthlyCharge(school, setup))

function paymentStatus(setup, recv, totalDues) {
  if (!setup) return { key: 'no-setup', label: 'No Setup', cls: 'b-gray' }
  const received = recv?.receivedAmount || 0
  const remaining = recv ? recv.remainingAmount : totalDues
  if (received > 0 && remaining <= 0) return { key: 'paid', label: 'Paid', cls: 'b-green' }
  if (received > 0 && remaining > 0) return { key: 'partial', label: 'Partial', cls: 'b-warn' }
  return { key: 'unpaid', label: 'Unpaid', cls: 'b-red' }
}

/* Chune hue mahine ke liye challan ki tareekhein.
   Mojooda mahina ho to aaj se (challan aaj hi jari ho raha hai), guzra ya
   aane wala mahina ho to us mahine ki 1 aur 10 tareekh — dono soorton me
   tareekhein usi mahine ke andar rehti hain jis ka challan ban raha hai. */
function monthDates(m, y) {
  const now = new Date()
  if (m === now.getMonth() + 1 && y === now.getFullYear()) return { issue: todayPlus(0), due: todayPlus(7) }
  return { issue: monthStart(m, y), due: monthDay(m, y, 10) }
}

const FormulaBadge = ({ setup }) => {
  if (!setup) return <span className="badge b-gray">No Setup</span>
  if (setup.formula === 'lumpsum') return <span className="badge b-blue"><i className="fa-solid fa-money-bill-wave" style={{ fontSize: 8 }} /> Lump Sum</span>
  if (setup.formula === 'percentage') return <span className="badge b-purple"><i className="fa-solid fa-percent" style={{ fontSize: 8 }} /> Percentage</span>
  return <span className="badge b-green"><i className="fa-solid fa-user-graduate" style={{ fontSize: 8 }} /> Per Student</span>
}

export default function Payments() {
  /* Network me shamil ho chuke schools — Chain-Management API se, wahi source
     jo School Permissions / School Progress use karte hain. */
  const { schools: connectedSchools, schoolsLoading, schoolsError } = useView()
  const schools = useMemo(() => toPaymentRows(connectedSchools), [connectedSchools])

  const [tab, setTab] = useState('setup')
  const [setupStore, setSetupStore] = useState({})
  /* Setup har branch par alag call se aata hai, is liye table pehle render
     hoti hai aur rows jaise jaise jawab aate hain bharti jaati hain. Jab tak
     kisi branch ka jawab nahi aaya, usay "Pending" dikhana ghalat hoga — is
     liye counts sirf un schools ke ginte hain jin ka jawab aa chuka hai. */
  const [setupLoaded, setSetupLoaded] = useState({})
  const [chLoaded, setChLoaded] = useState({})
  const [recvLoaded, setRecvLoaded] = useState({})
  /* Har branch ke SAARE challans (mahine ke hisaab se). Screen aik waqt me
     aik hi mahina dikhati hai — wo chhantai neeche chStore me hoti hai. */
  const [chAll, setChAll] = useState({})

  /* Kaunsa mahina zer-e-nazar hai. month/year dropdowns ki mojooda value hai,
     `applied` wo jo "Load" dabane par lagi — ERP ke Fee Challans jaisa, taake
     dropdown chhoote hi table apne aap na hile. */
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [applied, setApplied] = useState({ month: now.getMonth() + 1, year: now.getFullYear() })
  const [loadingMonth, setLoadingMonth] = useState(false)
  /* Wasooli bhi challan ki tarah mahine ke hisaab se hai — har branch ki
     saari rows yahan, zer-e-nazar mahine ki row neeche recvStore me. */
  const [recvAll, setRecvAll] = useState({})
  const [toast, setToast] = useState(null)
  const [expanded, setExpanded] = useState({})

  const [setupQ, setSetupQ] = useState(''); const [setupFilter, setSetupFilter] = useState('')
  const [chQ, setChQ] = useState(''); const [chFilter, setChFilter] = useState('')
  const [recvQ, setRecvQ] = useState(''); const [recvUser, setRecvUser] = useState('')
  const [rptTab, setRptTab] = useState('summary'); const [rptQ, setRptQ] = useState(''); const [rptStatus, setRptStatus] = useState('')

  const [setupModal, setSetupModal] = useState(null)
  const [genModal, setGenModal] = useState(null)
  const [bulkModal, setBulkModal] = useState(false)
  const [recvModal, setRecvModal] = useState(null)
  const [confirm, setConfirm] = useState(null)

  /* Warn/error me aksar batana hota hai ke "pehle challan hatao" — 3 second
     me wo padha hi nahi jaata, is liye un ko zyada waqt milta hai. */
  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(null), toast.type === 'warn' ? 7000 : 3000)
    return () => clearTimeout(t)
  }, [toast])

  /* Har connected school ka payment setup aur mojooda challan — table render
     hone ke baad, dono background me. Ye per-branch calls hain (dono APIs aik
     waqt me aik hi branch deti hain), is liye 12 at a time. */
  useEffect(() => {
    const ids = schools.map((s) => s.id).filter(Boolean)
    if (!ids.length) return undefined
    let alive = true
    fetchSetupEach(ids, (id, setup) => {
      if (!alive) return
      setSetupStore((m) => ({ ...m, [id]: setup }))
      setSetupLoaded((m) => ({ ...m, [id]: true }))
    })
    fetchChallansEach(ids, (id, rows) => {
      if (!alive) return
      setChAll((m) => ({ ...m, [id]: rows }))
      setChLoaded((m) => ({ ...m, [id]: true }))
    })
    fetchReceivingsEach(ids, (id, rows) => {
      if (!alive) return
      setRecvAll((m) => ({ ...m, [id]: rows }))
      setRecvLoaded((m) => ({ ...m, [id]: true }))
    })
    return () => { alive = false }
  }, [schools])

  /* Zer-e-nazar mahine ka challan — poori screen (table, receiving, reports,
     slips) isi aik row par chalti hai, is liye chhantai yahin aik jagah. */
  const chStore = useMemo(() => {
    const out = {}
    Object.entries(chAll).forEach(([id, rows]) => {
      out[id] = (rows || []).find((c) => c.month === applied.month && c.year === applied.year) || null
    })
    return out
  }, [chAll, applied])

  const recvStore = useMemo(() => {
    const out = {}
    Object.entries(recvAll).forEach(([id, rows]) => {
      out[id] = (rows || []).find((r) => r.month === applied.month && r.year === applied.year) || null
    })
    return out
  }, [recvAll, applied])

  /* ── Pichla baqaya ──
     Zer-e-nazar mahine se PEHLE jitna charge hua, minus jitna wasool ya
     maaf hua. Bas — har mahine ka apna baqaya alag jama NAHI kiya jaata.

     WAJAH (yahin ek bug tha): challan ka `total` apne andar pichla baqaya
     bhi rakhta hai. August 12k, phir September ka challan 12k + 12k carry =
     24k. Dono ke total jama karne par 36k banta tha, jabke asal baqaya 24k
     hai — carry do dafa gin liya jaata tha. Is liye hisaab sirf har mahine
     ke APNE charge (`amount`) par hota hai, total par nahi.

     Yehi raqam Generate modal ke "Previous Dues" me khud bhar jaati hai. */
  const pendingBefore = useCallback((id, m, y) => {
    const cutoff = (Number(y) * 12) + Number(m)
    const before = (row) => row.month && (row.year * 12 + row.month) < cutoff

    const billed = (chAll[id] || [])
      .filter(before)
      .reduce((sum, c) => sum + (c.amount || 0), 0)

    /* Discount bhi baqaya kam karta hai — wo raqam ab kabhi wasool nahi hogi. */
    const settled = (recvAll[id] || [])
      .filter(before)
      .reduce((sum, r) => sum + (r.receivedAmount || 0) + (r.discount || 0), 0)

    return Math.max(0, billed - settled)
  }, [chAll, recvAll])

  /* "Load" — chune hue mahine ke challans aur wasooliyan taza padho. Rows API
     se dobara aati hain, warna dusre tab me bani row yahan nazar na aati. */
  const loadMonth = async () => {
    setApplied({ month, year })
    const ids = schools.map((s) => s.id).filter(Boolean)
    if (!ids.length) return
    setLoadingMonth(true)
    setChLoaded({}); setRecvLoaded({})
    await Promise.all([
      fetchChallansEach(ids, (id, rows) => {
        setChAll((m) => ({ ...m, [id]: rows }))
        setChLoaded((m) => ({ ...m, [id]: true }))
      }),
      fetchReceivingsEach(ids, (id, rows) => {
        setRecvAll((m) => ({ ...m, [id]: rows }))
        setRecvLoaded((m) => ({ ...m, [id]: true }))
      }),
    ])
    setLoadingMonth(false)
    fire(`Loaded ${monthLabel(month, year)} challans`, 'info')
  }

  /* Dropdowns aur table dono ko aik hi mahine par le aana. */
  const showMonth = (m, y) => { setMonth(m); setYear(y); setApplied({ month: m, year: y }) }

  const fire = (text, type = 'success') => setToast({ text, type })
  const toggleExpand = (key) => setExpanded((e) => ({ ...e, [key]: !e[key] }))

  /* ── stats ──
     "Pending" sirf un schools ka ginte hain jin ka jawab aa chuka hai, warna
     load hote waqt har school lamha bhar ke liye pending dikhta. */
  const stats = useMemo(() => {
    const total = schools.length
    const answered = schools.filter((s) => setupLoaded[s.id])
    const done = answered.filter((s) => setupStore[s.id]).length
    const revenue = schools.reduce((sum, s) => sum + monthlyCharge(s, setupStore[s.id]), 0)
    return { total, done, pending: answered.length - done, revenue }
  }, [schools, setupStore, setupLoaded])

  /* ── actions ── */
  const [savingSetup, setSavingSetup] = useState(false)
  const [deletingSetup, setDeletingSetup] = useState(false)

  const saveSetupFor = async (id, setup) => {
    const name = schools.find((s) => s.id === id)?.name || 'school'
    setSavingSetup(true)
    try {
      /* id sath bhejna zaroori hai: mojood ho to `update`, warna `insert`. */
      const saved = await saveSetupApi(id, { ...setup, id: setupStore[id]?.id || 0 })
      setSetupStore((m) => ({ ...m, [id]: saved }))
      setSetupLoaded((m) => ({ ...m, [id]: true }))
      setSetupModal(null)
      fire(`Payment setup saved for ${name}`)
    } catch (err) {
      fire(err?.message || `Could not save payment setup for ${name}`, 'warn')
    } finally {
      setSavingSetup(false)
    }
  }

  const removeSetupFor = async (id) => {
    const name = schools.find((s) => s.id === id)?.name || 'school'
    setDeletingSetup(true)
    try {
      await deleteSetupApi(id, setupStore[id])
      setSetupStore((m) => ({ ...m, [id]: null }))
      setConfirm(null)
      fire(`Payment setup removed for ${name}`, 'info')
    } catch (err) {
      /* Nakaam hone par dialog khula rehta hai — user dobara koshish kar sake. */
      fire(err?.message || 'Could not remove payment setup', 'warn')
    } finally {
      setDeletingSetup(false)
    }
  }
  /* Challan setup ke bagair nahi banta — uski `paymentID` hi ledger row ko
     school ke billing setup se jorti hai. */
  const [genBusy, setGenBusy] = useState(false)
  const [deletingCh, setDeletingCh] = useState(false)

  /* Taza challan list me chala jaata hai: usi id wali row badal jaati hai,
     warna nayi row aage lag jaati hai. `null` ka matlab wo row hat gayi. */
  const putChallan = (id, challan, removedId = 0) => {
    setChAll((m) => {
      const rows = (m[id] || []).filter((c) => c.id !== (challan?.id || removedId))
      return { ...m, [id]: challan ? [challan, ...rows] : rows }
    })
    setChLoaded((m) => ({ ...m, [id]: true }))
  }

  /* Chune hue mahine ka pehle se bana challan — dobara generate karne par
     wahi row update hoti hai, naya row nahi banta. */
  const challanOf = (id, m, y) => (chAll[id] || []).find((c) => c.month === m && c.year === y) || null

  const generateChallan = async (id, prevDues, dueDate, issueDate, month, year) => {
    const s = schools.find((x) => x.id === id)
    const setup = setupStore[id]
    if (!setup?.id) return fire('This school has no payment setup yet', 'warn')
    setGenBusy(true)
    try {
      const saved = await saveChallanApi(id, {
        paymentID: setup.id,
        amount: monthlyCharge(s, setup),
        prevDues,
        dueDate,
        createdOn: issueDate,
        month,
        year,
        existingId: challanOf(id, month, year)?.id || 0,
      })
      putChallan(id, saved)
      /* Table usi mahine par aa jaati hai jis ka challan abhi bana — warna
         naya challan kisi aur mahine ke filter ke peeche chhup jaata. */
      showMonth(month, year)
      setGenModal(null)
      fire(`Challan generated for ${monthLabel(month, year)}`)
    } catch (err) {
      fire(err?.message || 'Could not generate challan', 'warn')
    } finally {
      setGenBusy(false)
    }
    return undefined
  }

  const bulkGenerate = async (ids, dueDate, issueDate, month, year) => {
    if (!ids.length) return fire('No schools selected', 'info')
    setGenBusy(true)
    /* Sirf wahi schools jo modal me select kiye gaye — `ids` wahi set hai.
       Har school apni call: aik ki nakami baqi ko nahi rokti, is liye
       allSettled, aur aakhir me ginti ke sath sach bataya jaata hai. */
    const results = await Promise.allSettled(ids.map(async (id) => {
      const s = schools.find((x) => x.id === id)
      const setup = setupStore[id]
      if (!setup?.id) throw new Error('no setup')
      const saved = await saveChallanApi(id, {
        paymentID: setup.id,
        amount: monthlyCharge(s, setup),
        prevDues: challanOf(id, month, year)?.prevDues || 0,
        dueDate,
        createdOn: issueDate,
        month,
        year,
        existingId: challanOf(id, month, year)?.id || 0,
      })
      return { id, saved }
    }))
    results.forEach((r) => { if (r.status === 'fulfilled') putChallan(r.value.id, r.value.saved) })
    showMonth(month, year)
    setGenBusy(false)
    setBulkModal(false)
    const ok = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.length - ok
    fire(
      failed
        ? `${ok} challan${ok !== 1 ? 's' : ''} generated for ${monthLabel(month, year)}, ${failed} failed`
        : `${ok} challan${ok !== 1 ? 's' : ''} generated for ${monthLabel(month, year)}`,
      failed ? 'warn' : 'success',
    )
    return undefined
  }

  const delChallan = async (id) => {
    setDeletingCh(true)
    try {
      const gone = chStore[id]
      await deleteChallanApi(gone)
      putChallan(id, null, gone?.id || 0)
      setConfirm(null)
      fire('Challan deleted', 'info')
    } catch (err) {
      fire(err?.message || 'Could not delete challan', 'warn')
    } finally {
      setDeletingCh(false)
    }
  }
  const [recvBusy, setRecvBusy] = useState(false)
  const [deletingRecv, setDeletingRecv] = useState(false)

  /* putChallan jaisa hi — usi id wali row badal jaati hai, warna nayi row
     aage lag jaati hai; `null` matlab row hat gayi. */
  const putRecv = (id, recv, removedId = 0) => {
    setRecvAll((m) => {
      const rows = (m[id] || []).filter((r) => r.id !== (recv?.id || removedId))
      return { ...m, [id]: recv ? [recv, ...rows] : rows }
    })
    setRecvLoaded((m) => ({ ...m, [id]: true }))
  }

  const recordReceiving = async (id, payload) => {
    setRecvBusy(true)
    try {
      /* Challan aur setup ki ids sath jaati hain — wasooli inhi se juri hai.
         Mahina zer-e-nazar wala hi lagta hai (adaigi ki tareekh ka nahi):
         August ka challan September me wasool ho to bhi wo August ki wasooli
         hai. Usi mahine ki purani row ho to wahi update hoti hai. */
      const saved = await saveReceivingApi(id, {
        ...payload,
        month: applied.month,
        year: applied.year,
        id: recvStore[id]?.id || 0,
        schoolPaymentID: setupStore[id]?.id || 0,
        paymentLedgerID: chStore[id]?.id || 0,
      })
      putRecv(id, saved)
      setRecvModal(null)
      fire('Payment recorded successfully')
    } catch (err) {
      fire(err?.message || 'Could not record payment', 'warn')
    } finally {
      setRecvBusy(false)
    }
  }

  const delRecv = async (id) => {
    setDeletingRecv(true)
    try {
      const gone = recvStore[id]
      await deleteReceivingApi(gone)
      putRecv(id, null, gone?.id || 0)
      setConfirm(null)
      fire('Receiving record deleted', 'info')
    } catch (err) {
      fire(err?.message || 'Could not delete receiving record', 'warn')
    } finally {
      setDeletingRecv(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon" style={{ background: 'linear-gradient(135deg,#0369A1,#0284C7)' }}><i className="fa-solid fa-credit-card" /></div>
          <div>
            <div className="page-title">School Payment</div>
            <div className="page-sub">Manage payment setup, challan generation, fee receiving, and financial reports for all schools.</div>
          </div>
        </div>
        <TutorialButton />
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <StatCard icon="fa-school" val={stats.total} lbl="Total Schools" />
        <StatCard cls="s-green" icon="fa-circle-check" val={stats.done} lbl="Setup Done" />
        <StatCard cls="s-warn" icon="fa-hourglass-half" val={stats.pending} lbl="Pending Setup" />
        <StatCard cls="s-info" icon="fa-money-bill-wave" val={(stats.revenue / 1000).toFixed(1)} lbl="Monthly Revenue (K)" iconBg="linear-gradient(135deg,#0369A1,#0284C7)" />
      </div>

      <div className="pay-tabs">
        {[['setup', 'fa-gear', 'Payment Setup'], ['challans', 'fa-file-invoice', 'Challans'], ['receiving', 'fa-hand-holding-dollar', 'Receiving'], ['report', 'fa-chart-bar', 'Reports']].map(([k, icon, label]) => (
          <button key={k} className={`pay-tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}><i className={`fa-solid ${icon}`} /> {label}</button>
        ))}
      </div>

      {/* ── SETUP ── */}
      {tab === 'setup' && (
        <div className="ss-panel">
          <div className="section-card">
            <div className="card-header">
              <div><div className="card-title"><i className="fa-solid fa-gear" /> Payment Setup</div><div className="card-sub">Configure billing formula (Lump Sum or Per Student) for each school.</div></div>
              <div className="pay-cardhdr-actions">
                <div className="search-box" style={{ width: 220 }}><i className="fa-solid fa-magnifying-glass" /><input className="search-input" placeholder="Search schools…" value={setupQ} onChange={(e) => setSetupQ(e.target.value)} /></div>
                <select className="f-input" style={{ width: 150, height: 38 }} value={setupFilter} onChange={(e) => setSetupFilter(e.target.value)}>
                  <option value="">All Status</option><option value="done">Setup Done</option><option value="pending">Pending</option>
                </select>
              </div>
            </div>
            <div className="tbl-wrap">
              <table className="pay-table">
                <thead><tr><th>#</th><th>Branch Name</th><th>Formula</th><th>Free Trial</th><th style={{ textAlign: 'center' }}>Monthly Charge</th><th style={{ textAlign: 'center' }}>Status</th><th style={{ textAlign: 'center' }}>Action</th><th style={{ textAlign: 'center' }}>Details</th></tr></thead>
                <tbody>
                  {schoolsLoading ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 28, color: 'var(--tm)' }}>
                      <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />Loading schools…
                    </td></tr>
                  ) : schoolsError ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 28, color: 'var(--err)' }}>
                      <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 8 }} />{schoolsError}
                    </td></tr>
                  ) : schools.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 28, color: 'var(--tm)' }}>
                      <i className="fa-solid fa-circle-info" style={{ marginRight: 8 }} />No connected schools in this network yet.
                    </td></tr>
                  ) : schools.filter((s) => {
                    const q = setupQ.trim().toLowerCase()
                    if (q && !s.name.toLowerCase().includes(q) && !(s.principal || '').toLowerCase().includes(q)) return false
                    if (setupFilter === 'done' && !setupStore[s.id]) return false
                    if (setupFilter === 'pending' && setupStore[s.id]) return false
                    return true
                  }).map((s, i) => {
                    const setup = setupStore[s.id]; const charge = monthlyCharge(s, setup)
                    const open = expanded[`ps-${s.id}`]
                    return (
                      <FragmentRows key={s.id} open={open} detail={<SetupDetail s={s} setup={setup} />} colSpan={8}>
                        <td data-label="#" style={{ color: 'var(--tm)', fontWeight: 700 }}>{i + 1}</td>
                        <td data-label="Branch"><div style={{ fontWeight: 700, color: 'var(--t1)' }}>{s.name}</div><div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 2 }}>{s.principal} · {s.contact}</div></td>
                        <td data-label="Formula"><FormulaBadge setup={setup} /></td>
                        <td data-label="Free Trial">{setup?.freeTrial && setup?.trialDays ? <span className="badge b-blue" style={{ fontSize: 9.5 }}><i className="fa-solid fa-gift" style={{ fontSize: 8 }} /> {setup.trialDays}d trial</span> : '—'}</td>
                        <td data-label="Monthly" style={{ textAlign: 'center' }}>{!setup ? '—' : setup.formula === 'percentage' ? <><span style={{ fontWeight: 800, color: '#7C3AED' }}>{PKR(charge)}</span><div style={{ fontSize: 10, color: 'var(--tm)' }}>royalty · {royaltyCount(setup)} head{royaltyCount(setup) !== 1 ? 's' : ''}</div></> :<><span style={{ fontWeight: 800, color: 'var(--t1)' }}>{PKR(charge)}</span><div style={{ fontSize: 10, color: 'var(--tm)' }}>/ month</div></>}</td>
                        <td data-label="Status" style={{ textAlign: 'center' }}>{!setupLoaded[s.id] ? <span className="badge b-gray"><i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 8 }} /> Loading</span> : setup ? <span className="badge ps-badge-setup"><i className="fa-solid fa-circle-check" style={{ fontSize: 8 }} /> Set Up</span> : <span className="badge ps-badge-pending"><i className="fa-solid fa-hourglass-half" style={{ fontSize: 8 }} /> Pending</span>}</td>
                        <td data-label="Action" style={{ textAlign: 'center' }}>
                          <div className="ch-actions" style={{ justifyContent: 'center' }}>
                            <button className="btn-sm" style={{ height: 30 }} disabled={!setupLoaded[s.id]} onClick={() => setSetupModal(s.id)}><i className={`fa-solid ${setup ? 'fa-pen' : 'fa-plus'}`} /> {setup ? 'Edit' : 'Set Up'}</button>
                            <button className="ch-btn ch-btn-del" disabled={!setup} title={setup ? 'Remove payment setup' : ''} onClick={() => setConfirm({ kind: 'delSetup', id: s.id, name: s.name })}><i className="fa-solid fa-trash-can" /></button>
                          </div>
                        </td>
                        <td data-label="Details" style={{ textAlign: 'center' }}><button className="det-btn" onClick={() => toggleExpand(`ps-${s.id}`)}><i className="fa-solid fa-chevron-down" /></button></td>
                      </FragmentRows>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── CHALLANS ── */}
      {tab === 'challans' && (
        <div className="ss-panel">
          <div className="section-card">
            <div className="card-header">
              <div><div className="card-title"><i className="fa-solid fa-file-invoice" /> Challans</div><div className="card-sub">Generate, download, and delete fee challans for each school — showing <strong>{monthLabel(applied.month, applied.year)}</strong>.</div></div>
              <div className="pay-cardhdr-actions">
                <div className="search-box" style={{ width: 200 }}><i className="fa-solid fa-magnifying-glass" /><input className="search-input" placeholder="Search schools…" value={chQ} onChange={(e) => setChQ(e.target.value)} /></div>
                <select className="f-input" style={{ width: 120, height: 38 }} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <select className="f-input" style={{ width: 92, height: 38 }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {challanYears().map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <button className="btn-secondary" style={{ height: 38 }} disabled={loadingMonth} onClick={loadMonth} title="Load challans for the selected month and year">
                  <i className={`fa-solid ${loadingMonth ? 'fa-spinner fa-spin' : 'fa-filter'}`} /> {loadingMonth ? 'Loading…' : 'Load'}
                </button>
                <select className="f-input" style={{ width: 150, height: 38 }} value={chFilter} onChange={(e) => setChFilter(e.target.value)}>
                  <option value="">All Schools</option><option value="generated">Challan Generated</option><option value="pending">Not Generated</option>
                </select>
                <button className="btn-primary" onClick={() => setBulkModal(true)}><i className="fa-solid fa-bolt" /> Generate in Bulk</button>
              </div>
            </div>
            <div className="tbl-wrap">
              <table className="pay-table">
                <thead><tr><th>#</th><th>Branch Name</th><th>Formula</th><th style={{ textAlign: 'center' }}>Monthly Amount</th><th style={{ textAlign: 'center' }}>Challan Status</th><th style={{ textAlign: 'center' }}>Actions</th></tr></thead>
                <tbody>
                  {schoolsLoading ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--tm)' }}>
                      <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />Loading schools…
                    </td></tr>
                  ) : schoolsError ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--err)' }}>
                      <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 8 }} />{schoolsError}
                    </td></tr>
                  ) : schools.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--tm)' }}>
                      <i className="fa-solid fa-circle-info" style={{ marginRight: 8 }} />No connected schools in this network yet.
                    </td></tr>
                  ) : schools.filter((s) => {
                    const q = chQ.trim().toLowerCase()
                    if (q && !s.name.toLowerCase().includes(q) && !(s.principal || '').toLowerCase().includes(q)) return false
                    if (chFilter === 'generated' && !chStore[s.id]) return false
                    if (chFilter === 'pending' && chStore[s.id]) return false
                    return true
                  }).map((s, i) => {
                    const setup = setupStore[s.id]; const challan = chStore[s.id]; const monthly = monthlyCharge(s, setup)
                    return (
                      <tr key={s.id}>
                        <td data-label="#" style={{ color: 'var(--tm)', fontWeight: 700 }}>{i + 1}</td>
                        <td data-label="Branch"><div style={{ fontWeight: 700, color: 'var(--t1)' }}>{s.name}</div><div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 2 }}>{s.principal}</div></td>
                        <td data-label="Formula"><FormulaBadge setup={setup} /></td>
                        <td data-label="Amount" style={{ textAlign: 'center' }}>{setup ? <><div style={{ fontWeight: 800, color: 'var(--t1)' }}>{PKR(monthly)}</div><div style={{ fontSize: 10, color: 'var(--tm)' }}>/ month</div></> : '—'}</td>
                        <td data-label="Status" style={{ textAlign: 'center' }}>{!chLoaded[s.id] ? <span className="badge b-gray"><i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 8 }} /> Loading</span> : challan ? <div><span className="badge b-green"><i className="fa-solid fa-circle-check" style={{ fontSize: 8 }} /> Generated</span><div style={{ fontSize: 10, color: 'var(--tm)', marginTop: 3 }}>Issued: {challan.createdOn || '—'}</div><div style={{ fontSize: 10, color: 'var(--tm)' }}>Due: {challan.dueDate || '—'}</div></div> : <span className="badge b-gray"><i className="fa-solid fa-clock" style={{ fontSize: 8 }} /> Not Generated</span>}</td>
                        <td data-label="Actions" style={{ textAlign: 'center' }}>
                          <div className="ch-actions" style={{ justifyContent: 'center' }}>
                            <button className="ch-btn ch-btn-gen" disabled={!setup || !chLoaded[s.id] || genBusy || !!challan} title={!setup ? 'Set up payment first' : challan ? 'Challan already generated — delete it first to generate a new one' : ''} onClick={() => setGenModal(s.id)}><i className="fa-solid fa-file-invoice-dollar" /> Generate</button>
                            <button className="ch-btn ch-btn-dl" disabled={!challan} onClick={() => openSlip(challanSlipHTML(s, challan, setup), fire)}><i className="fa-solid fa-download" /> Download</button>
                            <button className="ch-btn ch-btn-del" disabled={!challan} onClick={() => setConfirm({ kind: 'delChallan', id: s.id, name: s.name })}><i className="fa-solid fa-trash-can" /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── RECEIVING ── */}
      {tab === 'receiving' && (
        <div className="ss-panel">
          <div className="section-card">
            <div className="card-header">
              <div><div className="card-title"><i className="fa-solid fa-hand-holding-dollar" /> Receiving</div><div className="card-sub">Record and track fee receiving from schools — against the <strong>{monthLabel(applied.month, applied.year)}</strong> challan.</div></div>
              <div className="pay-cardhdr-actions">
                <select className="f-input" style={{ width: 160, height: 38 }} value={recvUser} onChange={(e) => setRecvUser(e.target.value)}>
                  <option value="">Select User or All</option>{USERS.map((u) => <option key={u}>{u}</option>)}
                </select>
                <div className="search-box" style={{ width: 200 }}><i className="fa-solid fa-magnifying-glass" /><input className="search-input" placeholder="Search schools…" value={recvQ} onChange={(e) => setRecvQ(e.target.value)} /></div>
                <select className="f-input" style={{ width: 120, height: 38 }} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <select className="f-input" style={{ width: 92, height: 38 }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {challanYears().map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <button className="btn-secondary" style={{ height: 38 }} disabled={loadingMonth} onClick={loadMonth} title="Load challans for the selected month and year">
                  <i className={`fa-solid ${loadingMonth ? 'fa-spinner fa-spin' : 'fa-filter'}`} /> {loadingMonth ? 'Loading…' : 'Load'}
                </button>
              </div>
            </div>
            <div className="tbl-wrap">
              <table className="pay-table">
                <thead><tr><th>#</th><th>Branch Name</th><th style={{ textAlign: 'center' }}>Total Dues</th><th style={{ textAlign: 'center' }}>Prev Remaining</th><th style={{ textAlign: 'center' }}>Receiving</th><th style={{ textAlign: 'center' }}>Remaining</th><th style={{ textAlign: 'center' }}>Download</th><th style={{ textAlign: 'center' }}>Delete</th><th style={{ textAlign: 'center' }}>Receiving</th><th style={{ textAlign: 'center' }}>Detail</th></tr></thead>
                <tbody>
                  {schoolsLoading ? (
                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: 28, color: 'var(--tm)' }}>
                      <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />Loading schools…
                    </td></tr>
                  ) : schoolsError ? (
                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: 28, color: 'var(--err)' }}>
                      <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 8 }} />{schoolsError}
                    </td></tr>
                  ) : schools.length === 0 ? (
                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: 28, color: 'var(--tm)' }}>
                      <i className="fa-solid fa-circle-info" style={{ marginRight: 8 }} />No connected schools in this network yet.
                    </td></tr>
                  ) : schools.filter((s) => { const q = recvQ.trim().toLowerCase(); return !q || s.name.toLowerCase().includes(q) || (s.principal || '').toLowerCase().includes(q) }).map((s, i) => {
                    const setup = setupStore[s.id]; const challan = chStore[s.id]; const recv = recvStore[s.id]
                    const totalDues = totalDuesFor(s, setup, challan)
                    /* Jo baqaya is mahine ke challan me aage laya gaya — wo
                       Total Dues me pehle se shaamil hai, is liye yahan wahi
                       raqam dikhti hai, dobara hisaab nahi hota. Challan na
                       bana ho to pichle mahinon ka bacha hua dikha dete hain. */
                    const prevRemaining = challan ? (challan.prevDues || 0) : pendingBefore(s.id, applied.month, applied.year)
                    const remaining = recv ? recv.remainingAmount : totalDues
                    const fmt = (v) => v === 0 ? <span className="dues-zero">0</span> : <span className="dues-pos">{Number(v).toLocaleString()}</span>
                    const open = expanded[`rv-${s.id}`]
                    return (
                      <FragmentRows key={s.id} open={open} detail={<RecvDetail s={s} setup={setup} challan={challan} recv={recv} />} colSpan={10}>
                        <td data-label="#" style={{ color: 'var(--tm)', fontWeight: 700 }}>{i + 1}</td>
                        <td data-label="Branch"><div style={{ fontWeight: 700, color: 'var(--t1)' }}>{s.name}</div><div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 2 }}>{s.principal}</div></td>
                        <td data-label="Total Dues" style={{ textAlign: 'center' }}>{fmt(totalDues)}</td>
                        <td data-label="Prev Remaining" style={{ textAlign: 'center' }}>{fmt(prevRemaining)}</td>
                        <td data-label="Receiving" style={{ textAlign: 'center' }}>{!recvLoaded[s.id] ? <i className="fa-solid fa-spinner fa-spin" style={{ color: 'var(--tm)', fontSize: 11 }} /> : recv ? <span style={{ color: 'var(--success)', fontWeight: 800 }}>{(recv.receivedAmount || 0).toLocaleString()}</span> : <span className="dues-zero">—</span>}</td>
                        <td data-label="Remaining" style={{ textAlign: 'center' }}>{fmt(remaining)}</td>
                        <td data-label="Download" style={{ textAlign: 'center' }}><button className="recv-btn recv-btn-dl" disabled={!recv} onClick={() => openSlip(recvSlipHTML(s, recv, challan, setup), fire)}><i className="fa-solid fa-download" /> Download</button></td>
                        <td data-label="Delete" style={{ textAlign: 'center' }}><button className="recv-btn recv-btn-del" disabled={!recv || deletingRecv} onClick={() => setConfirm({ kind: 'delRecv', id: s.id, name: s.name })}><i className="fa-solid fa-trash-can" /> Delete</button></td>
                        <td data-label="Receiving" style={{ textAlign: 'center' }}><button className="recv-btn recv-btn-recv" disabled={!recvLoaded[s.id] || !setup || !challan || recvBusy || (!!recv && remaining <= 0)} title={!setup ? 'Set up payment first' : !challan ? `Generate the ${monthLabel(applied.month, applied.year)} challan first` : (recv && remaining <= 0) ? 'Fully paid' : ''} onClick={() => setRecvModal(s.id)}><i className="fa-solid fa-hand-holding-dollar" /> Receiving</button></td>
                        <td data-label="Detail" style={{ textAlign: 'center' }}><button className="det-btn" onClick={() => toggleExpand(`rv-${s.id}`)}><i className="fa-solid fa-chevron-down" /></button></td>
                      </FragmentRows>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── REPORTS ── */}
      {tab === 'report' && (
        <ReportsTab schools={schools} setupStore={setupStore} chStore={chStore} recvStore={recvStore}
          month={month} setMonth={setMonth} year={year} setYear={setYear}
          applied={applied} loadMonth={loadMonth} loadingMonth={loadingMonth}
          rptTab={rptTab} setRptTab={setRptTab} q={rptQ} setQ={setRptQ} status={rptStatus} setStatus={setRptStatus} onToast={fire} />
      )}

      {/* ── MODALS ── */}
      {setupModal != null && <SetupModal school={schools.find((s) => s.id === setupModal)} setup={setupStore[setupModal]} saving={savingSetup} onClose={() => setSetupModal(null)} onSave={saveSetupFor} onToast={fire} />}
      {genModal != null && <GenModal school={schools.find((s) => s.id === genModal)} setup={setupStore[genModal]} busy={genBusy} defaultMonth={applied.month} defaultYear={applied.year} pendingFor={(m, y) => pendingBefore(genModal, m, y)} onClose={() => setGenModal(null)} onSave={generateChallan} onToast={fire} />}
      {bulkModal && <BulkGenModal schools={schools} setupStore={setupStore} chStore={chStore} busy={genBusy} defaultMonth={applied.month} defaultYear={applied.year} onClose={() => setBulkModal(false)} onGenerate={bulkGenerate} onToast={fire} />}
      {recvModal != null && <RecvModal school={schools.find((s) => s.id === recvModal)} setup={setupStore[recvModal]} challan={chStore[recvModal]} recv={recvStore[recvModal]} period={monthLabel(applied.month, applied.year)} busy={recvBusy} onClose={() => setRecvModal(null)} onSave={recordReceiving} onToast={fire} />}
      {confirm && <ConfirmDelete name={confirm.name} kind={confirm.kind} busy={deletingSetup || deletingCh || deletingRecv} onClose={() => setConfirm(null)} onConfirm={() => {
        if (confirm.kind === 'delSetup') return removeSetupFor(confirm.id)
        return confirm.kind === 'delChallan' ? delChallan(confirm.id) : delRecv(confirm.id)
      }} />}

      {toast && createPortal(
        <div className="ss-toast-wrap"><div className={`ss-toast ${toast.type}`}><i className={`fa-solid ${toast.type === 'success' ? 'fa-circle-check' : toast.type === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-info'}`} /> {toast.text}</div></div>,
        document.body,
      )}
    </>
  )
}

/* ── small bits ── */
function StatCard({ cls = '', icon, val, lbl, iconBg }) {
  return (
    <div className={`stat-card ${cls}`}>
      <div className="stat-icon" style={iconBg ? { background: iconBg } : undefined}><i className={`fa-solid ${icon}`} /></div>
      <div className="stat-val">{val}</div>
      <div className="stat-lbl">{lbl}</div>
    </div>
  )
}

/* A main row + an expandable detail row underneath. */
function FragmentRows({ open, detail, colSpan, children }) {
  return (
    <>
      <tr>{children}</tr>
      {open && <tr><td colSpan={colSpan} style={{ padding: 0 }}><div className="pay-expand-box">{detail}</div></td></tr>}
    </>
  )
}

function SetupDetail({ s, setup }) {
  if (!setup) return <div style={{ textAlign: 'center', padding: 16, color: 'var(--tm)', fontSize: 13 }}><i className="fa-solid fa-circle-info" style={{ marginRight: 6 }} />No payment setup configured yet. Click Set Up to begin.</div>
  if (setup.formula === 'percentage') {
    const applied = (setup.royaltyRows || []).filter((r) => Number(r.pct) > 0)
    return (
      <div>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}><i className="fa-solid fa-percent" style={{ marginRight: 6 }} />Royalty on Fee Heads</div>
        {applied.length === 0
          ? <div style={{ fontSize: 12.5, color: 'var(--tm)' }}>No royalty % applied to any fee head yet.</div>
          : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{applied.map((r, i) => (
            <span key={i} className="badge b-purple" style={{ fontSize: 11 }}>
              {r.headName}: {r.pct}%{r.headAmount > 0 ? ` · ${PKR(Math.round((r.headAmount * r.pct) / 100))}` : ''}
            </span>
          ))}</div>}
        {setup.notes && <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--t2)' }}><span style={{ fontWeight: 700, color: 'var(--tm)' }}>Notes: </span>{setup.notes}</div>}
      </div>
    )
  }
  const monthly = monthlyCharge(s, setup)
  return (
    <div className="psetup-detail-grid">
      <div className="psetup-detail-card"><div className="pdc-lbl">Formula</div><div className="pdc-val" style={{ fontSize: 13 }}>{setup.formula === 'lumpsum' ? 'Lump Sum' : 'Per Student'}</div></div>
      <div className="psetup-detail-card"><div className="pdc-lbl">Monthly Bill</div><div className="pdc-val">{PKR(monthly)}</div></div>
      <div className="psetup-detail-card"><div className="pdc-lbl">Annual Revenue</div><div className="pdc-val">{PKR(monthly * 12)}</div><div className="pdc-sub">projected</div></div>
      <div className="psetup-detail-card"><div className="pdc-lbl">Free Trial</div><div className="pdc-val" style={{ fontSize: 13 }}>{setup.freeTrial && setup.trialDays ? `${setup.trialDays} days` : 'None'}</div></div>
      {setup.notes && <div className="psetup-detail-card" style={{ gridColumn: 'span 4', textAlign: 'left' }}><div className="pdc-lbl">Notes</div><div style={{ fontSize: 12.5, color: 'var(--t2)', marginTop: 4 }}>{setup.notes}</div></div>}
    </div>
  )
}

function RecvDetail({ s, setup, challan, recv }) {
  const monthly = setup ? monthlyCharge(s, setup) : 0
  const totalDues = challan ? challan.total : monthly
  const discount = recv?.discount || 0
  const netPayable = recv?.netPayable ?? totalDues
  const received = recv?.receivedAmount || 0
  const remaining = recv?.remainingAmount ?? totalDues
  return (
    <>
      <div className="recv-detail-grid">
        <div className="recv-dc"><div className="recv-dc-lbl">Monthly Charge</div><div className="recv-dc-val">{PKR(monthly)}</div></div>
        <div className="recv-dc"><div className="recv-dc-lbl">Discount</div><div className="recv-dc-val">{discount > 0 ? PKR(discount) : '—'}</div></div>
        <div className="recv-dc"><div className="recv-dc-lbl">Net Payable</div><div className="recv-dc-val">{PKR(netPayable)}</div></div>
        <div className="recv-dc"><div className="recv-dc-lbl">Payment Paid</div><div className="recv-dc-val" style={{ color: 'var(--success)' }}>{PKR(received)}</div></div>
        <div className="recv-dc"><div className="recv-dc-lbl">Remaining</div><div className="recv-dc-val" style={{ color: remaining > 0 ? 'var(--err)' : 'var(--success)' }}>{PKR(remaining)}</div></div>
      </div>
      {recv ? (
        /* Har MAHINE ki apni row hoti hai, magar us mahine ki har alag
           adaigi ka record nahi — row chalte hisaab ki soorat me rehti hai.
           Is liye yahan us mahine ki aakhri adaigi ki tafseel aur upar
           chalta hisaab dikhaya jaata hai. */
        <div style={{ marginBottom: 8 }}>
          <div className="recv-history-title" style={{ marginBottom: 6 }}><i className="fa-solid fa-clock-rotate-left" /> Last Payment</div>
          <span className="badge b-green" style={{ fontSize: 11 }}><i className="fa-solid fa-circle-check" style={{ fontSize: 8 }} /> Via: {recv.via || '—'}</span>
          <span className="badge b-blue" style={{ fontSize: 11, marginLeft: 4 }}><i className="fa-regular fa-calendar" style={{ fontSize: 8 }} /> {recv.date || '—'}</span>
          {recv.month > 0 && <span className="badge b-gray" style={{ fontSize: 11, marginLeft: 4 }}>Period: {String(recv.month).padStart(2, '0')}/{recv.year}</span>}
        </div>
      ) : <div style={{ textAlign: 'center', color: 'var(--tm)', fontSize: 12.5, padding: '8px 0' }}><i className="fa-solid fa-circle-info" style={{ marginRight: 6 }} />No receiving record yet. Click <strong>Receiving</strong> to record a payment.</div>}
    </>
  )
}

/* ── Payment Setup modal ──
   Teen formulay aik dusre ko kaat dete hain (API par bhi yehi hai: isLumpSum
   aur percentage dono booleans hain). Is liye jo formula chuna jaata hai
   sirf usi ke fields bharte aur save hote hain — baqi do ki value chhoot
   jaati hai, taake purani lump-sum raqam per-student setup ke sath chup-chaap
   save na ho jaaye. */
function SetupModal({ school, setup, saving, onClose, onSave, onToast }) {
  const [formula, setFormula] = useState(setup?.formula || 'lumpsum')
  const [lumpAmount, setLumpAmount] = useState(setup?.lumpAmount || '')
  const [perStudentRate, setPerStudentRate] = useState(setup?.perStudentRate || '')
  const [studentCount, setStudentCount] = useState(setup?.studentCount || school.students || 0)
  const [freeTrial, setFreeTrial] = useState(!!setup?.freeTrial)
  const [trialDays, setTrialDays] = useState(setup?.trialDays || '')
  const [notes, setNotes] = useState(setup?.notes || '')

  /* Classes + unke apne fee heads — sirf Percentage ke liye chahiye, is liye
     tabhi mangaate hain jab wo formula chuna jaaye (aur aik hi dafa). */
  const [feeClasses, setFeeClasses] = useState(null)
  const [classesErr, setClassesErr] = useState('')

  useEffect(() => {
    if (formula !== 'percentage' || feeClasses || classesErr) return undefined
    let alive = true
    fetchBranchClasses(school.id)
      .then((rows) => { if (alive) setFeeClasses(rows) })
      .catch((err) => { if (alive) setClassesErr(err?.message || 'Could not load classes') })
    return () => { alive = false }
  }, [formula, school.id, feeClasses, classesErr])

  /* Royalty % `${classID}:${headID}` par rakhi jaati hai — head ka naam school
     kabhi bhi badal sakta hai, id nahi. */
  const rowKey = (classID, headID) => `${classID}:${headID}`
  const [royalty, setRoyalty] = useState(() => {
    const init = {}
    ;(setup?.royaltyRows || []).forEach((r) => { init[rowKey(r.classID, r.headID)] = r.pct ? String(r.pct) : '' })
    return init
  })
  const setRoyaltyVal = (classID, headID, val) => setRoyalty((r) => ({ ...r, [rowKey(classID, headID)]: val }))

  const preview = (parseFloat(perStudentRate) || 0) * (parseInt(studentCount, 10) || 0)

  const save = () => {
    if (saving) return undefined
    if (freeTrial && !trialDays) return onToast('Please enter trial duration in days', 'warn')
    const common = {
      id: setup?.id || 0,
      previousAmount: setup?.previousAmount || 0,   // backend ka pichla balance chhoot na jaaye
      formula, freeTrial, trialDays, notes: notes.trim(),
    }

    if (formula === 'lumpsum') {
      if (!lumpAmount) return onToast('Please enter the monthly lump sum amount', 'warn')
      return onSave(school.id, { ...common, lumpAmount })
    }
    if (formula === 'perstudent') {
      if (!perStudentRate) return onToast('Please enter the per student rate', 'warn')
      return onSave(school.id, { ...common, perStudentRate, studentCount })
    }
    if (!feeClasses) return onToast('Classes are still loading — please wait', 'info')
    /* Sirf wohi heads bhejte hain jin par % lagi hai. Detail ids yahan bhejne
       ka faida nahi: backend har update par purani rows gira kar nayi bana
       deta hai (id 3,4 → 5,6), magar rows duplicate nahi hotin. Save ke baad
       screen wapas padh leti hai, is liye store phir bhi taza rehta hai. */
    const rows = []
    feeClasses.forEach((c) => c.heads.forEach((h) => {
      const pct = parseFloat(royalty[rowKey(c.id, h.headID)]) || 0
      if (pct <= 0) return
      rows.push({
        classID: c.id, className: c.name,
        headID: h.headID, headName: h.name, headAmount: h.amount,
        pct,
      })
    }))
    if (!rows.length) return onToast('Enter a royalty % on at least one fee head', 'warn')
    return onSave(school.id, { ...common, royaltyRows: rows })
  }

  return createPortal(
    <div className="pay-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pay-modal">
        <div className="pay-modal-hdr">
          <div className="pay-modal-av">{school.initials}</div>
          <div><div className="pay-modal-title">Payment Setup</div><div className="pay-modal-sub">{school.name} · {school.principal}</div></div>
          <button className="pay-modal-x" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="pay-modal-body">
          <div className="pay-field"><label>Billing Formula</label>
            <div className="pay-formula-grid">
              <div className={`pay-formula-card${formula === 'lumpsum' ? ' selected' : ''}`} onClick={() => setFormula('lumpsum')}>
                <div className="pay-fc-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}><i className="fa-solid fa-money-bill-wave" /></div>
                <div className="pay-fc-title">Lump Sum</div><div className="pay-fc-desc">A fixed amount charged every month.</div>
              </div>
              <div className={`pay-formula-card${formula === 'perstudent' ? ' selected' : ''}`} onClick={() => setFormula('perstudent')}>
                <div className="pay-fc-icon" style={{ background: 'linear-gradient(135deg,#15803d,#16a34a)' }}><i className="fa-solid fa-user-graduate" /></div>
                <div className="pay-fc-title">Per Student</div><div className="pay-fc-desc">Fixed rate per student × student count.</div>
              </div>
              <div className={`pay-formula-card${formula === 'percentage' ? ' selected' : ''}`} onClick={() => setFormula('percentage')}>
                <div className="pay-fc-icon" style={{ background: 'linear-gradient(135deg,#6D28D9,#7C3AED)' }}><i className="fa-solid fa-percent" /></div>
                <div className="pay-fc-title">Percentage</div><div className="pay-fc-desc">Royalty % on selected fee heads.</div>
              </div>
            </div>
          </div>

          {formula === 'lumpsum' && (
            <div className="pay-field"><label>Monthly Lump Sum Amount (PKR)</label><input className="pay-input" type="number" placeholder="e.g. 5000" value={lumpAmount} onChange={(e) => setLumpAmount(e.target.value)} /></div>
          )}

          {formula === 'perstudent' && (
            <>
              <div className="pay-input-row">
                <div className="pay-field"><label>Per Student Rate (PKR)</label><input className="pay-input" type="number" placeholder="e.g. 30" value={perStudentRate} onChange={(e) => setPerStudentRate(e.target.value)} /></div>
                <div className="pay-field"><label>Student Count</label><input className="pay-input" type="number" value={studentCount} onChange={(e) => setStudentCount(e.target.value)} /></div>
              </div>
              {(preview > 0) && <div className="pay-preview"><span className="pay-preview-lbl">Monthly Charge</span><span className="pay-preview-val">{PKR(preview)}</span></div>}
            </>
          )}

          {formula === 'percentage' && (
            <>
              <div className="pay-info-box">
                <i className="fa-solid fa-circle-info" />
                <p><strong>How percentage royalty works:</strong> the head office charges royalty as a % of the fees this school actually collects. Below are <strong>{school.name}</strong>&apos;s own class-wise fee heads. Enter a % only on the heads you want royalty on (e.g. Tuition Fee) and leave the rest at <strong>0%</strong> (e.g. Admission, Stationery, Annual charges). This is a one-time setup — royalty is then calculated automatically from each month&apos;s collections.</p>
              </div>
              <div className="pay-field" style={{ marginBottom: 16 }}>
                <label>Class-wise Fee Heads &amp; Royalty %</label>
                {classesErr ? (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--err)', fontSize: 12.5 }}>
                    <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 6 }} />{classesErr}
                  </div>
                ) : !feeClasses ? (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--tm)', fontSize: 12.5 }}>
                    <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }} />Loading this school’s classes…
                  </div>
                ) : feeClasses.length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--tm)', fontSize: 12.5 }}>
                    <i className="fa-solid fa-circle-info" style={{ marginRight: 6 }} />This school has no classes set up yet.
                  </div>
                ) : feeClasses.map((c) => (
                  <div className="royalty-class" key={c.id}>
                    <div className="royalty-class-hdr"><i className="fa-solid fa-chalkboard" /> {c.name}<span className="royalty-class-cnt">{c.heads.length} head{c.heads.length !== 1 ? 's' : ''}</span></div>
                    {c.heads.length === 0
                      ? <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--tm)' }}>No fee heads defined for this class yet.</div>
                      : c.heads.map((h) => {
                        const v = royalty[`${c.id}:${h.headID}`] || ''
                        const pct = parseFloat(v) || 0
                        return (
                          <div className={`royalty-head-row${pct > 0 ? ' on' : ''}`} key={h.headID}>
                            <span className="royalty-head-name">
                              {h.name}
                              <span style={{ color: 'var(--tm)', fontWeight: 600, marginLeft: 6 }}>· {PKR(h.amount)}</span>
                              {pct > 0 && <span style={{ color: '#7C3AED', fontWeight: 800, marginLeft: 6 }}>→ {PKR(Math.round((h.amount * pct) / 100))}</span>}
                            </span>
                            <div className="royalty-pct">
                              <input type="number" min="0" max="100" placeholder="0" value={v} onChange={(e) => setRoyaltyVal(c.id, h.headID, e.target.value)} />
                              <span className="royalty-pct-sign">%</span>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="pay-toggle-row">
            <div><div className="pay-toggle-label">Free Trial</div><div className="pay-toggle-sub">Offer a free trial period before billing starts.</div></div>
            <label className="sw"><input type="checkbox" checked={freeTrial} onChange={(e) => setFreeTrial(e.target.checked)} /><div className="sw-track" /><div className="sw-thumb" /></label>
          </div>
          {freeTrial && <div className="pay-field"><label>Trial Duration (days)</label><input className="pay-input" type="number" placeholder="e.g. 30" value={trialDays} onChange={(e) => setTrialDays(e.target.value)} /></div>}

          <div className="pay-field" style={{ marginBottom: 0 }}><label>Notes (optional)</label><input className="pay-input" placeholder="Any billing notes…" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <div className="pay-modal-foot">
          <button className="btn-secondary" onClick={onClose} disabled={saving}><i className="fa-solid fa-xmark" /> Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} /> {saving ? 'Saving…' : 'Save Setup'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ── Generate Challan modal ── */
/* Ye modal sirf us school ke liye khulta hai jiska challan abhi bana hi nahi
   (bana hua ho to Generate band rehta hai), is liye maidan hamesha khali se
   shuru hote hain. */
function GenModal({ school, setup, busy, defaultMonth, defaultYear, pendingFor, onClose, onSave, onToast }) {
  const monthly = monthlyCharge(school, setup)
  /* Pichle mahinon ka baqaya khud bhar jaata hai (July ka bacha hua August
     ke challan me), taake user ko haath se jorna na pare — magar wo ise
     badal bhi sakta hai. */
  const [prevDues, setPrevDues] = useState(() => {
    const p = pendingFor ? pendingFor(defaultMonth, defaultYear) : 0
    return p > 0 ? String(p) : ''
  })
  /* Challan kis mahine ka hai — sab se pehla faisla, kyunke issue aur due
     dono tareekhein isi mahine ke andar rehti hain (ERP ke Fee Challans
     jaisa). Shuru me mojooda mahina. */
  const today = new Date()
  const [month, setMonth] = useState(defaultMonth || today.getMonth() + 1)
  const [year, setYear] = useState(defaultYear || today.getFullYear())
  /* Issue date = challan kis din jari hua (API me `creationDate`). Mojooda
     mahine me aaj se shuru hota hai; kisi aur mahine ka challan ho to us
     mahine ki 1 tareekh se — magar user dono badal sakta hai. */
  const [issueDate, setIssueDate] = useState(() => monthDates(month, year).issue)
  const [dueDate, setDueDate] = useState(() => monthDates(month, year).due)

  /* Mahina badalte hi tareekhein usi mahine me khinch aati hain, warna user
     ko har dafa dono date pickers haath se theek karne parte. */
  const pickMonth = (m, y) => {
    setMonth(m); setYear(y)
    const d = monthDates(m, y)
    setIssueDate(d.issue); setDueDate(d.due)
    /* Mahina badla to baqaya bhi usi mahine tak ka. */
    const p = pendingFor ? pendingFor(m, y) : 0
    setPrevDues(p > 0 ? String(p) : '')
  }

  const submit = () => {
    if (busy) return undefined
    if (!issueDate) return onToast('Please pick an issue date', 'warn')
    if (!dueDate) return onToast('Please pick a due date', 'warn')
    /* Due date issue date se pehle ho to challan pehle din hi overdue —
       ye taqreeban hamesha typo hota hai. */
    if (dueDate < issueDate) return onToast('Due date cannot be before the issue date', 'warn')
    /* Issue date challan ke apne mahine se bahar nikal jaye to challan kis
       mahine ka hai ye mubham ho jata hai — wahin rok dete hain. */
    if (issueDate < monthStart(month, year) || issueDate > monthEnd(month, year)) {
      return onToast(`Issue date must fall inside ${monthLabel(month, year)}`, 'warn')
    }
    return onSave(school.id, parseFloat(prevDues) || 0, dueDate, issueDate, month, year)
  }
  const total = monthly + (parseFloat(prevDues) || 0)
  return createPortal(
    <div className="pay-ov" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div className="pay-modal" style={{ maxWidth: 460 }}>
        <div className="pay-modal-hdr">
          <div className="pay-modal-av" style={{ background: 'linear-gradient(135deg,#15803d,#16a34a)' }}><i className="fa-solid fa-file-invoice-dollar" /></div>
          <div><div className="pay-modal-title">Generate Challan</div><div className="pay-modal-sub">{school.name}</div></div>
          <button className="pay-modal-x" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="pay-modal-body">
          <div className="pay-info-box"><i className="fa-solid fa-circle-info" /><p>
            {setup.formula === 'lumpsum'
              ? 'Lump Sum / Month'
              : setup.formula === 'percentage'
                /* Percentage ka apna jumla — warna ye "Per Student" wali
                   shakh me gir kar "× 0 students" dikhata tha. */
                ? `Royalty % on ${royaltyCount(setup)} fee head${royaltyCount(setup) !== 1 ? 's' : ''}`
                : `Per Student (${setup.perStudentRate} × ${setup.studentCount || school.students || 0} students) · ${school.students || setup.studentCount || 0} students`}
          </p></div>
          <div className="pay-input-row">
            <div className="pay-field"><label>Challan Month</label>
              <select className="pay-input" value={month} onChange={(e) => pickMonth(Number(e.target.value), year)}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="pay-field"><label>Year</label>
              <select className="pay-input" value={year} onChange={(e) => pickMonth(month, Number(e.target.value))}>
                {challanYears().map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="pay-field"><label>Monthly Amount (PKR)</label><input className="pay-input" value={monthly.toLocaleString()} readOnly style={{ background: 'var(--muted)' }} /></div>
          <div className="pay-field">
            <label>Previous Dues (PKR, optional)</label>
            <input className="pay-input" type="number" placeholder="0" value={prevDues} onChange={(e) => setPrevDues(e.target.value)} />
            <div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 4 }}>
              <i className="fa-solid fa-circle-info" style={{ marginRight: 5 }} />
              Carried forward from earlier months — edit if needed.
            </div>
          </div>
          <div className="pay-input-row">
            <div className="pay-field"><label>Issue Date</label><input className="pay-input" type="date" value={issueDate} min={monthStart(month, year)} max={monthEnd(month, year)} onChange={(e) => setIssueDate(e.target.value)} /></div>
            <div className="pay-field"><label>Due Date</label><input className="pay-input" type="date" value={dueDate} min={issueDate || undefined} onChange={(e) => setDueDate(e.target.value)} /></div>
          </div>
          <div className="pay-preview"><span className="pay-preview-lbl">Total Challan · {monthLabel(month, year)}</span><span className="pay-preview-val">{PKR(total)}</span></div>
        </div>
        <div className="pay-modal-foot">
          <button className="btn-secondary" onClick={onClose} disabled={busy}><i className="fa-solid fa-xmark" /> Cancel</button>
          <button className="btn-success" onClick={submit} disabled={busy}>
            <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-file-invoice-dollar'}`} /> {busy ? 'Generating…' : 'Generate Challan'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ── Receiving modal ── */
/* API har adaigi ka alag record nahi rakhti — aik hi row chalte hisaab ki
   soorat me rehti hai. Is liye nayi raqam purani me jama kar ke bheji jaati
   hai, aur `via`/`date` aakhri adaigi ke ban jaate hain. */
function RecvModal({ school, setup, challan, recv, period, busy, onClose, onSave, onToast }) {
  /* Is mahine ka payable = is mahine ka charge + jo baqaya challan me aage
     laya gaya tha. Challan na bana ho to sirf mahana charge. */
  const totalDues = challan ? challan.total : (setup ? monthlyCharge(school, setup) : 0)
  const [discount, setDiscount] = useState(recv?.discount || '')
  const [received, setReceived] = useState('')
  const [via, setVia] = useState(recv?.via || PAY_METHODS[0])
  const [date, setDate] = useState(todayPlus(0))
  const netPayable = totalDues - (parseFloat(discount) || 0)
  const prevReceived = recv?.receivedAmount || 0
  const remaining = netPayable - prevReceived - (parseFloat(received) || 0)

  const save = () => {
    if (busy) return undefined
    const recvAmt = parseFloat(received) || 0
    if (recvAmt <= 0) return onToast('Please enter the received amount', 'warn')
    if (remaining < 0) return onToast('Received amount is more than what is payable', 'warn')
    return onSave(school.id, {
      payableAmount: totalDues,
      discount: parseFloat(discount) || 0,
      netPayable,
      receivedAmount: prevReceived + recvAmt,
      remainingAmount: Math.max(0, remaining),
      via,
      date,
    })
  }

  return createPortal(
    <div className="pay-ov" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div className="pay-modal" style={{ maxWidth: 480 }}>
        <div className="pay-modal-hdr">
          <div className="pay-modal-av" style={{ background: 'linear-gradient(135deg,#0369A1,#0284C7)' }}><i className="fa-solid fa-hand-holding-dollar" /></div>
          <div><div className="pay-modal-title">Receive Payment</div><div className="pay-modal-sub">{school.name}{period ? ` · ${period}` : ''}</div></div>
          <button className="pay-modal-x" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="pay-modal-body">
          <div className="pay-info-box"><i className="fa-solid fa-circle-info" /><p>
            Total dues: <strong>{PKR(totalDues)}</strong>
            {challan?.prevDues > 0 ? ` (this month ${PKR(challan.amount)} + previous dues ${PKR(challan.prevDues)})` : ''}
            {prevReceived > 0 ? ` · Already received: ${PKR(prevReceived)}` : ''}
          </p></div>
          <div className="pay-input-row">
            <div className="pay-field"><label>Discount (PKR)</label><input className="pay-input" type="number" placeholder="0" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
            <div className="pay-field"><label>Amount Received (PKR)</label><input className="pay-input" type="number" placeholder="0" value={received} onChange={(e) => setReceived(e.target.value)} /></div>
          </div>
          <div className="pay-input-row">
            <div className="pay-field"><label>Payment Method</label><select className="pay-input" value={via} onChange={(e) => setVia(e.target.value)}>{PAY_METHODS.map((m) => <option key={m}>{m}</option>)}</select></div>
            <div className="pay-field"><label>Payment Date</label><input className="pay-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          <div className="pay-preview"><span className="pay-preview-lbl">Remaining After Payment</span><span className="pay-preview-val" style={{ color: remaining > 0 ? 'var(--err)' : 'var(--success)' }}>{PKR(Math.max(0, remaining))}</span></div>
        </div>
        <div className="pay-modal-foot">
          <button className="btn-secondary" onClick={onClose} disabled={busy}><i className="fa-solid fa-xmark" /> Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-circle-check'}`} /> {busy ? 'Recording…' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ── Delete confirm ── */
function ConfirmDelete({ name, kind, busy, onClose, onConfirm }) {
  const what = kind === 'delChallan' ? 'Challan' : kind === 'delSetup' ? 'Payment Setup' : 'Receiving Record'
  return createPortal(
    /* Delete chalte waqt bahar click karne par dialog band nahi hota — warna
       call adhoori chalti rehti aur user ko pata hi na chalta ke hua kya. */
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-body" style={{ textAlign: 'center', padding: '40px 30px' }}>
          <div className="confirm-icon" style={{ background: 'rgba(220,38,38,.1)', border: '2px solid rgba(220,38,38,.25)', color: '#DC2626' }}><i className="fa-solid fa-trash-can" /></div>
          <div className="confirm-title">Delete {what}?</div>
          <div className="confirm-sub">This will remove the {what.toLowerCase()} for <strong>{name}</strong>. This cannot be undone.</div>
          <div className="confirm-btns">
            <button className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn-danger" onClick={onConfirm} disabled={busy}>
              <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-trash-can'}`} /> {busy ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ── Reports tab ── */
function ReportsTab({ schools, setupStore, chStore, recvStore, month, setMonth, year, setYear, applied, loadMonth, loadingMonth, rptTab, setRptTab, q, setQ, status, setStatus, onToast }) {
  const rows = useMemo(() => schools.map((s) => {
    const setup = setupStore[s.id]; const challan = chStore[s.id]; const recv = recvStore[s.id]
    const payable = totalDuesFor(s, setup, challan)
    const received = recv?.receivedAmount || 0
    const outstanding = recv ? recv.remainingAmount : (setup ? payable : 0)
    const st = paymentStatus(setup, recv, payable)
    return { s, setup, challan, recv, payable, received, outstanding, st }
  }), [schools, setupStore, chStore, recvStore])

  const filtered = rows.filter((r) => {
    const ql = q.trim().toLowerCase()
    if (ql && !r.s.name.toLowerCase().includes(ql)) return false
    if (status && r.st.key !== status) return false
    return true
  })

  const overview = useMemo(() => {
    const withSetup = rows.filter((r) => r.setup)
    return {
      total: rows.length,
      payable: withSetup.reduce((a, r) => a + r.payable, 0),
      received: rows.reduce((a, r) => a + r.received, 0),
      outstanding: withSetup.reduce((a, r) => a + Math.max(0, r.outstanding), 0),
      paid: rows.filter((r) => r.st.key === 'paid').length,
      unpaid: rows.filter((r) => r.st.key === 'unpaid' || r.st.key === 'partial').length,
    }
  }, [rows])

  const PANELS = {
    summary: { icon: 'fa-table-list', grad: 'linear-gradient(135deg,#1E3A8A,#1E40AF)', title: 'Payment Summary Report', sub: 'All schools — payable, received & outstanding' },
    outstanding: { icon: 'fa-triangle-exclamation', grad: 'linear-gradient(135deg,#b91c1c,#dc2626)', title: 'Outstanding Payments Report', sub: 'Schools with pending or partial dues' },
    received: { icon: 'fa-circle-check', grad: 'linear-gradient(135deg,#15803d,#16a34a)', title: 'Received Payments Report', sub: 'Schools with confirmed payment records' },
    challan: { icon: 'fa-file-invoice-dollar', grad: 'linear-gradient(135deg,#0369A1,#0284C7)', title: 'Challan Report', sub: 'Generated challans with amounts and due dates' },
  }
  const panel = PANELS[rptTab]

  /* Open a clean, formatted print view (the user prints / saves as PDF). */
  /* Har report usi mahine ki hai jo upar chuna gaya — heading me likha
     rehta hai, warna chhapa hua kaghaz be-tareekh ka lagta. */
  const period = monthLabel(applied.month, applied.year)

  const openPrint = (rowSet, scope) => {
    const html = buildReportHTML(rptTab, panel, rowSet, overview, `${period} · ${scope}`)
    const w = window.open('', '_blank')
    if (!w) { onToast?.('Allow pop-ups to download / print the report', 'warn'); return }
    w.document.open(); w.document.write(html); w.document.close()
  }
  const scopeLabel = () => (q || status)
    ? `Filtered view${q ? ` · search: “${q}”` : ''}${status ? ` · status: ${status}` : ''}`
    : 'All schools'
  const printActive = () => openPrint(filtered, scopeLabel())

  return (
    <div className="ss-panel">
      <div className="rpt-stat-grid">
        <div className="rpt-stat"><div className="rpt-stat-val">{overview.total}</div><div className="rpt-stat-lbl">Total Schools</div></div>
        <div className="rpt-stat s-info"><div className="rpt-stat-val" style={{ fontSize: 14 }}>{PKR(overview.payable)}</div><div className="rpt-stat-lbl">Total Payable</div></div>
        <div className="rpt-stat s-green"><div className="rpt-stat-val" style={{ fontSize: 14 }}>{PKR(overview.received)}</div><div className="rpt-stat-lbl">Total Received</div></div>
        <div className="rpt-stat s-red"><div className="rpt-stat-val" style={{ fontSize: 14 }}>{PKR(overview.outstanding)}</div><div className="rpt-stat-lbl">Outstanding</div></div>
        <div className="rpt-stat s-green"><div className="rpt-stat-val">{overview.paid}</div><div className="rpt-stat-lbl">Paid Schools</div></div>
        <div className="rpt-stat s-warn"><div className="rpt-stat-val">{overview.unpaid}</div><div className="rpt-stat-lbl">Unpaid / Partial</div></div>
      </div>

      <div className="section-card">
        <div className="rpt-filter-bar">
          <div className="f-field-grow"><div className="search-box"><i className="fa-solid fa-magnifying-glass" /><input className="search-input" placeholder="Search by school name…" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
          <select className="f-input" style={{ height: 38, width: 120 }} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select className="f-input" style={{ height: 38, width: 92 }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {challanYears().map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn-secondary" style={{ height: 38 }} disabled={loadingMonth} onClick={loadMonth} title="Load report data for the selected month and year">
            <i className={`fa-solid ${loadingMonth ? 'fa-spinner fa-spin' : 'fa-filter'}`} /> {loadingMonth ? 'Loading…' : 'Load'}
          </button>
          <select className="f-input" style={{ height: 38, width: 150 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Statuses</option><option value="paid">Paid</option><option value="partial">Partial</option><option value="unpaid">Unpaid</option><option value="no-setup">No Setup</option>
          </select>
          <button className="btn-secondary" style={{ height: 38 }} onClick={() => { setQ(''); setStatus('') }}><i className="fa-solid fa-rotate-left" /> Reset</button>
          <button className="rpt-pdf-btn" onClick={printActive}><i className="fa-solid fa-file-pdf" /> Download PDF</button>
        </div>

        <div className="rpt-subtabs">
          {Object.entries(PANELS).map(([k, v]) => (
            <button key={k} className={`rpt-stab${rptTab === k ? ' active' : ''}`} onClick={() => setRptTab(k)}><i className={`fa-solid ${v.icon}`} /> {v.title.split(' ')[0]}</button>
          ))}
        </div>

        <div className="rpt-panel-hdr">
          <div className="rpt-panel-hdr-l">
            <div className="rpt-panel-icon" style={{ background: panel.grad }}><i className={`fa-solid ${panel.icon}`} /></div>
            <div><div className="rpt-panel-title">{panel.title}</div><div className="rpt-panel-sub">{period} · {panel.sub}</div></div>
          </div>
          <button className="rpt-pdf-btn" onClick={printActive}><i className="fa-solid fa-file-pdf" /> Download PDF</button>
        </div>

        <div className="tbl-wrap">
          {rptTab === 'summary' && (
            <table className="pay-table">
              <thead><tr><th>#</th><th>School Name</th><th>Formula</th><th style={{ textAlign: 'right' }}>Payable</th><th style={{ textAlign: 'right' }}>Received</th><th style={{ textAlign: 'right' }}>Outstanding</th><th style={{ textAlign: 'center' }}>Status</th><th style={{ textAlign: 'center' }}>PDF</th></tr></thead>
              <tbody>{filtered.map((r, i) => (
                <tr key={r.s.id}>
                  <td data-label="#">{i + 1}</td><td data-label="School" style={{ fontWeight: 700, color: 'var(--t1)' }}>{r.s.name}</td>
                  <td data-label="Formula"><FormulaBadge setup={r.setup} /></td>
                  <td data-label="Payable" style={{ textAlign: 'right', fontWeight: 700 }}>{PKR(r.payable)}</td>
                  <td data-label="Received" style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 700 }}>{PKR(r.received)}</td>
                  <td data-label="Outstanding" style={{ textAlign: 'right', color: r.outstanding > 0 ? 'var(--err)' : 'var(--tm)', fontWeight: 700 }}>{PKR(Math.max(0, r.outstanding))}</td>
                  <td data-label="Status" style={{ textAlign: 'center' }}><span className={`badge ${r.st.cls}`}>{r.st.label}</span></td>
                  <td data-label="PDF" style={{ textAlign: 'center' }}><button className="rpt-pdf-cell" onClick={() => openPrint([r], `School: ${r.s.name}`)}><i className="fa-solid fa-file-pdf" /></button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
          {rptTab === 'outstanding' && (
            <table className="pay-table">
              <thead><tr><th>#</th><th>School Name</th><th>Owner / Contact</th><th style={{ textAlign: 'right' }}>Due Amount</th><th style={{ textAlign: 'center' }}>Status</th><th style={{ textAlign: 'center' }}>PDF</th></tr></thead>
              <tbody>{filtered.filter((r) => r.outstanding > 0).map((r, i) => (
                <tr key={r.s.id}>
                  <td data-label="#">{i + 1}</td><td data-label="School" style={{ fontWeight: 700, color: 'var(--t1)' }}>{r.s.name}</td>
                  <td data-label="Owner">{r.s.principal} · {r.s.contact}</td>
                  <td data-label="Due" style={{ textAlign: 'right', color: 'var(--err)', fontWeight: 800 }}>{PKR(r.outstanding)}</td>
                  <td data-label="Status" style={{ textAlign: 'center' }}><span className={`badge ${r.st.cls}`}>{r.st.label}</span></td>
                  <td data-label="PDF" style={{ textAlign: 'center' }}><button className="rpt-pdf-cell" onClick={() => openPrint([r], `School: ${r.s.name}`)}><i className="fa-solid fa-file-pdf" /></button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
          {rptTab === 'received' && (
            <table className="pay-table">
              <thead><tr><th>#</th><th>School Name</th><th style={{ textAlign: 'right' }}>Amount Received</th><th>Payment Date</th><th>Method</th><th style={{ textAlign: 'right' }}>Remaining</th><th style={{ textAlign: 'center' }}>PDF</th></tr></thead>
              <tbody>{filtered.filter((r) => r.recv).map((r, i) => (
                <tr key={r.s.id}>
                  <td data-label="#">{i + 1}</td><td data-label="School" style={{ fontWeight: 700, color: 'var(--t1)' }}>{r.s.name}</td>
                  <td data-label="Received" style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 800 }}>{PKR(r.received)}</td>
                  <td data-label="Date">{r.recv.date || '—'}</td><td data-label="Method">{r.recv.via || '—'}</td>
                  <td data-label="Remaining" style={{ textAlign: 'right', fontWeight: 700 }}>{PKR(Math.max(0, r.outstanding))}</td>
                  <td data-label="PDF" style={{ textAlign: 'center' }}><button className="rpt-pdf-cell" onClick={() => openPrint([r], `School: ${r.s.name}`)}><i className="fa-solid fa-file-pdf" /></button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
          {rptTab === 'challan' && (
            <table className="pay-table">
              <thead><tr><th>#</th><th>School Name</th><th>Formula</th><th style={{ textAlign: 'right' }}>Challan</th><th style={{ textAlign: 'right' }}>Prev Dues</th><th style={{ textAlign: 'right' }}>Total</th><th>Due Date</th><th style={{ textAlign: 'center' }}>PDF</th></tr></thead>
              <tbody>{filtered.filter((r) => r.challan).map((r, i) => (
                <tr key={r.s.id}>
                  <td data-label="#">{i + 1}</td><td data-label="School" style={{ fontWeight: 700, color: 'var(--t1)' }}>{r.s.name}</td>
                  <td data-label="Formula"><FormulaBadge setup={r.setup} /></td>
                  <td data-label="Challan" style={{ textAlign: 'right', fontWeight: 700 }}>{PKR(r.challan.amount)}</td>
                  <td data-label="Prev Dues" style={{ textAlign: 'right' }}>{PKR(r.challan.prevDues)}</td>
                  <td data-label="Total" style={{ textAlign: 'right', fontWeight: 800, color: 'var(--brand)' }}>{PKR(r.challan.total)}</td>
                  <td data-label="Due Date">{r.challan.dueDate || '—'}</td>
                  <td data-label="PDF" style={{ textAlign: 'center' }}><button className="rpt-pdf-cell" onClick={() => openPrint([r], `School: ${r.s.name}`)}><i className="fa-solid fa-file-pdf" /></button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

/* ════════════════ Printable report (print-to-PDF) ════════════════ */
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const fmtPKR = (n) => 'PKR ' + Number(n || 0).toLocaleString()
function formulaText(setup) {
  if (!setup) return 'No Setup'
  if (setup.formula === 'lumpsum') return 'Lump Sum'
  if (setup.formula === 'percentage') return 'Percentage (Royalty)'
  return 'Per Student'
}

function reportRows(panelKey, rows) {
  if (panelKey === 'outstanding') {
    const r = rows.filter((x) => x.outstanding > 0)
    return {
      cols: ['#', 'School Name', 'Owner / Contact', 'Due Amount', 'Status'],
      align: ['c', 'l', 'l', 'r', 'c'],
      body: r.map((x, i) => [i + 1, x.s.name, `${x.s.principal} · ${x.s.contact}`, fmtPKR(x.outstanding), x.st.label]),
      foot: ['', 'Total', '', fmtPKR(r.reduce((a, x) => a + x.outstanding, 0)), ''],
    }
  }
  if (panelKey === 'received') {
    const r = rows.filter((x) => x.recv)
    return {
      cols: ['#', 'School Name', 'Amount Received', 'Payment Date', 'Method', 'Remaining'],
      align: ['c', 'l', 'r', 'l', 'l', 'r'],
      body: r.map((x, i) => [i + 1, x.s.name, fmtPKR(x.received), x.recv.date || '—', x.recv.via || '—', fmtPKR(Math.max(0, x.outstanding))]),
      foot: ['', 'Total', fmtPKR(r.reduce((a, x) => a + x.received, 0)), '', '', ''],
    }
  }
  if (panelKey === 'challan') {
    const r = rows.filter((x) => x.challan)
    return {
      cols: ['#', 'School Name', 'Formula', 'Challan', 'Prev Dues', 'Total', 'Due Date'],
      align: ['c', 'l', 'l', 'r', 'r', 'r', 'l'],
      body: r.map((x, i) => [i + 1, x.s.name, formulaText(x.setup), fmtPKR(x.challan.amount), fmtPKR(x.challan.prevDues), fmtPKR(x.challan.total), x.challan.dueDate || '—']),
      foot: ['', 'Total', '', '', '', fmtPKR(r.reduce((a, x) => a + x.challan.total, 0)), ''],
    }
  }
  return {
    cols: ['#', 'School Name', 'Formula', 'Payable', 'Received', 'Outstanding', 'Status'],
    align: ['c', 'l', 'l', 'r', 'r', 'r', 'c'],
    body: rows.map((x, i) => [i + 1, x.s.name, formulaText(x.setup), fmtPKR(x.payable), fmtPKR(x.received), fmtPKR(Math.max(0, x.outstanding)), x.st.label]),
    foot: ['', 'Total', '', fmtPKR(rows.reduce((a, x) => a + x.payable, 0)), fmtPKR(rows.reduce((a, x) => a + x.received, 0)), fmtPKR(rows.reduce((a, x) => a + Math.max(0, x.outstanding), 0)), ''],
  }
}

function buildReportHTML(panelKey, panel, rows, overview, scope) {
  const { cols, align, body, foot } = reportRows(panelKey, rows)
  const chain = loadChainProfile()
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) + ' · ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const thead = cols.map((c, i) => `<th class="a-${align[i]}">${escapeHtml(c)}</th>`).join('')
  const tbody = body.length
    ? body.map((row) => `<tr>${row.map((cell, i) => `<td class="a-${align[i]}">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')
    : `<tr><td class="empty" colspan="${cols.length}">No records for this report.</td></tr>`
  const tfoot = body.length ? `<tr class="total">${foot.map((cell, i) => `<td class="a-${align[i]}">${escapeHtml(cell)}</td>`).join('')}</tr>` : ''
  const cards = [
    ['Total Schools', overview.total], ['Total Payable', fmtPKR(overview.payable)], ['Total Received', fmtPKR(overview.received)],
    ['Outstanding', fmtPKR(overview.outstanding)], ['Paid', overview.paid], ['Unpaid / Partial', overview.unpaid],
  ].map(([l, v]) => `<div class="rpt-card"><div class="v">${escapeHtml(v)}</div><div class="l">${escapeHtml(l)}</div></div>`).join('')
  const logoHtml = chain.logo
    ? `<img class="rpt-logo-img" src="${chain.logo}" alt="logo">`
    : `<div class="rpt-logo">${escapeHtml(chainInitials(chain.chainName))}</div>`

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(chain.chainName)} — ${escapeHtml(panel.title)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#e9eef6}
body{font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#0f172a}
.a4{width:210mm;min-height:297mm;margin:16px auto;background:#fff;padding:16mm 14mm;box-shadow:0 6px 28px rgba(15,23,42,.18)}
.rpt-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px solid #1E3A8A;padding-bottom:14px;margin-bottom:16px}
.rpt-brand{display:flex;gap:13px;align-items:center}
.rpt-logo{width:56px;height:56px;border-radius:12px;background:linear-gradient(135deg,#1E3A8A,#2563EB);color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.rpt-logo-img{width:56px;height:56px;border-radius:12px;object-fit:cover;border:1px solid #e2e8f0;flex-shrink:0}
.rpt-org{font-size:18px;font-weight:800;color:#0f172a}
.rpt-org-line{font-size:11px;color:#64748b;margin-top:2px}
.rpt-meta{text-align:right;flex-shrink:0}
.rpt-doctag{display:inline-block;font-size:9px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:#1E3A8A;background:#dbeafe;border:1px solid #bfdbfe;border-radius:99px;padding:2px 9px;margin-bottom:6px}
.rpt-title{font-size:16px;font-weight:800;color:#1E3A8A}
.rpt-sub{font-size:11.5px;color:#64748b;margin-top:1px}
.rpt-date{font-size:10.5px;color:#94a3b8;margin-top:4px}
.rpt-scope{font-size:11.5px;color:#475569;margin-bottom:14px;background:#f1f5f9;border:1px solid #e2e8f0;padding:8px 12px;border-radius:8px}
.rpt-cards{display:flex;gap:9px;margin-bottom:16px;flex-wrap:wrap}
.rpt-card{flex:1;min-width:104px;border:1px solid #e2e8f0;border-radius:10px;padding:9px 12px}
.rpt-card .v{font-size:14px;font-weight:800}.rpt-card .l{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-top:3px}
table{width:100%;border-collapse:collapse;font-size:11.5px}
thead th{background:#1E3A8A;color:#fff;padding:8px 9px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.5px}
tbody td{padding:7px 9px;border-bottom:1px solid #e2e8f0;color:#1e293b}
tbody tr:nth-child(even) td{background:#f8fafc}
tr.total td{font-weight:800;border-top:2px solid #1E3A8A;background:#eff6ff;color:#0f172a}
.a-r{text-align:right}.a-c{text-align:center}.a-l{text-align:left}
td.empty{text-align:center;padding:34px;color:#94a3b8;font-weight:600}
.rpt-foot{margin-top:18px;border-top:1px solid #e2e8f0;padding-top:8px;font-size:9.5px;color:#94a3b8;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px}
@media print{html,body{background:#fff}.a4{width:auto;min-height:auto;margin:0;padding:0;box-shadow:none}@page{size:A4;margin:14mm}}
</style></head>
<body>
<div class="a4">
<div class="rpt-head">
  <div class="rpt-brand">${logoHtml}<div><div class="rpt-org">${escapeHtml(chain.chainName)}</div><div class="rpt-org-line">${escapeHtml(chain.address || '')}</div><div class="rpt-org-line">${escapeHtml(chain.contact || '')}${chain.email ? ' · ' + escapeHtml(chain.email) : ''}</div></div></div>
  <div class="rpt-meta"><div class="rpt-doctag">Payment Report</div><div class="rpt-title">${escapeHtml(panel.title)}</div><div class="rpt-sub">${escapeHtml(panel.sub)}</div><div class="rpt-date">Generated: ${escapeHtml(dateStr)}</div></div>
</div>
<div class="rpt-scope"><strong>Scope:</strong> ${escapeHtml(scope || 'All schools')} · ${body.length} record${body.length !== 1 ? 's' : ''}</div>
<div class="rpt-cards">${cards}</div>
<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody>${tfoot ? `<tfoot>${tfoot}</tfoot>` : ''}</table>
<div class="rpt-foot"><span>${escapeHtml(chain.chainName)}${chain.website ? ' · ' + escapeHtml(chain.website) : ''}</span><span>System-generated · all amounts in PKR</span></div>
</div>
<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},300);};<\/script>
</body></html>`
}

/* ── Generate-in-Bulk modal ── */
function BulkGenModal({ schools, setupStore, chStore, busy, defaultMonth, defaultYear, onClose, onGenerate, onToast }) {
  /* Jis school ka challan pehle se bana hua hai wo bulk me bhi nahi chalta —
     row wala Generate bhi usi tarah band rehta hai. Naya challan banane se
     pehle purana delete karna parta hai. */
  const eligible = schools.filter((s) => setupStore[s.id] && !chStore[s.id])
  const already = schools.filter((s) => setupStore[s.id] && chStore[s.id])
  const noSetup = schools.filter((s) => !setupStore[s.id])
  /* Aik hi mahina sab challans par lagta hai — row wale modal jaisa hi
     usool: mahina badalne par tareekhein usi mahine me aa jaati hain. */
  const today = new Date()
  const [month, setMonth] = useState(defaultMonth || today.getMonth() + 1)
  const [year, setYear] = useState(defaultYear || today.getFullYear())
  const [issueDate, setIssueDate] = useState(() => monthDates(month, year).issue)
  const [dueDate, setDueDate] = useState(() => monthDates(month, year).due)
  const pickMonth = (m, y) => {
    setMonth(m); setYear(y)
    const d = monthDates(m, y)
    setIssueDate(d.issue); setDueDate(d.due)
  }
  const [sel, setSel] = useState(() => new Set(eligible.map((s) => s.id)))
  const toggle = (id) => setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const allOn = eligible.length > 0 && eligible.every((s) => sel.has(s.id))
  const toggleAll = () => setSel(allOn ? new Set() : new Set(eligible.map((s) => s.id)))
  const totalAmt = eligible.filter((s) => sel.has(s.id)).reduce((sum, s) => sum + monthlyCharge(s, setupStore[s.id]), 0)

  return createPortal(
    <div className="pay-ov" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div className="pay-modal" style={{ maxWidth: 580 }}>
        <div className="pay-modal-hdr">
          <div className="pay-modal-av" style={{ background: 'linear-gradient(135deg,#15803d,#16a34a)' }}><i className="fa-solid fa-bolt" /></div>
          <div><div className="pay-modal-title">Generate Challans in Bulk</div><div className="pay-modal-sub">Select schools, month and a common due date</div></div>
          <button className="pay-modal-x" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="pay-modal-body">
          <div className="pay-info-box"><i className="fa-solid fa-circle-info" /><p><strong>{eligible.length}</strong> school{eligible.length !== 1 ? 's' : ''} ready{already.length > 0 ? ` · ${already.length} already have a challan (skipped)` : ''}{noSetup.length > 0 ? ` · ${noSetup.length} need payment setup` : ''}.</p></div>

          <div className="pay-input-row">
            <div className="pay-field"><label>Challan Month (applies to all)</label>
              <select className="pay-input" value={month} onChange={(e) => pickMonth(Number(e.target.value), year)}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="pay-field"><label>Year</label>
              <select className="pay-input" value={year} onChange={(e) => pickMonth(month, Number(e.target.value))}>
                {challanYears().map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div className="pay-input-row">
            <div className="pay-field"><label>Issue Date (applies to all)</label><input className="pay-input" type="date" value={issueDate} min={monthStart(month, year)} max={monthEnd(month, year)} onChange={(e) => setIssueDate(e.target.value)} /></div>
            <div className="pay-field"><label>Due Date (applies to all)</label><input className="pay-input" type="date" value={dueDate} min={issueDate || undefined} onChange={(e) => setDueDate(e.target.value)} /></div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '14px 0 6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--t2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={allOn} onChange={toggleAll} /> Select all eligible schools
            </label>
            <span style={{ fontSize: 11.5, color: 'var(--tm)', fontWeight: 700 }}>{sel.size} selected</span>
          </div>

          <div style={{ border: '1px solid var(--bl)', borderRadius: 'var(--r-md)', maxHeight: 240, overflowY: 'auto' }}>
            {eligible.map((s) => (
              <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid var(--bl)', cursor: 'pointer' }}>
                <input type="checkbox" checked={sel.has(s.id)} onChange={() => toggle(s.id)} />
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, color: 'var(--t1)', fontSize: 13 }}>{s.name}</div><div style={{ fontSize: 11, color: 'var(--tm)' }}>{s.principal}</div></div>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--t1)' }}>{PKR(monthlyCharge(s, setupStore[s.id]))}</span>
                <span className="badge b-gray" style={{ flexShrink: 0 }}>Pending</span>
              </label>
            ))}
            {already.map((s) => (
              <div key={s.id} title="Challan already generated — delete it first to generate a new one" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid var(--bl)', opacity: 0.55 }}>
                <input type="checkbox" disabled />
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, color: 'var(--t1)', fontSize: 13 }}>{s.name}</div><div style={{ fontSize: 11, color: 'var(--tm)' }}>Due: {chStore[s.id]?.dueDate || '—'}</div></div>
                <span className="badge b-green" style={{ flexShrink: 0 }}>Generated</span>
              </div>
            ))}
            {noSetup.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid var(--bl)', opacity: 0.55 }}>
                <input type="checkbox" disabled />
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, color: 'var(--t1)', fontSize: 13 }}>{s.name}</div></div>
                <span className="badge b-warn" style={{ flexShrink: 0 }}>Setup required</span>
              </div>
            ))}
            {eligible.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--tm)', fontSize: 13 }}>
                {already.length > 0 && noSetup.length === 0
                  ? 'Every school already has a challan.'
                  : 'No schools are ready for a new challan.'}
              </div>
            )}
          </div>

          <div className="pay-preview" style={{ marginTop: 14 }}><span className="pay-preview-lbl">Total of selected challans</span><span className="pay-preview-val">{PKR(totalAmt)}</span></div>
        </div>
        <div className="pay-modal-foot">
          <button className="btn-secondary" onClick={onClose} disabled={busy}><i className="fa-solid fa-xmark" /> Cancel</button>
          <button className="btn-success" disabled={sel.size === 0 || busy} onClick={() => {
            if (!issueDate) return onToast('Please pick an issue date', 'warn')
            if (!dueDate) return onToast('Please pick a due date', 'warn')
            if (dueDate < issueDate) return onToast('Due date cannot be before the issue date', 'warn')
            if (issueDate < monthStart(month, year) || issueDate > monthEnd(month, year)) {
              return onToast(`Issue date must fall inside ${monthLabel(month, year)}`, 'warn')
            }
            /* Sirf tick kiye hue schools ke challan bante hain. */
            return onGenerate([...sel], dueDate, issueDate, month, year)
          }}>
            <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-bolt'}`} /> {busy ? 'Generating…' : `Generate ${sel.size} Challan${sel.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ══ Branded printable slips (challan & receiving) ══ */
const SLIP_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#e9eef6}
body{font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#0f172a}
.a4{width:210mm;min-height:160mm;margin:16px auto;background:#fff;padding:14mm;box-shadow:0 6px 28px rgba(15,23,42,.18);position:relative;overflow:hidden}
.sl-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px solid var(--ac);padding-bottom:14px;margin-bottom:18px}
.sl-brand{display:flex;gap:13px;align-items:center}
.sl-logo{width:56px;height:56px;border-radius:12px;background:var(--ac);color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.sl-logo-img{width:56px;height:56px;border-radius:12px;object-fit:cover;border:1px solid #e2e8f0;flex-shrink:0}
.sl-org{font-size:18px;font-weight:800}
.sl-org-line{font-size:11px;color:#64748b;margin-top:2px}
.sl-meta{text-align:right;flex-shrink:0}
.sl-doctag{display:inline-block;font-size:9px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:#fff;background:var(--ac);border-radius:99px;padding:3px 11px;margin-bottom:6px}
.sl-title{font-size:18px;font-weight:800;color:var(--ac)}
.sl-no{font-size:11px;color:#64748b;margin-top:3px}
.sl-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:13px 22px;margin-bottom:18px}
.sl-cell .k{font-size:8.5px;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;font-weight:800}
.sl-cell .v{font-size:13px;font-weight:700;color:#0f172a;margin-top:2px}
.sl-tbl{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px}
.sl-tbl th{background:var(--ac);color:#fff;padding:10px 13px;text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.5px}
.sl-tbl th.r,.sl-tbl td.r{text-align:right}
.sl-tbl td{padding:9px 13px;border-bottom:1px solid #e2e8f0;color:#1e293b}
.sl-tbl tr.total td{font-weight:800;border-top:2px solid var(--ac);background:#f1f5f9;font-size:15px;color:#0f172a}
.sl-note{font-size:11px;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:11px 13px;margin-bottom:20px;line-height:1.55}
.sl-sign{display:flex;justify-content:space-between;gap:40px;margin-top:38px}
.sl-sign div{flex:1;border-top:1.5px solid #94a3b8;padding-top:6px;font-size:10.5px;color:#64748b;text-align:center;font-weight:600}
.sl-stamp{position:absolute;top:135px;right:46px;transform:rotate(-13deg);border:3px solid var(--st);color:var(--st);font-size:24px;font-weight:900;letter-spacing:2px;padding:5px 16px;border-radius:10px;opacity:.85}
.sl-foot{margin-top:24px;border-top:1px solid #e2e8f0;padding-top:9px;font-size:9.5px;color:#94a3b8;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px}
@media print{html,body{background:#fff}.a4{width:auto;min-height:auto;margin:0;padding:0;box-shadow:none}@page{size:A4;margin:14mm}}
`

function slipDoc({ title, docTag, accent, slipNo, dateStr, info, rows, total, note, stamp }) {
  const chain = loadChainProfile()
  const logoHtml = chain.logo ? `<img class="sl-logo-img" src="${chain.logo}" alt="">` : `<div class="sl-logo">${escapeHtml(chainInitials(chain.chainName))}</div>`
  const infoHtml = info.map(([k, v]) => `<div class="sl-cell"><div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div></div>`).join('')
  const rowsHtml = rows.map(([l, v]) => `<tr><td>${escapeHtml(l)}</td><td class="r">${escapeHtml(v)}</td></tr>`).join('')
  const totalHtml = total ? `<tr class="total"><td>${escapeHtml(total[0])}</td><td class="r">${escapeHtml(total[1])}</td></tr>` : ''
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(chain.chainName)} — ${escapeHtml(title)}</title><style>${SLIP_CSS}</style></head>
<body><div class="a4" style="--ac:${accent};--st:${stamp ? stamp.color : '#16a34a'}">
  <div class="sl-head">
    <div class="sl-brand">${logoHtml}<div><div class="sl-org">${escapeHtml(chain.chainName)}</div><div class="sl-org-line">${escapeHtml(chain.address || '')}</div><div class="sl-org-line">${escapeHtml(chain.contact || '')}${chain.email ? ' · ' + escapeHtml(chain.email) : ''}</div></div></div>
    <div class="sl-meta"><div class="sl-doctag">${escapeHtml(docTag)}</div><div class="sl-title">${escapeHtml(title)}</div><div class="sl-no">No. ${escapeHtml(slipNo)} · ${escapeHtml(dateStr)}</div></div>
  </div>
  ${stamp ? `<div class="sl-stamp">${escapeHtml(stamp.text)}</div>` : ''}
  <div class="sl-grid">${infoHtml}</div>
  <table class="sl-tbl"><thead><tr><th>Description</th><th class="r">Amount (PKR)</th></tr></thead><tbody>${rowsHtml}${totalHtml}</tbody></table>
  ${note ? `<div class="sl-note">${escapeHtml(note)}</div>` : ''}
  <div class="sl-sign"><div>Received By</div><div>Authorised Signature</div></div>
  <div class="sl-foot"><span>${escapeHtml(chain.chainName)}${chain.website ? ' · ' + escapeHtml(chain.website) : ''}</span><span>System-generated · all amounts in PKR</span></div>
</div>
<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},300);};<\/script>
</body></html>`
}

function openSlip(html, onToast) {
  const w = window.open('', '_blank')
  if (!w) { onToast?.('Allow pop-ups to download / print the slip', 'warn'); return }
  w.document.open(); w.document.write(html); w.document.close()
}

function challanSlipHTML(school, challan, setup) {
  if (!challan) return ''
  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  /* Slip number challan ke apne mahine se banta hai (due date se nahi) —
     August ka challan September me due ho to bhi wo CH-…-202608 hi rahe. */
  const ym = challan.month && challan.year
    ? String(challan.year) + String(challan.month).padStart(2, '0')
    : (challan.dueDate || '').slice(0, 7).replace('-', '')
  const slipNo = `CH-${String(school.id).padStart(3, '0')}-${ym || 'NA'}`
  const formula = setup ? (setup.formula === 'lumpsum' ? 'Lump Sum / Month' : setup.formula === 'percentage' ? 'Percentage Royalty' : `Per Student (Rs ${setup.perStudentRate})`) : '—'
  const rows = [['Monthly Charge', PKR(challan.amount)]]
  if (challan.prevDues) rows.push(['Previous Dues', PKR(challan.prevDues)])
  return slipDoc({
    title: 'Fee Challan', docTag: 'Royalty Challan', accent: '#1E3A8A', slipNo, dateStr,
    info: [['Branch / School', school.name], ['Principal', school.principal || '—'], ['Billing Formula', formula], ['Students', String(school.students || setup?.studentCount || '—')], ['Challan Month', monthLabel(challan.month, challan.year) || '—'], ['Issue Date', challan.createdOn || dateStr], ['Due Date', challan.dueDate || '—']],
    rows, total: ['Total Payable', PKR(challan.total)],
    note: `Please pay the total payable amount on or before the due date (${challan.dueDate || '—'}). Payments may be made via bank transfer or the approved payment channels. Kindly retain this challan for your records.`,
  })
}

function recvSlipHTML(school, recv, challan, setup) {
  if (!recv) return ''
  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const totalDues = challan ? challan.total : (setup ? monthlyCharge(school, setup) : 0)
  const discount = recv.discount || 0
  const netPayable = recv.netPayable != null ? recv.netPayable : (totalDues - discount)
  const received = recv.receivedAmount || 0
  const remaining = recv.remainingAmount != null ? recv.remainingAmount : Math.max(0, netPayable - received)
  const paid = remaining <= 0
  /* Slip number wasooli ke mahine se, adaigi ki tareekh se nahi. */
  const slipNo = `RC-${String(school.id).padStart(3, '0')}-${recv.month ? String(recv.year) + String(recv.month).padStart(2, '0') : (recv.date || '').replace(/-/g, '').slice(2) || 'NA'}`
  const rows = [['Total Dues', PKR(totalDues)]]
  if (discount) rows.push(['Discount', '- ' + PKR(discount)])
  rows.push(['Net Payable', PKR(netPayable)], ['Amount Received', PKR(received)])
  return slipDoc({
    title: 'Payment Receipt', docTag: 'Fee Receipt', accent: '#0369A1', slipNo, dateStr,
    info: [['Branch / School', school.name], ['Principal', school.principal || '—'], ['Billing Month', monthLabel(recv.month, recv.year) || '—'], ['Payment Method', recv.via || '—'], ['Payment Date', recv.date || dateStr], ['Amount Received', PKR(received)], ['Status', paid ? 'Paid in Full' : 'Partial Payment']],
    rows, total: ['Remaining Balance', PKR(remaining)],
    note: `This receipt confirms the payment recorded above${recv.via ? ` via ${recv.via}` : ''}. ${paid ? 'The account is fully settled for this billing cycle.' : 'A balance remains outstanding — please clear it by the next due date.'}`,
    stamp: paid ? { text: 'PAID', color: '#16a34a' } : { text: 'PARTIAL', color: '#d97706' },
  })
}
