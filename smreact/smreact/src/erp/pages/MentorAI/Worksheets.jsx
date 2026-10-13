import React, { useState, useEffect } from 'react';
import { useMentorAIActions } from './mentorAIPermissions';
import { GeneratingProgress, EditViaAIPanel, VersionBadge, AttachmentPicker, revokeAttachments, VoiceDictationButton, SaveToLibraryButton, downloadFile } from './MentorAIShared';
import { STAGE_SETS, useJobProgress } from './services/aiProgress';
import { InlineMarkdown } from './MarkdownMessage';
import { HowItWorksButton } from './HowItWorks';
import {
  WS_TYPES, WS_DIFFICULTIES, WS_FORMATS, WS_COLOR_STYLES, WS_QUICK_EDITS,
  GENERATING_FACTS,
} from './mentorAiStudioData';
import { getHrGrades, getHrSubjects } from '../../services/hrService';
import * as mentorAIWorksheetService from './services/mentorAIWorksheetService';
import { secureMentorUrl } from './services/mentorAiApi';

export default function Worksheets({ toast, onConsumed }) {
   const { canCreate, canEdit, canDownload, deny } = useMentorAIActions('worksheets', toast);
  const [step, setStep] = useState('step1');
 const [form1, setForm1] = useState({
  cls: '',
  clsId: '',
  section: '',
  sectionId: '',
  subject: '',
  subjectId: '',
  type: WS_TYPES[0].id
});
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const [form2, setForm2] = useState({ difficulty: 'Easy', format: WS_FORMATS[0], colorStyle: WS_COLOR_STYLES[0], pages: 2, branding: true, instructions: '' });
  const [worksheet, setWorksheet] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [undoWorksheet, setUndoWorksheet] = useState(null);
  const job = useJobProgress();
  const [refImages, setRefImages] = useState([]);

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
  try {
    const data = await getHrGrades();

    setClasses(data);

    if (data.length > 0) {
      const firstClass = data[0];
      const firstSection =
        firstClass.sections?.[0] || null;

      setForm1((previous) => ({
        ...previous,
        cls: firstClass.name || '',
        clsId: firstClass.id || '',
        section: firstSection?.name || '',
        sectionId: firstSection?.id || '',
      }));
    }
  } catch (error) {
    console.error(
      'CLASS LOAD ERROR:',
      error.response?.data || error.message
    );
  }
};

  const handleClassChange = (id) => {
    const cls = classes.find(x => String(x.id) === String(id));
    const firstSection = cls?.sections?.[0] || null;
    setSubjects([]);
    setForm1(prev => ({
      ...prev,
      cls: cls?.name || '',
      clsId: cls?.id || '',
      section: firstSection?.name || '',
      sectionId: firstSection?.id || '',
      subject: '',
      subjectId: ''
    }));
  };

