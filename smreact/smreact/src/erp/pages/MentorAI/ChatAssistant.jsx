import React, { useEffect, useMemo, useRef, useState } from 'react';
import mentorAILogo from '../../assets/images/mentorAILogo.png';
import { CHAT_QUICK_CHIPS, CHAT_MODES } from './mentorAiStudioData';
import { HowItWorksButton } from './HowItWorks';
import MarkdownMessage, { copyText } from './MarkdownMessage';
import { STAGE_SETS, useJobProgress, isCancelError, isTimeoutError } from './services/aiProgress';
import {
  createChatSession,
  getChatSessions,
  getChatSession,
  sendMessage,
  deleteChatSession as deleteApiChatSession,
   updateChatSession,
} from './services/mentorAIChatService';
import { useMentorAIActions } from './mentorAIPermissions';
/* ═══════════════════════════════════════════════════════════════════
   ChatAssistant — AI Chat Assistant screen.

   Mode: locked to Universal. The mode picker has been removed from
   this screen and every request sends mode=universal (see
   mentorAIChatService.CHAT_MODE). The other modes' data in
   mentorAiStudioData.js is left untouched for anything else using it.

   Replies render through <MarkdownMessage> (sanitised Markdown, code,
   tables, KaTeX), stream in when the server streams, and show the
   shared <ProgressBar> driven by the real request lifecycle.

   Ported from the prototype's `ai-chat-screen`: message thread, a
   chat-history side panel backed by the Mentor AI chat-sessions API,
   and browser speech-recognition voice input.
   ═══════════════════════════════════════════════════════════════════ */

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
function dayGroup(ts) {
  const d = new Date(ts); const now = new Date();
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(d, now)) return 'Today';
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (sameDay(d, yest)) return 'Yesterday';
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short' });
}

/* AI Chat Assistant is the module's entry point/"home" screen — these
   are the other tools, shown as a "More to Explore" section on the
   empty state so they're one click away without a separate hub
   screen in front of chat. */
const EXPLORE_FEATURES = [
  { id: 'lessonplans',  icon: 'fa-chalkboard-user', title: 'Lesson Plans', desc: 'Generate complete lesson plans in seconds.' },
  { id: 'worksheets',   icon: 'fa-file-pen',        title: 'Worksheets',   desc: 'Create custom worksheets & quizzes for any grade.' },
  { id: 'designstudio', icon: 'fa-palette',         title: 'Design Studio', desc: 'Generate social posts & thumbnails for your school.' },
];

