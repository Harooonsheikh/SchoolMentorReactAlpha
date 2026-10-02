import { useCallback, useEffect, useMemo, useState } from 'react'
import TutorialButton from '../../components/TutorialButton'
import SpinnerButton from '../../components/SpinnerButton'
import { createPortal } from 'react-dom'
import {
  loadAcc, saveAcc, rs, num, fmtDate, fmtStamp, periodLabel,
  bookCalc, monthsBetween, plForMonth,
  defaultFinAccountId, finAccountBalance, saveFinAccount, setFinAccountStatus, saveTransfer, deleteTransfer,
} from './data'
import {
  fetchAccountTypes, fetchAccountEntriesByMonth, fetchAllAccountEntries,
  saveAccountEntry, deleteAccountEntry,
  fetchAccountBooks, fetchAccountBookDetail, saveAccountBook, deleteAccountBook,
  saveAccountBookTxn, clearAccountHeadCache,
} from '../../api/accountsApi'
import { loadChainProfile, chainInitials } from '../../config/chainProfile'
import './Accounts.css'
import { CHAIN_API_BASE } from '@/config/env'
import { getStoredUser } from '@/auth/tokenStorage'
import { currentNetworkId } from '@/api/networkSchoolsApi'
const BASE = `${CHAIN_API_BASE}/api/accounts`

const authHeaders = (json = false) => {
  const u = getStoredUser?.() || {}
  const token = u.token || u.accessToken || u.access_token || u.jwt
  return {
    accept: '*/*',
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}
const getNetworkId = () =>
  Number(typeof currentNetworkId === 'function' ? currentNetworkId() : currentNetworkId) || 0
const getUserId = () => {
  const u = getStoredUser?.() || {}
  return Number(u.id ?? u.ID ?? u.userId ?? u.UserID) || 0
}
const thisMonthISO = () => new Date().toISOString().slice(0, 7)

const todayISO = () => new Date().toISOString().slice(0, 10)
const monthBounds = (m) => { const [y, mo] = m.split('-').map(Number); const last = new Date(y, mo, 0).getDate(); return { from: `${m}-01`, to: `${m}-${String(last).padStart(2, '0')}` } }
const callApi = async (url, method, body) => {
  try {
    const res = await fetch(url, {
      method,
      headers: authHeaders(body !== undefined),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    const json = await res.json().catch(() => ({}))
    console.log(method, url, res.status, json)
    const ok = res.ok && json.success !== false
    return { ok, status: res.status, message: json.message || (ok ? '' : `Request failed (${res.status})`), data: json.data }
  } catch (e) {
    console.error(method, url, e)
    return { ok: false, status: 0, message: 'Could not connect to the server' }
  }
}
const TYPE_NAME = { rev: 'Revenue', exp: 'Expense' }
const EDIT_METHODS = ['PUT', 'PATCH', 'POST']
export default function Accounts() {
  const [acc, setAcc] = useState(null)
  const [tab, setTab] = useState('coa')
  const [toast, setToast] = useState(null)
const [accountTypes, setAccountTypes] = useState([])
  const [headsLoading, setHeadsLoading] = useState(true)

 
  useEffect(() => {
    const a = loadAcc()
    setAcc({ ...a, types: a.types.map((t) => ({ ...t, heads: [] })) })
  }, [])
  useEffect(() => {
    let alive = true
    ;(async () => {
      const r = await callApi(`${BASE}/get-account-types`, 'GET')
      if (!alive) return
      if (r.ok) setAccountTypes(r.data || [])
      else { setHeadsLoading(false); setToast({ text: r.message || 'Could not load account types', type: 'warn' }) }
    })()
    return () => { alive = false }
  }, [])
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t) }, [toast])
 const loadHeads = async () => {
    setHeadsLoading(true)
    clearAccountHeadCache()  // heads badle → auto-post (Payments/HR) taza heads dekhe
    try {
      const nid = getNetworkId()
      const results = await Promise.all(
        Object.entries(TYPE_NAME).map(async ([key, name]) => {
          const typeId = accountTypes.find((t) => t.AccountTypeName === name)?.ID
          if (!typeId) return [key, null]
          const r = await callApi(`${BASE}/get-account-heads-by-network/${nid}/${typeId}`, 'GET')
          if (!r.ok) return [key, null]
          return [key, (r.data || [])
            .filter((h) => h.IsActive !== false)
            .map((h) => ({ no: h.ID, name: h.AccountHead, desc: h.Description || '' }))]
        }),
      )
      if (results.some(([, v]) => v === null)) fire('Some account heads could not be loaded', 'warn')
      setAcc((prev) => prev && ({
        ...prev,
        types: prev.types.map((t) => {
          const r = results.find(([k]) => k === t.key)
          return r && r[1] ? { ...t, heads: r[1] } : t
        }),
      }))
    } finally {
      setHeadsLoading(false)
    }
  }
  useEffect(() => {
    if (accountTypes.length && acc) loadHeads()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountTypes, !!acc])
  // Stable identity zaroori hai: fire/commit child ke effect deps me jaate hain
  // (Transactions loadEntries, Reports loader). Memoize na karein to har parent
  // re-render par naya function → child ka GET dobara chalta hai (2 dafa loader),
  // aur error par fire→re-render→refetch→error ka infinite loop (screen crash).
  const fire = useCallback((text, type = 'success') => setToast({ text, type }), [])
  const commit = useCallback((next) => { setAcc(next); saveAcc(next) }, [])
  if (!acc) return null

  return (
    <>
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}><i className="fa-solid fa-landmark" /></div>
          <div>
            <div className="page-title">Accounts</div>
            <div className="page-sub">Chart of accounts, daily transactions, account books &amp; financial reports.</div>
          </div>
        </div>
        <TutorialButton />
      </div>

      <div className="acc-tabs">
        {[['coa', 'fa-sitemap', 'Chart of Accounts'], ['txn', 'fa-right-left', 'Transactions'], ['accounts', 'fa-wallet', 'Wallets'], ['books', 'fa-book-open', 'Account Books'], ['reports', 'fa-chart-column', 'Reports']].map(([k, ic, lbl]) => (
          <button key={k} className={`acc-tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}><i className={`fa-solid ${ic}`} /> {lbl}</button>
        ))}
      </div>

{tab === 'coa' && <ChartOfAccounts acc={acc} commit={commit} fire={fire} accountTypes={accountTypes} reloadHeads={loadHeads} loading={headsLoading} />}      {tab === 'txn' && <Transactions fire={fire} />}
      {tab === 'accounts' && <AccountsManagementTab acc={acc} commit={commit} fire={fire} />}
      {tab === 'books' && <AccountBooks fire={fire} />}
      {tab === 'reports' && <Reports fire={fire} />}

      {toast && createPortal(
        <div className="ss-toast-wrap"><div className={`ss-toast ${toast.type}`}><i className={`fa-solid ${toast.type === 'success' ? 'fa-circle-check' : toast.type === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-info'}`} /> {toast.text}</div></div>,
        document.body,
      )}
    </>
  )
}

/* ════════ CHART OF ACCOUNTS ════════ */
function ChartOfAccounts({ acc, fire, accountTypes, reloadHeads, loading }) {
  const [open, setOpen] = useState({ exp: true, rev: false })
  const [headModal, setHeadModal] = useState(null) // { typeKey, head }
  const [del, setDel] = useState(null)

  // ADD => POST | EDIT => PUT (405 aaye to PATCH, phir POST) — same endpoint: save-account-head
  const saveHead = async (typeKey, payload, headNo) => {
    const typeId = accountTypes.find((t) => t.AccountTypeName === TYPE_NAME[typeKey])?.ID
    if (!typeId) return fire('Account types are still loading — please try again', 'warn')

    const isEdit = headNo != null
    const userId = getUserId()
    const body = {
      id: isEdit ? headNo : 0,        // edit par head ki real ID
      networkID: getNetworkId(),
      branchID: null,
      accountHead: payload.name,
      accountTypeID: typeId,          // Revenue => 1, Expense => 2
      description: payload.desc,
      createdBy: userId,
      modifiedBy: userId,
    }

    let r
    if (isEdit) {
      for (const m of EDIT_METHODS) {
        r = await callApi(`${BASE}/save-account-head`, m, body)
        if (r.status !== 405) break      // sirf 405 par agla method try karo
      }
    } else {
      r = await callApi(`${BASE}/save-account-head`, 'POST', body)
    }
    if (!r.ok) return fire(r.message || 'Save failed', 'warn')   // modal khula rahega

    setHeadModal(null)
    fire(isEdit ? 'Account head updated' : 'Account head added')
    await reloadHeads()
  }

  // DELETE: /delete-account-head/{headId}/{userId}
  const doDel = async () => {
    const r = await callApi(`${BASE}/delete-account-head/${del.no}/${getUserId()}`, 'DELETE')
    if (!r.ok) return fire(r.message || 'Delete failed', 'warn')  // confirm modal khula rahega

    setDel(null)
    fire('Account head deleted', 'info')
    await reloadHeads()
  }

  return (
    <>
      <div className="acc-overview-banner">
        <div className="acc-overview-ic"><i className="fa-solid fa-sitemap" /></div>
        <div>
          <div className="acc-overview-title">Chart of Accounts</div>
          <div className="acc-overview-sub">Organise finances under two top-level types — <strong>Expenses</strong> and <strong>Revenue</strong>. Add account heads under each type, then post transactions against them.</div>
        </div>
      </div>

      {acc.types.map((t) => (
        <div className="acc-coa-card" key={t.key}>
          <div className="acc-coa-head" onClick={() => setOpen((o) => ({ ...o, [t.key]: !o[t.key] }))}>
            <div className={`acc-coa-ic ${t.key}`}><i className={`fa-solid ${t.icon}`} /></div>
            <div><div className="acc-coa-name">{t.name}</div><div className="acc-coa-sub">{t.key === 'rev' ? 'Inflows — money the school receives' : 'Outflows — money the school spends'}</div></div>
            <span className="acc-coa-count">{loading ? <i className="fa-solid fa-spinner fa-spin" /> : `${t.heads.length} head${t.heads.length !== 1 ? 's' : ''}`}</span>
            <i className={`fa-solid fa-chevron-${open[t.key] ? 'up' : 'down'}`} style={{ color: 'var(--tm)', marginLeft: 10 }} />
          </div>
          {open[t.key] && (
            <div className="acc-coa-body">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '26px 0', color: 'var(--tm)', fontSize: 13, fontWeight: 600 }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} /> Loading account heads...
                </div>
              ) : (
                <>
                  {t.heads.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '18px 0', color: 'var(--tm)', fontSize: 13 }}>No heads yet</div>
                  )}
                  {t.heads.map((h) => (
                    <div className="acc-head-row" key={h.no}>
                      <span className="acc-head-no">#{h.no}</span>
                      <div style={{ flex: 1, minWidth: 0 }}><div className="acc-head-name">{h.name}</div>{h.desc && <div className="acc-head-desc">{h.desc}</div>}</div>
                      <button className="btn-sm" style={{ height: 28 }} onClick={() => setHeadModal({ typeKey: t.key, head: h })}><i className="fa-solid fa-pen" /></button>
                      <button className="btn-sm" style={{ height: 28, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={() => setDel({ typeKey: t.key, no: h.no, name: h.name })}><i className="fa-solid fa-trash-can" /></button>
                    </div>
                  ))}
                  <button className="btn-primary" style={{ marginTop: 4 }} onClick={() => setHeadModal({ typeKey: t.key })}><i className="fa-solid fa-plus" /> Add Head under {t.name}</button>
                </>
              )}
            </div>
          )}
        </div>
      ))}

      {headModal && <HeadModal modal={headModal} onClose={() => setHeadModal(null)} onSave={saveHead} onToast={fire} />}
      {del && <ConfirmModal title="Delete Account Head?" body={`“${del.name}” will be removed from the chart of accounts.`} onClose={() => setDel(null)} onConfirm={doDel} />}
    </>
  )
}
function HeadModal({ modal, onClose, onSave, onToast }) {
  const h = modal.head
  const [name, setName] = useState(h?.name || '')
  const [desc, setDesc] = useState(h?.desc || '')
  const save = () => { if (!name.trim()) return onToast('Please enter a head name', 'warn'); return onSave(modal.typeKey, { name: name.trim(), desc: desc.trim() }, h?.no) }
  return (
    <Shell title={h ? 'Edit Account Head' : 'Add Account Head'} icon="fa-folder-plus" onClose={onClose} maxWidth={460}
      foot={<><button className="btn-secondary" onClick={onClose}>Cancel</button><SpinnerButton icon="fa-floppy-disk" onClick={save}>Save</SpinnerButton></>}>
      <div className="acc-field" style={{ marginBottom: 14 }}><label>Head Name</label><input className="acc-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Building Rent" /></div>
      <div className="acc-field"><label>Description</label><input className="acc-input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description" /></div>
    </Shell>
  )
}

