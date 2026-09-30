import React, { useState } from 'react';
import {
  MetricRow, FieldsBlock, ExamTable, SubjectTable, DataTable,
  ListSection, InsightCard, AIChart, ExportMenu, SecondaryActions,
} from './MentorAIResponseParts';

/* ═══════════════════════════════════════════════════════════════════
   MentorAIResponse — generic renderer for a structured Mentor AI
   answer. Maps `response.sections[].kind` to the matching part from
   MentorAIResponseParts, so every query type (student, teacher, fee,
   accounts, attendance, HR, natural-language) flows through the same
   component instead of one bespoke layout per domain.
   ═══════════════════════════════════════════════════════════════════ */

const SECTION_RENDERERS = {
  fields:       s => <FieldsBlock key={s.title} {...s} />,
  examTable:    s => <ExamTable key={s.title} {...s} />,
  subjectTable: s => <SubjectTable key={s.title} {...s} />,
  table:        s => <DataTable key={s.title} {...s} />,
  list:         s => <ListSection key={s.title} {...s} />,
  trendChart:   s => <AIChart key={s.title} {...s} />,
};

/* ─── Export helpers ───
   PDF reuses the existing window.print() + .mai-print-area flow
   (unchanged, already implemented/styled). Excel and Word both use the
   same dependency-free "HTML served with the right extension/MIME type"
   trick already established in Fee.jsx's downloadHtmlAsWord — copied
   here verbatim (Word) plus a new Excel twin, rather than pulling in a
   docx/xlsx generation library for a mock prototype. ─── */
function escapeHtml(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sectionToHtmlTable(s) {
  if (s.kind === 'table') {
    return `<h3>${escapeHtml(s.title)}</h3><table border="1" cellspacing="0" cellpadding="6">
      <tr>${s.columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr>
      ${s.rows.map(r => `<tr>${r.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
    </table>`;
  }
  if (s.kind === 'examTable') {
    return `<h3>${escapeHtml(s.title)}</h3><table border="1" cellspacing="0" cellpadding="6">
      <tr><th>Examination</th><th>Marks</th><th>Percentage</th></tr>
      ${s.rows.map(r => `<tr><td>${escapeHtml(r.exam)}</td><td>${escapeHtml(r.marks)}</td><td>${r.pct}%</td></tr>`).join('')}
    </table>`;
  }
  if (s.kind === 'subjectTable') {
    return `<h3>${escapeHtml(s.title)}</h3><table border="1" cellspacing="0" cellpadding="6">
      <tr><th>Subject</th><th>Previous</th><th>Current</th></tr>
      ${s.rows.map(r => `<tr><td>${escapeHtml(r.subject)}</td><td>${r.previous}%</td><td>${r.current}%</td></tr>`).join('')}
    </table>`;
  }
  if (s.kind === 'fields') {
    return `<h3>${escapeHtml(s.title)}</h3><table border="1" cellspacing="0" cellpadding="6">
      ${s.items.map(f => `<tr><td><b>${escapeHtml(f.label)}</b></td><td>${escapeHtml(f.value)}</td></tr>`).join('')}
    </table>`;
  }
  if (s.kind === 'list') {
    return `<h3>${escapeHtml(s.title)}</h3><ul>${(s.items || []).map(it => `<li>${escapeHtml(it)}</li>`).join('')}</ul>`;
  }
  return '';
}

function buildExportHtml(response, schoolName) {
  const metricsTable = response.metrics?.length
    ? `<h3>Key Metrics</h3><table border="1" cellspacing="0" cellpadding="6">
        <tr>${response.metrics.map(m => `<th>${escapeHtml(m.label)}</th>`).join('')}</tr>
        <tr>${response.metrics.map(m => `<td>${escapeHtml(m.value)}</td>`).join('')}</tr>
      </table>`
    : '';
  const sectionsHtml = (response.sections || []).map(sectionToHtmlTable).join('');
  const recsHtml = response.recommendations?.length
    ? `<h3>Recommended Actions</h3><ul>${response.recommendations.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>`
    : '';
  return `<html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;">
    <h1>${escapeHtml(schoolName || 'School Mentor ERP')}</h1>
    <h2>${escapeHtml(response.title)}</h2>
    <p>${escapeHtml(response.summary)}</p>
    ${response.query ? `<p><i>Query: "${escapeHtml(response.query)}"</i></p>` : ''}
    ${metricsTable}
    ${sectionsHtml}
    ${response.insight ? `<h3>AI Insight</h3><p>${escapeHtml(response.insight)}</p>` : ''}
    ${recsHtml}
  </body></html>`;
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob(['﻿', content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function MentorAIResponse({ response, schoolName, onFollowUp }) {
  const [copied, setCopied] = useState(false);

  if (!response) return null;

  const handlePrint = () => window.print();

  const handleCopy = async () => {
    const text = [
      response.title,
      response.summary,
      response.insight ? `AI Insight: ${response.insight}` : null,
      response.recommendations?.length ? `Recommended Actions:\n${response.recommendations.map(r => `• ${r}`).join('\n')}` : null,
    ].filter(Boolean).join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard permission denied — silently no-op, non-critical */
    }
  };

  const handleExport = (format) => {
    if (format === 'pdf') { handlePrint(); return; }
    const html = buildExportHtml(response, schoolName);
    const baseName = (response.title || 'Mentor AI Report').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_');
    if (format === 'word') downloadBlob(html, `${baseName}.doc`, 'application/msword');
    if (format === 'excel') downloadBlob(html, `${baseName}.xls`, 'application/vnd.ms-excel');
  };

  return (
    <div className="mai-response">
      <div className="mai-print-head">
        <div className="mai-print-school">{schoolName || 'School Mentor ERP'}</div>
        <div className="mai-print-meta">
          <span>Mentor AI Report</span>
          {response.query && <span>Query: “{response.query}”</span>}
          <span>Generated: {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      <div className="mai-response-head">
        <div className="mai-response-title">{response.title}</div>
        <ExportMenu onExport={handleExport} />
      </div>
      <p className="mai-response-summary">{response.summary}</p>

      <MetricRow metrics={response.metrics} />

      {(response.sections || []).map(s => SECTION_RENDERERS[s.kind]?.(s) || null)}

      <InsightCard text={response.insight} />

      <ListSection
        variant="recommendations"
        title="Recommended Actions"
        icon="fa-list-check"
        items={response.recommendations}
      />

      <SecondaryActions
        onCopy={handleCopy}
        onFollowUp={onFollowUp}
        copied={copied}
      />
    </div>
  );
}
