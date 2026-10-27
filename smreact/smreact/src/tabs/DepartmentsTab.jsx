import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { downloadDeptReport } from '../utils/pdfReports';
import { buildUrl } from '../utils/apiConfig';
import Tooltip from '../erp/shared/Tooltip';
import { useSetupTabPerms } from '../utils/setupPermissions';
import SetupLoader from '../components/SetupLoader';
import * as hrService from '../erp/services/hrService';
import * as approvalsService from '../erp/services/approvalsService';
import {
  getPendingAdds, addPendingAdd, removePendingAdd, reconcilePendingAdds,
  upsertPendingLink, removePendingLink, reconcilePendingLinks,
} from '../erp/services/pendingAddsStore';

/* Same store keys as HR ▸ Basics so pending badges stay in sync across both screens. */
const LS_DEPT_MOD = 'hrDept';
const LS_DESIG_MOD = 'hrDesig';

function DeptPendingActions({ pend, onWithdraw }) {
  if (!pend) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
      <Tooltip text={`Request ${pend.requestNo || ''} awaiting approval`.trim()}>
        <span className="ls-pending-badge" role="status">
          <i className="fa-solid fa-hourglass-half"></i>
          <span>Pending Approval</span>
          {pend.approvalId != null && <b className="ls-pending-id">#{pend.approvalId}</b>}
        </span>
      </Tooltip>
      <Tooltip text="Withdraw this request">
        <button type="button" className="ls-withdraw-btn" onClick={() => onWithdraw && onWithdraw()} aria-label="Withdraw this request">
          <i className="fa-solid fa-rotate-left"></i>
        </button>
      </Tooltip>
    </span>
  );
}

function mergeDeptGhosts(rows, ghosts) {
  const base = Array.isArray(rows) ? rows : [];
  if (!ghosts || !ghosts.length) return base;
  const realNames = new Set(
    base.filter((r) => !r._pendingAdd).map((r) => String(r.departmentName || r.name || '').trim().toLowerCase()).filter(Boolean),
  );
  const add = ghosts.map((g) => g && g.row).filter((r) => {
    if (!r) return false;
    const nm = String(r.departmentName || r.name || '').trim().toLowerCase();
    if (nm && realNames.has(nm)) return false;
    return true;
  });
  return [...add, ...base];
}

