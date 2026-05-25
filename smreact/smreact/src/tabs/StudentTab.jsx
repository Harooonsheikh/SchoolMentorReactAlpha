import React, { useCallback, useEffect, useState } from 'react';
import { COLORS } from '../data/initialData';
import { downloadStudentReport } from '../utils/pdfReports';
import { buildUrl } from '../utils/apiConfig';

// ── Add/Edit Student Modal ────────────────────────────────────────────────────
function StudentModal({ open, target, editIdx, classesData, onClose, onSave, manualReg }) {
  const [formType, setFormType] = useState('quick');
  const [form, setForm] = useState({
    name: '', lastName: '', fatherName: '', cnic: '', dob: '', gender: '',
    mobile: '', email: '', regNo: '', dues: '0', bloodGroup: '', address: '',
    motherName: '', fatherCnic: '',
  });
  const [errors, setErrors] = useState({});

  const row = target ? classesData.flatMap(cls => {
    const secs = cls.sections?.length ? cls.sections : [null];
    return secs.map(sec => ({ cls, sec, key: `${cls.id}_${sec || 'null'}` }));
  }).find(r => r.key === target) : null;

  React.useEffect(() => {
    if (open) {
      setFormType('quick');
      setErrors({});
      setForm({ name: '', lastName: '', fatherName: '', cnic: '', dob: '', gender: '', mobile: '', email: '', regNo: '', dues: '0', bloodGroup: '', address: '', motherName: '', fatherCnic: '' });
    }
  }, [open, target]);

  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: '' })); };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Student name is required';
    if (!form.fatherName.trim()) e.fatherName = 'Father name is required';
    if (!form.mobile.trim()) e.mobile = 'Contact number is required';
    if (!form.dob) e.dob = 'Date of birth is required';
    if (!form.gender) e.gender = 'Gender is required';
    if (form.dues === '' || isNaN(Number(form.dues)) || Number(form.dues) < 0) e.dues = 'Enter dues (0 if none)';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const student = {
      name: `${form.name.trim()} ${form.lastName.trim()}`.trim(),
      fatherName: form.fatherName, cnic: form.cnic, dob: form.dob,
      gender: form.gender, mobile: form.mobile, email: form.email,
      regNo: form.regNo, dues: form.dues || '0',
      bloodGroup: form.bloodGroup, address: form.address,
      motherName: form.motherName, fatherCnic: form.fatherCnic,
    };
    onSave(target, student, editIdx);
    onClose();
  };

  if (!open || !row) return null;

  const FG = ({ id, label, req, children }) => (
    <div className="form-group">
      <label className="form-label">{label} {req && <span className="req-star">*</span>}</label>
      {children}
      {errors[id] && <span className="field-msg error"><i className="fas fa-times-circle"></i> {errors[id]}</span>}
    </div>
  );

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)', padding: '18px 24px', borderRadius: '20px 20px 0 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>{editIdx >= 0 ? 'Update Student' : 'Add Student'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
                <span style={{ background: 'rgba(255,255,255,.18)', color: '#fff', fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>
                  {row.cls.name}
                </span>
                {row.sec && <span style={{ background: 'rgba(22,163,74,.25)', color: '#4ADE80', fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>
                  Section {row.sec}
                </span>}
              </div>
            </div>
            <button className="modal-close" style={{ background: 'rgba(255,255,255,.15)', color: '#fff', marginTop: 2 }} onClick={onClose}>
              <i className="fas fa-times"></i>
            </button>
          </div>
          {/* Form type toggle */}
          <div style={{ display: 'flex', gap: 4, marginTop: 14, background: 'rgba(0,0,0,.2)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
            {['quick', 'detail'].map(type => (
              <button key={type} onClick={() => setFormType(type)}
                style={{ padding: '7px 18px', fontSize: 12.5, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all .2s',
                  background: formType === type ? 'var(--brand-primary)' : 'transparent',
                  color: formType === type ? '#fff' : 'rgba(255,255,255,.7)', borderRadius: 8,
                  boxShadow: formType === type ? '0 2px 8px rgba(30,58,138,.28)' : 'none' }}>
                {type === 'quick' ? 'Quick Form' : 'Detailed Form'}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-body">
          {formType === 'quick' ? (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-primary)', marginBottom: 14, padding: '8px 12px', background: 'rgba(30,58,138,.06)', borderRadius: 8 }}>
                <i className="fas fa-bolt" style={{ marginRight: 6 }}></i>
                {editIdx >= 0 ? `Updating student in` : `Adding student to`} <strong>{row.cls.name}</strong>{row.sec ? ` · Section ${row.sec}` : ''}
              </div>
              <div className="form-grid form-grid-2" style={{ gap: 12 }}>
                <FG id="name" label="First Name" req>
                  <input className={`form-input${errors.name ? ' error-field' : ''}`} placeholder="First name" value={form.name} onChange={e => set('name', e.target.value)} autoFocus />
                </FG>
                <FG id="lastName" label="Last Name">
                  <input className="form-input" placeholder="Last name" value={form.lastName} onChange={e => set('lastName', e.target.value)} />
                </FG>
                <FG id="fatherName" label="Father Name" req>
                  <input className={`form-input${errors.fatherName ? ' error-field' : ''}`} placeholder="Father's full name" value={form.fatherName} onChange={e => set('fatherName', e.target.value)} />
                </FG>
                <FG id="dob" label="Date of Birth" req>
                  <input className={`form-input${errors.dob ? ' error-field' : ''}`} type="date" value={form.dob} onChange={e => set('dob', e.target.value)} />
                </FG>
                <FG id="gender" label="Gender" req>
                  <select className={`form-select${errors.gender ? ' error-field' : ''}`} value={form.gender} onChange={e => set('gender', e.target.value)}>
                    <option value="">Select gender</option>
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </FG>
                <FG id="mobile" label="Contact Number" req>
                  <input className={`form-input${errors.mobile ? ' error-field' : ''}`} placeholder="+92 300 0000000" value={form.mobile} onChange={e => set('mobile', e.target.value)} />
                </FG>
                <FG id="email" label="Email (optional)">
                  <input className="form-input" type="email" placeholder="student@email.com" value={form.email} onChange={e => set('email', e.target.value)} />
                </FG>
                <FG id="dues" label="Previous Dues (PKR)" req>
                  <div className="input-wrapper">
                    <i className="fas fa-rupee-sign input-icon"></i>
                    <input className={`form-input has-icon${errors.dues ? ' error-field' : ''}`} type="number" min="0" placeholder="0" value={form.dues} onChange={e => set('dues', e.target.value)} />
                  </div>
                </FG>
                {manualReg && (
                  <FG id="regNo" label="Registration Number">
                    <input className="form-input" placeholder="e.g. 245-00001" value={form.regNo} onChange={e => set('regNo', e.target.value)} />
                  </FG>
                )}
                <FG id="cnic" label="B-Form / CNIC (optional)">
                  <input className="form-input" placeholder="35201-1234567-8" value={form.cnic} onChange={e => set('cnic', e.target.value)} />
                </FG>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-primary)', marginBottom: 14, padding: '8px 12px', background: 'rgba(30,58,138,.06)', borderRadius: 8 }}>
                <i className="fas fa-file-alt" style={{ marginRight: 6 }}></i>Detailed student profile
              </div>
              {/* Personal Info */}
              <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>Personal Information</div>
              <div className="form-grid form-grid-2" style={{ gap: 12, marginBottom: 20 }}>
                <FG id="name" label="First Name" req><input className={`form-input${errors.name ? ' error-field' : ''}`} value={form.name} onChange={e => set('name', e.target.value)} /></FG>
                <FG id="lastName" label="Last Name"><input className="form-input" value={form.lastName} onChange={e => set('lastName', e.target.value)} /></FG>
                <FG id="fatherName" label="Father Name" req><input className={`form-input${errors.fatherName ? ' error-field' : ''}`} value={form.fatherName} onChange={e => set('fatherName', e.target.value)} /></FG>
                <FG id="motherName" label="Mother Name"><input className="form-input" value={form.motherName} onChange={e => set('motherName', e.target.value)} /></FG>
                <FG id="dob" label="Date of Birth" req><input className={`form-input${errors.dob ? ' error-field' : ''}`} type="date" value={form.dob} onChange={e => set('dob', e.target.value)} /></FG>
                <FG id="gender" label="Gender" req>
                  <select className={`form-select${errors.gender ? ' error-field' : ''}`} value={form.gender} onChange={e => set('gender', e.target.value)}>
                    <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </FG>
                <FG id="bloodGroup" label="Blood Group">
                  <select className="form-select" value={form.bloodGroup} onChange={e => set('bloodGroup', e.target.value)}>
                    <option value="">Select</option>
                    {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(b => <option key={b}>{b}</option>)}
                  </select>
                </FG>
                <FG id="cnic" label="B-Form / CNIC"><input className="form-input" placeholder="35201-1234567-8" value={form.cnic} onChange={e => set('cnic', e.target.value)} /></FG>
                <FG id="fatherCnic" label="Father's CNIC"><input className="form-input" value={form.fatherCnic} onChange={e => set('fatherCnic', e.target.value)} /></FG>
                <FG id="mobile" label="Contact Number" req><input className={`form-input${errors.mobile ? ' error-field' : ''}`} value={form.mobile} onChange={e => set('mobile', e.target.value)} /></FG>
                <FG id="email" label="Email"><input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} /></FG>
                <div style={{ gridColumn: 'span 2' }}>
                  <FG id="address" label="Address"><textarea className="form-input" rows={2} value={form.address} onChange={e => set('address', e.target.value)} style={{ resize: 'vertical' }} /></FG>
                </div>
              </div>
              {/* Academic Info */}
              <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>Academic & Financial</div>
              <div className="form-grid form-grid-2" style={{ gap: 12 }}>
                {manualReg && <FG id="regNo" label="Registration Number"><input className="form-input" value={form.regNo} onChange={e => set('regNo', e.target.value)} /></FG>}
                <FG id="dues" label="Previous Dues (PKR)" req>
                  <div className="input-wrapper">
                    <i className="fas fa-rupee-sign input-icon"></i>
                    <input className={`form-input has-icon${errors.dues ? ' error-field' : ''}`} type="number" min="0" value={form.dues} onChange={e => set('dues', e.target.value)} />
                  </div>
                </FG>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '14px 24px', borderTop: '1px solid var(--border-light)', background: 'var(--bg-card)', borderRadius: '0 0 20px 20px', flexShrink: 0 }}>
          <button className="btn btn-secondary btn-md" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-md" onClick={handleSave}>
            <i className="fas fa-save"></i> {editIdx >= 0 ? 'Update Student' : 'Add Student'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main StudentTab ───────────────────────────────────────────────────────────
export default function StudentTab({ classesData, setClassesData, studentStrengths, setStudentStrengths, manualReg, 
  setManualReg, schoolInfo, showToast, showSuccess }) {
  const [search, setSearch] = useState('');
  const [expandedKey, setExpandedKey] = useState(null);
  const [page, setPage] = useState(1);
  const [students, setStudents] = useState({}); // { key: [student...] }
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [stuTarget, setStuTarget] = useState(null);
  const [stuEditIdx, setStuEditIdx] = useState(-1);
  const [showImport, setShowImport] = useState(null);
  const [importStep, setImportStep] = useState(1);
        const branchID = sessionStorage.getItem('branchID');
  const [importType, setImportType] = useState('quick');

  const STU_PER_PAGE = 8;

  const buildRows = () => {
    const rows = [];
    classesData.forEach(cls => {
      const secs = cls.sections?.length ? cls.sections : [null];
      secs.forEach(sec => rows.push({ cls, sec }));
    });
    return rows;
  };

  const allRows = buildRows();
  const filtered = search
    ? allRows.filter(({ cls, sec }) =>
        cls.name.toLowerCase().includes(search.toLowerCase()) ||
        (sec && sec.toLowerCase().includes(search.toLowerCase())))
    : allRows;

  const pages = Math.ceil(filtered.length / STU_PER_PAGE) || 1;
  const currentPage = Math.min(page, pages);
  const paged = filtered.slice((currentPage - 1) * STU_PER_PAGE, currentPage * STU_PER_PAGE);

  const getKey = (clsId, sec) => `${clsId}_${sec || 'null'}`;
  const getStudents = (clsId, sec) => students[getKey(clsId, sec)] || [];
  const getStrength = (clsId, sec) => {
    const stuList = getStudents(clsId, sec);
    return stuList.length > 0 ? stuList.length : (studentStrengths[getKey(clsId, sec)] || 0);
  };

  const setStrength = (clsId, sec, val) => {
    setStudentStrengths(prev => ({ ...prev, [getKey(clsId, sec)]: Math.max(0, parseInt(val) || 0) }));
  };

  const handleSaveStudent = (key, student, editIdx) => {
    setStudents(prev => {
      const list = [...(prev[key] || [])];
      if (editIdx >= 0) list[editIdx] = student;
      else list.push(student);
      return { ...prev, [key]: list };
    });
    showSuccess(
      editIdx >= 0 ? 'Student Updated!' : 'Student Added!',
      `"${student.name}" has been ${editIdx >= 0 ? 'updated' : 'enrolled'}.`,
      `<strong>Father:</strong> ${student.fatherName}<br><strong>Mobile:</strong> ${student.mobile}`
    );
  };

  const handleDeleteStudent = (key, idx) => {
    const stu = (students[key] || [])[idx];
    if (!window.confirm(`Remove "${stu?.name}"? This cannot be undone.`)) return;
    setStudents(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== idx) }));
    showToast(`"${stu?.name}" removed`, 'info');
  };

  const openAddStudent = (key) => {
    setStuTarget(key); setStuEditIdx(-1); setShowStudentModal(true);
  };
  const openEditStudent = (key, idx) => {
    setStuTarget(key); setStuEditIdx(idx); setShowStudentModal(true);
  };

  const totalStudents = Object.values(students).reduce((s, list) => s + (list?.length || 0), 0) +
    Object.entries(studentStrengths).filter(([k]) => !(students[k]?.length)).reduce((s, [, v]) => s + (v || 0), 0);
  const totalWithStudents = Object.values(students).filter(l => l?.length > 0).length;


  useEffect(() => {
    getclassesdata();
  }, []);
  
  const getclassesdata = useCallback(async () => {

      try {
        const res      = await fetch(buildUrl(`/api/LaunchSetup/get-grades-by-branch/${branchID}`), { headers: { Accept: '*/*' } });
        const json     = await res.json();
        const d        = json.data ?? {};
        setClassesData(d);
      } catch { showToast('Could not load branch data', 'error'); }
  }, [setClassesData]);


  return (
    <div className="tab-panel active">
      {/* Manual reg toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', marginBottom: 16, boxShadow: 'var(--shadow-sm)', flexWrap: 'wrap' }}>
        <input type="checkbox" id="manualRegToggle" checked={manualReg} onChange={e => setManualReg(e.target.checked)}
          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--brand-primary)', flexShrink: 0 }} />
        <label htmlFor="manualRegToggle" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}>Manual Registration Number</label>
        <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>(Check this if you want to give Registration Number of your choice to students)</span>
      </div>

      {/* Stats */}
      <div className="stats-strip" style={{ marginBottom: 16 }}>
        <div className="stat-mini">
          <div className="stat-icon" style={{ background: 'rgba(30,58,138,.1)', color: 'var(--brand-primary)' }}><i className="fas fa-user-graduate"></i></div>
          <div><div className="stat-val">{totalStudents}</div><div className="stat-lbl">Total Students</div></div>
        </div>
        <div className="stat-mini">
          <div className="stat-icon" style={{ background: 'rgba(22,163,74,.1)', color: 'var(--success)' }}><i className="fas fa-layer-group"></i></div>
          <div><div className="stat-val">{totalWithStudents}</div><div className="stat-lbl">Active Sections</div></div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="classes-toolbar">
        <div className="toolbar-left">
          <div className="search-box">
            <i className="fas fa-search"></i>
            <input placeholder="Search class or section..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-pdf btn-md" onClick={() => downloadStudentReport(classesData, studentStrengths, schoolInfo || {}, showToast)}>
            <i className="fas fa-file-pdf"></i> <span className="pdf-btn-label">Download Report</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="classes-table-card" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div className="student-table-head">
          <div className="th">S. No.</div>
          <div className="th">Class</div>
          <div className="th">Section</div>
          <div className="th">Strength</div>
          <div className="th">Actions</div>
          <div className="th" style={{ textAlign: 'center' }}>Details</div>
        </div>
        <div>
          {!paged.length ? (
            <div className="empty-state">
              <div className="empty-icon"><i className="fas fa-user-graduate"></i></div>
              <div className="empty-title">No Classes Found</div>
              <div className="empty-sub">Add classes and sections in the Classes tab first.</div>
            </div>
          ) : paged.map(({ cls, sec }, i) => {
            const key = getKey(cls.id, sec);
            const exp = expandedKey === key;
            const strength = getStrength(cls.id, sec);
            const stuList = getStudents(cls.id, sec);
            const globalIdx = (currentPage - 1) * STU_PER_PAGE + i + 1;
            return (
              <div key={key} className="student-row-wrap">
                <div className={`student-row${exp ? ' expanded-row' : ''}`} onClick={() => setExpandedKey(exp ? null : key)}>
                  <div className="td" style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: 12 }}>{String(globalIdx).padStart(2, '0')}</div>
                  <div className="td">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div className="class-avatar" style={{ background: COLORS[classesData.findIndex(c => c.id === cls.id) % COLORS.length] }}>
                        {cls.name.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{cls.name}</span>
                    </div>
                  </div>
                  <div className="td">
                    {sec ? <span className="stu-section-pill">{sec.sectionName}</span>
                      : <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No section</span>}
                  </div>
                  {/* Strength input — editable, stops propagation */}
                  <div className="td" onClick={e => e.stopPropagation()}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--brand-primary)', marginRight: 6 }}>{strength}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>students</span>
                  </div>
                  {/* Action buttons */}
                  <div className="td" style={{ gap: 6, flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={e => { e.stopPropagation(); openAddStudent(key); }}
                      style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)', whiteSpace: 'nowrap' }}>
                      <i className="fas fa-user-plus"></i> Add Student
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={e => { e.stopPropagation(); setShowImport({ cls, sec }); setImportStep(1); }}
                      title="Bulk Import">
                      <i className="fas fa-file-import"></i>
                    </button>
                    <button
                      className="btn btn-pdf btn-sm"
                      onClick={e => { e.stopPropagation(); showToast('Section PDF coming soon', 'info'); }}
                      title="Download PDF" style={{ padding: '5px 9px' }}>
                      <i className="fas fa-file-pdf"></i>
                    </button>
                  </div>
                  <div className="td" style={{ justifyContent: 'center' }}>
                    <button className={`expand-btn${exp ? ' open' : ''}`} onClick={e => { e.stopPropagation(); setExpandedKey(exp ? null : key); }}>
                      <i className="fas fa-chevron-down"></i>
                    </button>
                  </div>
                </div>

                {/* Expanded student list */}
                {exp && (
                  <div className="student-expand">
                    <div style={{ background: 'linear-gradient(135deg,#1E40AF,#1E40AF)', borderRadius: '8px 8px 0 0', padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>
                        <i className="fas fa-users" style={{ marginRight: 8, opacity: .85 }}></i>
                        Student List — {cls.name}{sec ? ` · Section ${sec}` : ''}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ background: 'rgba(255,255,255,.18)', color: '#fff', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>
                          {stuList.length} student{stuList.length !== 1 ? 's' : ''}
                        </span>
                        <button onClick={() => openAddStudent(key)}
                          style={{ background: 'rgba(255,255,255,.18)', border: '1.5px solid rgba(255,255,255,.35)', color: '#fff', fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'background .2s', fontFamily: 'var(--font-body)' }}>
                          <i className="fas fa-user-plus"></i> Add Student
                        </button>
                      </div>
                    </div>

                    {!stuList.length ? (
                      <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--bg-muted)', borderRadius: '0 0 8px 8px' }}>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(30,58,138,.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 26, color: 'var(--brand-primary)' }}>
                          <i className="fas fa-user-graduate"></i>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>No Students Enrolled Yet</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>
                          Add students to <strong>{cls.name}</strong>{sec ? ` – Section ${sec}` : ''}
                        </div>
                        <button className="btn btn-primary btn-md" onClick={() => openAddStudent(key)}>
                          <i className="fas fa-user-plus"></i> Add First Student
                        </button>
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto', border: '1px solid var(--border-light)', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                          <thead>
                            <tr style={{ background: '#1E40AF' }}>
                              {['#', 'Reg No', 'Name', 'Father Name', 'DOB', 'Contact', 'Action'].map(h => (
                                <th key={h} style={{ padding: '11px 12px', fontSize: 11.5, fontWeight: 700, color: '#fff', textAlign: h === 'Action' ? 'center' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {stuList.map((s, si) => {
                              const displayRegNo = s.regNo || `245-${String(10001 + si).slice(-4)}`;
                              const rowBg = si % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-muted)';
                              const TD = 'padding:10px 12px;border-bottom:1px solid var(--border-light);font-size:13px;';
                              return (
                                <tr key={si} style={{ background: rowBg }}>
                                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light)', fontWeight: 700, color: 'var(--text-muted)', width: 40 }}>{si + 1}</td>
                                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light)', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 13 }}>{displayRegNo}</td>
                                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light)', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{s.name}</td>
                                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light)', fontSize: 13, color: 'var(--text-secondary)' }}>{s.fatherName || '—'}</td>
                                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light)', fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{s.dob || '—'}</td>
                                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light)', fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{s.mobile || '—'}</td>
                                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                    <button onClick={() => openEditStudent(key, si)}
                                      style={{ background: 'rgba(30,58,138,.08)', border: '1px solid rgba(30,58,138,.2)', color: 'var(--brand-primary)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', marginRight: 5, fontFamily: 'var(--font-body)', fontWeight: 600 }}>
                                      <i className="fas fa-pen"></i>
                                    </button>
                                    <button onClick={() => handleDeleteStudent(key, si)}
                                      style={{ background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.2)', color: '#DC2626', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600 }}>
                                      <i className="fas fa-trash"></i>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          {stuList.reduce((s, x) => s + (Number(x.dues) || 0), 0) > 0 && (
                            <tfoot>
                              <tr style={{ background: 'rgba(30,58,138,.05)', borderTop: '2px solid var(--border-light)' }}>
                                <td colSpan={5} style={{ padding: '10px 12px', fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)' }}>Total Previous Dues</td>
                                <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 800, color: 'var(--brand-primary)' }}>PKR {stuList.reduce((s, x) => s + (Number(x.dues) || 0), 0).toLocaleString()}</td>
                                <td></td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="pagination">
          <div className="pagination-info">Showing <strong>{paged.length}</strong> of <strong>{filtered.length}</strong> rows</div>
          <div className="pagination-pages">
            <button className="page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
              <i className="fas fa-chevron-left"></i>
            </button>
            {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map(p => (
              <button key={p} className={`page-btn${currentPage === p ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button className="page-btn" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={currentPage === pages}>
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <StudentModal
        open={showStudentModal}
        target={stuTarget}
        editIdx={stuEditIdx}
        classesData={classesData}
        manualReg={manualReg}
        onClose={() => setShowStudentModal(false)}
        onSave={handleSaveStudent}
      />

      {/* Import Wizard */}
      {showImport && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setShowImport(null)}>
          <div className="modal modal-xl">
            <div style={{ background: 'linear-gradient(135deg,#4C1D95,#7C3AED)', padding: '18px 24px', borderRadius: '20px 20px 0 0', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>Bulk Import Students</div>
                  <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12, marginTop: 4 }}>
                    {showImport.cls.name}{showImport.sec ? ` · Section ${showImport.sec}` : ''}
                  </div>
                </div>
                <button className="modal-close" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }} onClick={() => { setShowImport(null); setImportStep(1); }}>
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>
            <div className="modal-body">
              {/* Step indicators */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
                {['Choose Format', 'Download Template', 'Upload File', 'Preview & Import'].map((label, i) => {
                  const stepNum = i + 1;
                  const state = importStep === stepNum ? 'active' : importStep > stepNum ? 'done' : 'idle';
                  return (
                    <React.Fragment key={i}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, border: '1.5px solid', borderColor: state === 'active' ? '#7C3AED' : state === 'done' ? '#16A34A' : 'var(--border-light)', background: state === 'active' ? '#EDE9FE' : state === 'done' ? '#DCFCE7' : 'var(--bg-card)', color: state === 'active' ? '#6D28D9' : state === 'done' ? '#15803D' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {state === 'done' ? <i className="fas fa-check"></i> : stepNum}
                        {(state === 'active') && <span style={{ marginLeft: 3 }}>{label}</span>}
                      </div>
                      {i < 3 && <div style={{ flex: 1, height: 2, background: state === 'done' ? '#16A34A' : 'var(--border-light)', minWidth: 10 }}></div>}
                    </React.Fragment>
                  );
                })}
              </div>

              {importStep === 1 && (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Select Import Format</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    {[{ key: 'quick', label: 'Quick Import', icon: 'fa-bolt', desc: 'Name, class, section, contact. Fastest option.', cols: 4 },
                      { key: 'detailed', label: 'Detailed Import', icon: 'fa-file-alt', desc: 'Full student profile with all optional fields.', cols: 12 }
                    ].map(opt => (
                      <div key={opt.key} onClick={() => setImportType(opt.key)}
                        style={{ border: `2px solid ${importType === opt.key ? '#7C3AED' : 'var(--border-light)'}`, borderRadius: 'var(--radius-lg)', padding: 18, cursor: 'pointer', background: importType === opt.key ? '#F5F3FF' : 'var(--bg-card)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 9, background: importType === opt.key ? '#EDE9FE' : 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C3AED', fontSize: 15 }}>
                            <i className={`fas ${opt.icon}`}></i>
                          </div>
                          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>{opt.label}</div>
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>{opt.desc}</div>
                        <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: '#7C3AED' }}>{opt.cols} columns</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importStep === 2 && (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Download Template</div>
                  <div style={{ background: 'linear-gradient(135deg,#15803D,#166534)', borderRadius: 'var(--radius-md)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                    <i className="fas fa-file-csv" style={{ color: '#fff', fontSize: 28 }}></i>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#fff', fontWeight: 700 }}>{importType === 'quick' ? 'Quick' : 'Detailed'} Student Import Template.csv</div>
                      <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 11 }}>CSV format · Ready to fill</div>
                    </div>
                    <button className="btn btn-md" style={{ background: '#fff', color: '#15803D', fontWeight: 700 }} onClick={() => showToast('Template downloaded', 'success')}>
                      <i className="fas fa-download"></i> Download
                    </button>
                  </div>
                  <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-secondary)' }}>
                    <i className="fas fa-exclamation-triangle" style={{ color: 'var(--warning)', marginRight: 6 }}></i>
                    <strong>Note:</strong> Do not change column headers. Date format: DD/MM/YYYY. Gender: Male/Female/Other.
                  </div>
                </div>
              )}

              {importStep === 3 && (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Upload Filled Template</div>
                  <div onClick={() => showToast('File browser would open here', 'info')}
                    style={{ border: '2px dashed var(--border-med)', borderRadius: 'var(--radius-lg)', padding: 40, textAlign: 'center', cursor: 'pointer', background: 'var(--bg-muted)' }}>
                    <i className="fas fa-cloud-upload-alt" style={{ fontSize: 40, color: 'var(--brand-primary)', opacity: .4, display: 'block', marginBottom: 12 }}></i>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Drag & Drop your file here</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 }}>or click to browse</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Supported: .csv, .xlsx, .xls · Max 5MB</div>
                  </div>
                </div>
              )}

              {importStep === 4 && (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Preview Import Data</div>
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <i className="fas fa-table" style={{ fontSize: 32, opacity: .3, display: 'block', marginBottom: 12 }}></i>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>No data to preview</div>
                    <div style={{ fontSize: 12.5, marginTop: 4 }}>Upload a file in step 3 first</div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-light)', flexWrap: 'wrap', gap: 10 }}>
                <div>{importStep > 1 && <button className="btn btn-secondary btn-md" onClick={() => setImportStep(s => s - 1)}><i className="fas fa-arrow-left"></i> Back</button>}</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-ghost btn-md" onClick={() => { setShowImport(null); setImportStep(1); }}>Cancel</button>
                  {importStep < 4
                    ? <button className="btn btn-md" style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', color: '#fff' }} onClick={() => setImportStep(s => s + 1)}>Next <i className="fas fa-arrow-right"></i></button>
                    : <button className="btn btn-md" style={{ background: 'linear-gradient(135deg,#15803D,#166534)', color: '#fff' }} onClick={() => { showSuccess('Import Complete!', 'Student data imported successfully.'); setShowImport(null); setImportStep(1); }}><i className="fas fa-check"></i> Confirm Import</button>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