export default function ChatAssistant({ toast, onConsumed, goTo, schoolName, canGo = () => true }) {
  const { canCreate, deny } = useMentorAIActions('chat', toast);
      const [historyOpen, setHistoryOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);  const [query, setQuery] = useState('');
  const [exchanges, setExchanges] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [voiceState, setVoiceState] = useState(null); // null | recording | converting | transcript
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const [voiceText, setVoiceText] = useState('');
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const idRef = useRef(0);
  const attachIdRef = useRef(0);
  const bodyRef = useRef(null);
  const voiceTimer = useRef(null);
  const mediaRecorderRef = useRef(null);
const audioChunksRef = useRef([]);
  const photoInputRef = useRef(null);
  // const pdfInputRef = useRef(null);

  const job = useJobProgress();
  const busy = job.running;
  const sessionRef = useRef(null);
  useEffect(() => { sessionRef.current = activeSessionId; }, [activeSessionId]);
  // Abort an in-flight reply / stop the mic if the user leaves the chat screen.
  useEffect(() => () => { job.cancel(); clearInterval(voiceTimer.current); voiceActiveRef.current = false; if (recognitionRef.current) recognitionRef.current.onend = null; recognitionRef.current?.abort?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // useEffect(() => { mentorAiStudioService.getChatHistory().then(setHistory).catch(() => {}); }, []);
   // ---- Chat history: hamesha CURRENT branch ki ----
  const [historyLoading, setHistoryLoading] = useState(true);
  const historyReqRef = useRef(0);
  const branchId = useCurrentBranchId();

  const loadChatHistory = async () => {
    const req = ++historyReqRef.current;     // har request ka number
    setHistoryLoading(true);
    try {
      const data = await getChatSessions();
      if (req !== historyReqRef.current) return; // purani request ka jawab ignore
      setHistory(Array.isArray(data) ? data : (data?.results || data?.data || []));
    } catch (error) {
      if (req !== historyReqRef.current) return;
      console.error("Failed to load chat history:", error.response?.data || error);
      setHistory([]);
    } finally {
      if (req === historyReqRef.current) setHistoryLoading(false);
    }
  };

  // Branch milne/badalne par: purani chat aur list saaf, phir nayi load
  useEffect(() => {
    if (!branchId) return;          // branch abhi set nahi hui → load mat karo
    setHistory([]);
    setExchanges([]);
    sessionRef.current = null;
    setActiveSessionId(null);
    loadChatHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    // Follow the stream only when the user is already near the bottom.
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
  }, [exchanges, job.progress.stageIndex]);

  // useEffect(() => {
  //   const settled = exchanges.filter(ex => ex.status !== 'loading');
  //   if (!settled.length) return;
  //   const id = activeSessionId ?? idRef.current;
  //   const session = { id, title: titleFrom(settled[0].query), updatedAt: Date.now(), modeId, exchanges: settled };
  //   mentorAiStudioService.saveChatSession(session).then(setHistory);
  //   if (activeSessionId == null) setActiveSessionId(id);
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [exchanges]);

const sortedHistory = useMemo(
  () =>
    [...history].sort(
      (a, b) =>
        new Date(b.created_at) - new Date(a.created_at)
    ),
  [history]
);
const patchExchange = (exchangeId, patch) => {
  setExchanges(prev => prev.map(ex => (ex.id === exchangeId ? { ...ex, ...patch } : ex)));
};

const runQuery = async (q, exchangeId, atts = []) => {
  if (!canCreate) { deny('create'); return; }
  if (job.running) return;
  const signal = job.start(STAGE_SETS.chat);
  patchExchange(exchangeId, { status: 'loading', text: '', error: null });

  try {
    // First message of a fresh chat: create the session before posting
    // to it (previously this posted to /sessions/null/messages/).
    let sessionId = sessionRef.current;
    const isNewSession = !sessionId;
    if (!sessionId) {
      const session = await createChatSession(titleFrom(q || atts[0]?.name));
      sessionId = session.id;
      sessionRef.current = sessionId;
      setActiveSessionId(sessionId);
    }

    const response = await sendMessage(
      sessionId,
      q,
      atts.map(a => a.file).filter(Boolean),
      {
        signal,
        onProgress: job.report,
        onDelta: (text) => { if (!signal.aborted) patchExchange(exchangeId, { status: 'streaming', text }); },
      }
    );

    const text = response?.message?.content;
    if (!text) throw new Error('Mentor AI returned an empty reply. Please try again.');

    job.report({ stage: 'finalizing' });
    patchExchange(exchangeId, {
      status: 'done',
      text,
      response: { blocks: [{ type: 'text', text }] },
    });
    job.complete();
    onConsumed?.();

    if (isNewSession && q) {
      updateChatSession(response?.session_id || sessionId, { title: titleFrom(q) }).catch(() => {});
    }
    loadChatHistory();
  } catch (error) {
    console.error("Chat API Error:", error.response?.data || error);
    const data = error.response?.data;
    const backendMsg = typeof data === 'string' ? '' : (data?.detail || data?.error || data?.message || '');
    const message = isCancelError(error)
      ? 'Stopped.'
      : isTimeoutError(error)
        ? 'Mentor AI took too long to reply. Please try again.'
        : backendMsg || error.message || 'Something went wrong.';
    const status = job.fail(error, message);
    patchExchange(exchangeId, { status: status === 'cancelled' ? 'cancelled' : 'error', error: message });
  }
};
  const submit = (raw) => {
    if (!canCreate) { deny('create'); return; }
    if (busy) return; // one reply at a time — no duplicate submissions
    const q = (raw ?? query).trim();
    const atts = pendingAttachments;
    if (!q && atts.length === 0) return;
    const id = ++idRef.current;
    setExchanges(prev => [...prev, { id, query: q, attachments: atts, status: 'loading', text: '', response: null }]);
    setQuery('');
    setPendingAttachments([]);
    setAttachMenuOpen(false);
    runQuery(q, id, atts);
  };

  /* ── Attachments: Photo / PDF ── */
  const pickPhoto = () => { setAttachMenuOpen(false); photoInputRef.current?.click(); };
  // const pickPdf = () => { setAttachMenuOpen(false); pdfInputRef.current?.click(); };
  const onFilesSelected = (kind) => (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const id = ++attachIdRef.current;
      const url = kind === 'image' ? URL.createObjectURL(file) : null;
setPendingAttachments(prev => [...prev, { 
    id, 
    kind, 
    name: file.name, 
    size: file.size, 
    url,
    file
}]);  });
    e.target.value = '';
  };
  const removeAttachment = (id) => {
    setPendingAttachments(prev => {
      const found = prev.find(a => a.id === id);
      if (found?.url) URL.revokeObjectURL(found.url);
      return prev.filter(a => a.id !== id);
    });
  };
  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

