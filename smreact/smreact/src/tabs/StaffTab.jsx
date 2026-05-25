import React, { useState } from 'react';
import { COLORS } from '../data/initialData';
import { downloadStaffReport } from '../utils/pdfReports';

const STAFF_PER_PAGE = 8;

const GENDER = ['Male', 'Female', 'Other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const MARITAL = ['Single', 'Married', 'Divorced', 'Widowed'];

function StaffModal({ open, staff, deptsData, onClose, onSave }) {
  const [tab, setTab] = useState('personal');
  const [subTab, setSubTab] = useState('official');
  const [form, setForm] = useState({});

  React.useEffect(() => {
    if (open && staff) setForm({ ...staff });
    if (!open) { setTab('personal'); setSubTab('official'); }
  }, [open, staff]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set('profileImage', reader.result);
    reader.readAsDataURL(file);
  };

  if (!open) return null;

  const allDesig = deptsData.flatMap(d => d.designations.map(x => x.name));
  const isNew = !staff?.id || staff?.id === 'new';

  // small green "looks good" helper
  const Good = ({ show, text }) => show ? (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--success)', marginTop: 5 }}>
      <i className="fas fa-check-circle" style={{ fontSize: 12 }}></i> {text}
    </span>
  ) : null;

  // footer button changes per tab/subtab
  const footerBtn = () => {
    if (tab === 'personal') {
      return (
        <button className="btn btn-primary btn-md" onClick={() => setTab('employee')}>
          <i className="fas fa-save"></i> Save
        </button>
      );
    }
    if (subTab === 'official') {
      return (
        <button className="btn btn-primary btn-md" onClick={() => setSubTab('salary')}>
          <i className="fas fa-arrow-right"></i> Save & Next
        </button>
      );
    }
    return (
      <button className="btn btn-primary btn-md" onClick={() => { onSave(form); onClose(); }}>
        <i className="fas fa-save"></i> Save & Close
      </button>
    );
  };

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl" style={{ maxHeight: '90vh' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Employment Details of</div>
            <div className="modal-subtitle">Fill in all sections carefully</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--brand-primary)', marginTop: 2 }}>
              {isNew ? 'New Employee' : `${form.firstName || ''} ${form.lastName || ''}`}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><i className="fas fa-times"></i></button>
        </div>

        <div className="modal-body">
          {/* Main tabs */}
          <div className="emp-modal-tabs">
            <button className={`emp-tab-btn${tab === 'personal' ? ' active' : ''}`} onClick={() => setTab('personal')}>
              <i className="fas fa-user" style={{ marginRight: 6 }}></i>Personal Information
            </button>
            <button className={`emp-tab-btn${tab === 'employee' ? ' active' : ''}`} onClick={() => setTab('employee')}>
              <i className="fas fa-briefcase" style={{ marginRight: 6 }}></i>Employee Details
            </button>
          </div>

          {/* ── PERSONAL ── */}
          {tab === 'personal' && (
            <>
              <div className="form-grid form-grid-2" style={{ gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">First name <span className="req-star">*</span></label>
                  <div className="input-wrapper">
                    <i className="fas fa-user input-icon"></i>
                    <input className="form-input has-icon" value={form.firstName || ''} onChange={e => set('firstName', e.target.value)} placeholder="First name" />
                  </div>
                  <Good show={!!form.firstName?.trim()} text="Looks good" />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <div className="input-wrapper">
                    <i className="fas fa-user input-icon"></i>
                    <input className="form-input has-icon" value={form.lastName || ''} onChange={e => set('lastName', e.target.value)} placeholder="Enter Last Name" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Father / Husband name <span className="req-star">*</span></label>
                  <div className="input-wrapper">
                    <i className="fas fa-users input-icon"></i>
                    <input className="form-input has-icon" value={form.fatherName || ''} onChange={e => set('fatherName', e.target.value)} placeholder="Enter name" />
                  </div>
                  <Good show={!!form.fatherName?.trim()} text="Looks good" />
                </div>
                <div className="form-group">
                  <label className="form-label">CNIC <span className="req-star">*</span></label>
                  <div className="input-wrapper">
                    <i className="fas fa-id-card input-icon"></i>
                    <input className="form-input has-icon" value={form.cnic || ''} onChange={e => set('cnic', e.target.value)} placeholder="35201-1234567-8" />
                  </div>
                  <Good show={!!form.cnic?.trim()} text="Looks good" />
                </div>
                <div className="form-group">
                  <label className="form-label">Date of Birth</label>
                  <div className="input-wrapper">
                    <i className="fas fa-calendar input-icon"></i>
                    <input className="form-input has-icon" type="date" value={form.dob || ''} onChange={e => set('dob', e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select className="form-select" value={form.gender || ''} onChange={e => set('gender', e.target.value)}>
                    <option value="">Select</option>
                    {GENDER.map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Address</label>
                  <div className="input-wrapper">
                    <i className="fas fa-map-marker-alt input-icon"></i>
                    <input className="form-input has-icon" value={form.address || ''} onChange={e => set('address', e.target.value)} placeholder="Enter Address" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Mobile Number <span className="req-star">*</span></label>
                  <div className="input-wrapper">
                    <i className="fas fa-phone input-icon"></i>
                    <input className="form-input has-icon" value={form.mobile || ''} onChange={e => set('mobile', e.target.value)} placeholder="0300 0000000" />
                  </div>
                  <Good show={!!form.mobile?.trim()} text="Looks good" />
                </div>
                <div className="form-group">
                  <label className="form-label">Marital Status</label>
                  <select className="form-select" value={form.maritalStatus || ''} onChange={e => set('maritalStatus', e.target.value)}>
                    <option value="">Select</option>
                    {MARITAL.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Blood Group</label>
                  <select className="form-select" value={form.bloodGroup || ''} onChange={e => set('bloodGroup', e.target.value)}>
                    <option value="">Select</option>
                    {BLOOD_GROUPS.map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              {/* Image upload + preview */}
              <div className="form-grid form-grid-2" style={{ gap: 14, marginTop: 14 }}>
                <div className="form-group">
                  <label className="form-label">Please Provide Profile Image</label>
                  <label style={{ display: 'block', border: '1.5px dashed var(--border-light)', borderRadius: 'var(--radius-md)', padding: 18, textAlign: 'center', cursor: 'pointer', background: 'var(--bg-base)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      <i className="fas fa-upload" style={{ marginRight: 6 }}></i>Click to Upload Image
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>PNG, JPG allowed</div>
                    <input type="file" accept="image/png,image/jpeg" onChange={handleImage} style={{ display: 'none' }} />
                  </label>
                </div>
                <div className="form-group">
                  <label className="form-label">Profile Image Preview</label>
                  <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', height: 76, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(30,58,138,.05)', overflow: 'hidden' }}>
                    {form.profileImage
                      ? <img src={form.profileImage} alt="preview" style={{ height: '100%', objectFit: 'contain' }} />
                      : <i className="fas fa-user-circle" style={{ fontSize: 34, color: 'var(--brand-primary)' }}></i>}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── EMPLOYEE ── */}
          {tab === 'employee' && (
            <>
              <div className="emp-sub-tabs">
                <button className={`emp-sub-tab-btn${subTab === 'official' ? ' active' : ''}`} onClick={() => setSubTab('official')}>Official Details</button>
                <button className={`emp-sub-tab-btn${subTab === 'salary' ? ' active' : ''}`} onClick={() => setSubTab('salary')}>Salary Details</button>
              </div>

              {subTab === 'official' && (
                <div className="form-grid form-grid-2" style={{ gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Department <span className="req-star">*</span></label>
                    <select className="form-select" value={form.dept || ''} onChange={e => set('dept', e.target.value)}>
                      <option value="">Select</option>
                      {deptsData.map(d => <option key={d.id}>{d.name}</option>)}
                    </select>
                    <Good show={!!form.dept} text="Department selected" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Designation <span className="req-star">*</span></label>
                    <select className="form-select" value={form.designation || ''} onChange={e => set('designation', e.target.value)}>
                      <option value="">Select</option>
                      {allDesig.map(d => <option key={d}>{d}</option>)}
                    </select>
                    <Good show={!!form.designation} text="Designation selected" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Country</label>
                    <div className="input-wrapper">
                      <i className="fas fa-flag input-icon"></i>
                      <input className="form-input has-icon" value={form.country || ''} onChange={e => set('country', e.target.value)} placeholder="Country" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Province</label>
                    <div className="input-wrapper">
                      <i className="fas fa-map input-icon"></i>
                      <input className="form-input has-icon" value={form.province || ''} onChange={e => set('province', e.target.value)} placeholder="Province" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <div className="input-wrapper">
                      <i className="fas fa-city input-icon"></i>
                      <input className="form-input has-icon" value={form.city || ''} onChange={e => set('city', e.target.value)} placeholder="City" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Qualification</label>
                    <div className="input-wrapper">
                      <i className="fas fa-graduation-cap input-icon"></i>
                      <input className="form-input has-icon" value={form.qualification || ''} onChange={e => set('qualification', e.target.value)} placeholder="e.g. PhD, Masters" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Experience</label>
                    <div className="input-wrapper">
                      <i className="fas fa-clock input-icon"></i>
                      <input className="form-input has-icon" value={form.experience || ''} onChange={e => set('experience', e.target.value)} placeholder="e.g. 5 years" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date of Joining</label>
                    <div className="input-wrapper">
                      <i className="fas fa-calendar-check input-icon"></i>
                      <input className="form-input has-icon" type="date" value={form.joiningDate || ''} onChange={e => set('joiningDate', e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {subTab === 'salary' && (
                <div className="form-grid form-grid-2" style={{ gap: 14 }}>
                  {[
                    ['Basic Monthly Salary', 'salary', 'fa-money-bill-wave', true],
                    ['Medical Allowance', 'medical', 'fa-notes-medical', true],
                    ['Rent Allowance', 'rent', 'fa-home', true],
                    ['Transport Allowance', 'transport', 'fa-bus', true],
                  ].map(([label, key, icon, req]) => (
                    <div className="form-group" key={key}>
                      <label className="form-label">{label} {req && <span className="req-star">*</span>}</label>
                      <div className="input-wrapper">
                        <i className={`fas ${icon} input-icon`}></i>
                        <input className="form-input has-icon" type="number" value={form[key] || ''} onChange={e => set(key, Number(e.target.value))} placeholder="0" />
                      </div>
                      <Good show={Number(form[key]) > 0} text={`PKR ${Number(form[key] || 0).toLocaleString()}`} />
                    </div>
                  ))}
                  <div style={{ gridColumn: 'span 2', padding: '12px 14px', background: 'linear-gradient(135deg,rgba(30,58,138,.06),rgba(30,64,175,.04))', border: '1px solid rgba(30,58,138,.15)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Total Salary Package</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand-primary)' }}>
                      PKR {((form.salary || 0) + (form.medical || 0) + (form.rent || 0) + (form.transport || 0)).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="modal-footer">
            <button className="btn btn-secondary btn-md" onClick={onClose}>Close</button>
            {footerBtn()}
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskAssignModal({ open, staff, classesData, onClose, onSave }) {
  const [expandedClass, setExpandedClass] = useState(null);
  const [expandedSection, setExpandedSection] = useState(null);
  const [tasks, setTasks] = useState({});

  React.useEffect(() => {
    if (open && staff) {
      setTasks(staff.tasks || {});
      setExpandedClass(null);
      setExpandedSection(null);
    }
  }, [open, staff]);

  if (!open || !staff) return null;

  // ── Adjust these 3 accessors to match your data field names ──
  const getSections = (cls) => cls.sections || [];                       // array of { sectionName }
  const getSectionName = (sec) => sec.sectionName;                       // section label
  const getSubjects = (cls) => (cls.subjects || []).map(x => x.name || x); // subject names array
  // ─────────────────────────────────────────────────────────────

  const isChecked = (classId, sectionName, subject) =>
    !!tasks?.[classId]?.[sectionName]?.includes(subject);

  const toggle = (classId, sectionName, subject) => {
    setTasks(prev => {
      const cls = { ...(prev[classId] || {}) };
      const list = new Set(cls[sectionName] || []);
      list.has(subject) ? list.delete(subject) : list.add(subject);
      cls[sectionName] = [...list];
      return { ...prev, [classId]: cls };
    });
  };

  const sectionKey = (cid, sname) => `${cid}::${sname}`;

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">
              Task Assignment of <span style={{ color: 'var(--brand-primary)' }}>{staff.firstName} {staff.lastName || ''}</span>
            </div>
            <div className="modal-subtitle">Assign subjects per class and section</div>
          </div>
          <button className="modal-close" onClick={onClose}><i className="fas fa-times"></i></button>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
          {/* Name card */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(30,58,138,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="fas fa-user-tie" style={{ fontSize: 18, color: 'var(--brand-primary)' }}></i>
            </div>
            <div style={{ fontSize: 14 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Name: </span>
              <span style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>{staff.firstName} {staff.lastName || ''}</span>
            </div>
          </div>

          {/* Section header */}
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-primary)', borderBottom: '2px solid var(--brand-primary)', display: 'inline-block', paddingBottom: 6, marginBottom: 14 }}>
            Assign Subjects
          </div>

          {/* Class accordions */}
          {!classesData?.length ? (
            <div className="empty-mini"><i className="fas fa-chalkboard"></i>No classes available</div>
          ) : classesData.map((cls, ci) => {
            const clsOpen = expandedClass === cls.id;
            return (
              <div key={cls.id} style={{ border: `1px solid ${clsOpen ? 'var(--brand-primary)' : 'var(--border-light)'}`, borderRadius: 'var(--radius-md)', marginBottom: 10, overflow: 'hidden' }}>
                {/* Class header */}
                <div
                  onClick={() => setExpandedClass(clsOpen ? null : cls.id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', cursor: 'pointer', background: clsOpen ? 'rgba(30,58,138,.08)' : 'var(--bg-base)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{ fontSize: 13, color: clsOpen ? 'var(--brand-primary)' : 'var(--text-muted)', fontWeight: 600 }}>{ci + 1}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: clsOpen ? 'var(--brand-primary)' : 'var(--text-primary)' }}>{cls.name}</span>
                  </div>
                  <i className={`fas fa-chevron-${clsOpen ? 'up' : 'down'}`} style={{ fontSize: 13, color: clsOpen ? 'var(--brand-primary)' : 'var(--text-secondary)' }}></i>
                </div>

                {/* Sections */}
                {clsOpen && (
                  <div style={{ padding: '10px 12px' }}>
                    {!getSections(cls).length ? (
                      <div className="empty-mini"><i className="fas fa-layer-group"></i>No sections</div>
                    ) : getSections(cls).map((sec, si) => {
                      const sname = getSectionName(sec);
                      const secOpen = expandedSection === sectionKey(cls.id, sname);
                      return (
                        <div key={si} style={{ marginBottom: 8 }}>
                          {/* Section header */}
                          <div
                            onClick={() => setExpandedSection(secOpen ? null : sectionKey(cls.id, sname))}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '10px 14px', cursor: 'pointer' }}
                          >
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{sname}</span>
                            <i className={`fas fa-chevron-${secOpen ? 'up' : 'down'}`} style={{ fontSize: 12, color: 'var(--text-secondary)' }}></i>
                          </div>

                          {/* Subjects checklist */}
                          {secOpen && (
                            <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginTop: 6 }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 44px', padding: '8px 12px', background: 'var(--bg-subtle, #f1f5f9)', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                                <span>SN</span><span>SUBJECT</span><span style={{ textAlign: 'center' }}><i className="fas fa-check"></i></span>
                              </div>
                              {!getSubjects(cls).length ? (
                                <div className="empty-mini" style={{ padding: 12 }}><i className="fas fa-book"></i>No subjects</div>
                              ) : getSubjects(cls).map((subj, sj) => (
                                <div key={sj} style={{ display: 'grid', gridTemplateColumns: '44px 1fr 44px', alignItems: 'center', padding: '9px 12px', fontSize: 13, borderTop: '1px solid var(--border-light)' }}>
                                  <span style={{ color: 'var(--text-muted)' }}>{sj + 1}</span>
                                  <span>{subj}</span>
                                  <span style={{ textAlign: 'center' }}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked(cls.id, sname, subj)}
                                      onChange={() => toggle(cls.id, sname, subj)}
                                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--brand-primary)' }}
                                    />
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary btn-md" onClick={onClose}>Close</button>
          <button className="btn btn-primary btn-md" onClick={() => onSave({ ...staff, tasks })}>
            <i className="fas fa-save"></i> Save Assignment
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StaffTab({ staffData, setStaffData, deptsData, schoolInfo, showToast, showSuccess, classesData }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [staffModalTarget, setStaffModalTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
const [taskTarget, setTaskTarget] = useState(null);

  const filtered = search
    ? staffData.filter(s => `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase())
        || s.dept?.toLowerCase().includes(search.toLowerCase())
        || s.designation?.toLowerCase().includes(search.toLowerCase()))
    : staffData;

  const pages = Math.ceil(filtered.length / STAFF_PER_PAGE) || 1;
  const currentPage = Math.min(page, pages);
  const paged = filtered.slice((currentPage - 1) * STAFF_PER_PAGE, currentPage * STAFF_PER_PAGE);

  const handleSave = (form) => {
    if (form.id && staffData.find(s => s.id === form.id)) {
      setStaffData(prev => prev.map(s => s.id === form.id ? form : s));
      showToast('Employee updated', 'success');
    } else {
      setStaffData(prev => [...prev, { ...form, id: Date.now(), tasks: {}, verified: false, locked: false }]);
      showSuccess('Employee Added!', `${form.firstName} has been added.`);
    }
  };

  const handleDelete = (id) => {
    const s = staffData.find(s => s.id === id);
    setStaffData(prev => prev.filter(x => x.id !== id));
    if (expandedId === id) setExpandedId(null);
    setDeleteTarget(null);
    showToast(`"${s?.firstName}" deleted`, 'info');
  };

  const newStaffTemplate = { firstName: '', lastName: '', fatherName: '', cnic: '', dob: '', gender: 'Male', maritalStatus: '', address: '', mobile: '', bloodGroup: '', dept: '', designation: '', country: 'Pakistan', province: '', city: '', qualification: '', experience: '', joiningDate: '', salary: 0, medical: 0, rent: 0, transport: 0, tasks: {}, verified: false, locked: false };

  return (
    <div className="tab-panel active">
      <div className="classes-toolbar">
        <div className="toolbar-left">
          <div className="search-box">
            <i className="fas fa-search"></i>
            <input placeholder="Search staff..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-pdf btn-md" onClick={() => downloadStaffReport(staffData, schoolInfo || {}, showToast)}>
            <i className="fas fa-file-pdf"></i> Download Report
          </button>
          <button className="btn btn-primary btn-md" onClick={() => setStaffModalTarget({ ...newStaffTemplate, id: null })}>
            <i className="fas fa-user-plus"></i> Add New Employee
          </button>
        </div>
      </div>

      <div className="classes-table-card" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div className="staff-table-head">
          <div className="th">#</div>
          <div className="th">Name</div>
          <div className="th">Department</div>
          <div className="th">Designation</div>
          <div className="th">Action</div>
          <div className="th" style={{ textAlign: 'center' }}>Details</div>
        </div>
        <div>
          {!paged.length ? (
            <div className="empty-state">
              <div className="empty-icon"><i className="fas fa-users"></i></div>
              <div className="empty-title">No Staff Found</div>
              <div className="empty-sub">Add your first employee to get started.</div>
            </div>
          ) : paged.map((s, i) => {
            const globalIdx = (currentPage - 1) * STAFF_PER_PAGE + i + 1;
            const exp = expandedId === s.id;
            const col = COLORS[i % COLORS.length];
            return (
              <div key={s.id} className="staff-row-wrap">
                <div className={`staff-row${exp ? ' expanded-row' : ''}`} onClick={() => setExpandedId(exp ? null : s.id)}>
                  <div className="td" onClick={e => e.stopPropagation()}>
                    <input className="seq-input" type="number" value={globalIdx} readOnly />
                  </div>
                  <div className="td">
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', marginRight: 9, flexShrink: 0 }}>
                      {(s.firstName || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{s.firstName}{s.lastName ? ' ' + s.lastName : ''}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.mobile || ''}</div>
                    </div>
                  </div>
                  <div className="td">{s.dept ? <span className="staff-dept-pill">{s.dept}</span> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}</div>
                  <div className="td">{s.designation ? <span className="staff-desig-pill">{s.designation}</span> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}</div>
                  <div className="td staff-action-col">
                    <button className="btn-details-staff" onClick={e => { e.stopPropagation(); setStaffModalTarget(s); }}>
                      <i className="fas fa-edit"></i> Details
                    </button>
                    <button className="btn-task-staff" onClick={e => { e.stopPropagation(); setTaskTarget(s); }}>Tasks</button>
                    <button className="btn btn-icon btn-danger btn-sm" onClick={e => { e.stopPropagation(); setDeleteTarget(s); }}>
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                  <div className="td staff-chevron-col">
                    <button className={`expand-btn${exp ? ' open' : ''}`} onClick={e => { e.stopPropagation(); setExpandedId(exp ? null : s.id); }}>
                      <i className="fas fa-chevron-down"></i>
                    </button>
                  </div>
                </div>
                {exp && (
                  <div style={{ padding: '16px 18px', background: 'var(--bg-base)', borderTop: '1px solid var(--border-light)' }}>
                    <div className="emp-details-section">
                      <div className="emp-section-hdr"><i className="fas fa-user" style={{ marginRight: 8 }}></i>Personal Information</div>
                      <div className="emp-section-body">
                        <div className="emp-field-grid">
                          {[['CNIC', s.cnic], ['DOB', s.dob], ['Gender', s.gender], ['Mobile', s.mobile], ['Blood Group', s.bloodGroup], ['City', s.city]].map(([lbl, val]) => (
                            <div key={lbl} className="emp-field">
                              <div className="emp-field-label">{lbl}</div>
                              <div className="emp-field-val">{val || '—'}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="emp-details-section">
                      <div className="emp-section-hdr"><i className="fas fa-briefcase" style={{ marginRight: 8 }}></i>Employment Details</div>
                      <div className="emp-section-body">
                        <div className="emp-field-grid">
                          {[['Department', s.dept], ['Designation', s.designation], ['Qualification', s.qualification], ['Experience', s.experience], ['Joining Date', s.joiningDate], ['Total Salary', `PKR ${((s.salary || 0) + (s.medical || 0) + (s.rent || 0) + (s.transport || 0)).toLocaleString()}`]].map(([lbl, val]) => (
                            <div key={lbl} className="emp-field">
                              <div className="emp-field-label">{lbl}</div>
                              <div className="emp-field-val">{val || '—'}</div>
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
          <div className="pagination-info">Showing <strong>{paged.length}</strong> of <strong>{filtered.length}</strong> staff</div>
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

      <StaffModal open={!!staffModalTarget} staff={staffModalTarget} deptsData={deptsData}
        onClose={() => setStaffModalTarget(null)} onSave={handleSave} />
        <TaskAssignModal
  open={!!taskTarget}
  staff={taskTarget}
  classesData={classesData}
  onClose={() => setTaskTarget(null)}
  onSave={(updated) => {
    setStaffData(prev => prev.map(s => s.id === updated.id ? updated : s));
    showToast('Task assignment saved', 'success');
    setTaskTarget(null);
  }}
/>

      {deleteTarget && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--error)' }}><i className="fas fa-exclamation-triangle" style={{ marginRight: 7 }}></i>Delete Employee</div>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}><i className="fas fa-times"></i></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
                Delete <strong>"{deleteTarget.firstName}"</strong>? This action cannot be undone.
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
