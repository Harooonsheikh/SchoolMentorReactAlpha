import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import mentorAILogo from '../../assets/images/mentorAILogo.png';
import { askMentorAI } from '../../services/mentorAiService';
import { MENTOR_AI_SUGGESTIONS } from '../../mock/mentorAi';
import { LoadingState, ErrorPanel } from './MentorAIResponseParts';
import MentorAIResponse from './MentorAIResponse';

/* ═══════════════════════════════════════════════════════════════════
   MentorAIPanel — the Mentor AI ERP Intelligence Assistant interface.

   A centered modal (portal-rendered, mirrors the app's own
   .modal-overlay/.modal pattern from App.js) with a left history rail
   — past conversations are persisted to localStorage under
   MAI_HISTORY_KEY (this app has no backend yet; every other module
   here is mock-data-driven too, see src/services/_http.js) so they
   survive closing the panel and reloading the page. Swapping to a
   real backend later means replacing loadHistory/persistHistory with
   API calls and keeping the same shape.
   ═══════════════════════════════════════════════════════════════════ */

const MAI_HISTORY_KEY = 'mai_chat_history';
const MAI_HISTORY_LIMIT = 40;

function loadHistory() {
  try {
    const raw = localStorage.getItem(MAI_HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
function persistHistory(list) {
  try { localStorage.setItem(MAI_HISTORY_KEY, JSON.stringify(list.slice(0, MAI_HISTORY_LIMIT))); } catch { /* storage unavailable — history just won't persist */ }
}
function titleFrom(query) {
  const t = (query || '').trim();
  return t.length > 52 ? `${t.slice(0, 52)}…` : (t || 'New chat');
}
function timeAgo(ts) {
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' });
}

export default function MentorAIPanel({ open, onClose, ctx = {}, schoolName }) {
  const [query, setQuery] = useState('');
  const [exchanges, setExchanges] = useState([]);
  const [history, setHistory] = useState(loadHistory);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const idRef = useRef(0);
  const inputRef = useRef(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [exchanges]);

  /* Persist the active conversation into chat history as it grows —
     skip mid-flight "loading" exchanges (they wouldn't resume on
     reload anyway) and skip empty sessions entirely. */
  useEffect(() => {
    const settled = exchanges.filter(ex => ex.status !== 'loading');
    if (!settled.length) return;
    const id = activeSessionId ?? idRef.current;
    setHistory(prev => {
      const next = [
        { id, title: titleFrom(settled[0].query), updatedAt: Date.now(), exchanges: settled },
        ...prev.filter(h => h.id !== id),
      ];
      persistHistory(next);
      return next;
    });
    if (activeSessionId == null) setActiveSessionId(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exchanges]);

  const sortedHistory = useMemo(() => [...history].sort((a, b) => b.updatedAt - a.updatedAt), [history]);

  if (!open) return null;

  const runQuery = async (q, exchangeId) => {
    try {
      const response = await askMentorAI(q, ctx);
      setExchanges(prev => prev.map(ex => (ex.id === exchangeId ? { ...ex, status: 'done', response } : ex)));
    } catch {
      setExchanges(prev => prev.map(ex => (ex.id === exchangeId ? { ...ex, status: 'error' } : ex)));
    }
  };

  const submit = (raw) => {
    const q = (raw ?? query).trim();
    if (!q) return;
    const id = ++idRef.current;
    setExchanges(prev => [...prev, { id, query: q, status: 'loading', response: null }]);
    setQuery('');
    runQuery(q, id);
  };

  const retry = (exchangeId, q) => {
    setExchanges(prev => prev.map(ex => (ex.id === exchangeId ? { ...ex, status: 'loading' } : ex)));
    runQuery(q, exchangeId);
  };

  const focusInput = () => inputRef.current?.focus();

  const startNewChat = () => {
    setExchanges([]);
    setActiveSessionId(null);
    setQuery('');
    focusInput();
  };

  const loadSession = (item) => {
    setExchanges(item.exchanges);
    setActiveSessionId(item.id);
    setQuery('');
  };

  const deleteSession = (id) => {
    setHistory(prev => {
      const next = prev.filter(h => h.id !== id);
      persistHistory(next);
      return next;
    });
    if (id === activeSessionId) startNewChat();
  };

  return createPortal(
    <div className="mai-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <aside className="mai-drawer" role="dialog" aria-modal="true" aria-label="Mentor AI — ERP Intelligence Assistant">
        <header className="mai-head">
          <span className="mai-logo-chip mai-logo-chip--sm">
            <img src={mentorAILogo} className="mai-head-logo" alt="Mentor AI" />
          </span>
          <div className="mai-head-txt">
            <div className="mai-head-name">Mentor AI</div>
            <div className="mai-head-sub">ERP Intelligence Assistant</div>
          </div>
          <button
            type="button"
            className={`mai-head-history${historyOpen ? ' active' : ''}`}
            onClick={() => setHistoryOpen(o => !o)}
            aria-label="Chat history"
            aria-pressed={historyOpen}
          >
            <i className="fa-solid fa-clock-rotate-left" aria-hidden="true" />
          </button>
          <button type="button" className="mai-head-newchat" onClick={startNewChat} aria-label="Start a new chat">
            <i className="fa-solid fa-pen-to-square" aria-hidden="true" />
          </button>
          <button type="button" className="mai-head-close" onClick={onClose} aria-label="Close Mentor AI">
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </header>

        <div className="mai-shell">
          {historyOpen && (
            <nav className="mai-history" aria-label="Chat history">
              <div className="mai-history-head">
                <span>Chat History</span>
                <button type="button" className="mai-history-new" onClick={startNewChat}>
                  <i className="fa-solid fa-plus" aria-hidden="true" /> New
                </button>
              </div>
              <div className="mai-history-list">
                {sortedHistory.length === 0 ? (
                  <div className="mai-history-empty">
                    <i className="fa-regular fa-comments" aria-hidden="true" />
                    <span>Your past conversations will show up here.</span>
                  </div>
                ) : sortedHistory.map(h => (
                  <div
                    key={h.id}
                    className={`mai-history-item${h.id === activeSessionId ? ' active' : ''}`}
                    onClick={() => loadSession(h)}
                  >
                    <div className="mai-history-item-txt">
                      <div className="mai-history-item-t">{h.title}</div>
                      <div className="mai-history-item-d">{timeAgo(h.updatedAt)} · {h.exchanges.length} exchange{h.exchanges.length === 1 ? '' : 's'}</div>
                    </div>
                    <Tooltip text="Delete conversation">
                      <button
                        type="button"
                        className="mai-history-del"
                        onClick={e => { e.stopPropagation(); deleteSession(h.id); }}
                        aria-label="Delete this conversation"
                      >
                        <i className="fa-solid fa-trash" aria-hidden="true" />
                      </button>
                    </Tooltip>
                  </div>
                ))}
              </div>
            </nav>
          )}

          <div className="mai-main">
            <div className="mai-body mai-print-area" ref={bodyRef}>
              {exchanges.length === 0 && (
                <div className="mai-empty">
                  <span className="mai-logo-chip mai-logo-chip--lg">
                    <img src={mentorAILogo} className="mai-empty-logo" alt="" aria-hidden="true" />
                  </span>
                  <div className="mai-empty-t">Ask Mentor AI about your school.</div>
                  <div className="mai-empty-s">
                    Ask anything about students, academics, fees, accounts, HR or school performance.
                  </div>
                  <div className="mai-suggestions">
                    {MENTOR_AI_SUGGESTIONS.map(s => (
                      <button key={s} type="button" className="mai-suggestion-chip" onClick={() => submit(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {exchanges.map(ex => (
                <div className="mai-exchange" key={ex.id}>
                  <div className="mai-query-pill">
                    <i className="fa-solid fa-circle-user" aria-hidden="true" /> {ex.query}
                  </div>
                  {ex.status === 'loading' && <LoadingState />}
                  {ex.status === 'error' && <ErrorPanel onRetry={() => retry(ex.id, ex.query)} />}
                  {ex.status === 'done' && (
                    <MentorAIResponse response={ex.response} schoolName={schoolName} onFollowUp={focusInput} />
                  )}
                </div>
              ))}
            </div>

            <form
              className="mai-composer"
              onSubmit={e => { e.preventDefault(); submit(); }}
            >
              <input
                ref={inputRef}
                type="text"
                className="mai-composer-input"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Ask about students, academics, fees, accounts, HR or school performance…"
                aria-label="Ask Mentor AI"
              />
              <button type="submit" className="mai-composer-send" disabled={!query.trim()} aria-label="Send question to Mentor AI">
                <i className="fa-solid fa-paper-plane" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  );
}

/* Local, dependency-free tooltip — avoids importing the shared
   Tooltip component just for one delete-button hint. */
function Tooltip({ text, children }) {
  return <span title={text} style={{ display: 'inline-flex' }}>{children}</span>;
}