/* ════════ TRANSACTIONS ════════ */
function Transactions({ fire }) {
  const [seg, setSeg] = useState('rev')
  const [month, setMonth] = useState(thisMonthISO())
  const [search, setSearch] = useState('')
  const [entryModal, setEntryModal] = useState(null)
  const [del, setDel] = useState(null)

  const [types, setTypes] = useState([])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  // Heads (Chart of Accounts) — read-only, taake entry ka head dropdown bhare.
  useEffect(() => {
    let alive = true
    fetchAccountTypes().then((t) => { if (alive) setTypes(t) }).catch(() => { if (alive) setTypes([]) })
    return () => { alive = false }
  }, [])

  // Selected segment + month ki entries.
  const loadEntries = useCallback(async () => {
    setLoading(true)
    try { setEntries(await fetchAccountEntriesByMonth(seg, month)) }
    catch (e) { setEntries([]); fire(e?.message || 'Could not load entries', 'error') }
    finally { setLoading(false) }
  }, [seg, month, fire])
  useEffect(() => { loadEntries() }, [loadEntries])

  const heads = types.find((t) => t.key === seg)?.heads || []
  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter((x) => (!q || `${x.head}${x.detail}${x.amount}${x.date}`.toLowerCase().includes(q))).sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [entries, search])
  const total = list.reduce((a, x) => a + Number(x.amount || 0), 0)

  const saveEntry = async (payload, id) => {
    setBusy(true)
    try {
      await saveAccountEntry(seg, { ...payload, id: id || 0 })
      setEntryModal(null); fire(id ? 'Entry updated' : 'Entry recorded')
      loadEntries()
    } catch (e) { fire(e?.message || 'Could not save entry', 'error') }
    finally { setBusy(false) }
  }
  const doDel = async () => {
    try { await deleteAccountEntry(del.id); fire('Entry deleted', 'info'); loadEntries() }
    catch (e) { fire(e?.message || 'Could not delete entry', 'error') }
    finally { setDel(null) }
  }

  const downloadReport = () => {
    const cols = [{ label: 'Date', a: 'l' }, { label: 'Head', a: 'l' }, { label: 'Details', a: 'l' }, { label: 'Amount', a: 'r' }, { label: 'Recorded By', a: 'l' }]
    const rows = list.map((x) => [fmtDate(x.date), `#${x.headNo} · ${x.head}`, x.detail, num(x.amount), x.createdBy])
    printAccReport({
      title: seg === 'rev' ? 'Revenue Entries Report' : 'Expenditure Entries Report',
      period: periodLabel(month),
      filters: [['Type', seg === 'rev' ? 'Revenue' : 'Expenditure'], ['Period', periodLabel(month)], ['Entries', String(list.length)], ['Total', rs(total)]],
      columns: cols, rows, totals: ['', '', 'TOTAL', num(total), ''],
    }, fire)
  }

  return (
    <>
      <div className="acc-seg">
        <button className={`acc-seg-btn${seg === 'rev' ? ' active' : ''}`} onClick={() => setSeg('rev')}><i className="fa-solid fa-arrow-down-long" /> Revenues</button>
        <button className={`acc-seg-btn exp${seg === 'exp' ? ' active' : ''}`} onClick={() => setSeg('exp')}><i className="fa-solid fa-arrow-up-long" /> Expenditures</button>
      </div>

      <div className="acc-bar">
        <div className="acc-field"><label>Select Month</label><input className="acc-input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
        <button className="btn-primary" style={{ background: 'linear-gradient(135deg,#16A34A,#15803D)' }} onClick={() => setEntryModal({ mode: 'add' })} disabled={busy}><i className="fa-solid fa-plus" /> New {seg === 'rev' ? 'Revenue' : 'Expense'}</button>
        <div className="acc-field" style={{ flex: 1, minWidth: 220 }}><label>Search</label><div className="search-box"><i className="fa-solid fa-magnifying-glass" /><input className="search-input" placeholder="Search by head, details, amount or date" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
      </div>

      <div className="acc-kpis">
        <div className="acc-kpi info"><div className="acc-kpi-top"><i className="fa-solid fa-list" /> Entries</div><div className="acc-kpi-val">{list.length}</div><div className="acc-kpi-sub">{periodLabel(month)}</div></div>
        <div className={`acc-kpi ${seg === 'rev' ? 'green' : 'red'}`}><div className="acc-kpi-top"><i className={`fa-solid ${seg === 'rev' ? 'fa-arrow-down-long' : 'fa-arrow-up-long'}`} /> {seg === 'rev' ? 'Total Revenue' : 'Total Expense'}</div><div className="acc-kpi-val">{rs(total)}</div><div className="acc-kpi-sub">for the selected month</div></div>
      </div>

      <div className="section-card">
        <div className="card-header">
          <div className="card-title"><i className={`fa-solid ${seg === 'rev' ? 'fa-arrow-down-long' : 'fa-arrow-up-long'}`} /> {seg === 'rev' ? 'Revenue Entries' : 'Expenditure Entries'}</div>
          <button className="btn-secondary" onClick={downloadReport}><i className="fa-solid fa-file-export" /> Download Report</button>
        </div>
        <div className="tbl-wrap">
          <table className="acc-table">
            <thead><tr><th>Date</th><th>Head</th><th>Details</th><th className="r">Amount</th><th>Recorded By</th><th className="c">Action</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6}><div className="acc-empty"><i className="fa-solid fa-spinner fa-spin" /><div style={{ fontSize: 13, fontWeight: 700 }}>Loading entries…</div></div></td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={6}><div className="acc-empty"><i className="fa-solid fa-right-left" /><div style={{ fontSize: 13, fontWeight: 700 }}>No entries for {periodLabel(month)}</div></div></td></tr>
              ) : list.map((x) => (
                <tr key={x.id}>
                  <td>{fmtDate(x.date)}</td>
                  <td><div style={{ fontWeight: 700, color: 'var(--t1)' }}>{x.head}</div><small>#{x.headNo}{x.chqNo ? ` · ${x.chqNo}` : ''}</small></td>
                  <td style={{ maxWidth: 320 }}>{x.detail}</td>
                  <td className="r"><span className={seg === 'rev' ? 'amt-pos' : 'amt-neg'}>{num(x.amount)}</span></td>
                  <td><div>{x.createdBy}</div><small>{fmtStamp(x.createdAt)}{x.updatedBy ? ` · edited by ${x.updatedBy}` : ''}</small></td>
                  <td className="c">
                    <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
                      <button className="btn-sm" style={{ height: 28 }} onClick={() => setEntryModal({ mode: 'edit', txn: x })}><i className="fa-solid fa-pen" /></button>
                      <button className="btn-sm" style={{ height: 28, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={() => setDel(x)}><i className="fa-solid fa-trash-can" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {list.length > 0 && <tfoot><tr><td colSpan={3}>TOTAL — {periodLabel(month)}</td><td className="r">{rs(total)}</td><td colSpan={2} /></tr></tfoot>}
          </table>
        </div>
      </div>

      {entryModal && <TxnModal modal={entryModal} seg={seg} heads={heads} onClose={() => setEntryModal(null)} onSave={saveEntry} onToast={fire} />}
      {del && <ConfirmModal title="Delete Entry?" body="This transaction will be permanently removed." onClose={() => setDel(null)} onConfirm={doDel} />}
    </>
  )
}

function TxnModal({ modal, seg, heads, onClose, onSave, onToast }) {
  const x = modal.txn || {}
  const [v, setV] = useState({ headNo: x.headNo || '', date: x.date || todayISO(), detail: x.detail || '', amount: x.amount || '', chqNo: x.chqNo || '', chqDate: x.chqDate || '' })
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }))
  const save = () => {
    if (!v.headNo) return onToast('Please select an account head', 'warn')
    if (!v.amount || Number(v.amount) <= 0) return onToast('Please enter a valid amount', 'warn')
    return onSave(v, modal.mode === 'edit' ? x.id : null)
  }
  return (
    <Shell title={`${modal.mode === 'edit' ? 'Edit' : 'New'} ${seg === 'rev' ? 'Revenue' : 'Expense'} Entry`} icon={seg === 'rev' ? 'fa-arrow-down-long' : 'fa-arrow-up-long'} onClose={onClose}
      foot={<><button className="btn-secondary" onClick={onClose}>Cancel</button><SpinnerButton icon="fa-floppy-disk" onClick={save}>Save Entry</SpinnerButton></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="acc-field"><label>Account Head</label><select className="acc-input" value={v.headNo} onChange={set('headNo')}><option value="">Select Head</option>{heads.map((h) => <option key={h.no} value={h.no}>#{h.no} · {h.name}</option>)}</select></div>
        <div className="acc-field"><label>Date</label><input className="acc-input" type="date" value={v.date} onChange={set('date')} /></div>
      </div>
      <div className="acc-field" style={{ marginBottom: 12 }}><label>Amount (Rs)</label><input className="acc-input" type="number" value={v.amount} onChange={set('amount')} placeholder="0" /></div>
      <div className="acc-field" style={{ marginBottom: 12 }}><label>Details</label><textarea className="acc-input" rows={2} value={v.detail} onChange={set('detail')} placeholder="Description of this transaction" /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="acc-field"><label>Cheque No. (optional)</label><input className="acc-input" value={v.chqNo} onChange={set('chqNo')} placeholder="e.g. CHQ-44120" /></div>
        <div className="acc-field"><label>Cheque Date (optional)</label><input className="acc-input" type="date" value={v.chqDate} onChange={set('chqDate')} /></div>
      </div>
    </Shell>
  )
}

/* ════════ ACCOUNT BOOKS ════════ */
function AccountBooks({ fire }) {
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [openId, setOpenId] = useState(null)         // numeric bookID
  const [detail, setDetail] = useState(null)         // fetched book + ledger
  const [detailLoading, setDetailLoading] = useState(false)
  const [bookModal, setBookModal] = useState(false)
  const [txnModal, setTxnModal] = useState(false)
  const [del, setDel] = useState(null)               // bookID pending delete
  const [busy, setBusy] = useState(false)

  const refetch = useCallback(async () => {
    setLoading(true)
    try { setBooks(await fetchAccountBooks()) }
    catch (e) { setBooks([]); fire(e?.message || 'Could not load account books', 'error') }
    finally { setLoading(false) }
  }, [fire])
  useEffect(() => { refetch() }, [refetch])

  const loadDetail = useCallback(async (bookID) => {
    setDetailLoading(true)
    try { setDetail(await fetchAccountBookDetail(bookID)) }
    catch (e) { fire(e?.message || 'Could not load account book', 'error'); setDetail(null); setOpenId(null) }
    finally { setDetailLoading(false) }
  }, [fire])
  const openBook = (bookID) => { setOpenId(bookID); setDetail(null); loadDetail(bookID) }
  const closeBook = () => { setOpenId(null); setDetail(null) }

  const list = books.filter((b) => {
    const q = search.trim().toLowerCase()
    return (status === 'all' || b.status === status) && (!q || `${b.name}${b.party}${b.desc}`.toLowerCase().includes(q))
  })

  const addBook = async (payload) => {
    setBusy(true)
    try { await saveAccountBook(payload); setBookModal(false); fire('Account book created'); refetch() }
    catch (e) { fire(e?.message || 'Could not create account book', 'error') }
    finally { setBusy(false) }
  }
  const addTxn = async (payload) => {
    if (!openId) return
    setBusy(true)
    try { await saveAccountBookTxn({ bookId: openId, ...payload }); setTxnModal(false); fire('Ledger entry added'); await loadDetail(openId); refetch() }
    catch (e) { fire(e?.message || 'Could not add ledger entry', 'error') }
    finally { setBusy(false) }
  }
  const deleteBook = async () => {
    try { await deleteAccountBook(del); fire('Account book deleted', 'info'); closeBook(); refetch() }
    catch (e) { fire(e?.message || 'Could not delete account book', 'error') }
    finally { setDel(null) }
  }

  if (openId) {
    if (detailLoading || !detail) {
      return (
        <>
          <div className="acc-book-topbar">
            <button className="btn-secondary" onClick={closeBook}><i className="fa-solid fa-arrow-left" /> All Books</button>
            <div className="acc-book-topbar-title">Account Book</div>
          </div>
          <div className="acc-empty"><i className="fa-solid fa-spinner fa-spin" /><div style={{ fontSize: 13, fontWeight: 700 }}>Loading account book…</div></div>
        </>
      )
    }
    const book = detail
    const c = bookCalc(book)
    const ledgerReport = () => {
      printAccReport({
        title: `${book.name} — Ledger`,
        period: 'All transactions',
        filters: [['Party', book.party || '—'], ['Type', book.type], ['Opening', rs(book.opening)], ['Balance', rs(c.balance)]],
        columns: [{ label: '#', a: 'c' }, { label: 'Type', a: 'l' }, { label: 'Date', a: 'l' }, { label: 'Notes', a: 'l' }, { label: 'Amount', a: 'r' }, { label: 'Running Balance', a: 'r' }, { label: 'Entered By', a: 'l' }],
        rows: c.withBal.map((t, i) => [i + 1, t.type, fmtDate(t.date), t.notes, (t.type === 'returned' ? '-' : '') + num(Math.abs(t.amount)), num(t.runningBalance), t.enteredBy]),
        totals: ['', '', '', 'CLOSING BALANCE', '', num(c.balance), ''],
      }, fire)
    }
    return (
      <>
        <div className="acc-book-topbar">
          <button className="btn-secondary" onClick={closeBook}><i className="fa-solid fa-arrow-left" /> All Books</button>
          <div className="acc-book-topbar-title">{book.name}</div>
          <span className={`badge ${book.status === 'active' ? 'b-green' : book.status === 'settled' ? 'b-blue' : 'b-gray'}`} style={{ marginLeft: 'auto' }}>{book.status}</span>
          <button className="btn-secondary" onClick={ledgerReport}><i className="fa-solid fa-file-export" /> Ledger Report</button>
          <button className="btn-sm" style={{ height: 38, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={() => setDel(book.bookID)}><i className="fa-solid fa-trash-can" /> Delete</button>
        </div>

        <div className="acc-book-summary">
          <div className="acc-kpi"><div className="acc-kpi-top"><i className="fa-solid fa-flag" /> Opening</div><div className="acc-kpi-val">{rs(book.opening)}</div><div className="acc-kpi-sub">{fmtDate(book.openDate)}</div></div>
          <div className="acc-kpi amber"><div className="acc-kpi-top"><i className="fa-solid fa-down-long" /> Received / Credited</div><div className="acc-kpi-val">{rs(c.received)}</div></div>
          <div className="acc-kpi green"><div className="acc-kpi-top"><i className="fa-solid fa-up-long" /> Returned / Paid</div><div className="acc-kpi-val">{rs(c.returnedAll)}</div></div>
          <div className={`acc-kpi ${c.balance >= 0 ? 'red' : 'green'}`}><div className="acc-kpi-top"><i className="fa-solid fa-scale-balanced" /> Balance</div><div className="acc-kpi-val">{rs(c.balance)}</div><div className="acc-kpi-sub">{book.type === 'receivable' ? 'owed to school' : 'owed by school'}</div></div>
        </div>

        <div className="section-card">
          <div className="card-header">
            <div><div className="card-title"><i className="fa-solid fa-book-open" /> Ledger — {book.party}</div><div className="card-sub">{book.desc}</div></div>
            <button className="btn-primary" onClick={() => setTxnModal(true)} disabled={busy}><i className="fa-solid fa-plus" /> Add Entry</button>
          </div>
          <div className="tbl-wrap">
            <table className="acc-table">
              <thead><tr><th className="c">#</th><th>Type</th><th>Date</th><th>Notes</th><th className="r">Amount</th><th className="r">Balance</th><th>Entered By</th></tr></thead>
              <tbody>
                {c.withBal.length === 0 ? (
                  <tr><td colSpan={7}><div className="acc-empty"><i className="fa-solid fa-book-open" /><div style={{ fontSize: 13, fontWeight: 700 }}>No ledger entries yet</div></div></td></tr>
                ) : c.withBal.map((t, i) => (
                  <tr key={t.id}>
                    <td className="c" style={{ color: 'var(--tm)', fontWeight: 700 }}>{i + 1}</td>
                    <td><span className={`badge ${t.type === 'received' ? 'b-warn' : t.type === 'returned' ? 'b-green' : 'b-gray'}`}>{t.type}</span></td>
                    <td>{fmtDate(t.date)}</td>
                    <td style={{ maxWidth: 320 }}>{t.notes}<div><small>{fmtStamp(t.at)}</small></div></td>
                    <td className="r"><span className={t.type === 'returned' ? 'amt-pos' : t.type === 'adjustment' ? '' : 'amt-neg'}>{t.type === 'returned' ? '-' : t.type === 'adjustment' ? '' : '+'}{num(Math.abs(t.amount))}</span></td>
                    <td className="r" style={{ fontWeight: 800, color: 'var(--t1)' }}>{num(t.runningBalance)}</td>
                    <td>{t.enteredBy}</td>
                  </tr>
                ))}
              </tbody>
              {c.withBal.length > 0 && <tfoot><tr><td colSpan={5}>CLOSING BALANCE</td><td className="r">{num(c.balance)}</td><td /></tr></tfoot>}
            </table>
          </div>
        </div>

        {txnModal && <BookTxnModal onClose={() => setTxnModal(false)} onSave={addTxn} onToast={fire} />}
        {del && <ConfirmModal title="Delete Account Book?" body={`“${book.name}” and its full ledger history will be permanently deleted.`} onClose={() => setDel(null)} onConfirm={deleteBook} />}
      </>
    )
  }

  const totalPayable = books.filter((b) => b.type === 'payable').reduce((a, b) => a + bookCalc(b).balance, 0)
  const totalReceivable = books.filter((b) => b.type === 'receivable').reduce((a, b) => a + bookCalc(b).balance, 0)
  return (
    <>
      <div className="acc-overview-banner">
        <div className="acc-overview-ic" style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}><i className="fa-solid fa-book-open" /></div>
        <div>
          <div className="acc-overview-title">Account Books <span className="badge b-purple" style={{ marginLeft: 6 }}>Supplier, Vendor &amp; Party Ledgers</span></div>
          <div className="acc-overview-sub">A running account with any party the school owes or is owed — suppliers, vendors, owners or investors. Each book keeps a running balance with full history.</div>
        </div>
      </div>

      <div className="acc-kpis">
        <div className="acc-kpi info"><div className="acc-kpi-top"><i className="fa-solid fa-book" /> Total Books</div><div className="acc-kpi-val">{books.length}</div></div>
        <div className="acc-kpi red"><div className="acc-kpi-top"><i className="fa-solid fa-arrow-up-from-bracket" /> Total Payable</div><div className="acc-kpi-val">{rs(totalPayable)}</div><div className="acc-kpi-sub">owed by school</div></div>
        <div className="acc-kpi green"><div className="acc-kpi-top"><i className="fa-solid fa-arrow-down-to-bracket" /> Total Receivable</div><div className="acc-kpi-val">{rs(totalReceivable)}</div><div className="acc-kpi-sub">owed to school</div></div>
      </div>

      <div className="acc-bar">
        <div className="acc-field" style={{ flex: 1, minWidth: 240 }}><label>Search Books</label><div className="search-box"><i className="fa-solid fa-magnifying-glass" /><input className="search-input" placeholder="Search by book name, party or description" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
        <div className="acc-field"><label>Status</label><select className="acc-input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All Books</option><option value="active">Active</option><option value="settled">Settled</option><option value="closed">Closed</option></select></div>
        <button className="btn-primary" onClick={() => setBookModal(true)} disabled={busy}><i className="fa-solid fa-plus" /> Add New Account Book</button>
      </div>

      <div className="acc-books-grid">
        {loading ? <div className="acc-empty" style={{ gridColumn: '1/-1' }}><i className="fa-solid fa-spinner fa-spin" /><div style={{ fontSize: 14, fontWeight: 700 }}>Loading account books…</div></div>
          : list.length === 0 ? <div className="acc-empty" style={{ gridColumn: '1/-1' }}><i className="fa-solid fa-book-open" /><div style={{ fontSize: 14, fontWeight: 700 }}>No account books found</div></div>
          : list.map((b) => {
            const c = bookCalc(b)
            return (
              <div className="acc-book-card" key={b.id} onClick={() => openBook(b.bookID)}>
                <div className="acc-book-card-top">
                  <div className="acc-book-ic" style={b.type === 'receivable' ? { background: 'linear-gradient(135deg,#0369A1,#0284C7)' } : undefined}><i className={`fa-solid ${b.type === 'receivable' ? 'fa-hand-holding-dollar' : 'fa-store'}`} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}><div className="acc-book-name">{b.name}</div><div className="acc-book-party">{b.party}</div></div>
                </div>
                <div className="acc-book-bal">
                  <span className="acc-book-bal-lbl">{b.type === 'receivable' ? 'Receivable' : 'Payable'} Balance</span>
                  <span className="acc-book-bal-val" style={{ color: c.balance > 0 ? (b.type === 'receivable' ? 'var(--success)' : 'var(--err)') : 'var(--tm)' }}>{rs(c.balance)}</span>
                </div>
                <div className="acc-book-meta">
                  <span className={`badge ${b.status === 'active' ? 'b-green' : b.status === 'settled' ? 'b-blue' : 'b-gray'}`}>{b.status}</span>
                  {b.includeInCash && <span className="badge b-blue"><i className="fa-solid fa-wallet" style={{ fontSize: 8 }} /> In Cash</span>}
                  <span className="badge b-gray">{b.txns.length} entries</span>
                </div>
              </div>
            )
          })}
      </div>

      {bookModal && <BookModal onClose={() => setBookModal(false)} onSave={addBook} onToast={fire} />}
    </>
  )
}

function BookModal({ onClose, onSave, onToast }) {
  const [v, setV] = useState({ name: '', party: '', desc: '', type: 'payable', opening: '', openDate: todayISO(), includeInCash: false })
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }))
  const save = () => { if (!v.name.trim()) return onToast('Please enter a book name', 'warn'); return onSave({ ...v, name: v.name.trim(), party: v.party.trim(), desc: v.desc.trim() }) }
  return (
    <Shell title="Add Account Book" icon="fa-book-medical" onClose={onClose}
      foot={<><button className="btn-secondary" onClick={onClose}>Cancel</button><SpinnerButton icon="fa-floppy-disk" onClick={save}>Create Book</SpinnerButton></>}>
      <div className="acc-field" style={{ marginBottom: 12 }}><label>Book Name</label><input className="acc-input" value={v.name} onChange={set('name')} placeholder="e.g. Crescent Uniforms — Supplier" /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="acc-field"><label>Party</label><input className="acc-input" value={v.party} onChange={set('party')} placeholder="Supplier / vendor name" /></div>
        <div className="acc-field"><label>Type</label><select className="acc-input" value={v.type} onChange={set('type')}><option value="payable">Payable (we owe)</option><option value="receivable">Receivable (owed to us)</option></select></div>
      </div>
      <div className="acc-field" style={{ marginBottom: 12 }}><label>Description</label><input className="acc-input" value={v.desc} onChange={set('desc')} placeholder="What this account is for" /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="acc-field"><label>Opening Balance (Rs)</label><input className="acc-input" type="number" value={v.opening} onChange={set('opening')} placeholder="0" /></div>
        <div className="acc-field"><label>Opening Date</label><input className="acc-input" type="date" value={v.openDate} onChange={set('openDate')} /></div>
      </div>
      <label className="um-checkbox-row" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><input type="checkbox" checked={v.includeInCash} onChange={(e) => setV((s) => ({ ...s, includeInCash: e.target.checked }))} style={{ width: 16, height: 16, accentColor: 'var(--brand)' }} /> <span style={{ fontSize: 13, fontWeight: 600 }}>Include this book's balance in Cash In Hand</span></label>
    </Shell>
  )
}

