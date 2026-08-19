import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSupportChat } from '../support/useSupportChat';
import { useVoiceRecorder } from '../support/useVoiceRecorder';
import { toUploadableVoice } from '../support/audio';
import { downloadKey, isDownloaded, markDownloaded } from '../support/downloads';
import { VoicePlayer, VideoBubble, ImageGallery } from '../support/MediaBits';
import { groupChatItems } from '../support/grouping';
import {
  SUPPORT_BACKEND_ENABLED, ATTACH_LIMITS, VOICE_NOTE_CAPTION,
  SenderType, MessageStatus, SessionStatus, hasBridgeToken, looksLikePhoneNumber,
} from '../support/config';
import * as api from '../support/api';
import { playIncomingChime } from '../support/sound';

let _attId = 1;
/* Har "send" ka apna nishan (sirf is screen ke liye — API par nahi jata). */
let _batchSeq = 0;
const nextBatchId = () => `snd${++_batchSeq}`;

const attId = () => `att${_attId++}`;

/* Shown to the school user the instant an agent closes the session. */
const SESSION_CLOSED_MESSAGE =
  'Your support session has been closed. Thank you very much. If you face any further issue, you can start a new chat again.';

/* ═══════════════════════════════════════════════════════════════════
   SUPPORT WIDGET — global floating button + chat popup
   1:1 port of the standalone HTML widget the user provided
   ("Support ERP Side .html"). Mounted ONCE in SchoolMentorShell so it
   appears across every main ERP screen, and auto-hides when any ERP
   modal opens (detected via body.style.overflow === 'hidden', which is
   the convention used by every existing modal in the project).

   Demo-only — no backend integration. State lives in component state.
   ═══════════════════════════════════════════════════════════════════ */

const nowTime = () =>
  new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

const todayLabel = () => {
  const d = new Date();
  return `Today, ${d.getDate()} ${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()}`;
};

let _msgIdSeed = 1;
const newId = () => `m${_msgIdSeed++}`;

/* Chat kholte hi jo transcript dikhta hai wo POORA API se aata hai
   (useSupportChat → onHistory). Yahan pehle ek seeded demo guftagu padi thi
   (Agent Tariq, challan screenshot waghera) jo har school ko apni hi chat lagti
   thi aur API ka jawab aate hi ghayab ho jati thi — is liye hata di gayi.
   Backend na mile to farzi baat-cheet ki jagah saaf system line dikhti hai. */
const CONNECT_FAILED_MESSAGE =
  'Support is unavailable right now. Please check your connection and try again.';

/* Widget band ho to unread ginti kitni der baad dobara dekhi jaye — 2 second,
   taake agent ka jawab aate hi badge lag jaye. Har tick par sirf sessions ki
   chhoti si list padhti hai; poori conversation tab hi jab `lastMessageAt`
   badla ho. Chhupi hui tab par poll ruk jata hai aur wapas aate hi foran ek
   check ho jata hai. */
const UNREAD_POLL_MS = 2000;


/* `toast` ERP shell se aata hai (App.js ka pushToast) — attachment modals ke
   upar dikhta hai, is liye caption jaisi validation wahin se batai jati hai.
   Prop na mile to chup-chaap kuch na karo (widget kahin aur bhi mount ho sakta
   hai). */
