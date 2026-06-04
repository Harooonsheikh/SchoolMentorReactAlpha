import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from './Tooltip';
import TutorialModal from './TutorialModal';
import * as crmService from '../services/admissionCrmService';
import useAsync from '../hooks/useAsync';

/* ─── Module-wide helpers ─── */
const STATUS_TO_CLS = {
  'Interested':          'status-interested',
  'Call Back Later':     'status-callback',
  'Visit Scheduled':     'status-visit',
  'Waiting Decision':    'status-waiting',
  'Admission Confirmed': 'status-confirmed',
  'Not Interested':      'status-notinterested',
};
const STATUS_DOT_COLOR = {
  'status-interested':    '#0284C7',
  'status-callback':      '#D97706',
  'status-visit':         '#7C3AED',
  'status-waiting':       '#64748B',
  'status-confirmed':     '#16A34A',
  'status-notinterested': '#DC2626',
};
const AVATAR_BG_FOR = {
  '#1E40AF': 'rgba(30,64,175,.12)',
  '#D97706': 'rgba(217,119,6,.12)',
  '#7C3AED': 'rgba(124,58,237,.12)',
  '#16A34A': 'rgba(22,163,74,.12)',
  '#0284C7': 'rgba(2,132,199,.12)',
  '#DC2626': 'rgba(220,38,38,.12)',
};
const avatarBg = (color) => AVATAR_BG_FOR[color] || 'rgba(30,64,175,.12)';

const FU_LABEL = { overdue: 'Overdue', today: "Today's", tmrw: "Tomorrow's" };
const FU_ICON  = { overdue: 'fa-circle-exclamation', today: 'fa-clock', tmrw: 'fa-calendar-day' };
const FU_COLOR = { overdue: '#DC2626', today: '#D97706', tmrw: '#0284C7' };

/* Status-filter-card colour map (mirrors STATUS_CARD_CONFIG in the HTML reference) */
const STATUS_CARD_CFG = {
  'Interested':          { color: '#0284C7', icon: 'fa-star' },
  'Call Back Later':     { color: '#D97706', icon: 'fa-phone-volume' },
  'Visit Scheduled':     { color: '#7C3AED', icon: 'fa-calendar-check' },
  'Waiting Decision':    { color: '#64748B', icon: 'fa-hourglass-half' },
  'Admission Confirmed': { color: '#16A34A', icon: 'fa-circle-check' },
  'Not Interested':      { color: '#DC2626', icon: 'fa-circle-xmark' },
};
/* Active statuses shown in the filter strip (excludes terminal states). */
const STATUS_FILTER_CARDS = ['Interested', 'Call Back Later', 'Visit Scheduled', 'Waiting Decision', 'Admission Confirmed'];

const MONTHS_SHORT_CRM = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDayMonth = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return `${MONTHS_SHORT_CRM[d.getMonth()]} ${d.getDate()}`;
};
const fmtFullDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return `${MONTHS_SHORT_CRM[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};
const todayCrmISO = () => new Date().toISOString().slice(0, 10);
const addDaysCrm = (iso, days) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const escHtml = (s) => String(s ?? '').replace(/[<>&"']/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[m]));

/* ─── A4 print helpers ─── */
function crmSchoolLogoSVG() {
  return `<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg"><rect width="36" height="36" rx="6" fill="#1E3A8A"/><path d="M18 10 C14 10 10 11.5 10 11.5 L10 26 C10 26 14 24.5 18 24.5 C22 24.5 26 26 26 26 L26 11.5 C26 11.5 22 10 18 10Z" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.6)" stroke-width="0.8"/><path d="M18 10 L18 24.5" stroke="rgba(255,255,255,0.7)" stroke-width="0.8"/></svg>`;
}

