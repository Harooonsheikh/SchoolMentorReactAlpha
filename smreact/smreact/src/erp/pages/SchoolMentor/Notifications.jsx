import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import TutorialModal from '../../components/TutorialModal';

/* ═══════════════════════════════════════════════════════════════════
   NOTIFICATIONS — mobile-app push notifications

   Ported from "e tube, chat and Notification .html". Two tabs:

     • New Notification — compose a push: pick an audience (Staff /
       Parents) and sub-audience, optionally narrow to a class/section,
       write a title + message (with live char counters), choose a type
       (General / Important / Reminder / Emergency), preview the
       estimated recipients, then confirm & send.
     • Sent Notifications — searchable/filterable log of everything that
       has gone out, with edit + delete (ERP-record only; the push has
       already been delivered and cannot be recalled).

   Stat strip + a sent-count tab badge sit above the tabs. All state is
   in-component demo state — a developer wires this to the push API later.
   ═══════════════════════════════════════════════════════════════════ */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STAFF_SUBS = [
  { id: 'all-staff',      label: 'All Staff' },
  { id: 'teaching',       label: 'Teaching Staff' },
  { id: 'admin',          label: 'Admin Staff' },
  { id: 'support',        label: 'Support Staff' },
  { id: 'specific-staff', label: 'Specific Member' },
];
const PARENT_SUBS = [
  { id: 'all-parents',     label: 'All Parents' },
  { id: 'class-wise',      label: 'Class Wise' },
  { id: 'class-section',   label: 'Class + Section' },
  { id: 'specific-parent', label: 'Specific Parent' },
];

