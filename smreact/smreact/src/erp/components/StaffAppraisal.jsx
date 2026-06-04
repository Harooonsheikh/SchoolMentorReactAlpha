import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from './Tooltip';
import * as appraisalService from '../services/appraisalService';
import useAsync from '../hooks/useAsync';
import {
  APPRAISAL_FRAMEWORK,
  APPRAISAL_CYCLES,
  APPRAISAL_AUTO_SOURCES,
  APPRAISAL_REPORT_TYPES,
  defaultAppraisalSetup,
} from '../mock/appraisal';

/* ═══════════════════════════════════════════════════════════════════
   STAFF APPRAISAL — entry point.

   Three sub-sections:
     1. Setup     — cycle, grades, eligibility, evaluation framework
     2. Appraisals — list + new + conduct modal
     3. Reports   — 12 reports with PDF + CSV export

   All copy is written for non-HR users — there are no "competencies"
   or "rubrics" in the UI. Helper banners, tooltips and guidance text
   are present on every screen.
   ═══════════════════════════════════════════════════════════════════ */
const APR_SUBTABS = [
  { id: 'setup',     icon: 'fa-sliders',       label: 'Setup' },
  { id: 'conduct',   icon: 'fa-clipboard-user', label: 'Appraisals' },
  { id: 'reports',   icon: 'fa-chart-line',    label: 'Reports' },
];

