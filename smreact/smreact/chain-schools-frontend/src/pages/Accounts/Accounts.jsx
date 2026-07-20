import { useEffect, useMemo, useState } from 'react'
import TutorialButton from '../../components/TutorialButton'
import { createPortal } from 'react-dom'
import {
  loadAcc, saveAcc, rs, num, fmtDate, fmtStamp, periodLabel,
  bookCalc, monthsBetween, plForMonth,
} from './data'
import { loadChainProfile, chainInitials } from '../../config/chainProfile'
import './Accounts.css'

const todayISO = () => new Date().toISOString().slice(0, 10)
const monthBounds = (m) => { const [y, mo] = m.split('-').map(Number); const last = new Date(y, mo, 0).getDate(); return { from: `${m}-01`, to: `${m}-${String(last).padStart(2, '0')}` } }

export default function Accounts() {
  const [acc, setAcc] = useState(null)
  const [tab, setTab] = useState('coa')
  const [toast, setToast] = useState(null)

  useEffect(() => { setAcc(loadAcc()) }, [])
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t) }, [toast])

  const fire = (text, type = 'success') => setToast({ text, type })
  const commit = (next) => { setAcc(next); saveAcc(next) }
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
        {[['coa', 'fa-sitemap', 'Chart of Accounts'], ['txn', 'fa-right-left', 'Transactions'], ['books', 'fa-book-open', 'Account Books'], ['reports', 'fa-chart-column', 'Reports']].map(([k, ic, lbl]) => (
          <button key={k} className={`acc-tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}><i className={`fa-solid ${ic}`} /> {lbl}</button>
        ))}
      </div>

      {tab === 'coa' && <ChartOfAccounts acc={acc} commit={commit} fire={fire} />}
      {tab === 'txn' && <Transactions acc={acc} commit={commit} fire={fire} />}
      {tab === 'books' && <AccountBooks acc={acc} commit={commit} fire={fire} />}
      {tab === 'reports' && <Reports acc={acc} fire={fire} />}

      {toast && createPortal(
        <div className="ss-toast-wrap"><div className={`ss-toast ${toast.type}`}><i className={`fa-solid ${toast.type === 'success' ? 'fa-circle-check' : toast.type === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-info'}`} /> {toast.text}</div></div>,
        document.body,
      )}
    </>
  )
}

/* ════════ CHART OF ACCOUNTS ════════ */
function ChartOfAccounts({ acc, commit, fire }) {
  const [open, setOpen] = useState({ exp: true, rev: false })
  const [headModal, setHeadModal] = useState(null) // { typeKey, head }
  const [del, setDel] = useState(null)

  const saveHead = (typeKey, payload, headNo) => {
    const types = acc.types.map((t) => {
      if (t.key !== typeKey) return t
      if (headNo != null) return { ...t, heads: t.heads.map((h) => (h.no === headNo ? { ...h, ...payload } : h)) }
      return { ...t, heads: [...t.heads, { no: acc.nextHeadNo, ...payload }] }
    })
    commit({ ...acc, types, nextHeadNo: headNo != null ? acc.nextHeadNo : acc.nextHeadNo + 1 })
    setHeadModal(null); fire(headNo != null ? 'Account head updated' : 'Account head added')
  }
  const doDel = () => {
    const types = acc.types.map((t) => (t.key === del.typeKey ? { ...t, heads: t.heads.filter((h) => h.no !== del.no) } : t))
    commit({ ...acc, types }); setDel(null); fire('Account head deleted', 'info')
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
            <span className="acc-coa-count">{t.heads.length} head{t.heads.length !== 1 ? 's' : ''}</span>
            <i className={`fa-solid fa-chevron-${open[t.key] ? 'up' : 'down'}`} style={{ color: 'var(--tm)', marginLeft: 10 }} />
          </div>
          {open[t.key] && (
            <div className="acc-coa-body">
              {t.heads.map((h) => (
                <div className="acc-head-row" key={h.no}>
                  <span className="acc-head-no">#{h.no}</span>
                  <div style={{ flex: 1, minWidth: 0 }}><div className="acc-head-name">{h.name}</div>{h.desc && <div className="acc-head-desc">{h.desc}</div>}</div>
                  <button className="btn-sm" style={{ height: 28 }} onClick={() => setHeadModal({ typeKey: t.key, head: h })}><i className="fa-solid fa-pen" /></button>
                  <button className="btn-sm" style={{ height: 28, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={() => setDel({ typeKey: t.key, no: h.no, name: h.name })}><i className="fa-solid fa-trash-can" /></button>
                </div>
              ))}
              <button className="btn-primary" style={{ marginTop: 4 }} onClick={() => setHeadModal({ typeKey: t.key })}><i className="fa-solid fa-plus" /> Add Head under {t.name}</button>
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
  const save = () => { if (!name.trim()) return onToast('Please enter a head name', 'warn'); onSave(modal.typeKey, { name: name.trim(), desc: desc.trim() }, h?.no) }
  return (
    <Shell title={h ? 'Edit Account Head' : 'Add Account Head'} icon="fa-folder-plus" onClose={onClose} maxWidth={460}
      foot={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save</button></>}>
      <div className="acc-field" style={{ marginBottom: 14 }}><label>Head Name</label><input className="acc-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Building Rent" /></div>
      <div className="acc-field"><label>Description</label><input className="acc-input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description" /></div>
    </Shell>
  )
}

/* ════════ TRANSACTIONS ════════ */
function Transactions({ acc, commit, fire }) {
  const [seg, setSeg] = useState('rev')
  const [month, setMonth] = useState(acc.month)
  const [search, setSearch] = useState('')
  const [entryModal, setEntryModal] = useState(null)
  const [del, setDel] = useState(null)

  const heads = acc.types.find((t) => t.key === seg)?.heads || []
  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return acc.txns[seg].filter((x) => x.month === month && (!q || `${x.head}${x.detail}${x.amount}${x.date}`.toLowerCase().includes(q))).sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [acc.txns, seg, month, search])
  const total = list.reduce((a, x) => a + Number(x.amount || 0), 0)

  const saveEntry = (payload, id) => {
    const head = heads.find((h) => h.no === Number(payload.headNo))
    const rec = { ...payload, headNo: Number(payload.headNo), head: head?.name || '', month: payload.date.slice(0, 7), amount: Number(payload.amount) }
    let txns
    if (id) txns = { ...acc.txns, [seg]: acc.txns[seg].map((x) => (x.id === id ? { ...x, ...rec, updatedBy: acc.currentUser, updatedAt: new Date().toISOString() } : x)) }
    else txns = { ...acc.txns, [seg]: [{ id: `x${Date.now()}`, ...rec, createdBy: acc.currentUser, createdAt: new Date().toISOString(), updatedBy: null, updatedAt: null }, ...acc.txns[seg]] }
    commit({ ...acc, txns }); setEntryModal(null); fire(id ? 'Entry updated' : 'Entry recorded')
  }
  const doDel = () => { commit({ ...acc, txns: { ...acc.txns, [seg]: acc.txns[seg].filter((x) => x.id !== del.id) } }); setDel(null); fire('Entry deleted', 'info') }

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
        <button className="btn-primary" style={{ background: 'linear-gradient(135deg,#16A34A,#15803D)' }} onClick={() => setEntryModal({ mode: 'add' })}><i className="fa-solid fa-plus" /> New {seg === 'rev' ? 'Revenue' : 'Expense'}</button>
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
              {list.length === 0 ? (
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
    onSave(v, modal.mode === 'edit' ? x.id : null)
  }
  return (
    <Shell title={`${modal.mode === 'edit' ? 'Edit' : 'New'} ${seg === 'rev' ? 'Revenue' : 'Expense'} Entry`} icon={seg === 'rev' ? 'fa-arrow-down-long' : 'fa-arrow-up-long'} onClose={onClose}
      foot={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save Entry</button></>}>
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
function AccountBooks({ acc, commit, fire }) {
  const [openId, setOpenId] = useState(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [bookModal, setBookModal] = useState(false)
  const [txnModal, setTxnModal] = useState(false)
  const [del, setDel] = useState(null)

  const list = acc.books.filter((b) => {
    const q = search.trim().toLowerCase()
    return (status === 'all' || b.status === status) && (!q || `${b.name}${b.party}${b.desc}`.toLowerCase().includes(q))
  })
  const book = acc.books.find((b) => b.id === openId)

  const addBook = (payload) => {
    const id = `bk${acc.booksNextId}`
    commit({ ...acc, booksNextId: acc.booksNextId + 1, books: [...acc.books, { id, ...payload, opening: Number(payload.opening) || 0, status: 'active', createdBy: acc.currentUser, txns: [] }] })
    setBookModal(false); fire('Account book created')
  }
  const addTxn = (payload) => {
    const id = `bt${acc.booksTxnNextId}`
    const amount = payload.type === 'adjustment' ? Number(payload.amount) : Math.abs(Number(payload.amount))
    const books = acc.books.map((b) => (b.id === openId ? { ...b, txns: [...b.txns, { id, type: payload.type, amount, date: payload.date, notes: payload.notes, enteredBy: acc.currentUser, at: new Date().toISOString() }] } : b))
    commit({ ...acc, booksTxnNextId: acc.booksTxnNextId + 1, books }); setTxnModal(false); fire('Ledger entry added')
  }
  const deleteBook = () => { commit({ ...acc, books: acc.books.filter((b) => b.id !== del) }); setDel(null); setOpenId(null); fire('Account book deleted', 'info') }

  if (book) {
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
          <button className="btn-secondary" onClick={() => setOpenId(null)}><i className="fa-solid fa-arrow-left" /> All Books</button>
          <div className="acc-book-topbar-title">{book.name}</div>
          <span className={`badge ${book.status === 'active' ? 'b-green' : book.status === 'settled' ? 'b-blue' : 'b-gray'}`} style={{ marginLeft: 'auto' }}>{book.status}</span>
          <button className="btn-secondary" onClick={ledgerReport}><i className="fa-solid fa-file-export" /> Ledger Report</button>
          <button className="btn-sm" style={{ height: 38, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={() => setDel(book.id)}><i className="fa-solid fa-trash-can" /> Delete</button>
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
            <button className="btn-primary" onClick={() => setTxnModal(true)}><i className="fa-solid fa-plus" /> Add Entry</button>
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

  const totalPayable = acc.books.filter((b) => b.type === 'payable').reduce((a, b) => a + bookCalc(b).balance, 0)
  const totalReceivable = acc.books.filter((b) => b.type === 'receivable').reduce((a, b) => a + bookCalc(b).balance, 0)
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
        <div className="acc-kpi info"><div className="acc-kpi-top"><i className="fa-solid fa-book" /> Total Books</div><div className="acc-kpi-val">{acc.books.length}</div></div>
        <div className="acc-kpi red"><div className="acc-kpi-top"><i className="fa-solid fa-arrow-up-from-bracket" /> Total Payable</div><div className="acc-kpi-val">{rs(totalPayable)}</div><div className="acc-kpi-sub">owed by school</div></div>
        <div className="acc-kpi green"><div className="acc-kpi-top"><i className="fa-solid fa-arrow-down-to-bracket" /> Total Receivable</div><div className="acc-kpi-val">{rs(totalReceivable)}</div><div className="acc-kpi-sub">owed to school</div></div>
      </div>

      <div className="acc-bar">
        <div className="acc-field" style={{ flex: 1, minWidth: 240 }}><label>Search Books</label><div className="search-box"><i className="fa-solid fa-magnifying-glass" /><input className="search-input" placeholder="Search by book name, party or description" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
        <div className="acc-field"><label>Status</label><select className="acc-input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All Books</option><option value="active">Active</option><option value="settled">Settled</option><option value="closed">Closed</option></select></div>
        <button className="btn-primary" onClick={() => setBookModal(true)}><i className="fa-solid fa-plus" /> Add New Account Book</button>
      </div>

      <div className="acc-books-grid">
        {list.length === 0 ? <div className="acc-empty" style={{ gridColumn: '1/-1' }}><i className="fa-solid fa-book-open" /><div style={{ fontSize: 14, fontWeight: 700 }}>No account books found</div></div>
          : list.map((b) => {
            const c = bookCalc(b)
            return (
              <div className="acc-book-card" key={b.id} onClick={() => setOpenId(b.id)}>
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
  const save = () => { if (!v.name.trim()) return onToast('Please enter a book name', 'warn'); onSave({ ...v, name: v.name.trim(), party: v.party.trim(), desc: v.desc.trim() }) }
  return (
    <Shell title="Add Account Book" icon="fa-book-medical" onClose={onClose}
      foot={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Create Book</button></>}>
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
  const save = () => { if (!v.amount) return onToast('Please enter an amount', 'warn'); onSave(v) }
  return (
    <Shell title="Add Ledger Entry" icon="fa-plus" onClose={onClose} maxWidth={460}
      foot={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Add Entry</button></>}>
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

function Reports({ acc, fire }) {
  const [type, setType] = useState('revenue')
  const mb = monthBounds(acc.month)
  const [ctrl, setCtrl] = useState({ from: mb.from, to: mb.to, head: 'all', plFrom: acc.month, plTo: acc.month, cashDate: mb.to })
  const set = (k) => (e) => setCtrl((s) => ({ ...s, [k]: e.target.value }))

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
        <button className="acc-pdf-btn" onClick={() => (report.rows.length ? printAccReport(report, fire) : fire('No data to export for this report', 'warn'))}><i className="fa-solid fa-file-pdf" /> Download A4 Report</button>
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
              {report.rows.length === 0 ? (
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
