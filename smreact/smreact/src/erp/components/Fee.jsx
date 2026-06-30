import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from './Tooltip';
import TutorialModal from './TutorialModal';
import * as feeService from '../services/feeService';
import useAsync from '../hooks/useAsync';

const money = (n) => `Rs. ${(Number(n) || 0).toLocaleString('en-PK')}`;
const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, m =>
  ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));

/* Synthesise a Pakistani-format contact number from the registration
   number (deterministic — same reg always yields the same phone). The
   mock dataset doesn't ship a `phone` field, so callers either use the
   real student.phone when present, or fall back to this helper. */
const studentPhone = (s) => {
  if (s && s.phone) return s.phone;
  if (!s || !s.reg) return '—';
  const digits = String(s.reg).replace(/[^0-9]/g, '').slice(-7).padStart(7, '0');
  const prefixes = ['0300', '0321', '0333', '0345', '0301', '0322', '0344'];
  let h = 5381;
  for (let i = 0; i < digits.length; i++) h = ((h << 5) + h + digits.charCodeAt(i)) >>> 0;
  return `${prefixes[h % prefixes.length]}-${digits}`;
};

/* Current local time in 24-hour HH:MM — used to stamp every new receipt
   so the slip / payment history can show date AND time. */
const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
/* Pretty 12-hour formatter for display: "02:35 PM" */
const fmtTime12 = (hhmm) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${String(h12).padStart(2, '0')}:${String(m || 0).padStart(2, '0')} ${period}`;
};

/* ═══════════════════════════════════════════════════════════════════
   FEE MODULE — shell. Ported from
   ~/Desktop/ERP-HTML/Fee Module Screens.html

   Step 1 (this turn): page header + 5 main tabs. Every tab body is a
   "Coming Soon" placeholder. Subsequent steps will fill each tab in
   place — Fee Setup & Settings first, then Challans, Receiving,
   History, Reports.
   ═══════════════════════════════════════════════════════════════════ */

const FEE_TABS = [
  { id: 'structure', icon: 'fa-layer-group',          label: 'Fee Setup & Settings' },
  { id: 'challans',  icon: 'fa-file-invoice-dollar',  label: 'Fee Challans' },
  { id: 'receipts',  icon: 'fa-hand-holding-dollar',  label: 'Fee Receiving' },
  { id: 'history',   icon: 'fa-clock-rotate-left',    label: 'Fee History' },
  { id: 'reports',   icon: 'fa-chart-column',         label: 'Reports' },
];

/* Sub-segments inside the "Fee Setup & Settings" tab. */
const STRUCTURE_SEGS = [
  { id: 'student',   icon: 'fa-user-graduate', label: 'Student Fee Setup' },
  { id: 'transport', icon: 'fa-bus',           label: 'Transport Fee Setup' },
  { id: 'settings',  icon: 'fa-sliders',       label: 'Fee Challan Settings' },
];

export default function Fee({ toast = () => {} }) {
  const [tab, setTab] = useState('structure');
  const [structSeg, setStructSeg] = useState('student');
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const activeMeta = FEE_TABS.find(t => t.id === tab);

  return (
    <>
      <style>{FEE_CSS}</style>

      {/* Page header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="page-title-icon"><i className="fa-solid fa-money-bill-wave"></i></div>
          <div>
            <div className="page-title">Fee Management</div>
            <div className="page-sub">Setup fee heads, generate challans, receive payments & view reports</div>
          </div>
        </div>
        <Tooltip text="Play a short tutorial for the Fee module">
          <button
            className="tutorial-btn page-tutorial-btn"
            onClick={() => setTutorialOpen(true)}
          >
            <div className="play-dot"><i className="fa-solid fa-play" style={{ fontSize: 8 }}></i></div>
            <span className="tutorial-label">Tutorial</span>
          </button>
        </Tooltip>
      </div>

      {/* Top-level tabs */}
      <div className="fee-subtabs">
        {FEE_TABS.map(t => (
          <Tooltip key={t.id} text={`Open ${t.label}`}>
            <button
              className={`fee-subtab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <i className={`fa-solid ${t.icon}`}></i> {t.label}
            </button>
          </Tooltip>
        ))}
      </div>

      {/* ── Tab body ── */}
      {tab === 'structure' ? (
        <>
          {/* 3-segment pill bar */}
          <div className="fee-seg fee-seg-3">
            {STRUCTURE_SEGS.map(s => (
              <Tooltip key={s.id} text={`Open ${s.label}`}>
                <button
                  className={`fee-seg-btn${structSeg === s.id ? ' active' : ''}`}
                  onClick={() => setStructSeg(s.id)}
                >
                  <i className={`fa-solid ${s.icon}`}></i> {s.label}
                </button>
              </Tooltip>
            ))}
          </div>

          {/* Each segment body */}
          {structSeg === 'student'   && <StudentFeeSetup toast={toast} />}
          {structSeg === 'transport' && <TransportFeeSetup toast={toast} />}
          {structSeg === 'settings'  && <FeeChallanSettings toast={toast} />}
        </>
      ) : tab === 'challans' ? (
        <FeeChallansTab toast={toast} />
      ) : tab === 'receipts' ? (
        <FeeReceivingTab toast={toast} />
      ) : tab === 'history' ? (
        <FeeHistoryTab toast={toast} />
      ) : tab === 'reports' ? (
        <FeeReportsTab toast={toast} />
      ) : (
        <FeeComingSoon
          label={activeMeta?.label || 'This screen'}
          icon={activeMeta?.icon || 'fa-hammer'}
        />
      )}

      <TutorialModal
        open={tutorialOpen}
        moduleKey="fee"
        onClose={() => setTutorialOpen(false)}
        toast={toast}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STUDENT FEE SETUP — class+section table, per-row Update / Copy to
   All / expandable details. Update opens a modal to add, edit, rename
   or remove fee heads. Copy to All applies the source class's heads
   to every other class with a confirm. Details panel includes a PDF
   download button.
   ═══════════════════════════════════════════════════════════════════ */
function StudentFeeSetup({ toast }) {
  const { data: grades = [], refetch: reloadGrades } = useAsync(feeService.getFeeGrades, []);

  const [openKey, setOpenKey]       = useState(null);  // expanded class row
  const [editKey, setEditKey]       = useState(null);  // class being edited
  const [confirm, setConfirm]       = useState(null);  // { title, message, hint?, onConfirm }
  const [reportHtml, setReportHtml] = useState(null);  // { title, html }

  /* Fee structure is per grade; the table reads classes + a key→heads map. */
  const classes  = grades;
  const headsMap = useMemo(
    () => Object.fromEntries(grades.map(g => [g.key, g.heads || []])),
    [grades],
  );

  const editClass = classes.find(c => c.key === editKey) || null;

  const openEdit  = useCallback((key) => setEditKey(key), []);
  const closeEdit = useCallback(()    => setEditKey(null), []);

  const requestCopyToAll = useCallback((srcKey) => {
    const srcHeads = headsMap[srcKey] || [];
    const src = classes.find(c => c.key === srcKey);
    if (!srcHeads.length) { toast('This class has no fee heads to copy', 'error'); return; }
    setConfirm({
      title:   'Copy fee structure to all classes?',
      message: `This will add ${src?.cls}'s ${srcHeads.length} fee head${srcHeads.length !== 1 ? 's' : ''} to every other class.`,
      hint:    'Existing fee heads on other classes are kept — the copied heads are added to them.',
      onConfirm: async () => {
        try {
          const targets = Array.from(
            new Map(classes
              .filter(c => c.key !== srcKey && c._gradeId !== src?._gradeId)
              .map(c => [c._gradeId, c])).values(),
          );
          await Promise.all(targets.flatMap(c =>
            srcHeads.map(h => feeService.saveFeeHead({ feeStructureID: 0, gradeId: c._gradeId, name: h.name, amt: h.amt }))));
          await reloadGrades();
          toast('Fee structure copied to all classes', 'success');
        } catch (e) { toast(e.message || 'Could not copy fee structure', 'error'); }
      },
    });
  }, [headsMap, classes, reloadGrades, toast]);

  const openClassReport = useCallback((c) => {
    const heads = headsMap[c.key] || [];
    const html = buildStudentFeeReportHTML({ cls: c.cls, sec: c.sec, heads });
    setReportHtml({ title: `Fee Heads — ${c.cls} (${c.sec})`, html });
  }, [headsMap]);

  return (
    <>
      <div className="fee-info">
        <i className="fa-solid fa-circle-info"></i>
        <span>
          Fee heads defined here are loaded automatically into challan generation for each class &amp; section.
          Use <strong>Update</strong> to add, rename, edit amounts or remove heads.
        </span>
      </div>
      <div className="fee-info fee-info--warn">
        <i className="fa-solid fa-triangle-exclamation"></i>
        <span>
          <strong>Copy to All Classes</strong> will not affect already generated challans —
          it applies only to newly generated challans.
        </span>
      </div>

      <div className="fee-section">
        <div className="fee-table-head fee-struct-row">
          <div className="fee-th">#</div>
          <div className="fee-th">Class</div>
          <div className="fee-th">Section</div>
          <div className="fee-th fee-center">Total Heads</div>
          <div className="fee-th fee-center">Update</div>
          <div className="fee-th fee-center">Copy to All</div>
          <div className="fee-th fee-center">Details</div>
        </div>

        {classes.length === 0 ? (
          <div className="fee-empty">No classes available.</div>
        ) : classes.map((c, i) => {
          const heads = headsMap[c.key] || [];
          const isOpen = openKey === c.key;
          return (
            <div key={c.key} className="fee-rowwrap">
              <div
                className={`fee-row fee-struct-row${isOpen ? ' open' : ''}`}
                onClick={() => setOpenKey(isOpen ? null : c.key)}
              >
                <div className="fee-td" data-label="#"><span className="fee-row-icon">{i + 1}</span></div>
                <div className="fee-td fee-name" data-label="Class">{c.cls}</div>
                <div className="fee-td" data-label="Section"><span className="fee-tag">{c.sec}</span></div>
                <div className="fee-td fee-center" data-label="Total Heads">
                  <span className="fee-count">{heads.length} <small>head{heads.length === 1 ? '' : 's'}</small></span>
                </div>
                <div className="fee-td fee-center fee-actions" data-label="Update" onClick={e => e.stopPropagation()}>
                  <Tooltip text={`Edit fee heads for ${c.cls} (${c.sec})`}>
                    <button className="fee-btn fee-btn-primary fee-btn-xs" onClick={() => openEdit(c.key)}>
                      <i className="fa-solid fa-pen"></i> Update
                    </button>
                  </Tooltip>
                </div>
                <div className="fee-td fee-center fee-actions" data-label="Copy to All" onClick={e => e.stopPropagation()}>
                  <Tooltip text="Copy this class's fee heads to every other class">
                    <button className="fee-btn fee-btn-ghost fee-btn-xs" onClick={() => requestCopyToAll(c.key)}>
                      <i className="fa-solid fa-copy"></i> Copy to All
                    </button>
                  </Tooltip>
                </div>
                <div className="fee-td fee-center" data-label="Details">
                  <Tooltip text={isOpen ? 'Hide fee heads' : 'Show fee heads'}>
                    <span className={`fee-chevbtn${isOpen ? ' open' : ''}`}>
                      <i className="fa-solid fa-chevron-down fee-chev"></i>
                    </span>
                  </Tooltip>
                </div>
              </div>

              <div className={`fee-detail${isOpen ? ' open' : ''}`}>
                <div className="fee-detail-inner">
                  <div className="fee-detail-titlebar">
                    <div className="fee-detail-title">
                      <i className="fa-solid fa-list-ul"></i> Fee Heads — {c.cls} ({c.sec})
                    </div>
                    {heads.length > 0 && (
                      <Tooltip text={`Download fee heads for ${c.cls} (${c.sec}) as PDF`}>
                        <button className="fee-btn fee-btn-ghost fee-btn-xs" onClick={() => openClassReport(c)}>
                          <i className="fa-solid fa-file-pdf"></i> PDF
                        </button>
                      </Tooltip>
                    )}
                  </div>
                  <div className="fee-stbl-wrap">
                    <table className="fee-stbl">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Fee Head</th>
                          <th className="fee-right">Amount (Rs.)</th>
                          <th className="fee-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {heads.length === 0 ? (
                          <tr><td colSpan="4" className="fee-stbl-empty">No fee heads added yet.</td></tr>
                        ) : heads.map((h, j) => (
                          <tr key={j}>
                            <td className="fee-num">{j + 1}</td>
                            <td><b>{h.name}</b></td>
                            <td className="fee-right">{money(h.amt)}</td>
                            <td className="fee-center">
                              <span className="fee-chip fee-chip-active">
                                <i className="fa-solid fa-check"></i> Active
                              </span>
                            </td>
                          </tr>
                        ))}
                        {heads.length > 0 && (
                          <tr className="fee-stbl-foot">
                            <td colSpan="2"><b>Total per student</b></td>
                            <td className="fee-right"><b>{money(heads.reduce((s, h) => s + (+h.amt || 0), 0))}</b></td>
                            <td></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Update Fee Structure modal */}
      <StructEditModal
        open={!!editClass}
        cls={editClass}
        onClose={closeEdit}
        onChanged={reloadGrades}
        toast={toast}
      />

      {/* Confirm dialog (Remove head / Copy to all) */}
      <FeeConfirmDialog
        cfg={confirm}
        onClose={() => setConfirm(null)}
      />

      {/* Report preview overlay */}
      <FeeReportPreview
        open={!!reportHtml}
        title={reportHtml?.title}
        html={reportHtml?.html}
        onClose={() => setReportHtml(null)}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TRANSPORT FEE SETUP — class+section table, per-row expandable
   student roster with per-student transport fee editor. Route and
   amount can be edited per student via a small modal.
   ═══════════════════════════════════════════════════════════════════ */
function TransportFeeSetup({ toast }) {
  const { data: classes = [] } = useAsync(feeService.getFeeClasses, []);
  const { data: transportMap = {}, setData: setTransportMap } = useAsync(feeService.getTransportFee, []);

  const [openKey, setOpenKey]       = useState(null);
  const [editing, setEditing]       = useState(null); // { classKey, student }
  const [reportHtml, setReportHtml] = useState(null);

  const openEdit  = useCallback((classKey, student) => setEditing({ classKey, student }), []);
  const closeEdit = useCallback(() => setEditing(null), []);

  const saveStudent = useCallback(async ({ amount }) => {
    if (!editing) return;
    const { classKey, student } = editing;
    const next = (transportMap[classKey] || []).map(s =>
      s.reg === student.reg ? { ...s, transport: Math.max(0, Number(amount) || 0) } : s
    );
    setTransportMap(prev => ({ ...prev, [classKey]: next }));
    await feeService.saveStudentTransport(classKey, student.reg, { transport: amount });
    closeEdit();
    toast(`Transport fee updated for ${student.name}`, 'success');
  }, [editing, transportMap, setTransportMap, closeEdit, toast]);

  const openClassReport = useCallback((c) => {
    const rows = transportMap[c.key] || [];
    const html = buildTransportReportHTML({ cls: c.cls, sec: c.sec, rows });
    setReportHtml({ title: `Transport Fee — ${c.cls} (${c.sec})`, html });
  }, [transportMap]);

  return (
    <>
      <div className="fee-info">
        <i className="fa-solid fa-circle-info"></i>
        <span>
          Transport fee can be different for each student. Open a class to set or update
          individual transport charges.
        </span>
      </div>

      <div className="fee-section">
        <div className="fee-table-head fee-trans-row">
          <div className="fee-th">#</div>
          <div className="fee-th">Class</div>
          <div className="fee-th">Section</div>
          <div className="fee-th fee-center">Strength</div>
          <div className="fee-th fee-center">Details</div>
        </div>

        {classes.length === 0 ? (
          <div className="fee-empty">No classes available.</div>
        ) : classes.map((c, i) => {
          const students = transportMap[c.key] || [];
          const isOpen = openKey === c.key;
          const charged = students.filter(s => +s.transport > 0).length;
          return (
            <div key={c.key} className="fee-rowwrap">
              <div
                className={`fee-row fee-trans-row${isOpen ? ' open' : ''}`}
                onClick={() => setOpenKey(isOpen ? null : c.key)}
              >
                <div className="fee-td" data-label="#"><span className="fee-row-icon">{i + 1}</span></div>
                <div className="fee-td fee-name" data-label="Class">{c.cls}</div>
                <div className="fee-td" data-label="Section"><span className="fee-tag">{c.sec}</span></div>
                <div className="fee-td fee-center" data-label="Strength">
                  <span className="fee-count">{students.length}<small> students</small></span>
                </div>
                <div className="fee-td fee-center" data-label="Details">
                  <Tooltip text={isOpen ? 'Hide student transport list' : 'Show student transport list'}>
                    <span className={`fee-chevbtn${isOpen ? ' open' : ''}`}>
                      <i className="fa-solid fa-chevron-down fee-chev"></i>
                    </span>
                  </Tooltip>
                </div>
              </div>

              <div className={`fee-detail${isOpen ? ' open' : ''}`}>
                <div className="fee-detail-inner">
                  <div className="fee-detail-titlebar">
                    <div className="fee-detail-title">
                      <i className="fa-solid fa-bus"></i> Student Transport — {c.cls} ({c.sec})
                      {charged > 0 && (
                        <span className="fee-mini-pill">
                          {charged} of {students.length} using transport
                        </span>
                      )}
                    </div>
                    {students.length > 0 && (
                      <Tooltip text={`Download transport list for ${c.cls} (${c.sec}) as PDF`}>
                        <button className="fee-btn fee-btn-ghost fee-btn-xs" onClick={() => openClassReport(c)}>
                          <i className="fa-solid fa-file-pdf"></i> PDF
                        </button>
                      </Tooltip>
                    )}
                  </div>
                  <div className="fee-stbl-wrap">
                    <table className="fee-stbl">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Reg No</th>
                          <th>Name</th>
                          <th>Father Name</th>
                          <th className="fee-right">Transport Fee</th>
                          <th className="fee-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.length === 0 ? (
                          <tr><td colSpan="6" className="fee-stbl-empty">No students enrolled in this section.</td></tr>
                        ) : students.map((s, j) => (
                          <tr key={s.reg || s.studentID || `${s.name}-${j}`}>
                            <td className="fee-num">{j + 1}</td>
                            <td>{s.reg}</td>
                            <td><b>{s.name}</b></td>
                            <td>{s.father}</td>
                            <td className="fee-right">
                              {+s.transport > 0
                                ? <b>{money(s.transport)}</b>
                                : <span className="fee-muted-dash">—</span>}
                            </td>
                            <td className="fee-center">
                              <Tooltip text={`Edit transport fee for ${s.name}`}>
                                <button className="fee-iconbtn" onClick={() => openEdit(c.key, s)}>
                                  <i className="fa-solid fa-pen"></i>
                                </button>
                              </Tooltip>
                            </td>
                          </tr>
                        ))}
                        {students.length > 0 && (
                          <tr className="fee-stbl-foot">
                            <td colSpan="4"><b>Monthly transport collection</b></td>
                            <td className="fee-right">
                              <b>{money(students.reduce((s, x) => s + (+x.transport || 0), 0))}</b>
                            </td>
                            <td></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Transport modal */}
      <TransportEditModal
        open={!!editing}
        classMeta={editing ? classes.find(c => c.key === editing.classKey) : null}
        student={editing?.student}
        onClose={closeEdit}
        onSave={saveStudent}
        toast={toast}
      />

      {/* Report preview */}
      <FeeReportPreview
        open={!!reportHtml}
        title={reportHtml?.title}
        html={reportHtml?.html}
        onClose={() => setReportHtml(null)}
      />
    </>
  );
}

/* ─── Update Transport Fee modal ─── */
function TransportEditModal({ open, classMeta, student, onClose, onSave, toast }) {
  const [amount, setAmount] = useState('0');

  useEffect(() => {
    if (open && student) {
      setAmount(String(student.transport ?? 0));
    }
  }, [open, student]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open || !student) return null;

  const validateAndSave = () => {
    const num = Number(amount);
    if (Number.isNaN(num) || num < 0) {
      toast('Transport fee must be a non-negative number', 'error');
      return;
    }
    onSave({ amount: num });
  };

  return createPortal(
    <div className="fee-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fee-modal sm">
        <div className="fee-modal-head">
          <div className="fee-modal-head-title">
            <div className="fee-modal-head-icon"><i className="fa-solid fa-bus"></i></div>
            <div>
              <div className="fee-modal-title">Update Transport Fee</div>
              <div className="fee-modal-sub">
                {student.name} — {classMeta?.cls} ({classMeta?.sec})
              </div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="fee-modal-close" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </Tooltip>
        </div>

        <div className="fee-modal-body">
          <div className="fee-info">
            <i className="fa-solid fa-circle-info"></i>
            <span>
              Setting an amount of <strong>0</strong> means this student doesn't use transport.
            </span>
          </div>

          <div className="fee-field-stack">
            <label className="fee-label">Transport Fee Amount (Rs.)</label>
            <input
              className="fee-input"
              type="number"
              min="0"
              value={amount}
              placeholder="0"
              onChange={e => setAmount(e.target.value)}
            />
          </div>
        </div>

        <div className="fee-modal-foot">
          <Tooltip text="Discard changes and close">
            <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
          </Tooltip>
          <Tooltip text={`Save transport fee for ${student.name}`}>
            <button className="fee-btn fee-btn-primary" onClick={validateAndSave}>
              <i className="fa-solid fa-floppy-disk"></i> Save
            </button>
          </Tooltip>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FEE CHALLANS TAB — month/year filter + smart search + class table
   + per-class expandable student-level challan list.

   Step 6a (this turn): sub-segments shell, filters, table, student
   rows, delete confirms, tooltips, dark mode.
   Step 6b (next): Generate / Discount / Download / Preview modals.
   Step 6c: Family Tree Challans.
   ═══════════════════════════════════════════════════════════════════ */

const FEE_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function FeeChallansTab({ toast }) {
  const [seg, setSeg] = useState('challan');

  return (
    <>
      {/* Sub-segments: Fee Challans / Family Tree Challans */}
      <div className="fee-seg">
        <Tooltip text="Single-student challans grouped by class">
          <button
            className={`fee-seg-btn${seg === 'challan' ? ' active' : ''}`}
            onClick={() => setSeg('challan')}
          >
            <i className="fa-solid fa-file-invoice"></i> Fee Challans
          </button>
        </Tooltip>
        <Tooltip text="Combine siblings into a single guardian challan">
          <button
            className={`fee-seg-btn${seg === 'family' ? ' active' : ''}`}
            onClick={() => setSeg('family')}
          >
            <i className="fa-solid fa-people-roof"></i> Family Tree Challans
          </button>
        </Tooltip>
      </div>

      {seg === 'challan'
        ? <FeeChallansList toast={toast} />
        : <FamilyTreeChallansList toast={toast} />}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FAMILY TREE CHALLANS — combines siblings under one guardian. Mirrors
   FeeChallansList structurally: filters, smart search, table, per-row
   expand with children list, status-based per-child actions, and bulk
   generate (the BulkGenerateModal in 'family' mode), plus dedicated
   family-slip Preview/Download flows.
   ═══════════════════════════════════════════════════════════════════ */
function FamilyTreeChallansList({ toast }) {
  const { data: serverFams = [] }      = useAsync(feeService.getFamilies, []);
  const { data: settings = {} }        = useAsync(feeService.getFeeSettings, []);
  const { data: genInitial }           = useAsync(feeService.getGeneratedFamilyChallans, []);

  /* Local mirror of families (mutable: remove-child support) */
  const [families, setFamilies] = useState(null);
  useEffect(() => {
    if (serverFams.length && families == null) setFamilies(serverFams);
  }, [serverFams, families]);
  const list = useMemo(() => families || [], [families]);

  /* Filters */
  const today = new Date();
  const [month, setMonth] = useState(FEE_MONTHS[today.getMonth()]);
  const [year, setYear]   = useState(String(today.getFullYear()));
  const [appliedMonth, setAppliedMonth] = useState(month);
  const [appliedYear, setAppliedYear]   = useState(year);

  /* Smart search */
  const [searchQ, setSearchQ]       = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchAnchorRef             = useRef(null);
  useEffect(() => {
    if (!searchOpen) return undefined;
    const onDown = (e) => {
      if (searchAnchorRef.current && !searchAnchorRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [searchOpen]);
  useEffect(() => {
    if (!searchOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setSearchOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen]);

  /* Generation state */
  const [genSet, setGenSet] = useState(null);
  useEffect(() => { if (genInitial && genSet == null) setGenSet(new Set(genInitial)); }, [genInitial, genSet]);
  const monthIdx = FEE_MONTHS.indexOf(appliedMonth);
  const keyOf    = (famKey, reg) => `${famKey}|${reg}|${monthIdx}`;

  /* Expanded row */
  const [openKey, setOpenKey]                       = useState(null);
  const [confirm, setConfirm]                       = useState(null);
  const [bulkGen, setBulkGen]                       = useState(null);
  const [challanPreview, setChallanPreview]         = useState(null);
  const [downloadCtx, setDownloadCtx]               = useState(null);

  const apply = () => {
    setAppliedMonth(month); setAppliedYear(year);
    toast(`Loaded ${month} ${year} family challans`, 'info');
  };
  const resetFilters = () => {
    setMonth(FEE_MONTHS[today.getMonth()]);
    setYear(String(today.getFullYear()));
    setAppliedMonth(FEE_MONTHS[today.getMonth()]);
    setAppliedYear(String(today.getFullYear()));
    setSearchQ('');
  };

  const genCountFor = (famKey, children) => (children || []).reduce(
    (a, ch) => a + (genSet && genSet.has(keyOf(famKey, ch.reg)) ? 1 : 0), 0,
  );
  const isGen = (famKey, reg) => !!genSet && genSet.has(keyOf(famKey, reg));

  /* ── Bulk generate (family mode) ── */
  const openBulkGen = (f) => {
    if (!f.children.length) { toast('No children in this family', 'warning'); return; }
    /* Build pseudo-students for BulkGenerateModal — re-use that infra. */
    const pseudoStudents = f.children.map(ch => ({
      reg: ch.reg, name: ch.name, father: ch.father,
      transport: 0, dues: ch.dues || 0, advance: ch.advance || 0, current: 0,
    }));
    /* Fixed family-mode head categories (no per-head amounts — family
       combined challan rolls up each child's fee+transport−discount). */
    const familyHeads = [
      { name: 'Tuition Fee' },
      { name: 'Transport Fee' },
      { name: 'Admission Fee' },
      { name: 'Examination Fee' },
    ];
    setBulkGen({
      classMeta: { key: f.key, cls: f.name, sec: f.guardian },
      students:  pseudoStudents,
      heads:     familyHeads,
    });
  };
  const handleBulkGenerated = (famKey, regs) => {
    setGenSet(prev => {
      const n = new Set(prev);
      regs.forEach(reg => n.add(keyOf(famKey, reg)));
      return n;
    });
  };
  const openIndivGen = (f, ch) => {
    /* Roll-up child's family-level fee into `current` so the modal's
       student card can display Total Fee + Pending Amount via the same
       (current − dues − advance) calculation used in class single-mode. */
    const totalFee = (+ch.fee || 0) + (+ch.transport || 0) - (+ch.discount || 0);
    const pseudo = {
      reg: ch.reg, name: ch.name, father: ch.father,
      transport: 0,
      dues:    +ch.dues    || 0,
      advance: +ch.advance || 0,
      current: totalFee,
    };
    const familyHeads = [
      { name: 'Tuition Fee' },
      { name: 'Transport Fee' },
      { name: 'Admission Fee' },
      { name: 'Examination Fee' },
    ];
    setBulkGen({
      /* Pass the child's actual class/section to the card, but keep the
         family key so the genSet keys roll up under the family. */
      classMeta: { key: f.key, cls: ch.cls, sec: ch.sec, familyName: f.name, guardian: f.guardian },
      students:  [pseudo],
      heads:     familyHeads,
      mode:      'single',
    });
  };

  /* ── Preview / Download ── */
  const openPreview = (f) => {
    if (!f.children.length) { toast('No children to preview', 'info'); return; }
    setChallanPreview({
      title:    'Family Challan Preview',
      sub:      `${f.name} — ${f.guardian} · ${f.children.length} child${f.children.length === 1 ? '' : 'ren'} · Parent · Bank · School copies`,
      family:   f,
      innerHtml: buildFamilyChallanInner({ family: f, settings, bw: false }),
    });
  };
  const openDownload = (f) => {
    if (!f.children.length) { toast('Nothing to download', 'info'); return; }
    setDownloadCtx({
      family: f,
      sub: `${f.name} — ${f.guardian} · ${f.children.length} children`,
      defaultSize: settings.printSize || 'a4',
    });
  };
  const runDownload = (family, { theme, fmt, size = 'a4' }) => {
    const bw   = theme === 'bw';
    const html = buildFamilyChallanHTML({ family, settings, bw, size });
    const w    = window.open('', '_blank');
    if (!w) { toast('Please allow pop-ups to download the challan', 'error'); return; }
    w.document.write(html);
    w.document.close();
    const sizeT = size === 'thermal' ? 'Thermal 80mm' : 'A4';
    toast(`Generating ${sizeT} · ${bw ? 'B&W' : 'Color'} ${fmt === 'word' ? 'Word' : 'PDF'} — family challan…`, 'info');
    if (fmt === 'word') {
      try {
        const blob = new Blob([html], { type: 'application/msword' });
        const url  = URL.createObjectURL(blob);
        const a    = w.document.createElement('a');
        a.href = url;
        a.download = `${family.name.replace(/\s+/g, '-')}-family-challan.doc`;
        w.document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        setTimeout(() => { try { w.close(); } catch (e) { /* ignore */ } }, 300);
      } catch (e) { /* ignore */ }
    } else {
      w.onload = () => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } };
    }
    setTimeout(() => toast('Family challan ready — use your browser\'s Save as PDF.', 'success'), 1100);
  };

  /* ── Confirm-driven actions ── */
  const requestDeleteChildChallan = (f, ch) => {
    setConfirm({
      title:   'Delete child challan?',
      message: `${ch.name}'s ${appliedMonth} ${appliedYear} challan will be deleted.`,
      hint:    'This action cannot be undone.',
      onConfirm: async () => {
        setGenSet(prev => { const n = new Set(prev); n.delete(keyOf(f.key, ch.reg)); return n; });
        await feeService.deleteFamilyChallan(f.key, ch.reg, monthIdx);
        toast(`Challan removed for ${ch.name}`, 'success');
      },
    });
  };
  const requestRemoveChild = (f, ch) => {
    setConfirm({
      title:   'Remove child from family challan?',
      message: <span><strong>{ch.name}</strong> will be removed from the combined challan for <strong>{f.name}</strong>.</span>,
      hint:    'The child stays in the regular student roster — only the family link is removed.',
      confirmLabel: 'Yes, Remove',
      icon:    'fa-user-minus',
      onConfirm: async () => {
        setFamilies(prev => prev.map(x => x.key === f.key ? {
          ...x,
          children: x.children.filter(c => c.reg !== ch.reg),
        } : x));
        setGenSet(prev => { const n = new Set(prev); n.delete(keyOf(f.key, ch.reg)); return n; });
        await feeService.removeFamilyChild(f.key, ch.reg);
        toast('Child removed from family challan', 'success');
      },
    });
  };

  /* ── Smart search ── */
  const matches = useCallback(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return [];
    return list.filter(f => `${f.name} ${f.guardian}`.toLowerCase().includes(q)).slice(0, 8);
  }, [searchQ, list])();

  const clearSearch = () => { setSearchQ(''); setSearchOpen(false); };

  const focusOnFamily = (f) => {
    setOpenKey(f.key);
    clearSearch();
    toast('Jumped to family', 'info');
    setTimeout(() => {
      const el = document.getElementById(`fam-row-${f.key}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('fee-st-flash');
        setTimeout(() => el.classList.remove('fee-st-flash'), 1700);
      }
    }, 380);
  };

  return (
    <>
      {/* Filters + smart search */}
      <div className="fee-section fee-section--overflow">
        <div className="fee-section-body">
          <div className="fee-filters">
            <div className="fee-field">
              <span className="fee-label">Month</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={month} onChange={e => setMonth(e.target.value)}>
                  {FEE_MONTHS.map(m => <option key={m}>{m}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
            <div className="fee-field">
              <span className="fee-label">Year</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={year} onChange={e => setYear(e.target.value)}>
                  <option>2025</option><option>2026</option><option>2027</option>
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
            <Tooltip text="Load family challan data for the selected month and year">
              <button className="fee-btn fee-btn-primary" onClick={apply}>
                <i className="fa-solid fa-filter"></i> Get Families
              </button>
            </Tooltip>
            <Tooltip text="Reset filters and search to defaults">
              <button className="fee-btn fee-btn-ghost" onClick={resetFilters}>
                <i className="fa-solid fa-rotate-left"></i> Reset
              </button>
            </Tooltip>
          </div>

          <div className="fee-searchrow">
            <div className="fee-field" style={{ width: '100%' }}>
              <span className="fee-label">Search Family</span>
              <div className="fee-search-anchor" ref={searchAnchorRef}>
                <div className="fee-search-box">
                  <i className="fa-solid fa-magnifying-glass"></i>
                  <input
                    value={searchQ}
                    autoComplete="off"
                    onChange={e => { setSearchQ(e.target.value); setSearchOpen(true); }}
                    onFocus={() => setSearchOpen(true)}
                    placeholder="Search by Family Name or Guardian"
                  />
                  {searchQ && (
                    <Tooltip text="Clear search">
                      <button type="button" className="fee-search-clear" onClick={clearSearch} aria-label="Clear search">
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </Tooltip>
                  )}
                </div>
                <div className={`fee-search-results${searchOpen && searchQ ? ' open' : ''}`}>
                  {matches.length === 0 ? (
                    <div className="fee-sr-empty">No families found for "<b>{searchQ}</b>"</div>
                  ) : matches.map(f => {
                    const initial = (f.name.match(/\d+/) || [f.name[0]])[0];
                    return (
                      <button type="button" key={f.key} className="fee-sr-item" onClick={() => focusOnFamily(f)}>
                        <div className="fee-sr-av">{initial}</div>
                        <div className="fee-sr-main">
                          <div className="fee-sr-name">{f.name}</div>
                          <div className="fee-sr-meta">
                            <span><b>Guardian:</b> {f.guardian}</span>
                            <span><b>Children:</b> {f.children.length}</span>
                          </div>
                        </div>
                        <div className="fee-sr-go"><i className="fa-solid fa-arrow-right"></i></div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="fee-hint">
                <i className="fa-solid fa-circle-info"></i>
                <span>Search any family by family name or guardian name.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fee-info">
        <i className="fa-solid fa-circle-info"></i>
        <span>
          Family challans combine all siblings under one guardian into a single payable challan.
          The <strong>Children</strong> count shows how many of the family's children have a challan generated.
        </span>
      </div>

      <div className="fee-section">
        <div className="fee-table-head fee-family-row">
          <div className="fee-th">#</div>
          <div className="fee-th">Family / Guardian</div>
          <div className="fee-th fee-center">Children</div>
          <div className="fee-th fee-center">Download</div>
          <div className="fee-th fee-center">Bulk</div>
          <div className="fee-th fee-center">Details</div>
        </div>

        {list.length === 0 ? (
          <div className="fee-empty">No families configured.</div>
        ) : list.map((f, i) => {
          const isOpen = openKey === f.key;
          const gen    = genCountFor(f.key, f.children);
          const tot    = f.children.length;
          const total  = f.children.reduce((a, ch) => a + (+ch.fee || 0) + (+ch.transport || 0) - (+ch.discount || 0), 0);
          return (
            <div key={f.key} className="fee-rowwrap" id={`fam-row-${f.key}`}>
              <div
                className={`fee-row fee-family-row${isOpen ? ' open' : ''}`}
                onClick={() => setOpenKey(isOpen ? null : f.key)}
              >
                <div className="fee-td" data-label="#"><span className="fee-row-icon">{i + 1}</span></div>
                <div className="fee-td fee-name" data-label="Family / Guardian">
                  {f.name} <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>— {f.guardian}</span>
                </div>
                <div className="fee-td fee-center" data-label="Children">
                  <span className="fee-count">{gen} <small>/ {tot}</small></span>
                </div>
                <div className="fee-td fee-center" data-label="Download" onClick={e => e.stopPropagation()}>
                  <Tooltip text={`Download combined challan for ${f.name}`}>
                    <button className="fee-iconbtn" onClick={() => openDownload(f)}>
                      <i className="fa-solid fa-file-arrow-down"></i>
                    </button>
                  </Tooltip>
                </div>
                <div className="fee-td fee-center" data-label="Bulk" onClick={e => e.stopPropagation()}>
                  <Tooltip text={`Generate challans for all ${tot} children`}>
                    <button className="fee-btn fee-btn-primary fee-btn-xs" onClick={() => openBulkGen(f)}>
                      <i className="fa-solid fa-people-roof"></i> Bulk Challans
                    </button>
                  </Tooltip>
                </div>
                <div className="fee-td fee-center" data-label="Details">
                  <Tooltip text={isOpen ? 'Hide children list' : 'Show children list'}>
                    <span className={`fee-chevbtn${isOpen ? ' open' : ''}`}>
                      <i className="fa-solid fa-chevron-down fee-chev"></i>
                    </span>
                  </Tooltip>
                </div>
              </div>

              <div className={`fee-detail${isOpen ? ' open' : ''}`}>
                <div className="fee-detail-inner">
                  <div className="fee-detail-title">
                    <i className="fa-solid fa-children"></i> Children in {f.name}
                  </div>

                  <div className="fee-stbl-wrap">
                    <table className="fee-stbl">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Reg No</th>
                          <th>Name</th>
                          <th>Class</th>
                          <th>Sec</th>
                          <th className="fee-right">Fee</th>
                          <th className="fee-right">Transport</th>
                          <th className="fee-right">Discount</th>
                          <th className="fee-right">Total Payable</th>
                          <th className="fee-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {f.children.length === 0 ? (
                          <tr><td colSpan="10" className="fee-stbl-empty">No children in this family.</td></tr>
                        ) : f.children.map((ch, j) => {
                          const pay = (+ch.fee || 0) + (+ch.transport || 0) - (+ch.discount || 0);
                          const generated = isGen(f.key, ch.reg);
                          return (
                            <tr key={ch.reg}>
                              <td className="fee-num">{j + 1}</td>
                              <td>{ch.reg}</td>
                              <td><b>{ch.name}</b></td>
                              <td>{ch.cls}</td>
                              <td>{ch.sec}</td>
                              <td className="fee-right">{money(ch.fee)}</td>
                              <td className="fee-right">{money(ch.transport)}</td>
                              <td className="fee-right">{money(ch.discount)}</td>
                              <td className="fee-right"><b>{money(pay)}</b></td>
                              <td className="fee-center fee-st-actions">
                                {generated ? (
                                  <Tooltip text={`Delete ${appliedMonth} challan for ${ch.name}`}>
                                    <button className="fee-iconbtn danger" onClick={() => requestDeleteChildChallan(f, ch)}>
                                      <i className="fa-solid fa-trash-can"></i>
                                    </button>
                                  </Tooltip>
                                ) : (
                                  <Tooltip text={`Generate family challan for ${ch.name}`}>
                                    <button className="fee-iconbtn green" onClick={() => openIndivGen(f, ch)}>
                                      <i className="fa-solid fa-file-circle-plus"></i>
                                    </button>
                                  </Tooltip>
                                )}
                                <Tooltip text="Download family challan">
                                  <button className="fee-iconbtn" onClick={() => openDownload(f)}>
                                    <i className="fa-solid fa-download"></i>
                                  </button>
                                </Tooltip>
                                <Tooltip text="View family challan">
                                  <button className="fee-iconbtn" onClick={() => openPreview(f)}>
                                    <i className="fa-solid fa-eye"></i>
                                  </button>
                                </Tooltip>
                                <Tooltip text="Remove child from family">
                                  <button className="fee-iconbtn danger" onClick={() => requestRemoveChild(f, ch)}>
                                    <i className="fa-solid fa-user-minus"></i>
                                  </button>
                                </Tooltip>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="fee-family-total">
                    Total Family Payable: <span>{money(total)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <FeeConfirmDialog cfg={confirm} onClose={() => setConfirm(null)} />

      <BulkGenerateModal
        open={!!bulkGen}
        classMeta={bulkGen?.classMeta}
        students={bulkGen?.students || []}
        heads={bulkGen?.heads || []}
        defaultMonth={appliedMonth}
        genSet={genSet}
        keyOf={keyOf}
        onClose={() => setBulkGen(null)}
        onGenerated={handleBulkGenerated}
        toast={toast}
        familyMode
        singleMode={bulkGen?.mode === 'single'}
      />

      <ChallanPreviewModal
        cfg={challanPreview}
        onClose={() => setChallanPreview(null)}
        onDownload={() => {
          const f = challanPreview?.family;
          setChallanPreview(null);
          if (f) openDownload(f);
        }}
      />

      <DownloadPickerModal
        cfg={downloadCtx}
        onClose={() => setDownloadCtx(null)}
        onSubmit={(picks) => {
          const f = downloadCtx?.family;
          setDownloadCtx(null);
          if (f) runDownload(f, picks);
        }}
      />
    </>
  );
}

function FeeChallansList({ toast }) {
  const { data: classes = [] } = useAsync(feeService.getFeeClasses, []);
  const { data: studentsMap = {} } = useAsync(feeService.getTransportFee, []);
  const { data: headsMap = {} } = useAsync(feeService.getFeeHeads, []);
  const { data: settings = {} } = useAsync(feeService.getFeeSettings, []);
  const { data: generatedInitial } = useAsync(feeService.getGeneratedChallans, []);

  /* Filters */
  const today = new Date();
  const [month, setMonth] = useState(FEE_MONTHS[today.getMonth()]);
  const [year, setYear]   = useState(String(today.getFullYear()));
  const [appliedMonth, setAppliedMonth] = useState(month);
  const [appliedYear, setAppliedYear]   = useState(year);

  /* Smart search */
  const [searchQ, setSearchQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchAnchorRef = useRef(null);

  /* Close on outside click (mousedown so it fires before a focus-blur race) */
  useEffect(() => {
    if (!searchOpen) return undefined;
    const onDown = (e) => {
      if (searchAnchorRef.current && !searchAnchorRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [searchOpen]);

  /* Close on Escape */
  useEffect(() => {
    if (!searchOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setSearchOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen]);

  /* Generation state (local mirror of generated set) */
  const [genSet, setGenSet] = useState(null);
  useEffect(() => { if (generatedInitial && genSet == null) setGenSet(new Set(generatedInitial)); }, [generatedInitial, genSet]);
  const monthIdx = FEE_MONTHS.indexOf(appliedMonth);
  const keyOf    = (classKey, reg) => `${classKey}|${reg}|${monthIdx}`;

  /* Expanded row */
  const [openKey, setOpenKey] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [bulkGen, setBulkGen] = useState(null);          // { classMeta, students, heads }
  const [challanPreview, setChallanPreview] = useState(null); // { title, sub, ctx, innerHtml }
  const [downloadCtx, setDownloadCtx] = useState(null);  // { type, classKey, reg?, sub }
  const [discountCtx, setDiscountCtx] = useState(null);  // { classMeta, student, heads, initial }
  /* Per-class per-student discount map: { [classKey]: { [reg]: { [headName]: amount } } } */
  const [discountMap, setDiscountMap] = useState({});

  const apply = () => {
    setAppliedMonth(month);
    setAppliedYear(year);
    toast(`Loaded ${month} ${year} challans`, 'info');
  };

  const resetFilters = () => {
    setMonth(FEE_MONTHS[today.getMonth()]);
    setYear(String(today.getFullYear()));
    setAppliedMonth(FEE_MONTHS[today.getMonth()]);
    setAppliedYear(String(today.getFullYear()));
    setSearchQ('');
  };

  /* Compute generated counts per class against the applied month */
  const genCountFor = (classKey) => {
    if (!genSet) return 0;
    const studs = studentsMap[classKey] || [];
    return studs.reduce((acc, s) => acc + (genSet.has(keyOf(classKey, s.reg)) ? 1 : 0), 0);
  };
  const isGenerated = (classKey, reg) => !!genSet && genSet.has(keyOf(classKey, reg));

  const openBulkGen = (c) => {
    const students = studentsMap[c.key] || [];
    const heads    = headsMap[c.key] || [];
    if (students.length === 0) {
      toast('No students enrolled in this class', 'warning');
      return;
    }
    setBulkGen({ classMeta: c, students, heads });
  };
  const handleBulkGenerated = (classKey, regs) => {
    setGenSet(prev => {
      const n = new Set(prev);
      regs.forEach(reg => n.add(keyOf(classKey, reg)));
      return n;
    });
  };
  const openIndivGen = (c, s) => {
    setBulkGen({
      classMeta: c,
      students:  [s],
      heads:     headsMap[c.key] || [],
      mode:      'single',
    });
  };

  const resolveCtx = (ctx) => {
    const c = classes.find(x => x.key === ctx.classKey);
    if (!c) return null;
    const heads = headsMap[ctx.classKey] || [];
    if (ctx.type === 'student') {
      const s = (studentsMap[ctx.classKey] || []).find(x => x.reg === ctx.reg);
      if (!s) return null;
      return { classMeta: c, students: [s], heads, sub: `${s.name} · child of ${s.father || '—'}` };
    }
    if (ctx.type === 'bulk') {
      const all  = studentsMap[ctx.classKey] || [];
      const list = all.filter(s => genSet && genSet.has(keyOf(c.key, s.reg)));
      if (list.length === 0) return null;
      return { classMeta: c, students: list, heads, sub: `${c.cls} — Section ${c.sec} · ${list.length} student${list.length === 1 ? '' : 's'}` };
    }
    return null;
  };

  const openPreview = (ctx) => {
    const r = resolveCtx(ctx);
    if (!r) { toast('Nothing to preview', 'info'); return; }
    const inner = buildChallanInner({
      classMeta: r.classMeta, students: r.students, heads: r.heads,
      settings, discountMap, bw: false,
    });
    setChallanPreview({
      title: ctx.type === 'bulk' ? 'Bulk Challan Preview' : 'Challan Preview',
      sub:   `${r.sub} · Parent · Bank · School copies`,
      ctx,
      innerHtml: inner,
    });
  };
  const openDownload = (ctx) => {
    const r = resolveCtx(ctx);
    if (!r) { toast('Nothing to download', 'info'); return; }
    setDownloadCtx({ ...ctx, sub: r.sub, defaultSize: settings.printSize || 'a4' });
  };
  const runDownload = (ctx, { theme, fmt, size = 'a4' }) => {
    const r = resolveCtx(ctx);
    if (!r) { toast('Nothing to download', 'info'); return; }
    const bw   = theme === 'bw';
    const html = buildChallanHTML({
      classMeta: r.classMeta, students: r.students, heads: r.heads,
      settings, discountMap, bw, size,
    });
    const w = window.open('', '_blank');
    if (!w) { toast('Please allow pop-ups to download the challan', 'error'); return; }
    w.document.write(html);
    w.document.close();
    const cnt    = r.students.length;
    const sizeT  = size === 'thermal' ? 'Thermal 80mm' : 'A4';
    const label  = `${sizeT} · ${bw ? 'B&W' : 'Color'} ${fmt === 'word' ? 'Word' : 'PDF'}`;
    toast(`Generating ${label} — ${cnt} challan${cnt === 1 ? '' : 's'}…`, 'info');
    if (fmt === 'word') {
      /* Word: trigger download as .doc using HTML stream */
      try {
        const blob = new Blob([html], { type: 'application/msword' });
        const url  = URL.createObjectURL(blob);
        const a    = w.document.createElement('a');
        a.href = url;
        a.download = `${r.classMeta.cls}-${r.classMeta.sec}-challans.doc`;
        w.document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        setTimeout(() => { try { w.close(); } catch (e) { /* ignore */ } }, 300);
      } catch (e) { /* fall through to print */ }
    } else {
      w.onload = () => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } };
    }
    setTimeout(() => toast('Challan ready — use your browser\'s Save as PDF.', 'success'), 1100);
  };

  const openDiscount = (c, s) => {
    const heads   = headsMap[c.key] || [];
    if (heads.length === 0) { toast('Configure fee heads for this class first', 'warning'); return; }
    const initial = (discountMap[c.key] && discountMap[c.key][s.reg]) || {};
    setDiscountCtx({ classMeta: c, student: s, heads, initial });
  };
  const saveDiscount = (classKey, reg, perHead) => {
    setDiscountMap(prev => {
      const next = { ...prev };
      next[classKey] = { ...(next[classKey] || {}) };
      next[classKey][reg] = { ...perHead };
      return next;
    });
    toast('Discount saved', 'success');
    setDiscountCtx(null);
  };

  /* Confirm-driven delete */
  const requestDeleteClassChallans = (c) => {
    const gen = genCountFor(c.key);
    if (gen === 0) { toast('No challans to delete for this class', 'warning'); return; }
    setConfirm({
      title: 'Delete generated challans?',
      message: `All ${gen} challan${gen === 1 ? '' : 's'} for ${c.cls} (${c.sec}) in ${appliedMonth} ${appliedYear} will be removed.`,
      hint:   'This action cannot be undone.',
      onConfirm: async () => {
        const studs = studentsMap[c.key] || [];
        const next = new Set(genSet);
        studs.forEach(s => next.delete(keyOf(c.key, s.reg)));
        setGenSet(next);
        await feeService.deleteClassChallans(c.key, monthIdx);
        toast('Generated challans removed', 'success');
      },
    });
  };

  const requestDeleteStudentChallan = (c, s) => {
    setConfirm({
      title: 'Delete this challan?',
      message: `The ${appliedMonth} ${appliedYear} challan for ${s.name} will be deleted.`,
      hint:   'This action cannot be undone.',
      onConfirm: async () => {
        const k = keyOf(c.key, s.reg);
        setGenSet(prev => { const n = new Set(prev); n.delete(k); return n; });
        await feeService.deleteChallan(c.key, s.reg, monthIdx);
        toast(`Challan removed for ${s.name}`, 'success');
      },
    });
  };

  /* Smart-search results — matches HTML feeLiveSearch: name + father + reg */
  const allMatches = useCallback(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return [];
    const out = [];
    classes.forEach(c => {
      (studentsMap[c.key] || []).forEach(s => {
        const hay = `${s.name} ${s.father || ''} ${s.reg}`.toLowerCase();
        if (hay.includes(q)) out.push({ c, s });
      });
    });
    return out.slice(0, 8);
  }, [searchQ, classes, studentsMap]);
  const matches = allMatches();

  const clearSearch = () => { setSearchQ(''); setSearchOpen(false); };

  const focusOnStudent = (c, s) => {
    setOpenKey(c.key);
    clearSearch();
    toast('Jumped to student', 'info');
    setTimeout(() => {
      const el = document.getElementById(`fee-st-${c.key}-${s.reg}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('fee-st-flash');
        setTimeout(() => el.classList.remove('fee-st-flash'), 1700);
      }
    }, 380);
  };

  return (
    <>
      {/* Filters + smart search */}
      <div className="fee-section fee-section--overflow">
        <div className="fee-section-body">
          <div className="fee-filters">
            <div className="fee-field">
              <span className="fee-label">Month</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={month} onChange={e => setMonth(e.target.value)}>
                  {FEE_MONTHS.map(m => <option key={m}>{m}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
            <div className="fee-field">
              <span className="fee-label">Year</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={year} onChange={e => setYear(e.target.value)}>
                  <option>2025</option><option>2026</option><option>2027</option>
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
            <Tooltip text="Load challan data for the selected month and year">
              <button className="fee-btn fee-btn-primary" onClick={apply}>
                <i className="fa-solid fa-filter"></i> Get Students
              </button>
            </Tooltip>
            <Tooltip text="Reset filters and search to defaults">
              <button className="fee-btn fee-btn-ghost" onClick={resetFilters}>
                <i className="fa-solid fa-rotate-left"></i> Reset
              </button>
            </Tooltip>
          </div>

          <div className="fee-searchrow">
            <div className="fee-field" style={{ width: '100%' }}>
              <span className="fee-label">Search Student</span>
              <div className="fee-search-anchor" ref={searchAnchorRef}>
                <div className="fee-search-box">
                  <i className="fa-solid fa-magnifying-glass"></i>
                  <input
                    value={searchQ}
                    autoComplete="off"
                    onChange={e => { setSearchQ(e.target.value); setSearchOpen(true); }}
                    onFocus={() => setSearchOpen(true)}
                    placeholder="Search by Name, Father Name or Registration Number"
                  />
                  {searchQ && (
                    <Tooltip text="Clear search">
                      <button
                        type="button"
                        className="fee-search-clear"
                        onClick={clearSearch}
                        aria-label="Clear search"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </Tooltip>
                  )}
                </div>
                <div className={`fee-search-results${searchOpen && searchQ ? ' open' : ''}`}>
                  {matches.length === 0 ? (
                    <div className="fee-sr-empty">No students found for "<b>{searchQ}</b>"</div>
                  ) : matches.map(({ c, s }) => {
                    const gen = !!genSet && genSet.has(keyOf(c.key, s.reg));
                    const initial = (s.name || '').trim()[0] || '?';
                    return (
                      <button
                        type="button"
                        key={`${c.key}-${s.reg}`}
                        className="fee-sr-item"
                        onClick={() => focusOnStudent(c, s)}
                      >
                        <div className="fee-sr-av">{initial.toUpperCase()}</div>
                        <div className="fee-sr-main">
                          <div className="fee-sr-name">
                            {s.name}
                            {gen
                              ? <span className="fee-chip fee-chip-active"><i className="fa-solid fa-circle-check"></i> Generated</span>
                              : <span className="fee-chip fee-chip-due"><i className="fa-solid fa-circle-exclamation"></i> Pending</span>}
                          </div>
                          <div className="fee-sr-meta">
                            <span><b>Father:</b> {s.father || '—'}</span>
                            <span><b>Class:</b> {c.cls}</span>
                            <span><b>Section:</b> {c.sec}</span>
                            <span><b>Reg:</b> {s.reg}</span>
                          </div>
                        </div>
                        <div className="fee-sr-go"><i className="fa-solid fa-arrow-right"></i></div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="fee-hint">
                <i className="fa-solid fa-circle-info"></i>
                <span>Search any student by name, father name, or registration number.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Header + class table */}
      <div className="fee-info">
        <i className="fa-solid fa-circle-info"></i>
        <span>
          Bulk generation will create challans for all students in this class. The
          <strong> Generated</strong> count shows how many challans are created out of total students.
        </span>
      </div>

      <div className="fee-section">
        <div className="fee-table-head fee-challan-row">
          <div className="fee-th">#</div>
          <div className="fee-th">Class</div>
          <div className="fee-th">Section</div>
          <div className="fee-th fee-center">Download</div>
          <div className="fee-th fee-center">Generated</div>
          <div className="fee-th fee-center">Bulk</div>
          <div className="fee-th fee-center">Delete</div>
          <div className="fee-th fee-center">Details</div>
        </div>

        {classes.length === 0 ? (
          <div className="fee-empty">No classes available.</div>
        ) : classes.map((c, i) => {
          const students = studentsMap[c.key] || [];
          const isOpen = openKey === c.key;
          const gen = genCountFor(c.key);
          const total = students.length;
          const pct = total ? Math.round(gen / total * 100) : 0;
          return (
            <div key={c.key} className="fee-rowwrap">
              <div
                className={`fee-row fee-challan-row${isOpen ? ' open' : ''}`}
                onClick={() => setOpenKey(isOpen ? null : c.key)}
              >
                <div className="fee-td" data-label="#"><span className="fee-row-icon">{i + 1}</span></div>
                <div className="fee-td fee-name" data-label="Class">{c.cls}</div>
                <div className="fee-td" data-label="Section"><span className="fee-tag">{c.sec}</span></div>
                <div className="fee-td fee-center" data-label="Download" onClick={e => e.stopPropagation()}>
                  <Tooltip text={`Download all generated challans for ${c.cls} (${c.sec})`}>
                    <button className="fee-iconbtn" onClick={() => openDownload({ type: 'bulk', classKey: c.key })}>
                      <i className="fa-solid fa-file-arrow-down"></i>
                    </button>
                  </Tooltip>
                </div>
                <div className="fee-td fee-center" data-label="Generated">
                  <div className="fee-gen-block">
                    <span className="fee-count">{gen} <small>/ {total}</small></span>
                    <div className="fee-gen-bar">
                      <span style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
                <div className="fee-td fee-center" data-label="Bulk" onClick={e => e.stopPropagation()}>
                  <Tooltip text={`Generate challans for all ${total} students in ${c.cls} (${c.sec})`}>
                    <button className="fee-btn fee-btn-primary fee-btn-xs" onClick={() => openBulkGen(c)}>
                      <i className="fa-solid fa-layer-group"></i> Bulk Challans
                    </button>
                  </Tooltip>
                </div>
                <div className="fee-td fee-center" data-label="Delete" onClick={e => e.stopPropagation()}>
                  <Tooltip text={gen > 0 ? `Delete all ${gen} generated challan${gen === 1 ? '' : 's'} for this class` : 'No challans to delete'}>
                    <button
                      className="fee-iconbtn danger"
                      onClick={() => requestDeleteClassChallans(c)}
                      disabled={gen === 0}
                      style={gen === 0 ? { opacity: .45, cursor: 'not-allowed' } : undefined}
                    >
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </Tooltip>
                </div>
                <div className="fee-td fee-center" data-label="Details">
                  <Tooltip text={isOpen ? 'Hide student challan list' : 'Show student challan list'}>
                    <span className={`fee-chevbtn${isOpen ? ' open' : ''}`}>
                      <i className="fa-solid fa-chevron-down fee-chev"></i>
                    </span>
                  </Tooltip>
                </div>
              </div>

              <div className={`fee-detail${isOpen ? ' open' : ''}`}>
                <div className="fee-detail-inner">
                  <div className="fee-detail-title">
                    <i className="fa-solid fa-users"></i> {appliedMonth} {appliedYear} — Challan List
                  </div>

                  <div className="fee-stbl-wrap">
                    <table className="fee-stbl">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Reg No</th>
                          <th>Name</th>
                          <th>Father</th>
                          <th className="fee-right">Total Dues</th>
                          <th className="fee-right">Advance</th>
                          <th className="fee-right">Current Fee</th>
                          <th className="fee-right">Total Payable</th>
                          <th className="fee-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.length === 0 ? (
                          <tr><td colSpan="9" className="fee-stbl-empty">No students in this section.</td></tr>
                        ) : students.map((s, j) => {
                          const payable = (+s.current || 0) - (+s.dues || 0) - (+s.advance || 0);
                          const generated = isGenerated(c.key, s.reg);
                          return (
                            <tr key={s.reg} id={`fee-st-${c.key}-${s.reg}`}>
                              <td className="fee-num">{j + 1}</td>
                              <td>{s.reg}</td>
                              <td><b>{s.name}</b></td>
                              <td>{s.father}</td>
                              <td className="fee-right">{money(s.dues)}</td>
                              <td className="fee-right">{money(s.advance)}</td>
                              <td className="fee-right" style={+s.current === 0 ? { color: '#DC2626', fontWeight: 700 } : undefined}>
                                {money(s.current)}
                              </td>
                              <td className={`fee-right${payable < 0 ? ' fee-neg' : ''}`}>
                                {money(payable)}
                              </td>
                              <td className="fee-center fee-st-actions">
                                {generated ? (
                                  <Tooltip text={`Delete ${appliedMonth} challan for ${s.name}`}>
                                    <button className="fee-iconbtn danger" onClick={() => requestDeleteStudentChallan(c, s)}>
                                      <i className="fa-solid fa-trash-can"></i>
                                    </button>
                                  </Tooltip>
                                ) : (
                                  <Tooltip text={`Generate ${appliedMonth} challan for ${s.name}`}>
                                    <button className="fee-iconbtn green" onClick={() => openIndivGen(c, s)}>
                                      <i className="fa-solid fa-file-circle-plus"></i>
                                    </button>
                                  </Tooltip>
                                )}
                                <Tooltip text="Download this student's challan">
                                  <button
                                    className="fee-iconbtn"
                                    disabled={!generated}
                                    style={!generated ? { opacity: .45, cursor: 'not-allowed' } : undefined}
                                    onClick={() => openDownload({ type: 'student', classKey: c.key, reg: s.reg })}
                                  >
                                    <i className="fa-solid fa-download"></i>
                                  </button>
                                </Tooltip>
                                <Tooltip text="View challan preview">
                                  <button
                                    className="fee-iconbtn"
                                    disabled={!generated}
                                    style={!generated ? { opacity: .45, cursor: 'not-allowed' } : undefined}
                                    onClick={() => openPreview({ type: 'student', classKey: c.key, reg: s.reg })}
                                  >
                                    <i className="fa-solid fa-eye"></i>
                                  </button>
                                </Tooltip>
                                <Tooltip text="Apply student-specific fee discounts">
                                  <button className="fee-iconbtn" onClick={() => openDiscount(c, s)}>
                                    <i className="fa-solid fa-percent"></i>
                                  </button>
                                </Tooltip>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <FeeConfirmDialog cfg={confirm} onClose={() => setConfirm(null)} />

      <BulkGenerateModal
        open={!!bulkGen}
        classMeta={bulkGen?.classMeta}
        students={bulkGen?.students || []}
        heads={bulkGen?.heads || []}
        defaultMonth={appliedMonth}
        genSet={genSet}
        keyOf={keyOf}
        onClose={() => setBulkGen(null)}
        onGenerated={handleBulkGenerated}
        toast={toast}
        singleMode={bulkGen?.mode === 'single'}
      />

      <ChallanPreviewModal
        cfg={challanPreview}
        onClose={() => setChallanPreview(null)}
        onDownload={() => {
          const ctx = challanPreview?.ctx;
          setChallanPreview(null);
          if (ctx) openDownload(ctx);
        }}
      />

      <DownloadPickerModal
        cfg={downloadCtx}
        onClose={() => setDownloadCtx(null)}
        onSubmit={(picks) => {
          const ctx = downloadCtx;
          setDownloadCtx(null);
          if (ctx) runDownload(ctx, picks);
        }}
      />

      <DiscountManagerModal
        cfg={discountCtx}
        onClose={() => setDiscountCtx(null)}
        onSave={saveDiscount}
        toast={toast}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   BULK GENERATE MODAL — bulk-generates challans for every student of
   the picked class for the chosen month. Mirrors the reference HTML:
   Month + Challan Type + Multi-select Fee Heads + Issue/Due dates;
   then a footer "Generate Challans" CTA that swaps to an animated
   progress bar (batch increments at 55 ms intervals). At 100%, label
   flips to "Completed", a final toast fires, the modal closes.
   ═══════════════════════════════════════════════════════════════════ */
function BulkGenerateModal({
  open, classMeta, students, heads, defaultMonth,
  genSet, keyOf, onClose, onGenerated, toast,
  familyMode = false, singleMode = false,
}) {
  const todayISO  = () => new Date().toISOString().slice(0, 10);
  const plusDays  = (n) => {
    const d = new Date(); d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  const [month, setMonth]         = useState(defaultMonth || FEE_MONTHS[0]);
  const [type, setType]           = useState('1');     // '1' or '2'
  const [picked, setPicked]       = useState([]);      // selected fee head names
  const [msOpen, setMsOpen]       = useState(false);
  const [issueDate, setIssueDate] = useState(todayISO());
  const [dueDate, setDueDate]     = useState(plusDays(10));

  const [progress, setProgress]   = useState(null);    // null | { done, total, label }
  const cancelRef = useRef(false);
  const msAnchorRef = useRef(null);

  /* Reset state every time the modal opens */
  useEffect(() => {
    if (!open) return;
    cancelRef.current = false;
    setMonth(defaultMonth || FEE_MONTHS[0]);
    setType('1');
    setPicked([]);
    setMsOpen(false);
    setIssueDate(todayISO());
    setDueDate(plusDays(10));
    setProgress(null);
  }, [open, defaultMonth]);

  /* Esc + body-scroll lock */
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !progress) onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose, progress]);

  /* Close multi-select on outside click */
  useEffect(() => {
    if (!msOpen) return undefined;
    const onDown = (e) => {
      if (msAnchorRef.current && !msAnchorRef.current.contains(e.target)) {
        setMsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [msOpen]);

  if (!open || !classMeta) return null;

  const toggleHead = (name) => {
    setPicked(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };
  const headsLabel = picked.length === 0
    ? 'Select Heads'
    : `${picked.length} head${picked.length === 1 ? '' : 's'} selected`;

  const validate = () => {
    if (!issueDate) { toast('Pick an issue date', 'error'); return false; }
    if (!dueDate)   { toast('Pick a due date',   'error'); return false; }
    if (dueDate < issueDate) {
      toast('Due date cannot be before issue date', 'error');
      return false;
    }
    return true;
  };

  /* Animated batch run — Math.max(1, ceil(total/24)) per tick, 55 ms apart */
  const runBatch = () => {
    if (!validate()) return;
    const total = students.length;
    if (total === 0) { toast('No students to generate for', 'warning'); onClose(); return; }

    /* Filter out already-generated for the picked month */
    const monthIdx  = FEE_MONTHS.indexOf(month);
    const targets   = students.filter(s => !(genSet && genSet.has(keyOf(classMeta.key, s.reg))));
    const skipCount = total - targets.length;

    if (targets.length === 0) {
      toast(`All ${total} challan${total === 1 ? '' : 's'} are already generated for ${month}`, 'info');
      onClose();
      return;
    }

    setProgress({ done: 0, total: targets.length, label: 'Generating challans...' });

    let done = 0;
    const step = () => {
      if (cancelRef.current) return;
      const batch = Math.max(1, Math.ceil(targets.length / 24));
      for (let k = 0; k < batch && done < targets.length; k++) done++;
      setProgress({ done, total: targets.length, label: 'Generating challans...' });
      if (done < targets.length) {
        setTimeout(step, 55);
      } else {
        setProgress({ done, total: targets.length, label: 'Completed' });
        /* Commit to parent + persist via service */
        const regs = targets.map(s => s.reg);
        feeService.generateChallan(classMeta.key, regs, monthIdx, {
          heads: picked, type, issueDate, dueDate,
        }).catch(() => {});
        onGenerated(classMeta.key, regs);
        setTimeout(() => {
          const msg = skipCount > 0
            ? `${targets.length} challan${targets.length === 1 ? '' : 's'} generated (${skipCount} skipped — already existed)`
            : `${targets.length} challan${targets.length === 1 ? '' : 's'} generated successfully`;
          toast(msg, 'success');
          onClose();
        }, 500);
      }
    };
    setTimeout(step, 150);
  };

  const requestClose = () => {
    if (progress && progress.done < progress.total) {
      cancelRef.current = true;
    }
    onClose();
  };

  const pct = progress ? Math.round(progress.done / progress.total * 100) : 0;

  return createPortal(
    <div className="fee-overlay open" onClick={e => { if (e.target === e.currentTarget && !progress) onClose(); }}>
      <div className="fee-modal">
        <div className="fee-modal-head">
          <div className="fee-modal-head-title">
            <div className="fee-modal-head-icon">
              <i className={`fa-solid ${familyMode && !singleMode ? 'fa-people-roof' : 'fa-file-circle-plus'}`}></i>
            </div>
            <div>
              <div className="fee-modal-title">
                {singleMode
                  ? (familyMode ? 'Generate Family Challan' : 'Generate Challan')
                  : familyMode ? 'Generate Family Challans' : 'Generate Bulk Challans'}
              </div>
              <div className="fee-modal-sub">
                {singleMode
                  ? `${students[0]?.name} · child of ${students[0]?.father || '—'}`
                  : familyMode
                    ? `${classMeta.cls} — ${classMeta.sec} · ${students.length} child${students.length === 1 ? '' : 'ren'}`
                    : `${classMeta.cls} — Section ${classMeta.sec} · ${students.length} student${students.length === 1 ? '' : 's'}`}
              </div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="fee-modal-close" onClick={requestClose} disabled={!!(progress && progress.done < progress.total)} aria-label="Close">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </Tooltip>
        </div>

        <div className="fee-modal-body">
          {singleMode && students[0] && (() => {
            const s = students[0];
            const pending = (+s.current || 0) - (+s.dues || 0) - (+s.advance || 0);
            const totalHeads = heads.reduce((a, h) => a + (+h.amt || 0), 0);
            /* In family mode the heads carry no amount — show the child's
               rolled-up Total Fee (passed via s.current) as the "Standard
               Fee" line instead, so the card reflects what's billable. */
            const standard = familyMode ? (+s.current || 0) : totalHeads;
            const initials = (s.name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
            return (
              <div className="fee-stud-card">
                <div className="fee-stud-logo">{initials}</div>
                <div className="fee-stud-meta">
                  <div><b>Name</b> {s.name}</div>
                  <div><b>Father Name</b> {s.father || '—'}</div>
                  <div><b>Class</b> {classMeta.cls} ({classMeta.sec})</div>
                  <div><b>Reg No</b> {s.reg}</div>
                  {familyMode && classMeta.familyName && (
                    <div><b>Family</b> {classMeta.familyName} — {classMeta.guardian}</div>
                  )}
                  <div>
                    <b>Pending Amount</b>
                    {' '}
                    <span className={pending < 0 ? 'fee-neg' : ''}>{money(pending)}</span>
                  </div>
                  <div><b>{familyMode ? 'Total Fee' : 'Standard Fee'}</b> {money(standard)}</div>
                </div>
              </div>
            );
          })()}

          <div className="fee-filters" style={{ alignItems: 'flex-start', marginTop: singleMode ? 18 : 0 }}>
            <div className="fee-field">
              <span className="fee-label">Month</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={month} onChange={e => setMonth(e.target.value)} disabled={!!progress}>
                  {FEE_MONTHS.map(m => <option key={m}>{m}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
            <div className="fee-field">
              <span className="fee-label">Challan Type</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={type} onChange={e => setType(e.target.value)} disabled={!!progress}>
                  <option value="1">One Month</option>
                  <option value="2">Two Months</option>
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
            <div className="fee-field fee-field--grow">
              <span className="fee-label">Select Fee Heads</span>
              <div
                className={`fee-ms${msOpen ? ' open' : ''}`}
                ref={msAnchorRef}
              >
                <button
                  type="button"
                  className="fee-ms-toggle"
                  onClick={() => !progress && setMsOpen(o => !o)}
                  disabled={!!progress}
                >
                  <span>{headsLabel}</span>
                  <i className="fa-solid fa-chevron-down"></i>
                </button>
                {msOpen && (
                  <div className="fee-ms-menu">
                    {heads.length === 0 ? (
                      <div className="fee-ms-empty">No fee heads configured for this class.</div>
                    ) : heads.map(h => {
                      const sel = picked.includes(h.name);
                      const hasAmt = h.amt !== undefined && h.amt !== null;
                      return (
                        <button
                          type="button"
                          key={h.name}
                          className={`fee-ms-opt${sel ? ' sel' : ''}`}
                          onClick={() => toggleHead(h.name)}
                        >
                          <span className="fee-ms-check"><i className="fa-solid fa-check"></i></span>
                          <span className="fee-ms-name">{h.name}</span>
                          {hasAmt && <span className="fee-ms-amt">{money(h.amt)}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="fee-filters" style={{ marginTop: 14 }}>
            <div className="fee-field fee-field--grow">
              <span className="fee-label">Issue Date</span>
              <input
                className="fee-input"
                type="date"
                value={issueDate}
                onChange={e => setIssueDate(e.target.value)}
                disabled={!!progress}
              />
            </div>
            <div className="fee-field fee-field--grow">
              <span className="fee-label">Due Date</span>
              <input
                className="fee-input"
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                disabled={!!progress}
              />
            </div>
          </div>

          <div className="fee-info" style={{ marginTop: 16, marginBottom: 0 }}>
            <i className="fa-solid fa-circle-info"></i>
            <span>
              {familyMode
                ? <>Combined family challan pulls each child's <strong>fee + transport − discount</strong> from the family roster automatically.</>
                : <>Fee heads are loaded from the class fee structure. Leaving heads unselected will include <strong>all standard heads</strong>.</>}
            </span>
          </div>

          {progress && (
            <div className="fee-gen-progress">
              <div className="fee-prog-label">
                <span>{progress.label}</span>
                <span>{progress.done} / {progress.total}</span>
              </div>
              <div className="fee-prog-track">
                <div
                  className={`fee-prog-fill${progress.label === 'Completed' ? ' done' : ''}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {!progress && (
          <div className="fee-modal-foot">
            <Tooltip text="Close without generating">
              <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
            </Tooltip>
            <Tooltip text={singleMode
              ? `Generate challan for ${students[0]?.name}`
              : `Generate challans for ${students.length} student${students.length === 1 ? '' : 's'}`}
            >
              <button className="fee-btn fee-btn-primary" onClick={runBatch}>
                <i className="fa-solid fa-bolt"></i> {singleMode ? 'Generate Challan' : 'Generate Challans'}
              </button>
            </Tooltip>
          </div>
        )}

        {progress && progress.label === 'Completed' && (
          <div className="fee-modal-foot">
            <Tooltip text="Close">
              <button className="fee-btn fee-btn-primary" onClick={onClose}>
                <i className="fa-solid fa-check"></i> Done
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CHALLAN PREVIEW MODAL — fee-modal.lg with the 3-copy challan
   rendered inline (scoped CSS). Footer: Close + Download (jumps to
   the Download picker, preserving the challan context).
   ═══════════════════════════════════════════════════════════════════ */
function ChallanPreviewModal({ cfg, onClose, onDownload }) {
  useEffect(() => {
    if (!cfg) return undefined;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [cfg, onClose]);

  if (!cfg) return null;

  return createPortal(
    <div className="fee-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fee-modal lg">
        <div className="fee-modal-head">
          <div className="fee-modal-head-title">
            <div className="fee-modal-head-icon"><i className="fa-solid fa-eye"></i></div>
            <div>
              <div className="fee-modal-title">{cfg.title}</div>
              <div className="fee-modal-sub">{cfg.sub}</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="fee-modal-close" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </Tooltip>
        </div>

        <div className="fee-modal-body fee-preview-body">
          <style>{FEE_CHALLAN_CSS_SCOPED}</style>
          <div dangerouslySetInnerHTML={{ __html: cfg.innerHtml }} />
        </div>

        <div className="fee-modal-foot">
          <Tooltip text="Close preview">
            <button className="fee-btn fee-btn-ghost" onClick={onClose}>Close</button>
          </Tooltip>
          <Tooltip text="Pick theme &amp; format and download">
            <button className="fee-btn fee-btn-primary" onClick={onDownload}>
              <i className="fa-solid fa-download"></i> Download
            </button>
          </Tooltip>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DOWNLOAD PICKER MODAL — choose Color/B&W theme + PDF/Word format,
   then trigger the actual print/download via the parent's onSubmit.
   ═══════════════════════════════════════════════════════════════════ */
function DownloadPickerModal({ cfg, onClose, onSubmit }) {
  const [theme, setTheme] = useState('color');
  const [fmt, setFmt]     = useState('pdf');
  const [size, setSize]   = useState('a4');

  useEffect(() => {
    if (!cfg) return;
    setTheme('color'); setFmt('pdf');
    setSize(cfg.defaultSize || 'a4');
  }, [cfg]);

  useEffect(() => {
    if (!cfg) return undefined;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [cfg, onClose]);

  if (!cfg) return null;

  /* Keyboard nav for the radio-style picker cards (matches Modules 2–6). */
  const onThemeKey = (e, value) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')   { e.preventDefault(); setTheme('color'); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setTheme('bw'); }
    /* Space/Enter handled natively because the cards are real <button>s. */
  };

  return createPortal(
    <div
      className="fee-overlay open"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fee-dl-title"
    >
      <div className="fee-modal sm">
        <div className="fee-modal-head">
          <div className="fee-modal-head-title">
            <div className="fee-modal-head-icon"><i className="fa-solid fa-download"></i></div>
            <div>
              <div className="fee-modal-title" id="fee-dl-title">Download Challan</div>
              <div className="fee-modal-sub">{cfg.sub || 'Choose a report theme & format'}</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="fee-modal-close" onClick={onClose} aria-label="Close download dialog">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </Tooltip>
        </div>

        <div className="fee-modal-body">
          <div className="fee-dl-label" id="fee-dl-theme-lbl">Report Theme</div>
          <div className="fee-dl-grid" role="radiogroup" aria-labelledby="fee-dl-theme-lbl">
            <button
              type="button"
              className={`fee-dl-card${theme === 'color' ? ' sel' : ''}`}
              onClick={() => setTheme('color')}
              role="radio"
              aria-checked={theme === 'color'}
              tabIndex={theme === 'color' ? 0 : -1}
              onKeyDown={(e) => onThemeKey(e, 'color')}
            >
              <div className="fee-dl-prev fee-dl-prev--color" aria-hidden="true">
                <span className="fee-dl-orb"></span>
                <span className="fee-dl-line lg"></span>
                <span className="fee-dl-line md"></span>
                <div className="fee-dl-pills">
                  <span className="fee-dl-pill blue"></span>
                  <span className="fee-dl-pill amber"></span>
                </div>
              </div>
              <div className="fee-dl-meta">
                <div className="fee-dl-name"><i className="fa-solid fa-palette" style={{ color: '#1E3A8A', marginRight: 6 }} aria-hidden="true"></i>Colorful Report</div>
                <div className="fee-dl-desc">Brand-colour challan with summary highlights</div>
              </div>
            </button>
            <button
              type="button"
              className={`fee-dl-card${theme === 'bw' ? ' sel' : ''}`}
              onClick={() => setTheme('bw')}
              role="radio"
              aria-checked={theme === 'bw'}
              tabIndex={theme === 'bw' ? 0 : -1}
              onKeyDown={(e) => onThemeKey(e, 'bw')}
            >
              <div className="fee-dl-prev fee-dl-prev--bw" aria-hidden="true">
                <span className="fee-dl-orb bw"></span>
                <span className="fee-dl-line lg bw"></span>
                <span className="fee-dl-line md bw"></span>
                <div className="fee-dl-pills">
                  <span className="fee-dl-pill bw"></span>
                  <span className="fee-dl-pill bw"></span>
                </div>
              </div>
              <div className="fee-dl-meta">
                <div className="fee-dl-name"><i className="fa-solid fa-circle-half-stroke" style={{ color: '#374151', marginRight: 6 }} aria-hidden="true"></i>Colorless Report</div>
                <div className="fee-dl-desc">Low-ink layout — white bg, light borders only</div>
              </div>
            </button>
          </div>

          <div className="fee-dl-label" style={{ marginTop: 18 }}>Paper Size</div>
          <div className="fee-dl-fmt-grid">
            <button
              type="button"
              className={`fee-dl-fmt${size === 'a4' ? ' sel' : ''}`}
              onClick={() => setSize('a4')}
            >
              <div className="fee-dl-fmt-ic" style={{ background: 'rgba(30,58,138,.1)', color: '#1E3A8A' }}>
                <i className="fa-solid fa-file-lines"></i>
              </div>
              <div>
                <div className="fee-dl-fmt-name">A4 Size</div>
                <div className="fee-dl-desc">Full page · 3-copy challan</div>
              </div>
            </button>
            <button
              type="button"
              className={`fee-dl-fmt${size === 'thermal' ? ' sel' : ''}`}
              onClick={() => setSize('thermal')}
            >
              <div className="fee-dl-fmt-ic" style={{ background: 'rgba(22,163,74,.1)', color: '#16A34A' }}>
                <i className="fa-solid fa-receipt"></i>
              </div>
              <div>
                <div className="fee-dl-fmt-name">Thermal</div>
                <div className="fee-dl-desc">80mm receipt printer</div>
              </div>
            </button>
          </div>

          <div className="fee-dl-label" style={{ marginTop: 18 }}>Report Format</div>
          <div className="fee-dl-fmt-grid">
            <button
              type="button"
              className={`fee-dl-fmt${fmt === 'pdf' ? ' sel' : ''}`}
              onClick={() => setFmt('pdf')}
            >
              <div className="fee-dl-fmt-ic" style={{ background: 'rgba(220,38,38,.1)', color: '#DC2626' }}>
                <i className="fa-solid fa-file-pdf"></i>
              </div>
              <div className="fee-dl-fmt-name">PDF</div>
            </button>
            <button
              type="button"
              className={`fee-dl-fmt${fmt === 'word' ? ' sel' : ''}`}
              onClick={() => setFmt('word')}
            >
              <div className="fee-dl-fmt-ic" style={{ background: 'rgba(2,132,199,.1)', color: '#0284C7' }}>
                <i className="fa-solid fa-file-word"></i>
              </div>
              <div className="fee-dl-fmt-name">Word</div>
            </button>
          </div>
        </div>

        <div className="fee-modal-foot">
          <Tooltip text="Discard and close">
            <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
          </Tooltip>
          <Tooltip text={`Generate ${size === 'thermal' ? 'Thermal 80mm' : 'A4'} · ${theme === 'bw' ? 'Colorless' : 'Colorful'} ${fmt === 'word' ? 'Word' : 'PDF'} report`}>
            <button className="fee-btn fee-btn-primary" onClick={() => onSubmit({ theme, fmt, size })}>
              <i className="fa-solid fa-file-arrow-down"></i> Generate Report
            </button>
          </Tooltip>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DISCOUNT MANAGER MODAL — per-student per-head discount editor.
   Each row: Fee Head | Standard Fee | Discount input | Net Payable.
   Discount is clamped to standard fee; totals recompute live.
   ═══════════════════════════════════════════════════════════════════ */
function DiscountManagerModal({ cfg, onClose, onSave, toast }) {
  const [discs, setDiscs] = useState({});

  useEffect(() => {
    if (!cfg) return;
    /* Initialise from existing saved discount (if any) */
    const init = {};
    cfg.heads.forEach(h => {
      init[h.name] = Number((cfg.initial || {})[h.name]) || 0;
    });
    setDiscs(init);
  }, [cfg]);

  useEffect(() => {
    if (!cfg) return undefined;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [cfg, onClose]);

  if (!cfg) return null;

  const setOne = (name, val, max) => {
    const v = Math.max(0, Math.min(Number(val) || 0, max));
    setDiscs(prev => ({ ...prev, [name]: v }));
  };

  let totalStd = 0, totalDisc = 0;
  const rows = cfg.heads.map(h => {
    const std  = +h.amt || 0;
    const disc = Math.min(+discs[h.name] || 0, std);
    totalStd  += std;
    totalDisc += disc;
    return { ...h, std, disc, net: std - disc };
  });
  const totalNet = totalStd - totalDisc;

  const handleSave = () => {
    const perHead = {};
    rows.forEach(r => { if (r.disc > 0) perHead[r.name] = r.disc; });
    onSave(cfg.classMeta.key, cfg.student.reg, perHead);
  };

  const handleClear = () => {
    const next = {};
    cfg.heads.forEach(h => { next[h.name] = 0; });
    setDiscs(next);
    toast('Discount cleared — click Save to persist', 'info');
  };

  return createPortal(
    <div className="fee-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fee-modal">
        <div className="fee-modal-head">
          <div className="fee-modal-head-title">
            <div className="fee-modal-head-icon" style={{ background: 'linear-gradient(135deg,#0F766E,#0D9488)' }}>
              <i className="fa-solid fa-percent"></i>
            </div>
            <div>
              <div className="fee-modal-title">Discount Manager</div>
              <div className="fee-modal-sub">
                {cfg.student.name} S/O {cfg.student.father || '—'} — {cfg.classMeta.cls} ({cfg.classMeta.sec})
              </div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="fee-modal-close" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </Tooltip>
        </div>

        <div className="fee-modal-body">
          <div className="fee-info">
            <i className="fa-solid fa-circle-info"></i>
            <span>
              Enter a discount per fee head. Net Payable recalculates automatically.
              This is a <strong>student-specific</strong> adjustment.
            </span>
          </div>

          <div className="fee-stbl-wrap" style={{ border: 'none', marginTop: 14 }}>
            <table className="fee-dm-table">
              <thead>
                <tr>
                  <th>Fee Head</th>
                  <th className="fee-right">Standard Fee</th>
                  <th className="fee-right">Discount</th>
                  <th className="fee-right">Net Payable</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.name}>
                    <td><b>{r.name}</b></td>
                    <td className="fee-right">{money(r.std)}</td>
                    <td className="fee-right">
                      <input
                        type="number"
                        min="0"
                        max={r.std}
                        value={discs[r.name] || 0}
                        onChange={e => setOne(r.name, e.target.value, r.std)}
                      />
                    </td>
                    <td className="fee-right fee-dm-net">{money(r.net)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="fee-dm-total-row">
                  <td>Total</td>
                  <td className="fee-right">{money(totalStd)}</td>
                  <td className="fee-right">{money(totalDisc)}</td>
                  <td className="fee-right fee-dm-net">{money(totalNet)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="fee-modal-foot">
          <Tooltip text="Reset all discount inputs to zero">
            <button className="fee-btn fee-btn-ghost" onClick={handleClear}>
              <i className="fa-solid fa-rotate-left"></i> Clear
            </button>
          </Tooltip>
          <Tooltip text="Discard changes and close">
            <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
          </Tooltip>
          <Tooltip text="Save discount for this student">
            <button className="fee-btn fee-btn-primary" onClick={handleSave}>
              <i className="fa-solid fa-floppy-disk"></i> Save Discount
            </button>
          </Tooltip>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FEE RECEIVING MODAL — record a payment against a generated challan.
   Meta inputs (Custom Ref / Date / Method / Txn#), info strip (Fine,
   Due Date, Fine After Due, Discount), per-head editable Received
   column with live total recompute, pay strip (Total / Already Paid
   / Receiving Now / Remaining After), payment history (if any), and
   a Receive CTA. viewOnly mode hides inputs and the receive button.
   ═══════════════════════════════════════════════════════════════════ */
function FeeReceivingModal({ cfg, onClose, onSave, toast }) {
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const [date, setDate]         = useState(todayISO());
  const [method, setMethod]     = useState('Cash');
  const [ref, setRef]           = useState('');
  const [txn, setTxn]           = useState('');
  const [perHeadInput, setPerHeadInput] = useState({});

  useEffect(() => {
    if (!cfg) return;
    setDate(todayISO()); setMethod('Cash'); setRef(''); setTxn('');
    /* Default: each head's remaining amount auto-filled per row. */
    const seed = {};
    (cfg.model.heads || []).forEach(h => {
      const paidPerHead = (cfg.payments || []).reduce((a, p) => a + (+(p.perHead?.[h.name]) || 0), 0);
      const remHead     = Math.max(0, h.net - paidPerHead);
      seed[h.name] = remHead;
    });
    setPerHeadInput(seed);
  }, [cfg]);

  useEffect(() => {
    if (!cfg) return undefined;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [cfg, onClose]);

  if (!cfg) return null;

  const { classMeta, student, model, payments, period, monthIdx, viewOnly, settings } = cfg;

  const perHeadPaid = {};
  (payments || []).forEach(p => {
    Object.entries(p.perHead || {}).forEach(([n, v]) => {
      perHeadPaid[n] = (perHeadPaid[n] || 0) + (+v || 0);
    });
  });

  /* Build display rows with live recompute */
  let totalChallan = 0, totalDisc = 0, totalAfter = 0;
  const rows = model.heads.map(h => {
    const paid    = +perHeadPaid[h.name] || 0;
    const recvNow = viewOnly ? 0 : Math.max(0, Math.min(+perHeadInput[h.name] || 0, h.net - paid));
    const after   = h.net;
    const pending = Math.max(0, after - paid - recvNow);
    totalChallan += h.std;
    totalDisc    += h.disc;
    totalAfter   += after;
    return { ...h, paid, recvNow, after, pending };
  });

  const receivingNow = rows.reduce((a, r) => a + r.recvNow, 0);
  const alreadyPaid  = rows.reduce((a, r) => a + r.paid, 0);
  const totalAmt     = totalAfter + model.prev - model.advance;
  const remainAfter  = Math.max(0, totalAmt - alreadyPaid - receivingNow);

  const setHead = (name, v) => {
    setPerHeadInput(prev => ({ ...prev, [name]: Math.max(0, Number(v) || 0) }));
  };

  const fineTxt = settings?.fineEnabled
    ? `Rs. ${(+settings.fineAmt || 0).toLocaleString('en-PK')} ${settings.fineType === 'daily' ? '/ day' : '(fixed)'}`
    : '—';

  const handleReceive = () => {
    if (receivingNow <= 0) { toast('Enter at least one head amount to receive', 'error'); return; }
    if (!date) { toast('Receiving date is required', 'error'); return; }
    /* Build perHead snapshot of receivingNow values */
    const perHead = {};
    rows.forEach(r => { if (r.recvNow > 0) perHead[r.name] = r.recvNow; });
    const payload = {
      reg: student.reg, monthIdx,
      studentName: student.name,
      date, method, ref, txn,
      amount: receivingNow,
      perHead,
    };
    if (cfg.kind === 'child') payload.famKey   = cfg.famKey;
    else                      payload.classKey = classMeta.key;
    onSave(payload);
  };

  return createPortal(
    <div className="fee-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fee-modal lg">
        <div className="fee-modal-head">
          <div className="fee-modal-head-title">
            <div className="fee-modal-head-icon"><i className="fa-solid fa-hand-holding-dollar"></i></div>
            <div>
              <div className="fee-modal-title">
                {viewOnly ? 'Transaction Details — ' : 'Receiving Fee of '}
                <em>{student.name}</em>
              </div>
              <div className="fee-modal-sub">
                {classMeta.cls} ({classMeta.sec}) · {period}
              </div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="fee-modal-close" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </Tooltip>
        </div>

        <div className="fee-modal-body">
          {!viewOnly && (
            <div className="fee-recv-meta">
              <div className="fee-field">
                <span className="fee-label">Custom Reference #</span>
                <input className="fee-input" value={ref} onChange={e => setRef(e.target.value)} placeholder="Optional" />
              </div>
              <div className="fee-field">
                <span className="fee-label">Receiving Date</span>
                <input className="fee-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="fee-field">
                <span className="fee-label">Payment Method</span>
                <div className="fee-select-wrap">
                  <select className="fee-select" value={method} onChange={e => setMethod(e.target.value)}>
                    <option>Cash</option>
                    <option>Bank Transfer</option>
                    <option>Cheque</option>
                    <option>Card</option>
                    <option>Online / App</option>
                  </select>
                  <i className="fa-solid fa-chevron-down"></i>
                </div>
              </div>
              <div className="fee-field">
                <span className="fee-label">Transaction #</span>
                <input className="fee-input" value={txn} onChange={e => setTxn(e.target.value)} placeholder="Optional" />
              </div>
            </div>
          )}

          <div className="fee-recv-info">
            <div className="fee-recv-info-item">
              <span className="fee-recv-info-lbl">Fine Type</span>
              <span className="fee-recv-info-val">{settings?.fineEnabled ? (settings.fineType === 'daily' ? 'Per day' : 'Fixed') : '—'}</span>
            </div>
            <div className="fee-recv-info-item">
              <span className="fee-recv-info-lbl">Due Date</span>
              <span className="fee-recv-info-val">{new Date().toLocaleDateString('en-GB')}</span>
            </div>
            <div className="fee-recv-info-item">
              <span className="fee-recv-info-lbl">Fine After Due Date</span>
              <span className="fee-recv-info-val">{fineTxt}</span>
            </div>
            <div className="fee-recv-info-item">
              <span className="fee-recv-info-lbl">Discount if any</span>
              <span className="fee-recv-info-val">{money(model.disc)}</span>
            </div>
          </div>

          <div className="fee-stbl-wrap" style={{ marginTop: 14 }}>
            <table className="fee-stbl fee-recv-table">
              <thead>
                <tr>
                  <th>Head</th>
                  <th className="fee-right">Challan Amount</th>
                  <th className="fee-right">Discount</th>
                  <th className="fee-right">After Discount</th>
                  <th className="fee-right">Received</th>
                  <th className="fee-right">Pending</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.name}>
                    <td><b>{r.name}</b></td>
                    <td className="fee-right">{money(r.std)}</td>
                    <td className="fee-right">{r.disc > 0 ? money(r.disc) : '0'}</td>
                    <td className="fee-right"><span className="fee-cell-grey">{money(r.net)}</span></td>
                    <td className="fee-right">
                      {viewOnly ? (
                        <span className="fee-paid-amt">{money(r.paid)}</span>
                      ) : (
                        <input
                          type="number"
                          min="0"
                          max={Math.max(0, r.net - r.paid)}
                          value={perHeadInput[r.name] === 0 ? 0 : (perHeadInput[r.name] || '')}
                          onChange={e => setHead(r.name, e.target.value)}
                          placeholder="0"
                        />
                      )}
                    </td>
                    <td className="fee-right">{money(r.pending)}</td>
                  </tr>
                ))}
                {model.prev > 0 && (
                  <tr>
                    <td><b>Previous Dues</b></td>
                    <td className="fee-right">{money(model.prev)}</td>
                    <td className="fee-right">0</td>
                    <td className="fee-right"><span className="fee-cell-grey">{money(model.prev)}</span></td>
                    <td className="fee-right">—</td>
                    <td className="fee-right">{money(model.prev)}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="fee-recv-total">
                  <td>Total</td>
                  <td className="fee-right">{money(totalChallan + model.prev)}</td>
                  <td className="fee-right">{money(totalDisc)}</td>
                  <td className="fee-right">{money(totalAfter + model.prev)}</td>
                  <td className="fee-right">{money(alreadyPaid + receivingNow)}</td>
                  <td className="fee-right">{money(remainAfter)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="fee-recv-paystrip">
            <div className="fee-recv-paycard">
              <span className="fee-recv-paylbl">Total Amount</span>
              <span className="fee-recv-payval">{money(totalAmt)}</span>
            </div>
            <div className="fee-recv-paycard">
              <span className="fee-recv-paylbl">Already Received</span>
              <span className="fee-recv-payval green">{money(alreadyPaid)}</span>
            </div>
            <div className="fee-recv-paycard">
              <span className="fee-recv-paylbl">Receiving Now</span>
              <span className="fee-recv-payval blue">{money(receivingNow)}</span>
            </div>
            <div className="fee-recv-paycard">
              <span className="fee-recv-paylbl">Remaining After</span>
              <span className="fee-recv-payval red">{money(remainAfter)}</span>
            </div>
          </div>

          {payments && payments.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div className="fee-recv-hist-title">
                <i className="fa-solid fa-clock-rotate-left"></i> Payment History
              </div>
              <div className="fee-stbl-wrap" style={{ marginTop: 8 }}>
                <table className="fee-stbl fee-recv-hist">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Date &amp; Time</th>
                      <th>Method</th>
                      <th>Reference</th>
                      <th className="fee-right">Amount</th>
                      <th className="fee-center">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p, i) => (
                      <tr key={p.id || i}>
                        <td className="fee-num">{i + 1}</td>
                        <td>
                          {p.date}
                          {p.time && <span className="fee-sub-eq">{fmtTime12(p.time)}</span>}
                        </td>
                        <td>{p.method}</td>
                        <td>{p.ref || p.txn || '—'}</td>
                        <td className="fee-right"><b>{money(p.amount)}</b></td>
                        <td className="fee-center">
                          <span className={`fee-chip ${p.source === 'onelink' || p.source === 'bank' ? 'fee-chip-active' : ''}`}>
                            {p.source === 'onelink' || p.source === 'bank' ? 'OneLink' : 'Counter'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="fee-modal-foot">
          <Tooltip text="Discard and close">
            <button className="fee-btn fee-btn-ghost" onClick={onClose}>{viewOnly ? 'Close' : 'Cancel'}</button>
          </Tooltip>
          {!viewOnly && (
            <Tooltip text={`Record Rs. ${receivingNow.toLocaleString('en-PK')} as received`}>
              <button className="fee-btn fee-btn-primary" onClick={handleReceive}>
                <i className="fa-solid fa-check"></i> Receive
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FEE REMINDER MODAL — push notification composer. 160-char limit
   with live counter, target description, send CTA.
   ═══════════════════════════════════════════════════════════════════ */
function FeeReminderModal({ cfg, onClose, toast }) {
  const DEFAULT_MSG = "Dear Parent, your child's fee for this month is pending. Please pay at your earliest convenience. — School Administration";
  const [msg, setMsg] = useState(DEFAULT_MSG);

  useEffect(() => {
    if (!cfg) return;
    setMsg(DEFAULT_MSG);
  }, [cfg]);

  useEffect(() => {
    if (!cfg) return undefined;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [cfg, onClose]);

  if (!cfg) return null;

  const target = cfg.type === 'class'
    ? `${cfg.classMeta.cls} (${cfg.classMeta.sec}) — ${cfg.sm?.unpaid ?? 0} unpaid parent${(cfg.sm?.unpaid ?? 0) === 1 ? '' : 's'}`
    : `${cfg.student?.name} (${cfg.classMeta?.cls} / ${cfg.classMeta?.sec})`;

  const handleSend = async () => {
    if (!msg.trim()) { toast('Reminder message cannot be empty', 'error'); return; }
    await feeService.sendFeeReminder({ target, message: msg, period: cfg.period }).catch(() => {});
    toast('Fee reminder sent', 'success');
    onClose();
  };

  return createPortal(
    <div className="fee-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fee-modal sm">
        <div className="fee-modal-head">
          <div className="fee-modal-head-title">
            <div className="fee-modal-head-icon" style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)' }}>
              <i className="fa-solid fa-bell"></i>
            </div>
            <div>
              <div className="fee-modal-title">Send Fee Reminder</div>
              <div className="fee-modal-sub">Parent mobile app push notification</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="fee-modal-close" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </Tooltip>
        </div>

        <div className="fee-modal-body">
          <div className="fee-info">
            <i className="fa-solid fa-circle-info"></i>
            <span>
              This reminder will be sent to fee defaulters who have not paid their fee yet
              through parent mobile app push notification.
            </span>
          </div>

          <div className="fee-field" style={{ marginTop: 12 }}>
            <span className="fee-label">Notification Message</span>
            <textarea
              className="fee-input fee-textarea"
              maxLength={160}
              rows={4}
              value={msg}
              onChange={e => setMsg(e.target.value)}
            />
            <div className="fee-rem-counter">
              <span>{msg.length}</span> / <span>160</span> characters
            </div>
          </div>

          <div className="fee-rem-target">
            <i className="fa-solid fa-bullseye"></i> <strong>Target:</strong> {target}
          </div>
        </div>

        <div className="fee-modal-foot">
          <Tooltip text="Discard and close">
            <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
          </Tooltip>
          <Tooltip text="Send reminder to parents">
            <button className="fee-btn fee-btn-primary" onClick={handleSend}>
              <i className="fa-solid fa-paper-plane"></i> Send Reminder
            </button>
          </Tooltip>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FEE SLIP MODAL — receipt preview for a single payment, with A4 vs
   Small (thermal/80mm) size picker and a Download / print CTA.
   ═══════════════════════════════════════════════════════════════════ */
function FeeSlipModal({ cfg, onClose, toast }) {
  const [size, setSize] = useState('a4');

  useEffect(() => { if (cfg) setSize(cfg.defaultSize || 'a4'); }, [cfg]);
  useEffect(() => {
    if (!cfg) return undefined;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [cfg, onClose]);

  if (!cfg) return null;

  const { classMeta, student, period, payment } = cfg;
  const headRows = Object.entries(payment.perHead || {}).map(([name, amt]) => ({ name, amt: +amt || 0 }));
  const total    = headRows.reduce((a, r) => a + r.amt, 0);

  const doPrint = () => {
    const w = window.open('', '_blank');
    if (!w) { toast('Please allow pop-ups to download the slip', 'error'); return; }
    const slipHtml = `
      <div class="fee-slip-doc fee-slip-${size}">
        <div class="fee-slip-head">
          <div class="fee-slip-school">${escHtml(FEE_SCHOOL.name)}</div>
          <div class="fee-slip-tag">Fee Received Slip</div>
        </div>
        <div class="fee-slip-kv">
          <span class="k">Receipt No</span><span class="v">${escHtml(payment.id || `RCV-${Date.now()}`)}</span>
          <span class="k">Date</span><span class="v">${escHtml(payment.date)}${payment.time ? `  ·  ${escHtml(fmtTime12(payment.time))}` : ''}</span>
          <span class="k">Period</span><span class="v">${escHtml(period)}</span>
          <span class="k">Student</span><span class="v">${escHtml(student.name)}</span>
          <span class="k">Father</span><span class="v">${escHtml(student.father || '—')}</span>
          <span class="k">Class</span><span class="v">${escHtml(classMeta.cls)} (${escHtml(classMeta.sec)})</span>
          <span class="k">Reg No</span><span class="v">${escHtml(student.reg)}</span>
          <span class="k">Method</span><span class="v">${escHtml(payment.method)}</span>
          ${payment.ref ? `<span class="k">Reference</span><span class="v">${escHtml(payment.ref)}</span>` : ''}
          ${payment.txn ? `<span class="k">Transaction</span><span class="v">${escHtml(payment.txn)}</span>` : ''}
        </div>
        <table class="fee-slip-tbl fee-slip-heads">
          <thead><tr><th>Head</th><th>Amount</th></tr></thead>
          <tbody>
            ${headRows.map(r => `<tr><td>${escHtml(r.name)}</td><td>${r.amt.toLocaleString('en-PK')}</td></tr>`).join('')}
            <tr class="fee-slip-headtot"><td>Total</td><td>${total.toLocaleString('en-PK')}</td></tr>
          </tbody>
        </table>
        <div class="fee-slip-net">
          <span>Amount Received</span><span>Rs. ${(+payment.amount || 0).toLocaleString('en-PK')}</span>
        </div>
      </div>`;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fee Slip — ${escHtml(student.name)}</title>
<style>
  body { margin:0; font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif; background:#F1F3F8; padding:18px; }
  .fee-slip-doc { background:#fff; color:#111; border:1px solid #ddd; border-radius:12px; padding:20px; max-width:420px; margin:0 auto; }
  .fee-slip-doc.fee-slip-small { max-width:300px; padding:14px; font-size:11px; }
  .fee-slip-head { text-align:center; border-bottom:1.5px solid #111; padding-bottom:10px; margin-bottom:12px; }
  .fee-slip-school { font-size:16px; font-weight:800; }
  .fee-slip-tag { font-size:11px; color:#555; letter-spacing:1px; text-transform:uppercase; margin-top:3px; }
  .fee-slip-kv { display:grid; grid-template-columns:auto 1fr; gap:4px 10px; font-size:12px; margin-bottom:12px; }
  .fee-slip-kv .k { color:#666; }
  .fee-slip-kv .v { text-align:right; font-weight:700; }
  .fee-slip-tbl { width:100%; border-collapse:collapse; font-size:11.5px; margin-bottom:10px; }
  .fee-slip-tbl th, .fee-slip-tbl td { border-bottom:1px solid #eee; padding:5px 4px; text-align:right; }
  .fee-slip-tbl th:first-child, .fee-slip-tbl td:first-child { text-align:left; }
  .fee-slip-tbl th { border-bottom:1.5px solid #333; color:#333; }
  .fee-slip-headtot td { border-top:1.5px solid #333; border-bottom:none; font-weight:800; background:#f5f7fb; }
  .fee-slip-net { display:flex; justify-content:space-between; align-items:center; background:#111; color:#fff; padding:8px 12px; border-radius:4px; font-weight:800; }
  @page { size:A4; margin:14mm; }
  @media print { body { background:#fff; padding:0; } }
</style></head><body>${slipHtml}</body></html>`);
    w.document.close();
    w.onload = () => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } };
    toast('Slip ready — use your browser\'s Save as PDF.', 'success');
  };

  return createPortal(
    <div className="fee-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fee-modal">
        <div className="fee-modal-head">
          <div className="fee-modal-head-title">
            <div className="fee-modal-head-icon" style={{ background: 'linear-gradient(135deg,#16A34A,#15803D)' }}>
              <i className="fa-solid fa-receipt"></i>
            </div>
            <div>
              <div className="fee-modal-title">Fee Received Slip</div>
              <div className="fee-modal-sub">{student.name} · {classMeta.cls} ({classMeta.sec}) · {period}</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="fee-modal-close" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </Tooltip>
        </div>

        <div className="fee-modal-body">
          <div className="fee-dl-label">Slip Size</div>
          <div className="fee-dl-fmt-grid">
            <button type="button" className={`fee-dl-fmt${size === 'a4' ? ' sel' : ''}`} onClick={() => setSize('a4')}>
              <div className="fee-dl-fmt-ic" style={{ background: 'rgba(30,58,138,.1)', color: '#1E3A8A' }}>
                <i className="fa-solid fa-file-lines"></i>
              </div>
              <div>
                <div className="fee-dl-fmt-name">A4 Size</div>
                <div className="fee-dl-desc">Full-page receipt</div>
              </div>
            </button>
            <button type="button" className={`fee-dl-fmt${size === 'small' ? ' sel' : ''}`} onClick={() => setSize('small')}>
              <div className="fee-dl-fmt-ic" style={{ background: 'rgba(22,163,74,.1)', color: '#16A34A' }}>
                <i className="fa-solid fa-receipt"></i>
              </div>
              <div>
                <div className="fee-dl-fmt-name">Small Receipt</div>
                <div className="fee-dl-desc">Thermal / 80mm</div>
              </div>
            </button>
          </div>

          <div className="fee-dl-label" style={{ marginTop: 16 }}>Preview</div>
          <div className={`fee-slip-doc fee-slip-${size}`}>
            <div className="fee-slip-head">
              <div className="fee-slip-school">{FEE_SCHOOL.name}</div>
              <div className="fee-slip-tag">Fee Received Slip</div>
            </div>
            <div className="fee-slip-kv">
              <span className="k">Receipt No</span><span className="v">{payment.id || `RCV-${Date.now()}`}</span>
              <span className="k">Date</span><span className="v">{payment.date}{payment.time ? `  ·  ${fmtTime12(payment.time)}` : ''}</span>
              <span className="k">Period</span><span className="v">{period}</span>
              <span className="k">Student</span><span className="v">{student.name}</span>
              <span className="k">Father</span><span className="v">{student.father || '—'}</span>
              <span className="k">Class</span><span className="v">{classMeta.cls} ({classMeta.sec})</span>
              <span className="k">Reg No</span><span className="v">{student.reg}</span>
              <span className="k">Method</span><span className="v">{payment.method}</span>
              {payment.ref && <><span className="k">Reference</span><span className="v">{payment.ref}</span></>}
              {payment.txn && <><span className="k">Transaction</span><span className="v">{payment.txn}</span></>}
            </div>
            <table className="fee-slip-tbl fee-slip-heads">
              <thead>
                <tr><th>Head</th><th>Amount</th></tr>
              </thead>
              <tbody>
                {headRows.map(r => (
                  <tr key={r.name}><td>{r.name}</td><td>{r.amt.toLocaleString('en-PK')}</td></tr>
                ))}
                <tr className="fee-slip-headtot"><td>Total</td><td>{total.toLocaleString('en-PK')}</td></tr>
              </tbody>
            </table>
            <div className="fee-slip-net">
              <span>Amount Received</span>
              <span>Rs. {(+payment.amount || 0).toLocaleString('en-PK')}</span>
            </div>
          </div>
        </div>

        <div className="fee-modal-foot">
          <Tooltip text="Close preview">
            <button className="fee-btn fee-btn-ghost" onClick={onClose}>Close</button>
          </Tooltip>
          <Tooltip text="Download / print this slip">
            <button className="fee-btn fee-btn-primary" onClick={doPrint}>
              <i className="fa-solid fa-download"></i> Download Slip
            </button>
          </Tooltip>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FEE RECEIVING TAB — month/year filter, smart search, per-class
   expandable receiver table. Two sub-segments (Individual / Family).
   For Individual: each class row expands to a student-level table
   with previous dues / this-month dues / discount / received /
   remaining / status / action. Actions: "Fee Receive" link (opens
   the FeeReceivingModal), Receive More (partial), View transaction,
   Download Slip (opens FeeSlipModal), Delete manual receipt (confirm).
   ═══════════════════════════════════════════════════════════════════ */

/* ── Models / helpers ── */
function recStudentModel({ student, headsForClass, generated, classDisc, payments }) {
  const heads = (headsForClass || []).map(h => {
    const std = +h.amt || 0;
    const d   = +(classDisc?.[h.name]) || 0;
    return { name: h.name, std, disc: Math.min(d, std), net: std - Math.min(d, std) };
  });
  if (generated && +student.transport > 0) {
    heads.push({ name: 'Transport Fee', std: +student.transport, disc: 0, net: +student.transport });
  }
  const prev      = +student.dues || 0;
  const advance   = +student.advance || 0;
  const thisMonth = generated ? heads.reduce((a, h) => a + h.std, 0) : 0;
  const disc      = generated ? heads.reduce((a, h) => a + h.disc, 0) : 0;
  const payable   = Math.max(0, prev + thisMonth - disc - advance);
  const paid      = (payments || []).reduce((a, p) => a + (+p.amount || 0), 0);
  const remaining = Math.max(0, payable - paid);
  let status = 'none';
  if (generated && paid > 0) status = remaining <= 0 ? 'full' : 'partial';
  /* Only payments explicitly tagged as OneLink/bank-pull are protected
     from manual deletion. A "Bank Transfer" entered at the counter
     stays deletable — same as the HTML reference (which keys off the
     `source` field, not the method). */
  const onelink = (payments || []).some(p => p.source === 'onelink' || p.source === 'bank');
  return { heads, generated, prev, advance, thisMonth, disc, payable, paid, remaining, status, onelink };
}

function statusBadge(status) {
  if (status === 'full')    return <span className="fee-stat-badge fee-stat-full"><i className="fa-solid fa-circle-check"></i> Fully Received</span>;
  if (status === 'partial') return <span className="fee-stat-badge fee-stat-partial"><i className="fa-solid fa-circle-half-stroke"></i> Partial</span>;
  return <span className="fee-stat-badge fee-stat-none"><i className="fa-solid fa-circle-exclamation"></i> Not Received</span>;
}

function summaryChips({ total, paid, unpaid, onelink = 0 }) {
  return (
    <div className="fee-recv-sumchips">
      <span className="fee-recv-sumchip total"><i className="fa-solid fa-file-invoice"></i> <span className="n">{total}</span> Total</span>
      <span className="fee-recv-sumchip paid"><i className="fa-solid fa-circle-check"></i> <span className="n">{paid}</span> Paid</span>
      <span className="fee-recv-sumchip unpaid"><i className="fa-solid fa-circle-exclamation"></i> <span className="n">{unpaid}</span> Unpaid</span>
      {onelink > 0 && (
        <Tooltip text={`${onelink} payment${onelink === 1 ? '' : 's'} received via 1Link / bank pull`}>
          <span className="fee-recv-sumchip onelink"><i className="fa-solid fa-building-columns"></i> <span className="n">{onelink}</span> OneLink</span>
        </Tooltip>
      )}
    </div>
  );
}

function FeeReceivingTab({ toast }) {
  const [seg, setSeg] = useState('individual');
  return (
    <>
      <div className="fee-seg">
        <Tooltip text="Single-student fee receiving grouped by class">
          <button className={`fee-seg-btn${seg === 'individual' ? ' active' : ''}`} onClick={() => setSeg('individual')}>
            <i className="fa-solid fa-user"></i> Individual Fee Receiving
          </button>
        </Tooltip>
        <Tooltip text="Receive a combined family payment for all siblings">
          <button className={`fee-seg-btn${seg === 'family' ? ' active' : ''}`} onClick={() => setSeg('family')}>
            <i className="fa-solid fa-people-roof"></i> Family Tree Fee Receiving
          </button>
        </Tooltip>
      </div>

      {seg === 'individual'
        ? <FeeReceivingIndividual toast={toast} />
        : <FamilyTreeReceiving toast={toast} />}
    </>
  );
}

function FeeReceivingIndividual({ toast }) {
  const { data: classes = [] }      = useAsync(feeService.getFeeClasses, []);
  const { data: studentsMap = {} }  = useAsync(feeService.getTransportFee, []);
  const { data: headsMap = {} }     = useAsync(feeService.getFeeHeads, []);
  const { data: settings = {} }     = useAsync(feeService.getFeeSettings, []);
  const { data: generatedInitial }  = useAsync(feeService.getGeneratedChallans, []);
  const { data: serverReceipts = [] } = useAsync(feeService.getReceipts, []);

  const today = new Date();
  const [month, setMonth] = useState(FEE_MONTHS[today.getMonth()]);
  const [year, setYear]   = useState(String(today.getFullYear()));
  const [appliedMonth, setAppliedMonth] = useState(month);
  const [appliedYear, setAppliedYear]   = useState(year);

  /* Smart search */
  const [searchQ, setSearchQ]       = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchAnchorRef             = useRef(null);
  useEffect(() => {
    if (!searchOpen) return undefined;
    const onDown = (e) => {
      if (searchAnchorRef.current && !searchAnchorRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [searchOpen]);

  const [genSet, setGenSet] = useState(null);
  useEffect(() => { if (generatedInitial && genSet == null) setGenSet(new Set(generatedInitial)); }, [generatedInitial, genSet]);
  const monthIdx = FEE_MONTHS.indexOf(appliedMonth);
  const keyOf    = (classKey, reg) => `${classKey}|${reg}|${monthIdx}`;

  /* Receipts mirror (mutable so we can add new payments locally) */
  const [receipts, setReceipts] = useState(null);
  useEffect(() => { if (serverReceipts.length && receipts == null) setReceipts(serverReceipts); }, [serverReceipts, receipts]);
  const receiptsList = useMemo(() => receipts || [], [receipts]);

  /* No per-student discount map for now (Discount Manager in Challans tab
     persists locally; that state lives there). Pass empty for receiving. */
  const discountMap = {};

  const paymentsFor = useCallback((classKey, reg) => {
    const r = receiptsList.find(x => x.classKey === classKey && x.reg === reg && x.monthIdx === monthIdx);
    return r ? r.payments : [];
  }, [receiptsList, monthIdx]);

  const modelFor = useCallback((c, s) => {
    const generated = !!genSet && genSet.has(keyOf(c.key, s.reg));
    const heads     = headsMap[c.key] || [];
    const classDisc = (discountMap[c.key] && discountMap[c.key][s.reg]) || {};
    return recStudentModel({
      student: s, headsForClass: heads, generated, classDisc,
      payments: paymentsFor(c.key, s.reg),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genSet, headsMap, paymentsFor]);

  const classSummary = useCallback((c) => {
    const students = studentsMap[c.key] || [];
    let total = 0, paid = 0, unpaid = 0, onelink = 0;
    students.forEach(s => {
      const m = modelFor(c, s);
      if (m.generated) {
        total += 1;
        if (m.status === 'full' || m.status === 'partial') paid += 1;
        else unpaid += 1;
        if (m.onelink) onelink += 1;
      }
    });
    return { total, paid, unpaid, onelink };
  }, [studentsMap, modelFor]);

  /* Expanded row */
  const [openKey, setOpenKey] = useState(null);

  /* Receive modal context */
  const [receiveCtx, setReceiveCtx] = useState(null); // { classMeta, student, model, payments, viewOnly }
  const [slipCtx, setSlipCtx]       = useState(null); // { classMeta, student, payment }
  const [reminderCtx, setReminderCtx] = useState(null); // { type:'class'|'student', target }
  const [confirm, setConfirm]       = useState(null);

  const openReceive = (c, s, viewOnly = false) => {
    const m = modelFor(c, s);
    if (!m.generated) { toast(`Challan not generated for ${s.name} in ${appliedMonth}`, 'warning'); return; }
    setReceiveCtx({
      classMeta: c, student: s, model: m,
      payments: paymentsFor(c.key, s.reg),
      period:   `${appliedMonth} ${appliedYear}`,
      monthIdx,
      viewOnly,
      settings,
    });
  };

  const handleSaveReceipt = (payload) => {
    /* Append payment to receipts state */
    setReceipts(prev => {
      const next = [...(prev || [])];
      const idx  = next.findIndex(r => r.classKey === payload.classKey && r.reg === payload.reg && r.monthIdx === payload.monthIdx);
      const pay  = {
        id: `rcv-${Date.now()}`,
        date:   payload.date,
        time:   payload.time || nowHHMM(),
        method: payload.method,
        ref:    payload.ref,
        txn:    payload.txn,
        amount: payload.amount,
        perHead: payload.perHead,
        source: 'counter',
        by:     payload.by || 'Front Desk',
      };
      if (idx >= 0) {
        next[idx] = { ...next[idx], payments: [...next[idx].payments, pay] };
      } else {
        next.push({ classKey: payload.classKey, reg: payload.reg, monthIdx: payload.monthIdx, payments: [pay] });
      }
      return next;
    });
    feeService.saveReceipt(payload).catch(() => {});
    toast(`Rs. ${(payload.amount || 0).toLocaleString('en-PK')} received from ${payload.studentName}`, 'success');
    /* After save: close receive modal and open slip modal for the new payment */
    const c = receiveCtx?.classMeta, s = receiveCtx?.student;
    setReceiveCtx(null);
    if (c && s) {
      setSlipCtx({
        classMeta: c, student: s, period: receiveCtx.period,
        payment: { date: payload.date, method: payload.method, ref: payload.ref, txn: payload.txn, amount: payload.amount, perHead: payload.perHead },
        defaultSize: settings.printSize || 'a4',
      });
    }
  };

  const requestDeleteReceipt = (c, s) => {
    setConfirm({
      title:   'Delete received fee?',
      message: <span>The manually received payment(s) for <strong>{s.name}</strong> will be removed.</span>,
      hint:    'OneLink / Bank payments cannot be deleted from here.',
      onConfirm: () => {
        setReceipts(prev => (prev || []).map(r => (
          r.classKey === c.key && r.reg === s.reg && r.monthIdx === monthIdx
            ? { ...r, payments: r.payments.filter(p => p.source === 'onelink' || p.source === 'bank') }
            : r
        )));
        toast('Receipt deleted', 'success');
      },
    });
  };

  const apply = () => { setAppliedMonth(month); setAppliedYear(year); toast(`Loaded ${month} ${year} receipts`, 'info'); };
  const resetFilters = () => {
    setMonth(FEE_MONTHS[today.getMonth()]); setYear(String(today.getFullYear()));
    setAppliedMonth(FEE_MONTHS[today.getMonth()]); setAppliedYear(String(today.getFullYear()));
    setSearchQ('');
  };

  const matches = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return [];
    const out = [];
    classes.forEach(c => {
      (studentsMap[c.key] || []).forEach(s => {
        if (`${s.name} ${s.father || ''} ${s.reg} ${c.cls} ${c.sec}`.toLowerCase().includes(q)) {
          out.push({ c, s });
        }
      });
    });
    return out.slice(0, 8);
  }, [searchQ, classes, studentsMap]);

  const clearSearch = () => { setSearchQ(''); setSearchOpen(false); };

  const focusOnStudent = (c, s) => {
    setOpenKey(c.key);
    clearSearch();
    toast('Jumped to student', 'info');
    setTimeout(() => {
      const el = document.getElementById(`rec-st-${c.key}-${s.reg}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('fee-st-flash');
        setTimeout(() => el.classList.remove('fee-st-flash'), 1700);
      }
    }, 380);
  };

  return (
    <>
      {/* Filters + smart search */}
      <div className="fee-section fee-section--overflow">
        <div className="fee-section-body">
          <div className="fee-filters">
            <div className="fee-field">
              <span className="fee-label">Month</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={month} onChange={e => setMonth(e.target.value)}>
                  {FEE_MONTHS.map(m => <option key={m}>{m}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
            <div className="fee-field">
              <span className="fee-label">Year</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={year} onChange={e => setYear(e.target.value)}>
                  <option>2025</option><option>2026</option><option>2027</option>
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
            <Tooltip text="Load receipts for the selected month and year">
              <button className="fee-btn fee-btn-primary" onClick={apply}>
                <i className="fa-solid fa-filter"></i> Get Students
              </button>
            </Tooltip>
            <Tooltip text="Reset filters and search to defaults">
              <button className="fee-btn fee-btn-ghost" onClick={resetFilters}>
                <i className="fa-solid fa-rotate-left"></i> Reset Filter
              </button>
            </Tooltip>
          </div>

          <div className="fee-searchrow">
            <div className="fee-field" style={{ width: '100%' }}>
              <span className="fee-label">Search Student</span>
              <div className="fee-search-anchor" ref={searchAnchorRef}>
                <div className="fee-search-box">
                  <i className="fa-solid fa-magnifying-glass"></i>
                  <input
                    value={searchQ}
                    autoComplete="off"
                    onChange={e => { setSearchQ(e.target.value); setSearchOpen(true); }}
                    onFocus={() => setSearchOpen(true)}
                    placeholder="Search by Name, Father Name, Registration, Class or Section"
                  />
                  {searchQ && (
                    <Tooltip text="Clear search">
                      <button type="button" className="fee-search-clear" onClick={clearSearch} aria-label="Clear search">
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </Tooltip>
                  )}
                </div>
                <div className={`fee-search-results${searchOpen && searchQ ? ' open' : ''}`}>
                  {matches.length === 0 ? (
                    <div className="fee-sr-empty">No students found for "<b>{searchQ}</b>"</div>
                  ) : matches.map(({ c, s }) => {
                    const m = modelFor(c, s);
                    const initial = (s.name || '?').trim()[0] || '?';
                    return (
                      <button type="button" key={`${c.key}-${s.reg}`} className="fee-sr-item" onClick={() => focusOnStudent(c, s)}>
                        <div className="fee-sr-av">{initial.toUpperCase()}</div>
                        <div className="fee-sr-main">
                          <div className="fee-sr-name">
                            {s.name}
                            {!m.generated && <span className="fee-chip fee-chip-due"><i className="fa-solid fa-circle-exclamation"></i> Not Generated</span>}
                            {m.status === 'full' && <span className="fee-chip fee-chip-active"><i className="fa-solid fa-circle-check"></i> Paid</span>}
                          </div>
                          <div className="fee-sr-meta">
                            <span><b>Father:</b> {s.father || '—'}</span>
                            <span><b>Class:</b> {c.cls}</span>
                            <span><b>Section:</b> {c.sec}</span>
                            <span><b>Reg:</b> {s.reg}</span>
                          </div>
                        </div>
                        <div className="fee-sr-go"><i className="fa-solid fa-arrow-right"></i></div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="fee-hint">
                <i className="fa-solid fa-circle-info"></i>
                <span>Search any student, then click to jump to their class.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fee-info">
        <i className="fa-solid fa-circle-info"></i>
        <span>
          Open a class to receive fee against generated challans. Statuses:&nbsp;
          <strong>Fully Received</strong>, <strong>Partial</strong>, or <strong>Not Received</strong>.
          OneLink / Bank payments cannot be deleted manually.
        </span>
      </div>

      <div className="fee-section">
        <div className="fee-table-head fee-recind-row">
          <div className="fee-th">S. No.</div>
          <div className="fee-th">Class / Section</div>
          <div className="fee-th fee-center">Challan Summary</div>
          <div className="fee-th fee-center">Actions</div>
          <div className="fee-th fee-center">Details</div>
        </div>

        {classes.length === 0 ? (
          <div className="fee-empty">No classes available.</div>
        ) : classes.map((c, i) => {
          const isOpen = openKey === c.key;
          const sm     = classSummary(c);
          const students = studentsMap[c.key] || [];
          return (
            <div key={c.key} className="fee-rowwrap">
              <div
                className={`fee-row fee-recind-row${isOpen ? ' open' : ''}`}
                onClick={() => setOpenKey(isOpen ? null : c.key)}
              >
                <div className="fee-td" data-label="S. No."><span className="fee-row-icon">{i + 1}</span></div>
                <div className="fee-td" data-label="Class / Section">
                  <div className="fee-recv-clssec">
                    <b>{c.cls}</b><span>Section {c.sec}</span>
                  </div>
                </div>
                <div className="fee-td fee-center" data-label="Challan Summary">{summaryChips(sm)}</div>
                <div className="fee-td fee-center" data-label="Actions" onClick={e => e.stopPropagation()}>
                  <Tooltip text="Send fee reminder to parents of unpaid students">
                    <button className="fee-reminder-btn" onClick={() => setReminderCtx({ type: 'class', classMeta: c, sm, period: `${appliedMonth} ${appliedYear}` })}>
                      <i className="fa-solid fa-bell"></i> Fee Reminder
                    </button>
                  </Tooltip>
                </div>
                <div className="fee-td fee-center" data-label="Details">
                  <Tooltip text={isOpen ? 'Hide student list' : 'Show student list'}>
                    <span className={`fee-chevbtn${isOpen ? ' open' : ''}`}>
                      <i className="fa-solid fa-chevron-down fee-chev"></i>
                    </span>
                  </Tooltip>
                </div>
              </div>

              <div className={`fee-detail${isOpen ? ' open' : ''}`}>
                <div className="fee-detail-inner">
                  <div className="fee-detail-title">
                    <i className="fa-solid fa-users"></i> {appliedMonth} {appliedYear} — Receivables
                  </div>

                  <div className="fee-stbl-wrap">
                    <table className="fee-stbl">
                      <thead>
                        <tr>
                          <th>Reg No</th>
                          <th>Name</th>
                          <th className="fee-right">Previous Dues</th>
                          <th className="fee-right">This Month</th>
                          <th className="fee-center">Discount</th>
                          <th className="fee-right">Received</th>
                          <th className="fee-right">Remaining</th>
                          <th className="fee-center">Status</th>
                          <th className="fee-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.length === 0 ? (
                          <tr><td colSpan="9" className="fee-stbl-empty">No students in this section.</td></tr>
                        ) : students.map(s => {
                          const m = modelFor(c, s);
                          return (
                            <tr key={s.reg} id={`rec-st-${c.key}-${s.reg}`}>
                              <td>{s.reg}</td>
                              <td>
                                <b>{s.name}</b>
                                <span className="fee-sub-eq">SO/DO {s.father || '—'}</span>
                              </td>
                              <td className="fee-right">{money(m.prev)}</td>
                              {m.generated ? (
                                <td className="fee-right">
                                  {money(m.thisMonth)}
                                  <span className="fee-sub-eq">= {money(m.prev + m.thisMonth - m.disc)}</span>
                                </td>
                              ) : (
                                <td className="fee-right">
                                  <span className="fee-this-dues zero">0</span>
                                  <span className="fee-sub-eq">= {money(m.prev)}</span>
                                </td>
                              )}
                              <td className="fee-center">{m.disc > 0 ? <span className="fee-disc-amt">{money(m.disc)}</span> : '0'}</td>
                              <td className="fee-right">{m.paid > 0 ? <span className="fee-paid-amt">{money(m.paid)}</span> : '0'}</td>
                              <td className="fee-right">{money(m.remaining)}</td>
                              <td className="fee-center">
                                {!m.generated ? (
                                  <span className="fee-recv-notice">Challan not generated for <b>{appliedMonth}</b> yet.</span>
                                ) : (
                                  <div className="fee-recv-status">
                                    {statusBadge(m.status)}
                                    {m.onelink && <span className="fee-onelink-tag"><i className="fa-solid fa-building-columns"></i> OneLink</span>}
                                  </div>
                                )}
                              </td>
                              <td className="fee-center">
                                <div className="fee-recv-acts">
                                  {!m.generated ? null
                                    : m.status === 'none' ? (
                                      <Tooltip text="Open receive form for this student">
                                        <button type="button" className="fee-recv-link" onClick={() => openReceive(c, s, false)}>
                                          Fee Receive <i className="fa-solid fa-eye"></i>
                                        </button>
                                      </Tooltip>
                                    ) : (
                                      <>
                                        {m.status === 'partial' && (
                                          <Tooltip text="Receive remaining balance">
                                            <button type="button" className="fee-recv-link" onClick={() => openReceive(c, s, false)}>
                                              Receive More <i className="fa-solid fa-plus"></i>
                                            </button>
                                          </Tooltip>
                                        )}
                                        <Tooltip text="View transaction details">
                                          <button className="fee-iconbtn tiny" onClick={() => openReceive(c, s, true)}>
                                            <i className="fa-solid fa-eye"></i>
                                          </button>
                                        </Tooltip>
                                        <Tooltip text="Download receipt slip">
                                          <button className="fee-iconbtn tiny" onClick={() => {
                                            const payments = paymentsFor(c.key, s.reg);
                                            const last = payments[payments.length - 1];
                                            if (last) setSlipCtx({ classMeta: c, student: s, period: `${appliedMonth} ${appliedYear}`, payment: last, defaultSize: settings.printSize || 'a4' });
                                          }}>
                                            <i className="fa-solid fa-download"></i>
                                          </button>
                                        </Tooltip>
                                        {!m.onelink && (
                                          <Tooltip text="Delete manual receipt">
                                            <button className="fee-iconbtn tiny danger" onClick={() => requestDeleteReceipt(c, s)}>
                                              <i className="fa-solid fa-trash-can"></i>
                                            </button>
                                          </Tooltip>
                                        )}
                                      </>
                                    )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <FeeConfirmDialog cfg={confirm} onClose={() => setConfirm(null)} />

      <FeeReceivingModal
        cfg={receiveCtx}
        onClose={() => setReceiveCtx(null)}
        onSave={handleSaveReceipt}
        toast={toast}
      />

      <FeeReminderModal
        cfg={reminderCtx}
        onClose={() => setReminderCtx(null)}
        toast={toast}
      />

      <FeeSlipModal
        cfg={slipCtx}
        onClose={() => setSlipCtx(null)}
        toast={toast}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FAMILY TREE FEE RECEIVING — same shape as Individual but operating
   on families. Each family row shows family + guardian, challan
   summary chips (Total/Paid/Unpaid/OneLink), Download/Delete icons,
   Bulk Fee Receiving button (opens the bulk modal), and a chevron to
   expand the children table. Per-child rows reuse FeeReceivingModal
   in child mode.
   ═══════════════════════════════════════════════════════════════════ */

/* Build a child's receiving model. Family children use fee+transport-
   discount (HTML reference shape) — no head-by-head structure. */
function childRecModel({ child, payments }) {
  const fee       = +child.fee || 0;
  const transport = +child.transport || 0;
  const discount  = +child.discount || 0;
  const prev      = +child.dues || 0;
  const advance   = +child.advance || 0;
  /* Synthesize a "heads" array so the receiving modal's existing
     per-head table can drive the layout for both class and family. */
  const heads = [];
  if (prev > 0)      heads.push({ name: 'Previous Dues',  std: prev,      disc: 0,        net: prev });
  heads.push({ name: 'Tuition Fee', std: fee, disc: discount, net: fee - discount });
  if (transport > 0) heads.push({ name: 'Transport Fees', std: transport, disc: 0, net: transport });
  const thisMonth = fee + transport;
  const disc      = discount;
  const payable   = Math.max(0, prev + thisMonth - disc - advance);
  const paid      = (payments || []).reduce((a, p) => a + (+p.amount || 0), 0);
  const remaining = Math.max(0, payable - paid);
  let status = 'none';
  if (paid > 0) status = remaining <= 0 ? 'full' : 'partial';
  const onelink = (payments || []).some(p => p.source === 'onelink' || p.source === 'bank');
  return { heads, generated: true, prev, advance, thisMonth, disc, payable, paid, remaining, status, onelink };
}

function FamilyTreeReceiving({ toast }) {
  const { data: serverFams = [] }        = useAsync(feeService.getFamilies, []);
  const { data: settings = {} }          = useAsync(feeService.getFeeSettings, []);
  const { data: serverReceipts = [] }    = useAsync(feeService.getFamilyReceipts, []);

  const today = new Date();
  const [month, setMonth] = useState(FEE_MONTHS[today.getMonth()]);
  const [year, setYear]   = useState(String(today.getFullYear()));
  const [appliedMonth, setAppliedMonth] = useState(month);
  const [appliedYear, setAppliedYear]   = useState(year);

  /* Local families mirror (for delete-record) */
  const [families, setFamilies] = useState(null);
  useEffect(() => { if (serverFams.length && families == null) setFamilies(serverFams); }, [serverFams, families]);
  const list = useMemo(() => families || [], [families]);

  /* Receipts mirror */
  const [receipts, setReceipts] = useState(null);
  useEffect(() => { if (serverReceipts.length && receipts == null) setReceipts(serverReceipts); }, [serverReceipts, receipts]);
  const receiptsList = useMemo(() => receipts || [], [receipts]);

  const monthIdx = FEE_MONTHS.indexOf(appliedMonth);
  const paymentsFor = useCallback((famKey, reg) => {
    const r = receiptsList.find(x => x.famKey === famKey && x.reg === reg && x.monthIdx === monthIdx);
    return r ? r.payments : [];
  }, [receiptsList, monthIdx]);

  const modelFor = useCallback((ch, famKey) => childRecModel({
    child: ch, payments: paymentsFor(famKey, ch.reg),
  }), [paymentsFor]);

  const familySummary = useCallback((f) => {
    let total = 0, paid = 0, unpaid = 0, onelink = 0;
    (f.children || []).forEach(ch => {
      const m = modelFor(ch, f.key);
      total += 1;
      if (m.paid > 0) paid += 1; else unpaid += 1;
      if (m.onelink) onelink += 1;
    });
    return { total, paid, unpaid, onelink };
  }, [modelFor]);

  /* Search */
  const [searchQ, setSearchQ]       = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchAnchorRef             = useRef(null);
  useEffect(() => {
    if (!searchOpen) return undefined;
    const onDown = (e) => {
      if (searchAnchorRef.current && !searchAnchorRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [searchOpen]);

  const [openKey, setOpenKey]               = useState(null);
  const [receiveCtx, setReceiveCtx]         = useState(null);
  const [slipCtx, setSlipCtx]               = useState(null);
  const [bulkCtx, setBulkCtx]               = useState(null);
  const [familySlipCtx, setFamilySlipCtx]   = useState(null);
  const [confirm, setConfirm]               = useState(null);

  const apply = () => { setAppliedMonth(month); setAppliedYear(year); toast(`Loaded ${month} ${year} family receipts`, 'info'); };
  const resetFilters = () => {
    setMonth(FEE_MONTHS[today.getMonth()]); setYear(String(today.getFullYear()));
    setAppliedMonth(FEE_MONTHS[today.getMonth()]); setAppliedYear(String(today.getFullYear()));
    setSearchQ('');
  };

  const openReceive = (f, ch, viewOnly = false) => {
    const m = modelFor(ch, f.key);
    setReceiveCtx({
      kind: 'child',
      famKey: f.key, family: f,
      classMeta: { key: f.key, cls: ch.cls, sec: ch.sec, familyName: f.name, guardian: f.guardian },
      student: ch, model: m,
      payments: paymentsFor(f.key, ch.reg),
      period:   `${appliedMonth} ${appliedYear}`,
      monthIdx,
      viewOnly,
      settings,
    });
  };

  const handleSaveReceipt = (payload) => {
    setReceipts(prev => {
      const next = [...(prev || [])];
      const idx  = next.findIndex(r => r.famKey === payload.famKey && r.reg === payload.reg && r.monthIdx === payload.monthIdx);
      const pay  = {
        id: `frcv-${Date.now()}`,
        date: payload.date, time: payload.time || nowHHMM(),
        method: payload.method, ref: payload.ref, txn: payload.txn,
        amount: payload.amount, perHead: payload.perHead, source: 'counter', by: payload.by || 'Front Desk',
      };
      if (idx >= 0) next[idx] = { ...next[idx], payments: [...next[idx].payments, pay] };
      else          next.push({ famKey: payload.famKey, reg: payload.reg, monthIdx: payload.monthIdx, payments: [pay] });
      return next;
    });
    feeService.saveFamilyReceipt(payload).catch(() => {});
    toast(`Rs. ${(payload.amount || 0).toLocaleString('en-PK')} received from ${payload.studentName}`, 'success');
    const f = receiveCtx?.family, ch = receiveCtx?.student;
    const period = receiveCtx?.period;
    setReceiveCtx(null);
    if (f && ch) {
      setSlipCtx({
        classMeta: { key: f.key, cls: ch.cls, sec: ch.sec }, student: ch,
        period,
        payment: { date: payload.date, method: payload.method, ref: payload.ref, txn: payload.txn, amount: payload.amount, perHead: payload.perHead },
        defaultSize: settings.printSize || 'a4',
      });
    }
  };

  const requestDeleteReceipt = (f, ch) => {
    setConfirm({
      title:   'Delete received fee?',
      message: <span>The manually received payment(s) for <strong>{ch.name}</strong> will be removed.</span>,
      hint:    'OneLink / Bank payments cannot be deleted from here.',
      onConfirm: () => {
        setReceipts(prev => (prev || []).map(r => (
          r.famKey === f.key && r.reg === ch.reg && r.monthIdx === monthIdx
            ? { ...r, payments: r.payments.filter(p => p.source === 'onelink' || p.source === 'bank') }
            : r
        )));
        toast('Receipt deleted', 'success');
      },
    });
  };

  const requestDeleteFamily = (f) => {
    setConfirm({
      title:   'Delete family record?',
      message: <span><strong>{f.name}</strong> will be removed from fee receiving.</span>,
      hint:    'Children remain in their classes — only the family grouping is removed.',
      confirmLabel: 'Yes, Remove',
      icon:    'fa-people-roof',
      onConfirm: () => {
        setFamilies(prev => (prev || []).filter(x => x.key !== f.key));
        toast('Family record removed', 'success');
      },
    });
  };

  const openBulk = (f) => setBulkCtx({ family: f, period: `${appliedMonth} ${appliedYear}`, monthIdx });

  const downloadFamilySlip = (f) => {
    setFamilySlipCtx({ family: f, period: `${appliedMonth} ${appliedYear}`, defaultSize: settings.printSize || 'a4' });
  };

  const matches = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return [];
    return list.filter(f => `${f.name} ${f.guardian}`.toLowerCase().includes(q)).slice(0, 8);
  }, [searchQ, list]);

  const clearSearch = () => { setSearchQ(''); setSearchOpen(false); };

  const focusOnFamily = (f) => {
    setOpenKey(f.key);
    clearSearch();
    toast('Jumped to family', 'info');
  };

  return (
    <>
      <div className="fee-section fee-section--overflow">
        <div className="fee-section-body">
          <div className="fee-filters">
            <div className="fee-field">
              <span className="fee-label">Month</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={month} onChange={e => setMonth(e.target.value)}>
                  {FEE_MONTHS.map(m => <option key={m}>{m}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
            <div className="fee-field">
              <span className="fee-label">Year</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={year} onChange={e => setYear(e.target.value)}>
                  <option>2025</option><option>2026</option><option>2027</option>
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
            <Tooltip text="Load family receipts for the selected month and year">
              <button className="fee-btn fee-btn-primary" onClick={apply}>
                <i className="fa-solid fa-filter"></i> Get Family
              </button>
            </Tooltip>
            <Tooltip text="Reset filters and search to defaults">
              <button className="fee-btn fee-btn-ghost" onClick={resetFilters}>
                <i className="fa-solid fa-rotate-left"></i> Reset Filter
              </button>
            </Tooltip>
          </div>

          <div className="fee-searchrow">
            <div className="fee-field" style={{ width: '100%' }}>
              <span className="fee-label">Search Family</span>
              <div className="fee-search-anchor" ref={searchAnchorRef}>
                <div className="fee-search-box">
                  <i className="fa-solid fa-magnifying-glass"></i>
                  <input
                    value={searchQ}
                    autoComplete="off"
                    onChange={e => { setSearchQ(e.target.value); setSearchOpen(true); }}
                    onFocus={() => setSearchOpen(true)}
                    placeholder="Search by Family or Guardian Name"
                  />
                  {searchQ && (
                    <Tooltip text="Clear search">
                      <button type="button" className="fee-search-clear" onClick={clearSearch} aria-label="Clear search">
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </Tooltip>
                  )}
                </div>
                <div className={`fee-search-results${searchOpen && searchQ ? ' open' : ''}`}>
                  {matches.length === 0 ? (
                    <div className="fee-sr-empty">No families found for "<b>{searchQ}</b>"</div>
                  ) : matches.map(f => {
                    const initial = (f.name.match(/\d+/) || [f.name[0]])[0];
                    return (
                      <button type="button" key={f.key} className="fee-sr-item" onClick={() => focusOnFamily(f)}>
                        <div className="fee-sr-av">{initial}</div>
                        <div className="fee-sr-main">
                          <div className="fee-sr-name">{f.name}</div>
                          <div className="fee-sr-meta">
                            <span><b>Guardian:</b> {f.guardian}</span>
                            <span><b>Children:</b> {f.children.length}</span>
                          </div>
                        </div>
                        <div className="fee-sr-go"><i className="fa-solid fa-arrow-right"></i></div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="fee-hint">
                <i className="fa-solid fa-circle-info"></i>
                <span>Search any family by family or guardian name, then click to jump.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fee-info">
        <i className="fa-solid fa-circle-info"></i>
        <span>
          Family Tree Fee Receiving combines all siblings under one guardian. Click
          <strong>&nbsp;Bulk Fee Receiving</strong> to record payments for multiple
          children in one flow. OneLink / Bank payments cannot be deleted manually.
        </span>
      </div>

      <div className="fee-section">
        <div className="fee-table-head fee-recfam-row">
          <div className="fee-th">S. No.</div>
          <div className="fee-th">Family Name</div>
          <div className="fee-th fee-center">Challan Summary</div>
          <div className="fee-th fee-center">Action</div>
          <div className="fee-th fee-center">Bulk Fee Receiving</div>
          <div className="fee-th fee-center">Details</div>
        </div>

        {list.length === 0 ? (
          <div className="fee-empty">No families configured.</div>
        ) : list.map((f, i) => {
          const isOpen = openKey === f.key;
          const sm     = familySummary(f);
          let totPayable = 0, totPaid = 0, totRem = 0;
          (f.children || []).forEach(ch => {
            const m = modelFor(ch, f.key);
            totPayable += m.payable; totPaid += m.paid; totRem += m.remaining;
          });
          return (
            <div key={f.key} className="fee-rowwrap">
              <div
                className={`fee-row fee-recfam-row${isOpen ? ' open' : ''}`}
                onClick={() => setOpenKey(isOpen ? null : f.key)}
              >
                <div className="fee-td" data-label="S. No."><span className="fee-row-icon">{i + 1}</span></div>
                <div className="fee-td fee-name" data-label="Family Name">
                  {f.name}<span className="fee-sub-eq">{f.guardian}</span>
                </div>
                <div className="fee-td fee-center" data-label="Challan Summary">{summaryChips(sm)}</div>
                <div className="fee-td fee-center" data-label="Action" onClick={e => e.stopPropagation()}>
                  <div className="fee-recv-acts">
                    <Tooltip text="Download family fee receiving slip">
                      <button className="fee-iconbtn" onClick={() => downloadFamilySlip(f)}>
                        <i className="fa-solid fa-download"></i>
                      </button>
                    </Tooltip>
                    <Tooltip text="Delete family record">
                      <button className="fee-iconbtn danger" onClick={() => requestDeleteFamily(f)}>
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </Tooltip>
                  </div>
                </div>
                <div className="fee-td fee-center" data-label="Bulk Fee Receiving" onClick={e => e.stopPropagation()}>
                  <Tooltip text={`Bulk receive for ${f.children.length} child${f.children.length === 1 ? '' : 'ren'}`}>
                    <button className="fee-reminder-btn" onClick={() => openBulk(f)}>
                      <i className="fa-solid fa-people-roof"></i> Bulk Fee Receiving
                    </button>
                  </Tooltip>
                </div>
                <div className="fee-td fee-center" data-label="Details">
                  <Tooltip text={isOpen ? 'Hide children list' : 'Show children list'}>
                    <span className={`fee-chevbtn${isOpen ? ' open' : ''}`}>
                      <i className="fa-solid fa-chevron-down fee-chev"></i>
                    </span>
                  </Tooltip>
                </div>
              </div>

              <div className={`fee-detail${isOpen ? ' open' : ''}`}>
                <div className="fee-detail-inner">
                  <div className="fee-detail-title">
                    <i className="fa-solid fa-children"></i> Children in {f.name} — {appliedMonth} {appliedYear}
                  </div>

                  <div className="fee-stbl-wrap">
                    <table className="fee-stbl">
                      <thead>
                        <tr>
                          <th>Reg No</th>
                          <th>Name</th>
                          <th>Class</th>
                          <th>Sec</th>
                          <th className="fee-right">Total Payable</th>
                          <th className="fee-right">Received</th>
                          <th className="fee-right">Remaining</th>
                          <th className="fee-center">Status</th>
                          <th className="fee-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(f.children || []).map(ch => {
                          const m = modelFor(ch, f.key);
                          return (
                            <tr key={ch.reg}>
                              <td>{ch.reg}</td>
                              <td>
                                <b>{ch.name}</b>
                                <span className="fee-sub-eq">s/o {ch.father || '—'}</span>
                              </td>
                              <td>{ch.cls}</td>
                              <td>{ch.sec}</td>
                              <td className="fee-right">
                                <b>{money(m.payable)}</b>
                                {m.disc > 0 && <span className="fee-sub-eq">disc {money(m.disc)}</span>}
                              </td>
                              <td className="fee-right">{m.paid > 0 ? <span className="fee-paid-amt">{money(m.paid)}</span> : '0'}</td>
                              <td className="fee-right">{money(m.remaining)}</td>
                              <td className="fee-center">
                                <div className="fee-recv-status">
                                  {statusBadge(m.status)}
                                  {m.onelink && <span className="fee-onelink-tag"><i className="fa-solid fa-building-columns"></i> OneLink</span>}
                                </div>
                              </td>
                              <td className="fee-center">
                                <div className="fee-recv-acts">
                                  {m.status === 'none' ? (
                                    <Tooltip text="Open receive form for this child">
                                      <button type="button" className="fee-recv-link" onClick={() => openReceive(f, ch, false)}>
                                        Fee Receive <i className="fa-solid fa-eye"></i>
                                      </button>
                                    </Tooltip>
                                  ) : (
                                    <>
                                      {m.status === 'partial' && (
                                        <Tooltip text="Receive remaining balance">
                                          <button type="button" className="fee-recv-link" onClick={() => openReceive(f, ch, false)}>
                                            Receive More <i className="fa-solid fa-plus"></i>
                                          </button>
                                        </Tooltip>
                                      )}
                                      <Tooltip text="View transaction details">
                                        <button className="fee-iconbtn tiny" onClick={() => openReceive(f, ch, true)}>
                                          <i className="fa-solid fa-eye"></i>
                                        </button>
                                      </Tooltip>
                                      <Tooltip text="Download receipt slip">
                                        <button className="fee-iconbtn tiny" onClick={() => {
                                          const payments = paymentsFor(f.key, ch.reg);
                                          const last = payments[payments.length - 1];
                                          if (last) setSlipCtx({ classMeta: { key: f.key, cls: ch.cls, sec: ch.sec }, student: ch, period: `${appliedMonth} ${appliedYear}`, payment: last, defaultSize: settings.printSize || 'a4' });
                                        }}>
                                          <i className="fa-solid fa-download"></i>
                                        </button>
                                      </Tooltip>
                                      {!m.onelink && (
                                        <Tooltip text="Delete manual receipt">
                                          <button className="fee-iconbtn tiny danger" onClick={() => requestDeleteReceipt(f, ch)}>
                                            <i className="fa-solid fa-trash-can"></i>
                                          </button>
                                        </Tooltip>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="fee-recv-total">
                          <td colSpan="4" style={{ textAlign: 'right', fontWeight: 800 }}>Total</td>
                          <td className="fee-right">{money(totPayable)}</td>
                          <td className="fee-right">{money(totPaid)}</td>
                          <td className="fee-right">{money(totRem)}</td>
                          <td colSpan="2"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <FeeConfirmDialog cfg={confirm} onClose={() => setConfirm(null)} />

      <FeeReceivingModal
        cfg={receiveCtx}
        onClose={() => setReceiveCtx(null)}
        onSave={handleSaveReceipt}
        toast={toast}
      />

      <BulkFeeReceivingModal
        cfg={bulkCtx}
        onClose={() => setBulkCtx(null)}
        modelFor={modelFor}
        paymentsFor={paymentsFor}
        onSave={handleSaveReceipt}
        settings={settings}
        toast={toast}
      />

      <FeeSlipModal
        cfg={slipCtx}
        onClose={() => setSlipCtx(null)}
        toast={toast}
      />

      <FamilyFeeSlipModal
        cfg={familySlipCtx}
        onClose={() => setFamilySlipCtx(null)}
        paymentsFor={paymentsFor}
        toast={toast}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   BULK FEE RECEIVING MODAL — lists all family children with status
   badges. Click a child row to expand a per-child inline card with
   the receive form (heads / inputs / pay strip). Save records the
   payment for that child and closes the card.
   ═══════════════════════════════════════════════════════════════════ */
function BulkFeeReceivingModal({ cfg, onClose, modelFor, paymentsFor, onSave, settings, toast }) {
  const [selReg, setSelReg]             = useState(null);
  const [perHeadInput, setPerHeadInput] = useState({});
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const [date, setDate]     = useState(todayISO());
  const [method, setMethod] = useState('Cash');
  const [ref, setRef]       = useState('');
  const [txn, setTxn]       = useState('');

  useEffect(() => {
    if (!cfg) return;
    setSelReg(null);
    setDate(todayISO()); setMethod('Cash'); setRef(''); setTxn('');
    setPerHeadInput({});
  }, [cfg]);

  useEffect(() => {
    if (!cfg) return undefined;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [cfg, onClose]);

  if (!cfg) return null;
  const { family, period, monthIdx } = cfg;

  const selChild = family.children.find(c => c.reg === selReg);
  const selModel = selChild ? modelFor(selChild, family.key) : null;

  /* Seed per-head inputs when the expansion opens */
  const openChild = (ch) => {
    if (selReg === ch.reg) { setSelReg(null); return; }
    setSelReg(ch.reg);
    const m = modelFor(ch, family.key);
    const payments = paymentsFor(family.key, ch.reg);
    const seed = {};
    const perHeadPaid = {};
    payments.forEach(p => Object.entries(p.perHead || {}).forEach(([k, v]) => {
      perHeadPaid[k] = (perHeadPaid[k] || 0) + (+v || 0);
    }));
    m.heads.forEach(h => {
      seed[h.name] = Math.max(0, h.net - (+perHeadPaid[h.name] || 0));
    });
    setPerHeadInput(seed);
    setDate(todayISO()); setMethod('Cash'); setRef(''); setTxn('');
  };

  const setHead = (name, v) => setPerHeadInput(prev => ({ ...prev, [name]: Math.max(0, Number(v) || 0) }));

  const computeRows = (ch, m, payments) => {
    const perHeadPaid = {};
    payments.forEach(p => Object.entries(p.perHead || {}).forEach(([k, v]) => {
      perHeadPaid[k] = (perHeadPaid[k] || 0) + (+v || 0);
    }));
    return m.heads.map(h => {
      const paid    = +perHeadPaid[h.name] || 0;
      const recvNow = m.onelink || m.status === 'full' ? 0 : Math.max(0, Math.min(+perHeadInput[h.name] || 0, h.net - paid));
      const pending = Math.max(0, h.net - paid - recvNow);
      return { ...h, paid, recvNow, pending };
    });
  };

  let rowsForSel = [];
  let recvNow = 0, alreadyPaid = 0, totalAfter = 0, totalDisc = 0, totalCh = 0;
  if (selChild && selModel) {
    const payments = paymentsFor(family.key, selChild.reg);
    rowsForSel = computeRows(selChild, selModel, payments);
    rowsForSel.forEach(r => {
      recvNow     += r.recvNow;
      alreadyPaid += r.paid;
      totalAfter  += r.net;
      totalDisc   += r.disc;
      totalCh     += r.std;
    });
  }

  const remainAfter = selModel ? Math.max(0, selModel.payable - alreadyPaid - recvNow) : 0;

  const handleSaveChild = () => {
    if (!selChild) return;
    if (recvNow <= 0) { toast('Enter at least one head amount to receive', 'error'); return; }
    if (!date) { toast('Receiving date is required', 'error'); return; }
    const perHead = {};
    rowsForSel.forEach(r => { if (r.recvNow > 0) perHead[r.name] = r.recvNow; });
    onSave({
      famKey: family.key, reg: selChild.reg, monthIdx,
      studentName: selChild.name,
      date, method, ref, txn,
      amount: recvNow,
      perHead,
    });
    setSelReg(null);
  };

  return createPortal(
    <div className="fee-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fee-modal lg">
        <div className="fee-modal-head">
          <div className="fee-modal-head-title">
            <div className="fee-modal-head-icon"><i className="fa-solid fa-people-roof"></i></div>
            <div>
              <div className="fee-modal-title">{family.name} — Bulk Fee Receiving</div>
              <div className="fee-modal-sub">{family.children.length} children · {family.guardian} · {period}</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="fee-modal-close" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </Tooltip>
        </div>

        <div className="fee-modal-body">
          <div className="fee-recv-summary-title">Select a child to receive fee</div>
          <div className="fee-bulk-list">
            {family.children.map(ch => {
              const m = modelFor(ch, family.key);
              const initial = (ch.name || '?').trim()[0] || '?';
              const isSel = selReg === ch.reg;
              const badge = m.status === 'full'
                ? <span className="fee-stat-badge fee-stat-full"><i className="fa-solid fa-circle-check"></i> Received</span>
                : m.status === 'partial'
                  ? <span className="fee-stat-badge fee-stat-partial"><i className="fa-solid fa-circle-half-stroke"></i> Partially Received</span>
                  : <span className="fee-stat-badge fee-stat-none"><i className="fa-solid fa-circle-exclamation"></i> Not Received</span>;
              return (
                <React.Fragment key={ch.reg}>
                  <button
                    type="button"
                    className={`fee-bulk-row${isSel ? ' sel' : ''}`}
                    onClick={() => openChild(ch)}
                  >
                    <div className="fee-bulk-av">{initial.toUpperCase()}</div>
                    <div className="fee-bulk-main">
                      <div className="fee-bulk-name">{ch.name}</div>
                      <div className="fee-bulk-meta">{ch.cls} — {ch.sec} · Remaining Rs. {money(m.remaining)}</div>
                    </div>
                    <div className="fee-bulk-status">
                      {badge}
                      {m.onelink && <span className="fee-onelink-tag" style={{ marginLeft: 6 }}><i className="fa-solid fa-building-columns"></i> OneLink</span>}
                    </div>
                    <div className="fee-bulk-chev">
                      <i className={`fa-solid fa-chevron-${isSel ? 'up' : 'down'}`}></i>
                    </div>
                  </button>

                  {isSel && selModel && (
                    <div className="fee-bulk-card">
                      <div className="fee-recv-band" style={{ margin: '0 0 12px' }}>
                        Receiving Fee of {ch.name} S/O {ch.father || '—'} — {ch.cls}/{ch.sec}
                      </div>

                      {selModel.onelink && (
                        <div className="fee-onelink-note">
                          <i className="fa-solid fa-building-columns"></i>
                          Payment received through OneLink / Bank. View only.
                        </div>
                      )}

                      {!selModel.onelink && selModel.status !== 'full' && (
                        <div className="fee-recv-meta" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                          <div className="fee-field">
                            <span className="fee-label">Reference #</span>
                            <input className="fee-input" value={ref} onChange={e => setRef(e.target.value)} placeholder="Optional" />
                          </div>
                          <div className="fee-field">
                            <span className="fee-label">Date</span>
                            <input className="fee-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
                          </div>
                          <div className="fee-field">
                            <span className="fee-label">Method</span>
                            <div className="fee-select-wrap">
                              <select className="fee-select" value={method} onChange={e => setMethod(e.target.value)}>
                                <option>Cash</option><option>Bank Transfer</option><option>Cheque</option><option>Card</option><option>Online / App</option>
                              </select>
                              <i className="fa-solid fa-chevron-down"></i>
                            </div>
                          </div>
                          <div className="fee-field">
                            <span className="fee-label">Transaction #</span>
                            <input className="fee-input" value={txn} onChange={e => setTxn(e.target.value)} placeholder="Optional" />
                          </div>
                        </div>
                      )}

                      <div className="fee-stbl-wrap">
                        <table className="fee-stbl fee-recv-table">
                          <thead>
                            <tr>
                              <th>Head</th>
                              <th className="fee-right">Challan</th>
                              <th className="fee-right">Discount</th>
                              <th className="fee-right">After Discount</th>
                              <th className="fee-right">Received</th>
                              <th className="fee-right">Pending</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rowsForSel.map(r => (
                              <tr key={r.name}>
                                <td><b>{r.name}</b></td>
                                <td className="fee-right"><span className="fee-cell-grey">{money(r.std)}</span></td>
                                <td className="fee-right"><span className="fee-cell-grey">{money(r.disc)}</span></td>
                                <td className="fee-right"><span className="fee-cell-grey">{money(r.net)}</span></td>
                                <td className="fee-right">
                                  {selModel.onelink || selModel.status === 'full' ? (
                                    <span className="fee-cell-grey">{money(r.paid)}</span>
                                  ) : (
                                    <input
                                      type="number"
                                      min="0"
                                      max={Math.max(0, r.net - r.paid)}
                                      value={perHeadInput[r.name] === 0 ? 0 : (perHeadInput[r.name] || '')}
                                      onChange={e => setHead(r.name, e.target.value)}
                                      placeholder="0"
                                    />
                                  )}
                                </td>
                                <td className="fee-right">{money(r.pending)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="fee-recv-total">
                              <td>Total</td>
                              <td className="fee-right">{money(totalCh)}</td>
                              <td className="fee-right">{money(totalDisc)}</td>
                              <td className="fee-right">{money(totalAfter)}</td>
                              <td className="fee-right">{money(alreadyPaid + recvNow)}</td>
                              <td className="fee-right">{money(remainAfter)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      <div className="fee-recv-paystrip" style={{ marginTop: 14 }}>
                        <div className="fee-recv-paycard">
                          <span className="fee-recv-paylbl">Total Payable</span>
                          <span className="fee-recv-payval">{money(selModel.payable)}</span>
                        </div>
                        <div className="fee-recv-paycard">
                          <span className="fee-recv-paylbl">Already Received</span>
                          <span className="fee-recv-payval green">{money(alreadyPaid)}</span>
                        </div>
                        <div className="fee-recv-paycard">
                          <span className="fee-recv-paylbl">Receiving Now</span>
                          <span className="fee-recv-payval blue">{money(recvNow)}</span>
                        </div>
                        <div className="fee-recv-paycard">
                          <span className="fee-recv-paylbl">Remaining After</span>
                          <span className="fee-recv-payval red">{money(remainAfter)}</span>
                        </div>
                      </div>

                      {!selModel.onelink && selModel.status !== 'full' && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                          <button className="fee-btn fee-btn-ghost" onClick={() => setSelReg(null)}>Cancel</button>
                          <button className="fee-btn fee-btn-primary" onClick={handleSaveChild}>
                            <i className="fa-solid fa-check"></i> Receive
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="fee-modal-foot">
          <Tooltip text="Close">
            <button className="fee-btn fee-btn-primary" onClick={onClose}>Done</button>
          </Tooltip>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* Build a print-ready family fee receiving slip — combined summary
   of all children's payments under one guardian. Accepts size:
   'a4' (default — full A4) or 'small' (80mm thermal receipt). */
function buildFamilyReceivingSlipHTML({ family, period, paymentsFor, size = 'a4' }) {
  const today = new Date().toLocaleDateString('en-GB');
  const rows  = family.children.map(ch => {
    const pays = paymentsFor(family.key, ch.reg);
    const paid = pays.reduce((a, p) => a + (+p.amount || 0), 0);
    const fee       = +ch.fee || 0;
    const transport = +ch.transport || 0;
    const discount  = +ch.discount || 0;
    const dues      = +ch.dues || 0;
    const payable   = Math.max(0, fee + transport - discount + dues);
    return { ch, paid, payable, rem: Math.max(0, payable - paid), pays };
  });
  const totals = rows.reduce((a, r) => ({
    paid: a.paid + r.paid, payable: a.payable + r.payable, rem: a.rem + r.rem,
  }), { paid: 0, payable: 0, rem: 0 });

  /* A4 layout — full landscape-friendly table including transactions */
  const a4Rows = rows.map((r, i) => {
    const txRow = r.pays.length === 0
      ? `<tr class="tx-empty"><td colspan="9">No transactions recorded yet.</td></tr>`
      : r.pays.map((p, j) => `
          <tr class="tx-row">
            <td>${j + 1}</td>
            <td>${escHtml(p.date)}${p.time ? `<br/><span class="tx-time">${escHtml(fmtTime12(p.time))}</span>` : ''}</td>
            <td>${escHtml(p.method)}</td>
            <td>${escHtml(p.ref || p.txn || '—')}</td>
            <td class="right green">${(+p.amount || 0).toLocaleString('en-PK')}</td>
            <td class="center"><span class="tx-src ${p.source === 'onelink' || p.source === 'bank' ? 'onelink' : 'counter'}">${p.source === 'onelink' || p.source === 'bank' ? 'OneLink' : 'Counter'}</span></td>
          </tr>`).join('');
    return `
      <tr class="child-head">
        <td>${i + 1}</td>
        <td>${escHtml(r.ch.reg)}</td>
        <td><b>${escHtml(r.ch.name)}</b><br/><small>s/o ${escHtml(r.ch.father || '—')}</small></td>
        <td>${escHtml(r.ch.cls)} (${escHtml(r.ch.sec)})</td>
        <td class="right">${r.payable.toLocaleString('en-PK')}</td>
        <td class="right green">${r.paid.toLocaleString('en-PK')}</td>
        <td class="right red">${r.rem.toLocaleString('en-PK')}</td>
      </tr>
      <tr class="tx-wrap">
        <td colspan="7" class="tx-pad">
          <div class="tx-title">Transactions for ${escHtml(r.ch.name)}</div>
          <table class="tx-tbl">
            <thead><tr><th style="width:42px">#</th><th style="width:140px">Date &amp; Time</th><th style="width:120px">Method</th><th>Reference</th><th class="right" style="width:120px">Amount</th><th class="center" style="width:90px">Source</th></tr></thead>
            <tbody>${txRow}</tbody>
          </table>
        </td>
      </tr>`;
  }).join('');

  if (size === 'small') {
    /* 80 mm thermal printer layout */
    const smallChildren = rows.map((r) => {
      const txList = r.pays.length === 0
        ? `<div class="th-tx-empty">No transactions yet.</div>`
        : r.pays.map((p, j) => `
            <div class="th-tx">
              <div class="th-tx-line"><span>#${j + 1}</span><span>${escHtml(p.date)}${p.time ? ' · ' + escHtml(fmtTime12(p.time)) : ''}</span></div>
              <div class="th-tx-line"><span>${escHtml(p.method)}</span><b>Rs. ${(+p.amount || 0).toLocaleString('en-PK')}</b></div>
              ${(p.ref || p.txn) ? `<div class="th-tx-line"><span>Ref</span><span>${escHtml(p.ref || p.txn)}</span></div>` : ''}
            </div>`).join('');
      return `
        <div class="th-child">
          <div class="th-child-name">${escHtml(r.ch.name)} — ${escHtml(r.ch.cls)}/${escHtml(r.ch.sec)}</div>
          <div class="th-child-meta">Reg ${escHtml(r.ch.reg)} · s/o ${escHtml(r.ch.father || '—')}</div>
          <div class="th-kv"><span>Payable</span><b>Rs. ${r.payable.toLocaleString('en-PK')}</b></div>
          <div class="th-kv"><span>Received</span><b class="green">Rs. ${r.paid.toLocaleString('en-PK')}</b></div>
          <div class="th-kv"><span>Remaining</span><b class="red">Rs. ${r.rem.toLocaleString('en-PK')}</b></div>
          <div class="th-tx-title">Transactions</div>
          ${txList}
        </div>`;
    }).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escHtml(`Family Receipt — ${family.name}`)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Plus Jakarta Sans','Segoe UI',sans-serif;color:#111;background:#fff;padding:8px;font-size:11.5px;}
  .th-slip{width:80mm;margin:0 auto;padding:6mm 4mm;}
  .th-school{font-size:14px;font-weight:800;text-align:center;}
  .th-tag{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#555;text-align:center;margin-top:2px;padding-bottom:8px;border-bottom:1.5px solid #111;margin-bottom:8px;}
  .th-meta{font-size:11px;display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;margin-bottom:10px;}
  .th-meta span:nth-child(odd){color:#666;}
  .th-meta span:nth-child(even){text-align:right;font-weight:700;}
  .th-band{background:#111;color:#fff;text-align:center;font-weight:800;padding:6px;margin:8px 0;font-size:12px;border-radius:3px;}
  .th-child{border:1px dashed #888;border-radius:4px;padding:7px;margin-bottom:8px;}
  .th-child-name{font-weight:800;font-size:12px;}
  .th-child-meta{color:#666;font-size:10px;margin-top:1px;margin-bottom:5px;}
  .th-kv{display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;}
  .th-kv span{color:#555;}
  .th-kv b.green{color:#16A34A;}
  .th-kv b.red{color:#DC2626;}
  .th-tx-title{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-top:6px;margin-bottom:3px;font-weight:700;}
  .th-tx{border-top:0.5px dashed #aaa;padding:3px 0;font-size:10.5px;}
  .th-tx-line{display:flex;justify-content:space-between;}
  .th-tx-empty{font-size:10px;color:#888;font-style:italic;text-align:center;padding:4px 0;}
  .th-foot{border-top:1.5px solid #111;padding-top:6px;margin-top:6px;}
  .th-foot .th-kv{font-size:12px;font-weight:800;}
  @page{size:80mm auto;margin:0;}
  @media print{ body{padding:0;} }
</style></head><body>
<div class="th-slip">
  <div class="th-school">${escHtml(FEE_SCHOOL.name)}</div>
  <div class="th-tag">Family Fee Receipt</div>
  <div class="th-meta">
    <span>Family</span><span>${escHtml(family.name)}</span>
    <span>Guardian</span><span>${escHtml(family.guardian)}</span>
    <span>Period</span><span>${escHtml(period)}</span>
    <span>Date</span><span>${escHtml(today)}</span>
    <span>Children</span><span>${family.children.length}</span>
  </div>
  <div class="th-band">Children — ${family.children.length}</div>
  ${smallChildren}
  <div class="th-foot">
    <div class="th-kv"><span>Total Payable</span><b>Rs. ${totals.payable.toLocaleString('en-PK')}</b></div>
    <div class="th-kv"><span>Total Received</span><b class="green">Rs. ${totals.paid.toLocaleString('en-PK')}</b></div>
    <div class="th-kv"><span>Total Remaining</span><b class="red">Rs. ${totals.rem.toLocaleString('en-PK')}</b></div>
  </div>
</div>
</body></html>`;
  }

  /* Default — A4 layout with per-child transaction sub-tables. */
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escHtml(`Family Receipt — ${family.name}`)}</title>
<style>
  body { margin:0; font-family:'Plus Jakarta Sans','Segoe UI',sans-serif; color:#0F172A; background:#fff; font-size:13px; }
  .page { width:210mm; margin:0 auto; padding:18mm 14mm; box-sizing:border-box; }
  .header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #1E3A8A; padding-bottom:14px; margin-bottom:18px; }
  .school { font-size:18px; font-weight:800; color:#1E3A8A; }
  .title  { font-size:14px; font-weight:700; color:#1E40AF; margin-top:6px; }
  .meta   { font-size:11px; color:#64748B; text-align:right; line-height:1.55; }
  .band   { background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff; padding:10px 14px; border-radius:6px; font-weight:800; margin-bottom:14px; }
  table { width:100%; border-collapse:collapse; margin-top:8px; }
  thead th { background:#EFF6FF; color:#1E3A5F; font-weight:800; text-align:left; padding:9px 10px; border-bottom:2px solid #BFDBFE; font-size:11px; text-transform:uppercase; letter-spacing:.4px; }
  thead th.right { text-align:right; }
  thead th.center { text-align:center; }
  tbody td { padding:8px 10px; border-bottom:1px solid #E5E7EB; vertical-align:top; }
  tbody td.right { text-align:right; font-variant-numeric:tabular-nums; }
  tbody td.center { text-align:center; }
  tbody td.green { color:#16A34A; font-weight:700; }
  tbody td.red { color:#DC2626; font-weight:700; }
  tr.child-head td { background:#F8FAFF; font-weight:600; border-top:2px solid #1E3A8A; }
  tr.tx-wrap td.tx-pad { padding:6px 10px 14px; background:#FAFBFE; }
  .tx-title { font-size:10.5px; text-transform:uppercase; letter-spacing:.6px; color:#475569; font-weight:800; margin-bottom:6px; }
  .tx-tbl { width:100%; border-collapse:collapse; font-size:11px; }
  .tx-tbl thead th { background:transparent; border-bottom:1px solid #CBD5E1; color:#64748B; padding:5px 8px; font-size:10px; }
  .tx-tbl tbody td { background:#fff; border:1px solid #E5E7EB; padding:5px 8px; }
  .tx-tbl tr.tx-empty td { background:transparent; border:none; text-align:center; color:#94A3B8; font-style:italic; padding:6px; }
  .tx-tbl .right { text-align:right; }
  .tx-tbl .center { text-align:center; }
  .tx-time { color:#64748B; font-size:10px; font-weight:600; }
  .tx-src { display:inline-block; font-size:9.5px; font-weight:800; padding:2px 8px; border-radius:999px; }
  .tx-src.counter { background:#F1F5F9; color:#1E3A5F; }
  .tx-src.onelink { background:rgba(124,58,237,.1); color:#7C3AED; border:1px solid rgba(124,58,237,.25); }
  tfoot td { padding:11px 10px; font-weight:800; background:#EFF6FF; border-top:2px solid #1E3A8A; }
  tfoot td.right { text-align:right; }
  @media print { @page { size:A4; margin:14mm; } body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head><body>
<div class="page">
  <div class="header">
    <div>
      <div class="school">${escHtml(FEE_SCHOOL.name)}</div>
      <div class="title">Family Fee Receiving Slip — ${escHtml(family.name)}</div>
    </div>
    <div class="meta">Generated: ${today}<br/>Guardian: ${escHtml(family.guardian)}<br/>Period: ${escHtml(period)}</div>
  </div>
  <div class="band">${escHtml(family.name)} — ${family.children.length} child${family.children.length === 1 ? '' : 'ren'}</div>
  <table>
    <thead>
      <tr>
        <th style="width:48px">#</th>
        <th style="width:140px">Reg No</th>
        <th>Name</th>
        <th style="width:140px">Class (Sec)</th>
        <th class="right" style="width:110px">Payable</th>
        <th class="right" style="width:110px">Received</th>
        <th class="right" style="width:110px">Remaining</th>
      </tr>
    </thead>
    <tbody>${a4Rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="4">Total</td>
        <td class="right">${totals.payable.toLocaleString('en-PK')}</td>
        <td class="right">${totals.paid.toLocaleString('en-PK')}</td>
        <td class="right">${totals.rem.toLocaleString('en-PK')}</td>
      </tr>
    </tfoot>
  </table>
</div>
</body></html>`;
}

/* ═══════════════════════════════════════════════════════════════════
   FAMILY FEE SLIP MODAL — wraps the family receipt download with an
   A4 / Small (thermal) size picker, mirroring the per-student slip.
   ═══════════════════════════════════════════════════════════════════ */
function FamilyFeeSlipModal({ cfg, onClose, paymentsFor, toast }) {
  const [size, setSize] = useState('a4');

  useEffect(() => { if (cfg) setSize(cfg.defaultSize || 'a4'); }, [cfg]);
  useEffect(() => {
    if (!cfg) return undefined;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [cfg, onClose]);

  if (!cfg) return null;
  const { family, period } = cfg;

  /* Live rows for preview */
  const rows = family.children.map(ch => {
    const pays = paymentsFor(family.key, ch.reg);
    const paid = pays.reduce((a, p) => a + (+p.amount || 0), 0);
    const payable = Math.max(0, (+ch.fee || 0) + (+ch.transport || 0) - (+ch.discount || 0) + (+ch.dues || 0));
    return { ch, paid, payable, rem: Math.max(0, payable - paid), pays };
  });
  const totals = rows.reduce((a, r) => ({
    paid: a.paid + r.paid, payable: a.payable + r.payable, rem: a.rem + r.rem,
  }), { paid: 0, payable: 0, rem: 0 });

  const doPrint = () => {
    const html = buildFamilyReceivingSlipHTML({ family, period, paymentsFor, size });
    const w = window.open('', '_blank');
    if (!w) { toast('Please allow pop-ups to download the slip', 'error'); return; }
    w.document.write(html);
    w.document.close();
    w.onload = () => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } };
    toast(`${size === 'small' ? 'Thermal 80mm' : 'A4'} family slip ready — use Save as PDF.`, 'success');
  };

  return createPortal(
    <div className="fee-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fee-modal">
        <div className="fee-modal-head">
          <div className="fee-modal-head-title">
            <div className="fee-modal-head-icon" style={{ background: 'linear-gradient(135deg,#16A34A,#15803D)' }}>
              <i className="fa-solid fa-receipt"></i>
            </div>
            <div>
              <div className="fee-modal-title">Family Fee Receiving Slip</div>
              <div className="fee-modal-sub">{family.name} — {family.guardian} · {period}</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="fee-modal-close" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </Tooltip>
        </div>

        <div className="fee-modal-body">
          <div className="fee-dl-label">Slip Size</div>
          <div className="fee-dl-fmt-grid">
            <button type="button" className={`fee-dl-fmt${size === 'a4' ? ' sel' : ''}`} onClick={() => setSize('a4')}>
              <div className="fee-dl-fmt-ic" style={{ background: 'rgba(30,58,138,.1)', color: '#1E3A8A' }}>
                <i className="fa-solid fa-file-lines"></i>
              </div>
              <div>
                <div className="fee-dl-fmt-name">A4 Size</div>
                <div className="fee-dl-desc">Full-page receipt with per-child transactions</div>
              </div>
            </button>
            <button type="button" className={`fee-dl-fmt${size === 'small' ? ' sel' : ''}`} onClick={() => setSize('small')}>
              <div className="fee-dl-fmt-ic" style={{ background: 'rgba(22,163,74,.1)', color: '#16A34A' }}>
                <i className="fa-solid fa-receipt"></i>
              </div>
              <div>
                <div className="fee-dl-fmt-name">Small Receipt</div>
                <div className="fee-dl-desc">Thermal / 80mm — one slip with all children</div>
              </div>
            </button>
          </div>

          <div className="fee-dl-label" style={{ marginTop: 16 }}>Preview</div>
          <div className="fee-slip-doc" style={{ maxWidth: size === 'small' ? 300 : 640 }}>
            <div className="fee-slip-head">
              <div className="fee-slip-school">{FEE_SCHOOL.name}</div>
              <div className="fee-slip-tag">Family Fee Receipt</div>
            </div>
            <div className="fee-slip-kv">
              <span className="k">Family</span><span className="v">{family.name}</span>
              <span className="k">Guardian</span><span className="v">{family.guardian}</span>
              <span className="k">Period</span><span className="v">{period}</span>
              <span className="k">Children</span><span className="v">{family.children.length}</span>
            </div>
            {rows.map((r) => (
              <div key={r.ch.reg} style={{ borderTop: '1px dashed #999', paddingTop: 8, marginTop: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 12 }}>{r.ch.name} — {r.ch.cls}/{r.ch.sec}</div>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Reg {r.ch.reg} · s/o {r.ch.father || '—'}</div>
                <div className="fee-slip-kv" style={{ marginBottom: 6 }}>
                  <span className="k">Payable</span><span className="v">Rs. {r.payable.toLocaleString('en-PK')}</span>
                  <span className="k">Received</span><span className="v" style={{ color: '#16A34A' }}>Rs. {r.paid.toLocaleString('en-PK')}</span>
                  <span className="k">Remaining</span><span className="v" style={{ color: '#DC2626' }}>Rs. {r.rem.toLocaleString('en-PK')}</span>
                </div>
                {r.pays.length > 0 && (
                  <div style={{ fontSize: 10.5 }}>
                    <div style={{ textTransform: 'uppercase', letterSpacing: '.5px', color: '#666', fontWeight: 700, marginBottom: 2 }}>Transactions</div>
                    {r.pays.map((p, j) => (
                      <div key={p.id || j} style={{ display: 'flex', justifyContent: 'space-between', borderTop: '0.5px dashed #ccc', padding: '3px 0' }}>
                        <span>{p.date}{p.time ? ` · ${fmtTime12(p.time)}` : ''} · {p.method}</span>
                        <b>Rs. {(+p.amount || 0).toLocaleString('en-PK')}</b>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="fee-slip-net" style={{ marginTop: 10 }}>
              <span>Total Received</span>
              <span>Rs. {totals.paid.toLocaleString('en-PK')}</span>
            </div>
          </div>
        </div>

        <div className="fee-modal-foot">
          <Tooltip text="Close preview">
            <button className="fee-btn fee-btn-ghost" onClick={onClose}>Close</button>
          </Tooltip>
          <Tooltip text={`Download ${size === 'small' ? 'thermal' : 'A4'} family slip`}>
            <button className="fee-btn fee-btn-primary" onClick={doPrint}>
              <i className="fa-solid fa-download"></i> Download Slip
            </button>
          </Tooltip>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FEE HISTORY TAB — ported screen-for-screen from the HTML reference.
   Two sub-segments (Ledger Summary / Detailed History), month-range
   filter, universal student search, an "Overall School Reports" band
   with two PDF export CTAs, and per-class expand rows showing a
   student-level ledger or detail table. Each row's View opens the
   FeeHistoryDetailModal — a meta-card strip plus either a month-wise
   ledger table (Ledger mode) or stacked month-accordion cards (Detail
   mode), with Download icons for the individual challan and slip.
   ═══════════════════════════════════════════════════════════════════ */

const FEE_HIST_YEARS = ['2025', '2026', '2027'];

/* Deterministic per-student PRNG so historical months stay stable
   between renders (no flicker when toggling segments). */
function feeHistSeed(reg, monthIdx) {
  let h = 5381;
  const k = `${reg}|${monthIdx}`;
  for (let i = 0; i < k.length; i++) h = ((h << 5) + h + k.charCodeAt(i)) >>> 0;
  return h;
}

/* Build the month-by-month history for one student. Current month
   (May 2026 in the seed data) pulls live numbers from genSet + the
   receipts ledger; past months are synthesised deterministically. */
function buildStudentHistory({ c, s, headsForClass, settings, fromIdx, toIdx, year, paymentsFor, genSet, keyOf }) {
  const months  = [];
  const baseHead = (headsForClass || []).reduce((a, h) => a + (+h.amt || 0), 0) + (+s.transport > 0 ? +s.transport : 0);

  for (let m = fromIdx; m <= toIdx; m++) {
    const isCurrent = (m === 4 && year === '2026');
    const seed = feeHistSeed(s.reg, m);
    const challanNo = `CH-${year}${String(m + 1).padStart(2, '0')}-${String(s.reg).replace(/[^0-9]/g, '').slice(-5)}`;
    const challanDate = `${year}-${String(m + 1).padStart(2, '0')}-01`;
    const dueDate     = `${year}-${String(m + 1).padStart(2, '0')}-14`;
    let challanAmt, received, method, recvDate, recvBy, status, time = '—';
    let payments = [];

    if (isCurrent) {
      const generated = !!genSet && genSet.has(keyOf(c.key, s.reg));
      const md = recStudentModel({
        student: s, headsForClass, generated, classDisc: {},
        payments: paymentsFor(c.key, s.reg),
      });
      payments   = paymentsFor(c.key, s.reg);
      challanAmt = md.payable;
      received   = md.paid;
      status     = md.status;
      const last = payments[payments.length - 1];
      method   = last ? last.method : '—';
      recvDate = last ? last.date   : '—';
      time     = last ? (last.time || '—') : '—';
      recvBy   = last ? (last.source === 'onelink' || last.source === 'bank' ? 'OneLink / Bank' : 'Front Desk') : '—';
    } else {
      challanAmt = baseHead + (seed % 3000);
      const r = seed % 10;
      if (r < 6)      { received = challanAmt;                  status = 'full'; }
      else if (r < 8) { received = Math.round(challanAmt * 0.4); status = 'partial'; }
      else            { received = 0;                            status = 'none'; }
      const methods = ['Cash', 'Bank Transfer', 'Online / App', 'Cheque', 'OneLink / Bank'];
      method   = received > 0 ? methods[seed % methods.length] : '—';
      recvDate = received > 0 ? `${year}-${String(m + 1).padStart(2, '0')}-${String(5 + (seed % 18)).padStart(2, '0')}` : '—';
      time     = received > 0 ? `${String(8 + (seed % 9)).padStart(2, '0')}:${String((seed * 7) % 60).padStart(2, '0')}` : '—';
      recvBy   = received > 0 ? (method === 'OneLink / Bank' ? 'OneLink / Bank' : ['Front Desk', 'Accounts Office', 'Bursar'][seed % 3]) : '—';
    }

    months.push({
      m, monthName: FEE_MONTHS[m], challanNo, challanDate, dueDate,
      challanAmt, received, pending: Math.max(0, challanAmt - received),
      status, method, recvDate, recvBy, time, payments,
    });
  }
  return months;
}

function feeHistTotals(months) {
  let fee = 0, recv = 0, pend = 0, lastDate = '—', lastBy = '—', lastTime = '—';
  months.forEach(mo => {
    fee  += mo.challanAmt;
    recv += mo.received;
    pend += mo.pending;
    if (mo.recvDate !== '—') { lastDate = mo.recvDate; lastBy = mo.recvBy; lastTime = mo.time; }
  });
  const paidCount = months.filter(mo => mo.received > 0).length;
  return {
    challans: months.length, fee, recv, pend,
    lastDate, lastBy, lastTime,
    paidCount, unpaid: months.length - paidCount,
  };
}

function FeeHistoryTab({ toast }) {
  const [seg, setSeg] = useState('ledger');

  const { data: classes = [] }     = useAsync(feeService.getFeeClasses, []);
  const { data: studentsMap = {} } = useAsync(feeService.getTransportFee, []);
  const { data: headsMap = {} }    = useAsync(feeService.getFeeHeads, []);
  const { data: settings = {} }    = useAsync(feeService.getFeeSettings, []);
  const { data: generatedInitial } = useAsync(feeService.getGeneratedChallans, []);
  const { data: serverReceipts = [] } = useAsync(feeService.getReceipts, []);

  /* Filters */
  const [fromMonth, setFromMonth] = useState(FEE_MONTHS[0]);
  const [toMonth, setToMonth]     = useState(FEE_MONTHS[4]);
  const [year, setYear]           = useState('2026');
  const [appliedFrom, setAppliedFrom] = useState(fromMonth);
  const [appliedTo, setAppliedTo]     = useState(toMonth);
  const [appliedYear, setAppliedYear] = useState(year);

  const [genSet, setGenSet] = useState(null);
  useEffect(() => { if (generatedInitial && genSet == null) setGenSet(new Set(generatedInitial)); }, [generatedInitial, genSet]);
  const keyOf = (classKey, reg) => `${classKey}|${reg}|${4}`; // current = May 2026

  const [receipts, setReceipts] = useState(null);
  useEffect(() => { if (serverReceipts.length && receipts == null) setReceipts(serverReceipts); }, [serverReceipts, receipts]);
  const paymentsFor = useCallback((classKey, reg) => {
    const r = (receipts || []).find(x => x.classKey === classKey && x.reg === reg && x.monthIdx === 4);
    return r ? r.payments : [];
  }, [receipts]);

  const fromIdx = FEE_MONTHS.indexOf(appliedFrom);
  const toIdx   = FEE_MONTHS.indexOf(appliedTo);

  /* Per-student history (memoised lightly by class+reg+filter scope) */
  const historyFor = useCallback((c, s) => buildStudentHistory({
    c, s,
    headsForClass: headsMap[c.key] || [],
    settings,
    fromIdx, toIdx: Math.max(fromIdx, toIdx), year: appliedYear,
    paymentsFor, genSet, keyOf,
  }), [headsMap, settings, fromIdx, toIdx, appliedYear, paymentsFor, genSet]);

  /* Search */
  const [searchQ, setSearchQ]       = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchAnchorRef             = useRef(null);
  useEffect(() => {
    if (!searchOpen) return undefined;
    const onDown = (e) => {
      if (searchAnchorRef.current && !searchAnchorRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [searchOpen]);

  const [openKey, setOpenKey]     = useState(null);
  const [detail, setDetail]       = useState(null); // { mode:'ledger'|'detail', c, s, months, totals }

  const apply = () => {
    /* Validate range */
    if (FEE_MONTHS.indexOf(fromMonth) > FEE_MONTHS.indexOf(toMonth)) {
      toast('"From" month must be on or before "To"', 'error'); return;
    }
    setAppliedFrom(fromMonth); setAppliedTo(toMonth); setAppliedYear(year);
    toast(`Loaded ${fromMonth} – ${toMonth} ${year} history`, 'info');
  };
  const resetFilters = () => {
    setFromMonth(FEE_MONTHS[0]); setToMonth(FEE_MONTHS[4]); setYear('2026');
    setAppliedFrom(FEE_MONTHS[0]); setAppliedTo(FEE_MONTHS[4]); setAppliedYear('2026');
    setSearchQ('');
  };

  const matches = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return [];
    const out = [];
    classes.forEach(c => {
      (studentsMap[c.key] || []).forEach(s => {
        if (`${s.name} ${s.father || ''} ${s.reg} ${c.cls} ${c.sec}`.toLowerCase().includes(q)) out.push({ c, s });
      });
    });
    return out.slice(0, 8);
  }, [searchQ, classes, studentsMap]);

  const clearSearch = () => { setSearchQ(''); setSearchOpen(false); };
  const focusOnStudent = (c, s) => {
    setOpenKey(c.key);
    clearSearch();
    toast('Jumped to student', 'info');
    setTimeout(() => {
      const el = document.getElementById(`fee-hist-st-${c.key}-${s.reg}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('fee-st-flash');
        setTimeout(() => el.classList.remove('fee-st-flash'), 1700);
      }
    }, 380);
  };

  const openDetail = (mode, c, s) => {
    const months = historyFor(c, s);
    setDetail({ mode, c, s, months, totals: feeHistTotals(months), period: `${appliedFrom} – ${appliedTo} ${appliedYear}` });
  };

  /* PDF downloads — student / class / overall */
  const printWindow = (title, html, onReady) => {
    const w = window.open('', '_blank');
    if (!w) { toast('Please allow pop-ups to download the report', 'error'); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escHtml(title)}</title>${html}</body></html>`);
    w.document.close();
    w.onload = () => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } };
    if (typeof onReady === 'function') onReady();
  };
  const downloadStudent = (mode, c, s) => {
    const months = historyFor(c, s);
    const html = buildHistStudentReportHTML({ mode, c, s, months, period: `${appliedFrom} – ${appliedTo} ${appliedYear}` });
    printWindow(`${mode === 'detail' ? 'Detailed' : 'Ledger'} History — ${s.name}`, html);
    toast(`${mode === 'detail' ? 'Detailed' : 'Ledger'} history ready — Save as PDF.`, 'success');
  };
  const downloadClass = (c) => {
    const rows = (studentsMap[c.key] || []).map(s => ({ s, months: historyFor(c, s) }));
    const html = buildHistClassReportHTML({ mode: seg, c, rows, period: `${appliedFrom} – ${appliedTo} ${appliedYear}` });
    printWindow(`Class ${seg === 'detail' ? 'Detailed' : 'Ledger'} — ${c.cls} (${c.sec})`, html);
    toast(`Class ${seg === 'detail' ? 'detailed history' : 'ledger summary'} ready — Save as PDF.`, 'success');
  };
  const downloadOverall = (mode) => {
    const blocks = classes.map(c => ({
      c, rows: (studentsMap[c.key] || []).map(s => ({ s, months: historyFor(c, s) })),
    }));
    const html = buildHistOverallReportHTML({ mode, blocks, period: `${appliedFrom} – ${appliedTo} ${appliedYear}` });
    printWindow(`Overall ${mode === 'detail' ? 'Detailed History' : 'Ledger Summary'}`, html);
    toast(`Overall ${mode === 'detail' ? 'detailed history' : 'ledger summary'} ready — Save as PDF.`, 'success');
  };
  /* History tab's reports + month reprints always render as A4 PDFs —
     the thermal printSize setting is meant for live counter receipts,
     not archival history records. */
  const downloadMonthChallan = (c, s, mo) => {
    const html = buildChallanHTML({
      classMeta: c, students: [s], heads: headsMap[c.key] || [],
      settings, discountMap: {}, bw: false, size: 'a4',
    });
    const w = window.open('', '_blank');
    if (!w) { toast('Please allow pop-ups to download the challan', 'error'); return; }
    w.document.write(html); w.document.close();
    w.onload = () => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } };
    toast(`${mo.monthName} ${appliedYear} A4 challan ready for ${s.name}.`, 'success');
  };
  const downloadMonthSlip = (c, s, mo) => {
    if (mo.received <= 0) { toast('No receipt for this month', 'info'); return; }
    const html = buildHistMonthSlipHTML({ c, s, mo, year: appliedYear, size: 'a4' });
    const w = window.open('', '_blank');
    if (!w) { toast('Please allow pop-ups to download the slip', 'error'); return; }
    w.document.write(html); w.document.close();
    w.onload = () => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } };
    toast(`${mo.monthName} A4 slip ready for ${s.name}.`, 'success');
  };

  return (
    <>
      {/* Sub-segments */}
      <div className="fee-seg">
        <Tooltip text="Month-wise ledger summary with last receiving">
          <button className={`fee-seg-btn${seg === 'ledger' ? ' active' : ''}`} onClick={() => setSeg('ledger')}>
            <i className="fa-solid fa-book"></i> Ledger Summary
          </button>
        </Tooltip>
        <Tooltip text="Detailed month-wise challan and receiving breakdown">
          <button className={`fee-seg-btn${seg === 'detail' ? ' active' : ''}`} onClick={() => setSeg('detail')}>
            <i className="fa-solid fa-list-check"></i> Detailed History
          </button>
        </Tooltip>
      </div>

      {/* Filters + universal search */}
      <div className="fee-section fee-section--overflow">
        <div className="fee-section-body">
          <div className="fee-filters">
            <div className="fee-field">
              <span className="fee-label">From Month</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={fromMonth} onChange={e => setFromMonth(e.target.value)}>
                  {FEE_MONTHS.map(m => <option key={m}>{m}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
            <div className="fee-field">
              <span className="fee-label">To Month</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={toMonth} onChange={e => setToMonth(e.target.value)}>
                  {FEE_MONTHS.map(m => <option key={m}>{m}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
            <div className="fee-field">
              <span className="fee-label">Year</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={year} onChange={e => setYear(e.target.value)}>
                  {FEE_HIST_YEARS.map(y => <option key={y}>{y}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
            <Tooltip text="Load history for the selected month range">
              <button className="fee-btn fee-btn-primary" onClick={apply}>
                <i className="fa-solid fa-filter"></i> Get History
              </button>
            </Tooltip>
            <Tooltip text="Reset filters and search">
              <button className="fee-btn fee-btn-ghost" onClick={resetFilters}>
                <i className="fa-solid fa-rotate-left"></i> Reset Filter
              </button>
            </Tooltip>
          </div>

          <div className="fee-searchrow">
            <div className="fee-field" style={{ width: '100%' }}>
              <span className="fee-label">Universal Student Search</span>
              <div className="fee-search-anchor" ref={searchAnchorRef}>
                <div className="fee-search-box">
                  <i className="fa-solid fa-magnifying-glass"></i>
                  <input
                    value={searchQ}
                    autoComplete="off"
                    onChange={e => { setSearchQ(e.target.value); setSearchOpen(true); }}
                    onFocus={() => setSearchOpen(true)}
                    placeholder="Search by Name, Father Name, Registration, Class or Section"
                  />
                  {searchQ && (
                    <Tooltip text="Clear search">
                      <button type="button" className="fee-search-clear" onClick={clearSearch} aria-label="Clear search">
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </Tooltip>
                  )}
                </div>
                <div className={`fee-search-results${searchOpen && searchQ ? ' open' : ''}`}>
                  {matches.length === 0 ? (
                    <div className="fee-sr-empty">No students found for "<b>{searchQ}</b>"</div>
                  ) : matches.map(({ c, s }) => {
                    const initial = (s.name || '?').trim()[0] || '?';
                    return (
                      <button type="button" key={`${c.key}-${s.reg}`} className="fee-sr-item" onClick={() => focusOnStudent(c, s)}>
                        <div className="fee-sr-av">{initial.toUpperCase()}</div>
                        <div className="fee-sr-main">
                          <div className="fee-sr-name">{s.name}</div>
                          <div className="fee-sr-meta">
                            <span><b>Father:</b> {s.father || '—'}</span>
                            <span><b>Class:</b> {c.cls}</span>
                            <span><b>Section:</b> {c.sec}</span>
                            <span><b>Reg:</b> {s.reg}</span>
                          </div>
                        </div>
                        <div className="fee-sr-go"><i className="fa-solid fa-arrow-right"></i></div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="fee-hint">
                <i className="fa-solid fa-circle-info"></i>
                <span>
                  {seg === 'detail'
                    ? 'Open a class to view its students, then click View to see complete month-wise challan and receiving history.'
                    : 'Open a class to view its students, then click View on any student to see their fee ledger.'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fee-info">
        <i className="fa-solid fa-circle-info"></i>
        <span>
          {seg === 'detail'
            ? <>Open a class to view its students, then click <strong>View</strong> to see complete month-wise challan and receiving history.</>
            : <>Open a class to view its students, then click <strong>View</strong> on any student to see their fee ledger.</>}
        </span>
      </div>

      {/* Overall School Reports band */}
      <div className="fee-hist-overall">
        <div className="fee-hist-overall-info">
          <i className="fa-solid fa-school"></i>
          <div>
            <div className="fee-hist-overall-title">Overall School Reports</div>
            <div className="fee-hist-overall-sub">Download complete fee history for all classes &amp; sections (A4 printable).</div>
          </div>
        </div>
        <div className="fee-hist-overall-btns">
          <Tooltip text="Download a school-wide ledger summary report">
            <button className="fee-btn fee-btn-ghost" onClick={() => downloadOverall('ledger')}>
              <i className="fa-solid fa-book"></i> Overall Ledger Summary
              <i className="fa-solid fa-download" style={{ marginLeft: 8 }}></i>
            </button>
          </Tooltip>
          <Tooltip text="Download a school-wide detailed history report">
            <button className="fee-btn fee-btn-primary" onClick={() => downloadOverall('detail')}>
              <i className="fa-solid fa-list-check"></i> Overall Detailed History
              <i className="fa-solid fa-download" style={{ marginLeft: 8 }}></i>
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Class table */}
      <div className="fee-section">
        <div className="fee-table-head fee-hist-row">
          <div className="fee-th">S. No.</div>
          <div className="fee-th">Class / Section</div>
          <div className="fee-th fee-center">Total Students</div>
          <div className="fee-th fee-center">Download</div>
          <div className="fee-th fee-center">Details</div>
        </div>

        {classes.length === 0 ? (
          <div className="fee-empty">No classes available.</div>
        ) : classes.map((c, i) => {
          const isOpen = openKey === c.key;
          const students = studentsMap[c.key] || [];
          return (
            <div key={c.key} className="fee-rowwrap">
              <div
                className={`fee-row fee-hist-row${isOpen ? ' open' : ''}`}
                onClick={() => setOpenKey(isOpen ? null : c.key)}
              >
                <div className="fee-td" data-label="S. No."><span className="fee-row-icon">{i + 1}</span></div>
                <div className="fee-td" data-label="Class / Section">
                  <div className="fee-recv-clssec"><b>{c.cls}</b><span>Section {c.sec}</span></div>
                </div>
                <div className="fee-td fee-center" data-label="Total Students">
                  <span className="fee-count">{students.length}</span>
                </div>
                <div className="fee-td fee-center" data-label="Download" onClick={e => e.stopPropagation()}>
                  <Tooltip text={`Download class ${seg === 'detail' ? 'detailed history' : 'ledger summary'} (PDF)`}>
                    <button className="fee-iconbtn" onClick={() => downloadClass(c)}>
                      <i className="fa-solid fa-download"></i>
                    </button>
                  </Tooltip>
                </div>
                <div className="fee-td fee-center" data-label="Details">
                  <Tooltip text={isOpen ? 'Hide students' : 'Show students'}>
                    <span className={`fee-chevbtn${isOpen ? ' open' : ''}`}>
                      <i className="fa-solid fa-chevron-down fee-chev"></i>
                    </span>
                  </Tooltip>
                </div>
              </div>

              <div className={`fee-detail${isOpen ? ' open' : ''}`}>
                <div className="fee-detail-inner">
                  <div className="fee-stbl-wrap">
                    <table className="fee-stbl">
                      {seg === 'ledger' ? (
                        <thead>
                          <tr>
                            <th>Reg No</th>
                            <th>Name</th>
                            <th>Class / Sec</th>
                            <th className="fee-right">Total Fee</th>
                            <th className="fee-right">Received</th>
                            <th className="fee-right">Pending</th>
                            <th>Last Receiving</th>
                            <th>Received By</th>
                            <th className="fee-center">View</th>
                          </tr>
                        </thead>
                      ) : (
                        <thead>
                          <tr>
                            <th>Reg No</th>
                            <th>Name</th>
                            <th>Class / Sec</th>
                            <th className="fee-center">Total Challans</th>
                            <th className="fee-right">Total Received</th>
                            <th className="fee-right">Total Pending</th>
                            <th className="fee-center">View</th>
                          </tr>
                        </thead>
                      )}
                      <tbody>
                        {students.length === 0 ? (
                          <tr><td colSpan="9" className="fee-stbl-empty">No students in this section.</td></tr>
                        ) : students.map(s => {
                          const months = historyFor(c, s);
                          const t = feeHistTotals(months);
                          if (seg === 'ledger') {
                            return (
                              <tr key={s.reg} id={`fee-hist-st-${c.key}-${s.reg}`}>
                                <td>{s.reg}</td>
                                <td>
                                  <b>{s.name}</b>
                                  <span className="fee-sub-eq">s/o {s.father || '—'}</span>
                                </td>
                                <td>{c.cls} / {c.sec}</td>
                                <td className="fee-right">{money(t.fee)}</td>
                                <td className="fee-right"><span className="fee-paid-amt">{money(t.recv)}</span></td>
                                <td className="fee-right">{t.pend > 0 ? <span className="fee-neg">{money(t.pend)}</span> : '0'}</td>
                                <td>
                                  {t.lastDate !== '—' ? (
                                    <>
                                      {t.lastDate}
                                      {t.lastTime !== '—' && <span className="fee-sub-eq">{fmtTime12(t.lastTime)}</span>}
                                    </>
                                  ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                </td>
                                <td>{t.lastBy !== '—' ? t.lastBy : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                                <td className="fee-center">
                                  <div className="fee-recv-acts">
                                    <Tooltip text={`View ${s.name}'s ledger`}>
                                      <button type="button" className="fee-hist-vbtn" onClick={() => openDetail('ledger', c, s)}>
                                        <i className="fa-solid fa-eye"></i> View
                                      </button>
                                    </Tooltip>
                                    <Tooltip text={`Download ${s.name}'s ledger summary`}>
                                      <button className="fee-iconbtn tiny" onClick={() => downloadStudent('ledger', c, s)}>
                                        <i className="fa-solid fa-download"></i>
                                      </button>
                                    </Tooltip>
                                  </div>
                                </td>
                              </tr>
                            );
                          }
                          return (
                            <tr key={s.reg} id={`fee-hist-st-${c.key}-${s.reg}`}>
                              <td>{s.reg}</td>
                              <td>
                                <b>{s.name}</b>
                                <span className="fee-sub-eq">s/o {s.father || '—'}</span>
                              </td>
                              <td>{c.cls} / {c.sec}</td>
                              <td className="fee-center"><span className="fee-count">{t.challans}</span></td>
                              <td className="fee-right"><span className="fee-paid-amt">{money(t.recv)}</span></td>
                              <td className="fee-right">{t.pend > 0 ? <span className="fee-neg">{money(t.pend)}</span> : '0'}</td>
                              <td className="fee-center">
                                <div className="fee-recv-acts">
                                  <Tooltip text={`View ${s.name}'s detailed history`}>
                                    <button type="button" className="fee-hist-vbtn" onClick={() => openDetail('detail', c, s)}>
                                      <i className="fa-solid fa-eye"></i> View
                                    </button>
                                  </Tooltip>
                                  <Tooltip text={`Download ${s.name}'s detailed history`}>
                                    <button className="fee-iconbtn tiny" onClick={() => downloadStudent('detail', c, s)}>
                                      <i className="fa-solid fa-download"></i>
                                    </button>
                                  </Tooltip>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <FeeHistoryDetailModal
        cfg={detail}
        onClose={() => setDetail(null)}
        year={appliedYear}
        onDownloadStudent={() => detail && downloadStudent(detail.mode, detail.c, detail.s)}
        onDownloadChallan={(mo) => detail && downloadMonthChallan(detail.c, detail.s, mo)}
        onDownloadSlip={(mo) => detail && downloadMonthSlip(detail.c, detail.s, mo)}
      />
    </>
  );
}

/* ─── History view modal ─── */
function FeeHistoryDetailModal({ cfg, onClose, year, onDownloadStudent, onDownloadChallan, onDownloadSlip }) {
  useEffect(() => {
    if (!cfg) return undefined;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [cfg, onClose]);

  if (!cfg) return null;

  const { mode, c, s, months, totals, period } = cfg;

  return createPortal(
    <div className="fee-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fee-modal lg">
        <div className="fee-modal-head">
          <div className="fee-modal-head-title">
            <div className="fee-modal-head-icon"><i className="fa-solid fa-clock-rotate-left"></i></div>
            <div>
              <div className="fee-modal-title">
                Fee History of <em>{s.name}</em>
              </div>
              <div className="fee-modal-sub">
                Reg {s.reg} · S/O {s.father || '—'} · {c.cls} / {c.sec} · {period}
              </div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="fee-modal-close" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </Tooltip>
        </div>

        <div className="fee-modal-body">
          <div className="fee-hist-ledger-meta">
            {mode === 'ledger' ? (
              <>
                <div className="fee-hist-metacard"><div className="l">Total Fee</div><div className="v">{money(totals.fee)}</div></div>
                <div className="fee-hist-metacard"><div className="l">Received</div><div className="v green">{money(totals.recv)}</div></div>
                <div className="fee-hist-metacard"><div className="l">Pending</div><div className="v red">{money(totals.pend)}</div></div>
                <div className="fee-hist-metacard"><div className="l">Months</div><div className="v">{totals.challans}</div></div>
              </>
            ) : (
              <>
                <div className="fee-hist-metacard"><div className="l">Total Challans</div><div className="v">{totals.challans}</div></div>
                <div className="fee-hist-metacard"><div className="l">Total Received</div><div className="v green">{money(totals.recv)}</div></div>
                <div className="fee-hist-metacard"><div className="l">Total Pending</div><div className="v red">{money(totals.pend)}</div></div>
                <div className="fee-hist-metacard"><div className="l">Paid / Unpaid</div><div className="v">{totals.paidCount} / {totals.unpaid}</div></div>
              </>
            )}
          </div>

          {mode === 'ledger' ? (
            <div className="fee-stbl-wrap" style={{ marginTop: 14 }}>
              <table className="fee-stbl">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="fee-right">Challan Amount</th>
                    <th className="fee-right">Received</th>
                    <th className="fee-right">Pending</th>
                    <th>Receiving Date</th>
                    <th>Received By</th>
                    <th>Payment Method</th>
                    <th className="fee-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map(mo => (
                    <tr key={mo.m}>
                      <td><b>{mo.monthName}</b> {year}</td>
                      <td className="fee-right">{money(mo.challanAmt)}</td>
                      <td className="fee-right">{mo.received > 0 ? <span className="fee-paid-amt">{money(mo.received)}</span> : '0'}</td>
                      <td className="fee-right">{mo.pending > 0 ? <span className="fee-neg">{money(mo.pending)}</span> : '0'}</td>
                      <td>
                        {mo.recvDate !== '—' ? (
                          <>
                            {mo.recvDate}
                            {mo.time !== '—' && <span className="fee-sub-eq">{fmtTime12(mo.time)}</span>}
                          </>
                        ) : '—'}
                      </td>
                      <td>{mo.recvBy}</td>
                      <td>{mo.method}</td>
                      <td className="fee-center">{statusBadge(mo.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ marginTop: 14 }}>
              {months.map(mo => (
                <div key={mo.m} className="fee-month-card">
                  <div className="fee-month-head">
                    <div className="fee-month-title">
                      <span className="mm">{mo.monthName.slice(0, 3)}</span> {mo.monthName} {year}
                    </div>
                    {statusBadge(mo.status)}
                  </div>
                  <div className="fee-month-body">
                    <div className="fee-month-col">
                      <h5>
                        <span><i className="fa-solid fa-file-invoice"></i> Challan Details</span>
                        <Tooltip text={`Download ${mo.monthName} challan copy`}>
                          <button className="fee-iconbtn tiny" onClick={() => onDownloadChallan(mo)}>
                            <i className="fa-solid fa-download"></i>
                          </button>
                        </Tooltip>
                      </h5>
                      <div className="fee-kv">
                        <span className="k">Challan #</span><span className="v">{mo.challanNo}</span>
                        <span className="k">Challan Date</span><span className="v">{mo.challanDate}</span>
                        <span className="k">Due Date</span><span className="v">{mo.dueDate}</span>
                        <span className="k">Total Challan</span><span className="v">{money(mo.challanAmt)}</span>
                      </div>
                    </div>
                    <div className="fee-month-col">
                      <h5>
                        <span><i className="fa-solid fa-hand-holding-dollar"></i> Receiving Details</span>
                        {mo.received > 0 && (
                          <Tooltip text={`Download ${mo.monthName} receiving slip`}>
                            <button className="fee-iconbtn tiny" onClick={() => onDownloadSlip(mo)}>
                              <i className="fa-solid fa-download"></i>
                            </button>
                          </Tooltip>
                        )}
                      </h5>
                      <div className="fee-kv">
                        <span className="k">Received</span><span className="v green">{money(mo.received)}</span>
                        <span className="k">Pending</span><span className={`v${mo.pending > 0 ? ' red' : ''}`}>{money(mo.pending)}</span>
                        <span className="k">Receiving Date</span>
                        <span className="v">
                          {mo.recvDate !== '—' ? (mo.time !== '—' ? `${mo.recvDate} · ${fmtTime12(mo.time)}` : mo.recvDate) : '—'}
                        </span>
                        <span className="k">Received By</span><span className="v">{mo.recvBy}</span>
                        <span className="k">Payment Method</span><span className="v">{mo.method}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="fee-modal-foot">
          <Tooltip text="Close">
            <button className="fee-btn fee-btn-ghost" onClick={onClose}>Close</button>
          </Tooltip>
          <Tooltip text={`Download ${mode === 'detail' ? 'detailed history' : 'ledger summary'} as PDF`}>
            <button className="fee-btn fee-btn-primary" onClick={onDownloadStudent}>
              <i className="fa-solid fa-download"></i> Download {mode === 'detail' ? 'Detailed' : 'Ledger'} (PDF)
            </button>
          </Tooltip>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── Print HTML builders ─── */
const HIST_REPORT_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;color:#0F172A;background:#fff;font-size:12px;padding:18px;}
.hist-page{max-width:1100px;margin:0 auto 14px;padding:0;}
.hist-head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1E3A8A;padding-bottom:14px;margin-bottom:16px;}
.hist-school{font-size:18px;font-weight:800;color:#1E3A8A;}
.hist-title{font-size:14px;font-weight:700;color:#1E40AF;margin-top:6px;}
.hist-meta{font-size:11px;color:#64748B;text-align:right;line-height:1.55;}
.hist-band{background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;padding:9px 14px;border-radius:6px;font-weight:800;margin:12px 0 8px;font-size:13px;}
.hist-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;}
.hist-card{border:1px solid #E5E7EB;border-radius:8px;padding:8px 10px;background:#F8FAFF;}
.hist-card .l{font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.3px;}
.hist-card .v{font-size:14px;font-weight:800;color:#0F172A;margin-top:2px;}
.hist-card .v.green{color:#16A34A;}
.hist-card .v.red{color:#DC2626;}
table{width:100%;border-collapse:collapse;font-size:11px;}
thead th{background:#EFF6FF;color:#1E3A5F;font-weight:800;text-align:left;padding:8px 10px;border-bottom:1.5px solid #BFDBFE;font-size:10px;text-transform:uppercase;letter-spacing:.4px;}
thead th.right{text-align:right;} thead th.center{text-align:center;}
tbody td{padding:7px 10px;border-bottom:1px solid #E5E7EB;vertical-align:top;}
tbody td.right{text-align:right;font-variant-numeric:tabular-nums;}
tbody td.center{text-align:center;}
tbody td.green{color:#16A34A;font-weight:700;}
tbody td.red{color:#DC2626;font-weight:700;}
tfoot td{padding:9px 10px;font-weight:800;background:#F8FAFF;border-top:2px solid #1E3A8A;}
tfoot td.right{text-align:right;}
.hist-stat{display:inline-block;padding:2px 9px;border-radius:999px;font-weight:800;font-size:10px;}
.hist-stat.full{background:rgba(22,163,74,.12);color:#16A34A;}
.hist-stat.partial{background:rgba(217,119,6,.12);color:#D97706;}
.hist-stat.none{background:rgba(220,38,38,.08);color:#DC2626;}
.hist-page + .hist-page{page-break-before:always;}
.hist-mc{border:1px solid #E5E7EB;border-radius:8px;margin-bottom:10px;page-break-inside:avoid;}
.hist-mc-head{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#F8FAFF;border-bottom:1px solid #E5E7EB;border-radius:8px 8px 0 0;}
.hist-mc-title{font-size:13px;font-weight:800;color:#1E3A8A;}
.hist-mc-body{display:grid;grid-template-columns:1fr 1fr;gap:0;}
.hist-mc-col{padding:10px 12px;}
.hist-mc-col + .hist-mc-col{border-left:1px solid #E5E7EB;}
.hist-mc-col h5{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:#1E3A8A;margin-bottom:6px;}
.hist-kv{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:11px;}
.hist-kv .k{color:#64748B;}
.hist-kv .v{text-align:right;font-weight:700;color:#0F172A;}
.hist-kv .v.green{color:#16A34A;}
.hist-kv .v.red{color:#DC2626;}
@page{size:A4;margin:14mm;}
@media print{body{padding:0;}-webkit-print-color-adjust:exact;print-color-adjust:exact;}
`;

const statBadge = (st) => `<span class="hist-stat ${st === 'full' ? 'full' : st === 'partial' ? 'partial' : 'none'}">${st === 'full' ? 'Fully Received' : st === 'partial' ? 'Partial' : 'Not Received'}</span>`;

function histStudentLedgerRows(months, year) {
  return months.map(mo => `
    <tr>
      <td><b>${escHtml(mo.monthName)}</b> ${escHtml(year)}</td>
      <td class="right">${mo.challanAmt.toLocaleString('en-PK')}</td>
      <td class="right green">${mo.received > 0 ? mo.received.toLocaleString('en-PK') : '0'}</td>
      <td class="right ${mo.pending > 0 ? 'red' : ''}">${mo.pending.toLocaleString('en-PK')}</td>
      <td>${escHtml(mo.recvDate)}${mo.time !== '—' ? `<br/><span style="color:#64748B;font-size:10px">${escHtml(fmtTime12(mo.time))}</span>` : ''}</td>
      <td>${escHtml(mo.recvBy)}</td>
      <td>${escHtml(mo.method)}</td>
      <td class="center">${statBadge(mo.status)}</td>
    </tr>`).join('');
}

function buildHistStudentReportHTML({ mode, c, s, months, period }) {
  const t = feeHistTotals(months);
  const today = new Date().toLocaleDateString('en-GB');
  if (mode === 'ledger') {
    return `<style>${HIST_REPORT_CSS}</style><body><div class="hist-page">
  <div class="hist-head">
    <div>
      <div class="hist-school">${escHtml(FEE_SCHOOL.name)}</div>
      <div class="hist-title">Fee Ledger Summary — ${escHtml(s.name)}</div>
    </div>
    <div class="hist-meta">Generated: ${today}<br/>Reg: ${escHtml(s.reg)} · ${escHtml(c.cls)} / ${escHtml(c.sec)}<br/>Period: ${escHtml(period)}</div>
  </div>
  <div class="hist-cards">
    <div class="hist-card"><div class="l">Total Fee</div><div class="v">${t.fee.toLocaleString('en-PK')}</div></div>
    <div class="hist-card"><div class="l">Received</div><div class="v green">${t.recv.toLocaleString('en-PK')}</div></div>
    <div class="hist-card"><div class="l">Pending</div><div class="v red">${t.pend.toLocaleString('en-PK')}</div></div>
    <div class="hist-card"><div class="l">Months</div><div class="v">${t.challans}</div></div>
  </div>
  <table>
    <thead><tr><th>Month</th><th class="right">Challan Amount</th><th class="right">Received</th><th class="right">Pending</th><th>Receiving Date</th><th>Received By</th><th>Payment Method</th><th class="center">Status</th></tr></thead>
    <tbody>${histStudentLedgerRows(months, '')}</tbody>
  </table>
</div>`;
  }
  /* Detailed mode — month cards */
  const cards = months.map(mo => `
    <div class="hist-mc">
      <div class="hist-mc-head">
        <div class="hist-mc-title">${escHtml(mo.monthName)}</div>
        ${statBadge(mo.status)}
      </div>
      <div class="hist-mc-body">
        <div class="hist-mc-col">
          <h5>Challan Details</h5>
          <div class="hist-kv">
            <span class="k">Challan #</span><span class="v">${escHtml(mo.challanNo)}</span>
            <span class="k">Challan Date</span><span class="v">${escHtml(mo.challanDate)}</span>
            <span class="k">Due Date</span><span class="v">${escHtml(mo.dueDate)}</span>
            <span class="k">Total Challan</span><span class="v">${mo.challanAmt.toLocaleString('en-PK')}</span>
          </div>
        </div>
        <div class="hist-mc-col">
          <h5>Receiving Details</h5>
          <div class="hist-kv">
            <span class="k">Received</span><span class="v green">${mo.received.toLocaleString('en-PK')}</span>
            <span class="k">Pending</span><span class="v ${mo.pending > 0 ? 'red' : ''}">${mo.pending.toLocaleString('en-PK')}</span>
            <span class="k">Date</span><span class="v">${escHtml(mo.recvDate)}${mo.time !== '—' ? ` · ${escHtml(fmtTime12(mo.time))}` : ''}</span>
            <span class="k">Received By</span><span class="v">${escHtml(mo.recvBy)}</span>
            <span class="k">Method</span><span class="v">${escHtml(mo.method)}</span>
          </div>
        </div>
      </div>
    </div>`).join('');
  return `<style>${HIST_REPORT_CSS}</style><body><div class="hist-page">
  <div class="hist-head">
    <div>
      <div class="hist-school">${escHtml(FEE_SCHOOL.name)}</div>
      <div class="hist-title">Detailed Fee History — ${escHtml(s.name)}</div>
    </div>
    <div class="hist-meta">Generated: ${today}<br/>Reg: ${escHtml(s.reg)} · ${escHtml(c.cls)} / ${escHtml(c.sec)}<br/>Period: ${escHtml(period)}</div>
  </div>
  <div class="hist-cards">
    <div class="hist-card"><div class="l">Total Challans</div><div class="v">${t.challans}</div></div>
    <div class="hist-card"><div class="l">Total Received</div><div class="v green">${t.recv.toLocaleString('en-PK')}</div></div>
    <div class="hist-card"><div class="l">Total Pending</div><div class="v red">${t.pend.toLocaleString('en-PK')}</div></div>
    <div class="hist-card"><div class="l">Paid / Unpaid</div><div class="v">${t.paidCount} / ${t.unpaid}</div></div>
  </div>
  ${cards}
</div>`;
}

function buildHistClassReportHTML({ mode, c, rows, period }) {
  const today = new Date().toLocaleDateString('en-GB');
  const totals = rows.reduce((a, { months }) => {
    const t = feeHistTotals(months);
    return { fee: a.fee + t.fee, recv: a.recv + t.recv, pend: a.pend + t.pend };
  }, { fee: 0, recv: 0, pend: 0 });

  const studentRows = rows.map(({ s, months }, i) => {
    const t = feeHistTotals(months);
    if (mode === 'ledger') {
      return `<tr>
        <td>${i + 1}</td>
        <td>${escHtml(s.reg)}</td>
        <td><b>${escHtml(s.name)}</b><br/><span style="color:#64748B;font-size:10px">s/o ${escHtml(s.father || '—')}</span></td>
        <td class="right">${t.fee.toLocaleString('en-PK')}</td>
        <td class="right green">${t.recv.toLocaleString('en-PK')}</td>
        <td class="right ${t.pend > 0 ? 'red' : ''}">${t.pend.toLocaleString('en-PK')}</td>
        <td>${t.lastDate !== '—' ? escHtml(t.lastDate) : '—'}</td>
        <td>${escHtml(t.lastBy)}</td>
      </tr>`;
    }
    return `<tr>
      <td>${i + 1}</td>
      <td>${escHtml(s.reg)}</td>
      <td><b>${escHtml(s.name)}</b><br/><span style="color:#64748B;font-size:10px">s/o ${escHtml(s.father || '—')}</span></td>
      <td class="center">${t.challans}</td>
      <td class="right green">${t.recv.toLocaleString('en-PK')}</td>
      <td class="right ${t.pend > 0 ? 'red' : ''}">${t.pend.toLocaleString('en-PK')}</td>
      <td class="center">${t.paidCount} / ${t.unpaid}</td>
    </tr>`;
  }).join('');

  return `<style>${HIST_REPORT_CSS}</style><body><div class="hist-page">
  <div class="hist-head">
    <div>
      <div class="hist-school">${escHtml(FEE_SCHOOL.name)}</div>
      <div class="hist-title">Class ${mode === 'detail' ? 'Detailed History' : 'Ledger Summary'} — ${escHtml(c.cls)} (${escHtml(c.sec)})</div>
    </div>
    <div class="hist-meta">Generated: ${today}<br/>Students: ${rows.length}<br/>Period: ${escHtml(period)}</div>
  </div>
  <div class="hist-band">${escHtml(c.cls)} — Section ${escHtml(c.sec)}</div>
  <table>
    <thead>
      ${mode === 'ledger'
        ? `<tr><th style="width:36px">#</th><th style="width:120px">Reg No</th><th>Name</th><th class="right" style="width:120px">Total Fee</th><th class="right" style="width:110px">Received</th><th class="right" style="width:110px">Pending</th><th style="width:110px">Last Date</th><th style="width:130px">Received By</th></tr>`
        : `<tr><th style="width:36px">#</th><th style="width:120px">Reg No</th><th>Name</th><th class="center" style="width:90px">Challans</th><th class="right" style="width:120px">Received</th><th class="right" style="width:120px">Pending</th><th class="center" style="width:110px">Paid/Unpaid</th></tr>`}
    </thead>
    <tbody>${studentRows}</tbody>
    ${mode === 'ledger' ? `
    <tfoot>
      <tr>
        <td colspan="3">Total</td>
        <td class="right">${totals.fee.toLocaleString('en-PK')}</td>
        <td class="right">${totals.recv.toLocaleString('en-PK')}</td>
        <td class="right">${totals.pend.toLocaleString('en-PK')}</td>
        <td colspan="2"></td>
      </tr>
    </tfoot>` : ''}
  </table>
</div>`;
}

function buildHistOverallReportHTML({ mode, blocks, period }) {
  const today = new Date().toLocaleDateString('en-GB');
  const grand = blocks.reduce((a, b) => {
    const sub = b.rows.reduce((x, { months }) => {
      const t = feeHistTotals(months);
      return { fee: x.fee + t.fee, recv: x.recv + t.recv, pend: x.pend + t.pend };
    }, { fee: 0, recv: 0, pend: 0 });
    return { fee: a.fee + sub.fee, recv: a.recv + sub.recv, pend: a.pend + sub.pend };
  }, { fee: 0, recv: 0, pend: 0 });

  const pages = blocks.map(({ c, rows }) => buildHistClassReportHTML({ mode, c, rows, period })).join('');

  return `<style>${HIST_REPORT_CSS}</style><body>
  <div class="hist-page">
    <div class="hist-head">
      <div>
        <div class="hist-school">${escHtml(FEE_SCHOOL.name)}</div>
        <div class="hist-title">Overall ${mode === 'detail' ? 'Detailed Fee History' : 'Fee Ledger Summary'}</div>
      </div>
      <div class="hist-meta">Generated: ${today}<br/>Classes: ${blocks.length}<br/>Period: ${escHtml(period)}</div>
    </div>
    <div class="hist-band">Grand Totals</div>
    <div class="hist-cards">
      <div class="hist-card"><div class="l">Total Fee</div><div class="v">${grand.fee.toLocaleString('en-PK')}</div></div>
      <div class="hist-card"><div class="l">Received</div><div class="v green">${grand.recv.toLocaleString('en-PK')}</div></div>
      <div class="hist-card"><div class="l">Pending</div><div class="v red">${grand.pend.toLocaleString('en-PK')}</div></div>
      <div class="hist-card"><div class="l">Classes</div><div class="v">${blocks.length}</div></div>
    </div>
  </div>
  ${pages.replace(/<style>[\s\S]*?<\/style><body>/, '')}`;
}

/* Re-print a single-month receipt slip using the synthesised history row
   (head amounts are not stored for past months, so this is a summary
   slip with the month's total payable / received / remaining). */
function buildHistMonthSlipHTML({ c, s, mo, year, size = 'a4' }) {
  if (size === 'thermal') {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escHtml(`${mo.monthName} Slip — ${s.name}`)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Plus Jakarta Sans','Segoe UI',sans-serif;color:#111;background:#fff;padding:6px;font-size:11px;}
  .th-slip{width:80mm;margin:0 auto;padding:5mm 4mm;}
  .th-school{font-size:13.5px;font-weight:800;text-align:center;}
  .th-tag{font-size:9.5px;letter-spacing:1px;text-transform:uppercase;color:#555;text-align:center;margin-top:2px;padding-bottom:6px;border-bottom:1.5px solid #111;margin-bottom:6px;}
  .th-kv{display:grid;grid-template-columns:auto 1fr;column-gap:6px;font-size:10.5px;margin-bottom:6px;}
  .th-kv .k{color:#666;} .th-kv .v{text-align:right;font-weight:700;}
  .th-net{display:flex;justify-content:space-between;background:#111;color:#fff;padding:6px 10px;border-radius:3px;font-weight:800;font-size:12px;margin:6px 0;}
  @page{size:80mm auto;margin:0;}
</style></head><body>
<div class="th-slip">
  <div class="th-school">${escHtml(FEE_SCHOOL.name)}</div>
  <div class="th-tag">Fee Received Slip</div>
  <div class="th-kv">
    <span class="k">Receipt</span><span class="v">${escHtml(mo.challanNo)}</span>
    <span class="k">Date</span><span class="v">${escHtml(mo.recvDate)}${mo.time !== '—' ? ' · ' + escHtml(fmtTime12(mo.time)) : ''}</span>
    <span class="k">Period</span><span class="v">${escHtml(mo.monthName)} ${escHtml(year)}</span>
    <span class="k">Student</span><span class="v">${escHtml(s.name)}</span>
    <span class="k">Class</span><span class="v">${escHtml(c.cls)} (${escHtml(c.sec)})</span>
    <span class="k">Reg</span><span class="v">${escHtml(s.reg)}</span>
    <span class="k">Method</span><span class="v">${escHtml(mo.method)}</span>
    <span class="k">Received By</span><span class="v">${escHtml(mo.recvBy)}</span>
  </div>
  <div class="th-kv">
    <span class="k">Total</span><span class="v">Rs. ${mo.challanAmt.toLocaleString('en-PK')}</span>
    <span class="k">Pending</span><span class="v">Rs. ${mo.pending.toLocaleString('en-PK')}</span>
  </div>
  <div class="th-net"><span>Amount Received</span><span>Rs. ${mo.received.toLocaleString('en-PK')}</span></div>
</div>
</body></html>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escHtml(`${mo.monthName} Slip — ${s.name}`)}</title>
<style>
  body{margin:0;font-family:'Plus Jakarta Sans','Segoe UI',sans-serif;background:#F1F3F8;padding:18px;color:#111;}
  .fee-slip-doc{background:#fff;color:#111;border:1px solid #ddd;border-radius:10px;padding:20px;max-width:420px;margin:0 auto;}
  .fee-slip-head{text-align:center;border-bottom:1.5px solid #111;padding-bottom:10px;margin-bottom:12px;}
  .fee-slip-school{font-size:16px;font-weight:800;}
  .fee-slip-tag{font-size:11px;color:#555;letter-spacing:1px;text-transform:uppercase;margin-top:3px;}
  .fee-slip-kv{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:12px;margin-bottom:12px;}
  .fee-slip-kv .k{color:#666;}
  .fee-slip-kv .v{text-align:right;font-weight:700;}
  .fee-slip-tbl{width:100%;border-collapse:collapse;font-size:11.5px;margin-bottom:10px;}
  .fee-slip-tbl td{border-bottom:1px solid #eee;padding:5px 4px;text-align:right;}
  .fee-slip-tbl td:first-child{text-align:left;}
  .fee-slip-net{display:flex;justify-content:space-between;background:#111;color:#fff;padding:8px 12px;border-radius:4px;font-weight:800;}
  @page{size:A4;margin:14mm;}
</style></head><body>
<div class="fee-slip-doc">
  <div class="fee-slip-head">
    <div class="fee-slip-school">${escHtml(FEE_SCHOOL.name)}</div>
    <div class="fee-slip-tag">Fee Received Slip</div>
  </div>
  <div class="fee-slip-kv">
    <span class="k">Receipt No</span><span class="v">${escHtml(mo.challanNo)}</span>
    <span class="k">Date</span><span class="v">${escHtml(mo.recvDate)}${mo.time !== '—' ? `  ·  ${escHtml(fmtTime12(mo.time))}` : ''}</span>
    <span class="k">Period</span><span class="v">${escHtml(mo.monthName)} ${escHtml(year)}</span>
    <span class="k">Student</span><span class="v">${escHtml(s.name)}</span>
    <span class="k">Father</span><span class="v">${escHtml(s.father || '—')}</span>
    <span class="k">Class</span><span class="v">${escHtml(c.cls)} (${escHtml(c.sec)})</span>
    <span class="k">Reg No</span><span class="v">${escHtml(s.reg)}</span>
    <span class="k">Method</span><span class="v">${escHtml(mo.method)}</span>
    <span class="k">Received By</span><span class="v">${escHtml(mo.recvBy)}</span>
  </div>
  <table class="fee-slip-tbl">
    <tbody>
      <tr><td>Total Challan</td><td>${mo.challanAmt.toLocaleString('en-PK')}</td></tr>
      <tr><td>Pending</td><td>${mo.pending.toLocaleString('en-PK')}</td></tr>
    </tbody>
  </table>
  <div class="fee-slip-net">
    <span>Amount Received</span>
    <span>Rs. ${mo.received.toLocaleString('en-PK')}</span>
  </div>
</div>
</body></html>`;
}

/* ═══════════════════════════════════════════════════════════════════
   FEE REPORTS TAB — 5 cross-cutting report categories rendered as
   selectable category chips with a body panel per category. Each
   panel ships a KPI strip, segment-aware filters, an expandable
   class table (where applicable), and Preview / PDF download CTAs.

   1. Fee Defaulter List         — all / monthly defaulters
   2. General Fee Collections    — daily / monthly / paid students
   3. Head-Wise Fee Collection   — student / class
   4. Aging / Outstanding        — 30 / 60 / 90+ day buckets
   5. Collection vs Expected     — realisation %, payment-mode mix
   ═══════════════════════════════════════════════════════════════════ */

const FEE_REPORT_CATS = [
  { id: 'defaulter',  ic: 'fa-user-clock',          name: 'Fee Defaulter List',       desc: 'All & monthly defaulters, class-wise' },
  { id: 'collection', ic: 'fa-hand-holding-dollar', name: 'General Fee Collections',  desc: 'Daily, monthly & paid-student lists' },
  { id: 'headwise',   ic: 'fa-layer-group',         name: 'Head-Wise Fee Collection', desc: 'Student-wise & class-wise by fee head' },
  { id: 'aging',      ic: 'fa-hourglass-half',      name: 'Aging / Outstanding',      desc: '30 / 60 / 90+ day overdue analysis' },
  { id: 'summary',    ic: 'fa-chart-pie',           name: 'Collection vs Expected',   desc: 'Realisation %, payment-mode breakdown' },
];

/* Pretty method chip — colour-codes Cash / Online / Bank / OneLink etc.
   so reports show the channel at a glance, not just plain text. */
const METHOD_META = {
  'Cash':            { ic: 'fa-money-bill-wave',    fg: '#16A34A', bg: 'rgba(22,163,74,.12)',  bd: 'rgba(22,163,74,.28)' },
  'Online / App':    { ic: 'fa-bolt',               fg: '#D97706', bg: 'rgba(217,119,6,.12)',  bd: 'rgba(217,119,6,.28)' },
  'OneLink / Bank':  { ic: 'fa-building-columns',   fg: '#7C3AED', bg: 'rgba(124,58,237,.12)', bd: 'rgba(124,58,237,.28)' },
  'Bank Transfer':   { ic: 'fa-building-columns',   fg: '#1E3A8A', bg: 'rgba(30,58,138,.10)',  bd: 'rgba(30,58,138,.25)' },
  'Card':            { ic: 'fa-credit-card',        fg: '#2563EB', bg: 'rgba(37,99,235,.12)',  bd: 'rgba(37,99,235,.28)' },
  'Cheque':          { ic: 'fa-money-check',        fg: '#6366F1', bg: 'rgba(99,102,241,.12)', bd: 'rgba(99,102,241,.28)' },
};
function MethodChip({ method, source }) {
  const isOnelink = source === 'onelink' || source === 'bank';
  const label = isOnelink ? 'OneLink / Bank' : (method || 'Cash');
  const meta  = METHOD_META[label] || METHOD_META['Cash'];
  return (
    <span className="fee-method-chip" style={{ color: meta.fg, background: meta.bg, borderColor: meta.bd }}>
      <i className={`fa-solid ${meta.ic}`}></i> {label}
    </span>
  );
}
function methodChipHTML(method, source) {
  const isOnelink = source === 'onelink' || source === 'bank';
  const label = isOnelink ? 'OneLink / Bank' : (method || 'Cash');
  const meta  = METHOD_META[label] || METHOD_META['Cash'];
  return `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;font-size:9.5px;font-weight:800;background:${meta.bg};color:${meta.fg};border:1px solid ${meta.bd};white-space:nowrap"><i class="fa-solid ${meta.ic}"></i> ${escHtml(label)}</span>`;
}

/* Friendly "Received By" string — explicit on the payment, otherwise
   derived from the source (OneLink/Bank gateway vs Front Desk). */
const receivedBy = (p) => {
  if (!p) return '—';
  if (p.by) return p.by;
  if (p.source === 'onelink' || p.source === 'bank') return 'OneLink / Bank';
  return 'Front Desk';
};

function repAgingFromModel(m) {
  const p = m.remaining; if (p <= 0) return { cur: 0, d30: 0, d60: 0, d90: 0 };
  const cur = m.thisMonth > 0 ? Math.min(p, Math.round(m.thisMonth * 0.4)) : 0;
  let rest  = p - cur;
  const d30 = Math.round(rest * 0.35);
  const d60 = Math.round(rest * 0.30);
  const d90 = rest - d30 - d60;
  return { cur, d30, d60, d90 };
}

/* Payment-mode breakdown across ALL receipts. */
function repPayModesFromReceipts(receiptsList) {
  const map = {};
  (receiptsList || []).forEach(rec => {
    (rec.payments || []).forEach(p => {
      const k = p.method || 'Cash';
      map[k] = (map[k] || 0) + (+p.amount || 0);
    });
  });
  const icons = {
    'Cash':            'fa-money-bill-wave',
    'OneLink / Bank':  'fa-bolt',
    'Online / App':    'fa-bolt',
    'Bank Transfer':   'fa-building-columns',
    'Card':            'fa-credit-card',
    'Cheque':          'fa-money-check',
  };
  const cols = {
    'Cash':            '#16A34A',
    'OneLink / Bank':  '#D97706',
    'Online / App':    '#D97706',
    'Bank Transfer':   '#1E3A8A',
    'Card':            '#2563EB',
    'Cheque':          '#6366F1',
  };
  return Object.keys(map).map(k => ({ name: k, amt: map[k], ic: icons[k] || 'fa-money-bill', col: cols[k] || '#1E3A8A' }));
}

/* React context that lets every report panel read the page-level
   Colorful / Colorless style choice without prop-drilling. */
const FeeReportStyleContext = React.createContext('color');

function FeeReportsTab({ toast }) {
  const [current, setCurrent] = useState('defaulter');
  const [style, setStyle]     = useState('color'); // 'color' | 'bw'

  const onStyleKey = (e, value) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setStyle(value); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')   { e.preventDefault(); setStyle('color'); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw'); }
  };

  return (
    <FeeReportStyleContext.Provider value={style}>
      <div className="fee-rep-chips">
        {FEE_REPORT_CATS.map(r => (
          <Tooltip key={r.id} text={r.desc}>
            <button
              type="button"
              className={`fee-rep-chip${current === r.id ? ' active' : ''}`}
              onClick={() => setCurrent(r.id)}
            >
              <div className="fee-rep-chip-ic"><i className={`fa-solid ${r.ic}`}></i></div>
              <div>
                <div className="fee-rep-chip-name">{r.name}</div>
                <div className="fee-rep-chip-desc">{r.desc}</div>
              </div>
            </button>
          </Tooltip>
        ))}
      </div>

      {/* Page-level Colorful / Colorless toggle — applies to every report
          panel below via FeeReportStyleContext. */}
      <div
        className="fee-rep-style-row"
        role="radiogroup"
        aria-label="Report Style"
      >
        <span className="fee-rep-style-lbl">Report Style</span>
        <div className="fee-rep-style-seg">
          <button
            type="button"
            className={`fee-rep-style-btn${style === 'color' ? ' on' : ''}`}
            onClick={() => setStyle('color')}
            role="radio"
            aria-checked={style === 'color'}
            tabIndex={style === 'color' ? 0 : -1}
            onKeyDown={(e) => onStyleKey(e, 'color')}
          >
            <i className="fa-solid fa-palette" aria-hidden="true"></i> Colorful
          </button>
          <button
            type="button"
            className={`fee-rep-style-btn${style === 'bw' ? ' on' : ''}`}
            onClick={() => setStyle('bw')}
            role="radio"
            aria-checked={style === 'bw'}
            tabIndex={style === 'bw' ? 0 : -1}
            onKeyDown={(e) => onStyleKey(e, 'bw')}
          >
            <i className="fa-solid fa-circle-half-stroke" aria-hidden="true"></i> Colorless
          </button>
        </div>
      </div>

      {current === 'defaulter'  && <ReportPanelDefaulter  toast={toast} />}
      {current === 'collection' && <ReportPanelCollection toast={toast} />}
      {current === 'headwise'   && <ReportPanelHeadwise   toast={toast} />}
      {current === 'aging'      && <ReportPanelAging      toast={toast} />}
      {current === 'summary'    && <ReportPanelSummary    toast={toast} />}
    </FeeReportStyleContext.Provider>
  );
}

function useReportData() {
  const { data: classes = [] }       = useAsync(feeService.getFeeClasses, []);
  const { data: studentsMap = {} }   = useAsync(feeService.getTransportFee, []);
  const { data: headsMap = {} }      = useAsync(feeService.getFeeHeads, []);
  const { data: settings = {} }      = useAsync(feeService.getFeeSettings, []);
  const { data: generatedInitial }   = useAsync(feeService.getGeneratedChallans, []);
  const { data: serverReceipts = [] } = useAsync(feeService.getReceipts, []);

  const [genSet] = useState(() => new Set(generatedInitial || []));
  useEffect(() => { if (generatedInitial && genSet.size === 0) generatedInitial.forEach(k => genSet.add(k)); }, [generatedInitial, genSet]);

  const monthIdx = 4; // May 2026 — matches the seed data
  const keyOf = (classKey, reg) => `${classKey}|${reg}|${monthIdx}`;

  const paymentsFor = useCallback((classKey, reg) => {
    const r = (serverReceipts || []).find(x => x.classKey === classKey && x.reg === reg && x.monthIdx === monthIdx);
    return r ? r.payments : [];
  }, [serverReceipts]);

  /* All (class, student, model) tuples — used by every report panel. */
  const allStudents = useMemo(() => {
    const out = [];
    classes.forEach(c => {
      (studentsMap[c.key] || []).forEach(s => {
        const m = recStudentModel({
          student: s, headsForClass: headsMap[c.key] || [],
          generated: !!generatedInitial && new Set(generatedInitial).has(keyOf(c.key, s.reg)),
          classDisc: {},
          payments: paymentsFor(c.key, s.reg),
        });
        const lastPay = (paymentsFor(c.key, s.reg)).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0] || null;
        out.push({ c, s, m, lastPay });
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classes, studentsMap, headsMap, generatedInitial, paymentsFor]);

  const totals = useMemo(() => {
    let exp = 0, recv = 0, pend = 0, disc = 0, adv = 0, def = 0, paid = 0;
    allStudents.forEach(({ m }) => {
      exp += m.payable; recv += m.paid; pend += m.remaining; disc += m.disc; adv += m.advance;
      if (m.remaining > 0) def += 1; else if (m.paid > 0) paid += 1;
    });
    return { exp, recv, pend, disc, adv, def, paid, n: allStudents.length };
  }, [allStudents]);

  return { classes, studentsMap, headsMap, settings, allStudents, totals, paymentsFor, serverReceipts };
}

/* ─── KPI strip helper ─── */
function repKpiStrip(items) {
  return (
    <div className="fee-kpis">
      {items.map(([cls, ic, label, val, meta], i) => (
        <div key={i} className={`fee-kpi ${cls}`}>
          <div className="fee-kpi-top">
            <span className="fee-kpi-label">{label}</span>
            <span className="fee-kpi-ic"><i className={`fa-solid ${ic}`}></i></span>
          </div>
          <div className="fee-kpi-val">{val}</div>
          {meta && <div className="fee-kpi-meta">{meta}</div>}
        </div>
      ))}
    </div>
  );
}
const fmtRs = (n) => `Rs. ${(Number(n) || 0).toLocaleString('en-PK')}`;

/* ─── Common Preview / PDF button group ─── */
function RepActions({ onPreview, onPdf }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <Tooltip text="Open A4 preview of this report">
        <button className="fee-btn fee-btn-primary" onClick={onPreview}>
          <i className="fa-solid fa-eye"></i> Preview
        </button>
      </Tooltip>
      <Tooltip text="Generate the A4 PDF (Save as PDF from the print window)">
        <button className="fee-btn fee-btn-ghost" onClick={onPdf}>
          <i className="fa-solid fa-file-pdf"></i> PDF
        </button>
      </Tooltip>
    </div>
  );
}

/* ════════════ 1. DEFAULTER LIST ════════════ */
function ReportPanelDefaulter({ toast }) {
  const { classes, studentsMap, allStudents, totals } = useReportData();
  const repStyle              = useContext(FeeReportStyleContext);
  const [seg, setSeg]         = useState('all');
  const [openKey, setOpenKey] = useState(null);
  const [month, setMonth]     = useState(FEE_MONTHS[4]);
  const [year, setYear]       = useState('2026');

  const downloadReport = (mode) => {
    const html = buildRepDefaulterHTML({ classes, studentsMap, allStudents, totals, month, year, scope: seg, isBW: repStyle === 'bw' });
    openPrintReport(html, `Defaulter List — ${seg === 'month' ? `${month} ${year}` : 'All'}`, toast, mode);
  };

  return (
    <>
      <div className="fee-seg">
        <button className={`fee-seg-btn${seg === 'all' ? ' active' : ''}`} onClick={() => setSeg('all')}>
          <i className="fa-solid fa-list"></i> All Fee Defaulters
        </button>
        <button className={`fee-seg-btn${seg === 'month' ? ' active' : ''}`} onClick={() => setSeg('month')}>
          <i className="fa-solid fa-calendar-day"></i> Monthly Fee Defaulters
        </button>
      </div>

      <div className="fee-info">
        <i className="fa-solid fa-circle-info"></i>
        <span>Defaulters are students with a positive pending balance. Open any class to see student dues; download a class-wise A4 report via Preview / PDF.</span>
      </div>

      {repKpiStrip([
        ['k-red',   'fa-user-clock',           'Total Defaulters', `${totals.def} students`, ''],
        ['k-amber', 'fa-money-bill-trend-up',  'Total Outstanding', fmtRs(totals.pend),       ''],
        ['k-blue',  'fa-users',                'Students Billed',   `${totals.n}`,            ''],
        ['k-green', 'fa-circle-check',         'Fully Cleared',     `${totals.paid} students`, ''],
      ])}

      <div className="fee-section fee-section--overflow">
        <div className="fee-section-body">
          <div className="fee-filters">
            <div className="fee-field">
              <span className="fee-label">Select Month</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={month} onChange={e => setMonth(e.target.value)}>
                  {FEE_MONTHS.map(m => <option key={m}>{m}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
            <div className="fee-field">
              <span className="fee-label">Year</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={year} onChange={e => setYear(e.target.value)}>
                  <option>2025</option><option>2026</option><option>2027</option>
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
            <RepActions onPreview={() => downloadReport('preview')} onPdf={() => downloadReport('pdf')} />
          </div>
        </div>
      </div>

      <div className="fee-section">
        <div className="fee-table-head fee-rep-clsrow-grid">
          <div className="fee-th">S. No.</div>
          <div className="fee-th">Class</div>
          <div className="fee-th fee-center">Section</div>
          <div className="fee-th fee-right">Total Pending</div>
          <div className="fee-th fee-center">Details</div>
        </div>
        {classes.map((c, i) => {
          const defs = (studentsMap[c.key] || []).map(s => {
            const m = allStudents.find(x => x.c.key === c.key && x.s.reg === s.reg)?.m;
            return m ? { s, m } : null;
          }).filter(x => x && x.m.remaining > 0);
          const pend  = defs.reduce((t, x) => t + x.m.remaining, 0);
          const isOpen = openKey === c.key;
          return (
            <div key={c.key} className="fee-rowwrap">
              <div className={`fee-row fee-rep-clsrow-grid${isOpen ? ' open' : ''}`} onClick={() => setOpenKey(isOpen ? null : c.key)}>
                <div className="fee-td"><span className="fee-row-icon">{i + 1}</span></div>
                <div className="fee-td fee-name">{c.cls}</div>
                <div className="fee-td fee-center"><span className="fee-tag">{c.sec}</span></div>
                <div className="fee-td fee-right">{pend > 0 ? <span className="fee-neg">{money(pend)}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</div>
                <div className="fee-td fee-center">
                  <span className={`fee-chevbtn${isOpen ? ' open' : ''}`}><i className="fa-solid fa-chevron-down fee-chev"></i></span>
                </div>
              </div>
              <div className={`fee-detail${isOpen ? ' open' : ''}`}>
                <div className="fee-detail-inner">
                  {defs.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 18, fontSize: 12.5 }}>No defaulters in this section.</div>
                  ) : (
                    <>
                      <div className="fee-detail-title"><i className="fa-solid fa-receipt"></i> Defaulter Report — {c.cls} ({c.sec})</div>
                      <div className="fee-stbl-wrap">
                        <table className="fee-stbl">
                          <thead>
                            <tr>
                              <th>Sn.</th>
                              <th>Student Name</th>
                              <th>Father</th>
                              <th>Reg No</th>
                              <th>Contact</th>
                              <th className="fee-right">Total Pending</th>
                            </tr>
                          </thead>
                          <tbody>
                            {defs.map((x, j) => (
                              <tr key={x.s.reg}>
                                <td className="fee-num">{j + 1}</td>
                                <td><b>{x.s.name}</b></td>
                                <td>{x.s.father || '—'}</td>
                                <td>{x.s.reg}</td>
                                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{studentPhone(x.s)}</td>
                                <td className="fee-right fee-neg">{money(x.m.remaining)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ════════════ 2. GENERAL FEE COLLECTIONS ════════════ */
function ReportPanelCollection({ toast }) {
  const { classes, studentsMap, allStudents, totals, paymentsFor } = useReportData();
  const repStyle        = useContext(FeeReportStyleContext);
  const [seg, setSeg]   = useState('daily');
  const [openKey, setOpenKey] = useState(null);
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate]     = useState(today);
  const [month, setMonth]   = useState(FEE_MONTHS[4]);
  const [from, setFrom]     = useState('2026-05-01');
  const [to, setTo]         = useState(today);

  const downloadReport = (mode) => {
    const html = buildRepCollectionHTML({ classes, studentsMap, allStudents, paymentsFor, seg, date, month, from, to, isBW: repStyle === 'bw' });
    openPrintReport(html, `Collection Report — ${seg === 'daily' ? date : seg === 'month' ? month : `${from} – ${to}`}`, toast, mode);
  };

  return (
    <>
      <div className="fee-seg">
        <button className={`fee-seg-btn${seg === 'daily' ? ' active' : ''}`} onClick={() => setSeg('daily')}>
          <i className="fa-solid fa-calendar-day"></i> Daily Collections
        </button>
        <button className={`fee-seg-btn${seg === 'month' ? ' active' : ''}`} onClick={() => setSeg('month')}>
          <i className="fa-solid fa-calendar-week"></i> Monthly Collections
        </button>
        <button className={`fee-seg-btn${seg === 'paid' ? ' active' : ''}`} onClick={() => setSeg('paid')}>
          <i className="fa-solid fa-user-check"></i> Paid Student List
        </button>
      </div>

      <div className="fee-info">
        <i className="fa-solid fa-circle-info"></i>
        <span>Collection reports show amounts actually received — by day, by month (voucher list) or as a paid-student roster.</span>
      </div>

      {repKpiStrip([
        ['k-green', 'fa-sack-dollar',           'Total Received',     fmtRs(totals.recv), ''],
        ['k-blue',  'fa-file-invoice-dollar',   'Expected (Billed)',  fmtRs(totals.exp),  ''],
        ['k-amber', 'fa-hand-holding-dollar',   'Discount Given',     fmtRs(totals.disc), ''],
        ['k-red',   'fa-clock',                 'Still Pending',      fmtRs(totals.pend), ''],
      ])}

      <div className="fee-section fee-section--overflow">
        <div className="fee-section-body">
          <div className="fee-filters">
            {seg === 'daily' && (
              <div className="fee-field">
                <span className="fee-label">Select Date</span>
                <input className="fee-input" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ minWidth: 200 }} />
              </div>
            )}
            {seg === 'month' && (
              <div className="fee-field">
                <span className="fee-label">Select Month</span>
                <div className="fee-select-wrap">
                  <select className="fee-select" value={month} onChange={e => setMonth(e.target.value)}>
                    {FEE_MONTHS.map(m => <option key={m}>{m}</option>)}
                  </select>
                  <i className="fa-solid fa-chevron-down"></i>
                </div>
              </div>
            )}
            {seg === 'paid' && (
              <>
                <div className="fee-field">
                  <span className="fee-label">From Date</span>
                  <input className="fee-input" type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ minWidth: 160 }} />
                </div>
                <div className="fee-field">
                  <span className="fee-label">To Date</span>
                  <input className="fee-input" type="date" value={to} onChange={e => setTo(e.target.value)} style={{ minWidth: 160 }} />
                </div>
              </>
            )}
            <RepActions onPreview={() => downloadReport('preview')} onPdf={() => downloadReport('pdf')} />
          </div>
        </div>
      </div>

      <div className="fee-section">
        <div className="fee-table-head" style={{ gridTemplateColumns: '60px 1fr 1fr 80px' }}>
          <div className="fee-th">S. No.</div>
          <div className="fee-th">Class</div>
          <div className="fee-th fee-center">Section</div>
          <div className="fee-th fee-center">Details</div>
        </div>
        {classes.map((c, i) => {
          const list = (studentsMap[c.key] || []).map(s => {
            const m = allStudents.find(x => x.c.key === c.key && x.s.reg === s.reg)?.m;
            const pays = paymentsFor(c.key, s.reg);
            const last = pays.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0] || null;
            return { s, m, last };
          }).filter(x => {
            if (!x.m) return false;
            if (seg === 'paid') return x.m.payable > 0 && x.m.remaining <= 0;
            return x.m.paid > 0;
          });
          const colTot = list.reduce((a, x) => a + (x.m?.paid || 0), 0);
          const isOpen = openKey === c.key;
          return (
            <div key={c.key} className="fee-rowwrap">
              <div className={`fee-row${isOpen ? ' open' : ''}`} style={{ gridTemplateColumns: '60px 1fr 1fr 80px' }} onClick={() => setOpenKey(isOpen ? null : c.key)}>
                <div className="fee-td"><span className="fee-row-icon">{i + 1}</span></div>
                <div className="fee-td fee-name">{c.cls}<span className="fee-sub-eq">{list.length} record{list.length === 1 ? '' : 's'} · {money(colTot)}</span></div>
                <div className="fee-td fee-center"><span className="fee-tag">{c.sec}</span></div>
                <div className="fee-td fee-center"><span className={`fee-chevbtn${isOpen ? ' open' : ''}`}><i className="fa-solid fa-chevron-down fee-chev"></i></span></div>
              </div>
              <div className={`fee-detail${isOpen ? ' open' : ''}`}>
                <div className="fee-detail-inner">
                  {list.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 18 }}>No collections in this range.</div>
                  ) : seg === 'month' ? (
                    <>
                      <div className="fee-detail-title"><i className="fa-solid fa-receipt"></i> Collection Report — {c.cls} ({c.sec})</div>
                      <div className="fee-stbl-wrap">
                        <table className="fee-stbl">
                          <thead>
                            <tr>
                              <th>Sn.</th><th>Voucher No</th><th>Student</th><th>Reg No</th>
                              <th className="fee-center">Date &amp; Time</th>
                              <th>Received By</th>
                              <th className="fee-center">Method</th>
                              <th className="fee-right">Discount</th><th className="fee-right">Payable</th><th className="fee-right">Received</th>
                            </tr>
                          </thead>
                          <tbody>
                            {list.map((x, j) => (
                              <tr key={x.s.reg}>
                                <td className="fee-num">{j + 1}</td>
                                <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{x.last?.ref || x.last?.txn || '—'}</td>
                                <td><b>{x.s.name}</b></td>
                                <td>{x.s.reg}</td>
                                <td className="fee-center">{x.last?.date || '—'}{x.last?.time && <span className="fee-sub-eq">{fmtTime12(x.last.time)}</span>}</td>
                                <td>{receivedBy(x.last)}</td>
                                <td className="fee-center">{x.last ? <MethodChip method={x.last.method} source={x.last.source} /> : '—'}</td>
                                <td className="fee-right">{money(x.m.disc)}</td>
                                <td className="fee-right">{money(x.m.payable)}</td>
                                <td className="fee-right fee-paid-amt">{money(x.m.paid)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : seg === 'paid' ? (
                    <>
                      <div className="fee-detail-title"><i className="fa-solid fa-user-check"></i> Paid Students — {c.cls} ({c.sec})</div>
                      <div className="fee-stbl-wrap">
                        <table className="fee-stbl">
                          <thead>
                            <tr>
                              <th>Sn.</th><th>Student</th><th>Father</th><th>Reg No</th><th>Contact</th>
                              <th className="fee-center">Date &amp; Time</th>
                              <th>Received By</th>
                              <th className="fee-center">Method</th>
                              <th className="fee-right">Paid</th><th className="fee-center">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {list.map((x, j) => (
                              <tr key={x.s.reg}>
                                <td className="fee-num">{j + 1}</td>
                                <td><b>{x.s.name}</b></td>
                                <td>{x.s.father || '—'}</td>
                                <td>{x.s.reg}</td>
                                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{studentPhone(x.s)}</td>
                                <td className="fee-center">{x.last?.date || '—'}{x.last?.time && <span className="fee-sub-eq">{fmtTime12(x.last.time)}</span>}</td>
                                <td>{receivedBy(x.last)}</td>
                                <td className="fee-center">{x.last ? <MethodChip method={x.last.method} source={x.last.source} /> : '—'}</td>
                                <td className="fee-right fee-paid-amt">{money(x.m.paid)}</td>
                                <td className="fee-center"><span className="fee-chip fee-chip-active"><i className="fa-solid fa-check"></i> Cleared</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="fee-detail-title"><i className="fa-solid fa-receipt"></i> Daily Collection — {c.cls} ({c.sec})</div>
                      <div className="fee-stbl-wrap">
                        <table className="fee-stbl">
                          <thead>
                            <tr>
                              <th>Sn.</th><th>Student</th><th>Reg No</th>
                              <th className="fee-center">Date &amp; Time</th>
                              <th>Received By</th>
                              <th className="fee-center">Method</th>
                              <th className="fee-right">Received</th>
                            </tr>
                          </thead>
                          <tbody>
                            {list.map((x, j) => (
                              <tr key={x.s.reg}>
                                <td className="fee-num">{j + 1}</td>
                                <td><b>{x.s.name}</b></td>
                                <td>{x.s.reg}</td>
                                <td className="fee-center">{x.last?.date || '—'}{x.last?.time && <span className="fee-sub-eq">{fmtTime12(x.last.time)}</span>}</td>
                                <td>{receivedBy(x.last)}</td>
                                <td className="fee-center">{x.last ? <MethodChip method={x.last.method} source={x.last.source} /> : <MethodChip method="Cash" />}</td>
                                <td className="fee-right fee-paid-amt">{money(x.m.paid)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ════════════ 3. HEAD-WISE COLLECTION ════════════ */
function ReportPanelHeadwise({ toast }) {
  const repStyle = useContext(FeeReportStyleContext);
  const { classes, studentsMap, headsMap, allStudents } = useReportData();
  const [seg, setSeg] = useState('student');
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom]       = useState('2025-01-01');
  const [to, setTo]           = useState(today);
  const [stuKey, setStuKey]   = useState('');
  const [clsKey, setClsKey]   = useState(classes[0]?.key || '');
  const [head, setHead]       = useState('All Heads');
  const [result, setResult]   = useState(null);
  useEffect(() => { if (classes.length && !clsKey) setClsKey(classes[0].key); }, [classes, clsKey]);

  const allHeads = useMemo(() => {
    const set = new Set();
    Object.values(headsMap).forEach(arr => (arr || []).forEach(h => set.add(h.name)));
    return ['All Heads', ...Array.from(set), 'Previous Dues', 'Transport'];
  }, [headsMap]);

  const fetchResult = () => {
    if (seg === 'student') {
      if (!stuKey) { toast('Select a student first', 'warning'); return; }
      const [ck, reg] = stuKey.split('|');
      const c = classes.find(x => x.key === ck); if (!c) return;
      const s = (studentsMap[ck] || []).find(x => x.reg === reg); if (!s) return;
      const m = allStudents.find(x => x.c.key === ck && x.s.reg === reg)?.m;
      const rows = buildHeadwiseRows(c, s, m, head);
      setResult({ kind: 'student', c, s, rows, from, to });
      toast('Head-wise data loaded', 'info');
    } else {
      const c = classes.find(x => x.key === clsKey); if (!c) return;
      const rows = (studentsMap[clsKey] || []).map(s => {
        const m = allStudents.find(x => x.c.key === clsKey && x.s.reg === s.reg)?.m;
        return { s, heads: buildHeadwiseRows(c, s, m, head) };
      });
      setResult({ kind: 'class', c, rows, from, to });
      toast('Class head-wise data loaded', 'info');
    }
  };

  const [preview, setPreview] = useState(null);
  const downloadReport = (mode) => {
    if (!result) { toast('Fetch the data first', 'warning'); return; }
    if (mode === 'preview') {
      setPreview({ ...result, head });
      return;
    }
    const html = buildRepHeadwiseHTML({ ...result, head, isBW: repStyle === 'bw' });
    openPrintReport(html, `Head-Wise Collection — ${head}`, toast, 'pdf');
  };

  return (
    <>
      <div className="fee-seg">
        <button className={`fee-seg-btn${seg === 'student' ? ' active' : ''}`} onClick={() => setSeg('student')}>
          <i className="fa-solid fa-user"></i> Student Wise For Fee Collection
        </button>
        <button className={`fee-seg-btn${seg === 'class' ? ' active' : ''}`} onClick={() => setSeg('class')}>
          <i className="fa-solid fa-users"></i> Class Wise For Fee Collection
        </button>
      </div>

      <div className="fee-info">
        <i className="fa-solid fa-circle-info"></i>
        <span>Break down collection by individual fee head (Tuition, Admission, Transport, etc.) for a student or class over a date range — essential for revenue accounting.</span>
      </div>

      <div className="fee-section fee-section--overflow">
        <div className="fee-section-body">
          <div className="fee-filters">
            <div className="fee-field fee-field--grow">
              {seg === 'student' ? (
                <>
                  <span className="fee-label">Select Student</span>
                  <div className="fee-select-wrap">
                    <select className="fee-select" value={stuKey} onChange={e => setStuKey(e.target.value)}>
                      <option value="">— Pick a student —</option>
                      {allStudents.map(({ c, s }) => (
                        <option key={`${c.key}|${s.reg}`} value={`${c.key}|${s.reg}`}>
                          {s.name} S/O {s.father || '—'} — {c.cls} {c.sec}
                        </option>
                      ))}
                    </select>
                    <i className="fa-solid fa-chevron-down"></i>
                  </div>
                </>
              ) : (
                <>
                  <span className="fee-label">Select Class</span>
                  <div className="fee-select-wrap">
                    <select className="fee-select" value={clsKey} onChange={e => setClsKey(e.target.value)}>
                      {classes.map(c => <option key={c.key} value={c.key}>{c.cls} — {c.sec}</option>)}
                    </select>
                    <i className="fa-solid fa-chevron-down"></i>
                  </div>
                </>
              )}
            </div>
            <div className="fee-field fee-field--grow">
              <span className="fee-label">Select Head</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={head} onChange={e => setHead(e.target.value)}>
                  {allHeads.map(h => <option key={h}>{h}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
            <div className="fee-field">
              <span className="fee-label">From Date</span>
              <input className="fee-input" type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ minWidth: 160 }} />
            </div>
            <div className="fee-field">
              <span className="fee-label">To Date</span>
              <input className="fee-input" type="date" value={to} onChange={e => setTo(e.target.value)} style={{ minWidth: 160 }} />
            </div>
          </div>
          <div className="fee-filters" style={{ marginTop: 14 }}>
            <Tooltip text="Load head-wise data for the selected target">
              <button className="fee-btn fee-btn-primary" onClick={fetchResult}>
                <i className="fa-solid fa-magnifying-glass"></i> Fetch
              </button>
            </Tooltip>
            <RepActions onPreview={() => downloadReport('preview')} onPdf={() => downloadReport('pdf')} />
          </div>
        </div>
      </div>

      {result && result.kind === 'student' && (
        <div className="fee-section">
          <div className="fee-section-body">
            <div className="fee-detail-title">
              <i className="fa-solid fa-user"></i> Head-Wise Collection — {result.s.name} ({result.c.cls}/{result.c.sec})
            </div>
            <div className="fee-stbl-wrap">
              <table className="fee-stbl">
                <thead>
                  <tr>
                    <th>Sn.</th><th>Account Type</th><th>Fee Head</th>
                    <th className="fee-right">Standard</th><th className="fee-right">Discount</th>
                    <th className="fee-right">Received</th><th className="fee-right">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.length === 0 ? (
                    <tr><td colSpan="7" className="fee-stbl-empty">No data for the selected filter.</td></tr>
                  ) : result.rows.map((r, j) => (
                    <tr key={`${r.head}-${j}`}>
                      <td className="fee-num">{j + 1}</td>
                      <td>{r.head}</td>
                      <td><b>{r.sub}</b></td>
                      <td className="fee-right">{money(r.total)}</td>
                      <td className="fee-right">{money(r.disc)}</td>
                      <td className="fee-right fee-paid-amt">{money(r.recv)}</td>
                      <td className="fee-right">{r.pend > 0 ? <span className="fee-neg">{money(r.pend)}</span> : '0'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {result && result.kind === 'class' && (
        <div className="fee-section">
          <div className="fee-section-body">
            <div className="fee-detail-title">
              <i className="fa-solid fa-users"></i> Class Head-Wise — {result.c.cls} ({result.c.sec})
            </div>
            <div className="fee-stbl-wrap">
              <table className="fee-stbl">
                <thead>
                  <tr>
                    <th>Sn.</th><th>Student</th><th>Reg No</th>
                    <th className="fee-right">Standard</th>
                    <th className="fee-right">Discount</th>
                    <th className="fee-right">Received</th>
                    <th className="fee-right">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.length === 0 ? (
                    <tr><td colSpan="7" className="fee-stbl-empty">No students.</td></tr>
                  ) : result.rows.map(({ s, heads: rows }, j) => {
                    const sum = rows.reduce((a, r) => ({ total: a.total + r.total, disc: a.disc + r.disc, recv: a.recv + r.recv, pend: a.pend + r.pend }), { total: 0, disc: 0, recv: 0, pend: 0 });
                    return (
                      <tr key={s.reg}>
                        <td className="fee-num">{j + 1}</td>
                        <td><b>{s.name}</b><span className="fee-sub-eq">s/o {s.father || '—'}</span></td>
                        <td>{s.reg}</td>
                        <td className="fee-right">{money(sum.total)}</td>
                        <td className="fee-right">{money(sum.disc)}</td>
                        <td className="fee-right fee-paid-amt">{money(sum.recv)}</td>
                        <td className="fee-right">{sum.pend > 0 ? <span className="fee-neg">{money(sum.pend)}</span> : '0'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <HeadwisePreviewModal
        cfg={preview}
        onClose={() => setPreview(null)}
        onDownload={() => {
          const html = buildRepHeadwiseHTML({ ...preview, isBW: repStyle === 'bw' });
          setPreview(null);
          openPrintReport(html, `Head-Wise Collection — ${preview.head}`, toast, 'pdf');
        }}
      />
    </>
  );
}

/* ─── Head-Wise Preview Modal (in-app) ─── */
function HeadwisePreviewModal({ cfg, onClose, onDownload }) {
  useEffect(() => {
    if (!cfg) return undefined;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [cfg, onClose]);

  if (!cfg) return null;

  const isStudent = cfg.kind === 'student';
  let sum = { total: 0, disc: 0, recv: 0, pend: 0 };

  if (isStudent) {
    sum = cfg.rows.reduce((a, r) => ({
      total: a.total + r.total, disc: a.disc + r.disc, recv: a.recv + r.recv, pend: a.pend + r.pend,
    }), sum);
  } else {
    cfg.rows.forEach(({ heads }) => {
      heads.forEach(r => { sum.total += r.total; sum.disc += r.disc; sum.recv += r.recv; sum.pend += r.pend; });
    });
  }

  return createPortal(
    <div className="fee-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fee-modal lg">
        <div className="fee-modal-head">
          <div className="fee-modal-head-title">
            <div className="fee-modal-head-icon"><i className="fa-solid fa-layer-group"></i></div>
            <div>
              <div className="fee-modal-title">Head-Wise Collection Preview</div>
              <div className="fee-modal-sub">
                {isStudent
                  ? <>{cfg.s.name} · {cfg.c.cls}/{cfg.c.sec} · Reg {cfg.s.reg}</>
                  : <>{cfg.c.cls} — {cfg.c.sec} · {cfg.rows.length} student{cfg.rows.length === 1 ? '' : 's'}</>}
                {' · '}<strong>Head:</strong> {cfg.head}{' · '}<strong>Range:</strong> {cfg.from} → {cfg.to}
              </div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="fee-modal-close" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </Tooltip>
        </div>

        <div className="fee-modal-body">
          {/* KPI strip */}
          <div className="fee-hist-ledger-meta" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="fee-hist-metacard"><div className="l">Standard Total</div><div className="v">{money(sum.total)}</div></div>
            <div className="fee-hist-metacard"><div className="l">Discount</div><div className="v">{money(sum.disc)}</div></div>
            <div className="fee-hist-metacard"><div className="l">Received</div><div className="v green">{money(sum.recv)}</div></div>
            <div className="fee-hist-metacard"><div className="l">Pending</div><div className="v red">{money(sum.pend)}</div></div>
          </div>

          {isStudent ? (
            <div className="fee-stbl-wrap" style={{ marginTop: 14 }}>
              <table className="fee-stbl">
                <thead>
                  <tr>
                    <th>Sn.</th>
                    <th>Account Type</th>
                    <th>Fee Head</th>
                    <th className="fee-right">Standard</th>
                    <th className="fee-right">Discount</th>
                    <th className="fee-right">Received</th>
                    <th className="fee-right">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {cfg.rows.length === 0 ? (
                    <tr><td colSpan="7" className="fee-stbl-empty">No data for the selected filter.</td></tr>
                  ) : cfg.rows.map((r, j) => (
                    <tr key={`${r.head}-${j}`}>
                      <td className="fee-num">{j + 1}</td>
                      <td>{r.head}</td>
                      <td><b>{r.sub}</b></td>
                      <td className="fee-right">{money(r.total)}</td>
                      <td className="fee-right">{money(r.disc)}</td>
                      <td className="fee-right fee-paid-amt">{money(r.recv)}</td>
                      <td className="fee-right">{r.pend > 0 ? <span className="fee-neg">{money(r.pend)}</span> : '0'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="fee-recv-total">
                    <td colSpan="3" style={{ textAlign: 'right', fontWeight: 800 }}>Total</td>
                    <td className="fee-right">{money(sum.total)}</td>
                    <td className="fee-right">{money(sum.disc)}</td>
                    <td className="fee-right fee-paid-amt">{money(sum.recv)}</td>
                    <td className="fee-right">{sum.pend > 0 ? <span className="fee-neg">{money(sum.pend)}</span> : '0'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="fee-stbl-wrap" style={{ marginTop: 14 }}>
              <table className="fee-stbl">
                <thead>
                  <tr>
                    <th>Sn.</th>
                    <th>Student</th>
                    <th>Reg No</th>
                    <th className="fee-right">Standard</th>
                    <th className="fee-right">Discount</th>
                    <th className="fee-right">Received</th>
                    <th className="fee-right">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {cfg.rows.length === 0 ? (
                    <tr><td colSpan="7" className="fee-stbl-empty">No students.</td></tr>
                  ) : cfg.rows.map(({ s, heads }, j) => {
                    const t = heads.reduce((a, r) => ({ total: a.total + r.total, disc: a.disc + r.disc, recv: a.recv + r.recv, pend: a.pend + r.pend }), { total: 0, disc: 0, recv: 0, pend: 0 });
                    return (
                      <tr key={s.reg}>
                        <td className="fee-num">{j + 1}</td>
                        <td>
                          <b>{s.name}</b>
                          <span className="fee-sub-eq">s/o {s.father || '—'}</span>
                        </td>
                        <td>{s.reg}</td>
                        <td className="fee-right">{money(t.total)}</td>
                        <td className="fee-right">{money(t.disc)}</td>
                        <td className="fee-right fee-paid-amt">{money(t.recv)}</td>
                        <td className="fee-right">{t.pend > 0 ? <span className="fee-neg">{money(t.pend)}</span> : '0'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="fee-recv-total">
                    <td colSpan="3" style={{ textAlign: 'right', fontWeight: 800 }}>Class Total</td>
                    <td className="fee-right">{money(sum.total)}</td>
                    <td className="fee-right">{money(sum.disc)}</td>
                    <td className="fee-right fee-paid-amt">{money(sum.recv)}</td>
                    <td className="fee-right">{sum.pend > 0 ? <span className="fee-neg">{money(sum.pend)}</span> : '0'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        <div className="fee-modal-foot">
          <Tooltip text="Close preview">
            <button className="fee-btn fee-btn-ghost" onClick={onClose}>Close</button>
          </Tooltip>
          <Tooltip text="Download the A4 PDF version (Save as PDF from the print window)">
            <button className="fee-btn fee-btn-primary" onClick={onDownload}>
              <i className="fa-solid fa-file-pdf"></i> Download PDF
            </button>
          </Tooltip>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* Builds the per-head row breakdown for one student. */
function buildHeadwiseRows(c, s, m, headFilter) {
  if (!c || !s || !m) return [];
  const rows = [];
  if ((+s.dues || 0) > 0) {
    rows.push({ head: 'Custom Account', sub: 'Previous Dues', total: +s.dues || 0, disc: 0, recv: Math.min(m.paid, +s.dues), pend: Math.max((+s.dues) - Math.min(m.paid, +s.dues), 0) });
  }
  m.heads.forEach(h => {
    const gen = m.generated;
    const net = h.std - h.disc;
    rows.push({ head: 'Account Payable', sub: h.name, total: h.std, disc: h.disc, recv: gen ? net : 0, pend: gen ? 0 : net });
  });
  if ((+s.transport || 0) > 0) {
    rows.push({ head: 'Account Payable', sub: 'Transport', total: +s.transport, disc: 0, recv: m.generated ? +s.transport : 0, pend: m.generated ? 0 : +s.transport });
  }
  if (headFilter && headFilter !== 'All Heads') {
    return rows.filter(r => r.sub === headFilter);
  }
  return rows;
}

/* ════════════ 4. AGING / OUTSTANDING ════════════ */
function ReportPanelAging({ toast }) {
  const repStyle = useContext(FeeReportStyleContext);
  const { classes, allStudents } = useReportData();
  const list = useMemo(() => allStudents
    .filter(x => x.m.remaining > 0)
    .map(x => ({ ...x, a: repAgingFromModel(x.m) })), [allStudents]);
  const tot = list.reduce((o, x) => ({ cur: o.cur + x.a.cur, d30: o.d30 + x.a.d30, d60: o.d60 + x.a.d60, d90: o.d90 + x.a.d90 }), { cur: 0, d30: 0, d60: 0, d90: 0 });

  const downloadReport = (mode) => {
    const html = buildRepAgingHTML({ list, tot, asOf: new Date().toISOString().slice(0, 10), isBW: repStyle === 'bw' });
    openPrintReport(html, 'Aging / Outstanding Analysis', toast, mode);
  };

  return (
    <>
      <div className="fee-info">
        <i className="fa-solid fa-circle-info"></i>
        <span><strong>Aging analysis</strong> buckets outstanding fee by how long it's overdue (Current, 1–30, 31–60, 61–90+ days) — the standard for recovery-risk and follow-up prioritisation.</span>
      </div>

      {repKpiStrip([
        ['k-green', 'fa-circle-dot',           'Current',    fmtRs(tot.cur), ''],
        ['k-amber', 'fa-clock',                '1–30 Days',  fmtRs(tot.d30), ''],
        ['k-amber', 'fa-clock-rotate-left',    '31–60 Days', fmtRs(tot.d60), ''],
        ['k-red',   'fa-triangle-exclamation', '61–90+ Days', fmtRs(tot.d90), ''],
      ])}

      <div className="fee-section fee-section--overflow">
        <div className="fee-section-body">
          <div className="fee-filters">
            <div className="fee-field">
              <span className="fee-label">As of Date</span>
              <input className="fee-input" type="date" defaultValue={new Date().toISOString().slice(0, 10)} style={{ minWidth: 170 }} />
            </div>
            <div className="fee-field">
              <span className="fee-label">Class</span>
              <div className="fee-select-wrap">
                <select className="fee-select" defaultValue="All Classes">
                  <option>All Classes</option>
                  {classes.map(c => <option key={c.key}>{c.cls} {c.sec}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
            <RepActions onPreview={() => downloadReport('preview')} onPdf={() => downloadReport('pdf')} />
          </div>
        </div>
      </div>

      <div className="fee-section">
        <div className="fee-section-body">
          <div className="age-legend">
            <span><i className="age-dot age-cur"></i> Current</span>
            <span><i className="age-dot age-30"></i> 1–30</span>
            <span><i className="age-dot age-60"></i> 31–60</span>
            <span><i className="age-dot age-90"></i> 61–90+</span>
          </div>
          <div className="fee-stbl-wrap">
            <table className="fee-stbl">
              <thead>
                <tr>
                  <th>Sn.</th><th>Student</th><th>Class/Sec</th>
                  <th className="fee-right">Current</th>
                  <th className="fee-right">1–30</th>
                  <th className="fee-right">31–60</th>
                  <th className="fee-right">61–90+</th>
                  <th className="fee-right">Total Due</th>
                  <th style={{ width: 150 }}>Aging</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr><td colSpan="9" className="fee-stbl-empty">No outstanding dues.</td></tr>
                ) : list.map((x, j) => {
                  const tt = (x.a.cur + x.a.d30 + x.a.d60 + x.a.d90) || 1;
                  return (
                    <tr key={`${x.c.key}-${x.s.reg}`}>
                      <td className="fee-num">{j + 1}</td>
                      <td>
                        <b>{x.s.name}</b>
                        <span className="fee-sub-eq">s/o {x.s.father || '—'}</span>
                      </td>
                      <td>{x.c.cls} / {x.c.sec}</td>
                      <td className="fee-right">{money(x.a.cur)}</td>
                      <td className="fee-right" style={{ color: '#D97706', fontWeight: 700 }}>{money(x.a.d30)}</td>
                      <td className="fee-right" style={{ color: '#D97706', fontWeight: 700 }}>{money(x.a.d60)}</td>
                      <td className="fee-right fee-neg">{money(x.a.d90)}</td>
                      <td className="fee-right"><b>{money(x.m.remaining)}</b></td>
                      <td>
                        <div className="age-bar">
                          {x.a.cur > 0 && (
                            <Tooltip text={`Current — ${fmtRs(x.a.cur)} (${((x.a.cur / tt) * 100).toFixed(1)}%)`}>
                              <i className="age-cur" style={{ width: `${(x.a.cur / tt) * 100}%` }} />
                            </Tooltip>
                          )}
                          {x.a.d30 > 0 && (
                            <Tooltip text={`1–30 Days — ${fmtRs(x.a.d30)} (${((x.a.d30 / tt) * 100).toFixed(1)}%)`}>
                              <i className="age-30" style={{ width: `${(x.a.d30 / tt) * 100}%` }} />
                            </Tooltip>
                          )}
                          {x.a.d60 > 0 && (
                            <Tooltip text={`31–60 Days — ${fmtRs(x.a.d60)} (${((x.a.d60 / tt) * 100).toFixed(1)}%)`}>
                              <i className="age-60" style={{ width: `${(x.a.d60 / tt) * 100}%` }} />
                            </Tooltip>
                          )}
                          {x.a.d90 > 0 && (
                            <Tooltip text={`61–90+ Days — ${fmtRs(x.a.d90)} (${((x.a.d90 / tt) * 100).toFixed(1)}%)`}>
                              <i className="age-90" style={{ width: `${(x.a.d90 / tt) * 100}%` }} />
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bg-muted)', fontWeight: 800 }}>
                  <td colSpan="3" className="fee-right">GRAND TOTAL</td>
                  <td className="fee-right">{money(tot.cur)}</td>
                  <td className="fee-right">{money(tot.d30)}</td>
                  <td className="fee-right">{money(tot.d60)}</td>
                  <td className="fee-right">{money(tot.d90)}</td>
                  <td className="fee-right">{money(tot.cur + tot.d30 + tot.d60 + tot.d90)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

/* ════════════ 5. COLLECTION vs EXPECTED ════════════ */
function ReportPanelSummary({ toast }) {
  const repStyle = useContext(FeeReportStyleContext);
  const { classes, studentsMap, allStudents, totals, serverReceipts, paymentsFor } = useReportData();
  const real  = totals.exp ? Math.round(totals.recv / totals.exp * 100) : 0;
  const modes = useMemo(() => repPayModesFromReceipts(serverReceipts), [serverReceipts]);
  const modeTot = modes.reduce((a, m) => a + m.amt, 0) || 1;
  const sectionsData = classes.filter(c => (studentsMap[c.key] || []).length).map(c => {
    let e = 0, r = 0;
    allStudents.forEach(x => { if (x.c.key === c.key) { e += x.m.payable; r += x.m.paid; } });
    return { label: `${c.cls} ${c.sec}`, e, r };
  });
  const maxE = Math.max(...sectionsData.map(s => s.e), 1);

  const downloadReport = (mode) => {
    const html = buildRepSummaryHTML({ totals, real, modes, modeTot, sectionsData, isBW: repStyle === 'bw' });
    openPrintReport(html, 'Collection vs Expected', toast, mode);
  };
  const downloadByMode = (mode, fmt) => {
    const rows = [];
    allStudents.forEach(({ c, s }) => {
      paymentsFor(c.key, s.reg).forEach(p => {
        if ((p.method || 'Cash') === mode) {
          rows.push({ name: s.name, father: s.father, cls: `${c.cls}/${c.sec}`, reg: s.reg, date: p.date, time: p.time, method: p.method, ref: p.ref || p.txn || '—', amt: p.amount });
        }
      });
    });
    const html = buildRepPayModeHTML({ method: mode, rows, isBW: repStyle === 'bw' });
    openPrintReport(html, `${mode} Collections`, toast, fmt);
  };

  return (
    <>
      <div className="fee-info">
        <i className="fa-solid fa-circle-info"></i>
        <span>The <strong>collection summary</strong> compares expected (billed) revenue against actual receipts, shows realisation %, and breaks receipts down by payment mode.</span>
      </div>

      {repKpiStrip([
        ['k-blue',  'fa-file-invoice-dollar', 'Expected Revenue', fmtRs(totals.exp),  ''],
        ['k-green', 'fa-sack-dollar',         'Collected',        fmtRs(totals.recv), <span><b className="up">{real}%</b> realised</span>],
        ['k-amber', 'fa-percent',             'Discount / Waiver', fmtRs(totals.disc), ''],
        ['k-red',   'fa-clock',               'Outstanding',      fmtRs(totals.pend), `${totals.def} defaulters`],
      ])}

      <div className="fee-section fee-section--overflow">
        <div className="fee-section-body">
          <div className="fee-filters">
            <div className="fee-field">
              <span className="fee-label">Period</span>
              <div className="fee-select-wrap">
                <select className="fee-select" defaultValue={FEE_MONTHS[4]}>
                  {FEE_MONTHS.map(m => <option key={m}>{m} 2026</option>)}
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
            <RepActions onPreview={() => downloadReport('preview')} onPdf={() => downloadReport('pdf')} />
          </div>
        </div>
      </div>

      <div className="fee-section">
        <div className="fee-section-header">
          <div className="fee-section-title">
            <div className="fee-section-icon"><i className="fa-solid fa-chart-column"></i></div>
            <div>
              <div className="fee-section-name">Expected vs Collected by Section</div>
              <div className="fee-section-sub">Billed (blue) against actual receipts (green)</div>
            </div>
          </div>
        </div>
        <div className="fee-section-body">
          <div className="rep-bars">
            {sectionsData.map(c => {
              const pend = Math.max(c.e - c.r, 0);
              const pct  = c.e > 0 ? Math.round(c.r / c.e * 100) : 0;
              return (
                <div key={c.label} className="rep-bar-col">
                  <div className="rep-bar-pair">
                    <Tooltip text={`${c.label} · Expected — ${fmtRs(c.e)}  ·  Pending ${fmtRs(pend)}`}>
                      <div className="rep-bar" style={{ height: `${(c.e / maxE) * 100}%` }} />
                    </Tooltip>
                    <Tooltip text={`${c.label} · Collected — ${fmtRs(c.r)}  (${pct}% realised)`}>
                      <div className="rep-bar green" style={{ height: `${(c.r / maxE) * 100}%` }} />
                    </Tooltip>
                  </div>
                  <Tooltip text={`${c.label} — Expected ${fmtRs(c.e)} · Collected ${fmtRs(c.r)} · Pending ${fmtRs(pend)}`}>
                    <div className="rep-bar-lbl">{c.label}</div>
                  </Tooltip>
                </div>
              );
            })}
          </div>
          <div className="age-legend" style={{ margin: '14px 0 0' }}>
            <span><i className="age-dot" style={{ background: '#1E3A8A' }}></i> Expected</span>
            <span><i className="age-dot" style={{ background: '#16A34A' }}></i> Collected</span>
          </div>
        </div>
      </div>

      <div className="fee-section">
        <div className="fee-section-header">
          <div className="fee-section-title">
            <div className="fee-section-icon"><i className="fa-solid fa-money-bill-transfer"></i></div>
            <div>
              <div className="fee-section-name">Collection by Payment Mode</div>
              <div className="fee-section-sub">How {fmtRs(modeTot)} received this period was paid</div>
            </div>
          </div>
        </div>
        <div className="fee-section-body">
          <div className="mode-grid">
            {modes.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>No payments recorded yet.</div>
            ) : modes.map(m => {
              const pct = Math.round(m.amt / modeTot * 100);
              return (
                <div key={m.name} className="mode-card">
                  <div className="mode-card-top">
                    <div className="mode-ic" style={{ background: m.col }}><i className={`fa-solid ${m.ic}`}></i></div>
                    <div className="mode-name">{m.name}</div>
                    <div className="mode-actions">
                      <Tooltip text={`Preview ${m.name} report`}>
                        <button className="mode-act-btn" onClick={() => downloadByMode(m.name, 'preview')}>
                          <i className="fa-solid fa-eye"></i>
                        </button>
                      </Tooltip>
                      <Tooltip text={`Download ${m.name} report`}>
                        <button className="mode-act-btn" onClick={() => downloadByMode(m.name, 'pdf')}>
                          <i className="fa-solid fa-download"></i>
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="mode-amt">{fmtRs(m.amt)}</div>
                  <div className="mode-pct">{pct}% of receipts</div>
                  <div className="mode-track"><i style={{ width: `${pct}%`, background: m.col }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Print window helper ─── */
function openPrintReport(html, title, toast, mode = 'preview') {
  const w = window.open('', '_blank');
  if (!w) { toast('Please allow pop-ups to view the report', 'error'); return; }
  w.document.write(html);
  w.document.close();
  w.onload = () => {
    try { w.focus(); if (mode === 'pdf') w.print(); } catch (e) { /* ignore */ }
  };
  toast(`${title} — ${mode === 'pdf' ? 'sent to print' : 'preview opened'}.`, 'success');
}

/* ═══════════ A4 PDF builders for every report ═══════════ */
const REP_A4_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff}
body{font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#111;font-size:10.5px;line-height:1.4}
.rep-page{width:210mm;min-height:297mm;margin:0 auto;padding:14mm;background:#fff}
.rep-head{display:flex;align-items:center;gap:14px;border-bottom:2px solid #1E3A8A;padding-bottom:10px;margin-bottom:10px}
.rep-logo{width:42px;height:42px;border:2px solid #1E3A8A;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#1E3A8A;font-weight:800}
.rep-name{font-size:18px;font-weight:800;color:#1E3A8A;line-height:1.1}
.rep-title{font-size:12px;font-weight:600;color:#444;margin-top:3px}
.rep-filters{display:flex;flex-wrap:wrap;gap:6px 22px;font-size:10.5px;color:#333;margin-bottom:12px;background:#F1F5FB;padding:9px 13px;border-radius:6px}
.rep-secttl{font-size:12px;font-weight:800;color:#1E3A8A;margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid #cdd7ea}
.rep-tbl{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:4px}
.rep-tbl th{background:#1E3A8A;color:#fff;padding:6px 7px;text-align:left;font-size:10px;font-weight:700}
.rep-tbl th.r,.rep-tbl td.r{text-align:right}
.rep-tbl th.c,.rep-tbl td.c{text-align:center}
.rep-tbl td{padding:5px 7px;border-bottom:1px solid #e5e9f2;vertical-align:top}
.rep-tbl small{color:#777;font-size:9px}
.rep-tot td{background:#EAF0FA;font-weight:800;border-top:2px solid #1E3A8A}
.rep-grandtot td{background:#1E3A8A;color:#fff;font-weight:800}
.neg{color:#DC2626;font-weight:700}
.pos{color:#16A34A;font-weight:700}
.amb{color:#D97706;font-weight:700}
.rep-foot{margin-top:16px;text-align:center;font-size:9px;color:#999;border-top:1px solid #e5e9f2;padding-top:8px}
.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;}
.kpi{border:1px solid #E5E7EB;border-radius:6px;padding:9px 11px;background:#F8FAFF;}
.kpi .l{font-size:9.5px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.3px;}
.kpi .v{font-size:14px;font-weight:800;color:#0F172A;margin-top:2px;}
@page{size:A4 portrait;margin:14mm}
@media print{.rep-page{width:auto;min-height:0;margin:0;padding:0}body{font-size:10px}}
/* Colorless Report — flattens gradient borders, colored table heads
   and KPI fills to dark-on-white with thin gray borders. Activates
   only when .fee-rep-bw is present on the body. */
.fee-rep-bw .rep-head{border-bottom-color:#0F172A !important;border-bottom-width:1.5px !important;}
.fee-rep-bw .rep-logo{border-color:#0F172A !important;color:#0F172A !important;}
.fee-rep-bw .rep-name{color:#0F172A !important;}
.fee-rep-bw .rep-filters{background:#FFFFFF !important;border:1px solid #D1D5DB;color:#0F172A !important;}
.fee-rep-bw .rep-secttl{color:#0F172A !important;border-bottom-color:#9CA3AF !important;}
.fee-rep-bw .rep-tbl th{background:#FFFFFF !important;color:#0F172A !important;border-bottom:1.5px solid #0F172A !important;}
.fee-rep-bw .rep-tot td{background:#FFFFFF !important;color:#0F172A !important;border-top-color:#0F172A !important;}
.fee-rep-bw .rep-grandtot td{background:#FFFFFF !important;color:#0F172A !important;border-top:1.5px solid #0F172A !important;}
.fee-rep-bw .kpi{background:#FFFFFF !important;border-color:#D1D5DB !important;}
.fee-rep-bw .neg, .fee-rep-bw .pos, .fee-rep-bw .amb{color:#0F172A !important;}
`;

function repWrap(title, filters, body, isBW = false) {
  const today = new Date().toLocaleDateString('en-GB');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escHtml(FEE_SCHOOL.name)} — ${escHtml(title)}</title>
<style>${REP_A4_CSS}</style></head><body${isBW ? ' class="fee-rep-bw"' : ''}><div class="rep-page">
  <div class="rep-head">
    <div class="rep-logo">${FEE_SCHOOL.monogram}</div>
    <div><div class="rep-name">${escHtml(FEE_SCHOOL.name)}</div><div class="rep-title">${escHtml(title)}${isBW ? ' · <b>Colorless Print</b>' : ''}</div></div>
  </div>
  <div class="rep-filters">${filters}</div>
  ${body}
  <div class="rep-foot">Computer generated report — ${escHtml(FEE_SCHOOL.name)} · ${escHtml(title)} · ${escHtml(today)}</div>
</div></body></html>`;
}

function buildRepDefaulterHTML({ classes, studentsMap, allStudents, totals, month, year, scope = 'all', isBW = false }) {
  const blocks = classes.map(c => {
    const defs = (studentsMap[c.key] || []).map(s => {
      const m = allStudents.find(x => x.c.key === c.key && x.s.reg === s.reg)?.m;
      return m && m.remaining > 0 ? { s, m } : null;
    }).filter(Boolean);
    if (!defs.length) return '';
    const sub = defs.reduce((a, x) => a + x.m.remaining, 0);
    return `<div class="rep-secttl">${escHtml(c.cls)} — Section ${escHtml(c.sec)} · ${defs.length} defaulter(s)</div>
      <table class="rep-tbl">
        <thead><tr><th>Sn.</th><th>Student</th><th>Father</th><th>Reg No</th><th>Contact</th><th class="r">Pending</th></tr></thead>
        <tbody>${defs.map((x, j) => `<tr><td>${j + 1}</td><td><b>${escHtml(x.s.name)}</b></td><td>${escHtml(x.s.father || '—')}</td><td>${escHtml(x.s.reg)}</td><td>${escHtml(studentPhone(x.s))}</td><td class="r neg">${(x.m.remaining).toLocaleString('en-PK')}</td></tr>`).join('')}</tbody>
        <tfoot><tr class="rep-tot"><td colspan="5">${escHtml(c.cls)}/${escHtml(c.sec)} Subtotal</td><td class="r">${sub.toLocaleString('en-PK')}</td></tr></tfoot>
      </table>`;
  }).filter(Boolean).join('');

  return repWrap(
    scope === 'month' ? `Fee Defaulter List — ${month} ${year}` : 'Fee Defaulter List — All',
    `<span><b>Scope:</b> ${scope === 'month' ? `${month} ${year}` : 'All Periods'}</span><span><b>Defaulters:</b> ${totals.def}</span><span><b>Outstanding:</b> Rs. ${totals.pend.toLocaleString('en-PK')}</span>`,
    `<div class="kpi-row">
      <div class="kpi"><div class="l">Total Defaulters</div><div class="v">${totals.def}</div></div>
      <div class="kpi"><div class="l">Outstanding</div><div class="v">Rs. ${totals.pend.toLocaleString('en-PK')}</div></div>
      <div class="kpi"><div class="l">Students Billed</div><div class="v">${totals.n}</div></div>
      <div class="kpi"><div class="l">Fully Cleared</div><div class="v">${totals.paid}</div></div>
    </div>
    ${blocks || '<div style="text-align:center;color:#94A3B8;padding:20px">No defaulters — congratulations!</div>'}`,
  isBW,
  );
}

function buildRepCollectionHTML({ classes, studentsMap, allStudents, paymentsFor, seg, date, month, from, to, isBW = false }) {
  /* Paid Students report — dedicated layout with Father/Contact + status */
  if (seg === 'paid') {
    const blocks = classes.map(c => {
      const list = (studentsMap[c.key] || []).map(s => {
        const m = allStudents.find(x => x.c.key === c.key && x.s.reg === s.reg)?.m;
        const pays = paymentsFor(c.key, s.reg);
        const last = pays.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0] || null;
        return { s, m, last };
      }).filter(x => x.m && x.m.payable > 0 && x.m.remaining <= 0);
      if (!list.length) return '';
      const sub = list.reduce((a, x) => a + x.m.paid, 0);
      return `<div class="rep-secttl">${escHtml(c.cls)} — Section ${escHtml(c.sec)} · ${list.length} paid · Rs. ${sub.toLocaleString('en-PK')}</div>
        <table class="rep-tbl">
          <thead><tr><th>Sn.</th><th>Student</th><th>Father</th><th>Reg No</th><th>Contact</th><th>Date &amp; Time</th><th>Received By</th><th class="c">Method</th><th class="r">Paid</th><th class="c">Status</th></tr></thead>
          <tbody>${list.map((x, j) => `<tr>
            <td>${j + 1}</td>
            <td><b>${escHtml(x.s.name)}</b></td>
            <td>${escHtml(x.s.father || '—')}</td>
            <td>${escHtml(x.s.reg)}</td>
            <td>${escHtml(studentPhone(x.s))}</td>
            <td>${escHtml(x.last?.date || '—')}${x.last?.time ? `<br><small>${escHtml(fmtTime12(x.last.time))}</small>` : ''}</td>
            <td>${escHtml(receivedBy(x.last))}</td>
            <td class="c">${methodChipHTML(x.last?.method, x.last?.source)}</td>
            <td class="r pos">${(x.m.paid).toLocaleString('en-PK')}</td>
            <td class="c"><span style="display:inline-block;padding:2px 9px;border-radius:999px;background:rgba(22,163,74,.12);color:#16A34A;font-size:9.5px;font-weight:800">✓ Cleared</span></td>
          </tr>`).join('')}</tbody>
          <tfoot><tr class="rep-tot"><td colspan="8">${escHtml(c.cls)}/${escHtml(c.sec)} Subtotal</td><td class="r">${sub.toLocaleString('en-PK')}</td><td></td></tr></tfoot>
        </table>`;
    }).filter(Boolean).join('');
    const grand   = allStudents.filter(x => x.m.payable > 0 && x.m.remaining <= 0).reduce((a, x) => a + x.m.paid, 0);
    const cleared = allStudents.filter(x => x.m.payable > 0 && x.m.remaining <= 0).length;
    return repWrap('Paid Students List',
      `<span><b>Range:</b> ${escHtml(from)} → ${escHtml(to)}</span><span><b>Students Cleared:</b> ${cleared}</span><span><b>Grand Total:</b> Rs. ${grand.toLocaleString('en-PK')}</span>`,
      `<div class="kpi-row">
        <div class="kpi"><div class="l">Fully Cleared</div><div class="v">${cleared}</div></div>
        <div class="kpi"><div class="l">Total Collected</div><div class="v">Rs. ${grand.toLocaleString('en-PK')}</div></div>
        <div class="kpi"><div class="l">Range From</div><div class="v">${escHtml(from)}</div></div>
        <div class="kpi"><div class="l">Range To</div><div class="v">${escHtml(to)}</div></div>
      </div>
      ${blocks || '<div style="text-align:center;color:#94A3B8;padding:20px">No fully-paid students in this range.</div>'}`,
    isBW,
  );
  }

  /* Daily / Monthly collection layout — voucher-style table */
  const blocks = classes.map(c => {
    const list = (studentsMap[c.key] || []).map(s => {
      const m = allStudents.find(x => x.c.key === c.key && x.s.reg === s.reg)?.m;
      const pays = paymentsFor(c.key, s.reg);
      const last = pays.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0] || null;
      return { s, m, last };
    }).filter(x => x.m && x.m.paid > 0);
    if (!list.length) return '';
    const sub = list.reduce((a, x) => a + x.m.paid, 0);
    return `<div class="rep-secttl">${escHtml(c.cls)} — Section ${escHtml(c.sec)} · ${list.length} record(s) · Rs. ${sub.toLocaleString('en-PK')}</div>
      <table class="rep-tbl">
        <thead><tr><th>Sn.</th><th>Voucher No</th><th>Student</th><th>Reg No</th><th>Date &amp; Time</th><th>Received By</th><th class="c">Method</th><th class="r">Discount</th><th class="r">Payable</th><th class="r">Received</th></tr></thead>
        <tbody>${list.map((x, j) => `<tr>
          <td>${j + 1}</td>
          <td><small>${escHtml(x.last?.ref || x.last?.txn || '—')}</small></td>
          <td><b>${escHtml(x.s.name)}</b></td>
          <td>${escHtml(x.s.reg)}</td>
          <td>${escHtml(x.last?.date || '—')}${x.last?.time ? `<br><small>${escHtml(fmtTime12(x.last.time))}</small>` : ''}</td>
          <td>${escHtml(receivedBy(x.last))}</td>
          <td class="c">${methodChipHTML(x.last?.method, x.last?.source)}</td>
          <td class="r">${(x.m.disc).toLocaleString('en-PK')}</td>
          <td class="r">${(x.m.payable).toLocaleString('en-PK')}</td>
          <td class="r pos">${(x.m.paid).toLocaleString('en-PK')}</td>
        </tr>`).join('')}</tbody>
        <tfoot><tr class="rep-tot"><td colspan="9">${escHtml(c.cls)}/${escHtml(c.sec)} Subtotal</td><td class="r">${sub.toLocaleString('en-PK')}</td></tr></tfoot>
      </table>`;
  }).filter(Boolean).join('');
  const grand = allStudents.reduce((a, x) => a + (x.m.paid || 0), 0);
  const title = seg === 'daily' ? `Daily Collection — ${date}` : `Monthly Collection — ${month} 2026`;
  return repWrap(title,
    `<span><b>Mode:</b> ${seg.toUpperCase()}</span><span><b>Records:</b> ${allStudents.filter(x => x.m.paid > 0).length}</span><span><b>Grand Total:</b> Rs. ${grand.toLocaleString('en-PK')}</span>`,
    blocks || '<div style="text-align:center;color:#94A3B8;padding:20px">No collections in this range.</div>',
  isBW,
  );
}

function buildRepHeadwiseHTML({ kind, c, s, rows, from, to, head, isBW = false }) {
  if (kind === 'student') {
    const sum = rows.reduce((a, r) => ({ total: a.total + r.total, disc: a.disc + r.disc, recv: a.recv + r.recv, pend: a.pend + r.pend }), { total: 0, disc: 0, recv: 0, pend: 0 });
    return repWrap(`Head-Wise Collection — ${s.name}`,
      `<span><b>Class:</b> ${escHtml(c.cls)} / ${escHtml(c.sec)}</span><span><b>Reg:</b> ${escHtml(s.reg)}</span><span><b>Head:</b> ${escHtml(head)}</span><span><b>Range:</b> ${escHtml(from)} → ${escHtml(to)}</span>`,
      `<table class="rep-tbl"><thead><tr><th>Sn.</th><th>Account Type</th><th>Fee Head</th><th class="r">Standard</th><th class="r">Discount</th><th class="r">Received</th><th class="r">Pending</th></tr></thead>
        <tbody>${rows.map((r, j) => `<tr><td>${j + 1}</td><td>${escHtml(r.head)}</td><td><b>${escHtml(r.sub)}</b></td><td class="r">${r.total.toLocaleString('en-PK')}</td><td class="r">${r.disc.toLocaleString('en-PK')}</td><td class="r pos">${r.recv.toLocaleString('en-PK')}</td><td class="r ${r.pend > 0 ? 'neg' : ''}">${r.pend.toLocaleString('en-PK')}</td></tr>`).join('')}</tbody>
        <tfoot><tr class="rep-tot"><td colspan="3">Total</td><td class="r">${sum.total.toLocaleString('en-PK')}</td><td class="r">${sum.disc.toLocaleString('en-PK')}</td><td class="r">${sum.recv.toLocaleString('en-PK')}</td><td class="r">${sum.pend.toLocaleString('en-PK')}</td></tr></tfoot>
      </table>`, isBW);
  }
  /* class */
  const trs = (rows || []).map(({ s, heads }, j) => {
    const sum = heads.reduce((a, r) => ({ total: a.total + r.total, disc: a.disc + r.disc, recv: a.recv + r.recv, pend: a.pend + r.pend }), { total: 0, disc: 0, recv: 0, pend: 0 });
    return `<tr><td>${j + 1}</td><td><b>${escHtml(s.name)}</b><br><small>s/o ${escHtml(s.father || '—')}</small></td><td>${escHtml(s.reg)}</td><td class="r">${sum.total.toLocaleString('en-PK')}</td><td class="r">${sum.disc.toLocaleString('en-PK')}</td><td class="r pos">${sum.recv.toLocaleString('en-PK')}</td><td class="r ${sum.pend > 0 ? 'neg' : ''}">${sum.pend.toLocaleString('en-PK')}</td></tr>`;
  }).join('');
  return repWrap(`Class Head-Wise Collection — ${c.cls} (${c.sec})`,
    `<span><b>Class:</b> ${escHtml(c.cls)} — ${escHtml(c.sec)}</span><span><b>Head:</b> ${escHtml(head)}</span><span><b>Range:</b> ${escHtml(from)} → ${escHtml(to)}</span>`,
    `<table class="rep-tbl"><thead><tr><th>Sn.</th><th>Student</th><th>Reg No</th><th class="r">Standard</th><th class="r">Discount</th><th class="r">Received</th><th class="r">Pending</th></tr></thead><tbody>${trs}</tbody></table>`, isBW);
}

function buildRepAgingHTML({ list, tot, asOf, isBW = false }) {
  const trs = list.map((x, j) => `<tr><td>${j + 1}</td><td><b>${escHtml(x.s.name)}</b><br><small>s/o ${escHtml(x.s.father || '—')}</small></td><td>${escHtml(x.c.cls)}/${escHtml(x.c.sec)}</td><td class="r">${x.a.cur.toLocaleString('en-PK')}</td><td class="r amb">${x.a.d30.toLocaleString('en-PK')}</td><td class="r amb">${x.a.d60.toLocaleString('en-PK')}</td><td class="r neg">${x.a.d90.toLocaleString('en-PK')}</td><td class="r"><b>${x.m.remaining.toLocaleString('en-PK')}</b></td></tr>`).join('');
  return repWrap('Aging / Outstanding Analysis',
    `<span><b>As of:</b> ${escHtml(asOf)}</span><span><b>Students with dues:</b> ${list.length}</span><span><b>Grand Outstanding:</b> Rs. ${(tot.cur + tot.d30 + tot.d60 + tot.d90).toLocaleString('en-PK')}</span>`,
    `<div class="kpi-row">
      <div class="kpi"><div class="l">Current</div><div class="v">Rs. ${tot.cur.toLocaleString('en-PK')}</div></div>
      <div class="kpi"><div class="l">1–30 Days</div><div class="v">Rs. ${tot.d30.toLocaleString('en-PK')}</div></div>
      <div class="kpi"><div class="l">31–60 Days</div><div class="v">Rs. ${tot.d60.toLocaleString('en-PK')}</div></div>
      <div class="kpi"><div class="l">61–90+ Days</div><div class="v">Rs. ${tot.d90.toLocaleString('en-PK')}</div></div>
    </div>
    <table class="rep-tbl"><thead><tr><th>Sn.</th><th>Student</th><th>Class/Sec</th><th class="r">Current</th><th class="r">1–30</th><th class="r">31–60</th><th class="r">61–90+</th><th class="r">Total Due</th></tr></thead>
      <tbody>${trs}</tbody>
      <tfoot><tr class="rep-grandtot"><td colspan="3" style="text-align:right">GRAND TOTAL</td><td class="r">${tot.cur.toLocaleString('en-PK')}</td><td class="r">${tot.d30.toLocaleString('en-PK')}</td><td class="r">${tot.d60.toLocaleString('en-PK')}</td><td class="r">${tot.d90.toLocaleString('en-PK')}</td><td class="r">${(tot.cur + tot.d30 + tot.d60 + tot.d90).toLocaleString('en-PK')}</td></tr></tfoot>
    </table>`, isBW);
}

function buildRepSummaryHTML({ totals, real, modes, modeTot, sectionsData, isBW = false }) {
  const sectionRows = sectionsData.map((c, j) => {
    const pend = Math.max(c.e - c.r, 0);
    const pct  = c.e > 0 ? Math.round(c.r / c.e * 100) : 0;
    return `<tr><td>${j + 1}</td><td><b>${escHtml(c.label)}</b></td><td class="r">${c.e.toLocaleString('en-PK')}</td><td class="r pos">${c.r.toLocaleString('en-PK')}</td><td class="r ${pend > 0 ? 'neg' : ''}">${pend.toLocaleString('en-PK')}</td><td class="r">${pct}%</td></tr>`;
  }).join('');
  const modeRows = modes.map((m, j) => {
    const pct = Math.round(m.amt / modeTot * 100);
    return `<tr><td>${j + 1}</td><td><b>${escHtml(m.name)}</b></td><td class="r pos">${m.amt.toLocaleString('en-PK')}</td><td class="r">${pct}%</td></tr>`;
  }).join('');
  return repWrap('Collection vs Expected',
    `<span><b>Realisation:</b> ${real}%</span><span><b>Defaulters:</b> ${totals.def}</span><span><b>Modes:</b> ${modes.length}</span>`,
    `<div class="kpi-row">
      <div class="kpi"><div class="l">Expected Revenue</div><div class="v">Rs. ${totals.exp.toLocaleString('en-PK')}</div></div>
      <div class="kpi"><div class="l">Collected</div><div class="v">Rs. ${totals.recv.toLocaleString('en-PK')}</div></div>
      <div class="kpi"><div class="l">Discount / Waiver</div><div class="v">Rs. ${totals.disc.toLocaleString('en-PK')}</div></div>
      <div class="kpi"><div class="l">Outstanding</div><div class="v">Rs. ${totals.pend.toLocaleString('en-PK')}</div></div>
    </div>
    <div class="rep-secttl">Expected vs Collected by Section</div>
    <table class="rep-tbl"><thead><tr><th>Sn.</th><th>Section</th><th class="r">Expected</th><th class="r">Collected</th><th class="r">Pending</th><th class="r">% Realised</th></tr></thead><tbody>${sectionRows}</tbody></table>
    <div class="rep-secttl">Collection by Payment Mode</div>
    <table class="rep-tbl"><thead><tr><th>Sn.</th><th>Method</th><th class="r">Amount</th><th class="r">% of Receipts</th></tr></thead><tbody>${modeRows}</tbody></table>`, isBW);
}

function buildRepPayModeHTML({ method, rows, isBW = false }) {
  const trs = rows.map((r, j) => `<tr><td>${j + 1}</td><td><b>${escHtml(r.name)}</b><br><small>s/o ${escHtml(r.father || '—')}</small></td><td>${escHtml(r.cls)}</td><td>${escHtml(r.reg)}</td><td>${escHtml(r.date)}${r.time ? `<br><small>${escHtml(fmtTime12(r.time))}</small>` : ''}</td><td>${escHtml(r.ref)}</td><td class="r pos">${(+r.amt || 0).toLocaleString('en-PK')}</td></tr>`).join('');
  const total = rows.reduce((a, r) => a + (+r.amt || 0), 0);
  return repWrap(`${method} Collections`,
    `<span><b>Mode:</b> ${escHtml(method)}</span><span><b>Records:</b> ${rows.length}</span><span><b>Total:</b> Rs. ${total.toLocaleString('en-PK')}</span>`,
    `<table class="rep-tbl"><thead><tr><th>Sn.</th><th>Student</th><th>Class/Sec</th><th>Reg No</th><th>Date &amp; Time</th><th>Reference</th><th class="r">Amount</th></tr></thead>
      <tbody>${trs || `<tr><td colspan="7" style="text-align:center;color:#94A3B8">No payments via ${escHtml(method)}.</td></tr>`}</tbody>
      <tfoot><tr class="rep-tot"><td colspan="6">Total</td><td class="r">${total.toLocaleString('en-PK')}</td></tr></tfoot>
    </table>`, isBW);
}

function buildTransportReportHTML({ cls, sec, rows, isBW = false }) {
  const charged   = rows.filter(r => +r.transport > 0);
  const subtotal  = rows.reduce((s, r) => s + (+r.transport || 0), 0);
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const trs = rows.map((s, i) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #E5E7EB">${i + 1}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #E5E7EB">${escHtml(s.reg)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #E5E7EB"><b>${escHtml(s.name)}</b></td>
      <td style="padding:8px 10px;border-bottom:1px solid #E5E7EB">${escHtml(s.father)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #E5E7EB;text-align:right;font-variant-numeric:tabular-nums">${+s.transport > 0 ? `Rs. ${(+s.transport).toLocaleString('en-PK')}` : '<span style="color:#94A3B8">—</span>'}</td>
    </tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escHtml(`Transport Fee — ${cls} (${sec})`)}</title>
<style>
  body { margin:0; font-family:'Segoe UI',Arial,sans-serif; color:#0F172A; background:#fff; font-size:13px; }
  .page { width:210mm; margin:0 auto; padding:18mm 14mm; box-sizing:border-box; }
  .header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #1E3A8A; padding-bottom:14px; margin-bottom:18px; }
  .school { font-size:18px; font-weight:800; color:#1E3A8A; letter-spacing:-.01em; }
  .title  { font-size:14px; font-weight:700; color:#1E40AF; margin-top:6px; }
  .meta   { font-size:11px; color:#64748B; text-align:right; line-height:1.55; }
  table { width:100%; border-collapse:collapse; margin-top:8px; }
  thead th { background:#EFF6FF; color:#1E3A5F; font-weight:800; text-align:left; padding:10px; border-bottom:2px solid #BFDBFE; font-size:11px; text-transform:uppercase; letter-spacing:.4px; }
  thead th.right { text-align:right; }
  tfoot td { padding:10px; font-weight:800; background:#F8FAFF; border-top:2px solid #1E3A8A; }
  tfoot td.right { text-align:right; }
  @media print { @page { size:A4; margin:14mm; } body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head><body>
<div class="page">
  <div class="header">
    <div>
      <div class="school">The Oxford System, Lahore Campus</div>
      <div class="title">Transport Fee — ${escHtml(cls)} (${escHtml(sec)})</div>
    </div>
    <div class="meta">Generated: ${escHtml(today)}<br/>${charged.length} of ${rows.length} student${rows.length === 1 ? '' : 's'} using transport</div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:48px">#</th>
        <th style="width:130px">Reg No</th>
        <th>Name</th>
        <th>Father Name</th>
        <th class="right" style="width:140px">Transport Fee</th>
      </tr>
    </thead>
    <tbody>${trs || `<tr><td colspan="5" style="text-align:center;padding:18px;color:#64748B">No students enrolled.</td></tr>`}</tbody>
    ${rows.length > 0 ? `<tfoot><tr><td colspan="4">Monthly transport collection</td><td class="right">Rs. ${subtotal.toLocaleString('en-PK')}</td></tr></tfoot>` : ''}
  </table>
</div>
</body></html>`;
}

/* ═══════════════════════════════════════════════════════════════════
   CHALLAN DOC BUILDER — Parent · Bank · School three-copy challan
   layout, ported from the HTML reference (.fee-challan-doc namespace).
   Used by both the Eye (preview) and Download flows.
   ═══════════════════════════════════════════════════════════════════ */

const FEE_SCHOOL = {
  name:      'The Oxford System, Lahore Campus',
  monogram:  'OS',
  psid:      '4321-9876-5432',
};

const FEE_LOGO_SVG = `<svg viewBox="0 0 16 16" fill="none"><path d="M8 1L1 5l7 3.5L15 5 8 1z" stroke="#111" stroke-width="1" stroke-linejoin="round"/><path d="M1 9l7 3.5L15 9" stroke="#111" stroke-width="0.8" stroke-linecap="round"/><path d="M1 12l7 3.5L15 12" stroke="#111" stroke-width="0.5" stroke-linecap="round" opacity="0.5"/></svg>`;
const FEE_QR_SVG   = `<svg width="52" height="52" viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg"><rect width="52" height="52" fill="white"/><rect x="2" y="2" width="18" height="18" fill="none" stroke="#222" stroke-width="1.5" rx="1"/><rect x="6" y="6" width="10" height="10" fill="#222" rx="0.5"/><rect x="32" y="2" width="18" height="18" fill="none" stroke="#222" stroke-width="1.5" rx="1"/><rect x="36" y="6" width="10" height="10" fill="#222" rx="0.5"/><rect x="2" y="32" width="18" height="18" fill="none" stroke="#222" stroke-width="1.5" rx="1"/><rect x="6" y="36" width="10" height="10" fill="#222" rx="0.5"/><rect x="32" y="32" width="4" height="4" fill="#222"/><rect x="38" y="32" width="4" height="4" fill="#222"/><rect x="44" y="32" width="6" height="4" fill="#222"/><rect x="32" y="38" width="6" height="4" fill="#222"/><rect x="44" y="38" width="4" height="4" fill="#222"/><rect x="32" y="44" width="4" height="6" fill="#222"/><rect x="38" y="44" width="6" height="4" fill="#222"/><rect x="46" y="44" width="4" height="6" fill="#222"/><rect x="24" y="24" width="4" height="4" fill="#222"/></svg>`;
const FEE_BARCODE_SVG = `<svg width="110" height="20" viewBox="0 0 110 20"><rect x="0" y="0" width="2" height="20" fill="#444"/><rect x="4" y="0" width="1" height="20" fill="#444"/><rect x="7" y="0" width="3" height="20" fill="#444"/><rect x="12" y="0" width="1" height="20" fill="#444"/><rect x="15" y="0" width="2" height="20" fill="#444"/><rect x="19" y="0" width="4" height="20" fill="#444"/><rect x="25" y="0" width="1" height="20" fill="#444"/><rect x="28" y="0" width="2" height="20" fill="#444"/><rect x="32" y="0" width="3" height="20" fill="#444"/><rect x="37" y="0" width="1" height="20" fill="#444"/><rect x="40" y="0" width="2" height="20" fill="#444"/><rect x="44" y="0" width="4" height="20" fill="#444"/><rect x="50" y="0" width="1" height="20" fill="#444"/><rect x="53" y="0" width="3" height="20" fill="#444"/><rect x="58" y="0" width="2" height="20" fill="#444"/><rect x="62" y="0" width="1" height="20" fill="#444"/><rect x="65" y="0" width="4" height="20" fill="#444"/><rect x="71" y="0" width="2" height="20" fill="#444"/><rect x="75" y="0" width="1" height="20" fill="#444"/><rect x="78" y="0" width="3" height="20" fill="#444"/><rect x="83" y="0" width="2" height="20" fill="#444"/><rect x="87" y="0" width="1" height="20" fill="#444"/><rect x="90" y="0" width="4" height="20" fill="#444"/><rect x="96" y="0" width="2" height="20" fill="#444"/><rect x="100" y="0" width="1" height="20" fill="#444"/><rect x="103" y="0" width="3" height="20" fill="#444"/></svg>`;

/* Scoped under .fee-challan-doc so it can be embedded in the in-app preview
   without leaking into surrounding styles. */
const FEE_CHALLAN_CSS_SCOPED = `
.fee-challan-doc, .fee-challan-doc *{box-sizing:border-box;margin:0;padding:0;color:#111;}
.fee-challan-doc{font-family:'DM Sans','Plus Jakarta Sans','Segoe UI',sans-serif;color:#111;background:transparent;}
.fee-challan-doc .challan-page{background:#fff;padding:8mm;margin:0 auto 14px;max-width:1100px;box-shadow:0 4px 18px rgba(15,23,42,.08);border:1px solid #E5E7EB;}
.fee-challan-doc .challan-page + .challan-page{margin-top:14px;}
.fee-challan-doc .challan-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border:1px solid #000;}
.fee-challan-doc .slip{background:#fff;border-right:1px dashed #aaa;display:flex;flex-direction:column;}
.fee-challan-doc .slip:last-child{border-right:none;}
.fee-challan-doc .slip-header{border-bottom:1px solid #bbb;padding:8px 10px;display:flex;align-items:center;gap:8px;}
.fee-challan-doc .logo-circle{width:28px;height:28px;border:1.5px solid #333;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.fee-challan-doc .logo-circle svg{width:14px;height:14px;}
.fee-challan-doc .school-name{font-size:12px;font-weight:600;color:#111;line-height:1.2;}
.fee-challan-doc .copy-tag{font-size:8px;font-weight:500;color:#555;letter-spacing:0.8px;text-transform:uppercase;border:0.5px solid #aaa;padding:1px 5px;border-radius:2px;display:inline-block;margin-top:2px;}
.fee-challan-doc .info-grid{display:grid;grid-template-columns:auto 1fr;column-gap:6px;row-gap:0;padding:7px 10px;border-bottom:1px solid #ddd;}
.fee-challan-doc .ig-lbl{font-size:9px;color:#777;font-weight:500;padding:2.5px 0;white-space:nowrap;}
.fee-challan-doc .ig-val{font-size:9px;color:#111;font-weight:600;padding:2.5px 0;text-align:right;}
.fee-challan-doc .fee-wrap{padding:7px 10px 0;}
.fee-challan-doc .fee-table{width:100%;border-collapse:collapse;font-size:8.5px;}
.fee-challan-doc .fee-table thead tr{border-bottom:0.5px solid #333;}
.fee-challan-doc .fee-table th{font-weight:600;color:#333;padding:2px 0;text-align:left;}
.fee-challan-doc .fee-table th:nth-child(n+2),.fee-challan-doc .fee-table td:nth-child(n+2){text-align:right;}
.fee-challan-doc .fee-table td{padding:2px 0;color:#222;border-bottom:0.5px dashed #ddd;}
.fee-challan-doc .fee-table .tr-total td{border-top:0.5px solid #333;border-bottom:none;font-weight:600;padding-top:3px;font-size:9px;}
.fee-challan-doc .bottom-section{padding:7px 10px;margin-top:auto;}
.fee-challan-doc .two-col{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px;}
.fee-challan-doc .outline-box{border:0.5px solid #999;padding:4px 6px;border-radius:2px;}
.fee-challan-doc .ob-lbl{font-size:8px;color:#666;margin-bottom:1px;}
.fee-challan-doc .ob-val{font-size:11px;font-weight:600;color:#111;font-variant-numeric:tabular-nums;}
.fee-challan-doc .net-box{border:1px solid #111;padding:5px 7px;border-radius:2px;display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;}
.fee-challan-doc .net-box .nb-lbl{font-size:8px;color:#333;font-weight:500;max-width:62px;line-height:1.3;}
.fee-challan-doc .net-box .nb-val{font-size:15px;font-weight:700;font-variant-numeric:tabular-nums;color:#111;}
.fee-challan-doc .fine-line{font-size:7.5px;color:#777;margin-bottom:6px;}
.fee-challan-doc .psid-block{border:1px dashed #555;border-radius:2px;padding:5px 7px;margin-bottom:5px;}
.fee-challan-doc .psid-top{display:flex;align-items:center;gap:4px;margin-bottom:3px;}
.fee-challan-doc .psid-dot{width:5px;height:5px;border-radius:50%;border:1px solid #333;flex-shrink:0;}
.fee-challan-doc .psid-tag{font-size:7.5px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;color:#333;}
.fee-challan-doc .psid-num{font-variant-numeric:tabular-nums;font-size:11px;font-weight:600;color:#111;letter-spacing:0.5px;margin-bottom:4px;}
.fee-challan-doc .psid-row{display:flex;align-items:flex-start;gap:6px;}
.fee-challan-doc .qr-wrap{flex-shrink:0;}
.fee-challan-doc .qr-hint{font-size:7.5px;color:#555;line-height:1.6;padding-top:2px;}
.fee-challan-doc .qr-hint strong{color:#222;font-weight:600;}
.fee-challan-doc .steps-block{border-top:0.5px solid #ddd;padding-top:5px;margin-top:1px;}
.fee-challan-doc .steps-title{font-size:7.5px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;color:#555;margin-bottom:3px;}
.fee-challan-doc .step-row{display:flex;gap:4px;align-items:flex-start;margin-bottom:2.5px;}
.fee-challan-doc .sn{width:12px;height:12px;border:0.5px solid #555;border-radius:50%;font-size:6.5px;font-weight:600;color:#333;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.fee-challan-doc .st{font-size:7.5px;color:#444;line-height:1.5;}
.fee-challan-doc .st strong{font-weight:600;color:#111;}
.fee-challan-doc .barcode-area{text-align:center;padding:5px 0 4px;border-top:0.5px solid #ddd;margin-top:5px;opacity:0.55;}
.fee-challan-doc .psid-tiny{font-variant-numeric:tabular-nums;font-size:6px;color:#888;letter-spacing:0.5px;margin-top:2px;}
/* Colorless Report — strips remaining colors to dark-on-white for low-ink printing */
.fee-challan-doc.fee-bw .school-name,
.fee-challan-doc.fee-bw .ig-val,
.fee-challan-doc.fee-bw .ob-val,
.fee-challan-doc.fee-bw .net-box .nb-val,
.fee-challan-doc.fee-bw .psid-num,
.fee-challan-doc.fee-bw .st strong{color:#000;}
.fee-challan-doc.fee-bw .fee-table th,
.fee-challan-doc.fee-bw .ig-lbl,
.fee-challan-doc.fee-bw .ob-lbl,
.fee-challan-doc.fee-bw .qr-hint,
.fee-challan-doc.fee-bw .st,
.fee-challan-doc.fee-bw .fine-line,
.fee-challan-doc.fee-bw .copy-tag,
.fee-challan-doc.fee-bw .psid-tag,
.fee-challan-doc.fee-bw .steps-title{color:#333;}
.fee-challan-doc.fee-bw .logo-circle{border-color:#000;}
.fee-challan-doc.fee-bw .challan-row{border-color:#000;}
.fee-challan-doc.fee-bw .net-box{border-color:#000;}
`;

/* Same rules without the .fee-challan-doc prefix — used when we open a
   dedicated print window so the page can be styled top-to-bottom. */
const FEE_CHALLAN_CSS_PRINT = FEE_CHALLAN_CSS_SCOPED.replace(/\.fee-challan-doc\s+/g, '').replace(/\.fee-challan-doc(?=[,.{])/g, 'body') + `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans','Plus Jakarta Sans','Segoe UI',sans-serif;color:#111;background:#F1F3F8;padding:18px}
.challan-page + .challan-page{margin-top:14px;}
@page{size:A4 landscape;margin:0;}
@media print{ body{background:#fff;padding:0;} .challan-page{box-shadow:none;border:none;page-break-after:always;padding:8mm;} .challan-page:last-child{page-break-after:auto;} }
`;

const fmtChallanDate = (iso) => {
  if (!iso) return '';
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [y, mo, d] = iso.split('-');
  return `${d}-${m[(+mo - 1) || 0]}-${y.slice(2)}`;
};

function feeSlipHTML({ copyLabel, classMeta, student, heads, settings, period, issueISO, dueISO, studentDisc }) {
  const showDisc = settings.showDiscount !== false;
  const showPsd  = settings.showPsd      !== false;
  const fine     = !!settings.fineEnabled;
  const fineAmt  = +settings.fineAmt || 0;
  const fineType = settings.fineType || 'fixed';
  const disMap   = studentDisc || {};

  const rows = heads.map(h => {
    const raw   = +h.amt || 0;
    const dRaw  = +disMap[h.name] || 0;
    const disc  = showDisc ? Math.min(dRaw, raw) : 0;
    return { name: h.name, std: raw, disc, net: raw - disc };
  });
  if (+student.transport > 0) {
    rows.push({ name: 'Transport Fee', std: +student.transport, disc: 0, net: +student.transport });
  }
  const tNet    = rows.reduce((a, r) => a + r.net, 0);
  const arrears = (+student.dues || 0) - (+student.advance || 0);
  const payable = tNet + arrears;
  const fineTxt = `Rs. ${fineAmt.toLocaleString('en-PK')}`;
  const psidPlain = FEE_SCHOOL.psid.replace(/[^0-9]/g, '');

  return `
<div class="slip">
  <div class="slip-header">
    <div class="logo-circle">${FEE_LOGO_SVG}</div>
    <div>
      <div class="school-name">${escHtml(FEE_SCHOOL.name)}</div>
      <span class="copy-tag">${escHtml(copyLabel)}</span>
    </div>
  </div>
  <div class="info-grid">
    <span class="ig-lbl">Fee Period</span><span class="ig-val">${escHtml(period)}</span>
    <span class="ig-lbl">Issue / Due</span><span class="ig-val">${escHtml(fmtChallanDate(issueISO))} / ${escHtml(fmtChallanDate(dueISO))}</span>
    <span class="ig-lbl">Admn. No</span><span class="ig-val">${escHtml(student.reg)}</span>
    <span class="ig-lbl">Student</span><span class="ig-val">${escHtml(student.name)}</span>
    <span class="ig-lbl">Father</span><span class="ig-val">${escHtml(student.father || '—')}</span>
    <span class="ig-lbl">Class</span><span class="ig-val">${escHtml(classMeta.cls)}-${escHtml(classMeta.sec)}</span>
  </div>
  <div class="fee-wrap">
    <table class="fee-table">
      <thead><tr><th>Fee Head</th><th>Std.</th><th>Disc</th><th>Net</th></tr></thead>
      <tbody>
        ${rows.map(r => `<tr><td>${escHtml(r.name)}</td><td>${r.std.toLocaleString('en-PK')}</td><td>${r.disc ? r.disc.toLocaleString('en-PK') : '—'}</td><td>${r.net.toLocaleString('en-PK')}</td></tr>`).join('')}
        <tr class="tr-total"><td colspan="3">Total</td><td>${tNet.toLocaleString('en-PK')}</td></tr>
      </tbody>
    </table>
  </div>
  <div class="bottom-section">
    <div class="two-col">
      <div class="outline-box"><div class="ob-lbl">Arrears / Advance</div><div class="ob-val">${arrears.toLocaleString('en-PK')}</div></div>
      ${fine
        ? `<div class="outline-box"><div class="ob-lbl">Fine (${fineType === 'daily' ? 'per day late' : 'after due date'})</div><div class="ob-val">${fineTxt}</div></div>`
        : `<div class="outline-box"><div class="ob-lbl">Fine</div><div class="ob-val">—</div></div>`}
    </div>
    <div class="net-box"><div class="nb-lbl">Net Payable Before Due Date</div><div class="nb-val">Rs. ${payable.toLocaleString('en-PK')}</div></div>
    ${fine ? `<div class="fine-line">After due date: Rs. ${payable.toLocaleString('en-PK')} + (no. of days × ${fineAmt})</div>` : ''}
    ${showPsd ? `
    <div class="psid-block">
      <div class="psid-top"><div class="psid-dot"></div><span class="psid-tag">1Link PSID — Pay via Any Banking App</span></div>
      <div class="psid-num">${escHtml(FEE_SCHOOL.psid)}</div>
      <div class="psid-row">
        <div class="qr-wrap">${FEE_QR_SVG}</div>
        <div class="qr-hint"><strong>Scan QR</strong> with your banking app<br/>OR enter PSID manually.<br/>Works on HBL, MCB, Meezan,<br/>UBL, Sadapay, Easypaisa &amp; more.</div>
      </div>
    </div>` : ''}
    <div class="steps-block">
      <div class="steps-title">How to pay — 1Link PSID</div>
      <div class="step-row"><div class="sn">1</div><div class="st">Open your <strong>banking app</strong></div></div>
      <div class="step-row"><div class="sn">2</div><div class="st">Tap <strong>Bill Payment &rarr; Education</strong></div></div>
      <div class="step-row"><div class="sn">3</div><div class="st">Enter PSID — <strong>amount auto-fills</strong></div></div>
      <div class="step-row"><div class="sn">4</div><div class="st"><strong>Confirm &amp; pay</strong> — save your SMS receipt</div></div>
    </div>
    <div class="barcode-area">${FEE_BARCODE_SVG}<div class="psid-tiny">PSID: ${escHtml(psidPlain)}</div></div>
  </div>
</div>`;
}

function buildChallanInner({ classMeta, students, heads, settings, discountMap, bw = false, size = 'a4' }) {
  const today    = new Date();
  const issueISO = today.toISOString().slice(0, 10);
  const dueDate  = new Date(today); dueDate.setDate(dueDate.getDate() + 10);
  const dueISO   = dueDate.toISOString().slice(0, 10);
  const m = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const period  = `${m[today.getMonth()]} ${today.getFullYear()}`;
  const classDisc = (discountMap && discountMap[classMeta.key]) || {};

  if (size === 'thermal') {
    const slips = students.map(s => feeThermalChallanHTML({
      classMeta, student: s, heads, settings, period, issueISO, dueISO,
      studentDisc: classDisc[s.reg] || {},
    })).join('');
    return `<div class="fee-thermal-doc">${slips || '<div style="padding:14px;text-align:center;color:#64748B">Nothing to render.</div>'}</div>`;
  }

  const pages = students.map(s => {
    const sd = classDisc[s.reg] || {};
    return `
    <div class="challan-page">
      <div class="challan-row">
        ${feeSlipHTML({ copyLabel: 'Parent Copy', classMeta, student: s, heads, settings, period, issueISO, dueISO, studentDisc: sd })}
        ${feeSlipHTML({ copyLabel: 'Bank Copy',   classMeta, student: s, heads, settings, period, issueISO, dueISO, studentDisc: sd })}
        ${feeSlipHTML({ copyLabel: 'School Copy', classMeta, student: s, heads, settings, period, issueISO, dueISO, studentDisc: sd })}
      </div>
    </div>`;
  }).join('');

  return `<div class="fee-challan-doc${bw ? ' fee-bw' : ''}">${pages || '<div style="padding:30px;text-align:center;color:#64748B">Nothing to render.</div>'}</div>`;
}

function buildChallanHTML(opts) {
  const size = opts.size || 'a4';
  const css  = size === 'thermal' ? FEE_THERMAL_CHALLAN_CSS : FEE_CHALLAN_CSS_PRINT;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escHtml(`Fee Challan — ${opts.classMeta.cls} (${opts.classMeta.sec})`)}</title>
<style>${css}</style></head><body>${buildChallanInner(opts)}</body></html>`;
}

/* ─── Thermal (80mm) challan slip — single column, same data as A4
       3-copy slip but compact for receipt printers. ───────────────── */
const FEE_THERMAL_CHALLAN_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;color:#111;background:#fff;padding:6px;font-size:11px;}
.fee-thermal-doc{}
.th-challan{width:80mm;margin:0 auto 10px;padding:5mm 4mm;border-bottom:1px dashed #888;page-break-after:always;}
.th-challan:last-child{border-bottom:none;page-break-after:auto;}
.th-school{font-size:13.5px;font-weight:800;text-align:center;}
.th-tag{font-size:9.5px;letter-spacing:1px;text-transform:uppercase;color:#555;text-align:center;margin-top:2px;padding-bottom:6px;border-bottom:1.5px solid #111;margin-bottom:6px;}
.th-kv{display:grid;grid-template-columns:auto 1fr;column-gap:6px;row-gap:1px;font-size:10.5px;margin-bottom:7px;}
.th-kv .k{color:#666;}
.th-kv .v{text-align:right;font-weight:700;}
.th-section{font-size:9px;text-transform:uppercase;letter-spacing:.6px;color:#666;margin-top:7px;margin-bottom:3px;font-weight:700;border-top:0.5px dashed #aaa;padding-top:5px;}
.th-tbl{width:100%;border-collapse:collapse;font-size:10.5px;margin-bottom:4px;}
.th-tbl th,.th-tbl td{padding:2px 0;border-bottom:0.5px dashed #ddd;}
.th-tbl th{font-weight:700;color:#333;text-align:left;}
.th-tbl th.right,.th-tbl td.right{text-align:right;}
.th-tbl .tr-total td{border-top:1px solid #111;border-bottom:none;font-weight:800;padding-top:3px;}
.th-net{display:flex;justify-content:space-between;align-items:center;background:#111;color:#fff;padding:6px 10px;border-radius:3px;font-weight:800;font-size:12px;margin:6px 0;}
.th-fine{font-size:9px;color:#777;margin-bottom:5px;}
.th-psid{border:1px dashed #555;border-radius:3px;padding:5px 8px;margin-top:5px;}
.th-psid-top{font-size:9px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:#333;margin-bottom:3px;}
.th-psid-num{font-size:11.5px;font-weight:800;color:#111;margin-bottom:3px;letter-spacing:.5px;font-variant-numeric:tabular-nums;}
.th-psid-hint{font-size:8.5px;color:#555;line-height:1.4;}
.th-steps{margin-top:5px;font-size:9px;color:#444;}
.th-steps .s{display:flex;gap:5px;margin-bottom:1px;}
.th-steps .s b{color:#111;}
@page{size:80mm auto;margin:0;}
@media print{ body{padding:0;} .th-challan{page-break-after:always;} .th-challan:last-child{page-break-after:auto;} }
`;

function feeThermalChallanHTML({ classMeta, student, heads, settings, period, issueISO, dueISO, studentDisc }) {
  const showDisc = settings.showDiscount !== false;
  const showPsd  = settings.showPsd      !== false;
  const fine     = !!settings.fineEnabled;
  const fineAmt  = +settings.fineAmt || 0;
  const fineType = settings.fineType || 'fixed';
  const disMap   = studentDisc || {};

  const rows = heads.map(h => {
    const raw  = +h.amt || 0;
    const dRaw = +disMap[h.name] || 0;
    const disc = showDisc ? Math.min(dRaw, raw) : 0;
    return { name: h.name, std: raw, disc, net: raw - disc };
  });
  if (+student.transport > 0) {
    rows.push({ name: 'Transport Fee', std: +student.transport, disc: 0, net: +student.transport });
  }
  const tNet    = rows.reduce((a, r) => a + r.net, 0);
  const arrears = (+student.dues || 0) - (+student.advance || 0);
  const payable = tNet + arrears;
  const fineTxt = `Rs. ${fineAmt.toLocaleString('en-PK')}`;
  const showDiscCol = rows.some(r => r.disc > 0);

  return `
<div class="th-challan">
  <div class="th-school">${escHtml(FEE_SCHOOL.name)}</div>
  <div class="th-tag">Fee Challan</div>
  <div class="th-kv">
    <span class="k">Period</span><span class="v">${escHtml(period)}</span>
    <span class="k">Issue / Due</span><span class="v">${escHtml(fmtChallanDate(issueISO))} / ${escHtml(fmtChallanDate(dueISO))}</span>
    <span class="k">Student</span><span class="v">${escHtml(student.name)}</span>
    <span class="k">Father</span><span class="v">${escHtml(student.father || '—')}</span>
    <span class="k">Class</span><span class="v">${escHtml(classMeta.cls)} (${escHtml(classMeta.sec)})</span>
    <span class="k">Admn. No</span><span class="v">${escHtml(student.reg)}</span>
  </div>
  <div class="th-section">Fee Heads</div>
  <table class="th-tbl">
    <thead>
      <tr>
        <th>Head</th>
        <th class="right">Std.</th>
        ${showDiscCol ? '<th class="right">Disc</th>' : ''}
        <th class="right">Net</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(r => `<tr>
        <td>${escHtml(r.name)}</td>
        <td class="right">${r.std.toLocaleString('en-PK')}</td>
        ${showDiscCol ? `<td class="right">${r.disc ? r.disc.toLocaleString('en-PK') : '—'}</td>` : ''}
        <td class="right">${r.net.toLocaleString('en-PK')}</td>
      </tr>`).join('')}
      <tr class="tr-total"><td colspan="${showDiscCol ? 3 : 2}">Total</td><td class="right">${tNet.toLocaleString('en-PK')}</td></tr>
    </tbody>
  </table>
  <div class="th-kv" style="margin-top:6px">
    <span class="k">Arrears / Advance</span><span class="v">${arrears.toLocaleString('en-PK')}</span>
    ${fine ? `<span class="k">Fine (${fineType === 'daily' ? 'per day' : 'after due'})</span><span class="v">${fineTxt}</span>` : ''}
  </div>
  <div class="th-net">
    <span>Net Payable</span>
    <span>Rs. ${payable.toLocaleString('en-PK')}</span>
  </div>
  ${fine ? `<div class="th-fine">After due: Rs. ${payable.toLocaleString('en-PK')} + (days × ${fineAmt})</div>` : ''}
  ${showPsd ? `
  <div class="th-psid">
    <div class="th-psid-top">1Link PSID</div>
    <div class="th-psid-num">${escHtml(FEE_SCHOOL.psid)}</div>
    <div class="th-psid-hint">Scan QR / enter PSID in your banking app. Works on HBL, MCB, Meezan, UBL, Sadapay, Easypaisa &amp; more.</div>
  </div>` : ''}
  <div class="th-steps">
    <div class="s"><b>1.</b> Open banking app</div>
    <div class="s"><b>2.</b> Tap Bill Payment → Education</div>
    <div class="s"><b>3.</b> Enter PSID — amount auto-fills</div>
    <div class="s"><b>4.</b> Confirm &amp; pay</div>
  </div>
</div>`;
}

/* ── Family combined challan: one slip lists every child as a row ── */
function feeFamilySlipHTML({ copyLabel, family, settings, period, issueISO, dueISO }) {
  const showPsd = settings.showPsd !== false;
  const rows = family.children.map(ch => ({
    name: `${ch.name} (${ch.cls}-${ch.sec})`,
    std:  (+ch.fee || 0) + (+ch.transport || 0),
    disc: (+ch.discount || 0),
    net:  (+ch.fee || 0) + (+ch.transport || 0) - (+ch.discount || 0),
  }));
  const tNet = rows.reduce((a, r) => a + r.net, 0);
  const psidPlain = FEE_SCHOOL.psid.replace(/[^0-9]/g, '');

  return `
<div class="slip">
  <div class="slip-header">
    <div class="logo-circle">${FEE_LOGO_SVG}</div>
    <div>
      <div class="school-name">${escHtml(FEE_SCHOOL.name)}</div>
      <span class="copy-tag">${escHtml(copyLabel)}</span>
    </div>
  </div>
  <div class="info-grid">
    <span class="ig-lbl">Fee Period</span><span class="ig-val">${escHtml(period)}</span>
    <span class="ig-lbl">Issue / Due</span><span class="ig-val">${escHtml(fmtChallanDate(issueISO))} / ${escHtml(fmtChallanDate(dueISO))}</span>
    <span class="ig-lbl">Family</span><span class="ig-val">${escHtml(family.name)}</span>
    <span class="ig-lbl">Guardian</span><span class="ig-val">${escHtml(family.guardian)}</span>
    <span class="ig-lbl">Children</span><span class="ig-val">${family.children.length}</span>
  </div>
  <div class="fee-wrap">
    <table class="fee-table">
      <thead><tr><th>Child (Class)</th><th>Std.</th><th>Disc</th><th>Net</th></tr></thead>
      <tbody>
        ${rows.map(r => `<tr><td>${escHtml(r.name)}</td><td>${r.std.toLocaleString('en-PK')}</td><td>${r.disc ? r.disc.toLocaleString('en-PK') : '—'}</td><td>${r.net.toLocaleString('en-PK')}</td></tr>`).join('')}
        <tr class="tr-total"><td colspan="3">Total</td><td>${tNet.toLocaleString('en-PK')}</td></tr>
      </tbody>
    </table>
  </div>
  <div class="bottom-section">
    <div class="net-box"><div class="nb-lbl">Total Family Payable</div><div class="nb-val">Rs. ${tNet.toLocaleString('en-PK')}</div></div>
    ${showPsd ? `
    <div class="psid-block">
      <div class="psid-top"><div class="psid-dot"></div><span class="psid-tag">1Link PSID — Pay via Any Banking App</span></div>
      <div class="psid-num">${escHtml(FEE_SCHOOL.psid)}</div>
      <div class="psid-row">
        <div class="qr-wrap">${FEE_QR_SVG}</div>
        <div class="qr-hint"><strong>Scan QR</strong> with your banking app<br/>OR enter PSID manually.<br/>Works on HBL, MCB, Meezan,<br/>UBL, Sadapay, Easypaisa &amp; more.</div>
      </div>
    </div>` : ''}
    <div class="steps-block">
      <div class="steps-title">How to pay — 1Link PSID</div>
      <div class="step-row"><div class="sn">1</div><div class="st">Open your <strong>banking app</strong></div></div>
      <div class="step-row"><div class="sn">2</div><div class="st">Tap <strong>Bill Payment &rarr; Education</strong></div></div>
      <div class="step-row"><div class="sn">3</div><div class="st">Enter PSID — <strong>amount auto-fills</strong></div></div>
      <div class="step-row"><div class="sn">4</div><div class="st"><strong>Confirm &amp; pay</strong></div></div>
    </div>
    <div class="barcode-area">${FEE_BARCODE_SVG}<div class="psid-tiny">PSID: ${escHtml(psidPlain)}</div></div>
  </div>
</div>`;
}

function buildFamilyChallanInner({ family, settings, bw = false, size = 'a4' }) {
  const today    = new Date();
  const issueISO = today.toISOString().slice(0, 10);
  const dueDate  = new Date(today); dueDate.setDate(dueDate.getDate() + 10);
  const dueISO   = dueDate.toISOString().slice(0, 10);
  const m = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const period  = `${m[today.getMonth()]} ${today.getFullYear()}`;

  if (size === 'thermal') {
    return `<div class="fee-thermal-doc">${feeThermalFamilyChallanHTML({ family, settings, period, issueISO, dueISO })}</div>`;
  }

  const page = `
    <div class="challan-page">
      <div class="challan-row">
        ${feeFamilySlipHTML({ copyLabel: 'Parent Copy', family, settings, period, issueISO, dueISO })}
        ${feeFamilySlipHTML({ copyLabel: 'Bank Copy',   family, settings, period, issueISO, dueISO })}
        ${feeFamilySlipHTML({ copyLabel: 'School Copy', family, settings, period, issueISO, dueISO })}
      </div>
    </div>`;

  return `<div class="fee-challan-doc${bw ? ' fee-bw' : ''}">${page}</div>`;
}

function buildFamilyChallanHTML(opts) {
  const size = opts.size || 'a4';
  const css  = size === 'thermal' ? FEE_THERMAL_CHALLAN_CSS : FEE_CHALLAN_CSS_PRINT;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escHtml(`Family Challan — ${opts.family.name}`)}</title>
<style>${css}</style></head><body>${buildFamilyChallanInner(opts)}</body></html>`;
}

function feeThermalFamilyChallanHTML({ family, settings, period, issueISO, dueISO }) {
  const showPsd = settings.showPsd !== false;
  const rows = family.children.map(ch => ({
    name: `${ch.name} (${ch.cls}-${ch.sec})`,
    std:  (+ch.fee || 0) + (+ch.transport || 0),
    disc: (+ch.discount || 0),
    net:  (+ch.fee || 0) + (+ch.transport || 0) - (+ch.discount || 0),
  }));
  const tNet = rows.reduce((a, r) => a + r.net, 0);

  return `
<div class="th-challan">
  <div class="th-school">${escHtml(FEE_SCHOOL.name)}</div>
  <div class="th-tag">Family Fee Challan</div>
  <div class="th-kv">
    <span class="k">Period</span><span class="v">${escHtml(period)}</span>
    <span class="k">Issue / Due</span><span class="v">${escHtml(fmtChallanDate(issueISO))} / ${escHtml(fmtChallanDate(dueISO))}</span>
    <span class="k">Family</span><span class="v">${escHtml(family.name)}</span>
    <span class="k">Guardian</span><span class="v">${escHtml(family.guardian)}</span>
    <span class="k">Children</span><span class="v">${family.children.length}</span>
  </div>
  <div class="th-section">Children &amp; Fees</div>
  <table class="th-tbl">
    <thead>
      <tr><th>Child (Class)</th><th class="right">Std.</th><th class="right">Disc</th><th class="right">Net</th></tr>
    </thead>
    <tbody>
      ${rows.map(r => `<tr>
        <td>${escHtml(r.name)}</td>
        <td class="right">${r.std.toLocaleString('en-PK')}</td>
        <td class="right">${r.disc ? r.disc.toLocaleString('en-PK') : '—'}</td>
        <td class="right">${r.net.toLocaleString('en-PK')}</td>
      </tr>`).join('')}
      <tr class="tr-total"><td colspan="3">Total</td><td class="right">${tNet.toLocaleString('en-PK')}</td></tr>
    </tbody>
  </table>
  <div class="th-net">
    <span>Total Family Payable</span>
    <span>Rs. ${tNet.toLocaleString('en-PK')}</span>
  </div>
  ${showPsd ? `
  <div class="th-psid">
    <div class="th-psid-top">1Link PSID</div>
    <div class="th-psid-num">${escHtml(FEE_SCHOOL.psid)}</div>
    <div class="th-psid-hint">Scan QR / enter PSID in your banking app. Works on HBL, MCB, Meezan, UBL, Sadapay, Easypaisa &amp; more.</div>
  </div>` : ''}
  <div class="th-steps">
    <div class="s"><b>1.</b> Open banking app</div>
    <div class="s"><b>2.</b> Tap Bill Payment → Education</div>
    <div class="s"><b>3.</b> Enter PSID — amount auto-fills</div>
    <div class="s"><b>4.</b> Confirm &amp; pay</div>
  </div>
</div>`;
}

/* ═══════════════════════════════════════════════════════════════════
   FEE CHALLAN SETTINGS — three master toggles + dependent fine config.
   Discount / PSD code show on every challan; Fine is conditional, with
   fine type (Fixed / Per Day) and amount. All values persist via
   feeService.saveFeeSettings().
   ═══════════════════════════════════════════════════════════════════ */
function FeeChallanSettings({ toast }) {
  const { data: serverSettings, loading } = useAsync(feeService.getFeeSettings, []);
  const [local, setLocal] = useState(null);
  const [saving, setSaving] = useState(false);

  /* Sync server → local once loaded */
  useEffect(() => {
    if (serverSettings && local == null) setLocal(serverSettings);
  }, [serverSettings, local]);

  const value = local || serverSettings || {};
  const dirty = JSON.stringify(value) !== JSON.stringify(serverSettings || {});

  const set = (patch) => setLocal(prev => ({ ...(prev || serverSettings || {}), ...patch }));

  const validateAndSave = async () => {
    if (value.fineEnabled) {
      const amt = Number(value.fineAmt);
      if (Number.isNaN(amt) || amt <= 0) {
        toast('Fine amount must be a positive number', 'error');
        return;
      }
      if (!['fixed', 'daily'].includes(value.fineType)) {
        toast('Pick a fine type', 'error');
        return;
      }
    }
    setSaving(true);
    try {
      await feeService.saveFeeSettings(value);
      toast('Fee challan settings saved', 'success');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !local) {
    return (
      <>
        <div className="fee-info">
          <i className="fa-solid fa-circle-info"></i>
          <span>Loading challan settings…</span>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="fee-info">
        <i className="fa-solid fa-circle-info"></i>
        <span>
          These settings will affect <strong>newly generated challans</strong> — how discounts, fines
          &amp; payment codes appear on each challan and its preview. Already generated challans are
          not changed.
        </span>
      </div>

      <div className="fee-section">
        <div className="fee-section-header">
          <div className="fee-section-title">
            <div className="fee-section-icon"><i className="fa-solid fa-sliders"></i></div>
            <div>
              <div className="fee-section-name">Fee Challan Settings</div>
              <div className="fee-section-sub">
                Control how discounts, fines &amp; codes appear on generated challans
              </div>
            </div>
          </div>
          <Tooltip text={dirty ? 'Save your changes' : 'No changes to save'}>
            <button
              className="fee-btn fee-btn-primary fee-btn-sm"
              onClick={validateAndSave}
              disabled={!dirty || saving}
              style={!dirty || saving ? { opacity: .55, cursor: 'not-allowed' } : undefined}
            >
              <i className={`fa-solid ${saving ? 'fa-circle-notch fa-spin' : 'fa-floppy-disk'}`}></i>
              {saving ? ' Saving…' : ' Save Settings'}
            </button>
          </Tooltip>
        </div>

        <div className="fee-section-body">
          <div className="fee-set-grid">

            {/* Show Discount */}
            <SettingCard
              name="Show Discount on Challan"
              desc="Display the discount column and net payable on every student challan."
              on={value.showDiscount}
              onToggle={() => set({ showDiscount: !value.showDiscount })}
            />

            {/* Show PSD */}
            <SettingCard
              name="Show PSD Code on Challan"
              desc="Print the PSID / bank payment code so parents can pay via bank or app."
              on={value.showPsd}
              onToggle={() => set({ showPsd: !value.showPsd })}
            />

            {/* Fine — with conditional fields */}
            <div className="fee-set-card">
              <div className="fee-set-head">
                <div className="fee-set-name">Fine Status</div>
                <Tooltip text={value.fineEnabled ? 'Disable late-payment fines' : 'Enable late-payment fines'}>
                  <button
                    className={`fee-switch${value.fineEnabled ? ' on' : ''}`}
                    onClick={() => set({ fineEnabled: !value.fineEnabled })}
                    aria-pressed={value.fineEnabled}
                    aria-label="Toggle fine status"
                    type="button"
                  />
                </Tooltip>
              </div>
              <div className="fee-set-desc">Enable late-payment fines applied after the due date.</div>
              {value.fineEnabled && (
                <div className="fee-fine-fields">
                  <div className="fee-field-stack">
                    <label className="fee-mini-label">Fine Type</label>
                    <div className="fee-select-wrap">
                      <select
                        className="fee-select"
                        value={value.fineType}
                        onChange={e => set({ fineType: e.target.value })}
                      >
                        <option value="fixed">Fixed Amount</option>
                        <option value="daily">Per Day Fine</option>
                      </select>
                      <i className="fa-solid fa-chevron-down"></i>
                    </div>
                  </div>
                  <div className="fee-field-stack" style={{ marginBottom: 0 }}>
                    <label className="fee-mini-label">
                      Fine Amount (Rs.){value.fineType === 'daily' ? ' / day' : ''}
                    </label>
                    <input
                      className="fee-input"
                      type="number"
                      min="0"
                      value={value.fineAmt}
                      onChange={e => set({ fineAmt: e.target.value === '' ? '' : Number(e.target.value) })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Print Size — A4 / Thermal default for downloads */}
            <div className="fee-set-card">
              <div className="fee-set-head">
                <div className="fee-set-name">Default Print Size</div>
                <i className="fa-solid fa-print" style={{ color: '#1E3A8A', fontSize: 16 }}></i>
              </div>
              <div className="fee-set-desc">
                Default paper size when downloading challans and fee receipts.
                Download picker still lets you override per action.
              </div>
              <div className="fee-print-size-row">
                <Tooltip text="Full-page receipt with 3-copy challan layout">
                  <button
                    type="button"
                    className={`fee-print-size-opt${(value.printSize || 'a4') === 'a4' ? ' sel' : ''}`}
                    onClick={() => set({ printSize: 'a4' })}
                  >
                    <i className="fa-solid fa-file-lines"></i>
                    <div>
                      <div className="fee-print-size-name">A4 Size</div>
                      <div className="fee-print-size-desc">Full page · 3-copy</div>
                    </div>
                  </button>
                </Tooltip>
                <Tooltip text="80mm thermal receipt printer (compact)">
                  <button
                    type="button"
                    className={`fee-print-size-opt${value.printSize === 'thermal' ? ' sel' : ''}`}
                    onClick={() => set({ printSize: 'thermal' })}
                  >
                    <i className="fa-solid fa-receipt"></i>
                    <div>
                      <div className="fee-print-size-name">Thermal</div>
                      <div className="fee-print-size-desc">80mm receipt printer</div>
                    </div>
                  </button>
                </Tooltip>
              </div>
            </div>

            {/* Decorative shield card */}
            <div className="fee-set-card fee-set-card--accent">
              <i className="fa-solid fa-shield-halved fee-set-shield"></i>
              <div className="fee-set-desc">
                These settings instantly affect challan generation &amp; preview across all classes.
              </div>
            </div>
          </div>

          {/* Live preview hint */}
          <div className="fee-set-summary">
            <div className="fee-set-summary-title">
              <i className="fa-solid fa-eye"></i> Current effect on challan generation
            </div>
            <ul className="fee-set-summary-list">
              <li>
                Discount column on challan: {' '}
                <strong className={value.showDiscount ? 'fee-pos' : 'fee-neg'}>
                  {value.showDiscount ? 'Visible' : 'Hidden'}
                </strong>
              </li>
              <li>
                PSD / bank code on challan: {' '}
                <strong className={value.showPsd ? 'fee-pos' : 'fee-neg'}>
                  {value.showPsd ? 'Printed' : 'Not printed'}
                </strong>
              </li>
              <li>
                Late-payment fine: {' '}
                <strong className={value.fineEnabled ? 'fee-pos' : 'fee-neg'}>
                  {value.fineEnabled
                    ? `${value.fineType === 'daily' ? 'Per day' : 'Fixed'} — Rs. ${(+value.fineAmt || 0).toLocaleString('en-PK')}`
                    : 'Disabled'}
                </strong>
              </li>
              <li>
                Default print size: {' '}
                <strong className="fee-pos">
                  {value.printSize === 'thermal' ? 'Thermal · 80mm receipt' : 'A4 · Full page'}
                </strong>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Reusable toggle card (Show Discount / Show PSD / etc.) ─── */
function SettingCard({ name, desc, on, onToggle }) {
  return (
    <div className="fee-set-card">
      <div className="fee-set-head">
        <div className="fee-set-name">{name}</div>
        <Tooltip text={on ? `Disable: ${name}` : `Enable: ${name}`}>
          <button
            className={`fee-switch${on ? ' on' : ''}`}
            onClick={onToggle}
            aria-pressed={on}
            aria-label={`Toggle: ${name}`}
            type="button"
          />
        </Tooltip>
      </div>
      <div className="fee-set-desc">{desc}</div>
    </div>
  );
}

/* ─── Update Fee Structure modal ─── */
/* Per-head add / edit / delete against the LaunchSetup fee-head APIs,
   mirroring the Launch Setup Classes tab. Each operation persists
   immediately, then re-pulls this grade's heads and notifies the parent
   so the table count stays in sync. */
function StructEditModal({ open, cls, onClose, onChanged, toast }) {
  const [rows, setRows]       = useState([]);   // [{ feeStructureID, name, amt }]
  const [loading, setLoading] = useState(false);
  const [busy, setBusy]       = useState(false);
  const [newName, setNewName] = useState('');
  const [newAmt, setNewAmt]   = useState('');
  const [editId, setEditId]   = useState(null); // feeStructureID being edited
  const [editName, setEditName] = useState('');
  const [editAmt, setEditAmt]   = useState('');
  const [askRemove, setAsk]   = useState(null); // { feeStructureID, name }

  const gradeId = cls?._gradeId;

  const load = useCallback(async () => {
    if (!gradeId) { setRows([]); return; }
    setLoading(true);
    try { setRows(await feeService.getFeeGradeHeads(gradeId)); }
    catch (e) { toast(e.message || 'Could not load fee heads', 'error'); }
    finally { setLoading(false); }
  }, [gradeId, toast]);

  useEffect(() => { if (open) load(); }, [open, load]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const refresh = async () => { await load(); onChanged?.(); };

  const addHead = async () => {
    if (!newName.trim()) { toast('Fee head name is required', 'error'); return; }
    if (newAmt === '' || Number.isNaN(+newAmt) || +newAmt < 0) { toast('Enter a valid amount', 'error'); return; }
    setBusy(true);
    try {
      await feeService.saveFeeHead({ feeStructureID: 0, gradeId, name: newName.trim(), amt: Number(newAmt) });
      setNewName(''); setNewAmt('');
      await refresh();
      toast('Fee head added', 'success');
    } catch (e) { toast(e.message || 'Could not add fee head', 'error'); }
    finally { setBusy(false); }
  };

  const startEdit = (h) => { setEditId(h.feeStructureID); setEditName(h.name); setEditAmt(String(h.amt)); };
  const cancelEdit = () => { setEditId(null); setEditName(''); setEditAmt(''); };
  const saveEdit = async (h) => {
    if (!editName.trim()) { toast('Fee head name is required', 'error'); return; }
    if (editAmt === '' || Number.isNaN(+editAmt) || +editAmt < 0) { toast('Enter a valid amount', 'error'); return; }
    setBusy(true);
    try {
      await feeService.saveFeeHead({ feeStructureID: h.feeStructureID, gradeId, name: editName.trim(), amt: Number(editAmt) });
      cancelEdit();
      await refresh();
      toast('Fee head updated', 'success');
    } catch (e) { toast(e.message || 'Could not update fee head', 'error'); }
    finally { setBusy(false); }
  };

  const doRemove = async () => {
    const f = askRemove;
    setAsk(null);
    if (!f) return;
    setBusy(true);
    try {
      await feeService.deleteFeeHead(f.feeStructureID);
      await refresh();
      toast('Fee head removed', 'success');
    } catch (e) { toast(e.message || 'Could not remove fee head', 'error'); }
    finally { setBusy(false); }
  };

  const total = rows.reduce((s, h) => s + (+h.amt || 0), 0);

  return createPortal(
    <div className="fee-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fee-modal lg">
        <div className="fee-modal-head">
          <div className="fee-modal-head-title">
            <div className="fee-modal-head-icon"><i className="fa-solid fa-pen-to-square"></i></div>
            <div>
              <div className="fee-modal-title">Update Fee Structure</div>
              <div className="fee-modal-sub">{cls?.cls}</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="fee-modal-close" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </Tooltip>
        </div>

        <div className="fee-modal-body">
          <div className="fee-info">
            <i className="fa-solid fa-circle-info"></i>
            <span>
              Add, edit or remove fee heads below. These amounts become the standard fee for every
              student in this class. Each change is saved immediately.
            </span>
          </div>

          <div className="fee-head-grid fee-head-grid--head">
            <span className="fee-mini-label">Fee Head Name</span>
            <span className="fee-mini-label">Amount (Rs.)</span>
            <span></span>
          </div>

          <div className="fee-heads-list">
            {loading ? (
              <div className="fee-empty fee-empty--small">Loading fee heads…</div>
            ) : rows.length === 0 ? (
              <div className="fee-empty fee-empty--small">
                No fee heads yet — add one below.
              </div>
            ) : rows.map((h) => {
              const isEditing = editId === h.feeStructureID;
              return (
                <div key={h.feeStructureID} className="fee-head-grid">
                  <input
                    className="fee-input"
                    value={isEditing ? editName : h.name}
                    placeholder="Fee head name"
                    disabled={!isEditing || busy}
                    onChange={e => setEditName(e.target.value)}
                  />
                  <input
                    className="fee-input"
                    type="number"
                    min="0"
                    value={isEditing ? editAmt : h.amt}
                    placeholder="0"
                    disabled={!isEditing || busy}
                    onChange={e => setEditAmt(e.target.value)}
                  />
                  {isEditing ? (
                    <span style={{ display: 'inline-flex', gap: 6 }}>
                      <Tooltip text="Save changes">
                        <button className="fee-iconbtn" disabled={busy} onClick={() => saveEdit(h)}>
                          <i className="fa-solid fa-check"></i>
                        </button>
                      </Tooltip>
                      <Tooltip text="Cancel">
                        <button className="fee-iconbtn" disabled={busy} onClick={cancelEdit}>
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </Tooltip>
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', gap: 6 }}>
                      <Tooltip text="Edit this fee head">
                        <button className="fee-iconbtn" disabled={busy} onClick={() => startEdit(h)}>
                          <i className="fa-solid fa-pen"></i>
                        </button>
                      </Tooltip>
                      <Tooltip text="Remove this fee head">
                        <button className="fee-iconbtn danger fee-head-x" disabled={busy} onClick={() => setAsk({ feeStructureID: h.feeStructureID, name: h.name })}>
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </Tooltip>
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add new fee head */}
          <div className="fee-head-grid" style={{ marginTop: 10 }}>
            <input
              className="fee-input"
              value={newName}
              placeholder="New fee head name"
              disabled={busy}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addHead(); }}
            />
            <input
              className="fee-input"
              type="number"
              min="0"
              value={newAmt}
              placeholder="0"
              disabled={busy}
              onChange={e => setNewAmt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addHead(); }}
            />
            <Tooltip text="Add this fee head">
              <button className="fee-iconbtn" disabled={busy} onClick={addHead}>
                <i className="fa-solid fa-plus"></i>
              </button>
            </Tooltip>
          </div>

          {rows.length > 0 && (
            <div className="fee-head-total">
              <span>Total per student</span>
              <strong>{money(total)}</strong>
            </div>
          )}
        </div>

        <div className="fee-modal-foot">
          <Tooltip text="Close">
            <button className="fee-btn fee-btn-primary" onClick={onClose}>
              <i className="fa-solid fa-check"></i> Done
            </button>
          </Tooltip>
        </div>

        {/* Confirm remove (nested) */}
        <FeeConfirmDialog
          cfg={askRemove ? {
            title:   'Remove fee head?',
            message: `"${askRemove.name}" will be removed from this class's fee structure.`,
            hint:    'Already generated challans are not affected.',
            onConfirm: doRemove,
          } : null}
          onClose={() => setAsk(null)}
        />
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FEE CONFIRM DIALOG — matches the Academics / Examination "hero"
   pattern: animated ring around an icon badge, glow strip on top,
   centered title + supportive message + optional hint banner, and a
   1:1.4 footer split between Cancel and the confirm action.

   API:
     {
       title,                         // required
       message,                       // required (plain string OR React node)
       hint,                          // optional small banner below message
       confirmLabel = 'Yes, Delete',  // CTA text
       confirmStyle = 'danger',       // 'danger' | 'primary'
       icon = 'fa-trash',             // FontAwesome icon name
       iconBg = ...,                  // optional override
       iconColor = ...,               // optional override
       onConfirm,                     // called before onClose
     }
   ═══════════════════════════════════════════════════════════════════ */
function FeeConfirmDialog({ cfg, onClose }) {
  useEffect(() => {
    if (!cfg) return undefined;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [cfg, onClose]);

  if (!cfg) return null;

  /* Backward-compat: older call sites passed `tone` instead of confirmStyle */
  const style = cfg.confirmStyle || cfg.tone || 'danger';
  const defaultIcons = {
    danger:  { icon: 'fa-trash',       bg: 'rgba(220,38,38,.1)',  color: '#DC2626' },
    primary: { icon: 'fa-circle-check', bg: 'rgba(30,58,138,.1)', color: '#1E40AF' },
  };
  const fallback = defaultIcons[style] || defaultIcons.danger;
  const {
    title,
    message,
    hint,
    confirmLabel = style === 'danger' ? 'Yes, Delete' : 'Yes, Confirm',
    icon       = fallback.icon,
    iconBg     = fallback.bg,
    iconColor  = fallback.color,
    onConfirm,
  } = cfg;

  const handle = () => { onConfirm && onConfirm(); onClose(); };

  const isString = typeof message === 'string';

  return createPortal(
    <div
      className="fee-confirm-overlay open"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="fee-confirm-dialog">
        <div
          className="fee-confirm-glow"
          style={style === 'danger'
            ? { background: 'linear-gradient(90deg,#EF4444,#DC2626,#EF4444)' }
            : { background: 'linear-gradient(90deg,#1E3A8A,#1E40AF,#1E3A8A)' }}
        />
        <div className={`fee-confirm-hero fee-confirm-hero--${style}`}>
          <div className={`fee-confirm-ring fee-confirm-ring--${style}`}>
            <div className="fee-confirm-icon-wrap" style={{ background: iconBg, color: iconColor }}>
              <i className={`fa-solid ${icon}`}></i>
            </div>
          </div>
        </div>
        <div className="fee-confirm-body">
          <div className="fee-confirm-title">{title}</div>
          {isString
            ? <div className="fee-confirm-msg" dangerouslySetInnerHTML={{ __html: message }} />
            : <div className="fee-confirm-msg">{message}</div>}
          {hint && (
            <div className={`fee-confirm-hint fee-confirm-hint--${style}`}>
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>{hint}</span>
            </div>
          )}
        </div>
        <div className="fee-confirm-footer">
          <button className="fee-confirm-btn fee-confirm-btn--cancel" onClick={onClose}>Cancel</button>
          <button
            className={`fee-confirm-btn fee-confirm-btn--confirm${style === 'primary' ? ' primary-style' : ''}`}
            onClick={handle}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── PDF report preview overlay (iframe with srcDoc + print button) ── */
function FeeReportPreview({ open, title, html, onClose }) {
  if (!open) return null;
  const doPrint = () => {
    const iframe = document.getElementById('fee-rpt-iframe');
    try { iframe?.contentWindow?.focus(); iframe?.contentWindow?.print(); } catch (e) { /* ignore */ }
  };
  return createPortal(
    <div className="fee-rpt-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fee-rpt-bar">
        <div className="fee-rpt-meta">
          <div className="fee-rpt-icon"><i className="fa-solid fa-file-lines"></i></div>
          <div>
            <div className="fee-rpt-title">{title}</div>
            <div className="fee-rpt-sub">Preview — click Print to print or save as PDF</div>
          </div>
        </div>
        <div className="fee-rpt-actions">
          <Tooltip text="Print or save the report as PDF">
            <button className="fee-rpt-print" onClick={doPrint}>
              <i className="fa-solid fa-print"></i> Print / Save PDF
            </button>
          </Tooltip>
          <Tooltip text="Close report preview">
            <button className="fee-rpt-close" onClick={onClose}>
              <i className="fa-solid fa-xmark"></i> Close
            </button>
          </Tooltip>
        </div>
      </div>
      <iframe id="fee-rpt-iframe" title="Fee Report Preview" srcDoc={html} className="fee-rpt-frame" />
    </div>,
    document.body
  );
}

function buildStudentFeeReportHTML({ cls, sec, heads }) {
  const total = heads.reduce((s, h) => s + (+h.amt || 0), 0);
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const rows = heads.map((h, i) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #E5E7EB">${i + 1}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #E5E7EB"><b>${escHtml(h.name)}</b></td>
      <td style="padding:8px 10px;border-bottom:1px solid #E5E7EB;text-align:right;font-variant-numeric:tabular-nums">Rs. ${(+h.amt || 0).toLocaleString('en-PK')}</td>
    </tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escHtml(`Fee Heads — ${cls} (${sec})`)}</title>
<style>
  body { margin:0; font-family:'Segoe UI',Arial,sans-serif; color:#0F172A; background:#fff; font-size:13px; }
  .page { width:210mm; margin:0 auto; padding:18mm 14mm; box-sizing:border-box; }
  .header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #1E3A8A; padding-bottom:14px; margin-bottom:18px; }
  .school { font-size:18px; font-weight:800; color:#1E3A8A; letter-spacing:-.01em; }
  .title  { font-size:14px; font-weight:700; color:#1E40AF; margin-top:6px; }
  .meta { font-size:11px; color:#64748B; text-align:right; }
  table { width:100%; border-collapse:collapse; margin-top:8px; }
  thead th { background:#EFF6FF; color:#1E3A5F; font-weight:800; text-align:left; padding:10px; border-bottom:2px solid #BFDBFE; font-size:11.5px; text-transform:uppercase; letter-spacing:.4px; }
  thead th.right { text-align:right; }
  tfoot td { padding:10px; font-weight:800; background:#F8FAFF; border-top:2px solid #1E3A8A; }
  tfoot td.right { text-align:right; }
  @media print { @page { size:A4; margin:14mm; } body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head><body>
<div class="page">
  <div class="header">
    <div>
      <div class="school">The Oxford System, Lahore Campus</div>
      <div class="title">Fee Heads — ${escHtml(cls)} (${escHtml(sec)})</div>
    </div>
    <div class="meta">Generated: ${escHtml(today)}<br/>${escHtml(heads.length)} fee head${heads.length === 1 ? '' : 's'}</div>
  </div>
  <table>
    <thead>
      <tr><th style="width:60px">#</th><th>Fee Head</th><th class="right" style="width:160px">Amount (Rs.)</th></tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="3" style="text-align:center;padding:18px;color:#64748B">No fee heads.</td></tr>`}</tbody>
    ${heads.length > 0 ? `<tfoot><tr><td colspan="2">Total per student</td><td class="right">Rs. ${total.toLocaleString('en-PK')}</td></tr></tfoot>` : ''}
  </table>
</div>
</body></html>`;
}

/* ─── Coming Soon placeholder used for every not-yet-built screen ──── */
function FeeComingSoon({ label, icon }) {
  return (
    <div className="fee-coming-soon">
      <div className="fee-cs-icon">
        <i className={`fa-solid ${icon}`}></i>
      </div>
      <div className="fee-cs-title">{label}</div>
      <div className="fee-cs-sub">
        This screen will be built in the next steps. Click any other tab to navigate.
      </div>
      <div className="fee-cs-badge">
        <span className="fee-cs-dot" />
        Coming Soon
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CSS — shell-only. Per-screen styles will be appended in later steps.
   ═══════════════════════════════════════════════════════════════════ */
const FEE_CSS = `
/* Top-level tab bar */
.fee-subtabs {
  display: flex;
  gap: 6px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: 5px;
  margin-bottom: 18px;
  box-shadow: var(--shadow-sm);
  overflow-x: auto;
  flex-wrap: nowrap;
  -webkit-overflow-scrolling: touch;
}
.fee-subtab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 18px;
  border-radius: var(--radius-md);
  border: none;
  background: transparent;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  transition: var(--tr);
  white-space: nowrap;
  flex: 1;
}
.fee-subtab:hover:not(.active) { background: var(--bg-muted); color: var(--text-primary); }
.fee-subtab.active {
  background: linear-gradient(135deg,#1E3A8A 0%,#1E40AF 60%,#2563EB 100%);
  color: #fff;
  box-shadow: 0 6px 20px rgba(30,58,138,.4), inset 0 1px 0 rgba(255,255,255,.2);
}
.fee-subtab i { font-size: 12px; }

/* Pill segment toggle (used inside Fee Setup & Settings) */
.fee-seg {
  display: flex;
  width: 100%;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-full);
  padding: 5px;
  margin-bottom: 18px;
  box-shadow: var(--shadow-sm);
}
.fee-seg-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 10px 16px;
  border: none;
  background: transparent;
  border-radius: var(--radius-full);
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted);
  cursor: pointer;
  transition: var(--tr);
  white-space: nowrap;
}
.fee-seg-btn:hover:not(.active) { color: var(--text-primary); }
.fee-seg-btn.active {
  background: linear-gradient(135deg,#1E3A8A,#1E40AF);
  color: #fff;
  box-shadow: 0 4px 12px rgba(30,58,138,.3);
}
.fee-seg-btn i { font-size: 12px; }

@media (max-width: 768px) {
  .fee-seg { flex-wrap: wrap; gap: 6px; border-radius: 14px; overflow: hidden; padding: 6px; }
  .fee-seg-btn {
    flex: 1 1 calc(50% - 6px);
    min-width: 0;
    font-size: 12px;
    padding: 11px 10px;
    border-radius: 10px;
    white-space: normal;
    line-height: 1.2;
    text-align: center;
  }
}

/* Coming Soon placeholder */
.fee-coming-soon {
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 48px 28px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.fee-cs-icon {
  width: 78px; height: 78px;
  border-radius: 22px;
  background: linear-gradient(135deg, rgba(30,58,138,.12), rgba(59,130,246,.06));
  color: #1E40AF;
  display: flex; align-items: center; justify-content: center;
  font-size: 30px;
  margin-bottom: 4px;
}
.fee-cs-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -.02em;
}
.fee-cs-sub {
  font-size: 13px;
  color: var(--text-muted);
  max-width: 460px;
  line-height: 1.55;
}
.fee-cs-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  padding: 7px 16px;
  background: linear-gradient(135deg,#D97706,#B45309);
  color: #fff;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: .04em;
  text-transform: uppercase;
}
.fee-cs-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #fff;
  animation: feePulse 1.4s ease-in-out infinite;
}
@keyframes feePulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: .4; transform: scale(.75); }
}

/* ─── Dark mode ─── */
[data-theme="dark"] .fee-subtabs { background: var(--bg-card); border-color: var(--border-light); box-shadow: var(--shadow-sm); }
[data-theme="dark"] .fee-subtab { color: var(--text-muted); }
[data-theme="dark"] .fee-subtab:hover:not(.active) { background: var(--bg-muted); color: var(--text-primary); }
[data-theme="dark"] .fee-seg { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .fee-seg-btn { color: var(--text-muted); }
[data-theme="dark"] .fee-seg-btn:hover:not(.active) { color: var(--text-primary); }
[data-theme="dark"] .fee-coming-soon { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .fee-cs-icon { background: linear-gradient(135deg, rgba(59,130,246,.18), rgba(37,99,235,.08)); color: #93C5FD; }
[data-theme="dark"] .fee-cs-title { color: var(--text-primary); }
[data-theme="dark"] .fee-cs-sub { color: var(--text-muted); }

/* ═══════════════════════════════════════════════════════════════════
   STUDENT FEE SETUP — table, rows, detail, modal, confirm, report
   ═══════════════════════════════════════════════════════════════════ */

/* Info banners */
.fee-info {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  background: #EFF6FF;
  border: 1px solid #BFDBFE;
  border-radius: var(--radius-md);
  padding: 10px 14px;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.55;
}
.fee-info i { color: var(--brand-primary); flex-shrink: 0; margin-top: 1px; font-size: 13px; }
.fee-info--warn {
  background: rgba(217,119,6,.07);
  border-color: rgba(217,119,6,.25);
}
.fee-info--warn i { color: var(--warning); }

/* Section card */
.fee-section {
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  margin-bottom: 16px;
}
/* Sections that contain absolute dropdowns (search results, multi-select)
   must allow the popover to escape — overflow:hidden clips them otherwise. */
.fee-section--overflow { overflow: visible; }
.fee-section + .fee-section { margin-top: 0; }
.fee-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-light);
  background: linear-gradient(135deg, rgba(30,58,138,.03), transparent);
  gap: 12px;
  flex-wrap: wrap;
}
.fee-section-title { display: flex; align-items: center; gap: 12px; min-width: 0; }
.fee-section-icon {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  font-size: 14px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.fee-section-name { font-size: 14px; font-weight: 800; color: var(--text-primary); letter-spacing: -.01em; }
.fee-section-sub  { font-size: 11.5px; color: var(--text-muted); margin-top: 1px; }
.fee-section-body { padding: 18px 20px; }
.fee-empty {
  padding: 28px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}
.fee-empty--small { padding: 16px; font-size: 12px; background: var(--bg-muted); border-radius: 10px; }

/* Table head + rows */
.fee-table-head {
  display: grid;
  background: #EFF6FF;
  border-bottom: 1.5px solid #BFDBFE;
  padding: 0 18px;
}
.fee-th {
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: .5px;
  text-transform: uppercase;
  color: #1E3A5F;
  padding: 12px 6px;
  display: flex;
  align-items: center;
}
.fee-center { justify-content: center; text-align: center; }
.fee-right  { text-align: right; }

.fee-struct-row  { grid-template-columns: 48px 1fr 1fr 110px 110px 150px 80px; }
.fee-trans-row   { grid-template-columns: 48px 1fr 1fr 130px 90px; }
.fee-challan-row { grid-template-columns: 48px 1fr 1fr 90px 150px 150px 80px 80px; }
.fee-family-row  { grid-template-columns: 48px 1fr 130px 110px 160px 80px; }

/* Family total footer (inside the expanded children section) */
.fee-family-total {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
  font-weight: 800;
  font-size: 13.5px;
  color: var(--text-primary);
}
.fee-family-total span {
  color: #1E3A8A;
  font-variant-numeric: tabular-nums;
}
[data-theme="dark"] .fee-family-total { color: var(--text-primary); }
[data-theme="dark"] .fee-family-total span { color: #93C5FD; }

.fee-rowwrap { border-bottom: 1px solid var(--border-light); }
.fee-rowwrap:last-child { border-bottom: none; }
.fee-row {
  display: grid;
  padding: 0 18px;
  cursor: pointer;
  transition: background .15s ease;
  background: var(--bg-card);
  align-items: center;
  min-height: 58px;
}
.fee-row:hover { background: var(--bg-muted); }
.fee-row.open { background: var(--bg-muted); }
.fee-td {
  padding: 12px 6px;
  font-size: 12.5px;
  color: var(--text-primary);
  display: flex;
  align-items: center;
}
.fee-td.fee-name { font-weight: 700; }
.fee-row-icon {
  width: 28px; height: 28px;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(30,58,138,.12), rgba(37,99,235,.06));
  color: #1E40AF;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11.5px; font-weight: 800;
}
.fee-tag {
  display: inline-block;
  background: rgba(124,58,237,.1);
  color: #6D28D9;
  border: 1px solid rgba(124,58,237,.25);
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}
.fee-count {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  font-weight: 800;
  font-size: 14px;
  color: var(--text-primary);
}
.fee-count small { color: var(--text-muted); font-weight: 600; font-size: 10.5px; }

.fee-chevbtn {
  width: 32px; height: 32px;
  border-radius: 8px;
  background: var(--bg-muted);
  color: var(--text-muted);
  display: inline-flex; align-items: center; justify-content: center;
  transition: var(--tr);
  cursor: pointer;
}
.fee-chevbtn:hover { background: var(--brand-primary); color: #fff; }
.fee-chevbtn.open { background: var(--brand-primary); color: #fff; }
.fee-chev { transition: transform .25s ease; font-size: 11px; }
.fee-chevbtn.open .fee-chev { transform: rotate(180deg); }

/* Action buttons */
.fee-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1.5px solid transparent;
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: var(--tr);
  white-space: nowrap;
}
.fee-btn-xs { padding: 6px 11px; font-size: 11px; }
.fee-btn-sm { padding: 7px 13px; font-size: 12px; }
.fee-btn-primary {
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  box-shadow: 0 2px 8px rgba(30,58,138,.28);
}
.fee-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(30,58,138,.38); }
.fee-btn-ghost {
  background: var(--bg-card);
  border-color: var(--border-light);
  color: var(--text-secondary);
}
.fee-btn-ghost:hover { background: var(--bg-muted); border-color: var(--border-med); color: var(--text-primary); }
.fee-btn-danger {
  background: linear-gradient(135deg, #DC2626, #B91C1C);
  color: #fff;
  box-shadow: 0 2px 8px rgba(220,38,38,.3);
}
.fee-btn-danger:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(220,38,38,.4); }

.fee-iconbtn {
  width: 32px; height: 32px;
  border: 1.5px solid var(--border-light);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-muted);
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer; transition: var(--tr);
}
.fee-iconbtn:hover { color: var(--brand-primary); border-color: var(--brand-primary); }
.fee-iconbtn.danger { color: #DC2626; border-color: rgba(220,38,38,.3); background: rgba(220,38,38,.06); }
.fee-iconbtn.danger:hover { background: #DC2626; color: #fff; border-color: #DC2626; }
.fee-iconbtn.green { color: #16A34A; border-color: rgba(34,197,94,.3); background: rgba(34,197,94,.08); }
.fee-iconbtn.green:hover { background: #16A34A; color: #fff; border-color: #16A34A; }
.fee-iconbtn:disabled { cursor: not-allowed; }
.fee-iconbtn:disabled:hover { color: var(--text-muted); border-color: var(--border-light); background: var(--bg-card); }
.fee-st-actions { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }

/* Detail panel (animated expand) */
.fee-detail {
  max-height: 0;
  overflow: hidden;
  background: var(--bg-muted);
  border-top: 1px solid transparent;
  transition: max-height .3s ease, border-color .3s ease;
}
.fee-detail.open {
  max-height: 1200px;
  border-top-color: var(--border-light);
}
.fee-detail-inner { padding: 16px 18px; }
.fee-detail-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.fee-detail-title {
  font-size: 12.5px;
  font-weight: 800;
  color: var(--text-secondary);
}
.fee-detail-title i { color: var(--brand-primary); margin-right: 6px; }
.fee-mini-pill {
  display: inline-flex;
  align-items: center;
  margin-left: 10px;
  padding: 3px 9px;
  background: rgba(30,58,138,.08);
  border: 1px solid rgba(30,58,138,.2);
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--brand-primary);
  text-transform: none;
  letter-spacing: 0;
}
.fee-muted-dash { color: var(--text-muted); }

/* Stacked label + input (used in small modals) */
.fee-field-stack { margin-bottom: 14px; }
.fee-field-stack:last-child { margin-bottom: 0; }
.fee-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .4px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

/* Sub-table inside detail */
.fee-stbl-wrap {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  overflow: hidden;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.fee-stbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
  color: var(--text-primary);
}
.fee-stbl thead th {
  background: var(--bg-muted);
  color: var(--text-secondary);
  padding: 9px 10px;
  text-align: left;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: .4px;
  text-transform: uppercase;
  border-bottom: 1px solid var(--border-light);
}
.fee-stbl thead th.fee-right  { text-align: right; }
.fee-stbl thead th.fee-center { text-align: center; }
.fee-stbl tbody td {
  padding: 9px 10px;
  border-bottom: 1px solid var(--border-light);
}
.fee-stbl tbody tr:last-child td { border-bottom: none; }
.fee-stbl .fee-num   { color: var(--text-muted); font-weight: 700; width: 36px; }
.fee-stbl .fee-right { text-align: right; font-variant-numeric: tabular-nums; }
.fee-stbl-empty { text-align: center; color: var(--text-muted); padding: 16px; }
.fee-stbl-foot td { background: var(--bg-muted); }

.fee-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 700;
}
.fee-chip-active {
  background: rgba(34,197,94,.12);
  color: #16A34A;
  border: 1px solid rgba(34,197,94,.3);
}

/* ─── Modal (Update Fee Structure) ─── */
.fee-overlay {
  position: fixed; inset: 0;
  z-index: 9000;
  background: rgba(15,23,42,.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  opacity: 0;
  pointer-events: none;
  transition: opacity .18s ease;
}
.fee-overlay.open { opacity: 1; pointer-events: auto; animation: feeOverIn .15s ease; }
@keyframes feeOverIn { from { opacity: 0; } to { opacity: 1; } }

.fee-modal {
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 760px;
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(15,23,42,.25);
  overflow: hidden;
  animation: feeModIn .2s cubic-bezier(.4,0,.2,1);
}
.fee-modal.lg { max-width: 900px; }
.fee-modal.sm { max-width: 520px; }
@keyframes feeModIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

@media (max-width: 640px) {
  .fee-overlay { padding: 8px; }
  .fee-modal,
  .fee-modal.lg,
  .fee-modal.sm { max-width: 96vw; }
}

.fee-modal-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-light);
  background: linear-gradient(135deg, rgba(30,58,138,.04), transparent);
}
.fee-modal-head-title { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
.fee-modal-head-icon {
  width: 38px; height: 38px;
  border-radius: 10px;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px;
  flex-shrink: 0;
}
.fee-modal-title { font-size: 15px; font-weight: 800; color: var(--text-primary); }
.fee-modal-sub { font-size: 11.5px; color: var(--text-muted); margin-top: 2px; }
.fee-modal-close {
  width: 32px; height: 32px;
  border: none;
  background: var(--bg-muted);
  color: var(--text-muted);
  border-radius: 8px;
  cursor: pointer;
  transition: var(--tr);
  display: inline-flex; align-items: center; justify-content: center;
}
.fee-modal-close:hover { background: rgba(220,38,38,.1); color: #DC2626; }

.fee-modal-body { flex: 1; overflow-y: auto; padding: 18px 20px; }
.fee-modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--border-light);
  background: var(--bg-muted);
}

/* Head editor grid */
.fee-mini-label {
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .4px;
  color: var(--text-muted);
}
.fee-head-grid {
  display: grid;
  grid-template-columns: 1fr 160px 36px;
  gap: 10px;
  align-items: center;
  margin-bottom: 8px;
}
.fee-head-grid--head { margin-bottom: 4px; }
.fee-heads-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.fee-head-x { width: 36px; height: 36px; }
.fee-add-head {
  width: 100%;
  border: 1.5px dashed var(--border-light);
  background: transparent;
  color: var(--text-secondary);
  padding: 10px 12px;
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: var(--tr);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.fee-add-head:hover { border-color: var(--brand-primary); color: var(--brand-primary); background: rgba(30,58,138,.04); }

.fee-head-total {
  margin-top: 12px;
  padding: 11px 14px;
  background: linear-gradient(135deg, rgba(30,58,138,.06), transparent);
  border: 1px solid rgba(30,58,138,.15);
  border-radius: var(--radius-md);
  display: flex; justify-content: space-between; align-items: center;
  font-size: 13px; color: var(--text-secondary);
}
.fee-head-total strong { color: var(--brand-primary); font-size: 15px; }

/* Inputs */
.fee-input {
  width: 100%;
  border: 1.5px solid var(--border-light);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-primary);
  padding: 9px 12px;
  font-family: var(--font-body);
  font-size: 12.5px;
  outline: none;
  transition: border-color .15s ease, box-shadow .15s ease;
  box-sizing: border-box;
}
.fee-input:focus { border-color: var(--brand-primary); box-shadow: 0 0 0 3px rgba(30,58,138,.1); }
.fee-input::placeholder { color: var(--text-muted); }

/* ─── Confirm dialog (Academics ERP "hero" style) ─── */
.fee-confirm-overlay {
  position: fixed; inset: 0;
  z-index: 9999;
  background: rgba(10,22,40,.55);
  backdrop-filter: blur(8px);
  display: none;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.fee-confirm-overlay.open { display: flex; }
.fee-confirm-dialog {
  position: relative;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 24px;
  width: 100%;
  max-width: 380px;
  box-shadow: 0 30px 80px rgba(0,0,0,.2), 0 8px 24px rgba(0,0,0,.1);
  animation: feeConfirmIn .32s cubic-bezier(.34,1.3,.64,1) both;
  overflow: hidden;
}
@keyframes feeConfirmIn {
  from { opacity: 0; transform: scale(.88) translateY(20px); }
  to   { opacity: 1; transform: none; }
}
.fee-confirm-glow {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  border-radius: 24px 24px 0 0;
}
.fee-confirm-hero {
  display: flex; flex-direction: column; align-items: center;
  padding: 32px 28px 10px;
}
.fee-confirm-hero--danger  { background: linear-gradient(180deg, rgba(220,38,38,.03), transparent); }
.fee-confirm-hero--primary { background: linear-gradient(180deg, rgba(30,58,138,.04), transparent); }
.fee-confirm-ring {
  position: relative;
  width: 80px; height: 80px;
  display: flex; align-items: center; justify-content: center;
}
.fee-confirm-ring::before {
  content: '';
  position: absolute; inset: 0;
  border-radius: 50%;
  border: 2px solid transparent;
  animation: feeConfirmRing 3s linear infinite;
  opacity: .4;
}
.fee-confirm-ring--danger::before  { border-top-color: #EF4444; border-right-color: #EF4444; }
.fee-confirm-ring--primary::before { border-top-color: #2563EB; border-right-color: #2563EB; }
@keyframes feeConfirmRing { to { transform: rotate(360deg); } }
.fee-confirm-icon-wrap {
  width: 60px; height: 60px;
  border-radius: 18px;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px;
  position: relative; z-index: 1;
  box-shadow: 0 8px 24px rgba(220,38,38,.18);
  transition: all .3s ease;
}
.fee-confirm-hero--primary .fee-confirm-icon-wrap { box-shadow: 0 8px 24px rgba(30,58,138,.2); }
.fee-confirm-body { padding: 16px 28px 8px; text-align: center; }
.fee-confirm-title {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 10px;
  letter-spacing: -.02em;
}
.fee-confirm-msg {
  font-size: 13.5px;
  color: var(--text-muted);
  line-height: 1.75;
  margin-bottom: 14px;
}
.fee-confirm-msg strong { color: var(--text-primary); font-weight: 700; }
.fee-confirm-hint {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  text-align: left;
  padding: 11px 14px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
}
.fee-confirm-hint--danger {
  background: rgba(220,38,38,.05);
  border: 1px solid rgba(220,38,38,.15);
  color: #991B1B;
}
.fee-confirm-hint--danger i { color: #DC2626; font-size: 13px; flex-shrink: 0; margin-top: 1px; }
.fee-confirm-hint--primary {
  background: rgba(30,58,138,.05);
  border: 1px solid rgba(30,58,138,.15);
  color: #1E3A5F;
}
.fee-confirm-hint--primary i { color: #1E40AF; font-size: 13px; flex-shrink: 0; margin-top: 1px; }
.fee-confirm-footer {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 10px;
  padding: 20px 28px 28px;
}
.fee-confirm-btn {
  display: flex; align-items: center; justify-content: center;
  gap: 8px;
  height: 46px;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 700;
  transition: all .2s cubic-bezier(.4,0,.2,1);
  letter-spacing: .01em;
}
.fee-confirm-btn--cancel {
  background: var(--bg-muted);
  border: 1.5px solid var(--border-light);
  color: var(--text-muted);
}
.fee-confirm-btn--cancel:hover {
  background: var(--bg-card);
  color: var(--text-primary);
  border-color: var(--border-med);
}
.fee-confirm-btn--confirm {
  background: linear-gradient(135deg, #EF4444, #DC2626);
  color: #fff;
  box-shadow: 0 4px 14px rgba(220,38,38,.35), inset 0 1px 0 rgba(255,255,255,.2);
}
.fee-confirm-btn--confirm:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(220,38,38,.5);
}
.fee-confirm-btn--confirm.primary-style {
  background: linear-gradient(135deg, #1D4ED8, #1E3A8A);
  box-shadow: 0 4px 14px rgba(30,58,138,.35), inset 0 1px 0 rgba(255,255,255,.2);
}
.fee-confirm-btn--confirm.primary-style:hover {
  box-shadow: 0 8px 24px rgba(30,58,138,.5);
}
.fee-confirm-btn:active { transform: scale(.97) translateY(0) !important; }

/* Report preview overlay */
.fee-rpt-overlay {
  position: fixed; inset: 0;
  z-index: 9100;
  background: rgba(15,23,42,.85);
  display: flex; flex-direction: column;
  padding: 14px 14px 18px;
  gap: 12px;
  animation: feeOverIn .15s ease;
}
.fee-rpt-bar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  color: #fff;
  padding: 10px 14px;
  background: rgba(15,23,42,.6);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 12px;
  backdrop-filter: blur(8px);
}
.fee-rpt-meta { display: flex; align-items: center; gap: 12px; min-width: 0; }
.fee-rpt-icon {
  width: 36px; height: 36px;
  border-radius: 9px;
  background: linear-gradient(135deg, #1E3A8A, #2563EB);
  display: flex; align-items: center; justify-content: center;
  font-size: 16px;
}
.fee-rpt-title { font-size: 14px; font-weight: 800; }
.fee-rpt-sub   { font-size: 11px; color: rgba(255,255,255,.6); }
.fee-rpt-actions { display: flex; gap: 8px; }
.fee-rpt-print {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #1E3A8A, #2563EB);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-family: var(--font-body);
  font-size: 12.5px; font-weight: 700;
  cursor: pointer;
}
.fee-rpt-print:hover { filter: brightness(1.1); }
.fee-rpt-close {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px;
  background: rgba(255,255,255,.12);
  color: #fff;
  border: 1.5px solid rgba(255,255,255,.2);
  border-radius: 8px;
  font-family: var(--font-body);
  font-size: 12.5px; font-weight: 700;
  cursor: pointer;
}
.fee-rpt-close:hover { background: rgba(255,255,255,.18); }
.fee-rpt-frame {
  flex: 1; width: 100%; max-width: 960px;
  align-self: center;
  border: none;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 20px 60px rgba(0,0,0,.4);
  min-height: 0;
}

/* ─── Settings (toggle cards + dependent fine fields) ─── */
.fee-set-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.fee-set-card {
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 16px;
  background: var(--bg-card);
  transition: var(--tr);
}
.fee-set-card:hover { border-color: var(--border-med); }
.fee-set-card--accent {
  background: linear-gradient(135deg, rgba(30,58,138,.04), transparent);
  display: flex; flex-direction: column;
  justify-content: center; align-items: center;
  text-align: center;
  gap: 8px;
}
.fee-set-shield {
  font-size: 26px;
  color: var(--brand-primary);
  margin-bottom: 4px;
}

/* Print Size selector (Fee Challan Settings card) */
.fee-print-size-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 12px;
}
.fee-print-size-opt {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1.5px solid var(--border-light);
  background: var(--bg-card);
  cursor: pointer;
  font-family: var(--font-body);
  color: var(--text-primary);
  text-align: left;
  transition: all .2s ease;
}
.fee-print-size-opt > i {
  width: 36px; height: 36px;
  border-radius: 9px;
  background: rgba(30,58,138,.08);
  color: #1E3A8A;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px;
  flex-shrink: 0;
}
.fee-print-size-opt:hover { border-color: var(--border-med); }
.fee-print-size-opt.sel {
  border-color: #1E3A8A;
  box-shadow: 0 0 0 3px rgba(30,58,138,.10);
  background: linear-gradient(135deg, rgba(30,58,138,.04), transparent);
}
.fee-print-size-name { font-size: 13px; font-weight: 800; color: var(--text-primary); }
.fee-print-size-desc { font-size: 11px; color: var(--text-muted); margin-top: 1px; }
[data-theme="dark"] .fee-print-size-opt {
  background: var(--bg-card);
  border-color: var(--border-light);
  color: var(--text-primary);
}
[data-theme="dark"] .fee-print-size-opt > i {
  background: rgba(59,130,246,.15);
  color: #93C5FD;
}
[data-theme="dark"] .fee-print-size-opt.sel {
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59,130,246,.18);
  background: linear-gradient(135deg, rgba(59,130,246,.08), transparent);
}
[data-theme="dark"] .fee-print-size-name { color: var(--text-primary); }
[data-theme="dark"] .fee-print-size-desc { color: var(--text-muted); }
.fee-set-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
}
.fee-set-name { font-size: 13.5px; font-weight: 800; color: var(--text-primary); }
.fee-set-desc { font-size: 11.5px; color: var(--text-muted); line-height: 1.55; }

.fee-switch {
  position: relative;
  width: 44px; height: 24px;
  border-radius: 14px;
  background: var(--border-med);
  cursor: pointer;
  transition: var(--tr);
  flex-shrink: 0;
  border: none;
  padding: 0;
}
.fee-switch::after {
  content: '';
  position: absolute;
  top: 3px; left: 3px;
  width: 18px; height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: var(--tr);
  box-shadow: 0 1px 3px rgba(0,0,0,.3);
}
.fee-switch.on { background: linear-gradient(135deg, #1E3A8A, #1E40AF); }
.fee-switch.on::after { transform: translateX(20px); }
.fee-switch:focus-visible { outline: 3px solid rgba(30,58,138,.25); outline-offset: 2px; }

.fee-fine-fields {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed var(--border-light);
  display: flex; flex-direction: column; gap: 12px;
}
.fee-select {
  height: 42px;
  border: 1.5px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 0 36px 0 12px;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-card);
  outline: none;
  transition: var(--tr);
  width: 100%;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
}
.fee-select:focus { border-color: var(--brand-primary); box-shadow: 0 0 0 3px rgba(30,58,138,.1); }
.fee-select-wrap { position: relative; }
.fee-select-wrap > i {
  position: absolute;
  right: 12px; top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
  font-size: 11px;
}

/* Live "Current effect" summary */
.fee-set-summary {
  margin-top: 18px;
  padding: 14px 16px;
  background: var(--bg-muted);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
}
.fee-set-summary-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 11.5px; font-weight: 800;
  text-transform: uppercase; letter-spacing: .5px;
  color: var(--text-secondary);
  margin-bottom: 10px;
}
.fee-set-summary-title i { color: var(--brand-primary); }
.fee-set-summary-list {
  list-style: none;
  margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: 6px;
  font-size: 12.5px;
  color: var(--text-secondary);
}
.fee-set-summary-list strong { font-weight: 700; }
.fee-pos { color: #16A34A; }
.fee-neg { color: #DC2626; font-weight: 700; }

/* ─── Single-student card (used in BulkGenerateModal singleMode) ─── */
.fee-stud-card {
  display: flex;
  gap: 18px;
  align-items: flex-start;
  flex-wrap: wrap;
  padding: 16px;
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(30,58,138,.03), transparent);
}
.fee-stud-logo {
  width: 74px; height: 74px;
  border-radius: 16px;
  background: linear-gradient(135deg, #DBEAFE, #EEF4FF);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-display, var(--font-body));
  font-size: 28px;
  font-weight: 800;
  color: #1E3A8A;
  flex-shrink: 0;
}
.fee-stud-meta {
  font-size: 12.5px;
  line-height: 1.9;
  color: var(--text-primary);
  flex: 1;
  min-width: 220px;
}
.fee-stud-meta b {
  display: inline-block;
  min-width: 118px;
  color: var(--text-secondary);
  font-weight: 700;
}
[data-theme="dark"] .fee-stud-card {
  background: linear-gradient(135deg, rgba(59,130,246,.06), transparent);
  border-color: var(--border-light);
}
[data-theme="dark"] .fee-stud-logo {
  background: rgba(59,130,246,.16);
  color: #93C5FD;
}
[data-theme="dark"] .fee-stud-meta { color: var(--text-primary); }
[data-theme="dark"] .fee-stud-meta b { color: var(--text-secondary); }

/* ─── Challans tab: filters + smart search + generated bar ─── */
.fee-filters {
  display: flex;
  gap: 14px;
  align-items: flex-end;
  flex-wrap: wrap;
}
.fee-filters .fee-field { display: flex; flex-direction: column; min-width: 0; flex: 0 0 auto; }
.fee-field--grow { flex: 1; min-width: 240px; }

/* ─── Multi-select dropdown (Bulk-generate fee heads) ─── */
.fee-ms { position: relative; }
.fee-ms-toggle {
  height: 42px;
  border: 1.5px solid var(--border-light);
  border-radius: 10px;
  padding: 0 12px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
  background: var(--bg-card);
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  transition: var(--tr, all .2s ease);
}
.fee-ms-toggle:hover:not(:disabled) { border-color: var(--border-med); }
.fee-ms-toggle:disabled { opacity: .55; cursor: not-allowed; }
.fee-ms-toggle > span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fee-ms-toggle i { color: var(--text-muted); font-size: 11px; transition: transform .2s ease; }
.fee-ms.open .fee-ms-toggle {
  border-color: #1E3A8A;
  box-shadow: 0 0 0 3px rgba(30,58,138,.08);
}
.fee-ms.open .fee-ms-toggle i { transform: rotate(180deg); }
.fee-ms-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0; right: 0;
  min-width: 280px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(15,23,42,.15);
  z-index: 30;
  max-height: 240px;
  overflow-y: auto;
  padding: 6px;
  animation: feeMsIn .18s ease;
}
@keyframes feeMsIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
.fee-ms-opt {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 8px;
  cursor: pointer;
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  transition: var(--tr, all .15s ease);
  min-width: 0;
}
.fee-ms-opt:hover { background: var(--bg-muted); }
.fee-ms-check {
  width: 18px; height: 18px;
  border-radius: 5px;
  border: 1.5px solid var(--border-med);
  display: flex; align-items: center; justify-content: center;
  font-size: 10px;
  color: transparent;
  flex-shrink: 0;
  transition: var(--tr, all .2s ease);
}
.fee-ms-opt.sel .fee-ms-check {
  background: #1E3A8A;
  border-color: #1E3A8A;
  color: #fff;
}
.fee-ms-name {
  flex: 1 1 auto;
  min-width: 0;
  white-space: normal;
  word-break: break-word;
  line-height: 1.35;
  color: inherit;
}
.fee-ms-amt {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  margin-left: 6px;
  white-space: nowrap;
}
.fee-ms-opt.sel .fee-ms-amt { color: #1E3A8A; }
.fee-ms-empty {
  padding: 14px 10px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
}

/* ─── Bulk-generate progress bar ─── */
.fee-gen-progress { margin-top: 18px; }
.fee-prog-label {
  display: flex;
  justify-content: space-between;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-secondary);
  margin-bottom: 8px;
}
.fee-prog-label span:last-child {
  color: #1E3A8A;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.fee-prog-track {
  height: 10px;
  border-radius: 999px;
  background: var(--bg-muted);
  overflow: hidden;
  border: 1px solid var(--border-light);
}
.fee-prog-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #1E3A8A, #2563EB, #16A34A);
  background-size: 200% 100%;
  transition: width .25s ease;
  animation: feeProgShift 1.2s linear infinite;
}
.fee-prog-fill.done { animation: none; background: linear-gradient(90deg, #16A34A, #15803D); }
@keyframes feeProgShift { from { background-position: 0% 0; } to { background-position: 200% 0; } }

/* ─── Challan Preview Modal body ─── */
.fee-preview-body { background: #F1F3F8; padding: 20px; }

/* ─── Download Picker Modal ─── */
.fee-dl-label {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .6px;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.fee-dl-label::after { content: ''; flex: 1; height: 1px; background: var(--border-light); }
.fee-dl-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.fee-dl-card {
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  transition: all .2s ease;
  background: var(--bg-card);
  font-family: var(--font-body);
  text-align: left;
  width: 100%;
}
.fee-dl-card:hover { border-color: var(--border-med); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(15,23,42,.10); }
.fee-dl-card.sel { border-color: #1E3A8A; box-shadow: 0 0 0 3px rgba(30,58,138,.12); transform: translateY(-2px); }
.fee-dl-prev {
  height: 70px;
  border-radius: 8px;
  padding: 11px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
  overflow: hidden;
  margin-bottom: 10px;
}
.fee-dl-prev--color { background: linear-gradient(145deg, #1E3A8A 0%, #1E40AF 55%, #1D4ED8 100%); }
/* Colorless preview tile — paper-white look matches the actual printed
   challan in low-ink mode. Lines/orb/pills become dark gray outlines. */
.fee-dl-prev--bw    { background: #FFFFFF; border-bottom: 1px solid #E5E7EB; }
.fee-dl-orb {
  position: absolute;
  top: -14px; right: -14px;
  width: 46px; height: 46px;
  border-radius: 50%;
  background: rgba(255,255,255,.12);
}
.fee-dl-orb.bw { background: rgba(15,23,42,.06); }
.fee-dl-line { height: 6px; border-radius: 3px; }
.fee-dl-line.lg { width: 70%; background: rgba(255,255,255,.75); }
.fee-dl-line.md { width: 52%; height: 5px; background: rgba(255,255,255,.5); }
.fee-dl-line.bw.lg { background: #1F2937; }
.fee-dl-line.bw.md { background: #9CA3AF; }
.fee-dl-pills { display: flex; gap: 6px; margin-top: auto; }
.fee-dl-pill { height: 6px; width: 22px; border-radius: 3px; }
.fee-dl-pill.blue  { background: #60A5FA; }
.fee-dl-pill.amber { background: #FBBF24; }
.fee-dl-pill.bw    { background: transparent; border: 1px solid #9CA3AF; }
/* Keyboard focus ring on radio-style picker cards */
.fee-dl-card:focus-visible { outline: none; border-color: #1E40AF; box-shadow: 0 0 0 3px rgba(30,64,175,.22); }
[data-theme="dark"] .fee-dl-card:focus-visible { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.32); }
/* Colorless preview keeps the paper-white look in dark mode (it previews print, not screen). */
[data-theme="dark"] .fee-dl-prev--bw { background: #F8FAFC; border-bottom-color: #CBD5E1; }
[data-theme="dark"] .fee-dl-line.bw.lg { background: #1F2937; }
[data-theme="dark"] .fee-dl-line.bw.md { background: #94A3B8; }
[data-theme="dark"] .fee-dl-pill.bw { border-color: #94A3B8; }
@media (max-width: 520px) {
  .fee-dl-grid, .fee-dl-fmt-grid { grid-template-columns: 1fr; gap: 8px; }
}
.fee-dl-meta .fee-dl-name { font-size: 13px; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; }
.fee-dl-meta .fee-dl-desc { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.fee-dl-fmt-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.fee-dl-fmt {
  display: flex;
  align-items: center;
  gap: 11px;
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  padding: 12px 14px;
  cursor: pointer;
  transition: all .2s ease;
  background: var(--bg-card);
  font-family: var(--font-body);
  text-align: left;
  width: 100%;
}
.fee-dl-fmt:hover { border-color: var(--border-med); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(15,23,42,.10); }
.fee-dl-fmt.sel { border-color: #1E3A8A; box-shadow: 0 0 0 3px rgba(30,58,138,.12); }
.fee-dl-fmt-ic {
  width: 38px; height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  flex-shrink: 0;
}
.fee-dl-fmt-name { font-size: 13.5px; font-weight: 800; color: var(--text-primary); }

/* ─── Discount Manager Modal table ─── */
.fee-dm-table { width: 100%; border-collapse: collapse; }
.fee-dm-table th {
  text-align: left;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: .5px;
  text-transform: uppercase;
  color: var(--text-muted);
  padding: 10px 12px;
  border-bottom: 1.5px solid var(--border-light);
  background: var(--bg-card);
}
.fee-dm-table td {
  padding: 9px 12px;
  border-bottom: 1px solid var(--border-light);
  font-size: 13px;
  color: var(--text-primary);
  vertical-align: middle;
}
.fee-dm-table input {
  width: 110px;
  height: 36px;
  border: 1.5px solid var(--border-light);
  border-radius: 8px;
  padding: 0 10px;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 600;
  text-align: right;
  background: var(--bg-card);
  color: var(--text-primary);
  outline: none;
  transition: all .2s ease;
}
.fee-dm-table input:focus { border-color: #1E3A8A; box-shadow: 0 0 0 3px rgba(30,58,138,.08); }
.fee-dm-net { font-weight: 800; color: #1E3A8A; font-variant-numeric: tabular-nums; }
.fee-dm-total-row td { background: var(--bg-muted); font-weight: 800; border-bottom: none; }
.fee-right { text-align: right; }

/* ─── Smart search (mirrors HTML reference) ─── */
.fee-searchrow { margin-top: 14px; }
.fee-search-anchor { position: relative; width: 100%; }
.fee-search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 42px;
  border: 1.5px solid var(--border-light);
  border-radius: 10px;
  padding: 0 12px;
  background: var(--bg-card);
  transition: all .2s ease;
}
.fee-search-box:focus-within {
  border-color: #1E3A8A;
  box-shadow: 0 0 0 3px rgba(30,58,138,.08);
}
.fee-search-box > i { color: var(--text-muted); font-size: 13px; }
.fee-search-box input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-family: var(--font-body);
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-primary);
}
.fee-search-box input::placeholder { color: var(--text-muted); }
.fee-search-clear {
  width: 24px; height: 24px;
  border-radius: 7px;
  border: none;
  background: var(--bg-muted);
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  transition: all .2s ease;
  flex-shrink: 0;
}
.fee-search-clear:hover { background: rgba(220,38,38,.1); color: #DC2626; }
.fee-search-results {
  position: absolute;
  top: calc(100% + 6px);
  left: 0; right: 0;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 10px;
  box-shadow: 0 20px 40px rgba(15,23,42,.12), 0 4px 12px rgba(15,23,42,.06);
  z-index: 9000;
  max-height: 360px;
  overflow-y: auto;
  display: none;
  padding: 6px;
}
.fee-search-results.open { display: block; animation: feeSrFade .2s ease; }
@keyframes feeSrFade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }

.fee-sr-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  background: transparent;
  border: none;
  width: 100%;
  text-align: left;
  font-family: var(--font-body);
  transition: all .15s ease;
}
.fee-sr-item:hover { background: var(--bg-muted); }
.fee-sr-av {
  width: 38px; height: 38px;
  border-radius: 10px;
  background: linear-gradient(135deg, #DBEAFE, #EEF4FF);
  color: #1E3A8A;
  font-weight: 800;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.fee-sr-main { flex: 1; min-width: 0; }
.fee-sr-name {
  font-size: 13.5px;
  font-weight: 800;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.fee-sr-meta {
  font-size: 11.5px;
  color: var(--text-muted);
  margin-top: 2px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
}
.fee-sr-meta b { color: var(--text-secondary); font-weight: 700; }
.fee-sr-go {
  width: 30px; height: 30px;
  border-radius: 8px;
  background: #DBEAFE;
  color: #1E3A8A;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
}
.fee-sr-empty {
  padding: 18px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12.5px;
}
.fee-sr-empty b { color: var(--text-primary); font-weight: 700; }

/* Status chips (re-used inside search results) */
.fee-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}
.fee-chip-active {
  background: rgba(22,163,74,.1);
  color: #16A34A;
  border: 1px solid rgba(22,163,74,.22);
}
.fee-chip-due {
  background: rgba(220,38,38,.08);
  color: #DC2626;
  border: 1px solid rgba(220,38,38,.2);
}

/* Inline hint below search */
.fee-hint {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 8px;
  font-size: 11.5px;
  color: var(--text-muted);
  line-height: 1.5;
}
.fee-hint i { color: #1E3A8A; font-size: 11px; flex-shrink: 0; }

.fee-gen-block { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.fee-gen-bar {
  width: 90px; height: 5px;
  border-radius: 999px;
  background: var(--bg-muted);
  overflow: hidden;
  border: 1px solid var(--border-light);
}
.fee-gen-bar > span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #16A34A, #22C55E);
  transition: width .3s ease;
}

.fee-ch-sec-m {
  display: none;
  margin-left: 8px;
  font-weight: 600;
  color: var(--text-muted);
  font-size: 11px;
}

/* Detail panel actions strip */
.fee-m-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.fee-m-stats { display: flex; gap: 22px; flex-wrap: wrap; }
.fee-m-stat { display: flex; flex-direction: column; gap: 2px; }
.fee-m-stat-label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--text-muted);
}
.fee-m-stat-val { font-size: 16px; font-weight: 800; color: var(--text-primary); }
.fee-m-btns { display: flex; gap: 8px; flex-wrap: wrap; }
.fee-m-danger { color: #DC2626; border-color: rgba(220,38,38,.3); }
.fee-m-danger:hover { background: rgba(220,38,38,.1); color: #DC2626; }

/* Negative-payable text + row flash */
.fee-stbl tbody td.fee-neg { color: #16A34A; font-weight: 700; }
.fee-st-flash { animation: feeFlash 1.6s ease; }
@keyframes feeFlash {
  0%   { background: rgba(34,197,94,.2); }
  60%  { background: rgba(34,197,94,.1); }
  100% { background: transparent; }
}

/* Responsive collapse */
@media (max-width: 768px) {
  .fee-set-grid { grid-template-columns: 1fr; gap: 12px; }
  .fee-table-head { display: none; }
  .fee-ch-sec-m { display: inline; }
  .fee-challan-row { grid-template-columns: 1fr !important; }
  .fee-m-actions { flex-direction: column; align-items: stretch; }
  .fee-filters { gap: 10px; }
  .fee-filters .fee-btn { flex: 1 1 auto; justify-content: center; }
  .fee-struct-row { grid-template-columns: 1fr !important; gap: 6px; padding: 12px 14px; min-height: 0; }
  .fee-td { padding: 3px 0; }
  .fee-td::before {
    content: attr(data-label);
    font-size: 10px; font-weight: 800; letter-spacing: .5px; text-transform: uppercase;
    color: var(--text-muted);
    margin-right: 8px; min-width: 90px; display: inline-block;
  }
  .fee-td.fee-center { justify-content: flex-start; }
  .fee-actions { justify-content: flex-start; }
}

/* ─── Dark mode for Student Fee Setup ─── */
[data-theme="dark"] .fee-info { background: rgba(59,130,246,.08); border-color: rgba(59,130,246,.2); color: #BFD2F8; }
[data-theme="dark"] .fee-info i { color: #60A5FA; }
[data-theme="dark"] .fee-info--warn { background: rgba(217,119,6,.10); border-color: rgba(217,119,6,.3); color: #FCD9A1; }
[data-theme="dark"] .fee-info--warn i { color: #FCD34D; }

[data-theme="dark"] .fee-section { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .fee-table-head { background: var(--bg-muted); border-bottom-color: var(--border-light); }
[data-theme="dark"] .fee-th { color: var(--text-muted); }
[data-theme="dark"] .fee-row { background: var(--bg-card); }
[data-theme="dark"] .fee-row:hover,
[data-theme="dark"] .fee-row.open { background: var(--bg-muted); }
[data-theme="dark"] .fee-rowwrap { border-bottom-color: var(--border-light); }
[data-theme="dark"] .fee-td { color: var(--text-primary); }
[data-theme="dark"] .fee-row-icon { background: rgba(59,130,246,.15); color: #93C5FD; }
[data-theme="dark"] .fee-tag { background: rgba(124,58,237,.18); color: #C4B5FD; border-color: rgba(124,58,237,.35); }
[data-theme="dark"] .fee-count { color: var(--text-primary); }
[data-theme="dark"] .fee-count small { color: var(--text-muted); }
[data-theme="dark"] .fee-chevbtn { background: var(--bg-muted); color: var(--text-muted); }
[data-theme="dark"] .fee-chevbtn:hover,
[data-theme="dark"] .fee-chevbtn.open { background: #3B82F6; color: #fff; }
[data-theme="dark"] .fee-btn-primary { background: linear-gradient(135deg, #1E3A8A, #2563EB); }
[data-theme="dark"] .fee-btn-ghost { background: var(--bg-muted); border-color: var(--border-light); color: var(--text-secondary); }
[data-theme="dark"] .fee-btn-ghost:hover { background: var(--bg-card); border-color: var(--border-med); color: var(--text-primary); }
[data-theme="dark"] .fee-iconbtn { background: var(--bg-muted); border-color: var(--border-light); color: var(--text-muted); }
[data-theme="dark"] .fee-iconbtn:hover { color: #3B82F6; border-color: #3B82F6; background: var(--bg-card); }
[data-theme="dark"] .fee-iconbtn.danger { background: rgba(220,38,38,.12); border-color: rgba(220,38,38,.3); color: #FCA5A5; }
[data-theme="dark"] .fee-iconbtn.danger:hover { background: var(--error); color: #fff; border-color: var(--error); }
[data-theme="dark"] .fee-detail { background: var(--bg-muted); }
[data-theme="dark"] .fee-detail.open { border-top-color: var(--border-light); }
[data-theme="dark"] .fee-detail-title { color: var(--text-secondary); }
[data-theme="dark"] .fee-detail-title i { color: #93C5FD; }
[data-theme="dark"] .fee-mini-pill { background: rgba(59,130,246,.15); border-color: rgba(59,130,246,.3); color: #93C5FD; }
[data-theme="dark"] .fee-muted-dash { color: var(--text-muted); }
[data-theme="dark"] .fee-label { color: var(--text-secondary); }

/* Settings dark mode */
[data-theme="dark"] .fee-section-header { background: linear-gradient(135deg, rgba(59,130,246,.06), transparent); border-bottom-color: var(--border-light); }
[data-theme="dark"] .fee-section-name { color: var(--text-primary); }
[data-theme="dark"] .fee-section-sub { color: var(--text-muted); }
[data-theme="dark"] .fee-set-card { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .fee-set-card:hover { border-color: var(--border-med); }
[data-theme="dark"] .fee-set-card--accent { background: linear-gradient(135deg, rgba(59,130,246,.08), transparent); }
[data-theme="dark"] .fee-set-shield { color: #93C5FD; }
[data-theme="dark"] .fee-set-name { color: var(--text-primary); }
[data-theme="dark"] .fee-set-desc { color: var(--text-muted); }
[data-theme="dark"] .fee-switch { background: var(--border-med); }
[data-theme="dark"] .fee-switch.on { background: linear-gradient(135deg, #1E40AF, #2563EB); }
[data-theme="dark"] .fee-switch::after { background: #fff; }
[data-theme="dark"] .fee-fine-fields { border-top-color: var(--border-light); }
[data-theme="dark"] .fee-select { background: var(--input-bg, var(--bg-card)); border-color: var(--border-light); color: var(--text-primary); }
[data-theme="dark"] .fee-select:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.15); }
[data-theme="dark"] .fee-select-wrap > i { color: var(--text-muted); }
[data-theme="dark"] .fee-set-summary { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .fee-set-summary-title { color: var(--text-secondary); }
[data-theme="dark"] .fee-set-summary-title i { color: #93C5FD; }
[data-theme="dark"] .fee-set-summary-list { color: var(--text-secondary); }
[data-theme="dark"] .fee-pos { color: #86EFAC; }
[data-theme="dark"] .fee-neg { color: var(--text-muted); }

/* Challans tab dark */
[data-theme="dark"] .fee-iconbtn.green { background: rgba(34,197,94,.15); border-color: rgba(34,197,94,.35); color: #86EFAC; }
[data-theme="dark"] .fee-iconbtn.green:hover { background: var(--success); color: #fff; border-color: var(--success); }
[data-theme="dark"] .fee-iconbtn:disabled:hover { color: var(--text-muted); border-color: var(--border-light); background: var(--bg-muted); }
[data-theme="dark"] .fee-search-box {
  background: var(--input-bg, var(--bg-card));
  border-color: var(--border-light);
}
[data-theme="dark"] .fee-search-box:focus-within {
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59,130,246,.15);
}
[data-theme="dark"] .fee-search-box input { color: var(--text-primary); }
[data-theme="dark"] .fee-search-box input::placeholder { color: var(--text-muted); }
[data-theme="dark"] .fee-search-box > i { color: var(--text-muted); }
[data-theme="dark"] .fee-search-clear { background: var(--bg-muted); color: var(--text-muted); }
[data-theme="dark"] .fee-search-clear:hover { background: rgba(220,38,38,.18); color: #FCA5A5; }
[data-theme="dark"] .fee-search-results {
  background: var(--bg-card);
  border-color: var(--border-light);
  box-shadow: 0 20px 40px rgba(0,0,0,.55), 0 4px 12px rgba(0,0,0,.3);
}
[data-theme="dark"] .fee-sr-item:hover { background: var(--bg-muted); }
[data-theme="dark"] .fee-sr-av,
[data-theme="dark"] .fee-sr-go {
  background: rgba(59,130,246,.15);
  color: #93C5FD;
}
[data-theme="dark"] .fee-sr-name { color: var(--text-primary); }
[data-theme="dark"] .fee-sr-meta { color: var(--text-muted); }
[data-theme="dark"] .fee-sr-meta b { color: var(--text-secondary); }
[data-theme="dark"] .fee-sr-empty { color: var(--text-muted); }
[data-theme="dark"] .fee-sr-empty b { color: var(--text-primary); }
[data-theme="dark"] .fee-hint { color: var(--text-muted); }
[data-theme="dark"] .fee-hint i { color: #93C5FD; }
[data-theme="dark"] .fee-chip-active {
  background: rgba(22,163,74,.18);
  color: #86EFAC;
  border-color: rgba(22,163,74,.35);
}
[data-theme="dark"] .fee-chip-due {
  background: rgba(220,38,38,.18);
  color: #FCA5A5;
  border-color: rgba(220,38,38,.35);
}
[data-theme="dark"] .fee-gen-bar { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .fee-m-actions { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .fee-m-stat-label { color: var(--text-muted); }
[data-theme="dark"] .fee-m-stat-val { color: var(--text-primary); }
[data-theme="dark"] .fee-m-danger { color: #FCA5A5; border-color: rgba(220,38,38,.35); }
[data-theme="dark"] .fee-m-danger:hover { background: rgba(220,38,38,.18); color: #FCA5A5; }
[data-theme="dark"] .fee-stbl tbody td.fee-neg { color: #86EFAC; }
[data-theme="dark"] .fee-st-flash { animation: feeFlashDark 1.6s ease; }
@keyframes feeFlashDark {
  0%   { background: rgba(34,197,94,.25); }
  60%  { background: rgba(34,197,94,.12); }
  100% { background: transparent; }
}
[data-theme="dark"] .fee-stbl-wrap { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .fee-stbl thead th { background: var(--bg-muted); color: var(--text-muted); border-bottom-color: var(--border-light); }
[data-theme="dark"] .fee-stbl tbody td { border-bottom-color: var(--border-light); color: var(--text-primary); }
[data-theme="dark"] .fee-stbl-foot td { background: var(--bg-muted); }
[data-theme="dark"] .fee-stbl-empty { color: var(--text-muted); }
[data-theme="dark"] .fee-chip-active { background: rgba(34,197,94,.18); color: #86EFAC; border-color: rgba(34,197,94,.35); }

/* Modal dark */
[data-theme="dark"] .fee-overlay { background: rgba(0,0,0,.65); }
[data-theme="dark"] .fee-modal { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .fee-modal-head { border-bottom-color: var(--border-light); background: linear-gradient(135deg, rgba(59,130,246,.08), transparent); }
[data-theme="dark"] .fee-modal-title { color: var(--text-primary); }
[data-theme="dark"] .fee-modal-sub { color: var(--text-muted); }
[data-theme="dark"] .fee-modal-close { background: var(--bg-muted); color: var(--text-muted); }
[data-theme="dark"] .fee-modal-close:hover { background: rgba(220,38,38,.18); color: #FCA5A5; }
[data-theme="dark"] .fee-modal-body { color: var(--text-primary); }
[data-theme="dark"] .fee-modal-foot { background: var(--bg-muted); border-top-color: var(--border-light); }
[data-theme="dark"] .fee-mini-label { color: var(--text-muted); }
[data-theme="dark"] .fee-input { background: var(--input-bg, var(--bg-card)); border-color: var(--border-light); color: var(--text-primary); }
[data-theme="dark"] .fee-input:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.15); }
[data-theme="dark"] .fee-input::placeholder { color: var(--text-muted); }
[data-theme="dark"] .fee-add-head { border-color: var(--border-light); color: var(--text-secondary); background: var(--bg-muted); }
[data-theme="dark"] .fee-add-head:hover { border-color: #3B82F6; color: #93C5FD; background: rgba(59,130,246,.08); }
[data-theme="dark"] .fee-head-total { background: linear-gradient(135deg, rgba(59,130,246,.12), transparent); border-color: rgba(59,130,246,.3); color: var(--text-secondary); }
[data-theme="dark"] .fee-head-total strong { color: #93C5FD; }
[data-theme="dark"] .fee-empty,
[data-theme="dark"] .fee-empty--small { color: var(--text-muted); background: var(--bg-muted); }

/* ─── Fee Receiving tab ─── */
.fee-recind-row { grid-template-columns: 70px 1.1fr 1.4fr 220px 70px; }
.fee-recfam-row { grid-template-columns: 60px 1fr 1.3fr 130px 220px 70px; }
.fee-hist-row   { grid-template-columns: 70px 1.4fr 150px 110px 70px; }
.fee-rep-clsrow-grid { grid-template-columns: 60px 1fr 1fr 150px 80px; }

/* Reports tab — category chips */
.fee-rep-chips {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}
/* Page-level Colorful / Colorless toggle for the Reports tab */
.fee-rep-style-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin: 4px 0 14px;
  padding: 10px 14px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  box-shadow: var(--shadow-xs, 0 1px 2px rgba(15,23,42,.04));
}
.fee-rep-style-lbl {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--text-muted);
}
.fee-rep-style-seg {
  display: inline-flex;
  background: var(--bg-muted);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  padding: 3px;
  gap: 3px;
}
.fee-rep-style-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 13px;
  border: none;
  background: transparent;
  border-radius: 7px;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  transition: all .18s ease;
}
.fee-rep-style-btn i { font-size: 10px; }
.fee-rep-style-btn:hover { color: var(--brand-primary, #1E40AF); }
.fee-rep-style-btn.on {
  background: var(--bg-card);
  color: var(--brand-primary, #1E40AF);
  box-shadow: 0 1px 3px rgba(15,23,42,.10);
}
.fee-rep-style-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(30,64,175,.22);
}
[data-theme="dark"] .fee-rep-style-row { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .fee-rep-style-seg { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .fee-rep-style-btn.on { background: var(--bg-card); color: #93C5FD; }
[data-theme="dark"] .fee-rep-style-btn:focus-visible { box-shadow: 0 0 0 3px rgba(59,130,246,.32); }
.fee-rep-chip {
  display: flex;
  align-items: center;
  gap: 11px;
  text-align: left;
  padding: 13px 15px;
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  background: var(--bg-card);
  cursor: pointer;
  transition: all .2s ease;
  font-family: var(--font-body);
  width: 100%;
}
.fee-rep-chip:hover {
  border-color: #1E3A8A;
  transform: translateY(-3px);
  box-shadow: 0 12px 28px rgba(30,58,138,.15);
}
.fee-rep-chip-ic { transition: transform .25s ease, box-shadow .25s ease; }
.fee-rep-chip:hover .fee-rep-chip-ic {
  transform: scale(1.08) rotate(-6deg);
  box-shadow: 0 6px 14px rgba(30,58,138,.35);
}
.fee-rep-chip.active {
  border-color: #1E3A8A;
  background: linear-gradient(135deg, rgba(30,58,138,.06), transparent);
  box-shadow: 0 0 0 3px rgba(30,58,138,.1);
}
.fee-rep-chip-ic {
  width: 38px; height: 38px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; color: #fff;
  flex-shrink: 0;
  background: linear-gradient(135deg, #1E3A8A, #2563EB);
}
.fee-rep-chip-name { font-size: 13px; font-weight: 800; color: var(--text-primary); line-height: 1.2; }
.fee-rep-chip-desc { font-size: 10.5px; color: var(--text-muted); margin-top: 3px; line-height: 1.35; }

/* KPI strip (used across reports) */
.fee-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}
.fee-kpi {
  border: 1.5px solid var(--border-light);
  border-radius: 14px;
  padding: 14px 16px;
  background: var(--bg-card);
  position: relative;
  overflow: hidden;
  transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
  cursor: default;
}
.fee-kpi:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 28px rgba(15,23,42,.10);
  border-color: var(--border-med);
}
.fee-kpi.k-blue:hover  { border-color: #2563EB; box-shadow: 0 12px 28px rgba(30,58,138,.18); }
.fee-kpi.k-green:hover { border-color: #16A34A; box-shadow: 0 12px 28px rgba(22,163,74,.18); }
.fee-kpi.k-amber:hover { border-color: #D97706; box-shadow: 0 12px 28px rgba(217,119,6,.18); }
.fee-kpi.k-red:hover   { border-color: #DC2626; box-shadow: 0 12px 28px rgba(220,38,38,.18); }
.fee-kpi-ic { transition: transform .25s ease; }
.fee-kpi:hover .fee-kpi-ic { transform: scale(1.1) rotate(-4deg); }
.fee-kpi::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 4px;
  border-radius: 14px 14px 0 0;
}
.fee-kpi.k-blue::before  { background: linear-gradient(90deg, #1E3A8A, #2563EB); }
.fee-kpi.k-green::before { background: linear-gradient(90deg, #16A34A, #22C55E); }
.fee-kpi.k-amber::before { background: linear-gradient(90deg, #D97706, #F59E0B); }
.fee-kpi.k-red::before   { background: linear-gradient(90deg, #DC2626, #EF4444); }
.fee-kpi-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.fee-kpi-label {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .3px;
  text-transform: uppercase;
  color: var(--text-muted);
}
.fee-kpi-ic {
  width: 30px; height: 30px;
  border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px;
}
.fee-kpi.k-blue  .fee-kpi-ic { background: rgba(30,58,138,.10);  color: #1E3A8A; }
.fee-kpi.k-green .fee-kpi-ic { background: rgba(22,163,74,.10);  color: #16A34A; }
.fee-kpi.k-amber .fee-kpi-ic { background: rgba(217,119,6,.10);  color: #D97706; }
.fee-kpi.k-red   .fee-kpi-ic { background: rgba(220,38,38,.10);  color: #DC2626; }
.fee-kpi-val {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-primary);
  margin-top: 10px;
  letter-spacing: -.02em;
  font-variant-numeric: tabular-nums;
}
.fee-kpi-meta {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 3px;
}
.fee-kpi-meta b.up   { color: #16A34A; }
.fee-kpi-meta b.down { color: #DC2626; }

/* Aging bar + legend */
.age-legend {
  display: flex; flex-wrap: wrap; gap: 14px;
  font-size: 11.5px; color: var(--text-secondary);
  font-weight: 700; align-items: center;
  margin-bottom: 12px;
}
.age-legend span { display: inline-flex; align-items: center; gap: 7px; }
.age-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  display: inline-block;
}
.age-cur, .age-dot.age-cur { background: #16A34A; }
.age-30,  .age-dot.age-30  { background: #F59E0B; }
.age-60,  .age-dot.age-60  { background: #D97706; }
.age-90,  .age-dot.age-90  { background: #DC2626; }
.age-bar {
  height: 12px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--bg-muted);
  border: 1px solid var(--border-light);
  display: flex;
}
.age-bar > i {
  height: 100%;
  display: block;
  cursor: pointer;
  transition: filter .15s ease, transform .15s ease;
}
.age-bar > i:hover { filter: brightness(1.15); transform: scaleY(1.15); }
.rep-bar { cursor: pointer; }
.rep-bar:hover { filter: brightness(1.1); }

/* Summary tab bars */
.rep-bars {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(60px, 1fr);
  align-items: end;
  gap: 8px;
  height: 180px;
  padding: 10px 6px 0;
  border-bottom: 1.5px solid var(--border-light);
}
.rep-bar-col {
  display: flex; flex-direction: column;
  justify-content: flex-end; align-items: center;
  height: 100%; gap: 6px;
  cursor: pointer;
}
.rep-bar-pair {
  display: flex; gap: 4px; align-items: flex-end;
  width: 100%; height: 100%; justify-content: center;
}
.rep-bar {
  width: 18px; min-height: 4px;
  background: #1E3A8A;
  border-radius: 4px 4px 0 0;
  transition: transform .2s ease;
}
.rep-bar.green { background: #16A34A; }
.rep-bar-col:hover .rep-bar { transform: scaleY(1.04); transform-origin: bottom; }
.rep-bar-lbl {
  font-size: 11px;
  font-weight: 800;
  color: var(--text-muted);
  text-align: center;
  margin-top: 4px;
}

/* Payment-mode mini cards */
.mode-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}
.mode-card {
  border: 1.5px solid var(--border-light);
  border-radius: 14px;
  padding: 14px 16px;
  background: var(--bg-card);
  transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
  cursor: default;
}
.mode-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 28px rgba(15,23,42,.10);
  border-color: var(--border-med);
}
.mode-ic { transition: transform .25s ease; }
.mode-card:hover .mode-ic { transform: scale(1.1) rotate(-4deg); }

/* Method chip — used in collection tables to colour-code payment channel */
.fee-method-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  border: 1px solid transparent;
  white-space: nowrap;
}
.mode-card-top {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 12px;
}
.mode-ic {
  width: 36px; height: 36px;
  border-radius: 10px;
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}
.mode-name {
  flex: 1; min-width: 0;
  font-size: 13.5px;
  font-weight: 800;
  color: var(--text-primary);
}
.mode-actions { display: inline-flex; gap: 6px; flex-shrink: 0; }
.mode-act-btn {
  width: 30px; height: 30px;
  border-radius: 8px;
  border: 1.5px solid var(--border-light);
  background: var(--bg-card);
  color: var(--text-muted);
  cursor: pointer;
  font-size: 11px;
  display: inline-flex; align-items: center; justify-content: center;
  transition: all .15s ease;
}
.mode-act-btn:hover { color: #1E3A8A; border-color: #1E3A8A; }
.mode-amt {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.mode-pct {
  font-size: 11.5px;
  color: var(--text-muted);
  font-weight: 700;
  margin-top: 2px;
}
.mode-track {
  margin-top: 10px;
  height: 6px;
  border-radius: 999px;
  background: var(--bg-muted);
  border: 1px solid var(--border-light);
  overflow: hidden;
}
.mode-track > i { display: block; height: 100%; border-radius: 999px; }

/* Dark mode */
[data-theme="dark"] .fee-rep-chip,
[data-theme="dark"] .fee-kpi,
[data-theme="dark"] .mode-card {
  background: var(--bg-card);
  border-color: var(--border-light);
}
[data-theme="dark"] .fee-rep-chip:hover,
[data-theme="dark"] .mode-card:hover { border-color: var(--border-med); }
[data-theme="dark"] .fee-rep-chip.active {
  background: linear-gradient(135deg, rgba(59,130,246,.08), transparent);
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59,130,246,.15);
}
[data-theme="dark"] .fee-rep-chip-name,
[data-theme="dark"] .fee-kpi-val,
[data-theme="dark"] .mode-name,
[data-theme="dark"] .mode-amt { color: var(--text-primary); }
[data-theme="dark"] .fee-rep-chip-desc,
[data-theme="dark"] .fee-kpi-label,
[data-theme="dark"] .fee-kpi-meta,
[data-theme="dark"] .mode-pct,
[data-theme="dark"] .age-legend { color: var(--text-muted); }
[data-theme="dark"] .age-bar,
[data-theme="dark"] .mode-track {
  background: var(--bg-muted);
  border-color: var(--border-light);
}
[data-theme="dark"] .rep-bars { border-color: var(--border-light); }
[data-theme="dark"] .mode-act-btn {
  background: var(--bg-card);
  border-color: var(--border-light);
  color: var(--text-muted);
}
[data-theme="dark"] .mode-act-btn:hover { color: #93C5FD; border-color: #3B82F6; }

/* Fee History — overall school reports band */
.fee-hist-overall {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 14px 18px;
  margin-bottom: 16px;
  border: 1.5px solid var(--border-light);
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(30,58,138,.05), rgba(29,184,138,.04));
  box-shadow: var(--shadow-sm);
}
.fee-hist-overall-info { display: flex; align-items: center; gap: 13px; }
.fee-hist-overall-info > i {
  width: 42px; height: 42px;
  border-radius: 12px;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}
.fee-hist-overall-title { font-size: 14px; font-weight: 800; color: var(--text-primary); }
.fee-hist-overall-sub   { font-size: 12px; color: var(--text-muted); margin-top: 1px; }
.fee-hist-overall-btns  { display: flex; gap: 10px; flex-wrap: wrap; }

/* View button used in history student rows */
.fee-hist-vbtn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 10px;
  border: 1.5px solid #1E3A8A;
  background: var(--bg-card);
  color: #1E3A8A;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: all .2s ease;
}
.fee-hist-vbtn:hover {
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  border-color: transparent;
}

/* Meta-card strip inside the history modal */
.fee-hist-ledger-meta {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.fee-hist-metacard {
  border: 1.5px solid var(--border-light);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--bg-muted);
}
.fee-hist-metacard .l {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: .3px;
}
.fee-hist-metacard .v {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-primary);
  margin-top: 3px;
  font-variant-numeric: tabular-nums;
}
.fee-hist-metacard .v.green { color: #16A34A; }
.fee-hist-metacard .v.red   { color: #DC2626; }

/* Detailed-history month card (accordion-style block) */
.fee-month-card {
  border: 1.5px solid var(--border-light);
  border-radius: 14px;
  overflow: hidden;
  margin-bottom: 14px;
  box-shadow: var(--shadow-sm);
}
.fee-month-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(30,58,138,.05), transparent);
  border-bottom: 1px solid var(--border-light);
  flex-wrap: wrap;
}
.fee-month-title { font-size: 13.5px; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 10px; }
.fee-month-title .mm {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .4px;
}
.fee-month-body { display: grid; grid-template-columns: 1fr 1fr; }
.fee-month-col  { padding: 14px 16px; }
.fee-month-col + .fee-month-col { border-left: 1px solid var(--border-light); }
.fee-month-col h5 {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .4px;
  text-transform: uppercase;
  color: #1E3A8A;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.fee-month-col h5 > span { display: inline-flex; align-items: center; gap: 7px; }

.fee-kv {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 12px;
  font-size: 12.5px;
}
.fee-kv .k { color: var(--text-muted); font-weight: 600; }
.fee-kv .v { text-align: right; font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; }
.fee-kv .v.green { color: #16A34A; }
.fee-kv .v.red   { color: #DC2626; }

/* Dark mode */
[data-theme="dark"] .fee-hist-overall {
  background: linear-gradient(135deg, rgba(59,130,246,.10), rgba(34,197,94,.06));
  border-color: var(--border-light);
}
[data-theme="dark"] .fee-hist-overall-title { color: var(--text-primary); }
[data-theme="dark"] .fee-hist-overall-sub   { color: var(--text-muted); }
[data-theme="dark"] .fee-hist-vbtn {
  background: var(--bg-card);
  color: #93C5FD;
  border-color: #3B82F6;
}
[data-theme="dark"] .fee-hist-vbtn:hover {
  background: linear-gradient(135deg, #2563EB, #1D4ED8);
  color: #fff;
}
[data-theme="dark"] .fee-hist-metacard {
  background: var(--bg-muted);
  border-color: var(--border-light);
}
[data-theme="dark"] .fee-hist-metacard .l { color: var(--text-muted); }
[data-theme="dark"] .fee-hist-metacard .v { color: var(--text-primary); }
[data-theme="dark"] .fee-hist-metacard .v.green { color: #86EFAC; }
[data-theme="dark"] .fee-hist-metacard .v.red   { color: #FCA5A5; }
[data-theme="dark"] .fee-month-card,
[data-theme="dark"] .fee-month-head { border-color: var(--border-light); }
[data-theme="dark"] .fee-month-head { background: linear-gradient(135deg, rgba(59,130,246,.08), transparent); }
[data-theme="dark"] .fee-month-col + .fee-month-col { border-left-color: var(--border-light); }
[data-theme="dark"] .fee-month-col h5 { color: #93C5FD; }
[data-theme="dark"] .fee-kv .k { color: var(--text-muted); }
[data-theme="dark"] .fee-kv .v { color: var(--text-primary); }
[data-theme="dark"] .fee-kv .v.green { color: #86EFAC; }
[data-theme="dark"] .fee-kv .v.red   { color: #FCA5A5; }

/* Bulk Fee Receiving modal — child list + expandable per-child card */
.fee-recv-summary-title {
  text-align: center;
  font-size: 14px;
  font-weight: 800;
  color: #1E3A8A;
  margin-bottom: 14px;
  letter-spacing: .2px;
}
.fee-bulk-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 6px; }
.fee-bulk-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  background: var(--bg-card);
  cursor: pointer;
  transition: all .2s ease;
  font-family: var(--font-body);
  text-align: left;
  width: 100%;
}
.fee-bulk-row:hover  { border-color: #1E3A8A; background: var(--bg-muted); }
.fee-bulk-row.sel {
  border-color: #1E3A8A;
  box-shadow: 0 0 0 3px rgba(30,58,138,.1);
  background: linear-gradient(135deg, rgba(30,58,138,.04), transparent);
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}
.fee-bulk-av {
  width: 38px; height: 38px;
  border-radius: 10px;
  background: linear-gradient(135deg, #DBEAFE, #EEF4FF);
  color: #1E3A8A;
  font-weight: 800;
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.fee-bulk-main { flex: 1; min-width: 0; }
.fee-bulk-name { font-size: 13.5px; font-weight: 800; color: var(--text-primary); }
.fee-bulk-meta { font-size: 11.5px; color: var(--text-muted); margin-top: 1px; }
.fee-bulk-status { display: inline-flex; align-items: center; flex-shrink: 0; }
.fee-bulk-chev   { color: var(--text-muted); font-size: 12px; flex-shrink: 0; transition: all .2s; }
.fee-bulk-row.sel .fee-bulk-chev { color: #1E3A8A; }
.fee-bulk-card {
  border: 1.5px solid #1E3A8A;
  border-top: none;
  border-radius: 0 0 12px 12px;
  background: var(--bg-card);
  padding: 16px;
  margin: -6px 0 4px;
  animation: feeBulkCardIn .2s ease;
}
@keyframes feeBulkCardIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }

.fee-recv-band {
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  text-align: center;
  font-weight: 800;
  font-size: 14px;
  padding: 12px;
  border-radius: 10px;
}
.fee-onelink-note {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 14px;
  margin-bottom: 12px;
  border-radius: 10px;
  background: rgba(124,58,237,.08);
  border: 1px solid rgba(124,58,237,.25);
  color: #6D28D9;
  font-size: 12.5px;
  font-weight: 600;
}
.fee-onelink-note i { color: #7C3AED; font-size: 13px; }

[data-theme="dark"] .fee-recv-summary-title { color: #93C5FD; }
[data-theme="dark"] .fee-bulk-row {
  background: var(--bg-card);
  border-color: var(--border-light);
}
[data-theme="dark"] .fee-bulk-row:hover { background: var(--bg-muted); border-color: #3B82F6; }
[data-theme="dark"] .fee-bulk-row.sel   { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.15); }
[data-theme="dark"] .fee-bulk-av {
  background: rgba(59,130,246,.16);
  color: #93C5FD;
}
[data-theme="dark"] .fee-bulk-name { color: var(--text-primary); }
[data-theme="dark"] .fee-bulk-meta { color: var(--text-muted); }
[data-theme="dark"] .fee-bulk-card { background: var(--bg-card); border-color: #3B82F6; }
[data-theme="dark"] .fee-onelink-note {
  background: rgba(124,58,237,.18);
  border-color: rgba(124,58,237,.35);
  color: #C4B5FD;
}
[data-theme="dark"] .fee-onelink-note i { color: #C4B5FD; }
.fee-recv-clssec { display: flex; flex-direction: column; gap: 2px; }
.fee-recv-clssec b { font-weight: 800; color: var(--text-primary); }
.fee-recv-clssec span { font-size: 11px; color: var(--text-muted); font-weight: 600; }

.fee-recv-sumchips { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
.fee-recv-sumchip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  border: 1px solid transparent;
  white-space: nowrap;
}
.fee-recv-sumchip .n { font-size: 12px; }
.fee-recv-sumchip.total   { background: rgba(30,64,175,.08); color: #1E40AF; border-color: rgba(30,64,175,.18); }
.fee-recv-sumchip.paid    { background: rgba(22,163,74,.1);  color: #16A34A; border-color: rgba(22,163,74,.22); }
.fee-recv-sumchip.unpaid  { background: rgba(220,38,38,.08); color: #DC2626; border-color: rgba(220,38,38,.2); }
.fee-recv-sumchip.onelink { background: rgba(124,58,237,.10); color: #7C3AED; border-color: rgba(124,58,237,.25); }

.fee-reminder-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 16px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  font-family: var(--font-body);
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all .2s ease;
  white-space: nowrap;
  box-shadow: 0 3px 10px rgba(30,58,138,.25);
}
.fee-reminder-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(30,58,138,.35); }

.fee-recv-link {
  color: #1E3A8A;
  font-weight: 800;
  font-size: 12.5px;
  cursor: pointer;
  background: none;
  border: none;
  font-family: var(--font-body);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all .15s ease;
}
.fee-recv-link:hover { text-decoration: underline; }
/* Action-cell wrapper — keeps the link + 3 icon buttons on ONE row.
   white-space:nowrap + flex-wrap:nowrap stop the icons spilling onto
   a second line; the parent .fee-stbl-wrap handles horizontal scroll
   if a narrow viewport ever forces overflow. */
.fee-recv-acts {
  display: inline-flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;
}
.fee-recv-acts .fee-recv-link {
  padding: 4px 10px;
  border-radius: 8px;
  background: rgba(30,58,138,.06);
  border: 1px solid rgba(30,58,138,.15);
  white-space: nowrap;
  flex-shrink: 0;
}
.fee-recv-acts .fee-recv-link:hover {
  background: rgba(30,58,138,.12);
  text-decoration: none;
}
.fee-recv-acts .fee-iconbtn { flex-shrink: 0; }
[data-theme="dark"] .fee-recv-acts .fee-recv-link {
  background: rgba(59,130,246,.10);
  border-color: rgba(59,130,246,.25);
  color: #93C5FD;
}
[data-theme="dark"] .fee-recv-acts .fee-recv-link:hover {
  background: rgba(59,130,246,.18);
}
.fee-recv-notice { color: #DC2626; font-weight: 700; font-size: 11.5px; text-align: center; line-height: 1.5; }
.fee-recv-notice b { font-weight: 800; }
.fee-iconbtn.tiny { width: 28px; height: 28px; font-size: 11px; }
.fee-this-dues { color: #DC2626; font-weight: 700; }
.fee-this-dues.zero { color: #DC2626; }
.fee-sub-eq { display: block; font-size: 10.5px; color: var(--text-muted); font-weight: 600; margin-top: 1px; }
.fee-disc-amt { color: #D97706; font-weight: 700; }
.fee-paid-amt { color: #16A34A; font-weight: 700; }

.fee-stat-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 11px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}
.fee-stat-full    { background: rgba(22,163,74,.12);  color: #16A34A; border: 1px solid rgba(22,163,74,.25); }
.fee-stat-partial { background: rgba(217,119,6,.12);  color: #D97706; border: 1px solid rgba(217,119,6,.28); }
.fee-stat-none    { background: rgba(220,38,38,.08);  color: #DC2626; border: 1px solid rgba(220,38,38,.2); }
.fee-onelink-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
  background: rgba(124,58,237,.1);
  color: #7C3AED;
  border: 1px solid rgba(124,58,237,.25);
}
.fee-recv-status {
  display: inline-flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;
}
.fee-recv-status .fee-stat-badge,
.fee-recv-status .fee-onelink-tag { flex-shrink: 0; }

/* ─── Fee Receiving Modal ─── */
.fee-recv-meta {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 14px;
  margin-bottom: 16px;
}
.fee-recv-info {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 14px;
  padding: 14px 16px;
  background: var(--bg-muted);
  border: 1px solid var(--border-light);
  border-radius: 10px;
}
.fee-recv-info-item { display: flex; flex-direction: column; gap: 3px; }
.fee-recv-info-lbl  { font-size: 11px; font-weight: 700; color: var(--text-muted); letter-spacing: .2px; }
.fee-recv-info-val  { font-size: 13.5px; font-weight: 800; color: var(--text-primary); }
.fee-recv-table th  { white-space: nowrap; }
.fee-recv-table input {
  width: 110px;
  height: 34px;
  border: 1.5px solid var(--border-light);
  border-radius: 8px;
  padding: 0 10px;
  font-family: var(--font-body);
  font-size: 12.5px;
  font-weight: 600;
  text-align: right;
  background: var(--bg-card);
  color: var(--text-primary);
  outline: none;
  transition: all .15s ease;
}
.fee-recv-table input:focus { border-color: #1E3A8A; box-shadow: 0 0 0 3px rgba(30,58,138,.08); }
.fee-recv-table .fee-recv-total td {
  background: var(--bg-muted);
  font-weight: 800;
  border-bottom: none;
  border-top: 1.5px solid var(--border-light);
}
.fee-recv-table .fee-cell-grey {
  background: var(--bg-muted);
  border-radius: 6px;
  padding: 6px 10px;
  display: inline-block;
  min-width: 80px;
  text-align: right;
  font-weight: 600;
}

.fee-recv-paystrip {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 12px;
  margin-top: 18px;
}
.fee-recv-paycard {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  background: var(--bg-card);
}
.fee-recv-paylbl { font-size: 11px; font-weight: 700; color: var(--text-muted); letter-spacing: .3px; text-transform: uppercase; }
.fee-recv-payval {
  font-size: 18px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}
.fee-recv-payval.green { color: #16A34A; }
.fee-recv-payval.blue  { color: #1E3A8A; }
.fee-recv-payval.red   { color: #DC2626; }

.fee-recv-hist-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  font-weight: 800;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: .5px;
}
.fee-recv-hist-title i { color: #1E3A8A; }

/* ─── Reminder Modal ─── */
.fee-textarea {
  min-height: 90px;
  resize: vertical;
  padding: 10px 12px;
  line-height: 1.55;
}
.fee-rem-counter {
  text-align: right;
  font-size: 11.5px;
  color: var(--text-muted);
  font-weight: 600;
  margin-top: 4px;
}
.fee-rem-counter span { font-variant-numeric: tabular-nums; }
.fee-rem-target {
  margin-top: 12px;
  padding: 11px 14px;
  border-radius: 10px;
  background: rgba(30,58,138,.05);
  border: 1px solid rgba(30,58,138,.15);
  font-size: 12.5px;
  color: var(--text-secondary);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}
.fee-rem-target i { color: #1E3A8A; }

/* ─── Slip Modal preview ─── */
.fee-slip-doc {
  background: #fff;
  color: #111;
  border: 1px solid #ddd;
  border-radius: 10px;
  padding: 20px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  max-width: 420px;
  margin: 0 auto;
}
.fee-slip-doc.fee-slip-small { max-width: 300px; padding: 14px; font-size: 11px; }
.fee-slip-head { text-align: center; border-bottom: 1.5px solid #111; padding-bottom: 10px; margin-bottom: 12px; }
.fee-slip-school { font-size: 16px; font-weight: 800; color: #111; }
.fee-slip-tag { font-size: 11px; color: #555; letter-spacing: 1px; text-transform: uppercase; margin-top: 3px; }
.fee-slip-kv {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 10px;
  font-size: 12px;
  margin-bottom: 12px;
  color: #111;
}
.fee-slip-kv .k { color: #666; }
.fee-slip-kv .v { text-align: right; font-weight: 700; }
.fee-slip-tbl { width: 100%; border-collapse: collapse; font-size: 11.5px; margin-bottom: 10px; color: #111; }
.fee-slip-tbl th,
.fee-slip-tbl td { border-bottom: 1px solid #eee; padding: 5px 4px; text-align: right; }
.fee-slip-tbl th:first-child,
.fee-slip-tbl td:first-child { text-align: left; }
.fee-slip-tbl th { border-bottom: 1.5px solid #333; color: #333; }
.fee-slip-headtot td { border-top: 1.5px solid #333; border-bottom: none; font-weight: 800; background: #f5f7fb; }
.fee-slip-net {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #111;
  color: #fff;
  padding: 8px 12px;
  border-radius: 4px;
  font-weight: 800;
}

/* Multi-select + progress — dark */
[data-theme="dark"] .fee-ms-toggle {
  background: var(--input-bg, var(--bg-card));
  border-color: var(--border-light);
  color: var(--text-secondary);
}
[data-theme="dark"] .fee-ms.open .fee-ms-toggle {
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59,130,246,.15);
}
[data-theme="dark"] .fee-ms-menu {
  background: var(--bg-card);
  border-color: var(--border-light);
  box-shadow: 0 12px 32px rgba(0,0,0,.5);
}
[data-theme="dark"] .fee-ms-opt { color: var(--text-primary); }
[data-theme="dark"] .fee-ms-opt:hover { background: var(--bg-muted); }
[data-theme="dark"] .fee-ms-check { border-color: var(--border-med); }
[data-theme="dark"] .fee-ms-opt.sel .fee-ms-check { background: #3B82F6; border-color: #3B82F6; }
[data-theme="dark"] .fee-ms-amt { color: var(--text-muted); }
[data-theme="dark"] .fee-ms-opt.sel .fee-ms-amt { color: #93C5FD; }
[data-theme="dark"] .fee-ms-empty { color: var(--text-muted); }
[data-theme="dark"] .fee-prog-label { color: var(--text-secondary); }
[data-theme="dark"] .fee-prog-label span:last-child { color: #93C5FD; }
[data-theme="dark"] .fee-prog-track { background: var(--bg-muted); border-color: var(--border-light); }

/* Challan preview body — dark (keeps the doc itself white for legibility) */
[data-theme="dark"] .fee-preview-body { background: #1A2236; }

/* Download Picker — dark */
[data-theme="dark"] .fee-dl-label { color: var(--text-muted); }
[data-theme="dark"] .fee-dl-label::after { background: var(--border-light); }
[data-theme="dark"] .fee-dl-card,
[data-theme="dark"] .fee-dl-fmt {
  background: var(--bg-card);
  border-color: var(--border-light);
}
[data-theme="dark"] .fee-dl-card:hover,
[data-theme="dark"] .fee-dl-fmt:hover { border-color: var(--border-med); box-shadow: 0 8px 24px rgba(0,0,0,.4); }
[data-theme="dark"] .fee-dl-card.sel,
[data-theme="dark"] .fee-dl-fmt.sel { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.18); }
[data-theme="dark"] .fee-dl-meta .fee-dl-name { color: var(--text-primary); }
[data-theme="dark"] .fee-dl-meta .fee-dl-desc { color: var(--text-muted); }
[data-theme="dark"] .fee-dl-fmt-name { color: var(--text-primary); }

/* Discount Manager — dark */
[data-theme="dark"] .fee-dm-table th {
  color: var(--text-muted);
  background: var(--bg-muted);
  border-bottom-color: var(--border-light);
}
[data-theme="dark"] .fee-dm-table td {
  color: var(--text-primary);
  border-bottom-color: var(--border-light);
}
[data-theme="dark"] .fee-dm-table input {
  background: var(--input-bg, var(--bg-card));
  border-color: var(--border-light);
  color: var(--text-primary);
}
[data-theme="dark"] .fee-dm-table input:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.18); }
[data-theme="dark"] .fee-dm-net { color: #93C5FD; }
[data-theme="dark"] .fee-dm-total-row td { background: var(--bg-muted); }

/* Fee Receiving — dark */
[data-theme="dark"] .fee-recv-clssec b { color: var(--text-primary); }
[data-theme="dark"] .fee-recv-clssec span { color: var(--text-muted); }
[data-theme="dark"] .fee-recv-sumchip.total   { background: rgba(59,130,246,.16); color: #93C5FD; border-color: rgba(59,130,246,.3); }
[data-theme="dark"] .fee-recv-sumchip.paid    { background: rgba(22,163,74,.18);  color: #86EFAC; border-color: rgba(22,163,74,.32); }
[data-theme="dark"] .fee-recv-sumchip.unpaid  { background: rgba(220,38,38,.16);  color: #FCA5A5; border-color: rgba(220,38,38,.3); }
[data-theme="dark"] .fee-recv-sumchip.onelink { background: rgba(124,58,237,.18); color: #C4B5FD; border-color: rgba(124,58,237,.32); }
[data-theme="dark"] .fee-recv-info {
  background: var(--bg-muted);
  border-color: var(--border-light);
}
[data-theme="dark"] .fee-recv-info-lbl { color: var(--text-muted); }
[data-theme="dark"] .fee-recv-info-val { color: var(--text-primary); }
[data-theme="dark"] .fee-recv-table input {
  background: var(--input-bg, var(--bg-card));
  border-color: var(--border-light);
  color: var(--text-primary);
}
[data-theme="dark"] .fee-recv-table input:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.15); }
[data-theme="dark"] .fee-recv-table .fee-cell-grey { background: var(--bg-muted); color: var(--text-primary); }
[data-theme="dark"] .fee-recv-table .fee-recv-total td {
  background: var(--bg-muted);
  border-top-color: var(--border-light);
}
[data-theme="dark"] .fee-recv-paycard {
  background: var(--bg-card);
  border-color: var(--border-light);
}
[data-theme="dark"] .fee-recv-paylbl { color: var(--text-muted); }
[data-theme="dark"] .fee-recv-payval { color: var(--text-primary); }
[data-theme="dark"] .fee-recv-payval.green { color: #86EFAC; }
[data-theme="dark"] .fee-recv-payval.blue  { color: #93C5FD; }
[data-theme="dark"] .fee-recv-payval.red   { color: #FCA5A5; }
[data-theme="dark"] .fee-recv-hist-title { color: var(--text-secondary); }
[data-theme="dark"] .fee-recv-hist-title i { color: #93C5FD; }
[data-theme="dark"] .fee-stat-full    { background: rgba(22,163,74,.18);  color: #86EFAC; border-color: rgba(22,163,74,.32); }
[data-theme="dark"] .fee-stat-partial { background: rgba(217,119,6,.18);  color: #FCD34D; border-color: rgba(217,119,6,.32); }
[data-theme="dark"] .fee-stat-none    { background: rgba(220,38,38,.18);  color: #FCA5A5; border-color: rgba(220,38,38,.32); }
[data-theme="dark"] .fee-onelink-tag  { background: rgba(124,58,237,.18); color: #C4B5FD; border-color: rgba(124,58,237,.32); }
[data-theme="dark"] .fee-recv-link    { color: #93C5FD; }
[data-theme="dark"] .fee-recv-notice  { color: #FCA5A5; }
[data-theme="dark"] .fee-this-dues    { color: #FCA5A5; }
[data-theme="dark"] .fee-sub-eq       { color: var(--text-muted); }
[data-theme="dark"] .fee-disc-amt     { color: #FCD34D; }
[data-theme="dark"] .fee-paid-amt     { color: #86EFAC; }
[data-theme="dark"] .fee-rem-target {
  background: rgba(59,130,246,.10);
  border-color: rgba(59,130,246,.25);
  color: var(--text-primary);
}
[data-theme="dark"] .fee-rem-target i { color: #93C5FD; }
[data-theme="dark"] .fee-rem-counter { color: var(--text-muted); }

/* Confirm dialog — dark */
[data-theme="dark"] .fee-confirm-overlay { background: rgba(0,0,0,.65); }
[data-theme="dark"] .fee-confirm-dialog {
  background: var(--bg-card);
  border-color: var(--border-light);
  box-shadow: 0 30px 80px rgba(0,0,0,.55), 0 8px 24px rgba(0,0,0,.4);
}
[data-theme="dark"] .fee-confirm-hero--danger  { background: linear-gradient(180deg, rgba(239,68,68,.10), transparent); }
[data-theme="dark"] .fee-confirm-hero--primary { background: linear-gradient(180deg, rgba(59,130,246,.10), transparent); }
[data-theme="dark"] .fee-confirm-title { color: var(--text-primary); }
[data-theme="dark"] .fee-confirm-msg   { color: var(--text-secondary); }
[data-theme="dark"] .fee-confirm-msg strong { color: var(--text-primary); }
[data-theme="dark"] .fee-confirm-hint--danger {
  background: rgba(239,68,68,.10);
  border-color: rgba(239,68,68,.3);
  color: #FCA5A5;
}
[data-theme="dark"] .fee-confirm-hint--danger i { color: #FCA5A5; }
[data-theme="dark"] .fee-confirm-hint--primary {
  background: rgba(59,130,246,.10);
  border-color: rgba(59,130,246,.3);
  color: #BFD2F8;
}
[data-theme="dark"] .fee-confirm-hint--primary i { color: #93C5FD; }
[data-theme="dark"] .fee-confirm-btn--cancel {
  background: var(--bg-muted);
  border-color: var(--border-light);
  color: var(--text-secondary);
}
[data-theme="dark"] .fee-confirm-btn--cancel:hover {
  background: var(--bg-card);
  color: var(--text-primary);
  border-color: var(--border-med);
}

/* ═══════════════════════════════════════════════════════════════════
   MOBILE RESPONSIVE — internal screen layouts (≤ 600px)
   Stacks page header, scrolls sub-tabs/tables horizontally, wraps
   filter rows, collapses multi-col grids and reduces page/card pad.
   ═══════════════════════════════════════════════════════════════════ */
@media (max-width: 600px) {
  /* Page header (icon + title + tutorial CTA) — stack vertically */
  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 12px 14px;
  }
  .page-header .page-title { font-size: 17px; line-height: 1.2; }
  .page-header .page-sub   { font-size: 11.5px; line-height: 1.35; }
  .page-tutorial-btn { align-self: flex-start; }

  /* Fee top-level tabs — horizontal scroll strip */
  .fee-subtabs {
    overflow-x: auto;
    flex-wrap: nowrap;
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding: 4px;
    gap: 4px;
    border-radius: 12px;
  }
  .fee-subtabs::-webkit-scrollbar { display: none; }
  .fee-subtab {
    flex: 0 0 auto;
    white-space: nowrap;
    padding: 10px 14px;
    font-size: 12.5px;
    border-radius: 10px;
  }

  /* 3-segment pill bar — keep flex but tight */
  .fee-seg { padding: 4px; gap: 4px; border-radius: 12px; }
  .fee-seg-btn { padding: 9px 8px; font-size: 11.5px; }

  /* Fee Setup & Settings sub-tabs (Student / Transport / Challan) — match
     the top-tabs pattern: single row, horizontal scroll, no wrap. Overrides
     the inherited 768px rule that gave .fee-seg-btn flex:1 1 calc(50% - 6px)
     and pushed the 3rd sub-tab to a second line. */
  .fee-seg.fee-seg-3 {
    flex-wrap: nowrap !important;
    overflow-x: auto !important;
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding: 4px !important;
    gap: 4px !important;
    border-radius: 12px;
  }
  .fee-seg.fee-seg-3::-webkit-scrollbar { display: none; }
  .fee-seg.fee-seg-3 > .fee-seg-btn {
    flex: 0 0 auto !important;
    white-space: nowrap !important;
    padding: 9px 14px !important;
    font-size: 11.5px !important;
    border-radius: 10px !important;
    line-height: 1.2;
  }

  /* ── Student Fee Setup class rows (.fee-struct-row) — compact 2-line card.
       Row 1: [#]  Class  [Section]  Heads count  [⌄]
       Row 2: [─── Update ───]   [─── Copy to All ───]
       Overrides the older 768px rule that used grid-template-columns:1fr
       + data-label pseudo-labels (which stacked all 7 cells vertically). */
  .fee-row.fee-struct-row {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    column-gap: 8px !important;
    row-gap: 8px !important;
    padding: 10px 12px !important;
    grid-template-columns: none !important;
    min-height: 0 !important;
  }
  /* Hide table head on mobile — card layout doesn't need it */
  .fee-table-head.fee-struct-row { display: none !important; }

  /* Strip the auto-prepended data-label pseudo on this row only — we're
     showing the values inline in a compact card now. */
  .fee-row.fee-struct-row > .fee-td::before { content: none !important; }
  .fee-row.fee-struct-row > .fee-td { padding: 0 !important; min-width: 0; }

  /* Row 1 placement */
  .fee-row.fee-struct-row > .fee-td:nth-of-type(1) { order: 1; flex: 0 0 auto; }
  .fee-row.fee-struct-row > .fee-td:nth-of-type(2) { order: 2; flex: 1 1 auto; font-weight: 700; font-size: 13px; }
  .fee-row.fee-struct-row > .fee-td:nth-of-type(3) { order: 3; flex: 0 0 auto; }
  .fee-row.fee-struct-row > .fee-td:nth-of-type(4) {
    order: 4; flex: 0 0 auto;
    font-size: 11px; color: var(--text-muted);
    white-space: nowrap;
  }
  .fee-row.fee-struct-row > .fee-td:nth-of-type(7) {
    order: 5; flex: 0 0 auto;
    margin-left: auto !important;
    justify-content: flex-end !important;
  }

  /* Wrap break between Row 1 (orders 1–5) and Row 2 (orders 6+) */
  .fee-row.fee-struct-row::after {
    content: "";
    flex: 1 1 100%;
    height: 0;
    order: 5.5;
  }

  /* Row 2 — Update + Copy to All share full width as touch-friendly CTAs */
  .fee-row.fee-struct-row > .fee-td:nth-of-type(5),
  .fee-row.fee-struct-row > .fee-td:nth-of-type(6) {
    flex: 1 1 calc(50% - 4px) !important;
    min-width: 0 !important;
    justify-content: stretch !important;
  }
  .fee-row.fee-struct-row > .fee-td:nth-of-type(5) { order: 6; }
  .fee-row.fee-struct-row > .fee-td:nth-of-type(6) { order: 7; }
  .fee-row.fee-struct-row > .fee-td:nth-of-type(5) .fee-btn,
  .fee-row.fee-struct-row > .fee-td:nth-of-type(6) .fee-btn {
    width: 100% !important;
    justify-content: center !important;
    padding: 8px 10px !important;
    font-size: 11.5px !important;
  }

  /* ── Fee Challans class rows (.fee-challan-row) — compact 2-line card.
       Row 1: [#]  Class  [Section]   Generated 5/30 ▓▓░    [⌄]
       Row 2: [📥 DL] [──── Bulk Challans ────] [🗑 Delete]
       Overrides the 768px rule that set grid-template-columns:1fr (which
       stacked all 8 cells with data-label pseudo-labels — very tall). */
  .fee-row.fee-challan-row {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    column-gap: 8px !important;
    row-gap: 8px !important;
    padding: 10px 12px !important;
    grid-template-columns: none !important;
    min-height: 0 !important;
  }
  .fee-table-head.fee-challan-row { display: none !important; }
  .fee-row.fee-challan-row > .fee-td::before { content: none !important; }
  .fee-row.fee-challan-row > .fee-td { padding: 0 !important; min-width: 0; }

  /* Row 1: # · Class · [Section] · Generated · chev */
  .fee-row.fee-challan-row > .fee-td:nth-of-type(1) { order: 1; flex: 0 0 auto; }
  .fee-row.fee-challan-row > .fee-td:nth-of-type(2) { order: 2; flex: 1 1 auto; font-weight: 700; font-size: 13px; }
  .fee-row.fee-challan-row > .fee-td:nth-of-type(3) { order: 3; flex: 0 0 auto; }
  .fee-row.fee-challan-row > .fee-td:nth-of-type(5) {
    order: 4; flex: 0 0 auto;
    justify-content: flex-end !important;
  }
  .fee-row.fee-challan-row > .fee-td:nth-of-type(5) .fee-gen-block {
    flex-direction: row !important;
    align-items: center !important;
    gap: 6px !important;
  }
  .fee-row.fee-challan-row > .fee-td:nth-of-type(5) .fee-gen-bar {
    width: 48px !important;
    flex: 0 0 48px !important;
  }
  .fee-row.fee-challan-row > .fee-td:nth-of-type(8) {
    order: 5; flex: 0 0 auto;
    margin-left: auto !important;
    justify-content: flex-end !important;
  }

  /* Wrap break between Row 1 (orders 1–5) and Row 2 (orders 6+) */
  .fee-row.fee-challan-row::after {
    content: "";
    flex: 1 1 100%;
    height: 0;
    order: 5.5;
  }

  /* Row 2: Download · Bulk Challans · Delete */
  .fee-row.fee-challan-row > .fee-td:nth-of-type(4) {
    order: 6; flex: 0 0 auto;
    justify-content: flex-start !important;
  }
  .fee-row.fee-challan-row > .fee-td:nth-of-type(6) {
    order: 7; flex: 1 1 auto !important;
    justify-content: stretch !important;
    min-width: 0 !important;
  }
  .fee-row.fee-challan-row > .fee-td:nth-of-type(6) .fee-btn {
    width: 100% !important;
    justify-content: center !important;
    padding: 8px 10px !important;
    font-size: 11.5px !important;
  }
  .fee-row.fee-challan-row > .fee-td:nth-of-type(7) {
    order: 8; flex: 0 0 auto;
    justify-content: flex-end !important;
  }

  /* ── Family Tree Challans rows (.fee-family-row) — compact 2-line card.
       Removes horizontal overflow from the desktop 6-col grid.
       Row 1: [#]  Family — Guardian  Children 2/3   [⌄]
       Row 2: [📥 Download]   [──── Bulk Challans ────] */
  .fee-row.fee-family-row {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    column-gap: 8px !important;
    row-gap: 8px !important;
    padding: 10px 12px !important;
    grid-template-columns: none !important;
    min-height: 0 !important;
  }
  .fee-table-head.fee-family-row { display: none !important; }
  .fee-row.fee-family-row > .fee-td::before { content: none !important; }
  .fee-row.fee-family-row > .fee-td { padding: 0 !important; min-width: 0; }

  /* Row 1: # · Family · Children · chev */
  .fee-row.fee-family-row > .fee-td:nth-of-type(1) { order: 1; flex: 0 0 auto; }
  .fee-row.fee-family-row > .fee-td:nth-of-type(2) {
    order: 2;
    flex: 1 1 100% !important;       /* family name wraps onto own visual line if long */
    font-weight: 700; font-size: 13px;
    line-height: 1.35 !important;
    word-break: break-word !important;
  }
  .fee-row.fee-family-row > .fee-td:nth-of-type(3) {
    order: 3; flex: 0 0 auto;
    font-size: 11.5px;
    color: var(--text-muted);
  }
  .fee-row.fee-family-row > .fee-td:nth-of-type(6) {
    order: 4; flex: 0 0 auto;
    margin-left: auto !important;
    justify-content: flex-end !important;
  }

  /* Wrap break between Row 1 (orders 1–4) and Row 2 (orders 5+) */
  .fee-row.fee-family-row::after {
    content: "";
    flex: 1 1 100%;
    height: 0;
    order: 4.5;
  }

  /* Row 2: Download · Bulk Challans */
  .fee-row.fee-family-row > .fee-td:nth-of-type(4) {
    order: 5; flex: 0 0 auto;
    justify-content: flex-start !important;
  }
  .fee-row.fee-family-row > .fee-td:nth-of-type(5) {
    order: 6; flex: 1 1 auto !important;
    min-width: 0 !important;
    justify-content: stretch !important;
  }
  .fee-row.fee-family-row > .fee-td:nth-of-type(5) .fee-btn {
    width: 100% !important;
    justify-content: center !important;
    padding: 8px 10px !important;
    font-size: 11.5px !important;
  }

  /* ── Individual Fee Receiving rows (.fee-recind-row) — compact 2-line card.
       Row 1: [#]  Class / Section   [chips: Total Paid Unpaid]   [⌄]
       Row 2: [───── Fee Reminder ─────] */
  .fee-row.fee-recind-row {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    column-gap: 8px !important;
    row-gap: 8px !important;
    padding: 10px 12px !important;
    grid-template-columns: none !important;
    min-height: 0 !important;
  }
  .fee-table-head.fee-recind-row { display: none !important; }
  .fee-row.fee-recind-row > .fee-td::before { content: none !important; }
  .fee-row.fee-recind-row > .fee-td { padding: 0 !important; min-width: 0; }

  .fee-row.fee-recind-row > .fee-td:nth-of-type(1) { order: 1; flex: 0 0 auto; }
  .fee-row.fee-recind-row > .fee-td:nth-of-type(2) {
    order: 2; flex: 1 1 auto;
    font-weight: 700; font-size: 13px;
    justify-content: flex-start !important;
  }
  .fee-row.fee-recind-row > .fee-td:nth-of-type(2) .fee-recv-clssec b { font-size: 13px; }
  .fee-row.fee-recind-row > .fee-td:nth-of-type(2) .fee-recv-clssec span { font-size: 11px; }
  .fee-row.fee-recind-row > .fee-td:nth-of-type(3) {
    order: 3; flex: 1 1 100% !important;
    justify-content: flex-start !important;
  }
  .fee-row.fee-recind-row > .fee-td:nth-of-type(3) .fee-recv-sumchips {
    justify-content: flex-start !important;
    gap: 5px !important;
  }
  .fee-row.fee-recind-row > .fee-td:nth-of-type(3) .fee-recv-sumchip {
    font-size: 10.5px; padding: 3px 8px;
  }
  .fee-row.fee-recind-row > .fee-td:nth-of-type(5) {
    order: 4; flex: 0 0 auto;
    margin-left: auto !important;
    justify-content: flex-end !important;
  }

  /* Wrap break before Fee Reminder so it goes full width on its own line */
  .fee-row.fee-recind-row::after {
    content: ""; flex: 1 1 100%; height: 0; order: 4.5;
  }
  .fee-row.fee-recind-row > .fee-td:nth-of-type(4) {
    order: 5; flex: 1 1 100% !important;
    justify-content: stretch !important;
  }
  .fee-row.fee-recind-row > .fee-td:nth-of-type(4) .fee-reminder-btn {
    width: 100% !important;
    justify-content: center !important;
    padding: 8px 10px !important;
    font-size: 11.5px !important;
  }

  /* ── Family Tree Fee Receiving rows (.fee-recfam-row) — compact 2-line card.
       Row 1: [#]  Family Name + Guardian   [chips]                       [⌄]
       Row 2: [📥] [🗑]   [─────── Bulk Fee Receiving ───────] */
  .fee-row.fee-recfam-row {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    column-gap: 8px !important;
    row-gap: 8px !important;
    padding: 10px 12px !important;
    grid-template-columns: none !important;
    min-height: 0 !important;
  }
  .fee-table-head.fee-recfam-row { display: none !important; }
  .fee-row.fee-recfam-row > .fee-td::before { content: none !important; }
  .fee-row.fee-recfam-row > .fee-td { padding: 0 !important; min-width: 0; }

  .fee-row.fee-recfam-row > .fee-td:nth-of-type(1) { order: 1; flex: 0 0 auto; }
  .fee-row.fee-recfam-row > .fee-td:nth-of-type(2) {
    order: 2; flex: 1 1 auto;
    font-weight: 700; font-size: 13px;
    word-break: break-word !important;
    justify-content: flex-start !important;
  }
  .fee-row.fee-recfam-row > .fee-td:nth-of-type(2) .fee-sub-eq {
    font-size: 11px; color: var(--text-muted); margin-left: 6px;
  }
  .fee-row.fee-recfam-row > .fee-td:nth-of-type(3) {
    order: 3; flex: 1 1 100% !important;
    justify-content: flex-start !important;
  }
  .fee-row.fee-recfam-row > .fee-td:nth-of-type(3) .fee-recv-sumchips {
    justify-content: flex-start !important;
    gap: 5px !important;
  }
  .fee-row.fee-recfam-row > .fee-td:nth-of-type(3) .fee-recv-sumchip {
    font-size: 10.5px; padding: 3px 8px;
  }
  .fee-row.fee-recfam-row > .fee-td:nth-of-type(6) {
    order: 4; flex: 0 0 auto;
    margin-left: auto !important;
    justify-content: flex-end !important;
  }

  /* Wrap before action row */
  .fee-row.fee-recfam-row::after {
    content: ""; flex: 1 1 100%; height: 0; order: 4.5;
  }
  .fee-row.fee-recfam-row > .fee-td:nth-of-type(4) {
    order: 5; flex: 0 0 auto;
    justify-content: flex-start !important;
  }
  .fee-row.fee-recfam-row > .fee-td:nth-of-type(5) {
    order: 6; flex: 1 1 auto !important;
    min-width: 0 !important;
    justify-content: stretch !important;
  }
  .fee-row.fee-recfam-row > .fee-td:nth-of-type(5) .fee-reminder-btn {
    width: 100% !important;
    justify-content: center !important;
    padding: 8px 10px !important;
    font-size: 11.5px !important;
  }

  /* ── Fee History rows (.fee-hist-row) — compact single-line card.
       Used by both Ledger Summary and Detailed History sub-tabs.
       Row: [#]  Class / Section   N students   [📥]   [⌄] */
  .fee-row.fee-hist-row {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    column-gap: 8px !important;
    row-gap: 6px !important;
    padding: 10px 12px !important;
    grid-template-columns: none !important;
    min-height: 0 !important;
  }
  .fee-table-head.fee-hist-row { display: none !important; }
  .fee-row.fee-hist-row > .fee-td::before { content: none !important; }
  .fee-row.fee-hist-row > .fee-td { padding: 0 !important; min-width: 0; }

  .fee-row.fee-hist-row > .fee-td:nth-of-type(1) { flex: 0 0 auto; }
  .fee-row.fee-hist-row > .fee-td:nth-of-type(2) {
    flex: 1 1 auto; min-width: 0;
    font-weight: 700; font-size: 13px;
    justify-content: flex-start !important;
  }
  .fee-row.fee-hist-row > .fee-td:nth-of-type(2) .fee-recv-clssec b { font-size: 13px; }
  .fee-row.fee-hist-row > .fee-td:nth-of-type(2) .fee-recv-clssec span { font-size: 11px; }
  .fee-row.fee-hist-row > .fee-td:nth-of-type(3) {
    flex: 0 0 auto;
    font-size: 11.5px; color: var(--text-muted);
    white-space: nowrap;
  }
  .fee-row.fee-hist-row > .fee-td:nth-of-type(4) { flex: 0 0 auto; }
  .fee-row.fee-hist-row > .fee-td:nth-of-type(5) {
    flex: 0 0 auto;
    margin-left: auto !important;
    justify-content: flex-end !important;
  }

  /* ── Reports → Fee Defaulter List / Monthly Fee Defaulters
       (.fee-rep-clsrow-grid) — compact single-line card.
       Row: [#]  Class  [Section]   Pending Rs. xxx   [⌄] */
  .fee-row.fee-rep-clsrow-grid {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    column-gap: 8px !important;
    row-gap: 6px !important;
    padding: 10px 12px !important;
    grid-template-columns: none !important;
    min-height: 0 !important;
  }
  .fee-table-head.fee-rep-clsrow-grid { display: none !important; }
  .fee-row.fee-rep-clsrow-grid > .fee-td::before { content: none !important; }
  .fee-row.fee-rep-clsrow-grid > .fee-td { padding: 0 !important; min-width: 0; }

  .fee-row.fee-rep-clsrow-grid > .fee-td:nth-of-type(1) { flex: 0 0 auto; }
  .fee-row.fee-rep-clsrow-grid > .fee-td:nth-of-type(2) {
    flex: 1 1 auto; min-width: 0;
    font-weight: 700; font-size: 13px;
    justify-content: flex-start !important;
  }
  .fee-row.fee-rep-clsrow-grid > .fee-td:nth-of-type(3) {
    flex: 0 0 auto;
    justify-content: center !important;
  }
  .fee-row.fee-rep-clsrow-grid > .fee-td:nth-of-type(4) {
    flex: 0 0 auto;
    font-size: 12px; font-weight: 700;
    white-space: nowrap;
    justify-content: flex-end !important;
  }
  .fee-row.fee-rep-clsrow-grid > .fee-td:nth-of-type(5) {
    flex: 0 0 auto;
    margin-left: auto !important;
    justify-content: flex-end !important;
  }

  /* ── Reports → General Fee Collections (Daily / Monthly / Paid Students)
       The row uses an inline style for grid-template-columns instead of a
       dedicated class — target it via attribute selector. 4 cells:
       Row: [#]  Class · "5 records · Rs. xxx"   [Section]   [⌄] */
  .fee-row[style*="60px 1fr 1fr 80px"] {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    column-gap: 8px !important;
    row-gap: 6px !important;
    padding: 10px 12px !important;
    grid-template-columns: none !important;
    min-height: 0 !important;
  }
  .fee-table-head[style*="60px 1fr 1fr 80px"] { display: none !important; }
  .fee-row[style*="60px 1fr 1fr 80px"] > .fee-td::before { content: none !important; }
  .fee-row[style*="60px 1fr 1fr 80px"] > .fee-td { padding: 0 !important; min-width: 0; }

  .fee-row[style*="60px 1fr 1fr 80px"] > .fee-td:nth-of-type(1) { flex: 0 0 auto; }
  .fee-row[style*="60px 1fr 1fr 80px"] > .fee-td:nth-of-type(2) {
    flex: 1 1 auto; min-width: 0;
    font-weight: 700; font-size: 13px;
    justify-content: flex-start !important;
  }
  .fee-row[style*="60px 1fr 1fr 80px"] > .fee-td:nth-of-type(2) .fee-sub-eq {
    font-size: 11px;
    color: var(--text-muted);
    display: block;
    margin-top: 2px;
  }
  .fee-row[style*="60px 1fr 1fr 80px"] > .fee-td:nth-of-type(3) {
    flex: 0 0 auto;
    justify-content: center !important;
  }
  .fee-row[style*="60px 1fr 1fr 80px"] > .fee-td:nth-of-type(4) {
    flex: 0 0 auto;
    margin-left: auto !important;
    justify-content: flex-end !important;
  }

  /* ── Transport Fee Setup class rows (.fee-trans-row) — compact single-
       line card. Removes horizontal overflow from the desktop 5-col grid.
       Row 1: [#]  Class  [Section]  N students  [⌄] */
  .fee-row.fee-trans-row {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    column-gap: 8px !important;
    row-gap: 6px !important;
    padding: 10px 12px !important;
    grid-template-columns: none !important;
    min-height: 0 !important;
  }
  .fee-table-head.fee-trans-row { display: none !important; }

  .fee-row.fee-trans-row > .fee-td::before { content: none !important; }
  .fee-row.fee-trans-row > .fee-td { padding: 0 !important; min-width: 0; }

  .fee-row.fee-trans-row > .fee-td:nth-of-type(1) { flex: 0 0 auto; }
  .fee-row.fee-trans-row > .fee-td:nth-of-type(2) { flex: 1 1 auto; font-weight: 700; font-size: 13px; min-width: 0; }
  .fee-row.fee-trans-row > .fee-td:nth-of-type(3) { flex: 0 0 auto; }
  .fee-row.fee-trans-row > .fee-td:nth-of-type(4) {
    flex: 0 0 auto;
    font-size: 11px; color: var(--text-muted);
    white-space: nowrap;
  }
  .fee-row.fee-trans-row > .fee-td:nth-of-type(5) {
    flex: 0 0 auto;
    margin-left: auto !important;
    justify-content: flex-end !important;
  }

  /* Section cards — reduce padding */
  .fee-section { border-radius: 12px; margin-bottom: 12px; }
  .fee-section-body { padding: 14px; }
  .fee-section-header { padding: 12px 14px; }

  /* Info banners */
  .fee-info { padding: 9px 12px; font-size: 11.5px; gap: 8px; }

  /* Filter rows (class + section + status, etc.) — wrap and full-width children */
  .fee-filters {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .fee-filters .fee-field,
  .fee-filters > * { width: 100%; min-width: 0; flex: 1 1 auto; }
  .fee-filters .fee-btn { width: 100%; justify-content: center; }

  /* Search row */
  .fee-searchrow { margin-top: 10px; }
  .fee-search-anchor, .fee-search-box { width: 100%; }

  /* Wrap tables in horizontal scroll, keep min-width so columns don't squash */
  .fee-section--scroll,
  .fee-section:has(.fee-struct-row),
  .fee-section:has(.fee-trans-row),
  .fee-section:has(.fee-family-row),
  .fee-section:has(.fee-challan-row) {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  /* Detail panels (.fee-detail-inner) — reduce padding */
  .fee-detail-inner { padding: 12px; }
  .fee-detail-titlebar { flex-wrap: wrap; gap: 8px; }

  /* History — ledger meta and overall info — collapse multi-col */
  .fee-hist-ledger-meta {
    grid-template-columns: 1fr 1fr !important;
    gap: 8px;
  }
  .fee-hist-overall { flex-direction: column; align-items: stretch; gap: 12px; padding: 12px 14px; }
  .fee-hist-overall-btns { width: 100%; flex-wrap: wrap; }
  .fee-hist-overall-btns .fee-btn { flex: 1 1 auto; justify-content: center; }
  .fee-hist-vbtn { width: 100%; justify-content: center; }

  /* Reports — chip grid collapses */
  .fee-rep-chips { grid-template-columns: 1fr !important; gap: 8px; }
  .fee-rep-style-row { flex-direction: column; align-items: stretch; gap: 8px; padding: 10px 12px; }
  .fee-rep-style-seg { width: 100%; }
  .fee-rep-style-btn { flex: 1; justify-content: center; }

  /* Modal foot action rows — wrap and full-width */
  .fee-modal-foot { flex-wrap: wrap; gap: 8px; padding: 12px 14px; }
  .fee-modal-foot .fee-btn { flex: 1 1 auto; justify-content: center; }
  .fee-modal-head { padding: 12px 14px; }
  .fee-modal-body { padding: 14px; }

  /* Stat / KPI cards */
  .fee-kpi { padding: 12px; }

  /* Generic action row buttons — wrap */
  .fee-st-actions { gap: 6px; }
  .fee-st-actions .fee-btn,
  .fee-actions .fee-btn { flex: 1 1 auto; }

  /* Head editor grid inside modals */
  .fee-head-grid {
    grid-template-columns: 1fr 100px 36px;
    gap: 6px;
  }

  /* Settings grid */
  .fee-set-grid { grid-template-columns: 1fr !important; gap: 10px; }

  /* Receiving — collapse two-col into one where present */
  .fee-recv-grid { grid-template-columns: 1fr !important; }
}

@media (max-width: 480px) {
  .fee-section-body { padding: 12px; }
  .fee-section-header { padding: 10px 12px; }
  .fee-modal-head-icon { width: 34px; height: 34px; font-size: 13px; }
  .fee-modal-title { font-size: 14px; }
  .fee-subtab { padding: 9px 12px; font-size: 12px; }
  .fee-seg-btn { padding: 8px 6px; font-size: 11px; }
  .fee-hist-ledger-meta { grid-template-columns: 1fr !important; }
}
`;
