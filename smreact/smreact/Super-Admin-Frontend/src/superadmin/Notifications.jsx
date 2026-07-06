import React, { useMemo, useState } from 'react';
import {
  AUDIENCES, SUB_AUDIENCES, NOTIF_TYPES, CLASSES, SECTIONS, INITIAL_NOTIFS,
  defaultSub, estimateRecipients, buildAudienceLabel, nowDateTime,
} from './notificationsData';

/* ═══════════════════════════════════════════════════════════════════
   NOTIFICATIONS — Super Admin module (frontend only)

   Send targeted mobile-app push notifications. Audience targets: All /
   Principal / Teachers / Parents (with parent class/section sub-targets).
   Two tabs: New Notification (composer + guidelines) and Sent
   Notifications (searchable/filterable list with edit & delete + confirm
   modals). All state is in-component demo state. No backend.
   ═══════════════════════════════════════════════════════════════════ */

export default function Notifications({ toast }) {
  const [tab, setTab] = useState('new');
  const [notifs, setNotifs] = useState(INITIAL_NOTIFS);
  const [modal, setModal] = useState(null);

  const stats = useMemo(() => ({
    sent: notifs.length,
    staff: notifs.filter((n) => n.audienceType === 'teachers' || n.audienceType === 'principal').length,
    parents: notifs.filter((n) => n.audienceType === 'parents').length,
    emergency: notifs.filter((n) => n.type === 'emergency').length,
  }), [notifs]);

  const send = (data) => {
    const { date, time } = nowDateTime();
    setNotifs((prev) => [{ id: Date.now(), ...data, date, time, sentBy: 'Admin' }, ...prev]);
    setModal(null); toast?.('Notification sent successfully to mobile app users.', 'success');
  };
  const saveEdit = (id, patch) => {
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, ...patch } : n));
    setModal(null); toast?.('Notification record updated successfully.', 'success');
  };
  const remove = (id) => {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    setModal(null); toast?.('Notification record deleted.', 'info');
  };

  return (
    <div className="page-content">
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 22 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,var(--brand),var(--brand-mid))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 14px rgba(30,58,138,.3)' }}><i className="fa-solid fa-bell" style={{ color: '#fff', fontSize: 20 }} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 27, fontWeight: 800, color: 'var(--t1)', lineHeight: 1.15, letterSpacing: '-.03em' }}>Notifications</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', letterSpacing: '.04em', textTransform: 'uppercase', marginTop: 3, opacity: 0.8 }}>Mobile App Push Notifications</div>
          <div style={{ fontSize: 13, color: 'var(--tm)', marginTop: 4, fontWeight: 500 }}>Send targeted push notifications to the principal, teachers and parents on the School Mentor mobile app.</div>
        </div>
      </div>

      {/* STATS */}
      <div className="notif-stats">
        <Stat icon="fa-paper-plane" iBg="var(--brand-light)" iColor="var(--brand)" val={stats.sent} lbl="Sent Notifications" />
        <Stat icon="fa-chalkboard-user" iBg="rgba(124,58,237,.1)" iColor="#7C3AED" val={stats.staff} lbl="Staff Notifications" />
        <Stat icon="fa-users" iBg="rgba(2,132,199,.1)" iColor="#0284C7" val={stats.parents} lbl="Parent Notifications" />
        <Stat icon="fa-triangle-exclamation" iBg="rgba(220,38,38,.08)" iColor="#DC2626" val={stats.emergency} lbl="Emergency Alerts" />
      </div>

      {/* TABS */}
      <div className="app-tabs">
        <button className={`app-tab${tab === 'new' ? ' active' : ''}`} onClick={() => setTab('new')}><i className="fa-solid fa-pen-to-square" /> New Notification</button>
        <button className={`app-tab${tab === 'sent' ? ' active' : ''}`} onClick={() => setTab('sent')}><i className="fa-solid fa-list-check" /> Sent Notifications <span className="tab-count">{notifs.length}</span></button>
      </div>

      {tab === 'new' && <Composer onReview={(data) => setModal({ type: 'confirm', data })} toast={toast} />}
      {tab === 'sent' && (
        <SentList notifs={notifs} total={notifs.length}
          onEdit={(n) => setModal({ type: 'edit', notif: n })}
          onDelete={(n) => setModal({ type: 'del', notif: n })} />
      )}

      {/* ── MODALS ── */}
      {modal?.type === 'confirm' && <ConfirmModal data={modal.data} onClose={() => setModal(null)} onSend={() => send(modal.data)} />}
      {modal?.type === 'edit' && <EditModal notif={modal.notif} onClose={() => setModal(null)} onSave={saveEdit} toast={toast} />}
      {modal?.type === 'del' && <DeleteModal onClose={() => setModal(null)} onConfirm={() => remove(modal.notif.id)} />}
    </div>
  );
}

