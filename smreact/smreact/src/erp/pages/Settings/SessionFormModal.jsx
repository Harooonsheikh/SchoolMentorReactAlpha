import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import { MODULE_OPTIONS } from './settingsStore';

/* ═══════════════════════════════════════════════════════════════════
   SESSION FORM MODAL — create or edit an academic session
   ═══════════════════════════════════════════════════════════════════ */
export default function SessionFormModal({ session, existingCurrent, onClose, onSave, toast }) {
  const isEdit = !!session;

  const [name,      setName]      = useState(session?.name      || '');
  const [status,    setStatus]    = useState(session?.status    || 'upcoming');
  const [startDate, setStartDate] = useState(session?.startDate || '');
  const [endDate,   setEndDate]   = useState(session?.endDate   || '');
  const [notes,     setNotes]     = useState(session?.notes     || '');
  const [modules,   setModules]   = useState(session?.modules   || MODULE_OPTIONS.map(m => m.id));
  const [touched,   setTouched]   = useState(false);

  /* Esc + scroll lock */
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const errors = useMemo(() => {
    const e = {};
    if (!name.trim())   e.name      = 'Session name is required';
    if (!startDate)     e.startDate = 'Start date is required';
    if (!endDate)       e.endDate   = 'End date is required';
    if (startDate && endDate && endDate < startDate) e.endDate = 'End date must be after start date';
    if (modules.length === 0) e.modules = 'Pick at least one module';
    return e;
  }, [name, startDate, endDate, modules]);

  const hasErrors = Object.keys(errors).length > 0;

  /* Module checkbox handlers */
  const toggleModule = (id) => setModules(m => m.includes(id) ? m.filter(x => x !== id) : [...m, id]);
  const selectAll   = () => setModules(MODULE_OPTIONS.map(m => m.id));
  const deselectAll = () => setModules([]);
  const allChecked  = modules.length === MODULE_OPTIONS.length;

  const onSubmit = () => {
    setTouched(true);
    if (hasErrors) {
      toast('Please fix the highlighted fields', 'error');
      return;
    }
    onSave({
      id:        session?.id,
      name:      name.trim(),
      status,
      startDate,
      endDate,
      notes:     notes.trim(),
      modules,
      locked:    session?.locked || false,
    });
  };

  /* When the user picks "Current" while another session is already
     current, show a small warning so they know what will happen. */
  const willReplaceCurrent = status === 'current'
    && existingCurrent
    && existingCurrent.id !== session?.id;

  return createPortal((
    <div
      className="settings-modal-back"
      role="dialog" aria-modal="true" aria-labelledby="settings-session-form-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="settings-modal">
        <div className="settings-modal-head">
          <div className="settings-modal-head-l">
            <div className="settings-modal-icn">
              <i className={`fa-solid ${isEdit ? 'fa-pen' : 'fa-plus'}`} aria-hidden="true"></i>
            </div>
            <div>
              <div className="settings-modal-title" id="settings-session-form-title">
                {isEdit ? 'Edit Academic Session' : 'Create Academic Session'}
              </div>
              <div className="settings-modal-sub">
                {isEdit ? `Updating "${session.name}"` : 'Add a new academic year to the ERP'}
              </div>
            </div>
          </div>
          <Tooltip text="Close (Esc)">
            <button className="settings-modal-x" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>

        <div className="settings-modal-body">
          {/* Row 1: name + status */}
          <div className="settings-form-grid">
            <div className="settings-field">
              <label htmlFor="ses-name">Session Name <span className="settings-field-req">*</span></label>
              <input
                id="ses-name"
                type="text"
                className={`settings-input${touched && errors.name ? ' has-error' : ''}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 2025–2026"
              />
              {touched && errors.name && (
                <span className="settings-field-err">
                  <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i> {errors.name}
                </span>
              )}
            </div>
            <div className="settings-field">
              <label htmlFor="ses-status">Status</label>
              <select id="ses-status" className="settings-input" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="upcoming">Upcoming</option>
                <option value="current">Current</option>
                <option value="past">Past</option>
              </select>
            </div>

            {/* Row 2: dates */}
            <div className="settings-field">
              <label htmlFor="ses-start">Start Date <span className="settings-field-req">*</span></label>
              <input
                id="ses-start"
                type="date"
                className={`settings-input${touched && errors.startDate ? ' has-error' : ''}`}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              {touched && errors.startDate && (
                <span className="settings-field-err">
                  <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i> {errors.startDate}
                </span>
              )}
            </div>
            <div className="settings-field">
              <label htmlFor="ses-end">End Date <span className="settings-field-req">*</span></label>
              <input
                id="ses-end"
                type="date"
                className={`settings-input${touched && errors.endDate ? ' has-error' : ''}`}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
              />
              {touched && errors.endDate && (
                <span className="settings-field-err">
                  <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i> {errors.endDate}
                </span>
              )}
            </div>

            {/* Row 3: notes */}
            <div className="settings-field span2">
              <label htmlFor="ses-notes">Notes (optional)</label>
              <textarea
                id="ses-notes"
                className="settings-textarea"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything notable about this session — exam schedules, calendar references, etc."
              />
            </div>

            {/* Warning when status = Current and an existing current exists */}
            {willReplaceCurrent && (
              <div className="settings-field span2">
                <div className="settings-alert">
                  <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                  <span>Setting this as current will change the existing current session
                  ("{existingCurrent.name}"). Modules already in use will switch to this session on save.</span>
                </div>
              </div>
            )}

            {/* Applicable Modules */}
            <div className="settings-field span2">
              <label>Applicable Modules <span className="settings-field-req">*</span></label>
              <span className="settings-field-helper">Select which modules this session applies to.</span>
              <div className="settings-checks-head">
                <span className="settings-field-helper">
                  <b style={{ color: '#1E3A8A' }}>{modules.length}</b> / {MODULE_OPTIONS.length} selected
                </span>
                <Tooltip text={allChecked ? 'Clear every selected module' : 'Select every available module'}>
                  <button
                    type="button"
                    className="settings-checks-toggle"
                    onClick={allChecked ? deselectAll : selectAll}
                  >
                    <i className={`fa-solid ${allChecked ? 'fa-square' : 'fa-square-check'}`} style={{ marginRight: 5 }}></i>
                    {allChecked ? 'Deselect All' : 'Select All'}
                  </button>
                </Tooltip>
              </div>
              <div className="settings-checks">
                {MODULE_OPTIONS.map(m => (
                  <label className="settings-check" key={m.id}>
                    <input
                      type="checkbox"
                      checked={modules.includes(m.id)}
                      onChange={() => toggleModule(m.id)}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
              {touched && errors.modules && (
                <span className="settings-field-err">
                  <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i> {errors.modules}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="settings-modal-foot">
          <Tooltip text="Discard changes and close">
            <button type="button" className="settings-btn settings-btn-ghost" onClick={onClose}>Cancel</button>
          </Tooltip>
          <Tooltip text={isEdit ? 'Save updates to this session' : 'Create this academic session'}>
            <button type="button" className="settings-btn settings-btn-primary" onClick={onSubmit}>
              <i className="fa-solid fa-floppy-disk" aria-hidden="true"></i> Save Session
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  ), document.body);
}