export default function SupportWidget({ toast }) {
  const notify = (msg, type = 'error') => toast?.(msg, type);
  /* Attachment ke sath caption laazmi hai — upload route par bhi wo [Required]
     hai. Pehle khali chhodne par file ka naam khud caption ban jata tha, jo
     user ka likha hua matn nahi tha; ab saaf mana kar dete hain. */
  const CAPTION_REQUIRED = 'Caption is required';
  /* Open/close + session state */
  const [open, setOpen]         = useState(false);
  const [sessionState, setSession] = useState('active'); // 'active' | 'closed'
  /* Trigger par badge tab hi lage jab sach much koi na-para message ho —
     pehle yahan 1 pada tha, to har user ko bina kisi guftagu ke ek unread
     dikhta tha. */
  const [unread, setUnread]     = useState(0);

  /* Messages list — khali se shuru; transcript API se aata hai. */
  const [messages, setMessages] = useState([]);

  /* Composer */
  const [input, setInput] = useState('');
  const taRef = useRef(null);
  const msgsRef = useRef(null);

  /* Attachment modals — multi-select (arrays of items) */
  const [attachModal, setAttachModal] = useState(null); // 'image' | 'doc' | 'video' | null
  const [imgItems,   setImgItems]     = useState([]); // [{ id, name, src, file }]
  const [docItems,   setDocItems]     = useState([]); // [{ id, name, sizeLabel, ext, file }]
  const [videoItems, setVideoItems]   = useState([]); // [{ id, name, src, file, sizeLabel }]
  const [imgCaption, setImgCaption]   = useState('');
  const [docMsg,     setDocMsg]       = useState('');
  const [videoCaption, setVideoCaption] = useState('');
  const imgFileInputRef   = useRef(null);
  const docFileInputRef   = useRef(null);
  const videoFileInputRef = useRef(null);

  /* ─── Live backend wiring (REST + SignalR).
         The hook owns auth + the socket; we just feed its callbacks into our
         existing `messages` state. If the Support API is unreachable the
         widget silently keeps its offline demo behaviour. ─── */
  const [remoteTyping, setRemoteTyping] = useState(null);

  const chat = useSupportChat({
    role: 'school',
    /* Chat band ho to aane wale message ko "read" na kiya jaye — connection
       band karne ke baad bhi zinda rehta hai. */
    viewing: open,
    onHistory: (msgs) => setMessages(
      msgs.length ? msgs : [
        { id: newId(), kind: 'daylabel', text: todayLabel() },
        { id: newId(), kind: 'system', text: 'Welcome to School Mentor Support. We are here to help!' },
      ]),
    onInbound: (uiMsg) => setMessages(prev =>
      prev.some(m => m.id === uiMsg.id)
        ? prev
        : [...prev.filter(m => m.kind !== 'typing'), uiMsg]),
    onTyping: (name) => setRemoteTyping(name),
    onReceipt: ({ type, messageIds }) => setMessages(prev => prev.map(m =>
      messageIds.includes(m.id) ? { ...m, status: type === 'read' ? 3 : 2 } : m)),
    onSessionClosed: () => {
      // Real-time: show the closed system message instantly, then lock the UI.
      setMessages(prev => [
        ...prev.filter(m => m.kind !== 'typing'),
        { id: newId(), kind: 'system', text: SESSION_CLOSED_MESSAGE },
      ]);
      setRemoteTyping(null);
      setSession('closed');
    },
    /* API tak pahunch hi na ho → sirf ek system line, koi banawati guftagu nahi. */
    onError: () => setMessages([{ id: newId(), kind: 'system', text: CONNECT_FAILED_MESSAGE }]),
  });
  const liveConnected = chat.connected;
  /* Widget khulne ke baad, jab tak na connect hua na koi error aaya — loader. */
  const chatLoading = open && (chat.status === 'idle' || chat.status === 'connecting');

  /* Open the live connection the first time the widget is opened. */
  useEffect(() => {
    if (open && SUPPORT_BACKEND_ENABLED) chat.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* ── Unread badge jab widget BAND ho ───────────────────────────────
     Chat khuli na ho to hook chalta hi nahi, is liye agent ka jawab aane par
     school ko kuch pata nahi chalta tha. Yahan halke se poll kar ke trigger
     par ginti laga dete hain — 1, 2, 3 — taake user ko maloom ho ke jawab aaya
     hai aur kholna hai.

     Ginti KHUD karte hain: API ka `unreadCount` agent ke liye hai (us me
     school ke apne bheje hue message ginte hain — live check par apni hi ek
     message wali session par 1 aa raha tha). School ke liye "unread" wo agent
     messages hain jo abhi Read nahi huye. */
  const pollSessionRef = useRef(null);
  const lastUnreadRef = useRef(0);
  const lastStampRef = useRef(null);   // aakhri maloom lastMessageAt
  useEffect(() => {
    /* Khula ho to hook khud sab sambhalta hai (aur khulte hi sab read ho jata
       hai), aur bina token ke koi call bhejne ka faida nahi.

       Hook connected ho (yani chat ek baar khul chuki hai) to wo khud hi is
       session ko poll kar raha hota hai aur naye message onInbound se aa jate
       hain — us soorat me ginti `messages` se hoti hai, warna do poller ek hi
       conversation par chalte rehte. */
    if (!SUPPORT_BACKEND_ENABLED || open || chat.connected || !hasBridgeToken()) return undefined;
    let cancelled = false;

    const tick = async () => {
      try {
        /* Sasta check pehle: sessions list ek chhoti row deti hai. Poora
           transcript sirf tab maangte hain jab `lastMessageAt` badla ho —
           warna har 2 second par poori conversation kheenchni parti. */
        const { items } = await api.getActiveSessions(1, 5);
        if (cancelled) return;
        const row = items?.[0];
        if (!row) { pollSessionRef.current = null; setUnread(0); return; }
        pollSessionRef.current = row.sessionId;
        if (row.lastMessageAt && row.lastMessageAt === lastStampRef.current) return;
        lastStampRef.current = row.lastMessageAt || null;

        const detail = await api.getSessionDetail(row.sessionId);
        if (cancelled) return;
        if (detail.sessionStatus === SessionStatus.Closed) {
          /* Band session par badge nahi; agli dafa nayi session dhoondo. */
          pollSessionRef.current = null;
          setUnread(0);
          return;
        }
        const count = (detail.messages || []).filter(
          (m) => m.senderType === SenderType.Agent && m.messageStatus < MessageStatus.Read,
        ).length;
        /* Ginti barhe to ek halki si aawaz — sirf tab jab kuch naya aaya ho. */
        if (count > lastUnreadRef.current) playIncomingChime();
        lastUnreadRef.current = count;
        setUnread(count);
      } catch (e) { /* transient — agle tick par phir sahi */ }
    };

    /* Sirf timer par chhorna kaafi nahi tha: agent doosri tab me jawab deta
       hai, user ERP ki tab par wapas aata hai, aur agle tick ka intezaar karta
       rehta hai — is liye refresh karne par hi badge dikhta tha. Tab par wapas
       aate hi (ya window focus hote hi) foran check kar lete hain, aur tab
       chhupi ho to poll rok dete hain (be-faida requests nahi jatin). */
    const check = () => { if (!document.hidden) tick(); };
    check();
    const timer = setInterval(check, UNREAD_POLL_MS);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, [open, chat.connected]);

  /* Hook chal raha ho to ginti wahin se: `in` bubbles jo abhi Read nahi huye.
     (Ab ye Read hote hi nahi jab tak chat khuli na ho.) */
  const liveUnread = messages.filter(
    (m) => m.kind === 'in' && (m.status ?? MessageStatus.Read) < MessageStatus.Read,
  ).length;
  const unreadCount = open ? 0 : (chat.connected ? liveUnread : unread);

  /* Nayi ginti barhe to wahi halki si aawaz jo poll wale raste par bajti hai. */
  useEffect(() => {
    if (!chat.connected || open) return;
    if (liveUnread > lastUnreadRef.current) playIncomingChime();
    lastUnreadRef.current = liveUnread;
  }, [liveUnread, chat.connected, open]);

  /* Body scroll lock while widget is open */
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  useEffect(() => {
    if (!attachModal) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [attachModal]);

  /* Auto-scroll to bottom whenever messages change OR the chat opens */
  useEffect(() => {
    if (!open) return;
    const el = msgsRef.current;
    if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [messages, open]);

  /* Kholte hi badge saaf — andar jaate hi sab read ho jata hai (openSession
     markRead bhejti hai), aur poll ka pichla count bhi reset kar do warna
     dobara band karne par chime ka hisaab purani ginti par chalta rehta. */
  useEffect(() => {
    if (!open) return;
    setUnread(0);
    lastUnreadRef.current = 0;
  }, [open]);

  /* ESC closes whichever surface is on top */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (attachModal) setAttachModal(null);
      else if (open) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, attachModal]);

  /* ── Composer helpers ── */
  const autoResize = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 78) + 'px';
  };

  /* Sirf apna bheja hua message screen par. Yahan pehle 2.2 second baad ek
     banawata "support" jawab bhi aa jata tha (random REPLIES me se) — school ke
     liye wo asli agent ka reply lagta tha jab ke jawab dene wala koi tha hi
     nahi. Ab jo bhi aata hai server se aata hai. */
  const appendOut = (payload) =>
    setMessages(prev => [...prev, {
      id: newId(), kind: 'out', time: nowTime(),
      /* Locally bana bubble hamesha "Sent" — server ne abhi kuch kaha hi nahi. */
      status: MessageStatus.Sent,
      ...payload,
    }]);

  const sendText = () => {
    const txt = input.trim();
    if (!txt) return;
    if (liveConnected) {
      /* Live: POST → server persists → SignalR broadcast (echoed via onInbound).
         Nakaam ho to bubble to dikha do (jo likha wo gum na ho) magar saath
         batao ke gaya nahi — warna school samajhti hai message chala gaya. */
      chat.sendText(txt).catch(() => {
        appendOut({ text: txt });
        appendSystem('Message could not be sent. Please try again.');
      });
    } else {
      appendOut({ text: txt });
      appendSystem('Not connected to support — this message was not sent.');
    }
    setInput('');
    setTimeout(autoResize, 0);
  };

  /* Notify the agent we're typing (no-op offline). */
  const onComposerType = () => { if (liveConnected) chat.setTyping(true); };

  const onKeyDownTa = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  };

  const appendSystem = (text) =>
    setMessages(prev => [...prev, { id: newId(), kind: 'system', text }]);

  /* ── Real voice recording (mic button + Voice Note tray) ──
     Auto-stops at 5 min (enforced in the recorder hook). On finish: upload
     when live, else append a locally-playable demo bubble. ── */
  const voice = useVoiceRecorder({ onAutoStop: (res) => finishVoice(res) });
  const startInlineRec = async () => {
    const ok = await voice.start();
    if (!ok) appendSystem('Microphone unavailable or permission denied.');
  };
  const cancelInlineRec = () => voice.cancel();
  const sendInlineRec = async () => {
    const res = await voice.stop();
    if (res && res.blob && res.durationSec > 0) finishVoice(res);
  };
  const finishVoice = async (res) => {
    /* Chrome sirf WebM record karta hai aur API voice ke liye WebM leti nahi
       ("File type '.webm' is not allowed for voice"), is liye zaroorat par
       recording yahin WAV me badalti hai. Nakaam ho to jo hai wahi bhej do —
       server ka apna message user ko dikh jayega. */
    let out = { blob: res.blob, ext: mimeToExt(res.mimeType) };
    try {
      out = await toUploadableVoice(res.blob, res.mimeType);
    } catch (e) { /* convert na ho saka — asli blob ke saath aage barho */ }
    const file = new File([out.blob], `voice-${Date.now()}.${out.ext}`, { type: out.blob.type || res.mimeType });
    if (liveConnected) {
      /* Voice note ka apna koi caption box nahi hai (record karke seedha chala
         jata hai), is liye yahan yeh tay-shuda caption jata hai — warna
         doosri taraf message bilkul bina matn ke pahunchta hai. */
      chat.sendAttachment({ category: 'voice', file, voiceDuration: res.durationSec, caption: VOICE_NOTE_CAPTION })
        .catch(() => {
          notify('Voice note could not be sent. Please try again.');
          appendOut({ audio: { duration: fmtSec(res.durationSec), seconds: res.durationSec, src: URL.createObjectURL(res.blob) } });
        });
    } else {
      appendOut({ audio: { duration: fmtSec(res.durationSec), seconds: res.durationSec, src: URL.createObjectURL(res.blob) } });
    }
  };

  /* ── Image modal (multi-select, up to 10) ── */
  const onPickImages = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setImgItems(prev => {
      const room = ATTACH_LIMITS.image - prev.length;
      if (room <= 0) { appendSystem(`You can attach up to ${ATTACH_LIMITS.image} images.`); return prev; }
      const take = files.slice(0, room);
      if (files.length > room) appendSystem(`Only ${ATTACH_LIMITS.image} images allowed — extra files were skipped.`);
      const next = [...prev];
      take.forEach(file => {
        const id = attId();
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
    if (!imgCaption.trim()) { notify(CAPTION_REQUIRED); return; }
    sendItemsTogether('image', imgItems, imgCaption, (it) => ({ image: { name: it.name, src: it.src } }));
    setImgItems([]); setImgCaption(''); setAttachModal(null);
  };

  /* ── Document modal (multi-select, up to 10) ── */
  const onPickDocs = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setDocItems(prev => {
      const room = ATTACH_LIMITS.document - prev.length;
      if (room <= 0) { appendSystem(`You can attach up to ${ATTACH_LIMITS.document} documents.`); return prev; }
      if (files.length > room) appendSystem(`Only ${ATTACH_LIMITS.document} documents allowed — extra files were skipped.`);
      const next = files.slice(0, room).map(file => {
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        const sizeLabel = file.size > 1048576 ? (file.size / 1048576).toFixed(1) + ' MB' : Math.round(file.size / 1024) + ' KB';
        return { id: attId(), name: file.name, sizeLabel: `${sizeLabel} · ${ext.toUpperCase()}`, ext, file };
      });
      return [...prev, ...next];
    });
  };
  const removeDoc = (id) => setDocItems(prev => prev.filter(it => it.id !== id));
  const sendDocs = () => {
    if (!docItems.length) return;
    if (!docMsg.trim()) { notify(CAPTION_REQUIRED); return; }
    sendItemsTogether('document', docItems, docMsg, (it) => ({ doc: { name: it.name, size: it.sizeLabel, ext: it.ext } }));
    setDocItems([]); setDocMsg(''); setAttachModal(null);
  };

  /* ── Video modal (multi-select, up to 5) ── */
  const onPickVideos = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setVideoItems(prev => {
      const room = ATTACH_LIMITS.video - prev.length;
      if (room <= 0) { appendSystem(`You can attach up to ${ATTACH_LIMITS.video} videos.`); return prev; }
      if (files.length > room) appendSystem(`Only ${ATTACH_LIMITS.video} videos allowed — extra files were skipped.`);
      const next = files.slice(0, room).map(file => {
        const sizeLabel = file.size > 1048576 ? (file.size / 1048576).toFixed(1) + ' MB' : Math.round(file.size / 1024) + ' KB';
        return { id: attId(), name: file.name, src: URL.createObjectURL(file), file, sizeLabel };
      });
      return [...prev, ...next];
    });
  };
  const removeVideo = (id) => setVideoItems(prev => prev.filter(it => it.id !== id));
  const sendVideos = () => {
    if (!videoItems.length) return;
    if (!videoCaption.trim()) { notify(CAPTION_REQUIRED); return; }
    sendItemsTogether('video', videoItems, videoCaption, (it) => ({ video: { name: it.name, src: it.src } }));
    setVideoItems([]); setVideoCaption(''); setAttachModal(null);
  };

  /* ── Aane wale bubble par kis ka naam likha jaye ──
     API `senderName` me support user ka LOGIN bhejti hai, jo rabta number
     hota hai — chat me "03006677888" likha aata tha. Number ki jagah wahi
     naam dikhate hain jo is guftagu ka agent hai (session se), aur wo bhi
     na mile to screen ka apna unwan. Asli naam aaye to usay haath nahi
     lagate. */
  const liveSession = chat.activeSessions.find((x) => x.sessionId === chat.sessionId)
    || chat.activeSessions[0] || null;
  const agentDisplayName = (() => {
    const n = String(liveSession?.agentName || '').trim();
    return (!n || looksLikePhoneNumber(n)) ? '' : n;
  })();
  const senderLabel = useCallback((name) => {
    const raw = String(name ?? '').trim();
    return (!raw || looksLikePhoneNumber(raw)) ? (agentDisplayName || 'School Mentor Support') : raw;
  }, [agentDisplayName]);

  /* Naam grouping ki kunji bhi hai (ek hi bhejne wale ke consecutive
     attachments ek album bante hain), is liye group banne se PEHLE badalta
     hai — warna ek hi shakhs ke bubbles do naamon me bat jate. */
  const chatMessages = useMemo(
    () => messages.map((m) => (m.kind === 'in' ? { ...m, sender: senderLabel(m.sender) } : m)),
    [messages, senderLabel],
  );

  /* Upload a batch of files as individual messages (grouped at render time).
     Caption HAR file ke saath jata hai: upload route par wo [Required] hai
     (khali bhejne par 400 "The caption field is required"), is liye pehle jab
     sirf pehli file ke saath jata tha to baqi files chup-chaap fail ho kar
     local bubble ban jati thin. Screen par dohrao nahi hota — groupChatItems
     poore group ka ek hi text dikhata hai.

     Caption khali ho to yahan tak aate hi nahi — bhejne se pehle rok diya jata
     hai (CAPTION_REQUIRED). Pehle khali hone par file ka naam khud caption ban
     jata tha, magar wo user ka likha hua matn nahi hota tha. */
  const sendItemsTogether = (category, items, caption, demoShape) => {
    /* Is ek send ka apna nishan — screen par sirf inhi files ka album banta
       hai. Pehle grouping waqt ke faasle par chalti thi, is liye baad me
       bheji gayi nayi tasveer pichhle album me ja girti thi. */
    const batchId = nextBatchId();
    if (liveConnected) {
      (async () => {
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          try {
            // eslint-disable-next-line no-await-in-loop
            await chat.sendAttachment({
              category, file: it.file, caption: caption.trim(), batchId,
            });
          } catch (err) {
            /* Upload nakaam — bubble to dikhao (jo chuna wo gum na ho) magar
               chup na raho, warna user samajhta hai file chali gayi. Server ka
               apna message (e.g. "File type '.x' is not allowed") zyada kaam ka
               hai, is liye wahi dikhate hain. */
            notify(err?.message || `${it.name || 'File'} could not be sent. Please try again.`);
            appendOut({ text: i === 0 ? (caption.trim() || null) : null, ...demoShape(it), _batch: batchId });
          }
        }
      })();
    } else {
      items.forEach((it, i) => appendOut({ text: i === 0 ? (caption.trim() || null) : null, ...demoShape(it), _batch: batchId }));
    }
  };

  /* ── Session controls ── */
  /* Ask the backend to close the session (staff get the real-time SessionClosed
     event); offline/demo just flips the local UI. Optional closing remarks
     become the customer's feedback.

     A failure must NOT flip the UI to "closed": the API only lets an
     agent/super-admin close a session (README §6), so a school token gets 403.
     Showing the chat as ended while the agent still has it open is worse than
     saying so plainly. */
  const closeSession = (remarks) => {
    if (liveConnected && chat.sessionId) {
      chat.closeSession(remarks)
        .then(() => setSession('closed'))
        .catch((err) => appendSystem(err?.status === 403
          ? 'Only a support agent can end this chat. Please ask the agent to close it.'
          : 'Could not end the chat right now. Please try again.'));
    } else {
      setSession('closed');
    }
  };
  const startNewSession = () => {
    // Detach from the closed session (kept in history); next message opens a
    // fresh one. Re-enables input / attachments / voice.
    if (liveConnected) chat.newConversation();
    setSession('active');
    setMessages([
      { id: newId(), kind: 'daylabel', text: todayLabel() },
      { id: newId(), kind: 'system',   text: 'New conversation started. Send a message and our team will respond shortly.' },
    ]);
  };

  const isClosed = sessionState === 'closed';

  return (
    <>
      <style>{SUPPORT_CSS}</style>

      {/* ── Header trigger — lives in the global top bar, next to the
            theme/session controls, on every ERP screen ── */}
      <button
        className={`sc-hdr-trigger${isClosed ? '' : ' sc-active'}`}
        onClick={() => setOpen(true)}
        aria-label="Open School Mentor Support"
        title="School Mentor Support"
      >
        <i className="fa-solid fa-headset" aria-hidden="true"></i>
        <span className="sc-hdr-trigger-lbl">Support</span>
        {!isClosed && <span className="sc-hdr-trigger-dot" aria-hidden="true"></span>}
        {unreadCount > 0 && !isClosed && (
          <span className="sc-hdr-trigger-badge">{unreadCount}</span>
        )}
      </button>

      {open && createPortal(
        <ChatOverlay
          messages={chatMessages}
          loading={chatLoading}
          msgsRef={msgsRef}
          isClosed={isClosed}
          onClose={() => setOpen(false)}
          remoteTyping={remoteTyping}
          /* composer */
          input={input}
          setInput={setInput}
          taRef={taRef}
          onKeyDownTa={onKeyDownTa}
          onAutoResize={autoResize}
          onSendText={sendText}
          onComposerType={onComposerType}
          /* attachments */
          openAttachModal={setAttachModal}
          /* inline recorder (real mic) */
          recording={voice.recording}
          recSec={voice.seconds}
          onStartRec={startInlineRec}
          onCancelRec={cancelInlineRec}
          onSendRec={sendInlineRec}
          /* session controls */
          onCloseSession={closeSession}
          onNewSession={startNewSession}
        />,
        document.body,
      )}

      {/* ── Attachment modals (multi-select) ── */}
      {attachModal === 'image' && createPortal(
        <ImageModal
          items={imgItems} onRemove={removeImg} caption={imgCaption} setCaption={setImgCaption}
          onPick={onPickImages} onSend={sendImages} inputRef={imgFileInputRef}
          onClose={() => { setAttachModal(null); setImgItems([]); setImgCaption(''); }}
        />,
        document.body,
      )}

      {attachModal === 'doc' && createPortal(
        <DocModal
          items={docItems} onRemove={removeDoc} msg={docMsg} setMsg={setDocMsg}
          onPick={onPickDocs} onSend={sendDocs} inputRef={docFileInputRef}
          onClose={() => { setAttachModal(null); setDocItems([]); setDocMsg(''); }}
        />,
        document.body,
      )}

      {attachModal === 'video' && createPortal(
        <VideoModal
          items={videoItems} onRemove={removeVideo} caption={videoCaption} setCaption={setVideoCaption}
          onPick={onPickVideos} onSend={sendVideos} inputRef={videoFileInputRef}
          onClose={() => { setAttachModal(null); setVideoItems([]); setVideoCaption(''); }}
        />,
        document.body,
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────
   CHAT OVERLAY
   ───────────────────────────────────────────────────────────────── */
function ChatOverlay({
  messages, msgsRef, isClosed, onClose, remoteTyping, loading = false,
  input, setInput, taRef, onKeyDownTa, onAutoResize, onSendText, onComposerType,
  openAttachModal,
  recording, recSec, onStartRec, onCancelRec, onSendRec,
  onCloseSession, onNewSession,
}) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [endRemarks, setEndRemarks] = useState('');
  const submitEnd = () => { onCloseSession(endRemarks.trim() || null); setConfirmEnd(false); setEndRemarks(''); };
  return (
    <div className="sc-ov sc-open" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sc-win" role="dialog" aria-modal="true" aria-label="School Mentor Support chat">
        {/* Header */}
        <div className="sc-hdr">
          <div className="sc-hdr-av"><i className="fa-solid fa-headset" aria-hidden="true"></i></div>
          <div>
            <div className="sc-hdr-nm">School Mentor Support</div>
            <div className="sc-hdr-st">
              <div className="sc-hdr-stdo"></div>
              <span>Online</span>
            </div>
            <div className="sc-hdr-resp">Avg. response: ~15 min</div>
          </div>
          {!isClosed && (
            <button className="sc-hdr-end" onClick={() => setConfirmEnd(true)} aria-label="End chat">
              <i className="fa-solid fa-circle-xmark" aria-hidden="true"></i> End Chat
            </button>
          )}
          <button className="sc-hdr-x" onClick={onClose} aria-label="Minimize">
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        {/* Status bar */}
        <div className="sc-sbar">
          {isClosed ? (
            <>
              <span className="sc-sbadge sc-s-closed">
                <i className="fa-solid fa-circle-xmark" style={{ fontSize: 7 }}></i> Session Closed
              </span>
              <span className="sc-slbl">Closed</span>
            </>
          ) : (
            <>
              <span className="sc-sbadge sc-s-online">
                <i className="fa-solid fa-circle" style={{ fontSize: 6 }}></i> Support Online
              </span>
              <span className="sc-slbl">Active Session</span>
            </>
          )}
        </div>

        {/* Messages */}
        <div className="sc-msgs" ref={msgsRef}>
          {loading && !messages.length && (
            <div className="sc-msgs-state">
              <i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
              <div className="sc-msgs-state-t">Connecting to support…</div>
            </div>
          )}
          {groupChatItems(messages).map(m => <MessageNode key={m.id} m={m} />)}
          {remoteTyping && !isClosed && <MessageNode m={{ id: 'remote-typing', kind: 'typing' }} />}
          {isClosed && (
            <div className="sc-closed">
              <div className="sc-closed-ico"><i className="fa-solid fa-comment-slash" aria-hidden="true"></i></div>
              <div className="sc-closed-t">This support session has been closed</div>
              <div className="sc-closed-d">The issue was resolved by School Mentor Support. Thank you!</div>
              <button className="sc-new-btn" onClick={onNewSession}>
                <i className="fa-solid fa-plus" aria-hidden="true"></i> Start New Conversation
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isClosed && (
          <div className="sc-ftr">
            <div className="sc-tray">
              <button className="sc-tbtn" onClick={() => openAttachModal('image')} type="button">
                <i className="fa-solid fa-image" aria-hidden="true"></i> Image
              </button>
              <button className="sc-tbtn" onClick={() => openAttachModal('video')} type="button">
                <i className="fa-solid fa-video" aria-hidden="true"></i> Video
              </button>
              <button className="sc-tbtn" onClick={() => openAttachModal('doc')} type="button">
                <i className="fa-solid fa-file" aria-hidden="true"></i> Document
              </button>
              <button className="sc-tbtn" onClick={onStartRec} type="button">
                <i className="fa-solid fa-microphone" aria-hidden="true"></i> Voice Note
              </button>
            </div>

            {recording ? (
              <div className="sc-vrec sc-vrec-on">
                <button className="sc-vrec-cancel" onClick={onCancelRec} aria-label="Cancel recording">
                  <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                </button>
                <div className="sc-vrec-bar">
                  <div className="sc-vrec-dot"></div>
                  <span className="sc-vrec-timer">{fmtSec(recSec)}</span>
                  <Waveform />
                  <span className="sc-vrec-lbl">Recording…</span>
                </div>
                <button className="sc-snd" onClick={onSendRec} aria-label="Send voice note">
                  <i className="fa-solid fa-paper-plane" aria-hidden="true"></i>
                </button>
              </div>
            ) : (
              <div className="sc-irow">
                <div className="sc-iwrap">
                  <textarea
                    ref={taRef}
                    className="sc-ta"
                    rows={1}
                    placeholder="Type your message…"
                    value={input}
                    onChange={e => { setInput(e.target.value); onAutoResize(); onComposerType?.(); }}
                    onKeyDown={onKeyDownTa}
                  />
                </div>
                <button className="sc-mic" onClick={onStartRec} title="Record voice note" type="button" aria-label="Record voice note">
                  <i className="fa-solid fa-microphone" aria-hidden="true"></i>
                </button>
                <button className="sc-snd" onClick={onSendText} type="button" aria-label="Send message">
                  <i className="fa-solid fa-paper-plane" aria-hidden="true"></i>
                </button>
              </div>
            )}
          </div>
        )}

        {/* End-chat confirmation — lets the customer close their own session */}
        {confirmEnd && (
          <div className="sc-confirm" onMouseDown={e => { if (e.target === e.currentTarget) setConfirmEnd(false); }}>
            <div className="sc-confirm-card" role="dialog" aria-modal="true" aria-label="End support chat">
              <div className="sc-confirm-ico"><i className="fa-solid fa-circle-xmark" aria-hidden="true"></i></div>
              <div className="sc-confirm-t">End this support chat?</div>
              <div className="sc-confirm-d">Your conversation will be saved to history. You can start a new chat anytime.</div>
              <textarea
                className="sc-confirm-ta"
                rows={3}
                placeholder="Optional: how was your support experience? (feedback)"
                value={endRemarks}
                onChange={e => setEndRemarks(e.target.value)}
              />
              <div className="sc-confirm-row">
                <button className="sc-confirm-cancel" onClick={() => setConfirmEnd(false)}>Cancel</button>
                <button className="sc-confirm-end" onClick={submitEnd}>
                  <i className="fa-solid fa-circle-check" aria-hidden="true"></i> End Chat
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   MESSAGE NODE — handles every kind: in / out / system / daylabel
   / typing / image / doc / audio bubbles.
   ───────────────────────────────────────────────────────────────── */
function MessageNode({ m }) {
  if (m.kind === 'daylabel') {
    return <div className="sc-daylbl"><span>{m.text}</span></div>;
  }
  if (m.kind === 'system') {
    return (
      <div className="sc-sys">
        <i className="fa-solid fa-shield-halved" style={{ marginRight: 4 }} aria-hidden="true"></i>
        {m.text}
      </div>
    );
  }
  if (m.kind === 'typing') {
    return (
      <div className="sc-row">
        <div className="sc-av">SM</div>
        <div className="sc-bbl sc-in" style={{ padding: '8px 12px' }}>
          <div className="sc-typing"><span></span><span></span><span></span></div>
        </div>
      </div>
    );
  }
  const outRow   = m.kind === 'out';
  const rowClass = outRow ? 'sc-row sc-out' : 'sc-row';
  const bblClass = outRow ? 'sc-bbl sc-out' : 'sc-bbl sc-in';

  /* ── Grouped multi-attachment bubble (gallery / grouped cards) ── */
  if (m._group) {
    return (
      <div className={rowClass}>
        {!outRow && <div className="sc-av">SM</div>}
        <div className={bblClass}>
          {!outRow && m.sender && <div className="sc-bbl-sndr">{m.sender}</div>}
          {m._group === 'image' && <ImageGallery items={m.items} />}
          {m._group === 'video' && (
            <div className="sc-vgroup">{m.items.map((it, i) => <VideoBubble key={i} src={it.src} name={it.name} />)}</div>
          )}
          {m._group === 'doc' && (
            <div className="sc-dgroup">{m.items.map((it, i) => (
              <DocAttachment key={i} url={it.url} name={it.name} size={it.size} ext={it.ext} />
            ))}</div>
          )}
          {m.text && <div className="sc-bbl-txt">{m.text}</div>}
          <div className="sc-bbl-meta">
            {m.time}
            {outRow && <Ticks status={m.status} />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={rowClass}>
      {!outRow && <div className="sc-av">SM</div>}
      <div className={bblClass}>
        {!outRow && m.sender && <div className="sc-bbl-sndr">{m.sender}</div>}
        {m.image && m.image.src && (
          <img src={m.image.src} alt="" className="sc-bbl-img" />
        )}
        {m.image && !m.image.src && (
          <Attachment ico="fa-image" iconBg="linear-gradient(135deg,#0284C7,#0EA5E9)"
            name={m.image.name} sub={m.image.size || 'Image'} />
        )}
        {m.video && m.video.src && (
          <VideoBubble src={m.video.src} name={m.video.name} />
        )}
        {m.doc && (
          <DocAttachment url={m.doc.url} name={m.doc.name} size={m.doc.size} ext={m.doc.ext} />
        )}
        {m.audio && (
          <VoicePlayer src={m.audio.src} duration={m.audio.seconds || 0} />
        )}
        {m.text && <div className="sc-bbl-txt">{m.text}</div>}
        <div className="sc-bbl-meta">
          {m.time}
          {/* Yahan pehle hard-coded blue double tick laga hua tha — m.status
              dekha hi nahi jata tha, is liye HAR apna message (saada text aur
              single attachment) bhejte hi "seen" dikhta tha. Grouped bubble
              (upar) hamesha se Ticks use karta tha, isi liye farq nazar aata
              tha. Ab dono ek hi jagah se. */}
          {outRow && <Ticks status={m.status} />}
        </div>
      </div>
    </div>
  );
}

/* Delivery/read ticks (school side): Sent = single grey, Delivered = double
   grey, Read = double blue. Demo/offline messages have no status → blue. */
/* Sent = single, Delivered = double grey, Read = double blue.
   Default JAAN BUJH KAR single hai: pehle yahan default blue tha, is liye jis
   bubble ke paas status hota hi nahi (locally bana hua echo — attachment,
   voice note, ya nakaam send) wo foran "seen" dikhta tha halanke doosri taraf
   ne dekha tak nahi hota tha. Blue sirf tab jab server khud Read kahe. */
function Ticks({ status }) {
  const s = Number(status) || MessageStatus.Sent;
  if (s >= MessageStatus.Read) return <i className="fa-solid fa-check-double sc-ticks" aria-hidden="true"></i>;
  if (s === MessageStatus.Delivered) return <i className="fa-solid fa-check-double sc-tick-deliv" aria-hidden="true"></i>;
  return <i className="fa-solid fa-check sc-tick-sent" aria-hidden="true"></i>;
}

function Attachment({ ico, iconBg, name, sub, trailingIcon }) {
  return (
    <div className="sc-att">
      <div className="sc-att-ico" style={{ background: iconBg }}>
        <i className={`fa-solid ${ico}`} aria-hidden="true"></i>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="sc-att-nm">{name}</div>
        <div className="sc-att-sz">{sub}</div>
      </div>
      {trailingIcon && (
        <i className={`fa-solid ${trailingIcon} sc-att-tr`} aria-hidden="true"></i>
      )}
    </div>
  );
}

/* Document bubble. Download ho jane par teer hat jata hai (refresh ke baad
   bhi) — pehle hamesha laga rehta tha, chahe file kai baar utar chuki ho. */
function DocAttachment({ url, name, size, ext }) {
  const key = downloadKey(url, name);
  const [done, setDone] = useState(() => isDownloaded(key));
  const body = (
    <Attachment
      ico={docIcon(ext)} iconBg={docColor(ext)}
      name={name} sub={size || 'Document'}
      trailingIcon={done ? null : 'fa-download'}
    />
  );
  if (!url) return body;
  return (
    <a
      href={url} target="_blank" rel="noreferrer" download={name}
      title={done ? 'Downloaded — click to open again' : 'Download'}
      onClick={() => { markDownloaded(key); setDone(true); }}
      style={{ textDecoration: 'none' }}
    >
      {body}
    </a>
  );
}

function Waveform() {
  /* 13 animated bars — heights randomized via CSS animation-delay so we
     don't need a JS interval here. */
  return (
    <div className="sc-vrec-wave">
      {Array.from({ length: 13 }, (_, i) => (
        <span key={i} style={{ animationDelay: `${i * 0.06}s` }} />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   ATTACHMENT MODALS
   ───────────────────────────────────────────────────────────────── */
function ImageModal({ items, onRemove, caption, setCaption, onPick, onSend, onClose, inputRef }) {
  const onDrop = (e) => {
    e.preventDefault();
    const fs = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (fs.length) onPick(fs);
  };
  return (
    <div className="sc-mov sc-open" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sc-md" role="dialog" aria-modal="true">
        <div className="sc-md-hd">
          <div className="sc-md-ttl"><i className="fa-solid fa-image" aria-hidden="true"></i> Send Images</div>
          <button className="sc-md-x" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </div>
        <div className="sc-md-body">
          <div className="sc-fdrop" onClick={() => inputRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={onDrop}>
            <i className="fa-solid fa-cloud-arrow-up sc-fdrop-ic" aria-hidden="true"></i>
            <div className="sc-fdrop-t">Click to upload or drag &amp; drop</div>
            <div className="sc-fdrop-s">PNG, JPG, WEBP — up to 10 images</div>
            <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
              onChange={e => { onPick(e.target.files); e.target.value = ''; }} />
          </div>
          {items.length > 0 && (
            <>
              <div className="sc-flbl" style={{ marginTop: 11 }}>{items.length}/{ATTACH_LIMITS.image} selected</div>
              <div className="sc-thumbs">
                {items.map(it => (
                  <div className="sc-thumb" key={it.id}>
                    {it.src ? <img src={it.src} alt="" /> : <div className="sc-thumb-load"><i className="fa-solid fa-spinner fa-spin" /></div>}
                    <button className="sc-thumb-x" onClick={() => onRemove(it.id)} aria-label="Remove"><i className="fa-solid fa-xmark" aria-hidden="true"></i></button>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="sc-flbl">Caption</div>
          <textarea className="sc-ftxta" rows={2} placeholder="Add a caption…" value={caption} onChange={e => setCaption(e.target.value)} />
        </div>
        <div className="sc-md-ft">
          <button className="sc-fcancel" onClick={onClose}>Cancel</button>
          <button className="sc-fsend" onClick={onSend} disabled={!items.length}>
            <i className="fa-solid fa-paper-plane" aria-hidden="true"></i> Send{items.length ? ` (${items.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

function DocModal({ items, onRemove, msg, setMsg, onPick, onSend, onClose, inputRef }) {
  return (
    <div className="sc-mov sc-open" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sc-md" role="dialog" aria-modal="true">
        <div className="sc-md-hd">
          <div className="sc-md-ttl"><i className="fa-solid fa-file" aria-hidden="true"></i> Send Documents</div>
          <button className="sc-md-x" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </div>
        <div className="sc-md-body">
          <div className="sc-fdrop" onClick={() => inputRef.current?.click()}>
            <i className="fa-solid fa-file-arrow-up sc-fdrop-ic" aria-hidden="true"></i>
            <div className="sc-fdrop-t">Click to upload documents</div>
            <div className="sc-fdrop-s">PDF, DOC, DOCX — up to 10 files</div>
            <input ref={inputRef} type="file" accept=".pdf,.doc,.docx" multiple style={{ display: 'none' }}
              onChange={e => { onPick(e.target.files); e.target.value = ''; }} />
          </div>
          {items.length > 0 && (
            <>
              <div className="sc-flbl" style={{ marginTop: 11 }}>{items.length}/{ATTACH_LIMITS.document} selected</div>
              {items.map(it => (
                <div className="sc-dprev" key={it.id} style={{ marginBottom: 7 }}>
                  <div className="sc-dprev-ico" style={{ background: docColor(it.ext) }}>
                    <i className={`fa-solid ${docIcon(it.ext)}`} aria-hidden="true"></i>
                  </div>
                  <div className="sc-dprev-text">
                    <div className="sc-dprev-nm">{it.name}</div>
                    <div className="sc-dprev-sz">{it.sizeLabel}</div>
                  </div>
                  <button className="sc-iprev-x" onClick={() => onRemove(it.id)} aria-label="Remove"><i className="fa-solid fa-xmark" aria-hidden="true"></i></button>
                </div>
              ))}
            </>
          )}
          <div className="sc-flbl">Message</div>
          <textarea className="sc-ftxta" rows={2} placeholder="Add a message…" value={msg} onChange={e => setMsg(e.target.value)} />
        </div>
        <div className="sc-md-ft">
          <button className="sc-fcancel" onClick={onClose}>Cancel</button>
          <button className="sc-fsend" onClick={onSend} disabled={!items.length}>
            <i className="fa-solid fa-paper-plane" aria-hidden="true"></i> Send{items.length ? ` (${items.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

function VideoModal({ items, onRemove, caption, setCaption, onPick, onSend, onClose, inputRef }) {
  const onDrop = (e) => {
    e.preventDefault();
    const fs = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'));
    if (fs.length) onPick(fs);
  };
  return (
    <div className="sc-mov sc-open" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sc-md" role="dialog" aria-modal="true">
        <div className="sc-md-hd">
          <div className="sc-md-ttl"><i className="fa-solid fa-video" aria-hidden="true"></i> Send Videos</div>
          <button className="sc-md-x" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </div>
        <div className="sc-md-body">
          <div className="sc-fdrop" onClick={() => inputRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={onDrop}>
            <i className="fa-solid fa-film sc-fdrop-ic" aria-hidden="true"></i>
            <div className="sc-fdrop-t">Click to upload or drag &amp; drop</div>
            <div className="sc-fdrop-s">MP4, WEBM — up to 5 videos</div>
            <input ref={inputRef} type="file" accept="video/mp4,video/webm" multiple style={{ display: 'none' }}
              onChange={e => { onPick(e.target.files); e.target.value = ''; }} />
          </div>
          {items.length > 0 && (
            <>
              <div className="sc-flbl" style={{ marginTop: 11 }}>{items.length}/{ATTACH_LIMITS.video} selected</div>
              {items.map(it => (
                <div className="sc-dprev" key={it.id} style={{ marginBottom: 7 }}>
                  <div className="sc-dprev-ico" style={{ background: 'linear-gradient(135deg,#7C3AED,#A855F7)' }}>
                    <i className="fa-solid fa-play" aria-hidden="true"></i>
                  </div>
                  <div className="sc-dprev-text">
                    <div className="sc-dprev-nm">{it.name}</div>
                    <div className="sc-dprev-sz">{it.sizeLabel}</div>
                  </div>
                  <button className="sc-iprev-x" onClick={() => onRemove(it.id)} aria-label="Remove"><i className="fa-solid fa-xmark" aria-hidden="true"></i></button>
                </div>
              ))}
            </>
          )}
          <div className="sc-flbl">Caption</div>
          <textarea className="sc-ftxta" rows={2} placeholder="Add a caption…" value={caption} onChange={e => setCaption(e.target.value)} />
        </div>
        <div className="sc-md-ft">
          <button className="sc-fcancel" onClick={onClose}>Cancel</button>
          <button className="sc-fsend" onClick={onSend} disabled={!items.length}>
            <i className="fa-solid fa-paper-plane" aria-hidden="true"></i> Send{items.length ? ` (${items.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────────────────────── */
function fmtSec(s) {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${ss < 10 ? '0' : ''}${ss}`;
}
/* Map a MediaRecorder mime type to a backend-accepted voice extension. */
function mimeToExt(mime) {
  const t = (mime || '').toLowerCase();
  if (t.includes('webm')) return 'webm';
  if (t.includes('ogg')) return 'ogg';
  if (t.includes('mp4') || t.includes('m4a') || t.includes('aac')) return 'm4a';
  if (t.includes('mpeg') || t.includes('mp3')) return 'mp3';
  if (t.includes('wav')) return 'wav';
  return 'webm';
}
function docIcon(ext) {
  return ({
    pdf:  'fa-file-pdf',
    doc:  'fa-file-word',  docx: 'fa-file-word',
    xls:  'fa-file-excel', xlsx: 'fa-file-excel',
  }[ext]) || 'fa-file';
}
function docColor(ext) {
  const c = ({
    pdf:  '#DC2626',
    doc:  '#1E40AF', docx: '#1E40AF',
    xls:  '#16A34A', xlsx: '#16A34A',
  }[ext]) || '#64748B';
  return `linear-gradient(135deg,${c},${c}99)`;
}

/* ═══════════════════════════════════════════════════════════════
   STYLES — 1:1 port from the reference HTML, scoped to .sc-* classes.
   Includes dark-mode + mobile responsive (bottom-sheet).
   ═══════════════════════════════════════════════════════════════ */
const SUPPORT_CSS = `
/* ── Header trigger (lives in the global top bar) ── */
.sc-hdr-trigger { position: relative; display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 13px; border-radius: 9px; border: 1px solid rgba(18,140,126,.35); background: linear-gradient(135deg,rgba(18,140,126,.10),rgba(37,211,102,.10)); color: #0E7A6F; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap; flex-shrink: 0; transition: var(--tr,all .2s ease); }
.sc-hdr-trigger:hover { background: linear-gradient(135deg,rgba(18,140,126,.18),rgba(37,211,102,.18)); border-color: rgba(18,140,126,.55); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(18,140,126,.2); }
.sc-hdr-trigger:active { transform: scale(.97); }
.sc-hdr-trigger > i { font-size: 13px; }
.sc-hdr-trigger-lbl { line-height: 1; }
.sc-hdr-trigger-dot { width: 7px; height: 7px; border-radius: 50%; background: #25D366; box-shadow: 0 0 0 2px rgba(37,211,102,.25); animation: scDot 1.6s ease-in-out infinite; flex-shrink: 0; }
.sc-hdr-trigger-badge { position: absolute; top: -6px; right: -6px; min-width: 17px; height: 17px; border-radius: 9px; background: #DC2626; color: #fff; font-size: 9.5px; font-weight: 800; display: flex; align-items: center; justify-content: center; padding: 0 4px; border: 2px solid var(--bg-card,#fff); animation: scBdgPop .28s cubic-bezier(.34,1.56,.64,1) both; }
[data-theme="dark"] .sc-hdr-trigger { color: #34D399; border-color: rgba(52,211,153,.3); background: linear-gradient(135deg,rgba(16,122,111,.18),rgba(24,168,75,.14)); }
[data-theme="dark"] .sc-hdr-trigger:hover { border-color: rgba(52,211,153,.5); }
@media(max-width:640px){ .sc-hdr-trigger-lbl { display:none; } .sc-hdr-trigger { padding: 0 10px; } }

/* ── FAB ── */
.sc-fab { position: fixed; bottom: 26px; right: 26px; z-index: 8900; display: flex; flex-direction: column; align-items: flex-end; pointer-events: auto; }
.sc-fab-btn { display: flex; align-items: center; gap: 10px; height: 50px; padding: 0 18px 0 12px; border-radius: 25px; border: none; background: linear-gradient(135deg,#128C7E,#25D366); color: #fff; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13.5px; font-weight: 700; cursor: pointer; box-shadow: 0 6px 22px rgba(37,211,102,.38), 0 2px 8px rgba(0,0,0,.14); position: relative; overflow: visible; transition: transform .22s cubic-bezier(.34,1.26,.64,1), box-shadow .22s; }
.sc-fab-btn:hover { transform: translateY(-3px) scale(1.04); box-shadow: 0 10px 28px rgba(37,211,102,.48), 0 4px 12px rgba(0,0,0,.18); }
.sc-fab-btn:active { transform: scale(.97); }
.sc-fab-btn::before { content: ''; position: absolute; inset: -6px; border-radius: 31px; border: 2px solid rgba(37,211,102,.48); animation: scPulse 2.2s ease-in-out infinite; pointer-events: none; }
@keyframes scPulse { 0%, 100% { opacity: .7; transform: scale(1); } 50% { opacity: 0; transform: scale(1.2); } }
.sc-fab-ico { width: 30px; height: 30px; border-radius: 50%; background: rgba(255,255,255,.2); display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
.sc-fab-btn.sc-active { background: linear-gradient(135deg,#0E7A6F,#18A84B); }
.sc-fab-lbl { line-height: 1; }
.sc-fab-dot { width: 10px; height: 10px; border-radius: 50%; background: #25D366; border: 2px solid #fff; position: absolute; top: -1px; right: -1px; animation: scDot 1.6s ease-in-out infinite; }
@keyframes scDot { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.4); } }
.sc-fab-badge { position: absolute; top: -7px; left: -7px; min-width: 18px; height: 18px; border-radius: 9px; background: #DC2626; color: #fff; font-size: 10px; font-weight: 800; display: flex; align-items: center; justify-content: center; padding: 0 4px; border: 2px solid #fff; animation: scBdgPop .28s cubic-bezier(.34,1.56,.64,1) both; }
@keyframes scBdgPop { from { transform: scale(0); } to { transform: scale(1); } }

/* ── Overlay + window ── */
.sc-ov { position: fixed; inset: 0; background: rgba(8,13,26,.42); backdrop-filter: blur(4px); z-index: 8901; display: flex; align-items: flex-end; justify-content: flex-end; padding: 0; animation: scOvIn .18s ease both; }
@keyframes scOvIn { from { opacity: 0; } to { opacity: 1; } }
.sc-win { width: 388px; max-width: 100vw; height: 638px; max-height: calc(100vh - 20px); display: flex; flex-direction: column; overflow: hidden; background: var(--bg-card,#fff); border-radius: 20px 20px 0 0; box-shadow: 0 -8px 40px rgba(30,58,138,.22), 0 -2px 8px rgba(0,0,0,.1); margin-right: 26px; animation: scWinIn .3s cubic-bezier(.34,1.22,.64,1) both; }
@keyframes scWinIn { from { opacity: 0; transform: translateY(56px) scale(.97); } to { opacity: 1; transform: none; } }

/* Header */
.sc-hdr { flex-shrink: 0; padding: 11px 13px; background: linear-gradient(135deg,#128C7E,#1E3A8A 80%); display: flex; align-items: center; gap: 10px; }
.sc-hdr-av { width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,.18); border: 1.5px solid rgba(255,255,255,.3); display: flex; align-items: center; justify-content: center; font-size: 16px; color: #fff; flex-shrink: 0; }
.sc-hdr-nm { font-size: 14px; font-weight: 800; color: #fff; }
.sc-hdr-st { display: flex; align-items: center; gap: 4px; margin-top: 1px; }
.sc-hdr-stdo { width: 6px; height: 6px; border-radius: 50%; background: #25D366; flex-shrink: 0; }
.sc-hdr-st span { font-size: 10.5px; color: rgba(255,255,255,.82); font-weight: 600; }
.sc-hdr-resp { font-size: 9.5px; color: rgba(255,255,255,.54); margin-top: 1px; }
.sc-hdr-x { margin-left: auto; width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,.14); border: none; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; cursor: pointer; flex-shrink: 0; transition: background .15s; }
.sc-hdr-x:hover { background: rgba(255,255,255,.26); }
.sc-hdr-end { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 11px; border-radius: 999px; background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.28); color: #fff; font-family: inherit; font-size: 11.5px; font-weight: 700; cursor: pointer; flex-shrink: 0; transition: background .15s; }
.sc-hdr-end:hover { background: rgba(220,38,38,.85); border-color: rgba(255,255,255,.4); }
.sc-hdr-end + .sc-hdr-x { margin-left: 6px; }

/* End-chat confirmation (customer-side) */
.sc-win { position: relative; }
.sc-confirm { position: absolute; inset: 0; z-index: 30; background: rgba(8,13,26,.5); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; padding: 20px; }
.sc-confirm-card { background: var(--bg-card,#fff); border-radius: 16px; width: 100%; max-width: 320px; padding: 20px; box-shadow: 0 18px 44px rgba(8,13,26,.4); text-align: center; animation: scWinIn .22s cubic-bezier(.34,1.22,.64,1) both; }
.sc-confirm-ico { width: 46px; height: 46px; border-radius: 50%; margin: 0 auto 12px; background: rgba(220,38,38,.1); color: #DC2626; display: flex; align-items: center; justify-content: center; font-size: 20px; }
.sc-confirm-t { font-size: 15.5px; font-weight: 800; color: var(--text-primary,#0F172A); }
.sc-confirm-d { font-size: 12px; color: var(--text-muted,#64748B); margin-top: 5px; line-height: 1.5; }
.sc-confirm-ta { width: 100%; margin-top: 12px; border: 1.5px solid var(--border-light,#BFDBFE); border-radius: 10px; padding: 9px 11px; font-family: inherit; font-size: 12.5px; color: var(--text-primary,#0F172A); background: var(--input-bg,#fff); outline: none; resize: none; }
.sc-confirm-ta:focus { border-color: #1E3A8A; box-shadow: 0 0 0 3px rgba(30,58,138,.1); }
.sc-confirm-row { display: flex; gap: 9px; margin-top: 14px; }
.sc-confirm-cancel { flex: 1; height: 38px; border-radius: 10px; border: 1.5px solid var(--border-light,#BFDBFE); background: var(--bg-card,#fff); color: var(--text-secondary,#1E3A5F); font-family: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.sc-confirm-cancel:hover { background: var(--bg-muted,#EFF6FF); }
.sc-confirm-end { flex: 1.3; height: 38px; border-radius: 10px; border: none; background: linear-gradient(135deg,#b91c1c,#dc2626); color: #fff; font-family: inherit; font-size: 13px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 7px; box-shadow: 0 4px 12px rgba(220,38,38,.28); }
.sc-confirm-end:hover { transform: translateY(-1px); }

/* Status bar */
.sc-sbar { flex-shrink: 0; padding: 5px 13px; border-bottom: 1px solid var(--border-light,#BFDBFE); background: rgba(37,211,102,.04); display: flex; align-items: center; justify-content: space-between; }
.sc-sbadge { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: 700; padding: 2px 9px; border-radius: 99px; }
.sc-sbadge.sc-s-online { background: rgba(37,211,102,.1); color: #128C7E; border: 1px solid rgba(37,211,102,.28); }
.sc-sbadge.sc-s-waiting { background: rgba(217,119,6,.1); color: #D97706; border: 1px solid rgba(217,119,6,.28); }
.sc-sbadge.sc-s-replied { background: rgba(22,163,74,.1); color: #16A34A; border: 1px solid rgba(22,163,74,.25); }
.sc-sbadge.sc-s-closed { background: rgba(100,116,139,.1); color: #64748B; border: 1px solid rgba(100,116,139,.18); }
.sc-slbl { font-size: 10.5px; color: #64748B; font-weight: 600; }

/* Messages */
.sc-msgs { flex: 1; overflow-y: auto; padding: 11px 11px 8px; background: #E8EEF7; display: flex; flex-direction: column; gap: 3px; scrollbar-width: thin; scrollbar-color: rgba(30,58,138,.14) transparent; }

/* Transcript aane se pehle wali halat (connect ho raha hai). */
.sc-msgs-state { margin: auto; text-align: center; color: #64748B; padding: 26px 14px; }
.sc-msgs-state i { font-size: 22px; opacity: .5; display: block; margin-bottom: 9px; }
.sc-msgs-state-t { font-size: 12.5px; font-weight: 700; }
[data-theme="dark"] .sc-msgs { background: #0D1523; }
.sc-daylbl { text-align: center; margin: 9px 0; }
.sc-daylbl span { background: rgba(255,255,255,.76); border: 1px solid rgba(30,58,138,.12); border-radius: 99px; padding: 3px 11px; font-size: 10.5px; font-weight: 700; color: #64748B; }
[data-theme="dark"] .sc-daylbl span { background: rgba(14,22,40,.82); color: #6B82A8; border-color: #1C2E50; }

/* Avatar bubble ke UPAR se align — pehle flex-end tha, is liye lambi message
   par "SM" neeche ja kar chipak jata tha aur bhadda lagta tha. */
.sc-row { display: flex; gap: 5px; align-items: flex-start; margin-bottom: 4px; }
.sc-row.sc-out { justify-content: flex-end; }
.sc-av { width: 23px; height: 23px; border-radius: 50%; background: linear-gradient(135deg,#1E3A8A,#2563EB); color: #fff; font-size: 8.5px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

/* Bubbles */
.sc-bbl { max-width: 78%; border-radius: 14px; padding: 7px 10px; }
.sc-bbl.sc-in { background: #fff; border-top-left-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,.09); color: var(--text-primary,#0F172A); }
.sc-bbl.sc-out { background: #DCF8C6; border-top-right-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,.09); color: #0F172A; }
[data-theme="dark"] .sc-bbl.sc-in { background: #162035; color: #E2E8F8; }
[data-theme="dark"] .sc-bbl.sc-out { background: #143028; color: #E2E8F8; }
.sc-bbl-sndr { font-size: 9.5px; font-weight: 800; color: #128C7E; margin-bottom: 2px; }
.sc-bbl-txt { font-size: 13px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; }
.sc-bbl-meta { font-size: 9px; color: #64748B; margin-top: 4px; text-align: right; display: flex; align-items: center; justify-content: flex-end; gap: 3px; }
.sc-ticks { color: #53bdeb; font-size: 9px; }
.sc-tick-sent { color: #94A3B8; font-size: 9px; }
.sc-tick-deliv { color: #94A3B8; font-size: 9px; }
.sc-bbl-img { max-width: 100%; border-radius: 8px; display: block; margin-bottom: 5px; }

/* Attachments */
.sc-att { display: flex; align-items: center; gap: 8px; background: rgba(30,58,138,.05); border: 1.5px solid var(--border-light,#BFDBFE); border-radius: 9px; padding: 7px 9px; min-width: 155px; cursor: pointer; }
[data-theme="dark"] .sc-att { background: rgba(30,58,138,.18); border-color: #1C2E50; }
.sc-att-ico { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 12px; color: #fff; }
.sc-att-nm { font-size: 11.5px; font-weight: 700; color: var(--text-primary,#0F172A); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
[data-theme="dark"] .sc-att-nm { color: #E2E8F8; }
.sc-att-sz { font-size: 10px; color: #64748B; }
.sc-att-tr { color: #64748B; font-size: 11px; margin-left: auto; }

/* Audio bubble */
.sc-aud { display: flex; align-items: center; gap: 8px; min-width: 155px; }
.sc-aud-play { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg,#128C7E,#25D366); border: none; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 10px; cursor: pointer; flex-shrink: 0; }
.sc-aud-bar { flex: 1; height: 3px; background: rgba(30,58,138,.18); border-radius: 3px; }
[data-theme="dark"] .sc-aud-bar { background: rgba(255,255,255,.14); }
.sc-aud-dur { font-size: 9px; color: #64748B; margin-top: 3px; }
.sc-aud-mic { color: #64748B; font-size: 11px; }

/* System note */
.sc-sys { background: rgba(217,119,6,.06); border: 1px dashed rgba(217,119,6,.3); border-radius: 9px; padding: 6px 11px; font-size: 11px; color: #b45309; font-style: italic; text-align: center; max-width: 86%; margin: 2px auto; }

/* Typing dots */
.sc-typing { display: flex; gap: 3px; padding: 2px 0; }
.sc-typing span { width: 5px; height: 5px; border-radius: 50%; background: #64748B; display: block; animation: scTyp 1.2s ease-in-out infinite; }
.sc-typing span:nth-child(2) { animation-delay: .14s; }
.sc-typing span:nth-child(3) { animation-delay: .28s; }
@keyframes scTyp { 0%, 100% { transform: translateY(0); opacity: .4; } 50% { transform: translateY(-4px); opacity: 1; } }

/* Session closed card */
.sc-closed { background: var(--bg-card,#fff); border: 1.5px solid var(--border-light,#BFDBFE); border-radius: 13px; padding: 16px; text-align: center; margin: 9px 3px 3px; }
[data-theme="dark"] .sc-closed { background: #0E1628; border-color: #1C2E50; }
.sc-closed-ico { width: 42px; height: 42px; border-radius: 50%; background: rgba(100,116,139,.1); display: flex; align-items: center; justify-content: center; font-size: 17px; color: #64748B; margin: 0 auto 9px; }
.sc-closed-t { font-size: 13.5px; font-weight: 800; color: var(--text-primary,#0F172A); margin-bottom: 5px; }
[data-theme="dark"] .sc-closed-t { color: #E2E8F8; }
.sc-closed-d { font-size: 12px; color: #64748B; margin-bottom: 13px; }
.sc-new-btn { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 16px; border-radius: 9px; border: none; background: linear-gradient(135deg,#128C7E,#25D366); color: #fff; font-size: 12.5px; font-weight: 700; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; box-shadow: 0 3px 12px rgba(37,211,102,.28); }

/* Footer */
.sc-ftr { flex-shrink: 0; border-top: 1px solid var(--border-light,#BFDBFE); background: var(--bg-card,#fff); padding: 8px 10px; }
[data-theme="dark"] .sc-ftr { background: #0E1628; border-color: #1C2E50; }
.sc-tray { display: flex; gap: 5px; margin-bottom: 6px; flex-wrap: wrap; }
.sc-tbtn { display: flex; align-items: center; gap: 3px; height: 24px; padding: 0 8px; border-radius: 99px; border: 1.5px solid var(--border-light,#BFDBFE); background: var(--bg-muted,#EFF6FF); color: #64748B; font-size: 10.5px; font-weight: 600; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; transition: all .18s; }
.sc-tbtn:hover { border-color: var(--brand-primary,#1E3A8A); color: var(--brand-primary,#1E3A8A); background: var(--brand-light,#DBEAFE); }
[data-theme="dark"] .sc-tbtn { background: #131F38; border-color: #1C2E50; color: #6B82A8; }
[data-theme="dark"] .sc-tbtn:hover { border-color: #3B82F6; color: #93C5FD; background: #1E3A6A; }

.sc-irow { display: flex; align-items: flex-end; gap: 6px; }
.sc-iwrap { flex: 1; background: var(--bg-muted,#EFF6FF); border: 1.5px solid var(--border-light,#BFDBFE); border-radius: 19px; padding: 6px 12px; display: flex; align-items: center; gap: 6px; transition: all .18s; }
.sc-iwrap:focus-within { border-color: var(--brand-primary,#1E3A8A); box-shadow: 0 0 0 3px rgba(30,58,138,.08); }
[data-theme="dark"] .sc-iwrap { background: #131F38; border-color: #1C2E50; }
.sc-ta { flex: 1; border: none; background: transparent; outline: none; font-size: 13px; color: var(--text-primary,#0F172A); resize: none; min-height: 20px; max-height: 78px; font-family: 'Plus Jakarta Sans', sans-serif; line-height: 1.5; }
[data-theme="dark"] .sc-ta { color: #E2E8F8; }
.sc-mic { width: 34px; height: 34px; border-radius: 50%; border: 1.5px solid var(--border-light,#BFDBFE); background: var(--bg-card,#fff); color: #64748B; display: flex; align-items: center; justify-content: center; font-size: 14px; cursor: pointer; flex-shrink: 0; transition: all .18s; }
.sc-mic:hover { background: var(--brand-light,#DBEAFE); color: var(--brand-primary,#1E3A8A); border-color: var(--brand-primary,#1E3A8A); }
[data-theme="dark"] .sc-mic { background: #131F38; border-color: #1C2E50; color: #6B82A8; }
.sc-snd { width: 36px; height: 36px; border-radius: 50%; border: none; background: linear-gradient(135deg,#128C7E,#25D366); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 13px; cursor: pointer; box-shadow: 0 3px 10px rgba(37,211,102,.34); flex-shrink: 0; transition: transform .18s; }
.sc-snd:hover { transform: scale(1.09); }

/* Voice recording row */
.sc-vrec { display: flex; align-items: center; gap: 6px; }
.sc-vrec-cancel { width: 32px; height: 32px; border-radius: 50%; border: 1.5px solid rgba(220,38,38,.22); background: rgba(220,38,38,.06); color: #DC2626; display: flex; align-items: center; justify-content: center; font-size: 12px; cursor: pointer; flex-shrink: 0; }
.sc-vrec-bar { flex: 1; background: var(--bg-muted,#EFF6FF); border: 1.5px solid var(--border-light,#BFDBFE); border-radius: 19px; padding: 7px 13px; display: flex; align-items: center; gap: 9px; }
[data-theme="dark"] .sc-vrec-bar { background: #131F38; border-color: #1C2E50; }
.sc-vrec-dot { width: 8px; height: 8px; border-radius: 50%; background: #DC2626; animation: scVDot 1s ease-in-out infinite; flex-shrink: 0; }
@keyframes scVDot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .3; transform: scale(1.35); } }
.sc-vrec-timer { font-size: 13px; font-weight: 800; color: var(--text-primary,#0F172A); min-width: 30px; }
[data-theme="dark"] .sc-vrec-timer { color: #E2E8F8; }
.sc-vrec-wave { flex: 1; display: flex; align-items: center; gap: 2px; }
.sc-vrec-wave span {
  width: 3px; border-radius: 2px;
  background: var(--brand-primary,#1E3A8A);
  height: 4px;
  display: block;
  animation: scWave 1s ease-in-out infinite;
}
@keyframes scWave { 0%, 100% { height: 4px; } 50% { height: 18px; } }
.sc-vrec-lbl { font-size: 10.5px; color: #64748B; font-weight: 600; }

/* ── Attachment modals ── */
.sc-mov { position: fixed; inset: 0; background: rgba(8,13,26,.52); backdrop-filter: blur(4px); z-index: 9100; display: flex; align-items: center; justify-content: center; padding: 18px; }
.sc-md { background: var(--bg-card,#fff); border-radius: 18px; width: 100%; max-width: 440px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 50px rgba(30,58,138,.22), 0 8px 16px rgba(0,0,0,.1); border: 1px solid var(--border-light,#BFDBFE); animation: scMdIn .26s cubic-bezier(.34,1.22,.64,1) both; display: flex; flex-direction: column; }
[data-theme="dark"] .sc-md { background: #0E1628; border-color: #1C2E50; }
@keyframes scMdIn { from { opacity: 0; transform: translateY(18px) scale(.97); } to { opacity: 1; transform: none; } }
.sc-md-hd { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--border-light,#BFDBFE); position: sticky; top: 0; background: var(--bg-card,#fff); z-index: 2; border-radius: 18px 18px 0 0; }
[data-theme="dark"] .sc-md-hd { background: #0E1628; border-color: #1C2E50; }
.sc-md-ttl { font-size: 14.5px; font-weight: 800; color: var(--text-primary,#0F172A); display: flex; align-items: center; gap: 7px; }
[data-theme="dark"] .sc-md-ttl { color: #E2E8F8; }
.sc-md-ttl i { color: var(--brand-primary,#1E3A8A); }
[data-theme="dark"] .sc-md-ttl i { color: #3B82F6; }
.sc-md-x { width: 28px; height: 28px; border-radius: 7px; border: 1.5px solid var(--border-light,#BFDBFE); background: transparent; color: #64748B; display: flex; align-items: center; justify-content: center; font-size: 11px; cursor: pointer; transition: all .15s; }
.sc-md-x:hover { border-color: #DC2626; color: #DC2626; }
.sc-md-body { padding: 16px 18px; }
.sc-md-ft { display: flex; gap: 8px; justify-content: flex-end; padding: 11px 18px; border-top: 1px solid var(--border-light,#BFDBFE); }
[data-theme="dark"] .sc-md-ft { border-color: #1C2E50; }
.sc-flbl { font-size: 11px; font-weight: 700; color: var(--text-secondary,#1E3A5F); margin-bottom: 4px; display: block; }
[data-theme="dark"] .sc-flbl { color: #B8C8E8; }
.sc-ftxta { width: 100%; box-sizing: border-box; border: 1.5px solid var(--border-light,#BFDBFE); border-radius: 9px; padding: 8px 11px; font-size: 12.5px; color: var(--text-primary,#0F172A); background: var(--input-bg,#fff); outline: none; resize: none; transition: all .18s; font-family: 'Plus Jakarta Sans', sans-serif; }
.sc-ftxta:focus { border-color: var(--brand-primary,#1E3A8A); box-shadow: 0 0 0 3px rgba(30,58,138,.08); }
[data-theme="dark"] .sc-ftxta { background: #131F38; border-color: #1C2E50; color: #E2E8F8; }

.sc-fdrop { border: 2px dashed var(--border-med,#93C5FD); border-radius: var(--radius-lg,14px); padding: 24px; text-align: center; background: var(--bg-muted,#EFF6FF); cursor: pointer; transition: all .18s; margin-bottom: 11px; }
.sc-fdrop:hover { border-color: var(--brand-primary,#1E3A8A); background: var(--brand-light,#DBEAFE); }
[data-theme="dark"] .sc-fdrop { background: #131F38; border-color: #243858; }
[data-theme="dark"] .sc-fdrop:hover { border-color: #3B82F6; background: #1E3A6A; }
.sc-fdrop-ic { font-size: 28px; color: var(--brand-primary,#1E3A8A); display: block; margin-bottom: 8px; }
.sc-fdrop-t  { font-size: 13px; font-weight: 700; color: var(--text-primary,#0F172A); }
[data-theme="dark"] .sc-fdrop-t { color: #E2E8F8; }
.sc-fdrop-s  { font-size: 11px; color: #64748B; margin-top: 3px; }

.sc-fcancel { display: inline-flex; align-items: center; gap: 5px; height: 36px; padding: 0 14px; border-radius: 9px; border: 1.5px solid var(--border-light,#BFDBFE); background: var(--bg-muted,#EFF6FF); color: var(--text-secondary,#1E3A5F); font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; transition: all .18s; }
[data-theme="dark"] .sc-fcancel { background: #131F38; border-color: #1C2E50; color: #B8C8E8; }
.sc-fsend { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 16px; border-radius: 9px; border: none; background: linear-gradient(135deg,#128C7E,#25D366); color: #fff; font-size: 12.5px; font-weight: 700; cursor: pointer; box-shadow: 0 3px 12px rgba(37,211,102,.26); transition: transform .18s; font-family: 'Plus Jakarta Sans', sans-serif; }
.sc-fsend:hover:not(:disabled) { transform: translateY(-1px); }
.sc-fsend:disabled { opacity: .55; cursor: not-allowed; box-shadow: none; }

/* Image preview block */
.sc-iprev-wrap { border: 1.5px solid var(--border-light,#BFDBFE); border-radius: 12px; overflow: hidden; margin-bottom: 11px; }
[data-theme="dark"] .sc-iprev-wrap { border-color: #1C2E50; }
.sc-iprev-hdr { padding: 6px 10px; border-bottom: 1px solid var(--border-light,#BFDBFE); background: var(--bg-muted,#EFF6FF); display: flex; align-items: center; justify-content: space-between; }
[data-theme="dark"] .sc-iprev-hdr { background: #131F38; border-color: #1C2E50; }
.sc-iprev-nm { font-size: 11.5px; font-weight: 700; color: var(--text-secondary,#1E3A5F); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
[data-theme="dark"] .sc-iprev-nm { color: #B8C8E8; }
.sc-iprev-x { background: none; border: none; color: #64748B; cursor: pointer; font-size: 11px; }
.sc-iprev-body { padding: 9px; text-align: center; background: var(--bg-base,#F0F4FF); }
[data-theme="dark"] .sc-iprev-body { background: #080D1A; }
.sc-iprev-img { max-width: 100%; max-height: 190px; border-radius: 8px; object-fit: contain; }

/* Doc preview block */
.sc-dprev { border: 1.5px solid var(--border-light,#BFDBFE); border-radius: 11px; padding: 10px 12px; background: var(--bg-muted,#EFF6FF); display: flex; align-items: center; gap: 10px; margin-bottom: 11px; }
[data-theme="dark"] .sc-dprev { background: #131F38; border-color: #1C2E50; }
.sc-dprev-ico { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #fff; font-size: 14px; }
.sc-dprev-text { flex: 1; min-width: 0; }
.sc-dprev-nm { font-size: 12.5px; font-weight: 700; color: var(--text-primary,#0F172A); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
[data-theme="dark"] .sc-dprev-nm { color: #E2E8F8; }
.sc-dprev-sz { font-size: 10px; color: #64748B; }

/* Audio recorder */
.sc-arec { border: 1.5px solid var(--border-light,#BFDBFE); border-radius: 13px; padding: 18px; text-align: center; background: var(--bg-muted,#EFF6FF); margin-bottom: 11px; }
[data-theme="dark"] .sc-arec { background: #131F38; border-color: #1C2E50; }
.sc-arec-lbl { font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #64748B; margin-bottom: 10px; }
.sc-arec-timer { font-size: 26px; font-weight: 800; color: var(--text-primary,#0F172A); margin-bottom: 13px; font-variant-numeric: tabular-nums; }
[data-theme="dark"] .sc-arec-timer { color: #E2E8F8; }
.sc-arec-btn { width: 52px; height: 52px; border-radius: 50%; border: none; background: linear-gradient(135deg,#b91c1c,#dc2626); color: #fff; font-size: 19px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 14px rgba(220,38,38,.28); transition: background .18s; }
.sc-arec-btn.sc-arec-on { background: linear-gradient(135deg,#1E3A8A,#2563EB); }
.sc-arec-hint { font-size: 11px; color: #64748B; margin-top: 11px; }
.sc-aplayer { border: 1.5px solid var(--border-light,#BFDBFE); border-radius: 11px; padding: 10px 12px; background: var(--bg-muted,#EFF6FF); }
[data-theme="dark"] .sc-aplayer { background: #131F38; border-color: #1C2E50; }

/* ── Multi-attachment: modal thumbnails + in-chat groups ── */
.sc-thumbs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 11px; }
.sc-thumb { position: relative; aspect-ratio: 1/1; border-radius: 8px; overflow: hidden; border: 1.5px solid var(--border-light,#BFDBFE); }
.sc-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.sc-thumb-load { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #64748B; background: var(--bg-muted,#EFF6FF); }
.sc-thumb-x { position: absolute; top: 3px; right: 3px; width: 18px; height: 18px; border-radius: 50%; border: none; background: rgba(8,13,26,.6); color: #fff; font-size: 9px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.sc-vgroup { display: flex; flex-direction: column; gap: 6px; margin-bottom: 4px; }
.sc-dgroup { display: flex; flex-direction: column; gap: 6px; margin-bottom: 4px; }
@media (max-width: 480px) { .sc-thumbs { grid-template-columns: repeat(3, 1fr); } }

/* ── Mobile / bottom-sheet ── */
@media (max-width: 600px) {
  .sc-fab { bottom: 14px; right: 14px; }
  .sc-fab-btn { height: 44px; padding: 0 14px 0 8px; font-size: 12px; gap: 8px; }
  .sc-fab-ico { width: 26px; height: 26px; font-size: 12px; }
  .sc-win { width: 100vw; height: 100dvh; max-height: 100dvh; border-radius: 0; margin-right: 0; }
  .sc-ov { align-items: flex-end; justify-content: flex-start; }
  .sc-md { max-width: 100%; border-radius: 18px 18px 0 0; max-height: 95vh; align-self: flex-end; }
  .sc-mov { align-items: flex-end; padding: 0; }
}
`;