function Stat({ icon, iBg, iColor, val, lbl }) {
  return (
    <div className="notif-stat">
      <div className="notif-stat-icon" style={{ background: iBg, color: iColor }}><i className={`fa-solid ${icon}`} /></div>
      <div><div className="notif-stat-val">{val}</div><div className="notif-stat-lbl">{lbl}</div></div>
    </div>
  );
}

/* ═══════════════════════ COMPOSER ═══════════════════════ */
function Composer({ onReview, toast }) {
  const [aud, setAud] = useState('all');
  const [sub, setSub] = useState('');
  const [cls, setCls] = useState('');
  const [section, setSection] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState('general');

  const subs = SUB_AUDIENCES[aud] || null;
  const showClass = sub === 'class-wise' || sub === 'class-section';
  const showSection = sub === 'class-section';
  const recipients = estimateRecipients(aud, sub);

  const pickAud = (a) => { setAud(a); setSub(defaultSub(a)); setCls(''); setSection(''); };

  const review = () => {
    if (!title.trim()) { toast?.('Please enter a notification title.', 'warn'); return; }
    if (!body.trim()) { toast?.('Please enter the notification message.', 'warn'); return; }
    if (showClass && !cls) { toast?.('Please select a class.', 'warn'); return; }
    onReview({
      title: title.trim(), body: body.trim(), type,
      audience: buildAudienceLabel(aud, sub, cls, section), audienceType: aud, subAud: sub,
      cls: showClass ? cls : '', section: showSection ? section : '', recipients,
    });
  };

  return (
    <div className="notif-layout">
      {/* Composer */}
      <div className="notif-card">
        <div className="notif-card-header">
          <div className="notif-card-icon"><i className="fa-solid fa-pen-to-square" /></div>
          <div><div className="notif-card-title">Compose Notification</div><div className="notif-card-sub">Fill in the details and send to the mobile app</div></div>
        </div>
        <div className="notif-card-body">
          {/* Audience */}
          <div>
            <label className="notif-form-label">Audience Type <span className="req-star">*</span></label>
            <div className="audience-pills" style={{ marginTop: 8 }}>
              {AUDIENCES.map((a) => (
                <button key={a.id} className={`audience-pill${aud === a.id ? ' active' : ''}`} onClick={() => pickAud(a.id)}><i className={`fa-solid ${a.icon}`} /> {a.label}</button>
              ))}
            </div>
          </div>

          {/* Sub-audience */}
          {subs && (
            <div>
              <label className="notif-form-label">Select {aud === 'teachers' ? 'Teacher' : 'Parent'} Group <span className="req-star">*</span></label>
              <div className="sub-audience-grid" style={{ marginTop: 8 }}>
                {subs.map((s) => (
                  <div key={s.id} className={`sub-audience-card${sub === s.id ? ' active' : ''}`} onClick={() => { setSub(s.id); if (!(s.id === 'class-wise' || s.id === 'class-section')) { setCls(''); setSection(''); } }}>
                    <div className="sub-audience-radio" /> {s.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Class / Section */}
          {showClass && (
            <div className="class-section-row">
              <div>
                <label className="notif-form-label">Class <span className="req-star">*</span></label>
                <select className="notif-form-input" style={{ marginTop: 6 }} value={cls} onChange={(e) => setCls(e.target.value)}><option value="">Select Class</option>{CLASSES.map((c) => <option key={c}>{c}</option>)}</select>
              </div>
              {showSection && (
                <div>
                  <label className="notif-form-label">Section <span className="req-star">*</span></label>
                  <select className="notif-form-input" style={{ marginTop: 6 }} value={section} onChange={(e) => setSection(e.target.value)}><option value="">Select Section</option>{SECTIONS.map((s) => <option key={s}>{s}</option>)}</select>
                </div>
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="notif-form-label">Notification Title <span className="req-star">*</span></label>
            <input className="notif-form-input" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter a clear, short title..." style={{ marginTop: 6 }} />
            <Counter len={title.length} max={80} />
          </div>

          {/* Body */}
          <div>
            <label className="notif-form-label">Notification Message <span className="req-star">*</span></label>
            <textarea className="notif-form-textarea" maxLength={300} rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write the notification message that users will see on their mobile app..." style={{ marginTop: 6 }} />
            <Counter len={body.length} max={300} />
          </div>

          {/* Type */}
          <div>
            <label className="notif-form-label">Notification Type <span className="req-star">*</span></label>
            <div className="notif-type-grid" style={{ marginTop: 8 }}>
              {NOTIF_TYPES.map((t) => (
                <button key={t.id} className={`notif-type-pill${type === t.id ? ' active' : ''}`} data-type={t.id} onClick={() => setType(t.id)}><i className={`fa-solid ${t.icon}`} /> {t.label}</button>
              ))}
            </div>
          </div>

          <button className="notif-send-btn" onClick={review}><i className="fa-solid fa-paper-plane" /> Send Notification</button>
        </div>
      </div>

      {/* Guidelines */}
      <div className="notif-card">
        <div className="notif-card-header">
          <div className="notif-card-icon" style={{ background: 'rgba(2,132,199,.1)', color: '#0284C7' }}><i className="fa-solid fa-circle-info" /></div>
          <div><div className="notif-card-title">Sending Guidelines</div><div className="notif-card-sub">Best practices for push notifications</div></div>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 11 }}>
          <Guide icon="fa-mobile-screen" color="var(--brand)" bg="var(--muted)" border="var(--bl)">Notifications are delivered instantly to all active School Mentor app users in the selected audience.</Guide>
          <Guide icon="fa-triangle-exclamation" color="#D97706" bg="rgba(217,119,6,.05)" border="rgba(217,119,6,.18)">Use <strong>Emergency</strong> only for critical situations. Overuse may cause users to ignore alerts.</Guide>
          <Guide icon="fa-pen" color="#0284C7" bg="var(--muted)" border="var(--bl)">Keep title under 60 chars and body under 200 chars for best display on all devices.</Guide>
          <Guide icon="fa-shield-halved" color="#16A34A" bg="var(--muted)" border="var(--bl)">Notifications cannot be recalled after sending. Review carefully before clicking <strong>Send Now</strong>.</Guide>
          <div style={{ background: 'var(--brand-light)', border: '1px solid var(--bl)', borderRadius: 'var(--r-md)', padding: '13px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}><i className="fa-solid fa-users" style={{ marginRight: 5 }} />Estimated Recipients</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand)' }}>~{recipients}</div>
            <div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 2 }}>Based on current audience selection</div>
          </div>
        </div>
      </div>
    </div>
  );
}
function Counter({ len, max }) {
  const cls = len >= max ? ' over' : len > max * 0.9 ? ' warn' : '';
  return <div className={`notif-char-counter${cls}`}>{len} / {max}</div>;
}
function Guide({ icon, color, bg, border, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 13px', background: bg, borderRadius: 'var(--r-md)', border: `1px solid ${border}` }}>
      <i className={`fa-solid ${icon}`} style={{ color, marginTop: 1, flexShrink: 0 }} />
      <div style={{ fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

/* ═══════════════════════ SENT LIST ═══════════════════════ */
function TypeBadge({ type }) {
  const t = NOTIF_TYPES.find((x) => x.id === type) || NOTIF_TYPES[0];
  return <span className={`notif-type-badge ntb-${type}`}><i className={`fa-solid ${t.icon}`} /> {t.label}</span>;
}
function SentList({ notifs, total, onEdit, onDelete }) {
  const [q, setQ] = useState('');
  const [aud, setAud] = useState('');
  const [type, setType] = useState('');
  const list = notifs.filter((n) => {
    const matchQ = !q || n.title.toLowerCase().includes(q.toLowerCase()) || n.audience.toLowerCase().includes(q.toLowerCase()) || n.type.includes(q.toLowerCase()) || (n.cls || '').toLowerCase().includes(q.toLowerCase());
    const matchA = !aud || n.audienceType === aud;
    const matchT = !type || n.type === type;
    return matchQ && matchA && matchT;
  });
  return (
    <div className="notif-table-wrap">
      <div className="notif-filter-bar">
        <div className="notif-filter-search"><i className="fa-solid fa-magnifying-glass" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title, audience, class, type..." /></div>
        <select className="notif-filter-sel" value={aud} onChange={(e) => setAud(e.target.value)}><option value="">All Audiences</option>{AUDIENCES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
        <select className="notif-filter-sel" value={type} onChange={(e) => setType(e.target.value)}><option value="">All Types</option>{NOTIF_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
      </div>
      <div className="notif-table-head">
        <div className="notif-th">Title &amp; Message</div><div className="notif-th">Audience &amp; Class</div><div className="notif-th">Type</div><div className="notif-th">Sent At</div><div className="notif-th">Recipients</div><div className="notif-th">Actions</div>
      </div>
      <div>
        {list.length === 0 ? (
          <div className="notif-empty"><div className="notif-empty-icon"><i className="fa-solid fa-magnifying-glass" /></div><div className="notif-empty-title">{total ? 'No results found' : 'No notifications sent yet'}</div><div className="notif-empty-sub">{total ? 'Try a different search term or filter.' : 'Compose your first notification and send it to staff or parents.'}</div></div>
        ) : list.map((n) => (
          <div className="notif-row" key={n.id}>
            <div className="notif-td">
              <div className="notif-title-txt">{n.title}</div>
              <div className="notif-body-txt">{n.body}</div>
              <div style={{ marginTop: 4 }}><span className="notif-delivered"><i className="fa-solid fa-circle-check" /> Delivered</span></div>
            </div>
            <div className="notif-td">
              <div style={{ fontSize: 12, color: 'var(--t1)', fontWeight: 600 }}>{n.audience}</div>
              {n.cls && <div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 2 }}><i className="fa-solid fa-chalkboard" style={{ fontSize: 9, marginRight: 3 }} />{n.cls}{n.section ? ` · Sec ${n.section}` : ''}</div>}
              <div style={{ fontSize: 10.5, color: 'var(--tm)', marginTop: 2 }}><i className="fa-solid fa-user-tie" style={{ fontSize: 9, marginRight: 3 }} />{n.sentBy}</div>
            </div>
            <div className="notif-td"><TypeBadge type={n.type} /></div>
            <div className="notif-td"><div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--t1)' }}>{n.date}</div><div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 2 }}>{n.time}</div></div>
            <div className="notif-td"><div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)' }}>~{n.recipients}</div><div style={{ fontSize: 10.5, color: 'var(--tm)' }}>recipients</div></div>
            <div className="notif-td">
              <div className="notif-act-btns">
                <button className="notif-edit-btn" data-tip="Edit record" data-tip-pos="left" onClick={() => onEdit(n)}><i className="fa-solid fa-pen" /></button>
                <button className="notif-del-btn" data-tip="Delete record" data-tip-pos="left" onClick={() => onDelete(n)}><i className="fa-solid fa-trash-can" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════ MODALS ═══════════════════════ */
function Sheet({ maxWidth = 480, onClose, children }) {
  return <div className="notif-ov open" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className="notif-modal" style={{ maxWidth }}>{children}</div></div>;
}

function ConfirmModal({ data, onClose, onSend }) {
  const t = NOTIF_TYPES.find((x) => x.id === data.type) || NOTIF_TYPES[0];
  const Row = ({ label, val }) => <div className="ncs-row"><span className="ncs-label">{label}</span><span className="ncs-val">{val}</span></div>;
  return (
    <Sheet onClose={onClose}>
      <div className="notif-modal-hdr"><div className="modal-title"><i className="fa-solid fa-paper-plane" /> Confirm Notification</div><button className="modal-close" data-tip="Close" onClick={onClose}><i className="fa-solid fa-xmark" /></button></div>
      <div className="notif-modal-body">
        <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 12 }}>This notification will be sent to the selected users on their <strong>mobile applications</strong>. Please review the details below before confirming.</div>
        <div className="notif-confirm-summary">
          <Row label="Audience" val={data.audience} />
          <Row label="Type" val={t.label} />
          <Row label="Recipients" val={`~${data.recipients} users`} />
          <Row label="Title" val={data.title} />
        </div>
        <div className="notif-helper-warn"><i className="fa-solid fa-circle-info" /> Notifications cannot be recalled after sending.</div>
      </div>
      <div className="notif-modal-foot"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={onSend}><i className="fa-solid fa-paper-plane" /> Send Now</button></div>
    </Sheet>
  );
}

function EditModal({ notif, onClose, onSave, toast }) {
  const [title, setTitle] = useState(notif.title);
  const [body, setBody] = useState(notif.body);
  const [type, setType] = useState(notif.type);
  const [sentBy, setSentBy] = useState(notif.sentBy || '');
  const save = () => {
    if (!title.trim()) { toast?.('Please enter a notification title.', 'warn'); return; }
    if (!body.trim()) { toast?.('Please enter the notification message.', 'warn'); return; }
    onSave(notif.id, { title: title.trim(), body: body.trim(), type, sentBy: sentBy.trim() || notif.sentBy });
  };
  return (
    <Sheet maxWidth={640} onClose={onClose}>
      <div className="notif-modal-hdr"><div className="modal-title"><i className="fa-solid fa-pen" /> Edit Notification</div><button className="modal-close" data-tip="Close" onClick={onClose}><i className="fa-solid fa-xmark" /></button></div>
      <div className="notif-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="notif-form-label">Notification Title <span className="req-star">*</span></label>
          <input className="notif-form-input" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} style={{ marginTop: 6 }} />
          <Counter len={title.length} max={80} />
        </div>
        <div>
          <label className="notif-form-label">Notification Message <span className="req-star">*</span></label>
          <textarea className="notif-form-textarea" maxLength={300} rows={4} value={body} onChange={(e) => setBody(e.target.value)} style={{ marginTop: 6 }} />
          <Counter len={body.length} max={300} />
        </div>
        <div>
          <label className="notif-form-label">Notification Type</label>
          <div className="notif-type-grid" style={{ marginTop: 8 }}>
            {NOTIF_TYPES.map((t) => <button key={t.id} className={`notif-type-pill${type === t.id ? ' active' : ''}`} data-type={t.id} onClick={() => setType(t.id)}><i className={`fa-solid ${t.icon}`} /> {t.label}</button>)}
          </div>
        </div>
        <div>
          <label className="notif-form-label">Sent By</label>
          <input className="notif-form-input" value={sentBy} onChange={(e) => setSentBy(e.target.value)} placeholder="e.g. Principal" style={{ marginTop: 6 }} />
        </div>
      </div>
      <div className="notif-modal-foot"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save Changes</button></div>
    </Sheet>
  );
}

function DeleteModal({ onClose, onConfirm }) {
  return (
    <Sheet maxWidth={440} onClose={onClose}>
      <div className="notif-modal-hdr"><div className="modal-title">Delete Notification Record</div><button className="modal-close" data-tip="Close" onClick={onClose}><i className="fa-solid fa-xmark" /></button></div>
      <div className="notif-modal-body" style={{ textAlign: 'center', padding: '26px 22px' }}>
        <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'rgba(220,38,38,.1)', border: '2px solid rgba(220,38,38,.25)', color: '#DC2626', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><i className="fa-solid fa-trash-can" /></div>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>Delete this record?</div>
        <div style={{ fontSize: 13, color: 'var(--tm)', lineHeight: 1.6 }}>This will remove the notification from the ERP sent list only. The notification has already been delivered to mobile app users and cannot be recalled.</div>
      </div>
      <div className="notif-modal-foot"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-danger" onClick={onConfirm}><i className="fa-solid fa-trash-can" /> Delete Record</button></div>
    </Sheet>
  );
}
