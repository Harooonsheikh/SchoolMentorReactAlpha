import React, { useMemo, useState } from 'react';
import { PAY_SCHOOLS, fmtDateLong } from './paymentData';
import {
  summarizeAutomation, previewTimeline, RESTRICTION_MODE_LABEL,
} from './billingAutomationData';

/* ═══════════════════════════════════════════════════════════════════
   BILLING AUTOMATION — settings screen (brief §4). Clear sections,
   helper text, a live computed summary, and a timeline preview so
   Customer Support staff never have to guess what a setting will
   actually do.

   The manual "Run Billing Cycle Now" trigger + job-run history, and
   the Access & Override Audit Trail table, were removed from this
   screen at the product owner's request — the underlying logic
   (billingEngine.js's runBillingCycle, the accessEvents audit trail
   itself) is untouched and still recorded on every automated/manual
   restrict-or-restore, just no longer surfaced here. The Manual
   Overrides list below still shows active grace-period/restore
   overrides.
   ═══════════════════════════════════════════════════════════════════ */

function Toggle({ checked, onChange }) {
  return <label className="sw"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><div className="sw-track" /><div className="sw-thumb" /></label>;
}
function Field({ label, hint, children }) {
  return (
    <div className="pay-field">
      <label>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export default function BillingAutomationTab({ settings, onSave, overrides, schools }) {
  const [f, setF] = useState(settings);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const dirty = JSON.stringify(f) !== JSON.stringify(settings);

  const timeline = useMemo(() => previewTimeline(f), [f]);
  const summary = useMemo(() => summarizeAutomation(f), [f]);

  const schoolList = schools && schools.length ? schools : PAY_SCHOOLS;
  const schoolName = (id) => schoolList.find((s) => s.id === id)?.name || `School #${id}`;

  return (
    <div className="ss-panel">
      <div className="section-card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,var(--brand),var(--brand-mid))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><i className="fa-solid fa-robot" /></div>
          <div><div style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1)', marginBottom: 4 }}>At a Glance</div><div style={{ fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.6 }}>{summary}</div></div>
        </div>
      </div>

      {/* ── A. Master switch ── */}
      <div className="section-card">
        <CardHeader title="Enable Automated Billing" icon="fa-power-off" />
        <div style={{ padding: '0 18px 18px' }}>
          <div className="pay-toggle-row">
            <div><div className="pay-toggle-label">Enable Automated Billing</div><div className="pay-toggle-sub">When disabled, scheduled invoice generation and automated sending stop. Invoices already issued are not cancelled, payment records are not removed, and existing restrictions are not reversed.</div></div>
            <Toggle checked={f.enabled} onChange={(v) => set('enabled', v)} />
          </div>
        </div>
      </div>

      {/* ── B/C/D. Dates ── */}
      <div className="section-card">
        <CardHeader title="Invoice Dates" icon="fa-calendar-days" />
        <div style={{ padding: '0 18px 18px', display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
          <Field label="Billing Day of Month" hint="The invoice is generated on this day each month.">
            <input className="pay-input" type="number" min={1} max={31} value={f.billingDay} onChange={(e) => set('billingDay', Math.min(31, Math.max(1, Number(e.target.value) || 1)))} />
          </Field>
          <Field label="Fallback for Short Months" hint="Used when the billing day doesn't exist in a given month (e.g. day 31 in February).">
            <select className="pay-input" value={f.fallbackPolicy} onChange={(e) => set('fallbackPolicy', e.target.value)}>
              <option value="last_day">Generate on the last calendar day</option>
              <option value="specific_date">Generate on a specific fallback date</option>
            </select>
          </Field>
          {f.fallbackPolicy === 'specific_date' && (
            <Field label="Fallback Date (day of month)"><input className="pay-input" type="number" min={1} max={28} value={f.fallbackDate} onChange={(e) => set('fallbackDate', e.target.value)} placeholder="e.g. 28" /></Field>
          )}
          <Field label="Invoice Send Timing" hint="When the generated invoice becomes visible to the school.">
            <select className="pay-input" value={f.generateSendSameDay ? 'same' : 'offset'} onChange={(e) => set('generateSendSameDay', e.target.value === 'same')}>
              <option value="same">Send on the same day it's generated</option>
              <option value="offset">Send on a separate, later date</option>
            </select>
          </Field>
          {!f.generateSendSameDay && <Field label="Send Offset (days after generation)"><input className="pay-input" type="number" min={0} value={f.sendOffsetDays} onChange={(e) => set('sendOffsetDays', Number(e.target.value) || 0)} /></Field>}
          <Field label="Due Date (days after issuance)" hint="Applied identically to every school in a billing run."><input className="pay-input" type="number" min={0} value={f.dueDays} onChange={(e) => set('dueDays', Number(e.target.value) || 0)} /></Field>
          <Field label="Grace Period (days after due date)"><input className="pay-input" type="number" min={0} value={f.graceDays} onChange={(e) => set('graceDays', Number(e.target.value) || 0)} /></Field>
          <Field label="Restriction Cutoff Time" hint="Restriction only applies at/after this time on the first day past the grace period."><input className="pay-input" type="time" value={f.restrictionCutoffTime} onChange={(e) => set('restrictionCutoffTime', e.target.value)} /></Field>
        </div>
        <div style={{ margin: '0 18px 18px', background: 'var(--muted)', border: '1.5px solid var(--bl)', borderRadius: 'var(--r-md)', padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--tm)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 10 }}>Timeline Preview — for an invoice generated today</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <TimelineStep label="Issued" value={timeline.issueDateLabel} />
            <i className="fa-solid fa-arrow-right" style={{ color: 'var(--tm)', fontSize: 11 }} />
            <TimelineStep label="Sent" value={timeline.sendDateLabel} />
            <i className="fa-solid fa-arrow-right" style={{ color: 'var(--tm)', fontSize: 11 }} />
            <TimelineStep label="Due" value={timeline.dueDateLabel} />
            <i className="fa-solid fa-arrow-right" style={{ color: 'var(--tm)', fontSize: 11 }} />
            <TimelineStep label="Grace Ends" value={timeline.graceEndLabel} />
            <i className="fa-solid fa-arrow-right" style={{ color: 'var(--tm)', fontSize: 11 }} />
            <TimelineStep label="Restriction" value={timeline.restrictionDateLabel} tone="red" />
          </div>
        </div>
      </div>

      {/* ── F. Restriction policy ── */}
      <div className="section-card">
        <CardHeader title="Access Restriction Policy" icon="fa-lock" />
        <div style={{ padding: '0 18px 18px' }}>
          <div className="pay-toggle-row">
            <div><div className="pay-toggle-label">Restrict School Access After Grace Period</div><div className="pay-toggle-sub">Only applies to active schools with a completed payment setup whose due date and grace period have both elapsed, and no verified payment or active override exists.</div></div>
            <Toggle checked={f.restrictionEnabled} onChange={(v) => set('restrictionEnabled', v)} />
          </div>
          {f.restrictionEnabled && (
            <Field label="Restriction Mode" hint="Controls how much access a restricted school retains.">
              <select className="pay-input" value={f.restrictionMode} onChange={(e) => set('restrictionMode', e.target.value)}>
                {Object.entries(RESTRICTION_MODE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          )}
          <div className="pay-info-box" style={{ marginTop: 10 }}><i className="fa-solid fa-shield-halved" /><p>Guardrails that always apply, regardless of this setting: never restricts an inactive school, never restricts a school with no payment setup, never restricts before due date + grace period, and never removes a valid manual override before its approved expiry.</p></div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 24 }}>
        <button className="btn-secondary" disabled={!dirty} onClick={() => setF(settings)}>Discard Changes</button>
        <button className="btn-primary" disabled={!dirty} onClick={() => onSave(f)}><i className="fa-solid fa-floppy-disk" /> Save Changes</button>
      </div>

      {overrides.length > 0 && (
        <div className="section-card">
          <CardHeader title="Manual Overrides" icon="fa-hourglass-half" />
          <div className="tbl-wrap" style={{ margin: '0 18px 18px' }}>
            <table className="ch-table">
              <thead><tr><th>School</th><th>Invoice</th><th>Reason</th><th style={{ textAlign: 'center' }}>Expires</th><th style={{ textAlign: 'center' }}>Cycle</th></tr></thead>
              <tbody>
                {overrides.slice().reverse().map((o) => (
                  <tr key={o.id}>
                    <td>{schoolName(o.schoolId)}</td>
                    <td>{o.invoiceNumber === 'all' ? 'All Outstanding' : o.invoiceNumber}</td>
                    <td style={{ fontSize: 12 }}>{o.reason}</td>
                    <td style={{ textAlign: 'center', fontSize: 12 }}>{fmtDateLong(o.expiryDate)}</td>
                    <td style={{ textAlign: 'center', fontSize: 12 }}>{o.cycleKey}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function CardHeader({ title, icon }) {
  return <div className="card-header"><div><div className="card-title"><i className={`fa-solid ${icon}`} /> {title}</div></div></div>;
}
function TimelineStep({ label, value, tone }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 12px', background: 'var(--card)', border: `1.5px solid ${tone === 'red' ? 'var(--err)' : 'var(--bl)'}`, borderRadius: 8, minWidth: 90 }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--tm)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 800, color: tone === 'red' ? 'var(--err)' : 'var(--t1)', marginTop: 2 }}>{value}</div>
    </div>
  );
}