// const startNewChat = async () => {
//   if (busy) job.cancel();
//   try {
//     const session = await createChatSession('New Chat');

//     console.log('Mentor AI session created:', session);

//     setExchanges([]);
//     sessionRef.current = session.id;
//     setActiveSessionId(session.id);
//     setQuery('');
//     setHistoryOpen(false);
//   } catch (error) {
//     console.error(
//       'Failed to create Mentor AI chat session:',
//       error.response?.data || error
//     );

//     toast?.('Unable to start new chat');
//   }
// };

const startNewChat = async () => {
  if (busy) job.cancel();

  setExchanges([]);
  sessionRef.current = null;
  setActiveSessionId(null);
  setQuery('');
  setPendingAttachments([]);
  setHistoryOpen(false);
};


const loadSession = async (item) => {
  if (busy) job.cancel();
  try {
    const data = await getChatSession(item.id);

    console.log("SESSION DETAIL:", data);

    const messages = data?.messages || [];

    const mappedExchanges = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      if (msg.role === "user") {
        const assistantMsg = messages[i + 1]?.role === "assistant"
          ? messages[i + 1]
          : null;

        mappedExchanges.push({
          id: i + 1,
          query: msg.content,
          attachments: [],
          status: "done",
          text: assistantMsg?.content || "",
          response: {
            blocks: [
              {
                type: "text",
                text: assistantMsg?.content || ""
              }
            ]
          }
        });

        if (assistantMsg) {
          i++;
        }
      }
    }

    idRef.current = Math.max(idRef.current, mappedExchanges.length + 1);
    setExchanges(mappedExchanges);
    sessionRef.current = data.id || item.id;
    setActiveSessionId(data.id || item.id);
    setHistoryOpen(false);

  } catch (error) {
    console.error(
      "Failed to load session:",
      error.response?.data || error
    );
  }
};
const deleteSession = async (id) => {

  try {

    await deleteApiChatSession(id);

    console.log("CHAT DELETED:", id);

    setHistory(prev =>
      prev.filter(item => item.id !== id)
    );

    if (id === activeSessionId) {
      if (busy) job.cancel();
      setExchanges([]);
      sessionRef.current = null;
      setActiveSessionId(null);
      setQuery('');
    }

  } catch (error) {

    console.error(
      "Failed to delete chat:",
      error.response?.data || error
    );

  }

};

  /* ── Simulated voice input ── */
const recognitionRef = useRef(null);
const voiceActiveRef = useRef(false);
const voiceFinalRef = useRef('');


const finishChatVoice = () => {
  clearInterval(voiceTimer.current);
  setVoiceSeconds(0);
  setVoiceState(null);
  const text = voiceFinalRef.current.trim();
  voiceFinalRef.current = '';
  if (text) setQuery(text);
};

// Har dafa NAYA recognition object — chup hone pe bhi band nahi hota
const listenChat = () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SR();
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      if (event.results[i].isFinal) voiceFinalRef.current += `${event.results[i][0].transcript} `;
    }
    setVoiceText(voiceFinalRef.current.trim());
  };
  recognition.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      voiceActiveRef.current = false;
      alert('Microphone access is blocked. Allow microphone permission and try again.');
    }
  };
  recognition.onend = () => {
    if (voiceActiveRef.current) {
      setTimeout(() => { if (voiceActiveRef.current) listenChat(); }, 250);
    } else {
      finishChatVoice();
    }
  };
  recognitionRef.current = recognition;
  try { recognition.start(); } catch (e) { console.warn(e); }
};

const startRecording = () => {
  if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) {
    alert("Speech recognition not supported");
    return;
  }
  voiceFinalRef.current = '';
  setVoiceText('');
  voiceActiveRef.current = true;
  setVoiceState("recording");
  setVoiceSeconds(0);
  clearInterval(voiceTimer.current);
  voiceTimer.current = setInterval(() => setVoiceSeconds(s => s + 1), 1000);
  listenChat();
};

