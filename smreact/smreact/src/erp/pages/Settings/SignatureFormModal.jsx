import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import {
  DOCUMENT_OPTIONS,
  SIGNATURE_STAFF_OPTIONS,
} from './settingsStore';

/* ═══════════════════════════════════════════════════════════════════
   SIGNATURE FORM MODAL — add or edit a staff signature
   ═══════════════════════════════════════════════════════════════════ */
export default function SignatureFormModal({ signature, onClose, onSave, toast }) {
  const isEdit = !!signature;
  const fileRef = useRef(null);

  const [staffId,      setStaffId]      = useState(signature?.staffId      || SIGNATURE_STAFF_OPTIONS[0]?.id || '');
  const [designation,  setDesignation]  = useState(signature?.designation  || '');
  const [title,        setTitle]        = useState(signature?.title        || '');
  const [status,       setStatus]       = useState(signature?.status       || 'active');
  const [imageDataUrl, setImageDataUrl] = useState(signature?.imageDataUrl || '');
  const [fileName,     setFileName]     = useState('');
  const [fileSize,     setFileSize]     = useState('');
  const [documents,    setDocuments]    = useState(signature?.documents || DOCUMENT_OPTIONS.map(d => d.id));
  const [touched,      setTouched]      = useState(false);

  /* Auto-fill designation from the staff dropdown when adding new. */
  useEffect(() => {
    if (isEdit) return;
    const s = SIGNATURE_STAFF_OPTIONS.find(x => x.id === Number(staffId));
    if (s && !designation) setDesignation(s.designation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId]);

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
    if (!staffId)            e.staffId     = 'Staff member is required';
    if (!designation.trim()) e.designation = 'Designation is required';
    if (!title.trim())       e.title       = 'Signature title is required';
    return e;
  }, [staffId, designation, title]);

  const hasErrors = Object.keys(errors).length > 0;

  /* Document checkbox helpers */
  const toggleDoc   = (id) => setDocuments(d => d.includes(id) ? d.filter(x => x !== id) : [...d, id]);
  const selectAll   = () => setDocuments(DOCUMENT_OPTIONS.map(d => d.id));
  const deselectAll = () => setDocuments([]);
  const allChecked  = documents.length === DOCUMENT_OPTIONS.length;

  /* Image upload — base64-encoded into state. 2 MB cap, image types only. */
  const onPickFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Please pick an image file', 'error'); return; }
    if (file.size > 2 * 1024 * 1024)     { toast('Image must be under 2 MB',  'error'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageDataUrl(e.target.result);
      setFileName(file.name);
      setFileSize(`${Math.round(file.size / 1024)} KB`);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = () => {
    setTouched(true);
    if (hasErrors) {
      toast('Please fix the highlighted fields', 'error');
      return;
    }
    const staff = SIGNATURE_STAFF_OPTIONS.find(s => s.id === Number(staffId));
    onSave({
      id:           signature?.id,
      staffId:      Number(staffId),
      staffName:    staff?.name || signature?.staffName || '',
      designation:  designation.trim(),
      title:        title.trim(),
      status,
      imageDataUrl,
      documents,
    });
  };

  return createPortal((
    <div
      className="settings-modal-back"
      role="dialog" aria-modal="true" aria-labelledby="settings-sig-form-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="settings-modal settings-modal--lg">
        <div className="settings-modal-head">
          <div className="settings-modal-head-l">
            <div className="settings-modal-icn">
              <i className={`fa-solid ${isEdit ? 'fa-pen' : 'fa-signature'}`} aria-hidden="true"></i>
            </div>
            <div>
              <div className="settings-modal-title" id="settings-sig-form-title">
                {isEdit ? 'Edit Signature' : 'Add Signature'}
              </div>
              <div className="settings-modal-sub">
                {isEdit ? `Updating "${signature.title}"` : 'Upload a new authorised signature'}
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
          <div className="settings-form-grid">
            {/* Row 1: staff + status */}
            <div className="settings-field">
              <label htmlFor="sig-staff">Staff Member <span className="settings-field-req">*</span></label>
              <select
                id="sig-staff"
                className={`settings-input${touched && errors.staffId ? ' has-error' : ''}`}
                value={staffId}
                onChange={(e) => setStaffId(Number(e.target.value))}
              >
                {SIGNATURE_STAFF_OPTIONS.map(s => (
                  <option key={s.id} value={s.id}>{s.name} · {s.designation}</option>
                ))}
              </select>
              {touched && errors.staffId && (
                <span className="settings-field-err">
                  <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i> {errors.staffId}
                </span>
              )}
            </div>
            <div className="settings-field">
              <label htmlFor="sig-status">Status</label>
              <select id="sig-status" className="settings-input" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Row 2: designation + title */}
            <div className="settings-field">
              <label htmlFor="sig-designation">Designation <span className="settings-field-req">*</span></label>
              <input
                id="sig-designation"
                type="text"
                className={`settings-input${touched && errors.designation ? ' has-error' : ''}`}
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Principal"
              />
              {touched && errors.designation && (
                <span className="settings-field-err">
                  <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i> {errors.designation}
                </span>
              )}
            </div>
            <div className="settings-field">
              <label htmlFor="sig-title">Signature Title <span className="settings-field-req">*</span></label>
              <input
                id="sig-title"
                type="text"
                className={`settings-input${touched && errors.title ? ' has-error' : ''}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Principal's Signature"
              />
              {touched && errors.title && (
                <span className="settings-field-err">
                  <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i> {errors.title}
                </span>
              )}
            </div>

            {/* Upload zone */}
            <div className="settings-field span2">
              <label>Signature Image</label>
              <span className="settings-field-helper">Transparent PNG recommended · Max 2 MB</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => onPickFile(e.target.files?.[0])}
              />
              {imageDataUrl ? (
                <div className="settings-upload-result">
                  <div className="settings-upload-thumb">
                    <img src={imageDataUrl} alt="Signature preview" />
                  </div>
                  <div className="settings-upload-info">
                    <div className="settings-upload-name">{fileName || 'Uploaded signature'}</div>
                    <div className="settings-upload-meta">{fileSize || 'Image ready to save'}</div>
                  </div>
                  <Tooltip text="Remove uploaded signature image">
                    <button
                      type="button"
                      className="settings-upload-remove"
                      onClick={() => { setImageDataUrl(''); setFileName(''); setFileSize(''); }}
                    >
                      <i className="fa-solid fa-trash-can" aria-hidden="true"></i> Remove
                    </button>
                  </Tooltip>
                </div>
              ) : (
                <Tooltip text="Click to upload or drag & drop a signature image (PNG · Max 2 MB)">
                  <button
                    type="button"
                    className="settings-upload"
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const f = e.dataTransfer.files?.[0];
                      onPickFile(f);
                    }}
                  >
                    <div className="settings-upload-ic">
                      <i className="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i>
                    </div>
                    <div className="settings-upload-title">Click to upload or drag &amp; drop</div>
                    <div className="settings-upload-sub">Transparent PNG recommended · Max 2 MB</div>
                  </button>
                </Tooltip>
              )}
            </div>

            {/* Document checkboxes */}
            <div className="settings-field span2">
              <label>Where can this signature be used?</label>
              <span className="settings-field-helper">Pick the documents this signature is authorised for.</span>
              <div className="settings-checks-head">
                <span className="settings-field-helper">
                  <b style={{ color: '#1E3A8A' }}>{documents.length}</b> / {DOCUMENT_OPTIONS.length} selected
                </span>
                <Tooltip text={allChecked ? 'Clear every selected document' : 'Select every available document'}>
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
                {DOCUMENT_OPTIONS.map(d => (
                  <label className="settings-check" key={d.id}>
                    <input
                      type="checkbox"
                      checked={documents.includes(d.id)}
                      onChange={() => toggleDoc(d.id)}
                    />
                    {d.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="settings-modal-foot settings-modal-foot--split">
          <div className="settings-foot-note">
            <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
            <span>Signatures created here can be selected in reports, certificates, and letters across the ERP.</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Tooltip text="Discard changes and close">
              <button type="button" className="settings-btn settings-btn-ghost" onClick={onClose}>Cancel</button>
            </Tooltip>
            <Tooltip text={isEdit ? 'Save updates to this signature' : 'Add this signature'}>
              <button type="button" className="settings-btn settings-btn-primary" onClick={onSubmit}>
                <i className="fa-solid fa-floppy-disk" aria-hidden="true"></i> Save Signature
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  ), document.body);
}
