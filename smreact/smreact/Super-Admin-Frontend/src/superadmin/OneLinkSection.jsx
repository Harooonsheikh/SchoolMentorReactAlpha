import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  TXN_RATE_CONFIG_INITIAL, marginOf, pkr, pkr2,
  periodFromQuick, periodFromCustom, previousPeriodOf, percentChange,
  filterTransactions, calculateTotalTransactions, calculateTotalCollections,
  calculateActiveSchools, calculateAvgTransactionValue,
  calculateCustomerCharges, calculateProviderPayable, calculateSchoolMentorRevenue,
  calculateSchoolWiseSummary, todayISO,
} from './transactionData';
import { useApi, transactionsApi, schoolPermissionsApi } from './api';
import { TransactionReport, RevenueReport } from './OneLinkReports';

/* ═══════════════════════════════════════════════════════════════════
   1LINK / 1BILL OVERVIEW — network-wide payment monitoring + revenue.

   Rendered inline inside Dashboard.jsx (gated by the same `canPay`
   permission as Fee Analytics — see Dashboard.jsx). Everything here is
   additive: no existing dashboard section, card, or route is touched.

   Both cards + the school-wise table + both reports all read the SAME
   `period` selection (Today / Yesterday / This Month / Last Month /
   Custom), so picking a date once updates every figure on screen — see
   the "FILTER SYNCHRONIZATION" requirement.
   ═══════════════════════════════════════════════════════════════════ */

const QUICK_FILTERS = [
  { id: 'today', label: 'Today', icon: 'fa-calendar-day' },
  { id: 'yesterday', label: 'Yesterday', icon: 'fa-calendar-minus' },
  { id: 'thisMonth', label: 'This Month', icon: 'fa-calendar-week' },
  { id: 'lastMonth', label: 'Last Month', icon: 'fa-calendar' },
  { id: 'custom', label: 'Custom', icon: 'fa-sliders' },
];
const CUSTOM_MODES = [
  { id: 'single', label: 'Single Date' },
  { id: 'range', label: 'From – To' },
  { id: 'month', label: 'Month' },
];