// Sirf Stop dabane pe band ho
const stopRecording = () => {
  voiceActiveRef.current = false;
  const rec = recognitionRef.current;
  if (rec) {
    rec.onend = null;
    try { rec.stop(); } catch { /* ignore */ }
  }
  setTimeout(finishChatVoice, 800);
};

  const cancelVoice = () => { voiceActiveRef.current = false; if (recognitionRef.current) { recognitionRef.current.onend = null; try { recognitionRef.current.abort(); } catch { /* ignore */ } } clearInterval(voiceTimer.current); setVoiceState(null); setVoiceSeconds(0); setVoiceText(''); };
  const sendVoiceTranscript = () => { submit(voiceText); cancelVoice(); };

  return (
    <div className="msai-chat">
      <div className="msai-chat-head">
        <div className="msai-chat-head-l">
          <span className="msai-chat-online"><span className="msai-chat-online-dot" /> Powered by SchoolMentor · Online</span>
          <HowItWorksButton topicKeys={['chat']} />
        </div>
        <div className="msai-chat-head-r">
                   <button type="button" className="msai-chip msai-chip--mode" onClick={() => setModeOpen(true)} aria-haspopup="dialog">
            <i className="fa-solid fa-sliders" aria-hidden="true" /> Universal <i className="fa-solid fa-chevron-down" aria-hidden="true" />
          </button>
                <button type="button" className="msai-icon-btn" onClick={() => { if (!historyOpen) loadChatHistory(); setHistoryOpen(o => !o); }} aria-label="Chat history">
            <i className="fa-solid fa-clock-rotate-left" aria-hidden="true" />
            {!historyLoading && history.length > 0 && <span className="msai-icon-badge">{history.length}</span>}
          </button>
          <button type="button" className="msai-icon-btn" onClick={startNewChat} aria-label="New chat">
            <i className="fa-solid fa-pen-to-square" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="msai-chat-shell">
        <div className="msai-chat-body" ref={bodyRef}>
          {exchanges.length === 0 && (
            <div className="msai-chat-empty">
              <span className="msai-logo-chip msai-logo-chip--empty">
                <img src={mentorAILogo} alt="Mentor AI" className="msai-empty-logo" />
              </span>
              <div className="msai-chat-empty-t">Hi! I'm your AI teaching assistant.</div>
              <div className="msai-chat-empty-s">Ask me anything — lesson ideas, classroom strategies, worksheets or designs for {schoolName}.</div>
              <div className="msai-chat-chips">
                {CHAT_QUICK_CHIPS.map(c => (
                  <button key={c} type="button" className="msai-chip"onClick={() => submit(c)} disabled={busy || !canCreate}>{c}</button>
                ))}
              </div>

              {goTo && EXPLORE_FEATURES.some(f => canGo(f.id)) && (
                                <div className="msai-chat-explore">
                  <div className="msai-chat-explore-lbl">More to Explore</div>
                  <div className="msai-chat-explore-grid">
                                       {EXPLORE_FEATURES.filter(f => canGo(f.id)).map(f => (
                      <button key={f.id} type="button" className="msai-feature-card" onClick={() => goTo(f.id)}>
                        <div className="msai-feature-ic"><i className={`fa-solid ${f.icon}`} aria-hidden="true" /></div>
                        <div className="msai-feature-txt">
                          <div className="msai-feature-title">{f.title}</div>
                          <div className="msai-feature-desc">{f.desc}</div>
                        </div>
                        <i className="fa-solid fa-chevron-right msai-feature-chev" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {exchanges.map(ex => (
            <div className="msai-chat-exchange" key={ex.id}>
              <div className="msai-msg-row user">
                <div className="msai-msg-bubble user">
                  {ex.attachments?.length > 0 && <AttachmentChips items={ex.attachments} />}
                  {ex.query && <span className="msai-msg-text">{ex.query}</span>}
                </div>
              </div>
              {(ex.status === 'loading' || ex.status === 'streaming') && (
                <div className="msai-msg-row ai">
                  <div className="msai-msg-bubble ai">
                    {ex.text ? <MarkdownMessage text={ex.text} streaming /> : null}
                    <div className="msai-typing-row">
                      <div className={`msai-typing${ex.text ? ' msai-typing--inline' : ''}`} role="status" aria-label="Mentor AI is typing">
                        <span /><span /><span />
                      </div>
                      <button type="button" className="msai-typing-stop" onClick={job.cancel} aria-label="Stop reply">
                        <i className="fa-solid fa-stop" aria-hidden="true" /> Stop
                      </button>
                    </div>                  </div>
                </div>
              )}
              {(ex.status === 'error' || ex.status === 'cancelled') && (
                <div className="msai-msg-row ai">
                  <div className={`msai-msg-bubble ai msai-msg-bubble--${ex.status}`}>
                    {ex.text ? <MarkdownMessage text={ex.text} /> : null}
                    <div className="msai-msg-errline">
                      <i className={`fa-solid ${ex.status === 'cancelled' ? 'fa-ban' : 'fa-triangle-exclamation'}`} aria-hidden="true" />
                      <span>{ex.error || 'Something went wrong.'}</span>
                      <button type="button" className="msai-retry" disabled={busy || !canCreate}onClick={() => runQuery(ex.query, ex.id, ex.attachments || [])}>Retry</button>
                    </div>
                  </div>
                </div>
              )}
              {ex.status === 'done' && (
                <div className="msai-msg-row ai">
                  <div className="msai-msg-bubble ai">
                    {renderBlocks(ex.response.blocks)}
                    <div className="msai-resp-actions">
                      <button type="button" className="msai-resp-pill" onClick={async () => { const ok = await copyText(blocksToText(ex.response.blocks)); toast?.(ok ? 'Copied to clipboard' : 'Copy failed'); }}>
                        <i className="fa-regular fa-copy" aria-hidden="true" /> Copy
                      </button>
             
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <input ref={photoInputRef} type="file" accept="image/*" multiple hidden onChange={onFilesSelected('image')} />
        {/* <input ref={pdfInputRef} type="file" accept=".pdf,application/pdf" multiple hidden onChange={onFilesSelected('pdf')} /> */}

        {pendingAttachments.length > 0 && (
          <div className="msai-attach-preview">
            {pendingAttachments.map(a => (
              <div key={a.id} className="msai-attach-preview-item">
                {a.kind === 'image'
                  ? <img src={a.url} alt="" className="msai-attach-preview-thumb" />
                  : <span className="msai-attach-preview-icon"><i className="fa-regular fa-file-pdf" aria-hidden="true" /></span>}
                <span className="msai-attach-preview-name" title={a.name}>{a.name}</span>
                <button type="button" onClick={() => removeAttachment(a.id)} aria-label={`Remove ${a.name}`}>
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

        {voiceState ? (
          <VoiceBar
            state={voiceState}
            seconds={voiceSeconds}
            text={voiceText}
            onChangeText={setVoiceText}
            onStop={stopRecording}
            onCancel={cancelVoice}
            onSend={sendVoiceTranscript}
            onReRecord={startRecording}
          />
        ) : (
          <form className="msai-composer" onSubmit={e => { e.preventDefault(); submit(); }}>
            <div className="msai-attach-wrap">
              <button type="button" className="msai-composer-icon" onClick={() => setAttachMenuOpen(o => !o)} disabled={!canCreate} aria-label="Attach photo or PDF">
                <i className="fa-solid fa-paperclip" aria-hidden="true" />
              </button>
              {attachMenuOpen && (
                <>
                  <div className="msai-attach-menu-backdrop" onClick={() => setAttachMenuOpen(false)} />
                  <div className="msai-attach-menu">
                    <button type="button" onClick={pickPhoto}><i className="fa-regular fa-image" aria-hidden="true" /> Photo</button>
                    {/* <button type="button" onClick={pickPdf}><i className="fa-regular fa-file-pdf" aria-hidden="true" /> PDF</button> */}
                  </div>
                </>
              )}
            </div>
            <input
              type="text" value={query} onChange={e => setQuery(e.target.value)}
            disabled={!canCreate}
placeholder={!canCreate ? 'You have view-only access to AI Chat' : busy ? 'Mentor AI is replying…' : 'Ask Mentor AI…'} aria-label="Message"
            />
            <button type="button" className="msai-composer-icon" onClick={startRecording} aria-label="Voice input">
              <i className="fa-solid fa-microphone" aria-hidden="true" />
            </button>
            <button type="submit" className="msai-composer-send" disabled={busy || (!query.trim() && pendingAttachments.length === 0)} aria-label="Send">
              <i className="fa-solid fa-paper-plane" aria-hidden="true" />
            </button>
          </form>
        )}
      </div>

      {modeOpen && (
        <div className="msai-panel-overlay" onClick={e => { if (e.target === e.currentTarget) setModeOpen(false); }}>
          <ModeList onClose={() => setModeOpen(false)} />
        </div>
      )}

      {historyOpen && (        <div className="msai-panel-overlay" onClick={e => { if (e.target === e.currentTarget) setHistoryOpen(false); }}>
          <aside className="msai-panel msai-panel--right">
            <div className="msai-panel-head">
              <span>Chat History</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="msai-chip" onClick={startNewChat}><i className="fa-solid fa-plus" aria-hidden="true" /> New</button>
                <button type="button" className="msai-icon-btn" onClick={() => setHistoryOpen(false)} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
              </div>
            </div>
            <div className="msai-panel-body">
                   {historyLoading ? (
                <div className="msai-editai-empty"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Loading your chats…</div>
              ) : sortedHistory.length === 0 ? (
                <div className="msai-editai-empty">Your past conversations will show up here.</div>
              ) : Object.entries(groupByDay(sortedHistory)).map(([day, items]) => (
                <div key={day} className="msai-hist-group">
                  <div className="msai-hist-group-lbl">{day}</div>
                  {items.map(h => (
                    <div key={h.id} className={`msai-hist-item${h.id === activeSessionId ? ' active' : ''}`} onClick={() => loadSession(h)}>
                      <div className="msai-hist-item-t">{h.title}</div>
                      <div className="msai-hist-item-m">
<span>
  {timeAgo(new Date(h.updated_at).getTime())}
</span>                        <span className="msai-hist-item-mode">Universal</span>
                      </div>
                      <button type="button" className="msai-hist-del" onClick={e => { e.stopPropagation(); deleteSession(h.id); }} aria-label="Delete"><i className="fa-solid fa-trash" aria-hidden="true" /></button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}

    </div>
  );
}

function groupByDay(sorted) {
  const out = {};
  sorted.forEach(h => { const g = dayGroup(new Date(h.updated_at || h.created_at || h.updatedAt || Date.now()).getTime()); (out[g] = out[g] || []).push(h); });
  return out;
}

function VoiceBar({ state, seconds, text, onChangeText, onStop, onCancel, onSend, onReRecord }) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  if (state === 'recording') {
    return (
      <div className="msai-voicebar">
        <span className="msai-voice-dot" /> Recording… {mm}:{ss}
        <div className="msai-voicebar-actions">
          <button type="button" className="msai-btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="msai-btn-primary" onClick={onStop}>Stop</button>
        </div>
      </div>
    );
  }
  if (state === 'converting') {
    return (
      <div className="msai-voicebar">
        <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Converting voice to text…
      </div>
    );
  }
  return (
    <div className="msai-voicebar msai-voicebar--transcript">
      <textarea value={text} onChange={e => onChangeText(e.target.value)} rows={2} />
      <div className="msai-voicebar-actions">
        <button type="button" className="msai-btn-secondary" onClick={onReRecord}>Re-record</button>
        <button type="button" className="msai-btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="msai-btn-primary" onClick={onSend}>Send</button>
      </div>
    </div>
  );
}

function ModeList({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const universal = CHAT_MODES.find(m => m.id === 'universal') || CHAT_MODES[0];

  return (
    <aside className="msai-panel msai-panel--right msai-panel--wide" role="dialog" aria-label="Mentor modes" onClick={e => e.stopPropagation()}>
      <div className="msai-panel-head">
        <span>Mentor Modes</span>
        <button type="button" className="msai-icon-btn" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
      </div>
      <div className="msai-panel-body">
        <div className="msai-mode-preview" style={{ borderColor: universal.color }}>
          <span className="msai-mode-tag" style={{ background: `${universal.color}1A`, color: universal.color }}>{universal.name}</span>
          <div className="msai-mode-preview-desc">{universal.description}</div>
          <div className="msai-mode-preview-ex"><i className="fa-solid fa-quote-left" aria-hidden="true" /> {universal.example}</div>
        </div>
        <div className="msai-mode-note">Universal is active. Other modes are coming soon.</div>
        <div className="msai-mode-list">
          {CHAT_MODES.map(m => {
            const isUniversal = m.id === 'universal';
            return (
              <button key={m.id} type="button"
                className={`msai-mode-item${isUniversal ? ' current' : ''}`}
                disabled={!isUniversal}
                onClick={isUniversal ? onClose : undefined}>
                <span className="msai-mode-dot" style={{ background: m.color }} />
                <span className="msai-mode-item-txt">
                  <span className="msai-mode-item-name">{m.name}</span>
                  <span className="msai-mode-item-cat">{m.category}</span>
                </span>
                {isUniversal
                  ? <i className="fa-solid fa-check" aria-hidden="true" />
                  : <span className="msai-mode-soon"><i className="fa-solid fa-lock" aria-hidden="true" /> Coming soon</span>}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

/* ── Attachment chips — shown on a sent message's own bubble. ── */function AttachmentChips({ items }) {
  return (
    <div className="msai-msg-attachments">
      {items.map(a => (
        <div key={a.id} className="msai-msg-attachment">
          {a.kind === 'image'
            ? <img src={a.url} alt="" className="msai-msg-attachment-thumb" />
            : <span className="msai-msg-attachment-icon"><i className="fa-regular fa-file-pdf" aria-hidden="true" /></span>}
          <span className="msai-msg-attachment-name">{a.name}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Typed-block response renderer:
   heading | text | bullets | numbered | correction | fields ── */
function renderBlocks(blocks) {
  return blocks.map((b, i) => {
    if (b.type === 'heading') return <div key={i} className="msai-resp-heading">{b.text}</div>;
    // Text blocks are Markdown: rendered as React elements (no innerHTML),
    // [placeholders] are still highlighted by MarkdownMessage.
    if (b.type === 'text') return <MarkdownMessage key={i} text={b.text} />;
    if (b.type === 'bullets') return <ul key={i} className="msai-resp-bullets">{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>;
    if (b.type === 'numbered') return <ol key={i} className="msai-resp-numbered">{b.items.map((it, j) => <li key={j}>{it}</li>)}</ol>;
    if (b.type === 'correction') {
      return (
        <div key={i} className="msai-resp-correction">
          <div className="msai-resp-correction-row"><span>Original</span><p>{b.original}</p></div>
          <div className="msai-resp-correction-row"><span>Issue</span><p>{b.issue}</p></div>
          <div className="msai-resp-correction-row msai-resp-correction-row--fixed"><span>Corrected</span><p>{b.corrected}</p></div>
          <div className="msai-resp-correction-row"><span>Rule</span><p>{b.rule}</p></div>
        </div>
      );
    }
    if (b.type === 'fields') {
      return (
        <div key={i} className="msai-resp-fields">
          {b.items.map((f, j) => (
            <div key={j} className="msai-resp-fields-row"><span>{f.label}</span><p>{f.value}</p></div>
          ))}
        </div>
      );
    }
    return null;
  });
}
function blocksToText(blocks) {
  return blocks.map(b => {
    if (b.type === 'heading') return `${b.text}\n`;
    if (b.type === 'text') return `${b.text}\n`;
    if (b.type === 'bullets' || b.type === 'numbered') return b.items.map(it => `• ${it}`).join('\n');
    if (b.type === 'correction') return `Original: ${b.original}\nIssue: ${b.issue}\nCorrected: ${b.corrected}\nRule: ${b.rule}`;
     if (b.type === 'fields') return b.items.map(f => `${f.label}: ${f.value}`).join('\n');
    return '';
  }).join('\n');
}

/* Current branch ID — localStorage se, aur badalne par update */
const BRANCH_KEY = 'branch_id'; // ⚠️ apni app ki asli key yahan likhein

function readBranchId() {
  try {
    const raw = localStorage.getItem(BRANCH_KEY);
    if (!raw) return null;
    try { const o = JSON.parse(raw); return String(o?.id ?? o?.branch_id ?? o); } catch { return raw; }
  } catch { return null; }
}

function useCurrentBranchId() {
  const [id, setId] = useState(readBranchId);
  useEffect(() => {
    const check = () => setId(prev => { const now = readBranchId(); return now !== prev ? now : prev; });
    const t = setInterval(check, 500);
    window.addEventListener('storage', check);
    return () => { clearInterval(t); window.removeEventListener('storage', check); };
  }, []);
  return id;
}