import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import TutorialModal from '../../components/TutorialModal';

/* ═══════════════════════════════════════════════════════════════════
   CHAT — school mobile messaging (parents · students · teachers)

   Ported from "e tube, chat and Notification .html". Two-column layout:
   a searchable recent-conversations sidebar on the left and a full
   conversation panel on the right (header · messages · composer).

   Features carried over from the design:
     • Recent chats sidebar with live search (name / father / class /
       last message) and unread badges.
     • Conversation panel with date separators, sent / received bubbles
       and rich attachments (voice note, image, image gallery, video,
       PDF / document).
     • In-conversation search with prev / next navigation + match counter.
     • Composer with attachment popup (image · video · doc), a simulated
       voice-recording bar, and an auto-reply so the demo feels alive.
     • "New Chat" modal: browse by class → contact, or search across all
       contacts. Non-app-users are shown disabled.

   All state is in-component demo state — a developer wires this to the
   real messaging API (SignalR is already a dependency) later.
   ═══════════════════════════════════════════════════════════════════ */

/* ── Contact directory (classes → members) ── */
const CLASS_GROUPS = [
  { id: 'g1', name: 'II-Pre',          count: 12 },
  { id: 'g2', name: 'III-Pre',         count: 2 },
  { id: 'g3', name: 'class 1A',        count: 13 },
  { id: 'g4', name: '11',              count: 7 },
  { id: 'g5', name: 'Ahmad Testing',   count: 4 },
  { id: 'g6', name: 'Bulk Upload Test', count: 6 },
  { id: 'g7', name: 'Bulk Upload',     count: 5 },
];

const GROUP_MEMBERS = {
  g1: [
    { name: 'Ava Mahnoor Khan', rel: 'D/O Bb',            father: 'Bb',            appUser: true },
    { name: 'Abdul Qayyum',     rel: 'S/O Qayyum Khan',   father: 'Qayyum Khan',   appUser: true },
    { name: 'Yousaf Khan',      rel: 'S/O Shad Muhammad', father: 'Shad Muhammad', appUser: true },
    { name: 'Azan Khan',        rel: 'S/O Adnan Khan',    father: 'Adnan Khan',    appUser: true },
    { name: 'Humdan Khan',      rel: 'S/O Adnan Khan',    father: 'Adnan Khan',    appUser: true },
    { name: 'Hamza Tariq',      rel: 'S/O Tariq Mehmood', father: 'Tariq Mehmood', appUser: true },
    { name: 'Usman Khalid',     rel: 'S/O Khalid Hussain', father: 'Khalid Hussain', appUser: true },
    { name: 'Filzi Afzal',      rel: 'D/O Muhammad Afzal', father: 'Muhammad Afzal', appUser: false },
    { name: 'Sara Imran',       rel: 'D/O Imran Ali',     father: 'Imran Ali',     appUser: false },
    { name: 'Noor Fatima',      rel: 'D/O Asif Rana',     father: 'Asif Rana',     appUser: false },
    { name: 'Bb',               rel: 'D/O B',             father: 'B',             appUser: false },
    { name: 'Zara Bashir',      rel: 'D/O Bashir Ahmed',  father: 'Bashir Ahmed',  appUser: false },
  ],
  g2: [
    { name: 'Fatima Arshad', rel: 'D/O Arshad Mehmood', father: 'Arshad Mehmood', appUser: true },
    { name: 'Ali Raza',      rel: 'S/O Raza Hussain',   father: 'Raza Hussain',   appUser: false },
  ],
  g3: [
    { name: 'Sughra Bibi', rel: 'D/O Muhammad Waseem', father: 'Muhammad Waseem', appUser: true },
    { name: 'Omar Shahid', rel: 'S/O Shahid Iqbal',    father: 'Shahid Iqbal',    appUser: true },
    { name: 'Bilal Ahmed', rel: 'S/O Ahmed Nawaz',     father: 'Ahmed Nawaz',     appUser: true },
    { name: 'Laiba Tariq', rel: 'D/O Tariq Hassan',    father: 'Tariq Hassan',    appUser: false },
    { name: 'Amna Khalil', rel: 'D/O Khalil Bhatti',   father: 'Khalil Bhatti',   appUser: false },
  ],
  g4: [
    { name: 'Asim Khan',   rel: 'P/O Asim Khan', father: 'Asim Khan', appUser: true },
    { name: 'Waseem',      rel: 'P/O Waseem',    father: 'Waseem',    appUser: true },
    { name: 'Rizwan Shah', rel: 'S/O Shah Zaman', father: 'Shah Zaman', appUser: false },
  ],
  g5: [
    { name: 'Gamma',   rel: 'Vice Principal',  father: '—', appUser: true },
    { name: 'Epsilon', rel: 'Teacher English', father: '—', appUser: true },
  ],
  g6: [
    { name: 'Test Parent A', rel: 'P/O Student A', father: 'Test Parent A', appUser: true },
    { name: 'Test Parent B', rel: 'P/O Student B', father: 'Test Parent B', appUser: false },
  ],
  g7: [
    { name: 'Bulk User 1', rel: 'P/O Student 1', father: 'Bulk User 1', appUser: true },
    { name: 'Bulk User 2', rel: 'P/O Student 2', father: 'Bulk User 2', appUser: false },
  ],
};

/* ── Recent conversations (with father + unread counts) ── */
const INITIAL_RECENT = [
  { name: 'Sughra Bibi',     rel: 'D/O Muhammad Waseem', father: 'Muhammad Waseem', group: 'class 1A',      online: true,  time: '12:20 pm',                unread: 0 },
  { name: 'Fatima Arshad',   rel: 'D/O Arshad Mehmood',  father: 'Arshad Mehmood',  group: 'II-Pre',        online: false, time: '10:10 am',                unread: 2 },
  { name: 'Epsilon',         rel: 'Teacher English',     father: '—',               group: 'Ahmad Testing', online: true,  time: '10:15 am',                unread: 0 },
  { name: 'Ava Mahnoor Khan', rel: 'D/O Bb',             father: 'Bb',              group: 'II-Pre',        online: true,  time: '09:25 am',                unread: 1 },
  { name: 'Gamma',           rel: 'Vice Principal',      father: '—',               group: 'Ahmad Testing', online: true,  time: '08:50 am',                unread: 3 },
  { name: 'Asim Khan',       rel: 'P/O Asim Khan',       father: 'Asim Khan',       group: '11',            online: false, time: 'Yesterday · 11:05 am',    unread: 0 },
  { name: 'Waseem',          rel: 'P/O Waseem',          father: 'Waseem',          group: '11',            online: false, time: 'Yesterday · 02:14 pm',    unread: 0 },
];