function BookTxnModal({ onClose, onSave, onToast }) {
  const [v, setV] = useState({ type: 'received', amount: '', date: todayISO(), notes: '' })
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }))
  const save = () => { if (!v.amount) return onToast('Please enter an amount', 'warn'); return onSave(v) }
  return (
    <Shell title="Add Ledger Entry" icon="fa-plus" onClose={onClose} maxWidth={460}
      foot={<><button className="btn-secondary" onClick={onClose}>Cancel</button><SpinnerButton icon="fa-floppy-disk" onClick={save}>Add Entry</SpinnerButton></>}>
      <div className="acc-field" style={{ marginBottom: 12 }}><label>Entry Type</label><select className="acc-input" value={v.type} onChange={set('type')}><option value="received">Received / Credited (increases balance)</option><option value="returned">Returned / Paid (decreases balance)</option><option value="adjustment">Adjustment (signed)</option></select></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="acc-field"><label>Amount (Rs){v.type === 'adjustment' ? ' — use − for negative' : ''}</label><input className="acc-input" type="number" value={v.amount} onChange={set('amount')} placeholder="0" /></div>
        <div className="acc-field"><label>Date</label><input className="acc-input" type="date" value={v.date} onChange={set('date')} /></div>
      </div>
      <div className="acc-field"><label>Notes</label><textarea className="acc-input" rows={2} value={v.notes} onChange={set('notes')} placeholder="What is this entry for?" /></div>
    </Shell>
  )
}

