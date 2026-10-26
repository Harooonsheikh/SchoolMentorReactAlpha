import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import mentorAILogo from '../../assets/images/mentorAILogo.png';
import { stepsForQuery } from './_forked/services/mentorAiService';
import { askMentorAgent, fetchMentorAiHistory, getMentorAiSessionId } from './_forked/services/mentorAiAgentService';
import { MENTOR_AI_CATEGORIES } from './_forked/mock/mentorAi';
import { AgentProgress, ErrorPanel } from './MentorAIResponseParts';
import MentorAIResponse from './MentorAIResponse';
import MentorAIAgentResponse from './MentorAIAgentResponse';

/* ─── Voice command ───
   Uses the browser's native Web Speech API (SpeechRecognition) for real
   speech-to-text when available (Chrome/Edge/Safari) — genuinely listens
   and transcribes, live, straight into the composer input, no backend
   involved. Falls back to a simulated recording (cycling through a small
   pool of realistic transcripts) on browsers without support, or if the
   user denies the microphone — so the feature never breaks the demo. */
const SpeechRecognitionAPI = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

const MOCK_VOICE_TRANSCRIPTS = [
  'Show me students who paid fee on 13 September amount 7000',
  'Show attendance issues',
  'Which teachers need attention?',
  'Find weakest students in school',
  'Generate monthly school report',
];

const VOICE_TRANSCRIBE_MS = 700;

/* ─── Premium popup content — presentational only, no effect on the
   real chat flow/categories/data. Re-picked once per popup open, not on every render. ─── */
const MAI_INTRO_MESSAGES = [
  "Your school's data is ready. Ask me anything.",
  'I can analyze your school operations instantly.',
  'Need insights? Let me explore your ERP data.',
  'Ask me about fees, students, academics, attendance, or reports.',
  'Your ERP data is now intelligent. What would you like to know?',
  'I can convert your school data into meaningful decisions.',
  'Need a report? Ask me and I\'ll prepare it instantly.',
  "What's happening in your school today? Let me analyze it.",
];

const MAI_TRENDING_QUESTIONS = [
  'Show students with low attendance this month',
  'Which teachers have pending lesson plans?',
  'Generate fee collection report',
  'Find weak performing subjects',
  'Show outstanding fees by class',
  'Generate school performance report',
  'How many lesson plans are pending?',
];
/* Trending is the SOLE suggested-question surface in the empty state —
   every question from MENTOR_AI_CATEGORIES is folded into this one
   rotating pool. */
const MAI_TRENDING_POOL = Array.from(new Set([
  ...MAI_TRENDING_QUESTIONS,
  ...MENTOR_AI_CATEGORIES.flatMap(c => c.questions),
]));
const MAI_TRENDING_ROTATE_MS = 3200;

/* Rotating sub-labels shown while the mock voice pipeline is
   "understanding" what was said. */
const MAI_VOICE_UNDERSTAND_LABELS = ['Understanding…', 'Finding answer…'];

/* Minimum time the AgentProgress animation is shown for, regardless of
   how fast the API actually resolves — so the 4-step sequence
   always plays out once and never gets cut short. */
const MIN_AGENT_ANIMATION_MS = 2300;
const minDelay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function dayBucket(ts) {
  const d = new Date(ts);
  const now = new Date();
  const startOf = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return 'Earlier';
}

