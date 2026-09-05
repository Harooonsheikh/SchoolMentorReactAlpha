/* ════════════════════════════════════════════════════════════════════
   useSupportChat — headless hook that wires a React chat UI to the live
   Support backend (REST + SignalR). It owns auth + the socket and reports
   activity through callbacks, so each component keeps owning its own message
   list (and its offline demo fallback when the backend is unreachable).

   Perspective: pass role 'school' or 'agent'. Outgoing bubbles are the
   caller's own side; the mapper (toUi) flips automatically.
   ════════════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SenderType, MessageStatus, MessageType, SessionStatus, fileUrl,
  getSupportToken, getSupportIdentity, getSupportUserId, SUPPORT_REALTIME_ENABLED,
  VOICE_NOTE_CAPTION,
} from './config';
import * as api from './api';
import { ApiError } from './api';
import { createConnection, Events, joinSession, leaveSession, sendTyping } from './realtime';
import { playIncomingChime } from './sound';
import { formatServerTime } from './time';
import { showSupportNotification } from './notification';
/* Hub band hone par khuli conversation kitni jaldi dobara dekhi jaye.
   2 second — school ka message aate hi bubble/badge aa jata hai. Har tick par
   poora transcript kheenchna is raftaar par faltu hoga, is liye pehle sasta
   check (sessions list ka `lastMessageAt`) aur poora detail sirf tab jab
   waqai kuch naya ho — dekho tick() neeche. */
const POLL_INTERVAL_MS = 2000;
/* Ticks/receipts (delivered → read) lastMessageAt nahi badalte, is liye har
   itne tick baad ek poora sync waise bhi kar lete hain. */
const FULL_SYNC_EVERY = 5;
/* Agent inbox apni list kitni jaldi dobara padhe — nayi conversation aane par
   agent ko jaldi pata chale. */
const INBOX_POLL_INTERVAL_MS = 5000;

/* Waqt seedha `new Date(iso)` se nahi banta: API 12-ghante ki clock me likhti
   hai aur AM/PM gira deti hai (dekho support/time.js). */
export function formatTime(iso) {
  return formatServerTime(iso);
}

