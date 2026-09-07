import React, { useState } from 'react';
import * as mentorAiStudioService from '../../services/mentorAiStudioService';
import { GeneratingProgress, EditViaAIPanel, VersionBadge, AttachmentPicker, revokeAttachments, VoiceDictationButton } from './MentorAIShared';
import { HowItWorksButton } from './HowItWorks';
import {
  LP_CLASSES, LP_SECTIONS, LP_SUBJECTS, LP_UNITS,
  NB_QUESTION_TYPES, NB_SINGLE_OUTPUT_TYPES,
  GENERATING_FACTS, GENERATING_STEPS,
} from './mentorAiStudioData';

/* ═══════════════════════════════════════════════════════════════════
   LessonPlans — Lesson Plan generation flow + Notebook Work sub-flow.
   Ported from the prototype's lp-class / lp-scan / lp-content-type /
   lp-setup / lp-result / lp-edit screens, plus the lp-nb-* Notebook
   Work sub-flow. Kept as one file since both share the same
   class → scan → content-type funnel.
   ═══════════════════════════════════════════════════════════════════ */

const STEPS_ORDER = ['class', 'scan', 'contenttype'];

export default function LessonPlans({ toast, onConsumed }) {
  const [step, setStep] = useState('class');
  const [form, setForm] = useState({ cls: LP_CLASSES[3], section: LP_SECTIONS[0], subject: LP_SUBJECTS[0] });
  const [pages, setPages] = useState([]);
  const [contentType, setContentType] = useState(null); // 'lessonplan' | 'notebook'

  const [setupForm, setSetupForm] = useState({ unit: LP_UNITS[0], count: 2, duration: 40, instructions: '' });
  const [lpResult, setLpResult] = useState(null);
  const [activePlanIdx, setActivePlanIdx] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [editingLp, setEditingLp] = useState(false);
  const [applyingLp, setApplyingLp] = useState(false);

  const [nbType, setNbType] = useState(null);
  const [nbForm, setNbForm] = useState({ count: 8, mainQuestion: '', instructions: '' });
  const [nbResult, setNbResult] = useState(null);
  const [nbGenerating, setNbGenerating] = useState(false);

  const reset = () => {
    revokeAttachments(pages);
    setStep('class'); setPages([]); setContentType(null);
    setLpResult(null); setActivePlanIdx(0); setEditingLp(false);
    setNbType(null); setNbResult(null);
    setSetupForm({ unit: LP_UNITS[0], count: 2, duration: 40, instructions: '' });
    setNbForm({ count: 8, mainQuestion: '', instructions: '' });
  };

  const addPageAttachment = (item) => setPages(p => [...p, item]);
  const removePage = (id) => setPages(p => {
    const found = p.find(x => x.id === id);
    if (found?.url) URL.revokeObjectURL(found.url);
    return p.filter(x => x.id !== id);
  });

  const runGenerateLp = async () => {
    setStep('generating'); setGenerating(true);
    try {
      const res = await mentorAiStudioService.generateLessonPlan({ ...form, ...setupForm });
      setLpResult(res); setActivePlanIdx(0); setStep('result');
      onConsumed?.();
    } finally { setGenerating(false); }
  };

  const runGenerateNb = async () => {
    setStep('nbgenerating'); setNbGenerating(true);
    try {
      const res = await mentorAiStudioService.generateNotebookWork({ ...form, typeId: nbType.id, ...nbForm });
      setNbResult(res); setStep('nbresult');
      onConsumed?.();
    } finally { setNbGenerating(false); }
  };

  const currentPlan = lpResult?.plans?.[activePlanIdx];

  return (
    <div className="msai-lp">
      {step !== 'class' && (
        <button type="button" className="msai-back-link" onClick={() => (step === 'result' || step === 'nbresult' ? reset() : goBack())}>
          <i className="fa-solid fa-arrow-left" aria-hidden="true" /> {(step === 'result' || step === 'nbresult') ? 'Start Over' : 'Back'}
        </button>
      )}

      {step === 'class' && (
        <div className="msai-card msai-lp-step">
          <div className="msai-step-title">AI LessonPlanner <HowItWorksButton topicKeys={['lessonPlans', 'notebookPlans']} /></div>
          <div className="msai-step-sub">Select the class, section and subject to begin.</div>
          <div className="msai-form-grid">
            <Field label="Class"><select value={form.cls} onChange={e => setForm(f => ({ ...f, cls: e.target.value }))}>{LP_CLASSES.map(c => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Section"><select value={form.section} onChange={e => setForm(f => ({ ...f, section: e.target.value }))}>{LP_SECTIONS.map(s => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Subject"><select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>{LP_SUBJECTS.map(s => <option key={s}>{s}</option>)}</select></Field>
          </div>
          <button type="button" className="msai-btn-primary" style={{ alignSelf: 'flex-end' }} onClick={() => setStep('scan')}>Continue <i className="fa-solid fa-arrow-right" aria-hidden="true" /></button>
        </div>
      )}

      {step === 'scan' && (
        <div className="msai-card msai-lp-step">
          <div className="msai-step-title">Scan or Upload Pictures</div>
          <div className="msai-step-sub">Add the textbook pages you want Mentor AI to base the content on.</div>
          <div className="msai-scan-frame">
            <i className="fa-solid fa-camera" aria-hidden="true" />
            <span>Position the page inside the frame</span>
          </div>
          <AttachmentPicker
            items={pages}
            onAdd={addPageAttachment}
            onRemove={removePage}
            formatName={(p, i) => `Page ${i + 1} — ${p.name}`}
          />
          <div className="msai-tip-card"><i className="fa-solid fa-lightbulb" aria-hidden="true" /> Tip: good lighting and a flat page give Mentor AI the clearest content to work from.</div>
          <button type="button" className="msai-btn-primary" style={{ alignSelf: 'flex-end' }} disabled={pages.length === 0} onClick={() => setStep('contenttype')}>
            Continue ({pages.length} page{pages.length === 1 ? '' : 's'}) <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </button>
        </div>
      )}

      {step === 'contenttype' && (
        <div className="msai-card msai-lp-step">
          <div className="msai-step-title">Choose Content Type</div>
          <div className="msai-step-sub">What should Mentor AI generate from the {pages.length} scanned page{pages.length === 1 ? '' : 's'}?</div>
          <div className="msai-content-type-grid">
            <button type="button" className="msai-content-type-card" onClick={() => { setContentType('lessonplan'); setStep('setup'); }}>
              <i className="fa-solid fa-chalkboard-user" aria-hidden="true" />
              <div className="msai-ctc-title">Lesson Plan</div>
              <div className="msai-ctc-desc">Create structured lesson plans with objectives, activities, and assessments.</div>
            </button>
            <button type="button" className="msai-content-type-card" onClick={() => { setContentType('notebook'); setStep('nbtype'); }}>
              <i className="fa-solid fa-pen-ruler" aria-hidden="true" />
              <div className="msai-ctc-title">Notebook Work</div>
              <div className="msai-ctc-desc">Generate exercises, worksheets and practice activities.</div>
            </button>
          </div>
        </div>
      )}

      {step === 'setup' && (
        <div className="msai-card msai-lp-step">
          <div className="msai-step-title">Lesson Plans Setup</div>
          <div className="msai-form-grid">
            <Field label="Unit Name"><select value={setupForm.unit} onChange={e => setSetupForm(f => ({ ...f, unit: e.target.value }))}>{LP_UNITS.map(u => <option key={u}>{u}</option>)}</select></Field>
            <Field label="Number of Lesson Plans"><input type="number" min={1} max={10} value={setupForm.count} onChange={e => setSetupForm(f => ({ ...f, count: Math.max(1, Number(e.target.value) || 1) }))} /></Field>
            <Field label="Duration (minutes)"><input type="number" min={10} max={90} value={setupForm.duration} onChange={e => setSetupForm(f => ({ ...f, duration: Math.max(10, Number(e.target.value) || 40) }))} /></Field>
          </div>
          <Field label="Additional Instructions (optional)">
            <div className="msai-field-voice-wrap">
              <textarea rows={3} value={setupForm.instructions} onChange={e => setSetupForm(f => ({ ...f, instructions: e.target.value }))} placeholder="Anything specific you want emphasised…" />
              <VoiceDictationButton onResult={t => setSetupForm(f => ({ ...f, instructions: f.instructions.trim() ? `${f.instructions.trim()} ${t}` : t }))} />
            </div>
          </Field>
          <button type="button" className="msai-btn-primary" style={{ alignSelf: 'flex-end' }} onClick={runGenerateLp}><i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> Generate</button>
        </div>
      )}

      {step === 'generating' && (
        <div className="msai-card">
          <GeneratingProgress title="Generating your lesson plan…" steps={GENERATING_STEPS} facts={GENERATING_FACTS} active={generating} />
        </div>
      )}

      {step === 'result' && currentPlan && (
        <div className="msai-card msai-lp-result">
          <div className="msai-lp-result-head">
            <div>
              <div className="msai-step-title">{currentPlan.title}</div>
              <div className="msai-lp-meta">{currentPlan.cls} · Section {currentPlan.section} · {currentPlan.subject}</div>
            </div>
            <div className="msai-lp-result-badges">
              <span className="msai-duration-pill">{currentPlan.duration} minutes</span>
              <VersionBadge version={currentPlan.version} />
            </div>
          </div>

          {lpResult.plans.length > 1 && (
            <div className="msai-lp-plan-tabs">
              {lpResult.plans.map((p, i) => (
                <button key={p.id} type="button" className={`msai-chip${i === activePlanIdx ? ' msai-chip--active' : ''}`} onClick={() => setActivePlanIdx(i)}>Lesson Plan {i + 1}</button>
              ))}
            </div>
          )}

          {currentPlan.sections.map(sec => (
            <div key={sec.key} className="msai-lp-section">
              <div className="msai-lp-section-h"><span>{sec.title}</span><span className="msai-duration-pill msai-duration-pill--sm">{sec.mins} min</span></div>
              {sec.type === 'numbered'
                ? <ol className="msai-resp-numbered">{sec.items.map((it, i) => <li key={i}>{it}</li>)}</ol>
                : <p className="msai-resp-text">{sec.text}</p>}
            </div>
          ))}

          {!editingLp ? (
            <div className="msai-result-actions">
              <button type="button" className="msai-btn-primary" onClick={() => setEditingLp(true)}><i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> Edit via AI</button>
              <button type="button" className="msai-btn-secondary" onClick={() => toast?.('Saved to Portal — Lesson Plans')}><i className="fa-solid fa-floppy-disk" aria-hidden="true" /> Save to Portal</button>
            </div>
          ) : (
            <EditViaAIPanel
              contextLabel={`Editing: ${currentPlan.title}`}
              quickChips={['Add more activities', 'Simplify language', 'Make it longer', 'Add assessment', 'Add homework', 'Change language']}
              onSubmitInstruction={async (instruction) => {
                const { changes } = await mentorAiStudioService.editLessonPlanViaAI(currentPlan, instruction);
                return { changes };
              }}
              applying={applyingLp}
              onDiscard={() => setEditingLp(false)}
              onApply={async (instruction) => {
                setApplyingLp(true);
                try {
                  const { plan } = await mentorAiStudioService.editLessonPlanViaAI(currentPlan, instruction);
                  const next = [...lpResult.plans]; next[activePlanIdx] = plan;
                  setLpResult({ ...lpResult, plans: next });
                  setEditingLp(false);
                  toast?.('Lesson plan updated');
                } finally { setApplyingLp(false); }
              }}
            />
          )}
        </div>
      )}

      {step === 'nbtype' && (
        <div className="msai-card msai-lp-step">
          <div className="msai-step-title">Choose Question Type</div>
          <Field label="Unit Name"><select value={setupForm.unit} onChange={e => setSetupForm(f => ({ ...f, unit: e.target.value }))}>{LP_UNITS.map(u => <option key={u}>{u}</option>)}</select></Field>
          <div className="msai-nb-type-grid">
            {NB_QUESTION_TYPES.map(t => (
              <button key={t.id} type="button" className="msai-nb-type-card" style={{ '--nb-color': t.color }} onClick={() => { setNbType(t); setStep('nbconfigure'); }}>
                <span className="msai-nb-type-card-ic" style={{ background: `${t.color}1A`, color: t.color }}><i className={`fa-solid ${t.icon}`} aria-hidden="true" /></span>
                <span className="msai-nb-type-card-name">{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'nbconfigure' && nbType && (
        <div className="msai-card msai-lp-step">
          <div className="msai-step-title">Configure — {nbType.name}</div>
          <span className="msai-mode-tag" style={{ background: `${nbType.color}1A`, color: nbType.color, alignSelf: 'flex-start' }}>{nbType.name}</span>
          {!NB_SINGLE_OUTPUT_TYPES.includes(nbType.id) && (
            <Field label="Number of Items"><input type="number" min={1} max={20} value={nbForm.count} onChange={e => setNbForm(f => ({ ...f, count: Math.max(1, Number(e.target.value) || 1) }))} /></Field>
          )}
          <Field label="Main Question">
            <div className="msai-field-voice-wrap">
              <input type="text" value={nbForm.mainQuestion} onChange={e => setNbForm(f => ({ ...f, mainQuestion: e.target.value }))} placeholder="e.g. Write opposite of the following words" />
              <VoiceDictationButton onResult={t => setNbForm(f => ({ ...f, mainQuestion: f.mainQuestion.trim() ? `${f.mainQuestion.trim()} ${t}` : t }))} />
            </div>
          </Field>
          <Field label="Additional Instructions">
            <div className="msai-field-voice-wrap">
              <textarea rows={3} value={nbForm.instructions} onChange={e => setNbForm(f => ({ ...f, instructions: e.target.value }))} />
              <VoiceDictationButton onResult={t => setNbForm(f => ({ ...f, instructions: f.instructions.trim() ? `${f.instructions.trim()} ${t}` : t }))} />
            </div>
          </Field>
          <button type="button" className="msai-btn-primary" style={{ alignSelf: 'flex-end' }} onClick={runGenerateNb}><i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> Generate</button>
        </div>
      )}

      {step === 'nbgenerating' && (
        <div className="msai-card">
          <GeneratingProgress title="Generating notebook work…" steps={GENERATING_STEPS} facts={GENERATING_FACTS} active={nbGenerating} />
        </div>
      )}

      {step === 'nbresult' && nbResult && (
        <div className="msai-card msai-lp-result">
          <div className="msai-lp-result-head">
            <div>
              <div className="msai-step-title">{nbResult.typeName}</div>
              <div className="msai-lp-meta">{nbResult.cls} · {nbResult.subject} · {nbResult.unit}</div>
            </div>
            <VersionBadge version={nbResult.version} />
          </div>
          <div className="msai-nb-instruction"><i className="fa-solid fa-thumbtack" aria-hidden="true" /> {nbResult.instruction}</div>
          <NotebookResultBody result={nbResult} />
          <div className="msai-result-actions">
            <button type="button" className="msai-btn-primary" onClick={() => toast?.('Edit via AI — coming from the same conversation flow as Lesson Plans')}><i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> Edit via AI</button>
            <button type="button" className="msai-btn-secondary" onClick={() => toast?.('Saved to Portal — Lesson Plans')}><i className="fa-solid fa-floppy-disk" aria-hidden="true" /> Save to Portal</button>
          </div>
        </div>
      )}
    </div>
  );

  function goBack() {
    const order = ['class', 'scan', 'contenttype', contentType === 'notebook' ? 'nbtype' : 'setup', contentType === 'notebook' ? 'nbconfigure' : 'generating'];
    const idx = order.indexOf(step);
    if (idx > 0) setStep(order[idx - 1]);
    else if (step === 'nbtype' || step === 'setup') setStep('contenttype');
    else setStep('class');
  }
}

function Field({ label, children }) {
  return (
    <div className="msai-field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function NotebookResultBody({ result }) {
  if (result.template === 'pairs') {
    return (
      <table className="msai-nb-table">
        <thead><tr><th>#</th><th>Word</th><th>Answer</th></tr></thead>
        <tbody>{result.rows.map(r => <tr key={r.no}><td>{r.no}</td><td>{r.word}</td><td className="msai-nb-blank">{r.answer}</td></tr>)}</tbody>
      </table>
    );
  }
  if (result.template === 'mcq') {
    return (
      <div className="msai-nb-mcq-list">
        {result.rows.map(r => (
          <div key={r.no} className="msai-nb-mcq">
            <div className="msai-nb-mcq-q">{r.no}. {r.question}</div>
            <div className="msai-nb-mcq-opts">{r.options.map((o, i) => <span key={i}>{String.fromCharCode(65 + i)}. {o}</span>)}</div>
          </div>
        ))}
      </div>
    );
  }
  if (result.template === 'table2') {
    return (
      <table className="msai-nb-table">
        <thead><tr><th>Column A</th><th>Column B</th></tr></thead>
        <tbody>{result.left.map((l, i) => <tr key={i}><td>{l}</td><td>{result.right[i]}</td></tr>)}</tbody>
      </table>
    );
  }
  if (result.template === 'sentences') {
    return <ol className="msai-resp-numbered">{result.rows.map(r => <li key={r.no}>{r.sentence}</li>)}</ol>;
  }
  if (result.template === 'shortlong') {
    return <ol className="msai-resp-numbered">{result.rows.map(r => <li key={r.no}>{r.question}</li>)}</ol>;
  }
  if (result.template === 'story') {
    return <><div className="msai-resp-heading">{result.title}</div><p className="msai-resp-text">{result.body}</p></>;
  }
  return <><div className="msai-resp-heading">{result.title}</div><p className="msai-resp-text">{result.body}</p></>;
}
