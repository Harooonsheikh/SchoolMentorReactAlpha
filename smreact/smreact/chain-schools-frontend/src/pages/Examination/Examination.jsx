import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import TutorialButton from '../../components/TutorialButton'
import { useAuth } from '../../auth/useAuth'
import { useView } from '../../config/viewContext'
import ExamEditor from './ExamEditor'
import ResultPolicyEditor from './ResultPolicyEditor'
import RecordDetail from './RecordDetail'
import RecordsTable from './RecordsTable'
import Overview from './Overview'
import {
  loadExamStore, saveExamStore, findRecord, createRecord, updateRecord, markReady, publish,
  archive, allSchoolIds, setConnectedSchools, EXAM_STATUS, STATUS_META,
} from './data'
import './Examination.css'

/* ═══════════════════════════════════════════════════════════════════
   Examination — Head Office module.
   Tabs: Overview (status + school handoff) · Exams · Result Policy.
   Every change is a draft until explicitly published. Publishing only
   records the live snapshot; schools receive it through the school
   package (Overview → School handoff).
   ═══════════════════════════════════════════════════════════════════ */

const TABS = [
  { key: 'overview', label: 'Overview', icon: 'fa-gauge-high' },
  { key: 'exams', label: 'Exams', icon: 'fa-file-signature' },
  { key: 'policies', label: 'Result Policy', icon: 'fa-square-poll-vertical' },
]
/* For now the Exams tab is hidden in Chain — keep Overview + Result Policy. */
const VISIBLE_TABS = TABS.filter((t) => t.key !== 'exams')

const CONFIRM_COPY = {
  publish: {
    title: 'Publish to schools?',
    confirm: 'Publish',
    tone: 'primary',
    body: (r, n) => `This makes version ${r.version} of "${r.name}" live for ${n} school${n === 1 ? '' : 's'}. Schools receive it when the school package is copied into their ERP.`,
  },
  archive: {
    title: 'Archive?',
    confirm: 'Archive',
    tone: 'danger',
    body: (r) => `"${r.name}" is archived. It stays in history but can no longer be published.`,
  },
}

