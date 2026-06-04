import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from './Tooltip';
import { useUniversalSearch } from '../hooks/useUniversalSearch';

/* ═══════════════════════════════════════════════════════════════════
   UniversalSearch — global ERP search bar, Google-style.

   Props
     onNavigate(target, params?)  — REQUIRED. Called when a result is
                                    clicked. `target` is App.js's
                                    NAV_LABELS key ('students', 'acad', …)
     canAccess(moduleId?)         — optional permission predicate; if
                                    omitted every active module is searched
     sessionId?                   — current session id; providers may scope
     placeholder?                 — input placeholder
     compact?                     — slimmer chrome (default false)
     toast?                       — optional, used for surfaced messages

   The component owns its open/closed state and a portal-rendered
   dropdown so it never gets clipped by parent overflow. Full keyboard
   nav (↑ ↓ Enter Esc), full dark mode, full responsive (collapses to
   100%-width sheet on mobile), and a one-time global stylesheet
   injected on first mount.
   ═══════════════════════════════════════════════════════════════════ */

export default function UniversalSearch({
  onNavigate,
  canAccess,
  sessionId = null,
  placeholder = 'Search students, employees, lesson plans, exams, fees…',
  compact = false,
  toast,
}) {
  const inputId = useId();
  const {
    query, setQuery, submit, clear,
    loading, results, grouped, totalCount,
    recentSearches, clearRecents,
    suggestedSearches, popularSearches,
    recordVisit,
  } = useUniversalSearch({ canAccess, sessionId });

  const [open,        setOpen]        = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [panelStyle,  setPanelStyle]  = useState({ top: 0, left: 0, width: 480 });
  const [mobile,      setMobile]      = useState(
    typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches
  );

  const wrapRef   = useRef(null);
  const inputRef  = useRef(null);
  const panelRef  = useRef(null);

  /* ─── Position the portal-rendered panel below the input. Re-measures
         on scroll / resize. On mobile the panel goes full-bleed. */
  const measure = useCallback(() => {
    if (!wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const isMobile = vw <= 720;
    setMobile(isMobile);
    if (isMobile) {
      setPanelStyle({ top: r.bottom + 6, left: 8, width: vw - 16 });
    } else {
      setPanelStyle({
        top:   r.bottom + 6,
        left:  Math.max(12, Math.min(r.left, vw - 12 - Math.max(420, r.width))),
        width: Math.max(420, r.width),
      });
    }
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    measure();
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open, measure]);

  /* ─── Close on outside click. */
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (
        wrapRef.current  && !wrapRef.current.contains(e.target) &&
        panelRef.current && !panelRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  /* ─── Global Ctrl/Cmd-K to focus the search. */
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* ─── Keep activeIndex sane as the flat list changes. */
  useEffect(() => { setActiveIndex(0); }, [results.length, open]);

  /* ─── Flatten visible results (top-N flat list across all groups). */
  const visibleResults = results.slice(0, 20);

  /* ─── Result click handler. */
  const handleSelect = useCallback((res) => {
    if (!res) return;
    recordVisit(res);
    setOpen(false);
    onNavigate?.(res.navTarget, res.navParams || null);
    toast?.(`Opening ${res.title}…`, 'info');
  }, [onNavigate, recordVisit, toast]);

  /* ─── Keyboard navigation while panel is open. */
  const handleInputKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (query) clear(); else setOpen(false);
      return;
    }
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(visibleResults.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (visibleResults.length > 0 && activeIndex >= 0) {
        handleSelect(visibleResults[activeIndex]);
      } else {
        submit();
      }
    }
  };

  const hasQuery = (query || '').trim().length > 0;

  /* ──────────────────────────────────────────────────────────────── */
  return (
    <div ref={wrapRef} className={`uvs-wrap${compact ? ' uvs-wrap--compact' : ''}`}>
      <div className="uvs-input-wrap">
        <i className="fa-solid fa-magnifying-glass uvs-input-ic" aria-hidden="true"></i>
        <input
          id={inputId}
          ref={inputRef}
          className="uvs-input"
          type="search"
          autoComplete="off"
          spellCheck="false"
          aria-label="Universal ERP search"
          placeholder={placeholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleInputKey}
        />
        {loading && (
          <span className="uvs-input-spinner" aria-hidden="true">
            <i className="fa-solid fa-circle-notch fa-spin"></i>
          </span>
        )}
        {hasQuery && !loading && (
          <Tooltip text="Clear search (Esc)">
            <button
              type="button"
              className="uvs-input-clear"
              onClick={() => { clear(); inputRef.current?.focus(); }}
              aria-label="Clear search"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </Tooltip>
        )}
        <span className="uvs-input-kbd" aria-hidden="true">⌘K</span>
      </div>

      {open && createPortal(
        <div
          ref={panelRef}
          className={`uvs-panel${mobile ? ' uvs-panel--mobile' : ''}`}
          style={{ top: panelStyle.top, left: panelStyle.left, width: panelStyle.width }}
          role="listbox"
          aria-labelledby={inputId}
        >
          {/* ─── EMPTY-QUERY STATE: Recent / Suggested / Popular ─── */}
          {!hasQuery && (
            <div className="uvs-empty-state">
              {recentSearches.length > 0 && (
                <section className="uvs-sec">
                  <div className="uvs-sec-h">
                    <span className="uvs-sec-t">
                      <i className="fa-solid fa-clock-rotate-left" aria-hidden="true"></i> Recent Searches
                    </span>
                    <Tooltip text="Clear recent searches">
                      <button type="button" className="uvs-sec-clear" onClick={clearRecents}>Clear</button>
                    </Tooltip>
                  </div>
                  <div className="uvs-chips">
                    {recentSearches.map(q => (
                      <button
                        key={q}
                        type="button"
                        className="uvs-chip"
                        onClick={() => { submit(q); inputRef.current?.focus(); }}
                      >
                        <i className="fa-solid fa-arrow-rotate-left" aria-hidden="true"></i> {q}
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <section className="uvs-sec">
                <div className="uvs-sec-h">
                  <span className="uvs-sec-t">
                    <i className="fa-solid fa-lightbulb" aria-hidden="true"></i> Suggested
                  </span>
                </div>
                <div className="uvs-chips">
                  {suggestedSearches.map(q => (
                    <button
                      key={q}
                      type="button"
                      className="uvs-chip"
                      onClick={() => { submit(q); inputRef.current?.focus(); }}
                    >
                      <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> {q}
                    </button>
                  ))}
                </div>
              </section>
              <section className="uvs-sec">
                <div className="uvs-sec-h">
                  <span className="uvs-sec-t">
                    <i className="fa-solid fa-fire" aria-hidden="true"></i> Popular Searches
                  </span>
                </div>
                <div className="uvs-chips">
                  {popularSearches.map(q => (
                    <button
                      key={q}
                      type="button"
                      className="uvs-chip uvs-chip--ghost"
                      onClick={() => { submit(q); inputRef.current?.focus(); }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </section>
              <div className="uvs-foot">
                <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
                <span><kbd>↵</kbd> open</span>
                <span><kbd>Esc</kbd> close</span>
              </div>
            </div>
          )}

          {/* ─── LOADING ─── */}
          {hasQuery && loading && visibleResults.length === 0 && (
            <div className="uvs-loading">
              <i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
              <span>Searching the ERP…</span>
            </div>
          )}

          {/* ─── NO RESULTS ─── */}
          {hasQuery && !loading && totalCount === 0 && (
            <div className="uvs-noresult">
              <div className="uvs-noresult-ic"><i className="fa-solid fa-magnifying-glass-minus" aria-hidden="true"></i></div>
              <div className="uvs-noresult-t">No matching results found.</div>
              <div className="uvs-noresult-s">
                Try one of these:
              </div>
              <ul className="uvs-noresult-tips">
                <li>Check spelling — the search is forgiving but not psychic.</li>
                <li>Try different keywords or a registration / contact number.</li>
                <li>Search another module from the sidebar.</li>
              </ul>
            </div>
          )}

          {/* ─── GROUPED RESULTS ─── */}
          {hasQuery && totalCount > 0 && (
            <div className="uvs-results">
              <div className="uvs-results-h">
                <span className="uvs-results-count">{totalCount} result{totalCount === 1 ? '' : 's'}</span>
                <span className="uvs-results-q">for “{query}”</span>
              </div>
              {grouped.map(g => (
                <section className="uvs-group" key={g.moduleId}>
                  <div className="uvs-group-h">
                    <span className="uvs-group-ic" style={{ background: hexToBgTint(g.accent), color: g.accent }}>
                      <i className={`fa-solid ${g.icon}`} aria-hidden="true"></i>
                    </span>
                    <span className="uvs-group-t">{g.moduleLabel}</span>
                    <span className="uvs-group-c">{g.results.length} Result{g.results.length === 1 ? '' : 's'}</span>
                  </div>
                  <ul className="uvs-group-list" role="presentation">
                    {g.results.map((r) => {
                      const flatIdx = visibleResults.findIndex(x => x.moduleId === r.moduleId && x.id === r.id);
                      const isActive = flatIdx === activeIndex;
                      return (
                        <li
                          key={`${r.moduleId}-${r.id}`}
                          className={`uvs-row${isActive ? ' is-active' : ''}`}
                          role="option"
                          aria-selected={isActive}
                          onMouseEnter={() => flatIdx >= 0 && setActiveIndex(flatIdx)}
                          onClick={() => handleSelect(r)}
                        >
                          <span className="uvs-row-ic" style={{ background: hexToBgTint(g.accent), color: g.accent }}>
                            <i className={`fa-solid ${r.icon || g.icon}`} aria-hidden="true"></i>
                          </span>
                          <span className="uvs-row-main">
                            <span className="uvs-row-t">{highlight(r.title, query)}</span>
                            {r.subtitle && <span className="uvs-row-s">{r.subtitle}</span>}
                            {(r.path && r.path.length > 0) && (
                              <span className="uvs-row-p">
                                {r.path.map((p, i) => (
                                  <React.Fragment key={i}>
                                    {i > 0 && <i className="fa-solid fa-chevron-right uvs-row-p-sep" aria-hidden="true"></i>}
                                    <span>{p}</span>
                                  </React.Fragment>
                                ))}
                              </span>
                            )}
                            {r.preview && <span className="uvs-row-pv">{r.preview}</span>}
                          </span>
                          <span className="uvs-row-mod">{g.moduleLabel}</span>
                          <i className="fa-solid fa-arrow-right uvs-row-go" aria-hidden="true"></i>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
              <div className="uvs-foot">
                <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
                <span><kbd>↵</kbd> open</span>
                <span><kbd>Esc</kbd> close</span>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

/* ─── helpers ─────────────────────────────────────────────────── */
function hexToBgTint(hex) {
  /* Cheap tint: hex → rgba(.,.,.,.12). Falls back to brand if parse fails. */
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return 'rgba(30, 64, 175, .12)';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, .12)`;
}
function highlight(text, query) {
  if (!text || !query) return text || '';
  const q = query.trim();
  if (!q) return text;
  const lc = text.toLowerCase();
  const idx = lc.indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="uvs-hi">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

/* ─── One-time stylesheet (mirrors the Tooltip pattern) ───────── */
if (typeof document !== 'undefined' && !document.getElementById('uvs-style')) {
  const el = document.createElement('style');
  el.id = 'uvs-style';
  el.textContent = `
.uvs-wrap {
  position: relative;
  width: 100%;
  max-width: 560px;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}
.uvs-input-wrap {
  position: relative;
  display: flex; align-items: center;
  height: 42px;
  background: var(--bg-card, #FFFFFF);
  border: 1.5px solid var(--border-light, #BFDBFE);
  border-radius: 999px;
  transition: all .15s;
}
.uvs-wrap--compact .uvs-input-wrap { height: 36px; }
.uvs-input-wrap:hover  { border-color: var(--border-med, #93C5FD); }
.uvs-input-wrap:focus-within {
  border-color: var(--brand-primary, #1E40AF);
  box-shadow: 0 0 0 4px rgba(30, 64, 175, .12);
}
.uvs-input-ic {
  position: absolute; left: 16px; top: 50%; transform: translateY(-50%);
  font-size: 13px; color: var(--text-muted, #64748B);
  pointer-events: none;
}
.uvs-input {
  flex: 1; min-width: 0;
  height: 100%;
  padding: 0 96px 0 42px;
  background: transparent;
  border: none; outline: none;
  font: 600 13px/1 'Plus Jakarta Sans', system-ui, sans-serif;
  color: var(--text-primary, #0F172A);
  letter-spacing: -.005em;
}
.uvs-input::placeholder { color: var(--text-muted, #94A3B8); font-weight: 500; }
.uvs-input::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; }
.uvs-input-spinner {
  position: absolute; right: 64px; top: 50%; transform: translateY(-50%);
  color: var(--brand-primary, #1E40AF); font-size: 12px;
}
.uvs-input-clear {
  position: absolute; right: 56px; top: 50%; transform: translateY(-50%);
  width: 22px; height: 22px;
  border: none; background: var(--bg-muted, #EFF6FF);
  color: var(--text-muted, #64748B);
  border-radius: 50%; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 10px;
  transition: all .15s;
}
.uvs-input-clear:hover { background: var(--brand-light, #DBEAFE); color: var(--brand-primary, #1E40AF); }
.uvs-input-kbd {
  position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
  display: inline-flex; align-items: center; justify-content: center;
  height: 22px; padding: 0 7px;
  background: var(--bg-muted, #EFF6FF);
  border: 1px solid var(--border-light, #BFDBFE);
  border-radius: 6px;
  font: 800 10px/1 'Plus Jakarta Sans', system-ui, sans-serif;
  color: var(--text-muted, #64748B);
  letter-spacing: .03em;
}

/* ─── Portal panel ─── */
.uvs-panel {
  position: fixed;
  z-index: 9990;
  max-height: 70vh;
  background: var(--bg-card, #FFFFFF);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 14px;
  box-shadow: 0 20px 50px rgba(15, 23, 42, .14), 0 4px 12px rgba(15, 23, 42, .06);
  overflow: hidden;
  display: flex; flex-direction: column;
  animation: uvsIn .18s cubic-bezier(.4, 0, .2, 1);
}
.uvs-panel--mobile { max-height: 84vh; border-radius: 12px; }
@keyframes uvsIn {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ─── Empty state (recent / suggested / popular) ─── */
.uvs-empty-state { padding: 12px 14px 4px; overflow-y: auto; }
.uvs-sec { padding: 6px 0 10px; }
.uvs-sec + .uvs-sec { border-top: 1px dashed var(--border-light, #E2E8F0); margin-top: 6px; padding-top: 12px; }
.uvs-sec-h {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
.uvs-sec-t {
  display: inline-flex; align-items: center; gap: 7px;
  font: 800 11px/1 'Plus Jakarta Sans', system-ui, sans-serif;
  color: var(--text-muted, #64748B);
  text-transform: uppercase; letter-spacing: .55px;
}
.uvs-sec-t i { color: var(--brand-primary, #1E40AF); font-size: 11px; }
.uvs-sec-clear {
  background: transparent; border: none;
  font: 700 10.5px/1 'Plus Jakarta Sans', system-ui, sans-serif;
  color: var(--text-muted, #64748B); cursor: pointer;
  padding: 4px 8px; border-radius: 6px;
}
.uvs-sec-clear:hover { background: var(--bg-muted, #F1F5F9); color: var(--text-primary); }
.uvs-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.uvs-chip {
  display: inline-flex; align-items: center; gap: 6px;
  height: 28px; padding: 0 11px;
  background: var(--bg-muted, #F1F5F9);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 999px;
  font: 700 11.5px/1 'Plus Jakarta Sans', system-ui, sans-serif;
  color: var(--text-primary, #0F172A);
  cursor: pointer; transition: all .15s;
}
.uvs-chip i { color: var(--brand-primary, #1E40AF); font-size: 10px; }
.uvs-chip:hover {
  background: var(--brand-light, #DBEAFE);
  border-color: var(--brand-primary, #1E40AF);
}
.uvs-chip--ghost {
  background: var(--bg-card, #fff);
  color: var(--text-secondary, #475569);
}

/* ─── Loading / no results ─── */
.uvs-loading {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  padding: 28px 16px;
  color: var(--text-muted, #64748B);
  font: 600 12.5px/1 'Plus Jakarta Sans', system-ui, sans-serif;
}
.uvs-loading i { color: var(--brand-primary, #1E40AF); font-size: 14px; }

.uvs-noresult { padding: 24px 22px; text-align: center; }
.uvs-noresult-ic {
  width: 48px; height: 48px; margin: 0 auto 10px;
  border-radius: 50%;
  background: var(--bg-muted, #F1F5F9);
  color: var(--text-muted, #64748B);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 18px;
}
.uvs-noresult-t {
  font: 800 14px/1.2 'Plus Jakarta Sans', system-ui, sans-serif;
  color: var(--text-primary);
  margin-bottom: 4px;
}
.uvs-noresult-s {
  font: 500 12px/1.4 'Plus Jakarta Sans', system-ui, sans-serif;
  color: var(--text-muted, #64748B);
  margin-bottom: 10px;
}
.uvs-noresult-tips {
  text-align: left;
  margin: 0 auto; padding-left: 18px; max-width: 320px;
  font: 500 11.5px/1.6 'Plus Jakarta Sans', system-ui, sans-serif;
  color: var(--text-secondary, #475569);
}

/* ─── Results list ─── */
.uvs-results { display: flex; flex-direction: column; overflow: hidden; }
.uvs-results-h {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px 8px;
  border-bottom: 1px solid var(--border-light, #E2E8F0);
  background: linear-gradient(180deg, rgba(30, 64, 175, .04), transparent);
}
.uvs-results-count {
  font: 800 11.5px/1 'Plus Jakarta Sans', system-ui, sans-serif;
  color: var(--brand-primary, #1E40AF);
  letter-spacing: -.005em;
}
.uvs-results-q {
  font: 600 11px/1 'Plus Jakarta Sans', system-ui, sans-serif;
  color: var(--text-muted, #64748B);
  max-width: 60%;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.uvs-results { overflow-y: auto; }

.uvs-group { padding: 6px 0 4px; }
.uvs-group-h {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px 4px;
}
.uvs-group-ic {
  width: 22px; height: 22px; border-radius: 6px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px;
}
.uvs-group-t {
  font: 800 11px/1 'Plus Jakarta Sans', system-ui, sans-serif;
  color: var(--text-primary);
  text-transform: uppercase; letter-spacing: .5px;
}
.uvs-group-c {
  margin-left: auto;
  font: 700 10.5px/1 'Plus Jakarta Sans', system-ui, sans-serif;
  color: var(--text-muted, #64748B);
  padding: 3px 8px; border-radius: 999px;
  background: var(--bg-muted, #F1F5F9);
  border: 1px solid var(--border-light, #E2E8F0);
}
.uvs-group-list {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column;
}
.uvs-row {
  display: grid;
  grid-template-columns: 32px 1fr auto 16px;
  align-items: center;
  gap: 11px;
  padding: 9px 16px;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background .12s, border-color .12s;
}
.uvs-row:hover, .uvs-row.is-active {
  background: var(--bg-muted, #F8FAFF);
  border-left-color: var(--brand-primary, #1E40AF);
}
.uvs-row-ic {
  width: 32px; height: 32px;
  border-radius: 9px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
}
.uvs-row-main {
  display: flex; flex-direction: column; min-width: 0;
}
.uvs-row-t {
  font: 700 13px/1.2 'Plus Jakarta Sans', system-ui, sans-serif;
  color: var(--text-primary);
  letter-spacing: -.005em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.uvs-row-s {
  font: 500 11.5px/1.3 'Plus Jakarta Sans', system-ui, sans-serif;
  color: var(--text-muted, #64748B);
  margin-top: 1px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.uvs-row-p {
  display: inline-flex; align-items: center; flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
  font: 600 10.5px/1.2 'Plus Jakarta Sans', system-ui, sans-serif;
  color: var(--brand-primary, #1E40AF);
}
.uvs-row-p span { white-space: nowrap; }
.uvs-row-p-sep { font-size: 8px; opacity: .6; color: var(--text-muted, #94A3B8); }
.uvs-row-pv {
  font: 500 11px/1.4 'Plus Jakarta Sans', system-ui, sans-serif;
  color: var(--text-muted, #64748B);
  margin-top: 3px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-style: italic;
}
.uvs-row-mod {
  font: 700 9.5px/1 'Plus Jakarta Sans', system-ui, sans-serif;
  color: var(--text-muted, #64748B);
  text-transform: uppercase; letter-spacing: .4px;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--bg-muted, #F1F5F9);
  border: 1px solid var(--border-light, #E2E8F0);
  white-space: nowrap;
}
.uvs-row-go { color: var(--text-muted, #94A3B8); font-size: 11px; }
.uvs-row:hover .uvs-row-go, .uvs-row.is-active .uvs-row-go {
  color: var(--brand-primary, #1E40AF);
}

.uvs-hi {
  background: rgba(255, 217, 102, .55);
  color: inherit;
  padding: 0 1px;
  border-radius: 3px;
}

.uvs-foot {
  display: flex; align-items: center; justify-content: center; gap: 14px;
  padding: 9px 12px;
  border-top: 1px solid var(--border-light, #E2E8F0);
  background: var(--bg-muted, #F8FAFF);
  font: 600 10.5px/1 'Plus Jakarta Sans', system-ui, sans-serif;
  color: var(--text-muted, #64748B);
}
.uvs-foot kbd {
  display: inline-flex; align-items: center; justify-content: center;
  height: 17px; padding: 0 5px; margin-right: 3px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-bottom-width: 2px;
  border-radius: 4px;
  font: 700 9.5px/1 'Plus Jakarta Sans', system-ui, sans-serif;
  color: var(--text-secondary, #475569);
}

/* ─── Responsive: hide kbd shortcut + slim input on mobile ─── */
@media (max-width: 720px) {
  .uvs-wrap { max-width: 100%; }
  .uvs-input { padding-right: 40px; }
  .uvs-input-kbd { display: none; }
  .uvs-input-clear { right: 12px; }
  .uvs-input-spinner { right: 12px; }
  .uvs-row { grid-template-columns: 28px 1fr 16px; }
  .uvs-row-mod { display: none; }
}

/* ─── DARK MODE ──────────────────────────────────────────────────
   Explicit hex values throughout (no var() chains) so the dark theme
   applies even if CSS variable resolution is delayed by mount order.
   Selectors are scoped via the .uvs-wrap parent where useful to bump
   specificity above the base rules. */
[data-theme="dark"] .uvs-wrap                 { color-scheme: dark; }

[data-theme="dark"] .uvs-wrap .uvs-input-wrap {
  background: #0E1628;
  border-color: #1C2E50;
}
[data-theme="dark"] .uvs-wrap .uvs-input-wrap:hover {
  border-color: #243858;
}
[data-theme="dark"] .uvs-wrap .uvs-input-wrap:focus-within {
  border-color: #3B82F6;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, .22);
}
[data-theme="dark"] .uvs-wrap .uvs-input        { color: #E2E8F8; }
[data-theme="dark"] .uvs-wrap .uvs-input::placeholder { color: #6B82A8; opacity: 1; }
[data-theme="dark"] .uvs-wrap .uvs-input-ic     { color: #6B82A8; }
[data-theme="dark"] .uvs-wrap .uvs-input-clear  {
  background: #131F38;
  color: #94A3B8;
}
[data-theme="dark"] .uvs-wrap .uvs-input-clear:hover {
  background: rgba(59, 130, 246, .20);
  color: #93C5FD;
}
[data-theme="dark"] .uvs-wrap .uvs-input-spinner { color: #93C5FD; }
[data-theme="dark"] .uvs-wrap .uvs-input-kbd {
  background: #131F38;
  border-color: #1C2E50;
  color: #94A3B8;
}

[data-theme="dark"] .uvs-panel {
  background: #0E1628;
  border-color: #1C2E50;
  box-shadow: 0 20px 50px rgba(0, 0, 0, .60), 0 4px 12px rgba(0, 0, 0, .40);
  color: #E2E8F8;
  color-scheme: dark;
}
[data-theme="dark"] .uvs-panel .uvs-sec + .uvs-sec { border-top-color: #1C2E50; }
[data-theme="dark"] .uvs-panel .uvs-sec-t          { color: #94A3B8; }
[data-theme="dark"] .uvs-panel .uvs-sec-t i        { color: #93C5FD; }
[data-theme="dark"] .uvs-panel .uvs-sec-clear      { color: #94A3B8; }
[data-theme="dark"] .uvs-panel .uvs-sec-clear:hover {
  background: #131F38;
  color: #E2E8F8;
}
[data-theme="dark"] .uvs-panel .uvs-chip {
  background: #131F38;
  border-color: #1C2E50;
  color: #E2E8F8;
}
[data-theme="dark"] .uvs-panel .uvs-chip i         { color: #93C5FD; }
[data-theme="dark"] .uvs-panel .uvs-chip:hover     {
  background: rgba(59, 130, 246, .18);
  border-color: #3B82F6;
}
[data-theme="dark"] .uvs-panel .uvs-chip--ghost    {
  background: #0E1628;
  color: #B8C8E8;
}

[data-theme="dark"] .uvs-panel .uvs-loading        { color: #94A3B8; }
[data-theme="dark"] .uvs-panel .uvs-loading i      { color: #93C5FD; }
[data-theme="dark"] .uvs-panel .uvs-noresult-ic    {
  background: #131F38;
  color: #94A3B8;
}
[data-theme="dark"] .uvs-panel .uvs-noresult-t     { color: #E2E8F8; }
[data-theme="dark"] .uvs-panel .uvs-noresult-s,
[data-theme="dark"] .uvs-panel .uvs-noresult-tips  { color: #94A3B8; }

[data-theme="dark"] .uvs-panel .uvs-results-h {
  background: linear-gradient(180deg, rgba(59, 130, 246, .10), transparent);
  border-bottom-color: #1C2E50;
}
[data-theme="dark"] .uvs-panel .uvs-results-count  { color: #93C5FD; }
[data-theme="dark"] .uvs-panel .uvs-results-q      { color: #94A3B8; }
[data-theme="dark"] .uvs-panel .uvs-group-t        { color: #E2E8F8; }
[data-theme="dark"] .uvs-panel .uvs-group-c {
  background: #131F38;
  border-color: #1C2E50;
  color: #94A3B8;
}
[data-theme="dark"] .uvs-panel .uvs-row:hover,
[data-theme="dark"] .uvs-panel .uvs-row.is-active {
  background: rgba(59, 130, 246, .12);
  border-left-color: #3B82F6;
}
[data-theme="dark"] .uvs-panel .uvs-row-t          { color: #E2E8F8; }
[data-theme="dark"] .uvs-panel .uvs-row-s,
[data-theme="dark"] .uvs-panel .uvs-row-pv         { color: #94A3B8; }
[data-theme="dark"] .uvs-panel .uvs-row-p          { color: #93C5FD; }
[data-theme="dark"] .uvs-panel .uvs-row-p-sep      { color: #6B82A8; }
[data-theme="dark"] .uvs-panel .uvs-row-mod {
  background: #131F38;
  border-color: #1C2E50;
  color: #94A3B8;
}
[data-theme="dark"] .uvs-panel .uvs-row-go         { color: #6B82A8; }
[data-theme="dark"] .uvs-panel .uvs-row:hover .uvs-row-go,
[data-theme="dark"] .uvs-panel .uvs-row.is-active .uvs-row-go { color: #93C5FD; }
[data-theme="dark"] .uvs-panel .uvs-hi {
  background: rgba(252, 211, 77, .28);
  color: #FDE68A;
}
[data-theme="dark"] .uvs-panel .uvs-foot {
  background: #131F38;
  border-top-color: #1C2E50;
  color: #94A3B8;
}
[data-theme="dark"] .uvs-panel .uvs-foot kbd {
  background: #0E1628;
  border-color: #1C2E50;
  color: #B8C8E8;
}
  `;
  document.head.appendChild(el);
}
