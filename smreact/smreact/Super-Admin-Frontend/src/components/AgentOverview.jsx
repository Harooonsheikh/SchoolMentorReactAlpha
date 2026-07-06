import React, { useMemo, useState } from 'react';

/* ═══════════════════════════════════════════════════════════════════
   CUSTOMER SUPPORT — OVERVIEW (frontend only)
   A read-only dashboard rendered as the "Overview" tab of the Customer
   Support module. 100% static/demo data — no APIs, no backend, no DB.
   Reuses the support module's design system (colours, typography, cards,
   buttons, modals). Professional icons only (no emoji).
   ═══════════════════════════════════════════════════════════════════ */

const SUMMARY = [
  { key: 'schools',  label: 'Total Schools',          value: 48,  icon: 'fa-school',             c1: '#1E3A8A', c2: '#2563EB' },
  { key: 'active',   label: 'Active Conversations',   value: 12,  icon: 'fa-comments',           c1: '#0F766E', c2: '#14B8A6' },
  { key: 'inactive', label: 'Inactive Conversations', value: 36,  icon: 'fa-comment-slash',      c1: 'var(--ag-t3)', c2: 'var(--ag-tm)' },
  { key: 'agents',   label: 'Total Agents',           value: 6,   icon: 'fa-headset',            c1: '#6D28D9', c2: '#7C3AED' },
  { key: 'pending',  label: 'Pending Replies',        value: 4,   icon: 'fa-reply-all',          c1: '#B45309', c2: '#D97706' },
  { key: 'today',    label: "Today's Messages",       value: 318, icon: 'fa-envelope-open-text', c1: '#0369A1', c2: '#0EA5E9' },
];

const ACTIVE = [
  { school: 'Daffodil Schools',    campus: 'Tarnol Campus',   principal: 'Dr. Asif Khan',     agent: 'Tariq Ahmed', last: 'We have another query today.',        activity: '2 min ago',  status: 'Active' },
  { school: 'City Grammar School', campus: 'North Campus',    principal: 'Mr. Imran Yousaf',  agent: 'Sara Ali',    last: 'OTP is not arriving for parents.',     activity: '8 min ago',  status: 'Pending' },
  { school: 'Beacon House',        campus: 'Gulberg Campus',  principal: 'Ms. Ayesha Raza',   agent: 'Tariq Ahmed', last: 'Result cards margin is cut off.',       activity: '21 min ago', status: 'Active' },
  { school: 'MPS School System',   campus: 'Main Branch',     principal: 'Mr. Bilal Ahmed',   agent: 'Usman Tariq', last: 'Biometric sync stopped working.',      activity: '34 min ago', status: 'Active' },
  { school: 'The Spirit School',   campus: 'Main Campus',     principal: 'Mrs. Hina Pervaiz',  agent: 'Sara Ali',    last: 'Fee challan not generating for Class 5.', activity: '47 min ago', status: 'Pending' },
  { school: 'Smart School',        campus: 'City Campus',     principal: 'Mr. Kamran Akmal',  agent: 'Ahmed Khan',  last: 'Timetable clashes after update.',       activity: '1 hr ago',   status: 'Active' },
  { school: 'Concept School',      campus: 'North Campus',    principal: 'Ms. Sana Mir',      agent: 'Tariq Ahmed', last: 'Need help adding a new section.',       activity: '2 hr ago',   status: 'Active' },
];

