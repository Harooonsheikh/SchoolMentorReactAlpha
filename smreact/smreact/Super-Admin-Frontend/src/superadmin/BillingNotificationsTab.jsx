import React, { useState } from 'react';
import { fmtDateLong, todayISO } from './paymentData';
import {
  CHANNELS, PLACEHOLDERS, renderTemplate, FREQUENCY_OPTIONS,
} from './billingNotificationsData';

/* ═══════════════════════════════════════════════════════════════════
   NOTIFICATIONS & REMINDERS — billing reminder templates, scheduling,
   global announcement composer, and delivery audit log (brief §8).

   Deliberately separate screen from the existing Notifications.jsx
   (mobile push to parents/teachers/principal — a different recipient
   and purpose, confirmed via audit; see billingNotificationsData.js's
   header for the full reasoning).
   ═══════════════════════════════════════════════════════════════════ */

function Toggle({ checked, onChange }) {
  return <label className="sw"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><div className="sw-track" /><div className="sw-thumb" /></label>;
}
function CardHeader({ title, icon, sub }) {
  return <div className="card-header"><div><div className="card-title"><i className={`fa-solid ${icon}`} /> {title}</div>{sub && <div className="card-sub">{sub}</div>}</div></div>;
}

const PREVIEW_VALUES = {
  SchoolName: 'The City School, Johar Town', InvoiceNumber: 'INV-2026-0102', Amount: 'PKR 14,700',
  DueDate: fmtDateLong(todayISO()), GracePeriodEnd: fmtDateLong(todayISO()), RestrictionDate: fmtDateLong(todayISO()),
  BillingURL: 'https://app.schoolmentor.ai/billing',
};

