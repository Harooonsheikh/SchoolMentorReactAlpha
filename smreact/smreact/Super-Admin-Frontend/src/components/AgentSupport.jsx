import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSupportChat, formatTime } from '../support/useSupportChat';
import { useVoiceRecorder } from '../support/useVoiceRecorder';
import { toUploadableVoice } from '../support/audio';
import { serverDate } from '../support/time';
import { downloadKey, isDownloaded, markDownloaded } from '../support/downloads';
import { VoicePlayer, VideoBubble, ImageGallery } from '../support/MediaBits';
import { groupChatItems } from '../support/grouping';
import { SUPPORT_BACKEND_ENABLED, ATTACH_LIMITS, VOICE_NOTE_CAPTION, MessageStatus, looksLikePhoneNumber } from '../support/config';
import * as supportApi from '../support/api';
/* Notes aur Bug/Improvement Support ki apni API par nahi jate — wahi
   Super-Admin routes hain jo Schools Progress screen use karti hai, taake ek hi
   school ka record dono jagah se ek jaisa dikhe:
     Notes            → AHM_School_Progress/followup/onboarding-card-action
     Bug/Improvement  → AHM_School_Progress/school-enquiries-bugs-action
   Support session ka `schoolID` wahi BranchID hai jo ye routes maangte hain
   (live tasdeeq shuda). */
import { schoolProgressApi, authApi } from '../superadmin/api';
import AgentOverview from './AgentOverview';

let _agAttId = 1;
const agAttId = () => `aatt${_agAttId++}`;

/* ═══════════════════════════════════════════════════════════════════
   CUSTOMER SUPPORT — agent-side support console (Overview + Agent Inbox tabs)
   Port of the agent chat panel from "Super Admin Support .html".
   Focus: the message tray with Image / Document / Note / Bug /
   Improvement actions and their modals. Note / Bug / Improvement append
   inline coloured cards to the conversation (internal — never sent to
   the school). Demo-only; state lives in component state.

   Mounted full-screen when the URL hash is #agent (see components/App.js)
   so it can be viewed without touching the school ERP shell.
   ═══════════════════════════════════════════════════════════════════ */

/* Attachment ke sath caption laazmi — upload route par bhi wo [Required] hai,
   aur file ka naam khud caption bana dena user ka likha hua matn nahi hota. */
const CAPTION_REQUIRED = 'Caption is required';

/* "Assign To" ke naam ab API se aate hain (GET /api/Auth/get-all-users) — wahi
   directory jo Schools Progress ke Assigned-To dropdown chalati hai. Pehle
   yahan chaar naam hard-coded thay jo kisi asli user se mail nahi khate thay,
   aur bug us naam par assign ho jata tha jo system me hota hi nahi. */
const BUG_PRIO_COLOR = { Low: '#16A34A', Medium: '#D97706', High: '#DC2626', Critical: '#7C3AED' };

const QUICK_REPLIES = [
  ['Technical team assigned', 'Our technical team is working on this. We will update you shortly.'],
  ['Restart ERP', 'Please restart the ERP and try again.'],
  ['Issue resolved', 'Issue has been resolved. Please check now.'],
  ['Acknowledgement', 'Thank you for reaching out. We will get back to you soon.'],
];

let _id = 1;
const newId = () => `a${_id++}`;
/* Har "send" ka apna nishan (sirf is screen ke liye — API par nahi jata). */
let _batchSeq = 0;
const nextBatchId = () => `snd${++_batchSeq}`;

const nowTime = () =>
  new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

/* Yahan pehle SEED tha: Daffodil Schools ki ek static guftagu jo API tak
   baat na ho sakne par chat me chal jati thi. Super Admin ko banawati chat
   dikhna galat hai (asli lagti hai), is liye ab aisi surat me chat khali
   rehti hai aur wajah likhi aati hai. */
/* When `embedded` is true the component renders without its own top bar
   (logo + tabs + "Back to ERP"); the host — e.g. the Super Admin shell —
   provides the page chrome and drives the active tab through `tab` /
   `onTab`. Standalone (#agent) usage passes nothing and keeps local
   tab state plus the built-in top bar. */
