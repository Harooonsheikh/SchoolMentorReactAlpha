import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import SignatureFormModal from './SignatureFormModal';
import SignaturePreviewModal from './SignaturePreviewModal';
import {
  DOCUMENT_OPTIONS,
  useSettings,
} from './settingsStore';

/* ═══════════════════════════════════════════════════════════════════
   SIGNATURE MANAGEMENT — info banner, filter bar, table, modals
   ═══════════════════════════════════════════════════════════════════ */
export default function SignatureManagement({ toast }) {
  const { signatures, signaturesLoading, upsertSignature, deleteSignature, toggleSignatureStatus } = useSettings();

  const [search,    setSearch]    = useState('');
  const [fStatus,   setFStatus]   = useState('all');
  const [formCfg,   setFormCfg]   = useState(null);   // { signature? }
  const [previewItem, setPreviewItem] = useState(null);
  const [deleteItem,  setDeleteItem]  = useState(null);

  const filtered = useMemo(() => signatures.filter(s => {
    if (fStatus !== 'all' && s.status !== fStatus) return false;
    const q = search.trim().toLowerCase();
    if (q) {
      const hay = `${s.staffName} ${s.title} ${s.designation} ${s.department}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [signatures, search, fStatus]);

  const docName = (id) => DOCUMENT_OPTIONS.find(d => d.id === id)?.label || id;
  const initialsOf = (name) => name.split(' ').filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 2);

  const handleDeleteConfirm = async () => {
    if (!deleteItem) return;
    const item = deleteItem;
    setDeleteItem(null);
    const { ok, message } = await deleteSignature(item.id);
    toast(message, ok ? 'success' : 'error');
  };

  return (
    <>
      {/* ── Info banner ── */}
      <div className="settings-banner">
        <div className="settings-banner-ic">
          <i className="fa-solid fa-signature" aria-hidden="true"></i>
        </div>
        <div className="settings-banner-body">
          Upload authorised signatures once and reuse them across reports, result cards, certificates, HR letters, and appraisal documents. Use a <b>transparent PNG</b> for best print quality.
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="settings-filters">
        <div className="settings-search">
          <i className="fa-solid fa-magnifying-glass settings-search-ic" aria-hidden="true"></i>
          <input
            type="text"
            className="settings-search-input"
            placeholder="Search by staff name or title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search signatures"
          />
          {search && (
            <Tooltip text="Clear search">
              <button type="button" className="settings-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                <i className="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </Tooltip>
          )}
        </div>
        <select
          className="settings-select"
          value={fStatus}
          onChange={(e) => setFStatus(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="all">All status</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
        <Tooltip text="Add a new authorised signature">
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={() => setFormCfg({})}
          >
            <i className="fa-solid fa-plus" aria-hidden="true"></i> Add Signature
          </button>
        </Tooltip>
      </div>

      {/* ── Table ── */}
      {signaturesLoading ? (
        <div className="settings-empty">
          <div className="settings-empty-ic"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i></div>
          <div className="settings-empty-title">Loading signatures…</div>
          <div className="settings-empty-sub">Fetching authorised signatures for this branch.</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="settings-empty">
          <div className="settings-empty-ic"><i className="fa-solid fa-pen-nib" aria-hidden="true"></i></div>
          <div className="settings-empty-title">
            {signatures.length === 0 ? 'No signatures yet' : 'No signatures match this filter'}
          </div>
          <div className="settings-empty-sub">
            {signatures.length === 0
              ? 'Click "Add Signature" above to upload your first one.'
              : 'Try clearing the search or status filter.'}
          </div>
        </div>
      ) : (
        <div className="settings-table">
          <div className="settings-table-head" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr 90px 90px 90px 160px' }}>
            <div className="th">Staff</div>
            <div className="th">Department</div>
            <div className="th">Designation</div>
            <div className="th">Title</div>
            <div className="th c">Preview</div>
            <div className="th c">Documents</div>
            <div className="th c">Status</div>
            <div className="th c">Actions</div>
          </div>
          {filtered.map(s => (
            <div key={s.id} className="settings-table-row" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr 90px 90px 90px 160px' }}>
              <div className="td settings-emp">
                <div className="settings-avatar">{initialsOf(s.staffName)}</div>
                <div className="settings-emp-text">
                  <div className="settings-emp-name">{s.staffName}</div>
                  <div className="settings-emp-meta">{s.department || '—'}</div>
                </div>
              </div>
              <div className="td">{s.department || '—'}</div>
              <div className="td">{s.designation || '—'}</div>
              <div className="td"><em style={{ color: '#64748B' }}>{s.title}</em></div>
              <div className="td c">
                <div className="settings-sig-preview">
                  {s.imageDataUrl
                    ? <img src={s.imageDataUrl} alt={`${s.title} preview`} />
                    : 'No preview'}
                </div>
              </div>
              <div className="td c">
                <Tooltip text={s.documents.length ? s.documents.map(docName).join(' · ') : 'No documents selected'}>
                  <span className="settings-badge settings-badge--blue">{s.documents.length} docs</span>
                </Tooltip>
              </div>
              <div className="td c">
                <span className={`settings-badge settings-badge--${s.status === 'active' ? 'green' : 'gray'}`}>
                  <i className={`fa-solid ${s.status === 'active' ? 'fa-circle-check' : 'fa-circle-minus'}`} aria-hidden="true"></i>
                  {s.status === 'active' ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="td c settings-actions">
                <Tooltip text="View signature">
                  <button className="settings-act" onClick={() => setPreviewItem(s)} aria-label="View signature">
                    <i className="fa-solid fa-eye" aria-hidden="true"></i>
                  </button>
                </Tooltip>
                <Tooltip text="Edit signature">
                  <button className="settings-act" onClick={() => setFormCfg({ signature: s })} aria-label="Edit signature">
                    <i className="fa-solid fa-pen" aria-hidden="true"></i>
                  </button>
                </Tooltip>
                <Tooltip text={s.status === 'active' ? 'Deactivate' : 'Activate'}>
                  <button
                    className="settings-act"
                    onClick={() => {
                      toggleSignatureStatus(s.id);
                      toast(s.status === 'active' ? 'Signature deactivated' : 'Signature activated', 'success');
                    }}
                    aria-label="Toggle status"
                  >
                    <i className={`fa-solid ${s.status === 'active' ? 'fa-toggle-on' : 'fa-toggle-off'}`} aria-hidden="true"></i>
                  </button>
                </Tooltip>
                <Tooltip text="Delete signature">
                  <button className="settings-act settings-act--danger" onClick={() => setDeleteItem(s)} aria-label="Delete signature">
                    <i className="fa-solid fa-trash" aria-hidden="true"></i>
                  </button>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {formCfg && (
        <SignatureFormModal
          signature={formCfg.signature}
          onClose={() => setFormCfg(null)}
          onSave={async (payload) => {
            const { ok, message } = await upsertSignature(payload);
            toast(message, ok ? 'success' : 'error');
            if (ok) setFormCfg(null);
          }}
          toast={toast}
        />
      )}
      {previewItem && (
        <SignaturePreviewModal
          signature={previewItem}
          onClose={() => setPreviewItem(null)}
          onEdit={() => {
            setFormCfg({ signature: previewItem });
            setPreviewItem(null);
          }}
        />
      )}
      {deleteItem && (
        <DeleteSigDialog
          signature={deleteItem}
          onCancel={() => setDeleteItem(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </>
  );
}

/* ─── Small delete-confirm dialog ─── */
function DeleteSigDialog({ signature, onCancel, onConfirm }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onCancel]);
  return createPortal((
    <div
      className="settings-modal-back"
      role="dialog" aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="settings-modal settings-modal--sm">
        <div className="settings-confirm-body">
          <div className="settings-confirm-ic settings-confirm-ic--red">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
          </div>
          <div className="settings-confirm-title">Delete Signature?</div>
          <div className="settings-confirm-text">
            This will permanently delete <b>"{signature.title}"</b> for <b>{signature.staffName}</b>. This cannot be undone.
          </div>
        </div>
        <div className="settings-modal-foot settings-modal-foot--center">
          <button type="button" className="settings-btn settings-btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="settings-btn settings-btn-danger" onClick={onConfirm}>
            <i className="fa-solid fa-trash" aria-hidden="true"></i> Delete
          </button>
        </div>
      </div>
    </div>
  ), document.body);
}