/* Opens an A4 popup. `color` switches the brand accent (blue/green/etc.) */
function openCrmReportWindow(title, inner, toast, color = '#1E3A8A', isBW = false) {
  const w = window.open('', '_blank');
  if (!w) { toast && toast('Please allow pop-ups to print', 'error'); return; }
  const escTitle = String(title || '').replace(/[<>&]/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m]));
  const css = `*{box-sizing:border-box;margin:0;padding:0}html,body{background:#F1F3F8}body{font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;color:#111;font-size:11px;line-height:1.45;padding:18px 0}.page{width:210mm;min-height:297mm;margin:0 auto;padding:14mm;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,.12)}.rhead{display:flex;align-items:center;gap:14px;border-bottom:2px solid ${color};padding-bottom:10px;margin-bottom:14px}.rlogo{width:46px;height:46px;flex-shrink:0}.rname{font-size:17px;font-weight:800;color:#0F172A;line-height:1.15}.rtitle{font-size:12px;font-weight:700;color:${color};margin-top:3px}.meta{margin-left:auto;font-size:9.5px;color:#64748B;text-align:right;line-height:1.55}.profile-card{display:flex;align-items:center;gap:14px;padding:14px 16px;border:1.5px solid #E5E7EB;border-radius:12px;background:linear-gradient(135deg,${color}10,transparent 70%);margin-bottom:14px}.profile-av{width:54px;height:54px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;flex-shrink:0;background:${color}20;color:${color}}.profile-name{font-size:18px;font-weight:800;color:#0F172A;letter-spacing:-.01em}.profile-sub{font-size:11.5px;color:#475569;margin-top:3px;display:flex;flex-wrap:wrap;gap:6px 16px}.profile-sub i{color:${color};margin-right:4px}.tag{display:inline-block;padding:3px 12px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.3px;border:1px solid}.tag.s-interested{background:rgba(2,132,199,.10);color:#0284C7;border-color:rgba(2,132,199,.28)}.tag.s-callback{background:rgba(217,119,6,.10);color:#D97706;border-color:rgba(217,119,6,.28)}.tag.s-visit{background:rgba(124,58,237,.10);color:#7C3AED;border-color:rgba(124,58,237,.28)}.tag.s-waiting{background:rgba(100,116,139,.10);color:#475569;border-color:rgba(100,116,139,.28)}.tag.s-confirmed{background:rgba(22,163,74,.12);color:#15803D;border-color:rgba(22,163,74,.28)}.tag.s-notinterested{background:rgba(220,38,38,.10);color:#B91C1C;border-color:rgba(220,38,38,.28)}.sec-band{background:${color};color:#fff;padding:8px 14px;border-radius:6px;font-weight:800;margin-bottom:10px;font-size:12px;display:flex;justify-content:space-between;align-items:center}.sec-band small{font-weight:700;opacity:.85;font-size:10px}.kvgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;padding:12px 14px;border:1px solid #E5E7EB;border-radius:8px;background:#F8FAFF;margin-bottom:12px}.kv-l{font-size:9.5px;font-weight:800;color:#64748B;text-transform:uppercase;letter-spacing:.3px}.kv-v{font-size:12px;color:#0F172A;font-weight:700;margin-top:2px}.kv-full{grid-column:1/-1}.tbl{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;font-size:10.5px;margin-bottom:10px}.tbl thead th{background:${color};color:#fff;padding:7px 9px;text-align:left;font-weight:700;font-size:9.5px;text-transform:uppercase;letter-spacing:.3px}.tbl th.r,.tbl td.r{text-align:right}.tbl th.c,.tbl td.c{text-align:center}.tbl tbody td{padding:7px 9px;border-bottom:1px solid #F1F3F8;vertical-align:top}.tbl tbody tr:nth-child(even) td{background:#FAFBFE}.tbl tbody tr:last-child td{border-bottom:0}.tbl td.mono{font-family:ui-monospace,Menlo,monospace;color:${color};font-weight:800}.note{padding:11px 14px;border:1px solid #E5E7EB;border-left:3px solid ${color};border-radius:7px;background:#FAFBFE;margin-bottom:8px}.note-meta{font-size:10px;color:#64748B;font-weight:700}.note-meta b{color:${color}}.note-text{font-size:11.5px;color:#1F2937;margin-top:6px;line-height:1.55}.note-fu{display:inline-block;margin-top:7px;font-size:10px;padding:3px 10px;border-radius:999px;background:${color}14;color:${color};border:1px solid ${color}33;font-weight:700}.callout{padding:10px 13px;border-radius:8px;background:${color}0F;border:1px solid ${color}33;color:#1F2937;font-size:11px;margin-top:10px;line-height:1.55}.callout b{color:${color}}.rfoot{margin-top:18px;text-align:center;font-size:9px;color:#94A3B8;border-top:1px solid #e5e9f2;padding-top:9px}.empty-state{text-align:center;padding:30px;color:#94A3B8;font-style:italic}@page{size:A4 portrait;margin:0}@media print{body{background:#fff;padding:0}.page{width:auto;min-height:0;margin:0;padding:14mm;box-shadow:none}.tbl tr,.note{page-break-inside:avoid}}
/* Colorless Report — strips gradients / colored backgrounds / colored
   tag fills / table-head fills / row striping to dark-on-white with
   light gray borders. Activates only when .crm-bw is on the body. */
.crm-bw .rhead{border-bottom-color:#0F172A !important;border-bottom-width:1.5px !important;}
.crm-bw .rtitle{color:#0F172A !important;}
.crm-bw .profile-card{background:#FFFFFF !important;border-color:#D1D5DB !important;}
.crm-bw .profile-av{background:#FFFFFF !important;color:#0F172A !important;border:1px solid #0F172A !important;}
.crm-bw .profile-sub i{color:#374151 !important;}
.crm-bw .sec-band{background:#FFFFFF !important;color:#0F172A !important;border:1.5px solid #0F172A !important;}
.crm-bw .sec-band small{color:#4B5563 !important;opacity:1 !important;}
.crm-bw .kvgrid{background:#FFFFFF !important;border-color:#D1D5DB !important;}
.crm-bw .tbl thead th{background:#FFFFFF !important;color:#0F172A !important;border-bottom:1.5px solid #0F172A !important;}
.crm-bw .tbl tbody tr:nth-child(even) td{background:transparent !important;}
.crm-bw .tbl td.mono{color:#0F172A !important;}
.crm-bw .tag{background:transparent !important;color:#0F172A !important;border-color:#9CA3AF !important;}
.crm-bw .note{background:#FFFFFF !important;border-color:#D1D5DB !important;border-left:3px solid #0F172A !important;}
.crm-bw .note-meta b{color:#0F172A !important;}
.crm-bw .note-fu{background:transparent !important;color:#0F172A !important;border:1px solid #9CA3AF !important;}
.crm-bw .callout{background:#FFFFFF !important;border-color:#D1D5DB !important;color:#0F172A !important;}
.crm-bw .callout b{color:#0F172A !important;}
`;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escTitle}</title><style>${css}</style></head><body${isBW ? ' class="crm-bw"' : ''}><div class="page">${inner}</div></body></html>`);
  w.document.close();
  w.onload = () => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } };
}

function crmReportHead(title, school, color = '#1E3A8A') {
  return `<div class="rhead"><div class="rlogo">${crmSchoolLogoSVG()}</div><div><div class="rname">${escHtml(school?.name || 'School')}</div><div class="rtitle">${escHtml(title)}</div></div><div class="meta">Generated: ${fmtFullDate(todayCrmISO())}<br/>${escHtml(school?.session || '')}</div></div>`;
}
function crmReportFoot(school) {
  return `<div class="rfoot">Generated on ${fmtFullDate(todayCrmISO())} · ${escHtml(school?.name || 'School')} · Admission CRM</div>`;
}

/* Per-lead Lead Report PDF (download icon in the action column). */
function buildLeadReportHTML(lead, school) {
  const l = lead;
  const sCls = (STATUS_TO_CLS[l.status] || 'status-interested').replace('status-', 's-');
  const notes = [...(l.notes || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  return `
    ${crmReportHead('Lead Report', school)}
    <div class="profile-card">
      <div class="profile-av">${escHtml(l.initials)}</div>
      <div style="flex:1;min-width:0">
        <div class="profile-name">${escHtml(l.name)}</div>
        <div class="profile-sub">
          <span><i class="fa">📞</i>${escHtml(l.phone)}</span>
          <span><i class="fa">🎓</i>${escHtml(l.classes)}</span>
          <span><i class="fa">👤</i>${escHtml(l.officer)}</span>
          <span><i class="fa">🌐</i>${escHtml(l.source)}</span>
        </div>
      </div>
      <span class="tag ${sCls}">${escHtml(l.status)}</span>
    </div>

    <div class="sec-band"><span>Lead Details</span><small>Lead ID: ${escHtml(l.id)}</small></div>
    <div class="kvgrid">
      <div><div class="kv-l">Parent Name</div><div class="kv-v">${escHtml(l.name)}</div></div>
      <div><div class="kv-l">Phone</div><div class="kv-v">${escHtml(l.phone)}</div></div>
      <div><div class="kv-l">WhatsApp</div><div class="kv-v">${escHtml(l.whatsapp || '—')}</div></div>
      <div><div class="kv-l">Email</div><div class="kv-v">${escHtml(l.email || '—')}</div></div>
      <div><div class="kv-l">Number of Students</div><div class="kv-v">${l.students}</div></div>
      <div><div class="kv-l">Classes Interested</div><div class="kv-v">${escHtml(l.classes)}</div></div>
      <div><div class="kv-l">Source</div><div class="kv-v">${escHtml(l.source)}</div></div>
      <div><div class="kv-l">Lead Status</div><div class="kv-v">${escHtml(l.status)}</div></div>
      <div><div class="kv-l">Assigned Officer</div><div class="kv-v">${escHtml(l.officer)}</div></div>
      <div><div class="kv-l">Assigned Date</div><div class="kv-v">${escHtml(fmtFullDate(l.assignedDate))}</div></div>
      <div><div class="kv-l">Last Follow-up</div><div class="kv-v">${escHtml(fmtFullDate(l.lastFu))}</div></div>
      <div><div class="kv-l">Next Follow-up</div><div class="kv-v">${escHtml(fmtFullDate(l.nextFu))}</div></div>
      ${l.address ? `<div class="kv-full"><div class="kv-l">Address</div><div class="kv-v">${escHtml(l.address)}</div></div>` : ''}
    </div>

    <div class="sec-band"><span>Discussion Notes</span><small>${notes.length} entr${notes.length === 1 ? 'y' : 'ies'}</small></div>
    ${notes.length === 0
      ? '<div class="empty-state">No discussion notes yet.</div>'
      : notes.map(n => `
        <div class="note">
          <div class="note-meta">${escHtml(fmtFullDate(n.date))} · ${escHtml(n.time)} · <b>${escHtml(n.staff)}</b></div>
          <div class="note-text">${escHtml(n.text)}</div>
          <div class="note-fu">Follow-up: ${escHtml(fmtFullDate(n.nextFu))} · ${escHtml(n.status)}</div>
        </div>`).join('')}

    ${crmReportFoot(school)}`;
}

/* Admission form (per-lead, fillable A4) — Students Module school
   admission application style. Color and B&W variants.   */
function buildAdmissionFormHTML(lead, school, fmt /* 'color' | 'bw' */) {
  const color  = fmt === 'bw' ? '#1E293B' : '#1E3A8A';
  const accent = fmt === 'bw' ? '#475569' : '#2563EB';
  /* Underline placeholder generator — used inside table/grid cells */
  const blank = (n = 25) => '&nbsp;';
  void blank;
  /* Build classes-array from "Class 3, Class 5" → ["Class 3", "Class 5"] */
  const classList = String(lead.classes || '').split(/,\s*/).filter(Boolean);
  const rows = Math.max(lead.students || 1, classList.length, 2);
  const studentRows = Array.from({ length: rows }).map((_, i) => `
    <tr>
      <td class="c" style="font-weight:800">${i + 1}.</td>
      <td class="ul"></td>
      <td class="ul"></td>
      <td class="ul" style="text-align:center">M / F</td>
      <td class="c ul">${classList[i] ? `<b style="color:${color}">${escHtml(classList[i])}</b>` : ''}</td>
      <td class="ul"></td>
    </tr>`).join('');

  return `
    <style>
      .af-head { display:flex; align-items:stretch; gap:14px; border:2px solid ${color}; border-radius:10px; padding:14px 18px; margin-bottom:14px; background:linear-gradient(135deg, ${color}08, transparent 60%); }
      .af-head .left { flex:1; display:flex; flex-direction:column; justify-content:center; }
      .af-school { font-size:20px; font-weight:800; color:${color}; letter-spacing:-.01em; line-height:1.15; }
      .af-session { font-size:11.5px; color:#475569; margin-top:2px; font-weight:600; }
      .af-title { font-size:14px; font-weight:800; color:${color}; margin-top:8px; padding-top:6px; border-top:1px dashed ${color}66; letter-spacing:.5px; text-transform:uppercase; }
      .af-photo { width:90px; height:110px; border:2px dashed ${color}66; border-radius:6px; display:flex; flex-direction:column; align-items:center; justify-content:center; font-size:9.5px; color:#64748B; font-weight:700; background:#FAFBFE; }
      .af-photo .ic { font-size:22px; margin-bottom:4px; }
      .af-meta { display:flex; gap:0; margin-bottom:12px; }
      .af-meta div { flex:1; padding:7px 12px; font-size:11px; font-weight:700; color:#1F2937; border:1px solid #CBD5E1; }
      .af-meta div:not(:last-child) { border-right:none; }
      .af-meta div b { color:${color}; margin-right:8px; }
      .af-meta div span.fill { display:inline-block; min-width:120px; border-bottom:1px dotted #94A3B8; padding-bottom:1px; }
      .sec-title { background:${color}; color:#fff; padding:6px 12px; border-radius:5px; font-weight:800; font-size:11.5px; letter-spacing:.4px; margin:14px 0 8px; display:flex; justify-content:space-between; align-items:center; }
      .sec-title small { font-weight:700; opacity:.85; font-size:9.5px; }
      .field-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:0; border:1px solid #CBD5E1; border-radius:6px; overflow:hidden; margin-bottom:8px; }
      .field-grid .f { padding:7px 11px; border-right:1px solid #CBD5E1; border-bottom:1px solid #CBD5E1; min-height:38px; display:flex; flex-direction:column; gap:2px; }
      .field-grid .f:nth-child(3n) { border-right:none; }
      .field-grid .f.span2 { grid-column:span 2; }
      .field-grid .f.span3 { grid-column:1/-1; border-right:none; }
      .field-grid .f .l { font-size:9px; font-weight:800; color:${color}; text-transform:uppercase; letter-spacing:.4px; }
      .field-grid .f .v { font-size:11.5px; color:#1F2937; font-weight:600; border-bottom:1px dotted #94A3B8; padding:2px 0; min-height:14px; }
      .field-grid .f .v.filled { border-bottom:none; }
      .tbl.af-tbl { font-size:10.5px; margin-bottom:8px; }
      .tbl.af-tbl thead th { background:${color}; color:#fff; font-size:9.5px; }
      .tbl.af-tbl td { padding:9px 8px; }
      .tbl.af-tbl td.ul { border-bottom:1px dotted #94A3B8; }
      .tickrow { display:flex; flex-wrap:wrap; gap:7px 12px; padding:8px 11px; border:1px solid #CBD5E1; border-radius:6px; margin-bottom:8px; }
      .tickrow .tick { display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:600; color:#1F2937; }
      .tickrow .tick .box { display:inline-block; width:11px; height:11px; border:1.5px solid ${color}; border-radius:2px; }
      .declaration { padding:11px 13px; border:1px solid #CBD5E1; border-radius:6px; background:#FAFBFE; font-size:10.5px; line-height:1.6; color:#1F2937; margin-bottom:8px; }
      .signrow { display:flex; gap:18px; margin-top:18px; }
      .signrow > div { flex:1; border-top:1.5px solid #94A3B8; padding-top:5px; font-size:9.5px; font-weight:700; color:#64748B; }
      .office-band { background:#FEF3C7; border:2px dashed #D97706; padding:9px 12px; border-radius:6px; font-size:10px; color:#92400E; font-weight:700; text-transform:uppercase; letter-spacing:.5px; text-align:center; margin:12px 0 6px; }
      .docs-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px 12px; padding:9px 13px; border:1px solid #CBD5E1; border-radius:6px; }
      .docs-grid .doc { display:flex; align-items:center; gap:6px; font-size:10.5px; color:#1F2937; }
      .docs-grid .doc .box { display:inline-block; width:11px; height:11px; border:1.5px solid ${color}; border-radius:2px; flex-shrink:0; }
    </style>

    <!-- HEADER -->
    <div class="af-head">
      <div class="left">
        <div class="af-school">${escHtml(school?.name || 'School')}</div>
        <div class="af-session">${escHtml(school?.session || 'Academic Session')} · Affiliated</div>
        <div class="af-title">Admission Application Form</div>
      </div>
      <div class="af-photo">
        <div class="ic">📷</div>
        Affix recent
        <div>passport-size</div>
        <div>photograph</div>
      </div>
    </div>

    <!-- META: Form No / Date / Class Applied -->
    <div class="af-meta">
      <div><b>Form No.</b><span class="fill"></span></div>
      <div><b>Date</b><span class="fill">${fmtFullDate(todayCrmISO())}</span></div>
      <div><b>Lead ID</b><span class="fill" style="color:${color};font-weight:800;font-family:ui-monospace,Menlo,monospace">${escHtml(lead.id)}</span></div>
    </div>

    <!-- SECTION 1 — STUDENT INFORMATION -->
    <div class="sec-title"><span>1. Student Information</span><small>Use block letters</small></div>
    <table class="tbl af-tbl">
      <thead><tr><th style="width:24px">#</th><th>Student Name</th><th style="width:90px">Date of Birth</th><th style="width:55px">Gender</th><th style="width:80px">Class Applying</th><th style="width:80px">Section Pref.</th></tr></thead>
      <tbody>${studentRows}</tbody>
    </table>

    <div class="field-grid">
      <div class="f"><div class="l">Place of Birth</div><div class="v"></div></div>
      <div class="f"><div class="l">Religion</div><div class="v"></div></div>
      <div class="f"><div class="l">Nationality</div><div class="v">Pakistani</div></div>
      <div class="f"><div class="l">Mother Tongue</div><div class="v"></div></div>
      <div class="f"><div class="l">Blood Group</div><div class="v"></div></div>
      <div class="f"><div class="l">No. of Siblings</div><div class="v">${lead.students > 1 ? lead.students - 1 : ''}</div></div>
      <div class="f"><div class="l">B-Form / CNIC of Child</div><div class="v"></div></div>
      <div class="f span2"><div class="l">Permanent Address</div><div class="v ${lead.address ? 'filled' : ''}">${escHtml(lead.address || '')}</div></div>
    </div>

    <!-- SECTION 2 — FATHER INFORMATION -->
    <div class="sec-title"><span>2. Father / Guardian Information</span><small>Primary contact</small></div>
    <div class="field-grid">
      <div class="f span2"><div class="l">Father's Full Name</div><div class="v filled" style="color:${color};font-weight:800">${escHtml(lead.name)}</div></div>
      <div class="f"><div class="l">Father's CNIC</div><div class="v"></div></div>
      <div class="f"><div class="l">Occupation</div><div class="v"></div></div>
      <div class="f"><div class="l">Designation</div><div class="v"></div></div>
      <div class="f"><div class="l">Monthly Income</div><div class="v"></div></div>
      <div class="f"><div class="l">Mobile / Phone</div><div class="v filled" style="font-family:ui-monospace,Menlo,monospace">${escHtml(lead.phone)}</div></div>
      <div class="f"><div class="l">WhatsApp</div><div class="v ${lead.whatsapp ? 'filled' : ''}" style="font-family:ui-monospace,Menlo,monospace">${escHtml(lead.whatsapp || '')}</div></div>
      <div class="f"><div class="l">Email</div><div class="v ${lead.email ? 'filled' : ''}">${escHtml(lead.email || '')}</div></div>
      <div class="f span3"><div class="l">Office Address</div><div class="v"></div></div>
    </div>

    <!-- SECTION 3 — MOTHER INFORMATION -->
    <div class="sec-title"><span>3. Mother Information</span><small></small></div>
    <div class="field-grid">
      <div class="f span2"><div class="l">Mother's Full Name</div><div class="v"></div></div>
      <div class="f"><div class="l">Mother's CNIC</div><div class="v"></div></div>
      <div class="f"><div class="l">Education</div><div class="v"></div></div>
      <div class="f"><div class="l">Occupation</div><div class="v"></div></div>
      <div class="f"><div class="l">Mobile / Phone</div><div class="v"></div></div>
    </div>

    <!-- SECTION 4 — PREVIOUS SCHOOL -->
    <div class="sec-title"><span>4. Previous School (if any)</span><small>Per child</small></div>
    <table class="tbl af-tbl">
      <thead><tr><th style="width:24px">#</th><th>School Name</th><th style="width:70px">Last Class</th><th style="width:70px">Year</th><th>Reason for Leaving</th></tr></thead>
      <tbody>${Array.from({ length: rows }).map((_, i) => `
        <tr><td class="c" style="font-weight:800">${i + 1}.</td><td class="ul"></td><td class="ul"></td><td class="ul"></td><td class="ul"></td></tr>`).join('')}</tbody>
    </table>

    <!-- SECTION 5 — HEALTH / MEDICAL -->
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

    <!-- SECTION 6 — EMERGENCY CONTACT -->
    <div class="sec-title"><span>6. Emergency Contact</span><small>Other than parents</small></div>
    <div class="field-grid">
      <div class="f"><div class="l">Name</div><div class="v"></div></div>
      <div class="f"><div class="l">Relation</div><div class="v"></div></div>
      <div class="f"><div class="l">Phone</div><div class="v"></div></div>
      <div class="f span2"><div class="l">Address</div><div class="v"></div></div>
      <div class="f"><div class="l">Alternate Phone</div><div class="v"></div></div>
    </div>

    <!-- SECTION 7 — TRANSPORT / OTHER -->
    <div class="sec-title"><span>7. Transport &amp; Additional Services</span><small>Optional</small></div>
    <div class="tickrow">
      <span class="tick"><span class="box"></span> School Van / Transport Required</span>
      <span class="tick"><span class="box"></span> Lunch / Tuck Service</span>
      <span class="tick"><span class="box"></span> After-school Care</span>
      <span class="tick"><span class="box"></span> Sibling Discount Eligibility</span>
    </div>
    <div class="field-grid">
      <div class="f"><div class="l">Pickup Area / Route</div><div class="v"></div></div>
      <div class="f"><div class="l">Source of Inquiry</div><div class="v filled" style="color:${color};font-weight:800">${escHtml(lead.source)}</div></div>
      <div class="f"><div class="l">Reference (if any)</div><div class="v"></div></div>
    </div>

    <!-- SECTION 8 — DOCUMENTS CHECKLIST -->
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

    <!-- SECTION 9 — DECLARATION -->
    <div class="sec-title"><span>9. Declaration by Parent / Guardian</span><small></small></div>
    <div class="declaration">
      I, <span style="border-bottom:1px dotted #94A3B8;display:inline-block;min-width:220px;padding:0 4px;font-weight:800;color:${color}">${escHtml(lead.name)}</span>,
      father / guardian of the above named student(s), hereby declare that all the information provided in this admission application form is true and complete to the best of my knowledge.
      I have read and agreed to the school's <b>Admission Policy</b>, <b>Code of Conduct</b>, and <b>Fee Structure</b>.
      I understand that any misrepresentation may lead to immediate cancellation of admission, and that the registration fee is <b>non-refundable</b>.
      I authorise the school to use my child's photographs for school records and academic purposes.
      <div class="signrow">
        <div>Parent / Guardian Signature &amp; Date</div>
        <div>Witness Name &amp; Signature</div>
      </div>
    </div>

    <!-- FOR OFFICE USE -->
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

    ${crmReportFoot(school)}`;
}

/* ─── Fee details share PDF — matches the HTML reference exactly.
   `sections` { feeStructure, uniform, books, admission } are booleans
   for the 4 includable sections from the Share Fee modal. The PDF
   pulls from the same Lead Setup data store the Setup tab uses. */
function buildShareFeeHTML(lead, school, fmt, sections) {
  const color  = fmt === 'bw' ? '#1F2937' : '#7C3AED';
  const accent = fmt === 'bw' ? '#475569' : '#1E40AF';
  const sec    = sections || { feeStructure: true, uniform: true, books: true, admission: true };

  /* The lead may carry multiple classes ("Class 3, Class 5") — render
     a sub-section per class so the parent sees rates for each child. */
  const classList = String(lead.classes || '').split(/,\s*/).map(c => c.trim()).filter(Boolean);
  const primaryClass = classList[0] || '';

  /* ─── 1. Standard Fee Structure (from Fee Module / Setup tab) ─── */
  let feeStructureSection = '';
  if (sec.feeStructure) {
    const classesWithFee = classList.filter(c => DEFAULT_FEE_STRUCTURE[c] && DEFAULT_FEE_STRUCTURE[c].length);
    const hasAny = classesWithFee.length > 0;
    feeStructureSection = `
      <div class="sec-band" style="margin-top:14px;background:${accent}"><span>1. Standard Fee Structure</span><small>Monthly tuition &amp; recurring charges</small></div>
      ${hasAny ? classesWithFee.map(cls => {
        const rows = DEFAULT_FEE_STRUCTURE[cls];
        const total = rows.reduce((a, r) => a + (r.amount || 0), 0);
        return `
        <div style="margin-bottom:10px">
          <div style="font-size:12.5px;font-weight:800;color:${accent};margin-bottom:6px;padding:5px 12px;background:${accent}14;border-left:3px solid ${accent};border-radius:0 6px 6px 0">${escHtml(cls)}</div>
          <table class="tbl">
            <thead><tr><th style="width:28px">#</th><th>Fee Head</th><th style="width:110px">Frequency</th><th class="r" style="width:110px">Amount (Rs)</th></tr></thead>
            <tbody>${rows.map((r, i) => `<tr><td class="c">${i + 1}</td><td><b>${escHtml(r.name)}</b></td><td>${escHtml(r.freq)}</td><td class="r">Rs ${(r.amount || 0).toLocaleString('en-PK')}</td></tr>`).join('')}</tbody>
            <tfoot><tr><td colspan="3" class="r" style="background:#F1F3F8;font-weight:800">Subtotal — ${escHtml(cls)}</td><td class="r" style="background:#F1F3F8;font-weight:800;color:${color}">Rs ${total.toLocaleString('en-PK')}</td></tr></tfoot>
          </table>
        </div>`;
      }).join('') : `<div class="empty-state">No fee structure on record for ${escHtml(lead.classes || 'the selected class(es)')}.</div>`}`;
  }

  /* ─── 2. Uniform Charges ─── */
  let uniformSection = '';
  if (sec.uniform) {
    const uniformsForLead = DEFAULT_UNIFORM.filter(u => classList.includes(u.cls));
    const total = uniformsForLead.reduce((a, u) => a + (u.charges || 0), 0);
    uniformSection = `
      <div class="sec-band" style="margin-top:14px;background:${accent}"><span>2. Uniform Charges</span><small>Summer · Winter · Sports</small></div>
      ${uniformsForLead.length === 0 ? `<div class="empty-state">No uniform charges configured for ${escHtml(lead.classes || 'the selected class(es)')}.</div>` : `
      <table class="tbl">
        <thead><tr><th style="width:28px">#</th><th style="width:80px">Class</th><th>Uniform Type</th><th style="width:90px">Season</th><th class="r" style="width:110px">Charges (Rs)</th></tr></thead>
        <tbody>${uniformsForLead.map((u, i) => `<tr><td class="c">${i + 1}</td><td><b>${escHtml(u.cls)}</b></td><td>${escHtml(u.type)}</td><td>${escHtml(u.season)}</td><td class="r">Rs ${(u.charges || 0).toLocaleString('en-PK')}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="4" class="r" style="background:#F1F3F8;font-weight:800">Uniform Subtotal</td><td class="r" style="background:#F1F3F8;font-weight:800;color:${color}">Rs ${total.toLocaleString('en-PK')}</td></tr></tfoot>
      </table>`}`;
  }

  /* ─── 3. Books & Stationery ─── */
  let booksSection = '';
  if (sec.books) {
    const booksForLead = DEFAULT_BOOKS.filter(b => classList.includes(b.cls));
    const totalBooks = booksForLead.reduce((a, b) => a + (b.books || 0) + (b.stationery || 0) + (b.optional || 0), 0);
    booksSection = `
      <div class="sec-band" style="margin-top:14px;background:#16A34A"><span>3. Books &amp; Stationery</span><small>Per-class charges</small></div>
      ${booksForLead.length === 0 ? `<div class="empty-state">No books charges configured for ${escHtml(lead.classes || 'the selected class(es)')}.</div>` : `
      <table class="tbl">
        <thead><tr><th style="width:28px">#</th><th>Class</th><th class="r" style="width:90px">Books</th><th class="r" style="width:90px">Stationery</th><th class="r" style="width:90px">Optional</th><th style="width:100px">Frequency</th><th class="r" style="width:100px">Total (Rs)</th></tr></thead>
        <tbody>${booksForLead.map((b, i) => {
          const sub = (b.books || 0) + (b.stationery || 0) + (b.optional || 0);
          return `<tr><td class="c">${i + 1}</td><td><b>${escHtml(b.cls)}</b></td><td class="r">Rs ${(b.books || 0).toLocaleString('en-PK')}</td><td class="r">Rs ${(b.stationery || 0).toLocaleString('en-PK')}</td><td class="r">${b.optional ? `Rs ${b.optional.toLocaleString('en-PK')}` : '—'}</td><td>${escHtml(b.frequency)}</td><td class="r">Rs ${sub.toLocaleString('en-PK')}</td></tr>`;
        }).join('')}</tbody>
        <tfoot><tr><td colspan="6" class="r" style="background:#F1F3F8;font-weight:800">Books &amp; Stationery Subtotal</td><td class="r" style="background:#F1F3F8;font-weight:800;color:${color}">Rs ${totalBooks.toLocaleString('en-PK')}</td></tr></tfoot>
      </table>`}`;
  }

  /* ─── 4. Admission Charges ─── */
  let admissionSection = '';
  if (sec.admission) {
    const adm = DEFAULT_ADMISSION;
    const total = adm.admFee + adm.regFee + adm.security + adm.other;
    admissionSection = `
      <div class="sec-band" style="margin-top:14px;background:#D97706"><span>4. Admission Charges</span><small>${escHtml(adm.frequency)} · per child</small></div>
      <table class="tbl">
        <thead><tr><th style="width:28px">#</th><th>Charge</th><th>Frequency</th><th class="r" style="width:120px">Amount (Rs)</th></tr></thead>
        <tbody>
          <tr><td class="c">1</td><td><b>Admission Fee</b></td><td>${escHtml(adm.frequency)}</td><td class="r">Rs ${adm.admFee.toLocaleString('en-PK')}</td></tr>
          <tr><td class="c">2</td><td><b>Registration Fee</b></td><td>${escHtml(adm.frequency)}</td><td class="r">Rs ${adm.regFee.toLocaleString('en-PK')}</td></tr>
          <tr><td class="c">3</td><td><b>Security Deposit</b></td><td>${escHtml(adm.frequency)} <span style="color:#16A34A;font-weight:700">(Refundable)</span></td><td class="r">Rs ${adm.security.toLocaleString('en-PK')}</td></tr>
          <tr><td class="c">4</td><td><b>Other Charges</b></td><td>${escHtml(adm.frequency)}</td><td class="r">Rs ${adm.other.toLocaleString('en-PK')}</td></tr>
        </tbody>
        <tfoot><tr><td colspan="3" class="r" style="background:#F1F3F8;font-weight:800">Admission Subtotal</td><td class="r" style="background:#F1F3F8;font-weight:800;color:${color}">Rs ${total.toLocaleString('en-PK')}</td></tr></tfoot>
      </table>
      ${adm.notes ? `<div style="font-size:10.5px;color:#475569;margin-top:6px;line-height:1.6;padding:8px 12px;background:rgba(217,119,6,.06);border-left:3px solid #D97706;border-radius:0 6px 6px 0"><i class="fa">ℹ️</i> ${escHtml(adm.notes)}</div>` : ''}`;
  }

  /* ─── Grand summary across all enabled sections ─── */
  const grandRows = [];
  if (sec.feeStructure) {
    classList.forEach(cls => {
      const rows = DEFAULT_FEE_STRUCTURE[cls];
      if (rows) grandRows.push({ label: `Fee Structure — ${cls}`, amount: rows.reduce((a, r) => a + (r.amount || 0), 0) });
    });
  }
  if (sec.uniform) {
    const t = DEFAULT_UNIFORM.filter(u => classList.includes(u.cls)).reduce((a, u) => a + (u.charges || 0), 0);
    if (t) grandRows.push({ label: 'Uniform Charges', amount: t });
  }
  if (sec.books) {
    const t = DEFAULT_BOOKS.filter(b => classList.includes(b.cls)).reduce((a, b) => a + (b.books || 0) + (b.stationery || 0) + (b.optional || 0), 0);
    if (t) grandRows.push({ label: 'Books & Stationery', amount: t });
  }
  if (sec.admission) {
    const adm = DEFAULT_ADMISSION;
    grandRows.push({ label: 'Admission Charges', amount: adm.admFee + adm.regFee + adm.security + adm.other });
  }
  const grandTotal = grandRows.reduce((a, r) => a + r.amount, 0);

  return `
    ${crmReportHead('Fee Structure & Charges', school, color)}
    <div class="profile-card">
      <div class="profile-av">${escHtml(lead.initials)}</div>
      <div style="flex:1;min-width:0">
        <div class="profile-name">${escHtml(lead.name)}</div>
        <div class="profile-sub">
          <span><i>📞</i>${escHtml(lead.phone)}</span>
          <span><i>🎓</i>${escHtml(lead.classes)} · ${lead.students} student${lead.students === 1 ? '' : 's'}</span>
          <span><i>👤</i>${escHtml(lead.officer)}</span>
          <span><i>🌐</i>${escHtml(lead.source)}</span>
        </div>
      </div>
      <span class="tag s-interested">Personalised Quote</span>
    </div>

    <div class="callout"><b>Estimated fee package</b> for <strong>${escHtml(lead.classes || 'your selected class')}</strong>. Final billing may vary based on optional services, admission timing &amp; available scholarships. Please contact the admissions office for the final figure.</div>

    ${feeStructureSection}
    ${uniformSection}
    ${booksSection}
    ${admissionSection}

    ${grandRows.length > 0 ? `
      <div class="sec-band" style="margin-top:18px;background:${color}"><span>Grand Summary</span><small>Across selected sections</small></div>
      <table class="tbl">
        <thead><tr><th style="width:28px">#</th><th>Section</th><th class="r" style="width:140px">Amount (Rs)</th></tr></thead>
        <tbody>${grandRows.map((r, i) => `<tr><td class="c">${i + 1}</td><td><b>${escHtml(r.label)}</b></td><td class="r">Rs ${r.amount.toLocaleString('en-PK')}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="2" class="r" style="background:${color};color:#fff;font-weight:800;font-size:13px">Total — ${escHtml(lead.classes || primaryClass || 'selected')}</td><td class="r" style="background:${color};color:#fff;font-weight:800;font-size:14px">Rs ${grandTotal.toLocaleString('en-PK')}</td></tr></tfoot>
      </table>
    ` : ''}

    <div class="callout" style="margin-top:14px">
      <b>How to confirm admission:</b>
      <ol style="margin:6px 0 0 20px;padding:0;font-size:11px;line-height:1.7">
        <li>Pay the One-time Admission &amp; Registration fees by visiting the school office.</li>
        <li>Submit the completed Admission Form along with required documents.</li>
        <li>Receive student ID &amp; class allocation within 48 hours of payment.</li>
      </ol>
    </div>

    ${crmReportFoot(school)}`;
}

/* Bulk Active Leads export — A4 PDF table */
function buildLeadsExportHTML(leads, school) {
  const totalStudents = leads.reduce((a, l) => a + (l.students || 0), 0);
  const overdue = leads.filter(l => l.followup === 'overdue').length;
  const today   = leads.filter(l => l.followup === 'today').length;
  return `
    ${crmReportHead('Active Leads — Export', school)}
    <div class="profile-card">
      <div class="profile-av" style="background:rgba(30,58,138,.15)">${leads.length}</div>
      <div style="flex:1">
        <div class="profile-name">Active Leads Roster</div>
        <div class="profile-sub">
          <span><i>👥</i><b>${leads.length}</b> leads</span>
          <span><i>🎓</i><b>${totalStudents}</b> students interested</span>
          <span style="color:#DC2626"><i>⚠</i><b>${overdue}</b> overdue follow-ups</span>
          <span style="color:#D97706"><i>⏰</i><b>${today}</b> today's follow-ups</span>
        </div>
      </div>
    </div>

    <div class="sec-band"><span>Active Leads</span><small>${leads.length} record(s)</small></div>
    <table class="tbl">
      <thead><tr><th>#</th><th>Lead ID</th><th>Parent</th><th>Phone</th><th class="c">Students</th><th>Classes</th><th>Status</th><th>Officer</th><th>Source</th><th>Next FU</th></tr></thead>
      <tbody>${leads.length === 0
        ? '<tr><td colspan="10" class="c">No leads to export.</td></tr>'
        : leads.map((l, i) => `<tr><td class="c">${i + 1}</td><td class="mono">${escHtml(l.id)}</td><td><b>${escHtml(l.name)}</b></td><td>${escHtml(l.phone)}</td><td class="c">${l.students}</td><td>${escHtml(l.classes)}</td><td>${escHtml(l.status)}</td><td>${escHtml(l.officer)}</td><td>${escHtml(l.source)}</td><td>${escHtml(fmtFullDate(l.nextFu))}</td></tr>`).join('')}</tbody>
    </table>

    ${crmReportFoot(school)}`;
}

/* Sample follow-up history embedded in the Converted / Not-Interested PDFs
   (the HTML reference shows a couple of notes by default since the lead's
   own history is no longer reachable once it leaves the active inbox). */
const INACTIVE_SAMPLE_NOTES = [
  { date: '2026-04-22', staff: 'Sarah Khan', text: 'Parent visited the campus, saw classrooms and met the principal. Very positive response.' },
  { date: '2026-04-29', staff: 'Sarah Khan', text: 'Shared the personalised fee structure on WhatsApp. Parent reviewing with spouse.' },
  { date: '2026-05-06', staff: 'Sarah Khan', text: 'Follow-up call. Parent finalising decision after sibling discussion.' },
];

/* ─── Converted Admissions A4 PDF — green theme + "ADMITTED" badge.
   Matches downloadConvertedReport() in the HTML reference. */
function buildConvertedReportHTML(row, school) {
  return `
    ${crmReportHead('Confirmed Admission Lead Report', school, '#15803D')}

    <div class="profile-card" style="background:linear-gradient(135deg,rgba(22,163,74,.10),transparent 70%);border-color:rgba(22,163,74,.25)">
      <div class="profile-av" style="background:rgba(22,163,74,.18);color:#15803D">${escHtml(row.initials)}</div>
      <div style="flex:1;min-width:0">
        <div class="profile-name">${escHtml(row.name)}</div>
        <div class="profile-sub">
          <span><i>📞</i>${escHtml(row.phone)}</span>
          <span><i>🎓</i>${escHtml(row.classes)} · ${row.students} student${row.students === 1 ? '' : 's'}</span>
          <span><i>👤</i>${escHtml(row.officer)}</span>
          <span><i>🌐</i>${escHtml(row.source)}</span>
        </div>
      </div>
      <span class="tag s-confirmed" style="font-size:11px">✓ ADMITTED</span>
    </div>

    <div class="callout" style="background:rgba(22,163,74,.06);border-color:rgba(22,163,74,.32)">
      <b style="color:#15803D">Confirmed Admission</b> · This lead has been successfully converted into a student admission on <b>${escHtml(fmtFullDate(row.convertedDate))}</b>.
    </div>

    <div class="sec-band" style="margin-top:14px;background:#15803D"><span>Lead Information</span><small>Snapshot at conversion</small></div>
    <div class="kvgrid">
      <div><div class="kv-l">Parent Name</div><div class="kv-v">${escHtml(row.name)}</div></div>
      <div><div class="kv-l">Phone</div><div class="kv-v">${escHtml(row.phone)}</div></div>
      <div><div class="kv-l">Lead ID</div><div class="kv-v" style="font-family:ui-monospace,Menlo,monospace;color:#15803D">${escHtml(row.id || '—')}</div></div>
      <div><div class="kv-l">Source</div><div class="kv-v">${escHtml(row.source)}</div></div>
    </div>

    <div class="sec-band" style="margin-top:14px;background:#15803D"><span>Conversion Details</span><small>Admission outcome</small></div>
    <div class="kvgrid">
      <div><div class="kv-l">Converted Date</div><div class="kv-v" style="color:#15803D;font-weight:800">${escHtml(fmtFullDate(row.convertedDate))}</div></div>
      <div><div class="kv-l">Students Admitted</div><div class="kv-v">${row.students}</div></div>
      <div><div class="kv-l">Classes</div><div class="kv-v">${escHtml(row.classes)}</div></div>
      <div><div class="kv-l">Assigned Officer</div><div class="kv-v">${escHtml(row.officer)}</div></div>
      <div><div class="kv-l">Fee Category</div><div class="kv-v">${escHtml(row.feeCategory || '—')}</div></div>
      <div><div class="kv-l">Lead Status</div><div class="kv-v" style="color:#15803D;font-weight:800">Admission Confirmed</div></div>
    </div>

    <div class="sec-band" style="margin-top:14px;background:#15803D"><span>Follow-up History</span><small>${INACTIVE_SAMPLE_NOTES.length} entr${INACTIVE_SAMPLE_NOTES.length === 1 ? 'y' : 'ies'}</small></div>
    ${INACTIVE_SAMPLE_NOTES.map(n => `
      <div class="note" style="border-left-color:#15803D">
        <div class="note-meta">${escHtml(fmtFullDate(n.date))} · <b>${escHtml(n.staff)}</b></div>
        <div class="note-text">${escHtml(n.text)}</div>
      </div>`).join('')}

    <div style="margin-top:18px;display:flex;gap:18px">
      <div style="flex:1;border-top:1.5px solid #94A3B8;padding-top:6px;font-size:10px;font-weight:700;color:#64748B">Admission Officer Signature &amp; Date</div>
      <div style="flex:1;border-top:1.5px solid #94A3B8;padding-top:6px;font-size:10px;font-weight:700;color:#64748B">Principal Signature &amp; Date</div>
    </div>

    ${crmReportFoot(school)}`;
}

/* ─── Not Interested A4 PDF — red theme + "✗ NOT INTERESTED" badge.
   Matches downloadNotInterestedReport() in the HTML reference. */
function buildNotInterestedReportHTML(row, school) {
  return `
    ${crmReportHead('Not Interested Lead Report', school, '#B91C1C')}

    <div class="profile-card" style="background:linear-gradient(135deg,rgba(220,38,38,.08),transparent 70%);border-color:rgba(220,38,38,.22)">
      <div class="profile-av" style="background:rgba(220,38,38,.14);color:#B91C1C">${escHtml(row.initials)}</div>
      <div style="flex:1;min-width:0">
        <div class="profile-name">${escHtml(row.name)}</div>
        <div class="profile-sub">
          <span><i>📞</i>${escHtml(row.phone)}</span>
          <span><i>🎓</i>${escHtml(row.classes)}</span>
          <span><i>👤</i>${escHtml(row.officer)}</span>
          <span><i>🌐</i>${escHtml(row.source)}</span>
        </div>
      </div>
      <span class="tag s-notinterested" style="font-size:11px">✗ NOT INTERESTED</span>
    </div>

    <div class="callout" style="background:rgba(220,38,38,.05);border-color:rgba(220,38,38,.28)">
      <b style="color:#B91C1C">Lead marked Not Interested</b> with reason <b>"${escHtml(row.reason)}"</b>.
      This lead can be reactivated at any time from the Inactive Leads → Not Interested view.
    </div>

    <div class="sec-band" style="margin-top:14px;background:#B91C1C"><span>Lead Information</span><small>Snapshot before rejection</small></div>
    <div class="kvgrid">
      <div><div class="kv-l">Parent Name</div><div class="kv-v">${escHtml(row.name)}</div></div>
      <div><div class="kv-l">Phone</div><div class="kv-v">${escHtml(row.phone)}</div></div>
      <div><div class="kv-l">Lead ID</div><div class="kv-v" style="font-family:ui-monospace,Menlo,monospace;color:#B91C1C">${escHtml(row.id || '—')}</div></div>
      <div><div class="kv-l">Source</div><div class="kv-v">${escHtml(row.source)}</div></div>
    </div>

    <div class="sec-band" style="margin-top:14px;background:#B91C1C"><span>Rejection Details</span><small>Why the parent did not proceed</small></div>
    <div class="kvgrid">
      <div><div class="kv-l">Reason</div><div class="kv-v" style="color:#B91C1C;font-weight:800">${escHtml(row.reason)}</div></div>
      <div><div class="kv-l">Last Follow-up</div><div class="kv-v">${escHtml(fmtFullDate(row.lastFu))}</div></div>
      <div><div class="kv-l">Classes Interested</div><div class="kv-v">${escHtml(row.classes)}</div></div>
      <div><div class="kv-l">Assigned Officer</div><div class="kv-v">${escHtml(row.officer)}</div></div>
      <div><div class="kv-l">Lead Status</div><div class="kv-v" style="color:#B91C1C;font-weight:800">Not Interested</div></div>
      <div><div class="kv-l">Can Reactivate</div><div class="kv-v" style="color:#15803D;font-weight:800">Yes</div></div>
    </div>

    <div class="sec-band" style="margin-top:14px;background:#475569"><span>Follow-up History</span><small>${INACTIVE_SAMPLE_NOTES.length} entr${INACTIVE_SAMPLE_NOTES.length === 1 ? 'y' : 'ies'}</small></div>
    ${INACTIVE_SAMPLE_NOTES.map(n => `
      <div class="note" style="border-left-color:#475569">
        <div class="note-meta">${escHtml(fmtFullDate(n.date))} · <b>${escHtml(n.staff)}</b></div>
        <div class="note-text">${escHtml(n.text)}</div>
      </div>`).join('')}

    ${crmReportFoot(school)}`;
}

function buildLeadsCSV(leads) {
  const escC = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const header = ['Lead ID', 'Parent Name', 'Phone', 'WhatsApp', 'Email', 'Students', 'Classes', 'Status', 'Officer', 'Source', 'Last Follow-up', 'Next Follow-up', 'Assigned Date'];
  const rows = leads.map(l => [l.id, l.name, l.phone, l.whatsapp || '', l.email || '', l.students, l.classes, l.status, l.officer, l.source, l.lastFu || '', l.nextFu || '', l.assignedDate || '']);
  return [header.join(','), ...rows.map(r => r.map(escC).join(','))].join('\n');
}

/* ═══════════════════════════════════════════════════════════════════
   ADMISSION CRM — shell + 4 main tabs.
   Ported from ~/Desktop/ERP-HTML/Admissions CRM .html

   Step 1 (this turn): page header + 4 main tabs (Lead Setup /
   Active Leads / Inactive Leads / Reports) with Coming Soon bodies,
   mock data + service layer in place.

   Subsequent steps:
     2. Active Leads (KPI + follow-up alerts + table + detail)
     3. Lead lifecycle modals (add/edit, follow-up, confirm, reject)
     4. Inactive Leads (Converted + Not Interested sub-tabs)
     5. Lead Setup (Uniforms / Books / Fee / Admission)
     6. Reports + Share Fee + Generate Form + Export
   ═══════════════════════════════════════════════════════════════════ */

const CRM_TABS = [
  { id: 'setup',    icon: 'fa-sliders',             label: 'Lead Setup' },
  { id: 'active',   icon: 'fa-users-between-lines', label: 'Active Leads' },
  { id: 'inactive', icon: 'fa-box-archive',         label: 'Inactive Leads' },
  { id: 'reports',  icon: 'fa-chart-column',        label: 'Reports' },
];

export default function AdmissionCrm({ toast }) {
  const [tab, setTab] = useState('active');
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const activeMeta = CRM_TABS.find(t => t.id === tab);

  return (
    <>
      <style>{CRM_CSS}</style>

      {/* Page header — module title, brand-gradient icon, Tutorial CTA */}
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#2563EB)' }}>
            <i className="fa-solid fa-handshake"></i>
          </div>
          <div>
            <div className="page-title">Admission CRM</div>
            <div className="page-sub">Manage walk-in inquiries, follow-ups, admission leads &amp; confirmed admissions from one place.</div>
          </div>
        </div>
        <Tooltip text="Play a short tutorial for the Admission CRM module">
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
        {CRM_TABS.map(t => (
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

      {tab === 'active' ? (
        <ActiveLeads toast={toast} />
      ) : tab === 'setup' ? (
        <LeadSetup toast={toast} />
      ) : tab === 'inactive' ? (
        <InactiveLeads toast={toast} />
      ) : tab === 'reports' ? (
        <CrmReports toast={toast} />
      ) : (
        <CrmComingSoon
          label={activeMeta?.label || 'This screen'}
          icon={activeMeta?.icon || 'fa-hammer'}
        />
      )}

      <TutorialModal
        open={tutorialOpen}
        moduleKey="admissionCrm"
        onClose={() => setTutorialOpen(false)}
        toast={toast}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ACTIVE LEADS — the main inbox screen.

   Top section: total-leads KPI + 3 follow-up alert cards (Overdue /
   Today / Tomorrow). Filter bar with search + status + source +
   officer. Leads table with inline editable status & officer, expand-
   able detail row showing parent info + notes timeline + action row.
   ═══════════════════════════════════════════════════════════════════ */
function ActiveLeads({ toast }) {
  const { data: serverLeads = [] }   = useAsync(crmService.getCrmLeads, []);
  const { data: officers = [] }      = useAsync(crmService.getCrmOfficers, []);
  const { data: sources = [] }       = useAsync(crmService.getCrmSources, []);
  const { data: statuses = [] }      = useAsync(crmService.getCrmStatuses, []);
  const { data: reasons = [] }       = useAsync(crmService.getCrmReasons, []);
  const { data: school = {} }        = useAsync(crmService.getCrmSchool, {});
  const { data: currentUser = '' }   = useAsync(crmService.getCrmCurrentUser, '');
  const { data: serverNextId = 31 }  = useAsync(crmService.getCrmNextLeadId, 31);

  /* Local mutable mirror */
  const [leads, setLeads] = useState(null);
  useEffect(() => { if (serverLeads.length && leads == null) setLeads(serverLeads); }, [serverLeads, leads]);
  const list = useMemo(() => leads || [], [leads]);

  const [nextId, setNextId] = useState(null);
  useEffect(() => { if (nextId == null && serverNextId) setNextId(serverNextId); }, [serverNextId, nextId]);

  /* Filter state */
  const [search, setSearch]         = useState('');
  const [statusFlt, setStatusFlt]   = useState('');
  const [sourceFlt, setSourceFlt]   = useState('');
  const [officerFlt, setOfficerFlt] = useState('');
  const [alertFlt, setAlertFlt]     = useState(null); // 'overdue'|'today'|'tmrw'|null
  const [openId, setOpenId]         = useState(null);
  /* Report style — applies to the per-lead PDF download. Local so it
     doesn't interact with other pages. */
  const [leadStyle, setLeadStyle]   = useState('color'); // 'color' | 'bw'

  /* Search typeahead dropdown */
  const [searchOpen, setSearchOpen] = useState(false);
  const searchWrapRef = useRef(null);
  useEffect(() => {
    if (!searchOpen) return undefined;
    const onClick = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [searchOpen]);
  const searchMatches = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase().trim();
    return list
      .filter(l => `${l.name} ${l.phone} ${l.classes} ${l.officer}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [list, search]);
  const focusLead = (id) => {
    setSearch('');
    setSearchOpen(false);
    setOpenId(id);
    setTimeout(() => {
      const el = document.querySelector(`[data-lead-id="${id}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };

  /* Modal state */
  const [editLead, setEditLead]         = useState(null); // {mode:'add'|'edit', lead?}
  const [followupLead, setFollowupLead] = useState(null);
  const [confirmLead, setConfirmLead]   = useState(null);
  const [rejectLead, setRejectLead]     = useState(null);
  const [shareLead, setShareLead]       = useState(null);
  const [formLead, setFormLead]         = useState(null);
  const [exportOpen, setExportOpen]     = useState(false);

  /* Inline dropdown state — only one open at a time */
  const [ddOpen, setDdOpen] = useState(null); // {kind:'status'|'officer'|'menu', id}
  const ddRef = useRef(null);
  useEffect(() => {
    if (!ddOpen) return;
    const onClick = (e) => {
      if (ddRef.current && !ddRef.current.contains(e.target)) setDdOpen(null);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [ddOpen]);

  /* KPI counters — over the FULL list (filters don't change them) */
  const counts = useMemo(() => {
    const out = {
      total:     list.length,
      overdue:   list.filter(l => l.followup === 'overdue').length,
      today:     list.filter(l => l.followup === 'today').length,
      tmrw:      list.filter(l => l.followup === 'tmrw').length,
      confirmed: list.filter(l => l.status === 'Admission Confirmed').length,
      byStatus:  {},
    };
    list.forEach(l => { out.byStatus[l.status] = (out.byStatus[l.status] || 0) + 1; });
    return out;
  }, [list]);

  const conversionPct = useMemo(() => {
    return counts.total === 0 ? 0 : Math.round((counts.confirmed / counts.total) * 1000) / 10;
  }, [counts.total, counts.confirmed]);

  /* Apply filters */
  const filtered = useMemo(() => {
    return list.filter(l => {
      if (alertFlt && l.followup !== alertFlt) return false;
      if (statusFlt && l.status !== statusFlt) return false;
      if (sourceFlt && l.source !== sourceFlt) return false;
      if (officerFlt && l.officer !== officerFlt) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        if (!`${l.name} ${l.phone} ${l.classes}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [list, alertFlt, statusFlt, sourceFlt, officerFlt, search]);

  /* Mutations */
  const setStatus = (id, label) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status: label } : l));
    setDdOpen(null);
    toast(`Status updated to "${label}"`, 'success');
  };
  const setOfficer = (id, officer) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, officer } : l));
    setDdOpen(null);
    toast(`Assigned to ${officer}`, 'success');
  };

  const clearAllFilters = () => {
    setSearch(''); setStatusFlt(''); setSourceFlt(''); setOfficerFlt(''); setAlertFlt(null);
  };

  /* Save lead (add or edit) */
  const handleSaveLead = (payload) => {
    if (!payload.name.trim()) { toast('Father / Parent name is required', 'error'); return; }
    if (!payload.phone.trim()) { toast('Phone is required', 'error'); return; }
    if (editLead?.mode === 'edit') {
      setLeads(prev => prev.map(l => l.id === editLead.lead.id ? { ...l, ...payload } : l));
      toast('Lead updated', 'success');
    } else {
      const id = `L${String(nextId || 31).padStart(3, '0')}`;
      setNextId((nextId || 31) + 1);
      const initials = payload.name.split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join('').toUpperCase() || 'NL';
      setLeads(prev => [{
        id, initials, color: '#1E40AF',
        followup: 'normal',
        lastFu: todayCrmISO(),
        assignedDate: todayCrmISO(),
        notes: payload.initialNote ? [{
          date: todayCrmISO(),
          time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true }),
          staff: currentUser || 'Front Desk',
          text: payload.initialNote,
          nextFu: payload.nextFu,
          status: payload.status,
        }] : [],
        ...payload,
      }, ...(prev || [])]);
      toast(`Lead ${id} created`, 'success');
    }
    setEditLead(null);
  };

  /* Save follow-up note */
  const handleSaveFollowup = ({ id, text, status, nextFu, staff, reminder }) => {
    if (!text.trim()) { toast('Please enter a discussion note', 'error'); return; }
    if (!nextFu) { toast('Please pick a next follow-up date', 'error'); return; }
    const today = todayCrmISO();
    const fuFlag = nextFu < today ? 'overdue' : nextFu === today ? 'today' : nextFu === addDaysCrm(today, 1) ? 'tmrw' : 'normal';
    setLeads(prev => prev.map(l => l.id === id
      ? {
        ...l,
        status,
        lastFu: today,
        nextFu,
        followup: fuFlag,
        reminder: !!reminder,
        notes: [
          {
            date: today,
            time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true }),
            staff,
            text: text.trim(),
            nextFu, status,
          },
          ...(l.notes || []),
        ],
      }
      : l));
    toast('Follow-up logged', 'success');
    setFollowupLead(null);
  };

  /* Confirm admission */
  const handleConfirmAdmission = (lead) => {
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'Admission Confirmed' } : l));
    toast(`${lead.name} marked as Admission Confirmed`, 'success');
    setConfirmLead(null);
  };

  /* Mark not interested */
  const handleMarkNotInterested = ({ lead, reason, note }) => {
    if (!reason) { toast('Please pick a reason', 'error'); return; }
    const today = todayCrmISO();
    setLeads(prev => prev.map(l => l.id === lead.id
      ? {
        ...l,
        status: 'Not Interested',
        followup: 'normal',
        notes: [{
          date: today,
          time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true }),
          staff: currentUser || 'Front Desk',
          text: `Marked Not Interested — Reason: ${reason}${note ? `. ${note}` : ''}`,
          nextFu: today, status: 'Not Interested',
        }, ...(l.notes || [])],
      }
      : l));
    toast(`${lead.name} marked Not Interested`, 'info');
    setRejectLead(null);
  };

  /* Download per-lead PDF report — honours the page-level Style toggle. */
  const downloadLeadReport = (lead) => {
    openCrmReportWindow(
      `Lead Report — ${lead.name}`,
      buildLeadReportHTML(lead, school),
      toast,
      '#1E3A8A',
      leadStyle === 'bw',
    );
  };

  return (
    <>
      {/* Top stats — Total Active + Confirmed Admissions */}
      <div className="crm-top-stats">
        <button
          type="button"
          className={`crm-stat-card crm-stat-total${!alertFlt && !statusFlt ? ' active' : ''}`}
          onClick={() => { setAlertFlt(null); setStatusFlt(''); }}
        >
          <div className="crm-stat-ic" style={{ background: 'rgba(30,58,138,.10)', color: '#1E40AF' }}>
            <i className="fa-solid fa-users"></i>
          </div>
          <div className="crm-stat-body">
            <div className="crm-stat-val">{counts.total}</div>
            <div className="crm-stat-lbl">Total Active Leads</div>
            <div className="crm-stat-delta">
              <i className="fa-solid fa-arrow-trend-up"></i> Click to show all
            </div>
          </div>
        </button>

        <button
          type="button"
          className={`crm-stat-card crm-stat-confirmed${statusFlt === 'Admission Confirmed' ? ' active' : ''}`}
          onClick={() => setStatusFlt(statusFlt === 'Admission Confirmed' ? '' : 'Admission Confirmed')}
        >
          <div className="crm-stat-ic" style={{ background: 'rgba(22,163,74,.12)', color: '#16A34A' }}>
            <i className="fa-solid fa-user-check"></i>
          </div>
          <div className="crm-stat-body">
            <div className="crm-stat-val" style={{ color: '#15803D' }}>{counts.confirmed}</div>
            <div className="crm-stat-lbl">Confirmed Admissions</div>
            <div className="crm-stat-delta" style={{ color: '#15803D' }}>
              <i className="fa-solid fa-arrow-trend-up"></i> {conversionPct}% conversion rate
            </div>
          </div>
        </button>
      </div>

      {/* Status filter cards — one per active status, click to filter */}
      <div className="crm-status-strip">
        {STATUS_FILTER_CARDS.map(s => {
          const cfg = STATUS_CARD_CFG[s] || { color: '#1E40AF', icon: 'fa-tag' };
          const isActive = statusFlt === s;
          const count = counts.byStatus[s] || 0;
          return (
            <button
              key={s}
              type="button"
              className={`crm-status-card${isActive ? ' active' : ''}${statusFlt && !isActive ? ' dim' : ''}`}
              style={{ '--sc': cfg.color }}
              onClick={() => setStatusFlt(isActive ? '' : s)}
            >
              <div className="crm-status-card-top">
                <div className="crm-status-card-ic"><i className={`fa-solid ${cfg.icon}`}></i></div>
                <div className="crm-status-card-val">{count}</div>
              </div>
              <div className="crm-status-card-lbl">{s}</div>
              <div className="crm-status-card-helper">
                {isActive ? <><i className="fa-solid fa-check"></i> Filtering</> : 'Click to filter'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Follow-up alert cards — Overdue / Today / Tomorrow */}
      <div className="crm-fu-grid">
        {['overdue', 'today', 'tmrw'].map(k => (
          <button
            key={k}
            type="button"
            className={`crm-fu-card crm-fu-card--${k}${alertFlt === k ? ' active' : ''}${alertFlt && alertFlt !== k ? ' dim' : ''}`}
            onClick={() => setAlertFlt(alertFlt === k ? null : k)}
            style={{ '--fu-c': FU_COLOR[k] }}
          >
            <div className="crm-fu-ic"><i className={`fa-solid ${FU_ICON[k]}`}></i></div>
            <div className="crm-fu-body">
              <div className="crm-fu-val">{counts[k]}</div>
              <div className="crm-fu-lbl">{FU_LABEL[k]} Follow-ups</div>
              <div className="crm-fu-helper">
                {counts[k]} follow-up{counts[k] === 1 ? '' : 's'} {k === 'overdue' ? 'past their due date' : k === 'today' ? 'scheduled for today' : 'due tomorrow'}.
              </div>
            </div>
            {alertFlt === k && <div className="crm-fu-check"><i className="fa-solid fa-check"></i></div>}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="fee-section fee-section--filters">
        <div className="fee-section-body">
          <div className="crm-toolbar">
            <div className="fee-field fee-field--grow" style={{ position: 'relative' }} ref={searchWrapRef}>
              <span className="fee-label">Search</span>
              <div className="fee-search-box">
                <i className="fa-solid fa-magnifying-glass"></i>
                <input
                  placeholder="Search by parent name, phone, class or officer…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
                  onFocus={() => setSearchOpen(true)}
                  autoComplete="off"
                />
                {search && (
                  <Tooltip text="Clear search">
                    <button type="button" className="fee-search-clear" onClick={() => { setSearch(''); setSearchOpen(false); }}>
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </Tooltip>
                )}
              </div>
              <div className={`fee-search-results${searchOpen && search.trim() ? ' open' : ''}`}>
                {searchMatches.length === 0 ? (
                  <div className="fee-sr-empty">No leads found for "<b>{search}</b>"</div>
                ) : searchMatches.map(l => (
                  <button type="button" key={l.id} className="fee-sr-item" onClick={() => focusLead(l.id)}>
                    <div className="fee-sr-av" style={{ background: avatarBg(l.color), color: l.color }}>{l.initials}</div>
                    <div className="fee-sr-main">
                      <div className="fee-sr-name">{l.name}</div>
                      <div className="fee-sr-meta">
                        <span><b>Phone:</b> {l.phone}</span>
                        <span><b>Classes:</b> {l.classes}</span>
                        <span><b>Officer:</b> {l.officer}</span>
                      </div>
                    </div>
                    <div className="fee-sr-go"><i className="fa-solid fa-arrow-right"></i></div>
                  </button>
                ))}
              </div>
            </div>
            <div className="fee-field">
              <span className="fee-label">Status</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={statusFlt} onChange={(e) => setStatusFlt(e.target.value)}>
                  <option value="">All Statuses</option>
                  {statuses.map(s => <option key={s.label}>{s.label}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
            <div className="fee-field">
              <span className="fee-label">Source</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={sourceFlt} onChange={(e) => setSourceFlt(e.target.value)}>
                  <option value="">All Sources</option>
                  {sources.map(s => <option key={s.name}>{s.name}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
            <div className="fee-field">
              <span className="fee-label">Officer</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={officerFlt} onChange={(e) => setOfficerFlt(e.target.value)}>
                  <option value="">All Officers</option>
                  {officers.map(o => <option key={o.name}>{o.name}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
            <div
              className="rep-style-row"
              role="radiogroup"
              aria-label="Lead Report Style"
              style={{ marginLeft: 0 }}
            >
              <span className="rep-style-lbl">Report Style</span>
              <div className="rep-style-seg">
                <button
                  type="button"
                  className={`rep-style-btn${leadStyle === 'color' ? ' on' : ''}`}
                  onClick={() => setLeadStyle('color')}
                  role="radio"
                  aria-checked={leadStyle === 'color'}
                  tabIndex={leadStyle === 'color' ? 0 : -1}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')   { e.preventDefault(); setLeadStyle('color'); }
                    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setLeadStyle('bw'); }
                  }}
                >
                  <i className="fa-solid fa-palette" aria-hidden="true"></i> Colorful
                </button>
                <button
                  type="button"
                  className={`rep-style-btn${leadStyle === 'bw' ? ' on' : ''}`}
                  onClick={() => setLeadStyle('bw')}
                  role="radio"
                  aria-checked={leadStyle === 'bw'}
                  tabIndex={leadStyle === 'bw' ? 0 : -1}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')   { e.preventDefault(); setLeadStyle('color'); }
                    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setLeadStyle('bw'); }
                  }}
                >
                  <i className="fa-solid fa-circle-half-stroke" aria-hidden="true"></i> Colorless
                </button>
              </div>
            </div>
            <Tooltip text="Add a new lead">
              <button className="fee-btn fee-btn-primary" onClick={() => setEditLead({ mode: 'add' })}>
                <i className="fa-solid fa-plus"></i> New Lead
              </button>
            </Tooltip>
            <Tooltip text="Export the visible Active Leads as PDF / Excel / CSV">
              <button className="fee-btn fee-btn-ghost crm-export-btn" onClick={() => setExportOpen(true)}>
                <i className="fa-solid fa-file-export"></i> Export
              </button>
            </Tooltip>
          </div>

          {(alertFlt || statusFlt || sourceFlt || officerFlt || search) && (
            <div className="crm-active-filters">
              <i className="fa-solid fa-filter"></i>
              <span><strong>{filtered.length}</strong> of <strong>{list.length}</strong> leads</span>
              {alertFlt && <span className="crm-active-chip" style={{ borderColor: FU_COLOR[alertFlt], color: FU_COLOR[alertFlt] }}>{FU_LABEL[alertFlt]} follow-ups <button onClick={() => setAlertFlt(null)}>×</button></span>}
              {statusFlt && <span className="crm-active-chip">{statusFlt} <button onClick={() => setStatusFlt('')}>×</button></span>}
              {sourceFlt && <span className="crm-active-chip">{sourceFlt} <button onClick={() => setSourceFlt('')}>×</button></span>}
              {officerFlt && <span className="crm-active-chip">{officerFlt} <button onClick={() => setOfficerFlt('')}>×</button></span>}
              <button className="crm-clear-all" onClick={clearAllFilters}>Clear all filters</button>
            </div>
          )}
        </div>
      </div>

      {/* Leads table */}
      <div className="fee-section">
        <div className="crm-table-head">
          <div className="th">Parent / Contact</div>
          <div className="th">Phone</div>
          <div className="th c">Students</div>
          <div className="th">Assigned Officer</div>
          <div className="th">Status</div>
          <div className="th">Source</div>
          <div className="th c">Actions</div>
        </div>

        {filtered.length === 0 ? (
          <div className="crm-empty">
            <div className="crm-empty-ic"><i className="fa-solid fa-magnifying-glass"></i></div>
            <div className="crm-empty-title">No leads found</div>
            <div className="crm-empty-sub">Try adjusting your filters or clearing the search box.</div>
            {(alertFlt || statusFlt || sourceFlt || officerFlt || search) && (
              <button className="fee-btn fee-btn-ghost fee-btn-sm" onClick={clearAllFilters}>
                <i className="fa-solid fa-rotate"></i> Clear filters
              </button>
            )}
          </div>
        ) : filtered.map(l => (
          <LeadRow
            key={l.id}
            lead={l}
            isOpen={openId === l.id}
            onToggle={() => setOpenId(openId === l.id ? null : l.id)}
            sources={sources}
            officers={officers}
            statuses={statuses}
            ddOpen={ddOpen}
            ddRef={ddRef}
            setDdOpen={setDdOpen}
            setStatus={setStatus}
            setOfficer={setOfficer}
            onDownload={() => downloadLeadReport(l)}
            onEdit={() => setEditLead({ mode: 'edit', lead: l })}
            onFollowup={() => setFollowupLead(l)}
            onShareFee={() => setShareLead(l)}
            onGenerateForm={() => setFormLead(l)}
            onConfirmAdm={() => setConfirmLead(l)}
            onMarkNotInt={() => setRejectLead(l)}
          />
        ))}
      </div>

      {editLead && (
        <LeadEditModal
          cfg={editLead}
          officers={officers}
          sources={sources}
          statuses={statuses}
          currentUser={currentUser}
          onClose={() => setEditLead(null)}
          onSave={handleSaveLead}
        />
      )}
      {followupLead && (
        <FollowupModal
          lead={followupLead}
          officers={officers}
          statuses={statuses}
          currentUser={currentUser}
          onClose={() => setFollowupLead(null)}
          onSave={(data) => handleSaveFollowup({ id: followupLead.id, ...data })}
        />
      )}
      <CrmConfirmDialog
        cfg={confirmLead && {
          style: 'success',
          icon: 'fa-circle-check',
          title: 'Confirm Admission?',
          message: <span>"<strong>{confirmLead.name}</strong>" will be marked as <strong>Admission Confirmed</strong> and moved to the <strong>Converted Admissions</strong> list.</span>,
          detail: [
            { icon: 'fa-user-graduate', text: 'Student profile will be created on the next sync' },
            { icon: 'fa-timeline',      text: 'All previous notes & history preserved' },
            { icon: 'fa-share-from-square', text: 'Parent notified via the chosen channel' },
          ],
          confirmLabel: 'Yes, Confirm Admission',
          onConfirm: () => handleConfirmAdmission(confirmLead),
        }}
        onClose={() => setConfirmLead(null)}
      />
      {rejectLead && (
        <NotInterestedModal
          lead={rejectLead}
          reasons={reasons}
          onClose={() => setRejectLead(null)}
          onSave={(data) => handleMarkNotInterested({ lead: rejectLead, ...data })}
        />
      )}
      {shareLead && (
        <ShareFeeModal
          lead={shareLead}
          school={school}
          onClose={() => setShareLead(null)}
          toast={toast}
        />
      )}
      {formLead && (
        <GenerateFormModal
          lead={formLead}
          school={school}
          onClose={() => setFormLead(null)}
          toast={toast}
        />
      )}
      {exportOpen && (
        <ExportLeadsModal
          leads={filtered}
          school={school}
          onClose={() => setExportOpen(false)}
          toast={toast}
        />
      )}
    </>
  );
}

/* ─── Lead Row + inline dropdowns + detail panel ─── */
function LeadRow({
  lead, isOpen, onToggle, sources, officers, statuses,
  ddOpen, ddRef, setDdOpen, setStatus, setOfficer,
  onDownload, onEdit, onFollowup, onShareFee, onGenerateForm, onConfirmAdm, onMarkNotInt,
}) {
  const l = lead;
  const cls = STATUS_TO_CLS[l.status] || 'status-interested';
  const fuClr = l.followup === 'overdue' ? '#DC2626' : l.followup === 'today' ? '#D97706' : l.followup === 'tmrw' ? '#0284C7' : 'var(--text-muted)';
  const fuTagText = l.followup === 'overdue' ? 'OVERDUE' : l.followup === 'today' ? 'TODAY' : l.followup === 'tmrw' ? 'TMRW' : null;
  const fuTagClr  = l.followup === 'overdue' ? '#DC2626' : l.followup === 'today' ? '#D97706' : '#0284C7';
  const sourceMeta = sources.find(s => s.name === l.source);

  const sortedNotes = useMemo(
    () => [...(l.notes || [])].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [l.notes],
  );

  return (
    <div className={`crm-row-wrap${isOpen ? ' open' : ''}`} data-lead-id={l.id}>
      <div className="crm-row" onClick={onToggle}>
        {/* Parent name + avatar + follow-up date */}
        <div className="td">
          <div className="crm-avatar" style={{ background: avatarBg(l.color), color: l.color }}>{l.initials}</div>
          <div className="crm-name-cell">
            <div className="crm-name-top">
              <div className="crm-name">{l.name}</div>
              {fuTagText && (
                <span className="crm-fu-tag" style={{ background: `${fuTagClr}1A`, color: fuTagClr, borderColor: `${fuTagClr}40` }}>
                  {fuTagText}
                </span>
              )}
            </div>
            <div className="crm-next-fu" style={{ color: fuClr, fontWeight: l.followup === 'normal' ? 500 : 700 }}>
              {(l.followup === 'overdue' || l.followup === 'today') && <i className={`fa-solid ${FU_ICON[l.followup]}`}></i>}
              {' '}{fmtDayMonth(l.nextFu)}
            </div>
          </div>
        </div>

        <div className="td crm-phone">{l.phone}</div>

        <div className="td c crm-stu-count">{l.students}</div>

        {/* Officer dropdown */}
        <div className="td" onClick={(e) => e.stopPropagation()} ref={ddOpen?.kind === 'officer' && ddOpen.id === l.id ? ddRef : null}>
          <div className="crm-inline-pick">
            <span className="crm-officer-name">{l.officer}</span>
            <button
              type="button"
              className="crm-chevbtn"
              onClick={() => setDdOpen(ddOpen?.kind === 'officer' && ddOpen.id === l.id ? null : { kind: 'officer', id: l.id })}
            >
              <i className="fa-solid fa-chevron-down"></i>
            </button>
            {ddOpen?.kind === 'officer' && ddOpen.id === l.id && (
              <div className="crm-dd-menu">
                {officers.map(o => (
                  <button
                    key={o.name}
                    type="button"
                    className={`crm-dd-item${o.name === l.officer ? ' selected' : ''}`}
                    onClick={() => setOfficer(l.id, o.name)}
                  >
                    <span className="crm-dd-avatar" style={{ background: avatarBg(o.color), color: o.color }}>{o.initials}</span>
                    {o.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Status dropdown */}
        <div className="td" onClick={(e) => e.stopPropagation()} ref={ddOpen?.kind === 'status' && ddOpen.id === l.id ? ddRef : null}>
          <div className="crm-inline-pick">
            <span className={`crm-status ${cls}`}><i className="fa-solid fa-circle" style={{ fontSize: 5 }}></i> {l.status}</span>
            <button
              type="button"
              className="crm-chevbtn"
              onClick={() => setDdOpen(ddOpen?.kind === 'status' && ddOpen.id === l.id ? null : { kind: 'status', id: l.id })}
            >
              <i className="fa-solid fa-chevron-down"></i>
            </button>
            {ddOpen?.kind === 'status' && ddOpen.id === l.id && (
              <div className="crm-dd-menu">
                {statuses.map(s => (
                  <button
                    key={s.label}
                    type="button"
                    className={`crm-dd-item${s.label === l.status ? ' selected' : ''}`}
                    onClick={() => setStatus(l.id, s.label)}
                  >
                    <span className="crm-dd-dot" style={{ background: STATUS_DOT_COLOR[s.cls] }}></span>
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Source */}
        <div className="td">
          {sourceMeta ? (
            <span className="crm-source" style={{ background: `${sourceMeta.color}14`, color: sourceMeta.color, borderColor: `${sourceMeta.color}33` }}>
              <i className={`fa-brands ${sourceMeta.icon}`}></i> {l.source}
            </span>
          ) : <span className="crm-source-plain">{l.source}</span>}
        </div>

        {/* Actions */}
        <div className="td c crm-actions" onClick={(e) => e.stopPropagation()} ref={ddOpen?.kind === 'menu' && ddOpen.id === l.id ? ddRef : null}>
          <Tooltip text="Download lead report (A4 PDF)">
            <button className="crm-iconbtn" onClick={onDownload} aria-label="Download lead report (A4 PDF)">
              <i className="fa-solid fa-download"></i>
            </button>
          </Tooltip>
          <div className="crm-3dots-wrap">
            <Tooltip text="More actions">
              <button
                className="crm-iconbtn"
                onClick={() => setDdOpen(ddOpen?.kind === 'menu' && ddOpen.id === l.id ? null : { kind: 'menu', id: l.id })}
              >
                <i className="fa-solid fa-ellipsis-vertical"></i>
              </button>
            </Tooltip>
            {ddOpen?.kind === 'menu' && ddOpen.id === l.id && (
              <div className="crm-dd-menu crm-dd-menu--actions">
                <button type="button" className="crm-dd-item" onClick={() => { setDdOpen(null); onFollowup(); }}>
                  <i className="fa-solid fa-phone-flip" style={{ color: '#0284C7' }}></i> Add Follow-up
                </button>
                <button type="button" className="crm-dd-item" onClick={() => { setDdOpen(null); onShareFee(); }}>
                  <i className="fa-solid fa-share-from-square" style={{ color: '#7C3AED' }}></i> Share Fee Details
                </button>
                <button type="button" className="crm-dd-item" onClick={() => { setDdOpen(null); onGenerateForm(); }}>
                  <i className="fa-solid fa-file-pdf" style={{ color: '#D97706' }}></i> Admission Form
                </button>
                <button type="button" className="crm-dd-item" onClick={() => { setDdOpen(null); onEdit(); }}>
                  <i className="fa-solid fa-pen" style={{ color: '#64748B' }}></i> Edit Lead
                </button>
              </div>
            )}
          </div>
          <Tooltip text={isOpen ? 'Collapse lead details' : 'Expand lead details'}>
            <button
              className="crm-iconbtn crm-expand-btn"
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              aria-label={isOpen ? 'Collapse lead details' : 'Expand lead details'}
            >
              <i className={`fa-solid fa-chevron-down${isOpen ? ' rot' : ''}`}></i>
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Detail panel */}
      <div className={`crm-detail${isOpen ? ' open' : ''}`}>
        <div className="crm-detail-inner">
          {/* Parent info */}
          <div className="crm-detail-block">
            <div className="crm-detail-block-head">
              <div className="crm-detail-block-title"><i className="fa-solid fa-user-tie"></i> Parent Information</div>
              <button className="crm-act-btn crm-act-edit" onClick={onEdit}>
                <i className="fa-solid fa-pen"></i> Edit
              </button>
            </div>
            <div className="crm-detail-grid">
              <div className="crm-detail-field"><div className="crm-detail-lbl">Name</div><div className="crm-detail-val">{l.name}</div></div>
              <div className="crm-detail-field"><div className="crm-detail-lbl">Phone</div><div className="crm-detail-val">{l.phone}</div></div>
              <div className="crm-detail-field"><div className="crm-detail-lbl">Classes Interested</div><div className="crm-detail-val">{l.classes}</div></div>
              <div className="crm-detail-field"><div className="crm-detail-lbl">Source</div><div className="crm-detail-val">{l.source}</div></div>
              <div className="crm-detail-field"><div className="crm-detail-lbl">Last Follow-up</div><div className="crm-detail-val">{fmtFullDate(l.lastFu)}</div></div>
              <div className="crm-detail-field"><div className="crm-detail-lbl">Next Follow-up</div><div className="crm-detail-val" style={{ color: fuClr, fontWeight: 700 }}>{fmtFullDate(l.nextFu)}</div></div>
              <div className="crm-detail-field"><div className="crm-detail-lbl">Assigned Officer</div><div className="crm-detail-val">{l.officer}</div></div>
              <div className="crm-detail-field">
                <div className="crm-detail-lbl">Lead Assigned Date</div>
                <div className="crm-detail-val">
                  <i className="fa-solid fa-calendar-plus" style={{ color: 'var(--brand-primary)', fontSize: 11, marginRight: 6 }}></i>
                  {fmtFullDate(l.assignedDate)}
                  <Tooltip text="Fixed date — cannot be edited">
                    <span className="crm-locked-chip"><i className="fa-solid fa-lock"></i></span>
                  </Tooltip>
                </div>
              </div>
              {l.address && (
                <div className="crm-detail-field crm-detail-field--full">
                  <div className="crm-detail-lbl">Address</div>
                  <div className="crm-detail-val">{l.address}</div>
                </div>
              )}
            </div>
          </div>

          {/* Notes timeline */}
          <div className="crm-detail-block">
            <div className="crm-detail-block-head">
              <div className="crm-detail-block-title"><i className="fa-solid fa-timeline"></i> Discussion Notes</div>
              <button className="crm-act-btn crm-act-followup" onClick={onFollowup}>
                <i className="fa-solid fa-plus"></i> Add Follow-up
              </button>
            </div>
            <div className="crm-notes">
              {sortedNotes.length === 0 ? (
                <div className="crm-notes-empty">No discussion notes yet.</div>
              ) : sortedNotes.map((n, i) => (
                <div key={i} className="crm-note">
                  <div className="crm-note-dot"><i className="fa-solid fa-phone-flip"></i></div>
                  <div className="crm-note-body">
                    <div className="crm-note-meta">
                      {fmtFullDate(n.date)} · {n.time} · <span className="crm-note-staff">{n.staff}</span>
                    </div>
                    <div className="crm-note-text">{n.text}</div>
                    <div className="crm-note-chip">
                      <i className="fa-solid fa-calendar-check"></i> Follow-up: {fmtFullDate(n.nextFu)} · {n.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action row */}
          <div className="crm-actions-row">
            <button className="crm-act-btn crm-act-followup" onClick={onFollowup}>
              <i className="fa-solid fa-phone-flip"></i> Add Follow-up
            </button>
            <button className="crm-act-btn crm-act-share" onClick={onShareFee}>
              <i className="fa-solid fa-share-from-square"></i> Share Fee Details
            </button>
            <button className="crm-act-btn crm-act-form" onClick={onGenerateForm}>
              <i className="fa-solid fa-file-pdf"></i> Generate Form
            </button>
            <button className="crm-act-btn crm-act-confirm" onClick={onConfirmAdm}>
              <i className="fa-solid fa-check-circle"></i> Confirm Admission
            </button>
            <button className="crm-act-btn crm-act-notinterest" onClick={onMarkNotInt}>
              <i className="fa-solid fa-times-circle"></i> Not Interested
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MODALS — shared scaffold + all Active Leads modals
   ═══════════════════════════════════════════════════════════════════ */
function useModalChrome(onClose) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
}

/* ─── Hero-style animated-ring confirm dialog (matches Accounts/Inventory pattern) ─── */
function CrmConfirmDialog({ cfg, onClose }) {
  useEffect(() => {
    if (!cfg) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [cfg, onClose]);

  if (!cfg) return null;

  const style = cfg.style || 'danger';        // 'danger' | 'primary' | 'success'
  const PALETTE = {
    danger:  { icon: 'fa-trash',        bg: 'rgba(220,38,38,.10)',  fg: '#DC2626', ring: '#EF4444', glow: 'linear-gradient(90deg,#EF4444,#DC2626)', btn: 'linear-gradient(135deg,#EF4444,#DC2626)', shadow: 'rgba(220,38,38,.35)' },
    primary: { icon: 'fa-rotate-left',  bg: 'rgba(30,58,138,.10)',  fg: '#1E40AF', ring: '#2563EB', glow: 'linear-gradient(90deg,#1D4ED8,#1E3A8A)', btn: 'linear-gradient(135deg,#2563EB,#1D4ED8)', shadow: 'rgba(30,58,138,.35)' },
    success: { icon: 'fa-circle-check', bg: 'rgba(22,163,74,.10)',  fg: '#16A34A', ring: '#22C55E', glow: 'linear-gradient(90deg,#22C55E,#16A34A)', btn: 'linear-gradient(135deg,#22C55E,#16A34A)', shadow: 'rgba(22,163,74,.35)' },
  };
  const p = PALETTE[style] || PALETTE.danger;
  const icon = cfg.icon || p.icon;
  const confirmLabel = cfg.confirmLabel || (style === 'danger' ? 'Yes, Delete' : style === 'success' ? 'Yes, Confirm' : 'Yes, Continue');

  const handle = () => {
    if (typeof cfg.onConfirm === 'function') cfg.onConfirm();
  };

  return createPortal(
    <div className="crm-confirm-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="crm-confirm-dialog">
        <div className="crm-confirm-glow" style={{ background: p.glow }} />
        <div className={`crm-confirm-hero crm-confirm-hero--${style}`}>
          <div className="crm-confirm-ring" style={{ '--ring': p.ring }}>
            <div className="crm-confirm-icon-wrap" style={{ background: p.bg, color: p.fg, boxShadow: `0 8px 24px ${p.shadow.replace('.35', '.18')}` }}>
              <i className={`fa-solid ${icon}`}></i>
            </div>
          </div>
        </div>
        <div className="crm-confirm-body">
          <div className="crm-confirm-title">{cfg.title}</div>
          {typeof cfg.message === 'string'
            ? <div className="crm-confirm-msg" dangerouslySetInnerHTML={{ __html: cfg.message }} />
            : <div className="crm-confirm-msg">{cfg.message}</div>}
          {cfg.detail && (
            <div className={`crm-confirm-hint crm-confirm-hint--${style}`}>
              {cfg.detail.map((line, i) => (
                <div key={i} className="crm-confirm-hint-row">
                  <i className={`fa-solid ${line.icon || 'fa-circle-info'}`}></i>
                  <span>{line.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="crm-confirm-footer">
          <button className="crm-confirm-btn crm-confirm-btn--cancel" onClick={onClose}>Cancel</button>
          <button
            className="crm-confirm-btn crm-confirm-btn--confirm"
            style={{ background: p.btn, boxShadow: `0 4px 14px ${p.shadow}, inset 0 1px 0 rgba(255,255,255,.2)` }}
            onClick={handle}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CrmModalShell({ icon, gradient, title, sub, size, onClose, children, footer }) {
  return createPortal(
    <div className="fee-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`fee-modal${size ? ` ${size}` : ''}`}>
        <div className="fee-modal-head">
          <div className="fee-modal-head-title">
            <div className="fee-modal-head-icon" style={{ background: gradient || 'linear-gradient(135deg,#1E3A8A,#2563EB)' }}>
              <i className={`fa-solid ${icon}`}></i>
            </div>
            <div>
              <div className="fee-modal-title">{title}</div>
              {sub && <div className="fee-modal-sub">{sub}</div>}
            </div>
          </div>
          <Tooltip text="Close">
            <button className="fee-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
          </Tooltip>
        </div>
        <div className="fee-modal-body">{children}</div>
        <div className="fee-modal-foot">{footer}</div>
      </div>
    </div>,
    document.body,
  );
}

/* ─── Add / Edit Lead modal ─── */
function LeadEditModal({ cfg, officers, sources, statuses, currentUser, onClose, onSave }) {
  useModalChrome(onClose);
  const isEdit = cfg.mode === 'edit';
  const base   = isEdit ? cfg.lead : null;
  const [name, setName]         = useState(base?.name      || '');
  const [phone, setPhone]       = useState(base?.phone     || '');
  const [whatsapp, setWhatsapp] = useState(base?.whatsapp  || '');
  const [email, setEmail]       = useState(base?.email     || '');
  const [classes, setClasses]   = useState(base?.classes   || '');
  const [students, setStudents] = useState(String(base?.students || 1));
  const [source, setSource]     = useState(base?.source    || sources[0]?.name || 'Walk-in');
  const [status, setStatus]     = useState(base?.status    || 'Interested');
  const [officer, setOfficer]   = useState(base?.officer   || currentUser || officers[0]?.name || '');
  const [nextFu, setNextFu]     = useState(base?.nextFu    || addDaysCrm(todayCrmISO(), 2));
  const [address, setAddress]   = useState(base?.address   || '');
  const [reminder, setReminder] = useState(base?.reminder != null ? !!base.reminder : true);
  const [initialNote, setInitialNote] = useState('');

  const submit = () => onSave({
    name, phone, whatsapp, email, classes,
    students: Math.max(1, Number(students) || 1),
    source, status, officer, nextFu, address, reminder,
    initialNote: isEdit ? '' : initialNote,
  });

  return (
    <CrmModalShell
      icon="fa-user-plus"
      gradient="linear-gradient(135deg,#1E3A8A,#2563EB)"
      title={isEdit ? 'Edit Lead' : 'New Lead'}
      sub={isEdit ? `Lead ID: ${base.id}` : 'Capture a new parent inquiry'}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="fee-btn fee-btn-primary" onClick={submit}>
            <i className="fa-solid fa-floppy-disk"></i> {isEdit ? 'Update Lead' : 'Save Lead'}
          </button>
        </>
      }
    >
      <div className="crm-form-grid">
        <div className="fee-field full">
          <span className="fee-label">Father / Parent Name *</span>
          <input className="fee-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tariq Mehmood" />
        </div>
        <div className="fee-field">
          <span className="fee-label">Phone *</span>
          <input className="fee-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03xx-xxxxxxx" />
        </div>
        <div className="fee-field">
          <span className="fee-label">WhatsApp</span>
          <input className="fee-input" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="Same as phone if blank" />
        </div>
        <div className="fee-field full">
          <span className="fee-label">Email</span>
          <input className="fee-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="parent@example.com" />
        </div>
        <div className="fee-field full">
          <span className="fee-label">Classes Interested *</span>
          <input className="fee-input" value={classes} onChange={(e) => setClasses(e.target.value)} placeholder="e.g. Class 3, Class 5" />
          <div className="fee-hint"><i className="fa-solid fa-circle-info"></i> Use commas to separate multiple classes</div>
        </div>
        <div className="fee-field">
          <span className="fee-label">Number of Students *</span>
          <input className="fee-input" type="number" min="1" value={students} onChange={(e) => setStudents(e.target.value)} />
        </div>
        <div className="fee-field">
          <span className="fee-label">Source *</span>
          <div className="fee-select-wrap">
            <select className="fee-select" value={source} onChange={(e) => setSource(e.target.value)}>
              {sources.map(s => <option key={s.name}>{s.name}</option>)}
            </select>
            <i className="fa-solid fa-chevron-down"></i>
          </div>
        </div>
        <div className="fee-field">
          <span className="fee-label">Lead Status *</span>
          <div className="fee-select-wrap">
            <select className="fee-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              {statuses.map(s => <option key={s.label}>{s.label}</option>)}
            </select>
            <i className="fa-solid fa-chevron-down"></i>
          </div>
        </div>
        <div className="fee-field">
          <span className="fee-label">Assigned Officer</span>
          <div className="fee-select-wrap">
            <select className="fee-select" value={officer} onChange={(e) => setOfficer(e.target.value)}>
              {officers.map(o => <option key={o.name}>{o.name}</option>)}
            </select>
            <i className="fa-solid fa-chevron-down"></i>
          </div>
        </div>
        <div className="fee-field">
          <span className="fee-label">Next Follow-up Date</span>
          <input className="fee-input" type="date" value={nextFu} onChange={(e) => setNextFu(e.target.value)} />
        </div>
        <div className="fee-field full">
          <span className="fee-label">Address</span>
          <textarea className="fee-input" rows="2" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Home / locality" />
        </div>
        {!isEdit && (
          <div className="fee-field full">
            <span className="fee-label">Initial Discussion Note</span>
            <textarea className="fee-input" rows="3" value={initialNote} onChange={(e) => setInitialNote(e.target.value)} placeholder="How did the parent inquire? Anything notable?" />
          </div>
        )}
        <div className="fee-field full crm-switch-row">
          <label className="crm-switch">
            <input type="checkbox" checked={reminder} onChange={(e) => setReminder(e.target.checked)} />
            <span className="crm-switch-slider"></span>
          </label>
          <div>
            <div className="crm-switch-lbl">Set reminder for next follow-up</div>
            <div className="crm-switch-sub">A push reminder will fire on {fmtFullDate(nextFu)}.</div>
          </div>
        </div>
      </div>
    </CrmModalShell>
  );
}

/* ─── Follow-up modal ─── */
function FollowupModal({ lead, officers, statuses, currentUser, onClose, onSave }) {
  useModalChrome(onClose);
  const [text, setText]     = useState('');
  const [status, setStatus] = useState(lead.status);
  const [nextFu, setNextFu] = useState(addDaysCrm(todayCrmISO(), 2));
  const [staff, setStaff]   = useState(currentUser || officers[0]?.name || '');
  const [reminder, setReminder] = useState(true);

  const sorted = useMemo(() => [...(lead.notes || [])].sort((a, b) => a.date < b.date ? 1 : -1), [lead.notes]);

  return (
    <CrmModalShell
      icon="fa-phone-flip"
      gradient="linear-gradient(135deg,#0284C7,#0369A1)"
      title="Add Follow-up"
      sub={`${lead.name} · ${lead.phone}`}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="fee-btn fee-btn-primary"
            style={{ background: 'linear-gradient(135deg,#0284C7,#0369A1)', boxShadow: '0 4px 14px rgba(2,132,199,.28)' }}
            onClick={() => onSave({ text, status, nextFu, staff, reminder })}
          >
            <i className="fa-solid fa-floppy-disk"></i> Save Follow-up
          </button>
        </>
      }
    >
      <div className="crm-fu-modal">
        <div className="crm-fu-history">
          <div className="crm-detail-block-title" style={{ marginBottom: 10 }}>
            <i className="fa-solid fa-timeline"></i> Previous Notes ({sorted.length})
          </div>
          <div className="crm-notes" style={{ maxHeight: 320 }}>
            {sorted.length === 0 ? (
              <div className="crm-notes-empty">No previous notes.</div>
            ) : sorted.map((n, i) => (
              <div key={i} className="crm-note">
                <div className="crm-note-dot"><i className="fa-solid fa-phone-flip"></i></div>
                <div className="crm-note-body">
                  <div className="crm-note-meta">{fmtFullDate(n.date)} · {n.time} · <span className="crm-note-staff">{n.staff}</span></div>
                  <div className="crm-note-text">{n.text}</div>
                  <div className="crm-note-chip"><i className="fa-solid fa-calendar-check"></i> Follow-up: {fmtFullDate(n.nextFu)} · {n.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="crm-fu-form">
          <div className="crm-detail-block-title" style={{ marginBottom: 10 }}>
            <i className="fa-solid fa-pen-to-square"></i> New Follow-up
          </div>
          <div className="fee-field">
            <span className="fee-label">Discussion Note *</span>
            <textarea
              className="fee-input"
              rows="5"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What was discussed in this call / meeting?"
            />
          </div>
          <div className="crm-form-grid">
            <div className="fee-field">
              <span className="fee-label">Updated Status *</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {statuses.map(s => <option key={s.label}>{s.label}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
            <div className="fee-field">
              <span className="fee-label">Next Follow-up Date *</span>
              <input className="fee-input" type="date" value={nextFu} onChange={(e) => setNextFu(e.target.value)} />
            </div>
            <div className="fee-field full">
              <span className="fee-label">Logged By</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={staff} onChange={(e) => setStaff(e.target.value)}>
                  {officers.map(o => <option key={o.name}>{o.name}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
            <div className="fee-field full crm-switch-row">
              <label className="crm-switch">
                <input type="checkbox" checked={reminder} onChange={(e) => setReminder(e.target.checked)} />
                <span className="crm-switch-slider"></span>
              </label>
              <div>
                <div className="crm-switch-lbl">Remind me on the follow-up date</div>
                <div className="crm-switch-sub">Push reminder on {fmtFullDate(nextFu)}.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CrmModalShell>
  );
}

/* ConfirmAdmissionDialog was retired in favor of CrmConfirmDialog
   (hero-ring pattern shared with Accounts & Inventory). */

/* ─── Not Interested modal ─── */
function NotInterestedModal({ lead, reasons, onClose, onSave }) {
  useModalChrome(onClose);
  const [reason, setReason] = useState(reasons[0] || 'High Fee');
  const [note, setNote]     = useState('');
  return (
    <CrmModalShell
      icon="fa-circle-xmark"
      gradient="linear-gradient(135deg,#DC2626,#B91C1C)"
      title="Mark Not Interested"
      sub={`${lead.name} · ${lead.phone}`}
      size="md"
      onClose={onClose}
      footer={
        <>
          <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="fee-btn fee-btn-primary"
            style={{ background: 'linear-gradient(135deg,#DC2626,#B91C1C)', boxShadow: '0 4px 14px rgba(220,38,38,.28)' }}
            onClick={() => onSave({ reason, note })}
          >
            <i className="fa-solid fa-check"></i> Mark Not Interested
          </button>
        </>
      }
    >
      <div className="crm-form-grid">
        <div className="fee-field full">
          <span className="fee-label">Reason *</span>
          <div className="fee-select-wrap">
            <select className="fee-select" value={reason} onChange={(e) => setReason(e.target.value)}>
              {reasons.map(r => <option key={r}>{r}</option>)}
            </select>
            <i className="fa-solid fa-chevron-down"></i>
          </div>
        </div>
        <div className="fee-field full">
          <span className="fee-label">Additional Notes</span>
          <textarea className="fee-input" rows="4" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional context about why the parent backed out" />
        </div>
      </div>
    </CrmModalShell>
  );
}

/* ─── Share Fee Details modal — matches HTML reference exactly.
   4 selectable sections (Standard Fee / Uniform / Books / Admission)
   + 2 format cards (Colourful PDF / B&W). Confirm builds the PDF
   with only the selected sections via buildShareFeeHTML(). */
const SHARE_FEE_SECTIONS = [
  { id: 'feeStructure', icon: 'fa-money-bill-wave',     color: '#1E40AF', title: 'Standard Fee Structure', desc: 'Monthly tuition & standard charges — fetched directly from Fee Module' },
  { id: 'uniform',      icon: 'fa-shirt',               color: '#1E40AF', title: 'Uniform Charges',         desc: 'Summer, winter & sports uniform — fetched from Lead Setup' },
  { id: 'books',        icon: 'fa-book',                color: '#16A34A', title: 'Books & Stationery Charges', desc: 'Books and stationery — fetched from Lead Setup' },
  { id: 'admission',    icon: 'fa-indian-rupee-sign',   color: '#1E40AF', title: 'Admission Charges',       desc: 'One-time admission, registration & security fees — fetched from Lead Setup' },
];

function ShareFeeModal({ lead, school, onClose, toast }) {
  useModalChrome(onClose);
  const [sections, setSections] = useState({ feeStructure: true, uniform: true, books: true, admission: true });
  const [fmt, setFmt] = useState('color');

  const toggle = (id) => setSections(prev => ({ ...prev, [id]: !prev[id] }));
  const anySelected = Object.values(sections).some(Boolean);

  const generate = () => {
    if (!anySelected) { toast('Please select at least one section to include', 'error'); return; }
    openCrmReportWindow(
      `Fee Structure — ${lead.name}`,
      buildShareFeeHTML(lead, school, fmt, sections),
      toast,
      fmt === 'bw' ? '#1F2937' : '#7C3AED',
      fmt === 'bw',
    );
    toast('Fee report generated', 'success');
    onClose();
  };

  return (
    <CrmModalShell
      icon="fa-share-from-square"
      gradient="linear-gradient(135deg,#7C3AED,#6D28D9)"
      title="Share Fee Details"
      sub="Select sections to include in the fee report"
      size="md"
      onClose={onClose}
      footer={
        <>
          <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="fee-btn fee-btn-primary"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', boxShadow: '0 4px 14px rgba(124,58,237,.28)' }}
            onClick={generate}
          >
            <i className="fa-solid fa-download"></i> Generate &amp; Download Report
          </button>
        </>
      }
    >
      <div className="share-section-lbl">Include in Report</div>
      <div className="share-sections">
        {SHARE_FEE_SECTIONS.map(s => (
          <label key={s.id} className={`share-section${sections[s.id] ? ' on' : ''}`}>
            <input
              type="checkbox"
              checked={!!sections[s.id]}
              onChange={() => toggle(s.id)}
            />
            <div className="share-section-body">
              <div className="share-section-title">
                <i className={`fa-solid ${s.icon}`} style={{ color: s.color }}></i> {s.title}
              </div>
              <div className="share-section-desc">{s.desc}</div>
            </div>
            <div className="share-section-check"><i className="fa-solid fa-check"></i></div>
          </label>
        ))}
      </div>

      <div className="share-section-lbl" style={{ marginTop: 22 }} id="share-fee-style-lbl">Download Format</div>
      <div className="share-fmt-grid" role="radiogroup" aria-labelledby="share-fee-style-lbl">
        <button
          type="button"
          className={`share-fmt${fmt === 'color' ? ' on' : ''}`}
          onClick={() => setFmt('color')}
          role="radio"
          aria-checked={fmt === 'color'}
          tabIndex={fmt === 'color' ? 0 : -1}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')   { e.preventDefault(); setFmt('color'); }
            else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setFmt('bw'); }
          }}
        >
          <div className="share-fmt-ic" style={{ background: 'linear-gradient(135deg,#1E40AF,#2563EB)' }} aria-hidden="true">
            <i className="fa-solid fa-file-pdf"></i>
          </div>
          <div>
            <div className="share-fmt-name">Colorful Report</div>
            <div className="share-fmt-desc">School branding, summary cards &amp; status badges</div>
          </div>
        </button>
        <button
          type="button"
          className={`share-fmt${fmt === 'bw' ? ' on' : ''}`}
          onClick={() => setFmt('bw')}
          role="radio"
          aria-checked={fmt === 'bw'}
          tabIndex={fmt === 'bw' ? 0 : -1}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')   { e.preventDefault(); setFmt('color'); }
            else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setFmt('bw'); }
          }}
        >
          <div className="share-fmt-ic" style={{ background: 'linear-gradient(135deg,#475569,#64748B)' }} aria-hidden="true">
            <i className="fa-regular fa-file-pdf"></i>
          </div>
          <div>
            <div className="share-fmt-name">Colorless Report</div>
            <div className="share-fmt-desc">Low-ink layout — white bg, light borders only</div>
          </div>
        </button>
      </div>
    </CrmModalShell>
  );
}

/* ─── Generate Admission Form modal ─── */
function GenerateFormModal({ lead, school, onClose, toast }) {
  useModalChrome(onClose);
  const [fmt, setFmt] = useState('color');
  const printIt = () => {
    openCrmReportWindow(`Admission Form — ${lead.name}`, buildAdmissionFormHTML(lead, school, fmt), toast, fmt === 'bw' ? '#1E293B' : '#D97706', fmt === 'bw');
    onClose();
  };
  return (
    <CrmModalShell
      icon="fa-file-pdf"
      gradient="linear-gradient(135deg,#D97706,#B45309)"
      title="Generate Admission Form"
      sub={`Prefilled for ${lead.name}`}
      size="md"
      onClose={onClose}
      footer={
        <>
          <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="fee-btn fee-btn-primary"
            style={{ background: 'linear-gradient(135deg,#D97706,#B45309)', boxShadow: '0 4px 14px rgba(217,119,6,.28)' }}
            onClick={printIt}
          >
            <i className="fa-solid fa-download"></i> Download PDF
          </button>
        </>
      }
    >
      <div className="fee-label" id="gen-form-style-lbl">Format</div>
      <div className="crm-fmt-grid" role="radiogroup" aria-labelledby="gen-form-style-lbl">
        {[
          { id: 'color', icon: 'fa-palette',           name: 'Colorful Report',  desc: 'Brand-coloured headers — for parent retention' },
          { id: 'bw',    icon: 'fa-circle-half-stroke', name: 'Colorless Report', desc: 'Low-ink layout — white bg, light borders only' },
        ].map(o => (
          <button
            key={o.id}
            type="button"
            className={`crm-fmt-opt${fmt === o.id ? ' active' : ''}`}
            onClick={() => setFmt(o.id)}
            role="radio"
            aria-checked={fmt === o.id}
            tabIndex={fmt === o.id ? 0 : -1}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')   { e.preventDefault(); setFmt('color'); }
              else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setFmt('bw'); }
            }}
          >
            <div className="crm-fmt-ic" aria-hidden="true"><i className={`fa-solid ${o.icon}`}></i></div>
            <div className="crm-fmt-name">{o.name}</div>
            <div className="crm-fmt-desc">{o.desc}</div>
            <div className="crm-fmt-check" aria-hidden="true"><i className="fa-solid fa-circle-check"></i></div>
          </button>
        ))}
      </div>
    </CrmModalShell>
  );
}

/* ─── Export Active Leads modal ─── */
function ExportLeadsModal({ leads, school, onClose, toast }) {
  useModalChrome(onClose);
  const [fmt, setFmt] = useState('pdf');
  const [style, setStyle] = useState('color'); // 'color' | 'bw' — only meaningful for the PDF format
  const handle = () => {
    if (fmt === 'pdf') {
      const isBW = style === 'bw';
      openCrmReportWindow('Active Leads Export', buildLeadsExportHTML(leads, school), toast, '#1E3A8A', isBW);
    } else {
      const csv = buildLeadsCSV(leads);
      const blob = new Blob([csv], { type: fmt === 'csv' ? 'text/csv;charset=utf-8' : 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `active-leads-${todayCrmISO()}.${fmt === 'csv' ? 'csv' : 'xls'}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    toast(`${leads.length} lead(s) exported as ${fmt.toUpperCase()}`, 'success');
    onClose();
  };
  return (
    <CrmModalShell
      icon="fa-file-export"
      gradient="linear-gradient(135deg,#DC2626,#B91C1C)"
      title="Export Active Leads"
      sub={`${leads.length} record(s) currently visible`}
      size="md"
      onClose={onClose}
      footer={
        <>
          <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="fee-btn fee-btn-primary acc-dlreport-btn"
            onClick={handle}
          >
            <i className="fa-solid fa-download"></i> Download {fmt.toUpperCase()}
          </button>
        </>
      }
    >
      {fmt === 'pdf' && (
        <>
          <div className="fee-label" id="export-leads-style-lbl">Report Style</div>
          <div className="crm-fmt-grid" role="radiogroup" aria-labelledby="export-leads-style-lbl" style={{ marginBottom: 14 }}>
            {[
              { id: 'color', icon: 'fa-palette',            name: 'Colorful Report',  desc: 'School branding, summary cards &amp; status badges' },
              { id: 'bw',    icon: 'fa-circle-half-stroke', name: 'Colorless Report', desc: 'Low-ink layout — white bg, light borders only' },
            ].map(o => (
              <button
                key={o.id}
                type="button"
                className={`crm-fmt-opt${style === o.id ? ' active' : ''}`}
                onClick={() => setStyle(o.id)}
                role="radio"
                aria-checked={style === o.id}
                tabIndex={style === o.id ? 0 : -1}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')   { e.preventDefault(); setStyle('color'); }
                  else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw'); }
                }}
              >
                <div className="crm-fmt-ic" aria-hidden="true"><i className={`fa-solid ${o.icon}`}></i></div>
                <div className="crm-fmt-name">{o.name}</div>
                <div className="crm-fmt-desc" dangerouslySetInnerHTML={{ __html: o.desc }}></div>
                <div className="crm-fmt-check" aria-hidden="true"><i className="fa-solid fa-circle-check"></i></div>
              </button>
            ))}
          </div>
        </>
      )}
      <div className="fee-label">Format</div>
      <div className="crm-fmt-grid">
        {[
          { id: 'pdf',   icon: 'fa-file-pdf',   name: 'PDF Document',   desc: 'A4-shaped printable report with header + table' },
          { id: 'excel', icon: 'fa-file-excel', name: 'Excel Workbook', desc: 'XLS spreadsheet for filtering / sorting' },
          { id: 'csv',   icon: 'fa-file-csv',   name: 'CSV File',       desc: 'Plain comma-separated for import elsewhere' },
        ].map(o => (
          <button key={o.id} type="button" className={`crm-fmt-opt${fmt === o.id ? ' active' : ''}`} onClick={() => setFmt(o.id)}>
            <div className="crm-fmt-ic"><i className={`fa-solid ${o.icon}`}></i></div>
            <div className="crm-fmt-name">{o.name}</div>
            <div className="crm-fmt-desc">{o.desc}</div>
            <div className="crm-fmt-check"><i className="fa-solid fa-circle-check"></i></div>
          </button>
        ))}
      </div>
    </CrmModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LEAD SETUP — 5 cards: Uniform / Books / Fee Structure / Inquiry
   Sources / Follow-up Statuses. All editable in-place; "Add Class",
   "Add Fee Head", "Add Source", "Add Status" open dedicated modals.
   ═══════════════════════════════════════════════════════════════════ */
const CLASS_PRESETS = [
  'Nursery', 'Prep', 'Class 1', 'Class 2', 'Class 3', 'Class 4',
  'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
];
const FEE_HEAD_PRESETS = [
  'Admission Fee', 'Registration Fee', 'Security Fee', 'Tuition Fee',
  'Computer Lab Fee', 'Examination Fee', 'Sports Fee', 'Library Fee',
  'Transport Fee', 'Other',
];
const FEE_FREQ_OPTIONS    = ['One-Time', 'Monthly', 'Quarterly', 'Half-Yearly', 'Yearly', 'Per Session'];
const BOOKS_FREQ_OPTIONS  = [
  { value: 'One-Time',     label: 'One-Time (Per Session)' },
  { value: 'Yearly',       label: 'Yearly' },
  { value: 'Half-Yearly',  label: 'Half-Yearly' },
  { value: 'Quarterly',    label: 'Quarterly' },
  { value: 'Monthly',      label: 'Monthly' },
];
const SEASON_OPTIONS      = [
  { value: 'Summer',   label: 'Summer' },
  { value: 'Winter',   label: 'Winter' },
  { value: 'Sports',   label: 'Sports / PT Kit' },
  { value: 'Annual',   label: 'Annual' },
  { value: 'One-Time', label: 'One-Time' },
];
const FEE_HEAD_PRESETS_LABELS = [
  'Admission Fee', 'Registration Fee', 'Security Fee / Deposit', 'Tuition Fee',
  'Computer Lab Fee', 'Examination Fee', 'Sports Fee', 'Library Fee',
  'Transport Fee', 'Other Charges',
];

/* Preset chips offered in the Quick-Select grid for Source / Status adds. */
const SOURCE_PRESETS = [
  { name: 'Facebook',        icon: 'fa-brands fa-facebook',  color: '#1877F2' },
  { name: 'Instagram',       icon: 'fa-brands fa-instagram', color: '#E1306C' },
  { name: 'WhatsApp',        icon: 'fa-brands fa-whatsapp',  color: '#25D366' },
  { name: 'Google',          icon: 'fa-brands fa-google',    color: '#EA4335' },
  { name: 'YouTube',         icon: 'fa-brands fa-youtube',   color: '#FF0000' },
  { name: 'Walk-in',         icon: 'fa-solid fa-person-walking', color: '#16A34A' },
  { name: 'Reference',       icon: 'fa-solid fa-user-group', color: '#7C3AED' },
  { name: 'Website',         icon: 'fa-solid fa-globe',      color: '#0284C7' },
  { name: 'Campaign',        icon: 'fa-solid fa-bullhorn',   color: '#D97706' },
  { name: 'Banner',          icon: 'fa-solid fa-image',      color: '#64748B' },
  { name: 'Existing Parent', icon: 'fa-solid fa-school',     color: '#1E40AF' },
];
const STATUS_PRESETS = [
  { name: 'Interested',         icon: 'fa-solid fa-star',            color: '#0284C7' },
  { name: 'Call Back Later',    icon: 'fa-solid fa-phone-volume',    color: '#D97706' },
  { name: 'Visit Scheduled',    icon: 'fa-solid fa-calendar-check',  color: '#7C3AED' },
  { name: 'Waiting Decision',   icon: 'fa-solid fa-hourglass-half',  color: '#64748B' },
  { name: 'On Hold',            icon: 'fa-solid fa-pause-circle',    color: '#D97706' },
  { name: 'Follow-up Again',    icon: 'fa-solid fa-rotate',          color: '#0284C7' },
  { name: 'Form Sent',          icon: 'fa-solid fa-file-pdf',        color: '#16A34A' },
  { name: 'Documents Pending',  icon: 'fa-solid fa-folder-open',     color: '#D97706' },
];
const DEFAULT_SOURCES = [
  { name: 'Facebook',        icon: 'fa-brands fa-facebook',      color: '#1877F2', locked: false },
  { name: 'Instagram',       icon: 'fa-brands fa-instagram',     color: '#E1306C', locked: false },
  { name: 'Walk-in',         icon: 'fa-solid fa-person-walking', color: '#16A34A', locked: false },
  { name: 'Reference',       icon: 'fa-solid fa-user-group',     color: '#7C3AED', locked: false },
  { name: 'WhatsApp',        icon: 'fa-brands fa-whatsapp',      color: '#25D366', locked: false },
  { name: 'Google',          icon: 'fa-brands fa-google',        color: '#EA4335', locked: false },
  { name: 'Website',         icon: 'fa-solid fa-globe',          color: '#0284C7', locked: false },
  { name: 'Campaign',        icon: 'fa-solid fa-bullhorn',       color: '#D97706', locked: false },
  { name: 'Banner',          icon: 'fa-solid fa-image',          color: '#64748B', locked: false },
  { name: 'Existing Parent', icon: 'fa-solid fa-school',         color: '#1E40AF', locked: false },
];
const DEFAULT_STATUSES = [
  { name: 'Interested',       icon: 'fa-solid fa-star',           color: '#0284C7', locked: false },
  { name: 'Call Back Later',  icon: 'fa-solid fa-phone-volume',   color: '#D97706', locked: false },
  { name: 'Visit Scheduled',  icon: 'fa-solid fa-calendar-check', color: '#7C3AED', locked: false },
  { name: 'Waiting Decision', icon: 'fa-solid fa-hourglass-half', color: '#64748B', locked: false },
  { name: 'Confirmed',        icon: 'fa-solid fa-circle-check',   color: '#16A34A', locked: true },
  { name: 'Not Interested',   icon: 'fa-solid fa-circle-xmark',   color: '#DC2626', locked: true },
];

/* Initial uniform / books / fee structure data — ported verbatim
   from the HTML reference's `setupData`. */
const DEFAULT_UNIFORM = [
  { cls: 'Nursery', type: 'School Uniform (Shirt + Trouser)',   season: 'Summer', charges: 1800, notes: '' },
  { cls: 'Nursery', type: 'School Uniform (Sweater + Trouser)', season: 'Winter', charges: 2400, notes: '' },
  { cls: 'Nursery', type: 'Sports Kit (T-Shirt + Shorts)',      season: 'Sports', charges:  900, notes: '' },
  { cls: 'Class 1', type: 'School Uniform (Shirt + Trouser)',   season: 'Summer', charges: 2000, notes: '' },
  { cls: 'Class 1', type: 'School Uniform (Sweater + Trouser)', season: 'Winter', charges: 2600, notes: '' },
  { cls: 'Class 1', type: 'Sports Kit',                         season: 'Sports', charges: 1000, notes: '' },
  { cls: 'Class 2', type: 'School Uniform (Shirt + Trouser)',   season: 'Summer', charges: 2000, notes: '' },
  { cls: 'Class 2', type: 'School Uniform (Sweater + Trouser)', season: 'Winter', charges: 2800, notes: '' },
  { cls: 'Class 2', type: 'Sports Kit',                         season: 'Sports', charges: 1000, notes: '' },
];
const DEFAULT_BOOKS = [
  { cls: 'Nursery', books: 3500, stationery:  800, optional:   0, frequency: 'One-Time', notes: '' },
  { cls: 'Class 1', books: 4200, stationery: 1000, optional:   0, frequency: 'One-Time', notes: '' },
  { cls: 'Class 2', books: 5000, stationery: 1200, optional: 300, frequency: 'One-Time', notes: '' },
];
const DEFAULT_ADMISSION = {
  admFee: 5000, regFee: 2500, security: 3000, other: 500,
  frequency: 'One-Time',
  notes: 'Security deposit is fully refundable on leaving. Registration fee is non-refundable.',
};
const DEFAULT_FEE_STRUCTURE = {
  'Nursery': [
    { name: 'Admission Fee',    amount: 5000, freq: 'One-Time' },
    { name: 'Registration Fee', amount: 2500, freq: 'One-Time' },
    { name: 'Security Deposit', amount: 3000, freq: 'One-Time' },
    { name: 'Tuition Fee',      amount: 5000, freq: 'Monthly'  },
  ],
  'Class 1': [
    { name: 'Admission Fee',    amount: 5000, freq: 'One-Time' },
    { name: 'Registration Fee', amount: 2500, freq: 'One-Time' },
    { name: 'Security Deposit', amount: 3000, freq: 'One-Time' },
    { name: 'Tuition Fee',      amount: 6000, freq: 'Monthly'  },
    { name: 'Computer Lab Fee', amount:  500, freq: 'Monthly'  },
  ],
  'Class 2': [
    { name: 'Admission Fee',    amount: 5000, freq: 'One-Time' },
    { name: 'Registration Fee', amount: 2500, freq: 'One-Time' },
    { name: 'Security Deposit', amount: 3000, freq: 'One-Time' },
    { name: 'Tuition Fee',      amount: 6500, freq: 'Monthly'  },
    { name: 'Computer Lab Fee', amount:  500, freq: 'Monthly'  },
    { name: 'Examination Fee',  amount: 1200, freq: 'Quarterly' },
  ],
};

const fmtRs = (n) => `₨ ${Number(n || 0).toLocaleString('en-PK')}`;

function LeadSetup({ toast }) {
  /* All state lives locally — Lead Setup is a configuration screen with
     no upstream mock. (Future: persist via crmService when backend lands.) */
  const [uniforms, setUniforms] = useState(DEFAULT_UNIFORM);
  const [books, setBooks]       = useState(DEFAULT_BOOKS);
  const [feeStructure, setFeeStructure] = useState(DEFAULT_FEE_STRUCTURE);
  const [activeFeeClass, setActiveFeeClass] = useState('Nursery');
  const [sources, setSources]   = useState(DEFAULT_SOURCES);
  const [statuses, setStatuses] = useState(DEFAULT_STATUSES);

  /* Modal state */
  const [uniCfg, setUniCfg]         = useState(null); // {mode:'add'|'edit', row?}
  const [bookCfg, setBookCfg]       = useState(null);
  const [classCfg, setClassCfg]     = useState(null); // {target:'uniform'|'books'|'fee'}
  const [feeHeadCfg, setFeeHeadCfg] = useState(null); // {mode:'add'|'edit', cls, head?, idx?}
  const [chipCfg, setChipCfg]       = useState(null); // {type:'source'|'status'}

  /* ─── Aggregate per-class summary for the uniform table ─── */
  const uniformByClass = useMemo(() => {
    const map = {};
    uniforms.forEach(u => {
      if (!map[u.cls]) map[u.cls] = { cls: u.cls, summer: null, winter: null, sports: null, others: [], entries: [] };
      map[u.cls].entries.push(u);
      const slot = u.season === 'Sports' ? 'sports' : u.season === 'Winter' ? 'winter' : u.season === 'Summer' ? 'summer' : null;
      if (slot) map[u.cls][slot] = u.charges;
      else map[u.cls].others.push(`${u.season}: ${fmtRs(u.charges)}`);
    });
    return Object.values(map).sort((a, b) => {
      const ai = CLASS_PRESETS.indexOf(a.cls); const bi = CLASS_PRESETS.indexOf(b.cls);
      if (ai < 0 && bi < 0) return a.cls.localeCompare(b.cls);
      if (ai < 0) return 1; if (bi < 0) return -1;
      return ai - bi;
    });
  }, [uniforms]);

  /* ─── Uniform handlers (per-season entries) ─── */
  const saveUniform = ({ originalKey, cls, type, season, charges, notes }) => {
    if (!cls) { toast('Please pick a class', 'error'); return; }
    if (!type.trim()) { toast('Please enter a uniform type', 'error'); return; }
    if (!season) { toast('Please pick a season / frequency', 'error'); return; }
    setUniforms(prev => {
      const filtered = prev.filter(u => {
        /* Remove the original row being edited (by orig key), AND any other
           row with the same class+season so the new entry replaces it. */
        if (originalKey && `${u.cls}__${u.season}__${u.type}` === originalKey) return false;
        if (u.cls === cls && u.season === season) return false;
        return true;
      });
      return [...filtered, { cls, type: type.trim(), season, charges: Number(charges) || 0, notes: notes.trim() }];
    });
    toast(`Uniform charges saved for ${cls} (${season})`, 'success');
    setUniCfg(null);
  };
  const deleteUniformClass = (cls) => {
    setUniforms(prev => prev.filter(u => u.cls !== cls));
    toast(`Removed all uniform entries for ${cls}`, 'info');
  };

  /* ─── Books handlers ─── */
  const saveBooks = ({ cls, books: b, stationery, optional, frequency, notes }) => {
    if (!cls) { toast('Please pick a class', 'error'); return; }
    setBooks(prev => {
      const without = prev.filter(x => x.cls !== cls);
      return [...without, {
        cls,
        books:      Number(b) || 0,
        stationery: Number(stationery) || 0,
        optional:   Number(optional) || 0,
        frequency:  frequency || 'One-Time',
        notes:      (notes || '').trim(),
      }].sort((a, b2) => CLASS_PRESETS.indexOf(a.cls) - CLASS_PRESETS.indexOf(b2.cls));
    });
    toast(`Books & Stationery saved for ${cls}`, 'success');
    setBookCfg(null);
  };
  const deleteBooks = (cls) => {
    setBooks(prev => prev.filter(x => x.cls !== cls));
    toast(`Removed books charges for ${cls}`, 'info');
  };


  /* ─── Add Class handler ─── */
  const handleAddClass = ({ cls, target }) => {
    if (!cls) { toast('Please pick a class', 'error'); return; }
    if (target === 'uniform') {
      setUniCfg({ mode: 'add', row: { cls, type: '', season: 'Summer', charges: 0, notes: '' } });
    } else if (target === 'books') {
      if (books.find(b => b.cls === cls)) {
        toast(`${cls} already in Books table — opening edit`, 'info');
        setBookCfg({ mode: 'edit', row: books.find(b => b.cls === cls) });
      } else {
        setBookCfg({ mode: 'add', row: { cls, books: 0, stationery: 0, optional: 0, frequency: 'One-Time', notes: '' } });
      }
    } else if (target === 'fee') {
      if (feeStructure[cls]) {
        toast(`${cls} already has a fee structure`, 'info');
      } else {
        setFeeStructure(prev => ({ ...prev, [cls]: [] }));
        setActiveFeeClass(cls);
        toast(`${cls} added — now define its fee heads`, 'success');
      }
    }
    setClassCfg(null);
  };

  /* ─── Fee Structure handlers ─── */
  const saveFeeHead = ({ cls, name, amount, freq, idx }) => {
    if (!name) { toast('Please pick or enter a fee head', 'error'); return; }
    const amt = Number(amount) || 0;
    setFeeStructure(prev => {
      const list = [...(prev[cls] || [])];
      const next = { name, amount: amt, freq };
      if (idx != null) list[idx] = next; else list.push(next);
      return { ...prev, [cls]: list };
    });
    toast(`Fee head ${idx != null ? 'updated' : 'added'} for ${cls}`, 'success');
    setFeeHeadCfg(null);
  };
  const deleteFeeHead = (cls, idx) => {
    setFeeStructure(prev => ({ ...prev, [cls]: (prev[cls] || []).filter((_, i) => i !== idx) }));
    toast('Fee head removed', 'info');
  };
  const deleteFeeClass = (cls) => {
    setFeeStructure(prev => {
      const next = { ...prev };
      delete next[cls];
      return next;
    });
    const remaining = Object.keys(feeStructure).filter(c => c !== cls);
    if (remaining.length) setActiveFeeClass(remaining[0]);
    toast(`Removed fee structure for ${cls}`, 'info');
  };

  /* ─── Chip handlers (sources / statuses) ─── */
  const addChip = ({ type, name, icon, color }) => {
    if (!name.trim()) { toast('Please enter a name', 'error'); return; }
    const setter = type === 'source' ? setSources : setStatuses;
    setter(prev => {
      if (prev.find(c => c.name.toLowerCase() === name.trim().toLowerCase())) {
        toast(`"${name}" already exists`, 'error');
        return prev;
      }
      return [...prev, { name: name.trim(), icon: icon || 'fa-solid fa-tag', color, locked: false }];
    });
    toast(`${type === 'source' ? 'Source' : 'Status'} added`, 'success');
    setChipCfg(null);
  };
  const deleteChip = (type, name) => {
    const setter = type === 'source' ? setSources : setStatuses;
    setter(prev => prev.filter(c => !(c.name === name && !c.locked)));
    toast(`${name} removed`, 'info');
  };

  const feeClasses = Object.keys(feeStructure);
  const activeFeeRows = feeStructure[activeFeeClass] || [];
  const activeFeeTotal = activeFeeRows.reduce((a, r) => a + (Number(r.amount) || 0), 0);

  return (
    <>
      <div className="setup-grid">
        {/* A. Uniform Charges */}
        <div className="setup-card">
          <div className="setup-card-header">
            <div className="setup-card-title-row">
              <div className="setup-card-icon" style={{ background: 'rgba(30,58,138,.10)', color: '#1E40AF' }}>
                <i className="fa-solid fa-shirt"></i>
              </div>
              <div>
                <div className="setup-card-title">Uniform Charges</div>
                <div className="setup-card-sub">Class-wise summer, winter &amp; sports uniform</div>
              </div>
            </div>
            <Tooltip text="Add uniform charges">
              <button className="setup-add-btn" onClick={() => setUniCfg({ mode: 'add', row: { cls: '', type: '', season: 'Summer', charges: 0, notes: '' } })}>
                <i className="fa-solid fa-plus"></i>
              </button>
            </Tooltip>
          </div>
          <div className="setup-tablewrap">
            <div className="setup-table-head" style={{ gridTemplateColumns: '1fr 75px 75px 75px 80px' }}>
              <div className="setup-th">Class</div>
              <div className="setup-th">Summer</div>
              <div className="setup-th">Winter</div>
              <div className="setup-th">Sports</div>
              <div className="setup-th">Action</div>
            </div>
            {uniformByClass.length === 0 ? (
              <div className="setup-empty">No uniform charges yet — click "Add Class" to start.</div>
            ) : uniformByClass.map(u => {
              const findEntry = (season) => u.entries.find(e => e.season === season);
              const cellFor = (slotKey, season) => {
                const ent = findEntry(season);
                const onClick = () => {
                  if (ent) setUniCfg({ mode: 'edit', row: ent });
                  else setUniCfg({ mode: 'add', row: { cls: u.cls, type: '', season, charges: 0, notes: '' } });
                };
                return (
                  <Tooltip text={ent ? `Edit ${season} uniform for ${u.cls}` : `Add ${season} uniform for ${u.cls}`}>
                    <button type="button" className={`setup-cell-btn${ent ? '' : ' empty'}`} onClick={onClick}>
                      {u[slotKey] != null ? fmtRs(u[slotKey]) : '+ Add'}
                    </button>
                  </Tooltip>
                );
              };
              return (
                <div key={u.cls} className="setup-row" style={{ gridTemplateColumns: '1fr 75px 75px 75px 80px' }}>
                  <div className="setup-td name">{u.cls}</div>
                  <div className="setup-td amt">{cellFor('summer', 'Summer')}</div>
                  <div className="setup-td amt">{cellFor('winter', 'Winter')}</div>
                  <div className="setup-td amt">{cellFor('sports', 'Sports')}</div>
                  <div className="setup-td actions">
                    <Tooltip text="Add another uniform entry for this class">
                      <button className="setup-iconbtn" onClick={() => setUniCfg({ mode: 'add', row: { cls: u.cls, type: '', season: 'Summer', charges: 0, notes: '' } })}>
                        <i className="fa-solid fa-plus"></i>
                      </button>
                    </Tooltip>
                    <Tooltip text="Remove all uniform entries for this class">
                      <button className="setup-iconbtn danger" onClick={() => deleteUniformClass(u.cls)}>
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="setup-add-row">
            <button className="setup-add-class" onClick={() => setClassCfg({ target: 'uniform' })}>
              <i className="fa-solid fa-plus"></i> Add Class
            </button>
          </div>
        </div>

        {/* B. Books & Stationery */}
        <div className="setup-card">
          <div className="setup-card-header">
            <div className="setup-card-title-row">
              <div className="setup-card-icon" style={{ background: 'rgba(22,163,74,.12)', color: '#16A34A' }}>
                <i className="fa-solid fa-book"></i>
              </div>
              <div>
                <div className="setup-card-title">Books &amp; Stationery</div>
                <div className="setup-card-sub">Class-wise books and stationery charges</div>
              </div>
            </div>
            <Tooltip text="Add books charges">
              <button className="setup-add-btn" onClick={() => setBookCfg({ mode: 'add', row: { cls: '', books: 0, stationery: 0, optional: 0, frequency: 'One-Time', notes: '' } })}>
                <i className="fa-solid fa-plus"></i>
              </button>
            </Tooltip>
          </div>
          <div className="setup-tablewrap">
            <div className="setup-table-head" style={{ gridTemplateColumns: '1fr 80px 80px 70px 90px 80px' }}>
              <div className="setup-th">Class</div>
              <div className="setup-th">Books</div>
              <div className="setup-th">Stationery</div>
              <div className="setup-th">Optional</div>
              <div className="setup-th">Frequency</div>
              <div className="setup-th">Action</div>
            </div>
            {books.length === 0 ? (
              <div className="setup-empty">No books charges yet — click "Add Class" to start.</div>
            ) : books.map(b => (
              <div key={b.cls} className="setup-row" style={{ gridTemplateColumns: '1fr 80px 80px 70px 90px 80px' }}>
                <div className="setup-td name">{b.cls}</div>
                <div className="setup-td amt">{fmtRs(b.books)}</div>
                <div className="setup-td amt">{fmtRs(b.stationery)}</div>
                <div className="setup-td amt">{b.optional ? fmtRs(b.optional) : '—'}</div>
                <div className="setup-td"><span className="fee-freq-chip">{b.frequency}</span></div>
                <div className="setup-td actions">
                  <Tooltip text="Edit">
                    <button className="setup-iconbtn" onClick={() => setBookCfg({ mode: 'edit', row: b })}>
                      <i className="fa-solid fa-pen"></i>
                    </button>
                  </Tooltip>
                  <Tooltip text="Remove">
                    <button className="setup-iconbtn danger" onClick={() => deleteBooks(b.cls)}>
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
          <div className="setup-add-row">
            <button className="setup-add-class" onClick={() => setClassCfg({ target: 'books' })}>
              <i className="fa-solid fa-plus"></i> Add Class
            </button>
          </div>
        </div>

        {/* C. Fee Structure — full width */}
        <div className="setup-card setup-card--full">
          <div className="setup-card-header">
            <div className="setup-card-title-row">
              <div className="setup-card-icon" style={{ background: 'rgba(30,58,138,.10)', color: '#1E40AF' }}>
                <i className="fa-solid fa-indian-rupee-sign"></i>
              </div>
              <div>
                <div className="setup-card-title">Fee Structure</div>
                <div className="setup-card-sub">Class-wise fee heads with amount and frequency</div>
              </div>
            </div>
            <Tooltip text="Add a class to the fee structure">
              <button className="setup-add-btn-text" onClick={() => setClassCfg({ target: 'fee' })}>
                <i className="fa-solid fa-plus"></i> Add Class
              </button>
            </Tooltip>
          </div>

          {feeClasses.length === 0 ? (
            <div className="setup-empty" style={{ padding: 36 }}>
              No classes yet — click "Add Class" above to define a fee structure.
            </div>
          ) : (
            <>
              <div className="fee-tabs-wrap">
                {feeClasses.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`fee-tab${activeFeeClass === c ? ' active' : ''}`}
                    onClick={() => setActiveFeeClass(c)}
                  >
                    {c}
                    {feeClasses.length > 1 && (
                      <span
                        className="fee-tab-del"
                        onClick={(e) => { e.stopPropagation(); deleteFeeClass(c); }}
                        title={`Remove ${c}`}
                      ><i className="fa-solid fa-xmark"></i></span>
                    )}
                  </button>
                ))}
              </div>
              <div className="setup-tablewrap">
                <div className="setup-table-head" style={{ gridTemplateColumns: '1fr 130px 130px 100px' }}>
                  <div className="setup-th">Fee Head</div>
                  <div className="setup-th">Amount (₨)</div>
                  <div className="setup-th">Frequency</div>
                  <div className="setup-th">Action</div>
                </div>
                {activeFeeRows.length === 0 ? (
                  <div className="setup-empty">No fee heads for {activeFeeClass} yet.</div>
                ) : activeFeeRows.map((r, i) => (
                  <div key={`${r.name}-${i}`} className="setup-row" style={{ gridTemplateColumns: '1fr 130px 130px 100px' }}>
                    <div className="setup-td name">{r.name}</div>
                    <div className="setup-td amt">{fmtRs(r.amount)}</div>
                    <div className="setup-td"><span className="fee-freq-chip">{r.freq}</span></div>
                    <div className="setup-td actions">
                      <Tooltip text="Edit">
                        <button className="setup-iconbtn" onClick={() => setFeeHeadCfg({ mode: 'edit', cls: activeFeeClass, head: r, idx: i })}>
                          <i className="fa-solid fa-pen"></i>
                        </button>
                      </Tooltip>
                      <Tooltip text="Remove">
                        <button className="setup-iconbtn danger" onClick={() => deleteFeeHead(activeFeeClass, i)}>
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                ))}
                {activeFeeRows.length > 0 && (
                  <div className="setup-row setup-row--total" style={{ gridTemplateColumns: '1fr 130px 130px 100px' }}>
                    <div className="setup-td name">Total</div>
                    <div className="setup-td amt">{fmtRs(activeFeeTotal)}</div>
                    <div className="setup-td"></div>
                    <div className="setup-td"></div>
                  </div>
                )}
              </div>
              <div className="setup-add-row">
                <button
                  className="setup-add-class"
                  onClick={() => setFeeHeadCfg({ mode: 'add', cls: activeFeeClass })}
                >
                  <i className="fa-solid fa-plus"></i> Add Fee Head to {activeFeeClass}
                </button>
              </div>
            </>
          )}
        </div>

        {/* D. Inquiry Sources */}
        <div className="setup-card">
          <div className="setup-card-header">
            <div className="setup-card-title-row">
              <div className="setup-card-icon" style={{ background: 'rgba(124,58,237,.12)', color: '#7C3AED' }}>
                <i className="fa-solid fa-share-nodes"></i>
              </div>
              <div>
                <div className="setup-card-title">Inquiry Sources</div>
                <div className="setup-card-sub">Track where your leads come from</div>
              </div>
            </div>
          </div>
          <div className="chip-list">
            {sources.map(s => (
              <span
                key={s.name}
                className="chip-item"
                style={{
                  background: `${s.color}14`,
                  color: s.color,
                  borderColor: `${s.color}33`,
                }}
              >
                <i className={s.icon} style={{ color: s.color }}></i> {s.name}
                {!s.locked && (
                  <span className="chip-del" onClick={() => deleteChip('source', s.name)}>
                    <i className="fa-solid fa-xmark"></i>
                  </span>
                )}
              </span>
            ))}
            <span className="chip-item chip-add" onClick={() => setChipCfg({ type: 'source' })}>
              <i className="fa-solid fa-plus"></i> Add Source
            </span>
          </div>
        </div>

        {/* E. Follow-up Status */}
        <div className="setup-card">
          <div className="setup-card-header">
            <div className="setup-card-title-row">
              <div className="setup-card-icon" style={{ background: 'rgba(2,132,199,.12)', color: '#0284C7' }}>
                <i className="fa-solid fa-tags"></i>
              </div>
              <div>
                <div className="setup-card-title">Follow-up Status</div>
                <div className="setup-card-sub">Custom lead status labels</div>
              </div>
            </div>
          </div>
          <div className="chip-list">
            {statuses.map(s => (
              <span
                key={s.name}
                className={`chip-item${s.locked ? ' chip-locked' : ''}`}
                style={{
                  background: `${s.color}14`,
                  color: s.color,
                  borderColor: `${s.color}33`,
                }}
              >
                <i className={s.icon} style={{ color: s.color }}></i> {s.name}
                {s.locked ? (
                  <Tooltip text="Default status — cannot be deleted">
                    <span className="chip-lock"><i className="fa-solid fa-lock"></i></span>
                  </Tooltip>
                ) : (
                  <span className="chip-del" onClick={() => deleteChip('status', s.name)}>
                    <i className="fa-solid fa-xmark"></i>
                  </span>
                )}
              </span>
            ))}
            <span className="chip-item chip-add" onClick={() => setChipCfg({ type: 'status' })}>
              <i className="fa-solid fa-plus"></i> Add Status
            </span>
          </div>
        </div>
      </div>

      {uniCfg && (
        <SetupUniformModal
          cfg={uniCfg}
          existingClasses={uniforms.map(u => u.cls)}
          onClose={() => setUniCfg(null)}
          onSave={saveUniform}
        />
      )}
      {bookCfg && (
        <SetupBooksModal
          cfg={bookCfg}
          existingClasses={books.map(b => b.cls)}
          onClose={() => setBookCfg(null)}
          onSave={saveBooks}
        />
      )}
      {classCfg && (
        <AddClassModal
          target={classCfg.target}
          existing={
            classCfg.target === 'uniform' ? uniforms.map(u => u.cls)
            : classCfg.target === 'books' ? books.map(b => b.cls)
            : Object.keys(feeStructure)
          }
          onClose={() => setClassCfg(null)}
          onSave={handleAddClass}
        />
      )}
      {feeHeadCfg && (
        <AddFeeHeadModal
          cfg={feeHeadCfg}
          onClose={() => setFeeHeadCfg(null)}
          onSave={saveFeeHead}
        />
      )}
      {chipCfg && (
        <AddChipModal
          cfg={chipCfg}
          existing={chipCfg.type === 'source' ? sources : statuses}
          onClose={() => setChipCfg(null)}
          onSave={addChip}
        />
      )}
    </>
  );
}

/* ─── Setup Uniform modal — matches HTML reference exactly:
   Class + Uniform Type + Season + Charges + Notes (one entry per save) */
function SetupUniformModal({ cfg, onClose, onSave }) {
  useModalChrome(onClose);
  const isEdit = cfg.mode === 'edit';
  const originalKey = isEdit ? `${cfg.row.cls}__${cfg.row.season}__${cfg.row.type}` : null;
  const [cls, setCls]         = useState(cfg.row?.cls || '');
  const [type, setType]       = useState(cfg.row?.type || '');
  const [season, setSeason]   = useState(cfg.row?.season || 'Summer');
  const [charges, setCharges] = useState(String(cfg.row?.charges || 0));
  const [notes, setNotes]     = useState(cfg.row?.notes || '');
  return (
    <CrmModalShell
      icon="fa-shirt"
      gradient="linear-gradient(135deg,#1E3A8A,#1E40AF)"
      title={isEdit ? 'Edit Uniform Charges' : 'Add Uniform Charges'}
      sub="Configure class-wise uniform charges"
      size="md"
      onClose={onClose}
      footer={
        <>
          <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="fee-btn fee-btn-primary" onClick={() => onSave({ originalKey, cls, type, season, charges, notes })}>
            <i className="fa-solid fa-floppy-disk"></i> Save
          </button>
        </>
      }
    >
      <div className="crm-form-grid">
        <div className="fee-field">
          <span className="fee-label">Class *</span>
          <div className="fee-select-wrap">
            <select className="fee-select" value={cls} onChange={(e) => setCls(e.target.value)}>
              <option value="">— Select —</option>
              {CLASS_PRESETS.map(c => <option key={c}>{c}</option>)}
            </select>
            <i className="fa-solid fa-chevron-down"></i>
          </div>
        </div>
        <div className="fee-field">
          <span className="fee-label">Uniform Type *</span>
          <input className="fee-input" value={type} onChange={(e) => setType(e.target.value)} placeholder="e.g. Summer Shirt + Trouser" />
        </div>
        <div className="fee-field">
          <span className="fee-label">Season / Frequency *</span>
          <div className="fee-select-wrap">
            <select className="fee-select" value={season} onChange={(e) => setSeason(e.target.value)}>
              {SEASON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <i className="fa-solid fa-chevron-down"></i>
          </div>
        </div>
        <div className="fee-field">
          <span className="fee-label">Charges (₨) *</span>
          <input className="fee-input" type="number" min="0" value={charges} onChange={(e) => setCharges(e.target.value)} placeholder="0" />
        </div>
        <div className="fee-field full">
          <span className="fee-label">Notes <span className="fee-optional">(optional)</span></span>
          <textarea className="fee-input" rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Includes dupatta for girls. Available at school store." />
        </div>
        <div className="setup-helper fee-field full">
          <i className="fa-solid fa-circle-info"></i> These values will reflect in Fee Sharing Reports and PDF downloads.
        </div>
      </div>
    </CrmModalShell>
  );
}

/* ─── Setup Books modal — matches HTML reference exactly:
   Class + Frequency + Books + Stationery + Optional + Notes */
function SetupBooksModal({ cfg, existingClasses, onClose, onSave }) {
  useModalChrome(onClose);
  const isEdit = cfg.mode === 'edit';
  const [cls, setCls]               = useState(cfg.row?.cls || '');
  const [frequency, setFrequency]   = useState(cfg.row?.frequency || 'One-Time');
  const [books, setBooks]           = useState(String(cfg.row?.books || 0));
  const [stationery, setStationery] = useState(String(cfg.row?.stationery || 0));
  const [optional, setOptional]     = useState(String(cfg.row?.optional || 0));
  const [notes, setNotes]           = useState(cfg.row?.notes || '');
  const classOptions = isEdit ? [cfg.row.cls] : CLASS_PRESETS.filter(c => !existingClasses.includes(c));
  return (
    <CrmModalShell
      icon="fa-book"
      gradient="linear-gradient(135deg,#16A34A,#15803D)"
      title={isEdit ? 'Edit Books & Stationery' : 'Add Books & Stationery'}
      sub="Configure class-wise books and stationery charges"
      size="md"
      onClose={onClose}
      footer={
        <>
          <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="fee-btn fee-btn-primary"
            style={{ background: 'linear-gradient(135deg,#16A34A,#15803D)', boxShadow: '0 4px 14px rgba(22,163,74,.28)' }}
            onClick={() => onSave({ cls, books, stationery, optional, frequency, notes })}
          >
            <i className="fa-solid fa-floppy-disk"></i> Save
          </button>
        </>
      }
    >
      <div className="crm-form-grid">
        <div className="fee-field">
          <span className="fee-label">Class *</span>
          <div className="fee-select-wrap">
            <select className="fee-select" value={cls} onChange={(e) => setCls(e.target.value)} disabled={isEdit}>
              {!isEdit && <option value="">— Select —</option>}
              {classOptions.map(c => <option key={c}>{c}</option>)}
            </select>
            <i className="fa-solid fa-chevron-down"></i>
          </div>
        </div>
        <div className="fee-field">
          <span className="fee-label">Frequency *</span>
          <div className="fee-select-wrap">
            <select className="fee-select" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              {BOOKS_FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <i className="fa-solid fa-chevron-down"></i>
          </div>
        </div>
        <div className="fee-field">
          <span className="fee-label">Books Charges (₨) *</span>
          <input className="fee-input" type="number" min="0" value={books} onChange={(e) => setBooks(e.target.value)} placeholder="0" />
        </div>
        <div className="fee-field">
          <span className="fee-label">Stationery Charges (₨)</span>
          <input className="fee-input" type="number" min="0" value={stationery} onChange={(e) => setStationery(e.target.value)} placeholder="0" />
        </div>
        <div className="fee-field">
          <span className="fee-label">Optional / Other Items (₨)</span>
          <input className="fee-input" type="number" min="0" value={optional} onChange={(e) => setOptional(e.target.value)} placeholder="0" />
        </div>
        <div className="fee-field"></div>
        <div className="fee-field full">
          <span className="fee-label">Notes <span className="fee-optional">(optional)</span></span>
          <textarea className="fee-input" rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Books available at school. Stationery pack includes geometry set." />
        </div>
        <div className="setup-helper fee-field full">
          <i className="fa-solid fa-circle-info"></i> Frequency and notes will appear in all reports and PDF downloads.
        </div>
      </div>
    </CrmModalShell>
  );
}

/* SetupAdmissionModal was removed — admission charges card no longer
   lives on the Lead Setup screen. Defaults still flow into the Share
   Fee report via DEFAULT_ADMISSION. */

/* ─── Add Class modal — matches HTML reference exactly (preset dropdown
   with "Custom…" option that reveals a text input) */
function AddClassModal({ target, existing, onClose, onSave }) {
  useModalChrome(onClose);
  const [cls, setCls] = useState('');
  const [custom, setCustom] = useState('');
  const useCustom = cls === '__custom__';
  const available = CLASS_PRESETS.filter(c => !existing.includes(c));
  const title = target === 'uniform' ? 'Add Class' : target === 'books' ? 'Add Class' : 'Add Class';
  const sub = target === 'uniform' ? 'Add a new class to Uniform Charges'
            : target === 'books'   ? 'Add a new class to Books & Stationery'
            :                        'Add a new class to Fee Structure';
  return (
    <CrmModalShell
      icon="fa-graduation-cap"
      gradient="linear-gradient(135deg,#1E3A8A,#1E40AF)"
      title={title}
      sub={sub}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="fee-btn fee-btn-primary" onClick={() => onSave({ cls: useCustom ? custom.trim() : cls, target })}>
            <i className="fa-solid fa-plus"></i> Add Class
          </button>
        </>
      }
    >
      <div className="fee-field full">
        <span className="fee-label">Select Class *</span>
        <div className="fee-select-wrap">
          <select className="fee-select" value={cls} onChange={(e) => setCls(e.target.value)}>
            <option value="">-- Select --</option>
            {available.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="__custom__">Custom…</option>
          </select>
          <i className="fa-solid fa-chevron-down"></i>
        </div>
      </div>
      {useCustom && (
        <div className="fee-field full" style={{ marginTop: 14 }}>
          <span className="fee-label">Or enter custom class name</span>
          <input className="fee-input" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. O-Level, A-Level, KG…" />
        </div>
      )}
      <div className="setup-helper" style={{ marginTop: 14 }}>
        <i className="fa-solid fa-circle-info"></i> The class will be added to the selected section in Lead Setup.
      </div>
    </CrmModalShell>
  );
}

/* ─── Add Fee Head modal — matches HTML reference exactly */
function AddFeeHeadModal({ cfg, onClose, onSave }) {
  useModalChrome(onClose);
  const isEdit = cfg.mode === 'edit';
  const presetMatch = isEdit ? FEE_HEAD_PRESETS_LABELS.find(p => p === cfg.head?.name) : null;
  const [pickName, setPickName] = useState(isEdit ? (presetMatch || '__custom__') : '');
  const [custom, setCustom]     = useState(isEdit && !presetMatch ? cfg.head.name : '');
  const [amount, setAmount]     = useState(String(cfg.head?.amount || 0));
  const [freq, setFreq]         = useState(cfg.head?.freq || 'One-Time');
  const useCustom = pickName === '__custom__';
  return (
    <CrmModalShell
      icon="fa-indian-rupee-sign"
      gradient="linear-gradient(135deg,#1E3A8A,#1E40AF)"
      title={isEdit ? 'Edit Fee Head' : 'Add Fee Head'}
      sub={`Add fee component to ${cfg.cls}`}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="fee-btn fee-btn-primary"
            onClick={() => onSave({ cls: cfg.cls, name: useCustom ? custom.trim() : pickName, amount, freq, idx: cfg.idx })}
          >
            <i className="fa-solid fa-floppy-disk"></i> Save Fee Head
          </button>
        </>
      }
    >
      <div className="crm-form-grid">
        <div className="fee-field full">
          <span className="fee-label">Fee Head Name *</span>
          <div className="fee-select-wrap">
            <select className="fee-select" value={pickName} onChange={(e) => setPickName(e.target.value)}>
              <option value="">-- Select --</option>
              {FEE_HEAD_PRESETS_LABELS.map(p => <option key={p}>{p}</option>)}
              <option value="__custom__">Custom…</option>
            </select>
            <i className="fa-solid fa-chevron-down"></i>
          </div>
        </div>
        {useCustom && (
          <div className="fee-field full">
            <span className="fee-label">Custom Fee Head Name</span>
            <input className="fee-input" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Enter fee head name" />
          </div>
        )}
        <div className="fee-field">
          <span className="fee-label">Amount (₨) *</span>
          <input className="fee-input" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </div>
        <div className="fee-field">
          <span className="fee-label">Frequency *</span>
          <div className="fee-select-wrap">
            <select className="fee-select" value={freq} onChange={(e) => setFreq(e.target.value)}>
              {FEE_FREQ_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
            <i className="fa-solid fa-chevron-down"></i>
          </div>
        </div>
        <div className="setup-helper fee-field full">
          <i className="fa-solid fa-circle-info"></i> This fee head will appear in reports for the selected class.
        </div>
      </div>
    </CrmModalShell>
  );
}
void FEE_HEAD_PRESETS; // legacy reference retained for compatibility

/* ─── Add Chip modal (Sources / Statuses) ─── */
function AddChipModal({ cfg, existing, onClose, onSave }) {
  useModalChrome(onClose);
  const isSource = cfg.type === 'source';
  const presets = isSource ? SOURCE_PRESETS : STATUS_PRESETS;
  const taken = new Set(existing.map(c => c.name.toLowerCase()));
  const free = presets.filter(p => !taken.has(p.name.toLowerCase()));

  const [name, setName]   = useState('');
  const [icon, setIcon]   = useState('fa-solid fa-tag');
  const [color, setColor] = useState(isSource ? '#7C3AED' : '#0284C7');

  const pickPreset = (p) => {
    setName(p.name);
    setIcon(p.icon);
    setColor(p.color);
  };

  return (
    <CrmModalShell
      icon={isSource ? 'fa-share-nodes' : 'fa-tags'}
      gradient={isSource ? 'linear-gradient(135deg,#7C3AED,#6D28D9)' : 'linear-gradient(135deg,#0284C7,#0369A1)'}
      title={isSource ? 'Add Inquiry Source' : 'Add Follow-up Status'}
      sub="Pick a preset or enter a custom one"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="fee-btn fee-btn-primary"
            style={{ background: isSource ? 'linear-gradient(135deg,#7C3AED,#6D28D9)' : 'linear-gradient(135deg,#0284C7,#0369A1)' }}
            onClick={() => onSave({ type: cfg.type, name, icon, color })}
          >
            <i className="fa-solid fa-plus"></i> Add
          </button>
        </>
      }
    >
      {free.length > 0 && (
        <>
          <div className="fee-label">Quick Select</div>
          <div className="chip-preset-grid">
            {free.map(p => (
              <button
                key={p.name}
                type="button"
                className={`chip-preset${name === p.name ? ' active' : ''}`}
                style={{ '--c': p.color }}
                onClick={() => pickPreset(p)}
              >
                <i className={p.icon} style={{ color: p.color }}></i> {p.name}
              </button>
            ))}
          </div>
          <div className="chip-divider"><span>OR ENTER CUSTOM</span></div>
        </>
      )}
      <div className="crm-form-grid">
        <div className="fee-field full">
          <span className="fee-label">Name *</span>
          <input className="fee-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={isSource ? 'e.g. TikTok' : 'e.g. Sent to Principal'} />
        </div>
        <div className="fee-field">
          <span className="fee-label">FontAwesome Icon</span>
          <input className="fee-input" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="fa-solid fa-tag" />
          <div className="fee-hint"><i className="fa-solid fa-circle-info"></i> e.g. <code>fa-solid fa-tag</code> or <code>fa-brands fa-twitter</code></div>
        </div>
        <div className="fee-field">
          <span className="fee-label">Colour</span>
          <div className="chip-color-row">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="chip-color-input" />
            <input className="fee-input" value={color} onChange={(e) => setColor(e.target.value)} style={{ flex: 1 }} />
          </div>
        </div>
        <div className="fee-field full">
          <span className="fee-label">Preview</span>
          <span
            className="chip-item"
            style={{
              background: `${color}14`,
              color,
              borderColor: `${color}33`,
              alignSelf: 'flex-start',
            }}
          >
            <i className={icon} style={{ color }}></i> {name || 'Preview'}
          </span>
        </div>
      </div>
    </CrmModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   INACTIVE LEADS — Converted Admissions + Not Interested sub-tabs.

   Top: 2 colour-coded stat cards (green / red, click to switch sub-tab)
   L2 nav: 2 pills with live-count badges
   Body: per-tab table with Download / Reactivate / Delete actions
   Reactivate + Delete each open their own confirm dialogs.
   Download opens an A4 PDF themed per outcome (green / red).
   ═══════════════════════════════════════════════════════════════════ */
function InactiveLeads({ toast }) {
  const { data: serverConverted = [] }     = useAsync(crmService.getCrmConverted, []);
  const { data: serverNotInterested = [] } = useAsync(crmService.getCrmNotInterested, []);
  const { data: school = {} }              = useAsync(crmService.getCrmSchool, {});

  /* Local mutable mirrors */
  const [converted, setConverted]           = useState(null);
  const [notInterested, setNotInterested]   = useState(null);
  useEffect(() => { if (serverConverted.length && converted == null) setConverted(serverConverted); }, [serverConverted, converted]);
  useEffect(() => { if (serverNotInterested.length && notInterested == null) setNotInterested(serverNotInterested); }, [serverNotInterested, notInterested]);

  const convList = useMemo(() => converted || [], [converted]);
  const niList   = useMemo(() => notInterested || [], [notInterested]);

  const [sub, setSub] = useState('converted');
  const [reactCfg, setReactCfg]   = useState(null);
  const [deleteCfg, setDeleteCfg] = useState(null);
  /* Report style — applies to every per-row download on this page. */
  const [inacStyle, setInacStyle] = useState('color'); // 'color' | 'bw'

  const downloadConverted = (row) => {
    openCrmReportWindow(
      `Confirmed Admission — ${row.name}`,
      buildConvertedReportHTML(row, school),
      toast,
      '#15803D',
      inacStyle === 'bw',
    );
  };
  const downloadNotInterested = (row) => {
    openCrmReportWindow(
      `Not Interested — ${row.name}`,
      buildNotInterestedReportHTML(row, school),
      toast,
      '#B91C1C',
      inacStyle === 'bw',
    );
  };

  const reactivate = (kind, row) => {
    if (kind === 'converted') setConverted(prev => prev.filter(r => r.id !== row.id));
    else setNotInterested(prev => prev.filter(r => r.id !== row.id));
    toast(`"${row.name}" reactivated and moved to Active Leads!`, 'success');
    setReactCfg(null);
  };
  const deleteForever = (kind, row) => {
    if (kind === 'converted') setConverted(prev => prev.filter(r => r.id !== row.id));
    else setNotInterested(prev => prev.filter(r => r.id !== row.id));
    toast(`"${row.name}" permanently deleted.`, 'info');
    setDeleteCfg(null);
  };

  return (
    <>
      {/* Top 2 stat cards — click to switch sub-tab */}
      <div className="crm-inactive-stats">
        <button
          type="button"
          className={`crm-inactive-stat crm-inactive-stat--green${sub === 'converted' ? ' active' : ''}`}
          onClick={() => setSub('converted')}
        >
          <div className="crm-inactive-stat-ic" style={{ background: 'rgba(22,163,74,.14)', color: '#16A34A' }}>
            <i className="fa-solid fa-circle-check"></i>
          </div>
          <div className="crm-inactive-stat-body">
            <div className="crm-inactive-stat-val" style={{ color: '#15803D' }}>{convList.length}</div>
            <div className="crm-inactive-stat-lbl">Confirmed Admissions</div>
            <div className="crm-inactive-stat-delta" style={{ color: '#15803D' }}>
              <i className="fa-solid fa-check"></i> Converted to students · Click to view
            </div>
          </div>
        </button>

        <button
          type="button"
          className={`crm-inactive-stat crm-inactive-stat--red${sub === 'notinterested' ? ' active' : ''}`}
          onClick={() => setSub('notinterested')}
        >
          <div className="crm-inactive-stat-ic" style={{ background: 'rgba(220,38,38,.12)', color: '#DC2626' }}>
            <i className="fa-solid fa-circle-xmark"></i>
          </div>
          <div className="crm-inactive-stat-body">
            <div className="crm-inactive-stat-val" style={{ color: '#B91C1C' }}>{niList.length}</div>
            <div className="crm-inactive-stat-lbl">Not Interested</div>
            <div className="crm-inactive-stat-delta" style={{ color: '#B91C1C' }}>
              <i className="fa-solid fa-circle-info"></i> Can be reactivated · Click to view
            </div>
          </div>
        </button>
      </div>

      {/* L2 sub-tab nav */}
      <div className="crm-l2-tabs">
        <button
          type="button"
          className={`crm-l2-tab${sub === 'converted' ? ' active' : ''}`}
          onClick={() => setSub('converted')}
        >
          <i className="fa-solid fa-circle-check"></i> Converted Admissions
          <span className={`crm-l2-badge${sub === 'converted' ? ' on' : ''}`}>{convList.length}</span>
        </button>
        <button
          type="button"
          className={`crm-l2-tab${sub === 'notinterested' ? ' active' : ''}`}
          onClick={() => setSub('notinterested')}
        >
          <i className="fa-solid fa-circle-xmark"></i> Not Interested
          <span className={`crm-l2-badge${sub === 'notinterested' ? ' on' : ''}`}>{niList.length}</span>
        </button>
        <div
          className="rep-style-row"
          role="radiogroup"
          aria-label="Report Style"
          style={{ marginLeft: 'auto' }}
        >
          <span className="rep-style-lbl">Report Style</span>
          <div className="rep-style-seg">
            <button
              type="button"
              className={`rep-style-btn${inacStyle === 'color' ? ' on' : ''}`}
              onClick={() => setInacStyle('color')}
              role="radio"
              aria-checked={inacStyle === 'color'}
              tabIndex={inacStyle === 'color' ? 0 : -1}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')   { e.preventDefault(); setInacStyle('color'); }
                else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setInacStyle('bw'); }
              }}
            >
              <i className="fa-solid fa-palette" aria-hidden="true"></i> Colorful
            </button>
            <button
              type="button"
              className={`rep-style-btn${inacStyle === 'bw' ? ' on' : ''}`}
              onClick={() => setInacStyle('bw')}
              role="radio"
              aria-checked={inacStyle === 'bw'}
              tabIndex={inacStyle === 'bw' ? 0 : -1}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')   { e.preventDefault(); setInacStyle('color'); }
                else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setInacStyle('bw'); }
              }}
            >
              <i className="fa-solid fa-circle-half-stroke" aria-hidden="true"></i> Colorless
            </button>
          </div>
        </div>
      </div>

      {sub === 'converted' ? (
        <ConvertedTable
          rows={convList}
          onDownload={downloadConverted}
          onReactivate={(row) => setReactCfg({ kind: 'converted', row })}
          onDelete={(row) => setDeleteCfg({ kind: 'converted', row })}
        />
      ) : (
        <NotInterestedTable
          rows={niList}
          onDownload={downloadNotInterested}
          onReactivate={(row) => setReactCfg({ kind: 'notinterested', row })}
          onDelete={(row) => setDeleteCfg({ kind: 'notinterested', row })}
        />
      )}

      <CrmConfirmDialog
        cfg={reactCfg && {
          style: 'primary',
          icon: 'fa-rotate-left',
          title: 'Reactivate Lead?',
          message: <span>"<strong>{reactCfg.row.name}</strong>" will be moved back to <strong>Active Leads</strong> with status reset to <strong>Interested</strong>.</span>,
          detail: [
            { icon: 'fa-users-between-lines', text: 'Lead moved to Active Leads list' },
            { icon: 'fa-timeline',             text: 'All previous notes & history preserved' },
            { icon: 'fa-calendar-plus',        text: 'Next follow-up cleared — set a new one' },
          ],
          confirmLabel: 'Yes, Reactivate',
          onConfirm: () => reactivate(reactCfg.kind, reactCfg.row),
        }}
        onClose={() => setReactCfg(null)}
      />
      <CrmConfirmDialog
        cfg={deleteCfg && {
          style: 'danger',
          icon: 'fa-trash',
          title: 'Delete Lead Permanently?',
          message: <span>"<strong>{deleteCfg.row.name}</strong>" will be removed forever. This cannot be undone.</span>,
          detail: [
            { icon: 'fa-triangle-exclamation', text: 'Lead and all its data will be permanently deleted' },
            { icon: 'fa-timeline',             text: 'Follow-up notes & history will be lost' },
            { icon: 'fa-ban',                  text: 'This cannot be recovered' },
          ],
          confirmLabel: 'Delete Forever',
          onConfirm: () => deleteForever(deleteCfg.kind, deleteCfg.row),
        }}
        onClose={() => setDeleteCfg(null)}
      />
    </>
  );
}

/* ─── Converted Admissions table ─── */
function ConvertedTable({ rows, onDownload, onReactivate, onDelete }) {
  return (
    <div className="fee-section">
      <div className="crm-inactive-head" style={{ gridTemplateColumns: '2fr 1.2fr 0.9fr 1.2fr 1fr 130px' }}>
        <div className="th">Parent / Lead</div>
        <div className="th">Converted Date</div>
        <div className="th c">Students</div>
        <div className="th">Classes</div>
        <div className="th">Officer</div>
        <div className="th c">Action</div>
      </div>
      {rows.length === 0 ? (
        <div className="crm-empty">
          <div className="crm-empty-ic"><i className="fa-solid fa-circle-check"></i></div>
          <div className="crm-empty-title">No confirmed admissions yet</div>
          <div className="crm-empty-sub">Confirm a lead from the Active Leads tab to see it here.</div>
        </div>
      ) : rows.map(r => (
        <div key={r.id} className="crm-inactive-row" style={{ gridTemplateColumns: '2fr 1.2fr 0.9fr 1.2fr 1fr 130px' }}>
          <div className="td">
            <div className="crm-avatar" style={{ background: 'rgba(22,163,74,.10)', color: '#16A34A' }}>{r.initials}</div>
            <div className="crm-name-cell">
              <div className="crm-name">{r.name}</div>
              <div className="crm-phone">{r.phone}</div>
            </div>
          </div>
          <div className="td">
            <span className="crm-conv-date"><i className="fa-solid fa-check"></i> {fmtFullDate(r.convertedDate)}</span>
          </div>
          <div className="td c crm-stu-count" style={{ color: '#15803D' }}>{r.students}</div>
          <div className="td">
            <span className="crm-class-pill">{r.classes}</span>
          </div>
          <div className="td crm-officer-cell">{r.officer}</div>
          <div className="td c crm-actions">
            <Tooltip text="Download admission report (A4 PDF)">
              <button className="crm-iconbtn crm-iconbtn--green" onClick={() => onDownload(r)}>
                <i className="fa-solid fa-download"></i>
              </button>
            </Tooltip>
            <Tooltip text="Reactivate — move back to Active Leads">
              <button className="crm-iconbtn" onClick={() => onReactivate(r)}>
                <i className="fa-solid fa-rotate-left"></i>
              </button>
            </Tooltip>
            <Tooltip text="Delete permanently">
              <button className="crm-iconbtn crm-iconbtn--danger" onClick={() => onDelete(r)}>
                <i className="fa-solid fa-trash"></i>
              </button>
            </Tooltip>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Not Interested table ─── */
function NotInterestedTable({ rows, onDownload, onReactivate, onDelete }) {
  return (
    <div className="fee-section">
      <div className="crm-inactive-head" style={{ gridTemplateColumns: '2fr 1.3fr 1.1fr 1fr 1fr 130px' }}>
        <div className="th">Parent / Lead</div>
        <div className="th">Reason</div>
        <div className="th">Last Follow-up</div>
        <div className="th">Classes</div>
        <div className="th">Officer</div>
        <div className="th c">Action</div>
      </div>
      {rows.length === 0 ? (
        <div className="crm-empty">
          <div className="crm-empty-ic"><i className="fa-solid fa-circle-xmark"></i></div>
          <div className="crm-empty-title">No not-interested leads</div>
          <div className="crm-empty-sub">Leads marked Not Interested from the Active inbox will appear here.</div>
        </div>
      ) : rows.map(r => (
        <div key={r.id} className="crm-inactive-row" style={{ gridTemplateColumns: '2fr 1.3fr 1.1fr 1fr 1fr 130px' }}>
          <div className="td">
            <div className="crm-avatar" style={{ background: 'rgba(220,38,38,.10)', color: '#DC2626' }}>{r.initials}</div>
            <div className="crm-name-cell">
              <div className="crm-name">{r.name}</div>
              <div className="crm-phone">{r.phone}</div>
            </div>
          </div>
          <div className="td">
            <span className="crm-reason-pill">
              <i className="fa-solid fa-tag"></i> {r.reason}
            </span>
          </div>
          <div className="td crm-officer-cell">{fmtFullDate(r.lastFu)}</div>
          <div className="td">
            <span className="crm-class-pill crm-class-pill--neutral">{r.classes}</span>
          </div>
          <div className="td crm-officer-cell">{r.officer}</div>
          <div className="td c crm-actions">
            <Tooltip text="Download rejection report (A4 PDF)">
              <button className="crm-iconbtn crm-iconbtn--red" onClick={() => onDownload(r)}>
                <i className="fa-solid fa-download"></i>
              </button>
            </Tooltip>
            <Tooltip text="Reactivate — move back to Active Leads">
              <button className="crm-iconbtn" onClick={() => onReactivate(r)}>
                <i className="fa-solid fa-rotate-left"></i>
              </button>
            </Tooltip>
            <Tooltip text="Delete permanently">
              <button className="crm-iconbtn crm-iconbtn--danger" onClick={() => onDelete(r)}>
                <i className="fa-solid fa-trash"></i>
              </button>
            </Tooltip>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ReactivateConfirmDialog and DeleteInactiveDialog were replaced by the
   shared CrmConfirmDialog (hero-ring pattern) — see the modal mounts
   inside <InactiveLeads />. */

/* ═══════════════════════════════════════════════════════════════════
   REPORTS TAB — date range filter + 4 colour-coded report cards.
   Each card: gradient header (icon + title + sub), KPI panel + body
   detail (bars / list / KPIs), Preview + Download PDF buttons.
   ═══════════════════════════════════════════════════════════════════ */

const REPORT_TYPES = [
  { id: 'summary',    icon: 'fa-users-between-lines', title: 'Lead Summary Report',     sub: 'Total leads, status breakdown, active vs inactive', accent: '#1E40AF', gradient: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' },
  { id: 'followup',   icon: 'fa-phone-flip',          title: 'Follow-up Report',        sub: 'Overdue, today, and upcoming follow-ups',          accent: '#7C3AED', gradient: 'linear-gradient(135deg,#7C3AED,#6D28D9)' },
  { id: 'conversion', icon: 'fa-user-check',          title: 'Conversion Report',       sub: 'Lead to admission conversion analysis',             accent: '#16A34A', gradient: 'linear-gradient(135deg,#15803D,#16A34A)' },
  { id: 'source',     icon: 'fa-share-nodes',         title: 'Source-wise Leads Report', sub: 'Which channels bring the most admissions',         accent: '#D97706', gradient: 'linear-gradient(135deg,#D97706,#B45309)' },
  { id: 'officer',    icon: 'fa-user-tie',            title: 'Officer Performance Report', sub: 'Per-agent leads, conversions & rates between two dates', accent: '#0891B2', gradient: 'linear-gradient(135deg,#0E7490,#0891B2)' },
];

/* Source breakdown — mirrors the HTML reference's source bars (totals
   + converted counts per channel, used by Source card + PDF table). */
const REPORT_SOURCE_BREAKDOWN = [
  { name: 'Facebook',        color: '#1877F2', total: 34, converted: 18, notInterested: 8, pending: 8 },
  { name: 'Walk-in',         color: '#16A34A', total: 28, converted: 16, notInterested: 4, pending: 8 },
  { name: 'WhatsApp',        color: '#25D366', total: 22, converted: 12, notInterested: 4, pending: 6 },
  { name: 'Instagram',       color: '#E1306C', total: 18, converted:  8, notInterested: 5, pending: 5 },
  { name: 'Reference',       color: '#7C3AED', total: 16, converted: 10, notInterested: 2, pending: 4 },
  { name: 'Google',          color: '#EA4335', total: 14, converted:  6, notInterested: 3, pending: 5 },
  { name: 'Campaign',        color: '#D97706', total: 10, converted:  3, notInterested: 3, pending: 4 },
  { name: 'Website',         color: '#0284C7', total:  5, converted:  2, notInterested: 1, pending: 2 },
];
const REPORT_RECENT_FOLLOWUPS = [
  { name: 'Ahmed Raza',    staff: 'Sarah Khan', date: '2026-05-26', tag: '' },
  { name: 'Sadia Khalid',  staff: 'Ahmed Raza', date: '2026-05-26', tag: '' },
  { name: 'Tariq Mehmood', staff: 'Sarah Khan', date: '2026-05-20', tag: 'Overdue' },
];

function CrmReports({ toast }) {
  const { data: school = {} }    = useAsync(crmService.getCrmSchool, {});
  const { data: officers = [] }  = useAsync(crmService.getCrmOfficers, []);
  const { data: leads = [] }     = useAsync(crmService.getCrmLeads, []);
  const { data: converted = [] } = useAsync(crmService.getCrmConverted, []);
  const { data: notInterested = [] } = useAsync(crmService.getCrmNotInterested, []);

  /* Filter bar — defaults: first day of current month → today (in fixed
     mock window). The HTML reference seeds 2026-05-01 → 2026-05-26. */
  const [from, setFrom] = useState('2026-05-01');
  const [to, setTo]     = useState('2026-05-26');
  /* Page-level Report Style toggle (Colorful / Colorless). Applies to
     every report card click — matches the pattern introduced in the
     Inventory module so admins get a consistent affordance everywhere. */
  const [style, setStyle] = useState('color'); // 'color' | 'bw'

  const setRange = (days) => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - days);
    const iso = (d) => d.toISOString().slice(0, 10);
    setFrom(iso(start));
    setTo(iso(today));
  };

  const rangeLabel = useMemo(() => {
    const f = new Date(from); const t = new Date(to);
    if (isNaN(f) || isNaN(t)) return '—';
    const sameYr = f.getFullYear() === t.getFullYear();
    const left = `${MONTHS_SHORT_CRM[f.getMonth()]} ${f.getDate()}${sameYr ? '' : `, ${f.getFullYear()}`}`;
    const right = `${MONTHS_SHORT_CRM[t.getMonth()]} ${t.getDate()}, ${t.getFullYear()}`;
    return `Showing: ${left} – ${right}`;
  }, [from, to]);

  /* Pre-computed KPIs that several cards share. */
  const totalLeads = leads.length + converted.length + notInterested.length;
  const overdue   = leads.filter(l => l.followup === 'overdue').length;
  const today     = leads.filter(l => l.followup === 'today').length;
  const tmrw      = leads.filter(l => l.followup === 'tmrw').length;
  const convCount = converted.length;
  const niCount   = notInterested.length;
  const convPct   = totalLeads === 0 ? 0 : Math.round(convCount / totalLeads * 1000) / 10;

  /* Officer performance — slice every dataset by the picked range. */
  const officerStats = useMemo(() => {
    const inRange = (iso) => !!iso && iso >= from && iso <= to;
    return officers.map(o => {
      const myActive    = leads.filter(l => l.officer === o.name && inRange(l.assignedDate));
      const myConverted = converted.filter(c => c.officer === o.name && inRange(c.convertedDate));
      const myNotInt    = notInterested.filter(n => n.officer === o.name && inRange(n.lastFu));
      const total = myActive.length + myConverted.length + myNotInt.length;
      const rate  = total === 0 ? 0 : Math.round(myConverted.length / total * 1000) / 10;
      return {
        ...o,
        assigned:      total,
        active:        myActive.length,
        converted:     myConverted.length,
        notInterested: myNotInt.length,
        rate,
      };
    });
  }, [officers, leads, converted, notInterested, from, to]);

  const topPerformer = officerStats.length === 0
    ? null
    : [...officerStats].sort((a, b) => b.converted - a.converted || b.rate - a.rate)[0];
  const teamConverted = officerStats.reduce((a, o) => a + o.converted, 0);
  const teamLeads     = officerStats.reduce((a, o) => a + o.assigned, 0);
  const teamRate      = teamLeads === 0 ? 0 : Math.round(teamConverted / teamLeads * 1000) / 10;

  /* PDF — open a popup with the chosen report. */
  const openReport = (type) => {
    const meta = REPORT_TYPES.find(r => r.id === type);
    const ctx = {
      from, to, fromLabel: fmtFullDate(from), toLabel: fmtFullDate(to),
      leads, converted, notInterested,
      totalLeads, overdue, today, tmrw, convCount, niCount, convPct,
      officerStats, topPerformer, teamConverted, teamLeads, teamRate,
    };
    const inner = buildCrmReportHTML(type, meta, school, ctx);
    openCrmReportWindow(meta.title, inner, toast, meta.accent, style === 'bw');
  };

  const onStyleKey = (e, value) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setStyle(value); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')   { e.preventDefault(); setStyle('color'); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw'); }
  };

  return (
    <>
      {/* Filter bar */}
      <div className="fee-section">
        <div className="rep-filterbar">
          <div className="rep-filter-fields">
            <div className="fee-field">
              <span className="fee-label">From</span>
              <input className="fee-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="rep-arrow"><i className="fa-solid fa-arrow-right"></i></div>
            <div className="fee-field">
              <span className="fee-label">To</span>
              <input className="fee-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="rep-presets">
            {[
              { label: 'Last 7 days',    days:  7 },
              { label: 'Last 30 days',   days: 30 },
              { label: 'Last 3 months',  days: 90 },
            ].map(p => (
              <button key={p.days} type="button" className="rep-preset" onClick={() => setRange(p.days)}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="rep-rangelbl"><i className="fa-solid fa-calendar"></i> {rangeLabel}</div>
          {/* Page-level Report Style toggle */}
          <div className="rep-style-row" role="radiogroup" aria-label="Report Style">
            <span className="rep-style-lbl">Report Style</span>
            <div className="rep-style-seg">
              <button
                type="button"
                className={`rep-style-btn${style === 'color' ? ' on' : ''}`}
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
                className={`rep-style-btn${style === 'bw' ? ' on' : ''}`}
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
        </div>
      </div>

      {/* 2×2 report card grid */}
      <div className="rep-grid">

        {/* Card 1 — Lead Summary (blue) */}
        <ReportCard meta={REPORT_TYPES[0]} onPreview={() => openReport('summary')} onDownload={() => openReport('summary')}>
          <div className="rep-kpi-grid rep-kpi-grid--3">
            <div className="rep-kpi" style={{ background: 'var(--bg-muted)' }}>
              <div className="rep-kpi-val" style={{ color: '#1E40AF' }}>{totalLeads}</div>
              <div className="rep-kpi-lbl">Total Leads</div>
            </div>
            <div className="rep-kpi" style={{ background: 'rgba(22,163,74,.06)' }}>
              <div className="rep-kpi-val" style={{ color: '#16A34A' }}>{convCount}</div>
              <div className="rep-kpi-lbl">Converted</div>
            </div>
            <div className="rep-kpi" style={{ background: 'rgba(220,38,38,.05)' }}>
              <div className="rep-kpi-val" style={{ color: '#DC2626' }}>{niCount}</div>
              <div className="rep-kpi-lbl">Not Interested</div>
            </div>
          </div>
          <div className="rep-bars">
            <SummaryBar label="Interested" pct={55} gradient="linear-gradient(90deg,#0284C7,#0369A1)" />
            <SummaryBar label="Confirmed"  pct={43} gradient="linear-gradient(90deg,#16A34A,#15803D)" />
            <SummaryBar label="Pending"    pct={23} gradient="linear-gradient(90deg,#D97706,#B45309)" />
          </div>
        </ReportCard>

        {/* Card 2 — Follow-up (purple) */}
        <ReportCard meta={REPORT_TYPES[1]} onPreview={() => openReport('followup')} onDownload={() => openReport('followup')}>
          <div className="rep-kpi-grid rep-kpi-grid--3">
            <div className="rep-kpi" style={{ background: 'rgba(220,38,38,.06)' }}>
              <div className="rep-kpi-val" style={{ color: '#DC2626' }}>{overdue}</div>
              <div className="rep-kpi-lbl">Overdue</div>
            </div>
            <div className="rep-kpi" style={{ background: 'rgba(217,119,6,.06)' }}>
              <div className="rep-kpi-val" style={{ color: '#D97706' }}>{today}</div>
              <div className="rep-kpi-lbl">Today</div>
            </div>
            <div className="rep-kpi" style={{ background: 'rgba(2,132,199,.06)' }}>
              <div className="rep-kpi-val" style={{ color: '#0284C7' }}>{tmrw}</div>
              <div className="rep-kpi-lbl">Tomorrow</div>
            </div>
          </div>
          <div className="rep-listlbl">Recent Follow-ups</div>
          <div className="rep-list">
            {REPORT_RECENT_FOLLOWUPS.map((f, i) => (
              <div key={i} className="rep-list-row">
                <div>
                  <div className="rep-list-name">{f.name}</div>
                  <div className="rep-list-sub">{f.staff}</div>
                </div>
                <div className="rep-list-meta" style={f.tag ? { color: '#D97706' } : {}}>
                  {fmtDayMonth(f.date)}{f.tag ? ` — ${f.tag}` : ''}
                </div>
              </div>
            ))}
          </div>
        </ReportCard>

        {/* Card 3 — Conversion (green) */}
        <ReportCard meta={REPORT_TYPES[2]} onPreview={() => openReport('conversion')} onDownload={() => openReport('conversion')}>
          <div className="rep-kpi-grid rep-kpi-grid--2">
            <div className="rep-kpi" style={{ background: 'rgba(22,163,74,.06)' }}>
              <div className="rep-kpi-val" style={{ color: '#16A34A' }}>{convPct.toFixed(1)}%</div>
              <div className="rep-kpi-lbl">Conversion Rate</div>
              <div className="rep-kpi-sub">{convCount} of {totalLeads} leads</div>
            </div>
            <div className="rep-kpi" style={{ background: 'rgba(30,58,138,.06)' }}>
              <div className="rep-kpi-val" style={{ color: '#1E40AF' }}>12</div>
              <div className="rep-kpi-lbl">Avg. Days to Convert</div>
              <div className="rep-kpi-sub">Days per lead</div>
            </div>
          </div>
          <div className="rep-listlbl">Recent Conversions</div>
          <div className="rep-list">
            {converted.slice(0, 3).map(c => (
              <div key={c.id} className="rep-list-row">
                <div>
                  <div className="rep-list-name">{c.name}</div>
                  <div className="rep-list-sub">{c.classes} · {c.officer}</div>
                </div>
                <div className="rep-list-meta" style={{ color: '#16A34A' }}>
                  <i className="fa-solid fa-check"></i> {fmtDayMonth(c.convertedDate)}
                </div>
              </div>
            ))}
          </div>
        </ReportCard>

        {/* Card 4 — Source-wise (orange) */}
        <ReportCard meta={REPORT_TYPES[3]} onPreview={() => openReport('source')} onDownload={() => openReport('source')}>
          <div className="rep-channels">
            {REPORT_SOURCE_BREAKDOWN.slice(0, 8).map(c => {
              const pct = c.total === 0 ? 0 : Math.round(c.converted / c.total * 100);
              return (
                <div key={c.name} className="rep-channel">
                  <div className="rep-channel-lbl">{c.name}</div>
                  <div className="rep-channel-bar">
                    <div className="rep-channel-fill" style={{ width: `${pct}%`, background: c.color }}></div>
                  </div>
                  <div className="rep-channel-meta">{c.converted}/{c.total} ({pct}%)</div>
                </div>
              );
            })}
          </div>
        </ReportCard>

        {/* Card 5 — Officer Performance (teal) — full width, respects from/to range */}
        <div className="rep-card-fullwrap">
          <ReportCard meta={REPORT_TYPES[4]} onPreview={() => openReport('officer')} onDownload={() => openReport('officer')}>
            <div className="rep-kpi-grid rep-kpi-grid--3">
              <div className="rep-kpi" style={{ background: 'rgba(8,145,178,.06)' }}>
                <div className="rep-kpi-val" style={{ color: '#0E7490' }}>{teamConverted}/{teamLeads}</div>
                <div className="rep-kpi-lbl">Team Conversions</div>
                <div className="rep-kpi-sub">{rangeLabel.replace('Showing: ', '')}</div>
              </div>
              <div className="rep-kpi" style={{ background: 'rgba(22,163,74,.06)' }}>
                <div className="rep-kpi-val" style={{ color: '#16A34A' }}>{teamRate.toFixed(1)}%</div>
                <div className="rep-kpi-lbl">Team Conversion Rate</div>
                <div className="rep-kpi-sub">across {officerStats.length} officer(s)</div>
              </div>
              <div className="rep-kpi" style={{ background: 'rgba(217,119,6,.06)' }}>
                <div className="rep-kpi-val" style={{ color: '#D97706' }}>{topPerformer ? topPerformer.name : '—'}</div>
                <div className="rep-kpi-lbl">Top Performer</div>
                <div className="rep-kpi-sub">{topPerformer ? `${topPerformer.converted} converted · ${topPerformer.rate}%` : 'No data in range'}</div>
              </div>
            </div>

            <div className="rep-listlbl">Per-officer breakdown</div>
            {officerStats.length === 0 ? (
              <div className="rep-officer-empty">No data for the selected range. Try widening the dates.</div>
            ) : (
              <div className="rep-officer-list">
                {[...officerStats].sort((a, b) => b.converted - a.converted || b.rate - a.rate).map((o, idx) => {
                  const isTop = idx === 0 && o.converted > 0;
                  return (
                    <div key={o.name} className={`rep-officer-row${isTop ? ' rep-officer-row--top' : ''}`}>
                      <div className="rep-officer-rank">{idx + 1}</div>
                      <div className="rep-officer-avatar" style={{ background: avatarBg(o.color), color: o.color }}>
                        {o.initials}
                        {isTop && <span className="rep-officer-crown"><i className="fa-solid fa-crown"></i></span>}
                      </div>
                      <div className="rep-officer-main">
                        <div className="rep-officer-name">{o.name}</div>
                        <div className="rep-officer-sub">
                          <span><b>{o.assigned}</b> assigned</span>
                          <span style={{ color: '#16A34A' }}>· <b>{o.converted}</b> converted</span>
                          <span style={{ color: '#DC2626' }}>· <b>{o.notInterested}</b> not interested</span>
                          <span style={{ color: '#1E40AF' }}>· <b>{o.active}</b> active</span>
                        </div>
                      </div>
                      <div className="rep-officer-meter">
                        <div className="rep-officer-meter-track">
                          <div className="rep-officer-meter-fill" style={{ width: `${o.rate}%`, background: o.color }} />
                        </div>
                        <div className="rep-officer-meter-val">{o.rate.toFixed(1)}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ReportCard>
        </div>

      </div>
    </>
  );
}

/* ─── Re-usable report card ─── */
function ReportCard({ meta, onPreview, onDownload, children }) {
  return (
    <div className="rep-card">
      <div className="rep-card-head" style={{ background: meta.gradient }}>
        <div className="rep-card-head-left">
          <div className="rep-card-ic"><i className={`fa-solid ${meta.icon}`}></i></div>
          <div>
            <div className="rep-card-title">{meta.title}</div>
            <div className="rep-card-sub">{meta.sub}</div>
          </div>
        </div>
        <div className="rep-card-head-actions">
          <Tooltip text="Preview in a new tab">
            <button type="button" className="rep-card-headbtn" onClick={onPreview} aria-label="Preview in a new tab">
              <i className="fa-solid fa-eye"></i>
            </button>
          </Tooltip>
        </div>
      </div>
      <div className="rep-card-body">{children}</div>
      <div className="rep-card-foot">
        <button className="fee-btn fee-btn-ghost fee-btn-sm" onClick={onPreview}>
          <i className="fa-solid fa-eye"></i> Preview
        </button>
        <button className="fee-btn fee-btn-primary fee-btn-sm acc-dlreport-btn" onClick={onDownload}>
          <i className="fa-solid fa-download"></i> Download PDF
        </button>
      </div>
    </div>
  );
}

/* ─── Lead Summary bar (Card 1) ─── */
function SummaryBar({ label, pct, gradient }) {
  return (
    <div className="rep-bar">
      <div className="rep-bar-lbl">{label}</div>
      <div className="rep-bar-track">
        <div className="rep-bar-fill" style={{ width: `${pct}%`, background: gradient }} />
      </div>
      <div className="rep-bar-val">{pct}%</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Report PDF builder — switches on type, produces A4-ready HTML.
   Uses the existing openCrmReportWindow shell with per-type accent.
   ═══════════════════════════════════════════════════════════════════ */
function buildCrmReportHTML(type, meta, school, ctx) {
  const head = `
    <div class="rhead" style="border-bottom-color:${meta.accent}">
      <div class="rlogo">${crmSchoolLogoSVG()}</div>
      <div style="flex:1">
        <div class="rname">${escHtml(school?.name || 'School')}</div>
        <div class="rtitle" style="color:${meta.accent}">${escHtml(meta.title)} · ${escHtml(meta.sub)}</div>
      </div>
      <div class="meta">
        <b>Date Range</b><br/>${escHtml(ctx.fromLabel)} – ${escHtml(ctx.toLabel)}<br/>
        <b>Generated</b> ${escHtml(fmtFullDate(todayCrmISO()))}
      </div>
    </div>`;

  if (type === 'summary') {
    const STATUS_ROWS = [
      { name: 'Interested',          count: 55, color: '#0284C7' },
      { name: 'Call Back Later',     count: 24, color: '#D97706' },
      { name: 'Visit Scheduled',     count: 18, color: '#7C3AED' },
      { name: 'Waiting Decision',    count: 16, color: '#64748B' },
      { name: 'Admission Confirmed', count: ctx.convCount, color: '#16A34A' },
      { name: 'Not Interested',      count: ctx.niCount,   color: '#DC2626' },
    ];
    const total = STATUS_ROWS.reduce((a, r) => a + r.count, 0);
    return `${head}
      <div class="kpi-row" style="grid-template-columns:repeat(5,1fr)">
        <div class="kpi a"><div class="l">Total Leads</div><div class="v">${total}</div></div>
        <div class="kpi b"><div class="l">Active</div><div class="v">${total - ctx.convCount - ctx.niCount}</div></div>
        <div class="kpi c"><div class="l">Converted</div><div class="v" style="color:#15803D">${ctx.convCount}</div></div>
        <div class="kpi d"><div class="l">Not Interested</div><div class="v" style="color:#B91C1C">${ctx.niCount}</div></div>
        <div class="kpi a"><div class="l">Pending</div><div class="v" style="color:#D97706">${Math.max(0, total - ctx.convCount - ctx.niCount - 18)}</div></div>
      </div>
      <div class="sec-band" style="background:${meta.accent}"><span>Status Breakdown</span><small>${STATUS_ROWS.length} statuses</small></div>
      <table class="tbl">
        <thead><tr><th>Status</th><th class="c" style="width:80px">Count</th><th class="r" style="width:80px">Share</th><th>Distribution</th></tr></thead>
        <tbody>${STATUS_ROWS.map(r => {
          const pct = total === 0 ? 0 : Math.round(r.count / total * 100);
          return `<tr>
            <td><b style="color:${r.color}">${escHtml(r.name)}</b></td>
            <td class="c">${r.count}</td>
            <td class="r">${pct}%</td>
            <td><div style="background:#F1F3F8;border-radius:999px;overflow:hidden;height:8px"><div style="width:${pct}%;height:100%;background:${r.color};border-radius:999px"></div></div></td>
          </tr>`;
        }).join('')}</tbody>
        <tfoot><tr><td class="r" style="font-weight:800">Total</td><td class="c" style="font-weight:800">${total}</td><td class="r" style="font-weight:800">100%</td><td></td></tr></tfoot>
      </table>
      ${crmReportFoot(school)}`;
  }

  if (type === 'followup') {
    const all = ctx.leads;
    return `${head}
      <div class="kpi-row" style="grid-template-columns:repeat(4,1fr)">
        <div class="kpi a"><div class="l">Total Leads</div><div class="v">${all.length}</div></div>
        <div class="kpi b"><div class="l">Overdue</div><div class="v" style="color:#B91C1C">${ctx.overdue}</div></div>
        <div class="kpi c"><div class="l">Today</div><div class="v" style="color:#B45309">${ctx.today}</div></div>
        <div class="kpi d"><div class="l">Tomorrow</div><div class="v" style="color:#0369A1">${ctx.tmrw}</div></div>
      </div>
      <div class="sec-band" style="background:${meta.accent}"><span>Lead Follow-up Schedule</span><small>${all.length} active lead(s)</small></div>
      <table class="tbl">
        <thead><tr><th>#</th><th>Parent</th><th>Phone</th><th>Officer</th><th>Next FU</th><th class="c">Urgency</th><th>Status</th></tr></thead>
        <tbody>${all.slice(0, 15).map((l, i) => `
          <tr>
            <td class="c">${i + 1}</td>
            <td><b>${escHtml(l.name)}</b></td>
            <td>${escHtml(l.phone)}</td>
            <td>${escHtml(l.officer)}</td>
            <td>${escHtml(fmtFullDate(l.nextFu))}</td>
            <td class="c"><span class="tag s-${l.followup === 'overdue' ? 'notinterested' : l.followup === 'today' ? 'callback' : l.followup === 'tmrw' ? 'visit' : 'waiting'}">${(l.followup || 'normal').toUpperCase()}</span></td>
            <td>${escHtml(l.status)}</td>
          </tr>`).join('') || '<tr><td colspan="7" class="empty-state">No active leads in this range.</td></tr>'}</tbody>
      </table>
      ${crmReportFoot(school)}`;
  }

  if (type === 'conversion') {
    return `${head}
      <div class="kpi-row" style="grid-template-columns:repeat(4,1fr)">
        <div class="kpi a"><div class="l">Total Leads</div><div class="v">${ctx.totalLeads}</div></div>
        <div class="kpi c"><div class="l">Converted</div><div class="v" style="color:#15803D">${ctx.convCount}</div></div>
        <div class="kpi b"><div class="l">Conversion Rate</div><div class="v" style="color:#1E40AF">${ctx.convPct.toFixed(1)}%</div></div>
        <div class="kpi d"><div class="l">Avg. Days</div><div class="v" style="color:#7C3AED">12</div></div>
      </div>
      <div class="sec-band" style="background:${meta.accent}"><span>Confirmed Admissions</span><small>${ctx.converted.length} lead(s)</small></div>
      <table class="tbl">
        <thead><tr><th class="c" style="width:28px">#</th><th>Parent Name</th><th>Classes</th><th class="c" style="width:60px">Students</th><th>Officer</th><th>Source</th><th>Converted Date</th></tr></thead>
        <tbody>${ctx.converted.length === 0
          ? '<tr><td colspan="7" class="empty-state">No conversions in this range.</td></tr>'
          : ctx.converted.map((c, i) => `
            <tr>
              <td class="c">${i + 1}</td>
              <td><b>${escHtml(c.name)}</b></td>
              <td>${escHtml(c.classes)}</td>
              <td class="c">${c.students}</td>
              <td>${escHtml(c.officer)}</td>
              <td>${escHtml(c.source)}</td>
              <td style="color:#15803D;font-weight:700">${escHtml(fmtFullDate(c.convertedDate))}</td>
            </tr>`).join('')}</tbody>
      </table>
      ${crmReportFoot(school)}`;
  }

  if (type === 'source') {
    const totals = REPORT_SOURCE_BREAKDOWN.reduce((a, c) => ({
      total: a.total + c.total, converted: a.converted + c.converted,
      notInterested: a.notInterested + c.notInterested, pending: a.pending + c.pending,
    }), { total: 0, converted: 0, notInterested: 0, pending: 0 });
    return `${head}
      <div class="kpi-row" style="grid-template-columns:repeat(4,1fr)">
        <div class="kpi a"><div class="l">Total Leads</div><div class="v">${totals.total}</div></div>
        <div class="kpi c"><div class="l">Converted</div><div class="v" style="color:#15803D">${totals.converted}</div></div>
        <div class="kpi d"><div class="l">Not Interested</div><div class="v" style="color:#B91C1C">${totals.notInterested}</div></div>
        <div class="kpi b"><div class="l">Pending</div><div class="v" style="color:#B45309">${totals.pending}</div></div>
      </div>
      <div class="sec-band" style="background:${meta.accent}"><span>Source Breakdown</span><small>${REPORT_SOURCE_BREAKDOWN.length} channels</small></div>
      <table class="tbl">
        <thead><tr><th>Source</th><th class="c">Total</th><th class="c">Converted</th><th class="c">Not Interested</th><th class="c">Pending</th><th class="r">Conv. Rate</th><th class="r">Share</th></tr></thead>
        <tbody>${REPORT_SOURCE_BREAKDOWN.map(c => {
          const cr  = c.total === 0 ? 0 : Math.round(c.converted / c.total * 100);
          const sh  = totals.total === 0 ? 0 : Math.round(c.total / totals.total * 100);
          return `<tr>
            <td><b style="color:${c.color}">● ${escHtml(c.name)}</b></td>
            <td class="c">${c.total}</td>
            <td class="c" style="color:#15803D;font-weight:700">${c.converted}</td>
            <td class="c" style="color:#B91C1C">${c.notInterested}</td>
            <td class="c" style="color:#B45309">${c.pending}</td>
            <td class="r"><b>${cr}%</b></td>
            <td class="r">${sh}%</td>
          </tr>`;
        }).join('')}</tbody>
        <tfoot><tr>
          <td class="r" style="font-weight:800">Total</td>
          <td class="c" style="font-weight:800">${totals.total}</td>
          <td class="c" style="font-weight:800;color:#15803D">${totals.converted}</td>
          <td class="c" style="font-weight:800;color:#B91C1C">${totals.notInterested}</td>
          <td class="c" style="font-weight:800;color:#B45309">${totals.pending}</td>
          <td class="r" style="font-weight:800">${totals.total === 0 ? 0 : Math.round(totals.converted / totals.total * 100)}%</td>
          <td class="r" style="font-weight:800">100%</td>
        </tr></tfoot>
      </table>
      ${crmReportFoot(school)}`;
  }

  if (type === 'officer') {
    const sorted = [...ctx.officerStats].sort((a, b) => b.converted - a.converted || b.rate - a.rate);
    const totalAssigned  = ctx.teamLeads;
    const totalConverted = ctx.teamConverted;
    const totalNi        = sorted.reduce((a, o) => a + o.notInterested, 0);
    const totalActive    = sorted.reduce((a, o) => a + o.active, 0);
    const top = ctx.topPerformer;
    return `${head}
      <div class="kpi-row" style="grid-template-columns:repeat(4,1fr)">
        <div class="kpi a"><div class="l">Officers</div><div class="v">${sorted.length}</div><div class="m">on the team</div></div>
        <div class="kpi b"><div class="l">Team Leads</div><div class="v">${totalAssigned}</div><div class="m">in selected range</div></div>
        <div class="kpi c"><div class="l">Team Conversions</div><div class="v" style="color:#15803D">${totalConverted}</div><div class="m">${ctx.teamRate.toFixed(1)}% conversion rate</div></div>
        <div class="kpi d"><div class="l">Top Performer</div><div class="v" style="color:#0E7490;font-size:13px">${top ? escHtml(top.name) : '—'}</div><div class="m">${top ? `${top.converted} converted · ${top.rate.toFixed(1)}%` : 'No data'}</div></div>
      </div>

      <div class="sec-band" style="background:${meta.accent}"><span>Officer Performance</span><small>${escHtml(ctx.fromLabel)} – ${escHtml(ctx.toLabel)}</small></div>
      <table class="tbl">
        <thead><tr>
          <th class="c" style="width:28px">#</th>
          <th>Officer</th>
          <th class="c" style="width:70px">Assigned</th>
          <th class="c" style="width:80px">Converted</th>
          <th class="c" style="width:90px">Not Interested</th>
          <th class="c" style="width:60px">Active</th>
          <th class="r" style="width:90px">Conv. Rate</th>
          <th class="r" style="width:80px">Share</th>
        </tr></thead>
        <tbody>${sorted.length === 0
          ? '<tr><td colspan="8" class="empty-state">No officer data for the selected date range.</td></tr>'
          : sorted.map((o, i) => {
            const share = totalConverted === 0 ? 0 : Math.round(o.converted / totalConverted * 100);
            return `<tr>
              <td class="c">${i + 1}</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  <div style="width:26px;height:26px;border-radius:8px;background:${o.color}1F;color:${o.color};display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:800">${escHtml(o.initials)}</div>
                  <b>${escHtml(o.name)}</b>${i === 0 && o.converted > 0 ? ' <span style="font-size:10px;color:#D97706;font-weight:800">★ TOP</span>' : ''}
                </div>
              </td>
              <td class="c">${o.assigned}</td>
              <td class="c" style="color:#15803D;font-weight:800">${o.converted}</td>
              <td class="c" style="color:#B91C1C">${o.notInterested}</td>
              <td class="c" style="color:#1E40AF">${o.active}</td>
              <td class="r">
                <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">
                  <div style="flex:1;max-width:60px;background:#F1F3F8;border-radius:999px;overflow:hidden;height:6px">
                    <div style="width:${o.rate}%;height:100%;background:${o.color};border-radius:999px"></div>
                  </div>
                  <b>${o.rate.toFixed(1)}%</b>
                </div>
              </td>
              <td class="r">${share}%</td>
            </tr>`;
          }).join('')}</tbody>
        <tfoot><tr>
          <td colspan="2" class="r" style="font-weight:800">Team Totals</td>
          <td class="c" style="font-weight:800">${totalAssigned}</td>
          <td class="c" style="font-weight:800;color:#15803D">${totalConverted}</td>
          <td class="c" style="font-weight:800;color:#B91C1C">${totalNi}</td>
          <td class="c" style="font-weight:800;color:#1E40AF">${totalActive}</td>
          <td class="r" style="font-weight:800">${ctx.teamRate.toFixed(1)}%</td>
          <td class="r" style="font-weight:800">100%</td>
        </tr></tfoot>
      </table>

      <div class="callout" style="background:${meta.accent}10;border-color:${meta.accent}33">
        <b style="color:${meta.accent}">Calculation:</b> conversion rate per officer is computed as
        <code>converted ÷ (active + converted + not-interested)</code>.
        Only leads whose <b>Assigned</b>, <b>Converted</b> or <b>Last Follow-up</b> date falls inside the selected range are counted.
      </div>

      ${crmReportFoot(school)}`;
  }

  return `${head}<div class="empty-state">No content.</div>${crmReportFoot(school)}`;
}

/* ─── Coming Soon placeholder used for every not-yet-built screen ──── */
function CrmComingSoon({ label, icon }) {
  return (
    <div className="fee-section">
      <div className="fee-section-body">
        <div className="crm-coming">
          <div className="crm-coming-ic">
            <i className={`fa-solid ${icon}`}></i>
          </div>
          <div className="crm-coming-title">{label}</div>
          <div className="crm-coming-sub">
            This screen is being implemented step-by-step from the design reference.
            <br />Stay tuned — it will land in an upcoming step.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STYLES — page header / tutorial chip / sub-tab pill row live in
   App.js globally, so we only ship CRM-specific primitives plus the
   Coming Soon placeholder.
   ═══════════════════════════════════════════════════════════════════ */
const CRM_CSS = `
/* Sub-tabs (shared with Fee/Accounts/Inventory — stretched across the row) */
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
.crm-coming {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 38px 20px;
  gap: 16px;
}
.crm-coming-ic {
  width: 64px; height: 64px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(30,58,138,.08), rgba(124,58,237,.08));
  border: 1.5px dashed rgba(30,58,138,.32);
  color: #1E3A8A;
  display: flex; align-items: center; justify-content: center;
  font-size: 26px;
}
.crm-coming-title {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -.01em;
}
.crm-coming-sub {
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.7;
  max-width: 480px;
}

/* ═══════════════════════════════════════════════════════════════════
   Shared primitives (.fee-section--filters, .fee-field, .fee-input,
   .fee-select, .fee-search-box, .fee-btn) duplicated from Inventory.
   ═══════════════════════════════════════════════════════════════════ */
.fee-section--filters { margin-bottom: 14px; overflow: visible; }
.fee-section--filters .fee-section-body { overflow: visible; }

.fee-btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 7px;
  padding: 10px 18px;
  border-radius: 10px;
  border: 1.5px solid transparent;
  font-family: var(--font-body);
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all .2s ease;
  white-space: nowrap;
  background: var(--bg-card);
  color: var(--text-secondary);
}
.fee-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(15,23,42,.08); }
.fee-btn-primary {
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 6px 16px rgba(30,58,138,.28);
}
.fee-btn-primary:hover { box-shadow: 0 8px 20px rgba(30,58,138,.36); }
.fee-btn-ghost {
  background: var(--bg-card);
  border-color: var(--border-light);
  color: var(--text-secondary);
}
.fee-btn-ghost:hover { border-color: var(--border-med); background: var(--bg-muted); }
.fee-btn-sm { padding: 8px 14px; font-size: 12px; }

.fee-field { display: flex; flex-direction: column; gap: 6px; min-width: 160px; }
.fee-field--grow { flex: 1; min-width: 240px; }
.fee-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: var(--text-muted); }
.fee-input {
  height: 40px;
  padding: 0 14px;
  border: 1.5px solid var(--border-light);
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 13px;
  font-family: var(--font-body);
  transition: border-color .15s ease, box-shadow .15s ease;
  width: 100%;
}
.fee-input:focus { outline: none; border-color: #1E3A8A; box-shadow: 0 0 0 3px rgba(30,58,138,.12); }
.fee-select-wrap { position: relative; }
.fee-select {
  appearance: none;
  height: 40px;
  width: 100%;
  padding: 0 36px 0 14px;
  border: 1.5px solid var(--border-light);
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 13px;
  font-family: var(--font-body);
  cursor: pointer;
}
.fee-select:focus { outline: none; border-color: #1E3A8A; box-shadow: 0 0 0 3px rgba(30,58,138,.12); }
.fee-select-wrap i { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 11px; pointer-events: none; }
.fee-search-box {
  position: relative;
  display: flex; align-items: center;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 10px;
  height: 40px;
  padding: 0 14px;
  gap: 9px;
  transition: border-color .15s ease, box-shadow .15s ease;
}
.fee-search-box:focus-within { border-color: #1E3A8A; box-shadow: 0 0 0 3px rgba(30,58,138,.12); }
.fee-search-box > i { color: var(--text-muted); font-size: 13px; }
.fee-search-box input {
  flex: 1; border: none; outline: none; background: transparent;
  font-size: 13px; color: var(--text-primary); font-family: var(--font-body);
}
.fee-search-clear {
  width: 22px; height: 22px;
  border: none; background: var(--bg-muted);
  border-radius: 50%;
  color: var(--text-muted);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.fee-search-clear:hover { background: rgba(220,38,38,.12); color: #DC2626; }

/* ═══════════════════════════════════════════════════════════════════
   ACTIVE LEADS — KPI row (1 total + 3 alerts), filter toolbar,
   leads table with avatars, inline status/officer dropdowns and
   expandable detail panel with notes timeline + action row.
   ═══════════════════════════════════════════════════════════════════ */

/* Top stats row (Total + Confirmed) */
.crm-top-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}
@media (max-width: 700px) { .crm-top-stats { grid-template-columns: 1fr; } }

/* Status filter cards strip — one per active status */
.crm-status-strip {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}
@media (max-width: 1100px) { .crm-status-strip { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 600px)  { .crm-status-strip { grid-template-columns: repeat(2, 1fr); } }

.crm-status-card {
  position: relative;
  padding: 12px 14px;
  background: color-mix(in srgb, var(--sc) 5%, var(--bg-card));
  border: 1.5px solid color-mix(in srgb, var(--sc) 22%, transparent);
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  font-family: var(--font-body);
  transition: all .2s ease;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.crm-status-card:hover {
  transform: translateY(-2px);
  border-color: var(--sc);
  box-shadow: 0 8px 20px color-mix(in srgb, var(--sc) 18%, transparent);
}
.crm-status-card.active {
  border-width: 2px;
  border-color: var(--sc);
  background: color-mix(in srgb, var(--sc) 10%, var(--bg-card));
  box-shadow: 0 8px 22px color-mix(in srgb, var(--sc) 26%, transparent);
}
.crm-status-card.dim { opacity: .55; }
.crm-status-card-top {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 4px;
}
.crm-status-card-ic {
  width: 28px; height: 28px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--sc) 18%, transparent);
  color: var(--sc);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px;
}
.crm-status-card-val {
  font-size: 22px;
  font-weight: 800;
  color: var(--sc);
  letter-spacing: -.02em;
  line-height: 1;
}
.crm-status-card-lbl { font-size: 11.5px; font-weight: 700; color: var(--sc); }
.crm-status-card-helper { font-size: 10px; color: var(--text-muted); margin-top: 1px; display: inline-flex; align-items: center; gap: 4px; }
.crm-status-card-helper i { font-size: 9px; }

/* Follow-up alert grid */
.crm-fu-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
@media (max-width: 700px) { .crm-fu-grid { grid-template-columns: 1fr; } }

.crm-stat-card {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 18px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 16px;
  cursor: pointer;
  text-align: left;
  font-family: var(--font-body);
  transition: all .2s ease;
  box-shadow: 0 1px 2px rgba(15,23,42,.04);
}
.crm-stat-card:hover { transform: translateY(-2px); border-color: #1E3A8A; box-shadow: 0 10px 24px rgba(15,23,42,.08); }
.crm-stat-card.active { border-color: #1E3A8A; background: linear-gradient(135deg, rgba(30,58,138,.05), transparent); box-shadow: 0 8px 20px rgba(30,58,138,.16); }
.crm-stat-ic {
  width: 50px; height: 50px;
  border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}
.crm-stat-body { flex: 1; min-width: 0; }
.crm-stat-val { font-size: 24px; font-weight: 800; color: var(--text-primary); letter-spacing: -.02em; line-height: 1.05; }
.crm-stat-lbl { font-size: 12.5px; color: var(--text-muted); font-weight: 700; margin-top: 3px; }
.crm-stat-delta { font-size: 11px; color: #16A34A; font-weight: 700; margin-top: 4px; display: inline-flex; align-items: center; gap: 5px; }
.crm-stat-delta i { font-size: 10px; }

/* Follow-up alert card variants */
.crm-fu-card {
  position: relative;
  display: flex; align-items: center; gap: 14px;
  padding: 16px 18px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 16px;
  cursor: pointer;
  text-align: left;
  font-family: var(--font-body);
  transition: all .2s ease;
  box-shadow: 0 1px 2px rgba(15,23,42,.04);
}
.crm-fu-card::before {
  content: '';
  position: absolute; left: 0; top: 0; bottom: 0;
  width: 4px; background: var(--fu-c);
  border-radius: 16px 0 0 16px;
}
.crm-fu-card:hover {
  transform: translateY(-2px);
  border-color: var(--fu-c);
  box-shadow: 0 10px 24px rgba(15,23,42,.08);
}
.crm-fu-card.active {
  border-color: var(--fu-c);
  background: color-mix(in srgb, var(--fu-c) 8%, var(--bg-card));
  box-shadow: 0 8px 22px color-mix(in srgb, var(--fu-c) 22%, transparent);
}
.crm-fu-card.dim { opacity: .55; }
.crm-fu-ic {
  width: 50px; height: 50px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--fu-c) 12%, transparent);
  color: var(--fu-c);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}
.crm-fu-body { flex: 1; min-width: 0; }
.crm-fu-val { font-size: 24px; font-weight: 800; color: var(--text-primary); letter-spacing: -.02em; line-height: 1.05; }
.crm-fu-lbl { font-size: 12.5px; color: var(--text-muted); font-weight: 700; margin-top: 3px; }
.crm-fu-helper { font-size: 11px; color: var(--text-muted); margin-top: 4px; line-height: 1.4; }
.crm-fu-check {
  position: absolute; top: 10px; right: 12px;
  width: 22px; height: 22px;
  border-radius: 50%;
  background: var(--fu-c);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px;
}

/* Toolbar (filter row) */
.crm-toolbar {
  display: flex; gap: 12px; align-items: flex-end;
  flex-wrap: wrap;
}

/* Active-filter chip strip */
.crm-active-filters {
  display: flex; align-items: center; gap: 9px;
  flex-wrap: wrap;
  margin-top: 14px;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(30,58,138,.04);
  border: 1px solid rgba(30,58,138,.16);
  font-size: 12px;
  color: var(--text-secondary);
}
.crm-active-filters > i { color: #1E3A8A; }
.crm-active-filters strong { color: var(--text-primary); font-weight: 800; }
.crm-active-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 10px 3px 12px;
  border-radius: 999px;
  background: var(--bg-card);
  border: 1px solid var(--border-med);
  color: var(--text-primary);
  font-weight: 700;
  font-size: 11.5px;
}
.crm-active-chip button {
  width: 16px; height: 16px;
  border: none; background: transparent;
  border-radius: 50%;
  color: inherit;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}
.crm-active-chip button:hover { background: rgba(15,23,42,.08); }
.crm-clear-all {
  margin-left: auto;
  border: none;
  background: transparent;
  color: #DC2626;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}
.crm-clear-all:hover { background: rgba(220,38,38,.08); }

/* Table head */
.crm-table-head {
  display: grid;
  grid-template-columns: 1.8fr 1.1fr 60px 1.3fr 1.5fr 1fr 110px;
  gap: 12px;
  padding: 14px 18px;
  background: var(--bg-muted);
  border-bottom: 1.5px solid var(--border-light);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .4px;
  color: var(--text-muted);
}
.crm-table-head .th.c { text-align: center; }
@media (max-width: 1000px) {
  .crm-table-head { grid-template-columns: 1.8fr 55px 1.3fr 1.5fr 1fr 110px; }
  .crm-table-head .th:nth-child(2) { display: none; }
}
@media (max-width: 720px) {
  .crm-table-head,
  .crm-row { min-width: 720px; }
  .fee-section { overflow-x: auto; -webkit-overflow-scrolling: touch; }
}

/* Row wrapper + row */
.crm-row-wrap {
  border-bottom: 1px solid var(--border-light);
}
.crm-row-wrap:last-child { border-bottom: none; }
.crm-row {
  display: grid;
  grid-template-columns: 1.8fr 1.1fr 60px 1.3fr 1.5fr 1fr 110px;
  gap: 12px;
  padding: 14px 18px;
  cursor: pointer;
  transition: background .15s ease;
  align-items: center;
  min-height: 70px;
}
.crm-row:hover { background: rgba(30,58,138,.04); }
.crm-row-wrap.open .crm-row { background: rgba(30,58,138,.06); }
.crm-row .td { display: flex; align-items: center; gap: 10px; min-width: 0; }
.crm-row .td.c { justify-content: center; }
@media (max-width: 1000px) {
  .crm-row { grid-template-columns: 1.8fr 55px 1.3fr 1.5fr 1fr 110px; }
  .crm-row .td.crm-phone { display: none; }
}

/* Parent name + avatar cell */
.crm-avatar {
  width: 40px; height: 40px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 13.5px;
  font-weight: 800;
  letter-spacing: .3px;
  flex-shrink: 0;
}
.crm-name-cell { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
.crm-name-top { display: flex; align-items: center; gap: 6px; min-width: 0; }
.crm-name {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 1;
}
.crm-fu-tag {
  font-size: 9px;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 99px;
  border: 1px solid;
  flex-shrink: 0;
  letter-spacing: .3px;
}
.crm-next-fu {
  font-size: 11.5px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.crm-next-fu i { font-size: 9px; }
.crm-phone { font-size: 12px; color: var(--text-muted); font-variant-numeric: tabular-nums; }
.crm-stu-count { font-weight: 800; color: var(--brand-primary); font-size: 14px; }

/* Inline picker (officer + status) */
.crm-inline-pick {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
  max-width: 100%;
}
.crm-officer-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 130px;
}
.crm-chevbtn {
  border: none;
  background: var(--bg-muted);
  width: 22px; height: 22px;
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px;
  flex-shrink: 0;
  transition: all .15s ease;
}
.crm-chevbtn:hover { background: var(--brand-primary); color: #fff; }

/* Inline status badge */
.crm-status {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid;
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
  letter-spacing: .2px;
}
.crm-status.status-interested    { background: rgba(2,132,199,.10);   color: #0284C7; border-color: rgba(2,132,199,.28); }
.crm-status.status-callback      { background: rgba(217,119,6,.10);   color: #D97706; border-color: rgba(217,119,6,.28); }
.crm-status.status-visit         { background: rgba(124,58,237,.10);  color: #7C3AED; border-color: rgba(124,58,237,.28); }
.crm-status.status-waiting       { background: rgba(100,116,139,.10); color: #475569; border-color: rgba(100,116,139,.28); }
.crm-status.status-confirmed     { background: rgba(22,163,74,.12);   color: #15803D; border-color: rgba(22,163,74,.28); }
.crm-status.status-notinterested { background: rgba(220,38,38,.10);   color: #B91C1C; border-color: rgba(220,38,38,.28); }
.crm-status i { font-size: 5px; }

/* Source pill */
.crm-source {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}
.crm-source i { font-size: 10px; }
.crm-source-plain { font-size: 11.5px; color: var(--text-muted); font-weight: 600; }

/* Dropdown menus (status / officer / 3-dots) */
.crm-dd-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 50;
  min-width: 180px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  box-shadow: 0 18px 40px rgba(15,23,42,.18);
  padding: 5px;
  display: flex;
  flex-direction: column;
}
.crm-dd-menu--actions { right: 0; left: auto; min-width: 220px; }
.crm-dd-item {
  display: flex; align-items: center; gap: 9px;
  padding: 9px 11px;
  border: none;
  background: transparent;
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition: background .12s ease;
  font-family: var(--font-body);
}
.crm-dd-item:hover { background: var(--bg-muted); }
.crm-dd-item.selected { background: rgba(30,58,138,.08); color: #1E3A8A; font-weight: 800; }
.crm-dd-item i { font-size: 12px; width: 14px; text-align: center; }
.crm-dd-avatar {
  width: 22px; height: 22px;
  border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px;
  font-weight: 800;
}
.crm-dd-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }

/* Action area in row (download + 3dots + chevron) */
.crm-actions { gap: 5px !important; justify-content: flex-end !important; position: relative; overflow: visible; }
.crm-3dots-wrap { position: relative; }
.crm-iconbtn {
  width: 30px; height: 30px;
  border-radius: 8px;
  border: 1.5px solid var(--border-light);
  background: var(--bg-card);
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: all .15s ease;
}
.crm-iconbtn:hover { background: #1E3A8A; color: #fff; border-color: #1E3A8A; }
.crm-expand-btn i { transition: transform .25s ease; }
.crm-expand-btn .rot { transform: rotate(180deg); }

/* Expanded detail panel */
.crm-detail { max-height: 0; overflow: hidden; transition: max-height .35s cubic-bezier(.4,0,.2,1); border-top: 1px solid var(--border-light); }
.crm-detail.open { max-height: 2400px; }
.crm-detail-inner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 18px 22px 22px;
  background: linear-gradient(135deg, rgba(30,58,138,.025), transparent 60%);
}
@media (max-width: 880px) { .crm-detail-inner { grid-template-columns: 1fr; } }

.crm-detail-block {
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 14px;
  padding: 14px 16px;
}
.crm-detail-block-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}
.crm-detail-block-title {
  font-size: 12.5px;
  font-weight: 800;
  letter-spacing: .3px;
  text-transform: uppercase;
  color: var(--text-secondary);
  display: inline-flex; align-items: center; gap: 8px;
}
.crm-detail-block-title i { color: #1E3A8A; }
.crm-detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 14px;
}
.crm-detail-field { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.crm-detail-field--full { grid-column: 1 / -1; }
.crm-detail-lbl {
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .4px;
  color: var(--text-muted);
}
.crm-detail-val { font-size: 12.5px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.crm-locked-chip {
  display: inline-flex; align-items: center; justify-content: center;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: var(--bg-muted);
  border: 1px solid var(--border-light);
  color: var(--text-muted);
  font-size: 8px;
}

/* Notes timeline */
.crm-notes {
  display: flex; flex-direction: column;
  gap: 14px;
  position: relative;
  padding-left: 22px;
  max-height: 320px;
  overflow-y: auto;
}
.crm-notes::before {
  content: '';
  position: absolute;
  left: 11px; top: 4px; bottom: 4px;
  width: 2px;
  background: linear-gradient(180deg, #1E3A8A, #2563EB);
  border-radius: 999px;
  opacity: .25;
}
.crm-note { position: relative; }
.crm-note-dot {
  position: absolute; left: -22px; top: 0;
  width: 24px; height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1E3A8A, #2563EB);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px;
  box-shadow: 0 4px 10px rgba(30,58,138,.32);
  border: 3px solid var(--bg-card);
}
.crm-note-body {
  background: var(--bg-muted);
  border: 1px solid var(--border-light);
  border-radius: 11px;
  padding: 10px 12px;
}
.crm-note-meta {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 600;
}
.crm-note-staff { color: #1E3A8A; font-weight: 800; }
.crm-note-text {
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--text-primary);
  line-height: 1.55;
  font-weight: 500;
}
.crm-note-chip {
  margin-top: 8px;
  display: inline-flex;
  align-items: center; gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(30,58,138,.08);
  color: #1E3A8A;
  border: 1px solid rgba(30,58,138,.18);
  font-size: 11px;
  font-weight: 700;
}
.crm-note-chip i { font-size: 10px; }
.crm-notes-empty {
  text-align: center;
  padding: 24px 10px;
  color: var(--text-muted);
  font-size: 12.5px;
  font-style: italic;
}

/* Action row */
.crm-actions-row {
  display: flex; flex-wrap: wrap; gap: 8px;
  padding-top: 4px;
  grid-column: 1 / -1;
}
.crm-act-btn {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 14px;
  border-radius: 10px;
  border: 1.5px solid;
  background: var(--bg-card);
  font-family: var(--font-body);
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
  transition: all .15s ease;
  white-space: nowrap;
}
.crm-act-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(15,23,42,.10); }
.crm-act-edit       { color: var(--text-muted); border-color: var(--border-light); }
.crm-act-edit:hover { color: var(--text-primary); border-color: var(--border-med); }
.crm-act-followup   { color: #0284C7; border-color: rgba(2,132,199,.32); background: rgba(2,132,199,.04); }
.crm-act-share      { color: #7C3AED; border-color: rgba(124,58,237,.32); background: rgba(124,58,237,.04); }
.crm-act-form       { color: #D97706; border-color: rgba(217,119,6,.32); background: rgba(217,119,6,.04); }
.crm-act-confirm    { color: #16A34A; border-color: rgba(22,163,74,.32); background: rgba(22,163,74,.04); }
.crm-act-notinterest{ color: #DC2626; border-color: rgba(220,38,38,.32); background: rgba(220,38,38,.04); }

/* Empty state */
.crm-empty {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  gap: 12px;
  padding: 44px 20px;
}
.crm-empty-ic {
  width: 64px; height: 64px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(30,58,138,.08), rgba(124,58,237,.08));
  border: 1.5px dashed rgba(30,58,138,.32);
  color: #1E3A8A;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px;
}
.crm-empty-title { font-size: 15px; font-weight: 800; color: var(--text-primary); }
.crm-empty-sub { font-size: 12.5px; color: var(--text-muted); max-width: 380px; line-height: 1.6; }

/* ═══════════════════════════════════════════════════════════════════
   Search typeahead dropdown (Fee-module style)
   ═══════════════════════════════════════════════════════════════════ */
.fee-search-results {
  position: absolute;
  top: calc(100% + 6px);
  left: 0; right: 0;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  box-shadow: 0 18px 40px rgba(15,23,42,.18);
  z-index: 50;
  max-height: 360px;
  overflow-y: auto;
  display: none;
}
.fee-search-results.open { display: block; }
.fee-sr-item {
  display: flex; align-items: center; gap: 12px;
  width: 100%;
  padding: 11px 14px;
  border: none;
  background: transparent;
  text-align: left;
  border-bottom: 1px solid var(--border-light);
  cursor: pointer;
  transition: background .15s ease;
  font-family: var(--font-body);
}
.fee-sr-item:last-child { border-bottom: none; }
.fee-sr-item:hover { background: rgba(30,58,138,.05); }
.fee-sr-av {
  width: 36px; height: 36px;
  border-radius: 11px;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
}
.fee-sr-main { flex: 1; min-width: 0; }
.fee-sr-name { font-size: 13px; font-weight: 800; color: var(--text-primary); letter-spacing: -.01em; }
.fee-sr-meta { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 11px; color: var(--text-muted); margin-top: 3px; }
.fee-sr-meta b { color: var(--text-secondary); font-weight: 700; }
.fee-sr-go {
  width: 26px; height: 26px;
  border-radius: 8px;
  background: var(--bg-muted);
  color: var(--brand-primary);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px;
  flex-shrink: 0;
  transition: all .15s ease;
}
.fee-sr-item:hover .fee-sr-go { background: var(--brand-primary); color: #fff; transform: translateX(2px); }
.fee-sr-empty { padding: 16px 14px; color: var(--text-muted); font-size: 12.5px; font-style: italic; text-align: center; }
.fee-sr-empty b { color: var(--text-primary); font-weight: 800; }

/* Export button (red gradient — matches Accounts pattern) */
.crm-export-btn,
.acc-dlreport-btn {
  background: linear-gradient(135deg, #DC2626, #B91C1C) !important;
  color: #fff !important;
  border-color: transparent !important;
  box-shadow: 0 6px 16px rgba(220,38,38,.28) !important;
}
.crm-export-btn i,
.acc-dlreport-btn i { color: #fff !important; }
.crm-export-btn:hover,
.acc-dlreport-btn:hover {
  background: linear-gradient(135deg, #B91C1C, #991B1B) !important;
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(220,38,38,.36) !important;
}

/* ═══════════════════════════════════════════════════════════════════
   Modals — shared overlay + inner scaffold
   ═══════════════════════════════════════════════════════════════════ */
.fee-overlay {
  position: fixed; inset: 0;
  background: rgba(10,22,40,.55);
  backdrop-filter: blur(4px);
  z-index: 1500;
  display: none;
  align-items: center; justify-content: center;
  padding: 20px;
  opacity: 0;
  transition: opacity .2s ease;
}
.fee-overlay.open { display: flex; opacity: 1; }
.fee-modal {
  background: var(--bg-card);
  border-radius: 18px;
  box-shadow: 0 24px 64px rgba(15,23,42,.32);
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  display: flex; flex-direction: column;
  overflow: hidden;
  animation: crmModalIn .2s ease;
}
.fee-modal.lg { max-width: 760px; }
.fee-modal.md { max-width: 580px; }
.fee-modal.sm { max-width: 440px; }
@media (max-width: 600px) {
  .fee-modal,
  .fee-modal.lg,
  .fee-modal.md,
  .fee-modal.sm { max-width: 96vw; }

  /* ═══════════════════════════════════════════════════════════════════
     LEAD SETUP — Uniform / Books / Fee Structure tables → mobile cards
     The three .setup-row tables use inline gridTemplateColumns per table:
       Uniform        : '1fr 75px 75px 75px 80px'        (5 cells)
       Books          : '1fr 80px 80px 70px 90px 80px'    (6 cells)
       Fee Structure  : '1fr 130px 130px 100px'           (4 cells)
     We target each via [style*="…"] attribute selector and reflow each
     row into a compact 2-line card. Inline styles override regular CSS,
     so flex display + grid-template-columns:none use !important.
     ═══════════════════════════════════════════════════════════════════ */

  /* Wrapper drops horizontal scroll, hides column headers */
  .setup-tablewrap { overflow-x: visible !important; }
  .setup-table-head { display: none !important; }

  /* Generic .setup-row card foundation (applies to all three tables) */
  .setup-row {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    grid-template-columns: none !important;
    column-gap: 8px !important;
    row-gap: 6px !important;
    padding: 10px 12px !important;
  }
  .setup-td { padding: 0 !important; min-width: 0; font-size: 12px; }
  .setup-td.actions { gap: 6px; flex-shrink: 0; }

  /* ── Uniform Charges (5 cells) ──
     Row 1: Class                                    [+ ] [🗑]
     Row 2: Summer: Rs X · Winter: Rs Y · Sports: Rs Z */
  .setup-row[style*="75px 75px 75px"] > :nth-child(1) {
    order: 1; flex: 1 1 auto; font-weight: 700; font-size: 13px;
  }
  .setup-row[style*="75px 75px 75px"] > :nth-child(5) {
    order: 2; flex: 0 0 auto; margin-left: auto !important;
  }
  .setup-row[style*="75px 75px 75px"]::after {
    content: ""; flex: 1 1 100%; height: 0; order: 2.5;
  }
  .setup-row[style*="75px 75px 75px"] > :nth-child(2) { order: 3; flex: 1 1 calc(33% - 6px); }
  .setup-row[style*="75px 75px 75px"] > :nth-child(3) { order: 4; flex: 1 1 calc(33% - 6px); }
  .setup-row[style*="75px 75px 75px"] > :nth-child(4) { order: 5; flex: 1 1 calc(33% - 6px); }
  /* Label each season chip so the user can tell them apart */
  .setup-row[style*="75px 75px 75px"] > :nth-child(2)::before { content: "Summer "; font-size: 10px; color: var(--text-muted); display: block; }
  .setup-row[style*="75px 75px 75px"] > :nth-child(3)::before { content: "Winter "; font-size: 10px; color: var(--text-muted); display: block; }
  .setup-row[style*="75px 75px 75px"] > :nth-child(4)::before { content: "Sports "; font-size: 10px; color: var(--text-muted); display: block; }
  .setup-row[style*="75px 75px 75px"] .setup-cell-btn { width: 100%; padding: 5px 6px; font-size: 11px; }

  /* ── Books & Stationery (6 cells) ──
     Row 1: Class    [Freq chip]                      [✎] [🗑]
     Row 2: Books: Rs X · Stationery: Rs Y · Optional: Rs Z */
  .setup-row[style*="80px 80px 70px 90px"] > :nth-child(1) {
    order: 1; flex: 1 1 auto; font-weight: 700; font-size: 13px;
  }
  .setup-row[style*="80px 80px 70px 90px"] > :nth-child(5) {
    order: 2; flex: 0 0 auto;     /* Frequency chip */
  }
  .setup-row[style*="80px 80px 70px 90px"] > :nth-child(6) {
    order: 3; flex: 0 0 auto; margin-left: auto !important;
  }
  .setup-row[style*="80px 80px 70px 90px"]::after {
    content: ""; flex: 1 1 100%; height: 0; order: 3.5;
  }
  .setup-row[style*="80px 80px 70px 90px"] > :nth-child(2) { order: 4; flex: 1 1 calc(33% - 6px); }
  .setup-row[style*="80px 80px 70px 90px"] > :nth-child(3) { order: 5; flex: 1 1 calc(33% - 6px); }
  .setup-row[style*="80px 80px 70px 90px"] > :nth-child(4) { order: 6; flex: 1 1 calc(33% - 6px); }
  .setup-row[style*="80px 80px 70px 90px"] > :nth-child(2)::before { content: "Books "; font-size: 10px; color: var(--text-muted); display: block; }
  .setup-row[style*="80px 80px 70px 90px"] > :nth-child(3)::before { content: "Stationery "; font-size: 10px; color: var(--text-muted); display: block; }
  .setup-row[style*="80px 80px 70px 90px"] > :nth-child(4)::before { content: "Optional "; font-size: 10px; color: var(--text-muted); display: block; }

  /* ── Fee Structure (4 cells) ──
     Row 1: Fee Head ...........................     [✎] [🗑]
     Row 2: Amount Rs X                            [Freq chip] */
  .setup-row[style*="130px 130px"] > :nth-child(1) {
    order: 1; flex: 1 1 auto; font-weight: 700; font-size: 13px;
    word-break: normal; overflow-wrap: break-word;
  }
  .setup-row[style*="130px 130px"] > :nth-child(4) {
    order: 2; flex: 0 0 auto; margin-left: auto !important;
  }
  .setup-row[style*="130px 130px"]::after {
    content: ""; flex: 1 1 100%; height: 0; order: 2.5;
  }
  .setup-row[style*="130px 130px"] > :nth-child(2) {
    order: 3; flex: 1 1 auto;
    font-size: 13px;
  }
  .setup-row[style*="130px 130px"] > :nth-child(3) {
    order: 4; flex: 0 0 auto; margin-left: auto !important;
  }
  /* Total row keeps the same flex layout — bold via existing .setup-row--total */
  .setup-row.setup-row--total[style*="130px 130px"] > :nth-child(1) { font-size: 13.5px; }
  .setup-row.setup-row--total[style*="130px 130px"] > :nth-child(2) { font-size: 14px; }

  /* Fee Structure class-tabs strip (.fee-tabs-wrap) — horizontal scroll */
  .fee-tabs-wrap {
    overflow-x: auto;
    flex-wrap: nowrap !important;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .fee-tabs-wrap::-webkit-scrollbar { display: none; }
  .fee-tab { flex: 0 0 auto; white-space: nowrap; }

  /* Card padding tightens for mobile */
  .setup-card-header { padding: 12px 14px; }
  .setup-add-row { padding: 10px 12px; }

  /* Icon action buttons sized for touch */
  .setup-iconbtn { width: 32px; height: 32px; font-size: 12px; }

  /* ═══════════════════════════════════════════════════════════════════
     ACTIVE LEADS — .crm-row card layout (mobile)
     The existing 720px rule sets .crm-row { min-width: 720px } and
     .fee-section { overflow-x: auto } — that's the horizontal scroll.
     We cancel both and reflow the row into a compact 2-line card.

     JSX cell order inside .crm-row (7 children):
       1 .td                  — Parent name + avatar + follow-up date
       2 .td.crm-phone        — Phone (display:none from 1000px rule)
       3 .td.c.crm-stu-count  — Students count
       4 .td                  — Officer dropdown
       5 .td                  — Status dropdown
       6 .td                  — Source badge
       7 .td.c.crm-actions    — Download · 3-dots · Expand chev
     ═══════════════════════════════════════════════════════════════════ */

  /* Cancel min-width + horizontal scroll from the 720px rule */
  .crm-table-head,
  .crm-row { min-width: 0 !important; }
  .fee-section:has(.crm-row) { overflow-x: visible !important; }

  /* Hide column header — card layout has no use for it */
  .crm-table-head { display: none !important; }

  /* Card foundation */
  .crm-row {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    grid-template-columns: none !important;
    column-gap: 8px !important;
    row-gap: 10px !important;
    padding: 12px 14px !important;
    min-height: 0 !important;
  }
  .crm-row > .td {
    padding: 0 !important;
    gap: 8px !important;
    min-width: 0 !important;
  }

  /* Row 1: avatar+name (1) · students (3) · actions group (7) */
  .crm-row > .td:nth-of-type(1) {
    order: 1 !important;
    flex: 1 1 auto !important;
  }
  .crm-row > .td:nth-of-type(3) {
    order: 2 !important;
    flex: 0 0 auto !important;
    margin-left: auto !important;
  }
  .crm-row > .td:nth-of-type(7) {
    order: 3 !important;
    flex: 0 0 auto !important;
  }

  /* Wrap break — pushes officer/status/source onto Row 2 */
  .crm-row::after {
    content: "";
    flex: 1 1 100%;
    height: 0;
    order: 3.5;
  }

  /* Row 2: status (5) · officer (4) · source (6) — wraps as needed */
  .crm-row > .td:nth-of-type(5) {
    order: 4 !important;
    flex: 0 0 auto !important;
  }
  .crm-row > .td:nth-of-type(4) {
    order: 5 !important;
    flex: 1 1 auto !important;
    min-width: 0 !important;
  }
  .crm-row > .td:nth-of-type(6) {
    order: 6 !important;
    flex: 0 0 auto !important;
  }

  /* Tighter sub-pieces so the card fits */
  .crm-avatar { width: 34px; height: 34px; font-size: 12px; border-radius: 10px; }
  .crm-name { font-size: 13px; line-height: 1.3; word-break: normal; overflow-wrap: break-word; }
  .crm-fu-tag { font-size: 9.5px; padding: 1px 6px; }
  .crm-next-fu { font-size: 10.5px; line-height: 1.3; }

  /* Students count — add a small label so the number has context */
  .crm-row > .td.crm-stu-count {
    font-size: 12px;
    background: var(--bg-muted);
    border: 1px solid var(--border-light);
    border-radius: 999px;
    padding: 3px 9px !important;
    color: var(--brand-primary);
    font-weight: 800;
    white-space: nowrap;
  }
  .crm-row > .td.crm-stu-count::before {
    content: "\f0c0";  /* fa-users */
    font-family: "Font Awesome 6 Free";
    font-weight: 900;
    font-size: 10px;
    margin-right: 5px;
    color: var(--text-muted);
  }

  /* Officer / Status dropdowns — tight inline pickers */
  .crm-inline-pick { gap: 4px; }
  .crm-officer-name {
    font-size: 11.5px;
    max-width: 110px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .crm-status { font-size: 10.5px; padding: 2px 8px !important; white-space: nowrap; }
  .crm-source, .crm-source-plain { font-size: 10.5px; padding: 2px 8px !important; white-space: nowrap; }
  .crm-chevbtn { width: 22px; height: 22px; font-size: 9px; flex-shrink: 0; }

  /* Action group: download · 3-dots · chev — touch-friendly, no wrap */
  .crm-row > .td.crm-actions {
    gap: 4px !important;
    flex-wrap: nowrap !important;
  }
  .crm-row .crm-iconbtn { width: 32px; height: 32px; font-size: 11.5px; flex-shrink: 0; }

  /* Dropdown menus — let them overflow the card boundary on the right */
  .crm-dd-menu {
    min-width: 180px;
    right: 0;
    left: auto !important;
  }
}
@keyframes crmModalIn {
  from { transform: translateY(10px) scale(.98); opacity: 0; }
  to   { transform: none; opacity: 1; }
}
.fee-modal-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border-light);
  gap: 14px;
}
.fee-modal-head-title { display: flex; align-items: center; gap: 12px; min-width: 0; }
.fee-modal-head-icon {
  width: 40px; height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px;
  box-shadow: 0 4px 14px rgba(30,58,138,.28);
  flex-shrink: 0;
}
.fee-modal-title { font-size: 15.5px; font-weight: 800; color: var(--text-primary); letter-spacing: -.01em; }
.fee-modal-sub { font-size: 11.5px; color: var(--text-muted); margin-top: 2px; }
.fee-modal-close {
  width: 32px; height: 32px;
  border-radius: 9px;
  border: none; background: var(--bg-muted);
  color: var(--text-muted);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px;
}
.fee-modal-close:hover { background: rgba(220,38,38,.10); color: #DC2626; }
.fee-modal-body { padding: 20px 22px; overflow-y: auto; }
.fee-modal-foot {
  display: flex; align-items: center; justify-content: flex-end; gap: 10px;
  padding: 14px 22px;
  border-top: 1px solid var(--border-light);
  background: var(--bg-muted);
}

/* Modal form grid */
.crm-form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}
.crm-form-grid .fee-field.full { grid-column: 1 / -1; }
@media (max-width: 640px) { .crm-form-grid { grid-template-columns: 1fr; } }
.fee-hint { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-muted); }
.fee-hint i { color: #7C3AED; }

/* Reminder switch */
.crm-switch-row {
  display: flex !important;
  flex-direction: row !important;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--bg-muted);
  border: 1px solid var(--border-light);
}
.crm-switch {
  position: relative;
  display: inline-block;
  width: 42px; height: 24px;
  flex-shrink: 0;
}
.crm-switch input { opacity: 0; width: 0; height: 0; }
.crm-switch-slider {
  position: absolute; inset: 0;
  background: var(--border-med);
  border-radius: 999px;
  cursor: pointer;
  transition: background .2s ease;
}
.crm-switch-slider::before {
  content: '';
  position: absolute;
  height: 18px; width: 18px;
  left: 3px; top: 3px;
  background: #fff;
  border-radius: 50%;
  transition: transform .2s ease;
  box-shadow: 0 2px 6px rgba(15,23,42,.18);
}
.crm-switch input:checked + .crm-switch-slider { background: linear-gradient(135deg, #1E3A8A, #2563EB); }
.crm-switch input:checked + .crm-switch-slider::before { transform: translateX(18px); }
.crm-switch-lbl { font-size: 13px; font-weight: 800; color: var(--text-primary); }
.crm-switch-sub { font-size: 11.5px; color: var(--text-muted); margin-top: 2px; }

/* Confirm dialog message */
.crm-confirm-msg { font-size: 13.5px; color: var(--text-secondary); line-height: 1.6; }

/* Follow-up modal — 2-column layout */
.crm-fu-modal {
  display: grid;
  grid-template-columns: 1fr 1.1fr;
  gap: 16px;
}
@media (max-width: 720px) { .crm-fu-modal { grid-template-columns: 1fr; } }
.crm-fu-history, .crm-fu-form {
  background: var(--bg-muted);
  border: 1px solid var(--border-light);
  border-radius: 14px;
  padding: 14px;
}

/* Format picker (PDF / B&W / etc.) */
.crm-fmt-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
@media (max-width: 540px) { .crm-fmt-grid { grid-template-columns: 1fr; } }
.crm-fmt-opt {
  position: relative;
  text-align: left;
  border: 2px solid var(--border-light);
  border-radius: 12px;
  background: var(--bg-card);
  padding: 14px 14px 12px;
  cursor: pointer;
  transition: all .2s ease;
  display: flex; flex-direction: column; gap: 5px;
  font-family: var(--font-body);
}
.crm-fmt-opt:hover { border-color: var(--brand-mid); box-shadow: 0 4px 12px rgba(30,58,138,.10); }
.crm-fmt-opt.active {
  border-color: var(--brand-primary);
  background: linear-gradient(135deg, rgba(30,58,138,.05), transparent);
  box-shadow: 0 6px 18px rgba(30,58,138,.14);
}
.crm-fmt-ic {
  width: 38px; height: 38px;
  border-radius: 10px;
  background: var(--bg-muted);
  color: var(--brand-primary);
  display: flex; align-items: center; justify-content: center;
  font-size: 16px;
  margin-bottom: 2px;
}
.crm-fmt-opt.active .crm-fmt-ic { background: linear-gradient(135deg, #1E3A8A, #2563EB); color: #fff; }
.crm-fmt-name { font-size: 13.5px; font-weight: 800; color: var(--text-primary); }
.crm-fmt-desc { font-size: 11px; color: var(--text-muted); line-height: 1.5; }
.crm-fmt-check {
  position: absolute; top: 12px; right: 12px;
  font-size: 16px;
  color: var(--brand-primary);
  opacity: 0;
  transform: scale(.6);
  transition: all .2s ease;
}
.crm-fmt-opt.active .crm-fmt-check { opacity: 1; transform: scale(1); }

/* Share channel chips (legacy — kept for any other modal using them) */
.crm-channel-row {
  display: flex; gap: 8px; flex-wrap: wrap;
}
.crm-channel {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 14px;
  border: 1.5px solid var(--border-light);
  background: var(--bg-card);
  color: var(--text-secondary);
  border-radius: 10px;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all .15s ease;
  font-family: var(--font-body);
}
.crm-channel:hover { border-color: var(--ch); color: var(--ch); transform: translateY(-1px); }
.crm-channel.active {
  background: color-mix(in srgb, var(--ch) 12%, transparent);
  border-color: var(--ch);
  color: var(--ch);
}
.crm-channel i { font-size: 13px; }

/* ─── Share Fee modal — section checkboxes + format cards ─── */
.share-section-lbl {
  font-size: 11.5px;
  font-weight: 800;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: .5px;
  margin-bottom: 10px;
}
.share-sections {
  display: flex; flex-direction: column; gap: 10px;
}
.share-section {
  position: relative;
  display: flex; align-items: flex-start; gap: 12px;
  padding: 12px 14px;
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  background: var(--bg-muted);
  cursor: pointer;
  transition: all .15s ease;
}
.share-section:hover { border-color: var(--brand-mid); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(15,23,42,.06); }
.share-section.on {
  border-color: var(--brand-primary);
  background: rgba(30,58,138,.06);
}
.share-section input[type="checkbox"] {
  width: 16px; height: 16px;
  margin-top: 2px;
  accent-color: #1E40AF;
  flex-shrink: 0;
  cursor: pointer;
}
.share-section-body { flex: 1; min-width: 0; }
.share-section-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.share-section-title i { font-size: 13px; }
.share-section-desc {
  font-size: 11.5px;
  color: var(--text-muted);
  margin-top: 3px;
  line-height: 1.5;
}
.share-section-check {
  position: absolute;
  top: 12px; right: 12px;
  width: 22px; height: 22px;
  border-radius: 50%;
  background: var(--brand-primary);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px;
  opacity: 0;
  transform: scale(.5);
  transition: all .15s ease;
}
.share-section.on .share-section-check { opacity: 1; transform: scale(1); }

.share-fmt-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
@media (max-width: 540px) { .share-fmt-grid { grid-template-columns: 1fr; } }
.share-fmt {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px;
  border: 2px solid var(--border-light);
  border-radius: 12px;
  background: var(--bg-muted);
  cursor: pointer;
  text-align: left;
  font-family: var(--font-body);
  transition: all .15s ease;
}
.share-fmt:hover { transform: translateY(-1px); }
.share-fmt.on {
  border-color: var(--brand-primary);
  background: rgba(30,58,138,.05);
}
.share-fmt-ic {
  width: 36px; height: 36px;
  border-radius: 10px;
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}
.share-fmt-name { font-size: 13px; font-weight: 800; color: var(--text-primary); }
.share-fmt-desc { font-size: 10.5px; color: var(--text-muted); margin-top: 2px; }

[data-theme="dark"] .share-section { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .share-section.on { background: rgba(59,130,246,.10); border-color: #2563EB; }
[data-theme="dark"] .share-section-title { color: var(--text-primary); }
[data-theme="dark"] .share-section-check { background: #2563EB; }
[data-theme="dark"] .share-fmt { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .share-fmt.on { background: rgba(59,130,246,.10); border-color: #2563EB; }
[data-theme="dark"] .share-fmt-name { color: var(--text-primary); }

/* ═══════════════════════════════════════════════════════════════════
   INACTIVE LEADS — stat cards, L2 tabs, table rows, pills, confirm
   ═══════════════════════════════════════════════════════════════════ */
.crm-inactive-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
}
@media (max-width: 700px) { .crm-inactive-stats { grid-template-columns: 1fr; } }

.crm-inactive-stat {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 18px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 16px;
  cursor: pointer;
  text-align: left;
  font-family: var(--font-body);
  transition: all .2s ease;
  box-shadow: 0 1px 2px rgba(15,23,42,.04);
}
.crm-inactive-stat:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(15,23,42,.08); }
.crm-inactive-stat--green { background: rgba(22,163,74,.04); border-color: rgba(22,163,74,.25); }
.crm-inactive-stat--green:hover  { border-color: #16A34A; box-shadow: 0 10px 24px rgba(22,163,74,.22); }
.crm-inactive-stat--green.active { border-width: 2px; border-color: #16A34A; background: rgba(22,163,74,.10); box-shadow: 0 10px 28px rgba(22,163,74,.30); }
.crm-inactive-stat--red   { background: rgba(220,38,38,.04); border-color: rgba(220,38,38,.20); }
.crm-inactive-stat--red:hover    { border-color: #DC2626; box-shadow: 0 10px 24px rgba(220,38,38,.22); }
.crm-inactive-stat--red.active   { border-width: 2px; border-color: #DC2626; background: rgba(220,38,38,.10); box-shadow: 0 10px 28px rgba(220,38,38,.30); }
.crm-inactive-stat-ic {
  width: 50px; height: 50px;
  border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}
.crm-inactive-stat-body { flex: 1; min-width: 0; }
.crm-inactive-stat-val { font-size: 24px; font-weight: 800; letter-spacing: -.02em; line-height: 1.05; }
.crm-inactive-stat-lbl { font-size: 12.5px; font-weight: 700; color: var(--text-muted); margin-top: 3px; }
.crm-inactive-stat-delta { font-size: 11px; font-weight: 700; margin-top: 4px; display: inline-flex; align-items: center; gap: 5px; }
.crm-inactive-stat-delta i { font-size: 10px; }

/* L2 sub-tabs (pill nav with count badges) */
.crm-l2-tabs {
  display: flex; gap: 6px;
  padding: 5px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 14px;
  margin-bottom: 14px;
  overflow-x: auto;
}
.crm-l2-tab {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 16px;
  border: none;
  background: transparent;
  border-radius: 10px;
  font-family: var(--font-body);
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-muted);
  cursor: pointer;
  transition: all .15s ease;
  white-space: nowrap;
  flex: 1;
  justify-content: center;
}
.crm-l2-tab:hover:not(.active) { color: var(--text-primary); background: var(--bg-muted); }
.crm-l2-tab.active {
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  box-shadow: 0 4px 14px rgba(30,58,138,.30);
}
.crm-l2-tab i { font-size: 12px; }
.crm-l2-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 22px; height: 18px;
  padding: 0 7px;
  background: rgba(100,116,139,.18);
  color: var(--text-muted);
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: .3px;
}
.crm-l2-badge.on { background: rgba(255,255,255,.25); color: #fff; }

/* Inactive table head + row (extends the active leads table styling) */
.crm-inactive-head {
  display: grid;
  gap: 12px;
  padding: 14px 18px;
  background: var(--bg-muted);
  border-bottom: 1.5px solid var(--border-light);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .4px;
  color: var(--text-muted);
}
.crm-inactive-head .th.c { text-align: center; }
.crm-inactive-row {
  display: grid;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-light);
  align-items: center;
  min-height: 70px;
  transition: background .15s ease;
}
.crm-inactive-row:last-child { border-bottom: none; }
.crm-inactive-row:hover { background: rgba(30,58,138,.04); }
.crm-inactive-row .td { display: flex; align-items: center; gap: 10px; min-width: 0; }
.crm-inactive-row .td.c { justify-content: center; }
.crm-officer-cell { font-size: 12px; color: var(--text-muted); }

/* Per-cell pills */
.crm-conv-date {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; font-weight: 700; color: #15803D;
}
.crm-conv-date i { font-size: 10px; }
.crm-class-pill {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(22,163,74,.10);
  color: #15803D;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid rgba(22,163,74,.22);
}
.crm-class-pill--neutral {
  background: rgba(30,58,138,.06);
  color: #1E40AF;
  border-color: rgba(30,58,138,.20);
}
.crm-reason-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(220,38,38,.08);
  color: #B91C1C;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid rgba(220,38,38,.22);
  white-space: nowrap;
}
.crm-reason-pill i { font-size: 9px; }

/* Tinted icon-button variants for the action column */
.crm-iconbtn--green {
  color: #16A34A;
  border-color: rgba(22,163,74,.32);
  background: rgba(22,163,74,.05);
}
.crm-iconbtn--green:hover { background: #16A34A; border-color: #16A34A; color: #fff; }
.crm-iconbtn--red {
  color: #DC2626;
  border-color: rgba(220,38,38,.32);
  background: rgba(220,38,38,.05);
}
.crm-iconbtn--red:hover { background: #DC2626; border-color: #DC2626; color: #fff; }
.crm-iconbtn--danger {
  color: #DC2626;
  border-color: rgba(220,38,38,.32);
  background: rgba(220,38,38,.04);
}
.crm-iconbtn--danger:hover { background: #DC2626; border-color: #DC2626; color: #fff; }

/* Confirm dialog body */
.crm-confirm-detail {
  background: var(--bg-muted);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex; flex-direction: column; gap: 8px;
}
.crm-confirm-detail--danger {
  background: rgba(220,38,38,.05);
  border-color: rgba(220,38,38,.22);
}
.crm-confirm-row {
  display: flex; align-items: center; gap: 9px;
  font-size: 12.5px; color: var(--text-secondary); font-weight: 600;
  line-height: 1.5;
}
.crm-confirm-row i { color: #0284C7; font-size: 12px; width: 16px; flex-shrink: 0; }
.crm-confirm-detail--danger .crm-confirm-row { color: #B91C1C; }
.crm-confirm-detail--danger .crm-confirm-row i { color: #DC2626; }

@media (max-width: 900px) {
  .crm-inactive-head .th:nth-child(3),
  .crm-inactive-head .th:nth-child(4),
  .crm-inactive-head .th:nth-child(5),
  .crm-inactive-row .td:nth-child(3),
  .crm-inactive-row .td:nth-child(4),
  .crm-inactive-row .td:nth-child(5) { display: none; }
  .crm-inactive-head, .crm-inactive-row { grid-template-columns: 2fr 1.2fr 130px !important; }
}

/* Dark mode */
[data-theme="dark"] .crm-inactive-stat { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .crm-inactive-stat--green { background: rgba(22,163,74,.08); }
[data-theme="dark"] .crm-inactive-stat--red   { background: rgba(220,38,38,.08); }
[data-theme="dark"] .crm-l2-tabs { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .crm-l2-tab { color: var(--text-muted); }
[data-theme="dark"] .crm-l2-tab.active { background: linear-gradient(135deg, #1E3A8A, #2563EB); color: #fff; }
[data-theme="dark"] .crm-l2-badge { background: rgba(100,116,139,.22); color: var(--text-muted); }
[data-theme="dark"] .crm-inactive-head { background: var(--bg-muted); }
[data-theme="dark"] .crm-inactive-row { border-color: var(--border-light); }
[data-theme="dark"] .crm-inactive-row:hover { background: rgba(59,130,246,.06); }
[data-theme="dark"] .crm-class-pill { background: rgba(22,163,74,.18); color: #86EFAC; border-color: rgba(22,163,74,.32); }
[data-theme="dark"] .crm-class-pill--neutral { background: rgba(59,130,246,.14); color: #93C5FD; border-color: rgba(59,130,246,.32); }
[data-theme="dark"] .crm-reason-pill { background: rgba(220,38,38,.18); color: #FCA5A5; border-color: rgba(220,38,38,.32); }
[data-theme="dark"] .crm-conv-date { color: #86EFAC; }
[data-theme="dark"] .crm-confirm-detail { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .crm-confirm-detail--danger { background: rgba(220,38,38,.10); border-color: rgba(220,38,38,.30); }

/* ═══════════════════════════════════════════════════════════════════
   Hero-ring confirm dialog (shared with Accounts/Inventory pattern)
   ═══════════════════════════════════════════════════════════════════ */
.crm-confirm-overlay {
  position: fixed; inset: 0;
  z-index: 9999;
  background: rgba(10,22,40,.55);
  backdrop-filter: blur(8px);
  display: none;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.crm-confirm-overlay.open { display: flex; }
.crm-confirm-dialog {
  position: relative;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 24px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 30px 80px rgba(0,0,0,.2), 0 8px 24px rgba(0,0,0,.1);
  animation: crmConfirmIn .32s cubic-bezier(.34,1.3,.64,1) both;
  overflow: hidden;
}
@keyframes crmConfirmIn {
  from { opacity: 0; transform: scale(.88) translateY(20px); }
  to   { opacity: 1; transform: none; }
}
.crm-confirm-glow {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  border-radius: 24px 24px 0 0;
}
.crm-confirm-hero {
  display: flex; flex-direction: column; align-items: center;
  padding: 32px 28px 10px;
}
.crm-confirm-hero--danger  { background: linear-gradient(180deg, rgba(220,38,38,.03), transparent); }
.crm-confirm-hero--primary { background: linear-gradient(180deg, rgba(30,58,138,.04), transparent); }
.crm-confirm-hero--success { background: linear-gradient(180deg, rgba(22,163,74,.04), transparent); }
.crm-confirm-ring {
  position: relative;
  width: 80px; height: 80px;
  display: flex; align-items: center; justify-content: center;
}
.crm-confirm-ring::before {
  content: '';
  position: absolute; inset: 0;
  border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: var(--ring);
  border-right-color: var(--ring);
  animation: crmConfirmRing 3s linear infinite;
  opacity: .55;
}
@keyframes crmConfirmRing { to { transform: rotate(360deg); } }
.crm-confirm-icon-wrap {
  width: 60px; height: 60px;
  border-radius: 18px;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px;
  position: relative; z-index: 1;
  transition: all .3s ease;
}
.crm-confirm-body { padding: 16px 28px 8px; text-align: center; }
.crm-confirm-title {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 10px;
  letter-spacing: -.02em;
}
.crm-confirm-msg {
  font-size: 13.5px;
  color: var(--text-muted);
  line-height: 1.75;
  margin-bottom: 14px;
}
.crm-confirm-msg strong { color: var(--text-primary); font-weight: 700; }
.crm-confirm-hint {
  display: flex; flex-direction: column;
  gap: 7px;
  padding: 11px 14px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
  text-align: left;
}
.crm-confirm-hint-row { display: flex; gap: 9px; align-items: flex-start; }
.crm-confirm-hint-row i { font-size: 12px; flex-shrink: 0; margin-top: 2px; width: 14px; }
.crm-confirm-hint--danger { background: rgba(220,38,38,.05); border: 1px solid rgba(220,38,38,.18); color: #991B1B; }
.crm-confirm-hint--danger i { color: #DC2626; }
.crm-confirm-hint--primary { background: rgba(30,58,138,.05); border: 1px solid rgba(30,58,138,.18); color: #1E3A5F; }
.crm-confirm-hint--primary i { color: #1E40AF; }
.crm-confirm-hint--success { background: rgba(22,163,74,.05); border: 1px solid rgba(22,163,74,.20); color: #15803D; }
.crm-confirm-hint--success i { color: #16A34A; }
.crm-confirm-footer {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 10px;
  padding: 20px 28px 28px;
}
.crm-confirm-btn {
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
.crm-confirm-btn--cancel {
  background: var(--bg-muted);
  border: 1.5px solid var(--border-light);
  color: var(--text-muted);
}
.crm-confirm-btn--cancel:hover {
  background: var(--bg-card);
  color: var(--text-primary);
  border-color: var(--border-med);
}
.crm-confirm-btn--confirm { color: #fff; }
.crm-confirm-btn--confirm:hover { transform: translateY(-2px); }
.crm-confirm-btn:active { transform: scale(.97) translateY(0) !important; }

[data-theme="dark"] .crm-confirm-overlay { background: rgba(0,0,0,.65); }
[data-theme="dark"] .crm-confirm-dialog { background: var(--bg-card); border-color: var(--border-light); }

/* ═══════════════════════════════════════════════════════════════════
   REPORTS — filter bar, card grid, KPIs, bars, channel lists
   ═══════════════════════════════════════════════════════════════════ */
.rep-filterbar {
  display: flex; align-items: flex-end;
  gap: 18px;
  padding: 16px 20px;
  flex-wrap: wrap;
}
.rep-filter-fields { display: flex; align-items: flex-end; gap: 10px; }
.rep-arrow {
  width: 30px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-muted);
  font-size: 13px;
}
.rep-presets { display: flex; gap: 6px; flex-wrap: wrap; }
.rep-preset {
  display: inline-flex; align-items: center;
  height: 30px;
  padding: 0 14px;
  border-radius: 999px;
  background: var(--bg-muted);
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all .15s ease;
}
.rep-preset:hover {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
  color: #fff;
  transform: translateY(-1px);
}
.rep-rangelbl {
  margin-left: auto;
  display: inline-flex; align-items: center; gap: 7px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
  background: var(--bg-muted);
  padding: 7px 14px;
  border-radius: 8px;
  border: 1px solid var(--border-light);
}
.rep-rangelbl i { color: var(--brand-primary); }

/* Page-level Report Style toggle (Colorful / Colorless) */
.rep-style-row {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-left: 8px;
}
.rep-style-lbl {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--text-muted);
}
.rep-style-seg {
  display: inline-flex;
  background: var(--bg-muted);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  padding: 3px;
  gap: 3px;
}
.rep-style-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px;
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
.rep-style-btn i { font-size: 10px; }
.rep-style-btn:hover { color: var(--brand-primary); }
.rep-style-btn.on {
  background: var(--bg-card);
  color: var(--brand-primary);
  box-shadow: 0 1px 3px rgba(15,23,42,.10);
}
.rep-style-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(30,64,175,.22);
}
[data-theme="dark"] .rep-style-seg { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .rep-style-btn.on { background: var(--bg-card); color: #93C5FD; }
[data-theme="dark"] .rep-style-btn:focus-visible { box-shadow: 0 0 0 3px rgba(59,130,246,.32); }

/* 2×2 card grid */
.rep-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 900px) { .rep-grid { grid-template-columns: 1fr; } }

.rep-card {
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(15,23,42,.04);
  display: flex;
  flex-direction: column;
}
.rep-card-head {
  padding: 16px 18px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.rep-card-head-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.rep-card-ic {
  width: 42px; height: 42px;
  border-radius: 12px;
  background: rgba(255,255,255,.18);
  display: flex; align-items: center; justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}
.rep-card-title { font-size: 15px; font-weight: 800; letter-spacing: -.01em; }
.rep-card-sub { font-size: 11.5px; opacity: .85; margin-top: 2px; }
.rep-card-head-actions { display: flex; gap: 6px; }
.rep-card-headbtn {
  width: 32px; height: 32px;
  border-radius: 9px;
  border: none;
  background: rgba(255,255,255,.18);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: all .15s ease;
}
.rep-card-headbtn:hover { background: rgba(255,255,255,.28); transform: translateY(-1px); }

.rep-card-body { padding: 16px 18px; flex: 1; display: flex; flex-direction: column; gap: 14px; }
.rep-card-foot {
  display: flex; gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--border-light);
  background: var(--bg-muted);
}
.rep-card-foot .fee-btn { flex: 1; justify-content: center; }

/* KPI tiles inside cards */
.rep-kpi-grid { display: grid; gap: 8px; }
.rep-kpi-grid--3 { grid-template-columns: 1fr 1fr 1fr; }
.rep-kpi-grid--2 { grid-template-columns: 1fr 1fr; }
.rep-kpi {
  padding: 11px 12px;
  border-radius: 12px;
  border: 1px solid var(--border-light);
}
.rep-kpi-val { font-size: 20px; font-weight: 800; letter-spacing: -.02em; line-height: 1.05; font-variant-numeric: tabular-nums; }
.rep-kpi-lbl { font-size: 11px; font-weight: 700; color: var(--text-muted); margin-top: 3px; text-transform: uppercase; letter-spacing: .3px; }
.rep-kpi-sub { font-size: 10.5px; color: var(--text-muted); margin-top: 2px; }

/* Summary bars */
.rep-bars { display: flex; flex-direction: column; gap: 9px; }
.rep-bar {
  display: grid;
  grid-template-columns: 100px 1fr 50px;
  align-items: center;
  gap: 10px;
}
.rep-bar-lbl { font-size: 11.5px; font-weight: 700; color: var(--text-secondary); }
.rep-bar-track {
  height: 10px;
  background: var(--bg-muted);
  border-radius: 999px;
  overflow: hidden;
}
.rep-bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width .35s ease;
}
.rep-bar-val { font-size: 11.5px; font-weight: 800; color: var(--text-primary); text-align: right; font-variant-numeric: tabular-nums; }

/* Recent list rows */
.rep-listlbl {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .4px;
  text-transform: uppercase;
  color: var(--text-muted);
}
.rep-list { display: flex; flex-direction: column; gap: 7px; }
.rep-list-row {
  display: flex; justify-content: space-between; align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--bg-muted);
  border-radius: 9px;
  border: 1px solid var(--border-light);
}
.rep-list-name { font-size: 12.5px; font-weight: 800; color: var(--text-primary); }
.rep-list-sub { font-size: 10.5px; color: var(--text-muted); margin-top: 1px; }
.rep-list-meta { font-size: 11.5px; font-weight: 700; color: var(--text-muted); white-space: nowrap; }
.rep-list-meta i { font-size: 10px; margin-right: 4px; }

/* Source channel bars */
.rep-channels { display: flex; flex-direction: column; gap: 7px; }
.rep-channel {
  display: grid;
  grid-template-columns: 80px 1fr 70px;
  align-items: center;
  gap: 8px;
}
.rep-channel-lbl { font-size: 11.5px; font-weight: 700; color: var(--text-secondary); }
.rep-channel-bar {
  height: 8px;
  background: var(--bg-muted);
  border-radius: 999px;
  overflow: hidden;
}
.rep-channel-fill { height: 100%; border-radius: 999px; transition: width .35s ease; }
.rep-channel-meta { font-size: 10.5px; font-weight: 700; color: var(--text-muted); text-align: right; font-variant-numeric: tabular-nums; }

[data-theme="dark"] .rep-rangelbl { background: var(--bg-muted); border-color: var(--border-light); color: var(--text-muted); }
[data-theme="dark"] .rep-rangelbl i { color: #93C5FD; }
[data-theme="dark"] .rep-preset { background: var(--bg-muted); border-color: var(--border-light); color: var(--text-secondary); }
[data-theme="dark"] .rep-preset:hover { background: #2563EB; border-color: #2563EB; color: #fff; }
[data-theme="dark"] .rep-card { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .rep-card-foot { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .rep-kpi { border-color: var(--border-light); }
[data-theme="dark"] .rep-kpi-val { color: var(--text-primary); }
[data-theme="dark"] .rep-bar-track,
[data-theme="dark"] .rep-channel-bar { background: var(--bg-muted); }
[data-theme="dark"] .rep-list-row { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .rep-list-name { color: var(--text-primary); }

/* ─── Officer Performance card (full-width) ─── */
.rep-card-fullwrap { grid-column: 1 / -1; }
.rep-officer-list { display: flex; flex-direction: column; gap: 8px; }
.rep-officer-row {
  display: grid;
  grid-template-columns: 32px 48px 1fr 240px;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  background: var(--bg-muted);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  transition: all .15s ease;
}
.rep-officer-row:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(15,23,42,.06); }
.rep-officer-row--top {
  background: linear-gradient(135deg, rgba(217,119,6,.06), rgba(217,119,6,.02));
  border-color: rgba(217,119,6,.32);
  box-shadow: 0 4px 14px rgba(217,119,6,.10);
}
.rep-officer-rank {
  width: 26px; height: 26px;
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-muted);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px;
  font-weight: 800;
  border: 1px solid var(--border-light);
}
.rep-officer-row--top .rep-officer-rank {
  background: linear-gradient(135deg, #D97706, #B45309);
  color: #fff;
  border-color: transparent;
}
.rep-officer-avatar {
  position: relative;
  width: 40px; height: 40px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 800;
  flex-shrink: 0;
}
.rep-officer-crown {
  position: absolute;
  top: -8px; right: -6px;
  width: 20px; height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, #FBBF24, #D97706);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px;
  box-shadow: 0 3px 8px rgba(217,119,6,.32);
}
.rep-officer-main { min-width: 0; }
.rep-officer-name { font-size: 13.5px; font-weight: 800; color: var(--text-primary); letter-spacing: -.01em; }
.rep-officer-sub {
  display: flex; flex-wrap: wrap; gap: 4px 10px;
  font-size: 11.5px;
  color: var(--text-muted);
  font-weight: 600;
  margin-top: 3px;
}
.rep-officer-sub b { color: var(--text-primary); font-weight: 800; }
.rep-officer-meter {
  display: flex; align-items: center; gap: 9px;
}
.rep-officer-meter-track {
  flex: 1;
  height: 10px;
  background: var(--bg-card);
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid var(--border-light);
}
.rep-officer-meter-fill {
  height: 100%;
  border-radius: 999px;
  transition: width .35s ease;
}
.rep-officer-meter-val {
  font-size: 12.5px;
  font-weight: 800;
  color: var(--text-primary);
  min-width: 50px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.rep-officer-empty {
  padding: 28px 14px;
  text-align: center;
  font-size: 12.5px;
  color: var(--text-muted);
  font-style: italic;
  background: var(--bg-muted);
  border-radius: 12px;
  border: 1px dashed var(--border-light);
}

@media (max-width: 720px) {
  .rep-officer-row { grid-template-columns: 28px 40px 1fr; }
  .rep-officer-meter { grid-column: 1 / -1; margin-top: 6px; }
}

[data-theme="dark"] .rep-officer-row { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .rep-officer-row--top { background: linear-gradient(135deg, rgba(217,119,6,.12), rgba(217,119,6,.04)); border-color: rgba(217,119,6,.36); }
[data-theme="dark"] .rep-officer-rank { background: var(--bg-card); border-color: var(--border-light); color: var(--text-muted); }
[data-theme="dark"] .rep-officer-name { color: var(--text-primary); }
[data-theme="dark"] .rep-officer-meter-track { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .rep-officer-meter-val { color: var(--text-primary); }
[data-theme="dark"] .rep-officer-empty { background: var(--bg-muted); }

/* ═══════════════════════════════════════════════════════════════════
   LEAD SETUP — grid, cards, tables, chips, fee tabs
   ═══════════════════════════════════════════════════════════════════ */
.setup-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 880px) { .setup-grid { grid-template-columns: 1fr; } }

.setup-card {
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(15,23,42,.04);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.setup-card:hover { box-shadow: 0 6px 18px rgba(15,23,42,.06); }
.setup-card--full { grid-column: 1 / -1; }

.setup-card-header {
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 1px solid var(--border-light);
  background: linear-gradient(135deg, rgba(30,58,138,.03), transparent);
}
.setup-card-title-row { display: flex; align-items: center; gap: 9px; min-width: 0; }
.setup-card-icon {
  width: 32px; height: 32px;
  border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
}
.setup-card-title { font-size: 13.5px; font-weight: 800; color: var(--text-primary); letter-spacing: -.01em; }
.setup-card-sub { font-size: 10.5px; color: var(--text-muted); margin-top: 1px; }

.setup-add-btn {
  width: 30px; height: 30px;
  border-radius: 9px;
  border: none;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px;
  box-shadow: 0 4px 12px rgba(30,58,138,.28);
  transition: all .15s ease;
}
.setup-add-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(30,58,138,.36); }
.setup-add-btn-text {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 7px 14px;
  border-radius: 9px;
  border: none;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 700;
  box-shadow: 0 4px 12px rgba(30,58,138,.28);
}
.setup-add-btn-text:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(30,58,138,.36); }

.setup-tablewrap { overflow-x: auto; }
.setup-table-head {
  display: grid;
  gap: 8px;
  padding: 10px 16px;
  background: var(--bg-muted);
  border-bottom: 1.5px solid var(--border-light);
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: .4px;
  text-transform: uppercase;
  color: var(--text-muted);
}
.setup-row {
  display: grid;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-light);
  align-items: center;
}
.setup-row:last-child { border-bottom: none; }
.setup-row:hover { background: rgba(30,58,138,.03); }
.setup-row--total {
  background: rgba(30,58,138,.06);
  font-weight: 800;
}
.setup-td { font-size: 12.5px; color: var(--text-secondary); }
.setup-td.name { font-weight: 700; color: var(--text-primary); }
.setup-td.amt { font-weight: 700; color: var(--brand-primary); font-variant-numeric: tabular-nums; }
.setup-td.actions { display: flex; gap: 4px; }

.setup-iconbtn {
  width: 28px; height: 28px;
  border-radius: 7px;
  border: 1.5px solid var(--border-light);
  background: var(--bg-card);
  color: var(--text-muted);
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px;
  transition: all .15s ease;
}
.setup-iconbtn:hover { background: var(--brand-primary); color: #fff; border-color: var(--brand-primary); }
.setup-iconbtn.danger:hover { background: #DC2626; border-color: #DC2626; color: #fff; }

.setup-add-row {
  padding: 12px 16px;
  border-top: 1px solid var(--border-light);
  background: var(--bg-muted);
}
.setup-add-class {
  width: 100%;
  display: inline-flex; align-items: center; justify-content: center;
  gap: 7px;
  padding: 9px 14px;
  border-radius: 9px;
  border: 1.5px dashed var(--border-med);
  background: var(--bg-card);
  color: var(--brand-primary);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 700;
  transition: all .15s ease;
}
.setup-add-class:hover {
  background: rgba(30,58,138,.06);
  border-color: var(--brand-primary);
  border-style: solid;
  transform: translateY(-1px);
}

.setup-empty {
  padding: 22px 16px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
}

/* Inline editable amount cells in the Uniform table */
.setup-cell-btn {
  border: none;
  background: transparent;
  color: var(--brand-primary);
  font-family: var(--font-body);
  font-weight: 700;
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all .12s ease;
  width: 100%;
  text-align: left;
}
.setup-cell-btn:hover { background: rgba(30,58,138,.08); color: var(--brand-primary); }
.setup-cell-btn.empty { color: var(--text-muted); font-weight: 600; font-style: italic; font-size: 11.5px; }
.setup-cell-btn.empty:hover { color: var(--brand-primary); background: rgba(30,58,138,.06); }

/* Inline helper note (matches HTML reference .helper-text) */
.setup-helper {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 12px;
  background: rgba(30,58,138,.06);
  border: 1px solid rgba(30,58,138,.18);
  border-radius: 8px;
  font-size: 11.5px;
  color: var(--text-secondary);
  line-height: 1.55;
}
.setup-helper i { color: var(--brand-primary); font-size: 12px; flex-shrink: 0; }
.fee-optional {
  font-size: 10px;
  color: var(--text-muted);
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0;
  margin-left: 4px;
}

/* Admission Charges card */
.adm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  padding: 14px 16px;
}
.adm-stat {
  padding: 12px 14px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  position: relative;
  overflow: hidden;
}
.adm-stat::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, #D97706, #B45309);
}
.adm-stat--total {
  background: linear-gradient(135deg, rgba(217,119,6,.10), rgba(217,119,6,.04));
  border-color: rgba(217,119,6,.32);
}
.adm-stat--total::before { background: linear-gradient(180deg, #D97706, #92400E); width: 4px; }
.adm-stat-lbl {
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .4px;
  color: var(--text-muted);
}
.adm-stat-val {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-primary);
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
  letter-spacing: -.01em;
}
.adm-stat--total .adm-stat-val { color: #B45309; font-size: 18px; }
.adm-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 0 16px 14px;
}
.adm-notes {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 11.5px;
  color: var(--text-muted);
  font-weight: 600;
  background: rgba(217,119,6,.06);
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid rgba(217,119,6,.16);
}
.adm-notes i { color: #D97706; font-size: 11px; }

/* Fee Structure tabs */
.fee-tabs-wrap {
  display: flex;
  gap: 0;
  padding: 0 8px;
  border-bottom: 1px solid var(--border-light);
  overflow-x: auto;
  scrollbar-width: thin;
  background: var(--bg-card);
}
.fee-tab {
  position: relative;
  padding: 10px 16px;
  border: none;
  background: transparent;
  font-family: var(--font-body);
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-muted);
  cursor: pointer;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-bottom: 2.5px solid transparent;
  transition: all .15s ease;
}
.fee-tab:hover:not(.active) { color: var(--text-primary); background: var(--bg-muted); }
.fee-tab.active {
  color: var(--brand-primary);
  border-bottom-color: var(--brand-primary);
}
.fee-tab-del {
  display: inline-flex; align-items: center; justify-content: center;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: var(--bg-muted);
  color: var(--text-muted);
  font-size: 8px;
  transition: all .12s ease;
}
.fee-tab-del:hover { background: #DC2626; color: #fff; }
.fee-tab.active .fee-tab-del { background: rgba(30,58,138,.16); color: var(--brand-primary); }
.fee-tab.active .fee-tab-del:hover { background: #DC2626; color: #fff; }

.fee-freq-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 9px;
  font-size: 11px;
  font-weight: 700;
  background: var(--bg-muted);
  color: var(--text-secondary);
  border-radius: 999px;
  border: 1px solid var(--border-light);
}

/* Chip list */
.chip-list {
  padding: 14px 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1.5px solid var(--border-light);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 700;
  transition: all .15s ease;
}
.chip-item:hover:not(.chip-add) { transform: translateY(-1px); }
.chip-item i { font-size: 11px; }
.chip-del {
  display: inline-flex;
  width: 16px; height: 16px;
  border-radius: 50%;
  align-items: center; justify-content: center;
  cursor: pointer;
  font-size: 8px;
  opacity: .6;
  transition: all .12s ease;
}
.chip-del:hover { background: #DC2626; color: #fff !important; opacity: 1; }
.chip-lock {
  display: inline-flex;
  width: 14px; height: 14px;
  align-items: center; justify-content: center;
  font-size: 8px;
  opacity: .55;
}
.chip-add {
  cursor: pointer;
  border-style: dashed;
  color: var(--brand-primary);
  background: transparent;
}
.chip-add:hover {
  background: rgba(30,58,138,.06);
  border-color: var(--brand-primary);
  border-style: solid;
  transform: translateY(-1px);
}

/* Chip preset grid (Add Chip modal) */
.chip-preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
  margin-bottom: 14px;
}
.chip-preset {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 12px;
  border: 1.5px solid var(--border-light);
  background: var(--bg-card);
  border-radius: 10px;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  text-align: left;
  transition: all .15s ease;
}
.chip-preset:hover {
  border-color: var(--c);
  background: color-mix(in srgb, var(--c) 6%, var(--bg-card));
  transform: translateY(-1px);
}
.chip-preset.active {
  border-color: var(--c);
  background: color-mix(in srgb, var(--c) 12%, var(--bg-card));
  box-shadow: 0 4px 12px color-mix(in srgb, var(--c) 20%, transparent);
}
.chip-divider {
  display: flex; align-items: center;
  gap: 12px;
  margin: 16px 0 12px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1px;
  color: var(--text-muted);
}
.chip-divider::before,
.chip-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-light);
}
.chip-color-row { display: flex; gap: 8px; align-items: center; }
.chip-color-input {
  width: 50px; height: 40px;
  border: 1.5px solid var(--border-light);
  border-radius: 10px;
  cursor: pointer;
  background: transparent;
  padding: 2px;
}
code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: var(--bg-muted);
  padding: 1px 6px;
  border-radius: 4px;
  color: var(--brand-primary);
  font-size: 10.5px;
}

/* Dark mode */
[data-theme="dark"] .setup-card { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .setup-card-header { background: linear-gradient(135deg, rgba(59,130,246,.04), transparent); }
[data-theme="dark"] .setup-card-title { color: var(--text-primary); }
[data-theme="dark"] .setup-table-head { background: var(--bg-muted); }
[data-theme="dark"] .setup-row { border-color: var(--border-light); }
[data-theme="dark"] .setup-row:hover { background: rgba(59,130,246,.06); }
[data-theme="dark"] .setup-row--total { background: rgba(59,130,246,.08); }
[data-theme="dark"] .setup-td.name { color: var(--text-primary); }
[data-theme="dark"] .setup-td.amt { color: #93C5FD; }
[data-theme="dark"] .setup-iconbtn { background: var(--bg-card); border-color: var(--border-light); color: var(--text-muted); }
[data-theme="dark"] .setup-iconbtn:hover { background: #2563EB; border-color: #2563EB; color: #fff; }
[data-theme="dark"] .setup-add-row { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .setup-add-class { background: var(--bg-card); border-color: var(--border-light); color: #93C5FD; }
[data-theme="dark"] .setup-add-class:hover { background: rgba(59,130,246,.10); border-color: #2563EB; }
[data-theme="dark"] .fee-tabs-wrap { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .fee-tab.active { color: #93C5FD; border-bottom-color: #2563EB; }
[data-theme="dark"] .fee-freq-chip { background: var(--bg-muted); border-color: var(--border-light); color: var(--text-secondary); }
[data-theme="dark"] .chip-item { background: var(--bg-card); border-color: var(--border-light); color: var(--text-primary); }
[data-theme="dark"] .chip-add { background: transparent; color: #93C5FD; }
[data-theme="dark"] .chip-add:hover { background: rgba(59,130,246,.10); border-color: #2563EB; }
[data-theme="dark"] .chip-preset { background: var(--bg-card); border-color: var(--border-light); color: var(--text-primary); }
[data-theme="dark"] .chip-color-input { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] code { background: var(--bg-muted); color: #93C5FD; }
[data-theme="dark"] .setup-cell-btn { color: #93C5FD; }
[data-theme="dark"] .setup-cell-btn:hover { background: rgba(59,130,246,.10); }
[data-theme="dark"] .setup-cell-btn.empty { color: var(--text-muted); }
[data-theme="dark"] .setup-helper { background: rgba(59,130,246,.08); border-color: rgba(59,130,246,.22); color: var(--text-secondary); }
[data-theme="dark"] .setup-helper i { color: #93C5FD; }
[data-theme="dark"] .adm-stat { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .adm-stat-val { color: var(--text-primary); }
[data-theme="dark"] .adm-stat--total { background: linear-gradient(135deg, rgba(217,119,6,.16), rgba(217,119,6,.06)); }
[data-theme="dark"] .adm-stat--total .adm-stat-val { color: #FDBA74; }
[data-theme="dark"] .adm-notes { background: rgba(217,119,6,.12); border-color: rgba(217,119,6,.28); }

[data-theme="dark"] .fee-subtabs { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .fee-subtab { color: var(--text-muted); }
[data-theme="dark"] .fee-subtab:hover:not(.active) { background: var(--bg-muted); color: var(--text-primary); }
[data-theme="dark"] .fee-section { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .crm-coming-ic {
  background: linear-gradient(135deg, rgba(59,130,246,.10), rgba(167,139,250,.10));
  border-color: rgba(59,130,246,.40);
  color: #93C5FD;
}
[data-theme="dark"] .fee-input,
[data-theme="dark"] .fee-select,
[data-theme="dark"] .fee-search-box { background: var(--bg-card); border-color: var(--border-light); color: var(--text-primary); }
[data-theme="dark"] .crm-stat-card,
[data-theme="dark"] .crm-fu-card,
[data-theme="dark"] .crm-detail-block { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .crm-stat-val,
[data-theme="dark"] .crm-fu-val,
[data-theme="dark"] .crm-name,
[data-theme="dark"] .crm-detail-val { color: var(--text-primary); }
[data-theme="dark"] .crm-table-head { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .crm-row:hover { background: rgba(59,130,246,.06); }
[data-theme="dark"] .crm-row-wrap.open .crm-row { background: rgba(59,130,246,.10); }
[data-theme="dark"] .crm-active-filters { background: rgba(59,130,246,.06); border-color: rgba(59,130,246,.20); color: var(--text-secondary); }
[data-theme="dark"] .crm-active-filters > i { color: #93C5FD; }
[data-theme="dark"] .crm-active-chip { background: var(--bg-card); border-color: var(--border-light); color: var(--text-primary); }
[data-theme="dark"] .crm-dd-menu { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .crm-dd-item { color: var(--text-primary); }
[data-theme="dark"] .crm-dd-item:hover { background: var(--bg-muted); }
[data-theme="dark"] .crm-dd-item.selected { background: rgba(59,130,246,.14); color: #93C5FD; }
[data-theme="dark"] .crm-iconbtn { background: var(--bg-card); border-color: var(--border-light); color: var(--text-muted); }
[data-theme="dark"] .crm-iconbtn:hover { background: #2563EB; border-color: #2563EB; color: #fff; }
[data-theme="dark"] .crm-detail-inner { background: linear-gradient(135deg, rgba(59,130,246,.06), transparent 60%); }
[data-theme="dark"] .crm-note-body { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .crm-note-text { color: var(--text-primary); }
[data-theme="dark"] .crm-note-staff { color: #93C5FD; }
[data-theme="dark"] .crm-note-chip { background: rgba(59,130,246,.12); color: #93C5FD; border-color: rgba(59,130,246,.28); }
[data-theme="dark"] .crm-act-btn { background: var(--bg-card); }
[data-theme="dark"] .crm-act-edit { color: var(--text-muted); }
[data-theme="dark"] .fee-search-results { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .fee-sr-item:hover { background: rgba(59,130,246,.08); }
[data-theme="dark"] .fee-sr-name { color: var(--text-primary); }
[data-theme="dark"] .fee-sr-go { background: var(--bg-muted); color: #93C5FD; }
[data-theme="dark"] .fee-modal { background: var(--bg-card); }
[data-theme="dark"] .fee-modal-foot { background: var(--bg-muted); }
[data-theme="dark"] .fee-modal-close { background: var(--bg-muted); color: var(--text-muted); }
[data-theme="dark"] .crm-fu-history,
[data-theme="dark"] .crm-fu-form,
[data-theme="dark"] .crm-switch-row { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .crm-fmt-opt { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .crm-fmt-opt.active { background: linear-gradient(135deg, rgba(59,130,246,.10), transparent); border-color: #2563EB; }
[data-theme="dark"] .crm-fmt-ic { background: var(--bg-muted); color: #93C5FD; }
[data-theme="dark"] .crm-fmt-name { color: var(--text-primary); }
[data-theme="dark"] .crm-fmt-check { color: #93C5FD; }
[data-theme="dark"] .crm-channel { background: var(--bg-card); border-color: var(--border-light); color: var(--text-secondary); }

/* ═══════════════════════════════════════════════════════════════════
   MOBILE RESPONSIVE — internal screen layouts (≤ 600px)
   Lead pipeline list, filters, detail blocks, follow-up modals.
   ═══════════════════════════════════════════════════════════════════ */
@media (max-width: 600px) {
  /* Page header — stack vertically */
  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 12px 14px;
  }
  .page-header .page-title { font-size: 17px; line-height: 1.2; }
  .page-header .page-sub   { font-size: 11.5px; line-height: 1.35; }
  .page-tutorial-btn { align-self: flex-start; }

  /* CRM sub-tabs — horizontal scroll */
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

  /* Status strip — keep 2 col but tight */
  .crm-status-strip { grid-template-columns: 1fr 1fr !important; gap: 8px; }
  .crm-status-card { padding: 11px 13px; }
  .crm-status-card-val { font-size: 18px; }
  .crm-status-card-lbl { font-size: 11px; }

  /* Top stats / fu grid */
  .crm-top-stats { grid-template-columns: 1fr; gap: 10px; }
  .crm-stat-card,
  .crm-fu-card { padding: 12px; }
  .crm-stat-val,
  .crm-fu-val { font-size: 20px; }
  .crm-fu-grid { grid-template-columns: 1fr; gap: 10px; }

  /* CRM toolbar / filter bar — stack and full-width children */
  .crm-toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .crm-toolbar > * { width: 100%; min-width: 0; flex: 1 1 auto; }
  .crm-toolbar .fee-btn { width: 100%; justify-content: center; }

  /* Active filters chip strip — wrap nicely */
  .crm-active-filters { gap: 6px; padding: 9px 12px; font-size: 11.5px; }
  .crm-clear-all { margin-left: 0; }

  /* Lead pipeline table — horizontal scroll wrapper, prevent column squash */
  .fee-section { border-radius: 12px; margin-bottom: 12px; }
  .fee-section--scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .fee-section-body { padding: 14px; }
  .fee-section-header {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 12px 14px;
  }

  /* Lead detail panel grid — single col (already collapses at 880px) */
  .crm-detail-inner { grid-template-columns: 1fr; gap: 12px; padding: 14px; }
  .crm-detail-block { padding: 12px; border-radius: 12px; }
  .crm-detail-grid { grid-template-columns: 1fr; gap: 10px; }

  /* Actions row — wrap and full-width buttons */
  .crm-actions-row {
    flex-wrap: wrap;
    gap: 8px;
  }
  .crm-actions-row > * { flex: 1 1 auto; }

  /* Form grid inside Add/Edit Lead modal — already collapses at 640px; reinforce */
  .crm-form-grid { grid-template-columns: 1fr !important; gap: 12px; }

  /* Follow-up modal grid — collapse */
  .crm-fu-modal { grid-template-columns: 1fr !important; gap: 12px; }
  .crm-fu-history, .crm-fu-form { padding: 12px; }
  .crm-switch-row { flex-direction: column !important; align-items: stretch !important; gap: 8px; padding: 11px 12px; }

  /* Format option grids (share / report) — single col */
  .crm-fmt-grid { grid-template-columns: 1fr !important; gap: 8px; }
  .share-fmt-grid { grid-template-columns: 1fr !important; gap: 8px; }
  .crm-fmt-opt { padding: 11px; }

  /* Inactive stats grid */
  .crm-inactive-stats { grid-template-columns: 1fr !important; gap: 10px; }

  /* Setup grid */
  .setup-grid { grid-template-columns: 1fr !important; gap: 12px; }

  /* Reports grid */
  .rep-grid { grid-template-columns: 1fr !important; gap: 10px; }

  /* Modal foot / head / body padding */
  .fee-modal-foot { flex-wrap: wrap; gap: 8px; padding: 12px 14px; }
  .fee-modal-foot .fee-btn { flex: 1 1 auto; justify-content: center; }
  .fee-modal-head { padding: 12px 14px; }
  .fee-modal-body { padding: 14px; }
  .fee-modal-head-icon { width: 36px; height: 36px; font-size: 14px; }

  /* Search dropdown / iconbtn rows */
  .fee-search-box, .fee-select { width: 100%; }
  .crm-iconbtn { padding: 7px 9px; }
}

@media (max-width: 480px) {
  .crm-status-strip { grid-template-columns: 1fr !important; }
  .fee-section-body { padding: 12px; }
  .fee-subtab { padding: 9px 12px; font-size: 12px; }
  .crm-detail-inner { padding: 12px; }
  .crm-stat-val, .crm-fu-val { font-size: 18px; }
}
`;
