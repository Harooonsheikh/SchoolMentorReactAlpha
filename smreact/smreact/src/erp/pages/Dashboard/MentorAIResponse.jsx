import React, { useState } from 'react';
import {
  MetricRow, FieldsBlock, ExamTable, SubjectTable, DataTable,
  ListSection, InsightCard, AIChart, ResponseActions,
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

      <div className="mai-response-title">{response.title}</div>
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

      <ResponseActions
        onDownloadPdf={handlePrint}
        onPrint={handlePrint}
        onCopy={handleCopy}
        onFollowUp={onFollowUp}
        copied={copied}
      />
    </div>
  );
}