const CLASSES = ['Nursery', 'KG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
const SECTIONS = ['A', 'B', 'C', 'D'];

const TYPES = [
  { id: 'general',   label: 'General',   icon: 'fa-bell' },
  { id: 'important', label: 'Important', icon: 'fa-circle-exclamation' },
  { id: 'reminder',  label: 'Reminder',  icon: 'fa-clock' },
  { id: 'emergency', label: 'Emergency', icon: 'fa-triangle-exclamation' },
];

const SUB_LABELS = {
  'all-staff': 'All Staff', teaching: 'Teaching Staff', admin: 'Admin Staff', support: 'Support Staff', 'specific-staff': 'Specific Member',
  'all-parents': 'All Parents', 'class-wise': 'Class Wise', 'class-section': 'Class + Section', 'specific-parent': 'Specific Parent',
};

const RECIPIENT_COUNTS = {
  'all-staff': 47, teaching: 28, admin: 12, support: 7, 'specific-staff': 1,
  'all-parents': 380, 'class-wise': 32, 'class-section': 16, 'specific-parent': 1,
};

const INITIAL_SENT = [
  { id: 1001, title: 'PTM Reminder — This Friday', body: 'Parent-Teacher Meeting is scheduled for Friday, 27 June 2026 at 9:00 AM. All parents are requested to attend.', audience: 'Parents — All Parents', audienceType: 'parents', subAud: 'all-parents', cls: '', section: '', type: 'reminder', date: '22 Jun 2026', time: '10:00 am', recipients: 380, sentBy: 'Principal' },
  { id: 1002, title: 'School Closed Tomorrow', body: 'Due to heavy rainfall, school will remain closed on Monday, 23 June 2026. Classes will resume on Tuesday.', audience: 'Parents — All Parents', audienceType: 'parents', subAud: 'all-parents', cls: '', section: '', type: 'important', date: '22 Jun 2026', time: '06:30 pm', recipients: 380, sentBy: 'Admin' },
  { id: 1003, title: 'Staff Meeting — Monday 8 AM', body: 'All teaching staff are required to attend the monthly staff meeting on Monday at 8:00 AM in the conference room.', audience: 'Staff — Teaching Staff', audienceType: 'staff', subAud: 'teaching', cls: '', section: '', type: 'general', date: '21 Jun 2026', time: '04:15 pm', recipients: 28, sentBy: 'Principal' },
  { id: 1004, title: 'Fee Submission Last Date', body: 'Last date for June fee submission is 25 June 2026. After this date, a late fine will be charged. Please submit fee on time.', audience: 'Parents — Class Wise · Class 5', audienceType: 'parents', subAud: 'class-wise', cls: 'Class 5', section: '', type: 'reminder', date: '20 Jun 2026', time: '11:00 am', recipients: 32, sentBy: 'Admin' },
  { id: 1005, title: 'EMERGENCY: Gas Leak — Early Dismissal', body: 'Due to a gas supply issue, all students will be dismissed at 12:00 PM today. Parents please arrange pick-up urgently.', audience: 'Parents — All Parents', audienceType: 'parents', subAud: 'all-parents', cls: '', section: '', type: 'emergency', date: '19 Jun 2026', time: '09:45 am', recipients: 380, sentBy: 'Principal' },
  { id: 1006, title: 'New Syllabus Uploaded', body: 'Updated syllabus for Term 2 has been uploaded to the school app. All staff are requested to review and plan lessons accordingly.', audience: 'Staff — All Staff', audienceType: 'staff', subAud: 'all-staff', cls: '', section: '', type: 'general', date: '18 Jun 2026', time: '03:00 pm', recipients: 47, sentBy: 'Principal' },
  { id: 1007, title: 'Annual Sports Day — Registration Open', body: 'Annual Sports Day registrations are now open. Parents please register your children via the School Mentor app by 26 June.', audience: 'Parents — All Parents', audienceType: 'parents', subAud: 'all-parents', cls: '', section: '', type: 'general', date: '17 Jun 2026', time: '01:30 pm', recipients: 380, sentBy: 'Admin' },
  { id: 1008, title: 'Salary Slip — June 2026', body: 'Salary slips for June 2026 have been uploaded to your staff portal. Please check and contact Admin for any discrepancies.', audience: 'Staff — All Staff', audienceType: 'staff', subAud: 'all-staff', cls: '', section: '', type: 'general', date: '16 Jun 2026', time: '05:00 pm', recipients: 47, sentBy: 'Admin' },
];

const counterClass = (len, max) => `nt-counter${len >= max ? ' over' : len > max * 0.9 ? ' warn' : ''}`;

function TypeBadge({ type }) {
  const t = TYPES.find(x => x.id === type) || TYPES[0];
  return <span className={`nt-type-badge ntb-${t.id}`}><i className={`fa-solid ${t.icon}`} /> {t.label}</span>;
}

const DeliveredBadge = () => (
  <span className="nt-delivered"><i className="fa-solid fa-circle-check" /> Delivered</span>
);

/* ═══════════════════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════════════════ */
export default function Notifications({ toast = () => {} }) {
  const [tab, setTab] = useState('new');
  const [sent, setSent] = useState(INITIAL_SENT);

  /* composer */
  const [audience, setAudience] = useState('staff');
  const [subAud, setSubAud] = useState('all-staff');
  const [cls, setCls] = useState('');
  const [section, setSection] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState('general');

  /* modals */
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editNotif, setEditNotif] = useState(null);

  /* tutorial */
  const [tutorialOpen, setTutorialOpen] = useState(false);

  /* sent-list filters */
  const [search, setSearch] = useState('');
  const [filterAud, setFilterAud] = useState('');
  const [filterType, setFilterType] = useState('');

  const stats = useMemo(() => ({
    total:    sent.length,
    staff:    sent.filter(n => n.audienceType === 'staff').length,
    parents:  sent.filter(n => n.audienceType === 'parents').length,
    emergency: sent.filter(n => n.type === 'emergency').length,
  }), [sent]);

  const showClass = subAud === 'class-wise' || subAud === 'class-section';
  const showSection = subAud === 'class-section';
  const recipientEstimate = RECIPIENT_COUNTS[subAud] || 20;

  const buildAudienceLabel = () => {
    let lbl = `${audience === 'staff' ? 'Staff' : 'Parents'} — ${SUB_LABELS[subAud] || subAud}`;
    if (showClass && cls) {
      lbl += ` · ${cls}`;
      if (showSection && section) lbl += ` ${section}`;
    }
    return lbl;
  };

  const selectAudience = (aud) => {
    setAudience(aud);
    setSubAud(aud === 'staff' ? 'all-staff' : 'all-parents');
    setCls('');
    setSection('');
  };

  const selectSub = (id) => {
    setSubAud(id);
    if (id !== 'class-wise' && id !== 'class-section') { setCls(''); setSection(''); }
    if (id !== 'class-section') setSection('');
  };

  const openConfirm = () => {
    if (!title.trim()) { toast('Please enter a notification title.', 'warning'); return; }
    if (!body.trim())  { toast('Please enter the notification message.', 'warning'); return; }
    if (showClass && !cls) { toast('Please select a class.', 'warning'); return; }
    setConfirmOpen(true);
  };

  const doSend = () => {
    const now = new Date();
    const dateStr = `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
    const h = now.getHours(), m = now.getMinutes();
    const timeStr = `${h % 12 || 12}:${m < 10 ? '0' : ''}${m} ${h >= 12 ? 'pm' : 'am'}`;
    setSent(prev => [{
      id: Date.now(), title: title.trim(), body: body.trim(),
      audience: buildAudienceLabel(), audienceType: audience, subAud,
      cls: showClass ? cls : '', section: showSection ? section : '', type,
      date: dateStr, time: timeStr, recipients: recipientEstimate, sentBy: 'Admin',
    }, ...prev]);
    setConfirmOpen(false);
    setTitle(''); setBody('');
    toast('Notification sent successfully to mobile app users.', 'success');
  };

  const doDelete = () => {
    setSent(prev => prev.filter(n => n.id !== deleteId));
    setDeleteId(null);
    toast('Notification record deleted.', 'info');
  };

  const saveEdit = (patch) => {
    setSent(prev => prev.map(n => n.id === editNotif.id ? { ...n, ...patch } : n));
    setEditNotif(null);
    toast('Notification record updated successfully.', 'success');
  };

  const filteredSent = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sent.filter(n => {
      const matchQ = !q || n.title.toLowerCase().includes(q) || n.audience.toLowerCase().includes(q) || n.type.includes(q) || (n.cls || '').toLowerCase().includes(q);
      const matchA = !filterAud || n.audienceType === filterAud;
      const matchT = !filterType || n.type === filterType;
      return matchQ && matchA && matchT;
    });
  }, [sent, search, filterAud, filterType]);

  const subs = audience === 'staff' ? STAFF_SUBS : PARENT_SUBS;

  return (
    <>
      <style>{NOTIF_CSS}</style>

      {/* ── Page header ── */}
      <div className="nt-page-header">
        <div className="nt-ph-icon">
          <i className="fa-solid fa-bell" style={{ color: '#fff', fontSize: 20 }} />
        </div>
        <div className="nt-ph-text">
          <div className="page-title nt-ph-title">Notifications</div>
          <div className="nt-ph-kicker">Mobile App Push Notifications</div>
          <div className="page-sub" style={{ marginTop: 4 }}>Send targeted push notifications to staff and parents on the School Mentor mobile app.</div>
        </div>
        <Tooltip text="Play a short tutorial for the Notifications module">
          <button className="tutorial-btn page-tutorial-btn" onClick={() => setTutorialOpen(true)} aria-label="Open Notifications tutorials">
            <div className="play-dot"><i className="fa-solid fa-play" style={{ fontSize: 8 }} /></div>
            <span className="tutorial-label">Tutorial</span>
          </button>
        </Tooltip>
      </div>

      {/* ── Stats strip ── */}
      <div className="nt-stats">
        <NtStat icon="fa-paper-plane"         ibg="var(--brand-light)"    ic="var(--brand-primary)" val={stats.total}     label="Sent Notifications" />
        <NtStat icon="fa-chalkboard-user"     ibg="rgba(124,58,237,.1)"   ic="#7C3AED"               val={stats.staff}     label="Staff Notifications" />
        <NtStat icon="fa-users"               ibg="rgba(2,132,199,.1)"    ic="#0284C7"               val={stats.parents}   label="Parent Notifications" />
        <NtStat icon="fa-triangle-exclamation" ibg="rgba(220,38,38,.08)"  ic="#DC2626"               val={stats.emergency} label="Emergency Alerts" />
      </div>

      {/* ── Tabs ── */}
      <div className="nt-tabs">
        <button className={`nt-tab${tab === 'new' ? ' active' : ''}`} onClick={() => setTab('new')}>
          <i className="fa-solid fa-pen-to-square" /> New Notification
        </button>
        <button className={`nt-tab${tab === 'sent' ? ' active' : ''}`} onClick={() => setTab('sent')}>
          <i className="fa-solid fa-list-check" /> Sent Notifications
          <span className="nt-tab-count">{stats.total}</span>
        </button>
      </div>

      {/* ════ NEW NOTIFICATION ════ */}
      {tab === 'new' && (
        <div className="nt-layout">
          {/* Composer */}
          <div className="nt-card">
            <div className="nt-card-header">
              <div className="nt-card-icon" style={{ background: 'var(--brand-light)', color: 'var(--brand-primary)' }}><i className="fa-solid fa-pen-to-square" /></div>
              <div><div className="nt-card-title">Compose Notification</div><div className="nt-card-sub">Fill in the details and send to the mobile app</div></div>
            </div>
            <div className="nt-card-body">
              {/* Audience */}
              <div>
                <label className="form-label">Audience Type <span className="req-star">*</span></label>
                <div className="nt-aud-pills" style={{ marginTop: 8 }}>
                  <button className={`nt-aud-pill${audience === 'staff' ? ' active' : ''}`} onClick={() => selectAudience('staff')}><i className="fa-solid fa-chalkboard-user" /> Staff</button>
                  <button className={`nt-aud-pill${audience === 'parents' ? ' active' : ''}`} onClick={() => selectAudience('parents')}><i className="fa-solid fa-users" /> Parents</button>
                </div>
              </div>

              {/* Sub-audience */}
              <div>
                <label className="form-label">Select {audience === 'staff' ? 'Staff' : 'Parent'} Group <span className="req-star">*</span></label>
                <div className="nt-sub-grid" style={{ marginTop: 8 }}>
                  {subs.map(s => (
                    <div key={s.id} className={`nt-sub-card${subAud === s.id ? ' active' : ''}`} onClick={() => selectSub(s.id)}>
                      <div className="nt-sub-radio" /> {s.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Class / Section */}
              {showClass && (
                <div className="nt-class-row">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Class <span className="req-star">*</span></label>
                    <select className="form-input" value={cls} onChange={e => setCls(e.target.value)} style={{ marginTop: 6 }}>
                      <option value="">Select Class</option>
                      {CLASSES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  {showSection && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Section <span className="req-star">*</span></label>
                      <select className="form-input" value={section} onChange={e => setSection(e.target.value)} style={{ marginTop: 6 }}>
                        <option value="">Select Section</option>
                        {SECTIONS.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="form-label">Notification Title <span className="req-star">*</span></label>
                <input className="form-input" maxLength={80} placeholder="Enter a clear, short title..." value={title} onChange={e => setTitle(e.target.value)} style={{ marginTop: 6 }} />
                <div className={counterClass(title.length, 80)}>{title.length} / 80</div>
              </div>

              {/* Body */}
              <div>
                <label className="form-label">Notification Message <span className="req-star">*</span></label>
                <textarea className="nt-textarea" maxLength={300} rows={4} placeholder="Write the notification message that users will see on their mobile app..." value={body} onChange={e => setBody(e.target.value)} style={{ marginTop: 6 }} />
                <div className={counterClass(body.length, 300)}>{body.length} / 300</div>
              </div>

              {/* Type */}
              <div>
                <label className="form-label">Notification Type <span className="req-star">*</span></label>
                <div className="nt-type-grid" style={{ marginTop: 8 }}>
                  {TYPES.map(t => (
                    <button key={t.id} className={`nt-type-pill${type === t.id ? ' active' : ''}`} data-type={t.id} onClick={() => setType(t.id)}>
                      <i className={`fa-solid ${t.icon}`} /> {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <button className="nt-send-btn" onClick={openConfirm}>
                <i className="fa-solid fa-paper-plane" /> Send Notification
              </button>
            </div>
          </div>

          {/* Guidelines */}
          <div className="nt-card">
            <div className="nt-card-header">
              <div className="nt-card-icon" style={{ background: 'rgba(2,132,199,.1)', color: '#0284C7' }}><i className="fa-solid fa-circle-info" /></div>
              <div><div className="nt-card-title">Sending Guidelines</div><div className="nt-card-sub">Best practices for push notifications</div></div>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 11 }}>
              <Guideline icon="fa-mobile-screen" ic="var(--brand-primary)" bg="var(--bg-muted)" border="var(--border-light)">Notifications are delivered instantly to all active School Mentor app users in the selected audience.</Guideline>
              <Guideline icon="fa-triangle-exclamation" ic="#D97706" bg="rgba(217,119,6,.05)" border="rgba(217,119,6,.18)">Use <strong>Emergency</strong> only for critical situations. Overuse may cause users to ignore alerts.</Guideline>
              <Guideline icon="fa-pen" ic="#0284C7" bg="var(--bg-muted)" border="var(--border-light)">Keep title under 60 chars and body under 200 chars for best display on all devices.</Guideline>
              <Guideline icon="fa-shield-halved" ic="#16A34A" bg="var(--bg-muted)" border="var(--border-light)">Notifications cannot be recalled after sending. Review carefully before clicking <strong>Send Now</strong>.</Guideline>
              <div style={{ background: 'var(--brand-light)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '13px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}><i className="fa-solid fa-users" style={{ marginRight: 5 }} />Estimated Recipients</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand-primary)' }}>~{recipientEstimate}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Based on current audience selection</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ SENT NOTIFICATIONS ════ */}
      {tab === 'sent' && (
        <div className="nt-table-wrap">
          <div className="nt-filter-bar">
            <div className="nt-filter-search">
              <i className="fa-solid fa-magnifying-glass" />
              <input placeholder="Search by title, audience, class, type..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="nt-filter-sel" value={filterAud} onChange={e => setFilterAud(e.target.value)}>
              <option value="">All Audiences</option>
              <option value="staff">Staff</option>
              <option value="parents">Parents</option>
            </select>
            <select className="nt-filter-sel" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">All Types</option>
              {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>

          <div className="nt-table-head">
            <div className="nt-th">Title &amp; Message</div>
            <div className="nt-th">Audience &amp; Class</div>
            <div className="nt-th">Type</div>
            <div className="nt-th">Sent At</div>
            <div className="nt-th">Recipients</div>
            <div className="nt-th">Actions</div>
          </div>

          {filteredSent.length === 0 ? (
            <div className="nt-empty">
              <div className="nt-empty-icon"><i className="fa-solid fa-magnifying-glass" /></div>
              <div className="nt-empty-title">{sent.length ? 'No results found' : 'No notifications sent yet'}</div>
              <div className="nt-empty-sub">{sent.length ? 'Try a different search term or filter.' : 'Compose your first notification and send it to staff or parents.'}</div>
            </div>
          ) : filteredSent.map(n => (
            <div className="nt-row" key={n.id}>
              <div className="nt-td">
                <div className="nt-title-txt">{n.title}</div>
                <div className="nt-body-txt">{n.body}</div>
                <div style={{ marginTop: 4 }}><DeliveredBadge /></div>
              </div>
              <div className="nt-td">
                <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{n.audience}</div>
                {n.cls && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}><i className="fa-solid fa-chalkboard" style={{ fontSize: 9, marginRight: 3 }} />{n.cls}{n.section ? ` · Sec ${n.section}` : ''}</div>}
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}><i className="fa-solid fa-user-tie" style={{ fontSize: 9, marginRight: 3 }} />{n.sentBy}</div>
              </div>
              <div className="nt-td"><TypeBadge type={n.type} /></div>
              <div className="nt-td">
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{n.date}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{n.time}</div>
              </div>
              <div className="nt-td">
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>~{n.recipients}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>recipients</div>
              </div>
              <div className="nt-td">
                <div className="nt-act-btns">
                  <Tooltip text="Edit notification record"><button className="nt-edit-btn" onClick={() => setEditNotif(n)}><i className="fa-solid fa-pen" /></button></Tooltip>
                  <Tooltip text="Delete notification record"><button className="nt-del-btn" onClick={() => setDeleteId(n.id)}><i className="fa-solid fa-trash-can" /></button></Tooltip>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ════ MODALS ════ */}
      {confirmOpen && (
        <ConfirmModal
          audienceLabel={buildAudienceLabel()}
          typeLabel={(TYPES.find(t => t.id === type) || TYPES[0]).label}
          recipients={recipientEstimate}
          title={title.trim()}
          onClose={() => setConfirmOpen(false)}
          onSend={doSend}
        />
      )}

      {deleteId != null && (
        <DeleteModal onClose={() => setDeleteId(null)} onConfirm={doDelete} />
      )}

      {editNotif && (
        <EditModal notif={editNotif} onClose={() => setEditNotif(null)} onSave={saveEdit} toast={toast} />
      )}

      <TutorialModal open={tutorialOpen} moduleKey="notifications" onClose={() => setTutorialOpen(false)} toast={toast} />
    </>
  );
}

/* ── Stat card ── */
function NtStat({ icon, ibg, ic, val, label }) {
  return (
    <div className="nt-stat">
      <div className="nt-stat-icon" style={{ background: ibg, color: ic }}><i className={`fa-solid ${icon}`} /></div>
      <div><div className="nt-stat-val">{val}</div><div className="nt-stat-lbl">{label}</div></div>
    </div>
  );
}

/* ── Guideline row ── */
function Guideline({ icon, ic, bg, border, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 13px', background: bg, borderRadius: 'var(--radius-md)', border: `1px solid ${border}` }}>
      <i className={`fa-solid ${icon}`} style={{ color: ic, marginTop: 1, flexShrink: 0 }} />
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

/* ── Modal shell (reuses global .modal-overlay/.modal styling) ── */
function ModalShell({ size = 'modal-sm', maxWidth, children, onClose }) {
  return createPortal(
    <div className="modal-overlay open" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${size}`} style={maxWidth ? { maxWidth } : undefined}>{children}</div>
    </div>,
    document.body,
  );
}

