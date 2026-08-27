import React from 'react';
import { pkr, pkr2, fmtDateLong } from './transactionData';

/* ═══════════════════════════════════════════════════════════════════
   1LINK / 1BILL — print-preview report documents.

   Same pattern as PaymentReport.jsx: an A4-width, inline-styled branded
   document rendered inside a report-preview Modal; window.print() from
   the modal footer prints/saves it. No PDF library needed.
   ═══════════════════════════════════════════════════════════════════ */

export const generated = () => new Date().toLocaleString('en-PK', { dateStyle: 'long', timeStyle: 'short' });

/* Shared A4 report chrome. `footNote` batata hai report kis module ki hai —
   Bugs / Improvements report bhi isi shell par banti hai (see BugsReport.jsx),
   taake har report ek jaisi print ho. */
export function ReportShell({ icon, title, period, meta, children, footNote = 'School Mentor · Super Admin · 1LINK / 1Bill Monitoring' }) {
  return (
    <div style={{ background: '#fff', width: 794, maxWidth: '100%', margin: '0 auto', fontFamily: "'Plus Jakarta Sans',Arial,sans-serif", color: '#0F172A', fontSize: 12 }}>
      <div style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF,#2563EB)', padding: '32px 40px 28px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -30, top: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.07)' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#fff' }}>
              <i className={`fa-solid ${icon}`} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.7)', letterSpacing: 2, textTransform: 'uppercase' }}>School Mentor · Super Admin</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginTop: 2 }}>{title}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.75)', marginTop: 4 }}>Confidential — Internal Use Only</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ background: 'rgba(255,255,255,.15)', borderRadius: 10, padding: '12px 18px', display: 'inline-block' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.7)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Reporting Period</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginTop: 2 }}>{period.label}</div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ background: '#EFF6FF', borderBottom: '2px solid #BFDBFE', padding: '10px 40px', display: 'flex', gap: 24, fontSize: 11, color: '#64748B', fontWeight: 600, flexWrap: 'wrap' }}>
        <span>Generated: {generated()}</span>
        {meta.map((m, i) => (<React.Fragment key={i}><span>•</span><span>{m}</span></React.Fragment>))}
      </div>
      <div style={{ padding: '28px 40px' }}>{children}</div>
      <div style={{ padding: '0 40px 28px' }}>
        <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94A3B8', flexWrap: 'wrap', gap: 8 }}>
          <span>{footNote}</span>
          <span>Generated: {generated()}</span>
          <span>CONFIDENTIAL — Internal Use Only</span>
        </div>
      </div>
    </div>
  );
}

