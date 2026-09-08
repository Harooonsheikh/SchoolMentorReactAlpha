import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import TutorialModal from '../../components/TutorialModal';
import {
  chatUserId,
  chatBranchId,
  fetchChatContacts,
  fetchContactList,
  fetchAppUserIds,
  fetchUnseenCount,
  fetchConversation,
  fetchUnseenFromMe,
  pendingMessage,
  postChatMessage,
  markMessagesSeen,
} from '../../services/chatService';

/* ═══════════════════════════════════════════════════════════════════
   CHAT — school messaging (parents · students · teachers), live API.

   Data poora API se aata hai (swagger tag "Chats") — dekhein
   src/erp/services/chatService.js:

     sidebar (recent)   → get-chat-contacts/{branchId}/{userId}
     conversation       → get-conversation/{me}/{contact}/{branchId}
     bhejna             → post-chat-message   (multipart)
     seen karna         → mark-messages-seen/{branchId}/{contact}/{me}
     nav badge          → get-unseen-chat-count/{branchId}/{userId}
     New Chat directory → get-contact-list/{branchId}/{userId}
     app par logged in? → get-users-fcm-status/{branchID}

   ── Do baatein jo screen ka dhancha tay karti hain ──
   1. Har cheez USER ID par chalti hai, naam par nahi: ek hi walid ke kai
      bachay hote hain (get-chat-contacts har bachay ki alag row deti hai)
      aur naam khali bhi ho sakta hai. Is liye active chat, history map aur
      sidebar keys sab `userId` par hain.
   2. Server push (SignalR) is API me nahi hai, is liye naye messages POLL
      hote hain — har POLL_MS par contacts + khuli conversation dobara.
      Tab background me ho to poll rukh jata hai.

   Presence (online dot) API me nahi hai; jo nishan dikhta hai wo "app par
   logged in hai ya nahi" hai (FCM token), aur wahi New Chat me bhi.
   ═══════════════════════════════════════════════════════════════════ */

const POLL_MS = 15000;
/* Sidebar ka preview/waqt conversation se banta hai, aur har contact ki apni
   call hai — is liye load par sirf itni chats ka preview lete hain. Baqi ka
   preview chat kholne par bhar jata hai. */
const PREVIEW_LIMIT = 40;
const PREVIEW_BATCH = 6;

/* ── helpers ── */
const ini = (n) => (n || '?').split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

const lastOf = (hist) => (hist && hist.length ? hist[hist.length - 1] : null);

const lastPreview = (hist) => {
  const last = lastOf(hist);
  if (!last) return 'No messages yet';
  const caption = last.text ? ` ${last.text}` : '';
  if (last.attach === 'voice') return '🎤 Voice message';
  if (last.attach === 'image') return `📷${caption || ' Photo'}`;
  if (last.attach === 'video') return `🎬${caption || ' Video'}`;
  if (last.attach === 'doc')   return `📄${caption || ` ${last.docName}`}`;
  return last.text || 'No messages yet';
};

/* searchable text content of a message (for in-chat search) */
const msgText = (m) => m.text || m.docName || m.label || '';

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

/* Voice note ke liye wo format chuno jo ye browser record kar sakta hai.
   Extension isi se banti hai taake attachmentType sahi jaye (webm audio ko
   "weba" bhejte hain, warna wo video samjha jata hai). */
