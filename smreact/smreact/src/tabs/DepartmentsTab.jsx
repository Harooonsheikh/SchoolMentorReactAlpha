import React, { useCallback, useEffect, useState } from 'react';
import { downloadDeptReport } from '../utils/pdfReports';
import { buildUrl } from '../utils/apiConfig';

function AddDeptModal({ open, onClose, onAdd, getDeparmentdata, editDept = null }) {
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const UserID = sessionStorage.getItem('UserID');
  const branchID = sessionStorage.getItem('branchID');
  const isEdit = !!editDept;

  useEffect(() => {
    if (!open) return;
    setName(editDept ? (editDept.departmentName || editDept.name || '') : '');
    setErr('');
  }, [open, editDept]);

  const handleAdd = async() => {
    if (!name.trim()) { setErr('Department name is required'); return; }
 try {
      const branchID = sessionStorage.getItem('branchID');
    const userID = sessionStorage.getItem('UserID') || 0;

    /* Edit reuses the add endpoint with the department id and preserves its
       existing designations so a rename doesn't wipe them. */
    const designations = isEdit && (editDept.designations || []).length
      ? editDept.designations.map(d => ({
          designationID: d.designationID ?? 0,
          branchID: Number(branchID) || 0,
          branchDepartmentID: editDept.id,
          designationName: d.designationName ?? d.name ?? '',
          description: d.description ?? '',
          qualificationID: d.qualificationID ?? 0,
          qualificationName: d.qualificationName ?? d.qual ?? '',
          createdBy: Number(userID) || 0,
          modifiedBy: Number(userID) || 0,
        }))
      : [
          {
            designationID: 0,
            branchID: 0,
            branchDepartmentID: 0,
            designationName: "",
            description: "",
            qualificationID: 0,
            qualificationName: "",
            createdBy: 0,
            modifiedBy: 0,
          },
        ];

    const payload = {
      id: isEdit ? editDept.id : 0,
      branchID: branchID,
      departmentName: name,
      totalDesignationCount: isEdit ? (editDept.designations || []).length : 0,
      createdBy: Number(userID),
      modifiedBy: userID,
      designations,
    };
    console.log(payload)
    const res = await fetch(buildUrl('/api/LaunchSetup/save-department'), {
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
    getDeparmentdata();
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
          <div><div className="modal-title">{isEdit ? 'Edit Department' : 'Add Department'}</div><div className="modal-subtitle">{isEdit ? 'Update the department name' : 'Create a new department'}</div></div>
          <button className="modal-close" onClick={onClose}><i className="fas fa-times"></i></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Department Name <span className="req-star">*</span></label>
            <div className="input-wrapper">
              <i className="fas fa-building input-icon"></i>
              <input className={`form-input has-icon${err ? ' error-field' : ''}`} placeholder="e.g. Administration, Academics..." value={name}
                onChange={e => { setName(e.target.value); setErr(''); }}
                onKeyDown={e => e.key === 'Enter' && handleAdd()} autoFocus />
            </div>
            {err && <span className="field-msg error"><i className="fas fa-times-circle"></i> {err}</span>}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary btn-md" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary btn-md" onClick={handleAdd}><i className={`fas ${isEdit ? 'fa-save' : 'fa-plus'}`}></i> {isEdit ? 'Save Changes' : 'Add Department'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddDesigModal({ open, dept, onClose, onAdd,  getDeparmentdata, showToast}) {
  const [name, setName] = useState('');
  const [qual, setQual] = useState({});
  const [job, setJob] = useState('');
  const [err, setErr] = useState('');
  const [err2, setErr2] = useState('');
  const [Qualification, setQualification] = useState({});

  useEffect(() => {
    if (open) getQualification();
  }, [open])


   async function getQualification() {
      try {
        const res  = await fetch(buildUrl(`/api/LaunchSetup/get-qualifications/0`), { headers: { Accept: '*/*' } });
        const json = await res.json();
        setQualification(json.data ?? []);
        console.log(Qualification)
      } catch { showToast('Could not load cities', 'error'); }
    }

  const handleAdd = async() => {
    if (!name.trim()) { setErr('Designation name is required'); return; }
        if (!qual.id) { setErr2('Qualification is required'); return; }

    try {
      const branchID = sessionStorage.getItem('branchID');
    const userID = sessionStorage.getItem('UserID') || 0;

    const payload = {
      designationID: 0,
      branchID: branchID,
      branchDepartmentID: dept.id,
      designationName: name,
      description: job,
      qualificationID: qual.id,
      qualificationName: qual.qualificationName,
      createdBy: Number(userID),
      modifiedBy: userID,
    };
    console.log(payload)
    const res = await fetch(buildUrl('/api/LaunchSetup/save-department-designation'), {
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
setQual({});
setJob('');
    setErr('');
    setErr2('');
    getDeparmentdata();
    onClose();

  } catch (err) {
    console.error(err);
    setErr('Network error. Please try again.');
  }
    onAdd(dept.id, { name: name.trim(), qual: qual.qualificationName.trim(), job: job.trim() });
    setName(''); setQual(''); setJob(''); setErr(''); onClose();
  };

  if (!open || !dept) return null;
  return (
   <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
  <div className="modal modal-md">
    <div className="modal-header">
      <div>
        <div className="modal-title">
          Add a new post in <span style={{ color: 'var(--brand-primary)' }}>{dept.name}</span>
        </div>
        <div className="modal-subtitle">Add a designation or post to this department</div>
      </div>
      <button className="modal-close" onClick={onClose}><i className="fas fa-times"></i></button>
    </div>

    <div className="modal-body">
      {/* Two-column row: Post Name + Qualification */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div className="form-group">
          <label className="form-label">Post Name <span className="req-star">*</span></label>
          <div className="input-wrapper" style={{ position: 'relative' }}>
            <i className="fas fa-id-badge input-icon"></i>
            <input
              className={`form-input has-icon${err ? ' error-field' : ''}`}
              placeholder="e.g. Principal, Teacher, Accountant..."
              value={name}
              onChange={e => { setName(e.target.value); setErr(''); }}
              autoFocus
            />
          </div>
          {err && <span className="field-msg error"><i className="fas fa-times-circle"></i> {err}</span>}
        </div>

        <div className="form-group">
          <label className="form-label">Qualification Required</label>
          <div className="input-wrapper" style={{ position: 'relative' }}>
            <i className="fas fa-graduation-cap input-icon"></i>
            <select
              className={`form-select has-icon${err2 ? ' error-field' : ''}`}
              value={qual.id ?? ''}
              onChange={e => {
                const list = Array.isArray(Qualification) ? Qualification : [];
                const selected = list.find(q => String(q.id) === e.target.value);
                setQual(selected || {});
                setErr2('');
              }}
            >
              <option value="">Select qualification</option>
              {(Array.isArray(Qualification) ? Qualification : []).map(q => (
                <option key={q.id} value={q.id}>{q.qualificationName}</option>
              ))}
            </select>
          </div>
          {err2 && <span className="field-msg error"><i className="fas fa-times-circle"></i> {err2}</span>}
        </div>
      </div>

      {/* Full-width Job Description textarea */}
      <div className="form-group">
        <label className="form-label">Job Description</label>
        <textarea
          className="form-input"
          placeholder="Brief description of the job role..."
          value={job}
          onChange={e => setJob(e.target.value)}
          rows={3}
          style={{ resize: 'vertical', minHeight: 80, paddingTop: 10 }}
        />
      </div>

      <div className="modal-footer">
        <button className="btn btn-secondary btn-md" onClick={() => [setName(''),
setQual({}),
setJob(''),
setErr2(''),
    setErr(''), onClose()]}>Cancel</button>
        <button className="btn btn-primary btn-md" onClick={handleAdd}>
          <i className="fas fa-save"></i> Save
        </button>
      </div>
    </div>
  </div>
</div>
  );
}

export default function DepartmentsTab({ deptsData, setDeptsData, schoolInfo, showToast, showSuccess, onContinue }) {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [showAddDept, setShowAddDept] = useState(false);
  const [editDept, setEditDept] = useState(null); // department being edited (name)
  const [desigTarget, setDesigTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [editDesigTarget, setEditDesigTarget] = useState(null); // { deptId, idx }
  const [editDesigForm, setEditDesigForm] = useState({});
  const [Qualification, setQualification] = useState({});



   async function getQualification() {
      try {
        const res  = await fetch(buildUrl(`/api/LaunchSetup/get-qualifications/0`), { headers: { Accept: '*/*' } });
        const json = await res.json();
        setQualification(json.data ?? []);
        console.log(Qualification)
      } catch { showToast('Could not load cities', 'error'); }
    }

  useEffect(() => {
    getDeparmentdata();
  }, []);
  
  const getDeparmentdata = useCallback(async () => {
      try {
        const branchID = sessionStorage.getItem('branchID');
        const res      = await fetch(buildUrl(`/api/LaunchSetup/get-departments-by-branch/${branchID}`), { headers: { Accept: '*/*' } });
        const json     = await res.json();
        const d        = json.data ?? {};
        setDeptsData(d);
        console.log(deptsData) 
      } catch { showToast('Could not load branch data', 'error'); }
  }, [setDeptsData, showToast]);

  const handleEditDesig = (deptId, idx) => {
    const dept = deptsData.find(d => d.id === deptId);
    const d = dept?.designations[idx];
    if (!d) return;
    getQualification();
    setEditDesigTarget({ deptId, idx });
    setEditDesigForm(d);
    console.log(editDesigForm)
  };

  const saveDesigEdit = async() => {
    if (!editDesigForm.designationName.trim()) return;
    console.log(editDesigForm)
    try {
      const branchID = sessionStorage.getItem('branchID');
    const userID = sessionStorage.getItem('UserID') || 0;

    const payload = {
      designationID: editDesigForm.designationID,
      branchID: branchID,
      branchDepartmentID: editDesigForm.branchDepartmentID,
      designationName: editDesigForm.designationName,
      description: editDesigForm.description,
      qualificationID: editDesigForm.qualificationID,
      qualificationName: editDesigForm.qualificationName,
      createdBy: Number(userID),
      modifiedBy: userID,
    };
    console.log(payload)
    const res = await fetch(buildUrl('/api/LaunchSetup/save-department-designation'), {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data?.message || 'Data failed', 'error');
      return;
    }
setEditDesigForm({});
    getDeparmentdata();
    setEditDesigTarget(null);

  } catch (err) {
    console.error(err);
    showToast('Network error. Please try again.', 'error');
  }
  };
  const filtered = search ? deptsData.filter(d => d.name.toLowerCase().includes(search.toLowerCase())) : deptsData;
  
const totalPosts = (deptsData || []).reduce(
  (sum, dept) => sum + (dept.designations?.length || 0),
  0
);
  const handleAddDept = (name) => {
    setDeptsData(prev => [...prev, { id: Date.now(), name, designations: [] }]);
    showToast(`Department "${name}" added`, 'success');
  };

  const handleAddDesig = (deptId, desig) => {
    setDeptsData(prev => prev.map(d => d.id === deptId ? { ...d, designations: [...d.designations, desig] } : d));
    showToast('Designation added', 'success');
  };

  const handleDeleteDesig = async(deptId, idx) => {
const dept = deptsData.find(d => d.id === deptId);
    const d = dept?.designations[idx];
  console.log(d)
     try {
          const res = await fetch(
          buildUrl(`/api/LaunchSetup/delete-designation/${d.designationID}`),
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
          getDeparmentdata()
          showToast('Designation removed', 'info');

    
      } catch (err) {
        console.error(err);
        showToast('Could not delete Designation', 'error');
      }
  };

  const handleDeleteDept = async(id) => {
    console.log(id)
     try {
          const res = await fetch(
          buildUrl(`/api/LaunchSetup/delete-department/${id}`),
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
        json?.message?.includes('FK_AHM_Department_Designations_Department')
      ) {
        showToast(
          'Cannot delete department because it contains designations or related data.',
          'error'
        );
                  setDeleteTarget(null);

      } else {
        showToast(json?.message || 'Delete failed', 'error');
                  setDeleteTarget(null);

      }

      return;
    }
          getDeparmentdata()
                  showToast(`"${deleteTarget?.departmentName}" deleted`, 'info');
          setDeleteTarget(null);
      } catch (err) {
        console.error(err);
                  setDeleteTarget(null);
        showToast('Could not delete department', 'error');
      }
  };

  return (
    <div className="tab-panel active">
      <div className="classes-toolbar">
        <div className="toolbar-left">
          <div className="search-box">
            <i className="fas fa-search"></i>
            <input placeholder="Search departments..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}> {Array.isArray(deptsData) ? deptsData.length : 0} departments · {totalPosts} posts</span>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-pdf btn-md" onClick={() => downloadDeptReport(deptsData, schoolInfo || {}, showToast)}>
            <i className="fas fa-file-pdf"></i> Download Report
          </button>
          <button className="btn btn-primary btn-md" onClick={() => setShowAddDept(true)}>
            <i className="fas fa-plus"></i> Add New Department
          </button>
        </div>
      </div>

      <div className="classes-table-card" style={{ overflowX: 'auto' }}>
        <div className="dept-table-head">
          <div className="th">#</div>
          <div className="th">Department</div>
          <div className="th">Designations</div>
          <div className="th">Details</div>
        </div>
        <div>
          {!filtered.length ? (
            <div className="empty-state">
              <div className="empty-icon"><i className="fas fa-building"></i></div>
              <div className="empty-title">No Departments Yet</div>
              <div className="empty-sub">Add your first department to get started.</div>
              <button className="btn btn-primary btn-md" onClick={() => setShowAddDept(true)}><i className="fas fa-plus"></i> Add Department</button>
            </div>
          ) : filtered.map((dept, i) => {
            const exp = expandedId === dept.id;
            return (
              <div key={dept.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                <div className={`dept-row${exp ? ' expanded-row' : ''}`} onClick={() => setExpandedId(exp ? null : dept.id)}>
                  <div className="td" style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: 11.5 }}>{String(i + 1).padStart(2, '0')}</div>
                  <div className="td">
                    <span className="dept-pill"><i className="fas fa-building" style={{ fontSize: 11 }}></i>{dept.departmentName}</span>
                  </div>
                  {/* <div className="td">
                    <span style={{ fontSize: 12, fontWeight: 700, color: dept.designations.length ? 'var(--brand-primary)' : 'var(--text-muted)' }}>
                      {dept.designations.length} post{dept.designations.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="td" style={{ gap: 5 }}>
                    <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); setDesigTarget(dept); }}>
                      <i className="fas fa-plus"></i> Add Post
                    </button>
                    <button className="btn btn-icon btn-danger btn-sm" onClick={e => { e.stopPropagation(); setDeleteTarget(dept); }}>
                      <i className="fas fa-trash"></i>
                    </button>
                    <button className={`expand-btn${exp ? ' open' : ''}`} onClick={e => { e.stopPropagation(); setExpandedId(exp ? null : dept.id); }}>
                      <i className="fas fa-chevron-down"></i>
                    </button>
                  </div> */}
                  {/* Designations column */}
<div className="td">
  <button
    className="btn btn-sm"
    onClick={e => { e.stopPropagation(); setDesigTarget(dept); }}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 18px',
      background: 'linear-gradient(135deg, #2563eb, #1e40af)',
      color: '#fff',
      border: 'none',
      borderRadius: 24,
      fontSize: 13.5,
      fontWeight: 600,
      cursor: 'pointer',
      boxShadow: '0 6px 16px rgba(37,99,235,.35)',
      whiteSpace: 'nowrap',
    }}
  >
    <i className="fas fa-plus"></i> Designation
  </button>
  {dept.designations.length > 0 && (
    <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 12, whiteSpace: 'nowrap' }}>
      {dept.designations.length} post{dept.designations.length !== 1 ? 's' : ''}
    </span>
  )}
</div>

{/* Details column */}
<div className="td" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
  <button
    onClick={e => { e.stopPropagation(); setEditDept(dept); }}
    title="Edit department name"
    style={{
      width: 38,
      height: 38,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(30,64,175,.1)',
      color: 'var(--brand-primary)',
      border: 'none',
      borderRadius: 10,
      cursor: 'pointer',
      fontSize: 14,
    }}
  >
    <i className="fas fa-pen"></i>
  </button>
  <button
    onClick={e => { e.stopPropagation(); setDeleteTarget(dept); }}
    title="Delete department"
    style={{
      width: 38,
      height: 38,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(239,68,68,.1)',
      color: '#ef4444',
      border: 'none',
      borderRadius: 10,
      cursor: 'pointer',
      fontSize: 14,
    }}
  >
    <i className="fas fa-trash"></i>
  </button>
  <button
    className={`expand-btn${exp ? ' open' : ''}`}
    onClick={e => { e.stopPropagation(); setExpandedId(exp ? null : dept.id); }}
    style={{
      width: 38,
      height: 38,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'transparent',
      color: 'var(--text-secondary)',
      border: '1px solid var(--border-light)',
      borderRadius: 10,
      cursor: 'pointer',
      fontSize: 13,
      transition: 'transform .2s',
      transform: exp ? 'rotate(180deg)' : 'none',
    }}
  >
    <i className="fas fa-chevron-down"></i>
  </button>
</div>
                </div>
                {exp && (
                  <div style={{ background: 'var(--bg-base)', borderTop: '1px solid var(--border-light)' }}>
                    <div style={{ padding: '12px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-primary)' }}>
                        <i className="fas fa-id-badge" style={{ marginRight: 6 }}></i>{dept.name} — Designations
                      </span>
                      <button className="btn btn-ghost btn-sm" onClick={() => setDesigTarget(dept)}>
                        <i className="fas fa-plus"></i> Add
                      </button>
                    </div>
                    <div className="desig-list">
                     <div className="desig-list">
 <div className="desig-list">
  {!dept.designations.length ? (
    <div className="empty-mini"><i className="fas fa-id-badge"></i>No designations yet</div>
  ) : dept.designations.map((d, di) => (
    <div key={di} className="desig-item">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginTop: 1 }}>{di + 1}.</span>
        <div>
          <div className="desig-name">
            {d.designationName}
            {d.qualificationName && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>- {d.qualificationName}</span>
            )}
          </div>
          {d.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{d.description}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => handleEditDesig(dept.id, di)}
          title="Edit designation"
          style={{
            width: 38,
            height: 38,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(30,58,138,.08)',
            color: 'var(--brand-primary)',
            border: 'none',
            borderRadius: 10,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          <i className="fas fa-pen"></i>
        </button>
        <button
          onClick={() => handleDeleteDesig(dept.id, di)}
          title="Delete designation"
          style={{
            width: 38,
            height: 38,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(239,68,68,.1)',
            color: '#ef4444',
            border: 'none',
            borderRadius: 10,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          <i className="fas fa-trash"></i>
        </button>
      </div>
    </div>
  ))}
</div>
</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="pagination">
          <div className="pagination-info">Showing <strong>{filtered.length}</strong> of <strong>{deptsData.length}</strong> departments</div>
        </div>
      </div>

      <AddDeptModal open={showAddDept} onClose={() => setShowAddDept(false)} onAdd={handleAddDept}  getDeparmentdata={getDeparmentdata}/>
      <AddDeptModal open={!!editDept} editDept={editDept} onClose={() => setEditDept(null)} getDeparmentdata={getDeparmentdata} />
      <AddDesigModal open={!!desigTarget} dept={desigTarget} onClose={() => setDesigTarget(null)} onAdd={handleAddDesig} getDeparmentdata={getDeparmentdata} showToast={showToast}/>

      {/* Edit Designation Modal */}
      {editDesigTarget && (
  <div
    className="modal-overlay open"
    onClick={e => e.target === e.currentTarget && setEditDesigTarget(null)}
  >
    <div className="modal modal-md">
      <div className="modal-header">
        <div>
          <div className="modal-title">
            Edit Designation in{" "}
            <span style={{ color: "var(--brand-primary)" }}>
              {editDesigTarget.departmentName || editDesigTarget.name}
            </span>
          </div>
          <div className="modal-subtitle">
            Update designation details
          </div>
        </div>

        <button
          className="modal-close"
          onClick={() => setEditDesigTarget(null)}
        >
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div className="modal-body">
        {/* Two-column row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div className="form-group">
            <label className="form-label">
              Designation Title <span className="req-star">*</span>
            </label>

            <div
              className="input-wrapper"
              style={{ position: "relative" }}
            >
              <i className="fas fa-id-badge input-icon"></i>

              <input
                className="form-input has-icon"
                placeholder="e.g. Principal, Teacher, Accountant..."
                value={editDesigForm.designationName}
                onChange={e =>
                  setEditDesigForm(f => ({
                    ...f,
                    designationName: e.target.value,
                  }))
                }
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Qualification Required
            </label>

            <div
              className="input-wrapper"
              style={{ position: "relative" }}
            >
              <i className="fas fa-graduation-cap input-icon"></i>

              <select
                className="form-select has-icon"
                value={editDesigForm.qualificationID ?? ''}
                onChange={e => {
                  const list = Array.isArray(Qualification) ? Qualification : [];
                  const selected = list.find(q => String(q.id) === e.target.value);
                  setEditDesigForm(f => ({
                    ...f,
                    qualificationID: selected ? selected.id : '',
                    qualificationName: selected ? selected.qualificationName : '',
                  }));
                }}
              >
                <option value="">Select qualification</option>
                {(Array.isArray(Qualification) ? Qualification : []).map(q => (
                  <option key={q.id} value={q.id}>{q.qualificationName}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Full Width Description */}
        <div className="form-group">
          <label className="form-label">
            Job Description
          </label>

          <textarea
            className="form-input"
            placeholder="Brief description of the job role..."
            value={editDesigForm.description}
            onChange={e =>
              setEditDesigForm(f => ({
                ...f,
                description: e.target.value,
              }))
            }
            rows={3}
            style={{
              resize: "vertical",
              minHeight: 80,
              paddingTop: 10,
            }}
          />
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-secondary btn-md"
            onClick={() => setEditDesigTarget(null)}
          >
            Cancel
          </button>

          <button
            className="btn btn-primary btn-md"
            onClick={saveDesigEdit}
          >
            <i className="fas fa-save"></i> Save Changes
          </button>
        </div>
      </div>
    </div>
  </div>
)}

      {deleteTarget && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--error)' }}><i className="fas fa-exclamation-triangle" style={{ marginRight: 7 }}></i>Delete Department</div>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}><i className="fas fa-times"></i></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
                Are you sure you want to delete <strong>"{deleteTarget.departmentName}"</strong>?
              </p>
              <div className="modal-footer">
                <button className="btn btn-secondary btn-md" onClick={() => setDeleteTarget(null)}>Cancel</button>
                <button className="btn btn-danger btn-md" onClick={() => handleDeleteDept(deleteTarget.id)}><i className="fas fa-trash"></i> Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

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