export function useSupportChat({
  role = 'school',
  credentials = null,
  /* Conversation is abhi user ke saamne khuli hai? Sirf tab hi aane wale
     message "read" hote hain. Console kisi doosre tab par ho (e.g. Overview)
     to `false` bhejo — warna connection zinda hone ki wajah se school ke
     messages bina dekhe read ho jate hain aur unread badge saaf ho jata hai. */
  viewing = true,
  onInbound,          // (uiMsg)  — append (idempotent by id on the caller side)
  onHistory,          // (uiMsg[]) — replace list with a loaded session
  onTyping,           // (name|null)
  onReceipt,          // ({ type:'delivered'|'read', sessionId, messageIds, at })
  onSessionClosed,    // (sessionId)
  onError,            // (err)
} = {}) {
  const [status, setStatus] = useState('idle'); // idle|connecting|connected|offline|error — REST reachability
  const [realtime, setRealtime] = useState(false); // SignalR hub up?
  const [me, setMe] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [online, setOnline] = useState(() => new Set());

  const tokenRef = useRef(null);
  const connRef = useRef(null);
  const sessionRef = useRef(null);   // current sessionId for use inside handlers
  const startedRef = useRef(false);
  const typingTimerRef = useRef(null);
  const typingActiveRef = useRef(false);
  const seenRef = useRef(new Set());  // message ids already handed to the caller
  /* Apne bheje hue messages ka aakhri maloom status (messageId -> 1|2|3).
     Ticks isi se chalte hain: server par status Sent -> Delivered -> Read hota
     rehta hai magar message "naya" nahi hota, is liye poll usay chhod deta tha
     aur bubble hamesha single tick par atka rehta tha. */
  const outStatusRef = useRef(new Map());
  /* Koi apna message abhi tak Read nahi hua? Tab tak poora sync har tick par
     karo taake tick foran double/blue ho jaye. */
  const awaitingAckRef = useRef(false);
  /* Kis session ke band hone ka elaan ho chuka — dobara na ho. */
  const closedAnnouncedRef = useRef(null);

  /* "Dekh liya" ke liye conversation ka khula hona kaafi nahi — window par
     nazar bhi honi chahiye. Do window saath saath khuli hon (ERP ek taraf,
     console doosri taraf) to sirf `viewing` dekhne par school ka message aate
     hi read ho jata tha aur usay foran blue tick mil jata tha, halanke agent
     ne dekha tak nahi hota tha. Tab chhupi ho ya window focus me na ho to ab
     sirf "delivered"; focus wapas aate hi read. */
  const [pageActive, setPageActive] = useState(() => isPageActive());
  useEffect(() => {
    const update = () => setPageActive(isPageActive());
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    window.addEventListener('blur', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
      window.removeEventListener('blur', update);
    };
  }, []);
  const isViewing = viewing && pageActive;

  /* Handlers dobara subscribe kiye baghair taza halat — poll aur SignalR dono
     isi ref se dekhte hain ke user saamne hai ya nahi. */
  const viewingRef = useRef(isViewing);
  viewingRef.current = isViewing;

  // Keep callbacks fresh without re-subscribing handlers.
  const cb = useRef({});
  cb.current = { onInbound, onHistory, onTyping, onReceipt, onSessionClosed, onError };

  const outSenderType = role === 'agent' ? SenderType.Agent : SenderType.School;

  const toUi = useCallback((dto) => {
    const isOut = dto.senderType === outSenderType;
    /* Voice note ka caption sirf API ki [Required] shart poori karta hai
       (VOICE_NOTE_CAPTION) — usay bubble ke neeche matn ban kar nahi dikhna
       chahiye, warna har voice note par "Voice note" likha aata hai. */
    const isPlaceholder = dto.messageType === MessageType.VoiceNote
      && dto.messageBody === VOICE_NOTE_CAPTION;
    const caption = (dto.messageBody && !isPlaceholder) ? dto.messageBody : null;
    const base = {
      id: dto.messageId,
      kind: isOut ? 'out' : 'in',
      sender: isOut ? undefined : dto.senderName,
      time: formatTime(dto.createdAt),
      status: dto.messageStatus,
      sessionId: dto.sessionId,
      raw: dto,
    };
    const url = fileUrl(dto.attachmentUrl);
    switch (dto.messageType) {
      case MessageType.Image:
      case MessageType.Screenshot:
        return { ...base, text: caption, image: { src: url, name: dto.attachmentName, size: humanSize(dto.attachmentSize) } };
      case MessageType.Video:
        return { ...base, text: caption, video: { src: url, name: dto.attachmentName, size: humanSize(dto.attachmentSize) } };
      case MessageType.Document:
      case MessageType.Pdf:
        return { ...base, text: caption, doc: { name: dto.attachmentName, size: humanSize(dto.attachmentSize), ext: extOf(dto.attachmentName), url } };
      case MessageType.VoiceNote:
        return { ...base, text: caption, audio: { src: url, duration: fmtDuration(dto.voiceDuration), seconds: dto.voiceDuration || 0 } };
      default:
        return { ...base, text: dto.messageBody };
    }
  }, [outSenderType]);

  const setSession = useCallback((id) => { sessionRef.current = id; setSessionId(id); }, []);

  /* Server ke taza rows dekh kar apne bubbles ke ticks aage barhao. Sirf wo
     ids bhejte hain jinka status waqai barha ho — warna har sync par be-wajah
     re-render hota. */
  const syncOutTicks = useCallback((id, rows) => {
    const delivered = [];
    const read = [];
    let pending = false;
    (rows || []).forEach((m) => {
      if (m.senderType !== outSenderType) return;
      const st = Number(m.messageStatus) || MessageStatus.Sent;
      if (st < MessageStatus.Read) pending = true;
      const prev = outStatusRef.current.get(m.messageId) || 0;
      if (st <= prev) return;
      outStatusRef.current.set(m.messageId, st);
      if (st >= MessageStatus.Read) read.push(m.messageId);
      else if (st === MessageStatus.Delivered) delivered.push(m.messageId);
    });
    awaitingAckRef.current = pending;
    if (delivered.length) cb.current.onReceipt?.({ type: 'delivered', sessionId: id, messageIds: delivered });
    if (read.length) cb.current.onReceipt?.({ type: 'read', sessionId: id, messageIds: read });
  }, [outSenderType]);

  /* Apni taraf se "read" karte waqt local bubbles bhi read kar do.
     Server ko markRead bhej dena kaafi nahi: caller ke paas maujood messages ka
     status purana (Sent/Delivered) para rehta hai, jis se unread ginti message
     dekh lene ke baad bhi barqarar rehti hai. onReceipt wahi raasta hai jisse
     caller apni list ke status badalta hai. */
  const markReadNow = useCallback((id, messageIds) => {
    if (!id || !messageIds?.length) return;
    api.markRead(id, messageIds).catch(() => {});
    cb.current.onReceipt?.({
      type: 'read', sessionId: id, messageIds, at: new Date().toISOString(),
    });
  }, []);

  /* ── Wire SignalR event handlers (once per connection) ── */
  const registerHandlers = useCallback((conn) => {
    conn.on(Events.MessageReceived, (payload) => {
      // Hub payloads come off the same SPs as the REST results, so run them
      // through the same normaliser instead of trusting one casing.
      const dto = api.normalizeMessage(payload);
      if (!dto) return;
      const isIncoming = dto.senderType !== outSenderType;
      // Keep inbox ordering fresh; bump unread when it's a school message in a
      // conversation we're not currently viewing.
      const incUnread = dto.sessionId !== sessionRef.current && dto.senderType === SenderType.School;
      setActiveSessions((prev) => bumpSession(prev, dto.sessionId, dto.createdAt, incUnread));
      // Notification sound for incoming messages only (never our own).
if (isIncoming) {

    playIncomingChime();

    showSupportNotification({
        title: "School Mentor Support",
        body: dto.messageBody || "New message received"
    });

}      if (dto.sessionId === sessionRef.current) {
        seenRef.current.add(dto.messageId);
        cb.current.onInbound?.(toUi(dto));
        // We're actively viewing this conversation, so acknowledge the other
        // side's message as read right away. The server broadcasts MessageRead
        // back to the sender → their bubble flips to the blue double tick.
        if (isIncoming && dto.messageStatus < MessageStatus.Read) {
          /* Connection zinda hona "dekh liya" nahi hai — dekho viewingRef. */
          if (viewingRef.current) {
            api.markRead(dto.sessionId, [dto.messageId]).catch(() => {});
            /* Local bubble bhi read — warna tab badalte hi ye dobara "unread"
               gina jata hai. */
            cb.current.onReceipt?.({
              type: 'read', sessionId: dto.sessionId, messageIds: [dto.messageId], at: new Date().toISOString(),
            });
          } else if (dto.messageStatus < MessageStatus.Delivered) {
            api.markDelivered(dto.sessionId, dto.messageId).catch(() => {});
          }
        }
      } else if (isIncoming && dto.messageStatus < MessageStatus.Delivered) {
        // Connected but viewing a different conversation → mark delivered so the
        // sender sees the double grey tick (it flips blue once we open it).
        api.markDelivered(dto.sessionId, dto.messageId).catch(() => {});
      }
    });
    conn.on(Events.MessageDelivered, (sid, messageId, at) => {
      if (sid === sessionRef.current) cb.current.onReceipt?.({ type: 'delivered', sessionId: sid, messageIds: [messageId], at });
    });
    conn.on(Events.MessageRead, (sid, messageIds, at) => {
      if (sid === sessionRef.current) cb.current.onReceipt?.({ type: 'read', sessionId: sid, messageIds, at });
    });
    conn.on(Events.TypingStarted, (sid, _userId, name) => {
      if (sid === sessionRef.current) cb.current.onTyping?.(name);
    });
    conn.on(Events.TypingStopped, (sid) => {
      if (sid === sessionRef.current) cb.current.onTyping?.(null);
    });
    conn.on(Events.SessionOpened, (sess) => setActiveSessions((p) => upsertSession(p, api.normalizeSession(sess))));
    conn.on(Events.SessionAssigned, (sess) => setActiveSessions((p) => upsertSession(p, api.normalizeSession(sess))));
    conn.on(Events.SessionClosed, (sid) => {
      setActiveSessions((p) => p.filter((s) => s.sessionId !== sid));
      if (sid === sessionRef.current) cb.current.onSessionClosed?.(sid);
    });
    conn.on(Events.PresenceChanged, (userId, isOnline) => {
      setOnline((prev) => {
        const next = new Set(prev);
        if (isOnline) next.add(userId); else next.delete(userId);
        return next;
      });
    });

    /* Socket health is tracked separately from `status`: REST is what persists
       messages, so losing the hub degrades us to polling rather than offline. */
    conn.onreconnecting(() => setRealtime(false));
    conn.onreconnected(async () => {
      setRealtime(true);
      if (sessionRef.current) { try { await joinSession(conn, sessionRef.current); } catch { /* ignore */ } }
    });
    conn.onclose(() => setRealtime(false));
  }, [toUi, outSenderType]);

  /* ── Login + connect ── */
  const start = useCallback(async () => {
    if (startedRef.current) return connRef.current;
    startedRef.current = true;
    setStatus('connecting');
    try {
      /* Support has no login of its own. The caller is already authenticated in
         the host app, and that same JWT carries the claims SupportAuthHelper
         reads — BranchID for a school user, IsAdmin for an agent/super admin.
         An explicit `credentials.token` (or configureSupport) overrides it. */
      const token = credentials?.token || getSupportToken();
      if (!token) throw new ApiError('No session token — Support stays offline', 401);

      tokenRef.current = token;
      api.setToken(token);
      setMe({ accessToken: token, ...getSupportIdentity() });

      /* REST first — it is what actually persists messages, and reaching it is
         what "live" means. The hub is an enhancement: /hubs/support is not
         mapped on every deployment, and a missing socket must not knock a
         working chat back into offline demo mode. */
      const sessions = await api.getActiveSessions();
      setActiveSessions(sessions.items || []);
      setStatus('connected');

      /* Socket only when the hub is actually deployed — otherwise we would fire
         a negotiate request that 404s on every open. Polling covers it. */
      if (SUPPORT_REALTIME_ENABLED) {
        try {
          const conn = createConnection(() => tokenRef.current);
          registerHandlers(conn);
          await conn.start();
          connRef.current = conn;
          setRealtime(true);
        } catch (hubErr) {
          connRef.current = null;
          setRealtime(false);   // fall back to polling
        }
      }

      if (role !== 'agent') {
        if (sessions.items?.length) {
          await openSession(sessions.items[0].sessionId);
        } else {
          // No open conversation yet. Still hand back an empty history so the
          // caller drops its offline demo transcript — otherwise a live user
          // would keep looking at seeded sample messages.
          cb.current.onHistory?.([]);
        }
      }
      return connRef.current;
    } catch (err) {
      startedRef.current = false;
      setStatus(err?.status === 401 ? 'error' : 'offline');
      cb.current.onError?.(err);
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, credentials, registerHandlers]);

  /* ── Load a conversation + join its realtime group ── */
  const openSession = useCallback(async (id) => {
    if (!id) return;
    const detail = await api.getSessionDetail(id);
    setSession(id);
    // Opening a conversation clears its unread badge.
    setActiveSessions((prev) => prev.map((s) => s.sessionId === id ? { ...s, unreadCount: 0 } : s));
    if (connRef.current) { try { await joinSession(connRef.current, id); } catch { /* ignore */ } }
    const rows = detail.messages || [];
    // Everything in the history is already on screen — the poller must not
    // re-announce it as newly arrived.
    seenRef.current = new Set(rows.map((m) => m.messageId));
    /* History sahi statuses laati hai — unhi ko ticks ka baseline maano, warna
       pehle sync par har purana message dobara "receipt" ban jata. */
    outStatusRef.current = new Map(
      rows.filter((m) => m.senderType === outSenderType)
        .map((m) => [m.messageId, Number(m.messageStatus) || MessageStatus.Sent]),
    );
    awaitingAckRef.current = rows.some(
      (m) => m.senderType === outSenderType && (Number(m.messageStatus) || 1) < MessageStatus.Read,
    );
    cb.current.onHistory?.(rows.map(toUi));

    // Mark the other side's unread messages as read.
    const unread = rows
      .filter((m) => m.senderType !== outSenderType && m.messageStatus < MessageStatus.Read)
      .map((m) => m.messageId);
    markReadNow(id, unread);
    return detail;
  }, [toUi, outSenderType, setSession, markReadNow]);

  /* ── Conversation wapas saamne aane par read ───────────────────────
     `start()` sirf pehli martaba chalta hai (startedRef), aur markRead usi ke
     openSession me hai — is liye Inbox tab par wapas aane par kuch bhi read
     nahi hota tha aur unread badge lagta rehta tha, halanke agent parh chuka
     hota. Ab jab bhi conversation saamne aati hai, us waqt tak ke un-read
     messages read kar diye jate hain. */
  useEffect(() => {
    if (!isViewing || status !== 'connected' || !sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const detail = await api.getSessionDetail(sessionId);
        if (cancelled) return;
        /* Apne bubbles ke ticks bhi yahin taza — conversation par wapas aate
           waqt purana (single/grey) tick para rehta tha. */
        syncOutTicks(sessionId, detail.messages);
        const unread = (detail.messages || [])
          .filter((m) => m.senderType !== outSenderType && m.messageStatus < MessageStatus.Read)
          .map((m) => m.messageId);
        markReadNow(sessionId, unread);
      } catch (e) { /* agli dafa sahi */ }
    })();
    // eslint-disable-next-line consistent-return
    return () => { cancelled = true; };
  }, [isViewing, status, sessionId, outSenderType, markReadNow, syncOutTicks]);

  /* ── Polling fallback ──────────────────────────────────────────────
     Only runs while REST is up but the hub is not (e.g. /hubs/support is not
     mapped on this deployment). Without it a reply would never appear until
     the user reopened the chat. Stops the moment SignalR connects. */
  useEffect(() => {
    if (status !== 'connected' || realtime || !sessionId) return undefined;
    let cancelled = false;
    let ticks = 0;
    let lastStamp = null;   // aakhri maloom lastMessageAt
    let timer = null;
    /* Band ho chuki session par poll ka koi kaam nahi — rok do. */
    const stopPolling = () => { cancelled = true; if (timer) clearInterval(timer); };

    const tick = async () => {
      try {
        ticks += 1;
        /* Sasta check: sessions list chhoti rows deti hai. Jab tak
           lastMessageAt na badle, poora transcript maangne ka faida nahi. */
        /* Apna koi message abhi Read na hua ho to sasta check kaafi nahi:
           status badalne se lastMessageAt nahi badalta. */
        if (ticks % FULL_SYNC_EVERY !== 0 && !awaitingAckRef.current) {
          const { items } = await api.getActiveSessions(1, 25);
          if (cancelled) return;
          const row = (items || []).find((s) => s.sessionId === sessionId);
          const stamp = row?.lastMessageAt || null;
          /* List se ghayab (band ho gayi?) ho to poora dekhna hi parega. */
          if (row && stamp && stamp === lastStamp) return;
          lastStamp = stamp;
        }
        const detail = await api.getSessionDetail(sessionId);
        if (cancelled) return;
        lastStamp = detail.lastMessageAt || lastStamp;
        /* Apne bubbles ke ticks — "fresh" messages se pehle. */
        syncOutTicks(sessionId, detail.messages);
        const fresh = (detail.messages || []).filter((m) => !seenRef.current.has(m.messageId));
        // Without the hub there is no SessionClosed event, so notice it here.
        if (detail.sessionStatus === SessionStatus.Closed) {
          fresh.forEach((m) => { seenRef.current.add(m.messageId); cb.current.onInbound?.(toUi(m)); });
          /* Band hone ka elaan SIRF EK BAAR — warna har tick par dobara chalta
             hai (session to band hi rehti hai) aur poll bhi be-wajah jari. */
          if (closedAnnouncedRef.current !== sessionId) {
            closedAnnouncedRef.current = sessionId;
            /* Wahi safai jo SessionClosed event karta hai — band shuda row
               inbox me khuli conversation ban kar nahi baithi rehni chahiye. */
            setActiveSessions((prev) => prev.filter((x) => x.sessionId !== sessionId));
            cb.current.onSessionClosed?.(sessionId);
          }
          stopPolling();
          return;
        }
        if (!fresh.length) return;
        const incoming = [];
        for (const m of fresh) {
          seenRef.current.add(m.messageId);
          cb.current.onInbound?.(toUi(m));
          if (m.senderType !== outSenderType && m.messageStatus < MessageStatus.Read) incoming.push(m.messageId);
        }
        if (!incoming.length) return;
        /* "Read" tab hi jab conversation waqai screen par ho — ye poll tab bhi
           chalta rehta hai jab console kisi aur tab par ho, aur pehle yehi har
           naye message ko chup-chaap read kar deta tha. Na dekha ho to sirf
           "delivered": bhejne wale ko double tick mile, blue nahi. */
        if (viewingRef.current) {
          markReadNow(sessionId, incoming);
        } else {
          incoming.forEach((id) => api.markDelivered(sessionId, id).catch(() => {}));
        }
      } catch (e) { /* transient — retry on the next tick */ }
    };
    timer = setInterval(tick, POLL_INTERVAL_MS);
    return stopPolling;
  }, [status, realtime, sessionId, toUi, outSenderType, markReadNow, syncOutTicks]);

  /* ── Inbox polling (agent side only) ───────────────────────────────
     The block above watches the conversation that is already open. Without the
     hub there is also no SessionOpened / SessionAssigned event, so a school
     starting a NEW chat would never appear in the agent's inbox until the page
     was reloaded — an agent would simply never learn a customer is waiting.
     Re-read the list on a slower tick, keeping the open conversation's badge
     cleared (we are looking at it; markRead is already on its way).

     This effect exists only in the super-admin copy of the hook: the school
     widget has a single conversation and no inbox to refresh. */
  useEffect(() => {
    if (role !== 'agent' || status !== 'connected' || realtime) return undefined;
    let cancelled = false;
    const tick = async () => {
      try {
        const { items } = await api.getActiveSessions();
        if (cancelled || !items) return;
        setActiveSessions(items.map((s) => (
          s.sessionId === sessionRef.current ? { ...s, unreadCount: 0 } : s
        )));
      } catch (e) { /* transient — retry on the next tick */ }
    };
    const timer = setInterval(tick, INBOX_POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [role, status, realtime]);

  /* ── Send a text message ── */
  const sendText = useCallback(async (body) => {
    const text = (body || '').trim();
    if (!text) return null;
    const result = await api.sendMessage(sessionRef.current, text);
    const newId = result.sessionId || result.message?.sessionId;
    if (result.sessionCreated && newId) {
      // First school message created a session — adopt + join it now.
      setSession(newId);
      if (connRef.current) { try { await joinSession(connRef.current, newId); } catch { /* ignore */ } }
    }
    // Echo immediately; SignalR may also deliver it → caller dedupes by id.
    if (result.message?.messageId != null) {
      seenRef.current.add(result.message.messageId);
      /* Abhi bheja hai → hamesha "Sent". Send ke response ke status par
         bharosa nahi: kabhi wo pehle se Read (3) de deta hai, jis se apna
         message bhejte hi blue ho jata tha halanke doosri taraf ne dekha bhi
         nahi hota. Asli status GET se aata hai (syncOutTicks), jo sirf AAGE
         barhata hai — is liye baseline yahin Sent rakhna zaroori hai. */
      outStatusRef.current.set(result.message.messageId, MessageStatus.Sent);
      awaitingAckRef.current = true;
    }
    /* Bubble bhi "Sent" par — response ka status galat ho to bhi tick
       galat na ho; asli haal poll/GET se aayega. */
    cb.current.onInbound?.({ ...toUi(result.message), status: MessageStatus.Sent });
    return result;
  }, [toUi, setSession]);

  /* ── Send a voice / image / video / document attachment ── */
  /* `batchId` — ek hi "send" ke saare files ka mushtarak nishan. Ek send me
     har file apna alag message banti hai; render par unhe ek album me jorna
     hota hai, magar SIRF usi send ke files ko. Waqt se andaza lagana kaafi
     nahi tha (do alag sends thori der ke faasle par ek hi bubble ban jate
     thay), is liye bhejne wala khud nishan laga deta hai. Sirf screen ke
     liye hai — API/DB par kuch nahi jata. */
  const sendAttachment = useCallback(async ({ category, file, fileName, voiceDuration, caption, batchId }) => {
    const result = await api.sendAttachment({
      sessionId: sessionRef.current, category, file, fileName, voiceDuration, caption,
    });
    const newId = result.sessionId || result.message?.sessionId;
    if (result.sessionCreated && newId) {
      setSession(newId);
      if (connRef.current) { try { await joinSession(connRef.current, newId); } catch { /* ignore */ } }
    }
    if (result.message?.messageId != null) {
      seenRef.current.add(result.message.messageId);
      /* Abhi bheja hai → hamesha "Sent". Send ke response ke status par
         bharosa nahi: kabhi wo pehle se Read (3) de deta hai, jis se apna
         message bhejte hi blue ho jata tha halanke doosri taraf ne dekha bhi
         nahi hota. Asli status GET se aata hai (syncOutTicks), jo sirf AAGE
         barhata hai — is liye baseline yahin Sent rakhna zaroori hai. */
      outStatusRef.current.set(result.message.messageId, MessageStatus.Sent);
      awaitingAckRef.current = true;
    }
    /* Bubble bhi "Sent" par — response ka status galat ho to bhi tick
       galat na ho; asli haal poll/GET se aayega. */
    cb.current.onInbound?.({ ...toUi(result.message), status: MessageStatus.Sent, _batch: batchId || undefined });
    return result;
  }, [toUi, setSession]);

  /* ── Typing indicator (auto-stops after idle) ── */
  const setTyping = useCallback((isTyping) => {
    const conn = connRef.current;
    const id = sessionRef.current;
    if (!conn || !id) return;
    if (isTyping) {
      if (!typingActiveRef.current) { typingActiveRef.current = true; sendTyping(conn, id, true).catch(() => {}); }
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        typingActiveRef.current = false;
        sendTyping(conn, id, false).catch(() => {});
      }, 1500);
    } else {
      clearTimeout(typingTimerRef.current);
      typingActiveRef.current = false;
      sendTyping(conn, id, false).catch(() => {});
    }
  }, []);

  /* The API records who closed the session. Both sides send the logged-in
     user's id (sessionStorage UserID) as closedByAgentID. */
  const closeSession = useCallback(async (remarks) => {
    const id = sessionRef.current;
    if (!id) return null;
    const res = await api.closeSession(id, remarks || null, getSupportUserId());
    /* Inbox se foran nikal do. Hub band ho (yani polling wali soorat) to
       SessionClosed event aata hi nahi, aur agle inbox tick tak ye row khuli
       conversation ki tarah padi rehti thi — auto-open wala effect usay
       dobara khol deta tha aur band shuda chat screen par wapas aa jati. */
    setActiveSessions((prev) => prev.filter((x) => x.sessionId !== id));
    return res;
  }, []);

  /* Detach from the (closed) session so the next message starts a fresh one.
     The closed session remains in the DB/history untouched. */
  const newConversation = useCallback(() => {
    const conn = connRef.current;
    if (conn && sessionRef.current) leaveSession(conn, sessionRef.current).catch(() => {});
    seenRef.current = new Set();
    /* Nayi guftagu — ticks aur "band ho gayi" wala guard dono naye sire se. */
    outStatusRef.current = new Map();
    awaitingAckRef.current = false;
    closedAnnouncedRef.current = null;
    setSession(null);
  }, [setSession]);

  const refreshInbox = useCallback(async () => {
    const sessions = await api.getActiveSessions().catch(() => ({ items: [] }));
    setActiveSessions(sessions.items || []);
    return sessions.items || [];
  }, []);

  /* Cleanup on unmount. */
  useEffect(() => () => {
    clearTimeout(typingTimerRef.current);
    const conn = connRef.current;
    if (conn) {
      if (sessionRef.current) leaveSession(conn, sessionRef.current).catch(() => {});
      conn.stop().catch(() => {});
    }
  }, []);

  return {
    status, realtime, me, sessionId, activeSessions, online,
    start, openSession, sendText, sendAttachment, setTyping, closeSession, newConversation, refreshInbox, toUi,
    /* "connected" = the REST API is reachable, i.e. messages really persist.
       `realtime` says whether the SignalR hub is also up. */
    connected: status === 'connected',
  };
}

