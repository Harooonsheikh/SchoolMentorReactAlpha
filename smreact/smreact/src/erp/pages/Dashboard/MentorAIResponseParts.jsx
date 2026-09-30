import React from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
} from 'recharts';

/* ═══════════════════════════════════════════════════════════════════
   MentorAIResponseParts — small, reusable pieces MentorAIResponse.jsx
   composes to render a structured AI answer. Kept together in one
   file (rather than one-file-per-part) since each piece is a handful
   of lines — matches the "don't over-fragment" guidance while still
   keeping each concept separately named and testable.

   Styling: all classes use the `mai-*` prefix; the stylesheet itself
   is injected once by MentorAISearchBar.jsx (the feature's entry
   point), mirroring the pattern UniversalSearch.jsx already uses for
   its own `uvs-*` styles.
   ═══════════════════════════════════════════════════════════════════ */

const TONE_COLOR = {
  good: 'var(--success, #16A34A)',
  bad: 'var(--error, #DC2626)',
  neutral: 'var(--text-primary, #0F172A)',
};

export function TrendIndicator({ trend, compact = false }) {
  if (!trend || trend === 'flat') {
    return (
      <span className="mai-trend mai-trend--flat">
        <i className="fa-solid fa-arrow-right" aria-hidden="true" /> {!compact && 'Stable'}
      </span>
    );
  }
  if (trend === 'up') {
    return (
      <span className="mai-trend mai-trend--up">
        <i className="fa-solid fa-arrow-up" aria-hidden="true" /> {!compact && 'Improved'}
      </span>
    );
  }
  return (
    <span className="mai-trend mai-trend--down">
      <i className="fa-solid fa-arrow-down" aria-hidden="true" /> {!compact && 'Declined'}
    </span>
  );
}

/* AnimatedNumber — counts up from 0 to the numeric part of `value` on
   mount (Total Students: 86, Attendance: 93.2%, Pending Fees: Rs.
   486,000, …), preserving whatever prefix/suffix/comma-formatting the
   value already had. Values with no digits at all (a letter grade
   like "A", a word like "Improving") are rendered as plain, static
   text — nothing to count, so nothing is animated. Purely a display
   effect: the actual `value` string driving it is untouched, still
   whatever the response data already computed. */
const NUMBER_SHAPE_RE = /^([^\d]*)([\d,]*\d(?:\.\d+)?)([^\d]*)$/;
const ANIMATED_NUMBER_MS = 900;

