/* Reusable placeholder for modules that ship in a later build. Driven by
   COMING_SOON_MODULES config so every not-yet-built module looks consistent. */
export default function ComingSoon({ title, sub, icon, grad, emptySub }) {
  return (
    <>
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon" style={{ background: grad }}><i className={`fa-solid ${icon}`} /></div>
          <div>
            <div className="page-title">{title}</div>
            <div className="page-sub">{sub}</div>
          </div>
        </div>
        <div className="page-actions">
          <button className="tut-btn"><i className="fa-solid fa-circle-play" /> Watch Tutorial</button>
        </div>
      </div>

      <div className="empty-state">
        <div className="empty-icon"><i className={`fa-solid ${icon}`} /></div>
        <div className="empty-title">{title} Module</div>
        <div className="empty-sub">{emptySub}</div>
        <div className="empty-badge"><i className="fa-solid fa-clock" /> Coming in Next Build</div>
      </div>
    </>
  )
}