const INITIAL_HISTORY = {
  'Sughra Bibi': [
    { type: 'recv', text: "Assalam o alaikum, I wanted to ask about my daughter's result this term.", time: '07:30 pm', date: '22 Jun 2026 · 07:30 pm' },
    { type: 'sent', text: 'Walaikum assalam! She has performed very well. Marks will be shared formally soon.', time: '07:45 pm', date: '22 Jun 2026 · 07:45 pm' },
    { type: 'recv', attach: 'voice', dur: '0:14', time: '11:50 am', date: 'Today' },
    { type: 'sent', text: 'JazakAllah for the voice message. I will check with the class teacher.', time: '12:00 pm', date: 'Today' },
    { type: 'sent', attach: 'doc', docName: 'Result_Card_SughraBibi.pdf', docSize: '180 KB', time: '12:10 pm', date: 'Today' },
    { type: 'recv', text: 'Received! JazakAllah khair.', time: '12:15 pm', date: 'Today' },
    { type: 'sent', text: 'You are welcome. Please contact us any time.', time: '12:20 pm', date: 'Today' },
  ],
  'Fatima Arshad': [
    { type: 'recv', text: 'Hello mam, Fatima was absent today due to fever.', time: '10:00 am', date: 'Today' },
    { type: 'sent', text: 'Noted. Please bring a medical certificate when she returns.', time: '10:05 am', date: 'Today' },
    { type: 'sent', attach: 'image', label: 'Leave Application Form.jpg', time: '10:07 am', date: 'Today' },
    { type: 'recv', text: 'Thank you, we will bring it tomorrow inshAllah.', time: '10:10 am', date: 'Today' },
  ],
  'Epsilon': [
    { type: 'sent', text: 'Please review the lesson plan for next week.', time: '09:30 am', date: 'Today' },
    { type: 'sent', attach: 'doc', docName: 'Lesson_Plan_Week_26.pdf', docSize: '210 KB', time: '09:31 am', date: 'Today' },
    { type: 'recv', text: 'Received! I will share feedback by evening.', time: '09:45 am', date: 'Today' },
    { type: 'sent', attach: 'video', label: 'Teaching Video — Chapter 5.mp4', time: '10:00 am', date: 'Today' },
    { type: 'recv', text: 'Great video, I will use it as a reference.', time: '10:15 am', date: 'Today' },
  ],
  'Ava Mahnoor Khan': [
    { type: 'recv', text: "Could you please share today's notes?", time: '09:14 am', date: 'Today' },
    { type: 'sent', text: 'Of course, attaching the PDF right now.', time: '09:16 am', date: 'Today' },
    { type: 'sent', attach: 'doc', docName: 'Chapter_5_Notes.pdf', docSize: '340 KB', time: '09:17 am', date: 'Today' },
    { type: 'recv', text: 'JazakAllah! Received.', time: '09:18 am', date: 'Today' },
    { type: 'sent', attach: 'voice', dur: '0:32', time: '09:20 am', date: 'Today' },
    { type: 'recv', text: 'I understand, I will ask my son to complete the exercises.', time: '09:25 am', date: 'Today' },
    { type: 'sent', attach: 'gallery', images: ['Class Photo 1', 'Class Photo 2', 'Class Photo 3', 'Class Photo 4', 'Class Photo 5', 'Class Photo 6'], time: '09:26 am', date: 'Today' },
  ],
  'Gamma': [
    { type: 'recv', text: 'Meeting at 3pm today in the staff room.', time: '08:45 am', date: 'Today' },
    { type: 'sent', text: 'Confirmed. I will be there.', time: '08:50 am', date: 'Today' },
    { type: 'sent', attach: 'voice', dur: '0:18', time: '09:00 am', date: 'Today' },
  ],
  'Asim Khan': [
    { type: 'recv', text: 'Sir, fee challan has been received. Thank you.', time: '11:00 am', date: 'Yesterday · 11:00 am' },
    { type: 'sent', text: 'Noted! The payment has been processed.', time: '11:05 am', date: 'Yesterday · 11:05 am' },
  ],
  'Waseem': [
    { type: 'recv', text: 'Student was absent today without notice.', time: '02:10 pm', date: 'Yesterday · 02:10 pm' },
    { type: 'sent', text: 'Thank you for informing. We will note this.', time: '02:14 pm', date: 'Yesterday · 02:14 pm' },
  ],
};