export const sectionTtl = { fontSize: 13, fontWeight: 800, color: '#1E3A8A', borderLeft: '4px solid #1E3A8A', paddingLeft: 10, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' };
export const th = { padding: '8px 9px', textAlign: 'left', color: '#fff', fontWeight: 800, fontSize: 9, letterSpacing: '.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' };
export const td = { padding: '7px 9px', borderBottom: '1px solid #E2E8F0', fontSize: 10.5 };

export function KpiRow({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length},1fr)`, gap: 12, marginBottom: 24 }}>
      {items.map(([label, val, tone], i) => (
        <div key={i} style={{ background: i === 0 ? 'linear-gradient(135deg,#1E3A8A,#1E40AF)' : '#EFF6FF', border: i === 0 ? 'none' : '1.5px solid #BFDBFE', borderRadius: 12, padding: 14, color: i === 0 ? '#fff' : undefined, borderTop: tone && i > 0 ? `3px solid ${tone}` : undefined }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, opacity: i === 0 ? 0.85 : 1, color: i === 0 ? '#fff' : '#64748B', letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
          <div style={{ fontSize: 17, fontWeight: 800, marginTop: 6, color: i === 0 ? '#fff' : '#1E3A8A' }}>{val}</div>
        </div>
      ))}
    </div>
  );
}

/* ── 1. DETAILED TRANSACTION REPORT — grouped school by school ── */
export function TransactionReport({ period, rows, schoolWise }) {
  const totalTxns = rows.length;
  const totalAmt = rows.reduce((a, t) => a + Number(t.amount || 0), 0);
  const schools = schoolWise.slice().sort((a, b) => a.schoolName.localeCompare(b.schoolName));
  const byId = new Map();
  rows.forEach((t) => { if (!byId.has(t.schoolId)) byId.set(t.schoolId, []); byId.get(t.schoolId).push(t); });

  return (
    <ReportShell icon="fa-file-invoice" title="1LINK / 1Bill Payment Report" period={period}
      meta={[`Total Records: ${totalTxns}`, `Schools: ${schools.length}`, `Total Collection: ${pkr(totalAmt)}`]}>
      <div style={{ marginBottom: 24 }}>
        <div style={sectionTtl}>Network Grand Total</div>
        <KpiRow items={[
          ['Total Collection', pkr(totalAmt)],
          ['Total Transactions', totalTxns.toLocaleString(), '#0284C7'],
          ['Schools Receiving Payments', schools.length.toLocaleString(), '#16A34A'],
          ['Avg. Transaction Value', totalTxns ? pkr2(totalAmt / totalTxns) : pkr2(0), '#D97706'],
        ]} />
      </div>

      {schools.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#94A3B8', padding: 30 }}>No successful 1LINK / 1Bill transactions in this period.</div>
      ) : schools.map((sc, si) => {
        const list = (byId.get(sc.schoolId) || []).slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
        return (
          <div key={sc.schoolId} style={{ marginBottom: 26, pageBreakInside: 'avoid' }}>
            <div style={{ ...sectionTtl, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeftColor: '#7C3AED' }}>
              <span style={{ color: '#7C3AED' }}>School {String.fromCharCode(65 + (si % 26))} — {sc.schoolName}</span>
            </div>
            <div style={{ display: 'flex', gap: 20, fontSize: 10.5, color: '#64748B', marginBottom: 8, flexWrap: 'wrap' }}>
              <span><b style={{ color: '#0F172A' }}>Branch:</b> {sc.branch}</span>
              <span><b style={{ color: '#0F172A' }}>School ID:</b> {sc.schoolCode}</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5, marginBottom: 4 }}>
              <thead>
                <tr style={{ background: 'linear-gradient(135deg,#6D28D9,#7C3AED)' }}>
                  <th style={th}>Date</th><th style={th}>Time</th><th style={th}>Txn ID</th><th style={th}>1LINK Ref</th>
                  <th style={th}>Student</th><th style={th}>Adm. No.</th><th style={th}>Fee Type</th>
                  <th style={{ ...th, textAlign: 'right' }}>Amount</th><th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((t, i) => (
                  <tr key={t.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAF5FF' }}>
                    <td style={td}>{t.date}</td>
                    <td style={td}>{t.time}</td>
                    <td style={{ ...td, color: '#7C3AED', fontWeight: 700 }}>{t.txnId}</td>
                    <td style={{ ...td, color: '#64748B' }}>{t.oneLinkRef}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{t.studentName}</td>
                    <td style={td}>{t.admissionNo}</td>
                    <td style={td}>{t.feeType}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: '#7C3AED' }}>{pkr(t.amount)}</td>
                    <td style={td}><span style={{ background: 'rgba(22,163,74,.1)', color: '#15803d', border: '1px solid rgba(22,163,74,.3)', borderRadius: 99, padding: '2px 8px', fontWeight: 700, fontSize: 9 }}>{t.status}</span></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#F5F3FF' }}>
                  <td colSpan={7} style={{ padding: '9px', fontWeight: 800, color: '#7C3AED', fontSize: 11, borderTop: '2px solid #7C3AED' }}>
                    School Total — {sc.transactions.toLocaleString()} transaction{sc.transactions === 1 ? '' : 's'}
                  </td>
                  <td style={{ padding: '9px', textAlign: 'right', fontWeight: 800, color: '#7C3AED', fontSize: 12, borderTop: '2px solid #7C3AED' }}>{pkr(sc.collection)}</td>
                  <td style={{ borderTop: '2px solid #7C3AED' }} />
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })}
    </ReportShell>
  );
}

/* ── 2. TRANSACTION REVENUE REPORT — school-wise + network totals ── */
export function RevenueReport({ period, schoolWise, rateConfig }) {
  const rows = schoolWise.slice().sort((a, b) => b.transactions - a.transactions);
  const tot = rows.reduce((a, r) => ({
    transactions: a.transactions + r.transactions,
    collection: a.collection + r.collection,
    customerCharges: a.customerCharges + r.customerCharges,
    providerPayable: a.providerPayable + r.providerPayable,
    smRevenue: a.smRevenue + r.smRevenue,
  }), { transactions: 0, collection: 0, customerCharges: 0, providerPayable: 0, smRevenue: 0 });

  return (
    <ReportShell icon="fa-sack-dollar" title="1LINK Transaction Revenue Report" period={period}
      meta={[`Customer Charge: ${pkr2(rateConfig.customerCharge)}/txn`, `Provider Cost: ${pkr2(rateConfig.providerCost)}/txn`, `Effective From: ${fmtDateLong(rateConfig.effectiveFrom)}`]}>
      <div style={{ marginBottom: 24 }}>
        <div style={sectionTtl}>Network Revenue Summary</div>
        <KpiRow items={[
          ['School Mentor Revenue', pkr(tot.smRevenue)],
          ['Successful Transactions', tot.transactions.toLocaleString(), '#0284C7'],
          ['Customer Transaction Charges', pkr(tot.customerCharges), '#D97706'],
          ['Provider Payable', pkr(tot.providerPayable), '#DC2626'],
        ]} />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={sectionTtl}>School-Wise Revenue Breakdown</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
          <thead>
            <tr style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}>
              <th style={th}>#</th><th style={th}>School Name</th><th style={th}>School ID</th>
              <th style={{ ...th, textAlign: 'right' }}>Txns</th><th style={{ ...th, textAlign: 'right' }}>Fee Collection</th>
              <th style={{ ...th, textAlign: 'right' }}>Customer Charges</th><th style={{ ...th, textAlign: 'right' }}>Provider Payable</th>
              <th style={{ ...th, textAlign: 'right' }}>SM Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: '#94A3B8', padding: 24 }}>No successful transactions in this period.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.schoolId} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFF' }}>
                <td style={{ ...td, color: '#94A3B8', fontWeight: 700 }}>{i + 1}</td>
                <td style={{ ...td, fontWeight: 700 }}>{r.schoolName}</td>
                <td style={{ ...td, color: '#64748B' }}>{r.schoolCode}</td>
                <td style={{ ...td, textAlign: 'right' }}>{r.transactions.toLocaleString()}</td>
                <td style={{ ...td, textAlign: 'right' }}>{pkr(r.collection)}</td>
                <td style={{ ...td, textAlign: 'right', color: '#D97706' }}>{pkr(r.customerCharges)}</td>
                <td style={{ ...td, textAlign: 'right', color: '#DC2626' }}>{pkr(r.providerPayable)}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: '#16A34A' }}>{pkr(r.smRevenue)}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ background: '#EFF6FF' }}>
                <td colSpan={3} style={{ padding: '10px 9px', fontWeight: 800, color: '#1E3A8A', fontSize: 11, borderTop: '2px solid #1E3A8A' }}>Network Totals</td>
                <td style={{ padding: '10px 9px', textAlign: 'right', fontWeight: 800, borderTop: '2px solid #1E3A8A' }}>{tot.transactions.toLocaleString()}</td>
                <td style={{ padding: '10px 9px', textAlign: 'right', fontWeight: 800, borderTop: '2px solid #1E3A8A' }}>{pkr(tot.collection)}</td>
                <td style={{ padding: '10px 9px', textAlign: 'right', fontWeight: 800, color: '#D97706', borderTop: '2px solid #1E3A8A' }}>{pkr(tot.customerCharges)}</td>
                <td style={{ padding: '10px 9px', textAlign: 'right', fontWeight: 800, color: '#DC2626', borderTop: '2px solid #1E3A8A' }}>{pkr(tot.providerPayable)}</td>
                <td style={{ padding: '10px 9px', textAlign: 'right', fontWeight: 800, color: '#16A34A', fontSize: 12, borderTop: '2px solid #1E3A8A' }}>{pkr(tot.smRevenue)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </ReportShell>
  );
}