/* ════════ REPORTS ════════ */
const REPORT_TYPES = [
  { key: 'revenue', label: 'Revenue Report', icon: 'fa-arrow-trend-up' },
  { key: 'expense', label: 'Expense Report', icon: 'fa-arrow-trend-down' },
  { key: 'pl', label: 'Profit & Loss', icon: 'fa-scale-balanced' },
  { key: 'cash', label: 'Cash In Hand', icon: 'fa-wallet' },
  { key: 'books', label: 'Account Books', icon: 'fa-book-open' },
  { key: 'headwise', label: 'Head-wise Summary', icon: 'fa-layer-group' },
  { key: 'overview', label: 'Financial Overview', icon: 'fa-chart-pie' },
]

function Reports({ fire }) {
  const month0 = thisMonthISO()
  const [type, setType] = useState('revenue')
  const mb = monthBounds(month0)
  const [ctrl, setCtrl] = useState({ from: mb.from, to: mb.to, head: 'all', plFrom: month0, plTo: month0, cashDate: mb.to })
  const set = (k) => (e) => setCtrl((s) => ({ ...s, [k]: e.target.value }))

  const [data, setData] = useState(null)   // { types, txns:{rev,exp}, books, month }
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([
      fetchAccountTypes().catch(() => []),
      fetchAllAccountEntries('rev').catch(() => []),
      fetchAllAccountEntries('exp').catch(() => []),
      fetchAccountBooks().catch(() => []),
    ]).then(([types, rev, exp, books]) => {
      if (!alive) return
      setData({ types, txns: { rev, exp }, books, month: month0 })
    }).catch((e) => {
      if (!alive) return
      setData({ types: [], txns: { rev: [], exp: [] }, books: [], month: month0 })
      fire(e?.message || 'Could not load report data', 'error')
    }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [fire, month0])

  const acc = useMemo(() => data || { types: [], txns: { rev: [], exp: [] }, books: [], month: month0 }, [data, month0])
  const report = useMemo(() => buildReport(acc, type, ctrl), [acc, type, ctrl])

  return (
    <>
      <div className="acc-rep-types">
        {REPORT_TYPES.map((rt) => (
          <button key={rt.key} className={`acc-rep-type${type === rt.key ? ' active' : ''}`} onClick={() => setType(rt.key)}><i className={`fa-solid ${rt.icon}`} /> {rt.label}</button>
        ))}
      </div>

      <div className="acc-bar">
        {(type === 'revenue' || type === 'expense' || type === 'headwise') && (
          <>
            <div className="acc-field"><label>From</label><input className="acc-input" type="date" value={ctrl.from} onChange={set('from')} /></div>
            <div className="acc-field"><label>To</label><input className="acc-input" type="date" value={ctrl.to} onChange={set('to')} /></div>
          </>
        )}
        {(type === 'revenue' || type === 'expense') && (
          <div className="acc-field"><label>Head</label><select className="acc-input" value={ctrl.head} onChange={set('head')}><option value="all">All Heads</option>{(acc.types.find((t) => t.key === (type === 'revenue' ? 'rev' : 'exp'))?.heads || []).map((h) => <option key={h.no} value={String(h.no)}>{h.name}</option>)}</select></div>
        )}
        {(type === 'pl' || type === 'overview') && (
          <>
            <div className="acc-field"><label>From Month</label><input className="acc-input" type="month" value={ctrl.plFrom} onChange={set('plFrom')} /></div>
            <div className="acc-field"><label>To Month</label><input className="acc-input" type="month" value={ctrl.plTo} onChange={set('plTo')} /></div>
          </>
        )}
        {type === 'cash' && <div className="acc-field"><label>As of Date</label><input className="acc-input" type="date" value={ctrl.cashDate} onChange={set('cashDate')} /></div>}
        <button className="acc-pdf-btn" disabled={loading} onClick={() => (report.rows.length ? printAccReport(report, fire) : fire('No data to export for this report', 'warn'))}><i className="fa-solid fa-file-pdf" /> Download A4 Report</button>
      </div>

      {report.kpis?.length > 0 && (
        <div className="acc-kpis">
          {report.kpis.map((k, i) => <div key={i} className={`acc-kpi ${k.cls || ''}`}><div className="acc-kpi-top"><i className={`fa-solid ${k.icon || 'fa-circle'}`} /> {k.label}</div><div className="acc-kpi-val" style={{ fontSize: 17 }}>{k.value}</div></div>)}
        </div>
      )}

      <div className="section-card">
        <div className="card-header"><div><div className="card-title"><i className={`fa-solid ${REPORT_TYPES.find((r) => r.key === type).icon}`} /> {report.title}</div><div className="card-sub">{report.period}</div></div></div>
        <div className="tbl-wrap">
          <table className="acc-table">
            <thead><tr>{report.columns.map((c, i) => <th key={i} className={c.a === 'r' ? 'r' : c.a === 'c' ? 'c' : ''}>{c.label}</th>)}</tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={report.columns.length}><div className="acc-empty"><i className="fa-solid fa-spinner fa-spin" /><div style={{ fontSize: 13, fontWeight: 700 }}>Loading report data…</div></div></td></tr>
              ) : report.rows.length === 0 ? (
                <tr><td colSpan={report.columns.length}><div className="acc-empty"><i className="fa-solid fa-chart-column" /><div style={{ fontSize: 13, fontWeight: 700 }}>No data for this report</div></div></td></tr>
              ) : report.rows.map((row, ri) => (
                <tr key={ri}>{row.map((cell, ci) => <td key={ci} className={report.columns[ci].a === 'r' ? 'r' : report.columns[ci].a === 'c' ? 'c' : ''}>{cell}</td>)}</tr>
              ))}
            </tbody>
            {report.totals && report.rows.length > 0 && <tfoot><tr>{report.totals.map((cell, i) => <td key={i} className={report.columns[i].a === 'r' ? 'r' : report.columns[i].a === 'c' ? 'c' : ''}>{cell}</td>)}</tr></tfoot>}
          </table>
        </div>
      </div>
    </>
  )
}

