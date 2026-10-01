import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import { DASH_MODAL_CSS } from './dashModalCss';
import { getBranchFcmTokens, getBranchStaff } from '../../services/dashboardService';
import { loadReportBranch } from '../../reports/reportKit';
import { activeSessionName } from '../../../utils/apiConfig';
import { buildUrl } from '../../../utils/apiConfig';

/* Current branch ke saare active students (class/section-wise) — Parents App
   report ke liye. Seedha API se, kisi aur service file par depend nahi.
     GET /api/LaunchSetup/get-class-section-studentlist-by-branch/{branchID} */
async function getClassStudentRoster() {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  if (!branchID) throw new Error('No branch selected');
  const res = await fetch(buildUrl(`/api/LaunchSetup/get-class-section-studentlist-by-branch/${branchID}`), { headers: { Accept: '*/*' } });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) throw new Error(json?.message || 'Could not load students');
  const pick = (o, ...keys) => { for (const k of keys) { if (o && o[k] != null && o[k] !== '') return o[k]; } return undefined; };
  const classes = [];
  const studentsMap = {};
  (Array.isArray(json?.data) ? json.data : []).forEach(g => {
    const gradeId = pick(g, 'id', 'gradeID', 'gradeId', 'classID') || 0;
    const cls = pick(g, 'name', 'gradeName', 'className') || '-';
    (Array.isArray(g.sections) ? g.sections : []).forEach(sec => {
      const sectionId = pick(sec, 'sectionID', 'id', 'sectionId') || 0;
      const key = `g${gradeId}-s${sectionId}`;
      classes.push({ key, cls, sec: pick(sec, 'sectionName', 'name') || '-' });
      studentsMap[key] = (Array.isArray(sec.students) ? sec.students : [])
        .filter(st => st?.isActive !== false)
        .map(st => {
          const studentID = Number(pick(st, 'id', 'studentID', 'studentId')) || 0;
          return {
            studentID,
            applicantsID: Number(pick(st, 'applicantsID', 'applicantID', 'applicantId')) || studentID,
            name: [pick(st, 'firstName', 'name', 'studentName'), pick(st, 'lastName')].filter(Boolean).join(' ').trim() || '-',
            father: pick(st, 'fatherName', 'guardianName') || '-',
            phone: String(pick(st, 'mobileNo', 'mobile', 'phone', 'contactNumber', 'contactNo', 'guardianContact', 'fatherMobile', 'parentMobile') || '').trim(),
          };
        });
    });
  });
  return { classes, studentsMap };
}

/* Current branch (sessionStorage 'branchID') ka header → A4Page ka brand shape.
   API fail ho to sessionStorage ka branch naam — kabhi demo 'Oxford' naam nahi. */
/* Token sach me hai ya nahi — API kabhi "null", "", "false", 0 jaisi values
   bhejti hai; pehle `!!r.fcmToken` in sab ko "downloaded" maan leta tha. */
function isRealToken(t) {
  const v = String(t ?? '').trim().toLowerCase();
  return v.length > 20 && v !== 'null' && v !== 'undefined';
}
function hasAppToken(r) {
  const f = r.hasToken ?? r.hasFcmToken ?? r.HasToken;
  const flag = f === true || f === 1 || String(f).trim().toLowerCase() === 'true' || String(f).trim() === '1';
  return flag && isRealToken(r.fcmToken ?? r.FcmToken ?? r.token);
}

/* Phone number ka aakhri 10 digits — "0321-6162257", "+923216162257" aur
   "03216162257" teeno ek hi number gine jayen. */
