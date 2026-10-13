import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import TutorialButton from '../../components/TutorialButton'
import { loadExam, saveExam } from './examStore'
import AddTermTab from './AddTermTab'
import AddExamTab from './AddExamTab'
import AddResultTab from './AddResultTab'
import './Examination.css'

/* ═══════════════════════════════════════════════════════════════════
   Examination — Head Office module, redesigned to mirror the School
   Mentor ERP. Three tabs: Add Term · Add Exam · Add Result.
   Everything persists to localStorage via examStore.
   ═══════════════════════════════════════════════════════════════════ */
const TABS = [
  { key: 'terms', label: 'Add Term', icon: 'fa-layer-group' },
  { key: 'exams', label: 'Add Exam', icon: 'fa-file-signature' },
  { key: 'result', label: 'Add Result', icon: 'fa-chart-bar' },
]

export default function Examination() {
  const [tab, setTab] = useState('terms')
  const [store, setStore] = useState(loadExam)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const flash = (text, type = 'success') => setToast({ type, text })
  const commit = (next) => { saveExam(next); setStore(next) }

  return (
    <>
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon"><i className="fa-solid fa-file-signature" /></div>
          <div>
            <h1 className="page-title">Examination</h1>
            <p className="page-sub">Set up academic terms, create exams per term, and configure the result card — grades, signatures and final remarks.</p>
          </div>
        </div>
        <div className="page-header-actions">
          <TutorialButton />
        </div>
      </div>

      <div className="exm-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={`exm-tab${tab === t.key ? ' on' : ''}`} onClick={() => setTab(t.key)}>
            <i className={`fa-solid ${t.icon}`} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'terms' && <AddTermTab store={store} commit={commit} flash={flash} />}
      {tab === 'exams' && <AddExamTab store={store} commit={commit} flash={flash} />}
      {tab === 'result' && <AddResultTab store={store} commit={commit} flash={flash} />}

      {toast && createPortal(
        <div className="exm-toast-wrap" role="status" aria-live="polite">
          <div className={`exm-toast ${toast.type}`}>
            <i className={`fa-solid ${toast.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`} /> {toast.text}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
