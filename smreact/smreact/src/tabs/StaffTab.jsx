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

  if (!open) return null;

  const Field = ({ label, children }) => (
    <div className="form-group" style={{ marginBottom: 12 }}>
      <label className="form-label">{label}</label>
      {children}
    </div>
  );

  const allDesig = deptsData.flatMap(d => d.designations.map(x => x.name));
  const isNew = !staff?.id || staff?.id === 'new';

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl" style={{ maxHeight: '90vh' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{isNew ? 'Add Employee' : `${form.firstName} ${form.lastName || ''}`}</div>
            <div className="modal-subtitle">{isNew ? 'New employee details' : `${form.designation || ''} · ${form.dept || ''}`}</div>
          </div>
          <button className="modal-close" onClick={onClose}><i className="fas fa-times"></i></button>
        </div>
        <div className="modal-body">
          <div className="emp-modal-tabs">
            <button className={`emp-tab-btn${tab === 'personal' ? ' active' : ''}`} onClick={() => setTab('personal')}>
              <i className="fas fa-user" style={{ marginRight: 6 }}></i>Personal Info
            </button>
            <button className={`emp-tab-btn${tab === 'employee' ? ' active' : ''}`} onClick={() => setTab('employee')}>
              <i className="fas fa-briefcase" style={{ marginRight: 6 }}></i>Employee Info
            </button>
          </div>

          {tab === 'personal' && (
            <div className="form-grid form-grid-2" style={{ gap: 12 }}>
              <Field label="First Name *">
                <input className="form-input" value={form.firstName || ''} onChange={e => set('firstName', e.target.value)} placeholder="First name" />
              </Field>
              <Field label="Last Name">
                <input className="form-input" value={form.lastName || ''} onChange={e => set('lastName', e.target.value)} placeholder="Last name" />
              </Field>
              <Field label="Father's Name">
                <input className="form-input" value={form.fatherName || ''} onChange={e => set('fatherName', e.target.value)} placeholder="Father's name" />
              </Field>
              <Field label="CNIC">
                <input className="form-input" value={form.cnic || ''} onChange={e => set('cnic', e.target.value)} placeholder="35201-1234567-8" />
              </Field>
              <Field label="Date of Birth">
                <input className="form-input" type="date" value={form.dob || ''} onChange={e => set('dob', e.target.value)} />
              </Field>
              <Field label="Gender">
                <select className="form-select" value={form.gender || ''} onChange={e => set('gender', e.target.value)}>
                  <option value="">Select</option>
                  {GENDER.map(g => <option key={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="Marital Status">
                <select className="form-select" value={form.maritalStatus || ''} onChange={e => set('maritalStatus', e.target.value)}>
                  <option value="">Select</option>
                  {MARITAL.map(m => <option key={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Blood Group">
                <select className="form-select" value={form.bloodGroup || ''} onChange={e => set('bloodGroup', e.target.value)}>
                  <option value="">Select</option>
                  {BLOOD_GROUPS.map(b => <option key={b}>{b}</option>)}
                </select>
              </Field>
              <Field label="Mobile">
                <input className="form-input" value={form.mobile || ''} onChange={e => set('mobile', e.target.value)} placeholder="+92 300 0000000" />
              </Field>
              <Field label="Country">
                <select className="form-select" value={form.country || ''} onChange={e => set('country', e.target.value)}>
                  <option value="">Select</option>
                  <option>Pakistan</option><option>India</option><option>Bangladesh</option>
                </select>
              </Field>
              <Field label="Province">
                <select className="form-select" value={form.province || ''} onChange={e => set('province', e.target.value)}>
                  <option value="">Select</option>
                  <option>Punjab</option><option>ICT (Islamabad)</option><option>Sindh</option><option>KPK</option><option>Balochistan</option>
                </select>
              </Field>
              <Field label="City">
                <input className="form-input" value={form.city || ''} onChange={e => set('city', e.target.value)} placeholder="City" />
              </Field>
              <div style={{ gridColumn: 'span 2' }}>
                <Field label="Address">
                  <textarea className="form-input" rows={2} value={form.address || ''} onChange={e => set('address', e.target.value)} placeholder="Complete address" style={{ resize: 'vertical' }} />
                </Field>
              </div>
            </div>
          )}

          {tab === 'employee' && (
            <>
              <div className="emp-sub-tabs">
                <button className={`emp-sub-tab-btn${subTab === 'official' ? ' active' : ''}`} onClick={() => setSubTab('official')}>Official Info</button>
                <button className={`emp-sub-tab-btn${subTab === 'salary' ? ' active' : ''}`} onClick={() => setSubTab('salary')}>Salary</button>
              </div>
              {subTab === 'official' && (
                <div className="form-grid form-grid-2" style={{ gap: 12 }}>
                  <Field label="Department">
                    <select className="form-select" value={form.dept || ''} onChange={e => set('dept', e.target.value)}>
                      <option value="">Select</option>
                      {deptsData.map(d => <option key={d.id}>{d.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Designation">
                    <select className="form-select" value={form.designation || ''} onChange={e => set('designation', e.target.value)}>
                      <option value="">Select</option>
                      {allDesig.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </Field>
                  <Field label="Qualification">
                    <input className="form-input" value={form.qualification || ''} onChange={e => set('qualification', e.target.value)} placeholder="e.g. PhD, Masters, BA" />
                  </Field>
                  <Field label="Experience">
                    <input className="form-input" value={form.experience || ''} onChange={e => set('experience', e.target.value)} placeholder="e.g. 5 years" />
                  </Field>
                  <Field label="Joining Date">
                    <input className="form-input" type="date" value={form.joiningDate || ''} onChange={e => set('joiningDate', e.target.value)} />
                  </Field>
                  <Field label="Verified">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                      <input type="checkbox" checked={form.verified || false} onChange={e => set('verified', e.target.checked)}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--brand-primary)' }} />
                      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Mark as Verified</span>
                    </div>
                  </Field>
                </div>
              )}
              {subTab === 'salary' && (
                <div className="form-grid form-grid-2" style={{ gap: 12 }}>
                  <Field label="Basic Salary">
                    <div className="input-wrapper">
                      <i className="fas fa-rupee-sign input-icon"></i>
                      <input className="form-input has-icon" type="number" value={form.salary || ''} onChange={e => set('salary', Number(e.target.value))} placeholder="0" />
                    </div>
                  </Field>
                  <Field label="Medical Allowance">
                    <div className="input-wrapper">
                      <i className="fas fa-rupee-sign input-icon"></i>
                      <input className="form-input has-icon" type="number" value={form.medical || ''} onChange={e => set('medical', Number(e.target.value))} placeholder="0" />
                    </div>
                  </Field>
                  <Field label="Rent Allowance">
                    <div className="input-wrapper">
                      <i className="fas fa-rupee-sign input-icon"></i>
                      <input className="form-input has-icon" type="number" value={form.rent || ''} onChange={e => set('rent', Number(e.target.value))} placeholder="0" />
                    </div>
                  </Field>
                  <Field label="Transport Allowance">
                    <div className="input-wrapper">
                      <i className="fas fa-rupee-sign input-icon"></i>
                      <input className="form-input has-icon" type="number" value={form.transport || ''} onChange={e => set('transport', Number(e.target.value))} placeholder="0" />
                    </div>
                  </Field>
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
            <button className="btn btn-secondary btn-md" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary btn-md" onClick={() => { onSave(form); onClose(); }}>
              <i className="fas fa-save"></i> Save Employee
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StaffTab({ staffData, setStaffData, deptsData, schoolInfo, showToast, showSuccess }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [staffModalTarget, setStaffModalTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

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
                    <button className="btn-task-staff" onClick={e => { e.stopPropagation(); showToast('Task assignment coming soon', 'info'); }}>Tasks</button>
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