function phoneKey(v) {
  const d = String(v || '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : '';
}
const nameKey = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');

/* Status order — report me pehle Not Downloaded, phir Pending, phir Downloaded. */
const STATUS_ORDER = { 'Not Downloaded': 0, 'Pending': 1, 'Downloaded': 2 };
const STATUS_TONE  = { 'Not Downloaded': 'red', 'Pending': 'amber', 'Downloaded': 'green' };

function toBrand(h) {
  const ssName = sessionStorage.getItem('branchName') || sessionStorage.getItem('displayName') || '';
  if (!h) return { name: ssName, campus: '', address: '', phone: '', email: '', logo: '' };
  return {
    name:    h.branchName || h.schoolName || h.name || ssName,
    campus:  h.campusName || h.branchCode || h.academicSession || '',
    address: h.address || h.branchAddress || '',
    phone:   h.phone || h.phoneNo || h.contactNo || h.mobile || '',
    email:   h.email || h.branchEmail || '',
    logo:    h.branchLogo || h.logo || '',
  };
}

/* ═══════════════════════════════════════════════════════════════════
   APP PENDING REPORT MODAL — A4-sized report viewer for "Teachers /
   Parents Pending Download" lists. Header has school logo + name +
   campus + title + generated timestamp. Body is a clean ERP-style
   table. Footer carries page-of-page markers via @media print.

   Mode prop selects the dataset + columns:
     'teachers'  → flat list with Designation / Dept columns
     'parents'   → class-wise grouping with sub-headers per class

   Print isolation in PRT_CSS hides everything except the A4 surfaces
   when window.print() fires.
   ═══════════════════════════════════════════════════════════════════ */
export default function AppPendingReportModal({ mode = 'teachers', onClose, toast = () => {} }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  /* ─── Resolve dataset + meta per mode ─── */
  const isTeacher = mode === 'teachers';

  /* ─── Current branch ka header + poora staff with app status (API) ───
     Pehle SCHOOL_BRAND aur TEACHER_APP_PENDING (hard-coded mock) use ho rahe
     the, is liye har branch par 'The Oxford System' aur wahi 16 naam aate the. */
  const [brand, setBrand] = useState(() => toBrand(null));
  const [teacherRows, setTeacherRows] = useState([]);
  const [parentRows, setParentRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError('');
    Promise.allSettled([
      loadReportBranch(),
      getBranchFcmTokens(isTeacher ? 'teacher' : 'parent'),
      isTeacher ? getBranchStaff() : getClassStudentRoster(),
    ]).then(([hdr, list, staff]) => {
      if (!alive) return;
      if (hdr.status === 'fulfilled' && hdr.value) {
        const h = hdr.value;
        setBrand({ name: h.name || '', campus: '', address: h.address || '', phone: h.phone || '', email: h.email || '', logo: h.logo || '', session: h.session || '' });
      }
      if (!isTeacher) {
        /* ─── PARENTS: poore branch ke active students (roster) + un ke parent
           ka app status. Pehle PARENT_APP_PENDING (40 jhoote naam) aate the. ─── */
        if (staff.status !== 'fulfilled') { setLoadError(staff.reason?.message || 'Could not load students'); setLoading(false); return; }
        if (list.status !== 'fulfilled')  { setLoadError(list.reason?.message || 'Could not load app status'); setLoading(false); return; }
        const byAcc = new Map(), byPhone = new Map(), byName = new Map();
        list.value.forEach(r => {
          const has = hasAppToken(r);
          const put = (map, k) => { if (k) map.set(k, (map.get(k) || false) || has); };
          put(byAcc,   Number(r.accountTypeID) || 0);
          put(byPhone, phoneKey(r.userName));
          put(byName,  nameKey(r.name));
        });
        const { classes = [], studentsMap = {} } = staff.value || {};
        const rows = [];
        classes.forEach(c => (studentsMap[c.key] || []).forEach(st => {
          const ph = phoneKey(st.phone);
          let hit;
          if (byAcc.has(Number(st.studentID)))            hit = byAcc.get(Number(st.studentID));
          else if (byAcc.has(Number(st.applicantsID)))    hit = byAcc.get(Number(st.applicantsID));
          else if (ph && byPhone.has(ph))                 hit = byPhone.get(ph);   // siblings ek hi parent login
          /* Parent API ka `name` asal me BACHE ka naam hota hai (har bache ki alag row,
             accountTypeID = us bache ki id) — is liye naam student se milao, father se nahi. */
          else if (st.name && st.name !== '-' && byName.has(nameKey(st.name))) hit = byName.get(nameKey(st.name));
          rows.push({
            cls: `${c.cls}${c.sec && c.sec !== '-' ? ` ${c.sec}` : ''}`,
            student: st.name,
            parent: st.father && st.father !== '-' ? st.father : '—',
            contact: st.phone || '—',
            status: hit === true ? 'Downloaded' : hit === false ? 'Pending' : 'Not Downloaded',
          });
        }));
        setParentRows(rows);
        setLoading(false);
        return;
      }

      if (staff.status !== 'fulfilled') {
        setLoadError(staff.reason?.message || 'Could not load staff list');
        setLoading(false);
        return;
      }
      /* fcm-tokens fail ho to sab ko "Not Downloaded" dikhana jhoot hoga. */
      if (list.status !== 'fulfilled') {
        setLoadError(list.reason?.message || 'Could not load app status');
        setLoading(false);
        return;
      }

      /* fcm-tokens rows ko teen chaabiyon se index karo: employee id
         (accountTypeID), phone (userName = mobile no.), aur naam. */
      const byEmp = new Map(), byPhone = new Map(), byName = new Map();
      list.value.forEach(r => {
        const has = hasAppToken(r);
        const put = (map, k) => {
          if (!k) return;
          map.set(k, (map.get(k) || false) || has);   // kisi ek device par token = downloaded
        };
        put(byEmp,   Number(r.accountTypeID) || 0);
        put(byPhone, phoneKey(r.userName));
        put(byName,  nameKey(r.name));
      });

      const rows = staff.value.map(e => {
        let hit;
        if (byEmp.has(e.id))                               hit = byEmp.get(e.id);
        else if (phoneKey(e.phone) && byPhone.has(phoneKey(e.phone))) hit = byPhone.get(phoneKey(e.phone));
        else if (byName.has(nameKey(e.name)))              hit = byName.get(nameKey(e.name));
        /* hit === true  → token hai → Downloaded
           hit === false → row hai magar token nahi (app hai, login/logout) → Pending
           undefined     → API me koi row hi nahi → Not Downloaded */
        const status = hit === true ? 'Downloaded' : hit === false ? 'Pending' : 'Not Downloaded';
        return { ...e, status };
      }).sort((a, b) =>
        (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || a.name.localeCompare(b.name));

      setTeacherRows(rows);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [isTeacher]);
  const title = isTeacher
    ? 'Teachers Mobile App Status Report'
    : 'Parents Mobile App Status Report';
  const subtitle = isTeacher
    ? 'All active staff of this branch with their Teachers Mobile App status'
    : 'Class-wise list of all active students of this branch with their parent\'s Parents Mobile App status';

  /* Group parents by class for class-wise display. */
  const parentGroups = useMemo(() => {
    if (isTeacher) return [];
    const map = new Map();
    parentRows.forEach(p => {
      if (!map.has(p.cls)) map.set(p.cls, []);
      map.get(p.cls).push(p);
    });
    return [...map.entries()].map(([cls, rows]) => ({ cls, rows }));
  }, [isTeacher, parentRows]);

  const statusCount = useMemo(() => {
    const c = { 'Downloaded': 0, 'Pending': 0, 'Not Downloaded': 0 };
    (isTeacher ? teacherRows : parentRows).forEach(r => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [isTeacher, teacherRows, parentRows]);

  const totalRows = isTeacher
    ? teacherRows.length
    : parentRows.length;

  /* Rows per A4 page — split for proper page breaks. Sized so the
     header + table fit on one A4 surface; first page fits less to
     leave room for the title block. */
  const ROWS_FIRST_PAGE  = isTeacher ? 18 : 22;
  const ROWS_OTHER_PAGES = isTeacher ? 28 : 32;

  /* Paginate teachers; for parents, pagination follows the group
     ordering and never splits a row across pages. */
  const teacherPages = useMemo(() => {
    if (!isTeacher) return [];
    const out = [];
    let i = 0;
    while (i < teacherRows.length) {
      const cap = out.length === 0 ? ROWS_FIRST_PAGE : ROWS_OTHER_PAGES;
      out.push(teacherRows.slice(i, i + cap));
      i += cap;
    }
    return out.length ? out : [[]];
  }, [isTeacher, teacherRows, ROWS_FIRST_PAGE, ROWS_OTHER_PAGES]);

  /* For parent groups we lay rows out group-by-group across pages. */
  const parentPages = useMemo(() => {
    if (isTeacher) return [];
    const pages = [[]];
    let pageRowCount = 0;
    parentGroups.forEach(g => {
      const cap = pages.length === 1 ? ROWS_FIRST_PAGE : ROWS_OTHER_PAGES;
      const rowsThisGroup = g.rows.length + 1; /* +1 for the group header */
      if (pageRowCount + rowsThisGroup > cap && pages[pages.length - 1].length > 0) {
        pages.push([]);
        pageRowCount = 0;
      }
      pages[pages.length - 1].push(g);
      pageRowCount += rowsThisGroup;
    });
    return pages;
  }, [isTeacher, parentGroups, ROWS_FIRST_PAGE, ROWS_OTHER_PAGES]);

  const totalPages = isTeacher ? teacherPages.length : parentPages.length;
  const generated = new Date().toLocaleString('en-PK', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  const handlePrint = () => {
    toast('Opening browser print dialog — choose "Save as PDF"', 'info');
    /* Tiny delay so the toast can paint before the dialog blocks. */
    setTimeout(() => window.print(), 80);
  };

  return createPortal((
    <div
      className="up-modal-back"
      role="dialog" aria-modal="true" aria-labelledby="rpt-modal-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="up-modal up-modal--xl rpt-print" style={{ width: 'min(900px, 100%)', height: '92vh' }}>
        {/* ─── Modal head (hidden in print) ─── */}
        <div className="up-modal-head rpt-no-print">
          <div className="up-modal-head-l">
            <div className="up-modal-icn"><i className="fa-solid fa-file-pdf" aria-hidden="true"></i></div>
            <div>
              <div className="up-modal-title" id="rpt-modal-title">{title}</div>
              <div className="up-modal-sub">
                <span>{totalRows} {isTeacher ? 'staff' : 'students'}</span>
                <span>·</span>
                <span>{totalPages} page{totalPages !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
          <Tooltip text="Close (Esc)">
            <button className="up-modal-x" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>

        {/* ─── A4 preview stage ─── */}
        <div className="rpt-stage">
          {isTeacher ? (
            teacherPages.map((rows, pi) => (
              <A4Page
                key={pi}
                pageNum={pi + 1}
                totalPages={totalPages}
                title={title}
                subtitle={subtitle}
                generated={generated}
                showHeader={pi === 0}
                brand={brand}
              >
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <th style={{ width: 50 }}>Sr.&nbsp;No.</th>
                      <th>Staff Name</th>
                      <th>Designation / Department</th>
                      <th>Contact Number</th>
                      <th>App Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(loading || loadError || rows.length === 0) && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: 18 }}>
                          {loading ? 'Loading…' : (loadError || 'No active staff found for this branch.')}
                        </td>
                      </tr>
                    )}
                    {rows.map((t, i) => {
                      const sno = pi === 0 ? i + 1 : ROWS_FIRST_PAGE + (pi - 1) * ROWS_OTHER_PAGES + i + 1;
                      return (
                        <tr key={sno}>
                          <td className="rpt-sno">{sno}</td>
                          <td className="rpt-name">{t.name}</td>
                          <td>
                            {t.designation || '—'}
                            {t.department ? <> · <span className="rpt-meta">{t.department}</span></> : null}
                          </td>
                          <td className="rpt-mono">{t.phone || '—'}</td>
                          <td>
                            <span className={`rpt-status rpt-status--${STATUS_TONE[t.status] || 'red'}`}>
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </A4Page>
            ))
          ) : (
            parentPages.map((groups, pi) => {
              /* Compute serial number offset for the first row on this page */
              let serialOffset = 0;
              for (let j = 0; j < pi; j++) {
                serialOffset += parentPages[j].reduce((s, g) => s + g.rows.length, 0);
              }
              let runningSerial = serialOffset;
              return (
                <A4Page
                  key={pi}
                  pageNum={pi + 1}
                  totalPages={totalPages}
                  title={title}
                  subtitle={subtitle}
                  generated={generated}
                  showHeader={pi === 0}
                  brand={brand}
                >
                  <table className="rpt-table">
                    <thead>
                      <tr>
                        <th style={{ width: 50 }}>Sr.&nbsp;No.</th>
                        <th>Class</th>
                        <th>Student Name</th>
                        <th>Parent Name</th>
                        <th>Contact Number</th>
                        <th>App Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(loading || loadError || parentRows.length === 0) && (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: 18 }}>
                            {loading ? 'Loading…' : (loadError || 'No active students found for this branch.')}
                          </td>
                        </tr>
                      )}
                      {groups.flatMap(g => [
                        <tr key={`grp-${g.cls}`} className="rpt-group-row">
                          <td colSpan={6}>
                            <i className="fa-solid fa-chalkboard" aria-hidden="true"></i>{' '}
                            <b>{g.cls}</b>
                            <span className="rpt-group-meta"> · {g.rows.length} student{g.rows.length !== 1 ? 's' : ''}</span>
                          </td>
                        </tr>,
                        ...g.rows.map((p, i) => {
                          runningSerial += 1;
                          return (
                            <tr key={`${g.cls}-${i}`}>
                              <td className="rpt-sno">{runningSerial}</td>
                              <td>{g.cls}</td>
                              <td className="rpt-name">{p.student}</td>
                              <td>{p.parent}</td>
                              <td className="rpt-mono">{p.contact}</td>
                              <td>
                                <span className={`rpt-status rpt-status--${STATUS_TONE[p.status] || 'red'}`}>
                                  {p.status}
                                </span>
                              </td>
                            </tr>
                          );
                        }),
                      ])}
                    </tbody>
                  </table>
                </A4Page>
              );
            })
          )}
        </div>

        {/* ─── Modal foot (hidden in print) ─── */}
        <div className="up-modal-foot up-modal-foot--split rpt-no-print">
          <div className="up-modal-foot-l">
            <span className="up-badge up-badge--blue">{totalRows} {isTeacher ? 'staff' : 'students'}</span>
            <span className="up-badge up-badge--gray">{statusCount['Downloaded']} downloaded · {statusCount['Pending']} pending · {statusCount['Not Downloaded']} not downloaded</span>
            <span className="up-badge up-badge--gray">{totalPages} A4 page{totalPages !== 1 ? 's' : ''}</span>
          </div>
          <div className="up-modal-foot-r">
            <button type="button" className="up-btn up-btn-ghost" onClick={onClose}>
              <i className="fa-solid fa-xmark" aria-hidden="true"></i> Close
            </button>
            <button type="button" className="up-btn up-btn-primary" onClick={handlePrint}>
              <i className="fa-solid fa-print" aria-hidden="true"></i> Print / Save as PDF
            </button>
          </div>
        </div>
      </div>

      <style>{DASH_MODAL_CSS}</style>
      <style>{PRT_CSS}</style>
    </div>
  ), document.body);
}

/* ─── A4 page wrapper ─────────────────────────────────────────── */
function A4Page({ pageNum, totalPages, title, subtitle, generated, showHeader, brand = {}, children }) {
  return (
    <div className="rpt-a4">
      {showHeader ? (
        <>
          <header className="rpt-hd">
            <div className="rpt-hd-top">
              <div className="rpt-hd-logo">
                {brand.logo
                  ? <img src={brand.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <span className="rpt-hd-ini">{(brand.name || 'School').replace(/[^A-Za-z ]/g, '').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'SM'}</span>}
              </div>
              <div>
                <div className="rpt-hd-name">{brand.name}</div>
                {brand.address ? <div className="rpt-hd-addr">{brand.address}</div> : null}
                {(brand.phone || brand.email) ? (
                  <div className="rpt-hd-ct">
                    {brand.phone ? <>&#9742; {brand.phone}</> : null}
                    {brand.phone && brand.email ? <span className="rpt-sep">·</span> : null}
                    {brand.email ? <>&#9993; {brand.email}</> : null}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="rpt-hd-div" />
            <div className="rpt-hd-title">{title}</div>
            <div className="rpt-hd-sub">{subtitle}</div>
            <div className="rpt-hd-chips">
              {(() => {
                const s = activeSessionName() || brand.session || '';
                return s ? <span className="rpt-hd-chip">{/academic/i.test(s) ? s : `Academic Session ${s}`}</span> : null;
              })()}
              <span className="rpt-hd-chip"><b>Generated:</b> {generated}</span>
            </div>
          </header>
        </>
      ) : (
        <header className="rpt-head rpt-head--cont">
          <div className="rpt-head-cont-l">{brand.name}{brand.campus ? ` · ${brand.campus}` : ''}</div>
          <div className="rpt-head-cont-r">{title} (continued)</div>
        </header>
      )}

      {children}

      <footer className="rpt-foot">
        <span>{brand.name}{brand.campus ? ` · ${brand.campus}` : ''}</span>
        <span>Page {pageNum} of {totalPages}</span>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   A4 print CSS + print isolation rules.
   ═══════════════════════════════════════════════════════════════════ */
const PRT_CSS = `
.rpt-stage {
  flex: 1; min-height: 0;
  overflow-y: auto;
  padding: 20px;
  background: #E8EDF5;
  display: flex; flex-direction: column; gap: 16px;
  align-items: center;
}
[data-theme="dark"] .rpt-stage { background: #050911; }

/* ─── A4 page ─── */
.rpt-a4 {
  width: 794px;
  min-height: 1123px;
  padding: 36px 40px 30px;
  background: #FFFFFF !important;
  color: #0F172A !important;
  border-radius: 4px;
  box-shadow: 0 4px 14px rgba(15, 23, 42, .14);
  font: 500 11.5px/1.5 'Plus Jakarta Sans', sans-serif;
  display: flex; flex-direction: column;
  page-break-after: always;
}
.rpt-a4:last-child { page-break-after: auto; }

/* ─── Header ─── */
.rpt-head {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 16px; padding-bottom: 16px;
  border-bottom: 3px solid #1E3A8A;
}
.rpt-head-l { display: flex; align-items: center; gap: 14px; }
.rpt-logo {
  width: 56px; height: 56px;
  border-radius: 10px; overflow: hidden;
  box-shadow: 0 2px 6px rgba(30, 58, 138, .25);
}
.rpt-school-n { font: 800 18px/1.1 'Plus Jakarta Sans', sans-serif; color: #1E3A8A; letter-spacing: -0.3px; }
.rpt-school-c { font: 700 12px/1.2 'Plus Jakarta Sans', sans-serif; color: #475569; margin-top: 3px; }
.rpt-school-addr { font: 500 10.5px/1.4 'Plus Jakarta Sans', sans-serif; color: #64748B; margin-top: 4px; }
.rpt-school-contact { font: 500 10.5px/1.4 'Plus Jakarta Sans', sans-serif; color: #64748B; margin-top: 3px; }
.rpt-school-contact i { color: #1E40AF; font-size: 9px; margin-right: 3px; }
.rpt-sep { margin: 0 6px; color: #CBD5E1; }
.rpt-head-r { text-align: right; }
.rpt-stamp {
  display: inline-block; padding: 3px 9px; border-radius: 999px;
  background: #FEE2E2; color: #B91C1C;
  font: 800 9px/1 'Plus Jakarta Sans', sans-serif;
  text-transform: uppercase; letter-spacing: .6px;
}
.rpt-genon { font: 700 9.5px/1 'Plus Jakarta Sans', sans-serif; color: #64748B; text-transform: uppercase; letter-spacing: .5px; margin-top: 8px; }
.rpt-gentime { font: 700 11px/1.3 'Plus Jakarta Sans', sans-serif; color: #0F172A; margin-top: 3px; max-width: 200px; }

.rpt-hd {
  background: #1E3A8A; color: #FFFFFF;
  margin: -36px -40px 18px; padding: 22px 30px 18px;
  border-radius: 4px 4px 0 0;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
  font-family: 'Segoe UI', Arial, sans-serif;
}
.rpt-hd-top { display: flex; align-items: center; gap: 16px; }
.rpt-hd-logo {
  width: 70px; height: 70px; border-radius: 14px; background: #fff;
  padding: 6px; flex-shrink: 0; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.rpt-hd-ini { font: 900 22px/1 Arial, sans-serif; color: #1E3A8A; }
.rpt-hd-name { font-size: 20px; font-weight: 800; line-height: 1.2; }
.rpt-hd-addr { font-size: 11.5px; opacity: .85; margin-top: 3px; }
.rpt-hd-ct { font-size: 11px; opacity: .75; margin-top: 2px; }
.rpt-hd .rpt-sep { color: rgba(255,255,255,.6); }
.rpt-hd-div { height: 1px; background: rgba(255,255,255,.22); margin: 14px 0 12px; }
.rpt-hd-title { font-size: 19px; font-weight: 800; }
.rpt-hd-sub { font-size: 11.5px; opacity: .8; margin-top: 3px; }
.rpt-hd-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.rpt-hd-chip { background: rgba(255,255,255,.14); padding: 4px 12px; border-radius: 20px; font-size: 11px; }
[data-theme="dark"] .rpt-a4 .rpt-hd { color: #FFFFFF !important; background: #1E3A8A !important; }
[data-theme="dark"] .rpt-a4 .rpt-hd-ini { color: #1E3A8A !important; }
@media print { .rpt-hd { margin: 0 0 18px; border-radius: 0; } }

.rpt-head--cont {
  padding-bottom: 8px; border-bottom: 1px solid #CBD5E1;
  font: 700 10.5px/1 'Plus Jakarta Sans', sans-serif;
  color: #475569;
}
.rpt-head-cont-l, .rpt-head-cont-r { display: inline-block; }

/* ─── Title block ─── */
.rpt-title-block {
  padding: 14px 0 18px;
}
.rpt-title {
  font: 800 18px/1.2 'Plus Jakarta Sans', sans-serif;
  color: #1E3A8A;
  letter-spacing: -0.3px;
}
.rpt-subtitle {
  font: 600 11.5px/1.4 'Plus Jakarta Sans', sans-serif;
  color: #475569; margin-top: 4px;
}

/* ─── Table ─── */
.rpt-table {
  width: 100%; border-collapse: collapse;
  font: 500 11px/1.4 'Plus Jakarta Sans', sans-serif;
  margin-top: 4px;
}
.rpt-table thead th {
  background: #1E3A8A;
  color: #FFFFFF;
  text-align: left;
  padding: 8px 10px;
  font: 800 9.5px/1.2 'Plus Jakarta Sans', sans-serif;
  text-transform: uppercase; letter-spacing: .5px;
  border: 1px solid #1E40AF;
}
.rpt-table tbody td {
  padding: 7px 10px;
  border: 1px solid #E2E8F0;
  vertical-align: middle;
  color: #0F172A;
}
.rpt-table tbody tr:nth-child(even) td { background: #F8FAFF; }
.rpt-sno { text-align: center; font-weight: 700; color: #475569; }
.rpt-name { font-weight: 700; }
.rpt-meta { color: #64748B; font-weight: 500; }
.rpt-mono { font-family: 'SF Mono', 'Menlo', monospace; font-size: 10.5px; }
.rpt-status {
  display: inline-block; padding: 3px 9px; border-radius: 999px;
  font: 800 9.5px/1 'Plus Jakarta Sans', sans-serif;
  text-transform: uppercase; letter-spacing: .4px;
}
.rpt-status--red   { background: #FEE2E2; color: #B91C1C; }
.rpt-status--amber { background: #FEF3C7; color: #92400E; }
.rpt-status--green { background: #DCFCE7; color: #166534; }

.rpt-group-row td {
  background: #EFF6FF !important;
  color: #1E40AF !important;
  font: 800 11px/1.2 'Plus Jakarta Sans', sans-serif;
  border: 1px solid #BFDBFE !important;
}
.rpt-group-row td i { color: #1E40AF; margin-right: 4px; }
.rpt-group-meta { color: #64748B; font-weight: 500; }

/* ─── Footer ─── */
.rpt-foot {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid #E2E8F0;
  display: flex; align-items: center; justify-content: space-between;
  font: 600 10px/1 'Plus Jakarta Sans', sans-serif;
  color: #64748B;
}

/* ─── Dark mode: keep A4 surfaces light ─── */
[data-theme="dark"] .rpt-a4,
[data-theme="dark"] .rpt-a4 * { color: inherit !important; }
[data-theme="dark"] .rpt-a4 { background: #FFFFFF !important; color: #0F172A !important; }
[data-theme="dark"] .rpt-school-n,
[data-theme="dark"] .rpt-title { color: #1E3A8A !important; }
[data-theme="dark"] .rpt-table thead th { background: #1E3A8A !important; color: #fff !important; }
[data-theme="dark"] .rpt-table tbody td { color: #0F172A !important; }
[data-theme="dark"] .rpt-table tbody tr:nth-child(even) td { background: #F8FAFF !important; }
[data-theme="dark"] .rpt-group-row td { background: #EFF6FF !important; color: #1E40AF !important; }
[data-theme="dark"] .rpt-foot { color: #64748B !important; border-top-color: #E2E8F0 !important; }

/* ─── Print isolation ─── */
@media print {
  body * { visibility: hidden !important; }
  .rpt-print, .rpt-print * { visibility: visible !important; }
  .rpt-print {
    position: absolute !important; inset: 0 !important;
    width: 100% !important; height: auto !important;
    max-height: none !important;
    background: #fff !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }
  .rpt-no-print { display: none !important; }
  .rpt-stage {
    overflow: visible !important;
    padding: 0 !important;
    background: #fff !important;
    gap: 0 !important;
    align-items: stretch !important;
  }
  .rpt-a4 {
    box-shadow: none !important;
    border-radius: 0 !important;
    margin: 0 !important;
    width: 100% !important;
    min-height: auto !important;
    page-break-after: always;
  }
  .rpt-a4:last-child { page-break-after: auto; }
  @page { size: A4; margin: 12mm; }
}
`;
