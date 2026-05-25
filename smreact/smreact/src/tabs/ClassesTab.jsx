import React, { useCallback, useEffect, useState } from 'react';
import { COLORS } from '../data/initialData';
import { downloadClassesReport } from '../utils/pdfReports';
import { buildUrl } from '../utils/apiConfig';

// Add Class Modal
function AddClassModal({ open, onClose, getClassesData, onAdd }) {
  const [name, setName] = useState('');
  const [err, setErr] = useState('');

  const handleAdd = async() => {
    if (!name.trim()) { setErr('Class name is required'); return; }
    // onAdd(name.trim(), teacher.trim() || 'TBA');
     try {
      const branchID = sessionStorage.getItem('branchID');
    const userID = sessionStorage.getItem('UserID') || 0;

    const payload = {
      id: 0,
      name: name.trim(),
      branchID: Number(branchID),
      createdAt: new Date().toISOString(),
      createdBy: Number(userID),
      modifiedAt: new Date().toISOString(),
      modifiedBy: Number(userID),
      isActive: true,
      networkID: 0,
      sections: []
    };
    const res = await fetch(buildUrl('/api/LaunchSetup/save-grade'), {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      setErr(data?.message || 'Data failed');
      return;
    }
setName('');
    setErr('');
    onAdd(name);
    getClassesData();
    onClose();

  } catch (err) {
    console.error(err);
    setErr('Network error. Please try again.');
  }
  };
  

  if (!open) return null;
  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-md">
        <div className="modal-header">
          <div><div className="modal-title">Add New Class</div><div className="modal-subtitle">Enter the class name to get started</div></div>
          <button className="modal-close" onClick={onClose}><i className="fas fa-times"></i></button>
        </div>
        <div className="modal-body">
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Class Name <span className="req-star">*</span></label>
            <div className="input-wrapper">
              <i className="fas fa-chalkboard input-icon"></i>
              <input className={`form-input has-icon${err ? ' error-field' : ''}`} placeholder="e.g. Nursery, KG, Grade 1, Class 9..." value={name}
                onChange={e => { setName(e.target.value); setErr(''); }}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                autoFocus />
            </div>
            {err && <span className="field-msg error"><i className="fas fa-times-circle"></i> {err}</span>}
            <span className="form-helper info"><i className="fas fa-info-circle"></i> The class name defines the grade</span>
          </div>
          {/* <div className="form-group">
            <label className="form-label">Class Teacher <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
            <div className="input-wrapper">
              <i className="fas fa-user-tie input-icon"></i>
              <input className="form-input has-icon" placeholder="Assign now or later" value={teacher}
                onChange={e => setTeacher(e.target.value)} />
            </div>
          </div> */}
          <div className="modal-footer">
            <button className="btn btn-secondary btn-md" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary btn-md" onClick={handleAdd}><i className="fas fa-plus"></i> Add Class</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Sections Modal
function SectionsModal({ open, cls, onClose, getClassesData, onSave }) {
  const [sections, setSections] = useState([]);
  const [newSection, setNewSection] = useState('');
  const [editIdx, setEditIdx] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [err, setErr] = useState('');

  React.useEffect(() => {
    const loadSections = async () => {
    if (!open || !cls) return;

    try {
      const res = await fetch(
        buildUrl(`/api/LaunchSetup/get-sections/${cls.id}`),
        { headers: { accept: '*/*' } }
      );

      const json = await res.json();
      setSections(json.data || json || []);
    } catch (err) {
      console.error(err);
    }
  };

  loadSections();
  }, [open, cls, editIdx]);

  const addSection = async() => {
    const v = newSection.trim();
    if (!v) {
  setErr('Please enter the section name');
  return;
}
    // if (sections.includes(v)) return;
    try {
    const userID = sessionStorage.getItem('UserID') || 0;

    const payload = {
      sectionID: 0,
  sectionName: newSection,
  gradeID: cls.id,
  createdAt: new Date().toISOString(),
  createdBy: userID,
  modifiedAt: new Date().toISOString(),
  modifiedBy: userID,
  isActive: true
    };
    console.log(JSON.stringify(payload))
    const res = await fetch(buildUrl('/api/LaunchSetup/save-section'), {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      setErr(data?.message || 'Network error. Please try again.');
      return;
    }
setNewSection('');
    setErr('');
     const secRes = await fetch(
      buildUrl(`/api/LaunchSetup/get-sections/${cls.id}`),
      {
        headers: { accept: '*/*' },
      }
    );

    const secJson = await secRes.json();

    if (secRes.ok) {
      const updatedSections = secJson.data || secJson || [];
      setSections(updatedSections); 
    }
    getClassesData();
  } catch (err) {
    console.error(err);
    setNewSection('');
    setErr('Network error. Please try again.');
  }
    setNewSection('');
  };

  const deleteSection = async(s) => {
    console.log(s)
try {
      const res = await fetch(
      buildUrl(`/api/LaunchSetup/delete-section/${s.sectionID}`),
      {
        method: 'DELETE',
        headers: {
          Accept: '*/*'
        }
      }
    );
      const json     = await res.json();

    if (!res.ok) {
      setErr(json?.message || 'Delete failed', 'error');
      return;
    }
     const secRes = await fetch(
      buildUrl(`/api/LaunchSetup/get-sections/${cls.id}`),
      {
        headers: { accept: '*/*' },
      }
    );

    const secJson = await secRes.json();

    if (secRes.ok) {
      const updatedSections = secJson.data || secJson || [];
      setSections(updatedSections); 
    }
      getClassesData()
      setErr('')


  } catch (err) {
    console.error(err);
    setErr('Could not delete class', 'error');
  }
  };

  const startEdit = (i) => { setEditIdx(i); setEditVal(sections[i].sectionName); };


  const saveEdit = async(s) => {
    console.log(s)
      try {
    const userID = sessionStorage.getItem('UserID') || 0;

    const payload = {
      sectionID: s.sectionID,
  sectionName: editVal,
  gradeID: cls.id,
  createdAt: new Date().toISOString(),
  createdBy: userID,
  modifiedAt: new Date().toISOString(),
  modifiedBy: userID,
  isActive: true
    };
    console.log(JSON.stringify(payload))
    const res = await fetch(buildUrl('/api/LaunchSetup/save-section'), {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      setErr(data?.message || 'Network error. Please try again.');
      return;
    }
    setEditIdx(null); setEditVal('');
    setErr('');
     const secRes = await fetch(
      buildUrl(`/api/LaunchSetup/get-sections/${cls.id}`),
      {
        headers: { accept: '*/*' },
      }
    );

    const secJson = await secRes.json();

    if (secRes.ok) {
      const updatedSections = secJson.data || secJson || [];
      setSections(updatedSections); 
    }
    getClassesData();
  } catch (err) {
    console.error(err);
        setEditIdx(null); setEditVal('');
    setErr('Network error. Please try again.');
  }
  };

  if (!open || !cls) return null;
  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-md">
        <div className="modal-header">
          <div><div className="modal-title">Manage Sections</div><div className="modal-subtitle">Sections for: {cls.name}</div></div>
          <button className="modal-close" onClick={onClose}><i className="fas fa-times"></i></button>
        </div>
        <div className="modal-body">
          <div className="section-chip-list">
            {!sections.length && (
              <div style={{ textAlign: 'center', padding: 14, color: 'var(--text-muted)', fontSize: 12 }}>
                <i className="fas fa-layer-group" style={{ display: 'block', fontSize: 20, marginBottom: 6, opacity: .3 }}></i>
                No sections yet. Add below.
              </div>
            )}
            {/* {(sections || []).map((s, i) => (
              <div key={i} className="section-chip">
                {editIdx === i ? (
                  <input className="chip-edit-input" value={editVal} autoFocus
                    onChange={e => setEditVal(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditIdx(null); }} />
                ) : (
                  <div className="section-chip-name"><i className="fas fa-grip-vertical" style={{ color: 'var(--text-muted)' }}></i>{s.sectionName}</div>
                )}
                <div className="section-chip-actions">
                  <button className="btn btn-icon btn-ghost btn-sm" onClick={() => startEdit(i)}><i className="fas fa-pen"></i></button>
                  <button className="btn btn-icon btn-danger btn-sm" onClick={() => deleteSection(s)}><i className="fas fa-times"></i></button>
                </div>
              </div>
            ))} */}
            {(sections || []).map((s, i) => (
  <div key={s.sectionID || i} className="section-chip">

    {editIdx === i ? (
      <>
        <input
          className="chip-edit-input"
          value={editVal}
          autoFocus
          onChange={e => setEditVal(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') saveEdit(i);
            if (e.key === 'Escape') {
              setEditIdx(null);
              setEditVal('');
            }
          }}
        />

        <div style={{ display: 'flex', gap: 3 }}>
          <button
            className="btn btn-icon btn-primary btn-sm"
            onClick={() => saveEdit(s)}
          >
            <i className="fas fa-check"></i>
          </button>

          <button
            className="btn btn-icon btn-secondary btn-sm"
            onClick={() => {

              setEditIdx(null);
              setEditVal('');
            }}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      </>
    ) : (
      <>
        <div className="section-chip-name">
          <i className="fas fa-grip-vertical" style={{ color: 'var(--text-muted)' }}></i>
          {s.sectionName}
        </div>

        <div className="section-chip-actions">
          <button
            className="btn btn-icon btn-ghost btn-sm"
            onClick={() => startEdit(i)}
          >
            <i className="fas fa-pen"></i>
          </button>

          <button
            className="btn btn-icon btn-danger btn-sm"
            onClick={() => deleteSection(s)}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      </>
    )}

  </div>
))}
          </div>
          <div className="section-modal-bottom">
            <div className="section-input-row">
              <input className="form-input" placeholder="Section name e.g. A, B, Red Group..." value={newSection}
                onChange={e => setNewSection(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSection()} />
              <button className="btn btn-primary btn-md" onClick={addSection}><i className="fas fa-plus"></i> Add</button>
              
            </div>
            {err && (
  <div className="field-msg error" style={{ marginTop: 8 }}>
    <i className="fas fa-times-circle"></i> {err}
  </div>
)}
            <button className="btn btn-primary btn-md" style={{ justifyContent: 'center' }} onClick={() => { onSave(cls.id, sections); setNewSection(''); setErr('');  onClose();  }}>
              <i className="fas fa-check"></i> Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Fee Modal
function FeeModal({ open, cls, onClose, showToast, onSave, getClassesData }) {
  const [feeHeads, setFeeHeads] = useState([]);
  const [newName, setNewName] = useState('');
  const [newAmt, setNewAmt] = useState('');
  const [nameErr, setNameErr] = useState('');
  const [amtErr, setAmtErr] = useState('');
  const [editIdx, setEditIdx] = useState(null);
  const [editName, setEditName] = useState('');
  const [editAmt, setEditAmt] = useState('');
  React.useEffect(() => {
    if (open && cls) setFeeHeads((cls.feeHeads || []).map(f => ({ ...f })));
  }, [open, cls]);

  const total = feeHeads.reduce((s, f) => s + Number(f.amount), 0);

  const addFeeHead = async() => {
    let valid = true;
    if (!newName.trim()) { setNameErr('Fee head name is required'); valid = false; }
    if (!newAmt || isNaN(newAmt) || Number(newAmt) < 0) { setAmtErr('Enter a valid amount'); valid = false; }
    if (!valid) return;
    // setFeeHeads(prev => [...prev, { name: newName.trim(), amount: Number(newAmt) }]);
    const branchID = sessionStorage.getItem('branchID');
    const userID = sessionStorage.getItem('UserID') || 0;
    try {
    const res = await fetch(buildUrl('/api/LaunchSetup/save-grade-feehead'), {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
         id: 0,
  branchID: branchID,
  gradeID: cls.id,
  headID: 0,
  headName: newName,
  amount: newAmt,
  createdAt: new Date().toISOString(),
  createdBy: userID,
  modifiedAt: new Date().toISOString(),
  modifiedBy: userID,
  isActive: true
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setNameErr(data?.message || 'Data failed');
      return;
    }
     const headRes = await fetch(
      buildUrl(`/api/LaunchSetup/get-grade-feeheads/${branchID}/${cls.id}`),
      {
        headers: { accept: '*/*' },
      }
    );

    const headJson = await headRes.json();

    if (headRes.ok) {
  const updatedSections = (headJson.data || headJson || []).map(item => ({
    feeStructureID: item.id,
    headName: item.headName,
    amount: item.amount
  }));

  setFeeHeads(updatedSections);
}
    getClassesData();
setNewName(''); setNewAmt('');
  } catch (err) {
    setNameErr('Network error. Please try again.');
    console.error(err);
  }
  };

  const startEdit = (i) => { setEditIdx(i); setEditName(feeHeads[i].headName); setEditAmt(String(feeHeads[i].amount)); };
  const saveEdit = async(i) => {
            const branchID = sessionStorage.getItem('branchID');
            const userID = sessionStorage.getItem('UserID') || 0;
 try {
    const res = await fetch(buildUrl('/api/LaunchSetup/save-grade-feehead'), {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
         id: i.feeStructureID,
  branchID: branchID,
  gradeID: cls.id,
  headID: 0,
  headName: editName,
  amount: editAmt,
  createdAt: new Date().toISOString(),
  createdBy: userID,
  modifiedAt: new Date().toISOString(),
  modifiedBy: userID,
  isActive: true
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setNameErr(data?.message || 'Data failed');
      return;
    }
     const headRes = await fetch(
      buildUrl(`/api/LaunchSetup/get-grade-feeheads/${branchID}/${cls.id}`),
      {
        headers: { accept: '*/*' },
      }
    );

    const headJson = await headRes.json();

    if (headRes.ok) {
  const updatedSections = (headJson.data || headJson || []).map(item => ({
    feeStructureID: item.id,
    headName: item.headName,
    amount: item.amount
  }));

  setFeeHeads(updatedSections);
}
    getClassesData();
setEditIdx(null)
  } catch (err) {
    setNameErr('Network error. Please try again.');
    console.error(err);
  }
  };

  const deleteFeeHead = async(f) => {
    console.log(f)
        const branchID = sessionStorage.getItem('branchID');

try {
      const res = await fetch(
      buildUrl(`/api/LaunchSetup/delete-grade-feehead/${f.feeStructureID}`),
      {
        method: 'DELETE',
        headers: {
          Accept: '*/*'
        }
      }
    );
      const json     = await res.json();

    if (!res.ok) {
      showToast(json?.message || 'Delete failed', 'error');
      return;
    }
     const secRes = await fetch(
      buildUrl(`/api/LaunchSetup/get-grade-feeheads/${branchID}/${cls.id}`),
      {
        headers: { accept: '*/*' },
      }
    );

    const secJson = await secRes.json();

    if (secRes.ok) {
const updatedSections = (secJson.data || secJson || []).map(item => ({
    feeStructureID: item.id,
    headName: item.headName,
    amount: item.amount
  }));      
      setFeeHeads(updatedSections); 
    }
      getClassesData()


  } catch (err) {
          showToast(err || 'Delete failed', 'error');
    console.error(err);
  }
  };

  if (!open || !cls) return null;
  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div><div className="modal-title">Fee Structure</div><div className="modal-subtitle">Manage fee heads for: {cls.name}</div></div>
          <button className="modal-close" onClick={() => [onClose(), getClassesData(), setEditIdx(null)]}><i className="fas fa-times"></i></button>
        </div>
        <div className="modal-body">
          <div className="fee-head-list">
            {!feeHeads.length && (
              <div className="empty-mini" style={{ padding: 16, textAlign: 'center' }}>
                <i className="fas fa-receipt"></i>No fee heads yet.
              </div>
            )}
            {(feeHeads || []).map((f, i) => (
              <div key={i} className="fee-head-item">
                {editIdx === i ? (
                  <>
                    <input className="fee-name-input" value={editName} onChange={e => setEditName(e.target.value)} autoFocus />
                    <input className="fee-amt-input" type="number" value={editAmt} onChange={e => setEditAmt(e.target.value)} />
                    <div style={{ display: 'flex', gap: 3 }}>
                      <button className="btn btn-icon btn-primary btn-sm" onClick={() => saveEdit(f)}><i className="fas fa-check"></i></button>
                      <button className="btn btn-icon btn-danger btn-sm" onClick={() => setEditIdx(null)}><i className="fas fa-times"></i></button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="fee-name">{f.headName}</span>
                    <span className="fee-amt">PKR {Number(f.amount).toLocaleString()}</span>
                    <div style={{ display: 'flex', gap: 3 }}>
                      <button className="btn btn-icon btn-ghost btn-sm" onClick={() => startEdit(i)}><i className="fas fa-pen"></i></button>
                      <button className="btn btn-icon btn-danger btn-sm" onClick={() => deleteFeeHead(f)}><i className="fas fa-times"></i></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="fee-total-banner">
            <span className="lbl"><i className="fas fa-receipt" style={{ marginRight: 6, color: 'var(--brand-primary)' }}></i>Total Fee</span>
            <span className="val">PKR {total.toLocaleString()}</span>
          </div>

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 8 }}>Add New Fee Head</div>
            <div className="add-fee-row">
              <div className="input-wrapper">
                <i className="fas fa-tag input-icon"></i>
                <input className={`form-input has-icon${nameErr ? ' error-field' : ''}`} placeholder="e.g. Admission Fee, Monthly Fee..." value={newName}
                  onChange={e => { setNewName(e.target.value); setNameErr(''); }} />
              </div>
              <div className="input-wrapper">
                <i className="fas fa-rupee-sign input-icon"></i>
                <input className={`form-input has-icon${amtErr ? ' error-field' : ''}`} type="number" placeholder="Amount" value={newAmt}
                  onChange={e => { setNewAmt(e.target.value); setAmtErr(''); }}
                  onKeyDown={e => e.key === 'Enter' && addFeeHead()} />
              </div>
            </div>
            {(nameErr || amtErr) && (
              <div style={{ marginTop: 4 }}>
                {nameErr && <span className="field-msg error"><i className="fas fa-times-circle"></i> {nameErr}</span>}
                {amtErr && <span className="field-msg error"><i className="fas fa-times-circle"></i> {amtErr}</span>}
              </div>
            )}
            <button className="btn btn-primary btn-md" style={{ marginTop: 8 }} onClick={addFeeHead}><i className="fas fa-plus"></i> Add Fee Head</button>
          </div>
          <div className="modal-footer">
<button
  className="btn btn-secondary btn-md"
  onClick={() => {
    setNewName('');
    setNewAmt('');
    setEditIdx(null);
    setEditName('');
    setEditAmt('');
    onClose?.();
  }}
>
  Cancel
</button>
            <button className="btn btn-primary btn-md" onClick={() => { setEditIdx(null); onSave(cls.id, feeHeads); onClose(); }}><i className="fas fa-save"></i> Save Fee Structure</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClassesTab({ classesData, setClassesData, schoolInfo, showToast, showSuccess }) {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sectionTarget, setSectionTarget] = useState(null);
  const [feeTarget, setFeeTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const filtered = search ? classesData.filter(c => c.name.toLowerCase().includes(search.toLowerCase())) : classesData;
  const totalSections = classesData.reduce((s, c) => s + c.sections.length, 0);
  const avgSections = classesData.length ? Math.round(totalSections / classesData.length) : 0;

  const handleAdd = (name) => {
    showSuccess('Class Added!', `"${name}" has been added.`, `<strong>Class:</strong> ${name}<br>`);
  };

  const handleSaveSections = (classId, sections) => {
    const cls = classesData.find(c => c.id === classId);
      const sectionNames = sections.map(s => s.sectionName).join(', ');
    showSuccess('Sections Saved!', 'Sections updated successfully.', `<strong>Class:</strong> ${cls?.name}<br><strong>Sections:</strong> ${sectionNames || 'None'}`);
  };

  const handleSaveFee = (classId, feeHeads) => {
    setClassesData(prev => prev.map(c => c.id === classId ? { ...c, feeHeads } : c));
    const cls = classesData.find(c => c.id === classId);
    const tot = feeHeads.reduce((s, f) => s + Number(f.amount), 0);
    showSuccess('Fee Saved!', `Fee structure for "${cls?.name}" saved.`, `<strong>Total:</strong> PKR ${tot.toLocaleString()}`);
  };

  const handleDelete = async(id) => {
    const cls = classesData.find(c => c.id === id);
    if (expandedId === id) setExpandedId(null);
    try {
      const res = await fetch(
      buildUrl(`/api/LaunchSetup/delete-grade/${id}`),
      {
        method: 'DELETE',
        headers: {
          Accept: '*/*'
        }
      }
    );
      const json     = await res.json();

    if (!res.ok) {
        if (
        json?.message?.includes('REFERENCE constraint') ||
        json?.message?.includes('FK_GradeSubjects_SectionID')
      ) {
        showToast(
          'Cannot delete Class because it contains Sections or related data.',
          'error'
        );
                  setDeleteTarget(null);
                  return;
    }
  }
      setDeleteTarget(null);
      getclassesdata()

    if (expandedId === id) setExpandedId(null);

    showToast(`"${cls?.name}" deleted`, 'info');

  } catch (err) {
    console.error(err);
    showToast('Could not delete class', 'error');
  }
  };

  const quickDeleteSection = async(classId, secIdx) => {
    const cls = classesData.find(c => c.id === classId);
    const name = cls?.sections[secIdx];
    try {
      const res = await fetch(
      buildUrl(`/api/LaunchSetup/delete-section/${name.sectionID}`),
      {
        method: 'DELETE',
        headers: {
          Accept: '*/*'
        }
      }
    );
      const json     = await res.json();

    if (!res.ok) {
      showToast(json?.message || 'Delete failed', 'error');
      return;
    }
    
          showToast('Session Deleted Successfully', 'success');
          getclassesdata()


  } catch (err) {
    console.error(err);
    showToast('Could not delete session', 'error');
  }
  };

useEffect(() => {
  getclassesdata();
}, []);

const getclassesdata = useCallback(async () => {
    try {
      const branchID = sessionStorage.getItem('branchID');
      const res      = await fetch(buildUrl(`/api/LaunchSetup/get-grades-by-branch/${branchID}`), { headers: { Accept: '*/*' } });
      const json     = await res.json();
      const d        = json.data ?? {};
      setClassesData(d);
    } catch { showToast('Could not load branch data', 'error'); }
}, [setClassesData, showToast]);

  return (
    <div className="tab-panel active">
      {/* Stats Strip */}
      <div className="stats-strip">
        <div className="stat-mini">
          <div className="stat-icon" style={{ background: 'rgba(30,58,138,.1)', color: 'var(--brand-primary)' }}><i className="fas fa-chalkboard"></i></div>
          <div><div className="stat-val">{classesData.length}</div><div className="stat-lbl">Total Classes</div></div>
        </div>
        <div className="stat-mini">
          <div className="stat-icon" style={{ background: 'rgba(14,165,233,.1)', color: '#0EA5E9' }}><i className="fas fa-layer-group"></i></div>
          <div><div className="stat-val">{avgSections}</div><div className="stat-lbl">Avg. Sections</div></div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="classes-toolbar">
        <div className="toolbar-left">
          <div className="search-box">
            <i className="fas fa-search"></i>
            <input placeholder="Search classes..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-pdf btn-md" onClick={() => downloadClassesReport(classesData, schoolInfo || {}, showToast)}>
            <i className="fas fa-file-pdf"></i> <span className="pdf-btn-label">Download Report</span>
          </button>
          <button className="btn btn-primary btn-md" onClick={() => setShowAddModal(true)}>
            <i className="fas fa-plus"></i> Add New Class
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="classes-table-card">
        <div className="table-head">
          <div className="th">#</div>
          <div className="th">Class Name</div>
          <div className="th">Sections</div>
          <div className="th">Fee Structure</div>
          <div className="th">Details</div>
        </div>
        <div id="classesTableBody">
  {!filtered.length ? (
    <div className="empty-state">
      <div className="empty-icon"><i className="fas fa-chalkboard"></i></div>
      <div className="empty-title">No Classes Yet</div>
      <div className="empty-sub">Click "Add New Class" to start configuring your school's classes.</div>
      <button className="btn btn-primary btn-md" onClick={() => setShowAddModal(true)}><i className="fas fa-plus"></i> Add First Class</button>
    </div>
  ) : filtered.map((cls, i) => {
    const col = COLORS[i % COLORS.length];
    const tot = (cls.feeHeads || []).reduce((s, f) => s + Number(f.amount), 0);
    const pills = (cls.sections.slice(0, 3) || []);
    const extra = (cls.sections|| []).length > 3 ? (cls.sections || []).length - 3 : 0;
    const exp = expandedId === cls.id;
    return (
      <div key={cls.id} className="class-row-wrap">
        <div className={`class-row${exp ? ' expanded-row' : ''}`} onClick={() => setExpandedId(exp ? null : cls.id)}>
          <div className="td"><input className="seq-input" type="number" value={i + 1} readOnly onClick={e => e.stopPropagation()} /></div>
          <div className="td cls-name">
            <div className="class-avatar" style={{ background: col }}>{cls.name.charAt(0).toUpperCase()}</div>
            <div>
              <div style={{ fontWeight: 700 }}>{cls.name}</div>
              {cls.teacher && cls.teacher !== 'TBA' && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{cls.teacher}</div>}
            </div>
          </div>
          <div className="td">
            {(cls.sections || []).length ? (
              <div className="section-pills">
                {pills.map(s => <span key={s} className="section-pill">{s.sectionName}</span>)}
                {extra > 0 && <span className="section-pill more">+{extra}</span>}
              </div>
            ) : <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No sections</span>}
          </div>
          <div className="td">
            {tot > 0 ? (
              <><span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-primary)' }}>PKR {tot.toLocaleString()}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 5 }}>{(cls.feeHeads || []).length} heads</span></>
            ) : <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Not set</span>}
          </div>
          <div className="td details-td">
            <div className="row-actions-overlay" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button title="Manage Sections" onClick={e => { e.stopPropagation(); setSectionTarget(cls); }}
                style={{ width: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 14, background: 'rgba(30,58,138,.08)', color: 'var(--brand-primary)' }}>
                <i className="fas fa-layer-group"></i>
              </button>
              <button title="Fee Structure" onClick={e => { e.stopPropagation(); setFeeTarget(cls); }}
                style={{ width: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 14, background: 'rgba(30,58,138,.08)', color: 'var(--brand-primary)' }}>
                <i className="fas fa-receipt"></i>
              </button>
              <button title="Delete" onClick={e => { e.stopPropagation(); setDeleteTarget(cls); }}
                style={{ width: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 14, background: 'rgba(239,68,68,.1)', color: '#ef4444' }}>
                <i className="fas fa-trash"></i>
              </button>
            </div>
            <button className={`expand-btn${exp ? ' open' : ''}`} onClick={e => { e.stopPropagation(); setExpandedId(exp ? null : cls.id); }}
              style={{ width: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9, border: '1px solid var(--border-light)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, marginLeft: 8, transition: 'transform .2s', transform: exp ? 'rotate(180deg)' : 'none' , }}>
              <i className="fas fa-chevron-down"></i>
            </button>
          </div>
        </div>
        {/* Expand panel */}
        <div className={`class-details-panel${exp ? ' open' : ''}`}>
          {exp && (
            <div className="details-inner">
              <div className="detail-block">
                <div className="detail-block-header">
                  <div className="detail-block-title"><i className="fas fa-layer-group"></i> Section Details</div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSectionTarget(cls)}><i className="fas fa-plus"></i> Add</button>
                </div>
                {(cls.sections || []).length ? (
                  <div className="section-list">
                    {(cls.sections || []).map((s, si) => (
                      <div key={si} className="section-row-item">
                        <span className="sec-name"><i className="fas fa-circle" style={{ fontSize: 7, color: 'var(--brand-primary)' }}></i>{s.sectionName}</span>
                        <div className="sec-actions">
                          <button className="btn btn-icon btn-ghost btn-sm" onClick={() => setSectionTarget(cls)}><i className="fas fa-pen"></i></button>
                          <button className="btn btn-icon btn-danger btn-sm" onClick={() => quickDeleteSection(cls.id, si)}><i className="fas fa-times"></i></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <div className="empty-mini"><i className="fas fa-layer-group"></i>No sections yet</div>}
              </div>
              <div className="detail-block">
                <div className="detail-block-header">
                  <div className="detail-block-title"><i className="fas fa-receipt"></i> Fee Structure</div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setFeeTarget(cls)}><i className="fas fa-pen"></i> Update</button>
                </div>
                {(cls.feeHeads || []).length ? (
                  <>
                    <div className="fee-summary-list">
                      {(cls.feeHeads || []).map((f, fi) => (
                        <div key={fi} className="fee-summary-row">
                          <span className="fee-head-lbl">{f.headName}</span>
                          <span className="fee-head-val">PKR {Number(f.amount).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    <div className="fee-total-row"><span>Total</span><span>PKR {tot.toLocaleString()}</span></div>
                  </>
                ) : <div className="empty-mini"><i className="fas fa-receipt"></i>No fee heads yet</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  })}
</div>
        <div className="pagination">
          <div className="pagination-info">Showing <strong>{filtered.length}</strong> of <strong>{classesData.length}</strong> classes</div>
          <div className="pagination-pages">
            <button className="page-btn"><i className="fas fa-chevron-left"></i></button>
            <button className="page-btn active">1</button>
            <button className="page-btn"><i className="fas fa-chevron-right"></i></button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddClassModal open={showAddModal} onClose={() => setShowAddModal(false)} getClassesData={getclassesdata} onAdd={handleAdd} />
      <SectionsModal open={!!sectionTarget} cls={sectionTarget} onClose={() => [setSectionTarget(null), getclassesdata()]} getClassesData={getclassesdata} onSave={handleSaveSections} />
      {/* <FeeModal open={!!feeTarget} cls={feeTarget} onClose={() => {
    setFeeTarget(null);
    getclassesdata();
  }} onSave={handleSaveFee} getClassesData={getclassesdata} /> */}
  <FeeModal
  open={!!feeTarget}
  cls={feeTarget}
  onClose={() => {
    setFeeTarget(null);
    getclassesdata();
  }}
  showToast = {showToast}
  onSave={handleSaveFee}
  getClassesData={getclassesdata}
/>

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--error)' }}><i className="fas fa-exclamation-triangle" style={{ marginRight: 7 }}></i>Confirm Delete</div>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}><i className="fas fa-times"></i></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
                Are you sure you want to delete <strong>"{deleteTarget.name}"</strong>? This will also remove all associated sections and fee structures.
              </p>
              <div className="modal-footer">
                <button className="btn btn-secondary btn-md" onClick={() => setDeleteTarget(null)}>Cancel</button>
                <button className="btn btn-danger btn-md" onClick={() => handleDelete(deleteTarget.id)}><i className="fas fa-trash"></i> Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
