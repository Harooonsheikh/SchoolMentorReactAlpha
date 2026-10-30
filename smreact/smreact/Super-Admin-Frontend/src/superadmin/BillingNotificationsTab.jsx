import React, { useEffect, useState } from 'react';
import { fmtDateLong, todayISO } from './paymentData';
import {
  CHANNELS, PLACEHOLDERS, renderTemplate, FREQUENCY_OPTIONS,
  validateNotifSettings, HISTORY_CHANNEL_LABEL, HISTORY_TYPE_LABEL,
} from './billingNotificationsData';
import { paymentsApi } from './api';

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
const HISTORY_PAGE_SIZE = 20;

/* Screen D — delivery history (server se, paged). Ek challan ke kai Failed
   rows phir ek Sent row aana normal hai (server 3 dafa retry karta hai). */
function DeliveryHistory({ refreshKey }) {
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [state, setState] = useState({ items: [], totalCount: 0, loading: true, error: '' });
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    paymentsApi.getBillingReminderHistory({ pageNumber: page, pageSize: HISTORY_PAGE_SIZE, reminderType: type })
      .then((r) => { if (alive) setState({ items: r.items, totalCount: r.totalCount, loading: false, error: '' }); })
      .catch((e) => { if (alive) setState({ items: [], totalCount: 0, loading: false, error: e?.message || 'Could not load delivery history' }); });
    return () => { alive = false; };
  }, [page, type, refreshKey]);

  const pages = Math.max(1, Math.ceil(state.totalCount / HISTORY_PAGE_SIZE));
  const val = (o, k) => o[k] ?? o[k[0].toUpperCase() + k.slice(1)];

  return (
    <>
      <div style={{ padding: '0 18px 10px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <select className="pay-input" style={{ width: 180 }} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
          <option value="">All reminder types</option>
          <option value="Generated">Invoice generated</option>
          <option value="BeforeDue">Before due</option>
          <option value="Overdue">Overdue</option>
        </select>
        <span style={{ fontSize: 11, color: 'var(--tm)' }}>{state.totalCount} record{state.totalCount === 1 ? '' : 's'}</span>
      </div>
      <div className="tbl-wrap" style={{ margin: '0 18px 12px' }}>
        <table className="ch-table">
          <thead><tr><th>School</th><th style={{ width: 90 }}>Challan</th><th style={{ width: 110 }}>Type</th><th style={{ width: 120 }}>Channel</th><th style={{ width: 100, textAlign: 'right' }}>Amount</th><th style={{ width: 90, textAlign: 'center' }}>Status</th><th style={{ width: 150 }}>Sent On</th></tr></thead>
          <tbody>
            {state.loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--tm)', fontSize: 12.5 }}><i className="fa-solid fa-spinner fa-spin" /> Loading delivery history…</td></tr>
            ) : state.error ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--err)', fontSize: 12.5 }}><i className="fa-solid fa-triangle-exclamation" /> {state.error}</td></tr>
            ) : state.items.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--tm)', fontSize: 12.5 }}>No reminders sent yet. Rows appear here after the next scheduled send.</td></tr>
            ) : state.items.map((d, i) => {
              const id = val(d, 'id') ?? i;
              const status = String(val(d, 'status') || '');
              const failed = status.toLowerCase() === 'failed';
              const reason = val(d, 'failureReason');
              const body = val(d, 'messageBody');
              const sentOn = val(d, 'sentOn');
              const channel = val(d, 'channel');
              const rType = val(d, 'reminderType');
              const open = openId === id;
              return (
                <React.Fragment key={id}>
                  <tr style={{ cursor: (reason || body) ? 'pointer' : 'default' }} onClick={() => (reason || body) && setOpenId(open ? null : id)} title={failed && reason ? reason : undefined}>
                    <td>{val(d, 'schoolName') || `Branch #${val(d, 'branchID') ?? '—'}`}</td>
                    <td>{val(d, 'challanID') ?? '—'}</td>
                    <td style={{ fontSize: 12 }}>{HISTORY_TYPE_LABEL[rType] || rType || '—'}</td>
                    <td style={{ fontSize: 12 }}>{HISTORY_CHANNEL_LABEL[channel] || channel || '—'}</td>
                    <td style={{ textAlign: 'right', fontSize: 12 }}>{val(d, 'amount') != null ? Number(val(d, 'amount')).toLocaleString() : '—'}</td>
                    <td style={{ textAlign: 'center' }}><span className={`badge ${failed ? 'b-red' : status.toLowerCase() === 'sent' ? 'b-green' : 'b-gray'}`} style={{ fontSize: 9 }}>{status || '—'}</span></td>
                    <td style={{ fontSize: 11, color: 'var(--tm)' }}>{sentOn ? new Date(sentOn).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  </tr>
                  {open && (
                    <tr><td colSpan={7} style={{ background: 'var(--muted)', fontSize: 12, lineHeight: 1.6 }}>
                      {failed && reason && <div style={{ color: 'var(--err)', marginBottom: body ? 6 : 0 }}><strong>Failure reason:</strong> {reason}</div>}
                      {body && <div><strong>Message:</strong> {body}</div>}
                    </td></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div style={{ padding: '0 18px 18px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
          <button className="btn-secondary" disabled={page <= 1 || state.loading} onClick={() => setPage((p) => p - 1)}><i className="fa-solid fa-chevron-left" /> Prev</button>
          <span style={{ fontSize: 12, color: 'var(--tm)' }}>Page {page} of {pages}</span>
          <button className="btn-secondary" disabled={page >= pages || state.loading} onClick={() => setPage((p) => p + 1)}>Next <i className="fa-solid fa-chevron-right" /></button>
        </div>
      )}
    </>
  );
}

export default function NotificationsRemindersTab({ settings, onSave, announcements, onDeleteAnnouncement, toast, onSendRemindersNow, loadError = '' }) {
  const [f, setF] = useState(settings);
  /* Server se settings aayen (load / save ke baad) to form unhi par. */
  useEffect(() => { setF(settings); }, [settings]);
  const dirty = JSON.stringify(f) !== JSON.stringify(settings);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);

  const save = async () => {
    const err = validateNotifSettings(f);
    if (err) { toast?.(err, 'error'); return; }
    setSaving(true);
    try { await onSave(f); } finally { setSaving(false); }
  };

  /* Do dafa click na ho — request ke dauran button band. */
  const sendNow = async () => {
    if (sending) return;
    setSending(true);
    try { await onSendRemindersNow(); setHistoryKey((k) => k + 1); } finally { setSending(false); }
  };

  return (
    <div className="ss-panel">
      {loadError && (
        <div className="pay-info-box" style={{ marginBottom: 16, borderColor: 'var(--err)' }}><i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--err)' }} /><p>Could not load saved reminder settings — showing defaults. {loadError}</p></div>
      )}
      <TemplateEditor title="Before-Due Reminder" icon="fa-bell" value={f.beforeDue} onChange={(v) => setF((p) => ({ ...p, beforeDue: v }))} maxChars={f.maxChars} />
      <TemplateEditor title="Overdue / Grace-Period Warning" icon="fa-triangle-exclamation" value={f.overdueWarning} onChange={(v) => setF((p) => ({ ...p, overdueWarning: v }))} maxChars={f.maxChars} />

      <div className="section-card">
        <CardHeader title="General" icon="fa-sliders" />
        <div style={{ padding: '0 18px 18px', display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
          <div className="pay-field"><label>Maximum Character Count (per message)</label><input className="pay-input" type="number" min={1} max={2000} value={f.maxChars} onChange={(e) => setF((p) => ({ ...p, maxChars: Number(e.target.value) || 500 }))} /></div>
          <div className="pay-field">
            <label>Application Timezone</label>
            <input className="pay-input" value={f.timezone} disabled />
            <div style={{ fontSize: 10.5, color: 'var(--tm)', marginTop: 4 }}>Send times always run on Pakistan time (server timezone).</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 6 }}>
        <button className="btn-secondary" disabled={!dirty || saving} onClick={() => setF(settings)}>Discard Changes</button>
        <button className="btn-primary" disabled={!dirty || saving} onClick={save}>
          <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} /> {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
      <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--tm)', marginBottom: 20 }}>
        <i className="fa-solid fa-circle-info" /> Saved settings apply to every unpaid challan, including ones created earlier. The server checks every 5 minutes, so reminders go out at the chosen time or within about 5 minutes after it.
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
        <CardHeader title="Reminder Delivery History" icon="fa-truck-fast" sub="Every reminder the server sent or tried to send, with channel and status. Click a row for the message / failure reason." />
        <div style={{ padding: '0 18px 14px' }}>
          <button className="btn-primary" disabled={sending} onClick={sendNow}>
            <i className={`fa-solid ${sending ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} /> {sending ? 'Sending…' : 'Send Due Reminders Now'}
          </button>
          <span style={{ marginLeft: 10, fontSize: 11, color: 'var(--tm)' }}>Scans unpaid challans and sends immediately — paid challans are skipped by the server.</span>
        </div>
        <DeliveryHistory refreshKey={historyKey} />
      </div>
    </div>
  );
}