export default function OneLinkOverviewSection({ toast }) {
  const load = useCallback(() => transactionsApi.listTransactions(), []);
  const { data: allTransactions, loading } = useApi(load);
  const transactions = useMemo(() => allTransactions || [], [allTransactions]);

  /* School roster — wohi LIVE branch directory jo School Permissions screen
     dikhati hai (GET .../SchoolPermissions/get-branches-with-permissions).
     Pehle yahan paymentData ki PAY_SCHOOLS (demo list) thi, is liye
     School-Wise Performance aur "out of N schools" dono ek jhoote roster par
     chal rahe thay. Ab poora network isi aik live source se aata hai. */
  const loadSchools = useCallback(() => schoolPermissionsApi.listPermissionBranches(), []);
  const { data: branchData } = useApi(loadSchools);
  const schools = useMemo(() => branchData?.schools || [], [branchData]);

  /* ── Global period filter (shared by both cards + reports) ── */
  const today = todayISO();
  const [quick, setQuick] = useState('thisMonth');
  const [customMode, setCustomMode] = useState('single');
  const [customDate, setCustomDate] = useState(today);
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const [customMonth, setCustomMonth] = useState(today.slice(0, 7));

  const period = quick === 'custom'
    ? periodFromCustom(customMode, { date: customDate, from: customFrom, to: customTo, month: customMonth })
    : periodFromQuick(quick);

  /* ── Transaction rate configuration (Customer Charge / Provider Cost) ── */
  const [rateConfig, setRateConfig] = useState(TXN_RATE_CONFIG_INITIAL);
  useEffect(() => { transactionsApi.getRateConfig().then(setRateConfig).catch(() => {}); }, []);

  /* ── Derived figures — pure calculation helpers from transactionData.js ── */
  const rows = useMemo(() => filterTransactions(transactions, period), [transactions, period]);
  const prevRows = useMemo(() => filterTransactions(transactions, previousPeriodOf(period)), [transactions, period]);

  const totalTxns = calculateTotalTransactions(rows);
  const totalCollection = calculateTotalCollections(rows);
  const activeSchools = calculateActiveSchools(rows);
  const avgTxn = calculateAvgTransactionValue(rows);
  const txnChange = percentChange(totalTxns, calculateTotalTransactions(prevRows));
  const collectionChange = percentChange(totalCollection, calculateTotalCollections(prevRows));

  const customerCharges = calculateCustomerCharges(rows, rateConfig);
  const providerPayable = calculateProviderPayable(rows, rateConfig);
  const smRevenue = calculateSchoolMentorRevenue(rows, rateConfig);
  const margin = marginOf(rateConfig);

  /* Roster pass karne se network ki HAR school ka row banta hai — jis school
     ki is period me koi transaction nahi, wo bhi 0 ke saath table me aati hai. */
  const schoolWise = useMemo(() => calculateSchoolWiseSummary(rows, rateConfig, schools), [rows, rateConfig, schools]);

  /* ── Modals / drill-down state ── */
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showRateConfig, setShowRateConfig] = useState(false);
  const [showTxnReport, setShowTxnReport] = useState(false);
  const [showRevReport, setShowRevReport] = useState(false);
  const [drillSchool, setDrillSchool] = useState(null);

  const drillRows = useMemo(
    () => (drillSchool ? rows.filter((t) => t.schoolId === drillSchool.schoolId) : []),
    [rows, drillSchool],
  );

  return (
    <>
      <div className="section-hdr">
        <div className="section-hdr-icon" style={{ background: 'linear-gradient(135deg,#6D28D9,#7C3AED)' }}><i className="fa-solid fa-building-columns" /></div>
        <div className="section-hdr-title">1LINK Overview</div>
      </div>

      {/* ── Global period filter ── */}
      <div className="section-card">
        <div className="rpt-filter-bar">
          <div className="rpt-subtabs" style={{ marginBottom: 0 }}>
            {QUICK_FILTERS.map((f) => (
              <button key={f.id} type="button" className={`rpt-stab${quick === f.id ? ' active' : ''}`} onClick={() => setQuick(f.id)}>
                <i className={`fa-solid ${f.icon}`} /> {f.label}
              </button>
            ))}
          </div>
          {quick === 'custom' && (
            <>
              <div className="f-field">
                <label className="f-label">Range Type</label>
                <select className="f-input" value={customMode} onChange={(e) => setCustomMode(e.target.value)} style={{ width: 140 }}>
                  {CUSTOM_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
              {customMode === 'single' && (
                <div className="f-field"><label className="f-label">Date</label><input type="date" className="f-input" value={customDate} onChange={(e) => setCustomDate(e.target.value)} /></div>
              )}
              {customMode === 'range' && (
                <>
                  <div className="f-field"><label className="f-label">From Date</label><input type="date" className="f-input" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} /></div>
                  <div className="f-field"><label className="f-label">To Date</label><input type="date" className="f-input" value={customTo} onChange={(e) => setCustomTo(e.target.value)} /></div>
                </>
              )}
              {customMode === 'month' && (
                <div className="f-field"><label className="f-label">Month</label><input type="month" className="f-input" value={customMonth} onChange={(e) => setCustomMonth(e.target.value)} /></div>
              )}
            </>
          )}
          <div style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: 'var(--tm)', alignSelf: 'center' }}>
            <i className="fa-solid fa-circle-info" style={{ marginRight: 5 }} />Showing: <span style={{ color: 'var(--brand)' }}>{period.label}</span>
          </div>
        </div>
      </div>

      <div className="detail-2col" style={{ alignItems: 'start', marginBottom: 14 }}>
        {/* ═══ CARD 1 — 1LINK COLLECTIONS ═══ */}
        <div className="section-card">
          <div className="card-header">
            <div><div className="card-title"><i className="fa-solid fa-money-bill-transfer" /> 1LINK Collections</div><div className="card-sub" style={{ fontSize: 11.5, color: 'var(--tm)', marginTop: 3 }}>Network-wide · {period.label}</div></div>
            <div className="card-header-right">
              <button className="rpt-pdf-btn" onClick={() => setShowTxnReport(true)} data-tip="Download the detailed transaction report" data-tip-pos="left">
                <i className="fa-solid fa-download" /> Download Report
              </button>
            </div>
          </div>
          <div style={{ padding: '18px 20px' }}>
            <div className="rpt-stat-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)', marginBottom: 12 }}>
              <ClickableStat label="Total Transactions" val={totalTxns.toLocaleString()} onClick={() => setShowBreakdown(true)}
                sub={<Comparison val={txnChange} />} />
              <div className="rpt-stat s-green">
                <div className="rpt-stat-val">{pkr(totalCollection)}</div>
                <div className="rpt-stat-lbl">Total Collection</div>
                <Comparison val={collectionChange} />
              </div>
              <ClickableStat label="Schools Receiving Payments" val={`${activeSchools} / ${schools.length}`} onClick={() => setShowBreakdown(true)} tone="s-info" />
              <div className="rpt-stat s-warn">
                <div className="rpt-stat-val">{pkr2(avgTxn)}</div>
                <div className="rpt-stat-lbl">Avg. Transaction Value</div>
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--tm)' }}>
              <i className="fa-solid fa-school" style={{ marginRight: 5, color: 'var(--brand)' }} />
              {activeSchools} school{activeSchools === 1 ? '' : 's'} received online fee payments during this period, out of {schools.length} schools in the network.
            </div>
          </div>
        </div>

        {/* ═══ CARD 2 — TRANSACTION REVENUE ═══ */}
        <div className="section-card">
          <div className="card-header">
            <div><div className="card-title"><i className="fa-solid fa-sack-dollar" /> Transaction Revenue</div><div className="card-sub" style={{ fontSize: 11.5, color: 'var(--tm)', marginTop: 3 }}>School Mentor's margin · {period.label}</div></div>
            <div className="card-header-right">
              <button className="btn-secondary" style={{ height: 34, padding: '0 12px', fontSize: 12 }} onClick={() => setShowRateConfig(true)} data-tip="Configure transaction rates" data-tip-pos="left">
                <i className="fa-solid fa-gear" /> Rates
              </button>
              <button className="btn-info" style={{ height: 34, padding: '0 14px', fontSize: 12 }} onClick={() => setShowRevReport(true)} data-tip="Download the revenue report" data-tip-pos="left">
                <i className="fa-solid fa-download" /> Revenue Report
              </button>
            </div>
          </div>
          <div style={{ padding: '18px 20px' }}>
            <div className="rpt-stat-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 12 }}>
              <div className="rpt-stat s-info"><div className="rpt-stat-val">{totalTxns.toLocaleString()}</div><div className="rpt-stat-lbl">Successful Transactions</div></div>
              <div className="rpt-stat s-warn"><div className="rpt-stat-val" style={{ fontSize: 15 }}>{pkr(customerCharges)}</div><div className="rpt-stat-lbl">Customer Charges</div></div>
              <div className="rpt-stat s-red"><div className="rpt-stat-val" style={{ fontSize: 15 }}>{pkr(providerPayable)}</div><div className="rpt-stat-lbl">Provider Payable</div></div>
            </div>
            <div className="rpt-stat s-green prominent" style={{ textAlign: 'left', padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div className="rpt-stat-lbl" style={{ marginTop: 0 }}>School Mentor Revenue</div>
                  <div className="rpt-stat-val" style={{ fontSize: 28, color: '#16A34A' }}>{pkr(smRevenue)}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--tm)', fontWeight: 600, textAlign: 'right' }}>
                  Margin / txn<br /><span style={{ fontSize: 15, fontWeight: 800, color: '#16A34A' }}>{pkr2(margin)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ SCHOOL-WISE PERFORMANCE ═══ */}
      <SchoolWiseTable schoolWise={schoolWise} onSelectSchool={setDrillSchool} />

      {/* ═══ MODALS ═══ */}
      {showBreakdown && (
        <Modal title="Schools Receiving 1LINK Payments" sub={period.label} icon="fa-school" large onClose={() => setShowBreakdown(false)}
          footer={<button className="btn-secondary" onClick={() => setShowBreakdown(false)}>Close</button>}>
          <SchoolWiseTable schoolWise={schoolWise} onSelectSchool={(s) => { setShowBreakdown(false); setDrillSchool(s); }} embedded />
        </Modal>
      )}

      {drillSchool && (
        <Modal title={drillSchool.schoolName} sub={`${drillSchool.branch} · School ID ${drillSchool.schoolCode} · ${period.label}`} icon="fa-receipt" large
          onClose={() => setDrillSchool(null)}
          footer={<><button className="btn-secondary" onClick={() => setDrillSchool(null)}>Close</button><button className="rpt-pdf-btn" onClick={() => window.print()}><i className="fa-solid fa-print" /> Print</button></>}>
          <SchoolTransactionsTable rows={drillRows} />
        </Modal>
      )}

      {showRateConfig && (
        <RateConfigModal
          rateConfig={rateConfig}
          onClose={() => setShowRateConfig(false)}
          onSave={async (payload) => {
            const saved = await transactionsApi.updateRateConfig(payload);
            setRateConfig(saved);
            setShowRateConfig(false);
            toast?.('Transaction rate configuration updated', 'success');
          }}
        />
      )}

      {showTxnReport && (
        <Modal title="1LINK / 1Bill Payment Report" sub={period.label} icon="fa-file-invoice" large bodyStyle={{ padding: 0, background: '#F0F4FF' }}
          onClose={() => setShowTxnReport(false)}
          footer={<><button className="btn-secondary" onClick={() => setShowTxnReport(false)}>Close</button><button className="btn-primary" onClick={() => window.print()}><i className="fa-solid fa-print" /> Print / Save</button></>}>
          <div style={{ padding: 20 }}><TransactionReport period={period} rows={rows} schoolWise={schoolWise} /></div>
        </Modal>
      )}

      {showRevReport && (
        <Modal title="1LINK Transaction Revenue Report" sub={period.label} icon="fa-sack-dollar" large bodyStyle={{ padding: 0, background: '#F0F4FF' }}
          onClose={() => setShowRevReport(false)}
          footer={<><button className="btn-secondary" onClick={() => setShowRevReport(false)}>Close</button><button className="btn-primary" onClick={() => window.print()}><i className="fa-solid fa-print" /> Print / Save</button></>}>
          <div style={{ padding: 20 }}><RevenueReport period={period} schoolWise={schoolWise} rateConfig={rateConfig} /></div>
        </Modal>
      )}

      {loading && rows.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--tm)', marginTop: -6, marginBottom: 14 }}><i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: 6 }} />Loading 1LINK transactions…</div>
      )}
    </>
  );
}