/* ── Confirm send ── */
function ConfirmModal({ audienceLabel, typeLabel, recipients, title, onClose, onSend }) {
  return (
    <ModalShell size="modal-sm" maxWidth={480} onClose={onClose}>
      <div className="modal-header">
        <div><div className="modal-title"><i className="fa-solid fa-paper-plane" style={{ marginRight: 6 }} />Confirm Notification</div></div>
        <Tooltip text="Close"><button className="modal-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button></Tooltip>
      </div>
      <div className="modal-body">
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>This notification will be sent to the selected users on their <strong>mobile applications</strong>. Please review the details below before confirming.</div>
        <div className="nt-confirm-summary">
          <div className="ncs-row"><span className="ncs-label">Audience</span><span className="ncs-val">{audienceLabel}</span></div>
          <div className="ncs-row"><span className="ncs-label">Type</span><span className="ncs-val">{typeLabel}</span></div>
          <div className="ncs-row"><span className="ncs-label">Recipients</span><span className="ncs-val">~{recipients} users</span></div>
          <div className="ncs-row"><span className="ncs-label">Title</span><span className="ncs-val">{title}</span></div>
        </div>
        <div className="nt-helper warn"><i className="fa-solid fa-circle-info" /> Notifications cannot be recalled after sending.</div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={onSend}><i className="fa-solid fa-paper-plane" /> Send Now</button>
      </div>
    </ModalShell>
  );
}