function timeAgo(ts) {
  if (!ts) return '';
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

/* ═══════════════════════════════════════════════════════════════════
   MentorAIPanel — the Mentor AI ERP Intelligence Assistant interface.

   Queries go to the agentic AI API (mentorAiAgentService). One AI
   session_id is used for the whole login (cleared on login/logout), so
   the user can ask as many questions as they like in the same session.
   Chat history comes from the server (logs API), grouped by session_id.
   ═══════════════════════════════════════════════════════════════════ */

export default function MentorAIPanel({ open, onClose, schoolName }) {
  const [query, setQuery] = useState('');
  const [exchanges, setExchanges] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [voiceState, setVoiceState] = useState('idle'); // 'idle' | 'recording' | 'transcribing'
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  /* Premium opening experience — one intro message per popup open (not
     per render), and an auto-rotating trending-question ticker while
     the empty state is showing. Purely presentational. */
  const [introMsgIndex, setIntroMsgIndex] = useState(0);
  const [trendIndex, setTrendIndex] = useState(0);
  const [voiceSubLabel, setVoiceSubLabel] = useState(0);
  const idRef = useRef(0);
  const voiceIndexRef = useRef(0);
  const voiceTimerRef = useRef(null);
  const voiceSubLabelTimerRef = useRef(null);
  const recognitionRef = useRef(null);
  const userStoppedRef = useRef(false);
  const inputRef = useRef(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    /* Pick a fresh intro message every time the popup opens. */
    setIntroMsgIndex(Math.floor(Math.random() * MAI_INTRO_MESSAGES.length));
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
    };
  }, [open, onClose]);

  /* Auto-rotate the trending-question ticker only while it's actually
     visible (popup open, empty state showing). */
  useEffect(() => {
    if (!open || exchanges.length > 0) return undefined;
    const id = setInterval(() => {
      setTrendIndex(i => (i + 1) % MAI_TRENDING_POOL.length);
    }, MAI_TRENDING_ROTATE_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, exchanges.length === 0]);

  /* Stop any in-flight voice "recording" timer when the panel closes or
     unmounts, so it never keeps ticking (and can't call setState) after
     the UI showing it is gone. */
  useEffect(() => {
    if (!open) {
       userStoppedRef.current = true;
      clearInterval(voiceTimerRef.current); voiceTimerRef.current = null;
      clearTimeout(voiceSubLabelTimerRef.current); voiceSubLabelTimerRef.current = null;
      if (recognitionRef.current) { recognitionRef.current.onend = null; recognitionRef.current.stop(); recognitionRef.current = null; }
    }
    return () => {
      userStoppedRef.current = true; 
      clearInterval(voiceTimerRef.current);
      clearTimeout(voiceSubLabelTimerRef.current);
      if (recognitionRef.current) { recognitionRef.current.onend = null; recognitionRef.current.stop(); }
    };
  }, [open]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [exchanges]);

  /* History server se aati hai (logs API). Rail kholne par, ya rail khuli ho
     aur naya jawab aa jaye, to dobara fetch. Fail ho to jo pehle tha wahi rehta hai. */
  const doneCount = exchanges.filter(ex => ex.status === 'done').length;
  useEffect(() => {
    if (!open || !historyOpen) return undefined;
    let cancelled = false;
    setHistoryLoading(true);
    fetchMentorAiHistory()
      .then(list => { if (!cancelled) setHistory(list); })
      .catch(() => { /* history optional hai */ })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [open, historyOpen, doneCount]);

  const sortedHistory = useMemo(() => [...history].sort((a, b) => b.updatedAt - a.updatedAt), [history]);
  const historyGroups = useMemo(() => {
    const groups = { Today: [], Yesterday: [], Earlier: [] };
    sortedHistory.forEach(h => { groups[dayBucket(h.updatedAt)].push(h); });
    return groups;
  }, [sortedHistory]);

  if (!open) return null;

  const runQuery = async (q, exchangeId) => {
    try {
      const [response] = await Promise.all([askMentorAgent(q), minDelay(MIN_AGENT_ANIMATION_MS)]);
      setExchanges(prev => prev.map(ex => (ex.id === exchangeId ? { ...ex, status: 'done', response } : ex)));
    } catch {
      setExchanges(prev => prev.map(ex => (ex.id === exchangeId ? { ...ex, status: 'error' } : ex)));
    }
  };

  const submit = (raw) => {
    const q = (raw ?? query).trim();
    if (!q) return;
    const id = ++idRef.current;
    setExchanges(prev => [...prev, { id, query: q, status: 'loading', response: null, steps: stepsForQuery(q) }]);
    setActiveSessionId(getMentorAiSessionId());
    setQuery('');
    runQuery(q, id);
  };

  const retry = (exchangeId, q) => {
    setExchanges(prev => prev.map(ex => (ex.id === exchangeId ? { ...ex, status: 'loading', steps: stepsForQuery(q) } : ex)));
    runQuery(q, exchangeId);
  };

  const focusInput = () => inputRef.current?.focus();

  /* ─── Voice command ─── */
  const stopVoiceTimer = () => { clearInterval(voiceTimerRef.current); voiceTimerRef.current = null; };

  /* Mock fallback path — used when the browser has no SpeechRecognition
     support, or the user denies the microphone. */
  const finishMockRecording = () => {
    stopVoiceTimer();
    setVoiceState('transcribing');
    setVoiceSubLabel(0); // "Understanding…"
    voiceSubLabelTimerRef.current = setTimeout(() => setVoiceSubLabel(1), VOICE_TRANSCRIBE_MS / 2); // "Finding answer…"
    setTimeout(() => {
      const text = MOCK_VOICE_TRANSCRIPTS[voiceIndexRef.current % MOCK_VOICE_TRANSCRIPTS.length];
      voiceIndexRef.current += 1;
      setQuery(text);
      setVoiceState('idle');
      setVoiceSeconds(0);
      focusInput();
    }, VOICE_TRANSCRIBE_MS);
  };

  const startMockRecording = () => {
  setVoiceState('recording');
  setVoiceSeconds(0);
  voiceTimerRef.current = setInterval(() => setVoiceSeconds(s => s + 1), 1000);
};

  /* Real speech-to-text path (Web Speech API) — listens live and writes
     straight into the composer input as words are recognized, so the
     user watches their own prompt appear and can edit it before sending,
     exactly like typing. */
 const startRealRecording = () => {
  const recognition = new SpeechRecognitionAPI();
  recognition.lang = 'en-US';
  recognition.continuous = true;
  recognition.interimResults = true;
  userStoppedRef.current = false;

  let finalText = '';
  recognition.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const chunk = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += `${chunk} `;
      else interim += chunk;
    }
    setQuery((finalText + interim).trim());
  };

  const finish = () => {
    stopVoiceTimer();
    recognitionRef.current = null;
    setVoiceState('idle');
    setVoiceSeconds(0);
    focusInput();
  };

  recognition.onerror = (e) => {
    /* Khamoshi ('no-speech') ya 'aborted' asli error nahi — onend dobara start kar dega. */
    if (e.error === 'no-speech' || e.error === 'aborted') return;

    /* Asli error: dobara start nahi karna */
    userStoppedRef.current = true;
    recognition.onend = null;
    stopVoiceTimer();
    recognitionRef.current = null;
    setVoiceState('idle');
    setVoiceSeconds(0);
    /* No mic / permission denied → mock flow par fallback */
    if (e.error === 'not-allowed' || e.error === 'audio-capture' || e.error === 'service-not-allowed') {
      startMockRecording();
    }
  };

  /* Browser khud band kare (khamoshi / lamba session) to user ne Stop nahi dabaya —
     dobara start karo. Sirf user ke Stop par asal mein band hota hai. */
  recognition.onend = () => {
    if (userStoppedRef.current || recognitionRef.current !== recognition) { finish(); return; }
    setTimeout(() => {
      if (userStoppedRef.current || recognitionRef.current !== recognition) { finish(); return; }
      try { recognition.start(); } catch { finish(); }
    }, 200);
  };

  recognitionRef.current = recognition;
  setQuery('');
  setVoiceState('recording');
  setVoiceSeconds(0);
  voiceTimerRef.current = setInterval(() => setVoiceSeconds(s => s + 1), 1000);
  recognition.start();
};

  const toggleVoice = () => {
    if (voiceState === 'recording') {
      userStoppedRef.current = true;
      if (recognitionRef.current) recognitionRef.current.stop();
      else finishMockRecording();
      return;
    }
    if (voiceState !== 'idle') return;
    if (SpeechRecognitionAPI) startRealRecording();
    else startMockRecording();
  };

  /* New chat sirf screen saaf karta hai — AI session_id wahi rehti hai (logout tak). */
  const startNewChat = () => {
    setExchanges([]);
    setActiveSessionId(null);
    setQuery('');
    focusInput();
  };

  /* Purani chat sirf dekhne ke liye khulti hai; session_id nahi badalti. */
  const loadSession = (item) => {
    setExchanges(item.exchanges);
    setActiveSessionId(item.id);
    setQuery('');
  };

  return createPortal(
    <div className="mai-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <aside className="mai-drawer" role="dialog" aria-modal="true" aria-label="Mentor AI — ERP Intelligence Assistant">
        <header className="mai-head">
          <span className="mai-logo-orb">
            <span className="mai-spark" aria-hidden="true" />
            <span className="mai-spark" aria-hidden="true" />
            <span className="mai-logo-chip mai-logo-chip--sm">
              <img src={mentorAILogo} className="mai-head-logo mai-logo-float" alt="Mentor AI" />
            </span>
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
                    <span>{historyLoading ? 'Loading your chats…' : 'Your recent AI tasks will show up here.'}</span>
                  </div>
                ) : (['Today', 'Yesterday', 'Earlier']).map(bucket => (
                  historyGroups[bucket].length === 0 ? null : (
                    <React.Fragment key={bucket}>
                      <div className="mai-history-daylabel">{bucket}</div>
                      {historyGroups[bucket].map(h => (
                        <div
                          key={h.id}
                          className={`mai-history-item${h.id === activeSessionId ? ' active' : ''}`}
                          onClick={() => loadSession(h)}
                        >
                          <div className="mai-history-item-txt">
                            <div className="mai-history-item-t">{h.title}</div>
                            <div className="mai-history-item-d">
                              <i className="fa-solid fa-circle-check mai-history-item-status" aria-hidden="true" /> Completed{h.updatedAt ? ` · ${timeAgo(h.updatedAt)}` : ''}
                            </div>
                          </div>
                        </div>
                      ))}
                    </React.Fragment>
                  )
                ))}
              </div>
            </nav>
          )}

          <div className="mai-main">
            <div className="mai-body mai-print-area" ref={bodyRef}>
              {exchanges.length === 0 && (
                <div className="mai-empty">
                  <span className="mai-logo-orb mai-logo-orb--lg">
                    <span className="mai-spark" aria-hidden="true" />
                    <span className="mai-spark" aria-hidden="true" />
                    <span className="mai-spark" aria-hidden="true" />
                    <span className="mai-logo-chip mai-logo-chip--lg">
                      <img src={mentorAILogo} className="mai-empty-logo mai-logo-float" alt="" aria-hidden="true" />
                    </span>
                  </span>

                  {/* Single line of text — the one rotating intro message,
                      re-picked each time the popup opens. */}
                  <div className="mai-rotate-msg mai-rotate-msg--hero">
                    <span className="mai-rotate-msg-text" key={introMsgIndex}>
                      <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />
                      {MAI_INTRO_MESSAGES[introMsgIndex]}
                    </span>
                  </div>

                  <div className="mai-trending mai-trending--hero mai-reveal mai-reveal-1">
                    <span className="mai-trending-label">
                      <i className="fa-solid fa-bolt" aria-hidden="true" /> Trending
                    </span>
                    <button
                      type="button"
                      className="mai-trending-chip"
                      key={trendIndex}
                      onClick={() => submit(MAI_TRENDING_POOL[trendIndex])}
                      title={MAI_TRENDING_POOL[trendIndex]}
                    >
                      <i className="fa-solid fa-arrow-trend-up" aria-hidden="true" />
                      {MAI_TRENDING_POOL[trendIndex]}
                    </button>
                  </div>
                </div>
              )}

              {exchanges.map(ex => (
                <div className="mai-exchange" key={ex.id}>
                  <div className="mai-query-pill">
                    <i className="fa-solid fa-circle-user" aria-hidden="true" /> {ex.query}
                  </div>
                  {ex.status === 'loading' && <AgentProgress steps={ex.steps} />}
                  {ex.status === 'error' && <ErrorPanel onRetry={() => retry(ex.id, ex.query)} />}
                  {ex.status === 'done' && (
                    ex.response?.kind === 'agent'
                      ? <MentorAIAgentResponse response={ex.response} schoolName={schoolName} onFollowUp={focusInput} />
                      : <MentorAIResponse response={ex.response} schoolName={schoolName} onFollowUp={focusInput} />
                  )}
                </div>
              ))}
            </div>

            {voiceState !== 'idle' && (
              <div className={`mai-voice-banner mai-voice-banner--${voiceState}`}>
                {voiceState === 'recording' ? (
                  <>
                    <span className="mai-voice-dot" aria-hidden="true" />
                    <span className="mai-voice-wave" aria-hidden="true">
                      {Array.from({ length: 5 }).map((_, i) => <span key={i} style={{ animationDelay: `${i * 0.1}s` }} />)}
                    </span>
                    <span>Listening… {String(Math.floor(voiceSeconds / 60)).padStart(1, '0')}:{String(voiceSeconds % 60).padStart(2, '0')}</span>
                    <button type="button" className="mai-voice-stop" onClick={toggleVoice}>
                      <i className="fa-solid fa-stop" aria-hidden="true" /> Stop
                    </button>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true" />
                    <span className="mai-voice-substate" key={voiceSubLabel}>{MAI_VOICE_UNDERSTAND_LABELS[voiceSubLabel]}</span>
                  </>
                )}
              </div>
            )}
            <form
              className="mai-composer"
              onSubmit={e => { e.preventDefault(); submit(); }}
            >
              <button
                type="button"
                className={`mai-mic${voiceState === 'recording' ? ' recording' : ''}`}
                onClick={toggleVoice}
                disabled={voiceState === 'transcribing'}
                aria-label={voiceState === 'recording' ? 'Stop voice input' : 'Ask by voice'}
                aria-pressed={voiceState === 'recording'}
              >
                <i className={`fa-solid ${voiceState === 'recording' ? 'fa-stop' : 'fa-microphone'}`} aria-hidden="true" />
              </button>
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