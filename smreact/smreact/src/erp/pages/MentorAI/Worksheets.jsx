import React, { useState } from 'react';
import * as mentorAiStudioService from '../../services/mentorAiStudioService';
import { GeneratingProgress, EditViaAIPanel, VersionBadge, AttachmentPicker, revokeAttachments, VoiceDictationButton } from './MentorAIShared';
import { HowItWorksButton } from './HowItWorks';
import {
  WS_CLASSES, WS_SUBJECTS, WS_TYPES, WS_DIFFICULTIES, WS_FORMATS, WS_COLOR_STYLES, WS_QUICK_EDITS,
  GENERATING_FACTS, GENERATING_STEPS,
} from './mentorAiStudioData';

/* ═══════════════════════════════════════════════════════════════════
   Worksheets — Worksheet Generator flow.
   Ported from the prototype's worksheet-step1 / step2 / loading /
   preview / edit / processing / result screens.
   ═══════════════════════════════════════════════════════════════════ */

export default function Worksheets({ toast, onConsumed }) {
  const [step, setStep] = useState('step1');
  const [form1, setForm1] = useState({ cls: WS_CLASSES[3], subject: WS_SUBJECTS[0], type: WS_TYPES[0].id });
  const [form2, setForm2] = useState({ difficulty: 'Easy', format: WS_FORMATS[0], colorStyle: WS_COLOR_STYLES[0], pages: 2, branding: true, instructions: '' });
  const [worksheet, setWorksheet] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [refImages, setRefImages] = useState([]);

  const reset = () => {
    revokeAttachments(refImages);
    setStep('step1'); setWorksheet(null); setEditing(false); setRefImages([]);
    setForm2(f => ({ ...f, instructions: '' }));
  };

  const addRefImage = (item) => setRefImages(prev => [...prev, item]);
  const removeRefImage = (id) => {
    setRefImages(prev => {
      const found = prev.find(im => im.id === id);
      if (found?.url) URL.revokeObjectURL(found.url);
      return prev.filter(im => im.id !== id);
    });
  };

  const runGenerate = async () => {
    setStep('generating'); setGenerating(true);
    try {
      const res = await mentorAiStudioService.generateWorksheet({
        cls: form1.cls, subject: form1.subject, type: WS_TYPES.find(t => t.id === form1.type)?.name,
        difficulty: form2.difficulty, format: form2.format, colorStyle: form2.colorStyle,
        pages: form2.pages, branding: form2.branding, instructions: form2.instructions,
      });
      setWorksheet(res); setStep('preview');
      onConsumed?.();
    } finally { setGenerating(false); }
  };

  return (
    <div className="msai-ws">
      {step !== 'step1' && (
        <button type="button" className="msai-back-link" onClick={() => (step === 'preview' ? reset() : setStep(step === 'step2' ? 'step1' : 'preview'))}>
          <i className="fa-solid fa-arrow-left" aria-hidden="true" /> {step === 'preview' ? 'Start Over' : 'Back'}
        </button>
      )}

      {step === 'step1' && (
        <div className="msai-card msai-ws-step">
          <div className="msai-step-title">Worksheet Creator <span className="msai-step-pill">Step 1 of 2</span> <HowItWorksButton topicKeys={['worksheets']} /></div>
          <div className="msai-field"><label>Select Class</label>
            <div className="msai-chip-row">{WS_CLASSES.map(c => <button key={c} type="button" className={`msai-chip${form1.cls === c ? ' msai-chip--active' : ''}`} onClick={() => setForm1(f => ({ ...f, cls: c }))}>{c}</button>)}</div>
          </div>
          <div className="msai-field"><label>Select Subject</label>
            <div className="msai-chip-row">{WS_SUBJECTS.map(s => <button key={s} type="button" className={`msai-chip${form1.subject === s ? ' msai-chip--active' : ''}`} onClick={() => setForm1(f => ({ ...f, subject: s }))}>{s}</button>)}</div>
          </div>
          <div className="msai-field"><label>Worksheet Type</label>
            <div className="msai-content-type-grid">
              {WS_TYPES.map(t => (
                <button key={t.id} type="button" className={`msai-content-type-card msai-content-type-card--sm${form1.type === t.id ? ' selected' : ''}`} onClick={() => setForm1(f => ({ ...f, type: t.id }))}>
                  <div className="msai-ctc-title">{t.name}</div>
                  <div className="msai-ctc-desc">{t.description}</div>
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="msai-btn-primary" style={{ alignSelf: 'flex-end' }} onClick={() => setStep('step2')}>Continue <i className="fa-solid fa-arrow-right" aria-hidden="true" /></button>
        </div>
      )}

      {step === 'step2' && (
        <div className="msai-card msai-ws-step">
          <div className="msai-step-title">Worksheet Generator <span className="msai-step-pill">Step 2 of 2</span></div>
          <div className="msai-field"><label>Difficulty</label>
            <div className="msai-chip-row">{WS_DIFFICULTIES.map(d => <button key={d} type="button" className={`msai-chip${form2.difficulty === d ? ' msai-chip--active' : ''}`} onClick={() => setForm2(f => ({ ...f, difficulty: d }))}>{d}</button>)}</div>
          </div>
          <div className="msai-form-grid">
            <Field label="Format"><select value={form2.format} onChange={e => setForm2(f => ({ ...f, format: e.target.value }))}>{WS_FORMATS.map(o => <option key={o}>{o}</option>)}</select></Field>
            <Field label="Colour Style"><select value={form2.colorStyle} onChange={e => setForm2(f => ({ ...f, colorStyle: e.target.value }))}>{WS_COLOR_STYLES.map(o => <option key={o}>{o}</option>)}</select></Field>
            <Field label="Number of Pages">
              <div className="msai-stepper">
                <button type="button" onClick={() => setForm2(f => ({ ...f, pages: Math.max(1, f.pages - 1) }))}>−</button>
                <span>{form2.pages}</span>
                <button type="button" onClick={() => setForm2(f => ({ ...f, pages: Math.min(10, f.pages + 1) }))}>+</button>
              </div>
            </Field>
          </div>
          <label className="msai-toggle-row">
            <span>Include School Name &amp; Logo</span>
            <span className="msai-toggle-wrap">
              <input type="checkbox" className="msai-toggle-input" checked={form2.branding} onChange={e => setForm2(f => ({ ...f, branding: e.target.checked }))} />
              <span className="msai-toggle-track"><span className="msai-toggle-knob" /></span>
            </span>
          </label>
          <div className="msai-field"><label>Reference Pictures (optional)</label>
            <AttachmentPicker items={refImages} onAdd={addRefImage} onRemove={removeRefImage} />
          </div>
          <Field label="Instructions to Mentor AI">
            <div className="msai-field-voice-wrap">
              <textarea rows={3} value={form2.instructions} onChange={e => setForm2(f => ({ ...f, instructions: e.target.value }))} placeholder="What should this worksheet focus on?" />
              <VoiceDictationButton onResult={t => setForm2(f => ({ ...f, instructions: f.instructions.trim() ? `${f.instructions.trim()} ${t}` : t }))} />
            </div>
          </Field>
          <button type="button" className="msai-btn-primary" style={{ alignSelf: 'flex-end' }} disabled={!form2.instructions.trim()} onClick={runGenerate}>
            <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> Generate Worksheet
          </button>
          <div className="msai-hint-text">Usually generates in under a minute.</div>
        </div>
      )}

      {step === 'generating' && (
        <div className="msai-card">
          <GeneratingProgress title="Working on it!" steps={GENERATING_STEPS} facts={GENERATING_FACTS} active={generating} />
        </div>
      )}

      {step === 'preview' && worksheet && (
        <div className="msai-card msai-ws-result">
          <div className="msai-lp-result-head">
            <div>
              <div className="msai-step-title">Worksheet Ready <i className="fa-solid fa-circle-check" style={{ color: '#16A34A', marginLeft: 6 }} aria-hidden="true" /></div>
              <div className="msai-lp-meta">{worksheet.cls} · {worksheet.subject} · {worksheet.pages} page{worksheet.pages === 1 ? '' : 's'}</div>
            </div>
            <VersionBadge version={worksheet.version} />
          </div>

          <WorksheetPages worksheet={worksheet} />

          {!editing ? (
            <div className="msai-result-actions">
              <button type="button" className="msai-btn-primary" onClick={() => toast?.('Opening PDF preview…')}><i className="fa-regular fa-file-pdf" aria-hidden="true" /> View PDF</button>
              <button type="button" className="msai-btn-secondary" onClick={() => setEditing(true)}><i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> Edit via AI</button>
              <button type="button" className="msai-btn-secondary" onClick={() => toast?.('Downloading worksheet…')}><i className="fa-solid fa-download" aria-hidden="true" /> Download</button>
              <button type="button" className="msai-btn-secondary" onClick={async () => { await mentorAiStudioService.saveToLibrary({ kind: 'worksheet', title: worksheet.title, cls: worksheet.cls, subject: worksheet.subject, pages: worksheet.pages, meta: worksheet }); toast?.('Worksheet saved to Library'); }}>
                <i className="fa-regular fa-bookmark" aria-hidden="true" /> Save to Library
              </button>
            </div>
          ) : (
            <EditViaAIPanel
              contextLabel={`${worksheet.title} · ${worksheet.pages} pages · ${worksheet.difficulty}`}
              quickChips={WS_QUICK_EDITS}
              applying={applying}
              onSubmitInstruction={async (instruction) => {
                const { changes } = await mentorAiStudioService.editWorksheetViaAI(worksheet, instruction);
                return { changes };
              }}
              onDiscard={() => setEditing(false)}
              onApply={async (instruction) => {
                setApplying(true);
                try {
                  const { worksheet: updated, changes } = await mentorAiStudioService.editWorksheetViaAI(worksheet, instruction);
                  setWorksheet(updated); setEditing(false);
                  toast?.(`Worksheet updated — ${changes.length} change${changes.length === 1 ? '' : 's'} applied`);
                } finally { setApplying(false); }
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return <div className="msai-field"><label>{label}</label>{children}</div>;
}

function WorksheetPages({ worksheet }) {
  return (
    <div className="msai-ws-pages">
      {worksheet.pageContent.map(page => (
        <div key={page.pageNo} className="msai-ws-page">
          <div className="msai-ws-page-title">{worksheet.title}</div>
          <div className="msai-ws-page-subtitle">{worksheet.subtitle}</div>
          {page.sections.map((sec, si) => (
            <div key={si} className="msai-ws-section">
              <div className="msai-ws-section-h">{sec.heading}</div>
              <ol className="msai-resp-numbered">
                {sec.questions.map(q => (
                  <li key={q.no} className={q.isNew ? 'msai-ws-q-new' : undefined}>
                    {q.text} {q.isNew && <span className="msai-new-tag">NEW</span>}
                  </li>
                ))}
              </ol>
            </div>
          ))}
          <div className="msai-ws-page-footer">Page {page.pageNo} of {worksheet.pages} · {worksheet.cls} · {worksheet.subject}</div>
        </div>
      ))}
    </div>
  );
}
