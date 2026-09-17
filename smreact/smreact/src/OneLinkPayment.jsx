import { useState } from 'react';
import { buildUrl, apiMessage } from './utils/apiConfig';
import './OneLinkPayment.css';

function sessionUserId() {
  return Number(
    sessionStorage.getItem('UserID')
    || sessionStorage.getItem('employee_ID')
    || 0
  ) || 0;
}

export default function OneLinkPayment() {
  const [entryCode, setEntryCode] = useState('');
  const [studentId, setStudentId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const code = entryCode.trim();
    const sidRaw = studentId.trim();
    const bidRaw = branchId.trim();
    const mthRaw = month.trim();
    const yrRaw = year.trim();
    const amtRaw = amount.trim();
    const sid = Number(sidRaw);
    const bid = Number(bidRaw);
    const mth = Number(mthRaw);
    const yr = Number(yrRaw);
    const amt = Number(amtRaw);

    if (!code || !sidRaw || !bidRaw || !mthRaw || !yrRaw || !amtRaw
      || !Number.isFinite(sid) || !Number.isFinite(bid)
      || !Number.isFinite(mth) || !Number.isFinite(yr) || !Number.isFinite(amt)) {
      setMsg({ type: 'err', text: 'Please fill Entery Code, Student ID, Branch ID, Month, Year and Payment Amount.' });
      return;
    }
    if (mth < 1 || mth > 12) {
      setMsg({ type: 'err', text: 'Month must be between 1 and 12.' });
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      const token = sessionStorage.getItem('token');
      const res = await fetch(buildUrl('/api/BranchLedger/onelink-receive-payment'), {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          studentID: sid,
          branchID: bid,
          month: mth,
          year: yr,
          paymentAmount: amt,
          modifiedBy: sessionUserId(),
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success === false) {
        setMsg({
          type: 'err',
          text: apiMessage(json) || `Payment could not be received (${res.status}).`,
        });
        return;
      }

      setMsg({
        type: 'ok',
        text: apiMessage(json) || `Payment received · Entery Code ${code} · Student ${sid} · Branch ${bid} · ${mth}/${yr} · Payment Amount ${amt}.`,
      });
    } catch (err) {
      setMsg({ type: 'err', text: err?.message || 'Could not reach the payment API.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="olp-page">
      <div className="olp-wrap">
        <div className="olp-card">
          <div className="olp-head">
            <div className="olp-badge">1-Link · Bank Payment</div>
            <h1>School Mentor Payment by 1-Link</h1>
            <p>Enter student, branch and billing year to receive payment.</p>
          </div>
          <form className="olp-form" onSubmit={handleSubmit} autoComplete="off">
            <label>
              Entery Code
              <input
                type="text"
                placeholder="e.g. ENT-001"
                value={entryCode}
                onChange={(e) => setEntryCode(e.target.value)}
                required
              />
            </label>
            <label>
              Student ID
              <input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 1249266"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                required
              />
            </label>
            <label>
              Branch ID
              <input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 210742"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                required
              />
            </label>
            <div className="olp-row">
              <label>
                Month
                <input
                  type="number"
                  min="1"
                  max="12"
                  inputMode="numeric"
                  placeholder="e.g. 09"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  required
                />
              </label>
              <label>
                Year
                <input
                  type="number"
                  min="2000"
                  max="2100"
                  inputMode="numeric"
                  placeholder="e.g. 2026"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  required
                />
              </label>
            </div>
            <label>
              Payment Amount
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="e.g. 5000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </label>
            <button className="olp-btn" type="submit" disabled={loading}>
              {loading ? 'Receiving…' : 'Received'}
            </button>
            {msg && (
              <div className={`olp-msg ${msg.type}`} role="status">
                {msg.text}
              </div>
            )}
          </form>
        </div>
        <div className="olp-foot">School Mentor ERP · Payment collection via 1-Link</div>
      </div>
    </div>
  );
}