/* ── small presentational pieces ── */
function ClickableStat({ label, val, onClick, sub, tone = '' }) {
  return (
    <div
      className={`rpt-stat clickable ${tone}`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      data-tip="Click to view school-wise breakdown"
    >
      <div className="rpt-stat-val">{val}</div>
      <div className="rpt-stat-lbl">{label}</div>
      {sub}
    </div>
  );
}

function Comparison({ val }) {
  const up = val >= 0;
  return (
    <div style={{ fontSize: 10.5, fontWeight: 700, marginTop: 4, color: up ? '#16A34A' : '#DC2626' }}>
      <i className={`fa-solid fa-arrow-${up ? 'up' : 'down'}`} style={{ fontSize: 9 }} /> {Math.abs(val).toFixed(1)}% vs previous period
    </div>
  );
}

function SchoolWiseTable({ schoolWise, onSelectSchool, embedded }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('transactions');

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = schoolWise.filter((r) => !query || r.schoolName.toLowerCase().includes(query) || r.schoolCode.includes(query) || r.branch.toLowerCase().includes(query));
    list = list.slice().sort((a, b) => (sort === 'collection' ? b.collection - a.collection : sort === 'revenue' ? b.smRevenue - a.smRevenue : b.transactions - a.transactions));
    return list;
  }, [schoolWise, q, sort]);

  const body = (
    <>
      <div className="rpt-filter-bar">
        <div className="f-field-grow">
          <div className="search-box" style={{ width: '100%' }}>
            <i className="fa-solid fa-magnifying-glass" />
            <input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by school name, ID or branch…" />
          </div>
        </div>
        <div className="f-field">
          <label className="f-label">Sort By</label>
          <select className="f-input" value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: 190 }}>
            <option value="transactions">Highest Transactions</option>
            <option value="collection">Highest Collection</option>
            <option value="revenue">Highest School Mentor Revenue</option>
          </select>
        </div>
      </div>
      <div className="tbl-wrap">
        <table className="rpt-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th><th>School</th><th style={{ width: 110 }}>School ID</th>
              <th style={{ width: 100, textAlign: 'right' }}>Transactions</th>
              <th style={{ width: 130, textAlign: 'right' }}>Collection</th>
              <th style={{ width: 130, textAlign: 'right' }}>Provider Payable</th>
              <th style={{ width: 130, textAlign: 'right' }}>SM Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 34, color: 'var(--tm)' }}><i className="fa-solid fa-school" style={{ fontSize: 24, opacity: 0.25, display: 'block', margin: '0 auto 10px' }} />{q.trim() ? 'No school matches your search.' : 'No schools loaded yet.'}</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.schoolId} style={{ cursor: 'pointer' }} onClick={() => onSelectSchool(r)}>
                <td>{i + 1}</td>
                <td><div style={{ fontWeight: 700, color: 'var(--t1)' }}>{r.schoolName}</div><div style={{ fontSize: 10.5, color: 'var(--tm)' }}>{r.branch}</div></td>
                <td>{r.schoolCode}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{r.transactions.toLocaleString()}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{pkr(r.collection)}</td>
                <td style={{ textAlign: 'right', color: 'var(--err)' }}>{pkr(r.providerPayable)}</td>
                <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--success)' }}>{pkr(r.smRevenue)}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="rpt-totals-row">
                <td colSpan={3} style={{ padding: '10px 13px' }}>TOTALS ({rows.length} schools)</td>
                <td style={{ textAlign: 'right', padding: '10px 13px' }}>{rows.reduce((a, r) => a + r.transactions, 0).toLocaleString()}</td>
                <td style={{ textAlign: 'right', padding: '10px 13px' }}>{pkr(rows.reduce((a, r) => a + r.collection, 0))}</td>
                <td style={{ textAlign: 'right', padding: '10px 13px' }}>{pkr(rows.reduce((a, r) => a + r.providerPayable, 0))}</td>
                <td style={{ textAlign: 'right', padding: '10px 13px' }}>{pkr(rows.reduce((a, r) => a + r.smRevenue, 0))}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );

  if (embedded) return body;
  return (
    <div className="section-card">
      <div className="card-header">
        <div className="card-title"><i className="fa-solid fa-ranking-star" /> School-Wise Performance</div>
        <div style={{ fontSize: 11.5, color: 'var(--tm)' }}>Poora network · click a row for transaction-level detail</div>
      </div>
      {body}
    </div>
  );
}