export default function AgentSupport({ embedded = false, tab, onTab, showBack = true }) {
  /* Khali se shuru: pehle loader, phir asli data. Yahan koi demo guftagu
     nahi girti — API tak baat na ho to chat khali rehti hai. */
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [modal, setModal] = useState(null); // 'note'|'bug'|'improv'|'image'|'doc'|'video'|null
  const [toast, setToast] = useState(null);  // { msg, type }
  const [internalTab, setInternalTab] = useState('overview'); // 'overview' | 'inbox'
  const activeTab = tab ?? internalTab;
  const setActiveTab = onTab ?? setInternalTab;
  const [prevOpen, setPrevOpen] = useState(false);       // Previous Sessions panel
  const [prevSession, setPrevSession] = useState(null);  // selected past session transcript
  const [prevSessions, setPrevSessions] = useState([]);  // closed sessions for current school (real)
  const [prevLoading, setPrevLoading] = useState(false);
  const [viewSchool, setViewSchool] = useState(null);    // { schoolId, schoolName, campusName }
  const [closeOpen, setCloseOpen] = useState(false);     // closing-remarks confirmation
  const [closeRemarks, setCloseRemarks] = useState('');
  const msgsRef = useRef(null);
  const taRef = useRef(null);

  /* Tray forms */
  const [noteForm,   setNoteForm]   = useState({ title: '', details: '' });
  const [bugForm,    setBugForm]    = useState({ title: '', desc: '', module: '', priority: 'High',   assignee: '' });
  const [improvForm, setImprovForm] = useState({ title: '', desc: '', module: '', priority: 'Medium', assignee: '' });

  /* Attachment modals — multi-select (arrays) */
  const [imgItems,   setImgItems]   = useState([]);
  const [docItems,   setDocItems]   = useState([]);
  const [videoItems, setVideoItems] = useState([]);
  const [imgCaption, setImgCaption] = useState('');
  const [docMsg,     setDocMsg]     = useState('');
  const [videoCaption, setVideoCaption] = useState('');
  const imgInputRef = useRef(null);
  const docInputRef = useRef(null);
  const videoInputRef = useRef(null);

  /* Auto-scroll on new messages */
  useEffect(() => {
    const el = msgsRef.current;
    if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [messages]);

  /* ESC closes top modal */
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && modal) setModal(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modal]);

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2600);
  };

  /* Locally bana hua apna bubble hamesha "Sent" — server ne abhi kuch kaha hi
     nahi, is liye tick single rehna chahiye (blue sirf server ke Read par). */
  const append = (payload) => setMessages(prev => [...prev, {
    id: newId(),
    ...(payload.kind === 'out' ? { status: MessageStatus.Sent } : null),
    ...payload,
  }]);

  /* ─── Live backend wiring (REST + SignalR), agent perspective.
         Note / Bug / Improvement cards stay client-side (internal, Phase 2
         feature on the backend); text chat flows through the live API. ─── */
  const [remoteTyping, setRemoteTyping] = useState(null);

  const chat = useSupportChat({
    role: 'agent',
    /* School ke messages tab hi "read" hon jab agent Inbox par ho — Overview
       tab par baithe rehne se unread khud saaf nahi hona chahiye. */
    viewing: activeTab === 'inbox',
    onHistory: (msgs) => setMessages(msgs.length ? msgs : [
      { id: newId(), kind: 'daylabel', text: 'Today' },
    ]),
    onInbound: (uiMsg) => setMessages(prev =>
      prev.some(m => m.id === uiMsg.id) ? prev : [...prev.filter(m => m.kind !== 'typing'), uiMsg]),
    onTyping: (name) => setRemoteTyping(name),
    onReceipt: ({ type, messageIds }) => setMessages(prev => prev.map(m =>
      messageIds.includes(m.id) ? { ...m, status: type === 'read' ? 3 : 2 } : m)),
    // A session closed in real time → its inbox row is removed by the hook; we
    // refresh this school's Previous Sessions so it appears in history at once.
    onSessionClosed: () => { clearChatPane(); },
    /* Backend tak pahunch hi na ho → chat khali; neeche wali khali haalat
       khud bata deti hai ke API se baat nahi ho rahi. Pehle yahan static
       demo guftagu aa jati thi. */
    onError: () => setMessages([]),
  });
  const liveConnected = chat.connected;
  /* Pehli load: na connect hua, na koi error — sirf spinner. */
  const chatLoading = chat.status === 'idle' || chat.status === 'connecting';
  const liveSession = chat.activeSessions.find(s => s.sessionId === chat.sessionId) || null;

  /* Track which school's conversation is open (kept even after it closes, so
     "Previous Sessions" knows which school to show). */
  /* Session band hote hi chat ka rukh khali. Pehle sirf typing ka nishan
     hatta tha: inbox se row nikal jati thi (Conversations 0) magar band shuda
     guftagu, uska header aur reply box screen par jyun ke tyun khade rehte
     thay — dekhne wale ko chat khuli lagti thi. newConversation() session se
     alag bhi kar deta hai, is liye koi aur khuli conversation ho to wo khud
     khul jati hai (neeche wala effect), warna khali haalat.

     viewSchool jaan bujh kar rehne diya jata hai — Previous Sessions aur
     sidebar ko abhi bhi yehi school chahiye. */
  const clearChatPane = () => {
    setMessages([]);
    setRemoteTyping(null);
    /* Daayen side bhi khali. `viewSchool` pehle jaan bujh kar rakha jata tha
       (Previous Sessions ke liye), magar us se school ki tafseel, notes aur
       history sab band ho chuki guftagu ki screen par khare rehte thay —
       page refresh tak. Jab chat aur inbox saaf ho jate hain to sidebar ka
       khara rehna sirf uljhan hai.

       Sab kuch khud ba khud saaf ho jata hai: viewSchool null hote hi
       openSchoolId 0 ho jata hai, jis par School Info ke khane "—" par aa
       jate hain, notes wala effect lastNote null kar deta hai, aur
       loadPrevSessions wala effect previous sessions khali kar deta hai. */
    setViewSchool(null);
    setPrevSessions([]);
    setPrevOpen(false);
    setPrevSession(null);
    setSideNote('');
    chat.newConversation();
  };

  const rememberSchool = (sess) => {
    if (sess) setViewSchool({ schoolId: sess.schoolId, schoolName: sess.schoolName, campusName: sess.campusName });
  };

  /* Load real closed sessions for the current school (offline → demo). */
  const loadPrevSessions = () => {
    if (liveConnected && viewSchool) {
      setPrevLoading(true);
      supportApi.getClosedHistory(viewSchool.schoolId)
        .then(res => setPrevSessions(res.items || []))
        .catch(() => setPrevSessions([]))
        .finally(() => setPrevLoading(false));
    } else {
      setPrevSessions([]);
    }
  };

  /* Connect on mount; open the first active conversation once connected. */
  useEffect(() => {
    if (SUPPORT_BACKEND_ENABLED) chat.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (chat.connected && !chat.sessionId && chat.activeSessions.length) {
      const first = chat.activeSessions[0];
      rememberSchool(first);
      chat.openSession(first.sessionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.connected, chat.activeSessions, chat.sessionId]);

  /* Keep the Previous-Sessions count fresh whenever the school context changes. */
  useEffect(() => {
    loadPrevSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewSchool, liveConnected]);

  /* ─── Right sidebar ka data ───────────────────────────────────────
     Session sirf schoolName / campusName / agent deta hai; principal, contact
     aur school ki active-inactive halat /support/schools se aati hai, is liye
     wo directory ek baar utha kar id par lookup kar lete hain. */
  const [schoolDir, setSchoolDir] = useState([]);
  useEffect(() => {
    if (!liveConnected) return;
    supportApi.getSchools().then(setSchoolDir).catch(() => setSchoolDir([]));
  }, [liveConnected]);

  /* Bug / Improvement ke "Assign To" ke liye asli users. */
  const [users, setUsers] = useState([]);
  useEffect(() => {
    let alive = true;
    authApi.listUsers()
      .then((rows) => { if (alive) setUsers(rows || []); })
      .catch(() => { if (alive) setUsers([]); });
    return () => { alive = false; };
  }, []);

  const openSchoolId = liveSession?.schoolId || viewSchool?.schoolId || 0;
  const schoolInfo = schoolDir.find((s) => s.schoolId === openSchoolId) || null;

  /* Agent Notes — wahi Follow-up Card > Notes jo Schools Progress me hain.
     Panel khulte hi is school ka aakhri note dikh jata hai (pehle yahan ek
     jumla hard-coded pada tha). */
  const [sideNote, setSideNote] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [lastNote, setLastNote] = useState(null);

  const loadNotes = useCallback(async (branchId) => {
    if (!branchId) { setLastNote(null); return; }
    try {
      const rows = await schoolProgressApi.listCardActions({
        branchId,
        headType: schoolProgressApi.CARD_HEADS.followup,
        subHeadType: 'Notes',
      });
      setLastNote(rows.length ? rows[rows.length - 1] : null);
    } catch (err) {
      setLastNote(null);
    }
  }, []);

  useEffect(() => { loadNotes(openSchoolId); }, [openSchoolId, loadNotes]);

  const schoolName = liveSession?.schoolName || viewSchool?.schoolName || schoolInfo?.schoolName || 'No school selected';

  /* Chat me school-side bubble par naam API ke senderName se aata hai, aur
     wahan ERP ka login chala aata hai — yani rabta number (03xx…). Aisi surat
     me school ke malik ka naam dikhate hain; agar sender waqai koi naam ho to
     usay haath nahi lagate. Malik /support/schools se aata hai. */
  const ownerName = schoolInfo?.ownerName || schoolInfo?.principalName || '';
  const senderLabel = useCallback((name) => {
    const raw = String(name ?? '').trim();
    return (!raw || looksLikePhoneNumber(raw)) ? (ownerName || 'School') : raw;
  }, [ownerName]);

  /* Bubble ka avatar bhi usi school ka — pehle har jagah "DS" (Daffodil
     Schools) hard-coded tha. */
  const chatAvatar = initials(liveSession?.schoolName || viewSchool?.schoolName || 'School');
  const campusName = liveSession?.campusName || viewSchool?.campusName || schoolInfo?.campusName || '';

  /* Koi guftagu khuli hai ya nahi — isi par chat ka header, Close Session
     aur reply box chalte hain. Band hone ke baad chat.sessionId null ho jata
     hai (clearChatPane), is liye poora chat column khali haalat me chala
     jata hai. */
  const sessionOpen = Boolean(chat.sessionId);

  /* Sender ka naam grouping ki kunji bhi hai, is liye group banane se PEHLE
     badla jata hai — warna ek hi shakhs ke bubbles do alag naamon me bat kar
     album tootta. */
  const chatItems = useMemo(
    () => groupChatItems(messages.map((m) => (m.kind === 'in' ? { ...m, sender: senderLabel(m.sender) } : m))),
    [messages, senderLabel],
  );

  /* Aaj ki tareekh — dono routes par `date` [Required] hai. */
  const todayISO = () => new Date().toISOString().slice(0, 10);

  /* Koi conversation khuli na ho to in dono routes ke liye BranchID hi nahi
     hota — tab likhne se rok dena behtar hai bajaye 0 bhej kar 400 lene ke. */
  const requireSchool = () => {
    if (openSchoolId) return true;
    showToast('Open a conversation first — the school is taken from it', 'warn');
    return false;
  };

  /* Sidebar ka note → Follow-up Card > Notes (wahi record jo Schools Progress
     ke View Details me dikhta hai). */
  const saveSideNote = async () => {
    const text = sideNote.trim();
    if (!text) { showToast('Write a note first', 'warn'); return; }
    if (!requireSchool() || noteSaving) return;
    setNoteSaving(true);
    try {
      await schoolProgressApi.saveCardAction({
        branchId: openSchoolId,
        headType: schoolProgressApi.CARD_HEADS.followup,
        subHeadType: 'Notes',
        commentDetail: text,
        date: todayISO(),
      });
      setSideNote('');
      await loadNotes(openSchoolId);
      showToast('Note saved to School Progress', 'success');
    } catch (err) {
      showToast(err?.message || 'Could not save this note', 'error');
    } finally {
      setNoteSaving(false);
    }
  };

  /* ── Send a text message ── */
  const sendMsg = () => {
    const txt = input.trim();
    if (!txt) return;
    /* API tak baat na ho rahi ho to paighaam kahin mehfooz nahi hota. Pehle
       yahan wo bubble bhi lag jata tha aur 1.8 second baad ek banawati jawab
       ("Dr. Asif · Principal") bhi chat me aa jata tha — chat asli lagti thi
       jabke kuch bheja hi nahi gaya tha. */
    if (!liveConnected) {
      showToast('Support API is not reachable — message not sent', 'warn');
      return;
    }
    chat.sendText(txt).catch((err) => showToast(err?.message || 'Message could not be sent', 'warn'));
    setInput('');
    setTimeout(() => { if (taRef.current) taRef.current.style.height = 'auto'; }, 0);
  };

  const onComposerType = () => { if (liveConnected) chat.setTyping(true); };

  /* Switch the open conversation from the inbox. */
  const selectSession = (id) => {
    if (!id || id === chat.sessionId) return;
    setRemoteTyping(null);
    rememberSchool(chat.activeSessions.find(s => s.sessionId === id));
    chat.openSession(id);
  };

  /* Open the Previous Sessions panel + (re)load this school's closed sessions. */
  const openPrevSessions = () => { setPrevOpen(true); loadPrevSessions(); };

  /* Open a real closed session's full transcript from history. */
  const openPrevTranscript = async (row) => {
    try {
      /* getSessionDetail flattens the API's { session, messages } into one
         object — the head fields sit on `detail` itself, alongside .messages. */
      const detail = await supportApi.getSessionDetail(row.sessionId);
      const s = detail;
      setPrevSession({
        subject: `Session #${row.sessionNumber || '—'} · ${row.schoolName}`,
        schoolName: row.schoolName,
        date: fmtDate(s.createdAt),
        handledBy: s.assignedAgentName || 'Unassigned',
        closedAt: s.closedAt ? `${fmtDate(s.closedAt)} ${formatTime(s.closedAt)}` : '—',
        closedBy: s.assignedAgentName || 'Support',
        closingRemarks: s.closingRemarks || 'No remarks recorded.',
        totalMessages: row.totalMessages,
        totalAttachments: row.totalAttachments,
        messages: (detail.messages || []).map(chat.toUi),
      });
    } catch {
      showToast('Could not load session', 'warn');
    }
  };

  /* Open the closing-remarks confirmation (keeps existing close behaviour). */
  const closeCurrentSession = () => {
    if (liveConnected && chat.sessionId) { setCloseRemarks(''); setCloseOpen(true); }
    /* Pehle yahan "Session closed" ka kamyabi wala toast tha halanke API tak
       baat hi nahi ho rahi thi — session kahin band nahi hota tha. */
    else showToast('Support API is not reachable — session not closed', 'warn');
  };
  const confirmClose = () => {
    const remarks = closeRemarks.trim() || 'Issue resolved.';
    setCloseOpen(false);
    chat.closeSession(remarks)
      .then(() => {
        /* Poll/SignalR ka intezar nahi — band ho gayi to screen abhi saaf. */
        clearChatPane();
        showToast('Session closed & moved to history', 'success');
      })
      .catch(() => showToast('Could not close session', 'warn'));
    setCloseRemarks('');
  };

  const autoResize = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 100) + 'px';
  };

  /* ── Note / Bug / Improvement (internal cards, no reply) ── */
  /* Tray ka "Note" bhi wahin jata hai jahan sidebar ka — Follow-up Card >
     Notes. Card chat me sirf agent ko dikhne wala local record hai; asli
     mehfooz shuda cheez API par jati hai. */
  const [savingNote, setSavingNote] = useState(false);
  const saveNote = async () => {
    const title = noteForm.title.trim();
    const details = noteForm.details.trim();
    if (!title && !details) { showToast('Please add a note before saving', 'warn'); return; }
    if (!requireSchool() || savingNote) return;
    setSavingNote(true);
    try {
      await schoolProgressApi.saveCardAction({
        branchId: openSchoolId,
        headType: schoolProgressApi.CARD_HEADS.followup,
        subHeadType: 'Notes',
        /* Ek hi CommentDetail column hai, is liye title aur tafseel jori jati hai. */
        commentDetail: [title, details].filter(Boolean).join(' — '),
        date: todayISO(),
      });
      append({ kind: 'note', title: title || 'Internal Note', details });
      setNoteForm({ title: '', details: '' });
      setModal(null);
      await loadNotes(openSchoolId);
      showToast('Note saved to School Progress', 'success');
    } catch (err) {
      showToast(err?.message || 'Could not save this note', 'error');
    } finally {
      setSavingNote(false);
    }
  };

  /* ── Bug / Improvement — dono school-enquiries-bugs-action par ──────
     Wahi table jo Schools Progress → View Details → Enquiries dikhata hai, is
     liye yahan se bheja hua bug wahan bhi nazar aata hai.
       developer ← "Assign To"      bugDetail ← title + tafseel (+ priority)
       date      ← aaj              isSolved  ← false (naya bug hamesha Open)
     Us table me bug aur improvement ka koi alag khana nahi hai, is liye
     improvement ki tafseel ke aage nishani laga dete hain — warna dono ek
     jaise dikhte hain. */
  const [savingEnquiry, setSavingEnquiry] = useState(false);

  const submitEnquiry = async ({ form, kind, label }) => {
    const title = form.title.trim();
    if (!title) { showToast(`Please enter ${kind === 'bug' ? 'a bug' : 'an improvement'} title`, 'warn'); return; }
    if (!form.module.trim()) { showToast('Module is required', 'warn'); return; }
    /* Developer bhi API par [Required] hai — khali bheja to 400. */
    if (!form.assignee.trim()) { showToast('Please choose who to assign this to', 'warn'); return; }
    if (!requireSchool() || savingEnquiry) return;
    setSavingEnquiry(true);
    const detail = [
      kind === 'improv' ? `[Improvement] ${title}` : title,
      form.desc.trim(),
      `Priority: ${form.priority}`,
    ].filter(Boolean).join('\n');
    try {
      await schoolProgressApi.saveEnquiry({
        branchId: openSchoolId,
        module: form.module.trim(),
        developer: form.assignee,
        bugDetail: detail,
        date: todayISO(),
        isSolved: false,
      });
      /* Chat me kuch nahi jorna — bug/improvement guftagu ka hissa nahi, wo
         Enquiries record hai. Pehle yahan ek rangeen card transcript me lag
         jata tha jo school ki chat me be-mauqa lagta tha. */
      showToast(`${label} submitted to ${form.assignee}`, 'success');
      setModal(null);
      return true;
    } catch (err) {
      showToast(err?.message || `Could not submit this ${label.toLowerCase()}`, 'error');
      return false;
    } finally {
      setSavingEnquiry(false);
    }
  };

  const submitBug = async () => {
    const ok = await submitEnquiry({ form: bugForm, kind: 'bug', label: 'Bug' });
    if (ok) setBugForm({ title: '', desc: '', module: '', priority: 'High', assignee: '' });
  };

  const submitImprov = async () => {
    const ok = await submitEnquiry({ form: improvForm, kind: 'improv', label: 'Improvement request' });
    if (ok) setImprovForm({ title: '', desc: '', module: '', priority: 'Medium', assignee: '' });
  };

  /* Upload a batch as individual messages (grouped at render time).
     Caption HAR file ke saath jata hai — upload route par wo [Required] hai
     (khali par 400 "The caption field is required"), is liye pehle sirf pehli
     file jati thi aur baqi chup-chaap fail ho jati thin. Caption khali ho to
     yahan tak aate hi nahi — bhejne se pehle rok diya jata hai
     (CAPTION_REQUIRED); pehle file ka naam khud caption ban jata tha, magar wo
     likha hua matn nahi hota tha. Screen par dohrao nahi hota: groupChatItems
     poore group ka ek hi text dikhata hai. */
  const sendItemsTogether = (category, items, caption, demoShape, label) => {
    /* Is ek send ka apna nishan — screen par sirf inhi files ka album banta
       hai (waqt ka faasla kaafi nahi tha). */
    const batchId = nextBatchId();
    if (liveConnected) {
      (async () => {
        let ok = true;
        let lastError = null;
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          try {
            // eslint-disable-next-line no-await-in-loop
            await chat.sendAttachment({
              category, file: it.file, caption: caption.trim(), batchId,
            });
          } catch (err) { ok = false; lastError = err; }
        }
        showToast(ok ? `${label} sent` : (lastError?.message || 'Some uploads failed'), ok ? 'success' : 'warn');
      })();
    } else {
      items.forEach((it, i) => append({ kind: 'out', text: i === 0 ? (caption.trim() || null) : null, ...demoShape(it), time: nowTime(), _batch: batchId }));
      showToast(`${label} sent`, 'success');
    }
  };

  /* ── Images (multi-select, up to 10) ── */
  const onPickImages = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setImgItems(prev => {
      const room = ATTACH_LIMITS.image - prev.length;
      if (room <= 0) { showToast(`You can attach up to ${ATTACH_LIMITS.image} images.`, 'warn'); return prev; }
      if (files.length > room) showToast(`Only ${ATTACH_LIMITS.image} images allowed — extra files were skipped.`, 'warn');
      const next = [...prev];
      files.slice(0, room).forEach(file => {
        const id = agAttId();
        next.push({ id, name: file.name, src: '', file });
        const r = new FileReader();
        r.onload = (e) => setImgItems(cur => cur.map(it => it.id === id ? { ...it, src: e.target.result } : it));
        r.readAsDataURL(file);
      });
      return next;
    });
  };
  const removeImg = (id) => setImgItems(prev => prev.filter(it => it.id !== id));
  const sendImages = () => {
    if (!imgItems.length) return;
    if (!imgCaption.trim()) { showToast(CAPTION_REQUIRED, 'warn'); return; }
    sendItemsTogether('image', imgItems, imgCaption, (it) => ({ image: { name: it.name, src: it.src, size: 'Image' } }), 'Images');
    setImgItems([]); setImgCaption(''); setModal(null);
  };

  /* ── Documents (multi-select, up to 10) ── */
  const onPickDocs = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setDocItems(prev => {
      const room = ATTACH_LIMITS.document - prev.length;
      if (room <= 0) { showToast(`You can attach up to ${ATTACH_LIMITS.document} documents.`, 'warn'); return prev; }
      if (files.length > room) showToast(`Only ${ATTACH_LIMITS.document} documents allowed — extra files were skipped.`, 'warn');
      const next = files.slice(0, room).map(file => {
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        const sizeLabel = file.size > 1048576 ? (file.size / 1048576).toFixed(1) + ' MB' : Math.round(file.size / 1024) + ' KB';
        return { id: agAttId(), name: file.name, sizeLabel: `${sizeLabel} · ${ext.toUpperCase()}`, ext, file };
      });
      return [...prev, ...next];
    });
  };
  const removeDoc = (id) => setDocItems(prev => prev.filter(it => it.id !== id));
  const sendDocs = () => {
    if (!docItems.length) return;
    if (!docMsg.trim()) { showToast(CAPTION_REQUIRED, 'warn'); return; }
    sendItemsTogether('document', docItems, docMsg, (it) => ({ doc: { name: it.name, size: it.sizeLabel, ext: it.ext } }), 'Documents');
    setDocItems([]); setDocMsg(''); setModal(null);
  };

  /* ── Videos (multi-select, up to 5) ── */
  const onPickVideos = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setVideoItems(prev => {
      const room = ATTACH_LIMITS.video - prev.length;
      if (room <= 0) { showToast(`You can attach up to ${ATTACH_LIMITS.video} videos.`, 'warn'); return prev; }
      if (files.length > room) showToast(`Only ${ATTACH_LIMITS.video} videos allowed — extra files were skipped.`, 'warn');
      const next = files.slice(0, room).map(file => {
        const sizeLabel = file.size > 1048576 ? (file.size / 1048576).toFixed(1) + ' MB' : Math.round(file.size / 1024) + ' KB';
        return { id: agAttId(), name: file.name, src: URL.createObjectURL(file), file, sizeLabel };
      });
      return [...prev, ...next];
    });
  };
  const removeVideo = (id) => setVideoItems(prev => prev.filter(it => it.id !== id));
  const sendVideos = () => {
    if (!videoItems.length) return;
    if (!videoCaption.trim()) { showToast(CAPTION_REQUIRED, 'warn'); return; }
    sendItemsTogether('video', videoItems, videoCaption, (it) => ({ video: { name: it.name, src: it.src } }), 'Videos');
    setVideoItems([]); setVideoCaption(''); setModal(null);
  };

  /* ── Real voice recording (mic button); auto-stops at 5 min ── */
  const voice = useVoiceRecorder({ onAutoStop: (res) => finishVoice(res) });
  const startRec = async () => {
    const ok = await voice.start();
    if (!ok) showToast('Microphone unavailable or permission denied.', 'warn');
  };
  const cancelRec = () => voice.cancel();
  const sendRec = async () => {
    const res = await voice.stop();
    if (res && res.blob && res.durationSec > 0) finishVoice(res);
  };
  const finishVoice = async (res) => {
    /* Chrome sirf WebM record karta hai aur upload route voice ke liye WebM
       leti nahi ("File type '.webm' is not allowed for voice" — .mp3/.wav/
       .m4a/.ogg chalti hain), is liye zaroorat par recording WAV me badal kar
       bhejte hain. Caption bhi laazmi hai: khali bhejne par API 400 deti hai
       ("The caption field is required"), aur voice ka apna caption box nahi. */
    let out = { blob: res.blob, ext: mimeToExt(res.mimeType) };
    try {
      out = await toUploadableVoice(res.blob, res.mimeType);
    } catch (e) { /* convert na ho saka — asli blob ke saath aage barho */ }
    const file = new File([out.blob], `voice-${Date.now()}.${out.ext}`, { type: out.blob.type || res.mimeType });
    if (liveConnected) {
      chat.sendAttachment({ category: 'voice', file, voiceDuration: res.durationSec, caption: VOICE_NOTE_CAPTION })
        .then(() => showToast('Voice message sent', 'success'))
        .catch((err) => {
          showToast(err?.message || 'Voice message could not be sent', 'warn');
          append({ kind: 'out', audio: { duration: fmtSec(res.durationSec), seconds: res.durationSec, src: URL.createObjectURL(res.blob) }, time: nowTime() });
        });
    } else {
      append({ kind: 'out', audio: { duration: fmtSec(res.durationSec), seconds: res.durationSec, src: URL.createObjectURL(res.blob) }, time: nowTime() });
      showToast('Voice message sent', 'success');
    }
  };

  return (
    <div className="ag-root">
      <style>{AGENT_CSS}</style>

      {/* App-level top bar — hidden when embedded in the Super Admin shell */}
      {!embedded && (
      <div className="ag-topbar">
        <div className="ag-topbar-l">
          <div className="ag-logo"><i className="fa-solid fa-headset" aria-hidden="true"></i></div>
          <div>
            <div className="ag-topbar-ttl">Customer Support</div>
            <div className="ag-topbar-sub">Support Console · School Mentor</div>
          </div>
        </div>
        <div className="ag-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={activeTab === 'overview'}
            className={`ag-tab${activeTab === 'overview' ? ' ag-tab-on' : ''}`}
            onClick={() => setActiveTab('overview')}>
            <i className="fa-solid fa-gauge-high" aria-hidden="true"></i> Overview
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'inbox'}
            className={`ag-tab${activeTab === 'inbox' ? ' ag-tab-on' : ''}`}
            onClick={() => setActiveTab('inbox')}>
            <i className="fa-solid fa-inbox" aria-hidden="true"></i> Agent Inbox
          </button>
        </div>
        {showBack && (
          <button className="ag-back" type="button" onClick={() => { window.location.hash = ''; }}>
            <i className="fa-solid fa-arrow-left" aria-hidden="true"></i> Back to ERP
          </button>
        )}
      </div>
      )}

      {activeTab === 'overview' && <AgentOverview />}

      {activeTab === 'inbox' && (
      <div className="ag-shell">
        {/* Inbox — switch between schools' conversations */}
        <aside className="ag-inbox">
          <div className="ag-inbox-hd">
            <span><i className="fa-solid fa-inbox" aria-hidden="true"></i> Conversations</span>
            <span className="ag-inbox-count">{chat.activeSessions.length}</span>
          </div>
          <div className="ag-inbox-list">
            {chat.activeSessions.length === 0 && (
              <div className="ag-inbox-empty">
                {chatLoading
                  ? <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Loading conversations…</>
                  : liveConnected ? 'No active conversations yet.' : 'Offline — start the API to load conversations.'}
              </div>
            )}
            {chat.activeSessions.map((s) => (
              <button
                key={s.sessionId}
                className={`ag-inbox-row${s.sessionId === chat.sessionId ? ' ag-inbox-active' : ''}`}
                onClick={() => selectSession(s.sessionId)}
              >
                <div className="ag-inbox-av">{initials(s.schoolName)}</div>
                <div className="ag-inbox-main">
                  <div className="ag-inbox-top">
                    <span className="ag-inbox-name">{s.schoolName}</span>
                    <span className="ag-inbox-time">{s.lastMessageAt ? formatTime(s.lastMessageAt) : ''}</span>
                  </div>
                  <div className="ag-inbox-sub">
                    <span>{s.campusName || s.assignedAgentName || 'Support session'}</span>
                    {s.unreadCount > 0 && <span className="ag-inbox-badge">{s.unreadCount}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Chat column */}
        <div className="ag-chat">
          {/* Header */}
          <div className="ag-hdr">
            <div className="ag-hdr-l">
              {/* Naam/campus sirf khuli conversation se. Pehle yahan
                  "Daffodil Schools · Tarnol Campus" hard-coded gir jata tha,
                  is liye koi chat khuli na hone par bhi ek school ka naam
                  screen par nazar aata tha. */}
              <div className="ag-av ag-av-lg">{sessionOpen ? chatAvatar : '—'}</div>
              <div>
                <div className="ag-hdr-nm">{sessionOpen ? schoolName : 'No conversation open'}</div>
                {/* Yeh lakeer CONNECTION ki halat batati hai, school ki
                    nahi. Pehle yahan har waqt "Online" chamakta tha — school
                    ke naam ke neeche wo aisa lagta tha jaise school khud
                    online baithi ho (jab ke presence ka hub abhi band hai),
                    aur koi chat khuli na hone par bhi "Online" hi likha aata
                    tha. Ab: connect na ho to asli wajah, warna wahi jo is
                    waqt saamne hai. */}
                <div className="ag-hdr-st">
                  <i className="fa-solid fa-circle" style={{ fontSize: 7, color: chat.status === 'connected' ? '#16A34A' : '#F59E0B' }} aria-hidden="true"></i>{' '}
                  {chat.status !== 'connected'
                    ? liveStatusLabel(chat.status)
                    : sessionOpen
                      ? (campusName || 'Support session')
                      : 'Waiting for a conversation'}
                </div>
              </div>
            </div>
            <div className="ag-hdr-r">
              <button className="ag-hdr-btn" title="View previous sessions" onClick={openPrevSessions}>
                <i className="fa-solid fa-clock-rotate-left" aria-hidden="true"></i>
                {prevSessions.length > 0 && <span className="ag-hdr-badge">{prevSessions.length}</span>}
              </button>
              {sessionOpen && (
                <button className="ag-btn ag-btn-danger" onClick={closeCurrentSession}>
                  <i className="fa-solid fa-circle-xmark" aria-hidden="true"></i> Close Session
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="ag-msgs" ref={msgsRef}>
            {chatLoading && !messages.length && (
              <div className="ag-msgs-state">
                <i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
                <div className="ag-msgs-state-t">Loading conversation…</div>
              </div>
            )}
            {!chatLoading && !messages.length && (
              <div className="ag-msgs-state">
                <i className="fa-regular fa-comments" aria-hidden="true"></i>
                <div className="ag-msgs-state-t">
                  {!liveConnected
                    ? 'Support API is not reachable — no conversation can be loaded.'
                    : chat.activeSessions.length ? 'Select a conversation from the inbox' : 'No conversation open'}
                </div>
              </div>
            )}
            {chatItems.map(m => <AgMsg key={m.id} m={m} av={chatAvatar} onToast={showToast} />)}
            {remoteTyping && <AgMsg m={{ id: 'remote-typing', kind: 'typing' }} av={chatAvatar} onToast={showToast} />}
          </div>

          {/* Reply box — sirf khuli guftagu par. Band shuda session par yeh
              khada rehta tha aur agent likh kar bhejta reh sakta tha. */}
          {!sessionOpen ? (
            <div className="ag-reply ag-reply-off">
              <i className="fa-solid fa-comment-slash" aria-hidden="true"></i>
              {chat.activeSessions.length
                ? ' Select a conversation from the inbox to reply.'
                : ' No open conversation. New messages from schools will appear in the inbox.'}
            </div>
          ) : (
          <div className="ag-reply">
            <div className="ag-quick">
              {QUICK_REPLIES.map(([label, text]) => (
                <button key={label} className="ag-chip" onClick={() => { setInput(text); setTimeout(autoResize, 0); taRef.current?.focus(); }}>
                  {label}
                </button>
              ))}
            </div>

            <div className="ag-tray">
              <button className="ag-tbtn" onClick={() => setModal('image')}><i className="fa-solid fa-image" aria-hidden="true"></i> Image</button>
              <button className="ag-tbtn" onClick={() => setModal('video')}><i className="fa-solid fa-video" aria-hidden="true"></i> Video</button>
              <button className="ag-tbtn" onClick={() => setModal('doc')}><i className="fa-solid fa-file" aria-hidden="true"></i> Document</button>
              <button className="ag-tbtn" onClick={() => setModal('note')}><i className="fa-solid fa-note-sticky" aria-hidden="true"></i> Note</button>
              <button className="ag-tbtn ag-tbtn-bug" onClick={() => setModal('bug')}><i className="fa-solid fa-bug" aria-hidden="true"></i> Bug</button>
              <button className="ag-tbtn ag-tbtn-improv" onClick={() => setModal('improv')}><i className="fa-solid fa-lightbulb" aria-hidden="true"></i> Improvement</button>
            </div>

            {voice.recording ? (
              <div className="ag-vrec">
                <button className="ag-vrec-x" onClick={cancelRec} aria-label="Cancel"><i className="fa-solid fa-xmark" aria-hidden="true"></i></button>
                <div className="ag-vrec-bar">
                  <span className="ag-vrec-dot" />
                  <span className="ag-vrec-timer">{fmtSec(voice.seconds)}</span>
                  <Waveform />
                  <span className="ag-vrec-lbl">Recording…</span>
                </div>
                <button className="ag-send" onClick={sendRec} aria-label="Send"><i className="fa-solid fa-paper-plane" aria-hidden="true"></i></button>
              </div>
            ) : (
              <div className="ag-inrow">
                <div className="ag-inwrap">
                  <textarea
                    ref={taRef}
                    className="ag-ta"
                    rows={1}
                    placeholder="Type a message…"
                    value={input}
                    onChange={e => { setInput(e.target.value); autoResize(); onComposerType(); }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
                  />
                </div>
                <button className="ag-mic" onClick={startRec} title="Record voice message"><i className="fa-solid fa-microphone" aria-hidden="true"></i></button>
                <button className="ag-send" onClick={sendMsg} aria-label="Send"><i className="fa-solid fa-paper-plane" aria-hidden="true"></i></button>
              </div>
            )}
          </div>
          )}
        </div>

        {/* Right sidebar */}
        <aside className="ag-side">
          <div className="ag-side-hero">
            <div className="ag-av ag-av-xl">{sessionOpen ? initials(schoolName) : '—'}</div>
            <div className="ag-side-nm">{schoolName}</div>
            <div className="ag-side-sub">{liveSession?.campusName || schoolInfo?.campusName || '—'}</div>
            <div className="ag-side-badges">
              {schoolInfo && (
                <span className={`ag-badge ${schoolInfo.isActive === false ? 'ag-badge-closed' : 'ag-badge-green'}`}>
                  <i className="fa-solid fa-circle" style={{ fontSize: 7 }} aria-hidden="true"></i>
                  {schoolInfo.isActive === false ? ' Inactive' : ' Active'}
                </span>
              )}
            </div>
          </div>
          {/* Sab kuch API se: school ki tafseel /support/schools se, session ki
              /support/sessions se. Pehle yahan poore ke poore static naam pade
              thay (Dr. Asif Khan, Tariq Ahmed, "Premium" plan). */}
          <SideSection title="School Info" icon="fa-circle-info" rows={[
            ['School ID', openSchoolId || '—'],
            ['Principal', schoolInfo?.principalName || '—'],
            ['Contact', schoolInfo?.contactNumber || '—'],
            ['Campus', liveSession?.campusName || schoolInfo?.campusName || '—'],
          ]} />
          <SideSection title="Support" icon="fa-headset" rows={[
            ['Agent', liveSession?.agentName || 'Unassigned'],
            ['Session', liveSession?.sessionId ? `#${liveSession.sessionId}` : '—'],
            ['Opened', liveSession?.createdAt ? fmtDate(liveSession.createdAt) : '—'],
            ['Last Contact', liveSession?.lastMessageAt ? formatTime(liveSession.lastMessageAt) : '—'],
            ['Previous Sessions', prevSessions.length],
          ]} />
          <div className="ag-side-block">
            <div className="ag-side-lbl"><i className="fa-solid fa-note-sticky" aria-hidden="true"></i> Agent Notes</div>
            <textarea
              className="ag-side-ta"
              value={sideNote}
              placeholder={lastNote ? `Last note: ${lastNote.comment}` : 'Write an internal note for this school…'}
              onChange={e => setSideNote(e.target.value)}
            />
            <button className="ag-btn ag-btn-success ag-side-save" disabled={noteSaving} onClick={saveSideNote}>
              <i className={`fa-solid ${noteSaving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} aria-hidden="true"></i>
              {noteSaving ? ' Saving…' : ' Save Notes'}
            </button>
          </div>
        </aside>
      </div>
      )}

      {/* ── Modals ── */}
      {modal === 'note' && (
        <NoteModal form={noteForm} setForm={setNoteForm} onSave={saveNote} onClose={() => { setModal(null); setNoteForm({ title: '', details: '' }); }} />
      )}
      {modal === 'bug' && (
        <BugModal users={users} form={bugForm} setForm={setBugForm} onSubmit={submitBug} onClose={() => { setModal(null); setBugForm({ title: '', desc: '', module: '', priority: 'High', assignee: '' }); }} />
      )}
      {modal === 'improv' && (
        <ImprovModal users={users} form={improvForm} setForm={setImprovForm} onSubmit={submitImprov} onClose={() => { setModal(null); setImprovForm({ title: '', desc: '', module: '', priority: 'Medium', assignee: '' }); }} />
      )}
      {modal === 'image' && (
        <ImageModal items={imgItems} onRemove={removeImg} caption={imgCaption} setCaption={setImgCaption}
          onPick={onPickImages} onSend={sendImages} inputRef={imgInputRef}
          onClose={() => { setModal(null); setImgItems([]); setImgCaption(''); }} />
      )}
      {modal === 'doc' && (
        <DocModal items={docItems} onRemove={removeDoc} msg={docMsg} setMsg={setDocMsg}
          onPick={onPickDocs} onSend={sendDocs} inputRef={docInputRef}
          onClose={() => { setModal(null); setDocItems([]); setDocMsg(''); }} />
      )}
      {modal === 'video' && (
        <VideoModal items={videoItems} onRemove={removeVideo} caption={videoCaption} setCaption={setVideoCaption}
          onPick={onPickVideos} onSend={sendVideos} inputRef={videoInputRef}
          onClose={() => { setModal(null); setVideoItems([]); setVideoCaption(''); }} />
      )}

      {/* Previous Sessions (real closed-session history — agent/admin only) */}
      {prevOpen && (
        <PreviousSessionsModal
          schoolName={viewSchool?.schoolName}
          sessions={prevSessions}
          loading={prevLoading}
          onOpen={openPrevTranscript}
          onClose={() => setPrevOpen(false)}
        />
      )}
      {prevSession && (
        <SessionTranscriptModal session={prevSession} onClose={() => setPrevSession(null)} />
      )}

      {/* Close session — confirm with remarks */}
      {closeOpen && (
        <Modal title={{ icon: 'fa-circle-xmark', text: 'Close Support Session', sub: 'This moves the conversation to history.' }}
          titleColor="#DC2626"
          onClose={() => setCloseOpen(false)}
          footer={<>
            <button className="ag-btn ag-btn-secondary" onClick={() => setCloseOpen(false)}>Cancel</button>
            <button className="ag-btn ag-btn-danger" onClick={confirmClose}><i className="fa-solid fa-circle-check" aria-hidden="true" /> Close Session</button>
          </>}
        >
          <div className="ag-banner ag-banner-info" style={{ marginTop: 0, marginBottom: 14 }}>
            <i className="fa-solid fa-circle-info" aria-hidden="true" />
            <span>The school will instantly see a “session closed” message and can start a new chat.</span>
          </div>
          <label className="ag-lbl">Closing Remarks</label>
          <textarea className="ag-textarea" rows={3} placeholder="Summary of what was resolved…"
            value={closeRemarks} onChange={e => setCloseRemarks(e.target.value)} />
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div className={`ag-toast ag-toast-${toast.type}`}>
          <i className={`fa-solid ${toastIcon(toast.type)}`} aria-hidden="true"></i> {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
function SideSection({ title, icon, rows }) {
  return (
    <div className="ag-side-block">
      <div className="ag-side-lbl"><i className={`fa-solid ${icon}`} aria-hidden="true"></i> {title}</div>
      {rows.map(([k, v]) => (
        <div className="ag-side-row" key={k}><span>{k}</span><b>{v}</b></div>
      ))}
    </div>
  );
}

function AgMsg({ m, av = "SM", onToast }) {
  if (m.kind === 'daylabel') return <div className="ag-day"><span>{m.text}</span></div>;
  if (m.kind === 'sysnote') {
    return (
      <div className="ag-sysnote">
        <i className="fa-solid fa-note-sticky" aria-hidden="true"></i> {m.text}
      </div>
    );
  }
  if (m.kind === 'typing') {
    return (
      <div className="ag-row">
        <div className="ag-av">{av}</div>
        <div className="ag-bbl ag-in" style={{ padding: '8px 12px' }}>
          <div className="ag-typing"><span /><span /><span /></div>
        </div>
      </div>
    );
  }
  if (m.kind === 'note') {
    return (
      <div className="ag-card ag-card-note">
        <div className="ag-card-hd"><i className="fa-solid fa-note-sticky" aria-hidden="true"></i> {m.title} · Internal Only</div>
        {m.details && <div className="ag-card-note-body">{m.details}</div>}
      </div>
    );
  }
  if (m.kind === 'bug' || m.kind === 'improv') {
    const isBug = m.kind === 'bug';
    return (
      <div className={`ag-card ${isBug ? 'ag-card-bug' : 'ag-card-improv'}`}>
        <div className="ag-card-hd"><i className={`fa-solid ${isBug ? 'fa-bug' : 'fa-lightbulb'}`} aria-hidden="true"></i> {isBug ? 'Bug Reported' : 'Improvement Submitted'}</div>
        <div className="ag-card-ttl">{m.title}</div>
        <div className="ag-card-meta">
          <span>Priority: <b style={{ color: isBug ? BUG_PRIO_COLOR[m.priority] : '#1E3A8A' }}>{m.priority}</b></span>
          <span>Assigned: <b>{m.assignee}</b></span>
        </div>
      </div>
    );
  }

  const isOut = m.kind === 'out';

  /* Grouped multi-attachment bubble (gallery / grouped cards). */
  if (m._group) {
    return (
      <div className={`ag-row${isOut ? ' ag-out' : ''}`}>
        {!isOut && <div className="ag-av">{av}</div>}
        <div className="ag-bbl-wrap">
          {!isOut && m.sender && <div className="ag-sndr">{m.sender}</div>}
          <div className={`ag-bbl ${isOut ? 'ag-out' : 'ag-in'}`}>
            {m._group === 'image' && <ImageGallery items={m.items} />}
            {m._group === 'video' && <div className="ag-vgroup">{m.items.map((it, i) => <VideoBubble key={i} src={it.src} name={it.name} />)}</div>}
            {m._group === 'doc' && (
              <div className="ag-dgroup">{m.items.map((it, i) => (
                <DocAttachment key={i} url={it.url} name={it.name} size={it.size} ext={it.ext} onToast={onToast} />
              ))}</div>
            )}
            {m.text && <div className="ag-bbl-txt">{m.text}</div>}
            <div className="ag-meta">{m.time}{isOut && <Ticks status={m.status} />}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`ag-row${isOut ? ' ag-out' : ''}`}>
      {!isOut && <div className="ag-av">{av}</div>}
      <div className="ag-bbl-wrap">
        {!isOut && m.sender && <div className="ag-sndr">{m.sender}</div>}
        <div className={`ag-bbl ${isOut ? 'ag-out' : 'ag-in'}`}>
          {/* Attachment pehle, uska matn (caption) neeche — wahi tarteeb jo
              gallery/grouped bubble ki hai aur jo school-side widget dikhati
              hai. Pehle yahan text upar aur document neeche aata tha, is liye
              document ke saath bheja gaya paighaam attachment se pehle nazar
              aata tha. */}
          {m.image && m.image.src && <img src={m.image.src} alt="" className="ag-bbl-img" />}
          {m.video && m.video.src && <VideoBubble src={m.video.src} name={m.video.name} />}
          {m.image && !m.image.src && (
            <div className="ag-att" onClick={() => onToast('Opening image…', 'info')}>
              <div className="ag-att-ico" style={{ background: 'linear-gradient(135deg,#0284C7,#0EA5E9)' }}><i className="fa-solid fa-image" aria-hidden="true"></i></div>
              <div className="ag-att-tx"><div className="ag-att-nm">{m.image.name}</div><div className="ag-att-sz">{m.image.size}</div></div>
              <i className="fa-solid fa-download ag-att-dl" aria-hidden="true"></i>
            </div>
          )}
          {m.doc && (
            <DocAttachment url={m.doc.url} name={m.doc.name} size={m.doc.size} ext={m.doc.ext} onToast={onToast} />
          )}
          {m.audio && (
            <VoicePlayer src={m.audio.src} duration={m.audio.seconds || 0} accent="#1E3A8A" />
          )}
          {m.text && <div className="ag-bbl-txt">{m.text}</div>}
          <div className="ag-meta">{m.time}{isOut && <Ticks status={m.status} />}</div>
        </div>
      </div>
    </div>
  );
}

function Waveform() {
  return <div className="ag-vrec-wave">{Array.from({ length: 16 }, (_, i) => <span key={i} style={{ animationDelay: `${i * 0.05}s` }} />)}</div>;
}

/* ── Modal shell ── */
function Modal({ title, titleColor, onClose, children, footer, size }) {
  return (
    <div className="ag-ov" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`ag-modal${size === 'lg' ? ' ag-modal-lg' : ''}`} role="dialog" aria-modal="true">
        <div className="ag-modal-hd">
          <div className="ag-modal-ttl" style={titleColor ? { } : undefined}>
            <i className={`fa-solid ${title.icon}`} style={titleColor ? { color: titleColor } : undefined} aria-hidden="true"></i>
            <div>
              <div className="ag-modal-ttl-t">{title.text}</div>
              {title.sub && <div className="ag-modal-ttl-s">{title.sub}</div>}
            </div>
          </div>
          <button className="ag-modal-x" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </div>
        <div className="ag-modal-body">{children}</div>
        <div className="ag-modal-ft">{footer}</div>
      </div>
    </div>
  );
}

function NoteModal({ form, setForm, onSave, onClose }) {
  return (
    <Modal
      title={{ icon: 'fa-note-sticky', text: 'Add Internal Note', sub: 'Internal notes are never sent to schools' }}
      onClose={onClose}
      footer={<>
        <button className="ag-btn ag-btn-secondary" onClick={onClose}>Cancel</button>
        <button className="ag-btn ag-btn-primary" onClick={onSave}><i className="fa-solid fa-floppy-disk" aria-hidden="true"></i> Save Note</button>
      </>}
    >
      <div className="ag-banner ag-banner-warn">
        <i className="fa-solid fa-eye-slash" aria-hidden="true"></i>
        <span>Visibility: <b>Internal Note Only</b> — Schools will not see this note.</span>
      </div>
      <label className="ag-lbl">Note Title</label>
      <input className="ag-input" placeholder="e.g. Follow up required, Escalation note…" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
      <label className="ag-lbl">Note Details</label>
      <textarea className="ag-textarea" rows={5} placeholder="Write your internal support note here…" value={form.details} onChange={e => setForm(f => ({ ...f, details: e.target.value }))} />
    </Modal>
  );
}

function BugModal({ users, form, setForm, onSubmit, onClose }) {
  return (
    <Modal size="lg"
      title={{ icon: 'fa-bug', text: 'Report Bug', sub: 'Report a software issue identified during this support session' }}
      titleColor="#DC2626" onClose={onClose}
      footer={<>
        <button className="ag-btn ag-btn-secondary" onClick={onClose}>Cancel</button>
        <button className="ag-btn ag-btn-danger" onClick={onSubmit}><i className="fa-solid fa-bug" aria-hidden="true"></i> Submit Bug</button>
      </>}
    >
      <label className="ag-lbl">Bug Title <span className="ag-req">*</span></label>
      <input className="ag-input" placeholder="Short, clear description of the bug…" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
      <label className="ag-lbl">Bug Description <span className="ag-req">*</span></label>
      <textarea className="ag-textarea" rows={4} placeholder="Steps to reproduce, expected vs actual behavior…" value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} />
      {/* Module Enquiries table par [Required] hai — wahi column jo Schools
          Progress → Enquiries me dikhta hai. */}
      <label className="ag-lbl">Module <span className="ag-req">*</span></label>
      <input className="ag-input" placeholder="e.g. Fee, Attendance, Examination…" value={form.module} onChange={e => setForm(f => ({ ...f, module: e.target.value }))} />
      <div className="ag-grid">
        <div>
          <label className="ag-lbl">Priority <span className="ag-req">*</span></label>
          <select className="ag-input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
            {['Low', 'Medium', 'High', 'Critical'].map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="ag-lbl">Assign To</label>
          <select className="ag-input" value={form.assignee} onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))}>
            {/* Naam API se — id nahi, naam bhejte hain kyunki Enquiries table ka
                Developer column text hai (Schools Progress bhi wahi likhti hai). */}
            <option value="">{users.length ? 'Select user…' : 'Loading users…'}</option>
            {users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
          </select>
        </div>
      </div>
      <div className="ag-banner ag-banner-info">
        <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
        <span>This bug report will be submitted to the <b>Development Team</b> and visible in the <b>Super Admin Task Management</b> system.</span>
      </div>
    </Modal>
  );
}

function ImprovModal({ users, form, setForm, onSubmit, onClose }) {
  return (
    <Modal size="lg"
      title={{ icon: 'fa-lightbulb', text: 'Submit Improvement Request', sub: 'Suggest an enhancement based on this support conversation' }}
      titleColor="#7C3AED" onClose={onClose}
      footer={<>
        <button className="ag-btn ag-btn-secondary" onClick={onClose}>Cancel</button>
        <button className="ag-btn ag-btn-purple" onClick={onSubmit}><i className="fa-solid fa-lightbulb" aria-hidden="true"></i> Submit Improvement</button>
      </>}
    >
      <label className="ag-lbl">Improvement Title <span className="ag-req ag-req-p">*</span></label>
      <input className="ag-input" placeholder="Short title for the improvement…" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
      <label className="ag-lbl">Improvement Description <span className="ag-req ag-req-p">*</span></label>
      <textarea className="ag-textarea" rows={4} placeholder="Describe what should be improved and why it matters to schools…" value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} />
      {/* Bug ki tarah, Enquiries table par Module [Required] hai. */}
      <label className="ag-lbl">Module <span className="ag-req ag-req-p">*</span></label>
      <input className="ag-input" placeholder="e.g. Fee, Attendance, Examination…" value={form.module} onChange={e => setForm(f => ({ ...f, module: e.target.value }))} />
      <div className="ag-grid">
        <div>
          <label className="ag-lbl">Priority</label>
          <select className="ag-input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
            {['Low', 'Medium', 'High'].map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="ag-lbl">Assign To</label>
          <select className="ag-input" value={form.assignee} onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))}>
            {/* Naam API se — id nahi, naam bhejte hain kyunki Enquiries table ka
                Developer column text hai (Schools Progress bhi wahi likhti hai). */}
            <option value="">{users.length ? 'Select user…' : 'Loading users…'}</option>
            {users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
          </select>
        </div>
      </div>
      <div className="ag-banner ag-banner-purple">
        <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
        <span>This improvement request will be submitted to the <b>Development Team</b> and <b>Super Admin</b> for review and prioritization.</span>
      </div>
    </Modal>
  );
}

function ImageModal({ items, onRemove, caption, setCaption, onPick, onSend, inputRef, onClose }) {
  return (
    <Modal title={{ icon: 'fa-image', text: 'Send Images' }} onClose={onClose}
      footer={<>
        <button className="ag-btn ag-btn-secondary" onClick={onClose}>Cancel</button>
        <button className="ag-btn ag-btn-wa" onClick={onSend} disabled={!items.length}><i className="fa-solid fa-paper-plane" aria-hidden="true"></i> Send{items.length ? ` (${items.length})` : ''}</button>
      </>}
    >
      <div className="ag-drop" onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const fs = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')); if (fs.length) onPick(fs); }}>
        <i className="fa-solid fa-cloud-arrow-up ag-drop-ic" aria-hidden="true"></i>
        <div className="ag-drop-t">Click to upload or drag &amp; drop</div>
        <div className="ag-drop-s">PNG, JPG, WEBP — up to {ATTACH_LIMITS.image} images</div>
        <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { onPick(e.target.files); e.target.value = ''; }} />
      </div>
      {items.length > 0 && (
        <>
          <label className="ag-lbl" style={{ marginTop: 12 }}>{items.length}/{ATTACH_LIMITS.image} selected</label>
          <div className="ag-thumbs">
            {items.map(it => (
              <div className="ag-thumb" key={it.id}>
                {it.src ? <img src={it.src} alt="" /> : <div className="ag-thumb-load"><i className="fa-solid fa-spinner fa-spin" /></div>}
                <button className="ag-thumb-x" onClick={() => onRemove(it.id)} aria-label="Remove"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
              </div>
            ))}
          </div>
        </>
      )}
      <label className="ag-lbl">Caption</label>
      <textarea className="ag-textarea" rows={2} placeholder="Add a caption…" value={caption} onChange={e => setCaption(e.target.value)} />
    </Modal>
  );
}

function VideoModal({ items, onRemove, caption, setCaption, onPick, onSend, inputRef, onClose }) {
  return (
    <Modal title={{ icon: 'fa-video', text: 'Send Videos' }} onClose={onClose}
      footer={<>
        <button className="ag-btn ag-btn-secondary" onClick={onClose}>Cancel</button>
        <button className="ag-btn ag-btn-wa" onClick={onSend} disabled={!items.length}><i className="fa-solid fa-paper-plane" aria-hidden="true"></i> Send{items.length ? ` (${items.length})` : ''}</button>
      </>}
    >
      <div className="ag-drop" onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const fs = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/')); if (fs.length) onPick(fs); }}>
        <i className="fa-solid fa-film ag-drop-ic" aria-hidden="true"></i>
        <div className="ag-drop-t">Click to upload or drag &amp; drop</div>
        <div className="ag-drop-s">MP4, WEBM — up to {ATTACH_LIMITS.video} videos</div>
        <input ref={inputRef} type="file" accept="video/mp4,video/webm" multiple style={{ display: 'none' }} onChange={e => { onPick(e.target.files); e.target.value = ''; }} />
      </div>
      {items.length > 0 && (
        <>
          <label className="ag-lbl" style={{ marginTop: 12 }}>{items.length}/{ATTACH_LIMITS.video} selected</label>
          {items.map(it => (
            <div className="ag-dprev" key={it.id} style={{ marginBottom: 7 }}>
              <div className="ag-att-ico" style={{ background: 'linear-gradient(135deg,#7C3AED,#A855F7)' }}><i className="fa-solid fa-play" aria-hidden="true" /></div>
              <div className="ag-att-tx"><div className="ag-att-nm">{it.name}</div><div className="ag-att-sz">{it.sizeLabel}</div></div>
              <button className="ag-dprev-x" onClick={() => onRemove(it.id)} aria-label="Remove"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
            </div>
          ))}
        </>
      )}
      <label className="ag-lbl">Caption</label>
      <textarea className="ag-textarea" rows={2} placeholder="Add a caption…" value={caption} onChange={e => setCaption(e.target.value)} />
    </Modal>
  );
}

function DocModal({ items, onRemove, msg, setMsg, onPick, onSend, inputRef, onClose }) {
  return (
    <Modal title={{ icon: 'fa-file', text: 'Send Documents' }} onClose={onClose}
      footer={<>
        <button className="ag-btn ag-btn-secondary" onClick={onClose}>Cancel</button>
        <button className="ag-btn ag-btn-wa" onClick={onSend} disabled={!items.length}><i className="fa-solid fa-paper-plane" aria-hidden="true"></i> Send{items.length ? ` (${items.length})` : ''}</button>
      </>}
    >
      <div className="ag-drop" onClick={() => inputRef.current?.click()}>
        <i className="fa-solid fa-file-arrow-up ag-drop-ic" aria-hidden="true"></i>
        <div className="ag-drop-t">Click to upload documents</div>
        <div className="ag-drop-s">PDF, DOC, DOCX — up to {ATTACH_LIMITS.document} files</div>
        <input ref={inputRef} type="file" accept=".pdf,.doc,.docx" multiple style={{ display: 'none' }} onChange={e => { onPick(e.target.files); e.target.value = ''; }} />
      </div>
      {items.length > 0 && (
        <>
          <label className="ag-lbl" style={{ marginTop: 12 }}>{items.length}/{ATTACH_LIMITS.document} selected</label>
          {items.map(it => (
            <div className="ag-dprev" key={it.id} style={{ marginBottom: 7 }}>
              <div className="ag-att-ico" style={{ background: docColor(it.ext) }}><i className={`fa-solid ${docIcon(it.ext)}`} aria-hidden="true" /></div>
              <div className="ag-att-tx"><div className="ag-att-nm">{it.name}</div><div className="ag-att-sz">{it.sizeLabel}</div></div>
              <button className="ag-dprev-x" onClick={() => onRemove(it.id)} aria-label="Remove"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
            </div>
          ))}
        </>
      )}
      <label className="ag-lbl">Message</label>
      <textarea className="ag-textarea" rows={2} placeholder="Add a message…" value={msg} onChange={e => setMsg(e.target.value)} />
    </Modal>
  );
}

/* ── Previous Sessions (real closed-session history) — agent/admin only ── */
function PreviousSessionsModal({ schoolName, sessions, loading, onOpen, onClose }) {
  return (
    <Modal title={{ icon: 'fa-clock-rotate-left', text: 'Previous Support Sessions', sub: schoolName ? `Closed conversations · ${schoolName}` : 'Closed conversation history' }} onClose={onClose}
      footer={<button className="ag-btn ag-btn-secondary" onClick={onClose}>Close</button>}
    >
      {loading ? (
        <div className="ag-prev-empty"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Loading history…</div>
      ) : sessions.length === 0 ? (
        <div className="ag-prev-empty">No previous (closed) sessions for this school yet.</div>
      ) : (
        <div className="ag-prev-list">
          {sessions.map(s => (
            <button key={s.sessionId} className="ag-prev-row" onClick={() => onOpen(s)}>
              <div className="ag-prev-ic">#{s.sessionNumber}</div>
              <div className="ag-prev-main">
                <div className="ag-prev-top">
                  <span className="ag-prev-ttl">Session #{s.sessionNumber}</span>
                  <span className="ag-badge ag-badge-closed">Closed</span>
                </div>
                <div className="ag-prev-sub">{fmtDate(s.closedAt || s.createdAt)} · Handled by {s.assignedAgentName || 'Unassigned'}</div>
                <div className="ag-prev-meta">
                  <span><i className="fa-regular fa-comment" aria-hidden="true" /> {s.totalMessages} messages</span>
                  <span><i className="fa-solid fa-paperclip" aria-hidden="true" /> {s.totalAttachments} attachments</span>
                </div>
                {s.closingRemarks && <div className="ag-prev-rmk">{s.closingRemarks}</div>}
              </div>
              <i className="fa-solid fa-chevron-right ag-prev-arrow" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

function SessionTranscriptModal({ session, onClose }) {
  return (
    <Modal size="lg" title={{ icon: 'fa-comments', text: session.subject, sub: `${session.date} · Handled by ${session.handledBy}` }} onClose={onClose}
      footer={<button className="ag-btn ag-btn-secondary" onClick={onClose}>Close</button>}
    >
      <div className="ag-trans-meta">
        <span><i className="fa-regular fa-comment" aria-hidden="true" /> {session.totalMessages} messages</span>
        <span><i className="fa-solid fa-paperclip" aria-hidden="true" /> {session.totalAttachments} attachments</span>
        <span className="ag-badge ag-badge-closed">Closed</span>
      </div>
      <div className="ag-transcript">
        {groupChatItems(session.messages).map(m => <AgMsg key={m.id} m={m} onToast={() => {}} />)}
        <div className="ag-closed-card">
          <i className="fa-solid fa-circle-check" aria-hidden="true" /> Closed by {session.closedBy} at {session.closedAt}
          <div className="ag-closed-rmk">“{session.closingRemarks}”</div>
        </div>
      </div>
    </Modal>
  );
}

/* ── helpers ── */
function initials(name) {
  return (name || '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}
/* API 12-ghante ki clock me waqt likhti hai (AM/PM gira kar), is liye har
   timestamp serverDate se guzarta hai — dekho support/time.js. */
function fmtDate(iso) {
  const d = serverDate(iso);
  if (!d) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
/* Document bubble. Download ho jane par teer hat jata hai (refresh ke baad
   bhi) — pehle hamesha laga rehta tha, chahe file kai baar utar chuki ho. */
function DocAttachment({ url, name, size, ext, onToast }) {
  const key = downloadKey(url, name);
  const [done, setDone] = useState(() => isDownloaded(key));
  const inner = (
    <>
      <div className="ag-att-ico" style={{ background: docColor(ext) }}><i className={`fa-solid ${docIcon(ext)}`} aria-hidden="true" /></div>
      <div className="ag-att-tx"><div className="ag-att-nm">{name}</div><div className="ag-att-sz">{size}</div></div>
      {!done && <i className="fa-solid fa-download ag-att-dl" aria-hidden="true" />}
    </>
  );
  if (!url) {
    return (
      <div className="ag-att" onClick={() => onToast?.('File not available', 'warn')}>
        <div className="ag-att-ico" style={{ background: docColor(ext) }}><i className={`fa-solid ${docIcon(ext)}`} aria-hidden="true" /></div>
        <div className="ag-att-tx"><div className="ag-att-nm">{name}</div><div className="ag-att-sz">{size}</div></div>
      </div>
    );
  }
  return (
    <a
      href={url} target="_blank" rel="noreferrer" download={name} className="ag-att"
      title={done ? 'Downloaded — click to open again' : 'Download'}
      onClick={() => { markDownloaded(key); setDone(true); }}
      style={{ textDecoration: 'none' }}
    >
      {inner}
    </a>
  );
}

/* Delivery/read ticks: Sent = single, Delivered = double grey, Read = double blue.
   Default JAAN BUJH KAR single hai: pehle default blue tha, is liye jis bubble
   ke paas status hota hi nahi (locally bana hua echo) wo foran "seen" dikhta
   tha halanke school ne dekha tak nahi hota tha. */
function Ticks({ status }) {
  const s = Number(status) || MessageStatus.Sent;
  if (s >= MessageStatus.Read) return <i className="fa-solid fa-check-double ag-ticks" aria-hidden="true" />;
  if (s === MessageStatus.Delivered) return <i className="fa-solid fa-check-double ag-tick-deliv" aria-hidden="true" />;
  return <i className="fa-solid fa-check ag-tick-sent" aria-hidden="true" />;
}
/* Connection ka haal. `default` par pehle "Online" tha — yani abhi connect
   hua hi na ho (status: idle) tab bhi screen "Online" keh deti thi. */
function liveStatusLabel(status) {
  switch (status) {
    case 'connected': return 'Online';
    case 'connecting': return 'Connecting…';
    case 'reconnecting': return 'Reconnecting…';
    case 'offline': return 'Offline';
    case 'error': return 'Auth error';
    default: return 'Connecting…';
  }
}
function fmtSec(s) { const m = Math.floor(s / 60); const ss = s % 60; return `${m}:${ss < 10 ? '0' : ''}${ss}`; }
function mimeToExt(mime) {
  const t = (mime || '').toLowerCase();
  if (t.includes('webm')) return 'webm';
  if (t.includes('ogg')) return 'ogg';
  if (t.includes('mp4') || t.includes('m4a') || t.includes('aac')) return 'm4a';
  if (t.includes('mpeg') || t.includes('mp3')) return 'mp3';
  if (t.includes('wav')) return 'wav';
  return 'webm';
}
function docIcon(ext) { return ({ pdf: 'fa-file-pdf', doc: 'fa-file-word', docx: 'fa-file-word', xls: 'fa-file-excel', xlsx: 'fa-file-excel' }[ext]) || 'fa-file'; }
function docColor(ext) { const c = ({ pdf: '#DC2626', doc: '#1E40AF', docx: '#1E40AF', xls: '#16A34A', xlsx: '#16A34A' }[ext]) || 'var(--ag-tm)'; return `linear-gradient(135deg,${c},${c}99)`; }
function toastIcon(t) { return ({ success: 'fa-circle-check', warn: 'fa-triangle-exclamation', info: 'fa-circle-info' }[t]) || 'fa-circle-info'; }

/* ═══════════════════════════════════════════════════════════════ */
const AGENT_CSS = `
.ag-root { position: fixed; inset: 0; z-index: 9000; display: flex; flex-direction: column; background: var(--ag-bg); font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: var(--ag-t1); }
.ag-root * { box-sizing: border-box; }

/* Theme tokens. Light defaults here; the dark block below applies when the
   console is standalone with data-theme="dark", OR (the common case) when it
   is embedded inside the Super Admin shell while that shell is in dark mode —
   so the Support console follows the Super Admin theme automatically.
   OVERVIEW_CSS (rendered inside .ag-root) inherits these same variables. */
.ag-root {
  --ag-bg: #EEF2F9; --ag-panel: #FFFFFF; --ag-msg-bg: #E8EEF7;
  --ag-soft: #F1F5F9; --ag-soft2: #F8FAFC; --ag-tint: #EFF6FF; --ag-tint2: #F0F4FF;
  --ag-bd: #E2E8F0; --ag-bd2: #BFDBFE;
  --ag-t1: #0F172A; --ag-t2: #1E3A5F; --ag-t3: #475569; --ag-tm: #64748B; --ag-tm2: #94A3B8;
  --ag-out-bbl: #DCF8C6; --ag-daypill: rgba(255,255,255,.8);
}
.ag-root[data-theme="dark"],
.sa-root[data-theme="dark"] .ag-root {
  --ag-bg: #080D1A; --ag-panel: #0E1628; --ag-msg-bg: #0A1322;
  --ag-soft: #131F38; --ag-soft2: #101A30; --ag-tint: #16223C; --ag-tint2: #0E1830;
  --ag-bd: #1C2E50; --ag-bd2: #243858;
  --ag-t1: #E2E8F8; --ag-t2: #B8C8E8; --ag-t3: #9FB2D4; --ag-tm: #7488AC; --ag-tm2: #5E739A;
  --ag-out-bbl: #143527; --ag-daypill: rgba(148,163,184,.14);
}

/* Top bar */
.ag-topbar { flex-shrink: 0; height: 56px; background: linear-gradient(135deg,#128C7E,#1E3A8A 90%); display: flex; align-items: center; justify-content: space-between; padding: 0 18px; color: #fff; }
.ag-topbar-l { display: flex; align-items: center; gap: 11px; }
.ag-logo { width: 36px; height: 36px; border-radius: 10px; background: rgba(255,255,255,.18); display: flex; align-items: center; justify-content: center; font-size: 18px; }
.ag-topbar-ttl { font-size: 14px; font-weight: 800; }
/* Module tabs (Overview / Agent Inbox) */
.ag-tabs { display: flex; gap: 4px; background: rgba(255,255,255,.12); padding: 4px; border-radius: 11px; }
.ag-tab { display: inline-flex; align-items: center; gap: 7px; height: 32px; padding: 0 16px; border: none; border-radius: 8px; background: transparent; color: rgba(255,255,255,.82); font-family: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; transition: all .15s; white-space: nowrap; }
.ag-tab:hover { color: #fff; background: rgba(255,255,255,.1); }
.ag-tab-on, .ag-tab-on:hover { background: var(--ag-panel); color: #1E3A8A; }
.ag-topbar-sub { font-size: 10.5px; color: rgba(255,255,255,.7); }
.ag-back { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 14px; border-radius: 9px; background: rgba(255,255,255,.16); color: #fff; font-size: 12.5px; font-weight: 700; text-decoration: none; cursor: pointer; }
.ag-back:hover { background: rgba(255,255,255,.26); }

/* Shell */
.ag-shell { flex: 1; display: flex; min-height: 0; padding: 14px; gap: 14px; }
.ag-chat { flex: 1; min-width: 0; display: flex; flex-direction: column; background: var(--ag-panel); border: 1px solid var(--ag-bd); border-radius: 16px; overflow: hidden; box-shadow: 0 6px 22px rgba(30,58,138,.08); }

/* Header */
.ag-hdr { flex-shrink: 0; padding: 12px 16px; border-bottom: 1px solid var(--ag-bd); display: flex; align-items: center; justify-content: space-between; }
.ag-hdr-l { display: flex; align-items: center; gap: 11px; }
.ag-hdr-nm { font-size: 14px; font-weight: 800; }
.ag-hdr-st { font-size: 11px; color: #25D366; font-weight: 600; display: flex; align-items: center; gap: 5px; margin-top: 2px; }
.ag-hdr-r { display: flex; align-items: center; gap: 8px; }
.ag-hdr-btn { position: relative; width: 36px; height: 36px; border-radius: 9px; border: 1.5px solid var(--ag-bd); background: var(--ag-panel); color: var(--ag-tm); cursor: pointer; font-size: 14px; }
.ag-hdr-badge { position: absolute; top: -4px; right: -4px; width: 16px; height: 16px; border-radius: 50%; background: #1E3A8A; color: #fff; font-size: 8.5px; font-weight: 800; display: flex; align-items: center; justify-content: center; border: 1.5px solid #fff; }

.ag-av { width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; background: linear-gradient(135deg,#1E3A8A,#2563EB); color: #fff; font-size: 10px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.ag-av-lg { width: 40px; height: 40px; border-radius: 12px; font-size: 13px; }
.ag-av-xl { width: 52px; height: 52px; border-radius: 16px; font-size: 18px; margin: 0 auto 10px; }

/* Messages */
.ag-msgs { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 4px; background: var(--ag-msg-bg); }
.ag-day { text-align: center; margin: 12px 0; }
.ag-day span { background: var(--ag-daypill); border: 1px solid var(--ag-bd2); border-radius: 99px; padding: 4px 14px; font-size: 11px; font-weight: 700; color: var(--ag-tm); }
/* Avatar bubble ke UPAR se align — flex-end par lambi message ke sath neeche
   ja kar chipakta tha, jo dekhne me theek nahi lagta. */
.ag-row { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 8px; }
.ag-row.ag-out { justify-content: flex-end; }
.ag-bbl-wrap { max-width: 66%; }
.ag-sndr { font-size: 10.5px; font-weight: 800; color: #1E3A8A; margin-bottom: 3px; }
.ag-bbl { border-radius: 14px; padding: 10px 13px; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
.ag-bbl.ag-in { background: var(--ag-panel); border-top-left-radius: 4px; }
.ag-bbl.ag-out { background: var(--ag-out-bbl); border-top-right-radius: 4px; }
.ag-bbl-txt { font-size: 13.5px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; }
.ag-bbl-img { max-width: 100%; border-radius: 9px; display: block; margin-bottom: 6px; }
.ag-meta { font-size: 10px; color: var(--ag-tm); margin-top: 5px; text-align: right; display: flex; align-items: center; justify-content: flex-end; gap: 4px; }
.ag-ticks { color: #53bdeb; font-size: 10px; }

/* Attachments inside bubbles */
.ag-att { background: var(--ag-soft); border: 1.5px solid var(--ag-bd); border-radius: 10px; padding: 10px 12px; display: flex; align-items: center; gap: 10px; cursor: pointer; margin-top: 4px; }
.ag-att-ico { width: 36px; height: 36px; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #fff; font-size: 15px; }
.ag-att-tx { min-width: 0; }
.ag-att-nm { font-size: 12.5px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ag-att-sz { font-size: 10.5px; color: var(--ag-tm); }
.ag-att-dl { color: var(--ag-tm); font-size: 12px; margin-left: auto; }

/* Audio */
.ag-aud { display: flex; align-items: center; gap: 10px; min-width: 200px; }
.ag-aud-play { width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg,#1E3A8A,#2563EB); border: none; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 13px; cursor: pointer; flex-shrink: 0; }
.ag-aud-bar { height: 4px; background: var(--ag-bd2); border-radius: 4px; }
.ag-aud-bar > div { width: 35%; height: 100%; background: #1E3A8A; border-radius: 4px; }
.ag-aud-dur { font-size: 10px; color: var(--ag-tm); margin-top: 4px; }
.ag-aud-mic { color: var(--ag-tm); font-size: 12px; }

/* System note + cards */
.ag-sysnote { background: rgba(217,119,6,.08); border: 1px dashed rgba(217,119,6,.4); border-radius: 10px; padding: 8px 12px; font-size: 12px; color: #b45309; font-style: italic; max-width: 70%; margin: 4px auto; text-align: center; }
.ag-card { border-radius: 12px; padding: 12px 14px; margin: 6px auto; max-width: 75%; }
.ag-card-hd { font-size: 11px; font-weight: 800; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
.ag-card-ttl { font-size: 13px; font-weight: 700; color: var(--ag-t1); margin-bottom: 4px; }
.ag-card-meta { display: flex; gap: 12px; flex-wrap: wrap; font-size: 11.5px; color: var(--ag-tm); }
.ag-card-note { background: rgba(217,119,6,.08); border: 1px dashed rgba(217,119,6,.45); max-width: 70%; }
.ag-card-note .ag-card-hd { color: #b45309; }
.ag-card-note-body { font-size: 12.5px; color: #92400e; line-height: 1.5; font-style: italic; }
.ag-card-bug { background: rgba(220,38,38,.04); border: 1.5px solid rgba(220,38,38,.2); }
.ag-card-bug .ag-card-hd { color: #DC2626; }
.ag-card-improv { background: rgba(124,58,237,.04); border: 1.5px solid rgba(124,58,237,.2); }
.ag-card-improv .ag-card-hd { color: #7C3AED; }

/* Typing */
.ag-typing { display: flex; gap: 3px; }
.ag-typing span { width: 6px; height: 6px; border-radius: 50%; background: var(--ag-tm); animation: agTyp 1.2s ease-in-out infinite; }
.ag-typing span:nth-child(2) { animation-delay: .14s; }
.ag-typing span:nth-child(3) { animation-delay: .28s; }
@keyframes agTyp { 0%,100% { transform: translateY(0); opacity: .4; } 50% { transform: translateY(-4px); opacity: 1; } }

/* Reply box */
.ag-reply { flex-shrink: 0; border-top: 1px solid var(--ag-bd); background: var(--ag-panel); padding: 10px 14px; }
.ag-reply-off { display: flex; align-items: center; gap: 8px; justify-content: center; color: var(--ag-tm); font-size: 12.5px; font-weight: 600; }
.ag-quick { display: flex; gap: 6px; margin-bottom: 8px; overflow-x: auto; padding-bottom: 2px; }
.ag-chip { flex-shrink: 0; height: 28px; padding: 0 12px; border-radius: 99px; border: 1.5px solid var(--ag-bd); background: var(--ag-soft2); color: var(--ag-t3); font-size: 11.5px; font-weight: 600; cursor: pointer; white-space: nowrap; font-family: inherit; transition: all .15s; }
.ag-chip:hover { border-color: #1E3A8A; color: #1E3A8A; background: var(--ag-tint); }
.ag-tray { display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
.ag-tbtn { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 10px; border-radius: 8px; border: 1.5px solid var(--ag-bd); background: var(--ag-soft2); color: var(--ag-t3); font-size: 11.5px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all .15s; }
.ag-tbtn:hover { border-color: #1E3A8A; color: #1E3A8A; background: var(--ag-tint); }
.ag-tbtn-bug { border-color: rgba(220,38,38,.4); color: #DC2626; }
.ag-tbtn-bug:hover { border-color: #DC2626; color: #DC2626; background: rgba(220,38,38,.07); }
.ag-tbtn-improv { border-color: rgba(124,58,237,.4); color: #7C3AED; }
.ag-tbtn-improv:hover { border-color: #7C3AED; color: #7C3AED; background: rgba(124,58,237,.07); }

.ag-inrow { display: flex; align-items: flex-end; gap: 8px; }
.ag-inwrap { flex: 1; background: var(--ag-soft); border: 1.5px solid var(--ag-bd); border-radius: 14px; padding: 8px 14px; display: flex; align-items: center; }
.ag-inwrap:focus-within { border-color: #1E3A8A; box-shadow: 0 0 0 3px rgba(30,58,138,.08); }
.ag-ta { flex: 1; border: none; background: transparent; outline: none; font-size: 13.5px; color: var(--ag-t1); resize: none; min-height: 22px; max-height: 100px; font-family: inherit; line-height: 1.5; }
.ag-mic { width: 42px; height: 42px; border-radius: 50%; border: 1.5px solid var(--ag-bd); background: var(--ag-panel); color: var(--ag-tm); display: flex; align-items: center; justify-content: center; font-size: 17px; cursor: pointer; flex-shrink: 0; }
.ag-mic:hover { background: var(--ag-tint); color: #1E3A8A; border-color: #1E3A8A; }
.ag-send { width: 42px; height: 42px; border-radius: 50%; border: none; background: linear-gradient(135deg,#128C7E,#25D366); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 16px; cursor: pointer; box-shadow: 0 4px 12px rgba(37,211,102,.35); flex-shrink: 0; }

/* Voice recording */
.ag-vrec { display: flex; align-items: center; gap: 10px; }
.ag-vrec-x { width: 38px; height: 38px; border-radius: 50%; border: 1.5px solid rgba(220,38,38,.3); background: rgba(220,38,38,.06); color: #DC2626; cursor: pointer; flex-shrink: 0; font-size: 14px; }
.ag-vrec-bar { flex: 1; background: var(--ag-soft); border: 1.5px solid var(--ag-bd); border-radius: 14px; padding: 10px 16px; display: flex; align-items: center; gap: 12px; }
.ag-vrec-dot { width: 10px; height: 10px; border-radius: 50%; background: #DC2626; flex-shrink: 0; animation: agPulse 1s infinite; }
@keyframes agPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .3; transform: scale(1.35); } }
.ag-vrec-timer { font-size: 13.5px; font-weight: 800; min-width: 34px; }
.ag-vrec-lbl { font-size: 11.5px; color: var(--ag-tm); font-weight: 600; }
.ag-vrec-wave { flex: 1; display: flex; align-items: center; gap: 2px; }
.ag-vrec-wave span { width: 3px; height: 4px; border-radius: 2px; background: #1E3A8A; animation: agWave 1s ease-in-out infinite; }
@keyframes agWave { 0%,100% { height: 4px; } 50% { height: 20px; } }

/* Inbox (left column — conversation switcher) */
.ag-inbox { width: 270px; flex-shrink: 0; display: flex; flex-direction: column; overflow: hidden; background: var(--ag-panel); border: 1px solid var(--ag-bd); border-radius: 16px; box-shadow: 0 6px 22px rgba(30,58,138,.08); }
.ag-inbox-hd { flex-shrink: 0; padding: 14px 16px; border-bottom: 1px solid var(--ag-bd); display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: 800; color: var(--ag-t1); }
.ag-inbox-hd i { color: #1E3A8A; margin-right: 6px; }
.ag-inbox-count { background: var(--ag-tint); color: #1E3A8A; font-size: 11px; font-weight: 800; border-radius: 99px; padding: 2px 8px; }
.ag-inbox-list { flex: 1; overflow-y: auto; padding: 6px; }
.ag-inbox-empty { padding: 24px 14px; text-align: center; color: var(--ag-tm2); font-size: 12.5px; line-height: 1.5; }

/* Chat pane ki loading / khali halat — data aane se pehle yahi dikhta hai. */
.ag-msgs-state { margin: auto; text-align: center; color: var(--ag-tm2); padding: 30px 16px; }
.ag-msgs-state i { font-size: 24px; opacity: .5; display: block; margin-bottom: 10px; }
.ag-msgs-state-t { font-size: 13px; font-weight: 700; }
.ag-inbox-row { width: 100%; display: flex; gap: 10px; align-items: center; padding: 10px; border: none; background: transparent; border-radius: 11px; cursor: pointer; text-align: left; font-family: inherit; transition: background .15s; }
.ag-inbox-row:hover { background: var(--ag-soft); }
.ag-inbox-active, .ag-inbox-active:hover { background: var(--ag-tint); box-shadow: inset 3px 0 0 #1E3A8A; }
.ag-inbox-av { width: 38px; height: 38px; border-radius: 11px; flex-shrink: 0; background: linear-gradient(135deg,#1E3A8A,#2563EB); color: #fff; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.ag-inbox-main { flex: 1; min-width: 0; }
.ag-inbox-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.ag-inbox-name { font-size: 13px; font-weight: 700; color: var(--ag-t1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ag-inbox-time { font-size: 10px; color: var(--ag-tm2); flex-shrink: 0; }
.ag-inbox-sub { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 2px; }
.ag-inbox-sub > span:first-child { font-size: 11.5px; color: var(--ag-tm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ag-inbox-badge { flex-shrink: 0; min-width: 18px; height: 18px; border-radius: 9px; background: #DC2626; color: #fff; font-size: 10px; font-weight: 800; display: flex; align-items: center; justify-content: center; padding: 0 5px; }

/* Right sidebar */
.ag-side { width: 270px; flex-shrink: 0; background: var(--ag-panel); border: 1px solid var(--ag-bd); border-radius: 16px; overflow-y: auto; box-shadow: 0 6px 22px rgba(30,58,138,.08); }
.ag-side-hero { padding: 18px 16px; border-bottom: 1px solid var(--ag-bd); text-align: center; background: linear-gradient(135deg,rgba(30,58,138,.04),transparent); }
.ag-side-nm { font-size: 14px; font-weight: 800; }
.ag-side-sub { font-size: 12px; color: var(--ag-tm); margin-top: 2px; }
.ag-side-badges { display: flex; justify-content: center; gap: 6px; margin-top: 10px; }
.ag-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 700; padding: 3px 9px; border-radius: 99px; }
.ag-badge-green { background: rgba(22,163,74,.12); color: #16A34A; border: 1px solid rgba(22,163,74,.3); }
.ag-badge-wa { background: rgba(37,211,102,.12); color: #128C7E; border: 1px solid rgba(37,211,102,.3); }
.ag-side-block { padding: 14px 16px; border-bottom: 1px solid var(--ag-bd); }
.ag-side-lbl { font-size: 10.5px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: var(--ag-tm); margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
.ag-side-lbl i { color: #1E3A8A; font-size: 11px; }
.ag-side-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 11.5px; }
.ag-side-row span { color: var(--ag-tm); font-weight: 600; }
.ag-side-row b { font-size: 12px; color: var(--ag-t1); }
.ag-side-ta { width: 100%; height: 70px; border: 1.5px solid var(--ag-bd); border-radius: 10px; padding: 8px 10px; font-size: 12px; color: var(--ag-t1); background: var(--ag-soft2); outline: none; resize: none; font-family: inherit; }
.ag-side-save { width: 100%; margin-top: 8px; justify-content: center; }

/* Buttons */
.ag-btn { display: inline-flex; align-items: center; gap: 7px; height: 38px; padding: 0 16px; border-radius: 9px; border: none; font-size: 12.5px; font-weight: 700; cursor: pointer; font-family: inherit; transition: transform .15s, background .15s; }
.ag-btn:hover:not(:disabled) { transform: translateY(-1px); }
.ag-btn:disabled { opacity: .5; cursor: not-allowed; }
.ag-btn-danger { background: linear-gradient(135deg,#b91c1c,#dc2626); color: #fff; height: 34px; padding: 0 14px; box-shadow: 0 3px 12px rgba(220,38,38,.26); }
.ag-btn-secondary { background: var(--ag-soft); color: var(--ag-t2); border: 1.5px solid var(--ag-bd); }
.ag-btn-primary { background: linear-gradient(135deg,#1E3A8A,#2563EB); color: #fff; box-shadow: 0 3px 12px rgba(30,58,138,.26); }
.ag-btn-purple { background: linear-gradient(135deg,#6d28d9,#7c3aed); color: #fff; box-shadow: 0 3px 12px rgba(124,58,237,.28); }
.ag-btn-success { background: linear-gradient(135deg,#15803d,#16a34a); color: #fff; box-shadow: 0 3px 12px rgba(22,163,74,.24); }
.ag-btn-wa { background: linear-gradient(135deg,#128C7E,#25D366); color: #fff; box-shadow: 0 3px 12px rgba(37,211,102,.26); }

/* Modal */
.ag-ov { position: fixed; inset: 0; background: rgba(8,13,26,.55); backdrop-filter: blur(4px); z-index: 9200; display: flex; align-items: center; justify-content: center; padding: 18px; animation: agOv .16s ease; }
@keyframes agOv { from { opacity: 0; } to { opacity: 1; } }
.ag-modal { background: var(--ag-panel); border-radius: 16px; width: 100%; max-width: 440px; max-height: 92vh; overflow-y: auto; box-shadow: 0 20px 50px rgba(30,58,138,.22); display: flex; flex-direction: column; animation: agMd .24s cubic-bezier(.34,1.22,.64,1); }
.ag-modal-lg { max-width: 560px; }
@keyframes agMd { from { opacity: 0; transform: translateY(16px) scale(.97); } to { opacity: 1; transform: none; } }
.ag-modal-hd { display: flex; align-items: flex-start; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid var(--ag-bd); }
.ag-modal-ttl { display: flex; gap: 10px; align-items: flex-start; }
.ag-modal-ttl > i { font-size: 17px; color: #1E3A8A; margin-top: 1px; }
.ag-modal-ttl-t { font-size: 15px; font-weight: 800; }
.ag-modal-ttl-s { font-size: 11.5px; color: var(--ag-tm); margin-top: 2px; }
.ag-modal-x { width: 30px; height: 30px; border-radius: 8px; border: 1.5px solid var(--ag-bd); background: var(--ag-panel); color: var(--ag-tm); cursor: pointer; font-size: 12px; flex-shrink: 0; }
.ag-modal-x:hover { border-color: #DC2626; color: #DC2626; }
.ag-modal-body { padding: 16px 18px; }
.ag-modal-ft { display: flex; gap: 8px; justify-content: flex-end; padding: 12px 18px; border-top: 1px solid var(--ag-bd); }

.ag-lbl { display: block; font-size: 11.5px; font-weight: 700; color: var(--ag-t2); margin: 0 0 5px; }
.ag-lbl:not(:first-child) { margin-top: 14px; }
.ag-req { color: #DC2626; }
.ag-req-p { color: #7C3AED; }
.ag-input, .ag-textarea { width: 100%; border: 1.5px solid var(--ag-bd); border-radius: 9px; padding: 9px 12px; font-size: 13px; color: var(--ag-t1); background: var(--ag-panel); outline: none; font-family: inherit; transition: all .15s; }
.ag-textarea { resize: vertical; }
.ag-input:focus, .ag-textarea:focus { border-color: #1E3A8A; box-shadow: 0 0 0 3px rgba(30,58,138,.08); }
.ag-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px; }
.ag-grid .ag-lbl { margin-top: 0; }

.ag-banner { display: flex; align-items: flex-start; gap: 9px; border-radius: 10px; padding: 11px 14px; font-size: 12.5px; line-height: 1.45; margin-top: 16px; }
.ag-banner i { flex-shrink: 0; margin-top: 1px; }
.ag-banner-warn { background: rgba(217,119,6,.08); border: 1.5px solid rgba(217,119,6,.3); color: #b45309; margin-top: 0; margin-bottom: 16px; }
.ag-banner-warn i { color: #D97706; }
.ag-banner-info { background: rgba(30,58,138,.05); border: 1.5px solid var(--ag-bd2); color: var(--ag-t2); }
.ag-banner-info i { color: #1E3A8A; }
.ag-banner-purple { background: rgba(124,58,237,.05); border: 1.5px solid rgba(124,58,237,.2); color: var(--ag-t2); }
.ag-banner-purple i { color: #7C3AED; }

/* Drop zones / previews */
.ag-drop { border: 2px dashed #93C5FD; border-radius: 12px; padding: 28px; text-align: center; background: var(--ag-soft2); cursor: pointer; transition: all .15s; }
.ag-drop:hover { border-color: #1E3A8A; background: var(--ag-tint); }
.ag-drop-ic { font-size: 28px; color: #1E3A8A; display: block; margin-bottom: 8px; }
.ag-drop-t { font-size: 13px; font-weight: 700; }
.ag-drop-s { font-size: 11.5px; color: var(--ag-tm); margin-top: 3px; }
.ag-iprev { border: 1.5px solid var(--ag-bd); border-radius: 12px; overflow: hidden; }
.ag-iprev-hd { padding: 7px 11px; border-bottom: 1px solid var(--ag-bd); background: var(--ag-soft2); display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: 700; color: var(--ag-t2); }
.ag-iprev-hd button { background: none; border: none; color: var(--ag-tm); cursor: pointer; font-size: 12px; }
.ag-iprev-body { padding: 10px; text-align: center; background: var(--ag-tint2); }
.ag-iprev-body img { max-width: 100%; max-height: 220px; border-radius: 9px; object-fit: contain; }
.ag-dprev { border: 1.5px solid var(--ag-bd); border-radius: 11px; padding: 11px 13px; background: var(--ag-soft2); display: flex; align-items: center; gap: 11px; }
.ag-dprev-x { background: none; border: none; color: var(--ag-tm); cursor: pointer; font-size: 13px; margin-left: auto; }

/* Toast */
.ag-toast { position: fixed; bottom: 26px; left: 50%; transform: translateX(-50%); z-index: 9400; display: inline-flex; align-items: center; gap: 9px; padding: 11px 18px; border-radius: 11px; background: #0B1220; color: #fff; font-size: 13px; font-weight: 700; box-shadow: 0 10px 30px rgba(0,0,0,.28); animation: agToast .26s cubic-bezier(.34,1.4,.64,1); }
@keyframes agToast { from { opacity: 0; transform: translate(-50%, 14px); } to { opacity: 1; transform: translate(-50%, 0); } }
.ag-toast-success { background: linear-gradient(135deg,#15803d,#16a34a); }
.ag-toast-warn { background: linear-gradient(135deg,#b45309,#d97706); }
.ag-toast-info { background: linear-gradient(135deg,#1e3a8a,#2563eb); }

/* Multi-attachment: modal thumbnails + in-chat groups */
.ag-thumbs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; margin-bottom: 4px; }
.ag-thumb { position: relative; aspect-ratio: 1/1; border-radius: 9px; overflow: hidden; border: 1.5px solid var(--ag-bd); }
.ag-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ag-thumb-load { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--ag-tm); background: var(--ag-soft); }
.ag-thumb-x { position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; border-radius: 50%; border: none; background: rgba(8,13,26,.62); color: #fff; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.ag-vgroup, .ag-dgroup { display: flex; flex-direction: column; gap: 6px; margin-bottom: 4px; }

/* Previous Sessions panel */
.ag-prev-list { display: flex; flex-direction: column; gap: 8px; }
.ag-prev-row { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; border: 1.5px solid var(--ag-bd); background: var(--ag-panel); border-radius: 12px; padding: 12px 14px; cursor: pointer; font-family: inherit; transition: all .15s; }
.ag-prev-row:hover { border-color: #1E3A8A; background: var(--ag-soft2); }
.ag-prev-ic { width: 40px; height: 40px; border-radius: 11px; flex-shrink: 0; background: linear-gradient(135deg,#1E3A8A,#2563EB); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 15px; }
.ag-prev-main { flex: 1; min-width: 0; }
.ag-prev-top { display: flex; align-items: center; gap: 8px; }
.ag-prev-ttl { font-size: 13.5px; font-weight: 800; color: var(--ag-t1); }
.ag-prev-sub { font-size: 11.5px; color: var(--ag-tm); margin-top: 2px; }
.ag-prev-rmk { font-size: 11.5px; color: var(--ag-t3); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }
.ag-prev-arrow { color: var(--ag-tm2); font-size: 13px; flex-shrink: 0; }
.ag-badge-closed { background: rgba(100,116,139,.12); color: var(--ag-tm); border: 1px solid rgba(100,116,139,.25); }
.ag-prev-ic { font-size: 13px; font-weight: 800; }
.ag-prev-meta { display: flex; gap: 14px; flex-wrap: wrap; font-size: 11px; color: var(--ag-t3); margin-top: 5px; }
.ag-prev-meta i { color: var(--ag-tm); margin-right: 4px; }
.ag-prev-empty { text-align: center; color: var(--ag-tm); font-size: 13px; padding: 28px 14px; }
.ag-trans-meta { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; font-size: 11.5px; color: var(--ag-t3); margin-bottom: 10px; }
.ag-trans-meta i { color: var(--ag-tm); margin-right: 4px; }
.ag-tick-sent { color: var(--ag-tm2); font-size: 10px; }
.ag-tick-deliv { color: var(--ag-tm2); font-size: 10px; }

/* Read-only transcript */
.ag-transcript { background: var(--ag-msg-bg); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 4px; max-height: 60vh; overflow-y: auto; }
.ag-closed-card { margin: 8px auto 2px; max-width: 90%; text-align: center; background: rgba(22,163,74,.07); border: 1.5px solid rgba(22,163,74,.25); border-radius: 11px; padding: 10px 14px; font-size: 12px; font-weight: 700; color: #15803d; }
.ag-closed-card i { margin-right: 5px; }
.ag-closed-rmk { font-size: 11.5px; font-weight: 500; font-style: italic; color: var(--ag-t3); margin-top: 4px; }

@media (max-width: 1100px) { .ag-side { display: none; } }
@media (max-width: 760px) {
  .ag-inbox { display: none; }
  .ag-shell { padding: 10px; }
  .ag-thumbs { grid-template-columns: repeat(3, 1fr); }
  .ag-topbar { padding: 0 12px; gap: 8px; }
  .ag-topbar-sub { display: none; }
  .ag-tab { padding: 0 11px; font-size: 12px; }
  .ag-back { font-size: 0; gap: 0; padding: 0 12px; }
  .ag-back i { font-size: 14px; }
}`;
