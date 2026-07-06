import React from 'react';
import { fmt, monthLabel } from './mentorData';

/* ═══════════════════════════════════════════════════════════════════
   MENTOR AI — PAYMENT REPORT (print preview)
   Faithful React port of generatePaymentReport() from the HTML. Renders
   an A4-style branded document (colorful or colorless) inside the report
   preview modal. `window.print()` from the modal footer prints it.
   ═══════════════════════════════════════════════════════════════════ */

export default function PaymentReport({ style, list, from, to }) {
  const received = list.filter((x) => x.status === 'Received');
  const pending = list.filter((x) => x.status === 'Pending Verification');
  const rejected = list.filter((x) => x.status === 'Rejected');
  const sum = (arr) => arr.reduce((a, b) => a + Number(b.amount || 0), 0);

  const fromLbl = from ? monthLabel(from) : 'All Time';
  const toLbl = to ? monthLabel(to) : 'All Time';
  const generated = new Date().toLocaleString('en-PK', { dateStyle: 'long', timeStyle: 'short' });

  const isColor = style !== 'colorless';
  const primary = isColor ? '#1E3A8A' : '#1a1a1a';
  const headerBg = isColor ? 'linear-gradient(135deg,#1E3A8A,#1E40AF,#2563EB)' : '#1a1a1a';
  const lightBg = isColor ? '#EFF6FF' : '#f5f5f5';
  const lightBorder = isColor ? '#BFDBFE' : '#ccc';

  const byPlan = {
    Basic: received.filter((x) => x.paymentPlan === 'Basic'),
    Pro: received.filter((x) => x.paymentPlan === 'Pro'),
    Premium: received.filter((x) => x.paymentPlan === 'Premium'),
  };

  const th = { padding: '10px 10px', textAlign: 'left', color: '#fff', fontWeight: 800, fontSize: 9.5, letterSpacing: '.6px', textTransform: 'uppercase' };
  const sectionTtl = { fontSize: 13, fontWeight: 800, color: primary, borderLeft: `4px solid ${primary}`, paddingLeft: 10, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.5px' };

  return (
    <div style={{ background: '#fff', width: 794, maxWidth: '100%', margin: '0 auto', fontFamily: "'Plus Jakarta Sans',Arial,sans-serif", color: '#0F172A', fontSize: 12 }}>
      {/* HEADER BAND */}
      <div style={{ background: headerBg, padding: '32px 40px 28px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -30, top: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.07)' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#fff' }}>
              <i className="fa-solid fa-robot" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.7)', letterSpacing: 2, textTransform: 'uppercase' }}>School Mentor</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginTop: 2 }}>Mentor AI Payment Report</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.75)', marginTop: 4 }}>Super Admin · Confidential</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ background: 'rgba(255,255,255,.15)', borderRadius: 10, padding: '12px 18px', display: 'inline-block' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.7)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Period</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginTop: 2 }}>{fromLbl}</div>
              {from !== to && <div style={{ fontSize: 10, color: 'rgba(255,255,255,.6)' }}>to {toLbl}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* META ROW */}
      <div style={{ background: lightBg, borderBottom: `2px solid ${lightBorder}`, padding: '10px 40px', display: 'flex', gap: 24, fontSize: 11, color: '#64748B', fontWeight: 600, flexWrap: 'wrap' }}>
        <span>Generated: {generated}</span><span>•</span>
        <span>Total Records: {list.length}</span><span>•</span>
        <span>Received: {received.length}</span><span>•</span>
        <span>Pending: {pending.length}</span><span>•</span>
        <span>Rejected: {rejected.length}</span>
      </div>

      <div style={{ padding: '28px 40px' }}>
        {/* SUMMARY CARDS */}
        <div style={{ marginBottom: 24 }}>
          <div style={sectionTtl}>Financial Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <div style={{ background: isColor ? 'linear-gradient(135deg,#1E3A8A,#1E40AF)' : '#1a1a1a', borderRadius: 12, padding: 16, color: '#fff' }}>
              <div style={{ fontSize: 10, fontWeight: 700, opacity: .8, letterSpacing: 1, textTransform: 'uppercase' }}>Total Received</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>PKR {fmt(sum(received))}</div>
              <div style={{ fontSize: 10, opacity: .7, marginTop: 2 }}>{received.length} payments</div>
            </div>
            {[['Basic', byPlan.Basic, isColor ? '#0284C7' : '#555'], ['Pro', byPlan.Pro, isColor ? '#7C3AED' : '#555'], ['Premium', byPlan.Premium, isColor ? '#D97706' : '#555']].map(([name, arr, top]) => (
              <div key={name} style={{ background: lightBg, border: `1.5px solid ${lightBorder}`, borderRadius: 12, padding: 16, borderTop: `3px solid ${top}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', letterSpacing: 1, textTransform: 'uppercase' }}>{name} Plan</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: primary, marginTop: 6 }}>PKR {fmt(sum(arr))}</div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{arr.length} schools</div>
              </div>
            ))}
          </div>
        </div>

        {/* PAYMENT TABLE */}
        <div style={{ marginBottom: 24 }}>
          <div style={sectionTtl}>Payment Records</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: headerBg }}>
                <th style={th}>#</th><th style={th}>School</th><th style={th}>Campus</th><th style={th}>Plan</th>
                <th style={{ ...th, textAlign: 'right' }}>Amount</th><th style={th}>Date</th><th style={th}>Method</th><th style={th}>Status</th><th style={th}>Received By</th>
              </tr>
            </thead>
            <tbody>
              {list.map((x, i) => {
                const statusStyle = x.status === 'Received'
                  ? { background: 'rgba(22,163,74,.1)', color: '#15803d', border: '1px solid rgba(22,163,74,.3)' }
                  : x.status === 'Pending Verification'
                    ? { background: 'rgba(217,119,6,.1)', color: '#b45309', border: '1px solid rgba(217,119,6,.3)' }
                    : { background: 'rgba(220,38,38,.1)', color: '#b91c1c', border: '1px solid rgba(220,38,38,.3)' };
                const td = { padding: '9px 10px', borderBottom: '1px solid #E2E8F0' };
                return (
                  <tr key={x.id} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFF' }}>
                    <td style={{ ...td, color: '#94A3B8', fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ ...td, fontWeight: 700, color: '#0F172A' }}>{x.school}</td>
                    <td style={{ ...td, color: '#1E3A5F' }}>{x.campus}</td>
                    <td style={td}><span style={{ background: lightBg, color: primary, border: `1px solid ${lightBorder}`, borderRadius: 99, padding: '2px 8px', fontWeight: 700, fontSize: 9.5 }}>{x.paymentPlan}</span></td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: primary }}>PKR {fmt(x.amount)}</td>
                    <td style={{ ...td, color: '#1E3A5F' }}>{x.date}</td>
                    <td style={{ ...td, color: '#1E3A5F' }}>{x.method}</td>
                    <td style={td}><span style={{ ...statusStyle, borderRadius: 99, padding: '2px 8px', fontWeight: 700, fontSize: 9.5 }}>{x.status}</span></td>
                    <td style={{ ...td, color: '#1E3A5F' }}>{x.receivedBy}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: lightBg }}>
                <td colSpan={4} style={{ padding: '10px 10px', fontWeight: 800, color: primary, fontSize: 12, borderTop: `2px solid ${primary}` }}>Total (Received Payments)</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800, color: primary, fontSize: 13, borderTop: `2px solid ${primary}` }}>PKR {fmt(sum(received))}</td>
                <td colSpan={4} style={{ borderTop: `2px solid ${primary}` }} />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* SIGNATURES */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 30, marginTop: 36 }}>
          {['Prepared By', 'Verified By', 'Authorized By'].map((role) => (
            <div key={role} style={{ textAlign: 'center' }}>
              <div style={{ height: 44, borderBottom: '1.5px solid #0F172A', marginBottom: 6 }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0F172A' }}>{role}</div>
              <div style={{ fontSize: 9.5, color: '#64748B', marginTop: 2 }}>Name &amp; Designation</div>
            </div>
          ))}
        </div>

        {/* FOOTER */}
        <div style={{ marginTop: 28, paddingTop: 12, borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94A3B8', flexWrap: 'wrap', gap: 8 }}>
          <span>School Mentor ERP · Super Admin · Mentor AI Module</span>
          <span>Generated: {generated}</span>
          <span>CONFIDENTIAL — Internal Use Only</span>
        </div>
      </div>
    </div>
  );
}
