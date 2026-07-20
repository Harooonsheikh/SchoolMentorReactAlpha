import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { NAV_BY_PATH } from '../config/nav'
import { tutorialFor } from '../config/tutorials'

/* Tutorial button — drop into any module's page header. Opens a modal that
   shows one video per main tab of the current module. */
export default function TutorialButton({ label = 'Tutorial' }) {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const tut = tutorialFor(pathname)
  const moduleName = NAV_BY_PATH[pathname]?.label || 'Module'
  return (
    <>
      <button className="hdr-tut-btn" onClick={() => setOpen(true)} title={`Watch ${moduleName} tutorials`}>
        <i className="fa-solid fa-circle-play" /> {label}
      </button>
      {open && <TutorialModal moduleName={moduleName} icon={tut.icon} videos={tut.videos} onClose={() => setOpen(false)} />}
    </>
  )
}

function TutorialModal({ moduleName, icon, videos, onClose }) {
  const [playing, setPlaying] = useState(null) // index currently playing
  return createPortal(
    <div className="tut-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="tut-modal">
        <div className="tut-hdr">
          <div className="tut-hdr-ic"><i className={`fa-solid ${icon}`} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="tut-hdr-title">{moduleName} Tutorials</div>
            <div className="tut-hdr-sub">{videos.length} video{videos.length !== 1 ? 's' : ''} · one per section</div>
          </div>
          <button className="tut-x" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
        </div>

        <div className="tut-body">
          {videos.map((vid, i) => (
            <div className="tut-vid-card" key={i}>
              <div className="tut-vid-head"><span className="tut-vid-no">{i + 1}</span> {vid.tab}</div>
              <div className="tut-vid-frame-wrap">
                {playing === i ? (
                  <iframe
                    className="tut-vid-frame"
                    src={`${vid.url}${vid.url.includes('?') ? '&' : '?'}autoplay=1&rel=0`}
                    title={vid.tab}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <button className="tut-vid-thumb" onClick={() => setPlaying(i)}>
                    <span className="tut-play-btn"><i className="fa-solid fa-play" /></span>
                    <span className="tut-vid-thumb-txt">Play “{vid.tab}” tutorial</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="tut-foot">
          <span className="tut-foot-note"><i className="fa-brands fa-youtube" style={{ color: '#dc2626' }} /> Tutorial videos</span>
          <button className="btn-primary" onClick={onClose}><i className="fa-solid fa-check" /> Close</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