function AddDeptModal({ open, onClose, onAdd, getDeparmentdata, editDept = null, onPending, showToast }) {
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
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
      const userID = Number(sessionStorage.getItem('UserID') || 0);

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
            createdBy: userID,
            modifiedBy: userID,
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
        branchID,
        departmentName: name.trim(),
        totalDesignationCount: isEdit ? (editDept.designations || []).length : 0,
        createdBy: userID,
        modifiedBy: userID,
        designations,
      };
      const data = await hrService.saveHrDept(payload);
      const pend = hrService.hrPendingInfo(data);
      if (pend) {
        onPending?.(pend, { isEdit, name: name.trim(), editDept });
        showToast?.(pend.message || `Department ${isEdit ? 'update' : 'save'} sent for approval (Request #${pend.requestNo || pend.approvalId})`, 'info');
        setName('');
        setErr('');
        onClose();
        return;
      }
      setName('');
      setErr('');
      getDeparmentdata();
      onClose();
      showToast?.(isEdit ? 'Department updated' : 'Department added', 'success');
    } catch (err) {
      console.error(err);
      setErr(err?.message || 'Network error. Please try again.');
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
            <Tooltip text={isEdit ? 'Save changes' : 'Add a new department'}>
              <button className="btn btn-primary btn-md" onClick={handleAdd}><i className={`fas ${isEdit ? 'fa-save' : 'fa-plus'}`}></i> {isEdit ? 'Save Changes' : 'Add Department'}</button>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddDesigModal({ open, dept, onClose, onAdd, getDeparmentdata, showToast, onPending }) {
  const [name, setName] = useState('');
  const [qual, setQual] = useState({});
  const [job, setJob] = useState('');
  const [err, setErr] = useState('');
  const [err2, setErr2] = useState('');
  const [Qualification, setQualification] = useState({});

  useEffect(() => {
    if (open) getQualification();
  }, [open]);

  async function getQualification() {
    try {
      const res = await fetch(buildUrl(`/api/LaunchSetup/get-qualifications/0`), { headers: { Accept: '*/*' } });
      const json = await res.json();
      setQualification(json.data ?? []);
    } catch { showToast('Could not load qualifications', 'error'); }
  }

  const handleAdd = async () => {
    if (!name.trim()) { setErr('Designation name is required'); return; }
    if (!qual.id) { setErr2('Qualification is required'); return; }

    try {
      const branchID = sessionStorage.getItem('branchID');
      const userID = Number(sessionStorage.getItem('UserID') || 0);

      const payload = {
        designationID: 0,
        branchID,
        branchDepartmentID: dept.id,
        designationName: name.trim(),
        description: job,
        qualificationID: qual.id,
        qualificationName: qual.qualificationName,
        createdBy: userID,
        modifiedBy: userID,
      };
      const data = await hrService.saveHrDesig(payload);
      const pend = hrService.hrPendingInfo(data);
      if (pend) {
        onPending?.(pend, {
          deptId: dept.id,
          name: name.trim(),
          qual: qual.qualificationName || '',
          job: job.trim(),
          qualificationID: qual.id,
        });
        showToast?.(pend.message || `Designation save sent for approval (Request #${pend.requestNo || pend.approvalId})`, 'info');
        setName(''); setQual({}); setJob(''); setErr(''); setErr2('');
        onClose();
        return;
      }
      setName('');
      setQual({});
      setJob('');
      setErr('');
      setErr2('');
      getDeparmentdata();
      onClose();
      showToast?.('Designation added', 'success');
    } catch (err) {
      console.error(err);
      setErr(err?.message || 'Network error. Please try again.');
    }
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
        <Tooltip text="Add a designation to this department">
          <button className="btn btn-primary btn-md" onClick={handleAdd}>
            <i className="fas fa-save"></i> Save
          </button>
        </Tooltip>
      </div>
    </div>
  </div>
</div>
  );
}

export default function DepartmentsTab({ deptsData, setDeptsData, schoolInfo, showToast, showSuccess, onContinue }) {
  /* Launch Setup ▸ Departments — designations department ke andar hi banti
     hain, is liye unke Add/Edit/Delete bhi isi screen ki permission par. */
  const { canCreate, canEdit, canDelete, canDownload } = useSetupTabPerms('departments');
  /* Pehla fetch mukammal hone tak loader — koi placeholder row nahi. */
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [showAddDept, setShowAddDept] = useState(false);
  const [editDept, setEditDept] = useState(null); // department being edited (name)
  const [desigTarget, setDesigTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [editDesigTarget, setEditDesigTarget] = useState(null); // { deptId, idx }
  const [editDesigForm, setEditDesigForm] = useState({});
  const [Qualification, setQualification] = useState({});

  const [deptPendingMap, setDeptPendingMap] = useState({});
  const [desigPendingMap, setDesigPendingMap] = useState({});
  const [deptGhosts, setDeptGhosts] = useState(() => getPendingAdds(LS_DEPT_MOD));
  const [desigGhosts, setDesigGhosts] = useState(() => getPendingAdds(LS_DESIG_MOD));
  const [withdrawCfg, setWithdrawCfg] = useState(null);

  async function getQualification() {
    try {
      const res = await fetch(buildUrl(`/api/LaunchSetup/get-qualifications/0`), { headers: { Accept: '*/*' } });
      const json = await res.json();
      setQualification(json.data ?? []);
    } catch { showToast('Could not load qualifications', 'error'); }
  }

  const getDeparmentdata = useCallback(async () => {
    try {
      const branchID = sessionStorage.getItem('branchID');
      const res = await fetch(buildUrl(`/api/LaunchSetup/get-departments-by-branch/${branchID}`), { headers: { Accept: '*/*' } });
      const json = await res.json();
      const d = json.data ?? [];
      setDeptsData(Array.isArray(d) ? d : []);
    } catch { showToast('Could not load branch data', 'error'); }
    finally { setLoading(false); }
  }, [setDeptsData, showToast]);

  useEffect(() => {
    getDeparmentdata();
  }, [getDeparmentdata]);

  const isBasicsRelevant = (r) => {
    const hay = `${r.module || ''} ${r.actionType || ''} ${r.actionLabel || ''}`.toLowerCase();
    return hay.includes('department') || hay.includes('designation') || hay.includes('dept');
  };

  const loadBasicsPending = useCallback(async () => {
    try {
      const reqs = await approvalsService.getMyRequests();
      const deptM = {};
      const desigM = {};
      (reqs || []).forEach((r) => {
        if (String(r.status || '').toLowerCase() !== 'pending' || !isBasicsRelevant(r)) return;
        if (r.entityId == null) return;
        const pend = { approvalId: r.apiId, requestNo: r.id };
        const hay = `${r.module || ''} ${r.actionType || ''} ${r.actionLabel || ''}`.toLowerCase();
        if (hay.includes('designation')) desigM[String(r.entityId)] = pend;
        else deptM[String(r.entityId)] = pend;
      });
      const dGhosts = reconcilePendingAdds(LS_DEPT_MOD, reqs);
      const gGhosts = reconcilePendingAdds(LS_DESIG_MOD, reqs);
      dGhosts.forEach((g) => { deptM[String(g.rid)] = { approvalId: g.approvalId, requestNo: g.requestNo }; });
      gGhosts.forEach((g) => { desigM[String(g.rid)] = { approvalId: g.approvalId, requestNo: g.requestNo }; });
      reconcilePendingLinks(LS_DEPT_MOD, reqs).forEach((l) => {
        deptM[String(l.key)] = { approvalId: l.approvalId, requestNo: l.requestNo };
      });
      reconcilePendingLinks(LS_DESIG_MOD, reqs).forEach((l) => {
        desigM[String(l.key)] = { approvalId: l.approvalId, requestNo: l.requestNo };
      });
      setDeptGhosts(dGhosts);
      setDesigGhosts(gGhosts);
      setDeptPendingMap(deptM);
      setDesigPendingMap(desigM);
    } catch (e) { /* non-fatal */ }
  }, []);

  useEffect(() => { loadBasicsPending(); }, [loadBasicsPending]);

  const markDeptPend = (id, pend) => {
    if (id == null || !pend) return;
    setDeptPendingMap((m) => ({ ...m, [String(id)]: pend }));
    upsertPendingLink(LS_DEPT_MOD, { key: id, approvalId: pend.approvalId, requestNo: pend.requestNo });
  };
  const markDesigPend = (id, pend) => {
    if (id == null || !pend) return;
    setDesigPendingMap((m) => ({ ...m, [String(id)]: pend }));
    upsertPendingLink(LS_DESIG_MOD, { key: id, approvalId: pend.approvalId, requestNo: pend.requestNo });
  };

  const onDeptPending = (pend, meta) => {
    if (!pend) return;
    if (!meta?.isEdit) {
      const rid = `pending-${pend.requestNo || pend.approvalId || Date.now()}`;
      const row = {
        id: rid,
        departmentName: meta.name,
        name: meta.name,
        designations: [],
        _pendingAdd: true,
      };
      setDeptGhosts(addPendingAdd(LS_DEPT_MOD, {
        rid, requestNo: pend.requestNo, approvalId: pend.approvalId, row,
      }));
      markDeptPend(rid, pend);
    } else {
      markDeptPend(meta.editDept?.id, pend);
    }
    loadBasicsPending();
  };

  const onDesigPending = (pend, meta) => {
    if (!pend) return;
    const rid = `pending-${pend.requestNo || pend.approvalId || Date.now()}`;
    const row = {
      designationID: rid,
      branchDepartmentID: meta.deptId,
      designationName: meta.name,
      qualificationName: meta.qual || '',
      description: meta.job || '',
      qualificationID: meta.qualificationID,
      _pendingAdd: true,
      _deptId: meta.deptId,
    };
    setDesigGhosts(addPendingAdd(LS_DESIG_MOD, {
      rid, requestNo: pend.requestNo, approvalId: pend.approvalId, row,
    }));
    markDesigPend(rid, pend);
    if (meta.deptId) setExpandedId(meta.deptId);
    loadBasicsPending();
  };

  const doWithdraw = async () => {
    if (!withdrawCfg) return;
    const { kind, row, pend } = withdrawCfg;
    try { await approvalsService.withdrawRequest(pend.approvalId); }
    catch (e) { showToast(e?.message || 'Could not withdraw request', 'error'); return; }
    showToast('Request withdrawn', 'success');
    if (kind === 'dept') {
      if (row?._pendingAdd) setDeptGhosts(removePendingAdd(LS_DEPT_MOD, row.id));
      removePendingLink(LS_DEPT_MOD, row?.id);
    } else {
      const key = row?.designationID ?? row?.id;
      if (row?._pendingAdd) setDesigGhosts(removePendingAdd(LS_DESIG_MOD, key));
      removePendingLink(LS_DESIG_MOD, key);
    }
    setWithdrawCfg(null);
    getDeparmentdata();
    loadBasicsPending();
  };

  useEffect(() => {
    const refresh = () => { getDeparmentdata(); loadBasicsPending(); };
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [getDeparmentdata, loadBasicsPending]);

  const hasPending = deptGhosts.length > 0 || desigGhosts.length > 0
    || Object.keys(deptPendingMap).length > 0 || Object.keys(desigPendingMap).length > 0;
  useEffect(() => {
    if (!hasPending) return undefined;
    const t = setInterval(() => { getDeparmentdata(); loadBasicsPending(); }, 10000);
    return () => clearInterval(t);
  }, [hasPending, getDeparmentdata, loadBasicsPending]);

  const displayDepts = useMemo(() => {
    const merged = mergeDeptGhosts(deptsData, deptGhosts);
    /* Attach pending designation ghosts under their department. */
    return merged.map((dept) => {
      const ghostsForDept = (desigGhosts || [])
        .map((g) => g && g.row)
        .filter((r) => r && String(r.branchDepartmentID || r._deptId) === String(dept.id));
      if (!ghostsForDept.length) return dept;
      const existingIds = new Set((dept.designations || []).map((d) => String(d.designationID)));
      const existingNames = new Set((dept.designations || []).map((d) => String(d.designationName || '').trim().toLowerCase()).filter(Boolean));
      const add = ghostsForDept.filter((r) => {
        if (existingIds.has(String(r.designationID))) return false;
        const nm = String(r.designationName || '').trim().toLowerCase();
        if (nm && existingNames.has(nm)) return false;
        return true;
      });
      if (!add.length) return dept;
      return { ...dept, designations: [...add, ...(dept.designations || [])] };
    });
  }, [deptsData, deptGhosts, desigGhosts]);

  const handleEditDesig = (deptId, idx) => {
    const dept = displayDepts.find(d => d.id === deptId);
    const d = dept?.designations[idx];
    if (!d || d._pendingAdd) return;
    getQualification();
    setEditDesigTarget({ deptId, idx, departmentName: dept.departmentName || dept.name });
    setEditDesigForm(d);
  };

  const saveDesigEdit = async () => {
    if (!editDesigForm.designationName?.trim()) return;
    try {
      const branchID = sessionStorage.getItem('branchID');
      const userID = Number(sessionStorage.getItem('UserID') || 0);

      const payload = {
        designationID: editDesigForm.designationID,
        branchID,
        branchDepartmentID: editDesigForm.branchDepartmentID,
        designationName: editDesigForm.designationName,
        description: editDesigForm.description,
        qualificationID: editDesigForm.qualificationID,
        qualificationName: editDesigForm.qualificationName,
        createdBy: userID,
        modifiedBy: userID,
      };
      const data = await hrService.saveHrDesig(payload);
      const pend = hrService.hrPendingInfo(data);
      if (pend) {
        showToast(pend.message || `Designation update sent for approval (Request #${pend.requestNo || pend.approvalId})`, 'info');
        markDesigPend(editDesigForm.designationID, pend);
        setEditDesigForm({});
        setEditDesigTarget(null);
        loadBasicsPending();
        return;
      }
      setEditDesigForm({});
      getDeparmentdata();
      setEditDesigTarget(null);
      showToast('Designation updated', 'success');
    } catch (err) {
      console.error(err);
      showToast(err?.message || 'Network error. Please try again.', 'error');
    }
  };

  const filtered = search
    ? displayDepts.filter(d => String(d.departmentName || d.name || '').toLowerCase().includes(search.toLowerCase()))
    : displayDepts;

  const totalPosts = (displayDepts || []).reduce(
    (sum, dept) => sum + (dept.designations?.length || 0),
    0
  );

  const handleAddDept = () => {};
  const handleAddDesig = () => {};

  const handleDeleteDesig = async (deptId, idx) => {
    const dept = displayDepts.find(d => d.id === deptId);
    const d = dept?.designations[idx];
    if (!d || d._pendingAdd) return;
    try {
      const json = await hrService.deleteHrDesig({ id: d.designationID });
      const pend = hrService.hrPendingInfo(json);
      if (pend) {
        showToast(pend.message || `Designation deletion sent for approval (Request #${pend.requestNo || pend.approvalId})`, 'info');
        markDesigPend(d.designationID, pend);
        loadBasicsPending();
        return;
      }
      getDeparmentdata();
      showToast('Designation removed', 'info');
    } catch (err) {
      console.error(err);
      showToast(err?.message || 'Could not delete Designation', 'error');
    }
  };

  const handleDeleteDept = async (id) => {
    try {
      const json = await hrService.deleteHrDept({ id });
      const pend = hrService.hrPendingInfo(json);
      if (pend) {
        showToast(pend.message || `Department deletion sent for approval (Request #${pend.requestNo || pend.approvalId})`, 'info');
        markDeptPend(id, pend);
        setDeleteTarget(null);
        loadBasicsPending();
        return;
      }
      getDeparmentdata();
      showToast(`"${deleteTarget?.departmentName || deleteTarget?.name}" deleted`, 'info');
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
      setDeleteTarget(null);
      showToast(err?.message || 'Could not delete department', 'error');
    }
  };

  if (loading) return <div className="tab-panel active"><SetupLoader label="Loading departments…" /></div>;

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
          {canDownload && (
            <Tooltip text="Download departments report as PDF">
              <button className="btn btn-pdf btn-md" onClick={() => downloadDeptReport(deptsData, schoolInfo || {}, showToast)}>
              <i className="fas fa-file-pdf"></i> Download Report
            </button>
            </Tooltip>
          )}
          {canCreate && (
            <Tooltip text="Add a new department">
              <button className="btn btn-primary btn-md" onClick={() => setShowAddDept(true)}>
                <i className="fas fa-plus"></i> Add New Department
              </button>
            </Tooltip>
          )}
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
              {canCreate && <Tooltip text="Add a new department"><button className="btn btn-primary btn-md" onClick={() => setShowAddDept(true)}><i className="fas fa-plus"></i> Add Department</button></Tooltip>}
            </div>
          ) : filtered.map((dept, i) => {
            const exp = expandedId === dept.id;
            const deptPend = deptPendingMap[String(dept.id)];
            const deptIsPending = !!deptPend || !!dept._pendingAdd;
            const desigCount = (dept.designations || []).length;
            return (
              <div key={dept.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                <div className={`dept-row${exp ? ' expanded-row' : ''}`} onClick={() => setExpandedId(exp ? null : dept.id)}>
                  <div className="td" style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: 11.5 }}>{String(i + 1).padStart(2, '0')}</div>
                  <div className="td">
                    <span className="dept-pill"><i className="fas fa-building" style={{ fontSize: 11 }}></i>{dept.departmentName || dept.name}</span>
                  </div>
                  {/* Designations column */}
<div className="td">
  {!deptIsPending && canCreate && <Tooltip text="Add a designation to this department">
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
  </Tooltip>}
  {desigCount > 0 && (
    <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 12, whiteSpace: 'nowrap' }}>
      {desigCount} post{desigCount !== 1 ? 's' : ''}
    </span>
  )}
</div>

{/* Details column */}
<div className="td" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
  {deptIsPending ? (
    <DeptPendingActions
      pend={deptPend || { approvalId: null, requestNo: null }}
      onWithdraw={() => setWithdrawCfg({ kind: 'dept', row: dept, pend: deptPend })}
    />
  ) : (
    <>
  {canEdit && <Tooltip text="Edit department name">
  <button
    onClick={e => { e.stopPropagation(); setEditDept(dept); }}
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
  </Tooltip>}
  {canDelete && <Tooltip text="Delete department">
  <button
    onClick={e => { e.stopPropagation(); setDeleteTarget(dept); }}
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
  </Tooltip>}
    </>
  )}
  <Tooltip text={exp ? 'Hide details' : 'Show details'}>
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
  </Tooltip>
</div>
                </div>
                {exp && (
                  <div style={{ background: 'var(--bg-base)', borderTop: '1px solid var(--border-light)' }}>
                    <div style={{ padding: '12px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-primary)' }}>
                        <i className="fas fa-id-badge" style={{ marginRight: 6 }}></i>{dept.departmentName || dept.name} — Designations
                      </span>
                      {!deptIsPending && canCreate && (
                        <Tooltip text="Add a designation to this department">
                          <button className="btn btn-ghost btn-sm" onClick={() => setDesigTarget(dept)}>
                            <i className="fas fa-plus"></i> Add
                          </button>
                        </Tooltip>
                      )}
                    </div>
                    <div className="desig-list">
  {!desigCount ? (
    <div className="empty-mini"><i className="fas fa-id-badge"></i>No designations yet</div>
  ) : (dept.designations || []).map((d, di) => {
    const desigKey = String(d.designationID ?? d.id ?? di);
    const desigPend = desigPendingMap[desigKey];
    const desigIsPending = !!desigPend || !!d._pendingAdd;
    return (
    <div key={desigKey} className="desig-item">
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
        {desigIsPending ? (
          <DeptPendingActions
            pend={desigPend || { approvalId: null, requestNo: null }}
            onWithdraw={() => setWithdrawCfg({ kind: 'desig', row: d, pend: desigPend })}
          />
        ) : (
          <>
        {canEdit && <Tooltip text="Edit designation">
        <button
          onClick={() => handleEditDesig(dept.id, di)}
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
        </Tooltip>}
        {canDelete && <Tooltip text="Delete designation">
        <button
          onClick={() => handleDeleteDesig(dept.id, di)}
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
        </Tooltip>}
          </>
        )}
      </div>
    </div>
  );})}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="pagination">
          <div className="pagination-info">Showing <strong>{filtered.length}</strong> of <strong>{displayDepts.length}</strong> departments</div>
        </div>
      </div>

      <AddDeptModal
        open={showAddDept}
        onClose={() => setShowAddDept(false)}
        onAdd={handleAddDept}
        getDeparmentdata={getDeparmentdata}
        onPending={onDeptPending}
        showToast={showToast}
      />
      <AddDeptModal
        open={!!editDept}
        editDept={editDept}
        onClose={() => setEditDept(null)}
        getDeparmentdata={getDeparmentdata}
        onPending={onDeptPending}
        showToast={showToast}
      />
      <AddDesigModal
        open={!!desigTarget}
        dept={desigTarget}
        onClose={() => setDesigTarget(null)}
        onAdd={handleAddDesig}
        getDeparmentdata={getDeparmentdata}
        showToast={showToast}
        onPending={onDesigPending}
      />

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

          <Tooltip text="Save changes">
          <button
            className="btn btn-primary btn-md"
            onClick={saveDesigEdit}
          >
            <i className="fas fa-save"></i> Save Changes
          </button>
          </Tooltip>
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
                Are you sure you want to delete <strong>"{deleteTarget.departmentName || deleteTarget.name}"</strong>?
              </p>
              <div className="modal-footer">
                <button className="btn btn-secondary btn-md" onClick={() => setDeleteTarget(null)}>Cancel</button>
                <button className="btn btn-danger btn-md" onClick={() => handleDeleteDept(deleteTarget.id)}><i className="fas fa-trash"></i> Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {withdrawCfg && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setWithdrawCfg(null)}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <div className="modal-title"><i className="fas fa-rotate-left" style={{ marginRight: 7, color: '#1E40AF' }}></i>Withdraw this request?</div>
              <button className="modal-close" onClick={() => setWithdrawCfg(null)}><i className="fas fa-times"></i></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
                The pending approval request for <strong>"{withdrawCfg.row?.departmentName || withdrawCfg.row?.designationName || withdrawCfg.row?.name || 'this record'}"</strong> will be withdrawn.
              </p>
              <div className="modal-footer">
                <button className="btn btn-secondary btn-md" onClick={() => setWithdrawCfg(null)}>Cancel</button>
                <button className="btn btn-primary btn-md" onClick={doWithdraw}><i className="fas fa-rotate-left"></i> Yes, Withdraw</button>
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
          <Tooltip text="Save and continue">
            <button className="btn btn-primary btn-md" onClick={() => onContinue?.()}>
              Save &amp; Continue <i className="fas fa-arrow-right"></i>
            </button>
          </Tooltip>
        </div>
      </div>

      <style>{`
.ls-pending-badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700;
  color: #B91C1C; background: rgba(220,38,38,.08); border: 1px solid rgba(220,38,38,.25);
  white-space: nowrap;
}
.ls-pending-badge i { font-size: 10px; animation: ls-pending-pulse 1.8s ease-in-out infinite; }
.ls-pending-badge .ls-pending-id {
  display: inline-block; margin-left: 2px; padding: 1px 6px; border-radius: 999px;
  background: #DC2626; color: #fff; font-size: 10px; font-weight: 800;
}
.ls-withdraw-btn {
  width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center;
  border-radius: 8px; border: 1px solid rgba(30,64,175,.25); background: rgba(30,64,175,.06);
  color: #1E40AF; cursor: pointer; font-size: 12px;
}
.ls-withdraw-btn:hover { background: #1E40AF; color: #fff; border-color: #1E40AF; }
@keyframes ls-pending-pulse { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
`}</style>
    </div>
  );
}