export default function StaffAppraisal({ emps = [], depts = [], desigs = [], toast = () => {} }) {
  const [sub, setSub] = useState('setup');

  /* Server-snapshotted state. Same hoist-and-mirror pattern used by
     the rest of the HR module. */
  const { data: serverSetup }       = useAsync(appraisalService.getAppraisalSetup, null);
  const { data: serverAppraisals = [] } = useAsync(appraisalService.getAppraisals, []);
  const { data: serverNextId    = 1 } = useAsync(appraisalService.getAppraisalNextId, 1);

  const [setup, setSetup]           = useState(null);
  const [appraisals, setAppraisals] = useState(null);
  const [nextId, setNextId]         = useState(null);

  useEffect(() => { if (serverSetup       && setup       == null) setSetup(serverSetup);             }, [serverSetup, setup]);
  useEffect(() => { if (serverAppraisals.length && appraisals == null) setAppraisals(serverAppraisals); }, [serverAppraisals, appraisals]);
  useEffect(() => { if (nextId == null && serverNextId) setNextId(serverNextId);                     }, [serverNextId, nextId]);

  const effectiveSetup = setup || defaultAppraisalSetup();
  const apprList       = appraisals || [];

  return (
    <>
      <style>{APR_CSS}</style>

      {/* L1 tabs — same shape as hr-tabs across the rest of the ERP */}
      <div className="apr-subtabs" role="tablist" aria-label="Staff Appraisal sections">
        {APR_SUBTABS.map(t => (
          <Tooltip key={t.id} text={t.label}>
            <button
              className={`apr-subtab${sub === t.id ? ' on' : ''}`}
              onClick={() => setSub(t.id)}
              role="tab"
              aria-selected={sub === t.id}
              tabIndex={sub === t.id ? 0 : -1}
            >
              <i className={`fa-solid ${t.icon}`} aria-hidden="true"></i> {t.label}
            </button>
          </Tooltip>
        ))}
      </div>

      {sub === 'setup' && (
        <SetupSection
          setup={effectiveSetup}
          setSetup={setSetup}
          toast={toast}
        />
      )}
      {sub === 'conduct' && (
        <AppraisalsSection
          setup={effectiveSetup}
          emps={emps} depts={depts} desigs={desigs}
          appraisals={apprList}
          setAppraisals={setAppraisals}
          nextId={nextId || 1}
          setNextId={setNextId}
          toast={toast}
        />
      )}
      {sub === 'reports' && (
        <ReportsSection
          setup={effectiveSetup}
          emps={emps} depts={depts} desigs={desigs}
          appraisals={apprList}
          toast={toast}
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SETUP SECTION
   ═══════════════════════════════════════════════════════════════════ */
function SetupSection({ setup, setSetup, toast }) {
  const [draft, setDraft] = useState(() => clone(setup));
  const initial = useMemo(() => JSON.stringify(setup), [setup]);
  const current = useMemo(() => JSON.stringify(draft), [draft]);
  const dirty = initial !== current;

  /* Track whether the user has tried saving an invalid setup. Once true,
     stays true so the red error styling persists until weights become
     valid (then it automatically melts away because the validation
     result is "valid"). */
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [errorOpen,     setErrorOpen]     = useState(false);

  /* Live validation result — recomputed on every render. */
  const validation = useMemo(() => validateSetupWeights(draft), [draft]);

  const save = () => {
    if (!validation.valid) {
      setAttemptedSave(true);
      setErrorOpen(true);
      return;
    }
    setSetup(draft);
    appraisalService.saveAppraisalSetup(draft).catch(() => {});
    toast('Appraisal setup saved', 'success');
  };
  const reset = () => {
    setDraft(clone(setup));
    setAttemptedSave(false);
    toast('Reverted unsaved changes', 'info');
  };
  const restoreDefault = () => {
    setDraft(defaultAppraisalSetup());
    setAttemptedSave(false);
    toast('Loaded the recommended International Standard defaults', 'success');
  };

  return (
    <>
      {/* Setup intro banner — self-styled, no HR_CSS dependency */}
      <div className="apr-setup-intro">
        <div className="apr-setup-intro-ic" aria-hidden="true">
          <i className="fa-solid fa-sliders"></i>
        </div>
        <div className="apr-setup-intro-body">
          <div className="apr-setup-intro-title">
            Configure your appraisal framework in <span className="apr-setup-intro-accent">5 quick steps.</span>
          </div>
          <div className="apr-setup-intro-desc">
            Pick a cycle, confirm grade ranges, set the score needed for each reward, review the evaluation areas, and decide if you want parent feedback. Everything is editable later.
          </div>
          <button type="button" className="apr-setup-intro-btn" onClick={restoreDefault}>
            <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
            Load International Standard defaults
          </button>
        </div>
      </div>

      {/* Step 1 — Review Cycle */}
      <SetupCard
        step="1"
        title="When should appraisals happen?"
        sub="Pick how often you want to formally evaluate your staff. You can change this later."
      >
        <div className="apr-cycle-grid">
          {APPRAISAL_CYCLES.map(c => (
            <button
              key={c.id}
              type="button"
              className={`apr-cycle apr-cycle--${c.tone}${draft.cycle === c.id ? ' on' : ''}`}
              onClick={() => setDraft(d => ({ ...d, cycle: c.id }))}
              aria-pressed={draft.cycle === c.id}
            >
              <div className="apr-cycle-ic"><i className={`fa-solid ${c.icon}`} aria-hidden="true"></i></div>
              <div className="apr-cycle-body">
                <div className="apr-cycle-h">{c.label}</div>
                <div className="apr-cycle-when">{c.when}</div>
                <div className="apr-cycle-pros">
                  {c.pros.map((p, i) => (
                    <span key={i}><i className="fa-solid fa-check" aria-hidden="true"></i> {p}</span>
                  ))}
                </div>
              </div>
              <div className="apr-cycle-tick"><i className="fa-solid fa-circle-check" aria-hidden="true"></i></div>
            </button>
          ))}
        </div>
      </SetupCard>

      {/* Step 2 — Grading Scale */}
      <SetupCard
        step="2"
        title="What does each grade mean?"
        sub="Set the score range for each grade. The defaults follow the international 5-point scale."
      >
        <div className="apr-grade-list">
          <div className="apr-grade-head">
            <span>Grade</span><span>From</span><span>To</span><span>What this means</span>
          </div>
          {draft.grades.map((g, idx) => (
            <div className={`apr-grade-row apr-grade-row--${g.tone}`} key={g.id}>
              <span className={`apr-grade-chip apr-grade-chip--${g.tone}`}>{g.label}</span>
              <input
                type="number" className="apr-grade-input"
                value={g.min}
                onChange={(e) => updateGrade(setDraft, idx, 'min', Number(e.target.value))}
                min={0} max={100}
              />
              <input
                type="number" className="apr-grade-input"
                value={g.max}
                onChange={(e) => updateGrade(setDraft, idx, 'max', Number(e.target.value))}
                min={0} max={100}
              />
              <span className="apr-grade-meaning">{g.meaning}</span>
            </div>
          ))}
        </div>
        <div className="apr-warning">
          <i className="fa-solid fa-triangle-exclamation apr-warning-ic" aria-hidden="true"></i>
          <span className="apr-warning-text">
            The score ranges should add up to <b>0 → 100</b> without gaps. A+ is highest; D is lowest.
          </span>
        </div>
      </SetupCard>

      {/* Step 3 — Eligibility */}
      <SetupCard
        step="3"
        title="What score earns each reward?"
        sub="Set the minimum overall score a staff member must hit to qualify for each reward."
      >
        <div className="apr-elig-grid">
          {draft.eligibility.map((e, idx) => (
            <div className={`apr-elig apr-elig--${e.tone}`} key={e.id}>
              <div className="apr-elig-h">
                <div className="apr-elig-ic"><i className={`fa-solid ${e.icon}`} aria-hidden="true"></i></div>
                <div>
                  <div className="apr-elig-title">{e.label}</div>
                  <div className="apr-elig-desc">{e.desc}</div>
                </div>
              </div>
              <div className="apr-elig-control">
                <label className="apr-threshold-label">Min. score</label>
                <input
                  type="number" min={0} max={100}
                  className="apr-threshold-input"
                  value={e.min}
                  onChange={(ev) => updateElig(setDraft, idx, Number(ev.target.value))}
                />
                <span className="apr-elig-suffix">out of 100</span>
              </div>
            </div>
          ))}
        </div>
      </SetupCard>

      {/* Step 4 — Framework */}
      <SetupCard
        step="4"
        title="What do you want to evaluate?"
        sub="The areas below follow the International Standard Teacher Appraisal Framework. Auto items use data the school already collects — no extra typing."
      >
        <div className="apr-frame-stats">
          <span><i className="fa-solid fa-magnifying-glass-chart" aria-hidden="true"></i> {APPRAISAL_FRAMEWORK.length} categories</span>
          <span><i className="fa-solid fa-list-check" aria-hidden="true"></i> {APPRAISAL_FRAMEWORK.reduce((s, c) => s + c.criteria.length, 0)} criteria total</span>
          <span><i className="fa-solid fa-robot" aria-hidden="true"></i> {APPRAISAL_FRAMEWORK.reduce((s, c) => s + c.criteria.filter(x => x.autoSource).length, 0)} can be automated</span>
        </div>

        {/* Live overall category total — always visible */}
        <WeightTotal
          label="Categories total"
          actual={validation.catTotal}
          target={100}
          className="apr-weight-total--lg"
        />

        <div className="apr-frame">
          {APPRAISAL_FRAMEWORK.map((cat, idx) => (
            <FrameworkCategory
              key={cat.id}
              cat={cat}
              draft={draft}
              setDraft={setDraft}
              catInfo={validation.byCat[idx]}
              attemptedSave={attemptedSave}
            />
          ))}
        </div>
      </SetupCard>

      {/* Step 5 — Parent Feedback */}
      <SetupCard
        step="5"
        title="Do you want to include parent feedback?"
        sub="Optional — gather a short feedback score from parents and merge it into the appraisal."
      >
        <div className="apr-toggle-row">
          <Tooltip text={draft.parentFeedback ? 'Disable parent feedback' : 'Enable parent feedback'}>
            <button
              type="button"
              className={`apr-toggle${draft.parentFeedback ? ' on' : ''}`}
              onClick={() => setDraft(d => ({ ...d, parentFeedback: !d.parentFeedback }))}
              role="switch"
              aria-checked={draft.parentFeedback}
              aria-label="Toggle parent feedback"
            >
              <span className="apr-toggle-thumb" />
            </button>
          </Tooltip>
          <div>
            <div className="apr-toggle-title">Parent feedback {draft.parentFeedback ? 'enabled' : 'disabled'}</div>
            <div className="apr-toggle-sub">
              {draft.parentFeedback
                ? 'A parent-feedback panel will appear in every appraisal form.'
                : 'Appraisals will not include a parent-feedback panel.'}
            </div>
          </div>
        </div>
      </SetupCard>

      {/* Sticky action bar */}
      <div className={`apr-stickybar${dirty ? ' dirty' : ''}${(!validation.valid && attemptedSave) ? ' invalid' : ''}`}>
        <div className="apr-stickybar-msg">
          {!validation.valid && attemptedSave
            ? <span><i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Fix the weight errors before saving</span>
            : dirty
              ? <span><i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i> You have unsaved changes</span>
              : <span><i className="fa-solid fa-circle-check" aria-hidden="true"></i> All changes saved</span>}
        </div>
        <div className="apr-stickybar-actions">
          {dirty && (
            <Tooltip text="Discard unsaved changes and go back to the saved version">
              <button type="button" className="apr-btn apr-btn-ghost" onClick={reset}>
                <i className="fa-solid fa-rotate-left" aria-hidden="true"></i> Revert
              </button>
            </Tooltip>
          )}
          <Tooltip text={dirty ? 'Save the changes you\'ve made' : 'Nothing to save — make a change first'}>
            <button
              type="button"
              className={`apr-btn apr-btn-primary${dirty ? '' : ' is-disabled'}`}
              onClick={save}
              disabled={!dirty}
              aria-disabled={!dirty}
            >
              <i className="fa-solid fa-floppy-disk" aria-hidden="true"></i>
              Save Setup
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Weight validation error dialog */}
      {errorOpen && (
        <WeightValidationDialog
          validation={validation}
          onClose={() => setErrorOpen(false)}
        />
      )}
    </>
  );
}

function updateGrade(setDraft, idx, field, value) {
  setDraft(d => ({ ...d, grades: d.grades.map((g, i) => i === idx ? { ...g, [field]: value } : g) }));
}
function updateElig(setDraft, idx, value) {
  setDraft(d => ({ ...d, eligibility: d.eligibility.map((e, i) => i === idx ? { ...e, min: value } : e) }));
}

function SetupCard({ step, title, sub, children }) {
  return (
    <div className="apr-card apr-setup-card">
      <div className="apr-setup-head">
        <span className="apr-step">{step}</span>
        <div>
          <div className="apr-setup-title">{title}</div>
          <div className="apr-setup-sub">{sub}</div>
        </div>
      </div>
      <div className="apr-setup-body">{children}</div>
    </div>
  );
}

/* ─── Step 4 weight validation ──────────────────────────────────────
   Returns a fully-evaluated validation object every render. Two layers
   of rules:
     1. catTotal  — sum of every category's target weight === 100
     2. per-cat   — each category's enabled parameter weights sum to
                    that category's target weight
   The shape is consumed by FrameworkCategory + WeightValidationDialog. */
function validateSetupWeights(setup) {
  const byCat = APPRAISAL_FRAMEWORK.map(cat => {
    const weight     = setup.categoryWeights?.[cat.id] ?? cat.criteria.reduce((s, c) => s + c.weight, 0);
    const paramTotal = cat.criteria.reduce((s, c) => {
      const cfg = setup.criteria[c.id];
      if (cfg?.enabled === false) return s;
      return s + (Number(cfg?.weight) || 0);
    }, 0);
    return {
      catId:       cat.id,
      label:       cat.label,
      weight,
      paramTotal,
      weightValid: paramTotal === weight,
    };
  });
  const catTotal     = byCat.reduce((s, c) => s + c.weight, 0);
  const catTotalOK   = catTotal === 100;
  const allCatsValid = byCat.every(c => c.weightValid);
  return {
    valid:      catTotalOK && allCatsValid,
    catTotal,
    catTotalOK,
    byCat,
  };
}

/* ─── Live total feedback strip ────────────────────────────────────
   Shared by the overall categories total (above the framework list)
   and each per-category parameter total (inside the expanded list).
   Tone is computed from actual vs target: green = match, amber = under,
   red = over. */
function WeightTotal({ label, actual, target, className = '', compactInline = false }) {
  const diff = actual - target;
  const tone = diff === 0 ? 'green' : diff < 0 ? 'amber' : 'red';
  const icon = tone === 'green' ? 'fa-circle-check' : tone === 'amber' ? 'fa-circle-exclamation' : 'fa-triangle-exclamation';
  const msg  = tone === 'green'
    ? <>Total: <b>{actual}%</b> <span className="apr-weight-total-ok">✓</span></>
    : tone === 'amber'
      ? <>Total: <b>{actual}%</b> — needs <b>{Math.abs(diff)}%</b> more</>
      : <>Total: <b>{actual}%</b> — <b>{diff}%</b> over limit</>;
  return (
    <div className={`apr-weight-total apr-weight-total--${tone}${compactInline ? ' apr-weight-total--inline' : ''} ${className}`}>
      <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
      <span className="apr-weight-total-label">{label}</span>
      <span className="apr-weight-total-msg">{msg}</span>
    </div>
  );
}

/* ─── Validation error dialog ──────────────────────────────────────
   Small centred modal with red warning + bullet list of problems +
   single "Go Back & Fix" button. Re-uses .apr-modal--delete chrome. */
function WeightValidationDialog({ validation, onClose }) {
  useModalChrome(onClose);
  const catTotalErr = !validation.catTotalOK;
  const catMismatchErrs = validation.byCat.filter(c => !c.weightValid);
  return createPortal((
    <div
      className="apr-modal-back"
      role="dialog" aria-modal="true" aria-labelledby="apr-wv-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="apr-modal apr-modal--delete apr-modal--validation">
        <div className="apr-modal-body">
          <div className="apr-delete-ic apr-delete-ic--validation">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
          </div>
          <div className="apr-delete-title" id="apr-wv-title">Weights are not balanced</div>
          <div className="apr-delete-body">
            <ul className="apr-wv-list">
              {catTotalErr && (
                <li>
                  <i className="fa-solid fa-circle-dot" aria-hidden="true"></i>
                  Category weights total <b>{validation.catTotal}%</b> — must be exactly <b>100%</b>
                </li>
              )}
              {catMismatchErrs.map(c => (
                <li key={c.catId}>
                  <i className="fa-solid fa-circle-dot" aria-hidden="true"></i>
                  <b>{c.label}</b> parameters total <b>{c.paramTotal}%</b> — must equal the category weight (<b>{c.weight}%</b>)
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="apr-modal-foot apr-modal-foot--center">
          <button type="button" className="apr-btn apr-btn-danger" onClick={onClose}>
            <i className="fa-solid fa-arrow-left" aria-hidden="true"></i> Go Back &amp; Fix
          </button>
        </div>
      </div>
    </div>
  ), document.body);
}

/* One evaluation category with collapsible criterion list. */
function FrameworkCategory({ cat, draft, setDraft, catInfo, attemptedSave }) {
  const [open, setOpen] = useState(false);
  const enabledCount = cat.criteria.filter(c => draft.criteria[c.id]?.enabled !== false).length;

  /* `catInfo` comes from the validation result and tells us:
       · weight       — the category's editable target weight
       · paramTotal   — sum of enabled parameter weights
       · weightValid  — params == target
   */
  const catWeight   = catInfo?.weight     ?? 0;
  const paramTotal  = catInfo?.paramTotal ?? 0;
  const weightValid = catInfo?.weightValid;
  const showError   = attemptedSave && !weightValid;

  const setCatWeight = (w) => setDraft(d => ({
    ...d,
    categoryWeights: { ...(d.categoryWeights || {}), [cat.id]: Number(w) || 0 },
  }));

  return (
    <div className={`apr-cat apr-cat--${cat.tone}${open ? ' open' : ''}${showError ? ' has-error' : ''}`}>
      <div className="apr-cat-head-wrap">
        <button
          type="button"
          className="apr-cat-head"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          <div className="apr-cat-ic"><i className={`fa-solid ${cat.icon}`} aria-hidden="true"></i></div>
          <div className="apr-cat-body">
            <div className="apr-cat-h">
              {cat.label}
              {weightValid && (
                <Tooltip text="Parameters add up correctly">
                  <span className="apr-cat-check" aria-label="Balanced">
                    <i className="fa-solid fa-check" aria-hidden="true"></i>
                  </span>
                </Tooltip>
              )}
            </div>
            <div className="apr-cat-desc">{cat.desc}</div>
          </div>
          <div className="apr-cat-stats">
            <span className="apr-cat-stat"><b>{enabledCount}</b>/{cat.criteria.length} on</span>
            <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'} apr-cat-chev`} aria-hidden="true"></i>
          </div>
        </button>

        {/* Editable category weight pill — sits next to the chevron, on its own click target so toggling open doesn't fight the input */}
        <div
          className={`apr-cat-weight${showError ? ' has-error' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <label className="apr-cat-weight-lbl">Cat. weight</label>
          <div className="apr-weight-pill">
            <input
              type="number"
              min={0} max={100}
              className={`apr-weight-input${showError ? ' has-error' : ''}`}
              value={catWeight}
              onChange={(e) => setCatWeight(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              aria-label={`${cat.label} category weight`}
            />
            <span className="apr-weight-suffix">%</span>
          </div>
        </div>
      </div>

      {open && (
        <div className="apr-criteria">
          {cat.criteria.map(c => (
            <CriterionRow
              key={c.id}
              cat={cat}
              crit={c}
              draft={draft}
              setDraft={setDraft}
              showError={showError}
            />
          ))}

          {/* Per-category running total — always visible */}
          <WeightTotal
            label={`${cat.label} parameters total`}
            actual={paramTotal}
            target={catWeight}
            compactInline
          />
        </div>
      )}
    </div>
  );
}

function CriterionRow({ cat, crit, draft, setDraft, showError }) {
  const cfg     = draft.criteria[crit.id] || { mode: crit.autoSource ? 'auto' : 'manual', weight: crit.weight, enabled: true };
  const autoOK  = !!crit.autoSource;
  const source  = autoOK ? APPRAISAL_AUTO_SOURCES[crit.autoSource] : null;
  /* Only mark the weight input red if this row is enabled AND its
     parent category is in an error state. Disabled rows are excluded
     from the total so they're not "at fault". */
  const weightError = showError && cfg.enabled !== false;
  const toggleEnabled = () => setDraft(d => ({
    ...d,
    criteria: { ...d.criteria, [crit.id]: { ...cfg, enabled: !cfg.enabled } },
  }));
  const setMode = (mode) => setDraft(d => ({
    ...d,
    criteria: { ...d.criteria, [crit.id]: { ...cfg, mode } },
  }));
  const setWeight = (w) => setDraft(d => ({
    ...d,
    criteria: { ...d.criteria, [crit.id]: { ...cfg, weight: Number(w) || 0 } },
  }));

  return (
    <div className={`apr-crit${cfg.enabled === false ? ' off' : ''}`}>
      <div className="apr-crit-head">
        <Tooltip text={cfg.enabled === false ? 'Enable this criterion' : 'Disable this criterion'}>
          <button
            type="button"
            className={`apr-toggle apr-toggle--sm${cfg.enabled !== false ? ' on' : ''}`}
            onClick={toggleEnabled}
            role="switch"
            aria-checked={cfg.enabled !== false}
            aria-label={`Toggle ${crit.name}`}
          >
            <span className="apr-toggle-thumb" />
          </button>
        </Tooltip>
        <div className="apr-crit-text">
          <div className="apr-crit-h">
            {crit.name}
            <span className={`apr-crit-tag apr-crit-tag--${cfg.mode}`}>
              <i className={`fa-solid ${cfg.mode === 'auto' ? 'fa-robot' : 'fa-pen'}`} aria-hidden="true"></i>
              {cfg.mode === 'auto' ? 'Auto' : 'Manual'}
            </span>
          </div>
          <div className="apr-crit-desc">{crit.desc}</div>
        </div>
        <div className="apr-crit-weight">
          <label>Weight</label>
          <div className={`apr-weight-pill${weightError ? ' has-error' : ''}`}>
            <input
              type="number"
              min={0} max={100}
              className={`apr-weight-input${weightError ? ' has-error' : ''}`}
              value={cfg.weight}
              onChange={(e) => setWeight(e.target.value)}
              aria-invalid={weightError ? 'true' : undefined}
            />
            <span className="apr-weight-suffix">%</span>
          </div>
          {weightError && (
            <div className="apr-input-error-hint">
              <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i> Adjust this value
            </div>
          )}
        </div>
      </div>

      <div className="apr-crit-grid">
        <CriterionInfo label="What we measure" body={crit.desc} icon="fa-magnifying-glass" />
        <CriterionInfo label="Why it matters"  body={crit.why}  icon="fa-heart-pulse" />
        <CriterionInfo
          label="How the score is calculated"
          body={cfg.mode === 'auto'
            ? (crit.calc || 'System-generated from existing ERP data.')
            : `Principal / Coordinator gives a score 0–100 in line with the guidance below.`}
          icon={cfg.mode === 'auto' ? 'fa-robot' : 'fa-pen-to-square'}
        />
        <CriterionInfo
          label="Score guidance"
          body={
            <div className="apr-crit-guide">
              <div><span className="apr-crit-guide-tag tone-green">Excellent</span> {crit.guidance.excellent}</div>
              <div><span className="apr-crit-guide-tag tone-blue">Good</span>       {crit.guidance.good}</div>
              <div><span className="apr-crit-guide-tag tone-orange">Average</span>  {crit.guidance.average}</div>
              <div><span className="apr-crit-guide-tag tone-red">Poor</span>        {crit.guidance.poor}</div>
            </div>
          }
          icon="fa-list-ol"
        />
      </div>

      {/* Auto / Manual control */}
      <div className="apr-crit-mode">
        <label className={`apr-rad${cfg.mode === 'auto' ? ' on' : ''}${!autoOK ? ' disabled' : ''}`}>
          <input
            type="radio"
            checked={cfg.mode === 'auto'}
            onChange={() => autoOK && setMode('auto')}
            disabled={!autoOK}
          />
          <span className="apr-rad-dot" />
          <span className="apr-rad-body">
            <span className="apr-rad-h"><i className="fa-solid fa-robot" aria-hidden="true"></i> Auto (System Generated)</span>
            <span className="apr-rad-sub">
              {autoOK
                ? <>Pulled from <b>{source.module}</b> · {source.what}</>
                : <>Not available — the data needed for this isn’t collected by the ERP yet.</>}
            </span>
          </span>
        </label>
        <label className={`apr-rad${cfg.mode === 'manual' ? ' on' : ''}`}>
          <input
            type="radio"
            checked={cfg.mode === 'manual'}
            onChange={() => setMode('manual')}
          />
          <span className="apr-rad-dot" />
          <span className="apr-rad-body">
            <span className="apr-rad-h"><i className="fa-solid fa-pen" aria-hidden="true"></i> Manual (Principal / Coordinator Evaluation)</span>
            <span className="apr-rad-sub">Reviewer types a score 0–100 with comments.</span>
          </span>
        </label>
      </div>
    </div>
  );
}

function CriterionInfo({ label, body, icon }) {
  return (
    <div className="apr-crit-info">
      <div className="apr-crit-info-h"><i className={`fa-solid ${icon}`} aria-hidden="true"></i> {label}</div>
      <div className="apr-crit-info-b">{body}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   APPRAISALS SECTION — list + conduct modal
   ═══════════════════════════════════════════════════════════════════ */
function AppraisalsSection({ setup, emps, depts, desigs, appraisals, setAppraisals, nextId, setNextId, toast }) {
  const [search,     setSearch]     = useState('');
  const [fPeriod,    setFPeriod]    = useState('');
  const [fStatus,    setFStatus]    = useState('all');
  /* Four discrete modal states — one per workflow. */
  const [newOpen,    setNewOpen]    = useState(false);
  const [viewItem,   setViewItem]   = useState(null);
  const [editItem,   setEditItem]   = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);

  const empMap   = useMemo(() => new Map(emps.map(e => [e.id, e])), [emps]);
  const deptMap  = useMemo(() => new Map(depts.map(d => [d.id, d])), [depts]);
  const desigMap = useMemo(() => new Map(desigs.map(d => [d.id, d])), [desigs]);

  const periods = useMemo(() => {
    const s = new Set(appraisals.map(a => a.period));
    return Array.from(s).sort().reverse();
  }, [appraisals]);

  const filtered = useMemo(() => appraisals
    .filter(a => !fPeriod || a.period === fPeriod)
    .filter(a => fStatus === 'all' || a.status === fStatus)
    .map(a => {
      const overall = computeOverall(setup, a.scores);
      const grade   = gradeFor(overall, setup.grades);
      const emp     = empMap.get(a.empId);
      return { ...a, overall, grade, emp };
    })
    .filter(a => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const hay = `${getFullName(a.emp)} ${a.emp?.eid || ''} ${deptMap.get(a.emp?.dId)?.name || ''}`.toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => b.conductedAt.localeCompare(a.conductedAt)), [appraisals, fPeriod, fStatus, setup, empMap, deptMap, search]);

  /* Totals run on the *whole* set, not the filtered view — so the
     stat strip stays a stable summary while filters narrow the table. */
  const totals = useMemo(() => {
    const all       = appraisals.map(a => ({ ...a, overall: computeOverall(setup, a.scores) }));
    const completed = all.filter(a => a.status === 'completed');
    const drafts    = all.filter(a => a.status !== 'completed');
    return {
      total:    all.length,
      complete: completed.length,
      drafts:   drafts.length,
      avg:      completed.length
        ? Math.round(completed.reduce((s, a) => s + a.overall, 0) / completed.length)
        : null,
    };
  }, [appraisals, setup]);

  /* Commit a brand-new appraisal — assigns the next id, appends to the
     list, toasts success, fire-and-forget service call. */
  const handleNewSave = (payload) => {
    const id = nextId;
    const record = { ...payload, id };
    setAppraisals(prev => [...prev, record]);
    setNextId(id + 1);
    appraisalService.saveAppraisal(record).catch(() => {});
    toast('Appraisal saved successfully', 'success');
    setNewOpen(false);
  };

  /* Commit edits to an existing appraisal in-place. */
  const handleEditSave = (payload) => {
    setAppraisals(prev => prev.map(a => (a.id === payload.id ? { ...a, ...payload } : a)));
    appraisalService.saveAppraisal(payload).catch(() => {});
    toast('Appraisal updated', 'success');
    setEditItem(null);
  };

  /* Confirmed delete — removes row, toasts. */
  const handleDeleteConfirm = (item) => {
    setAppraisals(prev => prev.filter(a => a.id !== item.id));
    appraisalService.deleteAppraisal({ id: item.id }).catch(() => {});
    toast('Appraisal deleted', 'success');
    setDeleteItem(null);
  };

  const hasAny = appraisals.length > 0;

  return (
    <>
      {/* ── Intro banner ── */}
      <div className="apr-intro">
        <div className="apr-intro-ic"><i className="fa-solid fa-clipboard-user" aria-hidden="true"></i></div>
        <div>
          <div className="apr-intro-title">Run a new appraisal in 3 simple steps</div>
          <div className="apr-intro-body">
            Click <b>New Appraisal</b> → pick a staff member → score each area. Auto items are filled for you; just review and add comments.
          </div>
        </div>
      </div>

      {/* ── 4-column stats grid ── */}
      <div className="apr-stats">
        <ApprStat
          label="Total Appraisals"
          value={totals.total}
          icon="fa-clipboard-user"
          tone="blue"
          sub={hasAny ? `Across ${periods.length} period${periods.length === 1 ? '' : 's'}` : 'No records yet'}
        />
        <ApprStat
          label="Completed"
          value={totals.complete}
          icon="fa-circle-check"
          tone="green"
          sub={hasAny ? `${pct(totals.complete, totals.total)}% of all` : '—'}
        />
        <ApprStat
          label="Drafts"
          value={totals.drafts}
          icon="fa-pen-ruler"
          tone="orange"
          sub={totals.drafts ? 'Pending review' : 'No drafts'}
        />
        <ApprStat
          label="Avg Overall"
          value={totals.avg != null ? `${totals.avg}%` : '—'}
          icon="fa-percent"
          tone="indigo"
          sub={totals.avg != null ? `Grade ${gradeFor(totals.avg, setup.grades)?.label || '—'}` : 'Run a few first'}
        />
      </div>

      {/* ── Filter row — single row, 38px heights, pill-rounded ── */}
      <div className="apr-filters">
        <div className="apr-search">
          <i className="fa-solid fa-magnifying-glass apr-search-ic" aria-hidden="true"></i>
          <input
            type="text"
            className="apr-search-input"
            placeholder="Search by employee name, EID or department…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search appraisals"
          />
          {search && (
            <Tooltip text="Clear search">
              <button
                type="button"
                className="apr-search-clear"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <i className="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </Tooltip>
          )}
        </div>
        <select
          className="apr-select"
          value={fPeriod}
          onChange={(e) => setFPeriod(e.target.value)}
          aria-label="Filter by period"
        >
          <option value="">All periods</option>
          {periods.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          className="apr-select"
          value={fStatus}
          onChange={(e) => setFStatus(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="all">All status</option>
          <option value="completed">Completed only</option>
          <option value="draft">Drafts only</option>
        </select>
        <Tooltip text="Start a new appraisal for a staff member">
          <button
            type="button"
            className="apr-add-btn"
            onClick={() => setNewOpen(true)}
            aria-label="Create new appraisal"
          >
            <i className="fa-solid fa-plus" aria-hidden="true"></i>
            New Appraisal
          </button>
        </Tooltip>
      </div>

      {/* ── Empty states or table ── */}
      {!hasAny ? (
        <div className="apr-empty">
          <div className="apr-empty-ic"><i className="fa-solid fa-clipboard" aria-hidden="true"></i></div>
          <div className="apr-empty-title">No appraisals yet</div>
          <div className="apr-empty-sub">
            Evaluate your first staff member to get started — the form auto-fills auto-scored items so you just review and confirm.
          </div>
          <button
            type="button"
            className="apr-add-btn apr-empty-cta"
            onClick={() => setNewOpen(true)}
          >
            <i className="fa-solid fa-plus" aria-hidden="true"></i> Start your first Appraisal
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="apr-empty">
          <div className="apr-empty-ic apr-empty-ic--muted"><i className="fa-solid fa-filter-circle-xmark" aria-hidden="true"></i></div>
          <div className="apr-empty-title">No matches for the current filters</div>
          <div className="apr-empty-sub">Try clearing the search or status filter.</div>
        </div>
      ) : (
        <div className="apr-table">
          {/* Column headers */}
          <div className="apr-table-head">
            <div className="th">Employee</div>
            <div className="th">Department</div>
            <div className="th">Period</div>
            <div className="th c">Overall</div>
            <div className="th c">Grade</div>
            <div className="th c">Status</div>
            <div className="th">Conducted by</div>
            <div className="th c">Actions</div>
          </div>

          {filtered.map(a => (
            <div className="apr-table-row" key={a.id}>
              {/* Employee */}
              <div className="td apr-emp">
                <div className="apr-avatar" aria-hidden="true">
                  {a.emp?.photo
                    ? <img src={a.emp.photo} alt="" />
                    : initialsOf(a.emp)}
                </div>
                <div className="apr-emp-text">
                  <div className="apr-name">{getFullName(a.emp)}</div>
                  <div className="apr-eid">{a.emp?.eid}</div>
                </div>
              </div>

              {/* Department */}
              <div className="td apr-dept">
                <span className="apr-dept-pill">{deptMap.get(a.emp?.dId)?.name || '—'}</span>
                <span className="apr-desig">{desigMap.get(a.emp?.desId)?.name || '—'}</span>
              </div>

              {/* Period */}
              <div className="td">
                <div className="apr-period">{a.period}</div>
                <div className="apr-cycle">{a.cycle}</div>
              </div>

              {/* Overall % */}
              <div className="td c">
                <span className="apr-overall-num">
                  {Math.round(a.overall)}<small>%</small>
                </span>
              </div>

              {/* Grade */}
              <div className="td c"><GradePill grade={a.grade} /></div>

              {/* Status */}
              <div className="td c">
                <span className={`apr-status apr-status--${a.status === 'completed' ? 'done' : 'draft'}`}>
                  <i className={`fa-solid ${a.status === 'completed' ? 'fa-circle-check' : 'fa-pen-ruler'}`} aria-hidden="true"></i>
                  {a.status === 'completed' ? 'Completed' : 'Draft'}
                </span>
              </div>

              {/* Conducted by */}
              <div className="td apr-by">
                <div className="apr-by-name">
                  <i className="fa-solid fa-user-tie" aria-hidden="true"></i>
                  {a.conductedBy}
                </div>
                <div className="apr-by-date">{a.conductedAt}</div>
              </div>

              {/* Actions — view / edit / delete */}
              <div className="td c apr-actions">
                <Tooltip text="View details">
                  <button
                    type="button"
                    className="apr-act"
                    onClick={() => setViewItem(a)}
                    aria-label="View appraisal"
                  >
                    <i className="fa-solid fa-eye" aria-hidden="true"></i>
                  </button>
                </Tooltip>
                <Tooltip text="Edit scores & remarks">
                  <button
                    type="button"
                    className="apr-act"
                    onClick={() => setEditItem(a)}
                    aria-label="Edit appraisal"
                  >
                    <i className="fa-solid fa-pen" aria-hidden="true"></i>
                  </button>
                </Tooltip>
                <Tooltip text="Delete">
                  <button
                    type="button"
                    className="apr-act apr-act--danger"
                    onClick={() => setDeleteItem(a)}
                    aria-label="Delete appraisal"
                  >
                    <i className="fa-solid fa-trash" aria-hidden="true"></i>
                  </button>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {newOpen && (
        <NewAppraisalModal
          setup={setup}
          emps={emps} depts={depts} desigs={desigs}
          onClose={() => setNewOpen(false)}
          onSave={handleNewSave}
          toast={toast}
        />
      )}
      {viewItem && (
        <ViewAppraisalModal
          item={viewItem}
          setup={setup}
          emps={emps} depts={depts} desigs={desigs}
          onClose={() => setViewItem(null)}
        />
      )}
      {editItem && (
        <EditAppraisalModal
          item={editItem}
          setup={setup}
          emps={emps} depts={depts} desigs={desigs}
          onClose={() => setEditItem(null)}
          onSave={handleEditSave}
          toast={toast}
        />
      )}
      {deleteItem && (
        <DeleteAppraisalModal
          item={deleteItem}
          emp={emps.find(e => e.id === deleteItem.empId)}
          onClose={() => setDeleteItem(null)}
          onConfirm={() => handleDeleteConfirm(deleteItem)}
        />
      )}
    </>
  );
}

function ApprStat({ label, value, icon, tone, sub }) {
  return (
    <div className={`apr-stat apr-stat--${tone}`}>
      <div className="apr-stat-ic"><i className={`fa-solid ${icon}`} aria-hidden="true"></i></div>
      <div className="apr-stat-lbl">{label}</div>
      <div className="apr-stat-val">{value}</div>
      {sub && <div className="apr-stat-sub">{sub}</div>}
    </div>
  );
}

function pct(part, total) { return total > 0 ? Math.round((part / total) * 100) : 0; }

function GradePill({ grade }) {
  if (!grade) return <span className="apr-grade-pill apr-grade-pill--red">—</span>;
  return (
    <Tooltip text={grade.meaning}>
      <span className={`apr-grade-pill apr-grade-pill--${grade.tone}`}>
        {grade.label}
      </span>
    </Tooltip>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   APPRAISAL MODALS — shared helpers + 4 distinct workflows
     · NewAppraisalModal     (3-step wizard)
     · ViewAppraisalModal    (read-only)
     · EditAppraisalModal    (prefilled scoring)
     · DeleteAppraisalModal  (confirm)
   ═══════════════════════════════════════════════════════════════════ */

/* Fixed period options exposed in the wizard's step 2 dropdown. */
const APR_PERIOD_OPTIONS = [
  '2026-Q1',
  '2026-Q2',
  'Mid-Year 2026',
  'Annual 2025–26',
];

const APR_CYCLE_OPTIONS = [
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'biannual',  label: 'Bi-Annual' },
  { id: 'annual',    label: 'Annual'    },
];

/* Pull employees whose `role` reads like Principal / Coordinator / Admin,
   so the "Conducted by" picker shows the people who actually run reviews.
   Falls back to all active employees when no role string contains the
   keyword — the modal must never offer an empty dropdown. */
function adminLikeEmps(emps) {
  const wanted = /(principal|coord|admin|director|head)/i;
  const filtered = emps.filter(e => wanted.test(e.role || '') || wanted.test(e.desig || ''));
  return filtered.length ? filtered : emps.filter(e => e.status === 'Active' || !e.status);
}

/* Lock body scroll + Esc-to-close — repeated in every modal. */
function useModalChrome(onClose) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
}

/* Compute the live overall % + grade from the current scores draft.
   Pure — used by both New and Edit. */
function liveOverall(setup, scores) {
  const overall = computeOverall(setup, scores);
  return { overall, grade: gradeFor(overall, setup.grades) };
}

/* Build initial scores from an existing record (used by Edit and View). */
function scoresFrom(item) {
  return { ...(item.scores || {}) };
}

/* ═══════════════════════════════════════════════════════════════════
   NEW APPRAISAL MODAL — 3-step wizard
   ═══════════════════════════════════════════════════════════════════ */
function NewAppraisalModal({ setup, emps, depts, desigs, onClose, onSave, toast }) {
  useModalChrome(onClose);
  const today    = new Date().toISOString().slice(0, 10);
  const deptMap  = useMemo(() => new Map(depts.map(d => [d.id, d])),  [depts]);

  /* Step 0 wizard state */
  const [step,        setStep]        = useState(1);
  const [staffSearch, setStaffSearch] = useState('');
  const [staffId,     setStaffId]     = useState('');
  const [period,      setPeriod]      = useState(APR_PERIOD_OPTIONS[0]);
  const [cycle,       setCycle]       = useState('quarterly');
  const [conductedBy, setConductedBy] = useState('');
  const [conductedAt, setConductedAt] = useState(today);
  const [remarks,     setRemarks]     = useState('');
  const [scores,        setScores]        = useState({});
  const [comments,      setComments]      = useState({});  // { criterionId: 'remarks text' } for manual rows
  const [overrides,     setOverrides]     = useState({});  // { criterionId: true } when user unlocks an auto row
  const [increment,     setIncrement]     = useState(false);
  const [bonus,         setBonus]         = useState(false);
  const [bonusAmount,   setBonusAmount]   = useState('');
  const [finalRemarks,  setFinalRemarks]  = useState('');
  const [incPct,        setIncPct]        = useState(5);

  const reviewers = useMemo(() => adminLikeEmps(emps), [emps]);
  useEffect(() => {
    if (!conductedBy && reviewers.length) setConductedBy(getFullName(reviewers[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewers]);

  /* Filtered staff list for Step 1 (search by name or EID). */
  const filteredStaff = useMemo(() => {
    const q = staffSearch.trim().toLowerCase();
    const list = emps.filter(e => e.status !== 'Inactive');
    if (!q) return list;
    return list.filter(e => {
      const hay = `${getFullName(e)} ${e.eid || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [emps, staffSearch]);

  /* Auto-prefetch the auto criteria scores once the user picks a staff member. */
  useEffect(() => {
    if (!staffId) return;
    const targets = APPRAISAL_FRAMEWORK
      .flatMap(c => c.criteria)
      .filter(c => c.autoSource && (setup.criteria[c.id]?.mode || 'auto') === 'auto');
    let cancelled = false;
    (async () => {
      const updates = {};
      for (const c of targets) {
        const v = await appraisalService.getAutoScore(Number(staffId), c.id);
        if (v != null) updates[c.id] = v;
      }
      if (!cancelled) setScores(s => ({ ...updates, ...s }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId]);

  const selectedStaff = emps.find(e => e.id === Number(staffId));
  const selectedDept  = deptMap.get(selectedStaff?.dId);
  const { overall, grade } = liveOverall(setup, scores);

  /* Step 1 next is gated by a chosen staff member. */
  const canNext1 = !!staffId;
  /* Save is gated by every enabled MANUAL criterion having a numeric value. */
  const canSave = useMemo(() => {
    return APPRAISAL_FRAMEWORK.every(cat => cat.criteria.every(c => {
      const cfg = setup.criteria[c.id];
      if (cfg?.enabled === false) return true;
      const isAuto = cfg?.mode === 'auto' && !overrides[c.id];
      if (isAuto) return scores[c.id] != null;     // auto must have a fetched value
      const v = scores[c.id];
      return v != null && v !== '' && !Number.isNaN(Number(v));
    }));
  }, [scores, setup, overrides]);

  const setScore   = (id, v) => setScores(s => ({ ...s, [id]: v === '' ? '' : Number(v) }));
  const setComment = (id, v) => setComments(c => ({ ...c, [id]: v }));

  const onSubmit = () => {
    if (!canSave) { toast('Score every parameter before saving', 'error'); return; }
    onSave({
      empId:       Number(staffId),
      period,
      cycle,
      conductedBy,
      conductedAt,
      status:      'completed',
      scores,
      comments,
      remarks,
      incrementRecommended: increment,
      incrementPercent:     increment ? Number(incPct)       || 0 : 0,
      bonusRecommended:     bonus,
      bonusAmount:          bonus     ? Number(bonusAmount)  || 0 : 0,
      finalRemarks,
    });
  };

  return createPortal((
    <div
      className="apr-modal-back"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apr-new-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="apr-modal apr-modal--scoring">
        {/* Sticky head */}
        <div className="apr-modal-head">
          <div className="apr-modal-head-title">
            <div className="apr-modal-icn"><i className="fa-solid fa-clipboard-user" aria-hidden="true"></i></div>
            <div>
              <div className="apr-modal-title" id="apr-new-title">New Appraisal</div>
              <div className="apr-modal-sub">
                {step === 1 ? 'Step 1 · Pick the staff member you want to evaluate'
                 : step === 2 ? 'Step 2 · Set the period & details'
                 : 'Step 3 · Score each parameter'}
              </div>
            </div>
          </div>
          <Tooltip text="Close (Esc)">
            <button className="apr-modal-x" onClick={onClose} aria-label="Close modal">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>

        {/* Stepper rail */}
        <div className="apr-stepper">
          <StepPill n={1} label="Pick Staff"      active={step === 1} done={step > 1} />
          <StepPill n={2} label="Details"         active={step === 2} done={step > 2} />
          <StepPill n={3} label="Score"           active={step === 3} done={false}    />
        </div>

        {/* Scrollable body */}
        <div className="apr-modal-body">
          {step === 1 && (
            <div className="apr-staff-picker">
              <div className="apr-search">
                <i className="fa-solid fa-magnifying-glass apr-search-ic" aria-hidden="true"></i>
                <input
                  type="text"
                  className="apr-search-input"
                  placeholder="Search by name or EID…"
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  aria-label="Search staff"
                  autoFocus
                />
              </div>
              <div className="apr-staff-list">
                {filteredStaff.length === 0 ? (
                  <div className="apr-staff-empty">
                    <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                    No staff match "{staffSearch}"
                  </div>
                ) : filteredStaff.map(e => {
                  const dept = deptMap.get(e.dId)?.name;
                  const on   = String(staffId) === String(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      className={`apr-staff-row${on ? ' on' : ''}`}
                      onClick={() => setStaffId(e.id)}
                    >
                      <div className="apr-staff-avatar">
                        {e.photo
                          ? <img src={e.photo} alt="" />
                          : initialsOf(e)}
                      </div>
                      <div className="apr-staff-text">
                        <div className="apr-staff-name">{getFullName(e)}</div>
                        <div className="apr-staff-meta">
                          <span>{e.eid}</span>
                          {dept && <><span className="apr-staff-dot" aria-hidden="true">·</span><span>{dept}</span></>}
                        </div>
                      </div>
                      <div className="apr-staff-radio" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="apr-detail-grid">
              <div className="apr-field-group">
                <label className="apr-field-label">Period</label>
                <select className="apr-input" value={period} onChange={(e) => setPeriod(e.target.value)}>
                  {APR_PERIOD_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="apr-field-group">
                <label className="apr-field-label">Cycle Type</label>
                <div className="apr-segmented">
                  {APR_CYCLE_OPTIONS.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className={`apr-segmented-btn${cycle === c.id ? ' on' : ''}`}
                      onClick={() => setCycle(c.id)}
                    >{c.label}</button>
                  ))}
                </div>
              </div>
              <div className="apr-field-group">
                <label className="apr-field-label">Conducted by</label>
                <select className="apr-input" value={conductedBy} onChange={(e) => setConductedBy(e.target.value)}>
                  {reviewers.map(r => <option key={r.id} value={getFullName(r)}>{getFullName(r)}</option>)}
                </select>
              </div>
              <div className="apr-field-group">
                <label className="apr-field-label">Appraisal Date</label>
                <input type="date" className="apr-input" value={conductedAt} onChange={(e) => setConductedAt(e.target.value)} />
              </div>
              <div className="apr-field-group span2">
                <label className="apr-field-label">Notes / Remarks <span className="apr-field-optional">(optional)</span></label>
                <textarea
                  className="apr-textarea"
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Anything relevant to this appraisal — context, scope, special notes…"
                />
              </div>
              {selectedStaff && (
                <div className="apr-field-group span2">
                  <div className="apr-staff-readout">
                    <div className="apr-staff-avatar sm">
                      {selectedStaff.photo
                        ? <img src={selectedStaff.photo} alt="" />
                        : initialsOf(selectedStaff)}
                    </div>
                    <div>
                      <div className="apr-staff-name">{getFullName(selectedStaff)}</div>
                      <div className="apr-staff-meta">
                        <span>{selectedStaff.eid}</span>
                        {selectedDept && <><span className="apr-staff-dot">·</span><span>{selectedDept.name}</span></>}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <ScoringBody
              setup={setup}
              scores={scores}
              setScore={setScore}
              comments={comments}
              setComment={setComment}
              overrides={overrides}
              setOverrides={setOverrides}
              overall={overall}
              grade={grade}
              increment={increment}
              setIncrement={setIncrement}
              incPct={incPct}
              setIncPct={setIncPct}
              bonus={bonus}
              setBonus={setBonus}
              bonusAmount={bonusAmount}
              setBonusAmount={setBonusAmount}
              finalRemarks={finalRemarks}
              setFinalRemarks={setFinalRemarks}
            />
          )}
        </div>

        {/* Sticky foot */}
        <div className="apr-modal-foot">
          <button type="button" className="apr-btn apr-btn-ghost" onClick={onClose}>Cancel</button>
          <div className="apr-modal-foot-right">
            {step > 1 && (
              <button type="button" className="apr-btn apr-btn-ghost" onClick={() => setStep(s => s - 1)}>
                <i className="fa-solid fa-arrow-left" aria-hidden="true"></i> Back
              </button>
            )}
            {step < 3 && (
              <button
                type="button"
                className={`apr-btn apr-btn-primary${(step === 1 && !canNext1) ? ' is-disabled' : ''}`}
                onClick={() => setStep(s => s + 1)}
                disabled={step === 1 && !canNext1}
              >
                Next <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                className={`apr-btn apr-btn-primary${canSave ? '' : ' is-disabled'}`}
                onClick={onSubmit}
                disabled={!canSave}
              >
                <i className="fa-solid fa-circle-check" aria-hidden="true"></i> Save Appraisal
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  ), document.body);
}

/* ─── Step pill in the stepper rail ─── */
function StepPill({ n, label, active, done }) {
  return (
    <div className={`apr-step-pill${active ? ' active' : ''}${done ? ' done' : ''}`}>
      <span className="apr-step-num">{done ? <i className="fa-solid fa-check" aria-hidden="true"></i> : n}</span>
      <span className="apr-step-label">{label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   AUTO INFO POPOVER + MANUAL REMARKS FIELD
   Used inside ScoringBody. Self-contained — no external state.
   ═══════════════════════════════════════════════════════════════════ */

/* Trigger button (the small ⓘ icon) — opens the popover card on click. */
function AutoInfoButton({ crit, score }) {
  const [open, setOpen]   = useState(false);
  const anchorRef         = useRef(null);
  return (
    <>
      <Tooltip text="How is this score calculated?">
        <button
          ref={anchorRef}
          type="button"
          className="apr-auto-info-btn"
          onClick={() => setOpen(o => !o)}
          aria-label="Show calculation details"
          aria-expanded={open}
        >
          <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
        </button>
      </Tooltip>
      {open && (
        <AutoInfoPopover
          crit={crit}
          score={score}
          anchorRef={anchorRef}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/* Portal-mounted popover card. Auto-positions below the anchor, or above
   if there's no room below. Closes on outside click or Esc. */
function AutoInfoPopover({ crit, score, anchorRef, onClose }) {
  const cardRef             = useRef(null);
  const [pos, setPos]       = useState(null);

  /* Compute position once on mount + on window resize. */
  useEffect(() => {
    function place() {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const W = 280;
      const margin = 8;
      const H = 360; // approx; used only for placement decision
      const spaceBelow = window.innerHeight - rect.bottom;
      const placeBelow = spaceBelow > H || spaceBelow > rect.top;
      let left = rect.left + rect.width / 2 - W / 2;
      if (left + W > window.innerWidth - margin) left = window.innerWidth - W - margin;
      if (left < margin) left = margin;
      const top  = placeBelow ? rect.bottom + margin : Math.max(margin, rect.top - H - margin);
      setPos({ top, left, w: W });
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchorRef]);

  /* Outside-click + Esc to close. */
  useEffect(() => {
    const onClick = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)
       && anchorRef.current && !anchorRef.current.contains(e.target)) {
        onClose();
      }
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, anchorRef]);

  if (!pos) return null;
  const source = APPRAISAL_AUTO_SOURCES[crit.autoSource];
  const sourceText = source ? `${source.module} · ${source.what}` : 'ERP data';

  return createPortal((
    <div
      ref={cardRef}
      className="apr-auto-info-card"
      role="dialog"
      style={{ top: pos.top, left: pos.left, width: pos.w }}
    >
      <div className="apr-auto-info-section">
        <div className="apr-auto-info-h">
          <i className="fa-solid fa-thumbtack" aria-hidden="true"></i> Data Source
        </div>
        <div className="apr-auto-info-body">Pulled from <b>{sourceText}</b></div>
      </div>

      <div className="apr-auto-info-section">
        <div className="apr-auto-info-h">
          <i className="fa-solid fa-calculator" aria-hidden="true"></i> How It's Calculated
        </div>
        <code className="apr-auto-info-formula">
          {crit.calc || `Computed automatically from ${source?.module || 'ERP'} data.`}
        </code>
      </div>

      <div className="apr-auto-info-section">
        <div className="apr-auto-info-h">
          <i className="fa-solid fa-chart-simple" aria-hidden="true"></i> What This Score Means
        </div>
        <div className="apr-auto-info-bands">
          <div className="apr-auto-info-band">
            <span className="apr-band-chip apr-band-chip--green">Excellent</span>
            <span className="apr-band-body">{crit.guidance.excellent}</span>
          </div>
          <div className="apr-auto-info-band">
            <span className="apr-band-chip apr-band-chip--blue">Good</span>
            <span className="apr-band-body">{crit.guidance.good}</span>
          </div>
          <div className="apr-auto-info-band">
            <span className="apr-band-chip apr-band-chip--amber">Average</span>
            <span className="apr-band-body">{crit.guidance.average}</span>
          </div>
          <div className="apr-auto-info-band">
            <span className="apr-band-chip apr-band-chip--red">Poor</span>
            <span className="apr-band-body">{crit.guidance.poor}</span>
          </div>
        </div>
      </div>

      <div className="apr-auto-info-section">
        <div className="apr-auto-info-h">
          <i className="fa-solid fa-hashtag" aria-hidden="true"></i> Current Value
        </div>
        <div className="apr-auto-info-current">
          This staff member scored: <b>{score ?? '—'} / 100</b>
        </div>
      </div>

      <div className="apr-auto-info-note">
        This value was automatically fetched. You can override it using the edit (<i className="fa-solid fa-pen-to-square" aria-hidden="true"></i>) icon.
      </div>
    </div>
  ), document.body);
}

/* Inline remarks textarea — only shown on manual rows. 200-char limit
   with a live counter at the bottom-right. */
function ManualRemarksField({ value, onChange }) {
  const max = 200;
  const len = (value || '').length;
  return (
    <div className="apr-manual-remarks">
      <label className="apr-manual-remarks-label">Appraiser Remarks</label>
      <div className="apr-manual-remarks-wrap">
        <textarea
          className="apr-manual-remarks-input"
          value={value || ''}
          maxLength={max}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Add observation or justification for this score…"
        />
        <div className="apr-manual-remarks-counter">{len} / {max}</div>
      </div>
    </div>
  );
}

/* ─── Scoring body shared by New (Step 3) + Edit ─── */
function ScoringBody({
  setup, scores, setScore, comments = {}, setComment = () => {},
  overrides, setOverrides,
  overall, grade, increment, setIncrement, incPct, setIncPct,
  bonus = false, setBonus = () => {},
  bonusAmount = '', setBonusAmount = () => {},
  finalRemarks = '', setFinalRemarks = () => {},
}) {
  const allCriteria = useMemo(() => APPRAISAL_FRAMEWORK
    .flatMap(cat => cat.criteria.map(c => ({ ...c, cat })))
    .filter(c => setup.criteria[c.id]?.enabled !== false), [setup]);

  const toggleOverride = (id) => setOverrides(o => ({ ...o, [id]: !o[id] }));

  return (
    <>
      <div className="apr-scoring">
        {allCriteria.map(c => {
          const cfg = setup.criteria[c.id] || { mode: 'manual' };
          const isAuto = cfg.mode === 'auto' && !overrides[c.id];
          const v = scores[c.id];
          return (
            <div className={`apr-score-row${isAuto ? ' is-auto' : ''}`} key={c.id}>
              <div className="apr-score-row-info">
                <div className="apr-score-row-h">
                  <span className="apr-score-row-name">{c.name}</span>
                  <span className={`apr-source-chip apr-source-chip--${isAuto ? 'auto' : 'manual'}`}>
                    <i className={`fa-solid ${isAuto ? 'fa-bolt' : 'fa-pen'}`} aria-hidden="true"></i>
                    {isAuto ? 'AUTO' : 'MANUAL'}
                  </span>
                  {isAuto && <AutoInfoButton crit={c} score={v} />}
                </div>
                <div className="apr-score-hint">
                  {isAuto
                    ? <>Auto-fetched from <b>{(APPRAISAL_AUTO_SOURCES[c.autoSource]?.module) || 'ERP data'}</b> · {c.calc || c.desc}</>
                    : <>Score 0–100. Excellent: {c.guidance.excellent}</>}
                </div>
              </div>
              <div className="apr-score-input-wrap">
                <input
                  type="number"
                  min={0} max={100}
                  className="apr-score-input"
                  value={v ?? ''}
                  readOnly={isAuto}
                  onChange={(e) => setScore(c.id, e.target.value)}
                />
                <span className="apr-score-suffix">%</span>
                {cfg.mode === 'auto' && (
                  <Tooltip text={overrides[c.id] ? 'Lock back to auto-fetched value' : 'Override the auto value manually'}>
                    <button
                      type="button"
                      className={`apr-score-auto-edit${overrides[c.id] ? ' on' : ''}`}
                      onClick={() => toggleOverride(c.id)}
                      aria-label="Toggle manual override"
                    >
                      <i className={`fa-solid ${overrides[c.id] ? 'fa-lock-open' : 'fa-pen-to-square'}`} aria-hidden="true"></i>
                    </button>
                  </Tooltip>
                )}
              </div>
              {/* Manual rows get an inline remarks textarea spanning the full row. */}
              {!isAuto && (
                <ManualRemarksField
                  value={comments[c.id] || ''}
                  onChange={(v2) => setComment(c.id, v2)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Live overall + grade */}
      <div className="apr-score-summary">
        <div>
          <div className="apr-score-summary-lbl">Live overall score</div>
          <div className="apr-score-summary-val">{Math.round(overall)}<small>%</small></div>
          <div className="apr-score-summary-sub">{grade?.meaning || 'Score every parameter to see the grade.'}</div>
        </div>
        <div className={`apr-score-summary-grade apr-grade-big--${grade?.tone || 'red'}`}>
          {grade?.label || '—'}
        </div>
      </div>

      {/* Increment recommendation + Bonus recommendation (same block) */}
      <div className="apr-increment-block">
        <div className="apr-increment-row">
          <div className="apr-increment-info">
            <div className="apr-increment-title">Recommend salary increment?</div>
            <div className="apr-increment-sub">Posts to HR → Payroll on save.</div>
          </div>
          <div className="apr-segmented">
            <button
              type="button"
              className={`apr-segmented-btn${!increment ? ' on' : ''}`}
              onClick={() => setIncrement(false)}
            >No</button>
            <button
              type="button"
              className={`apr-segmented-btn${increment ? ' on' : ''}`}
              onClick={() => setIncrement(true)}
            >Yes</button>
          </div>
        </div>
        {increment && (
          <div className="apr-increment-percent apr-row-expand">
            <label className="apr-threshold-label">Increment %</label>
            <input
              type="number" min={0} max={100} step="0.5"
              className="apr-threshold-input"
              value={incPct}
              onChange={(e) => setIncPct(e.target.value)}
            />
            <span className="apr-elig-suffix">of basic salary</span>
          </div>
        )}

        {/* Separator between increment row and bonus row */}
        <div className="apr-row-separator" aria-hidden="true" />

        <div className="apr-increment-row">
          <div className="apr-increment-info">
            <div className="apr-increment-title">Recommend Bonus?</div>
            <div className="apr-increment-sub">One-time bonus posted to HR → Payroll on save.</div>
          </div>
          <div className="apr-segmented">
            <button
              type="button"
              className={`apr-segmented-btn${!bonus ? ' on' : ''}`}
              onClick={() => setBonus(false)}
            >No</button>
            <button
              type="button"
              className={`apr-segmented-btn${bonus ? ' on' : ''}`}
              onClick={() => setBonus(true)}
            >Yes</button>
          </div>
        </div>
        {bonus && (
          <div className="apr-bonus-amount apr-row-expand">
            <label className="apr-threshold-label">Bonus Amount (PKR)</label>
            <input
              type="number" min={0}
              className="apr-bonus-input"
              value={bonusAmount}
              onChange={(e) => setBonusAmount(e.target.value)}
              placeholder="e.g. 5000"
            />
            <span className="apr-bonus-note">Posted to HR → Payroll as one-time bonus</span>
          </div>
        )}
      </div>

      {/* Final Overall Remarks — separated from increment/bonus block by a divider */}
      <div className="apr-final-remarks">
        <label className="apr-final-remarks-label" htmlFor="apr-final-remarks-input">Final Overall Remarks</label>
        <div className="apr-final-remarks-wrap">
          <textarea
            id="apr-final-remarks-input"
            className="apr-final-remarks-input"
            value={finalRemarks}
            maxLength={400}
            onChange={(e) => setFinalRemarks(e.target.value)}
            placeholder="Summarise this staff member's overall performance, key strengths, and areas to develop…"
          />
          <div className="apr-final-remarks-counter">{(finalRemarks || '').length} / 400</div>
        </div>
        <div className="apr-final-remarks-hint">
          <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
          This remark will appear on the printed appraisal report and the View modal.
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   VIEW APPRAISAL MODAL — read-only summary + print
   ═══════════════════════════════════════════════════════════════════ */
function ViewAppraisalModal({ item, setup, emps, depts, desigs, onClose }) {
  useModalChrome(onClose);
  const emp   = emps.find(e => e.id === item.empId);
  const dept  = depts.find(d => d.id === emp?.dId);
  const desig = desigs.find(d => d.id === emp?.desId);
  const overall = computeOverall(setup, item.scores);
  const grade   = gradeFor(overall, setup.grades);

  /* Build the criteria rows + weighted contributions. */
  const rows = useMemo(() => {
    const all = APPRAISAL_FRAMEWORK.flatMap(cat => cat.criteria);
    let totalWeight = 0, weightedSum = 0;
    const built = all
      .filter(c => setup.criteria[c.id]?.enabled !== false)
      .map(c => {
        const cfg = setup.criteria[c.id] || { mode: 'manual', weight: c.weight };
        const score = Number(item.scores?.[c.id]) || 0;
        const contribution = (score * cfg.weight) / 100;
        totalWeight += cfg.weight;
        weightedSum += cfg.weight * score;
        return {
          id: c.id,
          name: c.name,
          source: cfg.mode,
          score,
          weight: cfg.weight,
          weighted: contribution,
          remarks: (item.comments && item.comments[c.id]) || '',
        };
      });
    return { built, totalWeight, weightedTotal: totalWeight === 0 ? 0 : weightedSum / totalWeight };
  }, [item, setup]);

  /* Only manual rows with remarks fuel the bottom "Parameter-wise Appraiser Remarks" section. */
  const manualRemarks = rows.built.filter(r => r.source === 'manual' && r.remarks && r.remarks.trim());

  return createPortal((
    <div
      className="apr-modal-back"
      role="dialog" aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="apr-modal apr-modal--view">
        <div className="apr-modal-head">
          <div className="apr-modal-head-title">
            <div className="apr-modal-icn"><i className="fa-solid fa-eye" aria-hidden="true"></i></div>
            <div>
              <div className="apr-modal-title">Appraisal Details</div>
              <div className="apr-modal-sub">{getFullName(emp)} · {item.period}</div>
            </div>
          </div>
          <Tooltip text="Close (Esc)">
            <button className="apr-modal-x" onClick={onClose} aria-label="Close modal">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>

        <div className="apr-modal-body" id="apr-view-print-root">
          {/* Hero — staff + grade */}
          <div className="apr-view-hero">
            <div className="apr-view-avatar">
              {emp?.photo
                ? <img src={emp.photo} alt="" />
                : initialsOf(emp)}
            </div>
            <div className="apr-view-hero-text">
              <div className="apr-view-name">{getFullName(emp)}</div>
              <div className="apr-view-meta">
                <span><b>{emp?.eid}</b></span>
                {dept?.name && <span>· {dept.name}</span>}
                {desig?.name && <span>· {desig.name}</span>}
                <span>· <i className="fa-solid fa-calendar" aria-hidden="true"></i> {item.period}</span>
                <span>· Conducted by <b>{item.conductedBy}</b> on {item.conductedAt}</span>
              </div>
            </div>
            <div className={`apr-view-grade-big apr-grade-big--${grade?.tone || 'red'}`}>
              {grade?.label || '—'}
            </div>
          </div>

          {/* Score band with progress */}
          <div className="apr-view-band">
            <div className="apr-view-band-row">
              <span className="apr-view-band-lbl">Overall Score</span>
              <span className="apr-view-band-val">{Math.round(overall)}<small>%</small></span>
            </div>
            <div className="apr-view-progress">
              <div
                className={`apr-view-progress-bar apr-view-progress-bar--${grade?.tone || 'red'}`}
                style={{ width: `${Math.max(0, Math.min(100, overall))}%` }}
              />
            </div>
            <div className="apr-view-band-meaning">{grade?.meaning || '—'}</div>
          </div>

          {/* Parameter table — now with a Remarks column */}
          <div className="apr-view-table apr-view-table--with-remarks">
            <div className="apr-view-table-head">
              <div>Parameter</div>
              <div className="c">Source</div>
              <div className="r">Score</div>
              <div className="r">Weighted</div>
              <div>Remarks</div>
            </div>
            {rows.built.map(r => (
              <div className="apr-view-table-row" key={r.id}>
                <div className="apr-view-row-name">{r.name}</div>
                <div className="c">
                  <span className={`apr-source-chip apr-source-chip--${r.source}`}>
                    <i className={`fa-solid ${r.source === 'auto' ? 'fa-bolt' : 'fa-pen'}`} aria-hidden="true"></i>
                    {r.source === 'auto' ? 'AUTO' : 'MANUAL'}
                  </span>
                </div>
                <div className="r apr-view-row-score">{r.score}<small>%</small></div>
                <div className="r apr-view-row-weighted">{r.weighted.toFixed(1)}</div>
                <div className="apr-view-row-remarks">
                  {r.remarks
                    ? <em>{r.remarks}</em>
                    : <span className="apr-view-row-remarks-empty">—</span>}
                </div>
              </div>
            ))}
            <div className="apr-view-table-row tot">
              <div>Total weighted score</div>
              <div className="c">—</div>
              <div className="r">{Math.round(rows.weightedTotal)}<small>%</small></div>
              <div className="r">{rows.weightedTotal.toFixed(1)}</div>
              <div>—</div>
            </div>
          </div>

          {/* Overall appraiser remarks (the free-text remarks field on the appraisal itself) */}
          {item.remarks && item.remarks.trim() && (
            <div className="apr-view-remarks">
              <div className="apr-view-remarks-h"><i className="fa-solid fa-quote-left" aria-hidden="true"></i> Appraiser Remarks</div>
              <div className="apr-view-remarks-body">{item.remarks}</div>
            </div>
          )}

          {/* Parameter-wise Appraiser Remarks — bottom section, only when manual remarks exist */}
          {manualRemarks.length > 0 && (
            <div className="apr-pw-remarks">
              <div className="apr-pw-remarks-h">
                <i className="fa-solid fa-comment-dots" aria-hidden="true"></i>
                Parameter-wise Appraiser Remarks
              </div>
              <div className="apr-pw-remarks-list">
                {manualRemarks.map(r => (
                  <div className="apr-pw-remarks-item" key={r.id}>
                    <div className="apr-pw-remarks-item-h">
                      <b>{r.name}</b>
                      <span className="apr-pw-remarks-item-score">— {r.score}/100</span>
                    </div>
                    <div className="apr-pw-remarks-item-body">&ldquo;{r.remarks}&rdquo;</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Increment + Bonus banners */}
          <div className="apr-view-reward-grid">
            {item.incrementRecommended ? (
              <div className="apr-view-increment">
                <i className="fa-solid fa-arrow-trend-up" aria-hidden="true"></i>
                <span>Salary Increment: <b>{item.incrementPercent || 0}%</b> — Posted to Payroll</span>
              </div>
            ) : (
              <div className="apr-view-reward apr-view-reward--none">
                <i className="fa-solid fa-circle-minus" aria-hidden="true"></i>
                <span>No salary increment recommended</span>
              </div>
            )}
            {item.bonusRecommended ? (
              <div className="apr-view-bonus">
                <i className="fa-solid fa-gift" aria-hidden="true"></i>
                <span>Bonus: <b>PKR {Number(item.bonusAmount || 0).toLocaleString('en-PK')}</b> — Posted to Payroll</span>
              </div>
            ) : (
              <div className="apr-view-reward apr-view-reward--none">
                <i className="fa-solid fa-circle-minus" aria-hidden="true"></i>
                <span>No bonus recommended</span>
              </div>
            )}
          </div>

          {/* Overall Appraiser Remarks — the final summary remark from Step 3 */}
          {item.finalRemarks && item.finalRemarks.trim() && (
            <div className="apr-view-final-remarks">
              <div className="apr-view-final-remarks-h">Overall Appraiser Remarks</div>
              <div className="apr-view-final-remarks-body">{item.finalRemarks}</div>
            </div>
          )}
        </div>

        <div className="apr-modal-foot">
          <button type="button" className="apr-btn apr-btn-ghost" onClick={onClose}>Close</button>
          <div className="apr-modal-foot-right">
            <button type="button" className="apr-btn apr-btn-primary" onClick={() => window.print()}>
              <i className="fa-solid fa-print" aria-hidden="true"></i> Print Report
            </button>
          </div>
        </div>
        <style>{APR_VIEW_PRINT_CSS}</style>
      </div>
    </div>
  ), document.body);
}

const APR_VIEW_PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #apr-view-print-root, #apr-view-print-root * { visibility: visible !important; }
  #apr-view-print-root {
    position: fixed !important;
    inset: 0 !important;
    margin: 0 !important;
    padding: 24px !important;
    background: #fff !important;
    overflow: visible !important;
    max-height: none !important;
  }
}
`;

/* ═══════════════════════════════════════════════════════════════════
   EDIT APPRAISAL MODAL — same scoring UI, prefilled
   ═══════════════════════════════════════════════════════════════════ */
function EditAppraisalModal({ item, setup, emps, depts, desigs, onClose, onSave, toast }) {
  useModalChrome(onClose);
  const emp  = emps.find(e => e.id === item.empId);
  const dept = depts.find(d => d.id === emp?.dId);

  const [scores,        setScores]        = useState(() => scoresFrom(item));
  const [comments,      setComments]      = useState(() => ({ ...(item.comments || {}) }));
  const [overrides,     setOverrides]     = useState({});
  const [remarks,       setRemarks]       = useState(item.remarks || '');
  const [increment,     setIncrement]     = useState(!!item.incrementRecommended);
  const [incPct,        setIncPct]        = useState(item.incrementPercent || 5);
  const [bonus,         setBonus]         = useState(!!item.bonusRecommended);
  const [bonusAmount,   setBonusAmount]   = useState(item.bonusAmount || '');
  const [finalRemarks,  setFinalRemarks]  = useState(item.finalRemarks || '');

  const setScore   = (id, v) => setScores(s => ({ ...s, [id]: v === '' ? '' : Number(v) }));
  const setComment = (id, v) => setComments(c => ({ ...c, [id]: v }));

  const { overall, grade } = liveOverall(setup, scores);

  const canSave = useMemo(() => {
    return APPRAISAL_FRAMEWORK.every(cat => cat.criteria.every(c => {
      const cfg = setup.criteria[c.id];
      if (cfg?.enabled === false) return true;
      const isAuto = cfg?.mode === 'auto' && !overrides[c.id];
      if (isAuto) return scores[c.id] != null;
      const v = scores[c.id];
      return v != null && v !== '' && !Number.isNaN(Number(v));
    }));
  }, [scores, setup, overrides]);

  const onSubmit = () => {
    if (!canSave) { toast('Score every parameter before saving', 'error'); return; }
    onSave({
      ...item,
      scores,
      comments,
      remarks,
      incrementRecommended: increment,
      incrementPercent:     increment ? Number(incPct)      || 0 : 0,
      bonusRecommended:     bonus,
      bonusAmount:          bonus     ? Number(bonusAmount) || 0 : 0,
      finalRemarks,
    });
  };

  return createPortal((
    <div
      className="apr-modal-back"
      role="dialog" aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="apr-modal apr-modal--scoring">
        <div className="apr-modal-head">
          <div className="apr-modal-head-title">
            <div className="apr-modal-icn"><i className="fa-solid fa-pen" aria-hidden="true"></i></div>
            <div>
              <div className="apr-modal-title">Edit Appraisal</div>
              <div className="apr-modal-sub">{getFullName(emp)} · {item.period}</div>
            </div>
          </div>
          <Tooltip text="Close (Esc)">
            <button className="apr-modal-x" onClick={onClose} aria-label="Close modal">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>

        <div className="apr-modal-body">
          {/* Read-only header — staff + period locked once an appraisal exists */}
          <div className="apr-readonly-card">
            <div className="apr-staff-avatar sm">
              {emp?.photo
                ? <img src={emp.photo} alt="" />
                : initialsOf(emp)}
            </div>
            <div className="apr-readonly-text">
              <div className="apr-readonly-name">{getFullName(emp)}</div>
              <div className="apr-readonly-meta">
                <span>{emp?.eid}</span>
                {dept?.name && <><span className="apr-staff-dot">·</span><span>{dept.name}</span></>}
                <span className="apr-staff-dot">·</span>
                <span>{item.period}</span>
                <span className="apr-staff-dot">·</span>
                <span>{item.cycle}</span>
              </div>
            </div>
            <div className="apr-readonly-locked">
              <i className="fa-solid fa-lock" aria-hidden="true"></i> Locked
            </div>
          </div>

          <ScoringBody
            setup={setup}
            scores={scores}
            setScore={setScore}
            comments={comments}
            setComment={setComment}
            overrides={overrides}
            setOverrides={setOverrides}
            overall={overall}
            grade={grade}
            increment={increment}
            setIncrement={setIncrement}
            bonus={bonus}
            setBonus={setBonus}
            bonusAmount={bonusAmount}
            setBonusAmount={setBonusAmount}
            finalRemarks={finalRemarks}
            setFinalRemarks={setFinalRemarks}
            incPct={incPct}
            setIncPct={setIncPct}
          />

          <div className="apr-field-group" style={{ marginTop: 12 }}>
            <label className="apr-field-label">Appraiser Remarks</label>
            <textarea
              className="apr-textarea"
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="What stood out this cycle? Any context for the scores above?"
            />
          </div>
        </div>

        <div className="apr-modal-foot">
          <button type="button" className="apr-btn apr-btn-ghost" onClick={onClose}>Cancel</button>
          <div className="apr-modal-foot-right">
            <button
              type="button"
              className={`apr-btn apr-btn-primary${canSave ? '' : ' is-disabled'}`}
              onClick={onSubmit}
              disabled={!canSave}
            >
              <i className="fa-solid fa-floppy-disk" aria-hidden="true"></i> Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  ), document.body);
}

/* ═══════════════════════════════════════════════════════════════════
   DELETE APPRAISAL MODAL — small centred confirm
   ═══════════════════════════════════════════════════════════════════ */
function DeleteAppraisalModal({ item, emp, onClose, onConfirm }) {
  useModalChrome(onClose);
  return createPortal((
    <div
      className="apr-modal-back"
      role="dialog" aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="apr-modal apr-modal--delete">
        <div className="apr-modal-body">
          <div className="apr-delete-ic"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i></div>
          <div className="apr-delete-title">Delete Appraisal?</div>
          <div className="apr-delete-body">
            This will permanently delete the appraisal for <b>{getFullName(emp)}</b> — <b>{item.period}</b>. This cannot be undone.
          </div>
        </div>
        <div className="apr-modal-foot apr-modal-foot--center">
          <button type="button" className="apr-btn apr-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="apr-btn apr-btn-danger" onClick={onConfirm}>
            <i className="fa-solid fa-trash" aria-hidden="true"></i> Delete Appraisal
          </button>
        </div>
      </div>
    </div>
  ), document.body);
}

/* ═══════════════════════════════════════════════════════════════════
   CONDUCT APPRAISAL MODAL — legacy fallback (kept for back-compat,
   no longer mounted by AppraisalsSection).
   ═══════════════════════════════════════════════════════════════════ */
// eslint-disable-next-line no-unused-vars
function ConductModal({ mode, initial, setup, emps, depts, desigs, onClose, onSave, toast }) {
  const today = new Date().toISOString().slice(0, 10);
  const seed  = useMemo(() => initial || {
    empId: '',
    period: defaultPeriodFor(setup.cycle),
    cycle: setup.cycle,
    conductedBy: 'Principal',
    conductedAt: today,
    status: 'completed',
    scores: {},
    comments: {},
    parentFeedback: setup.parentFeedback ? { score: '', summary: '' } : null,
  }, [initial, setup, today]);

  const [draft, setDraft] = useState(() => clone(seed));
  const [touched, setTouched] = useState(false);

  /* Auto-prefetch auto scores whenever the employee changes. */
  useEffect(() => {
    if (!draft.empId) return;
    const autoCrits = APPRAISAL_FRAMEWORK
      .flatMap(c => c.criteria)
      .filter(c => c.autoSource && (setup.criteria[c.id]?.mode || (c.autoSource ? 'auto' : 'manual')) === 'auto');
    let cancelled = false;
    (async () => {
      const updates = {};
      for (const c of autoCrits) {
        const v = await appraisalService.getAutoScore(draft.empId, c.id);
        if (v != null) updates[c.id] = v;
      }
      if (cancelled) return;
      setDraft(d => ({ ...d, scores: { ...updates, ...d.scores } }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.empId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const overall = computeOverall(setup, draft.scores);
  const grade   = gradeFor(overall, setup.grades);
  const emp     = emps.find(e => e.id === Number(draft.empId)) || null;
  const dept    = depts.find(d => d.id === emp?.dId);
  const desig   = desigs.find(d => d.id === emp?.desId);

  const setScore   = (id, v)   => setDraft(d => ({ ...d, scores:   { ...d.scores,   [id]: v === '' ? '' : Number(v) } }));
  const setComment = (id, v)   => setDraft(d => ({ ...d, comments: { ...d.comments, [id]: v } }));
  const setPF      = (field, v) => setDraft(d => ({ ...d, parentFeedback: { ...(d.parentFeedback || {}), [field]: v } }));

  const submit = () => {
    setTouched(true);
    if (!draft.empId) { toast('Pick a staff member', 'error'); return; }
    if (!draft.period) { toast('Pick a period',     'error'); return; }
    onSave({ ...draft, empId: Number(draft.empId), status: 'completed' });
  };
  const saveDraft = () => {
    if (!draft.empId) { toast('Pick a staff member', 'error'); return; }
    onSave({ ...draft, empId: Number(draft.empId), status: 'draft' });
    toast('Draft saved', 'info');
  };

  return createPortal((
    <div
      className="emp-modal-back"
      role="dialog" aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="emp-modal" style={{ width: 'min(1080px, 100%)' }}>
        <div className="emp-modal-head" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}>
          <div className="emp-modal-head-l">
            <div className="emp-modal-icn"><i className="fa-solid fa-clipboard-user" aria-hidden="true"></i></div>
            <div>
              <div className="emp-modal-title">{mode === 'new' ? 'New Appraisal' : 'Appraisal'}</div>
              <div className="emp-modal-sub">
                {emp ? `${getFullName(emp)} · ${emp.eid}` : 'Pick a staff member to begin'}
              </div>
            </div>
          </div>
          <div className="emp-modal-head-actions">
            <Tooltip text="Close (Esc)">
              <button className="emp-modal-x" onClick={onClose} aria-label="Close modal">
                <i className="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </Tooltip>
          </div>
        </div>

        <div className="emp-modal-body">
          {/* Top — pick staff + period */}
          <div className="apr-card apr-conduct-top">
            <div className="emp-form-grid g4">
              <Field label="Staff Member" required error={touched && !draft.empId ? 'Required' : ''} colSpan={2}>
                <select
                  className={`fi${touched && !draft.empId ? ' has-error' : ''}`}
                  value={draft.empId}
                  onChange={(e) => setDraft(d => ({ ...d, empId: e.target.value }))}
                >
                  <option value="">Pick a staff member…</option>
                  {emps.map(e => <option key={e.id} value={e.id}>{getFullName(e)} · {e.eid}</option>)}
                </select>
              </Field>
              <Field label="Cycle">
                <select
                  className="fi"
                  value={draft.cycle}
                  onChange={(e) => setDraft(d => ({ ...d, cycle: e.target.value }))}
                >
                  {APPRAISAL_CYCLES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Period" required error={touched && !draft.period ? 'Required' : ''}>
                <input
                  type="text"
                  className={`fi${touched && !draft.period ? ' has-error' : ''}`}
                  value={draft.period}
                  onChange={(e) => setDraft(d => ({ ...d, period: e.target.value }))}
                  placeholder={periodPlaceholder(draft.cycle)}
                />
              </Field>
              <Field label="Conducted by">
                <input className="fi" value={draft.conductedBy} onChange={(e) => setDraft(d => ({ ...d, conductedBy: e.target.value }))} />
              </Field>
              <Field label="Conducted on">
                <input type="date" className="fi" value={draft.conductedAt} onChange={(e) => setDraft(d => ({ ...d, conductedAt: e.target.value }))} />
              </Field>
              {emp && (
                <div className="emp-field span2 apr-emp-readout">
                  <label>Employee Snapshot</label>
                  <div className="apr-emp-readout-row">
                    <span className="hr-pill hr-pill-blue">{dept?.name || '—'}</span>
                    <span className="hr-pill hr-pill-gray">{desig?.name || '—'}</span>
                    <span className="hr-pill">Joined {emp.join || '—'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Score + grade hero */}
          <div className="apr-hero">
            <div className="apr-hero-l">
              <div className="apr-hero-lbl">Live overall score</div>
              <div className="apr-hero-val">{Math.round(overall)}%</div>
              <div className="apr-hero-sub">Weighted average of every enabled criterion below.</div>
            </div>
            <div className="apr-hero-r">
              <div className="apr-hero-grade">
                <span className={`apr-grade-pill apr-grade-pill--${grade?.tone || 'red'}`}>{grade?.label || '—'}</span>
                <div className="apr-hero-meaning">{grade?.meaning || 'Add scores below to see the grade.'}</div>
              </div>
              <div className="apr-hero-elig">
                {setup.eligibility.map(e => {
                  const ok = overall >= e.min;
                  return (
                    <Tooltip key={e.id} text={`${e.label} threshold: ${e.min}%`}>
                      <span className={`apr-elig-chip${ok ? ' on' : ''}`}>
                        <i className={`fa-solid ${ok ? 'fa-check' : 'fa-xmark'}`} aria-hidden="true"></i> {e.label}
                      </span>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Categories */}
          {APPRAISAL_FRAMEWORK.map(cat => (
            <ConductCategory
              key={cat.id}
              cat={cat}
              setup={setup}
              draft={draft}
              setScore={setScore}
              setComment={setComment}
            />
          ))}

          {/* Parent feedback */}
          {setup.parentFeedback && (
            <div className="apr-card apr-pf-card">
              <div className="apr-pf-head">
                <i className="fa-solid fa-comments" aria-hidden="true"></i>
                <div>
                  <div className="apr-pf-title">Parent Feedback (optional)</div>
                  <div className="apr-pf-sub">Captures parent voice for this period. Adds 5% weight to the overall score.</div>
                </div>
              </div>
              <div className="emp-form-grid g4">
                <Field label="Score (0–100)" colSpan={1}>
                  <input
                    type="number" min={0} max={100}
                    className="fi"
                    value={draft.parentFeedback?.score ?? ''}
                    onChange={(e) => setPF('score', e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </Field>
                <Field label="Summary" colSpan={3}>
                  <textarea
                    className="fi"
                    rows={2}
                    value={draft.parentFeedback?.summary || ''}
                    onChange={(e) => setPF('summary', e.target.value)}
                    placeholder="Common themes from parent responses…"
                  />
                </Field>
              </div>
            </div>
          )}
        </div>

        <div className="emp-modal-foot">
          <div className="emp-modal-foot-msg" style={{ background: '#EFF6FF', color: '#1E40AF' }}>
            <i className="fa-solid fa-info-circle" aria-hidden="true"></i>
            Saved drafts can be completed later from the Appraisals list.
          </div>
          <div className="emp-modal-foot-actions">
            <button type="button" className="emp-btn emp-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="emp-btn emp-btn-ghost" onClick={saveDraft}>
              <i className="fa-solid fa-pen-ruler" aria-hidden="true"></i> Save Draft
            </button>
            <button type="button" className="emp-btn emp-btn-primary" onClick={submit}>
              <i className="fa-solid fa-circle-check" aria-hidden="true"></i> Save Appraisal
            </button>
          </div>
        </div>
      </div>
    </div>
  ), document.body);
}

function ConductCategory({ cat, setup, draft, setScore, setComment }) {
  const [open, setOpen] = useState(true);
  const enabledCrits = cat.criteria.filter(c => setup.criteria[c.id]?.enabled !== false);
  if (enabledCrits.length === 0) return null;

  const catAvg = enabledCrits.length
    ? Math.round(enabledCrits.reduce((s, c) => s + (Number(draft.scores[c.id]) || 0), 0) / enabledCrits.length)
    : 0;

  return (
    <div className={`apr-card apr-cond-cat apr-cond-cat--${cat.tone}${open ? ' open' : ''}`}>
      <button type="button" className="apr-cond-cat-head" onClick={() => setOpen(!open)}>
        <div className="apr-cat-ic"><i className={`fa-solid ${cat.icon}`} aria-hidden="true"></i></div>
        <div className="apr-cat-body">
          <div className="apr-cat-h">{cat.label}</div>
          <div className="apr-cat-desc">{cat.desc}</div>
        </div>
        <div className="apr-cat-stats">
          <span className="apr-cat-stat"><b>{catAvg}%</b> avg</span>
          <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'} apr-cat-chev`} aria-hidden="true"></i>
        </div>
      </button>
      {open && (
        <div className="apr-cond-criteria">
          {enabledCrits.map(c => {
            const cfg  = setup.criteria[c.id] || { mode: c.autoSource ? 'auto' : 'manual' };
            const auto = cfg.mode === 'auto';
            const v    = draft.scores[c.id];
            return (
              <div className={`apr-cond-crit${auto ? ' is-auto' : ''}`} key={c.id}>
                <div className="apr-cond-crit-head">
                  <div className="apr-cond-crit-info">
                    <div className="apr-cond-crit-h">
                      {c.name}
                      <span className={`apr-crit-tag apr-crit-tag--${cfg.mode}`}>
                        <i className={`fa-solid ${auto ? 'fa-robot' : 'fa-pen'}`} aria-hidden="true"></i>
                        {auto ? 'Auto' : 'Manual'}
                      </span>
                    </div>
                    <div className="apr-cond-crit-desc">{c.desc}</div>
                  </div>
                  <div className="apr-cond-crit-score">
                    <label>Score (0–100)</label>
                    <input
                      type="number" min={0} max={100}
                      className="fi"
                      value={v ?? ''}
                      readOnly={auto && v != null}
                      onChange={(e) => setScore(c.id, e.target.value)}
                    />
                    <RatingBadge value={Number(v) || 0} grades={setup.grades} />
                  </div>
                </div>
                <div className="apr-cond-guide">
                  <span><span className="apr-crit-guide-tag tone-green">Excellent</span> {c.guidance.excellent}</span>
                  <span><span className="apr-crit-guide-tag tone-blue">Good</span>       {c.guidance.good}</span>
                  <span><span className="apr-crit-guide-tag tone-orange">Average</span>  {c.guidance.average}</span>
                  <span><span className="apr-crit-guide-tag tone-red">Poor</span>        {c.guidance.poor}</span>
                </div>
                <Field label="Comments / Notes (optional)" colSpan={4}>
                  <textarea
                    className="fi"
                    rows={2}
                    value={draft.comments[c.id] || ''}
                    onChange={(e) => setComment(c.id, e.target.value)}
                    placeholder="Examples, context, or what you observed…"
                  />
                </Field>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RatingBadge({ value, grades }) {
  const g = gradeFor(value, grades);
  if (!g) return null;
  return <span className={`apr-grade-pill apr-grade-pill--${g.tone}`}>{g.label}</span>;
}

/* ═══════════════════════════════════════════════════════════════════
   REPORTS SECTION
   ═══════════════════════════════════════════════════════════════════ */
function ReportsSection({ setup, emps, depts, desigs, appraisals, toast }) {
  const [open, setOpen] = useState(null);   // report id
  if (appraisals.length === 0) {
    return (
      <div className="apr-empty">
        <div className="apr-empty-ic"><i className="fa-solid fa-chart-line" aria-hidden="true"></i></div>
        <div className="apr-empty-title">No appraisals to report on yet</div>
        <div className="apr-empty-sub">Run at least one appraisal — then come back here for ranking, eligibility and trends.</div>
      </div>
    );
  }

  /* When a report is opened, the viewer replaces the cards grid entirely.
     Clicking "Back to Reports" in the toolbar resets `open` to null and
     the cards come back. */
  if (open) {
    return (
      <AppraisalReportViewer
        reportId={open}
        setup={setup}
        emps={emps} depts={depts} desigs={desigs}
        appraisals={appraisals}
        onBack={() => setOpen(null)}
        toast={toast}
      />
    );
  }

  return (
    <>
      {/* Intro banner — self-styled, matches Appraisals tab pattern */}
      <div className="apr-intro">
        <div className="apr-intro-ic"><i className="fa-solid fa-chart-line" aria-hidden="true"></i></div>
        <div>
          <div className="apr-intro-title">{APPRAISAL_REPORT_TYPES.length} reports available</div>
          <div className="apr-intro-body">
            Pick one to view it. Every report can be printed to <b>PDF</b> or exported to <b>Excel</b> for further analysis.
          </div>
        </div>
      </div>

      {/* Report cards grid — fully self-contained chrome */}
      <div className="apr-reports-grid">
        {APPRAISAL_REPORT_TYPES.map(r => (
          <button
            type="button"
            key={r.id}
            className="apr-report-card"
            onClick={() => setOpen(r.id)}
          >
            <div className="apr-report-ic"><i className={`fa-solid ${r.icon}`} aria-hidden="true"></i></div>
            <div className="apr-report-title">{r.label}</div>
            <div className="apr-report-desc">{r.desc}</div>
            <div className="apr-report-link">
              View Report
              <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   APPRAISAL REPORT VIEWER — full-page A4 report (replaces modal)

   Sits inside the Reports sub-tab, replacing the cards grid when a
   report is opened. Provides a toolbar with period/staff selectors,
   B&W toggle, Print and (for list reports) Excel export, plus an A4
   sheet matching the ERP-wide printable-report format.
   ═══════════════════════════════════════════════════════════════════ */

/* Tiny helpers used only by the viewer. */
function detectCycleType(reportId, period) {
  if (reportId === 'monthly')   return 'Monthly';
  if (reportId === 'quarterly') return 'Quarterly';
  if (reportId === 'biannual')  return 'Bi-Annual';
  if (reportId === 'annual')    return 'Annual';
  if (!period) return 'Mixed';
  if (/Q\d/.test(period))                                  return 'Quarterly';
  if (/H\d/i.test(period) || /Mid-Year/i.test(period))     return 'Bi-Annual';
  if (/^\d{4}-\d{2}$/.test(period))                        return 'Monthly';
  if (/Annual/i.test(period) || /^\d{4}$/.test(period))    return 'Annual';
  return 'Mixed';
}

/* Lowest-scoring criterion across enabled criteria → "Key Gap" */
function lowestCriterion(scores, setup) {
  const all = APPRAISAL_FRAMEWORK
    .flatMap(cat => cat.criteria.map(c => ({ ...c, cat })))
    .filter(c => setup.criteria[c.id]?.enabled !== false)
    .map(c => ({ id: c.id, name: c.name, score: Number(scores?.[c.id]) || 0 }));
  if (!all.length) return null;
  return all.reduce((m, c) => (c.score < m.score ? c : m), all[0]);
}

/* Highest-scoring criterion → "Key Strength" */
function highestCriterion(scores, setup) {
  const all = APPRAISAL_FRAMEWORK
    .flatMap(cat => cat.criteria.map(c => ({ ...c, cat })))
    .filter(c => setup.criteria[c.id]?.enabled !== false)
    .map(c => ({ id: c.id, name: c.name, score: Number(scores?.[c.id]) || 0 }));
  if (!all.length) return null;
  return all.reduce((m, c) => (c.score > m.score ? c : m), all[0]);
}

/* Average score per category, returns the lowest-scoring one.
   Used by Training Needs to recommend an area. */
function weakestCategory(scores, setup) {
  let weakest = null;
  for (const cat of APPRAISAL_FRAMEWORK) {
    const enabled = cat.criteria.filter(c => setup.criteria[c.id]?.enabled !== false);
    if (!enabled.length) continue;
    const avg = enabled.reduce((s, c) => s + (Number(scores?.[c.id]) || 0), 0) / enabled.length;
    if (!weakest || avg < weakest.avg) weakest = { cat, avg };
  }
  return weakest;
}

function AppraisalReportViewer({ reportId, setup, emps, depts, desigs, appraisals, onBack, toast }) {
  const meta  = APPRAISAL_REPORT_TYPES.find(r => r.id === reportId);
  const today = new Date().toISOString().slice(0, 10);
  const timestamp = new Date().toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' });

  const periodOptions = useMemo(() => {
    const set = new Set(appraisals.map(a => a.period));
    return Array.from(set).sort().reverse();
  }, [appraisals]);

  const [period, setPeriod] = useState(periodOptions[0] || '');
  const [empId,  setEmpId]  = useState('');
  const [bw,     setBw]     = useState(false);

  /* Period-filtered + enriched dataset — basis for every report type. */
  const enriched = useMemo(() => {
    const list = period ? appraisals.filter(a => a.period === period) : appraisals;
    return list.map(a => {
      const overall = computeOverall(setup, a.scores);
      const grade   = gradeFor(overall, setup.grades);
      const emp     = emps.find(e => e.id === a.empId);
      const dept    = depts.find(d => d.id === emp?.dId);
      const desig   = desigs.find(d => d.id === emp?.desId);
      return { ...a, overall, grade, emp, dept, desig };
    });
  }, [appraisals, period, setup, emps, depts, desigs]);

  const ranked = useMemo(() => [...enriched].sort((a, b) => b.overall - a.overall), [enriched]);

  /* Individual-report staff dropdown — driven by the period set. */
  const indivOptions = enriched;
  useEffect(() => {
    if (reportId !== 'individual') return;
    if (indivOptions.length && !indivOptions.find(a => a.empId === Number(empId))) {
      setEmpId(indivOptions[0].empId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, indivOptions]);

  const selected = reportId === 'individual'
    ? enriched.find(a => a.empId === Number(empId))
    : null;

  const cycleType = detectCycleType(reportId, period);

  /* Excel export — only for list-style reports (everything but Individual). */
  const needsExcel = reportId !== 'individual';
  const handlePrint = () => window.print();
  const handleExcel = () => {
    if (reportId === 'individual') return;
    const rows = [];
    if (reportId === 'ranking' || reportId === 'monthly' || reportId === 'quarterly' || reportId === 'biannual' || reportId === 'annual') {
      rows.push(['Rank', 'Employee', 'EID', 'Department', 'Period', 'Score %', 'Grade', 'Status', 'Conducted By']);
      ranked.forEach((a, i) => rows.push([
        i + 1, getFullName(a.emp), a.emp?.eid || '', a.dept?.name || '', a.period,
        Math.round(a.overall), a.grade?.label || '—', a.status, a.conductedBy || '',
      ]));
    } else if (reportId === 'top' || reportId === 'low') {
      const slice = reportId === 'top' ? ranked.slice(0, 5) : ranked.filter(a => a.overall < 70);
      rows.push(['Rank', 'Employee', 'Department', 'Score %', 'Grade', reportId === 'top' ? 'Key Strength' : 'Key Gap']);
      slice.forEach((a, i) => {
        const ks = reportId === 'top' ? highestCriterion(a.scores, setup) : lowestCriterion(a.scores, setup);
        rows.push([
          i + 1, getFullName(a.emp), a.dept?.name || '',
          Math.round(a.overall), a.grade?.label || '—',
          ks ? `${ks.name} (${Math.round(ks.score)}%)` : '—',
        ]);
      });
    } else if (reportId === 'bonus') {
      const min = setup.eligibility.find(e => e.id === 'bonus')?.min || 90;
      rows.push(['Employee', 'Department', 'Score %', 'Threshold', 'Eligible', 'Bonus Amount (PKR)']);
      ranked.forEach(a => rows.push([
        getFullName(a.emp), a.dept?.name || '', Math.round(a.overall), min,
        a.overall >= min ? 'Yes' : 'No', a.bonusAmount || 0,
      ]));
    } else if (reportId === 'increment') {
      rows.push(['Employee', 'Department', 'Score %', 'Current Salary (PKR)', 'Increment %', 'New Salary (PKR)']);
      ranked.forEach(a => {
        const cur = Number(a.emp?.basicSalary || 0);
        const pct = Number(a.incrementPercent || 0);
        rows.push([
          getFullName(a.emp), a.dept?.name || '', Math.round(a.overall),
          cur.toLocaleString('en-PK'), pct, Math.round(cur * (1 + pct / 100)).toLocaleString('en-PK'),
        ]);
      });
    } else if (reportId === 'promotion') {
      const min = setup.eligibility.find(e => e.id === 'promotion')?.min || 85;
      rows.push(['Employee', 'Department', 'Score %', 'Current Role', 'Recommendation']);
      ranked.forEach(a => rows.push([
        getFullName(a.emp), a.dept?.name || '', Math.round(a.overall),
        a.desig?.name || '—', a.overall >= min ? 'Recommend Promotion' : 'Not eligible yet',
      ]));
    } else if (reportId === 'training') {
      rows.push(['Employee', 'Lowest Category', 'Score %', 'Suggested Training Area']);
      ranked.forEach(a => {
        const w = weakestCategory(a.scores, setup);
        rows.push([
          getFullName(a.emp), w?.cat?.label || '—',
          w ? Math.round(w.avg) : 0,
          w ? `${w.cat.label} workshop` : '—',
        ]);
      });
    }
    downloadCsv(`${reportId}-report-${period || 'all'}.csv`, rows);
    toast('Excel file downloaded', 'success');
  };

  return (
    <div className={`apr-rv${bw ? ' apr-rv--bw' : ''}`}>
      {/* Toolbar — hidden on print */}
      <div className="apr-rv-toolbar no-print">
        <div className="apr-rv-toolbar-l">
          <button type="button" className="apr-rv-back" onClick={onBack}>
            <i className="fa-solid fa-arrow-left" aria-hidden="true"></i> Back to Reports
          </button>
        </div>
        <div className="apr-rv-toolbar-c">
          <div className="apr-rv-title-line">
            <span className="apr-rv-title">{meta?.label}</span>
          </div>
          <div className="apr-rv-selectors">
            <select className="apr-rv-select" value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period">
              {periodOptions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {reportId === 'individual' && indivOptions.length > 0 && (
              <select className="apr-rv-select" value={empId} onChange={(e) => setEmpId(Number(e.target.value))} aria-label="Staff member">
                {indivOptions.map(a => (
                  <option key={a.empId} value={a.empId}>
                    {getFullName(a.emp)} · {a.emp?.eid}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="apr-rv-toolbar-r">
          <div className="apr-rv-bw">
            <Tooltip text="Show in colour">
              <button type="button" className={`apr-rv-bw-btn${!bw ? ' on' : ''}`} onClick={() => setBw(false)}>Colour</button>
            </Tooltip>
            <Tooltip text="Switch to black & white">
              <button type="button" className={`apr-rv-bw-btn${bw ? ' on' : ''}`} onClick={() => setBw(true)}>B&amp;W</button>
            </Tooltip>
          </div>
          <Tooltip text="Print or save as PDF">
            <button type="button" className="apr-rv-action apr-rv-action--print" onClick={handlePrint}>
              <i className="fa-solid fa-print" aria-hidden="true"></i> Print / PDF
            </button>
          </Tooltip>
          {needsExcel && (
            <Tooltip text="Export to Excel">
              <button type="button" className="apr-rv-action apr-rv-action--excel" onClick={handleExcel}>
                <i className="fa-solid fa-file-excel" aria-hidden="true"></i> Excel
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* A4 sheet */}
      <div className="apr-rv-sheet-wrap">
        <div className="apr-rv-sheet" id="apr-rv-print-root">
          {/* HEADER */}
          <div className="apr-rv-head">
            <div className="apr-rv-head-l">
              <div className="apr-rv-logo"><i className="fa-solid fa-graduation-cap" aria-hidden="true"></i></div>
              <div>
                <div className="apr-rv-school">School Mentor Academy</div>
                <div className="apr-rv-campus">Main Campus · Academic Session 2025–26</div>
              </div>
            </div>
            <div className="apr-rv-head-r">
              <div className="apr-rv-rtitle">{meta?.label}</div>
              <div className="apr-rv-rgen">Generated: {today}</div>
            </div>
          </div>

          {/* META INFO */}
          <div className="apr-rv-meta">
            {reportId === 'individual' && selected ? (
              <>
                <MetaItem label="Employee Name"  value={getFullName(selected.emp)} />
                <MetaItem label="EID"            value={selected.emp?.eid || '—'} />
                <MetaItem label="Department"     value={selected.dept?.name || '—'} />
                <MetaItem label="Designation"    value={selected.desig?.name || '—'} />
                <MetaItem label="Period"         value={selected.period} />
                <MetaItem label="Conducted By"   value={selected.conductedBy || '—'} />
              </>
            ) : (
              <>
                <MetaItem label="Period"         value={period || 'All periods'} />
                <MetaItem label="Total Staff"    value={ranked.length} />
                <MetaItem label="Date Generated" value={today} />
                <MetaItem label="Cycle Type"     value={cycleType} />
              </>
            )}
          </div>

          {/* SCORE BAND — individual only */}
          {reportId === 'individual' && selected && (
            <div className="apr-rv-band">
              <div className="apr-rv-band-l">
                <div className="apr-rv-band-lbl">Overall Score</div>
                <div className="apr-rv-band-val">{Math.round(selected.overall)}%</div>
                <div className="apr-rv-band-meaning">{selected.grade?.meaning || '—'}</div>
              </div>
              <div className="apr-rv-band-r">
                <div className={`apr-rv-grade apr-grade-big--${selected.grade?.tone || 'red'}`}>
                  <span className="apr-rv-grade-letter">{selected.grade?.label || '—'}</span>
                  <span className="apr-rv-grade-lbl">Grade</span>
                </div>
              </div>
            </div>
          )}

          {/* DATA TABLE — content varies by reportId */}
          <ReportTable
            reportId={reportId}
            setup={setup}
            ranked={ranked}
            selected={selected}
          />

          {/* REMARKS SECTION — individual only */}
          {reportId === 'individual' && selected && (
            <ParameterRemarksSection appraisal={selected} setup={setup} />
          )}

          {/* OVERALL REMARKS — individual only */}
          {reportId === 'individual' && selected && selected.finalRemarks && selected.finalRemarks.trim() && (
            <div className="apr-rv-overall-remarks">
              <div className="apr-rv-section-h">Overall Appraiser Remarks</div>
              <div className="apr-rv-overall-remarks-box">{selected.finalRemarks}</div>
            </div>
          )}

          {/* REWARD SUMMARY — individual only */}
          {reportId === 'individual' && selected && (selected.incrementRecommended || selected.bonusRecommended) && (
            <div className="apr-rv-reward">
              {selected.incrementRecommended && (
                <span className="apr-rv-chip apr-rv-chip--green">
                  <i className="fa-solid fa-arrow-trend-up" aria-hidden="true"></i>
                  Salary Increment: {selected.incrementPercent || 0}%
                </span>
              )}
              {selected.bonusRecommended && (
                <span className="apr-rv-chip apr-rv-chip--blue">
                  <i className="fa-solid fa-gift" aria-hidden="true"></i>
                  Bonus: PKR {Number(selected.bonusAmount || 0).toLocaleString('en-PK')}
                </span>
              )}
            </div>
          )}

          {/* SIGNATURE ROW */}
          <div className="apr-rv-signatures">
            <div className="apr-rv-sig">
              <div className="apr-rv-sig-line"></div>
              <div className="apr-rv-sig-name">Appraisee</div>
              <div className="apr-rv-sig-role">Signature &amp; Date</div>
            </div>
            <div className="apr-rv-sig">
              <div className="apr-rv-sig-line"></div>
              <div className="apr-rv-sig-name">Head of Department</div>
              <div className="apr-rv-sig-role">Signature &amp; Date</div>
            </div>
            <div className="apr-rv-sig">
              <div className="apr-rv-sig-line"></div>
              <div className="apr-rv-sig-name">Principal / Authority</div>
              <div className="apr-rv-sig-role">Signature &amp; Date</div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="apr-rv-footer">
            <span>Generated by School Mentor ERP · Staff Appraisals</span>
            <span>{timestamp}</span>
          </div>
        </div>
      </div>

      <style>{APR_RV_PRINT_CSS}</style>
    </div>
  );
}

function MetaItem({ label, value }) {
  return (
    <div className="apr-rv-meta-item">
      <span className="apr-rv-meta-lbl">{label}</span>
      <span className="apr-rv-meta-val">{value || '—'}</span>
    </div>
  );
}

/* ─── Data table — content varies by reportId. Uses the same column /
   row chrome regardless so the look stays uniform. */
function ReportTable({ reportId, setup, ranked, selected }) {
  const spec = useMemo(() => {
    /* Individual report */
    if (reportId === 'individual') {
      if (!selected) return null;
      const allCrits = APPRAISAL_FRAMEWORK
        .flatMap(cat => cat.criteria.map(c => ({ ...c, cat })))
        .filter(c => setup.criteria[c.id]?.enabled !== false);
      let totalW = 0, weightedSum = 0;
      const rows = allCrits.map(c => {
        const cfg = setup.criteria[c.id] || { mode: 'manual', weight: c.weight };
        const score = Number(selected.scores?.[c.id]) || 0;
        const contribution = (score * cfg.weight) / 100;
        totalW += cfg.weight;
        weightedSum += cfg.weight * score;
        const remark = (selected.comments && selected.comments[c.id]) || '';
        return [
          c.cat.label,
          c.name,
          <span className={`apr-rv-chip-sm apr-rv-chip-sm--${cfg.mode}`} key="s">{cfg.mode === 'auto' ? 'AUTO' : 'MANUAL'}</span>,
          `${score}%`,
          `${cfg.weight}%`,
          contribution.toFixed(1),
          remark ? <em key="r">{remark}</em> : '—',
        ];
      });
      const total = totalW ? weightedSum / totalW : 0;
      return {
        columns: ['Category', 'Parameter', 'Source', 'Score', 'Weight', 'Weighted Score', 'Remarks'],
        aligns:  ['l', 'l', 'c', 'r', 'r', 'r', 'l'],
        widths:  ['16%', '20%', '8%', '8%', '8%', '12%', '28%'],
        rows,
        footer: ['Overall', '', '', `${Math.round(total)}%`, '100%', total.toFixed(1), '—'],
      };
    }

    /* Ranking / Monthly / Quarterly / Bi-Annual / Annual */
    if (['ranking', 'monthly', 'quarterly', 'biannual', 'annual'].includes(reportId)) {
      const showRank = reportId === 'ranking';
      return {
        columns: [...(showRank ? ['Rank'] : []), 'Employee', 'Department', 'Period', 'Score', 'Grade', 'Status', 'Conducted By'],
        aligns:  [...(showRank ? ['c'] : []), 'l', 'l', 'l', 'r', 'c', 'c', 'l'],
        widths:  showRank
          ? ['8%', '20%', '15%', '12%', '8%', '10%', '12%', '15%']
          : ['22%', '17%', '12%', '8%', '12%', '14%', '15%'],
        rows: ranked.map((a, i) => [
          ...(showRank ? [i + 1] : []),
          getFullName(a.emp),
          a.dept?.name || '—',
          a.period,
          `${Math.round(a.overall)}%`,
          <span className={`apr-grade-pill apr-grade-pill--${a.grade?.tone || 'red'}`} key="g">{a.grade?.label || '—'}</span>,
          a.status === 'completed' ? 'Completed' : 'Draft',
          a.conductedBy || '—',
        ]),
      };
    }

    /* Top / Low Performers */
    if (reportId === 'top' || reportId === 'low') {
      const isTop = reportId === 'top';
      const slice = isTop ? ranked.slice(0, 5) : ranked.filter(a => a.overall < 70);
      return {
        columns: ['Rank', 'Employee', 'Department', 'Score', 'Grade', isTop ? 'Key Strength' : 'Key Gap'],
        aligns:  ['c', 'l', 'l', 'r', 'c', 'l'],
        widths:  ['8%', '22%', '18%', '10%', '10%', '32%'],
        rows: slice.map((a, i) => {
          const ks = isTop ? highestCriterion(a.scores, setup) : lowestCriterion(a.scores, setup);
          return [
            i + 1,
            getFullName(a.emp),
            a.dept?.name || '—',
            `${Math.round(a.overall)}%`,
            <span className={`apr-grade-pill apr-grade-pill--${a.grade?.tone || 'red'}`} key="g">{a.grade?.label || '—'}</span>,
            ks ? `${ks.name} (${Math.round(ks.score)}%)` : '—',
          ];
        }),
      };
    }

    /* Bonus eligibility */
    if (reportId === 'bonus') {
      const min = setup.eligibility.find(e => e.id === 'bonus')?.min || 90;
      return {
        columns: ['Employee', 'Department', 'Score', 'Threshold', 'Eligible', 'Bonus Amount'],
        aligns:  ['l', 'l', 'r', 'r', 'c', 'r'],
        widths:  ['24%', '20%', '10%', '12%', '12%', '22%'],
        rows: ranked.map(a => {
          const elig = a.overall >= min;
          return [
            getFullName(a.emp),
            a.dept?.name || '—',
            `${Math.round(a.overall)}%`,
            `${min}%`,
            <span className={`apr-rv-chip-sm apr-rv-chip-sm--${elig ? 'eligible' : 'noteligible'}`} key="e">{elig ? 'YES' : 'NO'}</span>,
            a.bonusRecommended ? `PKR ${Number(a.bonusAmount || 0).toLocaleString('en-PK')}` : '—',
          ];
        }),
      };
    }

    /* Salary Increment */
    if (reportId === 'increment') {
      return {
        columns: ['Employee', 'Department', 'Score', 'Current Salary', 'Increment %', 'New Salary'],
        aligns:  ['l', 'l', 'r', 'r', 'r', 'r'],
        widths:  ['22%', '17%', '10%', '17%', '12%', '22%'],
        rows: ranked.map(a => {
          const cur = Number(a.emp?.basicSalary || 0);
          const pct = a.incrementRecommended ? Number(a.incrementPercent || 0) : 0;
          const nw  = Math.round(cur * (1 + pct / 100));
          return [
            getFullName(a.emp),
            a.dept?.name || '—',
            `${Math.round(a.overall)}%`,
            `PKR ${cur.toLocaleString('en-PK')}`,
            `${pct}%`,
            `PKR ${nw.toLocaleString('en-PK')}`,
          ];
        }),
      };
    }

    /* Promotion eligibility */
    if (reportId === 'promotion') {
      const min = setup.eligibility.find(e => e.id === 'promotion')?.min || 85;
      return {
        columns: ['Employee', 'Department', 'Score', 'Current Role', 'Recommendation'],
        aligns:  ['l', 'l', 'r', 'l', 'l'],
        widths:  ['22%', '18%', '10%', '20%', '30%'],
        rows: ranked.map(a => [
          getFullName(a.emp),
          a.dept?.name || '—',
          `${Math.round(a.overall)}%`,
          a.desig?.name || '—',
          a.overall >= min
            ? <span className="apr-rv-chip-sm apr-rv-chip-sm--eligible" key="r">RECOMMEND PROMOTION</span>
            : <span className="apr-rv-chip-sm apr-rv-chip-sm--noteligible" key="r">NOT ELIGIBLE YET</span>,
        ]),
      };
    }

    /* Training needs */
    if (reportId === 'training') {
      return {
        columns: ['Employee', 'Lowest Category', 'Score', 'Suggested Training Area'],
        aligns:  ['l', 'l', 'r', 'l'],
        widths:  ['22%', '24%', '10%', '44%'],
        rows: ranked.map(a => {
          const w = weakestCategory(a.scores, setup);
          return [
            getFullName(a.emp),
            w?.cat?.label || '—',
            w ? `${Math.round(w.avg)}%` : '—',
            w ? `${w.cat.label} workshop` : '—',
          ];
        }),
      };
    }

    return null;
  }, [reportId, setup, ranked, selected]);

  if (!spec) return (
    <div className="apr-rv-empty">No data available for this report.</div>
  );

  return (
    <table className="apr-rv-table">
      <thead>
        <tr>
          {spec.columns.map((c, i) => (
            <th
              key={i}
              style={{ width: spec.widths?.[i], textAlign: spec.aligns?.[i] === 'r' ? 'right' : spec.aligns?.[i] === 'c' ? 'center' : 'left' }}
            >{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {spec.rows.length === 0 ? (
          <tr><td colSpan={spec.columns.length} className="apr-rv-noscore">No staff match this report's criteria.</td></tr>
        ) : spec.rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} style={{ textAlign: spec.aligns?.[j] === 'r' ? 'right' : spec.aligns?.[j] === 'c' ? 'center' : 'left' }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
      {spec.footer && (
        <tfoot>
          <tr className="apr-rv-tot">
            {spec.footer.map((cell, j) => (
              <td key={j} style={{ textAlign: spec.aligns?.[j] === 'r' ? 'right' : spec.aligns?.[j] === 'c' ? 'center' : 'left' }}>{cell}</td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  );
}

/* Parameter-wise remarks section for the Individual report only. */
function ParameterRemarksSection({ appraisal, setup }) {
  const rows = APPRAISAL_FRAMEWORK
    .flatMap(cat => cat.criteria.map(c => ({ ...c, cat })))
    .filter(c => setup.criteria[c.id]?.enabled !== false && (appraisal.comments?.[c.id] || '').trim());
  if (rows.length === 0) return null;
  return (
    <div className="apr-rv-remarks">
      <div className="apr-rv-section-h">Parameter-wise Appraiser Remarks</div>
      {rows.map(c => {
        const score = Number(appraisal.scores?.[c.id]) || 0;
        return (
          <div className="apr-rv-remark" key={c.id}>
            <div className="apr-rv-remark-h">
              <b>{c.name}</b>
              <span className="apr-rv-remark-score">— {score}/100</span>
            </div>
            <div className="apr-rv-remark-body">&ldquo;{appraisal.comments[c.id]}&rdquo;</div>
          </div>
        );
      })}
    </div>
  );
}

/* Print + B&W CSS — injected once per viewer mount. Hides everything
   outside the A4 sheet so window.print() emits only the sheet. */
const APR_RV_PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #apr-rv-print-root, #apr-rv-print-root * { visibility: visible !important; }
  #apr-rv-print-root {
    position: fixed !important;
    inset: 0 !important;
    margin: 0 !important;
    padding: 30px !important;
    background: #fff !important;
    box-shadow: none !important;
    width: 100% !important;
    max-width: none !important;
    border-radius: 0 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  .no-print { display: none !important; }
}
.apr-rv--bw .apr-rv-sheet { filter: grayscale(1); }
`;

// eslint-disable-next-line no-unused-vars
function AppraisalReportModal({ reportId, setup, emps, depts, desigs, appraisals, onClose, toast }) {
  const meta = APPRAISAL_REPORT_TYPES.find(r => r.id === reportId);
  const [period, setPeriod] = useState(latestPeriod(appraisals));
  const [empId, setEmpId]   = useState(emps[0]?.id || '');

  /* Common derived data: enrich appraisals with overall + grade + emp. */
  const enriched = useMemo(() => appraisals.map(a => ({
    ...a,
    overall: computeOverall(setup, a.scores),
    grade:   gradeFor(computeOverall(setup, a.scores), setup.grades),
    emp:     emps.find(e => e.id === a.empId),
    dept:    depts.find(d => d.id === emps.find(e => e.id === a.empId)?.dId),
    desig:   desigs.find(d => d.id === emps.find(e => e.id === a.empId)?.desId),
  })), [appraisals, setup, emps, depts, desigs]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handlePrint = () => window.print();

  /* ── Build the dataset that drives both the on-screen table and
     the CSV download. We branch per reportId here. */
  const dataset = useMemo(() => {
    const ofPeriod  = period ? enriched.filter(a => a.period === period) : enriched;
    const byOverall = [...ofPeriod].sort((a, b) => b.overall - a.overall);

    switch (reportId) {
      case 'individual': {
        const a = enriched.find(x => x.empId === Number(empId) && (!period || x.period === period))
               || enriched.find(x => x.empId === Number(empId));
        return { kind: 'individual', appraisal: a };
      }
      case 'ranking':
        return { kind: 'list', label: 'Ranking', rows: byOverall.map((a, i) => ({ rank: i + 1, ...a })) };
      case 'top':
        return { kind: 'list', label: 'Top performers', rows: byOverall.slice(0, 5).map((a, i) => ({ rank: i + 1, ...a })) };
      case 'low':
        return { kind: 'list', label: 'Low performers', rows: byOverall.filter(a => a.overall < 70).map((a, i) => ({ rank: i + 1, ...a })) };
      case 'bonus':
        return { kind: 'list', label: 'Bonus eligible', rows: byOverall.filter(a => a.overall >= (setup.eligibility.find(x => x.id === 'bonus')?.min || 90)).map((a, i) => ({ rank: i + 1, ...a })) };
      case 'increment':
        return { kind: 'list', label: 'Increment eligible', rows: byOverall.filter(a => a.overall >= (setup.eligibility.find(x => x.id === 'increment')?.min || 80)).map((a, i) => ({ rank: i + 1, ...a })) };
      case 'promotion':
        return { kind: 'list', label: 'Promotion eligible', rows: byOverall.filter(a => a.overall >= (setup.eligibility.find(x => x.id === 'promotion')?.min || 85)).map((a, i) => ({ rank: i + 1, ...a })) };
      case 'training':
        return { kind: 'training', rows: byOverall.map(a => ({ ...a, weakAreas: weakAreasOf(a.scores, 3) })) };
      case 'monthly':
      case 'quarterly':
      case 'biannual':
      case 'annual':
        return { kind: 'list', label: meta.label, rows: byOverall.map((a, i) => ({ rank: i + 1, ...a })) };
      default:
        return { kind: 'list', rows: byOverall };
    }
  }, [reportId, enriched, empId, period, setup, meta]);

  const exportCsv = () => {
    if (dataset.kind === 'individual' && dataset.appraisal) {
      const rows = [['Category', 'Criterion', 'Score', 'Comment']];
      APPRAISAL_FRAMEWORK.forEach(cat => cat.criteria.forEach(c => {
        if (setup.criteria[c.id]?.enabled === false) return;
        rows.push([cat.label, c.name, dataset.appraisal.scores[c.id] ?? '', (dataset.appraisal.comments[c.id] || '').replace(/\n/g, ' ')]);
      }));
      downloadCsv(`appraisal-${dataset.appraisal.emp?.eid || 'staff'}-${dataset.appraisal.period}.csv`, rows);
      toast('CSV exported', 'success');
      return;
    }
    const rows = [['#', 'Employee', 'EID', 'Department', 'Designation', 'Period', 'Overall %', 'Grade', 'Status']];
    (dataset.rows || []).forEach(r => {
      rows.push([
        r.rank ?? '',
        getFullName(r.emp), r.emp?.eid || '',
        r.dept?.name || '', r.desig?.name || '',
        r.period, Math.round(r.overall),
        r.grade?.label || '—',
        r.status,
      ]);
    });
    downloadCsv(`${reportId}-report.csv`, rows);
    toast('CSV exported', 'success');
  };

  const tone = meta?.tone || 'blue';
  const grad = {
    blue:   'linear-gradient(135deg,#1E3A8A,#1E40AF)',
    green:  'linear-gradient(135deg,#065F46,#0F766E)',
    indigo: 'linear-gradient(135deg,#3730A3,#4F46E5)',
    orange: 'linear-gradient(135deg,#7C2D12,#C2410C)',
    red:    'linear-gradient(135deg,#7F1D1D,#B91C1C)',
  }[tone];

  const periods = Array.from(new Set(enriched.map(a => a.period))).sort().reverse();

  return createPortal((
    <div
      className="emp-modal-back"
      role="dialog" aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="emp-modal slip-modal" style={{ width: 'min(1080px, 100%)' }}>
        <div className="emp-modal-head" style={{ background: grad }}>
          <div className="emp-modal-head-l">
            <div className="emp-modal-icn"><i className={`fa-solid ${meta?.icon || 'fa-file-lines'}`} aria-hidden="true"></i></div>
            <div>
              <div className="emp-modal-title">{meta?.label}</div>
              <div className="emp-modal-sub">{meta?.desc}</div>
            </div>
          </div>
          <div className="emp-modal-head-actions">
            <Tooltip text="Print or save as PDF">
              <button className="emp-btn emp-btn-ghost" onClick={handlePrint}><i className="fa-solid fa-print" aria-hidden="true"></i> PDF</button>
            </Tooltip>
            <Tooltip text="Download as Excel-compatible CSV">
              <button className="emp-btn emp-btn-ghost" onClick={exportCsv}><i className="fa-solid fa-file-excel" aria-hidden="true"></i> Excel</button>
            </Tooltip>
            <Tooltip text="Close (Esc)">
              <button className="emp-modal-x" onClick={onClose} aria-label="Close modal"><i className="fa-solid fa-xmark" aria-hidden="true"></i></button>
            </Tooltip>
          </div>
        </div>

        {/* Toolbar */}
        <div className="rpt-toolbar">
          {reportId === 'individual' && (
            <>
              <span className="rpt-toolbar-lbl">Staff:</span>
              <select className="emp-filter-select" value={empId} onChange={(e) => setEmpId(Number(e.target.value))}>
                {emps.map(e => <option key={e.id} value={e.id}>{getFullName(e)} · {e.eid}</option>)}
              </select>
            </>
          )}
          <span className="rpt-toolbar-lbl">Period:</span>
          <select className="emp-filter-select" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="">All periods</option>
            {periods.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <span className="rpt-toolbar-count">
            {dataset.kind === 'list' ? `${dataset.rows.length} row${dataset.rows.length === 1 ? '' : 's'}` : dataset.appraisal ? '1 record' : 'No record'}
          </span>
        </div>

        <div className="emp-modal-body slip-body">
          <div className="slip-paper" id="slip-print-root">
            <div className="slip-head">
              <div className="slip-logo"><i className="fa-solid fa-school" aria-hidden="true"></i></div>
              <div className="slip-school">
                <div className="slip-school-name">School Mentor Academy</div>
                <div className="slip-school-addr">Sector G-9, Islamabad · +92 51 0000 000 · admin@schoolmentor.app</div>
              </div>
              <div className="slip-meta">
                <div className="slip-meta-lbl">{meta?.label}</div>
                <div className="slip-meta-val">{period || 'All periods'}</div>
              </div>
            </div>

            {dataset.kind === 'individual'
              ? <IndividualReportBody appraisal={dataset.appraisal} setup={setup} />
              : dataset.kind === 'training'
                ? <TrainingNeedsBody rows={dataset.rows} setup={setup} />
                : <ListReportBody label={dataset.label} rows={dataset.rows} setup={setup} />}

            <div className="rpt-foot">
              Generated on {new Date().toISOString().slice(0, 10)} · School Mentor ERP · Confidential.
            </div>
          </div>
        </div>

        <div className="emp-modal-foot">
          <div className="emp-modal-foot-msg" style={{ background: '#EFF6FF', color: '#1E40AF' }}>
            <i className="fa-solid fa-info-circle" aria-hidden="true"></i>
            Use <b>PDF</b> for a printable copy or <b>Excel</b> for further analysis in spreadsheet apps.
          </div>
          <div className="emp-modal-foot-actions">
            <button type="button" className="emp-btn emp-btn-ghost" onClick={onClose}>Close</button>
            <button type="button" className="emp-btn emp-btn-primary" onClick={handlePrint}>
              <i className="fa-solid fa-print" aria-hidden="true"></i> Print Report
            </button>
          </div>
        </div>
      </div>
    </div>
  ), document.body);
}

function ListReportBody({ label, rows, setup }) {
  if (!rows || rows.length === 0) {
    return <div className="rpt-empty"><i className="fa-solid fa-folder-open" aria-hidden="true"></i> No rows match the current filters.</div>;
  }
  return (
    <table className="rpt-table rpt-table--compact">
      <thead>
        <tr>
          <th style={{ width: 40 }}>#</th>
          <th style={{ width: 90 }}>EID</th>
          <th>Employee</th>
          <th>Department</th>
          <th>Designation</th>
          <th>Period</th>
          <th className="r">Overall</th>
          <th style={{ width: 70 }}>Grade</th>
          <th style={{ width: 90 }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id}>
            <td>{r.rank}</td>
            <td className="rpt-mono">{r.emp?.eid}</td>
            <td><b>{getFullName(r.emp)}</b></td>
            <td>{r.dept?.name || '—'}</td>
            <td>{r.desig?.name || '—'}</td>
            <td>{r.period}</td>
            <td className="r rpt-mono pay-net">{Math.round(r.overall)}%</td>
            <td><span className={`apr-grade-pill apr-grade-pill--${r.grade?.tone || 'red'}`}>{r.grade?.label || '—'}</span></td>
            <td><span className={`pay-status pay-status--${r.status === 'completed' ? 'paid' : 'pending'}`}>{r.status}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function IndividualReportBody({ appraisal, setup }) {
  if (!appraisal) {
    return <div className="rpt-empty"><i className="fa-solid fa-folder-open" aria-hidden="true"></i> No appraisal found for this staff member &amp; period.</div>;
  }
  const overall = computeOverall(setup, appraisal.scores);
  const grade   = gradeFor(overall, setup.grades);
  const emp = appraisal.emp;

  return (
    <>
      <div className="prof-head">
        <div className="prof-photo">
          {emp?.photo
            ? <img src={emp.photo} alt={getFullName(emp)} />
            : <span>{initialsOf(emp)}</span>}
        </div>
        <div className="prof-head-body">
          <div className="prof-name">{getFullName(emp)}</div>
          <div className="prof-tags">
            <span className="emp-eid">{emp?.eid}</span>
            <span className="hr-pill hr-pill-blue">{appraisal.dept?.name || '—'}</span>
            <span className="hr-pill hr-pill-gray">{appraisal.desig?.name || '—'}</span>
            <span className={`apr-grade-pill apr-grade-pill--${grade?.tone || 'red'}`}>{grade?.label || '—'} · {Math.round(overall)}%</span>
          </div>
          <div className="prof-role">{appraisal.period} · Conducted by {appraisal.conductedBy} on {appraisal.conductedAt}</div>
        </div>
      </div>

      {APPRAISAL_FRAMEWORK.map(cat => {
        const enabledCrits = cat.criteria.filter(c => setup.criteria[c.id]?.enabled !== false);
        if (enabledCrits.length === 0) return null;
        const avg = Math.round(enabledCrits.reduce((s, c) => s + (Number(appraisal.scores[c.id]) || 0), 0) / enabledCrits.length);
        return (
          <div className="prof-section" key={cat.id}>
            <div className="prof-section-h">
              <i className={`fa-solid ${cat.icon}`} aria-hidden="true"></i> {cat.label}
              <span className="det-title-count" style={{ marginLeft: 'auto' }}>{avg}%</span>
            </div>
            <table className="rpt-table rpt-table--compact">
              <thead>
                <tr><th>Criterion</th><th className="r">Score</th><th style={{ width: 60 }}>Grade</th><th>Comments</th></tr>
              </thead>
              <tbody>
                {enabledCrits.map(c => {
                  const s = appraisal.scores[c.id];
                  const g = gradeFor(Number(s) || 0, setup.grades);
                  return (
                    <tr key={c.id}>
                      <td><b>{c.name}</b></td>
                      <td className="r rpt-mono">{s != null ? `${Math.round(s)}%` : '—'}</td>
                      <td><span className={`apr-grade-pill apr-grade-pill--${g?.tone || 'red'}`}>{g?.label || '—'}</span></td>
                      <td>{appraisal.comments[c.id] || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      {appraisal.parentFeedback && appraisal.parentFeedback.score && (
        <div className="prof-section">
          <div className="prof-section-h"><i className="fa-solid fa-comments" aria-hidden="true"></i> Parent Feedback</div>
          <div className="prof-grid">
            <div className="prof-kv"><span className="prof-kv-k">Score</span><span className="prof-kv-v">{appraisal.parentFeedback.score}%</span></div>
            <div className="prof-kv span2"><span className="prof-kv-k">Summary</span><span className="prof-kv-v">{appraisal.parentFeedback.summary || '—'}</span></div>
          </div>
        </div>
      )}

      <div className="prof-section">
        <div className="prof-section-h"><i className="fa-solid fa-gauge" aria-hidden="true"></i> Eligibility</div>
        <div className="prof-grid">
          {setup.eligibility.map(e => {
            const ok = overall >= e.min;
            return (
              <div className={`prof-kv${ok ? ' prof-kv--hl' : ''}`} key={e.id}>
                <span className="prof-kv-k">{e.label}</span>
                <span className="prof-kv-v">
                  <i className={`fa-solid ${ok ? 'fa-check' : 'fa-xmark'}`} style={{ color: ok ? '#15803D' : '#B91C1C', marginRight: 4 }} aria-hidden="true" />
                  {ok ? 'Eligible' : `Needs ${e.min}%`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function TrainingNeedsBody({ rows, setup }) {
  if (!rows || rows.length === 0) return <div className="rpt-empty">No data.</div>;
  return (
    <table className="rpt-table rpt-table--compact">
      <thead>
        <tr><th style={{ width: 40 }}>#</th><th>Employee</th><th>Department</th><th className="r">Overall</th><th>Suggested training areas</th></tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.id}>
            <td>{i + 1}</td>
            <td><b>{getFullName(r.emp)}</b> <span className="emp-eid" style={{ marginLeft: 4 }}>{r.emp?.eid}</span></td>
            <td>{r.dept?.name || '—'}</td>
            <td className="r rpt-mono">{Math.round(r.overall)}%</td>
            <td>
              {r.weakAreas.length === 0
                ? <span style={{ color: '#15803D' }}><i className="fa-solid fa-check" aria-hidden="true" /> No urgent training needs</span>
                : r.weakAreas.map(w => (
                    <span className="apr-train-chip" key={w.id}><i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i> {w.name} · {Math.round(w.score)}%</span>
                  ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Tiny shared bits — Field, helpers, math
   ═══════════════════════════════════════════════════════════════════ */
function Field({ label, required, error, colSpan, children }) {
  const span = colSpan === 4 ? ' span4' : colSpan === 3 ? ' span3' : colSpan === 2 ? ' span2' : '';
  return (
    <div className={`emp-field${error ? ' has-error' : ''}${span}`}>
      <label>{label}{required && <span className="emp-field-req">*</span>}</label>
      {children}
      {error && <span className="emp-field-err"><i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i> {error}</span>}
    </div>
  );
}

function getFullName(emp) {
  if (!emp) return '—';
  const fn = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
  return fn || emp.eid || 'Unnamed';
}
function initialsOf(emp) {
  if (!emp) return '?';
  return getFullName(emp).split(' ').filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 2) || '?';
}
function clone(o) { return JSON.parse(JSON.stringify(o)); }

function gradeFor(score, grades) {
  if (score == null || isNaN(score)) return null;
  for (const g of (grades || [])) {
    if (score >= g.min && score <= g.max) return g;
  }
  return null;
}
function computeOverall(setup, scores) {
  let totalWeight = 0;
  let weighted = 0;
  APPRAISAL_FRAMEWORK.forEach(cat => cat.criteria.forEach(c => {
    const cfg = setup.criteria[c.id] || { mode: 'manual', weight: c.weight, enabled: true };
    if (cfg.enabled === false) return;
    const s = Number(scores[c.id]);
    if (!isFinite(s)) return;
    totalWeight += cfg.weight;
    weighted    += cfg.weight * s;
  }));
  return totalWeight === 0 ? 0 : weighted / totalWeight;
}
function defaultPeriodFor(cycle) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (cycle === 'monthly')  return `${y}-${String(m).padStart(2, '0')}`;
  if (cycle === 'quarterly') return `${y}-Q${Math.ceil(m / 3)}`;
  if (cycle === 'biannual')  return `${y}-H${m <= 6 ? 1 : 2}`;
  return `${y}`;
}
function periodPlaceholder(cycle) {
  if (cycle === 'monthly')   return 'e.g. 2026-05';
  if (cycle === 'quarterly') return 'e.g. 2026-Q2';
  if (cycle === 'biannual')  return 'e.g. 2026-H1';
  return 'e.g. 2026';
}
function latestPeriod(appraisals) {
  if (!appraisals || appraisals.length === 0) return '';
  return [...new Set(appraisals.map(a => a.period))].sort().reverse()[0] || '';
}
function weakAreasOf(scores, n) {
  return APPRAISAL_FRAMEWORK
    .flatMap(cat => cat.criteria.map(c => ({ id: c.id, name: c.name, score: Number(scores[c.id]) || 0 })))
    .sort((a, b) => a.score - b.score)
    .slice(0, n);
}

function downloadCsv(filename, rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map(r => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════════════════════════════
   Module CSS — mirrors the ERP design system (hr-tabs, hr-info,
   hr-section, hr-pill, hr-btn-*, emp-table) and only adds the
   indigo brand accent for module identity.
   ═══════════════════════════════════════════════════════════════════ */
const APR_CSS = `
/* ── L1 sub-tabs — same shape system as hr-tabs ── */
.apr-subtabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  padding: 4px;
  margin-bottom: 18px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-lg, 16px);
  box-shadow: var(--shadow-sm);
}
.apr-subtab {
  flex: 1; min-width: 160px;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 11px 14px;
  border: none;
  background: transparent;
  border-radius: var(--radius-md, 12px);
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted);
  cursor: pointer;
  transition: all .2s ease;
}
.apr-subtab:hover:not(.on) { background: var(--bg-muted); color: var(--brand-primary, #1E40AF); }
.apr-subtab.on {
  background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 60%, #2563EB 100%);
  color: #fff;
  box-shadow: 0 6px 20px rgba(30, 58, 138, .4), inset 0 1px 0 rgba(255, 255, 255, .2);
}
.apr-subtab:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(30, 64, 175, .25); }
.apr-subtab i { font-size: 12px; }

/* ── Info-banner button CTA row (used by Setup) ── */
.apr-info-cta { margin-top: 8px; }
.apr-link-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px;
  background: var(--bg-card);
  border: 1.5px solid rgba(30, 64, 175, .22);
  color: var(--brand-primary, #1E40AF);
  border-radius: 8px;
  font: 700 12px/1 var(--font-body);
  cursor: pointer;
  transition: all .15s ease;
}
.apr-link-btn:hover { background: rgba(30, 64, 175, .06); border-color: #1E40AF; }
.apr-link-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(30, 64, 175, .25); }

/* ── Setup tab — top intro banner ── */
.apr-setup-intro {
  background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%);
  border: 1.5px solid #BFDBFE;
  border-radius: 16px;
  padding: 18px 22px;
  margin-bottom: 20px;
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.apr-setup-intro-ic {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border-radius: 12px;
  background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  box-shadow: 0 4px 10px rgba(30, 58, 138, .28),
              inset 0 1px 0 rgba(255, 255, 255, .14);
}
.apr-setup-intro-body {
  flex: 1;
  min-width: 0;
}
.apr-setup-intro-title {
  font-family: var(--apr-font);
  font-size: 14px;
  font-weight: 800;
  color: #0F172A;
  letter-spacing: -.01em;
  line-height: 1.3;
}
.apr-setup-intro-accent { color: #1E40AF; }
.apr-setup-intro-desc {
  font-family: var(--apr-font);
  font-size: 12.5px;
  font-weight: 500;
  color: #1E3A5F;
  line-height: 1.6;
  margin-top: 4px;
}
.apr-setup-intro-btn {
  margin-top: 12px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1.5px solid #1E40AF;
  background: #fff;
  color: #1E40AF;
  font-family: var(--apr-font);
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all .18s ease;
  letter-spacing: -.005em;
  white-space: nowrap;
}
.apr-setup-intro-btn i { font-size: 12px; }
.apr-setup-intro-btn:hover {
  background: #EFF6FF;
  box-shadow: 0 2px 8px rgba(30, 58, 138, .12);
}
.apr-setup-intro-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(30, 64, 175, .25);
}

/* ── Setup section cards — mirror hr-section ── */
.apr-setup-card {
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-lg, 16px);
  box-shadow: var(--shadow-sm);
  margin-bottom: 14px;
  overflow: hidden;
}
.apr-setup-head {
  display: grid;
  grid-template-columns: 32px 1fr;
  gap: 12px;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1.5px solid var(--border-light);
  background: var(--bg-muted);
}
.apr-step {
  width: 30px; height: 30px;
  border-radius: 8px;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  font: 800 13px/1 var(--font-body);
  box-shadow: 0 3px 8px rgba(30, 64, 175, .28);
}
.apr-setup-title { font-size: 14.5px; font-weight: 800; color: var(--text-primary); letter-spacing: -.01em; }
.apr-setup-sub   { font-size: 12px; color: var(--text-secondary); margin-top: 3px; line-height: 1.4; }
.apr-setup-body  { padding: 16px 18px; }

/* ── Step 1 · Review-cycle pick cards ── */
.apr-cycle-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.apr-cycle {
  display: grid;
  grid-template-columns: 40px 1fr 20px;
  gap: 12px;
  align-items: flex-start;
  padding: 12px 14px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: all .18s ease;
  position: relative;
}
.apr-cycle:hover:not(.on) { border-color: #CBD5E1; transform: translateY(-1px); box-shadow: var(--shadow-sm); }
.apr-cycle.on {
  border-color: #1E40AF;
  box-shadow: 0 6px 16px rgba(30, 64, 175, .12);
  background: linear-gradient(180deg, rgba(30, 64, 175, .04) 0%, var(--bg-card) 60%);
}
.apr-cycle-ic {
  width: 40px; height: 40px;
  border-radius: 10px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 16px;
}
.apr-cycle--blue   .apr-cycle-ic { background: rgba(30, 64, 175, .12);  color: #1E40AF; }
.apr-cycle--green  .apr-cycle-ic { background: rgba(21, 128, 61, .12);  color: #15803D; }
.apr-cycle--indigo .apr-cycle-ic { background: rgba(67, 56, 202, .12);  color: #4338CA; }
.apr-cycle--orange .apr-cycle-ic { background: rgba(194, 65, 12, .12);  color: #C2410C; }
.apr-cycle-h    { font: 700 13.5px/1.2 var(--font-body); color: var(--text-primary); }
.apr-cycle-when { font: 500 12px/1.4 var(--font-body); color: var(--text-secondary); margin: 4px 0 8px; }
.apr-cycle-pros { display: flex; flex-wrap: wrap; gap: 3px 12px; font: 600 11px/1.4 var(--font-body); color: #15803D; }
.apr-cycle-pros i { margin-right: 4px; color: #16A34A; font-size: 9px; }
.apr-cycle-tick { color: var(--border-light); font-size: 16px; transition: color .15s ease; align-self: center; }
.apr-cycle.on .apr-cycle-tick { color: #1E40AF; }

/* ── Step 2 · Grading scale table ── */
.apr-grade-list {
  background: #fff;
  border: 1px solid #BFDBFE;
  border-radius: 12px;
  overflow: hidden;
}
.apr-grade-head,
.apr-grade-row {
  display: grid;
  grid-template-columns: 70px 96px 96px 1fr;
  gap: 14px;
  align-items: center;
}

/* Column header — slim, uppercase, brand-grey */
.apr-grade-head {
  padding: 10px 14px;
  background: #F0F4FF;
  font-family: var(--apr-font);
  font-size: 10px;
  font-weight: 800;
  color: #64748B;
  text-transform: uppercase;
  letter-spacing: .6px;
  line-height: 1;
  border-bottom: 1px solid #DBEAFE;
}

/* Data rows — 52 px min-height, subtle divider + hover */
.apr-grade-row {
  padding: 8px 14px;
  min-height: 52px;
  border-bottom: 1px solid #EFF6FF;
  transition: background .15s ease;
}
.apr-grade-row:last-child { border-bottom: none; }
.apr-grade-row:hover { background: #F8FAFF; }

/* Grade chip — 32 × 32 pill with gradient + white text */
.apr-grade-chip {
  width: 36px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: #fff;
  font-family: var(--apr-font);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: .01em;
  box-shadow: 0 2px 6px rgba(15, 23, 42, .14);
}
.apr-grade-chip--green  { background: linear-gradient(135deg, #16A34A 0%, #15803D 100%); }
.apr-grade-chip--blue   { background: linear-gradient(135deg, #2563EB 0%, #1E3A8A 100%); }
.apr-grade-chip--indigo { background: linear-gradient(135deg, #6366F1 0%, #4338CA 100%); }
.apr-grade-chip--orange { background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); }
.apr-grade-chip--red    { background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); }

/* From / To number inputs */
.apr-grade-input {
  width: 80px;
  height: 40px;
  padding: 0 12px;
  border: 1.5px solid #BFDBFE;
  border-radius: 8px;
  background: #fff;
  color: #0F172A;
  font-family: var(--apr-font);
  font-size: 13px;
  font-weight: 700;
  text-align: center;
  transition: all .15s ease;
  -moz-appearance: textfield;
}
.apr-grade-input::-webkit-outer-spin-button,
.apr-grade-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.apr-grade-input:hover { border-color: #93C5FD; }
.apr-grade-input:focus {
  outline: none;
  border-color: #1E3A8A;
  box-shadow: 0 0 0 3px rgba(30, 58, 138, .10);
}

/* "What this means" copy */
.apr-grade-meaning {
  font-family: var(--apr-font);
  font-size: 12.5px;
  font-weight: 500;
  color: #1E3A5F;
  line-height: 1.45;
}

/* ── Warning banner under the grade table ── */
.apr-warning {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  padding: 12px 16px;
  background: #FFF7ED;
  border: 1px solid #FED7AA;
  border-radius: 10px;
}
.apr-warning-ic {
  color: #D97706;
  font-size: 15px;
  flex-shrink: 0;
}
.apr-warning-text {
  font-family: var(--apr-font);
  font-size: 12.5px;
  font-weight: 600;
  color: #92400E;
  line-height: 1.5;
}
.apr-warning-text b {
  font-weight: 800;
  color: #D97706;
}

/* ── Step 3 · Eligibility cards ── */
.apr-elig-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.apr-elig {
  display: flex; flex-direction: column; gap: 10px;
  padding: 12px 14px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
}
.apr-elig--blue   { border-left: 4px solid #1E40AF; }
.apr-elig--green  { border-left: 4px solid #15803D; }
.apr-elig--indigo { border-left: 4px solid #4338CA; }
.apr-elig--orange { border-left: 4px solid #C2410C; }
.apr-elig-h { display: flex; gap: 10px; align-items: flex-start; }
.apr-elig-ic {
  width: 34px; height: 34px;
  border-radius: 9px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
}
.apr-elig--blue   .apr-elig-ic { background: rgba(30, 64, 175, .12);  color: #1E40AF; }
.apr-elig--green  .apr-elig-ic { background: rgba(21, 128, 61, .12);  color: #15803D; }
.apr-elig--indigo .apr-elig-ic { background: rgba(67, 56, 202, .12);  color: #4338CA; }
.apr-elig--orange .apr-elig-ic { background: rgba(194, 65, 12, .12);  color: #C2410C; }
.apr-elig-title { font: 800 13px/1.2 var(--font-body); color: var(--text-primary); }
.apr-elig-desc  { font: 500 11.5px/1.5 var(--font-body); color: var(--text-secondary); margin-top: 2px; }
.apr-elig-control {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border-light);
}
.apr-threshold-label {
  font-family: var(--apr-font);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: #64748B;
  line-height: 1;
}
.apr-threshold-input {
  width: 72px;
  height: 42px;
  padding: 0 10px;
  border: 1.5px solid #BFDBFE;
  border-radius: 10px;
  background: #fff;
  color: #1E3A8A;
  font-family: var(--apr-font);
  font-size: 18px;
  font-weight: 800;
  text-align: center;
  font-variant-numeric: tabular-nums;
  transition: all .15s ease;
  -moz-appearance: textfield;
}
.apr-threshold-input::-webkit-outer-spin-button,
.apr-threshold-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.apr-threshold-input:hover { border-color: #93C5FD; }
.apr-threshold-input:focus {
  outline: none;
  border-color: #1E3A8A;
  box-shadow: 0 0 0 3px rgba(30, 58, 138, .10);
}
.apr-elig-suffix {
  font-family: var(--apr-font);
  font-size: 12px;
  font-weight: 600;
  color: #94A3B8;
  line-height: 1;
}

/* ── Weight pill (per-criterion in Step 4) ── */
.apr-weight-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 36px;
  padding: 0 14px;
  background: #F0F4FF;
  border: 1.5px solid #BFDBFE;
  border-radius: 999px;
  transition: all .15s ease;
}
.apr-weight-pill:hover { border-color: #93C5FD; }
.apr-weight-pill:focus-within {
  border-color: #1E3A8A;
  box-shadow: 0 0 0 3px rgba(30, 58, 138, .09);
}
.apr-weight-input {
  width: 44px;
  border: none;
  background: transparent;
  color: #1E3A8A;
  font-family: var(--apr-font);
  font-size: 14px;
  font-weight: 800;
  text-align: right;
  outline: none;
  font-variant-numeric: tabular-nums;
  -moz-appearance: textfield;
  padding: 0;
}
.apr-weight-input::-webkit-outer-spin-button,
.apr-weight-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.apr-weight-suffix {
  font-family: var(--apr-font);
  font-size: 13px;
  font-weight: 700;
  color: #64748B;
  line-height: 1;
}

/* Weight-input error state — red border + ring */
.apr-weight-input.has-error,
.apr-grade-input.has-error,
.apr-threshold-input.has-error {
  border-color: #DC2626 !important;
  color: #B91C1C;
}
.apr-weight-input.has-error:focus,
.apr-grade-input.has-error:focus,
.apr-threshold-input.has-error:focus {
  box-shadow: 0 0 0 3px rgba(220, 38, 38, .14);
}
.apr-weight-pill.has-error {
  border-color: #DC2626 !important;
  background: rgba(220, 38, 38, .04);
}
.apr-weight-pill.has-error:focus-within {
  box-shadow: 0 0 0 3px rgba(220, 38, 38, .14);
}
.apr-input-error-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--apr-font);
  font-size: 10.5px;
  font-weight: 700;
  color: #DC2626;
  margin-top: 4px;
  letter-spacing: -.005em;
}
.apr-input-error-hint i { font-size: 9px; }

/* ── Live weight-total feedback strip ── */
.apr-weight-total {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border-radius: 10px;
  border: 1px solid;
  margin-top: 10px;
  font-family: var(--apr-font);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
}
.apr-weight-total > i { font-size: 13px; flex-shrink: 0; }
.apr-weight-total-label {
  text-transform: uppercase;
  letter-spacing: .04em;
  font-size: 10.5px;
  font-weight: 800;
  opacity: .85;
}
.apr-weight-total-msg b { font-weight: 800; }
.apr-weight-total-ok { font-weight: 800; margin-left: 2px; }

.apr-weight-total--green {
  background: #ECFDF5;
  border-color: #A7F3D0;
  color: #166534;
}
.apr-weight-total--green > i,
.apr-weight-total--green .apr-weight-total-ok { color: #15803D; }
.apr-weight-total--amber {
  background: #FFFBEB;
  border-color: #FDE68A;
  color: #92400E;
}
.apr-weight-total--amber > i { color: #D97706; }
.apr-weight-total--red {
  background: #FEF2F2;
  border-color: #FECACA;
  color: #991B1B;
}
.apr-weight-total--red > i { color: #DC2626; }

/* Larger variant for the overall categories banner. */
.apr-weight-total--lg {
  font-size: 13px;
  padding: 11px 16px;
  margin: 0 0 12px;
}
.apr-weight-total--lg > i { font-size: 15px; }
.apr-weight-total--lg .apr-weight-total-label { font-size: 11px; }

/* Inline variant used at the bottom of an open accordion. */
.apr-weight-total--inline {
  margin-top: 8px;
  background: #fff;
  padding: 8px 12px;
  font-size: 11.5px;
}

/* ── Editable category weight pill in the accordion head ── */
.apr-cat-head-wrap {
  display: flex;
  align-items: stretch;
  position: relative;
}
.apr-cat-head-wrap > .apr-cat-head { flex: 1; padding-right: 12px; }
.apr-cat-weight {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
  justify-content: center;
  padding: 0 14px 0 6px;
}
.apr-cat-weight-lbl {
  font-family: var(--apr-font);
  font-size: 9.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: #94A3B8;
  line-height: 1;
}
.apr-cat-weight .apr-weight-pill {
  height: 30px;
  padding: 0 10px;
}
.apr-cat-weight .apr-weight-input {
  width: 36px;
  font-size: 13px;
}

/* Green check badge in accordion header when category balanced */
.apr-cat-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px; height: 18px;
  border-radius: 50%;
  background: #15803D;
  color: #fff;
  margin-left: 8px;
  font-size: 9px;
  box-shadow: 0 1px 3px rgba(21, 128, 61, .35);
  vertical-align: middle;
}

/* Tinted error border for the whole category card */
.apr-cat.has-error {
  border-color: #FECACA;
  box-shadow: 0 4px 12px rgba(220, 38, 38, .08);
}
.apr-cat.has-error.apr-cat--blue,
.apr-cat.has-error.apr-cat--green,
.apr-cat.has-error.apr-cat--indigo,
.apr-cat.has-error.apr-cat--orange,
.apr-cat.has-error.apr-cat--red {
  border-left-color: #DC2626;
}

/* Sticky save bar — invalid state lights up red */
.apr-stickybar.invalid {
  border-color: rgba(220, 38, 38, .35);
  background: linear-gradient(180deg, rgba(220, 38, 38, .05) 0%, var(--bg-card) 100%);
  box-shadow: 0 10px 28px rgba(220, 38, 38, .14);
}
.apr-stickybar.invalid .apr-stickybar-msg { color: #B91C1C; }
.apr-stickybar.invalid .apr-stickybar-msg i {
  background: rgba(220, 38, 38, .14);
  color: #DC2626;
}

/* Validation dialog variant — red icon, bulleted list */
.apr-modal--validation { width: min(540px, 100%); }
.apr-delete-ic--validation {
  background: rgba(220, 38, 38, .12);
  color: #DC2626;
}
.apr-wv-list {
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.apr-wv-list li {
  display: grid;
  grid-template-columns: 18px 1fr;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 12px;
  background: #FEF2F2;
  border: 1px solid #FECACA;
  border-radius: 10px;
  font-family: var(--apr-font);
  font-size: 12.5px;
  font-weight: 500;
  color: #7F1D1D;
  line-height: 1.5;
}
.apr-wv-list li i { color: #DC2626; font-size: 8px; margin-top: 6px; }
.apr-wv-list li b { font-weight: 800; color: #991B1B; }

/* ── Step 4 · Framework stats + category cards ── */
.apr-frame-stats {
  display: flex; gap: 8px; flex-wrap: wrap;
  margin-bottom: 12px;
}
.apr-frame-stats span {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 11px;
  background: var(--bg-muted);
  border-radius: 999px;
  font: 700 11.5px/1 var(--font-body);
  color: var(--text-secondary);
}
.apr-frame-stats i { color: #1E40AF; font-size: 10px; }

.apr-frame { display: flex; flex-direction: column; gap: 8px; }
.apr-cat {
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  overflow: hidden;
  transition: all .15s ease;
}
.apr-cat.open { border-color: #1E40AF; box-shadow: 0 4px 12px rgba(30, 64, 175, .08); }
.apr-cat--blue   { border-left: 4px solid #1E40AF; }
.apr-cat--green  { border-left: 4px solid #15803D; }
.apr-cat--indigo { border-left: 4px solid #4338CA; }
.apr-cat--orange { border-left: 4px solid #C2410C; }
.apr-cat--red    { border-left: 4px solid #DC2626; }
.apr-cat-head {
  display: grid;
  grid-template-columns: 40px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 11px 14px;
  background: transparent;
  border: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  transition: background .15s ease;
}
.apr-cat-head:hover { background: var(--bg-muted); }
.apr-cat-ic {
  width: 40px; height: 40px;
  border-radius: 10px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 15px;
  flex-shrink: 0;
}
/* Tone-specific icon backgrounds apply both inside the Setup framework
   (.apr-cat--TONE) and inside the Conduct modal (.apr-cond-cat--TONE)
   — otherwise the Conduct category icons render unstyled. */
.apr-cat--blue   .apr-cat-ic,
.apr-cond-cat--blue   .apr-cat-ic { background: rgba(30, 64, 175, .12);  color: #1E40AF; }
.apr-cat--green  .apr-cat-ic,
.apr-cond-cat--green  .apr-cat-ic { background: rgba(21, 128, 61, .12);  color: #15803D; }
.apr-cat--indigo .apr-cat-ic,
.apr-cond-cat--indigo .apr-cat-ic { background: rgba(67, 56, 202, .12);  color: #4338CA; }
.apr-cat--orange .apr-cat-ic,
.apr-cond-cat--orange .apr-cat-ic { background: rgba(194, 65, 12, .12);  color: #C2410C; }
.apr-cat--red    .apr-cat-ic,
.apr-cond-cat--red    .apr-cat-ic { background: rgba(220, 38, 38, .12);  color: #B91C1C; }
.apr-cat-body { min-width: 0; }
.apr-cat-h    { font: 800 13.5px/1.2 var(--font-body); color: var(--text-primary); }
.apr-cat-desc { font: 500 12px/1.5 var(--font-body); color: var(--text-secondary); margin-top: 2px; }
.apr-cat-stats { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
.apr-cat-stat {
  background: var(--bg-muted);
  padding: 4px 9px;
  border-radius: 999px;
  font: 700 11px/1 var(--font-body);
  color: var(--text-secondary);
  white-space: nowrap;
}
.apr-cat-stat b { color: var(--text-primary); }
.apr-cat-chev { color: var(--text-muted); margin-left: 4px; font-size: 12px; }

/* Criterion list inside a category */
.apr-criteria {
  background: var(--bg-muted);
  border-top: 1.5px solid var(--border-light);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.apr-crit {
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 10px;
  padding: 12px 14px;
  transition: opacity .15s ease;
}
.apr-crit.off { opacity: .55; }
.apr-crit-head {
  display: grid;
  grid-template-columns: 34px 1fr 130px;
  gap: 12px;
  align-items: center;
}
.apr-crit-text { min-width: 0; }
.apr-crit-h {
  display: flex; align-items: center; gap: 8px;
  font: 800 12.5px/1.2 var(--font-body);
  color: var(--text-primary);
  flex-wrap: wrap;
}
.apr-crit-tag {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  font: 800 9.5px/1 var(--font-body);
  letter-spacing: .03em;
  text-transform: uppercase;
}
.apr-crit-tag--auto   { background: rgba(21, 128, 61, .12);  color: #15803D; }
.apr-crit-tag--manual { background: rgba(30, 64, 175, .12);  color: #1E40AF; }
.apr-crit-tag i { font-size: 8px; }
.apr-crit-desc { font: 500 12px/1.5 var(--font-body); color: var(--text-secondary); margin-top: 3px; }
.apr-crit-weight {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-end;
}
.apr-crit-weight > label {
  font-family: var(--apr-font);
  font-size: 10px;
  font-weight: 800;
  color: #64748B;
  text-transform: uppercase;
  letter-spacing: .5px;
  line-height: 1;
}

.apr-crit-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--border-light);
}
.apr-crit-info {
  background: var(--bg-muted);
  border-radius: 8px;
  padding: 9px 11px;
}
.apr-crit-info-h {
  display: flex; align-items: center; gap: 6px;
  font: 700 10.5px/1 var(--font-body);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: .04em;
  margin-bottom: 6px;
}
.apr-crit-info-h i { color: #1E40AF; font-size: 10px; }
.apr-crit-info-b { font: 500 12px/1.5 var(--font-body); color: var(--text-secondary); }
.apr-crit-guide { display: flex; flex-direction: column; gap: 3px; }
.apr-crit-guide > div { font: 500 11.5px/1.4 var(--font-body); color: var(--text-secondary); }
.apr-crit-guide-tag {
  font: 800 9.5px/1 var(--font-body);
  padding: 3px 7px;
  border-radius: 999px;
  margin-right: 6px;
  letter-spacing: .02em;
  text-transform: uppercase;
}
.apr-crit-guide-tag.tone-green  { background: rgba(21, 128, 61, .12);  color: #15803D; }
.apr-crit-guide-tag.tone-blue   { background: rgba(30, 64, 175, .12);  color: #1E40AF; }
.apr-crit-guide-tag.tone-orange { background: rgba(194, 65, 12, .12);  color: #C2410C; }
.apr-crit-guide-tag.tone-red    { background: rgba(220, 38, 38, .12);  color: #B91C1C; }

/* Auto / Manual radio choice */
.apr-crit-mode {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 12px;
}
.apr-rad {
  display: grid; grid-template-columns: 20px 1fr;
  gap: 10px;
  align-items: flex-start;
  padding: 9px 12px;
  border: 1.5px solid var(--border-light);
  border-radius: 10px;
  background: var(--bg-card);
  cursor: pointer;
  transition: all .15s ease;
}
.apr-rad input[type="radio"] { display: none; }
.apr-rad-dot {
  width: 18px; height: 18px;
  border-radius: 50%;
  border: 2px solid #CBD5E1;
  display: inline-block;
  position: relative;
  margin-top: 1px;
  transition: border-color .15s ease;
}
.apr-rad.on .apr-rad-dot { border-color: #1E40AF; }
.apr-rad.on .apr-rad-dot::after {
  content: ''; width: 8px; height: 8px; border-radius: 50%;
  background: #1E40AF;
  position: absolute; top: 3px; left: 3px;
}
.apr-rad.on { border-color: #1E40AF; background: rgba(30, 64, 175, .04); }
.apr-rad.disabled { opacity: .55; cursor: not-allowed; }
.apr-rad-h {
  display: inline-flex; align-items: center; gap: 6px;
  font: 800 12px/1.2 var(--font-body);
  color: var(--text-primary);
}
.apr-rad-h i { color: #1E40AF; font-size: 10px; }
.apr-rad-sub { display: block; font: 500 11px/1.4 var(--font-body); color: var(--text-secondary); margin-top: 3px; }
.apr-rad-sub b { color: #1E40AF; }

/* ── Step 5 · Parent-feedback toggle row ── */
.apr-toggle-row {
  display: flex; align-items: center; gap: 14px;
  padding: 12px 14px;
  background: var(--bg-muted);
  border: 1.5px solid var(--border-light);
  border-radius: 10px;
}
.apr-toggle {
  width: 42px; height: 24px;
  border-radius: 999px;
  border: none;
  background: #CBD5E1;
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
  transition: background .18s ease;
}
.apr-toggle.on { background: #1E40AF; }
.apr-toggle-thumb {
  position: absolute;
  top: 2px; left: 2px;
  width: 20px; height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 4px rgba(15, 23, 42, .2);
  transition: transform .18s ease;
}
.apr-toggle.on .apr-toggle-thumb { transform: translateX(18px); }
.apr-toggle--sm { width: 34px; height: 20px; }
.apr-toggle--sm .apr-toggle-thumb { width: 16px; height: 16px; }
.apr-toggle--sm.on .apr-toggle-thumb { transform: translateX(14px); }
.apr-toggle-title { font: 800 13px/1.2 var(--font-body); color: var(--text-primary); }
.apr-toggle-sub   { font: 500 12px/1.5 var(--font-body); color: var(--text-secondary); margin-top: 2px; }

/* ── Sticky save bar ── */
.apr-stickybar {
  position: sticky;
  bottom: 12px;
  display: flex; justify-content: space-between; align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, .08);
  margin-top: 6px;
  z-index: 20;
  backdrop-filter: saturate(140%) blur(8px);
}
.apr-stickybar.dirty {
  border-color: rgba(30, 64, 175, .35);
  background: linear-gradient(180deg, rgba(30, 64, 175, .05) 0%, var(--bg-card) 100%);
  box-shadow: 0 10px 28px rgba(30, 64, 175, .14);
}
.apr-stickybar-msg {
  display: inline-flex; align-items: center; gap: 8px;
  font: 700 12.5px/1 var(--font-body);
  color: var(--text-secondary);
}
.apr-stickybar-msg i {
  width: 18px; height: 18px;
  border-radius: 50%;
  background: rgba(21, 128, 61, .14);
  color: #15803D;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 10px;
}
.apr-stickybar.dirty .apr-stickybar-msg { color: var(--brand-primary, #1E40AF); }
.apr-stickybar.dirty .apr-stickybar-msg i {
  background: rgba(30, 64, 175, .14);
  color: #1E40AF;
}
.apr-stickybar-actions { display: flex; gap: 8px; align-items: center; }

/* ── Branded buttons (Save Setup + Revert) ──
   Self-contained — no dependency on HR's emp-btn classes.
   Primary = indigo gradient (module brand); ghost = neutral. */
.apr-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 16px;
  border: 1.5px solid transparent;
  border-radius: 10px;
  font: 800 13px/1 var(--font-body);
  letter-spacing: -.01em;
  cursor: pointer;
  transition: all .18s ease;
  font-family: inherit;
}
.apr-btn i { font-size: 12px; }
.apr-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(30, 64, 175, .28); }
.apr-btn-primary {
  background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 50%, #2563EB 100%);
  color: #fff;
  box-shadow: 0 6px 16px rgba(30, 58, 138, .32), inset 0 1px 0 rgba(255, 255, 255, .18);
}
.apr-btn-primary:hover:not(.is-disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 22px rgba(30, 58, 138, .42), inset 0 1px 0 rgba(255, 255, 255, .2);
}
.apr-btn-primary:active:not(.is-disabled) {
  transform: translateY(0);
  box-shadow: 0 4px 12px rgba(30, 58, 138, .32), inset 0 1px 0 rgba(255, 255, 255, .18);
}
.apr-btn-primary.is-disabled,
.apr-btn-primary:disabled {
  background: var(--bg-muted);
  color: var(--text-muted);
  box-shadow: none;
  cursor: not-allowed;
  border-color: var(--border-light);
}
.apr-btn-ghost {
  background: var(--bg-card);
  color: var(--text-primary);
  border-color: var(--border-light);
}
.apr-btn-ghost:hover {
  background: var(--bg-muted);
  color: var(--brand-primary, #1E40AF);
  border-color: rgba(30, 64, 175, .35);
}

/* ═══════════════════════════════════════════════════════════════════
   APPRAISALS TAB — fully self-contained (no HR_CSS dependency)
   Uses Plus Jakarta Sans, ERP blue brand, 38-px inputs, 64-px rows.
   ═══════════════════════════════════════════════════════════════════ */
:root {
  --apr-font: 'Plus Jakarta Sans', var(--font-body, system-ui), -apple-system, Segoe UI, sans-serif;
}

/* ─── Intro banner ─── */
.apr-intro {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 12px;
  align-items: center;
  padding: 14px 16px;
  background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%);
  border: 1px solid #BFDBFE;
  border-radius: 14px;
  margin-bottom: 14px;
}
.apr-intro-ic {
  width: 40px; height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 50%, #2563EB 100%);
  color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 15px;
  box-shadow: 0 4px 10px rgba(30, 58, 138, .28);
}
.apr-intro-title {
  font-family: var(--apr-font);
  font-size: 14px;
  font-weight: 800;
  color: #0F172A;
  letter-spacing: -.01em;
  line-height: 1.3;
  margin-bottom: 3px;
}
.apr-intro-body {
  font-family: var(--apr-font);
  font-size: 13px;
  font-weight: 500;
  color: #475569;
  line-height: 1.5;
}
.apr-intro-body b { color: #0F172A; font-weight: 700; }

/* ─── 4-column stats grid ─── */
.apr-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}
.apr-stat {
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 14px;
  padding: 14px 16px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
  transition: all .2s ease;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.apr-stat:hover {
  border-color: #CBD5E1;
  box-shadow: 0 6px 16px rgba(15, 23, 42, .06);
  transform: translateY(-1px);
}
.apr-stat-ic {
  width: 34px; height: 34px;
  border-radius: 10px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 14px;
  margin-bottom: 6px;
  flex-shrink: 0;
}
.apr-stat--blue   .apr-stat-ic { background: rgba(30, 64, 175, .12);  color: #1E40AF; }
.apr-stat--green  .apr-stat-ic { background: rgba(21, 128, 61, .12);  color: #15803D; }
.apr-stat--orange .apr-stat-ic { background: rgba(194, 65, 12, .12);  color: #C2410C; }
.apr-stat--indigo .apr-stat-ic { background: rgba(67, 56, 202, .12);  color: #4338CA; }
.apr-stat-lbl {
  font-family: var(--apr-font);
  font-size: 11px;
  font-weight: 700;
  color: #94A3B8;
  text-transform: uppercase;
  letter-spacing: .06em;
  line-height: 1;
}
.apr-stat-val {
  font-family: var(--apr-font);
  font-size: 28px;
  font-weight: 800;
  color: #0F172A;
  letter-spacing: -.02em;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  margin: 2px 0;
}
.apr-stat-sub {
  font-family: var(--apr-font);
  font-size: 11.5px;
  font-weight: 500;
  color: #64748B;
  line-height: 1.3;
}

/* ─── Filter row ─── */
.apr-filters {
  display: grid;
  grid-template-columns: 1fr 180px 180px auto;
  gap: 10px;
  align-items: center;
  margin-bottom: 14px;
}
.apr-search {
  position: relative;
  display: flex;
  align-items: center;
}
.apr-search-ic {
  position: absolute;
  left: 13px;
  color: #94A3B8;
  font-size: 12px;
  pointer-events: none;
}
.apr-search-input {
  width: 100%;
  height: 38px;
  padding: 0 36px 0 36px;
  border: 1.5px solid #E2E8F0;
  border-radius: 10px;
  background: #fff;
  color: #0F172A;
  font-family: var(--apr-font);
  font-size: 13px;
  font-weight: 500;
  transition: all .15s ease;
}
.apr-search-input::placeholder { color: #94A3B8; font-weight: 500; }
.apr-search-input:focus {
  outline: none;
  border-color: #1E40AF;
  box-shadow: 0 0 0 3px rgba(30, 64, 175, .14);
}
.apr-search-clear {
  position: absolute;
  right: 7px;
  width: 24px; height: 24px;
  border: none;
  background: #F1F5F9;
  border-radius: 6px;
  color: #64748B;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 10px;
  transition: all .15s ease;
}
.apr-search-clear:hover { background: #E2E8F0; color: #0F172A; }
.apr-select {
  height: 38px;
  padding: 0 30px 0 12px;
  border: 1.5px solid #E2E8F0;
  border-radius: 10px;
  background-color: #fff;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%2364748B' d='M5 6L0 0h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  color: #0F172A;
  font-family: var(--apr-font);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  transition: all .15s ease;
}
.apr-select:focus {
  outline: none;
  border-color: #1E40AF;
  box-shadow: 0 0 0 3px rgba(30, 64, 175, .14);
}
.apr-select:hover { border-color: #CBD5E1; }
.apr-add-btn {
  height: 38px;
  padding: 0 18px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 50%, #2563EB 100%);
  color: #fff;
  font-family: var(--apr-font);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex; align-items: center; gap: 7px;
  box-shadow: 0 4px 12px rgba(30, 58, 138, .28), inset 0 1px 0 rgba(255, 255, 255, .14);
  transition: all .18s ease;
  white-space: nowrap;
  letter-spacing: -.01em;
}
.apr-add-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(30, 58, 138, .38), inset 0 1px 0 rgba(255, 255, 255, .18);
}
.apr-add-btn:active { transform: translateY(0); }
.apr-add-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(30, 64, 175, .35); }
.apr-add-btn i { font-size: 11px; }

/* ─── Table ─── */
.apr-table {
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
}
.apr-table-head {
  display: grid;
  grid-template-columns: 1.7fr 1.2fr 110px 100px 80px 120px 1.2fr 90px;
  gap: 12px;
  padding: 13px 18px;
  background: #F8FAFC;
  border-bottom: 1px solid #E2E8F0;
  font-family: var(--apr-font);
  font-size: 10.5px;
  font-weight: 700;
  color: #64748B;
  text-transform: uppercase;
  letter-spacing: .06em;
  line-height: 1;
}
.apr-table-head .th.c { text-align: center; }

.apr-table-row {
  display: grid;
  grid-template-columns: 1.7fr 1.2fr 110px 100px 80px 120px 1.2fr 90px;
  gap: 12px;
  align-items: center;
  padding: 11px 18px;
  border-bottom: 1px solid #F1F5F9;
  min-height: 64px;
  transition: background .15s ease;
}
.apr-table-row:last-child { border-bottom: none; }
.apr-table-row:hover { background: #FAFBFF; }
.apr-table-row .td.c { text-align: center; display: flex; align-items: center; justify-content: center; }

/* Employee cell */
.apr-emp { display: flex; align-items: center; gap: 11px; min-width: 0; }
.apr-avatar {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1E40AF 0%, #2563EB 100%);
  color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  font-family: var(--apr-font);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .02em;
  flex-shrink: 0;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(30, 64, 175, .2);
}
.apr-avatar img { width: 100%; height: 100%; object-fit: cover; }
.apr-emp-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.apr-name {
  font-family: var(--apr-font);
  font-size: 13px;
  font-weight: 700;
  color: #0F172A;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -.01em;
  line-height: 1.2;
}
.apr-eid {
  font-family: var(--apr-font);
  font-size: 11px;
  font-weight: 600;
  color: #64748B;
  letter-spacing: .02em;
  line-height: 1;
}

/* Department cell */
.apr-dept { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.apr-dept-pill {
  display: inline-flex;
  padding: 3px 8px;
  background: rgba(30, 64, 175, .1);
  color: #1E40AF;
  border-radius: 6px;
  font-family: var(--apr-font);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.3;
  align-self: flex-start;
  white-space: nowrap;
}
.apr-desig {
  font-family: var(--apr-font);
  font-size: 11px;
  font-weight: 500;
  color: #94A3B8;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Period cell */
.apr-period {
  display: inline-flex;
  padding: 4px 10px;
  background: rgba(30, 64, 175, .1);
  color: #1E40AF;
  border-radius: 999px;
  font-family: var(--apr-font);
  font-size: 11.5px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: .02em;
  line-height: 1;
}
.apr-cycle {
  font-family: var(--apr-font);
  font-size: 10.5px;
  font-weight: 600;
  color: #94A3B8;
  margin-top: 4px;
  text-transform: capitalize;
  line-height: 1;
}

/* Overall % */
.apr-overall-num {
  font-family: var(--apr-font);
  font-size: 18px;
  font-weight: 800;
  color: #1E40AF;
  font-variant-numeric: tabular-nums;
  letter-spacing: -.02em;
  line-height: 1;
}
.apr-overall-num small {
  font-size: 11px;
  font-weight: 700;
  color: #94A3B8;
  margin-left: 1px;
}

/* Status badge */
.apr-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  font-family: var(--apr-font);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .02em;
  line-height: 1;
  white-space: nowrap;
}
.apr-status i { font-size: 9px; }
.apr-status--done  { background: rgba(21, 128, 61, .12); color: #15803D; }
.apr-status--draft { background: rgba(217, 119, 6, .12); color: #92400E; }

/* Conducted by */
.apr-by { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.apr-by-name {
  font-family: var(--apr-font);
  font-size: 12px;
  font-weight: 700;
  color: #334155;
  display: flex; align-items: center; gap: 6px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.apr-by-name i {
  color: #1E40AF;
  font-size: 10px;
  opacity: .7;
  flex-shrink: 0;
}
.apr-by-date {
  font-family: var(--apr-font);
  font-size: 11px;
  font-weight: 500;
  color: #94A3B8;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

/* Action buttons */
.apr-actions { display: inline-flex; gap: 4px; justify-content: center; }
.apr-act {
  width: 30px; height: 30px;
  border: 1px solid #E2E8F0;
  background: #fff;
  border-radius: 8px;
  color: #64748B;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: all .15s ease;
  font-size: 12px;
}
.apr-act:hover { border-color: #1E40AF; color: #1E40AF; background: rgba(30, 64, 175, .04); }
.apr-act:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(30, 64, 175, .25); }
.apr-act--danger:hover { border-color: #DC2626; color: #DC2626; background: rgba(220, 38, 38, .04); }
.apr-act--danger:focus-visible { box-shadow: 0 0 0 3px rgba(220, 38, 38, .25); }

/* ─── Empty states ─── */
.apr-empty {
  padding: 48px 24px;
  text-align: center;
  background: #fff;
  border: 1.5px dashed #CBD5E1;
  border-radius: 14px;
}
.apr-empty-ic {
  width: 56px; height: 56px;
  margin: 0 auto 14px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(30, 64, 175, .12), rgba(30, 64, 175, .04));
  color: #1E40AF;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 20px;
}
.apr-empty-ic--muted {
  background: linear-gradient(135deg, rgba(100, 116, 139, .12), rgba(100, 116, 139, .04));
  color: #64748B;
}
.apr-empty-title {
  font-family: var(--apr-font);
  font-size: 15px;
  font-weight: 800;
  color: #0F172A;
  letter-spacing: -.01em;
  line-height: 1.3;
}
.apr-empty-sub {
  font-family: var(--apr-font);
  font-size: 12.5px;
  font-weight: 500;
  color: #64748B;
  line-height: 1.5;
  margin: 6px auto 0;
  max-width: 480px;
}
.apr-empty-cta {
  margin-top: 18px;
  height: 40px;
  padding: 0 22px;
  font-size: 13px;
}

/* Grade pills (shared across list + reports) */
.apr-grade-pill {
  display: inline-flex;
  padding: 4px 11px;
  border-radius: 999px;
  font: 800 12px/1 var(--font-body);
  letter-spacing: .02em;
}
.apr-grade-pill--green  { background: rgba(21, 128, 61, .14);  color: #15803D; }
.apr-grade-pill--blue   { background: rgba(30, 64, 175, .14);  color: #1E40AF; }
.apr-grade-pill--indigo { background: rgba(67, 56, 202, .14);  color: #4338CA; }
.apr-grade-pill--orange { background: rgba(194, 65, 12, .14);  color: #C2410C; }
.apr-grade-pill--red    { background: rgba(220, 38, 38, .14);  color: #B91C1C; }

/* ── Conduct modal — top section, hero, categories, criteria ── */
.apr-conduct-top {
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
}
.apr-emp-readout {
  background: var(--bg-muted);
  border: 1.5px solid var(--border-light);
  border-radius: 10px;
  padding: 9px 12px;
}
.apr-emp-readout-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }

.apr-hero {
  display: grid;
  grid-template-columns: 1fr 1.3fr;
  gap: 16px;
  align-items: center;
  padding: 18px 22px;
  background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 50%, #2563EB 100%);
  color: #fff;
  border-radius: 14px;
  margin-bottom: 14px;
  box-shadow: 0 8px 24px rgba(30, 58, 138, .25);
}
.apr-hero-l, .apr-hero-r { min-width: 0; }
.apr-hero-lbl {
  font: 700 10.5px/1 var(--font-body);
  text-transform: uppercase;
  letter-spacing: .08em;
  opacity: .85;
  margin-bottom: 6px;
}
.apr-hero-val {
  font: 800 38px/1 var(--font-body);
  font-variant-numeric: tabular-nums;
  letter-spacing: -.02em;
}
.apr-hero-sub { font: 500 12px/1.4 var(--font-body); opacity: .85; margin-top: 5px; }
.apr-hero-r { display: flex; flex-direction: column; gap: 10px; align-items: flex-end; }
.apr-hero-grade { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.apr-hero-grade .apr-grade-pill {
  background: #fff !important;
  color: var(--brand-primary, #1E40AF) !important;
  font-size: 15px;
  padding: 6px 14px;
  font-weight: 800;
}
.apr-hero-meaning { font: 500 11.5px/1.4 var(--font-body); opacity: .85; text-align: right; max-width: 280px; }
.apr-hero-elig { display: flex; flex-wrap: wrap; gap: 5px; justify-content: flex-end; }
.apr-elig-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px;
  background: rgba(255, 255, 255, .14);
  color: #fff;
  border-radius: 999px;
  font: 700 10.5px/1 var(--font-body);
  border: 1px solid rgba(255, 255, 255, .22);
}
.apr-elig-chip.on { background: #fff; color: #15803D; border-color: #fff; }
.apr-elig-chip i { font-size: 9px; }

/* Conduct categories — mirror Setup framework chrome */
.apr-cond-cat {
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  margin-bottom: 10px;
  overflow: hidden;
}
.apr-cond-cat.apr-cond-cat--blue   { border-left: 4px solid #1E40AF; }
.apr-cond-cat.apr-cond-cat--green  { border-left: 4px solid #15803D; }
.apr-cond-cat.apr-cond-cat--indigo { border-left: 4px solid #4338CA; }
.apr-cond-cat.apr-cond-cat--orange { border-left: 4px solid #C2410C; }
.apr-cond-cat.apr-cond-cat--red    { border-left: 4px solid #DC2626; }
.apr-cond-cat-head {
  display: grid;
  grid-template-columns: 40px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  background: var(--bg-muted);
  border: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
}
.apr-cond-cat-head:hover { background: rgba(30, 64, 175, .04); }
.apr-cond-criteria {
  border-top: 1.5px solid var(--border-light);
  padding: 14px;
  display: flex; flex-direction: column; gap: 12px;
}
.apr-cond-crit {
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 10px;
  padding: 12px 14px;
}
.apr-cond-crit.is-auto {
  background: rgba(21, 128, 61, .04);
  border-color: rgba(21, 128, 61, .25);
}
.apr-cond-crit-head {
  display: grid;
  grid-template-columns: 1fr 240px;
  gap: 14px;
  align-items: center;
}
.apr-cond-crit-info { min-width: 0; }
.apr-cond-crit-h {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  font: 800 13px/1.2 var(--font-body);
  color: var(--text-primary);
}
.apr-cond-crit-desc { font: 500 12px/1.5 var(--font-body); color: var(--text-secondary); margin-top: 3px; }
.apr-cond-crit-score {
  display: grid;
  grid-template-columns: 1fr 80px 70px;
  gap: 6px;
  align-items: center;
}
.apr-cond-crit-score label {
  font: 700 10.5px/1 var(--font-body);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: .04em;
  text-align: right;
}
.apr-cond-crit-score .fi { text-align: center; font-weight: 800; font-size: 14px; }
.apr-cond-guide {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin: 10px 0 8px;
  padding: 8px 10px;
  background: var(--bg-muted);
  border: 1px dashed var(--border-light);
  border-radius: 8px;
  font: 500 11px/1.4 var(--font-body);
  color: var(--text-secondary);
}

/* Parent feedback */
.apr-pf-card {
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  padding: 14px 16px;
}
.apr-pf-head {
  display: flex; align-items: center; gap: 10px;
  padding-bottom: 10px;
  margin-bottom: 12px;
  border-bottom: 1.5px solid var(--border-light);
}
.apr-pf-head > i {
  width: 32px; height: 32px;
  background: rgba(30, 64, 175, .12);
  color: #1E40AF;
  border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 13px;
}
.apr-pf-title { font: 800 13px/1.2 var(--font-body); color: var(--text-primary); }
.apr-pf-sub   { font: 500 12px/1.4 var(--font-body); color: var(--text-secondary); margin-top: 2px; }

/* ═══════════════════════════════════════════════════════════════════
   REPORTS TAB — fully self-contained chrome (no rpt-* dependency)
   ═══════════════════════════════════════════════════════════════════ */

/* Grid layout — 3 cols desktop, 2 tablet, 1 mobile */
.apr-reports-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

/* Report card */
.apr-report-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 18px 20px;
  background: #fff;
  border: 1px solid #BFDBFE;
  border-radius: 14px;
  box-shadow: 0 2px 8px rgba(30, 58, 138, .10);
  cursor: pointer;
  text-align: left;
  font-family: var(--apr-font);
  transition: all .22s ease;
  width: 100%;
  min-height: 0;
}
.apr-report-card:hover {
  transform: translateY(-2px);
  border-color: #93C5FD;
  box-shadow: 0 10px 22px rgba(30, 58, 138, .16);
}
.apr-report-card:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(30, 64, 175, .35), 0 2px 8px rgba(30, 58, 138, .10);
}

/* Icon chip */
.apr-report-ic {
  width: 40px; height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 50%, #2563EB 100%);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  box-shadow: 0 4px 10px rgba(30, 58, 138, .28), inset 0 1px 0 rgba(255, 255, 255, .14);
}

/* Title */
.apr-report-title {
  font-family: var(--apr-font);
  font-size: 13.5px;
  font-weight: 800;
  color: #0F172A;
  letter-spacing: -.01em;
  line-height: 1.3;
  margin-top: 10px;
}

/* Description */
.apr-report-desc {
  font-family: var(--apr-font);
  font-size: 12px;
  font-weight: 500;
  color: #64748B;
  line-height: 1.5;
  margin-top: 4px;
}

/* "View Report →" link row */
.apr-report-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  font-family: var(--apr-font);
  font-size: 12px;
  font-weight: 700;
  color: #1E3A8A;
  letter-spacing: -.005em;
  position: relative;
  transition: gap .18s ease;
}
.apr-report-link i {
  font-size: 10px;
  transition: transform .2s ease;
}
.apr-report-link::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: -2px;
  width: 0;
  height: 1.5px;
  background: #1E3A8A;
  transition: width .22s ease;
}
.apr-report-card:hover .apr-report-link {
  gap: 8px;
}
.apr-report-card:hover .apr-report-link::after {
  /* underline only the "View Report" text — width set to label length via ch */
  width: 76px;
}
.apr-report-card:hover .apr-report-link i { transform: translateX(2px); }

/* Training-needs chip (used inside Training report body) */
.apr-train-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  margin: 2px 4px 2px 0;
  background: rgba(217, 119, 6, .12);
  color: #92400E;
  border-radius: 999px;
  font-family: var(--apr-font);
  font-size: 11px;
  font-weight: 700;
}
.apr-train-chip i { font-size: 9px; }

/* ═══════════════════════════════════════════════════════════════════
   APPRAISAL REPORT VIEWER — A4 sheet + toolbar
   ═══════════════════════════════════════════════════════════════════ */

.apr-rv {
  font-family: var(--apr-font);
}

/* Toolbar */
.apr-rv-toolbar {
  display: grid;
  grid-template-columns: 1fr 1.8fr 1fr;
  gap: 14px;
  align-items: center;
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  padding: 10px 14px;
  margin-bottom: 14px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
}
.apr-rv-toolbar-l { justify-self: start; }
.apr-rv-toolbar-c { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; }
.apr-rv-toolbar-r { display: flex; justify-content: flex-end; align-items: center; gap: 8px; flex-wrap: wrap; }

.apr-rv-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1.5px solid #E2E8F0;
  background: #fff;
  color: #475569;
  border-radius: 999px;
  font-family: var(--apr-font);
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all .15s ease;
}
.apr-rv-back:hover { border-color: #1E40AF; color: #1E40AF; background: #EFF6FF; }
.apr-rv-back i { font-size: 10px; }

.apr-rv-title-line { display: flex; align-items: center; gap: 8px; }
.apr-rv-title {
  font-family: var(--apr-font);
  font-size: 13.5px;
  font-weight: 800;
  color: #0F172A;
  letter-spacing: -.01em;
  text-align: center;
}
.apr-rv-selectors { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
.apr-rv-select {
  height: 32px;
  padding: 0 28px 0 12px;
  border: 1.5px solid #E2E8F0;
  border-radius: 8px;
  background-color: #fff;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%2364748B' d='M5 6L0 0h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  font-family: var(--apr-font);
  font-size: 12px;
  font-weight: 600;
  color: #0F172A;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  min-width: 130px;
}
.apr-rv-select:focus { outline: none; border-color: #1E40AF; box-shadow: 0 0 0 3px rgba(30, 64, 175, .14); }

.apr-rv-bw {
  display: inline-flex;
  background: #F1F5F9;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  padding: 3px;
}
.apr-rv-bw-btn {
  height: 26px;
  padding: 0 12px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-family: var(--apr-font);
  font-size: 11.5px;
  font-weight: 700;
  color: #64748B;
  cursor: pointer;
  transition: all .15s ease;
}
.apr-rv-bw-btn.on { background: #fff; color: #1E40AF; box-shadow: 0 1px 3px rgba(15, 23, 42, .08); }

.apr-rv-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
  border: none;
  border-radius: 8px;
  font-family: var(--apr-font);
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  transition: all .15s ease;
}
.apr-rv-action i { font-size: 11px; }
.apr-rv-action--print { background: linear-gradient(135deg, #1E3A8A, #2563EB); box-shadow: 0 3px 8px rgba(30, 58, 138, .25); }
.apr-rv-action--print:hover { transform: translateY(-1px); box-shadow: 0 6px 14px rgba(30, 58, 138, .35); }
.apr-rv-action--excel { background: linear-gradient(135deg, #15803D, #16A34A); box-shadow: 0 3px 8px rgba(21, 128, 61, .25); }
.apr-rv-action--excel:hover { transform: translateY(-1px); box-shadow: 0 6px 14px rgba(21, 128, 61, .35); }

/* A4 Sheet */
.apr-rv-sheet-wrap {
  display: flex;
  justify-content: center;
  padding: 8px 0 24px;
}
.apr-rv-sheet {
  width: 794px;
  max-width: 100%;
  min-height: 1123px;
  background: #fff;
  padding: 48px 52px;
  color: #0F172A;
  font-family: var(--apr-font);
  font-size: 12px;
  box-shadow: 0 10px 40px rgba(30, 58, 138, .18);
  border-radius: 4px;
  line-height: 1.5;
}

/* Header */
.apr-rv-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 3px solid #1E3A8A;
  padding-bottom: 16px;
  margin-bottom: 20px;
}
.apr-rv-head-l { display: flex; align-items: center; gap: 14px; }
.apr-rv-logo {
  width: 54px;
  height: 54px;
  border-radius: 12px;
  background: linear-gradient(135deg, #1a237e, #283593);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
}
.apr-rv-school {
  font-family: var(--apr-font);
  font-size: 20px;
  font-weight: 800;
  color: #1E3A8A;
  letter-spacing: -.01em;
  line-height: 1.2;
}
.apr-rv-campus {
  font-family: var(--apr-font);
  font-size: 11px;
  font-weight: 500;
  color: #64748B;
  margin-top: 3px;
}
.apr-rv-head-r { text-align: right; }
.apr-rv-rtitle {
  font-family: var(--apr-font);
  font-size: 15px;
  font-weight: 800;
  color: #0F172A;
  letter-spacing: -.01em;
}
.apr-rv-rgen {
  font-family: var(--apr-font);
  font-size: 10px;
  font-weight: 500;
  color: #64748B;
  margin-top: 4px;
}

/* Meta info bar */
.apr-rv-meta {
  background: #F0F4FF;
  border: 1px solid #BFDBFE;
  border-radius: 10px;
  padding: 14px 18px;
  margin-bottom: 20px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px 20px;
}
.apr-rv-meta-item { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.apr-rv-meta-lbl {
  font-family: var(--apr-font);
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: #64748B;
  line-height: 1;
}
.apr-rv-meta-val {
  font-family: var(--apr-font);
  font-size: 12.5px;
  font-weight: 700;
  color: #0F172A;
  letter-spacing: -.005em;
  line-height: 1.3;
  word-break: break-word;
}

/* Score band */
.apr-rv-band {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 22px;
  align-items: center;
  background: linear-gradient(135deg, #1E3A8A, #2563EB);
  color: #fff;
  border-radius: 14px;
  padding: 20px 28px;
  margin-bottom: 20px;
}
.apr-rv-band-lbl {
  font-family: var(--apr-font);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  opacity: .85;
}
.apr-rv-band-val {
  font-family: var(--apr-font);
  font-size: 42px;
  font-weight: 800;
  letter-spacing: -.025em;
  line-height: 1;
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
}
.apr-rv-band-meaning {
  font-family: var(--apr-font);
  font-size: 11.5px;
  font-weight: 500;
  opacity: .85;
  margin-top: 6px;
  line-height: 1.4;
}
.apr-rv-grade {
  background: #fff;
  border-radius: 12px;
  padding: 12px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  color: #1E40AF;
  min-width: 90px;
}
.apr-rv-grade-letter {
  font-family: var(--apr-font);
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -.02em;
  line-height: 1;
}
.apr-rv-grade.apr-grade-big--green  { color: #15803D; }
.apr-rv-grade.apr-grade-big--blue   { color: #1E40AF; }
.apr-rv-grade.apr-grade-big--indigo { color: #4338CA; }
.apr-rv-grade.apr-grade-big--orange { color: #D97706; }
.apr-rv-grade.apr-grade-big--red    { color: #DC2626; }
.apr-rv-grade-lbl {
  font-family: var(--apr-font);
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: #94A3B8;
  margin-top: 2px;
}

/* Data table */
.apr-rv-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
  font-family: var(--apr-font);
}
.apr-rv-table thead th {
  background: #1E3A8A;
  color: #fff;
  font-family: var(--apr-font);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .04em;
  padding: 10px 14px;
  line-height: 1.2;
}
.apr-rv-table tbody td {
  padding: 9px 14px;
  border-bottom: 1px solid #E2E8F0;
  font-family: var(--apr-font);
  font-size: 11.5px;
  color: #1E3A5F;
  font-weight: 500;
  vertical-align: top;
}
.apr-rv-table tbody td em { font-style: italic; color: #64748B; }
.apr-rv-table tbody tr:nth-child(even) td { background: #F8FAFF; }
.apr-rv-table tbody tr:hover td { background: #EFF6FF; }
.apr-rv-tot td {
  background: #EFF6FF !important;
  border-top: 2px solid #1E3A8A !important;
  font-weight: 800 !important;
  color: #0F172A !important;
}
.apr-rv-noscore {
  text-align: center !important;
  color: #94A3B8 !important;
  font-style: italic;
}

/* Small chips used in cells */
.apr-rv-chip-sm {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 999px;
  font-family: var(--apr-font);
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: .04em;
}
.apr-rv-chip-sm--auto        { background: rgba(21, 128, 61, .12);  color: #15803D; }
.apr-rv-chip-sm--manual      { background: rgba(30, 64, 175, .12);  color: #1E40AF; }
.apr-rv-chip-sm--eligible    { background: rgba(21, 128, 61, .14);  color: #15803D; }
.apr-rv-chip-sm--noteligible { background: rgba(100, 116, 139, .14); color: #475569; }

/* Section title shared by Remarks + Overall Remarks */
.apr-rv-section-h {
  font-family: var(--apr-font);
  font-size: 13px;
  font-weight: 800;
  color: #1E3A8A;
  border-left: 4px solid #1E3A8A;
  padding-left: 10px;
  text-transform: uppercase;
  letter-spacing: .05em;
  margin-bottom: 12px;
  line-height: 1.2;
}

/* Parameter-wise remarks */
.apr-rv-remarks { margin-bottom: 18px; }
.apr-rv-remark {
  background: #F8FAFF;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 8px;
  font-family: var(--apr-font);
  font-size: 11.5px;
  line-height: 1.5;
}
.apr-rv-remark-h { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.apr-rv-remark-h b { font-weight: 800; color: #0F172A; }
.apr-rv-remark-score {
  font-family: var(--apr-font);
  font-size: 11px;
  font-weight: 700;
  color: #1E40AF;
  font-variant-numeric: tabular-nums;
}
.apr-rv-remark-body {
  margin-top: 5px;
  color: #475569;
  font-style: italic;
  line-height: 1.55;
}

/* Overall Remarks box */
.apr-rv-overall-remarks { margin-bottom: 18px; }
.apr-rv-overall-remarks-box {
  background: #F0F4FF;
  border: 1px solid #BFDBFE;
  border-radius: 10px;
  padding: 16px 18px;
  font-family: var(--apr-font);
  font-size: 12.5px;
  font-style: italic;
  color: #1E3A5F;
  line-height: 1.7;
  white-space: pre-wrap;
}

/* Reward summary chips */
.apr-rv-reward {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}
.apr-rv-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 999px;
  font-family: var(--apr-font);
  font-size: 12px;
  font-weight: 800;
}
.apr-rv-chip i { font-size: 11px; }
.apr-rv-chip--green { background: #DCFCE7; color: #15803D; border: 1px solid #A7F3D0; }
.apr-rv-chip--blue  { background: #DBEAFE; color: #1E40AF; border: 1px solid #BFDBFE; }

/* Signatures */
.apr-rv-signatures {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 28px;
  margin-top: 50px;
  margin-bottom: 18px;
}
.apr-rv-sig { text-align: left; }
.apr-rv-sig-line {
  border-top: 1.5px solid #0F172A;
  padding-top: 6px;
  margin-bottom: 4px;
}
.apr-rv-sig-name {
  font-family: var(--apr-font);
  font-size: 11px;
  font-weight: 800;
  color: #0F172A;
  letter-spacing: -.005em;
}
.apr-rv-sig-role {
  font-family: var(--apr-font);
  font-size: 9.5px;
  font-weight: 500;
  color: #94A3B8;
  margin-top: 2px;
}

/* Footer */
.apr-rv-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #E2E8F0;
  margin-top: 30px;
  padding-top: 12px;
  font-family: var(--apr-font);
  font-size: 9.5px;
  font-weight: 500;
  color: #94A3B8;
  letter-spacing: -.005em;
}

.apr-rv-empty {
  padding: 40px 24px;
  text-align: center;
  color: #94A3B8;
  font-style: italic;
}

/* B&W mode — applies grayscale to the sheet (and survives print) */
.apr-rv--bw .apr-rv-sheet { filter: grayscale(1); }

/* Responsive */
@media (max-width: 1180px) {
  .apr-rv-toolbar { grid-template-columns: 1fr; gap: 10px; }
  .apr-rv-toolbar-l, .apr-rv-toolbar-r { justify-self: stretch; justify-content: center; }
  .apr-rv-toolbar-c { align-items: center; }
}
@media (max-width: 820px) {
  .apr-rv-sheet { padding: 32px 28px; }
  .apr-rv-meta { grid-template-columns: repeat(2, 1fr); }
  .apr-rv-band { grid-template-columns: 1fr; text-align: left; }
  .apr-rv-band-val { font-size: 36px; }
  .apr-rv-signatures { grid-template-columns: 1fr; gap: 22px; }
  .apr-rv-table thead th, .apr-rv-table tbody td { padding: 7px 9px; font-size: 10.5px; }
  .apr-rv-band-r { justify-self: start; }
}

/* Responsive */
@media (max-width: 1180px) {
  .apr-stats { grid-template-columns: repeat(4, 1fr); }
  .apr-stat-val { font-size: 26px; }
  .apr-filters { grid-template-columns: 1fr 170px 170px auto; }
  .apr-table-head, .apr-table-row {
    grid-template-columns: 1.7fr 1.1fr 100px 95px 80px 110px 90px;
  }
  .apr-table-head .th:nth-child(7),
  .apr-table-row  .td:nth-child(7) { display: none; }
}
@media (max-width: 1024px) {
  .apr-cycle-grid, .apr-elig-grid { grid-template-columns: 1fr; }
  .apr-stats { grid-template-columns: repeat(2, 1fr); }
  .apr-filters {
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .apr-search { grid-column: span 2; }
  .apr-add-btn { grid-column: span 2; justify-self: stretch; justify-content: center; }
  .apr-table-head, .apr-table-row {
    grid-template-columns: 1.7fr 1.1fr 100px 90px 110px 90px;
  }
  .apr-table-head .th:nth-child(4),
  .apr-table-row  .td:nth-child(4) { display: none; }
  .apr-cond-crit-head { grid-template-columns: 1fr; }
  .apr-cond-crit-score { grid-template-columns: 70px 90px 70px; justify-content: flex-end; }
  .apr-cond-guide { grid-template-columns: repeat(2, 1fr); }
  .apr-crit-mode { grid-template-columns: 1fr; }
  .apr-crit-grid { grid-template-columns: 1fr; }
  .apr-hero { grid-template-columns: 1fr; }
  .apr-hero-r { align-items: flex-start; }
  .apr-hero-meaning { text-align: left; max-width: none; }
  .apr-hero-elig { justify-content: flex-start; }
  .apr-reports-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }
}
@media (max-width: 720px) {
  .apr-subtab { min-width: 100%; flex-basis: 100%; }
  .apr-stats { grid-template-columns: 1fr; }
  .apr-stat-val { font-size: 24px; }
  .apr-table-head, .apr-table-row {
    grid-template-columns: 1.4fr 80px 110px 80px;
  }
  .apr-table-head .th:nth-child(2),
  .apr-table-head .th:nth-child(3),
  .apr-table-row  .td:nth-child(2),
  .apr-table-row  .td:nth-child(3) { display: none; }
  .apr-table-row { padding: 10px 14px; min-height: 60px; }
  .apr-grade-head, .apr-grade-row { grid-template-columns: 56px 76px 76px 1fr; gap: 10px; }
  .apr-grade-input { width: 72px; }
  .apr-grade-meaning { font-size: 11.5px; }
  .apr-cond-guide { grid-template-columns: 1fr; }
  .apr-cat-stats { font-size: 10.5px; }
  .apr-crit-head { grid-template-columns: 34px 1fr; }
  .apr-crit-weight { grid-column: 2; align-items: flex-start; flex-direction: row; gap: 8px; }
  .apr-setup-head { grid-template-columns: 28px 1fr; padding: 12px 14px; }
  .apr-setup-body { padding: 14px; }
  .apr-intro { grid-template-columns: 36px 1fr; padding: 12px 14px; }
  .apr-intro-ic { width: 36px; height: 36px; font-size: 13px; }
  .apr-reports-grid { grid-template-columns: 1fr; gap: 12px; }
  .apr-report-card { padding: 16px 18px; }
  .apr-modal { border-radius: 16px; }
  .apr-modal-head { padding: 14px 16px; }
  .apr-modal-body { padding: 14px; }
  .apr-modal-foot { padding: 12px 14px; }
  .apr-detail-grid { grid-template-columns: 1fr; }
  .apr-field-group.span2 { grid-column: span 1; }
  .apr-stepper { padding: 10px 14px; }
  .apr-step-label { display: none; }
  .apr-score-row { grid-template-columns: 1fr; gap: 8px; }
  .apr-score-input-wrap { justify-content: flex-start; }
  .apr-score-summary { grid-template-columns: 1fr; gap: 10px; text-align: left; }
  .apr-view-hero { grid-template-columns: 48px 1fr; gap: 12px; }
  .apr-view-grade-big { grid-column: span 2; justify-self: stretch; width: 100%; height: 56px; }
  .apr-view-table-head, .apr-view-table-row { grid-template-columns: 1fr 70px 60px 80px; gap: 8px; padding: 9px 12px; font-size: 11.5px; }
  .apr-view-table--with-remarks .apr-view-table-head,
  .apr-view-table--with-remarks .apr-view-table-row {
    grid-template-columns: 1fr 70px 60px 80px;
  }
  .apr-view-table--with-remarks .apr-view-table-head > div:nth-child(5),
  .apr-view-table--with-remarks .apr-view-table-row .apr-view-row-remarks { display: none; }
  .apr-auto-info-card { width: calc(100vw - 32px) !important; left: 16px !important; }
  .apr-view-reward-grid { grid-template-columns: 1fr; }
  .apr-bonus-amount { flex-direction: column; align-items: flex-start; }
}

/* ═══════════════════════════════════════════════════════════════════
   MOBILE — Staff Appraisals Setup screens (≤ 600px)
   Fixes:
     · Grade range table  → row card; "What this means" wraps cleanly
     · Cycle cards        → padding tightens (already 1-col from 1024px)
     · Eligibility cards  → padding tightens, control wraps
     · Category cards     → head reflows; text wraps on word boundaries;
                            weight pill on its own line, right-aligned
   No JSX, no logic, no layout for desktop/tablet (≥601px) touched.
   ═══════════════════════════════════════════════════════════════════ */
@media (max-width: 600px) {
  /* ── Setup intro banner — stack vertically ── */
  .apr-setup-intro {
    grid-template-columns: 1fr !important;
    padding: 14px !important;
    gap: 12px !important;
  }
  .apr-setup-intro-ic { width: 36px; height: 36px; font-size: 14px; }
  .apr-setup-intro-title { font-size: 13.5px; line-height: 1.3; }
  .apr-setup-intro-desc {
    font-size: 11.5px;
    word-break: normal;
    overflow-wrap: break-word;
    hyphens: none;
  }
  .apr-setup-intro-btn { width: 100%; justify-content: center; }

  /* ── Cycle cards (already 1-col from 1024px) — compact padding ── */
  .apr-cycle { padding: 10px 12px; gap: 10px; }
  .apr-cycle-ic { width: 36px; height: 36px; font-size: 14px; }
  .apr-cycle-h { font-size: 12.5px; }
  .apr-cycle-when { font-size: 11px; margin: 3px 0 6px; }
  .apr-cycle-pros { font-size: 10.5px; gap: 2px 10px; }

  /* ── Grade range table → card per row ──
       Hides the column header (4 thin grid cells can't fit), reflows
       each row to: [grade chip] [From input] [To input]   /  [meaning] */
  .apr-grade-head { display: none !important; }

  .apr-grade-row {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    grid-template-columns: none !important;
    column-gap: 8px !important;
    row-gap: 8px !important;
    padding: 10px 12px !important;
    min-height: 0 !important;
  }
  .apr-grade-row > .apr-grade-chip { order: 1; flex: 0 0 auto; }
  .apr-grade-row > .apr-grade-input:nth-of-type(1) {
    order: 2; flex: 1 1 calc(50% - 28px) !important;
    width: auto !important;
    min-width: 0 !important;
    height: 36px;
    font-size: 12.5px;
  }
  .apr-grade-row > .apr-grade-input:nth-of-type(2) {
    order: 3; flex: 1 1 calc(50% - 28px) !important;
    width: auto !important;
    min-width: 0 !important;
    height: 36px;
    font-size: 12.5px;
  }
  .apr-grade-row > .apr-grade-meaning {
    order: 4; flex: 1 1 100%;
    font-size: 11.5px;
    line-height: 1.45;
    word-break: normal !important;
    overflow-wrap: break-word !important;
    hyphens: none !important;
  }

  /* ── Warning banner ── */
  .apr-warning { padding: 10px 12px; gap: 8px; }
  .apr-warning-text { font-size: 11.5px; }

  /* ── Eligibility / Reward cards (already 1-col from 1024px) ── */
  .apr-elig { padding: 12px 14px; gap: 10px; }
  .apr-elig-h { gap: 9px; }
  .apr-elig-ic { width: 34px; height: 34px; font-size: 13px; }
  .apr-elig-title { font-size: 12.5px; }
  .apr-elig-desc {
    font-size: 11px;
    word-break: normal;
    overflow-wrap: break-word;
    hyphens: none;
  }
  .apr-elig-control { flex-wrap: wrap; gap: 6px; }
  .apr-threshold-label { font-size: 10.5px; }
  .apr-elig-suffix { font-size: 10.5px; }

  /* ── Frame-stats strip (5 categories · N criteria · M can be automated) ── */
  .apr-frame-stats { flex-wrap: wrap; gap: 6px 12px; font-size: 11px; }

  /* ── Evaluation category cards — reflow head, fix word-by-word breaks ── */
  .apr-cat-head-wrap {
    flex-direction: column !important;
    align-items: stretch !important;
  }
  .apr-cat-head-wrap > .apr-cat-head {
    grid-template-columns: 34px 1fr auto !important;
    gap: 10px !important;
    padding: 10px 12px !important;
    padding-right: 12px !important;
  }
  .apr-cat-ic { width: 34px !important; height: 34px !important; font-size: 13px !important; }
  .apr-cat-body { min-width: 0; }
  .apr-cat-h {
    font-size: 12.5px;
    word-break: normal !important;
    overflow-wrap: break-word !important;
    hyphens: none !important;
    line-height: 1.3;
  }
  .apr-cat-desc {
    font-size: 11px;
    word-break: normal !important;
    overflow-wrap: break-word !important;
    hyphens: none !important;
    line-height: 1.45;
  }
  .apr-cat-stats { gap: 4px; }
  .apr-cat-stat { padding: 3px 7px; font-size: 10px; }
  .apr-cat-check { width: 16px; height: 16px; font-size: 8px; }

  /* Category weight pill → own row, label inline left of input, pinned right */
  .apr-cat-weight {
    flex-direction: row !important;
    align-items: center !important;
    justify-content: flex-end !important;
    gap: 8px !important;
    padding: 8px 12px !important;
    border-top: 1px dashed var(--border-light) !important;
    background: rgba(30, 64, 175, .02);
  }
  .apr-cat-weight-lbl { font-size: 10px; }
  .apr-cat-weight .apr-weight-pill { height: 28px; padding: 0 8px; }
  .apr-cat-weight .apr-weight-input { font-size: 12px; }

  /* ── Sticky save bar — stack message + actions on mobile ── */
  .apr-stickybar {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    padding: 12px 14px;
  }
  .apr-stickybar-actions { width: 100%; gap: 8px; }
  .apr-stickybar-actions .apr-btn { flex: 1; justify-content: center; padding: 9px 12px; font-size: 12px; }
}

/* ═══════════════════════════════════════════════════════════════════
   APPRAISAL MODALS — backdrop, shell, stepper, staff picker,
   scoring rows, segmented selector, view hero/band/table, delete.
   ═══════════════════════════════════════════════════════════════════ */

/* Backdrop */
.apr-modal-back {
  position: fixed;
  inset: 0;
  background: rgba(8, 13, 26, .55);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  animation: aprFadeIn .14s ease-out;
}
@keyframes aprFadeIn { from { opacity: 0; } to { opacity: 1; } }

/* Modal shell */
.apr-modal {
  width: min(680px, 100%);
  max-width: 96vw;
  max-height: 92vh;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 32px 80px rgba(8, 13, 26, .35);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: aprPop .18s cubic-bezier(.2, .8, .2, 1);
  font-family: var(--apr-font);
}
.apr-modal--scoring { width: min(760px, 100%); }
.apr-modal--view    { width: min(760px, 100%); }
.apr-modal--delete  { width: min(440px, 100%); border-radius: 18px; }
@keyframes aprPop {
  from { transform: translateY(8px) scale(.985); opacity: 0; }
  to   { transform: translateY(0)   scale(1);    opacity: 1; }
}

/* Sticky header */
.apr-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 22px;
  background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 50%, #2563EB 100%);
  color: #fff;
  flex-shrink: 0;
}
.apr-modal-head-title { display: flex; align-items: center; gap: 14px; min-width: 0; }
.apr-modal-icn {
  width: 42px; height: 42px;
  border-radius: 12px;
  background: rgba(255, 255, 255, .15);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .18);
  flex-shrink: 0;
}
.apr-modal-title {
  font-family: var(--apr-font);
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -.01em;
  line-height: 1.2;
}
.apr-modal-sub {
  font-family: var(--apr-font);
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, .8);
  margin-top: 3px;
  line-height: 1.3;
}
.apr-modal-x {
  width: 34px; height: 34px;
  border: none;
  background: rgba(255, 255, 255, .14);
  color: #fff;
  border-radius: 10px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
  transition: background .15s ease;
}
.apr-modal-x:hover { background: rgba(255, 255, 255, .22); }

/* Stepper rail */
.apr-stepper {
  display: flex;
  gap: 6px;
  padding: 12px 22px;
  background: #F8FAFF;
  border-bottom: 1px solid #DBEAFE;
  flex-shrink: 0;
}
.apr-step-pill {
  flex: 1;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  background: #fff;
  border: 1.5px solid #E2E8F0;
  border-radius: 999px;
  font-family: var(--apr-font);
  font-size: 11.5px;
  font-weight: 800;
  color: #64748B;
  letter-spacing: -.005em;
  transition: all .18s ease;
}
.apr-step-pill.active {
  background: linear-gradient(135deg, #1E3A8A, #2563EB);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 4px 10px rgba(30, 58, 138, .28);
}
.apr-step-pill.done {
  background: #DBEAFE;
  color: #1E40AF;
  border-color: #BFDBFE;
}
.apr-step-num {
  width: 20px; height: 20px;
  border-radius: 50%;
  background: #F1F5F9;
  color: #64748B;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 800;
  flex-shrink: 0;
}
.apr-step-pill.active .apr-step-num { background: rgba(255, 255, 255, .22); color: #fff; }
.apr-step-pill.done   .apr-step-num { background: #1E40AF; color: #fff; }
.apr-step-pill.done   .apr-step-num i { font-size: 9px; }

/* Scrollable body */
.apr-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 18px 22px;
  background: #F0F4FF;
}

/* Sticky footer */
.apr-modal-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 22px;
  background: #fff;
  border-top: 1px solid #E2E8F0;
  flex-shrink: 0;
}
.apr-modal-foot--center { justify-content: center; gap: 12px; }
.apr-modal-foot-right { display: flex; gap: 8px; align-items: center; }

/* ── Buttons used inside modals ── */
.apr-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 38px;
  padding: 0 16px;
  border: 1.5px solid transparent;
  border-radius: 10px;
  font-family: var(--apr-font);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -.005em;
  cursor: pointer;
  transition: all .15s ease;
  white-space: nowrap;
}
.apr-btn i { font-size: 11px; }
.apr-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(30, 64, 175, .28); }
.apr-btn-primary {
  background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 50%, #2563EB 100%);
  color: #fff;
  box-shadow: 0 4px 12px rgba(30, 58, 138, .28), inset 0 1px 0 rgba(255, 255, 255, .14);
}
.apr-btn-primary:hover:not(.is-disabled):not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(30, 58, 138, .38);
}
.apr-btn-primary.is-disabled,
.apr-btn-primary:disabled {
  background: #E2E8F0;
  color: #94A3B8;
  cursor: not-allowed;
  box-shadow: none;
}
.apr-btn-ghost {
  background: #fff;
  color: #1E293B;
  border-color: #E2E8F0;
}
.apr-btn-ghost:hover { background: #F1F5F9; border-color: #CBD5E1; color: #1E40AF; }
.apr-btn-danger {
  background: linear-gradient(135deg, #B91C1C, #DC2626);
  color: #fff;
  box-shadow: 0 4px 12px rgba(220, 38, 38, .28);
}
.apr-btn-danger:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(220, 38, 38, .38);
}
.apr-btn-danger:focus-visible { box-shadow: 0 0 0 3px rgba(220, 38, 38, .28); }

/* ── Step 1 · Staff picker ── */
.apr-staff-picker { display: flex; flex-direction: column; gap: 12px; }
.apr-staff-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 360px;
  overflow-y: auto;
  padding-right: 4px;
}
.apr-staff-row {
  display: grid;
  grid-template-columns: 40px 1fr 20px;
  gap: 12px;
  align-items: center;
  padding: 9px 12px;
  background: #fff;
  border: 1.5px solid #E2E8F0;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  font-family: var(--apr-font);
  transition: all .15s ease;
}
.apr-staff-row:hover { border-color: #BFDBFE; transform: translateY(-1px); }
.apr-staff-row.on {
  border-color: #1E40AF;
  background: linear-gradient(135deg, rgba(30, 64, 175, .04), #fff);
  box-shadow: 0 4px 10px rgba(30, 64, 175, .08);
}
.apr-staff-avatar {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1E40AF, #2563EB);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--apr-font);
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(30, 64, 175, .2);
}
.apr-staff-avatar.sm { width: 36px; height: 36px; font-size: 11px; }
.apr-staff-avatar img { width: 100%; height: 100%; object-fit: cover; }
.apr-staff-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.apr-staff-name {
  font-size: 13px;
  font-weight: 800;
  color: #0F172A;
  letter-spacing: -.01em;
  line-height: 1.2;
}
.apr-staff-meta {
  font-size: 11px;
  font-weight: 500;
  color: #64748B;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  line-height: 1.2;
}
.apr-staff-dot { color: #CBD5E1; }
.apr-staff-radio {
  width: 18px; height: 18px;
  border-radius: 50%;
  border: 2px solid #CBD5E1;
  position: relative;
  transition: all .15s ease;
}
.apr-staff-row.on .apr-staff-radio {
  border-color: #1E40AF;
}
.apr-staff-row.on .apr-staff-radio::after {
  content: '';
  position: absolute;
  inset: 2px;
  border-radius: 50%;
  background: #1E40AF;
}
.apr-staff-empty {
  padding: 28px 16px;
  text-align: center;
  color: #94A3B8;
  font-family: var(--apr-font);
  font-size: 12.5px;
  font-weight: 500;
}
.apr-staff-empty i { margin-right: 6px; opacity: .6; }

/* Read-out card used in Step 2 + Edit header */
.apr-staff-readout, .apr-readonly-card {
  display: grid;
  grid-template-columns: 40px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 10px 14px;
  background: #fff;
  border: 1.5px solid #BFDBFE;
  border-radius: 12px;
}
.apr-readonly-card { margin-bottom: 12px; }
.apr-readonly-text { min-width: 0; }
.apr-readonly-name {
  font-family: var(--apr-font);
  font-size: 14px;
  font-weight: 800;
  color: #0F172A;
}
.apr-readonly-meta {
  font-family: var(--apr-font);
  font-size: 11.5px;
  font-weight: 500;
  color: #64748B;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 3px;
}
.apr-readonly-locked {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  background: rgba(100, 116, 139, .12);
  color: #475569;
  border-radius: 999px;
  font-family: var(--apr-font);
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: .04em;
  text-transform: uppercase;
}
.apr-readonly-locked i { font-size: 9px; }

/* ── Step 2 · details form ── */
.apr-detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.apr-field-group { display: flex; flex-direction: column; gap: 6px; }
.apr-field-group.span2 { grid-column: span 2; }
.apr-field-label {
  font-family: var(--apr-font);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: #64748B;
  line-height: 1;
}
.apr-field-optional {
  text-transform: none;
  letter-spacing: 0;
  font-weight: 600;
  color: #94A3B8;
  margin-left: 4px;
}

.apr-input,
select.apr-input {
  height: 38px;
  padding: 0 12px;
  border: 1.5px solid #BFDBFE;
  border-radius: 10px;
  background: #fff;
  font-family: var(--apr-font);
  font-size: 13px;
  font-weight: 600;
  color: #0F172A;
  transition: all .15s ease;
}
select.apr-input {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 32px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%2364748B' d='M5 6L0 0h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  cursor: pointer;
}
.apr-input:hover { border-color: #93C5FD; }
.apr-input:focus {
  outline: none;
  border-color: #1E3A8A;
  box-shadow: 0 0 0 3px rgba(30, 58, 138, .1);
}
.apr-textarea {
  min-height: 80px;
  padding: 10px 12px;
  border: 1.5px solid #BFDBFE;
  border-radius: 10px;
  background: #fff;
  font-family: var(--apr-font);
  font-size: 13px;
  font-weight: 500;
  color: #0F172A;
  line-height: 1.5;
  resize: vertical;
  transition: all .15s ease;
}
.apr-textarea:focus {
  outline: none;
  border-color: #1E3A8A;
  box-shadow: 0 0 0 3px rgba(30, 58, 138, .1);
}

/* Segmented selector */
.apr-segmented {
  display: inline-flex;
  background: #F1F5F9;
  border: 1px solid #E2E8F0;
  border-radius: 10px;
  padding: 3px;
  width: 100%;
}
.apr-segmented-btn {
  flex: 1;
  height: 32px;
  padding: 0 14px;
  border: none;
  background: transparent;
  border-radius: 7px;
  font-family: var(--apr-font);
  font-size: 12.5px;
  font-weight: 700;
  color: #64748B;
  cursor: pointer;
  transition: all .15s ease;
  white-space: nowrap;
}
.apr-segmented-btn:hover:not(.on) { color: #1E40AF; }
.apr-segmented-btn.on {
  background: #fff;
  color: #1E40AF;
  box-shadow: 0 2px 5px rgba(15, 23, 42, .08);
}

/* ── Step 3 / Edit · Scoring rows ── */
.apr-scoring { display: flex; flex-direction: column; gap: 8px; }
.apr-score-row {
  display: grid;
  grid-template-columns: 1fr 160px;
  gap: 14px;
  align-items: center;
  padding: 11px 14px;
  background: #fff;
  border: 1.5px solid #E2E8F0;
  border-radius: 12px;
  transition: border-color .15s ease;
}
.apr-score-row.is-auto {
  background: linear-gradient(135deg, rgba(21, 128, 61, .04), #fff);
  border-color: #BBF7D0;
}
.apr-score-row-info { min-width: 0; }
.apr-score-row-h {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.apr-score-row-name {
  font-family: var(--apr-font);
  font-size: 13px;
  font-weight: 800;
  color: #0F172A;
  letter-spacing: -.005em;
}
.apr-source-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  font-family: var(--apr-font);
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: .04em;
  text-transform: uppercase;
}
.apr-source-chip--auto   { background: rgba(21, 128, 61, .12);  color: #15803D; }
.apr-source-chip--manual { background: rgba(30, 64, 175, .12);  color: #1E40AF; }
.apr-source-chip i { font-size: 8px; }
.apr-score-hint {
  font-family: var(--apr-font);
  font-size: 11.5px;
  font-weight: 500;
  color: #64748B;
  line-height: 1.4;
  margin-top: 4px;
}
.apr-score-hint b { color: #1E40AF; font-weight: 700; }

.apr-score-input-wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-end;
}
.apr-score-input {
  width: 64px;
  height: 38px;
  padding: 0 8px;
  border: 1.5px solid #BFDBFE;
  border-radius: 8px;
  background: #fff;
  font-family: var(--apr-font);
  font-size: 15px;
  font-weight: 800;
  color: #1E40AF;
  text-align: center;
  font-variant-numeric: tabular-nums;
  transition: all .15s ease;
  -moz-appearance: textfield;
}
.apr-score-input::-webkit-outer-spin-button,
.apr-score-input::-webkit-inner-spin-button {
  -webkit-appearance: none; margin: 0;
}
.apr-score-input:focus {
  outline: none;
  border-color: #1E3A8A;
  box-shadow: 0 0 0 3px rgba(30, 58, 138, .1);
}
.apr-score-input[readonly] {
  background: #F0FDF4;
  border-color: #BBF7D0;
  color: #15803D;
  cursor: default;
}
.apr-score-suffix {
  font-family: var(--apr-font);
  font-size: 12px;
  font-weight: 800;
  color: #94A3B8;
  line-height: 1;
}
.apr-score-auto-edit {
  width: 32px; height: 32px;
  border: 1px solid #E2E8F0;
  background: #fff;
  border-radius: 8px;
  color: #64748B;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  transition: all .15s ease;
}
.apr-score-auto-edit:hover { color: #1E40AF; border-color: #1E40AF; }
.apr-score-auto-edit.on    { background: rgba(30, 64, 175, .08); color: #1E40AF; border-color: #1E40AF; }

/* Live summary at bottom of scoring */
.apr-score-summary {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 18px;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 50%, #2563EB 100%);
  color: #fff;
  border-radius: 14px;
  margin-top: 14px;
  box-shadow: 0 8px 24px rgba(30, 58, 138, .25);
}
.apr-score-summary-lbl {
  font-family: var(--apr-font);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  opacity: .85;
  line-height: 1;
}
.apr-score-summary-val {
  font-family: var(--apr-font);
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -.02em;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  margin-top: 4px;
}
.apr-score-summary-val small { font-size: 16px; opacity: .82; margin-left: 2px; }
.apr-score-summary-sub {
  font-family: var(--apr-font);
  font-size: 11.5px;
  font-weight: 500;
  opacity: .82;
  margin-top: 5px;
  line-height: 1.3;
}
.apr-score-summary-grade {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  background: #fff;
  color: #1E40AF;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--apr-font);
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -.01em;
  flex-shrink: 0;
}
.apr-score-summary-grade.apr-grade-big--green  { background: #fff; color: #15803D; }
.apr-score-summary-grade.apr-grade-big--blue   { background: #fff; color: #1E40AF; }
.apr-score-summary-grade.apr-grade-big--indigo { background: #fff; color: #4338CA; }
.apr-score-summary-grade.apr-grade-big--orange { background: #fff; color: #D97706; }
.apr-score-summary-grade.apr-grade-big--red    { background: #fff; color: #DC2626; }

/* Increment block */
.apr-increment-block {
  background: #fff;
  border: 1.5px solid #E2E8F0;
  border-radius: 12px;
  padding: 14px 16px;
  margin-top: 12px;
}
.apr-increment-row {
  display: grid;
  grid-template-columns: 1fr 200px;
  gap: 14px;
  align-items: center;
}
.apr-increment-info { min-width: 0; }
.apr-increment-title {
  font-family: var(--apr-font);
  font-size: 13px;
  font-weight: 800;
  color: #0F172A;
}
.apr-increment-sub {
  font-family: var(--apr-font);
  font-size: 11.5px;
  font-weight: 500;
  color: #64748B;
  margin-top: 2px;
}
.apr-increment-percent {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #E2E8F0;
}

/* Small slide-down animation for the inline % / amount fields when
   the user flips the toggle to "Yes". */
.apr-row-expand {
  animation: aprRowExpand .22s ease-out;
}
@keyframes aprRowExpand {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Divider between increment row and bonus row inside the same block. */
.apr-row-separator {
  border-top: 1px solid #EFF6FF;
  margin: 8px 0;
}

/* ── Bonus amount input (shown when Recommend Bonus = Yes) ── */
.apr-bonus-amount {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #E2E8F0;
}
.apr-bonus-input {
  width: 140px;
  height: 40px;
  padding: 0 12px;
  border: 1.5px solid #BFDBFE;
  border-radius: 10px;
  background: #fff;
  color: #1E3A8A;
  font-family: var(--apr-font);
  font-size: 14px;
  font-weight: 700;
  text-align: center;
  font-variant-numeric: tabular-nums;
  transition: all .15s ease;
  -moz-appearance: textfield;
}
.apr-bonus-input::-webkit-outer-spin-button,
.apr-bonus-input::-webkit-inner-spin-button {
  -webkit-appearance: none; margin: 0;
}
.apr-bonus-input::placeholder { color: #94A3B8; font-weight: 600; }
.apr-bonus-input:focus {
  outline: none;
  border-color: #1E3A8A;
  box-shadow: 0 0 0 3px rgba(30, 58, 138, .08);
}
.apr-bonus-note {
  font-family: var(--apr-font);
  font-size: 11px;
  font-weight: 500;
  color: #94A3B8;
  line-height: 1.4;
}

/* ── Final Overall Remarks (Step 3 bottom) ── */
.apr-final-remarks {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #EFF6FF;
}
.apr-final-remarks-label {
  display: block;
  font-family: var(--apr-font);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .6px;
  color: #64748B;
  margin-bottom: 8px;
  line-height: 1;
}
.apr-final-remarks-wrap {
  position: relative;
}
.apr-final-remarks-input {
  width: 100%;
  min-height: 80px;
  max-height: 150px;
  padding: 12px 14px;
  padding-bottom: 24px;
  border: 1.5px solid #BFDBFE;
  border-radius: 12px;
  background: #FAFCFF;
  color: #1E3A5F;
  font-family: var(--apr-font);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.6;
  resize: vertical;
  transition: all .15s ease;
  display: block;
  box-sizing: border-box;
}
.apr-final-remarks-input::placeholder {
  color: #94A3B8;
  font-weight: 500;
}
.apr-final-remarks-input:focus {
  outline: none;
  border-color: #1E3A8A;
  box-shadow: 0 0 0 3px rgba(30, 58, 138, .08);
}
.apr-final-remarks-counter {
  position: absolute;
  right: 12px;
  bottom: 8px;
  font-family: var(--apr-font);
  font-size: 10px;
  font-weight: 600;
  color: #94A3B8;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}
.apr-final-remarks-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-family: var(--apr-font);
  font-size: 11px;
  font-weight: 500;
  color: #64748B;
  line-height: 1.4;
}
.apr-final-remarks-hint i {
  color: #0284C7;
  font-size: 11px;
}

/* ── View modal hero ── */
.apr-view-hero {
  display: grid;
  grid-template-columns: 56px 1fr auto;
  gap: 14px;
  align-items: center;
  padding: 14px 16px;
  background: linear-gradient(135deg, #DBEAFE 0%, #EFF6FF 100%);
  border: 1px solid #BFDBFE;
  border-radius: 14px;
  margin-bottom: 14px;
}
.apr-view-avatar {
  width: 56px; height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1E40AF, #2563EB);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--apr-font);
  font-size: 16px;
  font-weight: 800;
  flex-shrink: 0;
  overflow: hidden;
  box-shadow: 0 4px 10px rgba(30, 64, 175, .25);
}
.apr-view-avatar img { width: 100%; height: 100%; object-fit: cover; }
.apr-view-hero-text { min-width: 0; }
.apr-view-name {
  font-family: var(--apr-font);
  font-size: 16px;
  font-weight: 800;
  color: #0F172A;
  letter-spacing: -.01em;
}
.apr-view-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-top: 4px;
  font-family: var(--apr-font);
  font-size: 11.5px;
  font-weight: 500;
  color: #475569;
  line-height: 1.3;
}
.apr-view-meta b { font-weight: 700; color: #1E40AF; }
.apr-view-grade-big {
  width: 70px; height: 70px;
  border-radius: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--apr-font);
  font-size: 26px;
  font-weight: 800;
  color: #fff;
  letter-spacing: -.01em;
  box-shadow: 0 6px 16px rgba(15, 23, 42, .18);
  flex-shrink: 0;
}

/* Score band */
.apr-view-band {
  background: #fff;
  border: 1.5px solid #E2E8F0;
  border-radius: 14px;
  padding: 16px 18px;
  margin-bottom: 14px;
}
.apr-view-band-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
}
.apr-view-band-lbl {
  font-family: var(--apr-font);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: #64748B;
}
.apr-view-band-val {
  font-family: var(--apr-font);
  font-size: 30px;
  font-weight: 800;
  color: #1E40AF;
  letter-spacing: -.02em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.apr-view-band-val small { font-size: 14px; color: #94A3B8; margin-left: 2px; }
.apr-view-progress {
  height: 10px;
  background: #F1F5F9;
  border-radius: 999px;
  overflow: hidden;
}
.apr-view-progress-bar {
  height: 100%;
  border-radius: 999px;
  transition: width .35s ease;
}
.apr-view-progress-bar--green  { background: linear-gradient(90deg, #16A34A, #22C55E); }
.apr-view-progress-bar--blue   { background: linear-gradient(90deg, #1E3A8A, #2563EB); }
.apr-view-progress-bar--indigo { background: linear-gradient(90deg, #4338CA, #6366F1); }
.apr-view-progress-bar--orange { background: linear-gradient(90deg, #D97706, #F59E0B); }
.apr-view-progress-bar--red    { background: linear-gradient(90deg, #DC2626, #EF4444); }
.apr-view-band-meaning {
  font-family: var(--apr-font);
  font-size: 12px;
  font-weight: 500;
  color: #64748B;
  margin-top: 10px;
  line-height: 1.4;
}

/* Parameter table */
.apr-view-table {
  background: #fff;
  border: 1.5px solid #E2E8F0;
  border-radius: 14px;
  overflow: hidden;
  margin-bottom: 14px;
}
.apr-view-table-head {
  display: grid;
  grid-template-columns: 1.8fr 100px 80px 100px;
  gap: 10px;
  padding: 11px 16px;
  background: #F0F4FF;
  font-family: var(--apr-font);
  font-size: 10.5px;
  font-weight: 800;
  color: #64748B;
  text-transform: uppercase;
  letter-spacing: .06em;
  line-height: 1;
}
.apr-view-table-head .c, .apr-view-table-row .c { text-align: center; }
.apr-view-table-head .r, .apr-view-table-row .r { text-align: right; }
.apr-view-table-row {
  display: grid;
  grid-template-columns: 1.8fr 100px 80px 100px;
  gap: 10px;
  padding: 10px 16px;
  border-top: 1px solid #F1F5F9;
  align-items: center;
  font-family: var(--apr-font);
  font-size: 12.5px;
  color: #1E293B;
}
.apr-view-table-row.tot {
  background: linear-gradient(135deg, #DBEAFE, #EFF6FF);
  font-weight: 800;
  color: #1E3A8A;
}
.apr-view-row-name { font-weight: 700; color: #0F172A; }
.apr-view-row-score { color: #1E40AF; font-weight: 800; font-variant-numeric: tabular-nums; }
.apr-view-row-score small { font-size: 10px; color: #94A3B8; margin-left: 1px; }
.apr-view-row-weighted { font-weight: 700; font-variant-numeric: tabular-nums; color: #475569; }

/* Remarks card */
.apr-view-remarks {
  background: #fff;
  border: 1.5px solid #E2E8F0;
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 14px;
}
.apr-view-remarks-h {
  display: flex;
  align-items: center;
  gap: 7px;
  font-family: var(--apr-font);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: #64748B;
  margin-bottom: 8px;
}
.apr-view-remarks-h i { color: #1E40AF; font-size: 11px; opacity: .85; }
.apr-view-remarks-body {
  font-family: var(--apr-font);
  font-size: 12.5px;
  font-weight: 500;
  color: #1E293B;
  line-height: 1.55;
}
.apr-view-remark-item { padding: 3px 0; }
.apr-view-remark-item + .apr-view-remark-item { border-top: 1px dashed #F1F5F9; margin-top: 4px; padding-top: 7px; }
.apr-view-remarks-body em { color: #94A3B8; font-style: italic; }

/* Reward banners — increment + bonus in a 2-column grid */
.apr-view-reward-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 14px;
}
.apr-view-increment,
.apr-view-bonus,
.apr-view-reward {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 12px;
  font-family: var(--apr-font);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}
.apr-view-increment {
  background: linear-gradient(135deg, #ECFDF5, #DCFCE7);
  border: 1px solid #A7F3D0;
  color: #166534;
}
.apr-view-increment b { font-weight: 800; color: #15803D; }
.apr-view-increment i { font-size: 16px; color: #16A34A; }
.apr-view-bonus {
  background: linear-gradient(135deg, #ECFDF5, #D1FAE5);
  border: 1px solid #A7F3D0;
  color: #166534;
}
.apr-view-bonus b {
  font-weight: 800;
  color: #15803D;
  font-variant-numeric: tabular-nums;
}
.apr-view-bonus i { font-size: 16px; color: #16A34A; }
.apr-view-reward--none {
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  color: #64748B;
  font-weight: 500;
}
.apr-view-reward--none i { font-size: 14px; color: #94A3B8; }

/* Final Overall Remarks — light-blue box at bottom of View modal */
.apr-view-final-remarks {
  background: #F0F4FF;
  border: 1px solid #BFDBFE;
  border-radius: 10px;
  padding: 16px 18px;
  margin-top: 14px;
}
.apr-view-final-remarks-h {
  font-family: var(--apr-font);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .6px;
  color: #64748B;
  margin-bottom: 10px;
  line-height: 1;
}
.apr-view-final-remarks-body {
  font-family: var(--apr-font);
  font-size: 12.5px;
  font-style: italic;
  color: #1E3A5F;
  line-height: 1.7;
  white-space: pre-wrap;
}

/* ═══════════════════════════════════════════════════════════════════
   AUTO INFO POPOVER + MANUAL REMARKS FIELD
   ═══════════════════════════════════════════════════════════════════ */

/* Info icon button — small ⓘ next to the AUTO chip */
.apr-auto-info-btn {
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: #0284C7;
  border-radius: 50%;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  padding: 0;
  margin-left: 2px;
  transition: all .15s ease;
}
.apr-auto-info-btn:hover {
  background: rgba(2, 132, 199, .12);
  color: #0369A1;
}
.apr-auto-info-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(2, 132, 199, .25);
}

/* Popover card — portal-mounted, position computed in JS */
.apr-auto-info-card {
  position: fixed;
  background: #fff;
  border: 1px solid #BFDBFE;
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: 0 8px 24px rgba(30, 58, 138, .15);
  z-index: 10000;
  font-family: var(--apr-font);
  animation: aprFadeIn .14s ease-out;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.apr-auto-info-section {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.apr-auto-info-h {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--apr-font);
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: #64748B;
  line-height: 1;
}
.apr-auto-info-h i {
  color: #1E40AF;
  font-size: 10px;
  opacity: .85;
}
.apr-auto-info-body {
  font-family: var(--apr-font);
  font-size: 12px;
  font-weight: 500;
  color: #1E3A5F;
  line-height: 1.5;
}
.apr-auto-info-body b { font-weight: 700; color: #0F172A; }
.apr-auto-info-formula {
  display: inline-block;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 11.5px;
  font-weight: 500;
  color: #1E3A8A;
  background: #F0F4FF;
  padding: 6px 10px;
  border-radius: 6px;
  line-height: 1.4;
}
.apr-auto-info-bands {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.apr-auto-info-band {
  display: grid;
  grid-template-columns: 76px 1fr;
  gap: 8px;
  align-items: center;
  font-family: var(--apr-font);
  font-size: 11.5px;
  font-weight: 500;
  color: #1E3A5F;
  line-height: 1.3;
}
.apr-band-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  font-family: var(--apr-font);
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: .04em;
  text-transform: uppercase;
}
.apr-band-chip--green { background: rgba(21, 128, 61, .12);  color: #15803D; }
.apr-band-chip--blue  { background: rgba(30, 64, 175, .12);  color: #1E40AF; }
.apr-band-chip--amber { background: rgba(217, 119, 6, .12);  color: #92400E; }
.apr-band-chip--red   { background: rgba(220, 38, 38, .12);  color: #B91C1C; }
.apr-band-body { word-break: break-word; }

.apr-auto-info-current {
  font-family: var(--apr-font);
  font-size: 12.5px;
  font-weight: 600;
  color: #1E3A5F;
  background: linear-gradient(135deg, #EFF6FF, #DBEAFE);
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #BFDBFE;
}
.apr-auto-info-current b {
  font-family: var(--apr-font);
  font-weight: 800;
  color: #1E3A8A;
  font-variant-numeric: tabular-nums;
}
.apr-auto-info-note {
  font-family: var(--apr-font);
  font-size: 10.5px;
  font-weight: 500;
  color: #94A3B8;
  line-height: 1.4;
  padding-top: 8px;
  border-top: 1px dashed #E2E8F0;
}
.apr-auto-info-note i {
  color: #1E40AF;
  font-size: 9px;
  margin: 0 1px;
}

/* ── Manual remarks textarea (inside score row) ── */
.apr-manual-remarks {
  grid-column: 1 / -1;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #E2E8F0;
}
.apr-manual-remarks-label {
  display: block;
  font-family: var(--apr-font);
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: #64748B;
  margin-bottom: 6px;
  line-height: 1;
}
.apr-manual-remarks-wrap {
  position: relative;
}
.apr-manual-remarks-input {
  width: 100%;
  min-height: 56px;
  max-height: 120px;
  padding: 8px 12px;
  padding-bottom: 22px;
  border: 1.5px solid #BFDBFE;
  border-radius: 10px;
  background: #FAFCFF;
  font-family: var(--apr-font);
  font-size: 12.5px;
  font-weight: 500;
  color: #1E3A5F;
  line-height: 1.5;
  resize: vertical;
  transition: all .15s ease;
  display: block;
  box-sizing: border-box;
}
.apr-manual-remarks-input::placeholder {
  color: #94A3B8;
  font-weight: 500;
}
.apr-manual-remarks-input:focus {
  outline: none;
  border-color: #1E3A8A;
  box-shadow: 0 0 0 3px rgba(30, 58, 138, .08);
}
.apr-manual-remarks-counter {
  position: absolute;
  right: 10px;
  bottom: 6px;
  font-family: var(--apr-font);
  font-size: 10px;
  font-weight: 600;
  color: #94A3B8;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}

/* ── View modal — 5-column param table + parameter-wise remarks ── */
.apr-view-table--with-remarks .apr-view-table-head,
.apr-view-table--with-remarks .apr-view-table-row {
  grid-template-columns: 1.6fr 90px 70px 80px 1.5fr;
}
.apr-view-row-remarks {
  font-family: var(--apr-font);
  font-size: 11px;
  font-weight: 500;
  color: #64748B;
  line-height: 1.5;
  font-style: italic;
  word-break: break-word;
}
.apr-view-row-remarks em { font-style: italic; }
.apr-view-row-remarks-empty { color: #CBD5E1; font-style: normal; }

/* Parameter-wise remarks section */
.apr-pw-remarks {
  background: #fff;
  border: 1.5px solid #E2E8F0;
  border-radius: 14px;
  padding: 14px 18px;
  margin-bottom: 14px;
}
.apr-pw-remarks-h {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--apr-font);
  font-size: 11.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: #64748B;
  padding-bottom: 10px;
  border-bottom: 1px solid #E2E8F0;
  margin-bottom: 12px;
}
.apr-pw-remarks-h i {
  color: #1E40AF;
  font-size: 12px;
  opacity: .85;
}
.apr-pw-remarks-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.apr-pw-remarks-item {
  padding: 10px 12px;
  background: #FAFCFF;
  border: 1px solid #DBEAFE;
  border-radius: 10px;
  border-left: 3px solid #1E40AF;
}
.apr-pw-remarks-item-h {
  font-family: var(--apr-font);
  font-size: 12.5px;
  font-weight: 500;
  color: #1E3A5F;
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
}
.apr-pw-remarks-item-h b {
  font-family: var(--apr-font);
  font-weight: 800;
  color: #0F172A;
  letter-spacing: -.005em;
}
.apr-pw-remarks-item-score {
  font-family: var(--apr-font);
  font-size: 12px;
  font-weight: 700;
  color: #1E40AF;
  font-variant-numeric: tabular-nums;
}
.apr-pw-remarks-item-body {
  margin-top: 5px;
  font-family: var(--apr-font);
  font-size: 12.5px;
  font-weight: 500;
  font-style: italic;
  color: #475569;
  line-height: 1.55;
}

/* ── Delete modal ── */
.apr-modal--delete .apr-modal-head { display: none; }
.apr-modal--delete .apr-modal-body {
  background: #fff;
  padding: 28px 28px 16px;
  text-align: center;
}
.apr-delete-ic {
  width: 64px; height: 64px;
  margin: 0 auto 14px;
  border-radius: 50%;
  background: rgba(220, 38, 38, .12);
  color: #DC2626;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}
.apr-delete-title {
  font-family: var(--apr-font);
  font-size: 17px;
  font-weight: 800;
  color: #0F172A;
  margin-bottom: 8px;
  letter-spacing: -.01em;
}
.apr-delete-body {
  font-family: var(--apr-font);
  font-size: 13px;
  font-weight: 500;
  color: #475569;
  line-height: 1.5;
}
.apr-delete-body b { color: #0F172A; font-weight: 700; }

/* Large grade-tone backgrounds for the View hero badge */
.apr-grade-big--green  { background: linear-gradient(135deg, #16A34A, #15803D); }
.apr-grade-big--blue   { background: linear-gradient(135deg, #2563EB, #1E3A8A); }
.apr-grade-big--indigo { background: linear-gradient(135deg, #6366F1, #4338CA); }
.apr-grade-big--orange { background: linear-gradient(135deg, #F59E0B, #D97706); }
.apr-grade-big--red    { background: linear-gradient(135deg, #EF4444, #DC2626); }

/* ═══════════════════════════════════════════════════════════════════
   EXTRA RESPONSIVE — tablet/mobile collapse for wide grids, tables,
   toolbars, and modal sizing. Additive — does not alter desktop.
   ═══════════════════════════════════════════════════════════════════ */
@media (max-width: 900px) {
  .apr-subtabs { gap: 2px; padding: 3px; }
  .apr-subtab { min-width: 130px; padding: 9px 10px; font-size: 12px; }
  .apr-stats { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .apr-filters { grid-template-columns: 1fr 1fr; gap: 8px; flex-wrap: wrap; }
  .apr-search { grid-column: span 2; }
  .apr-add-btn { grid-column: span 2; justify-self: stretch; justify-content: center; }
  .apr-reports-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }
  .apr-rv-toolbar { grid-template-columns: 1fr; gap: 10px; }
  .apr-rv-toolbar-l, .apr-rv-toolbar-r { flex-wrap: wrap; justify-content: center; }
  .apr-modal-head, .emp-modal-head { flex-wrap: wrap; gap: 8px; }
  .apr-modal-head-actions, .emp-modal-head-actions { flex-wrap: wrap; }
  .apr-modal-foot { flex-wrap: wrap; gap: 8px; }
  .apr-modal-foot-right { flex-wrap: wrap; justify-content: flex-end; }
  .apr-table-head, .apr-table-row { font-size: 12px; }
  .apr-view-hero { grid-template-columns: 56px 1fr; row-gap: 8px; }
  .apr-view-grade-big { grid-column: 1 / -1; justify-self: stretch; }
  .apr-cond-crit-head { grid-template-columns: 1fr; gap: 8px; }
  .apr-cond-crit-score { grid-template-columns: 70px 90px 70px; justify-content: flex-end; }
}
@media (max-width: 600px) {
  .apr-stats { grid-template-columns: 1fr; }
  .apr-filters { grid-template-columns: 1fr; }
  .apr-search, .apr-add-btn { grid-column: span 1; }

  /* ── Main Staff Appraisal tabs — horizontal scroll, no clipping ── */
  .apr-subtabs {
    flex-wrap: nowrap !important;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .apr-subtabs::-webkit-scrollbar { display: none; }
  .apr-subtab {
    flex: 0 0 auto !important;
    min-width: 0 !important;
    flex-basis: auto !important;
    padding: 9px 14px;
    font-size: 12px;
    white-space: nowrap;
  }

  .apr-reports-grid { grid-template-columns: 1fr; gap: 12px; }

  /* ── Appraisals list cards — compact flex card ──
       JSX 8 cells: emp · dept · period · overall · grade · status · by · actions
       Row 1: avatar + name + EID                       [view][edit][del]
       Row 2: badges row — grade · status · overall %
       Row 3: dept · period · conducted-by                                */
  .apr-table-head { display: none; }
  .apr-table-row {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    grid-template-columns: none !important;
    column-gap: 8px !important;
    row-gap: 8px !important;
    padding: 12px 14px;
    min-height: 0 !important;
  }
  .apr-table-row > .td { padding: 0 !important; min-width: 0 !important; gap: 8px; }

  /* Row 1 */
  .apr-table-row > .td.apr-emp     { order: 1; flex: 1 1 auto !important; }
  .apr-table-row > .td.apr-actions {
    order: 2;
    flex: 0 0 auto !important;
    margin-left: auto !important;
    justify-content: flex-end !important;
  }

  /* Wrap break — pushes badges + meta onto Row 2 / Row 3 */
  .apr-table-row::after {
    content: "";
    flex: 1 1 100%;
    height: 0;
    order: 2.5;
  }

  /* Row 2 — badge row: grade · status · overall % */
  .apr-table-row > .td:nth-of-type(5) { order: 3; flex: 0 0 auto !important; }   /* Grade */
  .apr-table-row > .td:nth-of-type(6) { order: 4; flex: 0 0 auto !important; }   /* Status */
  .apr-table-row > .td:nth-of-type(4) {                                          /* Overall */
    order: 5; flex: 0 0 auto !important;
    margin-left: auto !important;
  }

  /* Row 3 — meta: dept · period · conducted-by */
  .apr-table-row > .td.apr-dept    { order: 6; flex: 0 0 auto !important; font-size: 11px; }
  .apr-table-row > .td:nth-of-type(3) {                                          /* Period */
    order: 7; flex: 0 0 auto !important; font-size: 11px;
  }
  .apr-table-row > .td.apr-by      {
    order: 8; flex: 1 1 100% !important;
    font-size: 11px; color: var(--text-muted);
  }
  .apr-table-row > .td.apr-by .apr-by-name { font-size: 11px; }
  .apr-table-row > .td.apr-by .apr-by-date { font-size: 10px; }

  /* Tighten inner visuals so the card fits */
  .apr-avatar { width: 36px; height: 36px; }
  .apr-name { font-size: 13px; line-height: 1.3; word-break: normal; overflow-wrap: break-word; }
  .apr-eid { font-size: 11px; }
  .apr-overall-num { font-size: 14px; }
  .apr-dept-pill { font-size: 10.5px; padding: 2px 8px; }
  .apr-desig { font-size: 10.5px; }
  .apr-period { font-size: 11.5px; }
  .apr-cycle { font-size: 10px; }
  .apr-status { font-size: 10.5px; padding: 3px 9px; }
  .apr-table-row .apr-act { width: 30px; height: 30px; font-size: 11.5px; }
  .apr-table-row .apr-actions { gap: 4px !important; }

  /* ── New Appraisal Modal — fit viewport, body scrolls only ── */
  .apr-modal-back { padding: 6px !important; }
  .apr-modal {
    width: 100% !important;
    max-width: 100% !important;
    max-height: calc(100dvh - 12px) !important;
    border-radius: 14px;
  }
  .emp-modal { width: 100% !important; max-width: 100% !important; }
  .apr-modal-head { padding: 12px 14px; gap: 10px; }
  .apr-modal-icn { width: 36px; height: 36px; font-size: 14px; }
  .apr-modal-title { font-size: 14.5px; }
  .apr-modal-sub { font-size: 11px; }
  .apr-modal-x { width: 30px; height: 30px; font-size: 12px; }
  .apr-modal-body {
    padding: 14px;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    -webkit-overflow-scrolling: touch;
  }
  .apr-modal-foot { padding: 12px 14px; flex-direction: column; align-items: stretch; }
  .apr-modal-foot .apr-btn { width: 100%; justify-content: center; }
  .apr-modal-foot-right { flex-direction: column; align-items: stretch; width: 100%; }

  /* ── Step 1 — Staff picker ── */
  .apr-staff-picker .apr-search { width: 100% !important; }
  .apr-search-input { font-size: 13px; }
  .apr-staff-list { max-height: calc(100dvh - 320px); }
  .apr-staff-row {
    grid-template-columns: 36px 1fr 18px !important;
    gap: 10px !important;
    padding: 8px 10px;
  }
  .apr-staff-avatar { width: 36px; height: 36px; font-size: 11px; }
  .apr-staff-name { font-size: 12.5px; }
  .apr-staff-meta { font-size: 10.5px; }
  .apr-staff-radio { justify-self: end; }

  /* ── Step 2 — Details form, all fields full-width single column ── */
  .apr-detail-grid {
    grid-template-columns: 1fr !important;
    gap: 12px !important;
  }
  .apr-field-group.span2 { grid-column: span 1 !important; }
  .apr-field-label { font-size: 10.5px; }
  .apr-input, select.apr-input {
    width: 100% !important;
    box-sizing: border-box;
    height: 40px;
    font-size: 13px;
  }
  .apr-textarea {
    width: 100% !important;
    box-sizing: border-box;
    font-size: 13px;
    min-height: 72px;
  }

  /* Cycle type segmented bar — fit width OR scroll horizontally on tiny screens */
  .apr-segmented {
    width: 100% !important;
    overflow-x: auto;
    flex-wrap: nowrap;
    scrollbar-width: none;
  }
  .apr-segmented::-webkit-scrollbar { display: none; }
  .apr-segmented-btn {
    flex: 1 1 auto;
    min-width: max-content;
    padding: 0 10px;
    font-size: 11.5px;
    white-space: nowrap;
  }

  /* Selected-staff summary card in Step 2 — keep readable */
  .apr-staff-readout, .apr-readonly-card {
    grid-template-columns: 36px 1fr !important;
    gap: 10px !important;
    padding: 9px 12px !important;
  }
  .apr-staff-readout .apr-staff-avatar { width: 36px; height: 36px; font-size: 11px; }

  /* Stepper rail — already tightened by 720px rule (.apr-step-label hidden) */
  .apr-stepper { padding: 10px 14px; gap: 4px; }
  .apr-step-pill { padding: 6px 10px; font-size: 11px; }
  .apr-rv-toolbar-l, .apr-rv-toolbar-r, .apr-rv-toolbar-c { flex-direction: column; align-items: stretch; gap: 8px; }
  .apr-rv-action, .apr-rv-bw { width: 100%; justify-content: center; }
  .apr-rv-sheet { padding: 18px 14px; }
  .apr-rv-meta { grid-template-columns: 1fr; }
  .apr-hero { grid-template-columns: 1fr; }
  .apr-cond-crit-head { grid-template-columns: 1fr; }
  .apr-cond-crit-score { grid-template-columns: 1fr; gap: 6px; }
  .apr-cond-guide { grid-template-columns: 1fr; }
  .apr-stat-val { font-size: 22px; }
  .apr-view-table-head, .apr-view-table-row {
    grid-template-columns: 1fr 60px 56px 70px;
    gap: 6px;
    padding: 8px 10px;
    font-size: 11px;
  }
}

/* Allow tables in narrow viewports to scroll horizontally if needed */
@media (max-width: 600px) {
  .apr-table, .apr-view-table, .apr-rv-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
}

/* ── DARK MODE OVERRIDES ── */
[data-theme="dark"] .apr-subtabs { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .apr-subtab { color: var(--text-muted); }
[data-theme="dark"] .apr-subtab:hover:not(.on) { background: var(--bg-muted); color: #93C5FD; }
[data-theme="dark"] .apr-link-btn { background: var(--bg-card); border-color: var(--border-light); color: #93C5FD; }
[data-theme="dark"] .apr-link-btn:hover { background: rgba(59,130,246,.10); border-color: #2563EB; }

/* Setup intro banner */
[data-theme="dark"] .apr-setup-intro {
  background: linear-gradient(135deg, rgba(30,58,138,.22), rgba(37,99,235,.10));
  border-color: rgba(59,130,246,.32);
}
[data-theme="dark"] .apr-setup-intro-title { color: var(--text-primary); }
[data-theme="dark"] .apr-setup-intro-accent { color: #93C5FD; }
[data-theme="dark"] .apr-setup-intro-desc { color: var(--text-secondary); }

/* Cards & containers */
[data-theme="dark"] .apr-card,
[data-theme="dark"] .apr-cat,
[data-theme="dark"] .apr-crit,
[data-theme="dark"] .apr-cond-cat,
[data-theme="dark"] .apr-cond-crit,
[data-theme="dark"] .apr-setup-card,
[data-theme="dark"] .apr-readonly-card,
[data-theme="dark"] .apr-report-card,
[data-theme="dark"] .apr-conduct-top,
[data-theme="dark"] .apr-pf-card,
[data-theme="dark"] .apr-frame-stats,
[data-theme="dark"] .apr-hero {
  background: var(--bg-card);
  border-color: var(--border-light);
  color: var(--text-primary);
}
[data-theme="dark"] .apr-cat-head,
[data-theme="dark"] .apr-cond-cat-head,
[data-theme="dark"] .apr-setup-head,
[data-theme="dark"] .apr-pf-head {
  background: var(--bg-muted);
  border-color: var(--border-light);
}
[data-theme="dark"] .apr-cat-desc,
[data-theme="dark"] .apr-crit-desc,
[data-theme="dark"] .apr-cond-crit-desc,
[data-theme="dark"] .apr-cat-stat,
[data-theme="dark"] .apr-cat-stats,
[data-theme="dark"] .apr-staff-meta,
[data-theme="dark"] .apr-by-date,
[data-theme="dark"] .apr-readonly-meta,
[data-theme="dark"] .apr-stat-sub,
[data-theme="dark"] .apr-stat-lbl,
[data-theme="dark"] .apr-toggle-sub,
[data-theme="dark"] .apr-rad-sub,
[data-theme="dark"] .apr-crit-info-b,
[data-theme="dark"] .apr-hero-sub,
[data-theme="dark"] .apr-hero-lbl,
[data-theme="dark"] .apr-hero-meaning,
[data-theme="dark"] .apr-cond-crit-head label,
[data-theme="dark"] .apr-view-meta,
[data-theme="dark"] .apr-view-band-meaning,
[data-theme="dark"] .apr-view-final-remarks-h,
[data-theme="dark"] .apr-view-remarks-h { color: var(--text-muted); }
[data-theme="dark"] .apr-cat-h,
[data-theme="dark"] .apr-crit-h,
[data-theme="dark"] .apr-cond-crit-h,
[data-theme="dark"] .apr-toggle-title,
[data-theme="dark"] .apr-rad-h,
[data-theme="dark"] .apr-crit-info-h,
[data-theme="dark"] .apr-hero-val,
[data-theme="dark"] .apr-readonly-name,
[data-theme="dark"] .apr-staff-name,
[data-theme="dark"] .apr-view-name,
[data-theme="dark"] .apr-stat-val,
[data-theme="dark"] .apr-band-body,
[data-theme="dark"] .apr-view-band-val,
[data-theme="dark"] .apr-view-final-remarks-body,
[data-theme="dark"] .apr-view-remarks-body,
[data-theme="dark"] .apr-view-band-lbl,
[data-theme="dark"] .apr-by-name,
[data-theme="dark"] .apr-delete-title,
[data-theme="dark"] .apr-delete-body,
[data-theme="dark"] .apr-delete-body b { color: var(--text-primary); }

/* Stats tiles */
[data-theme="dark"] .apr-stat { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .apr-stat-ic { background: rgba(59,130,246,.16); color: #93C5FD; }

/* Tables */
[data-theme="dark"] .apr-table { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .apr-table-head { background: var(--bg-muted); border-color: var(--border-light); color: var(--text-muted); }
[data-theme="dark"] .apr-table-row { background: var(--bg-card); border-color: var(--border-light); color: var(--text-primary); }
[data-theme="dark"] .apr-table-row:hover { background: rgba(59,130,246,.08); }
[data-theme="dark"] .apr-table-row:nth-child(even) { background: rgba(59,130,246,.04); }
[data-theme="dark"] .apr-view-table { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .apr-view-table-head { background: var(--bg-muted); color: var(--text-muted); border-color: var(--border-light); }
[data-theme="dark"] .apr-view-table-row { background: var(--bg-card); color: var(--text-primary); border-color: var(--border-light); }
[data-theme="dark"] .apr-view-table-row:hover { background: rgba(59,130,246,.08); }

/* Filters & search */
[data-theme="dark"] .apr-filters { color: var(--text-primary); }
[data-theme="dark"] .apr-search { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .apr-search-input { background: transparent; color: var(--text-primary); }
[data-theme="dark"] .apr-search-input::placeholder { color: var(--text-muted); }
[data-theme="dark"] .apr-search-ic { color: var(--text-muted); }
[data-theme="dark"] .apr-search-clear { background: var(--bg-muted); color: var(--text-muted); }
[data-theme="dark"] .apr-search-clear:hover { background: rgba(59,130,246,.18); color: #fff; }

/* Form inputs */
[data-theme="dark"] .apr-select,
[data-theme="dark"] .apr-input,
[data-theme="dark"] .apr-textarea,
[data-theme="dark"] .apr-score-input,
[data-theme="dark"] .apr-weight-input,
[data-theme="dark"] .apr-grade-input,
[data-theme="dark"] .apr-bonus-input,
[data-theme="dark"] .apr-threshold-input,
[data-theme="dark"] .apr-manual-remarks-input,
[data-theme="dark"] .apr-final-remarks-input,
[data-theme="dark"] .apr-rv-select,
[data-theme="dark"] .fi {
  background: var(--bg-card);
  border-color: var(--border-light);
  color: var(--text-primary);
}
[data-theme="dark"] .apr-select:focus,
[data-theme="dark"] .apr-input:focus,
[data-theme="dark"] .apr-textarea:focus,
[data-theme="dark"] .apr-score-input:focus,
[data-theme="dark"] .apr-weight-input:focus,
[data-theme="dark"] .apr-grade-input:focus,
[data-theme="dark"] .apr-bonus-input:focus,
[data-theme="dark"] .apr-threshold-input:focus,
[data-theme="dark"] .apr-manual-remarks-input:focus,
[data-theme="dark"] .apr-final-remarks-input:focus,
[data-theme="dark"] .apr-rv-select:focus,
[data-theme="dark"] .fi:focus {
  border-color: #2563EB;
  box-shadow: 0 0 0 3px rgba(59,130,246,.25);
}
[data-theme="dark"] .apr-select::placeholder,
[data-theme="dark"] .apr-input::placeholder,
[data-theme="dark"] .apr-textarea::placeholder,
[data-theme="dark"] .apr-manual-remarks-input::placeholder,
[data-theme="dark"] .apr-final-remarks-input::placeholder { color: var(--text-muted); }
[data-theme="dark"] .apr-select option { background: var(--bg-card); color: var(--text-primary); }

/* Radio cards / mode segments */
[data-theme="dark"] .apr-rad { background: var(--bg-card); border-color: var(--border-light); color: var(--text-primary); }
[data-theme="dark"] .apr-rad:hover { background: rgba(59,130,246,.06); border-color: #2563EB; }
[data-theme="dark"] .apr-rad.on { background: linear-gradient(135deg, rgba(30,58,138,.22), rgba(37,99,235,.10)); border-color: #2563EB; }
[data-theme="dark"] .apr-segmented-btn { color: var(--text-muted); }
[data-theme="dark"] .apr-segmented-btn.on { background: var(--bg-card); color: #93C5FD; }

/* Toggle */
[data-theme="dark"] .apr-toggle { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .apr-toggle.on { background: linear-gradient(135deg, #1E3A8A, #2563EB); }
[data-theme="dark"] .apr-toggle-thumb { background: #E2E8F8; }

/* Modals */
[data-theme="dark"] .apr-modal-back { background: rgba(0,0,0,.62); }
[data-theme="dark"] .apr-modal,
[data-theme="dark"] .emp-modal { background: var(--bg-card); color: var(--text-primary); border-color: var(--border-light); }
[data-theme="dark"] .apr-modal-head,
[data-theme="dark"] .emp-modal-head { border-color: var(--border-light); }
[data-theme="dark"] .apr-modal-body,
[data-theme="dark"] .emp-modal-body { background: var(--bg-card); color: var(--text-primary); }
[data-theme="dark"] .apr-modal-foot,
[data-theme="dark"] .emp-modal-foot { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .apr-modal-title,
[data-theme="dark"] .emp-modal-title { color: #fff; }
[data-theme="dark"] .apr-modal-sub,
[data-theme="dark"] .emp-modal-sub { color: rgba(255,255,255,.78); }
[data-theme="dark"] .apr-modal--delete .apr-modal-body { background: var(--bg-card); }
[data-theme="dark"] .apr-modal--delete .apr-delete-ic { background: rgba(239,68,68,.18); color: #FCA5A5; }

/* Stepper */
[data-theme="dark"] .apr-stepper { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .apr-step-pill { color: var(--text-muted); }
[data-theme="dark"] .apr-step-pill .apr-step-num { background: var(--bg-card); border-color: var(--border-light); color: var(--text-muted); }

/* Staff picker list */
[data-theme="dark"] .apr-staff-list { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .apr-staff-row { border-color: var(--border-light); }
[data-theme="dark"] .apr-staff-row:hover { background: rgba(59,130,246,.08); }
[data-theme="dark"] .apr-staff-empty { color: var(--text-muted); }
[data-theme="dark"] .apr-staff-readout { background: var(--bg-muted); border-color: var(--border-light); color: var(--text-primary); }
[data-theme="dark"] .apr-staff-dot { color: var(--text-muted); }

/* Action icons in row */
[data-theme="dark"] .apr-act { background: var(--bg-muted); border-color: var(--border-light); color: #93C5FD; }
[data-theme="dark"] .apr-act:hover { background: #2563EB; color: #fff; border-color: #2563EB; }
[data-theme="dark"] .apr-act--danger { color: #FCA5A5; }
[data-theme="dark"] .apr-act--danger:hover { background: #DC2626; color: #fff; border-color: #DC2626; }

/* Buttons */
[data-theme="dark"] .apr-btn-ghost,
[data-theme="dark"] .emp-btn-ghost { background: var(--bg-card); border-color: var(--border-light); color: var(--text-secondary); }
[data-theme="dark"] .apr-btn-ghost:hover,
[data-theme="dark"] .emp-btn-ghost:hover { background: var(--bg-muted); color: var(--text-primary); }
[data-theme="dark"] .apr-btn-danger { background: linear-gradient(135deg, #B91C1C, #DC2626); border-color: #B91C1C; }
[data-theme="dark"] .apr-auto-info-btn { background: var(--bg-muted); border-color: var(--border-light); color: #93C5FD; }
[data-theme="dark"] .apr-auto-info-btn:hover { background: rgba(59,130,246,.18); }

/* Auto-info popover card */
[data-theme="dark"] .apr-auto-info-card { background: var(--bg-card); border-color: var(--border-light); color: var(--text-primary); box-shadow: 0 12px 40px rgba(0,0,0,.55); }
[data-theme="dark"] .apr-auto-info-h { color: var(--text-primary); }
[data-theme="dark"] .apr-auto-info-section { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .apr-auto-info-band { background: var(--bg-card); border-color: var(--border-light); color: var(--text-secondary); }
[data-theme="dark"] .apr-auto-info-current { background: rgba(59,130,246,.12); border-color: rgba(59,130,246,.32); color: #93C5FD; }
[data-theme="dark"] .apr-auto-info-formula { background: var(--bg-card); border-color: var(--border-light); color: var(--text-primary); }
[data-theme="dark"] .apr-auto-info-note { color: var(--text-muted); }
[data-theme="dark"] .apr-auto-info-body { color: var(--text-secondary); }

/* Badges / pills / chips — keep semantic hue, darken bg */
[data-theme="dark"] .apr-status--done { background: rgba(22,163,74,.18); color: #86EFAC; border-color: rgba(22,163,74,.32); }
[data-theme="dark"] .apr-status--draft { background: rgba(245,158,11,.18); color: #FCD34D; border-color: rgba(245,158,11,.32); }
[data-theme="dark"] .apr-band-chip--green { background: rgba(22,163,74,.18); color: #86EFAC; }
[data-theme="dark"] .apr-band-chip--blue { background: rgba(37,99,235,.18); color: #93C5FD; }
[data-theme="dark"] .apr-band-chip--amber { background: rgba(245,158,11,.18); color: #FCD34D; }
[data-theme="dark"] .apr-band-chip--red { background: rgba(239,68,68,.18); color: #FCA5A5; }
[data-theme="dark"] .apr-grade-chip--green { background: rgba(22,163,74,.18); color: #86EFAC; }
[data-theme="dark"] .apr-grade-chip--blue { background: rgba(37,99,235,.18); color: #93C5FD; }
[data-theme="dark"] .apr-grade-chip--indigo { background: rgba(99,102,241,.18); color: #C7D2FE; }
[data-theme="dark"] .apr-grade-chip--orange { background: rgba(245,158,11,.18); color: #FCD34D; }
[data-theme="dark"] .apr-grade-chip--red { background: rgba(239,68,68,.18); color: #FCA5A5; }
[data-theme="dark"] .apr-source-chip--auto { background: rgba(59,130,246,.16); color: #93C5FD; }
[data-theme="dark"] .apr-source-chip--manual { background: rgba(245,158,11,.18); color: #FCD34D; }
[data-theme="dark"] .apr-crit-tag--auto { background: rgba(59,130,246,.16); color: #93C5FD; border-color: rgba(59,130,246,.32); }
[data-theme="dark"] .apr-crit-tag--manual { background: rgba(245,158,11,.18); color: #FCD34D; border-color: rgba(245,158,11,.32); }
[data-theme="dark"] .apr-elig-chip { background: var(--bg-muted); border-color: var(--border-light); color: var(--text-muted); }
[data-theme="dark"] .apr-elig-chip.on { background: rgba(22,163,74,.18); border-color: rgba(22,163,74,.32); color: #86EFAC; }
[data-theme="dark"] .apr-train-chip { background: rgba(59,130,246,.14); border-color: rgba(59,130,246,.28); color: #93C5FD; }
[data-theme="dark"] .apr-rv-chip { background: var(--bg-muted); border-color: var(--border-light); color: var(--text-secondary); }
[data-theme="dark"] .apr-rv-chip--green { background: rgba(22,163,74,.18); color: #86EFAC; }
[data-theme="dark"] .apr-rv-chip--blue { background: rgba(37,99,235,.18); color: #93C5FD; }
[data-theme="dark"] .apr-rv-chip-sm { background: var(--bg-muted); color: var(--text-secondary); }
[data-theme="dark"] .apr-rv-chip-sm--auto { background: rgba(59,130,246,.18); color: #93C5FD; }
[data-theme="dark"] .apr-rv-chip-sm--manual { background: rgba(245,158,11,.18); color: #FCD34D; }
[data-theme="dark"] .apr-rv-chip-sm--eligible { background: rgba(22,163,74,.18); color: #86EFAC; }
[data-theme="dark"] .apr-rv-chip-sm--noteligible { background: rgba(239,68,68,.18); color: #FCA5A5; }
[data-theme="dark"] .apr-cat-check { background: rgba(22,163,74,.18); color: #86EFAC; }

/* Guidance tags */
[data-theme="dark"] .apr-crit-guide { background: var(--bg-muted); border-color: var(--border-light); color: var(--text-secondary); }
[data-theme="dark"] .apr-crit-guide-tag.tone-green { background: rgba(22,163,74,.18); color: #86EFAC; }
[data-theme="dark"] .apr-cond-guide { background: var(--bg-muted); border-color: var(--border-light); color: var(--text-secondary); }

/* Weight pill */
[data-theme="dark"] .apr-weight-pill { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .apr-weight-suffix { color: var(--text-muted); }
[data-theme="dark"] .apr-weight-total { color: var(--text-muted); }
[data-theme="dark"] .apr-weight-total--green { color: #86EFAC; }
[data-theme="dark"] .apr-weight-total--amber { color: #FCD34D; }
[data-theme="dark"] .apr-weight-total--red { color: #FCA5A5; }
[data-theme="dark"] .apr-weight-total-msg { color: var(--text-muted); }
[data-theme="dark"] .apr-weight-total-ok { color: #86EFAC; }

/* Sticky save bar */
[data-theme="dark"] .apr-stickybar { background: var(--bg-card); border-color: var(--border-light); color: var(--text-primary); }
[data-theme="dark"] .apr-stickybar-msg { color: var(--text-secondary); }

/* Warning / validation banners */
[data-theme="dark"] .apr-warning { background: rgba(245,158,11,.10); border-color: rgba(245,158,11,.32); color: var(--text-secondary); }
[data-theme="dark"] .apr-warning-ic { background: rgba(245,158,11,.20); color: #FCD34D; }
[data-theme="dark"] .apr-warning-text { color: var(--text-secondary); }

/* Hero / score band */
[data-theme="dark"] .apr-hero { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .apr-view-band { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .apr-view-progress { background: rgba(255,255,255,.06); }
[data-theme="dark"] .apr-view-final-remarks,
[data-theme="dark"] .apr-view-remarks,
[data-theme="dark"] .apr-view-remark-item { background: var(--bg-muted); border-color: var(--border-light); color: var(--text-secondary); }
[data-theme="dark"] .apr-view-reward { background: var(--bg-muted); border-color: var(--border-light); color: var(--text-primary); }
[data-theme="dark"] .apr-view-bonus, [data-theme="dark"] .apr-view-increment { color: #86EFAC; }
[data-theme="dark"] .apr-readonly-text .apr-staff-dot { color: var(--text-muted); }

/* Stepper modal step */
[data-theme="dark"] .apr-step.is-active .apr-step-num { background: linear-gradient(135deg, #1E3A8A, #2563EB); color: #fff; }
[data-theme="dark"] .apr-step.is-done .apr-step-num { background: rgba(22,163,74,.22); color: #86EFAC; }
[data-theme="dark"] .apr-step-label { color: var(--text-muted); }

/* Reports tab tiles */
[data-theme="dark"] .apr-report-card { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .apr-report-card:hover { border-color: #2563EB; }

/* Report viewer toolbar */
[data-theme="dark"] .apr-rv-toolbar { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .apr-rv-bw { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .apr-rv-bw-btn { color: var(--text-muted); }
[data-theme="dark"] .apr-rv-bw-btn.on { background: var(--bg-card); color: #93C5FD; }
[data-theme="dark"] .apr-rv-empty { color: var(--text-muted); }

/* RPT (Reports) modal */
[data-theme="dark"] .rpt-toolbar { background: var(--bg-muted); border-color: var(--border-light); color: var(--text-secondary); }
[data-theme="dark"] .rpt-toolbar-lbl { color: var(--text-muted); }
[data-theme="dark"] .rpt-toolbar-count { color: var(--text-muted); }
[data-theme="dark"] .rpt-foot { color: var(--text-muted); border-color: var(--border-light); }

/* Stat icon tones */
[data-theme="dark"] .apr-stat--blue   .apr-stat-ic { background: rgba(37,99,235,.20); color: #93C5FD; }
[data-theme="dark"] .apr-stat--green  .apr-stat-ic { background: rgba(22,163,74,.20); color: #86EFAC; }
[data-theme="dark"] .apr-stat--indigo .apr-stat-ic { background: rgba(99,102,241,.20); color: #C7D2FE; }
[data-theme="dark"] .apr-stat--orange .apr-stat-ic { background: rgba(245,158,11,.20); color: #FCD34D; }

/* Score input wrap suffix */
[data-theme="dark"] .apr-score-suffix { color: var(--text-muted); }
[data-theme="dark"] .apr-score-auto-edit { background: var(--bg-muted); border-color: var(--border-light); color: #93C5FD; }
[data-theme="dark"] .apr-score-auto-edit:hover { background: rgba(59,130,246,.18); }
[data-theme="dark"] .apr-score-auto-edit.on { background: rgba(245,158,11,.18); color: #FCD34D; border-color: rgba(245,158,11,.32); }

/* Step 2 — Grade range table (Setup tab) */
[data-theme="dark"] .apr-grade-list {
  background: var(--bg-card);
  border-color: var(--border-light);
}
[data-theme="dark"] .apr-grade-head {
  background: var(--bg-muted);
  color: var(--text-muted);
  border-color: var(--border-light);
}
[data-theme="dark"] .apr-grade-row {
  border-color: var(--border-light);
  color: var(--text-primary);
}
[data-theme="dark"] .apr-grade-row:hover {
  background: rgba(59,130,246,.08);
}
[data-theme="dark"] .apr-grade-meaning {
  color: var(--text-secondary);
}
[data-theme="dark"] .apr-grade-input::-webkit-outer-spin-button,
[data-theme="dark"] .apr-grade-input::-webkit-inner-spin-button { filter: invert(.85); }

/* Reports tab — card description contrast bump */
[data-theme="dark"] .apr-report-title { color: var(--text-primary); }
[data-theme="dark"] .apr-report-desc  { color: var(--text-secondary); }
[data-theme="dark"] .apr-report-link  { color: #93C5FD; }
[data-theme="dark"] .apr-report-link::after { background: #93C5FD; }

/* Reports tab — "N reports available" intro strip */
[data-theme="dark"] .apr-intro {
  background: linear-gradient(135deg, rgba(59,130,246,.10) 0%, rgba(59,130,246,.04) 100%);
  border-color: var(--border-light);
}
[data-theme="dark"] .apr-intro-ic {
  background: linear-gradient(135deg, #1E40AF 0%, #2563EB 50%, #3B82F6 100%);
  box-shadow: 0 4px 10px rgba(0,0,0,.4);
}
[data-theme="dark"] .apr-intro-title { color: var(--text-primary); }
[data-theme="dark"] .apr-intro-body  { color: var(--text-secondary); }
[data-theme="dark"] .apr-intro-body b { color: var(--text-primary); }

/* Setup intro outlined "Configure" button */
[data-theme="dark"] .apr-setup-intro-btn {
  background: var(--bg-card);
  color: #93C5FD;
  border-color: #2563EB;
}
[data-theme="dark"] .apr-setup-intro-btn:hover {
  background: rgba(59,130,246,.12);
}

/* Inline weight total pill (inside open accordion) */
[data-theme="dark"] .apr-weight-total--inline {
  background: var(--bg-muted);
  border-color: var(--border-light);
  color: var(--text-secondary);
}

/* Empty-state dashed card */
[data-theme="dark"] .apr-empty {
  background: var(--bg-card);
  border-color: var(--border-med);
  color: var(--text-muted);
}

/* Hero grade pill (uses !important in base CSS) */
[data-theme="dark"] .apr-hero-grade .apr-grade-pill {
  background: var(--bg-card) !important;
  color: #93C5FD !important;
}

/* Report viewer Back-to-reports button */
[data-theme="dark"] .apr-rv-back {
  background: var(--bg-card);
  color: var(--text-secondary);
  border-color: var(--border-light);
}
[data-theme="dark"] .apr-rv-back:hover {
  background: rgba(59,130,246,.10);
  color: #93C5FD;
  border-color: #2563EB;
}

/* Optional / labeled input fields */
[data-theme="dark"] .apr-field-optional {
  background: var(--bg-card);
  border-color: var(--border-light);
  color: var(--text-primary);
}
[data-theme="dark"] .apr-field-optional::placeholder { color: var(--text-muted); }
[data-theme="dark"] .apr-field-optional:focus {
  border-color: #2563EB;
  box-shadow: 0 0 0 3px rgba(59,130,246,.25);
}

/* Score row + auto variant */
[data-theme="dark"] .apr-score-row {
  background: var(--bg-card);
  border-color: var(--border-light);
}
[data-theme="dark"] .apr-score-row.is-auto {
  background: linear-gradient(135deg, rgba(22,163,74,.06), var(--bg-card));
  border-color: rgba(22,163,74,.30);
}
[data-theme="dark"] .apr-score-row.is-manual {
  background: linear-gradient(135deg, rgba(245,158,11,.06), var(--bg-card));
  border-color: rgba(245,158,11,.30);
}

/* Score summary grade letter blocks — white bg + tone-colored text in light,
   dark muted surface + brighter tone-colored text in dark */
[data-theme="dark"] .apr-score-summary-grade { background: var(--bg-muted); color: #93C5FD; }
[data-theme="dark"] .apr-score-summary-grade.apr-grade-big--green  { background: rgba(22,163,74,.14); color: #86EFAC; }
[data-theme="dark"] .apr-score-summary-grade.apr-grade-big--blue   { background: rgba(37,99,235,.16); color: #93C5FD; }
[data-theme="dark"] .apr-score-summary-grade.apr-grade-big--indigo { background: rgba(99,102,241,.16); color: #C7D2FE; }
[data-theme="dark"] .apr-score-summary-grade.apr-grade-big--orange { background: rgba(245,158,11,.16); color: #FCD34D; }
[data-theme="dark"] .apr-score-summary-grade.apr-grade-big--red    { background: rgba(239,68,68,.16); color: #FCA5A5; }

/* Increment block */
[data-theme="dark"] .apr-increment-block {
  background: var(--bg-card);
  border-color: var(--border-light);
  color: var(--text-primary);
}

/* Parameter-wise remarks section */
[data-theme="dark"] .apr-pw-remarks {
  background: var(--bg-card);
  border-color: var(--border-light);
  color: var(--text-primary);
}

/* ═══════════════════════════════════════════════════════════════════
   MOBILE RESPONSIVE — extra rules for internal Appraisal screens
   (≤ 600px). Builds on existing 600px block; only adds, never modifies.
   Print / report-PDF / signed letter CSS deliberately untouched.
   ═══════════════════════════════════════════════════════════════════ */
@media (max-width: 600px) {
  /* Appraisal sub-tabs scrollable */
  .apr-subtabs { overflow-x: auto; flex-wrap: nowrap; scrollbar-width: none; -ms-overflow-style: none; padding: 4px; gap: 4px; }
  .apr-subtabs::-webkit-scrollbar { display: none; }

  /* Appraisal cycle list — full-width cards */
  .apr-cycle-grid { grid-template-columns: 1fr !important; gap: 10px; }
  .apr-cycle { padding: 12px 12px; }
  .apr-cycle-body { gap: 8px; }
  .apr-cycle-pros { flex-wrap: wrap; gap: 6px; }
  .apr-cycle-h { font-size: 14px; }
  .apr-cycle-when { font-size: 11.5px; }

  /* Conduct / scoring grid → 1 col */
  .apr-crit-grid { grid-template-columns: 1fr !important; gap: 10px; }
  .apr-cond-criteria { gap: 10px; }
  .apr-cond-crit-info { flex-direction: column; align-items: flex-start; gap: 6px; }
  .apr-crit-head { flex-direction: column; align-items: flex-start; gap: 6px; }
  .apr-criteria { gap: 10px; }
  .apr-crit-mode { flex-wrap: wrap; gap: 6px; }
  .apr-crit-guide { flex-wrap: wrap; gap: 4px; }
  .apr-crit-guide-tag { font-size: 10.5px; padding: 3px 7px; }
  .apr-crit-weight { flex-wrap: wrap; }
  .apr-crit-info { flex-wrap: wrap; gap: 6px; }
  .apr-score-row-h,
  .apr-score-row-info,
  .apr-score-row-name { flex-wrap: wrap; gap: 6px; font-size: 12px; }

  /* Category weight table — scroll */
  .apr-cat-stats { grid-template-columns: 1fr 1fr !important; gap: 6px; }
  .apr-cat-stat { padding: 8px 10px; }
  .apr-cat-head { flex-direction: column; align-items: flex-start; gap: 8px; padding: 12px; }
  .apr-cat-head-wrap { width: 100%; flex-wrap: wrap; gap: 8px; }
  .apr-cat-body { padding: 12px; }
  .apr-cat-h { font-size: 13.5px; }
  .apr-cat-desc { font-size: 11.5px; }

  /* Eligibility grid */
  .apr-elig-grid { grid-template-columns: 1fr !important; gap: 10px; }
  .apr-elig-control { width: 100%; }

  /* Setup grade & band lists */
  .apr-grade-head,
  .apr-grade-list,
  .apr-grade-meaning { flex-wrap: wrap; gap: 6px; font-size: 12px; }

  /* Report viewer toolbar (already partially handled — strengthen) */
  .apr-rv-toolbar { flex-wrap: wrap; gap: 8px; padding: 10px 12px; }
  .apr-rv-head { flex-direction: column; align-items: stretch; gap: 8px; padding: 12px; }
  .apr-rv-head-l, .apr-rv-head-r { width: 100%; flex-wrap: wrap; gap: 6px; }
  .apr-rv-footer { flex-direction: column; align-items: stretch; gap: 8px; padding: 12px; }
  .apr-rv-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .apr-rv-table table,
  .apr-rv-table thead,
  .apr-rv-table tbody,
  .apr-rv-table tr { min-width: 720px; }

  /* Frame stats */
  .apr-frame-stats { grid-template-columns: 1fr 1fr !important; gap: 8px; }

  /* Auto-info modal */
  .apr-auto-info-card { padding: 12px; }
  .apr-auto-info-bands { grid-template-columns: 1fr; gap: 8px; }
  .apr-auto-info-section { padding: 10px; }
  .apr-auto-info-body { padding: 12px; }
  .apr-auto-info-formula { font-size: 11px; word-break: break-word; }

  /* Filters strip — already 1-col via existing rule; tighten */
  .apr-filters { gap: 8px; padding: 10px; }
  .apr-search-input { font-size: 12.5px; }

  /* Hero block (current period overview) */
  .apr-hero { gap: 10px; padding: 14px; }
  .apr-hero-l, .apr-hero-r { width: 100%; }
  .apr-hero-grade { font-size: 26px; }
  .apr-hero-val { font-size: 18px; }
  .apr-hero-sub { font-size: 11.5px; }
  .apr-hero-elig { flex-wrap: wrap; gap: 6px; }

  /* Stickybar actions */
  .apr-stickybar-actions { flex-wrap: wrap; gap: 8px; padding: 10px; }
  .apr-stickybar-actions > * { flex: 1 1 auto; }

  /* Increment / bonus rows */
  .apr-increment-row { flex-wrap: wrap; gap: 8px; }
  .apr-increment-block { padding: 12px; }
  .apr-bonus-input { width: 100%; }

  /* PF + Setup cards */
  .apr-pf-card,
  .apr-setup-card { padding: 14px 12px; }
  .apr-pf-head,
  .apr-setup-head { flex-wrap: wrap; gap: 8px; }

  /* Detail grid */
  .apr-detail-grid { grid-template-columns: 1fr !important; gap: 8px; }

  /* Emp readout row */
  .apr-emp-readout-row { flex-wrap: wrap; gap: 6px; }

  /* Staff list cards */
  .apr-staff-list { gap: 8px; }

  /* View-row layouts */
  .apr-view-band-row,
  .apr-view-reward-grid { grid-template-columns: 1fr !important; gap: 8px; }
  .apr-view-row-name,
  .apr-view-row-remarks { font-size: 12px; }

  /* Report toolbar */
  .rpt-toolbar { flex-wrap: wrap; gap: 8px; padding: 10px 12px; }
  .rpt-toolbar > * { flex: 1 1 auto; }
  .rpt-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .rpt-table--compact { font-size: 11.5px; }

  /* Field grids */
  .apr-field-group { grid-template-columns: 1fr; }

  /* Modal head/body padding */
  .apr-final-remarks-input { font-size: 12.5px; }
  .apr-final-remarks-wrap { padding: 10px 12px; }

  /* Page header tightening */
  .page-header { flex-direction: column; align-items: stretch; gap: 10px; margin-bottom: 14px; }
  .page-title { font-size: 20px; }
  .page-title-icon { width: 40px; height: 40px; font-size: 17px; }
}

@media (max-width: 480px) {
  .apr-cat-stats { grid-template-columns: 1fr !important; }
  .apr-frame-stats { grid-template-columns: 1fr !important; }
  .apr-hero-grade { font-size: 22px; }
  .apr-rv-table tr { min-width: 620px; }
  .page-title { font-size: 18px; }
}
`;
