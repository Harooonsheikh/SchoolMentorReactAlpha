import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/* ═══════════════════════════════════════════════════════════════════
   DOWNLOAD REPORT — style (Colorful / Colorless) aur format (PDF /
   Word) chunne wala modal. ERP ke LpReportPicker ka hu-ba-hu port.

   Har PDF/Word button pehle yahi kholta hai; `cfg` me report ka naam
   aur default style/format aata hai, `onGenerate(style, fmt)` par
   asal report banti hai (dekhein lessonPlanReports.js).
   ═══════════════════════════════════════════════════════════════════ */

export default function LpReportPicker({ cfg, busy, onClose, onGenerate }) {
  const [style, setStyle] = useState('color')
  const [fmt, setFmt] = useState('pdf')

  useEffect(() => {
    if (!cfg) return
    setStyle(cfg.style || 'color')
    setFmt(cfg.format || 'pdf')
  }, [cfg])

  if (!cfg) return null

  /* Keyboard radio-group nav — baqi pickers jaisa hi affordance. */
  const onStyleKey = (e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setStyle(e.currentTarget.dataset.value) }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setStyle('color') }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw') }
  }

  return createPortal(
    <div
      className="lp-overlay open"
      style={{ zIndex: 6200 }}
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lp-rp-title"
    >
      <div className="lp-modal" style={{ maxWidth: 460 }}>
        <div className="lp-modal-header">
          <div className="lp-modal-title-row">
            <div className="lp-modal-icon"><i className="fa-solid fa-print" /></div>
            <div>
              <div className="lp-modal-title" id="lp-rp-title">Download Report</div>
              <div className="lp-modal-sub">{cfg.name} — Choose style and format</div>
            </div>
          </div>
          <button className="lp-modal-close" title="Close" onClick={onClose} aria-label="Close download dialog" disabled={busy}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="lp-modal-body">
          <div className="rp-options" role="radiogroup" aria-label="Report style">
            <div
              className={`rp-option${style === 'color' ? ' selected' : ''}`}
              data-value="color"
              onClick={() => setStyle('color')}
              role="radio"
              aria-checked={style === 'color'}
              tabIndex={style === 'color' ? 0 : -1}
              onKeyDown={onStyleKey}
            >
              <div className="rp-check" aria-hidden="true"><i className="fa-solid fa-check" /></div>
              <div className="rp-preview" aria-hidden="true">
                <div className="rp-preview-color">
                  <div className="rp-mock-header" />
                  <div className="rp-mock-line" style={{ width: '65%', height: 5 }} />
                  <div className="rp-mock-line" style={{ width: '50%', height: 5 }} />
                </div>
              </div>
              <div className="rp-option-text">
                <div className="rp-option-name">
                  <i className="fa-solid fa-palette" style={{ color: '#1E40AF', marginRight: 6 }} />Colorful Report
                </div>
                <div className="rp-option-desc">Branded headings, summary cards &amp; color tags</div>
              </div>
            </div>

            <div
              className={`rp-option${style === 'bw' ? ' selected' : ''}`}
              data-value="bw"
              onClick={() => setStyle('bw')}
              role="radio"
              aria-checked={style === 'bw'}
              tabIndex={style === 'bw' ? 0 : -1}
              onKeyDown={onStyleKey}
            >
              <div className="rp-check" aria-hidden="true"><i className="fa-solid fa-check" /></div>
              <div className="rp-preview" aria-hidden="true">
                <div className="rp-preview-bw">
                  <div className="rp-mock-header-bw" />
                  <div className="rp-mock-line-bw" style={{ width: '65%', height: 5 }} />
                  <div className="rp-mock-line-bw" style={{ width: '50%', height: 5 }} />
                </div>
              </div>
              <div className="rp-option-text">
                <div className="rp-option-name">
                  <i className="fa-solid fa-circle-half-stroke" style={{ marginRight: 6 }} />Colorless Report
                </div>
                <div className="rp-option-desc">Low-ink layout — white background, light borders only</div>
              </div>
            </div>
          </div>

          <div className="rp-format-row" style={{ marginTop: 8 }}>
            <button className={`rp-format-pill${fmt === 'pdf' ? ' selected-pdf' : ''}`} onClick={() => setFmt('pdf')}>
              <div className="rp-format-icon"><i className="fa-solid fa-file-pdf" /></div>
              <div>
                <div className="rp-format-name">PDF</div>
                <div className="rp-format-desc">Best for sharing</div>
              </div>
            </button>
            <button className={`rp-format-pill${fmt === 'word' ? ' selected-word' : ''}`} onClick={() => setFmt('word')}>
              <div className="rp-format-icon"><i className="fa-brands fa-microsoft" /></div>
              <div>
                <div className="rp-format-name">Word (.docx)</div>
                <div className="rp-format-desc">Best for editing</div>
              </div>
            </button>
          </div>
        </div>

        <div className="lp-modal-footer">
          <button className="lp-btn ghost" title="Cancel and close" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="lp-btn primary" title="Download the selected report" onClick={() => onGenerate(style, fmt)} disabled={busy}>
            <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-download'}`} />{' '}
            {busy ? 'Preparing…' : `Download ${style === 'color' ? 'Colorful' : 'Colorless'} ${fmt.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
