import React from 'react';
import { mockBillingData } from '../mock/billingData';

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
  `;

  const current = mockBillingData.currentInvoice;
  const previous = mockBillingData.previousMonths;

  const handlePayNow = () => {
    if (onToast) onToast('Redirecting to payment gateway...', 'info');
  };

  const handleDownload = () => {
    if (onToast) onToast('Invoice downloaded', 'success');
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
        <div className="billing-top-row">
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, marginBottom: 4 }}>
              {current.month}
            </div>
            <div style={{ fontSize: 12, color: T.textMuted }}>
              INV-2026-0107
            </div>
          </div>
          <div className="billing-top-row" style={{ gap: 8, marginBottom: 0 }}>
            <div className={`billing-badge ${current.status.toLowerCase()}`}>
              <i className={`fa-solid ${current.status === 'Overdue' ? 'fa-circle-exclamation' : 'fa-check-circle'}`}></i>
              {current.status}
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
              Rs. {current.baseAmount.toLocaleString()} × {current.students} students
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
            <div className="billing-info-label">Late Surcharge</div>
            <div className="billing-info-value">Rs. {current.lateSurcharge.toLocaleString()}</div>
          </div>
          <div className="billing-info-item">
            <div className="billing-info-label">Service Charge</div>
            <div className="billing-info-value">Rs. {current.serviceCharge.toLocaleString()}</div>
          </div>
          <div className="billing-info-item">
            <div className="billing-info-label" style={{ fontWeight: 700 }}>Total Payable</div>
            <div className="billing-info-value" style={{ fontSize: 18, color: T.brandMid }}>
              Rs. {current.totalPayable.toLocaleString()}
            </div>
          </div>
          <div className="billing-info-item">
            <div className="billing-info-label">PS ID</div>
            <div className="billing-info-value" style={{ color: T.brandMid, fontSize: 16, fontWeight: 700 }}>
              {current.psId}
            </div>
            <button style={{
              marginTop: 8,
              padding: '4px 8px',
              background: 'transparent',
              border: '1px solid ' + T.borderLight,
              color: T.brandMid,
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 4,
              cursor: 'pointer',
            }}>
              Copy PS ID
            </button>
          </div>
        </div>
      </div>

      {/* Previous Invoices */}
      <div className="billing-card">
        <div className="billing-card-header">
          <i className="fa-solid fa-history"></i>
          Previous 6 Months
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="billing-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Invoice #</th>
                <th>Base</th>
                <th>Service Charge</th>
                <th>Surcharge</th>
                <th>Total</th>
                <th>Due Date</th>
                <th>Payment Date</th>
                <th>Status</th>
                <th>PS ID</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {previous.map((inv, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600 }}>{inv.month}</td>
                  <td>{inv.invoiceNo}</td>
                  <td>Rs. {inv.base.toLocaleString()}</td>
                  <td>Rs. {inv.serviceCharge.toLocaleString()}</td>
                  <td>{inv.surcharge > 0 ? 'Rs. ' + inv.surcharge.toLocaleString() : '—'}</td>
                  <td style={{ fontWeight: 700, color: T.brandMid }}>Rs. {inv.total.toLocaleString()}</td>
                  <td>{inv.dueDate}</td>
                  <td>{inv.paymentDate}</td>
                  <td>
                    <div className={`billing-status-badge ${inv.status.toLowerCase()}`}>
                      <i className={`fa-solid ${inv.status === 'Paid' ? 'fa-check-circle' : 'fa-circle-exclamation'}`}></i>
                      {inv.status}
                    </div>
                  </td>
                  <td style={{ color: T.brandMid, fontWeight: 600, fontSize: 12 }}>{inv.psId}</td>
                  <td>
                    <button style={{
                      padding: '4px 8px',
                      background: 'transparent',
                      border: 'none',
                      color: T.brandMid,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                    }}>
                      View
                    </button>
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
            <li>Use the PS ID shown above (OL-702104) to make a payment through OneLink.</li>
            <li>Pay the exact outstanding amount displayed on the invoice — partial amounts may not be reconciled automatically.</li>
            <li>A OneLink service charge of Rs. 50 per transaction applies and is already included in the total payable amount shown above.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Billing;
