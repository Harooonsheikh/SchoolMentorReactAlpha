import { useEffect, useState } from 'react'
import { useNetworkMenuPerms } from '../../api/networkMenuPermissionsApi'
import { createPortal } from 'react-dom'
import TutorialButton from '../../components/TutorialButton'
import { loadExam, saveExam } from './examStore'
import { currentNetworkId, fetchNetworkAcademics } from '../../api/academicsSetupApi'
import { buildAcademicStructure, mirrorAcademicStructure } from '../../config/academicsStore'
import AddTermTab from './AddTermTab'
import AddExamTab from './AddExamTab'
import AddResultTab from './AddResultTab'
import './Examination.css'

/* ═══════════════════════════════════════════════════════════════════
   Examination — Head Office module, redesigned to mirror the School
   Mentor ERP. Three tabs: Term Setup · Exam Setup · Result Setup.
   (Term Breakup lives under Academics now.)
   Everything persists to localStorage via examStore.
   ═══════════════════════════════════════════════════════════════════ */
const TABS = [
  { key: 'terms', label: 'Term Setup', icon: 'fa-layer-group' },
  { key: 'exams', label: 'Exam Setup', icon: 'fa-file-signature' },
  { key: 'result', label: 'Result Setup', icon: 'fa-chart-bar' },
]

export default function Examination() {
  const { can, ready } = useNetworkMenuPerms()
  const allow = (screen, action) => can('Examination', screen, action)
  const tabs = TABS.filter((t) => allow(t.label, 'View'))
  const [tab, setTab] = useState('terms')
  const [store, setStore] = useState(loadExam)
  const [toast, setToast] = useState(null)
  const [, setClassSync] = useState(0) // classes mirror hone par re-render (dropdowns refresh)

  /* Classes har network ki asli (LaunchSetup API) honi chahiyen — pehle ye
     sirf Settings → Classes & Subjects khulne par sync hoti thi, is liye
     seedhe Examination par aane wale ko dummy seed (Nursery/KG…) dikhti thi.
     Ab mount par hi network ke grades/subjects la kar Academics store me
     mirror kar dete hain, taake Add Exam/Result/Breakup ke dropdown har
     network ke liye sahi classes dikhayen. API fail ho to local par chalti
     rahe (baqi examination module jaisa fallback). */
  useEffect(() => {
    const networkId = currentNetworkId()
    if (!networkId) return undefined
    let alive = true
    fetchNetworkAcademics(networkId)
      .then(({ classes, subjectRows }) => {
        if (!alive) return
        const { subjects, classSubjects } = buildAcademicStructure({ classes, subjectRows })
        mirrorAcademicStructure({ classes, subjects, classSubjects })
        setClassSync((v) => v + 1)
      })
      .catch(() => { /* API band → dummy/local fallback */ })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const flash = (text, type = 'success') => setToast({ type, text })
  const commit = (next) => { saveExam(next); setStore(next) }

  useEffect(() => {
    if (!tabs.length) return
    if (!tabs.some((t) => t.key === tab)) setTab(tabs[0].key)
  }, [tabs, tab])

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

      {!ready ? (
        <div className="exm-panel">
          <div className="exm-empty-inline">Loading examination access…</div>
        </div>
      ) : tabs.length === 0 ? (
        <div className="exm-panel">
          <div className="exm-empty">
            <div className="exm-empty-icon"><i className="fa-solid fa-lock" /></div>
            <h3>No examination access</h3>
            <p>Ask your head office to grant View on Term Setup, Exam Setup, or Result Setup.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="exm-tabs" role="tablist">
            {tabs.map((t) => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} className={`exm-tab${tab === t.key ? ' on' : ''}`} onClick={() => setTab(t.key)}>
                <i className={`fa-solid ${t.icon}`} /> {t.label}
              </button>
            ))}
          </div>

          {tab === 'terms' && (
            <AddTermTab store={store} commit={commit} flash={flash}
              canCreate={allow('Term Setup', 'Create')} canEdit={allow('Term Setup', 'Edit')} canDelete={allow('Term Setup', 'Delete')} />
          )}
          {tab === 'exams' && (
            <AddExamTab store={store} commit={commit} flash={flash}
              canCreate={allow('Exam Setup', 'Create')} canEdit={allow('Exam Setup', 'Edit')} canDelete={allow('Exam Setup', 'Delete')} canDownload={allow('Exam Setup', 'Download')} />
          )}
          {tab === 'result' && (
            <AddResultTab store={store} commit={commit} flash={flash}
              canCreate={allow('Result Setup', 'Create')} canEdit={allow('Result Setup', 'Edit')} canDelete={allow('Result Setup', 'Delete')} />
          )}
        </>
      )}

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
