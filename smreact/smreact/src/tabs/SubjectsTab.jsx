import React, { useCallback, useEffect, useState } from 'react';
import { COLORS } from '../data/initialData';
import { downloadSubjectsReport } from '../utils/pdfReports';
import { buildUrl } from '../utils/apiConfig';

// ── Book List Modal (full-featured: edit subject, delete, copy-to-all) ──────
function BookListModal({ open, cls, subjects, setSubjects, getclassesdata, bookLists, setBookLists, classesData, onClose,onAddSubjectClick, showToast, showSuccess }) {
  const [localList, setLocalList] = useState({});
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);
  const [showDeleteconfirm, setshowDeleteconfirm] = useState(false);
  const [editSubjId, setEditSubjId] = useState(null); // subjectID being inline-edited
  const [editSubjVal, setEditSubjVal] = useState('');
        const UserID = sessionStorage.getItem('UserID');
        const branchID = sessionStorage.getItem('branchID');
        const [refresh, setRefresh] = useState(0);


  React.useEffect(() => {

  const loadSubjects = async () => {

    if (open && cls) {

      try {

        const res = await fetch(
          buildUrl(`/api/LaunchSetup/get-subjects/${cls.classID}/${cls.sectionID}`),
          { headers: { accept: '*/*' } }
        );

        const json = await res.json();
        const data = json?.data ?? json ?? [];

        console.log(data);

        // create local book list
        const existing = bookLists[cls.classID] || {};

        const init = {};

        data.forEach(subj => {
          init[subj.subjectName] =
            existing[subj.subjectName] !== undefined
              ? existing[subj.subjectName]
              : subj.book_Title || '';
        });

        setLocalList(init);

        // optional if you want latest subjects in modal
        setSubjects(data);

      } catch {
        showToast('Could not load Subjects data', 'error');
      }
    }
  };

  loadSubjects();

}, [open, cls, refresh]);

  const handleSave = async () => {
  try {
    for (let i = 0; i < subjects.length; i++) {
      const s = subjects[i];

      const res = await fetch(buildUrl('/api/LaunchSetup/save-subject'), {
        method: 'POST',
        headers: {
          'Accept': '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subjectID: s.subjectID,
          subjectName: s.subjectName,
          gradeID: s.gradeID,
          sectionID: s.sectionID,
          branchID: s.branchID,
          book_Title: s.book_Title,
          createdAt: new Date().toISOString(),
          createdBy: UserID,
          modifiedAt: new Date().toISOString(),
          modifiedBy: UserID,
          isActive: true,
          networkID: 0
        }),
      });

      const data = await res.json();
      console.log("Saved:", data);
    }

    showSuccess(
      'Book List Saved!',
      `Book list for "${cls.className}" saved successfully.`
    );
getclassesdata()
    onClose();

  } catch (err) {
    console.error(err);
    showToast('Please try again.', 'error');
  }
};

  const handleApplyToAll = () => {
    setShowApplyConfirm(true);
  };

  const confirmDelete = async() => {
    console.log(cls)
    setShowApplyConfirm(false);
    try {
    const res = await fetch(buildUrl(`/api/LaunchSetup/delete-subject/${showDeleteconfirm.subjectID}`), {
      method: 'DELETE',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();
    console.log("Login Response:", data);
showSuccess(
  'Deleted Successfully!',
  `${showDeleteconfirm.subjectName} has been deleted from class ${cls.className}.`

);
setRefresh(prev => prev + 1);
setshowDeleteconfirm(false)
  } catch (err) {
    showToast('Network error. Please try again.', 'error');
    console.error(err);
  }

  };

  const confirmApply = async() => {
    console.log(cls)
    setShowApplyConfirm(false);
    try {
    const res = await fetch(buildUrl('/api/LaunchSetup/bulk-save-subject'), {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        branchID: branchID,
        sourceGradeID: cls.classID,
        sourceSectionID: cls.sectionID,
        networkID: 0,
      }),
    });

    const data = await res.json();
    console.log("Login Response:", data);

    onClose();
    showSuccess('Applied to All!', `Book list applied to all empty class`);

  } catch (err) {
    showToast('Network error. Please try again.', 'error');
    console.error(err);
  }

  };

  // const handleEditSubject = (oldName) => {
  //   console.log(oldName)
  //   const newName = prompt(`Edit subject name:`, oldName.subjectName);
  //   if (!newName || !newName.trim() || newName.trim() === oldName) return;
  //   const trimmed = newName.trim();
  //   setSubjects(prev =>
  //             prev.map(s =>
  //               s.subjectID === oldName.subjectID
  //                 ? { ...s, subjectName: newName }
  //                 : s
  //             )
  //           );

  //           setSubjects(null);
          
  //   showToast(`Subject renamed to "${trimmed}"`, 'success');
  // };
  const startEditSubject = (subj) => {
    setEditSubjId(subj.subjectID);
    setEditSubjVal(subj.subjectName || '');
  };
  const cancelEditSubject = () => { setEditSubjId(null); setEditSubjVal(''); };
  const saveEditSubject = (subj) => {
    const trimmed = (editSubjVal || '').trim();
    if (!trimmed) { showToast('Subject name cannot be empty', 'error'); return; }
    setSubjects(prev => prev.map(s => s.subjectID === subj.subjectID ? { ...s, subjectName: trimmed } : s));
    showToast(`Subject renamed to "${trimmed}"`, 'success');
    cancelEditSubject();
  };

  const handleDeleteSubject = (subjectName) => {
   setshowDeleteconfirm(subjectName)
  };

  if (!open || !cls) return null;

  const filledCount = Object.values(localList).filter(v => v.trim()).length;
  const totalCount = subjects.length;

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" style={{ maxHeight: '90vh' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title"><i className="fas fa-book" style={{ marginRight: 8, color: 'var(--brand-primary)' }}></i>Book List — {cls.className} ({cls.sectionName}) </div>
            <div className="modal-subtitle">
              {filledCount}/{totalCount} subjects filled
              {filledCount === totalCount && totalCount > 0 && <span style={{ color: 'var(--success)', marginLeft: 8 }}><i className="fas fa-check-circle"></i> Complete</span>}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><i className="fas fa-times"></i></button>
        </div>
        <div className="modal-body">
          {/* Copy to all button */}
        
          <div className="book-grid">
            {subjects.map(subj => {
              const val = localList[subj.book_Title] || '';
              return (
                <div key={subj} className="book-item">
                  <div className="book-subject">
                    {editSubjId === subj.subjectID ? (
                      <input
                        className="form-input"
                        autoFocus
                        value={editSubjVal}
                        onChange={e => setEditSubjVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEditSubject(subj); if (e.key === 'Escape') cancelEditSubject(); }}
                        style={{ fontWeight: 700, color: 'var(--brand-primary)', fontSize: 13, padding: '4px 8px', maxWidth: 180 }}
                      />
                    ) : (
                      <span style={{ fontWeight: 700, color: 'var(--brand-primary)', fontSize: 13 }}>{subj.subjectName}</span>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {subj.book_Title ? <span className="book-badge">Set</span> : <span className="book-badge empty">Empty</span>}
                      {editSubjId === subj.subjectID ? (
                        <>
                          <button className="btn btn-icon btn-sm" title="Save name" style={{ width: 26, height: 26, fontSize: 11, background: 'var(--success)', color: '#fff' }}
                            onClick={() => saveEditSubject(subj)}>
                            <i className="fas fa-check"></i>
                          </button>
                          <button className="btn btn-icon btn-ghost btn-sm" title="Cancel" style={{ width: 26, height: 26, fontSize: 11 }}
                            onClick={cancelEditSubject}>
                            <i className="fas fa-times"></i>
                          </button>
                        </>
                      ) : (
                        <button className="btn btn-icon btn-ghost btn-sm" title="Rename subject" style={{ width: 26, height: 26, fontSize: 11 }}
                          onClick={() => startEditSubject(subj)}>
                          <i className="fas fa-pen"></i>
                        </button>
                      )}
                      <button className="btn btn-icon btn-danger btn-sm" title="Delete subject" style={{ width: 26, height: 26, fontSize: 11 }}
                        onClick={() => handleDeleteSubject(subj)}>
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                  {/* <input
                    className="book-title-input"
                    placeholder="Enter Book Title Here"
                    value={val.book_Title}
                    onChange={e => setLocalList(prev => ({ ...prev, [subj]: e.target.value }))}
                  /> */}
                 <input
  className="book-title-input"
  placeholder="Enter Book Title Here"
  value={subj.book_Title || ''}
  onChange={e => {
    const value = e.target.value;

    setSubjects(prev =>
      prev.map(s =>
        s.subjectID === subj.subjectID
          ? { ...s, book_Title: value }
          : s
      )
    );
  }}
/>
                </div>
              );
            })}
          </div>

          {/* <div className="modal-footer">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button className="btn btn-ghost btn-md" onClick={handleApplyToAll} title="Copy this book list to all empty classes">
              <i className="fas fa-copy"></i> Apply to All Empty Classes
            </button>
          </div>
            <button className="btn btn-secondary btn-md" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary btn-md" onClick={handleSave}>
              <i className="fas fa-save"></i> Save Book List
            </button>
          </div> */}
          <div
  className="modal-footer"
  style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  }}