/* ── Build a unified report object for any type ── */
function buildReport(acc, type, ctrl) {
  const rangeLabel = () => `${fmtDate(ctrl.from)} → ${fmtDate(ctrl.to)}`
  if (type === 'revenue' || type === 'expense') {
    const seg = type === 'revenue' ? 'rev' : 'exp'
    const list = acc.txns[seg].filter((x) => (!ctrl.from || x.date >= ctrl.from) && (!ctrl.to || x.date <= ctrl.to) && (ctrl.head === 'all' || String(x.headNo) === ctrl.head)).sort((a, b) => (a.date < b.date ? -1 : 1))
    const total = list.reduce((a, x) => a + Number(x.amount || 0), 0)
    const headName = ctrl.head === 'all' ? 'All Heads' : (acc.types.find((t) => t.key === seg)?.heads.find((h) => String(h.no) === ctrl.head)?.name || '—')
    return {
      title: type === 'revenue' ? 'Revenue Report' : 'Expense Report', period: rangeLabel(),
      filters: [['Period', rangeLabel()], ['Head', headName], ['Entries', String(list.length)], ['Total', rs(total)]],
      kpis: [{ label: 'Entries', value: list.length, icon: 'fa-list', cls: 'info' }, { label: type === 'revenue' ? 'Total Revenue' : 'Total Expense', value: rs(total), icon: 'fa-coins', cls: type === 'revenue' ? 'green' : 'red' }],
      columns: [{ label: 'Date', a: 'l' }, { label: 'Head', a: 'l' }, { label: 'Details', a: 'l' }, { label: 'Recorded By', a: 'l' }, { label: 'Amount', a: 'r' }],
      rows: list.map((x) => [fmtDate(x.date), `#${x.headNo} · ${x.head}`, x.detail, x.createdBy, num(x.amount)]),
      totals: ['', '', '', 'TOTAL', num(total)],
    }
  }
  if (type === 'pl' || type === 'overview') {
    const months = monthsBetween(ctrl.plFrom, ctrl.plTo)
    const rows = months.map((m, i) => { const p = plForMonth(acc, m); return { i, m, ...p } })
    const tRev = rows.reduce((a, r) => a + r.rev, 0); const tExp = rows.reduce((a, r) => a + r.exp, 0); const tPL = tRev - tExp
    const margin = tRev ? Math.round((tPL / tRev) * 100) : 0
    const range = `${periodLabel(ctrl.plFrom)} → ${periodLabel(ctrl.plTo)}`
    const base = {
      period: range,
      filters: [['Period', range], ['Total Revenue', rs(tRev)], ['Total Expense', rs(tExp)], ['Net', rs(tPL)]],
      columns: [{ label: 'Sr', a: 'c' }, { label: 'Month', a: 'l' }, { label: 'Revenue', a: 'r' }, { label: 'Expense', a: 'r' }, { label: 'Profit / Loss', a: 'r' }],
      rows: rows.map((r) => [r.i + 1, periodLabel(r.m), num(r.rev), num(r.exp), (r.pl >= 0 ? '' : '−') + num(Math.abs(r.pl))]),
      totals: ['', 'TOTAL', num(tRev), num(tExp), (tPL >= 0 ? '' : '−') + num(Math.abs(tPL))],
    }
    if (type === 'overview') return { ...base, title: 'Financial Overview', kpis: [{ label: 'Total Revenue', value: rs(tRev), icon: 'fa-arrow-trend-up', cls: 'green' }, { label: 'Total Expense', value: rs(tExp), icon: 'fa-arrow-trend-down', cls: 'red' }, { label: 'Net Profit / Loss', value: rs(tPL), icon: 'fa-scale-balanced', cls: tPL >= 0 ? 'green' : 'red' }, { label: 'Profit Margin', value: `${margin}%`, icon: 'fa-percent', cls: 'info' }] }
    return { ...base, title: 'Profit & Loss Report', kpis: [{ label: 'Total Revenue', value: rs(tRev), icon: 'fa-arrow-trend-up', cls: 'green' }, { label: 'Total Expense', value: rs(tExp), icon: 'fa-arrow-trend-down', cls: 'red' }, { label: 'Net Profit / Loss', value: rs(tPL), icon: 'fa-scale-balanced', cls: tPL >= 0 ? 'green' : 'red' }] }
  }
  if (type === 'cash') {
    const revSum = acc.txns.rev.filter((x) => x.date <= ctrl.cashDate).reduce((a, x) => a + Number(x.amount || 0), 0)
    const expSum = acc.txns.exp.filter((x) => x.date <= ctrl.cashDate).reduce((a, x) => a + Number(x.amount || 0), 0)
    const plSum = revSum - expSum
    const rows = [['Sum of Profit / Loss', 'P&L', num(plSum)]]
    let total = plSum
    acc.books.filter((b) => b.includeInCash).forEach((b) => { const bal = bookCalc(b).balance; total += bal; rows.push([`Sum of ${b.name}`, 'Account Book', num(bal)]) })
    return {
      title: 'Cash In Hand Report', period: `As of ${fmtDate(ctrl.cashDate)}`,
      filters: [['As of', fmtDate(ctrl.cashDate)], ['Cash In Hand', rs(total)]],
      kpis: [{ label: 'Cash In Hand', value: rs(total), icon: 'fa-wallet', cls: total >= 0 ? 'green' : 'red' }, { label: 'Net P&L to date', value: rs(plSum), icon: 'fa-scale-balanced', cls: 'info' }],
      columns: [{ label: 'Source', a: 'l' }, { label: 'Type', a: 'l' }, { label: 'Amount', a: 'r' }],
      rows, totals: ['', 'CASH IN HAND', num(total)],
    }
  }
  if (type === 'books') {
    const rows = acc.books.map((b) => { const c = bookCalc(b); return [b.name, b.party || '—', b.type, num(b.opening), num(c.received), num(c.returnedAll), num(c.balance), b.includeInCash ? 'Yes' : 'No', b.status] })
    const totPay = acc.books.filter((b) => b.type === 'payable').reduce((a, b) => a + bookCalc(b).balance, 0)
    const totRec = acc.books.filter((b) => b.type === 'receivable').reduce((a, b) => a + bookCalc(b).balance, 0)
    return {
      title: 'Account Books Summary', period: 'All books',
      filters: [['Books', String(acc.books.length)], ['Total Payable', rs(totPay)], ['Total Receivable', rs(totRec)]],
      kpis: [{ label: 'Total Books', value: acc.books.length, icon: 'fa-book', cls: 'info' }, { label: 'Total Payable', value: rs(totPay), icon: 'fa-arrow-up-from-bracket', cls: 'red' }, { label: 'Total Receivable', value: rs(totRec), icon: 'fa-arrow-down-to-bracket', cls: 'green' }],
      columns: [{ label: 'Book', a: 'l' }, { label: 'Party', a: 'l' }, { label: 'Type', a: 'l' }, { label: 'Opening', a: 'r' }, { label: 'Received', a: 'r' }, { label: 'Returned', a: 'r' }, { label: 'Balance', a: 'r' }, { label: 'In Cash', a: 'c' }, { label: 'Status', a: 'c' }],
      rows, totals: null,
    }
  }
  // headwise
  const map = {}
  ;['rev', 'exp'].forEach((seg) => {
    acc.txns[seg].filter((x) => (!ctrl.from || x.date >= ctrl.from) && (!ctrl.to || x.date <= ctrl.to)).forEach((x) => {
      const key = `${seg}-${x.headNo}`
      if (!map[key]) map[key] = { type: seg === 'rev' ? 'Revenue' : 'Expenditure', headNo: x.headNo, head: x.head, count: 0, total: 0 }
      map[key].count += 1; map[key].total += Number(x.amount || 0)
    })
  })
  const grouped = Object.values(map).sort((a, b) => b.total - a.total)
  const grand = grouped.reduce((a, r) => a + r.total, 0)
  return {
    title: 'Head-wise Summary', period: rangeLabel(),
    filters: [['Period', rangeLabel()], ['Heads', String(grouped.length)], ['Total', rs(grand)]],
    kpis: [{ label: 'Heads', value: grouped.length, icon: 'fa-layer-group', cls: 'info' }, { label: 'Total Amount', value: rs(grand), icon: 'fa-coins', cls: 'green' }],
    columns: [{ label: 'Type', a: 'l' }, { label: 'Head', a: 'l' }, { label: 'Entries', a: 'c' }, { label: 'Total Amount', a: 'r' }],
    rows: grouped.map((r) => [r.type, `#${r.headNo} · ${r.head}`, r.count, num(r.total)]),
    totals: ['', 'TOTAL', '', num(grand)],
  }
}

/* ════════ A4 BRANDED REPORT PRINT (head-office header + footer on each page) ════════ */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

