import React, { useEffect, useMemo, useState } from 'react';
import { getPaymentLedger, getBillingSetup, getPaymentReceivings } from '../services/billingService';
import { reportSchoolName, loadReportBranch } from '../reports/reportKit';

const monthLabel = (iso) => {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};
const invNo = (row) => (row ? `INV-${row.paymentID}-${(row.dueDate || '').slice(0, 7).replace('-', '')}` : '');
const fmtAmt = (n) => `Rs. ${(Number(n) || 0).toLocaleString()}`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDateLong = (iso) => {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
};
const monthLabelFull = (iso) => {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

/* Setup (summary) sirf usi challan ka formula hai jiska paymentID = setup.id
   (setup id na aaye to purana rawaiya — setup lagao). */
const isSetupOf = (setup, row) => !!setup && (!setup.id || Number(setup.id) === Number(row?.paymentID));

/* Print-ready subscription invoice (opens in a new window → Save as PDF). */
function buildInvoiceHtml(row, { setup, schoolName }) {
  const no = invNo(row);
  const paid = row.status === 'Paid';
  const statusColor = paid ? '#166534' : '#b91c1c';
  const statusBg = paid ? '#dcfce7' : '#fee2e2';
  const isPerStudent = isSetupOf(setup, row) && !setup.isLumpSum && setup.totalStudents > 0;
  const basisRows = isPerStudent
    ? `<tr><td>Rate / Student</td><td style="text-align:right;font-weight:700">${fmtAmt(setup.perStudent)}</td></tr>
       <tr><td>Students</td><td style="text-align:right;font-weight:700">${setup.totalStudents}</td></tr>
       <tr><td>Base Amount</td><td style="text-align:right;font-weight:700;color:#1e40af">${fmtAmt(row.debit)}</td></tr>`
    : `<tr><td>Billing Basis</td><td style="text-align:right;font-weight:700">Lump Sum</td></tr>
       <tr><td>Subscription Amount</td><td style="text-align:right;font-weight:700;color:#1e40af">${fmtAmt(row.debit)}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(no)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif}
    body{background:#eef2ff;padding:24px;color:#0f172a}
    .inv{max-width:720px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 10px 40px rgba(30,58,138,.12);border-top:4px solid #1e3a8a}
    .hd{display:flex;justify-content:space-between;align-items:flex-start;padding:26px 30px 18px}
    .brand{font-size:13px;font-weight:800;color:#1e3a8a}.sch{font-size:19px;font-weight:800;margin-top:12px}
    .sub{font-size:12px;color:#64748b;margin-top:2px}.site{font-size:11px;color:#94a3b8;text-align:right}
    .ititle{font-size:24px;font-weight:800;color:#1e40af;text-align:right;letter-spacing:.5px}
    .ino{font-size:11px;color:#64748b;text-align:right;margin-top:2px}
    .badge{display:inline-block;margin-top:8px;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:800;background:${statusBg};color:${statusColor}}
    .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:18px 30px;background:#f8fafc;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0}
    .meta .k{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.4px}
    .meta .v{font-size:13.5px;font-weight:700;margin-top:4px}
    .cols{display:grid;grid-template-columns:1fr 1fr;gap:26px;padding:24px 30px}
    .sec-h{font-size:11px;font-weight:800;color:#1e40af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
    table{width:100%;border-collapse:collapse;font-size:13px}td{padding:7px 0;border-bottom:1px solid #f1f5f9}
    .total{margin:0 30px 22px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center}
    .total .k{font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.4px}.total .v{font-size:24px;font-weight:800;color:#1e40af}
    .note{margin:0 30px 22px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;font-size:12px;color:#92400e;line-height:1.55}.note b{display:block;margin-bottom:4px}
    .ft{text-align:center;font-size:11px;color:#94a3b8;padding:14px 0 22px}
    @media print{body{background:#fff;padding:0}.inv{box-shadow:none;border-radius:0}}
  </style></head><body>
  <div class="inv">
    <div class="hd">
      <div><div class="brand">🎓 School Mentor</div><div class="sch">${esc(schoolName)}</div><div class="sub">Subscription Billing — Head Office</div></div>
      <div><div class="site">www.schoolmentor.ai</div><div class="ititle">INVOICE</div><div class="ino">${esc(no)}</div><div class="badge">${esc(row.status)}</div></div>
    </div>
    <div class="meta">
      <div><div class="k">Billing Month</div><div class="v">${esc(monthLabelFull(row.dueDate))}</div></div>
      <div><div class="k">Issue Date</div><div class="v">${esc(fmtDateLong(row.issueDate))}</div></div>
      <div><div class="k">Due Date</div><div class="v">${esc(fmtDateLong(row.dueDate))}</div></div>
    </div>
    <div class="cols">
      <div><div class="sec-h">Billing Basis</div><table>${basisRows}</table></div>
      <div><div class="sec-h">Net Payable</div><table>
        <tr><td>Charged</td><td style="text-align:right;font-weight:700">${fmtAmt(row.debit)}</td></tr>
        <tr><td>Paid</td><td style="text-align:right;font-weight:700">${row.credit > 0 ? fmtAmt(row.credit) : '—'}</td></tr>
        <tr><td>Challan Type</td><td style="text-align:right;font-weight:700">${esc(row.challanType)}</td></tr>
      </table></div>
    </div>
    <div class="total"><div class="k">Total Payable</div><div class="v">${fmtAmt(row.total)}</div></div>
    <div class="note"><b>ℹ Payment Instructions</b>Pay the outstanding amount through 1LINK (card payment supported where available). The receiving is generated automatically after payment verification — no need to send this invoice or a receipt to Head Office manually.</div>
    <div class="ft">This is a system-generated invoice from School Mentor.</div>
  </div>
  </body></html>`;
}

const Billing = ({ onToast }) => {
  const T = {
    brandPrimary: 'var(--brand-primary, #1E3A8A)',
    brandMid: 'var(--brand-mid, #2563EB)',
    bgBase: 'var(--bg-base, #F0F4FF)',
    bgCard: 'var(--bg-card, #FFFFFF)',
    bgMuted: 'var(--bg-muted, #EFF6FF)',
    textPrimary: 'var(--text-primary, #0F172A)',
    textSecondary: 'var(--text-secondary, #1E3A5F)',
    textMuted: 'var(--text-muted, #64748B)',
    success: 'var(--success, #16A34A)',
    error: 'var(--error, #DC2626)',
    warning: 'var(--warning, #D97706)',
    borderLight: 'var(--border-light, #BFDBFE)',
    radiusMd: 'var(--radius-md, 10px)',
    radiusLg: 'var(--radius-lg, 14px)',
    shadowSm: 'var(--shadow-sm, 0 2px 6px rgba(30,58,138,.18), 0 1px 2px rgba(0,0,0,.05))',
    font: 'var(--font-body, "Plus Jakarta Sans", system-ui, sans-serif)',
  };

  const CSS = `
    .billing-container {
      padding: 20px 18px;
      background: ${T.bgBase};
      min-height: 100%;
      font-family: ${T.font};
      color: ${T.textPrimary};
    }
    .billing-header {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 20px;
    }
    .billing-header-icon {
      width: 46px;
      height: 46px;
      border-radius: 13px;
      background: linear-gradient(135deg, ${T.brandPrimary}, ${T.brandMid});
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      box-shadow: ${T.shadowSm};
    }
    .billing-header-text h1 {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0;
    }
    .billing-header-text p {
      font-size: 13px;
      color: ${T.textMuted};
      margin: 0;
    }
    .billing-top-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }
    .billing-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }
    .billing-badge.overdue {
      background: rgba(220, 38, 38, 0.1);
      color: #b91c1c;
    }
    .billing-badge.paid {
      background: rgba(22, 163, 74, 0.1);
      color: #166534;
    }
    .billing-badge.partial {
      background: rgba(217, 119, 6, 0.12);
      color: #b45309;
    }
    .billing-button {
      padding: 8px 16px;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
    }
    .billing-button.primary {
      background: ${T.brandMid};
      color: white;
    }
    .billing-button.primary:hover {
      background: ${T.brandPrimary};
    }
    .billing-button.secondary {
      background: transparent;
      border: 1.5px solid ${T.borderLight};
      color: ${T.textSecondary};
    }
    .billing-button.secondary:hover {
      background: ${T.bgMuted};
    }
    .billing-card {
      background: ${T.bgCard};
      border-radius: ${T.radiusLg};
      box-shadow: ${T.shadowSm};
      padding: 24px;
      margin-bottom: 20px;
    }
    .billing-card-header {
      font-size: 16px;
      font-weight: 700;
      color: ${T.textPrimary};
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .billing-info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }
    .billing-info-item {
      display: flex;
      flex-direction: column;
    }
    .billing-info-label {
      font-size: 12px;
      font-weight: 600;
      color: ${T.textSecondary};
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .billing-info-value {
      font-size: 14px;
      font-weight: 700;
      color: ${T.brandMid};
      font-family: "Courier New", monospace;
    }
    .billing-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .billing-table thead tr {
      border-bottom: 2px solid ${T.borderLight};
      background: ${T.bgMuted};
    }
    .billing-table th {
      padding: 12px;
      text-align: left;
      font-weight: 700;
      color: ${T.textSecondary};
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .billing-table td {
      padding: 12px;
      border-bottom: 1px solid ${T.borderLight};
      color: ${T.textPrimary};
    }
    .billing-table tbody tr:hover {
      background: ${T.bgMuted};
    }
    .billing-status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      width: fit-content;
    }
    .billing-status-badge.paid {
      background: rgba(22, 163, 74, 0.1);
      color: ${T.success};
    }
    .billing-status-badge.overdue {
      background: rgba(220, 38, 38, 0.1);
      color: ${T.error};
    }
    .billing-status-badge.partial {
      background: rgba(217, 119, 6, 0.12);
      color: #b45309;
    }
    .billing-instructions {
      margin-top: 20px;
      padding: 16px;
      background: ${T.bgMuted};
      border-left: 4px solid ${T.brandMid};
      border-radius: ${T.radiusMd};
    }
    .billing-instructions h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 700;
      color: ${T.textPrimary};
    }
    .billing-instructions ul {
      margin: 0;
      padding-left: 20px;
    }
    .billing-instructions li {
      margin-bottom: 8px;
      font-size: 13px;
      color: ${T.textSecondary};
      line-height: 1.5;
    }

    /* Pay Now modal */
    .billing-pay-ov {
      position: fixed; inset: 0; z-index: 1000;
      background: rgba(15,23,42,.45); backdrop-filter: blur(2px);
      display: flex; align-items: center; justify-content: center; padding: 20px;
    }
    .billing-pay-modal {
      width: 100%; max-width: 440px; background: ${T.bgCard};
      border-radius: 16px; box-shadow: 0 30px 80px rgba(0,0,0,.28);
      padding: 20px; animation: billingPayIn .22s ease both;
    }
    @keyframes billingPayIn { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: none; } }
    .billing-pay-hd { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
    .billing-pay-hd-ic {
      width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
      background: ${T.bgMuted}; color: ${T.brandMid};
      display: flex; align-items: center; justify-content: center; font-size: 15px;
    }
    .billing-pay-title { font-size: 16px; font-weight: 800; color: ${T.textPrimary}; }
    .billing-pay-sub { font-size: 12px; color: ${T.textMuted}; margin-top: 2px; }
    .billing-pay-x {
      width: 30px; height: 30px; border-radius: 8px; border: 1px solid ${T.borderLight};
      background: ${T.bgMuted}; color: ${T.textMuted}; cursor: pointer; font-size: 13px; flex-shrink: 0;
    }
    .billing-pay-x:hover { background: rgba(220,38,38,.1); color: ${T.error}; }
    .billing-pay-amt {
      background: ${T.bgMuted}; border: 1px solid ${T.borderLight};
      border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 14px;
    }
    .billing-pay-amt-lbl { font-size: 11px; font-weight: 700; color: ${T.textMuted}; text-transform: uppercase; letter-spacing: .5px; }
    .billing-pay-amt-val { font-size: 32px; font-weight: 800; color: ${T.brandMid}; margin-top: 6px; }
    .billing-pay-note {
      display: flex; gap: 10px; align-items: flex-start;
      background: ${T.bgMuted}; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px;
      font-size: 12.5px; color: ${T.textSecondary}; line-height: 1.5;
    }
    .billing-pay-note i { color: ${T.brandMid}; margin-top: 2px; }
    .billing-pay-cta {
      width: 100%; padding: 14px; border: none; border-radius: 10px;
      background: ${T.brandPrimary}; color: #fff; font-size: 14px; font-weight: 700;
      cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
      transition: background .15s;
    }
    .billing-pay-cta:hover { background: ${T.brandMid}; }
  `;

  /* Live subscription data — challan ledger (history + current) + payment
     setup (billing formula), mapped into the SAME fields this UI renders. */
  const [rawLedger, setRawLedger] = useState([]);
  const [receivings, setReceivings] = useState([]);   // Super Admin ki darj ki hui payments
  const [setup, setSetup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payRow, setPayRow] = useState(null);        // Pay Now modal target (raw ledger row)

  useEffect(() => {
    let alive = true;
    /* Branch name/logo for the invoice — same source as every ERP report
       (GET /report-header/{branchID}, cached in reportKit). */
    loadReportBranch();
    setLoading(true);
    Promise.all([
      getPaymentLedger({ challanType: 'Monthly' }),
      getBillingSetup().catch(() => null),
      getPaymentReceivings().catch(() => []),
    ])
      .then(([rows, s, recvs]) => { if (!alive) return; setRawLedger(rows); setSetup(s); setReceivings(recvs); })
      .catch(() => { if (alive) { setRawLedger([]); setSetup(null); setReceivings([]); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  /* Har challan ke saath uski receiving (paymentLedgerID = challan id) —
     Payment Date, Received aur asal status (Paid / Partial / Overdue). */
  const ledger = useMemo(() => rawLedger.map((row) => {
    const recv = receivings.find((r) => Number(r.ledgerId) === Number(row.id)) || null;
    if (!recv) return { ...row, recv: null, received: 0 };
    const paid = recv.remaining <= 0 || recv.received >= (recv.netPayable || row.total);
    return {
      ...row,
      recv,
      received: recv.received,
      status: paid ? 'Paid' : (recv.received > 0 ? 'Partial' : row.status),
    };
  }), [rawLedger, receivings]);

  /* Billing History — top card wale challan ke ilawa baaki challans (ledger)
     + saari receivings, ek hi table me, sab se taaza date upar. */
  const history = useMemo(() => {
    const challans = ledger.slice(1).map((row) => ({
      key: `c-${row.id}`,
      kind: 'Challan',
      date: row.issueDate || row.dueDate || '',
      month: monthLabel(row.dueDate),
      invoiceNo: invNo(row),
      amount: row.total,
      received: row.received,
      remaining: row.recv ? row.recv.remaining : row.total - row.received,
      dueDate: row.dueDate || '—',
      status: row.status,
    }));
    const recvs = receivings.map((r) => ({
      key: `r-${r.id}`,
      kind: 'Receiving',
      date: r.date || '',
      month: r.month && r.year
        ? new Date(r.year, r.month - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
        : '—',
      invoiceNo: invNo(rawLedger.find((l) => Number(l.id) === Number(r.ledgerId))) || (r.ledgerId ? `Challan #${r.ledgerId}` : '—'),
      amount: r.netPayable || r.payable,
      received: r.received,
      remaining: r.remaining,
      dueDate: '—',
      via: r.via,
    }));
    return [...challans, ...recvs].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [ledger, receivings, rawLedger]);

  /* Latest challan → Current Invoice card. Sab kuch ISI challan se; setup
     ka formula sirf tab jab challan usi setup (paymentID) ka ho. */
  const current = useMemo(() => {
    const row = ledger[0];
    if (!row) return null;
    const isPerStudent = isSetupOf(setup, row) && !setup.isLumpSum && setup.totalStudents > 0;
    return {
      month: monthLabel(row.dueDate),
      invoiceNo: invNo(row),
      billingFormula: isPerStudent ? 'Per Student' : 'Lump Sum',
      formulaDetail: isPerStudent
        ? `Rs. ${(setup.perStudent || 0).toLocaleString()} × ${setup.totalStudents} students`
        : 'Lump-sum subscription',
      baseAmount: row.debit,
      issueDate: row.issueDate || '—',
      dueDate: row.dueDate || '—',
      totalPayable: row.total,
      received: row.received,
      remaining: row.recv ? row.recv.remaining : row.total,
      paymentDate: row.recv?.date || '',
      status: row.status,
    };
  }, [ledger, setup]);

  const currentRow = ledger[0] || null;   // raw row for Pay Now / Download

  const handlePayNow = () => { if (currentRow) setPayRow(currentRow); };

  /* "Continue to Secure Checkout" — hand off to 1LINK (real gateway URL is
     injected by the host; until then surface the handoff clearly). */
  const handleCheckout = () => {
    onToast?.('Redirecting to 1LINK secure checkout…', 'info');
    setPayRow(null);
  };

  /* Download Invoice — print-ready invoice in a new window (Save as PDF). */
  const handleDownload = () => {
    if (!currentRow) { onToast?.('No invoice to download yet.', 'error'); return; }
    const w = window.open('', '_blank');
    if (!w) { onToast?.('Please allow pop-ups to download the invoice.', 'error'); return; }
    const schoolName = reportSchoolName() || 'Your School';   // from /report-header (reportKit)
    w.document.write(buildInvoiceHtml(currentRow, { setup, schoolName }));
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch { /* ignore */ } }, 350);
    onToast?.('Invoice ready — use your browser’s print / save as PDF.', 'success');
  };

  return (
    <div className="billing-container">
      <style>{CSS}</style>

      {/* Header */}
      <div className="billing-header">
        <div className="billing-header-icon">
          <i className="fa-solid fa-file-invoice-dollar"></i>
        </div>
        <div className="billing-header-text">
          <h1>Billing</h1>
          <p>Your School Mentor subscription invoices and OneLink payment status</p>
        </div>
      </div>

      {/* Current Invoice */}
      <div className="billing-card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: T.textMuted }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }}></i>Loading current invoice…
          </div>
        ) : !current ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: T.textMuted }}>No invoice issued yet.</div>
        ) : (
        <>
        <div className="billing-top-row">
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>
              {current.month}
            </div>
            <div style={{ fontSize: 12, color: T.textMuted }}>
              {current.invoiceNo}
            </div>
          </div>
          <div className="billing-top-row" style={{ gap: 8, marginBottom: 0 }}>
            <div className={`billing-badge ${current.status.toLowerCase()}`}>
              <i className={`fa-solid ${current.status === 'Overdue' ? 'fa-circle-exclamation' : current.status === 'Partial' ? 'fa-circle-half-stroke' : 'fa-check-circle'}`}></i>
              {current.status === 'Partial' ? 'Partially Paid' : current.status}
            </div>
            <button className="billing-button primary" onClick={handlePayNow}>
              <i className="fa-solid fa-credit-card"></i>
              Pay Now
            </button>
            <button className="billing-button secondary" onClick={handleDownload}>
              <i className="fa-solid fa-download"></i>
              Download Invoice
            </button>
          </div>
        </div>

        <div className="billing-info-grid">
          <div className="billing-info-item">
            <div className="billing-info-label">Billing Formula</div>
            <div className="billing-info-value" style={{ color: T.textSecondary, fontWeight: 600 }}>
              {current.billingFormula}
            </div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
              {current.formulaDetail}
            </div>
          </div>
          <div className="billing-info-item">
            <div className="billing-info-label">Issue Date</div>
            <div className="billing-info-value">{current.issueDate}</div>
          </div>
          <div className="billing-info-item">
            <div className="billing-info-label">Due Date</div>
            <div className="billing-info-value">{current.dueDate}</div>
          </div>
          <div className="billing-info-item">
            <div className="billing-info-label">Base Amount</div>
            <div className="billing-info-value">Rs. {current.baseAmount.toLocaleString()}</div>
          </div>
          <div className="billing-info-item">
            <div className="billing-info-label" style={{ fontWeight: 700 }}>Total Payable</div>
            <div className="billing-info-value" style={{ fontSize: 18, color: T.brandMid }}>
              Rs. {current.totalPayable.toLocaleString()}
            </div>
          </div>
          <div className="billing-info-item">
            <div className="billing-info-label">Received</div>
            <div className="billing-info-value" style={{ color: T.success }}>Rs. {current.received.toLocaleString()}</div>
            {current.paymentDate && (
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>on {current.paymentDate}</div>
            )}
          </div>
          <div className="billing-info-item">
            <div className="billing-info-label">Remaining</div>
            <div className="billing-info-value" style={{ color: current.remaining > 0 ? T.error : T.success }}>
              Rs. {Math.max(0, current.remaining).toLocaleString()}
            </div>
          </div>
        </div>
        </>
        )}
      </div>

      {/* Billing History — challans (get_payment_ledger) + receivings
          (get_payment_receiving), sab se taaza upar. */}
      <div className="billing-card">
        <div className="billing-card-header">
          <i className="fa-solid fa-history"></i>
          Billing History
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="billing-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Month</th>
                <th>Invoice #</th>
                <th>Amount</th>
                <th>Received</th>
                <th>Remaining</th>
                <th>Due Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '24px 0', color: T.textMuted }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }}></i>Loading…
                </td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '24px 0', color: T.textMuted }}>No billing history yet.</td></tr>
              ) : history.map((h) => (
                <tr key={h.key}>
                  <td style={{ fontWeight: 600 }}>{h.date || '—'}</td>
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: h.kind === 'Receiving' ? 'rgba(22,163,74,.1)' : 'rgba(37,99,235,.1)', color: h.kind === 'Receiving' ? T.success : T.brandMid }}>
                      <i className={`fa-solid ${h.kind === 'Receiving' ? 'fa-receipt' : 'fa-file-invoice'}`} style={{ marginRight: 5 }}></i>{h.kind}
                    </span>
                  </td>
                  <td>{h.month}</td>
                  <td>{h.invoiceNo}</td>
                  <td style={{ fontWeight: 700, color: T.brandMid }}>Rs. {(h.amount || 0).toLocaleString()}</td>
                  <td style={{ fontWeight: 600, color: h.received > 0 ? T.success : T.textMuted }}>
                    {h.received > 0 ? `Rs. ${h.received.toLocaleString()}` : '—'}
                  </td>
                  <td style={{ fontWeight: 600, color: h.remaining > 0 ? T.error : T.textMuted }}>
                    {h.remaining > 0 ? `Rs. ${h.remaining.toLocaleString()}` : '—'}
                  </td>
                  <td>{h.dueDate}</td>
                  <td>
                    {h.kind === 'Receiving' ? (
                      <div className="billing-status-badge paid">
                        <i className="fa-solid fa-money-bill-wave"></i>
                        Received{h.via && h.via !== '—' ? ` · ${h.via}` : ''}
                      </div>
                    ) : (
                      <div className={`billing-status-badge ${h.status.toLowerCase()}`}>
                        <i className={`fa-solid ${h.status === 'Paid' ? 'fa-check-circle' : h.status === 'Partial' ? 'fa-circle-half-stroke' : 'fa-circle-exclamation'}`}></i>
                        {h.status === 'Partial' ? 'Partially Paid' : h.status}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Instructions */}
      <div className="billing-card">
        <div className="billing-card-header">
          <i className="fa-solid fa-circle-info"></i>
          Payment Instructions
        </div>
        <div className="billing-instructions">
          <h4>How to Pay</h4>
          <ul>
            <li>Make a payment through OneLink using the invoice details shown above.</li>
            <li>Pay the exact outstanding amount displayed on the invoice — partial amounts may not be reconciled automatically.</li>          </ul>
        </div>
      </div>

      {/* Pay Now modal — handoff to 1LINK secure checkout */}
      {payRow && (
        <div className="billing-pay-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) setPayRow(null); }}>
          <div className="billing-pay-modal">
            <div className="billing-pay-hd">
              <div className="billing-pay-hd-ic"><i className="fa-solid fa-credit-card"></i></div>
              <div style={{ flex: 1 }}>
                <div className="billing-pay-title">Pay Now</div>
                <div className="billing-pay-sub">{invNo(payRow)}</div>
              </div>
              <button className="billing-pay-x" onClick={() => setPayRow(null)} aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="billing-pay-amt">
              <div className="billing-pay-amt-lbl">Amount to Pay</div>
              <div className="billing-pay-amt-val">{fmtAmt(payRow.total)}</div>
            </div>
            <div className="billing-pay-note">
              <i className="fa-solid fa-shield-halved"></i>
              <span>You’ll be redirected to 1LINK’s secure checkout to pay with Visa or Mastercard. School Mentor never sees or stores your card details.</span>
            </div>
            <button className="billing-pay-cta" onClick={handleCheckout}>
              <i className="fa-solid fa-lock"></i> Continue to Secure Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Billing;
