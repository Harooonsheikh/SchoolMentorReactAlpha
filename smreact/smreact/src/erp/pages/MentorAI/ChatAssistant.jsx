import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as mentorAiStudioService from '../../services/mentorAiStudioService';
import mentorAILogo from '../../assets/images/mentorAILogo.png';
import { CHAT_MODES, CHAT_QUICK_CHIPS } from './mentorAiStudioData';
import { HowItWorksButton } from './HowItWorks';

/* ═══════════════════════════════════════════════════════════════════
   ChatAssistant — AI Chat Assistant screen.

   Ported from the prototype's `ai-chat-screen`: message thread with a
   typed-block AI response renderer, 16 specialist "Mentor modes" (side
   panel here instead of a mobile bottom sheet — reuses this app's own
   .modal-overlay/.modal pattern), a chat-history side panel (own
   localStorage-backed store via mentorAiStudioService — independent of
   the Dashboard's existing Mentor AI analytics-assistant history), and
   a simulated voice-input flow (recording → converting → transcript).
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

export default function ChatAssistant({ toast, onConsumed, goTo, schoolName }) {
  const [modeId, setModeId] = useState('universal');
  const [modeOpen, setModeOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [query, setQuery] = useState('');
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
  const photoInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  const mode = CHAT_MODES.find(m => m.id === modeId) || CHAT_MODES[0];

  useEffect(() => { mentorAiStudioService.getChatHistory().then(setHistory).catch(() => {}); }, []);
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [exchanges]);

  useEffect(() => {
    const settled = exchanges.filter(ex => ex.status !== 'loading');
    if (!settled.length) return;
    const id = activeSessionId ?? idRef.current;
    const session = { id, title: titleFrom(settled[0].query), updatedAt: Date.now(), modeId, exchanges: settled };
    mentorAiStudioService.saveChatSession(session).then(setHistory);
    if (activeSessionId == null) setActiveSessionId(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exchanges]);

  const sortedHistory = useMemo(() => [...history].sort((a, b) => b.updatedAt - a.updatedAt), [history]);

  const runQuery = async (q, exchangeId, atts) => {
    try {
      const response = await mentorAiStudioService.sendChatMessage(q, modeId, atts);
      setExchanges(prev => prev.map(ex => (ex.id === exchangeId ? { ...ex, status: 'done', response } : ex)));
      onConsumed?.();
    } catch {
      setExchanges(prev => prev.map(ex => (ex.id === exchangeId ? { ...ex, status: 'error' } : ex)));
    }
  };

  const submit = (raw) => {
    const q = (raw ?? query).trim();
    const atts = pendingAttachments;
    if (!q && atts.length === 0) return;
    const id = ++idRef.current;
    setExchanges(prev => [...prev, { id, query: q, attachments: atts, status: 'loading', response: null }]);
    setQuery('');
    setPendingAttachments([]);
    setAttachMenuOpen(false);
    runQuery(q, id, atts);
  };

  /* ── Attachments: Photo / PDF ── */
  const pickPhoto = () => { setAttachMenuOpen(false); photoInputRef.current?.click(); };
  const pickPdf = () => { setAttachMenuOpen(false); pdfInputRef.current?.click(); };
  const onFilesSelected = (kind) => (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const id = ++attachIdRef.current;
      const url = kind === 'image' ? URL.createObjectURL(file) : null;
      setPendingAttachments(prev => [...prev, { id, kind, name: file.name, size: file.size, url }]);
    });
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

  const startNewChat = () => {
    setExchanges([]); setActiveSessionId(null); setQuery(''); setHistoryOpen(false);
  };
  const loadSession = (item) => {
    setExchanges(item.exchanges); setActiveSessionId(item.id); setModeId(item.modeId || 'universal'); setHistoryOpen(false);
  };
  const deleteSession = (id) => {
    mentorAiStudioService.deleteChatSession(id).then(setHistory);
    if (id === activeSessionId) startNewChat();
  };

  /* ── Simulated voice input ── */
  const startRecording = () => {
    setVoiceState('recording'); setVoiceSeconds(0);
    voiceTimer.current = setInterval(() => setVoiceSeconds(s => s + 1), 1000);
  };
  const stopRecording = () => {
    clearInterval(voiceTimer.current);
    setVoiceState('converting');
    setTimeout(() => {
      setVoiceText('This is a simulated voice transcript — connect a speech-to-text API to enable real transcription.');
      setVoiceState('transcript');
    }, 900);
  };
  const cancelVoice = () => { clearInterval(voiceTimer.current); setVoiceState(null); setVoiceSeconds(0); setVoiceText(''); };
  const sendVoiceTranscript = () => { submit(voiceText); cancelVoice(); };

  return (
    <div className="msai-chat">
      <div className="msai-chat-head">
        <div className="msai-chat-head-l">
          <span className="msai-chat-online"><span className="msai-chat-online-dot" /> Powered by SchoolMentor · Online</span>
          <HowItWorksButton topicKeys={['chat']} />
        </div>
        <div className="msai-chat-head-r">
          <button type="button" className="msai-chip" onClick={() => setModeOpen(true)}>
            <i className="fa-solid fa-sliders" aria-hidden="true" /> {mode.name}
          </button>
          <button type="button" className="msai-icon-btn" onClick={() => setHistoryOpen(o => !o)} aria-label="Chat history">
            <i className="fa-solid fa-clock-rotate-left" aria-hidden="true" />
            {history.length > 0 && <span className="msai-icon-badge">{history.length}</span>}
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
                  <button key={c} type="button" className="msai-chip" onClick={() => submit(c)}>{c}</button>
                ))}
              </div>

              {goTo && (
                <div className="msai-chat-explore">
                  <div className="msai-chat-explore-lbl">More to Explore</div>
                  <div className="msai-chat-explore-grid">
                    {EXPLORE_FEATURES.map(f => (
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
                  {ex.query && <span>{ex.query}</span>}
                </div>
              </div>
              {ex.status === 'loading' && (
                <div className="msai-msg-row ai">
                  <div className="msai-msg-bubble ai msai-typing"><span /><span /><span /></div>
                </div>
              )}
              {ex.status === 'error' && (
                <div className="msai-msg-row ai">
                  <div className="msai-msg-bubble ai">Something went wrong. <button type="button" className="msai-retry" onClick={() => { setExchanges(p => p.map(e => (e.id === ex.id ? { ...e, status: 'loading' } : e))); runQuery(ex.query, ex.id); }}>Retry</button></div>
                </div>
              )}
              {ex.status === 'done' && (
                <div className="msai-msg-row ai">
                  <div className="msai-msg-bubble ai">
                    {renderBlocks(ex.response.blocks)}
                    <div className="msai-resp-actions">
                      <button type="button" className="msai-resp-pill" onClick={() => { navigator.clipboard?.writeText(blocksToText(ex.response.blocks)); toast?.('Copied to clipboard'); }}>
                        <i className="fa-regular fa-copy" aria-hidden="true" /> Copy
                      </button>
                      <button type="button" className="msai-resp-pill" onClick={() => toast?.('Saved')}>
                        <i className="fa-regular fa-bookmark" aria-hidden="true" /> Save
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <input ref={photoInputRef} type="file" accept="image/*" multiple hidden onChange={onFilesSelected('image')} />
        <input ref={pdfInputRef} type="file" accept=".pdf,application/pdf" multiple hidden onChange={onFilesSelected('pdf')} />

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
              <button type="button" className="msai-composer-icon" onClick={() => setAttachMenuOpen(o => !o)} aria-label="Attach photo or PDF">
                <i className="fa-solid fa-paperclip" aria-hidden="true" />
              </button>
              {attachMenuOpen && (
                <>
                  <div className="msai-attach-menu-backdrop" onClick={() => setAttachMenuOpen(false)} />
                  <div className="msai-attach-menu">
                    <button type="button" onClick={pickPhoto}><i className="fa-regular fa-image" aria-hidden="true" /> Photo</button>
                    <button type="button" onClick={pickPdf}><i className="fa-regular fa-file-pdf" aria-hidden="true" /> PDF</button>
                  </div>
                </>
              )}
            </div>
            <input
              type="text" value={query} onChange={e => setQuery(e.target.value)}
              placeholder={`Ask ${mode.name}…`} aria-label="Message"
            />
            <button type="button" className="msai-composer-icon" onClick={startRecording} aria-label="Voice input">
              <i className="fa-solid fa-microphone" aria-hidden="true" />
            </button>
            <button type="submit" className="msai-composer-send" disabled={!query.trim() && pendingAttachments.length === 0} aria-label="Send">
              <i className="fa-solid fa-paper-plane" aria-hidden="true" />
            </button>
          </form>
        )}
      </div>

      {historyOpen && (
        <div className="msai-panel-overlay" onClick={e => { if (e.target === e.currentTarget) setHistoryOpen(false); }}>
          <aside className="msai-panel msai-panel--right">
            <div className="msai-panel-head">
              <span>Chat History</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="msai-chip" onClick={startNewChat}><i className="fa-solid fa-plus" aria-hidden="true" /> New</button>
                <button type="button" className="msai-icon-btn" onClick={() => setHistoryOpen(false)} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
              </div>
            </div>
            <div className="msai-panel-body">
              {sortedHistory.length === 0 ? (
                <div className="msai-editai-empty">Your past conversations will show up here.</div>
              ) : Object.entries(groupByDay(sortedHistory)).map(([day, items]) => (
                <div key={day} className="msai-hist-group">
                  <div className="msai-hist-group-lbl">{day}</div>
                  {items.map(h => (
                    <div key={h.id} className={`msai-hist-item${h.id === activeSessionId ? ' active' : ''}`} onClick={() => loadSession(h)}>
                      <div className="msai-hist-item-t">{h.title}</div>
                      <div className="msai-hist-item-m">
                        <span>{timeAgo(h.updatedAt)}</span>
                        <span className="msai-hist-item-mode">{(CHAT_MODES.find(m => m.id === h.modeId) || CHAT_MODES[0]).name}</span>
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

      {modeOpen && (
        <div className="msai-panel-overlay" onClick={e => { if (e.target === e.currentTarget) setModeOpen(false); }}>
          <ModeSelector currentId={modeId} onSelect={id => { setModeId(id); setModeOpen(false); }} onClose={() => setModeOpen(false)} />
        </div>
      )}
    </div>
  );
}

function groupByDay(sorted) {
  const out = {};
  sorted.forEach(h => { const g = dayGroup(h.updatedAt); (out[g] = out[g] || []).push(h); });
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

function ModeSelector({ currentId, onSelect, onClose }) {
  const [q, setQ] = useState('');
  const [highlight, setHighlight] = useState(currentId);
  const filtered = CHAT_MODES.filter(m => !q.trim() || m.name.toLowerCase().includes(q.toLowerCase()) || m.category.toLowerCase().includes(q.toLowerCase()));
  const preview = CHAT_MODES.find(m => m.id === highlight) || CHAT_MODES[0];

  return (
    <aside className="msai-panel msai-panel--right msai-panel--wide" onClick={e => e.stopPropagation()}>
      <div className="msai-panel-head">
        <span>Select Mentor Mode</span>
        <button type="button" className="msai-icon-btn" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
      </div>
      <div className="msai-panel-body">
        <input className="msai-mode-search" type="text" placeholder="Search modes…" value={q} onChange={e => setQ(e.target.value)} autoFocus />

        <div className="msai-mode-preview" style={{ borderColor: preview.color }}>
          <span className="msai-mode-tag" style={{ background: `${preview.color}1A`, color: preview.color }}>{preview.name}</span>
          <div className="msai-mode-preview-desc">{preview.description}</div>
          <div className="msai-mode-preview-ex"><i className="fa-solid fa-quote-left" aria-hidden="true" /> {preview.example}</div>
        </div>

        <div className="msai-mode-list">
          {filtered.map(m => (
            <button
              key={m.id}
              type="button"
              className={`msai-mode-item${m.id === currentId ? ' current' : ''}${m.id === highlight ? ' highlighted' : ''}`}
              onMouseEnter={() => setHighlight(m.id)}
              onClick={() => onSelect(m.id)}
            >
              <span className="msai-mode-dot" style={{ background: m.color }} />
              <span className="msai-mode-item-txt">
                <span className="msai-mode-item-name">{m.name}</span>
                <span className="msai-mode-item-cat">{m.category}</span>
              </span>
              {m.id === currentId && <i className="fa-solid fa-check" aria-hidden="true" />}
            </button>
          ))}
          {filtered.length === 0 && <div className="msai-editai-empty">No modes match "{q}".</div>}
        </div>
      </div>
    </aside>
  );
}

/* ── Attachment chips — shown on a sent message's own bubble. ── */
function AttachmentChips({ items }) {
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

/* Wraps [bracket placeholders] in a styled span so unfilled fields
   (Marketing mode's [insert enrollment number], etc.) are visually
   flagged before anything gets copied or sent — matches the "clearly
   mark placeholders" convention from the prompt-engineering guide. */
function highlightPlaceholders(text) {
  return text.replace(/\[([^\]]+)\]/g, '<span class="msai-placeholder">[$1]</span>');
}

/* ── Typed-block response renderer:
   heading | text | bullets | numbered | correction | fields ── */
function renderBlocks(blocks) {
  return blocks.map((b, i) => {
    if (b.type === 'heading') return <div key={i} className="msai-resp-heading">{b.text}</div>;
    if (b.type === 'text') return <p key={i} className="msai-resp-text" dangerouslySetInnerHTML={{ __html: highlightPlaceholders(b.text) }} />;
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
    if (b.type === 'text') return `${b.text.replace(/<\/?b>/g, '')}\n`;
    if (b.type === 'bullets' || b.type === 'numbered') return b.items.map(it => `• ${it}`).join('\n');
    if (b.type === 'correction') return `Original: ${b.original}\nIssue: ${b.issue}\nCorrected: ${b.corrected}\nRule: ${b.rule}`;
    if (b.type === 'fields') return b.items.map(f => `${f.label}: ${f.value}`).join('\n');
    return '';
  }).join('\n');
}