function printAccReport(report, onToast) {
  const chain = loadChainProfile()
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) + ' · ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const logo = chain.logo ? `<img class="rep-logo-img" src="${chain.logo}" alt="">` : `<div class="rep-logo">${esc(chainInitials(chain.chainName))}</div>`
  const filters = (report.filters || []).map(([l, v]) => `<span><b>${esc(l)}:</b> ${esc(v)}</span>`).join('')
  const thead = report.columns.map((c) => `<th class="${c.a === 'r' ? 'r' : c.a === 'c' ? 'c' : ''}">${esc(c.label)}</th>`).join('')
  const tbody = report.rows.map((row) => `<tr>${row.map((cell, i) => `<td class="${report.columns[i].a === 'r' ? 'r' : report.columns[i].a === 'c' ? 'c' : ''}">${esc(cell)}</td>`).join('')}</tr>`).join('')
  const tfoot = report.totals ? `<tr class="rep-tot">${report.totals.map((cell, i) => `<td class="${report.columns[i].a === 'r' ? 'r' : report.columns[i].a === 'c' ? 'c' : ''}">${esc(cell)}</td>`).join('')}</tr>` : ''

  const header = `<div class="rep-head">${logo}<div class="rep-head-txt"><div class="rep-name">${esc(chain.chainName)}</div><div class="rep-org-line">${esc(chain.address || '')}</div><div class="rep-org-line">${esc(chain.contact || '')}${chain.email ? ' · ' + esc(chain.email) : ''}</div></div><div class="rep-meta"><div class="rep-title">${esc(report.title)}</div><div class="rep-period">${esc(report.period || '')}</div></div></div>${filters ? `<div class="rep-filters">${filters}</div>` : ''}`
  const footer = `<div class="rep-foot"><span>${esc(chain.chainName)}${chain.contact ? ' · ' + esc(chain.contact) : ''}</span><span>Computer-generated report · ${esc(report.title)} · ${esc(dateStr)}</span></div>`

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(chain.chainName)} — ${esc(report.title)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#e9eef6}
body{font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#111;font-size:10.5px;line-height:1.4}
.a4{width:210mm;min-height:297mm;margin:14px auto;background:#fff;padding:13mm;box-shadow:0 6px 28px rgba(15,23,42,.18)}
.rep-table{width:100%;border-collapse:collapse}
.rep-table > thead{display:table-header-group}
.rep-table > tfoot{display:table-footer-group}
.rep-head{display:flex;align-items:flex-start;gap:13px;border-bottom:2.5px solid #1E3A8A;padding-bottom:10px;margin-bottom:10px}
.rep-logo{width:48px;height:48px;border:2px solid #1E3A8A;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;color:#1E3A8A;font-size:15px;flex-shrink:0}
.rep-logo-img{width:48px;height:48px;border-radius:12px;object-fit:cover;flex-shrink:0;border:1px solid #e2e8f0}
.rep-head-txt{flex:1}
.rep-name{font-size:18px;font-weight:800;color:#1E3A8A;line-height:1.1}
.rep-org-line{font-size:10.5px;color:#555;margin-top:2px}
.rep-meta{text-align:right}
.rep-title{font-size:13px;font-weight:800;color:#1E3A8A}
.rep-period{font-size:11px;color:#555;margin-top:2px}
.rep-filters{display:flex;flex-wrap:wrap;gap:5px 20px;font-size:10.5px;color:#333;margin-bottom:12px;background:#F1F5FB;padding:9px 13px;border-radius:6px}
.data{width:100%;border-collapse:collapse;font-size:10px;margin-top:2px}
.data th{background:#1E3A8A;color:#fff;padding:6px 8px;text-align:left;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px}
.data th.r,.data td.r{text-align:right}.data th.c,.data td.c{text-align:center}
.data td{padding:5px 8px;border-bottom:1px solid #e5e9f2;vertical-align:top}
.data tbody tr:nth-child(even) td{background:#f8fafc}
.data .rep-tot td{background:#EAF0FA;font-weight:800;border-top:2px solid #1E3A8A}
.rep-foot{display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-top:14px;font-size:9px;color:#888;border-top:1px solid #e5e9f2;padding-top:8px}
@media print{html,body{background:#fff}.a4{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}@page{size:A4 portrait;margin:13mm}}
</style></head>
<body>
<div class="a4">
  <table class="rep-table">
    <thead><tr><td>${header}</td></tr></thead>
    <tfoot><tr><td>${footer}</td></tr></tfoot>
    <tbody><tr><td>
      <table class="data"><thead><tr>${thead}</tr></thead><tbody>${tbody || `<tr><td colspan="${report.columns.length}" style="text-align:center;padding:24px;color:#999">No records.</td></tr>`}</tbody>${tfoot ? `<tfoot>${tfoot}</tfoot>` : ''}</table>
    </td></tr></tbody>
  </table>
</div>
<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},300);};<\/script>
</body></html>`

  const w = window.open('', '_blank')
  if (!w) { onToast?.('Allow pop-ups to download / print the report', 'warn'); return }
  w.document.open(); w.document.write(html); w.document.close()
}

/* ════════ shared modal shells ════════ */
function Shell({ title, icon, maxWidth, foot, children, onClose }) {
  return createPortal(
    <div className="pay-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pay-modal" style={{ maxWidth: maxWidth || 560 }}>
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

function ConfirmModal({ title, body, onClose, onConfirm, icon = 'fa-trash-can', confirmLabel = 'Delete', tone = 'danger' }) {
  const iconStyle = tone === 'danger'
    ? { background: 'rgba(220,38,38,.1)', border: '2px solid rgba(220,38,38,.25)', color: '#DC2626' }
    : { background: 'rgba(30,58,138,.1)', border: '2px solid rgba(30,58,138,.25)', color: '#1E40AF' }
  return createPortal(
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-body" style={{ textAlign: 'center', padding: '40px 30px' }}>
          <div className="confirm-icon" style={iconStyle}><i className={`fa-solid ${icon}`} /></div>
          <div className="confirm-title">{title}</div>
          <div className="confirm-sub">{body}</div>
          <div className="confirm-btns">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <SpinnerButton className={tone === 'danger' ? 'btn-danger' : 'btn-primary'} icon={icon} onClick={onConfirm}>{confirmLabel}</SpinnerButton>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ════════ WALLETS (ACCOUNTS MANAGEMENT) ════════
   Where the school physically holds money (cash till, bank accounts,
   owner wallet, anything else), transfers between them, and a bank-style
   statement per wallet. Demo/localStorage-backed via ./data — wire it to
   the chain accounts API when wallet endpoints exist. Transfers move
   balances only (their own acc.transfers array) and never touch
   Profit & Loss. */
const FIN_TYPES = [
  { key: 'cash', label: 'Cash', icon: 'fa-money-bill-wave' },
  { key: 'bank', label: 'Bank', icon: 'fa-building-columns' },
  { key: 'owner', label: 'Owner', icon: 'fa-user-tie' },
  { key: 'other', label: 'Other', icon: 'fa-wallet' },
]
const finTypeMeta = (key) => FIN_TYPES.find((t) => t.key === key) || FIN_TYPES[3]

function AccountsManagementTab({ acc, commit, fire }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [editAccount, setEditAccount] = useState(null) // { mode:'add'|'edit', account? }
  const [transferOpen, setTransferOpen] = useState(false)
  const [statementFor, setStatementFor] = useState(null)
  const [toggleTarget, setToggleTarget] = useState(null) // account being disabled (confirm)
  const [delTransfer, setDelTransfer] = useState(null)

  const defaultId = defaultFinAccountId(acc)
  const activeAccounts = acc.finAccounts.filter((a) => a.status === 'active')
  const balanceOf = (a) => finAccountBalance(acc, a)

  const filtered = acc.finAccounts.filter((a) => {
    const q = search.trim().toLowerCase()
    const matchQ = !q || a.name.toLowerCase().includes(q) || (a.bankName || '').toLowerCase().includes(q) || (a.accountNo || '').includes(q)
    return matchQ && (status === 'all' || a.status === status)
  })
  const totalOpening = acc.finAccounts.reduce((a, x) => a + (Number(x.opening) || 0), 0)
  const totalCurrent = acc.finAccounts.reduce((a, x) => a + balanceOf(x), 0)

  const onSaveAccount = (payload) => {
    const id = editAccount?.mode === 'edit' ? editAccount.account.id : undefined
    commit(saveFinAccount(acc, payload, id))
    fire(id ? 'Account updated' : 'Account created')
    setEditAccount(null)
  }
  const onToggleStatus = (a) => {
    if (a.status === 'active') { setToggleTarget(a); return }
    commit(setFinAccountStatus(acc, a.id, 'active'))
    fire(`${a.name} re-enabled`)
  }
  const confirmDisable = () => {
    commit(setFinAccountStatus(acc, toggleTarget.id, 'inactive'))
    fire(`${toggleTarget.name} disabled`, 'info')
    setToggleTarget(null)
  }
  const onSaveTransfer = (payload) => {
    commit(saveTransfer(acc, payload))
    const fromName = acc.finAccounts.find((a) => a.id === payload.fromId)?.name || 'account'
    const toName = acc.finAccounts.find((a) => a.id === payload.toId)?.name || 'account'
    fire(`Transferred ${rs(payload.amount)} from ${fromName} to ${toName}`)
    setTransferOpen(false)
  }
  const confirmDeleteTransfer = () => {
    commit(deleteTransfer(acc, delTransfer.id))
    fire('Transfer deleted', 'info')
    setDelTransfer(null)
  }

  return (
    <>
      <div className="acc-overview-banner">
        <div className="acc-overview-ic" style={{ background: 'linear-gradient(135deg,#0891B2,#0E7490)' }}><i className="fa-solid fa-wallet" /></div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div className="acc-overview-title">Wallets <span className="acc-books-tagchip">Cash, Bank &amp; Owner Accounts</span></div>
          <div className="acc-overview-sub">Manage every place the school holds money. This includes <strong>Cash In Hand, bank accounts, and owner or custom wallets</strong>. Move balances between accounts, choose where each income lands and each expense is paid from, and view a full bank-style statement per account. <strong>Transfers move balances only. They never affect Profit &amp; Loss.</strong></div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="acc-ov-stat"><div className="acc-ov-stat-ic all"><i className="fa-solid fa-layer-group" /></div><div><div className="acc-ov-stat-val">{acc.finAccounts.length}</div><div className="acc-ov-stat-lbl">Accounts &middot; {activeAccounts.length} active</div></div></div>
          <div className="acc-ov-stat"><div className="acc-ov-stat-ic" style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}><i className="fa-solid fa-flag" /></div><div><div className="acc-ov-stat-val">{rs(totalOpening)}</div><div className="acc-ov-stat-lbl">Total Opening</div></div></div>
          <div className="acc-ov-stat"><div className="acc-ov-stat-ic" style={{ background: 'linear-gradient(135deg,#0891B2,#0E7490)' }}><i className="fa-solid fa-wallet" /></div><div><div className="acc-ov-stat-val">{rs(totalCurrent)}</div><div className="acc-ov-stat-lbl">Total Available</div></div></div>
        </div>
      </div>

      <div className="acc-bar">
        <div className="acc-field" style={{ flex: 1, minWidth: 240 }}><label>Search Accounts</label><div className="search-box"><i className="fa-solid fa-magnifying-glass" /><input className="search-input" placeholder="Search by account name, bank or type" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
        <div className="acc-field"><label>Status</label><select className="acc-input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All Accounts</option><option value="active">Active</option><option value="inactive">Disabled</option></select></div>
        <button className="btn-secondary" onClick={() => setTransferOpen(true)} disabled={activeAccounts.length < 2} style={{ borderColor: 'rgba(8,145,178,.4)', color: '#0E7490' }}><i className="fa-solid fa-right-left" /> Transfer Money</button>
        <button className="btn-primary" onClick={() => setEditAccount({ mode: 'add' })}><i className="fa-solid fa-plus" /> Create Account</button>
      </div>

      <div className="acc-books-grid">
        {filtered.length === 0 ? <div className="acc-empty" style={{ gridColumn: '1/-1' }}><i className="fa-solid fa-wallet" /><div style={{ fontSize: 14, fontWeight: 700 }}>No accounts found</div></div>
          : filtered.map((a) => {
            const tm = finTypeMeta(a.type)
            const bal = balanceOf(a)
            const sub = a.type === 'bank' && (a.bankName || a.accountNo)
              ? `${a.bankName || 'Bank'}${a.accountNo ? ` · ${a.accountNo}` : ''}`
              : (a.description || `${tm.label} account`)
            return (
              <div className={`acc-wallet-card${a.status === 'inactive' ? ' inactive' : ''}`} key={a.id}>
                <div className="acc-wallet-card-top">
                  <div className={`acc-wallet-ic ${a.type}`}><i className={`fa-solid ${tm.icon}`} /></div>
                  <div className="acc-wallet-tt">
                    <div className="acc-wallet-name">
                      {a.name}
                      {a.isDefault && <span className="acc-default-chip"><i className="fa-solid fa-star" /> Default</span>}
                    </div>
                    <div className="acc-wallet-sub">
                      <span className={`acc-type-badge ${a.type}`}><i className={`fa-solid ${tm.icon}`} /> {tm.label}</span>
                      <span className={`badge ${a.status === 'active' ? 'b-green' : 'b-gray'}`}>{a.status === 'active' ? 'Active' : 'Disabled'}</span>
                    </div>
                  </div>
                </div>
                <div className="acc-wallet-body">
                  <div className="acc-wallet-balrow">
                    <div className="acc-wallet-bal"><div className="acc-wallet-bal-lbl">Opening</div><div className="acc-wallet-bal-val">{rs(a.opening)}</div></div>
                    <div className="acc-wallet-bal current"><div className="acc-wallet-bal-lbl">Current Balance</div><div className="acc-wallet-bal-val" style={{ color: bal < 0 ? 'var(--err)' : undefined }}>{rs(bal)}</div></div>
                  </div>
                  <div style={{ marginTop: 11, fontSize: 11.5, color: 'var(--tm)', lineHeight: 1.5 }}>{sub}</div>
                </div>
                <div className="acc-wallet-foot">
                  <button className="btn-sm acc-wallet-stmtbtn" style={{ height: 28 }} onClick={() => setStatementFor(a)}><i className="fa-solid fa-file-invoice-dollar" /> View Statement</button>
                  <button className="btn-sm" style={{ height: 28 }} onClick={() => setEditAccount({ mode: 'edit', account: a })}><i className="fa-solid fa-pen" /></button>
                  {!a.isDefault && (
                    <button
                      className="btn-sm"
                      style={a.status === 'active' ? { height: 28, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' } : { height: 28 }}
                      onClick={() => onToggleStatus(a)}
                    >
                      <i className={`fa-solid ${a.status === 'active' ? 'fa-ban' : 'fa-circle-check'}`} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
      </div>

      <div className="section-card" style={{ marginTop: 18 }}>
        <div className="card-header"><div className="card-title"><i className="fa-solid fa-right-left" /> Transfer History</div></div>
        <div className="tbl-wrap">
          <table className="acc-table">
            <thead><tr><th>Date</th><th>From Account</th><th>To Account</th><th>Note</th><th className="r">Amount</th><th>Entered By</th><th className="c">Action</th></tr></thead>
            <tbody>
              {acc.transfers.length === 0 ? (
                <tr><td colSpan={7}><div className="acc-empty"><i className="fa-solid fa-right-left" /><div style={{ fontSize: 13, fontWeight: 700 }}>No transfers yet</div></div></td></tr>
              ) : [...acc.transfers].sort((a, b) => (b.date + b.at).localeCompare(a.date + a.at)).map((t) => (
                <tr key={t.id}>
                  <td>{fmtDate(t.date)}</td>
                  <td><span className="acc-stmt-tag debit"><i className="fa-solid fa-arrow-up-long" /> {acc.finAccounts.find((a) => a.id === t.fromId)?.name || '—'}</span></td>
                  <td><span className="acc-stmt-tag credit"><i className="fa-solid fa-arrow-down-long" /> {acc.finAccounts.find((a) => a.id === t.toId)?.name || '—'}</span></td>
                  <td>{t.note || '—'}</td>
                  <td className="r">{num(t.amount)}</td>
                  <td>{t.by || '—'}</td>
                  <td className="c"><button className="btn-sm" style={{ height: 28, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={() => setDelTransfer(t)}><i className="fa-solid fa-trash-can" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editAccount && <FinAccountModal cfg={editAccount} onClose={() => setEditAccount(null)} onSave={onSaveAccount} onToast={fire} />}
      {transferOpen && <TransferModal accounts={activeAccounts} users={acc.users} currentUser={acc.currentUser} balanceOf={balanceOf} onClose={() => setTransferOpen(false)} onSave={onSaveTransfer} onToast={fire} />}
      {statementFor && <FinAccountStatementModal account={statementFor} acc={acc} defaultId={defaultId} onClose={() => setStatementFor(null)} onToast={fire} />}
      {toggleTarget && (
        <ConfirmModal
          title="Disable this account?"
          body={`"${toggleTarget.name}" will be hidden from account pickers. Its balance and history are kept, and it can be re-enabled any time.`}
          icon="fa-ban" confirmLabel="Yes, Disable" tone="primary"
          onClose={() => setToggleTarget(null)}
          onConfirm={confirmDisable}
        />
      )}
      {delTransfer && (
        <ConfirmModal
          title="Delete this transfer?"
          body="Both account balances will recalculate. This action cannot be undone."
          onClose={() => setDelTransfer(null)}
          onConfirm={confirmDeleteTransfer}
        />
      )}
    </>
  )
}

function FinAccountModal({ cfg, onClose, onSave, onToast }) {
  const isEdit = cfg.mode === 'edit'
  const isDefault = !!cfg.account?.isDefault
  const a = cfg.account || {}
  const [v, setV] = useState({
    name: a.name || '', type: a.type || 'cash', opening: a.opening ?? '',
    status: a.status || 'active', bankName: a.bankName || '', accountNo: a.accountNo || '', description: a.description || '',
  })
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }))
  const showBank = v.type === 'bank'
  const showAccountNo = v.type === 'bank' || v.type === 'other'
  const save = () => {
    if (!v.name.trim()) return onToast('Please enter an account name', 'warn')
    onSave({
      name: v.name.trim(), type: v.type, opening: Number(v.opening) || 0,
      status: isDefault ? 'active' : v.status,
      bankName: showBank ? v.bankName.trim() : '',
      accountNo: showAccountNo ? v.accountNo.trim() : '',
      description: v.description.trim(),
    })
  }
  return (
    <Shell title={isEdit ? 'Edit Account' : 'Create Account'} icon={isEdit ? 'fa-pen-to-square' : 'fa-wallet'} onClose={onClose}
      foot={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> {isEdit ? 'Save Changes' : 'Save Account'}</button></>}>
      <div className="acc-info-note" style={{ marginBottom: 14 }}>
        <i className="fa-solid fa-circle-info" /> An account is a wallet where the school holds money. This includes <strong>Cash In Hand, a bank account, the owner&apos;s account</strong> or any custom location. Income can be received into it and expenses paid from it.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="acc-field"><label>Account Name *</label><input className="acc-input" value={v.name} onChange={set('name')} placeholder="e.g. Bank of Punjab" /></div>
        <div className="acc-field"><label>Account Type *</label><select className="acc-input" value={v.type} onChange={set('type')}>{FIN_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="acc-field"><label>Opening Balance</label><input className="acc-input" type="number" value={v.opening} onChange={set('opening')} placeholder="0" /></div>
        <div className="acc-field"><label>Status</label><select className="acc-input" value={v.status} onChange={set('status')} disabled={isDefault}><option value="active">Active</option><option value="inactive">Disabled</option></select></div>
      </div>
      {(showBank || showAccountNo) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          {showBank && <div className="acc-field"><label>Bank Name (optional)</label><input className="acc-input" value={v.bankName} onChange={set('bankName')} placeholder="e.g. Bank Alfalah" /></div>}
          {showAccountNo && <div className="acc-field"><label>Account Number (optional)</label><input className="acc-input" value={v.accountNo} onChange={set('accountNo')} placeholder="e.g. PK00-XXXX-0000-0000" /></div>}
        </div>
      )}
      <div className="acc-field"><label>Description</label><textarea className="acc-input" rows={2} value={v.description} onChange={set('description')} placeholder="Short description of this account" /></div>
      {isDefault && (
        <div className="acc-info-note" style={{ marginTop: 12 }}>
          <i className="fa-solid fa-star" /> This is the <strong>default receiving account</strong>. It always stays active and receives income unless another account is chosen.
        </div>
      )}
    </Shell>
  )
}

function TransferModal({ accounts, users, currentUser, balanceOf, onClose, onSave, onToast }) {
  const [v, setV] = useState({ fromId: accounts[0]?.id || '', toId: accounts[1]?.id || accounts[0]?.id || '', amount: '', date: todayISO(), note: '', by: currentUser || 'Sana Malik' })
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }))
  const fromAcct = accounts.find((a) => a.id === v.fromId)
  const toAcct = accounts.find((a) => a.id === v.toId)
  const fromBal = fromAcct ? balanceOf(fromAcct) : 0
  const toBal = toAcct ? balanceOf(toAcct) : 0
  const amt = Number(v.amount) || 0
  const sameAccount = !!v.fromId && v.fromId === v.toId
  const overdraft = amt > 0 && fromBal - amt < 0
  const save = () => {
    if (!v.fromId || !v.toId) return onToast('Please choose both accounts', 'warn')
    if (v.fromId === v.toId) return onToast('Source and destination must be different', 'warn')
    if (!amt || amt <= 0) return onToast('Please enter a valid amount', 'warn')
    onSave({ fromId: v.fromId, toId: v.toId, amount: amt, date: v.date, note: v.note.trim(), by: v.by || 'Sana Malik' })
  }
  return (
    <Shell title="Transfer Money" icon="fa-right-left" onClose={onClose}
      foot={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save} disabled={sameAccount}><i className="fa-solid fa-right-left" /> Transfer</button></>}>
      <div className="acc-info-note" style={{ marginBottom: 14 }}>
        <i className="fa-solid fa-circle-info" /> A transfer moves a balance between two accounts only. The source account decreases and the destination increases. <strong>This is not income or an expense and does not affect Profit &amp; Loss.</strong>
      </div>

      <div className="acc-xfer-flow">
        <div className="acc-field"><label>From Account *</label><select className="acc-input" value={v.fromId} onChange={set('fromId')}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} — {finTypeMeta(a.type).label}</option>)}</select><div className="acc-xfer-bal"><i className="fa-solid fa-wallet" /> Available: {rs(fromBal)}</div></div>
        <div className="acc-xfer-arrow"><i className="fa-solid fa-arrow-right-long" /></div>
        <div className="acc-field"><label>To Account *</label><select className="acc-input" value={v.toId} onChange={set('toId')}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} — {finTypeMeta(a.type).label}</option>)}</select><div className="acc-xfer-bal"><i className="fa-solid fa-wallet" /> Available: {rs(toBal)}</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '16px 0 12px' }}>
        <div className="acc-field"><label>Amount *</label><input className="acc-input" type="number" value={v.amount} onChange={set('amount')} placeholder="Enter amount" /></div>
        <div className="acc-field"><label>Date</label><input className="acc-input" type="date" value={v.date} onChange={set('date')} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="acc-field"><label>Entered By</label><select className="acc-input" value={v.by} onChange={set('by')}>{(users || []).map((u) => <option key={u} value={u}>{u}</option>)}</select></div>
        <div className="acc-field"><label>Note</label><input className="acc-input" value={v.note} onChange={set('note')} placeholder="e.g. Deposit cash to bank" /></div>
      </div>

      {amt > 0 && v.fromId && v.toId && (
        <div className={`acc-xfer-preview${sameAccount || overdraft ? ' err' : ''}`}>
          {sameAccount ? (
            <>
              <div className="acc-xfer-preview-h"><i className="fa-solid fa-triangle-exclamation" /> Invalid transfer</div>
              <div className="acc-xfer-preview-row"><span className="l">Source and destination are the same account.</span></div>
            </>
          ) : (
            <>
              <div className="acc-xfer-preview-h"><i className="fa-solid fa-eye" /> After Transfer{overdraft ? ' · insufficient balance warning' : ''}</div>
              <div className="acc-xfer-preview-row"><span className="l">{fromAcct?.name}</span><span className="v down">{rs(fromBal)} <i className="fa-solid fa-arrow-right" /> {rs(fromBal - amt)}</span></div>
              <div className="acc-xfer-preview-row"><span className="l">{toAcct?.name}</span><span className="v up">{rs(toBal)} <i className="fa-solid fa-arrow-right" /> {rs(toBal + amt)}</span></div>
              {overdraft && (
                <div className="acc-xfer-preview-row"><span className="l" style={{ color: 'var(--err)' }}><i className="fa-solid fa-triangle-exclamation" /> This exceeds the available balance. The source account will go negative.</span></div>
              )}
              <div className="acc-xfer-preview-row" style={{ borderTop: '1px dashed var(--bm)', marginTop: 6, paddingTop: 8 }}><span className="l"><i className="fa-solid fa-circle-info" /> Balance movement only. It is not counted in Profit &amp; Loss.</span></div>
            </>
          )}
        </div>
      )}
    </Shell>
  )
}

function FinAccountStatementModal({ account, acc, defaultId, onClose, onToast }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [filter, setFilter] = useState('all')

  const tm = finTypeMeta(account.type)
  const current = finAccountBalance(acc, account)
  const income = acc.txns.rev.filter((t) => (t.acctId || defaultId) === account.id).reduce((s, t) => s + (Number(t.amount) || 0), 0)
  const expense = acc.txns.exp.filter((t) => (t.acctId || defaultId) === account.id).reduce((s, t) => s + (Number(t.amount) || 0), 0)
  const transfersIn = acc.transfers.filter((t) => t.toId === account.id).reduce((s, t) => s + (Number(t.amount) || 0), 0)
  const transfersOut = acc.transfers.filter((t) => t.fromId === account.id).reduce((s, t) => s + (Number(t.amount) || 0), 0)

  const moves = []
  acc.txns.rev.forEach((t) => { if ((t.acctId || defaultId) === account.id) moves.push({ date: t.date, desc: t.detail || t.head, ref: `Revenue · ${t.head}`, cat: 'revenue', amount: Number(t.amount) || 0, kind: 'credit' }) })
  acc.txns.exp.forEach((t) => { if ((t.acctId || defaultId) === account.id) moves.push({ date: t.date, desc: t.detail || t.head, ref: `Expense · ${t.head}`, cat: 'expense', amount: Number(t.amount) || 0, kind: 'debit' }) })
  acc.transfers.forEach((tr) => {
    if (tr.toId === account.id) { const fn = acc.finAccounts.find((a) => a.id === tr.fromId)?.name || 'another account'; moves.push({ date: tr.date, desc: tr.note || `Transfer from ${fn}`, ref: `Transfer from ${fn}`, cat: 'transfer', amount: Number(tr.amount) || 0, kind: 'credit' }) }
    if (tr.fromId === account.id) { const tn = acc.finAccounts.find((a) => a.id === tr.toId)?.name || 'another account'; moves.push({ date: tr.date, desc: tr.note || `Transfer to ${tn}`, ref: `Transfer to ${tn}`, cat: 'transfer', amount: Number(tr.amount) || 0, kind: 'debit' }) }
  })
  moves.sort((a, b) => a.date.localeCompare(b.date))

  const broughtForward = (Number(account.opening) || 0) + moves.filter((m) => !from || m.date < from).reduce((s, m) => s + (m.kind === 'credit' ? m.amount : -m.amount), 0)
  let rangeMoves = moves.filter((m) => (!from || m.date >= from) && (!to || m.date <= to))
  if (filter !== 'all') rangeMoves = rangeMoves.filter((m) => m.kind === filter)
  let running = broughtForward
  const rows = rangeMoves.map((m) => { running += m.kind === 'credit' ? m.amount : -m.amount; return { ...m, balance: running } })
  const closing = (Number(account.opening) || 0) + moves.filter((m) => !to || m.date <= to).reduce((s, m) => s + (m.kind === 'credit' ? m.amount : -m.amount), 0)
  const totalDebit = rangeMoves.filter((m) => m.kind === 'debit').reduce((a, m) => a + m.amount, 0)
  const totalCredit = rangeMoves.filter((m) => m.kind === 'credit').reduce((a, m) => a + m.amount, 0)
  const openLabel = from ? 'Balance Brought Forward' : 'Opening Balance'
  const openDate = from || (account.createdAt || '').slice(0, 10)
  const catLabel = (m) => (m.cat === 'transfer' ? 'Transfer' : (m.kind === 'credit' ? 'Credit' : 'Debit'))
  const tagFor = (m) => (m.cat === 'transfer' ? 'xfer' : (m.kind === 'credit' ? 'credit' : 'debit'))

  const doPrint = () => {
    printAccReport({
      title: account.name, period: `${from ? fmtDate(from) : 'All time'} → ${to ? fmtDate(to) : 'today'}`,
      filters: [['Brought Forward', rs(broughtForward)], ['Closing Balance', rs(closing)]],
      columns: [{ label: 'Date', a: 'l' }, { label: 'Description', a: 'l' }, { label: 'Type', a: 'l' }, { label: 'Debit', a: 'r' }, { label: 'Credit', a: 'r' }, { label: 'Balance', a: 'r' }],
      rows: [
        [openDate ? fmtDate(openDate) : '—', openLabel, 'Opening', '', '', num(broughtForward)],
        ...rows.map((r) => [fmtDate(r.date), r.desc, catLabel(r), r.kind === 'debit' ? num(r.amount) : '', r.kind === 'credit' ? num(r.amount) : '', num(r.balance)]),
      ],
      totals: ['', 'Period Totals', '', num(totalDebit), num(totalCredit), num(closing)],
    }, onToast)
  }
  const doCsv = () => {
    const csvEsc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`
    const lines = [
      `${account.name} Statement`, `${from || 'All time'} to ${to || 'today'}`, '',
      ['Date', 'Description', 'Type', 'Debit', 'Credit', 'Balance'].join(','),
      [openDate, csvEsc(openLabel), 'Opening', '', '', broughtForward].join(','),
      ...rows.map((r) => [fmtDate(r.date), csvEsc(r.desc), catLabel(r), r.kind === 'debit' ? r.amount : '', r.kind === 'credit' ? r.amount : '', r.balance].join(',')),
      ['', 'Closing Balance', '', '', '', closing].join(','),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const el = document.createElement('a')
    el.href = url; el.download = `${account.name.replace(/[^A-Za-z0-9]+/g, '-')}-statement-${from || 'all'}-to-${to || 'all'}.csv`
    document.body.appendChild(el); el.click(); document.body.removeChild(el)
    URL.revokeObjectURL(url)
  }

  return (
    <Shell title={account.name} icon={tm.icon} maxWidth={920} onClose={onClose}
      foot={<button className="btn-secondary" onClick={onClose}>Close</button>}>
      <div className="acc-book-summary" style={{ marginBottom: 16 }}>
        <div className="acc-bsum b-opening"><div className="acc-bsum-top"><span className="acc-bsum-lbl">Opening Balance</span><span className="acc-bsum-ic"><i className="fa-solid fa-flag" /></span></div><div className="acc-bsum-val">{rs(account.opening)}</div><div className="acc-bsum-meta">{account.type === 'bank' && account.bankName ? account.bankName : `${tm.label} account`}</div></div>
        <div className="acc-bsum b-balance"><div className="acc-bsum-top"><span className="acc-bsum-lbl">Current Balance</span><span className="acc-bsum-ic"><i className="fa-solid fa-scale-balanced" /></span></div><div className="acc-bsum-val">{rs(current)}</div><div className="acc-bsum-meta">available now</div></div>
        <div className="acc-bsum b-in"><div className="acc-bsum-top"><span className="acc-bsum-lbl">Income Received</span><span className="acc-bsum-ic"><i className="fa-solid fa-arrow-down" /></span></div><div className="acc-bsum-val">{rs(income)}</div><div className="acc-bsum-meta">into this account</div></div>
        <div className="acc-bsum b-out"><div className="acc-bsum-top"><span className="acc-bsum-lbl">Expenses Paid</span><span className="acc-bsum-ic"><i className="fa-solid fa-arrow-up" /></span></div><div className="acc-bsum-val">{rs(expense)}</div><div className="acc-bsum-meta">from this account</div></div>
        <div className="acc-bsum b-cash"><div className="acc-bsum-top"><span className="acc-bsum-lbl">Transfers In</span><span className="acc-bsum-ic"><i className="fa-solid fa-arrow-right-to-bracket" /></span></div><div className="acc-bsum-val sm">{rs(transfersIn)}</div><div className="acc-bsum-meta">received via transfer</div></div>
        <div className="acc-bsum b-date"><div className="acc-bsum-top"><span className="acc-bsum-lbl">Transfers Out</span><span className="acc-bsum-ic"><i className="fa-solid fa-arrow-right-from-bracket" /></span></div><div className="acc-bsum-val sm">{rs(transfersOut)}</div><div className="acc-bsum-meta">sent via transfer</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div className="acc-field"><label>From Date</label><input className="acc-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="acc-field"><label>To Date</label><input className="acc-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="acc-field"><label>Movement</label><select className="acc-input" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All Movements</option><option value="credit">Credit (In)</option><option value="debit">Debit (Out)</option></select></div>
        <button className="btn-secondary" style={{ alignSelf: 'end', height: 38 }} onClick={doPrint}><i className="fa-solid fa-print" /> Print</button>
        <button className="btn-secondary" style={{ alignSelf: 'end', height: 38 }} onClick={doCsv}><i className="fa-solid fa-file-csv" /> CSV</button>
      </div>
      <div className="tbl-wrap">
        <table className="acc-table">
          <thead><tr><th>Date</th><th>Description</th><th>Type</th><th className="r">Debit (Out)</th><th className="r">Credit (In)</th><th className="r">Balance</th></tr></thead>
          <tbody>
            <tr style={{ background: 'var(--muted)', fontWeight: 700 }}>
              <td>{openDate ? fmtDate(openDate) : '—'}</td><td>{openLabel}</td>
              <td><span className="acc-stmt-tag opening"><i className="fa-solid fa-flag" /> Opening</span></td>
              <td className="r">—</td><td className="r">—</td><td className="r acc-stmt-bal">{rs(broughtForward)}</td>
            </tr>
            {rows.length === 0 ? (
              <tr><td colSpan={6}><div className="acc-empty" style={{ padding: 20 }}>No movements in this period.</div></td></tr>
            ) : rows.map((r, i) => (
              <tr key={i}>
                <td>{fmtDate(r.date)}</td>
                <td>{r.desc}<div style={{ fontSize: 10.5, color: 'var(--tm)', marginTop: 2 }}>{r.ref}</div></td>
                <td><span className={`acc-stmt-tag ${tagFor(r)}`}><i className={`fa-solid ${r.cat === 'transfer' ? 'fa-right-left' : (r.kind === 'credit' ? 'fa-arrow-down-long' : 'fa-arrow-up-long')}`} /> {catLabel(r)}</span></td>
                <td className={`r${r.kind === 'debit' ? ' acc-stmt-debit' : ''}`}>{r.kind === 'debit' ? rs(r.amount) : '—'}</td>
                <td className={`r${r.kind === 'credit' ? ' acc-stmt-credit' : ''}`}>{r.kind === 'credit' ? rs(r.amount) : '—'}</td>
                <td className="r acc-stmt-bal">{rs(r.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={3}>Period Totals:</td><td className="r acc-stmt-debit">{rs(totalDebit)}</td><td className="r acc-stmt-credit">{rs(totalCredit)}</td><td className="r acc-stmt-bal">{rs(closing)}</td></tr></tfoot>
        </table>
      </div>
    </Shell>
  )
}