export default function Examination() {
  const { user } = useAuth()
  const { schools } = useView()
  setConnectedSchools(schools)
  const actor = user?.name || user?.email || 'Head Office user'

  const [tab, setTab] = useState('overview')
  const goTab = (key) => { if (key !== 'exams') setTab(key) }
  const [store, setStore] = useState(loadExamStore)
  const [editor, setEditor] = useState(null) // { kind, record|null }
  const [detail, setDetail] = useState(null) // { kind, id }
  const [confirm, setConfirm] = useState(null) // { kind, id, action }
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const flash = (type, text) => setToast({ type, text })

  const commit = (result) => {
    saveExamStore(result.store)
    setStore(result.store)
  }

  const counts = useMemo(() => ({
    exams: store.exams.filter((e) => e.status !== EXAM_STATUS.ARCHIVED).length,
    policies: store.policies.filter((p) => p.status !== EXAM_STATUS.ARCHIVED).length,
  }), [store])

  /* Create or edit from the editor. Returns an error string to keep the
     modal open, or null when saved. */
  const saveRecord = (kind, existing, fields) => {
    const res = existing
      ? updateRecord(store, kind, existing.id, fields, actor)
      : createRecord(store, kind, fields, actor)
    if (res.error) return res.error
    commit(res)
    setEditor(null)
    flash('success', existing ? 'Changes saved as a draft revision.' : 'Draft saved. Publish it when it is ready.')
    return null
  }

  const runAction = (kind, id, action) => {
    const r = findRecord(store, kind, id)
    if (!r) { flash('error', 'This item no longer exists.'); return }
    if (action === 'publish' || action === 'archive') {
      setConfirm({ kind, id, action })
      return
    }
    const fn = { ready: markReady }[action]
    const res = fn(store, kind, id, actor)
    if (res.error) { flash('error', res.error); return }
    commit(res)
    flash('success', `"${r.name}" is ready to publish.`)
  }

  const confirmAction = () => {
    const { kind, id, action } = confirm
    const fn = { publish, archive }[action]
    const res = fn(store, kind, id, actor)
    setConfirm(null)
    if (res.error) { flash('error', res.error); return }
    commit(res)
    flash('success', { publish: 'Published. It is now part of the school package.', archive: 'Archived.' }[action])
  }

  const openDetail = (kind, id) => setDetail({ kind, id })

  const detailRecord = detail ? findRecord(store, detail.kind, detail.id) : null
  const confirmRecord = confirm ? findRecord(store, confirm.kind, confirm.id) : null

  return (
    <>
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon"><i className="fa-solid fa-file-signature" /></div>
          <div>
            <h1 className="page-title">Examination</h1>
            <p className="page-sub">Create exams and result policies once, then publish them to selected or all schools in your chain.</p>
          </div>
        </div>
        <div className="page-header-actions">
          <TutorialButton />
        </div>
      </div>

      <div className="exm-tabs" role="tablist">
        {VISIBLE_TABS.map((t) => {
          const n = t.key === 'exams' ? counts.exams : t.key === 'policies' ? counts.policies : null
          return (
            <button key={t.key} role="tab" aria-selected={tab === t.key} className={`exm-tab${tab === t.key ? ' on' : ''}`} onClick={() => goTab(t.key)}>
              <i className={`fa-solid ${t.icon}`} /> {t.label}
              {n !== null && <span className="exm-tab-count">{n}</span>}
            </button>
          )
        })}
      </div>

      {tab === 'overview' && (
        <Overview store={store} onOpen={(kind, id) => openDetail(kind, id)} onGoTo={goTab} flash={flash} />
      )}

      {tab === 'exams' && (
        <RecordsTable
          kind="exam"
          records={store.exams}
          onNew={() => setEditor({ kind: 'exam', record: null })}
          onView={(id) => openDetail('exam', id)}
          onEdit={(id) => setEditor({ kind: 'exam', record: findRecord(store, 'exam', id) })}
          onAction={(id, action) => runAction('exam', id, action)}
        />
      )}

      {tab === 'policies' && (
        <RecordsTable
          kind="policy"
          records={store.policies}
          onNew={() => setEditor({ kind: 'policy', record: null })}
          onView={(id) => openDetail('policy', id)}
          onEdit={(id) => setEditor({ kind: 'policy', record: findRecord(store, 'policy', id) })}
          onAction={(id, action) => runAction('policy', id, action)}
        />
      )}

      {editor?.kind === 'exam' && (
        <ExamEditor
          exam={editor.record}
          actor={actor}
          onClose={() => setEditor(null)}
          onSave={(fields) => saveRecord('exam', editor.record, fields)}
        />
      )}

      {editor?.kind === 'policy' && (
        <ResultPolicyEditor
          policy={editor.record}
          onClose={() => setEditor(null)}
          onSave={(fields) => saveRecord('policy', editor.record, fields)}
        />
      )}

      {detailRecord && (
        <RecordDetail
          kind={detail.kind}
          record={detailRecord}
          onClose={() => setDetail(null)}
          onEdit={() => { setDetail(null); setEditor({ kind: detail.kind, record: detailRecord }) }}
          onAction={(action) => { setDetail(null); runAction(detail.kind, detailRecord.id, action) }}
        />
      )}

      {confirm && confirmRecord && createPortal(
        <ConfirmModal
          copy={CONFIRM_COPY[confirm.action]}
          record={confirmRecord}
          onCancel={() => setConfirm(null)}
          onConfirm={confirmAction}
        />,
        document.body,
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

function ConfirmModal({ copy, record, onCancel, onConfirm }) {
  /* Publish reaches the scope as it resolves now; archive
     affect the schools that currently hold the live snapshot. */
  const n = record.publishedSnapshot
    ? record.publishedSnapshot.schoolIds.length
    : allSchoolIds().length
  return (
    <div className="exm-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="exm-modal sm" role="alertdialog" aria-modal="true" aria-labelledby="exm-confirm-title">
        <div className="exm-modal-body">
          <div className={`exm-confirm-icon ${copy.tone}`}><i className={`fa-solid ${copy.tone === 'danger' ? 'fa-triangle-exclamation' : 'fa-bullhorn'}`} /></div>
          <h2 id="exm-confirm-title" className="exm-confirm-title">{copy.title}</h2>
          <p className="exm-confirm-body">{copy.body(record, n)}</p>
          <div className="exm-status-line">
            <span className={`badge ${STATUS_META[record.status]?.cls || 'b-gray'}`}>{STATUS_META[record.status]?.label}</span>
          </div>
        </div>
        <div className="exm-modal-foot">
          <span />
          <div className="exm-foot-btns">
            <button type="button" className="exm-btn ghost" onClick={onCancel}>Cancel</button>
            <button type="button" className={`exm-btn ${copy.tone === 'danger' ? 'danger' : 'primary'}`} onClick={onConfirm}>{copy.confirm}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