/* ── Delete record ── */
function DeleteModal({ onClose, onConfirm }) {
  return (
    <ModalShell size="modal-sm" onClose={onClose}>
      <div className="modal-header"><div><div className="modal-title">Delete Notification Record</div></div><Tooltip text="Close"><button className="modal-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button></Tooltip></div>
      <div className="modal-body">
        <div className="nt-confirm-icon danger"><i className="fa-solid fa-trash-can" /></div>
        <div className="nt-confirm-title">Delete this record?</div>
        <div className="nt-confirm-sub">This will remove the notification from the ERP sent list only. The notification has already been delivered to mobile app users and cannot be recalled.</div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-danger" onClick={onConfirm}><i className="fa-solid fa-trash-can" /> Delete Record</button>
      </div>
    </ModalShell>
  );
}

/* ── Edit record ── */
function EditModal({ notif, onClose, onSave, toast }) {
  const [title, setTitle] = useState(notif.title);
  const [body, setBody] = useState(notif.body);
  const [type, setType] = useState(notif.type);
  const [sentBy, setSentBy] = useState(notif.sentBy || '');

  const save = () => {
    if (!title.trim()) { toast('Please enter a notification title.', 'warning'); return; }
    if (!body.trim())  { toast('Please enter the notification message.', 'warning'); return; }
    onSave({ title: title.trim(), body: body.trim(), type, ...(sentBy.trim() ? { sentBy: sentBy.trim() } : {}) });
  };

  return (
    <ModalShell size="modal-md" maxWidth={640} onClose={onClose}>
      <div className="modal-header">
        <div>
          <div className="modal-title"><i className="fa-solid fa-pen" style={{ marginRight: 6 }} />Edit Notification</div>
          <div className="modal-sub">Update the notification record. This does not re-send to mobile users.</div>
        </div>
        <Tooltip text="Close"><button className="modal-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button></Tooltip>
      </div>
      <div className="modal-body">
        <div className="nt-helper warn" style={{ marginBottom: 16 }}><i className="fa-solid fa-circle-info" /> Editing this record updates the ERP log only. The original notification has already been delivered to mobile app users.</div>

        <div className="form-group">
          <label className="form-label">Notification Title <span className="req-star">*</span></label>
          <input className="form-input" maxLength={80} placeholder="Notification title..." value={title} onChange={e => setTitle(e.target.value)} style={{ marginTop: 6 }} />
          <div className={counterClass(title.length, 80)}>{title.length} / 80</div>
        </div>

        <div className="form-group">
          <label className="form-label">Notification Message <span className="req-star">*</span></label>
          <textarea className="nt-textarea" maxLength={300} rows={4} placeholder="Notification message..." value={body} onChange={e => setBody(e.target.value)} style={{ marginTop: 6 }} />
          <div className={counterClass(body.length, 300)}>{body.length} / 300</div>
        </div>

        <div className="form-group">
          <label className="form-label">Notification Type</label>
          <div className="nt-type-grid" style={{ marginTop: 8 }}>
            {TYPES.map(t => (
              <button key={t.id} className={`nt-type-pill${type === t.id ? ' active' : ''}`} data-type={t.id} onClick={() => setType(t.id)}>
                <i className={`fa-solid ${t.icon}`} /> {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Sent By</label>
          <input className="form-input" placeholder="e.g. Principal, Admin..." value={sentBy} onChange={e => setSentBy(e.target.value)} style={{ marginTop: 6 }} />
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save Changes</button>
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CSS — namespaced under .nt-* (modals/buttons/forms reuse the global
   ERP shell classes, so nothing here collides with other modules).
   ═══════════════════════════════════════════════════════════════════ */
const NOTIF_CSS = `
@keyframes ntFadeSlide { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }

/* page header (class-based so it can flex/shrink on small screens) */
.nt-page-header { display:flex; align-items:flex-start; gap:16px; margin-bottom:22px; }
.nt-ph-icon { width:52px; height:52px; border-radius:14px; background:linear-gradient(135deg,#1E3A8A,#2563EB); display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 4px 14px rgba(30,58,138,.3); }
.nt-ph-text { flex:1; min-width:0; }
.nt-ph-title { font-size:27px; font-weight:800; line-height:1.15; letter-spacing:-.03em; }
.nt-ph-kicker { font-size:12px; font-weight:700; color:var(--brand-primary); letter-spacing:.04em; text-transform:uppercase; margin-top:3px; opacity:.8; }

/* stats */
.nt-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:22px; }
.nt-stat { background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-lg); padding:16px 18px; display:flex; align-items:center; gap:14px; box-shadow:var(--shadow-xs); transition:var(--tr); }
.nt-stat:hover { box-shadow:var(--shadow-sm); transform:translateY(-1px); }
.nt-stat-icon { width:42px; height:42px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; }
.nt-stat-val { font-size:22px; font-weight:800; color:var(--text-primary); line-height:1; }
.nt-stat-lbl { font-size:11.5px; color:var(--text-muted); margin-top:3px; font-weight:600; }

/* tabs */
.nt-tabs { display:flex; gap:4px; background:var(--bg-card); border:1.5px solid var(--border-light); border-radius:var(--radius-lg); padding:5px; margin-bottom:20px; box-shadow:var(--shadow-sm); overflow-x:auto; }
.nt-tab { flex:1; display:flex; align-items:center; justify-content:center; gap:7px; padding:11px 18px; border-radius:var(--radius-md); border:none; background:transparent; font-family:var(--font-body); font-size:13px; font-weight:600; color:var(--text-muted); cursor:pointer; transition:var(--tr); white-space:nowrap; }
.nt-tab:hover:not(.active) { background:var(--bg-muted); color:var(--text-primary); }
.nt-tab.active { background:linear-gradient(135deg,#1E3A8A 0%,#1E40AF 60%,#2563EB 100%); color:#fff; box-shadow:0 6px 20px rgba(30,58,138,.4), inset 0 1px 0 rgba(255,255,255,.2); }
.nt-tab-count { background:rgba(255,255,255,.25); border-radius:var(--radius-full); padding:1px 8px; font-size:11px; font-weight:800; }
.nt-tab:not(.active) .nt-tab-count { background:var(--bg-muted); color:var(--text-muted); }
[data-theme="dark"] .nt-tabs { background:var(--bg-muted); }
[data-theme="dark"] .nt-tab:hover:not(.active) { background:var(--bg-card); color:#93C5FD; }

/* layout */
.nt-layout { display:grid; grid-template-columns:1.6fr 1fr; gap:20px; align-items:start; }

/* card */
.nt-card { background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); overflow:visible; animation:ntFadeSlide .25s ease both; }
.nt-card-header { padding:14px 20px; border-bottom:1px solid var(--border-light); display:flex; align-items:center; gap:10px; background:linear-gradient(135deg,rgba(30,58,138,.03),transparent); }
.nt-card-icon { width:34px; height:34px; border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; }
.nt-card-title { font-size:14px; font-weight:800; color:var(--text-primary); }
.nt-card-sub { font-size:11px; color:var(--text-muted); margin-top:1px; }
.nt-card-body { padding:18px 20px; display:flex; flex-direction:column; gap:14px; }

/* audience pills */
.nt-aud-pills { display:flex; gap:8px; }
.nt-aud-pill { flex:1; padding:10px 14px; border-radius:var(--radius-md); border:1.5px solid var(--border-light); background:var(--bg-muted); font-family:var(--font-body); font-size:13px; font-weight:600; color:var(--text-muted); cursor:pointer; transition:var(--tr); display:flex; align-items:center; justify-content:center; gap:7px; }
.nt-aud-pill:hover { border-color:var(--brand-primary); color:var(--brand-primary); background:var(--brand-light); }
.nt-aud-pill.active { background:linear-gradient(135deg,var(--brand-primary),var(--brand-deeper,#1D4ED8)); color:#fff; border-color:transparent; box-shadow:0 3px 10px rgba(30,58,138,.25); }

/* sub-audience radio cards */
.nt-sub-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.nt-sub-card { padding:9px 12px; border-radius:var(--radius-md); border:1.5px solid var(--border-light); background:var(--bg-muted); font-family:var(--font-body); font-size:12px; font-weight:600; color:var(--text-secondary); cursor:pointer; transition:var(--tr); display:flex; align-items:center; gap:7px; }
.nt-sub-card:hover { border-color:var(--brand-primary); background:var(--brand-light); color:var(--brand-primary); }
.nt-sub-card.active { border-color:var(--brand-primary); background:var(--brand-light); color:var(--brand-primary); }
.nt-sub-radio { width:14px; height:14px; border-radius:50%; border:2px solid currentColor; display:flex; align-items:center; justify-content:center; flex-shrink:0; position:relative; }
.nt-sub-card.active .nt-sub-radio::after { content:''; width:6px; height:6px; border-radius:50%; background:currentColor; }

/* class+section */
.nt-class-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; }

/* type pills */
.nt-type-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:7px; }
.nt-type-pill { padding:8px 10px; border-radius:var(--radius-md); border:1.5px solid var(--border-light); background:var(--bg-muted); font-family:var(--font-body); font-size:11.5px; font-weight:700; color:var(--text-muted); cursor:pointer; transition:var(--tr); display:flex; align-items:center; gap:6px; justify-content:center; }
.nt-type-pill:hover { transform:translateY(-1px); }
.nt-type-pill.active { color:#fff; border-color:transparent; }
.nt-type-pill[data-type="general"].active   { background:linear-gradient(135deg,var(--brand-primary),var(--brand-deeper,#1D4ED8)); box-shadow:0 3px 8px rgba(30,58,138,.3); }
.nt-type-pill[data-type="important"].active  { background:linear-gradient(135deg,#D97706,#B45309); box-shadow:0 3px 8px rgba(217,119,6,.3); }
.nt-type-pill[data-type="reminder"].active   { background:linear-gradient(135deg,#0284C7,#0369A1); box-shadow:0 3px 8px rgba(2,132,199,.3); }
.nt-type-pill[data-type="emergency"].active  { background:linear-gradient(135deg,#DC2626,#B91C1C); box-shadow:0 3px 8px rgba(220,38,38,.3); }
.nt-type-pill[data-type="general"]:not(.active):hover   { border-color:var(--brand-primary); color:var(--brand-primary); background:var(--brand-light); }
.nt-type-pill[data-type="important"]:not(.active):hover { border-color:#D97706; color:#D97706; background:rgba(217,119,6,.06); }
.nt-type-pill[data-type="reminder"]:not(.active):hover  { border-color:#0284C7; color:#0284C7; background:rgba(2,132,199,.06); }
.nt-type-pill[data-type="emergency"]:not(.active):hover { border-color:#DC2626; color:#DC2626; background:rgba(220,38,38,.06); }

/* textarea (global has no .form-textarea) */
.nt-textarea { width:100%; border:1.5px solid var(--border-light); border-radius:var(--radius-md); padding:10px 12px; font-family:var(--font-body); font-size:13px; color:var(--text-primary); background:var(--input-bg); outline:none; transition:var(--tr); resize:vertical; min-height:84px; }
.nt-textarea:focus { border-color:var(--brand-primary); box-shadow:0 0 0 3px rgba(30,58,138,.1); }
.nt-textarea::placeholder { color:var(--text-muted); }

/* char counter */
.nt-counter { font-size:10.5px; color:var(--text-muted); text-align:right; margin-top:3px; font-weight:600; }
.nt-counter.warn { color:#D97706; }
.nt-counter.over { color:#DC2626; }

/* send button */
.nt-send-btn { width:100%; padding:12px; border-radius:var(--radius-md); border:none; background:linear-gradient(135deg,var(--brand-primary),var(--brand-deeper,#1D4ED8)); color:#fff; font-family:var(--font-body); font-size:14px; font-weight:800; cursor:pointer; transition:var(--tr); display:flex; align-items:center; justify-content:center; gap:9px; box-shadow:0 4px 14px rgba(30,58,138,.3); }
.nt-send-btn:hover { box-shadow:0 6px 20px rgba(30,58,138,.45); transform:translateY(-1px); }
.nt-send-btn:active { transform:translateY(0); }

/* sent table */
.nt-table-wrap { background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); overflow:hidden; animation:ntFadeSlide .25s ease both; }
.nt-table-head { display:grid; grid-template-columns:2fr 1fr 1.2fr 1fr 1fr 110px; background:var(--bg-muted); border-bottom:1px solid var(--border-light); padding:0 16px; }
.nt-th { padding:10px 8px; font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.6px; }
.nt-row { display:grid; grid-template-columns:2fr 1fr 1.2fr 1fr 1fr 110px; padding:12px 16px; align-items:center; border-bottom:1px solid var(--border-light); transition:var(--tr); animation:ntFadeSlide .2s ease both; }
.nt-row:last-child { border-bottom:none; }
.nt-row:hover { background:var(--bg-muted); }
.nt-td { padding:0 8px; font-size:12.5px; color:var(--text-secondary); min-width:0; }
.nt-title-txt { font-size:13px; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; }
.nt-body-txt { font-size:11px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; margin-top:2px; }
.nt-type-badge { display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border-radius:var(--radius-full); font-size:10.5px; font-weight:700; white-space:nowrap; }
.ntb-general { background:var(--brand-light); color:var(--brand-primary); }
.ntb-important { background:rgba(217,119,6,.1); color:#D97706; }
.ntb-reminder { background:rgba(2,132,199,.1); color:#0284C7; }
.ntb-emergency { background:rgba(220,38,38,.1); color:#DC2626; }
.nt-delivered { display:inline-flex; align-items:center; gap:4px; background:rgba(22,163,74,.08); color:#16A34A; border:1px solid rgba(22,163,74,.2); border-radius:var(--radius-full); padding:2px 8px; font-size:10px; font-weight:700; }
.nt-act-btns { display:flex; gap:5px; }
.nt-edit-btn, .nt-del-btn { width:30px; height:30px; border-radius:8px; border:1.5px solid var(--border-light); background:var(--bg-card); color:var(--text-muted); display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:12px; transition:var(--tr); }
.nt-edit-btn:hover { border-color:var(--brand-primary); color:var(--brand-primary); background:var(--brand-light); }
.nt-del-btn:hover { border-color:var(--error,#DC2626); color:var(--error,#DC2626); background:rgba(220,38,38,.06); }
[data-theme="dark"] .nt-edit-btn, [data-theme="dark"] .nt-del-btn { background:var(--bg-muted); }

/* filter bar */
.nt-filter-bar { display:flex; gap:10px; flex-wrap:wrap; align-items:center; padding:14px 20px; border-bottom:1px solid var(--border-light); }
.nt-filter-search { display:flex; align-items:center; gap:7px; flex:1; min-width:200px; background:var(--bg-muted); border:1.5px solid var(--border-light); border-radius:var(--radius-full); padding:7px 13px; transition:var(--tr); }
.nt-filter-search:focus-within { border-color:var(--brand-primary); }
.nt-filter-search i { color:var(--text-muted); font-size:12px; }
.nt-filter-search input { border:none; background:transparent; font-family:var(--font-body); font-size:12.5px; color:var(--text-primary); outline:none; flex:1; min-width:0; }
.nt-filter-search input::placeholder { color:var(--text-muted); }
.nt-filter-sel { border:1.5px solid var(--border-light); border-radius:var(--radius-full); background:var(--bg-muted); font-family:var(--font-body); font-size:12px; font-weight:600; color:var(--text-secondary); padding:7px 13px; outline:none; cursor:pointer; transition:var(--tr); }
.nt-filter-sel:focus { border-color:var(--brand-primary); }

/* empty */
.nt-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:48px 20px; text-align:center; }
.nt-empty-icon { width:60px; height:60px; border-radius:16px; background:var(--brand-light); color:var(--brand-primary); display:flex; align-items:center; justify-content:center; font-size:26px; margin:0 auto 14px; }
.nt-empty-title { font-size:15px; font-weight:800; color:var(--text-primary); margin-bottom:5px; }
.nt-empty-sub { font-size:12.5px; color:var(--text-muted); line-height:1.6; }

/* confirm summary + helper + confirm icon (modal pieces) */
.nt-confirm-summary { background:var(--bg-muted); border:1px solid var(--border-light); border-radius:var(--radius-md); padding:14px 16px; margin:12px 0; display:flex; flex-direction:column; gap:8px; }
.ncs-row { display:flex; align-items:baseline; gap:8px; }
.ncs-label { font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:.4px; width:110px; flex-shrink:0; }
.ncs-val { font-size:13px; font-weight:700; color:var(--text-primary); }
.nt-helper { display:flex; align-items:flex-start; gap:6px; padding:10px 12px; background:rgba(30,58,138,.05); border:1px solid rgba(30,58,138,.12); border-radius:var(--radius-md); font-size:11.5px; color:#1E40AF; line-height:1.5; }
.nt-helper i { font-size:11px; margin-top:1px; flex-shrink:0; }
.nt-helper.warn { background:rgba(217,119,6,.06); border-color:rgba(217,119,6,.2); color:#B45309; }
[data-theme="dark"] .nt-helper { color:#93C5FD; }
.nt-confirm-icon { width:56px; height:56px; border-radius:16px; display:flex; align-items:center; justify-content:center; font-size:22px; margin:0 auto 16px; }
.nt-confirm-icon.danger { background:rgba(220,38,38,.1); color:#DC2626; }
.nt-confirm-title { font-size:18px; font-weight:800; color:var(--text-primary); text-align:center; }
.nt-confirm-sub { font-size:13px; color:var(--text-muted); text-align:center; margin-top:6px; line-height:1.6; }

@media(max-width:1100px){ .nt-layout { grid-template-columns:1fr; } }
@media(max-width:900px){ .nt-stats { grid-template-columns:repeat(2,1fr); } }
@media(max-width:760px){
  /* Page header: shrink title, drop Tutorial to its own full-width row */
  .nt-page-header { flex-wrap:wrap; gap:12px; }
  .nt-ph-icon { width:46px; height:46px; }
  .nt-ph-title { font-size:21px; }
  .nt-page-header .page-tutorial-btn { order:3; width:100%; justify-content:center; }

  .nt-type-grid { grid-template-columns:repeat(2,1fr); }

  /* Filter bar → search full width, the two selects share a row */
  .nt-filter-bar { padding:12px 16px; gap:8px; }
  .nt-filter-search { min-width:0; flex-basis:100%; }
  .nt-filter-sel { flex:1; }

  /* Sent rows → stacked card: Title + Audience full width, then
     Type/Sent and Recipients/Actions in two columns. Long text wraps
     so nothing is truncated or hidden. */
  .nt-table-head { display:none; }
  .nt-row { grid-template-columns:1fr 1fr; gap:8px 12px; padding:14px 16px; align-items:start; }
  .nt-td:nth-child(1), .nt-td:nth-child(2) { grid-column:1 / -1; }
  .nt-td:nth-child(6) { justify-self:end; }
  .nt-act-btns { justify-content:flex-end; }
  .nt-title-txt, .nt-body-txt { white-space:normal; }
}
@media(max-width:480px){
  .nt-class-row { grid-template-columns:1fr; }
  .nt-tab i { display:none; }
  .nt-stats { gap:8px; }
  .nt-card-body { padding:16px 14px; }
}
`;