function SchoolTransactionsTable({ rows }) {
  const sorted = rows.slice().sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  return (
    <div className="tbl-wrap">
      <table className="rpt-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th><th>Date &amp; Time</th><th>Txn ID</th><th>1LINK Ref</th>
            <th>Student</th><th>Adm. No.</th><th>Class</th><th>Fee Type</th><th>Invoice No.</th>
            <th style={{ textAlign: 'right' }}>Amount</th><th>Channel</th><th style={{ textAlign: 'center' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={12} style={{ textAlign: 'center', padding: 30, color: 'var(--tm)' }}>No transactions in this period.</td></tr>
          ) : sorted.map((t, i) => (
            <tr key={t.id}>
              <td>{i + 1}</td>
              <td>{t.date}<div style={{ fontSize: 10, color: 'var(--tm)' }}>{t.time}</div></td>
              <td style={{ fontWeight: 700, color: 'var(--brand)' }}>{t.txnId}</td>
              <td style={{ color: 'var(--tm)' }}>{t.oneLinkRef}</td>
              <td style={{ fontWeight: 700 }}>{t.studentName}</td>
              <td>{t.admissionNo}</td>
              <td>{t.className}</td>
              <td>{t.feeType}</td>
              <td>{t.invoiceNo}</td>
              <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--success)' }}>{pkr(t.amount)}</td>
              <td><span className="badge b-blue" style={{ fontSize: 9.5 }}>{t.channel}</span></td>
              <td style={{ textAlign: 'center' }}><span className="rpt-paid">{t.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RateConfigModal({ rateConfig, onClose, onSave }) {
  const [f, setF] = useState({ ...rateConfig });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const margin = (parseFloat(f.customerCharge) || 0) - (parseFloat(f.providerCost) || 0);

  return (
    <Modal title="Transaction Rate Configuration" sub="Applies to future revenue calculations" icon="fa-gear" onClose={onClose}
      footer={<>
        <button className="btn-secondary" onClick={onClose}><i className="fa-solid fa-xmark" /> Cancel</button>
        <button className="btn-primary" onClick={() => onSave({ ...f, customerCharge: parseFloat(f.customerCharge) || 0, providerCost: parseFloat(f.providerCost) || 0 })}><i className="fa-solid fa-floppy-disk" /> Save Rates</button>
      </>}>
      <div className="pay-info-box">
        <i className="fa-solid fa-circle-info" />
        <p>
          School Mentor's revenue per transaction is <strong>Customer Charge − Provider Cost</strong>, calculated
          automatically below. Changing these rates only affects <strong>future</strong> calculations — for accurate
          historical reporting, a production backend should store each rate with its <strong>Effective From</strong> date
          and apply the rate in force on each transaction's own date, rather than rewriting past revenue.
        </p>
      </div>
      <div className="pay-input-row">
        <div className="pay-field">
          <label><i className="fa-solid fa-user" style={{ color: 'var(--brand)', marginRight: 4 }} /> Customer Transaction Charge (PKR)</label>
          <input className="pay-input" type="number" step="0.01" value={f.customerCharge} onChange={(e) => set('customerCharge', e.target.value)} placeholder="e.g. 40" />
        </div>
        <div className="pay-field">
          <label><i className="fa-solid fa-building-columns" style={{ color: 'var(--brand)', marginRight: 4 }} /> Provider Cost Per Transaction (PKR)</label>
          <input className="pay-input" type="number" step="0.01" value={f.providerCost} onChange={(e) => set('providerCost', e.target.value)} placeholder="e.g. 22.50" />
        </div>
      </div>
      <div className="pay-field">
        <label><i className="fa-regular fa-calendar" style={{ color: 'var(--brand)', marginRight: 4 }} /> Effective From</label>
        <input className="pay-input" type="date" value={f.effectiveFrom} onChange={(e) => set('effectiveFrom', e.target.value)} />
      </div>
      <div style={{ marginTop: 6, background: 'linear-gradient(135deg,rgba(22,163,74,.08),rgba(22,163,74,.03))', border: '1.5px solid rgba(22,163,74,.25)', borderRadius: 'var(--r-md)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tm)', textTransform: 'uppercase', letterSpacing: '.4px' }}>School Mentor Margin / Transaction</div><div style={{ fontSize: 10, color: 'var(--tm)', marginTop: 1 }}>Customer Charge − Provider Cost</div></div>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#16A34A' }}>{pkr2(margin)}</div>
      </div>
    </Modal>
  );
}

/* Dashboard bhi isi modal me Bugs / Improvements report kholta hai, is liye
   export hai — har report ek hi chrome me khule. */
export function Modal({ title, sub, icon, large, onClose, footer, children, bodyStyle }) {
  return (
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${large ? ' lg' : ''}`}>
        <div className="modal-head">
          <div>
            <div className="modal-title"><i className={`fa-solid ${icon}`} /> {title}</div>
            {sub && <div className="modal-sub">{sub}</div>}
          </div>
          <button className="modal-close" onClick={onClose} data-tip="Close" data-tip-pos="left"><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="modal-body" style={bodyStyle}>{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
