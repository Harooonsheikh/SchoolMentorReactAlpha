import React, { useMemo, useRef, useState } from 'react';
import { INITIAL_QUIZ, DIFFICULTIES, BULK_COLUMNS, diffClass, todayISO } from './quizData';

/* ═══════════════════════════════════════════════════════════════════
   QUIZ CONTENT — Super Admin module (frontend only)

   Class-wise subjects, MCQ bank, correct answers and quiz content for the
   student mobile app. Three tabs: Classes · Subjects · MCQ Bank, each
   with full CRUD, status toggle, filters, and modals (class / subject /
   MCQ add-edit, bulk Excel upload, delete confirm). All state is
   in-component demo state (see ./quizData). No backend.
   ═══════════════════════════════════════════════════════════════════ */

const TABS = [
  { id: 'classes',  name: 'Classes',  icon: 'fa-layer-group' },
  { id: 'subjects', name: 'Subjects', icon: 'fa-book' },
  { id: 'mcq',      name: 'MCQ Bank', icon: 'fa-list-check' },
];

export default function QuizContent({ toast }) {
  const [data, setData] = useState(() => JSON.parse(JSON.stringify(INITIAL_QUIZ)));
  const [tab, setTab] = useState('classes');
  const [openDd, setOpenDd] = useState(null);          // "type-id" of open dots menu
  const [modal, setModal] = useState(null);
  const seq = useRef({ class: INITIAL_QUIZ.classSeq, subject: INITIAL_QUIZ.subjectSeq, mcq: INITIAL_QUIZ.mcqSeq });

  /* Cross-tab navigation state (filters preset when drilling down). */
  const [subClassFilter, setSubClassFilter] = useState('');
  const [mcqFilter, setMcqFilter] = useState({ classId: '', subjectId: '', status: '', diff: '', q: '' });

  const stats = useMemo(() => {
    const active = data.mcqs.filter((m) => m.status === 'active').length;
    return { classes: data.classes.length, subjects: data.subjects.length, mcqs: data.mcqs.length, active, inactive: data.mcqs.length - active };
  }, [data]);

  /* ── CRUD ── */
  const saveClass = (form, editId) => {
    if (editId) setData((d) => ({ ...d, classes: d.classes.map((c) => c.id === editId ? { ...c, ...form } : c) }));
    else setData((d) => ({ ...d, classes: [...d.classes, { id: ++seq.current.class, ...form, order: form.order || d.classes.length + 1 }] }));
    setModal(null); toast?.(editId ? 'Class updated' : 'Class added', 'success');
  };
  const saveSubject = (form, editId) => {
    if (editId) setData((d) => ({ ...d, subjects: d.subjects.map((s) => s.id === editId ? { ...s, ...form } : s) }));
    else setData((d) => ({ ...d, subjects: [...d.subjects, { id: ++seq.current.subject, ...form, order: form.order || d.subjects.length + 1 }] }));
    setModal(null); toast?.(editId ? 'Subject updated' : 'Subject added', 'success');
  };
  const saveMcq = (form, editId) => {
    if (editId) setData((d) => ({ ...d, mcqs: d.mcqs.map((m) => m.id === editId ? { ...m, ...form } : m) }));
    else setData((d) => ({ ...d, mcqs: [...d.mcqs, { id: ++seq.current.mcq, ...form, createdAt: todayISO() }] }));
    setModal(null); toast?.(editId ? 'MCQ updated' : 'MCQ added', 'success');
  };
  const importBulk = (rows) => {
    setData((d) => {
      const added = rows.map((r) => ({ ...r, id: ++seq.current.mcq, createdAt: todayISO() }));
      return { ...d, mcqs: [...d.mcqs, ...added] };
    });
    setModal(null); toast?.(`${rows.length} MCQ${rows.length !== 1 ? 's' : ''} imported`, 'success');
  };
  const toggleStatus = (type, id) => {
    const key = type === 'class' ? 'classes' : type === 'subject' ? 'subjects' : 'mcqs';
    setData((d) => ({ ...d, [key]: d[key].map((x) => x.id === id ? { ...x, status: x.status === 'active' ? 'inactive' : 'active' } : x) }));
    toast?.('Status updated', 'success');
  };
  const confirmDelete = ({ type, id }) => {
    setData((d) => {
      if (type === 'class') return { ...d, classes: d.classes.filter((c) => c.id !== id), subjects: d.subjects.filter((s) => s.classId !== id), mcqs: d.mcqs.filter((m) => m.classId !== id) };
      if (type === 'subject') return { ...d, subjects: d.subjects.filter((s) => s.id !== id), mcqs: d.mcqs.filter((m) => m.subjectId !== id) };
      return { ...d, mcqs: d.mcqs.filter((m) => m.id !== id) };
    });
    setModal(null); toast?.('Deleted', 'info');
  };

  /* Drill-downs */
  const viewSubjects = (classId) => { setSubClassFilter(String(classId)); setTab('subjects'); };
  const viewMcqs = (classId, subjectId) => { setMcqFilter({ classId: String(classId), subjectId: String(subjectId), status: '', diff: '', q: '' }); setTab('mcq'); };

  return (
    <div className="page-content" onClick={() => setOpenDd(null)}>
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon" style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}><i className="fa-solid fa-circle-question" /></div>
          <div>
            <div className="page-title">Quiz Content</div>
            <div className="page-sub">Manage class-wise subjects, MCQs, correct answers, and quiz content for the student mobile app.</div>
          </div>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
        <div className="stat-card" style={{ borderLeftColor: '#7C3AED' }}><div className="stat-icon" style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}><i className="fa-solid fa-layer-group" /></div><div className="stat-val">{stats.classes}</div><div className="stat-lbl">Total Classes</div></div>
        <div className="stat-card s-green"><div className="stat-icon"><i className="fa-solid fa-book" /></div><div className="stat-val">{stats.subjects}</div><div className="stat-lbl">Total Subjects</div></div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--info)' }}><div className="stat-icon" style={{ background: 'linear-gradient(135deg,#0369A1,#0284C7)' }}><i className="fa-solid fa-list-check" /></div><div className="stat-val">{stats.mcqs}</div><div className="stat-lbl">Total MCQs</div></div>
        <div className="stat-card s-green"><div className="stat-icon"><i className="fa-solid fa-circle-check" /></div><div className="stat-val">{stats.active}</div><div className="stat-lbl">Active MCQs</div></div>
        <div className="stat-card s-warn"><div className="stat-icon"><i className="fa-solid fa-circle-xmark" /></div><div className="stat-val">{stats.inactive}</div><div className="stat-lbl">Inactive MCQs</div></div>
      </div>

      <div className="quiz-tabs">
        {TABS.map((t) => <button key={t.id} className={`quiz-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}><i className={`fa-solid ${t.icon}`} /> {t.name}</button>)}
      </div>

      {tab === 'classes' && (
        <ClassesTab data={data} openDd={openDd} setOpenDd={setOpenDd}
          onAdd={() => setModal({ type: 'class', item: null })}
          onEdit={(c) => setModal({ type: 'class', item: c })}
          onToggle={(id) => toggleStatus('class', id)}
          onDelete={(c) => setModal({ type: 'del', target: { type: 'class', id: c.id }, label: 'Class', name: c.name })}
          onView={viewSubjects} />
      )}
      {tab === 'subjects' && (
        <SubjectsTab data={data} classFilter={subClassFilter} setClassFilter={setSubClassFilter} openDd={openDd} setOpenDd={setOpenDd}
          onAdd={() => setModal({ type: 'subject', item: null })}
          onEdit={(s) => setModal({ type: 'subject', item: s })}
          onToggle={(id) => toggleStatus('subject', id)}
          onDelete={(s) => setModal({ type: 'del', target: { type: 'subject', id: s.id }, label: 'Subject', name: s.name })}
          onView={viewMcqs} />
      )}
      {tab === 'mcq' && (
        <McqTab data={data} filter={mcqFilter} setFilter={setMcqFilter}
          onAdd={() => setModal({ type: 'mcq', item: null })}
          onBulk={() => setModal({ type: 'bulk' })}
          onEdit={(m) => setModal({ type: 'mcq', item: m })}
          onToggle={(id) => toggleStatus('mcq', id)}
          onDelete={(m) => setModal({ type: 'del', target: { type: 'mcq', id: m.id }, label: 'MCQ', name: `${m.question.slice(0, 50)}…` })} />
      )}

      {/* ── MODALS ── */}
      {modal?.type === 'class' && <ClassModal item={modal.item} onClose={() => setModal(null)} onSave={saveClass} toast={toast} />}
      {modal?.type === 'subject' && <SubjectModal item={modal.item} classes={data.classes} onClose={() => setModal(null)} onSave={saveSubject} toast={toast} />}
      {modal?.type === 'mcq' && <McqModal item={modal.item} classes={data.classes} subjects={data.subjects} onClose={() => setModal(null)} onSave={saveMcq} toast={toast} />}
      {modal?.type === 'bulk' && <BulkModal classes={data.classes} subjects={data.subjects} onClose={() => setModal(null)} onImport={importBulk} toast={toast} />}
      {modal?.type === 'del' && <DeleteModal label={modal.label} name={modal.name} onClose={() => setModal(null)} onConfirm={() => confirmDelete(modal.target)} />}
    </div>
  );
}

/* ═══════════════════════ SHARED ═══════════════════════ */
function StatusBadge({ active }) { return <span className={`badge ${active ? 'b-green' : 'b-gray'}`}>{active ? 'Active' : 'Inactive'}</span>; }

function Dots({ id, openDd, setOpenDd, children }) {
  const open = openDd === id;
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button className="sop-dots-btn" data-tip="Actions" data-tip-pos="left" onClick={(e) => { e.stopPropagation(); setOpenDd(open ? null : id); }}><i className="fa-solid fa-ellipsis-vertical" /></button>
      {open && <div className="sop-dropdown open" onClick={(e) => e.stopPropagation()}>{children}</div>}
    </div>
  );
}

/* ═══════════════════════ CLASSES TAB ═══════════════════════ */
function ClassesTab({ data, openDd, setOpenDd, onAdd, onEdit, onToggle, onDelete, onView }) {
  const [q, setQ] = useState('');
  const rows = data.classes.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="quiz-panel">
      <div className="section-card">
        <div className="card-header">
          <div><div className="card-title"><i className="fa-solid fa-layer-group" /> Quiz Classes</div><div className="card-sub">Manage class levels for the quiz module.</div></div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="search-box" style={{ width: 200 }}><i className="fa-solid fa-magnifying-glass" /><input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search class…" /></div>
            <button className="btn-primary" onClick={onAdd}><i className="fa-solid fa-plus" /> Add Class</button>
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="quiz-table">
            <thead><tr><th style={{ width: 44 }}>#</th><th>Class Name</th><th style={{ width: 100, textAlign: 'center' }}>Subjects</th><th style={{ width: 90, textAlign: 'center' }}>MCQs</th><th style={{ width: 90, textAlign: 'center' }}>Order</th><th style={{ width: 90, textAlign: 'center' }}>Status</th><th style={{ width: 60, textAlign: 'center' }}>Actions</th></tr></thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 36, color: 'var(--tm)' }}><i className="fa-solid fa-layer-group" style={{ fontSize: 26, opacity: 0.2, display: 'block', marginBottom: 8 }} /><div style={{ fontSize: 13, fontWeight: 700 }}>No classes found</div></td></tr> : rows.map((cls, i) => {
                const subs = data.subjects.filter((s) => s.classId === cls.id).length;
                const mcqc = data.mcqs.filter((m) => m.classId === cls.id).length;
                const isActive = cls.status === 'active';
                return (
                  <tr key={cls.id}>
                    <td data-label="#">{i + 1}</td>
                    <td data-label="Class"><div style={{ fontWeight: 700, color: 'var(--t1)' }}>{cls.name}</div></td>
                    <td data-label="Subjects" style={{ textAlign: 'center' }}><span className="badge b-blue">{subs}</span></td>
                    <td data-label="MCQs" style={{ textAlign: 'center' }}><span className="badge b-green">{mcqc}</span></td>
                    <td data-label="Order" style={{ textAlign: 'center', color: 'var(--tm)' }}>{cls.order}</td>
                    <td data-label="Status" style={{ textAlign: 'center' }}><StatusBadge active={isActive} /></td>
                    <td data-label="Actions" style={{ textAlign: 'center' }}>
                      <Dots id={`class-${cls.id}`} openDd={openDd} setOpenDd={setOpenDd}>
                        <div className="sop-dd-item" onClick={() => { setOpenDd(null); onView(cls.id); }}><i className="fa-solid fa-eye" /> View Subjects</div>
                        <div className="sop-dd-item" onClick={() => { setOpenDd(null); onEdit(cls); }}><i className="fa-solid fa-pen" /> Edit</div>
                        <div className="sop-dd-item" style={{ color: isActive ? 'var(--warn)' : 'var(--success)' }} onClick={() => { setOpenDd(null); onToggle(cls.id); }}><i className={`fa-solid fa-circle-${isActive ? 'xmark' : 'check'}`} /> {isActive ? 'Deactivate' : 'Activate'}</div>
                        <div className="sop-dd-item danger" onClick={() => { setOpenDd(null); onDelete(cls); }}><i className="fa-solid fa-trash-can" /> Delete</div>
                      </Dots>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ SUBJECTS TAB ═══════════════════════ */
function SubjectsTab({ data, classFilter, setClassFilter, openDd, setOpenDd, onAdd, onEdit, onToggle, onDelete, onView }) {
  const [q, setQ] = useState('');
  const rows = data.subjects.filter((s) => {
    if (classFilter && s.classId !== Number(classFilter)) return false;
    return s.name.toLowerCase().includes(q.toLowerCase());
  });
  return (
    <div className="quiz-panel">
      <div className="section-card">
        <div className="card-header">
          <div><div className="card-title"><i className="fa-solid fa-book" /> Quiz Subjects</div><div className="card-sub">Manage subjects under each class.</div></div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="f-input" style={{ width: 150, height: 38 }} value={classFilter} onChange={(e) => setClassFilter(e.target.value)}><option value="">All Classes</option>{data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <div className="search-box" style={{ width: 180 }}><i className="fa-solid fa-magnifying-glass" /><input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subject…" /></div>
            <button className="btn-primary" onClick={onAdd}><i className="fa-solid fa-plus" /> Add Subject</button>
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="quiz-table">
            <thead><tr><th style={{ width: 44 }}>#</th><th>Subject Name</th><th>Class</th><th style={{ width: 90, textAlign: 'center' }}>Total MCQs</th><th style={{ width: 90, textAlign: 'center' }}>Active MCQs</th><th style={{ width: 80, textAlign: 'center' }}>Order</th><th style={{ width: 90, textAlign: 'center' }}>Status</th><th style={{ width: 60, textAlign: 'center' }}>Actions</th></tr></thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 36, color: 'var(--tm)' }}><i className="fa-solid fa-book" style={{ fontSize: 26, opacity: 0.2, display: 'block', marginBottom: 8 }} /><div style={{ fontSize: 13, fontWeight: 700 }}>No subjects found</div></td></tr> : rows.map((sub, i) => {
                const cls = data.classes.find((c) => c.id === sub.classId);
                const total = data.mcqs.filter((m) => m.subjectId === sub.id).length;
                const active = data.mcqs.filter((m) => m.subjectId === sub.id && m.status === 'active').length;
                const isActive = sub.status === 'active';
                return (
                  <tr key={sub.id}>
                    <td data-label="#">{i + 1}</td>
                    <td data-label="Subject"><div style={{ fontWeight: 700, color: 'var(--t1)' }}>{sub.icon || ''} {sub.name}</div></td>
                    <td data-label="Class"><span className="badge b-blue" style={{ fontSize: 10 }}>{cls ? cls.name : '—'}</span></td>
                    <td data-label="Total MCQs" style={{ textAlign: 'center' }}><span className="badge b-blue">{total}</span></td>
                    <td data-label="Active MCQs" style={{ textAlign: 'center' }}><span className="badge b-green">{active}</span></td>
                    <td data-label="Order" style={{ textAlign: 'center', color: 'var(--tm)' }}>{sub.order}</td>
                    <td data-label="Status" style={{ textAlign: 'center' }}><StatusBadge active={isActive} /></td>
                    <td data-label="Actions" style={{ textAlign: 'center' }}>
                      <Dots id={`subject-${sub.id}`} openDd={openDd} setOpenDd={setOpenDd}>
                        <div className="sop-dd-item" onClick={() => { setOpenDd(null); onView(sub.classId, sub.id); }}><i className="fa-solid fa-eye" /> View MCQs</div>
                        <div className="sop-dd-item" onClick={() => { setOpenDd(null); onEdit(sub); }}><i className="fa-solid fa-pen" /> Edit</div>
                        <div className="sop-dd-item" style={{ color: isActive ? 'var(--warn)' : 'var(--success)' }} onClick={() => { setOpenDd(null); onToggle(sub.id); }}><i className={`fa-solid fa-circle-${isActive ? 'xmark' : 'check'}`} /> {isActive ? 'Deactivate' : 'Activate'}</div>
                        <div className="sop-dd-item danger" onClick={() => { setOpenDd(null); onDelete(sub); }}><i className="fa-solid fa-trash-can" /> Delete</div>
                      </Dots>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ MCQ BANK TAB ═══════════════════════ */
function McqTab({ data, filter, setFilter, onAdd, onBulk, onEdit, onToggle, onDelete }) {
  const [expanded, setExpanded] = useState({});
  const set = (k, v) => setFilter((f) => ({ ...f, [k]: v, ...(k === 'classId' ? { subjectId: '' } : {}) }));
  const subjectsForClass = filter.classId ? data.subjects.filter((s) => s.classId === Number(filter.classId)) : data.subjects;
  const rows = data.mcqs.filter((m) => {
    if (filter.classId && m.classId !== Number(filter.classId)) return false;
    if (filter.subjectId && m.subjectId !== Number(filter.subjectId)) return false;
    if (filter.status && m.status !== filter.status) return false;
    if (filter.diff && m.difficulty !== filter.diff) return false;
    if (filter.q && !m.question.toLowerCase().includes(filter.q.toLowerCase())) return false;
    return true;
  });
  const reset = () => setFilter({ classId: '', subjectId: '', status: '', diff: '', q: '' });
  return (
    <div className="quiz-panel">
      <div className="section-card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div><div className="card-title"><i className="fa-solid fa-list-check" /> MCQ Bank</div><div className="card-sub">Manage all quiz questions, options, and answers.</div></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={onBulk}><i className="fa-solid fa-file-excel" style={{ color: '#16A34A' }} /> Bulk Upload Excel</button>
            <button className="btn-primary" onClick={onAdd}><i className="fa-solid fa-plus" /> Add MCQ</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '12px 18px', borderBottom: '1px solid var(--bl)', flexWrap: 'wrap', background: 'var(--muted)' }}>
          <select className="f-input" style={{ height: 36, width: 140 }} value={filter.classId} onChange={(e) => set('classId', e.target.value)}><option value="">All Classes</option>{data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select className="f-input" style={{ height: 36, width: 150 }} value={filter.subjectId} onChange={(e) => set('subjectId', e.target.value)}><option value="">All Subjects</option>{subjectsForClass.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select className="f-input" style={{ height: 36, width: 120 }} value={filter.status} onChange={(e) => set('status', e.target.value)}><option value="">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
          <select className="f-input" style={{ height: 36, width: 120 }} value={filter.diff} onChange={(e) => set('diff', e.target.value)}><option value="">All Difficulty</option>{DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}</select>
          <div className="search-box" style={{ flex: 1, minWidth: 180 }}><i className="fa-solid fa-magnifying-glass" /><input className="search-input" value={filter.q} onChange={(e) => set('q', e.target.value)} placeholder="Search question…" /></div>
          <button className="btn-secondary" style={{ height: 36 }} onClick={reset}><i className="fa-solid fa-rotate-left" /> Reset</button>
        </div>
        <div style={{ padding: 16 }}>
          {rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 44, color: 'var(--tm)' }}><i className="fa-solid fa-list-check" style={{ fontSize: 32, opacity: 0.15, display: 'block', marginBottom: 12 }} /><div style={{ fontSize: 14, fontWeight: 700 }}>No MCQs found</div><div style={{ fontSize: 12, marginTop: 4 }}>Try adjusting filters or add a new MCQ.</div></div>
          ) : rows.map((m, i) => {
            const cls = data.classes.find((c) => c.id === m.classId);
            const sub = data.subjects.find((s) => s.id === m.subjectId);
            const open = !!expanded[m.id];
            return (
              <div className="mcq-card" key={m.id}>
                <div className="mcq-card-top" onClick={() => setExpanded((e) => ({ ...e, [m.id]: !e[m.id] }))}>
                  <div className="mcq-num">{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mcq-question">{m.question}</div>
                    <div className="mcq-meta">
                      {cls && <span className="badge b-blue" style={{ fontSize: 9.5 }}>{cls.name}</span>}
                      {sub && <span className="badge b-green" style={{ fontSize: 9.5 }}>{sub.icon || ''} {sub.name}</span>}
                      <span className={`badge ${diffClass(m.difficulty)}`} style={{ fontSize: 9.5 }}>{m.difficulty}</span>
                      <span className={`badge ${m.status === 'active' ? 'b-green' : 'b-gray'}`} style={{ fontSize: 9.5 }}>{m.status === 'active' ? 'Active' : 'Inactive'}</span>
                      <span className="badge b-blue" style={{ fontSize: 9.5 }}>Ans: {m.correct}</span>
                    </div>
                  </div>
                  <i className="fa-solid fa-chevron-down" data-tip={open ? 'Collapse' : 'Expand'} style={{ color: 'var(--tm)', fontSize: 12, flexShrink: 0, marginTop: 6, transition: 'var(--tr)', transform: open ? 'rotate(180deg)' : '' }} />
                </div>
                {open && (
                  <div className="mcq-expand-body open">
                    <div style={{ marginBottom: 10 }}>
                      {['A', 'B', 'C', 'D'].map((k) => (
                        <div className={`mcq-option${m.correct === k ? ' correct' : ''}`} key={k}>
                          <div className="mcq-option-key">{k}</div>
                          <span>{m[k.toLowerCase()] || '—'}</span>
                          {m.correct === k && <span style={{ marginLeft: 'auto', fontSize: 10 }}><i className="fa-solid fa-circle-check" /> Correct</span>}
                        </div>
                      ))}
                    </div>
                    {m.explanation && <div className="mcq-explain"><i className="fa-solid fa-lightbulb" style={{ color: 'var(--brand)', marginRight: 6 }} /><strong>Explanation:</strong> {m.explanation}</div>}
                    <div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 8, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      <span><i className="fa-solid fa-star" style={{ color: 'var(--warn)' }} /> Marks: {m.marks}</span>
                      <span><i className="fa-regular fa-calendar" style={{ color: 'var(--brand)' }} /> {m.createdAt || '—'}</span>
                    </div>
                  </div>
                )}
                <div className="mcq-actions">
                  <button className="btn-sm" style={{ height: 28, fontSize: 11.5 }} onClick={() => onEdit(m)}><i className="fa-solid fa-pen" /> Edit</button>
                  <button className="btn-sm" style={{ height: 28, fontSize: 11.5, borderColor: m.status === 'active' ? 'var(--warn)' : 'var(--success)', color: m.status === 'active' ? 'var(--warn)' : 'var(--success)', background: m.status === 'active' ? 'rgba(217,119,6,.06)' : 'rgba(22,163,74,.06)' }} onClick={() => onToggle(m.id)}>{m.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                  <button className="btn-sm" style={{ height: 28, fontSize: 11.5, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={() => onDelete(m)}><i className="fa-solid fa-trash-can" /> Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ MODALS ═══════════════════════ */
function Ov({ cls, wrap, wrapStyle, children, onClose }) {
  return <div className={`${cls} open`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className={wrap} style={wrapStyle}>{children}</div></div>;
}

function ClassModal({ item, onClose, onSave, toast }) {
  const editing = Boolean(item);
  const [f, setF] = useState({ name: item?.name || '', order: item?.order || '', status: item?.status || 'active' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => { if (!f.name.trim()) { toast?.('Please enter a class name', 'warn'); return; } onSave({ name: f.name.trim(), order: parseInt(f.order, 10) || (item?.order || 0), status: f.status }, item?.id); };
  return (
    <Ov cls="quiz-ov" wrap="quiz-modal" onClose={onClose}>
      <div className="quiz-modal-hdr">
        <div className="quiz-modal-icon"><i className="fa-solid fa-layer-group" /></div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 800, color: 'var(--t1)' }}>{editing ? 'Edit Class' : 'Add Class'}</div><div style={{ fontSize: 11.5, color: 'var(--tm)', marginTop: 2 }}>Configure a quiz class</div></div>
        <button className="pm-close" data-tip="Close" data-tip-pos="left" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
      </div>
      <div className="quiz-modal-body">
        <div className="quiz-field"><label>Class Name</label><input className="quiz-input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Grade 1" /></div>
        <div className="quiz-2col">
          <div className="quiz-field"><label>Display Order</label><input className="quiz-input" type="number" value={f.order} onChange={(e) => set('order', e.target.value)} placeholder="1" /></div>
          <div className="quiz-field"><label>Status</label><select className="quiz-input" style={{ cursor: 'pointer' }} value={f.status} onChange={(e) => set('status', e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
        </div>
      </div>
      <div className="quiz-modal-foot"><button className="btn-secondary" onClick={onClose}><i className="fa-solid fa-xmark" /> Cancel</button><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save Class</button></div>
    </Ov>
  );
}

function SubjectModal({ item, classes, onClose, onSave, toast }) {
  const editing = Boolean(item);
  const [f, setF] = useState({ classId: item?.classId || '', name: item?.name || '', icon: item?.icon || '', order: item?.order || '', status: item?.status || 'active' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    if (!f.classId) { toast?.('Please select a class', 'warn'); return; }
    if (!f.name.trim()) { toast?.('Please enter a subject name', 'warn'); return; }
    onSave({ classId: Number(f.classId), name: f.name.trim(), icon: f.icon.trim(), order: parseInt(f.order, 10) || (item?.order || 0), status: f.status }, item?.id);
  };
  return (
    <Ov cls="quiz-ov" wrap="quiz-modal" onClose={onClose}>
      <div className="quiz-modal-hdr">
        <div className="quiz-modal-icon" style={{ background: 'linear-gradient(135deg,#15803d,#16a34a)' }}><i className="fa-solid fa-book" /></div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 800, color: 'var(--t1)' }}>{editing ? 'Edit Subject' : 'Add Subject'}</div><div style={{ fontSize: 11.5, color: 'var(--tm)', marginTop: 2 }}>Configure a quiz subject</div></div>
        <button className="pm-close" data-tip="Close" data-tip-pos="left" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
      </div>
      <div className="quiz-modal-body">
        <div className="quiz-field"><label>Select Class</label><select className="quiz-input" style={{ cursor: 'pointer' }} value={f.classId} onChange={(e) => set('classId', e.target.value)}><option value="">Select Class</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="quiz-field"><label>Subject Name</label><input className="quiz-input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. English" /></div>
        <div className="quiz-2col">
          <div className="quiz-field"><label>Subject Icon (emoji)</label><input className="quiz-input" value={f.icon} onChange={(e) => set('icon', e.target.value)} placeholder="e.g. 📚" /></div>
          <div className="quiz-field"><label>Display Order</label><input className="quiz-input" type="number" value={f.order} onChange={(e) => set('order', e.target.value)} placeholder="1" /></div>
        </div>
        <div className="quiz-field"><label>Status</label><select className="quiz-input" style={{ cursor: 'pointer' }} value={f.status} onChange={(e) => set('status', e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
      </div>
      <div className="quiz-modal-foot"><button className="btn-secondary" onClick={onClose}><i className="fa-solid fa-xmark" /> Cancel</button><button className="btn-primary" style={{ background: 'linear-gradient(135deg,#15803d,#16a34a)', boxShadow: '0 4px 14px rgba(22,163,74,.28)' }} onClick={save}><i className="fa-solid fa-floppy-disk" /> Save Subject</button></div>
    </Ov>
  );
}

function McqModal({ item, classes, subjects, onClose, onSave, toast }) {
  const editing = Boolean(item);
  const [f, setF] = useState({
    classId: item?.classId || '', subjectId: item?.subjectId || '', question: item?.question || '',
    a: item?.a || '', b: item?.b || '', c: item?.c || '', d: item?.d || '',
    correct: item?.correct || 'A', difficulty: item?.difficulty || 'Easy', marks: item?.marks || 1,
    status: item?.status || 'active', explanation: item?.explanation || '',
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v, ...(k === 'classId' ? { subjectId: '' } : {}) }));
  const subjOpts = f.classId ? subjects.filter((s) => s.classId === Number(f.classId)) : subjects;
  const save = () => {
    if (!f.classId || !f.subjectId) { toast?.('Please select class and subject', 'warn'); return; }
    if (!f.question.trim()) { toast?.('Please enter the question text', 'warn'); return; }
    if (!f.a.trim() || !f.b.trim() || !f.c.trim() || !f.d.trim()) { toast?.('Please fill in all 4 options', 'warn'); return; }
    onSave({ classId: Number(f.classId), subjectId: Number(f.subjectId), question: f.question.trim(), a: f.a.trim(), b: f.b.trim(), c: f.c.trim(), d: f.d.trim(), correct: f.correct, difficulty: f.difficulty, marks: parseInt(f.marks, 10) || 1, explanation: f.explanation.trim(), status: f.status }, item?.id);
  };
  return (
    <Ov cls="quiz-ov" wrap="quiz-modal" wrapStyle={{ maxWidth: 640 }} onClose={onClose}>
      <div className="quiz-modal-hdr">
        <div className="quiz-modal-icon" style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}><i className="fa-solid fa-list-check" /></div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 800, color: 'var(--t1)' }}>{editing ? 'Edit MCQ' : 'Add MCQ'}</div><div style={{ fontSize: 11.5, color: 'var(--tm)', marginTop: 2 }}>{editing ? 'Update quiz question' : 'Create a new quiz question'}</div></div>
        <button className="pm-close" data-tip="Close" data-tip-pos="left" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
      </div>
      <div className="quiz-modal-body">
        <div className="quiz-2col">
          <div className="quiz-field"><label>Select Class</label><select className="quiz-input" style={{ cursor: 'pointer' }} value={f.classId} onChange={(e) => set('classId', e.target.value)}><option value="">Select Class</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="quiz-field"><label>Select Subject</label><select className="quiz-input" style={{ cursor: 'pointer' }} value={f.subjectId} onChange={(e) => set('subjectId', e.target.value)}><option value="">Select Subject</option>{subjOpts.map((s) => <option key={s.id} value={s.id}>{s.icon || ''} {s.name}</option>)}</select></div>
        </div>
        <div className="quiz-field"><label>Question Text</label><textarea className="quiz-textarea" value={f.question} onChange={(e) => set('question', e.target.value)} placeholder="Enter the question…" rows={2} /></div>
        <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 800, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Answer Options</div>
        <div className="quiz-2col">
          {['a', 'b', 'c', 'd'].map((k) => <div className="quiz-field" key={k}><label>Option {k.toUpperCase()}</label><input className="quiz-input" value={f[k]} onChange={(e) => set(k, e.target.value)} placeholder={`Option ${k.toUpperCase()}`} /></div>)}
        </div>
        <div className="quiz-2col">
          <div className="quiz-field"><label>Correct Answer</label><select className="quiz-input" style={{ cursor: 'pointer' }} value={f.correct} onChange={(e) => set('correct', e.target.value)}>{['A', 'B', 'C', 'D'].map((k) => <option key={k}>{k}</option>)}</select></div>
          <div className="quiz-field"><label>Difficulty</label><select className="quiz-input" style={{ cursor: 'pointer' }} value={f.difficulty} onChange={(e) => set('difficulty', e.target.value)}>{DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}</select></div>
        </div>
        <div className="quiz-2col">
          <div className="quiz-field"><label>Marks</label><input className="quiz-input" type="number" value={f.marks} onChange={(e) => set('marks', e.target.value)} min={1} /></div>
          <div className="quiz-field"><label>Status</label><select className="quiz-input" style={{ cursor: 'pointer' }} value={f.status} onChange={(e) => set('status', e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
        </div>
        <div className="quiz-field"><label>Explanation / Feedback (optional)</label><textarea className="quiz-textarea" value={f.explanation} onChange={(e) => set('explanation', e.target.value)} placeholder="Explain why this answer is correct…" rows={2} /></div>
      </div>
      <div className="quiz-modal-foot"><button className="btn-secondary" onClick={onClose}><i className="fa-solid fa-xmark" /> Cancel</button><button className="btn-primary" style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', boxShadow: '0 4px 14px rgba(124,58,237,.28)' }} onClick={save}><i className="fa-solid fa-floppy-disk" /> Save MCQ</button></div>
    </Ov>
  );
}

/* Bulk Excel upload — demo: generates a few sample rows from a "file" pick. */
function BulkModal({ classes, subjects, onClose, onImport, toast }) {
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const onFile = (e) => { if (e.target.files[0]) { setFileName(e.target.files[0].name); setPreview(null); } };

  const buildPreview = () => {
    /* Demo: synthesize a few valid rows from existing classes/subjects so the
       preview + import flow is fully functional without a real parser. */
    const rows = [];
    const cls = classes[0]; const subs = subjects.filter((s) => s.classId === (cls?.id));
    const samples = [
      { q: 'What is the past tense of "go"?', a: 'Goed', b: 'Went', c: 'Gone', d: 'Going', correct: 'B', difficulty: 'Easy' },
      { q: 'What is 7 + 6?', a: '12', b: '13', c: '14', d: '11', correct: 'B', difficulty: 'Easy' },
      { q: 'Water is made of hydrogen and …?', a: 'Oxygen', b: 'Carbon', c: 'Nitrogen', d: 'Helium', correct: 'A', difficulty: 'Medium' },
    ];
    samples.forEach((s, i) => rows.push({
      classId: cls?.id, subjectId: (subs[i % Math.max(subs.length, 1)] || subs[0])?.id,
      question: s.q, a: s.a, b: s.b, c: s.c, d: s.d, correct: s.correct, difficulty: s.difficulty, marks: 1, explanation: '', status: 'active',
    }));
    setPreview(rows.filter((r) => r.classId && r.subjectId));
  };

  const downloadTemplate = () => {
    const csv = BULK_COLUMNS.join(',') + '\nGrade 1,English,Sample question?,Option A,Option B,Option C,Option D,B,Easy,1,Optional explanation,active\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'quiz_mcq_template.csv'; a.click();
    URL.revokeObjectURL(url);
    toast?.('Sample template downloaded', 'success');
  };

  const className = (id) => classes.find((c) => c.id === id)?.name || '—';
  const subjectName = (id) => subjects.find((s) => s.id === id)?.name || '—';

  return (
    <Ov cls="quiz-ov" wrap="quiz-modal" wrapStyle={{ maxWidth: 680 }} onClose={onClose}>
      <div className="quiz-modal-hdr">
        <div className="quiz-modal-icon" style={{ background: 'linear-gradient(135deg,#15803d,#16a34a)' }}><i className="fa-solid fa-file-excel" /></div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 800, color: 'var(--t1)' }}>Bulk Upload MCQs</div><div style={{ fontSize: 11.5, color: 'var(--tm)', marginTop: 2 }}>Import multiple MCQs at once via Excel spreadsheet</div></div>
        <button className="pm-close" data-tip="Close" data-tip-pos="left" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
      </div>
      <div className="quiz-modal-body">
        <div style={{ background: 'rgba(30,58,138,.05)', border: '1.5px solid var(--bl)', borderRadius: 'var(--r-lg)', padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}><i className="fa-solid fa-download" /> Step 1 — Download Sample Template</div>
          <div style={{ fontSize: 12.5, color: 'var(--t2)', marginBottom: 10, lineHeight: 1.55 }}>Download the Excel template and fill in your MCQs. Keep the column headers exactly as shown.</div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--bl)', borderRadius: 'var(--r-md)', padding: '10px 13px', marginBottom: 10, fontSize: 11.5, color: 'var(--tm)' }}>
            <strong style={{ color: 'var(--t1)' }}>Required columns:</strong>
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {BULK_COLUMNS.map((col) => <span key={col} style={{ background: 'var(--muted)', border: '1px solid var(--bl)', borderRadius: 4, padding: '2px 8px', fontSize: 10.5, fontWeight: 600, color: 'var(--brand)' }}>{col}</span>)}
            </div>
          </div>
          <button className="btn-success" style={{ height: 34, fontSize: 12.5 }} onClick={downloadTemplate}><i className="fa-solid fa-download" /> Download Sample Excel Format</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}><i className="fa-solid fa-upload" /> Step 2 — Upload Your Excel File</div>
          <div className="sop-file-row" style={{ borderColor: 'rgba(22,163,74,.3)' }} onClick={() => fileRef.current?.click()}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#15803d,#16a34a)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}><i className="fa-solid fa-file-excel" /></div>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{fileName || 'Click to choose Excel file (.xlsx, .xls, .csv)'}</div><div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 2 }}>Only .xlsx, .xls, or .csv formats accepted</div></div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={onFile} />
            <i className="fa-solid fa-upload" style={{ color: 'var(--success)', fontSize: 15 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn-secondary" style={{ height: 34, fontSize: 12.5 }} onClick={() => fileRef.current?.click()}><i className="fa-solid fa-file-excel" style={{ color: '#16A34A' }} /> Choose File</button>
            <button className="btn-primary" style={{ height: 34, fontSize: 12.5, background: 'linear-gradient(135deg,#15803d,#16a34a)' }} disabled={!fileName} onClick={buildPreview}><i className="fa-solid fa-eye" /> Preview Data</button>
          </div>
        </div>

        {preview && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}><i className="fa-solid fa-table" /> Step 3 — Preview &amp; Import</div>
            <div style={{ background: 'var(--muted)', border: '1.5px solid var(--bl)', borderRadius: 'var(--r-md)', padding: '10px 13px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--t1)' }}>{preview.length} MCQs ready to import</span>
              <span className="badge b-green">{preview.length} Valid</span>
            </div>
            <div className="tbl-wrap" style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--bl)', borderRadius: 'var(--r-md)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0 }}><tr style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}>{['#', 'Class', 'Subject', 'Question', 'Correct', 'Difficulty', 'Status'].map((h) => <th key={h} style={{ padding: '8px 10px', color: '#fff', fontSize: 10, fontWeight: 800, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--bl)' }}>{i + 1}</td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--bl)' }}>{className(r.classId)}</td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--bl)' }}>{subjectName(r.subjectId)}</td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--bl)' }}>{r.question}</td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--bl)' }}>{r.correct}</td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--bl)' }}><span className={`badge ${diffClass(r.difficulty)}`} style={{ fontSize: 9.5 }}>{r.difficulty}</span></td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--bl)' }}><span className="badge b-green" style={{ fontSize: 9.5 }}>Active</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <div className="quiz-modal-foot" style={{ justifyContent: 'space-between' }}>
        <button className="btn-secondary" onClick={onClose}><i className="fa-solid fa-xmark" /> Cancel</button>
        <button className="btn-primary" style={{ background: 'linear-gradient(135deg,#15803d,#16a34a)', boxShadow: '0 4px 14px rgba(22,163,74,.28)' }} disabled={!preview || preview.length === 0} onClick={() => onImport(preview)}><i className="fa-solid fa-file-import" /> Import MCQs</button>
      </div>
    </Ov>
  );
}

function DeleteModal({ label, name, onClose, onConfirm }) {
  return (
    <Ov cls="quiz-del-ov" wrap="quiz-del-modal" onClose={onClose}>
      <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'rgba(220,38,38,.1)', border: '2px solid rgba(220,38,38,.25)', color: '#DC2626', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><i className="fa-solid fa-trash-can" /></div>
      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>Delete {label}?</div>
      <div style={{ fontSize: 13, color: 'var(--tm)', marginBottom: 20, lineHeight: 1.6 }}>"{name}" will be permanently deleted.</div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-danger" onClick={onConfirm}><i className="fa-solid fa-trash-can" /> Delete</button></div>
    </Ov>
  );
}
