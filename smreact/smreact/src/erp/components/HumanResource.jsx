import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from './Tooltip';
import TutorialModal from './TutorialModal';
import * as hrService from '../services/hrService';
import useAsync from '../hooks/useAsync';
import {
  generateSalarySlipHTML,
  generatePayHistoryReportHTML,
  generateLoanReportHTML,
  generateHrDirectoryReport,
  generateHrSalaryRegister,
  generateHrLoanSummary,
  generateHrDeptSummary,
  generateHrLeaveRegister,
  generateHrPayrollSummary,
} from './hrReports';

/* ═══════════════════════════════════════════════════════════════════
   HUMAN RESOURCE module — entry point.

   Only HR Basics is implemented this sprint; the other three tabs
   render a centered "Coming soon" placeholder. Markup, classes,
   colors and behaviour for HR Basics are a 1:1 port of the
   reference at ~/Desktop/Human Resource .html.
   ═══════════════════════════════════════════════════════════════════ */

const HR_TABS = [
  { id: 'basics',   icon: 'fa-building',     label: 'HR Basics' },
  { id: 'emps',     icon: 'fa-user-tie',     label: 'Employee Management' },
  { id: 'finance',  icon: 'fa-coins',        label: 'Financials' },
  { id: 'reports',  icon: 'fa-chart-line',   label: 'Reports' },
];

export default function HumanResource({ toast = () => {} }) {
  const [tab, setTab] = useState('basics');
  const [tutorialOpen, setTutorialOpen] = useState(false);

  /* Shared data hoisted to the module so the rebuilt screens can
     reuse it later without re-fetching. */
  const { data: serverDepts        = [] } = useAsync(hrService.getHrDepts, []);
  const { data: serverDesigs       = [] } = useAsync(hrService.getHrDesigs, []);
  const { data: serverEmps         = [] } = useAsync(hrService.getHrEmployees, []);
  const { data: serverNextDeptId   = 5 } = useAsync(hrService.getHrNextDeptId,  5);
  const { data: serverNextDesigId  = 9 } = useAsync(hrService.getHrNextDesigId, 9);
  const { data: serverNextEmpId    = 7 } = useAsync(hrService.getHrNextEmpId,   7);

  const [depts, setDepts]   = useState(null);
  const [desigs, setDesigs] = useState(null);
  const [emps,   setEmps]   = useState(null);
  const [nextDeptId,  setNextDeptId]  = useState(null);
  const [nextDesigId, setNextDesigId] = useState(null);
  const [nextEmpId,   setNextEmpId]   = useState(null);

  useEffect(() => { if (serverDepts.length  && depts  == null) setDepts(serverDepts);   }, [serverDepts,  depts]);
  useEffect(() => { if (serverDesigs.length && desigs == null) setDesigs(serverDesigs); }, [serverDesigs, desigs]);
  useEffect(() => { if (serverEmps.length   && emps   == null) setEmps(serverEmps);     }, [serverEmps,   emps]);
  useEffect(() => { if (nextDeptId  == null && serverNextDeptId)  setNextDeptId(serverNextDeptId);   }, [serverNextDeptId,  nextDeptId]);
  useEffect(() => { if (nextDesigId == null && serverNextDesigId) setNextDesigId(serverNextDesigId); }, [serverNextDesigId, nextDesigId]);
  useEffect(() => { if (nextEmpId   == null && serverNextEmpId)   setNextEmpId(serverNextEmpId);     }, [serverNextEmpId,   nextEmpId]);

  const deptList  = depts  || [];
  const desigList = desigs || [];
  const empList   = emps   || [];

  /* Re-pull departments + designations from the server after a mutation
     so the table reflects the saved state. */
  const reloadHrBasics = async () => {
    const [d, g] = await Promise.all([hrService.getHrDepts(), hrService.getHrDesigs()]);
    setDepts(d);
    setDesigs(g);
  };

  return (
    <>
      <style>{HR_CSS}</style>

      {/* Page header */}
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}>
            <i className="fa-solid fa-users"></i>
          </div>
          <div>
            <div className="page-title">Human Resource</div>
            <div className="page-sub">Manage departments, designations, employees and financials</div>
          </div>
        </div>
        <Tooltip text="Play a short tutorial for the Human Resource module">
          <button
            className="tutorial-btn page-tutorial-btn"
            onClick={() => setTutorialOpen(true)}
            aria-label="Open Human Resource tutorials"
          >
            <div className="play-dot"><i className="fa-solid fa-play" style={{ fontSize: 8 }}></i></div>
            <span className="tutorial-label">Tutorial</span>
          </button>
        </Tooltip>
      </div>

      {/* L1 main tabs */}
      <div className="hr-tabs" role="tablist" aria-label="Human Resource sections">
        {HR_TABS.map(t => (
          <Tooltip key={t.id} text={t.label}>
            <button
              className={`hr-tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
              role="tab"
              aria-selected={tab === t.id}
              tabIndex={tab === t.id ? 0 : -1}
            >
              <i className={`fa-solid ${t.icon}`} aria-hidden="true"></i> {t.label}
            </button>
          </Tooltip>
        ))}
      </div>

      {tab === 'basics' && (
        <HrBasics
          depts={deptList}
          setDepts={setDepts}
          desigs={desigList}
          setDesigs={setDesigs}
          emps={empList}
          nextDeptId={nextDeptId  || 5}
          nextDesigId={nextDesigId || 9}
          setNextDeptId={setNextDeptId}
          setNextDesigId={setNextDesigId}
          reload={reloadHrBasics}
          toast={toast}
        />
      )}
      {tab === 'emps' && (
        <EmployeeManagement
          emps={empList}
          setEmps={setEmps}
          depts={deptList}
          desigs={desigList}
          nextEmpId={nextEmpId || 7}
          setNextEmpId={setNextEmpId}
          toast={toast}
        />
      )}
      {tab === 'finance' && (
        <Financials
          emps={empList}
          depts={deptList}
          desigs={desigList}
          toast={toast}
        />
      )}
      {tab === 'reports' && (
        <HrReports
          emps={empList}
          depts={deptList}
          desigs={desigList}
          toast={toast}
        />
      )}

      <TutorialModal
        open={tutorialOpen}
        moduleKey="humanResource"
        onClose={() => setTutorialOpen(false)}
        toast={toast}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   HR BASICS — 1:1 port of the section-card layout from the HTML ref:
     • Add Department button in the header
     • UX info banner
     • Departments table head + rows
     • Expandable per-department designations panel (renderDesigList)
     • Per-row Add Designation / Edit Department / Delete Department
     • Per-designation Edit / Delete
     • Confirm-dialog delete flow (mounted as DOM portal)
   ═══════════════════════════════════════════════════════════════════ */
function HrBasics({
  depts, setDepts, desigs, setDesigs, emps,
  nextDeptId, nextDesigId, setNextDeptId, setNextDesigId, reload, toast,
}) {
  const [openDeptId, setOpenDeptId] = useState(null);   // id of currently-expanded dept
  const [deptModal,  setDeptModal]  = useState(null);   // null | { mode:'add'|'edit', dept? }
  const [desigModal, setDesigModal] = useState(null);   // null | { mode:'add'|'edit', desig?, defaultDId? }
  const [confirmCfg, setConfirmCfg] = useState(null);   // null | { title, msg, hint, label, danger, icon, onConfirm }

  const empCountByDept = useMemo(() => {
    const m = {};
    emps.forEach(e => { m[e.dId] = (m[e.dId] || 0) + 1; });
    return m;
  }, [emps]);
  const empCountByDesig = useMemo(() => {
    const m = {};
    emps.forEach(e => { m[e.desId] = (m[e.desId] || 0) + 1; });
    return m;
  }, [emps]);

  /* ── Department mutators (real API: LaunchSetup/save-department) ── */
  const saveDept = async (payload) => {
    const name = (payload.name || '').trim();
    if (!name) { toast('Department name is required', 'error'); return false; }

    const isEdit   = deptModal?.mode === 'edit';
    const branchID = sessionStorage.getItem('branchID');
    const userID   = Number(sessionStorage.getItem('UserID')) || 0;
    /* An edit reuses the add endpoint with the department id; resend the
       existing designations so a rename doesn't wipe them. */
    const existing = isEdit ? (deptModal.dept.raw?.designations || []) : [];
    const designations = isEdit && existing.length
      ? existing.map(d => ({
          designationID:      d.designationID ?? 0,
          branchID:           Number(branchID) || 0,
          branchDepartmentID: deptModal.dept.id,
          designationName:    d.designationName ?? '',
          description:        d.description ?? '',
          qualificationID:    d.qualificationID ?? 0,
          qualificationName:  d.qualificationName ?? '',
          createdBy:          userID,
          modifiedBy:         userID,
        }))
      : [{
          designationID: 0, branchID: 0, branchDepartmentID: 0,
          designationName: '', description: '', qualificationID: 0,
          qualificationName: '', createdBy: 0, modifiedBy: 0,
        }];

    const apiPayload = {
      id:                    isEdit ? deptModal.dept.id : 0,
      branchID,
      departmentName:        name,
      totalDesignationCount: existing.length,
      createdBy:             userID,
      modifiedBy:            userID,
      designations,
    };

    try {
      await hrService.saveHrDept(apiPayload);
      await reload();
      toast(isEdit ? 'Department updated' : 'Department added', 'success');
      return true;
    } catch (err) {
      toast(err.message || 'Could not save department', 'error');
      return false;
    }
  };
  const deleteDept = (dept) => {
    setConfirmCfg({
      title:        'Confirm Deletion',
      message:      'Are you sure you want to delete this record?',
      hint:         `Department "${dept.name}" and all its designations will be removed.`,
      confirmLabel: 'Yes, Delete',
      confirmStyle: 'danger',
      icon:         'fa-trash',
      iconBg:       'rgba(220,38,38,.1)',
      iconColor:    '#DC2626',
      onConfirm: async () => {
        try {
          await hrService.deleteHrDept({ id: dept.id });
          await reload();
          toast('Department deleted', 'success');
          if (openDeptId === dept.id) setOpenDeptId(null);
        } catch (err) {
          toast(err.message || 'Could not delete department', 'error');
        }
      },
    });
  };

  /* ── Designation mutators (real API: save-department-designation) ── */
  const saveDesig = async (payload) => {
    const name = (payload.name || '').trim();
    if (!name) { toast('Designation title required', 'error'); return false; }
    const dId    = Number(payload.dId);
    if (!dId) { toast('Department is required', 'error'); return false; }
    const qualId = Number(payload.qualId) || 0;
    if (!qualId) { toast('Qualification is required', 'error'); return false; }
    const desc   = (payload.desc || '').trim();

    const isEdit   = desigModal?.mode === 'edit';
    const branchID = sessionStorage.getItem('branchID');
    const userID   = Number(sessionStorage.getItem('UserID')) || 0;
    const apiPayload = {
      designationID:      isEdit ? desigModal.desig.id : 0,
      branchID,
      branchDepartmentID: dId,
      designationName:    name,
      description:        desc,
      qualificationID:    qualId,
      qualificationName:  (payload.qualName || '').trim(),
      createdBy:          userID,
      modifiedBy:         userID,
    };

    try {
      await hrService.saveHrDesig(apiPayload);
      await reload();
      toast(isEdit ? 'Designation updated' : 'Designation added', 'success');
      if (dId && openDeptId !== dId) setOpenDeptId(dId);
      return true;
    } catch (err) {
      toast(err.message || 'Could not save designation', 'error');
      return false;
    }
  };
  const deleteDesig = (desig) => {
    setConfirmCfg({
      title:        'Confirm Deletion',
      message:      'Are you sure you want to delete this record?',
      hint:         `Designation "${desig.name}" — employees holding it will lose this assignment.`,
      confirmLabel: 'Yes, Delete',
      confirmStyle: 'danger',
      icon:         'fa-trash',
      iconBg:       'rgba(220,38,38,.1)',
      iconColor:    '#DC2626',
      onConfirm: async () => {
        try {
          await hrService.deleteHrDesig({ id: desig.id });
          await reload();
          toast('Designation deleted', 'success');
        } catch (err) {
          toast(err.message || 'Could not delete designation', 'error');
        }
      },
    });
  };

  return (
    <div className="hrb-root">
      <div className="section-card">
        <div className="card-header">
          <div className="card-title">
            <i className="fa-solid fa-building" style={{ color: '#1E3A8A' }} aria-hidden="true"></i>
            Departments &amp; Designations
          </div>
          <Tooltip text="Add a new department to organize employees">
            <button
              type="button"
              className="btn-add"
              onClick={() => setDeptModal({ mode: 'add' })}
            >
              <i className="fa-solid fa-plus" aria-hidden="true"></i> Add Department
            </button>
          </Tooltip>
        </div>

        <div className="ux-info-banner">
          <div className="ux-info-icon"><i className="fa-solid fa-circle-info" aria-hidden="true"></i></div>
          <div className="ux-info-body">
            <div className="ux-info-row"><strong>Departments</strong> help organize employees across the school (e.g. Administration, Academics, Security).</div>
            <div className="ux-info-row"><strong>Designations</strong> determine employee roles and reporting structure within each department.</div>
          </div>
        </div>

        <div className="t-head dept-t-head">
          <div className="th">S.No</div>
          <div className="th">Department</div>
          <div className="th">Designations</div>
          <div className="th" style={{ textAlign: 'right', justifySelf: 'end' }}>Actions</div>
          <div className="th" style={{ textAlign: 'center' }}>▾</div>
        </div>

        {depts.length === 0 ? (
          <EmptyState
            icon="fa-building"
            title="No Departments"
            sub='Click "Add Department" to create one.'
          />
        ) : (
          <div>
            {depts.map((d, i) => {
              const ds = desigs.filter(x => x.dId === d.id);
              const ec = empCountByDept[d.id] || 0;
              const open = openDeptId === d.id;
              return (
                <div className="row-wrap" key={d.id}>
                  <div className={`d-row dept-d-row${open ? ' open' : ''}`}>
                    <div className="td td-num">{i + 1}</div>
                    <div className="td" style={{ gap: 10 }}>
                      <div className="dept-row-icn"><i className="fa-solid fa-building" aria-hidden="true"></i></div>
                      <div>
                        <div className="dept-row-name">{d.name}</div>
                        <div className="dept-row-meta">{ec} employee{ec === 1 ? '' : 's'}</div>
                      </div>
                    </div>
                    <div className="td">
                      <span className="badge b-green">{ds.length} designation{ds.length === 1 ? '' : 's'}</span>
                    </div>
                    <div className="td dept-row-actions">
                      <Tooltip text="Add Designation">
                        <button
                          type="button"
                          className="btn-sm"
                          onClick={() => setDesigModal({ mode: 'add', defaultDId: d.id })}
                        >
                          <i className="fa-solid fa-plus" aria-hidden="true"></i> Designation
                        </button>
                      </Tooltip>
                      <Tooltip text="Edit">
                        <button
                          type="button"
                          className="btn-edit"
                          onClick={() => setDeptModal({ mode: 'edit', dept: d })}
                          aria-label={`Edit ${d.name}`}
                        >
                          <i className="fa-solid fa-pen" aria-hidden="true"></i>
                        </button>
                      </Tooltip>
                      <Tooltip text="Delete">
                        <button
                          type="button"
                          className="btn-del"
                          onClick={() => deleteDept(d)}
                          aria-label={`Delete ${d.name}`}
                        >
                          <i className="fa-solid fa-trash" aria-hidden="true"></i>
                        </button>
                      </Tooltip>
                    </div>
                    <div className="td" style={{ justifyContent: 'center' }}>
                      <Tooltip text="View Designations">
                        <button
                          type="button"
                          className={`btn-expand${open ? ' open' : ''}`}
                          onClick={() => setOpenDeptId(open ? null : d.id)}
                          aria-label={open ? `Collapse ${d.name}` : `Expand ${d.name}`}
                          aria-expanded={open}
                        >
                          <i className="fa-solid fa-chevron-down" aria-hidden="true"></i>
                        </button>
                      </Tooltip>
                    </div>
                  </div>

                  <div className={`dept-panel${open ? ' open' : ''}`}>
                    <div className="dept-panel-inner">
                      <div className="dept-panel-title">
                        <i className="fa-solid fa-id-badge" aria-hidden="true"></i>
                        Designations in <span style={{ color: '#1E3A8A' }}>{d.name}</span> Department
                      </div>
                      {ds.length === 0 ? (
                        <div className="dept-panel-empty">
                          <i className="fa-solid fa-info-circle" aria-hidden="true"></i> No designations yet. Click "+ Designation" to add one.
                        </div>
                      ) : (
                        <>
                          <div className="desig-head">
                            <div className="th" style={{ fontSize: 10 }}>#</div>
                            <div className="th" style={{ fontSize: 10 }}>Designation</div>
                            <div className="th" style={{ fontSize: 10 }}>Employees</div>
                            <div className="th" style={{ fontSize: 10, textAlign: 'right', justifySelf: 'end' }}>Actions</div>
                          </div>
                          {ds.map((des, j) => {
                            const dec = empCountByDesig[des.id] || 0;
                            return (
                              <div className="desig-row" key={des.id}>
                                <div className="td td-num" style={{ fontSize: 11.5 }}>{j + 1}</div>
                                <div className="td desig-row-name-cell">
                                  <span className="desig-row-name">{des.name}</span>
                                  {des.qual && <span className="desig-row-qual">{des.qual}</span>}
                                </div>
                                <div className="td"><span className="badge b-green">{dec} emp.</span></div>
                                <div className="td desig-row-actions">
                                  <Tooltip text="Edit">
                                    <button
                                      type="button"
                                      className="btn-edit"
                                      onClick={() => setDesigModal({ mode: 'edit', desig: des })}
                                      aria-label={`Edit ${des.name}`}
                                    >
                                      <i className="fa-solid fa-pen" aria-hidden="true"></i>
                                    </button>
                                  </Tooltip>
                                  <Tooltip text="Delete">
                                    <button
                                      type="button"
                                      className="btn-del"
                                      onClick={() => deleteDesig(des)}
                                      aria-label={`Delete ${des.name}`}
                                    >
                                      <i className="fa-solid fa-trash" aria-hidden="true"></i>
                                    </button>
                                  </Tooltip>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {deptModal && (
        <DeptModal
          mode={deptModal.mode}
          dept={deptModal.dept}
          onClose={() => setDeptModal(null)}
          onSave={async (payload) => {
            const ok = await saveDept(payload);
            if (ok) setDeptModal(null);
          }}
        />
      )}
      {desigModal && (
        <DesigModal
          mode={desigModal.mode}
          desig={desigModal.desig}
          defaultDId={desigModal.defaultDId}
          depts={depts}
          onClose={() => setDesigModal(null)}
          onSave={async (payload) => {
            const ok = await saveDesig(payload);
            if (ok) setDesigModal(null);
          }}
        />
      )}
      {confirmCfg && (
        <ConfirmDialog
          cfg={confirmCfg}
          onClose={() => setConfirmCfg(null)}
        />
      )}
    </div>
  );
}

/* ── Small inline empty-state matching the HTML's emptyState() helper ── */
function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ padding: '50px 20px', textAlign: 'center' }}>
      <div className="hrb-empty-ic"><i className={`fa-solid ${icon}`} aria-hidden="true"></i></div>
      <div className="hrb-empty-title">{title}</div>
      <div className="hrb-empty-sub">{sub}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DEPARTMENT MODAL (Add / Edit)
   ═══════════════════════════════════════════════════════════════════ */
function DeptModal({ mode, dept, onClose, onSave }) {
  const isEdit = mode === 'edit';
  const [name, setName] = useState(dept?.name || '');
  const [desc, setDesc] = useState(dept?.desc || '');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return createPortal((
    <div
      className="ov open"
      role="dialog" aria-modal="true" aria-labelledby="dept-modal-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal">
        <div className="modal-head">
          <div className="modal-head-left">
            <div className="modal-head-icon"><i className="fa-solid fa-building" aria-hidden="true"></i></div>
            <div>
              <div className="modal-title" id="dept-modal-title">{isEdit ? 'Edit Department' : 'Add Department'}</div>
              <div className="modal-sub">Create a department for your institution</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>
        <div className="modal-body">
          <div className="f-group">
            <label className="f-label">Department Name <span className="req">*</span></label>
            <input
              className="f-input"
              placeholder="e.g. Administration, Academics…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="f-group">
            <label className="f-label">Description</label>
            <textarea
              className="f-textarea"
              placeholder="Brief description…"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => onSave({ name, desc })}
          >
            <i className="fa-solid fa-check" aria-hidden="true"></i> {isEdit ? 'Save Changes' : 'Save Department'}
          </button>
        </div>
      </div>
    </div>
  ), document.body);
}

/* ═══════════════════════════════════════════════════════════════════
   DESIGNATION MODAL (Add / Edit)
   ═══════════════════════════════════════════════════════════════════ */
function DesigModal({ mode, desig, defaultDId, depts, onClose, onSave }) {
  const isEdit = mode === 'edit';
  const [name, setName]   = useState(desig?.name || '');
  const [dId,  setDId]    = useState(desig?.dId ?? defaultDId ?? (depts[0]?.id || ''));
  const [qualId, setQualId] = useState(desig?.qualificationID ?? '');
  const [desc, setDesc]   = useState(desig?.desc || '');
  const [quals, setQuals] = useState([]);

  useEffect(() => {
    let alive = true;
    hrService.getHrQualifications()
      .then(list => { if (alive) setQuals(list); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return createPortal((
    <div
      className="ov open"
      role="dialog" aria-modal="true" aria-labelledby="desig-modal-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal">
        <div className="modal-head">
          <div className="modal-head-left">
            <div className="modal-head-icon"><i className="fa-solid fa-id-badge" aria-hidden="true"></i></div>
            <div>
              <div className="modal-title" id="desig-modal-title">{isEdit ? 'Edit Designation' : 'Add Designation'}</div>
              <div className="modal-sub">Add a new post or designation</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>
        <div className="modal-body">
          <div className="f-row">
            <div className="f-group">
              <label className="f-label">Designation Title <span className="req">*</span></label>
              <input
                className="f-input"
                placeholder="e.g. Principal, Teacher…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="f-group">
              <label className="f-label">Department</label>
              <select
                className="f-select2"
                value={dId}
                onChange={(e) => setDId(Number(e.target.value))}
              >
                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="f-row">
            <div className="f-group">
              <label className="f-label">Qualification Required <span className="req">*</span></label>
              <select
                className="f-select2"
                value={qualId}
                onChange={(e) => setQualId(e.target.value)}
              >
                <option value="">Select qualification</option>
                {quals.map(q => (
                  <option key={q.id} value={q.id}>{q.qualificationName}</option>
                ))}
              </select>
            </div>
            <div className="f-group" style={{ gridColumn: '1 / -1' }}>
              <label className="f-label">Job Description</label>
              <textarea
                className="f-textarea"
                placeholder="Key responsibilities…"
                style={{ minHeight: 72 }}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => onSave({
              name, dId, desc,
              qualId,
              qualName: quals.find(q => String(q.id) === String(qualId))?.qualificationName || '',
            })}
          >
            <i className="fa-solid fa-check" aria-hidden="true"></i> {isEdit ? 'Save Changes' : 'Save Designation'}
          </button>
        </div>
      </div>
    </div>
  ), document.body);
}

/* ═══════════════════════════════════════════════════════════════════
   CONFIRM DIALOG — 1:1 port of the Academics module's ConfirmDialog
   (src/components/Academics.js). Reuses the same prop names, classes
   and styling for visual consistency across the ERP.
   ═══════════════════════════════════════════════════════════════════ */
function ConfirmDialog({ cfg, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!cfg) return null;
  const {
    title, message, hint,
    confirmLabel = 'Confirm', confirmStyle = 'danger',
    icon = 'fa-trash', iconBg = 'rgba(220,38,38,.1)', iconColor = '#DC2626',
    onConfirm,
  } = cfg;

  return createPortal((
    <div
      className="confirm-overlay open"
      role="dialog" aria-modal="true" aria-labelledby="hrb-confirm-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="confirm-dialog">
        <div
          className="confirm-glow"
          style={confirmStyle === 'danger'
            ? { background: 'linear-gradient(90deg,#EF4444,#DC2626,#EF4444)' }
            : { background: 'linear-gradient(90deg,#1E3A8A,#1E40AF,#1E3A8A)' }}
        />
        <div className="confirm-hero">
          <div className="confirm-ring">
            <div className="confirm-icon-wrap" style={{ background: iconBg, color: iconColor }}>
              <i className={`fa-solid ${icon}`}></i>
            </div>
          </div>
        </div>
        <div className="confirm-body">
          <div className="confirm-title" id="hrb-confirm-title">{title}</div>
          <div className="confirm-msg" dangerouslySetInnerHTML={{ __html: message }} />
          {hint && (
            <div className="confirm-hint">
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>{hint}</span>
            </div>
          )}
        </div>
        <div className="confirm-footer">
          <button className="confirm-btn confirm-btn--cancel" onClick={onClose}>Cancel</button>
          <button
            className={`confirm-btn confirm-btn--confirm${confirmStyle === 'primary' ? ' primary-style' : ''}`}
            onClick={() => { if (onConfirm) onConfirm(); onClose(); }}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  ), document.body);
}

/* ═══════════════════════════════════════════════════════════════════
   FINANCIALS — Payroll panel (1:1 port of #hrP2 from the HTML ref).

   Layout:
     • ux-info-banner (Salary Information + Advance / Loan note)
     • pay-filter-bar (Month select + Year select + 4 status legend pills)
     • pay-t-head — 8-col grid: S.No · Photo · Name · Designation ·
       Status · Reports · Actions · ▾
     • payList — one .pay-row per Active employee with:
         - Reports dropdown (Salary Slip · Pay History Ledger · Loan/Advance Report)
         - 3-dots dropdown (Pay Roll · Advance / Loan)
         - Expand chevron → .pay-panel detail breakdown
     • Empty state for "No Active Employees"

   The Pay Roll modal, Advance/Loan modal and 3 PDF reports are NOT
   shipped in this sprint; menu items toast a "coming in the next
   sprint" message so the menu is fully discoverable.
   ═══════════════════════════════════════════════════════════════════ */

const PAY_MONTHS = [
  'January', 'February', 'March',     'April',
  'May',     'June',     'July',      'August',
  'September','October', 'November',  'December',
];

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/* ═══════════════════════════════════════════════════════════════════
   HR REPORTS — Reports tab. 6 report cards + style/period picker.
   1:1 port of #hrP4 + openHrReport flow from "Human Resource .html".
   ═══════════════════════════════════════════════════════════════════ */

/* Same demo seed as Financials uses (Aug 2025 → Jun 2026 for Dr. Islahudin).
   The Reports tab needs payroll history to produce non-empty Salary
   Register / Payroll Summary outputs. Mirrors seedDemoFinancialData. */
function useHrDemoPayroll(emps) {
  const [empPayroll, setEmpPayroll] = useState({});
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (!emps || !emps.length) return;
    const e = emps.find(x => x.id === 1);
    if (!e) return;
    seededRef.current = true;
    const basic     = +e.basicSalary || 80000;
    const stdDeduct = getEmpStdDeductions(e);
    const demoMonths = [
      { key:'2025-08', month:'August',    year:2025, bonus:0,     fineDeduct:0,   leaveDeduct:0,    absentDeduct:0, leaveCount:0, absentCount:0, fineComment:'',                       leaveComment:'',               loanCut:0,    advRecovery:0 },
      { key:'2025-09', month:'September', year:2025, bonus:0,     fineDeduct:0,   leaveDeduct:0,    absentDeduct:0, leaveCount:0, absentCount:0, fineComment:'',                       leaveComment:'',               loanCut:5000, advRecovery:0 },
      { key:'2025-10', month:'October',   year:2025, bonus:5000,  fineDeduct:0,   leaveDeduct:0,    absentDeduct:0, leaveCount:0, absentCount:0, fineComment:'',                       leaveComment:'',               loanCut:5000, advRecovery:0 },
      { key:'2025-11', month:'November',  year:2025, bonus:0,     fineDeduct:500, leaveDeduct:0,    absentDeduct:0, leaveCount:0, absentCount:0, fineComment:'Late report submission', leaveComment:'',               loanCut:5000, advRecovery:0 },
      { key:'2025-12', month:'December',  year:2025, bonus:10000, fineDeduct:0,   leaveDeduct:0,    absentDeduct:0, leaveCount:0, absentCount:0, fineComment:'',                       leaveComment:'',               loanCut:5000, advRecovery:0 },
      { key:'2026-01', month:'January',   year:2026, bonus:0,     fineDeduct:0,   leaveDeduct:0,    absentDeduct:0, leaveCount:0, absentCount:0, fineComment:'',                       leaveComment:'',               loanCut:5000, advRecovery:0 },
      { key:'2026-02', month:'February',  year:2026, bonus:0,     fineDeduct:0,   leaveDeduct:0,    absentDeduct:0, leaveCount:0, absentCount:0, fineComment:'',                       leaveComment:'',               loanCut:0,    advRecovery:3000 },
      { key:'2026-03', month:'March',     year:2026, bonus:0,     fineDeduct:0,   leaveDeduct:1500, absentDeduct:0, leaveCount:1, absentCount:0, fineComment:'',                       leaveComment:'1 unpaid leave', loanCut:0,    advRecovery:3000 },
      { key:'2026-04', month:'April',     year:2026, bonus:5000,  fineDeduct:0,   leaveDeduct:0,    absentDeduct:0, leaveCount:0, absentCount:0, fineComment:'',                       leaveComment:'',               loanCut:0,    advRecovery:2500 },
      { key:'2026-06', month:'June',      year:2026, bonus:3000,  fineDeduct:0,   leaveDeduct:0,    absentDeduct:0, leaveCount:0, absentCount:0, fineComment:'',                       leaveComment:'',               loanCut:5000, advRecovery:0 },
    ];
    const empMap = {};
    demoMonths.forEach(m => {
      const totalGross  = getEmpTotalGross(e, m.bonus);
      const otherDed    = (m.fineDeduct || 0) + (m.leaveDeduct || 0) + (m.absentDeduct || 0);
      const totalDeduct = stdDeduct + (m.loanCut || 0) + (m.advRecovery || 0) + otherDed;
      const net         = totalGross - totalDeduct;
      const monthIdx    = parseInt(m.key.split('-')[1], 10);
      const lastDay     = new Date(m.year, monthIdx, 0).getDate();
      const payDate     = `${m.year}-${String(monthIdx).padStart(2,'0')}-${String(Math.min(lastDay, 28)).padStart(2,'0')}`;
      empMap[m.key] = {
        month: m.month, year: m.year, status: 'Paid',
        basicPay: basic, bonus: m.bonus || 0, totalGross,
        stdDeductions: stdDeduct,
        loanDeduct: m.loanCut || 0, customLoan: 0,
        advanceRecovery: m.advRecovery || 0,
        fineDeduct: m.fineDeduct || 0, leaveDeduct: m.leaveDeduct || 0, absentDeduct: m.absentDeduct || 0,
        totalDeductions: totalDeduct,
        leaveCount: m.leaveCount || 0, absentCount: m.absentCount || 0,
        fineComment: m.fineComment || '', leaveComment: m.leaveComment || '', absentComment: '',
        netPayable: net,
        payments: [{ amount: net, date: payDate, comment: 'Salary cleared' }],
        paidAmount: net, paidDate: payDate, loanRecorded: (m.loanCut || 0) > 0,
        generatedAt: payDate,
      };
    });
    setEmpPayroll({ 1: empMap });
  }, [emps]);
  return empPayroll;
}

/* The same Wedding Loan seed Financials uses. */
const HR_DEMO_EMP_LOANS = {
  1: [{
    id: 1001, loanNumber: 1, amount: 100000, comment: 'Wedding Loan',
    repaymentType: 'Installment', deductDate: '2025-08-15',
    installmentType: 'Monthly', installmentAmount: 5000,
    status: 'active',
    received: [
      { amount: 5000, date: '2025-09-30', comment: 'September installment via payroll' },
      { amount: 5000, date: '2025-10-31', comment: 'October installment via payroll'   },
      { amount: 5000, date: '2025-11-30', comment: 'November installment via payroll'  },
      { amount: 5000, date: '2025-12-31', comment: 'December installment via payroll'  },
      { amount: 5000, date: '2026-01-31', comment: 'January installment via payroll'   },
    ],
    remaining: 75000, createdAt: '2025-08-15',
  }],
};

const HR_REPORT_META = {
  'directory'       : { title: 'Employee Directory',          sub: 'All staff · Personal, department & contact info',                       icon: 'fa-users',                gradFrom: 'rgba(30,58,138,.1)',  gradTo: 'rgba(30,64,175,.18)',  iconColor: '#1E40AF', period: false, chips: ['All Staff', 'Dept-wise', 'Active / Inactive'], desc: 'Full staff list with personal details, departments, designations & contact info' },
  'salary-register' : { title: 'Salary Register',             sub: 'Monthly gross, deductions & net pay for all staff',                     icon: 'fa-file-invoice-dollar',  gradFrom: 'rgba(22,163,74,.1)',  gradTo: 'rgba(22,163,74,.18)',  iconColor: '#16A34A', period: true,  chips: ['Monthly', 'All Employees', 'PKR Totals'],          desc: 'Month-wise gross pay, allowances, deductions & net payable for all employees' },
  'loan-summary'    : { title: 'Loan & Advance Ledger',       sub: 'All employee loans, repayments & balances',                             icon: 'fa-hand-holding-dollar',  gradFrom: 'rgba(217,119,6,.1)',  gradTo: 'rgba(217,119,6,.18)',  iconColor: '#D97706', period: false, chips: ['Active Loans', 'Outstanding', 'Repayments'],       desc: 'All employee loans — issued amounts, repayments & outstanding balances' },
  'dept-summary'    : { title: 'Department Summary',          sub: 'Headcount, designations & salary cost per dept',                        icon: 'fa-building',             gradFrom: 'rgba(2,132,199,.1)',  gradTo: 'rgba(2,132,199,.18)',  iconColor: '#0284C7', period: false, chips: ['Headcount', 'Cost Analysis', 'Dept-wise'],         desc: 'Headcount, designations, salary cost & breakdown per department' },
  'leave-register'  : { title: 'Leave & Attendance Register', sub: 'Leave entitlements, balances & deduction policy',                       icon: 'fa-plane-departure',      gradFrom: 'rgba(139,92,246,.1)', gradTo: 'rgba(139,92,246,.18)', iconColor: '#7C3AED', period: false, chips: ['Leave Balance', 'Policy', 'Deductions'],           desc: 'Leave balances, entitlements, deductions & attendance policy per employee' },
  'payroll-summary' : { title: 'Payroll Summary Report',      sub: 'Month-wise payroll totals, deductions & status for all staff',          icon: 'fa-chart-pie',            gradFrom: 'rgba(15,118,110,.1)', gradTo: 'rgba(15,118,110,.18)', iconColor: '#0F766E', period: true,  chips: ['Monthly', 'All Staff', 'Totals & Status'],         desc: 'Month-wise payroll totals — gross pay, deductions, net payable & payment status overview' },
};

function HrReports({ emps, depts, desigs, toast }) {
  const empPayroll = useHrDemoPayroll(emps);
  const empLoans   = HR_DEMO_EMP_LOANS;

  const deptMap  = useMemo(() => new Map(depts.map(d => [d.id, d])), [depts]);
  const desigMap = useMemo(() => new Map(desigs.map(d => [d.id, d])), [desigs]);
  const getDeptName  = (id) => deptMap.get(id)?.name || '—';
  const getDesigName = (id) => desigMap.get(id)?.name || '—';

  const [picker, setPicker] = useState(null); // { type }

  const buildCtx = () => ({
    emps, depts, desigs,
    empPayroll, empLoans,
    fmtMoney, fmtDate, getFullName,
    getDeptName, getDesigName,
    getEmpTotalGross, getEmpStdDeductions,
  });

  const generate = (style, monthKey) => {
    if (!picker) return;
    const { type } = picker;
    const ctx = buildCtx();
    let html = '';
    if      (type === 'directory')       html = generateHrDirectoryReport(ctx);
    else if (type === 'salary-register') html = generateHrSalaryRegister(ctx, monthKey);
    else if (type === 'loan-summary')    html = generateHrLoanSummary(ctx);
    else if (type === 'dept-summary')    html = generateHrDeptSummary(ctx);
    else if (type === 'leave-register')  html = generateHrLeaveRegister(ctx);
    else if (type === 'payroll-summary') html = generateHrPayrollSummary(ctx, monthKey);
    if (!html) return;
    const w = window.open('', '_blank');
    if (!w) { toast('Pop-up blocked — please allow pop-ups for this site', 'error'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => { try { w.print(); } catch {} }, 400);
    const meta = HR_REPORT_META[type];
    toast(`${meta.title} (${style === 'color' ? 'Colorful' : 'B&W'}) ready — Print or Save as PDF`, 'success');
    setPicker(null);
  };

  return (
    <div className="hrb-root">
      <div className="section-card">
        <div id="hrReportCards" className="hr-rpt-grid">
          {Object.entries(HR_REPORT_META).map(([type, m]) => (
            <div
              key={type}
              className="hr-rpt-card"
              role="button"
              tabIndex={0}
              onClick={() => setPicker({ type })}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setPicker({ type }); }}
            >
              <div
                className="hr-rpt-icon"
                style={{
                  background:  `linear-gradient(135deg, ${m.gradFrom}, ${m.gradTo})`,
                  color:        m.iconColor,
                }}
              >
                <i className={`fa-solid ${m.icon}`} aria-hidden="true"></i>
              </div>
              <div className="hr-rpt-body">
                <div className="hr-rpt-name">{m.title}</div>
                <div className="hr-rpt-desc">{m.desc}</div>
                <div className="hr-rpt-chips">
                  {m.chips.map(c => <span key={c}>{c}</span>)}
                </div>
              </div>
              <div className="hr-rpt-arrow"><i className="fa-solid fa-chevron-right" aria-hidden="true"></i></div>
            </div>
          ))}
        </div>
      </div>

      {picker && (
        <HrRptModal
          type={picker.type}
          onClose={() => setPicker(null)}
          onGenerate={generate}
        />
      )}
    </div>
  );
}

function HrRptModal({ type, onClose, onGenerate }) {
  const meta = HR_REPORT_META[type] || HR_REPORT_META.directory;
  const [monthKey, setMonthKey] = useState('2026-05');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return createPortal((
    <div
      className="ov open"
      role="dialog" aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-head">
          <div className="modal-head-left">
            <div
              className="modal-head-icon"
              style={{
                background: `linear-gradient(135deg, ${meta.gradFrom}, ${meta.gradTo})`,
                color:       meta.iconColor,
              }}
            >
              <i className={`fa-solid ${meta.icon}`} aria-hidden="true"></i>
            </div>
            <div>
              <div className="modal-title">{meta.title}</div>
              <div className="modal-sub">
                <i className={`fa-solid ${meta.icon}`} style={{ marginRight: 5, color: 'var(--brand)' }} aria-hidden="true"></i>
                {meta.sub}
              </div>
            </div>
          </div>
          <Tooltip text="Close">
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>

        <div className="modal-body">
          {meta.period && (
            <div className="rsp-range-row" style={{ gridTemplateColumns: '1fr' }}>
              <div className="rsp-field">
                <label><i className="fa-solid fa-calendar-check" aria-hidden="true"></i> Report Month</label>
                <input type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} />
              </div>
            </div>
          )}

          <div style={{ fontSize: 12, color: 'var(--tm)', marginBottom: 6, lineHeight: 1.5 }}>
            Select one of the two report styles below. Both versions are A4-formatted and ready to print or save as PDF.
          </div>

          <div className="style-pick-grid">
            <div className="style-pick-card" onClick={() => onGenerate('color', monthKey)}>
              <span className="style-pick-tag">Recommended</span>
              <div className="style-pick-preview color">
                <div className="ppl-head"><i className="fa-solid fa-building" aria-hidden="true"></i> SCHOOL MENTOR</div>
                <div className="ppl-row mid"></div>
                <div className="ppl-row short"></div>
                <div className="ppl-tile">PKR 50,000</div>
                <div className="ppl-pill"></div>
              </div>
              <div className="style-pick-info">
                <div className="style-pick-title"><i className="fa-solid fa-palette" aria-hidden="true"></i> Colorful</div>
                <div className="style-pick-desc">ERP theme colors, professional header, color-coded badges and highlights.</div>
              </div>
            </div>
            <div className="style-pick-card bw-card" onClick={() => onGenerate('bw', monthKey)}>
              <span className="style-pick-tag">Low Ink</span>
              <div className="style-pick-preview bw">
                <div className="ppl-head"><i className="fa-solid fa-building" aria-hidden="true"></i> SCHOOL MENTOR</div>
                <div className="ppl-row mid"></div>
                <div className="ppl-row short"></div>
                <div className="ppl-tile">PKR 50,000</div>
                <div className="ppl-pill"></div>
              </div>
              <div className="style-pick-info">
                <div className="style-pick-title"><i className="fa-solid fa-print" aria-hidden="true"></i> Colorless / B&amp;W</div>
                <div className="style-pick-desc">White background, black/gray text, light borders only — saves ink on printing.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  ), document.body);
}

function getEmpTotalGross(e, bonus = 0) {
  const basic = Number(e.basicSalary) || 0;
  const allow = (e.salaryHeads || []).filter(h => h.type === 'allow').reduce((s, h) => s + (Number(h.amount) || 0), 0);
  return basic + allow + (Number(bonus) || 0);
}

function getEmpStdDeductions(e) {
  return (e.salaryHeads || []).filter(h => h.type === 'deduct').reduce((s, h) => s + (Number(h.amount) || 0), 0);
}

function Financials({ emps, depts = [], desigs, toast }) {
  const now = new Date();
  const [month, setMonth] = useState(PAY_MONTHS[now.getMonth()]);
  const [year,  setYear]  = useState(String(now.getFullYear()));
  const [openId,     setOpenId]     = useState(null);
  const [reportsId,  setReportsId]  = useState(null);
  const [actionsId,  setActionsId]  = useState(null);
  const [prFor,      setPrFor]      = useState(null);   // emp opened in the Pay Roll modal
  const [alFor,      setAlFor]      = useState(null);   // emp opened in the Advance / Loan modal
  const [rspFor,     setRspFor]     = useState(null);   // { emp, type } for the Reports style picker

  /* Per-employee payroll: empPayroll[empId][monthKey] = { ...record }.
     monthKey is `YYYY-MM` (zero-padded). Persists in component state
     since no Payroll service has landed yet. */
  const [empPayroll, setEmpPayroll] = useState({});

  /* Per-employee loans: empLoans[empId] = [...loans]. Each loan:
       { id, loanNumber, amount, comment,
         repaymentType: 'OneTime' | 'Installment',
         deductDate, installmentType, installmentAmount,
         status: 'active' | 'returned',
         received: [{ amount, date, comment }],
         remaining, createdAt }                          */
  const [empLoans,   setEmpLoans]   = useState({
    /* Sample loan for emp 1 (Dr. Islahudin) — 1:1 from HTML reference. */
    1: [
      {
        id:                1001,
        loanNumber:        1,
        amount:            100000,
        comment:           'Wedding Loan',
        repaymentType:     'Installment',
        deductDate:        '2025-08-15',
        installmentType:   'Monthly',
        installmentAmount: 5000,
        status:            'active',
        received:          [
          { amount: 5000, date: '2025-09-30', comment: 'September installment via payroll' },
          { amount: 5000, date: '2025-10-31', comment: 'October installment via payroll'   },
          { amount: 5000, date: '2025-11-30', comment: 'November installment via payroll'  },
          { amount: 5000, date: '2025-12-31', comment: 'December installment via payroll'  },
          { amount: 5000, date: '2026-01-31', comment: 'January installment via payroll'   },
        ],
        remaining:         75000,
        createdAt:         '2025-08-15',
      },
    ],
  });
  const [nextLoanId, setNextLoanId] = useState(1002);

  /* ── Seed demo payroll history for Dr. Islahudin (emp #1) — 1:1
        port of seedDemoFinancialData. Populates 10 months of historic
        records so the Salary Slip + Pay History Ledger reports show
        realistic data when generated. Runs once after emps load. ── */
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (!emps || !emps.length) return;
    const empId = 1;
    const e = emps.find(x => x.id === empId);
    if (!e) return;
    seededRef.current = true;

    const basic     = +e.basicSalary || 80000;
    const stdDeduct = getEmpStdDeductions(e);
    const demoMonths = [
      { key: '2025-08', month: 'August',    year: 2025, bonus: 0,     fineDeduct: 0,   leaveDeduct: 0,    absentDeduct: 0, leaveCount: 0, absentCount: 0, fineComment: '',                       leaveComment: '',               loanCut: 0,    advRecovery: 0 },
      { key: '2025-09', month: 'September', year: 2025, bonus: 0,     fineDeduct: 0,   leaveDeduct: 0,    absentDeduct: 0, leaveCount: 0, absentCount: 0, fineComment: '',                       leaveComment: '',               loanCut: 5000, advRecovery: 0 },
      { key: '2025-10', month: 'October',   year: 2025, bonus: 5000,  fineDeduct: 0,   leaveDeduct: 0,    absentDeduct: 0, leaveCount: 0, absentCount: 0, fineComment: '',                       leaveComment: '',               loanCut: 5000, advRecovery: 0 },
      { key: '2025-11', month: 'November',  year: 2025, bonus: 0,     fineDeduct: 500, leaveDeduct: 0,    absentDeduct: 0, leaveCount: 0, absentCount: 0, fineComment: 'Late report submission', leaveComment: '',               loanCut: 5000, advRecovery: 0 },
      { key: '2025-12', month: 'December',  year: 2025, bonus: 10000, fineDeduct: 0,   leaveDeduct: 0,    absentDeduct: 0, leaveCount: 0, absentCount: 0, fineComment: '',                       leaveComment: '',               loanCut: 5000, advRecovery: 0 },
      { key: '2026-01', month: 'January',   year: 2026, bonus: 0,     fineDeduct: 0,   leaveDeduct: 0,    absentDeduct: 0, leaveCount: 0, absentCount: 0, fineComment: '',                       leaveComment: '',               loanCut: 5000, advRecovery: 0 },
      { key: '2026-02', month: 'February',  year: 2026, bonus: 0,     fineDeduct: 0,   leaveDeduct: 0,    absentDeduct: 0, leaveCount: 0, absentCount: 0, fineComment: '',                       leaveComment: '',               loanCut: 0,    advRecovery: 3000 },
      { key: '2026-03', month: 'March',     year: 2026, bonus: 0,     fineDeduct: 0,   leaveDeduct: 1500, absentDeduct: 0, leaveCount: 1, absentCount: 0, fineComment: '',                       leaveComment: '1 unpaid leave', loanCut: 0,    advRecovery: 3000 },
      { key: '2026-04', month: 'April',     year: 2026, bonus: 5000,  fineDeduct: 0,   leaveDeduct: 0,    absentDeduct: 0, leaveCount: 0, absentCount: 0, fineComment: '',                       leaveComment: '',               loanCut: 0,    advRecovery: 2500 },
      { key: '2026-06', month: 'June',      year: 2026, bonus: 3000,  fineDeduct: 0,   leaveDeduct: 0,    absentDeduct: 0, leaveCount: 0, absentCount: 0, fineComment: '',                       leaveComment: '',               loanCut: 5000, advRecovery: 0 },
    ];

    setEmpPayroll(prev => {
      const empMap = { ...(prev[empId] || {}) };
      demoMonths.forEach((m) => {
        if (empMap[m.key]) return;
        const totalGross  = getEmpTotalGross(e, m.bonus);
        const otherDed    = (m.fineDeduct || 0) + (m.leaveDeduct || 0) + (m.absentDeduct || 0);
        const totalDeduct = stdDeduct + (m.loanCut || 0) + (m.advRecovery || 0) + otherDed;
        const net         = totalGross - totalDeduct;
        const monthIdx    = parseInt(m.key.split('-')[1], 10);
        const lastDay     = new Date(m.year, monthIdx, 0).getDate();
        const payDate     = `${m.year}-${String(monthIdx).padStart(2, '0')}-${String(Math.min(lastDay, 28)).padStart(2, '0')}`;
        empMap[m.key] = {
          month: m.month, year: m.year, status: 'Paid',
          basicPay: basic, bonus: m.bonus || 0, totalGross,
          stdDeductions: stdDeduct,
          loanDeduct: m.loanCut || 0, customLoan: 0,
          advanceRecovery: m.advRecovery || 0,
          fineDeduct: m.fineDeduct || 0, leaveDeduct: m.leaveDeduct || 0, absentDeduct: m.absentDeduct || 0,
          totalDeductions: totalDeduct,
          leaveCount: m.leaveCount || 0, absentCount: m.absentCount || 0,
          fineComment: m.fineComment || '', leaveComment: m.leaveComment || '', absentComment: '',
          netPayable: net,
          payments: [{ amount: net, date: payDate, comment: 'Salary cleared' }],
          paidAmount: net, paidDate: payDate, loanRecorded: (m.loanCut || 0) > 0,
          generatedAt: payDate,
        };
      });
      return { ...prev, [empId]: empMap };
    });
  }, [emps]);

  const monthKey = (m, y) => {
    const idx = PAY_MONTHS.indexOf(m) + 1;
    return `${y}-${String(idx).padStart(2, '0')}`;
  };
  const getRec = (empId, m = month, y = year) => empPayroll[empId]?.[monthKey(m, y)] || null;

  const upsertRec = (empId, m, y, partial) => {
    setEmpPayroll(prev => {
      const key  = monthKey(m, y);
      const next = { ...prev };
      next[empId] = { ...(next[empId] || {}) };
      next[empId][key] = { ...(next[empId][key] || {}), ...partial };
      return next;
    });
  };

  /* Loan helpers */
  const getEmpLoans          = (empId) => empLoans[empId] || [];
  const getActiveLoans       = (empId) => getEmpLoans(empId).filter(l => l.status === 'active');
  const getLoanRemaining     = (empId) => getActiveLoans(empId).reduce((s, l) => s + (Number(l.remaining) || 0), 0);
  const getActiveLoanCount   = (empId) => getActiveLoans(empId).length;
  const getLoanTotalReturned = (empId) =>
    getEmpLoans(empId).reduce((s, l) => s + (l.received || []).reduce((a, r) => a + (Number(r.amount) || 0), 0), 0);
  const getMonthlyLoanDeduct = (empId) =>
    getActiveLoans(empId)
      .filter(l => l.repaymentType === 'Installment')
      .reduce((s, l) => s + (Number(l.installmentAmount) || 0), 0);

  /* Loan mutators */
  const saveNewLoan = (empId, payload) => {
    const amount = Number(payload.amount) || 0;
    if (amount <= 0) { toast('Please enter a valid loan amount', 'error'); return; }
    if (!payload.repaymentType) { toast('Please select repayment type', 'error'); return; }
    if (payload.repaymentType === 'Installment'
        && (!payload.installmentType || !(Number(payload.installmentAmount) > 0))) {
      toast('Please complete installment details', 'error'); return;
    }
    const today    = new Date().toISOString().slice(0, 10);
    const existing = empLoans[empId] || [];
    const loan = {
      id:                nextLoanId,
      loanNumber:        existing.length + 1,
      amount,
      comment:           payload.comment || 'N/A',
      repaymentType:     payload.repaymentType,
      deductDate:        payload.deductDate || today,
      installmentType:   payload.repaymentType === 'Installment' ? payload.installmentType : null,
      installmentAmount: payload.repaymentType === 'Installment'
                           ? (Number(payload.installmentAmount) || 0)
                           : amount,
      status:            'active',
      received:          [],
      remaining:         amount,
      createdAt:         today,
    };
    setEmpLoans(prev => ({ ...prev, [empId]: [...(prev[empId] || []), loan] }));
    setNextLoanId(id => id + 1);
    toast(`Loan of PKR ${fmtMoney(amount)} set up successfully`, 'success');
  };

  const saveLoanRepayment = (empId, payload) => {
    const amt = Number(payload.amount) || 0;
    if (!payload.loanId || amt <= 0) {
      toast('Please select a loan and enter a valid amount', 'error'); return;
    }
    const loan = (empLoans[empId] || []).find(l => l.id === payload.loanId);
    if (!loan) return;
    if (amt > loan.remaining) {
      toast(`Amount cannot exceed remaining balance (PKR ${fmtMoney(loan.remaining)})`, 'error');
      return;
    }
    setEmpLoans(prev => {
      const list = (prev[empId] || []).map(l => {
        if (l.id !== payload.loanId) return l;
        const remaining = Math.max(0, (Number(l.remaining) || 0) - amt);
        return {
          ...l,
          remaining,
          status: remaining <= 0 ? 'returned' : l.status,
          received: [
            ...(l.received || []),
            { amount: amt, date: payload.date, comment: payload.comment || '' },
          ],
        };
      });
      return { ...prev, [empId]: list };
    });
    toast(`Loan repayment of PKR ${fmtMoney(amt)} recorded`, 'success');
  };

  const markLoanReturned = (empId, loanId) => {
    const today = new Date().toISOString().slice(0, 10);
    setEmpLoans(prev => {
      const list = (prev[empId] || []).map(l => {
        if (l.id !== loanId) return l;
        const received = [...(l.received || [])];
        if ((Number(l.remaining) || 0) > 0) {
          received.push({
            amount:  Number(l.remaining) || 0,
            date:    today,
            comment: 'Final settlement — marked returned',
          });
        }
        return { ...l, remaining: 0, status: 'returned', received };
      });
      return { ...prev, [empId]: list };
    });
    toast('Loan marked as returned', 'success');
  };

  /* Close both dropdown menus when user clicks outside */
  useEffect(() => {
    if (reportsId == null && actionsId == null) return undefined;
    const onDown = (e) => {
      if (!e.target.closest?.('.menu-wrap')) {
        setReportsId(null);
        setActionsId(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [reportsId, actionsId]);

  const deptMap  = useMemo(() => new Map(depts.map(d => [d.id, d])), [depts]);
  const desigMap = useMemo(() => new Map(desigs.map(d => [d.id, d])), [desigs]);
  const getDeptName  = (id) => deptMap.get(id)?.name || '—';
  const getDesigName = (id) => desigMap.get(id)?.name || '—';

  const activeEmps = useMemo(() => emps.filter(e => e.status === 'Active'), [emps]);

  const stub = (label) => {
    setReportsId(null);
    setActionsId(null);
    toast(`${label} — coming in the next sprint`, 'info');
  };
  const openPayRoll = (e) => {
    setActionsId(null);
    setReportsId(null);
    setPrFor(e);
  };
  const openRsp = (e, type) => {
    setActionsId(null);
    setReportsId(null);
    setRspFor({ emp: e, type });
  };

  /* Open the generated report in a new window. Mirrors generateChosenReport. */
  const generateReport = (style, picked) => {
    if (!rspFor) return;
    const { emp, type } = rspFor;
    const ctx = {
      fmtMoney, fmtDate, getFullName,
      getDeptName, getDesigName,
      empPayroll, empLoans,
    };
    let html = '';
    if      (type === 'salaryslip') html = generateSalarySlipHTML(emp, picked.monthKey || '2026-05', style, ctx);
    else if (type === 'history')    html = generatePayHistoryReportHTML(emp, picked.fromKey || '2026-01', picked.toKey || '2026-06', style, ctx);
    else if (type === 'loan')       html = generateLoanReportHTML(emp, style, ctx);
    if (!html) return;
    const w = window.open('', '_blank');
    if (!w) { toast('Pop-up blocked — please allow pop-ups for this site', 'error'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => { try { w.print(); } catch {} }, 400);
    toast(`${RSP_META[type].title} ready (${style === 'color' ? 'Colorful' : 'B&W'}) — Print or Save as PDF`, 'success');
    setRspFor(null);
  };

  const openAdvLoan = (e) => {
    setActionsId(null);
    setReportsId(null);
    setAlFor(e);
  };

  return (
    <div className="hrb-root">
      <div className="section-card">
        {/* ─── Info banner ─── */}
        <div className="ux-info-banner">
          <div className="ux-info-icon"><i className="fa-solid fa-circle-info" aria-hidden="true"></i></div>
          <div className="ux-info-body">
            <div className="ux-info-row"><strong>Salary Information:</strong> Salary data here will be connected with the Payroll engine once the full Payroll Module is implemented.</div>
            <div className="ux-info-row"><strong>Advance / Loan:</strong> Employee advances and loans recorded here will be automatically reflected in future payroll calculations.</div>
          </div>
        </div>

        {/* ─── Filter bar ─── */}
        <div className="pay-filter-bar">
          <div className="pay-filter-group">
            <Tooltip text="Select the payroll month to view">
              <label><i className="fa-solid fa-calendar-day" aria-hidden="true"></i> Month</label>
            </Tooltip>
            <Tooltip text="Choose the month to view payroll status">
              <select value={month} onChange={(e) => setMonth(e.target.value)}>
                {PAY_MONTHS.map(m => <option key={m}>{m}</option>)}
              </select>
            </Tooltip>
          </div>
          <div className="pay-filter-group">
            <Tooltip text="Select the year for payroll records">
              <label><i className="fa-solid fa-calendar-days" aria-hidden="true"></i> Year</label>
            </Tooltip>
            <Tooltip text="Choose the year to view payroll status">
              <select value={year} onChange={(e) => setYear(e.target.value)}>
                {['2024', '2025', '2026', '2027'].map(y => <option key={y}>{y}</option>)}
              </select>
            </Tooltip>
          </div>
          <div className="pay-status-legend">
            <Tooltip text="Payroll has not been generated for this month yet">
              <span className="pay-status-chip pay-status-chip--notgen">
                <i className="fa-solid fa-circle" aria-hidden="true"></i> Not Generated
              </span>
            </Tooltip>
            <Tooltip text="Payroll generated but not yet paid">
              <span className="pay-status-chip pay-status-chip--gen">
                <i className="fa-solid fa-circle" aria-hidden="true"></i> Generated
              </span>
            </Tooltip>
            <Tooltip text="Partial payment received, balance still pending">
              <span className="pay-status-chip pay-status-chip--partial">
                <i className="fa-solid fa-circle" aria-hidden="true"></i> Partially Paid
              </span>
            </Tooltip>
            <Tooltip text="Salary fully paid for this month">
              <span className="pay-status-chip pay-status-chip--paid">
                <i className="fa-solid fa-circle" aria-hidden="true"></i> Paid
              </span>
            </Tooltip>
          </div>
        </div>

        {/* ─── Table head ─── */}
        <div className="pay-t-head">
          <div className="th">S.No</div>
          <div className="th">Photo</div>
          <div className="th">Name</div>
          <div className="th">Designation</div>
          <div className="th">Status</div>
          <div className="th" style={{ textAlign: 'center' }}>Reports</div>
          <div className="th" style={{ textAlign: 'right', justifySelf: 'end' }}>Actions</div>
          <div className="th" style={{ textAlign: 'center' }}>▾</div>
        </div>

        {/* ─── Rows / empty state ─── */}
        {activeEmps.length === 0 ? (
          <EmptyState
            icon="fa-users"
            title="No Active Employees"
            sub="Add active employees first to process payroll."
          />
        ) : (
          activeEmps.map((e, i) => (
            <PayrollRow
              key={e.id}
              idx={i + 1}
              emp={e}
              month={month}
              year={year}
              rec={getRec(e.id)}
              loanRemaining={getLoanRemaining(e.id)}
              desigName={getDesigName(e.desId)}
              isOpen={openId === e.id}
              onToggleOpen={() => setOpenId(prev => prev === e.id ? null : e.id)}
              reportsOpen={reportsId === e.id}
              onToggleReports={() => { setActionsId(null); setReportsId(prev => prev === e.id ? null : e.id); }}
              actionsOpen={actionsId === e.id}
              onToggleActions={() => { setReportsId(null); setActionsId(prev => prev === e.id ? null : e.id); }}
              onPayRoll={() => openPayRoll(e)}
              onAdvLoan={() => openAdvLoan(e)}
              onReport={(type) => openRsp(e, type)}
              onStub={stub}
            />
          ))
        )}
      </div>

      {prFor && (
        <PayRollModal
          emp={prFor}
          month={month}
          year={year}
          rec={getRec(prFor.id)}
          loanRemaining={getLoanRemaining(prFor.id)}
          monthlyLoanDeduct={getMonthlyLoanDeduct(prFor.id)}
          onClose={() => setPrFor(null)}
          onSaveSetup={(rec) => upsertRec(prFor.id, month, year, rec)}
          onRecordPayment={(rec) => upsertRec(prFor.id, month, year, rec)}
          toast={toast}
        />
      )}

      {rspFor && (
        <RspModal
          emp={rspFor.emp}
          type={rspFor.type}
          month={month}
          year={year}
          onClose={() => setRspFor(null)}
          onGenerate={generateReport}
        />
      )}

      {alFor && (
        <AdvLoanModal
          emp={alFor}
          loans={getEmpLoans(alFor.id)}
          activeLoans={getActiveLoans(alFor.id)}
          totalLoaned={getEmpLoans(alFor.id).reduce((s, l) => s + (Number(l.amount) || 0), 0)}
          totalReturned={getLoanTotalReturned(alFor.id)}
          totalRemaining={getLoanRemaining(alFor.id)}
          activeCount={getActiveLoanCount(alFor.id)}
          onClose={() => setAlFor(null)}
          onSaveNew={(payload)   => saveNewLoan(alFor.id, payload)}
          onSaveRepay={(payload) => saveLoanRepayment(alFor.id, payload)}
          onMarkReturned={(loanId) => markLoanReturned(alFor.id, loanId)}
          toast={toast}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PAYROLL ROW — one per active employee, with expand-to-detail panel.
   ═══════════════════════════════════════════════════════════════════ */
function PayrollRow({
  idx, emp, month, year, rec, loanRemaining, desigName,
  isOpen, onToggleOpen,
  reportsOpen, onToggleReports,
  actionsOpen, onToggleActions,
  onPayRoll, onAdvLoan, onReport, onStub,
}) {
  const nm = getFullName(emp);
  const ini = nm.split(' ').filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 2) || '?';

  let status, statusLabel, statusIcon;
  if (!rec)                                  { status = 'notgen';  statusLabel = 'Not Generated';   statusIcon = 'fa-circle'; }
  else if (rec.status === 'Paid')            { status = 'paid';    statusLabel = 'Paid';            statusIcon = 'fa-circle-check'; }
  else if (rec.status === 'Partially Paid')  { status = 'partial'; statusLabel = 'Partially Paid';  statusIcon = 'fa-circle-half-stroke'; }
  else                                       { status = 'gen';     statusLabel = 'Generated';       statusIcon = 'fa-clock'; }
  const canPay = status !== 'paid';

  return (
    <div>
      <div className={`pay-row${isOpen ? ' open' : ''}`}>
        <div className="td td-num">{idx}</div>
        <div className="td">
          <div className="emp-avatar">{emp.photo ? <img src={emp.photo} alt="" /> : ini}</div>
        </div>
        <div className="td" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
          <span style={{ fontWeight: 700, color: 'var(--t1)', fontSize: 13 }}>{nm}</span>
          <span style={{ fontSize: 10.5, color: 'var(--tm)', fontWeight: 600 }}>{emp.eid}</span>
        </div>
        <div className="td">
          <span className="badge b-gray" style={{ fontSize: 10.5 }}>{desigName}</span>
        </div>
        <div className="td">
          <span className={`pay-status ${status}`}>
            <i className={`fa-solid ${statusIcon}`} aria-hidden="true"></i> {statusLabel}
          </span>
        </div>

        {/* Reports button + dropdown */}
        <div className="td" style={{ justifyContent: 'center' }}>
          <div className="menu-wrap">
            <Tooltip text="Open employee reports">
              <button type="button" className="btn-reports" onClick={onToggleReports}>
                <i className="fa-solid fa-chart-line" aria-hidden="true"></i>
                <span className="label-full">Reports</span>
                <i className="fa-solid fa-chevron-down chev" aria-hidden="true"></i>
              </button>
            </Tooltip>
            {reportsOpen && (
              <div className="drop-menu" role="menu">
                <Tooltip text="Generate a printable salary slip for a selected month">
                  <button type="button" className="drop-item" onClick={() => onReport('salaryslip')}>
                    <i className="fa-solid fa-file-invoice-dollar" style={{ color: '#1E40AF' }} aria-hidden="true"></i> Salary Slip
                  </button>
                </Tooltip>
                <Tooltip text="Detailed month-by-month pay history with totals">
                  <button type="button" className="drop-item" onClick={() => onReport('history')}>
                    <i className="fa-solid fa-clock-rotate-left" style={{ color: '#7C3AED' }} aria-hidden="true"></i> Pay History Ledger
                  </button>
                </Tooltip>
                <Tooltip text="Full loan / advance account statement with transactions">
                  <button type="button" className="drop-item" onClick={() => onReport('loan')}>
                    <i className="fa-solid fa-hand-holding-dollar" style={{ color: '#16A34A' }} aria-hidden="true"></i> Loan / Advance Report
                  </button>
                </Tooltip>
              </div>
            )}
          </div>
        </div>

        {/* 3-dots Actions button + dropdown */}
        <div className="td" style={{ gap: 5, justifyContent: 'flex-end' }}>
          <div className="menu-wrap">
            <Tooltip text="More Actions">
              <button type="button" className="btn-dots" onClick={onToggleActions}>
                <i className="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
              </button>
            </Tooltip>
            {actionsOpen && (
              <div className="drop-menu" role="menu">
                <Tooltip text="Generate, process and pay this month's salary">
                  <button
                    type="button"
                    className="drop-item"
                    onClick={onPayRoll}
                    disabled={!canPay}
                    style={!canPay ? { opacity: .45, cursor: 'not-allowed' } : undefined}
                  >
                    <i className="fa-solid fa-money-check-dollar" style={{ color: '#1E40AF' }} aria-hidden="true"></i>{' '}
                    {status === 'partial' ? 'Pay Roll (Add More Payment)' : status === 'paid' ? 'Pay Roll (Already Paid)' : 'Pay Roll'}
                  </button>
                </Tooltip>
                <Tooltip text="Set up new advance/loan, record repayments or view loan history">
                  <button type="button" className="drop-item" onClick={onAdvLoan}>
                    <i className="fa-solid fa-hand-holding-dollar" style={{ color: '#16A34A' }} aria-hidden="true"></i> Advance / Loan
                  </button>
                </Tooltip>
              </div>
            )}
          </div>
        </div>

        {/* Expand chevron */}
        <div className="td" style={{ justifyContent: 'center' }}>
          <Tooltip text="Expand to view this month's payroll breakdown">
            <button
              type="button"
              className={`btn-expand${isOpen ? ' open' : ''}`}
              onClick={onToggleOpen}
              aria-expanded={isOpen}
            >
              <i className="fa-solid fa-chevron-down" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>
      </div>

      <div className={`pay-panel${isOpen ? ' open' : ''}`}>
        <div className="pay-panel-inner">
          {isOpen && (
            <PayrollDetailPanel
              emp={emp}
              month={month}
              year={year}
              rec={rec}
              loanRemaining={loanRemaining}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PAYROLL DETAIL PANEL — 4-col KV grid + payment transactions list.
   Renders inside the expand chevron of each .pay-row.
   ═══════════════════════════════════════════════════════════════════ */
function PayrollDetailPanel({ emp, month, year, rec, loanRemaining = 0 }) {
  rec = rec || {};
  const basic       = Number(emp.basicSalary) || 0;
  const totalGross  = rec.totalGross !== undefined ? rec.totalGross : getEmpTotalGross(emp, rec.bonus || 0);
  const totalDeduct = rec.totalDeductions || 0;
  const net         = rec.netPayable !== undefined ? rec.netPayable : (totalGross - getEmpStdDeductions(emp));
  const payments    = rec.payments || [];
  const paid        = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining   = Math.max(0, (rec.netPayable || net) - paid);
  const statusClass = rec.status === 'Paid'
                        ? 'paid'
                        : rec.status === 'Partially Paid'
                          ? 'partial'
                          : (rec.status ? 'gen' : 'notgen');

  const cls = (n) => n > 0 ? 'val neg' : 'val zero';

  return (
    <>
      <div className="pay-detail-grid">
        <PdItem k="Month of"                  v={`${month} ${year}`} />
        <PdItem k="Basic Pay"                 v={`PKR ${fmtMoney(basic)}`} />
        <PdItem k="Bonus"                     v={`PKR ${fmtMoney(rec.bonus || 0)}`} valClass={(rec.bonus || 0) > 0 ? 'val pos' : 'val zero'} />
        <PdItem k="Total Gross"               v={`PKR ${fmtMoney(totalGross)}`} valClass="val pos" />
        <PdItem k="Advance / Loan Outstanding" v={`PKR ${fmtMoney(loanRemaining)}`} valClass={loanRemaining > 0 ? 'val neg' : 'val zero'} />
        <PdItem k="Loan Deduction"            v={`PKR ${fmtMoney(rec.loanDeduct  || 0)}`} valClass={cls(rec.loanDeduct  || 0)} />
        <PdItem k="Fine Deduction"            v={`PKR ${fmtMoney(rec.fineDeduct  || 0)}`} valClass={cls(rec.fineDeduct  || 0)} />
        <PdItem k="Leave Deduction"           v={`PKR ${fmtMoney(rec.leaveDeduct || 0)}`} valClass={cls(rec.leaveDeduct || 0)} />
        <PdItem k="Absent Deduction"          v={`PKR ${fmtMoney(rec.absentDeduct|| 0)}`} valClass={cls(rec.absentDeduct|| 0)} />
        <PdItem k="Custom Loan Deduction"     v={`PKR ${fmtMoney(rec.customLoan  || 0)}`} valClass={cls(rec.customLoan  || 0)} />
        <PdItem k="Total Deductions"          v={`PKR ${fmtMoney(totalDeduct)}`} valClass={cls(totalDeduct)} />
        <div className="pay-detail-item">
          <label>Payment Status</label>
          <div className="val">
            <span className={`pay-status ${statusClass}`}>{rec.status || 'Not Generated'}</span>
          </div>
        </div>
        <div className="pay-detail-item">
          <label>Net Payable</label>
          <div className="val pos" style={{ fontSize: 15, color: 'var(--brand)' }}>PKR {fmtMoney(net || 0)}</div>
        </div>
        <PdItem k={`Paid Amount (${payments.length} tx)`} v={`PKR ${fmtMoney(paid)}`} valClass={paid ? 'val pos' : 'val zero'} />
        <PdItem k="Remaining Amount" v={`PKR ${fmtMoney(remaining)}`} valClass={remaining > 0 ? 'val neg' : 'val pos'} />
      </div>

      {payments.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="pay-tx-head">
            <i className="fa-solid fa-receipt" aria-hidden="true"></i> Payment Transactions
            <span className="pay-tx-count">{payments.length} entries</span>
          </div>
          <div className="pay-tx-list">
            {payments.map((p, i) => (
              <div className="pay-tx-row" key={i} style={{ borderBottom: i < payments.length - 1 ? '1px solid var(--bl)' : 'none' }}>
                <span className="pay-tx-seq">#{i + 1}</span>
                <span className="pay-tx-amt"><i className="fa-solid fa-plus-circle" aria-hidden="true"></i> PKR {fmtMoney(p.amount)}</span>
                <span className="pay-tx-cmt">{p.comment || 'No comment'}</span>
                <span className="pay-tx-date">{fmtDate(p.date) || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function PdItem({ k, v, valClass }) {
  return (
    <div className="pay-detail-item">
      <label>{k}</label>
      <div className={valClass || 'val'}>{v}</div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   PAY ROLL MODAL — 1:1 port of #prOv from "Human Resource .html".

   Two tabs (m-tabs underline):
     0. Pay Roll Setup
        • Salary Structure (Basic + each allowance read-only) +
          Bonus / Select Month / Total Gross row
        • Deductions for the Month (Remaining Loan ro / Loan Deduct /
          Custom Loan / Fine + Fine Comment full-span /
          Leave count → auto Leave Deduct + Leave Comment wide /
          Absent count → auto Absent Deduct + Absent Comment wide)
        • Brand-blue Net Payable hero card with Gross / Deductions side
     1. Make Payment
        • Salary Structure (Read-only)
        • Deductions Applied (Read-only — 6 fields)
        • Payment Settlement (3 .settle-tiles: Net / Paid / Remaining)
          → Pay Amount + Comment row + Payment History list

   Auto-recalc on Bonus, all deduction inputs and the auto-calc
   leaves×absentDed / absents×unpaidDed pathways. Save & Next persists
   the rec and jumps to tab 1; Make Payment appends to payments[]
   and flips status between Generated / Partially Paid / Paid.
   ═══════════════════════════════════════════════════════════════════ */
function PayRollModal({
  emp, month, year, rec: existingRec,
  loanRemaining = 0, monthlyLoanDeduct = 0,
  onClose, onSaveSetup, onRecordPayment, toast,
}) {
  const [tab, setTab] = useState(0);

  const heads      = emp.salaryHeads || [];
  const allowances = heads.filter(h => h.type === 'allow');
  const deductions = heads.filter(h => h.type === 'deduct');

  const basic     = Number(emp.basicSalary) || 0;
  const stdDeduct = getEmpStdDeductions(emp);

  /* ── Setup form state (seeded from existing rec if any) ── */
  const seed = existingRec || {};
  const [bonus,         setBonus]         = useState(seed.bonus || 0);
  const [loanDeduct,    setLoanDeduct]    = useState(seed.loanDeduct !== undefined ? seed.loanDeduct : monthlyLoanDeduct);
  const [customLoan,    setCustomLoan]    = useState(seed.customLoan || 0);
  const [fineDeduct,    setFineDeduct]    = useState(seed.fineDeduct || 0);
  const [fineComment,   setFineComment]   = useState(seed.fineComment || '');
  const [leaveCount,    setLeaveCount]    = useState(seed.leaveCount  || 0);
  const [leaveDeduct,   setLeaveDeduct]   = useState(seed.leaveDeduct || 0);
  const [leaveComment,  setLeaveComment]  = useState(seed.leaveComment || '');
  const [absentCount,   setAbsentCount]   = useState(seed.absentCount  || 0);
  const [absentDeduct,  setAbsentDeduct]  = useState(seed.absentDeduct || 0);
  const [absentComment, setAbsentComment] = useState(seed.absentComment || '');

  /* ── Make Payment form state ── */
  const [payAmount,  setPayAmount]  = useState('');
  const [payComment, setPayComment] = useState('');

  /* If a record already has payments, jump straight to Make Payment tab. */
  useEffect(() => {
    if ((existingRec?.payments || []).length > 0) setTab(1);
    else setTab(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Esc + body lock */
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  /* Auto-recalc whenever any deduction input changes. Mirrors recalcPR. */
  const totalGross = getEmpTotalGross(emp, bonus);
  const effectiveLoanDeduct =
    Number(customLoan) > 0 ? Number(customLoan) : Number(loanDeduct);
  const totalDeductions =
    stdDeduct
    + effectiveLoanDeduct
    + Number(fineDeduct)
    + Number(leaveDeduct)
    + Number(absentDeduct);
  const netPayable = totalGross - totalDeductions;

  /* Auto-calc chargeable leave/absent via the server. Absents have no quota
     (charged in full every month); leaves have an annual quota and the server
     subtracts excess already charged in earlier months this year — so the count
     fields are server-owned (read-only) while the amounts stay editable. The
     returned data mirrors calculate-leave-absent-deduction's `data` payload. */
  const [attnCalc, setAttnCalc] = useState({ loading: false, done: false, data: null });
  useEffect(() => {
    let alive = true;
    setAttnCalc({ loading: true, done: false, data: null });
    hrService.calculateLeaveAbsentDeduction({
      employeeID:   emp.id,
      payrollMonth: PAY_MONTHS.indexOf(month) + 1,
      payrollYear:  Number(year),
    })
      .then((data) => {
        if (!alive) return;
        setLeaveCount(Number(data.excessLeavesThisMonth) || 0);
        setLeaveDeduct(Number(data.leaveDeductionAmount) || 0);
        setAbsentCount(Number(data.absentCountThisMonth) || 0);
        setAbsentDeduct(Number(data.absentDeductionAmount) || 0);
        setAttnCalc({ loading: false, done: true, data });
      })
      .catch(() => { if (alive) setAttnCalc({ loading: false, done: true, data: null }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Make Payment derived state ── */
  const payments     = existingRec?.payments || [];
  const totalPaid    = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const recNet       = existingRec?.netPayable ?? netPayable;
  const remaining    = Math.max(0, recNet - totalPaid);
  const isFullyPaid  = remaining <= 0.01;

  /* When switching to MP tab, seed Pay Amount with the remaining balance. */
  useEffect(() => {
    if (tab !== 1) return;
    if (isFullyPaid) {
      setPayAmount('0');
      setPayComment('');
      return;
    }
    setPayAmount(remaining.toFixed(2).replace(/\.00$/, ''));
    setPayComment('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, existingRec?.payments?.length, recNet]);

  const [savingSetup, setSavingSetup] = useState(false);
  const savePRSetup = async () => {
    if (savingSetup) return;
    /* Persist the setup values to the backend, then update the local record. */
    setSavingSetup(true);
    let payrollID = existingRec?.payrollID || 0;
    try {
      const resp = await hrService.saveHrPayrollSetup({
        employeeID:       emp.id,
        payrollMonth:     PAY_MONTHS.indexOf(month) + 1,
        payrollYear:      Number(year),
        bonus,
        loanDeduction:    loanDeduct,
        customLoanAmount: customLoan,
        fineDeduction:    fineDeduct,
        fineComment,
        leaveCount,
        leaveDeduction:   leaveDeduct,
        leaveComment,
        absentCount,
        absentDeduction:  absentDeduct,
        absentComment,
      });
      payrollID = hrService.payrollIdFromSetupResponse(resp) || payrollID;
    } catch (err) {
      toast(err.message || 'Could not save payroll setup', 'error');
      setSavingSetup(false);
      return;
    }
    setSavingSetup(false);

    const status =
      existingRec?.status === 'Paid'
        ? 'Paid'
        : (existingRec?.payments?.length ? 'Partially Paid' : 'Generated');
    onSaveSetup({
      month, year,
      payrollID,
      status,
      basicPay: basic,
      bonus: Number(bonus),
      totalGross,
      stdDeductions: stdDeduct,
      loanDeduct:   Number(loanDeduct),
      customLoan:   Number(customLoan),
      fineDeduct:   Number(fineDeduct),
      leaveDeduct:  Number(leaveDeduct),
      absentDeduct: Number(absentDeduct),
      totalDeductions,
      leaveCount:   Number(leaveCount),
      absentCount:  Number(absentCount),
      fineComment, leaveComment, absentComment,
      netPayable,
      payments:     existingRec?.payments || [],
      paidAmount:   (existingRec?.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0),
      paidDate:     existingRec?.paidDate || null,
      loanRecorded: existingRec?.loanRecorded || false,
      generatedAt:  existingRec?.generatedAt  || new Date().toISOString().slice(0, 10),
    });
    toast('Payroll saved — proceed to Make Payment', 'success');
    setTab(1);
  };

  const [payingNow, setPayingNow] = useState(false);
  const makePayment = async () => {
    if (payingNow) return;
    if (!existingRec) { toast('Please save payroll setup first', 'error'); return; }
    if (remaining <= 0.01) { toast('This payroll is already fully paid', 'warning'); return; }
    const amt = Number(payAmount) || 0;
    if (amt <= 0) { toast('Please enter a valid pay amount', 'error'); return; }
    if (amt > remaining + 0.01) {
      toast(`Amount exceeds remaining balance (PKR ${fmtMoney(remaining)})`, 'error');
      return;
    }
    if (!existingRec.payrollID) { toast('Please save payroll setup first', 'error'); return; }

    /* Record the payment on the backend before updating the local record. */
    setPayingNow(true);
    try {
      await hrService.saveHrPayrollPayment({
        payrollID:   existingRec.payrollID,
        amount:      amt,
        comment:     payComment.trim(),
        paymentDate: new Date().toISOString(),
      });
    } catch (err) {
      toast(err.message || 'Could not record payment', 'error');
      setPayingNow(false);
      return;
    }
    setPayingNow(false);

    const today = new Date().toISOString().slice(0, 10);
    const newPayments = [...payments, { amount: amt, date: today, comment: payComment.trim() }];
    const paidAmount  = newPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const newRemaining = recNet - paidAmount;
    const fullyPaid = newRemaining <= 0.01;
    onRecordPayment({
      ...existingRec,
      payments: newPayments,
      paidAmount,
      paidDate: today,
      status: fullyPaid ? 'Paid' : 'Partially Paid',
      loanRecorded: existingRec.loanRecorded || (fullyPaid && (existingRec.loanDeduct > 0 || existingRec.customLoan > 0)),
    });
    if (fullyPaid) {
      toast(`Final payment of PKR ${fmtMoney(amt)} recorded — payroll fully settled`, 'success');
      onClose();
    } else {
      toast(`Partial payment of PKR ${fmtMoney(amt)} recorded — PKR ${fmtMoney(newRemaining)} remaining`, 'success');
      setPayAmount('');
      setPayComment('');
    }
  };

  /* Footer button — switches per tab + supports the fully-settled state. */
  const footerBtn = (() => {
    if (tab === 0) {
      return {
        label: savingSetup ? 'Saving…' : 'Save & Next',
        icon:  savingSetup ? 'fa-spinner fa-spin' : 'fa-floppy-disk',
        onClick: savePRSetup,
        disabled: savingSetup,
      };
    }
    if (isFullyPaid) {
      return {
        label: 'Fully Settled',
        icon:  'fa-circle-check',
        onClick: () => {},
        disabled: true,
      };
    }
    return {
      label: payingNow ? 'Processing…' : (totalPaid > 0 ? 'Record Additional Payment' : 'Make Payment'),
      icon:  payingNow ? 'fa-spinner fa-spin' : 'fa-money-bill-wave',
      onClick: makePayment,
      disabled: payingNow,
    };
  })();

  const num = (n) => fmtMoney(n);

  return createPortal((
    <div
      className="ov open"
      role="dialog" aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal modal-lg" style={{ maxWidth: 1000 }}>
        {/* ─── Head ─── */}
        <div className="modal-head">
          <div className="modal-head-left">
            <div className="modal-head-icon"><i className="fa-solid fa-money-check-dollar" aria-hidden="true"></i></div>
            <div>
              <div className="modal-title">Pay Roll</div>
              <div className="modal-sub">For: {getFullName(emp)} · {month} {year}</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>

        <div className="modal-body">
          <div className="m-tabs">
            <button
              type="button"
              className={`m-tab${tab === 0 ? ' active' : ''}`}
              onClick={() => setTab(0)}
            >
              <i className="fa-solid fa-gear" aria-hidden="true"></i> Pay Roll Setup
            </button>
            <button
              type="button"
              className={`m-tab${tab === 1 ? ' active' : ''}`}
              onClick={() => setTab(1)}
            >
              <i className="fa-solid fa-money-bill-wave" aria-hidden="true"></i> Make Payment
            </button>
          </div>

          {/* ═══════ TAB 0 — PAY ROLL SETUP ═══════ */}
          {tab === 0 && (
            <div className="m-tab-content">
              <div className="pr-section">
                <div className="pr-section-title">
                  <i className="fa-solid fa-coins" aria-hidden="true"></i> Salary Structure (from Employee Master)
                </div>
                <div className="pr-grid">
                  <div className="pr-field">
                    <label>Basic Pay</label>
                    <input type="text" readOnly value={fmtMoney(basic)} />
                  </div>
                  {allowances.map((h, i) => (
                    <div className="pr-field" key={i}>
                      <label>{h.name}</label>
                      <input type="text" readOnly value={fmtMoney(h.amount)} />
                    </div>
                  ))}
                </div>
                <div className="pr-grid g3" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--bl)' }}>
                  <div className="pr-field">
                    <label>Bonus (this month)</label>
                    <input type="number" min={0} value={bonus} onChange={(e) => setBonus(e.target.value)} />
                  </div>
                  <div className="pr-field">
                    <label>Select Month</label>
                    <input type="text" readOnly value={`${month} ${year}`} />
                  </div>
                  <div className="pr-field">
                    <label>Total Gross</label>
                    <input type="text" className="computed" readOnly value={fmtMoney(totalGross)} />
                  </div>
                </div>
              </div>

              <div className="pr-section">
                <div className="pr-section-title">
                  <i className="fa-solid fa-minus-circle" aria-hidden="true"></i> Deductions for the Month
                </div>
                <div className="pr-grid">
                  <div className="pr-field">
                    <label>Remaining Amount in Loan</label>
                    <input type="text" readOnly value={fmtMoney(loanRemaining)} />
                    <div className="pr-field-hint">Outstanding loan balance</div>
                  </div>
                  <div className="pr-field">
                    <label>Loan Deduction this Month</label>
                    <input type="number" min={0} value={loanDeduct} onChange={(e) => setLoanDeduct(e.target.value)} />
                    <div className="pr-field-hint">Scheduled monthly repayment</div>
                  </div>
                  <div className="pr-field">
                    <label>Custom Loan Amount Receiving</label>
                    <input type="number" min={0} value={customLoan} onChange={(e) => setCustomLoan(e.target.value)} />
                    <div className="pr-field-hint">Override scheduled amount</div>
                  </div>
                  <div className="pr-field">
                    <label>Fine Deduction</label>
                    <input type="number" min={0} value={fineDeduct} onChange={(e) => setFineDeduct(e.target.value)} />
                  </div>
                  <div className="pr-field pr-field-full">
                    <label>Fine Comment</label>
                    <input type="text" placeholder="Reason for fine deduction" value={fineComment} onChange={(e) => setFineComment(e.target.value)} />
                  </div>
                  <div className="pr-field pr-field-full" style={{ fontSize: 12, color: 'var(--tm)' }}>
                    {attnCalc.loading ? (
                      <span><i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Calculating leaves &amp; absents for {month} {year}…</span>
                    ) : attnCalc.done && attnCalc.data ? (
                      <span>
                        <i className="fa-solid fa-circle-info" aria-hidden="true"></i>{' '}
                        Leaves YTD: <strong>{attnCalc.data.cumulativeLeavesTakenYTD}</strong>/<strong>{attnCalc.data.annualPaidLeaves}</strong>,
                        already charged: <strong>{attnCalc.data.leavesAlreadyDeductedYTD}</strong>,
                        excess this month: <strong>{attnCalc.data.excessLeavesThisMonth}</strong>,
                        absents this month: <strong>{attnCalc.data.absentCountThisMonth}</strong>.
                        Counts are server-calculated (locked); amounts stay editable.
                      </span>
                    ) : attnCalc.done ? (
                      <span>
                        <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>{' '}
                        Could not auto-calculate leave/absent deduction — enter the amounts manually.
                      </span>
                    ) : null}
                  </div>
                  <div className="pr-field">
                    <label>Number of Leaves this Month</label>
                    <input type="number" min={0} value={leaveCount} disabled title="Auto-calculated from server — locked" />
                  </div>
                  <div className="pr-field">
                    <label>Leave Deduction</label>
                    <input type="number" min={0} value={leaveDeduct} onChange={(e) => setLeaveDeduct(e.target.value)} />
                  </div>
                  <div className="pr-field pr-field-wide">
                    <label>Leave Comment</label>
                    <input type="text" placeholder="Notes about leaves" value={leaveComment} onChange={(e) => setLeaveComment(e.target.value)} />
                  </div>
                  <div className="pr-field">
                    <label>Number of Absents this Month</label>
                    <input type="number" min={0} value={absentCount} disabled title="Auto-calculated from server — locked" />
                  </div>
                  <div className="pr-field">
                    <label>Absent Deduction</label>
                    <input type="number" min={0} value={absentDeduct} onChange={(e) => setAbsentDeduct(e.target.value)} />
                  </div>
                  <div className="pr-field pr-field-wide">
                    <label>Absent Comment</label>
                    <input type="text" placeholder="Notes about absents" value={absentComment} onChange={(e) => setAbsentComment(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="pr-net-card">
                <div>
                  <div className="pr-net-label"><i className="fa-solid fa-wallet" aria-hidden="true"></i> Net Payable</div>
                  <div className="pr-net-amount">PKR <span>{fmtMoney(netPayable)}</span></div>
                </div>
                <div className="pr-net-side">
                  <div className="row"><span>Total Gross</span><strong>PKR <span>{fmtMoney(totalGross)}</span></strong></div>
                  <div className="row"><span>Total Deductions</span><strong>– PKR <span>{fmtMoney(totalDeductions)}</span></strong></div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════ TAB 1 — MAKE PAYMENT ═══════ */}
          {tab === 1 && (
            <div className="m-tab-content">
              <div className="pr-section">
                <div className="pr-section-title">
                  <i className="fa-solid fa-coins" aria-hidden="true"></i> Salary Structure (Read-only)
                </div>
                <div className="pr-grid">
                  <div className="pr-field">
                    <label>Basic Pay</label>
                    <input type="text" readOnly value={fmtMoney(basic)} />
                  </div>
                  {allowances.map((h, i) => (
                    <div className="pr-field" key={`al-${i}`}>
                      <label>{h.name}</label>
                      <input type="text" readOnly value={fmtMoney(h.amount)} />
                    </div>
                  ))}
                  {deductions.map((h, i) => (
                    <div className="pr-field" key={`dd-${i}`}>
                      <label>{h.name} (–)</label>
                      <input type="text" readOnly value={fmtMoney(h.amount)} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="pr-section">
                <div className="pr-section-title">
                  <i className="fa-solid fa-minus-circle" aria-hidden="true"></i> Deductions Applied (Read-only)
                </div>
                <div className="pr-grid">
                  <div className="pr-field"><label>Loan Deduction</label><input type="text" readOnly value={`PKR ${num(existingRec?.loanDeduct || loanDeduct)}`} /></div>
                  <div className="pr-field"><label>Fine Deduction</label><input type="text" readOnly value={`PKR ${num(existingRec?.fineDeduct || fineDeduct)}`} /></div>
                  <div className="pr-field"><label>Leave Deduction</label><input type="text" readOnly value={`PKR ${num(existingRec?.leaveDeduct || leaveDeduct)}`} /></div>
                  <div className="pr-field"><label>Absent Deduction</label><input type="text" readOnly value={`PKR ${num(existingRec?.absentDeduct || absentDeduct)}`} /></div>
                  <div className="pr-field"><label>Custom Loan Amount Deduction</label><input type="text" readOnly value={`PKR ${num(existingRec?.customLoan || customLoan)}`} /></div>
                  <div className="pr-field"><label>Select Month</label><input type="text" readOnly value={`${month} ${year}`} /></div>
                </div>
              </div>

              <div className="pr-section">
                <div className="pr-section-title">
                  <i className="fa-solid fa-money-bill-wave" aria-hidden="true"></i> Payment Settlement
                </div>
                <div className="settle-tiles">
                  <div className="settle-tile net">
                    <div className="lbl"><i className="fa-solid fa-wallet" aria-hidden="true"></i> Net Payable</div>
                    <div className="val">PKR <span>{fmtMoney(recNet)}</span></div>
                  </div>
                  <div className="settle-tile paid">
                    <div className="lbl"><i className="fa-solid fa-circle-check" aria-hidden="true"></i> Paid So Far</div>
                    <div className="val">PKR <span>{fmtMoney(totalPaid)}</span></div>
                  </div>
                  <div className={`settle-tile remaining${isFullyPaid ? ' zero' : ''}`}>
                    <div className="lbl"><i className="fa-solid fa-clock" aria-hidden="true"></i> Remaining</div>
                    <div className="val">PKR <span>{fmtMoney(remaining)}</span></div>
                  </div>
                </div>

                <div className="pr-grid">
                  <div className="pr-field pr-field-wide">
                    <label>Pay Amount Now <span className="req">*</span></label>
                    <input
                      type="number" min={0} step="0.01" placeholder="0"
                      value={payAmount}
                      readOnly={isFullyPaid}
                      onChange={(e) => setPayAmount(e.target.value)}
                    />
                    <div className="pr-field-hint">
                      {isFullyPaid
                        ? (<><i className="fa-solid fa-circle-check" style={{ color: '#16A34A' }} aria-hidden="true"></i> This payroll is fully settled — no further payments needed</>)
                        : totalPaid > 0
                          ? `Previously paid PKR ${fmtMoney(totalPaid)}. You can pay the full remaining PKR ${fmtMoney(remaining)} or a partial amount.`
                          : 'Defaults to full net payable — reduce for partial payment'}
                    </div>
                  </div>
                  <div className="pr-field pr-field-wide">
                    <label>Payment Comment</label>
                    <input
                      type="text"
                      placeholder="e.g. Cheque #5421, advance payment, bank transfer ref…"
                      value={payComment}
                      readOnly={isFullyPaid}
                      onChange={(e) => setPayComment(e.target.value)}
                    />
                    <div className="pr-field-hint">Optional — appears in payment history</div>
                  </div>
                </div>

                <div className="pay-history-box">
                  <div className="pay-history-head">
                    <span><i className="fa-solid fa-receipt" aria-hidden="true"></i> Payment History</span>
                    <span className="count">{payments.length} payment{payments.length === 1 ? '' : 's'}</span>
                  </div>
                  {payments.length === 0 ? (
                    <div className="pay-history-empty">
                      <i className="fa-solid fa-receipt" aria-hidden="true"></i>
                      No payments recorded yet. Make the first payment using the form above.
                    </div>
                  ) : (
                    payments.map((p, i) => (
                      <div className="pay-history-row" key={i}>
                        <div className="seq">{i + 1}</div>
                        <div className="amt"><i className="fa-solid fa-plus-circle" style={{ color: '#16A34A', fontSize: 11 }} aria-hidden="true"></i> PKR {fmtMoney(p.amount)}</div>
                        <div className="cmt">{p.comment || <span style={{ opacity: .6 }}>No comment</span>}</div>
                        <div className="dt"><i className="fa-solid fa-calendar" aria-hidden="true"></i> {fmtDate(p.date) || '—'}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
          <button
            type="button"
            className="btn-primary"
            onClick={footerBtn.onClick}
            disabled={footerBtn.disabled}
            style={footerBtn.disabled ? { opacity: .55, cursor: 'not-allowed' } : undefined}
          >
            <i className={`fa-solid ${footerBtn.icon}`} aria-hidden="true"></i> {footerBtn.label}
          </button>
        </div>
      </div>
    </div>
  ), document.body);
}

/* ═══════════════════════════════════════════════════════════════════
   ADVANCE / LOAN MODAL — 1:1 port of #advLoanOv.
   3 tabs: Set Up New Loan · Loan Repayment · Loan History.
   ═══════════════════════════════════════════════════════════════════ */
function AdvLoanModal({
  emp, loans, activeLoans, totalLoaned, totalReturned,
  totalRemaining, activeCount,
  onClose, onSaveNew, onSaveRepay, onMarkReturned, toast,
}) {
  const [tab, setTab] = useState(0);
  const today = new Date().toISOString().slice(0, 10);

  /* ── Set Up New Loan form ── */
  const [loanAmount,        setLoanAmount]        = useState('');
  const [loanComment,       setLoanComment]       = useState('');
  const [repayType,         setRepayType]         = useState('');
  const [deductDate,        setDeductDate]        = useState(today);
  const [installmentType,   setInstallmentType]   = useState('');
  const [installmentAmount, setInstallmentAmount] = useState('');

  /* ── Loan Repayment form ── */
  const [repayLoanId,  setRepayLoanId]  = useState(activeLoans[0]?.id || '');
  const [repayAmount,  setRepayAmount]  = useState('');
  const [repayDate,    setRepayDate]    = useState(today);
  const [repayComment, setRepayComment] = useState('');

  /* Confirmation for mark-returned */
  const [confLoan, setConfLoan] = useState(null);

  /* Keep selected loan in sync when list changes (e.g. after repayment). */
  useEffect(() => {
    if (!activeLoans.find(l => l.id === repayLoanId)) {
      setRepayLoanId(activeLoans[0]?.id || '');
    }
  }, [activeLoans, repayLoanId]);

  /* Esc + body lock. */
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const resetNewLoanForm = () => {
    setLoanAmount('');
    setLoanComment('');
    setRepayType('');
    setInstallmentType('');
    setInstallmentAmount('');
  };

  const handleSaveNew = () => {
    onSaveNew({
      amount:            Number(loanAmount) || 0,
      comment:           loanComment.trim(),
      repaymentType:     repayType,
      deductDate,
      installmentType,
      installmentAmount: Number(installmentAmount) || 0,
    });
    if (Number(loanAmount) > 0 && repayType
        && (repayType !== 'Installment' || (installmentType && Number(installmentAmount) > 0))) {
      resetNewLoanForm();
    }
  };

  const handleSaveRepay = () => {
    onSaveRepay({
      loanId:  Number(repayLoanId),
      amount:  Number(repayAmount) || 0,
      date:    repayDate,
      comment: repayComment.trim(),
    });
    setRepayAmount('');
    setRepayComment('');
  };

  const installmentDisabled = repayType !== 'Installment';

  return createPortal((
    <div
      className="ov open"
      role="dialog" aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal modal-lg">
        {/* ─── Head ─── */}
        <div className="modal-head">
          <div className="modal-head-left">
            <div className="modal-head-icon"><i className="fa-solid fa-hand-holding-dollar" aria-hidden="true"></i></div>
            <div>
              <div className="modal-title">Advance / Loan</div>
              <div className="modal-sub">For: {getFullName(emp)}</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>

        <div className="modal-body">
          <div className="m-tabs">
            <button
              type="button"
              className={`m-tab${tab === 0 ? ' active' : ''}`}
              onClick={() => setTab(0)}
            >
              <i className="fa-solid fa-plus" aria-hidden="true"></i> Set Up New Loan
            </button>
            <button
              type="button"
              className={`m-tab${tab === 1 ? ' active' : ''}`}
              onClick={() => setTab(1)}
            >
              <i className="fa-solid fa-money-bill-transfer" aria-hidden="true"></i> Loan Repayment
            </button>
            <button
              type="button"
              className={`m-tab${tab === 2 ? ' active' : ''}`}
              onClick={() => setTab(2)}
            >
              <i className="fa-solid fa-clock-rotate-left" aria-hidden="true"></i> Loan History
            </button>
          </div>

          {/* ═══════ TAB 0 — SET UP NEW LOAN ═══════ */}
          {tab === 0 && (
            <div className="m-tab-content">
              <div className="al-summary-card">
                <div className="al-summary-item">
                  <label>Active Loans</label>
                  <div className="val">{activeCount}</div>
                </div>
                <div className="al-summary-item">
                  <label>Total Outstanding</label>
                  <div className="val warn">PKR {fmtMoney(totalRemaining)}</div>
                </div>
                <div className="al-summary-item">
                  <label>Total Returned</label>
                  <div className="val success">PKR {fmtMoney(totalReturned)}</div>
                </div>
              </div>

              <div className="pr-section">
                <div className="pr-section-title">
                  <i className="fa-solid fa-circle-info" aria-hidden="true"></i> Loan Detail
                </div>
                <div className="pr-grid g2">
                  <div className="pr-field">
                    <label>Loan Amount <span className="req">*</span></label>
                    <input
                      type="number"
                      min={0}
                      placeholder="Enter Loan Amount"
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(e.target.value)}
                    />
                  </div>
                  <div className="pr-field">
                    <label>Add Comments</label>
                    <textarea
                      rows={2}
                      placeholder="Enter Comments"
                      value={loanComment}
                      onChange={(e) => setLoanComment(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="pr-section">
                <div className="pr-section-title">
                  <i className="fa-solid fa-calendar-check" aria-hidden="true"></i> Repayment Schedule
                </div>
                <div className="pr-grid">
                  <div className="pr-field">
                    <label>Select Repayment Type <span className="req">*</span></label>
                    <select
                      value={repayType}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRepayType(v);
                        if (v !== 'Installment') {
                          setInstallmentType('');
                          setInstallmentAmount('');
                        }
                      }}
                    >
                      <option value="">Select here</option>
                      <option value="OneTime">One Time</option>
                      <option value="Installment">Installment</option>
                    </select>
                  </div>
                  <div className="pr-field">
                    <label>Will be Deducted / Repaid on</label>
                    <input
                      type="date"
                      value={deductDate}
                      onChange={(e) => setDeductDate(e.target.value)}
                    />
                  </div>
                  <div className="pr-field">
                    <label>Installment Type</label>
                    <select
                      value={installmentType}
                      disabled={installmentDisabled}
                      onChange={(e) => setInstallmentType(e.target.value)}
                    >
                      <option value="">Select here</option>
                      <option value="None">None</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="BiAnnually">BiAnnually</option>
                      <option value="Annually">Annually</option>
                    </select>
                  </div>
                  <div className="pr-field">
                    <label>Installment Amount</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="0.00"
                      disabled={installmentDisabled}
                      value={installmentAmount}
                      onChange={(e) => setInstallmentAmount(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════ TAB 1 — LOAN REPAYMENT ═══════ */}
          {tab === 1 && (
            <div className="m-tab-content">
              {activeLoans.length === 0 ? (
                <div
                  className="al-summary-card"
                  style={{ gridTemplateColumns: '1fr', textAlign: 'center', padding: 30 }}
                >
                  <div style={{ color: 'var(--tm)', fontSize: 13 }}>
                    <i
                      className="fa-solid fa-circle-info"
                      style={{ fontSize: 24, color: 'var(--brand)', display: 'block', marginBottom: 8 }}
                      aria-hidden="true"
                    ></i>
                    No active loans to repay. Set up a new loan first.
                  </div>
                </div>
              ) : (
                <div className="pr-section">
                  <div className="pr-section-title">
                    <i className="fa-solid fa-money-bill-transfer" aria-hidden="true"></i> Record Loan Repayment
                  </div>
                  <div className="pr-grid">
                    <div className="pr-field">
                      <label>Select Loan <span className="req">*</span></label>
                      <select
                        value={repayLoanId}
                        onChange={(e) => setRepayLoanId(e.target.value)}
                      >
                        {activeLoans.map(l => (
                          <option key={l.id} value={l.id}>
                            Loan #{l.loanNumber} – Amount {fmtMoney(l.amount)} (Remaining {fmtMoney(l.remaining)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="pr-field">
                      <label>Received Amount <span className="req">*</span></label>
                      <input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={repayAmount}
                        onChange={(e) => setRepayAmount(e.target.value)}
                      />
                    </div>
                    <div className="pr-field">
                      <label>Received Date <span className="req">*</span></label>
                      <input
                        type="date"
                        value={repayDate}
                        onChange={(e) => setRepayDate(e.target.value)}
                      />
                    </div>
                    <div className="pr-field">
                      <label>Add Comments</label>
                      <input
                        type="text"
                        placeholder="Enter Comments"
                        value={repayComment}
                        onChange={(e) => setRepayComment(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════ TAB 2 — LOAN HISTORY ═══════ */}
          {tab === 2 && (
            <div className="m-tab-content">
              {loans.length === 0 ? (
                <div
                  className="al-summary-card"
                  style={{ gridTemplateColumns: '1fr', textAlign: 'center', padding: 30 }}
                >
                  <div style={{ color: 'var(--tm)', fontSize: 13 }}>
                    <i
                      className="fa-solid fa-clock-rotate-left"
                      style={{ fontSize: 24, color: 'var(--brand)', display: 'block', marginBottom: 8 }}
                      aria-hidden="true"
                    ></i>
                    No loan history yet. Set up a new loan to get started.
                  </div>
                </div>
              ) : (
                loans.map(l => (
                  <div key={l.id} className={`loan-card ${l.status}`}>
                    <div className="loan-card-head">
                      <div className="loan-card-title">
                        <i className="fa-solid fa-hand-holding-dollar" aria-hidden="true"></i> Loan #{l.loanNumber}
                      </div>
                      <span className={`loan-card-status ${l.status}`}>
                        {l.status === 'active' ? 'Active' : 'Returned'}
                      </span>
                    </div>
                    <div className="loan-card-comment">
                      <i
                        className="fa-solid fa-quote-left"
                        style={{ fontSize: 9, marginRight: 5, opacity: .5 }}
                        aria-hidden="true"
                      ></i>
                      {l.comment}
                    </div>
                    <div className="loan-card-body" style={{ marginTop: 10 }}>
                      <div className="loan-card-field">
                        <label>Total Amount</label>
                        <div className="val amount">PKR {fmtMoney(l.amount)}</div>
                      </div>
                      <div className="loan-card-field">
                        <label>Remaining</label>
                        <div className={`val ${l.remaining > 0 ? 'remaining' : ''}`}>
                          PKR {fmtMoney(l.remaining)}
                        </div>
                      </div>
                      <div className="loan-card-field">
                        <label>Repayment Type</label>
                        <div className="val">
                          {l.repaymentType}{l.installmentType ? ` (${l.installmentType})` : ''}
                        </div>
                      </div>
                      <div className="loan-card-field">
                        <label>Installment</label>
                        <div className="val">
                          {l.repaymentType === 'Installment' ? `PKR ${fmtMoney(l.installmentAmount)}` : '—'}
                        </div>
                      </div>
                    </div>

                    {(l.received || []).length > 0 && (
                      <div className="loan-repayments">
                        <div className="loan-repayments-title">
                          <i className="fa-solid fa-receipt" aria-hidden="true"></i> Repayments History ({l.received.length})
                        </div>
                        {l.received.map((r, i) => (
                          <div key={i} className="repayment-row">
                            <span className="amt">+ PKR {fmtMoney(r.amount)}</span>
                            <span className="cmt">{r.comment || 'No comment'}</span>
                            <span className="dt">{fmtDate(r.date)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {l.status === 'active' && (
                      <div style={{
                        display: 'flex', justifyContent: 'flex-end', gap: 8,
                        marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--bl)',
                      }}>
                        <button
                          type="button"
                          className="btn-sm"
                          style={{ borderColor: 'var(--success)', color: 'var(--success)' }}
                          onClick={() => setConfLoan(l)}
                        >
                          <i className="fa-solid fa-check-circle" aria-hidden="true"></i> Mark Loan Returned
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ─── Foot ─── */}
        <div className="modal-foot">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          {tab === 0 && (
            <button type="button" className="btn-primary" onClick={handleSaveNew}>
              <i className="fa-solid fa-floppy-disk" aria-hidden="true"></i> Save
            </button>
          )}
          {tab === 1 && activeLoans.length > 0 && (
            <button type="button" className="btn-primary" onClick={handleSaveRepay}>
              <i className="fa-solid fa-money-bill-transfer" aria-hidden="true"></i> Loan Repayment
            </button>
          )}
        </div>
      </div>

      {confLoan && (
        <ConfirmDialog
          cfg={{
            title:        'Mark Loan as Returned',
            message:      `Mark <strong>Loan #${confLoan.loanNumber}</strong> (PKR ${fmtMoney(confLoan.amount)}) as fully returned?`,
            hint:         `Remaining balance of PKR ${fmtMoney(confLoan.remaining)} will be marked settled.`,
            confirmLabel: 'Yes, Mark Returned',
            confirmStyle: 'primary',
            icon:         'fa-circle-check',
            iconBg:       'rgba(22,163,74,.1)',
            iconColor:    '#16A34A',
            onConfirm:    () => onMarkReturned(confLoan.id),
          }}
          onClose={() => setConfLoan(null)}
        />
      )}
    </div>
  ), document.body);
}

/* ═══════════════════════════════════════════════════════════════════
   REPORTS STYLE PICKER — 1:1 port of #rspOv.
   Pops up from the Reports button → Salary Slip / Pay History Ledger /
   Loan / Advance Report. Lets the user pick a date / month range and a
   print style (Colorful or B&W), then opens the generated report in a
   new window for print / save-as-PDF.
   ═══════════════════════════════════════════════════════════════════ */
const RSP_META = {
  salaryslip: { title: 'Salary Slip',           sub: 'Monthly payslip',                       icon: 'fa-file-invoice-dollar', iconBg: 'rgba(30,58,138,.12)',  iconColor: '#1E3A8A', range: 'single' },
  history:    { title: 'Pay History Ledger',    sub: 'Detailed history with date range',      icon: 'fa-clock-rotate-left',   iconBg: 'rgba(124,58,237,.12)', iconColor: '#7C3AED', range: 'period' },
  loan:       { title: 'Loan / Advance Report', sub: 'Full loan account with transactions',   icon: 'fa-hand-holding-dollar', iconBg: 'rgba(22,163,74,.12)',  iconColor: '#16A34A', range: false    },
};

function RspModal({ emp, type, month, year, onClose, onGenerate }) {
  const meta = RSP_META[type] || RSP_META.salaryslip;

  /* Pre-fill the single month picker with the Financials filter month. */
  const monthIdx = PAY_MONTHS.indexOf(month) + 1;
  const seedMonthKey = `${year}-${String(monthIdx || 1).padStart(2, '0')}`;
  const [rspMonth, setRspMonth] = useState(seedMonthKey);
  const [rspFrom,  setRspFrom]  = useState('2026-01');
  const [rspTo,    setRspTo]    = useState('2026-06');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handlePick = (style) => {
    if (meta.range === 'single')      onGenerate(style, { monthKey: rspMonth });
    else if (meta.range === 'period') onGenerate(style, { fromKey: rspFrom, toKey: rspTo });
    else                              onGenerate(style, {});
  };

  return createPortal((
    <div
      className="ov open"
      role="dialog" aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-head">
          <div className="modal-head-left">
            <div
              className="modal-head-icon"
              style={{ background: meta.iconBg, color: meta.iconColor }}
            >
              <i className={`fa-solid ${meta.icon}`} aria-hidden="true"></i>
            </div>
            <div>
              <div className="modal-title">{meta.title}</div>
              <div className="modal-sub">For: {getFullName(emp)} · {emp.eid}</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>

        <div className="modal-body">
          {meta.range === 'period' && (
            <div className="rsp-range-row">
              <div className="rsp-field">
                <label><i className="fa-solid fa-calendar-day" aria-hidden="true"></i> From Month</label>
                <input type="month" value={rspFrom} onChange={(e) => setRspFrom(e.target.value)} />
              </div>
              <div className="rsp-field">
                <label><i className="fa-solid fa-calendar-day" aria-hidden="true"></i> To Month</label>
                <input type="month" value={rspTo} onChange={(e) => setRspTo(e.target.value)} />
              </div>
            </div>
          )}
          {meta.range === 'single' && (
            <div className="rsp-range-row" style={{ gridTemplateColumns: '1fr' }}>
              <div className="rsp-field">
                <label><i className="fa-solid fa-calendar-check" aria-hidden="true"></i> Salary Month</label>
                <input type="month" value={rspMonth} onChange={(e) => setRspMonth(e.target.value)} />
              </div>
            </div>
          )}

          <div style={{ fontSize: 12, color: 'var(--tm)', marginBottom: 6, lineHeight: 1.5 }}>
            Select one of the two report styles below. Both versions are A4-formatted and ready to print or save as PDF.
          </div>

          <div className="style-pick-grid">
            <div className="style-pick-card" onClick={() => handlePick('color')}>
              <span className="style-pick-tag">Recommended</span>
              <div className="style-pick-preview color">
                <div className="ppl-head"><i className="fa-solid fa-building" aria-hidden="true"></i> SCHOOL MENTOR</div>
                <div className="ppl-row mid"></div>
                <div className="ppl-row short"></div>
                <div className="ppl-tile">PKR 50,000</div>
                <div className="ppl-pill"></div>
              </div>
              <div className="style-pick-info">
                <div className="style-pick-title"><i className="fa-solid fa-palette" aria-hidden="true"></i> Colorful</div>
                <div className="style-pick-desc">ERP theme colors, professional header, color-coded badges and highlights.</div>
              </div>
            </div>
            <div className="style-pick-card bw-card" onClick={() => handlePick('bw')}>
              <span className="style-pick-tag">Low Ink</span>
              <div className="style-pick-preview bw">
                <div className="ppl-head"><i className="fa-solid fa-building" aria-hidden="true"></i> SCHOOL MENTOR</div>
                <div className="ppl-row mid"></div>
                <div className="ppl-row short"></div>
                <div className="ppl-tile">PKR 50,000</div>
                <div className="ppl-pill"></div>
              </div>
              <div className="style-pick-info">
                <div className="style-pick-title"><i className="fa-solid fa-print" aria-hidden="true"></i> Colorless / B&amp;W</div>
                <div className="style-pick-desc">White background, black/gray text, light borders only — saves ink on printing.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  ), document.body);
}

/* ═══════════════════════════════════════════════════════════════════
   EMPLOYEE MANAGEMENT — main screens (Active + Inactive sub-tabs).
   1:1 port of the matching section in "Human Resource .html".

   Includes:
     • Two sub-tabs with live counts
     • UX info banner
     • Filter bar: search · All Departments · All Designations · Add Employee
     • 9-col emp-t-head + emp-row table with avatar / name+EID / dept badge /
       designation badge / phone / 5-chip summary
     • 3-dots More Actions button (open/close only — modal stub for later)
     • Expand chevron (open/close only — panel content stub for later)

   Internal popups (Add Employee, 3-dots actions, details panel content)
   are intentionally NOT implemented in this sprint — the chevron expands
   to a placeholder, the 3-dots button opens an empty dropdown placeholder,
   and Add Employee toasts a "coming soon" message.
   ═══════════════════════════════════════════════════════════════════ */
function EmployeeManagement({ emps, setEmps, depts, desigs, nextEmpId, setNextEmpId, toast }) {
  const [sub, setSub] = useState('active');
  const [q,   setQ]   = useState('');
  const [fDept,  setFDept]  = useState('');
  const [fDesig, setFDesig] = useState('');
  const [openEmpId, setOpenEmpId] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [addOpen,  setAddOpen]  = useState(false);
  const [editFor,  setEditFor]  = useState(null);   // emp to edit
  const [inactFor, setInactFor] = useState(null);   // emp to mark inactive
  const [idcFor,   setIdcFor]   = useState(null);   // emp for ID card
  const [letterFor, setLetterFor] = useState(null); // emp for Issue Letter
  const [profileFor, setProfileFor] = useState(null); // emp for Profile Report

  /* Pull the fresh staff list back from the API so newly-saved salary amounts
     and custom-head ids (needed for later edits/deletes) are reflected. */
  const reloadEmps = async () => {
    try { setEmps(await hrService.getHrEmployees()); }
    catch (e) { /* keep the current list if the reload fails */ }
  };

  const saveNewEmployee = async (payload) => {
    try {
      await hrService.saveHrEmployee(payload);
      await reloadEmps();
      setSub((payload.status || 'Active') === 'Active' ? 'active' : 'inactive');
      toast(`${getFullName(payload)} added`, 'success');
      setAddOpen(false);
    } catch (err) {
      toast(err.message || 'Could not add employee', 'error');
    }
  };

  const saveEditedEmployee = async (payload) => {
    try {
      await hrService.saveHrEmployee(payload);
      await reloadEmps();
      toast(`${getFullName(payload)} updated`, 'success');
      setEditFor(null);
    } catch (err) {
      toast(err.message || 'Could not update employee', 'error');
    }
  };

const confirmMarkInactive = async (payload) => {
  const id = payload.id;
  try {
    await hrService.deleteHrEmployee({ id });
    setEmps(prev => (prev || []).map(e => e.id === id ? {
      ...e,
      status: 'Inactive',
      inactiveReason: payload.reason,
      inactiveDate:   payload.date,
      inactiveNotes:  payload.notes,
    } : e));
    setInactFor(null);
    setSub('inactive');
    toast(`${payload.name} marked Inactive`, 'success');
  } catch (err) {
    toast(err.message || 'Could not mark employee inactive', 'error');
  }
};
const markActiveAgain = async (emp) => {
  try {
    await hrService.restoreHrEmployee({ id: emp.id });
    setEmps(prev => (prev || []).map(e => e.id === emp.id ? {
      ...e,
      status: 'Active',
      inactiveReason: undefined,
      inactiveDate:   undefined,
      inactiveNotes:  undefined,
    } : e));
    setSub('active');
    toast(`${getFullName(emp)} marked Active again`, 'success');
  } catch (err) {
    toast(err.message || 'Could not mark employee active', 'error');
  }
};
  const recordLetterIssued = (empId, letter) => {
    setEmps(prev => (prev || []).map(e => e.id === empId ? {
      ...e,
      letters: [...(e.letters || []), letter],
    } : e));
    toast(`${letter.label} issued`, 'success');
  };

  /* Sub-tab counts — based on ALL employees, not the filtered slice. */
  const activeCount   = useMemo(() => emps.filter(e => e.status === 'Active').length, [emps]);
  const inactiveCount = useMemo(() => emps.filter(e => e.status !== 'Active').length, [emps]);

  /* Filtered list */
  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const fd = Number(fDept)  || 0;
    const fds = Number(fDesig) || 0;
    return emps.filter(e => {
      const isInactive = e.status !== 'Active';
      if (sub === 'inactive' && !isInactive) return false;
      if (sub === 'active'   &&  isInactive) return false;
      if (fd && Number(e.dId) !== fd) return false;
      if (fds && Number(e.desId) !== fds) return false;
      if (qq) {
        const hay = `${getFullName(e)} ${e.eid || ''} ${e.cnic || ''} ${e.phone || ''}`.toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
  }, [emps, sub, q, fDept, fDesig]);

  /* Lookup maps for the department + designation badges. */
  const deptMap  = useMemo(() => new Map(depts.map(d => [d.id, d])),  [depts]);
  const desigMap = useMemo(() => new Map(desigs.map(d => [d.id, d])), [desigs]);
  const getDeptName  = (id) => deptMap.get(id)?.name  || '—';
  const getDesigName = (id) => desigMap.get(id)?.name || '—';

  /* Close 3-dots dropdown on outside click. */
  useEffect(() => {
    if (menuOpenId == null) return undefined;
    const onDown = (e) => {
      if (!e.target.closest?.('.menu-wrap')) setMenuOpenId(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpenId]);

  /* Reset open expand when sub-tab or filters change so collapsed rows
     don't survive into the next view. */
  useEffect(() => { setOpenEmpId(null); setMenuOpenId(null); }, [sub, q, fDept, fDesig]);

  return (
    <div className="hrb-root">
      <div className="section-card">
        {/* ─── Sub-tabs ─── */}
        <div className="emp-subtabs">
          <Tooltip text="View employees currently working at the school">
            <button
              type="button"
              className={`emp-subtab${sub === 'active' ? ' active' : ''}`}
              onClick={() => setSub('active')}
            >
              <i className="fa-solid fa-user-check" aria-hidden="true"></i> Active Employees
              <span className="emp-subtab-count">{activeCount}</span>
            </button>
          </Tooltip>
          <Tooltip text="View resigned, terminated or retired employees">
            <button
              type="button"
              className={`emp-subtab${sub === 'inactive' ? ' active' : ''}`}
              onClick={() => setSub('inactive')}
            >
              <i className="fa-solid fa-user-slash" aria-hidden="true"></i> Inactive Employees
              <span className="emp-subtab-count">{inactiveCount}</span>
            </button>
          </Tooltip>
        </div>

        {/* ─── UX info banner (compact) ─── */}
        <div className="ux-info-banner compact">
          <div className="ux-info-icon"><i className="fa-solid fa-lightbulb" aria-hidden="true"></i></div>
          <div className="ux-info-body">
            <div className="ux-info-row">
              Use the <strong>3-dots menu</strong> on each employee row to edit details, download profile, issue letters, assign tasks, or mark inactive. Click the chevron (▾) to expand and view the full employee panel.
            </div>
          </div>
        </div>

        {/* ─── Filter bar ─── */}
        <div className="filter-bar">
          <div className="emp-search-wrap">
            <div className="emp-search">
              <i className="fa-solid fa-magnifying-glass emp-search-icn" aria-hidden="true"></i>
              <input
                type="text"
                autoComplete="off"
                placeholder="Search employee, ID, CNIC, phone, department or designation…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q && (
                <Tooltip text="Clear search">
                  <button
                    type="button"
                    className="emp-search-clear"
                    onClick={() => setQ('')}
                    aria-label="Clear search"
                  >
                    <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
          <Tooltip text="Filter employees by department">
            <select
              className="f-select"
              value={fDept}
              onChange={(e) => setFDept(e.target.value)}
            >
              <option value="">All Departments</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Tooltip>
          <Tooltip text="Filter employees by designation">
            <select
              className="f-select"
              value={fDesig}
              onChange={(e) => setFDesig(e.target.value)}
            >
              <option value="">All Designations</option>
              {desigs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Tooltip>
          <Tooltip text="Add a new employee with full personal, official and salary details">
            <button
              type="button"
              className="btn-add"
              style={{ marginLeft: 'auto' }}
              onClick={() => setAddOpen(true)}
            >
              <i className="fa-solid fa-user-plus" aria-hidden="true"></i> Add Employee
            </button>
          </Tooltip>
        </div>

        {/* ─── Table head ─── */}
        <div className="t-head emp-t-head">
          <div className="th">S.No</div>
          <div className="th">Photo</div>
          <div className="th">Name / ID</div>
          <div className="th">Department</div>
          <div className="th">Designation</div>
          <div className="th">Contact</div>
          <div className="th">Summary</div>
          <div className="th" style={{ textAlign: 'right', justifySelf: 'end' }}>Actions</div>
          <div className="th" style={{ textAlign: 'center' }}>▾</div>
        </div>

        {/* ─── Employee rows / empty state ─── */}
        {list.length === 0 ? (
          <EmptyState
            icon={sub === 'inactive' ? 'fa-user-slash' : 'fa-users'}
            title={sub === 'inactive' ? 'No Inactive Employees' : 'No Active Employees Found'}
            sub={sub === 'inactive'
              ? 'No employees have been marked inactive yet.'
              : (q || fDept || fDesig ? 'Try clearing filters or your search.' : 'Add your first employee using the button above.')}
          />
        ) : (
          <div>
            {list.map((e, i) => (
         <EmployeeRow
  key={e.id}
  idx={i + 1}
  emp={e}
  depts={depts}
  desigs={desigs}
  deptName={getDeptName(e.dId)}
  desigName={getDesigName(e.desId)}
  isOpen={openEmpId === e.id}
  onToggleOpen={() => setOpenEmpId(prev => prev === e.id ? null : e.id)}
  menuOpen={menuOpenId === e.id}
  onToggleMenu={() => setMenuOpenId(prev => prev === e.id ? null : e.id)}
  onCloseMenu={() => setMenuOpenId(null)}
  onEdit={()      => { setMenuOpenId(null); setEditFor(e); }}
  onProfile={()   => { setMenuOpenId(null); setProfileFor(e); }}
  onIdCard={()    => { setMenuOpenId(null); setIdcFor(e); }}
  onLetter={()    => { setMenuOpenId(null); setLetterFor(e); }}
  onInactive={()  => { setMenuOpenId(null); setInactFor(e); }}
  onRestore={()   => { setMenuOpenId(null); markActiveAgain(e); }}
  toast={toast}
/>
            ))}
          </div>
        )}
      </div>

      {addOpen && (
        <AddEmployeeModal
          mode="add"
          depts={depts}
          desigs={desigs}
          nextEmpId={nextEmpId}
          onClose={() => setAddOpen(false)}
          onSave={saveNewEmployee}
          toast={toast}
        />
      )}
      {editFor && (
        <AddEmployeeModal
          mode="edit"
          emp={editFor}
          depts={depts}
          desigs={desigs}
          nextEmpId={nextEmpId}
          onClose={() => setEditFor(null)}
          onSave={saveEditedEmployee}
          toast={toast}
        />
      )}
      {inactFor && (
        <MarkInactiveModal
          emp={inactFor}
          onClose={() => setInactFor(null)}
          onConfirm={confirmMarkInactive}
          toast={toast}
        />
      )}
      {idcFor && (
        <StaffIdCardModal
          emp={idcFor}
          deptName={getDeptName(idcFor.dId)}
          desigName={getDesigName(idcFor.desId)}
          onClose={() => setIdcFor(null)}
        />
      )}
      {letterFor && (
        <LetterModal
          emp={letterFor}
          deptName={getDeptName(letterFor.dId)}
          desigName={getDesigName(letterFor.desId)}
          onClose={() => setLetterFor(null)}
          onIssue={(letter) => recordLetterIssued(letterFor.id, letter)}
          toast={toast}
        />
      )}
      {profileFor && (
        <ProfileReportModal
          emp={profileFor}
          deptName={getDeptName(profileFor.dId)}
          desigName={getDesigName(profileFor.desId)}
          onClose={() => setProfileFor(null)}
        />
      )}
    </div>
  );
}

/* ─── getFullName helper used by the search + row ─── */
function getFullName(e) {
  return `${e.firstName || e.name || ''}${e.lastName ? ' ' + e.lastName : ''}`.trim() || '—';
}

/* ═══════════════════════════════════════════════════════════════════
   EMPLOYEE ROW — 9-col grid with the 5-chip summary on the right.
   Expanding the chevron / opening the 3-dots is wired but their
   internal content is intentionally left as a placeholder so that
   this sprint only ships the main screens.
   ═══════════════════════════════════════════════════════════════════ */
function EmployeeRow({
  idx, emp, depts, desigs, deptName, desigName,
  isOpen, onToggleOpen,
  menuOpen, onToggleMenu, onCloseMenu,
  onEdit, onProfile, onIdCard, onLetter, onInactive, onRestore,
  toast,
}) {
  const nm  = getFullName(emp);
  const ini = nm.split(' ').filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 2) || '?';
  const isInactive = emp.status !== 'Active';

  const taskCount   = (emp.tasks   || []).length;
  const letterCount = (emp.letters || []).length;
  const docCount    = Object.keys(emp.stdDocs || {}).length + (emp.docs || []).length;
  const subjCount   = Object.values(emp.subjects || {}).reduce((s, arr) => s + (arr?.length || 0), 0);
  const attCount    = (emp.attendance || []).length;

  const stubAction = (label) => {
    onCloseMenu();
    toast(`${label} — coming in the next sprint`, 'info');
  };
  void stubAction; // currently only used by Inactive-mode "Mark Active Again" / "Delete" until those sprints ship

  return (
    <div className="row-wrap">
      <div className={`emp-row${isOpen ? ' open' : ''}`}>
        <div className="td td-num">{idx}</div>
        <div className="td">
          <div className="emp-avatar">
            {emp.photo ? <img src={emp.photo} alt="" /> : ini}
          </div>
        </div>
        <div className="td emp-name-cell">
          <span className="emp-row-name">{nm}</span>
          <span className="emp-row-eid">{emp.eid}</span>
        </div>
        <div className="td">
          <span className="badge b-blue emp-cell-badge">{deptName}</span>
        </div>
        <div className="td">
          <span className="badge b-gray emp-cell-badge">{desigName}</span>
        </div>
        <div className="td emp-phone-cell">{emp.phone || '—'}</div>
        <div className="td">
          <div className="emp-chips">
            <Tooltip text={`Tasks Assigned: ${taskCount}`}>
              <span className={`emp-chip is-task${taskCount ? '' : ' zero'}`}>
                <i className="fa-solid fa-list-check" aria-hidden="true"></i>
                <span>{taskCount}</span>
              </span>
            </Tooltip>
            <Tooltip text={`Letters Issued: ${letterCount}`}>
              <span className={`emp-chip is-letter${letterCount ? '' : ' zero'}`}>
                <i className="fa-solid fa-envelope" aria-hidden="true"></i>
                <span>{letterCount}</span>
              </span>
            </Tooltip>
            <Tooltip text={`Documents Uploaded: ${docCount}`}>
              <span className={`emp-chip is-doc${docCount ? '' : ' zero'}`}>
                <i className="fa-solid fa-file-lines" aria-hidden="true"></i>
                <span>{docCount}</span>
              </span>
            </Tooltip>
            <Tooltip text={`Subjects Assigned: ${subjCount}`}>
              <span className={`emp-chip is-subj${subjCount ? '' : ' zero'}`}>
                <i className="fa-solid fa-book" aria-hidden="true"></i>
                <span>{subjCount}</span>
              </span>
            </Tooltip>
            <Tooltip text={`Attendance Classes: ${attCount}`}>
              <span className={`emp-chip is-att${attCount ? '' : ' zero'}`}>
                <i className="fa-solid fa-calendar-check" aria-hidden="true"></i>
                <span>{attCount}</span>
              </span>
            </Tooltip>
          </div>
        </div>
        <div className="td emp-actions-cell">
          <div className="menu-wrap">
            <Tooltip text="More Actions">
              <button
                type="button"
                className="btn-dots"
                onClick={onToggleMenu}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={`More actions for ${nm}`}
              >
                <i className="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
              </button>
            </Tooltip>
            {menuOpen && (
              <div className="drop-menu" role="menu">
                {isInactive ? (
                  <>
                    <button type="button" className="drop-item" onClick={() => stubAction('Download Profile Report')}>
                      <i className="fa-solid fa-download" aria-hidden="true"></i> Download Profile Report
                    </button>
                    <button type="button" className="drop-item" onClick={() => stubAction('Issue Letter')}>
                      <i className="fa-solid fa-envelope-open-text" aria-hidden="true"></i> Issue Letter
                    </button>
                  <button type="button" className="drop-item" style={{ color: '#16A34A' }} onClick={onRestore}>
  <i className="fa-solid fa-user-check" aria-hidden="true"></i> Mark Active Again
</button>
                    <button type="button" className="drop-item red" onClick={() => stubAction('Delete Employee')}>
                      <i className="fa-solid fa-trash" aria-hidden="true"></i> Delete Employee
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="drop-item" onClick={onEdit}>
                      <i className="fa-solid fa-pen" aria-hidden="true"></i> Edit Employee
                    </button>
                    <button type="button" className="drop-item" onClick={onProfile}>
                      <i className="fa-solid fa-download" aria-hidden="true"></i> Download Profile Report
                    </button>
                    <button type="button" className="drop-item" onClick={onIdCard}>
                      <i className="fa-solid fa-id-card" aria-hidden="true"></i> Generate Staff ID Card
                    </button>
                    <button type="button" className="drop-item" onClick={onLetter}>
                      <i className="fa-solid fa-envelope-open-text" aria-hidden="true"></i> Issue Letter
                    </button>
                    <button type="button" className="drop-item red" onClick={onInactive}>
                      <i className="fa-solid fa-user-slash" aria-hidden="true"></i> Mark Inactive
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="td emp-chev-cell">
          <Tooltip text="Expand to view employee details">
            <button
              type="button"
              className={`btn-expand${isOpen ? ' open' : ''}`}
              onClick={onToggleOpen}
              aria-label={isOpen ? `Collapse ${nm}` : `Expand ${nm}`}
              aria-expanded={isOpen}
            >
              <i className="fa-solid fa-chevron-down" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>
      </div>

      <div className={`emp-panel${isOpen ? ' open' : ''}`}>
        <div className="emp-panel-inner">
          {isOpen && (
            <EmployeeDetailPanel
              emp={emp}
              deptName={deptName}
              desigName={desigName}
            />
          )}
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   ADD NEW EMPLOYEE MODAL — 1:1 port of the 6-tab modal from the HTML
   reference (#empOv).
     0. Personal Information
     1. Official Details
     2. Salary Details
     3. Leave Details
     4. Documents
     5. Assignments  (sub-tabs: Subject Assignment / Class Attendance)
   ═══════════════════════════════════════════════════════════════════ */

const HR_CLASS_LIST = [
  { id: 1, name: 'class 1A', sections: [
    { id: 11, name: 'B' }, { id: 12, name: 'C' }, { id: 13, name: 'D' },
    { id: 14, name: 'Green f' }, { id: 15, name: 'New' },
  ]},
  { id: 2, name: 'II-Pre',  sections: [{ id: 21, name: 'A' }] },
  { id: 3, name: 'III-Pre', sections: [{ id: 31, name: '2' }] },
  { id: 4, name: 'I',       sections: [{ id: 41, name: 'Green' }, { id: 42, name: 'White' }] },
  { id: 5, name: 'II',      sections: [{ id: 51, name: 'A' }, { id: 52, name: 'B' }] },
  { id: 6, name: 'III',     sections: [{ id: 61, name: 'A' }] },
  { id: 7, name: 'IV',      sections: [{ id: 71, name: 'A' }] },
];

const HR_SUBJECT_LIST = [
  { id: 1, name: 'Mathematics' }, { id: 2, name: 'Science' },
  { id: 3, name: 'Social Studies' }, { id: 4, name: 'Urdu' },
  { id: 5, name: 'Nazra' }, { id: 6, name: 'Computer' },
  { id: 7, name: 'Coding' }, { id: 8, name: 'Islamiat' },
  { id: 9, name: 'English' },
];

/* Fixed employee document slots — key matches hrService.HR_EMP_DOC_TYPES;
   `type` is the backend documentType sent on upload. */
const HR_DOC_SLOTS = [
  { key: 'cnic',       type: 'CNIC',             icon: 'fa-id-card',        label: 'CNIC' },
  { key: 'degree',     type: 'Degree',           icon: 'fa-graduation-cap', label: 'Degree / Certificate' },
  { key: 'experience', type: 'ExperienceLetter', icon: 'fa-briefcase',      label: 'Experience Letter' },
  { key: 'contract',   type: 'Contract',         icon: 'fa-file-signature', label: 'Contract' },
  { key: 'resume',     type: 'Resume',           icon: 'fa-file-lines',     label: 'Resume / CV' },
];

/* The three allowances are fixed employee columns on the backend, so they are
   always present and non-removable. Extra heads are added by the user and live
   on the /api/HR/*-salary-head endpoints. */
function hrDefaultSalaryHeads() {
  return [
    { name: 'Medical Allowance',   amount: 0, type: 'allow', fixed: true },
    { name: 'Rent Allowance',      amount: 0, type: 'allow', fixed: true },
    { name: 'Transport Allowance', amount: 0, type: 'allow', fixed: true },
  ];
}

function AddEmployeeModal({ mode = 'add', emp, depts, desigs, nextEmpId, onClose, onSave, toast }) {
  const isEdit = mode === 'edit';
  const photoRef = useRef(null);
  const [tab, setTab]             = useState(0);
  const [assignTab, setAssignTab] = useState(0);
  const [saving, setSaving]       = useState(false);          // true while the save APIs run
  const [removedHeadIds, setRemovedHeadIds] = useState([]);   // custom heads to delete on save

  /* ── Seeded form state — Add mode mirrors openAddEmp(); Edit mode
     pre-fills every field from the emp record. ── */
  const todayIso = new Date().toISOString().slice(0, 10);
  const blank = {
    firstName: '', lastName: '', fn: '',
    cnic: '', dob: '', gender: 'Male', marital: 'Single',
    phone: '', email: '', blood: 'A+', emergency: '',
    nationality: 'Pakistani', address: '',
    eid: `EMP-${String(nextEmpId || 7).padStart(3, '0')}`,
    join: todayIso,
    status: 'Active', type: 'Permanent',
    dId: '', desId: '',
    manager: '', qual: '', exp: '', shift: '',
    country: 'Pakistan', province: '', city: '',
    countryID: '', provinceID: '', cityID: '', qualificationID: '',
    role: '',
    basicSalary: '', payMethod: 'Bank Transfer',
    bankName: '', bankAcc: '',
    salaryHeads: hrDefaultSalaryHeads(),
    leaves: {
      annual: '', casual: '', sick: '', maternity: '',
      balance: '', policy: 'Standard',
      deductEn: true, absentDed: '', unpaidDed: '',
    },
    stdDocs: {},
    docs: [],
    photo: '',
    subjects:   {},
    attendance: [],
  };
  const [form, setForm] = useState(() => {
    if (!isEdit || !emp) return blank;
    return {
      ...blank,
      ...emp,
      leaves: { ...blank.leaves, ...(emp.leaves || {}) },
      salaryHeads: emp.salaryHeads ? emp.salaryHeads.map(h => ({ ...h })) : blank.salaryHeads,
      stdDocs:    emp.stdDocs ? { ...emp.stdDocs } : {},
      docs:       Array.isArray(emp.docs) ? emp.docs.map(d => ({ ...d })) : [],
      subjects:   emp.subjects   ? JSON.parse(JSON.stringify(emp.subjects))   : {},
      attendance: Array.isArray(emp.attendance) ? [...emp.attendance] : [],
    };
  });

  const [openClasses,  setOpenClasses]  = useState({});
  const [openSections, setOpenSections] = useState({});

  /* ── Cascading location + qualification lookups (real /api/Setting data) ── */
  const [countryList,  setCountryList]  = useState([]);
  const [provinceList, setProvinceList] = useState([]);
  const [cityList,     setCityList]     = useState([]);
  const [qualList,     setQualList]     = useState([]);

  /* Real classes/sections + lazily-loaded subjects for the Assignments tab. */
  const [hrGrades,      setHrGrades]      = useState([]);
  const [subjectsByKey, setSubjectsByKey] = useState({});   // { "gradeId_sectionId": [{id,name}] }
  useEffect(() => {
    let alive = true;
    hrService.getHrGrades().then(g => alive && setHrGrades(g)).catch(() => {});
    return () => { alive = false; };
  }, []);
  const loadSubjectsFor = (gradeId, sectionId) => {
    const key = `${gradeId}_${sectionId}`;
    setSubjectsByKey(prev => {
      if (prev[key]) return prev;                 // already loaded
      hrService.getHrSubjects(gradeId, sectionId)
        .then(list => setSubjectsByKey(p => ({ ...p, [key]: list })))
        .catch(() => setSubjectsByKey(p => ({ ...p, [key]: [] })));
      return prev;
    });
  };

  /* Load countries + qualifications once; in edit mode also pre-load the
     province/city lists for the employee's saved country/province so the
     dropdowns show the current selection. */
  useEffect(() => {
    let alive = true;
    hrService.getHrCountries().then(l => alive && setCountryList(l)).catch(() => {});
    hrService.getHrQualifications().then(l => alive && setQualList(l)).catch(() => {});
    if (form.countryID)  hrService.getHrProvinces(form.countryID).then(l => alive && setProvinceList(l)).catch(() => {});
    if (form.provinceID) hrService.getHrCities(form.provinceID).then(l => alive && setCityList(l)).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCountryChange = (val) => {
    setForm(f => ({ ...f, countryID: val, provinceID: '', cityID: '' }));
    setProvinceList([]); setCityList([]);
    if (val) hrService.getHrProvinces(val).then(setProvinceList).catch(() => {});
  };
  const onProvinceChange = (val) => {
    setForm(f => ({ ...f, provinceID: val, cityID: '' }));
    setCityList([]);
    if (val) hrService.getHrCities(val).then(setCityList).catch(() => {});
  };

  /* Leave settings live on their own endpoint — on edit, pull the saved record
     and merge it into the form (blank fields stay blank if the employee has none). */
  useEffect(() => {
    if (!isEdit || !emp?.id) return;
    let alive = true;
    hrService.getHrLeaveSettings(emp.id)
      .then(l => { if (alive && l) setForm(f => ({ ...f, leaves: { ...f.leaves, ...l } })); })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Snapshot the subject + attendance assignments at open so save toggles only the diff. */
  const subjectsOriginalRef   = useRef(JSON.parse(JSON.stringify(emp?.subjects || {})));
  const attendanceOriginalRef = useRef(JSON.parse(JSON.stringify(emp?.attendance || [])));

  /* Esc dismisses, body lock */
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  /* Cascading dept → desig: reset designation if the current value
     no longer matches the picked department. */
  useEffect(() => {
    if (!form.dId) return;
    const valid = desigs.some(d => String(d.id) === String(form.desId) && String(d.dId) === String(form.dId));
    if (!valid) {
      const first = desigs.find(d => String(d.dId) === String(form.dId));
      setForm(f => ({ ...f, desId: first ? first.id : '' }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.dId]);

  const filteredDesigs = useMemo(
    () => desigs.filter(d => String(d.dId) === String(form.dId)),
    [desigs, form.dId],
  );

  /* ── Generic setters ── */
  const set      = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setLeave = (k, v) => setForm(f => ({ ...f, leaves: { ...f.leaves, [k]: v } }));

  /* ── Salary heads helpers ── */
  const setHead = (i, patch) => setForm(f => ({
    ...f, salaryHeads: f.salaryHeads.map((h, idx) => idx === i ? { ...h, ...patch } : h),
  }));
  const toggleHeadType = (i) => setHead(i, { type: form.salaryHeads[i].type === 'allow' ? 'deduct' : 'allow' });
  const addHead    = () => setForm(f => ({ ...f, salaryHeads: [...f.salaryHeads, { name: '', amount: 0, type: 'allow', fixed: false }] }));
  const removeHead = (i) => setForm(f => {
    const h = f.salaryHeads[i];
    if (h?.fixed) return f;                              // fixed heads can't be removed
    if (h?.id) setRemovedHeadIds(ids => [...ids, h.id]); // queue the server delete
    return { ...f, salaryHeads: f.salaryHeads.filter((_, idx) => idx !== i) };
  });

  /* ── Live salary summary ── */
  const allowTotal  = form.salaryHeads.filter(h => h.type === 'allow').reduce((s, h) => s + (Number(h.amount) || 0), 0);
  const deductTotal = form.salaryHeads.filter(h => h.type === 'deduct').reduce((s, h) => s + (Number(h.amount) || 0), 0);
  const basicNum    = Number(form.basicSalary) || 0;
  const netSalary   = basicNum + allowTotal - deductTotal;
  const fmtMoney    = (n) => Number(n || 0).toLocaleString('en-US');

  /* ── Photo + document upload ── */
  const onPhotoPick = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Please pick an image file', 'error'); return; }
    if (file.size > 1.5 * 1024 * 1024)   { toast('Image must be under 1.5 MB', 'error'); return; }
    setForm(f => ({ ...f, photoFile: file }));           // real File for the multipart upload
    const reader = new FileReader();
    reader.onload = (e) => set('photo', e.target.result);
    reader.readAsDataURL(file);
  };
  /* ── Employee documents (real upload/delete on save; auto-replace by type) ──
     stdDocs[key] is either { id, path } (on server) or { file, name } (picked,
     pending upload); customDocs holds "Other" docs in the same union shape;
     removedDocIds queues server docs to delete on save. */
  const [newEmpDocName, setNewEmpDocName] = useState('');
  const [removedDocIds, setRemovedDocIds] = useState([]);
  const empDocRef = useRef(null);
  const empCustomDocRef = useRef(null);
  const pendingDocKeyRef = useRef(null);

  const pickEmpDoc = (key) => {
    pendingDocKeyRef.current = key;
    setTimeout(() => empDocRef.current && empDocRef.current.click(), 0);
  };
  const onEmpDocFile = (e) => {
    const file = e.target.files && e.target.files[0];
    const key  = pendingDocKeyRef.current;
    if (!file || !key) return;
    setForm(f => ({ ...f, stdDocs: { ...f.stdDocs, [key]: { file, name: file.name } } }));
    pendingDocKeyRef.current = null;
    e.target.value = '';
    toast(`Document "${HR_DOC_SLOTS.find(d => d.key === key)?.label}" attached`, 'success');
  };
  const onEmpCustomDoc = () => {
    if (!newEmpDocName.trim()) { toast('Enter the document name first', 'error'); return; }
    empCustomDocRef.current && empCustomDocRef.current.click();
  };
  const onEmpCustomDocFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const name = newEmpDocName.trim();
    setForm(f => ({ ...f, docs: [...f.docs, { name, file }] }));
    setNewEmpDocName('');
    e.target.value = '';
    toast('Document attached', 'success');
  };
  const removeEmpCustomDoc = (i) => {
    setForm(f => {
      const doc = f.docs[i];
      if (doc && doc.id) setRemovedDocIds(ids => [...ids, doc.id]);
      return { ...f, docs: f.docs.filter((_, idx) => idx !== i) };
    });
  };
  const removeEmpStdDoc = (key) => {
    setForm(f => {
      const doc = f.stdDocs[key];
      if (doc && doc.id) setRemovedDocIds(ids => [...ids, doc.id]);
      const next = { ...f.stdDocs }; delete next[key];
      return { ...f, stdDocs: next };
    });
  };

  /* ── Subject Assignment helpers ── */
  const subjKey = (cId, sId) => `${cId}_${sId}`;
  const toggleSubject = (cId, sId, subId) => {
    setForm(f => {
      const k = subjKey(cId, sId);
      const next = { ...f.subjects };
      const arr  = (next[k] || []).slice();
      const i    = arr.indexOf(subId);
      if (i >= 0) arr.splice(i, 1); else arr.push(subId);
      if (arr.length === 0) delete next[k]; else next[k] = arr;
      return { ...f, subjects: next };
    });
  };
  const toggleClassOpen   = (cId)       => setOpenClasses(o => ({ ...o, [cId]: !o[cId] }));
  const toggleSectionOpen = (cId, sId)  => {
    const k = subjKey(cId, sId);
    setOpenSections(o => ({ ...o, [k]: !o[k] }));
    loadSubjectsFor(cId, sId);   // fetch real subjects the first time it opens
  };

  /* ── Attendance helpers (real classes/sections; each entry is an object
     { gradeId, sectionId, className, sectionName }) ── */
  const allSections = useMemo(() => {
    const out = [];
    hrGrades.forEach(c => c.sections.forEach(s => out.push({
      gradeId: c.id, className: c.name, sectionId: s.id, sectionName: s.name,
    })));
    return out;
  }, [hrGrades]);
  const isAttendChecked = (gradeId, sectionId) =>
    form.attendance.some(a => a.gradeId === gradeId && a.sectionId === sectionId);
  const toggleAttend = (item) => setForm(f => {
    const has = f.attendance.some(a => a.gradeId === item.gradeId && a.sectionId === item.sectionId);
    return {
      ...f,
      attendance: has
        ? f.attendance.filter(a => !(a.gradeId === item.gradeId && a.sectionId === item.sectionId))
        : [...f.attendance, item],
    };
  });
  const attendSelectAll = () => setForm(f => ({ ...f, attendance: allSections.map(s => ({ ...s })) }));
  const attendClearAll  = () => setForm(f => ({ ...f, attendance: [] }));

  /* ── Submit (mirrors saveEmp() in the HTML) ── */
  const submit = async () => {
    if (saving) return;
    if (!form.firstName.trim()) { toast('First name required', 'error');        setTab(0); return; }
    if (!form.cnic.trim())      { toast('CNIC required', 'error');              setTab(0); return; }
    if (!form.fn.trim())        { toast('Father / Husband name required', 'error'); setTab(0); return; }
    if (!form.phone.trim())     { toast('Mobile number required', 'error');     setTab(0); return; }
    if (!form.dId || !form.desId) { toast('Department & Designation required', 'error'); setTab(1); return; }

    /* Documents the user picked this session (each carries a real File). Fixed
       slots map to their backend documentType; custom docs use their free-text
       name. These upload after the employee is saved. */
    const docUploads = [];
    Object.entries(form.stdDocs || {}).forEach(([key, v]) => {
      if (v && v.file instanceof File) {
        docUploads.push({ documentType: HR_DOC_SLOTS.find(d => d.key === key)?.type || key, file: v.file });
      }
    });
    (form.docs || []).forEach(d => {
      if (d && d.file instanceof File && d.name) docUploads.push({ documentType: d.name, file: d.file });
    });

    const payload = {
      ...form,
      basicSalary: Number(form.basicSalary) || 0,
      salaryHeads: form.salaryHeads.map(h => ({ ...h, amount: Number(h.amount) || 0 })),
      removedHeadIds,
      subjectsOriginal: subjectsOriginalRef.current,
      attendanceOriginal: attendanceOriginalRef.current,
      docUploads,
      removedDocIds,
      leaves: {
        ...form.leaves,
        annual:    Number(form.leaves.annual)    || 0,
        casual:    Number(form.leaves.casual)    || 0,
        sick:      Number(form.leaves.sick)      || 0,
        maternity: Number(form.leaves.maternity) || 0,
        balance:   Number(form.leaves.balance)   || 0,
        absentDed: Number(form.leaves.absentDed) || 0,
        unpaidDed: Number(form.leaves.unpaidDed) || 0,
      },
    };
    if (isEdit && emp?.id) payload.id = emp.id;

    /* Run the save (many APIs) with the button in a loading state; the parent
       closes the modal on success and toasts on failure. */
    setSaving(true);
    try {
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  };

  /* Tab nav */
  const goPrev = () => setTab(t => Math.max(0, t - 1));
  const goNext = () => setTab(t => Math.min(5, t + 1));

  const TAB_DEFS = [
    ['fa-user',                'Personal Information'],
    ['fa-briefcase',           'Official Details'],
    ['fa-money-bill-wave',     'Salary Details'],
    ['fa-calendar-minus',      'Leave Details'],
    ['fa-file-lines',          'Documents'],
    ['fa-list-check',          'Assignments'],
  ];

  return createPortal((
    <div
      className="ov open"
      role="dialog" aria-modal="true" aria-labelledby="add-emp-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal modal-xl">
        {/* ─── Head ─── */}
        <div className="modal-head">
          <div className="modal-head-left">
            <div className="modal-head-icon"><i className="fa-solid fa-user-tie" aria-hidden="true"></i></div>
            <div>
              <div className="modal-title" id="add-emp-title">{isEdit ? `Edit Employee — ${getFullName(emp)}` : 'Add New Employee'}</div>
              <div className="modal-sub">Complete all sections — fields marked * are required</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>

        {/* ─── Tab bar ─── */}
        <div className="m-tabs" role="tablist" aria-label="Employee form sections">
          {TAB_DEFS.map(([icn, lbl], i) => (
            <button
              key={i} type="button" role="tab"
              className={`m-tab${tab === i ? ' active' : ''}`}
              aria-selected={tab === i}
              onClick={() => setTab(i)}
            >
              <i className={`fa-solid ${icn}`} aria-hidden="true"></i> {lbl}
            </button>
          ))}
        </div>

        {/* ═══════ TAB BODIES ═══════ */}
        {tab === 0 && (
          <div className="modal-body">
            <div className="m-section">
              <div className="m-section-title"><i className="fa-solid fa-id-card" aria-hidden="true"></i> Personal Information</div>

              <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap' }}>
                <div>
                  <label className="f-label">Profile Image</label>
                  <div className="photo-wrap" onClick={() => photoRef.current?.click()}>
                    {form.photo
                      ? <img src={form.photo} alt="" />
                      : (
                        <div style={{ textAlign: 'center', padding: 8 }}>
                          <i className="fa-solid fa-camera" style={{ fontSize: 20, color: 'var(--tm)' }} aria-hidden="true"></i>
                          <div style={{ fontSize: 9, color: 'var(--tm)', marginTop: 4 }}>Upload Photo</div>
                        </div>
                      )}
                  </div>
                  <input
                    ref={photoRef} type="file" accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => onPhotoPick(e.target.files?.[0])}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div className="f-row">
                    <div className="f-group">
                      <label className="f-label">First Name <span className="req">*</span></label>
                      <input className="f-input" placeholder="First name" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} autoFocus />
                    </div>
                    <div className="f-group">
                      <label className="f-label">Last Name</label>
                      <input className="f-input" placeholder="Last name" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
                    </div>
                  </div>
                  <div className="f-row" style={{ marginTop: 0 }}>
                    <div className="f-group">
                      <label className="f-label">Father / Husband Name <span className="req">*</span></label>
                      <input className="f-input" placeholder="Father / husband name" value={form.fn} onChange={(e) => set('fn', e.target.value)} />
                    </div>
                    <div className="f-group">
                      <label className="f-label">CNIC <span className="req">*</span></label>
                      <input className="f-input" placeholder="35101-1234567-1" value={form.cnic} onChange={(e) => set('cnic', e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="f-row-3">
                <div className="f-group"><label className="f-label">Date of Birth</label><input type="date" className="f-input" value={form.dob} onChange={(e) => set('dob', e.target.value)} /></div>
                <div className="f-group"><label className="f-label">Gender</label>
                  <select className="f-select2" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </div>
                <div className="f-group"><label className="f-label">Marital Status</label>
                  <select className="f-select2" value={form.marital} onChange={(e) => set('marital', e.target.value)}>
                    <option>Single</option><option>Married</option><option>Divorced</option><option>Widowed</option>
                  </select>
                </div>
              </div>

              <div className="f-row-3">
                <div className="f-group"><label className="f-label">Mobile Number <span className="req">*</span></label><input className="f-input" placeholder="03XX-XXXXXXX" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
                <div className="f-group"><label className="f-label">Email</label><input type="email" className="f-input" placeholder="email@school.com" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
                <div className="f-group"><label className="f-label">Blood Group</label>
                  <select className="f-select2" value={form.blood} onChange={(e) => set('blood', e.target.value)}>
                    {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              <div className="f-row">
                <div className="f-group"><label className="f-label">Emergency Contact</label><input className="f-input" placeholder="Emergency number" value={form.emergency} onChange={(e) => set('emergency', e.target.value)} /></div>
                <div className="f-group"><label className="f-label">Nationality</label><input className="f-input" placeholder="e.g. Pakistani" value={form.nationality} onChange={(e) => set('nationality', e.target.value)} /></div>
              </div>
              <div className="f-group"><label className="f-label">Address</label><textarea className="f-textarea" placeholder="Full residential address" value={form.address} onChange={(e) => set('address', e.target.value)} /></div>
            </div>
          </div>
        )}

        {tab === 1 && (
          <div className="modal-body">
            <div className="m-section">
              <div className="m-section-title"><i className="fa-solid fa-briefcase" aria-hidden="true"></i> Official Details</div>

              <div className="f-row-3">
                <div className="f-group"><label className="f-label">Employee ID</label><input className="f-input" placeholder="Auto-generated (e.g. EMP-001)" value={form.eid} onChange={(e) => set('eid', e.target.value)} /></div>
                <div className="f-group"><label className="f-label">Date of Joining</label><input type="date" className="f-input" value={form.join} onChange={(e) => set('join', e.target.value)} /></div>
                <div className="f-group"><label className="f-label">Status</label>
                  <select className="f-select2" value={form.status} onChange={(e) => set('status', e.target.value)}>
                    <option>Active</option><option>Inactive</option><option>On Leave</option><option>Probation</option>
                  </select>
                </div>
              </div>

              <div className="f-row">
                <div className="f-group">
                  <label className="f-label">Department <span className="req">*</span></label>
                  <select className="f-select2" value={form.dId} onChange={(e) => set('dId', Number(e.target.value) || '')}>
                    <option value="">Select Department</option>
                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="f-group">
                  <label className="f-label">Designation <span className="req">*</span></label>
                  <select className="f-select2" value={form.desId} onChange={(e) => set('desId', Number(e.target.value) || '')} disabled={!form.dId}>
                    <option value="">Select Designation</option>
                    {filteredDesigs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="f-row">
                <div className="f-group"><label className="f-label">Employment Type</label>
                  <select className="f-select2" value={form.type} onChange={(e) => set('type', e.target.value)}>
                    <option>Permanent</option><option>Contractual</option><option>Part-Time</option><option>Probation</option><option>Internship</option>
                  </select>
                </div>
                <div className="f-group"><label className="f-label">Reporting Manager</label><input className="f-input" placeholder="Reporting manager name" value={form.manager} onChange={(e) => set('manager', e.target.value)} /></div>
              </div>

              <div className="f-row-3">
                <div className="f-group"><label className="f-label">Qualification</label>
                  <select className="f-select2" value={form.qualificationID || ''} onChange={(e) => set('qualificationID', Number(e.target.value) || '')}>
                    <option value="">Select Qualification</option>
                    {qualList.map(q => (
                      <option key={q.qualificationID ?? q.id} value={q.qualificationID ?? q.id}>{q.qualificationName ?? q.name}</option>
                    ))}
                  </select>
                </div>
                <div className="f-group"><label className="f-label">Experience</label><input className="f-input" placeholder="e.g. 5 years" value={form.exp} onChange={(e) => set('exp', e.target.value)} /></div>
                <div className="f-group"><label className="f-label">Shift / Duty Timing</label><input className="f-input" placeholder="e.g. 8:00 AM – 2:00 PM" value={form.shift} onChange={(e) => set('shift', e.target.value)} /></div>
              </div>

              <div className="f-row-3">
                <div className="f-group"><label className="f-label">Country</label>
                  <select className="f-select2" value={form.countryID || ''} onChange={(e) => onCountryChange(Number(e.target.value) || '')}>
                    <option value="">Select Country</option>
                    {countryList.map(c => <option key={c.ID ?? c.id} value={c.ID ?? c.id}>{c.Name ?? c.name}</option>)}
                  </select>
                </div>
                <div className="f-group"><label className="f-label">Province / State</label>
                  <select className="f-select2" value={form.provinceID || ''} onChange={(e) => onProvinceChange(Number(e.target.value) || '')} disabled={!form.countryID}>
                    <option value="">Select Province</option>
                    {provinceList.map(p => <option key={p.ID ?? p.id} value={p.ID ?? p.id}>{p.Name ?? p.name}</option>)}
                  </select>
                </div>
                <div className="f-group"><label className="f-label">City</label>
                  <select className="f-select2" value={form.cityID || ''} onChange={(e) => set('cityID', Number(e.target.value) || '')} disabled={!form.provinceID}>
                    <option value="">Select City</option>
                    {cityList.map(c => <option key={c.ID ?? c.id} value={c.ID ?? c.id}>{c.Name ?? c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="f-group"><label className="f-label">Job Role / Responsibilities</label><textarea className="f-textarea" placeholder="Key responsibilities and job role…" value={form.role} onChange={(e) => set('role', e.target.value)} /></div>
            </div>
          </div>
        )}

        {tab === 2 && (
          <div className="modal-body">
            <div className="info-banner payroll">
              <div className="info-banner-icon"><i className="fa-solid fa-link" aria-hidden="true"></i></div>
              <div className="info-banner-body">
                <div className="info-banner-title">Connected to Payroll Module</div>
                <div className="info-banner-text">Salary heads configured here — <strong>Basic Salary, Allowances, Deductions and Benefits</strong> — will automatically appear in the Payroll module for salary generation, payroll processing, salary slips and payroll reports.</div>
                <div className="module-chips">
                  <span className="module-chip"><i className="fa-solid fa-coins" aria-hidden="true"></i> Payroll</span>
                  <span className="module-chip"><i className="fa-solid fa-file-invoice" aria-hidden="true"></i> Salary Slips</span>
                  <span className="module-chip"><i className="fa-solid fa-chart-line" aria-hidden="true"></i> Reports</span>
                </div>
              </div>
            </div>

            <div className="m-section">
              <div className="m-section-title"><i className="fa-solid fa-money-bill-wave" aria-hidden="true"></i> Basic Salary</div>
              <div className="f-row">
                <div className="f-group"><label className="f-label">Basic Monthly Salary (PKR) <span className="req">*</span></label><input type="number" className="f-input" placeholder="e.g. 50000" value={form.basicSalary} onChange={(e) => set('basicSalary', e.target.value)} min={0} /></div>
                <div className="f-group"><label className="f-label">Payment Method</label>
                  <select className="f-select2" value={form.payMethod} onChange={(e) => set('payMethod', e.target.value)}>
                    <option>Bank Transfer</option><option>Cash</option><option>Cheque</option><option>Mobile Wallet</option>
                  </select>
                </div>
              </div>
              <div className="f-row">
                <div className="f-group"><label className="f-label">Bank Name</label><input className="f-input" placeholder="Bank name" value={form.bankName} onChange={(e) => set('bankName', e.target.value)} /></div>
                <div className="f-group"><label className="f-label">Account Number / IBAN</label><input className="f-input" placeholder="Account number or IBAN" value={form.bankAcc} onChange={(e) => set('bankAcc', e.target.value)} /></div>
              </div>
            </div>

            <div className="m-section">
              <div className="m-section-title">
                <i className="fa-solid fa-list-check" aria-hidden="true"></i> Allowances &amp; Deductions
                <Tooltip text="Add allowances (e.g. House, Transport, Medical) or deductions (e.g. Tax, Loan). All will sync with Payroll.">
                  <span className="tip-icon"><i className="fa-solid fa-info" aria-hidden="true"></i></span>
                </Tooltip>
              </div>
              {form.salaryHeads.length === 0 ? (
                <div className="sal-heads-empty">No allowances or deductions added yet. Click <strong>Add More Salary Head</strong> below.</div>
              ) : (
                <div className="sal-heads-grid">
                  {form.salaryHeads.map((h, i) => (
                    <div key={i} className={`sal-head-card type-${h.type}`}>
                      <div className="sal-head-top">
                        {h.fixed ? (
                          <div className="sal-head-name-fixed">{h.name}</div>
                        ) : (
                          <input
                            className="sal-head-name-input"
                            placeholder="Salary head name"
                            value={h.name}
                            onChange={(e) => setHead(i, { name: e.target.value })}
                          />
                        )}
                        {h.fixed ? (
                          <span className="sal-head-type-pill allow" style={{ cursor: 'default' }}>
                            <i className="fa-solid fa-plus" aria-hidden="true"></i> Allow
                          </span>
                        ) : (
                          <Tooltip text={h.type === 'allow'
                            ? 'Currently an allowance — click to switch to a deduction'
                            : 'Currently a deduction — click to switch to an allowance'}>
                            {/* Pill shows the ACTION (opposite of current state): clicking
                               "Allow" makes the head an allowance (isAllowance true), and
                               clicking "Deduct" makes it a deduction (isAllowance false). */}
                            <button type="button" className={`sal-head-type-pill ${h.type === 'allow' ? 'deduct' : 'allow'}`} onClick={() => toggleHeadType(i)}>
                              {h.type === 'allow'
                                ? (<><i className="fa-solid fa-minus" aria-hidden="true"></i> Deduct</>)
                                : (<><i className="fa-solid fa-plus" aria-hidden="true"></i> Allow</>)}
                            </button>
                          </Tooltip>
                        )}
                        {!h.fixed && (
                          <Tooltip text="Remove">
                            <button type="button" className="sal-head-remove" onClick={() => removeHead(i)} aria-label="Remove salary head">
                              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                            </button>
                          </Tooltip>
                        )}
                      </div>
                      <div className="sal-head-bottom">
                        <div className="sal-head-amt-prefix">PKR</div>
                        <input
                          type="number" min={0}
                          className="sal-head-amt-input"
                          placeholder="0"
                          value={h.amount}
                          onChange={(e) => setHead(i, { amount: e.target.value })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" className="add-more-btn" onClick={addHead}>
                <i className="fa-solid fa-plus" aria-hidden="true"></i> Add More Salary Head
              </button>
            </div>

            <div className="m-section" style={{ background: 'linear-gradient(135deg, rgba(30,58,138,.04), transparent)' }}>
              <div className="m-section-title"><i className="fa-solid fa-calculator" aria-hidden="true"></i> Salary Summary</div>
              <div className="sal-summary">
                <div className="sal-summary-item"><span className="sal-summary-label">Basic</span><span className="sal-summary-value">PKR {fmtMoney(basicNum)}</span></div>
                <div className="sal-summary-item"><span className="sal-summary-label">Allowances</span><span className="sal-summary-value allow">+ PKR {fmtMoney(allowTotal)}</span></div>
                <div className="sal-summary-item"><span className="sal-summary-label">Deductions</span><span className="sal-summary-value deduct">– PKR {fmtMoney(deductTotal)}</span></div>
                <div className="sal-summary-item"><span className="sal-summary-label">Net Salary</span><span className="sal-summary-value net">PKR {fmtMoney(netSalary)}</span></div>
              </div>
            </div>
          </div>
        )}

        {tab === 3 && (
          <div className="modal-body">
            <div className="info-banner payroll">
              <div className="info-banner-icon"><i className="fa-solid fa-link" aria-hidden="true"></i></div>
              <div className="info-banner-body">
                <div className="info-banner-title">Connected to Payroll Module</div>
                <div className="info-banner-text">Leave settings configured here — <strong>paid leaves, unpaid leaves, leave balance and absence rules</strong> — will be used by the Payroll module to calculate leave deductions and salary adjustments.</div>
                <div className="module-chips">
                  <span className="module-chip"><i className="fa-solid fa-coins" aria-hidden="true"></i> Payroll</span>
                  <span className="module-chip"><i className="fa-solid fa-calendar-check" aria-hidden="true"></i> Attendance</span>
                </div>
              </div>
            </div>

            <div className="m-section">
              <div className="m-section-title"><i className="fa-solid fa-calendar-check" aria-hidden="true"></i> Annual Leave Allowance</div>
              <div className="f-row-3">
                <div className="f-group"><label className="f-label">Annual Paid Leaves <span className="req">*</span></label><input type="number" min={0} className="f-input" placeholder="20" value={form.leaves.annual} onChange={(e) => setLeave('annual', e.target.value)} /></div>
                <div className="f-group"><label className="f-label">Casual Leaves</label><input type="number" min={0} className="f-input" placeholder="10" value={form.leaves.casual} onChange={(e) => setLeave('casual', e.target.value)} /></div>
                <div className="f-group"><label className="f-label">Sick Leaves</label><input type="number" min={0} className="f-input" placeholder="8" value={form.leaves.sick} onChange={(e) => setLeave('sick', e.target.value)} /></div>
              </div>
              <div className="f-row-3">
                <div className="f-group"><label className="f-label">Maternity / Paternity Leaves</label><input type="number" min={0} className="f-input" placeholder="0" value={form.leaves.maternity} onChange={(e) => setLeave('maternity', e.target.value)} /></div>
                <div className="f-group"><label className="f-label">Leave Balance (Current)</label><input type="number" min={0} className="f-input" placeholder="Auto-calculated" value={form.leaves.balance} onChange={(e) => setLeave('balance', e.target.value)} /></div>
                <div className="f-group"><label className="f-label">Leave Policy</label>
                  <select className="f-select2" value={form.leaves.policy} onChange={(e) => setLeave('policy', e.target.value)}>
                    <option>Standard</option><option>Senior Staff</option><option>Custom</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="m-section">
              <div className="m-section-title"><i className="fa-solid fa-sliders" aria-hidden="true"></i> Leave Deduction Setup</div>
              <div className="leave-toggle-row">
                <div>
                  <div className="leave-toggle-title">Enable Leave Deduction</div>
                  <div className="leave-toggle-sub">Automatically deduct salary on unpaid leaves &amp; absences</div>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={!!form.leaves.deductEn} onChange={(e) => setLeave('deductEn', e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>
              <div className="f-row">
                <div className="f-group"><label className="f-label">Deduction of one day (Absent) — PKR</label><input type="number" min={0} className="f-input" placeholder="100" value={form.leaves.absentDed} onChange={(e) => setLeave('absentDed', e.target.value)} /></div>
                <div className="f-group"><label className="f-label">Deduction on unpaid leaves — PKR</label><input type="number" min={0} className="f-input" placeholder="1000" value={form.leaves.unpaidDed} onChange={(e) => setLeave('unpaidDed', e.target.value)} /></div>
              </div>
            </div>
          </div>
        )}

        {tab === 4 && (
          <div className="modal-body">
            <div className="info-banner">
              <div className="info-banner-icon"><i className="fa-solid fa-circle-info" aria-hidden="true"></i></div>
              <div className="info-banner-body">
                <div className="info-banner-title">Document Upload</div>
                <div className="info-banner-text">Accepted formats: <strong>PDF, JPG, PNG</strong>. Max 10MB per file. Documents can be viewed or replaced anytime.</div>
              </div>
            </div>

            <div className="m-section">
              <div className="m-section-title"><i className="fa-solid fa-folder-open" aria-hidden="true"></i> Required Documents</div>
              {HR_DOC_SLOTS.map((slot) => {
                const doc = form.stdDocs[slot.key];
                const uploaded = !!doc;
                return (
                  <div className="doc-item" key={slot.key}>
                    <div className="doc-icon"><i className={`fa-solid ${uploaded ? 'fa-circle-check' : slot.icon}`} aria-hidden="true"></i></div>
                    <div style={{ flex: 1 }}>
                      <div className="doc-item-name">{slot.label}</div>
                      <div className="doc-item-meta">{uploaded ? (doc.file instanceof File ? doc.name : 'Uploaded') : 'Not uploaded'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {doc?.path && <a className="btn-sm" href={doc.path} target="_blank" rel="noreferrer"><i className="fa-solid fa-eye" aria-hidden="true"></i> View</a>}
                      <button type="button" className="btn-sm" onClick={() => pickEmpDoc(slot.key)}>
                        <i className={`fa-solid ${uploaded ? 'fa-rotate' : 'fa-upload'}`} aria-hidden="true"></i> {uploaded ? 'Replace' : 'Upload'}
                      </button>
                      {uploaded && <button type="button" className="btn-sm" style={{ borderColor: 'var(--err)', color: 'var(--err)' }} onClick={() => removeEmpStdDoc(slot.key)}><i className="fa-solid fa-xmark" aria-hidden="true"></i></button>}
                    </div>
                  </div>
                );
              })}
              <input ref={empDocRef} type="file" style={{ display: 'none' }} onChange={onEmpDocFile} />
            </div>

            <div className="m-section">
              <div className="m-section-title"><i className="fa-solid fa-folder-plus" aria-hidden="true"></i> Other Documents</div>
              <div className="f-row">
                <div className="f-group" style={{ flex: 1 }}>
                  <label className="f-label">Other Document Name</label>
                  <input className="f-input" placeholder="e.g. Police Clearance, Reference Letter" value={newEmpDocName} onChange={(e) => setNewEmpDocName(e.target.value)} />
                </div>
                <button type="button" className="btn-sm" style={{ alignSelf: 'flex-end', height: 38 }} onClick={onEmpCustomDoc}>
                  <i className="fa-solid fa-upload" aria-hidden="true"></i> Upload &amp; Attach
                </button>
                <input ref={empCustomDocRef} type="file" style={{ display: 'none' }} onChange={onEmpCustomDocFile} />
              </div>
              {(form.docs || []).map((d, i) => (
                <div className="doc-item" key={i}>
                  <div className="doc-icon"><i className="fa-solid fa-file" aria-hidden="true"></i></div>
                  <div style={{ flex: 1 }}>
                    <div className="doc-item-name">{d.name}</div>
                    <div className="doc-item-meta">{d.file instanceof File ? d.file.name : 'Uploaded'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {d.path && <a className="btn-sm" href={d.path} target="_blank" rel="noreferrer"><i className="fa-solid fa-eye" aria-hidden="true"></i> View</a>}
                    <button type="button" className="btn-sm" style={{ borderColor: 'var(--err)', color: 'var(--err)' }} onClick={() => removeEmpCustomDoc(i)}><i className="fa-solid fa-xmark" aria-hidden="true"></i> Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 5 && (
          <div className="modal-body">
            <div className="sub-tabs">
              <button type="button" className={`sub-tab${assignTab === 0 ? ' active' : ''}`} onClick={() => setAssignTab(0)}>
                <i className="fa-solid fa-book" aria-hidden="true"></i> Subject Assignment
              </button>
              <button type="button" className={`sub-tab${assignTab === 1 ? ' active' : ''}`} onClick={() => setAssignTab(1)}>
                <i className="fa-solid fa-calendar-check" aria-hidden="true"></i> Class Attendance
              </button>
            </div>

            {assignTab === 0 && (
              <>
                <div className="info-banner success">
                  <div className="info-banner-icon"><i className="fa-solid fa-link" aria-hidden="true"></i></div>
                  <div className="info-banner-body">
                    <div className="info-banner-title">Connected to Academics, ERP &amp; Mobile App</div>
                    <div className="info-banner-text">The classes and subjects assigned here determine what the teacher can access throughout the ERP and Mobile App — including <strong>Homework, Lesson Plans, Notebook Plans, Syllabus, Assessments, Results Entry, Examinations, Academic Reports, Mentor AI features</strong> and the Teacher Mobile App.</div>
                    <div className="module-chips">
                      <span className="module-chip"><i className="fa-solid fa-book-open-reader" aria-hidden="true"></i> Academics</span>
                      <span className="module-chip"><i className="fa-solid fa-pen-to-square" aria-hidden="true"></i> Homework</span>
                      <span className="module-chip"><i className="fa-solid fa-file-pen" aria-hidden="true"></i> Examination</span>
                      <span className="module-chip"><i className="fa-solid fa-mobile-screen" aria-hidden="true"></i> Mobile App</span>
                      <span className="module-chip"><i className="fa-solid fa-robot" aria-hidden="true"></i> Mentor AI</span>
                    </div>
                  </div>
                </div>

                <div className="m-section" style={{ padding: 0 }}>
                  <div className="assign-section-header">
                    <div className="m-section-title" style={{ marginBottom: 0 }}>
                      <i className="fa-solid fa-book" aria-hidden="true"></i> Assigned Subjects per Class &amp; Section
                    </div>
                    <span className="assign-section-hint">Click a class to expand</span>
                  </div>
                  <div className="assign-tree">
                    {hrGrades.length === 0 && (
                      <div style={{ padding: 16, color: 'var(--tm)', fontWeight: 600 }}>Loading classes…</div>
                    )}
                    {hrGrades.map(cls => {
                      const classOpen = !!openClasses[cls.id];
                      let totalChecked = 0;
                      cls.sections.forEach(s => { totalChecked += (form.subjects[subjKey(cls.id, s.id)] || []).length; });
                      return (
                        <div className="assign-tree-row" key={cls.id}>
                          <div
                            className={`assign-class-head${classOpen ? ' open' : ''}`}
                            onClick={() => toggleClassOpen(cls.id)}
                          >
                            <div className="assign-class-icon"><i className="fa-solid fa-school" aria-hidden="true"></i></div>
                            <div className="assign-class-name">{cls.name}</div>
                            <div className="assign-class-count">
                              {totalChecked > 0
                                ? (<><i className="fa-solid fa-check" aria-hidden="true"></i> {totalChecked} selected</>)
                                : <span style={{ color: 'var(--tm)', fontWeight: 600 }}>{cls.sections.length} section{cls.sections.length === 1 ? '' : 's'}</span>}
                            </div>
                            <i className={`fa-solid fa-chevron-down assign-class-chev${classOpen ? ' open' : ''}`} aria-hidden="true"></i>
                          </div>
                          <div className={`assign-section-list${classOpen ? ' open' : ''}`}>
                            {cls.sections.map(sec => {
                              const sKey = subjKey(cls.id, sec.id);
                              const secOpen = !!openSections[sKey];
                              const checked = (form.subjects[sKey] || []).length;
                              const subs = subjectsByKey[sKey];
                              return (
                                <div className="assign-section-row" key={sec.id}>
                                  <div className="assign-section-head" onClick={() => toggleSectionOpen(cls.id, sec.id)}>
                                    <div></div>
                                    <div className="assign-section-name">Section {sec.name}</div>
                                    <div className="assign-class-count">
                                      {checked > 0
                                        ? (<><i className="fa-solid fa-check" aria-hidden="true"></i> {checked} subject{checked === 1 ? '' : 's'}</>)
                                        : <span style={{ color: 'var(--tm)', fontWeight: 600 }}>{Array.isArray(subs) ? `${subs.length} subjects` : 'View subjects'}</span>}
                                    </div>
                                    <i className={`fa-solid fa-chevron-down assign-class-chev${secOpen ? ' open' : ''}`} aria-hidden="true"></i>
                                  </div>
                                  <div className={`assign-subjects-list${secOpen ? ' open' : ''}`}>
                                    <div className="assign-subjects-grid">
                                      {!Array.isArray(subs)
                                        ? <span style={{ color: 'var(--tm)', fontWeight: 600, padding: 8 }}>Loading subjects…</span>
                                        : subs.length === 0
                                          ? <span style={{ color: 'var(--tm)', fontWeight: 600, padding: 8 }}>No subjects for this section.</span>
                                          : subs.map(sub => {
                                              const ck = (form.subjects[sKey] || []).includes(sub.id);
                                              return (
                                                <div
                                                  key={sub.id}
                                                  className={`assign-subj-pill${ck ? ' checked' : ''}`}
                                                  onClick={() => toggleSubject(cls.id, sec.id, sub.id)}
                                                >
                                                  <div className="check-icon"><i className="fa-solid fa-check" aria-hidden="true"></i></div>
                                                  <span>{sub.name}</span>
                                                </div>
                                              );
                                            })}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="info-banner" style={{ marginTop: 12 }}>
                  <div className="info-banner-icon"><i className="fa-solid fa-circle-info" aria-hidden="true"></i></div>
                  <div className="info-banner-body">
                    <div className="info-banner-text" style={{ margin: 0 }}>
                      Need to assign tasks to this employee? Use the <strong>3-dots menu → Task Assignment</strong> on the employee row, or the Task Assignment button in the employee details panel.
                    </div>
                  </div>
                </div>
              </>
            )}

            {assignTab === 1 && (
              <>
                <div className="info-banner success">
                  <div className="info-banner-icon"><i className="fa-solid fa-link" aria-hidden="true"></i></div>
                  <div className="info-banner-body">
                    <div className="info-banner-title">Connected to Attendance &amp; Mobile App</div>
                    <div className="info-banner-text">The attendance permissions assigned here determine which classes this employee can manage for attendance. The teacher will only see and mark attendance for assigned classes, controlling <strong>Daily Attendance, Attendance Reports, Attendance Corrections</strong> and Teacher Mobile App attendance screens.</div>
                    <div className="module-chips">
                      <span className="module-chip"><i className="fa-solid fa-calendar-check" aria-hidden="true"></i> Attendance</span>
                      <span className="module-chip"><i className="fa-solid fa-mobile-screen" aria-hidden="true"></i> Mobile App</span>
                      <span className="module-chip"><i className="fa-solid fa-chart-line" aria-hidden="true"></i> Reports</span>
                    </div>
                  </div>
                </div>

                <div className="m-section" style={{ padding: 0, overflow: 'hidden' }}>
                  <div className="attend-toolbar">
                    <div className="attend-toolbar-info">Selected: <strong>{form.attendance.length}</strong> classes</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="btn-sm" onClick={attendSelectAll}><i className="fa-solid fa-check-double" aria-hidden="true"></i> Select All</button>
                      <button type="button" className="btn-sm" style={{ borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.06)' }} onClick={attendClearAll}><i className="fa-solid fa-xmark" aria-hidden="true"></i> Clear All</button>
                    </div>
                  </div>
                  <div className="attend-grid">
                    <div className="attend-head">
                      <div className="th">S/N</div>
                      <div className="th">Class</div>
                      <div className="th">Section</div>
                      <div className="th" style={{ textAlign: 'center' }}>Select</div>
                    </div>
                    {allSections.length === 0 && (
                      <div style={{ padding: 16, color: 'var(--tm)', fontWeight: 600 }}>Loading classes…</div>
                    )}
                    {allSections.map((s, i) => {
                      const ck = isAttendChecked(s.gradeId, s.sectionId);
                      return (
                        <div key={`${s.gradeId}_${s.sectionId}`} className={`attend-row${ck ? ' checked' : ''}`} onClick={() => toggleAttend(s)}>
                          <div className="td td-num">{i + 1}</div>
                          <div className="td td-bold">{s.className}</div>
                          <div className="td"><span className="badge b-blue">{s.sectionName}</span></div>
                          <div className="td" style={{ justifyContent: 'center' }}>
                            <div className="attend-checkbox"><i className="fa-solid fa-check" aria-hidden="true"></i></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── Footer ─── */}
        <div className="modal-foot">
          <div className="modal-foot-hint">
            <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
            <span>You can switch between tabs — your input is preserved.</span>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          {tab > 0 && (
            <button type="button" className="btn-secondary" onClick={goPrev} disabled={saving}>
              <i className="fa-solid fa-chevron-left" aria-hidden="true"></i> Previous
            </button>
          )}
          {tab < 5 && (
            <button type="button" className="btn-secondary" onClick={goNext} disabled={saving}>
              Next <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
            </button>
          )}
          <button type="button" className="btn-primary" onClick={submit} disabled={saving}>
            {saving
              ? (<><i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Saving…</>)
              : (<><i className="fa-solid fa-check" aria-hidden="true"></i> {isEdit ? 'Save Changes' : 'Save Employee'}</>)}
          </button>
        </div>
      </div>
    </div>
  ), document.body);
}

/* Tiny helper so each Documents row can wire its own hidden file input
   without resorting to imperative DOM access. */
/* ═══════════════════════════════════════════════════════════════════
   EMPLOYEE DETAIL PANEL — multi-section read-only view shown when the
   row chevron is expanded. Covers Personal · Official · Salary · Leaves
   · Documents · Tasks · Subjects · Attendance · Letters.
   ═══════════════════════════════════════════════════════════════════ */
function EmployeeDetailPanel({ emp, deptName, desigName }) {
  const allow  = (emp.salaryHeads || []).filter(h => h.type === 'allow').reduce((s, h) => s + (Number(h.amount) || 0), 0);
  const deduct = (emp.salaryHeads || []).filter(h => h.type === 'deduct').reduce((s, h) => s + (Number(h.amount) || 0), 0);
  const basic  = Number(emp.basicSalary) || 0;
  const net    = basic + allow - deduct;
  const fmt    = (n) => `PKR ${Number(n || 0).toLocaleString('en-PK')}`;

  /* Prefer the names the API returns with each assignment; fall back to the
     mock class/subject lists only if no display rows are present. */
  let subjectsFlat = (emp.subjectsDisplay || [])
    .map(x => [x.className, x.sectionName, x.subjectName].filter(Boolean).join(' · '))
    .filter(Boolean);
  if (subjectsFlat.length === 0) {
    Object.entries(emp.subjects || {}).forEach(([k, arr]) => {
      const [cId, sId] = k.split('_').map(Number);
      const cls = HR_CLASS_LIST.find(c => c.id === cId);
      const sec = cls?.sections.find(s => s.id === sId);
      arr.forEach(subId => {
        const sub = HR_SUBJECT_LIST.find(x => x.id === subId);
        if (cls && sec && sub) subjectsFlat.push(`${cls.name} · ${sec.name} · ${sub.name}`);
      });
    });
  }
  const attendanceFlat = (emp.attendance || [])
    .map(a => [a.className, a.sectionName].filter(Boolean).join(' · '))
    .filter(Boolean);

  return (
    <div className="emp-detail">
      <ProfSection title="Personal Information" icon="fa-id-card">
        <ProfKv k="Full Name"        v={getFullName(emp)} />
        <ProfKv k="Father / Husband" v={emp.fn} />
        <ProfKv k="CNIC"             v={emp.cnic} />
        <ProfKv k="Date of Birth"    v={emp.dob} />
        <ProfKv k="Gender"           v={emp.gender} />
        <ProfKv k="Marital Status"   v={emp.marital} />
        <ProfKv k="Blood Group"      v={emp.blood} />
        <ProfKv k="Mobile"           v={emp.phone} />
        <ProfKv k="Email"            v={emp.email} />
        <ProfKv k="Emergency"        v={emp.emergency} />
        <ProfKv k="Nationality"      v={emp.nationality} />
        <ProfKv k="Address"          v={emp.address} span={2} />
      </ProfSection>

      <ProfSection title="Official Details" icon="fa-briefcase">
        <ProfKv k="Employee ID"      v={emp.eid} />
        <ProfKv k="Date of Joining"  v={emp.join} />
        <ProfKv k="Status"           v={emp.status} />
        <ProfKv k="Department"       v={deptName} />
        <ProfKv k="Designation"      v={desigName} />
        <ProfKv k="Employment Type"  v={emp.type} />
        <ProfKv k="Reporting To"     v={emp.manager} />
        <ProfKv k="Qualification"    v={emp.qual} />
        <ProfKv k="Experience"       v={emp.exp} />
        <ProfKv k="Shift"            v={emp.shift} />
        <ProfKv k="Country"          v={emp.country} />
        <ProfKv k="Province"         v={emp.province} />
        <ProfKv k="City"             v={emp.city} />
        <ProfKv k="Role"             v={emp.role} span={3} />
      </ProfSection>

      <ProfSection title="Salary Details" icon="fa-money-bill-wave">
        <ProfKv k="Basic Salary"   v={fmt(basic)} highlight />
        <ProfKv k="Allowances"     v={`+ ${fmt(allow)}`} highlight />
        <ProfKv k="Deductions"     v={`– ${fmt(deduct)}`} highlight />
        <ProfKv k="Net Salary"     v={fmt(net)} highlight />
        <ProfKv k="Payment Method" v={emp.payMethod} />
        <ProfKv k="Bank Name"      v={emp.bankName} />
        <ProfKv k="Bank Account"   v={emp.bankAcc} span={2} />
      </ProfSection>

      {(emp.salaryHeads || []).length > 0 && (
        <div className="emp-detail-mini">
          <div className="emp-detail-mini-title">Salary Heads</div>
          <div className="emp-detail-pills">
            {(emp.salaryHeads || []).map((h, i) => (
              <span key={i} className={`emp-detail-pill emp-detail-pill--${h.type}`}>
                {h.name} · {fmt(h.amount)}
              </span>
            ))}
          </div>
        </div>
      )}

      <ProfSection title="Leave Details" icon="fa-calendar-minus">
        <ProfKv k="Annual"        v={emp.leaves?.annual} />
        <ProfKv k="Casual"        v={emp.leaves?.casual} />
        <ProfKv k="Sick"          v={emp.leaves?.sick} />
        <ProfKv k="Maternity"     v={emp.leaves?.maternity} />
        <ProfKv k="Balance"       v={emp.leaves?.balance} />
        <ProfKv k="Policy"        v={emp.leaves?.policy} />
        <ProfKv k="Absent Ded."   v={emp.leaves?.absentDed ? fmt(emp.leaves.absentDed) : '—'} />
        <ProfKv k="Unpaid Ded."   v={emp.leaves?.unpaidDed ? fmt(emp.leaves.unpaidDed) : '—'} />
      </ProfSection>

      <div className="emp-detail-cols">
        <div className="emp-detail-col">
          <div className="emp-detail-mini-title"><i className="fa-solid fa-file-lines" aria-hidden="true"></i> Documents ({Object.keys(emp.stdDocs || {}).length + (emp.docs || []).length})</div>
          <div className="emp-detail-docs">
            {HR_DOC_SLOTS.map((slot) => {
              const doc = (emp.stdDocs || {})[slot.key];
              return (
                <div key={slot.key} className={`emp-detail-doc${doc ? ' is-up' : ''}`}>
                  <div className="emp-detail-doc-icn"><i className={`fa-solid ${slot.icon}`} aria-hidden="true"></i></div>
                  <div className="emp-detail-doc-info">
                    <div className="emp-detail-doc-name">{slot.label}</div>
                    <div className="emp-detail-doc-meta">
                      {doc ? (doc.path ? <a href={doc.path} target="_blank" rel="noreferrer">View</a> : 'Uploaded') : 'Not uploaded'}
                    </div>
                  </div>
                </div>
              );
            })}
            {(emp.docs || []).map((d, i) => (
              <div key={`c${i}`} className="emp-detail-doc is-up">
                <div className="emp-detail-doc-icn"><i className="fa-solid fa-file" aria-hidden="true"></i></div>
                <div className="emp-detail-doc-info">
                  <div className="emp-detail-doc-name">{d.name}</div>
                  <div className="emp-detail-doc-meta">{d.path ? <a href={d.path} target="_blank" rel="noreferrer">View</a> : 'Uploaded'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="emp-detail-col">
          <div className="emp-detail-mini-title"><i className="fa-solid fa-list-check" aria-hidden="true"></i> Tasks Assigned ({(emp.tasks || []).length})</div>
          {(emp.tasks || []).length === 0 ? (
            <div className="emp-detail-empty">No tasks assigned.</div>
          ) : (
            (emp.tasks || []).map((tk, i) => (
              <div className="emp-detail-task" key={i}>
                <div className="emp-detail-task-title">
                  <i className="fa-solid fa-circle-check" aria-hidden="true"></i> {tk.title}
                </div>
                <div className="emp-detail-task-meta">
                  <span className={`p-${(tk.priority || 'medium').toLowerCase()}`}>{tk.priority || 'Medium'}</span>
                  <span className={`badge ${tk.status === 'Completed' ? 'b-green' : tk.status === 'In Progress' ? 'b-warn' : 'b-gray'}`}>{tk.status || 'Pending'}</span>
                  {tk.due && <span>Due {tk.due}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="emp-detail-cols">
        <div className="emp-detail-col">
          <div className="emp-detail-mini-title"><i className="fa-solid fa-book" aria-hidden="true"></i> Subjects ({subjectsFlat.length})</div>
          {subjectsFlat.length === 0 ? (
            <div className="emp-detail-empty">No subjects assigned.</div>
          ) : (
            <div className="emp-detail-pills">
              {subjectsFlat.map((label, i) => (
                <span key={i} className="emp-detail-pill emp-detail-pill--subj">{label}</span>
              ))}
            </div>
          )}
        </div>
        <div className="emp-detail-col">
          <div className="emp-detail-mini-title"><i className="fa-solid fa-calendar-check" aria-hidden="true"></i> Attendance Classes ({attendanceFlat.length})</div>
          {attendanceFlat.length === 0 ? (
            <div className="emp-detail-empty">No attendance classes assigned.</div>
          ) : (
            <div className="emp-detail-pills">
              {attendanceFlat.map((label, i) => (
                <span key={i} className="emp-detail-pill emp-detail-pill--att">{label}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="emp-detail-col">
        <div className="emp-detail-mini-title"><i className="fa-solid fa-envelope" aria-hidden="true"></i> Letters Issued ({(emp.letters || []).length})</div>
        {(emp.letters || []).length === 0 ? (
          <div className="emp-detail-empty">No letters issued.</div>
        ) : (
          <div className="emp-detail-letters">
            {(emp.letters || []).map((lt, i) => (
              <div key={i} className="emp-detail-letter">
                <div className="emp-detail-letter-l">
                  <i className="fa-solid fa-envelope-open-text" aria-hidden="true"></i>
                  <div>
                    <div className="emp-detail-letter-title">{lt.label}</div>
                    <div className="emp-detail-letter-meta">Ref · {lt.ref} · {lt.date}</div>
                  </div>
                </div>
                <span className="emp-detail-letter-style">{lt.style === 'bw' ? 'B&W' : 'Color'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* Small KV helpers used by EmployeeDetailPanel above. */
function ProfSection({ title, icon, children }) {
  return (
    <div className="prof-section">
      <div className="prof-section-title"><i className={`fa-solid ${icon}`} aria-hidden="true"></i> {title}</div>
      <div className="prof-kv-grid">{children}</div>
    </div>
  );
}
function ProfKv({ k, v, span, highlight }) {
  return (
    <div className={`prof-kv${highlight ? ' is-hl' : ''}`} style={span ? { gridColumn: `span ${span}` } : undefined}>
      <div className="prof-kv-k">{k}</div>
      <div className="prof-kv-v">{v || '—'}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MARK INACTIVE MODAL — amber-accented modal with Reason, Effective
   Date, Notes. Mirrors #inactOv in the HTML reference.
   ═══════════════════════════════════════════════════════════════════ */
function MarkInactiveModal({ emp, onClose, onConfirm }) {
  const today = new Date().toISOString().slice(0, 10);
  const [reason, setReason] = useState('Resignation');
  const [date,   setDate]   = useState(today);
  const [notes,  setNotes]  = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return createPortal((
    <div
      className="ov open"
      role="dialog" aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal">
        <div className="modal-head">
          <div className="modal-head-left">
            <div className="modal-head-icon" style={{ background: 'rgba(217,119,6,.12)', color: '#D97706' }}>
              <i className="fa-solid fa-user-slash" aria-hidden="true"></i>
            </div>
            <div>
              <div className="modal-title" style={{ color: '#D97706' }}>Mark Employee Inactive</div>
              <div className="modal-sub">{getFullName(emp)} · {emp.eid}</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>
        <div className="modal-body">
          <div className="info-banner warning">
            <div className="info-banner-icon"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i></div>
            <div className="info-banner-body">
              <div className="info-banner-title">Employee Departure</div>
              <div className="info-banner-text">This employee will move to the <strong>Inactive Employees</strong> tab. Edit, ID Card generation and Task Assignment will be disabled. Post-employment letters (Experience, Character Certificate, Service Certificate, etc.) will become available.</div>
            </div>
          </div>
          <div className="f-row">
            <div className="f-group">
              <label className="f-label">Reason for Inactivation <span className="req">*</span></label>
              <select className="f-select2" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option>Resignation</option><option>Termination</option><option>Retirement</option>
                <option>Contract Ended</option><option>End of Service</option><option>Prolonged Leave</option>
                <option>Other</option>
              </select>
            </div>
            <div className="f-group">
              <label className="f-label">Effective Date <span className="req">*</span></label>
              <input type="date" className="f-input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="f-group">
            <label className="f-label">Optional Notes</label>
            <textarea className="f-textarea" placeholder="Additional notes about the departure…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            style={{ background: 'linear-gradient(135deg,#B45309,#D97706)', boxShadow: '0 4px 14px rgba(217,119,6,.35)' }}
            onClick={() => onConfirm({ id: emp.id, name: getFullName(emp), reason, date, notes })}
          >
            <i className="fa-solid fa-user-slash" aria-hidden="true"></i> Mark Inactive
          </button>
        </div>
      </div>
    </div>
  ), document.body);
}

/* ═══════════════════════════════════════════════════════════════════
   STAFF ID CARD MODAL — Vertical/Horizontal picker → live card preview.
   ═══════════════════════════════════════════════════════════════════ */
function StaffIdCardModal({ emp, deptName, desigName, onClose }) {
  const [layout, setLayout] = useState('v');     // 'v' | 'h'
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const fullName = getFullName(emp);
  const ini = fullName.split(' ').filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 2) || '?';
  const session = `${new Date().getFullYear()} – ${new Date().getFullYear() + 1}`;
  const validity = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return createPortal((
    <div
      className="idc-overlay open"
      role="dialog" aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="idc-box">
        <div className="rp-head">
          <div>
            <div className="rp-title">{generated ? 'Staff ID Card' : 'Generate Staff ID Card'}</div>
            <div className="rp-sub">For: {fullName}</div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        {!generated ? (
          <>
            <div className="idc-grid">
              <div className={`idc-card${layout === 'v' ? ' sel' : ''}`} onClick={() => setLayout('v')}>
                <div className="idc-vert">
                  <div className="idc-ph-r"></div>
                  <div style={{ textAlign: 'center' }}>
                    <div className="idc-line" style={{ width: 60, margin: '0 auto 3px' }}></div>
                    <div className="idc-line2" style={{ margin: '0 auto 2px' }}></div>
                    <div className="idc-line3" style={{ margin: '0 auto' }}></div>
                  </div>
                </div>
                <div className="idc-label">Vertical Card</div>
                <div className="idc-sub">Portrait orientation</div>
              </div>
              <div className={`idc-card${layout === 'h' ? ' sel' : ''}`} onClick={() => setLayout('h')}>
                <div className="idc-horiz">
                  <div className="idc-ph"></div>
                  <div style={{ flex: 1 }}>
                    <div className="idc-line" style={{ width: '80%' }}></div>
                    <div className="idc-line2"></div>
                    <div className="idc-line3"></div>
                  </div>
                </div>
                <div style={{ height: 40, background: 'rgba(30,64,175,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 22, height: 22, background: 'rgba(30,58,138,.3)', borderRadius: 3 }}></div>
                </div>
                <div className="idc-label">Horizontal Card</div>
                <div className="idc-sub">Landscape orientation</div>
              </div>
            </div>
            <div className="idc-foot">
              <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
              <button type="button" className="btn-primary" style={{ flex: 2 }} onClick={() => setGenerated(true)}>
                <i className="fa-solid fa-id-card" aria-hidden="true"></i> Generate
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="idc-preview" id="idc-print-root">
              {layout === 'v' ? (
                <>
                  <div className="idc-render idc-render--v">
                    <div className="idc-r-head">
                      <div className="idc-r-logo"><i className="fa-solid fa-school"></i></div>
                      <div className="idc-r-school">SCHOOL MENTOR</div>
                      <div className="idc-r-tag">Staff Identification</div>
                    </div>
                    <div className="idc-r-photo-v">
                      {emp.photo ? <img src={emp.photo} alt="" /> : <span>{ini}</span>}
                    </div>
                    <div className="idc-r-name">{fullName}</div>
                    <div className="idc-r-desig">{desigName}</div>
                    <div className="idc-r-kv">
                      <div><span>ID</span><b>{emp.eid}</b></div>
                      <div><span>Dept</span><b>{deptName}</b></div>
                      <div><span>Phone</span><b>{emp.phone || '—'}</b></div>
                      <div><span>Blood</span><b>{emp.blood || '—'}</b></div>
                    </div>
                    <div className="idc-r-foot">
                      <div className="idc-r-qr"><i className="fa-solid fa-qrcode"></i></div>
                      <div className="idc-r-validity">Session {session}<br /><small>Valid till {validity}</small></div>
                    </div>
                  </div>
                  <div className="idc-render idc-render--v idc-render--back">
                    <div className="idc-r-head idc-r-head--back">
                      <div className="idc-r-school">SCHOOL MENTOR</div>
                      <div className="idc-r-tag">If found, please return</div>
                    </div>
                    <div className="idc-r-back-body">
                      <p>This card is the property of School Mentor Academy. Please return it to the principal's office on resignation or termination.</p>
                      <div className="idc-r-back-kv">
                        <div><span>Address</span><b>Sector G-9, Islamabad</b></div>
                        <div><span>Phone</span><b>+92 51 0000 000</b></div>
                        <div><span>Email</span><b>admin@schoolmentor.app</b></div>
                      </div>
                      <div className="idc-r-sign">
                        <div className="idc-r-sign-line" />
                        <div className="idc-r-sign-lbl">Principal Signature</div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="idc-render idc-render--h">
                    <div className="idc-r-h-left">
                      <div className="idc-r-photo-h">
                        {emp.photo ? <img src={emp.photo} alt="" /> : <span>{ini}</span>}
                      </div>
                    </div>
                    <div className="idc-r-h-right">
                      <div className="idc-r-h-school"><i className="fa-solid fa-school"></i> SCHOOL MENTOR</div>
                      <div className="idc-r-name">{fullName}</div>
                      <div className="idc-r-desig">{desigName} · {deptName}</div>
                      <div className="idc-r-kv idc-r-kv--h">
                        <div><span>ID</span><b>{emp.eid}</b></div>
                        <div><span>Phone</span><b>{emp.phone || '—'}</b></div>
                        <div><span>Session</span><b>{session}</b></div>
                      </div>
                    </div>
                    <div className="idc-r-h-qr"><i className="fa-solid fa-qrcode"></i></div>
                  </div>
                  <div className="idc-render idc-render--h idc-render--back">
                    <div className="idc-r-back-body">
                      <div className="idc-r-tag">If found, please return</div>
                      <p>This card is the property of School Mentor Academy.</p>
                      <div className="idc-r-back-kv">
                        <div><span>Address</span><b>Sector G-9, Islamabad</b></div>
                        <div><span>Phone</span><b>+92 51 0000 000</b></div>
                      </div>
                      <div className="idc-r-sign">
                        <div className="idc-r-sign-line" />
                        <div className="idc-r-sign-lbl">Principal Signature</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="idc-foot">
              <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setGenerated(false)}>
                <i className="fa-solid fa-arrow-left" aria-hidden="true"></i> Back
              </button>
              <button type="button" className="btn-primary" style={{ flex: 2 }} onClick={() => window.print()}>
                <i className="fa-solid fa-print" aria-hidden="true"></i> Print / Save PDF
              </button>
            </div>
          </>
        )}
      </div>
      <style>{ID_PRINT_CSS}</style>
    </div>
  ), document.body);
}

const ID_PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #idc-print-root, #idc-print-root * { visibility: visible !important; }
  #idc-print-root {
    position: fixed !important; inset: 0 !important;
    margin: 0 !important; padding: 24px !important;
    background: #fff !important; box-shadow: none !important;
    max-width: none !important;
  }
}
`;

/* ═══════════════════════════════════════════════════════════════════
   LETTER GENERATOR MODAL — 1:1 port of #letterOv from the HTML.

   Layout: full-width modal (max-width 1100px, 94vh tall) with a 340px
   left settings sidebar and a right A4 live preview pane.
     • 16 letter templates with {name}/{designation}/{department}/
       {school}/{joinDate}/{inactiveDate}/{serviceDuration}/{cnic}
       token substitution
     • Status-aware template list: 10 Active letters vs 9 Inactive ones
     • Optional Principal / Director / HR signature toggles
     • Colorful / Colorless style toggle (sheet gets grayscale filter)
     • Logo upload (data-url)
   ═══════════════════════════════════════════════════════════════════ */

const ACTIVE_LETTERS = [
  'Offer Letter', 'Appointment Letter', 'Confirmation Letter', 'Appreciation Letter',
  'Warning Letter', 'Show Cause Notice', 'Promotion Letter', 'Transfer Letter',
  'Salary Revision Letter', 'Custom Letter',
];
const INACTIVE_LETTERS = [
  'Experience Letter', 'Character Certificate', 'Relieving Letter', 'Service Certificate',
  'Final Settlement Letter', 'Employment Verification Letter', 'Recommendation Letter',
  'Appreciation Letter', 'Custom Letter',
];

const LETTER_TEMPLATES = {
  'Offer Letter': {
    subject: 'Offer of Employment',
    content: 'Dear {name},\n\nWe are pleased to offer you the position of {designation} in the {department} department at {school}.\n\nYour expertise and experience will be a valuable addition to our team. We trust that you will find this opportunity rewarding and fulfilling.\n\nThe terms and conditions of your employment will be discussed during your induction. Please confirm your acceptance of this offer at your earliest convenience.\n\nWe look forward to welcoming you to our institution.',
  },
  'Appointment Letter': {
    subject: 'Letter of Appointment',
    content: 'Dear {name},\n\nFurther to your application and the subsequent interview process, we are pleased to confirm your appointment as {designation} in the {department} department, effective from {joinDate}.\n\nYour role will involve responsibilities aligned with your designation, and you will report to your assigned line manager. We are confident that your skills and dedication will contribute significantly to our institutional goals.\n\nWelcome to {school}. We wish you a successful and rewarding career with us.',
  },
  'Confirmation Letter': {
    subject: 'Confirmation of Employment',
    content: 'Dear {name},\n\nWe are pleased to confirm your employment as {designation} in the {department} department, following the successful completion of your probationary period.\n\nYour performance, commitment, and conduct have met our expectations. You will now enjoy all the benefits and entitlements as per institutional policy.\n\nWe look forward to your continued contributions and wish you success in your role.',
  },
  'Appreciation Letter': {
    subject: 'Letter of Appreciation',
    content: 'Dear {name},\n\nOn behalf of {school}, we would like to express our sincere appreciation for your outstanding contributions as {designation}.\n\nYour dedication, professionalism, and commitment to excellence have not gone unnoticed and have positively impacted both our students and your colleagues.\n\nPlease accept this letter as a token of our gratitude. Keep up the excellent work!',
  },
  'Warning Letter': {
    subject: 'Official Warning',
    content: 'Dear {name},\n\nThis letter serves as an official warning regarding your recent conduct/performance as {designation} in the {department} department.\n\nDespite previous verbal discussions, the following issues have not been adequately addressed:\n• [Specify issue 1]\n• [Specify issue 2]\n\nYou are required to take immediate corrective action. Failure to demonstrate improvement may result in further disciplinary measures.\n\nWe trust that you will address these concerns promptly and professionally.',
  },
  'Show Cause Notice': {
    subject: 'Show Cause Notice',
    content: 'Dear {name},\n\nYou are hereby called upon to show cause within seven (7) working days from the receipt of this notice as to why disciplinary action should not be taken against you for the following alleged misconduct:\n\n[Specify the alleged misconduct in detail]\n\nYour written response, supported by any relevant evidence, must reach the HR Department by the stipulated deadline. Failure to respond within the given timeframe will result in disciplinary proceedings being initiated in your absence.',
  },
  'Termination Letter': {
    subject: 'Notice of Termination',
    content: 'Dear {name},\n\nThis is to inform you that your services as {designation} in the {department} department stand terminated with effect from [Effective Date], pursuant to the terms of your contract and the institutional policy.\n\nPlease ensure completion of all handover formalities and return of institutional property prior to your departure. The HR department will issue your final settlement and any applicable post-employment certificates.\n\nWe wish you well in your future endeavours.',
  },
  'Promotion Letter': {
    subject: 'Letter of Promotion',
    content: 'Dear {name},\n\nWe are pleased to inform you that, in recognition of your outstanding performance and dedication, you are being promoted to the position of [New Designation] in the {department} department, effective [Effective Date].\n\nAlong with your new role, you will be entitled to a revised remuneration package and additional responsibilities, which will be communicated to you separately.\n\nWe congratulate you on this well-deserved achievement and look forward to your continued excellence.',
  },
  'Transfer Letter': {
    subject: 'Letter of Transfer',
    content: 'Dear {name},\n\nThis is to inform you that, in the interest of the institution, you are being transferred from your current position as {designation} in the {department} department to [New Department / Branch / Location], effective [Effective Date].\n\nYour terms of service, salary structure, and seniority will remain unchanged. You are requested to complete handover formalities at your current posting and report at the new location on the effective date.\n\nWe wish you the best in your new assignment.',
  },
  'Salary Revision Letter': {
    subject: 'Salary Revision',
    content: 'Dear {name},\n\nWe are pleased to inform you that your salary has been revised in recognition of your contributions and in line with our annual review policy.\n\nYour revised gross monthly salary will be PKR [New Amount], effective [Effective Date]. The detailed breakdown of allowances and deductions is attached separately.\n\nWe appreciate your dedicated service and look forward to your continued contributions to {school}.',
  },
  'Experience Letter': {
    subject: 'Letter of Experience',
    content: 'TO WHOM IT MAY CONCERN\n\nThis is to certify that {name} (CNIC: {cnic}) served at {school} in the capacity of {designation} in the {department} department from {joinDate} to {inactiveDate}.\n\nDuring this tenure, the employee demonstrated professional integrity, dedication, and competence. We found their conduct to be exemplary and their work satisfactory.\n\nWe wish them every success in their future career.',
  },
  'Character Certificate': {
    subject: 'Character Certificate',
    content: 'TO WHOM IT MAY CONCERN\n\nThis is to certify that {name} (CNIC: {cnic}) has been associated with {school} as {designation} from {joinDate} to {inactiveDate}.\n\nDuring this period, we found their character, conduct, and behaviour to be above reproach. They maintained excellent relations with colleagues, students, and management.\n\nWe have no hesitation in recommending them, and we wish them success in all their future endeavours.',
  },
  'Relieving Letter': {
    subject: 'Relieving Letter',
    content: 'Dear {name},\n\nThis is to confirm that you have been relieved from your duties as {designation} in the {department} department at {school}, effective {inactiveDate}.\n\nAll your dues have been settled and the handover formalities have been duly completed. We acknowledge your services and thank you for your contributions.\n\nWe wish you success in your future endeavours.',
  },
  'Service Certificate': {
    subject: 'Certificate of Service',
    content: 'TO WHOM IT MAY CONCERN\n\nThis is to certify that {name} (CNIC: {cnic}) was employed at {school} as {designation} in the {department} department from {joinDate} to {inactiveDate}, a total service period of {serviceDuration}.\n\nDuring this period, the employee performed their duties to the satisfaction of the institution and contributed positively to our academic and administrative goals.\n\nThis certificate is issued at the request of the employee for whatever purpose it may serve.',
  },
  'Final Settlement Letter': {
    subject: 'Final Settlement Statement',
    content: 'Dear {name},\n\nWith reference to your separation from {school} effective {inactiveDate}, please find below the summary of your final settlement:\n\n• Final Salary: PKR [Amount]\n• Leave Encashment: PKR [Amount]\n• Gratuity / End-of-Service Benefits: PKR [Amount]\n• Less: Outstanding Recoveries: PKR [Amount]\n• Net Settlement: PKR [Amount]\n\nThe net amount has been credited to your registered bank account. Kindly acknowledge receipt of this letter and the settlement amount.\n\nWe wish you the best in your future endeavours.',
  },
  'Employment Verification Letter': {
    subject: 'Employment Verification',
    content: 'TO WHOM IT MAY CONCERN\n\nThis is to verify that {name} (CNIC: {cnic}) was employed at {school} as {designation} in the {department} department from {joinDate} to {inactiveDate}.\n\nThis verification is being issued at the request of the individual named above. Should you require any further information, please feel free to contact the HR Department of {school}.\n\nSincerely,',
  },
  'Recommendation Letter': {
    subject: 'Letter of Recommendation',
    content: 'TO WHOM IT MAY CONCERN\n\nIt is my pleasure to recommend {name}, who worked with us at {school} as {designation} from {joinDate} to {inactiveDate}.\n\nDuring this period, they consistently demonstrated strong professional skills, dedication, and a collaborative spirit. Their contributions to our institution were valuable, and they earned the respect of colleagues and supervisors alike.\n\nI strongly recommend them for any role that requires expertise, integrity, and commitment. They will be a valuable asset to any organisation.',
  },
  'Custom Letter': {
    subject: '',
    content: 'Dear {name},\n\n[Type your custom letter content here]\n\nKind regards,',
  },
};

function fillLetterTemplate(tpl, e, deptName, desigName, schoolName) {
  return (tpl || '')
    .replace(/\{name\}/g,            getFullName(e))
    .replace(/\{designation\}/g,     desigName || '—')
    .replace(/\{department\}/g,      deptName || '—')
    .replace(/\{school\}/g,          schoolName || 'School Mentor')
    .replace(/\{joinDate\}/g,        fmtDate(e.join))
    .replace(/\{inactiveDate\}/g,    fmtDate(e.inactiveDate) || '[Inactive Date]')
    .replace(/\{serviceDuration\}/g, empSvcDuration(e))
    .replace(/\{cnic\}/g,            e.cnic || '—');
}

function LetterModal({ emp, deptName, desigName, onClose, onIssue, toast }) {
  const isInactive = emp.status !== 'Active';
  const templateNames = isInactive ? INACTIVE_LETTERS : ACTIVE_LETTERS;
  const defaultType   = isInactive ? 'Experience Letter' : 'Appointment Letter';

  const today = new Date().toISOString().slice(0, 10);
  const initialRef = `HR/${new Date().getFullYear()}/${String(((emp.letters || []).length + 1)).padStart(4, '0')}`;

  /* ── Settings state ── */
  const [type,         setType]        = useState(defaultType);
  const [letterDate,   setLetterDate]  = useState(today);
  const [ref,          setRef]         = useState(initialRef);
  const [subject,      setSubject]     = useState('');
  const [content,      setContent]     = useState('');
  const [issuedBy,     setIssuedBy]    = useState('HR Department');
  const [schoolName,   setSchoolName]  = useState('School Mentor');
  const [schoolAddr,   setSchoolAddr]  = useState('Islamabad, Pakistan');
  const [logoName,     setLogoName]    = useState('Upload Logo');
  const [logoData,     setLogoData]    = useState('');
  const [sigP,         setSigP]        = useState(true);
  const [sigD,         setSigD]        = useState(false);
  const [sigH,         setSigH]        = useState(true);
  const [style,        setStyle]       = useState('color');
  const logoRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  /* Template apply — populates subject + content on first mount and on
     every type change. Keeps the school-name token live by re-filling
     whenever it changes too. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const tpl = LETTER_TEMPLATES[type] || LETTER_TEMPLATES['Custom Letter'];
    setSubject(tpl.subject ? fillLetterTemplate(tpl.subject, emp, deptName, desigName, schoolName) : '');
    setContent(fillLetterTemplate(tpl.content, emp, deptName, desigName, schoolName));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const onLogoPick = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { setLogoData(e.target.result); setLogoName(file.name); };
    reader.readAsDataURL(file);
  };

  const styleBtn = (key) => key === style
    ? { justifyContent: 'center', borderColor: '#1E3A8A', background: '#DBEAFE', color: '#1E3A8A' }
    : { justifyContent: 'center', borderColor: '#BFDBFE' };

  const sigs = [];
  if (sigP) sigs.push({ title: 'Principal',  sub: `For & on behalf of ${schoolName || 'School Mentor'}` });
  if (sigD) sigs.push({ title: 'Director',   sub: 'Board of Governors' });
  if (sigH) sigs.push({ title: 'HR Manager', sub: 'Human Resource Dept.' });
  if (sigs.length === 0) sigs.push({ title: 'Authorized Signatory', sub: schoolName || 'School Mentor' });

  const issue = () => {
    if (!subject.trim()) { toast('Subject is required', 'error'); return; }
    if (!content.trim()) { toast('Letter content is required', 'error'); return; }
    onIssue({
      id:        `letter-${Date.now()}`,
      type,
      label:     type,
      subject:   subject.trim(),
      content:   content.trim(),
      date:      letterDate,
      ref:       ref.trim(),
      issuedBy:  issuedBy.trim() || 'HR Department',
      sigPrincipal: sigP,
      sigDirector:  sigD,
      sigHR:        sigH,
      style,
      schoolName,
      schoolAddr,
      logo:      logoData,
    });
    onClose();
  };

  return createPortal((
    <div
      className="ov open"
      role="dialog" aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal letter-modal" style={{ display: 'flex', flexDirection: 'column', height: '94vh', maxHeight: '94vh' }}>
        <div className="modal-head">
          <div className="modal-head-left">
            <div className="modal-head-icon"><i className="fa-solid fa-envelope-open-text" aria-hidden="true"></i></div>
            <div>
              <div className="modal-title">Issue Letter</div>
              <div className="modal-sub">
                For: {getFullName(emp)}{isInactive ? '  (Post-employment letters)' : '  (Active employee)'}
              </div>
            </div>
          </div>
          <Tooltip text="Close">
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>

        <div className="modal-body" style={{ padding: 0, flex: '1 1 0', minHeight: 0, height: 0, overflow: 'hidden' }}>
          <div className="letter-layout">
            {/* ─── LEFT: Settings ─── */}
            <div className="letter-settings">
              <div className="letter-settings-title"><i className="fa-solid fa-sliders" aria-hidden="true"></i> Letter Settings</div>
              <div className="f-group">
                <label className="f-label">Letter Type <span className="req">*</span></label>
                <select className="f-select2" value={type} onChange={(e) => setType(e.target.value)}>
                  {templateNames.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="f-group">
                <label className="f-label">Letter Date <span className="req">*</span></label>
                <input type="date" className="f-input" value={letterDate} onChange={(e) => setLetterDate(e.target.value)} />
              </div>
              <div className="f-group">
                <label className="f-label">Reference No.</label>
                <input className="f-input" placeholder="e.g. HR/2026/001" value={ref} onChange={(e) => setRef(e.target.value)} />
              </div>
              <div className="f-group">
                <label className="f-label">Subject <span className="req">*</span></label>
                <input className="f-input" placeholder="Letter subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="f-group">
                <label className="f-label">Letter Content <span className="req">*</span></label>
                <textarea className="f-textarea" placeholder="Type letter content…" value={content} onChange={(e) => setContent(e.target.value)} style={{ minHeight: 120 }} />
              </div>
              <div className="f-group">
                <label className="f-label">Issued By</label>
                <input className="f-input" placeholder="e.g. HR Manager" value={issuedBy} onChange={(e) => setIssuedBy(e.target.value)} />
              </div>

              <div className="letter-settings-title" style={{ marginTop: 14 }}><i className="fa-solid fa-school" aria-hidden="true"></i> School Identity</div>
              <div className="f-group">
                <label className="f-label">School Name</label>
                <input className="f-input" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
              </div>
              <div className="f-group">
                <label className="f-label">School Address</label>
                <input className="f-input" value={schoolAddr} onChange={(e) => setSchoolAddr(e.target.value)} />
              </div>
              <div className="f-group">
                <label className="f-label">School Logo</label>
                <input
                  ref={logoRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => onLogoPick(e.target.files?.[0])}
                />
                <button
                  type="button"
                  className="btn-edit"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => logoRef.current?.click()}
                >
                  <i className="fa-solid fa-upload" aria-hidden="true"></i> <span>{logoName}</span>
                </button>
              </div>

              <div className="letter-settings-title" style={{ marginTop: 14 }}><i className="fa-solid fa-signature" aria-hidden="true"></i> Signatures</div>
              <div className="sig-toggle-row">
                <label><input type="checkbox" checked={sigP} onChange={(e) => setSigP(e.target.checked)} /> Principal Signature</label>
              </div>
              <div className="sig-toggle-row">
                <label><input type="checkbox" checked={sigD} onChange={(e) => setSigD(e.target.checked)} /> Director Signature</label>
              </div>
              <div className="sig-toggle-row">
                <label><input type="checkbox" checked={sigH} onChange={(e) => setSigH(e.target.checked)} /> HR Signature</label>
              </div>

              <div className="letter-settings-title" style={{ marginTop: 14 }}><i className="fa-solid fa-palette" aria-hidden="true"></i> Style</div>
              <div className="f-row" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button type="button" className="btn-edit" style={styleBtn('color')} onClick={() => setStyle('color')}>
                  <i className="fa-solid fa-palette" aria-hidden="true"></i> Colorful
                </button>
                <button type="button" className="btn-edit" style={styleBtn('bw')} onClick={() => setStyle('bw')}>
                  <i className="fa-solid fa-print" aria-hidden="true"></i> Colorless
                </button>
              </div>
            </div>

            {/* ─── RIGHT: A4 live preview ─── */}
            <div className="letter-preview-wrap">
              <div className="letter-preview-toolbar">
                <span className="letter-zoom-pill"><i className="fa-solid fa-file" aria-hidden="true"></i> A4 Preview</span>
                <span className="letter-zoom-pill">
                  <i className={`fa-solid ${style === 'color' ? 'fa-palette' : 'fa-print'}`} aria-hidden="true"></i>
                  {' '}{style === 'color' ? 'Colorful' : 'Colorless'}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--tm)', fontWeight: 600 }}>Live updates as you type</span>
              </div>

              <div id="letter-print-root">
                <div className={`letter-sheet${style === 'bw' ? ' colorless' : ''}`}>
                  <div className="letter-sheet-head">
                    <div className="letter-sheet-logo">
                      {logoData
                        ? <img src={logoData} alt="" />
                        : <i className="fa-solid fa-graduation-cap" aria-hidden="true"></i>}
                    </div>
                    <div className="letter-sheet-school">
                      <div className="letter-sheet-school-name">{schoolName || 'School Mentor'}</div>
                      <div className="letter-sheet-school-addr">{schoolAddr || ''}</div>
                    </div>
                    <div className="letter-sheet-ref">
                      {ref && <div><strong>Ref:</strong> {ref}</div>}
                      <div style={{ marginTop: 2 }}>{type}</div>
                    </div>
                  </div>
                  <div className="letter-sheet-meta">
                    <div className="letter-sheet-to">
                      To,<strong>{getFullName(emp)}</strong>
                      {emp.eid && <div>Employee ID: {emp.eid}</div>}
                      {desigName && <div>{desigName}, {deptName}</div>}
                    </div>
                    <div className="letter-sheet-date">
                      <span>Date</span>{fmtDate(letterDate) || '—'}
                    </div>
                  </div>
                  {subject && <div className="letter-sheet-subject">Subject: {subject}</div>}
                  <div className="letter-sheet-body">{content}</div>
                  <div className="letter-sheet-sign-row">
                    {sigs.map((s, i) => (
                      <div className="letter-sheet-sign" key={i}>
                        <div className="letter-sheet-sign-line">
                          {s.title}<span>{s.sub}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="letter-sheet-foot">
                    This letter is system-generated by {schoolName || 'School Mentor'} HR.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-secondary" onClick={() => window.print()}>
            <i className="fa-solid fa-print" aria-hidden="true"></i> Print
          </button>
          <button type="button" className="btn-primary" onClick={issue}>
            <i className="fa-solid fa-check" aria-hidden="true"></i> Issue &amp; Save Letter
          </button>
        </div>
      </div>
      <style>{LETTER_PRINT_CSS}</style>
    </div>
  ), document.body);
}

const LETTER_PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #letter-print-root, #letter-print-root * { visibility: visible !important; }
  #letter-print-root {
    position: fixed !important; inset: 0 !important;
    margin: 0 auto !important; padding: 24px !important;
    background: #fff !important; box-shadow: none !important;
    max-width: 100% !important;
  }
  #letter-print-root .letter-sheet { box-shadow: none !important; border-radius: 0 !important; }
}
`;


/* ═══════════════════════════════════════════════════════════════════
   PROFILE REPORT — 1:1 port of the #reportOv viewer from
   "Human Resource .html".  Mirrors the dark backdrop, white sheet,
   numbered sections, Colorful / Colorless toolbar buttons and
   `.report-sheet.colorless` grayscale switch.

   Sections (matching the HTML):
     1. Employee Overview
     2. Personal Information
     3. Official Details
     4. Salary Details
     5. Leave Details
     6. Task Assignments
     7. Subject Assignments
     8. Class Attendance Assignments
     9. Issued Letters History
    10. Employment History & Status
    11. Financial Summary & Clearance
    12. Documents Summary
   ═══════════════════════════════════════════════════════════════════ */

const RPT_DOC_META = [
  { key: 'cnic',       name: 'CNIC',                 icon: 'fa-id-card' },
  { key: 'degree',     name: 'Degree / Certificate', icon: 'fa-graduation-cap' },
  { key: 'experience', name: 'Experience Letter',    icon: 'fa-briefcase' },
  { key: 'contract',   name: 'Contract',             icon: 'fa-file-signature' },
  { key: 'resume',     name: 'Resume / CV',          icon: 'fa-file-lines' },
];

function defaultFinancial() {
  return {
    salaryAdvance: 0,
    loanBalance: 0,
    securityDepositApplicable: false,
    securityDeposit: 0,
    securityDepositReturned: 0,
    otherRecoveries: 0,
    finalSettlement: 'pending',
    clearanceStatus:  'pending',
  };
}

function empSvcDuration(e) {
  if (!e.join) return '—';
  const endDate = (e.status !== 'Active' && e.inactiveDate) ? new Date(e.inactiveDate) : new Date();
  const j = new Date(e.join);
  if (isNaN(j) || isNaN(endDate)) return '—';
  let y = endDate.getFullYear() - j.getFullYear();
  let m = endDate.getMonth() - j.getMonth();
  let d = endDate.getDate() - j.getDate();
  if (d < 0) { m--; const prev = new Date(endDate.getFullYear(), endDate.getMonth(), 0); d += prev.getDate(); }
  if (m < 0) { y--; m += 12; }
  if (y < 0) return '—';
  const parts = [];
  if (y > 0)             parts.push(`${y} Year${y !== 1 ? 's' : ''}`);
  if (m > 0 || y > 0)    parts.push(`${m} Month${m !== 1 ? 's' : ''}`);
  parts.push(`${d} Day${d !== 1 ? 's' : ''}`);
  return parts.join(' ');
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ProfileReportModal({ emp, deptName, desigName, onClose }) {
  const [style, setStyle] = useState('color');     // 'color' | 'bw'

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const fullName = getFullName(emp);
  const ini = fullName.split(' ').filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 2) || '?';
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  /* Aggregated state */
  const tasks      = emp.tasks      || [];
  const letters    = emp.letters    || [];
  const docs       = emp.docs       || [];
  const stdDocs    = emp.stdDocs    || {};
  const subjMap    = emp.subjects   || {};
  const attCls     = emp.attendance || [];

  const allowTotal  = (emp.salaryHeads || []).filter(h => h.type === 'allow').reduce((s, h) => s + (Number(h.amount) || 0), 0);
  const deductTotal = (emp.salaryHeads || []).filter(h => h.type === 'deduct').reduce((s, h) => s + (Number(h.amount) || 0), 0);
  const basicNum    = Number(emp.basicSalary) || 0;
  const netSalary   = basicNum + allowTotal - deductTotal;

  /* Flatten subject + attendance maps using the seed lists */
  /* Prefer the API's assignment names; fall back to the mock lists. */
  let subjItems = (emp.subjectsDisplay || []).map(x => ({ cls: x.className, sec: x.sectionName, sub: x.subjectName }));
  if (subjItems.length === 0) {
    Object.keys(subjMap).forEach(key => {
      const [cId, sId] = key.split('_').map(Number);
      const cls = HR_CLASS_LIST.find(c => c.id === cId);
      const sec = cls?.sections.find(s => s.id === sId);
      (subjMap[key] || []).forEach(sid => {
        const sub = HR_SUBJECT_LIST.find(x => x.id === sid);
        if (cls && sec && sub) subjItems.push({ cls: cls.name, sec: sec.name, sub: sub.name });
      });
    });
  }
  const attItems = (attCls || []).map(a => ({ cls: a.className, sec: a.sectionName }));

  const f = emp.financial || defaultFinancial();
  const depOut = f.securityDepositApplicable
    ? ((Number(f.securityDeposit) || 0) - (Number(f.securityDepositReturned) || 0))
    : 0;
  const netPosition = depOut - ((Number(f.salaryAdvance) || 0) + (Number(f.loanBalance) || 0) + (Number(f.otherRecoveries) || 0));

  const isActive = emp.status === 'Active';
  const statusBg     = isActive ? 'rgba(22,163,74,.12)' : 'rgba(217,119,6,.14)';
  const statusFg     = isActive ? '#16A34A' : '#D97706';
  const statusBorder = isActive ? 'rgba(22,163,74,.3)' : 'rgba(217,119,6,.3)';

  const num = (n) => Number(n || 0).toLocaleString('en-US');

  return createPortal((
    <div className="report-ov open" role="dialog" aria-modal="true">
      {/* Top toolbar */}
      <div className="report-toolbar">
        <div className="report-toolbar-left">
          <Tooltip text="Close">
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </Tooltip>
          <div>
            <div className="report-toolbar-title">Employee Profile Report</div>
            <div className="report-toolbar-sub">For: {fullName} · {emp.eid}</div>
          </div>
        </div>
        <div className="report-toolbar-right">
          <button
            type="button"
            className="btn-edit"
            onClick={() => setStyle('color')}
            style={style === 'color'
              ? { borderColor: '#1E3A8A', background: '#DBEAFE', color: '#1E3A8A' }
              : { borderColor: '#BFDBFE' }}
          >
            <i className="fa-solid fa-palette" aria-hidden="true"></i> Colorful
          </button>
          <button
            type="button"
            className="btn-edit"
            onClick={() => setStyle('bw')}
            style={style === 'bw'
              ? { borderColor: '#1E3A8A', background: '#DBEAFE', color: '#1E3A8A' }
              : { borderColor: '#BFDBFE' }}
          >
            <i className="fa-solid fa-print" aria-hidden="true"></i> Colorless
          </button>
          <button type="button" className="btn-primary" onClick={() => window.print()}>
            <i className="fa-solid fa-print" aria-hidden="true"></i> Print / Save PDF
          </button>
        </div>
      </div>

      {/* Scrollable sheet */}
      <div className="report-scroll">
        <div
          className={`report-sheet${style === 'bw' ? ' colorless' : ''}`}
          id="report-print-root"
        >
          {/* ─── Header ─── */}
          <div className="report-header">
            <div className="report-header-left">
              <div className="report-logo"><i className="fa-solid fa-graduation-cap" aria-hidden="true"></i></div>
              <div>
                <div className="report-school-name">School Mentor</div>
                <div className="report-school-tag">Comprehensive School ERP — Human Resource Department</div>
              </div>
            </div>
            <div className="report-type-badge"><i className="fa-solid fa-user-tie" aria-hidden="true"></i> Employee Profile Report</div>
          </div>

          {/* ─── Meta strip ─── */}
          <div className="report-meta">
            <div><strong>Generated:</strong> {today}</div>
            <div><strong>Employee ID:</strong> {emp.eid}</div>
            <div><strong>Ref:</strong> HR/PROFILE/{emp.eid}</div>
          </div>

          {/* ─── 1. Employee Overview ─── */}
          <div className="report-sec">
            <div className="report-sec-title"><span className="report-sec-num">1</span> Employee Overview</div>
            <div className="report-overview">
              <div className="report-overview-photo">
                {emp.photo ? <img src={emp.photo} alt="" /> : ini}
              </div>
              <div className="report-overview-body">
                <div className="report-overview-name">
                  {fullName}
                  <span style={{
                    display: 'inline-block',
                    marginLeft: 6,
                    padding: '3px 10px',
                    borderRadius: 9999,
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: '.4px',
                    textTransform: 'uppercase',
                    background: statusBg,
                    color: statusFg,
                    border: `1px solid ${statusBorder}`,
                    verticalAlign: 'middle',
                  }}>{isActive ? 'Active' : 'Inactive'}</span>
                </div>
                <div className="report-overview-role">{desigName} · {deptName}</div>
                <div className="report-kv-grid g3">
                  <RKv k="Employee ID"        v={emp.eid} />
                  <RKv k="Department"         v={deptName} />
                  <RKv k="Designation"        v={desigName} />
                  <RKv k="Joining Date"       v={fmtDate(emp.join)} />
                  <RKv k="Employment Status"  v={emp.status} valueStyle={{ color: statusFg, fontWeight: 800 }} />
                  <RKv k="Employment Type"    v={emp.type || '—'} />
                </div>
              </div>
            </div>
            <div className="report-duration-card">
              <div><label>Joined On</label><strong>{fmtDate(emp.join)}</strong></div>
              {!isActive && (
                <div><label>Inactive On</label><strong style={{ color: '#D97706' }}>{fmtDate(emp.inactiveDate) || '—'}</strong></div>
              )}
              <div><label>Service Duration</label><strong>{empSvcDuration(emp)}</strong></div>
            </div>
          </div>

          {/* ─── 2. Personal Information ─── */}
          <div className="report-sec">
            <div className="report-sec-title"><span className="report-sec-num">2</span> Personal Information</div>
            <div className="report-kv-grid">
              <RKv k="First Name"        v={emp.firstName || fullName} />
              <RKv k="Last Name"         v={emp.lastName || '—'} />
              <RKv k="Father / Husband"  v={emp.fn || '—'} />
              <RKv k="CNIC"              v={emp.cnic || '—'} />
              <RKv k="Date of Birth"     v={fmtDate(emp.dob)} />
              <RKv k="Gender"            v={emp.gender || '—'} />
              <RKv k="Marital Status"    v={emp.marital || '—'} />
              <RKv k="Blood Group"       v={emp.blood || '—'} />
              <RKv k="Mobile"            v={emp.phone || '—'} />
              <RKv k="Email"             v={emp.email || '—'} />
              <RKv k="Emergency Contact" v={emp.emergency || '—'} />
              <RKv k="Nationality"       v={emp.nationality || '—'} />
              <RKv k="Address"           v={emp.address || '—'} span={4} />
            </div>
          </div>

          {/* ─── 3. Official Details ─── */}
          <div className="report-sec">
            <div className="report-sec-title"><span className="report-sec-num">3</span> Official Details</div>
            <div className="report-kv-grid">
              <RKv k="Employee ID"        v={emp.eid} />
              <RKv k="Joining Date"       v={fmtDate(emp.join)} />
              <RKv k="Status"             v={emp.status} />
              <RKv k="Employment Type"    v={emp.type} />
              <RKv k="Department"         v={deptName} />
              <RKv k="Designation"        v={desigName} />
              <RKv k="Reporting Manager"  v={emp.manager || '—'} />
              <RKv k="Qualification"      v={emp.qual || '—'} />
              <RKv k="Experience"         v={emp.exp || '—'} />
              <RKv k="Shift / Timing"     v={emp.shift || '—'} />
              <RKv k="Country"            v={emp.country || '—'} />
              <RKv k="Province"           v={emp.province || '—'} />
              <RKv k="City"               v={emp.city || '—'} />
              {emp.role && <RKv k="Job Role / Responsibilities" v={emp.role} span={4} />}
            </div>
          </div>

          {/* ─── 4. Salary Details ─── */}
          <div className="report-sec">
            <div className="report-sec-title"><span className="report-sec-num">4</span> Salary Details</div>
            <div className="report-kv-grid">
              <RKv k="Basic Salary"   v={`PKR ${num(basicNum)}`} />
              <RKv k="Payment Method" v={emp.payMethod || '—'} />
              <RKv k="Bank Name"      v={emp.bankName || '—'} />
              <RKv k="Account / IBAN" v={emp.bankAcc || '—'} />
            </div>
            {(emp.salaryHeads || []).length > 0 && (
              <table className="report-table" style={{ marginTop: 10 }}>
                <thead>
                  <tr>
                    <th>Salary Head</th>
                    <th>Type</th>
                    <th style={{ textAlign: 'right' }}>Amount (PKR)</th>
                  </tr>
                </thead>
                <tbody>
                  {emp.salaryHeads.map((h, i) => (
                    <tr key={i}>
                      <td>{h.name || '—'}</td>
                      <td style={{ color: h.type === 'allow' ? '#16A34A' : '#DC2626', fontWeight: 700 }}>
                        {h.type === 'allow' ? 'Allowance' : 'Deduction'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        {h.type === 'allow' ? '+ ' : '– '}{num(h.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="report-sal-summary">
              <div className="report-sal-item"><div className="report-sal-label">Basic</div><div className="report-sal-value">PKR {num(basicNum)}</div></div>
              <div className="report-sal-item"><div className="report-sal-label">Allowances</div><div className="report-sal-value allow">+ PKR {num(allowTotal)}</div></div>
              <div className="report-sal-item"><div className="report-sal-label">Deductions</div><div className="report-sal-value deduct">– PKR {num(deductTotal)}</div></div>
              <div className="report-sal-item"><div className="report-sal-label">Net Salary</div><div className="report-sal-value net">PKR {num(netSalary)}</div></div>
            </div>
          </div>

          {/* ─── 5. Leave Details ─── */}
          <div className="report-sec">
            <div className="report-sec-title"><span className="report-sec-num">5</span> Leave Details</div>
            <div className="report-kv-grid">
              <RKv k="Annual Leaves"           v={emp.leaves?.annual ?? '—'} />
              <RKv k="Casual Leaves"           v={emp.leaves?.casual ?? '—'} />
              <RKv k="Sick Leaves"             v={emp.leaves?.sick ?? '—'} />
              <RKv k="Maternity / Paternity"   v={emp.leaves?.maternity ?? '—'} />
              <RKv k="Leave Balance"           v={emp.leaves?.balance ?? '—'} />
              <RKv k="Leave Policy"            v={emp.leaves?.policy || '—'} />
              <RKv k="Deduction Enabled"       v={emp.leaves?.deductEn ? 'Yes' : 'No'} />
              <RKv k="Absent Deduction / Day"  v={`PKR ${num(emp.leaves?.absentDed)}`} />
              <RKv k="Unpaid Leave Deduction"  v={`PKR ${num(emp.leaves?.unpaidDed)}`} span={2} />
            </div>
          </div>

          {/* ─── 6. Task Assignments ─── */}
          <div className="report-sec">
            <div className="report-sec-title"><span className="report-sec-num">6</span> Task Assignments</div>
            {tasks.length === 0 ? (
              <div className="report-empty">No tasks assigned.</div>
            ) : (
              <table className="report-table">
                <thead><tr><th>#</th><th>Task Title</th><th>Priority</th><th>Status</th><th>Due Date</th><th>Assigned By</th></tr></thead>
                <tbody>
                  {tasks.map((t, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>
                        <strong>{t.title}</strong>
                        {t.desc && <><br /><span style={{ color: '#94A3B8', fontSize: 9.5 }}>{t.desc}</span></>}
                      </td>
                      <td>{t.priority || '—'}</td>
                      <td>{t.status || '—'}</td>
                      <td>{fmtDate(t.due)}</td>
                      <td>{t.assignedBy || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ─── 7. Subject Assignments ─── */}
          <div className="report-sec">
            <div className="report-sec-title"><span className="report-sec-num">7</span> Subject Assignments</div>
            {subjItems.length === 0 ? (
              <div className="report-empty">No subjects assigned.</div>
            ) : (
              <table className="report-table">
                <thead><tr><th>#</th><th>Class</th><th>Section</th><th>Subject</th></tr></thead>
                <tbody>
                  {subjItems.map((s, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td><strong>{s.cls}</strong></td>
                      <td>{s.sec}</td>
                      <td>{s.sub}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ─── 8. Class Attendance Assignments ─── */}
          <div className="report-sec">
            <div className="report-sec-title"><span className="report-sec-num">8</span> Class Attendance Assignments</div>
            {attItems.length === 0 ? (
              <div className="report-empty">No attendance responsibilities assigned.</div>
            ) : (
              <table className="report-table">
                <thead><tr><th>#</th><th>Class</th><th>Section</th><th>Responsibility</th></tr></thead>
                <tbody>
                  {attItems.map((a, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td><strong>{a.cls}</strong></td>
                      <td>{a.sec}</td>
                      <td>Class Teacher — Attendance Marking</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ─── 9. Issued Letters History ─── */}
          <div className="report-sec">
            <div className="report-sec-title"><span className="report-sec-num">9</span> Issued Letters History</div>
            {letters.length === 0 ? (
              <div className="report-empty">No letters issued yet.</div>
            ) : (
              <table className="report-table">
                <thead><tr><th>#</th><th>Letter Type</th><th>Subject</th><th>Issue Date</th><th>Issued By</th><th>Ref</th></tr></thead>
                <tbody>
                  {letters.map((l, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td><strong>{l.label || l.type}</strong></td>
                      <td>{l.subject || '—'}</td>
                      <td>{fmtDate(l.date || l.issuedAt)}</td>
                      <td>{l.signer || l.issuedBy || 'HR'}</td>
                      <td>{l.ref || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ─── 10. Employment History & Status ─── */}
          <div className="report-sec">
            <div className="report-sec-title"><span className="report-sec-num">10</span> Employment History &amp; Status</div>
            <div className="report-kv-grid">
              <RKv k="Employment Status" v={emp.status} valueStyle={{ color: statusFg, fontWeight: 800 }} />
              <RKv k="Joined On"         v={fmtDate(emp.join)} />
              <RKv k={isActive ? 'Tenure' : 'Inactive On'} v={isActive ? 'Ongoing' : (fmtDate(emp.inactiveDate) || '—')} />
              <RKv k="Total Service"     v={empSvcDuration(emp)} valueStyle={{ fontWeight: 800, color: '#1E3A8A' }} />
              {!isActive && (
                <RKv k="Exit Reason" v={emp.inactiveReason || '—'} valueStyle={{ fontWeight: 700 }} span={2} />
              )}
              {!isActive && emp.inactiveNotes && (
                <RKv k="Exit Notes" v={emp.inactiveNotes} span={2} />
              )}
            </div>
          </div>

          {/* ─── 11. Financial Summary & Clearance ─── */}
          <div className="report-sec">
            <div className="report-sec-title"><span className="report-sec-num">11</span> Financial Summary &amp; Clearance</div>
            <table className="report-table">
              <thead><tr><th>Item</th><th style={{ textAlign: 'right' }}>Amount (PKR)</th><th>Status</th></tr></thead>
              <tbody>
                <tr>
                  <td><strong>Salary Advance Balance</strong></td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: f.salaryAdvance > 0 ? '#DC2626' : '#16A34A' }}>{num(f.salaryAdvance)}</td>
                  <td>{f.salaryAdvance > 0 ? 'Outstanding' : 'Nil / Clear'}</td>
                </tr>
                <tr>
                  <td><strong>Employee Loan Balance</strong></td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: f.loanBalance > 0 ? '#DC2626' : '#16A34A' }}>{num(f.loanBalance)}</td>
                  <td>{f.loanBalance > 0 ? 'Outstanding' : 'Nil / Clear'}</td>
                </tr>
                <tr>
                  <td><strong>Other Recoveries</strong></td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: f.otherRecoveries > 0 ? '#DC2626' : '#16A34A' }}>{num(f.otherRecoveries)}</td>
                  <td>{f.otherRecoveries > 0 ? 'Outstanding' : 'Nil / Clear'}</td>
                </tr>
                {f.securityDepositApplicable && (
                  <>
                    <tr>
                      <td><strong>Security Deposit Held</strong></td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#D97706' }}>{num(f.securityDeposit)}</td>
                      <td>Held by School</td>
                    </tr>
                    <tr>
                      <td><strong>Security Deposit Returned</strong></td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0284C7' }}>{num(f.securityDepositReturned)}</td>
                      <td>Returned</td>
                    </tr>
                    <tr>
                      <td><strong>Security Deposit Outstanding</strong></td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: depOut > 0 ? '#D97706' : '#16A34A' }}>{num(depOut)}</td>
                      <td>{depOut > 0 ? 'Pending Return' : 'Settled'}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
            <div className="report-duration-card" style={{ marginTop: 10 }}>
              <div><label>Final Settlement</label><strong style={{ color: f.finalSettlement === 'completed' ? '#16A34A' : '#D97706' }}>{f.finalSettlement === 'completed' ? 'Completed' : 'Pending'}</strong></div>
              <div><label>Clearance Status</label><strong style={{ color: f.clearanceStatus === 'cleared' ? '#16A34A' : '#D97706' }}>{f.clearanceStatus === 'cleared' ? 'Cleared' : 'Pending'}</strong></div>
              <div><label>Net Position</label><strong style={{ color: '#1E3A8A' }}>PKR {num(netPosition)}</strong></div>
            </div>
            <div style={{
              marginTop: 8,
              padding: '8px 12px',
              background: '#F1F5F9',
              borderRadius: 6,
              fontSize: 9.5,
              color: '#64748B',
              fontStyle: 'italic',
            }}>
              <i className="fa-solid fa-circle-info" aria-hidden="true"></i> Financial data here is currently entered manually. Once Payroll Module is implemented, these balances (Salary Advances, Loans, Security Deposits, Recoveries, Final Settlements) will be automatically tracked.
            </div>
          </div>

          {/* ─── 12. Documents Summary ─── */}
          <div className="report-sec">
            <div className="report-sec-title"><span className="report-sec-num">12</span> Documents Summary</div>
            <table className="report-table">
              <thead>
                <tr>
                  <th>#</th><th>Document Name</th><th>Status</th><th>File</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ...RPT_DOC_META.map(m => ({ name: m.name, doc: stdDocs[m.key] })),
                  ...docs.map(d => ({ name: d.name, doc: d })),
                ].map((row, i) => {
                  const doc = row.doc;
                  return (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td><strong>{row.name}</strong></td>
                      <td>
                        {doc
                          ? <span style={{ color: '#16A34A', fontWeight: 700 }}>Uploaded</span>
                          : <span style={{ color: '#94A3B8' }}>Not Uploaded</span>}
                      </td>
                      <td style={{ fontSize: 9.5, color: '#64748B' }}>{doc?.path ? 'File attached' : '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        {doc?.path ? <a href={doc.path} target="_blank" rel="noreferrer" style={{ color: '#1E3A8A', fontWeight: 700 }}>⬇ Download</a> : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ─── Footer ─── */}
          <div className="report-foot">
            <div>
              <div>This is a system-generated report from School Mentor HR.</div>
              <div style={{ marginTop: 2 }}>Confidential — for internal use only.</div>
            </div>
            <div className="sig-mini">
              <div className="sig-mini-item">HR Manager<span>&nbsp;</span></div>
              <div className="sig-mini-item">Principal<span>&nbsp;</span></div>
            </div>
          </div>
        </div>
      </div>
      <style>{PROFILE_PRINT_CSS}</style>
    </div>
  ), document.body);
}

function RKv({ k, v, span, valueStyle }) {
  return (
    <div className="kv" style={span ? { gridColumn: `span ${span}` } : undefined}>
      <label>{k}</label>
      <span style={valueStyle}>{v}</span>
    </div>
  );
}

const PROFILE_PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #report-print-root, #report-print-root * { visibility: visible !important; }
  #report-print-root {
    position: fixed !important; inset: 0 !important;
    margin: 0 auto !important; padding: 24px 30px !important;
    background: #fff !important; box-shadow: none !important;
    max-width: 100% !important;
  }
}
`;
/* ═══════════════════════════════════════════════════════════════════
   Module CSS — top of HumanResource.jsx HR_CSS template literal.
   1:1 port of the relevant rules from "Human Resource .html".
   All tokens are defined locally so the look stays identical to the
   HTML regardless of the surrounding app theme.
   ═══════════════════════════════════════════════════════════════════ */
export const HR_CSS = `
:root,
.hrb-root,
.ov,
.confirm-overlay {
  --brand:       #1E3A8A;
  --brand-mid:   #1E40AF;
  --brand-light: #DBEAFE;
  --card:        #FFFFFF;
  --muted:       #EFF6FF;
  --inp:         #FFFFFF;
  --t1:          #0F172A;
  --t2:          #1E3A5F;
  --tm:          #64748B;
  --success:     #16A34A;
  --warn:        #D97706;
  --err:         #DC2626;
  --info:        #0284C7;
  --bl:          #BFDBFE;
  --bm:          #93C5FD;
  --r-sm: 6px; --r-md: 10px; --r-lg: 14px; --r-xl: 20px; --r-f: 9999px;
  --s-xs: 0 1px 2px rgba(0,0,0,.06);
  --s-sm: 0 2px 6px rgba(30,58,138,.18), 0 1px 2px rgba(0,0,0,.05);
  --s-md: 0 4px 14px rgba(30,58,138,.20);
  --s-lg: 0 10px 30px rgba(30,58,138,.22), 0 4px 8px rgba(0,0,0,.07);
  --s-xl: 0 20px 50px rgba(30,58,138,.20), 0 8px 16px rgba(0,0,0,.08);
  --hr-font: 'Plus Jakarta Sans', 'Segoe UI', sans-serif;
  --tr: all .2s cubic-bezier(.4,0,.2,1);
}
[data-theme="dark"] .hrb-root,
[data-theme="dark"] .ov,
[data-theme="dark"] .confirm-overlay {
  --card:        #0E1628;
  --muted:       #131F38;
  --inp:         #0E1628;
  --t1:          #E2E8F8;
  --t2:          #B8C8E8;
  --tm:          #6B82A8;
  --brand:       #3B82F6;
  --brand-mid:   #2563EB;
  --brand-light: #1E3A6A;
  --bl:          #1C2E50;
  --bm:          #243858;
}

/* ── HR top-bar tabs (existing app convention) ── */
.hr-tabs {
  display: flex;
  background: var(--bg-card, #fff);
  border: 1.5px solid var(--border-light, #E2E8F0);
  border-radius: var(--radius-lg, 16px);
  padding: 4px;
  margin-bottom: 18px;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}
.hr-tabs::-webkit-scrollbar { display: none; }
.hr-tab {
  flex: 1 1 0;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 10px 16px;
  border: none;
  background: transparent;
  border-radius: 10px;
  font: 600 13px/1 var(--hr-font);
  color: var(--text-muted, #64748B);
  cursor: pointer;
  transition: background .15s, color .15s, box-shadow .15s;
  white-space: nowrap;
  text-align: center;
}
.hr-tab:hover:not(.active) { background: var(--bg-muted, #F8FAFC); color: #1E40AF; }
.hr-tab.active {
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  font-weight: 700;
  box-shadow: 0 4px 12px rgba(30, 64, 175, .25);
}
.hr-tab:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(30, 64, 175, .22); }
.hr-tab i { font-size: 12px; }

/* Coming-soon helper kept for the other three tabs */
.hr-section {
  background: var(--bg-card, #fff);
  border: 1.5px solid var(--border-light, #E2E8F0);
  border-radius: var(--radius-lg, 16px);
  box-shadow: var(--shadow-sm);
  padding: 18px 20px;
  margin-bottom: 16px;
}
.hr-empty       { text-align: center; padding: 64px 24px; }
.hr-empty-ic {
  width: 64px; height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(30, 64, 175, .12), rgba(30, 64, 175, .22));
  color: #1E40AF;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 24px; margin-bottom: 14px;
}
.hr-empty-title { font: 800 16px/1.2 var(--hr-font); color: var(--text-primary); letter-spacing: -.01em; }
.hr-empty-sub   { font: 500 13px/1.5 var(--hr-font); color: var(--text-muted, #64748B); margin-top: 6px; max-width: 440px; margin-left: auto; margin-right: auto; }

/* ═══════════════════════════════════════════════════════════════════
   HR BASICS — section-card / card-header / Add Department / info /
   table head / d-row / dept-panel / desig-head / desig-row
   ═══════════════════════════════════════════════════════════════════ */
.hrb-root { font-family: var(--hr-font); color: var(--t1); }

.section-card {
  background: var(--card);
  border: 1px solid var(--bl);
  border-radius: var(--r-xl);
  box-shadow: var(--s-sm);
  margin-bottom: 20px;
  /* overflow:visible so the 3-dots drop-menu on the last row can
     extend past the card boundary without getting clipped. The
     header gradient + bottom rounded corner are preserved by
     selectively clipping the inner header/row containers. */
  overflow: visible;
  position: relative;
}
.section-card > .card-header { border-radius: var(--r-xl) var(--r-xl) 0 0; }
.section-card > .emp-subtabs { border-radius: var(--r-xl) var(--r-xl) 0 0; overflow: hidden; }
.card-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--bl);
  background: linear-gradient(135deg, rgba(30, 58, 138, .03), transparent);
  gap: 12px;
  flex-wrap: wrap;
}
.card-title {
  font: 800 14px/1.2 var(--hr-font);
  color: var(--t1);
  display: inline-flex; align-items: center; gap: 8px;
  letter-spacing: -.01em;
}

/* ── UX info banner ── */
.ux-info-banner {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  background: linear-gradient(135deg, rgba(30, 58, 138, .05), rgba(30, 58, 138, .01));
  border: 1px solid var(--bm);
  border-left: 3px solid var(--brand);
  border-radius: var(--r-md);
  padding: 11px 14px;
  margin: 14px 16px;
  transition: var(--tr);
}
.ux-info-banner:hover {
  background: linear-gradient(135deg, rgba(30, 58, 138, .07), rgba(30, 58, 138, .02));
}
.ux-info-icon {
  flex-shrink: 0;
  width: 28px; height: 28px;
  border-radius: 50%;
  background: var(--brand-light);
  color: var(--brand);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 13px;
  margin-top: 1px;
}
.ux-info-body { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.ux-info-row  {
  font: 500 11.5px/1.55 var(--hr-font);
  color: var(--t2);
}
.ux-info-row strong { color: var(--brand); font-weight: 800; }

/* ── Table head + rows ── */
.t-head {
  display: grid;
  background: var(--muted);
  border-bottom: 1px solid var(--bl);
  padding: 0 16px;
}
.dept-t-head { grid-template-columns: 54px 1fr 160px auto 44px; }
.th {
  padding: 11px 8px;
  font: 700 10.5px/1 var(--hr-font);
  color: var(--tm);
  letter-spacing: .6px;
  text-transform: uppercase;
}
.row-wrap { border-bottom: 1px solid var(--bl); }
.row-wrap:last-child { border-bottom: none; }
.d-row {
  display: grid;
  align-items: center;
  min-height: 56px;
  padding: 0 16px;
  transition: var(--tr);
}
.dept-d-row { grid-template-columns: 54px 1fr 160px auto 44px; }
.d-row:hover { background: rgba(30, 58, 138, .03); }
.d-row.open  { background: var(--muted); }
.td {
  padding: 8px 8px;
  font: 500 13px/1.3 var(--hr-font);
  color: var(--t2);
  display: flex; align-items: center;
}
.td-num  { color: var(--tm); font-weight: 700; }
.td-bold { color: var(--t1); font-weight: 700; }

/* Department row name block */
.dept-row-icn {
  width: 32px; height: 32px;
  border-radius: 8px;
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(30, 58, 138, .12), rgba(30, 58, 138, .2));
  color: #1E40AF;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 12px;
}
.dept-row-name { font: 700 13.5px/1.2 var(--hr-font); color: var(--t1); }
.dept-row-meta { font: 500 10.5px/1 var(--hr-font); color: var(--tm); margin-top: 2px; }
.dept-row-actions { gap: 6px; justify-content: flex-end; flex-wrap: wrap; }

/* Action button family — btn-add / btn-sm / btn-edit / btn-del / btn-expand */
.btn-add {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 20px;
  border-radius: var(--r-f);
  border: none;
  background: linear-gradient(135deg, #1E40AF, #1E3A8A);
  color: #fff;
  font: 700 13px/1 var(--hr-font);
  box-shadow: 0 4px 14px rgba(30, 58, 138, .28);
  cursor: pointer;
  transition: var(--tr);
  white-space: nowrap;
}
.btn-add:hover { transform: translateY(-2px); }
.btn-sm {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 12px;
  border-radius: var(--r-md);
  border: 1.5px solid var(--brand);
  background: rgba(30, 58, 138, .06);
  color: var(--brand);
  font: 700 11.5px/1 var(--hr-font);
  cursor: pointer;
  transition: var(--tr);
  white-space: nowrap;
}
.btn-sm:hover { background: rgba(30, 58, 138, .14); }
.btn-edit {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 12px;
  border-radius: var(--r-md);
  border: 1.5px solid var(--bl);
  background: var(--card);
  color: var(--t2);
  font: 700 11.5px/1 var(--hr-font);
  cursor: pointer;
  transition: var(--tr);
}
.btn-edit:hover { border-color: var(--brand); color: var(--brand); background: rgba(30, 58, 138, .05); }
.btn-del {
  width: 30px; height: 30px;
  border-radius: 8px;
  flex-shrink: 0;
  border: 1.5px solid rgba(220, 38, 38, .2);
  background: rgba(220, 38, 38, .05);
  color: var(--err);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px;
  cursor: pointer;
  transition: var(--tr);
}
.btn-del:hover { background: rgba(220, 38, 38, .12); border-color: var(--err); }
.btn-expand {
  width: 30px; height: 30px;
  border-radius: 8px;
  flex-shrink: 0;
  border: 1.5px solid var(--bl);
  background: var(--card);
  color: var(--tm);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px;
  cursor: pointer;
  transition: var(--tr);
}
.btn-expand:hover { border-color: var(--brand); color: var(--brand); }
.btn-expand.open  { transform: rotate(180deg); border-color: var(--brand); color: var(--brand); }

/* Badges */
.badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 10px;
  border-radius: var(--r-f);
  font: 700 10.5px/1 var(--hr-font);
  letter-spacing: .3px;
  white-space: nowrap;
}
.b-green { background: rgba(22, 163, 74, .1); color: #16A34A; border: 1px solid rgba(22, 163, 74, .25); }
.b-warn  { background: rgba(217, 119, 6, .1); color: #D97706; border: 1px solid rgba(217, 119, 6, .25); }
.b-gray  { background: rgba(100, 116, 139, .1); color: #64748B; border: 1px solid rgba(100, 116, 139, .2); }
.b-blue  { background: var(--brand-light); color: var(--brand); border: 1px solid var(--bm); font-size: 11px; }

/* Department expand panel */
.dept-panel {
  border-top: 1px solid var(--bl);
  max-height: 0;
  overflow: hidden;
  transition: max-height .4s cubic-bezier(.4, 0, .2, 1);
  background: linear-gradient(135deg, rgba(30, 58, 138, .02), rgba(30, 58, 138, .04));
}
.dept-panel.open { max-height: 1200px; }
.dept-panel-inner { padding: 14px 20px 18px; }
.dept-panel-title {
  font: 800 11.5px/1 var(--hr-font);
  color: var(--brand);
  text-transform: uppercase;
  letter-spacing: .6px;
  margin-bottom: 12px;
  display: inline-flex; align-items: center; gap: 8px;
}
.dept-panel-empty {
  padding: 10px 0;
  color: var(--tm);
  font: 500 13px/1.4 var(--hr-font);
  text-align: center;
}
.dept-panel-empty i { margin-right: 5px; }

/* Designation list inside panel */
.desig-head {
  display: grid;
  grid-template-columns: 32px 1fr 110px 90px;
  background: var(--muted);
  border-radius: 6px;
  padding: 0 8px;
  margin-bottom: 4px;
}
.desig-row {
  display: grid;
  grid-template-columns: 32px 1fr 110px 90px;
  align-items: center;
  min-height: 46px;
  padding: 0 8px;
  border-bottom: 1px solid var(--bl);
  transition: var(--tr);
}
.desig-row:last-child { border-bottom: none; }
.desig-row:hover { background: rgba(30, 58, 138, .03); }
.desig-row-name-cell { flex-direction: column; align-items: flex-start; gap: 1px; }
.desig-row-name { font: 700 13px/1.2 var(--hr-font); color: var(--t1); }
.desig-row-qual { font: 500 10.5px/1.2 var(--hr-font); color: var(--tm); }
.desig-row-actions { gap: 6px; justify-content: flex-end; }

/* Empty state inside HR Basics (port of emptyState()) */
.hrb-empty-ic {
  width: 60px; height: 60px;
  border-radius: var(--r-lg);
  background: var(--muted);
  color: var(--tm);
  font-size: 22px;
  display: inline-flex; align-items: center; justify-content: center;
  margin-bottom: 12px;
}
.hrb-empty-title { font: 700 15px/1.2 var(--hr-font); color: var(--t1); margin-bottom: 5px; }
.hrb-empty-sub   { font: 500 12.5px/1.4 var(--hr-font); color: var(--tm); }

/* ═══════════════════════════════════════════════════════════════════
   MODAL CHROME (.ov / .modal / .modal-head / .modal-body / .modal-foot)
   1:1 port from the HTML reference.
   ═══════════════════════════════════════════════════════════════════ */
.ov {
  position: fixed; inset: 0;
  background: rgba(10, 22, 40, .55);
  backdrop-filter: blur(5px);
  z-index: 1000;
  display: none;
  align-items: center; justify-content: center;
  padding: 20px;
  font-family: var(--hr-font);
}
.ov.open { display: flex; animation: hrbFadeIn .14s ease-out; }
@keyframes hrbFadeIn { from { opacity: 0; } to { opacity: 1; } }

.modal {
  background: var(--card);
  border-radius: var(--r-xl);
  width: 100%;
  max-width: 600px;
  max-height: 92vh;
  overflow: hidden;
  box-shadow: var(--s-xl);
  border: 1px solid var(--bl);
  display: flex; flex-direction: column;
  animation: mIn .28s cubic-bezier(.34, 1.26, .64, 1) both;
}
@media (max-width: 600px) {
  .modal { max-width: 96vw; }
}
@keyframes mIn {
  from { opacity: 0; transform: translateY(14px) scale(.97); }
  to   { opacity: 1; transform: none; }
}
.modal-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 24px 14px;
  border-bottom: 1px solid var(--bl);
  background: var(--card);
  flex-shrink: 0;
  gap: 12px;
}
.modal-head-left { display: flex; align-items: center; gap: 11px; min-width: 0; }
.modal-head-icon {
  width: 38px; height: 38px;
  border-radius: 11px;
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(30, 58, 138, .15), rgba(30, 58, 138, .25));
  color: #1E40AF;
  font-size: 16px;
  display: inline-flex; align-items: center; justify-content: center;
}
[data-theme="dark"] .modal-head-icon {
  background: linear-gradient(135deg, rgba(59, 130, 246, .15), rgba(59, 130, 246, .25));
  color: #93C5FD;
}
.modal-title {
  font: 800 16px/1.2 var(--hr-font);
  color: var(--brand);
  letter-spacing: -.02em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.modal-sub {
  font: 500 12px/1.3 var(--hr-font);
  color: var(--tm);
  margin-top: 2px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.modal-close {
  width: 30px; height: 30px;
  border-radius: 8px;
  border: none;
  background: var(--muted);
  color: var(--tm);
  font-size: 13px;
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: var(--tr);
}
.modal-close:hover { background: rgba(220, 38, 38, .1); color: var(--err); }
.modal-body {
  padding: 20px 24px 24px;
  overflow-y: auto;
  background: var(--card);
  color: var(--t1);
}
.modal-foot {
  display: flex; gap: 9px; justify-content: flex-end;
  padding: 14px 24px;
  border-top: 1px solid var(--bl);
  background: var(--card);
  flex-shrink: 0;
  align-items: center;
  flex-wrap: wrap;
}

/* Form primitives — f-label / f-input / f-select2 / f-textarea / f-row / f-group */
.modal .f-label {
  display: block;
  font: 700 11.5px/1.2 var(--hr-font);
  color: var(--t2);
  margin-bottom: 5px;
}
.modal .f-label .req { color: var(--err); margin-left: 3px; }
.pr-field label .req { color: var(--err); margin-left: 3px; }
.modal .f-input,
.modal .f-select2 {
  width: 100%;
  height: 42px;
  padding: 0 13px;
  border: 1.5px solid var(--bl);
  border-radius: var(--r-md);
  font: 500 13px/1.2 var(--hr-font);
  color: var(--t1);
  background: var(--inp);
  outline: none;
  transition: var(--tr);
}
.modal .f-input:hover,
.modal .f-select2:hover { border-color: var(--bm); }
.modal .f-input:focus,
.modal .f-select2:focus { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(30, 58, 138, .09); }
.modal .f-select2 {
  padding-right: 36px;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748B' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 13px center;
}
.modal .f-textarea {
  width: 100%;
  min-height: 80px;
  padding: 10px 13px;
  border: 1.5px solid var(--bl);
  border-radius: var(--r-md);
  font: 500 13px/1.4 var(--hr-font);
  color: var(--t1);
  background: var(--inp);
  outline: none;
  resize: vertical;
  transition: var(--tr);
}
.modal .f-textarea:focus { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(30, 58, 138, .09); }
.modal .f-group { margin-bottom: 14px; }
.modal .f-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

/* Primary / secondary buttons */
.btn-primary {
  display: inline-flex; align-items: center; gap: 7px;
  height: 40px; padding: 0 22px;
  border-radius: var(--r-md);
  border: none;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  font: 700 13.5px/1 var(--hr-font);
  box-shadow: 0 4px 14px rgba(30, 58, 138, .28);
  cursor: pointer;
  transition: var(--tr);
}
.btn-primary:hover { transform: translateY(-1px); }
.btn-secondary {
  display: inline-flex; align-items: center; gap: 7px;
  height: 40px; padding: 0 18px;
  border-radius: var(--r-md);
  border: 1.5px solid var(--bl);
  background: var(--muted);
  color: var(--t2);
  font: 600 13.5px/1 var(--hr-font);
  cursor: pointer;
  transition: var(--tr);
}
.btn-secondary:hover { background: var(--card); color: var(--t1); }

/* ═══════════════════════════════════════════════════════════════════
   CONFIRM DIALOG — 1:1 port from src/components/Academics.js
   ═══════════════════════════════════════════════════════════════════ */
.confirm-overlay {
  position: fixed; inset: 0;
  background: rgba(10,22,40,.55); backdrop-filter: blur(8px);
  z-index: 9999; display: none;
  align-items: center; justify-content: center; padding: 20px;
}
.confirm-overlay.open { display: flex; }
.confirm-dialog {
  background: var(--bg-card, var(--card)); border-radius: 24px;
  width: 100%; max-width: 380px;
  border: 1px solid var(--border-light, var(--bl));
  box-shadow: 0 30px 80px rgba(0,0,0,.2), 0 8px 24px rgba(0,0,0,.1);
  animation: confirmIn .32s cubic-bezier(.34,1.3,.64,1) both;
  overflow: hidden; position: relative;
}
@keyframes confirmIn { from { opacity: 0; transform: scale(.88) translateY(20px); } to { opacity: 1; transform: none; } }
.confirm-glow { position: absolute; top: 0; left: 0; right: 0; height: 3px; border-radius: 24px 24px 0 0; }
.confirm-hero {
  display: flex; flex-direction: column; align-items: center;
  padding: 32px 28px 10px;
  background: linear-gradient(180deg, rgba(220,38,38,.03), transparent);
}
.confirm-ring { position: relative; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; }
.confirm-ring::before {
  content: ''; position: absolute; inset: 0; border-radius: 50%;
  border: 2px solid transparent; border-top-color: #EF4444; border-right-color: #EF4444;
  animation: confirmRing 3s linear infinite; opacity: .4;
}
@keyframes confirmRing { to { transform: rotate(360deg); } }
.confirm-icon-wrap {
  width: 60px; height: 60px; border-radius: 18px;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; position: relative; z-index: 1;
  box-shadow: 0 8px 24px rgba(220,38,38,.2);
  transition: all .3s ease;
}
.confirm-body { padding: 16px 28px 8px; text-align: center; }
.confirm-title { font-size: 20px; font-weight: 800; color: var(--text-primary, var(--t1)); margin-bottom: 10px; letter-spacing: -.02em; }
.confirm-msg { font-size: 13.5px; color: var(--text-muted, var(--tm)); line-height: 1.75; margin-bottom: 14px; }
.confirm-msg strong { color: var(--text-primary, var(--t1)); font-weight: 700; }
.confirm-hint {
  display: flex; align-items: flex-start; gap: 9px; text-align: left;
  padding: 11px 14px; border-radius: 12px;
  background: rgba(220,38,38,.05); border: 1px solid rgba(220,38,38,.15);
  font-size: 12px; font-weight: 600; color: #991B1B; line-height: 1.5;
}
.confirm-hint i { color: #DC2626; font-size: 13px; flex-shrink: 0; margin-top: 1px; }
.confirm-footer { display: grid; grid-template-columns: 1fr 1.4fr; gap: 10px; padding: 20px 28px 28px; }
.confirm-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  height: 46px; border-radius: 12px; border: none; cursor: pointer;
  font-family: var(--font-body, var(--hr-font)); font-size: 14px; font-weight: 700;
  transition: all .2s cubic-bezier(.4,0,.2,1); letter-spacing: .01em;
}
.confirm-btn--cancel {
  background: var(--bg-muted, var(--muted)); border: 1.5px solid var(--border-light, var(--bl));
  color: var(--text-muted, var(--tm));
}
.confirm-btn--cancel:hover { background: var(--bg-card, var(--card)); color: var(--text-primary, var(--t1)); border-color: var(--border-med, var(--bm)); }
.confirm-btn--confirm {
  background: linear-gradient(135deg, #EF4444, #DC2626); color: #fff;
  box-shadow: 0 4px 14px rgba(220,38,38,.35), inset 0 1px 0 rgba(255,255,255,.2);
}
.confirm-btn--confirm:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(220,38,38,.5); }
.confirm-btn--confirm.primary-style {
  background: linear-gradient(135deg, #1D4ED8, #1E3A8A);
  box-shadow: 0 4px 14px rgba(30,58,138,.35), inset 0 1px 0 rgba(255,255,255,.2);
}
.confirm-btn--confirm.primary-style:hover { box-shadow: 0 8px 24px rgba(30,58,138,.5); }
.confirm-btn:active { transform: scale(.97) translateY(0) !important; }

[data-theme="dark"] .confirm-overlay { background: rgba(0,5,15,.72); }
[data-theme="dark"] .confirm-dialog  { background: var(--bg-card, var(--card)); border-color: var(--border-light, var(--bl)); }
[data-theme="dark"] .confirm-hint    { background: rgba(220,38,38,.1); color: #FCA5A5; }

/* ═══════════════════════════════════════════════════════════════════
   EMPLOYEE MANAGEMENT — sub-tabs / filter bar / row grid / chips /
   3-dots menu / expand chevron. 1:1 port from the HTML reference.
   ═══════════════════════════════════════════════════════════════════ */

/* Sub-tabs */
.emp-subtabs {
  display: flex; gap: 0;
  border-bottom: 1px solid var(--bl);
  background: linear-gradient(135deg, rgba(30, 58, 138, .03), transparent);
  padding: 0 12px;
  align-items: stretch;
}
.emp-subtab {
  flex: 1;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 13px 18px;
  border: none;
  background: transparent;
  font: 600 13px/1 var(--hr-font);
  color: var(--tm);
  cursor: pointer;
  border-bottom: 3px solid transparent;
  margin-bottom: -1px;
  transition: var(--tr);
  position: relative;
  white-space: nowrap;
}
.emp-subtab:hover:not(.active) { color: var(--t1); background: rgba(30, 58, 138, .04); }
.emp-subtab.active { color: var(--brand); font-weight: 800; border-bottom-color: var(--brand); }
.emp-subtab i { font-size: 13px; flex-shrink: 0; }
.emp-subtab-count {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 22px; height: 20px;
  padding: 0 7px;
  border-radius: var(--r-f);
  background: var(--muted);
  color: var(--tm);
  font: 800 10.5px/1 var(--hr-font);
  border: 1px solid var(--bl);
}
.emp-subtab.active .emp-subtab-count {
  background: var(--brand-light);
  color: var(--brand);
  border-color: var(--bm);
}
[data-theme="dark"] .emp-subtab-count { background: var(--card); border-color: var(--bl); }

/* UX info banner — compact variant for EM */
.ux-info-banner.compact { padding: 8px 12px; margin: 8px 16px 12px; }
.ux-info-banner.compact .ux-info-icon { width: 22px; height: 22px; font-size: 11px; }
.ux-info-banner.compact .ux-info-row  { font-size: 11px; }

/* Filter bar */
.filter-bar {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--bl);
  flex-wrap: wrap;
  background: var(--card);
}
.f-select {
  height: 38px;
  padding: 0 14px;
  border-radius: var(--r-f);
  border: 1.5px solid var(--bl);
  background: var(--card);
  font: 500 12.5px/1 var(--hr-font);
  color: var(--t2);
  outline: none;
  cursor: pointer;
  transition: var(--tr);
}
.f-select:focus { border-color: var(--brand); }

/* Employee search */
.emp-search-wrap { position: relative; flex: 1; min-width: 240px; max-width: 420px; }
.emp-search { position: relative; width: 100%; }
.emp-search i.emp-search-icn {
  position: absolute; left: 13px; top: 50%;
  transform: translateY(-50%);
  color: var(--tm);
  font-size: 12px;
  pointer-events: none;
}
.emp-search input {
  width: 100%;
  height: 42px;
  border: 1.5px solid var(--bl);
  border-radius: var(--r-md);
  padding: 0 36px 0 34px;
  font: 500 13px/1 var(--hr-font);
  color: var(--t1);
  background: var(--inp);
  outline: none;
  transition: var(--tr);
}
.emp-search input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(30, 58, 138, .1); }
.emp-search-clear {
  position: absolute; right: 8px; top: 50%;
  transform: translateY(-50%);
  width: 24px; height: 24px;
  border: none; border-radius: 50%;
  background: var(--muted);
  color: var(--tm);
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px;
  transition: var(--tr);
}
.emp-search-clear:hover { background: var(--brand-light); color: var(--brand); }

/* Employee table head + row (9-col grid) */
.emp-t-head {
  display: grid;
  grid-template-columns: 44px 50px 1.1fr 105px 115px 110px 230px auto 40px;
  padding: 0 12px;
  gap: 6px;
  background: var(--muted);
  border-bottom: 1px solid var(--bl);
}
.emp-row {
  display: grid;
  grid-template-columns: 44px 50px 1.1fr 105px 115px 110px 230px auto 40px;
  align-items: center;
  min-height: 64px;
  padding: 0 12px;
  gap: 6px;
  transition: var(--tr);
}
.emp-row:hover { background: rgba(30, 58, 138, .03); }
.emp-row.open  { background: var(--muted); }

/* Avatar */
.emp-avatar {
  width: 38px; height: 38px;
  border-radius: var(--r-md);
  flex-shrink: 0;
  border: 2px solid var(--bl);
  overflow: hidden;
  background: linear-gradient(135deg, rgba(30, 58, 138, .15), rgba(30, 64, 175, .25));
  color: #1E40AF;
  font: 700 12px/1 var(--hr-font);
  display: inline-flex; align-items: center; justify-content: center;
}
.emp-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }

/* Name / EID cell */
.emp-name-cell {
  flex-direction: column;
  align-items: flex-start !important;
  gap: 2px;
  min-width: 0;
}
.emp-row-name {
  font: 700 13px/1.2 var(--hr-font);
  color: var(--t1);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  max-width: 100%;
}
.emp-row-eid {
  font: 600 10.5px/1 var(--hr-font);
  color: var(--tm);
}

/* Cell badge truncation helpers */
.emp-cell-badge {
  max-width: 100%;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  display: inline-block;
  line-height: 1.4;
}

/* Phone cell */
.emp-phone-cell {
  font-size: 12px;
  color: var(--t2);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* Summary chips */
.emp-chips {
  display: flex; align-items: center; gap: 4px;
  flex-wrap: nowrap;
  justify-content: flex-start;
  width: 100%;
}
.emp-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 5px 8px;
  border-radius: var(--r-f);
  background: var(--muted);
  border: 1px solid var(--bl);
  font: 800 10.5px/1 var(--hr-font);
  color: var(--t2);
  transition: var(--tr);
  cursor: default;
  white-space: nowrap;
  flex-shrink: 0;
}
.emp-chip:hover {
  background: var(--brand-light);
  border-color: var(--bm);
  color: var(--brand);
  transform: translateY(-1px);
}
.emp-chip i { font-size: 10px; color: var(--brand); }
.emp-chip.zero { opacity: .45; }
.emp-chip.zero i { color: var(--tm); }
.emp-chip.zero:hover { opacity: 1; }
.emp-chip.is-task   i { color: #2563EB; }
.emp-chip.is-letter i { color: #7C3AED; }
.emp-chip.is-doc    i { color: #0284C7; }
.emp-chip.is-subj   i { color: #16A34A; }
.emp-chip.is-att    i { color: #D97706; }

/* Actions cell — keep buttons right-aligned */
.emp-actions-cell { justify-content: flex-end; gap: 5px; }
.emp-chev-cell    { justify-content: center; }

/* 3-dots menu */
.menu-wrap { position: relative; display: inline-block; z-index: 5; }
.menu-wrap:has(.drop-menu) { z-index: 850; }
.btn-dots {
  width: 30px; height: 30px;
  border-radius: 8px;
  border: 1.5px solid var(--bl);
  background: var(--card);
  color: var(--tm);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 12px;
  cursor: pointer;
  transition: var(--tr);
}
.btn-dots:hover { border-color: var(--brand); color: var(--brand); }
.drop-menu {
  position: absolute; right: 0;
  top: calc(100% + 6px);
  background: var(--card);
  border: 1px solid var(--bl);
  border-radius: var(--r-md);
  box-shadow: var(--s-lg);
  min-width: 220px;
  z-index: 800;
  padding: 4px;
  animation: dropIn .18s cubic-bezier(.34, 1.26, .64, 1) both;
}
@keyframes dropIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
.drop-item {
  display: flex; align-items: center; gap: 9px;
  padding: 9px 14px;
  font: 500 13px/1 var(--hr-font);
  color: var(--t1);
  cursor: pointer;
  transition: var(--tr);
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  border-radius: 6px;
}
.drop-item:hover { background: var(--muted); }
.drop-item.red { color: var(--err); }
.drop-item.red:hover { background: rgba(220, 38, 38, .07); }
.drop-item i { width: 16px; text-align: center; color: var(--tm); font-size: 12px; }
.drop-item.red i { color: var(--err); }

/* Expand chevron (re-using the .btn-expand from HR Basics) */

/* Employee expand panel */
.emp-panel {
  border-top: 1px solid var(--bl);
  max-height: 0;
  overflow: hidden;
  transition: max-height .5s cubic-bezier(.4, 0, .2, 1);
  background: linear-gradient(135deg, rgba(30, 58, 138, .02), rgba(30, 58, 138, .04));
}
.emp-panel.open { max-height: 640px; }
.emp-panel-inner {
  padding: 16px 20px 20px;
  max-height: 640px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--bm) transparent;
}
.emp-panel-inner::-webkit-scrollbar { width: 8px; }
.emp-panel-inner::-webkit-scrollbar-thumb { background: var(--bm); border-radius: 4px; border: 2px solid transparent; background-clip: padding-box; }
.emp-panel-stub {
  display: flex; align-items: center; gap: 8px;
  padding: 16px 18px;
  border-radius: 10px;
  background: var(--card);
  border: 1px dashed var(--bl);
  font: 600 12.5px/1.4 var(--hr-font);
  color: var(--tm);
}
.emp-panel-stub i { color: var(--brand); font-size: 14px; }

/* ── Responsive collapses for the EM table ── */
@media (max-width: 1100px) {
  .emp-t-head,
  .emp-row {
    grid-template-columns: 40px 48px 1fr 105px 220px auto 40px !important;
    gap: 5px;
  }
  .emp-t-head .th:nth-child(4),
  .emp-row .td:nth-child(4),
  .emp-t-head .th:nth-child(5),
  .emp-row .td:nth-child(5) { display: none; }
}
@media (max-width: 900px) {
  .emp-t-head,
  .emp-row {
    grid-template-columns: 36px 46px 1fr 220px auto 40px !important;
    gap: 5px;
  }
  .emp-t-head .th:nth-child(4),
  .emp-row .td:nth-child(4),
  .emp-t-head .th:nth-child(5),
  .emp-row .td:nth-child(5),
  .emp-t-head .th:nth-child(6),
  .emp-row .td:nth-child(6) { display: none; }
}
@media (max-width: 768px) {
  .emp-t-head { display: none !important; }
  .emp-row {
    grid-template-columns: 42px 1fr auto !important;
    gap: 8px;
    min-height: 64px;
    padding: 12px 10px;
    align-items: start;
  }
  .emp-row .td:nth-child(1) { display: none; }
  .emp-row .td:nth-child(2) { grid-column: 1; }
  .emp-row .td:nth-child(3) {
    grid-column: 2;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    width: 100%;
  }
  .emp-row .td:nth-child(4),
  .emp-row .td:nth-child(5),
  .emp-row .td:nth-child(6) { display: none; }
  .emp-row .td:nth-child(7) {
    grid-column: 2;
    grid-row: auto;
    padding-top: 2px;
  }
  .emp-row .td:nth-child(8) {
    grid-column: 3;
    grid-row: 1 / 3;
    align-self: start;
  }
  .emp-row .td:nth-child(9) { display: none; }
  .emp-chips { flex-wrap: wrap; gap: 5px; }
  .emp-subtabs { padding: 0 6px; }
  .emp-subtab { font-size: 12px; padding: 11px 10px; }
}

/* ═══════════════════════════════════════════════════════════════════
   Responsive
   ═══════════════════════════════════════════════════════════════════ */
@media (max-width: 900px) {
  .dept-t-head,
  .dept-d-row { grid-template-columns: 44px 1fr 100px auto 38px; }
  .dept-t-head .th:nth-child(3) { display: none; }
  .dept-d-row .td:nth-child(3)  { display: none; }
}
@media (max-width: 720px) {
  .card-header { padding: 12px 14px; gap: 8px; }
  .card-title { font-size: 13px; }
  .btn-add { padding: 8px 14px; font-size: 12.5px; }
  .ux-info-banner { margin: 12px 12px; padding: 9px 11px; }
  .ux-info-row { font-size: 11px; }
  .dept-t-head,
  .dept-d-row { grid-template-columns: 38px 1fr 38px; padding: 0 12px; }
  .dept-t-head .th:nth-child(3),
  .dept-t-head .th:nth-child(4) { display: none; }
  .dept-d-row .td:nth-child(3),
  .dept-d-row .td:nth-child(4)  { display: none; }
  .dept-panel-inner { padding: 12px 14px 16px; }
  .desig-head,
  .desig-row { grid-template-columns: 28px 1fr 70px; }
  .desig-head .th:nth-child(3),
  .desig-row .td:nth-child(3) { display: none; }
}
@media (max-width: 540px) {
  .ov { padding: 0; }
  .modal { border-radius: 0; max-height: 100vh; height: 100vh; max-width: 100vw; }
  .modal .f-row { grid-template-columns: 1fr; }
  .confirm-dialog { border-radius: 22px 22px 0 0; max-width: 100%; align-self: flex-end; }
  .confirm-overlay.open { align-items: flex-end; padding: 0; }
}

/* ═══════════════════════════════════════════════════════════════════
   ADD NEW EMPLOYEE MODAL — CSS port (modal-xl + 6 tabs + form bits)
   ═══════════════════════════════════════════════════════════════════ */

/* Bigger modal width for the multi-section employee form */
.modal-xl { max-width: 960px; }
.modal-xl .modal-body { padding: 18px 24px 16px; }

/* .modal-lg — 1:1 port from HTML reference */
.modal-lg { max-width: 900px; }

/* Underline tab bar (m-tabs / m-tab) */
.m-tabs {
  display: flex;
  overflow-x: auto;
  scrollbar-width: none;
  border-bottom: 2px solid var(--bl);
  padding: 0 24px;
  background: var(--card);
  flex-shrink: 0;
}
.m-tabs::-webkit-scrollbar { display: none; }
.m-tab {
  padding: 10px 14px;
  border: none;
  background: transparent;
  font: 600 12.5px/1 var(--hr-font);
  color: var(--tm);
  cursor: pointer;
  border-bottom: 2.5px solid transparent;
  margin-bottom: -2px;
  flex-shrink: 0;
  white-space: nowrap;
  display: inline-flex; align-items: center; gap: 6px;
  transition: var(--tr);
}
.m-tab i { font-size: 11px; }
.m-tab:hover { color: var(--brand); }
.m-tab.active { color: var(--brand); border-bottom-color: var(--brand); font-weight: 700; }

/* Section card */
.modal-xl .m-section {
  background: linear-gradient(135deg, rgba(30,58,138,.02), transparent);
  border: 1px solid var(--bl);
  border-radius: var(--r-lg);
  padding: 14px 16px;
  margin-bottom: 14px;
}
.modal-xl .m-section-title {
  font: 800 12px/1 var(--hr-font);
  color: var(--brand);
  text-transform: uppercase;
  letter-spacing: .5px;
  margin-bottom: 12px;
  display: flex; align-items: center; gap: 7px;
}
.modal-xl .m-section-title i { font-size: 13px; }
.modal-xl .m-section-title .tip-icon {
  width: 18px; height: 18px;
  border-radius: 50%;
  background: var(--brand-light);
  color: var(--brand);
  font-size: 9px;
  display: inline-flex; align-items: center; justify-content: center;
  cursor: help;
  margin-left: auto;
}

/* 3-col form row */
.modal-xl .f-row-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 14px;
}

/* Photo dropzone */
.modal-xl .photo-wrap {
  width: 96px; height: 96px;
  border-radius: var(--r-md);
  border: 2px dashed var(--bm);
  background: var(--muted);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  cursor: pointer;
  transition: var(--tr);
  overflow: hidden;
  flex-shrink: 0;
}
.modal-xl .photo-wrap:hover { border-color: var(--brand); }
.modal-xl .photo-wrap img { width: 100%; height: 100%; object-fit: cover; }

/* Info banners */
.modal-xl .info-banner {
  display: flex; gap: 11px;
  padding: 11px 14px;
  border-radius: var(--r-md);
  background: linear-gradient(135deg, rgba(2,132,199,.06), rgba(2,132,199,.02));
  border: 1px solid rgba(2,132,199,.2);
  margin-bottom: 16px;
  align-items: flex-start;
}
.modal-xl .info-banner.payroll { background: linear-gradient(135deg, rgba(30,58,138,.06), rgba(30,58,138,.02)); border-color: rgba(30,58,138,.18); }
.modal-xl .info-banner.warning { background: linear-gradient(135deg, rgba(217,119,6,.06), rgba(217,119,6,.02)); border-color: rgba(217,119,6,.22); }
.modal-xl .info-banner.success { background: linear-gradient(135deg, rgba(22,163,74,.06), rgba(22,163,74,.02)); border-color: rgba(22,163,74,.22); }
.modal-xl .info-banner-icon {
  width: 30px; height: 30px;
  border-radius: 8px;
  flex-shrink: 0;
  background: rgba(2,132,199,.12);
  color: var(--info);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 12px;
}
.modal-xl .info-banner.payroll .info-banner-icon { background: rgba(30,58,138,.14); color: var(--brand); }
.modal-xl .info-banner.warning .info-banner-icon { background: rgba(217,119,6,.14); color: var(--warn); }
.modal-xl .info-banner.success .info-banner-icon { background: rgba(22,163,74,.14); color: var(--success); }
.modal-xl .info-banner-body  { flex: 1; min-width: 0; }
.modal-xl .info-banner-title { font: 800 12px/1.3 var(--hr-font); color: var(--t1); margin-bottom: 3px; }
.modal-xl .info-banner-text  { font: 500 11.5px/1.55 var(--hr-font); color: var(--t2); }
.modal-xl .info-banner-text strong { color: var(--t1); font-weight: 700; }
.modal-xl .module-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
.modal-xl .module-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 9px;
  border-radius: var(--r-f);
  font: 700 10.5px/1 var(--hr-font);
  background: var(--brand-light);
  color: var(--brand);
  border: 1px solid var(--bm);
}
.modal-xl .module-chip i { font-size: 9px; }

/* Salary heads grid */
.modal-xl .sal-heads-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
}
.modal-xl .sal-heads-empty {
  grid-column: 1 / -1;
  text-align: center;
  padding: 14px;
  color: var(--tm);
  font: 500 12.5px/1.4 var(--hr-font);
  background: var(--muted);
  border-radius: var(--r-md);
  border: 1px dashed var(--bl);
  margin-bottom: 12px;
}
.modal-xl .sal-head-card {
  background: var(--card);
  border: 1.5px solid var(--bl);
  border-radius: var(--r-md);
  padding: 12px;
  transition: var(--tr);
  position: relative;
}
.modal-xl .sal-head-card:hover { border-color: var(--bm); box-shadow: var(--s-xs); }
.modal-xl .sal-head-card.type-allow  { border-left: 3px solid var(--success); }
.modal-xl .sal-head-card.type-deduct { border-left: 3px solid var(--err); }
.modal-xl .sal-head-top    { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.modal-xl .sal-head-bottom { display: flex; align-items: center; gap: 6px; }
.modal-xl .sal-head-name-input,
.modal-xl .sal-head-amt-input {
  flex: 1; min-width: 0;
  height: 34px;
  padding: 0 10px;
  border: 1.5px solid var(--bl);
  border-radius: 7px;
  font: 600 12.5px/1.2 var(--hr-font);
  color: var(--t1);
  background: var(--inp);
  outline: none;
  transition: var(--tr);
}
.modal-xl .sal-head-amt-input { font-weight: 700; }
.modal-xl .sal-head-name-fixed {
  flex: 1; min-width: 0;
  height: 34px;
  display: flex; align-items: center;
  padding: 0 10px;
  font: 700 12.5px/1.2 var(--hr-font);
  color: var(--t1);
}
.modal-xl .sal-head-name-input:focus,
.modal-xl .sal-head-amt-input:focus { border-color: var(--brand); }
.modal-xl .sal-head-type-pill {
  display: inline-flex; align-items: center; gap: 4px;
  height: 24px; padding: 0 8px;
  border-radius: var(--r-f);
  font: 800 9.5px/1 var(--hr-font);
  letter-spacing: .4px;
  text-transform: uppercase;
  flex-shrink: 0;
  cursor: pointer;
  border: 1px solid transparent;
}
.modal-xl .sal-head-type-pill.allow  { background: rgba(22,163,74,.1); color: var(--success); border-color: rgba(22,163,74,.25); }
.modal-xl .sal-head-type-pill.deduct { background: rgba(220,38,38,.1); color: var(--err);     border-color: rgba(220,38,38,.25); }
.modal-xl .sal-head-remove {
  width: 26px; height: 26px;
  border-radius: 6px;
  flex-shrink: 0;
  border: 1.5px solid rgba(220,38,38,.2);
  background: rgba(220,38,38,.05);
  color: var(--err);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 10px;
  cursor: pointer;
  transition: var(--tr);
}
.modal-xl .sal-head-remove:hover { background: rgba(220,38,38,.14); }
.modal-xl .sal-head-amt-prefix {
  font: 700 11px/1 var(--hr-font);
  color: var(--tm);
  background: var(--muted);
  height: 34px; padding: 0 8px;
  display: inline-flex; align-items: center;
  border-radius: 6px;
  border: 1px solid var(--bl);
}

/* Add More button */
.modal-xl .add-more-btn {
  display: inline-flex; align-items: center; gap: 7px;
  height: 36px; padding: 0 18px;
  border-radius: var(--r-f);
  border: 1.5px dashed var(--bm);
  background: transparent;
  color: var(--brand);
  font: 700 12.5px/1 var(--hr-font);
  cursor: pointer;
  transition: var(--tr);
  margin-top: 4px;
}
.modal-xl .add-more-btn:hover { background: var(--brand-light); border-style: solid; }

/* Salary summary */
.modal-xl .sal-summary {
  background: linear-gradient(135deg, rgba(30,58,138,.06), rgba(30,58,138,.02));
  border: 1.5px solid var(--bl);
  border-radius: var(--r-md);
  padding: 14px 16px;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 14px;
  margin-top: 6px;
}
@media (max-width: 720px) {
  .modal-xl .sal-summary { grid-template-columns: 1fr 1fr; }
}
.modal-xl .sal-summary-item  { display: flex; flex-direction: column; gap: 3px; }
.modal-xl .sal-summary-label { font: 800 10px/1 var(--hr-font); color: var(--tm); text-transform: uppercase; letter-spacing: .4px; }
.modal-xl .sal-summary-value { font: 800 15px/1.1 var(--hr-font); color: var(--t1); }
.modal-xl .sal-summary-value.allow  { color: var(--success); }
.modal-xl .sal-summary-value.deduct { color: var(--err); }
.modal-xl .sal-summary-value.net    { color: var(--brand); }

/* Leave Deduction toggle row */
.modal-xl .leave-toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 0;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--bl);
  gap: 12px;
}
.modal-xl .leave-toggle-title { font: 700 13px/1.3 var(--hr-font); color: var(--t1); }
.modal-xl .leave-toggle-sub   { font: 500 11.5px/1.3 var(--hr-font); color: var(--tm); margin-top: 2px; }

/* Toggle switch */
.modal-xl .toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px; height: 24px;
  flex-shrink: 0;
}
.modal-xl .toggle-switch input { opacity: 0; width: 0; height: 0; }
.modal-xl .toggle-slider {
  position: absolute; inset: 0;
  cursor: pointer;
  background: var(--bl);
  border-radius: 24px;
  transition: .25s;
}
.modal-xl .toggle-slider::before {
  position: absolute; content: '';
  height: 18px; width: 18px;
  left: 3px; bottom: 3px;
  background: #fff; border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0,0,0,.2);
  transition: .25s;
}
.modal-xl .toggle-switch input:checked + .toggle-slider { background: var(--brand-mid); }
.modal-xl .toggle-switch input:checked + .toggle-slider::before { transform: translateX(20px); }

/* Documents */
.modal-xl .doc-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  border-radius: var(--r-md);
  border: 1.5px solid var(--bl);
  background: var(--muted);
  margin-bottom: 8px;
  transition: var(--tr);
}
.modal-xl .doc-item:hover { border-color: var(--bm); }
.modal-xl .doc-icon {
  width: 34px; height: 34px;
  border-radius: 9px;
  flex-shrink: 0;
  background: rgba(30,58,138,.1);
  color: #1E40AF;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 14px;
}
.modal-xl .doc-item-name { font: 600 13px/1.2 var(--hr-font); color: var(--t1); }
.modal-xl .doc-item-meta { font: 500 11px/1.2 var(--hr-font); color: var(--tm); margin-top: 3px; }

/* Sub-tabs (Assignments) */
.modal-xl .sub-tabs {
  display: flex; gap: 6px;
  margin-bottom: 18px;
  flex-wrap: wrap;
  background: var(--muted);
  border: 1.5px solid var(--bl);
  border-radius: var(--r-md);
  padding: 4px;
}
.modal-xl .sub-tab {
  flex: 1; min-width: 120px;
  padding: 9px 14px;
  border: none;
  background: transparent;
  font: 600 12.5px/1 var(--hr-font);
  color: var(--tm);
  cursor: pointer;
  border-radius: var(--r-sm);
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  transition: var(--tr);
}
.modal-xl .sub-tab:hover:not(.active) { background: var(--card); color: var(--t1); }
.modal-xl .sub-tab.active             { background: var(--card); color: var(--brand); font-weight: 700; box-shadow: var(--s-xs); }
.modal-xl .sub-tab i { font-size: 11px; }

/* Assignment header strip */
.modal-xl .assign-section-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--bl);
  background: linear-gradient(135deg, rgba(30,58,138,.04), transparent);
}
.modal-xl .assign-section-hint { font: 600 11px/1 var(--hr-font); color: var(--tm); }

/* Assignment tree */
.modal-xl .assign-tree { background: var(--card); overflow: hidden; }
.modal-xl .assign-tree-row { border-bottom: 1px solid var(--bl); }
.modal-xl .assign-tree-row:last-child { border-bottom: none; }
.modal-xl .assign-class-head {
  display: grid;
  grid-template-columns: 42px 1fr 110px 60px;
  align-items: center;
  min-height: 50px;
  padding: 0 14px;
  cursor: pointer;
  transition: var(--tr);
}
.modal-xl .assign-class-head:hover { background: rgba(30,58,138,.03); }
.modal-xl .assign-class-head.open  { background: var(--muted); }
.modal-xl .assign-class-icon {
  width: 28px; height: 28px;
  border-radius: 7px;
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(30,58,138,.12), rgba(30,58,138,.2));
  color: #1E40AF;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px;
}
.modal-xl .assign-class-name  { font: 700 13.5px/1.2 var(--hr-font); color: var(--t1); display: flex; align-items: center; gap: 9px; }
.modal-xl .assign-class-count { display: inline-flex; align-items: center; gap: 4px; font: 700 11px/1 var(--hr-font); color: var(--success); justify-self: end; }
.modal-xl .assign-class-chev  { font-size: 11px; color: var(--tm); transition: var(--tr); justify-self: center; }
.modal-xl .assign-class-chev.open { transform: rotate(180deg); color: var(--brand); }
.modal-xl .assign-section-list { max-height: 0; overflow: hidden; transition: max-height .4s ease; background: linear-gradient(135deg, rgba(30,58,138,.02), transparent); }
.modal-xl .assign-section-list.open { max-height: 3000px; }
.modal-xl .assign-section-row  { border-top: 1px solid var(--bl); }
.modal-xl .assign-section-head {
  display: grid;
  grid-template-columns: 50px 1fr 110px 60px;
  align-items: center;
  min-height: 44px;
  padding: 0 14px 0 30px;
  cursor: pointer;
  transition: var(--tr);
  background: rgba(255,255,255,.4);
}
.modal-xl .assign-section-head:hover { background: rgba(30,58,138,.04); }
[data-theme="dark"] .modal-xl .assign-section-head { background: rgba(14,22,40,.4); }
.modal-xl .assign-section-name {
  font: 700 13px/1.2 var(--hr-font);
  color: var(--t2);
  display: flex; align-items: center; gap: 8px;
}
.modal-xl .assign-section-name::before {
  content: '';
  width: 6px; height: 6px;
  background: var(--bm);
  border-radius: 50%;
  flex-shrink: 0;
}
.modal-xl .assign-subjects-list { max-height: 0; overflow: hidden; transition: max-height .4s ease; }
.modal-xl .assign-subjects-list.open { max-height: 2000px; }
.modal-xl .assign-subjects-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 10px 16px 14px 48px;
  background: var(--muted);
}
.modal-xl .assign-subj-pill {
  display: flex; align-items: center; gap: 9px;
  padding: 9px 12px;
  border: 1.5px solid var(--bl);
  border-radius: var(--r-md);
  background: var(--card);
  cursor: pointer;
  font: 600 12.5px/1.2 var(--hr-font);
  color: var(--t2);
  user-select: none;
  transition: var(--tr);
}
.modal-xl .assign-subj-pill:hover { border-color: var(--bm); }
.modal-xl .assign-subj-pill.checked {
  border-color: var(--brand);
  background: var(--brand-light);
  color: var(--brand);
  font-weight: 700;
}
.modal-xl .assign-subj-pill .check-icon {
  width: 18px; height: 18px;
  border-radius: 5px;
  border: 1.5px solid var(--bm);
  background: var(--card);
  color: transparent;
  font-size: 9px;
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: var(--tr);
}
.modal-xl .assign-subj-pill.checked .check-icon { background: var(--brand); border-color: var(--brand); color: #fff; }

/* Attendance toolbar + grid */
.modal-xl .attend-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px;
  background: var(--muted);
  border-bottom: 1px solid var(--bl);
  flex-wrap: wrap;
  gap: 8px;
}
.modal-xl .attend-toolbar-info        { font: 600 12px/1.2 var(--hr-font); color: var(--t2); }
.modal-xl .attend-toolbar-info strong { color: var(--brand); }
.modal-xl .attend-grid { background: var(--card); overflow: hidden; }
.modal-xl .attend-head {
  display: grid;
  grid-template-columns: 50px 1fr 120px 80px;
  background: var(--muted);
  padding: 0 14px;
  border-bottom: 1px solid var(--bl);
}
.modal-xl .attend-head .th {
  padding: 11px 8px;
  font: 800 11px/1 var(--hr-font);
  color: var(--tm);
  text-transform: uppercase; letter-spacing: .4px;
}
.modal-xl .attend-row {
  display: grid;
  grid-template-columns: 50px 1fr 120px 80px;
  align-items: center;
  min-height: 44px;
  padding: 0 14px;
  border-bottom: 1px solid var(--bl);
  cursor: pointer;
  transition: var(--tr);
}
.modal-xl .attend-row:last-child { border-bottom: none; }
.modal-xl .attend-row:hover     { background: rgba(30,58,138,.03); }
.modal-xl .attend-row.checked   { background: var(--brand-light); }
[data-theme="dark"] .modal-xl .attend-row.checked { background: rgba(59,130,246,.1); }
.modal-xl .attend-row .td       { font: 500 12.5px/1.3 var(--hr-font); color: var(--t1); padding: 0 8px; display: flex; align-items: center; }
.modal-xl .attend-row .td-num   { font-weight: 700; color: var(--tm); }
.modal-xl .attend-row .td-bold  { font-weight: 700; color: var(--t1); }
.modal-xl .attend-checkbox {
  width: 20px; height: 20px;
  border-radius: 5px;
  border: 1.5px solid var(--bm);
  background: var(--card);
  color: transparent;
  font-size: 10px;
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: var(--tr);
}
.modal-xl .attend-row.checked .attend-checkbox { background: var(--brand); border-color: var(--brand); color: #fff; }

/* Footer hint strip */
.modal-xl .modal-foot { gap: 8px; }
.modal-xl .modal-foot-hint {
  flex: 1; min-width: 0;
  display: inline-flex; align-items: center; gap: 6px;
  font: 500 11px/1.3 var(--hr-font);
  color: var(--tm);
}
.modal-xl .modal-foot-hint i { color: var(--info); font-size: 12px; }

@media (max-width: 720px) { .modal-xl .modal-foot-hint { display: none; } }
@media (max-width: 1100px) {
  .modal-xl .f-row-3,
  .modal-xl .sal-heads-grid,
  .modal-xl .sal-summary,
  .modal-xl .assign-subjects-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 720px) {
  .modal-xl .f-row,
  .modal-xl .f-row-3,
  .modal-xl .sal-heads-grid,
  .modal-xl .sal-summary,
  .modal-xl .assign-subjects-grid { grid-template-columns: 1fr; }
  .modal-xl .m-section { padding: 12px 14px; }
  .modal-xl .assign-class-head   { grid-template-columns: 36px 1fr 100px 32px; padding: 0 12px; min-height: 48px; }
  .modal-xl .assign-section-head { grid-template-columns: 36px 1fr 100px 32px; padding: 0 12px 0 26px; }
  .modal-xl .attend-head,
  .modal-xl .attend-row          { grid-template-columns: 40px 1fr 88px 50px; padding: 0 12px; }
  .modal-xl .attend-row .td      { padding: 0 6px; font-size: 12px; }
  .modal-xl .photo-wrap { width: 84px; height: 84px; }
}
@media (max-width: 480px) {
  .modal-xl .assign-subjects-grid { padding: 10px 12px 12px 16px; }
  .modal-xl .assign-section-head  { padding: 0 12px 0 18px; }
  .modal-xl .attend-head .th      { padding: 9px 5px; font-size: 10px; }
  .modal-xl .attend-row           { min-height: 42px; }
  .modal-xl .sal-head-card        { padding: 10px; }
  .modal-xl .sal-summary          { grid-template-columns: 1fr 1fr; padding: 12px; }
  .modal-xl .info-banner          { padding: 9px 11px; }
  .modal-xl .info-banner-text     { font-size: 11px; }
  .modal-xl .module-chip          { font-size: 10px; padding: 2px 7px; }
  .modal-xl .doc-item             { padding: 8px 10px; }
  .modal-xl .doc-icon             { width: 30px; height: 30px; font-size: 12px; }
  .modal-xl .sub-tab              { min-width: 0; padding: 8px 10px; font-size: 11.5px; }
}

/* ═══════════════════════════════════════════════════════════════════
   ACTIONS — Mark Inactive · ID Card · Task Assignment · Letter ·
   Profile Report · Detail Panel CSS. Tokens inherit from .ov scope.
   ═══════════════════════════════════════════════════════════════════ */

/* Priority pills shown inside the chevron-expand task list. */
.p-high   { background: rgba(220,38,38,.1); color: #DC2626; border: 1px solid rgba(220,38,38,.2); padding: 2px 8px; border-radius: var(--r-f); font-size: 10px; font-weight: 700; }
.p-medium { background: rgba(217,119,6,.1); color: #D97706; border: 1px solid rgba(217,119,6,.2); padding: 2px 8px; border-radius: var(--r-f); font-size: 10px; font-weight: 700; }
.p-low    { background: rgba(22,163,74,.1); color: #16A34A; border: 1px solid rgba(22,163,74,.2); padding: 2px 8px; border-radius: var(--r-f); font-size: 10px; font-weight: 700; }

/* ═══════════════════════════════════════════════════════════════════
   STAFF ID CARD
   ═══════════════════════════════════════════════════════════════════ */
.idc-overlay {
  position: fixed; inset: 0;
  background: rgba(10,22,40,.6);
  backdrop-filter: blur(6px);
  z-index: 2500;
  display: none;
  align-items: center; justify-content: center;
  padding: 20px;
  font-family: var(--hr-font);

  /* Re-declare HTML tokens so the overlay isn't affected by ancestor themes */
  --brand: #1E3A8A; --brand-mid: #1E40AF; --brand-light: #DBEAFE;
  --card: #FFFFFF; --muted: #EFF6FF; --inp: #FFFFFF;
  --t1: #0F172A; --t2: #1E3A5F; --tm: #64748B;
  --success: #16A34A; --warn: #D97706; --err: #DC2626; --info: #0284C7;
  --bl: #BFDBFE; --bm: #93C5FD;
  --r-sm: 6px; --r-md: 10px; --r-lg: 14px; --r-xl: 20px; --r-f: 9999px;
  --hr-font: 'Plus Jakarta Sans', 'Segoe UI', sans-serif;
  --tr: all .2s cubic-bezier(.4,0,.2,1);
  --s-xl: 0 20px 50px rgba(30,58,138,.20), 0 8px 16px rgba(0,0,0,.08);
}
.idc-overlay.open { display: flex; }
[data-theme="dark"] .idc-overlay {
  --card: #0E1628; --muted: #131F38; --inp: #0E1628;
  --t1: #E2E8F8; --t2: #B8C8E8; --tm: #6B82A8;
  --brand: #3B82F6; --brand-mid: #2563EB; --brand-light: #1E3A6A;
  --bl: #1C2E50; --bm: #243858;
}
.idc-box {
  background: var(--card);
  border-radius: var(--r-xl);
  width: 100%;
  max-width: 540px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--s-xl);
  border: 1px solid var(--bl);
}
.idc-box .rp-head {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 18px 24px 14px;
  border-bottom: 1px solid var(--bl);
  background: linear-gradient(135deg, rgba(30,58,138,.03), transparent);
  gap: 12px;
}
.idc-box .rp-title { font: 800 16px/1.2 var(--hr-font); color: var(--brand); letter-spacing: -.01em; }
.idc-box .rp-sub   { font: 500 11.5px/1.3 var(--hr-font); color: var(--tm); margin-top: 2px; }
.idc-box .modal-close {
  width: 30px; height: 30px; border-radius: 8px; border: none;
  background: var(--muted); color: var(--tm);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 12px; cursor: pointer;
  transition: var(--tr);
}
.idc-box .modal-close:hover { background: rgba(220,38,38,.1); color: var(--err); }

.idc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  padding: 16px 24px;
}
.idc-card {
  border: 2px solid var(--bl);
  border-radius: var(--r-lg);
  overflow: hidden;
  cursor: pointer;
  transition: var(--tr);
  background: var(--card);
}
.idc-card:hover { border-color: var(--bm); transform: translateY(-2px); box-shadow: 0 2px 6px rgba(30,58,138,.18); }
.idc-card.sel   { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(30,58,138,.12); }
.idc-vert {
  height: 130px;
  background: linear-gradient(160deg, #1E3A8A, #1E40AF);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px;
  padding: 14px;
}
.idc-horiz {
  height: 90px;
  background: linear-gradient(100deg, #1E3A8A, #1E40AF);
  display: flex; align-items: center; gap: 10px;
  padding: 14px;
}
.idc-ph    { width: 36px; height: 36px; border-radius: 6px; background: rgba(255,255,255,.25); flex-shrink: 0; }
.idc-ph-r  { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,.25); flex-shrink: 0; }
.idc-line  { height: 5px; border-radius: 3px; background: rgba(255,255,255,.85); margin-bottom: 4px; }
.idc-line2 { height: 4px; border-radius: 3px; background: rgba(255,255,255,.5); width: 70%; }
.idc-line3 { height: 3px; border-radius: 2px; background: rgba(255,255,255,.3); width: 50%; margin-top: 3px; }
.idc-label { padding: 10px 14px; font: 800 13.5px/1.2 var(--hr-font); color: var(--t1); }
.idc-sub   { padding: 0 14px 10px; font: 500 11px/1.2 var(--hr-font); color: var(--tm); }
.idc-foot  { display: flex; gap: 8px; padding: 14px 24px; border-top: 1px solid var(--bl); }

/* Rendered card preview (front + back) */
.idc-preview {
  padding: 18px 24px;
  display: flex; gap: 18px;
  flex-wrap: wrap;
  justify-content: center;
  background: linear-gradient(180deg, rgba(30,58,138,.04), transparent);
}
.idc-render {
  background: #fff;
  border: 2px solid var(--bl);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(15,23,42,.12);
  color: #0F172A;
}
.idc-render--v { width: 220px; height: 340px; display: flex; flex-direction: column; }
.idc-render--h { width: 340px; height: 220px; display: grid; grid-template-columns: 100px 1fr 40px; }

.idc-r-head {
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff; text-align: center;
  padding: 12px 10px;
}
.idc-r-head--back { background: linear-gradient(135deg, #475569, #334155); }
.idc-r-logo {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: rgba(255,255,255,.2);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 14px;
  margin-bottom: 6px;
}
.idc-r-school { font: 800 13px/1 var(--hr-font); letter-spacing: .4px; }
.idc-r-tag    { font: 500 9.5px/1 var(--hr-font); opacity: .85; margin-top: 4px; }
.idc-r-photo-v {
  width: 80px; height: 80px;
  border-radius: 50%;
  border: 3px solid #1E40AF;
  background: linear-gradient(135deg, #DBEAFE, #BFDBFE);
  color: #1E40AF;
  display: inline-flex; align-items: center; justify-content: center;
  font: 800 22px/1 var(--hr-font);
  margin: 14px auto 8px;
  overflow: hidden;
}
.idc-r-photo-v img { width: 100%; height: 100%; object-fit: cover; }
.idc-r-name {
  text-align: center;
  font: 800 14px/1.1 var(--hr-font);
  color: #0F172A;
  margin: 0 10px;
}
.idc-r-desig {
  text-align: center;
  font: 600 10.5px/1.2 var(--hr-font);
  color: #475569;
  margin: 2px 10px 8px;
}
.idc-r-kv {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 10px;
  padding: 0 14px 10px;
  font: 500 9.5px/1.2 var(--hr-font);
  color: #64748B;
}
.idc-r-kv > div { display: flex; flex-direction: column; gap: 2px; }
.idc-r-kv span { font: 700 8px/1 var(--hr-font); text-transform: uppercase; letter-spacing: .35px; color: #94A3B8; }
.idc-r-kv b    { color: #0F172A; font-weight: 800; }
.idc-r-kv--h   { grid-template-columns: repeat(3, 1fr); gap: 4px 8px; padding: 0; margin-top: 4px; }
.idc-r-foot {
  margin-top: auto;
  background: #F1F5F9;
  border-top: 1px solid #E2E8F0;
  padding: 8px 12px;
  display: flex; align-items: center; justify-content: space-between;
}
.idc-r-qr {
  width: 38px; height: 38px;
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 5px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 26px;
  color: #1E3A8A;
}
.idc-r-validity { font: 600 9.5px/1.3 var(--hr-font); color: #475569; text-align: right; }
.idc-r-validity small { color: #94A3B8; }

.idc-render--h .idc-r-h-left {
  background: linear-gradient(160deg, #1E3A8A, #1E40AF);
  display: flex; align-items: center; justify-content: center;
}
.idc-r-photo-h {
  width: 70px; height: 70px;
  border-radius: 50%;
  border: 3px solid #fff;
  background: rgba(255,255,255,.2);
  color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  font: 800 22px/1 var(--hr-font);
  overflow: hidden;
}
.idc-r-photo-h img { width: 100%; height: 100%; object-fit: cover; }
.idc-r-h-right { padding: 12px 12px 10px; display: flex; flex-direction: column; gap: 4px; }
.idc-r-h-school { font: 800 11px/1 var(--hr-font); color: #1E3A8A; }
.idc-r-h-qr {
  display: flex; align-items: center; justify-content: center;
  background: #F1F5F9;
  border-left: 1px solid #E2E8F0;
  font-size: 24px;
  color: #1E3A8A;
}

.idc-render--back .idc-r-back-body {
  padding: 14px 16px;
  font: 500 10.5px/1.5 var(--hr-font);
  color: #475569;
}
.idc-r-back-body p { margin-bottom: 10px; }
.idc-r-back-kv {
  display: grid; gap: 6px;
  font: 500 10px/1.3 var(--hr-font);
  margin-bottom: 14px;
}
.idc-r-back-kv > div { display: flex; gap: 6px; }
.idc-r-back-kv span { font: 700 9px/1 var(--hr-font); color: #94A3B8; text-transform: uppercase; min-width: 60px; }
.idc-r-back-kv b    { font-weight: 700; color: #0F172A; }
.idc-r-sign      { margin-top: 12px; }
.idc-r-sign-line { height: 1px; background: #94A3B8; margin-bottom: 4px; }
.idc-r-sign-lbl  { font: 700 9.5px/1.2 var(--hr-font); color: #475569; text-align: center; }

/* ═══════════════════════════════════════════════════════════════════
   LETTER GENERATOR MODAL — 1:1 CSS port from "Human Resource .html".
   ═══════════════════════════════════════════════════════════════════ */
.letter-modal { max-width: 1100px; width: 100%; overflow: hidden; }
.letter-modal .modal-body { padding: 0; flex: 1; min-height: 0; overflow: hidden; }

.letter-layout {
  display: grid;
  grid-template-columns: 340px 1fr;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.letter-settings {
  padding: 18px 20px;
  border-right: 1px solid var(--bl);
  overflow-y: auto;
  background: var(--muted);
  scrollbar-width: thin;
  scrollbar-color: var(--bm) transparent;
  min-height: 0;
}
.letter-settings::-webkit-scrollbar { width: 6px; }
.letter-settings::-webkit-scrollbar-thumb { background: var(--bm); border-radius: 3px; }
.letter-settings-title {
  font: 800 11px/1 var(--hr-font);
  color: var(--brand);
  text-transform: uppercase;
  letter-spacing: .6px;
  margin: 10px 0 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.letter-settings-title:first-child { margin-top: 0; }

.letter-preview-wrap {
  padding: 20px;
  overflow-y: scroll;
  overflow-x: auto;
  background: #E8EEF7;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  scrollbar-width: thin;
  scrollbar-color: var(--bm) transparent;
  min-height: 0;
}
[data-theme="dark"] .letter-preview-wrap { background: #0B1322; }
.letter-preview-wrap::-webkit-scrollbar { width: 10px; }
.letter-preview-wrap::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, .04);
  border-radius: 5px;
}
.letter-preview-wrap::-webkit-scrollbar-thumb {
  background: var(--bm);
  border-radius: 5px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.letter-preview-wrap::-webkit-scrollbar-thumb:hover {
  background: var(--brand);
  background-clip: padding-box;
}
.letter-preview-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  max-width: 595px;
  flex-wrap: wrap;
  flex-shrink: 0;
  position: sticky;
  top: -20px;
  background: #E8EEF7;
  padding: 6px 0 4px;
  z-index: 5;
  margin: -6px 0 0;
}
[data-theme="dark"] .letter-preview-toolbar { background: #0B1322; }
.letter-zoom-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: var(--r-f);
  background: var(--card);
  border: 1px solid var(--bl);
  font: 700 11px/1 var(--hr-font);
  color: var(--tm);
}

.letter-sheet {
  width: 595px;
  max-width: 100%;
  min-height: 842px;
  background: #fff;
  color: #0F172A;
  box-shadow: 0 8px 30px rgba(15, 23, 42, .25), 0 2px 6px rgba(15, 23, 42, .1);
  border-radius: 3px;
  padding: 44px 50px;
  font: 500 11.5px/1.55 'Plus Jakarta Sans', sans-serif;
  position: relative;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
.letter-sheet.colorless { filter: grayscale(1); }

.letter-sheet-head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-bottom: 14px;
  border-bottom: 2.5px solid #1E3A8A;
  margin-bottom: 18px;
}
.letter-sheet-logo {
  width: 54px; height: 54px;
  border-radius: 10px;
  background: linear-gradient(135deg, #1a237e, #283593);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  color: #fff;
  font-size: 18px;
}
.letter-sheet-logo img { width: 100%; height: 100%; object-fit: cover; }
.letter-sheet-school { flex: 1; }
.letter-sheet-school-name {
  font: 800 17px/1.1 'Plus Jakarta Sans', sans-serif;
  color: #1E3A8A;
  letter-spacing: -.02em;
  margin-bottom: 2px;
}
.letter-sheet-school-addr { font: 600 9.5px/1.2 'Plus Jakarta Sans', sans-serif; color: #64748B; }
.letter-sheet-ref         { text-align: right; font-size: 9.5px; color: #64748B; }
.letter-sheet-ref strong  { color: #1E3A8A; }

.letter-sheet-meta {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 14px;
  gap: 14px;
  flex-wrap: wrap;
}
.letter-sheet-to { font-size: 10px; color: #475569; }
.letter-sheet-to strong {
  display: block;
  color: #0F172A;
  font: 800 11.5px/1.1 'Plus Jakarta Sans', sans-serif;
  margin-top: 1px;
}
.letter-sheet-date { font: 700 10.5px/1.1 'Plus Jakarta Sans', sans-serif; color: #0F172A; text-align: right; }
.letter-sheet-date span {
  display: block;
  font: 600 9px/1 'Plus Jakarta Sans', sans-serif;
  color: #64748B;
  text-transform: uppercase;
  letter-spacing: .4px;
  margin-bottom: 2px;
}

.letter-sheet-subject {
  font: 800 12px/1.2 'Plus Jakarta Sans', sans-serif;
  color: #0F172A;
  margin-bottom: 14px;
  text-align: center;
  padding: 8px;
  background: #F1F5F9;
  border-radius: 4px;
  border-left: 3px solid #1E3A8A;
}
.letter-sheet-body {
  flex: 1;
  font: 500 10.5px/1.65 'Plus Jakarta Sans', sans-serif;
  color: #1E293B;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.letter-sheet-sign-row {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  margin-top: auto;
  padding-top: 24px;
  flex-wrap: wrap;
}
.letter-sheet-sign { flex: 1; min-width: 110px; text-align: center; }
.letter-sheet-sign-line {
  border-top: 1.5px solid #0F172A;
  padding-top: 4px;
  margin-top: 24px;
  font: 700 9.5px/1.1 'Plus Jakarta Sans', sans-serif;
  color: #0F172A;
}
.letter-sheet-sign-line span {
  display: block;
  font: 600 8.5px/1.1 'Plus Jakarta Sans', sans-serif;
  color: #64748B;
  margin-top: 1px;
}

.letter-sheet-foot {
  margin-top: 10px;
  padding-top: 6px;
  border-top: 1px solid #E2E8F0;
  text-align: center;
  font: 600 8.5px/1.2 'Plus Jakarta Sans', sans-serif;
  color: #94A3B8;
}

.sig-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 11px;
  background: var(--card);
  border: 1px solid var(--bl);
  border-radius: var(--r-md);
  margin-bottom: 6px;
  font-size: 12px;
}
.sig-toggle-row label {
  display: flex;
  align-items: center;
  gap: 7px;
  font-weight: 600;
  color: var(--t1);
  cursor: pointer;
}
.sig-toggle-row input { margin: 0; cursor: pointer; }

/* Responsive: stack letter sidebar */
@media (max-width: 900px) {
  .letter-layout { grid-template-columns: 1fr; }
  .letter-settings { border-right: none; border-bottom: 1px solid var(--bl); }
}

/* ═══════════════════════════════════════════════════════════════════
   PROFILE REPORT — 1:1 CSS port from "Human Resource .html".
   .report-ov is full-screen, toolbar + scrollable sheet stays anchored.
   .report-sheet.colorless applies a grayscale filter for B&W mode.
   ═══════════════════════════════════════════════════════════════════ */
.report-ov {
  position: fixed; inset: 0;
  background: rgba(10, 22, 40, .85);
  backdrop-filter: blur(6px);
  z-index: 2300;
  display: none;
  flex-direction: column;
  padding: 0;

  /* Re-declare HTML tokens locally */
  --brand: #1E3A8A; --brand-mid: #1E40AF; --brand-light: #DBEAFE;
  --card: #FFFFFF; --muted: #EFF6FF;
  --t1: #0F172A; --t2: #1E3A5F; --tm: #64748B;
  --success: #16A34A; --warn: #D97706; --err: #DC2626; --info: #0284C7;
  --bl: #BFDBFE; --bm: #93C5FD;
  --r-sm: 6px; --r-md: 10px; --r-lg: 14px; --r-xl: 20px; --r-f: 9999px;
  --s-sm: 0 2px 6px rgba(30,58,138,.18), 0 1px 2px rgba(0,0,0,.05);
  --hr-font: 'Plus Jakarta Sans', sans-serif;
  --tr: all .2s cubic-bezier(.4,0,.2,1);
}
.report-ov.open { display: flex; }
.report-toolbar {
  height: 54px;
  background: var(--card);
  border-bottom: 1px solid var(--bl);
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  box-shadow: var(--s-sm);
  gap: 12px;
  flex-wrap: wrap;
}
.report-toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}
.report-toolbar-title { font: 800 13.5px/1.2 var(--hr-font); color: var(--t1); }
.report-toolbar-sub   { font: 500 10.5px/1.2 var(--hr-font); color: var(--tm); }
.report-toolbar-right { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.report-toolbar .modal-close {
  width: 30px; height: 30px;
  border-radius: 8px;
  border: none;
  background: var(--muted);
  color: var(--tm);
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--tr);
}
.report-toolbar .modal-close:hover { background: rgba(220, 38, 38, .1); color: var(--err); }
.report-toolbar .btn-edit {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: var(--r-md);
  border: 1.5px solid var(--bl);
  background: var(--card);
  color: var(--t2);
  font: 700 11.5px/1 var(--hr-font);
  cursor: pointer;
  transition: var(--tr);
}
.report-toolbar .btn-edit:hover { border-color: var(--brand); color: var(--brand); }

.report-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 30px 20px;
  background: #E8EEF7;
  scrollbar-width: thin;
}
[data-theme="dark"] .report-scroll { background: #0B1322; }

.report-sheet {
  max-width: 780px;
  margin: 0 auto;
  background: #fff;
  color: #0F172A;
  box-shadow: 0 8px 30px rgba(15, 23, 42, .25);
  border-radius: 4px;
  padding: 36px 40px;
  font: 500 11.5px/1.55 'Plus Jakarta Sans', sans-serif;
}
.report-sheet.colorless { filter: grayscale(1); }

.report-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding-bottom: 18px;
  border-bottom: 3px solid #1E3A8A;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.report-header-left { display: flex; align-items: center; gap: 14px; }
.report-logo {
  width: 60px; height: 60px;
  border-radius: 12px;
  background: linear-gradient(135deg, #1a237e, #283593);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 22px;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(30, 58, 138, .3);
}
.report-school-name { font: 800 20px/1.1 'Plus Jakarta Sans', sans-serif; color: #1E3A8A; letter-spacing: -.02em; margin-bottom: 2px; }
.report-school-tag  { font: 600 11px/1.2 'Plus Jakarta Sans', sans-serif; color: #64748B; }
.report-type-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 9999px;
  background: #1E3A8A;
  color: #fff;
  font: 800 10px/1 'Plus Jakarta Sans', sans-serif;
  letter-spacing: .6px;
  text-transform: uppercase;
  white-space: nowrap;
}

.report-meta {
  display: flex;
  justify-content: space-between;
  font-size: 10.5px;
  color: #475569;
  margin-bottom: 24px;
  padding: 10px 14px;
  background: #F1F5F9;
  border-radius: 6px;
  flex-wrap: wrap;
  gap: 8px;
}
.report-meta strong { color: #0F172A; }

.report-sec { margin-bottom: 22px; page-break-inside: avoid; }
.report-sec-title {
  font: 800 12.5px/1 'Plus Jakarta Sans', sans-serif;
  color: #1E3A8A;
  text-transform: uppercase;
  letter-spacing: .6px;
  padding-bottom: 6px;
  border-bottom: 2px solid #BFDBFE;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 7px;
}
.report-sec-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px; height: 22px;
  border-radius: 50%;
  background: #1E3A8A;
  color: #fff;
  font: 800 10px/1 'Plus Jakarta Sans', sans-serif;
  flex-shrink: 0;
}

.report-overview {
  display: flex;
  gap: 18px;
  align-items: flex-start;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.report-overview-photo {
  width: 90px; height: 110px;
  border-radius: 8px;
  background: linear-gradient(135deg, #E0E7F7, #C4D2EE);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #1E40AF;
  font: 800 28px/1 'Plus Jakarta Sans', sans-serif;
  flex-shrink: 0;
  border: 2px solid #DBEAFE;
  overflow: hidden;
}
.report-overview-photo img { width: 100%; height: 100%; object-fit: cover; }
.report-overview-body { flex: 1; min-width: 200px; }
.report-overview-name { font: 800 17px/1.1 'Plus Jakarta Sans', sans-serif; color: #0F172A; letter-spacing: -.02em; margin-bottom: 3px; }
.report-overview-role { font: 600 11.5px/1.2 'Plus Jakarta Sans', sans-serif; color: #64748B; margin-bottom: 10px; }

.report-kv-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px 14px;
  font-size: 10.5px;
}
.report-kv-grid.g2 { grid-template-columns: repeat(2, 1fr); }
.report-kv-grid.g3 { grid-template-columns: repeat(3, 1fr); }
.report-kv-grid .kv { padding: 4px 0; }
.report-kv-grid .kv label {
  display: block;
  font: 800 8.5px/1 'Plus Jakarta Sans', sans-serif;
  color: #94A3B8;
  letter-spacing: .5px;
  text-transform: uppercase;
  margin-bottom: 1px;
}
.report-kv-grid .kv span {
  display: block;
  font: 700 10.5px/1.3 'Plus Jakarta Sans', sans-serif;
  color: #0F172A;
  word-wrap: break-word;
}

.report-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10.5px;
  margin-top: 4px;
}
.report-table th {
  background: #F1F5F9;
  text-align: left;
  padding: 7px 9px;
  font: 800 9.5px/1 'Plus Jakarta Sans', sans-serif;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: .4px;
  border-bottom: 2px solid #1E3A8A;
}
.report-table td {
  padding: 7px 9px;
  border-bottom: 1px solid #E2E8F0;
  color: #1E293B;
  vertical-align: top;
}
.report-table tr:last-child td { border-bottom: none; }

.report-sal-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-top: 10px;
  padding: 12px;
  background: linear-gradient(135deg, #EFF6FF, #F1F5F9);
  border-radius: 6px;
  border: 1px solid #BFDBFE;
}
.report-sal-item  { text-align: center; }
.report-sal-label {
  font: 800 9px/1 'Plus Jakarta Sans', sans-serif;
  color: #64748B;
  text-transform: uppercase;
  letter-spacing: .5px;
  margin-bottom: 3px;
}
.report-sal-value { font: 800 12.5px/1 'Plus Jakarta Sans', sans-serif; color: #0F172A; }
.report-sal-value.allow  { color: #16A34A; }
.report-sal-value.deduct { color: #DC2626; }
.report-sal-value.net    { color: #1E3A8A; }

.report-duration-card {
  display: flex;
  justify-content: space-between;
  padding: 10px 14px;
  background: #EFF6FF;
  border-radius: 6px;
  border: 1px solid #BFDBFE;
  margin-top: 8px;
  flex-wrap: wrap;
  gap: 10px;
}
.report-duration-card div    { font-size: 10.5px; flex: 1; min-width: 130px; }
.report-duration-card label  {
  display: block;
  font: 800 9px/1 'Plus Jakarta Sans', sans-serif;
  color: #64748B;
  text-transform: uppercase;
  letter-spacing: .4px;
  margin-bottom: 2px;
}
.report-duration-card strong { color: #0F172A; font: 800 12px/1.1 'Plus Jakarta Sans', sans-serif; }

.report-empty {
  padding: 10px;
  font-size: 10.5px;
  color: #94A3B8;
  font-style: italic;
  text-align: center;
  background: #F8FAFC;
  border-radius: 4px;
}

.report-foot {
  margin-top: 30px;
  padding-top: 14px;
  border-top: 2px solid #BFDBFE;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  font: 600 9.5px/1.4 'Plus Jakarta Sans', sans-serif;
  color: #94A3B8;
  flex-wrap: wrap;
  gap: 14px;
}
.report-foot .sig-mini { display: flex; gap: 14px; flex-wrap: wrap; }
.report-foot .sig-mini-item {
  font: 800 9.5px/1 'Plus Jakarta Sans', sans-serif;
  color: #1E3A8A;
  text-align: center;
}
.report-foot .sig-mini-item span {
  display: block;
  border-top: 1px solid #0F172A;
  padding-top: 3px;
  margin-top: 18px;
  color: #0F172A;
  min-width: 80px;
}

/* Print media — hides everything except the sheet */
@media print {
  .report-ov { position: static; background: #fff !important; padding: 0 !important; }
  .report-toolbar { display: none !important; }
  .report-scroll  { padding: 0 !important; overflow: visible !important; background: #fff !important; }
  .report-sheet   { box-shadow: none !important; margin: 0 auto !important; max-width: 100% !important; padding: 24px 30px !important; }
  .report-sec     { page-break-inside: avoid; }
}

/* ═══════════════════════════════════════════════════════════════════
   ProfSection / ProfKv helpers — used by the chevron-expanded
   EmployeeDetailPanel. Minimal base styles only; the
   .emp-detail .prof-* overrides below customise them in-row.
   ═══════════════════════════════════════════════════════════════════ */
.prof-section { margin-top: 14px; }
.prof-section-title {
  font: 800 11.5px/1 var(--hr-font);
  color: var(--brand);
  text-transform: uppercase;
  letter-spacing: .45px;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px dashed var(--bl);
  display: inline-flex;
  align-items: center;
  gap: 7px;
  width: 100%;
}
.prof-kv-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px 18px;
}
.prof-kv      { display: flex; flex-direction: column; gap: 3px; }
.prof-kv-k    {
  font: 700 9.5px/1 var(--hr-font);
  color: var(--tm);
  text-transform: uppercase;
  letter-spacing: .4px;
}
.prof-kv-v {
  font: 600 12.5px/1.3 var(--hr-font);
  color: var(--t1);
  word-break: break-word;
}
.prof-kv.is-hl .prof-kv-v { color: var(--brand); font-weight: 800; }


/* ═══════════════════════════════════════════════════════════════════
   FINANCIALS — Payroll panel CSS (1:1 port from "Human Resource .html")
   ═══════════════════════════════════════════════════════════════════ */

/* Filter bar (Month + Year + status legend) */
.pay-filter-bar {
  display: flex;
  gap: 14px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--bl);
  background: linear-gradient(135deg, rgba(30, 58, 138, .025), transparent);
  align-items: flex-end;
  flex-wrap: wrap;
}
.pay-filter-group {
  flex: 0 0 180px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.pay-filter-group label {
  font: 800 10.5px/1 var(--hr-font);
  color: var(--brand);
  text-transform: uppercase;
  letter-spacing: .7px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.pay-filter-group label i { font-size: 11px; color: var(--brand); opacity: .85; }
.pay-filter-group select {
  padding: 10px 13px;
  border: 1.5px solid var(--bl);
  border-radius: var(--r-md);
  font: 800 13px/1 var(--hr-font);
  color: var(--t1);
  background: var(--card);
  transition: var(--tr);
  letter-spacing: -.01em;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(30, 58, 138, .05);
}
.pay-filter-group select:hover {
  border-color: var(--bm);
  background: linear-gradient(135deg, rgba(30, 58, 138, .03), var(--card));
}
.pay-filter-group select:focus {
  outline: none;
  border-color: var(--brand);
  box-shadow: 0 0 0 4px rgba(30, 58, 138, .1), 0 1px 3px rgba(30, 58, 138, .08);
}

/* Status legend (right-aligned cluster) */
.pay-status-legend {
  margin-left: auto;
  display: flex;
  align-items: flex-end;
  gap: 6px;
  font-size: 11px;
  color: var(--tm);
  font-weight: 700;
  flex-wrap: wrap;
}
.pay-status-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 11px;
  border-radius: var(--r-f);
  border: 1px solid var(--bl);
}
.pay-status-chip i { font-size: 7px; }
.pay-status-chip--notgen  { background: rgba(100, 116, 139, .08); border-color: var(--bl); }
.pay-status-chip--notgen  i { color: #64748B; }
.pay-status-chip--gen     { background: rgba(217, 119, 6, .08); border-color: rgba(217, 119, 6, .2); }
.pay-status-chip--gen     i { color: #D97706; }
.pay-status-chip--partial { background: rgba(2, 132, 199, .08); border-color: rgba(2, 132, 199, .2); }
.pay-status-chip--partial i { color: #0284C7; }
.pay-status-chip--paid    { background: rgba(22, 163, 74, .08); border-color: rgba(22, 163, 74, .2); }
.pay-status-chip--paid    i { color: #16A34A; }

/* Table head + row (8-col grid) */
.pay-t-head {
  display: grid;
  grid-template-columns: 44px 50px 1.05fr 145px 130px 110px 50px 40px;
  padding: 0 14px;
  gap: 6px;
  background: linear-gradient(135deg, rgba(30, 58, 138, .06), rgba(30, 58, 138, .02));
  border-bottom: 2px solid var(--bl);
  min-height: 46px;
  align-items: center;
}
.pay-t-head .th {
  font: 800 10px/1 var(--hr-font);
  color: var(--tm);
  text-transform: uppercase;
  letter-spacing: .5px;
}
.pay-row {
  display: grid;
  grid-template-columns: 44px 50px 1.05fr 145px 130px 110px 50px 40px;
  align-items: center;
  min-height: 64px;
  padding: 0 14px;
  transition: var(--tr);
  gap: 6px;
  border-bottom: 1px solid var(--bl);
}
.pay-row:hover { background: rgba(30, 58, 138, .03); }
.pay-row.open  { background: var(--muted); }
.pay-row .td   { display: flex; align-items: center; font-size: 12.5px; color: var(--t2); }

/* Payment status pill */
.pay-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 11px;
  border-radius: var(--r-f);
  font: 800 10.5px/1 var(--hr-font);
  letter-spacing: .2px;
  white-space: nowrap;
}
.pay-status.notgen  { background: rgba(100, 116, 139, .12); color: #64748B; border: 1px solid rgba(100, 116, 139, .25); }
.pay-status.gen     { background: rgba(217, 119, 6, .12);  color: #D97706; border: 1px solid rgba(217, 119, 6, .25); }
.pay-status.partial { background: rgba(2, 132, 199, .12);  color: #0284C7; border: 1px solid rgba(2, 132, 199, .25); }
.pay-status.paid    { background: rgba(22, 163, 74, .12);  color: #16A34A; border: 1px solid rgba(22, 163, 74, .25); }

/* Reports button */
.btn-reports {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 11px;
  border-radius: var(--r-md);
  border: 1.5px solid var(--bm);
  background: linear-gradient(135deg, rgba(30, 58, 138, .06), rgba(30, 58, 138, .02));
  color: var(--brand);
  font: 800 11.5px/1 var(--hr-font);
  cursor: pointer;
  transition: var(--tr);
  white-space: nowrap;
  letter-spacing: .01em;
}
.btn-reports:hover { background: var(--brand-light); border-color: var(--brand); transform: translateY(-1px); box-shadow: 0 1px 2px rgba(0, 0, 0, .06); }
.btn-reports:active { transform: scale(.96); }
.btn-reports i      { font-size: 11px; }
.btn-reports .chev  { font-size: 9px; margin-left: 1px; opacity: .7; }

/* Expand detail panel */
.pay-panel {
  max-height: 0;
  overflow: hidden;
  transition: max-height .35s cubic-bezier(.4, 0, .2, 1);
  background: var(--muted);
  border-bottom: 1px solid var(--bl);
}
.pay-panel.open { max-height: 600px; overflow-y: auto; }
.pay-panel-inner { padding: 18px 22px; }

.pay-detail-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
.pay-detail-item { display: flex; flex-direction: column; gap: 4px; }
.pay-detail-item label {
  font: 800 10px/1 var(--hr-font);
  color: var(--tm);
  text-transform: uppercase;
  letter-spacing: .4px;
}
.pay-detail-item .val {
  font: 700 13px/1.1 var(--hr-font);
  color: var(--t1);
  padding: 8px 12px;
  background: var(--card);
  border: 1px solid var(--bl);
  border-radius: var(--r-sm);
  min-height: 36px;
  display: flex;
  align-items: center;
}
.pay-detail-item .val.zero { color: var(--tm); }
.pay-detail-item .val.pos  { color: #16A34A; }
.pay-detail-item .val.neg  { color: #DC2626; }

/* Payment transactions list */
.pay-tx-head {
  font: 800 10.5px/1 var(--hr-font);
  color: var(--brand);
  text-transform: uppercase;
  letter-spacing: .5px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.pay-tx-count {
  margin-left: auto;
  font: 700 10px/1 var(--hr-font);
  color: var(--tm);
  padding: 2px 8px;
  border-radius: var(--r-f);
  background: var(--card);
  border: 1px solid var(--bl);
  text-transform: none;
  letter-spacing: 0;
}
.pay-tx-list {
  background: var(--card);
  border: 1px solid var(--bl);
  border-radius: var(--r-md);
  overflow: hidden;
}
.pay-tx-row {
  display: grid;
  grid-template-columns: 28px 110px 1fr 100px;
  gap: 8px;
  padding: 7px 12px;
  align-items: center;
  font: 500 11.5px/1.2 var(--hr-font);
}
.pay-tx-seq  { font: 800 11.5px/1 var(--hr-font); color: var(--brand); }
.pay-tx-amt  { font: 800 11.5px/1 var(--hr-font); color: #16A34A; }
.pay-tx-amt i { font-size: 10px; margin-right: 3px; }
.pay-tx-cmt  { color: var(--tm); font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pay-tx-date { text-align: right; color: var(--t2); font-size: 11px; }

/* Responsive collapses for the 8-col grid */
@media (max-width: 1100px) {
  .pay-t-head,
  .pay-row { grid-template-columns: 40px 48px 1fr 105px 115px 100px 50px 40px; gap: 5px; }
  .pay-t-head .th:nth-child(4),
  .pay-row .td:nth-child(4) { display: none; }
}
@media (max-width: 900px) {
  .pay-t-head,
  .pay-row { grid-template-columns: 38px 46px 1fr 105px 100px 50px 40px; gap: 5px; }
  .pay-t-head .th:nth-child(5),
  .pay-row .td:nth-child(5) { display: none; }
  .pay-detail-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 768px) {
  .pay-t-head { display: none !important; }
  .pay-row {
    grid-template-columns: 42px 1fr auto !important;
    gap: 8px;
    padding: 12px 10px;
    align-items: start;
    min-height: 64px;
  }
  .pay-row .td:nth-child(1) { display: none; }
  .pay-row .td:nth-child(2) { grid-column: 1; }
  .pay-row .td:nth-child(3) { grid-column: 2; flex-direction: column; align-items: flex-start; gap: 4px; width: 100%; }
  .pay-row .td:nth-child(4),
  .pay-row .td:nth-child(5),
  .pay-row .td:nth-child(6) { display: none; }
  .pay-row .td:nth-child(7) { grid-column: 3; }
  .pay-row .td:nth-child(8) { display: none; }
  .pay-status-chip { font-size: 10px; padding: 6px 9px; }
  .btn-reports .label-full { display: none; }
  .pay-detail-grid { grid-template-columns: 1fr; }
}

/* ═══════════════════════════════════════════════════════════════════
   PAY ROLL MODAL — 1:1 CSS port from "Human Resource .html".
   ═══════════════════════════════════════════════════════════════════ */

/* Section blocks */
.pr-section {
  background: var(--muted);
  border: 1px solid var(--bl);
  border-radius: var(--r-lg);
  padding: 16px 18px;
  margin-bottom: 14px;
}
.pr-section-title {
  font: 800 12px/1 var(--hr-font);
  color: var(--brand);
  text-transform: uppercase;
  letter-spacing: .6px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--bl);
}
.pr-section-title i { font-size: 13px; }

/* 4-col / 3-col / 2-col grid */
.pr-grid    { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.pr-grid.g3 { grid-template-columns: repeat(3, 1fr); }
.pr-grid.g2 { grid-template-columns: repeat(2, 1fr); }

.pr-field        { display: flex; flex-direction: column; gap: 4px; }
.pr-field label  { font: 700 10.5px/1.2 var(--hr-font); color: var(--t2); letter-spacing: .2px; }
.pr-field input,
.pr-field select,
.pr-field textarea {
  padding: 9px 12px;
  border: 1.5px solid var(--bl);
  border-radius: var(--r-sm);
  font: 600 12.5px/1.2 var(--hr-font);
  background: var(--card);
  color: var(--t1);
  transition: var(--tr);
}
.pr-field input:focus,
.pr-field select:focus,
.pr-field textarea:focus {
  outline: none;
  border-color: var(--brand);
  box-shadow: 0 0 0 3px rgba(30, 58, 138, .08);
}
.pr-field input[readonly] {
  background: var(--muted);
  color: var(--tm);
  cursor: not-allowed;
  font-weight: 700;
}
.pr-field input.computed {
  background: linear-gradient(135deg, rgba(30, 58, 138, .06), rgba(30, 58, 138, .02));
  color: var(--brand);
  font-weight: 800;
  border-color: var(--bm);
}
.pr-field-wide { grid-column: span 2; }
.pr-field-full { grid-column: 1 / -1; }
.pr-field-hint { font: 500 10px/1.3 var(--hr-font); color: var(--tm); font-style: italic; margin-top: 2px; }

/* Brand-blue Net Payable hero */
.pr-net-card {
  background: linear-gradient(135deg, #1E40AF, #1E3A8A);
  color: #fff;
  border-radius: var(--r-lg);
  padding: 18px 22px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 18px;
  align-items: center;
  box-shadow: 0 6px 20px rgba(30, 58, 138, .25);
  margin-top: 8px;
}
.pr-net-card .pr-net-label {
  font: 700 11px/1 var(--hr-font);
  letter-spacing: .6px;
  text-transform: uppercase;
  opacity: .92;
  margin-bottom: 6px;
}
.pr-net-card .pr-net-amount { font: 800 28px/1 var(--hr-font); letter-spacing: -.02em; }
.pr-net-card .pr-net-amount small { font: 600 14px/1 var(--hr-font); opacity: .85; margin-left: 6px; }
.pr-net-side { text-align: right; display: flex; flex-direction: column; gap: 6px; }
.pr-net-side .row {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: center;
  font: 500 11.5px/1.2 var(--hr-font);
  opacity: .95;
}
.pr-net-side .row strong { font: 800 13px/1 var(--hr-font); }

/* Settlement tiles (Make Payment) */
.settle-tiles {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 14px;
}
.settle-tile {
  background: var(--card);
  border: 1.5px solid var(--bl);
  border-radius: var(--r-lg);
  padding: 12px 14px;
  transition: var(--tr);
}
.settle-tile .lbl {
  font: 800 10px/1 var(--hr-font);
  color: var(--tm);
  text-transform: uppercase;
  letter-spacing: .5px;
  margin-bottom: 5px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.settle-tile .lbl i { font-size: 11px; }
.settle-tile .val {
  font: 800 18px/1.1 var(--hr-font);
  color: var(--t1);
  letter-spacing: -.01em;
}
.settle-tile.net      { background: linear-gradient(135deg, rgba(30, 58, 138, .06), rgba(30, 58, 138, .02)); border-color: var(--bm); }
.settle-tile.net .val { color: var(--brand); }
.settle-tile.net .lbl i { color: var(--brand); }
.settle-tile.paid     { background: linear-gradient(135deg, rgba(22, 163, 74, .06), rgba(22, 163, 74, .02)); border-color: rgba(22, 163, 74, .25); }
.settle-tile.paid .val,
.settle-tile.paid .lbl i { color: #16A34A; }
.settle-tile.remaining     { background: linear-gradient(135deg, rgba(217, 119, 6, .06), rgba(217, 119, 6, .02)); border-color: rgba(217, 119, 6, .25); }
.settle-tile.remaining .val,
.settle-tile.remaining .lbl i { color: #D97706; }
.settle-tile.remaining.zero     { background: linear-gradient(135deg, rgba(22, 163, 74, .06), rgba(22, 163, 74, .02)); border-color: rgba(22, 163, 74, .25); }
.settle-tile.remaining.zero .val,
.settle-tile.remaining.zero .lbl i { color: #16A34A; }

/* Payment history (Make Payment) */
.pay-history-box {
  margin-top: 12px;
  border: 1px solid var(--bl);
  border-radius: var(--r-lg);
  background: var(--card);
  overflow: hidden;
}
.pay-history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: linear-gradient(135deg, rgba(30, 58, 138, .04), transparent);
  border-bottom: 1px solid var(--bl);
  font: 800 11px/1 var(--hr-font);
  color: var(--brand);
  text-transform: uppercase;
  letter-spacing: .4px;
}
.pay-history-head i { margin-right: 5px; }
.pay-history-head .count {
  font: 700 10px/1 var(--hr-font);
  color: var(--tm);
  padding: 2px 9px;
  border-radius: var(--r-f);
  background: var(--muted);
  border: 1px solid var(--bl);
  text-transform: none;
  letter-spacing: 0;
}
.pay-history-row {
  display: grid;
  grid-template-columns: 32px 110px 1fr 110px;
  gap: 10px;
  align-items: center;
  padding: 9px 14px;
  border-bottom: 1px solid var(--bl);
  font-size: 12px;
  transition: var(--tr);
}
.pay-history-row:last-child { border-bottom: none; }
.pay-history-row:hover     { background: rgba(30, 58, 138, .03); }
.pay-history-row .seq {
  font: 800 11px/1 var(--hr-font);
  color: var(--brand);
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px;
  border-radius: 50%;
  background: var(--brand-light);
  border: 1px solid var(--bm);
}
.pay-history-row .amt {
  font: 800 13px/1 var(--hr-font);
  color: #16A34A;
  display: flex; align-items: center; gap: 5px;
}
.pay-history-row .cmt {
  color: var(--tm);
  font-style: italic;
  font-size: 11.5px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.pay-history-row .dt {
  text-align: right;
  font: 600 11px/1 var(--hr-font);
  color: var(--t2);
  display: flex; align-items: center; justify-content: flex-end; gap: 5px;
}
.pay-history-row .dt i { font-size: 9px; color: var(--tm); }
.pay-history-empty {
  padding: 18px;
  text-align: center;
  color: var(--tm);
  font-size: 12.5px;
}
.pay-history-empty i {
  font-size: 22px;
  color: var(--brand);
  opacity: .4;
  display: block;
  margin-bottom: 6px;
}

/* Responsive: stack the 4-col grids on small screens */
@media (max-width: 900px) {
  .pr-grid       { grid-template-columns: repeat(2, 1fr); }
  .pr-grid.g3    { grid-template-columns: repeat(2, 1fr); }
  .settle-tiles  { grid-template-columns: 1fr; }
  .pr-net-card   { grid-template-columns: 1fr; }
  .pr-net-side   { text-align: left; }
  .pay-history-row { grid-template-columns: 28px 110px 1fr; }
  .pay-history-row .dt { display: none; }
}
@media (max-width: 600px) {
  .pr-grid, .pr-grid.g3, .pr-grid.g2 { grid-template-columns: 1fr; }
  .pr-field-wide, .pr-field-full { grid-column: 1 / -1; }
}

/* ═══════════════════════════════════════════════════════════════════
   ADVANCE / LOAN MODAL — 1:1 CSS port from "Human Resource .html".
   ═══════════════════════════════════════════════════════════════════ */

/* Summary card (Active / Outstanding / Returned) */
.al-summary-card {
  background: linear-gradient(135deg, rgba(30, 58, 138, .06), rgba(30, 58, 138, .02));
  border: 1px solid var(--bm);
  border-radius: var(--r-lg);
  padding: 14px 18px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 14px;
}
.al-summary-item { display: flex; flex-direction: column; gap: 4px; }
.al-summary-item label {
  font: 800 10px/1 var(--hr-font);
  color: var(--tm);
  text-transform: uppercase;
  letter-spacing: .4px;
}
.al-summary-item .val {
  font: 800 18px/1 var(--hr-font);
  color: var(--brand);
  letter-spacing: -.01em;
}
.al-summary-item .val.warn    { color: var(--warn); }
.al-summary-item .val.success { color: var(--success); }

/* Loan card (History tab) */
.loan-card {
  background: var(--card);
  border: 1.5px solid var(--bl);
  border-radius: var(--r-lg);
  padding: 14px 16px;
  margin-bottom: 10px;
  transition: var(--tr);
}
.loan-card:hover    { border-color: var(--bm); box-shadow: var(--s-sm); }
.loan-card.returned { opacity: .7; background: var(--muted); }

.loan-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  gap: 10px;
  flex-wrap: wrap;
}
.loan-card-title {
  font: 800 14px/1 var(--hr-font);
  color: var(--t1);
  display: flex;
  align-items: center;
  gap: 8px;
}
.loan-card-title i { color: var(--brand); }
.loan-card-status {
  font: 800 10px/1 var(--hr-font);
  padding: 3px 9px;
  border-radius: var(--r-f);
  letter-spacing: .3px;
  text-transform: uppercase;
}
.loan-card-status.active   { background: rgba(217, 119, 6, .12); color: var(--warn);    border: 1px solid rgba(217, 119, 6, .25); }
.loan-card-status.returned { background: rgba(22, 163, 74, .12); color: var(--success); border: 1px solid rgba(22, 163, 74, .25); }

.loan-card-body {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 10px;
}
.loan-card-field        { display: flex; flex-direction: column; gap: 3px; }
.loan-card-field label  {
  font: 800 9.5px/1 var(--hr-font);
  color: var(--tm);
  text-transform: uppercase;
  letter-spacing: .4px;
}
.loan-card-field .val           { font: 700 12.5px/1.1 var(--hr-font); color: var(--t1); }
.loan-card-field .val.amount    { color: var(--brand); font-size: 14px; }
.loan-card-field .val.remaining { color: var(--warn); }

.loan-card-comment {
  font: 500 11.5px/1.4 var(--hr-font);
  color: var(--tm);
  font-style: italic;
  padding: 6px 10px;
  background: var(--muted);
  border-radius: var(--r-sm);
  border-left: 3px solid var(--bm);
}

.loan-repayments {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--bl);
}
.loan-repayments-title {
  font: 800 10px/1 var(--hr-font);
  color: var(--tm);
  text-transform: uppercase;
  letter-spacing: .4px;
  margin-bottom: 6px;
}
.repayment-row {
  display: grid;
  grid-template-columns: 120px 1fr 130px;
  gap: 10px;
  font: 500 11.5px/1.2 var(--hr-font);
  padding: 5px 0;
  align-items: center;
}
.repayment-row .amt { font-weight: 800; color: var(--success); }
.repayment-row .cmt { color: var(--tm); font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.repayment-row .dt  { color: var(--t2); text-align: right; font-size: 11px; }

@media (max-width: 1100px) {
  .loan-card-body { grid-template-columns: repeat(2, 1fr); }
  .al-summary-card { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 768px) {
  .al-summary-card { grid-template-columns: 1fr; }
  .loan-card-body  { grid-template-columns: 1fr 1fr; }
  .repayment-row   { grid-template-columns: 1fr 1fr; }
  .repayment-row .dt { grid-column: 1 / -1; text-align: left; }
}

/* ═══════════════════════════════════════════════════════════════════
   REPORTS STYLE PICKER — 1:1 CSS port from "Human Resource .html".
   ═══════════════════════════════════════════════════════════════════ */

/* Style cards (Colorful vs B&W) */
.style-pick-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 6px;
}
.style-pick-card {
  background: var(--card);
  border: 2px solid var(--bl);
  border-radius: var(--r-lg);
  padding: 14px;
  cursor: pointer;
  transition: var(--tr);
  position: relative;
  overflow: hidden;
  text-align: left;
}
.style-pick-card:hover  { border-color: var(--brand); transform: translateY(-3px); box-shadow: var(--s-md); }
.style-pick-card:active { transform: translateY(-1px) scale(.98); }

.style-pick-preview {
  border-radius: var(--r-md);
  padding: 12px;
  margin-bottom: 11px;
  border: 1px solid #E5E7EB;
  min-height: 130px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
  overflow: hidden;
}
.style-pick-preview.color { background: linear-gradient(135deg, #F0F4FF, #FFFFFF); }
.style-pick-preview.color .ppl-head {
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  padding: 6px 9px;
  border-radius: 5px;
  font: 800 9.5px/1 var(--hr-font);
  display: flex; align-items: center; gap: 5px;
}
.style-pick-preview.color .ppl-head i { font-size: 10px; }
.style-pick-preview.color .ppl-row {
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(90deg, #BFDBFE 0%, #1E40AF 50%, #BFDBFE 100%);
  opacity: .7;
}
.style-pick-preview.color .ppl-row.short { width: 60%; }
.style-pick-preview.color .ppl-row.mid   { width: 80%; }
.style-pick-preview.color .ppl-pill {
  height: 14px;
  width: 55px;
  border-radius: 9999px;
  background: linear-gradient(135deg, #16A34A, #22C55E);
  margin-top: 3px;
}
.style-pick-preview.color .ppl-tile {
  background: linear-gradient(135deg, #1E40AF, #1E3A8A);
  color: #fff;
  border-radius: 6px;
  padding: 5px 7px;
  font: 800 8.5px/1 var(--hr-font);
  display: inline-block;
  margin-top: 4px;
}
.style-pick-preview.bw { background: #FFFFFF; border: 1px dashed #D1D5DB; }
.style-pick-preview.bw .ppl-head {
  background: transparent;
  color: #000;
  padding: 5px 0;
  border-bottom: 1.5px solid #000;
  font: 800 9.5px/1 var(--hr-font);
  display: flex; align-items: center; gap: 5px;
  letter-spacing: .5px;
  text-transform: uppercase;
}
.style-pick-preview.bw .ppl-head i { font-size: 10px; color: #000; }
.style-pick-preview.bw .ppl-row {
  height: 5px;
  border-radius: 0;
  background: #D1D5DB;
  border: 1px solid #9CA3AF;
  opacity: .55;
}
.style-pick-preview.bw .ppl-row.short { width: 60%; }
.style-pick-preview.bw .ppl-row.mid   { width: 80%; }
.style-pick-preview.bw .ppl-pill {
  height: 13px;
  width: 55px;
  border-radius: 9999px;
  background: transparent;
  border: 1.2px solid #6B7280;
  margin-top: 3px;
}
.style-pick-preview.bw .ppl-tile {
  background: transparent;
  color: #000;
  border: 1.2px solid #000;
  border-radius: 3px;
  padding: 4px 7px;
  font: 800 8.5px/1 var(--hr-font);
  display: inline-block;
  margin-top: 4px;
}

.style-pick-info       { display: flex; flex-direction: column; gap: 4px; }
.style-pick-title {
  font: 800 13px/1 var(--hr-font);
  color: var(--t1);
  display: flex; align-items: center; gap: 7px;
}
.style-pick-title i              { color: var(--brand); font-size: 12px; }
.style-pick-card.bw-card .style-pick-title i { color: #64748B; }
.style-pick-desc {
  font: 500 11px/1.45 var(--hr-font);
  color: var(--tm);
}

.style-pick-tag {
  position: absolute;
  top: 8px; right: 8px;
  font: 800 8.5px/1 var(--hr-font);
  color: var(--brand);
  background: var(--brand-light);
  padding: 3px 8px;
  border-radius: var(--r-f);
  letter-spacing: .3px;
}
.style-pick-card.bw-card .style-pick-tag {
  color: #374151;
  background: #F3F4F6;
  border: 1px solid #D1D5DB;
}

/* Date pickers row */
.rsp-range-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  background: linear-gradient(135deg, rgba(30, 58, 138, .04), transparent);
  border: 1.5px solid var(--bl);
  border-radius: var(--r-md);
  padding: 11px 13px;
  margin-bottom: 14px;
}
.rsp-range-row .rsp-field { display: flex; flex-direction: column; gap: 4px; }
.rsp-range-row .rsp-field label {
  font: 800 10px/1 var(--hr-font);
  color: var(--tm);
  text-transform: uppercase;
  letter-spacing: .4px;
  display: flex; align-items: center; gap: 5px;
}
.rsp-range-row .rsp-field label i { color: var(--brand); font-size: 11px; }
.rsp-range-row .rsp-field input {
  padding: 8px 11px;
  border: 1.5px solid var(--bl);
  border-radius: var(--r-sm);
  font: 700 12.5px/1 var(--hr-font);
  background: var(--card);
  color: var(--t1);
  transition: var(--tr);
}
.rsp-range-row .rsp-field input:focus {
  outline: none;
  border-color: var(--brand);
  box-shadow: 0 0 0 3px rgba(30, 58, 138, .08);
}

@media (max-width: 600px) {
  .style-pick-grid { grid-template-columns: 1fr; }
}

/* ═══════════════════════════════════════════════════════════════════
   HR REPORTS — Reports tab cards (1:1 port from "Human Resource .html").
   ═══════════════════════════════════════════════════════════════════ */
.hr-rpt-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 22px;
}
.hr-rpt-card {
  background: var(--card);
  border: 1.5px solid var(--bl);
  border-radius: var(--r-xl);
  padding: 18px 20px;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  cursor: pointer;
  transition: var(--tr);
  box-shadow: var(--s-sm);
}
.hr-rpt-card:hover {
  border-color: var(--bm);
  transform: translateY(-2px);
  box-shadow: var(--s-md);
}
.hr-rpt-icon {
  width: 46px; height: 46px;
  border-radius: 14px;
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
}
.hr-rpt-body { flex: 1; min-width: 0; }
.hr-rpt-name {
  font: 800 14px/1.1 var(--hr-font);
  color: var(--t1);
  margin-bottom: 4px;
}
.hr-rpt-desc {
  font: 500 11.5px/1.5 var(--hr-font);
  color: var(--tm);
  margin-bottom: 8px;
}
.hr-rpt-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.hr-rpt-chips span {
  font: 700 10px/1 var(--hr-font);
  padding: 2px 9px;
  border-radius: var(--r-f);
  background: var(--muted);
  color: var(--tm);
  border: 1px solid var(--bl);
}
.hr-rpt-arrow {
  width: 28px; height: 28px;
  border-radius: 50%;
  border: 1.5px solid var(--bl);
  background: var(--muted);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px;
  color: var(--tm);
  flex-shrink: 0;
  margin-top: 2px;
  transition: var(--tr);
}
.hr-rpt-card:hover .hr-rpt-arrow {
  border-color: var(--brand);
  color: var(--brand);
  background: var(--brand-light);
}
@media (max-width: 900px) {
  .hr-rpt-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 600px) {
  .hr-rpt-grid { grid-template-columns: 1fr; }
}

/* ═══════════════════════════════════════════════════════════════════
   EMPLOYEE DETAIL PANEL (chevron expanded)
   ═══════════════════════════════════════════════════════════════════ */
.emp-detail { display: flex; flex-direction: column; gap: 14px; }
.emp-detail .prof-section { background: var(--card); border: 1px solid var(--bl); border-radius: var(--r-md); padding: 14px 16px; margin-top: 0; }
.emp-detail .prof-section-title { color: var(--brand); border-bottom-color: var(--bl); width: auto; padding-right: 12px; }
.emp-detail .prof-kv-v { color: var(--t1); }
.emp-detail .prof-kv-k { color: var(--tm); }

.emp-detail-mini {
  background: var(--card);
  border: 1px solid var(--bl);
  border-radius: var(--r-md);
  padding: 12px 14px;
}
.emp-detail-mini-title {
  font: 800 11px/1 var(--hr-font);
  color: var(--brand);
  text-transform: uppercase;
  letter-spacing: .45px;
  margin-bottom: 8px;
  display: inline-flex; align-items: center; gap: 7px;
}
.emp-detail-pills { display: flex; flex-wrap: wrap; gap: 6px; }
.emp-detail-pill {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 9px;
  border-radius: var(--r-f);
  font: 700 11px/1 var(--hr-font);
  border: 1px solid var(--bl);
}
.emp-detail-pill--allow  { background: rgba(22,163,74,.08); color: #16A34A; border-color: rgba(22,163,74,.25); }
.emp-detail-pill--deduct { background: rgba(220,38,38,.08); color: #DC2626; border-color: rgba(220,38,38,.25); }
.emp-detail-pill--subj   { background: rgba(2,132,199,.08); color: #0284C7; border-color: rgba(2,132,199,.25); }
.emp-detail-pill--att    { background: rgba(217,119,6,.08); color: #D97706; border-color: rgba(217,119,6,.25); }

.emp-detail-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.emp-detail-col {
  background: var(--card);
  border: 1px solid var(--bl);
  border-radius: var(--r-md);
  padding: 12px 14px;
}
.emp-detail-empty {
  text-align: center;
  font: 500 12px/1.4 var(--hr-font);
  color: var(--tm);
  padding: 16px 8px;
  border: 1px dashed var(--bl);
  border-radius: var(--r-md);
  background: var(--muted);
}

.emp-detail-docs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.emp-detail-doc {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px;
  border-radius: var(--r-md);
  background: var(--muted);
  border: 1px solid var(--bl);
}
.emp-detail-doc.is-up { background: rgba(22,163,74,.06); border-color: rgba(22,163,74,.2); }
.emp-detail-doc-icn {
  width: 26px; height: 26px;
  border-radius: 7px;
  background: rgba(30,58,138,.1);
  color: var(--brand);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px;
}
.emp-detail-doc.is-up .emp-detail-doc-icn { background: rgba(22,163,74,.12); color: #16A34A; }
.emp-detail-doc-info { flex: 1; min-width: 0; }
.emp-detail-doc-name { font: 700 11.5px/1.1 var(--hr-font); color: var(--t1); }
.emp-detail-doc-meta { font: 500 10px/1.2 var(--hr-font); color: var(--tm); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.emp-detail-task {
  padding: 10px 12px;
  background: var(--muted);
  border: 1px solid var(--bl);
  border-radius: var(--r-md);
  margin-bottom: 6px;
}
.emp-detail-task-title { font: 700 12px/1.2 var(--hr-font); color: var(--t1); margin-bottom: 4px; display: inline-flex; align-items: center; gap: 6px; }
.emp-detail-task-title i { color: var(--brand); font-size: 10px; }
.emp-detail-task-meta { display: inline-flex; flex-wrap: wrap; gap: 5px; align-items: center; font: 600 10px/1 var(--hr-font); color: var(--tm); }

.emp-detail-letters { display: flex; flex-direction: column; gap: 6px; }
.emp-detail-letter {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px;
  background: var(--muted);
  border: 1px solid var(--bl);
  border-radius: var(--r-md);
  gap: 10px;
}
.emp-detail-letter-l { display: flex; align-items: center; gap: 9px; }
.emp-detail-letter-l > i { width: 26px; height: 26px; border-radius: 7px; background: rgba(30,58,138,.1); color: var(--brand); display: inline-flex; align-items: center; justify-content: center; font-size: 11px; }
.emp-detail-letter-title { font: 700 12px/1.2 var(--hr-font); color: var(--t1); }
.emp-detail-letter-meta  { font: 500 10.5px/1.2 var(--hr-font); color: var(--tm); margin-top: 2px; }
.emp-detail-letter-style {
  font: 800 9.5px/1 var(--hr-font);
  text-transform: uppercase;
  letter-spacing: .35px;
  background: rgba(2,132,199,.1);
  color: #0284C7;
  border: 1px solid rgba(2,132,199,.25);
  padding: 4px 9px;
  border-radius: var(--r-f);
}

@media (max-width: 720px) {
  .emp-detail .prof-kv-grid { grid-template-columns: 1fr 1fr; }
  .emp-detail-cols          { grid-template-columns: 1fr; }
  .emp-detail-docs          { grid-template-columns: 1fr; }
}

/* ═══════════════════════════════════════════════════════════════════
   MOBILE RESPONSIVE — internal HR screen layouts (≤ 600px)
   Only adds; leaves existing rules, ID-card / letter-sheet / signed-
   letter / payroll-PDF / barcode / 80mm print CSS untouched.
   ═══════════════════════════════════════════════════════════════════ */
@media (max-width: 600px) {
  /* HR top tabs (Departments / Designations / Employees / Payroll / Leaves / Loans / Reports) */
  .hr-tabs { overflow-x: auto; flex-wrap: nowrap; scrollbar-width: none; -ms-overflow-style: none; gap: 4px; padding: 4px; }
  .hr-tabs::-webkit-scrollbar { display: none; }
  .hr-tabs > * { flex: 0 0 auto; white-space: nowrap; font-size: 12px; padding: 8px 12px; }

  /* Sub-tabs (Employees: Active / Inactive / Bulk Import) */
  .emp-subtabs { overflow-x: auto; flex-wrap: nowrap; scrollbar-width: none; -ms-overflow-style: none; }
  .emp-subtabs::-webkit-scrollbar { display: none; }
  .emp-subtabs > * { flex: 0 0 auto; white-space: nowrap; }

  /* Card-header (Departments / Designations) — stack title + actions */
  .card-header { flex-direction: column; align-items: stretch; gap: 10px; padding: 12px 12px; }
  .card-title { font-size: 13px; }
  .card-header .btn-add,
  .card-header .btn-primary { width: 100%; justify-content: center; }

  /* Department list panel */
  .dept-panel-inner { padding: 10px 10px 14px; }
  .dept-row-name { font-size: 13px; }
  .dept-row-actions { flex-wrap: wrap; gap: 4px; }

  /* Designation rows */
  .desig-row { padding: 10px 10px; }

  /* Employee search/filter toolbar */
  .emp-search-wrap { flex: 1 1 100%; min-width: 0; max-width: none; }
  .emp-search { width: 100%; font-size: 12.5px; }
  .emp-panel-inner { padding: 10px 8px; }

  /* Employee list row — already collapses; reduce padding & font */
  .emp-row { padding: 10px 8px !important; }
  .emp-row-name { font-size: 13px; }
  .emp-row-eid { font-size: 11px; }
  .emp-avatar { width: 38px; height: 38px; font-size: 13px; }
  .emp-chips { flex-wrap: wrap; gap: 4px; }
  .emp-chips > * { font-size: 10.5px; padding: 2px 6px; }

  /* Add / Edit Employee modal — wide ones become near full-screen */
  .modal.modal-xl,
  .modal.modal-lg { max-width: 96vw !important; }
  .modal-head { padding: 12px 14px; gap: 8px; flex-wrap: wrap; }
  .modal-head-left { gap: 8px; min-width: 0; }
  .modal-head-icon { width: 36px; height: 36px; font-size: 14px; }
  .modal-title { font-size: 14px; }
  .modal-sub { font-size: 11px; }
  .modal-body { padding: 14px 14px !important; }
  .modal-foot { padding: 12px 14px; flex-wrap: wrap; gap: 8px; }
  .modal-foot > .btn-primary,
  .modal-foot > .btn-secondary,
  .modal-foot > .btn { flex: 1 1 auto; min-width: 0; }
  .modal-foot-hint { display: none; }

  /* Add Employee inner sub-tabs (m-tabs: Basic Info / Contact / Salary / Docs / etc.) */
  .m-tabs { overflow-x: auto; flex-wrap: nowrap; scrollbar-width: none; -ms-overflow-style: none; padding: 4px; gap: 4px; }
  .m-tabs::-webkit-scrollbar { display: none; }
  .m-tabs > * { flex: 0 0 auto; white-space: nowrap; font-size: 12px; }

  /* Form grids — collapse to 1 col */
  .f-row, .f-row-3 { grid-template-columns: 1fr !important; gap: 10px; }
  .emp-form-grid,
  .emp-form-grid.g4 { grid-template-columns: 1fr !important; gap: 10px; }
  .pr-grid, .pr-grid.g2 { grid-template-columns: 1fr !important; gap: 10px; }
  .assign-subjects-grid { grid-template-columns: 1fr !important; }

  /* Profile sections inside employee detail */
  .prof-kv-grid { grid-template-columns: 1fr 1fr !important; gap: 8px 10px; }
  .prof-section { padding: 12px 12px; }
  .prof-section-title { font-size: 12px; }
  .emp-detail-cols { grid-template-columns: 1fr !important; gap: 12px; }
  .emp-detail-docs { grid-template-columns: 1fr !important; }
  .emp-detail-pills { flex-wrap: wrap; gap: 6px; }
  .emp-detail-letters { grid-template-columns: 1fr !important; }

  /* Payroll filter bar — wrap */
  .pay-filter-bar { flex-direction: column; align-items: stretch; gap: 8px; padding: 10px; }
  .pay-filter-group { flex: 1 1 100%; flex-wrap: wrap; gap: 8px; }
  .pay-filter-group > * { flex: 1 1 auto; min-width: 0; }

  /* Payroll table — horizontal scroll */
  .pay-panel-inner { overflow-x: auto; -webkit-overflow-scrolling: touch; padding: 10px 8px; }
  .pay-t-head { display: grid !important; min-width: 760px; }
  .ppl-row,
  .ppl-row.mid,
  .ppl-row.short { min-width: 760px; }
  .ppl-head { min-width: 760px; }
  .pay-history-head,
  .pay-history-row { padding: 8px 10px; gap: 6px; }
  .pay-history-row { flex-wrap: wrap; }
  .pay-detail-grid { grid-template-columns: 1fr !important; gap: 8px; }
  .pay-status-legend { flex-wrap: wrap; gap: 6px; font-size: 10.5px; }
  .pay-tx-head,
  .pay-tx-row { padding: 8px 10px; gap: 6px; flex-wrap: wrap; }

  /* Salary heads editor (Add/Edit modal Salary tab) */
  .sal-heads-grid { grid-template-columns: 1fr !important; }
  .sal-head-top, .sal-head-bottom { flex-wrap: wrap; gap: 6px; }
  .sal-summary { flex-wrap: wrap; gap: 8px; }

  /* Loan cards */
  .loan-card-head { flex-direction: column; align-items: stretch; gap: 8px; padding: 12px; }
  .loan-card-body { padding: 12px; }
  .loan-card-field { flex-wrap: wrap; gap: 6px; }

  /* Leaves toggle row */
  .leave-toggle-row { flex-direction: column; align-items: stretch; gap: 8px; padding: 12px; }

  /* Reports grid — 1 col */
  .hr-rpt-grid { grid-template-columns: 1fr !important; gap: 10px; }
  .hr-rpt-card { padding: 14px 14px; }

  /* Confirm dialog */
  .confirm-dialog { padding: 16px; max-width: 92vw; }
  .confirm-body { padding: 14px 16px; }
  .confirm-footer { padding: 12px 14px; flex-wrap: wrap; gap: 8px; }
  .confirm-footer > .confirm-btn { flex: 1 1 auto; min-width: 0; }

  /* Section card padding */
  .section-card { border-radius: 12px; }

  /* Page header is global (App.js) but ensure HR-specific styling honors mobile */
  .page-title-row { gap: 10px; }
}

@media (max-width: 480px) {
  .hr-tabs > * { padding: 7px 10px; font-size: 11.5px; }
  .emp-subtabs > * { padding: 8px 10px; font-size: 11.5px; }
  .prof-kv-grid { grid-template-columns: 1fr !important; }
  .modal-title { font-size: 13px; }
  .pay-t-head, .ppl-row, .ppl-head { min-width: 680px; }
}
`;
