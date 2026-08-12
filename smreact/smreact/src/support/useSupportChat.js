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

/* Hub band hone par khuli conversation kitni jaldi dobara dekhi jaye.
   2 second — jawab aate hi bubble/badge aa jata hai. Har tick par poora
   transcript kheenchna is raftaar par faltu hoga, is liye pehle sasta check
   (sessions list ka `lastMessageAt`) hota hai aur poora detail sirf tab jab
   waqai kuch naya ho — dekho tick() neeche. */
const POLL_INTERVAL_MS = 2000;
/* Ticks/receipts (delivered → read) lastMessageAt nahi badalte, is liye har
   itne tick baad ek poora sync waise bhi kar lete hain. */
const FULL_SYNC_EVERY = 5;

/* Waqt seedha `new Date(iso)` se nahi banta: API 12-ghante ki clock me likhti
   hai aur AM/PM gira deti hai (dekho support/time.js). */
export function formatTime(iso) {
  return formatServerTime(iso);
}

export function useSupportChat({
  role = 'school',
  credentials = null,
  /* Conversation is abhi user ke saamne khuli hai? Sirf tab hi aane wale
     message "read" hote hain. Widget/console band ya kisi doosre tab par ho to
     `false` bhejo — warna connection zinda hone ki wajah se messages bina dekhe
     read ho jate hain aur unread badge khud hi saaf ho jata hai. */
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

  /* Handlers dobara subscribe kiye baghair taza halat — poll aur SignalR dono
     isi ref se dekhte hain ke user saamne hai ya nahi. */
  const viewingRef = useRef(viewing);
  viewingRef.current = viewing;

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

  /* Apni taraf se "read" karte waqt local bubbles bhi read kar do.
     Server ko markRead bhej dena kaafi nahi tha: caller ke paas maujood
     messages ka status purana (Sent/Delivered) hi para rehta tha, is liye
     unread ginti message dekh lene ke baad bhi 1 dikhati rehti thi. onReceipt
     wahi raasta hai jisse caller apni list ke status badalta hai. */
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
      if (isIncoming) playIncomingChime();
      if (dto.sessionId === sessionRef.current) {
        seenRef.current.add(dto.messageId);
        cb.current.onInbound?.(toUi(dto));
        // Read only when the conversation is actually on screen (viewingRef).
        // The server broadcasts MessageRead back to the sender → their bubble
        // flips to the blue double tick. Connection alone is not "seen": the
        // chat can stay connected while closed / on another tab.
        if (isIncoming && dto.messageStatus < MessageStatus.Read) {
          if (viewingRef.current) {
            api.markRead(dto.sessionId, [dto.messageId]).catch(() => {});
            /* Local bubble bhi read — warna widget band karte hi ye message
               dobara "unread" gina jata hai. */
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
    cb.current.onHistory?.(rows.map(toUi));

    // Mark the other side's unread messages as read (screen par aa chuke hain).
    const unread = rows
      .filter((m) => m.senderType !== outSenderType && m.messageStatus < MessageStatus.Read)
      .map((m) => m.messageId);
    markReadNow(id, unread);
    return detail;
  }, [toUi, outSenderType, setSession, markReadNow]);

  /* ── Chat wapas saamne aane par read ───────────────────────────────
     `start()` sirf pehli martaba chalta hai (startedRef), aur markRead usi ke
     openSession me hai — is liye dobara kholne par kuch bhi read nahi hota
     tha aur badge wapas aa jata tha, halanke user message parh chuka hota.
     Ab jab bhi conversation saamne aati hai (widget khula / Inbox tab par
     wapas), us waqt tak ke un-read messages read kar diye jate hain. */
  useEffect(() => {
    if (!viewing || status !== 'connected' || !sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const detail = await api.getSessionDetail(sessionId);
        if (cancelled) return;
        const unread = (detail.messages || [])
          .filter((m) => m.senderType !== outSenderType && m.messageStatus < MessageStatus.Read)
          .map((m) => m.messageId);
        markReadNow(sessionId, unread);
      } catch (e) { /* agli dafa sahi */ }
    })();
    // eslint-disable-next-line consistent-return
    return () => { cancelled = true; };
  }, [viewing, status, sessionId, outSenderType, markReadNow]);

  /* ── Polling fallback ──────────────────────────────────────────────
     Only runs while REST is up but the hub is not (e.g. /hubs/support is not
     mapped on this deployment). Without it a reply would never appear until
     the user reopened the chat. Stops the moment SignalR connects. */
  useEffect(() => {
    if (status !== 'connected' || realtime || !sessionId) return undefined;
    let cancelled = false;
    let ticks = 0;
    let lastStamp = null;   // aakhri maloom lastMessageAt

    const tick = async () => {
      try {
        ticks += 1;
        /* Sasta check: sessions list ek chhoti si row deti hai. Jab tak
           lastMessageAt na badle, poora transcript maangne ka koi faida nahi. */
        if (ticks % FULL_SYNC_EVERY !== 0) {
          const { items } = await api.getActiveSessions(1, 25);
          if (cancelled) return;
          const row = (items || []).find((s) => s.sessionId === sessionId);
          const stamp = row?.lastMessageAt || null;
          /* Session list se ghayab (band ho gayi?) ho to poora dekhna hi parega. */
          if (row && stamp && stamp === lastStamp) return;
          lastStamp = stamp;
        }
        const detail = await api.getSessionDetail(sessionId);
        if (cancelled) return;
        lastStamp = detail.lastMessageAt || lastStamp;
        const fresh = (detail.messages || []).filter((m) => !seenRef.current.has(m.messageId));
        // Without the hub there is no SessionClosed event, so notice it here.
        if (detail.sessionStatus === SessionStatus.Closed) {
          fresh.forEach((m) => { seenRef.current.add(m.messageId); cb.current.onInbound?.(toUi(m)); });
          cb.current.onSessionClosed?.(sessionId);
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
        /* "Read" tab hi bhejo jab conversation waqai screen par ho. Ye poll
           chat band hone ke baad bhi chalta rehta hai (connection zinda rehta
           hai), aur pehle yehi har naye message ko chup-chaap read kar deta
           tha — is liye unread badge thori der me khud gayab ho jata tha
           halanke user ne message dekha tak nahi hota tha. Na dekha ho to
           sirf "delivered" — bhejne wale ko double tick mil jaye, blue nahi. */
        if (viewingRef.current) {
          markReadNow(sessionId, incoming);
        } else {
          incoming.forEach((id) => api.markDelivered(sessionId, id).catch(() => {}));
        }
      } catch (e) { /* transient — retry on the next tick */ }
    };
    const timer = setInterval(tick, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [status, realtime, sessionId, toUi, outSenderType, markReadNow]);

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
    if (result.message?.messageId != null) seenRef.current.add(result.message.messageId);
    cb.current.onInbound?.(toUi(result.message));
    return result;
  }, [toUi, setSession]);

  /* ── Send a voice / image / video / document attachment ── */
  const sendAttachment = useCallback(async ({ category, file, fileName, voiceDuration, caption }) => {
    const result = await api.sendAttachment({
      sessionId: sessionRef.current, category, file, fileName, voiceDuration, caption,
    });
    const newId = result.sessionId || result.message?.sessionId;
    if (result.sessionCreated && newId) {
      setSession(newId);
      if (connRef.current) { try { await joinSession(connRef.current, newId); } catch { /* ignore */ } }
    }
    if (result.message?.messageId != null) seenRef.current.add(result.message.messageId);
    cb.current.onInbound?.(toUi(result.message));
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
    if (!sessionRef.current) return null;
    return api.closeSession(sessionRef.current, remarks || null, getSupportUserId());
  }, []);

  /* Detach from the (closed) session so the next message starts a fresh one.
     The closed session remains in the DB/history untouched. */
  const newConversation = useCallback(() => {
    const conn = connRef.current;
    if (conn && sessionRef.current) leaveSession(conn, sessionRef.current).catch(() => {});
    seenRef.current = new Set();
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
