import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from './Tooltip';
import TutorialModal from './TutorialModal';
import * as studentService from '../services/studentService';
import * as preEnrollmentService from '../services/preEnrollmentService';
import useAsync from '../hooks/useAsync';
import { usePermissions } from '../context/PermissionsContext';
import { fetchReportHeader } from '../../utils/pdfReports';
import { deliverReport } from './reportDelivery';
import { qrSVG } from '../utils/qrcode';

/* ─── Module-wide helpers ─── */
const MONTHS_SHORT_STU = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const stuFmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return `${d.getDate()} ${MONTHS_SHORT_STU[d.getMonth()]} ${d.getFullYear()}`;
};
const stuInitials = (s) => {
  const a = (s.first || '').trim()[0] || '';
  const b = (s.last  || '').trim()[0] || '';
  return (a + b).toUpperCase() || ((s.name || '?')[0] || '?').toUpperCase();
};
const stuFullName = (s) => s.name || `${s.first || ''} ${s.last || ''}`.trim();
const stuMoney = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-PK');
const STU_PRE_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const stuHasDiscount = (s) => {
  if (!s._disc) return false;
  return Object.values(s._disc).some(v => Number(v) > 0);
};

/* ─── ID Card theme palette (10 presets + custom) ─── */
const STU_ID_THEMES = [
  { key: 'blue',   name: 'Blue',   c1: '#2D7DD2', c2: '#1ABCCD', mid: '#4FA3E8', ink: '#0D2B5E' },
  { key: 'navy',   name: 'Navy',   c1: '#1E3A8A', c2: '#2563EB', mid: '#3B82F6', ink: '#0B1E45' },
  { key: 'teal',   name: 'Teal',   c1: '#0E7490', c2: '#14B8A6', mid: '#22D3EE', ink: '#083344' },
  { key: 'green',  name: 'Green',  c1: '#15803D', c2: '#22C55E', mid: '#4ADE80', ink: '#052E16' },
  { key: 'orange', name: 'Orange', c1: '#C2410C', c2: '#F97316', mid: '#FB923C', ink: '#431407' },
  { key: 'red',    name: 'Red',    c1: '#B91C1C', c2: '#EF4444', mid: '#F87171', ink: '#450A0A' },
  { key: 'maroon', name: 'Maroon', c1: '#7F1D1D', c2: '#B91C1C', mid: '#DC2626', ink: '#3B0A0A' },
  { key: 'purple', name: 'Purple', c1: '#6D28D9', c2: '#A855F7', mid: '#C084FC', ink: '#2E1065' },
  { key: 'black',  name: 'Black',  c1: '#1F2937', c2: '#4B5563', mid: '#6B7280', ink: '#0B0F19' },
  { key: 'gray',   name: 'Gray',   c1: '#475569', c2: '#94A3B8', mid: '#64748B', ink: '#0F172A' },
];

/* ─── Certificate type defaults ─── */
const STU_CERT_DEFAULTS = {
  appreciation: { title: 'Certificate of Appreciation',  icon: 'fa-star',                  body: 'In recognition of outstanding academic performance, excellent conduct and dedication shown throughout the session.' },
  character:    { title: 'Character Certificate',         icon: 'fa-user-shield',           body: 'This is to certify that the student bears a good moral character and has shown excellent discipline and conduct during the period of study at the school.' },
  leaving:      { title: 'School Leaving Certificate',    icon: 'fa-door-open',             body: 'This is to certify that the student was on the rolls of this school and has no pending dues. We wish the student success in all future endeavours.' },
  promotion:    { title: 'Certificate of Promotion',      icon: 'fa-arrow-up-right-dots',   body: '' },
};

/* ─── HTML escape + A4 popup helpers ─── */
const stuEsc = (s) => String(s ?? '').replace(/[<>&"']/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[m]));

function stuOpenPrintWindow(title, css, inner, toast) {
  const w = window.open('', '_blank');
  if (!w) { toast && toast('Please allow pop-ups to print', 'error'); return; }
  const escTitle = String(title || '').replace(/[<>&]/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m]));
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escTitle}</title><style>${css}</style></head><body>${inner}</body></html>`);
  w.document.close();
  /* Small delay so the branch logo image has time to load before print. */
  w.onload = () => setTimeout(() => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } }, 500);
}

/* Wrap a report's inner HTML into a full A4 document with the SAME toolbar the
   Academics/Exam reports use (a `window.print()` button labelled
   "Print / Save as PDF"). deliverReport() rewrites that button into
   "Save as Word" for the Word path, so the shared .docx exporter works here too. */
function stuWrapFullDoc(title, css, inner) {
  const esc = String(title || '').replace(/[<>&]/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m]));
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc}</title>
    <style>${css || ''}
      @media print { .no-print { display:none } }
      body { margin:0 }
    </style></head><body>${inner}
    <div class="no-print" style="text-align:center;padding:20px;background:#F8FAFC;border-top:1px solid #E2E8F0">
      <button onclick="window.print()" style="background:linear-gradient(135deg,#2563EB,#1E40AF);color:#fff;border:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;margin-right:8px">🖨 Print / Save as PDF</button>
      <button onclick="window.close()" style="background:transparent;border:1.5px solid #CBD5E1;color:#64748B;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer">Close</button>
    </div>
  </body></html>`;
}

/* Deliver a Students report by chosen format:
     • 'word' → shared preview with a "Save as Word" button → real .docx download
                (matches the Academics module exactly).
     • 'pdf'  → existing auto-print A4 window (unchanged). */
function stuDeliverReport(title, css, inner, format, toast) {
  if (format === 'word') {
    deliverReport(title, 'word', stuWrapFullDoc(title, css, inner));
  } else {
    stuOpenPrintWindow(title, css, inner, toast);
  }
}

function stuSchoolLogoSVG() {
  return `<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg"><rect width="36" height="36" rx="6" fill="#1E3A8A"/><path d="M18 10 C14 10 10 11.5 10 11.5 L10 26 C10 26 14 24.5 18 24.5 C22 24.5 26 26 26 26 L26 11.5 C26 11.5 22 10 18 10Z" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.6)" stroke-width="0.8"/><path d="M18 10 L18 24.5" stroke="rgba(255,255,255,0.7)" stroke-width="0.8"/></svg>`;
}

/* Report logo — the branch logo from the shared report-header API when
   available, otherwise the default SchoolMentor mark. */
function stuLogoImg(school) {
  return school?.logo
    ? `<img src="${school.logo}" alt="logo" style="width:100%;height:100%;object-fit:contain"/>`
    : stuSchoolLogoSVG();
}

/* Map class name → an icon for the class header row */
const STU_CLASS_ICON = (cls) => {
  if (/^nursery/i.test(cls))    return 'fa-baby';
  if (/^prep/i.test(cls))       return 'fa-shapes';
  if (/^class\s*[1-3]/i.test(cls)) return 'fa-book-open-reader';
  if (/^class\s*[4-6]/i.test(cls)) return 'fa-school';
  return 'fa-graduation-cap';
};

/* ═══════════════════════════════════════════════════════════════════
   STUDENTS MODULE — shell + 3 main tabs.
   Ported from ~/Desktop/ERP-HTML/Students Module.html

   Step 1 (this turn): page header + 3 main tabs (Active Students /
   Inactive Students / Family Tree) with Coming Soon bodies + the
   mock data & service layer in place.

   Subsequent steps:
     2. Active Students — stats + table + 3-dot menu
     3. Add / Edit Student modal (General + Fee Details tabs)
     4. Promotion / Inactivate / Pending Dues modals
     5. Inactive Students tab
     6. Family Tree tab + family modals
     7. ID Card Generator (single + bulk)
     8. Certificate Generator (4 types)
     9. All A4 PDF reports through a Report Picker
   ═══════════════════════════════════════════════════════════════════ */

/* ─── A4 Admission Form HTML — Students Module format ─── */
function buildStuAdmissionFormHTML(school, isBW = false) {
  const color  = isBW ? '#1F2937' : '#1E3A8A';
  const accent = isBW ? '#475569' : '#2563EB';
  void accent;
  return `
    <style>
      *{box-sizing:border-box;margin:0;padding:0;font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif}
      html,body{background:#F1F3F8}
      body{color:#111;font-size:10.5px;line-height:1.45;padding:18px 0}
      .page{width:210mm;min-height:297mm;margin:0 auto;padding:14mm;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,.12)}
      .af-head{display:flex;align-items:stretch;gap:14px;border:2px solid ${color};border-radius:10px;padding:14px 18px;margin-bottom:14px;background:linear-gradient(135deg, ${color}10, transparent 60%);}
      .af-head .left{flex:1;display:flex;flex-direction:column;justify-content:center}
      .af-school{font-size:20px;font-weight:800;color:${color};letter-spacing:-.01em;line-height:1.15}
      .af-session{font-size:11.5px;color:#475569;margin-top:2px;font-weight:600}
      .af-title{font-size:14px;font-weight:800;color:${color};margin-top:8px;padding-top:6px;border-top:1px dashed ${color}66;letter-spacing:.5px;text-transform:uppercase}
      .af-photo{width:90px;height:110px;border:2px dashed ${color}66;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:9.5px;color:#64748B;font-weight:700;background:#FAFBFE}
      .af-photo .ic{font-size:22px;margin-bottom:4px}
      .af-meta{display:flex;gap:0;margin-bottom:12px}
      .af-meta div{flex:1;padding:7px 12px;font-size:11px;font-weight:700;color:#1F2937;border:1px solid #CBD5E1}
      .af-meta div:not(:last-child){border-right:none}
      .af-meta div b{color:${color};margin-right:8px}
      .af-meta div span.fill{display:inline-block;min-width:120px;border-bottom:1px dotted #94A3B8;padding-bottom:1px}
      .sec-title{background:${color};color:#fff;padding:6px 12px;border-radius:5px;font-weight:800;font-size:11.5px;letter-spacing:.4px;margin:14px 0 8px;display:flex;justify-content:space-between;align-items:center}
      .sec-title small{font-weight:700;opacity:.85;font-size:9.5px}
      .field-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border:1px solid #CBD5E1;border-radius:6px;overflow:hidden;margin-bottom:8px}
      .field-grid .f{padding:7px 11px;border-right:1px solid #CBD5E1;border-bottom:1px solid #CBD5E1;min-height:38px;display:flex;flex-direction:column;gap:2px}
      .field-grid .f:nth-child(3n){border-right:none}
      .field-grid .f.span2{grid-column:span 2}
      .field-grid .f.span3{grid-column:1/-1;border-right:none}
      .field-grid .f .l{font-size:9px;font-weight:800;color:${color};text-transform:uppercase;letter-spacing:.4px}
      .field-grid .f .v{font-size:11.5px;color:#1F2937;font-weight:600;border-bottom:1px dotted #94A3B8;padding:2px 0;min-height:14px}
      .tbl{width:100%;border-collapse:collapse;font-size:10.5px;margin-bottom:8px}
      .tbl thead th{background:${color};color:#fff;padding:7px 8px;font-weight:700;font-size:9.5px;text-transform:uppercase;letter-spacing:.3px;text-align:left}
      .tbl td{padding:9px 8px;border-bottom:1px dotted #94A3B8;vertical-align:top}
      .tbl td.ul{border-bottom:1px dotted #94A3B8}
      .tbl td.c{text-align:center}
      .tickrow{display:flex;flex-wrap:wrap;gap:7px 12px;padding:8px 11px;border:1px solid #CBD5E1;border-radius:6px;margin-bottom:8px}
      .tickrow .tick{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:#1F2937}
      .tickrow .tick .box{display:inline-block;width:11px;height:11px;border:1.5px solid ${color};border-radius:2px}
      .declaration{padding:11px 13px;border:1px solid #CBD5E1;border-radius:6px;background:#FAFBFE;font-size:10.5px;line-height:1.6;color:#1F2937;margin-bottom:8px}
      .signrow{display:flex;gap:18px;margin-top:18px}
      .signrow > div{flex:1;border-top:1.5px solid #94A3B8;padding-top:5px;font-size:9.5px;font-weight:700;color:#64748B}
      .office-band{background:#FEF3C7;border:2px dashed #D97706;padding:9px 12px;border-radius:6px;font-size:10px;color:#92400E;font-weight:700;text-transform:uppercase;letter-spacing:.5px;text-align:center;margin:12px 0 6px}
      .docs-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;padding:9px 13px;border:1px solid #CBD5E1;border-radius:6px}
      .docs-grid .doc{display:flex;align-items:center;gap:6px;font-size:10.5px;color:#1F2937}
      .docs-grid .doc .box{display:inline-block;width:11px;height:11px;border:1.5px solid ${color};border-radius:2px;flex-shrink:0}
      .rfoot{margin-top:14px;text-align:center;font-size:9px;color:#94A3B8;border-top:1px solid #e5e9f2;padding-top:8px}
      @page{size:A4 portrait;margin:0}
      @media print{body{background:#fff;padding:0}.page{width:auto;min-height:0;margin:0;padding:14mm;box-shadow:none}}
    </style>
    <div class="page">

      <div class="af-head">
        ${school?.logo ? `<div style="width:60px;height:60px;flex-shrink:0;display:flex;align-items:center;justify-content:center"><img src="${school.logo}" alt="logo" style="width:100%;height:100%;object-fit:contain"/></div>` : ''}
        <div class="left">
          <div class="af-school">${stuEsc(school?.name || 'School')}</div>
          <div class="af-session">${stuEsc(school?.session || 'Academic Session')}${school?.address ? ' · ' + stuEsc(school.address) : ''}</div>
          <div class="af-title">Student Admission Application Form</div>
        </div>
        <div class="af-photo">
          <div class="ic">📷</div>
          Affix recent
          <div>passport-size</div>
          <div>photograph</div>
        </div>
      </div>

      <div class="af-meta">
        <div><b>Form No.</b><span class="fill"></span></div>
        <div><b>Date</b><span class="fill">${stuFmtDate(new Date().toISOString().slice(0, 10))}</span></div>
        <div><b>Class Applying For</b><span class="fill"></span></div>
      </div>

      <div class="sec-title"><span>1. Student Information</span><small>Use block letters</small></div>
      <div class="field-grid">
        <div class="f span2"><div class="l">Student's Full Name</div><div class="v"></div></div>
        <div class="f"><div class="l">Date of Birth</div><div class="v"></div></div>
        <div class="f"><div class="l">Gender (M/F/O)</div><div class="v"></div></div>
        <div class="f"><div class="l">B-Form / Birth Cert No.</div><div class="v"></div></div>
        <div class="f"><div class="l">Place of Birth</div><div class="v"></div></div>
        <div class="f"><div class="l">Religion</div><div class="v"></div></div>
        <div class="f"><div class="l">Nationality</div><div class="v">Pakistani</div></div>
        <div class="f"><div class="l">Mother Tongue</div><div class="v"></div></div>
        <div class="f"><div class="l">Blood Group</div><div class="v"></div></div>
        <div class="f"><div class="l">No. of Siblings</div><div class="v"></div></div>
        <div class="f span3"><div class="l">Permanent Address</div><div class="v"></div></div>
      </div>

      <div class="sec-title"><span>2. Father / Guardian Information</span><small>Primary contact</small></div>
      <div class="field-grid">
        <div class="f span2"><div class="l">Father's Full Name</div><div class="v"></div></div>
        <div class="f"><div class="l">Father's CNIC</div><div class="v"></div></div>
        <div class="f"><div class="l">Occupation</div><div class="v"></div></div>
        <div class="f"><div class="l">Designation</div><div class="v"></div></div>
        <div class="f"><div class="l">Monthly Income</div><div class="v"></div></div>
        <div class="f"><div class="l">Mobile / Phone</div><div class="v"></div></div>
        <div class="f"><div class="l">WhatsApp</div><div class="v"></div></div>
        <div class="f"><div class="l">Email</div><div class="v"></div></div>
        <div class="f span3"><div class="l">Office Address</div><div class="v"></div></div>
      </div>

      <div class="sec-title"><span>3. Mother Information</span><small></small></div>
      <div class="field-grid">
        <div class="f span2"><div class="l">Mother's Full Name</div><div class="v"></div></div>
        <div class="f"><div class="l">Mother's CNIC</div><div class="v"></div></div>
        <div class="f"><div class="l">Education</div><div class="v"></div></div>
        <div class="f"><div class="l">Occupation</div><div class="v"></div></div>
        <div class="f"><div class="l">Mobile / Phone</div><div class="v"></div></div>
      </div>

      <div class="sec-title"><span>4. Previous School (if any)</span><small></small></div>
      <table class="tbl">
        <thead><tr><th style="width:24px">#</th><th>School Name</th><th style="width:70px">Last Class</th><th style="width:70px">Year</th><th>Reason for Leaving</th></tr></thead>
        <tbody>
          <tr><td class="c" style="font-weight:800">1.</td><td class="ul"></td><td class="ul"></td><td class="ul"></td><td class="ul"></td></tr>
          <tr><td class="c" style="font-weight:800">2.</td><td class="ul"></td><td class="ul"></td><td class="ul"></td><td class="ul"></td></tr>
        </tbody>
      </table>

      <div class="sec-title"><span>5. Health &amp; Medical Information</span><small>Tick where applicable</small></div>
      <div class="tickrow">
        ${['Asthma','Allergies','Diabetes','Heart Condition','Vision','Hearing','None','Other'].map(t => `<span class="tick"><span class="box"></span> ${t}</span>`).join('')}
      </div>
      <div class="field-grid">
        <div class="f span2"><div class="l">Details / Allergies / Medication</div><div class="v"></div></div>
        <div class="f"><div class="l">Family Doctor</div><div class="v"></div></div>
        <div class="f"><div class="l">Doctor's Phone</div><div class="v"></div></div>
        <div class="f"><div class="l">Hospital Preference</div><div class="v"></div></div>
        <div class="f"><div class="l">Special Needs</div><div class="v"></div></div>
      </div>

      <div class="sec-title"><span>6. Emergency Contact</span><small>Other than parents</small></div>
      <div class="field-grid">
        <div class="f"><div class="l">Name</div><div class="v"></div></div>
        <div class="f"><div class="l">Relation</div><div class="v"></div></div>
        <div class="f"><div class="l">Phone</div><div class="v"></div></div>
        <div class="f span2"><div class="l">Address</div><div class="v"></div></div>
        <div class="f"><div class="l">Alternate Phone</div><div class="v"></div></div>
      </div>

      <div class="sec-title"><span>7. Transport &amp; Additional Services</span><small>Optional</small></div>
      <div class="tickrow">
        <span class="tick"><span class="box"></span> School Van / Transport Required</span>
        <span class="tick"><span class="box"></span> Lunch / Tuck Service</span>
        <span class="tick"><span class="box"></span> After-school Care</span>
        <span class="tick"><span class="box"></span> Sibling Discount Eligibility</span>
      </div>
      <div class="field-grid">
        <div class="f"><div class="l">Pickup Area / Route</div><div class="v"></div></div>
        <div class="f"><div class="l">Source of Inquiry</div><div class="v"></div></div>
        <div class="f"><div class="l">Reference (if any)</div><div class="v"></div></div>
      </div>

      <div class="sec-title"><span>8. Documents Checklist</span><small>Tick when attached</small></div>
      <div class="docs-grid">
        <div class="doc"><span class="box"></span> Birth Certificate / B-Form (copy)</div>
        <div class="doc"><span class="box"></span> Father's CNIC (copy)</div>
        <div class="doc"><span class="box"></span> Mother's CNIC (copy)</div>
        <div class="doc"><span class="box"></span> Previous School Report Card</div>
        <div class="doc"><span class="box"></span> Leaving Certificate / TC</div>
        <div class="doc"><span class="box"></span> 2 × Passport-size Photos of Child</div>
        <div class="doc"><span class="box"></span> 1 × Passport-size Photo of Father</div>
        <div class="doc"><span class="box"></span> 1 × Passport-size Photo of Mother</div>
        <div class="doc"><span class="box"></span> Vaccination Record</div>
        <div class="doc"><span class="box"></span> Utility Bill (address proof)</div>
      </div>

      <div class="sec-title"><span>9. Declaration by Parent / Guardian</span><small></small></div>
      <div class="declaration">
        I, <span style="border-bottom:1px dotted #94A3B8;display:inline-block;min-width:220px;padding:0 4px"></span>,
        father / guardian of the above named student, hereby declare that all the information provided in this admission application form is true and complete to the best of my knowledge.
        I have read and agreed to the school's <b>Admission Policy</b>, <b>Code of Conduct</b>, and <b>Fee Structure</b>.
        I understand that any misrepresentation may lead to immediate cancellation of admission, and that the registration fee is <b>non-refundable</b>.
        I authorise the school to use my child's photographs for school records and academic purposes.
        <div class="signrow">
          <div>Parent / Guardian Signature &amp; Date</div>
          <div>Witness Name &amp; Signature</div>
        </div>
      </div>

      <div class="office-band">For School / Office Use Only — Do Not Fill</div>
      <div class="field-grid">
        <div class="f"><div class="l">Application Reviewed By</div><div class="v"></div></div>
        <div class="f"><div class="l">Date of Review</div><div class="v"></div></div>
        <div class="f"><div class="l">Interview Date</div><div class="v"></div></div>
        <div class="f"><div class="l">Test Score / Remarks</div><div class="v"></div></div>
        <div class="f"><div class="l">Admission Status</div><div class="v">Approved □ &nbsp;&nbsp; Conditional □ &nbsp;&nbsp; Rejected □</div></div>
        <div class="f"><div class="l">Allocated Class / Section</div><div class="v"></div></div>
        <div class="f"><div class="l">Admission No. Assigned</div><div class="v"></div></div>
        <div class="f"><div class="l">Roll No.</div><div class="v"></div></div>
        <div class="f"><div class="l">Fee Slip No.</div><div class="v"></div></div>
        <div class="signrow" style="grid-column:1/-1;padding:8px 11px">
          <div>Principal's Signature &amp; Seal</div>
          <div>Admission Officer Signature</div>
          <div>Accounts In-charge Signature</div>
        </div>
      </div>

      <div style="margin-top:14px;padding:10px 13px;background:${accent}10;border-left:3px solid ${accent};border-radius:5px;font-size:10px;color:#1F2937;line-height:1.55">
        <b style="color:${color}">Notes:</b>
        <ol style="margin:4px 0 0 18px;padding:0">
          <li>Incomplete forms will not be processed. Please ensure every section is filled before submission.</li>
          <li>Original documents must be presented at the time of submission for verification.</li>
          <li>Admission is subject to seat availability and successful admission test / interview.</li>
          <li>Once admitted, transfer between classes is not guaranteed during the academic year.</li>
        </ol>
      </div>

      <div class="rfoot">Generated on ${stuFmtDate(new Date().toISOString().slice(0, 10))} · ${stuEsc(school?.name || 'School')} · Admission Office</div>
    </div>`;
}

/* ─── A4 Student Profile PDF (matches Students Module.html reference) ─── */
function buildStuProfileHTML(s, cls, school, isBW = false) {
  const brand  = isBW ? '#222' : '#1E3A8A';
  const accent = isBW ? '#555' : '#2563EB';
  const initials = stuInitials(s);
  const fullName = stuFullName(s);
  const fmtLong = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    return isNaN(d) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const dash = (x) => (x === undefined || x === null || x === '') ? '—' : stuEsc(x);
  const campus = school?.campus || 'Main Campus';
  const addr   = school?.address || '';
  const phone  = school?.phone || '';
  const session = school?.session || '2025 – 2026';

  /* ── Brand logo — branch logo from the report-header API when available,
       else the default mark (matches HTML repHeader logoSvg). ── */
  const logoSvg = school?.logo
    ? `<img src="${school.logo}" alt="logo" width="46" height="46" style="object-fit:contain;border-radius:9px"/>`
    : `<svg width="46" height="46" viewBox="0 0 36 36"><rect width="36" height="36" rx="9" fill="${brand}"/><path d="M18 9 L26 13 L18 17 L10 13 Z" fill="rgba(255,255,255,.95)"/><path d="M12 15 L12 21 C12 21 15 23 18 23 C21 23 24 21 24 21 L24 15" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="1.4"/><line x1="26" y1="13" x2="26" y2="19" stroke="rgba(255,255,255,.9)" stroke-width="1.2"/></svg>`;

  /* ── Hero strip ke top-right ka QR — asli hai, student id encode karta hai.
       Pehle yahan sirf QR ki shakl (chand rectangles) bani hui thi jo kisi
       scanner se parhi nahi ja sakti thi. ── */
  const QR_SVG = stuQrSVG(stuQrValue(s));

  /* ── Hero photo ── */
  const photoBlock = s.photo
    ? `<img src="${s.photo}" style="width:100%;height:100%;object-fit:cover" alt="${stuEsc(fullName)}"/>`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:40px;color:${accent};background:${isBW ? '#f1f5f9' : '#DBEAFE'};font-weight:800">${stuEsc(initials)}</div>`;

  /* ── Two-column row helper ── */
  const row = (l, v) => `<div style="display:flex;padding:7px 0;border-bottom:1px solid #eef2f9"><div style="width:150px;font-size:11.5px;color:#64748B;font-weight:600">${l}</div><div style="flex:1;font-size:12.5px;font-weight:600;color:#0F172A">${v}</div></div>`;

  /* ── Sample document SVGs (faithful copies from HTML reference) ──
     AHEM: in cards ki har value student ke apne record se aani chahiye. Pehle
     khali field par demo data ("House 12, Model Town, Lahore", jhooti CNIC/
     B-Form numbers, "Mrs. <father>") chhap jata tha — yani jo address user ne
     kabhi enter kiya hi nahi tha wo report me student ka address ban kar aa
     raha tha. Ab na-mojood field par sirf `—` aata hai. */
  const orDash = (v) => (String(v ?? '').trim() ? stuEsc(v) : '—');
  const sampleBform = () => `
    <svg viewBox="0 0 600 380" width="100%" style="display:block;border-radius:8px;border:1px solid ${isBW ? '#ccc' : '#C7D7F0'};background:#fff">
      <rect width="600" height="380" fill="#fff"/>
      <rect x="0" y="0" width="600" height="56" fill="${isBW ? '#444' : '#15803D'}"/>
      <circle cx="40" cy="28" r="17" fill="#fff" opacity=".9"/><text x="40" y="33" font-size="13" text-anchor="middle" fill="${isBW ? '#444' : '#15803D'}" font-family="Poppins" font-weight="700">★</text>
      <text x="68" y="24" fill="#fff" font-size="14" font-family="Poppins" font-weight="700">NADRA · National Database &amp; Registration Authority</text>
      <text x="68" y="42" fill="#fff" font-size="11" font-family="Poppins" opacity=".85">Child Registration Certificate (B-Form)</text>
      <text x="30" y="92" fill="#64748B" font-size="11" font-family="Poppins" font-weight="700">CHILD NAME</text>
      <text x="30" y="110" fill="#0F172A" font-size="15" font-family="Poppins" font-weight="700">${stuEsc(fullName)}</text>
      <text x="330" y="92" fill="#64748B" font-size="11" font-family="Poppins" font-weight="700">B-FORM / CRC No</text>
      <text x="330" y="110" fill="#0F172A" font-size="15" font-family="monospace" font-weight="700">${orDash(s.bform)}</text>
      <text x="30" y="150" fill="#64748B" font-size="11" font-family="Poppins" font-weight="700">FATHER NAME</text>
      <text x="30" y="168" fill="#0F172A" font-size="14" font-family="Poppins" font-weight="600">${stuEsc(s.father || '—')}</text>
      <text x="330" y="150" fill="#64748B" font-size="11" font-family="Poppins" font-weight="700">DATE OF BIRTH</text>
      <text x="330" y="168" fill="#0F172A" font-size="14" font-family="Poppins" font-weight="600">${fmtLong(s.dob)}</text>
      <text x="30" y="208" fill="#64748B" font-size="11" font-family="Poppins" font-weight="700">GENDER</text>
      <text x="30" y="226" fill="#0F172A" font-size="14" font-family="Poppins" font-weight="600">${stuEsc(s.gender || '—')}</text>
      <text x="330" y="208" fill="#64748B" font-size="11" font-family="Poppins" font-weight="700">FAMILY No</text>
      <text x="330" y="226" fill="#0F172A" font-size="14" font-family="monospace" font-weight="600">${orDash(s.family)}</text>
      <rect x="30" y="250" width="540" height="1" fill="#E4ECF8"/>
      <text x="30" y="284" fill="#64748B" font-size="11" font-family="Poppins" font-weight="700">PERMANENT ADDRESS</text>
      <text x="30" y="302" fill="#0F172A" font-size="13" font-family="Poppins" font-weight="600">${orDash(s.address)}</text>
      <rect x="420" y="270" width="150" height="80" rx="6" fill="none" stroke="${isBW ? '#ccc' : '#BFDBFE'}" stroke-dasharray="4 3"/>
      <text x="495" y="315" fill="#94a3b8" font-size="11" text-anchor="middle" font-family="Poppins">QR / Stamp</text>
      <text x="30" y="366" fill="#94a3b8" font-size="9" font-family="Poppins">SAMPLE — for layout visualization only · Government of Pakistan</text>
    </svg>`;

  const sampleCnic = (holder, cnic, side) => `
    <svg viewBox="0 0 856 540" width="100%" style="display:block;border-radius:12px;border:1px solid ${isBW ? '#ccc' : '#C7D7F0'};background:${isBW ? '#fafafa' : '#F4FAFF'}">
      <rect width="856" height="540" rx="14" fill="${isBW ? '#fafafa' : '#EAF3FF'}"/>
      <rect x="0" y="0" width="856" height="84" fill="${isBW ? '#444' : '#15803D'}"/>
      <text x="28" y="38" fill="#fff" font-size="20" font-family="Poppins" font-weight="700">Islamic Republic of Pakistan</text>
      <text x="28" y="66" fill="#fff" font-size="15" font-family="Poppins" opacity=".9">National Identity Card · NADRA</text>
      ${side === 'Front' ? `
        <rect x="28" y="120" width="150" height="190" rx="8" fill="${isBW ? '#eee' : '#D8E9FF'}" stroke="${isBW ? '#ccc' : '#BFDBFE'}"/>
        <circle cx="103" cy="180" r="40" fill="${isBW ? '#ccc' : '#9BC4F2'}"/><path d="M55 300 C55 235 151 235 151 300 Z" fill="${isBW ? '#ccc' : '#9BC4F2'}"/>
        <text x="210" y="150" fill="#64748B" font-size="14" font-family="Poppins" font-weight="700">Name</text>
        <text x="210" y="176" fill="#0F172A" font-size="20" font-family="Poppins" font-weight="700">${holder}</text>
        <text x="210" y="220" fill="#64748B" font-size="14" font-family="Poppins" font-weight="700">Identity Number</text>
        <text x="210" y="246" fill="#0F172A" font-size="22" font-family="monospace" font-weight="700">${cnic}</text>
        <text x="210" y="292" fill="#64748B" font-size="14" font-family="Poppins" font-weight="700">Date of Birth</text>
        <text x="210" y="316" fill="#0F172A" font-size="17" font-family="Poppins" font-weight="600">—</text>
        <text x="560" y="292" fill="#64748B" font-size="14" font-family="Poppins" font-weight="700">Gender</text>
        <text x="560" y="316" fill="#0F172A" font-size="17" font-family="Poppins" font-weight="600">${holder === stuEsc(s.mother || '') ? 'F' : 'M'}</text>
        <path d="M150 420 q40 -26 80 0 t80 0 t80 0 t80 0" stroke="${isBW ? '#bbb' : '#93C5FD'}" fill="none" stroke-width="2" opacity=".6"/>
        <text x="28" y="470" fill="#0F172A" font-size="15" font-family="Poppins" font-style="italic" font-weight="600">Signature</text>
      ` : `
        <text x="28" y="140" fill="#64748B" font-size="14" font-family="Poppins" font-weight="700">Present Address</text>
        <text x="28" y="166" fill="#0F172A" font-size="16" font-family="Poppins" font-weight="600">${orDash(s.address)}</text>
        <text x="28" y="216" fill="#64748B" font-size="14" font-family="Poppins" font-weight="700">Permanent Address</text>
        <text x="28" y="242" fill="#0F172A" font-size="16" font-family="Poppins" font-weight="600">${orDash(s.address)}</text>
        <text x="28" y="300" fill="#64748B" font-size="14" font-family="Poppins" font-weight="700">Date of Issue</text>
        <text x="28" y="326" fill="#0F172A" font-size="16" font-family="Poppins" font-weight="600">—</text>
        <text x="320" y="300" fill="#64748B" font-size="14" font-family="Poppins" font-weight="700">Date of Expiry</text>
        <text x="320" y="326" fill="#0F172A" font-size="16" font-family="Poppins" font-weight="600">—</text>
        <rect x="600" y="120" width="220" height="220" rx="8" fill="#fff" stroke="${isBW ? '#ccc' : '#BFDBFE'}"/>
        ${Array.from({ length: 8 }).map((_, r) => Array.from({ length: 8 }).map((_, col) => ((r * 7 + col * 3) % 3 === 0) ? `<rect x="${612 + col * 25}" y="${132 + r * 25}" width="22" height="22" fill="#0F172A"/>` : '').join('')).join('')}
        <text x="710" y="370" fill="#94a3b8" font-size="12" text-anchor="middle" font-family="Poppins">Smart Chip / QR</text>
      `}
      <text x="28" y="520" fill="#94a3b8" font-size="11" font-family="Poppins">SAMPLE — ${side} · for layout visualization only</text>
    </svg>`;

  const sampleBirth = () => `
    <svg viewBox="0 0 600 420" width="100%" style="display:block;border-radius:8px;border:1px solid ${isBW ? '#ccc' : '#C7D7F0'};background:#fff">
      <rect width="600" height="420" fill="#fff"/>
      <rect x="14" y="14" width="572" height="392" rx="6" fill="none" stroke="${isBW ? '#999' : '#C9A227'}" stroke-width="3"/>
      <rect x="22" y="22" width="556" height="376" rx="4" fill="none" stroke="${isBW ? '#ccc' : '#BFDBFE'}"/>
      <text x="300" y="64" text-anchor="middle" fill="${isBW ? '#333' : '#1E3A8A'}" font-size="22" font-family="Cinzel,serif" font-weight="700">BIRTH CERTIFICATE</text>
      <text x="300" y="86" text-anchor="middle" fill="#64748B" font-size="11" font-family="Poppins">Union Council · Local Government, Punjab</text>
      <line x1="180" y1="100" x2="420" y2="100" stroke="${isBW ? '#999' : '#C9A227'}" stroke-width="2"/>
      <text x="60" y="150" fill="#64748B" font-size="12" font-family="Poppins" font-weight="700">CHILD'S NAME</text>
      <text x="60" y="172" fill="#0F172A" font-size="17" font-family="Poppins" font-weight="700">${stuEsc(fullName)}</text>
      <text x="60" y="212" fill="#64748B" font-size="12" font-family="Poppins" font-weight="700">DATE OF BIRTH</text>
      <text x="60" y="232" fill="#0F172A" font-size="15" font-family="Poppins" font-weight="600">${fmtLong(s.dob)}</text>
      <text x="330" y="212" fill="#64748B" font-size="12" font-family="Poppins" font-weight="700">PLACE OF BIRTH</text>
      <text x="330" y="232" fill="#0F172A" font-size="15" font-family="Poppins" font-weight="600">—</text>
      <text x="60" y="272" fill="#64748B" font-size="12" font-family="Poppins" font-weight="700">FATHER'S NAME</text>
      <text x="60" y="292" fill="#0F172A" font-size="15" font-family="Poppins" font-weight="600">${stuEsc(s.father || '—')}</text>
      <text x="330" y="272" fill="#64748B" font-size="12" font-family="Poppins" font-weight="700">MOTHER'S NAME</text>
      <text x="330" y="292" fill="#0F172A" font-size="15" font-family="Poppins" font-weight="600">${orDash(s.mother)}</text>
      <text x="60" y="332" fill="#64748B" font-size="12" font-family="Poppins" font-weight="700">REGISTRATION No</text>
      <text x="60" y="352" fill="#0F172A" font-size="15" font-family="monospace" font-weight="600">BC-${stuEsc(s.reg || '')}</text>
      <circle cx="470" cy="330" r="40" fill="none" stroke="${isBW ? '#999' : '#C9A227'}" stroke-width="2"/><text x="470" y="334" text-anchor="middle" fill="${isBW ? '#999' : '#C9A227'}" font-size="10" font-family="Cinzel" font-weight="700">SEAL</text>
      <text x="60" y="388" fill="#94a3b8" font-size="9" font-family="Poppins">SAMPLE — for layout visualization only</text>
    </svg>`;

  const samplePrevCert = () => `
    <svg viewBox="0 0 600 360" width="100%" style="display:block;border-radius:8px;border:1px solid ${isBW ? '#ccc' : '#C7D7F0'};background:#fff">
      <rect width="600" height="360" fill="#fff"/>
      <rect x="0" y="0" width="600" height="50" fill="${isBW ? '#444' : '#1E3A8A'}"/>
      <text x="300" y="32" text-anchor="middle" fill="#fff" font-size="16" font-family="Poppins" font-weight="700">School Leaving / Transfer Certificate</text>
      ${[80, 75, 85, 60, 90, 55, 70].map((w, i) => `<rect x="40" y="${90 + i * 34}" width="${w}%" height="8" rx="4" fill="${isBW ? '#eee' : '#E4ECF8'}"/>`).join('')}
      <text x="40" y="345" fill="#94a3b8" font-size="9" font-family="Poppins">SAMPLE — for layout visualization only</text>
    </svg>`;

  const sampleCustom = (name) => `
    <svg viewBox="0 0 600 340" width="100%" style="display:block;border-radius:8px;border:1px solid ${isBW ? '#ccc' : '#C7D7F0'};background:#fff">
      <rect width="600" height="340" fill="#fff"/>
      <rect x="0" y="0" width="600" height="46" fill="${isBW ? '#444' : '#2563EB'}"/>
      <text x="300" y="30" text-anchor="middle" fill="#fff" font-size="15" font-family="Poppins" font-weight="700">${stuEsc(name)}</text>
      ${[85, 70, 90, 60, 80, 50].map((w, i) => `<rect x="40" y="${86 + i * 36}" width="${w}%" height="8" rx="4" fill="${isBW ? '#eee' : '#E4ECF8'}"/>`).join('')}
    </svg>`;

  const docSection = (title, icon, bodyHtml) => `
    <div style="margin-bottom:18px;break-inside:avoid">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <div style="width:26px;height:26px;border-radius:8px;background:${isBW ? '#eee' : 'rgba(37,99,235,.1)'};color:${isBW ? '#555' : '#2563EB'};display:flex;align-items:center;justify-content:center;font-size:12px">${icon}</div>
        <div style="font-size:13px;font-weight:800;color:${brand}">${stuEsc(title)}</div>
      </div>
      <div style="background:${isBW ? '#fcfcfc' : '#F8FAFC'};border:1px solid ${isBW ? '#e5e5e5' : '#E8EFFB'};border-radius:12px;padding:16px">${bodyHtml}</div>
    </div>`;

  const slot = (k) => (s.stdDocs || {})[k] || null;
  const has  = (k) => !!slot(k);

  /* Jo file user ne waqai upload ki hai WOHI dikhao. Pehle ye report hamesha
     apni banai hui "SAMPLE" drawing lagati thi, is liye document attach hone ke
     bawajood asli scan/tasveer kabhi nazar nahi aati thi. Path na ho (purana
     record) to hi sample drawing fallback ke tor par. */
  const docImg = (path, alt) => `<img src="${stuEsc(path)}" alt="${stuEsc(alt)}" loading="lazy" style="display:block;width:100%;max-height:520px;object-fit:contain;border-radius:8px;border:1px solid ${isBW ? '#ccc' : '#C7D7F0'};background:#fff"/>`;
  const docBody = (k, alt, sampleHtml) => {
    const p = slot(k)?.path;
    return p ? docImg(p, alt) : sampleHtml;
  };
  const cnicPair = (holder, cnic) =>
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px"><div><div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:5px">Front</div>${sampleCnic(holder, cnic, 'Front')}</div><div><div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:5px">Back</div>${sampleCnic(holder, cnic, 'Back')}</div></div>`;

  let docSections = '';
  if (has('bform')) docSections += docSection('B-Form', '&#x1F194;', docBody('bform', 'B-Form', sampleBform()));
  if (has('fcnic')) docSections += docSection('Father CNIC', '&#x1F4B3;',
    docBody('fcnic', 'Father CNIC', cnicPair(orDash(s.father), orDash(s.fcnic))));
  if (has('mcnic')) docSections += docSection('Mother CNIC', '&#x1F4B3;',
    docBody('mcnic', 'Mother CNIC', cnicPair(orDash(s.mother), orDash(s.mcnic))));
  if (has('birth')) docSections += docSection('Birth Certificate', '&#x1F4DC;', docBody('birth', 'Birth Certificate', sampleBirth()));
  if (has('prevcert')) docSections += docSection('Previous School Certificate', '&#x1F3EB;', docBody('prevcert', 'Previous School Certificate', samplePrevCert()));
  (s.docs || []).forEach(d => {
    const name = d.name || 'Document';
    docSections += docSection(name, '&#x1F4CE;', d.path ? docImg(d.path, name) : sampleCustom(name));
  });
  const docsHtml = docSections || '<span style="font-size:12px;color:#94a3b8">No documents uploaded.</span>';

  /* ── Fee adjustment table rows ── */
  const discItems = Object.entries(s._disc || {}).filter(([, v]) => Number(v) > 0);
  const discTotal = discItems.reduce((a, [, v]) => a + Number(v), 0);
  const discRows = discItems.length
    ? discItems.map(([k, v]) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eef2f9">${stuEsc(k)}</td><td style="padding:6px 10px;border-bottom:1px solid #eef2f9;text-align:right">Rs. ${Number(v).toLocaleString('en-PK')}</td></tr>`).join('')
      + `<tr><td style="padding:8px 10px;font-weight:800">Total Discount / Month</td><td style="padding:8px 10px;font-weight:800;text-align:right">Rs. ${discTotal.toLocaleString('en-PK')}</td></tr>`
    : '';

  return `
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      html,body{background:#eef2f9}body{font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;color:#0F172A;padding:24px}
      .page{background:#fff;max-width:820px;margin:0 auto 20px;box-shadow:0 10px 40px rgba(0,0,0,.12)}
      @page{size:A4 portrait;margin:14mm}
      @media print{body{background:#fff;padding:0}.page{box-shadow:none;margin:0;max-width:none}}
    </style>
    <div class="page">
      <div style="display:flex;align-items:center;gap:16px;padding:22px 30px;border-bottom:3px solid ${brand};${isBW ? '' : 'background:linear-gradient(135deg,rgba(30,58,138,.05),transparent)'}">
        <div>${logoSvg}</div>
        <div style="flex:1">
          <div style="font-family:'Instrument Serif',Georgia,serif;font-size:26px;font-weight:600;color:${brand};line-height:1">${stuEsc(school?.name || 'School')}</div>
          <div style="font-size:12px;color:#64748B;margin-top:3px">${stuEsc(campus)} · ${stuEsc(addr)} · ${stuEsc(phone)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:13px;font-weight:800;color:${brand};text-transform:uppercase;letter-spacing:.5px">Student Profile</div>
          <div style="font-size:11px;color:#64748B;margin-top:2px">Session ${stuEsc(session)}</div>
          <div style="font-size:10.5px;color:#94a3b8;margin-top:1px">Generated: ${new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
        </div>
      </div>

      <div style="padding:24px 30px">
        <div style="display:flex;gap:22px;margin-bottom:22px">
          <div style="width:120px;height:140px;border-radius:12px;overflow:hidden;border:3px solid ${isBW ? '#ddd' : '#DBEAFE'};flex-shrink:0">${photoBlock}</div>
          <div style="flex:1">
            <div style="font-size:24px;font-weight:800;color:${brand};letter-spacing:-.02em">${stuEsc(fullName)}</div>
            <div style="font-size:13px;color:#64748B;margin-bottom:10px">S/O ${stuEsc(s.father || '—')}</div>
            <div style="display:inline-flex;gap:8px;flex-wrap:wrap">
              <span style="font-size:12px;font-weight:700;color:#fff;background:${brand};border-radius:20px;padding:5px 14px">${stuEsc(cls?.cls || '—')} — ${stuEsc(cls?.sec || '—')}</span>
              <span style="font-size:12px;font-weight:700;color:${isBW ? '#333' : '#1E40AF'};background:${isBW ? '#f1f5f9' : '#EFF6FF'};border:1px solid ${isBW ? '#ddd' : '#BFDBFE'};border-radius:20px;padding:5px 14px">Reg# ${stuEsc(s.reg || '—')}</span>
              <span style="font-size:12px;font-weight:700;color:${isBW ? '#333' : '#1E40AF'};background:${isBW ? '#f1f5f9' : '#EFF6FF'};border:1px solid ${isBW ? '#ddd' : '#BFDBFE'};border-radius:20px;padding:5px 14px">Adm# ${dash(s.adm)}</span>
            </div>
          </div>
          <div style="width:84px;height:84px;flex-shrink:0;background:#fff">${QR_SVG ? QR_SVG.replace('<svg ', '<svg width="84" height="84" ') : ''}</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 30px">
          <div>
            <div style="font-size:12px;font-weight:800;color:${brand};text-transform:uppercase;letter-spacing:.6px;border-bottom:2px solid ${isBW ? '#eee' : '#DBEAFE'};padding-bottom:6px;margin-bottom:4px">Student Details</div>
            ${row('Registration No', stuEsc(s.reg || '—'))}
            ${row('Admission No', dash(s.adm))}
            ${row('Date of Birth', fmtLong(s.dob))}
            ${row('Gender', dash(s.gender))}
            ${row('B-Form / CNIC', dash(s.bform))}
            ${row('Nationality', dash(s.nat || 'Pakistani'))}
            ${row('Admission Date', s.admdate ? fmtLong(s.admdate) : '—')}
          </div>
          <div>
            <div style="font-size:12px;font-weight:800;color:${brand};text-transform:uppercase;letter-spacing:.6px;border-bottom:2px solid ${isBW ? '#eee' : '#DBEAFE'};padding-bottom:6px;margin-bottom:4px">Parent / Guardian &amp; Contact</div>
            ${row('Father Name', stuEsc(s.father || '—'))}
            ${row('Father CNIC', dash(s.fcnic))}
            ${row('Mother Name', dash(s.mother))}
            ${row('Guardian', dash(s.guardian))}
            ${row('Contact No', dash(s.mobile))}
            ${row('Email', dash(s.email))}
            ${row('Address', dash(s.address))}
          </div>
        </div>

        ${discRows ? `<div style="margin-top:22px">
          <div style="font-size:12px;font-weight:800;color:${brand};text-transform:uppercase;letter-spacing:.6px;border-bottom:2px solid ${isBW ? '#eee' : '#DBEAFE'};padding-bottom:6px;margin-bottom:8px">Fee Adjustment Summary</div>
          <table style="width:100%;border-collapse:collapse;font-size:12.5px">${discRows}</table>
        </div>` : ''}

        <div style="margin-top:22px;break-inside:avoid">
          <div style="font-size:12px;font-weight:800;color:${brand};text-transform:uppercase;letter-spacing:.6px;border-bottom:2px solid ${isBW ? '#eee' : '#DBEAFE'};padding-bottom:6px;margin-bottom:12px">Uploaded Documents</div>
          ${docsHtml}
        </div>

        <div style="margin-top:28px;padding-top:12px;border-top:1px solid ${isBW ? '#eee' : '#E8EFFB'};font-size:10.5px;color:#94a3b8;text-align:center">This profile is system-generated by ${stuEsc(school?.name || 'School')} ERP · ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
      </div>
    </div>`;
}

/* ID card ke QR me kya encode hota hai — student ka DB id.
   `_id` blank/0 ho (freshly added student) to reg ya adm no par gir jaate
   hain, warna QR bilkul khali reh jaata. */
function stuQrValue(s) {
  const id = String(s?._id ?? '').trim();
  if (id && id !== '0') return id;
  return String(s?.reg || s?.adm || '').trim();
}

/* Wrapper — SVG markup string, preview aur print HTML dono me lagta hai. */
function stuQrSVG(value) {
  /* quiet = 4 modules — ISO ka required quiet zone, warna chhote print size
     par scanner QR ke kinare nahi parh pata. */
  return qrSVG(value, { quiet: 4 });
}

/* ─── Single ID Card (front + back) on A4 ─── */
function buildStuIdCardHTML(s, cls, school, template, theme, session, role) {
  const initials = stuInitials(s);
  const isV = template === 'v';
  const front = `
    <div class="card">
      <div class="card-top" style="background:linear-gradient(135deg,${theme.c1},${theme.c2})">
        <div class="logo-wrap">${stuLogoImg(school)}</div>
        <div class="school-name">${stuEsc(school?.name || 'School')}</div>
        <div class="face-lbl">Front</div>
      </div>
      <div class="card-body">
        <div class="photo">${s.photo ? `<img src="${s.photo}" alt=""/>` : `<span>${stuEsc(initials)}</span>`}</div>
        <div class="lbl">Student Name</div>
        <div class="val val-name" style="color:${theme.ink}">${stuEsc(stuFullName(s))}</div>
        <div class="kv-row"><div><div class="lbl">Class / Section</div><div class="val">${stuEsc(cls?.cls || '—')} · ${stuEsc(cls?.sec || '—')}</div></div><div><div class="lbl">Reg No</div><div class="val mono">${stuEsc(s.reg)}</div></div></div>
        <div class="kv-row"><div><div class="lbl">Father</div><div class="val">${stuEsc(s.father || '—')}</div></div><div><div class="lbl">Designation</div><div class="val">${stuEsc(role || 'Student')}</div></div></div>
        <div class="kv-row"><div><div class="lbl">Date of Birth</div><div class="val">${stuFmtDate(s.dob)}</div></div><div><div class="lbl">Session</div><div class="val">${stuEsc(session || '2026-2027')}</div></div></div>
      </div>
      <div class="card-foot" style="background:${theme.c1}">If found, please return to the school office.</div>
    </div>`;
  const back = `
    <div class="card">
      <div class="card-top" style="background:linear-gradient(135deg,${theme.c1},${theme.c2})">
        <div class="logo-wrap">${stuLogoImg(school)}</div>
        <div class="school-name">${stuEsc(school?.name || 'School')}</div>
        <div class="face-lbl">Back</div>
      </div>
      <div class="card-body card-body-back">
        <div class="qr-strip-back"><div class="qr-big" style="box-shadow:0 0 0 0.5mm ${theme.c1}">${stuQrSVG(stuQrValue(s))}</div><div class="qr-meta"><div class="qr-l">Scan to verify</div><div class="qr-reg" style="color:${theme.c1}">${stuEsc(s.reg)}</div><div class="qr-s">Valid for ${stuEsc(session || '2026-2027')}</div></div></div>
        <div class="back-rows">
          <div class="back-row"><span class="lbl">Guardian</span><b>${stuEsc(s.father || '—')}</b></div>
          <div class="back-row"><span class="lbl">Mobile</span><b class="mono">${stuEsc(s.mobile || '—')}</b></div>
          <div class="back-row"><span class="lbl">D.O.B.</span><b>${stuFmtDate(s.dob)}</b></div>
          <div class="back-row"><span class="lbl">Adm No</span><b class="mono">${stuEsc(s.adm || '—')}</b></div>
          ${s.bform ? `<div class="back-row"><span class="lbl">B-Form</span><b class="mono">${stuEsc(s.bform)}</b></div>` : ''}
        </div>
        ${school?.address || school?.phone ? `<div class="addr">${school?.address ? stuEsc(school.address) : ''}${school?.phone ? ` · ☎ ${stuEsc(school.phone)}` : ''}</div>` : ''}
      </div>
      <div class="card-foot" style="background:${theme.c1}">Property of ${stuEsc(school?.name || 'School')} — return if found.</div>
    </div>`;
  const css = `
    *{box-sizing:border-box;margin:0;padding:0;font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif}
    html,body{background:#F1F3F8}body{padding:14px 0}
    .sheet{display:flex;flex-direction:column;align-items:center;gap:20px;padding:14px}
    .card{${isV ? 'width:54mm;height:86mm;' : 'width:86mm;height:54mm;'}border-radius:4mm;overflow:hidden;background:#fff;box-shadow:0 6px 18px rgba(15,23,42,.18);display:flex;flex-direction:column}
    .card-top{padding:3mm 4mm 2mm;color:#fff;display:flex;align-items:center;gap:2mm;position:relative}
    .logo-wrap{width:7mm;height:7mm;flex-shrink:0;background:#fff;border-radius:1.5mm;padding:0.4mm;display:flex;align-items:center;justify-content:center}
    .logo-wrap svg,.logo-wrap img{width:100%;height:100%;object-fit:contain;display:block}
    .school-name{font-size:9.5px;font-weight:800;letter-spacing:.3px;flex:1;line-height:1.1}
    .face-lbl{position:absolute;right:3mm;top:2mm;background:rgba(255,255,255,.18);padding:1mm 2mm;border-radius:2mm;font-size:7px;font-weight:800;text-transform:uppercase;letter-spacing:.4px}
    .card-body{padding:3mm 4mm;flex:1;display:flex;flex-direction:column;${isV ? '' : 'flex-direction:row;'}gap:2mm;background:#fff}
    .photo{${isV ? 'width:24mm;height:28mm;align-self:center;' : 'width:24mm;height:32mm;'}border-radius:2mm;background:${theme.c1}18;color:${theme.c1};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;overflow:hidden;flex-shrink:0;border:1px solid ${theme.c1}33}
    .photo img{width:100%;height:100%;object-fit:cover}
    .photo span{font-size:18px}
    .card-body > .lbl,.card-body > .val,.card-body > .kv-row,.card-body > .qr-strip{${isV ? '' : 'margin-left:0;'}}
    .lbl{font-size:6px;font-weight:800;color:#64748B;text-transform:uppercase;letter-spacing:.3px;line-height:1}
    .val{font-size:9px;color:#0F172A;font-weight:700;margin-top:0.4mm;line-height:1.15}
    .val-name{font-size:11px;font-weight:800;letter-spacing:-.01em}
    .val.mono{font-family:ui-monospace,Menlo,monospace;color:${theme.c1};font-weight:800}
    .kv-row{display:grid;grid-template-columns:1fr 1fr;gap:1.5mm 3mm;margin-top:1.6mm}
    .qr-strip{margin-top:auto;padding-top:2mm;display:flex;align-items:center;gap:2.5mm;border-top:0.6px dashed #CBD5E1;${isV ? '' : 'flex-direction:column;align-items:flex-start;padding-top:1.5mm;'}}
    .qr{width:11mm;height:11mm;background:repeating-linear-gradient(0deg, #111 0 0.7mm, transparent 0.7mm 1.4mm),repeating-linear-gradient(90deg, #111 0 0.7mm, transparent 0.7mm 1.4mm);background-blend-mode:multiply;border:0.7mm solid #fff;border-radius:1mm;box-shadow:0 0 0 0.4mm ${theme.c1}}
    .qr-meta{flex:1;min-width:0}
    .qr-l{font-size:6px;font-weight:800;color:#0F172A;text-transform:uppercase;letter-spacing:.3px}
    .qr-s{font-size:6.5px;color:#475569;margin-top:0.5mm;font-weight:600}
    .card-foot{color:#fff;padding:1.5mm 3mm;font-size:6.5px;font-weight:700;text-align:center;letter-spacing:.3px}
    .card-body-back{justify-content:flex-start;flex-direction:column !important}
    .qr-strip-back{display:flex;align-items:center;gap:3mm;padding:1mm 0 2mm}
    .qr-big{width:18mm;height:18mm;background:#fff;border:0.7mm solid #fff;border-radius:1mm;flex-shrink:0;overflow:hidden}
    .qr-big svg{display:block;width:100%;height:100%}
    .qr-reg{font-size:10px;font-weight:800;margin-top:0.6mm;font-family:ui-monospace,Menlo,monospace;letter-spacing:.3px}
    .back-rows{display:grid;grid-template-columns:1fr 1fr;gap:1.4mm 3mm;margin-top:1mm;padding-top:1.5mm;border-top:0.6px dashed #CBD5E1}
    .back-row{display:flex;flex-direction:column;gap:0.3mm}
    .back-row .lbl{font-size:6px;color:#64748B;text-transform:uppercase;letter-spacing:.3px;font-weight:800}
    .back-row b{font-size:8.5px;color:#0F172A;font-weight:700;line-height:1.15}
    .back-row b.mono{font-family:ui-monospace,Menlo,monospace}
    .addr{margin-top:auto;padding-top:1.5mm;font-size:6.5px;color:#475569;text-align:center;line-height:1.3;font-weight:600;border-top:0.6px dashed #CBD5E1}
    @page{size:A4 portrait;margin:10mm}
    @media print{body{background:#fff;padding:0}.sheet{padding:0}}
  `;
  return { css, html: `<div class="sheet">${front}${back}</div>` };
}

/* ─── Bulk ID Cards on A4 sheet ─── */
function buildStuBulkIdHTML(students, cls, school, template, theme, session) {
  const isV = template === 'v';
  const inner = students.map(s => {
    const initials = stuInitials(s);
    const front = `
      <div class="card">
        <div class="card-top" style="background:linear-gradient(135deg,${theme.c1},${theme.c2})">
          <div class="logo-wrap">${stuLogoImg(school)}</div>
          <div class="school-name">${stuEsc(school?.name || 'School')}</div>
          <div class="face-lbl">Front</div>
        </div>
        <div class="card-body">
          <div class="photo">${s.photo ? `<img src="${s.photo}" alt=""/>` : `<span>${stuEsc(initials)}</span>`}</div>
          <div class="lbl">Student Name</div>
          <div class="val val-name" style="color:${theme.ink}">${stuEsc(stuFullName(s))}</div>
          <div class="kv-row"><div><div class="lbl">Class</div><div class="val">${stuEsc(cls?.cls || '—')} · ${stuEsc(cls?.sec || '—')}</div></div><div><div class="lbl">Reg</div><div class="val mono">${stuEsc(s.reg)}</div></div></div>
          <div class="kv-row"><div><div class="lbl">Father</div><div class="val">${stuEsc(s.father || '—')}</div></div><div><div class="lbl">Session</div><div class="val">${stuEsc(session || '2026-2027')}</div></div></div>
        </div>
        <div class="card-foot" style="background:${theme.c1}">If found, please return to the school office.</div>
      </div>`;
    const back = `
      <div class="card">
        <div class="card-top" style="background:linear-gradient(135deg,${theme.c1},${theme.c2})">
          <div class="logo-wrap">${stuLogoImg(school)}</div>
          <div class="school-name">${stuEsc(school?.name || 'School')}</div>
          <div class="face-lbl">Back</div>
        </div>
        <div class="card-body card-body-back">
          <div class="qr-strip-back"><div class="qr-big">${stuQrSVG(stuQrValue(s))}</div><div class="qr-meta"><div class="qr-l">Scan to verify</div><div class="qr-reg" style="color:${theme.c1}">${stuEsc(s.reg)}</div></div></div>
          <div class="back-rows">
            <div class="back-row"><span class="lbl">Guardian</span><b>${stuEsc(s.father || '—')}</b></div>
            <div class="back-row"><span class="lbl">Mobile</span><b class="mono">${stuEsc(s.mobile || '—')}</b></div>
            <div class="back-row"><span class="lbl">D.O.B.</span><b>${stuFmtDate(s.dob)}</b></div>
            <div class="back-row"><span class="lbl">Adm No</span><b class="mono">${stuEsc(s.adm || '—')}</b></div>
          </div>
        </div>
        <div class="card-foot" style="background:${theme.c1}">Property of ${stuEsc(school?.name || 'School')} — return if found.</div>
      </div>`;
    return front + back;
  }).join('');
  const css = `
    *{box-sizing:border-box;margin:0;padding:0;font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif}
    html,body{background:#F1F3F8}body{padding:10px 0}
    .sheet{display:grid;grid-template-columns:${isV ? 'repeat(4,1fr)' : 'repeat(2,1fr)'};gap:6mm;padding:8mm;background:#fff;width:210mm;margin:0 auto;box-shadow:0 10px 30px rgba(15,23,42,.12)}
    .card{${isV ? 'height:86mm;' : 'height:54mm;'}border-radius:3mm;overflow:hidden;background:#fff;border:1px dashed #94A3B8;display:flex;flex-direction:column;page-break-inside:avoid}
    .card-top{padding:2.5mm 3mm 1.5mm;color:#fff;display:flex;align-items:center;gap:1.5mm;position:relative}
    .logo-wrap{width:6mm;height:6mm;flex-shrink:0;background:#fff;border-radius:1.2mm;padding:0.3mm;display:flex;align-items:center;justify-content:center}
    .logo-wrap svg,.logo-wrap img{width:100%;height:100%;object-fit:contain;display:block}
    .school-name{font-size:8px;font-weight:800;flex:1;line-height:1.1}
    .face-lbl{position:absolute;right:2.5mm;top:1.8mm;background:rgba(255,255,255,.18);padding:0.7mm 1.6mm;border-radius:1.6mm;font-size:6px;font-weight:800;text-transform:uppercase;letter-spacing:.4px}
    .card-body{padding:2.5mm 3mm;flex:1;display:flex;flex-direction:${isV ? 'column' : 'row'};gap:2mm}
    .photo{${isV ? 'width:18mm;height:22mm;align-self:center;' : 'width:18mm;height:24mm;'}border-radius:2mm;background:${theme.c1}18;color:${theme.c1};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;overflow:hidden;flex-shrink:0;border:0.5px solid ${theme.c1}33}
    .photo img{width:100%;height:100%;object-fit:cover}
    .lbl{font-size:5.5px;font-weight:800;color:#64748B;text-transform:uppercase;letter-spacing:.3px}
    .val{font-size:8px;color:#0F172A;font-weight:700;margin-top:0.3mm}
    .val-name{font-size:9.5px;font-weight:800}
    .val.mono{font-family:ui-monospace,Menlo,monospace;color:${theme.c1};font-weight:800}
    .kv-row{display:grid;grid-template-columns:1fr 1fr;gap:1mm 2.5mm;margin-top:1.3mm}
    .card-foot{color:#fff;padding:1mm 2mm;font-size:5.5px;font-weight:700;text-align:center}
    .card-body-back{flex-direction:column !important}
    .qr-strip-back{display:flex;align-items:center;gap:2.5mm;padding:0.5mm 0 1.5mm}
    .qr-big{width:${isV ? '15mm' : '13mm'};height:${isV ? '15mm' : '13mm'};background:#fff;border:0.6mm solid #fff;border-radius:1mm;flex-shrink:0;overflow:hidden;box-shadow:0 0 0 0.3mm ${theme.c1}}
    .qr-big svg{display:block;width:100%;height:100%}
    .qr-meta{flex:1;min-width:0}
    .qr-l{font-size:5.5px;font-weight:800;color:#0F172A;text-transform:uppercase;letter-spacing:.3px}
    .qr-reg{font-size:8.5px;font-weight:800;margin-top:0.4mm;font-family:ui-monospace,Menlo,monospace;letter-spacing:.3px}
    .back-rows{display:grid;grid-template-columns:1fr 1fr;gap:1mm 2.5mm;margin-top:0.8mm;padding-top:1.2mm;border-top:0.6px dashed #CBD5E1}
    .back-row{display:flex;flex-direction:column;gap:0.2mm}
    .back-row .lbl{font-size:5.5px;color:#64748B;text-transform:uppercase;letter-spacing:.3px;font-weight:800}
    .back-row b{font-size:7.5px;color:#0F172A;font-weight:700;line-height:1.15}
    .back-row b.mono{font-family:ui-monospace,Menlo,monospace}
    @page{size:A4 portrait;margin:0}
    @media print{body{background:#fff;padding:0}.sheet{box-shadow:none;width:auto;margin:0}}
  `;
  return { css, html: `<div class="sheet">${inner}</div>` };
}

/* ─── Class roster PDF (A4 landscape feel) ─── */
/* ─── A4 Inactive-students report (matches HTML reference) ─── */
function buildStuInactiveReportHTML(list, title, school) {
  const brand = '#1E3A8A';
  const money = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-PK');
  /* "Inactive On" — student ko kab inactive kiya gaya (API ka inactiveDate).
     "31 Jul 2026" ki tarah, baqi report ki tarah hi. */
  const inactiveOn = (v) => {
    const raw = String(v || '').trim();
    if (!raw) return '—';
    const d = new Date(raw.replace(' ', 'T'));
    return Number.isNaN(d.getTime())
      ? raw
      : d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const campus = school?.campus || 'Main Campus';
  const addr   = school?.address || '';
  const phone  = school?.phone || '';
  const session = school?.session || '';
  const logoSvg = school?.logo
    ? `<img src="${school.logo}" alt="logo" width="46" height="46" style="object-fit:contain;border-radius:9px"/>`
    : `<svg width="46" height="46" viewBox="0 0 36 36"><rect width="36" height="36" rx="9" fill="${brand}"/><path d="M18 9 L26 13 L18 17 L10 13 Z" fill="rgba(255,255,255,.95)"/><path d="M12 15 L12 21 C12 21 15 23 18 23 C21 23 24 21 24 21 L24 15" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="1.4"/><line x1="26" y1="13" x2="26" y2="19" stroke="rgba(255,255,255,.9)" stroke-width="1.2"/></svg>`;
  const rows = list.map((s, i) => {
    const dueTotal = Number(s.dues?.total || 0);
    const outCell = dueTotal > 0
      ? `<span style="color:#B91C1C;font-weight:800">${money(dueTotal)}</span>`
      : `<span style="color:#16A34A;font-weight:800">Cleared</span>`;
    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #eef2f9">${i + 1}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eef2f9;font-weight:700;color:#1E40AF">${stuEsc(s.reg || '—')}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eef2f9;font-weight:600">${stuEsc(stuFullName(s))}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eef2f9">${stuEsc(s.father || '—')}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eef2f9">${stuEsc((s.cls || '—') + ' / ' + (s.sec || '—'))}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eef2f9;white-space:nowrap">${stuEsc(inactiveOn(s.inactiveDate))}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eef2f9">${stuEsc(s.reason || '—')}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eef2f9;text-align:right">${outCell}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="8" style="padding:24px;text-align:center;color:#94a3b8;font-style:italic">No inactive students for this selection.</td></tr>`;

  return `
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      html,body{background:#eef2f9}body{font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;color:#0F172A;padding:24px}
      .page{background:#fff;max-width:840px;margin:0 auto;box-shadow:0 10px 40px rgba(0,0,0,.12)}
      @page{size:A4 portrait;margin:14mm}
      @media print{body{background:#fff;padding:0}.page{box-shadow:none;margin:0;max-width:none}}
    </style>
    <div class="page">
      <div style="display:flex;align-items:center;gap:16px;padding:22px 30px;border-bottom:3px solid ${brand};background:linear-gradient(135deg,rgba(30,58,138,.05),transparent)">
        <div>${logoSvg}</div>
        <div style="flex:1">
          <div style="font-family:'Instrument Serif',Georgia,serif;font-size:26px;font-weight:600;color:${brand};line-height:1">${stuEsc(school?.name || 'School')}</div>
          <div style="font-size:12px;color:#64748B;margin-top:3px">${stuEsc(campus)} · ${stuEsc(addr)} · ${stuEsc(phone)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:13px;font-weight:800;color:${brand};text-transform:uppercase;letter-spacing:.5px">${stuEsc(title)}</div>
          <div style="font-size:11px;color:#64748B;margin-top:2px">Session ${stuEsc(session)}</div>
          <div style="font-size:10.5px;color:#94a3b8;margin-top:1px">Generated: ${new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
        </div>
      </div>
      <div style="padding:22px 30px">
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
          <span style="font-size:12px;font-weight:700;color:#fff;background:${brand};border-radius:20px;padding:6px 16px">Total Inactive: ${list.length}</span>
          <span style="font-size:12px;font-weight:700;color:#B91C1C;background:rgba(220,38,38,.08);border:1px solid rgba(220,38,38,.22);border-radius:20px;padding:6px 16px">With Dues: ${list.filter(s => Number(s.dues?.total || 0) > 0).length}</span>
          <span style="font-size:12px;font-weight:700;color:#15803D;background:rgba(22,163,74,.08);border:1px solid rgba(22,163,74,.22);border-radius:20px;padding:6px 16px">Cleared: ${list.filter(s => !Number(s.dues?.total || 0)).length}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12.5px">
          <thead><tr style="background:#EFF6FF">
            ${['#', 'Reg No', 'Name', 'Father', 'Last Class/Sec', 'Inactive On', 'Reason', 'Outstanding']
              .map((h, idx) => `<th style="text-align:${idx === 7 ? 'right' : 'left'};padding:9px 10px;color:#1E40AF;font-size:11px;text-transform:uppercase;letter-spacing:.4px">${h}</th>`).join('')}
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:24px;font-size:10.5px;color:#94a3b8;text-align:center">System-generated by ${stuEsc(school?.name || 'School')} ERP · ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
      </div>
    </div>`;
}

function buildStuClassReportHTML(c, school, isBW = false) {
  const color  = isBW ? '#1F2937' : '#1E3A8A';
  const rows = c.students.map((s, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td class="mono">${stuEsc(s.reg)}</td>
      <td class="mono">${stuEsc(s.adm || '—')}</td>
      <td><b>${stuEsc(stuFullName(s))}</b></td>
      <td>${stuEsc(s.father || '—')}</td>
      <td class="c">${stuFmtDate(s.dob)}</td>
      <td class="c">${stuEsc(s.gender || '—')}</td>
      <td class="mono">${stuEsc(s.mobile || '—')}</td>
      <td class="c">${stuHasDiscount(s) ? '<span style="color:#B91C1C;font-weight:800">✓</span>' : ''}</td>
    </tr>`).join('');
  return `
    <style>
      *{box-sizing:border-box;margin:0;padding:0;font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif}
      html,body{background:#F1F3F8}body{padding:18px 0;font-size:10.5px}
      .page{width:210mm;min-height:297mm;margin:0 auto;padding:14mm;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,.12)}
      .rhead{display:flex;align-items:center;gap:14px;border-bottom:2px solid ${color};padding-bottom:10px;margin-bottom:14px}
      .rlogo{width:46px;height:46px;flex-shrink:0}
      .rname{font-size:17px;font-weight:800;color:#0F172A}
      .rtitle{font-size:12px;font-weight:700;color:${color};margin-top:3px}
      .meta{margin-left:auto;font-size:9.5px;color:#64748B;text-align:right;line-height:1.55}
      .sec-band{background:${color};color:#fff;padding:7px 13px;border-radius:6px;font-weight:800;font-size:11.5px;margin-bottom:9px;display:flex;justify-content:space-between;align-items:center}
      .sec-band small{font-size:10px;opacity:.85;font-weight:700}
      .tbl{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;font-size:10.5px}
      .tbl thead th{background:${color};color:#fff;padding:7px 9px;text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.3px;font-weight:800}
      .tbl th.c,.tbl td.c{text-align:center}
      .tbl td{padding:7px 9px;border-bottom:1px solid #F1F3F8;vertical-align:top}
      .tbl tbody tr:nth-child(even) td{background:#FBFCFF}
      .mono{font-family:ui-monospace,Menlo,monospace;color:${color};font-weight:800}
      .rfoot{margin-top:14px;text-align:center;font-size:9px;color:#94A3B8;border-top:1px solid #e5e9f2;padding-top:8px}
      @page{size:A4 portrait;margin:0}
      @media print{body{background:#fff;padding:0}.page{width:auto;min-height:0;margin:0;padding:14mm;box-shadow:none}}
    </style>
    <div class="page">
      <div class="rhead">
        <div class="rlogo">${stuLogoImg(school)}</div>
        <div>
          <div class="rname">${stuEsc(school?.name || 'School')}</div>
          <div class="rtitle">Student List — ${stuEsc(c.cls)} (${stuEsc(c.sec)})</div>
        </div>
        <div class="meta">Generated: ${stuFmtDate(new Date().toISOString().slice(0, 10))}<br/>${stuEsc(school?.session || '')}</div>
      </div>
      <div class="sec-band"><span>${stuEsc(c.cls)} — Section ${stuEsc(c.sec)}</span><small>${c.students.length} student(s)</small></div>
      <table class="tbl">
        <thead><tr><th class="c" style="width:30px">#</th><th style="width:90px">Reg No</th><th style="width:90px">Admission No</th><th>Name</th><th>Father Name</th><th class="c" style="width:80px">DOB</th><th class="c" style="width:55px">Gender</th><th style="width:100px">Contact</th><th class="c" style="width:70px">Discount</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="9" style="text-align:center;padding:24px;color:#94A3B8">No students.</td></tr>'}</tbody>
      </table>
      <div class="rfoot">${stuEsc(school?.name || 'School')} · Class Report · Generated ${stuFmtDate(new Date().toISOString().slice(0, 10))}</div>
    </div>`;
}

/* ─── Whole-school roster PDF ─── */
function buildStuSchoolReportHTML(classes, school, isBW = false) {
  const color = isBW ? '#1F2937' : '#1E3A8A';
  const total = classes.reduce((a, c) => a + c.students.length, 0);
  const sections = classes.map(c => `
    <div class="sec-band"><span>${stuEsc(c.cls)} — Section ${stuEsc(c.sec)}</span><small>${c.students.length} student(s)</small></div>
    <table class="tbl">
      <thead><tr><th class="c" style="width:30px">#</th><th style="width:90px">Reg No</th><th>Name</th><th>Father Name</th><th class="c" style="width:80px">DOB</th><th style="width:100px">Contact</th></tr></thead>
      <tbody>${c.students.length === 0
        ? '<tr><td colspan="6" style="text-align:center;padding:18px;color:#94A3B8">No students.</td></tr>'
        : c.students.map((s, i) => `<tr><td class="c">${i + 1}</td><td class="mono">${stuEsc(s.reg)}</td><td><b>${stuEsc(stuFullName(s))}</b></td><td>${stuEsc(s.father || '—')}</td><td class="c">${stuFmtDate(s.dob)}</td><td class="mono">${stuEsc(s.mobile || '—')}</td></tr>`).join('')}</tbody>
    </table>
  `).join('');
  return `
    <style>
      *{box-sizing:border-box;margin:0;padding:0;font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif}
      html,body{background:#F1F3F8}body{padding:18px 0;font-size:10.5px}
      .page{width:210mm;min-height:297mm;margin:0 auto;padding:14mm;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,.12)}
      .rhead{display:flex;align-items:center;gap:14px;border-bottom:2px solid ${color};padding-bottom:10px;margin-bottom:14px}
      .rlogo{width:46px;height:46px;flex-shrink:0}
      .rname{font-size:17px;font-weight:800;color:#0F172A}
      .rtitle{font-size:12px;font-weight:700;color:${color};margin-top:3px}
      .meta{margin-left:auto;font-size:9.5px;color:#64748B;text-align:right;line-height:1.55}
      .kpi-row{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:14px}
      .kpi{border:1px solid #E5E7EB;border-radius:8px;padding:10px 12px;background:#F8FAFF;position:relative;overflow:hidden}
      .kpi::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:${color}}
      .kpi .l{font-size:9px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.3px}
      .kpi .v{font-size:18px;font-weight:800;color:#0F172A;margin-top:2px}
      .sec-band{background:${color};color:#fff;padding:6px 13px;border-radius:6px;font-weight:800;font-size:11px;margin:14px 0 7px;display:flex;justify-content:space-between;align-items:center}
      .sec-band small{font-size:9.5px;opacity:.85;font-weight:700}
      .tbl{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;font-size:10px;margin-bottom:8px}
      .tbl thead th{background:${color};color:#fff;padding:6px 8px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.3px;font-weight:800}
      .tbl th.c,.tbl td.c{text-align:center}
      .tbl td{padding:6px 8px;border-bottom:1px solid #F1F3F8;vertical-align:top}
      .tbl tbody tr:nth-child(even) td{background:#FBFCFF}
      .mono{font-family:ui-monospace,Menlo,monospace;color:${color};font-weight:800}
      .rfoot{margin-top:14px;text-align:center;font-size:9px;color:#94A3B8;border-top:1px solid #e5e9f2;padding-top:8px}
      @page{size:A4 portrait;margin:0}
      @media print{body{background:#fff;padding:0}.page{width:auto;min-height:0;margin:0;padding:14mm;box-shadow:none}.tbl tr{page-break-inside:avoid}}
    </style>
    <div class="page">
      <div class="rhead">
        <div class="rlogo">${stuLogoImg(school)}</div>
        <div>
          <div class="rname">${stuEsc(school?.name || 'School')}</div>
          <div class="rtitle">Whole-School Student Roster</div>
        </div>
        <div class="meta">Generated: ${stuFmtDate(new Date().toISOString().slice(0, 10))}<br/>${stuEsc(school?.session || '')}</div>
      </div>
      <div class="kpi-row">
        <div class="kpi"><div class="l">Active Students</div><div class="v">${total}</div></div>
        <div class="kpi"><div class="l">Sections</div><div class="v">${classes.length}</div></div>
        <div class="kpi"><div class="l">Distinct Classes</div><div class="v">${new Set(classes.map(c => c.cls)).size}</div></div>
      </div>
      ${sections}
      <div class="rfoot">${stuEsc(school?.name || 'School')} · School Report · Generated ${stuFmtDate(new Date().toISOString().slice(0, 10))}</div>
    </div>`;
}

/* ─── Certificate PDF (A4 portrait) ─── */
function buildStuCertHTML(s, cls, school, type, style, opts) {
  const isBW = style === 'bw';
  const fullName = stuFullName(s);
  const clsSec   = `${cls?.cls || '—'} – ${cls?.sec || '—'}`;
  /* Pronouns */
  const fem  = s.gender === 'Female';
  const he   = fem ? 'she' : 'he';
  const his  = fem ? 'her' : 'his';
  const him  = fem ? 'her' : 'him';
  const He   = fem ? 'She' : 'He';
  const fmtLong = (iso) => {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  const today   = opts.date    ? fmtLong(opts.date)    : fmtLong(new Date().toISOString().slice(0, 10));
  const leaving = opts.leavingDate ? fmtLong(opts.leavingDate) : today;
  const customBody = (opts.body || '').trim();

  /* ── Title / subtitle / badge icon / info table / body content ── */
  const fallbackTitle = type === 'character' ? 'Character Certificate'
                      : type === 'leaving'   ? 'School Leaving Certificate'
                      : type === 'promotion' ? 'Certificate of Promotion'
                      : 'Certificate of Appreciation';
  const titleMain = stuEsc((opts.title || fallbackTitle).trim());

  let titleSub, badgeIcon, infoTable = '', bodyHtml;
  if (type === 'character') {
    titleSub  = 'Certificate of Good Character &amp; Conduct';
    badgeIcon = '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>';
    bodyHtml = customBody
      ? `This is to certify that <span class="hl">${stuEsc(fullName)}</span> of Class <span class="hl">${stuEsc(clsSec)}</span>, <span class="hl">${stuEsc(school?.name || 'School')}</span>. ${stuEsc(customBody)}`
      : `This is to certify that <span class="hl">${stuEsc(fullName)}</span> was a student of Class <span class="hl">${stuEsc(clsSec)}</span> at <span class="hl">${stuEsc(school?.name || 'School')}</span>. During ${his} studies, ${he} has displayed excellent character, discipline, and moral conduct.`;
  } else if (type === 'leaving') {
    titleSub  = 'Certificate of Completion &amp; Clearance';
    badgeIcon = '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>';
    infoTable = `<div class="info-tbl">
      <div class="info-r"><div class="info-k">Student Name</div><div class="info-v">${stuEsc(fullName)}</div></div>
      <div class="info-r"><div class="info-k">Class / Section</div><div class="info-v">${stuEsc(clsSec)}</div></div>
      <div class="info-r"><div class="info-k">Registration No</div><div class="info-v">${stuEsc(s.reg || '—')}</div></div>
      <div class="info-r"><div class="info-k">Leaving Date</div><div class="info-v">${stuEsc(leaving)}</div></div>
      <div class="info-r"><div class="info-k">Status</div><div class="info-v"><span class="status-ok">&#10004; No Pending Matters</span></div></div>
    </div>`;
    bodyHtml = customBody
      ? stuEsc(customBody)
      : `This is to certify that <span class="hl">${stuEsc(fullName)}</span> was a student of Class <span class="hl">${stuEsc(clsSec)}</span> at <span class="hl">${stuEsc(school?.name || 'School')}</span>. ${He} is no longer studying here since <span class="hl">${stuEsc(leaving)}</span> and has no pending matters.`;
  } else if (type === 'promotion') {
    titleSub  = 'Certificate of Academic Promotion';
    badgeIcon = '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>';
    const fromCls = stuEsc(opts.promFrom || cls?.cls || '—');
    const toCls   = stuEsc(opts.promTo || '—');
    const session = stuEsc(((opts.promSession || school?.session || '').toString().trim()) || '—');
    infoTable = `<div class="info-tbl">
      <div class="info-r"><div class="info-k">Student Name</div><div class="info-v">${stuEsc(fullName)}</div></div>
      <div class="info-r"><div class="info-k">Promoted From</div><div class="info-v">Class ${fromCls}${cls?.sec ? ` – ${stuEsc(cls.sec)}` : ''}</div></div>
      <div class="info-r"><div class="info-k">Promoted To</div><div class="info-v">Class ${toCls}</div></div>
      <div class="info-r"><div class="info-k">Academic Session</div><div class="info-v">${session}</div></div>
    </div>`;
    bodyHtml = customBody
      ? `This is to certify that <span class="hl">${stuEsc(fullName)}</span> ${stuEsc(customBody)}`
      : `This is to certify that <span class="hl">${stuEsc(fullName)}</span> has successfully completed the requirements of Class <span class="hl">${fromCls}</span> and is hereby promoted to Class <span class="hl">${toCls}</span> for the academic session <span class="hl">${session}</span>. Awarded this <span class="hl">${stuEsc(today)}</span>.`;
  } else {
    titleSub  = 'In Recognition of Excellence';
    badgeIcon = '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>';
    const intro = `This certificate is proudly presented to <span class="hl">${stuEsc(fullName)}</span> of Class <span class="hl">${stuEsc(clsSec)}</span>, <span class="hl">${stuEsc(school?.name || 'School')}</span>. `;
    bodyHtml = intro + (customBody
      ? stuEsc(customBody)
      : `In recognition of ${his} outstanding performance and conduct. We commend ${him} and wish ${him} continued success.`);
  }

  /* ── Signature blocks (Principal default ON; Director/Teacher optional) ── */
  const sigs = [];
  const pOn = opts.sigPrincipal === undefined ? true : !!opts.sigPrincipal;
  if (pOn)               sigs.push({ name: opts.namePrincipal || 'Principal',    role: 'Principal' });
  if (opts.sigDirector)  sigs.push({ name: opts.nameDirector  || 'Director',      role: 'Director' });
  if (opts.sigTeacher)   sigs.push({ name: opts.nameTeacher   || 'Class Teacher', role: 'Class Teacher' });
  if (!sigs.length)      sigs.push({ name: opts.namePrincipal || 'Principal',    role: 'Principal' });

  /* ── Decorative SVGs ── */
  const cornerSvg  = (slot) => `<svg class="corner ${slot}" viewBox="0 0 70 70" fill="none"><path d="M4 4 L4 32 Q4 4 32 4 Z" fill="none" stroke="#2D7DD2" stroke-width="2"/><path d="M4 4 L28 4 Q4 4 4 28 Z" fill="rgba(26,188,205,0.15)"/><circle cx="8" cy="8" r="3" fill="#1ABCCD"/><path d="M14 4 L4 4 L4 14" stroke="#F5C842" stroke-width="1.5" fill="none"/></svg>`;
  /* Certificate header par SCHOOL ka apna logo — wohi jo baqi har report
     (ID card, profile, class/inactive/family) lagati hai. Pehle yahan ye
     default mark hardcoded tha, is liye certificates ka logo baqi reports se
     alag dikhta tha. Branch ka logo na ho to hi ye default mark. */
  const defaultMark = `<svg width="52" height="52" viewBox="0 0 64 64" fill="none"><polygon points="32,10 60,24 32,32 4,24" fill="#1ABCCD"/><ellipse cx="32" cy="24" rx="9" ry="4.5" fill="rgba(255,255,255,0.2)"/><rect x="56" y="24" width="3" height="11" rx="1.5" fill="rgba(255,255,255,0.8)"/><circle cx="57.5" cy="37" r="3" fill="#F5C842"/><rect x="14" y="36" width="36" height="18" rx="5" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.4)" stroke-width="2"/></svg>`;
  const headLogo   = school?.logo
    ? `<img src="${school.logo}" alt="${stuEsc(school?.name || 'School')} logo" style="width:62px;height:62px;object-fit:contain;display:block"/>`
    : defaultMark;
  const sealSvg    = `<svg width="28" height="28" viewBox="0 0 64 64" fill="none"><polygon points="32,10 60,24 32,32 4,24" fill="#2D7DD2"/><rect x="56" y="24" width="3" height="9" rx="1.5" fill="#4FA3E8"/><circle cx="57.5" cy="35" r="2.5" fill="#1ABCCD"/><rect x="16" y="34" width="32" height="16" rx="4" fill="none" stroke="#2D7DD2" stroke-width="2"/></svg>`;
  const sealBlock  = `<div class="seal">${sealSvg}<div class="seal-text">${stuEsc(school?.name || 'School')} Official Seal</div></div>`;
  const sigBlock   = (g) => `<div class="sign-block"><div class="sign-line"></div><div class="sign-label">${stuEsc(g.name)}</div><div class="sign-sub">${stuEsc(g.role)}</div><div class="sign-sub">${stuEsc(school?.name || 'School')}</div></div>`;
  let sigBlocks;
  if (sigs.length === 1) {
    sigBlocks = sigBlock(sigs[0]) + sealBlock;
  } else {
    const mid = Math.ceil(sigs.length / 2);
    sigBlocks = sigs.slice(0, mid).map(sigBlock).join('') + sealBlock + sigs.slice(mid).map(sigBlock).join('');
  }

  const css = `
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{background:#eef2f9}body{font-family:'Poppins',system-ui,sans-serif;color:#0F172A;padding:24px}
    .page{background:#fff;max-width:840px;margin:0 auto;box-shadow:0 10px 40px rgba(0,0,0,.12)}
    .cert{width:794px;min-height:1080px;background:#fff;position:relative;overflow:hidden;display:flex;flex-direction:column;margin:0 auto;font-family:'Poppins',sans-serif}
    .cert-frame{position:absolute;inset:18px;border:2.5px solid #2D7DD2;border-radius:4px;pointer-events:none;z-index:5}
    .cert-frame::before{content:'';position:absolute;inset:5px;border:1px solid rgba(26,188,205,.4);border-radius:2px}
    .corner{position:absolute;width:70px;height:70px;z-index:6;pointer-events:none}
    .corner-tl{top:14px;left:14px}
    .corner-tr{top:14px;right:14px;transform:scaleX(-1)}
    .corner-bl{bottom:14px;left:14px;transform:scaleY(-1)}
    .corner-br{bottom:14px;right:14px;transform:scale(-1)}
    .cert-header{background:linear-gradient(120deg,#1A3BAA 0%,#2D7DD2 55%,#1ABCCD 100%);padding:28px 56px 32px;position:relative;overflow:hidden;flex-shrink:0}
    .cert-header::before{content:'';position:absolute;top:-40px;right:-40px;width:180px;height:180px;border-radius:50%;background:rgba(255,255,255,.07)}
    .header-inner{display:flex;align-items:center;gap:24px;position:relative;z-index:2}
    .header-logo-box{width:80px;height:80px;background:rgba(255,255,255,.15);border:2px solid rgba(255,255,255,.3);border-radius:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .header-text{flex:1}
    .header-school{font-family:'Cinzel',Georgia,serif;font-size:22px;font-weight:700;color:#fff;line-height:1.2;letter-spacing:.5px}
    .header-sub{font-size:11px;color:rgba(255,255,255,.8);letter-spacing:1.5px;text-transform:uppercase;margin-top:4px}
    .header-meta{text-align:right;font-size:10px;color:rgba(255,255,255,.7);line-height:1.8;flex-shrink:0}
    .header-meta strong{color:rgba(255,255,255,.95)}
    .header-ribbon{position:absolute;bottom:0;left:0;right:0;height:4px;background:linear-gradient(90deg,transparent,#F5C842 20%,#C9920A 50%,#F5C842 80%,transparent)}
    .cert-title-wrap{padding:36px 60px 16px;text-align:center}
    .cert-badge{display:inline-flex;align-items:center;gap:14px;margin-bottom:16px}
    .badge-line{width:80px;height:1.5px;background:linear-gradient(90deg,transparent,#C9920A)}
    .badge-line.right{background:linear-gradient(90deg,#C9920A,transparent)}
    .badge-icon{width:44px;height:44px;background:linear-gradient(135deg,#2D7DD2,#1ABCCD);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(45,125,210,.3)}
    .cert-title{font-family:'Cinzel',Georgia,serif;font-size:30px;font-weight:700;color:#0D2B5E;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px}
    .cert-subtitle{font-size:11px;color:#6B8BAA;letter-spacing:2px;text-transform:uppercase}
    .ornament-divider{display:flex;align-items:center;padding:0 60px;margin-bottom:24px}
    .div-line{flex:1;height:1px;background:linear-gradient(90deg,transparent,#2D7DD2 40%,#1ABCCD 60%,transparent)}
    .div-diamond{width:8px;height:8px;background:#C9920A;transform:rotate(45deg);margin:0 10px;flex-shrink:0}
    .div-circle{width:5px;height:5px;background:#1ABCCD;border-radius:50%;margin:0 6px;flex-shrink:0}
    .cert-body{padding:0 70px;flex:1;display:flex;flex-direction:column;gap:22px}
    .cert-text{font-family:'EB Garamond',Georgia,serif;font-size:17px;line-height:1.95;color:#1a2a4a;text-align:justify}
    .cert-text .hl{font-style:italic;font-weight:600;color:#1A3BAA}
    .info-tbl{border:1px solid #C8E6F7;border-radius:8px;overflow:hidden;margin-bottom:4px}
    .info-r{display:flex;border-bottom:1px solid #E8F4FD}
    .info-r:last-child{border-bottom:none}
    .info-k{width:200px;background:#F4FAFE;padding:9px 16px;font-size:11px;font-weight:700;color:#2D7DD2;text-transform:uppercase;letter-spacing:.4px}
    .info-v{flex:1;padding:9px 16px;font-size:13px;font-weight:600;color:#0D2B5E}
    .status-ok{background:#E6F7F0;color:#1A7A4A;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.4px}
    .cert-sign-wrap{padding:30px 70px 44px;display:flex;align-items:flex-end;justify-content:space-between;gap:18px}
    .sign-block{display:flex;flex-direction:column;align-items:center;gap:6px;flex:1}
    .sign-line{width:160px;border-bottom:1.5px solid #0D2B5E}
    .sign-label{font-size:11px;font-weight:600;color:#0D2B5E;letter-spacing:.5px;text-align:center}
    .sign-sub{font-size:10px;color:#6B8BAA;text-align:center}
    .seal{width:90px;height:90px;border-radius:50%;border:3px solid #2D7DD2;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;gap:2px;flex-shrink:0}
    .seal::before{content:'';position:absolute;inset:5px;border-radius:50%;border:1px dashed rgba(45,125,210,.4)}
    .seal-text{font-family:'Cinzel',Georgia,serif;font-size:7px;font-weight:600;color:#2D7DD2;text-align:center;letter-spacing:.5px;line-height:1.5;padding:0 10px}
    .cert-footer{background:linear-gradient(120deg,#1A3BAA,#2D7DD2 55%,#1ABCCD);padding:14px 56px;display:flex;align-items:center;justify-content:space-between;margin-top:auto;gap:14px}
    .footer-item{display:flex;align-items:center;gap:8px}
    .footer-icon{width:22px;height:22px;background:rgba(255,255,255,.15);border-radius:5px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .footer-text{font-size:9.5px;color:rgba(255,255,255,.85);line-height:1.5}
    .footer-text strong{color:#fff}
    /* Black &amp; White */
    .cert.bw .cert-header{background:#222 !important}
    .cert.bw .cert-header::before{background:transparent !important}
    .cert.bw .header-ribbon{background:#999 !important}
    .cert.bw .badge-icon{background:#222 !important;box-shadow:none !important}
    .cert.bw .badge-line{background:linear-gradient(90deg,transparent,#555) !important}
    .cert.bw .badge-line.right{background:linear-gradient(90deg,#555,transparent) !important}
    .cert.bw .cert-title{color:#111 !important}
    .cert.bw .cert-text .hl{color:#111 !important}
    .cert.bw .cert-frame{border-color:#222 !important}
    .cert.bw .cert-frame::before{border-color:#666 !important}
    .cert.bw .div-diamond{background:#555 !important}
    .cert.bw .div-circle{background:#555 !important}
    .cert.bw .div-line{background:linear-gradient(90deg,transparent,#555 40%,#777 60%,transparent) !important}
    .cert.bw .seal{border-color:#222 !important}.cert.bw .seal-text{color:#222 !important}
    .cert.bw .cert-footer{background:#222 !important}
    .cert.bw .info-k{color:#333 !important}.cert.bw .info-v{color:#111 !important}.cert.bw .info-tbl{border-color:#ccc !important}
    .cert.bw .status-ok{background:#eee !important;color:#333 !important}
    @page{size:A4;margin:0}
    @media print{body{background:#fff;padding:0}.page{box-shadow:none;margin:0;max-width:none}.cert{width:100%;min-height:100vh}}
  `;

  const inner = `<div class="page"><div class="cert ${isBW ? 'bw' : ''}">
    <div class="cert-frame"></div>
    ${cornerSvg('corner-tl')}${cornerSvg('corner-tr')}${cornerSvg('corner-bl')}${cornerSvg('corner-br')}
    <div class="cert-header"><div class="header-inner">
      <div class="header-logo-box">${headLogo}</div>
      <div class="header-text"><div class="header-school">${stuEsc(school?.name || 'School')}</div><div class="header-sub">${stuEsc(school?.campus || 'Main Campus')}</div></div>
      <div class="header-meta"><div>Certificate Generated On</div><strong>${stuEsc(today)}</strong></div>
    </div><div class="header-ribbon"></div></div>
    <div class="cert-title-wrap">
      <div class="cert-badge"><div class="badge-line"></div><div class="badge-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round">${badgeIcon}</svg></div><div class="badge-line right"></div></div>
      <div class="cert-title">${titleMain}</div>
      <div class="cert-subtitle">${titleSub}</div>
    </div>
    <div class="ornament-divider"><div class="div-line"></div><div class="div-circle"></div><div class="div-diamond"></div><div class="div-circle"></div><div class="div-line"></div></div>
    <div class="cert-body">${infoTable}<p class="cert-text">${bodyHtml}</p></div>
    <div class="cert-sign-wrap">${sigBlocks}</div>
    <div class="cert-footer">
      <div class="footer-item"><div class="footer-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></div><div class="footer-text"><strong>Address: </strong>${stuEsc(school?.address || '')}</div></div>
      <div class="footer-item"><div class="footer-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.57 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.73a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg></div><div class="footer-text"><strong>Contact: </strong>${stuEsc(school?.phone || '')}</div></div>
      <div class="footer-item"><div class="footer-icon">${sealSvg.replace(/width="28" height="28"/, 'width="12" height="12"')}</div><div class="footer-text"><strong>Powered by </strong>School Mentor&reg;</div></div>
    </div>
  </div></div>`;
  return { css, html: inner };
}

const STU_TABS = [
  { id: 'preenroll', icon: 'fa-user-clock',  label: 'Pre-Enrollment' },
  { id: 'active',   icon: 'fa-user-check',  label: 'Active Students' },
  { id: 'inactive', icon: 'fa-user-slash',  label: 'Inactive Students' },
  { id: 'family',   icon: 'fa-people-roof', label: 'Family Tree' },
];

export default function Students({ toast }) {
  /* Shared data — fetched once at the module level so the Active,
     Inactive and Family Tree tabs see the same students. */
  const { data: serverClasses = [] }   = useAsync(studentService.getStuClasses, []);
  const { data: serverFamilies = [] }  = useAsync(studentService.getStuFamilies, []);
  const { data: school = {} }          = useAsync(studentService.getStuSchool, {});

  const [classes, setClasses]     = useState(null);
  // Inactive students module-load par NAHI — Inactive tab kholne par (InactiveStudents
  // mount par) fetch hote hain, taake tab click par hi API hit ho.
  const [inactive, setInactive]   = useState(null);
  const [families, setFamilies]   = useState(null);
  useEffect(() => { if (serverClasses.length  && classes  == null) setClasses(serverClasses);   }, [serverClasses, classes]);
  useEffect(() => { if (serverFamilies.length && families == null) setFamilies(serverFamilies); }, [serverFamilies, families]);
  const classList = classes  || [];
  const inactList = inactive || [];
  const famList   = families || [];

  const [tab, setTab] = useState('active');
  const [tutorialOpen, setTutorialOpen] = useState(false);

  /* Screen (tab) View permission — jis screen ka View nahi wo tab hide. */
  const { can } = usePermissions();
  const visibleTabs = STU_TABS.filter(t => can('Students', t.label, 'View'));
  useEffect(() => {
    if (visibleTabs.some(t => t.id === tab)) return;
    if (visibleTabs[0]) setTab(visibleTabs[0].id);
  }, [visibleTabs, tab]);

  const activeMeta = STU_TABS.find(t => t.id === tab);

  return (
    <>
      <style>{STU_CSS}</style>

      {/* Page header — module title, brand-gradient icon, Tutorial CTA */}
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}>
            <i className="fa-solid fa-user-graduate"></i>
          </div>
          <div>
            <div className="page-title">Students</div>
            <div className="page-sub">Manage active students, admissions, promotions &amp; student-specific fee adjustments</div>
          </div>
        </div>
        <Tooltip text="Play a short tutorial for the Students module">
          <button
            className="tutorial-btn page-tutorial-btn"
            onClick={() => setTutorialOpen(true)}
          >
            <div className="play-dot"><i className="fa-solid fa-play" style={{ fontSize: 8 }}></i></div>
            <span className="tutorial-label">Tutorial</span>
          </button>
        </Tooltip>
      </div>

      <div className="fee-subtabs">
        {visibleTabs.map(t => (
          <Tooltip key={t.id} text={t.label}>
            <button
              className={`fee-subtab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <i className={`fa-solid ${t.icon}`}></i> {t.label}
            </button>
          </Tooltip>
        ))}
      </div>

      {tab === 'preenroll' ? (
        <PreEnrolledStudents
          classes={classList}
          setClasses={setClasses}
          inactive={inactList}
          setInactive={setInactive}
          school={school}
          toast={toast}
        />
      ) : tab === 'active' ? (
        <ActiveStudents
          classes={classList}
          setClasses={setClasses}
          inactive={inactList}
          setInactive={setInactive}
          families={famList}
          setFamilies={setFamilies}
          school={school}
          toast={toast}
        />
      ) : tab === 'inactive' ? (
        <InactiveStudents
          classes={classList}
          setClasses={setClasses}
          inactive={inactList}
          setInactive={setInactive}
          toast={toast}
        />
      ) : tab === 'family' ? (
        <FamilyTree
          classes={classList}
          setClasses={setClasses}
          families={famList}
          setFamilies={setFamilies}
          school={school}
          toast={toast}
        />
      ) : (
        <StuComingSoon
          label={activeMeta?.label || 'This screen'}
          icon={activeMeta?.icon || 'fa-hammer'}
        />
      )}

      <TutorialModal
        open={tutorialOpen}
        moduleKey="students"
        onClose={() => setTutorialOpen(false)}
        toast={toast}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ACTIVE STUDENTS — KPI strip + helper banner + global typeahead +
   toolbar + expandable class table with per-class actions and
   nested student rows that carry a 3-dot action menu.
   ═══════════════════════════════════════════════════════════════════ */
function ActiveStudents({ classes, setClasses, inactive, setInactive, families, setFamilies, school, toast }) {
  const { can } = usePermissions();
  const canStuCreate   = can('Students', 'Active Students', 'Create');
  const canStuEdit     = can('Students', 'Active Students', 'Edit');
  const canStuDelete   = can('Students', 'Active Students', 'Delete');
  const canStuDownload = can('Students', 'Active Students', 'Download');
  const canStuPrint    = can('Students', 'Active Students', 'Print');
  const canFamCreate   = can('Students', 'Family Tree', 'Create');
  const { data: classListLookup = [] }  = useAsync(studentService.getStuClassList, []);
  const { data: sectionList = [] }      = useAsync(studentService.getStuSectionList, []);
  const { data: reasonsLookup = [] }    = useAsync(studentService.getStuInactiveReasons, []);
  const { data: serverNextReg = 25101 } = useAsync(studentService.getStuNextReg, 25101);
  const { data: serverNextAdm = 1100 }  = useAsync(studentService.getStuNextAdm, 1100);
  const famArr = families;

  /* Kaun sa student WAQAI kisi family tree me hai — iska wahid sabot trees ke
     apne members hain (families[].members[]), student ka `familyNo` NAHI.
     familyNo ek azaad text field hai (e.g. "FAM-3001"); wo likha hona kisi
     tree me hone ki daleel nahi — usi wajah se aise students ko galti se
     "Already in a Family Tree" dikha kar unka link button band kar diya jata
     tha. Match student id par (reg blank/badal sakta hai); jis member ka id
     na ho sirf usi ke liye reg par fallback. */
  const linkedIds = useMemo(
    () => new Set(famArr.flatMap(f => (f.members || [])
      .map(m => String(m._id || ''))
      .filter(Boolean))),
    [famArr]
  );
  const linkedRegs = useMemo(
    () => new Set(famArr.flatMap(f => (f.members || [])
      .filter(m => !m._id)
      .map(m => String(m.reg || ''))
      .filter(Boolean))),
    [famArr]
  );
  const isInFamilyTree = useCallback(
    (s) => linkedIds.has(String(s?._id || '')) || linkedRegs.has(String(s?.reg || '')),
    [linkedIds, linkedRegs]
  );

  const list = classes;
  void inactive; // accepted for parity; only setInactive is used here

  const [nextReg, setNextReg] = useState(null);
  const [nextAdm, setNextAdm] = useState(null);
  useEffect(() => { if (nextReg == null && serverNextReg) setNextReg(serverNextReg); }, [serverNextReg, nextReg]);
  useEffect(() => { if (nextAdm == null && serverNextAdm) setNextAdm(serverNextAdm); }, [serverNextAdm, nextAdm]);

  const [search, setSearch]     = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchWrapRef = useRef(null);
  const [openKey, setOpenKey]   = useState(null);   // currently expanded class key
  const [flashReg, setFlashReg] = useState(null);   // brief highlight after typeahead jump

  /* Add / Edit Student modal */
  const [editCfg, setEditCfg] = useState(null);     // {mode:'add'|'edit', cKey, reg?}
  /* Promotion modal */
  const [promoteCfg, setPromoteCfg] = useState(null); // {cKey}
  /* Mark Inactive modal */
  const [inactiveCfg, setInactiveCfg] = useState(null); // {cKey, reg}
  /* Pending Dues — triggered from the Inactive tab (Step 5).
     The dues modal + settle handler live there now. */

  /* Per-student action modals */
  const [idCardCfg, setIdCardCfg]     = useState(null);   // {cKey, reg}
  const [bulkIdCfg, setBulkIdCfg]     = useState(null);   // {cKey}
  const [certCfg, setCertCfg]         = useState(null);   // {cKey, reg, type}
  const [addFamCfg, setAddFamCfg]     = useState(null);   // {cKey, reg}
  const [rpCfg, setRpCfg]             = useState(null);   // {kind, cKey?, reg?, title, sub}

  /* outside-click closes the search dropdown */
  useEffect(() => {
    if (!searchOpen) return undefined;
    const onClick = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [searchOpen]);

  /* KPI computations */
  const stats = useMemo(() => {
    const total       = list.reduce((a, c) => a + c.students.length, 0);
    const classCount  = new Set(list.map(c => c.cls)).size;
    const sectionCnt  = list.length;
    const discount    = list.reduce((a, c) => a + c.students.filter(stuHasDiscount).length, 0);
    return { total, classCount, sectionCnt, discount };
  }, [list]);

  /* Search matches across all classes (capped to 30 dropdown rows) */
  const matches = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase().trim();
    const out = [];
    list.forEach(c => {
      c.students.forEach(s => {
        const hay = `${stuFullName(s)} ${s.reg} ${s.father} ${c.cls} ${c.sec}`.toLowerCase();
        if (hay.includes(q)) out.push({ s, c });
      });
    });
    return out;
  }, [list, search]);

  const filteredClasses = useMemo(() => {
    if (!search.trim()) return list;
    const q = search.toLowerCase().trim();
    return list.filter(c => {
      const hayCls = `${c.cls} ${c.sec}`.toLowerCase();
      if (hayCls.includes(q)) return true;
      return c.students.some(s => `${stuFullName(s)} ${s.reg} ${s.father}`.toLowerCase().includes(q));
    });
  }, [list, search]);

  const jumpTo = (cKey, reg) => {
    setOpenKey(cKey);
    setSearch('');
    setSearchOpen(false);
    setFlashReg(reg);
    setTimeout(() => {
      const el = document.querySelector(`[data-srow="${reg}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setFlashReg(null), 2200);
    }, 80);
  };

  /* Open/save handlers for the Student modal.
     NOTE: students are identified by their DB id (`_id`), never by registration
     number — regs can be blank or duplicated across classes, so a reg-based
     lookup could silently target the wrong student. */
  const openAddStudent     = (cKey) => setEditCfg({ mode: 'add',  cKey });
  const openEditStudent    = (cKey, id) => setEditCfg({ mode: 'edit', cKey, id });
  const openPromote        = (cKey) => setPromoteCfg({ cKey });
  const openMarkInactive   = (cKey, id) => setInactiveCfg({ cKey, id });

  /* Per-student action openers */
  const openIdCard         = (cKey, id) => setIdCardCfg({ cKey, id });
  const openBulkId         = (cKey)      => setBulkIdCfg({ cKey });
  const openCert           = (cKey, id, type) => setCertCfg({ cKey, id, type });
  const openAddToFamily    = (cKey, id) => setAddFamCfg({ cKey, id });
  const openProfilePicker  = (cKey, id) => {
    const s = list.find(c => c.key === cKey)?.students.find(x => x._id === id);
    if (!s) return;
    setRpCfg({
      kind: 'profile', cKey, id,
      title: 'Download Student Profile',
      sub: `${stuFullName(s)} · ${s.reg} — choose style & format`,
    });
  };
  const openClassPicker    = (cKey) => {
    const c = list.find(x => x.key === cKey);
    if (!c) return;
    setRpCfg({
      kind: 'class', cKey,
      title: 'Download Class Report',
      sub: `${c.cls} (${c.sec}) · ${c.students.length} student(s)`,
    });
  };
  const openSchoolPicker   = () => setRpCfg({
    kind: 'school',
    title: 'Download Whole-School Report',
    sub: `${list.reduce((a, c) => a + c.students.length, 0)} active student(s) across ${list.length} section(s)`,
  });
  const openAdmissionPicker = () => setRpCfg({
    kind: 'admission',
    title: 'Download Admission Form',
    sub: 'Blank, printable A4 admission application form',
  });

  /* Report Picker — generates the appropriate PDF */
  const doReport = async ({ style, format }) => {
    if (!rpCfg) return;
    const isBW = style === 'bw';
    /* Pull the branch record (name, logo, address) from the shared
       report-header API and use it in the report header, falling back
       to the local school identity. */
    const branch = await fetchReportHeader();
    const rptSchool = {
      ...school,
      name:    branch?.branchName || school?.name,
      address: branch?.address    || school?.address,
      /* report-header ka logo bhi usi normalizer se (backend kabhi localhost
         URL bhej deta hai — us surat me image kisi aur machine par na aati). */
      logo:    studentService.stuFileUrl(branch?.branchLogo) || school?.logo,
    };
    if (rpCfg.kind === 'admission') {
      const html = buildStuAdmissionFormHTML(rptSchool, isBW);
      stuDeliverReport('Admission Form', '', html, format, toast);
    } else if (rpCfg.kind === 'profile') {
      const c = list.find(x => x.key === rpCfg.cKey);
      const s = c?.students.find(x => x._id === rpCfg.id);
      if (!s) return;
      const html = buildStuProfileHTML(s, c, rptSchool, isBW);
      stuDeliverReport(`Profile — ${stuFullName(s)}`, '', html, format, toast);
    } else if (rpCfg.kind === 'class') {
      const c = list.find(x => x.key === rpCfg.cKey);
      const html = buildStuClassReportHTML(c, rptSchool, isBW);
      stuDeliverReport(`${c.cls} (${c.sec}) — Class Report`, '', html, format, toast);
    } else if (rpCfg.kind === 'school') {
      const html = buildStuSchoolReportHTML(list, rptSchool, isBW);
      stuDeliverReport('School Report', '', html, format, toast);
    }
    toast(`${rpCfg.title} (${style.toUpperCase()} · ${format.toUpperCase()}) ready`, 'success');
    setRpCfg(null);
  };

  /* ID card / certificate generators just print and toast */
  const doIdCard = (template, theme, session, role) => {
    const c = list.find(x => x.key === idCardCfg.cKey);
    const s = c?.students.find(x => x._id === idCardCfg.id);
    if (!s) return;
    const { css, html } = buildStuIdCardHTML(s, c, school, template, theme, session, role);
    stuOpenPrintWindow(`ID Card — ${stuFullName(s)}`, css, html, toast);
    toast('ID card generated', 'success');
    setIdCardCfg(null);
  };
  const doBulkId = (selectedIds, template, theme, session) => {
    const c = list.find(x => x.key === bulkIdCfg.cKey);
    if (!c) return;
    const studs = c.students.filter(s => selectedIds.includes(s._id));
    if (studs.length === 0) { toast('Pick at least one student first', 'error'); return; }
    const { css, html } = buildStuBulkIdHTML(studs, c, school, template, theme, session);
    stuOpenPrintWindow(`Class ID Cards — ${c.cls} (${c.sec})`, css, html, toast);
    toast(`${studs.length} ID card(s) generated`, 'success');
    setBulkIdCfg(null);
  };
  const doCert = (style, opts) => {
    const c = list.find(x => x.key === certCfg.cKey);
    const s = c?.students.find(x => x._id === certCfg.id);
    if (!s) return;
    const { css, html } = buildStuCertHTML(s, c, school, certCfg.type, style, opts);
    stuOpenPrintWindow(`Certificate — ${stuFullName(s)}`, css, html, toast);
    toast(`${STU_CERT_DEFAULTS[certCfg.type].title} generated`, 'success');
    setCertCfg(null);
  };
  const doAddToFamily = async ({ familyId }) => {
    if (!familyId) { toast('Pick a family first', 'error'); return; }
    const c = list.find(x => x.key === addFamCfg.cKey);
    const s = c?.students.find(x => x._id === addFamCfg.id);
    if (!s) return;
    try {
      /* insert a family-tree detail link: treeID = family, applicantsID = student. */
      await studentService.linkStuToFamily({
        treeID:       familyId,
        applicantsID: s._id,
        gradeID:      c._gradeId,
        sectionID:    c._sectionId,
      });
      /* refresh families so the student shows under the family's members. */
      setFamilies(await studentService.getStuFamilies());
      const fam = famArr.find(f => f.id === familyId);
      toast(`${stuFullName(s)} added to ${fam?.name || 'family'}`, 'success');
    } catch (err) {
      toast(err.message || 'Could not add to family', 'error');
    }
    setAddFamCfg(null);
  };

  /* Promotion: move selected students from source class → target class. If
     the target class+section doesn't exist yet, it is created on the fly. */
  const handlePromote = async ({ toClass, toSection, promotions }) => {
    if (!promotions || promotions.length === 0) { toast('Pick at least one student first', 'error'); return; }
    /* Zaroori IDs resolve hue? (to-class/section grades se, session active hona chahiye) */
    const bad = promotions.find(p => !p.newGradeID || !p.newSectionID);
    if (bad) { toast('Please select a valid To Class and To Section', 'error'); return; }
    if (!promotions[0].sessionYearID) { toast('No active academic session found — set one in Settings.', 'error'); return; }
    try {
      /* Har student ke liye promote-student API call (backend carry-forward logic handle karta hai). */
      for (const p of promotions) {
        await studentService.promoteStuStudent(p);
      }
      /* Server se fresh list — promoted students nayi class/section me reflect ho jayenge. */
      setClasses(await studentService.getStuClasses());
      toast(`${promotions.length} student(s) promoted to ${toClass} (${toSection})`, 'success');
      setPromoteCfg(null);
    } catch (err) {
      toast(err.message || 'Could not promote students', 'error');
    }
  };

  /* Mark Inactive: DELETE the student on the server (soft delete → isActive=false),
     then refresh the Active + Inactive lists from the API. */
  const handleMarkInactive = async ({ reason, effectiveDate }) => {
    void effectiveDate; // captured for UX; the delete-student API takes only the id
    const src = list.find(c => c.key === inactiveCfg.cKey);
    if (!src) return;
    const s = src.students.find(x => x._id === inactiveCfg.id);
    if (!s) return;
    if (!reason.trim()) { toast('Please enter a reason', 'error'); return; }
    try {
      /* DELETE /api/LaunchSetup/delete-student/{id}?reason=... → soft-deletes (isActive=false). */
      await studentService.markStuInactive(s._id, reason.trim());
      /* Refresh both lists from the server so Active drops the student and the
         Inactive tab (get-...?isActive=false) shows it. */
      const [freshClasses, freshInactive] = await Promise.all([
        studentService.getStuClasses(),
        studentService.getStuInactive(),
      ]);
      setClasses(freshClasses);
      setInactive(Array.isArray(freshInactive) ? freshInactive : []);
      toast(`${s.name || stuFullName(s)} moved to Inactive Students`, 'info');
    } catch (err) {
      toast(err.message || 'Could not mark student inactive', 'error');
    }
    setInactiveCfg(null);
  };


  /* Re-pull classes + students from the server after a mutation. */
  const reloadClasses = async () => {
    try { setClasses(await studentService.getStuClasses()); }
    catch { toast('Could not refresh students', 'error'); }
  };

  /* Refresh the class + student list from the API every time this tab
     is opened (the component re-mounts on each visit). */
  useEffect(() => {
    reloadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveStudent = async (payload) => {
    const { cKey, mode, id } = editCfg;
    /* Resolve the target grade/section ids from the chosen class+section
       (falls back to the row the modal was opened from). */
    const row = list.find(c => c.cls === payload.cls && c.sec === payload.sec)
             || list.find(c => c.key === cKey);
    /* Match on the DB id — reg is not a reliable key (can be blank/duplicated),
       and matching on it could update a different student. */
    const existing = mode === 'edit'
      ? list.find(c => c.key === cKey)?.students.find(s => s._id === id)
      : null;
    if (mode === 'edit' && !existing?._id) {
      toast('Could not resolve this student record — please reload and retry', 'error');
      return;
    }
    try {
      const resp = await studentService.saveStuStudent({
        id:        existing?._id || 0,
        gradeId:   row?._gradeId || 0,
        sectionId: row?._sectionId || 0,
        reg:       payload.reg,
        adm:       payload.adm,
        family:    payload.family,
        admdate:   payload.admdate,
        first:     payload.first,
        last:      payload.last,
        father:    payload.father,
        fcnic:     payload.fcnic,
        focc:      payload.focc,
        mother:    payload.mother,
        mcnic:     payload.mcnic,
        guardian:  payload.guardian,
        gender:    payload.gender,
        dob:       payload.dob,
        nat:       payload.nat,
        address:   payload.address,
        mobile:    payload.mobile,
        email:     payload.email,
        bform:     payload.bform,
        pschool:   payload.pschool,
        pgrade:    payload.pgrade,
        pcontact:  payload.pcontact,
        gcontact:  payload.gcontact,
        photo:       payload.photo || '',
        pictureFile: payload.pictureFile || null,
        dues:      0,
      });

      /* Documents ride on separate endpoints and need the student's id. For an
         edit we have it; for a fresh add we read it from the save response, and
         fall back to reloading + matching on the (unique) registration no. */
      const docUploads    = payload.docUploads    || [];
      const removedDocIds = payload.removedDocIds || [];
      /* Family No dropdown se chuni gayi family tree — link isi id par hota hai. */
      const famId = famArr.some(f => String(f.id) === String(payload.family))
        ? Number(payload.family)
        : 0;
      /* Id ek hi baar resolve — documents aur family link dono isay use karte hain. */
      let studentId = 0;
      if (docUploads.length || removedDocIds.length || famId || mode === 'edit') {
        studentId = existing?._id || studentService.studentIdFromSaveResponse(resp) || 0;
        if (!studentId) {
          const fresh = await studentService.getStuClasses();
          for (const c of fresh) {
            const found = c.students.find(s => s.reg === String(payload.reg));
            if (found) { studentId = found._id; break; }
          }
        }
      }
      if (docUploads.length || removedDocIds.length) {
        if (studentId) {
          for (const id of removedDocIds) {
            try { await studentService.deleteStuStudentDocument(id); }
            catch (e) { toast(e.message || 'Could not remove a document', 'error'); }
          }
          for (const d of docUploads) {
            try {
              await studentService.uploadStuStudentDocument({
                studentId,
                gradeId:      row?._gradeId || 0,
                sectionId:    row?._sectionId || 0,
                documentType: d.documentType,
                file:         d.file,
              });
            } catch (e) { toast(e.message || `Could not upload "${d.documentType}"`, 'error'); }
          }
        } else {
          toast('Student saved, but documents could not be attached (no id)', 'error');
        }
      }

      /* Family No dropdown → family tree link (wahi familytreedetailcrud jo
         "Add Student to Family Tree" use karta hai). Student ek waqt me ek hi
         tree me hona chahiye, is liye: pehle kisi DOOSRI family ka purana link
         hatao, phir nayi family me link karo. Family already sahi ho to kuch
         nahi. Edit me family "No family" par set karne se link hat jata hai. */
      if (studentId) {
        /* Jis bhi tree me ye student abhi linked hai (detailID unlink ke liye). */
        let currentLink = null;
        for (const f of famArr) {
          const m = (f.members || []).find(x => String(x._id) === String(studentId));
          if (m) { currentLink = { famId: f.id, detailID: m.detailID }; break; }
        }
        const changed = String(currentLink?.famId || '') !== String(famId || '');
        if (changed) {
          try {
            if (currentLink?.detailID) {
              await studentService.unlinkStuFromFamily({ id: currentLink.detailID });
            }
            if (famId) {
              await studentService.linkStuToFamily({
                treeID:       famId,
                applicantsID: studentId,
                gradeID:      row?._gradeId || 0,
                sectionID:    row?._sectionId || 0,
              });
            }
            setFamilies(await studentService.getStuFamilies());
          } catch (e) {
            toast(e.message || 'Student saved, but family tree link failed', 'error');
          }
        }
      } else if (famId) {
        toast('Student saved, but family tree link failed (no id)', 'error');
      }

      await reloadClasses();
      toast(mode === 'edit' ? 'Student updated successfully' : 'Student registered successfully', 'success');
      setEditCfg(null);
    } catch (err) {
      toast(err.message || 'Could not save student', 'error');
    }
  };

  return (
    <>
      {/* KPI strip */}
      <div className="stu-kpis">
        <div className="stu-stat">
          <div className="stu-stat-icon blue"><i className="fa-solid fa-user-graduate"></i></div>
          <div>
            <div className="stu-stat-val">{stats.total}</div>
            <div className="stu-stat-lbl">Active Students</div>
          </div>
        </div>
        <div className="stu-stat">
          <div className="stu-stat-icon green"><i className="fa-solid fa-layer-group"></i></div>
          <div>
            <div className="stu-stat-val">{stats.classCount}</div>
            <div className="stu-stat-lbl">Classes</div>
          </div>
        </div>
        <div className="stu-stat">
          <div className="stu-stat-icon violet"><i className="fa-solid fa-grip"></i></div>
          <div>
            <div className="stu-stat-val">{stats.sectionCnt}</div>
            <div className="stu-stat-lbl">Sections</div>
          </div>
        </div>
        <div className="stu-stat">
          <div className="stu-stat-icon amber"><i className="fa-solid fa-percent"></i></div>
          <div>
            <div className="stu-stat-val">{stats.discount}</div>
            <div className="stu-stat-lbl">On Fee Discount</div>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="stu-info">
        <i className="fa-solid fa-circle-info"></i>
        <span>
          Expand any class to view its students. Use <strong>Add Student</strong> to register a new student,
          {' '}<strong>Promotion</strong> to move a section to the next class, and the three-dots menu for per-student actions.
          A <strong style={{ color: '#DC2626' }}>red corner</strong> on a student marks a fee discount / adjustment.
        </span>
      </div>

      {/* Toolbar */}
      <div className="stu-toolbar">
        <div className="stu-search-wrap" ref={searchWrapRef}>
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            className="stu-search-input"
            placeholder="Search student, reg no, father or class…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            autoComplete="off"
          />
          {search && (
            <button className="stu-search-clear" onClick={() => { setSearch(''); setSearchOpen(false); }}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
          {searchOpen && search.trim() && (
            <div className="stu-sr">
              {matches.length === 0 ? (
                <div className="stu-sr-empty">No students found for "<b>{search}</b>"</div>
              ) : (
                <>
                  {matches.slice(0, 30).map(({ s, c }, mi) => (
                    <button key={s._id ?? `idx-${mi}`} type="button" className="stu-sr-item" onClick={() => jumpTo(c.key, s.reg)}>
                      <div className="stu-sr-av">{stuInitials(s)}</div>
                      <div className="stu-sr-main">
                        <div className="stu-sr-name">{stuFullName(s)}</div>
                        <div className="stu-sr-meta">
                          <span>{c.cls} · {c.sec}</span>
                          <span>Father: {s.father}</span>
                          <span style={{ fontFamily: 'ui-monospace,Menlo,monospace' }}>{s.reg}</span>
                        </div>
                      </div>
                      <div className="stu-sr-go"><i className="fa-solid fa-arrow-right"></i></div>
                    </button>
                  ))}
                  {matches.length > 30 && (
                    <div className="stu-sr-foot">Showing first 30 of <b>{matches.length}</b> matches</div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="stu-toolbar-actions">
          {canStuDownload && (
          <Tooltip text="Download whole-school student report">
            <button className="stu-iconbtn" onClick={openSchoolPicker} aria-label="Download whole-school student report">
              <i className="fa-solid fa-file-arrow-down"></i>
            </button>
          </Tooltip>
          )}
          {canStuPrint && (
          <Tooltip text="Print a blank Admission Form template">
            <button className="stu-rowbtn admission-cta" onClick={openAdmissionPicker}>
              <i className="fa-solid fa-file-lines"></i> Get Admission Form
            </button>
          </Tooltip>
          )}
        </div>
      </div>

      {/* Class table */}
      <div className="fee-section stu-section">
        <div className="stu-table-head">
          <div className="th c">#</div>
          <div className="th">Class</div>
          <div className="th">Section</div>
          <div className="th c">Total Students</div>
          <div className="th c">Report</div>
          <div className="th">Actions</div>
          <div className="th c">Details</div>
        </div>
        {filteredClasses.length === 0 ? (
          <div className="stu-empty">
            <div className="stu-empty-ic"><i className="fa-solid fa-magnifying-glass"></i></div>
            <div className="stu-empty-title">No classes match your search</div>
            <div className="stu-empty-sub">Try adjusting the query or clearing the search box.</div>
          </div>
        ) : filteredClasses.map((c, idx) => (
          <StuClassRow
            key={c.key}
            c={c}
            idx={idx + 1}
            isOpen={openKey === c.key}
            onToggle={() => setOpenKey(openKey === c.key ? null : c.key)}
            onReport={() => openClassPicker(c.key)}
            onPromote={() => openPromote(c.key)}
            onAdd={() => openAddStudent(c.key)}
            onBulkId={() => openBulkId(c.key)}
            flashReg={flashReg}
            onStudentEdit={(id) => openEditStudent(c.key, id)}
            onStudentMarkInactive={(id) => openMarkInactive(c.key, id)}
            onStudentProfile={(id) => openProfilePicker(c.key, id)}
            onStudentIdCard={(id) => openIdCard(c.key, id)}
            onStudentCert={(id, type) => openCert(c.key, id, type)}
            onStudentAddFamily={(id) => openAddToFamily(c.key, id)}
            isInFamilyTree={isInFamilyTree}
            canStuCreate={canStuCreate} canStuEdit={canStuEdit} canStuDelete={canStuDelete}
            canStuDownload={canStuDownload} canStuPrint={canStuPrint} canFamCreate={canFamCreate}
          />
        ))}
      </div>

      {editCfg && (
        <StuStudentModal
          key={`${editCfg.mode}-${editCfg.cKey}-${editCfg.id || 'new'}`}
          cfg={editCfg}
          activeClass={list.find(c => c.key === editCfg.cKey)}
          student={editCfg.mode === 'edit'
            ? list.find(c => c.key === editCfg.cKey)?.students.find(s => s._id === editCfg.id)
            : null}
          classList={classListLookup}
          sectionList={sectionList}
          classes={list}
          families={famArr}
          /* {id, reg} pairs so the modal can reject a reg already taken by a
             DIFFERENT student (and ignore blanks / its own record on edit). */
          existingRegs={list.flatMap(c => c.students.map(s => ({ id: s._id, reg: String(s.reg || '').trim().toLowerCase() })))}
          suggestedReg={`${new Date().getFullYear()}-${String(nextReg || 25101).padStart(5, '0')}`}
          suggestedAdm={String(nextAdm || 1100)}
          onClose={() => setEditCfg(null)}
          onSave={handleSaveStudent}
          toast={toast}
        />
      )}

      {promoteCfg && (
        <StuPromoteModal
          cls={list.find(c => c.key === promoteCfg.cKey)}
          classList={classListLookup}
          sectionList={sectionList}
          onClose={() => setPromoteCfg(null)}
          onSubmit={handlePromote}
          toast={toast}
        />
      )}

      {inactiveCfg && (
        <StuInactiveModal
          cls={list.find(c => c.key === inactiveCfg.cKey)}
          student={list.find(c => c.key === inactiveCfg.cKey)?.students.find(s => s._id === inactiveCfg.id)}
          reasons={reasonsLookup}
          onClose={() => setInactiveCfg(null)}
          onSubmit={handleMarkInactive}
        />
      )}

      {rpCfg && (
        <StuReportPicker
          cfg={rpCfg}
          onClose={() => setRpCfg(null)}
          onConfirm={doReport}
        />
      )}

      {idCardCfg && (
        <StuIdCardModal
          student={list.find(c => c.key === idCardCfg.cKey)?.students.find(s => s._id === idCardCfg.id)}
          cls={list.find(c => c.key === idCardCfg.cKey)}
          school={school}
          onClose={() => setIdCardCfg(null)}
          onDownload={doIdCard}
        />
      )}

      {bulkIdCfg && (
        <StuBulkIdModal
          cls={list.find(c => c.key === bulkIdCfg.cKey)}
          school={school}
          onClose={() => setBulkIdCfg(null)}
          onDownload={doBulkId}
        />
      )}

      {certCfg && (
        <StuCertModal
          cfg={certCfg}
          student={list.find(c => c.key === certCfg.cKey)?.students.find(s => s._id === certCfg.id)}
          cls={list.find(c => c.key === certCfg.cKey)}
          school={school}
          onClose={() => setCertCfg(null)}
          onDownload={doCert}
        />
      )}

      {addFamCfg && (
        <StuAddToFamilyModal
          student={list.find(c => c.key === addFamCfg.cKey)?.students.find(s => s._id === addFamCfg.id)}
          cls={list.find(c => c.key === addFamCfg.cKey)}
          families={famArr}
          setFamilies={setFamilies}
          onClose={() => setAddFamCfg(null)}
          onConfirm={doAddToFamily}
        />
      )}
    </>
  );
}

/* ─── Class header row + collapsible student list ─── */
function StuClassRow({ c, idx, isOpen, onToggle, onReport, onPromote, onAdd, onBulkId, flashReg, onStudentEdit, onStudentMarkInactive, onStudentProfile, onStudentIdCard, onStudentCert, onStudentAddFamily, isInFamilyTree,
  canStuCreate = true, canStuEdit = true, canStuDelete = true, canStuDownload = true, canStuPrint = true, canFamCreate = true }) {
  return (
    <div className={`stu-clswrap${isOpen ? ' open' : ''}`}>
      <div className="stu-cls-row" onClick={onToggle}>
        <div className="td c"><div className="stu-cls-sn">{idx}</div></div>
        <div className="td">
          <div className="stu-cls-name-wrap">
            <div className="stu-cls-ic"><i className={`fa-solid ${STU_CLASS_ICON(c.cls)}`}></i></div>
            <div>
              <div className="stu-cls-name">{c.cls}</div>
              <div className="stu-cls-sub">{c.students.length} student{c.students.length === 1 ? '' : 's'} enrolled</div>
            </div>
          </div>
        </div>
        <div className="td"><span className="stu-sec-pill"><i className="fa-solid fa-grip"></i> {c.sec}</span></div>
        <div className="td c"><div className="stu-strength"><span className="num">{c.students.length}</span></div></div>
        <div className="td c" onClick={(e) => e.stopPropagation()}>
          {canStuDownload && (
          <Tooltip text="Download report for this class">
            <button className="stu-rep-btn" onClick={onReport} aria-label="Download report for this class">
              <i className="fa-solid fa-file-arrow-down"></i>
            </button>
          </Tooltip>
          )}
        </div>
        <div className="td stu-cls-actions" onClick={(e) => e.stopPropagation()}>
          {canStuEdit && (
          <Tooltip text="Promote this section to the next class">
            <button className="stu-rowbtn promote" onClick={onPromote}>
              <i className="fa-solid fa-arrow-up-right-dots"></i> Promotion
            </button>
          </Tooltip>
          )}
          {canStuCreate && (
          <Tooltip text="Register a new student in this section">
            <button className="stu-rowbtn add" onClick={onAdd}>
              <i className="fa-solid fa-user-plus"></i> Add Student
            </button>
          </Tooltip>
          )}
        </div>
        <div className="td c">
          <Tooltip text={isOpen ? 'Collapse details' : 'Expand details'}>
            <button className="stu-chev" onClick={(e) => { e.stopPropagation(); onToggle(); }} aria-label={isOpen ? 'Collapse' : 'Expand'}>
              <i className={`fa-solid fa-chevron-down${isOpen ? ' rot' : ''}`}></i>
            </button>
          </Tooltip>
        </div>
      </div>

      <div className={`stu-detail${isOpen ? ' open' : ''}`}>
        <div className="stu-detail-inner">
          <div className="stu-detail-head">
            <div className="stu-detail-title">
              <i className="fa-solid fa-users"></i> Students in {c.cls} — Section {c.sec}
            </div>
            {c.students.length > 0 && (
              <Tooltip text="Generate ID Cards for this class">
                <button className="stu-rowbtn" onClick={onBulkId}>
                  <i className="fa-solid fa-id-badge"></i> Generate ID Cards
                </button>
              </Tooltip>
            )}
          </div>
          {c.students.length === 0 ? (
            <div className="stu-list-empty">
              <i className="fa-solid fa-user-plus"></i>
              No students yet. Use <strong>Add Student</strong> to register one in this section.
            </div>
          ) : (
            <>
              <div className="stu-list-head">
                <div className="th c">#</div>
                <div className="th c">Photo</div>
                <div className="th">Reg No</div>
                <div className="th">Name</div>
                <div className="th">Father Name</div>
                <div className="th">Date of Birth</div>
                <div className="th">Contact No</div>
                <div className="th c">Action</div>
              </div>
              {c.students.map((s, i) => (
                <StuStudentRow
                  /* Key on the DB id — reg can be blank (or repeated) for freshly
                     added students, and duplicate keys leave ghost rows behind
                     when a reg no is later filled in. */
                  key={s._id ?? `idx-${i}`}
                  s={s}
                  i={i + 1}
                  flash={flashReg === s.reg}
                  onEdit={() => onStudentEdit(s._id)}
                  onMarkInactive={() => onStudentMarkInactive(s._id)}
                  onProfile={() => onStudentProfile(s._id)}
                  onIdCard={() => onStudentIdCard(s._id)}
                  onCert={(type) => onStudentCert(s._id, type)}
                  onAddFamily={() => onStudentAddFamily(s._id)}
                  isLinkedToFamily={isInFamilyTree ? isInFamilyTree(s) : false}
                  canStuEdit={canStuEdit} canStuDelete={canStuDelete} canStuDownload={canStuDownload}
                  canStuPrint={canStuPrint} canFamCreate={canFamCreate}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Per-student row + 3-dot floating menu ─── */
function StuStudentRow({ s, i, flash, onEdit, onMarkInactive, onProfile, onIdCard, onCert, onAddFamily, isLinkedToFamily,
  canStuEdit = true, canStuDelete = true, canStuDownload = true, canStuPrint = true, canFamCreate = true }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [certOpen, setCertOpen] = useState(false);
  const [menuUp, setMenuUp] = useState(false);
  const anchorRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    /* Auto-flip when row is near viewport bottom so the menu doesn't get clipped. */
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      setMenuUp(vh - r.bottom < 380 && r.top > 380);
    }
    const onClick = (e) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target)) {
        setMenuOpen(false);
        setCertOpen(false);
      }
    };
    const onScroll = () => { setMenuOpen(false); setCertOpen(false); };
    document.addEventListener('mousedown', onClick);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onClick);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [menuOpen]);

  const fire = (fn) => { setMenuOpen(false); setCertOpen(false); fn(); };

  const hasDisc = stuHasDiscount(s);
  return (
    <div className={`stu-srow${flash ? ' flash' : ''}`} data-srow={s.reg}>
      {hasDisc && <Tooltip text="This student has a fee discount/adjustment"><div className="stu-disc-corner"></div></Tooltip>}
      <div className="td c"><div className="stu-srow-sn">{i}</div></div>
      <div className="td c">
        <div className="stu-avatar">
          {s.photo ? <img src={s.photo} alt={stuFullName(s)} /> : stuInitials(s)}
        </div>
      </div>
      <div className="td stu-reg-cell">{s.reg}</div>
      <div className="td stu-name-cell">
        <div className="stu-srow-name">{stuFullName(s)}</div>
        <div className="stu-srow-sub">{s.gender || '—'}{s.adm ? ` · Adm ${s.adm}` : ''}</div>
      </div>
      <div className="td stu-father-cell">{s.father || '—'}</div>
      <div className="td stu-dob-cell">{stuFmtDate(s.dob)}</div>
      <div className="td stu-contact-cell">{s.mobile || '—'}</div>
      <div className="td c" ref={anchorRef}>
        <Tooltip text="More actions">
          <button className="stu-dots" onClick={() => setMenuOpen(!menuOpen)}>
            <i className="fa-solid fa-ellipsis-vertical"></i>
          </button>
        </Tooltip>
        {menuOpen && (
          <div className={`stu-actmenu${menuUp ? ' stu-actmenu--up' : ''}`}>
            <div className="stu-actmenu-lbl">{stuFullName(s)} · {s.reg}</div>
            {canStuEdit && (
            <button className="stu-actitem" onClick={() => fire(onEdit)}>
              <i className="fa-solid fa-pen" style={{ color: '#1E40AF' }}></i> Edit / Update Student
            </button>
            )}
            {canStuDownload && (
            <button className="stu-actitem" onClick={() => fire(onProfile)}>
              <i className="fa-solid fa-file-arrow-down" style={{ color: '#7C3AED' }}></i> Download Student Profile
            </button>
            )}
            {canStuPrint && (
            <button className="stu-actitem" onClick={() => fire(onIdCard)}>
              <i className="fa-solid fa-id-badge" style={{ color: '#0E7490' }}></i> Generate Student ID Card
            </button>
            )}
            {canStuPrint && (<>
            <button className="stu-actitem stu-actitem--sub" onClick={() => setCertOpen(!certOpen)}>
              <span><i className="fa-solid fa-award" style={{ color: '#D97706' }}></i> Certificates</span>
              <i className={`fa-solid fa-chevron-${certOpen ? 'up' : 'down'} stu-sub-chev`}></i>
            </button>
            {certOpen && (
              <div className="stu-actmenu-sub">
                <button className="stu-actitem" onClick={() => fire(() => onCert('appreciation'))}>
                  <i className="fa-solid fa-star" style={{ color: '#D97706' }}></i> Appreciation Certificate
                </button>
                <button className="stu-actitem" onClick={() => fire(() => onCert('character'))}>
                  <i className="fa-solid fa-user-shield" style={{ color: '#16A34A' }}></i> Character Certificate
                </button>
                <button className="stu-actitem" onClick={() => fire(() => onCert('leaving'))}>
                  <i className="fa-solid fa-door-open" style={{ color: '#0E7490' }}></i> School Leaving Certificate
                </button>
                <button className="stu-actitem" onClick={() => fire(() => onCert('promotion'))}>
                  <i className="fa-solid fa-arrow-up-right-dots" style={{ color: '#1E40AF' }}></i> Promotion Certificate
                </button>
              </div>
            )}
            </>
            )}
            {canFamCreate && (
            <button
              className="stu-actitem"
              onClick={() => fire(onAddFamily)}
              disabled={isLinkedToFamily}
              title={isLinkedToFamily ? 'This student is already linked to a family tree' : undefined}
            >
              <i className="fa-solid fa-people-roof" style={{ color: '#7C3AED' }}></i>
              {isLinkedToFamily ? 'Already in a Family Tree' : 'Add Student to Family Tree'}
            </button>
            )}
            {canStuDelete && (<>
            <div className="stu-actmenu-div"></div>
            <button className="stu-actitem stu-actitem--danger" onClick={() => fire(onMarkInactive)}>
              <i className="fa-solid fa-user-slash"></i> Mark Inactive
            </button>
            </>)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STUDENT MODAL — 2 internal tabs (General Info / Fee Details).
   General Info has 4 collapsible sections:
     A) Student Registration   (open by default)
     B) Parent & Guardian       (open by default)
     C) Previous School         (collapsed)
     D) Documents               (collapsed)
   Fee Details = per-fee-head discount table with live net-payable
   recalculation. Validation enforces first/father/mobile/reg.
   ═══════════════════════════════════════════════════════════════════ */

const STD_DOCS = [
  { key: 'bform',    label: 'B-Form',                       icon: 'fa-id-card' },
  { key: 'fcnic',    label: 'Father CNIC',                  icon: 'fa-address-card' },
  { key: 'mcnic',    label: 'Mother CNIC',                  icon: 'fa-address-card' },
  { key: 'prevcert', label: 'Previous School Certificate',  icon: 'fa-file-contract' },
  { key: 'birth',    label: 'Birth Certificate',            icon: 'fa-certificate' },
];

/* Collapsible form section. Defined at module scope (NOT inside the modal) so
   its component identity stays stable across the modal's re-renders — an inner
   definition would remount its whole subtree on every keystroke and steal input
   focus. Toggle state is passed in from the modal. */
function StuFormSection({ id, icon, title, open, setOpen, children }) {
  const isOpen = !!open[id];
  return (
    <div className={`stu-fsec${isOpen ? ' open' : ''}`}>
      <div className="stu-fsec-head" onClick={() => setOpen(p => ({ ...p, [id]: !p[id] }))}>
        <div className="stu-fsec-head-l">
          <div className="stu-fsec-ic"><i className={`fa-solid ${icon}`}></i></div>
          <div className="stu-fsec-title">{title}</div>
        </div>
        <i className={`fa-solid fa-chevron-${isOpen ? 'up' : 'down'} stu-fsec-chev`}></i>
      </div>
      {isOpen && <div className="stu-fsec-body">{children}</div>}
    </div>
  );
}

function StuStudentModal({ cfg, activeClass, student, classList, sectionList, classes, families, existingRegs, suggestedReg, suggestedAdm, onClose, onSave, toast, allowNewClassSection = false, requireAdmissionFields = true }) {
  const isEdit = cfg.mode === 'edit';

  /* Default values: from student if editing, otherwise auto-filled */
  const init = isEdit ? student || {} : {};

  const [tab, setTab] = useState('general');
  const [open, setOpen] = useState({ reg: true, parent: true, prev: false, docs: false });
  /* Save chalta rahe to dobara submit na ho. onSave (student + documents +
     family link + reload) kai seconds le sakta hai — us dauran user button par
     do-teen click kar deta tha aur wohi student kai baar insert ho jata tha. */
  const [saving, setSaving] = useState(false);

  /* Form state */
  const [first,    setFirst]    = useState(init.first    || '');
  const [last,     setLast]     = useState(init.last     || '');
  const [gender,   setGender]   = useState(init.gender   || '');
  const [dob,      setDob]      = useState(init.dob      || '');
  const [cls,      setCls]      = useState(init.cls || activeClass?.cls || '');
  const [sec,      setSec]      = useState(init.sec || activeClass?.sec || '');
  /* Pre-Enrollment only (allowNewClassSection): let the front desk type a
     brand new class/section right in this form instead of being limited
     to the existing dropdown lists. */
  const [customClasses, setCustomClasses] = useState(init.cls && !(classList || []).includes(init.cls) ? [init.cls] : []);
  const [customSections, setCustomSections] = useState(init.sec && !(sectionList || []).includes(init.sec) ? [init.sec] : []);
  const [newClassInput, setNewClassInput] = useState(null);
  const [newSectionInput, setNewSectionInput] = useState(null);
  const allClasses = useMemo(() => [...(classList || []), ...customClasses.filter(c => !(classList || []).includes(c))], [classList, customClasses]);
  const allSections = useMemo(() => [...(sectionList || []), ...customSections.filter(s => !(sectionList || []).includes(s))], [sectionList, customSections]);
  const [bform,    setBform]    = useState(init.bform    || '');
  const [nat,      setNat]      = useState(init.nat      || 'Pakistani');
  const [reg,      setReg]      = useState(isEdit ? (init.reg || '') : (requireAdmissionFields ? suggestedReg : ''));
  const [adm,      setAdm]      = useState(isEdit ? (init.adm || '') : (requireAdmissionFields ? suggestedAdm : ''));
  /* Family No ab Family Tree ka dropdown hai: value = family tree id (string).
     Edit par student ki mojooda family pehle tree membership (family.members[])
     se resolve hoti hai — asli link wahin hota hai — aur agar wahan na mile to
     record ki stored FamilyNo par fallback. Purani free-text FamilyNo jo kisi
     tree se match na kare, select me "(existing)" option ban kar dikhti hai
     taake edit par value na khoye. */
  const [family,   setFamily]   = useState(() => {
    if (!isEdit) return '';
    const linked = (Array.isArray(families) ? families : [])
      .find(f => (f.members || []).some(m => String(m._id) === String(init._id)));
    return linked ? String(linked.id) : String(init.family || '');
  });
  const [admdate,  setAdmdate]  = useState(init.admdate  || (requireAdmissionFields ? new Date().toISOString().slice(0, 10) : ''));
  const [father,   setFather]   = useState(init.father   || '');
  const [fcnic,    setFcnic]    = useState(init.fcnic    || '');
  const [focc,     setFocc]     = useState(init.focc     || '');
  const [mobile,   setMobile]   = useState(init.mobile   || '');
  const [mother,   setMother]   = useState(init.mother   || '');
  const [mcnic,    setMcnic]    = useState(init.mcnic    || '');
  const [guardian, setGuardian] = useState(init.guardian || '');
  const [gcontact, setGcontact] = useState(init.gcontact || '');
  const [email,    setEmail]    = useState(init.email    || '');
  const [address,  setAddress]  = useState(init.address  || '');
  const [pschool,  setPschool]  = useState(init.pschool  || '');
  const [pgrade,   setPgrade]   = useState(init.pgrade   || '');
  const [pcontact, setPcontact] = useState(init.pcontact || '');
  const [photo,    setPhoto]    = useState(init.photo    || null);
  const [pictureFile, setPictureFile] = useState(null);   // new File to upload (null = keep existing)

  /* Documents. stdDocs is keyed by the fixed slot key; each value is either
     { id, path } (already on the server) or { file, name } (picked, pending
     upload). customDocs holds "Other" documents in the same union shape.
     removedDocIds collects server doc ids the user cleared, to delete on save. */
  const [stdDocs, setStdDocs] = useState(init.stdDocs || {});
  const [customDocs, setCustomDocs] = useState(init.docs || []);
  const [removedDocIds, setRemovedDocIds] = useState([]);
  const [newDocName, setNewDocName] = useState('');
  const photoRef = useRef(null);
  const stdDocRef = useRef(null);
  const customDocRef = useRef(null);
  const [pendingStdKey, setPendingStdKey] = useState(null);

  /* Family Tree list for the Family No dropdown. */
  const famList = useMemo(() => (Array.isArray(families) ? families : []), [families]);
  /* Chuni gayi family ka record — guardian + siblings dikhane ke liye. */
  const selectedFam = famList.find(f => String(f.id) === family) || null;
  /* Purani free-text FamilyNo value jo kisi mojooda tree se match nahi karti. */
  const isLegacyFamily = Boolean(family) && !selectedFam;
  /* Us family ke baaki members (khud ko chhod kar) = related siblings. */
  const famSiblings = (selectedFam?.members || [])
    .filter(m => String(m._id) !== String(init._id));

  /* Fee heads for the selected class — pulled from that grade's fee
     structure (Launch Setup class fee setup) whenever the class changes. */
  const [feeHeads, setFeeHeads] = useState([]);
  useEffect(() => {
    const row = (classes || []).find(c => c.cls === cls && c.sec === sec)
             || (classes || []).find(c => c.cls === cls);
    const gradeId = row?._gradeId;
    if (!gradeId) { setFeeHeads([]); return; }
    let alive = true;
    studentService.getStuFeeHeads(gradeId)
      .then(list => { if (alive) setFeeHeads(list); })
      .catch(() => { if (alive) setFeeHeads([]); });
    return () => { alive = false; };
  }, [classes, cls, sec]);

  /* Discount table (keyed by fee head name) */
  const [disc, setDisc] = useState(() => {
    const out = {};
    feeHeads.forEach(h => { out[h.name] = Number((init._disc || {})[h.name] || 0); });
    return out;
  });
  useEffect(() => {
    /* Sync when feeHeads loads after first render */
    if (feeHeads.length === 0) return;
    setDisc(prev => {
      const out = { ...prev };
      feeHeads.forEach(h => {
        if (out[h.name] == null) out[h.name] = Number((init._disc || {})[h.name] || 0);
      });
      return out;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feeHeads]);

  /* Esc + scroll lock */
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  /* Photo upload — keep a base64 preview for the UI and the real File for
     the multipart save (rides along on save-student as PictureFile). */
  const handlePhotoPick = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast('Image too large (max 2 MB)', 'error'); return; }
    setPictureFile(f);
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(f);
  };

  /* Standard doc upload — stash the picked File under its slot key; it uploads
     on save. If the slot already held a server document, remember its id so the
     replace can delete the old one first. */
  const pickStdDoc = (key) => {
    setPendingStdKey(key);
    setTimeout(() => stdDocRef.current && stdDocRef.current.click(), 0);
  };
  const handleStdDocFile = (e) => {
    const f = e.target.files && e.target.files[0];
    const key = pendingStdKey;
    if (!f || !key) return;
    setStdDocs(prev => ({ ...prev, [key]: { file: f, name: f.name } }));
    setPendingStdKey(null);
    e.target.value = '';
    toast(`Document "${STD_DOCS.find(d => d.key === key)?.label}" attached`, 'success');
  };

  /* Custom doc add — store the real File plus the user's chosen name. */
  const handleCustomDoc = () => {
    if (!newDocName.trim()) { toast('Please enter the document name first', 'error'); return; }
    customDocRef.current && customDocRef.current.click();
  };
  const handleCustomDocFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setCustomDocs(prev => [...prev, { name: newDocName.trim(), file: f }]);
    setNewDocName('');
    e.target.value = '';
    toast('Document attached', 'success');
  };
  /* Remove a custom doc row; queue a server delete if it was already uploaded. */
  const removeCustomDoc = (i) => {
    setCustomDocs(prev => {
      const doc = prev[i];
      if (doc && doc.id) setRemovedDocIds(ids => [...ids, doc.id]);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  /* Discount handlers — clamped to max amount */
  const setDiscFor = (head, val) => {
    setDisc(prev => ({ ...prev, [head.name]: Math.max(0, Math.min(Number(val) || 0, head.amount)) }));
  };

  /* Live totals */
  const totals = useMemo(() => {
    let std = 0, dsc = 0, net = 0;
    feeHeads.forEach(h => {
      const d = Number(disc[h.name] || 0);
      std += h.amount;
      dsc += d;
      net += Math.max(0, h.amount - d);
    });
    return { std, dsc, net };
  }, [feeHeads, disc]);

  /* Validation + save */
  const handleSubmit = async () => {
    if (saving) return;                 // pehla save abhi chal raha hai
    if (!first.trim())  { toast('First name is required', 'error');     setTab('general'); return; }
    if (!father.trim()) { toast('Father name is required', 'error');    setTab('general'); return; }
    if (!mobile.trim()) { toast('Mobile number is required', 'error');  setTab('general'); return; }
    if (requireAdmissionFields && !reg.trim()) { toast('Registration No is required', 'error'); setTab('general'); return; }
    if (!cls)           { toast('Class is required', 'error');           setTab('general'); return; }
    if (!sec)           { toast('Section is required', 'error');         setTab('general'); return; }
    /* Registration No must be unique across the branch. Compare normalised
       (trimmed/lower-cased), skip blanks, and ignore this student's own record
       when editing — so a reg can never be attached to two students. */
    const regKey = reg.trim().toLowerCase();
    const clash  = (existingRegs || []).find(r => r.reg && r.reg === regKey && r.id !== cfg.id);
    if (clash) {
      toast(`Registration No ${reg.trim()} is already taken by another student`, 'error');
      setTab('general'); return;
    }
    const _disc = {};
    Object.entries(disc).forEach(([k, v]) => { if (Number(v) > 0) _disc[k] = Number(v); });

    /* Collect the documents the user actually picked this session (they carry a
       real File). Fixed slots map to their backend documentType; custom docs use
       their free-text name. These upload after the student is saved. */
    const docUploads = [];
    Object.entries(stdDocs).forEach(([key, v]) => {
      if (v && v.file instanceof File) {
        docUploads.push({ documentType: studentService.STU_DOC_TYPES[key] || key, file: v.file });
      }
    });
    customDocs.forEach(d => {
      if (d && d.file instanceof File && d.name) {
        docUploads.push({ documentType: d.name, file: d.file });
      }
    });

    /* Save ke poora hone tak button lock — warna extra clicks se wohi student
       kai dafa insert ho jata hai. onSave apni errors khud toast karta hai
       (reject nahi hota), phir bhi finally me lock khol dete hain. */
    setSaving(true);
    try {
      await onSave({
        first: first.trim(), last: last.trim(), gender, dob,
        cls, sec, bform, nat, reg, adm, family, admdate,
        father: father.trim(), fcnic, focc, mobile: mobile.trim(),
        mother, mcnic, guardian, gcontact, email, address,
        pschool, pgrade, pcontact,
        photo, stdDocs, docs: customDocs, _disc,
        pictureFile, docUploads, removedDocIds,
      });
    } finally {
      setSaving(false);
    }
  };

  /* Class / Section fields — rendered at the top of the form (in place of
     Reg/Adm/Family/Admission Date) when those are hidden (Pre-Enrollment),
     otherwise kept in their original spot in the main grid. Shared so there's
     exactly one definition regardless of where they render. */
  const classField = (
    <Field label="Class *">
      {newClassInput !== null ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            className="stu-finput" autoFocus value={newClassInput}
            onChange={(e) => setNewClassInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const v = newClassInput.trim(); if (!v) return; setCustomClasses((prev) => (prev.includes(v) ? prev : [...prev, v])); setCls(v); setNewClassInput(null); } }}
            placeholder="Type new class name"
          />
          <Tooltip text="Add this class">
            <button type="button" className="stu-btn-primary" style={{ padding: '0 12px' }} onClick={() => { const v = newClassInput.trim(); if (!v) { toast('Enter a class name', 'error'); return; } setCustomClasses((prev) => (prev.includes(v) ? prev : [...prev, v])); setCls(v); setNewClassInput(null); }}>
              <i className="fa-solid fa-check"></i>
            </button>
          </Tooltip>
          <Tooltip text="Cancel">
            <button type="button" className="stu-btn-ghost" style={{ padding: '0 12px' }} onClick={() => setNewClassInput(null)}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </Tooltip>
        </div>
      ) : (
        <select className="stu-finput" value={cls} onChange={(e) => (e.target.value === '__new__' ? setNewClassInput('') : setCls(e.target.value))}>
          <option value="">Select</option>
          {allClasses.map(c => <option key={c}>{c}</option>)}
          {allowNewClassSection && <option value="__new__">+ Add New Class…</option>}
        </select>
      )}
    </Field>
  );
  const sectionField = (
    <Field label="Section *">
      {newSectionInput !== null ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            className="stu-finput" autoFocus value={newSectionInput}
            onChange={(e) => setNewSectionInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const v = newSectionInput.trim(); if (!v) return; setCustomSections((prev) => (prev.includes(v) ? prev : [...prev, v])); setSec(v); setNewSectionInput(null); } }}
            placeholder="Type new section name"
          />
          <Tooltip text="Add this section">
            <button type="button" className="stu-btn-primary" style={{ padding: '0 12px' }} onClick={() => { const v = newSectionInput.trim(); if (!v) { toast('Enter a section name', 'error'); return; } setCustomSections((prev) => (prev.includes(v) ? prev : [...prev, v])); setSec(v); setNewSectionInput(null); }}>
              <i className="fa-solid fa-check"></i>
            </button>
          </Tooltip>
          <Tooltip text="Cancel">
            <button type="button" className="stu-btn-ghost" style={{ padding: '0 12px' }} onClick={() => setNewSectionInput(null)}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </Tooltip>
        </div>
      ) : (
        <select className="stu-finput" value={sec} onChange={(e) => (e.target.value === '__new__' ? setNewSectionInput('') : setSec(e.target.value))}>
          <option value="">Select</option>
          {allSections.map(s => <option key={s}>{s}</option>)}
          {allowNewClassSection && <option value="__new__">+ Add New Section…</option>}
        </select>
      )}
    </Field>
  );

  return (
    /* Save ke dauran modal band na ho — warna user isay band kar ke dobara
       khol le aur wohi student dubara add ho jaye. */
    <div className="stu-modal-overlay open" onClick={(e) => { if (!saving && e.target === e.currentTarget) onClose(); }}>
      <div className="stu-modal">
        <div className="stu-modal-head">
          <div className="stu-modal-head-title">
            <div className="stu-modal-head-icon">
              <i className={`fa-solid ${isEdit ? 'fa-user-pen' : 'fa-user-plus'}`}></i>
            </div>
            <div>
              <div className="stu-modal-title">{isEdit ? 'Edit Student' : 'Add Student'}</div>
              <div className="stu-modal-sub">
                {isEdit
                  ? `${student?.name || stuFullName(student || {})} · ${student?.reg || ''} · ${cls}${sec ? ` (${sec})` : ''}`
                  : `New admission · ${cls || '—'}${sec ? ` (${sec})` : ''}`}
              </div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="stu-modal-close" onClick={onClose} disabled={saving} aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
          </Tooltip>
        </div>

        {/* Tab nav */}
        <div className="stu-mtabs">
          <button type="button" className={`stu-mtab${tab === 'general' ? ' active' : ''}`} onClick={() => setTab('general')}>
            <i className="fa-solid fa-circle-info"></i> General Information
          </button>
       {/*    <button type="button" className={`stu-mtab${tab === 'fee' ? ' active' : ''}`} onClick={() => setTab('fee')}>
            <i className="fa-solid fa-percent"></i> Fee Details
          </button>*/}
        </div>

        <div className="stu-modal-body">
          {tab === 'general' ? (
            <>
              {/* SECTION A — Student Registration */}
              <StuFormSection id="reg" icon="fa-id-card" title="Student Registration" open={open} setOpen={setOpen}>
                <div className="stu-reg-grid">
                  {/* Photo widget */}
                  <div className="stu-photo-wrap">
                    <div className="stu-photo-box" onClick={() => photoRef.current && photoRef.current.click()}>
                      {photo
                        ? <img src={photo} alt="student" />
                        : <><i className="fa-solid fa-user-graduate"></i><span>Student Photo</span></>}
                    </div>
                    <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoPick} />
                    <button type="button" className="stu-btn-link" onClick={() => photoRef.current && photoRef.current.click()}>
                      <i className="fa-solid fa-upload"></i> {photo ? 'Replace Photo' : 'Upload Photo'}
                    </button>
                    {photo && (
                      <button type="button" className="stu-btn-link stu-btn-link--danger" onClick={() => { setPhoto(null); setPictureFile(null); }}>
                        <i className="fa-solid fa-xmark"></i> Remove
                      </button>
                    )}
                    <div className="stu-fhelp">Square or portrait JPG/PNG, used on the ID card &amp; profile.</div>
                  </div>

                  <div className="stu-fgrid stu-fgrid-2">
                    {requireAdmissionFields ? (<>
                    <Field label="Registration No *" hint="Auto-suggested; must be unique.">
                      <input className="stu-finput" value={reg} onChange={(e) => setReg(e.target.value)} placeholder="245-00000" />
                    </Field>
                    <Field label="Admission No">
                      <input className="stu-finput" value={adm} onChange={(e) => setAdm(e.target.value)} placeholder="Enter Here" />
                    </Field>
                    <Field
                      label="Family Tree"
                      hint={famList.length
                        ? 'Select a Family Tree to Add Student in related fmaily'
                        : 'Koi family tree nahi bani. Pehle Family Tree tab se banayein.'}
                    >
                      <select
                        className="stu-finput"
                        value={family}
                        onChange={(e) => setFamily(e.target.value)}
                        disabled={famList.length === 0}
                      >
                        <option value="">{famList.length ? 'No family (optional)' : 'No family trees available'}</option>
                        {famList.map(f => (
                          <option key={f.id} value={String(f.id)}>
                            {f.name}{f.guardian ? ` — ${f.guardian}` : ''}
                          </option>
                        ))}
                        {/* Legacy free-text FamilyNo jo kisi tree se match nahi karta */}
                        {isLegacyFamily && <option value={family}>{family} (existing)</option>}
                      </select>

                      {/* Chuni gayi family ka guardian + is family ke doosre students */}
                      {selectedFam && (
                        <div className="stu-fhelp" style={{ marginTop: 6 }}>
                          <div>
                            <i className="fa-solid fa-people-roof" style={{ marginRight: 6, color: '#7C3AED' }}></i>
                            <b>{selectedFam.name}</b>
                            {selectedFam.guardian ? ` · Guardian: ${selectedFam.guardian}` : ''}
                            {selectedFam.contact ? ` · ${selectedFam.contact}` : ''}
                          </div>
                          <div style={{ marginTop: 2 }}>
                            {famSiblings.length === 0
                              ? 'Is family me abhi koi doosra student nahi.'
                              : `Related: ${famSiblings
                                  .map(m => `${[m.first, m.last].filter(Boolean).join(' ')}${m._cls ? ` (${m._cls}${m._sec ? `-${m._sec}` : ''})` : ''}`)
                                  .join(', ')}`}
                          </div>
                        </div>
                      )}
                    </Field>
                    <Field label="Date of Admission">
                      <input className="stu-finput" type="date" value={admdate} onChange={(e) => setAdmdate(e.target.value)} />
                    </Field>
                    </>) : (<>{classField}{sectionField}</>)}
                  </div>
                </div>

                <div className="stu-fgrid stu-fgrid-4 stu-fgrid-tight">
                  <Field label="First Name *">
                    <input className="stu-finput" value={first} onChange={(e) => setFirst(e.target.value)} placeholder="First name" />
                  </Field>
                  <Field label="Last Name">
                    <input className="stu-finput" value={last} onChange={(e) => setLast(e.target.value)} placeholder="Last name" />
                  </Field>
                  <Field label="Gender">
                    <select className="stu-finput" value={gender} onChange={(e) => setGender(e.target.value)}>
                      <option value="">Select Gender</option>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </Field>
                  <Field label="Date of Birth">
                    <input className="stu-finput" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                  </Field>
                  {requireAdmissionFields && <>{classField}{sectionField}</>}
                  <Field label="B-Form / CNIC">
                    <input className="stu-finput" value={bform} onChange={(e) => setBform(e.target.value)} placeholder="00000-0000000-0" />
                  </Field>
                  <Field label="Nationality">
                    <input className="stu-finput" value={nat} onChange={(e) => setNat(e.target.value)} placeholder="Pakistani" />
                  </Field>
                </div>
              </StuFormSection>

              {/* SECTION B — Parent & Guardian */}
              <StuFormSection id="parent" icon="fa-people-group" title="Parent & Guardian" open={open} setOpen={setOpen}>
                <div className="stu-fgrid stu-fgrid-4">
                  <Field label="Father Name *">
                    <input className="stu-finput" value={father} onChange={(e) => setFather(e.target.value)} placeholder="Father name" />
                  </Field>
                  <Field label="Father CNIC">
                    <input className="stu-finput" value={fcnic} onChange={(e) => setFcnic(e.target.value)} placeholder="00000-0000000-0" />
                  </Field>
                  <Field label="Father's Occupation">
                    <input className="stu-finput" value={focc} onChange={(e) => setFocc(e.target.value)} placeholder="Occupation" />
                  </Field>
                  <Field label="Mobile No *">
                    <input className="stu-finput" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="03xx xxxxxxx" />
                  </Field>
                  <Field label="Mother Name">
                    <input className="stu-finput" value={mother} onChange={(e) => setMother(e.target.value)} placeholder="Mother name" />
                  </Field>
                  <Field label="Mother CNIC">
                    <input className="stu-finput" value={mcnic} onChange={(e) => setMcnic(e.target.value)} placeholder="00000-0000000-0" />
                  </Field>
                  <Field label="Guardian Name">
                    <input className="stu-finput" value={guardian} onChange={(e) => setGuardian(e.target.value)} placeholder="If other than parents" />
                  </Field>
                  <Field label="Guardian Contact">
                    <input className="stu-finput" value={gcontact} onChange={(e) => setGcontact(e.target.value)} placeholder="03xx xxxxxxx" />
                  </Field>
                  <Field label="Email" wide>
                    <input className="stu-finput" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
                  </Field>
                  <Field label="Address" wide>
                    <input className="stu-finput" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Permanent / postal address" />
                  </Field>
                </div>
              </StuFormSection>

              {/* SECTION C — Previous School */}
              <StuFormSection id="prev" icon="fa-school" title="Previous School (optional)" open={open} setOpen={setOpen}>
                <div className="stu-fgrid stu-fgrid-3">
                  <Field label="School Name">
                    <input className="stu-finput" value={pschool} onChange={(e) => setPschool(e.target.value)} placeholder="Previous school" />
                  </Field>
                  <Field label="Previous Grade">
                    <input className="stu-finput" value={pgrade} onChange={(e) => setPgrade(e.target.value)} placeholder="e.g. Class 1" />
                  </Field>
                  <Field label="Contact No">
                    <input className="stu-finput" value={pcontact} onChange={(e) => setPcontact(e.target.value)} placeholder="Contact" />
                  </Field>
                </div>
              </StuFormSection>

              {/* SECTION D — Documents */}
              <StuFormSection id="docs" icon="fa-paperclip" title="Documents" open={open} setOpen={setOpen}>
                <div className="stu-doc-help">
                  <i className="fa-solid fa-circle-info"></i>
                  Upload the standard documents below. Uploaded documents are listed in the student profile report &amp; preview. You can upload or replace any document.
                </div>

                <div className="stu-docslots">
                  {STD_DOCS.map(d => (
                    <div key={d.key} className={`stu-docslot${stdDocs[d.key] ? ' filled' : ''}`}>
                      <div className="stu-docslot-ic"><i className={`fa-solid ${stdDocs[d.key] ? 'fa-circle-check' : d.icon}`}></i></div>
                      <div className="stu-docslot-body">
                        <div className="stu-docslot-name">{d.label}</div>
                        <div className="stu-docslot-status">{stdDocs[d.key] ? 'Uploaded' : 'Not uploaded'}</div>
                      </div>
                      <div className="stu-docslot-actions">
                        {stdDocs[d.key]?.path && (
                          <a className="stu-btn-link" href={stdDocs[d.key].path} target="_blank" rel="noreferrer">
                            <i className="fa-solid fa-eye"></i> View
                          </a>
                        )}
                        <button type="button" className="stu-btn-link" onClick={() => pickStdDoc(d.key)}>
                          <i className={`fa-solid ${stdDocs[d.key] ? 'fa-rotate' : 'fa-upload'}`}></i> {stdDocs[d.key] ? 'Replace' : 'Upload'}
                        </button>
                      </div>
                    </div>
                  ))}
                  <input ref={stdDocRef} type="file" style={{ display: 'none' }} onChange={handleStdDocFile} />
                </div>

                <div className="stu-doc-custom">
                  <Field label="Other Document Name">
                    <input className="stu-finput" value={newDocName} onChange={(e) => setNewDocName(e.target.value)} placeholder="e.g. Vaccination Card, Medical Report" />
                  </Field>
                  <button type="button" className="stu-btn-secondary" onClick={handleCustomDoc}>
                    <i className="fa-solid fa-upload"></i> Upload &amp; Attach
                  </button>
                  <input ref={customDocRef} type="file" style={{ display: 'none' }} onChange={handleCustomDocFile} />
                </div>

                {customDocs.length > 0 && (
                  <div className="stu-doclist">
                    {customDocs.map((d, i) => (
                      <div key={i} className="stu-docitem">
                        <div className="stu-docitem-ic"><i className="fa-solid fa-file"></i></div>
                        <div className="stu-docitem-body">
                          <div className="stu-docitem-name">{d.name}</div>
                          {d.file instanceof File
                            ? <div className="stu-docitem-sub">{d.file.name}</div>
                            : d.path
                              ? <a className="stu-docitem-sub" href={d.path} target="_blank" rel="noreferrer">View</a>
                              : null}
                        </div>
                        <button type="button" className="stu-btn-link stu-btn-link--danger" onClick={() => removeCustomDoc(i)}>
                          <i className="fa-solid fa-xmark"></i> Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </StuFormSection>
            </>
          ) : (
            <div className="stu-fee-tab">
              <div className="stu-info" style={{ marginBottom: 14 }}>
                <i className="fa-solid fa-circle-info"></i>
                <span>
                  Fee heads are loaded from the standard class fee setup. Any discount or adjustment saved here will apply to this student's <strong>future fee challans</strong> unless changed later. Net payable recalculates automatically.
                </span>
              </div>
              <div className="stu-feewrap">
                <table className="stu-feetable">
                  <thead>
                    <tr>
                      <th>Fee Head</th>
                      <th className="r">Standard Fee</th>
                      <th className="r">Discount</th>
                      <th className="r">Net Payable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feeHeads.map(h => {
                      const d = Number(disc[h.name] || 0);
                      const net = Math.max(0, h.amount - d);
                      return (
                        <tr key={h.name}>
                          <td>
                            <div className="stu-feerow-name">{h.name}</div>
                            <div className="stu-feerow-sub">{h.freq}</div>
                          </td>
                          <td className="r mono">Rs {h.amount.toLocaleString('en-PK')}</td>
                          <td className="r">
                            <input
                              className="stu-finput stu-disc-input"
                              type="number"
                              min="0"
                              max={h.amount}
                              value={d}
                              onChange={(e) => setDiscFor(h, e.target.value)}
                            />
                          </td>
                          <td className="r mono"><strong>Rs {net.toLocaleString('en-PK')}</strong></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Total</td>
                      <td className="r mono">Rs {totals.std.toLocaleString('en-PK')}</td>
                      <td className="r mono" style={{ color: totals.dsc > 0 ? '#B91C1C' : 'inherit' }}>
                        – Rs {totals.dsc.toLocaleString('en-PK')}
                      </td>
                      <td className="r mono"><strong>Rs {totals.net.toLocaleString('en-PK')}</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="stu-warn">
                <i className="fa-solid fa-triangle-exclamation"></i>
                Discounts apply only to challans generated <strong>after</strong> they are saved — already generated challans are not affected.
              </div>
            </div>
          )}
        </div>

        <div className="stu-modal-foot">
          <div className="stu-modal-foot-hint">Fields marked <strong>*</strong> are required.</div>
          <button className="stu-btn-ghost" onClick={onClose} disabled={saving}>Close</button>
          <button className="stu-btn-primary" onClick={handleSubmit} disabled={saving} aria-busy={saving}>
            <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`}></i>{' '}
            {saving
              ? (isEdit ? 'Updating…' : 'Saving…')
              : (isEdit ? 'Update Student' : 'Save Student')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Reusable field wrapper */
function Field({ label, hint, wide, children }) {
  return (
    <div className={`stu-fg${wide ? ' stu-fg-wide' : ''}`}>
      <label className="stu-flabel">{label}</label>
      {children}
      {hint && <div className="stu-fhelp">{hint}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   INACTIVE STUDENTS — struck-off list grouped by last class/section.
   Per-student actions: Character / Leaving certificate (locked when
   dues > 0), Pending Dues settle, Make Active Again.
   ═══════════════════════════════════════════════════════════════════ */
function InactiveStudents({ classes, setClasses, inactive, setInactive, toast }) {
  const { can } = usePermissions();
  const canInEdit     = can('Students', 'Inactive Students', 'Edit');
  const canInDownload = can('Students', 'Inactive Students', 'Download');
  /* school identity for the report header */
  const { data: school = {} } = useAsync(studentService.getStuSchool, {});
  const [loading, setLoading] = useState(false);

  /* Inactive students ki API tab hit karo jab ye tab khule (component mount) —
     module load par nahi. Har baar tab kholne par fresh data. */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    studentService.getStuInactive()
      .then(data => { if (alive) setInactive(Array.isArray(data) ? data : []); })
      .catch(err => { console.error('Could not load inactive students', err); if (alive) { setInactive([]); toast?.('Could not load inactive students', 'error'); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [profileCfg, setProfileCfg] = useState(null);   // { student, title, sub } for the Report Picker
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchWrapRef = useRef(null);
  const [openKey, setOpenKey] = useState(null);
  const [flashReg, setFlashReg] = useState(null);
  const [reactCfg, setReactCfg] = useState(null);
  const [delCfg, setDelCfg]     = useState(null);   // student pending permanent delete
  const [duesCfg, setDuesCfg]   = useState(null);
  const [certCfg, setCertCfg]   = useState(null);   // { type, student, cls } — certificate modal

  /* outside-click closes the search dropdown */
  useEffect(() => {
    if (!searchOpen) return undefined;
    const onClick = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [searchOpen]);

  /* Classes ki tarteeb wahi jo Launch Setup dikhata hai: school ka apna
     `orderBy` (Nursery → Prep → 1 → 2 …), naam ki alphabetical tarteeb NAHI —
     warna "Class 9" seedha "Class 6" ke baad aa jata tha aur "Grade 1" baad me.
     Wahi grades API (get-grades-by-branch) jo Launch Setup use karta hai. */
  const { data: gradeOrder = [] } = useAsync(studentService.getStuGrades, []);

  /* Group inactive list by `${cls}__${sec}`.
     Base: SAARI classes/sections (Active tab jaisा — `classes` prop se), taake
     har class dikhe chahe us me abhi koi inactive student na ho. Phir inactive
     students ko unki class/section me daal do. */
  const groups = useMemo(() => {
    const map = {};
    (classes || []).forEach(c => {
      const key = `${c.cls || 'Unassigned'}__${c.sec || '—'}`;
      if (!map[key]) map[key] = { key, cls: c.cls || 'Unassigned', sec: c.sec || '—', students: [] };
    });
    inactive.forEach(s => {
      const key = `${s.cls || 'Unassigned'}__${s.sec || '—'}`;
      if (!map[key]) map[key] = { key, cls: s.cls || 'Unassigned', sec: s.sec || '—', students: [] };
      map[key].students.push(s);
    });

    /* Rank: pehle Launch Setup wali grades API se; wo na mile (loading/fail) to
       `classes` prop ke apne order se — dono soorton me Active tab jaisa hi
       nateeja. Jo class dono me na ho wo aakhir me, naam ke hisaab se. */
    const clsRank = new Map();
    const secRank = new Map();
    if (gradeOrder.length) {
      gradeOrder.forEach((g, gi) => {
        if (!clsRank.has(g.name)) clsRank.set(g.name, gi);
        (g.sections || []).forEach((s, si) => {
          const k = `${g.name}__${s.name}`;
          if (!secRank.has(k)) secRank.set(k, si);
        });
      });
    } else {
      (classes || []).forEach(c => {
        if (!clsRank.has(c.cls)) clsRank.set(c.cls, clsRank.size);
        const k = `${c.cls}__${c.sec}`;
        if (!secRank.has(k)) secRank.set(k, secRank.size);
      });
    }
    const rankOf = (m, k) => (m.has(k) ? m.get(k) : Number.MAX_SAFE_INTEGER);

    return Object.values(map).sort((a, b) =>
      rankOf(clsRank, a.cls) - rankOf(clsRank, b.cls)
      || a.cls.localeCompare(b.cls)
      || rankOf(secRank, `${a.cls}__${a.sec}`) - rankOf(secRank, `${b.cls}__${b.sec}`)
      || a.sec.localeCompare(b.sec));
  }, [classes, inactive, gradeOrder]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase().trim();
    return groups
      .map(g => ({ ...g, students: g.students.filter(s => `${stuFullName(s)} ${s.reg} ${s.father} ${g.cls} ${g.sec}`.toLowerCase().includes(q)) }))
      .filter(g => g.students.length > 0);
  }, [groups, search]);

  const matches = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase().trim();
    const out = [];
    groups.forEach(g => g.students.forEach(s => {
      if (`${stuFullName(s)} ${s.reg} ${s.father} ${g.cls} ${g.sec}`.toLowerCase().includes(q)) out.push({ s, g });
    }));
    return out;
  }, [groups, search]);

  const jumpTo = (gKey, reg) => {
    setOpenKey(gKey);
    setSearch('');
    setSearchOpen(false);
    setFlashReg(reg);
    setTimeout(() => {
      const el = document.querySelector(`[data-inreg="${reg}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setFlashReg(null), 2200);
    }, 80);
  };

  /* Reactivate — PUT restore-student/{id} on the server (isActive → true), then
     refresh the Active + Inactive lists from the API. */
  const reactivate = async (student) => {
    try {
      await studentService.restoreStuStudent(student._id);
      const [freshClasses, freshInactive] = await Promise.all([
        studentService.getStuClasses(),
        studentService.getStuInactive(),
      ]);
      setClasses(freshClasses);
      setInactive(Array.isArray(freshInactive) ? freshInactive : []);
      toast(`${stuFullName(student)} restored to ${student.cls} (${student.sec})`, 'success');
    } catch (err) {
      toast(err.message || 'Could not restore student', 'error');
    }
    setReactCfg(null);
  };

  /* Permanent delete — hard-delete an inactive student on the server, then refresh
     the Inactive list from the API. This CANNOT be undone (no restore). */
  const permanentDelete = async (student) => {
    try {
      await studentService.permanentDeleteStuStudent(student._id);
      const freshInactive = await studentService.getStuInactive();
      setInactive(Array.isArray(freshInactive) ? freshInactive : []);
      toast(`${stuFullName(student)} permanently deleted`, 'success');
    } catch (err) {
      toast(err.message || 'Could not permanently delete student', 'error');
    }
    setDelCfg(null);
  };

  /* Settle pending dues — appends to history, drops total. PDF receipt
     wired up in Step 9. */
  const handleSettleDues = ({ student, received, discount, mode, notes }) => {
    const before     = Number(student.dues?.total || 0);
    const received$  = Math.max(0, Number(received) || 0);
    const discount$  = Math.max(0, Number(discount) || 0);
    if (received$ + discount$ <= 0) { toast('Enter an amount received or a discount', 'error'); return; }
    if (received$ + discount$ > before) { toast('Total exceeds outstanding amount', 'error'); return; }
    const remaining = Math.max(0, before - received$ - discount$);
    setInactive(prev => prev.map(s => s.reg === student.reg
      ? { ...s, dues: {
          ...s.dues, total: remaining,
          history: [
            ...(s.dues.history || []),
            { date: new Date().toISOString().slice(0, 10), received: received$, discount: discount$, mode, notes, remaining },
          ],
        } }
      : s));
    toast(remaining === 0 ? 'Dues cleared in full — certificates unlocked' : `Partial settlement of Rs ${(received$ + discount$).toLocaleString('en-PK')} recorded`, 'success');
    setDuesCfg(null);
  };

  const handleAction = (label) => toast(`${label} — coming in a later step`, 'info');

  /* Open an A4 PDF print window for a list of inactive students. */
  const openInactiveReport = (list, title) => {
    if (!list || list.length === 0) { toast('No inactive students to download', 'info'); return; }
    const html = buildStuInactiveReportHTML(list, title, school);
    stuOpenPrintWindow(title, '', html, toast);
  };
  const downloadAll   = () => openInactiveReport(inactive, 'All Inactive Students');
  const downloadGroup = (g) => openInactiveReport(g.students, `Inactive — ${g.cls} (${g.sec})`);

  /* Open the Colorful/Colorless picker for an inactive student's profile PDF. */
  const openProfilePicker = (student) => {
    setProfileCfg({
      kind: 'profile',
      title: 'Download Student Profile',
      sub: `${stuFullName(student)} · ${student.reg} — choose style & format`,
      student,
    });
  };
  const doProfileReport = ({ style, format }) => {
    if (!profileCfg?.student) return;
    const s = profileCfg.student;
    const cls = { cls: s.cls || '—', sec: s.sec || '—' };
    const html = buildStuProfileHTML(s, cls, school, style === 'bw');
    stuDeliverReport(`Profile — ${stuFullName(s)}`, '', html, format, toast);
    toast(`${profileCfg.title} (${style.toUpperCase()} · ${format.toUpperCase()}) ready`, 'success');
    setProfileCfg(null);
  };

  /* Inactive student ka certificate generate + download (Active tab jaisa hi — StuCertModal
     se style/opts leke buildStuCertHTML → print/PDF window). Pehle sirf stub toast tha. */
  const doCert = (style, opts) => {
    if (!certCfg?.student) return;
    const s = certCfg.student;
    const cls = certCfg.cls || { cls: s.cls || '—', sec: s.sec || '—' };
    const { css, html } = buildStuCertHTML(s, cls, school, certCfg.type, style, opts);
    stuOpenPrintWindow(`Certificate — ${stuFullName(s)}`, css, html, toast);
    toast(`${STU_CERT_DEFAULTS[certCfg.type]?.title || 'Certificate'} generated`, 'success');
    setCertCfg(null);
  };

  return (
    <>
      {/* Info banner */}
      <div className="stu-info">
        <i className="fa-solid fa-circle-info"></i>
        <span>
          Students struck off from active classes appear here, grouped by their last class &amp; section.
          Use the three-dots menu to generate certificates or reactivate.
          Inactive students with <strong>pending dues</strong> cannot receive certificates until balances are cleared.
        </span>
      </div>

      {/* Toolbar */}
      <div className="stu-toolbar">
        <div className="stu-search-wrap" ref={searchWrapRef}>
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            className="stu-search-input"
            placeholder="Search inactive student, reg no, father or class…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            autoComplete="off"
          />
          {search && (
            <button className="stu-search-clear" onClick={() => { setSearch(''); setSearchOpen(false); }}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
          {searchOpen && search.trim() && (
            <div className="stu-sr">
              {matches.length === 0 ? (
                <div className="stu-sr-empty">No inactive students found for "<b>{search}</b>"</div>
              ) : (
                <>
                  {matches.slice(0, 30).map(({ s, g }, mi) => (
                    <button key={s._id ?? `idx-${mi}`} type="button" className="stu-sr-item" onClick={() => jumpTo(g.key, s.reg)}>
                      <div className="stu-sr-av" style={{ background: 'rgba(220,38,38,.10)', color: '#DC2626' }}>{stuInitials(s)}</div>
                      <div className="stu-sr-main">
                        <div className="stu-sr-name">{stuFullName(s)}</div>
                        <div className="stu-sr-meta">
                          <span>{g.cls} · {g.sec}</span>
                          <span>Father: {s.father}</span>
                          <span style={{ fontFamily: 'ui-monospace,Menlo,monospace' }}>{s.reg}</span>
                        </div>
                      </div>
                      <div className="stu-sr-go"><i className="fa-solid fa-arrow-right"></i></div>
                    </button>
                  ))}
                  {matches.length > 30 && (
                    <div className="stu-sr-foot">Showing first 30 of <b>{matches.length}</b> matches</div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="stu-toolbar-actions">
          {canInDownload && (
          <Tooltip text="Download all inactive students report">
            <button className="stu-iconbtn" onClick={downloadAll} aria-label="Download all inactive students report">
              <i className="fa-solid fa-file-arrow-down"></i>
            </button>
          </Tooltip>
          )}
        </div>
      </div>

      {/* Grouped table */}
      <div className="fee-section stu-section">
        <div className="stu-table-head" style={{ gridTemplateColumns: '54px 1.4fr 1fr 110px 90px 70px' }}>
          <div className="th c">#</div>
          <div className="th">Class</div>
          <div className="th">Section</div>
          <div className="th c">Strength</div>
          <div className="th c">Report</div>
          <div className="th c">Details</div>
        </div>

        {loading ? (
          <div className="stu-empty">
            <div className="stu-empty-ic"><i className="fa-solid fa-spinner fa-spin"></i></div>
            <div className="stu-empty-title">Loading inactive students…</div>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="stu-empty">
            <div className="stu-empty-ic"><i className="fa-solid fa-user-slash"></i></div>
            <div className="stu-empty-title">No inactive students</div>
            <div className="stu-empty-sub">
              Students you strike off from Active Students will appear here, grouped by their last class &amp; section.
            </div>
          </div>
        ) : filteredGroups.map((g, idx) => (
          <StuInactiveGroup
            key={g.key}
            g={g}
            idx={idx + 1}
            isOpen={openKey === g.key}
            onToggle={() => setOpenKey(openKey === g.key ? null : g.key)}
            onGroupReport={() => downloadGroup(g)}
            flashReg={flashReg}
            onReactivate={(student) => setReactCfg(student)}
            onDelete={(student) => setDelCfg(student)}
            onPendingDues={(student) => setDuesCfg(student)}
            onCert={(student, type) => {
              if ((student.dues?.total || 0) > 0) {
                toast('Certificates are blocked due to pending outstanding dues.', 'error');
                return;
              }
              setCertCfg({ type, student, cls: { cls: student.cls || '—', sec: student.sec || '—' } });
            }}
            onProfileDownload={(student) => openProfilePicker(student)}
            canInEdit={canInEdit}
            canInDownload={canInDownload}
          />
        ))}
      </div>

      <CrmConfirmStyleReactivate cfg={reactCfg} onClose={() => setReactCfg(null)} onConfirm={reactivate} />

      <CrmConfirmStyleDeleteStudent cfg={delCfg} onClose={() => setDelCfg(null)} onConfirm={permanentDelete} />

      {duesCfg && (
        <StuDuesModal
          student={duesCfg}
          onClose={() => setDuesCfg(null)}
          onSettle={handleSettleDues}
        />
      )}

      {profileCfg && (
        <StuReportPicker
          cfg={profileCfg}
          onClose={() => setProfileCfg(null)}
          onConfirm={doProfileReport}
        />
      )}

      {certCfg && (
        <StuCertModal
          cfg={certCfg}
          student={certCfg.student}
          cls={certCfg.cls}
          school={school}
          onClose={() => setCertCfg(null)}
          onDownload={doCert}
        />
      )}
    </>
  );
}

/* ─── Inactive group row + expanded student list ─── */
function StuInactiveGroup({ g, idx, isOpen, onToggle, onGroupReport, flashReg, onReactivate, onDelete, onPendingDues, onCert, onProfileDownload, canInEdit = true, canInDownload = true }) {
  return (
    <div className={`stu-clswrap${isOpen ? ' open' : ''}`}>
      <div className="stu-cls-row" style={{ gridTemplateColumns: '54px 1.4fr 1fr 110px 90px 70px' }} onClick={onToggle}>
        <div className="td c"><div className="stu-cls-sn">{idx}</div></div>
        <div className="td">
          <div className="stu-cls-name-wrap">
            <div className="stu-cls-ic" style={{ background: 'linear-gradient(135deg,#DC2626,#B91C1C)' }}>
              <i className={`fa-solid ${STU_CLASS_ICON(g.cls)}`}></i>
            </div>
            <div>
              <div className="stu-cls-name">{g.cls}</div>
              <div className="stu-cls-sub">{g.students.length} inactive · last section {g.sec}</div>
            </div>
          </div>
        </div>
        <div className="td"><span className="stu-sec-pill" style={{ background: 'rgba(220,38,38,.08)', color: '#B91C1C', borderColor: 'rgba(220,38,38,.22)' }}><i className="fa-solid fa-grip"></i> {g.sec}</span></div>
        <div className="td c"><div className="stu-strength" style={{ background: 'rgba(220,38,38,.10)', color: '#B91C1C' }}><span className="num">{g.students.length}</span></div></div>
        <div className="td c" onClick={(e) => e.stopPropagation()}>
          <Tooltip text="Download inactive report for this group">
            <button className="stu-rep-btn" onClick={onGroupReport} aria-label="Download inactive report for this group"><i className="fa-solid fa-file-arrow-down"></i></button>
          </Tooltip>
        </div>
        <div className="td c">
          <Tooltip text={isOpen ? 'Collapse details' : 'Expand details'}>
            <button className="stu-chev" onClick={(e) => { e.stopPropagation(); onToggle(); }} aria-label={isOpen ? 'Collapse' : 'Expand'}>
              <i className={`fa-solid fa-chevron-down${isOpen ? ' rot' : ''}`}></i>
            </button>
          </Tooltip>
        </div>
      </div>

      <div className={`stu-detail${isOpen ? ' open' : ''}`}>
        <div className="stu-detail-inner">
          <div className="stu-detail-head">
            <div className="stu-detail-title">
              <i className="fa-solid fa-user-slash"></i> Inactive in {g.cls} — Section {g.sec}
            </div>
          </div>

          <div className="stu-list-head stu-in-list-head" style={{ gridTemplateColumns: '46px 58px 1.1fr 1.3fr 1.1fr 1.1fr 1.2fr 60px' }}>
            <div className="th c">#</div>
            <div className="th c">Photo</div>
            <div className="th">Reg No</div>
            <div className="th">Name</div>
            <div className="th">Father Name</div>
            <div className="th">Status</div>
            <div className="th">Reason</div>
            <div className="th c">Action</div>
          </div>
          {g.students.map((s, i) => (
            <StuInactiveRow
              key={s._id ?? `idx-${i}`}
              s={s}
              i={i + 1}
              flash={flashReg === s.reg}
              onReactivate={() => onReactivate(s)}
              onDelete={() => onDelete(s)}
              onPendingDues={() => onPendingDues(s)}
              onCert={(type) => onCert(s, type)}
              onProfileDownload={() => onProfileDownload(s)}
              canInEdit={canInEdit} canInDownload={canInDownload}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Per-inactive-student row + 3-dot menu ─── */
function StuInactiveRow({ s, i, flash, onReactivate, onDelete, onPendingDues, onCert, onProfileDownload, canInEdit = true, canInDownload = true }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuUp, setMenuUp] = useState(false);
  const anchorRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    /* Auto-flip: if the row sits near the bottom of the viewport, open the menu upward. */
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      setMenuUp(vh - r.bottom < 360 && r.top > 360);
    }
    const onClick = (e) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onScroll = () => setMenuOpen(false);
    document.addEventListener('mousedown', onClick);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onClick);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [menuOpen]);

  const dueTotal = Number(s.dues?.total || 0);
  const locked   = dueTotal > 0;
  const fire = (fn) => { setMenuOpen(false); fn(); };

  return (
    <div className={`stu-srow stu-srow-inactive${flash ? ' flash' : ''}`} style={{ gridTemplateColumns: '46px 58px 1.1fr 1.3fr 1.1fr 1.1fr 1.2fr 60px' }} data-inreg={s.reg}>
      <div className="td c"><div className="stu-srow-sn">{i}</div></div>
      <div className="td c">
        <div className="stu-avatar" style={{ background: 'rgba(220,38,38,.10)', color: '#DC2626' }}>
          {s.photo ? <img src={s.photo} alt={stuFullName(s)} /> : stuInitials(s)}
        </div>
      </div>
      <div className="td stu-reg-cell">{s.reg}</div>
      <div className="td stu-name-cell">
        <div className="stu-srow-name">{stuFullName(s)}</div>
        <div className="stu-srow-sub">Inactive {stuFmtDate(s.inactiveDate)}</div>
      </div>
      <div className="td stu-father-cell">{s.father || '—'}</div>
      <div className="td">
        {locked
          ? <span className="stu-due-badge"><i className="fa-solid fa-triangle-exclamation"></i> Rs {dueTotal.toLocaleString('en-PK')} due</span>
          : <span className="stu-clear-badge"><i className="fa-solid fa-check"></i> Cleared</span>}
      </div>
      <div className="td stu-reason-cell">{s.reason || '—'}</div>
      <div className="td c" ref={anchorRef}>
        <Tooltip text="More actions">
          <button className="stu-dots" onClick={() => setMenuOpen(!menuOpen)}>
            <i className="fa-solid fa-ellipsis-vertical"></i>
          </button>
        </Tooltip>
        {menuOpen && (
          <div className={`stu-actmenu${menuUp ? ' stu-actmenu--up' : ''}`}>
            <div className="stu-actmenu-lbl">{stuFullName(s)} · {s.reg}</div>
            <button className={`stu-actitem${locked ? ' stu-actitem--locked' : ''}`} onClick={() => locked ? onCert('character') : fire(() => onCert('character'))}>
              <i className="fa-solid fa-award" style={{ color: '#16A34A' }}></i>
              <div className="stu-act-text">
                <div>Character Certificate</div>
                <div className="stu-act-sub">Good conduct &amp; character</div>
              </div>
              {locked && <i className="fa-solid fa-lock stu-act-lock"></i>}
            </button>
            <button className={`stu-actitem${locked ? ' stu-actitem--locked' : ''}`} onClick={() => locked ? onCert('leaving') : fire(() => onCert('leaving'))}>
              <i className="fa-solid fa-award" style={{ color: '#0E7490' }}></i>
              <div className="stu-act-text">
                <div>School Leaving Certificate</div>
                <div className="stu-act-sub">Completion &amp; clearance</div>
              </div>
              {locked && <i className="fa-solid fa-lock stu-act-lock"></i>}
            </button>
            {canInDownload && (
            <button className="stu-actitem" onClick={() => fire(onProfileDownload)}>
              <i className="fa-solid fa-file-arrow-down" style={{ color: '#7C3AED' }}></i> Download Student Profile
            </button>
            )}
            <div className="stu-actmenu-div"></div>
            {locked && (
              <button className="stu-actitem stu-actitem--warn" onClick={() => fire(onPendingDues)}>
                <i className="fa-solid fa-triangle-exclamation" style={{ color: '#D97706' }}></i>
                <div className="stu-act-text">
                  <div>Pending Dues</div>
                  <div className="stu-act-sub">Rs {dueTotal.toLocaleString('en-PK')} outstanding — settle to unlock</div>
                </div>
              </button>
            )}
            {canInEdit && (
            <button className="stu-actitem stu-actitem--success" onClick={() => fire(onReactivate)}>
              <i className="fa-solid fa-user-check" style={{ color: '#16A34A' }}></i>
              <div className="stu-act-text">
                <div>Make Active Again</div>
                <div className="stu-act-sub">Restore to active records</div>
              </div>
            </button>
            )}
            {canInEdit && (
            <button className="stu-actitem stu-actitem--danger" onClick={() => fire(onDelete)}>
              <i className="fa-solid fa-trash" style={{ color: '#DC2626' }}></i>
              <div className="stu-act-text">
                <div>Delete Permanently</div>
                <div className="stu-act-sub">Remove this student for good — cannot be undone</div>
              </div>
            </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Reactivate confirm — uses the hero-ring CRM-style dialog ─── */
function CrmConfirmStyleReactivate({ cfg, onClose, onConfirm }) {
  useEffect(() => {
    if (!cfg) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [cfg, onClose]);
  if (!cfg) return null;
  const dues = Number(cfg.dues?.total || 0);
  return (
    <div className="stu-confirm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="stu-confirm-dialog">
        <div className="stu-confirm-glow" />
        <div className="stu-confirm-hero">
          <div className="stu-confirm-ring">
            <div className="stu-confirm-icon-wrap"><i className="fa-solid fa-user-check"></i></div>
          </div>
        </div>
        <div className="stu-confirm-body">
          <div className="stu-confirm-title">Reactivate student?</div>
          <div className="stu-confirm-msg">
            "<strong>{stuFullName(cfg)}</strong>" will be restored to <strong>{cfg.cls} ({cfg.sec})</strong> and start appearing in active rosters again.
          </div>
          <div className="stu-confirm-hint">
            <div className="stu-confirm-hint-row"><i className="fa-solid fa-users-between-lines"></i> Student moves back to the active class</div>
            <div className="stu-confirm-hint-row"><i className="fa-solid fa-timeline"></i> Inactive reason &amp; struck-off date are cleared</div>
            {dues > 0
              ? <div className="stu-confirm-hint-row" style={{ color: '#B91C1C' }}><i className="fa-solid fa-triangle-exclamation"></i> Outstanding balance <strong>Rs {dues.toLocaleString('en-PK')}</strong> is dropped — settle separately if needed</div>
              : <div className="stu-confirm-hint-row" style={{ color: '#15803D' }}><i className="fa-solid fa-check"></i> No dues — clean reactivation</div>}
          </div>
        </div>
        <div className="stu-confirm-footer">
          <button className="stu-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="stu-btn-primary"
            style={{ background: 'linear-gradient(135deg,#16A34A,#15803D)', boxShadow: '0 4px 14px rgba(22,163,74,.28)' }}
            onClick={() => onConfirm(cfg)}
          >
            <i className="fa-solid fa-user-check"></i> Yes, Reactivate
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Permanent-delete confirm — hero-ring CRM-style dialog (danger) ─── */
function CrmConfirmStyleDeleteStudent({ cfg, onClose, onConfirm }) {
  useEffect(() => {
    if (!cfg) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [cfg, onClose]);
  if (!cfg) return null;
  return (
    <div className="stu-confirm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="stu-confirm-dialog">
        <div className="stu-confirm-glow" style={{ background: 'radial-gradient(circle,rgba(220,38,38,.18),transparent 70%)' }} />
        <div className="stu-confirm-hero">
          <div className="stu-confirm-ring" style={{ borderColor: 'rgba(220,38,38,.25)' }}>
            <div className="stu-confirm-icon-wrap" style={{ background: '#fff', border: '1px solid rgba(220,38,38,.25)' }}><i className="fa-solid fa-trash" style={{ color: '#DC2626' }}></i></div>
          </div>
        </div>
        <div className="stu-confirm-body">
          <div className="stu-confirm-title">Delete student permanently?</div>
          <div className="stu-confirm-msg">
            "<strong>{stuFullName(cfg)}</strong>" ({cfg.cls} {cfg.sec ? `(${cfg.sec})` : ''}) will be <strong>permanently removed</strong> from the system.
          </div>
        </div>
        <div className="stu-confirm-footer">
          <button className="stu-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="stu-btn-primary"
            style={{ background: 'linear-gradient(135deg,#DC2626,#B91C1C)', boxShadow: '0 4px 14px rgba(220,38,38,.28)' }}
            onClick={() => onConfirm(cfg)}
          >
            <i className="fa-solid fa-trash"></i> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PROMOTE STUDENTS modal — select students from a section and move
   them to a target class+section. Carries discounts forward by default.
   ═══════════════════════════════════════════════════════════════════ */
const PROMOTE_NEXT = {
  Nursery: 'Prep', Prep: 'Class 1', 'Class 1': 'Class 2', 'Class 2': 'Class 3',
  'Class 3': 'Class 4', 'Class 4': 'Class 5', 'Class 5': 'Class 6',
  'Class 6': 'Class 7', 'Class 7': 'Class 8', 'Class 8': 'Class 9',
  'Class 9': 'Class 10',
};

function StuPromoteModal({ cls, classList, sectionList, onClose, onSubmit, toast }) {
  const fromCls = cls?.cls || '';
  const fromSec = cls?.sec || '';
  const [grades, setGrades]   = useState([]);   // school ki proper-sequence classes + unke sections
  const [toClass, setToClass] = useState(PROMOTE_NEXT[fromCls] || fromCls || '');
  const [toSec, setToSec]     = useState(fromSec);
  const [session, setSession] = useState('');   // active session NAME (read-only) — Settings se change hota hai
  const [sessionId, setSessionId] = useState(0); // active session ID → API ka sessionYearID
  const [carry, setCarry]     = useState(false);   // by default uncheck
  const [selected, setSelected] = useState({});
  const [selAll, setSelAll]     = useState(false);

  /* Mount par: (1) proper-order classes + sections, (2) active session (name + id) fetch. */
  useEffect(() => {
    let alive = true;
    studentService.getStuGrades().then(g => { if (alive) setGrades(Array.isArray(g) ? g : []); }).catch(() => {});
    studentService.getStuActiveSession().then(s => { if (alive) { setSession(s?.name || ''); setSessionId(s?.id || 0); } }).catch(() => {});
    return () => { alive = false; };
  }, []);

  /* To Class ke options = school-order classes (fallback: purani classList prop).
     To Section = us SELECTED class ke against sections (fallback: sectionList prop). */
  const classOptions = grades.length ? grades.map(g => g.name) : (classList || []);
  const selGrade = grades.find(g => g.name === toClass);
  const sectionOptions = selGrade ? selGrade.sections.map(s => s.name) : (sectionList || []);

  /* To Class badle to section list refresh — agar current section us class me na ho to pehli par set. */
  useEffect(() => {
    if (sectionOptions.length && !sectionOptions.includes(toSec)) setToSec(sectionOptions[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toClass, grades]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  /* Selection key = student ka UNIQUE _id (reg khaali ho sakta hai → collide karta tha). */
  const toggleAll = (v) => {
    setSelAll(v);
    const next = {};
    (cls?.students || []).forEach(s => { next[s._id] = v; });
    setSelected(next);
  };
  const toggleOne = (id) => {
    setSelected(prev => {
      const next = { ...prev, [id]: !prev[id] };
      const all  = (cls?.students || []).length > 0 && (cls?.students || []).every(s => next[s._id]);
      setSelAll(all);
      return next;
    });
  };
  const count = (cls?.students || []).filter(s => selected[s._id]).length;

  return (
    <div className="stu-modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="stu-modal" style={{ maxWidth: 820 }}>
        <div className="stu-modal-head">
          <div className="stu-modal-head-title">
            <div className="stu-modal-head-icon" style={{ background: 'linear-gradient(135deg,#16A34A,#15803D)' }}>
              <i className="fa-solid fa-arrow-up-right-dots"></i>
            </div>
            <div>
              <div className="stu-modal-title">Promote Students</div>
              <div className="stu-modal-sub">From <strong>{fromCls}</strong> ({fromSec})</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="stu-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
          </Tooltip>
        </div>

        <div className="stu-modal-body">
          <div className="stu-fgrid stu-fgrid-4">
            <Field label="From Class">
              <input className="stu-finput" value={fromCls} readOnly />
            </Field>
            <Field label="From Section">
              <input className="stu-finput" value={fromSec} readOnly />
            </Field>
            <Field label="To Class *">
              <select className="stu-finput" value={toClass} onChange={(e) => setToClass(e.target.value)}>
                <option value="">Select</option>
                {classOptions.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="To Section *">
              <select className="stu-finput" value={toSec} onChange={(e) => setToSec(e.target.value)}>
                <option value="">Select</option>
                {sectionOptions.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Session / Academic Year" wide>
              {/* Read-only — session sirf Settings se change hota hai. Click par message. */}
              <input
                className="stu-finput"
                value={session}
                readOnly
                title="To change the session, go to Settings."
                style={{ cursor: 'not-allowed', background: '#F1F5F9', color: '#475569' }}
                onMouseDown={(e) => { e.preventDefault(); toast && toast('To change the session, go to Settings.', 'info'); }}
              />
            </Field>
            <div className="stu-fg stu-fg-wide">
              <label className="stu-flabel">Settings</label>
              <label className="stu-checkrow">
                <input type="checkbox" checked={carry} onChange={(e) => setCarry(e.target.checked)} />
                <span>Carry forward financial settings &amp; discounts</span>
              </label>
            </div>
          </div>

          <div className="stu-promo-tablewrap">
            <table className="stu-promo-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th style={{ width: 140 }}>Reg No</th>
                  <th>Name</th>
                  <th>Father Name</th>
                  <th className="c" style={{ width: 90 }}>
                    Select <input type="checkbox" checked={selAll} onChange={(e) => toggleAll(e.target.checked)} style={{ marginLeft: 6, verticalAlign: 'middle' }} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {(cls?.students || []).length === 0 ? (
                  <tr><td colSpan="5" className="stu-promo-empty">No students in this section.</td></tr>
                ) : cls.students.map((s, i) => (
                  <tr key={s._id ?? s.reg ?? i} className={selected[s._id] ? 'sel' : ''}>
                    <td>{i + 1}</td>
                    <td className="mono">{s.reg}</td>
                    <td><strong>{stuFullName(s)}</strong></td>
                    <td>{s.father || '—'}</td>
                    <td className="c">
                      <input type="checkbox" checked={!!selected[s._id]} onChange={() => toggleOne(s._id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="stu-modal-foot">
          <div className="stu-modal-foot-hint">
            <i className="fa-solid fa-users" style={{ color: '#1E40AF', marginRight: 6 }}></i>
            <strong style={{ color: count > 0 ? '#15803D' : 'var(--text-muted)' }}>{count}</strong> student(s) selected
          </div>
          <button className="stu-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="stu-btn-primary"
            style={{ background: 'linear-gradient(135deg,#16A34A,#15803D)', boxShadow: '0 4px 14px rgba(22,163,74,.28)' }}
            disabled={count === 0 || !toClass || !toSec}
            onClick={() => {
              /* Har selected student ke liye promote payload banao (IDs resolve karke). */
              const newGrade   = grades.find(g => g.name === toClass);
              const newSection = newGrade?.sections.find(s => s.name === toSec);
              const promotions = (cls?.students || [])
                .filter(s => selected[s._id])
                .map(s => ({
                  studentID:     s._id,
                  oldGradeID:    cls?._gradeId,
                  oldSectionID:  cls?._sectionId,
                  newGradeID:    newGrade?.id,
                  newSectionID:  newSection?.id,
                  sessionYearID: sessionId,
                  isCarryForward: carry,
                }));
              onSubmit({ toClass, toSection: toSec, promotions });
            }}
          >
            <i className="fa-solid fa-arrow-up-right-dots"></i> Promote Students
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MARK INACTIVE confirm modal — short form: reason + effective date.
   ═══════════════════════════════════════════════════════════════════ */
function StuInactiveModal({ cls, student, reasons, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [pickReason, setPickReason] = useState('');
  /* Effective date is fixed to today (field is disabled in the form). */
  const [effectiveDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  if (!student || !cls) return null;
  return (
    <div className="stu-modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="stu-modal" style={{ maxWidth: 520 }}>
        <div className="stu-modal-head">
          <div className="stu-modal-head-title">
            <div className="stu-modal-head-icon" style={{ background: 'linear-gradient(135deg,#DC2626,#B91C1C)' }}>
              <i className="fa-solid fa-user-slash"></i>
            </div>
            <div>
              <div className="stu-modal-title">Mark Student Inactive</div>
              <div className="stu-modal-sub">Struck off <strong>{stuFullName(student)}</strong> from <strong>{cls.cls} ({cls.sec})</strong>.</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="stu-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
          </Tooltip>
        </div>
        <div className="stu-modal-body">
          <div className="stu-fgrid">
            <Field label="Reason (quick pick)">
              <select className="stu-finput" value={pickReason} onChange={(e) => { setPickReason(e.target.value); if (e.target.value !== 'Other') setReason(e.target.value); else setReason(''); }}>
                <option value="">— Select —</option>
                {reasons.map(r => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Reason *">
              <textarea
                className="stu-finput"
                style={{ height: 90, padding: '10px 12px', resize: 'vertical' }}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for marking inactive (e.g. transferred, withdrawn)…"
              />
            </Field>
            <Field label="Effective Date">
              <input
                className="stu-finput"
                type="date"
                value={effectiveDate}
                disabled
                style={{ background: 'var(--stu-disabled-bg, #f1f5f9)', cursor: 'not-allowed', color: 'var(--text-muted)' }}
                title="Effective date is today and cannot be changed"
              />
            </Field>
          </div>
          <div className="stu-warn" style={{ marginTop: 12 }}>
            <i className="fa-solid fa-triangle-exclamation"></i>
            The student moves to the <strong>Inactive list</strong> and is excluded from active rosters &amp; new challans. Any outstanding balance is <strong>frozen</strong> for settlement later.
          </div>
        </div>
        <div className="stu-modal-foot">
          <button className="stu-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="stu-btn-primary"
            style={{ background: 'linear-gradient(135deg,#DC2626,#B91C1C)', boxShadow: '0 4px 14px rgba(220,38,38,.28)' }}
            onClick={() => onSubmit({ reason, effectiveDate })}
          >
            <i className="fa-solid fa-user-slash"></i> Mark Inactive
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PENDING DUES modal — hero outstanding amount + frozen heads list +
   quick-action buttons + receive/discount/mode form with live remaining
   balance. Triggered from the Inactive Students tab.
   ═══════════════════════════════════════════════════════════════════ */
const STU_PAY_MODES = ['Cash', 'Bank Transfer', 'Cheque', 'Card', 'OneLink'];

function StuDuesModal({ student, onClose, onSettle }) {
  const total = Number(student?.dues?.total || 0);
  const [received, setReceived] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [mode, setMode]         = useState('Cash');
  const [notes, setNotes]       = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  if (!student) return null;
  const remaining = Math.max(0, total - Number(received || 0) - Number(discount || 0));

  const setMod = (kind) => {
    if (kind === 'full')     { setReceived(total); setDiscount(0); }
    if (kind === 'fulldisc') { setReceived(0); setDiscount(total); }
    if (kind === 'partial')  { setReceived(Math.round(total / 2)); setDiscount(Math.round(total / 2)); }
  };

  return (
    <div className="stu-modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="stu-modal" style={{ maxWidth: 620 }}>
        <div className="stu-modal-head">
          <div className="stu-modal-head-title">
            <div className="stu-modal-head-icon" style={{ background: 'linear-gradient(135deg,#D97706,#F59E0B)' }}>
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div>
              <div className="stu-modal-title">Pending Dues</div>
              <div className="stu-modal-sub">{stuFullName(student)} · {student.reg}</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="stu-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
          </Tooltip>
        </div>

        <div className="stu-modal-body">
          {/* Hero outstanding */}
          <div className="stu-dues-hero">
            <div className="stu-dues-hero-lbl">Total Outstanding Amount</div>
            <div className="stu-dues-hero-amt">Rs {total.toLocaleString('en-PK')}</div>
            <div className="stu-dues-hero-note">
              <i className="fa-solid fa-lock"></i> Certificates are blocked until the outstanding balance is cleared.
            </div>
          </div>

          {/* Breakdown */}
          <div className="stu-dues-block">
            <div className="stu-dues-block-h">Fee Heads (Frozen)</div>
            {(student.dues?.heads || []).length === 0 ? (
              <div className="stu-dues-empty">No frozen heads — total settled in advance.</div>
            ) : (student.dues.heads || []).map((h, i) => (
              <div key={i} className="stu-dues-r">
                <span>{h.name}</span>
                <span className="mono">Rs {Number(h.amount || 0).toLocaleString('en-PK')}</span>
              </div>
            ))}
            <div className="stu-dues-meta">
              <span><b>Session:</b> {student.dues?.session || '—'}</span>
              <span><b>Months:</b> {student.dues?.months || '—'}</span>
              <span><b>Admission No:</b> {student.adm || '—'}</span>
            </div>
          </div>

          {/* Quick actions */}
          <div className="stu-dues-quick">
            <button type="button" className="stu-dues-qbtn" onClick={() => setMod('full')}>
              <i className="fa-solid fa-money-bill-wave" style={{ color: '#15803D' }}></i>
              Receive Full Payment
            </button>
            <button type="button" className="stu-dues-qbtn" onClick={() => setMod('fulldisc')}>
              <i className="fa-solid fa-percent" style={{ color: '#7C3AED' }}></i>
              Apply Full Discount
            </button>
            <button type="button" className="stu-dues-qbtn" onClick={() => setMod('partial')}>
              <i className="fa-solid fa-scale-balanced" style={{ color: '#D97706' }}></i>
              Partial + Discount
            </button>
          </div>

          {/* Form */}
          <div className="stu-fgrid stu-fgrid-2" style={{ marginTop: 14 }}>
            <Field label="Amount Received (₨)">
              <input
                className="stu-finput"
                type="number" min="0" max={total}
                value={received}
                onChange={(e) => setReceived(Math.max(0, Math.min(Number(e.target.value) || 0, total)))}
                placeholder="Enter fee received"
              />
            </Field>
            <Field label="Discount (if any) (₨)">
              <input
                className="stu-finput"
                type="number" min="0" max={total}
                value={discount}
                onChange={(e) => setDiscount(Math.max(0, Math.min(Number(e.target.value) || 0, total)))}
                placeholder="Enter discount amount"
              />
            </Field>
            <Field label="Payment Mode">
              <select className="stu-finput" value={mode} onChange={(e) => setMode(e.target.value)}>
                {STU_PAY_MODES.map(m => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Notes / Reference">
              <input className="stu-finput" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Cheque #, bank ref" />
            </Field>
          </div>

          <div className={`stu-dues-remaining${remaining === 0 ? ' settled' : ''}`}>
            <span>Remaining Balance</span>
            <strong>Rs {remaining.toLocaleString('en-PK')}</strong>
          </div>
          <div className="stu-fhelp" style={{ marginTop: 6 }}>
            <i className="fa-solid fa-info-circle"></i> Certificates unlock automatically once the remaining balance reaches zero. A receipt PDF is generated on settlement.
          </div>
        </div>

        <div className="stu-modal-foot">
          <button className="stu-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="stu-btn-primary"
            style={{ background: 'linear-gradient(135deg,#16A34A,#15803D)', boxShadow: '0 4px 14px rgba(22,163,74,.28)' }}
            onClick={() => onSettle({ student, received, discount, mode, notes })}
          >
            <i className="fa-solid fa-receipt"></i> Settle &amp; Generate Receipt
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   REPORT PICKER modal — used for Profile / Admission Form / Class /
   School reports. Colorful/Colorless × PDF/Word picker that drives
   the PDF builder chosen via `cfg.kind`.
   ═══════════════════════════════════════════════════════════════════ */
function StuReportPicker({ cfg, onClose, onConfirm }) {
  const [style, setStyle]   = useState('color');
  const [format, setFormat] = useState('pdf');
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  /* Keyboard nav for the two ARIA radio-groups (matches Modules 2–10). */
  const onStyleKey = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')   { e.preventDefault(); setStyle('color'); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw'); }
  };
  const onFormatKey = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')   { e.preventDefault(); setFormat('pdf'); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setFormat('word'); }
  };
  const label = `Download ${style === 'color' ? 'Colorful' : 'Colorless'} ${format.toUpperCase()}`;
  return (
    <div
      className="stu-modal-overlay open"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="stu-rp-title"
    >
      <div className="stu-modal" style={{ maxWidth: 580 }}>
        <div className="stu-modal-head">
          <div className="stu-modal-head-title">
            <div className="stu-modal-head-icon"><i className="fa-solid fa-file-arrow-down"></i></div>
            <div>
              <div className="stu-modal-title" id="stu-rp-title">{cfg.title}</div>
              <div className="stu-modal-sub">{cfg.sub}</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="stu-modal-close" onClick={onClose} aria-label="Close download dialog"><i className="fa-solid fa-xmark"></i></button>
          </Tooltip>
        </div>
        <div className="stu-modal-body">
          <div className="stu-rp-label" id="stu-rp-style-lbl">Report Style</div>
          <div className="stu-rp-grid" role="radiogroup" aria-labelledby="stu-rp-style-lbl">
            <button
              type="button"
              className={`stu-rp-card${style === 'color' ? ' on' : ''}`}
              onClick={() => setStyle('color')}
              role="radio"
              aria-checked={style === 'color'}
              tabIndex={style === 'color' ? 0 : -1}
              onKeyDown={onStyleKey}
            >
              <div className="stu-rp-preview stu-rp-preview--color" aria-hidden="true">
                <div className="stu-rp-preview-bar" />
                <div className="stu-rp-preview-rows">
                  <div></div><div></div><div></div>
                </div>
                <div className="stu-rp-preview-chips">
                  <span style={{ background: '#1E40AF' }}></span>
                  <span style={{ background: '#16A34A' }}></span>
                  <span style={{ background: '#D97706' }}></span>
                </div>
              </div>
              <div className="stu-rp-card-name">Colorful Report</div>
              <div className="stu-rp-card-desc">School branding, summary cards &amp; status badges</div>
            </button>
            <button
              type="button"
              className={`stu-rp-card${style === 'bw' ? ' on' : ''}`}
              onClick={() => setStyle('bw')}
              role="radio"
              aria-checked={style === 'bw'}
              tabIndex={style === 'bw' ? 0 : -1}
              onKeyDown={onStyleKey}
            >
              <div className="stu-rp-preview stu-rp-preview--bw" aria-hidden="true">
                <div className="stu-rp-preview-bar" />
                <div className="stu-rp-preview-rows">
                  <div></div><div></div><div></div>
                </div>
                <div className="stu-rp-preview-chips">
                  <span style={{ background: 'transparent', border: '1px solid #9CA3AF' }}></span>
                  <span style={{ background: 'transparent', border: '1px solid #9CA3AF' }}></span>
                  <span style={{ background: 'transparent', border: '1px solid #9CA3AF' }}></span>
                </div>
              </div>
              <div className="stu-rp-card-name">Colorless Report</div>
              <div className="stu-rp-card-desc">Low-ink layout — white bg, light borders only</div>
            </button>
          </div>

          <div className="stu-rp-label" id="stu-rp-fmt-lbl" style={{ marginTop: 18 }}>Format</div>
          <div className="stu-rp-fmt-grid" role="radiogroup" aria-labelledby="stu-rp-fmt-lbl">
            <button
              type="button"
              className={`stu-rp-fmt${format === 'pdf' ? ' on' : ''}`}
              onClick={() => setFormat('pdf')}
              role="radio"
              aria-checked={format === 'pdf'}
              tabIndex={format === 'pdf' ? 0 : -1}
              onKeyDown={onFormatKey}
            >
              <div className="stu-rp-fmt-ic" style={{ background: 'rgba(220,38,38,.10)', color: '#DC2626' }} aria-hidden="true">
                <i className="fa-solid fa-file-pdf"></i>
              </div>
              <div>
                <div className="stu-rp-card-name">PDF</div>
                <div className="stu-rp-card-desc">Portable, print-ready</div>
              </div>
            </button>
            <button
              type="button"
              className={`stu-rp-fmt${format === 'word' ? ' on' : ''}`}
              onClick={() => setFormat('word')}
              role="radio"
              aria-checked={format === 'word'}
              tabIndex={format === 'word' ? 0 : -1}
              onKeyDown={onFormatKey}
            >
              <div className="stu-rp-fmt-ic" style={{ background: 'rgba(30,58,138,.10)', color: '#1E40AF' }} aria-hidden="true">
                <i className="fa-brands fa-microsoft"></i>
              </div>
              <div>
                <div className="stu-rp-card-name">Word</div>
                <div className="stu-rp-card-desc">Editable document</div>
              </div>
            </button>
          </div>
        </div>
        <div className="stu-modal-foot">
          <button className="stu-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="stu-btn-primary" onClick={() => onConfirm({ style, format })}>
            <i className="fa-solid fa-download"></i> {label}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SINGLE ID CARD modal — template + theme + session + role + preview.
   ═══════════════════════════════════════════════════════════════════ */
function StuIdCardModal({ student, cls, school, onClose, onDownload }) {
  const [tmpl, setTmpl]   = useState('v');
  const [themeKey, setThemeKey] = useState('blue');
  const [custom, setCustom]   = useState('#2D7DD2');
  const [session, setSession] = useState(school?.session?.replace(/\s+–\s+/, '-') || '2026-2027');
  const [role, setRole]       = useState('Student');
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  if (!student) return null;
  const theme = themeKey === 'custom'
    ? { c1: custom, c2: custom, mid: custom, ink: '#0F172A' }
    : (STU_ID_THEMES.find(t => t.key === themeKey) || STU_ID_THEMES[0]);

  return (
    <div className="stu-modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="stu-modal" style={{ maxWidth: 980 }}>
        <div className="stu-modal-head">
          <div className="stu-modal-head-title">
            <div className="stu-modal-head-icon" style={{ background: `linear-gradient(135deg,${theme.c1},${theme.c2})` }}>
              <i className="fa-solid fa-id-badge"></i>
            </div>
            <div>
              <div className="stu-modal-title">Student ID Card Generator</div>
              <div className="stu-modal-sub">{stuFullName(student)} · {student.reg}</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="stu-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
          </Tooltip>
        </div>
        <div className="stu-modal-body">
          <div className="stu-id-split">
            <div className="stu-id-form">
              <div className="stu-rp-label">Card Template</div>
              <div className="stu-id-tmpl-grid">
                <button type="button" className={`stu-id-tmpl${tmpl === 'v' ? ' on' : ''}`} onClick={() => setTmpl('v')}>
                  <div className="stu-id-tmpl-ic stu-id-tmpl-v" />
                  <div className="stu-id-tmpl-text">
                    <div className="stu-rp-card-name">Vertical</div>
                    <div className="stu-rp-card-desc">Portrait — photo on top</div>
                  </div>
                </button>
                <button type="button" className={`stu-id-tmpl${tmpl === 'h' ? ' on' : ''}`} onClick={() => setTmpl('h')}>
                  <div className="stu-id-tmpl-ic stu-id-tmpl-h" />
                  <div className="stu-id-tmpl-text">
                    <div className="stu-rp-card-name">Horizontal</div>
                    <div className="stu-rp-card-desc">Landscape — photo on left</div>
                  </div>
                </button>
              </div>

              <div className="stu-rp-label" style={{ marginTop: 14 }}>Theme Colour</div>
              <div className="stu-id-swatches">
                {STU_ID_THEMES.map(t => (
                  <Tooltip key={t.key} text={t.name}>
                    <button
                      type="button"
                      className={`stu-id-swatch${themeKey === t.key ? ' on' : ''}`}
                      style={{ background: `linear-gradient(135deg,${t.c1},${t.c2})` }}
                      onClick={() => setThemeKey(t.key)}
                    >
                      {themeKey === t.key && <i className="fa-solid fa-check"></i>}
                    </button>
                  </Tooltip>
                ))}
                <Tooltip text="Custom colour">
                  <label className={`stu-id-swatch stu-id-swatch--custom${themeKey === 'custom' ? ' on' : ''}`}>
                    <input type="color" value={custom} onChange={(e) => { setCustom(e.target.value); setThemeKey('custom'); }} />
                    <i className="fa-solid fa-palette"></i>
                  </label>
                </Tooltip>
              </div>
              <div className="stu-fhelp">Pick any school colour — preview updates instantly.</div>

              <div className="stu-fgrid stu-fgrid-2" style={{ marginTop: 14 }}>
                <Field label="Session / Validity">
                  <input className="stu-finput" value={session} onChange={(e) => setSession(e.target.value)} />
                </Field>
                <Field label="Role / Designation">
                  <input className="stu-finput" value={role} onChange={(e) => setRole(e.target.value)} />
                </Field>
              </div>
              <div className="stu-fhelp" style={{ marginTop: 6 }}>
                Photo, name, father, class, section, reg no, school logo, QR &amp; session are pulled from the student record &amp; school branding.
              </div>
            </div>

            <div className="stu-id-preview">
              <div className="stu-rp-label"><i className="fa-solid fa-eye"></i> Live Preview <span style={{ color: 'var(--text-muted)', fontWeight: 700, marginLeft: 6 }}>· Front &amp; Back</span></div>
              <div className="stu-id-cardwrap stu-id-cardwrap--pair">
                <StuIdCardPreview student={student} cls={cls} school={school} template={tmpl} theme={theme} session={session} role={role} face="front" />
                <StuIdCardPreview student={student} cls={cls} school={school} template={tmpl} theme={theme} session={session} role={role} face="back" />
              </div>
            </div>
          </div>
        </div>
        <div className="stu-modal-foot">
          <button className="stu-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="stu-btn-primary" onClick={() => onDownload(tmpl, theme, session, role)}>
            <i className="fa-solid fa-download"></i> Generate &amp; Download
          </button>
        </div>
      </div>
    </div>
  );
}

/* Live preview card (CSS-only, no SVG). `face` toggles front / back. */
function StuIdCardPreview({ student: s, cls, school, template, theme, session, role, face = 'front' }) {
  const isV = template === 'v';
  const isBack = face === 'back';
  return (
    <div className={`stu-id-card-prv stu-id-card-prv--${isV ? 'v' : 'h'}`}>
      <div className="stu-id-card-top" style={{ background: `linear-gradient(135deg,${theme.c1},${theme.c2})` }}>
        <div className="stu-id-card-school">{school?.name || 'School'}</div>
        <div className="stu-id-card-face">{isBack ? 'Back' : 'Front'}</div>
      </div>
      {isBack ? (
        <div className="stu-id-card-back">
          <div className="stu-id-card-qr">
            {/* Asli QR — student id encode hota hai (pehle sirf CSS mock tha). */}
            <div className="stu-id-card-qr-mock" style={{ borderColor: theme.c1 }}
              dangerouslySetInnerHTML={{ __html: stuQrSVG(stuQrValue(s)) }} />
            <div className="stu-id-card-qr-text">
              <div className="stu-id-card-qr-lbl">Scan to verify</div>
              <div className="stu-id-card-qr-reg" style={{ color: theme.c1 }}>{s.reg}</div>
            </div>
          </div>
          <div className="stu-id-card-back-rows">
            <div><span>Guardian</span><b>{s.father || '—'}</b></div>
            <div><span>Mobile</span><b style={{ fontFamily: 'ui-monospace,monospace' }}>{s.mobile || '—'}</b></div>
            <div><span>D.O.B.</span><b>{stuFmtDate(s.dob)}</b></div>
            <div><span>Blood Grp</span><b>—</b></div>
            <div><span>Adm No</span><b style={{ fontFamily: 'ui-monospace,monospace' }}>{s.adm || '—'}</b></div>
          </div>
          <div className="stu-id-card-school-addr">
            {school?.address && <div>{school.address}</div>}
            {school?.phone && <div>☎ {school.phone}</div>}
          </div>
        </div>
      ) : (
        <div className="stu-id-card-body">
          <div className="stu-id-card-photo" style={{ background: `${theme.c1}1F`, color: theme.c1, borderColor: `${theme.c1}33` }}>
            {s.photo ? <img src={s.photo} alt={stuFullName(s)} /> : stuInitials(s)}
          </div>
          <div className="stu-id-card-info">
            <div className="stu-id-card-name" style={{ color: theme.ink }}>{stuFullName(s)}</div>
            <div className="stu-id-card-kv">
              <span>Class</span><b>{cls?.cls} · {cls?.sec}</b>
              <span>Reg No</span><b style={{ color: theme.c1, fontFamily: 'ui-monospace,monospace' }}>{s.reg}</b>
              <span>Father</span><b>{s.father || '—'}</b>
              <span>Role</span><b>{role}</b>
              <span>Session</span><b>{session}</b>
            </div>
          </div>
        </div>
      )}
      <div className="stu-id-card-foot" style={{ background: theme.c1 }}>
        {isBack ? `Property of ${school?.name || 'School'} — return if found.` : 'If found, please return to the school office.'}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   BULK ID CARD modal — class-wide multi-select + preview + A4 sheet.
   ═══════════════════════════════════════════════════════════════════ */
function StuBulkIdModal({ cls, school, onClose, onDownload }) {
  const [tmpl, setTmpl] = useState('v');
  const [themeKey, setThemeKey] = useState('blue');
  const [custom, setCustom] = useState('#2D7DD2');
  const [session, setSession] = useState('2026-2027');
  /* Selection is keyed on the DB id — reg no can be blank on freshly added
     students, which would make them share a single checkbox. */
  const [selected, setSelected] = useState(() => {
    const out = {};
    (cls?.students || []).forEach(s => { out[s._id] = true; });
    return out;
  });
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  if (!cls) return null;
  const theme = themeKey === 'custom'
    ? { c1: custom, c2: custom, mid: custom, ink: '#0F172A' }
    : (STU_ID_THEMES.find(t => t.key === themeKey) || STU_ID_THEMES[0]);
  const allOn = cls.students.length > 0 && cls.students.every(s => selected[s._id]);
  const toggleAll = (v) => {
    const next = {}; cls.students.forEach(s => { next[s._id] = v; }); setSelected(next);
  };
  const selectedIds = cls.students.filter(s => selected[s._id]).map(s => s._id);
  const count = selectedIds.length;
  const previewStudents = cls.students.filter(s => selected[s._id]).slice(0, 4);

  return (
    <div className="stu-modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="stu-modal stu-gen-modal" style={{ maxWidth: 1100 }}>
        <div className="stu-modal-head">
          <div className="stu-modal-head-title">
            <div className="stu-modal-head-icon">
              <i className="fa-solid fa-id-card"></i>
            </div>
            <div>
              <div className="stu-modal-title">Class ID Card Generator</div>
              <div className="stu-modal-sub">{cls.cls} ({cls.sec}) · Select students &amp; download as a print sheet</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="stu-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
          </Tooltip>
        </div>
        <div className="stu-gen-body">
          {/* LEFT: settings */}
          <div className="stu-gen-settings">
            <div className="stu-rp-label">Card Format</div>
            <div className="stu-certtype-row">
              <button type="button" className={`stu-certtype${tmpl === 'v' ? ' active' : ''}`} onClick={() => setTmpl('v')}>
                <i className="fa-solid fa-id-badge"></i> Vertical
              </button>
              <button type="button" className={`stu-certtype${tmpl === 'h' ? ' active' : ''}`} onClick={() => setTmpl('h')}>
                <i className="fa-solid fa-id-card"></i> Horizontal
              </button>
            </div>

            <div className="stu-rp-label" style={{ marginTop: 14 }}>Theme Colour</div>
            <div className="stu-swatches">
              {STU_ID_THEMES.map(t => (
                <Tooltip key={t.key} text={t.name}>
                  <div
                    className={`stu-swatch${themeKey === t.key ? ' sel' : ''}`}
                    style={{ background: `linear-gradient(135deg,${t.c1},${t.c2})` }}
                    onClick={() => setThemeKey(t.key)}
                  />
                </Tooltip>
              ))}
            </div>

            <div className="stu-fg" style={{ marginTop: 10 }}>
              <label className="stu-flabel">Custom Colour</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="color"
                  value={custom}
                  onChange={(e) => { setCustom(e.target.value); setThemeKey('custom'); }}
                  style={{ width: 46, height: 40, border: '1.5px solid var(--border-light)', borderRadius: 10, background: 'var(--input-bg)', cursor: 'pointer', padding: 2 }}
                />
                <span className="stu-fhelp">Pick any school colour.</span>
              </div>
            </div>

            <div className="stu-rp-label" style={{ marginTop: 14 }}>Session / Validity</div>
            <div className="stu-fg">
              <input className="stu-finput" value={session} onChange={(e) => setSession(e.target.value)} />
            </div>

            <div className="stu-rp-label stu-bulk-students-lbl" style={{ marginTop: 14 }}>
              <span>Students <span className="stu-bulk-count">({count} selected)</span></span>
              <label className="stu-bulk-selall">
                <input type="checkbox" checked={allOn} onChange={(e) => toggleAll(e.target.checked)} /> Select all
              </label>
            </div>
            <div className="stu-bulk-list">
              {cls.students.length === 0 ? (
                <div className="stu-sr-empty">No students in this class.</div>
              ) : cls.students.map((s, i) => (
                <label key={s._id ?? `idx-${i}`} className="stu-bulk-item">
                  <input
                    type="checkbox"
                    className="stu-pchk"
                    checked={!!selected[s._id]}
                    onChange={() => setSelected(p => ({ ...p, [s._id]: !p[s._id] }))}
                  />
                  <span className="stu-bulk-av">
                    {s.photo ? <img src={s.photo} alt="" /> : stuInitials(s)}
                  </span>
                  <span className="stu-bulk-info">
                    <span className="stu-bulk-name">{stuFullName(s)}</span>
                    <span className="stu-bulk-meta">{s.reg} · Father: {s.father || '—'}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* RIGHT: live preview */}
          <div className="stu-gen-preview">
            <div className="stu-gen-prev-label"><i className="fa-solid fa-eye"></i> Preview (first 4 cards)</div>
            <div className="stu-bigprev" key={refreshTick}>
              {previewStudents.length === 0 ? (
                <div className="stu-sr-empty" style={{ padding: 40 }}>Select at least one student to preview.</div>
              ) : (
                <>
                  <div className="stu-bulk-prevgrid">
                    {previewStudents.map((s, i) => (
                      <div key={s._id ?? `idx-${i}`} className="stu-bulk-prevcard">
                        <div className="stu-bulk-prevcard-stack">
                          <StuIdCardPreview student={s} cls={cls} school={school} template={tmpl} theme={theme} session={session} role="Student" face="front" />
                          <StuIdCardPreview student={s} cls={cls} school={school} template={tmpl} theme={theme} session={session} role="Student" face="back" />
                        </div>
                      </div>
                    ))}
                  </div>
                  {count > 4 && (
                    <div className="stu-sr-empty">+ {count - 4} more card{count - 4 === 1 ? '' : 's'} will be included in the PDF.</div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="stu-modal-foot">
          <button className="stu-btn stu-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="stu-btn stu-btn-ghost" onClick={() => setRefreshTick(t => t + 1)}>
            <i className="fa-solid fa-rotate"></i> Refresh Preview
          </button>
          <button
            className="stu-btn stu-btn-primary"
            disabled={count === 0}
            onClick={() => onDownload(selectedIds, tmpl, theme, session)}
          >
            <i className="fa-solid fa-download"></i> Generate &amp; Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CERTIFICATE modal — 4 types, type-specific conditional fields,
   signatures, style toggle (color/BW), live preview.
   ═══════════════════════════════════════════════════════════════════ */
function StuCertModal({ cfg, student, cls, school, onClose, onDownload }) {
  const [type, setType] = useState(cfg.type || 'appreciation');
  const def = STU_CERT_DEFAULTS[type] || STU_CERT_DEFAULTS.appreciation;
  const [title, setTitle] = useState(def.title);
  const [body, setBody]   = useState(def.body);
  const [date, setDate]   = useState(new Date().toISOString().slice(0, 10));
  const [style, setStyle] = useState('color');
  const [leavingDate, setLeavingDate] = useState('');
  const [promFrom, setPromFrom] = useState('');
  const [promTo, setPromTo]     = useState('');
  const [promSession, setPromSession] = useState(school?.session?.replace(/\s+–\s+/, '-') || '2026-2027');
  const [sigPrincipal, setSigPrincipal] = useState(true);
  const [sigDirector, setSigDirector]   = useState(false);
  const [sigTeacher, setSigTeacher]     = useState(false);
  const [namePrincipal, setNamePrincipal] = useState('Principal');
  const [nameDirector, setNameDirector]   = useState('Mr. Imran Saleem');
  const [nameTeacher, setNameTeacher]     = useState('Class Teacher');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  /* Auto-fill signatures from real staff: Principal = the branch's principal
     (isPrinciple); Class Teacher = the teacher assigned to this class/section. */
  useEffect(() => {
    let alive = true;
    studentService.getStuStaff().then(staff => {
      if (!alive || !Array.isArray(staff)) return;
      const principal = staff.find(s => s.isPrinciple)
        || staff.find(s => /principal/i.test(s.designation || ''));
      if (principal?.name) setNamePrincipal(principal.name);

      const gid = String(cls?._gradeId ?? '');
      const sid = String(cls?._sectionId ?? '');
      if (gid && sid) {
        const matches = (s) => s.assignments.some(a => String(a.gradeId) === gid && String(a.sectionId) === sid);
        const teacher = staff.find(s => s.isTeacher && matches(s)) || staff.find(s => !s.isPrinciple && matches(s));
        if (teacher?.name) { setNameTeacher(teacher.name); setSigTeacher(true); }
      }
    }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Reset title/body when type switches */
  useEffect(() => {
    const d = STU_CERT_DEFAULTS[type] || STU_CERT_DEFAULTS.appreciation;
    setTitle(d.title); setBody(d.body);
  }, [type]);

  if (!student) return null;

  const opts = {
    title, body, date, leavingDate, promFrom, promTo, promSession,
    sigPrincipal, sigDirector, sigTeacher,
    namePrincipal, nameDirector, nameTeacher,
  };

  return (
    <div className="stu-modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="stu-modal" style={{ maxWidth: 1040 }}>
        <div className="stu-modal-head">
          <div className="stu-modal-head-title">
            <div className="stu-modal-head-icon" style={{ background: 'linear-gradient(135deg,#D97706,#F59E0B)' }}>
              <i className={`fa-solid ${def.icon}`}></i>
            </div>
            <div>
              <div className="stu-modal-title">Certificate Generator</div>
              <div className="stu-modal-sub">{stuFullName(student)} · {cls?.cls} ({cls?.sec})</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="stu-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
          </Tooltip>
        </div>
        <div className="stu-modal-body">
          <div className="stu-id-split">
            <div className="stu-id-form">
              <div className="stu-rp-label">Certificate Type</div>
              <div className="stu-cert-types">
                {Object.entries(STU_CERT_DEFAULTS).map(([k, v]) => (
                  <button key={k} type="button" className={`stu-cert-type${type === k ? ' on' : ''}`} onClick={() => setType(k)}>
                    <i className={`fa-solid ${v.icon}`}></i> {v.title.replace(/Certificate( of)?\s*/i, '').trim() || 'Promotion'}
                  </button>
                ))}
              </div>

              <div className="stu-fgrid stu-fgrid-2" style={{ marginTop: 14 }}>
                <Field label="Student Name">
                  <input className="stu-finput" value={stuFullName(student)} readOnly />
                </Field>
                <Field label="Issue Date">
                  <input className="stu-finput" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
                <Field label="Certificate Title" wide>
                  <input className="stu-finput" value={title} onChange={(e) => setTitle(e.target.value)} />
                </Field>
              </div>

              {type === 'leaving' && (
                <Field label="Leaving Date">
                  <input className="stu-finput" type="date" value={leavingDate} onChange={(e) => setLeavingDate(e.target.value)} />
                </Field>
              )}
              {type === 'promotion' && (
                <div className="stu-fgrid stu-fgrid-3" style={{ marginTop: 10 }}>
                  <Field label="Promoted From (Class)">
                    <input className="stu-finput" value={promFrom} onChange={(e) => setPromFrom(e.target.value)} placeholder="e.g. 3" />
                  </Field>
                  <Field label="Promoted To (Class)">
                    <input className="stu-finput" value={promTo} onChange={(e) => setPromTo(e.target.value)} placeholder="e.g. 4" />
                  </Field>
                  <Field label="Academic Session">
                    <input className="stu-finput" value={promSession} onChange={(e) => setPromSession(e.target.value)} placeholder="2026-2027" />
                  </Field>
                </div>
              )}

              <Field label={type === 'promotion' ? 'Promotion Text (optional)' : 'Description / Content'}>
                <textarea
                  className="stu-finput"
                  style={{ height: 80, padding: '10px 12px', resize: 'vertical' }}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Body text printed on the certificate"
                />
              </Field>

              <div className="stu-rp-label" style={{ marginTop: 14 }}>Signatures</div>
              <div className="stu-cert-sigs">
                <label className="stu-checkrow">
                  <input type="checkbox" checked={sigPrincipal} onChange={(e) => setSigPrincipal(e.target.checked)} />
                  <span>Principal</span>
                </label>
                <label className="stu-checkrow">
                  <input type="checkbox" checked={sigDirector} onChange={(e) => setSigDirector(e.target.checked)} />
                  <span>Director</span>
                </label>
                <label className="stu-checkrow">
                  <input type="checkbox" checked={sigTeacher} onChange={(e) => setSigTeacher(e.target.checked)} />
                  <span>Class Teacher</span>
                </label>
              </div>
              <div className="stu-fgrid stu-fgrid-3" style={{ marginTop: 10 }}>
                {sigPrincipal && (
                  <Field label="Principal Name">
                    <input className="stu-finput" value={namePrincipal} onChange={(e) => setNamePrincipal(e.target.value)} />
                  </Field>
                )}
                {sigDirector && (
                  <Field label="Director Name">
                    <input className="stu-finput" value={nameDirector} onChange={(e) => setNameDirector(e.target.value)} />
                  </Field>
                )}
                {sigTeacher && (
                  <Field label="Teacher Name">
                    <input className="stu-finput" value={nameTeacher} onChange={(e) => setNameTeacher(e.target.value)} />
                  </Field>
                )}
              </div>

              <div className="stu-rp-label" id="stu-cert-style-lbl" style={{ marginTop: 14 }}>Print Style</div>
              <div className="stu-cert-style" role="radiogroup" aria-labelledby="stu-cert-style-lbl">
                <button
                  type="button"
                  className={`stu-cert-style-btn${style === 'color' ? ' on' : ''}`}
                  onClick={() => setStyle('color')}
                  role="radio"
                  aria-checked={style === 'color'}
                  tabIndex={style === 'color' ? 0 : -1}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')   { e.preventDefault(); setStyle('color'); }
                    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw'); }
                  }}
                >
                  <span className="stu-cert-style-dot" style={{ background: 'linear-gradient(135deg,#1E40AF,#D97706,#22D3EE)' }} aria-hidden="true" />
                  <div>
                    <div className="stu-rp-card-name">Colorful Report</div>
                    <div className="stu-rp-card-desc">Blue, teal &amp; gold</div>
                  </div>
                </button>
                <button
                  type="button"
                  className={`stu-cert-style-btn${style === 'bw' ? ' on' : ''}`}
                  onClick={() => setStyle('bw')}
                  role="radio"
                  aria-checked={style === 'bw'}
                  tabIndex={style === 'bw' ? 0 : -1}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')   { e.preventDefault(); setStyle('color'); }
                    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw'); }
                  }}
                >
                  <span className="stu-cert-style-dot" style={{ background: 'linear-gradient(135deg,#1F2937,#94A3B8)' }} aria-hidden="true" />
                  <div>
                    <div className="stu-rp-card-name">Colorless Report</div>
                    <div className="stu-rp-card-desc">Low-ink, ink-saving</div>
                  </div>
                </button>
              </div>
            </div>

            <div className="stu-id-preview">
              <div className="stu-rp-label"><i className="fa-solid fa-eye"></i> Live Preview</div>
              <StuCertPreview student={student} cls={cls} school={school} type={type} style={style} opts={opts} />
            </div>
          </div>
        </div>
        <div className="stu-modal-foot">
          <button className="stu-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="stu-btn-primary"
            style={{ background: 'linear-gradient(135deg,#D97706,#B45309)', boxShadow: '0 4px 14px rgba(217,119,6,.28)' }}
            onClick={() => onDownload(style, opts)}
          >
            <i className="fa-solid fa-download"></i> Generate &amp; Download
          </button>
        </div>
      </div>
    </div>
  );
}

/* Cert live preview — mirrors HTML reference design */
function StuCertPreview({ student: s, cls, school, type, style, opts }) {
  const isBW = style === 'bw';
  const today = (opts.date ? new Date(opts.date + 'T00:00:00') : new Date())
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const titleMap = {
    character:    'Certificate of Good Character & Conduct',
    leaving:      'Certificate of Completion & Clearance',
    promotion:    'Certificate of Academic Promotion',
    appreciation: 'In Recognition of Excellence',
  };
  const titleSub = titleMap[type] || titleMap.appreciation;
  const clsSec   = `${cls?.cls || '—'} – ${cls?.sec || '—'}`;
  const fullName = stuFullName(s);
  const customBody = (opts.body || '').trim();
  let bodyText;
  if (type === 'character') {
    bodyText = customBody
      ? `This is to certify that ${fullName} of Class ${clsSec}, ${school?.name || 'School'}. ${customBody}`
      : `This is to certify that ${fullName} was a student of Class ${clsSec} at ${school?.name || 'School'}, displaying excellent character, discipline, and moral conduct.`;
  } else if (type === 'leaving') {
    bodyText = customBody
      || `This is to certify that ${fullName} was a student of Class ${clsSec} at ${school?.name || 'School'} and has no pending matters.`;
  } else if (type === 'promotion') {
    const fromCls = opts.promFrom || cls?.cls || '—';
    const toCls   = opts.promTo   || '—';
    const session = opts.promSession || school?.session || '—';
    bodyText = customBody
      ? `This is to certify that ${fullName} ${customBody}`
      : `This is to certify that ${fullName} has successfully completed Class ${fromCls} and is hereby promoted to Class ${toCls} for ${session}.`;
  } else {
    bodyText = `This certificate is proudly presented to ${fullName} of Class ${clsSec}, ${school?.name || 'School'}. ` + (customBody || 'In recognition of outstanding performance and conduct.');
  }
  if (bodyText.length > 220) bodyText = bodyText.slice(0, 220) + '…';

  const sigs = [];
  const pOn = opts.sigPrincipal === undefined ? true : !!opts.sigPrincipal;
  if (pOn)              sigs.push({ name: opts.namePrincipal || 'Principal',    role: 'Principal' });
  if (opts.sigDirector) sigs.push({ name: opts.nameDirector  || 'Director',      role: 'Director' });
  if (opts.sigTeacher)  sigs.push({ name: opts.nameTeacher   || 'Class Teacher', role: 'Class Teacher' });
  if (!sigs.length)     sigs.push({ name: opts.namePrincipal || 'Principal',    role: 'Principal' });

  return (
    <div className={`stu-cert-prv${isBW ? ' stu-cert-prv--bw' : ''}`}>
      {/* Decorative frame + 4 corners */}
      <div className="stu-cert-prv-frame" />
      <div className="stu-cert-prv-corner stu-cert-prv-corner--tl" />
      <div className="stu-cert-prv-corner stu-cert-prv-corner--tr" />
      <div className="stu-cert-prv-corner stu-cert-prv-corner--bl" />
      <div className="stu-cert-prv-corner stu-cert-prv-corner--br" />

      {/* Header (blue gradient) */}
      <div className="stu-cert-prv-head">
        <div className="stu-cert-prv-logo">
          {school?.logo ? (
            <img src={school.logo} alt="logo" style={{ width: 28, height: 28, objectFit: 'contain' }} />
          ) : (
            <svg width="28" height="28" viewBox="0 0 64 64" fill="none">
              <polygon points="32,10 60,24 32,32 4,24" fill="#1ABCCD" />
              <rect x="14" y="36" width="36" height="18" rx="5" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
            </svg>
          )}
        </div>
        <div className="stu-cert-prv-head-text">
          <div className="stu-cert-prv-school">{school?.name || 'School'}</div>
          <div className="stu-cert-prv-campus">{school?.campus || 'Main Campus'}</div>
        </div>
        <div className="stu-cert-prv-meta">
          <div>Generated</div>
          <strong>{today}</strong>
        </div>
        <div className="stu-cert-prv-ribbon" />
      </div>

      {/* Title block */}
      <div className="stu-cert-prv-titlewrap">
        <div className="stu-cert-prv-badge">
          <span className="stu-cert-prv-badgeline" />
          <span className="stu-cert-prv-badgeic">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </span>
          <span className="stu-cert-prv-badgeline stu-cert-prv-badgeline--r" />
        </div>
        <div className="stu-cert-prv-title">{opts.title || titleMap[type] || 'Certificate'}</div>
        <div className="stu-cert-prv-sub">{titleSub}</div>
      </div>

      {/* Ornament divider */}
      <div className="stu-cert-prv-orn">
        <span className="stu-cert-prv-orn-line" />
        <span className="stu-cert-prv-orn-dot" />
        <span className="stu-cert-prv-orn-diamond" />
        <span className="stu-cert-prv-orn-dot" />
        <span className="stu-cert-prv-orn-line" />
      </div>

      {/* Body */}
      <div className="stu-cert-prv-body">
        {(type === 'leaving' || type === 'promotion') && (
          <div className="stu-cert-prv-infotbl">
            {type === 'leaving' ? (
              <>
                <div className="stu-cert-prv-inforow"><span>Student Name</span><b>{fullName}</b></div>
                <div className="stu-cert-prv-inforow"><span>Class / Section</span><b>{clsSec}</b></div>
                <div className="stu-cert-prv-inforow"><span>Reg No</span><b>{s.reg || '—'}</b></div>
                <div className="stu-cert-prv-inforow"><span>Leaving Date</span><b>{opts.leavingDate ? stuFmtDate(opts.leavingDate) : today}</b></div>
              </>
            ) : (
              <>
                <div className="stu-cert-prv-inforow"><span>Student Name</span><b>{fullName}</b></div>
                <div className="stu-cert-prv-inforow"><span>Promoted From</span><b>Class {opts.promFrom || cls?.cls || '—'}</b></div>
                <div className="stu-cert-prv-inforow"><span>Promoted To</span><b>Class {opts.promTo || '—'}</b></div>
                <div className="stu-cert-prv-inforow"><span>Session</span><b>{opts.promSession || school?.session || '—'}</b></div>
              </>
            )}
          </div>
        )}
        <p className="stu-cert-prv-text">{bodyText}</p>
      </div>

      {/* Signatures + seal */}
      <div className="stu-cert-prv-sigrow">
        {(() => {
          const blocks = sigs.map((g, idx) => (
            <div key={idx} className="stu-cert-prv-sig">
              <div className="stu-cert-prv-sigline" />
              <div className="stu-cert-prv-signame">{g.name}</div>
              <div className="stu-cert-prv-sigrole">{g.role}</div>
            </div>
          ));
          const seal = (
            <div key="seal" className="stu-cert-prv-seal">
              <span className="stu-cert-prv-seal-text">{(school?.name || 'School').split(' ')[0]} Seal</span>
            </div>
          );
          if (blocks.length === 1) return [...blocks, seal];
          const mid = Math.ceil(blocks.length / 2);
          return [...blocks.slice(0, mid), seal, ...blocks.slice(mid)];
        })()}
      </div>

      {/* Footer */}
      <div className="stu-cert-prv-foot">
        <div className="stu-cert-prv-foot-item">
          <i className="fa-solid fa-location-dot" />
          <span><strong>Address: </strong>{school?.address || '—'}</span>
        </div>
        <div className="stu-cert-prv-foot-item">
          <i className="fa-solid fa-phone" />
          <span><strong>Contact: </strong>{school?.phone || '—'}</span>
        </div>
        <div className="stu-cert-prv-foot-item">
          <i className="fa-solid fa-stamp" />
          <span><strong>Powered by </strong>School Mentor®</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ADD STUDENT TO FAMILY TREE modal — pick from filterable family list,
   set relationship. Inline "create new family" stub.
   ═══════════════════════════════════════════════════════════════════ */
function StuAddToFamilyModal({ student, cls, families, setFamilies, onClose, onConfirm }) {
  const [filter, setFilter] = useState('');
  const [familyId, setFamilyId] = useState(student?.family || '');
  const [relationship, setRelationship] = useState('Sibling');
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGuardian, setNewGuardian] = useState(student?.father || '');
  const [newContact, setNewContact] = useState(student?.mobile || '');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  const visible = families.filter(f => `${f.name} ${f.guardian || ''}`.toLowerCase().includes(filter.toLowerCase()));

  /* Keep a valid family selected. A lone listbox option is pre-highlighted by
     the browser but fires no onChange, so familyId would stay '' and the button
     stay disabled — default to the first visible family whenever the current
     selection isn't in the visible list. */
  useEffect(() => {
    if (familyId && visible.some(f => f.id === familyId)) return;
    if (visible.length > 0) setFamilyId(visible[0].id);
  }, [filter, families]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!student) return null;

  const sx = student.gender === 'Female' ? 'd/o' : 's/o';

  const createFamily = () => {
    if (!newName.trim()) { return; }
    const id = `fam-${Date.now()}`;
    const fam = { id, name: newName.trim(), guardian: newGuardian.trim(), contact: newContact.trim(), email: '', details: '', created: new Date().toISOString().slice(0, 10) };
    setFamilies(prev => [...(prev || []), fam]);
    setFamilyId(id);
    setCreating(false);
    setNewName('');
  };

  return (
    <div className="stu-modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="stu-modal" style={{ maxWidth: 560 }}>
        <div className="stu-modal-head">
          <div className="stu-modal-head-title">
            <div className="stu-modal-head-icon" style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}>
              <i className="fa-solid fa-link"></i>
            </div>
            <div>
              <div className="stu-modal-title">Add <strong>{stuFullName(student)}</strong> {sx} <strong>{student.father || '—'}</strong> to Family Tree</div>
              <div className="stu-modal-sub">{cls?.cls} ({cls?.sec}) · Link to a sibling group</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="stu-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
          </Tooltip>
        </div>
        <div className="stu-modal-body">
          {creating ? (
            <div className="stu-fgrid">
              <Field label="Family Name *">
                <input className="stu-finput" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. The Khan Family" />
              </Field>
              <Field label="Parent / Guardian Name">
                <input className="stu-finput" value={newGuardian} onChange={(e) => setNewGuardian(e.target.value)} />
              </Field>
              <Field label="Contact Number">
                <input className="stu-finput" value={newContact} onChange={(e) => setNewContact(e.target.value)} />
              </Field>
              <button type="button" className="stu-btn-link" onClick={() => setCreating(false)}>
                <i className="fa-solid fa-arrow-left"></i> Back to family list
              </button>
            </div>
          ) : families.length === 0 ? (
            <div className="stu-empty">
              <div className="stu-empty-ic"><i className="fa-solid fa-people-roof"></i></div>
              <div className="stu-empty-title">No family trees exist yet</div>
              <div className="stu-empty-sub">Create one to link this student.</div>
              <button className="stu-btn-secondary" style={{ marginTop: 12 }} onClick={() => setCreating(true)}>
                <i className="fa-solid fa-plus"></i> Create new family
              </button>
            </div>
          ) : (
            <>
              <Field label="Filter">
                <input className="stu-finput" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Type to filter families…" />
              </Field>
              <div className="stu-fg" style={{ marginTop: 10 }}>
                <label className="stu-flabel">Select Family</label>
                <select
                  className="stu-finput"
                  size="6"
                  value={familyId}
                  onChange={(e) => setFamilyId(e.target.value)}
                  style={{ height: 'auto', padding: 6 }}
                >
                  {visible.map(f => (
                    <option key={f.id} value={f.id}>{f.name}{f.guardian ? ` — ${f.guardian}` : ''}</option>
                  ))}
                </select>
              </div>
              <Field label="Relationship" wide>
                <input className="stu-finput" value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="e.g. Sibling, Brother, Sister" />
              </Field>
              <div className="stu-fhelp" style={{ marginTop: 10 }}>
                Don't see the right family? <button type="button" className="stu-btn-link" style={{ padding: 0 }} onClick={() => setCreating(true)}>Create a new family tree</button>
              </div>
            </>
          )}
        </div>
        <div className="stu-modal-foot">
          <button className="stu-btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          {creating ? (
            <button className="stu-btn-primary" onClick={createFamily}>
              <i className="fa-solid fa-plus"></i> Create &amp; Select
            </button>
          ) : (
            <button
              className="stu-btn-primary"
              style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', boxShadow: '0 4px 14px rgba(124,58,237,.28)' }}
              onClick={async () => {
                if (submitting) return;
                setSubmitting(true);
                try { await onConfirm({ familyId, relationship }); }
                finally { setSubmitting(false); }
              }}
              disabled={!familyId || submitting}
            >
              {submitting
                ? (<><i className="fa-solid fa-spinner fa-spin"></i> Adding…</>)
                : (<><i className="fa-solid fa-link"></i> Add to Family</>)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FAMILY TREE A4 PDF — families summary + per-family member list.
   ═══════════════════════════════════════════════════════════════════ */
function buildStuFamilyReportHTML(families, classes, school) {
  const color = '#1E3A8A';
  /* Members come embedded on each family (from get-…→students[], mirroring the
     on-screen list). Fall back to resolving from class data only when a record
     lacks an embedded members[] — same rule the UI's `enriched` uses. */
  const memberOf = (fam) => {
    if (Array.isArray(fam.members)) return fam.members;
    const out = [];
    classes.forEach(c => c.students.forEach(s => {
      if (s.family === fam.id) out.push({ ...s, _cls: c.cls, _sec: c.sec });
    }));
    return out;
  };
  const totalFams    = families.length;
  const totalMembers = families.reduce((a, f) => a + memberOf(f).length, 0);
  const sections = families.map((f, i) => {
    const mems = memberOf(f);
    return `
      <div class="sec-band"><span>${i + 1}. ${stuEsc(f.name)}</span><small>${mems.length} member(s)</small></div>
      <div class="kvgrid">
        <div><div class="kv-l">Guardian</div><div class="kv-v">${stuEsc(f.guardian || '—')}</div></div>
        <div><div class="kv-l">Contact</div><div class="kv-v">${stuEsc(f.contact || '—')}</div></div>
        ${f.email ? `<div><div class="kv-l">Email</div><div class="kv-v">${stuEsc(f.email)}</div></div>` : ''}
        <div><div class="kv-l">Created</div><div class="kv-v">${stuFmtDate(f.created)}</div></div>
        ${f.details ? `<div class="kv-full"><div class="kv-l">Details</div><div class="kv-v">${stuEsc(f.details)}</div></div>` : ''}
      </div>
      ${mems.length === 0 ? `<div class="empty">No students linked yet.</div>` : `
        <table class="tbl">
          <thead><tr><th class="c" style="width:28px">#</th><th style="width:90px">Reg No</th><th>Name</th><th style="width:130px">Class · Section</th><th>Relationship</th><th>Father</th></tr></thead>
          <tbody>${mems.map((m, k) => `<tr><td class="c">${k + 1}</td><td class="mono">${stuEsc(m.reg)}</td><td><b>${stuEsc(stuFullName(m))}</b></td><td>${stuEsc(m._cls)} · ${stuEsc(m._sec)}</td><td>${stuEsc(m._famRel || 'Sibling')}</td><td>${stuEsc(m.father || '—')}</td></tr>`).join('')}</tbody>
        </table>`}
    `;
  }).join('');
  return `
    <style>
      *{box-sizing:border-box;margin:0;padding:0;font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif}
      html,body{background:#F1F3F8}body{padding:18px 0;font-size:10.5px}
      .page{width:210mm;min-height:297mm;margin:0 auto;padding:14mm;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,.12)}
      .rhead{display:flex;align-items:center;gap:14px;border-bottom:2px solid ${color};padding-bottom:10px;margin-bottom:14px}
      .rlogo{width:46px;height:46px;flex-shrink:0}
      .rname{font-size:17px;font-weight:800;color:#0F172A}
      .rtitle{font-size:12px;font-weight:700;color:${color};margin-top:3px}
      .meta{margin-left:auto;font-size:9.5px;color:#64748B;text-align:right;line-height:1.55}
      .kpi-row{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:14px}
      .kpi{border:1px solid #E5E7EB;border-radius:8px;padding:10px 12px;background:#F8FAFF;position:relative;overflow:hidden}
      .kpi::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:${color}}
      .kpi .l{font-size:9px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.3px}
      .kpi .v{font-size:18px;font-weight:800;color:#0F172A;margin-top:2px}
      .sec-band{background:${color};color:#fff;padding:6px 13px;border-radius:6px;font-weight:800;font-size:11.5px;margin:14px 0 8px;display:flex;justify-content:space-between;align-items:center}
      .sec-band small{font-size:10px;opacity:.85;font-weight:700}
      .kvgrid{display:grid;grid-template-columns:1fr 1fr;gap:7px 16px;padding:11px 14px;border:1px solid #E5E7EB;border-radius:8px;background:#F8FAFF;margin-bottom:9px}
      .kv-l{font-size:9.5px;font-weight:800;color:${color};text-transform:uppercase;letter-spacing:.3px}
      .kv-v{font-size:11.5px;color:#0F172A;font-weight:700;margin-top:1px}
      .kv-full{grid-column:1/-1}
      .tbl{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;font-size:10.5px;margin-bottom:6px}
      .tbl thead th{background:${color};color:#fff;padding:7px 9px;text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.3px;font-weight:800}
      .tbl th.c,.tbl td.c{text-align:center}
      .tbl td{padding:7px 9px;border-bottom:1px solid #F1F3F8;vertical-align:top}
      .tbl tbody tr:nth-child(even) td{background:#FBFCFF}
      .mono{font-family:ui-monospace,Menlo,monospace;color:${color};font-weight:800}
      .empty{padding:16px;text-align:center;color:#94A3B8;font-style:italic;border:1px dashed #CBD5E1;border-radius:8px;margin-bottom:6px}
      .rfoot{margin-top:14px;text-align:center;font-size:9px;color:#94A3B8;border-top:1px solid #e5e9f2;padding-top:8px}
      @page{size:A4 portrait;margin:0}
      @media print{body{background:#fff;padding:0}.page{width:auto;min-height:0;margin:0;padding:14mm;box-shadow:none}.tbl tr{page-break-inside:avoid}}
    </style>
    <div class="page">
      <div class="rhead">
        <div class="rlogo">${stuLogoImg(school)}</div>
        <div>
          <div class="rname">${stuEsc(school?.name || 'School')}</div>
          <div class="rtitle">Family Tree Report</div>
        </div>
        <div class="meta">Generated: ${stuFmtDate(new Date().toISOString().slice(0, 10))}<br/>${stuEsc(school?.session || '')}</div>
      </div>

      <div class="kpi-row">
        <div class="kpi"><div class="l">Total Families</div><div class="v">${totalFams}</div></div>
        <div class="kpi"><div class="l">Linked Students</div><div class="v">${totalMembers}</div></div>
        <div class="kpi"><div class="l">Avg. Members per Family</div><div class="v">${totalFams === 0 ? 0 : (totalMembers / totalFams).toFixed(1)}</div></div>
      </div>

      ${families.length === 0 ? '<div class="empty">No families exist yet.</div>' : sections}

      <div class="rfoot">System-generated by ${stuEsc(school?.name || 'School')} ERP · ${stuFmtDate(new Date().toISOString().slice(0, 10))}</div>
    </div>`;
}

/* ═══════════════════════════════════════════════════════════════════
   FAMILY TREE tab
   ═══════════════════════════════════════════════════════════════════ */
function FamilyTree({ classes, families, setFamilies, school, toast }) {
  const { can } = usePermissions();
  const canFamCreate   = can('Students', 'Family Tree', 'Create');
  const canFamEdit     = can('Students', 'Family Tree', 'Edit');
  const canFamDelete   = can('Students', 'Family Tree', 'Delete');
  const [search, setSearch] = useState('');
  const [openKey, setOpenKey] = useState(null);
  const [editCfg, setEditCfg] = useState(null);  // {mode:'add'|'edit', family?}
  const [delCfg, setDelCfg]   = useState(null);

  /* Resolve members from the live class data */
  const memberOf = (famId) => {
    const out = [];
    classes.forEach(c => c.students.forEach(s => {
      if (s.family === famId) out.push({ ...s, _cls: c.cls, _sec: c.sec });
    }));
    return out;
  };

  /* Members come embedded in each family (get-...→ students[]); fall back to
     resolving from class data for any family record that lacks them. */
  const enriched = useMemo(() => families.map(f => ({ ...f, members: Array.isArray(f.members) ? f.members : memberOf(f.id) })), [families, classes]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!search.trim()) return enriched;
    const q = search.toLowerCase().trim();
    return enriched.filter(f => `${f.name} ${f.guardian || ''} ${f.contact || ''}`.toLowerCase().includes(q));
  }, [enriched, search]);

  /* KPI strip */
  const stats = useMemo(() => {
    const linked   = enriched.reduce((a, f) => a + f.members.length, 0);
    const sizes    = enriched.map(f => f.members.length);
    const largest  = sizes.length === 0 ? 0 : Math.max(...sizes);
    const largestF = enriched.find(f => f.members.length === largest);
    return { families: enriched.length, linked, largest, largestF: largestF?.name || '—' };
  }, [enriched]);

  const openAdd  = () => setEditCfg({ mode: 'add' });
  const openEdit = (family) => setEditCfg({ mode: 'edit', family });
  /* Insert (id 0) / update (id > 0) via familytreecrud, then reload the list. */
  const handleSave = async (payload) => {
    if (!payload.name.trim()) { toast('Family name is required', 'error'); return; }
    const isEdit = editCfg.mode === 'edit';
    try {
      await studentService.saveStuFamily({
        id:       isEdit ? editCfg.family.id : 0,
        name:     payload.name.trim(),
        guardian: payload.guardian,
        contact:  payload.contact,
        email:    payload.email,
        details:  payload.details,
      });
      setFamilies(await studentService.getStuFamilies());
      toast(isEdit ? `${payload.name} updated` : `${payload.name} created`, 'success');
    } catch (err) {
      toast(err.message || 'Could not save family', 'error');
    }
    setEditCfg(null);
  };

  /* action:delete via familytreecrud, then reload the list. */
  const handleDelete = async (family) => {
    try {
      await studentService.deleteStuFamily({ id: family.id });
      setFamilies(await studentService.getStuFamilies());
      toast(`${family.name} deleted`, 'info');
    } catch (err) {
      toast(err.message || 'Could not delete family', 'error');
    }
    setDelCfg(null);
  };

  /* Unlink a member: delete its family-tree detail by id, then reload families. */
  const handleUnlink = async (member) => {
    try {
      await studentService.unlinkStuFromFamily({ id: member.detailID });
      setFamilies(await studentService.getStuFamilies());
      toast('Student unlinked from family', 'info');
    } catch (err) {
      toast(err.message || 'Could not unlink student', 'error');
    }
  };

  const downloadPDF = () => {
    stuOpenPrintWindow('Family Tree Report', '', buildStuFamilyReportHTML(enriched, classes, school), toast);
    toast('Family tree report ready', 'success');
  };

  return (
    <>
      {/* KPI strip */}
      <div className="stu-kpis">
        <div className="stu-stat">
          <div className="stu-stat-icon violet"><i className="fa-solid fa-people-roof"></i></div>
          <div>
            <div className="stu-stat-val">{stats.families}</div>
            <div className="stu-stat-lbl">Family Trees</div>
          </div>
        </div>
        <div className="stu-stat">
          <div className="stu-stat-icon blue"><i className="fa-solid fa-users"></i></div>
          <div>
            <div className="stu-stat-val">{stats.linked}</div>
            <div className="stu-stat-lbl">Linked Students</div>
          </div>
        </div>
        <div className="stu-stat">
          <div className="stu-stat-icon green"><i className="fa-solid fa-chart-line"></i></div>
          <div>
            <div className="stu-stat-val">{stats.families === 0 ? 0 : (stats.linked / stats.families).toFixed(1)}</div>
            <div className="stu-stat-lbl">Avg. Members per Family</div>
          </div>
        </div>
        <div className="stu-stat">
          <div className="stu-stat-icon amber"><i className="fa-solid fa-crown"></i></div>
          <div>
            <div className="stu-stat-val" style={{ fontSize: 14, lineHeight: 1.2 }}>{stats.largestF}</div>
            <div className="stu-stat-lbl">Largest Family ({stats.largest})</div>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="stu-info">
        <i className="fa-solid fa-circle-info"></i>
        <span>
          <strong>Family Trees help schools manage siblings and linked fee structures efficiently.</strong>
          {' '}Create a family, then link students to it from the Active Students three-dots menu ("Add Student to Family Tree").
          Expand any family to see its linked students.
        </span>
      </div>

      {/* Toolbar */}
      <div className="stu-toolbar">
        <div className="stu-search-wrap">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            className="stu-search-input"
            placeholder="Search family name or guardian…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
          {search && (
            <button className="stu-search-clear" onClick={() => setSearch('')}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </div>
        <div className="stu-toolbar-actions">
          <Tooltip text="Download family tree report (PDF)">
            <button className="stu-iconbtn" onClick={downloadPDF} aria-label="Download family tree report (PDF)">
              <i className="fa-solid fa-file-pdf"></i>
            </button>
          </Tooltip>
          {canFamCreate && (
          <Tooltip text="Create a new family tree">
            <button className="stu-rowbtn admission-cta" onClick={openAdd}>
              <i className="fa-solid fa-plus"></i> New Family Tree
            </button>
          </Tooltip>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="fee-section stu-section">
        <div className="stu-table-head" style={{ gridTemplateColumns: '54px 1.4fr 1.2fr 1fr 110px 180px 70px' }}>
          <div className="th c">#</div>
          <div className="th">Family Name</div>
          <div className="th">Guardian</div>
          <div className="th">Contact</div>
          <div className="th c">Members</div>
          <div className="th">Actions</div>
          <div className="th c">Details</div>
        </div>

        {filtered.length === 0 ? (
          <div className="stu-empty">
            <div className="stu-empty-ic"><i className="fa-solid fa-people-roof"></i></div>
            <div className="stu-empty-title">{search ? 'No families match your search' : 'No family trees yet'}</div>
            <div className="stu-empty-sub">
              {search
                ? 'Try a different family name or guardian.'
                : 'Click "New Family Tree" to group siblings under one family.'}
            </div>
          </div>
        ) : filtered.map((f, idx) => (
          <FamilyRow
            key={f.id}
            f={f}
            idx={idx + 1}
            isOpen={openKey === f.id}
            onToggle={() => setOpenKey(openKey === f.id ? null : f.id)}
            onEdit={() => openEdit(f)}
            onDelete={() => setDelCfg(f)}
            onUnlink={handleUnlink}
            canFamEdit={canFamEdit} canFamDelete={canFamDelete}
          />
        ))}
      </div>

      {editCfg && (
        <FamilyEditModal
          cfg={editCfg}
          existingNames={families.map(f => f.name).filter(n => editCfg.mode !== 'edit' || n !== editCfg.family?.name)}
          onClose={() => setEditCfg(null)}
          onSave={handleSave}
        />
      )}

      <CrmConfirmStyleDeleteFam cfg={delCfg} onClose={() => setDelCfg(null)} onConfirm={handleDelete} />
    </>
  );
}

/* ─── Family row + expanded member list ─── */
function FamilyRow({ f, idx, isOpen, onToggle, onEdit, onDelete, onUnlink, canFamEdit = true, canFamDelete = true }) {
  return (
    <div className={`stu-clswrap${isOpen ? ' open' : ''}`}>
      <div className="stu-cls-row" style={{ gridTemplateColumns: '54px 1.4fr 1.2fr 1fr 110px 180px 70px' }} onClick={onToggle}>
        <div className="td c"><div className="stu-cls-sn">{idx}</div></div>
        <div className="td">
          <div className="stu-cls-name-wrap">
            <div className="stu-cls-ic" style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}>
              <i className="fa-solid fa-people-roof"></i>
            </div>
            <div>
              <div className="stu-cls-name">{f.name}</div>
              <div className="stu-cls-sub">{f.details || 'Family group'}</div>
            </div>
          </div>
        </div>
        <div className="td">{f.guardian || '—'}</div>
        <div className="td" style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 12 }}>{f.contact || '—'}</div>
        <div className="td c">
          <div className="stu-strength" style={{ background: 'rgba(124,58,237,.08)', color: '#7C3AED' }}>
            <span className="num">{f.members.length}</span>
          </div>
        </div>
        <div className="td stu-cls-actions" onClick={(e) => e.stopPropagation()}>
          {canFamEdit && (
          <Tooltip text="Edit this family">
            <button className="stu-rowbtn" onClick={onEdit}>
              <i className="fa-solid fa-pen"></i> Edit
            </button>
          </Tooltip>
          )}
          {canFamDelete && (
          <Tooltip text="Delete this family (students stay)">
            <button className="stu-rowbtn fam-del" onClick={onDelete}>
              <i className="fa-solid fa-trash"></i> Delete
            </button>
          </Tooltip>
          )}
        </div>
        <div className="td c">
          <Tooltip text={isOpen ? 'Collapse details' : 'Expand details'}>
            <button className="stu-chev" onClick={(e) => { e.stopPropagation(); onToggle(); }} aria-label={isOpen ? 'Collapse' : 'Expand'}>
              <i className={`fa-solid fa-chevron-down${isOpen ? ' rot' : ''}`}></i>
            </button>
          </Tooltip>
        </div>
      </div>

      <div className={`stu-detail${isOpen ? ' open' : ''}`}>
        <div className="stu-detail-inner">
          {/* Meta strip */}
          <div className="fam-meta">
            <div><div className="fam-meta-l">Family Name</div><div className="fam-meta-v">{f.name}</div></div>
            <div><div className="fam-meta-l">Guardian</div><div className="fam-meta-v">{f.guardian || '—'}</div></div>
            <div><div className="fam-meta-l">Contact</div><div className="fam-meta-v" style={{ fontFamily: 'ui-monospace,Menlo,monospace' }}>{f.contact || '—'}</div></div>
            {f.email && <div><div className="fam-meta-l">Email</div><div className="fam-meta-v">{f.email}</div></div>}
            {/* Created field hidden — the family API returns no created date. */}
            {f.details && <div className="fam-meta-full"><div className="fam-meta-l">Details</div><div className="fam-meta-v">{f.details}</div></div>}
          </div>

          <div className="stu-detail-head" style={{ marginTop: 14 }}>
            <div className="stu-detail-title">
              <i className="fa-solid fa-users"></i> Linked Students
            </div>
          </div>

          {f.members.length === 0 ? (
            <div className="stu-list-empty">
              <i className="fa-solid fa-link"></i>
              No students linked yet. Use <strong>Add Student to Family Tree</strong> from a student's three-dots menu in Active Students.
            </div>
          ) : (
            <>
              <div className="stu-list-head" style={{ gridTemplateColumns: '46px 58px 1.1fr 1.4fr 1.1fr 1.2fr 60px' }}>
                <div className="th c">#</div>
                <div className="th c">Photo</div>
                <div className="th">Reg No</div>
                <div className="th">Name</div>
                <div className="th">Class · Section</div>
                <div className="th">Relationship</div>
                <div className="th c">Unlink</div>
              </div>
              {f.members.map((m, i) => (
                <div key={m._id ?? m.id ?? `idx-${i}`} className="stu-srow" style={{ gridTemplateColumns: '46px 58px 1.1fr 1.4fr 1.1fr 1.2fr 60px' }}>
                  <div className="td c"><div className="stu-srow-sn">{i + 1}</div></div>
                  <div className="td c">
                    <div className="stu-avatar" style={{ background: 'rgba(124,58,237,.10)', color: '#7C3AED' }}>
                      {m.photo ? <img src={m.photo} alt="" /> : stuInitials(m)}
                    </div>
                  </div>
                  <div className="td stu-reg-cell">{m.reg}</div>
                  <div className="td stu-name-cell">
                    <div className="stu-srow-name">{stuFullName(m)}</div>
                  </div>
                  <div className="td">{m._cls} · {m._sec}</div>
                  <div className="td">
                    <span className="fam-rel-pill">{m._famRel || 'Sibling'}</span>
                  </div>
                  <div className="td c">
                    {canFamEdit && (
                    <Tooltip text="Unlink this student">
                      <button className="stu-rep-btn" style={{ borderColor: 'rgba(220,38,38,.32)', color: '#B91C1C' }} onClick={() => onUnlink(m)}>
                        <i className="fa-solid fa-link-slash"></i>
                      </button>
                    </Tooltip>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── New / Edit Family modal ─── */
function FamilyEditModal({ cfg, existingNames, onClose, onSave }) {
  const isEdit = cfg.mode === 'edit';
  const base = isEdit ? cfg.family : null;
  const [name, setName]         = useState(base?.name     || '');
  const [guardian, setGuardian] = useState(base?.guardian || '');
  const [contact, setContact]   = useState(base?.contact  || '');
  const [email, setEmail]       = useState(base?.email    || '');
  const [details, setDetails]   = useState(base?.details  || '');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  return (
    <div className="stu-modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="stu-modal" style={{ maxWidth: 600 }}>
        <div className="stu-modal-head">
          <div className="stu-modal-head-title">
            <div className="stu-modal-head-icon" style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}>
              <i className="fa-solid fa-people-roof"></i>
            </div>
            <div>
              <div className="stu-modal-title">{isEdit ? 'Edit Family Tree' : 'Add New Family Tree'}</div>
              <div className="stu-modal-sub">Group siblings under one family</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="stu-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
          </Tooltip>
        </div>
        <div className="stu-modal-body">
          <div className="stu-fgrid">
            <Field label="Family Name *">
              <input className="stu-finput" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. The Khan Family" />
              {existingNames.includes(name.trim()) && name.trim() && (
                <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 4 }}>
                  <i className="fa-solid fa-triangle-exclamation"></i> A family by this name already exists.
                </div>
              )}
            </Field>
            <Field label="Parent / Guardian Name">
              <input className="stu-finput" value={guardian} onChange={(e) => setGuardian(e.target.value)} placeholder="e.g. Abdul Rauf" />
            </Field>
            <Field label="Contact Number">
              <input className="stu-finput" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="e.g. 0300 1234567" />
            </Field>
            <Field label="Email">
              <input className="stu-finput" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="parent@example.com" />
            </Field>
            <Field label="Family Details (optional)">
              <textarea
                className="stu-finput"
                style={{ height: 70, padding: '10px 12px', resize: 'vertical' }}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Optional notes about this family"
              />
            </Field>
          </div>
        </div>
        <div className="stu-modal-foot">
          <button className="stu-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="stu-btn-primary"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', boxShadow: '0 4px 14px rgba(124,58,237,.28)' }}
            onClick={() => onSave({ name, guardian, contact, email, details })}
          >
            <i className="fa-solid fa-floppy-disk"></i> {isEdit ? 'Update Family' : 'Save Family Tree'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Delete Family confirm dialog (hero-ring style) ─── */
function CrmConfirmStyleDeleteFam({ cfg, onClose, onConfirm }) {
  useEffect(() => {
    if (!cfg) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [cfg, onClose]);
  if (!cfg) return null;
  const memberCount = cfg.members?.length || 0;
  return (
    <div className="stu-confirm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="stu-confirm-dialog">
        <div className="stu-confirm-glow" style={{ background: 'linear-gradient(90deg,#EF4444,#DC2626)' }} />
        <div className="stu-confirm-hero" style={{ background: 'linear-gradient(180deg, rgba(220,38,38,.05), transparent)' }}>
          <div className="stu-confirm-ring" style={{ '--ring': '#EF4444' }}>
            <div className="stu-confirm-icon-wrap" style={{ background: 'rgba(220,38,38,.10)', color: '#DC2626', boxShadow: '0 8px 24px rgba(220,38,38,.18)' }}>
              <i className="fa-solid fa-trash"></i>
            </div>
          </div>
        </div>
        <div className="stu-confirm-body">
          <div className="stu-confirm-title">Delete Family Tree?</div>
          <div className="stu-confirm-msg">
            Are you sure you want to delete "<strong>{cfg.name}</strong>"? Linked students will be unlinked (their student records are <strong>not</strong> deleted).
          </div>
          <div className="stu-confirm-hint">
            <div className="stu-confirm-hint-row"><i className="fa-solid fa-link-slash"></i> <strong>{memberCount}</strong> student(s) will be unlinked</div>
            <div className="stu-confirm-hint-row"><i className="fa-solid fa-user-graduate"></i> Student records themselves are preserved</div>
            <div className="stu-confirm-hint-row"><i className="fa-solid fa-ban" style={{ color: '#DC2626' }}></i> This family tree cannot be recovered</div>
          </div>
        </div>
        <div className="stu-confirm-footer">
          <button className="stu-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="stu-btn-primary"
            style={{ background: 'linear-gradient(135deg,#EF4444,#DC2626)', boxShadow: '0 4px 14px rgba(220,38,38,.35)' }}
            onClick={() => onConfirm(cfg)}
          >
            <i className="fa-solid fa-trash"></i> Yes, Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Coming Soon placeholder used for every not-yet-built screen ──── */
/* ═══════════════════════════════════════════════════════════════════
   PRE-ENROLLMENT — a simple flat list, ahead of Active Students. "Add
   New Student" opens the exact same direct-admission StuStudentModal in
   its pre-enroll mode (allowNewClassSection + requireAdmissionFields=false).
   Each row gets Challan + Receiving (copies of the Fee module's own
   Bulk-Generate / Receiving modals, minus the date fields on Challan per
   spec) plus Enroll (→ Active Students, with confirm) and Send to Inactive
   (→ Inactive Students, with confirm).
   ═══════════════════════════════════════════════════════════════════ */
function PreEnrolledStudents({ classes, setClasses, inactive, setInactive, school, toast }) {
  const { data: serverStudents = [] }  = useAsync(preEnrollmentService.getPreEnrollStudents, []);
  const { data: feeHeads = [] }        = useAsync(preEnrollmentService.getPreEnrollFeeHeads, []);
  const { data: classListLookup = [] } = useAsync(studentService.getStuClassList, []);
  const { data: sectionList = [] }     = useAsync(studentService.getStuSectionList, []);
  const { data: serverNextReg = 25101 } = useAsync(studentService.getStuNextReg, 25101);
  const { data: serverNextAdm = 1100 }  = useAsync(studentService.getStuNextAdm, 1100);

  void inactive; // accepted for parity; only setInactive is used here

  const [students, setStudents] = useState(null);
  useEffect(() => { if (serverStudents.length && students == null) setStudents(serverStudents); }, [serverStudents, students]);
  const list = useMemo(() => students || [], [students]);

  /* Registration / Admission No counters — seeded from the same server
     values Active Students uses, so Enroll can auto-assign a running number. */
  const [nextReg, setNextReg] = useState(null);
  const [nextAdm, setNextAdm] = useState(null);
  useEffect(() => { if (nextReg == null && serverNextReg) setNextReg(serverNextReg); }, [serverNextReg, nextReg]);
  useEffect(() => { if (nextAdm == null && serverNextAdm) setNextAdm(serverNextAdm); }, [serverNextAdm, nextAdm]);

  const [addOpen, setAddOpen] = useState(false);
  const [editCfg, setEditCfg] = useState(null);         // { student }
  const [challanCfg, setChallanCfg] = useState(null);   // { student }
  const [receivingCfg, setReceivingCfg] = useState(null); // { student }
  const [confirmCfg, setConfirmCfg] = useState(null);   // { kind: 'enroll'|'reject', student }
  const [reportOpen, setReportOpen] = useState(false);
  const [slipCfg, setSlipCfg] = useState(null);         // { kind: 'challan'|'receiving', student, payment? }

  const handleSaveStudent = (payload) => {
    const newStudent = {
      ...payload,
      preId: `PRE-${new Date().getFullYear()}-${String(list.length + 1).padStart(4, '0')}`,
      name: `${payload.first || ''} ${payload.last || ''}`.trim(),
      createdAt: new Date().toISOString().slice(0, 10),
      challan: null, payments: [],
    };
    preEnrollmentService.savePreEnrollStudent(newStudent).catch(() => {});
    setStudents(prev => [...(prev || []), newStudent]);
    toast(`${newStudent.name} pre-enrolled successfully`, 'success');
    setAddOpen(false);
  };

  const handleEditStudent = (payload) => {
    const preId = editCfg.student.preId;
    const updated = { ...editCfg.student, ...payload, preId, name: `${payload.first || ''} ${payload.last || ''}`.trim() };
    preEnrollmentService.savePreEnrollStudent(updated).catch(() => {});
    setStudents(prev => prev.map(s => (s.preId === preId ? updated : s)));
    toast(`${stuFullName(updated)} updated`, 'success');
    setEditCfg(null);
  };

  const handleChallanSave = (challan) => {
    const student = challanCfg.student;
    preEnrollmentService.savePreEnrollChallan({ preId: student.preId, challan }).catch(() => {});
    const updated = { ...student, challan };
    setStudents(prev => prev.map(s => s.preId === student.preId ? updated : s));
    toast('Challan generated', 'success');
    setChallanCfg(null);
    setSlipCfg({ kind: 'challan', student: updated });
  };

  const handleReceivingSave = (payment) => {
    const student = receivingCfg.student;
    preEnrollmentService.savePreEnrollReceiving({ preId: student.preId, payment }).catch(() => {});
    const updated = { ...student, payments: [...(student.payments || []), payment] };
    setStudents(prev => prev.map(s => s.preId === student.preId ? updated : s));
    toast('Payment received', 'success');
    setReceivingCfg(null);
    setSlipCfg({ kind: 'receiving', student: updated, payment });
  };

  const handleConfirm = (cfg) => {
    const { kind, student } = cfg;
    if (kind === 'enroll') {
      const typedReg = (cfg.reg || '').trim();
      const typedAdm = (cfg.adm || '').trim();
      const finalReg = typedReg || `${new Date().getFullYear()}-${String(nextReg || 25101).padStart(5, '0')}`;
      const finalAdm = typedAdm || String(nextAdm || 1100);
      if (!typedReg) setNextReg((nextReg || 25101) + 1);
      if (!typedAdm) setNextAdm((nextAdm || 1100) + 1);
      const enrolled = {
        ...student, _id: student._id || student.preId, reg: finalReg, adm: finalAdm,
        family: (cfg.family || '').trim() || student.family || '',
        admdate: cfg.admdate || new Date().toISOString().slice(0, 10),
        name: stuFullName(student),
      };
      setClasses(prev => {
        const idx = (prev || []).findIndex(c => c.cls === student.cls && c.sec === student.sec);
        if (idx >= 0) return prev.map((c, i) => (i === idx ? { ...c, students: [...c.students, enrolled] } : c));
        return [...(prev || []), { key: `${student.cls}-${student.sec}-${finalReg}`, cls: student.cls, sec: student.sec, students: [enrolled] }];
      });
      toast(`${stuFullName(student)} enrolled into ${student.cls} (${student.sec}) · Reg ${finalReg}`, 'success');
    } else {
      setInactive(prev => [{
        reg: student.reg, first: student.first, last: student.last, father: student.father,
        gender: student.gender, dob: student.dob, mobile: student.mobile,
        cls: student.cls, sec: student.sec,
        reason: 'Did not proceed after pre-enrollment',
        inactiveDate: new Date().toISOString().slice(0, 10),
        dues: { total: 0, heads: [], session: '', months: '', history: [] },
      }, ...(prev || [])]);
      toast(`${stuFullName(student)} moved to Inactive Students`, 'info');
    }
    preEnrollmentService.removePreEnrollStudent(student.preId).catch(() => {});
    setStudents(prev => prev.filter(s => s.preId !== student.preId));
    setConfirmCfg(null);
  };

  return (
    <>
      <div className="stu-toolbar">
        <div style={{ flex: 1 }} />
        <div className="stu-toolbar-actions">
          <Tooltip text="Filter and view pre-enrollment income by month or date range">
            <button className="stu-iconbtn" onClick={() => setReportOpen(true)} aria-label="Reporting">
              <i className="fa-solid fa-chart-column"></i>
            </button>
          </Tooltip>
          <Tooltip text="Pre-register a new student using the standard admission form">
            <button className="stu-rowbtn add" onClick={() => setAddOpen(true)}>
              <i className="fa-solid fa-user-plus"></i> Add New Student
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="fee-section stu-section">
        <div className="stu-list-head">
          <div className="th c">#</div>
          <div className="th c">Photo</div>
          <div className="th">Reg No / Pre ID</div>
          <div className="th">Name</div>
          <div className="th">Father Name</div>
          <div className="th">Class</div>
          <div className="th">Contact No</div>
          <div className="th c">Actions</div>
        </div>
        {list.length === 0 ? (
          <div className="stu-list-empty">
            <i className="fa-solid fa-user-plus"></i>
            No pre-enrolled students yet. Use <strong>Add New Student</strong> to register one.
          </div>
        ) : list.map((s, i) => (
          <PreEnrollStudentRow
            key={s.preId}
            s={s}
            i={i + 1}
            onChallan={() => setChallanCfg({ student: s })}
            onReceiving={() => {
              if (!s.challan) { toast('Generate a challan first', 'error'); return; }
              setReceivingCfg({ student: s });
            }}
            onEnroll={() => setConfirmCfg({ kind: 'enroll', student: s })}
            onReject={() => setConfirmCfg({ kind: 'reject', student: s })}
            onSlip={(kind) => setSlipCfg({ kind, student: s })}
            onEdit={() => setEditCfg({ student: s })}
          />
        ))}
      </div>

      {addOpen && (
        <StuStudentModal
          cfg={{ mode: 'add' }}
          activeClass={null}
          student={null}
          classList={classListLookup}
          sectionList={sectionList}
          classes={[]}
          families={[]}
          existingRegs={[]}
          suggestedReg={`${new Date().getFullYear()}-${String(nextReg || 25101).padStart(5, '0')}`}
          suggestedAdm={String(nextAdm || 1100)}
          onClose={() => setAddOpen(false)}
          onSave={handleSaveStudent}
          toast={toast}
          allowNewClassSection
          requireAdmissionFields={false}
        />
      )}

      {editCfg && (
        <StuStudentModal
          cfg={{ mode: 'edit' }}
          activeClass={null}
          student={editCfg.student}
          classList={classListLookup}
          sectionList={sectionList}
          classes={[]}
          families={[]}
          existingRegs={[]}
          suggestedReg=""
          suggestedAdm=""
          onClose={() => setEditCfg(null)}
          onSave={handleEditStudent}
          toast={toast}
          allowNewClassSection
          requireAdmissionFields={false}
        />
      )}

      {challanCfg && (
        <PreEnrollChallanModal
          student={challanCfg.student}
          feeHeads={feeHeads}
          onClose={() => setChallanCfg(null)}
          onSave={handleChallanSave}
          toast={toast}
        />
      )}

      {receivingCfg && (
        <PreEnrollReceivingModal
          student={receivingCfg.student}
          onClose={() => setReceivingCfg(null)}
          onSave={handleReceivingSave}
          toast={toast}
        />
      )}

      {confirmCfg && (
        <PreEnrollConfirm
          cfg={confirmCfg}
          suggestedReg={`${new Date().getFullYear()}-${String(nextReg || 25101).padStart(5, '0')}`}
          suggestedAdm={String(nextAdm || 1100)}
          onClose={() => setConfirmCfg(null)}
          onConfirm={handleConfirm}
        />
      )}

      {reportOpen && (
        <PreEnrollReportPanel students={list} school={school} onClose={() => setReportOpen(false)} toast={toast} />
      )}

      {slipCfg && (
        <PreEnrollSlipModal cfg={slipCfg} school={school} onClose={() => setSlipCfg(null)} toast={toast} />
      )}
    </>
  );
}

function PreEnrollStudentRow({ s, i, onChallan, onReceiving, onEnroll, onReject, onSlip, onEdit }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuUp, setMenuUp] = useState(false);
  const anchorRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      setMenuUp(vh - r.bottom < 280 && r.top > 280);
    }
    const onClick = (e) => { if (anchorRef.current && !anchorRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const fire = (fn) => { setMenuOpen(false); fn(); };
  const total = s.challan?.total || 0;
  const paid = (s.payments || []).reduce((a, p) => a + Number(p.amount || 0), 0);
  const statusLabel = !s.challan ? 'No Challan' : paid >= total ? 'Paid' : `${stuMoney(total - paid)} due`;

  return (
    <div className="stu-srow">
      <div className="td c"><div className="stu-srow-sn">{i}</div></div>
      <div className="td c">
        <div className="stu-avatar">{s.photo ? <img src={s.photo} alt={stuFullName(s)} /> : stuInitials(s)}</div>
      </div>
      <div className="td stu-reg-cell">{s.reg || s.preId}</div>
      <div className="td stu-name-cell">
        <div className="stu-srow-name">{stuFullName(s)}</div>
        <div className="stu-srow-sub">{statusLabel}</div>
      </div>
      <div className="td stu-father-cell">{s.father || '—'}</div>
      <div className="td">{s.cls}{s.sec ? ` (${s.sec})` : ''}</div>
      <div className="td stu-contact-cell">{s.mobile || '—'}</div>
      <div className="td c" ref={anchorRef}>
        <Tooltip text="More actions">
          <button className="stu-dots" onClick={() => setMenuOpen(!menuOpen)}>
            <i className="fa-solid fa-ellipsis-vertical"></i>
          </button>
        </Tooltip>
        {menuOpen && (
          <div className={`stu-actmenu${menuUp ? ' stu-actmenu--up' : ''}`}>
            <div className="stu-actmenu-lbl">{stuFullName(s)}{s.reg ? ` · ${s.reg}` : ''}</div>
            <button className="stu-actitem" onClick={() => fire(onEdit)}>
              <i className="fa-solid fa-pen" style={{ color: '#1E40AF' }}></i> Edit Student Details
            </button>
            <button className="stu-actitem" onClick={() => fire(onChallan)}>
              <i className="fa-solid fa-file-invoice-dollar" style={{ color: '#1E40AF' }}></i> Challan
            </button>
            <button
              className="stu-actitem"
              disabled={!s.challan}
              style={!s.challan ? { opacity: .45, cursor: 'not-allowed' } : undefined}
              onClick={() => { if (!s.challan) return; fire(onReceiving); }}
            >
              <i className="fa-solid fa-hand-holding-dollar" style={{ color: '#16A34A' }}></i> Receiving{!s.challan ? ' (generate challan first)' : ''}
            </button>
            <button className="stu-actitem" disabled={!s.challan} style={!s.challan ? { opacity: .45, cursor: 'not-allowed' } : undefined} onClick={() => { if (!s.challan) return; fire(() => onSlip('challan')); }}>
              <i className="fa-solid fa-print" style={{ color: '#0E7490' }}></i> Print Challan Slip
            </button>
            <button className="stu-actitem" disabled={!(s.payments || []).length} style={!(s.payments || []).length ? { opacity: .45, cursor: 'not-allowed' } : undefined} onClick={() => { if (!(s.payments || []).length) return; fire(() => onSlip('receiving')); }}>
              <i className="fa-solid fa-receipt" style={{ color: '#0E7490' }}></i> Print Receiving Slip
            </button>
            <div className="stu-actmenu-div"></div>
            <button className="stu-actitem" onClick={() => fire(onEnroll)}>
              <i className="fa-solid fa-user-check" style={{ color: '#16A34A' }}></i> Enroll to Active Students
            </button>
            <button className="stu-actitem stu-actitem--danger" onClick={() => fire(onReject)}>
              <i className="fa-solid fa-user-slash"></i> Send to Inactive
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Challan — copy of Fee.jsx's BulkGenerateModal, minus Issue/Due Date ── */
function PreEnrollChallanModal({ student, feeHeads, onClose, onSave, toast }) {
  const month = STU_PRE_MONTHS[new Date().getMonth()];
  const type = '1';
  const [picked, setPicked] = useState(() => (student.challan?.heads || []).map(h => h.name));
  const [msOpen, setMsOpen] = useState(false);
  const msAnchorRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  useEffect(() => {
    if (!msOpen) return undefined;
    const onDown = (e) => { if (msAnchorRef.current && !msAnchorRef.current.contains(e.target)) setMsOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [msOpen]);

  const toggleHead = (name) => setPicked(prev => (prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]));
  const headsLabel = picked.length === 0 ? 'Select Heads' : `${picked.length} head${picked.length === 1 ? '' : 's'} selected`;
  const pickedHeads = feeHeads.filter(h => picked.includes(h.name));
  const total = pickedHeads.reduce((a, h) => a + Number(h.amt || 0), 0);

  const handleGenerate = () => {
    if (picked.length === 0) { toast('Select at least one fee head', 'error'); return; }
    onSave({ heads: pickedHeads.map(h => ({ name: h.name, amt: h.amt })), month, type, total, generatedAt: new Date().toISOString() });
  };

  const initials = (stuFullName(student) || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

  return createPortal(
    <div className="fee-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fee-modal">
        <div className="fee-modal-head">
          <div className="fee-modal-head-title">
            <div className="fee-modal-head-icon"><i className="fa-solid fa-file-circle-plus"></i></div>
            <div>
              <div className="fee-modal-title">Generate Challan</div>
              <div className="fee-modal-sub">{stuFullName(student)} · child of {student.father || '—'}</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="fee-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>

        <div className="fee-modal-body">
          <div className="fee-stud-card">
            <div className="fee-stud-logo">{initials}</div>
            <div className="fee-stud-meta">
              <div><b>Name</b> {stuFullName(student)}</div>
              <div><b>Father Name</b> {student.father || '—'}</div>
              <div><b>Class</b> {student.cls} ({student.sec})</div>
              <div><b>Reg No</b> {student.reg || student.preId}</div>
            </div>
          </div>

          <div className="fee-filters" style={{ alignItems: 'flex-start', marginTop: 18 }}>
            <div className="fee-field fee-field--grow">
              <span className="fee-label">Select Fee Heads</span>
              <div className={`fee-ms${msOpen ? ' open' : ''}`} ref={msAnchorRef}>
                <button type="button" className="fee-ms-toggle" onClick={() => setMsOpen(o => !o)}>
                  <span>{headsLabel}</span>
                  <i className="fa-solid fa-chevron-down"></i>
                </button>
                {msOpen && (
                  <div className="fee-ms-menu">
                    {feeHeads.length === 0 ? <div className="fee-ms-empty">No fee heads configured.</div> : feeHeads.map(h => (
                      <button type="button" key={h.name} className={`fee-ms-opt${picked.includes(h.name) ? ' sel' : ''}`} onClick={() => toggleHead(h.name)}>
                        <span className="fee-ms-check"><i className="fa-solid fa-check"></i></span>
                        <span className="fee-ms-name">{h.name}</span>
                        <span className="fee-ms-amt">{stuMoney(h.amt)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="fee-info" style={{ marginTop: 16 }}>
            <i className="fa-solid fa-circle-info"></i>
            <span>Total challan amount: <strong>{stuMoney(total)}</strong>. Use <strong>Receiving</strong> afterwards to collect payment against this challan.</span>
          </div>
        </div>

        <div className="fee-modal-foot">
          <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="fee-btn fee-btn-primary" onClick={handleGenerate}>
            <i className="fa-solid fa-bolt"></i> Generate Challan
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ─── Receiving — copy of Fee.jsx's FeeReceivingModal, for a one-time challan ── */
function PreEnrollReceivingModal({ student, onClose, onSave, toast }) {
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState('Cash');
  const [ref, setRef] = useState('');
  const [txn, setTxn] = useState('');
  const heads = student.challan?.heads || [];
  const alreadyPerHead = {};
  (student.payments || []).forEach(p => {
    Object.entries(p.perHead || {}).forEach(([n, v]) => { alreadyPerHead[n] = (alreadyPerHead[n] || 0) + (+v || 0); });
  });
  const [perHeadInput, setPerHeadInput] = useState(() => {
    const seed = {};
    heads.forEach(h => { seed[h.name] = Math.max(0, h.amt - (alreadyPerHead[h.name] || 0)); });
    return seed;
  });

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const setHead = (name, v) => setPerHeadInput(prev => ({ ...prev, [name]: Math.max(0, Number(v) || 0) }));

  const rows = heads.map(h => {
    const paid = +alreadyPerHead[h.name] || 0;
    const recvNow = Math.max(0, Math.min(+perHeadInput[h.name] || 0, h.amt - paid));
    const pending = Math.max(0, h.amt - paid - recvNow);
    return { ...h, paid, recvNow, pending };
  });
  const totalChallan = heads.reduce((a, h) => a + Number(h.amt || 0), 0);
  const alreadyPaid = rows.reduce((a, r) => a + r.paid, 0);
  const receivingNow = rows.reduce((a, r) => a + r.recvNow, 0);
  const remainAfter = Math.max(0, totalChallan - alreadyPaid - receivingNow);

  const handleReceive = () => {
    if (receivingNow <= 0) { toast('Enter at least one head amount to receive', 'error'); return; }
    if (!date) { toast('Receiving date is required', 'error'); return; }
    const perHead = {};
    rows.forEach(r => { if (r.recvNow > 0) perHead[r.name] = r.recvNow; });
    onSave({ id: `pep-${Date.now()}`, date, method, ref: ref.trim(), txn: txn.trim(), amount: receivingNow, perHead, createdAt: new Date().toISOString() });
  };

  return createPortal(
    <div className="fee-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fee-modal lg">
        <div className="fee-modal-head">
          <div className="fee-modal-head-title">
            <div className="fee-modal-head-icon"><i className="fa-solid fa-hand-holding-dollar"></i></div>
            <div>
              <div className="fee-modal-title">Receiving Fee of <em>{stuFullName(student)}</em></div>
              <div className="fee-modal-sub">{student.cls} ({student.sec}) · {student.challan?.month}</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="fee-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>

        <div className="fee-modal-body">
          <div className="fee-filters">
            <div className="fee-field">
              <span className="fee-label">Custom Reference #</span>
              <input className="fee-input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Optional" />
            </div>
            <div className="fee-field">
              <span className="fee-label">Receiving Date</span>
              <input className="fee-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="fee-field">
              <span className="fee-label">Payment Method</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option>Cash</option><option>Bank Transfer</option><option>Cheque</option><option>Card</option><option>Online / App</option>
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
            <div className="fee-field">
              <span className="fee-label">Transaction #</span>
              <input className="fee-input" value={txn} onChange={(e) => setTxn(e.target.value)} placeholder="Optional" />
            </div>
          </div>

          <div className="fee-stbl-wrap" style={{ marginTop: 14 }}>
            <table className="fee-stbl fee-recv-table">
              <thead>
                <tr><th>Head</th><th className="fee-right">Challan Amount</th><th className="fee-right">Received</th><th className="fee-right">Pending</th></tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.name}>
                    <td><b>{r.name}</b></td>
                    <td className="fee-right">{stuMoney(r.amt)}</td>
                    <td className="fee-right">
                      <input type="number" min="0" max={Math.max(0, r.amt - r.paid)} value={perHeadInput[r.name] === 0 ? 0 : (perHeadInput[r.name] || '')} onChange={(e) => setHead(r.name, e.target.value)} placeholder="0" />
                    </td>
                    <td className="fee-right">{stuMoney(r.pending)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="fee-recv-total">
                  <td>Total</td>
                  <td className="fee-right">{stuMoney(totalChallan)}</td>
                  <td className="fee-right">{stuMoney(alreadyPaid + receivingNow)}</td>
                  <td className="fee-right">{stuMoney(remainAfter)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="fee-recv-paystrip">
            <div className="fee-recv-paycard"><span className="fee-recv-paylbl">Total Amount</span><span className="fee-recv-payval">{stuMoney(totalChallan)}</span></div>
            <div className="fee-recv-paycard"><span className="fee-recv-paylbl">Already Received</span><span className="fee-recv-payval green">{stuMoney(alreadyPaid)}</span></div>
            <div className="fee-recv-paycard"><span className="fee-recv-paylbl">Receiving Now</span><span className="fee-recv-payval blue">{stuMoney(receivingNow)}</span></div>
            <div className="fee-recv-paycard"><span className="fee-recv-paylbl">Remaining After</span><span className="fee-recv-payval red">{stuMoney(remainAfter)}</span></div>
          </div>

          {student.payments && student.payments.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div className="fee-recv-hist-title"><i className="fa-solid fa-clock-rotate-left"></i> Payment History</div>
              <div className="fee-stbl-wrap" style={{ marginTop: 8 }}>
                <table className="fee-stbl">
                  <thead><tr><th>#</th><th>Date</th><th>Method</th><th>Reference</th><th className="fee-right">Amount</th></tr></thead>
                  <tbody>
                    {student.payments.map((p, i) => (
                      <tr key={p.id || i}>
                        <td className="fee-num">{i + 1}</td>
                        <td>{p.date}</td>
                        <td>{p.method}</td>
                        <td>{p.ref || p.txn || '—'}</td>
                        <td className="fee-right"><b>{stuMoney(p.amount)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="fee-modal-foot">
          <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="fee-btn fee-btn-primary" onClick={handleReceive}>
            <i className="fa-solid fa-check"></i> Receive
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ─── Enroll / Send to Inactive confirm dialog (same hero-ring style as the rest of Students) ── */
function PreEnrollConfirm({ cfg, suggestedReg, suggestedAdm, onClose, onConfirm }) {
  const isEnroll = cfg?.kind === 'enroll';
  const [reg, setReg] = useState('');
  const [adm, setAdm] = useState('');
  const [family, setFamily] = useState('');
  const [admdate, setAdmdate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  if (!cfg) return null;
  const name = stuFullName(cfg.student);
  const tone = isEnroll ? '#16A34A' : '#DC2626';
  return (
    <div className="stu-confirm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="stu-confirm-dialog">
        <div className="stu-confirm-glow" style={{ background: `linear-gradient(90deg,${tone},${tone})` }} />
        <div className="stu-confirm-hero" style={{ background: `linear-gradient(180deg, ${isEnroll ? 'rgba(22,163,74,.05)' : 'rgba(220,38,38,.05)'}, transparent)` }}>
          <div className="stu-confirm-ring" style={{ '--ring': tone }}>
            <div className="stu-confirm-icon-wrap" style={{ background: isEnroll ? 'rgba(22,163,74,.10)' : 'rgba(220,38,38,.10)', color: tone, boxShadow: `0 8px 24px ${isEnroll ? 'rgba(22,163,74,.18)' : 'rgba(220,38,38,.18)'}` }}>
              <i className={`fa-solid ${isEnroll ? 'fa-user-check' : 'fa-user-slash'}`}></i>
            </div>
          </div>
        </div>
        <div className="stu-confirm-body">
          <div className="stu-confirm-title">{isEnroll ? 'Enroll Student?' : 'Send to Inactive?'}</div>
          <div className="stu-confirm-msg">
            {isEnroll
              ? <>Confirm enrollment of "<strong>{name}</strong>" — {cfg.student.cls} ({cfg.student.sec}). They will move into <strong>Active Students</strong> immediately.</>
              : <>"<strong>{name}</strong>" will be moved to <strong>Inactive Students</strong> and removed from the pre-enrollment list.</>}
          </div>
          {isEnroll && (
            <>
              <div className="stu-confirm-hint-row" style={{ marginBottom: 10 }}>
                <i className="fa-solid fa-circle-info"></i> Optional — fill these in now, or leave blank to auto-assign.
              </div>
              <div className="stu-fgrid stu-fgrid-2">
                <Field label="Registration No" hint={`Leave blank to auto-assign ${suggestedReg}`}>
                  <input className="stu-finput" value={reg} onChange={(e) => setReg(e.target.value)} placeholder={suggestedReg} />
                </Field>
                <Field label="Admission No" hint={`Leave blank to auto-assign ${suggestedAdm}`}>
                  <input className="stu-finput" value={adm} onChange={(e) => setAdm(e.target.value)} placeholder={suggestedAdm} />
                </Field>
                <Field label="Family No" hint="Links siblings for family billing.">
                  <input className="stu-finput" value={family} onChange={(e) => setFamily(e.target.value)} placeholder="e.g. 78855" />
                </Field>
                <Field label="Date of Admission">
                  <input className="stu-finput" type="date" value={admdate} onChange={(e) => setAdmdate(e.target.value)} />
                </Field>
              </div>
            </>
          )}
        </div>
        <div className="stu-confirm-footer">
          <button className="stu-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="stu-btn-primary"
            style={{ background: `linear-gradient(135deg,${tone},${tone})`, boxShadow: `0 4px 14px ${isEnroll ? 'rgba(22,163,74,.35)' : 'rgba(220,38,38,.35)'}` }}
            onClick={() => onConfirm(isEnroll ? { ...cfg, reg, adm, family, admdate } : cfg)}
          >
            <i className={`fa-solid ${isEnroll ? 'fa-user-check' : 'fa-user-slash'}`}></i> {isEnroll ? 'Yes, Enroll' : 'Yes, Move'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Reporting download — same A4 report convention as the other Students
   reports (rhead/rlogo/kpi-row/tbl/rfoot), school-branded via stuSchoolLogoSVG(). ── */
function buildPreEnrollReportHTML({ rows, total, enrolledCount, periodLabel, school }) {
  const genDate = stuFmtDate(new Date().toISOString().slice(0, 10));
  const body = rows.length === 0
    ? '<tr><td colspan="6" style="text-align:center;padding:18px;color:#94A3B8">No collections in this period.</td></tr>'
    : rows.map((p, i) => `<tr><td class="c">${i + 1}</td><td>${stuFmtDate(p.date)}</td><td><b>${stuEsc(p.studentName)}</b></td><td class="mono">${stuEsc(p.reg)}</td><td>${stuEsc(p.cls)}${p.sec ? ` (${stuEsc(p.sec)})` : ''}</td><td>${stuEsc(p.method)}</td><td class="r">${stuMoney(p.amount)}</td></tr>`).join('');
  return {
    css: `
      *{box-sizing:border-box;margin:0;padding:0;font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif}
      html,body{background:#F1F3F8}body{padding:18px 0;font-size:10.5px}
      .page{width:210mm;min-height:297mm;margin:0 auto;padding:14mm;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,.12)}
      .rhead{display:flex;align-items:center;gap:14px;border-bottom:2px solid #1E3A8A;padding-bottom:10px;margin-bottom:14px}
      .rlogo{width:46px;height:46px;flex-shrink:0}
      .rname{font-size:17px;font-weight:800;color:#0F172A}
      .rtitle{font-size:12px;font-weight:700;color:#1E3A8A;margin-top:3px}
      .meta{margin-left:auto;font-size:9.5px;color:#64748B;text-align:right;line-height:1.55}
      .kpi-row{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:14px}
      .kpi{border:1px solid #E5E7EB;border-radius:8px;padding:10px 12px;background:#F8FAFF;position:relative;overflow:hidden}
      .kpi::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#1E3A8A}
      .kpi .l{font-size:9px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.3px}
      .kpi .v{font-size:18px;font-weight:800;color:#0F172A;margin-top:2px}
      .tbl{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;font-size:10.5px}
      .tbl thead th{background:#1E3A8A;color:#fff;padding:7px 9px;text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.3px;font-weight:800}
      .tbl th.c,.tbl td.c{text-align:center}
      .tbl th.r,.tbl td.r{text-align:right}
      .tbl td{padding:7px 9px;border-bottom:1px solid #F1F3F8;vertical-align:top}
      .tbl tbody tr:nth-child(even) td{background:#FBFCFF}
      .tbl tfoot td{font-weight:800;background:#F8FAFF;border-top:1.5px solid #E5E7EB}
      .mono{font-family:ui-monospace,Menlo,monospace;color:#1E3A8A;font-weight:800}
      .rfoot{margin-top:14px;text-align:center;font-size:9px;color:#94A3B8;border-top:1px solid #e5e9f2;padding-top:8px}
      @page{size:A4 portrait;margin:0}
      @media print{body{background:#fff;padding:0}.page{width:auto;min-height:0;margin:0;padding:14mm;box-shadow:none}.tbl tr{page-break-inside:avoid}}
    `,
    html: `
      <div class="page">
        <div class="rhead">
          <div class="rlogo">${stuSchoolLogoSVG()}</div>
          <div><div class="rname">${stuEsc(school?.name || 'School')}</div><div class="rtitle">Pre-Enrollment Report — ${stuEsc(periodLabel)}</div></div>
          <div class="meta">Generated: ${genDate}<br/>${stuEsc(school?.session || '')}</div>
        </div>
        <div class="kpi-row">
          <div class="kpi"><div class="l">Pre-Enrolled In Period</div><div class="v">${enrolledCount}</div></div>
          <div class="kpi"><div class="l">Collections</div><div class="v">${rows.length}</div></div>
          <div class="kpi"><div class="l">Total Revenue</div><div class="v">${stuMoney(total)}</div></div>
        </div>
        <table class="tbl">
          <thead><tr><th class="c" style="width:30px">#</th><th style="width:80px">Date</th><th>Student</th><th style="width:100px">Reg No</th><th>Class</th><th style="width:90px">Method</th><th class="r" style="width:100px">Amount</th></tr></thead>
          <tbody>${body}</tbody>
          <tfoot><tr><td colspan="6">Total</td><td class="r">${stuMoney(total)}</td></tr></tfoot>
        </table>
        <div class="rfoot">${stuEsc(school?.name || 'School')} · Pre-Enrollment Report · Generated ${genDate}</div>
      </div>
    `,
  };
}

/* ─── Reporting — pre-enrollment income by month or a custom date range ── */
function PreEnrollReportPanel({ students, school, onClose, toast }) {
  const [mode, setMode] = useState('month'); // 'month' | 'range'
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const rows = useMemo(() => {
    const all = students.flatMap(s => (s.payments || []).map(p => ({ ...p, studentName: stuFullName(s), cls: s.cls, sec: s.sec, reg: s.reg })));
    return all.filter(p => (mode === 'month' ? (p.date || '').slice(0, 7) === month : p.date >= from && p.date <= to))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [students, mode, month, from, to]);

  const total = rows.reduce((a, p) => a + Number(p.amount || 0), 0);
  const enrolledCount = students.filter(s => (mode === 'month' ? (s.createdAt || '').slice(0, 7) === month : (s.createdAt || '') >= from && (s.createdAt || '') <= to)).length;
  const periodLabel = mode === 'month'
    ? new Date(`${month}-01`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : `${stuFmtDate(from)} — ${stuFmtDate(to)}`;

  const handleDownload = () => {
    const { css, html } = buildPreEnrollReportHTML({ rows, total, enrolledCount, periodLabel, school });
    stuOpenPrintWindow(`Pre-Enrollment Report — ${periodLabel}`, css, html, toast);
  };

  return createPortal(
    <div className="fee-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fee-modal lg">
        <div className="fee-modal-head">
          <div className="fee-modal-head-title">
            <div className="fee-modal-head-icon"><i className="fa-solid fa-chart-column"></i></div>
            <div>
              <div className="fee-modal-title">Pre-Enrollment Reporting</div>
              <div className="fee-modal-sub">Filter income collected from pre-enrolled students by month or a custom date range</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="fee-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>

        <div className="fee-modal-body">
          <div className="fee-subtabs" style={{ marginBottom: 14 }}>
            <button className={`fee-subtab${mode === 'month' ? ' active' : ''}`} onClick={() => setMode('month')}>
              <i className="fa-solid fa-calendar-days"></i> Monthly
            </button>
            <button className={`fee-subtab${mode === 'range' ? ' active' : ''}`} onClick={() => setMode('range')}>
              <i className="fa-solid fa-calendar-week"></i> Custom Date Range
            </button>
          </div>

          <div className="fee-filters">
            {mode === 'month' ? (
              <div className="fee-field">
                <span className="fee-label">Month</span>
                <input className="fee-input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
              </div>
            ) : (
              <>
                <div className="fee-field">
                  <span className="fee-label">From Date</span>
                  <input className="fee-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="fee-field">
                  <span className="fee-label">To Date</span>
                  <input className="fee-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </>
            )}
          </div>

          <div className="stu-kpis" style={{ margin: '16px 0' }}>
            <div className="stu-stat">
              <div className="stu-stat-icon blue"><i className="fa-solid fa-user-clock"></i></div>
              <div><div className="stu-stat-val">{enrolledCount}</div><div className="stu-stat-lbl">Pre-Enrolled In Period</div></div>
            </div>
            <div className="stu-stat">
              <div className="stu-stat-icon green"><i className="fa-solid fa-receipt"></i></div>
              <div><div className="stu-stat-val">{rows.length}</div><div className="stu-stat-lbl">Collections</div></div>
            </div>
            <div className="stu-stat">
              <div className="stu-stat-icon violet"><i className="fa-solid fa-sack-dollar"></i></div>
              <div><div className="stu-stat-val">{stuMoney(total)}</div><div className="stu-stat-lbl">Total Revenue</div></div>
            </div>
          </div>

          <div className="fee-stbl-wrap">
            <table className="fee-stbl fee-recv-table">
              <thead>
                <tr><th>Date</th><th>Student</th><th>Reg No</th><th>Class</th><th>Method</th><th className="fee-right">Amount</th></tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No collections in this period</td></tr>
                ) : rows.map(p => (
                  <tr key={p.id}>
                    <td>{stuFmtDate(p.date)}</td>
                    <td>{p.studentName}</td>
                    <td>{p.reg}</td>
                    <td>{p.cls}{p.sec ? ` (${p.sec})` : ''}</td>
                    <td>{p.method}</td>
                    <td className="fee-right">{stuMoney(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="fee-recv-total">
                  <td colSpan={5}>Total</td>
                  <td className="fee-right">{stuMoney(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="fee-modal-foot">
          <button className="fee-btn fee-btn-ghost" onClick={onClose}>Close</button>
          <button className="fee-btn fee-btn-primary" onClick={handleDownload} disabled={rows.length === 0}>
            <i className="fa-solid fa-file-arrow-down"></i> Download Report
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ─── Challan / Receiving slip print documents — A4 uses this file's own
   report-print convention (stuSchoolLogoSVG + school name), Thermal is an
   80mm receipt layout. ── */
function buildPreEnrollSlipHTML({ kind, student, payment, school, size }) {
  const isChallan = kind === 'challan';
  const title = isChallan ? 'Pre-Enrollment Challan' : 'Payment Receipt';
  const genDate = stuFmtDate(new Date().toISOString().slice(0, 10));
  const rows = isChallan
    ? (student.challan?.heads || []).map(h => `<tr><td>${stuEsc(h.name)}</td><td class="r">${stuMoney(h.amt)}</td></tr>`).join('')
    : Object.entries(payment?.perHead || {}).map(([n, v]) => `<tr><td>${stuEsc(n)}</td><td class="r">${stuMoney(v)}</td></tr>`).join('');
  const total = isChallan ? (student.challan?.total || 0) : (payment?.amount || 0);
  const totalLabel = isChallan ? 'Total Challan Amount' : 'Amount Received';

  if (size === 'thermal') {
    return {
      css: `
        *{box-sizing:border-box;margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif}
        body{padding:0}
        .slip{width:76mm;margin:0 auto;padding:4mm}
        .th-head{text-align:center;margin-bottom:6px}
        .th-logo{width:28px;height:28px;margin:0 auto 4px}
        .th-name{font-size:12px;font-weight:800;color:#111}
        .th-addr{font-size:8.5px;color:#555;margin-top:1px}
        .th-title{font-size:10.5px;font-weight:800;margin-top:6px;border-top:1px dashed #888;border-bottom:1px dashed #888;padding:4px 0;text-align:center}
        .th-kv{display:flex;justify-content:space-between;font-size:9.5px;margin:2px 0}
        table{width:100%;border-collapse:collapse;margin-top:6px;font-size:9.5px}
        td{padding:2px 0}
        td.r{text-align:right}
        .th-total{display:flex;justify-content:space-between;font-weight:800;font-size:11px;border-top:1px dashed #888;margin-top:6px;padding-top:4px}
        .th-foot{text-align:center;font-size:8px;color:#888;margin-top:8px}
        @page{size:80mm auto;margin:0}
        @media print{body{padding:0}}
      `,
      html: `
        <div class="slip">
          <div class="th-head">
            <div class="th-logo">${stuSchoolLogoSVG()}</div>
            <div class="th-name">${stuEsc(school?.name || 'School')}</div>
            ${school?.address ? `<div class="th-addr">${stuEsc(school.address)}</div>` : ''}
          </div>
          <div class="th-title">${title}</div>
          <div class="th-kv"><span>Student</span><b>${stuEsc(stuFullName(student))}</b></div>
          <div class="th-kv"><span>Reg No</span><b>${stuEsc(student.reg || student.preId)}</b></div>
          <div class="th-kv"><span>Class</span><b>${stuEsc(student.cls)} (${stuEsc(student.sec)})</b></div>
          <div class="th-kv"><span>Date</span><b>${genDate}</b></div>
          ${!isChallan ? `<div class="th-kv"><span>Method</span><b>${stuEsc(payment?.method || '')}</b></div>` : ''}
          <table><tbody>${rows}</tbody></table>
          <div class="th-total"><span>${totalLabel}</span><span>${stuMoney(total)}</span></div>
          <div class="th-foot">Powered by School Mentor&reg;</div>
        </div>
      `,
    };
  }

  return {
    css: `
      *{box-sizing:border-box;margin:0;padding:0;font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif}
      html,body{background:#F1F3F8}
      body{padding:18px 0;font-size:11px}
      .page{width:210mm;min-height:297mm;margin:0 auto;padding:16mm;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,.12)}
      .rhead{display:flex;align-items:center;gap:14px;border-bottom:2px solid #1E3A8A;padding-bottom:12px;margin-bottom:16px}
      .rlogo{width:46px;height:46px;flex-shrink:0}
      .rname{font-size:18px;font-weight:800;color:#0F172A}
      .rtitle{font-size:12.5px;font-weight:700;color:#1E3A8A;margin-top:3px}
      .meta{margin-left:auto;font-size:10px;color:#64748B;text-align:right;line-height:1.6}
      .sec-band{background:#1E3A8A;color:#fff;padding:7px 13px;border-radius:6px;font-weight:800;font-size:11.5px;margin:16px 0 9px}
      .tbl{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;font-size:11px}
      .tbl thead th{background:#1E3A8A;color:#fff;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.3px;font-weight:800}
      .tbl th.r,.tbl td.r{text-align:right}
      .tbl td{padding:8px 10px;border-bottom:1px solid #F1F3F8}
      .tbl tbody tr:nth-child(even) td{background:#FBFCFF}
      .tbl tfoot td{font-weight:800;background:#F8FAFF;border-top:1.5px solid #E5E7EB}
      .rfoot{margin-top:18px;text-align:center;font-size:9.5px;color:#94A3B8;border-top:1px solid #e5e9f2;padding-top:9px}
      @page{size:A4 portrait;margin:0}
      @media print{body{background:#fff;padding:0}.page{width:auto;min-height:0;margin:0;padding:14mm;box-shadow:none}}
    `,
    html: `
      <div class="page">
        <div class="rhead">
          <div class="rlogo">${stuSchoolLogoSVG()}</div>
          <div><div class="rname">${stuEsc(school?.name || 'School')}</div><div class="rtitle">${title}</div></div>
          <div class="meta">Generated: ${genDate}<br/>${stuEsc(school?.session || '')}</div>
        </div>
        <div class="sec-band">Student Details</div>
        <table class="tbl">
          <tbody>
            <tr><td><b>Name</b></td><td>${stuEsc(stuFullName(student))}</td><td><b>Reg No</b></td><td>${stuEsc(student.reg || student.preId)}</td></tr>
            <tr><td><b>Father Name</b></td><td>${stuEsc(student.father || '—')}</td><td><b>Class</b></td><td>${stuEsc(student.cls)} (${stuEsc(student.sec)})</td></tr>
            <tr><td><b>Contact</b></td><td>${stuEsc(student.mobile || '—')}</td><td><b>Date</b></td><td>${genDate}</td></tr>
          </tbody>
        </table>
        <div class="sec-band">${isChallan ? 'Challan Details' : 'Payment Details'}</div>
        <table class="tbl">
          <thead><tr><th>Fee Head</th><th class="r">Amount</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td>${totalLabel}</td><td class="r">${stuMoney(total)}</td></tr></tfoot>
        </table>
        ${!isChallan && payment ? `<div style="margin-top:10px;font-size:10.5px;color:#475569">Method: <b>${stuEsc(payment.method)}</b>${payment.ref ? ` &middot; Ref: <b>${stuEsc(payment.ref)}</b>` : ''}${payment.txn ? ` &middot; Txn: <b>${stuEsc(payment.txn)}</b>` : ''}</div>` : ''}
        <div class="rfoot">${stuEsc(school?.name || 'School')} · ${title} · Generated ${genDate}</div>
      </div>
    `,
  };
}

function PreEnrollSlipModal({ cfg, school, onClose, toast }) {
  const [size, setSize] = useState('a4');
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const { kind, student, payment } = cfg;
  const title = kind === 'challan' ? 'Print Challan Slip' : 'Print Receiving Slip';

  const handlePrint = () => {
    const { css, html } = buildPreEnrollSlipHTML({ kind, student, payment, school, size });
    stuOpenPrintWindow(`${kind === 'challan' ? 'Challan' : 'Receipt'} — ${stuFullName(student)}`, css, html, toast);
    onClose();
  };

  return createPortal(
    <div className="fee-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fee-modal sm">
        <div className="fee-modal-head">
          <div className="fee-modal-head-title">
            <div className="fee-modal-head-icon"><i className="fa-solid fa-print"></i></div>
            <div>
              <div className="fee-modal-title">{title}</div>
              <div className="fee-modal-sub">{stuFullName(student)} · {student.reg || student.preId}</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="fee-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>
        <div className="fee-modal-body">
          <div className="fee-dl-label">Paper Size</div>
          <div className="fee-dl-fmt-grid">
            <button type="button" className={`fee-dl-fmt${size === 'a4' ? ' sel' : ''}`} onClick={() => setSize('a4')}>
              <div className="fee-dl-fmt-ic" style={{ background: 'rgba(30,58,138,.1)', color: '#1E3A8A' }}><i className="fa-solid fa-file-lines"></i></div>
              <div><div className="fee-dl-fmt-name">A4 Size</div><div className="fee-dl-desc">Full page, with school header</div></div>
            </button>
            <button type="button" className={`fee-dl-fmt${size === 'thermal' ? ' sel' : ''}`} onClick={() => setSize('thermal')}>
              <div className="fee-dl-fmt-ic" style={{ background: 'rgba(22,163,74,.1)', color: '#16A34A' }}><i className="fa-solid fa-receipt"></i></div>
              <div><div className="fee-dl-fmt-name">Thermal</div><div className="fee-dl-desc">80mm receipt printer</div></div>
            </button>
          </div>
        </div>
        <div className="fee-modal-foot">
          <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="fee-btn fee-btn-primary" onClick={handlePrint}>
            <i className="fa-solid fa-print"></i> Print
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ─── Coming Soon placeholder used for every not-yet-built screen ──── */
function StuComingSoon({ label, icon }) {
  return (
    <div className="fee-section">
      <div className="fee-section-body">
        <div className="stu-coming">
          <div className="stu-coming-ic">
            <i className={`fa-solid ${icon}`}></i>
          </div>
          <div className="stu-coming-title">{label}</div>
          <div className="stu-coming-sub">
            This screen is being implemented step-by-step from the design reference.
            <br />Stay tuned — it will land in an upcoming step.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STYLES — page-header / tutorial chip / sub-tab pill row live
   globally in App.js, so we only ship the sub-tab visuals (matching
   Accounts/Inventory/CRM stretched pattern) plus the Coming Soon
   placeholder. Module-specific styling lands in later steps.
   ═══════════════════════════════════════════════════════════════════ */
const STU_CSS = `
/* Sub-tabs (shared with Fee/Accounts/Inventory/CRM — stretched to row) */
.fee-subtabs {
  display: flex;
  gap: 6px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 16px;
  padding: 5px;
  margin-bottom: 18px;
  box-shadow: 0 1px 2px rgba(15,23,42,.04);
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
  border-radius: 12px;
  border: none;
  background: transparent;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  transition: all .2s ease;
  white-space: nowrap;
  flex: 1;
}
.fee-subtab:hover:not(.active) { background: var(--bg-muted); color: var(--text-primary); }
.fee-subtab.active {
  background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 60%, #2563EB 100%);
  color: #fff;
  box-shadow: 0 6px 20px rgba(30,58,138,.4), inset 0 1px 0 rgba(255,255,255,.2);
}
.fee-subtab i { font-size: 12px; }

/* Section card */
.fee-section {
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(15,23,42,.04);
  overflow: hidden;
  margin-bottom: 16px;
}
.fee-section-body { padding: 22px 24px; }

/* Coming Soon placeholder */
.stu-coming {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 38px 20px;
  gap: 16px;
}
.stu-coming-ic {
  width: 64px; height: 64px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(30,58,138,.08), rgba(124,58,237,.08));
  border: 1.5px dashed rgba(30,58,138,.32);
  color: #1E3A8A;
  display: flex; align-items: center; justify-content: center;
  font-size: 26px;
}
.stu-coming-title {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -.01em;
}
.stu-coming-sub {
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.7;
  max-width: 480px;
}

/* ═══════════════════════════════════════════════════════════════════
   ACTIVE STUDENTS — KPI strip, info banner, toolbar, search dropdown,
   class table, student rows, action menu
   ═══════════════════════════════════════════════════════════════════ */

/* KPI strip */
.stu-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}
.stu-stat {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(15,23,42,.04);
  transition: all .2s ease;
}
.stu-stat:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(15,23,42,.08); }
.stu-stat-icon {
  width: 42px; height: 42px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 17px;
  flex-shrink: 0;
}
.stu-stat-icon.blue   { background: rgba(30,58,138,.10);  color: #1E40AF; }
.stu-stat-icon.green  { background: rgba(22,163,74,.12);  color: #16A34A; }
.stu-stat-icon.violet { background: rgba(124,58,237,.12); color: #7C3AED; }
.stu-stat-icon.amber  { background: rgba(217,119,6,.12);  color: #D97706; }
.stu-stat-val { font-size: 22px; font-weight: 800; color: var(--text-primary); letter-spacing: -.02em; line-height: 1.05; font-variant-numeric: tabular-nums; }
.stu-stat-lbl { font-size: 12px; color: var(--text-muted); font-weight: 700; margin-top: 3px; }

/* Info banner */
.stu-info {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 11px 16px;
  background: rgba(30,58,138,.05);
  border: 1.5px solid rgba(30,58,138,.18);
  border-radius: 12px;
  font-size: 12.5px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 14px;
}
.stu-info i { color: #1E3A8A; font-size: 14px; margin-top: 1px; flex-shrink: 0; }
.stu-info strong { color: var(--text-primary); }

/* Toolbar */
.stu-toolbar {
  display: flex; gap: 12px; align-items: center;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.stu-search-wrap {
  position: relative;
  flex: 1;
  min-width: 260px;
  display: flex; align-items: center;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  height: 44px;
  padding: 0 14px;
  gap: 10px;
  transition: all .15s ease;
}
.stu-search-wrap:focus-within { border-color: #1E3A8A; box-shadow: 0 0 0 3px rgba(30,58,138,.12); }
.stu-search-wrap > i { color: var(--text-muted); font-size: 13px; }
.stu-search-input {
  flex: 1;
  border: none; outline: none; background: transparent;
  font-size: 13px;
  font-family: var(--font-body);
  color: var(--text-primary);
}
.stu-search-clear {
  width: 24px; height: 24px;
  border: none; background: var(--bg-muted);
  border-radius: 50%;
  color: var(--text-muted);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.stu-search-clear:hover { background: rgba(220,38,38,.12); color: #DC2626; }

/* Search dropdown */
.stu-sr {
  position: absolute;
  top: calc(100% + 6px); left: 0; right: 0;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  box-shadow: 0 18px 40px rgba(15,23,42,.18);
  z-index: 80;
  max-height: 380px;
  overflow-y: auto;
}
.stu-sr-empty { padding: 16px; text-align: center; font-size: 12.5px; color: var(--text-muted); font-style: italic; }
.stu-sr-empty b { color: var(--text-primary); font-weight: 800; font-style: normal; }
.stu-sr-item {
  width: 100%;
  display: flex; align-items: center; gap: 12px;
  padding: 11px 14px;
  border: none; background: transparent;
  border-bottom: 1px solid var(--border-light);
  cursor: pointer;
  text-align: left;
  font-family: var(--font-body);
  transition: background .15s ease;
}
.stu-sr-item:last-child { border-bottom: none; }
.stu-sr-item:hover { background: rgba(30,58,138,.05); }
.stu-sr-av {
  width: 36px; height: 36px;
  border-radius: 11px;
  background: rgba(30,58,138,.10);
  color: #1E40AF;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800;
  font-size: 11px;
  flex-shrink: 0;
}
.stu-sr-main { flex: 1; min-width: 0; }
.stu-sr-name { font-size: 13px; font-weight: 800; color: var(--text-primary); letter-spacing: -.01em; }
.stu-sr-meta { display: flex; flex-wrap: wrap; gap: 3px 12px; font-size: 11px; color: var(--text-muted); margin-top: 3px; }
.stu-sr-go {
  width: 26px; height: 26px;
  border-radius: 8px;
  background: var(--bg-muted);
  color: #1E3A8A;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px;
  flex-shrink: 0;
  transition: all .15s ease;
}
.stu-sr-item:hover .stu-sr-go { background: #1E3A8A; color: #fff; transform: translateX(2px); }
.stu-sr-foot { padding: 9px 14px; background: var(--bg-muted); border-top: 1px solid var(--border-light); font-size: 11px; color: var(--text-muted); text-align: center; }
.stu-sr-foot b { color: var(--text-primary); font-weight: 800; }

.stu-toolbar-actions { display: flex; gap: 8px; flex-shrink: 0; }
.stu-iconbtn {
  width: 44px; height: 44px;
  border-radius: 12px;
  border: 1.5px solid var(--border-light);
  background: var(--bg-card);
  color: var(--text-muted);
  font-size: 14px;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: all .15s ease;
}
.stu-iconbtn:hover { background: #1E3A8A; color: #fff; border-color: #1E3A8A; transform: translateY(-1px); }
.stu-rowbtn {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 14px;
  border-radius: 10px;
  border: 1.5px solid var(--border-light);
  background: var(--bg-card);
  color: var(--text-secondary);
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all .15s ease;
  white-space: nowrap;
}
.stu-rowbtn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(15,23,42,.08); }
.stu-rowbtn i { font-size: 11px; }
.stu-rowbtn.admission-cta {
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 4px 12px rgba(30,58,138,.28);
  height: 44px;
  padding: 0 18px;
}
.stu-rowbtn.admission-cta:hover { box-shadow: 0 8px 22px rgba(30,58,138,.40); }
.stu-rowbtn.promote {
  background: rgba(22,163,74,.06);
  border-color: rgba(22,163,74,.32);
  color: #15803D;
}
.stu-rowbtn.promote:hover { background: #16A34A; border-color: #16A34A; color: #fff; }
.stu-rowbtn.add {
  background: rgba(30,58,138,.06);
  border-color: rgba(30,58,138,.32);
  color: #1E40AF;
}
.stu-rowbtn.add:hover { background: #1E3A8A; border-color: #1E3A8A; color: #fff; }

/* Class table */
.stu-section { overflow: visible; }
.stu-table-head {
  display: grid;
  grid-template-columns: 54px 1.4fr 1fr 110px 90px 280px 70px;
  gap: 12px;
  padding: 13px 18px;
  background: var(--bg-muted);
  border-bottom: 1.5px solid var(--border-light);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .4px;
  color: var(--text-muted);
}
.stu-table-head .th.c { text-align: center; }
@media (max-width: 1100px) {
  .stu-table-head, .stu-cls-row { grid-template-columns: 54px 1.4fr 1fr 90px 70px !important; }
  .stu-table-head .th:nth-child(5),
  .stu-table-head .th:nth-child(6),
  .stu-cls-row .td:nth-child(5),
  .stu-cls-row .td:nth-child(6) { display: none; }
}
/* Roster (per-class student rows) — hide DOB + Father at narrow widths
   to prevent the 8-col grid from overflowing on tablets/phones. */
@media (max-width: 900px) {
  .stu-list-head, .stu-srow { grid-template-columns: 40px 50px 1fr 1.2fr 1fr 60px !important; gap: 8px !important; }
  .stu-list-head .th:nth-child(5),
  .stu-list-head .th:nth-child(6),
  .stu-srow .td:nth-child(5),
  .stu-srow .td:nth-child(6) { display: none; }
}
@media (max-width: 600px) {
  .stu-list-head, .stu-srow { grid-template-columns: 34px 46px 1fr 60px !important; gap: 6px !important; }
  .stu-list-head .th:nth-child(3),
  .stu-list-head .th:nth-child(7),
  .stu-srow .td:nth-child(3),
  .stu-srow .td:nth-child(7) { display: none; }

  /* ═══════════════════════════════════════════════════════════════════
     STUDENTS — Active + Inactive class rows → compact mobile cards
     The desktop .stu-cls-row uses a 7-col grid (Active) or a 6-col inline
     grid (Inactive). The 1100px rule already hides cells 5 (Report) and
     6 (Actions/Chev) — which hides ALL action buttons on phones, breaking
     the layout. We unhide them and reflow into a 2-line flex-wrap card.

     Cell map (.stu-cls-row > .td):
       Active   (7 cells): 1=SN, 2=Class, 3=Sec, 4=Strength, 5=Report,
                           6=Actions(Promotion+Add), 7=Chev
       Inactive (6 cells): 1=SN, 2=Class, 3=Sec, 4=Strength, 5=Report, 6=Chev
     ═══════════════════════════════════════════════════════════════════ */

  /* Hide column header on mobile (card layout doesn't need it) */
  .stu-table-head { display: none !important; }

  /* Cancel horizontal scroll if any wrapper has it */
  .stu-section { overflow-x: visible !important; }

  /* Bring back the action cells hidden by the 1100px rule */
  .stu-cls-row .td:nth-child(5),
  .stu-cls-row .td:nth-child(6) { display: flex !important; }

  /* Convert the row to a flex-wrap card; cancel grid + inline grid */
  .stu-cls-row {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    grid-template-columns: none !important;
    column-gap: 8px !important;
    row-gap: 10px !important;
    padding: 12px 14px !important;
    min-height: 0 !important;
  }
  .stu-cls-row > .td { padding: 0 !important; min-width: 0 !important; gap: 8px !important; }

  /* Row 1 placement */
  .stu-cls-row > .td:nth-of-type(1) { order: 1 !important; flex: 0 0 auto !important; }
  .stu-cls-row > .td:nth-of-type(2) { order: 2 !important; flex: 1 1 auto !important; }
  .stu-cls-row > .td:nth-of-type(3) { order: 3 !important; flex: 0 0 auto !important; }

  /* Chev — always the LAST cell, regardless of table (6 or 7 cells).
     Target via :has(.stu-chev) so we pin it to Row 1 right without
     depending on a fixed nth-of-type number. */
  .stu-cls-row > .td:has(.stu-chev) {
    order: 4 !important;
    flex: 0 0 auto !important;
    margin-left: auto !important;
    justify-content: flex-end !important;
  }

  /* Wrap break between Row 1 (orders 1–4) and Row 2 (orders 5+) */
  .stu-cls-row::after {
    content: "";
    flex: 1 1 100%;
    height: 0;
    order: 4.5;
  }

  /* Row 2 placement: Strength · Report · Actions (Active only) */
  .stu-cls-row > .td:nth-of-type(4) {
    order: 5 !important;
    flex: 0 0 auto !important;
  }
  .stu-cls-row > .td:nth-of-type(5) {
    order: 6 !important;
    flex: 0 0 auto !important;
  }
  .stu-cls-row > .td.stu-cls-actions {
    order: 7 !important;
    flex: 1 1 auto !important;
    margin-left: auto !important;
    justify-content: flex-end !important;
    gap: 6px !important;
    flex-wrap: wrap !important;
  }

  /* Tighten sub-pieces so the card fits without clipping */
  .stu-cls-sn { width: 28px; height: 28px; font-size: 12px; border-radius: 8px; }
  .stu-cls-ic { width: 32px; height: 32px; font-size: 13px; }
  .stu-cls-name-wrap { gap: 9px !important; }
  .stu-cls-name { font-size: 13.5px; line-height: 1.3; word-break: normal; overflow-wrap: break-word; }
  .stu-cls-sub  { font-size: 10.5px; line-height: 1.3; }
  .stu-sec-pill { font-size: 11px; padding: 3px 9px; }
  .stu-strength { font-size: 12.5px; padding: 4px 11px; }
  .stu-rep-btn  { width: 32px; height: 32px; font-size: 12px; }
  .stu-chev     { width: 30px; height: 30px; font-size: 10.5px; }

  /* Action text-buttons tighten + stay touch-friendly */
  .stu-cls-actions .stu-rowbtn { padding: 6px 10px; font-size: 11.5px; gap: 5px; }
  .stu-cls-actions .stu-rowbtn i { font-size: 10.5px; }
}

.stu-clswrap { border-bottom: 1px solid var(--border-light); }
.stu-clswrap:last-child { border-bottom: none; }
.stu-cls-row {
  display: grid;
  grid-template-columns: 54px 1.4fr 1fr 110px 90px 280px 70px;
  gap: 12px;
  padding: 14px 18px;
  align-items: center;
  cursor: pointer;
  transition: background .15s ease;
  min-height: 70px;
}
.stu-cls-row:hover { background: rgba(30,58,138,.04); }
.stu-clswrap.open .stu-cls-row { background: rgba(30,58,138,.06); }
.stu-cls-row .td { display: flex; align-items: center; gap: 10px; min-width: 0; }
.stu-cls-row .td.c { justify-content: center; }
.stu-cls-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.stu-cls-sn {
  width: 32px; height: 32px;
  border-radius: 10px;
  background: var(--bg-muted);
  color: var(--text-secondary);
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 13px;
  border: 1px solid var(--border-light);
}
.stu-cls-name-wrap { display: flex; align-items: center; gap: 11px; min-width: 0; }
.stu-cls-ic {
  width: 38px; height: 38px;
  border-radius: 11px;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(30,58,138,.28);
}
.stu-cls-name { font-size: 14px; font-weight: 800; color: var(--text-primary); letter-spacing: -.01em; }
.stu-cls-sub  { font-size: 11.5px; color: var(--text-muted); margin-top: 1px; }
.stu-sec-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(124,58,237,.08);
  color: #7C3AED;
  border: 1px solid rgba(124,58,237,.22);
  font-size: 12px;
  font-weight: 800;
}
.stu-sec-pill i { font-size: 10px; }
.stu-strength {
  display: inline-flex; align-items: center;
  padding: 5px 14px;
  border-radius: 999px;
  background: rgba(30,58,138,.08);
  color: #1E40AF;
  font-size: 14px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.stu-rep-btn {
  width: 36px; height: 36px;
  border-radius: 10px;
  border: 1.5px solid var(--border-light);
  background: var(--bg-card);
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: all .15s ease;
}
.stu-rep-btn:hover { background: #1E3A8A; border-color: #1E3A8A; color: #fff; }
.stu-chev {
  width: 32px; height: 32px;
  border-radius: 10px;
  border: 1.5px solid var(--border-light);
  background: var(--bg-card);
  color: var(--text-muted);
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px;
  transition: all .15s ease;
}
.stu-chev:hover { background: var(--bg-muted); color: var(--text-primary); }
.stu-chev .rot { transform: rotate(180deg); transition: transform .25s ease; }
.stu-chev i { transition: transform .25s ease; }

/* Detail (expanded) */
.stu-detail {
  max-height: 0; overflow: hidden;
  transition: max-height .4s cubic-bezier(.4,0,.2,1);
  border-top: 1px solid transparent;
}
.stu-detail.open {
  max-height: 9000px;
  border-top-color: var(--border-light);
  overflow: visible;   /* allow the 3-dot action menu to escape the panel */
}
.stu-detail-inner {
  padding: 18px 20px 22px;
  background: linear-gradient(135deg, rgba(30,58,138,.02), transparent 70%);
}
.stu-detail-head {
  display: flex; justify-content: space-between; align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.stu-detail-title {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: .3px;
  text-transform: uppercase;
  color: var(--text-secondary);
  display: inline-flex; align-items: center; gap: 8px;
}
.stu-detail-title i { color: #1E3A8A; }

/* Student list (inner) */
.stu-list-head {
  display: grid;
  grid-template-columns: 46px 58px 1.1fr 1.3fr 1.1fr 1fr 1.1fr 60px;
  gap: 10px;
  padding: 10px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 10px 10px 0 0;
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .4px;
  color: var(--text-muted);
}
.stu-list-head .th.c { text-align: center; }
.stu-srow {
  position: relative;
  display: grid;
  grid-template-columns: 46px 58px 1.1fr 1.3fr 1.1fr 1fr 1.1fr 60px;
  gap: 10px;
  padding: 12px 14px;
  background: var(--bg-card);
  border-left: 1px solid var(--border-light);
  border-right: 1px solid var(--border-light);
  border-bottom: 1px solid var(--border-light);
  align-items: center;
  transition: background .15s ease;
  overflow: visible;
}
.stu-srow:last-child { border-radius: 0 0 10px 10px; }
.stu-srow:hover { background: rgba(30,58,138,.03); }
.stu-srow.flash { animation: stuFlash 2.2s ease; }
@keyframes stuFlash {
  0%   { background: rgba(217,119,6,.18); }
  50%  { background: rgba(217,119,6,.10); }
  100% { background: var(--bg-card); }
}
.stu-srow .td { display: flex; align-items: center; gap: 10px; min-width: 0; font-size: 12.5px; color: var(--text-secondary); }
.stu-srow .td.c { justify-content: center; }
.stu-srow-sn { font-size: 11px; font-weight: 800; color: var(--text-muted); }
.stu-avatar {
  width: 36px; height: 36px;
  border-radius: 11px;
  background: rgba(30,58,138,.10);
  color: #1E40AF;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800;
  font-size: 11px;
  overflow: hidden;
}
.stu-avatar img { width: 100%; height: 100%; object-fit: cover; }
.stu-reg-cell { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 800; color: #1E40AF; font-size: 11.5px; letter-spacing: .3px; }
.stu-srow-name { font-size: 13px; font-weight: 800; color: var(--text-primary); letter-spacing: -.01em; }
.stu-srow-sub  { font-size: 11px; color: var(--text-muted); margin-top: 1px; }
.stu-dob-cell, .stu-contact-cell, .stu-father-cell { font-size: 12px; }

/* Red corner discount marker */
.stu-disc-corner {
  position: absolute;
  top: 0; right: 0;
  width: 0; height: 0;
  border-style: solid;
  border-width: 0 22px 22px 0;
  border-color: transparent #DC2626 transparent transparent;
  z-index: 1;
}

/* 3-dot button + action menu */
.stu-dots {
  width: 32px; height: 32px;
  border-radius: 9px;
  border: 1.5px solid var(--border-light);
  background: var(--bg-card);
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: all .15s ease;
}
.stu-dots:hover { background: #1E3A8A; color: #fff; border-color: #1E3A8A; }
.stu-actmenu {
  position: absolute;
  right: 14px;
  top: 100%;
  margin-top: 6px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  box-shadow: 0 18px 40px rgba(15,23,42,.20);
  width: 250px;
  z-index: 100;
  padding: 5px;
  display: flex;
  flex-direction: column;
  animation: stuMenuIn .15s ease;
  /* Keep menu within viewport: scroll the menu itself when content overflows. */
  max-height: min(380px, calc(100vh - 120px));
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: #94A3B8 transparent;
}
.stu-actmenu::-webkit-scrollbar { width: 7px; }
.stu-actmenu::-webkit-scrollbar-track { background: transparent; }
.stu-actmenu::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #94A3B8, #64748B);
  border-radius: 999px;
  border: 2px solid var(--bg-card);
}
/* Flip menu upward when row is near the bottom of the viewport. */
.stu-actmenu--up {
  top: auto;
  bottom: 100%;
  margin-top: 0;
  margin-bottom: 6px;
  animation: stuMenuInUp .15s ease;
}
@keyframes stuMenuInUp {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: none; }
}
@keyframes stuMenuIn {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: none; }
}
.stu-actmenu-lbl {
  padding: 8px 12px 10px;
  font-size: 11px;
  font-weight: 800;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: .35px;
  border-bottom: 1px solid var(--border-light);
  margin-bottom: 5px;
  text-align: left;
}
.stu-actitem {
  display: flex; align-items: center;
  gap: 10px;
  padding: 9px 11px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-family: var(--font-body);
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  transition: background .12s ease;
  width: 100%;
}
.stu-actitem:hover { background: var(--bg-muted); }
.stu-actitem:disabled { opacity: .5; cursor: not-allowed; }
.stu-actitem:disabled:hover { background: transparent; }
.stu-actitem i { font-size: 12px; width: 16px; text-align: center; }
.stu-actitem--sub {
  display: flex; align-items: center; justify-content: space-between;
}
.stu-actitem--sub > span { display: inline-flex; align-items: center; gap: 10px; }
.stu-sub-chev { font-size: 9px; color: var(--text-muted); }
.stu-actmenu-sub {
  margin: 2px 0 4px 18px;
  padding-left: 8px;
  border-left: 2px solid var(--border-light);
}
.stu-actmenu-sub .stu-actitem { font-size: 12px; }
.stu-actmenu-div {
  height: 1px;
  background: var(--border-light);
  margin: 5px 6px;
}
.stu-actitem--danger { color: #DC2626; }
.stu-actitem--danger:hover { background: rgba(220,38,38,.08); }
.stu-actitem--danger i { color: #DC2626; }

.stu-list-empty {
  text-align: center;
  padding: 28px 14px;
  background: var(--bg-card);
  border: 1.5px dashed var(--border-light);
  border-radius: 12px;
  color: var(--text-muted);
  font-size: 12.5px;
}
.stu-list-empty i { display: block; font-size: 24px; color: #1E40AF; margin-bottom: 8px; }
.stu-list-empty strong { color: var(--text-primary); }

.stu-empty {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  padding: 42px 20px;
  gap: 12px;
}
.stu-empty-ic {
  width: 60px; height: 60px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(30,58,138,.08), rgba(124,58,237,.08));
  border: 1.5px dashed rgba(30,58,138,.32);
  color: #1E3A8A;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px;
}
.stu-empty-title { font-size: 15px; font-weight: 800; color: var(--text-primary); }
.stu-empty-sub { font-size: 12.5px; color: var(--text-muted); max-width: 380px; line-height: 1.55; }

/* ═══════════════════════════════════════════════════════════════════
   STUDENT MODAL — overlay, head, tabs, sections, photo, docs, fee
   ═══════════════════════════════════════════════════════════════════ */
.stu-modal-overlay {
  position: fixed; inset: 0;
  background: rgba(10,22,40,.55);
  backdrop-filter: blur(4px);
  z-index: 1500;
  display: none;
  align-items: center; justify-content: center;
  padding: 20px;
}
@media (max-width: 540px) {
  .stu-modal-overlay { padding: 8px; }
  .stu-modal { max-width: 96vw !important; max-height: 95dvh !important; }
}
.stu-modal-overlay.open { display: flex; }
.stu-modal {
  background: var(--bg-card);
  border-radius: 18px;
  width: 100%;
  max-width: 940px;
  max-height: 92vh;
  display: flex; flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(15,23,42,.32);
  animation: stuModalIn .2s ease;
}
@keyframes stuModalIn {
  from { opacity: 0; transform: translateY(8px) scale(.98); }
  to   { opacity: 1; transform: none; }
}
.stu-modal-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border-light);
  gap: 14px;
}
.stu-modal-head-title { display: flex; align-items: center; gap: 12px; min-width: 0; }
.stu-modal-head-icon {
  width: 42px; height: 42px;
  border-radius: 12px;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px;
  box-shadow: 0 6px 16px rgba(30,58,138,.32);
  flex-shrink: 0;
}
.stu-modal-title { font-size: 16px; font-weight: 800; color: var(--text-primary); letter-spacing: -.01em; }
.stu-modal-sub   { font-size: 11.5px; color: var(--text-muted); margin-top: 2px; }
.stu-modal-close {
  width: 34px; height: 34px;
  border-radius: 10px;
  border: none; background: var(--bg-muted);
  color: var(--text-muted);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px;
}
.stu-modal-close:hover { background: rgba(220,38,38,.12); color: #DC2626; }

/* Modal internal tabs */
.stu-mtabs {
  display: flex; gap: 4px;
  padding: 10px 22px 0;
  border-bottom: 1.5px solid var(--border-light);
  margin-bottom: 0;
}
.stu-mtab {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 18px;
  border: none;
  background: transparent;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted);
  cursor: pointer;
  border-bottom: 2.5px solid transparent;
  transition: all .15s ease;
}
.stu-mtab:hover:not(.active) { color: var(--text-primary); }
.stu-mtab.active {
  color: #1E40AF;
  border-bottom-color: #1E40AF;
}
.stu-mtab i { font-size: 12px; }

.stu-modal-body {
  flex: 1;
  min-height: 0;            /* lets the flex item actually scroll */
  overflow-y: auto;
  overflow-x: hidden;
  padding: 18px 22px;
  scrollbar-width: thin;
  scrollbar-color: #94A3B8 transparent;
}
.stu-modal-body::-webkit-scrollbar { width: 10px; }
.stu-modal-body::-webkit-scrollbar-track { background: transparent; }
.stu-modal-body::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #94A3B8, #64748B);
  border-radius: 999px;
  border: 2px solid var(--bg-card);
}
.stu-modal-body::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, #64748B, #475569); }
[data-theme="dark"] .stu-modal-body::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #475569, #334155); border-color: var(--bg-card); }

/* Collapsible form sections */
.stu-fsec {
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 14px;
  margin-bottom: 12px;
  overflow: hidden;
}
.stu-fsec-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px;
  background: var(--bg-muted);
  cursor: pointer;
  transition: background .15s ease;
}
.stu-fsec-head:hover { background: rgba(30,58,138,.06); }
.stu-fsec.open .stu-fsec-head { background: rgba(30,58,138,.08); border-bottom: 1px solid var(--border-light); }
.stu-fsec-head-l { display: flex; align-items: center; gap: 11px; }
.stu-fsec-ic {
  width: 32px; height: 32px;
  border-radius: 10px;
  background: linear-gradient(135deg, #1E3A8A, #2563EB);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px;
}
.stu-fsec-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -.01em;
}
.stu-fsec-chev { color: var(--text-muted); font-size: 11px; }
.stu-fsec-body { padding: 16px; }

/* Form grids */
.stu-fgrid { display: grid; gap: 12px; }
.stu-fgrid-2 { grid-template-columns: 1fr 1fr; }
.stu-fgrid-3 { grid-template-columns: 1fr 1fr 1fr; }
.stu-fgrid-4 { grid-template-columns: 1fr 1fr 1fr 1fr; }
.stu-fgrid-tight { gap: 10px; margin-top: 14px; }
@media (max-width: 880px) {
  .stu-fgrid-3, .stu-fgrid-4 { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 540px) {
  .stu-fgrid-2, .stu-fgrid-3, .stu-fgrid-4 { grid-template-columns: 1fr; }
}
.stu-fg { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.stu-fg-wide { grid-column: span 2; }
.stu-flabel {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .4px;
  color: var(--text-muted);
}
.stu-finput {
  height: 38px;
  padding: 0 12px;
  border: 1.5px solid var(--border-light);
  border-radius: 9px;
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 13px;
  font-family: var(--font-body);
  transition: all .15s ease;
  width: 100%;
}
.stu-finput:focus { outline: none; border-color: #1E3A8A; box-shadow: 0 0 0 3px rgba(30,58,138,.12); }
select.stu-finput { appearance: none; padding-right: 32px; cursor: pointer; }
.stu-fhelp { font-size: 11px; color: var(--text-muted); line-height: 1.5; }

/* Registration section — photo + fields */
.stu-reg-grid {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 18px;
  align-items: flex-start;
}
@media (max-width: 720px) { .stu-reg-grid { grid-template-columns: 1fr; } }
.stu-photo-wrap {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.stu-photo-box {
  width: 160px; height: 180px;
  border: 2px dashed var(--border-med);
  border-radius: 14px;
  background: var(--bg-muted);
  display: flex; align-items: center; justify-content: center;
  flex-direction: column; gap: 6px;
  cursor: pointer;
  font-size: 11px; color: var(--text-muted);
  font-weight: 700;
  overflow: hidden;
  transition: all .15s ease;
}
.stu-photo-box:hover { border-color: #1E3A8A; background: rgba(30,58,138,.04); }
.stu-photo-box i { font-size: 32px; color: #1E3A8A; }
.stu-photo-box img { width: 100%; height: 100%; object-fit: cover; }
.stu-btn-link {
  display: inline-flex; align-items: center; gap: 6px;
  border: none; background: transparent;
  color: #1E3A8A;
  font-family: var(--font-body);
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 6px;
  transition: all .12s ease;
}
.stu-btn-link:hover { background: rgba(30,58,138,.08); }
.stu-btn-link--danger { color: #DC2626; }
.stu-btn-link--danger:hover { background: rgba(220,38,38,.06); }

/* Documents section */
.stu-doc-help {
  display: flex; gap: 9px; align-items: flex-start;
  padding: 10px 14px;
  background: rgba(30,58,138,.04);
  border: 1px solid rgba(30,58,138,.18);
  border-radius: 10px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.55;
  margin-bottom: 14px;
}
.stu-doc-help i { color: #1E40AF; font-size: 13px; flex-shrink: 0; margin-top: 1px; }
.stu-docslots {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}
.stu-docslot {
  display: flex; align-items: center; gap: 12px;
  padding: 11px 14px;
  background: var(--bg-muted);
  border: 1.5px solid var(--border-light);
  border-radius: 11px;
  transition: all .15s ease;
}
.stu-docslot.filled {
  background: rgba(22,163,74,.06);
  border-color: rgba(22,163,74,.32);
}
.stu-docslot-ic {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--text-muted);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}
.stu-docslot.filled .stu-docslot-ic {
  background: rgba(22,163,74,.16);
  color: #16A34A;
}
.stu-docslot-body { flex: 1; min-width: 0; }
.stu-docslot-name { font-size: 12.5px; font-weight: 800; color: var(--text-primary); }
.stu-docslot-status { font-size: 11px; color: var(--text-muted); margin-top: 1px; }
.stu-docslot.filled .stu-docslot-status { color: #15803D; }
.stu-docslot-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

.stu-doc-custom {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: end;
  padding: 14px;
  background: var(--bg-muted);
  border: 1px solid var(--border-light);
  border-radius: 11px;
  margin-bottom: 12px;
}
@media (max-width: 540px) { .stu-doc-custom { grid-template-columns: 1fr; } }
.stu-btn-secondary {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 0 16px;
  height: 38px;
  border: 1.5px solid var(--border-light);
  background: var(--bg-card);
  color: var(--text-secondary);
  border-radius: 9px;
  font-family: var(--font-body);
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all .15s ease;
}
.stu-btn-secondary:hover { background: #1E3A8A; border-color: #1E3A8A; color: #fff; transform: translateY(-1px); }

.stu-doclist { display: flex; flex-direction: column; gap: 7px; }
.stu-docitem {
  display: flex; align-items: center; gap: 11px;
  padding: 10px 13px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 10px;
}
.stu-docitem-ic {
  width: 32px; height: 32px;
  border-radius: 9px;
  background: rgba(124,58,237,.10);
  color: #7C3AED;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
}
.stu-docitem-body { flex: 1; min-width: 0; }
.stu-docitem-name { font-size: 12.5px; font-weight: 800; color: var(--text-primary); }
.stu-docitem-sub { font-size: 11px; color: var(--text-muted); margin-top: 1px; }

/* Fee tab */
.stu-feewrap {
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  overflow: hidden;
  overflow-x: auto;
  margin-bottom: 12px;
}
.stu-feetable { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.stu-feetable thead th {
  background: var(--bg-muted);
  text-align: left;
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .4px;
  color: var(--text-muted);
  padding: 11px 14px;
  border-bottom: 1.5px solid var(--border-light);
}
.stu-feetable th.r, .stu-feetable td.r { text-align: right; }
.stu-feetable td { padding: 12px 14px; border-bottom: 1px solid var(--border-light); color: var(--text-secondary); vertical-align: middle; }
.stu-feetable tbody tr:last-child td { border-bottom: none; }
.stu-feetable tbody tr:hover td { background: rgba(30,58,138,.03); }
.stu-feerow-name { font-weight: 800; color: var(--text-primary); font-size: 13px; }
.stu-feerow-sub  { font-size: 10.5px; color: var(--text-muted); margin-top: 2px; }
.stu-feetable .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; }
.stu-feetable tfoot td {
  background: rgba(30,58,138,.06);
  font-size: 13px;
  font-weight: 800;
  color: var(--text-primary);
  border-top: 1.5px solid var(--border-med);
}
.stu-disc-input {
  text-align: right;
  width: 110px;
  height: 32px;
  display: inline-block;
}
.stu-warn {
  display: flex; align-items: flex-start; gap: 9px;
  padding: 11px 14px;
  background: rgba(217,119,6,.06);
  border: 1px solid rgba(217,119,6,.28);
  border-radius: 10px;
  font-size: 12px;
  color: #92400E;
  line-height: 1.55;
}
.stu-warn i { color: #D97706; font-size: 13px; flex-shrink: 0; margin-top: 1px; }
.stu-warn strong { color: #B45309; }

.stu-modal-foot {
  display: flex; align-items: center; justify-content: flex-end;
  gap: 10px;
  padding: 14px 22px;
  border-top: 1px solid var(--border-light);
  background: var(--bg-muted);
}
.stu-modal-foot-hint {
  margin-right: auto;
  font-size: 11.5px;
  color: var(--text-muted);
}
.stu-modal-foot-hint strong { color: #DC2626; }
.stu-btn-ghost {
  padding: 9px 18px;
  border: 1.5px solid var(--border-light);
  background: var(--bg-card);
  color: var(--text-secondary);
  border-radius: 10px;
  font-family: var(--font-body);
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all .15s ease;
}
.stu-btn-ghost:hover { background: var(--bg-muted); border-color: var(--border-med); }
.stu-btn-primary {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 9px 22px;
  border: none;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  border-radius: 10px;
  font-family: var(--font-body);
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(30,58,138,.28);
  transition: all .15s ease;
}
.stu-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(30,58,138,.40); }
/* Save chalne ke dauran button lock rehta hai (double-submit se bachne ke liye) —
   hover ka lift/uthao bhi band, taake wo clickable na lage. */
.stu-btn-primary:disabled, .stu-btn-ghost:disabled, .stu-modal-close:disabled {
  opacity: .6;
  cursor: not-allowed;
}
.stu-btn-primary:disabled:hover { transform: none; box-shadow: 0 4px 14px rgba(30,58,138,.28); }
.stu-btn-ghost:disabled:hover { background: var(--bg-card); border-color: var(--border-light); }

[data-theme="dark"] .stu-modal { background: var(--bg-card); }
[data-theme="dark"] .stu-modal-foot { background: var(--bg-muted); }
[data-theme="dark"] .stu-mtab.active { color: #93C5FD; border-bottom-color: #2563EB; }
[data-theme="dark"] .stu-fsec, [data-theme="dark"] .stu-feewrap, [data-theme="dark"] .stu-docitem { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .stu-fsec-head, [data-theme="dark"] .stu-photo-box, [data-theme="dark"] .stu-docslot, [data-theme="dark"] .stu-doc-custom { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .stu-fsec-title, [data-theme="dark"] .stu-modal-title, [data-theme="dark"] .stu-docslot-name, [data-theme="dark"] .stu-docitem-name, [data-theme="dark"] .stu-feerow-name { color: var(--text-primary); }
[data-theme="dark"] .stu-feetable thead th, [data-theme="dark"] .stu-feetable tfoot td { background: var(--bg-muted); }
[data-theme="dark"] .stu-feetable tbody tr:hover td { background: rgba(59,130,246,.06); }
[data-theme="dark"] .stu-doc-help { background: rgba(59,130,246,.06); border-color: rgba(59,130,246,.22); color: var(--text-secondary); }
[data-theme="dark"] .stu-doc-help i { color: #93C5FD; }
[data-theme="dark"] .stu-warn { background: rgba(217,119,6,.10); border-color: rgba(217,119,6,.32); color: #FDBA74; }
[data-theme="dark"] .stu-finput { background: var(--bg-card); border-color: var(--border-light); color: var(--text-primary); }
[data-theme="dark"] .stu-btn-link { color: #93C5FD; }
[data-theme="dark"] .stu-btn-link:hover { background: rgba(59,130,246,.10); }

/* ═══════════════════════════════════════════════════════════════════
   PROMOTE / INACTIVE / DUES modal-specific styling
   ═══════════════════════════════════════════════════════════════════ */
.stu-checkrow {
  display: inline-flex; align-items: center; gap: 9px;
  padding: 10px 14px;
  background: var(--bg-muted);
  border: 1.5px solid var(--border-light);
  border-radius: 10px;
  font-size: 12.5px;
  color: var(--text-secondary);
  font-weight: 600;
  cursor: pointer;
}
.stu-checkrow input[type="checkbox"] {
  width: 16px; height: 16px;
  accent-color: #1E40AF;
  cursor: pointer;
}
.stu-checkrow:hover { background: rgba(30,58,138,.06); border-color: #1E3A8A; color: var(--text-primary); }

/* Promote table */
.stu-promo-tablewrap {
  margin-top: 14px;
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  overflow: hidden;
  max-height: 380px;
  overflow-y: auto;
}
.stu-promo-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.stu-promo-table thead th {
  background: var(--bg-muted);
  text-align: left;
  padding: 10px 14px;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: .4px;
  text-transform: uppercase;
  color: var(--text-muted);
  border-bottom: 1.5px solid var(--border-light);
  position: sticky;
  top: 0;
}
.stu-promo-table th.c, .stu-promo-table td.c { text-align: center; }
.stu-promo-table td { padding: 11px 14px; border-bottom: 1px solid var(--border-light); color: var(--text-secondary); }
.stu-promo-table tbody tr:last-child td { border-bottom: none; }
.stu-promo-table tbody tr:hover td { background: rgba(30,58,138,.04); }
.stu-promo-table tbody tr.sel td { background: rgba(22,163,74,.06); }
.stu-promo-table .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #1E40AF; font-weight: 700; }
.stu-promo-table strong { color: var(--text-primary); }
.stu-promo-table input[type="checkbox"] {
  width: 16px; height: 16px;
  accent-color: #16A34A;
  cursor: pointer;
}
.stu-promo-empty { text-align: center; padding: 28px; color: var(--text-muted); font-style: italic; }

/* Dues modal — hero */
.stu-dues-hero {
  padding: 18px 20px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(217,119,6,.08), rgba(245,158,11,.04));
  border: 1.5px solid rgba(217,119,6,.32);
  text-align: center;
  margin-bottom: 16px;
}
.stu-dues-hero-lbl {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: #B45309;
}
.stu-dues-hero-amt {
  font-size: 32px;
  font-weight: 800;
  color: #B45309;
  margin-top: 5px;
  letter-spacing: -.02em;
  font-variant-numeric: tabular-nums;
}
.stu-dues-hero-note {
  display: inline-flex; align-items: center; gap: 7px;
  margin-top: 10px;
  font-size: 11.5px;
  color: #92400E;
  font-weight: 600;
}
.stu-dues-hero-note i { font-size: 11px; }

/* Dues breakdown block */
.stu-dues-block {
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 14px;
}
.stu-dues-block-h {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .4px;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 10px;
}
.stu-dues-r {
  display: flex; justify-content: space-between; align-items: center;
  padding: 7px 0;
  border-bottom: 1px dashed var(--border-light);
  font-size: 12.5px;
  color: var(--text-secondary);
}
.stu-dues-r:last-of-type { border-bottom: none; }
.stu-dues-r .mono { font-family: ui-monospace, Menlo, monospace; color: var(--text-primary); font-weight: 700; font-variant-numeric: tabular-nums; }
.stu-dues-meta {
  display: flex; flex-wrap: wrap; gap: 5px 18px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-light);
  font-size: 11px;
  color: var(--text-muted);
}
.stu-dues-meta b { color: var(--text-secondary); font-weight: 700; }
.stu-dues-empty { color: var(--text-muted); font-style: italic; padding: 12px 0; }

/* Quick action buttons */
.stu-dues-quick {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 4px;
}
@media (max-width: 640px) { .stu-dues-quick { grid-template-columns: 1fr; } }
.stu-dues-qbtn {
  display: flex; align-items: center; gap: 9px;
  padding: 11px 14px;
  border: 1.5px solid var(--border-light);
  background: var(--bg-card);
  border-radius: 11px;
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all .15s ease;
  text-align: left;
}
.stu-dues-qbtn:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(15,23,42,.08); border-color: var(--border-med); }
.stu-dues-qbtn i { font-size: 13px; }

/* Remaining balance pill */
.stu-dues-remaining {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 14px;
  padding: 13px 16px;
  background: rgba(220,38,38,.06);
  border: 1.5px solid rgba(220,38,38,.28);
  border-radius: 11px;
  font-size: 13.5px;
  color: #B91C1C;
  font-weight: 800;
}
.stu-dues-remaining strong { font-size: 18px; font-variant-numeric: tabular-nums; }
.stu-dues-remaining.settled {
  background: rgba(22,163,74,.07);
  border-color: rgba(22,163,74,.32);
  color: #15803D;
}

/* Dark mode */
[data-theme="dark"] .stu-checkrow { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .stu-promo-tablewrap { border-color: var(--border-light); }
[data-theme="dark"] .stu-promo-table thead th { background: var(--bg-muted); border-color: var(--border-light); color: var(--text-muted); }
[data-theme="dark"] .stu-promo-table td { border-color: var(--border-light); color: var(--text-secondary); }
[data-theme="dark"] .stu-promo-table tbody tr:hover td { background: rgba(59,130,246,.06); }
[data-theme="dark"] .stu-promo-table tbody tr.sel td { background: rgba(22,163,74,.10); }
[data-theme="dark"] .stu-promo-table .mono { color: #93C5FD; }
[data-theme="dark"] .stu-dues-hero { background: linear-gradient(135deg, rgba(217,119,6,.16), rgba(245,158,11,.06)); border-color: rgba(217,119,6,.40); }
[data-theme="dark"] .stu-dues-hero-amt, [data-theme="dark"] .stu-dues-hero-lbl { color: #FDBA74; }
[data-theme="dark"] .stu-dues-hero-note { color: #FBD38D; }
[data-theme="dark"] .stu-dues-block, [data-theme="dark"] .stu-dues-qbtn { background: var(--bg-card); border-color: var(--border-light); color: var(--text-primary); }
[data-theme="dark"] .stu-dues-r { border-color: var(--border-light); }
[data-theme="dark"] .stu-dues-r .mono { color: var(--text-primary); }
[data-theme="dark"] .stu-dues-meta { border-color: var(--border-light); }
[data-theme="dark"] .stu-dues-remaining { background: rgba(220,38,38,.16); border-color: rgba(220,38,38,.36); color: #FCA5A5; }
[data-theme="dark"] .stu-dues-remaining.settled { background: rgba(22,163,74,.16); border-color: rgba(22,163,74,.36); color: #86EFAC; }

/* ═══════════════════════════════════════════════════════════════════
   INACTIVE STUDENTS — badges, reason cell, lock state, hero-ring confirm
   ═══════════════════════════════════════════════════════════════════ */
.stu-srow-inactive { background: rgba(220,38,38,.02); }
.stu-srow-inactive:hover { background: rgba(220,38,38,.04); }
.stu-reason-cell {
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
}
.stu-due-badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(220,38,38,.10);
  color: #B91C1C;
  border: 1px solid rgba(220,38,38,.28);
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}
.stu-due-badge i { font-size: 9px; }
.stu-clear-badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(22,163,74,.10);
  color: #15803D;
  border: 1px solid rgba(22,163,74,.28);
  font-size: 11px;
  font-weight: 800;
}
.stu-clear-badge i { font-size: 9px; }

/* Action menu — locked + warn + success variants used in Inactive list */
.stu-act-text { display: flex; flex-direction: column; flex: 1; min-width: 0; gap: 1px; }
.stu-act-sub { font-size: 10.5px; color: var(--text-muted); font-weight: 600; }
.stu-actitem--locked {
  position: relative;
  opacity: .55;
  cursor: not-allowed;
}
.stu-actitem--locked:hover { background: rgba(220,38,38,.06); }
.stu-act-lock {
  position: absolute;
  right: 11px; top: 50%;
  transform: translateY(-50%);
  color: #DC2626;
  font-size: 11px;
}
.stu-actitem--warn { background: rgba(217,119,6,.04); }
.stu-actitem--warn:hover { background: rgba(217,119,6,.08); }
.stu-actitem--success { background: rgba(22,163,74,.04); }
.stu-actitem--success:hover { background: rgba(22,163,74,.10); }

/* Hero-ring reactivate confirm dialog */
.stu-confirm-overlay {
  position: fixed; inset: 0;
  z-index: 9999;
  background: rgba(10,22,40,.55);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center; justify-content: center;
  padding: 20px;
}
.stu-confirm-dialog {
  position: relative;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 24px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 30px 80px rgba(0,0,0,.2), 0 8px 24px rgba(0,0,0,.10);
  animation: stuConfirmIn .32s cubic-bezier(.34,1.3,.64,1) both;
  overflow: hidden;
}
@keyframes stuConfirmIn {
  from { opacity: 0; transform: scale(.88) translateY(20px); }
  to   { opacity: 1; transform: none; }
}
.stu-confirm-glow {
  position: absolute; top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, #22C55E, #16A34A);
  border-radius: 24px 24px 0 0;
}
.stu-confirm-hero {
  display: flex; flex-direction: column; align-items: center;
  padding: 32px 28px 10px;
  background: linear-gradient(180deg, rgba(22,163,74,.04), transparent);
}
.stu-confirm-ring {
  position: relative;
  width: 80px; height: 80px;
  display: flex; align-items: center; justify-content: center;
}
.stu-confirm-ring::before {
  content: '';
  position: absolute; inset: 0;
  border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: #22C55E;
  border-right-color: #22C55E;
  animation: stuConfirmRing 3s linear infinite;
  opacity: .55;
}
@keyframes stuConfirmRing { to { transform: rotate(360deg); } }
.stu-confirm-icon-wrap {
  width: 60px; height: 60px;
  border-radius: 18px;
  background: rgba(22,163,74,.10);
  color: #16A34A;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px;
  position: relative; z-index: 1;
  box-shadow: 0 8px 24px rgba(22,163,74,.18);
}
.stu-confirm-body { padding: 16px 28px 8px; text-align: center; }
.stu-confirm-title { font-size: 20px; font-weight: 800; color: var(--text-primary); margin-bottom: 10px; letter-spacing: -.02em; }
.stu-confirm-msg { font-size: 13.5px; color: var(--text-muted); line-height: 1.7; margin-bottom: 14px; }
.stu-confirm-msg strong { color: var(--text-primary); font-weight: 700; }
.stu-confirm-hint {
  display: flex; flex-direction: column; gap: 7px;
  padding: 11px 14px;
  border-radius: 12px;
  background: var(--bg-muted);
  border: 1px solid var(--border-light);
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}
.stu-confirm-hint-row { display: flex; align-items: flex-start; gap: 9px; }
.stu-confirm-hint-row i { font-size: 12px; width: 14px; flex-shrink: 0; margin-top: 2px; color: var(--brand-primary); }
.stu-confirm-hint-row strong { color: inherit; }
.stu-confirm-footer {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 10px;
  padding: 20px 28px 28px;
}
.stu-confirm-footer .stu-btn-primary { height: 46px; justify-content: center; }
.stu-confirm-footer .stu-btn-ghost { height: 46px; display: flex; align-items: center; justify-content: center; }

/* Dark mode */
[data-theme="dark"] .stu-srow-inactive { background: rgba(220,38,38,.04); }
[data-theme="dark"] .stu-srow-inactive:hover { background: rgba(220,38,38,.08); }
[data-theme="dark"] .stu-due-badge { background: rgba(220,38,38,.18); color: #FCA5A5; border-color: rgba(220,38,38,.36); }
[data-theme="dark"] .stu-clear-badge { background: rgba(22,163,74,.16); color: #86EFAC; border-color: rgba(22,163,74,.36); }
[data-theme="dark"] .stu-confirm-overlay { background: rgba(0,0,0,.65); }
[data-theme="dark"] .stu-confirm-dialog { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .stu-confirm-hint { background: var(--bg-muted); border-color: var(--border-light); }

/* ═══════════════════════════════════════════════════════════════════
   REPORT PICKER, ID CARD, BULK ID, CERTIFICATE, ADD-TO-FAMILY modals
   ═══════════════════════════════════════════════════════════════════ */
.stu-rp-label {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .5px;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 10px;
  display: inline-flex; align-items: center; gap: 7px;
}
.stu-rp-label i { color: var(--brand-primary); font-size: 12px; }
.stu-rp-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
}
@media (max-width: 540px) { .stu-rp-grid { grid-template-columns: 1fr; } }
.stu-rp-card {
  position: relative;
  display: flex; flex-direction: column; gap: 8px;
  padding: 14px;
  border: 2px solid var(--border-light);
  border-radius: 14px;
  background: var(--bg-card);
  cursor: pointer;
  text-align: left;
  font-family: var(--font-body);
  transition: all .15s ease;
}
.stu-rp-card:hover { transform: translateY(-1px); border-color: var(--border-med); box-shadow: 0 4px 12px rgba(15,23,42,.06); }
.stu-rp-card.on { border-color: #1E3A8A; background: rgba(30,58,138,.05); box-shadow: 0 4px 14px rgba(30,58,138,.14); }
.stu-rp-card:focus-visible { outline: none; border-color: #1E40AF; box-shadow: 0 0 0 3px rgba(30,64,175,.22); }
[data-theme="dark"] .stu-rp-card:focus-visible { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.32); }
.stu-rp-fmt:focus-visible { outline: none; border-color: #1E40AF; box-shadow: 0 0 0 3px rgba(30,64,175,.22); }
[data-theme="dark"] .stu-rp-fmt:focus-visible { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.32); }
.stu-cert-style-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(30,64,175,.22); }
[data-theme="dark"] .stu-cert-style-btn:focus-visible { box-shadow: 0 0 0 3px rgba(59,130,246,.32); }
.stu-rp-preview {
  height: 64px;
  border-radius: 8px;
  padding: 8px 10px;
  display: flex; flex-direction: column;
  gap: 4px;
  border: 1px solid var(--border-light);
  position: relative;
  overflow: hidden;
}
.stu-rp-preview--color { background: linear-gradient(135deg, rgba(30,58,138,.06), rgba(124,58,237,.04)); }
/* Colorless preview tile — paper-white look that matches the actual
   low-ink printed report. Bar is a thin dark gray bracket, not a
   gradient strip; mock rows are light gray; chips are bordered outlines. */
.stu-rp-preview--bw { background: #FFFFFF; border-bottom: 1px solid #E5E7EB; }
.stu-rp-preview-bar { height: 6px; border-radius: 3px; background: linear-gradient(90deg, #1E40AF, #2563EB); }
.stu-rp-preview--bw .stu-rp-preview-bar { background: #1F2937; height: 4px; }
[data-theme="dark"] .stu-rp-preview--bw { background: #F8FAFC; border-bottom-color: #CBD5E1; }
[data-theme="dark"] .stu-rp-preview--bw .stu-rp-preview-bar { background: #1F2937; }
.stu-rp-preview-rows { display: flex; flex-direction: column; gap: 3px; margin-top: 2px; }
.stu-rp-preview-rows > div { height: 4px; background: rgba(15,23,42,.10); border-radius: 2px; }
.stu-rp-preview-rows > div:nth-child(2) { width: 80%; }
.stu-rp-preview-rows > div:nth-child(3) { width: 60%; }
.stu-rp-preview-chips { display: flex; gap: 4px; margin-top: auto; }
.stu-rp-preview-chips span { width: 12px; height: 12px; border-radius: 50%; }
.stu-rp-card-name { font-size: 13.5px; font-weight: 800; color: var(--text-primary); letter-spacing: -.01em; }
.stu-rp-card-desc { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

.stu-rp-fmt-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
}
.stu-rp-fmt {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px;
  border: 2px solid var(--border-light);
  border-radius: 12px;
  background: var(--bg-card);
  cursor: pointer;
  font-family: var(--font-body);
  transition: all .15s ease;
}
.stu-rp-fmt:hover { transform: translateY(-1px); border-color: var(--border-med); }
.stu-rp-fmt.on { border-color: #1E3A8A; background: rgba(30,58,138,.05); }
.stu-rp-fmt-ic {
  width: 38px; height: 38px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 17px;
  flex-shrink: 0;
}

/* Split layout used by ID Card / Bulk ID / Cert modals */
.stu-id-split {
  display: grid;
  grid-template-columns: 1fr 1.05fr;
  gap: 18px;
}
@media (max-width: 880px) { .stu-id-split { grid-template-columns: 1fr; } }
.stu-id-form { display: flex; flex-direction: column; gap: 4px; }
.stu-id-preview {
  position: sticky; top: 0;
  align-self: flex-start;
  display: flex; flex-direction: column; gap: 10px;
}

/* Template picker */
.stu-id-tmpl-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.stu-id-tmpl {
  display: flex; align-items: center; gap: 11px;
  padding: 11px 14px;
  border: 2px solid var(--border-light);
  border-radius: 12px;
  background: var(--bg-card);
  cursor: pointer;
  font-family: var(--font-body);
  transition: all .15s ease;
}
.stu-id-tmpl:hover { transform: translateY(-1px); border-color: var(--border-med); }
.stu-id-tmpl.on { border-color: #1E3A8A; background: rgba(30,58,138,.05); }
.stu-id-tmpl-ic {
  width: 38px; height: 38px;
  border-radius: 8px;
  background: var(--bg-muted);
  position: relative;
  flex-shrink: 0;
}
.stu-id-tmpl-v::before { content: ''; position: absolute; inset: 6px 12px; background: linear-gradient(135deg, #1E40AF, #2563EB); border-radius: 4px; }
.stu-id-tmpl-h::before { content: ''; position: absolute; inset: 12px 6px; background: linear-gradient(135deg, #1E40AF, #2563EB); border-radius: 4px; }
.stu-id-tmpl-text { flex: 1; min-width: 0; }

/* Theme swatches */
.stu-id-swatches {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(32px, 1fr));
  gap: 8px;
  margin-bottom: 6px;
}
.stu-id-swatch {
  position: relative;
  width: 32px; height: 32px;
  border-radius: 9px;
  border: 2px solid transparent;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: #fff;
  font-size: 11px;
  transition: all .15s ease;
}
.stu-id-swatch:hover { transform: translateY(-2px); }
.stu-id-swatch.on { border-color: #0F172A; box-shadow: 0 4px 12px rgba(15,23,42,.18); }
.stu-id-swatch--custom {
  background: linear-gradient(135deg, #FF0080, #FF8C00, #FFD500, #00C9A7, #2D7DD2, #7C3AED);
  position: relative;
  overflow: hidden;
}
.stu-id-swatch--custom input[type="color"] {
  position: absolute; inset: 0;
  opacity: 0; cursor: pointer;
}
.stu-id-swatch--custom i { color: #fff; font-size: 10px; z-index: 1; }

/* Live ID card preview */
.stu-id-cardwrap {
  background: var(--bg-muted);
  border-radius: 14px;
  padding: 24px;
  display: flex; align-items: center; justify-content: center;
}
.stu-id-card-prv {
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15,23,42,.18);
  overflow: hidden;
  display: flex; flex-direction: column;
}
.stu-id-card-prv--v { width: 220px; height: 348px; }
.stu-id-card-prv--h { width: 360px; height: 224px; }
.stu-id-card-top { color: #fff; padding: 9px 12px; display: flex; align-items: center; }
.stu-id-card-school { font-size: 11px; font-weight: 800; flex: 1; line-height: 1.1; }
.stu-id-card-body {
  flex: 1; padding: 12px;
  display: flex; flex-direction: column; gap: 8px;
}
.stu-id-card-prv--h .stu-id-card-body { flex-direction: row; gap: 12px; }
.stu-id-card-photo {
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; font-weight: 800;
  border: 1.5px solid;
  overflow: hidden;
  flex-shrink: 0;
}
.stu-id-card-prv--v .stu-id-card-photo { width: 88px; height: 108px; align-self: center; }
.stu-id-card-prv--h .stu-id-card-photo { width: 80px; height: 100%; }
.stu-id-card-photo img { width: 100%; height: 100%; object-fit: cover; }
.stu-id-card-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.stu-id-card-name { font-size: 14px; font-weight: 800; letter-spacing: -.01em; line-height: 1.2; }
.stu-id-card-kv {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 3px 9px;
  font-size: 10px;
  align-items: baseline;
}
.stu-id-card-kv span {
  text-transform: uppercase;
  letter-spacing: .3px;
  font-weight: 800;
  font-size: 8px;
  color: #64748B;
}
.stu-id-card-kv b { font-weight: 700; color: #0F172A; font-size: 10px; }
.stu-id-card-foot { color: #fff; padding: 5px 10px; font-size: 8.5px; text-align: center; font-weight: 700; letter-spacing: .3px; }
.stu-id-cardwrap--pair {
  flex-wrap: wrap; gap: 18px; padding: 22px;
}
.stu-id-card-top { position: relative; }
.stu-id-card-face {
  position: absolute; right: 10px; top: 7px;
  background: rgba(255,255,255,.2);
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 8px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: #fff;
}
.stu-id-card-back {
  flex: 1;
  padding: 11px 12px;
  display: flex; flex-direction: column; gap: 9px;
  background: #fff;
}
.stu-id-card-prv--h .stu-id-card-back { padding: 10px 12px; }
.stu-id-card-qr {
  display: flex; align-items: center; gap: 11px;
  padding-bottom: 8px;
  border-bottom: 1px dashed #CBD5E1;
}
.stu-id-card-qr-mock {
  width: 56px; height: 56px;
  border: 2.5px solid;
  border-radius: 4px;
  background: #fff;
  flex-shrink: 0;
  overflow: hidden;
}
.stu-id-card-qr-mock svg { display: block; width: 100%; height: 100%; }
.stu-id-card-qr-text { flex: 1; min-width: 0; }
.stu-id-card-qr-lbl {
  font-size: 8px;
  font-weight: 800;
  color: #64748B;
  text-transform: uppercase;
  letter-spacing: .35px;
}
.stu-id-card-qr-reg {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: .4px;
  margin-top: 2px;
}
.stu-id-card-back-rows {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 14px;
  font-size: 9.5px;
}
.stu-id-card-back-rows > div { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.stu-id-card-back-rows span {
  font-size: 7.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .3px;
  color: #64748B;
}
.stu-id-card-back-rows b {
  font-size: 9.5px;
  color: #0F172A;
  font-weight: 700;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stu-id-card-school-addr {
  margin-top: auto;
  padding-top: 6px;
  border-top: 1px dashed #CBD5E1;
  font-size: 8.5px;
  color: #475569;
  text-align: center;
  line-height: 1.35;
  font-weight: 600;
}

/* ── Bulk ID Card modal — HTML-reference parity ── */
.stu-gen-modal { width: min(1100px, calc(100vw - 40px)); }
.stu-gen-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
  gap: 18px;
  padding: 18px 22px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
@media (max-width: 920px) { .stu-gen-body { grid-template-columns: 1fr; } }
.stu-gen-settings,
.stu-gen-preview {
  display: flex; flex-direction: column; gap: 4px;
  min-height: 0;
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 6px;
  scrollbar-width: thin;
  scrollbar-color: var(--border-med, #cbd5e1) transparent;
}
.stu-gen-settings::-webkit-scrollbar,
.stu-gen-preview::-webkit-scrollbar { width: 9px; }
.stu-gen-settings::-webkit-scrollbar-thumb,
.stu-gen-preview::-webkit-scrollbar-thumb {
  background: var(--border-med, #cbd5e1);
  border-radius: 8px;
  border: 2px solid transparent;
  background-clip: content-box;
}
.stu-gen-prev-label {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .4px;
  color: var(--text-muted);
  margin-bottom: 8px;
  display: inline-flex; align-items: center; gap: 6px;
}
.stu-gen-prev-label i { color: var(--brand-primary, #1E40AF); }
.stu-bigprev {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 24px;
  min-height: 320px;
  flex: 1;
  overflow: auto;
  display: flex; flex-direction: column;
  align-items: flex-start; justify-content: flex-start;
}
.stu-bulk-prevgrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  justify-items: center;
  align-items: start;
  width: 100%;
}
.stu-bulk-prevcard { transform: scale(.72); transform-origin: top center; margin-bottom: -60px; }
.stu-bulk-prevcard-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
}
@media (max-width: 520px) { .stu-bulk-prevgrid { grid-template-columns: 1fr; } }

/* Card-format pill buttons (Vertical / Horizontal) — match HTML .stu-certtype */
.stu-certtype-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 10px;
}
.stu-certtype {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 10px 12px;
  border: 1.5px solid var(--border-light);
  background: var(--bg-card);
  border-radius: 10px;
  font-family: var(--font-body);
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all .15s ease;
}
.stu-certtype:hover { transform: translateY(-1px); border-color: var(--border-med); }
.stu-certtype.active {
  background: linear-gradient(135deg, rgba(30,58,138,.08), rgba(37,99,235,.04));
  border-color: #1E3A8A;
  color: #1E3A8A;
}
.stu-certtype i { color: #1E3A8A; }
[data-theme="dark"] .stu-certtype { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .stu-certtype.active { background: rgba(59,130,246,.10); border-color: #2563EB; color: #93C5FD; }

/* Theme swatches — match HTML .stu-swatches */
.stu-swatches {
  display: flex; flex-wrap: wrap; gap: 8px;
  margin-bottom: 4px;
}
.stu-swatch {
  width: 30px; height: 30px;
  border-radius: 9px;
  cursor: pointer;
  border: 2px solid transparent;
  box-shadow: 0 1px 4px rgba(0,0,0,.15);
  transition: all .15s ease;
  position: relative;
}
.stu-swatch:hover { transform: translateY(-2px) scale(1.05); }
.stu-swatch.sel {
  border-color: var(--text-primary, #0F172A);
  box-shadow: 0 0 0 2px var(--bg-card), 0 0 0 4px var(--text-primary, #0F172A);
}
.stu-swatch.sel::after {
  content: '\\2713';
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: #fff;
  font-size: 13px;
  font-weight: 900;
  text-shadow: 0 1px 2px rgba(0,0,0,.45);
}

/* Students header row (Section label + Select all) */
.stu-bulk-students-lbl {
  display: flex; align-items: center; justify-content: space-between;
}
.stu-bulk-count { color: var(--brand-primary, #1E40AF); }
.stu-bulk-selall {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: none;
  letter-spacing: 0;
  cursor: pointer;
}
.stu-bulk-selall input[type="checkbox"] {
  width: 14px; height: 14px;
  accent-color: #1E40AF;
}

/* Student picker list — match HTML .stu-bulk-list / .stu-bulk-item / .stu-bulk-av */
.stu-bulk-list {
  display: flex; flex-direction: column; gap: 6px;
  max-height: 230px;
  overflow-y: auto;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  padding: 8px;
  background: var(--bg-muted);
  scrollbar-width: thin;
  scrollbar-color: var(--border-med, #cbd5e1) transparent;
}
.stu-bulk-list::-webkit-scrollbar { width: 9px; }
.stu-bulk-list::-webkit-scrollbar-thumb {
  background: var(--border-med, #cbd5e1);
  border-radius: 8px;
  border: 2px solid transparent;
  background-clip: content-box;
}
.stu-bulk-item {
  display: flex; align-items: center; gap: 10px;
  padding: 7px 9px;
  border-radius: 10px;
  cursor: pointer;
  background: var(--bg-card);
  border: 1px solid transparent;
  transition: all .15s ease;
}
.stu-bulk-item:hover { border-color: var(--brand-primary, #1E3A8A); }
.stu-bulk-item input[type="checkbox"],
.stu-pchk {
  width: 15px; height: 15px;
  accent-color: #1E40AF;
  flex-shrink: 0;
}
.stu-bulk-av {
  width: 30px; height: 30px;
  border-radius: 8px;
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, var(--brand-primary, #1E3A8A), var(--brand-mid, #4FA3E8));
  overflow: hidden;
}
.stu-bulk-av img { width: 100%; height: 100%; object-fit: cover; }
.stu-bulk-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.stu-bulk-name {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.stu-bulk-meta {
  font-size: 10.5px;
  color: var(--text-muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* Empty-state inside the bulk picker / preview */
.stu-sr-empty {
  padding: 14px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
}

/* Cert modal */
.stu-cert-types {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
}
.stu-cert-type {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 12px;
  border: 1.5px solid var(--border-light);
  background: var(--bg-card);
  border-radius: 10px;
  font-family: var(--font-body);
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all .15s ease;
}
.stu-cert-type:hover { transform: translateY(-1px); border-color: var(--border-med); }
.stu-cert-type.on {
  background: linear-gradient(135deg, rgba(217,119,6,.08), rgba(245,158,11,.04));
  border-color: #D97706;
  color: #B45309;
}
.stu-cert-type i { color: #D97706; }
.stu-cert-sigs {
  display: flex; gap: 8px; flex-wrap: wrap;
  margin-bottom: 4px;
}
.stu-cert-style {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
}
.stu-cert-style-btn {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 14px;
  border: 2px solid var(--border-light);
  background: var(--bg-card);
  border-radius: 12px;
  font-family: var(--font-body);
  cursor: pointer;
  transition: all .15s ease;
}
.stu-cert-style-btn:hover { transform: translateY(-1px); border-color: var(--border-med); }
.stu-cert-style-btn.on { border-color: #D97706; background: rgba(217,119,6,.05); }
.stu-cert-style-dot { width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0; }

/* Cert preview */
/* ── Certificate live preview — mirrors PDF design ── */
.stu-cert-prv {
  position: relative;
  background: #fff;
  border-radius: 8px;
  width: 100%;
  max-width: 460px;
  margin: 0 auto;
  box-shadow: 0 10px 32px rgba(15,23,42,.16);
  display: flex; flex-direction: column;
  font-family: 'Poppins', system-ui, sans-serif;
  overflow: hidden;
  min-height: 600px;
}
.stu-cert-prv-frame {
  position: absolute; inset: 10px;
  border: 2px solid #2D7DD2;
  border-radius: 4px;
  pointer-events: none;
  z-index: 5;
}
.stu-cert-prv-frame::before {
  content: ''; position: absolute; inset: 4px;
  border: 1px solid rgba(26,188,205,.4);
  border-radius: 2px;
}
.stu-cert-prv-corner {
  position: absolute;
  width: 38px; height: 38px;
  z-index: 6;
  background:
    linear-gradient(135deg, transparent 50%, rgba(26,188,205,.18) 50%);
  border-style: solid;
  border-color: #2D7DD2;
  border-width: 2px 0 0 2px;
  border-top-left-radius: 4px;
  pointer-events: none;
}
.stu-cert-prv-corner--tl { top: 8px; left: 8px; }
.stu-cert-prv-corner--tr { top: 8px; right: 8px; transform: scaleX(-1); }
.stu-cert-prv-corner--bl { bottom: 8px; left: 8px; transform: scaleY(-1); }
.stu-cert-prv-corner--br { bottom: 8px; right: 8px; transform: scale(-1); }

/* Header */
.stu-cert-prv-head {
  background: linear-gradient(120deg, #1A3BAA 0%, #2D7DD2 55%, #1ABCCD 100%);
  padding: 18px 30px 22px;
  position: relative;
  display: flex; align-items: center; gap: 12px;
  z-index: 2;
}
.stu-cert-prv-logo {
  width: 44px; height: 44px;
  background: rgba(255,255,255,.15);
  border: 1.5px solid rgba(255,255,255,.3);
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.stu-cert-prv-head-text { flex: 1; min-width: 0; }
.stu-cert-prv-school {
  font-family: 'Cinzel', Georgia, serif;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  line-height: 1.2;
  letter-spacing: .4px;
}
.stu-cert-prv-campus {
  font-size: 8px;
  color: rgba(255,255,255,.8);
  letter-spacing: 1.2px;
  text-transform: uppercase;
  margin-top: 3px;
}
.stu-cert-prv-meta {
  text-align: right;
  font-size: 7.5px;
  color: rgba(255,255,255,.7);
  line-height: 1.6;
  flex-shrink: 0;
}
.stu-cert-prv-meta strong { color: rgba(255,255,255,.95); font-size: 8.5px; }
.stu-cert-prv-ribbon {
  position: absolute; bottom: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent, #F5C842 20%, #C9920A 50%, #F5C842 80%, transparent);
}

/* Title block */
.stu-cert-prv-titlewrap {
  padding: 22px 38px 10px;
  text-align: center;
  position: relative;
  z-index: 2;
}
.stu-cert-prv-badge {
  display: inline-flex; align-items: center; gap: 10px;
  margin-bottom: 10px;
}
.stu-cert-prv-badgeline {
  width: 50px; height: 1.2px;
  background: linear-gradient(90deg, transparent, #C9920A);
}
.stu-cert-prv-badgeline--r {
  background: linear-gradient(90deg, #C9920A, transparent);
}
.stu-cert-prv-badgeic {
  width: 30px; height: 30px;
  background: linear-gradient(135deg, #2D7DD2, #1ABCCD);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 3px 8px rgba(45,125,210,.3);
}
.stu-cert-prv-title {
  font-family: 'Cinzel', Georgia, serif;
  font-size: 17px;
  font-weight: 700;
  color: #0D2B5E;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-bottom: 4px;
}
.stu-cert-prv-sub {
  font-size: 7.5px;
  color: #6B8BAA;
  letter-spacing: 1.4px;
  text-transform: uppercase;
}

/* Ornament divider */
.stu-cert-prv-orn {
  display: flex; align-items: center;
  padding: 0 38px;
  margin-bottom: 14px;
  position: relative;
  z-index: 2;
}
.stu-cert-prv-orn-line {
  flex: 1; height: 1px;
  background: linear-gradient(90deg, transparent, #2D7DD2 40%, #1ABCCD 60%, transparent);
}
.stu-cert-prv-orn-dot {
  width: 4px; height: 4px;
  background: #1ABCCD;
  border-radius: 50%;
  margin: 0 5px;
  flex-shrink: 0;
}
.stu-cert-prv-orn-diamond {
  width: 6px; height: 6px;
  background: #C9920A;
  transform: rotate(45deg);
  margin: 0 7px;
  flex-shrink: 0;
}

/* Body */
.stu-cert-prv-body {
  padding: 0 44px;
  flex: 1;
  display: flex; flex-direction: column;
  gap: 12px;
  position: relative; z-index: 2;
}
.stu-cert-prv-infotbl {
  border: 1px solid #C8E6F7;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}
.stu-cert-prv-inforow {
  display: flex;
  border-bottom: 1px solid #E8F4FD;
}
.stu-cert-prv-inforow:last-child { border-bottom: none; }
.stu-cert-prv-inforow span {
  width: 110px;
  background: #F4FAFE;
  padding: 5px 10px;
  font-size: 8px;
  font-weight: 700;
  color: #2D7DD2;
  text-transform: uppercase;
  letter-spacing: .3px;
}
.stu-cert-prv-inforow b {
  flex: 1;
  padding: 5px 10px;
  font-size: 9.5px;
  font-weight: 600;
  color: #0D2B5E;
}
.stu-cert-prv-text {
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 11px;
  line-height: 1.7;
  color: #1a2a4a;
  text-align: justify;
}

/* Signatures + central seal */
.stu-cert-prv-sigrow {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: 10px;
  padding: 18px 38px 22px;
  position: relative; z-index: 2;
}
.stu-cert-prv-sig {
  display: flex; flex-direction: column; align-items: center;
  gap: 3px;
  flex: 1;
}
.stu-cert-prv-sigline {
  width: 90px;
  border-bottom: 1.2px solid #0D2B5E;
}
.stu-cert-prv-signame {
  font-size: 8.5px;
  font-weight: 600;
  color: #0D2B5E;
  text-align: center;
}
.stu-cert-prv-sigrole {
  font-size: 7.5px;
  color: #6B8BAA;
  text-align: center;
}
.stu-cert-prv-seal {
  width: 54px; height: 54px;
  border-radius: 50%;
  border: 2px solid #2D7DD2;
  display: flex; align-items: center; justify-content: center;
  position: relative;
  flex-shrink: 0;
}
.stu-cert-prv-seal::before {
  content: ''; position: absolute; inset: 3px;
  border-radius: 50%;
  border: 1px dashed rgba(45,125,210,.4);
}
.stu-cert-prv-seal-text {
  font-family: 'Cinzel', Georgia, serif;
  font-size: 6.5px;
  font-weight: 700;
  color: #2D7DD2;
  text-align: center;
  letter-spacing: .3px;
}

/* Footer */
.stu-cert-prv-foot {
  background: linear-gradient(120deg, #1A3BAA, #2D7DD2 55%, #1ABCCD);
  padding: 9px 30px;
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px;
  position: relative; z-index: 2;
}
.stu-cert-prv-foot-item {
  display: flex; align-items: center; gap: 5px;
  font-size: 7.5px;
  color: rgba(255,255,255,.85);
  line-height: 1.4;
  min-width: 0;
}
.stu-cert-prv-foot-item i {
  width: 14px; height: 14px;
  background: rgba(255,255,255,.18);
  border-radius: 4px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 7px;
  color: #fff;
  flex-shrink: 0;
}
.stu-cert-prv-foot-item strong { color: #fff; }
.stu-cert-prv-foot-item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* B&W variant */
.stu-cert-prv--bw .stu-cert-prv-head,
.stu-cert-prv--bw .stu-cert-prv-foot { background: #222 !important; }
.stu-cert-prv--bw .stu-cert-prv-ribbon { background: #999 !important; }
.stu-cert-prv--bw .stu-cert-prv-frame { border-color: #222 !important; }
.stu-cert-prv--bw .stu-cert-prv-corner { border-color: #222 !important; background: linear-gradient(135deg, transparent 50%, rgba(0,0,0,.12) 50%) !important; }
.stu-cert-prv--bw .stu-cert-prv-title { color: #111 !important; }
.stu-cert-prv--bw .stu-cert-prv-badgeic { background: #222 !important; box-shadow: none !important; }
.stu-cert-prv--bw .stu-cert-prv-badgeline { background: linear-gradient(90deg, transparent, #555) !important; }
.stu-cert-prv--bw .stu-cert-prv-badgeline--r { background: linear-gradient(90deg, #555, transparent) !important; }
.stu-cert-prv--bw .stu-cert-prv-orn-line { background: linear-gradient(90deg, transparent, #555 40%, #777 60%, transparent) !important; }
.stu-cert-prv--bw .stu-cert-prv-orn-dot { background: #555 !important; }
.stu-cert-prv--bw .stu-cert-prv-orn-diamond { background: #555 !important; }
.stu-cert-prv--bw .stu-cert-prv-seal { border-color: #222 !important; }
.stu-cert-prv--bw .stu-cert-prv-seal-text { color: #222 !important; }
.stu-cert-prv--bw .stu-cert-prv-inforow b { color: #111 !important; }
.stu-cert-prv--bw .stu-cert-prv-inforow span { color: #333 !important; background: #f4f4f4 !important; }
.stu-cert-prv--bw .stu-cert-prv-infotbl { border-color: #ccc !important; }

[data-theme="dark"] .stu-rp-card, [data-theme="dark"] .stu-rp-fmt, [data-theme="dark"] .stu-id-tmpl, [data-theme="dark"] .stu-cert-style-btn, [data-theme="dark"] .stu-cert-type { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .stu-rp-card.on, [data-theme="dark"] .stu-rp-fmt.on, [data-theme="dark"] .stu-id-tmpl.on { background: rgba(59,130,246,.10); border-color: #2563EB; }
[data-theme="dark"] .stu-cert-type.on { background: rgba(217,119,6,.16); border-color: #D97706; color: #FDBA74; }
[data-theme="dark"] .stu-cert-style-btn.on { background: rgba(217,119,6,.10); border-color: #D97706; }
[data-theme="dark"] .stu-rp-preview { border-color: var(--border-light); }
[data-theme="dark"] .stu-rp-preview--color { background: linear-gradient(135deg, rgba(59,130,246,.10), rgba(167,139,250,.06)); }
[data-theme="dark"] .stu-rp-preview--bw { background: var(--bg-muted); }
[data-theme="dark"] .stu-id-cardwrap, [data-theme="dark"] .stu-cert-prv { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .stu-bulk-list { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .stu-bigprev { background: var(--bg-card); }
[data-theme="dark"] .stu-bulk-item:hover { background: rgba(59,130,246,.05); }

/* ═══════════════════════════════════════════════════════════════════
   FAMILY TREE tab
   ═══════════════════════════════════════════════════════════════════ */
.stu-rowbtn.fam-del {
  background: rgba(220,38,38,.06);
  border-color: rgba(220,38,38,.32);
  color: #B91C1C;
}
.stu-rowbtn.fam-del:hover { background: #DC2626; border-color: #DC2626; color: #fff; }

.fam-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px 16px;
  padding: 14px 16px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
}
.fam-meta-full { grid-column: 1 / -1; }
.fam-meta-l {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .4px;
  text-transform: uppercase;
  color: var(--text-muted);
}
.fam-meta-v {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-primary);
  margin-top: 2px;
  line-height: 1.4;
}
.fam-rel-pill {
  display: inline-flex; align-items: center;
  padding: 3px 11px;
  border-radius: 999px;
  background: rgba(124,58,237,.10);
  color: #7C3AED;
  border: 1px solid rgba(124,58,237,.28);
  font-size: 11.5px;
  font-weight: 800;
  white-space: nowrap;
}

[data-theme="dark"] .fam-meta { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .fam-meta-v { color: var(--text-primary); }
[data-theme="dark"] .fam-rel-pill { background: rgba(167,139,250,.18); color: #C4B5FD; border-color: rgba(167,139,250,.36); }

/* Dark mode */
[data-theme="dark"] .fee-subtabs { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .fee-subtab { color: var(--text-muted); }
[data-theme="dark"] .fee-subtab:hover:not(.active) { background: var(--bg-muted); color: var(--text-primary); }
[data-theme="dark"] .fee-section { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .stu-coming-ic {
  background: linear-gradient(135deg, rgba(59,130,246,.10), rgba(167,139,250,.10));
  border-color: rgba(59,130,246,.40);
  color: #93C5FD;
}
[data-theme="dark"] .stu-stat,
[data-theme="dark"] .stu-search-wrap,
[data-theme="dark"] .stu-iconbtn,
[data-theme="dark"] .stu-rowbtn,
[data-theme="dark"] .stu-rep-btn,
[data-theme="dark"] .stu-chev,
[data-theme="dark"] .stu-dots,
[data-theme="dark"] .stu-list-head,
[data-theme="dark"] .stu-srow,
[data-theme="dark"] .stu-list-empty,
[data-theme="dark"] .stu-actmenu,
[data-theme="dark"] .stu-sr { background: var(--bg-card); border-color: var(--border-light); color: var(--text-primary); }
[data-theme="dark"] .stu-info { background: rgba(59,130,246,.06); border-color: rgba(59,130,246,.22); color: var(--text-secondary); }
[data-theme="dark"] .stu-info i { color: #93C5FD; }
[data-theme="dark"] .stu-stat-val,
[data-theme="dark"] .stu-cls-name,
[data-theme="dark"] .stu-srow-name,
[data-theme="dark"] .stu-sr-name,
[data-theme="dark"] .stu-empty-title,
[data-theme="dark"] .stu-list-empty strong,
[data-theme="dark"] .stu-sr-foot b,
[data-theme="dark"] .stu-actitem { color: var(--text-primary); }
[data-theme="dark"] .stu-cls-row:hover { background: rgba(59,130,246,.06); }
[data-theme="dark"] .stu-clswrap.open .stu-cls-row { background: rgba(59,130,246,.10); }
[data-theme="dark"] .stu-table-head,
[data-theme="dark"] .stu-search-clear,
[data-theme="dark"] .stu-cls-sn,
[data-theme="dark"] .stu-actmenu-div,
[data-theme="dark"] .stu-sr-foot { background: var(--bg-muted); border-color: var(--border-light); color: var(--text-muted); }
[data-theme="dark"] .stu-detail-inner { background: linear-gradient(135deg, rgba(59,130,246,.06), transparent 70%); }
[data-theme="dark"] .stu-srow:hover { background: rgba(59,130,246,.05); }
[data-theme="dark"] .stu-actitem:hover { background: var(--bg-muted); }
[data-theme="dark"] .stu-reg-cell,
[data-theme="dark"] .stu-strength { color: #93C5FD; }
[data-theme="dark"] .stu-sec-pill { background: rgba(167,139,250,.16); color: #C4B5FD; border-color: rgba(167,139,250,.32); }
[data-theme="dark"] .stu-sr-av { background: rgba(59,130,246,.18); color: #93C5FD; }

/* ═══════════════════════════════════════════════════════════════════
   MOBILE RESPONSIVE — internal screen layouts (≤ 600px)
   Only adds; does not modify existing rules. ID-card / barcode /
   certificate-print CSS deliberately untouched.
   ═══════════════════════════════════════════════════════════════════ */
@media (max-width: 600px) {
  /* Page header — stack vertically, full-width title row */
  .page-header { flex-direction: column; align-items: stretch; gap: 10px; margin-bottom: 14px; }
  .page-title-row { gap: 10px; }
  .page-title { font-size: 20px; }
  .page-title-icon { width: 40px; height: 40px; font-size: 17px; border-radius: 11px; }

  /* Sub-tab strip — horizontal scroll, no wrap, hidden scrollbar */
  .fee-subtabs { padding: 4px; gap: 4px; margin-bottom: 12px; scrollbar-width: none; -ms-overflow-style: none; }
  .fee-subtabs::-webkit-scrollbar { display: none; }
  .fee-subtab { padding: 9px 13px; font-size: 12px; flex: 0 0 auto; }

  /* KPI strip — 2 cols on phone */
  .stu-kpis { grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 10px; }
  .stu-stat { padding: 10px 11px; gap: 9px; }
  .stu-stat-val { font-size: 18px; }
  .stu-stat-lbl { font-size: 11px; }
  .stu-stat-icon { width: 36px; height: 36px; font-size: 15px; }

  /* Info / banner */
  .stu-info { padding: 10px 12px; font-size: 12px; gap: 8px; }

  /* Toolbar (search + actions) — stack vertically, full-width children */
  .stu-toolbar { flex-direction: column; align-items: stretch; gap: 10px; padding: 10px; }
  .stu-search-wrap { width: 100%; max-width: none; }
  .stu-search-input { width: 100%; font-size: 13px; }
  .stu-toolbar-actions { flex-wrap: wrap; gap: 8px; width: 100%; }
  .stu-toolbar-actions .stu-iconbtn,
  .stu-toolbar-actions .stu-rowbtn { flex: 1 1 auto; min-width: 0; }
  .stu-toolbar-actions .admission-cta { flex: 1 1 100%; justify-content: center; }
  .stu-sr { left: 0; right: 0; width: auto; max-height: 60vh; }

  /* Class row — collapse extra columns, stack actions */
  .stu-cls-row { padding: 10px 12px; gap: 8px; min-height: 60px; }
  .stu-cls-name { font-size: 14px; }
  .stu-cls-sub { font-size: 11px; }
  .stu-cls-actions { gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
  .stu-cls-actions .stu-rowbtn { padding: 6px 9px; font-size: 11px; }
  .stu-cls-actions .stu-rowbtn i { font-size: 11px; }
  .stu-sec-pill { font-size: 11px; padding: 3px 8px; }

  /* Roster header / row inner padding */
  .stu-list-head, .stu-srow { padding: 8px 8px; font-size: 12px; }
  .stu-srow-name { font-size: 13px; }
  .stu-srow-sub { font-size: 10.5px; }
  .stu-avatar { width: 32px; height: 32px; font-size: 11px; }

  /* Detail wrapper padding */
  .stu-detail-inner { padding: 12px; }
  .stu-detail-head { flex-direction: column; align-items: stretch; gap: 8px; }
  .stu-detail-title { font-size: 13px; }

  /* Action menu — wider on phone */
  .stu-actmenu { min-width: 220px; right: 0; max-width: 92vw; }

  /* Modal — slimmer padding */
  .stu-modal-overlay { padding: 6px; }
  .stu-modal-head { padding: 12px 14px; gap: 10px; }
  .stu-modal-body { padding: 14px 14px; }
  .stu-modal-foot { padding: 12px 14px; flex-wrap: wrap; gap: 8px; }
  .stu-modal-foot .stu-btn { flex: 1 1 auto; }
  .stu-modal-foot .stu-btn-primary { flex: 1 1 100%; }

  /* Add-Student modal sub-tabs (Profile/Contact/Guardian/Docs/Fee) — scrollable */
  .stu-mtabs { overflow-x: auto; flex-wrap: nowrap; scrollbar-width: none; -ms-overflow-style: none; padding: 4px; gap: 4px; }
  .stu-mtabs::-webkit-scrollbar { display: none; }
  .stu-mtabs > * { flex: 0 0 auto; white-space: nowrap; }

  /* Add-Student form grids — single column on phone */
  .stu-reg-grid { grid-template-columns: 1fr !important; gap: 12px; }
  .stu-fgrid,
  .stu-fgrid-2,
  .stu-fgrid-3,
  .stu-fgrid-4,
  .stu-fgrid-tight { grid-template-columns: 1fr !important; gap: 10px; }

  /* Fee table inside modal — horizontal scroll */
  .stu-feetable { display: block; overflow-x: auto; min-width: 0; }

  /* Promotion modal table — scroll */
  .stu-promo-tablewrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .stu-promo-table { min-width: 640px; }

  /* Family Tree — meta grid 1-col, list head/row pad reduced */
  .fam-meta { grid-template-columns: 1fr !important; gap: 8px 0; padding: 10px 12px; }
  .fam-meta-v { font-size: 12px; }
  .fam-rel-pill { font-size: 10.5px; padding: 2px 8px; }

  /* Inactive list view — actions stack */
  .stu-confirm-dialog { padding: 16px; }
  .stu-confirm-body { padding: 14px 16px; }
  .stu-confirm-footer { padding: 12px 14px; flex-wrap: wrap; gap: 8px; }
  .stu-confirm-footer > button { flex: 1 1 auto; min-width: 0; }

  /* Bulk preview grid → 1 col */
  .stu-bulk-prevgrid { grid-template-columns: 1fr !important; }
  .stu-bulk-list { max-height: 50vh; }

  /* Reports / Generate body → 1 col */
  .stu-rp-grid { grid-template-columns: 1fr !important; }
  .stu-gen-body { grid-template-columns: 1fr !important; }
  .stu-rp-fmt-grid { grid-template-columns: 1fr 1fr; }

  /* Dues block */
  .stu-dues-quick { grid-template-columns: 1fr !important; }
  .stu-dues-hero { padding: 14px; }
  .stu-dues-hero-amt { font-size: 26px; }

  /* Documents lists */
  .stu-docslots,
  .stu-doc-custom,
  .stu-doclist { grid-template-columns: 1fr !important; }

  /* Empty-state padding */
  .stu-empty, .stu-list-empty { padding: 22px 14px; }
  .stu-coming { padding: 26px 14px; }
}

@media (max-width: 480px) {
  .stu-kpis { grid-template-columns: 1fr 1fr; }
  .stu-rp-fmt-grid { grid-template-columns: 1fr; }
  .page-title { font-size: 18px; }
  .stu-cls-row { padding: 8px 10px; }
  .stu-cls-actions .stu-rowbtn span,
  .stu-cls-actions .stu-rowbtn-text { display: none; }
}

/* ═══════════════════════════════════════════════════════════════════
   Pre-Enrollment — Challan / Receiving / Reporting / Slip modals reuse
   the Fee module's own modal/table/multi-select conventions verbatim
   (copied subset of Fee.jsx's FEE_CSS, same pattern already used above
   for .fee-subtabs/.fee-section) so they render pixel-identical.
   ═══════════════════════════════════════════════════════════════════ */
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
  .fee-modal, .fee-modal.lg, .fee-modal.sm { max-width: 96vw; }
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

.fee-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .4px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}
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
.fee-filters {
  display: flex;
  gap: 14px;
  align-items: flex-end;
  flex-wrap: wrap;
}
.fee-filters .fee-field { display: flex; flex-direction: column; min-width: 0; flex: 0 0 auto; }
.fee-field--grow { flex: 1; min-width: 240px; }
.fee-info {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 11px 14px;
  background: rgba(30,58,138,.05);
  border: 1px solid rgba(30,58,138,.15);
  border-radius: var(--radius-md);
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}
.fee-info > i { color: #1E40AF; margin-top: 2px; flex-shrink: 0; }
.fee-stud-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: var(--bg-muted);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
}
.fee-stud-logo {
  width: 44px; height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800;
  font-size: 15px;
  flex-shrink: 0;
}
.fee-stud-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 18px; font-size: 12.5px; color: var(--text-secondary); }
.fee-stud-meta b { color: var(--text-muted); font-weight: 700; margin-right: 4px; }

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
.fee-ms-toggle > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fee-ms-toggle i { color: var(--text-muted); font-size: 11px; transition: transform .2s ease; }
.fee-ms.open .fee-ms-toggle { border-color: #1E3A8A; box-shadow: 0 0 0 3px rgba(30,58,138,.08); }
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
.fee-ms-opt.sel .fee-ms-check { background: #1E3A8A; border-color: #1E3A8A; color: #fff; }
.fee-ms-name { flex: 1 1 auto; min-width: 0; white-space: normal; word-break: break-word; line-height: 1.35; color: inherit; }
.fee-ms-amt { font-size: 12px; font-weight: 700; color: var(--text-muted); font-variant-numeric: tabular-nums; flex-shrink: 0; margin-left: 6px; white-space: nowrap; }
.fee-ms-opt.sel .fee-ms-amt { color: #1E3A8A; }
.fee-ms-empty { padding: 14px 10px; text-align: center; font-size: 12px; color: var(--text-muted); }

.fee-stbl-wrap {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  overflow: hidden;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.fee-stbl { width: 100%; border-collapse: collapse; font-size: 12.5px; color: var(--text-primary); }
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
.fee-stbl tbody td { padding: 9px 10px; border-bottom: 1px solid var(--border-light); }
.fee-stbl tbody tr:last-child td { border-bottom: none; }
.fee-stbl .fee-num   { color: var(--text-muted); font-weight: 700; width: 36px; }
.fee-stbl .fee-right { text-align: right; font-variant-numeric: tabular-nums; }
.fee-stbl .fee-center { text-align: center; }
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
.fee-paid-amt { font-weight: 700; color: #16A34A; }
.fee-recv-paystrip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 18px; }
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
.fee-recv-payval { font-size: 18px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--text-primary); }
.fee-recv-payval.green { color: #16A34A; }
.fee-recv-payval.blue  { color: #1E3A8A; }
.fee-recv-payval.red   { color: #DC2626; }
.fee-recv-hist-title { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; letter-spacing: .3px; }
.fee-recv-hist-title i { color: var(--text-muted); }
.fee-chip { display: inline-flex; align-items: center; padding: 2px 9px; border-radius: 999px; font-size: 10.5px; font-weight: 800; background: var(--bg-muted); color: var(--text-muted); }
.fee-chip-active { background: rgba(30,58,138,.1); color: #1E40AF; }
.fee-dl-label { font-size: 11px; font-weight: 800; letter-spacing: .6px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px; display: flex; align-items: center; gap: 10px; }
.fee-dl-label::after { content: ''; flex: 1; height: 1px; background: var(--border-light); }
.fee-dl-fmt-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.fee-dl-fmt { display: flex; align-items: center; gap: 11px; border: 1.5px solid var(--border-light); border-radius: 12px; padding: 12px 14px; cursor: pointer; transition: all .2s ease; background: var(--bg-card); font-family: var(--font-body); text-align: left; width: 100%; }
.fee-dl-fmt:hover { border-color: var(--border-med); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(15,23,42,.10); }
.fee-dl-fmt.sel { border-color: #1E3A8A; box-shadow: 0 0 0 3px rgba(30,58,138,.12); }
.fee-dl-fmt-ic { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0; }
.fee-dl-fmt-name { font-size: 13.5px; font-weight: 800; color: var(--text-primary); }
.fee-dl-desc { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
@media (max-width: 520px) { .fee-dl-fmt-grid { grid-template-columns: 1fr; gap: 8px; } }
@media (max-width: 640px) {
  .fee-recv-paystrip { grid-template-columns: 1fr 1fr; }
  .fee-filters { flex-direction: column; align-items: stretch; }
  .fee-stud-meta { grid-template-columns: 1fr; }
}
`;
