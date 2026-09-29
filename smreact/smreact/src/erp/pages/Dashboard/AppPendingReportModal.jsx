import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import { SCHOOL_BRAND } from './dashboardData';
import { DASH_MODAL_CSS } from './dashModalCss';
import * as dashboardService from '../../services/dashboardService';

/* ═══════════════════════════════════════════════════════════════════
   APP DOWNLOAD REPORT MODAL — A4-sized report viewer for the Teachers /
   Parents mobile-app adoption list. Header has school logo + name +
   campus + title + generated timestamp. Body is a clean ERP-style
   table. Footer carries page-of-page markers via @media print.

   Data ab LIVE hai — branch ke registered app users (FCM token wale =
   "downloaded") us endpoint se aate hain jo dashboard ke Downloaded
   count ka bhi source hai:
     GET /branch/{branchId}/fcm-tokens?accountType={teacher|parent}
   (dashboardService.getBranchFcmTokens). Row shape:
     { id, name, userName, accountType, accountTypeID, fcmToken, hasToken }

   Mode prop → accountType:
     'teachers' → accountType=teacher
     'parents'  → accountType=parent

   Print isolation in PRT_CSS hides everything except the A4 surfaces
   when window.print() fires.
   ═══════════════════════════════════════════════════════════════════ */

/* Rows per A4 page — first page fits less to leave room for the title block. */
const ROWS_FIRST_PAGE  = 18;
const ROWS_OTHER_PAGES = 28;

