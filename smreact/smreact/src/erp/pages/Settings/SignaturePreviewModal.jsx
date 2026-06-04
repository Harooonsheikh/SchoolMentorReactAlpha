import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import { DOCUMENT_OPTIONS } from './settingsStore';

/* ═══════════════════════════════════════════════════════════════════
   SIGNATURE PREVIEW MODAL — read-only signature display
   ═══════════════════════════════════════════════════════════════════ */
export default function SignaturePreviewModal({ signature, onClose, onEdit }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!signature) return null;
  const docName = (id) => DOCUMENT_OPTIONS.find(d => d.id === id)?.label || id;
  const initialsOf = (name) => name.split(' ').filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 2);

  return createPortal((
    <div
      className="settings-modal-back"
      role="dialog" aria-modal="true" aria-labelledby="settings-sig-preview-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="settings-modal">
        <div className="settings-modal-head">
          <div className="settings-modal-head-l">
            <div className="settings-modal-icn">
              <i className="fa-solid fa-signature" aria-hidden="true"></i>
            </div>
            <div>
              <div className="settings-modal-title" id="settings-sig-preview-title">{signature.title}</div>
              <div className="settings-modal-sub">{signature.staffName} · {signature.designation}</div>
            </div>
          </div>
          <Tooltip text="Close (Esc)">
            <button className="settings-modal-x" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>

        <div className="settings-modal-body">
          {/* Hero card with avatar + status */}
          <div className="settings-details-head">
            <div className="settings-avatar" style={{ width: 48, height: 48, fontSize: 14 }}>
              {initialsOf(signature.staffName)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="settings-details-title">{signature.staffName}</div>
              <div className="settings-details-sub">{signature.designation} · <em style={{ color: '#64748B' }}>{signature.title}</em></div>
            </div>
            <span className={`settings-badge settings-badge--${signature.status === 'active' ? 'green' : 'gray'}`}>
              <i className={`fa-solid ${signature.status === 'active' ? 'fa-circle-check' : 'fa-circle-minus'}`} aria-hidden="true"></i>
              {signature.status === 'active' ? 'Active' : 'Inactive'}
            </span>
          </div>

          {/* Signature image */}
          <div className={`settings-sig-large${signature.imageDataUrl ? '' : ' is-empty'}`}>
            {signature.imageDataUrl
              ? <img src={signature.imageDataUrl} alt={`${signature.title} signature`} />
              : <>
                  <i className="fa-solid fa-image" style={{ marginRight: 6 }} aria-hidden="true"></i>
                  No signature uploaded
                </>}
          </div>

          {/* Document chips */}
          <div className="settings-meta-grid">
            <div className="settings-meta-item span2">
              <span className="settings-meta-lbl">Applicable documents ({signature.documents.length})</span>
              <div className="settings-chip-list" style={{ marginTop: 6 }}>
                {signature.documents.length === 0
                  ? <em style={{ color: '#94A3B8' }}>No documents selected.</em>
                  : signature.documents.map(id => (
                      <span className="settings-chip" key={id}>
                        <i className="fa-solid fa-file-lines" aria-hidden="true"></i> {docName(id)}
                      </span>
                    ))}
              </div>
            </div>
          </div>

          {/* Usage note */}
          {signature.documents.length > 0 && signature.status === 'active' && (
            <div className="settings-sig-usage">
              <div className="settings-sig-usage-h">
                <i className="fa-solid fa-circle-check" aria-hidden="true" style={{ marginRight: 6 }}></i>
                Ready to use
              </div>
              <div className="settings-sig-usage-body">
                This signature is ready to be used in: <b>{signature.documents.map(docName).join(', ')}</b>.
              </div>
            </div>
          )}
        </div>

        <div className="settings-modal-foot">
          <Tooltip text="Close this preview">
            <button type="button" className="settings-btn settings-btn-ghost" onClick={onClose}>Close</button>
          </Tooltip>
          <Tooltip text="Open the edit form for this signature">
            <button type="button" className="settings-btn settings-btn-primary" onClick={onEdit}>
              <i className="fa-solid fa-pen" aria-hidden="true"></i> Edit Signature
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  ), document.body);
}
