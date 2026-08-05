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
  DEMO_AGENT_LOGIN, DEMO_SCHOOL_LOGIN, SenderType, MessageStatus, MessageType, fileUrl,
  getSupportToken,
} from './config';
import * as api from './api';
import { createConnection, Events, joinSession, leaveSession, sendTyping } from './realtime';
import { playIncomingChime } from './sound';

export function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function useSupportChat({
  role = 'school',
  credentials = null,
  onInbound,          // (uiMsg)  — append (idempotent by id on the caller side)
  onHistory,          // (uiMsg[]) — replace list with a loaded session
  onTyping,           // (name|null)
  onReceipt,          // ({ type:'delivered'|'read', sessionId, messageIds, at })
  onSessionClosed,    // (sessionId)
  onError,            // (err)
} = {}) {
  const [status, setStatus] = useState('idle'); // idle|connecting|connected|reconnecting|offline|error
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

  // Keep callbacks fresh without re-subscribing handlers.
  const cb = useRef({});
  cb.current = { onInbound, onHistory, onTyping, onReceipt, onSessionClosed, onError };

  const outSenderType = role === 'agent' ? SenderType.Agent : SenderType.School;

  const toUi = useCallback((dto) => {
    const isOut = dto.senderType === outSenderType;
    const caption = dto.messageBody ? dto.messageBody : null;
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

  /* ── Wire SignalR event handlers (once per connection) ── */
  const registerHandlers = useCallback((conn) => {
    conn.on(Events.MessageReceived, (dto) => {
      const isIncoming = dto.senderType !== outSenderType;
      // Keep inbox ordering fresh; bump unread when it's a school message in a
      // conversation we're not currently viewing.
      const incUnread = dto.sessionId !== sessionRef.current && dto.senderType === SenderType.School;
      setActiveSessions((prev) => bumpSession(prev, dto.sessionId, dto.createdAt, incUnread));
      // Notification sound for incoming messages only (never our own).
      if (isIncoming) playIncomingChime();
      if (dto.sessionId === sessionRef.current) {
        cb.current.onInbound?.(toUi(dto));
        // We're actively viewing this conversation, so acknowledge the other
        // side's message as read right away. The server broadcasts MessageRead
        // back to the sender → their bubble flips to the blue double tick.
        if (isIncoming && dto.messageStatus < MessageStatus.Read) {
          api.markRead(dto.sessionId, [dto.messageId]).catch(() => {});
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
    conn.on(Events.SessionOpened, (sess) => setActiveSessions((p) => upsertSession(p, sess)));
    conn.on(Events.SessionAssigned, (sess) => setActiveSessions((p) => upsertSession(p, sess)));
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

    conn.onreconnecting(() => setStatus('reconnecting'));
    conn.onreconnected(async () => {
      setStatus('connected');
      if (sessionRef.current) { try { await joinSession(conn, sessionRef.current); } catch { /* ignore */ } }
    });
    conn.onclose(() => setStatus('offline'));
  }, [toUi, outSenderType]);

  /* ── Login + connect ── */
  const start = useCallback(async () => {
    if (startedRef.current) return connRef.current;
    startedRef.current = true;
    setStatus('connecting');
    try {
      /* Token bridge: when the host app (ERP / Super Admin) injects a JWT via
         init(), use it directly — the user is already authenticated there, so
         we never show a second login. Only the standalone CRA dev app falls
         back to the seeded demo credentials. */
      let auth;
      const bridgeToken = getSupportToken();
      if (bridgeToken) {
        auth = { accessToken: bridgeToken };
      } else {
        const creds = credentials || (role === 'agent' ? DEMO_AGENT_LOGIN : DEMO_SCHOOL_LOGIN);
        auth = role === 'agent'
          ? await api.agentLogin(creds.usernameOrEmail, creds.password)
          : await api.schoolLogin(creds.usernameOrEmail, creds.password);
      }

      tokenRef.current = auth.accessToken;
      api.setToken(auth.accessToken);
      setMe(auth);

      const conn = createConnection(() => tokenRef.current);
      registerHandlers(conn);
      connRef.current = conn;
      await conn.start();
      setStatus('connected');

      // Prime the UI with existing data.
      const sessions = await api.getActiveSessions().catch(() => ({ items: [] }));
      setActiveSessions(sessions.items || []);
      if (role !== 'agent' && sessions.items?.length) {
        await openSession(sessions.items[0].sessionId);
      }
      return conn;
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
    const uiMsgs = (detail.messages || []).map(toUi);
    cb.current.onHistory?.(uiMsgs);

    // Mark the other side's unread messages as read.
    const unread = (detail.messages || [])
      .filter((m) => m.senderType !== outSenderType && m.messageStatus < MessageStatus.Read)
      .map((m) => m.messageId);
    if (unread.length) api.markRead(id, unread).catch(() => {});
    return detail;
  }, [toUi, outSenderType, setSession]);

  /* ── Send a text message ── */
  const sendText = useCallback(async (body) => {
    const text = (body || '').trim();
    if (!text) return null;
    const result = await api.sendMessage(sessionRef.current, text);
    if (result.sessionCreated && result.message?.sessionId) {
      // First school message created a session — adopt + join it now.
      setSession(result.message.sessionId);
      if (connRef.current) { try { await joinSession(connRef.current, result.message.sessionId); } catch { /* ignore */ } }
    }
    // Echo immediately; SignalR may also deliver it → caller dedupes by id.
    cb.current.onInbound?.(toUi(result.message));
    return result;
  }, [toUi, setSession]);

  /* ── Send a voice / image / video / document attachment ── */
  const sendAttachment = useCallback(async ({ category, file, fileName, voiceDuration, caption }) => {
    const result = await api.sendAttachment({
      sessionId: sessionRef.current, category, file, fileName, voiceDuration, caption,
    });
    if (result.sessionCreated && result.message?.sessionId) {
      setSession(result.message.sessionId);
      if (connRef.current) { try { await joinSession(connRef.current, result.message.sessionId); } catch { /* ignore */ } }
    }
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

  const closeSession = useCallback(async (remarks) => {
    if (!sessionRef.current) return null;
    return api.closeSession(sessionRef.current, remarks || null);
  }, []);

  /* Detach from the (closed) session so the next message starts a fresh one.
     The closed session remains in the DB/history untouched. */
  const newConversation = useCallback(() => {
    const conn = connRef.current;
    if (conn && sessionRef.current) leaveSession(conn, sessionRef.current).catch(() => {});
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
    status, me, sessionId, activeSessions, online,
    start, openSession, sendText, sendAttachment, setTyping, closeSession, newConversation, refreshInbox, toUi,
    connected: status === 'connected' || status === 'reconnecting',
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
