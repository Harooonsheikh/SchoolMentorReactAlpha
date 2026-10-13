import { createPortal } from 'react-dom'
import SpinnerButton from '../../components/SpinnerButton'

/* Small shared confirm dialog for the Examination tabs (delete, etc.).
   onConfirm async ho sakta hai — SpinnerButton us ke dauran spinner dikhata
   hai aur double-click rokta hai (exam delete API call ke liye). */
export default function ExamConfirm({ title, body, confirmLabel = 'Delete', tone = 'danger', onCancel, onConfirm }) {
  return createPortal(
    <div className="exm-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="exm-modal sm" role="alertdialog" aria-modal="true">
        <div className="exm-modal-body">
          <div className={`exm-confirm-icon ${tone}`}><i className={`fa-solid ${tone === 'danger' ? 'fa-triangle-exclamation' : 'fa-circle-question'}`} /></div>
          <h2 className="exm-confirm-title">{title}</h2>
          <p className="exm-confirm-body">{body}</p>
        </div>
        <div className="exm-modal-foot">
          <span />
          <div className="exm-foot-btns">
            <button type="button" className="exm-btn ghost" onClick={onCancel}>Cancel</button>
            <SpinnerButton className={`exm-btn ${tone === 'danger' ? 'danger' : 'primary'}`} onClick={onConfirm}>{confirmLabel}</SpinnerButton>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