const INACTIVE = [
  { school: 'Faith Montessori',     campus: 'Junior Branch',  principal: 'Mrs. Nadia Khan',    contact: '0301-2345678', agent: 'Sara Ali',    lastSession: '02 Jun 2026', sessions: 7, status: 'Closed' },
  { school: 'Roots School',         campus: 'DHA Campus',     principal: 'Mr. Faisal Iqbal',   contact: '0302-3456789', agent: 'Tariq Ahmed', lastSession: '28 May 2026', sessions: 4, status: 'Closed' },
  { school: 'The Educators',        campus: 'Model Town',     principal: 'Ms. Rabia Anwar',    contact: '0303-4567890', agent: 'Usman Tariq', lastSession: '21 May 2026', sessions: 9, status: 'Closed' },
  { school: 'Allied School',        campus: 'Satellite Town', principal: 'Mr. Tariq Mehmood',  contact: '0304-5678901', agent: 'Ahmed Khan',  lastSession: '14 May 2026', sessions: 3, status: 'Closed' },
  { school: 'Dar-e-Arqam',          campus: 'Township',       principal: 'Mrs. Saima Akhtar',  contact: '0305-6789012', agent: 'Sara Ali',    lastSession: '07 May 2026', sessions: 6, status: 'Closed' },
  { school: 'Lahore Grammar',       campus: 'Johar Town',     principal: 'Mr. Asad Raza',      contact: '0306-7890123', agent: 'Tariq Ahmed', lastSession: '30 Apr 2026', sessions: 5, status: 'Closed' },
  { school: 'Beaconhouse Newlands', campus: 'Phase 1',        principal: 'Ms. Hira Shah',      contact: '0307-8901234', agent: 'Usman Tariq', lastSession: '22 Apr 2026', sessions: 2, status: 'Closed' },
  { school: 'Froebel\'s School',    campus: 'Main Campus',    principal: 'Mr. Junaid Ali',     contact: '0308-9012345', agent: 'Ahmed Khan',  lastSession: '15 Apr 2026', sessions: 8, status: 'Closed' },
];

/* Demo "last 5 sessions" for the View History modal (same for every school). */
const HISTORY_SESSIONS = [
  { number: 5, date: '02 Jun 2026', handledBy: 'Sara Ali',    totalMessages: 14, attachments: 4, closingRemarks: 'Attendance register date filter reset; saving correctly now.' },
  { number: 4, date: '24 May 2026', handledBy: 'Tariq Ahmed', totalMessages: 9,  attachments: 2, closingRemarks: 'Challan generation date conflict corrected from settings.' },
  { number: 3, date: '16 May 2026', handledBy: 'Usman Tariq', totalMessages: 18, attachments: 6, closingRemarks: 'SMS sender ID reconfigured; parent OTP login fixed.' },
  { number: 2, date: '09 May 2026', handledBy: 'Sara Ali',    totalMessages: 11, attachments: 3, closingRemarks: 'Result card A4 margins corrected; export aligned.' },
  { number: 1, date: '30 Apr 2026', handledBy: 'Ahmed Khan',  totalMessages: 7,  attachments: 1, closingRemarks: 'Biometric device time-zone drift fixed; sync restored.' },
];

/* Demo chat transcript (static) used for the session-detail preview. */
const DEMO_TRANSCRIPT = [
  { type: 'day', text: 'Session opened' },
  { type: 'in',  sender: 'Dr. Asif · Principal', time: '9:05 AM', text: 'Assalam o Alaikum. Attendance is not saving for Class 6.' },
  { type: 'out', sender: 'Agent Sara',            time: '9:07 AM', text: 'Walaikum Assalam. Could you share a screenshot of the error?' },
  { type: 'in',  sender: 'Dr. Asif · Principal', time: '9:09 AM', media: 'image' },
  { type: 'in',  sender: 'Dr. Asif · Principal', time: '9:10 AM', media: 'voice' },
  { type: 'out', sender: 'Agent Sara',            time: '9:22 AM', text: 'Thanks — here is a quick reference guide:' },
  { type: 'out', sender: 'Agent Sara',            time: '9:23 AM', media: 'document' },
  { type: 'in',  sender: 'Dr. Asif · Principal', time: '9:30 AM', media: 'video' },
  { type: 'out', sender: 'Agent Sara',            time: '9:33 AM', text: 'The date filter was reset. Please try saving now.' },
  { type: 'in',  sender: 'Dr. Asif · Principal', time: '9:34 AM', text: 'It works now. JazakAllah!' },
];

const statusClass = (s) =>
  s === 'Active' ? 'ov-bdg-green' : s === 'Pending' ? 'ov-bdg-amber' : 'ov-bdg-slate';