/* Screen par nazar hai? Tab chhupi ho ya window focus me na ho to aane wale
   message ko "read" nahi kehna chahiye — sirf delivered. */
function isPageActive() {
  if (typeof document === 'undefined') return true;
  if (document.visibilityState === 'hidden') return false;
  return typeof document.hasFocus === 'function' ? document.hasFocus() : true;
}

/* ── attachment display helpers ── */
function humanSize(bytes) {
  if (bytes == null) return '';
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
function fmtDuration(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function extOf(name) {
  return (name && name.includes('.')) ? name.split('.').pop().toLowerCase() : '';
}

/* ── helpers for inbox list maintenance ── */
function upsertSession(list, sess) {
  if (!sess?.sessionId) return list;
  const without = list.filter((s) => s.sessionId !== sess.sessionId);
  return [sess, ...without];
}
function bumpSession(list, sessionId, lastMessageAt, incUnread = false) {
  const idx = list.findIndex((s) => s.sessionId === sessionId);
  if (idx === -1) return list;
  const cur = list[idx];
  const updated = {
    ...cur,
    lastMessageAt,
    unreadCount: (cur.unreadCount || 0) + (incUnread ? 1 : 0),
  };
  return [updated, ...list.slice(0, idx), ...list.slice(idx + 1)];
}
