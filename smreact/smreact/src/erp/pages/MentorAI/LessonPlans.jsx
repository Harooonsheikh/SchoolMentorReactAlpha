import React, { useState, useEffect, useRef } from 'react';
import { useMentorAIActions } from './mentorAIPermissions';
import { GeneratingProgress, EditViaAIPanel, VersionBadge, AttachmentPicker, revokeAttachments, VoiceDictationButton, SaveToLibraryButton } from './MentorAIShared';
import { STAGE_SETS, useJobProgress } from './services/aiProgress';
import { HowItWorksButton } from './HowItWorks';
import { getPortalUnits, savePlanToPortal, saveNotebookPlanToPortal } from './services/Mentoraiportalservice';
import MarkdownMessage, { InlineMarkdown } from './MarkdownMessage';
import {
  NB_QUESTION_TYPES,
  NB_SINGLE_OUTPUT_TYPES,
  GENERATING_FACTS,
} from './mentorAiStudioData';

import { getHrGrades, getHrSubjects } from '../../services/hrService';
import * as mentorAiStudioService from './services/mentorAILessonPlanService';
import { toLessonPlanError, summarizeChanges } from './services/lessonPlanMapper';

const mapGroupTemplate = mentorAiStudioService.mapTypeToTemplate;

const EMPTY_SETUP = { unit: '', unitNumber: 1, unitMedium: 'english', count: 2, duration: 40, instructions: '' };
const unitKey = (u) => `${u.unitNo}__${u.unitName}`;

/* ═══════════════════════════════════════════════════════════════════
   LessonPlans — Lesson Plan generation + Notebook Lesson Plan sub-flow.
   ═══════════════════════════════════════════════════════════════════ */