function pickAudioFormat() {
  const options = [
    ['audio/mp4', 'm4a'],
    ['audio/ogg;codecs=opus', 'ogg'],
    ['audio/webm;codecs=opus', 'weba'],
    ['audio/webm', 'weba'],
  ];
  if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
    for (const [mime, ext] of options) {
      if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
    }
  }
  return { mime: '', ext: 'weba' };
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════════════════ */
export default function Chat({ toast = () => {}, onUnreadChange, chatMode }) {
  const me = useMemo(() => chatUserId(), []);
  const branchId = useMemo(() => chatBranchId(), []);

  const [contacts, setContacts] = useState([]);
  const [history, setHistory]   = useState({});     // { [userId]: message[] }
  /* { [contactId]: kitni MERI messages us ne nahi dekhin } — blue tick isi se
     tay hota hai. null = maloom nahi (tab blue tick nahi dikhate). */
  const [receipts, setReceipts] = useState({});
  const [appUsers, setAppUsers] = useState(() => new Set());
  const [activeId, setActiveId] = useState(null);

  const [loading, setLoading]         = useState(true);
  const [loadError, setLoadError]     = useState('');
  const [convLoading, setConvLoading] = useState(false);
  const [sending, setSending]         = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);

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
  const activeRef = useRef(activeId);
  activeRef.current = activeId;
  /* App ka pushToast har render par naya function hota hai — usay seedha deps
     me rakhne se ye saare callbacks (aur polling interval) har render par naye
     ban jate. Ref se function sthir rehta hai aur toast hamesha taza. */
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const previewDone = useRef(new Set());   // jin contacts ka preview le liya
  const fileInputs = { image: useRef(null), video: useRef(null), doc: useRef(null) };
  const recRef = useRef(null);
  const chunksRef = useRef([]);

  const activeChat = useMemo(
    () => contacts.find(c => c.userId === activeId) || null,
    [contacts, activeId],
  );
  const activeMsgs = useMemo(() => history[activeId] || [], [history, activeId]);

  /* ── loaders ─────────────────────────────────────────────────── */

  const refreshUnread = useCallback(async () => {
    if (!me || !branchId) return;
    setUnreadTotal(await fetchUnseenCount(branchId, me));
  }, [me, branchId]);

  const loadContacts = useCallback(async ({ silent = false } = {}) => {
    if (!me || !branchId) {
      setLoadError('Your session has no user or branch — please log in again.');
      setLoading(false);
      return [];
    }
    if (!silent) setLoading(true);
    try {
      const rows = await fetchChatContacts(branchId, me);
      /* New Chat se shuru ki gayi chat jab tak koi message na jaye API me
         nahi aati — usay list se gayab nahi hone dena. */
      setContacts(prev => {
        const extra = prev.filter(c => c.provisional && !rows.some(r => r.userId === c.userId));
        return [...rows, ...extra];
      });
      setLoadError('');
      return rows;
    } catch (err) {
      setLoadError(err.message || 'Could not load chats');
      if (!silent) toastRef.current(err.message || 'Could not load chats', 'error');
      return [];
    } finally {
      if (!silent) setLoading(false);
    }
  }, [me, branchId]);

  const loadConversation = useCallback(async (userId, { spinner = false } = {}) => {
    if (!userId || !me || !branchId) return;
    if (spinner) setConvLoading(true);
    try {
      /* messages ke saath hi read-receipt — dono ek hi baar me, taake tick
         message ke saath hi sahi rang me aaye. */
      const [msgs, unseenFromMe] = await Promise.all([
        fetchConversation(me, userId, branchId),
        fetchUnseenFromMe(branchId, userId, me),
      ]);
      setHistory(prev => ({ ...prev, [userId]: msgs }));
      setReceipts(prev => ({ ...prev, [userId]: unseenFromMe }));
      previewDone.current.add(userId);
    } catch (err) {
      if (spinner) toastRef.current(err.message || 'Could not load this conversation', 'error');
    } finally {
      if (spinner) setConvLoading(false);
    }
  }, [me, branchId]);

  /* first load: recent chats + kaun app par logged in hai + nav badge */
  useEffect(() => {
    let alive = true;
    (async () => {
      const [rows] = await Promise.all([loadContacts(), (async () => {
        const ids = await fetchAppUserIds(branchId);
        if (alive) setAppUsers(ids);
      })()]);
      if (alive && rows.length) setActiveId(prev => prev ?? rows[0].userId);
      refreshUnread();
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Chat khulte hi: messages lao, phir unhe "seen" kar do. Pehli chat khud
     select hoti hai, is liye ye kaam openConv me nahi — yahan hai, taake dono
     surton me chale. mark-messages-seen idempotent hai (kuch na ho to
     updatedRows 0), so dobara chalna nuqsaan-deh nahi. */
  useEffect(() => {
    if (!activeId || !me || !branchId) return undefined;
    let alive = true;
    (async () => {
      await loadConversation(activeId, { spinner: !previewDone.current.has(activeId) });
      if (!alive) return;
      await markMessagesSeen(branchId, activeId, me);
      if (alive) refreshUnread();
    })();
    return () => { alive = false; };
  }, [activeId, me, branchId, loadConversation, refreshUnread]);

  /* sidebar ka preview + waqt conversation se banta hai — pehli PREVIEW_LIMIT
     chats ke liye thodi thodi kar ke le aao (ek saath sab nahi). */
  useEffect(() => {
    const pending = contacts
      .filter(c => !previewDone.current.has(c.userId))
      .slice(0, PREVIEW_LIMIT);
    if (!pending.length) return;
    let alive = true;
    (async () => {
      for (let i = 0; i < pending.length; i += PREVIEW_BATCH) {
        if (!alive) return;
        const batch = pending.slice(i, i + PREVIEW_BATCH);
        batch.forEach(c => previewDone.current.add(c.userId));
        const results = await Promise.all(batch.map(c =>
          fetchConversation(me, c.userId, branchId).then(msgs => [c.userId, msgs]).catch(() => null)));
        if (!alive) return;
        setHistory(prev => {
          const next = { ...prev };
          results.filter(Boolean).forEach(([id, msgs]) => { next[id] = msgs; });
          return next;
        });
      }
    })();
    return () => { alive = false; };
  }, [contacts, me, branchId]);

  /* naye messages ke liye polling (is API me server push nahi hai) */
  useEffect(() => {
    if (!me || !branchId) return undefined;
    const id = setInterval(() => {
      if (document.hidden) return;
      loadContacts({ silent: true });
      refreshUnread();
      const open = activeRef.current;
      if (open) loadConversation(open);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [me, branchId, loadContacts, loadConversation, refreshUnread]);

  /* ── derived ─────────────────────────────────────────────────── */

  /* Sidebar tarteeb: jis chat par sab se naya message hai wo upar. Jin ka
     preview abhi nahi aaya un ko unread aur naam par rakho. */
  const orderedContacts = useMemo(() => {
    const at = (c) => (lastOf(history[c.userId])?.at) || 0;
    const staffOnly = chatMode === 'staffOnly';
    const list = staffOnly ? contacts.filter(c => !c.isParent) : contacts;
    return [...list].sort((a, b) =>
      (at(b) - at(a)) || ((b.unread || 0) - (a.unread || 0)) || a.name.localeCompare(b.name));
  }, [contacts, history, chatMode]);

  const filteredRecent = useMemo(() => {
    const q = sidebarQ.trim().toLowerCase();
    if (!q) return orderedContacts;
    return orderedContacts.filter(c => {
      const preview = lastPreview(history[c.userId]).toLowerCase();
      return c.name.toLowerCase().includes(q)
        || (c.father || '').toLowerCase().includes(q)
        || (c.rel || '').toLowerCase().includes(q)
        || (c.group || '').toLowerCase().includes(q)
        || preview.includes(q);
    });
  }, [orderedContacts, history, sidebarQ]);

  /* Report the unseen-message count up to the shell so the sidebar Chat
     nav badge stays in sync (clears as conversations are opened). */
  useEffect(() => { onUnreadChange?.(unreadTotal); }, [unreadTotal, onUnreadChange]);

  /* ── derived: kaun si bheji hui message dekhi ja chuki hai ──
     API har message par seen/unseen nahi deta, sirf ye batata hai ke contact ne
     MERI kitni messages nahi dekhin (fetchUnseenFromMe). Chat waqt ke hisaab se
     hoti hai, is liye aakhri N bheji hui messages "unseen" hain aur un se pehle
     wali sab "seen" — bilkul WhatsApp jaisa. Gintii na mile (null) to koi blue
     tick nahi, sab double grey rehti hain. */
  const seenIds = useMemo(() => {
    const unseen = receipts[activeId];
    if (unseen == null) return null;
    const sent = activeMsgs.filter(m => m.type === 'sent' && !m.pending);
    const seenCount = Math.max(0, sent.length - unseen);
    return new Set(sent.slice(0, seenCount).map(m => m.id));
  }, [receipts, activeId, activeMsgs]);

  /* sending → single grey · pahunch gaya → double grey · dekh liya → double blue */
  const tickStatus = useCallback((m) => {
    if (m.pending) return 'sending';
    return seenIds && seenIds.has(m.id) ? 'seen' : 'sent';
  }, [seenIds]);

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
  useEffect(() => { setConvIdx(0); }, [convQ, activeId]);

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
  }, [activeMsgs.length, activeId, convSearchOpen]);

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

  /* ── actions ─────────────────────────────────────────────────── */

  /* Sirf selection — messages laana aur "seen" karna neeche wale effect ka kaam
     hai, taake pehli chat (jo khud-ba-khud khulti hai) bhi usi rasty se guzray. */
  const openConv = useCallback((userId) => {
    setActiveId(userId);
    setConvSearchOpen(false);
    setConvQ('');
    setMobileShowConv(true);
    setContacts(prev => prev.map(c => c.userId === userId ? { ...c, unread: 0 } : c));
  }, []);

  /* Ek hi rasta bhejne ka — text, attachment ya dono (file ke saath draft
     caption ban jata hai, bilkul mobile app ki tarah). */
  const send = useCallback(async ({ text = '', file = null }) => {
    const to = activeRef.current;
    if (!to) { toastRef.current('Select a conversation first', 'warning'); return; }
    if (!text.trim() && !file) return;
    setSending(true);
    /* Bubble foran dikha do (single grey tick ke saath) — server ka jawab aane
       par poori conversation dobara aa kar isay replace kar deti hai. */
    const pending = pendingMessage({ text, file });
    setHistory(prev => ({ ...prev, [to]: [...(prev[to] || []), pending] }));
    setDraft('');
    try {
      await postChatMessage({ fromUserId: me, toUserId: to, branchId, message: text.trim(), file });
      await loadConversation(to);
      loadContacts({ silent: true });
      /* pehli baar bhejne par ye chat ab asli hai — provisional nishan hatao */
      setContacts(prev => prev.map(c => c.userId === to ? { ...c, provisional: false } : c));
    } catch (err) {
      /* na ja saka: local bubble hatao aur likha hua wapas composer me daal do */
      setHistory(prev => ({ ...prev, [to]: (prev[to] || []).filter(m => m.id !== pending.id) }));
      if (text.trim()) setDraft(d => d || text);
      toastRef.current(err.message || 'Message could not be sent', 'error');
    } finally {
      if (pending.url) URL.revokeObjectURL(pending.url);
      setSending(false);
    }
  }, [me, branchId, loadConversation, loadContacts]);

  const sendText = () => send({ text: draft });

  const pickAttachment = (kind) => {
    setAttachOpen(false);
    fileInputs[kind]?.current?.click();
  };

  const onFilePicked = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';           // same file dobara chunne par bhi change chale
    if (!file) return;
    await send({ text: draft, file });
  };

  const startRecording = async () => {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast('Voice recording is not supported in this browser', 'error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const { mime, ext } = pickAudioFormat();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = ev => { if (ev.data && ev.data.size) chunksRef.current.push(ev.data); };
      recRef.current = { rec, stream, ext };
      rec.start();
      setRecSeconds(0);
      setRecording(true);
    } catch (_) {
      toast('Microphone permission was denied', 'error');
    }
  };

  /* Recorder rok kar blob wapas do (send=false par sirf band karo). */
  const stopRecording = (wantFile) => new Promise(resolve => {
    const cur = recRef.current;
    recRef.current = null;
    if (!cur) { resolve(null); return; }
    cur.rec.onstop = () => {
      cur.stream.getTracks().forEach(t => t.stop());
      if (!wantFile) { resolve(null); return; }
      const blob = new Blob(chunksRef.current, { type: cur.rec.mimeType || 'audio/webm' });
      chunksRef.current = [];
      resolve(blob.size ? new File([blob], `voice-note-${Date.now()}.${cur.ext}`, { type: blob.type }) : null);
    };
    try { cur.rec.stop(); } catch (_) { resolve(null); }
  });

  const cancelRecording = async () => {
    setRecording(false);
    setRecSeconds(0);
    await stopRecording(false);
  };

  const sendVoiceNote = async () => {
    setRecording(false);
    const file = await stopRecording(true);
    setRecSeconds(0);
    if (!file) { toast('Nothing was recorded', 'warning'); return; }
    await send({ text: '', file });
  };

  /* stop the mic if the screen unmounts mid-recording */
  useEffect(() => () => {
    const cur = recRef.current;
    if (cur) { try { cur.rec.stop(); } catch (_) { /* already stopped */ } cur.stream.getTracks().forEach(t => t.stop()); }
  }, []);

  const startChatWith = (member) => {
    setNcOpen(false);
    if (contacts.some(c => c.userId === member.userId)) {
      openConv(member.userId);
      toast(`Opened existing chat with ${member.name}`, 'info');
      return;
    }
    setContacts(prev => [{
      userId: member.userId,
      name: member.name,
      father: member.father,
      rel: member.rel,
      status: member.status,
      group: member.group,
      picture: member.picture,
      unread: 0,
      students: [],
      provisional: true,
    }, ...prev]);
    openConv(member.userId);
    toast(`New chat started with ${member.name}`, 'success');
  };

  const convSearchNav = (dir) => {
    if (!convMatches.length) return;
    setConvIdx(i => (i + dir + convMatches.length) % convMatches.length);
  };

  const subTitle = (c) => {
    if (!c) return '';
    const bits = [c.rel, c.father && c.father !== '—' ? `Father: ${c.father}` : '', c.group].filter(Boolean);
    const more = c.students && c.students.length > 1 ? ` · ${c.students.length} students` : '';
    return bits.join(' · ') + more;
  };

  return (
    <>
      <style>{CHAT_CSS}</style>

      {/* attachment pickers — popup se trigger hote hain */}
      <input ref={fileInputs.image} type="file" accept="image/*" hidden onChange={onFilePicked} />
      <input ref={fileInputs.video} type="file" accept="video/*" hidden onChange={onFilePicked} />
      <input ref={fileInputs.doc} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv" hidden onChange={onFilePicked} />

      <div className="cm-root">
        {/* ── Page header ── */}
        <div className="cm-page-header">
          <div className="cm-page-header-icon"><i className="fa-solid fa-comments" /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="cm-page-title">
              Chats {unreadTotal > 0 && <span className="cm-unread-global">{unreadTotal}</span>}
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
              {loading ? (
                <div className="cm-sidebar-empty">
                  <i className="fa-solid fa-spinner fa-spin" />
                  <div className="cm-sidebar-empty-title">Loading chats…</div>
                </div>
              ) : loadError ? (
                <div className="cm-sidebar-empty">
                  <i className="fa-solid fa-triangle-exclamation" />
                  <div className="cm-sidebar-empty-title">Could not load chats</div>
                  <div className="cm-sidebar-empty-sub">{loadError}</div>
                  <button className="cm-nc-back-btn" style={{ marginTop: 10 }} onClick={() => loadContacts()}>
                    <i className="fa-solid fa-rotate-right" /> Retry
                  </button>
                </div>
              ) : filteredRecent.length === 0 ? (
                <div className="cm-sidebar-empty">
                  <i className={`fa-solid ${sidebarQ ? 'fa-magnifying-glass' : 'fa-comments'}`} />
                  <div className="cm-sidebar-empty-title">{sidebarQ ? 'No results found' : 'No conversations yet'}</div>
                  <div className="cm-sidebar-empty-sub">
                    {sidebarQ
                      ? <>Try searching by name, father name,<br />class or last message.</>
                      : <>Click <strong>New Chat</strong> to message a<br />parent, student or teacher.</>}
                  </div>
                </div>
              ) : filteredRecent.map(c => {
                const last = lastOf(history[c.userId]);
                return (
                  <div
                    key={c.userId}
                    className={`cm-recent-row${activeId === c.userId ? ' active' : ''}`}
                    onClick={() => openConv(c.userId)}
                  >
                    <div className="cm-rcr-avatar">
                      <Avatar name={c.name} src={c.picture} />
                      {/* app-status ka nishan sirf parents par */}
                      {c.isParent && (
                        <div
                          className={`cm-rcr-dot ${appUsers.has(c.userId) ? 'on' : 'off'}`}
                          title={appUsers.has(c.userId) ? 'Logged into the School Mentor app' : 'Not logged into the app yet'}
                        />
                      )}
                    </div>
                    <div className="cm-rcr-info">
                      <div className="cm-rcr-name-row">
                        <span className="cm-rcr-name">{highlight(c.name, sidebarQ)}</span>
                        <span className="cm-rcr-badge">{highlight(c.group, sidebarQ)}</span>
                      </div>
                      <div className="cm-rcr-father">
                        <i className="fa-solid fa-user" style={{ fontSize: 9, opacity: 0.6, marginRight: 3 }} />
                        Father: {highlight(c.father || '—', sidebarQ)}
                      </div>
                      <div className="cm-rcr-preview">{highlight(lastPreview(history[c.userId]), sidebarQ)}</div>
                    </div>
                    <div className="cm-rcr-meta">
                      <span className="cm-rcr-time">{last ? (last.date === 'Today' ? last.time : `${last.date} · ${last.time}`) : ''}</span>
                      {c.unread ? <span className="cm-rcr-unread">{c.unread}</span> : null}
                    </div>
                  </div>
                );
              })}
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
                    <div className="cm-conv-hdr-avatar">
                      <Avatar name={activeChat.name} src={activeChat.picture} />
                      {activeChat.isParent && <div className={`cm-conv-hdr-dot ${appUsers.has(activeChat.userId) ? 'on' : 'off'}`} />}
                    </div>
                    <div className="cm-conv-hdr-info">
                      <div className="cm-conv-hdr-name">{activeChat.name}</div>
                      <div className="cm-conv-hdr-sub">{subTitle(activeChat)}</div>
                    </div>
                    {/* App par hai ya nahi — get-users-fcm-status se. SIRF parents
                        par dikhata hai (staff ke liye chhupa rehta hai). Ye sirf
                        itna batata hai ke push notification pahunchegi ya nahi;
                        message dono surton me chala jata hai aur parent ke log-in
                        karte hi usay nazar aa jata hai — bhejne par koi rok nahi. */}
                    {activeChat.isParent && (
                    <Tooltip text={appUsers.has(activeChat.userId)
                      ? `${activeChat.name} is logged into the School Mentor app — they will get a notification.`
                      : `${activeChat.name} has not logged into the app yet — no notification will be delivered, but the message will be waiting for them.`}>
                      <span className={`cm-app-chip${appUsers.has(activeChat.userId) ? ' on' : ''}`}>
                        <i className={`fa-solid ${appUsers.has(activeChat.userId) ? 'fa-mobile-screen-button' : 'fa-bell-slash'}`} />
                        {appUsers.has(activeChat.userId) ? 'App active' : 'Not on app'}
                      </span>
                    </Tooltip>
                    )}
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
                    {convLoading && !activeMsgs.length ? (
                      <div className="cm-conv-note"><i className="fa-solid fa-spinner fa-spin" /> Loading conversation…</div>
                    ) : !activeMsgs.length ? (
                      <div className="cm-conv-note">No messages yet — say salaam 👋</div>
                    ) : activeMsgs.map((m, i) => {
                      const prev = activeMsgs[i - 1];
                      const showSep = m.date && (!prev || prev.date !== m.date);
                      const isMatch = convMatches.includes(i);
                      const isActiveMatch = isMatch && convMatches[convIdx] === i;
                      return (
                        <React.Fragment key={m.id ?? i}>
                          {showSep && <div className="cm-msg-date-sep">{m.date}</div>}
                          <MessageBubble
                            m={m}
                            status={tickStatus(m)}
                            convName={activeChat.name}
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
                            <button className="cm-attach-trigger" onClick={() => setAttachOpen(o => !o)} disabled={sending}>
                              <i className="fa-solid fa-paperclip" />
                            </button>
                          </Tooltip>
                          {attachOpen && (
                            <div className="cm-attach-popup">
                              <div className="cm-attach-popup-item" onClick={() => pickAttachment('image')}><i className="fa-solid fa-image" style={{ color: 'var(--brand-primary)' }} /> Image</div>
                              <div className="cm-attach-popup-item" onClick={() => pickAttachment('video')}><i className="fa-solid fa-video" style={{ color: 'var(--brand-primary)' }} /> Video</div>
                              <div className="cm-attach-popup-item" onClick={() => pickAttachment('doc')}><i className="fa-solid fa-file-pdf" style={{ color: '#DC2626' }} /> PDF / Document</div>
                            </div>
                          )}
                        </div>
                        <input
                          className="cm-conv-txt-input"
                          placeholder={sending ? 'Sending…' : 'Type a message...'}
                          value={draft}
                          disabled={sending}
                          onChange={e => setDraft(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !sending) sendText(); }}
                        />
                        <Tooltip text="Record a voice message"><button className="cm-conv-mic-btn" onClick={startRecording} disabled={sending}><i className="fa-solid fa-microphone" /></button></Tooltip>
                        <Tooltip text="Send message">
                          <button className="cm-conv-send-btn" onClick={sendText} disabled={sending || !draft.trim()}>
                            <i className={`fa-solid ${sending ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} />
                          </button>
                        </Tooltip>
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
          me={me}
          branchId={branchId}
          appUsers={appUsers}
          chatMode={chatMode}
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

/* ── Avatar: API ki tasveer, na chale to initials ──
   Chat ki pictures {host}/APIBeta/Img/Image/{id} par hoti hain aur har branch
   par mojood nahi hotin — is liye load fail hone par chupke se initials. */
function Avatar({ name, src }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [src]);
  if (!src || broken) return <>{ini(name)}</>;
  return <img className="cm-avatar-img" src={src} alt="" onError={() => setBroken(true)} />;
}

/* ── Message bubble ── */
function MessageBubble({ m, status, convName, matchClass, innerRef }) {
  const isSent = m.type === 'sent';
  /* WhatsApp jaise ticks: ja raha hai → ek grey, pahunch gaya → do grey,
     contact ne dekh liya → do neelay. */
  const tick = !isSent ? null
    : status === 'sending'
      ? <i className="fa-solid fa-check cm-tick" title="Sending…" aria-label="Sending" />
      : (
        <i
          className={`fa-solid fa-check-double cm-tick${status === 'seen' ? ' seen' : ''}`}
          title={status === 'seen' ? 'Seen' : 'Delivered'}
          aria-label={status === 'seen' ? 'Seen' : 'Delivered'}
        />
      );
  const meta = <div className="cm-msg-meta">{m.time || ''} {tick}</div>;
  const caption = m.attach && m.text ? <div className="cm-attach-caption">{m.text}</div> : null;

  let body;
  if (!m.attach) {
    body = <div className="cm-bubble">{m.text}</div>;
  } else if (m.attach === 'voice') {
    body = <MediaAttachment kind="voice" m={m} caption={caption} />;
  } else if (m.attach === 'image') {
    body = <ImageAttachment m={m} caption={caption} />;
  } else if (m.attach === 'video') {
    body = <MediaAttachment kind="video" m={m} caption={caption} />;
  } else {
    /* Poori tile hi file kholti hai, is liye alag download icon nahi — wo sirf
       ek doosra "kholne" ka nishan tha jo bhram paida karta tha. */
    body = (
      <a className="cm-attach-doc" href={m.url} target="_blank" rel="noreferrer">
        <div className="cm-attach-doc-icon"><i className="fa-solid fa-file-pdf" /></div>
        <div className="cm-attach-doc-info">
          <div className="cm-attach-doc-name">{m.docName}</div>
          <div className="cm-attach-doc-size">{m.text || 'Tap to open'}</div>
        </div>
      </a>
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

/* Video / voice note — file na mile to khaali kaala player dikhane ke bajaye
   saaf saaf bata do. (Abhi backend par /APIBeta/Img/ChatAttachments/… ka koi
   route hai hi nahi, is liye har attachment yahin girta hai.) */
function MediaAttachment({ kind, m, caption }) {
  const [broken, setBroken] = useState(false);
  const isVideo = kind === 'video';
  useEffect(() => { setBroken(false); }, [m.url]);

  if (broken) {
    return (
      <div className={isVideo ? 'cm-attach-video-real' : 'cm-attach-voice-real'}>
        <div className="cm-attach-missing">
          <i className={`fa-solid ${isVideo ? 'fa-video-slash' : 'fa-microphone-slash'}`} />
          <span>{m.text || (isVideo ? 'Video unavailable' : 'Voice message unavailable')}</span>
        </div>
        {m.text ? null : caption}
      </div>
    );
  }
  return (
    <div className={isVideo ? 'cm-attach-video-real' : 'cm-attach-voice-real'}>
      {isVideo
        /* eslint-disable-next-line jsx-a11y/media-has-caption */
        ? <video className="cm-attach-videoel" controls preload="metadata" src={m.url} onError={() => setBroken(true)} />
        /* eslint-disable-next-line jsx-a11y/media-has-caption */
        : <audio className="cm-attach-audio" controls preload="metadata" src={m.url} onError={() => setBroken(true)} />}
      {caption}
    </div>
  );
}

/* Tasveer khud dikhao; file na mile to naam wali placeholder tile. */
function ImageAttachment({ m, caption }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <div className="cm-attach-image">
        <div className="cm-attach-image-inner"><i className="fa-solid fa-image" /><span>{m.text || 'Photo unavailable'}</span></div>
      </div>
    );
  }
  return (
    <a className="cm-attach-image" href={m.url} target="_blank" rel="noreferrer">
      <img className="cm-attach-image-el" src={m.url} alt={m.text || 'Attachment'} onError={() => setBroken(true)} />
      <div className="cm-attach-image-overlay"><i className="fa-solid fa-expand" /></div>
      {caption}
    </a>
  );
}

/* ── New Chat modal — poori directory get-contact-list se ── */
function NewChatModal({ me, branchId, appUsers, chatMode, onClose, onStartChat, toast }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [group, setGroup] = useState(null);   // selected class id, or null = class list
  const [q, setQ] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchContactList(branchId, me);
        const list = chatMode === 'staffOnly' ? data.filter(r => !r.isParent) : data;
        if (alive) setRows(list.filter(r => r.userId !== me));
      } catch (err) {
        if (alive) setError(err.message || 'Could not load the contact list');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [branchId, me]);

  /* Class-wise grouping — staff apne alag khane me. */
  const groups = useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      const key = r.status === 'Staff' ? 'Staff' : (r.group || 'Others');
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return [...map.entries()]
      .map(([name, members]) => ({ id: name, name, members, count: members.length }))
      .sort((a, b) => (a.name === 'Staff' ? -1 : b.name === 'Staff' ? 1
        : a.name.localeCompare(b.name, undefined, { numeric: true })));
  }, [rows]);

  const query = q.trim().toLowerCase();
  const groupObj = groups.find(g => g.id === group) || null;

  /* search across all members + class names */
  const searchResults = useMemo(() => {
    if (!query) return null;
    const contacts = [];
    groups.forEach(g => {
      g.members.forEach(m => {
        if (m.name.toLowerCase().includes(query)
          || (m.father || '').toLowerCase().includes(query)
          || (m.rel || '').toLowerCase().includes(query)
          || (m.regNo || '').toLowerCase().includes(query)
          || g.name.toLowerCase().includes(query)) {
          contacts.push(m);
        }
      });
    });
    const classes = groups.filter(g => g.name.toLowerCase().includes(query));
    return { contacts: contacts.slice(0, 60), classes };
  }, [query, groups]);

  /* FCM ka nishan sirf PARENTS par — staff rows aam rehti hain. */
  const appOk = (m) => !m.isParent || appUsers.has(m.userId);

  const handleMember = (m) => {
    /* App par logged in na ho to bhi message ja sakta hai — wo login karte hi
       dekh lega. Sirf bata dete hain ke abhi notification nahi pahunchegi. */
    if (m.isParent && !appUsers.has(m.userId)) {
      toast(`${m.name} has not logged into the School Mentor app yet — the message will be waiting for them.`, 'warning');
    }
    onStartChat(m);
  };

  const sub = loading ? 'Loading contacts…'
    : searchResults ? 'Search results'
    : groupObj ? `${groupObj.name} — select a contact`
    : 'Select a class to browse contacts';

  const memberRow = (m, i) => (
    <div
      key={`${m.userId}-${m.regNo || i}`}
      className={`cm-nc-member-row ${appOk(m) ? 'on' : 'off'}`}
      title={appOk(m) ? '' : 'Not logged into the app yet — the message will be waiting for them'}
      onClick={() => handleMember(m)}
    >
      <div className={`cm-nc-member-av ${appOk(m) ? 'on' : 'off'}`}>{ini(m.name)}</div>
      <div className="cm-nc-member-info">
        <div className="cm-nc-member-name">{highlight(m.name, q)}</div>
        <div className="cm-nc-member-rel">
          {highlight(m.rel || '—', q)} · <span style={{ fontSize: 10, color: 'var(--brand-primary)', fontWeight: 700 }}>{highlight(m.group, q)}</span>
        </div>
      </div>
      <i className={`cm-nc-member-icon fa-solid ${appOk(m) ? 'fa-comment-dots on' : 'fa-bell-slash off'}`} />
    </div>
  );

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
          {loading ? (
            <div className="cm-nc-empty">
              <i className="fa-solid fa-spinner fa-spin" />
              <div className="cm-nc-empty-title">Loading contacts…</div>
            </div>
          ) : error ? (
            <div className="cm-nc-empty">
              <i className="fa-solid fa-triangle-exclamation" />
              <div className="cm-nc-empty-title">Could not load contacts</div>
              <div className="cm-nc-empty-sub">{error}</div>
            </div>
          ) : searchResults ? (
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
                    {searchResults.contacts.map(memberRow)}
                  </>
                )}
              </div>
            )
          ) : !groupObj ? (
            /* Step 1: class list */
            <>
              <div style={{ padding: '10px 16px 6px', fontSize: 10.5, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.6px' }}>Choose a Class or Group</div>
              {groups.length === 0 ? (
                <div className="cm-nc-empty">
                  <i className="fa-solid fa-user-slash" />
                  <div className="cm-nc-empty-title">No contacts in this branch</div>
                </div>
              ) : (
                <div style={{ padding: '0 12px 14px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  {groups.map(g => (
                    <div key={g.id} className="cm-nc-class-card" onClick={() => setGroup(g.id)}>
                      <div className="cm-nc-class-count">{g.count}</div>
                      <div className="cm-nc-class-name">{g.name}</div>
                      <div className="cm-nc-class-sub">{g.count} member{g.count !== 1 ? 's' : ''}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Step 2: member list */
            <>
              <div style={{ padding: '10px 14px 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <button className="cm-nc-back-btn" onClick={() => setGroup(null)}><i className="fa-solid fa-arrow-left" /> Back</button>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{groupObj.name}</span>
              </div>
              {/* Ye nishan sirf parents par lagta hai, is liye legend bhi tabhi
                  jab is group me parents hon (staff ke khane me nahi). */}
              {groupObj.members.some(m => m.isParent) && (
                <div style={{ display: 'flex', gap: 12, padding: '2px 14px 8px', fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--brand-light)', border: '1.5px solid var(--brand-primary)', display: 'inline-block' }} /> App active</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#f1f5f9', border: '1.5px solid #CBD5E1', display: 'inline-block' }} /> Not on app — message still goes</span>
                </div>
              )}
              <div style={{ padding: '0 12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...groupObj.members]
                  .sort((a, b) => (appOk(b) - appOk(a)) || a.name.localeCompare(b.name))
                  .map(memberRow)}
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
/* app par logged in hai ya nahi (FCM token) */
.cm-app-chip { display:inline-flex; align-items:center; gap:5px; border-radius:var(--radius-full); padding:3px 10px; font-size:10.5px; font-weight:700; flex-shrink:0; white-space:nowrap; background:var(--bg-muted); color:var(--text-muted); border:1px solid var(--border-light); }
.cm-app-chip.on { background:rgba(34,197,94,.1); color:#15803D; border-color:rgba(34,197,94,.35); }
.cm-app-chip i { font-size:10px; }
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
/* Avatar bubble ke UPAR wale kinare par — pehle \`margin-top:auto\` tha jo usay
   poori row ke neechay (timestamp ke barabar) dhakel deta tha. */
.cm-msg-recv-av { width:28px; height:28px; border-radius:50%; background:linear-gradient(135deg,var(--brand-primary),var(--brand-deeper,#1E3A8A)); color:#fff; font-size:9px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; align-self:flex-start; }
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

/* live media — asli file API se aati hai (image / video / voice note) */
.cm-attach-image { display:block; text-decoration:none; }
.cm-attach-image-el { display:block; width:100%; max-height:220px; object-fit:cover; }
.cm-attach-video-real, .cm-attach-voice-real { max-width:240px; }
.cm-attach-videoel { display:block; width:100%; max-height:220px; border-radius:10px; background:#000; border:1px solid var(--border-light); }
.cm-attach-audio { display:block; width:240px; height:38px; }
.cm-attach-caption { font-size:12px; color:var(--text-primary); padding:5px 2px 0; line-height:1.45; word-break:break-word; }
.cm-attach-missing { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; min-width:170px; padding:22px 14px; border-radius:10px; border:1px dashed var(--border-med); background:var(--bg-muted); color:var(--text-muted); font-size:11.5px; font-weight:600; text-align:center; }
.cm-attach-missing i { font-size:20px; opacity:.7; }
.cm-attach-doc { text-decoration:none; }
.cm-conv-note { margin:auto; padding:24px 12px; text-align:center; font-size:12.5px; color:var(--text-muted); font-weight:600; }
.cm-avatar-img { width:100%; height:100%; border-radius:50%; object-fit:cover; display:block; }

/* delivery ticks — grey (pahunch gaya) se blue (dekh liya) */
.cm-tick { font-size:9px; color:#94A3B8; margin-left:1px; vertical-align:baseline; transition:color .18s ease; }
.cm-tick.seen { color:#2563EB; }

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
/* "off" = parent abhi app par nahi. Chat phir bhi ho sakti hai (message intezaar
   karta hai), is liye row band nahi — bas halki si dhundli, taake farq dikhe. */
.cm-nc-member-row.off { opacity:.7; cursor:pointer; }
.cm-nc-member-row.off:hover { opacity:1; border-color:var(--border-med); }
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