export function AnimatedNumber({ value }) {
  const text = String(value ?? '');
  const match = text.match(NUMBER_SHAPE_RE);
  const [display, setDisplay] = React.useState(match ? text : text);
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  React.useEffect(() => {
    if (!match || reduceMotion) { setDisplay(text); return undefined; }
    const [, prefix, numStr, suffix] = match;
    const target = Number(numStr.replace(/,/g, ''));
    const decimals = numStr.includes('.') ? numStr.split('.')[1].length : 0;
    const useGrouping = numStr.includes(',');
    if (!Number.isFinite(target)) { setDisplay(text); return undefined; }
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / ANIMATED_NUMBER_MS);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const current = target * eased;
      const formatted = current.toLocaleString('en-US', {
        minimumFractionDigits: decimals, maximumFractionDigits: decimals,
        useGrouping,
      });
      setDisplay(`${prefix}${formatted}${suffix}`);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return <>{display}</>;
}

export function MetricRow({ metrics }) {
  if (!metrics || metrics.length === 0) return null;
  return (
    <div className="mai-metrics">
      {metrics.map((m, i) => (
        <div className="mai-metric" key={i}>
          <div className="mai-metric-label">{m.label}</div>
          <div className="mai-metric-value" style={{ color: TONE_COLOR[m.tone] || TONE_COLOR.neutral }}>
            <AnimatedNumber value={m.value} />
            {m.trend && <TrendIndicator trend={m.trend} compact />}
          </div>
          {m.sub && <div className="mai-metric-sub">{m.sub}</div>}
        </div>
      ))}
    </div>
  );
}

export function FieldsBlock({ title, icon, items }) {
  return (
    <section className="mai-sec">
      <SecHeader title={title} icon={icon} />
      <div className="mai-fields">
        {items.map((f, i) => (
          <div className="mai-field" key={i}>
            <span className="mai-field-l">{f.label}</span>
            <span className="mai-field-v">{f.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ExamTable({ title, icon, rows }) {
  return (
    <section className="mai-sec">
      <SecHeader title={title} icon={icon} />
      <div className="mai-table-wrap">
        <table className="mai-table">
          <thead>
            <tr><th>Examination</th><th>Marks</th><th>Percentage</th><th>Trend</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.exam}</td>
                <td>{r.marks}</td>
                <td><b>{r.pct}%</b></td>
                <td><TrendIndicator trend={r.trend} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function SubjectTable({ title, icon, rows }) {
  return (
    <section className="mai-sec">
      <SecHeader title={title} icon={icon} />
      <div className="mai-table-wrap">
        <table className="mai-table">
          <thead>
            <tr><th>Subject</th><th>Previous</th><th>Current</th><th>Change</th><th>Trend</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const delta = r.current - r.previous;
              return (
                <tr key={i}>
                  <td>{r.subject}</td>
                  <td>{r.previous}%</td>
                  <td><b>{r.current}%</b></td>
                  <td style={{ color: delta > 0 ? TONE_COLOR.good : delta < 0 ? TONE_COLOR.bad : TONE_COLOR.neutral }}>
                    {delta > 0 ? '+' : ''}{delta}
                  </td>
                  <td><TrendIndicator trend={r.trend} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function DataTable({ title, icon, columns, rows }) {
  return (
    <section className="mai-sec">
      <SecHeader title={title} icon={icon} />
      <div className="mai-table-wrap">
        <table className="mai-table">
          <thead>
            <tr>{columns.map((c, i) => <th key={i}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>{r.map((cell, j) => <td key={j}>{j === 0 ? <b>{cell}</b> : cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const LIST_VARIANT = {
  strengths:       { color: 'var(--success, #16A34A)', bg: 'rgba(22,163,74,.08)',  glyph: 'fa-circle-check' },
  attention:       { color: 'var(--warning, #D97706)', bg: 'rgba(217,119,6,.08)',  glyph: 'fa-triangle-exclamation' },
  alerts:          { color: 'var(--error, #DC2626)',   bg: 'rgba(220,38,38,.08)',  glyph: 'fa-triangle-exclamation' },
  recommendations: { color: 'var(--brand-primary, #1E40AF)', bg: 'rgba(30,64,175,.06)', glyph: 'fa-list-check' },
  actions:         { color: 'var(--brand-primary, #1E40AF)', bg: 'rgba(30,64,175,.06)', glyph: 'fa-list-check' },
};

export function ListSection({ title, icon, variant = 'recommendations', items }) {
  if (!items || items.length === 0) return null;
  const v = LIST_VARIANT[variant] || LIST_VARIANT.recommendations;
  return (
    <section className="mai-sec">
      <SecHeader title={title} icon={icon} />
      <ul className="mai-list" style={{ background: v.bg }}>
        {items.map((it, i) => (
          <li key={i}>
            <i className={`fa-solid ${v.glyph}`} style={{ color: v.color }} aria-hidden="true" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function InsightCard({ text }) {
  if (!text) return null;
  return (
    <section className="mai-insight">
      <div className="mai-insight-ic"><i className="fa-solid fa-lightbulb" aria-hidden="true" /></div>
      <div>
        <div className="mai-insight-t">AI Insight</div>
        <div className="mai-insight-txt">{text}</div>
      </div>
    </section>
  );
}

const CHART_COMPONENTS = { area: AreaChart, bar: BarChart, line: LineChart };

export function AIChart({ title, chartType = 'area', xKey, series, data }) {
  const ChartComp = CHART_COMPONENTS[chartType] || AreaChart;
  return (
    <section className="mai-sec">
      <SecHeader title={title} icon="fa-chart-line" />
      <div className="mai-chart-card">
        <ResponsiveContainer width="100%" height={180}>
          <ChartComp data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
            <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
            <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
            <RTooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E2E8F0' }} />
            {series.map(s => {
              if (chartType === 'bar') return <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[6, 6, 0, 0]} />;
              if (chartType === 'line') return <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.2} dot={{ r: 3, stroke: s.color, fill: '#fff', strokeWidth: 2 }} />;
              return <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.2} fill={s.color} fillOpacity={0.16} dot={{ r: 3, stroke: s.color, fill: '#fff', strokeWidth: 2 }} />;
            })}
          </ChartComp>
        </ResponsiveContainer>
        {series.length > 1 && (
          <div className="mai-chart-legend">
            {series.map(s => (
              <span key={s.key} className="mai-chart-legend-i">
                <span className="mai-chart-legend-dot" style={{ background: s.color }} />{s.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function ResponseActions({ onDownloadPdf, onPrint, onCopy, onFollowUp, copied }) {
  return (
    <div className="mai-actions">
      <button type="button" className="mai-action-btn" onClick={onDownloadPdf}>
        <i className="fa-solid fa-file-arrow-down" aria-hidden="true" /> Download PDF
      </button>
      <button type="button" className="mai-action-btn" onClick={onPrint}>
        <i className="fa-solid fa-print" aria-hidden="true" /> Print
      </button>
      <button type="button" className="mai-action-btn" onClick={onCopy}>
        <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`} aria-hidden="true" /> {copied ? 'Copied' : 'Copy Summary'}
      </button>
      {onFollowUp && (
        <button type="button" className="mai-action-btn mai-action-btn--primary" onClick={onFollowUp}>
          <i className="fa-solid fa-arrow-turn-up" aria-hidden="true" /> Ask Follow-up
        </button>
      )}
    </div>
  );
}

export function LoadingState({ label = 'Mentor AI is analyzing your school data…' }) {
  return (
    <div className="mai-loading">
      <span className="mai-loading-spin"><i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true" /></span>
      <span>{label}</span>
    </div>
  );
}

/* AgentProgress — the "agentic" working animation: steps light up on a
   fixed cadence, independent of when the real (mock) service call
   resolves. MentorAIPanel awaits Promise.all([askMentorAI(...), a
   minimum-duration timer]) so this always plays out fully at least once. */
const AGENT_STEP_MS = 550;

/* Ambient "AI is thinking" phrases — purely cosmetic flavor text shown
   ABOVE the real, category-specific step list (which still comes
   unchanged from mentorAiService.stepsForQuery below). Rotates on its
   own cadence so it doesn't have to line up 1:1 with the real steps. */
const AGENT_AMBIENT_PHRASES = ['Analyzing school data…', 'Checking ERP records…', 'Finding relevant insights…', 'Preparing your report…'];
const AGENT_AMBIENT_MS = 900;

export function AgentProgress({ steps }) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [ambientIndex, setAmbientIndex] = React.useState(0);

  React.useEffect(() => {
    setActiveIndex(0);
    if (!steps || steps.length <= 1) return undefined;
    const id = setInterval(() => {
      setActiveIndex((i) => (i < steps.length - 1 ? i + 1 : i));
    }, AGENT_STEP_MS);
    return () => clearInterval(id);
  }, [steps]);

  React.useEffect(() => {
    setAmbientIndex(0);
    const id = setInterval(() => {
      setAmbientIndex((i) => (i + 1) % AGENT_AMBIENT_PHRASES.length);
    }, AGENT_AMBIENT_MS);
    return () => clearInterval(id);
  }, [steps]);

  if (!steps || steps.length === 0) return <LoadingState />;

  return (
    <div className="mai-agent">
      <div className="mai-agent-h">
        <span className="mai-agent-h-ic"><i className="fa-solid fa-robot" aria-hidden="true" /></span>
        <span>Mentor AI Agent is working…</span>
      </div>
      <div className="mai-agent-ambient">
        <span className="mai-agent-ambient-txt" key={ambientIndex}>{AGENT_AMBIENT_PHRASES[ambientIndex]}</span>
        <span className="mai-agent-dots" aria-hidden="true"><span /><span /><span /></span>
      </div>
      <ul className="mai-agent-steps">
        {steps.map((label, i) => {
          const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending';
          return (
            <li key={label} className={`mai-agent-step mai-agent-step--${state}`}>
              <span className="mai-agent-step-ic">
                {state === 'done' && <i className="fa-solid fa-check" aria-hidden="true" />}
                {state === 'active' && <i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true" />}
                {state === 'pending' && <i className="fa-regular fa-circle" aria-hidden="true" />}
              </span>
              <span>{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ExportMenu — the top-right "Export" dropdown (PDF / Excel / Word) on
   every response card. Shows a brief "Generating…" state before the
   file (or print dialog, for PDF) actually fires. Positioned in the
   response header, next to the title — Copy/Follow-up remain a
   separate bottom row (see SecondaryActions below). */
export function ExportMenu({ onExport }) {
  const [open, setOpen] = React.useState(false);
  const [generating, setGenerating] = React.useState(null); // 'pdf' | 'excel' | 'word' | null
  const wrapRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const runExport = (format) => {
    setOpen(false);
    setGenerating(format);
    setTimeout(() => {
      onExport?.(format);
      setGenerating(null);
    }, 350);
  };

  return (
    <div className="mai-export" ref={wrapRef}>
      <button type="button" className="mai-export-btn" onClick={() => setOpen((o) => !o)} disabled={!!generating}>
        {generating ? (
          <><i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true" /> Generating {generating.toUpperCase()}…</>
        ) : (
          <><i className="fa-solid fa-file-export" aria-hidden="true" /> Export <i className="fa-solid fa-chevron-down mai-export-caret" aria-hidden="true" /></>
        )}
      </button>
      {open && (
        <div className="mai-export-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => runExport('pdf')}><i className="fa-solid fa-file-pdf" aria-hidden="true" /> PDF</button>
          <button type="button" role="menuitem" onClick={() => runExport('excel')}><i className="fa-solid fa-file-excel" aria-hidden="true" /> Excel</button>
          <button type="button" role="menuitem" onClick={() => runExport('word')}><i className="fa-solid fa-file-word" aria-hidden="true" /> Word</button>
        </div>
      )}
    </div>
  );
}

/* SecondaryActions — the bottom Copy Summary / Ask Follow-up row, kept
   separate from Export now that Export lives top-right on the card. */
export function SecondaryActions({ onCopy, onFollowUp, copied }) {
  return (
    <div className="mai-actions">
      <button type="button" className="mai-action-btn" onClick={onCopy}>
        <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`} aria-hidden="true" /> {copied ? 'Copied' : 'Copy Summary'}
      </button>
      {onFollowUp && (
        <button type="button" className="mai-action-btn mai-action-btn--primary" onClick={onFollowUp}>
          <i className="fa-solid fa-arrow-turn-up" aria-hidden="true" /> Ask Follow-up
        </button>
      )}
    </div>
  );
}

export function ErrorPanel({ onRetry }) {
  return (
    <div className="mai-error">
      <div className="mai-error-ic"><i className="fa-solid fa-circle-exclamation" aria-hidden="true" /></div>
      <div className="mai-error-t">Mentor AI couldn't complete this analysis.</div>
      <div className="mai-error-s">Please try again.</div>
      {onRetry && (
        <button type="button" className="mai-error-retry" onClick={onRetry}>
          <i className="fa-solid fa-rotate-right" aria-hidden="true" /> Try Again
        </button>
      )}
    </div>
  );
}

function SecHeader({ title, icon }) {
  return (
    <div className="mai-sec-h">
      {icon && <i className={`fa-solid ${icon}`} aria-hidden="true" />}
      <span>{title}</span>
    </div>
  );
}
