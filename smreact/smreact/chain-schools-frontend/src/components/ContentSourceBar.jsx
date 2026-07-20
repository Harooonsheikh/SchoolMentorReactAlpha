import { useState } from 'react'
import { createPortal } from 'react-dom'
import './ContentSourceBar.css'

/* Chain-level toggle: show School Mentor's official library to all schools,
   or the head office's own uploads. Switching is confirmed because it
   changes what every school in the chain sees. */
export default function ContentSourceBar({ kind, label, value, onChange }) {
  const [pending, setPending] = useState(null) // 'mentor' | 'custom'
  const isMentor = value === 'mentor'
  const low = label.toLowerCase()

  const confirmCopy = pending === 'mentor'
    ? { title: `Switch to School Mentor's ${label}?`, icon: 'fa-building-columns', accent: '#16a34a',
        body: `All schools in your chain will start seeing School Mentor's official ${low} instead of your own. Anything you uploaded here stays saved, but will be hidden from your schools until you switch back.`,
        btn: 'Use School Mentor', btnCls: 'btn-success' }
    : { title: `Switch to your own ${label}?`, icon: 'fa-pen-to-square', accent: '#1E3A8A',
        body: `All schools in your chain will start seeing the ${low} you upload and manage here, instead of School Mentor's official library.`,
        btn: 'Use Our Own', btnCls: 'btn-primary' }

  return (
    <>
      <div className={`cs-bar${isMentor ? ' mentor' : ''}`}>
        <div className="cs-bar-left">
          <div className="cs-bar-icon"><i className={`fa-solid ${isMentor ? 'fa-building-shield' : 'fa-user-pen'}`} /></div>
          <div style={{ minWidth: 0 }}>
            <div className="cs-bar-title">{label} Source <span className="cs-bar-tag">{isMentor ? 'School Mentor' : 'Your Own'}</span></div>
            <div className="cs-bar-desc">
              {isMentor
                ? `Your schools are seeing School Mentor's official ${low}. Switch to “Custom” to upload and manage your own.`
                : `Your schools are seeing the ${low} you upload and manage here. Switch to “School Mentor” to use the official library instead.`}
            </div>
          </div>
        </div>
        <div className="cs-seg">
          <button className={`cs-seg-btn${isMentor ? ' active mentor' : ''}`} onClick={() => { if (!isMentor) setPending('mentor') }}><i className="fa-solid fa-building-columns" /> School Mentor</button>
          <button className={`cs-seg-btn${!isMentor ? ' active' : ''}`} onClick={() => { if (isMentor) setPending('custom') }}><i className="fa-solid fa-pen-to-square" /> Custom (Your Own)</button>
        </div>
      </div>

      {pending && createPortal(
        <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) setPending(null) }}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-body" style={{ textAlign: 'center', padding: '38px 30px' }}>
              <div className="confirm-icon" style={{ background: `${confirmCopy.accent}1a`, border: `2px solid ${confirmCopy.accent}40`, color: confirmCopy.accent }}><i className={`fa-solid ${confirmCopy.icon}`} /></div>
              <div className="confirm-title">{confirmCopy.title}</div>
              <div className="confirm-sub">{confirmCopy.body}</div>
              <div className="confirm-btns">
                <button className="btn-secondary" onClick={() => setPending(null)}>Cancel</button>
                <button className={confirmCopy.btnCls} onClick={() => { onChange(pending); setPending(null) }}><i className={`fa-solid ${confirmCopy.icon}`} /> {confirmCopy.btn}</button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