const handleSubjectLoad = async (
  gradeId,
  sectionId
) => {
  if (!gradeId || !sectionId) {
    console.warn(
      'Subject API skipped: sectionId is missing',
      {
        gradeId,
        sectionId,
      }
    );

    setSubjects([]);
    return;
  }

  try {
    const response = await getHrSubjects(
      gradeId,
      sectionId
    );

    const data = Array.isArray(response)
      ? response
      : response?.data ||
        response?.results ||
        [];

    setSubjects(data);

    if (data.length > 0) {
      const firstSubject = data[0];

      setForm1((previous) => ({
        ...previous,
        subject:
          firstSubject.subject_name ||
          firstSubject.name ||
          '',
        subjectId:
          firstSubject.id ||
          firstSubject.subject_id ||
          '',
      }));
    }
  } catch (error) {
    console.error(
      'SUBJECT ERROR:',
      error.response?.data || error.message
    );

    setSubjects([]);
  }
};
useEffect(() => {
  if (form1.clsId && form1.sectionId) {
    handleSubjectLoad(
      form1.clsId,
      form1.sectionId
    );
  }
}, [form1.clsId, form1.sectionId]);
  const reset = () => {
    revokeAttachments(refImages);
    job.reset();
    setStep('step1'); setWorksheet(null); setEditing(false); setUndoWorksheet(null); setRefImages([]);
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
  if (!canCreate) { deny('create'); return; }
  if (!form1.cls) {
    toast?.('Please select a class.');
    return;
  }

  if (!form1.subject) {
    toast?.('Please select a subject.');
    return;
  }

  if (!form2.instructions.trim()) {
    toast?.('Please enter worksheet instructions.');
    return;
  }

  if (job.running) return;
  setStep('generating');
  setGenerating(true);
  const signal = job.start(STAGE_SETS.worksheet);
  const opts = { signal, onProgress: job.report };

  // Kept on the worksheet so Edit via AI can re-run generation with the
  // same settings (the API has no separate edit endpoint).
  let genParams;
  try {
    const response =
      await mentorAIWorksheetService.generateWorksheet(genParams = {
        grade: form1.cls,
        cls: form1.cls,
        subject: form1.subject,

        worksheetType: form1.type,
        difficulty: form2.difficulty,
        format: form2.format,
        colorStyle: form2.colorStyle,

        includeBranding: form2.branding,
        instructions: form2.instructions,

        referencePictureMode:
          refImages.length > 0
            ? 'upload_image'
            : 'skip',

        referenceImages: refImages
          .map(
            (item) =>
              item.file ||
              item.fileObject ||
              item.originalFile ||
              item.attachment ||
              null
          )
          .filter(Boolean),

        pages: form2.pages,
      }, opts);

    console.log(
      'Worksheet generation response:',
      response
    );

    const trackingId =
      response?.tracking_id ||
      response?.data?.tracking_id;

    if (trackingId) {
      const finalWorksheet =
        await mentorAIWorksheetService.waitForWorksheetResult(trackingId, opts);

      job.report({ stage: 'finalizing' });
      setWorksheet({ ...finalWorksheet, _genParams: genParams });
      setUndoWorksheet(null);
      job.complete();
      setStep('preview');
      onConsumed?.();
      return;
    }

    const finalWorksheet =
      response?.worksheet ||
      response?.data?.worksheet ||
      response?.data ||
      response;
if (
  !finalWorksheet ||
  (
    !finalWorksheet.pdfUrl &&
    !Array.isArray(finalWorksheet.pageContent)
  )
) {
  throw new Error(
    'Worksheet response is incomplete.'
  );
}

    job.report({ stage: 'finalizing' });
    setWorksheet({ ...mentorAIWorksheetService.normalizeWorksheet(finalWorksheet), _genParams: genParams });
    setUndoWorksheet(null);
    job.complete();
    setStep('preview');
    onConsumed?.();
  } catch (error) {
    console.error(
      'Worksheet generation failed:',
      error.response?.data || error.message
    );

    const backendError = error.response?.data;

    const message =
      typeof backendError === 'string'
        ? backendError
        : backendError?.error ||
          backendError?.message ||
          error.message ||
          'Worksheet generation failed.';

    // Keep the progress card up with Retry / Back for errors & timeouts;
    // a user-initiated Cancel goes straight back to the form.
    if (job.fail(error, message) === 'cancelled') setStep('step2');
    else toast?.(message);
  } finally {
    setGenerating(false);
  }
};
  return (
    <div className="msai-ws">
      {step !== 'step1' && (
        <button type="button" className="msai-back-link" onClick={() => { job.cancel(); if (step === 'preview') reset(); else setStep(step === 'step2' ? 'step1' : step === 'generating' ? 'step2' : 'preview'); }}>
          <i className="fa-solid fa-arrow-left" aria-hidden="true" /> {step === 'preview' ? 'Start Over' : 'Back'}
        </button>
      )}

      {step === 'step1' && (
        <div className="msai-card msai-ws-step">
          <div className="msai-step-title">Worksheet Creator <span className="msai-step-pill">Step 1 of 2</span> <HowItWorksButton topicKeys={['worksheets']} /></div>
          <div className="msai-field"><label>Select Class</label>
            <div className="msai-chip-row">{classes.map(c => <button key={c.id} type="button" className={`msai-chip${form1.clsId === c.id ? ' msai-chip--active' : ''}`} onClick={() => handleClassChange(c.id)}>{c.name}</button>)}</div>
          </div>
          <div className="msai-field"><label>Select Subject</label>
            <div className="msai-chip-row">{subjects.map(s => <button key={s.id} type="button" className={`msai-chip${form1.subjectId === s.id ? ' msai-chip--active' : ''}`} onClick={() => setForm1(prev => ({ ...prev, subject: s.subject_name || s.name, subjectId: s.id }))}>{s.subject_name || s.name}</button>)}</div>
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
          <button type="button" className="msai-btn-primary" style={{ alignSelf: 'flex-end' }} disabled={!canCreate || !form2.instructions.trim()} onClick={runGenerate}>
            <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> Generate Worksheet
          </button>
          <div className="msai-hint-text">Usually generates in under a minute.</div>
        </div>
      )}

      {step === 'generating' && (
        <div className="msai-card">
          <GeneratingProgress
            title="Generating your worksheet…"
            progress={job.progress}
            facts={GENERATING_FACTS}
            onCancel={job.cancel}
            onRetry={runGenerate}
            onDismiss={() => { job.reset(); setStep('step2'); }}
          />
        </div>
      )}

      {step === 'preview' && worksheet && (
        <div className="msai-card msai-ws-result">
          <div className="msai-lp-result-head">
            <div>
              <div className="msai-step-title">Worksheet Ready <i className="fa-solid fa-circle-check" style={{ color: '#16A34A', marginLeft: 6 }} aria-hidden="true" /></div>
<div className="msai-lp-meta">
  {worksheet?.cls || form1.cls} ·{' '}
  {worksheet?.subject || form1.subject}
  {worksheet?.pdfUrl
    ? ' · PDF Ready'
    : ''}
</div>            </div>
            <VersionBadge version={worksheet.version} />
          </div>

          <WorksheetPages worksheet={worksheet} />

                 {!(editing && canEdit) ? (
            <div className="msai-result-actions">
              <a className="msai-btn-primary" href={worksheet.pdfUrl || worksheet.pdf_url || '#'} target="_blank" rel="noreferrer"><i className="fa-regular fa-file-pdf" aria-hidden="true" /> View PDF</a>
              {canEdit && (
                <button type="button" className="msai-btn-secondary" onClick={() => setEditing(true)}><i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> Edit via AI</button>
              )}
              {canEdit && undoWorksheet && (
                <button type="button" className="msai-btn-secondary" onClick={() => { setWorksheet(undoWorksheet); setUndoWorksheet(null); toast?.('Reverted to the previous version'); }}>
                  <i className="fa-solid fa-rotate-left" aria-hidden="true" /> Undo AI edit
                </button>
              )}
              {canDownload && (
                <button type="button" className="msai-btn-secondary" disabled={!(worksheet.pdfUrl || worksheet.pdf_url)} onClick={() => downloadFile(worksheet.pdfUrl || worksheet.pdf_url, `${worksheetTitle(worksheet, form1)}.pdf`)}><i className="fa-solid fa-download" aria-hidden="true" /> Download PDF</button>
              )}
              <SaveToLibraryButton
                perm="Worksheet Generator"
                toast={toast}
                resetKey={worksheet.version || 1}
                build={() => ({
                  type: 'worksheet',
                  title: worksheetTitle(worksheet, form1),
                  content: {
                    worksheet: {
                      ...withoutGenParams(worksheet),
                      cls: worksheet.cls || form1.cls,
                      subject: worksheet.subject || form1.subject,
                    },
                  },
                  sourceKey: `worksheet:${worksheet.id || worksheet.worksheet_id || worksheet.tracking_id || 'new'}`,
                })}
              />
            </div>
          ) : (
            <EditViaAIPanel
              contextLabel={[worksheetTitle(worksheet, form1), worksheet.pageContent?.length ? `${worksheet.pageContent.length} pages` : '', worksheet.difficulty || form2.difficulty].filter(Boolean).join(' · ')}
              quickChips={WS_QUICK_EDITS}
              onSubmitInstruction={async (instruction, { base, signal, onProgress }) => {
                const { worksheet: updated, changes } = await mentorAIWorksheetService.editWorksheetViaAI(base || worksheet, instruction, { signal, onProgress });
                return { result: updated, changes };
              }}
              onDiscard={() => setEditing(false)}
              onApply={(proposal) => {
                setUndoWorksheet(worksheet);
                setWorksheet({ ...proposal.result, version: (worksheet.version || 1) + 1 });
                setEditing(false);
                onConsumed?.();
                toast?.(`Worksheet updated — ${proposal.changes.length} change${proposal.changes.length === 1 ? '' : 's'} applied`);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function withoutGenParams(ws) {
  const { _genParams, ...rest } = ws || {};
  return rest;
}

function worksheetTitle(ws, form1) {
  return ws?.title || ws?.topic || [ws?.cls || form1?.cls, ws?.subject || form1?.subject, 'Worksheet'].filter(Boolean).join(' · ');
}

function Field({ label, children }) {
  return <div className="msai-field"><label>{label}</label>{children}</div>;
}

/* PDF ko pehle blob mein laate hain taake ai.schoolmentor.ai ka
   "refused to connect" (iframe block) na aaye. Agar CORS ki wajah se
   fetch fail ho to Google viewer se dikhate hain. */
function WorksheetPdfPreview({ url }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  const src = secureMentorUrl(url);

  useEffect(() => {
    if (!src) return undefined;
    let objectUrl = null;
    let cancelled = false;
    setBlobUrl(null);
    setFailed(false);
    fetch(src, { mode: 'cors', credentials: 'omit', cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.blob(); })
      .then(b => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([b], { type: 'application/pdf' }));
        setBlobUrl(objectUrl);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src]);

  const frameStyle = { width: '100%', height: 650, border: 'none', borderRadius: 8, background: '#fff', display: 'block' };

  if (failed) {
    return (
      <iframe
        src={`https://docs.google.com/gview?url=${encodeURIComponent(src)}&embedded=true`}
        title="Worksheet preview"
        style={frameStyle}
      />
    );
  }
  if (!blobUrl) {
    return <div className="msai-empty-state"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Loading worksheet…</div>;
  }
  return <iframe src={`${blobUrl}#toolbar=0&view=FitH`} title="Worksheet preview" style={frameStyle} />;
}

export function WorksheetPages({ worksheet }) {
  const pages = Array.isArray(
    worksheet?.pageContent
  )
    ? worksheet.pageContent
    : [];

  if (!pages.length) {
    if (worksheet?.pdfUrl) {
      return (
        <WorksheetPdfPreview url={worksheet.pdfUrl} />
      );
    }

    return (
      <div className="msai-empty-state">
        Worksheet content is not available yet.
      </div>
    );
  }

  return (
    <div className="msai-ws-pages">
      {pages.map((page, index) => (
        <div
          key={page?.pageNo || index}
          className="msai-ws-page"
        >
          <div className="msai-ws-page-title">
            {worksheet?.title || 'Worksheet'}
          </div>

          <div className="msai-ws-page-subtitle">
            {worksheet?.subtitle || ''}
          </div>

          {(page?.sections || []).map(
            (section, sectionIndex) => (
              <div
                key={sectionIndex}
                className="msai-ws-section"
              >
                <div className="msai-ws-section-h">
                  <InlineMarkdown text={section?.heading || ''} />
                </div>

                <ol className="msai-resp-numbered">
                  {(section?.questions || []).map(
                    (question, questionIndex) => (
                      <li
                        key={
                          question?.no ||
                          questionIndex
                        }
                      >
                        <InlineMarkdown text={question?.text || ''} />
                      </li>
                    )
                  )}
                </ol>
              </div>
            )
          )}

          <div className="msai-ws-page-footer">
            Page {page?.pageNo || index + 1} of{' '}
            {pages.length}
          </div>
        </div>
      ))}
    </div>
  );
}