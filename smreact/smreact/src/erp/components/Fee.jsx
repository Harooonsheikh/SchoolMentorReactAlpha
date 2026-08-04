import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from './Tooltip';
import TutorialModal from './TutorialModal';
import * as feeService from '../services/feeService';
import { validateSessionDateFromStorage } from '../pages/Settings/settingsStore';
import useAsync from '../hooks/useAsync';
import { downloadDocxFromHtml } from '../../utils/docx';
import { qrSvg } from '../../utils/qr';
import { code128BSvg } from '../../utils/barcode';
import { usePermissions } from '../context/PermissionsContext';

const money = (n) => `Rs. ${(Number(n) || 0).toLocaleString('en-PK')}`;
const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, m =>
  ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));

/* Aaj ki LOCAL date (YYYY-MM-DD). toISOString() jaan-boojh kar nahi — wo UTC me
   badal kar Pakistan (UTC+5) me shaam ko agli/pichhli date de deta hai. */
/* Date → 'YYYY-MM-DD' LOCAL calendar par. toISOString() (UTC) Pakistan me subah
   5 baje se pehle date ek din PEECHHE kar deta hai — challan ki Issue/Due date
   aur late-fine ka hisaab isi par chalta hai, is liye hamesha ye use karo. */
const localDateISO = (d) => {
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const localTodayISO = () => localDateISO(new Date());

/* Is challan par is waqt banti LATE FINE.
   - Agar backend ne "Late Fine" row persist kar di hai to wahi authority.
   - Warna: paise aa chuke hain to ASLI receiving date tak ki fine (jo li gayi),
     aur abhi tak unpaid hai to AAJ tak ki accrued fine (jo abhi banti hai).
   Isi ek helper se receiving tables, challan list aur modal — sab ek hi
   raqam dikhate hain. */
/* Is challan par jo late fine LEDGER me bill ho chuki hai (wasool hui ya nahi).
   > 0 ho to fine ab recStudentModel ke payable/paid dono me shamil hai — us par
   bahar se dobara fine jodna dohri gin'ti banata hai. */
function billedFineOf(rec) {
  return ((rec && rec.detailRows) || [])
    .filter(feeService.isLateFineRow)
    .reduce((a, r) => a + (+r.challanAmount || 0), 0);
}

function challanAccruedFine(rec, settings, asOf) {
  if (!rec || !settings?.fineEnabled) return 0;
  const fineRows = (rec.detailRows || []).filter(feeService.isLateFineRow);
  const billed = billedFineOf(rec);
  if (billed > 0) {
    /* Fine ki row maujood hai → wahi authority. Magar sirf BAQAYA lautao, poora
       billed nahi: callers ise challanFigures() ke payable me jorte hain, aur wo
       is row ka wasool shuda hissa pehle hi kaat chuka hota hai. Poora billed
       lautane se poori wasool shuda fine dobara payable ban kar dikhti thi
       ("Fully Received" ke bawajood Total Payable = fine). */
    const recvd = fineRows.reduce((a, r) => a + (+r.receivedAmount || 0), 0);
    return Math.max(0, billed - recvd);
  }
  const received = (rec.detailRows || []).reduce((a, r) => a + (+r.receivedAmount || 0), 0);
  const base = asOf
    || (received > 0 ? String(rec.modifiedAt || '').slice(0, 10) : '')
    || localTodayISO();
  return feeService.computeFine({ dueDate: rec.dueDate, receivingDate: base, settings });
}

/* Receiving tables ke "Fine" column ke liye — sirf WASOOL SHUDA late fine.
   Jab tak fee (aur us ke saath fine) receive nahi hoti, column 0 rehta hai:
   accrued fine mahaz ek andaza hai, abhi li nahi gayi. Receive hote hi ledger
   ki "Late Fine" row ka receivedAmount hi asal wasool shuda raqam hai — wahi
   dikhai jaati hai. Payable/Remaining ka hisaab is se alag hai — wahan abhi bhi
   challanAccruedFine() (baqaya) chalta hai. */
/* Fee head ka UI naam. Ledger/backend me late fine ki row ka naam "Late Fine"
   hai (feeService.LATE_FINE_HEAD) aur isLateFineRow() usi par match karta hai —
   is liye DATA me wo naam waisa hi rehta hai. Screen aur print par user ko sirf
   "Fine" dikhana hai, so render karte waqt ye helper lagao. */
function headLabel(name) {
  return feeService.isLateFineRow({ name }) ? 'Fine' : name;
}

function receivedFineOf(rec) {
  return ((rec && rec.detailRows) || [])
    .filter(feeService.isLateFineRow)
    .reduce((a, r) => a + (+r.receivedAmount || 0), 0);
}

/* API date/ISO string → dd/mm/yyyy. Khaali ya invalid par '' (caller '—' dikhata
   hai) — taake kabhi bhi "aaj" ki date ko asli date samajh liya na jaaye. */
const fmtDMY = (value) => {
  const s = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
};

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

  /* Screen (tab/segment) View permission — jis screen ka View nahi wo hide. */
  const { can } = usePermissions();
  const feeView = (sub) => can('Fee', sub, 'View');
  const structViewMap = {
    student:   feeView('Student Fee Setup'),
    transport: feeView('Transport Fee Setup'),
    settings:  feeView('Fee Challan Settings'),
  };
  const tabViewMap = {
    structure: Object.values(structViewMap).some(Boolean),
    challans:  feeView('Fee Challans'),
    receipts:  feeView('Fee Receiving'),
    history:   feeView('Fee History'),
    reports:   feeView('Reports'),
  };
  const visibleTabs = FEE_TABS.filter(t => tabViewMap[t.id]);
  const visibleSegs = STRUCTURE_SEGS.filter(s => structViewMap[s.id]);

  /* Active tab/segment hide ho jaye to pehle visible par snap. */
  useEffect(() => {
    if (!tabViewMap[tab] && visibleTabs[0]) setTab(visibleTabs[0].id);
  }, [tabViewMap, tab, visibleTabs]);
  useEffect(() => {
    if (tab === 'structure' && !structViewMap[structSeg] && visibleSegs[0]) setStructSeg(visibleSegs[0].id);
  }, [tab, structViewMap, structSeg, visibleSegs]);

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
        {visibleTabs.map(t => (
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
          {/* 3-segment pill bar (View permission ke hisaab se) */}
          <div className="fee-seg fee-seg-3">
            {visibleSegs.map(s => (
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
   STUDENT FEE SETUP — class+section table, per-row Update / expandable
   details. Update opens a modal to add, edit, rename or remove fee
   heads. Details panel includes a PDF download button.
   ═══════════════════════════════════════════════════════════════════ */
function StudentFeeSetup({ toast }) {
  const { can } = usePermissions();
  const canSfEdit     = can('Fee', 'Student Fee Setup', 'Edit');
  const canSfDownload = can('Fee', 'Student Fee Setup', 'Download');
  const { data: grades = [], refetch: reloadGrades } = useAsync(feeService.getFeeGrades, []);
  const { data: branchHeader = null } = useAsync(feeService.getReportHeader, [], null);

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

  const openClassReport = useCallback((c) => {
    const heads = headsMap[c.key] || [];
    const html = buildStudentFeeReportHTML({ cls: c.cls, sec: c.sec, heads, school: branchHeader });
    setReportHtml({ title: `Fee Heads — ${c.cls} (${c.sec})`, html });
  }, [headsMap, branchHeader]);

  return (
    <>
      <div className="fee-info">
        <i className="fa-solid fa-circle-info"></i>
        <span>
          Fee heads defined here are loaded automatically into challan generation for each class &amp; section.
          Use <strong>Update</strong> to add, rename, edit amounts or remove heads.
        </span>
      </div>
      <div className="fee-section">
        <div className="fee-table-head fee-struct-row">
          <div className="fee-th">#</div>
          <div className="fee-th">Class</div>
          <div className="fee-th">Section</div>
          <div className="fee-th fee-center">Total Heads</div>
          <div className="fee-th fee-center">Update</div>
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
                  <Tooltip text={!canSfEdit ? 'You do not have permission to edit fee setup' : `Edit fee heads for ${c.cls} (${c.sec})`}>
                    <button className="fee-btn fee-btn-primary fee-btn-xs" onClick={() => openEdit(c.key)}
                      disabled={!canSfEdit} style={!canSfEdit ? { opacity: .45, cursor: 'not-allowed' } : undefined}>
                      <i className="fa-solid fa-pen"></i> Update
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
                    {heads.length > 0 && canSfDownload && (
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
  const { can } = usePermissions();
  const canTfEdit     = can('Fee', 'Transport Fee Setup', 'Edit');
  const canTfDownload = can('Fee', 'Transport Fee Setup', 'Download');
  const { data: classes = [] } = useAsync(feeService.getFeeClasses, []);
  const { data: transportMap = {}, setData: setTransportMap } = useAsync(feeService.getTransportFee, []);
  const { data: branchHeader = null } = useAsync(feeService.getReportHeader, [], null);

  const [openKey, setOpenKey]       = useState(null);
  const [editing, setEditing]       = useState(null); // { classKey, student }
  const [reportHtml, setReportHtml] = useState(null);

  const openEdit  = useCallback((classKey, student) => setEditing({ classKey, student }), []);
  const closeEdit = useCallback(() => setEditing(null), []);

  const saveStudent = useCallback(async ({ amount }) => {
    if (!editing) return;
    const { classKey, student } = editing;
    const classMeta = classes.find(c => c.key === classKey) || {};
    try {
      const saved = await feeService.saveStudentTransport(classKey, student.reg, {
        id: student.transportSetupId || student.transportSetup?.id || 0,
        applicantsID: student.applicantsID || student.studentID,
        gradeID: student.gradeID || classMeta._gradeId,
        sectionID: student.sectionID || classMeta._sectionId,
        amount,
        createdDate: student.transportSetup?.createdDate,
        createdBy: student.transportSetup?.createdBy,
        isActive: true,
      });
      const next = (transportMap[classKey] || []).map(s =>
        s.reg === student.reg
          ? {
              ...s,
              transportSetupId: saved.id || s.transportSetupId,
              transport: Math.max(0, Number(saved.amount ?? amount) || 0),
              transportSetup: saved,
            }
          : s
      );
      setTransportMap(prev => ({ ...prev, [classKey]: next }));
      closeEdit();
      toast(`Transport fee updated for ${student.name}`, 'success');
    } catch (err) {
      toast(err.message || 'Could not save transport fee', 'error');
    }
  }, [editing, classes, transportMap, setTransportMap, closeEdit, toast]);

  const openClassReport = useCallback((c) => {
    const rows = transportMap[c.key] || [];
    const html = buildTransportReportHTML({ cls: c.cls, sec: c.sec, rows, school: branchHeader });
    setReportHtml({ title: `Transport Fee — ${c.cls} (${c.sec})`, html });
  }, [transportMap, branchHeader]);

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
                    {students.length > 0 && canTfDownload && (
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
                              <Tooltip text={!canTfEdit ? 'You do not have permission to edit transport fee' : `Edit transport fee for ${s.name}`}>
                                <button className="fee-iconbtn" onClick={() => openEdit(c.key, s)}
                                  disabled={!canTfEdit} style={!canTfEdit ? { opacity: .45, cursor: 'not-allowed' } : undefined}>
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

/* Fee Challan Settings gate the month either side of the current one.
   The API's previousMonthFeeChallan / nextMonthFeeChallan are ON = allowed:
   turning "Previous Month Challan Receiving" on lets last month's challans be
   generated and received, and likewise for next month. When a toggle is off,
   that adjacent month is barred.

   "Previous"/"next" are measured against today's real month, not the month
   picker, so changing the filter can't shift what the gate means. Returns the
   reason a month is barred, or null when it's fine. */
function challanMonthLock(monthIdx, year, settings) {
  if (!settings || monthIdx < 0) return null;
  const now  = new Date();
  const diff = (Number(year) * 12 + monthIdx) - (now.getFullYear() * 12 + now.getMonth());
  if (diff === -1 && !settings.prevMonthChallan) {
    return 'Previous month is locked — turn on "Previous Month Challan Receiving" in Fee Challan Settings to allow it.';
  }
  if (diff === 1 && !settings.nextMonthChallan) {
    return 'Next month is locked — turn on "Next Month Challan Receiving" in Fee Challan Settings to allow it.';
  }
  return null;
}

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

/* Split a BranchLedger challan record into the family-table figures:
   transport heads → Transport, previous/pending heads → dues/advance,
   everything else → Fee; discounts sum across heads. `payable` mirrors the
   family table's fee + transport − discount (dues/advance are surfaced
   separately and not rolled into the displayed payable, matching the class
   challan list's behaviour). */
function familyChildFigures(rec) {
  const rows = (rec && rec.detailRows) || [];
  let fee = 0, transport = 0, discount = 0, dues = 0, advance = 0;
  let totalNet = 0, totalRecv = 0;
  rows.forEach(r => {
    const amt   = Number(r.challanAmount) || 0;
    const disc  = Number(r.discount) || 0;
    const recv  = Number(r.receivedAmount) || 0;
    const net   = amt - disc;
    const out   = Math.max(0, net - recv);   // wasooli ke baad bacha hua
    totalNet  += net;
    totalRecv += recv;
    const label = String(r.subHead || r.head || '').toLowerCase().trim();
    /* Fee / Transport / Dues ab BAQAYA dikhate hain — poora receive ho jaye to 0.
       Discount billed hi rehta hai (sirf information ke liye). */
    if (/previous|pending|arrear/.test(label)) {
      if (amt >= 0) dues += out; else advance += Math.abs(amt);
    } else if (label === 'transport') {
      /* SIRF Transport Fee Setup se auto-add hone wali row ka subHead exactly
         "Transport" hota hai. Class ke apne fee heads (jaise "Transport Fee")
         Fee column me hi ginne chahiyein — warna wo galti se Transport dikhte the. */
      transport += out; discount += disc;
    } else {
      fee += out; discount += disc;
    }
  });
  /* Over-receiving (total se zyada wasool) → extra raqam ADVANCE. */
  advance += Math.max(0, totalRecv - totalNet);
  /* fee/transport/dues pehle se discount-ke-baad hain, is liye yahan discount dobara
     minus NAHI hota. Over-payment par ye MINUS me jaata hai = student ka credit. */
  return { fee, transport, discount, dues, advance, payable: fee + transport + dues - advance };
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
  /* Class-wise fee heads (headName) — powers the Generate Family Challans
     "Select Fee Heads" dropdown, keyed by class/grade id. */
  const { data: classFeeHeads = {} }   = useAsync(feeService.getClassFeeHeadsMap, []);
  /* Full fee heads WITH amounts per grade — so a SEPARATE (single) family-child
     challan can be generated per-head exactly like an Individual student. */
  const { data: feeGrades = [] }       = useAsync(feeService.getFeeGrades, []);
  /* Branch header (name / address / logo) for the separate child slip. */
  const { data: branchHeader = null }  = useAsync(feeService.getReportHeader, [], null);
  const headsForChildGrade = useCallback(
    (gradeID) => (feeGrades.find(g => String(g._gradeId) === String(gradeID))?.heads) || [],
    [feeGrades],
  );

  /* Har bachche ke SAVED discounts (Fee Challans wale Discount Manager se) server se
     laao aur family challan ke liye { [famKey]: { [reg]: { [headName]: amt } } } shape
     me do — warna family tree ka challan hamesha 0 discount ke saath banta tha.
     Discount API sirf headID deta hai, is liye bachche ke apne grade heads ke
     feeStructureID se match karke head ka naam nikala jaata hai. Ek head ke ek se
     zyada active record hon to SABSE NAYA (bada id) jeetta hai. */
  const fetchFamilyDiscounts = useCallback(async (classMeta, studs) => {
    const perReg = {};
    await Promise.all((studs || []).map(async (s) => {
      const gHeads = headsForChildGrade(s.gradeID) || [];
      const map = {};
      try {
        const rows = await feeService.getFeeDiscountsByStudent(s.studentID);
        const newestByHead = new Map();
        (rows || []).filter(r => r.isActive !== false).forEach(r => {
          const k    = String(r.headID);
          const rank = Number(r.id) || 0;
          const cur  = newestByHead.get(k);
          if (!cur || rank >= cur.rank) newestByHead.set(k, { rank, row: r });
        });
        newestByHead.forEach(({ row: r }) => {
          const head = gHeads.find(h => Number(h.feeStructureID) === Number(r.headID));
          const amt  = Number(r.discountAmount) || 0;
          if (head && amt > 0) map[head.name] = amt;
        });
      } catch (e) { /* discount na mile to 0 hi rahega */ }
      if (Object.keys(map).length) perReg[s.reg] = map;
    }));
    return { [classMeta.key]: perReg };
  }, [headsForChildGrade]);

  /* Build deduped fee-head options (by name, case-insensitive) across the
     given class/grade ids. Family challans carry no per-head amount, so we
     surface names only. */
  const feeHeadsFor = (gradeIds) => {
    const seen = new Set();
    const out = [];
    (gradeIds || []).forEach(gid => {
      (classFeeHeads[gid] || []).forEach(name => {
        const k = String(name).trim().toLowerCase();
        if (!k || seen.has(k)) return;
        seen.add(k);
        out.push({ name });
      });
    });
    return out;
  };

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

  /* Generation state — driven live from BranchLedger (loadLedgers below). */
  const [genSet, setGenSet] = useState(null);
  const monthIdx = FEE_MONTHS.indexOf(appliedMonth);
  const keyOf    = (famKey, reg) => `${famKey}|${reg}|${monthIdx}`;

  /* Per-child fee figures from BranchLedger, keyed by keyOf(fam,reg). For
     every student in every family we hit /api/BranchLedger/get-all with the
     student's applicantsID as `studentId` (+ branch + applied month/year).
     Runs on mount (i.e. when the Family Tree Challans tab opens) and whenever
     the family list or the applied month/year changes. A child that has a
     ledger row for the month is marked generated. */
  const [figMap, setFigMap] = useState({});
  /* BranchLedger record id per child challan — used to delete via
     /api/BranchLedger/delete/{id}. Keyed by keyOf(fam, reg). */
  const [idMap, setIdMap] = useState({});
  /* Poora BranchLedger record per child (keyOf(fam, reg)) — is se challan ki ASLI
     Issue/Due date (dateofCreattion / dueDate) print par jaati hai, warna slip par
     hamesha "aaj + 10 din" chhap jaata tha. */
  const [recMap, setRecMap] = useState({});
  /* Pichhle mahino ka baqaya / advance — { [studentID]: { dues, advance } }.
     Isse naya challan banane se PEHLE hi bachche ke dues nazar aa jaate hain. */
  const [prevOutMap, setPrevOutMap] = useState({});
  const loadLedgers = useCallback(async () => {
    const fams = families;
    if (!fams || !fams.length) { setFigMap({}); setIdMap({}); setRecMap({}); setGenSet(new Set()); return; }
    const mIdx  = FEE_MONTHS.indexOf(appliedMonth);
    const pairs = fams
      .flatMap(f => (f.children || []).map(ch => ({ f, ch })))
      .filter(({ ch }) => ch.applicantsID != null);
    try {
      const results = await Promise.all(pairs.map(async ({ f, ch }) => {
        const key = `${f.key}|${ch.reg}|${mIdx}`;
        try {
          const rows = await feeService.getStudentChallans(ch.applicantsID, mIdx + 1, appliedYear);
          const rec  = Array.isArray(rows) && rows.length ? rows[0] : null;
          return { key, fig: rec ? familyChildFigures(rec) : null, id: rec?.id ?? null, rec };
        } catch (e) {
          return { key, fig: null, id: null, rec: null };
        }
      }));
      const fmap = {};
      const imap = {};
      const rmap = {};
      const gset = new Set();
      results.forEach(({ key, fig, id, rec }) => {
        if (fig) { fmap[key] = fig; gset.add(key); if (id != null) imap[key] = id; if (rec) rmap[key] = rec; }
      });
      setFigMap(fmap);
      setIdMap(imap);
      setRecMap(rmap);
      setGenSet(gset);

      /* ── Pichhle mahino ka baqaya, RUN TIME par ──
         Har bachche ka SABSE RECENT purana challan liya jaata hai (usme pehle ka
         carry-forward already shamil hota hai → double-count nahi), phir uska
         unpaid remainder: Σ (challanAmount − discount − receivedAmount).
         > 0 → Total Dues | < 0 → Advance. */
      const prevOut = {};
      try {
        let toM = mIdx, toY = appliedYear;                 // applied month se ek pehle
        if (toM === 0) { toM = 12; toY = appliedYear - 1; }
        let fromM = toM - 11, fromY = toY;                 // 12-month window
        while (fromM <= 0) { fromM += 12; fromY -= 1; }
        const prevRows = await feeService.getLedgerRange(fromM, fromY, toM, toY);
        const latest = new Map();
        (prevRows || []).forEach(r => {
          const id   = String(r.studentID);
          const rank = (Number(r.year) || 0) * 12 + (Number(r.month) || 0);
          const cur  = latest.get(id);
          if (!cur || rank > cur.rank) latest.set(id, { rank, rec: r });
        });
        latest.forEach(({ rec }, id) => {
          const raw = (rec.detailRows || []).reduce(
            (a, r) => a + ((+r.challanAmount || 0) - (+r.discount || 0) - (+r.receivedAmount || 0)), 0);
          if (raw !== 0) prevOut[id] = { dues: raw > 0 ? raw : 0, advance: raw < 0 ? -raw : 0 };
        });
      } catch (e) { /* optional — na mile to 0 hi rahenge */ }
      setPrevOutMap(prevOut);
    } catch (e) {
      toast(e.message || 'Could not load family ledgers', 'error');
      setFigMap({});
      setIdMap({});
      setRecMap({});
      setGenSet(new Set());
      setPrevOutMap({});
    }
  }, [families, appliedMonth, appliedYear, toast]);
  useEffect(() => { loadLedgers(); }, [loadLedgers]);

  /* A child's displayed figures: real ledger data when a challan exists for
     the month, else the family-tree defaults (zeros until one is generated). */
  const childFig = (f, ch) => {
    const real = figMap[keyOf(f.key, ch.reg)];
    if (real) return real;
    /* Challan abhi nahi bana → pichhle mahino ka LIVE baqaya dikhao (0 ki jagah). */
    const prev = prevOutMap[String(ch.applicantsID)] || null;
    const dues = prev ? prev.dues    : (+ch.dues    || 0);
    const adv  = prev ? prev.advance : (+ch.advance || 0);
    return {
      fee: +ch.fee || 0, transport: +ch.transport || 0, discount: +ch.discount || 0,
      dues, advance: adv,
      payable: (+ch.fee || 0) + (+ch.transport || 0) - (+ch.discount || 0),
    };
  };

  /* Challan HTML builders har child ke FLAT fee/transport/discount padhte hain, magar
     asli figures ledger se childFig() me compute hote hain. Preview/download se pehle
     family ko un computed figures ke saath enrich karo — warna challan me sab 0 aata hai. */
  const famWithFigs = (f) => ({
    ...f,
    children: (f.children || []).map(ch => {
      const g = childFig(f, ch);
      /* `_challan` bhi saath bhejo — slip is se challan ki asli Issue/Due date leta hai. */
      return {
        ...ch, fee: g.fee, transport: g.transport, discount: g.discount, dues: g.dues, advance: g.advance,
        _challan: ch._challan || recMap[keyOf(f.key, ch.reg)] || null,
      };
    }),
  });

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
    const lock = challanMonthLock(monthIdx, appliedYear, settings);
    if (lock) { toast(lock, 'warning'); return; }
    if (!f.children.length) { toast('No children in this family', 'warning'); return; }
    /* Only children who don't already have a challan for the applied month.
       A sibling whose challan is already generated/received is dropped here so
       the bulk modal loads heads for — and generates challans for — just the
       remaining children, never re-billing the one that's already done. */
    const remaining = f.children.filter(ch => !isGen(f.key, ch.reg));
    if (!remaining.length) {
      toast(`All children already have ${appliedMonth} ${appliedYear} challans`, 'info');
      return;
    }
    /* Build pseudo-students for BulkGenerateModal — re-use that infra. IDs
       (studentID = applicantsID, gradeID, sectionID) + the child's own
       fee/transport/discount travel through so the create-challan payload is
       correct per child. */
    const pseudoStudents = remaining.map(ch => {
      const fig = childFig(f, ch);
      return {
        reg: ch.reg, name: ch.name, father: ch.father,
        studentID: ch.applicantsID, gradeID: ch.gradeID, sectionID: ch.sectionID,
        fee: fig.fee, transport: fig.transport, discount: fig.discount,
        dues: fig.dues || 0, advance: fig.advance || 0, current: fig.payable,
        /* Each child's OWN grade fee heads (with amounts) so a common head
           selected in bulk sends this student's own amount to the API. */
        heads: headsForChildGrade(ch.gradeID),
      };
    });
    /* Dropdown heads = the union (deduped by name) of each child's OWN grade
       heads — the exact source used for generation (getFeeGrades). This keeps
       the picker in sync with what actually gets billed, and never comes back
       empty due to getClassFeeHeadsMap / employee_ID, which is what made the
       heads disappear once a child already had a challan. */
    const seen = new Set();
    const familyHeads = [];
    pseudoStudents.forEach(s => (s.heads || []).forEach(h => {
      const k = String(h.name || '').trim().toLowerCase();
      if (!k || seen.has(k)) return;
      seen.add(k);
      familyHeads.push({ name: h.name });
    }));
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
    const lock = challanMonthLock(monthIdx, appliedYear, settings);
    if (lock) { toast(lock, 'warning'); return; }
    /* Roll-up child's family-level fee into `current` so the modal's
       student card can display Total Fee + Pending Amount via the same
       (current − dues − advance) calculation used in class single-mode. */
    const fig = childFig(f, ch);
    const totalFee = fig.fee + fig.transport - fig.discount;
    const pseudo = {
      reg: ch.reg, name: ch.name, father: ch.father,
      studentID: ch.applicantsID, gradeID: ch.gradeID, sectionID: ch.sectionID,
      fee: fig.fee, transport: fig.transport, discount: fig.discount,
      dues:    fig.dues    || 0,
      advance: fig.advance || 0,
      current: totalFee,
      /* This child's own grade fee heads (with amounts) → per-head challan. */
      heads: headsForChildGrade(ch.gradeID),
    };
    /* Per-head fee heads (with amounts) for this child's own class, so the
       separate challan is built head-by-head like an Individual student.
       Falls back to name-only heads if the grade has no fee setup. */
    const perHead     = headsForChildGrade(ch.gradeID);
    const familyHeads = perHead.length ? perHead : feeHeadsFor([ch.gradeID]);
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
      innerHtml: buildFamilyChallanInner({ family: famWithFigs(f), settings, bw: false }),
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

  /* SEPARATE (single-child) download — produces an individual challan slip for
     that one child, exactly like the Individual tab (buildChallanHTML with the
     child's real BranchLedger challan), instead of the combined family slip. */
  /* Sirf ISI bachche ka challan preview (family combined nahi) — per-child 👁 button. */
  const openChildPreview = async (f, ch) => {
    if (ch.applicantsID == null) { toast(`Generate ${ch.name}'s challan first`, 'warning'); return; }
    let rec = null;
    try {
      const rows = await feeService.getStudentChallans(ch.applicantsID, monthIdx + 1, appliedYear);
      rec = Array.isArray(rows) && rows.length ? rows[0] : null;
    } catch (e) { /* ignore */ }
    if (!rec) { toast(`No ${appliedMonth} challan for ${ch.name} — generate it first`, 'warning'); return; }
    const student = {
      reg: ch.reg, name: ch.name, father: ch.father,
      studentID: ch.applicantsID, gradeID: ch.gradeID, sectionID: ch.sectionID,
      _challan: rec,
    };
    setChallanPreview({
      title: 'Challan Preview',
      sub:   `${ch.name} — ${ch.cls} (${ch.sec}) · Parent · Bank · School copies`,
      family: f,
      child:  ch,          /* Download button ko child-mode par bhejne ke liye */
      innerHtml: buildChallanInner({
        classMeta: { key: `g${ch.gradeID}-s${ch.sectionID}`, cls: ch.cls, sec: ch.sec },
        students:  [student],
        heads:     headsForChildGrade(ch.gradeID),
        settings, discountMap: {}, bw: false, school: branchHeader,
      }),
    });
  };
  const openChildDownload = async (f, ch) => {
    if (ch.applicantsID == null) { toast(`Generate ${ch.name}'s challan first`, 'warning'); return; }
    let rec = null;
    try {
      const rows = await feeService.getStudentChallans(ch.applicantsID, monthIdx + 1, appliedYear);
      rec = Array.isArray(rows) && rows.length ? rows[0] : null;
    } catch (e) { /* ignore */ }
    if (!rec) { toast(`No ${appliedMonth} challan for ${ch.name} — generate it first`, 'warning'); return; }
    setDownloadCtx({
      kind: 'child',
      classMeta: { key: `g${ch.gradeID}-s${ch.sectionID}`, cls: ch.cls, sec: ch.sec },
      student: {
        reg: ch.reg, name: ch.name, father: ch.father,
        studentID: ch.applicantsID, gradeID: ch.gradeID, sectionID: ch.sectionID,
        _challan: rec,
      },
      heads: headsForChildGrade(ch.gradeID),
      sub: `${ch.name} · child of ${ch.father || '—'}`,
      defaultSize: settings.printSize || 'a4',
    });
  };
  const runChildDownload = (ctx, { theme, fmt, size = 'a4' }) => {
    const bw   = theme === 'bw';
    const html = buildChallanHTML({
      classMeta: ctx.classMeta, students: [ctx.student], heads: ctx.heads,
      settings, discountMap: {}, bw, size, school: branchHeader,
    });
    const sizeT = size === 'thermal' ? 'Thermal 80mm' : 'A4';
    toast(`Generating ${sizeT} · ${bw ? 'B&W' : 'Color'} ${fmt === 'word' ? 'Word' : 'PDF'} — challan…`, 'info');
    /* Word needs no pop-up — the .docx is built and downloaded in place. */
    if (fmt === 'word') {
      downloadDocxFromHtml(html, `${(ctx.student.name || 'student').replace(/\s+/g, '-')}-challan`);
      toast('Challan Word file downloaded.', 'success');
      return;
    }
    const w = window.open('', '_blank');
    if (!w) { toast('Please allow pop-ups to download the challan', 'error'); return; }
    w.document.write(html);
    w.document.close();
    w.onload = () => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } };
    setTimeout(() => toast('Challan ready — use your browser\'s Save as PDF.', 'success'), 1100);
  };
  const runDownload = (family, { theme, fmt, size = 'a4' }) => {
    const bw   = theme === 'bw';
    const html = buildFamilyChallanHTML({ family: famWithFigs(family), settings, bw, size });
    const sizeT = size === 'thermal' ? 'Thermal 80mm' : 'A4';
    toast(`Generating ${sizeT} · ${bw ? 'B&W' : 'Color'} ${fmt === 'word' ? 'Word' : 'PDF'} — family challan…`, 'info');
    /* Word needs no pop-up — the .docx is built and downloaded in place. */
    if (fmt === 'word') {
      downloadDocxFromHtml(html, `${family.name.replace(/\s+/g, '-')}-family-challan`);
      toast('Family challan Word file downloaded.', 'success');
      return;
    }
    const w = window.open('', '_blank');
    if (!w) { toast('Please allow pop-ups to download the challan', 'error'); return; }
    w.document.write(html);
    w.document.close();
    w.onload = () => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } };
    setTimeout(() => toast('Family challan ready — use your browser\'s Save as PDF.', 'success'), 1100);
  };

  /* ── Confirm-driven actions ── */
  const requestDeleteChildChallan = (f, ch) => {
    setConfirm({
      title:   'Delete child challan?',
      message: `${ch.name}'s ${appliedMonth} ${appliedYear} challan will be deleted.`,
      hint:    'This action cannot be undone.',
      onConfirm: async () => {
        /* Real API: delete the BranchLedger challan record by its id. */
        const id = idMap[keyOf(f.key, ch.reg)];
        if (id == null) { toast('No challan found to delete', 'warning'); return; }
        try {
          await feeService.deleteChallanById(id);
          toast(`Challan removed for ${ch.name}`, 'success');
        } catch (e) {
          toast(e.message || 'Could not delete challan', 'error');
        } finally {
          await loadLedgers();
        }
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
        /* Real API: delete the family-tree detail record by its id. */
        try {
          await feeService.deleteFamilyTreeDetail({
            id:           ch.detailID,
            treeID:       f.id,
            applicantsID: ch.applicantsID,
            gradeID:      ch.gradeID,
            sectionID:    ch.sectionID,
          });
        } catch (err) {
          toast(err.message || 'Could not remove child from family', 'error');
          return;
        }
        setFamilies(prev => prev.map(x => x.key === f.key ? {
          ...x,
          children: x.children.filter(c => c.reg !== ch.reg),
        } : x));
        setGenSet(prev => { const n = new Set(prev); n.delete(keyOf(f.key, ch.reg)); return n; });
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
          /* Column totals for the table footer — summed from each child's figures. */
          const sums = f.children.reduce((a, ch) => {
            const fig = childFig(f, ch);
            const d = Number(fig.dues) || 0;
            const v = Number(fig.advance) || 0;
            /* Row jaisa hi hisaab (discount already fee/transport me shamil). */
            const p = (Number(fig.fee) || 0) + (Number(fig.transport) || 0) + d - v;
            /* PROJECTED late fine ko Total Payable me NAHI jodte — challan amount asal
               fee hi rahe. Sirf bill ho chuki (receive ke waqt lagi) fine, jo pehle se
               `fee` me baqaya ke taur par shamil hai, count hoti hai. */
            const chRec = recMap[keyOf(f.key, ch.reg)];
            const billedFine = billedFineOf(chRec) > 0 ? challanAccruedFine(chRec, settings) : 0;
            return {
              fee:       a.fee       + (Number(fig.fee)       || 0),
              transport: a.transport + (Number(fig.transport) || 0),
              discount:  a.discount  + (Number(fig.discount)  || 0),
              dues:      a.dues      + d,
              advance:   a.advance   + v,
              fine:      a.fine      + billedFine,
              payable:   a.payable   + p,
            };
          }, { fee: 0, transport: 0, discount: 0, dues: 0, advance: 0, fine: 0, payable: 0 });
          const total = sums.payable;
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
                  <Tooltip text={tot - gen > 0
                    ? `Generate challans for the ${tot - gen} remaining child${tot - gen === 1 ? '' : 'ren'} (already-generated ones are skipped)`
                    : `All ${tot} children already have challans`}>
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
                          <th className="fee-right">Total Dues</th>
                          <th className="fee-right">Advance</th>
                          <th className="fee-right">Transport</th>
                          <th className="fee-right">Discount</th>
                          <th className="fee-right">Fee</th>
                          <th className="fee-right">Total Payable</th>
                          <th className="fee-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {f.children.length === 0 ? (
                          <tr><td colSpan="12" className="fee-stbl-empty">No children in this family.</td></tr>
                        ) : f.children.map((ch, j) => {
                          const fig = childFig(f, ch);
                          /* Fee/Transport/Dues ab baqaya (received ke baad) hain aur discount
                             unme already shamil — is liye yahan discount dobara minus nahi.
                             Over-payment par pay MINUS me jaata hai = student ka credit. */
                          const dues = Number(fig.dues) || 0;
                          const adv  = Number(fig.advance) || 0;
                          const pay  = (Number(fig.fee) || 0) + (Number(fig.transport) || 0) + dues - adv;
                          const generated = isGen(f.key, ch.reg);
                          /* Total Payable = asal challan fee. PROJECTED late fine yahan
                             NAHI jodte — wo challan print/receiving par lagti hai. Sirf
                             bill ho chuki fine (jo `fig.fee` me pehle se hai) note me. */
                          const chRec   = recMap[keyOf(f.key, ch.reg)];
                          const billedFine = billedFineOf(chRec) > 0 ? challanAccruedFine(chRec, settings) : 0;
                          return (
                            <tr key={ch.reg}>
                              <td className="fee-num">{j + 1}</td>
                              <td>{ch.reg}</td>
                              <td><b>{ch.name}</b></td>
                              <td>{ch.cls}</td>
                              <td>{ch.sec}</td>
                              <td className="fee-right">{money(dues)}</td>
                              {/* Advance student ke haq me hai → MINUS me dikhao. */}
                              <td className={`fee-right${adv > 0 ? ' fee-neg' : ''}`}>{money(adv > 0 ? -adv : 0)}</td>
                              <td className="fee-right">{money(fig.transport)}</td>
                              <td className="fee-right">{money(fig.discount)}</td>
                              <td className="fee-right">{money(fig.fee)}</td>
                              <td className={`fee-right${pay < 0 ? ' fee-neg' : ''}`}>
                                <b>{money(pay)}</b>
                                {billedFine > 0 && <span className="fee-sub-eq fee-fine">incl. fine {money(billedFine)}</span>}
                              </td>
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
                                <Tooltip text={`Download ${ch.name}'s separate challan`}>
                                  <button className="fee-iconbtn" onClick={() => openChildDownload(f, ch)}>
                                    <i className="fa-solid fa-download"></i>
                                  </button>
                                </Tooltip>
                                <Tooltip text={`View ${ch.name}'s challan`}>
                                  <button className="fee-iconbtn" onClick={() => openChildPreview(f, ch)}>
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
                      {/* Column-wise total row hata diya — neeche right corner wala
                          "Total Family Payable" hi kaafi hai. */}
                    </table>
                  </div>

                  <div className="fee-family-total">
                    {sums.fine > 0 && (
                      <>
                        Total Fine: <span className="fee-fine">{money(sums.fine)}</span>
                        <span style={{ margin: '0 10px', opacity: 0.4 }}>|</span>
                      </>
                    )}
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
        defaultYear={appliedYear}
        genSet={genSet}
        keyOf={keyOf}
        onClose={() => setBulkGen(null)}
        onGenerated={handleBulkGenerated}
        toast={toast}
        familyMode
        singleMode={bulkGen?.mode === 'single'}
        /* Student ka saved discount family challan me bhi map ho. */
        fetchDiscounts={fetchFamilyDiscounts}
      />

      <ChallanPreviewModal
        cfg={challanPreview}
        onClose={() => setChallanPreview(null)}
        onDownload={() => {
          const f  = challanPreview?.family;
          const ch = challanPreview?.child;
          setChallanPreview(null);
          /* Child preview tha to usi bachche ka download, warna poori family ka. */
          if (ch && f) openChildDownload(f, ch);
          else if (f) openDownload(f);
        }}
      />

      <DownloadPickerModal
        cfg={downloadCtx}
        onClose={() => setDownloadCtx(null)}
        onSubmit={(picks) => {
          const ctx = downloadCtx;
          setDownloadCtx(null);
          if (!ctx) return;
          if (ctx.kind === 'child') runChildDownload(ctx, picks);   // separate child slip
          else if (ctx.family)      runDownload(ctx.family, picks); // combined family slip
        }}
      />
    </>
  );
}

/* Split a challan's detailRows into the screen figures: a "previous pending"
   head becomes Total Dues when positive, or Advance (as a positive number) when
   negative; every other head sums into Current Fee. Total Payable = Current Fee
   + Total Dues − Advance. */
function challanFigures(rec) {
  const rows = (rec && rec.detailRows) || [];
  let dues = 0, advance = 0, current = 0;
  let totalNet = 0, totalRecv = 0;
  rows.forEach(r => {
    const amt   = Number(r.challanAmount) || 0;
    const disc  = Number(r.discount) || 0;
    const recv  = Number(r.receivedAmount) || 0;
    const net   = amt - disc;
    const label = String(r.subHead || r.head || '').toLowerCase();
    totalNet  += net;
    totalRecv += recv;
    /* Dues/Current ab WASOOLI KE BAAD ka baqaya hai — challan poora receive ho jaye to
       ye 0 ho jaate hain (pehle full amount hi dikhta rehta tha). */
    if (/previous|pending|arrear/.test(label)) {
      if (amt >= 0) dues += Math.max(0, net - recv);
      else advance += Math.abs(amt);
    } else {
      current += Math.max(0, net - recv);
    }
  });
  /* Challan ke total se ZYADA wasool ho gaya (over-receiving) → extra raqam student ka
     ADVANCE hai. Isay bhi advance me jodo, warna Fee Challans list par 0 dikhta tha. */
  advance += Math.max(0, totalRecv - totalNet);
  return { dues, advance, current, payable: current + dues - advance };
}

function FeeChallansList({ toast }) {
  /* Classes API ke fee heads (feeStructureID + name) — Discount Manager ke
     heads render + saved-discount ko headID se resolve karne ke liye. */
  const { data: classFeeStruct = {} } = useAsync(feeService.getClassFeeStructureMap, []);
  /* Existing discount record ids: { [studentID]: { [headID]: recordId } } — save
     par bheja jaata hai taake already-added discount update ho (na ke naya insert). */
  const discountIdRef = useRef({});
  const { can } = usePermissions();
  const canChCreate   = can('Fee', 'Fee Challans', 'Create');
  const canChDelete   = can('Fee', 'Fee Challans', 'Delete');
  const canChDownload = can('Fee', 'Fee Challans', 'Download');
  const { data: classes = [] } = useAsync(feeService.getFeeClasses, []);
  const { data: studentsMap = {} } = useAsync(feeService.getTransportFee, []);
  const { data: headsMap = {} } = useAsync(feeService.getFeeHeads, []);
  const { data: settings = {} } = useAsync(feeService.getFeeSettings, []);
  /* Branch header (name / address / logo / session / date) for challan slips. */
  const { data: branchHeader = null } = useAsync(feeService.getReportHeader, [], null);

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

  /* Generated challans, loaded live from /api/BranchLedger/get-by-month for the
     applied month/year. `genSet` marks which class|reg|month challans exist;
     `challanMap` holds the full challan record (incl. id + detailRows) per key
     so deletes can target the real BranchLedger id. */
  const [genSet, setGenSet] = useState(null);
  const [challanMap, setChallanMap] = useState({});
  /* Pichle mahino ka baqaya (dues) / advance — { [studentID]: { dues, advance } }.
     Isse current month me challan banane se PEHLE hi total dues dikh jaate hain. */
  const [prevOutMap, setPrevOutMap] = useState({});
  const monthIdx = FEE_MONTHS.indexOf(appliedMonth);
  const keyOf    = (classKey, reg) => `${classKey}|${reg}|${monthIdx}`;

  /* Pull the month's challans and index them onto the class|reg keys. Matches
     each challan to a student by studentID (falling back to the challan's own
     grade/section/registration), so the list reflects real generated data. */
  const loadChallans = useCallback(async () => {
    if (!studentsMap || Object.keys(studentsMap).length === 0) return;
    const mIdx = FEE_MONTHS.indexOf(appliedMonth);
    try {
      const rows = await feeService.getMonthChallans(mIdx + 1, appliedYear);
      const byStudentId = new Map();
      Object.entries(studentsMap).forEach(([ck, studs]) => {
        (studs || []).forEach(s => byStudentId.set(String(s.studentID), { classKey: ck, reg: s.reg }));
      });
      const set = new Set();
      const map = {};
      rows.forEach(ch => {
        const loc = byStudentId.get(String(ch.studentID));
        const classKey = loc ? loc.classKey : `g${ch.gradeID}-s${ch.sectionID}`;
        const reg      = loc ? loc.reg      : String(ch.registrationNumber || '');
        const k = `${classKey}|${reg}|${mIdx}`;
        set.add(k);
        map[k] = ch;
      });
      setGenSet(set);
      setChallanMap(map);

      /* ── Pichhle mahino ka baqaya, RUN TIME par ──
         Har student ka SABSE RECENT purana challan liya jaata hai (usi me pehle ka
         carry-forward already shamil hota hai, is liye double-count nahi hota), phir
         uska unpaid remainder nikaala jaata hai:
           remainder = Σ (challanAmount − discount − receivedAmount)
         remainder > 0 → Total Dues | remainder < 0 → Advance.
         Isse current month ka challan banane se PEHLE hi dues/advance dikh jaate hain. */
      const prevOut = {};
      try {
        let toM = mIdx, toY = appliedYear;                 // applied month se ek pehle
        if (toM === 0) { toM = 12; toY = appliedYear - 1; }
        let fromM = toM - 11, fromY = toY;                 // 12-month window
        while (fromM <= 0) { fromM += 12; fromY -= 1; }
        const prevRows = await feeService.getLedgerRange(fromM, fromY, toM, toY);
        const latest = new Map();                          // studentID → sabse recent record
        (prevRows || []).forEach(r => {
          const id   = String(r.studentID);
          const rank = (Number(r.year) || 0) * 12 + (Number(r.month) || 0);
          const cur  = latest.get(id);
          if (!cur || rank > cur.rank) latest.set(id, { rank, rec: r });
        });
        latest.forEach(({ rec }, id) => {
          const raw = (rec.detailRows || []).reduce(
            (a, r) => a + ((+r.challanAmount || 0) - (+r.discount || 0) - (+r.receivedAmount || 0)), 0);
          if (raw !== 0) prevOut[id] = { dues: raw > 0 ? raw : 0, advance: raw < 0 ? -raw : 0 };
        });
      } catch (e) { /* previous dues optional — na mile to 0 hi rahenge */ }
      setPrevOutMap(prevOut);
    } catch (e) {
      toast(e.message || 'Could not load challans', 'error');
      setGenSet(new Set());
      setChallanMap({});
      setPrevOutMap({});
    }
  }, [studentsMap, appliedMonth, appliedYear, toast]);

  /* Load on mount and whenever the student roster or applied month/year change. */
  useEffect(() => { loadChallans(); }, [loadChallans]);

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
    const lock = challanMonthLock(monthIdx, appliedYear, settings);
    if (lock) { toast(lock, 'warning'); return; }
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
    /* Re-pull from the API so the new challans carry their real ids (needed for delete). */
    loadChallans();
  };
  const openIndivGen = (c, s) => {
    const lock = challanMonthLock(monthIdx, appliedYear, settings);
    if (lock) { toast(lock, 'warning'); return; }
    setBulkGen({
      classMeta: c,
      students:  [s],
      heads:     headsMap[c.key] || [],
      mode:      'single',
    });
  };

  /* Attach the real generated challan (with its detailRows) to a student so the
     slip renders exactly the heads the API returned, incl. "Previous Pending". */
  const withChallan = (c, s) => ({ ...s, _challan: challanMap[keyOf(c.key, s.reg)] || null });

  const resolveCtx = (ctx) => {
    const c = classes.find(x => x.key === ctx.classKey);
    if (!c) return null;
    const heads = headsMap[ctx.classKey] || [];
    if (ctx.type === 'student') {
      const s = (studentsMap[ctx.classKey] || []).find(x => x.reg === ctx.reg);
      if (!s) return null;
      return { classMeta: c, students: [withChallan(c, s)], heads, sub: `${s.name} · child of ${s.father || '—'}` };
    }
    if (ctx.type === 'bulk') {
      const all  = studentsMap[ctx.classKey] || [];
      const list = all.filter(s => genSet && genSet.has(keyOf(c.key, s.reg)));
      if (list.length === 0) return null;
      return { classMeta: c, students: list.map(s => withChallan(c, s)), heads, sub: `${c.cls} — Section ${c.sec} · ${list.length} student${list.length === 1 ? '' : 's'}` };
    }
    return null;
  };

  /* Saved discounts for the students about to be printed, in the
     { [classKey]: { [reg]: { [headName]: amt } } } shape the slip builders read.

     They have to come from /api/Student/get-fee-discounts-by-student: the local
     discountMap only holds this session's edits, so on a fresh page the Disc
     column would print blank even though a discount exists. The API's headName
     is always empty, so rows are matched to heads by headID → feeStructureID. */
  const fetchStudentDiscounts = useCallback(async (classMeta, students) => {
    const perReg = {};
    await Promise.all((students || []).map(async (s) => {
      const gradeId = s.gradeID || classMeta._gradeId;
      const gHeads  = (classFeeStruct[gradeId] && classFeeStruct[gradeId].length)
        ? classFeeStruct[gradeId]
        : (headsMap[classMeta.key] || []);
      let fromApi = {};
      try {
        const rows = await feeService.getFeeDiscountsByStudent(s.studentID);
        /* Ek hi head ke khilaf agar EK SE ZYADA active record hon (purana + naya),
           to SABSE NAYA (sabse bada id) jeetna chahiye — warna purana discount
           (e.g. 600) naye (100) ki jagah print/challan me chala jata hai. */
        const newestByHead = new Map();
        (rows || []).filter(r => r.isActive !== false).forEach(r => {
          const k    = String(r.headID);
          const rank = Number(r.id) || 0;
          const cur  = newestByHead.get(k);
          if (!cur || rank >= cur.rank) newestByHead.set(k, { rank, row: r });
        });
        newestByHead.forEach(({ row: r }) => {
          const head = gHeads.find(h => Number(h.feeStructureID) === Number(r.headID));
          const amt  = Number(r.discountAmount) || 0;
          if (head && amt > 0) fromApi[head.name] = amt;
        });
      } catch (e) { fromApi = {}; }   /* no discounts → Disc stays blank */
      /* This session's just-saved edits win over what the server returned. */
      const local  = (discountMap[classMeta.key] || {})[s.reg] || {};
      const merged = { ...fromApi, ...local };
      if (Object.keys(merged).length) perReg[s.reg] = merged;
    }));
    return { [classMeta.key]: perReg };
  }, [classFeeStruct, headsMap, discountMap]);

  const openPreview = async (ctx) => {
    const r = resolveCtx(ctx);
    if (!r) { toast('Nothing to preview', 'info'); return; }
    const dMap  = await fetchStudentDiscounts(r.classMeta, r.students);
    const inner = buildChallanInner({
      classMeta: r.classMeta, students: r.students, heads: r.heads,
      settings, discountMap: dMap, bw: false, school: branchHeader,
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
  const runDownload = async (ctx, { theme, fmt, size = 'a4' }) => {
    const r = resolveCtx(ctx);
    if (!r) { toast('Nothing to download', 'info'); return; }
    const bw   = theme === 'bw';
    const dMap = await fetchStudentDiscounts(r.classMeta, r.students);
    const html = buildChallanHTML({
      classMeta: r.classMeta, students: r.students, heads: r.heads,
      settings, discountMap: dMap, bw, size, school: branchHeader,
    });
    const cnt    = r.students.length;
    const sizeT  = size === 'thermal' ? 'Thermal 80mm' : 'A4';
    const label  = `${sizeT} · ${bw ? 'B&W' : 'Color'} ${fmt === 'word' ? 'Word' : 'PDF'}`;
    toast(`Generating ${label} — ${cnt} challan${cnt === 1 ? '' : 's'}…`, 'info');
    /* Word needs no pop-up — the .docx is built and downloaded in place. */
    if (fmt === 'word') {
      downloadDocxFromHtml(html, `${r.classMeta.cls}-${r.classMeta.sec}-challans`);
      toast(`${cnt} challan${cnt === 1 ? '' : 's'} downloaded as Word.`, 'success');
      return;
    }
    const w = window.open('', '_blank');
    if (!w) { toast('Please allow pop-ups to download the challan', 'error'); return; }
    w.document.write(html);
    w.document.close();
    w.onload = () => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } };
    setTimeout(() => toast('Challan ready — use your browser\'s Save as PDF.', 'success'), 1100);
  };

  const openDiscount = async (c, s) => {
    const gradeId = s.gradeID || c._gradeId;
    /* Heads classes API (get-classlist-…) se — inme feeStructureID + headName
       hota hai jo discount ke headID se match karta hai. Fallback: headsMap. */
    const heads = (classFeeStruct[gradeId] && classFeeStruct[gradeId].length)
      ? classFeeStruct[gradeId]
      : (headsMap[c.key] || []);
    if (heads.length === 0) { toast('Configure fee heads for this class first', 'warning'); return; }
    /* Pehle local mirror; phir by-student API se saved discounts laa kar head
       ke against dikhao (API sirf isi student ke records deti hai). */
    let initial = (discountMap[c.key] && discountMap[c.key][s.reg]) || {};
    try {
      const rows   = await feeService.getFeeDiscountsByStudent(s.studentID);
      const active = (rows || []).filter(r => r.isActive !== false);
      /* headID → existing record id yaad rakho (save par update ke liye). */
      const idMap = {};
      active.forEach(r => { idMap[String(r.headID)] = r.id; });
      discountIdRef.current[String(s.studentID)] = idMap;
      if (active.length) {
        const fromApi = {};
        active.forEach(r => {
          /* headName API me khaali aata hai — headID ko head.feeStructureID se match karo. */
          const head = heads.find(h => Number(h.feeStructureID) === Number(r.headID));
          if (head) fromApi[head.name] = Number(r.discountAmount) || 0;
        });
        if (Object.keys(fromApi).length) initial = fromApi;
      }
    } catch (e) { /* API fail → local mirror hi use hoga */ }
    setDiscountCtx({ classMeta: c, student: s, heads, initial });
  };
  const saveDiscount = async (classKey, reg, perHead) => {
    /* Local mirror (drives the challan discount figures). */
    setDiscountMap(prev => {
      const next = { ...prev };
      next[classKey] = { ...(next[classKey] || {}) };
      next[classKey][reg] = { ...perHead };
      return next;
    });

    /* Real API: POST /api/Student/save-fee-discount — ek record per fee head. */
    const cls     = classes.find(x => x.key === classKey);
    const student = (studentsMap[classKey] || []).find(x => x.reg === reg);
    const gradeId = student?.gradeID || cls?._gradeId;
    /* feeStructureID classes API se (modal heads jaisi hi source), fallback headsMap. */
    const heads   = (classFeeStruct[gradeId] && classFeeStruct[gradeId].length)
      ? classFeeStruct[gradeId]
      : (headsMap[classKey] || []);
    const entries = Object.entries(perHead || {});
    const idMap   = discountIdRef.current[String(student?.studentID)] || {};
    if (student && entries.length) {
      try {
        for (const [headName, discountAmount] of entries) {
          const head = heads.find(h => h.name === headName);
          /* Already-added discount ho to uska id bhejo (update); warna 0 (insert). */
          const existingId = idMap[String(head?.feeStructureID)] || 0;
          await feeService.saveFeeDiscount({
            id:             existingId,
            gradeID:        student.gradeID || cls?._gradeId,
            sectionID:      student.sectionID || cls?._sectionId,
            headID:         head?.feeStructureID,
            headName,
            discountAmount,
            studentID:      student.studentID,
            studentName:    student.name,
          });
        }
        toast('Discount saved', 'success');
      } catch (e) {
        toast(e.message || 'Could not save discount', 'error');
      }
    } else {
      toast('Discount saved', 'success');
    }
    setDiscountCtx(null);
  };

  /* Confirm-driven delete — hits /api/BranchLedger/delete/{id} per challan record. */
  const requestDeleteClassChallans = (c) => {
    const gen = genCountFor(c.key);
    if (gen === 0) { toast('No challans to delete for this class', 'warning'); return; }
    setConfirm({
      title: 'Delete generated challans?',
      message: `All ${gen} challan${gen === 1 ? '' : 's'} for ${c.cls} (${c.sec}) in ${appliedMonth} ${appliedYear} will be removed.`,
      hint:   'This action cannot be undone.',
      onConfirm: async () => {
        const studs = studentsMap[c.key] || [];
        const ids = studs
          .map(s => challanMap[keyOf(c.key, s.reg)]?.id)
          .filter(id => id != null);
        try {
          for (const id of ids) {
            await feeService.deleteChallanById(id);
          }
          toast('Generated challans removed', 'success');
        } catch (e) {
          toast(e.message || 'Could not delete challans', 'error');
        } finally {
          await loadChallans();
        }
      },
    });
  };

  const requestDeleteStudentChallan = (c, s) => {
    setConfirm({
      title: 'Delete this challan?',
      message: `The ${appliedMonth} ${appliedYear} challan for ${s.name} will be deleted.`,
      hint:   'This action cannot be undone.',
      onConfirm: async () => {
        const rec = challanMap[keyOf(c.key, s.reg)];
        if (!rec?.id) { toast('No challan found to delete', 'warning'); return; }
        try {
          await feeService.deleteChallanById(rec.id);
          toast(`Challan removed for ${s.name}`, 'success');
        } catch (e) {
          toast(e.message || 'Could not delete challan', 'error');
        } finally {
          await loadChallans();
        }
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
                <i className="fa-solid fa-filter"></i> Fetch Details 
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
                  {canChDownload && (
                  <Tooltip text={`Download all generated challans for ${c.cls} (${c.sec})`}>
                    <button className="fee-iconbtn" onClick={() => openDownload({ type: 'bulk', classKey: c.key })}>
                      <i className="fa-solid fa-file-arrow-down"></i>
                    </button>
                  </Tooltip>
                  )}
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
                  {canChCreate && (
                  <Tooltip text={`Generate challans for all ${total} students in ${c.cls} (${c.sec})`}>
                    <button className="fee-btn fee-btn-primary fee-btn-xs" onClick={() => openBulkGen(c)}>
                      <i className="fa-solid fa-layer-group"></i> Bulk Challans
                    </button>
                  </Tooltip>
                  )}
                </div>
                <div className="fee-td fee-center" data-label="Delete" onClick={e => e.stopPropagation()}>
                  {canChDelete && (
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
                  )}
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
                          const generated = isGenerated(c.key, s.reg);
                          /* Generated → figures from the real challan detailRows;
                             otherwise fall back to the student roster values. */
                          const rec = generated ? challanMap[keyOf(c.key, s.reg)] : null;
                          /* Challan abhi nahi bana → pichhle mahino ka live baqaya dikhao
                             (roster ke stale 0 ki jagah), taake dues turant nazar aayein. */
                          const prevOut = prevOutMap[String(s.studentID)] || null;
                          const fbDues  = prevOut ? prevOut.dues    : (+s.dues    || 0);
                          const fbAdv   = prevOut ? prevOut.advance : (+s.advance || 0);
                          const fig = rec ? challanFigures(rec) : {
                            dues:    fbDues,
                            advance: fbAdv,
                            current: +s.current || 0,
                            payable: (+s.current || 0) + fbDues - fbAdv,
                          };
                          /* Total Payable = asal challan fee. PROJECTED late fine yahan
                             NAHI jodte — wo challan print/receiving par lagti hai. Sirf
                             bill ho chuki fine (jo `current` me baqaya ke taur par pehle se
                             hai) "incl. fine" note me dikhate hain. */
                          const billedFine = billedFineOf(rec) > 0 ? challanAccruedFine(rec, settings) : 0;
                          return (
                            <tr key={s.reg} id={`fee-st-${c.key}-${s.reg}`}>
                              <td className="fee-num">{j + 1}</td>
                              <td>{s.reg}</td>
                              <td><b>{s.name}</b></td>
                              <td>{s.father}</td>
                              <td className="fee-right">{money(fig.dues)}</td>
                              {/* Advance student ke haq me hai → MINUS me dikhao. */}
                              <td className={`fee-right${fig.advance > 0 ? ' fee-neg' : ''}`}>
                                {money(fig.advance > 0 ? -fig.advance : 0)}
                              </td>
                              <td className="fee-right">{money(fig.current)}</td>
                              <td className={`fee-right${fig.payable < 0 ? ' fee-neg' : ''}`}>
                                {money(fig.payable)}
                                {billedFine > 0 && (
                                  <span className="fee-sub-eq fee-fine">incl. fine {money(billedFine)}</span>
                                )}
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
        defaultYear={appliedYear}
        discountMap={discountMap}
        genSet={genSet}
        keyOf={keyOf}
        onClose={() => setBulkGen(null)}
        onGenerated={handleBulkGenerated}
        toast={toast}
        singleMode={bulkGen?.mode === 'single'}
        /* Generate se pehle live saved discounts (server + session edits) resolve karo. */
        fetchDiscounts={fetchStudentDiscounts}
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
   Month + Multi-select Fee Heads + Issue/Due dates;
   then a footer "Generate Challans" CTA that swaps to an animated
   progress bar (batch increments at 55 ms intervals). At 100%, label
   flips to "Completed", a final toast fires, the modal closes.
   ═══════════════════════════════════════════════════════════════════ */
function BulkGenerateModal({
  open, classMeta, students, heads, defaultMonth, defaultYear,
  discountMap = {},
  /* Generate se THEEK PEHLE server ke saved discounts (+ is session ki edits) laata hai —
     sirf local state par bharosa karna galat discount bhej deta tha. */
  fetchDiscounts = null,
  genSet, keyOf, onClose, onGenerated, toast,
  familyMode = false, singleMode = false,
}) {
  /* Issue/Due date bhi LOCAL calendar par — challan ki due date hi late fine ka
     base hai, aur toISOString() (UTC) Pakistan me subah 5 baje se pehle dono ko
     ek din peechhe kar deta tha. */
  const todayISO  = localTodayISO;
  const plusDays  = (n) => {
    const d = new Date(); d.setDate(d.getDate() + n);
    return localDateISO(d);
  };

  const [month, setMonth]         = useState(defaultMonth || FEE_MONTHS[0]);
  const [picked, setPicked]       = useState([]);      // selected fee head names
  const [msOpen, setMsOpen]       = useState(false);
  const [issueDate, setIssueDate] = useState(todayISO());
  const [dueDate, setDueDate]     = useState(plusDays(10));

  const [progress, setProgress]   = useState(null);    // null | { done, total, label }
  const cancelRef = useRef(false);
  const msAnchorRef = useRef(null);

  /* Reset state every time the modal opens. Heads are pre-selected (all of
     them) so the challan is ready to generate without the user having to open
     the "Select Fee Heads" dropdown first — they can still deselect any head. */
  useEffect(() => {
    if (!open) return;
    cancelRef.current = false;
    setMonth(defaultMonth || FEE_MONTHS[0]);
    setPicked((heads || []).map(h => h.name));
    setMsOpen(false);
    setIssueDate(todayISO());
    setDueDate(plusDays(10));
    setProgress(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!heads.length) {
      toast('No fee heads are defined for this class — add them in Fee Setup first', 'error');
      return false;
    }
    /* A challan with no head picked used to silently bill every head. */
    if (!picked.length) { toast('Select at least one fee head', 'error'); return false; }
    if (!issueDate) { toast('Pick an issue date', 'error'); return false; }
    if (!dueDate)   { toast('Pick a due date',   'error'); return false; }
    if (dueDate < issueDate) {
      toast('Due date cannot be before issue date', 'error');
      return false;
    }
    /* Session-date guard: issue & due date current session ki UTC window ke andar hon —
       bahar ho to toaster (session range ke saath) + block. */
    const issueChk = validateSessionDateFromStorage(issueDate, 'issue date');
    if (!issueChk.ok) { toast(issueChk.message, 'error'); return false; }
    const dueChk = validateSessionDateFromStorage(dueDate, 'due date');
    if (!dueChk.ok) { toast(dueChk.message, 'error'); return false; }
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
        setProgress({ done, total: targets.length, label: 'Saving challans...' });
        const regs = targets.map(s => s.reg);
        /* validate() guarantees picked is non-empty — never fall back to all heads. */
        const selectedHeads = heads.filter(h => picked.includes(h.name));
        /* Discount hamesha LIVE lo (server ke saved + is session ki edits, jisme
           edits jeette hain). Sirf local map bhejne se purana/khaali discount
           challan me chala jata tha. */
        const resolveDiscounts = async () => {
          if (!fetchDiscounts) return discountMap;
          try { return await fetchDiscounts(classMeta, targets); }
          catch (e) { return discountMap; }
        };
        resolveDiscounts().then(dMap => feeService.generateChallan(classMeta.key, regs, monthIdx, {
          classMeta,
          students: targets,
          heads: selectedHeads,
          selectedHeadNames: picked,
          discountMap: dMap,
          issueDate,
          dueDate,
          year: defaultYear,
          familyMode,
          singleMode,
        }).then(() => {
          setProgress({ done, total: targets.length, label: 'Completed' });
          onGenerated(classMeta.key, regs);
          const msg = skipCount > 0
            ? `${targets.length} challan${targets.length === 1 ? '' : 's'} generated (${skipCount} skipped — already existed)`
            : `${targets.length} challan${targets.length === 1 ? '' : 's'} generated successfully`;
          toast(msg, 'success');
          setTimeout(onClose, 500);
        }).catch((err) => {
          setProgress(null);
          toast(err.message || 'Could not generate challans', 'error');
        }));
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
                /* Koi bhi date chal sakti hai (past bhi) — bas due date se aage nahi. */
                max={dueDate || undefined}
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
                min={issueDate || undefined}
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
              <div className="fee-dl-fmt-name">Word (.docx)</div>
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!cfg) return;
    /* Initialise from existing saved discount (if any) */
    const init = {};
    cfg.heads.forEach(h => {
      init[h.name] = Number((cfg.initial || {})[h.name]) || 0;
    });
    setDiscs(init);
    setSaving(false);
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

  /* onSave posts one /api/Student/save-fee-discount per head and closes the
     modal itself, so hold the spinner until it resolves. */
  const handleSave = async () => {
    if (saving) return;
    const perHead = {};
    rows.forEach(r => { if (r.disc > 0) perHead[r.name] = r.disc; });
    try {
      setSaving(true);
      await onSave(cfg.classMeta.key, cfg.student.reg, perHead);
    } finally {
      setSaving(false);
    }
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
                        /* 0 ki jagah field khaali dikhe (0 internally hi rehta hai). */
                        value={discs[r.name] || ''}
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
            <button className="fee-btn fee-btn-ghost" onClick={handleClear} disabled={saving}>
              <i className="fa-solid fa-rotate-left"></i> Clear
            </button>
          </Tooltip>
          <Tooltip text="Discard changes and close">
            <button className="fee-btn fee-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          </Tooltip>
          <Tooltip text="Save discount for this student">
            <button
              className="fee-btn fee-btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={saving ? { opacity: .7, cursor: 'wait' } : undefined}
            >
              {saving
                ? <><i className="fa-solid fa-spinner fa-spin"></i> Saving…</>
                : <><i className="fa-solid fa-floppy-disk"></i> Save Discount</>}
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
  /* Receiving Date par late fine ka poora hisaab chalta hai — is liye LOCAL date
     (localTodayISO), toISOString() nahi: wo UTC me badal kar Pakistan (UTC+5) me
     subah 5 baje se pehle PICHHLI date deta tha. Us soorat me due-date wale din
     ki date aa jaati thi, daysLate 0 nikalta, fine 0 banti aur "Late Fine" row
     kabhi ledger me jaati hi nahi — jabke list aaj tak ki fine dikha rahi hoti. */
  const [date, setDate]         = useState(localTodayISO());
  const [method, setMethod]     = useState('Cash');
  const [ref, setRef]           = useState('');
  const [txn, setTxn]           = useState('');
  const [perHeadInput, setPerHeadInput] = useState({});
  /* Fine override. null = auto (due date + settings se computed, receiving date
     badalne par live update). Cashier ne haath lagaya to number — us ke baad
     auto-recompute band, taake typed/waived value date change par wapas na aa jaye. */
  const [fineEdit, setFineEdit] = useState(null);

  useEffect(() => {
    if (!cfg) return;
    setDate(localTodayISO()); setMethod('Cash'); setRef(''); setTxn('');
    setFineEdit(null);
    /* "Received" input KUL wasooli dikhata hai (pehle jama shuda + ab ki), na ke
       sirf ab ki raqam — is liye ye editable rehta hai aur naya paisa
       `input − paid` hota hai (dekho `recvNow` niche).

       Seed sirf ALREADY PAID hai (net nahi): modal khulte hi baqaya raqam PENDING
       me nazar aati hai aur Receiving Now 0 rehta hai. Cashier Pending se raqam
       hataye to wohi Received me chali jaati hai. */
    const chRecv = {};
    (cfg.challan?.detailRows || []).forEach(r => {
      const n = r.subHead || r.head || '';
      chRecv[n] = (chRecv[n] || 0) + (+r.receivedAmount || 0);
    });
    const seed = {};
    (cfg.model.heads || []).forEach(h => {
      const fromPay = (cfg.payments || []).reduce((a, p) => a + (+(p.perHead?.[h.name]) || 0), 0);
      seed[h.name]  = cfg.challan ? Math.max(+chRecv[h.name] || 0, fromPay) : fromPay;
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

  const { classMeta, student, model, payments, challan, period, monthIdx, viewOnly, settings } = cfg;

  /* Per-head already-received. Session `payments` are lost on refresh, so when a
     real challan exists take each head's authoritative receivedAmount from its
     detailRows (matched by subHead) and keep the larger of the two. */
  const challanRecvByHead = {};
  (challan?.detailRows || []).forEach(r => {
    const n = r.subHead || r.head || '';
    challanRecvByHead[n] = (challanRecvByHead[n] || 0) + (+r.receivedAmount || 0);
  });
  const paymentsPerHead = {};
  (payments || []).forEach(p => {
    Object.entries(p.perHead || {}).forEach(([n, v]) => {
      paymentsPerHead[n] = (paymentsPerHead[n] || 0) + (+v || 0);
    });
  });
  const perHeadPaid = {};
  (model.heads || []).forEach(h => {
    const fromPay = +paymentsPerHead[h.name] || 0;
    const fromCh  = +challanRecvByHead[h.name] || 0;
    perHeadPaid[h.name] = challan ? Math.max(fromCh, fromPay) : fromPay;
  });

  /* Build display rows with live recompute */
  let totalChallan = 0, totalDisc = 0, totalAfter = 0;
  /* NOTE: Over-receiving allowed hai — head ke owed se zyada amount li ja sakti hai.
     Us case me Pending MINUS (negative) ho jaata hai = utna ADVANCE. Is liye yahan
     koi upper clamp nahi lagta (pehle lagta tha, jis se extra amount block ho jaata). */
  const rows = model.heads.map(h => {
    const paid    = +perHeadPaid[h.name] || 0;
    /* Input KUL wasooli hai (already + new), is liye naya paisa = input − paid. */
    const totalRecv = viewOnly ? paid : Math.max(0, +perHeadInput[h.name] || 0);
    /* Delta MINUS bhi ho sakta hai: cashier "Already Received" ko theek kar raha
       hai (5000 galti se lag gaya tha, asal 3000). Us soorat me ye head correction
       hai — ledger ka receivedAmount neeche aa jaayega. Clamp yahan NAHI, warna
       edit sirf dikhawa rehta aur save par kuch na hota. */
    const recvNow   = viewOnly ? 0 : (totalRecv - paid);
    const after   = h.net;
    const pending = after - paid - recvNow;      // negative = advance
    totalChallan += h.std;
    totalDisc    += h.disc;
    totalAfter   += after;
    return { ...h, paid, totalRecv, recvNow, after, pending };
  });

  /* Previous Pending bhi ab ek editable head ki tarah — uska apna received input.
     Heads ki tarah ye input bhi KUL wasooli rakhta hai (already + new). */
  const prevKey  = model.prevName || 'Previous Pending';
  const prevPaid = +model.prevPaid || 0;
  /* Unseeded fallback bhi `prevPaid` — heads ki tarah baqaya Pending me shuru ho. */
  const prevTotalRecv = viewOnly
    ? prevPaid
    : Math.max(0, perHeadInput[prevKey] == null ? prevPaid : (+perHeadInput[prevKey] || 0));
  /* Heads ki tarah ye delta bhi MINUS ho sakta hai — correction. */
  const prevRecv = viewOnly ? 0 : (prevTotalRecv - prevPaid);
  const prevPend = model.prev - prevPaid - prevRecv;   // negative = advance

  /* ADVANCE ek CREDIT line hai — "Received" column me MINUS me dikhti hai aur wahin se
     kat jaati hai (editable nahi). Utna cash kam lena hota hai. */
  const headsRecv  = rows.reduce((a, r) => a + r.recvNow, 0) + prevRecv;
  const advCredit  = Math.max(0, +model.advance || 0);
  /* headsRecv correction ki wajah se MINUS ho sakta hai — advance us par apply
     nahi hota (0 se neeche na jaye), warna credit ulta barh jaata. */
  const advApplied = Math.min(advCredit, Math.max(0, headsRecv));

  /* ── LATE FINE ──
     Challan ki due date ke BAAD wasool karne par jurmana. Base date wahi
     "Receiving Date" hai jo upar modal me chuni gayi (system ka aaj nahi), is
     liye date badalte hi fine live update hoti hai, aur receivable/total dono
     me jud'ti hai. Cashier isay table me EDIT (ya 0 kar ke waive) bhi kar sakta
     hai — dekho `fineEdit`. View mode me actual receiving date ke hisaab se
     dikhti hai aur edit nahi hoti. */
  const fineBaseDate = viewOnly
    ? (String(payments?.[payments.length - 1]?.date || challan?.modifiedAt || '').slice(0, 10) || date)
    : date;
  const fineRows  = (challan?.detailRows || []).filter(feeService.isLateFineRow);
  /* Ledger me pehle se mojood (freeze shuda) fine — aur uske khilaf wasooli. */
  const fineBilled = fineRows.reduce((a, r) => a + (+r.challanAmount || 0), 0);
  const finePaid   = fineRows.reduce((a, r) => a + (+r.receivedAmount || 0), 0);
  const fineCalc   = feeService.computeFine({
    dueDate: challan?.dueDate, receivingDate: fineBaseDate, settings,
  });
  /* Jo fine ledger me likhi ja chuki hai WAHI authority hai — usay dobara compute
     na karo. Warna settings badalne par (ya view mode me doosri base date par)
     modal ki fine persisted row se mukhtalif nikalti thi: Total 4,400 magar
     Already Received 4,450, aur Remaining minus me chala jaata tha.
     Fine abhi tak billed nahi hui to computed hi lagti hai. */
  /* Cashier ka override sab par bhaari — waive (0) ya barhaana dono mumkin.
     Magar jo fine PEHLE HI wasool ho chuki (finePaid) us se neeche nahi ja sakta,
     warna Total already-received se kam ho kar Remaining minus me chala jaata. */
  const fineAuto = fineBilled > 0 ? fineBilled : fineCalc;
  const fineDue  = (!viewOnly && fineEdit != null) ? Math.max(finePaid, fineEdit) : fineAuto;
  const fineDays = feeService.daysLate(challan?.dueDate, fineBaseDate);
  const fineOwed = Math.max(0, fineDue - finePaid);

  const receivingNow = headsRecv - advApplied + (viewOnly ? 0 : fineOwed);
  const alreadyPaid  = rows.reduce((a, r) => a + r.paid, 0) + prevPaid + finePaid;
  const totalAmt     = totalAfter + model.prev - model.advance + fineDue;
  /* Total se zyada wasool ho to ye MINUS me jaata hai = student ka advance. */
  const remainAfter  = totalAmt - alreadyPaid - receivingNow;

  const setHead = (name, v) => {
    setPerHeadInput(prev => ({ ...prev, [name]: Math.max(0, Number(v) || 0) }));
  };

  /* Pending is the mirror of Received — the two always add up to the head's net,
     so typing either one drives the other. Both write to the same perHeadInput
     state; there is no second source of truth. Received KUL wasooli hai, is liye
     yahan `net` se ghatao (owed se nahi). */
  const setPendingFor = (row, v) => {
    /* Pending MINUS bhi ho sakta hai (advance) — is liye niche clamp nahi. */
    const pend = Number(v) || 0;
    setPerHeadInput(prev => ({ ...prev, [row.name]: Math.max(0, row.net - pend) }));
  };

  const fineTxt = settings?.fineEnabled
    ? `Rs. ${(+settings.fineAmt || 0).toLocaleString('en-PK')} ${settings.fineType === 'daily' ? '/ day' : '(fixed)'}`
    : '—';

  const handleReceive = () => {
    /* receivingNow MINUS bhi ho sakta hai jab cashier ne already-received ko neeche
       theek kiya — wo bhi ek valid save hai. Sirf "kuch bhi nahi badla" rokna hai. */
    if (receivingNow === 0) { toast('Enter at least one head amount to receive', 'error'); return; }
    if (!date) { toast('Receiving date is required', 'error'); return; }
    /* Session-date guard: receiving date current session ki UTC window ke andar ho. */
    const recvChk = validateSessionDateFromStorage(date, 'receiving date');
    if (!recvChk.ok) { toast(recvChk.message, 'error'); return; }
    /* Build perHead snapshot of receivingNow values. Non-zero delta bhejo — MINUS
       wala bhi, warna correction save hi na hoti. */
    const perHead = {};
    rows.forEach(r => { if (r.recvNow !== 0) perHead[r.name] = r.recvNow; });
    /* Previous dues ki raqam bhi — ASLI subHead key par, taake API sahi row par lagaye. */
    if (prevRecv !== 0) perHead[prevKey] = (perHead[prevKey] || 0) + prevRecv;
    const payload = {
      reg: student.reg, monthIdx,
      studentName: student.name,
      date, method, ref, txn,
      amount: receivingNow,
      perHead,
      /* Correction (net minus) — receipt/slip aur history ise adjustment dikhayein,
         normal wasooli nahi. */
      isAdjustment: receivingNow < 0,
      /* Fine alag se — receipt/slip par apni line banti hai, aur `amount` me
         pehle se shamil hai (receivingNow me joda gaya). */
      fine: fineOwed,
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
              {/* Challan ki apni due date (generate karte waqt chuni gayi) — pehle
                  yahan hamesha AAJ ki date chhap rahi thi, jo late-fine ke hisaab
                  ko galat dikhata tha. */}
              <span className="fee-recv-info-val">{fmtDMY(challan?.dueDate) || '—'}</span>
            </div>
            <div className="fee-recv-info-item">
              <span className="fee-recv-info-lbl">Fine After Due Date</span>
              {/* Rate ke saath is challan par ACTUAL banti fine bhi — receiving
                  date due se aage ho to hi. */}
              <span className="fee-recv-info-val">
                {fineTxt}
                {/* Cashier ne fine edit ki ho to yahan ASAL (accrued) raqam dikhao —
                    "N days late = X" lagi hui fine par jhoot bol deta. */}
                {fineEdit != null && !viewOnly ? (
                  fineAuto > 0 && (
                    <span className="fee-sub-eq fee-fine">
                      {fineDays} day{fineDays === 1 ? '' : 's'} late = {money(fineAuto)} · applied {money(fineDue)}
                    </span>
                  )
                ) : fineDue > 0 && (
                  <span className="fee-sub-eq fee-fine">
                    {fineDays} day{fineDays === 1 ? '' : 's'} late = {money(fineDue)}
                  </span>
                )}
              </span>
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
                          value={r.totalRecv}
                          onChange={e => setHead(r.name, e.target.value)}
                          placeholder="0"
                        />
                      )}
                    </td>
                    <td className="fee-right">
                      {viewOnly ? (
                        money(r.pending)
                      ) : (
                        <input
                          type="number"
                          min="0"
                          value={r.pending}
                          onChange={e => setPendingFor(r, e.target.value)}
                          placeholder="0"
                        />
                      )}
                    </td>
                  </tr>
                ))}
                {/* Family child ke model me "Previous Pending" pehle se ek head hota hai (upar
                    rows me apne input ke saath aata hai) — us case me ye row skip karo,
                    warna duplicate dikhega. */}
                {model.prev > 0 && !(model.heads || []).some(h => /previous|pending|arrear/i.test(h.name)) && (
                  <tr>
                    <td><b>Previous Pending</b></td>
                    <td className="fee-right">{money(model.prev)}</td>
                    <td className="fee-right">0</td>
                    <td className="fee-right"><span className="fee-cell-grey">{money(model.prev)}</span></td>
                    <td className="fee-right">
                      {viewOnly ? (
                        <span className="fee-paid-amt">{money(prevPaid)}</span>
                      ) : (
                        <input
                          type="number"
                          min="0"
                          value={prevTotalRecv}
                          onChange={e => setHead(prevKey, e.target.value)}
                          placeholder="0"
                        />
                      )}
                    </td>
                    <td className="fee-right">
                      {viewOnly ? (
                        money(Math.max(0, model.prev - prevPaid))
                      ) : (
                        <input
                          type="number"
                          min="0"
                          value={prevPend}
                          onChange={e => {
                            const pend = Number(e.target.value) || 0;
                            setHead(prevKey, Math.max(0, model.prev - pend));
                          }}
                          placeholder="0"
                        />
                      )}
                    </td>
                  </tr>
                )}
                {/* ADVANCE — Previous Pending jaisi hi ek row, magar "Received" MINUS me
                    aur read-only (student ke credit se khud kat jaata hai). */}
                {advCredit > 0 && (
                  <tr>
                    <td><b>Advance</b></td>
                    <td className="fee-right">—</td>
                    <td className="fee-right">—</td>
                    <td className="fee-right"><span className="fee-cell-grey">{money(-advCredit)}</span></td>
                    <td className="fee-right fee-neg"><b>{money(-advApplied)}</b></td>
                    <td className="fee-right">{money(advCredit - advApplied)}</td>
                  </tr>
                )}
                {/* ── LATE FINE ──
                    Due date ke baad receive karne par khud lagti hai, magar EDITABLE —
                    cashier isay kam/zyada ya poori waive (0) kar sakta hai. Haath na
                    lagaye to Receiving Date badalne par apne aap recalculate hoti hai.
                    Override ke baad row 0 par bhi dikhti rehti hai (warna edit karte hi
                    gayab ho jaati aur wapas laane ka koi raasta na hota). */}
                {(fineDue > 0 || (!viewOnly && fineEdit != null)) && (
                  <tr>
                    <td>
                      <b>Fine</b>
                      <span className="fee-sub-eq">
                        {fineEdit != null && !viewOnly
                          ? (fineEdit === 0 ? 'Waived by cashier' : 'Edited by cashier')
                          : <>
                              {fineDays} day{fineDays === 1 ? '' : 's'} late
                              {settings?.fineType === 'daily' ? ` × Rs. ${(+settings.fineAmt || 0).toLocaleString('en-PK')}` : ''}
                            </>}
                      </span>
                    </td>
                    <td className="fee-right">
                      {viewOnly ? money(fineDue) : (
                        <input
                          type="number"
                          min={finePaid}
                          value={fineDue}
                          onChange={e => setFineEdit(Math.max(0, Number(e.target.value) || 0))}
                          placeholder="0"
                        />
                      )}
                    </td>
                    <td className="fee-right">0</td>
                    <td className="fee-right"><span className="fee-cell-grey">{money(fineDue)}</span></td>
                    {/* Fine read-only — input ki tarah ye bhi KUL wasooli dikhati hai. */}
                    <td className="fee-right"><b>{money(viewOnly ? finePaid : finePaid + fineOwed)}</b></td>
                    <td className="fee-right">{money(viewOnly ? Math.max(0, fineDue - finePaid) : 0)}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="fee-recv-total">
                  <td>Total</td>
                  <td className="fee-right">{money(totalChallan + model.prev + fineDue)}</td>
                  <td className="fee-right">{money(totalDisc)}</td>
                  <td className="fee-right">{money(totalAfter + model.prev - advApplied + fineDue)}</td>
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
              {/* MINUS = correction, wasooli nahi — label aur rang dono badal jaate hain. */}
              <span className="fee-recv-paylbl">{receivingNow < 0 ? 'Adjustment' : 'Receiving Now'}</span>
              <span className={`fee-recv-payval ${receivingNow < 0 ? 'red' : 'blue'}`}>{money(receivingNow)}</span>
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
            <Tooltip text={receivingNow < 0
              ? `Reduce recorded received amount by Rs. ${Math.abs(receivingNow).toLocaleString('en-PK')}`
              : `Record Rs. ${receivingNow.toLocaleString('en-PK')} as received`}>
              <button className="fee-btn fee-btn-primary" onClick={handleReceive}>
                {receivingNow < 0
                  ? <><i className="fa-solid fa-pen"></i> Update Received</>
                  : <><i className="fa-solid fa-check"></i> Receive</>}
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
  /* Challan ke detailRows se per-head Standard (net) / Discount / Received banao — taake
     slip me sirf received nahi, poora breakup dikhe. Challan na mile to fallback: sirf
     received (perHead). */
  const chRows = cfg.challan && Array.isArray(cfg.challan.detailRows) ? cfg.challan.detailRows : null;
  const baseRows = chRows
    ? chRows.map(r => {
        const std  = Math.round(+r.challanAmount || 0);   // ORIGINAL standard fee (discount se pehle)
        const disc = Math.round(+r.discount || 0);
        const recv = Math.round(+r.receivedAmount || 0);
        return { name: r.subHead || r.head || '—', std, disc, recv };
      })
    : Object.entries(payment.perHead || {}).map(([name, amt]) => ({ name, std: Math.round(+amt || 0), disc: 0, recv: Math.round(+amt || 0) }));

  /* ── LATE FINE ki alag line ──
     Backend fine ko ledger me persist nahi karta, is liye detailRows me nahi
     aati. Jo fine is receiving me li gayi wo `payment.fine` me hai; na ho to
     amount aur heads ke farq se nikaal lo — warna slip par "Amount Received"
     heads ke Total se zyada dikhta hai aur parent ko wajah samajh nahi aati.
     Agar challan me pehle se Late Fine row maujood ho to dobara na jodo. */
  const fineAlready = baseRows.some(r => {
    const n = String(r.name).trim().toLowerCase();
    return n === 'late fine' || n === 'fine';
  });
  const baseRecv  = baseRows.reduce((a, r) => a + r.recv, 0);
  const slipFine  = Math.max(0, Math.round(+payment.fine || 0) || (Math.round(+payment.amount || 0) - baseRecv));
  const headRows  = (!fineAlready && slipFine > 0)
    ? [...baseRows, { name: 'Fine', std: slipFine, disc: 0, recv: slipFine }]
    : baseRows;
  const totStd  = headRows.reduce((a, r) => a + r.std, 0);
  const totDisc = headRows.reduce((a, r) => a + r.disc, 0);
  const total   = headRows.reduce((a, r) => a + r.recv, 0);
  /* Baqaya = (Std − Discount) − Received. > 0 → abhi dena baqaya (baqaya, red);
     < 0 → student ne zyada de diya = ADVANCE/credit (minus me, green). 0 → line nahi. */
  const remaining = (totStd - totDisc) - total;
  const sch      = feeReportSchool(cfg.school);

  const doPrint = () => {
    const w = window.open('', '_blank');
    if (!w) { toast('Please allow pop-ups to download the slip', 'error'); return; }
    const slipHtml = `
      <div class="fee-slip-doc fee-slip-${size}">
        <div class="fee-slip-head">
          <div class="fee-slip-school">${escHtml(sch.name)}</div>
          ${sch.address ? `<div class="fee-slip-addr" style="font-size:11px;color:#555;margin-top:2px;">${escHtml(sch.address)}</div>` : ''}
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
          <thead><tr><th>Head</th><th>Std. Amount</th><th>Discount</th><th>Received</th></tr></thead>
          <tbody>
            ${headRows.map(r => `<tr><td>${escHtml(headLabel(r.name))}</td><td>${r.std.toLocaleString('en-PK')}</td><td>${r.disc ? r.disc.toLocaleString('en-PK') : '—'}</td><td>${r.recv.toLocaleString('en-PK')}</td></tr>`).join('')}
            <tr class="fee-slip-headtot"><td>Total</td><td>${totStd.toLocaleString('en-PK')}</td><td>${totDisc ? totDisc.toLocaleString('en-PK') : '—'}</td><td>${total.toLocaleString('en-PK')}</td></tr>
          </tbody>
        </table>
        <div class="fee-slip-net">
          <span>Amount Received</span><span>Rs. ${(+payment.amount || 0).toLocaleString('en-PK')}</span>
        </div>
        ${remaining !== 0 ? `<div class="fee-slip-rem${remaining < 0 ? ' adv' : ''}"><span>${remaining < 0 ? 'Advance Balance' : 'Remaining Amount'}</span><span>Rs. ${remaining.toLocaleString('en-PK')}</span></div>` : ''}
      </div>`;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fee Slip — ${escHtml(student.name)}</title>
<style>
  html,body,* { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; color-adjust:exact !important; }
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
  .fee-slip-rem { display:flex; justify-content:space-between; align-items:center; border:1.5px solid #DC2626; color:#DC2626; padding:7px 12px; border-radius:4px; font-weight:800; margin-top:6px; }
  .fee-slip-rem.adv { border-color:#16A34A; color:#16A34A; }
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
              <div className="fee-slip-school">{sch.name}</div>
              {sch.address && <div className="fee-slip-addr" style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{sch.address}</div>}
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
                <tr><th>Head</th><th>Std. Amount</th><th>Discount</th><th>Received</th></tr>
              </thead>
              <tbody>
                {headRows.map(r => (
                  <tr key={r.name}><td>{r.name}</td><td>{r.std.toLocaleString('en-PK')}</td><td>{r.disc ? r.disc.toLocaleString('en-PK') : '—'}</td><td>{r.recv.toLocaleString('en-PK')}</td></tr>
                ))}
                <tr className="fee-slip-headtot"><td>Total</td><td>{totStd.toLocaleString('en-PK')}</td><td>{totDisc ? totDisc.toLocaleString('en-PK') : '—'}</td><td>{total.toLocaleString('en-PK')}</td></tr>
              </tbody>
            </table>
            <div className="fee-slip-net">
              <span>Amount Received</span>
              <span>Rs. {(+payment.amount || 0).toLocaleString('en-PK')}</span>
            </div>
            {remaining !== 0 && (
              <div className="fee-slip-rem" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1.5px solid ${remaining < 0 ? '#16A34A' : '#DC2626'}`, color: remaining < 0 ? '#16A34A' : '#DC2626', padding: '7px 12px', borderRadius: 4, fontWeight: 800, marginTop: 6 }}>
                <span>{remaining < 0 ? 'Advance Balance' : 'Remaining Amount'}</span>
                <span>Rs. {remaining.toLocaleString('en-PK')}</span>
              </div>
            )}
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
function recStudentModel({ student, headsForClass, generated, classDisc, payments, challan = null }) {
  let heads, prev, advance, thisMonth, disc;
  /* Previous-dues row ka ASLI subHead (e.g. "Previous Pending") aur uske khilaf ab tak
     wasool hui raqam — receiving modal me us par bhi amount likhi ja sake, aur payment
     sahi detailRow par map ho (API perHead ko subHead se match karta hai). */
  let prevName = '', prevPaid = 0;
  if (challan && Array.isArray(challan.detailRows)) {
    /* Real challan: build heads from its detailRows. A "previous pending" head
       becomes previous dues (positive) or advance (negative); the rest are the
       current-month fee heads. Mirrors the Challans screen split. */
    heads = [];
    prev = 0; advance = 0;
    challan.detailRows.forEach(r => {
      const amt   = +r.challanAmount || 0;
      const d     = +r.discount || 0;
      const label = String(r.subHead || r.head || '').toLowerCase();
      if (/previous|pending|arrear/.test(label)) {
        if (amt >= 0) {
          prev += amt;
          if (!prevName) prevName = r.subHead || r.head || '';
          prevPaid += (+r.receivedAmount || 0);
        } else advance += Math.abs(amt);
      } else if (feeService.isLateFineRow(r)) {
        /* Late Fine ko aam fee head na banao — receiving modal ki apni LATE FINE
           line ise alag se dikhati hai (aur `finePaid` isi row se parhti hai).
           Head bana dene se wo persisted row DOBARA render hoti thi: modal me do
           "Late Fine" qatarein, aur thisMonth/payable me fine dohri gin'ti. */
      } else {
        heads.push({ name: r.subHead || r.head || '', std: amt, disc: Math.min(d, amt), net: amt - Math.min(d, amt) });
      }
    });
    thisMonth = heads.reduce((a, h) => a + h.std, 0);
    disc      = heads.reduce((a, h) => a + h.disc, 0);
  } else {
    heads = (headsForClass || []).map(h => {
      const std = +h.amt || 0;
      const d   = +(classDisc?.[h.name]) || 0;
      return { name: h.name, std, disc: Math.min(d, std), net: std - Math.min(d, std) };
    });
    prev      = +student.dues || 0;
    advance   = +student.advance || 0;
    thisMonth = generated ? heads.reduce((a, h) => a + h.std, 0) : 0;
    disc      = generated ? heads.reduce((a, h) => a + h.disc, 0) : 0;
  }
  /* Ledger par bill ho chuki LATE FINE. `heads` me ye shamil nahi (receiving modal
     usay apni alag line me dikhata hai), magar `paid` niche saari detailRows se
     banta hai — yani fine ki wasooli us me aati hai. Is liye fine ko payable me
     bhi jodna zaroori hai, warna dono taraf bay-mail ho jaati thi: 12,000 payable
     magar 12,400 paid → Remaining −400 (poora receive karne ke bawajood). */
  const billedFine = (challan && Array.isArray(challan.detailRows))
    ? challan.detailRows.filter(feeService.isLateFineRow)
        .reduce((a, r) => a + (+r.challanAmount || 0), 0)
    : 0;
  const payable   = Math.max(0, prev + thisMonth - disc - advance) + billedFine;
  /* Paid must survive a page refresh. The local `payments` array is session-only
     (getReceipts is mock), so when a real challan exists take the authoritative
     received total straight from its detailRows' receivedAmount. Math.max keeps
     the figure correct in the brief window after a payment, before loadChallans
     re-fetches the updated challan. */
  const paidFromChallan  = (challan && Array.isArray(challan.detailRows))
    ? challan.detailRows.reduce((a, r) => a + (+r.receivedAmount || 0), 0)
    : 0;
  const paidFromPayments = (payments || []).reduce((a, p) => a + (+p.amount || 0), 0);
  const paid      = challan ? Math.max(paidFromChallan, paidFromPayments) : paidFromPayments;
  const remaining = payable - paid;   /* MINUS = advance (total se zyada wasool) */
  let status = 'none';
  if (generated && paid > 0) status = remaining <= 0 ? 'full' : 'partial';
  /* Only payments explicitly tagged as OneLink/bank-pull are protected
     from manual deletion. A "Bank Transfer" entered at the counter
     stays deletable — same as the HTML reference (which keys off the
     `source` field, not the method). */
  const onelink = (payments || []).some(p => p.source === 'onelink' || p.source === 'bank');
  /* Per-head ab tak wasool hui raqam (challan ke receivedAmount se) — Bulk modal isi se
     "Already Received" aur seeding nikaalta hai, warna paid heads dobara seed ho jate the. */
  const paidPerHead = {};
  if (challan && Array.isArray(challan.detailRows)) {
    challan.detailRows.forEach(r => {
      const n = r.subHead || r.head || '';
      paidPerHead[n] = (paidPerHead[n] || 0) + (+r.receivedAmount || 0);
    });
  }
  return { heads, generated, prev, prevName, prevPaid, paidPerHead, advance, thisMonth, disc, payable, paid, remaining, status, onelink };
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
  const { can } = usePermissions();
  const canRcvCreate   = can('Fee', 'Fee Receiving', 'Create');
  const canRcvDelete   = can('Fee', 'Fee Receiving', 'Delete');
  const canRcvDownload = can('Fee', 'Fee Receiving', 'Download');
  const { data: classes = [] }      = useAsync(feeService.getFeeClasses, []);
  const { data: studentsMap = {} }  = useAsync(feeService.getTransportFee, []);
  const { data: headsMap = {} }     = useAsync(feeService.getFeeHeads, []);
  const { data: settings = {} }     = useAsync(feeService.getFeeSettings, []);
  const { data: serverReceipts = [] } = useAsync(feeService.getReceipts, []);
  /* Branch header (name / address / logo / date) for the received-fee slip. */
  const { data: branchHeader = null } = useAsync(feeService.getReportHeader, [], null);

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

  /* Generated challans loaded live from /api/BranchLedger/get-by-month for the
     applied month/year — genSet marks which class|reg|month challans exist and
     challanMap holds the full record (detailRows) so payable/heads come from
     real data. */
  const [genSet, setGenSet] = useState(null);
  const [challanMap, setChallanMap] = useState({});
  const monthIdx = FEE_MONTHS.indexOf(appliedMonth);
  const keyOf    = (classKey, reg) => `${classKey}|${reg}|${monthIdx}`;

  const loadChallans = useCallback(async () => {
    if (!studentsMap || Object.keys(studentsMap).length === 0) return;
    const mIdx = FEE_MONTHS.indexOf(appliedMonth);
    try {
      const rows = await feeService.getMonthChallans(mIdx + 1, appliedYear);
      const byStudentId = new Map();
      Object.entries(studentsMap).forEach(([ck, studs]) => {
        (studs || []).forEach(s => byStudentId.set(String(s.studentID), { classKey: ck, reg: s.reg }));
      });
      const set = new Set();
      const map = {};
      rows.forEach(ch => {
        const loc = byStudentId.get(String(ch.studentID));
        const classKey = loc ? loc.classKey : `g${ch.gradeID}-s${ch.sectionID}`;
        const reg      = loc ? loc.reg      : String(ch.registrationNumber || '');
        const k = `${classKey}|${reg}|${mIdx}`;
        set.add(k);
        map[k] = ch;
      });
      setGenSet(set);
      setChallanMap(map);
    } catch (e) {
      toast(e.message || 'Could not load challans', 'error');
      setGenSet(new Set());
      setChallanMap({});
    }
  }, [studentsMap, appliedMonth, appliedYear, toast]);

  useEffect(() => { loadChallans(); }, [loadChallans]);

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
      challan: generated ? (challanMap[keyOf(c.key, s.reg)] || null) : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genSet, headsMap, paymentsFor, challanMap]);

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
    /* A locked month can still be viewed — only taking money is barred. */
    const lock = viewOnly ? null : challanMonthLock(monthIdx, appliedYear, settings);
    if (lock) { toast(lock, 'warning'); return; }
    const m = modelFor(c, s);
    if (!m.generated) { toast(`Challan not generated for ${s.name} in ${appliedMonth}`, 'warning'); return; }
    setReceiveCtx({
      classMeta: c, student: s, model: m,
      payments: paymentsFor(c.key, s.reg),
      challan:  challanMap[keyOf(c.key, s.reg)] || null,
      period:   `${appliedMonth} ${appliedYear}`,
      monthIdx,
      viewOnly,
      settings,
    });
  };

  /* Open the receipt slip. Prefer the latest session payment; if there is none
     (e.g. after a page refresh — the local receipts are session-only), rebuild
     the payment from the challan's persisted receivedAmount so the slip still
     opens for an already-received fee. */
  const openReceiptSlip = (c, s) => {
    const payments = paymentsFor(c.key, s.reg);
    const last = payments[payments.length - 1];
    if (last) {
      setSlipCtx({ classMeta: c, student: s, period: `${appliedMonth} ${appliedYear}`, payment: last, challan: challanMap[keyOf(c.key, s.reg)], defaultSize: settings.printSize || 'a4', school: branchHeader });
      return;
    }
    const rec  = challanMap[keyOf(c.key, s.reg)];
    const rows = rec && Array.isArray(rec.detailRows) ? rec.detailRows : [];
    const received = rows.reduce((a, r) => a + (+r.receivedAmount || 0), 0);
    if (received <= 0) { toast('No payment recorded for this student yet', 'info'); return; }
    const perHead = {};
    rows.forEach(r => { const n = r.subHead || r.head || ''; perHead[n] = (perHead[n] || 0) + (+r.receivedAmount || 0); });
    setSlipCtx({
      classMeta: c, student: s, period: `${appliedMonth} ${appliedYear}`,
      payment: {
        date:   String(rec.modifiedAt || rec.dateofCreattion || '').slice(0, 10),
        method: rec.paymentMethod || 'Cash', ref: '', txn: '', amount: received, perHead,
      },
      challan: rec,
      defaultSize: settings.printSize || 'a4', school: branchHeader,
    });
  };

  const handleSaveReceipt = (payload) => {
    /* Amount MINUS bhi ho sakta hai — cashier ne already-received ko neeche theek
       kiya (adjustment). Sirf 0 (kuch nahi badla) rokna hai. */
    if (!Number(payload.amount)) {
      toast('Receiving amount must not be zero', 'warning');
      return;
    }
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
        /* Late fine slip par apni line banati hai; `amount` me pehle se shaamil hai. */
        fine:   payload.fine || 0,
        /* Correction (minus amount) — history/slip ise adjustment likhein. */
        isAdjustment: !!payload.isAdjustment,
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

    /* POST to /api/BranchLedger/receive-payment. ledgerId is the challan id;
       each detailRow carries the running receivedAmount + pendingorAdv. The
       per-head amounts entered now are matched to detailRows by subHead.
       Is receiving me li gayi late fine bhi apni "Late Fine" row ki soorat me
       jaati hai — warna wasool shuda fine ledger me kahin record na hoti. */
    const rec = challanMap[keyOf(payload.classKey, payload.reg)];
    /* Slip ko is receiving ke BAAD ka challan chahiye — usi se wo per-head
       Std/Discount/Received aur "Remaining Amount" nikaalti hai. Warna fallback
       chalta hai (std = recv = jo pay kiya) aur remaining hamesha 0 aati hai. */
    let slipChallan = rec || null;
    if (rec && rec.id) {
      const userID = Number(sessionStorage.getItem('UserID')) || 0;
      const now    = new Date().toISOString();
      const baseRows = (rec.detailRows || []).map(r => {
        /* Fine ki row perHead se update nahi hoti — usay helper handle karta hai. */
        if (feeService.isLateFineRow(r)) return r;
        /* Delta MINUS ho sakta hai jab cashier ne already-received theek kiya.
           Ledger 0 se neeche kabhi nahi jaata (koi refund ledger yahan nahi hai). */
        const recvNow  = +(payload.perHead?.[r.subHead ?? r.head]) || 0;
        const received = Math.max(0, (+r.receivedAmount || 0) + recvNow);
        const net      = (+r.challanAmount || 0) - (+r.discount || 0);
        return { ...r, receivedAmount: received, pendingorAdv: net - received, modifiedAt: now, modifiedBy: userID };
      });
      const detailRows = feeService.withLateFineRow(baseRows, payload.fine, {
        /* Branch challan ke apne record se — API dono spellings me deti hai. */
        ledgerId: rec.id, branchId: rec.branchID ?? rec.branchId, userId: userID, now,
      });
      feeService.receivePayment({
        ledgerId:      rec.id,
        paymentMethod: payload.method || '',
        modifiedBy:    userID,
        detailRows,
      })
        .then(() => loadChallans())
        .catch(e => toast(e.message || 'Could not record payment', 'error'));
      slipChallan = { ...rec, detailRows };
    } else {
      toast('No challan found to receive against', 'warning');
    }
    toast(payload.amount < 0
      ? `Received amount for ${payload.studentName} reduced by Rs. ${Math.abs(payload.amount).toLocaleString('en-PK')}`
      : `Rs. ${(payload.amount || 0).toLocaleString('en-PK')} received from ${payload.studentName}`, 'success');
    /* After save: close receive modal and open slip modal for the new payment */
    const c = receiveCtx?.classMeta, s = receiveCtx?.student;
    setReceiveCtx(null);
    if (c && s) {
      setSlipCtx({
        classMeta: c, student: s, period: receiveCtx.period,
        payment: {
          date: payload.date, method: payload.method, ref: payload.ref, txn: payload.txn,
          amount: payload.amount, perHead: payload.perHead, fine: payload.fine || 0,
        },
        challan: slipChallan,
        defaultSize: settings.printSize || 'a4',
        school: branchHeader,
      });
    }
  };

  /* Reverse this student's receiving via /api/BranchLedger/delete-receiving —
     the challan stays and its heads go back to unpaid. `challanMap` already
     holds the month's record, so its id is the ledgerId to delete. */
  const requestDeleteReceipt = (c, s) => {
    const rec = challanMap[keyOf(c.key, s.reg)];
    setConfirm({
      title:   'Delete received fee?',
      message: <span>The manually received payment(s) for <strong>{s.name}</strong> will be removed.</span>,
      hint:    'The challan stays — only the receiving is reversed. OneLink / Bank payments cannot be deleted from here.',
      onConfirm: async () => {
        if (!rec?.id) {
          toast(`No ${appliedMonth} ${appliedYear} challan found for ${s.name}`, 'warning');
          return;
        }
        try {
          await feeService.deleteReceiving(rec.id);
          setReceipts(prev => (prev || []).map(r => (
            r.classKey === c.key && r.reg === s.reg && r.monthIdx === monthIdx
              ? { ...r, payments: r.payments.filter(p => p.source === 'onelink' || p.source === 'bank') }
              : r
          )));
          await loadChallans();
          toast('Receipt deleted', 'success');
        } catch (e) {
          toast(e.message || 'Could not delete receipt', 'error');
        }
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
                <i className="fa-solid fa-filter"></i> Fetch Details 
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
                          <th className="fee-right">Previous Pending</th>
                          <th className="fee-right">Advance</th>
                          <th className="fee-right">This Month</th>
                          <th className="fee-center">Discount</th>
                          {/* Due date guzar chuki ho to is student par banti late fine. */}
                          <th className="fee-right">Fine</th>
                          <th className="fee-right">Received</th>
                          <th className="fee-right">Remaining</th>
                          <th className="fee-center">Status</th>
                          <th className="fee-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.length === 0 ? (
                          <tr><td colSpan="11" className="fee-stbl-empty">No students in this section.</td></tr>
                        ) : students.map(s => {
                          const m = modelFor(c, s);
                          const rec  = m.generated ? (challanMap[keyOf(c.key, s.reg)] || null) : null;
                          /* Column me sirf wasool shuda fine — na li gayi ho to 0. */
                          const shownFine = receivedFineOf(rec);
                          return (
                            <tr key={s.reg} id={`rec-st-${c.key}-${s.reg}`}>
                              <td>{s.reg}</td>
                              <td>
                                <b>{s.name}</b>
                                <span className="fee-sub-eq">SO/DO {s.father || '—'}</span>
                              </td>
                              <td className="fee-right">{money(m.prev)}</td>
                              {/* Advance (student ka credit) — MINUS me, taake dikhe ki
                                  Remaining/Received me se kitna khud kat gaya. */}
                              <td className={`fee-right${m.advance > 0 ? ' fee-neg' : ''}`}>
                                {money(m.advance > 0 ? -m.advance : 0)}
                              </td>
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
                              <td className={`fee-right${shownFine > 0 ? ' fee-fine' : ''}`}>{shownFine > 0 ? money(shownFine) : '0'}</td>
                              <td className="fee-right">{m.paid > 0 ? <span className="fee-paid-amt">{money(m.paid)}</span> : '0'}</td>
                              {/* Remaining me PROJECTED late fine NAHI jodte — jab tak fee
                                  receive na ho, sirf asal fee/baqaya dikhe. Fine sirf
                                  receive karte waqt calculate hoti hai (modal me), aur bill
                                  hone ke baad wo m.remaining me khud shamil ho jaati hai. */}
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
                                      canRcvCreate && (
                                      <Tooltip text="Open receive form for this student">
                                        <button type="button" className="fee-recv-link" onClick={() => openReceive(c, s, false)}>
                                          Fee Receive <i className="fa-solid fa-eye"></i>
                                        </button>
                                      </Tooltip>
                                      )
                                    ) : (
                                      <>
                                        {/* Sirf PARTIAL par — fully received row edit nahi hoti. */}
                                        {m.status === 'partial' && canRcvCreate && (
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
                                        {canRcvDownload && (
                                        <Tooltip text="Download receipt slip">
                                          <button className="fee-iconbtn tiny" onClick={() => openReceiptSlip(c, s)}>
                                            <i className="fa-solid fa-download"></i>
                                          </button>
                                        </Tooltip>
                                        )}
                                        {!m.onelink && canRcvDelete && (
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
  if (prev > 0)      heads.push({ name: 'Previous Pending',  std: prev,      disc: 0,        net: prev });
  heads.push({ name: 'Tuition Fee', std: fee, disc: discount, net: fee - discount });
  if (transport > 0) heads.push({ name: 'Transport Fees', std: transport, disc: 0, net: transport });
  const thisMonth = fee + transport;
  const disc      = discount;
  const payable   = Math.max(0, prev + thisMonth - disc - advance);
  const paid      = (payments || []).reduce((a, p) => a + (+p.amount || 0), 0);
  const remaining = payable - paid;   /* MINUS = advance (total se zyada wasool) */
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

  /* Ledger record (challan id + detailRows) per child, keyed by `${famKey}|${reg}`.
     Filled when a receive/bulk modal is opened; used to POST receive-payment. */
  const ledgerRecRef = useRef({});

  /* Preload every child's real challan (with detailRows/receivedAmount) so each
     child's received status + amounts survive a page refresh — exactly like the
     Individual tab. One /get-by-month call, matched to children by studentID. */
  const [challanByStudent, setChallanByStudent] = useState({});
  const loadFamilyChallans = useCallback(async () => {
    const mIdx = FEE_MONTHS.indexOf(appliedMonth);
    try {
      const rows = await feeService.getMonthChallans(mIdx + 1, appliedYear);
      const map = {};
      rows.forEach(ch => { map[String(ch.studentID)] = ch; });
      setChallanByStudent(map);
    } catch { setChallanByStudent({}); }
  }, [appliedMonth, appliedYear]);
  useEffect(() => { loadFamilyChallans(); }, [loadFamilyChallans]);

  const modelFor = useCallback((ch, famKey) => {
    const payments = paymentsFor(famKey, ch.reg);
    /* Real challan present → build heads from its detailRows so head names
       match the ledger (receive-payment matches perHead by subHead/head), and
       paid is read from receivedAmount (persists on refresh). */
    const challan = ch._challan || challanByStudent[String(ch.applicantsID)] || null;
    if (challan && Array.isArray(challan.detailRows)) {
      return recStudentModel({ student: ch, generated: true, payments, challan });
    }
    return childRecModel({ child: ch, payments });
  }, [paymentsFor, challanByStudent]);

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

  const openReceive = async (f, ch, viewOnly = false) => {
    /* A locked month can still be viewed — only taking money is barred. */
    const lock = viewOnly ? null : challanMonthLock(monthIdx, appliedYear, settings);
    if (lock) { toast(lock, 'warning'); return; }
    /* Child ki asli receivable /api/BranchLedger/get-all se laa kar enrich karo,
       phir uska model bana kar receiving modal kholo. */
    let child = ch;
    if (ch.applicantsID != null) {
      try {
        const rows = await feeService.getStudentChallans(ch.applicantsID, monthIdx + 1, appliedYear);
        const rec  = Array.isArray(rows) && rows.length ? rows[0] : null;
        if (rec) {
          const fig = familyChildFigures(rec);
          child = {
            ...ch,
            fee:       fig.fee,
            transport: fig.transport,
            discount:  fig.discount,
            dues:      fig.dues,
            advance:   fig.advance,
            _ledgerId: rec.id,
            _challan:  rec,
          };
          ledgerRecRef.current[`${f.key}|${ch.reg}`] = rec;
          /* keep the list's preloaded map fresh too */
          if (ch.applicantsID != null) setChallanByStudent(prev => ({ ...prev, [String(ch.applicantsID)]: rec }));
        }
      } catch (e) { /* keep original child on failure */ }
    }
    const m = modelFor(child, f.key);
    setReceiveCtx({
      kind: 'child',
      famKey: f.key, family: f,
      classMeta: { key: f.key, cls: child.cls, sec: child.sec, familyName: f.name, guardian: f.guardian },
      student: child, model: m,
      payments: paymentsFor(f.key, child.reg),
      challan:  child._challan || null,
      period:   `${appliedMonth} ${appliedYear}`,
      monthIdx,
      viewOnly,
      settings,
    });
  };

  /* Open a child's receipt slip — prefer the latest session payment; otherwise
     rebuild it from the child's persisted challan receivedAmount (survives a
     refresh, since the local receipts are session-only). */
  const openReceiptSlip = (f, ch) => {
    const payments = paymentsFor(f.key, ch.reg);
    const last = payments[payments.length - 1];
    if (last) {
      setSlipCtx({ classMeta: { key: f.key, cls: ch.cls, sec: ch.sec }, student: ch, period: `${appliedMonth} ${appliedYear}`, payment: last, challan: ch._challan || challanByStudent[String(ch.applicantsID)], defaultSize: settings.printSize || 'a4' });
      return;
    }
    const rec  = ch._challan || challanByStudent[String(ch.applicantsID)];
    const rows = rec && Array.isArray(rec.detailRows) ? rec.detailRows : [];
    const received = rows.reduce((a, r) => a + (+r.receivedAmount || 0), 0);
    if (received <= 0) { toast('No payment recorded for this student yet', 'info'); return; }
    const perHead = {};
    rows.forEach(r => { const n = r.subHead || r.head || ''; perHead[n] = (perHead[n] || 0) + (+r.receivedAmount || 0); });
    setSlipCtx({
      classMeta: { key: f.key, cls: ch.cls, sec: ch.sec }, student: ch,
      period: `${appliedMonth} ${appliedYear}`,
      payment: {
        date:   String(rec.modifiedAt || rec.dateofCreattion || '').slice(0, 10),
        method: rec.paymentMethod || 'Cash', ref: '', txn: '', amount: received, perHead,
      },
      challan: rec,
      defaultSize: settings.printSize || 'a4',
    });
  };

  const handleSaveReceipt = (payload) => {
    /* Amount MINUS bhi ho sakta hai — cashier ne already-received ko neeche theek
       kiya (adjustment). Sirf 0 (kuch nahi badla) rokna hai. */
    if (!Number(payload.amount)) {
      toast('Receiving amount must not be zero', 'warning');
      return;
    }
    setReceipts(prev => {
      const next = [...(prev || [])];
      const idx  = next.findIndex(r => r.famKey === payload.famKey && r.reg === payload.reg && r.monthIdx === payload.monthIdx);
      const pay  = {
        id: `frcv-${Date.now()}`,
        date: payload.date, time: payload.time || nowHHMM(),
        method: payload.method, ref: payload.ref, txn: payload.txn,
        amount: payload.amount, perHead: payload.perHead,
        /* Late fine slip par apni line banati hai; `amount` me pehle se shaamil hai. */
        fine: payload.fine || 0,
        /* Correction (minus amount) — history/slip ise adjustment likhein. */
        isAdjustment: !!payload.isAdjustment,
        source: 'counter', by: payload.by || 'Front Desk',
      };
      if (idx >= 0) next[idx] = { ...next[idx], payments: [...next[idx].payments, pay] };
      else          next.push({ famKey: payload.famKey, reg: payload.reg, monthIdx: payload.monthIdx, payments: [pay] });
      return next;
    });

    /* POST to /api/BranchLedger/receive-payment. ledgerId = the child challan id;
       each detailRow carries the running receivedAmount + pendingorAdv. The
       per-head amounts entered now are matched to detailRows by subHead/head.
       Is receiving me li gayi late fine bhi apni "Late Fine" row ki soorat me
       jaati hai — warna wasool shuda fine ledger me kahin record na hoti. */
    const rec = ledgerRecRef.current[`${payload.famKey}|${payload.reg}`];
    /* Slip ko is receiving ke BAAD ka challan chahiye — warna wo fallback par
       chali jaati hai (std = recv) aur "Remaining Amount" kabhi nahi dikhti. */
    let slipChallan = rec || null;
    if (rec && rec.id) {
      const userID = Number(sessionStorage.getItem('UserID')) || 0;
      const now    = new Date().toISOString();
      const baseRows = (rec.detailRows || []).map(r => {
        /* Fine ki row perHead se update nahi hoti — usay helper handle karta hai. */
        if (feeService.isLateFineRow(r)) return r;
        /* Delta MINUS ho sakta hai jab cashier ne already-received theek kiya.
           Ledger 0 se neeche kabhi nahi jaata (koi refund ledger yahan nahi hai). */
        const recvNow  = +(payload.perHead?.[r.subHead ?? r.head]) || 0;
        const received = Math.max(0, (+r.receivedAmount || 0) + recvNow);
        const net      = (+r.challanAmount || 0) - (+r.discount || 0);
        return { ...r, receivedAmount: received, pendingorAdv: net - received, modifiedAt: now, modifiedBy: userID };
      });
      const detailRows = feeService.withLateFineRow(baseRows, payload.fine, {
        /* Branch challan ke apne record se — API dono spellings me deti hai. */
        ledgerId: rec.id, branchId: rec.branchID ?? rec.branchId, userId: userID, now,
      });
      feeService.receivePayment({
        ledgerId:      rec.id,
        paymentMethod: payload.method || '',
        modifiedBy:    userID,
        detailRows,
      })
        .then(() => loadFamilyChallans())   // refresh list so status persists
        .catch(e => toast(e.message || 'Could not record payment', 'error'));
      slipChallan = { ...rec, detailRows };
    } else {
      toast('No challan found to receive against', 'warning');
    }

    feeService.saveFamilyReceipt(payload).catch(() => {});
    toast(payload.amount < 0
      ? `Received amount for ${payload.studentName} reduced by Rs. ${Math.abs(payload.amount).toLocaleString('en-PK')}`
      : `Rs. ${(payload.amount || 0).toLocaleString('en-PK')} received from ${payload.studentName}`, 'success');
    const f = receiveCtx?.family, ch = receiveCtx?.student;
    const period = receiveCtx?.period;
    setReceiveCtx(null);
    if (f && ch) {
      setSlipCtx({
        classMeta: { key: f.key, cls: ch.cls, sec: ch.sec }, student: ch,
        period,
        payment: {
          date: payload.date, method: payload.method, ref: payload.ref, txn: payload.txn,
          amount: payload.amount, perHead: payload.perHead, fine: payload.fine || 0,
        },
        challan: slipChallan,
        defaultSize: settings.printSize || 'a4',
      });
    }
  };

  /* One child's ledger id for the applied month — from the row's own challan,
     the preloaded get-by-month map, or whatever openReceive last cached. */
  const childLedgerId = useCallback((f, ch) => (
    ch._challan?.id
    || challanByStudent[String(ch.applicantsID)]?.id
    || ledgerRecRef.current[`${f.key}|${ch.reg}`]?.id
    || null
  ), [challanByStudent]);

  const requestDeleteReceipt = (f, ch) => {
    const ledgerId = childLedgerId(f, ch);
    setConfirm({
      title:   'Delete received fee?',
      message: <span>The manually received payment(s) for <strong>{ch.name}</strong> will be removed.</span>,
      hint:    'The challan stays — only the receiving is reversed. OneLink / Bank payments cannot be deleted from here.',
      onConfirm: async () => {
        if (!ledgerId) {
          toast(`No ${appliedMonth} ${appliedYear} challan found for ${ch.name}`, 'warning');
          return;
        }
        try {
          await feeService.deleteReceiving(ledgerId);
          setReceipts(prev => (prev || []).map(r => (
            r.famKey === f.key && r.reg === ch.reg && r.monthIdx === monthIdx
              ? { ...r, payments: r.payments.filter(p => p.source === 'onelink' || p.source === 'bank') }
              : r
          )));
          await loadFamilyChallans();
          toast('Receipt deleted', 'success');
        } catch (e) {
          toast(e.message || 'Could not delete receipt', 'error');
        }
      },
    });
  };

  /* Reverse the whole family's receiving — one
     /api/BranchLedger/delete-receiving/{ledgerId} call per child. The challans
     survive, so the family stays listed with its dues restored. */
  const requestDeleteFamily = (f) => {
    const children = f.children || [];
    const targets  = children.filter(ch => childLedgerId(f, ch));
    setConfirm({
      title:   'Delete family record?',
      message: <span>Every manually received payment for <strong>{f.name}</strong> will be reversed.</span>,
      hint:    `The ${appliedMonth} ${appliedYear} receiving of each child (${targets.length}) will be deleted. The challans stay — only the payments are undone.`,
      confirmLabel: 'Yes, Delete',
      icon:    'fa-people-roof',
      onConfirm: async () => {
        if (!targets.length) {
          toast(`No ${appliedMonth} ${appliedYear} challans found for this family`, 'warning');
          return;
        }
        let deleted = 0, failed = 0;
        for (const ch of targets) {
          try {
            await feeService.deleteReceiving(childLedgerId(f, ch));
            deleted++;
          } catch (e) {
            failed++;
          }
        }
        setReceipts(prev => (prev || []).map(r => (
          r.famKey === f.key && r.monthIdx === monthIdx
            ? { ...r, payments: r.payments.filter(p => p.source === 'onelink' || p.source === 'bank') }
            : r
        )));
        await loadFamilyChallans();
        if (failed) {
          toast(`${deleted} receiving deleted, ${failed} failed`, deleted ? 'warning' : 'error');
        } else {
          toast(`Family receiving deleted — ${deleted} child${deleted === 1 ? '' : 'ren'}`, 'success');
        }
      },
    });
  };

  /* Bulk receiving: har child ke against /api/BranchLedger/get-all hit karke
     (getStudentChallans) uski asli receivable (fee/transport/discount/dues/
     advance) laa kar children ko enrich karo, phir bulk modal kholo. */
  const openBulk = async (f) => {
    const lock = challanMonthLock(monthIdx, appliedYear, settings);
    if (lock) { toast(lock, 'warning'); return; }
    const children = f.children || [];
    toast('Loading receivables…', 'info');
    const enriched = await Promise.all(children.map(async (ch) => {
      if (ch.applicantsID == null) return ch;
      try {
        const rows = await feeService.getStudentChallans(ch.applicantsID, monthIdx + 1, appliedYear);
        const rec  = Array.isArray(rows) && rows.length ? rows[0] : null;
        if (!rec) return ch;
        ledgerRecRef.current[`${f.key}|${ch.reg}`] = rec;
        const fig = familyChildFigures(rec);
        return {
          ...ch,
          fee:       fig.fee,
          transport: fig.transport,
          discount:  fig.discount,
          dues:      fig.dues,
          advance:   fig.advance,
          _ledgerId: rec.id,
          _challan:  rec,
        };
      } catch (e) {
        return ch;
      }
    }));
    setBulkCtx({ family: { ...f, children: enriched }, period: `${appliedMonth} ${appliedYear}`, monthIdx });
  };

  const downloadFamilySlip = (f) => {
    /* Enrich each child with real figures (payable) and received amount from the
       preloaded challan, so the slip shows actual data — the session receipts are
       empty on refresh. A single synthetic payment carries the cumulative
       received total (the challan stores receivedAmount, not per-transaction). */
    const enriched = (f.children || []).map(ch => {
      const rec = ch._challan || challanByStudent[String(ch.applicantsID)] || null;
      if (!rec || !Array.isArray(rec.detailRows)) return ch;
      const fig      = familyChildFigures(rec);
      const received = rec.detailRows.reduce((a, r) => a + (+r.receivedAmount || 0), 0);
      const perHead  = {};
      rec.detailRows.forEach(r => { const n = r.subHead || r.head || ''; perHead[n] = (perHead[n] || 0) + (+r.receivedAmount || 0); });
      const _payments = received > 0 ? [{
        amount: received,
        date:   String(rec.modifiedAt || rec.dateofCreattion || '').slice(0, 10),
        method: rec.paymentMethod || 'Cash', ref: '', txn: '', source: 'counter', perHead,
      }] : [];
      return { ...ch, ...fig, _challan: rec, _payments };
    });
    setFamilySlipCtx({ family: { ...f, children: enriched }, period: `${appliedMonth} ${appliedYear}`, defaultSize: settings.printSize || 'a4' });
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
          let totPayable = 0, totPaid = 0, totRem = 0, totFine = 0;
          (f.children || []).forEach(ch => {
            const m    = modelFor(ch, f.key);
            const rec  = ch._challan || challanByStudent[String(ch.applicantsID)] || null;
            /* Projected fine ko total me NAHI jodte — fee receive hone par bill hui
               fine m.payable/m.remaining me khud aa jaati hai. */
            /* Fine column ka total — sirf wasool shuda fine. */
            totFine    += receivedFineOf(rec);
            totPayable += m.payable;
            totPaid    += m.paid;
            totRem     += m.remaining;
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
                          {/* Due date guzar chuki ho to is bachche par banti late fine. */}
                          <th className="fee-right">Fine</th>
                          <th className="fee-right">Received</th>
                          <th className="fee-right">Remaining</th>
                          <th className="fee-center">Status</th>
                          <th className="fee-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(f.children || []).map(ch => {
                          const m = modelFor(ch, f.key);
                          const rec  = ch._challan || challanByStudent[String(ch.applicantsID)] || null;
                          /* Bill ho chuki (wasool ke waqt lagi) baqaya fine — sirf isi ko
                             "incl. fine" note me dikhate hain; projected fine nahi. */
                          const billedFine = billedFineOf(rec) > 0 ? challanAccruedFine(rec, settings) : 0;
                          /* Column me sirf wasool shuda fine — na li gayi ho to 0. */
                          const shownFine = receivedFineOf(rec);
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
                                {/* Total Payable me PROJECTED fine nahi — sirf asal fee.
                                    Late fine receive karte waqt lagti hai, tab bill hone par
                                    m.payable me khud shamil ho jaati hai. */}
                                <b>{money(m.payable)}</b>
                                {m.disc > 0 && <span className="fee-sub-eq">disc {money(m.disc)}</span>}
                                {billedFine > 0 && <span className="fee-sub-eq fee-fine">incl. fine {money(billedFine)}</span>}
                              </td>
                              <td className={`fee-right${shownFine > 0 ? ' fee-fine' : ''}`}>{shownFine > 0 ? money(shownFine) : '0'}</td>
                              <td className="fee-right">{m.paid > 0 ? <span className="fee-paid-amt">{money(m.paid)}</span> : '0'}</td>
                              {/* Remaining me projected fine NAHI — receive hone par bill hui
                                  fine m.remaining me khud aa jaati hai. */}
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
                                      {/* Sirf PARTIAL par — fully received row edit nahi hoti. */}
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
                                        <button className="fee-iconbtn tiny" onClick={() => openReceiptSlip(f, ch)}>
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
                      {/* Column-wise Total row hata diya — neeche right corner par sirf
                          Remaining ka total kaafi hai. */}
                    </table>
                  </div>

                  <div className="fee-family-total">
                    {totFine > 0 && (
                      <>
                        Total Fine: <span className="fee-fine">{money(totFine)}</span>
                        <span style={{ margin: '0 10px', opacity: 0.4 }}>|</span>
                      </>
                    )}
                    Total Remaining: <span className={totRem < 0 ? 'fee-neg' : undefined}>{money(totRem)}</span>
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
  /* Individual modal jaisi hi wajah — late fine isi date par banti hai, is liye
     LOCAL date chahiye (toISOString() UTC me ek din peechhe le jaata tha). */
  const [date, setDate]     = useState(localTodayISO());
  const [method, setMethod] = useState('Cash');
  const [ref, setRef]       = useState('');
  const [txn, setTxn]       = useState('');

  useEffect(() => {
    if (!cfg) return;
    setSelReg(null);
    setDate(localTodayISO()); setMethod('Cash'); setRef(''); setTxn('');
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
    /* "Received" input KUL wasooli rakhta hai (already + new) — editable, aur naya
       paisa = input − paid (dekho computeRows).

       Seed sirf ALREADY PAID hai: modal khulte hi baqaya PENDING me nazar aata hai
       aur Receiving Now 0 rehta hai. Pending se raqam hatao to Received me jaati hai. */
    const perHeadPaid = {};
    payments.forEach(p => Object.entries(p.perHead || {}).forEach(([k, v]) => {
      perHeadPaid[k] = (perHeadPaid[k] || 0) + (+v || 0);
    }));
    const seed = {};
    m.heads.forEach(h => {
      seed[h.name] = Math.max(+perHeadPaid[h.name] || 0, +(m.paidPerHead?.[h.name]) || 0);
    });
    /* Previous Pending bhi isi tarah — sirf jo pehle wasool hui. */
    if (m.prev > 0) seed[m.prevName || 'Previous Pending'] = Math.max(0, +m.prevPaid || 0);
    setPerHeadInput(seed);
    setDate(localTodayISO()); setMethod('Cash'); setRef(''); setTxn('');
  };

  const setHead = (name, v) => setPerHeadInput(prev => ({ ...prev, [name]: Math.max(0, Number(v) || 0) }));

  /* Pending is the mirror of Received — the two always add up to the head's net,
     so typing either one drives the other through the same perHeadInput state.
     Received KUL wasooli hai, is liye `net` se ghatao (owed se nahi). */
  const setPendingFor = (row, v) => {
    /* Pending MINUS bhi ho sakta hai (advance) — is liye niche clamp nahi. */
    const pend = Number(v) || 0;
    setPerHeadInput(prev => ({ ...prev, [row.name]: Math.max(0, row.net - pend) }));
  };

  const computeRows = (ch, m, payments) => {
    const perHeadPaid = {};
    payments.forEach(p => Object.entries(p.perHead || {}).forEach(([k, v]) => {
      perHeadPaid[k] = (perHeadPaid[k] || 0) + (+v || 0);
    }));
    /* Over-receiving allowed — owed se zyada lene par Pending MINUS (advance) ho jaata hai.
       `paid` challan ke receivedAmount se bhi liya jata hai (refresh par bhi sahi rahe). */
    const locked = m.onelink || m.status === 'full';
    return m.heads.map(h => {
      const paid = Math.max(+perHeadPaid[h.name] || 0, +(m.paidPerHead?.[h.name]) || 0);
      /* Input KUL wasooli hai (already + new) — naya paisa = input − paid. */
      const totalRecv = locked ? paid : Math.max(0, +perHeadInput[h.name] || 0);
      /* Delta MINUS bhi ho sakta hai — cashier already-received theek kar raha hai.
         Clamp yahan NAHI, warna correction save par kuch na karti. */
      const recvNow   = locked ? 0 : (totalRecv - paid);
      const pending   = h.net - paid - recvNow;   // negative = advance
      return { ...h, paid, totalRecv, recvNow, pending };
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

  /* Previous Pending — individual modal ki tarah ek alag row (apne input ke saath). */
  const prevKey   = selModel?.prevName || 'Previous Pending';
  const prevTotal = Math.max(0, +(selModel?.prev) || 0);
  const prevPaid  = Math.max(0, +(selModel?.prevPaid) || 0);
  /* Heads ki tarah ye input bhi KUL wasooli rakhta hai. */
  const prevLocked    = !selModel || selModel.onelink || selModel.status === 'full';
  const prevTotalRecv = prevLocked
    ? prevPaid
    : Math.max(0, perHeadInput[prevKey] == null ? prevPaid : (+perHeadInput[prevKey] || 0));
  /* Heads ki tarah ye delta bhi MINUS ho sakta hai — correction. */
  const prevRecv  = prevLocked ? 0 : (prevTotalRecv - prevPaid);
  const prevPend  = prevTotal - prevPaid - prevRecv;
  if (selModel && prevTotal > 0) {
    recvNow     += prevRecv;
    alreadyPaid += prevPaid;
    totalAfter  += prevTotal;
    totalCh     += prevTotal;
  }

  /* ADVANCE ek CREDIT line hai — "Received" me MINUS me dikhta hai (read-only) aur
     wahin se kat jaata hai, yani utna cash kam lena hai. */
  const advCredit  = Math.max(0, +(selModel?.advance) || 0);
  /* recvNow correction ki wajah se MINUS ho sakta hai — advance us par apply nahi hota. */
  const advApplied = Math.min(advCredit, Math.max(0, recvNow));
  recvNow = recvNow - advApplied;

  /* ── LATE FINE ── individual modal jaisi hi: due date ke baad receive karne par
     khud lagti hai, read-only, aur receivable/total dono me judti hai. */
  const selChallan = selChild?._challan || null;
  const fineRows   = (selChallan?.detailRows || []).filter(feeService.isLateFineRow);
  const fineBilled = fineRows.reduce((a, r) => a + (+r.challanAmount || 0), 0);
  const finePaid   = fineRows.reduce((a, r) => a + (+r.receivedAmount || 0), 0);
  /* Individual modal jaisa hi: ledger me likhi ja chuki fine hi authority hai. */
  const fineDue    = fineBilled > 0 ? fineBilled : feeService.computeFine({
    dueDate: selChallan?.dueDate, receivingDate: date, settings,
  });
  const fineDays = feeService.daysLate(selChallan?.dueDate, date);
  const fineOwed = Math.max(0, fineDue - finePaid);
  if (selModel && !(selModel.onelink || selModel.status === 'full')) {
    recvNow     += fineOwed;
    totalCh     += fineDue;
    totalAfter  += fineDue;
    alreadyPaid += finePaid;
  }

  /* Total se zyada wasool ho to MINUS me — yani student ka advance. */
  const remainAfter = selModel ? (selModel.payable + fineDue - alreadyPaid - recvNow) : 0;
  const selEditable = !!selModel && !(selModel.onelink || selModel.status === 'full');

  const handleSaveChild = () => {
    if (!selChild) return;
    /* MINUS bhi valid hai (already-received correction) — sirf 0 rokna hai. */
    if (recvNow === 0) { toast('Enter at least one head amount to receive', 'error'); return; }
    if (!date) { toast('Receiving date is required', 'error'); return; }
    /* Session-date guard: receiving date current session ki UTC window ke andar ho. */
    const recvChk = validateSessionDateFromStorage(date, 'receiving date');
    if (!recvChk.ok) { toast(recvChk.message, 'error'); return; }
    const perHead = {};
    rowsForSel.forEach(r => { if (r.recvNow !== 0) perHead[r.name] = r.recvNow; });
    /* Previous Pending ki raqam ASLI subHead key par (API perHead ko subHead se match karti hai). */
    if (prevRecv !== 0) perHead[prevKey] = (perHead[prevKey] || 0) + prevRecv;
    onSave({
      famKey: family.key, reg: selChild.reg, monthIdx,
      studentName: selChild.name,
      date, method, ref, txn,
      amount: recvNow,
      perHead,
      isAdjustment: recvNow < 0,
      fine: fineOwed,
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
                                      value={r.totalRecv}
                                      onChange={e => setHead(r.name, e.target.value)}
                                      placeholder="0"
                                    />
                                  )}
                                </td>
                                <td className="fee-right">
                                  {selModel.onelink || selModel.status === 'full' ? (
                                    <span className="fee-cell-grey">{money(r.pending)}</span>
                                  ) : (
                                    <input
                                      type="number"
                                      min="0"
                                      value={r.pending}
                                      onChange={e => setPendingFor(r, e.target.value)}
                                      placeholder="0"
                                    />
                                  )}
                                </td>
                              </tr>
                            ))}
                            {/* PREVIOUS PENDING — individual modal jaisi hi row, apne input ke saath. */}
                            {prevTotal > 0 && (
                              <tr>
                                <td><b>Previous Pending</b></td>
                                <td className="fee-right">{money(prevTotal)}</td>
                                <td className="fee-right">0</td>
                                <td className="fee-right"><span className="fee-cell-grey">{money(prevTotal)}</span></td>
                                <td className="fee-right">
                                  {selModel.onelink || selModel.status === 'full' ? (
                                    <span className="fee-cell-grey">{money(prevPaid)}</span>
                                  ) : (
                                    <input
                                      type="number"
                                      min="0"
                                      value={prevTotalRecv}
                                      onChange={e => setHead(prevKey, e.target.value)}
                                      placeholder="0"
                                    />
                                  )}
                                </td>
                                <td className="fee-right">
                                  {selModel.onelink || selModel.status === 'full' ? (
                                    <span className="fee-cell-grey">{money(prevPend)}</span>
                                  ) : (
                                    <input
                                      type="number"
                                      min="0"
                                      value={prevPend}
                                      onChange={e => {
                                        const pend = Number(e.target.value) || 0;
                                        setHead(prevKey, Math.max(0, prevTotal - pend));
                                      }}
                                      placeholder="0"
                                    />
                                  )}
                                </td>
                              </tr>
                            )}
                            {/* ADVANCE — credit line: "Received" MINUS me, read-only. */}
                            {advCredit > 0 && (
                              <tr>
                                <td><b>Advance</b></td>
                                <td className="fee-right">—</td>
                                <td className="fee-right">—</td>
                                <td className="fee-right"><span className="fee-cell-grey">{money(-advCredit)}</span></td>
                                <td className="fee-right fee-neg"><b>{money(-advApplied)}</b></td>
                                <td className="fee-right">{money(advCredit - advApplied)}</td>
                              </tr>
                            )}
                            {/* LATE FINE — due date ke baad khud lagti hai, read-only. */}
                            {fineDue > 0 && (
                              <tr>
                                <td>
                                  <b>Fine</b>
                                  <span className="fee-sub-eq">
                                    {fineDays} day{fineDays === 1 ? '' : 's'} late
                                    {settings?.fineType === 'daily' ? ` × Rs. ${(+settings.fineAmt || 0).toLocaleString('en-PK')}` : ''}
                                  </span>
                                </td>
                                <td className="fee-right">{money(fineDue)}</td>
                                <td className="fee-right">0</td>
                                <td className="fee-right"><span className="fee-cell-grey">{money(fineDue)}</span></td>
                                {/* Fine read-only — input ki tarah KUL wasooli dikhati hai. */}
                                <td className="fee-right"><b>{money(selEditable ? finePaid + fineOwed : finePaid)}</b></td>
                                <td className="fee-right">
                                  {money(selModel.onelink || selModel.status === 'full' ? Math.max(0, fineDue - finePaid) : 0)}
                                </td>
                              </tr>
                            )}
                          </tbody>
                          <tfoot>
                            <tr className="fee-recv-total">
                              <td>Total</td>
                              <td className="fee-right">{money(totalCh)}</td>
                              <td className="fee-right">{money(totalDisc)}</td>
                              <td className="fee-right">{money(totalAfter - advApplied)}</td>
                              <td className="fee-right">{money(alreadyPaid + recvNow)}</td>
                              <td className="fee-right">{money(remainAfter)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      <div className="fee-recv-paystrip" style={{ marginTop: 14 }}>
                        <div className="fee-recv-paycard">
                          <span className="fee-recv-paylbl">Total Payable</span>
                          {/* Late fine bhi payable ka hissa hai. */}
                          <span className="fee-recv-payval">{money(selModel.payable + fineDue)}</span>
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
  html,body,*{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important;}
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

  /* Prefer the child's enriched payments (built from the persisted challan) so
     the slip reflects real received amounts even after a refresh; fall back to
     the live session receipts. Used by both the preview and the printed slip. */
  const slipPaymentsFor = (famKey, reg) => {
    const ch = family.children.find(c => c.reg === reg);
    return (ch && Array.isArray(ch._payments)) ? ch._payments : paymentsFor(famKey, reg);
  };

  /* Live rows for preview */
  const rows = family.children.map(ch => {
    const pays = slipPaymentsFor(family.key, ch.reg);
    const paid = pays.reduce((a, p) => a + (+p.amount || 0), 0);
    const payable = Math.max(0, (+ch.fee || 0) + (+ch.transport || 0) - (+ch.discount || 0) + (+ch.dues || 0));
    return { ch, paid, payable, rem: Math.max(0, payable - paid), pays };
  });
  const totals = rows.reduce((a, r) => ({
    paid: a.paid + r.paid, payable: a.payable + r.payable, rem: a.rem + r.rem,
  }), { paid: 0, payable: 0, rem: 0 });

  const doPrint = () => {
    const html = buildFamilyReceivingSlipHTML({ family, period, paymentsFor: slipPaymentsFor, size });
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

/* ═══════════ BranchLedger row maths — shared by History and Reports ═══════════

   detailRow.receivedAmount is the paid/unpaid signal the ledger gives us:
   null means nothing has been taken against that head yet, a number is what
   was actually received. Discount comes off the billed amount before anything
   is owed, so `net` — not challanAmount — is the real receivable. */
const ledgerRowNet    = (r) => Math.max((+r.challanAmount || 0) - (+r.discount || 0), 0);
const ledgerRowUnpaid = (r) => r.receivedAmount == null;
const ledgerRowRecv   = (r) => +r.receivedAmount || 0;
const ledgerRowPend   = (r) => (ledgerRowUnpaid(r) ? ledgerRowNet(r) : Math.max(ledgerRowNet(r) - ledgerRowRecv(r), 0));

/* Build the month-by-month history for one student straight from their real
   BranchLedger challans. Only months that actually carry a challan appear —
   a month with no challan is not an unpaid challan, so it must not inflate
   the counts. `empNames` maps a login user id to the employee who acted. */
function buildStudentHistory({ recs, fromIdx, toIdx, year, empNames = {}, settings = null }) {
  const byMonth = new Map();
  (recs || []).forEach(rec => {
    if (String(rec.year) !== String(year)) return;
    byMonth.set(Number(rec.month) - 1, rec);
  });

  const months = [];
  /* RUNNING-LEDGER model — carry-forward ("Previous Pending") ko double-count na kare.
     Har mahine ka "Previous Pending" line pichle mahine ka hi unpaid hota hai; agar hum
     har challan poora jodein to wahi raqam do baar ginn jaati thi (Total Fee/Pending
     inflated). Is liye:
       - Sirf PEHLE mahine ka carry-forward "opening balance" ke taur par lo (range se
         pehle ka baqaya), baaki mahino ke carry-forward chhod do (wo running me already hai).
       - Har mahine: billed = us mahine ke NAYE charges; running += billed − received.
     Isse pending hamesha ASLI current outstanding rehta hai (Receiving ke Remaining jaisa). */
  const isPrevRow = (r) => /previous|pending|arrear/i.test(String(r.subHead || r.head || ''));
  let running = 0, firstSeen = false;
  for (let m = fromIdx; m <= toIdx; m++) {
    const rec = byMonth.get(m);
    if (!rec) continue;
    const rows = rec.detailRows || [];

    const carrySigned = rows.filter(isPrevRow)
      .reduce((a, r) => a + ((+r.challanAmount || 0) - (+r.discount || 0)), 0);   // advance → negative
    const newBilled   = rows.filter(r => !isPrevRow(r)).reduce((a, r) => a + ledgerRowNet(r), 0);
    const received    = rows.reduce((a, r) => a + ledgerRowRecv(r), 0);

    /* Pehle mahine ka carry-forward opening balance hai (range se pehle ka baqaya ya
       advance); baad ke mahino ka carry-forward chhod do (wo running me already hai). */
    const isFirst = !firstSeen;
    if (isFirst) { running = carrySigned; firstSeen = true; }
    const openBal    = running;                                   // month se pehle ki balance (>0 baqaya, <0 advance)
    const advApplied = openBal < 0 ? Math.min(-openBal, newBilled) : 0;  // pichla ADVANCE is mahine laga
    /* Challan Amount = is mahine ke naye charges + (SIRF pehle mahine ka) pichla baqaya —
       taake Total Fee me har fee ek hi baar aaye. Advance ko yahan minus NAHI karte;
       wo alag "Advance" column me dikhta hai. */
    const openDebt   = isFirst && openBal > 0 ? openBal : 0;
    const monthDisc  = rows.reduce((a, r) => a + (+r.discount || 0), 0);   // is mahine ka total discount

    /* ── LATE FINE ──
       Backend fine ko persist nahi karta, is liye yahan dobara banti hai:
         - Paise aa chuke (received > 0) → ASLI receiving date tak ki fine, jo
           WASOOL ho gayi: challanAmt aur received DONO me (net asar 0).
         - Abhi unpaid overdue → AAJ tak accrued fine, jo abhi BAQAYA hai:
           challanAmt aur running/pending me (received me nahi).
       Backend ne apni Late Fine row bhej di ho to wo already rows me hai —
       dobara na jodo. */
    const billedFine = rows.filter(feeService.isLateFineRow)
      .reduce((a, r) => a + (+r.challanAmount || 0), 0);
    /* PROJECTED (abhi tak bill NA hui) late fine. Ise CHALLAN AMOUNT me NAHI jodte —
       challan amount asal fee (alag column) rehta hai. Magar PENDING me ye shamil hai:
       unpaid overdue par pending = challan amount + fine (jaise 12,000 + 100 = 12,100).
       Fee receive hote hi fine ledger me bill ho jaati hai (billedFine>0) aur khud
       newBilled/received me shamil ho kar hisaab me aa jaati hai. */
    let fine = 0;
    if (settings?.fineEnabled && billedFine <= 0 && received <= 0) {
      fine = feeService.computeFine({ dueDate: rec.dueDate, receivingDate: localTodayISO(), settings });
    }
    const fineReceived = 0;

    const challanAmt = newBilled + openDebt;          // asal fee (fine alag "Fine" column me)
    running = openBal + newBilled + fine - received;  // pending = fee + projected fine
    const pending    = Math.max(0, running);
    /* Status sirf ASLI CASH par — advance apne alag column me. Advance ne poora cover
       kar diya (cash 0, pending 0) to 'full', warna cash aane par running dekho. */
    const status     = received <= 0
      ? (advApplied > 0 && running <= 0 ? 'full' : 'none')
      : running > 0 ? 'partial' : 'full';

    /* Receiving a payment stamps modifiedAt, but an untouched challan still
       carries its creation stamp — so it only counts as a receiving date once
       money has actually come in. */
    const stamp  = received > 0 ? String(rec.modifiedAt || rec.dateofCreattion || '') : '';
    const recvBy = received > 0
      ? (empNames[String(rec.modifiedBy)] || `User #${rec.modifiedBy}`)
      : '—';

    const perHead = {};
    rows.forEach(r => {
      const n = r.subHead || r.head || '—';
      perHead[n] = (perHead[n] || 0) + ledgerRowRecv(r);
    });

    months.push({
      m,
      monthName:   FEE_MONTHS[m],
      challanNo:   `CH-${rec.year}${String(rec.month).padStart(2, '0')}-${rec.id}`,
      challanDate: String(rec.dateofCreattion || '').slice(0, 10) || '—',
      dueDate:     String(rec.dueDate || '').slice(0, 10) || '—',
      challanAmt, pending, status, advApplied, disc: monthDisc,
      /* Wasool shuda late fine bhi "Received" ka hissa hai. */
      received: received + fineReceived,
      fine, fineReceived,
      method:   received > 0 ? (rec.paymentMethod || 'Cash') : '—',
      recvDate: stamp ? stamp.slice(0, 10) : '—',
      time:     stamp ? stamp.slice(11, 16) : '—',
      recvBy,
      createdBy: empNames[String(rec.createdBy)] || `User #${rec.createdBy}`,
      /* Per-head breakdown so Detailed History can show every billed line. */
      heads: [
        ...rows.map(r => ({
          head:    r.head || 'Account Payable',
          sub:     r.subHead || r.head || '—',
          challan: +r.challanAmount || 0,
          disc:    +r.discount || 0,
          recv:    ledgerRowRecv(r),
          pend:    ledgerRowPend(r),
          unpaid:  ledgerRowUnpaid(r),
        })),
        /* Reconstructed late fine apni alag line ki tarah. */
        ...(fine > 0 ? [{
          head: 'Account Payable', sub: feeService.LATE_FINE_HEAD,
          challan: fine, disc: 0,
          recv: fineReceived, pend: Math.max(0, fine - fineReceived),
          unpaid: fineReceived <= 0,
        }] : []),
      ],
      /* The ledger stores a cumulative receivedAmount, not per-transaction
         rows, so the slip builder gets one synthetic payment carrying it. */
      payments: received > 0 ? [{
        amount: received + fineReceived,
        fine:   fineReceived,
        date:   stamp.slice(0, 10),
        time:   stamp.slice(11, 16),
        method: rec.paymentMethod || 'Cash',
        ref: '', txn: '', source: 'counter',
        by: recvBy, perHead,
      }] : [],
      _rec: rec,
    });
  }
  return months;
}

function feeHistTotals(months) {
  let fee = 0, recv = 0, adv = 0, disc = 0, fine = 0, lastDate = '—', lastBy = '—', lastTime = '—';
  months.forEach(mo => {
    fee  += mo.challanAmt;
    recv += mo.received;
    adv  += (mo.advApplied || 0);
    disc += (mo.disc || 0);
    fine += (mo.fine || 0);
    if (mo.recvDate !== '—') { lastDate = mo.recvDate; lastBy = mo.recvBy; lastTime = mo.time; }
  });
  /* Pending = CURRENT outstanding = aakhri mahine ka running balance. Per-mahine `pending`
     running balance hai (additive nahi) — jodte NAHI, warna carry-forward/advance double count. */
  const pend = months.length ? months[months.length - 1].pending : 0;
  const paidCount = months.filter(mo => mo.received > 0).length;
  return {
    challans: months.length, fee, recv, pend, adv, disc, fine,
    lastDate, lastBy, lastTime,
    paidCount, unpaid: months.length - paidCount,
  };
}

function FeeHistoryTab({ toast }) {
  const { can } = usePermissions();
  const canHistDownload = can('Fee', 'Fee History', 'Download');
  const [seg, setSeg] = useState('ledger');

  const { data: classes = [] }     = useAsync(feeService.getFeeClasses, []);
  const { data: studentsMap = {} } = useAsync(feeService.getTransportFee, []);
  /* Only used as a fallback when a stored challan carries no detail rows —
     the reprint itself always prefers the month's own BranchLedger record. */
  const { data: headsMap = {} }    = useAsync(feeService.getFeeHeads, []);
  const { data: settings = {} }    = useAsync(feeService.getFeeSettings, []);
  const { data: branchHeader = null } = useAsync(feeService.getReportHeader, [], null);

  /* Filters */
  const today = new Date();
  const [fromMonth, setFromMonth] = useState(FEE_MONTHS[0]);
  const [toMonth, setToMonth]     = useState(FEE_MONTHS[today.getMonth()]);
  const [year, setYear]           = useState(String(today.getFullYear()));
  const [appliedFrom, setAppliedFrom] = useState(fromMonth);
  const [appliedTo, setAppliedTo]     = useState(toMonth);
  const [appliedYear, setAppliedYear] = useState(year);

  const fromIdx = FEE_MONTHS.indexOf(appliedFrom);
  const toIdx   = FEE_MONTHS.indexOf(appliedTo);

  /* The applied range's challans — one /api/BranchLedger/get-by-month-range
     call covers every student in the branch across the whole range. */
  const [records, setRecords]     = useState([]);
  const [histLoading, setLoading] = useState(true);
  const [histError, setError]     = useState(null);
  useEffect(() => {
    let alive = true;
    const f = FEE_MONTHS.indexOf(appliedFrom) + 1;
    const t = FEE_MONTHS.indexOf(appliedTo) + 1;
    setLoading(true);
    setError(null);
    feeService.getLedgerRange(f, appliedYear, Math.max(f, t), appliedYear)
      .then(rows => { if (alive) { setRecords(rows); setLoading(false); } })
      .catch(e => { if (alive) { setRecords([]); setError(e.message || 'Could not load fee history'); setLoading(false); } });
    return () => { alive = false; };
  }, [appliedFrom, appliedTo, appliedYear]);

  /* createdBy / modifiedBy are login user ids — resolve each distinct one to
     its employee name once, then reuse across every row. */
  const [empNames, setEmpNames] = useState({});
  useEffect(() => {
    const ids = [...new Set(
      records.flatMap(r => [r.modifiedBy, r.createdBy]).filter(Boolean).map(String),
    )];
    const missing = ids.filter(id => !(id in empNames));
    if (!missing.length) return undefined;
    let alive = true;
    Promise.all(missing.map(id => feeService.getEmployeeNameByLoginUser(id).then(n => [id, n])))
      .then(pairs => { if (alive) setEmpNames(prev => ({ ...prev, ...Object.fromEntries(pairs) })); });
    return () => { alive = false; };
  }, [records, empNames]);

  const recsByStudent = useMemo(() => {
    const map = new Map();
    records.forEach(rec => {
      const k = String(rec.studentID);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(rec);
    });
    return map;
  }, [records]);

  /* Per-student history, built from that student's real challans. */
  const historyFor = useCallback((c, s) => buildStudentHistory({
    recs: recsByStudent.get(String(s.studentID)) || recsByStudent.get(String(s.applicantsID)) || [],
    fromIdx, toIdx: Math.max(fromIdx, toIdx), year: appliedYear, empNames, settings,
  }), [recsByStudent, fromIdx, toIdx, appliedYear, empNames, settings]);

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
    const nowM = FEE_MONTHS[new Date().getMonth()];
    const nowY = String(new Date().getFullYear());
    setFromMonth(FEE_MONTHS[0]); setToMonth(nowM); setYear(nowY);
    setAppliedFrom(FEE_MONTHS[0]); setAppliedTo(nowM); setAppliedYear(nowY);
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
    const html = buildHistStudentReportHTML({ mode, c, s, months, period: `${appliedFrom} – ${appliedTo} ${appliedYear}`, year: appliedYear, school: branchHeader });
    printWindow(`${mode === 'detail' ? 'Detailed' : 'Ledger'} History — ${s.name}`, html);
    toast(`${mode === 'detail' ? 'Detailed' : 'Ledger'} history ready — Save as PDF.`, 'success');
  };
  const downloadClass = (c) => {
    const rows = (studentsMap[c.key] || []).map(s => ({ s, months: historyFor(c, s) }));
    const html = buildHistClassReportHTML({ mode: seg, c, rows, period: `${appliedFrom} – ${appliedTo} ${appliedYear}`, school: branchHeader });
    printWindow(`Class ${seg === 'detail' ? 'Detailed' : 'Ledger'} — ${c.cls} (${c.sec})`, html);
    toast(`Class ${seg === 'detail' ? 'detailed history' : 'ledger summary'} ready — Save as PDF.`, 'success');
  };
  const downloadOverall = (mode) => {
    const blocks = classes.map(c => ({
      c, rows: (studentsMap[c.key] || []).map(s => ({ s, months: historyFor(c, s) })),
    }));
    const html = buildHistOverallReportHTML({ mode, blocks, period: `${appliedFrom} – ${appliedTo} ${appliedYear}`, school: branchHeader });
    printWindow(`Overall ${mode === 'detail' ? 'Detailed History' : 'Ledger Summary'}`, html);
    toast(`Overall ${mode === 'detail' ? 'detailed history' : 'ledger summary'} ready — Save as PDF.`, 'success');
  };
  /* History tab's reports + month reprints always render as A4 PDFs —
     the thermal printSize setting is meant for live counter receipts,
     not archival history records. */
  const downloadMonthChallan = (c, s, mo) => {
    const html = buildHistMonthChallanHTML({
      c, s, mo, year: appliedYear,
      heads: headsMap[c.key] || [], settings, school: branchHeader,
    });
    const w = window.open('', '_blank');
    if (!w) { toast('Please allow pop-ups to download the challan', 'error'); return; }
    w.document.write(html); w.document.close();
    w.onload = () => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } };
    toast(`${mo.monthName} ${appliedYear} A4 challan ready for ${s.name}.`, 'success');
  };
  const downloadMonthSlip = (c, s, mo) => {
    if (mo.received <= 0) { toast('No receipt for this month', 'info'); return; }
    const html = buildHistMonthSlipHTML({ c, s, mo, year: appliedYear, size: 'a4', school: branchHeader });
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

      <RepLoadState
        loading={histLoading}
        error={histError}
        empty={!histLoading && !histError && records.length === 0}
        emptyText={`No challans exist for ${appliedFrom} – ${appliedTo} ${appliedYear}.`}
      />

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
        {canHistDownload && (
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
        )}
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
                {totals.disc > 0 && (
                  <div className="fee-hist-metacard"><div className="l">Discount</div><div className="v" style={{ color: '#0F766E' }}>{money(-totals.disc)}</div></div>
                )}
                {totals.adv > 0 && (
                  <div className="fee-hist-metacard"><div className="l">Advance Used</div><div className="v" style={{ color: '#0F766E' }}>{money(-totals.adv)}</div></div>
                )}
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
                    {/* Challan generate karte waqt chuni gayi dates — report me bhi wahi. */}
                    <th>Issue Date</th>
                    <th>Due Date</th>
                    <th className="fee-right">Challan Amount</th>
                    <th className="fee-right">Discount</th>
                    <th className="fee-right">Fine</th>
                    <th className="fee-right">Advance</th>
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
                      <td>{fmtDMY(mo.challanDate) || '—'}</td>
                      <td>{fmtDMY(mo.dueDate) || '—'}</td>
                      <td className="fee-right">{money(mo.challanAmt)}</td>
                      {/* Discount challan amount me se already minus ho chuka (net billed) —
                          yahan sirf visibility ke liye, Advance ki tarah MINUS me. */}
                      <td className={`fee-right${mo.disc > 0 ? ' fee-neg' : ''}`}>{money(mo.disc > 0 ? -mo.disc : 0)}</td>
                      <td className={`fee-right${mo.fine > 0 ? ' fee-fine' : ''}`}>{mo.fine > 0 ? money(mo.fine) : '0'}</td>
                      {/* Advance jo is mahine challan par laga (pichhle overpay se) — MINUS me. */}
                      <td className={`fee-right${mo.advApplied > 0 ? ' fee-neg' : ''}`}>{money(mo.advApplied > 0 ? -mo.advApplied : 0)}</td>
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
                        <span className="k">Issue Date</span><span className="v">{fmtDMY(mo.challanDate) || '—'}</span>
                        <span className="k">Due Date</span><span className="v">{fmtDMY(mo.dueDate) || '—'}</span>
                        <span className="k">Discount</span><span className="v">{money(mo.disc || 0)}</span>
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

                  {/* Every billed head on this month's challan. */}
                  {mo.heads.length > 0 && (
                    <div className="fee-month-body" style={{ paddingTop: 0 }}>
                      <div className="fee-month-col" style={{ gridColumn: '1 / -1' }}>
                        <h5><span><i className="fa-solid fa-layer-group"></i> Head-Wise Breakdown</span></h5>
                        <div className="fee-stbl-wrap">
                          <table className="fee-stbl">
                            <thead>
                              <tr>
                                <th>Account Type</th>
                                <th>Fee Head</th>
                                <th className="fee-right">Challan</th>
                                <th className="fee-right">Discount</th>
                                <th className="fee-right">Received</th>
                                <th className="fee-right">Pending</th>
                              </tr>
                            </thead>
                            <tbody>
                              {mo.heads.map((h, i) => (
                                <tr key={`${h.sub}-${i}`}>
                                  <td>{h.head}</td>
                                  <td><b>{headLabel(h.sub)}</b></td>
                                  <td className="fee-right">{money(h.challan)}</td>
                                  <td className="fee-right">{money(h.disc)}</td>
                                  <td className="fee-right">
                                    {h.unpaid
                                      ? <span style={{ color: 'var(--text-muted)' }}>—</span>
                                      : <span className="fee-paid-amt">{money(h.recv)}</span>}
                                  </td>
                                  <td className="fee-right">{h.pend > 0 ? <span className="fee-neg">{money(h.pend)}</span> : '0'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
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
/* Colorful report ka background/color PDF/print me bhi aaye (browser warna bg drop kar deta hai). */
html,body,*{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important;}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;color:#0F172A;background:#fff;font-size:12px;padding:18px;}
.hist-page{max-width:1100px;margin:0 auto 14px;padding:0;}
.hist-head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1E3A8A;padding-bottom:14px;margin-bottom:16px;}
.hist-brand{display:flex;align-items:center;gap:12px;}
.hist-logo{width:44px;height:44px;border:1px solid #BFDBFE;border-radius:12px;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#1E3A8A;font-weight:800;background:#fff;flex-shrink:0;}
.hist-logo img{width:100%;height:100%;object-fit:contain;}
.hist-school{font-size:18px;font-weight:800;color:#1E3A8A;}
.hist-title{font-size:14px;font-weight:700;color:#1E40AF;margin-top:6px;}
.hist-addr{font-size:10px;color:#64748B;margin-top:3px;max-width:420px;}
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
.hist-mc-wide{grid-column:1 / -1;border-left:0 !important;border-top:1px solid #E5E7EB;}
.hist-mc-wide table{font-size:10px;}
.hist-mc-wide thead th{padding:6px 8px;}
.hist-mc-wide tbody td{padding:5px 8px;}
.hist-mc-wide tfoot td{padding:6px 8px;font-size:10px;}
@page{size:A4;margin:14mm;}
@media print{body{padding:0;}-webkit-print-color-adjust:exact;print-color-adjust:exact;}
`;

const statBadge = (st) => `<span class="hist-stat ${st === 'full' ? 'full' : st === 'partial' ? 'partial' : 'none'}">${st === 'full' ? 'Fully Received' : st === 'partial' ? 'Partial' : 'Not Received'}</span>`;

/* Every History PDF shares one branded head block — school name, logo and
   address all come from the branch's /report-header API (feeService), so a
   report always carries the branch it was generated in, never a hardcoded
   school. `lines` are the right-hand meta rows specific to each report. */
function histHeadHtml(meta, title, lines = []) {
  const today = feeReportDate(meta);
  const rows = [
    `Generated: ${today}`,
    `By: ${escHtml(meta.generatedBy)}`,
    ...lines.filter(Boolean),
    meta.session ? `Session: ${escHtml(meta.session)}` : '',
  ].filter(Boolean).join('<br/>');
  return `
  <div class="hist-head">
    <div class="hist-brand">
      <div class="hist-logo">${feeReportLogoHtml(meta)}</div>
      <div>
        <div class="hist-school">${escHtml(meta.name)}</div>
        <div class="hist-title">${title}</div>
        ${meta.address ? `<div class="hist-addr">${escHtml(meta.address)}</div>` : ''}
      </div>
    </div>
    <div class="hist-meta">${rows}</div>
  </div>`;
}

function histStudentLedgerRows(months, year) {
  return months.map(mo => `
    <tr>
      <td><b>${escHtml(mo.monthName)}</b> ${escHtml(year)}</td>
      <td>${escHtml(fmtDMY(mo.challanDate) || '—')}</td>
      <td>${escHtml(fmtDMY(mo.dueDate) || '—')}</td>
      <td class="right">${mo.challanAmt.toLocaleString('en-PK')}</td>
      <td class="right">${mo.disc > 0 ? '-' + mo.disc.toLocaleString('en-PK') : '0'}</td>
      <td class="right ${mo.fine > 0 ? 'red' : ''}">${(mo.fine || 0).toLocaleString('en-PK')}</td>
      <td class="right">${mo.advApplied > 0 ? '-' + mo.advApplied.toLocaleString('en-PK') : '0'}</td>
      <td class="right green">${mo.received > 0 ? mo.received.toLocaleString('en-PK') : '0'}</td>
      <td class="right ${mo.pending > 0 ? 'red' : ''}">${mo.pending.toLocaleString('en-PK')}</td>
      <td>${escHtml(mo.recvDate)}${mo.time !== '—' ? `<br/><span style="color:#64748B;font-size:10px">${escHtml(fmtTime12(mo.time))}</span>` : ''}</td>
      <td>${escHtml(mo.recvBy)}</td>
      <td>${escHtml(mo.method)}</td>
      <td class="center">${statBadge(mo.status)}</td>
    </tr>`).join('');
}

function buildHistStudentReportHTML({ mode, c, s, months, period, year = '', school = null }) {
  const meta = feeReportSchool(school);
  const t = feeHistTotals(months);
  const stLines = [
    `Reg: ${escHtml(s.reg)} · ${escHtml(c.cls)} / ${escHtml(c.sec)}`,
    `S/O: ${escHtml(s.father || '—')}`,
    `Period: ${escHtml(period)}`,
  ];
  if (mode === 'ledger') {
    return `<style>${HIST_REPORT_CSS}</style><body><div class="hist-page">
  ${histHeadHtml(meta, `Fee Ledger Summary — ${escHtml(s.name)}`, stLines)}
  <div class="hist-cards">
    <div class="hist-card"><div class="l">Total Fee</div><div class="v">${t.fee.toLocaleString('en-PK')}</div></div>
    <div class="hist-card"><div class="l">Received</div><div class="v green">${t.recv.toLocaleString('en-PK')}</div></div>
    ${t.disc > 0 ? `<div class="hist-card"><div class="l">Discount</div><div class="v">-${t.disc.toLocaleString('en-PK')}</div></div>` : ''}
    ${t.adv > 0 ? `<div class="hist-card"><div class="l">Advance Used</div><div class="v">-${t.adv.toLocaleString('en-PK')}</div></div>` : ''}
    <div class="hist-card"><div class="l">Pending</div><div class="v red">${t.pend.toLocaleString('en-PK')}</div></div>
    <div class="hist-card"><div class="l">Months</div><div class="v">${t.challans}</div></div>
  </div>
  <table>
    <thead><tr><th>Month</th><th>Issue Date</th><th>Due Date</th><th class="right">Challan Amount</th><th class="right">Discount</th><th class="right">Fine</th><th class="right">Advance</th><th class="right">Received</th><th class="right">Pending</th><th>Receiving Date</th><th>Received By</th><th>Payment Method</th><th class="center">Status</th></tr></thead>
    <tbody>${histStudentLedgerRows(months, year)}</tbody>
  </table>
</div>`;
  }
  /* Detailed mode — one card per month carrying the exact challan block, the
     exact receiving block and every billed head, so the PDF matches the
     on-screen Detail History card line for line. */
  const cards = months.map(mo => {
    const gross = mo.heads.reduce((a, h) => a + h.challan, 0);
    const disc  = mo.heads.reduce((a, h) => a + h.disc, 0);
    const headRows = mo.heads.map(h => `
      <tr>
        <td>${escHtml(h.head)}</td>
        <td><b>${escHtml(headLabel(h.sub))}</b></td>
        <td class="right">${h.challan.toLocaleString('en-PK')}</td>
        <td class="right">${h.disc.toLocaleString('en-PK')}</td>
        <td class="right ${h.unpaid ? '' : 'green'}">${h.unpaid ? '—' : h.recv.toLocaleString('en-PK')}</td>
        <td class="right ${h.pend > 0 ? 'red' : ''}">${h.pend.toLocaleString('en-PK')}</td>
      </tr>`).join('');
    return `
    <div class="hist-mc">
      <div class="hist-mc-head">
        <div class="hist-mc-title">${escHtml(mo.monthName)} ${escHtml(year)}</div>
        ${statBadge(mo.status)}
      </div>
      <div class="hist-mc-body">
        <div class="hist-mc-col">
          <h5>Challan Details</h5>
          <div class="hist-kv">
            <span class="k">Challan #</span><span class="v">${escHtml(mo.challanNo)}</span>
            <span class="k">Issue Date</span><span class="v">${escHtml(fmtDMY(mo.challanDate) || '—')}</span>
            <span class="k">Due Date</span><span class="v">${escHtml(fmtDMY(mo.dueDate) || '—')}</span>
            <span class="k">Gross Amount</span><span class="v">${gross.toLocaleString('en-PK')}</span>
            <span class="k">Discount</span><span class="v">${disc.toLocaleString('en-PK')}</span>
            <span class="k">Total Challan</span><span class="v">${mo.challanAmt.toLocaleString('en-PK')}</span>
          </div>
        </div>
        <div class="hist-mc-col">
          <h5>Receiving Details</h5>
          <div class="hist-kv">
            <span class="k">Received</span><span class="v green">${mo.received.toLocaleString('en-PK')}</span>
            <span class="k">Pending</span><span class="v ${mo.pending > 0 ? 'red' : ''}">${mo.pending.toLocaleString('en-PK')}</span>
            <span class="k">Receiving Date</span><span class="v">${escHtml(mo.recvDate)}${mo.time !== '—' ? ` · ${escHtml(fmtTime12(mo.time))}` : ''}</span>
            <span class="k">Received By</span><span class="v">${escHtml(mo.recvBy)}</span>
            <span class="k">Payment Method</span><span class="v">${escHtml(mo.method)}</span>
            <span class="k">Status</span><span class="v">${mo.status === 'full' ? 'Fully Received' : mo.status === 'partial' ? 'Partial' : 'Not Received'}</span>
          </div>
        </div>
        ${mo.heads.length ? `
        <div class="hist-mc-col hist-mc-wide">
          <h5>Head-Wise Breakdown</h5>
          <table>
            <thead><tr><th>Account Type</th><th>Fee Head</th><th class="right">Challan</th><th class="right">Discount</th><th class="right">Received</th><th class="right">Pending</th></tr></thead>
            <tbody>${headRows}</tbody>
            <tfoot>
              <tr>
                <td colspan="2">Total</td>
                <td class="right">${gross.toLocaleString('en-PK')}</td>
                <td class="right">${disc.toLocaleString('en-PK')}</td>
                <td class="right">${mo.received.toLocaleString('en-PK')}</td>
                <td class="right">${mo.pending.toLocaleString('en-PK')}</td>
              </tr>
            </tfoot>
          </table>
        </div>` : ''}
      </div>
    </div>`;
  }).join('');
  return `<style>${HIST_REPORT_CSS}</style><body><div class="hist-page">
  ${histHeadHtml(meta, `Detailed Fee History — ${escHtml(s.name)}`, stLines)}
  <div class="hist-cards">
    <div class="hist-card"><div class="l">Total Challans</div><div class="v">${t.challans}</div></div>
    <div class="hist-card"><div class="l">Total Received</div><div class="v green">${t.recv.toLocaleString('en-PK')}</div></div>
    <div class="hist-card"><div class="l">Total Pending</div><div class="v red">${t.pend.toLocaleString('en-PK')}</div></div>
    <div class="hist-card"><div class="l">Paid / Unpaid</div><div class="v">${t.paidCount} / ${t.unpaid}</div></div>
  </div>
  ${cards}
</div>`;
}

function buildHistClassReportHTML({ mode, c, rows, period, school = null }) {
  const meta = feeReportSchool(school);
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
  ${histHeadHtml(meta, `Class ${mode === 'detail' ? 'Detailed History' : 'Ledger Summary'} — ${escHtml(c.cls)} (${escHtml(c.sec)})`, [
    `Students: ${rows.length}`,
    `Period: ${escHtml(period)}`,
  ])}
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

function buildHistOverallReportHTML({ mode, blocks, period, school = null }) {
  const meta = feeReportSchool(school);
  const grand = blocks.reduce((a, b) => {
    const sub = b.rows.reduce((x, { months }) => {
      const t = feeHistTotals(months);
      return { fee: x.fee + t.fee, recv: x.recv + t.recv, pend: x.pend + t.pend };
    }, { fee: 0, recv: 0, pend: 0 });
    return { fee: a.fee + sub.fee, recv: a.recv + sub.recv, pend: a.pend + sub.pend };
  }, { fee: 0, recv: 0, pend: 0 });

  const pages = blocks.map(({ c, rows }) => buildHistClassReportHTML({ mode, c, rows, period, school })).join('');

  return `<style>${HIST_REPORT_CSS}</style><body>
  <div class="hist-page">
    ${histHeadHtml(meta, `Overall ${mode === 'detail' ? 'Detailed Fee History' : 'Fee Ledger Summary'}`, [
      `Classes: ${blocks.length}`,
      `Period: ${escHtml(period)}`,
    ])}
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

/* Re-print the very challan that was raised for THIS student in THIS month.
   It goes through the real challan template (Parent / Bank / School copies)
   and is driven by that month's own BranchLedger record — `_challan` makes
   feeSlipHTML print the stored detailRows with their stored discounts, and
   the period / issue / due dates are the challan's own, not today's. So a
   reprint is the same challan the parent was handed, for the current student
   only — never a fresh one generated off the current fee setup. */
function buildHistMonthChallanHTML({ c, s, mo, year, heads = [], settings = {}, school = null, size = 'a4' }) {
  const css = size === 'thermal' ? FEE_THERMAL_CHALLAN_CSS : FEE_CHALLAN_CSS_PRINT;
  const inner = buildChallanInner({
    classMeta: c,
    students: [{ ...s, _challan: mo._rec }],
    heads,
    settings,
    discountMap: {},
    bw: false,
    size,
    school,
    period:   `${mo.monthName} ${year}`,
    issueISO: mo.challanDate !== '—' ? mo.challanDate : undefined,
    dueISO:   mo.dueDate     !== '—' ? mo.dueDate     : undefined,
  });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escHtml(`Fee Challan ${mo.monthName} ${year} — ${s.name}`)}</title>
<style>${css}</style></head><body>${inner}</body></html>`;
}

/* Re-print a single-month receipt slip using the synthesised history row
   (head amounts are not stored for past months, so this is a summary
   slip with the month's total payable / received / remaining). */
function buildHistMonthSlipHTML({ c, s, mo, year, size = 'a4', school = null }) {
  const meta = feeReportSchool(school);
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
  <div class="th-school">${escHtml(meta.name)}</div>
  ${meta.address ? `<div class="th-tag" style="border:0;padding:0;margin:0 0 2px;letter-spacing:0;text-transform:none">${escHtml(meta.address)}</div>` : ''}
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
    ${meta.logo ? `<img src="${escHtml(meta.logo)}" alt="logo" style="width:46px;height:46px;object-fit:contain;margin-bottom:6px" />` : ''}
    <div class="fee-slip-school">${escHtml(meta.name)}</div>
    ${meta.address ? `<div style="font-size:10px;color:#666;margin-top:2px">${escHtml(meta.address)}</div>` : ''}
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
      ${mo.heads.map(h => `<tr><td>${escHtml(headLabel(h.sub))}</td><td>${h.unpaid ? '—' : h.recv.toLocaleString('en-PK')}</td></tr>`).join('')}
      <tr><td><b>Total Challan</b></td><td><b>${mo.challanAmt.toLocaleString('en-PK')}</b></td></tr>
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
  { id: 'headwise',   ic: 'fa-layer-group',         name: 'Head-Wise Fee Collection', desc: 'Student-wise & class-wise by fee head' },
  /* Hidden per request — restore any entry to bring the tab back:
  { id: 'collection', ic: 'fa-hand-holding-dollar', name: 'General Fee Collections',  desc: 'Daily, monthly & paid-student lists' },
  { id: 'aging',      ic: 'fa-hourglass-half',      name: 'Aging / Outstanding',      desc: '30 / 60 / 90+ day overdue analysis' },
  { id: 'summary',    ic: 'fa-chart-pie',           name: 'Collection vs Expected',   desc: 'Realisation %, payment-mode breakdown' },
  */
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
const FeeReportBranchContext = React.createContext(null);

function FeeReportsTab({ toast }) {
  const [current, setCurrent] = useState('defaulter');
  const [style, setStyle]     = useState('color'); // 'color' | 'bw'
  const { data: branchHeader = null } = useAsync(feeService.getReportHeader, [], null);

  const onStyleKey = (e, value) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setStyle(value); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')   { e.preventDefault(); setStyle('color'); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw'); }
  };

  return (
    <FeeReportStyleContext.Provider value={style}>
      <FeeReportBranchContext.Provider value={branchHeader}>
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
                </div>
              </button>
            </Tooltip>
          ))}
        </div>

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

        {current === 'defaulter' && <ReportPanelDefaulter toast={toast} />}
        {current === 'collection' && <ReportPanelCollection toast={toast} />}
        {current === 'headwise'   && <ReportPanelHeadwise toast={toast} />}
        {current === 'aging'      && <ReportPanelAging toast={toast} />}
        {current === 'summary'    && <ReportPanelSummary toast={toast} />}
      </FeeReportBranchContext.Provider>
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
  const { can } = usePermissions();
  const canRepDownload = can('Fee', 'Reports', 'Download');
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <Tooltip text="Open A4 preview of this report">
        <button className="fee-btn fee-btn-primary" onClick={onPreview}>
          <i className="fa-solid fa-eye"></i> Preview
        </button>
      </Tooltip>
      {canRepDownload && (
      <Tooltip text="Generate the A4 PDF (Save as PDF from the print window)">
        <button className="fee-btn fee-btn-ghost" onClick={onPdf}>
          <i className="fa-solid fa-file-pdf"></i> PDF
        </button>
      </Tooltip>
      )}
    </div>
  );
}

/* The (month, year) pairs a report spans, oldest first. Capped so a wide date
   range can't fan out into an unbounded number of requests. */
function ledgerPeriods(fromM, fromY, toM, toY) {
  const out = [];
  let y = fromY, m = fromM;
  while ((y < toY || (y === toY && m <= toM)) && out.length < 36) {
    out.push({ month: m, year: y });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

/* Roll one student's challan records into the figures the panels and the A4
   builders expect. `heads` carries one row per fee head across all periods —
   unpaid heads land wholly in `pend`, partly-paid ones only for the shortfall. */
/* `settings` late fine ke liye — backend abhi fine ko apni detailRow me persist
   nahi karta, is liye jo challan due date ke BAAD receive hua uski fine yahan
   dobara compute kar ke payable/paid + Head-Wise me shaamil ki jaati hai. Jis din
   backend row bhejne lage, isLateFineRow match ho jaayegi aur ye reconstruction
   apne aap skip ho jaayegi (double-count nahi hoga). */
function ledgerModel(recs, settings = null) {
  const isPrev = (r) => /previous|pending|arrear/i.test(String(r.subHead || r.head || ''));
  /* Mahine-wise sort — running-ledger sahi chalne ke liye. */
  const list = (recs || []).slice().sort(
    (a, b) => (Number(a.year) * 12 + Number(a.month)) - (Number(b.year) * 12 + Number(b.month)),
  );

  const heads = new Map();
  let payable = 0, paid = 0, disc = 0;
  /* fineTotal = kul late fine (wasool + baqaya); fineRecv = jo wasool ho chuki. */
  let fineTotal = 0, fineRecv = 0;
  /* CARRY-FORWARD ke double-count se bachne ke liye running-ledger (Fee History jaisa):
     "Previous Pending" line pichle mahine ka hi baqaya hota hai — agar hum har mahine ka
     pending jod dein to wahi raqam do-do baar ginn jaati thi (e.g. 15,500 + 15,500 = 31,000).
     Is liye sirf PEHLE mahine ka carry opening balance, baaki running me already shaamil. */
  let running = 0, seen = false, advApplied = 0;
  list.forEach(rec => {
    const rows = rec.detailRows || [];
    const carrySigned = rows.filter(isPrev).reduce((a, r) => a + ((+r.challanAmount || 0) - (+r.discount || 0)), 0);
    const newBilled   = rows.filter(r => !isPrev(r)).reduce((a, r) => a + ledgerRowNet(r), 0);
    const received    = rows.reduce((a, r) => a + ledgerRowRecv(r), 0);
    const isFirst = !seen;
    if (isFirst) { running = carrySigned; seen = true; }
    const openDebt = isFirst ? Math.max(0, carrySigned) : 0;   // sirf pehle mahine ka pichla baqaya
    /* Is mahine laga pichla ADVANCE credit (running < 0 tha) — total advance me jodo. */
    if (running < 0) advApplied += Math.min(-running, newBilled);
    payable += newBilled + openDebt;
    paid    += received;
    disc    += rows.reduce((a, r) => a + (+r.discount || 0), 0);
    running += newBilled - received;

    /* Per-head aggregation (Head-Wise report ke liye) — waisa hi. */
    rows.forEach(r => {
      const sub = r.subHead || r.head || '—';
      const k   = `${r.head || ''}|${sub}`;
      const agg = heads.get(k) || { head: r.head || 'Account Payable', sub, total: 0, disc: 0, recv: 0, pend: 0 };
      agg.total += (+r.challanAmount || 0);
      agg.disc  += (+r.discount || 0);
      agg.recv  += ledgerRowRecv(r);
      /* Pending SIGNED — is head par (net − received). Us head me extra wasool ho (advance)
         to MINUS aayega, kam ho to bacha hua baqaya. Report me exactly wahi dikhega. */
      agg.pend  += ledgerRowNet(r) - ledgerRowRecv(r);
      heads.set(k, agg);
    });

    /* ── LATE FINE (reconstructed) ──
       Backend fine ko apni detailRow me persist nahi karta, is liye yahan dobara
       banti hai. Do surtein:
         a) Challan due date ke BAAD receive hua → fine WASOOL ho chuki. Base date
            ASLI receiving date (modifiedAt) hai, aaj nahi — warna purane challan
            ki fine roz barhti rehti. payable + paid dono me (net asar 0).
         b) Challan abhi tak unpaid hai aur due date guzar chuki → fine AAJ tak
            accrue ho chuki aur ABHI BAQAYA hai. payable + running me (paid me
            nahi) — isi se Defaulter report ka "Total Outstanding" sahi banta hai.
       Backend ne apni Late Fine row bhej di ho to kuch na karo (double-count nahi). */
    if (settings?.fineEnabled && !rows.some(feeService.isLateFineRow)) {
      const collected = received > 0;
      const base = collected
        ? String(rec.modifiedAt || rec.dateofCreattion || '').slice(0, 10)
        : localTodayISO();
      const fine = feeService.computeFine({ dueDate: rec.dueDate, receivingDate: base, settings });
      if (fine > 0) {
        fineTotal += fine;
        payable   += fine;
        if (collected) { paid += fine; fineRecv += fine; }
        else           { running += fine; }      // baqaya fine outstanding me
        const k   = `Account Payable|${feeService.LATE_FINE_HEAD}`;
        const agg = heads.get(k)
          || { head: 'Account Payable', sub: feeService.LATE_FINE_HEAD, total: 0, disc: 0, recv: 0, pend: 0 };
        agg.total += fine;
        if (collected) agg.recv += fine;
        else           agg.pend += fine;
        heads.set(k, agg);
      }
    }
  });
  const remaining = Math.max(0, running);   // CURRENT outstanding (de-duped)
  /* ADVANCE = pichhle overpay se aaya credit jo aage ke challans par laga (running < 0
     wale mahino se). Head-Wise report is se pending me se minus dikhati hai. */
  const advance = advApplied;

  /* Unpaid heads — SIRF aakhri (current) challan se, taake purane re-billed heads dobara
     na aayein. Advance/negative wale skip. */
  const latest = list[list.length - 1];
  const unpaidHeads = latest
    ? Array.from(new Set(
        (latest.detailRows || [])
          .filter(r => ledgerRowUnpaid(r) && ((+r.challanAmount || 0) - (+r.discount || 0)) > 0)
          .map(r => r.subHead || r.head || '—'),
      ))
    : [];

  return {
    billed: list.length > 0,
    payable, paid, remaining, disc, advance,
    /* Late fine alag se bhi — KPI tiles aur report footers is se "Fine Collected"
       / "Fine Outstanding" dikhate hain. */
    fine: fineTotal, fineRecv, finePend: Math.max(0, fineTotal - fineRecv),
    heads: Array.from(heads.values()),
    recs: list,
    unpaidHeads,
  };
}

/* Pulls the given periods' challans and joins them onto the class roster.
   Returns the same { classes, studentsMap, allStudents, totals } shape the
   panels already consume, so the A4 builders keep working untouched. */
function useLedgerReportData(periods) {
  const { data: classes = [] }     = useAsync(feeService.getFeeClasses, []);
  const { data: studentsMap = {} } = useAsync(feeService.getTransportFee, []);
  /* Late fine reports me dikhane ke liye settings chahiye (rate + on/off). */
  const { data: settings = {} }    = useAsync(feeService.getFeeSettings, []);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  /* Serialised so the effect re-runs on value, not identity, of `periods`. */
  const periodKey = JSON.stringify(periods || []);
  useEffect(() => {
    let alive = true;
    const list = JSON.parse(periodKey);
    if (!list.length) { setRecords([]); setLoading(false); return undefined; }
    setLoading(true);
    setError(null);
    Promise.all(list.map(p => feeService.getMonthChallans(p.month, p.year).catch(() => null)))
      .then(res => {
        if (!alive) return;
        if (res.every(r => r === null)) setError('Could not load challans from the ledger');
        setRecords(res.filter(Boolean).flat());
        setLoading(false);
      });
    return () => { alive = false; };
  }, [periodKey]);

  const allStudents = useMemo(() => {
    const byStudent = new Map();
    records.forEach(rec => {
      const k = String(rec.studentID);
      if (!byStudent.has(k)) byStudent.set(k, []);
      byStudent.get(k).push(rec);
    });
    const out = [];
    classes.forEach(c => {
      (studentsMap[c.key] || []).forEach(s => {
        const recs = byStudent.get(String(s.studentID)) || byStudent.get(String(s.applicantsID)) || [];
        out.push({ c, s, m: ledgerModel(recs, settings) });
      });
    });
    return out;
  }, [classes, studentsMap, records, settings]);

  /* Only billed students count — a student with no challan isn't a defaulter. */
  const totals = useMemo(() => {
    let exp = 0, recv = 0, pend = 0, disc = 0, def = 0, paid = 0, n = 0;
    let fine = 0, fineRecv = 0, finePend = 0;
    allStudents.forEach(({ m }) => {
      if (!m.billed) return;
      n += 1;
      exp += m.payable; recv += m.paid; pend += m.remaining; disc += m.disc;
      fine += (m.fine || 0); fineRecv += (m.fineRecv || 0); finePend += (m.finePend || 0);
      if (m.remaining > 0) def += 1; else paid += 1;
    });
    return { exp, recv, pend, disc, adv: 0, def, paid, n, fine, fineRecv, finePend };
  }, [allStudents]);

  return { classes, studentsMap, allStudents, totals, records, loading, error };
}

/* Per-head breakdown for one student. Head-Wise shows every head — paid,
   partly paid and unpaid alike; the receivedAmount === null filter belongs to
   the Defaulter report, not here. */
function ledgerHeadRows(m, headFilter) {
  const rows = m ? m.heads : [];
  if (headFilter && headFilter !== 'All Heads') return rows.filter(r => r.sub === headFilter);
  return rows;
}

/* Small inline banner for the ledger fetch state. */
function RepLoadState({ loading, error, empty, emptyText }) {
  if (loading) return <div className="fee-info"><i className="fa-solid fa-circle-notch fa-spin"></i> <span>Loading challans from the ledger…</span></div>;
  if (error)   return <div className="fee-info" style={{ color: '#B91C1C' }}><i className="fa-solid fa-triangle-exclamation"></i> <span>{error}</span></div>;
  if (empty)   return <div className="fee-info"><i className="fa-solid fa-circle-info"></i> <span>{emptyText}</span></div>;
  return null;
}

/* ════════════ 1. DEFAULTER LIST ════════════ */
function ReportPanelDefaulter({ toast }) {
  const repStyle              = useContext(FeeReportStyleContext);
  const school                = useContext(FeeReportBranchContext);
  const [seg, setSeg]         = useState('all');
  const [openKey, setOpenKey] = useState(null);
  const [month, setMonth]     = useState(FEE_MONTHS[new Date().getMonth()]);
  const [year, setYear]       = useState(String(new Date().getFullYear()));

  /* "All" walks January → the current month of the picked year and aggregates;
     "Monthly" pulls just the selected month. Same ledger call either way. */
  const periods = useMemo(() => {
    const now = new Date();
    const y   = Number(year) || now.getFullYear();
    if (seg === 'month') return [{ month: FEE_MONTHS.indexOf(month) + 1, year: y }];
    const upto = y === now.getFullYear() ? now.getMonth() + 1 : 12;
    return ledgerPeriods(1, y, upto, y);
  }, [seg, month, year]);

  const { classes, studentsMap, allStudents, totals, loading, error } = useLedgerReportData(periods);

  const downloadReport = (mode) => {
    const html = buildRepDefaulterHTML({ classes, studentsMap, allStudents, totals, month, year, scope: seg, isBW: repStyle === 'bw', school });
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
        <span>
          Defaulters are students whose challan heads are still unpaid in the ledger (no amount received yet).
          {seg === 'all'
            ? ' All Fee Defaulters aggregates every month from January up to the current month of the selected year.'
            : ' Monthly Fee Defaulters shows only the selected month.'}
          {' '}Open any class to see student dues; download a class-wise A4 report via Preview / PDF.
        </span>
      </div>

      <RepLoadState loading={loading} error={error} />

      {repKpiStrip([
        ['k-red',   'fa-user-clock',           'Total Defaulters', `${totals.def} students`, ''],
        ['k-amber', 'fa-money-bill-trend-up',  'Total Outstanding', fmtRs(totals.pend),
          totals.finePend > 0 ? `incl. fine ${fmtRs(totals.finePend)}` : ''],
        /* Late fine apni tile me — kitni banni aur usme se kitni wasool hui. */
        ['k-red',   'fa-triangle-exclamation', 'Fine',              fmtRs(totals.fine),
          totals.fine > 0 ? `${fmtRs(totals.fineRecv)} collected · ${fmtRs(totals.finePend)} pending` : 'No overdue challans'],
        ['k-blue',  'fa-users',                'Students Billed',   `${totals.n}`,            ''],
        ['k-green', 'fa-circle-check',         'Fully Cleared',     `${totals.paid} students`, ''],
      ])}

      <div className="fee-section fee-section--overflow">
        <div className="fee-section-body">
          <div className="fee-filters">
            <div className="fee-field">
              <span className="fee-label">Select Month</span>
              <div className="fee-select-wrap">
                {/* The All scope spans every month, so the picker only drives the Monthly view. */}
                <select className="fee-select" value={month} onChange={e => setMonth(e.target.value)} disabled={seg === 'all'}>
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
                              <th>Unpaid Heads</th>
                              {/* Due date guzarne par banti fine — Total Pending me shaamil. */}
                              <th className="fee-right">Fine</th>
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
                                <td>{x.m.unpaidHeads.length ? x.m.unpaidHeads.join(', ') : '—'}</td>
                                <td className={`fee-right${x.m.finePend > 0 ? ' fee-fine' : ''}`}>
                                  {x.m.finePend > 0 ? money(x.m.finePend) : '0'}
                                </td>
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
  const school          = useContext(FeeReportBranchContext);
  const [seg, setSeg]   = useState('daily');
  const [openKey, setOpenKey] = useState(null);
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate]     = useState(today);
  const [month, setMonth]   = useState(FEE_MONTHS[4]);
  const [from, setFrom]     = useState('2026-05-01');
  const [to, setTo]         = useState(today);

  const downloadReport = (mode) => {
    const html = buildRepCollectionHTML({ classes, studentsMap, allStudents, paymentsFor, seg, date, month, from, to, isBW: repStyle === 'bw', school });
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
  const school = useContext(FeeReportBranchContext);
  const [seg, setSeg] = useState('student');
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom]       = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo]           = useState(today);
  const [stuKey, setStuKey]   = useState('');
  const [clsKey, setClsKey]   = useState('');
  const [head, setHead]       = useState('All Heads');
  const [result, setResult]   = useState(null);

  /* The ledger is billed per month, so the date range resolves to the months it
     covers and every challan in those months is pulled. */
  const periods = useMemo(() => {
    const f = new Date(from), t = new Date(to);
    if (isNaN(f.getTime()) || isNaN(t.getTime()) || f > t) return [];
    return ledgerPeriods(f.getMonth() + 1, f.getFullYear(), t.getMonth() + 1, t.getFullYear());
  }, [from, to]);

  const { classes, allStudents, records, loading, error } = useLedgerReportData(periods);
  useEffect(() => { if (classes.length && !clsKey) setClsKey(classes[0].key); }, [classes, clsKey]);

  /* Head options come from the heads the ledger actually billed in this range. */
  const allHeads = useMemo(() => {
    const set = new Set();
    records.forEach(rec => (rec.detailRows || []).forEach(r => set.add(r.subHead || r.head || '—')));
    /* Late Fine ledger me persist nahi hoti (reconstruct hoti hai), is liye wo
       detailRows se nahi milti — lekin filter me available honi chahiye. */
    if (allStudents.some(x => (x.m.fine || 0) > 0)) set.add(feeService.LATE_FINE_HEAD);
    return ['All Heads', ...Array.from(set).sort()];
  }, [records, allStudents]);
  useEffect(() => { if (head !== 'All Heads' && !allHeads.includes(head)) setHead('All Heads'); }, [allHeads, head]);

  const fetchResult = () => {
    if (loading) { toast('Ledger is still loading — try again in a moment', 'warning'); return; }
    if (seg === 'student') {
      if (!stuKey) { toast('Select a student first', 'warning'); return; }
      const [ck, reg] = stuKey.split('|');
      const hit = allStudents.find(x => x.c.key === ck && x.s.reg === reg);
      if (!hit) { toast('Student not found', 'warning'); return; }
      const rows = ledgerHeadRows(hit.m, head);
      setResult({ kind: 'student', c: hit.c, s: hit.s, rows, from, to });
      toast(rows.length ? 'Head-wise data loaded' : 'No challans for this student in the selected range', rows.length ? 'info' : 'warning');
    } else {
      const c = classes.find(x => x.key === clsKey);
      if (!c) { toast('Select a class first', 'warning'); return; }
      const rows = allStudents
        .filter(x => x.c.key === clsKey && x.m.billed)
        .map(({ s, m }) => ({ s, m, heads: ledgerHeadRows(m, head) }))
        .filter(x => x.heads.length > 0);
      setResult({ kind: 'class', c, rows, from, to });
      toast(rows.length ? 'Class head-wise data loaded' : 'No challans for this class in the selected range', rows.length ? 'info' : 'warning');
    }
  };

  const [preview, setPreview] = useState(null);
  const downloadReport = (mode) => {
    if (!result) { toast('Fetch the data first', 'warning'); return; }
    if (mode === 'preview') {
      setPreview({ ...result, head });
      return;
    }
    const html = buildRepHeadwiseHTML({ ...result, head, isBW: repStyle === 'bw', school });
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
        <span>Break down collection by individual fee head (Admission, Monthly Fee, Transport, etc.) for a student or class over a date range — essential for revenue accounting. Every billed head is listed, whether it has been received, part-received or is still outstanding.</span>
      </div>

      <RepLoadState
        loading={loading}
        error={error}
        empty={!loading && !error && periods.length === 0}
        emptyText="Pick a valid From / To range to load the ledger."
      />

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
                  {/* value = asal head naam (filter isi par match karta hai),
                      label = UI naam — "Late Fine" user ko "Fine" dikhta hai. */}
                  {allHeads.map(h => <option key={h} value={h}>{headLabel(h)}</option>)}
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
                      <td><b>{headLabel(r.sub)}</b></td>
                      <td className="fee-right">{money(r.total)}</td>
                      <td className="fee-right">{money(r.disc)}</td>
                      <td className="fee-right fee-paid-amt">{money(r.recv)}</td>
                      {/* Pending: baqaya (positive, red) | advance (negative, red) | 0. */}
                      <td className="fee-right">{r.pend !== 0 ? <span className="fee-neg">{money(r.pend)}</span> : '0'}</td>
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
                    <th className="fee-right">Advance</th>
                    <th className="fee-right">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.length === 0 ? (
                    <tr><td colSpan="8" className="fee-stbl-empty">No students.</td></tr>
                  ) : result.rows.map(({ s, m, heads: rows }, j) => {
                    const sum = rows.reduce((a, r) => ({ total: a.total + r.total, disc: a.disc + r.disc, recv: a.recv + r.recv, pend: a.pend + r.pend }), { total: 0, disc: 0, recv: 0, pend: 0 });
                    /* "All Heads" par pura student ka SAHI outstanding (m.remaining, de-duped +
                       advance) dikhao; kisi khaas head par us head ka apna hisaab. */
                    const allHeads = head === 'All Heads';
                    const adv  = allHeads ? (m?.advance || 0) : 0;
                    const pend = allHeads ? (m?.remaining || 0) : sum.pend;
                    return (
                      <tr key={s.reg}>
                        <td className="fee-num">{j + 1}</td>
                        <td><b>{s.name}</b><span className="fee-sub-eq">s/o {s.father || '—'}</span></td>
                        <td>{s.reg}</td>
                        <td className="fee-right">{money(sum.total)}</td>
                        <td className="fee-right">{money(sum.disc)}</td>
                        <td className="fee-right fee-paid-amt">{money(sum.recv)}</td>
                        <td className={`fee-right${adv > 0 ? ' fee-neg' : ''}`}>{money(adv > 0 ? -adv : 0)}</td>
                        <td className="fee-right">{pend !== 0 ? <span className="fee-neg">{money(pend)}</span> : '0'}</td>
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
          const html = buildRepHeadwiseHTML({ ...preview, isBW: repStyle === 'bw', school });
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
                      <td><b>{headLabel(r.sub)}</b></td>
                      <td className="fee-right">{money(r.total)}</td>
                      <td className="fee-right">{money(r.disc)}</td>
                      <td className="fee-right fee-paid-amt">{money(r.recv)}</td>
                      <td className="fee-right">{r.pend !== 0 ? <span className="fee-neg">{money(r.pend)}</span> : '0'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="fee-recv-total">
                    <td colSpan="3" style={{ textAlign: 'right', fontWeight: 800 }}>Total</td>
                    <td className="fee-right">{money(sum.total)}</td>
                    <td className="fee-right">{money(sum.disc)}</td>
                    <td className="fee-right fee-paid-amt">{money(sum.recv)}</td>
                    <td className="fee-right">{sum.pend !== 0 ? <span className="fee-neg">{money(sum.pend)}</span> : '0'}</td>
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
                        <td className="fee-right">{t.pend !== 0 ? <span className="fee-neg">{money(t.pend)}</span> : '0'}</td>
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
                    <td className="fee-right">{sum.pend !== 0 ? <span className="fee-neg">{money(sum.pend)}</span> : '0'}</td>
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

/* ════════════ 4. AGING / OUTSTANDING ════════════ */
function ReportPanelAging({ toast }) {
  const repStyle = useContext(FeeReportStyleContext);
  const school = useContext(FeeReportBranchContext);
  const { classes, allStudents } = useReportData();
  const list = useMemo(() => allStudents
    .filter(x => x.m.remaining > 0)
    .map(x => ({ ...x, a: repAgingFromModel(x.m) })), [allStudents]);
  const tot = list.reduce((o, x) => ({ cur: o.cur + x.a.cur, d30: o.d30 + x.a.d30, d60: o.d60 + x.a.d60, d90: o.d90 + x.a.d90 }), { cur: 0, d30: 0, d60: 0, d90: 0 });

  const downloadReport = (mode) => {
    const html = buildRepAgingHTML({ list, tot, asOf: new Date().toISOString().slice(0, 10), isBW: repStyle === 'bw', school });
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
  const school = useContext(FeeReportBranchContext);
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
    const html = buildRepSummaryHTML({ totals, real, modes, modeTot, sectionsData, isBW: repStyle === 'bw', school });
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
    const html = buildRepPayModeHTML({ method: mode, rows, isBW: repStyle === 'bw', school });
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
/* Colorful report ka background/color PDF/print me bhi aaye. */
html,body,*{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important;}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff}
body{font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#111;font-size:10.5px;line-height:1.4}
.rep-page{width:210mm;min-height:297mm;margin:0 auto;padding:14mm;background:#fff}
.rep-head{display:flex;align-items:center;gap:14px;border-bottom:2px solid #1E3A8A;padding-bottom:10px;margin-bottom:10px}
.rep-logo{width:42px;height:42px;border:2px solid #1E3A8A;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#1E3A8A;font-weight:800}
.rep-logo img{width:100%;height:100%;object-fit:contain;border-radius:50%;background:#fff}
.rep-name{font-size:18px;font-weight:800;color:#1E3A8A;line-height:1.1}
.rep-title{font-size:12px;font-weight:600;color:#444;margin-top:3px}
.rep-addr,.rep-session{font-size:9.5px;color:#64748B;margin-top:2px;max-width:420px}
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

function feeReportSchool(school) {
  const name = school?.branchName || school?.name || FEE_SCHOOL.name;
  const words = String(name).split(/\s+/).filter(Boolean);
  return {
    name,
    monogram: school?.monogram || words.map(w => w[0]).slice(0, 2).join('').toUpperCase() || FEE_SCHOOL.monogram,
    address: school?.address || '',
    logo: school?.branchLogo || school?.logo || '',
    session: school?.academicSession || school?.session || '',
    generatedDate: school?.generatedDate || null,
    generatedBy: school?.generatedBy || sessionStorage.getItem('displayName') || sessionStorage.getItem('userName') || 'Fee',
  };
}

function feeReportDate(school) {
  const d = school?.generatedDate ? new Date(school.generatedDate) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().toLocaleDateString('en-GB') : d.toLocaleDateString('en-GB');
}

function feeReportLogoHtml(school) {
  return school.logo
    ? `<img src="${escHtml(school.logo)}" alt="${escHtml(school.name)} logo" />`
    : escHtml(school.monogram);
}

function repWrap(title, filters, body, isBW = false, school = null) {
  const meta = feeReportSchool(school);
  const today = feeReportDate(meta);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escHtml(meta.name)} — ${escHtml(title)}</title>
<style>${REP_A4_CSS}</style></head><body${isBW ? ' class="fee-rep-bw"' : ''}><div class="rep-page">
  <div class="rep-head">
    <div class="rep-logo">${feeReportLogoHtml(meta)}</div>
    <div>
      <div class="rep-name">${escHtml(meta.name)}</div>
      <div class="rep-title">${escHtml(title)}${isBW ? ' · <b>Colorless Print</b>' : ''}</div>
      ${meta.address ? `<div class="rep-addr">${escHtml(meta.address)}</div>` : ''}
      ${meta.session ? `<div class="rep-session">Academic Session: ${escHtml(meta.session)}</div>` : ''}
    </div>
  </div>
  <div class="rep-filters">${filters}</div>
  ${body}
  <div class="rep-foot">Computer generated report — ${escHtml(meta.name)} · ${escHtml(title)} · ${escHtml(today)} · By: ${escHtml(meta.generatedBy)}</div>
</div></body></html>`;
}

function buildRepDefaulterHTML({ classes, studentsMap, allStudents, totals, month, year, scope = 'all', isBW = false, school = null }) {
  const blocks = classes.map(c => {
    const defs = (studentsMap[c.key] || []).map(s => {
      const m = allStudents.find(x => x.c.key === c.key && x.s.reg === s.reg)?.m;
      return m && m.remaining > 0 ? { s, m } : null;
    }).filter(Boolean);
    if (!defs.length) return '';
    const sub     = defs.reduce((a, x) => a + x.m.remaining, 0);
    const subFine = defs.reduce((a, x) => a + (x.m.finePend || 0), 0);
    return `<div class="rep-secttl">${escHtml(c.cls)} — Section ${escHtml(c.sec)} · ${defs.length} defaulter(s)</div>
      <table class="rep-tbl">
        <thead><tr><th>Sn.</th><th>Student</th><th>Father</th><th>Reg No</th><th>Contact</th><th>Unpaid Heads</th><th class="r">Fine</th><th class="r">Pending</th></tr></thead>
        <tbody>${defs.map((x, j) => `<tr><td>${j + 1}</td><td><b>${escHtml(x.s.name)}</b></td><td>${escHtml(x.s.father || '—')}</td><td>${escHtml(x.s.reg)}</td><td>${escHtml(studentPhone(x.s))}</td><td>${escHtml((x.m.unpaidHeads || []).join(', ') || '—')}</td><td class="r ${x.m.finePend > 0 ? 'neg' : ''}">${(x.m.finePend || 0).toLocaleString('en-PK')}</td><td class="r neg">${(x.m.remaining).toLocaleString('en-PK')}</td></tr>`).join('')}</tbody>
        <tfoot><tr class="rep-tot"><td colspan="6">${escHtml(c.cls)}/${escHtml(c.sec)} Subtotal</td><td class="r">${subFine.toLocaleString('en-PK')}</td><td class="r">${sub.toLocaleString('en-PK')}</td></tr></tfoot>
      </table>`;
  }).filter(Boolean).join('');

  return repWrap(
    scope === 'month' ? `Fee Defaulter List — ${month} ${year}` : 'Fee Defaulter List — All',
    `<span><b>Scope:</b> ${scope === 'month' ? `${month} ${year}` : 'All Periods'}</span><span><b>Defaulters:</b> ${totals.def}</span><span><b>Outstanding:</b> Rs. ${totals.pend.toLocaleString('en-PK')}</span>`,
    `<div class="kpi-row">
      <div class="kpi"><div class="l">Total Defaulters</div><div class="v">${totals.def}</div></div>
      <div class="kpi"><div class="l">Outstanding</div><div class="v">Rs. ${totals.pend.toLocaleString('en-PK')}</div></div>
      <div class="kpi"><div class="l">Fine (pending)</div><div class="v">Rs. ${(totals.finePend || 0).toLocaleString('en-PK')}</div></div>
      <div class="kpi"><div class="l">Students Billed</div><div class="v">${totals.n}</div></div>
      <div class="kpi"><div class="l">Fully Cleared</div><div class="v">${totals.paid}</div></div>
    </div>
    ${blocks || '<div style="text-align:center;color:#94A3B8;padding:20px">No defaulters — congratulations!</div>'}`,
  isBW,
  school,
  );
}

function buildRepCollectionHTML({ classes, studentsMap, allStudents, paymentsFor, seg, date, month, from, to, isBW = false, school = null }) {
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
    school,
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
  school,
  );
}

function buildRepHeadwiseHTML({ kind, c, s, rows, from, to, head, isBW = false, school = null }) {
  if (kind === 'student') {
    const sum = rows.reduce((a, r) => ({ total: a.total + r.total, disc: a.disc + r.disc, recv: a.recv + r.recv, pend: a.pend + r.pend }), { total: 0, disc: 0, recv: 0, pend: 0 });
    return repWrap(`Head-Wise Collection — ${s.name}`,
      `<span><b>Class:</b> ${escHtml(c.cls)} / ${escHtml(c.sec)}</span><span><b>Reg:</b> ${escHtml(s.reg)}</span><span><b>Head:</b> ${escHtml(head)}</span><span><b>Range:</b> ${escHtml(from)} → ${escHtml(to)}</span>`,
      `<table class="rep-tbl"><thead><tr><th>Sn.</th><th>Account Type</th><th>Fee Head</th><th class="r">Standard</th><th class="r">Discount</th><th class="r">Received</th><th class="r">Pending</th></tr></thead>
        <tbody>${rows.map((r, j) => `<tr><td>${j + 1}</td><td>${escHtml(r.head)}</td><td><b>${escHtml(headLabel(r.sub))}</b></td><td class="r">${r.total.toLocaleString('en-PK')}</td><td class="r">${r.disc.toLocaleString('en-PK')}</td><td class="r pos">${r.recv.toLocaleString('en-PK')}</td><td class="r ${r.pend !== 0 ? 'neg' : ''}">${r.pend.toLocaleString('en-PK')}</td></tr>`).join('')}</tbody>
        <tfoot><tr class="rep-tot"><td colspan="3">Total</td><td class="r">${sum.total.toLocaleString('en-PK')}</td><td class="r">${sum.disc.toLocaleString('en-PK')}</td><td class="r">${sum.recv.toLocaleString('en-PK')}</td><td class="r">${sum.pend.toLocaleString('en-PK')}</td></tr></tfoot>
      </table>`, isBW, school);
  }
  /* class — on-screen table ke bilkul barabar: Advance column + "All Heads" par
     pura student ka SAHI outstanding (m.remaining, de-duped) aur advance; kisi khaas
     head par us head ka apna sum. Pehle PDF me Advance column hi nahi tha aur pending
     sum.pend (carry-forward double-count) dikhata tha — Preview se match nahi karta tha. */
  const allHeadsSel = head === 'All Heads';
  const rowPend = (m, sum) => (allHeadsSel ? (m?.remaining || 0) : sum.pend);
  const rowAdv  = (m)      => (allHeadsSel ? (m?.advance   || 0) : 0);
  const trs = (rows || []).map(({ s, m, heads }, j) => {
    const sum = heads.reduce((a, r) => ({ total: a.total + r.total, disc: a.disc + r.disc, recv: a.recv + r.recv, pend: a.pend + r.pend }), { total: 0, disc: 0, recv: 0, pend: 0 });
    const adv = rowAdv(m), pend = rowPend(m, sum);
    return `<tr><td>${j + 1}</td><td><b>${escHtml(s.name)}</b><br><small>s/o ${escHtml(s.father || '—')}</small></td><td>${escHtml(s.reg)}</td><td class="r">${sum.total.toLocaleString('en-PK')}</td><td class="r">${sum.disc.toLocaleString('en-PK')}</td><td class="r pos">${sum.recv.toLocaleString('en-PK')}</td><td class="r ${adv > 0 ? 'neg' : ''}">${(adv > 0 ? -adv : 0).toLocaleString('en-PK')}</td><td class="r ${pend !== 0 ? 'neg' : ''}">${pend.toLocaleString('en-PK')}</td></tr>`;
  }).join('');
  const foot = (rows || []).reduce((a, { m, heads }) => {
    const sum = heads.reduce((b, r) => ({ total: b.total + r.total, disc: b.disc + r.disc, recv: b.recv + r.recv, pend: b.pend + r.pend }), { total: 0, disc: 0, recv: 0, pend: 0 });
    return { total: a.total + sum.total, disc: a.disc + sum.disc, recv: a.recv + sum.recv, adv: a.adv + rowAdv(m), pend: a.pend + rowPend(m, sum) };
  }, { total: 0, disc: 0, recv: 0, adv: 0, pend: 0 });
  return repWrap(`Class Head-Wise Collection — ${c.cls} (${c.sec})`,
    `<span><b>Class:</b> ${escHtml(c.cls)} — ${escHtml(c.sec)}</span><span><b>Head:</b> ${escHtml(head)}</span><span><b>Range:</b> ${escHtml(from)} → ${escHtml(to)}</span>`,
    `<table class="rep-tbl"><thead><tr><th>Sn.</th><th>Student</th><th>Reg No</th><th class="r">Standard</th><th class="r">Discount</th><th class="r">Received</th><th class="r">Advance</th><th class="r">Pending</th></tr></thead><tbody>${trs}</tbody>
      <tfoot><tr class="rep-tot"><td colspan="3">Total</td><td class="r">${foot.total.toLocaleString('en-PK')}</td><td class="r">${foot.disc.toLocaleString('en-PK')}</td><td class="r">${foot.recv.toLocaleString('en-PK')}</td><td class="r">${(foot.adv > 0 ? -foot.adv : 0).toLocaleString('en-PK')}</td><td class="r">${foot.pend.toLocaleString('en-PK')}</td></tr></tfoot>
    </table>`, isBW, school);
}

function buildRepAgingHTML({ list, tot, asOf, isBW = false, school = null }) {
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
    </table>`, isBW, school);
}

function buildRepSummaryHTML({ totals, real, modes, modeTot, sectionsData, isBW = false, school = null }) {
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
    <table class="rep-tbl"><thead><tr><th>Sn.</th><th>Method</th><th class="r">Amount</th><th class="r">% of Receipts</th></tr></thead><tbody>${modeRows}</tbody></table>`, isBW, school);
}

function buildRepPayModeHTML({ method, rows, isBW = false, school = null }) {
  const trs = rows.map((r, j) => `<tr><td>${j + 1}</td><td><b>${escHtml(r.name)}</b><br><small>s/o ${escHtml(r.father || '—')}</small></td><td>${escHtml(r.cls)}</td><td>${escHtml(r.reg)}</td><td>${escHtml(r.date)}${r.time ? `<br><small>${escHtml(fmtTime12(r.time))}</small>` : ''}</td><td>${escHtml(r.ref)}</td><td class="r pos">${(+r.amt || 0).toLocaleString('en-PK')}</td></tr>`).join('');
  const total = rows.reduce((a, r) => a + (+r.amt || 0), 0);
  return repWrap(`${method} Collections`,
    `<span><b>Mode:</b> ${escHtml(method)}</span><span><b>Records:</b> ${rows.length}</span><span><b>Total:</b> Rs. ${total.toLocaleString('en-PK')}</span>`,
    `<table class="rep-tbl"><thead><tr><th>Sn.</th><th>Student</th><th>Class/Sec</th><th>Reg No</th><th>Date &amp; Time</th><th>Reference</th><th class="r">Amount</th></tr></thead>
      <tbody>${trs || `<tr><td colspan="7" style="text-align:center;color:#94A3B8">No payments via ${escHtml(method)}.</td></tr>`}</tbody>
      <tfoot><tr class="rep-tot"><td colspan="6">Total</td><td class="r">${total.toLocaleString('en-PK')}</td></tr></tfoot>
    </table>`, isBW, school);
}

function buildTransportReportHTML({ cls, sec, rows, isBW = false, school = null }) {
  const meta = feeReportSchool(school);
  const charged   = rows.filter(r => +r.transport > 0);
  const subtotal  = rows.reduce((s, r) => s + (+r.transport || 0), 0);
  const today = meta.generatedDate
    ? feeReportDate(meta)
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const trs = rows.map((s, i) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #E5E7EB">${i + 1}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #E5E7EB">${escHtml(s.reg)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #E5E7EB"><b>${escHtml(s.name)}</b></td>
      <td style="padding:8px 10px;border-bottom:1px solid #E5E7EB">${escHtml(s.father)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #E5E7EB;text-align:right;font-variant-numeric:tabular-nums">${+s.transport > 0 ? `Rs. ${(+s.transport).toLocaleString('en-PK')}` : '<span style="color:#94A3B8">—</span>'}</td>
    </tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escHtml(`${meta.name} — Transport Fee — ${cls} (${sec})`)}</title>
<style>
  body { margin:0; font-family:'Segoe UI',Arial,sans-serif; color:#0F172A; background:#fff; font-size:13px; }
  .page { width:210mm; margin:0 auto; padding:18mm 14mm; box-sizing:border-box; }
  .header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #1E3A8A; padding-bottom:14px; margin-bottom:18px; }
  .brand { display:flex; align-items:center; gap:12px; }
  .logo { width:44px; height:44px; border:1px solid #BFDBFE; border-radius:12px; display:flex; align-items:center; justify-content:center; overflow:hidden; color:#1E3A8A; font-weight:800; background:#fff; }
  .logo img { width:100%; height:100%; object-fit:contain; }
  .school { font-size:18px; font-weight:800; color:#1E3A8A; letter-spacing:-.01em; }
  .title  { font-size:14px; font-weight:700; color:#1E40AF; margin-top:6px; }
  .addr { font-size:10px; color:#64748B; margin-top:3px; max-width:360px; }
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
    <div class="brand">
      <div class="logo">${feeReportLogoHtml(meta)}</div>
      <div>
        <div class="school">${escHtml(meta.name)}</div>
        <div class="title">Transport Fee — ${escHtml(cls)} (${escHtml(sec)})</div>
        ${meta.address ? `<div class="addr">${escHtml(meta.address)}</div>` : ''}
        ${meta.session ? `<div class="addr">Academic Session: ${escHtml(meta.session)}</div>` : ''}
      </div>
    </div>
    <div class="meta">Generated: ${escHtml(today)}<br/>By: ${escHtml(meta.generatedBy)}<br/>${charged.length} of ${rows.length} student${rows.length === 1 ? '' : 's'} using transport</div>
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
};

/* ── 1Link PSID ──────────────────────────────────────────────────────
   PSID har challan ka apna hota hai aur BranchLedger record par aata hai
   (`_challan.plpsid`). Pehle yahan ek hardcoded number tha jo HAR bachche
   ke challan par same chhapta tha — parent kisi ka bhi challan scan karta
   to paisa ek hi PSID par jata. Ab record se aata hai; na mile to PSID
   block bilkul nahi chhapta (ghalat number chhapne se behtar hai). */
const psidOf = (rec) => feeService.psidOf(rec);

/* Challan par dikhne wala grouped form — 432198765432 → 4321-9876-5432. */
const psidPretty = (psid) => feeService.formatPsid(psid);

/* QR asli PSID se banta hai (pehle ek decorative SVG tha jo kisi bhi
   scanner me kuch bhi nahi kholta tha). Payload sirf PSID digits — 1Link
   bill-payment apps yahi expect karte hain. */
const psidQrSvg = (psid, size = 52) => {
  const d = String(psid || '').replace(/\D/g, '');
  if (!d) return '';
  try { return qrSvg(d, { size, margin: 2 }); } catch { return ''; }
};

const FEE_LOGO_SVG = `<svg viewBox="0 0 16 16" fill="none"><path d="M8 1L1 5l7 3.5L15 5 8 1z" stroke="#111" stroke-width="1" stroke-linejoin="round"/><path d="M1 9l7 3.5L15 9" stroke="#111" stroke-width="0.8" stroke-linecap="round"/><path d="M1 12l7 3.5L15 12" stroke="#111" stroke-width="0.5" stroke-linecap="round" opacity="0.5"/></svg>`;

/* Scoped under .fee-challan-doc so it can be embedded in the in-app preview
   without leaking into surrounding styles. */
const FEE_CHALLAN_CSS_SCOPED = `
/* Colorful challan ka background/color PDF/print me bhi aaye. */
html,body,.fee-challan-doc,.fee-challan-doc *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important;}
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

function feeSlipHTML({ copyLabel, classMeta, student, heads, settings, period, issueISO, dueISO, studentDisc, school }) {
  const showDisc = settings.showDiscount !== false;
  const showPsd  = settings.showPsd      !== false;
  const fine     = !!settings.fineEnabled;
  const fineAmt  = +settings.fineAmt || 0;
  const fineType = settings.fineType || 'fixed';
  const disMap   = studentDisc || {};
  const schName  = school?.name || FEE_SCHOOL.name;
  const schAddr  = school?.address || '';
  const schDate  = feeReportDate(school);
  const logoHtml = school?.logo
    ? `<img src="${escHtml(school.logo)}" alt="${escHtml(schName)} logo" style="width:100%;height:100%;object-fit:contain;border-radius:50%;" />`
    : FEE_LOGO_SVG;

  /* Backend amounts integer me store karta hai aur list/cards bhi whole rupees dikhate
     hain — challan par decimal na aaye, is liye har amount ko whole rupee par round. */
  const whole = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : 0; };

  /* Prefer the real generated challan's detailRows so every head the API returned
     (incl. "Previous Pending") is printed; fall back to the class fee-head config. */
  const detailRows = student?._challan?.detailRows;
  let rows, arrears;
  if (Array.isArray(detailRows) && detailRows.length) {
    /* ADVANCE (negative "Previous Pending") ko head-table se bahar nikaalo — wo Total ke
       BAAD "Arrears / Advance" me minus hota hai. Warna wo discount column me chala jata
       tha (Std −1,770 / Disc −1,770 / Net 0) aur Net Payable se ghatta hi nahi tha. */
    let advOut = 0;
    const billRows = detailRows.filter(r => {
      const isPrev = /previous|pending|arrear/i.test(String(r.subHead || r.head || ''));
      if (isPrev && whole(r.challanAmount) < 0) { advOut += Math.abs(whole(r.challanAmount)); return false; }
      return true;
    });
    rows = billRows.map(r => {
      const name = r.subHead || r.head || '';
      const std  = whole(r.challanAmount);
      /* Har challan apna HI stored discount dikhata hai — jo us mahine generate karte
         waqt laga tha. Discount baad me badalne se PURANE mahino ke challan nahi
         badalne chahiye; naya discount sirf aage banne wale challan par lagta hai. */
      const raw  = whole(r.discount);
      const disc = showDisc ? Math.min(raw, std) : 0;
      return { name, std, disc, net: std - disc };
    });
    /* If the challan didn't carry a transport line, fall back to the student's
       Transport Setup amount so the download always reflects transport. */
    const hasTransport = detailRows.some(r => String(r.subHead || r.head || '').toLowerCase().trim() === 'transport');
    if (!hasTransport && whole(student.transport) > 0) {
      const t = whole(student.transport);
      rows.push({ name: 'Transport', std: t, disc: 0, net: t });
    }
    arrears = -advOut;   // advance → Total ke baad minus
  } else {
    rows = heads.map(h => {
      const raw   = whole(h.amt);
      const dRaw  = whole(disMap[h.name]);
      const disc  = showDisc ? Math.min(dRaw, raw) : 0;
      return { name: h.name, std: raw, disc, net: raw - disc };
    });
    arrears = whole(student.dues) - whole(student.advance);
  }
  const tNet    = rows.reduce((a, r) => a + r.net, 0);
  const payable = tNet + arrears;
  const fineTxt = `Rs. ${fineAmt.toLocaleString('en-PK')}`;
  /* Due date guzar chuki ho to AAJ tak banti fine — slip par sirf formula nahi,
     asli raqam bhi dikhe taake parent ko pata ho ab kitna dena hai.

     DO shartein, dono zaroori:
     1. Fine agar pehle hi ek "Late Fine" row ki soorat me challan par bill ho
        chuki hai to wo `rows`/`tNet` me shamil hai — dobara compute kar ke jodna
        usay DOHRA kar deta tha (Total 8,800 magar "After Due Date" 9,600).
     2. Challan poora wasool ho chuka ho to "Payable After Due Date" ka koi
        maani nahi — chhapi hui slip par parent se mazeed raqam maangi ja rahi
        thi jabke uska kuch baqaya tha hi nahi. */
  const billedFine = (detailRows || []).filter(feeService.isLateFineRow)
    .reduce((a, r) => a + whole(r.challanAmount), 0);
  const totalNet   = (detailRows || []).reduce((a, r) => a + whole(r.challanAmount) - whole(r.discount), 0);
  const totalRecvd = (detailRows || []).reduce((a, r) => a + whole(r.receivedAmount), 0);
  const settled    = Array.isArray(detailRows) && detailRows.length > 0 && totalRecvd >= totalNet;
  const accruedFine = (fine && billedFine <= 0 && !settled)
    ? feeService.computeFine({ dueDate: dueISO, receivingDate: localTodayISO(), settings })
    : 0;
  const lateDays    = feeService.daysLate(dueISO, localTodayISO());
  /* Is challan ka apna PSID — BranchLedger record se. */
  const psidPlain = psidOf(student?._challan);
  /* Barcode ki base = backend ka Student ID (applicantsID), Admn/reg No nahi —
     scanner se seedha wahi ID milti hai jis par fee APIs kaam karti hain. */
  const barcodeId = String(student?.applicantsID ?? student?.studentID ?? '');

  return `
<div class="slip">
  <div class="slip-header">
    <div class="logo-circle">${logoHtml}</div>
    <div>
      <div class="school-name">${escHtml(schName)}</div>
      ${schAddr ? `<div class="school-addr" style="font-size:8px;color:#555;line-height:1.3;">${escHtml(schAddr)}</div>` : ''}
      <span class="copy-tag">${escHtml(copyLabel)}</span>
    </div>
  </div>
  <div class="info-grid">
    <span class="ig-lbl">Fee Period</span><span class="ig-val">${escHtml(period)}</span>
    <span class="ig-lbl">Issue / Due</span><span class="ig-val">${escHtml(fmtChallanDate(issueISO))} / ${escHtml(fmtChallanDate(dueISO))}</span>
    <span class="ig-lbl">Date</span><span class="ig-val">${escHtml(fmtChallanDate(issueISO))}</span>
    <span class="ig-lbl">Admn. No</span><span class="ig-val">${escHtml(student.reg)}</span>
    <span class="ig-lbl">Student</span><span class="ig-val">${escHtml(student.name)}</span>
    <span class="ig-lbl">Father</span><span class="ig-val">${escHtml(student.father || '—')}</span>
    <span class="ig-lbl">Class</span><span class="ig-val">${escHtml(classMeta.cls)}-${escHtml(classMeta.sec)}</span>
  </div>
  <div class="fee-wrap">
    <table class="fee-table">
      <thead><tr><th>Fee Head</th><th>Std.</th><th>Disc</th><th>Net</th></tr></thead>
      <tbody>
        ${rows.map(r => `<tr><td>${escHtml(headLabel(r.name))}</td><td>${r.std.toLocaleString('en-PK')}</td><td>${r.disc ? r.disc.toLocaleString('en-PK') : '—'}</td><td>${r.net.toLocaleString('en-PK')}</td></tr>`).join('')}
        <tr class="tr-total"><td colspan="3">Total</td><td>${tNet.toLocaleString('en-PK')}</td></tr>
      </tbody>
    </table>
  </div>
  <div class="bottom-section">
    <div class="two-col">
      <div class="outline-box"><div class="ob-lbl">Advance Amount</div><div class="ob-val">${Math.round(arrears) === 0 ? '0' : arrears.toLocaleString('en-PK')}</div></div>
      ${fine
        ? `<div class="outline-box"><div class="ob-lbl">Fine (${fineType === 'daily' ? 'per day late' : 'after due date'})</div><div class="ob-val">${fineTxt}</div></div>`
        : `<div class="outline-box"><div class="ob-lbl">Fine</div><div class="ob-val">—</div></div>`}
    </div>
    <div class="net-box"><div class="nb-lbl">Net Payable Before Due Date</div><div class="nb-val">Rs. ${payable.toLocaleString('en-PK')}</div></div>
    ${accruedFine > 0
      ? `<div class="net-box"><div class="nb-lbl">Payable After Due Date (incl. ${lateDays} day${lateDays === 1 ? '' : 's'} fine)</div><div class="nb-val">Rs. ${(payable + accruedFine).toLocaleString('en-PK')}</div></div>`
      : ''}
    ${fine && !settled ? `<div class="fine-line">After due date: Rs. ${payable.toLocaleString('en-PK')} + (no. of days × ${fineAmt})</div>` : ''}
    ${showPsd && psidPlain ? `
    <div class="psid-block">
      <div class="psid-top"><div class="psid-dot"></div><span class="psid-tag">1Link PSID — Pay via Any Banking App</span></div>
      <div class="psid-num">${escHtml(psidPretty(psidPlain))}</div>
      <div class="psid-row">
        <div class="qr-wrap">${psidQrSvg(psidPlain)}</div>
        <div class="qr-hint"><strong>Scan QR</strong> with your banking app<br/>OR enter PSID manually.<br/>Works on HBL, MCB, Meezan,<br/>UBL, Sadapay, Easypaisa &amp; more.</div>
      </div>
    </div>` : ''}
    ${psidPlain ? `
    <div class="steps-block">
      <div class="steps-title">How to pay — 1Link PSID</div>
      <div class="step-row"><div class="sn">1</div><div class="st">Open your <strong>banking app</strong></div></div>
      <div class="step-row"><div class="sn">2</div><div class="st">Tap <strong>Bill Payment &rarr; Education</strong></div></div>
      <div class="step-row"><div class="sn">3</div><div class="st">Enter PSID — <strong>amount auto-fills</strong></div></div>
      <div class="step-row"><div class="sn">4</div><div class="st"><strong>Confirm &amp; pay</strong> — save your SMS receipt</div></div>
    </div>` : ''}
    ${barcodeId ? `
    <div class="barcode-area">${code128BSvg(barcodeId)}<div class="psid-tiny">Student ID: ${escHtml(barcodeId)}</div></div>` : ''}
  </div>
</div>`;
}

/* Ek saved BranchLedger challan record se uske ASLI Issue / Due / Fee-Period
   nikaalta hai. Ye wahi dates hain jo "Generate Challan" modal me chuni gayi thin
   (dateofCreattion = Issue Date, dueDate = Due Date), is liye preview, download
   aur report — sab ek hi date dikhate hain. Record na ho ya field khaali ho to
   caller ka fallback laut-ta hai. */
function challanDatesOf(rec, fb = {}) {
  const m = fb.monthNames
    || ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const iso = (v) => {
    const s = String(v || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
  };
  /* Is session me generate ki hui challan ka SELECTED date cache se — backend record me
     dateofCreattion galat (server today) aata ho to bhi challan par sahi date dikhe. */
  const cache = feeService.challanDateCache;
  const mo = Number(rec?.month) || 0, yr = Number(rec?.year) || 0;
  const cached = !rec ? null : (
    (Number(rec.studentID) && cache.get(`id|${Number(rec.studentID)}|${mo}|${yr}`)) ||
    ((rec.registrationNumber || rec.reg) &&
      cache.get(`reg|${String(rec.registrationNumber || rec.reg)}|${mo}|${yr}`)) ||
    null
  );
  /* Priority: explicit override (History reprint) → session cache → record → fallback. */
  const issueISO = fb.issueOverride || iso(cached?.issueISO) || iso(rec?.dateofCreattion) || fb.issueISO;
  const dueISO   = fb.dueOverride   || iso(cached?.dueISO)   || iso(rec?.dueDate)         || fb.dueISO;

  let period = fb.periodOverride || '';
  if (!period) {
    /* Fee Period challan ke apne month/year se — issue date ke mahine se NAHI,
       kyunki July ka challan August me bhi generate ho sakta hai. */
    const mi = Number(rec?.month) - 1;          // API month 1-based
    const yr = Number(rec?.year);
    if (mi >= 0 && mi <= 11 && yr) period = `${m[mi]} ${yr}`;
  }
  return { issueISO, dueISO, period: period || fb.period };
}

/* A fresh challan is stamped with today's dates and the current month, but a
   printed slip must carry the dates the challan was actually GENERATED with —
   the Issue/Due the user picked in the Generate Challan modal. Those live on the
   saved BranchLedger record (dateofCreattion / dueDate / month / year), which is
   attached to each student as `_challan`. Explicit overrides (History reprint)
   still win; today + 10 days is only the last-resort fallback for a student who
   has no saved challan yet. */
function buildChallanInner({ classMeta, students, heads, settings, discountMap, bw = false, size = 'a4', school = null,
                             period: periodOverride, issueISO: issueOverride, dueISO: dueOverride }) {
  const today    = new Date();
  const dueDate  = new Date(today); dueDate.setDate(dueDate.getDate() + 10);
  const m = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  /* LOCAL calendar par — toISOString() (UTC) Pakistan me subah 5 baje se pehle
     date ek din PEECHHE kar deta tha, jis se slip par ghalat Issue/Due chhapti. */
  const fbIssueISO = issueOverride || localDateISO(today);
  const fbDueISO   = dueOverride   || localDateISO(dueDate);
  const fbPeriod   = periodOverride || `${m[today.getMonth()]} ${today.getFullYear()}`;
  /* Har student ke apne saved challan se Issue/Due/Period nikaalo — bulk print me
     har bachche ka challan alag din bana ho sakta hai. */
  const datesFor = (s) => challanDatesOf(s?._challan, {
    issueISO: fbIssueISO, dueISO: fbDueISO, period: fbPeriod, monthNames: m,
    issueOverride, dueOverride, periodOverride,
  });
  const classDisc = (discountMap && discountMap[classMeta.key]) || {};
  const sch = feeReportSchool(school);

  if (size === 'thermal') {
    const slips = students.map(s => {
      const { period, issueISO, dueISO } = datesFor(s);
      return feeThermalChallanHTML({
        classMeta, student: s, heads, settings, period, issueISO, dueISO,
        studentDisc: classDisc[s.reg] || {}, school: sch,
      });
    }).join('');
    return `<div class="fee-thermal-doc">${slips || '<div style="padding:14px;text-align:center;color:#64748B">Nothing to render.</div>'}</div>`;
  }

  const pages = students.map(s => {
    const sd = classDisc[s.reg] || {};
    const { period, issueISO, dueISO } = datesFor(s);
    return `
    <div class="challan-page">
      <div class="challan-row">
        ${feeSlipHTML({ copyLabel: 'Parent Copy', classMeta, student: s, heads, settings, period, issueISO, dueISO, studentDisc: sd, school: sch })}
        ${feeSlipHTML({ copyLabel: 'Bank Copy',   classMeta, student: s, heads, settings, period, issueISO, dueISO, studentDisc: sd, school: sch })}
        ${feeSlipHTML({ copyLabel: 'School Copy', classMeta, student: s, heads, settings, period, issueISO, dueISO, studentDisc: sd, school: sch })}
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
.th-psid-qr{margin:4px 0;text-align:center;}
.th-psid-qr svg{display:block;margin:0 auto;}
.th-psid-hint{font-size:8.5px;color:#555;line-height:1.4;}
.th-steps{margin-top:5px;font-size:9px;color:#444;}
.th-steps .s{display:flex;gap:5px;margin-bottom:1px;}
.th-steps .s b{color:#111;}
@page{size:80mm auto;margin:0;}
@media print{ body{padding:0;} .th-challan{page-break-after:always;} .th-challan:last-child{page-break-after:auto;} }
`;

function feeThermalChallanHTML({ classMeta, student, heads, settings, period, issueISO, dueISO, studentDisc, school }) {
  const showDisc = settings.showDiscount !== false;
  const showPsd  = settings.showPsd      !== false;
  const fine     = !!settings.fineEnabled;
  const fineAmt  = +settings.fineAmt || 0;
  const fineType = settings.fineType || 'fixed';
  const disMap   = studentDisc || {};
  const schName  = school?.name || FEE_SCHOOL.name;
  const schAddr  = school?.address || '';

  /* Prefer the real generated challan's detailRows (shows every API head incl.
     "Previous Pending"); otherwise fall back to the class fee-head config. */
  /* Whole rupees — list/cards ki tarah, challan par decimal na dikhe. */
  const whole = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : 0; };
  const detailRows = student?._challan?.detailRows;
  let rows, arrears;
  if (Array.isArray(detailRows) && detailRows.length) {
    /* ADVANCE (negative "Previous Pending") ko head-table se bahar nikaalo — wo Total ke
       BAAD "Arrears / Advance" me minus hota hai. Warna wo discount column me chala jata
       tha (Std −1,770 / Disc −1,770 / Net 0) aur Net Payable se ghatta hi nahi tha. */
    let advOut = 0;
    const billRows = detailRows.filter(r => {
      const isPrev = /previous|pending|arrear/i.test(String(r.subHead || r.head || ''));
      if (isPrev && whole(r.challanAmount) < 0) { advOut += Math.abs(whole(r.challanAmount)); return false; }
      return true;
    });
    rows = billRows.map(r => {
      const name = r.subHead || r.head || '';
      const std  = whole(r.challanAmount);
      /* Har challan apna HI stored discount dikhata hai — jo us mahine generate karte
         waqt laga tha. Discount baad me badalne se PURANE mahino ke challan nahi
         badalne chahiye; naya discount sirf aage banne wale challan par lagta hai. */
      const raw  = whole(r.discount);
      const disc = showDisc ? Math.min(raw, std) : 0;
      return { name, std, disc, net: std - disc };
    });
    const hasTransport = detailRows.some(r => String(r.subHead || r.head || '').toLowerCase().trim() === 'transport');
    if (!hasTransport && whole(student.transport) > 0) {
      const t = whole(student.transport);
      rows.push({ name: 'Transport', std: t, disc: 0, net: t });
    }
    arrears = -advOut;   // advance → Total ke baad minus
  } else {
    rows = heads.map(h => {
      const raw  = whole(h.amt);
      const dRaw = whole(disMap[h.name]);
      const disc = showDisc ? Math.min(dRaw, raw) : 0;
      return { name: h.name, std: raw, disc, net: raw - disc };
    });
    arrears = whole(student.dues) - whole(student.advance);
  }
  const tNet    = rows.reduce((a, r) => a + r.net, 0);
  const payable = tNet + arrears;
  const fineTxt = `Rs. ${fineAmt.toLocaleString('en-PK')}`;
  /* Due date guzar chuki ho to AAJ tak banti fine — slip par sirf formula nahi,
     asli raqam bhi dikhe taake parent ko pata ho ab kitna dena hai.

     DO shartein, dono zaroori:
     1. Fine agar pehle hi ek "Late Fine" row ki soorat me challan par bill ho
        chuki hai to wo `rows`/`tNet` me shamil hai — dobara compute kar ke jodna
        usay DOHRA kar deta tha (Total 8,800 magar "After Due Date" 9,600).
     2. Challan poora wasool ho chuka ho to "Payable After Due Date" ka koi
        maani nahi — chhapi hui slip par parent se mazeed raqam maangi ja rahi
        thi jabke uska kuch baqaya tha hi nahi. */
  const billedFine = (detailRows || []).filter(feeService.isLateFineRow)
    .reduce((a, r) => a + whole(r.challanAmount), 0);
  const totalNet   = (detailRows || []).reduce((a, r) => a + whole(r.challanAmount) - whole(r.discount), 0);
  const totalRecvd = (detailRows || []).reduce((a, r) => a + whole(r.receivedAmount), 0);
  const settled    = Array.isArray(detailRows) && detailRows.length > 0 && totalRecvd >= totalNet;
  const accruedFine = (fine && billedFine <= 0 && !settled)
    ? feeService.computeFine({ dueDate: dueISO, receivingDate: localTodayISO(), settings })
    : 0;
  const lateDays    = feeService.daysLate(dueISO, localTodayISO());
  const showDiscCol = rows.some(r => r.disc > 0);
  /* Is challan ka apna PSID — BranchLedger record se. */
  const psidPlain   = psidOf(student?._challan);

  return `
<div class="th-challan">
  <div class="th-school">${escHtml(schName)}</div>
  ${schAddr ? `<div style="font-size:9px;color:#555;text-align:center;margin-bottom:2px;">${escHtml(schAddr)}</div>` : ''}
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
        <td>${escHtml(headLabel(r.name))}</td>
        <td class="right">${r.std.toLocaleString('en-PK')}</td>
        ${showDiscCol ? `<td class="right">${r.disc ? r.disc.toLocaleString('en-PK') : '—'}</td>` : ''}
        <td class="right">${r.net.toLocaleString('en-PK')}</td>
      </tr>`).join('')}
      <tr class="tr-total"><td colspan="${showDiscCol ? 3 : 2}">Total</td><td class="right">${tNet.toLocaleString('en-PK')}</td></tr>
    </tbody>
  </table>
  <div class="th-kv" style="margin-top:6px">
    <span class="k">Advance Amount</span><span class="v">${Math.round(arrears) === 0 ? '0' : arrears.toLocaleString('en-PK')}</span>
    ${fine ? `<span class="k">Fine (${fineType === 'daily' ? 'per day' : 'after due'})</span><span class="v">${fineTxt}</span>` : ''}
  </div>
  <div class="th-net">
    <span>Net Payable</span>
    <span>Rs. ${payable.toLocaleString('en-PK')}</span>
  </div>
  ${accruedFine > 0 ? `<div class="th-net">
    <span>After Due (incl. ${lateDays}d fine)</span>
    <span>Rs. ${(payable + accruedFine).toLocaleString('en-PK')}</span>
  </div>` : ''}
  ${fine ? `<div class="th-fine">After due: Rs. ${payable.toLocaleString('en-PK')} + (days × ${fineAmt})</div>` : ''}
  ${showPsd && psidPlain ? `
  <div class="th-psid">
    <div class="th-psid-top">1Link PSID</div>
    <div class="th-psid-num">${escHtml(psidPretty(psidPlain))}</div>
    <div class="th-psid-qr">${psidQrSvg(psidPlain, 88)}</div>
    <div class="th-psid-hint">Scan QR / enter PSID in your banking app. Works on HBL, MCB, Meezan, UBL, Sadapay, Easypaisa &amp; more.</div>
  </div>` : ''}
  ${psidPlain ? `
  <div class="th-steps">
    <div class="s"><b>1.</b> Open banking app</div>
    <div class="s"><b>2.</b> Tap Bill Payment → Education</div>
    <div class="s"><b>3.</b> Enter PSID — amount auto-fills</div>
    <div class="s"><b>4.</b> Confirm &amp; pay</div>
  </div>` : ''}
</div>`;
}

/* ── Family combined challan: one slip lists every child as a row ── */
function feeFamilySlipHTML({ copyLabel, family, settings, period, issueISO, dueISO }) {
  const showPsd = settings.showPsd !== false;
  /* Whole rupees — list/cards ki tarah, challan par decimal na dikhe. */
  const w = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : 0; };
  /* fee/transport/dues pehle se discount-ke-BAAD ka baqaya hain, is liye Net wahi hai
     aur Std usme discount wapas jod kar banaya jata hai (warna discount do baar ghat-ta). */
  const rows = family.children.map(ch => {
    const net  = w(ch.fee) + w(ch.transport) + w(ch.dues);
    const disc = w(ch.discount);
    return { name: `${ch.name} (${ch.cls}-${ch.sec})`, std: net + disc, disc, net };
  });
  const tNet = rows.reduce((a, r) => a + r.net, 0);
  /* Advance (jama shuda extra) Total ke BAAD minus hota hai. */
  const famAdv  = family.children.reduce((a, ch) => a + w(ch.advance), 0);
  const famPay  = tNet - famAdv;
  /* Due date guzar chuki ho to poori family par banti late fine (ek hi challan hai). */
  const famFine     = settings?.fineEnabled
    ? feeService.computeFine({ dueDate: dueISO, receivingDate: localTodayISO(), settings })
    : 0;
  const famLateDays = feeService.daysLate(dueISO, localTodayISO());
  /* Family challan ek HI challan hota hai — PSID bhi ek, pehle bachche ke
     saved record se (dates ki tarah, dekho buildFamilyChallanInner). */
  const psidPlain = psidOf((family.children || []).map(ch => ch._challan).find(Boolean));
  /* Family challan EK hi bill hai — barcode bhi ek, pehle bachche ke Student ID
     (applicantsID) par, PSID ki tarah hi convention. */
  const barcodeId = String((family.children || [])
    .map(ch => ch.applicantsID ?? ch.studentID)
    .find(v => v != null && v !== '') ?? '');

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
        ${famAdv > 0 ? `<tr class="tr-total"><td colspan="3">Less: Advance</td><td>-${famAdv.toLocaleString('en-PK')}</td></tr>` : ''}
      </tbody>
    </table>
  </div>
  <div class="bottom-section">
    <div class="net-box"><div class="nb-lbl">Total Family Payable</div><div class="nb-val">Rs. ${famPay.toLocaleString('en-PK')}</div></div>
    ${famFine > 0
      ? `<div class="net-box"><div class="nb-lbl">Payable After Due Date (incl. ${famLateDays} day${famLateDays === 1 ? '' : 's'} fine)</div><div class="nb-val">Rs. ${(famPay + famFine).toLocaleString('en-PK')}</div></div>`
      : ''}
    ${showPsd && psidPlain ? `
    <div class="psid-block">
      <div class="psid-top"><div class="psid-dot"></div><span class="psid-tag">1Link PSID — Pay via Any Banking App</span></div>
      <div class="psid-num">${escHtml(psidPretty(psidPlain))}</div>
      <div class="psid-row">
        <div class="qr-wrap">${psidQrSvg(psidPlain)}</div>
        <div class="qr-hint"><strong>Scan QR</strong> with your banking app<br/>OR enter PSID manually.<br/>Works on HBL, MCB, Meezan,<br/>UBL, Sadapay, Easypaisa &amp; more.</div>
      </div>
    </div>` : ''}
    ${psidPlain ? `
    <div class="steps-block">
      <div class="steps-title">How to pay — 1Link PSID</div>
      <div class="step-row"><div class="sn">1</div><div class="st">Open your <strong>banking app</strong></div></div>
      <div class="step-row"><div class="sn">2</div><div class="st">Tap <strong>Bill Payment &rarr; Education</strong></div></div>
      <div class="step-row"><div class="sn">3</div><div class="st">Enter PSID — <strong>amount auto-fills</strong></div></div>
      <div class="step-row"><div class="sn">4</div><div class="st"><strong>Confirm &amp; pay</strong></div></div>
    </div>` : ''}
    ${barcodeId ? `
    <div class="barcode-area">${code128BSvg(barcodeId)}<div class="psid-tiny">Student ID: ${escHtml(barcodeId)}</div></div>` : ''}
  </div>
</div>`;
}

function buildFamilyChallanInner({ family, settings, bw = false, size = 'a4',
                                   period: periodOverride, issueISO: issueOverride, dueISO: dueOverride }) {
  const today    = new Date();
  /* LOCAL calendar par — warna subah-subah slip par date ek din peechhe chhapti. */
  const fbIssue  = localDateISO(today);
  const dueDate  = new Date(today); dueDate.setDate(dueDate.getDate() + 10);
  const fbDue    = localDateISO(dueDate);
  const m = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const fbPeriod = `${m[today.getMonth()]} ${today.getFullYear()}`;
  /* Combined family slip ek hi challan hota hai, is liye pehle bachche ka saved
     record (sab ek hi bulk run me bante hain) uski Issue/Due date deta hai. */
  const famRec = (family.children || []).map(ch => ch._challan).find(Boolean) || null;
  const { period, issueISO, dueISO } = challanDatesOf(famRec, {
    issueISO: fbIssue, dueISO: fbDue, period: fbPeriod, monthNames: m,
    issueOverride, dueOverride, periodOverride,
  });

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
  /* Whole rupees — list/cards ki tarah, challan par decimal na dikhe. */
  const w = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : 0; };
  /* fee/transport/dues pehle se discount-ke-BAAD ka baqaya hain, is liye Net wahi hai
     aur Std usme discount wapas jod kar banaya jata hai (warna discount do baar ghat-ta). */
  const rows = family.children.map(ch => {
    const net  = w(ch.fee) + w(ch.transport) + w(ch.dues);
    const disc = w(ch.discount);
    return { name: `${ch.name} (${ch.cls}-${ch.sec})`, std: net + disc, disc, net };
  });
  const tNet = rows.reduce((a, r) => a + r.net, 0);
  /* Advance (jama shuda extra) Total ke BAAD minus hota hai. */
  const famAdv  = family.children.reduce((a, ch) => a + w(ch.advance), 0);
  const famPay  = tNet - famAdv;
  /* Due date guzar chuki ho to poori family par banti late fine. */
  const famFine     = settings?.fineEnabled
    ? feeService.computeFine({ dueDate: dueISO, receivingDate: localTodayISO(), settings })
    : 0;
  const famLateDays = feeService.daysLate(dueISO, localTodayISO());
  /* Family challan ek HI challan hai — PSID bhi ek (dekho feeFamilySlipHTML). */
  const psidPlain = psidOf((family.children || []).map(ch => ch._challan).find(Boolean));

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
      ${famAdv > 0 ? `<tr class="tr-total"><td colspan="3">Less: Advance</td><td class="right">-${famAdv.toLocaleString('en-PK')}</td></tr>` : ''}
    </tbody>
  </table>
  <div class="th-net">
    <span>Total Family Payable</span>
    <span>Rs. ${famPay.toLocaleString('en-PK')}</span>
  </div>
  ${famFine > 0 ? `<div class="th-net">
    <span>After Due (incl. ${famLateDays}d fine)</span>
    <span>Rs. ${(famPay + famFine).toLocaleString('en-PK')}</span>
  </div>` : ''}
  ${showPsd && psidPlain ? `
  <div class="th-psid">
    <div class="th-psid-top">1Link PSID</div>
    <div class="th-psid-num">${escHtml(psidPretty(psidPlain))}</div>
    <div class="th-psid-qr">${psidQrSvg(psidPlain, 88)}</div>
    <div class="th-psid-hint">Scan QR / enter PSID in your banking app. Works on HBL, MCB, Meezan, UBL, Sadapay, Easypaisa &amp; more.</div>
  </div>` : ''}
  ${psidPlain ? `
  <div class="th-steps">
    <div class="s"><b>1.</b> Open banking app</div>
    <div class="s"><b>2.</b> Tap Bill Payment → Education</div>
    <div class="s"><b>3.</b> Enter PSID — amount auto-fills</div>
    <div class="s"><b>4.</b> Confirm &amp; pay</div>
  </div>` : ''}
</div>`;
}

/* ═══════════════════════════════════════════════════════════════════
   FEE CHALLAN SETTINGS — master toggles + dependent fine config.
   Discount / PSD code show on every challan; Previous / Next Month
   Challan Receiving gate which months the counter may receive against;
   Fine is conditional, with fine type (Fixed / Per Day) and amount.
   All values persist via feeService.saveFeeSettings().
   ═══════════════════════════════════════════════════════════════════ */
function FeeChallanSettings({ toast }) {
  const { can } = usePermissions();
  const canFcsEdit = can('Fee', 'Fee Challan Settings', 'Edit');
  const {
    data: serverSettings,
    loading,
    error,
    refetch,
    setData: setServerSettings,
  } = useAsync(feeService.getFeeSettings, []);
  const [local, setLocal] = useState(null);
  const [saving, setSaving] = useState(false);

  /* Sync server → local once loaded */
  useEffect(() => {
    if (serverSettings && local == null) setLocal(serverSettings);
  }, [serverSettings, local]);

  const value = local || serverSettings || {};
  const dirty = JSON.stringify(value) !== JSON.stringify(serverSettings || {});

  const set = (patch) => setLocal(prev => ({ ...(prev || serverSettings || {}), ...patch }));

  /* This panel unmounts as soon as the tab or segment changes, so unsaved
     toggles would otherwise disappear without a word. Read both through refs:
     `toast` is rebuilt on every parent render, and depending on it directly
     would fire the cleanup on unrelated re-renders. */
  const dirtyRef = useRef(false);
  const toastRef = useRef(toast);
  useEffect(() => { dirtyRef.current = dirty; toastRef.current = toast; });
  useEffect(() => () => {
    if (dirtyRef.current) {
      toastRef.current('Fee challan settings not saved — please click Save Settings', 'warning');
    }
  }, []);

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
      const saved = await feeService.saveFeeSettings(value);
      setServerSettings(saved);
      setLocal(saved);
      toast('Fee challan settings saved', 'success');
    } catch (err) {
      toast(err.message || 'Could not save fee challan settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading || (!local && !error)) {
    return (
      <>
        <div className="fee-info">
          <i className="fa-solid fa-circle-info"></i>
          <span>Loading challan settings…</span>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <div className="fee-info" style={{ borderColor: '#FCA5A5', color: '#991B1B' }}>
        <i className="fa-solid fa-triangle-exclamation"></i>
        <span>{error.message || 'Could not load challan settings'}</span>
        <button className="fee-btn fee-btn-sm" onClick={refetch} type="button">Retry</button>
      </div>
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
          <Tooltip text={!canFcsEdit ? 'You do not have permission to edit fee settings' : (dirty ? 'Save your changes' : 'No changes to save')}>
            <button
              className="fee-btn fee-btn-primary fee-btn-sm"
              onClick={validateAndSave}
              disabled={!dirty || saving || !canFcsEdit}
              style={(!dirty || saving || !canFcsEdit) ? { opacity: .55, cursor: 'not-allowed' } : undefined}
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

            {/* Previous month receiving */}
            <SettingCard
              name="Previous Month Challan Receiving"
              desc="Allow the counter to receive a challan from the month before the current one."
              on={value.prevMonthChallan}
              onToggle={() => set({ prevMonthChallan: !value.prevMonthChallan })}
            />

            {/* Next month receiving */}
            <SettingCard
              name="Next Month Challan Receiving"
              desc="Allow the counter to receive a challan from the month after the current one — advance payments."
              on={value.nextMonthChallan}
              onToggle={() => set({ nextMonthChallan: !value.nextMonthChallan })}
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

function buildStudentFeeReportHTML({ cls, sec, heads, school = null }) {
  const meta = feeReportSchool(school);
  const total = heads.reduce((s, h) => s + (+h.amt || 0), 0);
  const today = meta.generatedDate
    ? feeReportDate(meta)
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const rows = heads.map((h, i) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #E5E7EB">${i + 1}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #E5E7EB"><b>${escHtml(headLabel(h.name))}</b></td>
      <td style="padding:8px 10px;border-bottom:1px solid #E5E7EB;text-align:right;font-variant-numeric:tabular-nums">Rs. ${(+h.amt || 0).toLocaleString('en-PK')}</td>
    </tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escHtml(`${meta.name} — Fee Heads — ${cls} (${sec})`)}</title>
<style>
  body { margin:0; font-family:'Segoe UI',Arial,sans-serif; color:#0F172A; background:#fff; font-size:13px; }
  .page { width:210mm; margin:0 auto; padding:18mm 14mm; box-sizing:border-box; }
  .header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #1E3A8A; padding-bottom:14px; margin-bottom:18px; }
  .brand { display:flex; align-items:center; gap:12px; }
  .logo { width:44px; height:44px; border:1px solid #BFDBFE; border-radius:12px; display:flex; align-items:center; justify-content:center; overflow:hidden; color:#1E3A8A; font-weight:800; background:#fff; }
  .logo img { width:100%; height:100%; object-fit:contain; }
  .school { font-size:18px; font-weight:800; color:#1E3A8A; letter-spacing:-.01em; }
  .title  { font-size:14px; font-weight:700; color:#1E40AF; margin-top:6px; }
  .addr { font-size:10px; color:#64748B; margin-top:3px; max-width:360px; }
  .meta { font-size:11px; color:#64748B; text-align:right; line-height:1.55; }
  table { width:100%; border-collapse:collapse; margin-top:8px; }
  thead th { background:#EFF6FF; color:#1E3A5F; font-weight:800; text-align:left; padding:10px; border-bottom:2px solid #BFDBFE; font-size:11.5px; text-transform:uppercase; letter-spacing:.4px; }
  thead th.right { text-align:right; }
  tfoot td { padding:10px; font-weight:800; background:#F8FAFF; border-top:2px solid #1E3A8A; }
  tfoot td.right { text-align:right; }
  @media print { @page { size:A4; margin:14mm; } body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head><body>
<div class="page">
  <div class="header">
    <div class="brand">
      <div class="logo">${feeReportLogoHtml(meta)}</div>
      <div>
        <div class="school">${escHtml(meta.name)}</div>
        <div class="title">Fee Heads — ${escHtml(cls)} (${escHtml(sec)})</div>
        ${meta.address ? `<div class="addr">${escHtml(meta.address)}</div>` : ''}
        ${meta.session ? `<div class="addr">Academic Session: ${escHtml(meta.session)}</div>` : ''}
      </div>
    </div>
    <div class="meta">Generated: ${escHtml(today)}<br/>By: ${escHtml(meta.generatedBy)}<br/>${escHtml(heads.length)} fee head${heads.length === 1 ? '' : 's'}</div>
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

.fee-struct-row  { grid-template-columns: 48px 1fr 1fr 110px 110px 80px; }
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
  /* Chhota rakha taake 4 action icons zoom (125–150%) par bhi EK line me aa jayein. */
  width: 26px; height: 26px;
  font-size: 11.5px;
  flex-shrink: 0;
  border: 1.5px solid var(--border-light);
  border-radius: 7px;
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
/* Action icons hamesha EK line me — wrap ho kar doosri line par na jayein. */
.fee-st-actions { display: flex; gap: 4px; justify-content: center; align-items: center; flex-wrap: nowrap; white-space: nowrap; }

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
  white-space: nowrap;   /* "Total Dues" / "Total Payable" ek hi line me rahein */
}
.fee-stbl thead th.fee-right  { text-align: right; }
.fee-stbl thead th.fee-center { text-align: center; }
.fee-stbl tbody td {
  padding: 9px 10px;
  border-bottom: 1px solid var(--border-light);
  /* Sab cells ek hi line par vertically center — action icons bhi row ke beech me. */
  vertical-align: middle;
  /* Kuch bhi do line me na toote (Reg No / amounts) — warna wo row unchi ho jaati hai
     aur icons baaki rows se upar/neeche lagte hain. Jagah kam pade to wrapper
     (.fee-stbl-wrap) horizontal scroll de deta hai. */
  white-space: nowrap;
}
.fee-stbl tbody tr:last-child td { border-bottom: none; }
.fee-stbl .fee-num   { color: var(--text-muted); font-weight: 700; width: 36px; }
/* Amount kabhi do line me na toote (e.g. "Rs. 12,000") — warna row lambi ho kar
   baaki rows se uncha/tirchha lagta hai. */
.fee-stbl .fee-right { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.fee-stbl-empty { text-align: center; color: var(--text-muted); padding: 16px; }
.fee-stbl-foot td {
  background: var(--bg-muted);
  padding: 10px 10px;
  border-top: 2px solid var(--border-light);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}
.fee-stbl-foot .fee-stbl-foot-lbl {
  text-align: right;
  text-transform: uppercase;
  letter-spacing: .4px;
  font-size: 11px;
  color: var(--text-secondary);
}
.fee-stbl-foot .fee-stbl-foot-total { color: #1E3A8A; font-size: 13.5px; }
[data-theme="dark"] .fee-stbl-foot .fee-stbl-foot-total { color: #93C5FD; }

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
/* LATE FINE hamesha LAAL. Note: fee-neg table ke andar HARA ho jaata hai (wo
   advance ke liye hai, jo student ke haq me hota hai). Fine ulta ek charge hai,
   is liye apni class — aur fee-neg ke BAAD define ki gayi taake wo jeete. */
.fee-fine,
.fee-stbl tbody td.fee-fine,
.fee-stbl tbody td .fee-fine { color: #DC2626; font-weight: 700; }
[data-theme="dark"] .fee-fine,
[data-theme="dark"] .fee-stbl tbody td.fee-fine,
[data-theme="dark"] .fee-stbl tbody td .fee-fine { color: #FCA5A5; }
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
       Row 2: [──────── Update ────────]
       Overrides the older 768px rule that used grid-template-columns:1fr
       + data-label pseudo-labels (which stacked all 6 cells vertically). */
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
  .fee-row.fee-struct-row > .fee-td:nth-of-type(6) {
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

  /* Row 2 — Update spans the full width as a touch-friendly CTA */
  .fee-row.fee-struct-row > .fee-td:nth-of-type(5) {
    flex: 1 1 100% !important;
    min-width: 0 !important;
    justify-content: stretch !important;
    order: 6;
  }
  .fee-row.fee-struct-row > .fee-td:nth-of-type(5) .fee-btn {
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