export default function AgentOverview() {
  const [search, setSearch] = useState('');
  const [historyFor, setHistoryFor] = useState(null);   // inactive row
  const [openSession, setOpenSession] = useState(null);  // selected history session

  const filteredInactive = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return INACTIVE;
    return INACTIVE.filter(r =>
      [r.school, r.campus, r.principal, r.contact, r.agent].some(v => v.toLowerCase().includes(q)));
  }, [search]);

  return (
    <div className="ov-root">
      <style>{OVERVIEW_CSS}</style>

      <div className="ov-head">
        <div>
          <div className="ov-crumb"><i className="fa-solid fa-headset" aria-hidden="true" /> Customer Support <i className="fa-solid fa-chevron-right ov-crumb-sep" aria-hidden="true" /> Overview</div>
          <h1 className="ov-title">Support Overview</h1>
        </div>
      </div>

      {/* Summary cards */}
      <div className="ov-cards">
        {SUMMARY.map(c => (
          <div className="ov-card" key={c.key}>
            <div className="ov-card-ic" style={{ background: `linear-gradient(135deg,${c.c1},${c.c2})` }}>
              <i className={`fa-solid ${c.icon}`} aria-hidden="true" />
            </div>
            <div className="ov-card-tx">
              <div className="ov-card-val">{c.value.toLocaleString()}</div>
              <div className="ov-card-lbl">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Active conversations */}
      <Section icon="fa-comments" title="Active Conversations" count={ACTIVE.length}>
        <div className="ov-tablewrap" style={{ maxHeight: 320 }}>
          <table className="ov-table">
            <thead>
              <tr>
                <th>School Name</th><th>Campus</th><th>Principal</th><th>Assigned Agent</th>
                <th>Last Message</th><th>Last Activity</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ACTIVE.map((r, i) => (
                <tr key={i}>
                  <td className="ov-strong">{r.school}</td>
                  <td>{r.campus}</td>
                  <td>{r.principal}</td>
                  <td><span className="ov-agent"><i className="fa-solid fa-user-tie" aria-hidden="true" /> {r.agent}</span></td>
                  <td className="ov-muted ov-ellip">{r.last}</td>
                  <td className="ov-muted">{r.activity}</td>
                  <td><span className={`ov-bdg ${statusClass(r.status)}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Inactive conversations */}
      <Section
        icon="fa-comment-slash" title="Inactive Conversations" count={INACTIVE.length}
        action={(
          <div className="ov-search">
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search inactive conversations…" />
            {search && <button className="ov-search-x" onClick={() => setSearch('')} aria-label="Clear"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>}
          </div>
        )}
      >
        <div className="ov-tablewrap" style={{ maxHeight: 340 }}>
          <table className="ov-table">
            <thead>
              <tr>
                <th>School Name</th><th>Campus</th><th>Principal</th><th>Assigned Agent</th>
                <th>Last Session</th><th>Total Sessions</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filteredInactive.map((r, i) => (
                <tr key={i}>
                  <td className="ov-strong">{r.school}</td>
                  <td>{r.campus}</td>
                  <td>{r.principal}</td>
                  <td><span className="ov-agent"><i className="fa-solid fa-user-tie" aria-hidden="true" /> {r.agent}</span></td>
                  <td className="ov-muted">{r.lastSession}</td>
                  <td><span className="ov-pill">{r.sessions}</span></td>
                  <td><span className={`ov-bdg ${statusClass(r.status)}`}>{r.status}</span></td>
                  <td>
                    <button className="ov-btn-ghost" onClick={() => { setHistoryFor(r); setOpenSession(null); }}>
                      <i className="fa-solid fa-clock-rotate-left" aria-hidden="true" /> View History
                    </button>
                  </td>
                </tr>
              ))}
              {filteredInactive.length === 0 && (
                <tr><td colSpan={8} className="ov-empty">No conversations match “{search}”.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* View History modal */}
      {historyFor && !openSession && (
        <Modal
          title={`Previous Sessions · ${historyFor.school}`}
          sub={`${historyFor.campus} · Handled by ${historyFor.agent}`}
          icon="fa-clock-rotate-left"
          onClose={() => setHistoryFor(null)}
        >
          <div className="ov-sess-list">
            {HISTORY_SESSIONS.map(s => (
              <button className="ov-sess" key={s.number} onClick={() => setOpenSession(s)}>
                <div className="ov-sess-no">#{s.number}</div>
                <div className="ov-sess-main">
                  <div className="ov-sess-top">
                    <span className="ov-sess-ttl">Session #{s.number}</span>
                    <span className="ov-bdg ov-bdg-slate">Closed</span>
                  </div>
                  <div className="ov-sess-sub">{s.date} · Handled by {s.handledBy}</div>
                  <div className="ov-sess-meta">
                    <span><i className="fa-regular fa-comment" aria-hidden="true" /> {s.totalMessages} messages</span>
                    <span><i className="fa-solid fa-paperclip" aria-hidden="true" /> {s.attachments} attachments</span>
                  </div>
                  <div className="ov-sess-rmk">{s.closingRemarks}</div>
                </div>
                <i className="fa-solid fa-chevron-right ov-sess-arrow" aria-hidden="true" />
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Session detail (chat-style preview) */}
      {historyFor && openSession && (
        <Modal
          large
          title={`Session #${openSession.number} · ${historyFor.school}`}
          sub={`${openSession.date} · Handled by ${openSession.handledBy}`}
          icon="fa-comments"
          onBack={() => setOpenSession(null)}
          onClose={() => { setHistoryFor(null); setOpenSession(null); }}
        >
          <div className="ov-trans-meta">
            <span><i className="fa-regular fa-comment" aria-hidden="true" /> {openSession.totalMessages} messages</span>
            <span><i className="fa-solid fa-paperclip" aria-hidden="true" /> {openSession.attachments} attachments</span>
            <span className="ov-bdg ov-bdg-slate">Closed</span>
          </div>
          <div className="ov-chat">
            {DEMO_TRANSCRIPT.map((m, i) => <TranscriptRow key={i} m={m} />)}
            <div className="ov-closed">
              <i className="fa-solid fa-circle-check" aria-hidden="true" /> Session closed by {openSession.handledBy} · {openSession.date}
              <div className="ov-closed-rmk">“{openSession.closingRemarks}”</div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── Section wrapper ── */
function Section({ icon, title, count, action, children }) {
  return (
    <div className="ov-section">
      <div className="ov-section-hd">
        <div className="ov-section-ttl"><i className={`fa-solid ${icon}`} aria-hidden="true" /> {title} <span className="ov-count">{count}</span></div>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ── Chat transcript row (static placeholders) ── */
function TranscriptRow({ m }) {
  if (m.type === 'day') return <div className="ov-day"><span>{m.text}</span></div>;
  const out = m.type === 'out';
  return (
    <div className={`ov-row${out ? ' ov-row-out' : ''}`}>
      {!out && <div className="ov-av">{(m.sender || '?').slice(0, 2).toUpperCase()}</div>}
      <div className="ov-bbl-wrap">
        {!out && <div className="ov-sndr">{m.sender}</div>}
        <div className={`ov-bbl ${out ? 'ov-bbl-out' : 'ov-bbl-in'}`}>
          {m.media === 'image' && <MediaPlaceholder icon="fa-image" label="screenshot.png" tone="#0EA5E9" box />}
          {m.media === 'video' && <MediaPlaceholder icon="fa-play" label="recording.mp4" tone="#7C3AED" box />}
          {m.media === 'voice' && (
            <div className="ov-voice">
              <span className="ov-voice-play"><i className="fa-solid fa-play" aria-hidden="true" /></span>
              <div className="ov-voice-bar"><span style={{ width: '40%' }} /></div>
              <span className="ov-voice-dur">0:14</span>
              <i className="fa-solid fa-microphone ov-voice-mic" aria-hidden="true" />
            </div>
          )}
          {m.media === 'document' && <MediaPlaceholder icon="fa-file-pdf" label="guide.pdf" sub="310 KB · PDF" tone="#DC2626" />}
          {m.text && <div className="ov-bbl-txt">{m.text}</div>}
          <div className="ov-bbl-meta">{m.time}{out && <i className="fa-solid fa-check-double ov-ticks" aria-hidden="true" />}</div>
        </div>
      </div>
    </div>
  );
}

function MediaPlaceholder({ icon, label, sub, tone, box }) {
  if (box) {
    return (
      <div className="ov-mbox">
        <div className="ov-mbox-ico" style={{ color: tone }}><i className={`fa-solid ${icon}`} aria-hidden="true" /></div>
        <div className="ov-mbox-lbl">{label}</div>
      </div>
    );
  }
  return (
    <div className="ov-mcard">
      <div className="ov-mcard-ico" style={{ background: tone }}><i className={`fa-solid ${icon}`} aria-hidden="true" /></div>
      <div className="ov-mcard-tx"><div className="ov-mcard-nm">{label}</div><div className="ov-mcard-sz">{sub}</div></div>
      <i className="fa-solid fa-download ov-mcard-dl" aria-hidden="true" />
    </div>
  );
}

/* ── Modal (matches the support module modal look) ── */
function Modal({ title, sub, icon, large, onClose, onBack, children }) {
  return (
    <div className="ov-ov" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`ov-modal${large ? ' ov-modal-lg' : ''}`} role="dialog" aria-modal="true">
        <div className="ov-modal-hd">
          <div className="ov-modal-ttl">
            {onBack && <button className="ov-modal-back" onClick={onBack} aria-label="Back"><i className="fa-solid fa-chevron-left" aria-hidden="true" /></button>}
            <i className={`fa-solid ${icon}`} aria-hidden="true" />
            <div>
              <div className="ov-modal-t">{title}</div>
              {sub && <div className="ov-modal-s">{sub}</div>}
            </div>
          </div>
          <button className="ov-modal-x" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
        </div>
        <div className="ov-modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
const OVERVIEW_CSS = `
.ov-root { flex: 1; min-height: 0; overflow-y: auto; padding: 18px; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: var(--ag-t1); }
.ov-root * { box-sizing: border-box; }

.ov-head { margin-bottom: 16px; }
.ov-crumb { font-size: 11.5px; font-weight: 700; color: var(--ag-tm); display: flex; align-items: center; gap: 7px; }
.ov-crumb i { color: #1E3A8A; }
.ov-crumb-sep { font-size: 9px; color: var(--ag-tm2) !important; }
.ov-title { font-size: 20px; font-weight: 800; margin: 4px 0 0; }

/* Summary cards */
.ov-cards { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 18px; }
.ov-card { background: var(--ag-panel); border: 1px solid var(--ag-bd); border-radius: 16px; padding: 16px; display: flex; align-items: center; gap: 12px; box-shadow: 0 6px 22px rgba(30,58,138,.08); }
.ov-card-ic { width: 44px; height: 44px; border-radius: 12px; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
.ov-card-val { font-size: 22px; font-weight: 800; line-height: 1; }
.ov-card-lbl { font-size: 11.5px; color: var(--ag-tm); font-weight: 600; margin-top: 4px; }

/* Section */
.ov-section { background: var(--ag-panel); border: 1px solid var(--ag-bd); border-radius: 16px; box-shadow: 0 6px 22px rgba(30,58,138,.08); margin-bottom: 16px; overflow: hidden; }
.ov-section-hd { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--ag-bd); flex-wrap: wrap; }
.ov-section-ttl { font-size: 13.5px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
.ov-section-ttl i { color: #1E3A8A; }
.ov-count { background: var(--ag-tint); color: #1E3A8A; font-size: 11px; font-weight: 800; border-radius: 99px; padding: 2px 9px; }

/* Search */
.ov-search { display: flex; align-items: center; gap: 8px; background: var(--ag-soft); border: 1.5px solid var(--ag-bd); border-radius: 10px; padding: 7px 11px; min-width: 240px; }
.ov-search i { color: var(--ag-tm); font-size: 12px; }
.ov-search input { border: none; background: transparent; outline: none; font-family: inherit; font-size: 12.5px; color: var(--ag-t1); flex: 1; }
.ov-search-x { border: none; background: none; color: var(--ag-tm); cursor: pointer; font-size: 12px; }

/* Table */
.ov-tablewrap { overflow: auto; }
.ov-table { width: 100%; border-collapse: collapse; min-width: 760px; }
.ov-table thead th { position: sticky; top: 0; background: var(--ag-soft2); text-align: left; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: var(--ag-tm); padding: 10px 14px; border-bottom: 1px solid var(--ag-bd); white-space: nowrap; z-index: 1; }
.ov-table tbody td { font-size: 12.5px; padding: 11px 14px; border-bottom: 1px solid var(--ag-soft); vertical-align: middle; }
.ov-table tbody tr:hover { background: var(--ag-soft2); }
.ov-strong { font-weight: 700; }
.ov-muted { color: var(--ag-tm); }
.ov-ellip { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ov-agent { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.ov-agent i { color: var(--ag-tm2); font-size: 11px; }
.ov-pill { background: var(--ag-tint); color: #1E3A8A; font-weight: 800; font-size: 11.5px; border-radius: 8px; padding: 2px 9px; }
.ov-empty { text-align: center; color: var(--ag-tm); padding: 26px; }

/* Badges */
.ov-bdg { display: inline-flex; align-items: center; font-size: 10.5px; font-weight: 800; padding: 3px 10px; border-radius: 99px; white-space: nowrap; }
.ov-bdg-green { background: rgba(22,163,74,.12); color: #16A34A; border: 1px solid rgba(22,163,74,.28); }
.ov-bdg-amber { background: rgba(217,119,6,.12); color: #D97706; border: 1px solid rgba(217,119,6,.28); }
.ov-bdg-slate { background: rgba(100,116,139,.12); color: var(--ag-tm); border: 1px solid rgba(100,116,139,.25); }

.ov-btn-ghost { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px; border-radius: 8px; border: 1.5px solid var(--ag-bd); background: var(--ag-panel); color: #1E3A8A; font-family: inherit; font-size: 11.5px; font-weight: 700; cursor: pointer; white-space: nowrap; transition: all .15s; }
.ov-btn-ghost:hover { border-color: #1E3A8A; background: var(--ag-tint); }

/* Modal */
.ov-ov { position: fixed; inset: 0; background: rgba(8,13,26,.55); backdrop-filter: blur(4px); z-index: 9200; display: flex; align-items: center; justify-content: center; padding: 18px; }
.ov-modal { background: var(--ag-panel); border-radius: 16px; width: 100%; max-width: 480px; max-height: 92vh; overflow-y: auto; box-shadow: 0 20px 50px rgba(30,58,138,.22); display: flex; flex-direction: column; animation: ovIn .24s cubic-bezier(.34,1.22,.64,1); }
.ov-modal-lg { max-width: 600px; }
@keyframes ovIn { from { opacity: 0; transform: translateY(16px) scale(.97);} to { opacity: 1; transform: none; } }
.ov-modal-hd { display: flex; align-items: flex-start; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid var(--ag-bd); position: sticky; top: 0; background: var(--ag-panel); z-index: 2; }
.ov-modal-ttl { display: flex; gap: 10px; align-items: flex-start; }
.ov-modal-ttl > i { font-size: 17px; color: #1E3A8A; margin-top: 2px; }
.ov-modal-t { font-size: 15px; font-weight: 800; }
.ov-modal-s { font-size: 11.5px; color: var(--ag-tm); margin-top: 2px; }
.ov-modal-back, .ov-modal-x { width: 30px; height: 30px; border-radius: 8px; border: 1.5px solid var(--ag-bd); background: var(--ag-panel); color: var(--ag-tm); cursor: pointer; font-size: 12px; flex-shrink: 0; }
.ov-modal-back { margin-right: 2px; }
.ov-modal-x:hover { border-color: #DC2626; color: #DC2626; }
.ov-modal-body { padding: 16px 18px; }

/* History session cards */
.ov-sess-list { display: flex; flex-direction: column; gap: 8px; }
.ov-sess { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; border: 1.5px solid var(--ag-bd); background: var(--ag-panel); border-radius: 12px; padding: 12px 14px; cursor: pointer; font-family: inherit; transition: all .15s; }
.ov-sess:hover { border-color: #1E3A8A; background: var(--ag-soft2); }
.ov-sess-no { width: 40px; height: 40px; border-radius: 11px; flex-shrink: 0; background: linear-gradient(135deg,#1E3A8A,#2563EB); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; }
.ov-sess-main { flex: 1; min-width: 0; }
.ov-sess-top { display: flex; align-items: center; gap: 8px; }
.ov-sess-ttl { font-size: 13.5px; font-weight: 800; }
.ov-sess-sub { font-size: 11.5px; color: var(--ag-tm); margin-top: 2px; }
.ov-sess-meta { display: flex; gap: 14px; font-size: 11px; color: var(--ag-t3); margin-top: 5px; }
.ov-sess-meta i { color: var(--ag-tm); margin-right: 4px; }
.ov-sess-rmk { font-size: 11.5px; color: var(--ag-t3); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }
.ov-sess-arrow { color: var(--ag-tm2); font-size: 13px; flex-shrink: 0; }

/* Transcript */
.ov-trans-meta { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; font-size: 11.5px; color: var(--ag-t3); margin-bottom: 10px; }
.ov-trans-meta i { color: var(--ag-tm); margin-right: 4px; }
.ov-chat { background: var(--ag-msg-bg); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 4px; max-height: 56vh; overflow-y: auto; }
.ov-day { text-align: center; margin: 8px 0; }
.ov-day span { background: var(--ag-daypill); border: 1px solid var(--ag-bd2); border-radius: 99px; padding: 3px 12px; font-size: 10.5px; font-weight: 700; color: var(--ag-tm); }
.ov-row { display: flex; gap: 8px; align-items: flex-end; margin-bottom: 6px; }
.ov-row-out { justify-content: flex-end; }
.ov-av { width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0; background: linear-gradient(135deg,#1E3A8A,#2563EB); color: #fff; font-size: 9px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.ov-bbl-wrap { max-width: 74%; }
.ov-sndr { font-size: 10px; font-weight: 800; color: #1E3A8A; margin-bottom: 3px; }
.ov-bbl { border-radius: 12px; padding: 8px 11px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.ov-bbl-in { background: var(--ag-panel); border-top-left-radius: 4px; }
.ov-bbl-out { background: var(--ag-out-bbl); border-top-right-radius: 4px; }
.ov-bbl-txt { font-size: 13px; line-height: 1.5; }
.ov-bbl-meta { font-size: 9px; color: var(--ag-tm); margin-top: 4px; text-align: right; }
.ov-ticks { color: #53bdeb; margin-left: 3px; }

/* Media placeholders */
.ov-mbox { width: 170px; max-width: 100%; height: 110px; border-radius: 10px; background: var(--ag-soft); border: 1.5px dashed var(--ag-bd2); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; margin-bottom: 5px; }
.ov-mbox-ico { font-size: 26px; }
.ov-mbox-lbl { font-size: 10.5px; color: var(--ag-tm); font-weight: 600; }
.ov-mcard { display: flex; align-items: center; gap: 9px; background: var(--ag-soft2); border: 1.5px solid var(--ag-bd); border-radius: 9px; padding: 8px 10px; min-width: 180px; margin-bottom: 5px; }
.ov-mcard-ico { width: 32px; height: 32px; border-radius: 8px; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; }
.ov-mcard-nm { font-size: 12px; font-weight: 700; }
.ov-mcard-sz { font-size: 10px; color: var(--ag-tm); }
.ov-mcard-dl { color: var(--ag-tm2); font-size: 12px; margin-left: auto; }
.ov-voice { display: flex; align-items: center; gap: 8px; min-width: 170px; }
.ov-voice-play { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg,#1E3A8A,#2563EB); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0; }
.ov-voice-bar { flex: 1; height: 3px; background: rgba(100,116,139,.28); border-radius: 3px; overflow: hidden; }
.ov-voice-bar span { display: block; height: 100%; background: #1E3A8A; }
.ov-voice-dur { font-size: 9px; color: var(--ag-tm); }
.ov-voice-mic { color: var(--ag-tm); font-size: 11px; }

.ov-closed { margin: 8px auto 2px; max-width: 90%; text-align: center; background: rgba(22,163,74,.07); border: 1.5px solid rgba(22,163,74,.25); border-radius: 11px; padding: 10px 14px; font-size: 12px; font-weight: 700; color: #15803d; }
.ov-closed i { margin-right: 5px; }
.ov-closed-rmk { font-size: 11.5px; font-weight: 500; font-style: italic; color: var(--ag-t3); margin-top: 4px; }

/* Responsive */
@media (max-width: 1100px) { .ov-cards { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 640px) {
  .ov-root { padding: 12px; }
  .ov-cards { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .ov-search { min-width: 0; width: 100%; }
  .ov-section-hd { align-items: stretch; }
}
@media (max-width: 420px) { .ov-cards { grid-template-columns: 1fr; } }
`;