export default function AppPendingReportModal({ mode = 'teachers', onClose, toast = () => {} }) {
  const isTeacher = mode === 'teachers';
  const accountType = isTeacher ? 'teacher' : 'parent';

  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  /* Live fetch on open (and whenever the mode/accountType changes). */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    dashboardService.getBranchFcmTokens(accountType)
      .then((list) => { if (alive) { setRows(Array.isArray(list) ? list : []); setLoading(false); } })
      .catch((err) => { if (alive) { setError(err.message || 'Could not load report'); setLoading(false); } });
    return () => { alive = false; };
  }, [accountType]);

  /* ─── Meta per mode ─── */
  const title = isTeacher
    ? 'Teachers Mobile App Download Report'
    : 'Parents Mobile App Download Report';
  const subtitle = isTeacher
    ? 'List of teachers who have installed and registered on the Teachers Mobile App'
    : 'List of parents who have installed and registered on the Parents Mobile App';

  const totalRows = rows.length;

  /* Paginate the flat list — same layout for teachers and parents (the API
     returns name / username / account type, no class grouping). */
  const pages = useMemo(() => {
    const out = [];
    let i = 0;
    while (i < rows.length) {
      const cap = out.length === 0 ? ROWS_FIRST_PAGE : ROWS_OTHER_PAGES;
      out.push(rows.slice(i, i + cap));
      i += cap;
    }
    return out.length ? out : [[]];
  }, [rows]);

  const totalPages = pages.length;
  const generated = new Date().toLocaleString('en-PK', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  const handlePrint = () => {
    if (loading || error || totalRows === 0) return;
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
                <span>{loading ? 'Loading…' : `${totalRows} ${isTeacher ? 'teachers' : 'parents'}`}</span>
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
          {loading ? (
            <div className="rpt-state">
              <i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
              <div>Loading report…</div>
            </div>
          ) : error ? (
            <div className="rpt-state rpt-state--err">
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
              <div>{error}</div>
            </div>
          ) : totalRows === 0 ? (
            <div className="rpt-state">
              <i className="fa-solid fa-mobile-screen-button" aria-hidden="true"></i>
              <div>No {isTeacher ? 'teachers' : 'parents'} have registered on the app yet.</div>
            </div>
          ) : (
            pages.map((pageRows, pi) => (
              <A4Page
                key={pi}
                pageNum={pi + 1}
                totalPages={totalPages}
                title={title}
                subtitle={subtitle}
                generated={generated}
                showHeader={pi === 0}
              >
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <th style={{ width: 50 }}>Sr.&nbsp;No.</th>
                      <th>Name</th>
                      <th>Username / Phone</th>
                      <th>Account Type</th>
                      <th>App Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r, i) => {
                      const sno = pi === 0 ? i + 1 : ROWS_FIRST_PAGE + (pi - 1) * ROWS_OTHER_PAGES + i + 1;
                      const installed = r.hasToken !== false;
                      return (
                        <tr key={r.id ?? sno}>
                          <td className="rpt-sno">{sno}</td>
                          <td className="rpt-name">{r.name || '—'}</td>
                          <td className="rpt-mono">{r.userName || '—'}</td>
                          <td>{r.accountType || (isTeacher ? 'Teacher' : 'Parent')}</td>
                          <td>
                            <span className={`rpt-status rpt-status--${installed ? 'green' : 'amber'}`}>
                              {installed ? 'Installed' : 'Not Installed'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </A4Page>
            ))
          )}
        </div>

        {/* ─── Modal foot (hidden in print) ─── */}
        <div className="up-modal-foot up-modal-foot--split rpt-no-print">
          <div className="up-modal-foot-l">
            <span className="up-badge up-badge--blue">{totalRows} registered</span>
            <span className="up-badge up-badge--gray">{totalPages} A4 page{totalPages !== 1 ? 's' : ''}</span>
          </div>
          <div className="up-modal-foot-r">
            <button type="button" className="up-btn up-btn-ghost" onClick={onClose}>
              <i className="fa-solid fa-xmark" aria-hidden="true"></i> Close
            </button>
            <button
              type="button"
              className="up-btn up-btn-primary"
              onClick={handlePrint}
              disabled={loading || !!error || totalRows === 0}
            >
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
function A4Page({ pageNum, totalPages, title, subtitle, generated, showHeader, children }) {
  return (
    <div className="rpt-a4">
      {showHeader ? (
        <>
          <header className="rpt-head">
            <div className="rpt-head-l">
              <div className="rpt-logo">
                {/* School crest — same shape as the sidebar logo */}
                <svg width="56" height="56" viewBox="0 0 36 36" fill="none" aria-hidden="true">
                  <rect width="36" height="36" fill="url(#rpt-grad)" />
                  <defs>
                    <linearGradient id="rpt-grad" x1="0" y1="0" x2="36" y2="36">
                      <stop stopColor="#1E3A8A" />
                      <stop offset="1" stopColor="#1E40AF" />
                    </linearGradient>
                  </defs>
                  <path d="M18 10C14 10 10 11.5 10 11.5L10 26C10 26 14 24.5 18 24.5C22 24.5 26 26 26 26L26 11.5C26 11.5 22 10 18 10Z" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
                  <path d="M18 10L18 24.5" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
                  <path d="M13 9L15 6L18 8L21 6L23 9" stroke="#FCD34D" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="rpt-school">
                <div className="rpt-school-n">{SCHOOL_BRAND.name}</div>
                <div className="rpt-school-c">{SCHOOL_BRAND.campus}</div>
                <div className="rpt-school-addr">{SCHOOL_BRAND.address}</div>
                <div className="rpt-school-contact">
                  <i className="fa-solid fa-phone" aria-hidden="true"></i> {SCHOOL_BRAND.phone}
                  <span className="rpt-sep">·</span>
                  <i className="fa-solid fa-envelope" aria-hidden="true"></i> {SCHOOL_BRAND.email}
                </div>
              </div>
            </div>
            <div className="rpt-head-r">
              <div className="rpt-stamp">Confidential</div>
              <div className="rpt-genon">Generated</div>
              <div className="rpt-gentime">{generated}</div>
            </div>
          </header>

          <div className="rpt-title-block">
            <div className="rpt-title">{title}</div>
            <div className="rpt-subtitle">{subtitle}</div>
          </div>
        </>
      ) : (
        <header className="rpt-head rpt-head--cont">
          <div className="rpt-head-cont-l">{SCHOOL_BRAND.name} · {SCHOOL_BRAND.campus}</div>
          <div className="rpt-head-cont-r">{title} (continued)</div>
        </header>
      )}

      {children}

      <footer className="rpt-foot">
        <span>{SCHOOL_BRAND.name} · {SCHOOL_BRAND.campus}</span>
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
.rpt-status--green { background: #DCFCE7; color: #15803D; }

/* ─── Loading / error / empty state (shown in place of A4 pages) ─── */
.rpt-state {
  margin: auto;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 40px 24px;
  font: 700 14px/1.4 'Plus Jakarta Sans', sans-serif;
  color: #475569; text-align: center;
}
.rpt-state i { font-size: 32px; color: #94A3B8; }
.rpt-state--err i { color: #DC2626; }
[data-theme="dark"] .rpt-state { color: #94A3B8; }

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