export default function LessonPlans({ toast, onConsumed, goTo }) {
    const { canCreate, canEdit, canDownload, deny } = useMentorAIActions('lessonplans', toast); const [step, setStep] = useState('class');
  const [form, setForm] = useState({ cls: '', clsId: '', section: '', sectionId: '', subject: '', subjectId: '' });
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [pages, setPages] = useState([]);
  const [contentType, setContentType] = useState(null); // 'lessonplan' | 'notebook'

  // ── Lesson Plan state ──
  const [setupForm, setSetupForm] = useState(EMPTY_SETUP);
  const [units, setUnits] = useState([]);           // units from the ERP portal for class + section + subject
  const [savingPortal, setSavingPortal] = useState(false);
  const [lpResult, setLpResult] = useState(null);
  const [activePlanIdx, setActivePlanIdx] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [editingLp, setEditingLp] = useState(false);
  const [lpUndo, setLpUndo] = useState({});        // planId → plan before the last applied AI edit
  const lpJob = useJobProgress();
  const [lpError, setLpError] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);
  const subjectReqRef = useRef(0);

  // ── Notebook Lesson Plan state ──
  const [nbType, setNbType] = useState(null);
  const [nbForm, setNbForm] = useState({ count: 8, mainQuestion: '', instructions: '' });
  const [nbResult, setNbResult] = useState(null);
  const [nbGenerating, setNbGenerating] = useState(false);
  const [editingNb, setEditingNb] = useState(false);
  const [nbUndo, setNbUndo] = useState(null);      // notebook before the last applied AI edit
  const nbJob = useJobProgress();
  const [savingNbPortal, setSavingNbPortal] = useState(false);

  useEffect(() => {
    loadClasses();
  }, []);

  // Load the portal units whenever class / section / subject changes.
  useEffect(() => {
    if (!form.clsId || !form.sectionId || !form.subjectId) {
      setUnits([]);
      setSetupForm(f => ({ ...f, unit: '', unitNumber: 1, unitMedium: 'english' }));
      return;
    }
    let alive = true;
    getPortalUnits({ classID: form.clsId, sectionID: form.sectionId, subjectID: form.subjectId })
      .then(list => {
        if (!alive) return;
        setUnits(list);
        setSetupForm(f => ({
          ...f,
          unit: list[0]?.unitName || '',
          unitNumber: list[0]?.unitNo || 1,
          unitMedium: list[0]?.medium || 'english',
        }));
      })
      .catch(err => {
        if (!alive) return;
        console.error('Units loading failed', err);
        setUnits([]);
        setSetupForm(f => ({ ...f, unit: '', unitNumber: 1, unitMedium: 'english' }));
        toast?.('Could not load units for this class/section');
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.clsId, form.sectionId, form.subjectId]);

  const loadSubjects = async (clsId, sectionId, sectionName) => {
    const req = ++subjectReqRef.current;
    try {
      const response = await getHrSubjects(clsId, sectionId);
      if (req !== subjectReqRef.current) return;
      const data = Array.isArray(response) ? response : response?.data || response?.results || [];
      setSubjects(data);
      setForm(f => ({
        ...f,
        section: sectionName || '',
        sectionId,
        subject: data[0]?.name || data[0]?.subject_name || '',
        subjectId: data[0]?.id || ''
      }));
    } catch (error) {
      if (req !== subjectReqRef.current) return;
      console.error('Subject loading failed', error);
      setSubjects([]);
      setForm(f => ({ ...f, section: sectionName || '', sectionId, subject: '', subjectId: '' }));
      toast?.('Could not load subjects for this section');
    }
  };

  const loadClasses = async () => {
    try {
      const data = await getHrGrades();
      setClasses(data);
      if (data.length) {
        const cls = data[0];
        setForm(f => ({ ...f, cls: cls.name, clsId: cls.id }));
        setSections(cls.sections || []);
        const first = cls.sections?.[0];
        if (first) loadSubjects(cls.id, first.id, first.name);
      }
    } catch (e) {
      console.error('Class loading failed', e);
    }
  };

  const handleClassChange = (id) => {
    const cls = classes.find(x => String(x.id) === String(id));
    const secs = cls?.sections || [];
    setSections(secs);
    setSubjects([]);
    setForm(f => ({
      ...f, cls: cls?.name || '', clsId: cls?.id || '',
      section: '', sectionId: '', subject: '', subjectId: ''
    }));
    if (cls && secs[0]) loadSubjects(cls.id, secs[0].id, secs[0].name);
  };

  const handleSectionChange = (id) => {
    const sec = sections.find(x => String(x.id) === String(id));
    loadSubjects(form.clsId, id, sec?.name);
  };

  const reset = () => {
    revokeAttachments(pages);
    setStep('class'); setPages([]); setContentType(null);
    setLpResult(null); setActivePlanIdx(0); setEditingLp(false);
    setLpError(null); setTokenInfo(null); setLpUndo({}); lpJob.reset();
    setNbType(null); setNbResult(null); setEditingNb(false); setNbUndo(null); nbJob.reset();
    // Keep the loaded units; just re-select the first one.
    setSetupForm({
      ...EMPTY_SETUP,
      unit: units[0]?.unitName || '',
      unitNumber: units[0]?.unitNo || 1,
      unitMedium: units[0]?.medium || 'english',
    });
    setNbForm({ count: 8, mainQuestion: '', instructions: '' });
  };

  const addPageAttachment = (item) => setPages(p => [...p, item]);
  const removePage = (id) => setPages(p => {
    const found = p.find(x => x.id === id);
    if (found?.url) URL.revokeObjectURL(found.url);
    return p.filter(x => x.id !== id);
  });

  // ── Unit Name dropdown (units come from the ERP portal, tied to class + section + subject) ──
  const renderUnitSelect = () => (
    <Field label="Unit Name">
      <select
        value={setupForm.unit ? unitKey({ unitNo: setupForm.unitNumber, unitName: setupForm.unit }) : ''}
        onChange={e => {
          const u = units.find(x => unitKey(x) === e.target.value);
          setSetupForm(f => ({
            ...f,
            unit: u?.unitName || '',
            unitNumber: u?.unitNo || 1,
            unitMedium: u?.medium || 'english',
          }));
        }}
      >
        {units.length === 0 && <option value="">No units found for this class/section</option>}
        {units.map(u => (
          <option key={unitKey(u)} value={unitKey(u)}>Unit {u.unitNo} — {u.unitName}</option>
        ))}
      </select>
    </Field>
  );

  // ═══════════════════════════════════════════════════════════════
  // LESSON PLAN — Generate
  // ═══════════════════════════════════════════════════════════════
  const runGenerateLp = async () => {
        if (!canCreate) { deny('create'); return; }
    if (!setupForm.unit) {
      toast?.('Please select a unit first (add units in Manage Units if none are listed)');
      return;
    }
    if (lpJob.running) return;
    setLpError(null);
    setStep('generating');
    setGenerating(true);
    const signal = lpJob.start(STAGE_SETS.lessonPlan);
    try {
      const res = await mentorAiStudioService.generateLessonPlan({
        cls: form.cls, section: form.section, subject: form.subject,
        unit: setupForm.unit, unitNumber: setupForm.unitNumber || 1,
        duration: setupForm.duration, count: setupForm.count,
        instructions: setupForm.instructions,
        files: pages.map(p => p.file).filter(Boolean),
      }, { signal, onProgress: lpJob.report });
      lpJob.report({ stage: 'finalizing' });
      setLpResult({ plans: res.plans });
      setTokenInfo(res.tokens || null);
      setLpUndo({});
      setActivePlanIdx(0);
      lpJob.complete();
      setStep('result');
      onConsumed?.();
    } catch (error) {
      const err = toLessonPlanError(error);
      lpJob.fail(err, err.message);
      if (err.kind === 'cancelled') { setStep('setup'); return; }
      const fileProblem = err.kind === 'validation' && /photo|pdf|file|page/i.test(err.message);
      setLpError({
        kind: err.kind, message: err.message,
        backStep: (!form.cls || !form.subject) ? 'class' : fileProblem ? 'scan' : 'setup',
      });
      setStep('error');
    } finally {
      setGenerating(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // LESSON PLAN — Save to Portal (ERP: Academics → Lesson Plans)
  // ═══════════════════════════════════════════════════════════════
  const handleLpSave = async () => {
        if (!canDownload) { deny('download'); return; }
    if (savingPortal || !currentPlan) return;
    setSavingPortal(true);
    try {
      await savePlanToPortal({
        plan: currentPlan,
        unit: { unitNo: setupForm.unitNumber, unitName: setupForm.unit, medium: setupForm.unitMedium },
        ctx: {
          classID: form.clsId,
          sectionID: form.sectionId,
          subjectID: form.subjectId,
          className: form.cls,
          subjectName: form.subject,
        },
      });
      toast?.('Lesson plan saved to portal');
    } catch (error) {
      console.error('SAVE ERROR', error);
      toast?.(error?.message || 'Save failed');
    } finally {
      setSavingPortal(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // NOTEBOOK LESSON PLAN — Generate
  // ═══════════════════════════════════════════════════════════════
  const runGenerateNb = async () => {
        if (!canCreate) { deny('create'); return; }
    if (nbJob.running) return;
    setStep('nbgenerating');
    setNbGenerating(true);
    const signal = nbJob.start(STAGE_SETS.lessonPlan);
    const opts = { signal, onProgress: nbJob.report };

    try {
      const uploadedFile = pages[0]?.file || pages[0]?.fileObject || pages[0]?.originalFile || null;

      // Single endpoint (Postman: "generate notebook lesson plan"). The old
      // fallback to /ai/api/generate-notebook-work-openai/ was removed: that
      // endpoint isn't in the API, so it always failed and its 404 replaced
      // the server's real error message.
      const res = await mentorAiStudioService.generateNotebookLessonPlan({
          cls: form.cls,
          subject: form.subject,
          unit: setupForm.unit,
          unitNumber: setupForm.unitNumber || 1,
          typeId: nbType.id,
          questionTypes: [nbType.id],
          count: nbForm.count,
          mainQuestion: nbForm.mainQuestion,
          instructions: nbForm.instructions,
          file: uploadedFile,
        }, opts);

      const finalResult = {
        ...res,
        typeName: res.typeName || nbType.name,
        template: res.template || nbType.template,
        cls: res.cls || form.cls,
        subject: res.subject || form.subject,
        unit: res.unit || setupForm.unit,
        instruction: res.instruction || nbForm.mainQuestion || nbType.name,
        version: res.version || 1,
      };

      console.log("FINAL NOTEBOOK RESULT:", finalResult);

      if (!finalResult.rows?.length) {
        throw new Error("Notebook was generated but no questions could be read. Please try again.");
      }

      nbJob.report({ stage: 'finalizing' });
      setNbResult(finalResult);
      setNbUndo(null);
      nbJob.complete();
      setStep('nbresult');
      onConsumed?.();

    } catch (error) {
      console.error("Notebook Generate Failed:", error?.response?.data || error);
      const err = toLessonPlanError(error);
      nbJob.fail(err, err.message || "Notebook generation failed");
      if (err.kind !== 'cancelled') toast?.(err.message || "Notebook generation failed");
      setStep('nbconfigure'); // don't leave the user stuck on the spinner
    } finally {
      setNbGenerating(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // NOTEBOOK — Edit via AI
  // ═══════════════════════════════════════════════════════════════
  // Edits the draft from the previous instruction (`base`) when there is
  // one, otherwise the notebook currently on screen.
  const handleNbEditSubmit = async (instruction, { base, signal, onProgress }) => {
        if (!canEdit) throw new Error("You don't have edit permission for Lesson Plans.");
    try {
      const source = base || nbResult;
      const result = await mentorAiStudioService.editNotebookLessonPlanViaAI(source, instruction, { signal, onProgress });
      const updated = result.notebook || result;
      if (!updated?.rows?.length) throw new Error('Mentor AI returned no questions for this edit. Please try rephrasing.');
      const merged = {
        ...source,
        ...updated,
        typeName: nbResult.typeName,
        template: nbResult.template,
        cls: nbResult.cls,
        subject: nbResult.subject,
        unit: nbResult.unit,
        lessonId: updated.lessonId ?? source.lessonId ?? nbResult.lessonId ?? null,
        documentId: updated.documentId ?? source.documentId ?? nbResult.documentId ?? null,
      };
      onConsumed?.();
      return { result: merged, changes: result.changes?.length ? result.changes : ['Notebook content refreshed based on your request.'] };
    } catch (e) {
      throw toLessonPlanError(e);
    }
  };

  const handleNbEditApply = (proposal) => {
    setNbUndo(nbResult);
    setNbResult({ ...proposal.result, version: (nbResult.version || 1) + 1 });
    setEditingNb(false);
    toast?.('Notebook work updated');
  };

  const undoNbEdit = () => {
    if (!nbUndo) return;
    setNbResult(nbUndo);
    setNbUndo(null);
    toast?.('Reverted to the previous version');
  };

  // ═══════════════════════════════════════════════════════════════
  // NOTEBOOK — Save to Portal
  // ═══════════════════════════════════════════════════════════════
  const handleNbSave = async () => {
        if (!canDownload) { deny('download'); return; }
    if (savingNbPortal || !nbResult) return;
    setSavingNbPortal(true);
    try {
      await saveNotebookPlanToPortal({
        typeId: nbType?.id || '',
        mainQuestion: nbForm.mainQuestion || nbResult.mainQuestion || '',
        statement: nbResult.rows?.[0]?.statement || '',
        rows: nbResult.rows || [],
        unit: { unitNo: setupForm.unitNumber, unitName: setupForm.unit, medium: setupForm.unitMedium },
        ctx: {
          classID: form.clsId,
          sectionID: form.sectionId,
          subjectID: form.subjectId,
        },
      });
      toast?.("Notebook Lesson Plan Saved Successfully");
    } catch (error) {
      console.error("SAVE NB ERROR", error);
      toast?.(error?.message || "Save failed — please try again");
    } finally {
      setSavingNbPortal(false);
    }
  };

  const currentPlan = lpResult?.plans?.[activePlanIdx] || null;

  const undoLpEdit = () => {
    const prev = currentPlan && lpUndo[currentPlan.id];
    if (!prev) return;
    setLpResult(r => {
      const next = [...r.plans];
      next[activePlanIdx] = prev;
      return { ...r, plans: next };
    });
    setLpUndo(u => { const c = { ...u }; delete c[prev.id]; return c; });
    toast?.('Reverted to the previous version');
  };

  return (
    <div className="msai-lp">
      {step !== 'class' && (
        <button type="button" className="msai-back-link" onClick={() => (step === 'result' || step === 'nbresult' ? reset() : goBack())}>
          <i className="fa-solid fa-arrow-left" aria-hidden="true" /> {(step === 'result' || step === 'nbresult') ? 'Start Over' : 'Back'}
        </button>
      )}

      {/* ── STEP 1: Class / Section / Subject ── */}
      {step === 'class' && (
        <div className="msai-card msai-lp-step">
          <div className="msai-step-title">AI LessonPlanner <HowItWorksButton topicKeys={['lessonPlans', 'notebookPlans']} /></div>
          <div className="msai-step-sub">Select the class, section and subject to begin.</div>
          <div className="msai-form-grid">
            <Field label="Class"><select value={form.clsId} onChange={e => handleClassChange(e.target.value)}>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Section"><select value={form.sectionId} onChange={e => handleSectionChange(e.target.value)}>{sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Subject"><select value={form.subjectId} onChange={e => { const s = subjects.find(x => String(x.id) === e.target.value); setForm(f => ({ ...f, subjectId: e.target.value, subject: s?.name || '' })); }}>{subjects.map(s => (
              <option key={s.id} value={s.id}>{s.subject_name || s.name}</option>
            ))}</select></Field>
          </div>
          <button type="button" className="msai-btn-primary" style={{ alignSelf: 'flex-end' }} onClick={() => setStep('scan')}>Continue <i className="fa-solid fa-arrow-right" aria-hidden="true" /></button>
        </div>
      )}

      {/* ── STEP 2: Scan / Upload ── */}
      {step === 'scan' && (
        <div className="msai-card msai-lp-step">
          <div className="msai-step-title">Scan or Upload Pictures</div>
          <div className="msai-step-sub">Add the textbook pages you want Mentor AI to base the content on.</div>
          <div className="msai-scan-frame">
            <i className="fa-solid fa-camera" aria-hidden="true" />
            <span>Position the page inside the frame</span>
          </div>
          <AttachmentPicker items={pages} onAdd={addPageAttachment} onRemove={removePage} formatName={(p, i) => `Page ${i + 1} — ${p.name}`} />
          <div className="msai-tip-card"><i className="fa-solid fa-lightbulb" aria-hidden="true" /> Tip: good lighting and a flat page give Mentor AI the clearest content to work from.</div>
          <button type="button" className="msai-btn-primary" style={{ alignSelf: 'flex-end' }} disabled={pages.length === 0} onClick={() => setStep('contenttype')}>
            Continue ({pages.length} page{pages.length === 1 ? '' : 's'}) <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* ── STEP 3: Content Type ── */}
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

      {/* ── LESSON PLAN: Setup ── */}
      {step === 'setup' && (
        <div className="msai-card msai-lp-step">
          <div className="msai-step-title">Lesson Plans Setup</div>
          <div className="msai-form-grid">
            {renderUnitSelect()}
            <Field label="Number of Lesson Plans"><input type="number" min={1} max={10} value={setupForm.count} onChange={e => setSetupForm(f => ({ ...f, count: Math.max(1, Number(e.target.value) || 1) }))} /></Field>
            <Field label="Duration (minutes)"><input type="number" min={10} max={90} value={setupForm.duration} onChange={e => setSetupForm(f => ({ ...f, duration: Math.max(10, Number(e.target.value) || 40) }))} /></Field>
          </div>
          <Field label="Additional Instructions (optional)">
            <div className="msai-field-voice-wrap">
              <textarea rows={3} value={setupForm.instructions} onChange={e => setSetupForm(f => ({ ...f, instructions: e.target.value }))} placeholder="Anything specific you want emphasised…" />
              <VoiceDictationButton onResult={t => setSetupForm(f => ({ ...f, instructions: f.instructions.trim() ? `${f.instructions.trim()} ${t}` : t }))} />
            </div>
          </Field>
          <button type="button" className="msai-btn-primary" style={{ alignSelf: 'flex-end' }}onClick={runGenerateLp} disabled={!canCreate}><i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> Generate</button>
        </div>
      )}

      {/* ── LESSON PLAN: Generating ── */}
      {step === 'generating' && (
        <div className="msai-card">
          <GeneratingProgress title="Generating your lesson plan…" progress={lpJob.progress} facts={GENERATING_FACTS} onCancel={lpJob.cancel} />
        </div>
      )}

      {/* ── LESSON PLAN: Result ── */}
      {step === 'result' && currentPlan && (
        <div className="msai-card msai-lp-result">
          <div className="msai-lp-result-head">
            <div>
              <div className="msai-step-title">{currentPlan.title}</div>
              <div className="msai-lp-meta">{[currentPlan.cls, currentPlan.section ? `Section ${currentPlan.section}` : '', currentPlan.subject].filter(Boolean).join(' · ')}</div>
            </div>
            <div className="msai-lp-result-badges">
              {currentPlan.duration ? <span className="msai-duration-pill">{currentPlan.duration} minutes</span> : null}
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
              <div className="msai-lp-section-h"><span>{sec.title}</span>{sec.mins ? <span className="msai-duration-pill msai-duration-pill--sm">{sec.mins} min</span> : null}</div>
          {sec.type === 'numbered'
  ? <ol className="msai-resp-numbered">
      {sec.items.map((it, i) => (
        <li key={i}><InlineMarkdown text={it} /></li>
      ))}
    </ol>
  : <MarkdownMessage text={sec.text} />}
            </div>
          ))}

          {tokenInfo && (
            <div className="msai-tip-card"><i className="fa-solid fa-bolt" aria-hidden="true" /> {tokenInfo.remaining.toLocaleString()} tokens remaining</div>
          )}

             {!(editingLp && canEdit) ? (
            <div className="msai-result-actions">
              {canEdit && (
                <button type="button" className="msai-btn-primary" onClick={() => setEditingLp(true)}><i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> Edit via AI</button>
              )}
              {canEdit && lpUndo[currentPlan.id] && (
                <button type="button" className="msai-btn-secondary" onClick={undoLpEdit}><i className="fa-solid fa-rotate-left" aria-hidden="true" /> Undo AI edit</button>
              )}
              {canDownload && (
                <button type="button" className="msai-btn-secondary" onClick={handleLpSave} disabled={savingPortal}>
                  <i className="fa-solid fa-floppy-disk" aria-hidden="true" /> {savingPortal ? 'Saving…' : 'Save to Portal'}
                </button>
              )}
              <SaveToLibraryButton
                perm="Lesson Plans"
                toast={toast}
                resetKey={`${currentPlan.id}:${currentPlan.version || 1}`}
                build={() => ({
                  type: 'lessonplan',
                  title: currentPlan.title,
                  content: {
                    plan: {
                      title: currentPlan.title, cls: currentPlan.cls, section: currentPlan.section,
                      subject: currentPlan.subject, unit: currentPlan.unit, duration: currentPlan.duration,
                      version: currentPlan.version || 1, sections: currentPlan.sections,
                    },
                  },
                  sourceKey: `lessonplan:${currentPlan.documentId || 'doc'}:${currentPlan.raw?.lesson_plan_number ?? activePlanIdx + 1}`,
                })}
              />
            </div>
          ) : (
            <EditViaAIPanel
              key={currentPlan.id}
              contextLabel={`Editing: ${currentPlan.title}`}
              quickChips={['Add more activities', 'Simplify language', 'Make it longer', 'Add assessment', 'Add homework', 'Change language']}
              onSubmitInstruction={async (instruction, { base, signal, onProgress }) => {
                try {
                  const result = await mentorAiStudioService.editLessonPlanViaAI(base || currentPlan, instruction, { signal, onProgress });
                  if (result.tokens) setTokenInfo(result.tokens);
                  onConsumed?.();
                  // Changes are listed against the plan on screen, so a
                  // multi-step refinement shows its cumulative effect.
                  const changes = summarizeChanges(currentPlan, result.plan);
                  return { result: result.plan, changes: changes.length ? changes : ['Lesson plan refreshed based on your request.'] };
                } catch (e) {
                  throw toLessonPlanError(e);
                }
              }}
              onDiscard={() => setEditingLp(false)}
              onApply={(proposal) => {
                const idx = activePlanIdx;
                const before = lpResult.plans[idx];
                const next = [...lpResult.plans];
                // Keep the on-screen identity (id / documentId / lessonId) so
                // Save to Portal, tabs and undo keep pointing at this plan.
                next[idx] = {
                  ...proposal.result,
                  id: before.id,
                  documentId: proposal.result.documentId ?? before.documentId,
                  lessonId: proposal.result.lessonId ?? before.lessonId,
                  section: before.section,
                  version: (before.version || 1) + 1,
                };
                setLpUndo(u => ({ ...u, [before.id]: before }));
                setLpResult(r => ({ ...r, plans: next }));
                setEditingLp(false);
                toast?.('Lesson plan updated');
              }}
            />
          )}
        </div>
      )}

      {/* ── LESSON PLAN: Error ── */}
      {step === 'error' && lpError && (
        <div className="msai-card msai-lp-step">
          <div className="msai-step-title">
            <i className={`fa-solid ${lpError.kind === 'token_limit' ? 'fa-bolt' : 'fa-triangle-exclamation'}`} aria-hidden="true" />{' '}
            {lpError.kind === 'token_limit' ? 'Token limit reached' : "Couldn't generate your lesson plan"}
          </div>
          <div className="msai-step-sub">{lpError.message}</div>
          <div className="msai-result-actions">
            {lpError.kind === 'token_limit' && goTo && (
              <button type="button" className="msai-btn-primary" onClick={() => goTo('wallet')}><i className="fa-solid fa-wallet" aria-hidden="true" /> View Wallet</button>
            )}
            {canCreate && lpError.kind !== 'token_limit' && lpError.kind !== 'validation' && lpError.kind !== 'auth' && (
              <button type="button" className="msai-btn-primary" onClick={runGenerateLp}><i className="fa-solid fa-rotate-right" aria-hidden="true" /> Try Again</button>
            )}
            <button type="button" className="msai-btn-secondary" onClick={() => setStep(lpError.backStep || 'setup')}>Review Details</button>
          </div>
        </div>
      )}

      {/* ═══════════ NOTEBOOK LESSON PLAN FLOW ═══════════ */}

      {/* ── NB: Question Type Selection ── */}
      {step === 'nbtype' && (
        <div className="msai-card msai-lp-step">
          <div className="msai-step-title">Choose Question Type</div>
          {renderUnitSelect()}
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

      {/* ── NB: Configure ── */}
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
          <button type="button" className="msai-btn-primary" style={{ alignSelf: 'flex-end' }} onClick={runGenerateNb} disabled={!canCreate}><i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> Generate</button>
        </div>
      )}

      {/* ── NB: Generating ── */}
      {step === 'nbgenerating' && (
        <div className="msai-card">
          <GeneratingProgress title="Generating notebook work…" progress={nbJob.progress} facts={GENERATING_FACTS} onCancel={nbJob.cancel} />
        </div>
      )}

      {/* ── NB: Result ── */}
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

                  {!(editingNb && canEdit) ? (
            <div className="msai-result-actions">
              {canEdit && (
                <button type="button" className="msai-btn-primary" onClick={() => setEditingNb(true)}>
                  <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> Edit via AI
                </button>
              )}
              {canEdit && nbUndo && (
                <button type="button" className="msai-btn-secondary" onClick={undoNbEdit}><i className="fa-solid fa-rotate-left" aria-hidden="true" /> Undo AI edit</button>
              )}
              {canDownload && (
                <button type="button" className="msai-btn-secondary" onClick={handleNbSave} disabled={savingNbPortal}>
                  <i className="fa-solid fa-floppy-disk" aria-hidden="true" /> {savingNbPortal ? 'Saving…' : 'Save to Portal'}
                </button>
              )}
            </div>
          ) : (
            <EditViaAIPanel
              contextLabel={`Editing: ${nbResult.typeName}`}
              quickChips={['Add more questions', 'Simplify language', 'Make answers longer', 'Change difficulty', 'Change language', 'Add more detail']}
              onSubmitInstruction={handleNbEditSubmit}
              onDiscard={() => setEditingNb(false)}
              onApply={handleNbEditApply}
            />
          )}
        </div>
      )}
    </div>
  );

  function goBack() {
    lpJob.cancel(); nbJob.cancel();
    if (step === 'error') { setStep(lpError?.backStep || 'setup'); return; }
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


/* ═══════════════════════════════════════════════════════════════════
   NOTEBOOK RESULT RENDERERS — FIXED MAPPING
   Each question type now gets the correct template and correct field
   extraction so questions ↔ answers always line up.
   ═══════════════════════════════════════════════════════════════════ */

/* ── Notebook Result Body renderer ── */
function NotebookResultBody({ result }) {
  const groups = Object.entries(result.questionGroups || {});

  // Grouped format (new API) — pass typeKey so the renderer can customise
  if (groups.length) {
    return (
      <div className="msai-nb-groups">
        {groups.map(([typeKey, questions]) => (
          <div key={typeKey} className="msai-nb-group">
            <div className="msai-nb-group-title">{typeKey.replace(/_/g, ' ')}</div>
            <NotebookTemplateRenderer
              template={mapGroupTemplate(typeKey)}
              typeKey={typeKey}
              rows={questions}
              result={result}
            />
          </div>
        ))}
      </div>
    );
  }

  // Legacy format: flat rows + template — use first questionType or fallback
  if (result.rows?.length) {
    return (
      <NotebookTemplateRenderer
        template={result.template}
        typeKey={result.questionTypes?.[0] || ''}
        rows={result.rows}
        result={result}
      />
    );
  }

  return (
    <div className="msai-tip-card">
      <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> No questions were found in the response. Open the browser console and look for "Notebook parse found NO questions".
    </div>
  );
}


/* ─── Helper: normalise typeKey for subtype checks ─── */
const normTypeKey = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');


/* ─── PAIRS template (word_opposite, word_synonyms, singular_plural) ─── */
function PairsRenderer({ typeKey, rows }) {
  const nk = normTypeKey(typeKey);

  // Dynamic column headers based on question type
  let col1 = 'Word';
  let col2 = 'Answer';
  if (nk.includes('opposite') || nk.includes('antonym')) {
    col2 = 'Opposite';
  } else if (nk.includes('synonym')) {
    col2 = 'Synonym';
  } else if (nk.includes('singular') || nk.includes('plural')) {
    col1 = 'Singular';
    col2 = 'Plural';
  }

  return (
    <table className="msai-nb-table">
      <thead><tr><th>#</th><th>{col1}</th><th>{col2}</th></tr></thead>
      <tbody>{rows.map((r, i) => {
        // Extract the correct "left" value
        const left = (nk.includes('singular') || nk.includes('plural'))
          ? (r.singular || r.word || r.columnA || r.question || '')
          : (r.word || r.singular || r.columnA || r.question || '');

        // Extract the correct "right" value — type-specific field first, then generic answer
        let right = '';
        if (nk.includes('opposite') || nk.includes('antonym')) {
          right = r.opposite || r.answer || r.columnB || '';
        } else if (nk.includes('synonym')) {
          right = r.synonym || r.answer || r.columnB || '';
        } else if (nk.includes('singular') || nk.includes('plural')) {
          right = r.plural || r.answer || r.columnB || '';
        } else {
          right = r.answer || r.opposite || r.synonym || r.plural || r.columnB || '';
        }

        return (
          <tr key={i}>
            <td>{r.no || i + 1}</td>
            <td>{left}</td>
            <td className="msai-nb-blank">{right}</td>
          </tr>
        );
      })}</tbody>
    </table>
  );
}


/* ─── MCQ template (MCQs, true_fals, circle_the_correct_words) ─── */
function McqRenderer({ typeKey, rows }) {
  const nk = normTypeKey(typeKey);
  const isTrueFalse = nk.includes('truefals') || nk.includes('truefalse');
  const isCircle = nk.includes('circle');

  return (
    <div className="msai-nb-mcq-list">
      {rows.map((r, i) => {
        // For true/false: use statement first; for circle: use sentence first; for MCQs: use question
        const questionText = isTrueFalse
          ? (r.statement || r.question || r.sentence || '')
          : isCircle
            ? (r.sentence || r.question || r.statement || '')
            : (r.question || r.statement || r.sentence || '');

        // For true/false without options, provide default True/False options
        let displayOptions = r.options || [];
        if (isTrueFalse && displayOptions.length === 0) {
          displayOptions = ['True', 'False'];
        }

        return (
          <div key={i} className="msai-nb-mcq">
            <div className="msai-nb-mcq-q">{r.no || i + 1}. <InlineMarkdown text={questionText} /></div>
            {displayOptions.length > 0 && (
              <div className="msai-nb-mcq-opts">
                {displayOptions.map((o, j) => (
                  <span key={j}>
                    {String.fromCharCode(65 + j)}. <InlineMarkdown text={typeof o === 'object' ? (o.text || o.option || JSON.stringify(o)) : o} />
                  </span>
                ))}
              </div>
            )}
            {r.answer !== '' && r.answer != null && (
              <div className="msai-nb-mcq-ans"><strong>Answer:</strong> <InlineMarkdown text={String(r.answer)} /></div>
            )}
          </div>
        );
      })}
    </div>
  );
}


/* ─── SENTENCES template (word_sentences, fill_in_the_blank, punctuation, mid_liner) ─── */
function SentencesRenderer({ typeKey, rows }) {
  const nk = normTypeKey(typeKey);
  const isWordSentence = nk.includes('wordsentence');
  const isFillBlank = nk.includes('fillintheblank') || nk.includes('fillblank');

  return (
    <ol className="msai-resp-numbered">
      {rows.map((r, i) => {
        const sentenceText = r.sentence || r.question || '';
        const wordText = r.word || '';
        const answerText = r.answer || '';

        return (
          <li key={i}>
            {/* For word_sentences: show the word prominently, then the sentence */}
            {isWordSentence && wordText ? (
              <>
                <strong>{wordText}</strong>
                {sentenceText ? <> — <InlineMarkdown text={sentenceText} /></> : null}
              </>
            ) : (
              /* For fill_in_the_blank, punctuation, mid_liner: show sentence, fall back to word/answer */
              <>{sentenceText || wordText || answerText || ''}</>
            )}

            {/* Show answer below if there is both a question/sentence AND an answer */}
            {answerText && (sentenceText || wordText || r.question) ? (
              <div className="msai-nb-qa-a"><strong>A.</strong> <InlineMarkdown text={answerText} /></div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}


/* ─── TABLE2 template (match_the_column) ─── */
function Table2Renderer({ rows }) {
  return (
    <table className="msai-nb-table">
      <thead><tr><th>Column A</th><th>Column B</th></tr></thead>
      <tbody>{rows.map((r, i) => (
        <tr key={i}>
          <td><InlineMarkdown text={r.columnA || r.word || r.question || ''} /></td>
          <td><InlineMarkdown text={r.columnB || r.answer || ''} /></td>
        </tr>
      ))}</tbody>
    </table>
  );
}


/* ─── SHORTLONG template (short_questions, long_questions) ─── */
function ShortLongRenderer({ rows }) {
  return (
    <div className="msai-nb-qa-list">
      {rows.map((r, i) => (
        <div key={i} className="msai-nb-qa">
          <div className="msai-nb-qa-q"><strong>Q{r.no || i + 1}.</strong> <InlineMarkdown text={r.question || r.statement || ''} /></div>
          {r.answer && <div className="msai-nb-qa-a"><strong>A.</strong> <InlineMarkdown text={r.answer} /></div>}
        </div>
      ))}
    </div>
  );
}


/* ─── COMPREHENSION template (passage + questions/answers) ─── */
function ComprehensionRenderer({ rows, result }) {
  // The passage/statement may be on the first row, or on the result level
  const passage = rows[0]?.statement || result?.body || '';

  // If there's a shared passage, show it once at the top
  // then show each Q/A. If no shared passage, treat each row as standalone.
  const hasSharedPassage = passage && rows.length > 1;

  return (
    <div className="msai-nb-qa-list">
      {/* Show passage once at the top if it exists and is shared */}
      {hasSharedPassage && (
        <div className="msai-nb-comprehension-passage" style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--msai-surface, #f8f9fa)', borderRadius: '0.5rem', fontStyle: 'italic' }}>
          {passage}
        </div>
      )}

      {rows.map((r, i) => {
        const questionText = r.question || '';
        const statementText = r.statement || '';
        // For standalone comprehension (no shared passage), show statement inline with Q
        const displayQ = questionText || (!hasSharedPassage && statementText ? statementText : '');

        // Skip rows that only have the passage and no question
        if (!displayQ && !r.answer) return null;

        return (
          <div key={i} className="msai-nb-qa">
            {/* If this row has its own statement AND a question, show both */}
            {!hasSharedPassage && statementText && questionText && (
              <div style={{ marginBottom: '0.5rem', fontStyle: 'italic', opacity: 0.85 }}><InlineMarkdown text={statementText} /></div>
            )}
            <div className="msai-nb-qa-q"><strong>Q{r.no || i + 1}.</strong> <InlineMarkdown text={displayQ} /></div>
            {r.answer && <div className="msai-nb-qa-a"><strong>A.</strong> <InlineMarkdown text={r.answer} /></div>}
          </div>
        );
      })}
    </div>
  );
}


/* ─── ESSAY / STORY templates (paragraph_writing, letter, application, essay, stories) ─── */
function EssayRenderer({ rows, result }) {
  const first = rows[0] || {};
  return (
    <>
      <div className="msai-resp-heading">{first.title || result.title || ''}</div>
      {first.subject && <p className="msai-resp-text" style={{ fontStyle: 'italic' }}><strong>Subject:</strong> {first.subject}</p>}
<MarkdownMessage text={first.body || first.answer || first.question || result.body || ''} />    </>
  );
}

function StoryRenderer({ rows, result }) {
  const first = rows[0] || {};
  return (
    <>
      <div className="msai-resp-heading">{first.title || result.title || ''}</div>
<MarkdownMessage text={first.body || first.answer || first.question || result.body || ''} />      {(first.moral || first.conclusion) && (
        <p className="msai-resp-text"><strong>{first.moral ? 'Moral: ' : 'Conclusion: '}</strong><InlineMarkdown text={first.moral || first.conclusion} /></p>
      )}
    </>
  );
}


/* ─── Main template router ─── */
function NotebookTemplateRenderer({ template, typeKey, rows, result }) {
  const list = rows || [];
  if (!list.length) return null;

  switch (template) {
    case 'pairs':
      return <PairsRenderer typeKey={typeKey} rows={list} />;
    case 'mcq':
      return <McqRenderer typeKey={typeKey} rows={list} />;
    case 'sentences':
      return <SentencesRenderer typeKey={typeKey} rows={list} />;
    case 'table2':
      return <Table2Renderer rows={list} />;
    case 'shortlong':
      return <ShortLongRenderer rows={list} />;
    case 'comprehension':
      return <ComprehensionRenderer rows={list} result={result} />;
    case 'essay':
      return <EssayRenderer rows={list} result={result} />;
    case 'story':
      return <StoryRenderer rows={list} result={result} />;
    default:
      // Fallback — try to show whatever data is available
      return <ShortLongRenderer rows={list} />;
  }
}
