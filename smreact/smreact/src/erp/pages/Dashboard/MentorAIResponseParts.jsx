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

export function MetricRow({ metrics }) {
  if (!metrics || metrics.length === 0) return null;
  return (
    <div className="mai-metrics">
      {metrics.map((m, i) => (
        <div className="mai-metric" key={i}>
          <div className="mai-metric-label">{m.label}</div>
          <div className="mai-metric-value" style={{ color: TONE_COLOR[m.tone] || TONE_COLOR.neutral }}>
            {m.value}
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