>
  {/* Left: Apply to all */}
  <button
    className="btn btn-ghost btn-md"
    onClick={handleApplyToAll}
    title="Copy this book list to all empty classes"
    style={{ color: 'var(--brand-primary)' }}
  >
    <i className="fas fa-copy"></i> Apply for All Empty Classes
  </button>

  {/* Right: Close + Add Subject */}
  <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
    <button className="btn btn-secondary btn-md" onClick={() => [getclassesdata()
, onClose()]}>
      Close
    </button>
    <button className="btn btn-primary btn-md" onClick={() => onAddSubjectClick(cls)}>
      <i className="fas fa-plus"></i> Add Subject
    </button>
    <button className="btn btn-primary btn-md" onClick={handleSave}>
      <i className="fas fa-edit"></i> Update
    </button>
  </div>
</div>
        </div>
      </div>

      {/* Apply to all confirm */}
      {/* {showApplyConfirm !== false && (
        <div className="modal-overlay open" style={{ zIndex: 1100 }} onClick={e => e.target === e.currentTarget && setShowApplyConfirm(false)}>
          <div className="confirm-dialog">
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ width: 52, height: 52, background: 'rgba(30,58,138,.1)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 12px' }}>
                <i className="fas fa-copy" style={{ color: 'var(--brand-primary)' }}></i>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Apply to All Empty Classes</div>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                This will copy the current book list to <strong>all empty class{showApplyConfirm === 1 ? '' : 'es'}</strong>. Any class that already has books assigned will not be affected.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-secondary btn-md" onClick={() => setShowApplyConfirm(false)}>Cancel</button>
              <button className="btn btn-primary btn-md" onClick={confirmApply}>
                <i className="fas fa-copy"></i> Apply to All
              </button>
            </div>
          </div>
        </div>
      )} */}
      {showApplyConfirm !== false && (
  <div
    className="modal-overlay open"
    style={{ zIndex: 1100 }}
    onClick={e => e.target === e.currentTarget && setShowApplyConfirm(false)}
  >
    <div
      className="confirm-dialog"
      style={{
        maxWidth: 440,
        width: '90%',
        padding: 24,
        borderRadius: 20,
      }}
    >
      {/* Header: icon + title/subtitle + close */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
        <div
          style={{
            width: 48,
            height: 48,
            flexShrink: 0,
            background: 'rgba(220,38,38,.1)',
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
          }}
        >
          <i className="fas fa-copy" style={{ color: '#dc2626' }}></i>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: 1.3,
            }}
          >
            Apply to All Empty Classes
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginTop: 2,
            }}
          >
            This action may have side effects
          </div>
        </div>

        <button
          onClick={() => setShowApplyConfirm(false)}
          style={{
            width: 30,
            height: 30,
            flexShrink: 0,
            border: 'none',
            background: 'var(--bg-subtle, #f1f5f9)',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            fontSize: 14,
          }}
          aria-label="Close"
        >
          <i className="fas fa-times"></i>
        </button>
      </div>

      {/* Warning callout */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          background: 'rgba(245,158,11,.1)',
          border: '1px solid rgba(245,158,11,.25)',
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 20,
        }}
      >
        <i
          className="fas fa-triangle-exclamation"
          style={{ color: '#f59e0b', fontSize: 16, marginTop: 2, flexShrink: 0 }}
        ></i>
        <p
          style={{
            fontSize: 13.5,
            color: 'var(--text-primary)',
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          This will copy the current book list to{' '}
          <strong>
            all empty
            class{showApplyConfirm === 1 ? '' : 'es'}
          </strong>
          . Any class that already has books assigned will not be affected.
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button
          className="btn btn-secondary btn-md"
          onClick={() => setShowApplyConfirm(false)}
        >
          Cancel
        </button>
        <button
          className="btn btn-md"
          onClick={confirmApply}
          style={{
            background: 'rgba(220,38,38,.08)',
            color: '#dc2626',
            border: '1px solid rgba(220,38,38,.2)',
          }}
        >
          <i className="fas fa-check"></i> Yes, Proceed
        </button>
      </div>
    </div>
  </div>
)}
{showDeleteconfirm !== false && (
  <div
    className="modal-overlay open"
    style={{ zIndex: 1100 }}
    onClick={e => e.target === e.currentTarget && setShowApplyConfirm(false)}
  >
    <div
      className="confirm-dialog"
      style={{
        maxWidth: 440,
        width: '90%',
        padding: 24,
        borderRadius: 20,
      }}
    >
      {/* Header: icon + title/subtitle + close */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
        <div
          style={{
            width: 48,
            height: 48,
            flexShrink: 0,
            background: 'rgba(220,38,38,.1)',
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
          }}
        >
          <i className="fas fa-copy" style={{ color: '#dc2626' }}></i>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: 1.3,
            }}
          >
            Delete Subject: {showDeleteconfirm.subjectName}
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginTop: 2,
            }}
          >
            This action may have side effects
          </div>
        </div>

        <button
          onClick={() => setShowApplyConfirm(false)}
          style={{
            width: 30,
            height: 30,
            flexShrink: 0,
            border: 'none',
            background: 'var(--bg-subtle, #f1f5f9)',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            fontSize: 14,
          }}
          aria-label="Close"
        >
          <i className="fas fa-times"></i>
        </button>
      </div>

      {/* Warning callout */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          background: 'rgba(245,158,11,.1)',
          border: '1px solid rgba(245,158,11,.25)',
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 20,
        }}
      >
        <i
          className="fas fa-triangle-exclamation"
          style={{ color: '#f59e0b', fontSize: 16, marginTop: 2, flexShrink: 0 }}
        ></i>
        <p
          style={{
            fontSize: 13.5,
            color: 'var(--text-primary)',
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          Are you sure you want to delete{" "}
          <strong>
            {showDeleteconfirm.subjectName}
          </strong>
          {" "}? This will remove it from <strong>
           this Class and this Section
          </strong> and all associated book titles will be lost.
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button
          className="btn btn-secondary btn-md"
          onClick={() => setshowDeleteconfirm(false)}
        >
          Cancel
        </button>
        <button
          className="btn btn-md"
          onClick={confirmDelete}
          style={{
            background: 'rgba(220,38,38,.08)',
            color: '#dc2626',
            border: '1px solid rgba(220,38,38,.2)',
          }}
        >
          <i className="fas fa-check"></i> Yes, Proceed
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}

// ── Add Subject Modal ──────────────────────────────────────────────────────
function AddSubjectModal({ open, onClose, onAdd, classesData, showToast, getclassesdata,prefill }) {
  const [name, setName] = useState('');
  const [err2, setErr2] = useState('');
  const [err, setErr] = useState('');
  const [selected, setSelected] = useState({
});
//AddSubject modal open krny pr class name,class section prefill  kr dy ga.
useEffect(() => {
    if (open && prefill) {
      setSelected({
        classId: prefill.classID,
        sectionId: prefill.sectionID,
        className: prefill.className || '',
        sectionName: prefill.sectionName || 'No Section',
      });
    }
    if (!open) {
      setSelected({});
      setName('');
      setErr('');
      setErr2('');
    }
  }, [open, prefill]);
  const handleAdd = async() => {
     if (!selected.classId || !selected.sectionId) {
    setErr2('Select the Class and Section');
    return;
  }
    if (!name.trim()) { setErr('Subject name is required'); return; }
    const branchID = sessionStorage.getItem('branchID');
    const userID = sessionStorage.getItem('UserID') || 0;
    try {
        const res = await fetch(buildUrl('/api/LaunchSetup/save-subject'), {
          method: 'POST',
          headers: {
            'Accept': '*/*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
             subjectID: 0,
  subjectName: name,
  gradeID: selected.classId,
  sectionID: selected.sectionId,
  branchID: branchID,
  book_Title: "",
  createdAt: new Date().toISOString(),
  createdBy: userID,
  modifiedAt: new Date().toISOString(),
  modifiedBy: userID,
  isActive: true,
  networkID: 0
}),
        });
    
        const data = await res.json();
    
        if (!res.ok) {
          showToast(data?.message || 'Data failed', 'info');
          return;
        }
         
    setName(''); setSelected([]); setErr(''); onClose();
    getclassesdata();
                  onAdd(name.trim(), selected);

      } catch (err) {
                  showToast('Network error. Please try again', 'info');

        console.error(err);
      }
  };

  if (!open) return null;
  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-md">
        <div className="modal-header">
          <div><div className="modal-title">Add Subject</div><div className="modal-subtitle">Add a new subject to all classes</div></div>
          <button className="modal-close" onClick={() => [setSelected({}), setName(''), setErr(''), setErr2(''),  onClose()]}><i className="fas fa-times"></i></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
  <label className="form-label">
    Class & Section <span className="req-star">*</span>
  </label>

  <div className="input-wrapper">
    <i className="fas fa-chalkboard input-icon"></i>

    <select
      className={`form-select has-icon${err2 ? ' error-field' : ''}`}
      value={`${selected.classId}_${selected.sectionId}`}
      onChange={(e) => {
         const [classId, sectionId] = e.target.value.split('_');
  const cls = classesData.find(c => c.id == classId);
  const sec = cls?.sections?.find(s => s.sectionID == sectionId);
  setSelected({
    classId,
    sectionId,
    className: cls?.name || '',
    sectionName: sec?.sectionName || 'No Section'
  });
        setErr2('');
      }}
    >
      <option value="">Select Class (Section)</option>

      {classesData.map(cls =>
        (cls.sections?.length ? cls.sections : [null]).map(sec => (
          <option
            key={`${cls.id}_${sec?.sectionID || 0}`}
            value={`${cls.id}_${sec?.sectionID || 0}`}
          >
            {cls.name}
            {sec ? ` (${sec.sectionName})` : ''}
          </option>
        ))
      )}
    </select>
  </div>
              {err2 && <span className="field-msg error"><i className="fas fa-times-circle"></i> {err2}</span>}
</div>
         
          <div className="form-group">
            <label className="form-label">Subject Name <span className="req-star">*</span></label>
            <div className="input-wrapper">
              <i className="fas fa-book input-icon"></i>
              <input className={`form-input has-icon${err ? ' error-field' : ''}`} placeholder="e.g. Mathematics, Science..." value={name}
                onChange={e => { setName(e.target.value); setErr(''); }}
                onKeyDown={e => e.key === 'Enter' && handleAdd()} autoFocus />
            </div>
            {err && <span className="field-msg error"><i className="fas fa-times-circle"></i> {err}</span>}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary btn-md" onClick={() => [setName(''), setSelected({}), setErr(''), setErr2(''),  onClose()]}>Cancel</button>
            <button className="btn btn-primary btn-md" onClick={handleAdd}><i className="fas fa-plus"></i> Add Subject</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Subjects Tab ─────────────────────────────────────────────────────
export default function SubjectsTab({ classesData, setClassesData,  subjectsData, setSubjectsData, bookLists, setBookLists, schoolInfo, showToast, showSuccess, onContinue }) {
  const [search, setSearch] = useState('');
  const [bookListTarget, setBookListTarget] = useState(null);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [subjectList, setSubjectList] = useState({});
  const [expandedKey, setExpandedKey] = useState(null);
  //AddSubjectModal kholte waqt current class set .
  const [AddSubjectPrefill, setAddSubjectPrefill] = useState(null);
        const branchID = sessionStorage.getItem('branchID');

  const buildRows = () => {
    const filtered = search ? classesData.filter(c => c.name.toLowerCase().includes(search.toLowerCase())) : classesData;
    const rows = [];
    filtered.forEach(cls => {
      const secs = cls.sections?.length ? cls.sections : [null];
      secs.forEach(sec => rows.push({ cls, sec }));
    });
    return rows;
  };
  const rows = buildRows();

  const handleAddSubject = (name, selected) => {
    showSuccess(
    'Subject Added!',
    `"${name}" added successfully`,
    `<strong>Class:</strong> ${selected.className}<br>
     <strong>Section:</strong> ${selected.sectionName}<br>
     <strong>Subject:</strong> ${name}`
  );
  };

  const applyToolbarToAll = () => {
    const source = bookLists[classesData[0]?.id] || {};
    let count = 0;
    const updated = { ...bookLists };
    classesData.forEach(cls => {
      const bl = bookLists[cls.id] || {};
      const isEmpty = !Object.values(bl).some(v => v.trim());
      if (isEmpty) { updated[cls.id] = { ...source }; count++; }
    });
    setBookLists(updated);
    if (count > 0) showSuccess('Applied!', `Book list applied to ${count} empty class${count === 1 ? '' : 'es'}.`);
    else showToast('No empty classes to apply to', 'info');
  };

  useEffect(() => {
    getclassesdata();
  }, []);
  
  const getclassesdata = useCallback(async () => {
      try {
        const res      = await fetch(buildUrl(`/api/LaunchSetup/get-grades-by-branch/${branchID}`), { headers: { Accept: '*/*' } });
        const json     = await res.json();
        const d        = json.data ?? {};
        const sorted = [...d].sort((a, b) => (a.orderBy || 0) - (b.orderBy || 0));
        setClassesData(d);
      } catch { showToast('Could not load Subjects data', 'error'); }
  }, [setClassesData]);

    const getSubjectList = useCallback(async (cls, sec, key) => {

      try {

            const res = await fetch(
              buildUrl(`/api/LaunchSetup/get-subjects/${cls.id}/${sec.sectionID}`),
              { headers: { accept: '*/*' } }
            );

            const json = await res.json();
            console.log(res.data);
            const data = json?.data ?? json ?? [];
    setSubjectList(Array.isArray(data) ? data : []);
            setExpandedKey(key);
          }
       catch { showToast('Could not load Subjects data', 'error'); }
  }, [setClassesData]);
  

  return (
    <div className="tab-panel active">
      <div className="classes-toolbar">
        <div className="toolbar-left">
          <div className="search-box">
            <i className="fas fa-search"></i>
            <input placeholder="Search classes..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="toolbar-right">
          {/* <button className="btn btn-ghost btn-md" onClick={applyToolbarToAll}>
            <i className="fas fa-copy"></i> <span className="add-btn-label">Apply for All Empty Classes</span>
          </button> */}
          <button className="btn btn-pdf btn-md" onClick={() => downloadSubjectsReport(classesData, subjectsData, bookLists, schoolInfo || {}, showToast)}>
            <i className="fas fa-file-pdf"></i> <span className="pdf-btn-label">Download Report</span>
          </button>
          <button className="btn btn-primary btn-md" onClick={() => setShowAddSubject(true)}>
            <i className="fas fa-plus"></i> <span className="add-btn-label">Add Subject</span>
          </button>
        </div>
      </div>

      <div className="classes-table-card" style={{ overflowX: 'auto' }}>
        <div className="subj-table-head">
          <div className="th">#</div>
          <div className="th">Class</div>
          <div className="th">Sections</div>
          <div className="th">Book List</div>
          <div className="th">Details</div>
        </div>
        <div>
          {!rows.length ? (
            <div className="empty-state">
              <div className="empty-icon"><i className="fas fa-book"></i></div>
              <div className="empty-title">No Classes Yet</div>
              <div className="empty-sub">Add classes in the Classes tab first.</div>
            </div>
          ) : rows.map(({ cls, sec }, i) => {
            const bl = bookLists[cls.id] || {};
            const filled = sec.completeSubjectsDetailCount;
            const total = sec.totalSubjectsCount;
            const expKey = `${cls.id}_${sec ? sec.sectionID : 'null'}`;
            const exp = expandedKey === expKey;
            const clsColor = COLORS[classesData.indexOf(cls) % COLORS.length];

            const statusBadge = filled === total && total > 0
              ? <span className="apply-all-chip" style={{ color: 'var(--success)', borderColor: 'rgba(22,163,74,.2)', background: 'rgba(22,163,74,.07)' }}><i className="fas fa-check-circle"></i> Complete</span>
              : filled > 0
                ? <span className="apply-all-chip" style={{ color: 'var(--warning)', borderColor: 'rgba(245,158,11,.2)', background: 'rgba(245,158,11,.07)' }}>{filled}/{total} filled</span>
                : <span className="apply-all-chip" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-light)', background: 'var(--bg-muted)' }}>Not set</span>;
            return (
              <div key={expKey} style={{ borderBottom: '1px solid var(--border-light)' }}>
                <div className={`subj-row${exp ? ' expanded-row' : ''}`} onClick={() => setExpandedKey(exp ? null : expKey)}>
                  <div className="td" style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: 11.5 }}>{cls.orderBy > 0 ? String(cls.orderBy).padStart(2, '0') : '-'}</div>
                  <div className="td">
                    <div className="class-avatar" style={{ background: clsColor, marginRight: 9 }}>{cls.name.charAt(0).toUpperCase()}</div>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{cls.name}</span>
                  </div>
                  <div className="td">
                    {sec
                      ? <span className="stu-section-pill">{sec.sectionName}</span>
                      : <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No section</span>}
                  </div>
                  <div className="td">{statusBadge}</div>
                  <div className="td" style={{ gap: 5 }}>
                    <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation();
                      const key = `${cls.id}_${sec?.sectionID || 'null'}`;
                      setExpandedKey(null)
                      setBookListTarget({
      classID: cls.id,
      className: cls.name,
      sectionID: sec?.sectionID,
      sectionName: sec?.sectionName
    });
   }}
                    >
                      <i className="fas fa-edit"></i> Update
                    </button>
                    <button className={`expand-btn${exp ? ' open' : ''}`} onClick={e => {
  e.stopPropagation();

  const key = `${cls.id}_${sec?.sectionID || 'null'}`;

  if (expandedKey === key) {
    setExpandedKey(null);
  } else {
    getSubjectList(cls, sec, key);
  }
}}>
                      <i className="fas fa-chevron-down"></i>
                    </button>
                  </div>
                </div>
                {exp && (
                  <div style={{ background: 'var(--bg-base)', borderTop: '1px solid var(--border-light)' }}>
                    <div style={{ padding: '14px 18px 6px', fontSize: 12, fontWeight: 700, color: 'var(--brand-primary)' }}>
                      <i className="fas fa-book" style={{ marginRight: 6 }}></i>{cls.name}{sec ? ` · Section ${sec.sectionName}` : ''} — Book List
                    </div>
                    <div className="book-grid">
                      {/* {subjectList.map((subj, i) => {
                          <div key={subj.subjectID} className="book-item">
                            <div className="book-subject">
                              {subj.subjectName}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{subj.book_Title || 'Book title not provided yet'}</div>
                          </div>
                      })} */}
                      {subjectList.map((subj, i) => {
  return (
    <div key={subj.subjectID} className="book-item">
      <div className="book-subject">
        {subj.subjectName}
        {subj.book_Title ? <span className="book-badge">Set</span> : <span className="book-badge empty">Empty</span>}
      </div>

      <div
        style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          marginTop: 4
        }}
      >
        {subj.book_Title || 'Book title not provided yet'}
      </div>
    </div>
  );
})}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="pagination">
          <div className="pagination-info">Showing <strong>{rows.length}</strong> of <strong>{rows.length}</strong> rows</div>
        </div>
      </div>

      <BookListModal
        open={!!bookListTarget} cls={bookListTarget}
        subjects={subjectsData} setSubjects={setSubjectsData}
        bookLists={bookLists} setBookLists={setBookLists}
        classesData={classesData}
        getclassesdata={getclassesdata}
        onAddSubjectClick={(cls) => {
    setAddSubjectPrefill(cls);   // current class store
    setBookListTarget(null);     // book list modal band
    setShowAddSubject(true);     // add subject modal khol
  }}
        onClose={() => [getclassesdata(), setBookListTarget(null), ]}
        showToast={showToast} showSuccess={showSuccess}
      />
      <AddSubjectModal open={showAddSubject} prefill={AddSubjectPrefill} subjects={subjectsData} showToast={showToast} getclassesdata={getclassesdata}
      classesData={classesData} onClose={() => {setShowAddSubject(false); setAddSubjectPrefill(null);}} onAdd={handleAddSubject} />

      {/* spacer so the fixed save bar doesn't cover the pagination */}
      <div style={{ height: 84 }} aria-hidden="true" />
      {/* Save & Continue — move to the next setup step */}
      <div className="save-bar">
        <div className="save-bar-left">
          <div className="autosave-dot"></div>
          <span>Draft auto-saved</span>
        </div>
        <div className="save-bar-right">
          <button className="btn btn-primary btn-md" onClick={() => onContinue?.()}>
            Save &amp; Continue <i className="fas fa-arrow-right"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