/* ── helpers ── */
const ini = (n) => (n || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
const nowTime = () => {
  const d = new Date(), h = d.getHours(), m = d.getMinutes();
  return `${h % 12 || 12}:${m < 10 ? '0' : ''}${m}${h >= 12 ? ' pm' : ' am'}`;
};
const lastPreview = (hist) => {
  if (!hist || !hist.length) return 'No messages yet';
  const last = hist[hist.length - 1];
  if (last.attach === 'voice')   return '🎤 Voice message';
  if (last.attach === 'image')   return `📷 ${last.label}`;
  if (last.attach === 'gallery') return `📷 ${last.images.length} photos`;
  if (last.attach === 'video')   return `🎬 ${last.label}`;
  if (last.attach === 'doc')     return `📄 ${last.docName}`;
  return last.text;
};
/* searchable text content of a message (for in-chat search) */
const msgText = (m) => m.text || m.label || m.docName || (m.attach === 'gallery' ? m.images?.join(' ') : '') || '';

/* highlight query matches inside a plain string → array of React nodes */
function highlight(text, q) {
  if (!q || !text) return text;
  const lower = String(text).toLowerCase();
  const needle = q.toLowerCase();
  const out = [];
  let i = 0, k = 0;
  while (i < text.length) {
    const idx = lower.indexOf(needle, i);
    if (idx === -1) { out.push(text.slice(i)); break; }
    if (idx > i) out.push(text.slice(i, idx));
    out.push(<mark className="search-highlight" key={k++}>{text.slice(idx, idx + needle.length)}</mark>);
    i = idx + needle.length;
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════════════════ */
export default function Chat({ toast = () => {}, onUnreadChange }) {
  const [recent, setRecent]   = useState(INITIAL_RECENT);
  const [history, setHistory] = useState(INITIAL_HISTORY);
  const [activeName, setActiveName] = useState('Sughra Bibi');

  const [sidebarQ, setSidebarQ] = useState('');

  /* in-conversation search */
  const [convSearchOpen, setConvSearchOpen] = useState(false);
  const [convQ, setConvQ] = useState('');
  const [convIdx, setConvIdx] = useState(0);

  /* composer */
  const [draft, setDraft] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);

  /* voice recording */
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);

  /* new-chat modal */
  const [ncOpen, setNcOpen] = useState(false);

  /* tutorial modal */
  const [tutorialOpen, setTutorialOpen] = useState(false);

  /* ── Mobile single-panel mode ──
     On narrow screens (≤768px, handled purely in CSS) only one panel
     fits, so we show the chat list OR the open conversation. Opening a
     chat sets this flag to slide to the conversation; the Back button
     clears it. On desktop both panels render side by side and the flag
     is inert (the .cm-show-conv rules live inside the mobile media query). */
  const [mobileShowConv, setMobileShowConv] = useState(false);

  const msgsRef = useRef(null);
  const matchRefs = useRef({});
  const activeRef = useRef(activeName);
  activeRef.current = activeName;

  const activeChat = recent.find(c => c.name === activeName) || null;
  const activeMsgs = useMemo(() => history[activeName] || [], [history, activeName]);

  /* ── derived: filtered recent list ── */
  const filteredRecent = useMemo(() => {
    const q = sidebarQ.trim().toLowerCase();
    if (!q) return recent;
    return recent.filter(c => {
      const preview = lastPreview(history[c.name]).toLowerCase();
      return c.name.toLowerCase().includes(q)
        || (c.father || '').toLowerCase().includes(q)
        || (c.rel || '').toLowerCase().includes(q)
        || (c.group || '').toLowerCase().includes(q)
        || preview.includes(q);
    });
  }, [recent, history, sidebarQ]);

  const totalUnread = useMemo(() => recent.reduce((s, c) => s + (c.unread || 0), 0), [recent]);

  /* Report the unseen-message count up to the shell so the sidebar Chat
     nav badge stays in sync (clears as conversations are opened). */
  useEffect(() => { onUnreadChange?.(totalUnread); }, [totalUnread, onUnreadChange]);

  /* ── derived: in-chat search matches (message indices) ── */
  const convMatches = useMemo(() => {
    const q = convQ.trim().toLowerCase();
    if (!q) return [];
    return activeMsgs.reduce((acc, m, i) => {
      if (msgText(m).toLowerCase().includes(q)) acc.push(i);
      return acc;
    }, []);
  }, [activeMsgs, convQ]);

  /* keep the active-match index in range when matches change */
  useEffect(() => { setConvIdx(0); }, [convQ, activeName]);

  /* scroll the active in-chat match into view */
  useEffect(() => {
    if (!convMatches.length) return;
    const el = matchRefs.current[convMatches[convIdx]];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [convIdx, convMatches]);

  /* auto-scroll to bottom on conversation switch / new message (unless searching) */
  useEffect(() => {
    if (convSearchOpen) return;
    const el = msgsRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeMsgs.length, activeName, convSearchOpen]);

  /* recording timer */
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setRecSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  /* close attachment popup on outside click */
  useEffect(() => {
    if (!attachOpen) return;
    const onDoc = (e) => { if (!e.target.closest('.cm-attach-zone')) setAttachOpen(false); };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [attachOpen]);

  /* ── actions ── */
  const openConv = (name) => {
    setActiveName(name);
    setConvSearchOpen(false);
    setConvQ('');
    setMobileShowConv(true);
    setRecent(prev => prev.map(c => c.name === name ? { ...c, unread: 0 } : c));
  };

  const pushMessage = (name, msg) => {
    setHistory(prev => ({ ...prev, [name]: [...(prev[name] || []), msg] }));
    setRecent(prev => prev.map(c => c.name === name ? { ...c, time: msg.time } : c));
  };

  const sendText = () => {
    const txt = draft.trim();
    if (!txt) return;
    const name = activeRef.current;
    pushMessage(name, { type: 'sent', text: txt, time: nowTime(), date: 'Today' });
    setDraft('');
    /* simulated auto-reply */
    setTimeout(() => {
      pushMessage(name, { type: 'recv', text: 'Received, thank you!', time: nowTime(), date: 'Today' });
    }, 1400);
  };

  const insertAttachment = (type) => {
    const t = nowTime();
    let msg;
    if (type === 'image')      msg = { type: 'sent', attach: 'image', label: `Photo_${t.replace(/\s/g, '')}.jpg`, time: t, date: 'Today' };
    else if (type === 'video') msg = { type: 'sent', attach: 'video', label: `Video_${t.replace(/\s/g, '')}.mp4`, time: t, date: 'Today' };
    else                       msg = { type: 'sent', attach: 'doc', docName: `Document_${t.replace(/\s/g, '')}.pdf`, docSize: '1.2 MB', time: t, date: 'Today' };
    pushMessage(activeName, msg);
    setAttachOpen(false);
    toast(`${type === 'image' ? 'Image' : type === 'video' ? 'Video' : 'Document'} sent (demo)`, 'success');
  };

  const startRecording = () => { setRecSeconds(0); setRecording(true); };
  const cancelRecording = () => { setRecording(false); setRecSeconds(0); };
  const sendVoiceNote = () => {
    const dur = `${Math.floor(recSeconds / 60)}:${recSeconds % 60 < 10 ? '0' : ''}${recSeconds % 60}`;
    cancelRecording();
    pushMessage(activeName, { type: 'sent', attach: 'voice', dur: dur === '0:0' ? '0:03' : dur, time: nowTime(), date: 'Today' });
    toast('Voice message sent', 'success');
  };

  const startChatWith = (member, groupName) => {
    setNcOpen(false);
    const existing = recent.find(c => c.name === member.name);
    if (existing) { openConv(member.name); toast(`Opened existing chat with ${member.name}`, 'info'); return; }
    setRecent(prev => [{ name: member.name, rel: member.rel, father: member.father || '—', group: groupName, online: true, time: 'Just now', unread: 0 }, ...prev]);
    setHistory(prev => ({ ...prev, [member.name]: prev[member.name] || [] }));
    setActiveName(member.name);
    setConvSearchOpen(false);
    setConvQ('');
    setMobileShowConv(true);
    toast(`New chat started with ${member.name}`, 'success');
  };

  const convSearchNav = (dir) => {
    if (!convMatches.length) return;
    setConvIdx(i => (i + dir + convMatches.length) % convMatches.length);
  };

  return (
    <>
      <style>{CHAT_CSS}</style>

      <div className="cm-root">
        {/* ── Page header ── */}
        <div className="cm-page-header">
          <div className="cm-page-header-icon"><i className="fa-solid fa-comments" /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="cm-page-title">
              Chats {totalUnread > 0 && <span className="cm-unread-global">{totalUnread}</span>}
            </div>
            <div className="cm-page-kicker">School Mobile Messaging</div>
            <div className="cm-page-sub">School mobile messaging — parents, students &amp; teachers</div>
          </div>
          <Tooltip text="Play a short tutorial for the Chat module">
            <button
              className="tutorial-btn page-tutorial-btn"
              onClick={() => setTutorialOpen(true)}
              aria-label="Open Chat tutorials"
            >
              <div className="play-dot"><i className="fa-solid fa-play" style={{ fontSize: 8 }} /></div>
              <span className="tutorial-label">Tutorial</span>
            </button>
          </Tooltip>
        </div>

        {/* ── 2-column dashboard ── */}
        <div className={`cm-dashboard${mobileShowConv ? ' cm-show-conv' : ''}`}>

          {/* ══ LEFT: recent chats ══ */}
          <div className="cm-col cm-col-list">
            <div className="cm-sidebar-top">
              <Tooltip text="Start a new chat with a parent, student or teacher">
                <button className="cm-new-chat-btn" onClick={() => setNcOpen(true)}>
                  <i className="fa-solid fa-plus" /> New Chat
                </button>
              </Tooltip>
            </div>

            <div className="cm-sidebar-search-wrap">
              <div className="cm-sidebar-search-box">
                <i className="fa-solid fa-magnifying-glass cm-sidebar-search-icon" />
                <input
                  className="cm-sidebar-search-input"
                  placeholder="Search chats, parents, students, teachers..."
                  value={sidebarQ}
                  onChange={e => setSidebarQ(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') setSidebarQ(''); }}
                />
                {sidebarQ && (
                  <Tooltip text="Clear search">
                    <button className="cm-sidebar-search-clear" onClick={() => setSidebarQ('')}>
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>

            <div className="cm-rcr-label">
              {sidebarQ ? `${filteredRecent.length} result${filteredRecent.length !== 1 ? 's' : ''} found` : 'Recent Conversations'}
            </div>

            <div className="cm-col-body">
              {filteredRecent.length === 0 ? (
                <div className="cm-sidebar-empty">
                  <i className="fa-solid fa-magnifying-glass" />
                  <div className="cm-sidebar-empty-title">No results found</div>
                  <div className="cm-sidebar-empty-sub">Try searching by name, father name,<br />class or last message.</div>
                </div>
              ) : filteredRecent.map(c => (
                <div
                  key={c.name}
                  className={`cm-recent-row${activeName === c.name ? ' active' : ''}`}
                  onClick={() => openConv(c.name)}
                >
                  <div className="cm-rcr-avatar">{ini(c.name)}<div className={`cm-rcr-dot ${c.online ? 'on' : 'off'}`} /></div>
                  <div className="cm-rcr-info">
                    <div className="cm-rcr-name-row">
                      <span className="cm-rcr-name">{highlight(c.name, sidebarQ)}</span>
                      <span className="cm-rcr-badge">{highlight(c.group, sidebarQ)}</span>
                    </div>
                    <div className="cm-rcr-father">
                      <i className="fa-solid fa-user" style={{ fontSize: 9, opacity: 0.6, marginRight: 3 }} />
                      Father: {highlight(c.father || '—', sidebarQ)}
                    </div>
                    <div className="cm-rcr-preview">{highlight(lastPreview(history[c.name]), sidebarQ)}</div>
                  </div>
                  <div className="cm-rcr-meta">
                    <span className="cm-rcr-time">{c.time}</span>
                    {c.unread ? <span className="cm-rcr-unread">{c.unread}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ══ RIGHT: conversation ══ */}
          <div className="cm-col cm-col-conv">
            <div className="cm-conv-panel">
              {!activeChat ? (
                <div className="cm-conv-empty">
                  <div className="cm-conv-empty-icon"><i className="fa-solid fa-comments" /></div>
                  <div className="cm-conv-empty-title">No Conversation Selected</div>
                  <div className="cm-conv-empty-sub">Pick a conversation from the left panel or click <strong>New Chat</strong>.</div>
                </div>
              ) : (
                <>
                  {/* header */}
                  <div className="cm-conv-header">
                    <Tooltip text="Back to chats">
                      <button className="cm-conv-back" onClick={() => setMobileShowConv(false)} aria-label="Back to chats">
                        <i className="fa-solid fa-arrow-left" />
                      </button>
                    </Tooltip>
                    <div className="cm-conv-hdr-avatar">{ini(activeChat.name)}<div className={`cm-conv-hdr-dot ${activeChat.online ? 'on' : 'off'}`} /></div>
                    <div className="cm-conv-hdr-info">
                      <div className="cm-conv-hdr-name">{activeChat.name}</div>
                      <div className="cm-conv-hdr-sub">
                        {activeChat.rel}{activeChat.father && activeChat.father !== '—' ? ` · Father: ${activeChat.father}` : ''} · {activeChat.group}
                      </div>
                    </div>
                    <div className="cm-conv-hdr-badge">{activeChat.group || '—'}</div>
                    <Tooltip text="Search in this conversation">
                      <button
                        className={`cm-conv-hdr-search${convSearchOpen ? ' active' : ''}`}
                        onClick={() => { setConvSearchOpen(o => !o); setConvQ(''); }}
                      >
                        <i className="fa-solid fa-magnifying-glass" />
                      </button>
                    </Tooltip>
                  </div>

                  {/* in-chat search bar */}
                  {convSearchOpen && (
                    <div className="cm-conv-search-bar">
                      <div className="cm-conv-search-inner">
                        <i className="fa-solid fa-magnifying-glass" />
                        <input
                          className="cm-conv-search-input"
                          autoFocus
                          placeholder="Search in this conversation..."
                          value={convQ}
                          onChange={e => setConvQ(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') convSearchNav(e.shiftKey ? -1 : 1);
                            if (e.key === 'Escape') { setConvSearchOpen(false); setConvQ(''); }
                          }}
                        />
                        <span className="cm-conv-search-counter">
                          {convQ ? (convMatches.length ? `${convIdx + 1} of ${convMatches.length}` : 'No results') : ''}
                        </span>
                      </div>
                      <div className="cm-conv-search-nav">
                        <Tooltip text="Previous result">
                          <button className="cm-conv-search-nav-btn" onClick={() => convSearchNav(-1)} disabled={convMatches.length <= 1}>
                            <i className="fa-solid fa-chevron-up" />
                          </button>
                        </Tooltip>
                        <Tooltip text="Next result">
                          <button className="cm-conv-search-nav-btn" onClick={() => convSearchNav(1)} disabled={convMatches.length <= 1}>
                            <i className="fa-solid fa-chevron-down" />
                          </button>
                        </Tooltip>
                      </div>
                      <Tooltip text="Close search">
                        <button className="cm-conv-search-close" onClick={() => { setConvSearchOpen(false); setConvQ(''); }}>
                          <i className="fa-solid fa-xmark" />
                        </button>
                      </Tooltip>
                    </div>
                  )}

                  {/* messages */}
                  <div className="cm-conv-msgs" ref={msgsRef}>
                    {activeMsgs.map((m, i) => {
                      const prev = activeMsgs[i - 1];
                      const showSep = m.date && (!prev || prev.date !== m.date);
                      const isMatch = convMatches.includes(i);
                      const isActiveMatch = isMatch && convMatches[convIdx] === i;
                      return (
                        <React.Fragment key={i}>
                          {showSep && <div className="cm-msg-date-sep">{m.date}</div>}
                          <MessageBubble
                            m={m}
                            convName={activeName}
                            toast={toast}
                            matchClass={isActiveMatch ? 'cm-msg-search-active' : isMatch ? 'cm-msg-search-match' : ''}
                            innerRef={el => { if (isMatch) matchRefs.current[i] = el; }}
                          />
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* recording bar */}
                  {recording && (
                    <div className="cm-recording-row">
                      <Tooltip text="Cancel recording"><button className="cm-rec-cancel" onClick={cancelRecording}><i className="fa-solid fa-xmark" /></button></Tooltip>
                      <div className="cm-rec-dot" />
                      <div className="cm-rec-waveform">
                        {Array.from({ length: 28 }, (_, i) => <span key={i} style={{ animationDelay: `${i * 0.05}s` }} />)}
                      </div>
                      <div className="cm-rec-timer">{Math.floor(recSeconds / 60)}:{recSeconds % 60 < 10 ? '0' : ''}{recSeconds % 60}</div>
                      <button className="cm-rec-send" onClick={sendVoiceNote}><i className="fa-solid fa-paper-plane" /> Send</button>
                    </div>
                  )}

                  {/* composer */}
                  {!recording && (
                    <div className="cm-conv-composer">
                      <div className="cm-conv-input-row">
                        <div className="cm-attach-zone" style={{ position: 'relative' }}>
                          <Tooltip text="Attach image, video or document">
                            <button className="cm-attach-trigger" onClick={() => setAttachOpen(o => !o)}>
                              <i className="fa-solid fa-paperclip" />
                            </button>
                          </Tooltip>
                          {attachOpen && (
                            <div className="cm-attach-popup">
                              <div className="cm-attach-popup-item" onClick={() => insertAttachment('image')}><i className="fa-solid fa-image" style={{ color: 'var(--brand-primary)' }} /> Image</div>
                              <div className="cm-attach-popup-item" onClick={() => insertAttachment('video')}><i className="fa-solid fa-video" style={{ color: 'var(--brand-primary)' }} /> Video</div>
                              <div className="cm-attach-popup-item" onClick={() => insertAttachment('doc')}><i className="fa-solid fa-file-pdf" style={{ color: '#DC2626' }} /> PDF / Document</div>
                            </div>
                          )}
                        </div>
                        <input
                          className="cm-conv-txt-input"
                          placeholder="Type a message..."
                          value={draft}
                          onChange={e => setDraft(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') sendText(); }}
                        />
                        <Tooltip text="Record a voice message"><button className="cm-conv-mic-btn" onClick={startRecording}><i className="fa-solid fa-microphone" /></button></Tooltip>
                        <Tooltip text="Send message"><button className="cm-conv-send-btn" onClick={sendText}><i className="fa-solid fa-paper-plane" /></button></Tooltip>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {ncOpen && (
        <NewChatModal
          onClose={() => setNcOpen(false)}
          onStartChat={startChatWith}
          toast={toast}
        />
      )}

      <TutorialModal
        open={tutorialOpen}
        moduleKey="chat"
        onClose={() => setTutorialOpen(false)}
        toast={toast}
      />
    </>
  );
}

/* ── Message bubble ── */
function MessageBubble({ m, convName, toast, matchClass, innerRef }) {
  const isSent = m.type === 'sent';
  const tick = isSent ? <i className="fa-solid fa-check-double" style={{ color: 'var(--brand-primary)', fontSize: 9 }} /> : null;
  const meta = <div className="cm-msg-meta">{m.time || ''} {tick}</div>;

  let body;
  if (!m.attach) {
    body = <div className="cm-bubble">{m.text}</div>;
  } else if (m.attach === 'voice') {
    const bars = [14, 22, 10, 28, 18, 32, 12, 26, 16, 30, 10, 24, 20, 16, 28];
    body = (
      <div className="cm-attach-voice" onClick={() => toast('Playing voice message (demo)', 'info')}>
        <div className="cm-attach-voice-btn"><i className="fa-solid fa-play" /></div>
        <div className="cm-attach-waveform">{bars.map((h, i) => <span key={i} style={{ height: h }} />)}</div>
        <div className="cm-attach-voice-dur">{m.dur}</div>
      </div>
    );
  } else if (m.attach === 'image') {
    body = (
      <div className="cm-attach-image" onClick={() => toast('Opening image (demo)', 'info')}>
        <div className="cm-attach-image-inner"><i className="fa-solid fa-image" /><span>{m.label || 'Photo'}</span></div>
        <div className="cm-attach-image-overlay"><i className="fa-solid fa-expand" /></div>
      </div>
    );
  } else if (m.attach === 'gallery') {
    const imgs = m.images || [];
    const extra = imgs.length - 3;
    body = (
      <div className="cm-img-gallery" onClick={() => toast(`Opening gallery — ${imgs.length} photos (demo)`, 'info')}>
        {imgs.slice(0, 3).map((lbl, i) => (
          <div className="cm-img-gallery-cell" key={i}>
            <i className="fa-solid fa-image" />
            {i === 2 && extra > 0 && <div className="cm-img-gallery-more">+{extra + 1}</div>}
          </div>
        ))}
      </div>
    );
  } else if (m.attach === 'video') {
    body = (
      <div className="cm-attach-video" onClick={() => toast('Playing video (demo)', 'info')}>
        <div className="cm-attach-video-inner">
          <div className="cm-attach-video-play"><i className="fa-solid fa-play" /></div>
          <span>{m.label || 'Video'}</span>
        </div>
      </div>
    );
  } else if (m.attach === 'doc') {
    body = (
      <div className="cm-attach-doc" onClick={() => toast(`Downloading ${m.docName} (demo)`, 'info')}>
        <div className="cm-attach-doc-icon"><i className="fa-solid fa-file-pdf" /></div>
        <div className="cm-attach-doc-info">
          <div className="cm-attach-doc-name">{m.docName}</div>
          <div className="cm-attach-doc-size">{m.docSize || ''}</div>
        </div>
        <i className="fa-solid fa-download" style={{ color: 'var(--brand-primary)', fontSize: 13 }} />
      </div>
    );
  }

  if (isSent) {
    return <div className={`cm-msg-sent ${matchClass}`} ref={innerRef}>{body}{meta}</div>;
  }
  return (
    <div className={`cm-msg-recv ${matchClass}`} ref={innerRef}>
      <div className="cm-msg-recv-av">{ini(convName)}</div>
      <div>{body}{meta}</div>
    </div>
  );
}

/* ── New Chat modal ── */
function NewChatModal({ onClose, onStartChat, toast }) {
  const [group, setGroup] = useState(null);   // selected class id, or null = class list
  const [q, setQ] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const query = q.trim().toLowerCase();
  const groupObj = CLASS_GROUPS.find(g => g.id === group);

  /* search across all members + class names */
  const searchResults = useMemo(() => {
    if (!query) return null;
    const contacts = [];
    CLASS_GROUPS.forEach(g => {
      (GROUP_MEMBERS[g.id] || []).forEach(m => {
        if (m.name.toLowerCase().includes(query)
          || (m.father || '').toLowerCase().includes(query)
          || (m.rel || '').toLowerCase().includes(query)
          || g.name.toLowerCase().includes(query)) {
          contacts.push({ ...m, groupName: g.name });
        }
      });
    });
    const classes = CLASS_GROUPS.filter(g => g.name.toLowerCase().includes(query));
    return { contacts, classes };
  }, [query]);

  const handleMember = (m, groupName) => {
    if (!m.appUser) { toast(`${m.name} has not logged into the School Mentor app yet.`, 'warning'); return; }
    onStartChat(m, groupName);
  };

  const sub = searchResults ? 'Search results'
    : groupObj ? `${groupObj.name} — select a contact`
    : 'Select a class to browse contacts';

  return createPortal(
    <div className="modal-overlay open" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-md" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title"><i className="fa-solid fa-plus" style={{ marginRight: 6 }} />New Chat</div>
            <div className="modal-sub">{sub}</div>
          </div>
          <Tooltip text="Close"><button className="modal-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button></Tooltip>
        </div>

        {/* search */}
        <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border-light)' }}>
          <div className="cm-nc-search-box">
            <i className="fa-solid fa-magnifying-glass" />
            <input
              className="cm-nc-search-input"
              autoFocus
              placeholder="Search by name, father name, class..."
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setQ(''); }}
            />
            {q && <button className="cm-nc-search-clear" onClick={() => setQ('')} title="Clear"><i className="fa-solid fa-xmark" /></button>}
          </div>
        </div>

        <div className="modal-body" style={{ padding: 0, maxHeight: '58vh', overflowY: 'auto' }}>
          {searchResults ? (
            (searchResults.contacts.length === 0 && searchResults.classes.length === 0) ? (
              <div className="cm-nc-empty">
                <i className="fa-solid fa-user-slash" />
                <div className="cm-nc-empty-title">No matching contact found</div>
                <div className="cm-nc-empty-sub">Try searching by a different name,<br />father name, class, or admission number.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 12px 14px' }}>
                {searchResults.classes.length > 0 && (
                  <>
                    <div className="cm-nc-group-label">Classes</div>
                    {searchResults.classes.map(g => (
                      <div key={g.id} className="cm-nc-class-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, textAlign: 'left', padding: '10px 12px' }} onClick={() => { setGroup(g.id); setQ(''); }}>
                        <div className="cm-nc-class-count">{g.count}</div>
                        <div><div className="cm-nc-class-name">{highlight(g.name, q)}</div><div className="cm-nc-class-sub">{g.count} members</div></div>
                      </div>
                    ))}
                  </>
                )}
                {searchResults.contacts.length > 0 && (
                  <>
                    <div className="cm-nc-group-label">Contacts</div>
                    {searchResults.contacts.map((m, i) => (
                      <div key={`${m.name}-${i}`} className={`cm-nc-member-row ${m.appUser ? 'on' : 'off'}`} onClick={() => handleMember(m, m.groupName)}>
                        <div className={`cm-nc-member-av ${m.appUser ? 'on' : 'off'}`}>{ini(m.name)}</div>
                        <div className="cm-nc-member-info">
                          <div className="cm-nc-member-name">{highlight(m.name, q)}</div>
                          <div className="cm-nc-member-rel">{highlight(m.rel, q)} · <span style={{ fontSize: 10, color: 'var(--brand-primary)', fontWeight: 700 }}>{highlight(m.groupName, q)}</span></div>
                        </div>
                        <i className={`cm-nc-member-icon fa-solid ${m.appUser ? 'fa-comment-dots on' : 'fa-ban off'}`} />
                      </div>
                    ))}
                  </>
                )}
              </div>
            )
          ) : !groupObj ? (
            /* Step 1: class list */
            <>
              <div style={{ padding: '10px 16px 6px', fontSize: 10.5, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.6px' }}>Choose a Class or Group</div>
              <div style={{ padding: '0 12px 14px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {CLASS_GROUPS.map(g => (
                  <div key={g.id} className="cm-nc-class-card" onClick={() => setGroup(g.id)}>
                    <div className="cm-nc-class-count">{g.count}</div>
                    <div className="cm-nc-class-name">{g.name}</div>
                    <div className="cm-nc-class-sub">{g.count} member{g.count !== 1 ? 's' : ''}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* Step 2: member list */
            <>
              <div style={{ padding: '10px 14px 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <button className="cm-nc-back-btn" onClick={() => setGroup(null)}><i className="fa-solid fa-arrow-left" /> Back</button>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{groupObj.name}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, padding: '2px 14px 8px', fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--brand-light)', border: '1.5px solid var(--brand-primary)', display: 'inline-block' }} /> App active — can chat</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#f1f5f9', border: '1.5px solid #CBD5E1', display: 'inline-block' }} /> Not logged in</span>
              </div>
              <div style={{ padding: '0 12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...(GROUP_MEMBERS[group] || [])].sort((a, b) => b.appUser - a.appUser).map((m, i) => (
                  <div key={`${m.name}-${i}`} className={`cm-nc-member-row ${m.appUser ? 'on' : 'off'}`} onClick={() => handleMember(m, groupObj.name)}>
                    <div className={`cm-nc-member-av ${m.appUser ? 'on' : 'off'}`}>{ini(m.name)}</div>
                    <div className="cm-nc-member-info">
                      <div className="cm-nc-member-name">{m.name}</div>
                      <div className="cm-nc-member-rel">{m.rel}</div>
                    </div>
                    <i className={`cm-nc-member-icon fa-solid ${m.appUser ? 'fa-comment-dots on' : 'fa-ban off'}`} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CSS — ported from the design, namespaced under .cm-* so it never
   collides with the global ERP shell styles (the modal shell reuses
   the global .modal-overlay/.modal classes, which are .open-gated).
   ═══════════════════════════════════════════════════════════════════ */
const CHAT_CSS = `
@keyframes cmFadeSlide { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
@keyframes cmRecWave { 0%,100%{height:6px;opacity:.5} 50%{height:22px;opacity:1} }
@keyframes cmPulseRec { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.85)} }

.cm-root { display:flex; flex-direction:column; height:calc(100vh - var(--topbar-h) - 48px); min-height:480px; margin:-24px -28px; background:var(--bg-card); }

/* page header */
.cm-page-header { padding:13px 22px 11px; flex-shrink:0; border-bottom:1px solid var(--border-light); background:var(--bg-card); display:flex; align-items:center; gap:14px; }
.cm-page-header-icon { width:52px; height:52px; border-radius:14px; background:linear-gradient(135deg,var(--brand-primary),var(--brand-deeper,#1E3A8A)); display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 4px 14px rgba(30,58,138,.3); color:#fff; font-size:20px; }
.cm-page-title { font-size:27px; font-weight:800; color:var(--text-primary); line-height:1.15; letter-spacing:-.03em; display:flex; align-items:center; }
.cm-page-kicker { font-size:12px; font-weight:700; color:var(--brand-primary); letter-spacing:.04em; text-transform:uppercase; margin-top:3px; opacity:.8; }
.cm-page-sub { font-size:13px; color:var(--text-muted); margin-top:4px; font-weight:500; }
.cm-unread-global { background:var(--error,#DC2626); color:#fff; border-radius:var(--radius-full); padding:2px 9px; font-size:11px; font-weight:800; margin-left:8px; }

/* 2-column grid */
.cm-dashboard { display:grid; grid-template-columns:310px 1fr; flex:1; min-height:0; overflow:hidden; border-top:1px solid var(--border-light); }
.cm-col { display:flex; flex-direction:column; border-right:1px solid var(--border-light); overflow:hidden; min-width:0; height:100%; }
.cm-col:last-child { border-right:none; }
.cm-col-body { flex:1; overflow-y:auto; scrollbar-width:thin; scrollbar-color:var(--border-med) transparent; }
.cm-col-body::-webkit-scrollbar { width:3px; }
.cm-col-body::-webkit-scrollbar-thumb { background:var(--border-med); border-radius:2px; }

/* new chat button */
.cm-sidebar-top { padding:11px 12px 9px; border-bottom:1px solid var(--border-light); flex-shrink:0; display:flex; align-items:center; gap:8px; }
.cm-new-chat-btn { flex:1; display:flex; align-items:center; justify-content:center; gap:7px; padding:9px 14px; border-radius:var(--radius-md); border:none; background:linear-gradient(135deg,var(--brand-primary),var(--brand-deeper,#1E3A8A)); color:#fff; font-family:var(--font-body); font-size:12.5px; font-weight:700; cursor:pointer; transition:var(--tr); box-shadow:0 2px 8px rgba(30,58,138,.22); }
.cm-new-chat-btn:hover { box-shadow:0 4px 14px rgba(30,58,138,.38); transform:translateY(-1px); }

/* sidebar search */
.cm-sidebar-search-wrap { padding:9px 11px; border-bottom:1px solid var(--border-light); flex-shrink:0; }
.cm-sidebar-search-box { display:flex; align-items:center; gap:8px; background:var(--bg-muted); border:1.5px solid var(--border-light); border-radius:var(--radius-full); padding:8px 13px; transition:var(--tr); }
.cm-sidebar-search-box:focus-within { border-color:var(--brand-primary); background:var(--bg-card); box-shadow:0 0 0 3px rgba(30,58,138,.08); }
.cm-sidebar-search-icon { color:var(--text-muted); font-size:12px; flex-shrink:0; transition:var(--tr); }
.cm-sidebar-search-box:focus-within .cm-sidebar-search-icon { color:var(--brand-primary); }
.cm-sidebar-search-input { border:none; background:transparent; font-family:var(--font-body); font-size:12.5px; color:var(--text-primary); outline:none; flex:1; min-width:0; }
.cm-sidebar-search-input::placeholder { color:var(--text-muted); font-size:12px; }
.cm-sidebar-search-clear { width:18px; height:18px; border-radius:50%; background:var(--text-muted); color:#fff; border:none; cursor:pointer; font-size:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:var(--tr); padding:0; }
.cm-sidebar-search-clear:hover { background:var(--brand-primary); }
.search-highlight { background:rgba(30,58,138,.15); color:var(--brand-primary); border-radius:3px; padding:0 2px; font-weight:700; }

.cm-rcr-label { padding:6px 14px 4px; font-size:9.5px; font-weight:800; color:var(--brand-primary); text-transform:uppercase; letter-spacing:.7px; flex-shrink:0; }

.cm-sidebar-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:30px 20px; text-align:center; }
.cm-sidebar-empty i { font-size:28px; color:var(--border-med); margin-bottom:10px; }
.cm-sidebar-empty-title { font-size:13px; font-weight:700; color:var(--text-primary); margin-bottom:4px; }
.cm-sidebar-empty-sub { font-size:11.5px; color:var(--text-muted); line-height:1.5; }

/* recent chat rows */
.cm-recent-row { display:flex; align-items:center; gap:11px; padding:10px 14px; border-bottom:1px solid var(--border-light); cursor:pointer; transition:var(--tr); position:relative; }
.cm-recent-row:last-child { border-bottom:none; }
.cm-recent-row:hover { background:var(--bg-muted); }
.cm-recent-row.active { background:linear-gradient(135deg,var(--brand-light),rgba(219,234,254,.5)); border-right:3px solid var(--brand-primary); }
[data-theme="dark"] .cm-recent-row.active { background:rgba(30,58,138,.18); }
.cm-rcr-avatar { width:40px; height:40px; border-radius:50%; color:#fff; font-size:12px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; position:relative; background:linear-gradient(135deg,var(--brand-primary),var(--brand-deeper,#1E3A8A)); }
.cm-rcr-dot { position:absolute; bottom:0; right:0; width:10px; height:10px; border-radius:50%; border:2px solid var(--bg-card); }
.cm-rcr-dot.on { background:#22C55E; }
.cm-rcr-dot.off { background:#94A3B8; }
.cm-rcr-info { flex:1; min-width:0; }
.cm-rcr-name-row { display:flex; align-items:center; gap:5px; margin-bottom:1px; }
.cm-rcr-name { font-size:13px; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cm-rcr-badge { background:var(--brand-light); color:var(--brand-primary); border:1px solid var(--border-light); border-radius:var(--radius-full); padding:1px 7px; font-size:9px; font-weight:800; white-space:nowrap; flex-shrink:0; }
.cm-rcr-father { font-size:10.5px; color:var(--text-muted); margin-bottom:2px; }
.cm-rcr-preview { font-size:11px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cm-rcr-meta { display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0; }
.cm-rcr-time { font-size:10px; color:var(--text-muted); white-space:nowrap; }
.cm-rcr-unread { background:var(--brand-primary); color:#fff; border-radius:var(--radius-full); padding:1px 6px; font-size:9.5px; font-weight:800; min-width:18px; text-align:center; }

/* conversation panel */
.cm-conv-panel { display:flex; flex-direction:column; height:100%; width:100%; background:#EEF2FB; overflow:hidden; }
[data-theme="dark"] .cm-conv-panel { background:#080D1A; }
.cm-conv-empty { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px; text-align:center; }
.cm-conv-empty-icon { width:64px; height:64px; border-radius:18px; background:var(--brand-light); color:var(--brand-primary); display:flex; align-items:center; justify-content:center; font-size:28px; margin:0 auto 14px; }
.cm-conv-empty-title { font-size:16px; font-weight:800; color:var(--text-primary); margin-bottom:6px; }
.cm-conv-empty-sub { font-size:12.5px; color:var(--text-muted); line-height:1.6; max-width:240px; }

/* conv header */
.cm-conv-header { padding:11px 18px; border-bottom:1px solid var(--border-light); background:var(--bg-card); display:flex; align-items:center; gap:12px; flex-shrink:0; }
.cm-conv-back { display:none; width:32px; height:32px; border-radius:var(--radius-md); border:1.5px solid var(--border-light); background:transparent; color:var(--text-muted); align-items:center; justify-content:center; cursor:pointer; font-size:14px; flex-shrink:0; transition:var(--tr); }
.cm-conv-back:hover { border-color:var(--brand-primary); color:var(--brand-primary); background:var(--brand-light); }
.cm-conv-hdr-avatar { width:40px; height:40px; border-radius:50%; background:linear-gradient(135deg,var(--brand-primary),var(--brand-deeper,#1E3A8A)); color:#fff; font-size:13px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; position:relative; }
.cm-conv-hdr-dot { position:absolute; bottom:0; right:0; width:10px; height:10px; border-radius:50%; border:2px solid var(--bg-card); }
.cm-conv-hdr-dot.on { background:#22C55E; }
.cm-conv-hdr-dot.off { background:#94A3B8; }
.cm-conv-hdr-info { flex:1; min-width:0; }
.cm-conv-hdr-name { font-size:14px; font-weight:800; color:var(--text-primary); line-height:1.2; }
.cm-conv-hdr-sub { font-size:11px; color:var(--text-muted); margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cm-conv-hdr-badge { background:var(--brand-light); color:var(--brand-primary); border:1px solid var(--border-light); border-radius:var(--radius-full); padding:3px 11px; font-size:11px; font-weight:700; flex-shrink:0; }
.cm-conv-hdr-search { width:30px; height:30px; border-radius:var(--radius-md); border:1.5px solid var(--border-light); background:transparent; color:var(--text-muted); display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:12px; transition:var(--tr); flex-shrink:0; }
.cm-conv-hdr-search:hover, .cm-conv-hdr-search.active { border-color:var(--brand-primary); color:var(--brand-primary); background:var(--brand-light); }

/* in-chat search bar */
.cm-conv-search-bar { display:flex; align-items:center; gap:8px; padding:8px 16px; background:var(--brand-light); border-bottom:1px solid var(--border-light); flex-shrink:0; animation:cmFadeSlide .18s ease; }
.cm-conv-search-inner { flex:1; display:flex; align-items:center; gap:8px; background:var(--bg-card); border:1.5px solid var(--brand-primary); border-radius:var(--radius-full); padding:7px 14px; box-shadow:0 0 0 3px rgba(30,58,138,.08); }
.cm-conv-search-inner i { color:var(--brand-primary); font-size:12px; flex-shrink:0; }
.cm-conv-search-input { border:none; background:transparent; font-family:var(--font-body); font-size:13px; color:var(--text-primary); outline:none; flex:1; min-width:0; }
.cm-conv-search-input::placeholder { color:var(--text-muted); }
.cm-conv-search-counter { font-size:11px; font-weight:700; color:var(--brand-primary); white-space:nowrap; flex-shrink:0; min-width:40px; text-align:right; }
.cm-conv-search-nav { display:flex; gap:3px; }
.cm-conv-search-nav-btn { width:28px; height:28px; border-radius:var(--radius-md); border:1.5px solid var(--border-light); background:var(--bg-card); color:var(--text-muted); display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:11px; transition:var(--tr); }
.cm-conv-search-nav-btn:hover:not(:disabled) { border-color:var(--brand-primary); color:var(--brand-primary); background:var(--brand-light); }
.cm-conv-search-nav-btn:disabled { opacity:.35; cursor:not-allowed; }
.cm-conv-search-close { width:28px; height:28px; border-radius:50%; border:none; background:transparent; color:var(--text-muted); display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:13px; transition:var(--tr); }
.cm-conv-search-close:hover { color:var(--error,#DC2626); }
.cm-msg-search-match > .cm-bubble, .cm-msg-search-match > div > .cm-bubble { outline:2px solid var(--brand-primary); outline-offset:1px; border-radius:14px; }
.cm-msg-search-active > .cm-bubble, .cm-msg-search-active > div > .cm-bubble { outline:3px solid var(--brand-deeper,#1E3A8A); outline-offset:2px; }

/* messages */
.cm-conv-msgs { flex:1; overflow-y:auto; padding:16px 20px; display:flex; flex-direction:column; gap:10px; scrollbar-width:thin; scrollbar-color:var(--border-light) transparent; background:#EEF2FB; }
[data-theme="dark"] .cm-conv-msgs { background:#080D1A; }
.cm-conv-msgs::-webkit-scrollbar { width:4px; }
.cm-conv-msgs::-webkit-scrollbar-thumb { background:var(--border-med); border-radius:2px; }
.cm-msg-date-sep { align-self:center; font-size:10.5px; font-weight:700; color:var(--brand-primary); background:var(--brand-light); border:1px solid var(--border-light); border-radius:var(--radius-full); padding:3px 14px; margin:4px 0; }

.cm-msg-recv { align-self:flex-start; max-width:68%; display:flex; gap:8px; }
.cm-msg-recv-av { width:28px; height:28px; border-radius:50%; background:linear-gradient(135deg,var(--brand-primary),var(--brand-deeper,#1E3A8A)); color:#fff; font-size:9px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:auto; }
.cm-msg-recv .cm-bubble { background:#F0F4FF; border:1px solid #C7D7FD; color:var(--text-primary); padding:9px 14px; border-radius:14px 14px 14px 4px; font-size:13px; line-height:1.55; box-shadow:0 1px 4px rgba(30,58,138,.1); }
[data-theme="dark"] .cm-msg-recv .cm-bubble { background:#131F38; border-color:#1C2E50; color:#E2E8F8; }
.cm-msg-sent { align-self:flex-end; max-width:68%; }
.cm-msg-sent .cm-bubble { background:linear-gradient(135deg,var(--brand-primary),var(--brand-deeper,#1E3A8A)); color:#fff; padding:8px 13px; border-radius:14px 14px 4px 14px; font-size:13px; line-height:1.55; box-shadow:0 2px 8px rgba(30,58,138,.2); }
.cm-msg-meta { font-size:10px; color:var(--text-muted); margin-top:3px; display:flex; align-items:center; gap:3px; }
.cm-msg-sent .cm-msg-meta { justify-content:flex-end; }
.cm-msg-recv .cm-msg-meta { padding-left:34px; }

/* voice bubble */
.cm-attach-voice { display:flex; align-items:center; gap:8px; padding:9px 13px; background:var(--brand-light); border:1.5px solid var(--brand-primary); border-radius:12px; min-width:220px; cursor:pointer; transition:var(--tr); }
.cm-attach-voice:hover { box-shadow:0 2px 8px rgba(30,58,138,.15); }
.cm-attach-voice-btn { width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg,var(--brand-primary),var(--brand-deeper,#1E3A8A)); color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; flex-shrink:0; box-shadow:0 2px 6px rgba(30,58,138,.3); }
.cm-attach-waveform { flex:1; height:22px; display:flex; align-items:center; gap:2px; }
.cm-attach-waveform span { display:inline-block; background:var(--brand-primary); border-radius:2px; width:3px; opacity:.8; }
.cm-attach-voice-dur { font-size:11px; font-weight:700; color:var(--brand-primary); flex-shrink:0; }

/* image bubble */
.cm-attach-image { border-radius:10px; overflow:hidden; max-width:200px; border:1px solid var(--border-light); cursor:pointer; position:relative; }
.cm-attach-image-inner { width:100%; height:120px; background:linear-gradient(135deg,#BFDBFE,#93C5FD); display:flex; align-items:center; justify-content:center; flex-direction:column; gap:4px; }
.cm-attach-image-inner i { font-size:24px; color:var(--brand-primary); opacity:.85; }
.cm-attach-image-inner span { font-size:11px; color:var(--brand-primary); font-weight:600; }
.cm-attach-image-overlay { position:absolute; inset:0; background:rgba(0,0,0,.28); display:flex; align-items:center; justify-content:center; opacity:0; transition:var(--tr); }
.cm-attach-image:hover .cm-attach-image-overlay { opacity:1; }
.cm-attach-image-overlay i { color:#fff; font-size:20px; }

/* gallery */
.cm-img-gallery { display:grid; grid-template-columns:repeat(3,80px); gap:4px; border-radius:10px; overflow:hidden; max-width:248px; cursor:pointer; }
.cm-img-gallery-cell { position:relative; width:80px; height:80px; background:linear-gradient(135deg,#BFDBFE,#93C5FD); display:flex; align-items:center; justify-content:center; overflow:hidden; }
.cm-img-gallery-cell i { font-size:20px; color:var(--brand-primary); opacity:.8; }
.cm-img-gallery-more { position:absolute; inset:0; background:rgba(30,58,138,.62); color:#fff; font-size:16px; font-weight:800; display:flex; align-items:center; justify-content:center; }

/* video bubble */
.cm-attach-video { border-radius:10px; overflow:hidden; max-width:200px; border:1px solid var(--border-light); cursor:pointer; position:relative; }
.cm-attach-video-inner { width:100%; height:120px; background:linear-gradient(135deg,var(--brand-primary),var(--brand-deeper,#1E3A8A)); display:flex; align-items:center; justify-content:center; flex-direction:column; gap:6px; }
.cm-attach-video-play { width:38px; height:38px; border-radius:50%; background:rgba(255,255,255,.2); border:2px solid rgba(255,255,255,.5); color:#fff; display:flex; align-items:center; justify-content:center; font-size:14px; }
.cm-attach-video-inner span { font-size:11px; color:rgba(255,255,255,.85); font-weight:600; }

/* doc bubble */
.cm-attach-doc { display:flex; align-items:center; gap:10px; padding:10px 13px; background:var(--bg-muted); border:1px solid var(--border-light); border-radius:10px; cursor:pointer; transition:var(--tr); min-width:200px; }
.cm-attach-doc:hover { border-color:var(--brand-primary); }
.cm-attach-doc-icon { width:34px; height:34px; border-radius:8px; background:rgba(220,38,38,.1); color:#DC2626; display:flex; align-items:center; justify-content:center; font-size:15px; flex-shrink:0; }
.cm-attach-doc-info { flex:1; min-width:0; }
.cm-attach-doc-name { font-size:12px; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cm-attach-doc-size { font-size:10px; color:var(--text-muted); margin-top:1px; }

/* composer */
.cm-conv-composer { padding:10px 14px 12px; border-top:1px solid var(--border-light); background:var(--bg-card); flex-shrink:0; }
.cm-conv-input-row { display:flex; align-items:center; gap:7px; position:relative; }
.cm-attach-trigger { width:34px; height:34px; border-radius:50%; border:1.5px solid var(--border-light); background:var(--bg-muted); color:var(--text-muted); display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:14px; transition:var(--tr); flex-shrink:0; }
.cm-attach-trigger:hover { border-color:var(--brand-primary); color:var(--brand-primary); background:var(--brand-light); }
.cm-attach-popup { position:absolute; bottom:44px; left:0; background:var(--bg-card); border:1.5px solid var(--border-light); border-radius:var(--radius-lg); box-shadow:var(--shadow-lg); padding:6px; z-index:50; min-width:160px; animation:cmFadeSlide .15s ease; }
.cm-attach-popup-item { display:flex; align-items:center; gap:9px; padding:8px 12px; border-radius:var(--radius-md); cursor:pointer; font-size:12.5px; font-weight:600; color:var(--text-secondary); transition:var(--tr); }
.cm-attach-popup-item:hover { background:var(--brand-light); color:var(--brand-primary); }
.cm-attach-popup-item i { width:16px; text-align:center; font-size:13px; }
.cm-conv-txt-input { flex:1; border:1.5px solid var(--border-light); border-radius:var(--radius-full); padding:9px 16px; font-family:var(--font-body); font-size:13px; background:var(--bg-muted); color:var(--text-primary); outline:none; transition:var(--tr); min-width:0; }
.cm-conv-txt-input:focus { border-color:var(--brand-primary); box-shadow:0 0 0 3px rgba(30,58,138,.08); }
.cm-conv-mic-btn { width:34px; height:34px; border-radius:50%; border:1.5px solid var(--border-light); background:var(--bg-muted); color:var(--text-muted); display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:13px; transition:var(--tr); flex-shrink:0; }
.cm-conv-mic-btn:hover { border-color:var(--brand-primary); color:var(--brand-primary); background:var(--brand-light); }
.cm-conv-send-btn { width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg,var(--brand-primary),var(--brand-deeper,#1E3A8A)); color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:14px; border:none; box-shadow:0 2px 8px rgba(30,58,138,.3); transition:var(--tr); flex-shrink:0; }
.cm-conv-send-btn:hover { transform:scale(1.08); box-shadow:0 4px 12px rgba(30,58,138,.4); }

/* recording UI */
.cm-recording-row { display:flex; align-items:center; gap:10px; padding:8px 14px 10px; border-top:1px solid var(--border-light); background:var(--bg-card); flex-shrink:0; }
.cm-rec-cancel { width:30px; height:30px; border-radius:50%; border:1.5px solid rgba(220,38,38,.3); background:rgba(220,38,38,.06); color:#DC2626; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:12px; transition:var(--tr); }
.cm-rec-cancel:hover { background:rgba(220,38,38,.12); }
.cm-rec-waveform { flex:1; height:28px; display:flex; align-items:center; gap:2px; overflow:hidden; }
.cm-rec-waveform span { display:inline-block; background:var(--brand-primary); border-radius:2px; width:3px; min-height:4px; animation:cmRecWave .7s ease-in-out infinite; }
.cm-rec-timer { font-size:13px; font-weight:700; color:var(--brand-primary); flex-shrink:0; font-variant-numeric:tabular-nums; }
.cm-rec-dot { width:10px; height:10px; border-radius:50%; background:#DC2626; animation:cmPulseRec 1s ease infinite; flex-shrink:0; }
.cm-rec-send { display:flex; align-items:center; gap:6px; padding:6px 14px; border-radius:var(--radius-full); background:linear-gradient(135deg,var(--brand-primary),var(--brand-deeper,#1E3A8A)); color:#fff; font-family:var(--font-body); font-size:12px; font-weight:700; border:none; cursor:pointer; transition:var(--tr); }
.cm-rec-send:hover { box-shadow:0 3px 10px rgba(30,58,138,.35); }

/* new chat modal contents */
.cm-nc-search-box { display:flex; align-items:center; gap:8px; background:var(--bg-muted); border:1.5px solid var(--border-light); border-radius:var(--radius-full); padding:9px 14px; transition:var(--tr); }
.cm-nc-search-box:focus-within { border-color:var(--brand-primary); background:var(--bg-card); box-shadow:0 0 0 3px rgba(30,58,138,.08); }
.cm-nc-search-box i { color:var(--text-muted); font-size:12px; flex-shrink:0; transition:var(--tr); }
.cm-nc-search-box:focus-within i { color:var(--brand-primary); }
.cm-nc-search-input { border:none; background:transparent; font-family:var(--font-body); font-size:13px; color:var(--text-primary); outline:none; flex:1; min-width:0; }
.cm-nc-search-input::placeholder { color:var(--text-muted); }
.cm-nc-search-clear { width:18px; height:18px; border-radius:50%; background:var(--text-muted); color:#fff; border:none; cursor:pointer; font-size:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:var(--tr); padding:0; }
.cm-nc-search-clear:hover { background:var(--brand-primary); }
.cm-nc-group-label { font-size:10px; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:.5px; padding:6px 2px 3px; }
.cm-nc-class-card { background:var(--bg-muted); border:1.5px solid var(--border-light); border-radius:var(--radius-lg); padding:13px 10px; cursor:pointer; transition:var(--tr); display:flex; flex-direction:column; align-items:center; gap:5px; text-align:center; }
.cm-nc-class-card:hover { border-color:var(--brand-primary); background:var(--brand-light); transform:translateY(-2px); box-shadow:0 4px 12px rgba(30,58,138,.14); }
.cm-nc-class-count { width:36px; height:36px; border-radius:9px; background:linear-gradient(135deg,var(--brand-primary),var(--brand-deeper,#1E3A8A)); color:#fff; font-size:14px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.cm-nc-class-name { font-size:12.5px; font-weight:700; color:var(--text-primary); }
.cm-nc-class-sub { font-size:10px; color:var(--text-muted); }
.cm-nc-back-btn { display:flex; align-items:center; gap:6px; background:var(--brand-light); border:1px solid var(--border-light); color:var(--brand-primary); border-radius:var(--radius-full); padding:5px 14px; font-size:12px; font-weight:700; cursor:pointer; transition:var(--tr); }
.cm-nc-back-btn:hover { box-shadow:var(--shadow-xs); }
.cm-nc-member-row { display:flex; align-items:center; gap:10px; padding:9px 12px; border-radius:var(--radius-md); border:1.5px solid var(--border-light); transition:var(--tr); background:var(--bg-muted); }
.cm-nc-member-row.on { cursor:pointer; }
.cm-nc-member-row.off { opacity:.55; cursor:not-allowed; }
.cm-nc-member-row.on:hover { border-color:var(--brand-primary); background:var(--brand-light); }
.cm-nc-member-av { width:34px; height:34px; border-radius:50%; color:#fff; font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.cm-nc-member-av.on { background:linear-gradient(135deg,var(--brand-primary),var(--brand-deeper,#1E3A8A)); }
.cm-nc-member-av.off { background:linear-gradient(135deg,#94A3B8,#CBD5E1); }
.cm-nc-member-info { flex:1; min-width:0; }
.cm-nc-member-name { font-size:13px; font-weight:700; color:var(--text-primary); }
.cm-nc-member-rel { font-size:11px; color:var(--text-muted); margin-top:1px; }
.cm-nc-member-icon { font-size:13px; flex-shrink:0; }
.cm-nc-member-icon.on { color:var(--brand-primary); }
.cm-nc-member-icon.off { color:#94A3B8; }
.cm-nc-empty { display:flex; flex-direction:column; align-items:center; padding:32px 20px; text-align:center; }
.cm-nc-empty i { font-size:30px; color:var(--border-med); margin-bottom:10px; }
.cm-nc-empty-title { font-size:14px; font-weight:700; color:var(--text-primary); margin-bottom:5px; }
.cm-nc-empty-sub { font-size:12px; color:var(--text-muted); line-height:1.6; }

/* ── Tablet: keep both panels but a slightly narrower list ── */
@media(max-width:860px) and (min-width:769px){
  .cm-dashboard { grid-template-columns:270px 1fr; }
  .cm-root { margin:-20px; height:calc(100vh - var(--topbar-h) - 40px); }
}

/* ── Mobile (≤768px): single panel — list ↔ conversation ── */
@media(max-width:768px){
  .cm-root { margin:-20px; height:calc(100vh - var(--topbar-h) - 40px); }

  /* Compact the page header so the chat area keeps its room */
  .cm-page-header { padding:11px 16px; gap:11px 11px; flex-wrap:wrap; }
  .cm-page-header-icon { width:42px; height:42px; font-size:17px; }
  .cm-page-title { font-size:20px; }
  .cm-page-kicker, .cm-page-sub { display:none; }
  /* Tutorial button → its own full-width row (matches the rest of the ERP) */
  .cm-page-header .page-tutorial-btn { order:3; width:100%; justify-content:center; }

  /* One column; show only the active panel */
  .cm-dashboard { grid-template-columns:1fr; grid-template-rows:1fr; }
  .cm-col { border-right:none; }
  .cm-col-conv { display:none; }
  .cm-dashboard.cm-show-conv .cm-col-list { display:none; }
  .cm-dashboard.cm-show-conv .cm-col-conv { display:flex; }

  /* Back button + give bubbles a little more width */
  .cm-conv-back { display:flex; }
  .cm-conv-hdr-badge { display:none; }   /* class is already in the sub line */
  .cm-conv-header { padding:10px 14px; gap:10px; }
  .cm-msg-recv, .cm-msg-sent { max-width:80%; }
}

@media(max-width:480px){
  .cm-root { margin:-16px; height:calc(100vh - var(--topbar-h) - 32px); }
  .cm-conv-msgs { padding:14px 14px; }
  .cm-recent-row { padding:10px 12px; }
  .cm-msg-recv, .cm-msg-sent { max-width:86%; }
  .cm-conv-composer { padding:9px 10px 11px; }
  .cm-conv-input-row { gap:6px; }
}
`;