function TemplateEditor({ title, icon, value, onChange, maxChars }) {
  const chars = (value.template || '').length;
  const over = chars > maxChars;
  return (
    <div className="section-card">
      <CardHeader title={title} icon={icon} />
      <div style={{ padding: '0 18px 18px' }}>
        <div className="pay-toggle-row">
          <div><div className="pay-toggle-label">Enabled</div><div className="pay-toggle-sub">Turn this reminder on or off without losing the configured message.</div></div>
          <Toggle checked={value.enabled} onChange={(v) => onChange({ ...value, enabled: v })} />
        </div>
        <div className="pay-field">
          <label>Message Template</label>
          <textarea className="pay-input" rows={4} style={{ height: 'auto', padding: '10px 14px', resize: 'vertical' }} value={value.template} onChange={(e) => onChange({ ...value, template: e.target.value })} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 10.5, color: 'var(--tm)' }}>Placeholders: {PLACEHOLDERS.join(' ')}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: over ? 'var(--err)' : 'var(--tm)' }}>{chars} / {maxChars}</span>
          </div>
          {over && <div style={{ fontSize: 11, color: 'var(--err)', marginTop: 4 }}><i className="fa-solid fa-triangle-exclamation" /> Message exceeds the configured maximum. Dynamic placeholders may expand further after substitution — shorten the template.</div>}
        </div>
        <div style={{ background: 'var(--muted)', border: '1.5px solid var(--bl)', borderRadius: 'var(--r-md)', padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--tm)', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 6 }}>Live Preview</div>
          <div style={{ fontSize: 12.5, color: 'var(--t1)', lineHeight: 1.6 }}>{renderTemplate(value.template, PREVIEW_VALUES)}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
          <div className="pay-field" style={{ marginBottom: 0 }}>
            <label>Frequency</label>
            <select className="pay-input" value={value.frequency} onChange={(e) => onChange({ ...value, frequency: e.target.value, times: e.target.value === 'twice_daily' ? [value.times[0] || '09:00', value.times[1] || '17:00'] : [value.times[0] || '09:00'] })}>
              {FREQUENCY_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div className="pay-field" style={{ marginBottom: 0 }}>
            <label>Send Time{value.frequency === 'twice_daily' ? 's' : ''}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="pay-input" type="time" value={value.times[0] || '09:00'} onChange={(e) => onChange({ ...value, times: [e.target.value, value.times[1]].filter(Boolean) })} />
              {value.frequency === 'twice_daily' && <input className="pay-input" type="time" value={value.times[1] || '17:00'} onChange={(e) => onChange({ ...value, times: [value.times[0], e.target.value] })} />}
            </div>
          </div>
        </div>
        {'daysBefore' in value && (
          <div className="pay-field"><label>Send Starting (days before due date)</label><input className="pay-input" type="number" min={1} value={value.daysBefore} onChange={(e) => onChange({ ...value, daysBefore: Number(e.target.value) || 1 })} /></div>
        )}
        <div className="pay-field">
          <label>Delivery Channels</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {CHANNELS.map((c) => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, opacity: c.configured ? 1 : 0.5, cursor: c.configured ? 'pointer' : 'not-allowed' }}>
                <input type="checkbox" disabled={!c.configured} checked={value.channels.includes(c.id)} onChange={(e) => {
                  const next = e.target.checked ? [...value.channels, c.id] : value.channels.filter((x) => x !== c.id);
                  onChange({ ...value, channels: next });
                }} />
                {c.label}{!c.configured && ' (Not Configured)'}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const ANN_TYPES = [
  { id: 'info', label: 'Informational' },
  { id: 'due_reminder', label: 'Upcoming Payment Due' },
  { id: 'grace_warning', label: 'Grace-Period Warning' },
  { id: 'restriction', label: 'Payment Required / Restricted' },
  { id: 'success', label: 'Payment Confirmation' },
];
export default function NotificationsRemindersTab({ settings, onSave, announcements, onDeleteAnnouncement, deliveryLog, toast, onSendRemindersNow }) {
  const [f, setF] = useState(settings);
  const dirty = JSON.stringify(f) !== JSON.stringify(settings);

  return (
    <div className="ss-panel">
      <TemplateEditor title="Before-Due Reminder" icon="fa-bell" value={f.beforeDue} onChange={(v) => setF((p) => ({ ...p, beforeDue: v }))} maxChars={f.maxChars} />
      <TemplateEditor title="Overdue / Grace-Period Warning" icon="fa-triangle-exclamation" value={f.overdueWarning} onChange={(v) => setF((p) => ({ ...p, overdueWarning: v }))} maxChars={f.maxChars} />

      <div className="section-card">
        <CardHeader title="General" icon="fa-sliders" />
        <div style={{ padding: '0 18px 18px', display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
          <div className="pay-field"><label>Maximum Character Count (per message)</label><input className="pay-input" type="number" min={100} max={2000} value={f.maxChars} onChange={(e) => setF((p) => ({ ...p, maxChars: Number(e.target.value) || 500 }))} /></div>
          <div className="pay-field"><label>Application Timezone</label><input className="pay-input" value={f.timezone} disabled /></div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 20 }}>
        <button className="btn-secondary" disabled={!dirty} onClick={() => setF(settings)}>Discard Changes</button>
        <button className="btn-primary" disabled={!dirty} onClick={() => onSave(f)}><i className="fa-solid fa-floppy-disk" /> Save Changes</button>
      </div>

      {announcements.length > 0 && (
        <div className="section-card">
          <CardHeader title="Active & Scheduled Announcements" icon="fa-list" />
          <div className="tbl-wrap" style={{ margin: '0 18px 18px' }}>
            <table className="ch-table">
              <thead><tr><th>Title</th><th style={{ width: 130 }}>Type</th><th style={{ width: 120 }}>Audience</th><th style={{ width: 100 }}>Start</th><th style={{ width: 100 }}>End</th><th style={{ width: 80, textAlign: 'center' }}>Active</th><th style={{ width: 70, textAlign: 'center' }}>Delete</th></tr></thead>
              <tbody>
                {announcements.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 700 }}>{a.title}</td>
                    <td><span className="badge b-blue" style={{ fontSize: 9 }}>{ANN_TYPES.find((t) => t.id === a.type)?.label}</span></td>
                    <td style={{ fontSize: 12 }}>{a.audience === 'all' ? 'All Schools' : 'ERP Schools'}</td>
                    <td style={{ fontSize: 12 }}>{fmtDateLong(a.startAt)}</td>
                    <td style={{ fontSize: 12 }}>{a.endAt ? fmtDateLong(a.endAt) : '—'}</td>
                    <td style={{ textAlign: 'center' }}>{a.active ? <span className="badge b-green" style={{ fontSize: 9 }}>Active</span> : <span className="badge b-gray" style={{ fontSize: 9 }}>Inactive</span>}</td>
                    <td style={{ textAlign: 'center' }}><button className="ch-btn ch-btn-del" onClick={() => onDeleteAnnouncement(a.id)}><i className="fa-solid fa-trash-can" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="section-card">
        <CardHeader title="Reminder Delivery History" icon="fa-truck-fast" sub="Every automated reminder/announcement send, with channel and status." />
        <div style={{ padding: '0 18px 14px' }}>
          <button className="btn-primary" onClick={onSendRemindersNow}><i className="fa-solid fa-paper-plane" /> Send Due Reminders Now</button>
          <span style={{ marginLeft: 10, fontSize: 11, color: 'var(--tm)' }}>Scans active schools against the templates above and logs deliveries below — idempotent, so running it again today won't duplicate anything already sent.</span>
        </div>
        <div className="tbl-wrap" style={{ margin: '0 18px 18px' }}>
          <table className="ch-table">
            <thead><tr><th>School</th><th>Invoice</th><th style={{ width: 140 }}>Type</th><th style={{ width: 110 }}>Channel</th><th style={{ width: 100, textAlign: 'center' }}>Status</th><th style={{ width: 110 }}>Sent At</th></tr></thead>
            <tbody>
              {deliveryLog.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--tm)', fontSize: 12.5 }}>No reminders sent yet. Templates above will populate this log once the billing cycle runs.</td></tr>
              ) : deliveryLog.slice().reverse().map((d) => (
                <tr key={d.id}>
                  <td>{d.schoolName}</td><td>{d.invoiceNumber || '—'}</td>
                  <td style={{ fontSize: 12 }}>{d.notifType}</td><td style={{ fontSize: 12 }}>{d.channel}</td>
                  <td style={{ textAlign: 'center' }}><span className={`badge ${d.status === 'sent' ? 'b-green' : d.status === 'failed' ? 'b-red' : 'b-gray'}`} style={{ fontSize: 9 }}>{d.status}</span></td>
                  <td style={{ fontSize: 11, color: 'var(--tm)' }}>{d.sentAt ? fmtDateLong(d.sentAt.slice(0, 10)) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
