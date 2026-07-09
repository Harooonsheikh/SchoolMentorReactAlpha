import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from './Tooltip';
import TutorialModal from './TutorialModal';
import * as timeTableService from '../services/timeTableService';
import useAsync from '../hooks/useAsync';
import { useSettings } from '../pages/Settings/settingsStore';

/* ═══════════════════════════════════════════════════════════════════
   TIME TABLE — module shell
   Ported from Launch Setup → Timetable screens.
   Same design system + fonts as Paper Generator / Attendance.
   ═══════════════════════════════════════════════════════════════════ */

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* Auto-generate subject-planning list (subjects are UI/planning only — the
   timetable API stores teacher + time per period, not subject). */
const TT_SUBJECTS = ['English', 'Urdu', 'Mathematics', 'Science', 'Social Studies', 'Islamiyat', 'Computer'];

const SUBJ_COLORS = {
  English:          '#1E40AF',
  Urdu:             '#7E22CE',
  Mathematics:      '#C2410C',
  Science:          '#15803D',
  'Social Studies': '#B45309',
  Islamiyat:        '#0E7490',
  Computer:         '#6D28D9',
  Break:            '#DC2626',
};

/* Cycles per-period inside the edit modal to mirror the HTML reference. */
const PERIOD_COLORS = ['#1E3A8A', '#0369A1', '#15803D', '#7C3AED', '#B45309', '#BE185D', '#0F766E'];
const CLASS_AVATAR_COLORS = ['#1E3A8A', '#0369A1', '#15803D', '#7C3AED', '#B45309', '#BE185D', '#0F766E'];

/* Timetable data now loads via timeTableService
   (src/services/timeTableService.js). Save/delete remain in-memory
   until backend wires the matching endpoints. */

/* ── helpers ────────────────────────────────────────────────────── */
function fmt12(t) {
  if (!t || !t.includes(':')) return t || '—';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m < 10 ? '0' + m : m} ${ampm}`;
}

function fmt12plain(t) { return fmt12(t); }

function minutesBetween(a, b) {
  if (!a || !b) return 0;
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  return Math.max(0, (bh * 60 + bm) - (ah * 60 + am));
}

function fmtDuration(min) {
  if (!min) return '';
  return min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min} min`;
}

/* Run async thunks with LIMITED concurrency. Auto-generate can save hundreds of
   period rows; firing them all at once floods the browser's ~6-connection limit
   so every request sits "pending" and never resolves. A small worker pool keeps
   only `limit` requests in flight at a time, so they actually complete. */
async function runLimited(thunks, limit = 4) {
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, thunks.length || 0) }, async () => {
    while (idx < thunks.length) {
      const my = idx++;
      try { await thunks[my](); } catch (e) { console.error('TimeTable batch job failed:', e); }
    }
  });
  await Promise.all(workers);
}

/* ═══════════════════════════════════════════════════════════════════
   PDF report builders — exact port of HTML reference
   ═══════════════════════════════════════════════════════════════════ */

/* Shared portrait header (used by Daily / Weekly / Period Count) */
function ttPageWrap(hdr, dateStr, timeStr, title, body, isBW) {
  /* `hdr` is the /report-header record: { name, logo, address, session }.
     Two coordinated palettes:
     • Colorful: brand-blue gradient logo, brand-tinted title band.
     • Colorless: dedicated LOW-INK layout — white logo with dark border,
       white title band with thin border, no decorative watermark. */
  const h = hdr || {};
  const name = h.name || 'School Mentor';
  const logo = h.logo || '';
  const address = h.address || '';
  const session = h.session || '';
  const hdrBorder = isBW ? '1.5px solid #0F172A' : '3px solid #1E3A8A';
  const logoBg    = logo ? '#FFFFFF' : (isBW ? '#FFFFFF' : 'linear-gradient(135deg,#1E3A8A,#2563EB)');
  const logoColor = isBW ? '#0F172A' : '#FFFFFF';
  const logoBorder = (isBW || logo) ? '1px solid #E2E8F0' : 'none';
  const titleBg   = isBW ? '#FFFFFF' : '#EFF6FF';
  const titleBdr  = isBW ? '#D1D5DB' : '#BFDBFE';
  const logoInner = logo
    ? `<img src="${logo}" alt="logo" style="width:100%;height:100%;object-fit:contain;border-radius:10px" onerror="this.remove()" />`
    : 'SM';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Plus Jakarta Sans",sans-serif;font-size:12px;color:#0F172A;background:#fff}
.hdr{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:${hdrBorder};margin-bottom:16px}
.logo{width:46px;height:46px;border-radius:10px;background:${logoBg};border:${logoBorder};display:flex;align-items:center;justify-content:center;color:${logoColor};font-size:13px;font-weight:800;overflow:hidden;flex-shrink:0}
.school-name{font-size:17px;font-weight:800;color:#0F172A;margin-left:12px}
.school-sess{font-size:10.5px;font-weight:600;color:#64748B;margin-left:12px;margin-top:2px}
.meta{font-size:10px;color:#64748B;text-align:right;line-height:1.55}
.report-title{text-align:center;font-size:14px;font-weight:800;padding:10px;background:${titleBg};border:1px solid ${titleBdr};margin:0 24px 16px;border-radius:6px;color:#0F172A}
.content{padding:0 24px 8px}
.doc-foot{margin:16px 24px 20px;padding-top:10px;border-top:1px solid #E2E8F0;display:flex;justify-content:space-between;align-items:center;font-size:9.5px;color:#64748B;gap:10px;flex-wrap:wrap}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="hdr">
  <div style="display:flex;align-items:center">
    <div class="logo">${logoInner}</div>
    <div>
      <div class="school-name" style="margin-left:12px">${name}</div>
      ${session ? `<div class="school-sess">${session}</div>` : ''}
    </div>
  </div>
  <div class="meta">Generated Date : ${dateStr}<br>Generated Time : ${timeStr}<br>Generated By : Administrator${isBW ? '<br><b>Colorless Print</b>' : ''}</div>
</div>
<div class="report-title">Report Name : ${title}</div>
<div class="content">${body}</div>
<div class="doc-foot">
  <span>${name}${address ? ' · ' + address : ''}</span>
  <span>School Mentor ERP · Confidential</span>
</div>
</body></html>`;
}

/* Period rows — used by Daily + Weekly reports.
   Column order (matches HTML): Sr No, Subject, Teacher, Start Time, End Time. */
function ttPeriodRowsHtml(periods, isBW) {
  /* Colorless: no alt-row fill, break row is a thin bordered cell (no
     filled red/gray block), break label becomes a bordered text pill. */
  const rowAlt = isBW ? '#FFFFFF' : '#f8faff';
  const brkBg  = isBW ? '#FFFFFF' : '#FEF2F2';
  const brkClr = isBW ? '#111111' : '#DC2626';
  const brkBdr = isBW ? '#D1D5DB' : '#FCA5A5';
  if (!periods || periods.length === 0) {
    return '<tr><td colspan="5" style="text-align:center;color:#888;padding:16px">No periods set</td></tr>';
  }
  return periods.map((p, i) => {
    const isBreak = p.subject === 'Break';
    const rowBg = isBreak ? brkBg : (i % 2 === 0 ? '#fff' : rowAlt);
    const breakBadge = isBW
      ? `<span style="background:transparent;color:${brkClr};border:1px solid ${brkBdr};padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700">Break</span>`
      : `<span style="background:${brkClr};color:#fff;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700">☕ Break</span>`;
    return `<tr style="background:${rowBg}${isBreak && isBW ? `;border-left:3px solid ${brkBdr}` : ''}">
      <td style="padding:7px 10px;border-bottom:1px solid #ddd;font-weight:700;color:${isBreak ? brkClr : '#64748B'}">${i + 1}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #ddd">${isBreak ? breakBadge : (p.subject || '—')}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #ddd">${isBreak ? '—' : (p.teacher || '—')}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #ddd;font-weight:600;color:${isBreak ? brkClr : 'inherit'}">${fmt12plain(p.startTime)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #ddd;font-weight:600;color:${isBreak ? brkClr : 'inherit'}">${fmt12plain(p.endTime)}</td>
    </tr>`;
  }).join('');
}

function ttHeaderRowHtml(isBW) {
  /* Colorless: table head is white with dark text and a thin gray
     bottom border, instead of a near-black row band. */
  const hdrBg = isBW ? '#FFFFFF' : '#1E3A8A';
  const hdrFg = isBW ? '#0F172A' : '#FFFFFF';
  const hdrBorder = isBW ? 'border-bottom:1.5px solid #0F172A;' : '';
  return `<tr style="background:${hdrBg};color:${hdrFg};${hdrBorder}">
    <th style="padding:8px 10px;text-align:left">Sr. No</th>
    <th style="padding:8px 10px;text-align:left">Subject</th>
    <th style="padding:8px 10px;text-align:left">Teacher</th>
    <th style="padding:8px 10px;text-align:left">Start Time</th>
    <th style="padding:8px 10px;text-align:left">End Time</th>
  </tr>`;
}

function buildDailyTTReport({ header, cls, section, day, periods, isBW }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-PK');
  const timeStr = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  const body = `<table style="width:100%;border-collapse:collapse;margin-top:10px">
    <thead>${ttHeaderRowHtml(isBW)}</thead>
    <tbody>${ttPeriodRowsHtml(periods, isBW)}</tbody>
  </table>`;
  return ttPageWrap(header, dateStr, timeStr, `Daily Timetable Report — ${cls} Section ${section} — ${day}`, body, isBW);
}

function buildWeeklyTTReport({ header, cls, section, weekPeriods, isBW }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-PK');
  const timeStr = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  /* Colorless: day-name band turns into a white block with a dark left
     bar (was a gray fill with black side bar). */
  const dayHdrBg = isBW ? '#FFFFFF' : '#EFF6FF';
  const dayBorder = isBW ? '#0F172A' : '#1E3A8A';
  const dayBlocks = DAYS.map((day, di) => {
    const periods = weekPeriods[di] || [];
    return `<div style="margin-bottom:18px">
      <div style="font-size:13px;font-weight:700;padding:7px 10px;background:${dayHdrBg};border-left:4px solid ${dayBorder};margin-bottom:0">${day}</div>
      <table style="width:100%;border-collapse:collapse;font-size:11.5px">
        <thead>${ttHeaderRowHtml(isBW)}</thead>
        <tbody>${ttPeriodRowsHtml(periods, isBW)}</tbody>
      </table>
    </div>`;
  }).join('');
  return ttPageWrap(header, dateStr, timeStr, `Weekly Timetable Report For ${cls} Section ${section}`, dayBlocks, isBW);
}

function buildPeriodCountReport({ header, cls, section, weekPeriods, isBW }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-PK');
  const timeStr = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  /* Colorless: header row + total row become white-on-white with dark
     borders instead of filled blocks. */
  const hdrBg     = isBW ? '#FFFFFF' : '#1E3A8A';
  const hdrFg     = isBW ? '#0F172A' : '#FFFFFF';
  const hdrBorder = isBW ? 'border-bottom:1.5px solid #0F172A;' : '';
  const rowAlt    = isBW ? '#FFFFFF' : '#f8faff';
  const totBg     = isBW ? '#FFFFFF' : '#EFF6FF';
  const totClr    = isBW ? '#0F172A' : '#1E3A8A';
  /* Period count = total periods PER SUBJECT for this class across the whole
     week (skip Breaks). A period whose subject isn't persisted is grouped under
     "Unassigned" so it is still counted and the total matches real periods. */
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const counts = {};
  let grand = 0;
  DAYS.forEach((day, di) => {
    (weekPeriods[di] || []).forEach((p) => {
      if (!p || p.subject === 'Break') return;
      const subj = (p.subject || '').trim() || 'Unassigned';
      counts[subj] = (counts[subj] || 0) + 1;
      grand += 1;
    });
  });
  /* Most periods first, then alphabetical for ties. */
  const subjects = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));

  let countRows = '';
  if (subjects.length === 0) {
    countRows = '<tr><td colspan="3" style="text-align:center;color:#888;padding:16px">No periods set</td></tr>';
  } else {
    subjects.forEach((subj, i) => {
      countRows += `<tr style="background:${i % 2 === 0 ? '#fff' : rowAlt}">
        <td style="padding:8px 10px;border-bottom:1px solid #ddd">${i + 1}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #ddd">${esc(subj)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #ddd;font-weight:700;color:${totClr}">${counts[subj]}</td>
      </tr>`;
    });
  }
  countRows += `<tr style="background:${totBg};font-weight:800">
    <td colspan="2" style="padding:8px 10px;border-top:2px solid ${totClr}">Total Periods</td>
    <td style="padding:8px 10px;border-top:2px solid ${totClr};color:${totClr}">${grand}</td>
  </tr>`;
  const body = `<table style="width:100%;border-collapse:collapse">
    <thead><tr style="background:${hdrBg};color:${hdrFg};${hdrBorder}">
      <th style="padding:8px 10px;text-align:left">Sr. No</th>
      <th style="padding:8px 10px;text-align:left">Subject</th>
      <th style="padding:8px 10px;text-align:left">Total Periods</th>
    </tr></thead>
    <tbody>${countRows}</tbody>
  </table>`;
  return ttPageWrap(header, dateStr, timeStr, `Period Count Report — ${cls} Section ${section}`, body, isBW);
}

/* ─────────────────────────────────────────────────────────────────
   School-wide reports (landscape A4) — Day Wise / Weekly
   Rich-grid output matching the HTML reference.
   ─────────────────────────────────────────────────────────────── */
const SCHOOL_RPT_SUBJ_PALETTE = [
  { bg: '#1E3A8A', light: '#DBEAFE' },
  { bg: '#15803D', light: '#DCFCE7' },
  { bg: '#B91C1C', light: '#FEE2E2' },
  { bg: '#B45309', light: '#FEF3C7' },
  { bg: '#6D28D9', light: '#EDE9FE' },
  { bg: '#0369A1', light: '#E0F2FE' },
  { bg: '#0F766E', light: '#CCFBF1' },
  { bg: '#9D174D', light: '#FCE7F3' },
  { bg: '#1D4ED8', light: '#DBEAFE' },
  { bg: '#065F46', light: '#D1FAE5' },
];

function schoolPeriodCellHtml(p, subjColorMap, idxRef, isBW = false) {
  if (!p) return `<div style="color:#CBD5E1;font-size:8px;text-align:center;padding:4px">—</div>`;
  const isBreak = p.subject === 'Break';
  if (isBreak) {
    if (isBW) {
      return `<div style="background:#FFFFFF;border:1px solid #9CA3AF;border-radius:5px;padding:4px 6px;text-align:center">
        <div style="font-size:8px;font-weight:800;color:#111">BREAK</div>
        <div style="font-size:7px;color:#4B5563;margin-top:2px">${fmt12plain(p.startTime)} – ${fmt12plain(p.endTime)}</div>
      </div>`;
    }
    return `<div style="background:linear-gradient(135deg,#FEF2F2,#FFE4E4);border:1.5px solid #FCA5A5;border-radius:5px;padding:4px 6px;text-align:center">
      <div style="font-size:8px;font-weight:800;color:#DC2626">☕ BREAK</div>
      <div style="font-size:7px;color:#EF4444;margin-top:2px">${fmt12plain(p.startTime)} – ${fmt12plain(p.endTime)}</div>
    </div>`;
  }
  /* Subject mapped na ho to bhi period ko dikhao (teacher/time ke saath) aur "No Subject"
     likho — sirf bilkul khaali slot (na subject, na teacher, na time) par hi "—". */
  const hasSubj = !!p.subject && String(p.subject).trim() !== '';
  if (!hasSubj && !p.teacher && !p.startTime && !p.endTime) {
    return `<div style="color:#CBD5E1;font-size:8px;text-align:center;padding:4px">—</div>`;
  }
  const subjLabel = hasSubj ? p.subject : 'No Subject';
  let c;
  if (hasSubj) {
    if (!subjColorMap[p.subject]) {
      subjColorMap[p.subject] = SCHOOL_RPT_SUBJ_PALETTE[idxRef.i++ % SCHOOL_RPT_SUBJ_PALETTE.length];
    }
    c = subjColorMap[p.subject];
  } else {
    c = { bg: '#64748B', light: '#F1F5F9' }; // No Subject → muted gray
  }
  if (isBW) {
    return `<div style="background:#FFFFFF;border:1px solid #D1D5DB;border-left:3px solid ${hasSubj ? '#0F172A' : '#9CA3AF'};border-radius:4px;padding:4px 5px">
      <div style="font-size:8.5px;font-weight:700;color:${hasSubj ? '#0F172A' : '#6B7280'};line-height:1.2">${subjLabel}</div>
      ${p.teacher ? `<div style="font-size:7.5px;color:#4B5563;margin-top:1px">${p.teacher}</div>` : ''}
      <div style="font-size:7px;color:#6B7280;margin-top:1px">${fmt12plain(p.startTime)}${p.endTime ? ' – ' + fmt12plain(p.endTime) : ''}</div>
    </div>`;
  }
  return `<div style="background:${c.light};border-left:3px solid ${c.bg};border-radius:4px;padding:4px 5px">
    <div style="font-size:8.5px;font-weight:700;color:${c.bg};line-height:1.2">${subjLabel}</div>
    ${p.teacher ? `<div style="font-size:7.5px;color:#475569;margin-top:1px">👤 ${p.teacher}</div>` : ''}
    <div style="font-size:7px;color:#94A3B8;margin-top:1px">⏱ ${fmt12plain(p.startTime)}${p.endTime ? ' – ' + fmt12plain(p.endTime) : ''}</div>
  </div>`;
}

function buildSchoolReport({ type, day, allData, header, classes = [], isBW = false }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  /* Report header (school name + logo + address) from /report-header. */
  const h = header || {};
  const school = h.name || 'School Mentor';
  const schoolLogo = h.logo || '';
  const schoolAddr = h.address || '';
  const schoolLogoHtml = schoolLogo
    ? `<img src="${schoolLogo}" alt="logo" style="width:100%;height:100%;object-fit:contain;border-radius:10px" onerror="this.remove()" />`
    : 'SM';
  const rows = (classes || []).map((cls, ci) => ({ ...cls, _ci: ci }));
  const subjColorMap = {};
  const idxRef = { i: 0 };

  let bodyHtml = '';
  let totalPeriods = 0;

  if (type === 'daywise') {
    /* DAY WISE — rows = classes, cols = periods grid */
    let maxPeriods = 0;
    rows.forEach((row) => {
      const key = `${row.id}_${row.sectionID}`;
      const p = (allData[day] || {})[key] || [];
      if (p.length > maxPeriods) maxPeriods = p.length;
    });
    maxPeriods = Math.max(maxPeriods, 1);

    let timeHeaders = '';
    for (let pi = 0; pi < maxPeriods; pi++) {
      let timeLabel = '';
      for (const row of rows) {
        const key = `${row.id}_${row.sectionID}`;
        const ps = (allData[day] || {})[key] || [];
        if (ps[pi]) {
          timeLabel = ps[pi].startTime && ps[pi].endTime ? `${ps[pi].startTime}–${ps[pi].endTime}` : (ps[pi].startTime || '');
          break;
        }
      }
      timeHeaders += `<th style="padding:6px 5px;background:#1E3A8A;color:#fff;font-size:8px;font-weight:700;text-align:center;border:1px solid #1D4ED8;white-space:nowrap;min-width:90px">
        <div>Period ${pi + 1}</div>
        ${timeLabel ? `<div style="font-size:7px;font-weight:400;opacity:.8;margin-top:1px">${timeLabel}</div>` : ''}
      </th>`;
    }

    const tableRows = rows.map((row, ri) => {
      const key = `${row.id}_${row.sectionID}`;
      const periods = (allData[day] || {})[key] || [];
      totalPeriods += periods.length;
      const ac = CLASS_AVATAR_COLORS[ri % CLASS_AVATAR_COLORS.length];
      let cells = '';
      for (let pi = 0; pi < maxPeriods; pi++) {
        cells += `<td style="padding:4px 5px;border:1px solid #E2E8F0;vertical-align:top;background:${ri % 2 === 0 ? '#fff' : '#F8FAFC'}">${schoolPeriodCellHtml(periods[pi], subjColorMap, idxRef, isBW)}</td>`;
      }
      return `<tr>
        <td style="padding:6px 8px;border:1px solid #E2E8F0;background:${ri % 2 === 0 ? '#EFF6FF' : '#DBEAFE'};white-space:nowrap;vertical-align:middle">
          <div style="display:flex;align-items:center;gap:6px">
            <div style="width:22px;height:22px;border-radius:5px;background:${ac};display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:800;flex-shrink:0">${row.name.charAt(0).toUpperCase()}</div>
            <div>
              <div style="font-size:9.5px;font-weight:700;color:#1E3A8A">${row.name}</div>
              <div style="font-size:8px;color:#64748B">Sec ${row.section}</div>
            </div>
          </div>
        </td>
        ${cells}
      </tr>`;
    }).join('');

    bodyHtml = `
      <div style="margin-bottom:10px;display:flex;align-items:center;gap:10px">
        <div style="padding:4px 14px;background:linear-gradient(135deg,#1E3A8A,#1D4ED8);color:#fff;border-radius:99px;font-size:10px;font-weight:700">${DAYS[day]}</div>
        <div style="font-size:9px;color:#64748B">Showing all ${rows.length} class${rows.length !== 1 ? 'es' : ''} · ${maxPeriods} period slot${maxPeriods !== 1 ? 's' : ''}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;table-layout:fixed">
        <thead>
          <tr>
            <th style="padding:6px 8px;background:#172554;color:#fff;font-size:9px;font-weight:700;text-align:left;border:1px solid #1E3A8A;width:90px">CLASS</th>
            ${timeHeaders}
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>`;
  } else {
    /* WEEKLY — per-class block, rows = periods, cols = days */
    rows.forEach((row, ri) => {
      const key = `${row.id}_${row.sectionID}`;
      const ac = CLASS_AVATAR_COLORS[ri % CLASS_AVATAR_COLORS.length];

      let maxP = 0;
      DAYS.forEach((_, di) => {
        const ps = (allData[di] || {})[key] || [];
        totalPeriods += ps.length;
        if (ps.length > maxP) maxP = ps.length;
      });
      maxP = Math.max(maxP, 1);

      let periodRows = '';
      for (let pi = 0; pi < maxP; pi++) {
        let timeRange = `Period ${pi + 1}`;
        for (let di = 0; di < DAYS.length; di++) {
          const ps = (allData[di] || {})[key] || [];
          if (ps[pi] && ps[pi].startTime) {
            timeRange = `${ps[pi].startTime}${ps[pi].endTime ? ' – ' + ps[pi].endTime : ''}`;
            break;
          }
        }
        const dayCells = DAYS.map((_, di) => {
          const ps = (allData[di] || {})[key] || [];
          return `<td style="padding:4px 5px;border:1px solid #E2E8F0;vertical-align:top;min-width:100px">${schoolPeriodCellHtml(ps[pi], subjColorMap, idxRef, isBW)}</td>`;
        }).join('');
        periodRows += `<tr>
          <td style="padding:5px 8px;border:1px solid #E2E8F0;background:#F1F5F9;white-space:nowrap;vertical-align:middle">
            <div style="font-size:8.5px;font-weight:700;color:#1E3A8A">Period ${pi + 1}</div>
            <div style="font-size:7.5px;color:#94A3B8">${timeRange}</div>
          </td>
          ${dayCells}
        </tr>`;
      }

      bodyHtml += `
        <div style="margin-bottom:${ri < rows.length - 1 ? '18px' : '0'};break-inside:avoid">
          <div style="display:flex;align-items:center;gap:8px;padding:7px 12px;background:linear-gradient(135deg,#172554,#1E3A8A);border-radius:7px 7px 0 0">
            <div style="width:22px;height:22px;border-radius:5px;background:${ac};display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:800;flex-shrink:0">${row.name.charAt(0).toUpperCase()}</div>
            <span style="font-size:11px;font-weight:700;color:#fff">${row.name} &nbsp;·&nbsp; Section ${row.section}</span>
            <span style="margin-left:auto;font-size:9px;color:rgba(255,255,255,.6)">${maxP} period slot${maxP !== 1 ? 's' : ''} / day</span>
          </div>
          <table style="width:100%;border-collapse:collapse;table-layout:fixed">
            <thead>
              <tr>
                <th style="padding:5px 8px;background:#1E3A8A;color:#fff;font-size:8.5px;font-weight:700;text-align:left;border:1px solid #1D4ED8;width:80px">TIME</th>
                ${DAYS.map((d) => `<th style="padding:5px 6px;background:#1E3A8A;color:#fff;font-size:8.5px;font-weight:700;text-align:center;border:1px solid #1D4ED8">${d}</th>`).join('')}
              </tr>
            </thead>
            <tbody>${periodRows}</tbody>
          </table>
        </div>`;
    });
  }

  const rptId = `RPT-TT-${Date.now().toString(36).toUpperCase()}`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>School Timetable Report</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Plus Jakarta Sans",sans-serif;font-size:11px;color:#0F172A;background:#fff}
@page{size:A4 landscape;margin:8mm 10mm}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact} .no-break{break-inside:avoid}}
/* Colorless Report — flattens gradients / colored bands / colored
   table heads to dark-on-white with thin gray borders. Activates only
   when .tt-school-bw is present on the body. */
.tt-school-bw [style*="border-bottom:3px solid #1E3A8A"]{border-bottom-color:#0F172A !important;border-bottom-width:1.5px !important;}
.tt-school-bw [style*="linear-gradient(135deg,#172554,#1E3A8A,#2563EB)"]{background:#FFFFFF !important;color:#0F172A !important;border:1px solid #0F172A !important;}
.tt-school-bw [style*="linear-gradient(135deg,#1E3A8A,#1D4ED8)"]{background:transparent !important;color:#0F172A !important;border:1px solid #9CA3AF !important;}
.tt-school-bw [style*="linear-gradient(135deg,#172554,#1E3A8A)"]{background:#FFFFFF !important;color:#0F172A !important;border:1.5px solid #0F172A !important;}
.tt-school-bw [style*="background:#EFF6FF"][style*="border:1px solid #BFDBFE"]{background:#FFFFFF !important;border-color:#D1D5DB !important;}
.tt-school-bw [style*="background:#F0FDF4"][style*="border:1px solid #BBF7D0"]{background:#FFFFFF !important;border-color:#D1D5DB !important;}
.tt-school-bw [style*="color:#1E3A8A"]{color:#0F172A !important;}
.tt-school-bw [style*="color:#15803D"]{color:#0F172A !important;}
.tt-school-bw th[style*="background:#1E3A8A"],
.tt-school-bw th[style*="background:#172554"]{background:#FFFFFF !important;color:#0F172A !important;border:1px solid #9CA3AF !important;border-bottom:1.5px solid #0F172A !important;}
.tt-school-bw td[style*="background:#EFF6FF"],
.tt-school-bw td[style*="background:#DBEAFE"],
.tt-school-bw td[style*="background:#F1F5F9"]{background:#FFFFFF !important;}
/* Class avatar squares — flatten the per-class colored chip to a bordered
   monogram. Each avatar has both an inline width:22px AND a background. */
.tt-school-bw div[style*="width:22px"][style*="height:22px"]{background:#FFFFFF !important;color:#0F172A !important;border:1px solid #0F172A !important;}
</style></head><body${isBW ? ' class="tt-school-bw"' : ''}>
<div style="display:flex;align-items:center;justify-content:space-between;padding:0 0 10px;border-bottom:3px solid #1E3A8A;margin-bottom:10px">
  <div style="display:flex;align-items:center;gap:12px">
    <div style="width:40px;height:40px;border-radius:10px;background:${schoolLogo ? '#FFFFFF' : 'linear-gradient(135deg,#172554,#1E3A8A,#2563EB)'};border:${schoolLogo ? '1px solid #E2E8F0' : 'none'};display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:800;flex-shrink:0;overflow:hidden">${schoolLogoHtml}</div>
    <div>
      <div style="font-size:15px;font-weight:800;color:#0F172A;line-height:1">${school}</div>
      <div style="font-size:8.5px;color:#64748B;letter-spacing:.6px;text-transform:uppercase;margin-top:3px">School Timetable Report · ${type === 'daywise' ? DAYS[day] + ' Schedule' : 'Full Week Schedule'}</div>
    </div>
  </div>
  <div style="display:flex;gap:16px;align-items:center">
    <div style="text-align:center;padding:6px 14px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px">
      <div style="font-size:16px;font-weight:800;color:#1E3A8A">${rows.length}</div>
      <div style="font-size:7.5px;color:#64748B;text-transform:uppercase;letter-spacing:.5px">Classes</div>
    </div>
    <div style="text-align:center;padding:6px 14px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px">
      <div style="font-size:16px;font-weight:800;color:#15803D">${totalPeriods}</div>
      <div style="font-size:7.5px;color:#64748B;text-transform:uppercase;letter-spacing:.5px">Total Periods</div>
    </div>
    <div style="text-align:right;font-size:8.5px;color:#94A3B8;line-height:1.7">
      <div style="font-weight:600;color:#475569">${dateStr}</div>
      <div>${timeStr} · Administrator</div>
      <div style="font-size:7.5px;margin-top:2px;color:#CBD5E1">${rptId}</div>
    </div>
  </div>
</div>
${bodyHtml}
<div style="margin-top:12px;padding-top:7px;border-top:1px solid #E2E8F0;display:flex;justify-content:space-between;align-items:center;font-size:8px;color:#94A3B8">
  <span>${school}${schoolAddr ? ' · ' + schoolAddr : ''}</span>
  <div style="display:flex;gap:14px">
    ${isBW
      ? '<span>Subject Period — bordered cell</span><span>Break — outlined cell</span><span>Teacher name shown below subject</span><span>Timings shown in each cell</span>'
      : '<span>📘 Blue = Subject Period</span><span>🔴 Red = Break</span><span>👤 Teacher name shown below subject</span><span>⏱ Timings shown in each cell</span>'}
  </div>
  <span>Confidential — For internal use only</span>
</div>
</body></html>`;
}

/* In-app report preview overlay (replaces popup window).
   Avoids browser popup-blocker quirks + native window.print() dialog
   freezing the tab on the second click. */
function ReportPreviewOverlay({ open, title, html, landscape, onClose }) {
  const frameRef = React.useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const print = () => {
    const fr = frameRef.current;
    if (!fr || !fr.contentWindow) return;
    try { fr.contentWindow.focus(); fr.contentWindow.print(); }
    catch { /* swallow — keep the preview open */ }
  };

  if (!open) return null;

  return createPortal(
    <div
      style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(15,23,42,.7)', backdropFilter:'blur(4px)', display:'flex', flexDirection:'column', alignItems:'center', padding:16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width:'100%', maxWidth:landscape ? 1100 : 960, display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:8, background:'linear-gradient(135deg,#1E3A8A,#2563EB)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:16 }}>
            <i className="fa-solid fa-file-pdf"></i>
          </div>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:'#fff' }}>{title}</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.6)' }}>Preview — click Print to print or save as PDF</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Tooltip text="Print or save the report as PDF">
            <button onClick={print} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', background:'linear-gradient(135deg,#1E3A8A,#2563EB)', color:'#fff', border:'none', borderRadius:8, fontFamily:'var(--font-body)', fontSize:12.5, fontWeight:700, cursor:'pointer' }}>
              <i className="fa-solid fa-print"></i> Print / Save PDF
            </button>
          </Tooltip>
          <Tooltip text="Close report preview">
            <button onClick={onClose} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:'rgba(255,255,255,.12)', color:'#fff', border:'1.5px solid rgba(255,255,255,.2)', borderRadius:8, fontFamily:'var(--font-body)', fontSize:12.5, fontWeight:700, cursor:'pointer' }}>
              <i className="fa-solid fa-xmark"></i> Close
            </button>
          </Tooltip>
        </div>
      </div>
      <iframe
        ref={frameRef}
        title="Timetable Report Preview"
        srcDoc={html}
        style={{ width:'100%', maxWidth:landscape ? 1100 : 960, flex:1, border:'none', borderRadius:12, background:'#fff', boxShadow:'0 20px 60px rgba(0,0,0,.4)', minHeight:0 }}
      />
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Main TimeTable component
   ═══════════════════════════════════════════════════════════════════ */
export default function TimeTable({ toast = () => {} }) {
  const [day, setDay] = useState(0);          // 0 = Monday
  const [expandedKey, setExpandedKey] = useState(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const { data = {}, setData, refetch: reloadTimeTable } = useAsync(timeTableService.getTimeTable, []);
  /* Real class×section rows and branch teachers (no more dummy data). */
  const { data: classes = [] }  = useAsync(timeTableService.getTimeTableClasses, []);
  const { data: teachers = [] } = useAsync(timeTableService.getTeachers, []);
  /* Branch report header (school name + logo + address) for report header/footer. */
  const { data: reportHeader = {} } = useAsync(timeTableService.getReportHeader, []);

  /* ── Session-based edit gating (same rule as Academics / Examination) ──
     View-only (edit/update/delete disabled) when: there is no current session,
     OR the current session has the Timetable module unchecked in Session
     Settings, OR today (UTC) is outside the current session's start–end window. */
  const { currentSession } = useSettings();
  const isOtherSession = (() => {
    if (!currentSession) return true;
    if (!(currentSession.modules || []).includes('tt')) return true;
    const { startDate, endDate } = currentSession;
    if (!startDate || !endDate) return true;
    const todayUtc = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
    const startUtc = new Date(startDate + 'T00:00:00Z');
    const endUtc   = new Date(endDate   + 'T00:00:00Z');
    if (todayUtc < startUtc || todayUtc > endUtc) return true;
    return false;
  })();

  /* Modal state */
  const [editTarget, setEditTarget]               = useState(null); // { key, cls, section }
  const [downloadTarget, setDownloadTarget]       = useState(null); // { key, cls, section }
  const [schoolReportOpen, setSchoolReportOpen]   = useState(false);
  const [reportPreview, setReportPreview]         = useState(null); // { title, html, landscape }
  const [deletePayload, setDeletePayload]         = useState(null); // { type, key?, cls?, section? }
  const [autoGenOpen, setAutoGenOpen]             = useState(false);

  const dayData = data[day] || {};

  /* Clear the whole day (all classes) — delete every period row for the day. */
  const deleteDay = async () => {
    try {
      const allPeriods = Object.values(data[day] || {}).flat();
      await timeTableService.deleteClassDayTimeTable(allPeriods);
      await reloadTimeTable();
      toast(`${DAYS[day]} timetable cleared for all classes`, 'success');
    } catch (e) {
      console.error('Could not clear day timetable:', e);
      toast('Could not clear timetable', 'error');
    }
    setDeletePayload(null);
  };

  /* Remove one class's timetable for the day (delete its period rows by id). */
  const deleteClassDay = async (key) => {
    try {
      await timeTableService.deleteClassDayTimeTable((data[day] || {})[key] || []);
      await reloadTimeTable();
      toast(`Timetable removed for ${DAYS[day]}`, 'success');
    } catch (e) {
      console.error('Could not delete class timetable:', e);
      toast('Could not delete timetable', 'error');
    }
    setDeletePayload(null);
  };

  return (
    <>
      <style>{TT_CSS}</style>

      {/* Page header */}
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title-icon"><i className="fa-solid fa-calendar-days"></i></div>
          <div>
            <div className="page-title">Timetable</div>
            <div className="page-sub">Manage daily &amp; weekly class schedules for the whole school</div>
          </div>
        </div>
        <Tooltip text="Play a short tutorial for the Timetable module">
          <button
            className="tutorial-btn page-tutorial-btn"
            onClick={() => setTutorialOpen(true)}
          >
            <div className="play-dot"><i className="fa-solid fa-play" style={{ fontSize: 8 }}></i></div>
            <span className="tutorial-label">Tutorial</span>
          </button>
        </Tooltip>
      </div>

      {/* Toolbar */}
      <div className="tt-toolbar">
        <div className="tt-toolbar-left">
          <div className="tt-toolbar-title">
            <i className="fa-solid fa-calendar-alt" style={{ color: 'var(--brand-primary)', marginRight: 8 }}></i>
            Timetable
          </div>
          <div className="tt-toolbar-sub">Edit per class · per day · or auto-generate the whole week</div>
        </div>
        <div className="tt-toolbar-right">
          <Tooltip text={isOtherSession ? 'Editing is only allowed for the current session' : 'Auto-generate the full weekly timetable for all classes'}>
            <button className="tt-btn tt-btn-purple" disabled={isOtherSession}
              style={isOtherSession ? { opacity: .45, cursor: 'not-allowed' } : undefined}
              onClick={() => { if (isOtherSession) { toast('Method not allowed', 'error'); return; } setAutoGenOpen(true); }}>
              <i className="fa-solid fa-wand-magic-sparkles"></i> Auto Generate
            </button>
          </Tooltip>
          <Tooltip text={isOtherSession ? 'Editing is only allowed for the current session' : `Clear the entire ${DAYS[day]} timetable for all classes`}>
            <button className="tt-btn tt-btn-red" disabled={isOtherSession}
              style={isOtherSession ? { opacity: .45, cursor: 'not-allowed' } : undefined}
              onClick={() => { if (isOtherSession) { toast('Method not allowed', 'error'); return; } setDeletePayload({ type: 'day' }); }}>
              <i className="fa-solid fa-trash-can"></i> Delete Day
            </button>
          </Tooltip>
          <Tooltip text="Download a school-wide PDF (day-wise or weekly)">
            <button className="tt-btn tt-btn-pdf" onClick={() => setSchoolReportOpen(true)}>
              <i className="fa-solid fa-file-pdf"></i> Download Report
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Day tabs */}
      <div className="tt-day-tabs">
        {DAYS.map((d, i) => (
          <button
            key={d}
            className={`tt-day-btn${day === i ? ' active' : ''}`}
            onClick={() => { setDay(i); setExpandedKey(null); }}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Main class table */}
      <div className="tt-table-card">
        <div className="tt-table-head">
          <div className="tt-th">S. No.</div>
          <div className="tt-th">Class</div>
          <div className="tt-th">Section</div>
          <div className="tt-th">Actions</div>
          <div className="tt-th" style={{ textAlign: 'center' }}>Details</div>
        </div>

        {classes.map((cls, i) => {
          const key = `${cls.id}_${cls.sectionID}`;
          const periods = dayData[key] || [];
          const isExp = expandedKey === key;
          const avatarColor = CLASS_AVATAR_COLORS[i % CLASS_AVATAR_COLORS.length];
          return (
            <div key={key} className={`tt-row-wrap${isExp ? ' open' : ''}`}>
              <div className={`tt-row${isExp ? ' expanded-row' : ''}`}>
                <div className="tt-td tt-td-num">{String(i + 1).padStart(2, '0')}</div>
                <div className="tt-td tt-td-cls">
                  <div className="tt-avatar" style={{ background: avatarColor }}>{cls.name.charAt(0).toUpperCase()}</div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{cls.name}</span>
                </div>
                <div className="tt-td tt-td-sec">
                  <span className="tt-section-pill">{cls.section}</span>
                </div>
                <div className="tt-td tt-td-actions">
                  <Tooltip text={isOtherSession ? 'Editing is only allowed for the current session' : `Edit ${DAYS[day]} periods for this class`}>
                    <button
                      className="btn-tt-update"
                      disabled={isOtherSession}
                      style={isOtherSession ? { opacity: .45, cursor: 'not-allowed' } : undefined}
                      onClick={(e) => { e.stopPropagation(); if (isOtherSession) { toast('Method not allowed', 'error'); return; } setEditTarget({ key, cls: cls.name, section: cls.section, classID: cls.id, sectionID: cls.sectionID, classOrder: i }); }}
                    >
                      <i className="fa-solid fa-pen"></i> Update
                    </button>
                  </Tooltip>
                  <Tooltip text="Download timetable as PDF">
                    <button
                      className="btn-tt-dl"
                      onClick={(e) => { e.stopPropagation(); setDownloadTarget({ key, cls: cls.name, section: cls.section }); }}
                    >
                      <i className="fa-solid fa-file-pdf"></i> PDF
                    </button>
                  </Tooltip>
                  <Tooltip text={isOtherSession ? 'Editing is only allowed for the current session' : `Delete ${DAYS[day]} timetable for this class`}>
                    <button
                      className="btn-tt-del"
                      disabled={isOtherSession}
                      style={isOtherSession ? { opacity: .45, cursor: 'not-allowed' } : undefined}
                      onClick={(e) => { e.stopPropagation(); if (isOtherSession) { toast('Method not allowed', 'error'); return; } setDeletePayload({ type: 'class', key, cls: cls.name, section: cls.section }); }}
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </Tooltip>
                </div>
                <div className="tt-td tt-td-chev">
                  <Tooltip text={isExp ? 'Hide period details' : 'Show period details'}>
                    <button
                      className={`tt-expand-btn${isExp ? ' open' : ''}`}
                      onClick={() => setExpandedKey(isExp ? null : key)}
                      aria-label="Toggle details"
                    >
                      <i className="fa-solid fa-chevron-down"></i>
                    </button>
                  </Tooltip>
                </div>
              </div>

              <div className={`tt-expand${isExp ? ' open' : ''}`}>
                {periods.length === 0 ? (
                  <div className="tt-empty-detail">
                    <div className="tt-empty-icon"><i className="fa-regular fa-clock"></i></div>
                    <div className="tt-empty-title">No Periods Set</div>
                    <div className="tt-empty-sub">Click <strong>Update</strong> to add periods for {DAYS[day]}</div>
                    <Tooltip text={isOtherSession ? 'Editing is only allowed for the current session' : `Add periods for ${DAYS[day]}`}>
                      <button
                        className="btn-tt-update"
                        disabled={isOtherSession}
                        style={{ marginTop: 10, ...(isOtherSession ? { opacity: .45, cursor: 'not-allowed' } : {}) }}
                        onClick={() => { if (isOtherSession) { toast('Method not allowed', 'error'); return; } setEditTarget({ key, cls: cls.name, section: cls.section, classID: cls.id, sectionID: cls.sectionID, classOrder: i }); }}
                      >
                        <i className="fa-solid fa-plus"></i> Add Periods
                      </button>
                    </Tooltip>
                  </div>
                ) : (
                  <div>
                    <div className="tt-details-hdr">
                      Timetable Details — {cls.name} · {cls.section} · {DAYS[day]}
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="tt-detail-table" style={{ minWidth: 520 }}>
                        <thead>
                          <tr><th>#</th><th>Start Time</th><th>End Time</th><th>Subject</th><th>Teacher</th></tr>
                        </thead>
                        <tbody>
                          {periods.map((p, pi) => {
                            const isBreak = p.subject === 'Break';
                            const badgeColor = isBreak ? '#DC2626' : (SUBJ_COLORS[p.subject] || '#1E3A8A');
                            if (isBreak) {
                              return (
                                <tr key={pi} style={{ background: 'linear-gradient(90deg,#FEF2F2,#FFF5F5)' }}>
                                  <td style={{ fontWeight: 700, color: '#DC2626', width: 40 }}>{pi + 1}</td>
                                  <td style={{ color: '#DC2626', fontWeight: 600 }}>{fmt12(p.startTime)}</td>
                                  <td style={{ color: '#DC2626', fontWeight: 600 }}>{fmt12(p.endTime)}</td>
                                  <td colSpan={2}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'linear-gradient(135deg,#DC2626,#B91C1C)', color: '#fff', padding: '3px 12px', borderRadius: 99, fontSize: 11.5, fontWeight: 700 }}>
                                      <i className="fa-solid fa-mug-hot" style={{ fontSize: 10 }}></i> Break / Recess
                                    </span>
                                    <span style={{ marginLeft: 10, fontSize: 11, color: '#DC2626', fontWeight: 600 }}>
                                      ⏱ {fmt12plain(p.startTime)} – {fmt12plain(p.endTime)}
                                    </span>
                                  </td>
                                </tr>
                              );
                            }
                            return (
                              <tr key={pi}>
                                <td style={{ fontWeight: 700, color: 'var(--text-muted)', width: 40 }}>{pi + 1}</td>
                                <td style={{ fontWeight: 600 }}>{fmt12(p.startTime)}</td>
                                <td style={{ fontWeight: 600 }}>{fmt12(p.endTime)}</td>
                                <td>
                                  {p.subject
                                    ? <span className="tt-subj-badge" style={{ background: badgeColor }}>{p.subject}</span>
                                    : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                </td>
                                <td style={{ fontWeight: 600 }}>{p.teacher || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {editTarget && (
        <TTEditModal
          target={editTarget}
          day={day}
          teachers={teachers}
          toast={toast}
          initialPeriods={dayData[editTarget.key] || []}
          prevDayPeriods={(data[(day + 5) % 6] || {})[editTarget.key] || []}
          onClose={() => setEditTarget(null)}
          onSave={async (periods) => {
            try {
              await timeTableService.replaceClassDayTimeTable({
                dayIndex: day,
                classID: editTarget.classID,
                sectionID: editTarget.sectionID,
                classOrder: editTarget.classOrder || 0,
                oldPeriods: dayData[editTarget.key] || [],
                periods,
              });
              await reloadTimeTable();
              toast(`Timetable saved for ${DAYS[day]}!`, 'success');
            } catch (e) {
              console.error('Could not save timetable:', e);
              toast('Could not save timetable', 'error');
            }
            setEditTarget(null);
          }}
        />
      )}

      {downloadTarget && (
        <TTDownloadModal
          target={downloadTarget}
          day={day}
          header={reportHeader}
          dayPeriods={dayData[downloadTarget.key] || []}
          weekPeriods={DAYS.map((_, di) => (data[di] || {})[downloadTarget.key] || [])}
          onClose={() => setDownloadTarget(null)}
          onPreview={(title, html) => { setReportPreview({ title, html, landscape: false }); setDownloadTarget(null); }}
          toast={toast}
        />
      )}

      {schoolReportOpen && (
        <TTSchoolReportModal
          day={day}
          data={data}
          classes={classes}
          header={reportHeader}
          onClose={() => setSchoolReportOpen(false)}
          onPreview={(title, html) => { setReportPreview({ title, html, landscape: true }); setSchoolReportOpen(false); }}
          toast={toast}
        />
      )}

      {/* Single in-app PDF preview overlay — shared by both modals */}
      <ReportPreviewOverlay
        open={!!reportPreview}
        title={reportPreview?.title || ''}
        html={reportPreview?.html || ''}
        landscape={!!reportPreview?.landscape}
        onClose={() => setReportPreview(null)}
      />

      {deletePayload && (
        <TTDeleteConfirm
          payload={deletePayload}
          day={day}
          onClose={() => setDeletePayload(null)}
          onConfirm={() => (deletePayload.type === 'day' ? deleteDay() : deleteClassDay(deletePayload.key))}
        />
      )}

      {autoGenOpen && (
        <TTAutoGenerateModal
          classes={classes}
          teachers={teachers}
          existingData={data}
          onClose={() => setAutoGenOpen(false)}
          onGenerate={async (newData, summary) => {
            /* Persist the generated week to the API (delete-then-insert per
               class/day), then reload from the server. */
            try {
              /* Build THUNKS (don't invoke yet) so runLimited controls how many
                 requests fire at once — avoids the pending-forever pile-up. */
              const jobs = [];
              Object.entries(newData).forEach(([di, classMap]) => {
                Object.entries(classMap).forEach(([key, periods]) => {
                  const [classID, sectionID] = key.split('_');
                  jobs.push(() => timeTableService.replaceClassDayTimeTable({
                    dayIndex: Number(di), classID, sectionID, classOrder: 0,
                    oldPeriods: (data[di] || {})[key] || [],
                    periods,
                  }));
                });
              });
              await runLimited(jobs, 4);
              await reloadTimeTable();
              toast(
                `Timetable generated — ${summary.classCount} class${summary.classCount !== 1 ? 'es' : ''} × ${summary.dayCount} days`,
                'success'
              );
            } catch (e) {
              console.error('Could not generate timetable:', e);
              toast('Could not generate timetable', 'error');
            }
            setAutoGenOpen(false);
          }}
        />
      )}

      <TutorialModal
        open={tutorialOpen}
        moduleKey="timeTable"
        onClose={() => setTutorialOpen(false)}
        toast={toast}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Edit Timetable modal — period editor
   ═══════════════════════════════════════════════════════════════════ */
function TTEditModal({ target, day, teachers = [], toast = () => {}, initialPeriods, prevDayPeriods, onClose, onSave }) {
  const [periods, setPeriods] = useState(() =>
    initialPeriods.length
      ? JSON.parse(JSON.stringify(initialPeriods))
      : [{ startTime: '08:00', endTime: '08:40', subject: '', teacher: '' }]
  );
  const [pendingDelete, setPendingDelete] = useState(null); // index pending confirmation
  const [subjects, setSubjects] = useState([]); // real subjects for this class × section
  const [saving, setSaving] = useState(false);

  /* Validate + save: every period's End Time must be after its Start Time. */
  const handleSave = async () => {
    if (saving) return;
    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      if (!p.startTime || !p.endTime) {
        toast(`Period ${i + 1}: set both start and end time`, 'error');
        return;
      }
      if (minutesBetween(p.startTime, p.endTime) <= 0) {
        toast(`Period ${i + 1}: End time must be after start time`, 'error');
        return;
      }
    }
    setSaving(true);
    try { await onSave(periods); } catch (e) { console.error(e); setSaving(false); }
  };

  /* Load the class's real subjects for the Subject dropdown. */
  useEffect(() => {
    if (target?.classID == null) return undefined;
    let cancelled = false;
    timeTableService.getSubjectsForClass(target.classID, target.sectionID)
      .then((list) => { if (!cancelled) setSubjects(list || []); })
      .catch(() => { if (!cancelled) setSubjects([]); });
    return () => { cancelled = true; };
  }, [target]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      /* If a confirm is open, Esc just closes it. Otherwise close the whole modal. */
      if (pendingDelete != null) setPendingDelete(null);
      else                       onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, pendingDelete]);

  const totalMin = periods.reduce((s, p) => s + minutesBetween(p.startTime, p.endTime), 0);

  const setField = (i, patch) => setPeriods((prev) => prev.map((p, idx) => idx === i ? { ...p, ...patch } : p));
  const requestDelete = (i) => setPendingDelete(i);
  const confirmDelete = () => {
    if (pendingDelete == null) return;
    setPeriods((prev) => prev.filter((_, idx) => idx !== pendingDelete));
    setPendingDelete(null);
  };
  const addPeriod = () => {
    const last = periods[periods.length - 1];
    const newStart = last ? last.endTime : '08:00';
    const [h, m] = (newStart || '08:00').split(':').map(Number);
    const endMin = h * 60 + (m || 0) + 40;
    const newEnd = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    setPeriods((prev) => [...prev, { startTime: newStart, endTime: newEnd, subject: '', teacher: '' }]);
  };
  const copyFromPrev = () => {
    if (!prevDayPeriods.length) return;
    setPeriods(JSON.parse(JSON.stringify(prevDayPeriods)));
  };

  const prevDayName = DAYS[(day + 5) % 6];

  return createPortal(
    <div className="tt-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tt-edit-modal">
        <div className="tt-edit-hdr">
          <div className="tt-edit-hdr-icon"><i className="fa-solid fa-calendar-alt"></i></div>
          <div className="tt-edit-hdr-text">
            <div className="tt-edit-hdr-title">Timetable for Class {target.cls} Section {target.section}</div>
            <div className="tt-edit-hdr-sub">Add or edit periods for this class</div>
          </div>
          <Tooltip text="Close"><button className="tt-edit-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>

        <div className="tt-edit-meta">
          <span className="tt-meta-pill tt-meta-pill--blue">
            <i className="fa-solid fa-layer-group"></i> {periods.length} periods
          </span>
          <span className="tt-meta-pill tt-meta-pill--green">
            <i className="fa-solid fa-clock"></i> {fmtDuration(totalMin) || '0 min'} total
          </span>
        </div>

        <div className="tt-edit-body">
          {periods.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <i className="fa-regular fa-clock" style={{ fontSize: 32, opacity: .4, display: 'block', marginBottom: 8 }}></i>
              No periods yet — use "Add Period" or "Copy from {prevDayName}".
            </div>
          ) : periods.map((p, i) => {
            const isBreak = p.subject === 'Break';
            const color = isBreak ? '#DC2626' : PERIOD_COLORS[i % PERIOD_COLORS.length];
            const dur = minutesBetween(p.startTime, p.endTime);
            return (
              <div key={i} className={`ttp-card${isBreak ? ' ttp-card--break' : ''}`} style={{ '--ttp-color': color }}>
                <div className="ttp-card-hdr">
                  <div className="ttp-num" style={{ background: color }}>{i + 1}</div>
                  <div className="ttp-title">
                    {isBreak
                      ? <><i className="fa-solid fa-coffee" style={{ color: '#DC2626', marginRight: 5 }}></i><span style={{ color: '#DC2626' }}>Break / Recess</span></>
                      : <span>Period {i + 1}</span>}
                    {dur > 0 && <span className="ttp-dur">{dur} min</span>}
                  </div>
                  <Tooltip text="Delete this period">
                    <button className="ttp-del" onClick={() => requestDelete(i)}>
                      <i className="fa-solid fa-trash-alt"></i>
                    </button>
                  </Tooltip>
                </div>
                <div className="ttp-body">
                  <div className="ttp-field">
                    <label className="ttp-label"><i className="fa-solid fa-play"></i> Start Time</label>
                    <input type="time" className="ttp-input" value={p.startTime} onChange={(e) => setField(i, { startTime: e.target.value })} />
                    <div className="ttp-time-display">{fmt12plain(p.startTime)}</div>
                  </div>
                  <div className="ttp-field">
                    <label className="ttp-label"><i className="fa-solid fa-stop"></i> End Time</label>
                    <input type="time" className="ttp-input" value={p.endTime} onChange={(e) => setField(i, { endTime: e.target.value })} />
                    <div className="ttp-time-display">{fmt12plain(p.endTime)}</div>
                  </div>
                  <div className="ttp-field">
                    <label className="ttp-label"><i className="fa-solid fa-book-open"></i> Subject</label>
                    <select className="ttp-select" value={p.subject || ''} onChange={(e) => {
                      const name = e.target.value;
                      const sub = subjects.find((s) => s.name === name);
                      const isBreakSel = name === 'Break';
                      setField(i, {
                        subject: name,
                        subjectId: sub ? sub.id : 0,
                        teacher: isBreakSel ? '' : p.teacher,
                        teacherId: isBreakSel ? 0 : p.teacherId,
                      });
                    }}>
                      <option value="">Select a Subject</option>
                      <option value="Break">Break</option>
                      {/* Agar saved subject list me na ho to bhi option dikhao (warna selected blank lage). */}
                      {p.subject && p.subject !== 'Break' && !subjects.some((s) => s.name === p.subject) && (
                        <option value={p.subject}>{p.subject}</option>
                      )}
                      {subjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  {isBreak ? (
                    <div className="ttp-field ttp-field--break-msg">
                      <i className="fa-solid fa-info-circle" style={{ color: '#DC2626', fontSize: 14 }}></i>
                      <span>No teacher needed for break periods</span>
                    </div>
                  ) : (
                    <div className="ttp-field">
                      <label className="ttp-label"><i className="fa-solid fa-user-tie"></i> Teacher</label>
                      <select className="ttp-select" value={p.teacherId || ''} onChange={(e) => {
                        const id = e.target.value;
                        const t = teachers.find((x) => String(x.id) === String(id));
                        setField(i, { teacherId: id ? Number(id) : 0, teacher: t ? t.name : '' });
                      }}>
                        <option value="">Select a Teacher</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}{t.designation ? ` — ${t.designation}` : ''}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="tt-edit-footer">
          <div className="tt-edit-footer-left">
            <Tooltip text={prevDayPeriods.length ? `Copy ${prevDayPeriods.length} periods from ${prevDayName}` : `No periods set for ${prevDayName}`}>
              <button
                className="tt-foot-btn tt-foot-btn--ghost"
                onClick={copyFromPrev}
                disabled={!prevDayPeriods.length}
              >
                <i className="fa-solid fa-copy"></i> Copy from {prevDayName}
              </button>
            </Tooltip>
            <Tooltip text="Add another period to this day">
              <button className="tt-foot-btn tt-foot-btn--add" onClick={addPeriod}>
                <i className="fa-solid fa-plus"></i> Add Period
              </button>
            </Tooltip>
          </div>
          <div className="tt-edit-footer-right">
            <Tooltip text="Discard changes and close">
              <button className="tt-foot-btn tt-foot-btn--cancel" onClick={onClose} disabled={saving}>Cancel</button>
            </Tooltip>
            <Tooltip text="Save the timetable for this class and day">
              <button className="tt-foot-btn tt-foot-btn--save" onClick={handleSave} disabled={saving}
                style={saving ? { opacity: .7, cursor: 'not-allowed' } : undefined}>
                {saving
                  ? <><i className="fa-solid fa-spinner fa-spin"></i> Saving…</>
                  : <><i className="fa-solid fa-save"></i> Save Timetable</>}
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Period delete confirmation — inner overlay */}
        {pendingDelete != null && periods[pendingDelete] && (
          <div className="ttp-confirm-overlay" onClick={(e) => { if (e.target === e.currentTarget) setPendingDelete(null); }}>
            <div className="ttp-confirm-modal">
              <div className="ttp-confirm-hdr">
                <div className="ttp-confirm-icon"><i className="fa-solid fa-trash-can"></i></div>
                <div>
                  <div className="ttp-confirm-title">Delete Period {pendingDelete + 1}?</div>
                  <div className="ttp-confirm-meta">This action cannot be undone</div>
                </div>
              </div>
              <div className="ttp-confirm-body">
                <div className="ttp-confirm-msg">
                  Are you sure you want to delete <strong>
                    {periods[pendingDelete].subject === 'Break'
                      ? 'this Break / Recess'
                      : (periods[pendingDelete].subject
                          ? `${periods[pendingDelete].subject}`
                          : 'this period')}
                  </strong>{periods[pendingDelete].teacher ? ` (${periods[pendingDelete].teacher})` : ''}?
                </div>
                <div className="ttp-confirm-detail">
                  <i className="fa-regular fa-clock" style={{ marginRight: 6 }}></i>
                  {fmt12(periods[pendingDelete].startTime)} – {fmt12(periods[pendingDelete].endTime)}
                </div>
              </div>
              <div className="ttp-confirm-footer">
                <Tooltip text="Cancel and keep period">
                  <button className="tt-foot-btn tt-foot-btn--cancel" onClick={() => setPendingDelete(null)}>
                    <i className="fa-solid fa-xmark"></i> Cancel
                  </button>
                </Tooltip>
                <Tooltip text="Confirm: delete this period">
                  <button className="tt-foot-btn tt-foot-btn--delete" onClick={confirmDelete}>
                    <i className="fa-solid fa-trash"></i> Delete Period
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Download dialog — per class — color/BW + Daily/Weekly/Period Count
   ═══════════════════════════════════════════════════════════════════ */
function TTDownloadModal({ target, day, dayPeriods, weekPeriods, header, onClose, onPreview, toast }) {
  const [mode, setMode] = useState('color');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isBW = mode === 'bw';

  const generate = (kind) => {
    let html, title;
    if (kind === 'daily') {
      html  = buildDailyTTReport({ header, cls: target.cls, section: target.section, day: DAYS[day], periods: dayPeriods, isBW });
      title = `Daily Timetable — ${target.cls} · ${target.section} · ${DAYS[day]}`;
    } else if (kind === 'weekly') {
      const wp = {}; weekPeriods.forEach((p, di) => { wp[di] = p; });
      html  = buildWeeklyTTReport({ header, cls: target.cls, section: target.section, weekPeriods: wp, isBW });
      title = `Weekly Timetable — ${target.cls} · ${target.section}`;
    } else {
      const wp = {}; weekPeriods.forEach((p, di) => { wp[di] = p; });
      html  = buildPeriodCountReport({ header, cls: target.cls, section: target.section, weekPeriods: wp, isBW });
      title = `Period Count — ${target.cls} · ${target.section}`;
    }
    onPreview(title, html);
  };

  const onModeKey = (e, value) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')   { e.preventDefault(); setMode('color'); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setMode('bw'); }
    /* Space/Enter handled natively because the option is a real <button>. */
  };

  return createPortal(
    <div
      className="tt-overlay open"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tt-dl-title"
    >
      <div className="tt-dl-modal">
        <div className="tt-dl-hdr">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="tt-dl-hdr-icon"><i className="fa-solid fa-file-pdf"></i></div>
            <div>
              <div className="tt-dl-hdr-title" id="tt-dl-title">Download Timetable</div>
              <div className="tt-dl-hdr-sub">{target.cls} · {target.section} — choose report &amp; print style</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="tt-edit-close" onClick={onClose} aria-label="Close download dialog"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>
        <div className="tt-dl-body">
          <div className="tt-dl-section-lbl" id="tt-dl-style-lbl">Print Style</div>
          <div className="tt-dl-mode-grid" role="radiogroup" aria-labelledby="tt-dl-style-lbl">
            <Tooltip text="Generate a Colorful Report (best for screen viewing)">
              <button
                className={`tt-dl-mode${mode === 'color' ? ' selected' : ''}`}
                onClick={() => setMode('color')}
                role="radio"
                aria-checked={mode === 'color'}
                tabIndex={mode === 'color' ? 0 : -1}
                onKeyDown={(e) => onModeKey(e, 'color')}
              >
                <div className="tt-dl-mode-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#2563EB)' }} aria-hidden="true">
                  <i className="fa-solid fa-palette"></i>
                </div>
                <div style={{ textAlign: 'left', flex: 1 }}>
                  <div className="tt-dl-mode-name">Colorful Report</div>
                  <div className="tt-dl-mode-sub">School branding &amp; status badges</div>
                </div>
                <i className={`fa-solid ${mode === 'color' ? 'fa-circle-check' : 'fa-circle'}`} style={{ color: mode === 'color' ? '#2563EB' : 'var(--border-light)', fontSize: 16 }} aria-hidden="true"></i>
              </button>
            </Tooltip>
            <Tooltip text="Generate a low-ink Colorless Report (printer-friendly)">
              <button
                className={`tt-dl-mode${mode === 'bw' ? ' selected' : ''}`}
                onClick={() => setMode('bw')}
                role="radio"
                aria-checked={mode === 'bw'}
                tabIndex={mode === 'bw' ? 0 : -1}
                onKeyDown={(e) => onModeKey(e, 'bw')}
              >
                <div className="tt-dl-mode-icon" style={{ background: 'linear-gradient(135deg,#374151,#111827)' }} aria-hidden="true">
                  <i className="fa-solid fa-circle-half-stroke"></i>
                </div>
                <div style={{ textAlign: 'left', flex: 1 }}>
                  <div className="tt-dl-mode-name">Colorless Report</div>
                  <div className="tt-dl-mode-sub">Low-ink — white bg, light borders only</div>
                </div>
                <i className={`fa-solid ${mode === 'bw' ? 'fa-circle-check' : 'fa-circle'}`} style={{ color: mode === 'bw' ? '#2563EB' : 'var(--border-light)', fontSize: 16 }} aria-hidden="true"></i>
              </button>
            </Tooltip>
          </div>

          <div className="tt-dl-section-lbl">Report Type</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Tooltip text="Download a one-day PDF for this class">
              <button className="tt-dl-card tt-dl-card--blue" onClick={() => generate('daily')}>
                <div className="tt-dl-card-icon" style={{ background: 'linear-gradient(135deg,#1D4ED8,#1E3A8A)' }}>
                  <i className="fa-solid fa-calendar-day"></i>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="tt-dl-card-name">Daily Timetable</div>
                  <div className="tt-dl-card-sub">This class · today's schedule only</div>
                </div>
                <i className="fa-solid fa-arrow-right" style={{ color: 'var(--text-muted)', fontSize: 13 }}></i>
              </button>
            </Tooltip>
            <Tooltip text="Download a full-week PDF for this class">
              <button className="tt-dl-card tt-dl-card--green" onClick={() => generate('weekly')}>
                <div className="tt-dl-card-icon" style={{ background: 'linear-gradient(135deg,#16A34A,#15803D)' }}>
                  <i className="fa-solid fa-calendar-week"></i>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="tt-dl-card-name">Weekly Timetable</div>
                  <div className="tt-dl-card-sub">This class · full week all days</div>
                </div>
                <i className="fa-solid fa-arrow-right" style={{ color: 'var(--text-muted)', fontSize: 13 }}></i>
              </button>
            </Tooltip>
            <Tooltip text="Download a PDF with the total periods per subject for this class"><button className="tt-dl-card tt-dl-card--amber" onClick={() => generate('periodcount')}>
              <div className="tt-dl-card-icon" style={{ background: 'linear-gradient(135deg,#D97706,#B45309)' }}>
                <i className="fa-solid fa-list-ol"></i>
              </div>
              <div style={{ flex: 1 }}>
                <div className="tt-dl-card-name">Period Count</div>
                <div className="tt-dl-card-sub">Total periods per subject (whole week)</div>
              </div>
              <i className="fa-solid fa-arrow-right" style={{ color: 'var(--text-muted)', fontSize: 13 }}></i>
            </button></Tooltip>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════
   School Report dialog — Day Wise / Weekly
   ═══════════════════════════════════════════════════════════════════ */
function TTSchoolReportModal({ day, data, classes = [], header, onClose, onPreview, toast }) {
  /* Local report-style toggle — applies to whichever report the user
     picks next (Day Wise or Weekly). Defaults to Colorful. */
  const [style, setStyle] = useState('color'); // 'color' | 'bw'

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const fire = (kind) => {
    const html = buildSchoolReport({
      type: kind,            // 'daywise' | 'weekly'
      day,
      allData: data,
      classes,
      header,
      isBW: style === 'bw',
    });
    const title = kind === 'daywise' ? `Day Wise School Report — ${DAYS[day]}` : 'Weekly School Report';
    onPreview(title, html);
  };

  const onStyleKey = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')   { e.preventDefault(); setStyle('color'); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw'); }
  };

  return createPortal(
    <div
      className="tt-overlay open"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tt-school-title"
    >
      <div className="tt-school-modal">
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div className="tt-school-icon"><i className="fa-solid fa-file-pdf"></i></div>
          <div className="tt-school-title" id="tt-school-title">Download School Report</div>
          <div className="tt-school-sub">One-page full school timetable report</div>
        </div>
        <div
          className="tt-dl-mode-grid"
          role="radiogroup"
          aria-label="Report style"
          style={{ marginBottom: 14 }}
        >
          <button
            type="button"
            className={`tt-dl-mode${style === 'color' ? ' selected' : ''}`}
            onClick={() => setStyle('color')}
            role="radio"
            aria-checked={style === 'color'}
            tabIndex={style === 'color' ? 0 : -1}
            onKeyDown={onStyleKey}
          >
            <div className="tt-dl-mode-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#2563EB)' }} aria-hidden="true">
              <i className="fa-solid fa-palette"></i>
            </div>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <div className="tt-dl-mode-name">Colorful Report</div>
              <div className="tt-dl-mode-sub">Brand colors &amp; subject palette</div>
            </div>
            <i
              className={`fa-solid ${style === 'color' ? 'fa-circle-check' : 'fa-circle'}`}
              style={{ color: style === 'color' ? '#2563EB' : 'var(--border-light)', fontSize: 16 }}
              aria-hidden="true"
            ></i>
          </button>
          <button
            type="button"
            className={`tt-dl-mode${style === 'bw' ? ' selected' : ''}`}
            onClick={() => setStyle('bw')}
            role="radio"
            aria-checked={style === 'bw'}
            tabIndex={style === 'bw' ? 0 : -1}
            onKeyDown={onStyleKey}
          >
            <div className="tt-dl-mode-icon" style={{ background: 'linear-gradient(135deg,#374151,#111827)' }} aria-hidden="true">
              <i className="fa-solid fa-circle-half-stroke"></i>
            </div>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <div className="tt-dl-mode-name">Colorless Report</div>
              <div className="tt-dl-mode-sub">Low-ink — white bg, light borders only</div>
            </div>
            <i
              className={`fa-solid ${style === 'bw' ? 'fa-circle-check' : 'fa-circle'}`}
              style={{ color: style === 'bw' ? '#2563EB' : 'var(--border-light)', fontSize: 16 }}
              aria-hidden="true"
            ></i>
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <Tooltip text={`Generate a ${style === 'bw' ? 'Colorless' : 'Colorful'} one-page report for ${DAYS[day]} (all classes)`}>
            <button className="tt-school-opt" onClick={() => fire('daywise')}>
              <div className="tt-dl-card-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}>
                <i className="fa-solid fa-calendar-day"></i>
              </div>
              <div>
                <div className="tt-school-opt-name">Day Wise Report</div>
                <div className="tt-school-opt-sub">{DAYS[day]} — schedule for all classes</div>
              </div>
            </button>
          </Tooltip>
          <Tooltip text={`Generate a ${style === 'bw' ? 'Colorless' : 'Colorful'} full-week period-count report for all classes`}>
            <button className="tt-school-opt" onClick={() => fire('weekly')}>
              <div className="tt-dl-card-icon" style={{ background: 'linear-gradient(135deg,#16A34A,#15803D)' }}>
                <i className="fa-solid fa-calendar-week"></i>
              </div>
              <div>
                <div className="tt-school-opt-name">Weekly Report</div>
                <div className="tt-school-opt-sub">Full week period counts per class</div>
              </div>
            </button>
          </Tooltip>
        </div>
        <Tooltip text="Close without downloading">
          <button className="tt-foot-btn tt-foot-btn--cancel" style={{ width: '100%' }} onClick={onClose}>Cancel</button>
        </Tooltip>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Delete confirmation
   ═══════════════════════════════════════════════════════════════════ */
function TTDeleteConfirm({ payload, day, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !deleting) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, deleting]);

  const runDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try { await onConfirm(); } catch (e) { console.error(e); setDeleting(false); }
  };

  const isDay = payload.type === 'day';
  const title = isDay ? `Delete Entire ${DAYS[day]} Timetable` : 'Delete Class Timetable';
  const message = isDay
    ? `Are you sure you want to delete the entire ${DAYS[day]} timetable for all classes?`
    : `Are you sure you want to delete the ${DAYS[day]} timetable for ${payload.cls} · Section ${payload.section}?`;
  const detail = isDay
    ? 'This will clear today\'s schedule for every class. You can rebuild it manually or auto-generate again.'
    : `Only the ${DAYS[day]} entries for ${payload.cls} · ${payload.section} will be removed. Other days remain unaffected.`;

  return createPortal(
    <div className="tt-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tt-del-modal">
        <div className="tt-del-hdr">
          <div className="tt-del-icon-wrap"><i className="fa-solid fa-trash-can"></i></div>
          <div>
            <div className="tt-del-title">{title}</div>
            <div className="tt-del-meta">This action cannot be undone</div>
          </div>
        </div>
        <div className="tt-del-body">
          <div className="tt-del-msg">{message}</div>
          <div className="tt-del-detail">{detail}</div>
        </div>
        <div className="tt-del-footer">
          <Tooltip text="Cancel and keep the timetable">
            <button className="tt-foot-btn tt-foot-btn--cancel" onClick={onClose} disabled={deleting}>
              <i className="fa-solid fa-xmark"></i> Cancel
            </button>
          </Tooltip>
          <Tooltip text={`Confirm: ${title}`}>
            <button className="tt-foot-btn tt-foot-btn--delete" onClick={runDelete} disabled={deleting}
              style={deleting ? { opacity: .7, cursor: 'not-allowed' } : undefined}>
              {deleting
                ? <><i className="fa-solid fa-spinner fa-spin"></i> Deleting…</>
                : <><i className="fa-solid fa-trash"></i> Delete</>}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════
   AUTO TIMETABLE GENERATOR — 5-step wizard
   1. Hours · 2. Breaks · 3. Periods · 4. Workload · 5. Confirm
   ═══════════════════════════════════════════════════════════════════ */
const WIZ_STEPS = [
  { n: 1, icon: 'fa-clock',         label: 'Hours' },
  { n: 2, icon: 'fa-coffee',        label: 'Breaks' },
  { n: 3, icon: 'fa-sliders-h',     label: 'Periods' },
  { n: 4, icon: 'fa-user-check',    label: 'Workload' },
  { n: 5, icon: 'fa-shield-alt',    label: 'Confirm' },
];

const toMin  = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
const toTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function TTAutoGenerateModal({ classes = [], teachers = [], existingData = {}, onClose, onGenerate }) {
  /* Real teacher names + a name→id map (auto-gen stores teacherId for saving). */
  const teacherNames = teachers.map((t) => t.name);
  const teacherIdByName = {};
  teachers.forEach((t) => { teacherIdByName[t.name] = t.id; });
  const initWiz = useCallback(() => ({
    step: 1,
    /* Step 1 */
    schoolStart: '08:00',
    schoolEnd:   '14:00',
    workDays: [0, 1, 2, 3, 4],            // indices into DAYS
    defaultPeriodLen: 40,                  // minutes
    defaultPeriodsPerDay: 0,              // 0 = auto from hours
    perDaySchedule: false,
    dayEndTimes: {},                      // { dayIdx: 'HH:MM' }
    dayMaxPeriods: {},                    // { dayIdx: number }
    selectedClasses: null,                // null = all; Set of "id_section"
    /* Step 2 — HTML uses { afterPeriod, duration, label } */
    defaultBreaks: [{ afterPeriod: 3, duration: 20, label: 'Recess' }],
    dayBreaks: {},   // { dayIdx: null (use default) | [] | array of overrides }
    /* Step 3 — subject weekly lesson counts */
    subjectWeeklyLessons: TT_SUBJECTS.reduce((acc, s) => ({ ...acc, [s]: 5 }), {}),
    dayPeriodLens: {},        // { dayIdx: [40, 40, 45, ...] }  per-period duration overrides
    _step3Day: 0,             // currently selected day in Step 3 editor
    /* Step 4 — teacher × day availability (empty = every teacher available all days) */
    teacherWorkdays: {},
    /* internal */
    _leaveBlank: true,
  }), []);

  const [w, setW] = useState(initWiz);
  const [generating, setGenerating] = useState(false);
  /* Overwrite-warning popup: jab selected classes mein se kisi ka pehle se
     (manual/previous) timetable mojood ho. null = no popup. */
  const [overwriteWarn, setOverwriteWarn] = useState(null);   // { names: [] } | null
  const update = (patch) => setW((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* ─── Helpers ─── */
  const autoPeriods = Math.max(1, Math.floor((toMin(w.schoolEnd) - toMin(w.schoolStart)) / w.defaultPeriodLen));
  const defP        = w.defaultPeriodsPerDay || autoPeriods;
  const allClassKeys = (classes || []).map((c) => `${c.id}_${c.sectionID}`);
  const selectedSet  = w.selectedClasses || new Set(allClassKeys);

  /* Compute the chronological list of slots (periods + breaks) for a day.
     Each slot: { isBreak, periodNo?, label?, start, end, duration } */
  const wizSlotsFor = (di) => {
    const startM    = toMin(w.schoolStart);
    const periodsToday = (w.perDaySchedule && w.dayMaxPeriods[di] !== undefined) ? w.dayMaxPeriods[di] : defP;
    const customLens = w.dayPeriodLens[di] || null;
    const dayBreaks = (Array.isArray(w.dayBreaks[di]) ? w.dayBreaks[di] : w.defaultBreaks)
      .slice()
      .sort((a, b) => a.afterPeriod - b.afterPeriod);
    const slots = [];
    let cur = startM;
    for (let p = 1; p <= periodsToday; p++) {
      const dur = (customLens && customLens[p - 1] != null) ? customLens[p - 1] : w.defaultPeriodLen;
      slots.push({ isBreak: false, periodNo: p, start: toTime(cur), end: toTime(cur + dur), duration: dur });
      cur += dur;
      const periodBreaks = dayBreaks.filter((b) => b.afterPeriod === p);
      for (const b of periodBreaks) {
        const bdur = +b.duration || 15;
        slots.push({ isBreak: true, label: b.label || 'Break', start: toTime(cur), end: toTime(cur + bdur), duration: bdur });
        cur += bdur;
      }
    }
    return slots;
  };

  /* Per-period duration setter — initialises from defaults the first time */
  const setPeriodDur = (di, pi, dur) => {
    const periodsToday = (w.perDaySchedule && w.dayMaxPeriods[di] !== undefined) ? w.dayMaxPeriods[di] : defP;
    const cur = w.dayPeriodLens[di] || new Array(periodsToday).fill(w.defaultPeriodLen);
    const next = cur.slice();
    next[pi] = Math.max(10, Math.min(120, +dur || w.defaultPeriodLen));
    update({ dayPeriodLens: { ...w.dayPeriodLens, [di]: next } });
  };
  const resetPeriodDur = (di, pi) => {
    const cur = w.dayPeriodLens[di] || [];
    if (!cur.length) return;
    const next = cur.slice();
    next[pi] = w.defaultPeriodLen;
    const allDefault = next.every((d) => d === w.defaultPeriodLen);
    const dpl = { ...w.dayPeriodLens };
    if (allDefault) delete dpl[di]; else dpl[di] = next;
    update({ dayPeriodLens: dpl });
  };
  const resetDayDurs = (di) => {
    const dpl = { ...w.dayPeriodLens };
    delete dpl[di];
    update({ dayPeriodLens: dpl });
  };

  /* Total non-break periods across all working days — for lesson allocation */
  const totalWeekPeriods = w.workDays.reduce((s, di) => s + wizSlotsFor(di).filter((x) => !x.isBreak).length, 0);

  const toggleDay = (i) => update({
    workDays: w.workDays.includes(i) ? w.workDays.filter((x) => x !== i) : [...w.workDays, i].sort(),
  });

  const toggleClassKey = (key) => {
    const next = new Set(selectedSet);
    if (next.has(key)) next.delete(key); else next.add(key);
    update({ selectedClasses: next });
  };
  const selectAllClasses = () => update({ selectedClasses: new Set(allClassKeys) });
  const clearAllClasses  = () => update({ selectedClasses: new Set() });

  /* Add/remove a break to/from the default list OR a day-specific override array.
     `scope` = 'default' or a day-index number. */
  const addBreakTo = (scope, payload) => {
    if (scope === 'default') {
      const next = [...w.defaultBreaks, payload].sort((a, b) => a.afterPeriod - b.afterPeriod);
      update({ defaultBreaks: next });
    } else {
      const cur = Array.isArray(w.dayBreaks[scope]) ? w.dayBreaks[scope] : [];
      const next = [...cur, payload].sort((a, b) => a.afterPeriod - b.afterPeriod);
      update({ dayBreaks: { ...w.dayBreaks, [scope]: next } });
    }
  };
  const removeBreakAt = (scope, idx) => {
    if (scope === 'default') {
      update({ defaultBreaks: w.defaultBreaks.filter((_, i) => i !== idx) });
    } else {
      const cur = Array.isArray(w.dayBreaks[scope]) ? w.dayBreaks[scope] : [];
      update({ dayBreaks: { ...w.dayBreaks, [scope]: cur.filter((_, i) => i !== idx) } });
    }
  };
  const setDayBreakMode = (di, hasOverride) => {
    update({ dayBreaks: { ...w.dayBreaks, [di]: hasOverride ? [] : null } });
  };

  const setSubjectLessons = (subj, n) => update({ subjectWeeklyLessons: { ...w.subjectWeeklyLessons, [subj]: Math.max(0, n) } });

  const toggleTeacherDay = (name, dayIdx) => {
    const cur = w.teacherWorkdays[name] || [];
    const next = cur.includes(dayIdx) ? cur.filter((x) => x !== dayIdx) : [...cur, dayIdx].sort();
    update({ teacherWorkdays: { ...w.teacherWorkdays, [name]: next } });
  };

  /* ─── Validation ─── */
  const validation = (() => {
    const errors = [];
    const warnings = [];

    if (toMin(w.schoolEnd) <= toMin(w.schoolStart)) errors.push('School end time must be after start time.');
    if (w.workDays.length === 0) errors.push('Select at least one working day.');
    if (selectedSet.size === 0) errors.push('Select at least one class to generate timetable for.');
    if (defP < 1) errors.push('Each day must have at least 1 period.');
    if (defP > 20) errors.push('Maximum 20 periods per day.');

    /* Total weekly slots = sum of non-break periods across all working days */
    const totalSlots = totalWeekPeriods;
    /* Total subject lessons requested */
    const totalLessons = Object.values(w.subjectWeeklyLessons).reduce((s, n) => s + (+n || 0), 0);
    if (totalLessons > totalSlots) {
      errors.push(`Subject lessons exceed available slots: ${totalLessons} requested vs ${totalSlots} slots/week.`);
    } else if (totalLessons < totalSlots * .8 && totalLessons > 0) {
      warnings.push(`Only ${totalLessons} subject periods set out of ${totalSlots} weekly slots — remaining ${totalSlots - totalLessons} slots may be left blank.`);
    }

    /* Teacher availability check */
    const teachersWithNoDays = Object.entries(w.teacherWorkdays).filter(([, days]) => days.length === 0).map(([n]) => n);
    if (teachersWithNoDays.length) warnings.push(`${teachersWithNoDays.length} teacher(s) have no working days set — they will be skipped.`);

    /* Break sanity — afterPeriod must fit within periods/day */
    const allBreaks = [
      ...w.defaultBreaks.map((b) => ({ ...b, scope: 'default' })),
      ...Object.entries(w.dayBreaks).flatMap(([di, list]) =>
        Array.isArray(list) ? list.map((b) => ({ ...b, scope: DAYS[+di] })) : []
      ),
    ];
    const badBreaks = allBreaks.filter((b) => b.afterPeriod < 1 || b.afterPeriod >= defP || (+b.duration || 0) < 1);
    if (badBreaks.length) {
      errors.push(`${badBreaks.length} break(s) reference an invalid period number or duration.`);
    }

    return { errors, warnings, ok: errors.length === 0, totalSlots, totalLessons };
  })();

  const canContinue = (() => {
    if (w.step === 1) return toMin(w.schoolEnd) > toMin(w.schoolStart) && w.workDays.length > 0 && selectedSet.size > 0 && defP >= 1;
    if (w.step === 2) return [...w.defaultBreaks, ...Object.values(w.dayBreaks).flat().filter(Boolean)]
                                .every((b) => b.afterPeriod >= 1 && b.afterPeriod < defP && (+b.duration || 0) >= 1);
    if (w.step === 3) return validation.totalLessons <= validation.totalSlots;
    if (w.step === 4) return true;
    if (w.step === 5) {
      /* Mirror Step 5's explicit checks — fail blocks Generate, warnings don't */
      const slotsOk = w.workDays.every((di) => wizSlotsFor(di).filter((s) => !s.isBreak).length > 0);
      return validation.ok
        && w.workDays.length > 0
        && selectedSet.size > 0
        && slotsOk;
    }
    return true;
  })();

  /* ─── Existing-timetable (overwrite) detection ─── */
  const classLabel = (key) => {
    const c = (classes || []).find((x) => `${x.id}_${x.sectionID}` === key);
    return c ? `${c.name} · ${c.section}` : key;
  };
  /* Kya is class ka kisi bhi din pehle se koi real period (subject/teacher) saved hai? */
  const classHasExisting = (key) =>
    Object.values(existingData || {}).some(
      (classMap) =>
        Array.isArray(classMap?.[key]) &&
        classMap[key].some((p) => (p.subject && p.subject !== 'Break') || p.teacher)
    );

  /* Generate button → pehle overwrite-conflict check karo. Agar koi selected
     class ka pehle se timetable hai to popup dikhao (Yes = overwrite,
     No = Step 1 par wapas jaake wo class uncheck kar lo). */
  const generate = () => {
    if (!validation.ok || generating) return;
    const conflicts = Array.from(selectedSet).filter(classHasExisting);
    if (conflicts.length > 0) {
      setOverwriteWarn({ names: conflicts.map(classLabel) });
      return;
    }
    runGenerate();
  };

  /* ─── Generate the timetable ─── */
  const runGenerate = async () => {
    if (!validation.ok || generating) return; // block double-click while saving
    /* Build pool of subject lessons, weighted by weekly count */
    const subjectPool = [];
    Object.entries(w.subjectWeeklyLessons).forEach(([subj, count]) => {
      for (let i = 0; i < count; i++) subjectPool.push(subj);
    });

    /* Pick a real teacher available that day (undefined workdays = available). */
    const teacherFor = (subj, dayIdx, used) => {
      const candidates = teacherNames.filter((t) => {
        const wd = w.teacherWorkdays[t];
        return wd ? wd.includes(dayIdx) : true;
      });
      if (candidates.length === 0) return '';
      const idx = (subj.charCodeAt(0) + used) % candidates.length;
      return candidates[idx];
    };

    const data = {};
    DAYS.forEach((_, di) => { data[di] = {}; });

    /* For each class, distribute subject periods across the work days */
    Array.from(selectedSet).forEach((key) => {
      const classSubjects = [...subjectPool];   // each class gets the same lesson pool
      /* Round-robin shuffle by class id so different classes get different orderings */
      const [classId] = key.split('_');
      const seed = parseInt(classId) || 1;
      const ordered = classSubjects
        .map((s, i) => ({ s, k: (i * 7 + seed * 13) % 1000 }))
        .sort((a, b) => a.k - b.k)
        .map((x) => x.s);

      let subjPtr = 0;
      w.workDays.forEach((di) => {
        /* Day-specific break list overrides the default */
        const dayBreaksRaw = Array.isArray(w.dayBreaks[di]) ? w.dayBreaks[di] : w.defaultBreaks;
        const dayBreaks    = [...dayBreaksRaw].sort((a, b) => a.afterPeriod - b.afterPeriod);
        const dayPeriods   = (w.perDaySchedule && w.dayMaxPeriods[di] !== undefined) ? w.dayMaxPeriods[di] : defP;
        const periodLen    = w.defaultPeriodLen;
        const startM       = toMin(w.schoolStart);

        /* Walk period 1..N, inserting break AFTER any period that matches */
        const slots = [];
        let cur = startM;
        for (let p = 1; p <= dayPeriods; p++) {
          slots.push({ startTime: toTime(cur), endTime: toTime(cur + periodLen), subject: '', teacher: '' });
          cur += periodLen;
          /* Any break whose afterPeriod === p slots in here */
          const matchedBreaks = dayBreaks.filter((b) => b.afterPeriod === p);
          for (const b of matchedBreaks) {
            const dur = +b.duration || 15;
            slots.push({ startTime: toTime(cur), endTime: toTime(cur + dur), subject: 'Break', teacher: '' });
            cur += dur;
          }
        }

        /* Fill in subjects + teachers for non-break slots */
        slots.forEach((slot) => {
          if (slot.subject === 'Break') return;
          if (subjPtr < ordered.length) {
            const subj = ordered[subjPtr++];
            slot.subject = subj;
            slot.teacher = teacherFor(subj, di, subjPtr);
            slot.teacherId = teacherIdByName[slot.teacher] || 0;
          }
        });

        data[di][key] = slots;
      });
    });

    setGenerating(true);
    try {
      await onGenerate(data, {
        classCount: selectedSet.size,
        dayCount: w.workDays.length,
        periodsPerDay: defP,
      });
    } catch (e) {
      console.error('Generate failed:', e);
      setGenerating(false);
    }
  };

  /* ─── Render step body ─── */
  const renderStep = () => {
    if (w.step === 1) return <WizStep1 w={w} update={update} toggleDay={toggleDay} autoPeriods={autoPeriods} defP={defP}
                                       selectedSet={selectedSet} toggleClassKey={toggleClassKey} classes={classes}
                                       selectAllClasses={selectAllClasses} clearAllClasses={clearAllClasses} />;
    if (w.step === 2) return <WizStep2 w={w} defP={defP} addBreakTo={addBreakTo} removeBreakAt={removeBreakAt} setDayBreakMode={setDayBreakMode} />;
    if (w.step === 3) return (
      <WizStep3
        w={w}
        update={update}
        defP={defP}
        wizSlotsFor={wizSlotsFor}
        setSubjectLessons={setSubjectLessons}
        setPeriodDur={setPeriodDur}
        resetPeriodDur={resetPeriodDur}
        resetDayDurs={resetDayDurs}
        validation={validation}
        totalWeekPeriods={totalWeekPeriods}
      />
    );
    if (w.step === 4) return <WizStep4 w={w} update={update} toggleTeacherDay={toggleTeacherDay} wizSlotsFor={wizSlotsFor} totalWeekPeriods={totalWeekPeriods} teacherNames={teacherNames} />;
    if (w.step === 5) return <WizStep5 w={w} update={update} validation={validation} wizSlotsFor={wizSlotsFor} totalWeekPeriods={totalWeekPeriods} selectedSet={selectedSet} />;
    return null;
  };

  return createPortal(
    <div className="tt-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="wiz-modal">
        {/* Header */}
        <div className="wiz-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="wiz-header-icon"><i className="fa-solid fa-wand-magic-sparkles"></i></div>
            <div>
              <div className="wiz-header-title">Auto Timetable Generator</div>
              <div className="wiz-header-sub">5 steps · generates full week for all classes automatically</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="tt-edit-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>

        {/* Pill stepper */}
        <div className="wiz-pills-bar">
          {WIZ_STEPS.map(({ n, icon, label }, idx) => (
            <React.Fragment key={n}>
              <div className="wiz-pill" data-state={n < w.step ? 'done' : n === w.step ? 'active' : 'idle'}>
                <span className="wsn">{n}</span>
                <i className={`fa-solid ${icon}`}></i>
                <span className="wiz-pill-lbl">{label}</span>
              </div>
              {idx < WIZ_STEPS.length - 1 && (
                <div className="wiz-pill-line" data-done={n < w.step ? '1' : '0'}></div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Body */}
        <div className="wiz-body">{renderStep()}</div>

        {/* Footer */}
        <div className="wiz-footer">
          {w.step > 1 && (
            <Tooltip text="Go to the previous step">
              <button className="wiz-btn wiz-btn-back" onClick={() => update({ step: w.step - 1 })}>
                <i className="fa-solid fa-arrow-left"></i> Back
              </button>
            </Tooltip>
          )}
          <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
            <Tooltip text="Close the auto-generate wizard">
              <button className="wiz-btn wiz-btn-cancel" onClick={onClose}>Cancel</button>
            </Tooltip>
            {w.step < 5 ? (
              <Tooltip text={canContinue ? 'Go to the next step' : 'Fix the issues above before continuing'}>
                <button
                  className="wiz-btn wiz-btn-next"
                  disabled={!canContinue}
                  onClick={() => update({ step: w.step + 1 })}
                  style={!canContinue ? { opacity: .5, cursor: 'not-allowed' } : undefined}
                >
                  Continue <i className="fa-solid fa-arrow-right"></i>
                </button>
              </Tooltip>
            ) : (
              <Tooltip text={generating ? 'Generating timetable — please wait…' : (canContinue ? 'Generate the full timetable for all selected classes' : 'Fix the issues above before generating')}>
                <button
                  className="wiz-btn wiz-btn-generate"
                  disabled={!canContinue || generating}
                  onClick={generate}
                  style={(!canContinue || generating) ? { opacity: .6, cursor: 'not-allowed' } : undefined}
                >
                  {generating
                    ? <><i className="fa-solid fa-spinner fa-spin"></i> Generating…</>
                    : <><i className="fa-solid fa-bolt"></i> Generate Timetable</>}
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      {/* Overwrite-confirm popup — koi selected class ka pehle se timetable ho to */}
      {overwriteWarn && (
        <div
          onClick={() => setOverwriteWarn(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 'min(470px,92vw)', boxShadow: '0 20px 60px rgba(15,23,42,.35)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px', display: 'flex', gap: 12, alignItems: 'flex-start', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(234,179,8,.14)', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 18 }}></i>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>Timetable already exists</div>
                <div style={{ fontSize: 12.5, color: '#475569', marginTop: 3, lineHeight: 1.5 }}>
                  In class{overwriteWarn.names.length > 1 ? 'es' : ''} ka pehle se timetable mojood hai. Generate karne par wo <b>overwrite</b> ho jayega:
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 22px', maxHeight: 190, overflowY: 'auto' }}>
              {overwriteWarn.names.map((nm, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#0F172A', padding: '5px 0', fontWeight: 600 }}>
                  <i className="fa-solid fa-chalkboard" style={{ color: '#7C3AED', fontSize: 12 }}></i> {nm}
                </div>
              ))}
            </div>
            <div style={{ padding: '14px 22px', display: 'flex', gap: 10, justifyContent: 'flex-end', background: '#F8FAFC', borderTop: '1px solid #F1F5F9' }}>
              <Tooltip text="Cancel and go back to class selection to uncheck these classes">
                <button className="wiz-btn wiz-btn-back" onClick={() => { setOverwriteWarn(null); update({ step: 1 }); }}>
                  <i className="fa-solid fa-xmark"></i> No, let me uncheck
                </button>
              </Tooltip>
              <Tooltip text="Overwrite the existing timetable and generate">
                <button className="wiz-btn wiz-btn-generate" onClick={() => { setOverwriteWarn(null); runGenerate(); }}>
                  <i className="fa-solid fa-bolt"></i> Yes, overwrite
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

/* ─── Step 1 — Hours ─── */
function WizStep1({ w, update, toggleDay, autoPeriods, defP, selectedSet, toggleClassKey, selectAllClasses, clearAllClasses, classes = [] }) {
  return (
    <>
      <div className="wiz-section">
        <div className="wiz-section-label"><i className="fa-solid fa-clock" style={{ color: '#7C3AED', marginRight: 6 }}></i> School Hours</div>
        <div className="wiz-two-col">
          <div className="wiz-field">
            <label className="wiz-label">Start Time</label>
            <input type="time" className="wiz-time-input" value={w.schoolStart} onChange={(e) => update({ schoolStart: e.target.value })} />
            <span className="wiz-time-preview">{fmt12plain(w.schoolStart)}</span>
          </div>
          <div className="wiz-field">
            <label className="wiz-label">End Time</label>
            <input type="time" className="wiz-time-input" value={w.schoolEnd} onChange={(e) => update({ schoolEnd: e.target.value })} />
            <span className="wiz-time-preview">{fmt12plain(w.schoolEnd)}</span>
          </div>
        </div>
      </div>

      <div className="wiz-section">
        <div className="wiz-section-label"><i className="fa-solid fa-calendar-days" style={{ color: '#7C3AED', marginRight: 6 }}></i> Working Days</div>
        <div className="wiz-day-row">
          {DAYS.map((d, i) => (
            <Tooltip key={d} text={w.workDays.includes(i) ? `Make ${d} a non-working day` : `Make ${d} a working day`}>
              <button
                className={`wiz-day-btn${w.workDays.includes(i) ? ' wiz-day-btn--on' : ''}`}
                onClick={() => toggleDay(i)}
              >
                {d.substring(0, 3)}
              </button>
            </Tooltip>
          ))}
        </div>
      </div>

      <div className="wiz-section">
        <div className="wiz-section-label"><i className="fa-solid fa-stopwatch" style={{ color: '#7C3AED', marginRight: 6 }}></i> Default Period Duration</div>
        <div className="wiz-dur-row">
          {[30, 35, 40, 45, 50, 55, 60].map((n) => (
            <Tooltip key={n} text={`Use ${n}-minute periods by default`}>
              <button
                className={`wiz-dur-btn${w.defaultPeriodLen === n ? ' wiz-dur-btn--on' : ''}`}
                onClick={() => update({ defaultPeriodLen: n })}
              >
                {n}m
              </button>
            </Tooltip>
          ))}
        </div>
      </div>

      <div className="wiz-section">
        <div className="wiz-section-label"><i className="fa-solid fa-list-ol" style={{ color: '#7C3AED', marginRight: 6 }}></i> Default Periods per Day</div>
        <div className="wiz-desc-box">
          <i className="fa-solid fa-info-circle"></i>
          Auto-calculated from school hours: <b>{autoPeriods} periods</b> fit within your hours. You can adjust this manually.
        </div>
        <div className="wiz-stepper-card">
          <div className="wiz-stepper wiz-stepper--lg">
            <Tooltip text="One fewer period per day">
              <button className="wiz-stepper-btn wiz-stepper-btn--lg" onClick={() => update({ defaultPeriodsPerDay: Math.max(1, defP - 1) })}>−</button>
            </Tooltip>
            <span className="wiz-stepper-val wiz-stepper-val--lg">{defP}</span>
            <Tooltip text="One more period per day">
              <button className="wiz-stepper-btn wiz-stepper-btn--lg" onClick={() => update({ defaultPeriodsPerDay: Math.min(20, defP + 1) })}>+</button>
            </Tooltip>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{defP} period{defP !== 1 ? 's' : ''} per day</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
              {defP * w.workDays.length} periods/week per class × {selectedSet.size} class{selectedSet.size !== 1 ? 'es' : ''} = <strong>{defP * w.workDays.length * selectedSet.size} total lectures</strong>
              <span style={{ opacity: .8 }}> ({defP} × {w.workDays.length} day{w.workDays.length !== 1 ? 's' : ''} × {selectedSet.size} class{selectedSet.size !== 1 ? 'es' : ''})</span>
            </div>
          </div>
          {w.defaultPeriodsPerDay > 0 && w.defaultPeriodsPerDay !== autoPeriods && (
            <Tooltip text="Reset to the auto-calculated period count">
              <button className="wiz-link-btn" onClick={() => update({ defaultPeriodsPerDay: 0 })} style={{ marginLeft: 'auto' }}>
                ↩ Reset to auto ({autoPeriods})
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      <Tooltip text={w.perDaySchedule ? 'Disable: use the same period count for every day' : 'Enable: set a different period count for each day (e.g. 6 on Friday, 8 on Monday)'}>
        <button className={`wiz-toggle-card${w.perDaySchedule ? ' wiz-toggle-card--on' : ''}`} onClick={() => update({ perDaySchedule: !w.perDaySchedule })}>
          <div className={`wiz-toggle-box${w.perDaySchedule ? ' wiz-toggle-box--on' : ''}`}>
            {w.perDaySchedule && <i className="fa-solid fa-check" style={{ fontSize: 10, color: '#fff' }}></i>}
          </div>
          <div>
            <div className="wiz-toggle-title">Customise schedule per day</div>
            <div className="wiz-toggle-sub">Set different end time and number of periods for each day — e.g. 6 periods on Friday, 8 on Monday</div>
          </div>
        </button>
      </Tooltip>

      {w.perDaySchedule && (
        <div className="wiz-day-overrides-block">
          {w.workDays.map((di) => {
            const val = w.dayEndTimes[di] || w.schoolEnd;
            const autoSlots = Math.max(1, Math.floor((toMin(val) - toMin(w.schoolStart)) / w.defaultPeriodLen));
            const shownMax = w.dayMaxPeriods[di] !== undefined ? w.dayMaxPeriods[di] : autoSlots;
            return (
              <div key={di} className="wiz-day-override-row">
                <div className="wiz-day-override-name">{DAYS[di]}</div>
                <div className="wiz-day-override-time">
                  <label className="wiz-label" style={{ marginBottom: 3 }}>End Time</label>
                  <input type="time" className="wiz-time-sm" value={val} onChange={(e) => update({ dayEndTimes: { ...w.dayEndTimes, [di]: e.target.value } })} />
                  <span className="wiz-inset-note">{fmt12plain(val)}</span>
                </div>
                <div className="wiz-day-override-periods">
                  <label className="wiz-label" style={{ marginBottom: 3 }}>Periods / Day</label>
                  <div className="wiz-stepper">
                    <Tooltip text={`One fewer period on ${DAYS[di]}`}>
                      <button className="wiz-stepper-btn" onClick={() => update({ dayMaxPeriods: { ...w.dayMaxPeriods, [di]: Math.max(1, shownMax - 1) } })}>−</button>
                    </Tooltip>
                    <span className="wiz-stepper-val">{shownMax}</span>
                    <Tooltip text={`One more period on ${DAYS[di]}`}>
                      <button className="wiz-stepper-btn" onClick={() => update({ dayMaxPeriods: { ...w.dayMaxPeriods, [di]: Math.min(20, shownMax + 1) } })}>+</button>
                    </Tooltip>
                  </div>
                  {w.dayMaxPeriods[di] !== undefined && (
                    <Tooltip text={`Reset ${DAYS[di]} back to the auto-calculated period count`}>
                      <button
                        className="wiz-link-btn"
                        style={{ fontSize: 10, marginTop: 3 }}
                        onClick={() => {
                          const next = { ...w.dayMaxPeriods };
                          delete next[di];
                          update({ dayMaxPeriods: next });
                        }}
                      >↩ Auto</button>
                    </Tooltip>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Class selector */}
      <div className="wiz-section">
        <div className="wiz-section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span><i className="fa-solid fa-school" style={{ color: '#7C3AED', marginRight: 6 }}></i> Select Classes ({selectedSet.size} / {classes.length})</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <Tooltip text="Select every class">
              <button className="wiz-pill-btn wiz-pill-btn--purple" onClick={selectAllClasses}>All</button>
            </Tooltip>
            <Tooltip text="Deselect all classes">
              <button className="wiz-pill-btn wiz-pill-btn--red" onClick={clearAllClasses}>Clear</button>
            </Tooltip>
          </div>
        </div>
        <div className="wiz-cls-grid">
          {classes.map((c) => {
            const key = `${c.id}_${c.sectionID}`;
            const on = selectedSet.has(key);
            return (
              <Tooltip key={key} text={on ? `Remove ${c.name} · ${c.section} from auto-generation` : `Include ${c.name} · ${c.section} in auto-generation`}>
                <button
                  className={`wiz-cls-chip${on ? ' wiz-cls-chip--on' : ''}`}
                  onClick={() => toggleClassKey(key)}
                >
                  <div className={`wiz-cls-check${on ? ' wiz-cls-check--on' : ''}`}>
                    {on && <i className="fa-solid fa-check" style={{ fontSize: 8, color: '#fff' }}></i>}
                  </div>
                  <span>{c.name} · {c.section}</span>
                </button>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* ─── Step 2 — Breaks (default + per-day overrides) ─── */
const WIZ_DAY_COLORS = ['#1E40AF', '#0369A1', '#15803D', '#B45309', '#7C3AED', '#BE185D'];

function WizBreakForm({ scope, addBreakTo, defP }) {
  const [after, setAfter] = useState(Math.min(3, Math.max(1, defP - 1)));
  const [dur,   setDur]   = useState(20);
  const [label, setLabel] = useState('Break');
  const submit = () => {
    addBreakTo(scope, { afterPeriod: +after || 1, duration: +dur || 5, label: label.trim() || 'Break' });
    setAfter(Math.min(3, Math.max(1, defP - 1))); setDur(20); setLabel('Break');
  };
  return (
    <div className="wiz-break-form">
      <div className="wiz-field">
        <label className="wiz-label">After period #</label>
        <input type="number" className="wiz-input-sm" min={1} max={20} value={after} onChange={(e) => setAfter(e.target.value)} />
      </div>
      <div className="wiz-field">
        <label className="wiz-label">Duration (min)</label>
        <input type="number" className="wiz-input-sm" min={5} max={60} value={dur} onChange={(e) => setDur(e.target.value)} />
      </div>
      <div className="wiz-field" style={{ flex: 1, minWidth: 0 }}>
        <label className="wiz-label">Label</label>
        <input type="text" className="wiz-input-sm" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Break / Lunch" />
      </div>
      <Tooltip text="Add this break to the schedule">
        <button className="wiz-btn-add-break" onClick={submit} type="button">
          <i className="fa-solid fa-plus"></i> Add
        </button>
      </Tooltip>
    </div>
  );
}

function WizBreakChips({ list, scope, removeBreakAt }) {
  if (!list.length) return <div className="wiz-empty-chip">No breaks added — fill the form above and click <strong>Add</strong></div>;
  return (
    <>
      {list.map((b, i) => (
        <div key={i} className="wiz-chip">
          <span className="wiz-chip-icon">☕</span>
          <span className="wiz-chip-main">After Period {b.afterPeriod}</span>
          <span className="wiz-badge wiz-badge--red">{b.duration} min</span>
          <span className="wiz-chip-label">"{b.label || 'Break'}"</span>
          <Tooltip text="Remove this break"><button type="button" className="wiz-chip-del" onClick={() => removeBreakAt(scope, i)}>✕</button></Tooltip>
        </div>
      ))}
    </>
  );
}

function WizStep2({ w, defP, addBreakTo, removeBreakAt, setDayBreakMode }) {
  return (
    <>
      <div className="wiz-desc-box">
        <i className="fa-solid fa-info-circle"></i>
        Set a <strong>default break schedule</strong> for all working days, then customise individual days as needed — e.g. shorter Friday recess or a Monday-only lunch.
      </div>

      {/* Default break card */}
      <div className="wiz-bk-card wiz-bk-card--default">
        <div className="wiz-bk-card-hdr">
          <div className="wiz-bk-card-icon" style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}>
            <i className="fa-solid fa-calendar-check"></i>
          </div>
          <div>
            <div className="wiz-bk-card-title">Default Break Schedule</div>
            <div className="wiz-bk-card-sub">Applied to all working days unless overridden</div>
          </div>
        </div>
        <div className="wiz-bk-card-body">
          <WizBreakForm scope="default" addBreakTo={addBreakTo} defP={defP} />
          <div className="wiz-chips">
            <WizBreakChips list={w.defaultBreaks} scope="default" removeBreakAt={removeBreakAt} />
          </div>
        </div>
      </div>

      {/* Per-day overrides */}
      <div className="wiz-section-label">
        <i className="fa-solid fa-calendar-day" style={{ color: '#7C3AED', marginRight: 6 }}></i>
        Day-Specific Overrides
      </div>
      <div className="wiz-bk-day-list">
        {w.workDays.map((di) => {
          const hasOverride = Array.isArray(w.dayBreaks[di]);
          const list = hasOverride ? w.dayBreaks[di] : [];
          const dc = WIZ_DAY_COLORS[di % WIZ_DAY_COLORS.length];
          return (
            <div key={di} className={`wiz-bk-day${hasOverride ? ' wiz-bk-day--custom' : ''}`}>
              <div className="wiz-bk-day-hdr">
                <div className="wiz-bk-day-dot" style={{ background: dc }}></div>
                <div className="wiz-bk-day-name">{DAYS[di]}</div>
                <div className="wiz-bk-day-status">
                  {hasOverride
                    ? <span className="wiz-bk-status-badge wiz-bk-status-badge--custom">
                        <i className="fa-solid fa-pen" style={{ fontSize: 9 }}></i>
                        Custom: {list.length} break{list.length !== 1 ? 's' : ''}
                      </span>
                    : <span className="wiz-bk-status-badge wiz-bk-status-badge--inherit">
                        <i className="fa-solid fa-link" style={{ fontSize: 9 }}></i>
                        Using default
                      </span>}
                </div>
                <Tooltip text={hasOverride ? `Remove ${DAYS[di]}'s custom breaks and use the default schedule` : `Set a custom break schedule for ${DAYS[di]}`}>
                  <button
                    className={hasOverride ? 'wiz-bk-btn-remove' : 'wiz-bk-btn-custom'}
                    onClick={() => setDayBreakMode(di, !hasOverride)}
                    type="button"
                  >
                    {hasOverride
                      ? <><i className="fa-solid fa-times"></i> Remove custom</>
                      : <><i className="fa-solid fa-plus"></i> Customise</>}
                  </button>
                </Tooltip>
              </div>
              {hasOverride && (
                <div className="wiz-bk-day-body">
                  <WizBreakForm scope={di} addBreakTo={addBreakTo} defP={defP} />
                  <div className="wiz-chips">
                    <WizBreakChips list={list} scope={di} removeBreakAt={removeBreakAt} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ─── Step 3 — Periods (two-panel: per-day editor + lesson allocation) ─── */
function WizStep3({ w, update, defP, wizSlotsFor, setSubjectLessons, setPeriodDur, resetPeriodDur, resetDayDurs, totalWeekPeriods }) {
  const selDay     = (w._step3Day != null && w.workDays.includes(w._step3Day)) ? w._step3Day : w.workDays[0];
  const slots      = wizSlotsFor(selDay);
  const periods    = slots.filter((s) => !s.isBreak);
  const hasCustomDur = !!w.dayPeriodLens[selDay];
  const dayMax     = w.dayMaxPeriods[selDay] !== undefined ? w.dayMaxPeriods[selDay] : defP;

  /* Right-panel lesson allocation totals */
  const usedLessons  = Object.values(w.subjectWeeklyLessons).reduce((a, b) => a + (+b || 0), 0);
  const lessonPct    = totalWeekPeriods > 0 ? Math.min(100, Math.round(usedLessons / totalWeekPeriods * 100)) : 0;
  const lessonStatus = usedLessons > totalWeekPeriods ? 'over' : (usedLessons === totalWeekPeriods && totalWeekPeriods > 0) ? 'exact' : 'under';

  return (
    <div className="wiz-two-panel">
      {/* ══════════ LEFT PANEL — Periods per Day ══════════ */}
      <div className="wiz-panel">
        <div className="wiz-section-label"><i className="fa-solid fa-sliders" style={{ color: '#7C3AED', marginRight: 6 }}></i> Periods per Day</div>
        <div className="wiz-desc-box" style={{ marginBottom: 10 }}>
          <i className="fa-solid fa-info-circle"></i>
          Click a day to select it, then use <b>−/+</b> to set its period count. Fine-tune each period's duration in the cards below.
        </div>

        {/* Day selector grid */}
        <div className="wiz-day-sel-grid">
          {w.workDays.map((di) => {
            const dMax = w.dayMaxPeriods[di] !== undefined ? w.dayMaxPeriods[di] : defP;
            const isActive = selDay === di;
            const isCustom = w.dayMaxPeriods[di] !== undefined || !!w.dayPeriodLens[di];
            return (
              <Tooltip key={di} text={`Edit periods for ${DAYS[di]}${isCustom ? ' (custom)' : ''}`}>
                <button
                  className={`wiz-day-sel-card${isActive ? ' wiz-day-sel-card--on' : ''}${isCustom ? ' wiz-day-sel-card--custom' : ''}`}
                  onClick={() => update({ _step3Day: di })}
                  type="button"
                >
                  <div className="wiz-day-sel-name">{DAYS[di].substring(0, 3)}</div>
                  <div className="wiz-day-sel-num">{dMax}</div>
                  <div className="wiz-day-sel-unit">periods</div>
                  {isCustom && <div className="wiz-day-sel-dot" />}
                </button>
              </Tooltip>
            );
          })}
        </div>

        {/* Period count stepper for selected day */}
        <div className="wiz-period-count-bar">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="wiz-period-count-title">{DAYS[selDay]}</div>
            <div className="wiz-period-count-sub">Teaching periods this day</div>
          </div>
          <div className="wiz-stepper wiz-stepper--lg">
            <Tooltip text={`One fewer period on ${DAYS[selDay]}`}>
              <button className="wiz-stepper-btn wiz-stepper-btn--lg" onClick={() => update({ dayMaxPeriods: { ...w.dayMaxPeriods, [selDay]: Math.max(1, dayMax - 1) } })} type="button">−</button>
            </Tooltip>
            <span className="wiz-stepper-val wiz-stepper-val--lg">{dayMax}</span>
            <Tooltip text={`One more period on ${DAYS[selDay]}`}>
              <button className="wiz-stepper-btn wiz-stepper-btn--lg" onClick={() => update({ dayMaxPeriods: { ...w.dayMaxPeriods, [selDay]: Math.min(20, dayMax + 1) } })} type="button">+</button>
            </Tooltip>
          </div>
          {w.dayMaxPeriods[selDay] !== undefined ? (
            <Tooltip text={`Reset ${DAYS[selDay]} back to the default period count`}>
              <button className="wiz-link-btn" onClick={() => {
                const next = { ...w.dayMaxPeriods };
                delete next[selDay];
                update({ dayMaxPeriods: next });
              }} type="button">↩ Reset</button>
            </Tooltip>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Default</span>
          )}
        </div>

        {/* Period durations */}
        <div className="wiz-section-label wiz-sub-label">
          <span><i className="fa-solid fa-stopwatch" style={{ marginRight: 5 }}></i> Period Durations — {DAYS[selDay]}</span>
          {hasCustomDur && (
            <Tooltip text={`Reset every period on ${DAYS[selDay]} to the default duration`}>
              <button className="wiz-link-btn" onClick={() => resetDayDurs(selDay)} type="button" style={{ marginLeft: 8, fontSize: 10.5 }}>
                ↩ Reset durations
              </button>
            </Tooltip>
          )}
        </div>
        {periods.length === 0 ? (
          <div className="wiz-empty-chip">No periods — increase count above or extend school hours.</div>
        ) : (
          <div className="wiz-period-grid">
            {periods.map((sl, pi) => {
              const custom = w.dayPeriodLens[selDay] && w.dayPeriodLens[selDay][pi] !== undefined && w.dayPeriodLens[selDay][pi] !== w.defaultPeriodLen;
              const dur = custom ? w.dayPeriodLens[selDay][pi] : w.defaultPeriodLen;
              return (
                <div key={pi} className={`wiz-period-card${custom ? ' wiz-period-card--custom' : ''}`}>
                  <div className="wiz-period-num">P{sl.periodNo}</div>
                  <div className="wiz-period-time">{fmt12plain(sl.start)}</div>
                  <input
                    type="number"
                    min={10}
                    max={120}
                    value={dur}
                    className="wiz-period-input"
                    onChange={(e) => setPeriodDur(selDay, pi, parseInt(e.target.value, 10) || w.defaultPeriodLen)}
                  />
                  <span className="wiz-period-unit">min</span>
                  {custom && (
                    <Tooltip text="Reset to default duration"><button className="wiz-period-reset" onClick={() => resetPeriodDur(selDay, pi)} type="button">↩</button></Tooltip>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Timeline */}
        <div className="wiz-section-label wiz-sub-label" style={{ marginTop: 14 }}>
          <i className="fa-solid fa-list-ul" style={{ marginRight: 5 }}></i> {DAYS[selDay]} Schedule Preview
        </div>
        {slots.length === 0 ? (
          <div className="wiz-empty-chip">No slots yet.</div>
        ) : (
          <div className="wiz-tl-list">
            {slots.map((sl, i) => (
              <div key={i} className={`wiz-tl-row${sl.isBreak ? ' wiz-tl-row--break' : ''}`}>
                <div className="wiz-tl-dot" style={{ background: sl.isBreak ? '#DC2626' : '#0284C7' }}>
                  {sl.isBreak ? '☕' : sl.periodNo}
                </div>
                <span className="wiz-tl-name" style={{ color: sl.isBreak ? '#DC2626' : 'var(--text-primary)' }}>
                  {sl.isBreak ? sl.label : `Period ${sl.periodNo}`}
                </span>
                <span className="wiz-tl-time">{fmt12plain(sl.start)} – {fmt12plain(sl.end)}</span>
                <span className={`wiz-badge ${sl.isBreak ? 'wiz-badge--red' : 'wiz-badge--blue'}`}>{sl.duration}m</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════ RIGHT PANEL — Weekly Lesson Allocation ══════════ */}
      <div className="wiz-panel wiz-panel--border">
        <div className="wiz-section-label" style={{ marginBottom: 6 }}>
          <i className="fa-solid fa-book-open" style={{ color: '#7C3AED', marginRight: 6 }}></i> Weekly Lesson Allocation
        </div>
        <div className="wiz-desc-box" style={{ marginBottom: 10 }}>
          <i className="fa-solid fa-info-circle"></i>
          Total available this week: <b>{totalWeekPeriods} periods/class</b>. Use −/+ per subject.
        </div>
        <div className="wiz-lesson-bar-wrap">
          <div className="wiz-lesson-bar-track">
            <div className={`wiz-lesson-bar-fill wiz-lesson-bar--${lessonStatus}`} style={{ width: `${lessonPct}%` }} />
          </div>
          <div className={`wiz-lesson-sum wiz-lesson-sum--${lessonStatus}`}>
            {usedLessons} / {totalWeekPeriods} lessons allocated
            {lessonStatus === 'over'  && '  ⚠️ Over capacity'}
            {lessonStatus === 'exact' && '  ✅ Perfect'}
          </div>
        </div>
        <div className="wiz-subj-list">
          {TT_SUBJECTS.map((subj) => {
            const val = +w.subjectWeeklyLessons[subj] || 0;
            const color = SUBJ_COLORS[subj] || '#1E3A8A';
            return (
              <div key={subj} className="wiz-subj-row">
                <span className="wiz-subj-badge" style={{ background: color }}>{subj}</span>
                <div className="wiz-stepper">
                  <Tooltip text={`One fewer ${subj} lesson per week`}>
                    <button className="wiz-stepper-btn" onClick={() => setSubjectLessons(subj, val - 1)} type="button">−</button>
                  </Tooltip>
                  <span className="wiz-stepper-val" style={{ minWidth: 36, fontWeight: 800, color: '#1E3A8A' }}>{val}</span>
                  <Tooltip text={`One more ${subj} lesson per week`}>
                    <button className="wiz-stepper-btn" onClick={() => setSubjectLessons(subj, val + 1)} type="button">+</button>
                  </Tooltip>
                </div>
                <span className="wiz-subj-unit">/ week</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Step 4 — Teacher Workload ─── */
function WizStep4({ w, update, toggleTeacherDay, wizSlotsFor, totalWeekPeriods, teacherNames = [] }) {
  /* Build teacher load. assigned periods are seeded proportionally from
     subject weekly lessons so the visualisation feels meaningful. */
  const subjectLessonsTotal = Object.values(w.subjectWeeklyLessons).reduce((a, b) => a + (+b || 0), 0);
  const assignedPerTeacher = teacherNames.length > 0 ? Math.round(subjectLessonsTotal / teacherNames.length) : 0;

  const teacherLoad = teacherNames.map((name) => {
    const days = w.teacherWorkdays[name] !== undefined ? w.teacherWorkdays[name] : w.workDays;
    const capacity = days
      .filter((d) => w.workDays.includes(d))
      .reduce((s, di) => s + wizSlotsFor(di).filter((x) => !x.isBreak).length, 0);
    return { name, days, capacity, assigned: assignedPerTeacher };
  });

  const overloaded = teacherLoad.filter((t) => t.assigned > t.capacity);
  const ok         = teacherLoad.filter((t) => t.assigned <= t.capacity);

  /* Persist a summary into wizard state so Step 5 can read it without recomputing */
  if (!w._validationResult || w._validationResult.overloadedCount !== overloaded.length) {
    setTimeout(() => update({
      _validationResult: { overloadedCount: overloaded.length, overloadedNames: overloaded.map((t) => t.name), totalWeekPeriods }
    }), 0);
  }

  const renderRow = (t, isOver) => {
    const pct = t.capacity > 0 ? Math.min(100, Math.round(t.assigned / t.capacity * 100)) : 0;
    const color = isOver ? '#DC2626' : pct > 85 ? '#D97706' : '#15803D';
    const daysStr = DAYS.filter((_, i) => t.days.includes(i)).map((d) => d.substring(0, 3)).join(', ') || '—';
    return (
      <div key={t.name} className={`wiz-tload-row${isOver ? ' wiz-tload-row--over' : ''}`}>
        <div className="wiz-tload-avatar" style={{ background: color }}>{t.name.charAt(0)}</div>
        <div className="wiz-tload-info">
          <div className="wiz-tload-name">{t.name}</div>
          <div className="wiz-tload-days">
            <i className="fa-regular fa-calendar" style={{ fontSize: 9, marginRight: 4, opacity: .6 }}></i>
            {daysStr} · {t.capacity} periods available
          </div>
        </div>
        <div className="wiz-tload-stat">
          <div className="wiz-tload-bar-track">
            <div className="wiz-tload-bar-fill" style={{ width: pct + '%', background: color }}></div>
          </div>
          <div className="wiz-tload-nums" style={{ color }}>{t.assigned}/{t.capacity}</div>
          {isOver && <div className="wiz-tload-over">+{t.assigned - t.capacity} over</div>}
        </div>
        <div className="wiz-tload-day-picker">
          <span className="wiz-tload-day-label">Days available</span>
          <div className="wiz-tload-day-mini-row">
            {DAYS.map((d, di) => {
              const avail = t.days.includes(di) && w.workDays.includes(di);
              const disabled = !w.workDays.includes(di);
              return (
                <Tooltip key={di} text={disabled ? `${d} is not a working day` : (avail ? `${t.name} is available on ${d} — click to disable` : `Mark ${t.name} available on ${d}`)}>
                  <button
                    className={`wiz-mini-day${avail ? ' wiz-mini-day--on' : ''}${disabled ? ' wiz-mini-day--disabled' : ''}`}
                    onClick={() => !disabled && toggleTeacherDay(t.name, di)}
                    type="button"
                    disabled={disabled}
                  >
                    {d.substring(0, 1)}
                  </button>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  if (teacherLoad.length === 0) {
    return (
      <div className="wiz-empty-state">
        <i className="fa-solid fa-user-slash"></i>
        <div>No teachers found. Add staff first, then return to the auto-generator — or proceed and the auto-generator will leave teacher fields blank for manual assignment.</div>
      </div>
    );
  }

  return (
    <>
      <div className="wiz-desc-box">
        <i className="fa-solid fa-info-circle"></i>
        Total available periods this week: <b>{totalWeekPeriods} per class per week</b>.
        Each teacher's workload is calculated from the assigned subject lessons. Adjust day availability below to change a teacher's capacity.
      </div>

      {overloaded.length > 0 && (
        <>
          <div className="wiz-alert wiz-alert--error">
            <i className="fa-solid fa-triangle-exclamation"></i>
            <div>
              <div className="wiz-alert-title">{overloaded.length} teacher{overloaded.length > 1 ? 's are' : ' is'} over capacity</div>
              <div className="wiz-alert-sub">Review their day availability or reduce assigned classes. Timetable can still be generated — overloaded slots will be left blank for manual adjustment.</div>
            </div>
          </div>
          <div className="wiz-tload-list">{overloaded.map((t) => renderRow(t, true))}</div>
        </>
      )}

      {ok.length > 0 && (
        <div className="wiz-tload-list" style={{ marginTop: overloaded.length ? 16 : 0 }}>
          {ok.map((t) => renderRow(t, false))}
        </div>
      )}
    </>
  );
}

/* ─── Step 5 — Confirm (stats + checks + day breakdown + status) ─── */
function WizStep5({ w, update, validation, wizSlotsFor, totalWeekPeriods, selectedSet }) {
  /* Recompute the checks fresh on this screen so display stays in sync */
  const usedLessons = Object.values(w.subjectWeeklyLessons).reduce((a, b) => a + (+b || 0), 0);
  const overloadedNames = w._validationResult?.overloadedNames || [];

  const checks = [
    {
      title: 'Subject lesson allocation',
      state: usedLessons === 0 ? 'warn'
           : usedLessons > totalWeekPeriods ? 'fail'
           : 'ok',
      detail: usedLessons === 0
        ? 'No lessons allocated — timetable will have blank subject slots'
        : usedLessons > totalWeekPeriods
          ? `${usedLessons} lessons allocated but only ${totalWeekPeriods} available (${usedLessons - totalWeekPeriods} over)`
          : `${usedLessons} of ${totalWeekPeriods} periods allocated (${totalWeekPeriods - usedLessons} free period${totalWeekPeriods - usedLessons !== 1 ? 's' : ''})`,
    },
    {
      title: 'Teacher workload',
      state: overloadedNames.length === 0 ? 'ok' : 'warn',
      detail: overloadedNames.length === 0
        ? 'All teachers are within capacity'
        : `Over capacity: ${overloadedNames.join(', ')}`,
    },
    {
      title: 'Working days configured',
      state: w.workDays.length > 0 ? 'ok' : 'fail',
      detail: w.workDays.length > 0 ? w.workDays.map((i) => DAYS[i]).join(', ') : 'No working days selected',
    },
    {
      title: 'Classes available',
      state: selectedSet.size > 0 ? 'ok' : 'fail',
      detail: selectedSet.size > 0
        ? `${selectedSet.size} class-section${selectedSet.size > 1 ? 's' : ''} selected`
        : 'No classes selected',
    },
    {
      title: 'Period slots fit in school hours',
      state: w.workDays.every((di) => wizSlotsFor(di).filter((s) => !s.isBreak).length > 0) ? 'ok' : 'fail',
      detail: w.workDays.every((di) => wizSlotsFor(di).filter((s) => !s.isBreak).length > 0)
        ? `Periods fit within ${fmt12plain(w.schoolStart)} – ${fmt12plain(w.schoolEnd)}`
        : 'Periods do not fit — reduce period duration or extend school hours',
    },
  ];

  const dayBreakdown = w.workDays.map((di) => {
    const slots = wizSlotsFor(di);
    return {
      day: DAYS[di],
      count: slots.filter((s) => !s.isBreak).length,
      breaks: slots.filter((s) => s.isBreak).length,
    };
  });

  const avgPerDay = w.workDays.length > 0 ? Math.round(totalWeekPeriods / w.workDays.length) : 0;
  const anyFail = checks.some((c) => c.state === 'fail');
  const anyWarn = checks.some((c) => c.state === 'warn');

  return (
    <>
      {/* Top stats cards */}
      <div className="wiz-stats-grid">
        <div className="wiz-stat-card wiz-stat-card--purple">
          <div className="wiz-stat-val">{w.workDays.length}</div>
          <div className="wiz-stat-key">Working Days</div>
        </div>
        <div className="wiz-stat-card wiz-stat-card--blue">
          <div className="wiz-stat-val">{avgPerDay}</div>
          <div className="wiz-stat-key">Avg Periods/Day</div>
        </div>
        <div className="wiz-stat-card wiz-stat-card--amber">
          <div className="wiz-stat-val">{totalWeekPeriods}</div>
          <div className="wiz-stat-key">Total Periods/Week</div>
        </div>
        <div className="wiz-stat-card wiz-stat-card--green">
          <div className="wiz-stat-val">{selectedSet.size}</div>
          <div className="wiz-stat-key">Classes</div>
        </div>
      </div>

      {/* Pre-Generation Checks */}
      <div className="wiz-section-label" style={{ marginBottom: 10 }}>
        <i className="fa-solid fa-clipboard-check" style={{ color: '#7C3AED', marginRight: 6 }}></i>
        Pre-Generation Checks
      </div>
      <div className="wiz-check-list">
        {checks.map((c, i) => (
          <div key={i} className="wiz-check-row">
            <div className={`wiz-check-icon wiz-check-${c.state}`}>
              <i className={`fa-solid fa-${c.state === 'ok' ? 'check' : c.state === 'warn' ? 'exclamation' : 'times'}`}></i>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="wiz-check-title">{c.title}</div>
              <div className="wiz-check-detail">{c.detail}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Day-by-Day Schedule */}
      <div className="wiz-section-label" style={{ marginTop: 16, marginBottom: 8 }}>
        <i className="fa-solid fa-calendar-days" style={{ color: '#7C3AED', marginRight: 6 }}></i>
        Day-by-Day Schedule
      </div>
      <div className="wiz-day-summary-grid">
        {dayBreakdown.map((d, i) => (
          <div key={i} className="wiz-day-summary-card">
            <div className="wiz-day-summary-name">{d.day.substring(0, 3)}</div>
            <div className="wiz-day-summary-num">{d.count}</div>
            <div className="wiz-day-summary-sub">
              periods{d.breaks ? `, ${d.breaks} break${d.breaks > 1 ? 's' : ''}` : ''}
            </div>
          </div>
        ))}
      </div>

      {/* Status banner */}
      {anyFail ? (
        <div className="wiz-alert wiz-alert--error" style={{ marginTop: 16 }}>
          <i className="fa-solid fa-circle-xmark"></i>
          <div>
            <div className="wiz-alert-title">Cannot generate — fix the errors above first</div>
            <div className="wiz-alert-sub">Go back and resolve each ✗ check, then return here.</div>
          </div>
        </div>
      ) : anyWarn ? (
        <div className="wiz-alert wiz-alert--warn" style={{ marginTop: 16 }}>
          <i className="fa-solid fa-triangle-exclamation"></i>
          <div>
            <div className="wiz-alert-title">Ready to generate with warnings</div>
            <div className="wiz-alert-sub">Overloaded teacher slots and unallocated periods will be left blank for manual adjustment.</div>
          </div>
        </div>
      ) : (
        <div className="wiz-alert wiz-alert--ok" style={{ marginTop: 16 }}>
          <i className="fa-solid fa-circle-check"></i>
          <div>
            <div className="wiz-alert-title">All checks passed — ready to generate!</div>
            <div className="wiz-alert-sub">Click <strong>Generate Timetable</strong> below to build the full week for {selectedSet.size} class{selectedSet.size !== 1 ? 'es' : ''}.</div>
          </div>
        </div>
      )}

      {/* "Leave blank" toggle — only when no errors */}
      {!anyFail && (
        <Tooltip text={w._leaveBlank ? 'Disable: overloaded slots will be filled by best-effort assignment' : 'Enable: keep overloaded and unallocated slots blank for manual filling later'}>
          <button className={`wiz-toggle-card${w._leaveBlank ? ' wiz-toggle-card--on' : ''}`} onClick={() => update({ _leaveBlank: !w._leaveBlank })} type="button" style={{ marginTop: 12 }}>
            <div className={`wiz-toggle-box${w._leaveBlank ? ' wiz-toggle-box--on' : ''}`}>
              {w._leaveBlank && <i className="fa-solid fa-check" style={{ fontSize: 10, color: '#fff' }}></i>}
            </div>
            <div>
              <div className="wiz-toggle-title">Leave overloaded/unallocated periods blank</div>
              <div className="wiz-toggle-sub">Generate with available capacity — blank slots can be filled manually afterward in the class Update modal</div>
            </div>
          </button>
        </Tooltip>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CSS
   ═══════════════════════════════════════════════════════════════════ */
const TT_CSS = `
/* Toolbar */
.tt-toolbar { display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; background:var(--bg-card); border:1.5px solid var(--border-light); border-radius:14px; padding:14px 18px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,.04); }
.tt-toolbar-title { font-size:15px; font-weight:800; color:var(--text-primary); display:flex; align-items:center; }
.tt-toolbar-sub { font-size:11.5px; color:var(--text-muted); margin-top:2px; }
.tt-toolbar-right { display:flex; gap:10px; flex-wrap:wrap; }

.tt-btn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border:none; border-radius:10px; font-family:var(--font-body); font-size:13px; font-weight:700; cursor:pointer; transition:all .2s cubic-bezier(.4,0,.2,1); white-space:nowrap; }
.tt-btn-purple { background:linear-gradient(135deg,#7C3AED,#6D28D9); color:#fff; box-shadow:0 4px 14px rgba(109,40,217,.3); }
.tt-btn-purple:hover { transform:translateY(-2px); box-shadow:0 8px 22px rgba(109,40,217,.45); }
.tt-btn-red { background:linear-gradient(135deg,#EF4444,#DC2626); color:#fff; box-shadow:0 4px 14px rgba(220,38,38,.3); }
.tt-btn-red:hover { transform:translateY(-2px); box-shadow:0 8px 22px rgba(220,38,38,.45); }
.tt-btn-pdf { background:linear-gradient(135deg,#DC2626,#B91C1C); color:#fff; box-shadow:0 4px 14px rgba(220,38,38,.3); }
.tt-btn-pdf:hover { transform:translateY(-2px); box-shadow:0 8px 22px rgba(220,38,38,.45); }

/* Day tabs */
.tt-day-tabs { display:flex; gap:0; background:var(--bg-card); border:1.5px solid var(--border-light); border-radius:14px; overflow:hidden; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,.04); }
.tt-day-btn { flex:1; padding:12px 8px; border:none; background:transparent; font-family:var(--font-body); font-size:13px; font-weight:600; color:var(--text-muted); cursor:pointer; transition:all .2s ease; border-bottom:3px solid transparent; }
.tt-day-btn:hover:not(.active) { background:var(--bg-muted); color:var(--brand-primary); }
.tt-day-btn.active { background:var(--bg-muted); color:var(--brand-primary); border-bottom-color:var(--brand-primary); font-weight:700; }

/* Class table */
.tt-table-card { background:var(--bg-card); border:1.5px solid var(--border-light); border-radius:14px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.04); margin-bottom:24px; }
.tt-table-head { display:grid; grid-template-columns:64px 1fr 130px 240px 90px; background:var(--bg-muted); border-bottom:1px solid var(--border-light); padding:0 14px; }
.tt-th { padding:11px 8px; font-size:10.5px; font-weight:700; color:var(--text-muted); letter-spacing:.6px; text-transform:uppercase; }
.tt-row-wrap { border-bottom:1px solid var(--border-light); }
.tt-row-wrap:last-child { border-bottom:none; }
.tt-row { display:grid; grid-template-columns:64px 1fr 130px 240px 90px; padding:0 14px; align-items:center; min-height:56px; transition:background .15s ease; }
.tt-row:nth-child(even) { background:var(--bg-muted); }
.tt-row:hover { background:rgba(30,58,138,.04) !important; }
.tt-row.expanded-row { background:rgba(30,58,138,.05) !important; }
.tt-td { padding:8px; font-size:13px; color:var(--text-primary); display:flex; align-items:center; }
.tt-td-num { color:var(--text-muted); font-weight:700; font-size:12px; }
.tt-td-cls { gap:10px; }
.tt-td-actions { gap:8px; flex-wrap:wrap; }
.tt-td-chev { justify-content:center; }

.tt-avatar { width:30px; height:30px; border-radius:8px; color:#fff; font-weight:800; font-size:13px; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 2px 4px rgba(0,0,0,.08); }
.tt-section-pill { display:inline-flex; align-items:center; padding:3px 10px; border-radius:999px; background:#EFF6FF; color:#1E40AF; font-size:11.5px; font-weight:700; border:1px solid #BFDBFE; }

.btn-tt-update { background:linear-gradient(135deg,#1D4ED8,#1E3A8A); color:#fff; border:none; border-radius:10px; padding:6px 14px; font-size:12.5px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:5px; font-family:var(--font-body); transition:all .2s cubic-bezier(.4,0,.2,1); box-shadow:0 2px 6px rgba(30,58,138,.2); white-space:nowrap; }
.btn-tt-update:hover { transform:translateY(-2px); box-shadow:0 6px 16px rgba(30,58,138,.5); }
.btn-tt-dl { background:linear-gradient(135deg,#EF4444,#DC2626); color:#fff; border:none; border-radius:8px; padding:0 10px; height:30px; font-size:11.5px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:5px; font-family:var(--font-body); transition:all .2s; box-shadow:0 2px 8px rgba(220,38,38,.35); white-space:nowrap; }
.btn-tt-dl:hover { transform:translateY(-2px); box-shadow:0 6px 16px rgba(220,38,38,.5); }
.btn-tt-del { width:30px; height:30px; border-radius:8px; background:var(--bg-muted); color:var(--text-muted); border:1.5px solid var(--border-light); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; font-size:11px; transition:all .2s; }
.btn-tt-del:hover { color:#DC2626; border-color:#DC2626; background:rgba(220,38,38,.06); }

.tt-expand-btn { width:32px; height:32px; border-radius:8px; background:var(--bg-card); border:1.5px solid var(--border-light); color:var(--text-muted); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; font-size:11px; transition:all .2s; }
.tt-expand-btn:hover { border-color:var(--brand-primary); color:var(--brand-primary); }
.tt-expand-btn.open { transform:rotate(180deg); border-color:var(--brand-primary); color:var(--brand-primary); background:rgba(30,58,138,.08); }

/* Expand panel */
.tt-expand { background:var(--bg-muted); border-top:1px solid var(--border-light); overflow:hidden; max-height:0; transition:max-height .4s cubic-bezier(.4,0,.2,1); }
.tt-expand.open { max-height:1200px; }
.tt-empty-detail { text-align:center; padding:32px 20px; background:var(--bg-muted); }
.tt-empty-icon { font-size:36px; color:var(--brand-primary); opacity:.3; margin-bottom:8px; }
.tt-empty-title { font-size:14px; font-weight:700; color:var(--text-primary); margin-bottom:4px; }
.tt-empty-sub { font-size:12.5px; color:var(--text-muted); }

.tt-details-hdr { background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff; font-size:13.5px; font-weight:700; text-align:center; padding:11px; letter-spacing:.2px; }
.tt-detail-table { width:100%; border-collapse:collapse; }
.tt-detail-table thead tr { background:#1a1a2e; }
.tt-detail-table thead th { padding:10px 12px; font-size:11px; font-weight:700; color:#fff; text-align:left; letter-spacing:.4px; text-transform:uppercase; }
.tt-detail-table tbody tr { border-bottom:1px solid var(--border-light); transition:background .15s; background:var(--bg-card); }
.tt-detail-table tbody tr:nth-child(even) { background:var(--bg-muted); }
.tt-detail-table tbody tr:hover { background:rgba(30,58,138,.04); }
.tt-detail-table td { padding:10px 12px; font-size:13px; color:var(--text-primary); }
.tt-subj-badge { padding:3px 10px; border-radius:99px; font-size:11.5px; font-weight:700; color:#fff; display:inline-block; }

/* Overlay shared */
.tt-overlay { position:fixed; inset:0; background:rgba(10,22,40,.55); backdrop-filter:blur(5px); z-index:9000; display:flex; align-items:center; justify-content:center; padding:18px; opacity:0; pointer-events:none; transition:opacity .2s; overflow:hidden; }
.tt-overlay.open { opacity:1; pointer-events:all; }

/* Edit modal — exact port of HTML reference (.tt-edit-modal) */
.tt-edit-modal { width:100%; max-width:760px; max-height:92vh; display:flex; flex-direction:column; border-radius:24px; overflow:hidden; background:var(--bg-card); box-shadow:0 24px 60px rgba(0,0,0,.22), 0 8px 20px rgba(0,0,0,.1); animation:ttModalIn .25s cubic-bezier(.34,1.56,.64,1); }
@keyframes ttModalIn { from { opacity:0; transform:scale(.94) translateY(16px); } to { opacity:1; transform:scale(1) translateY(0); } }

/* Header */
.tt-edit-hdr { display:flex; align-items:center; gap:14px; padding:20px 24px; background:linear-gradient(135deg,#1E3A8A,#1D4ED8,#2563EB); flex-shrink:0; position:relative; overflow:hidden; }
.tt-edit-hdr::before { content:''; position:absolute; top:-30px; right:-30px; width:160px; height:160px; background:radial-gradient(circle,rgba(255,255,255,.12) 0%,transparent 70%); border-radius:50%; }
.tt-edit-hdr::after  { content:''; position:absolute; bottom:-40px; left:30%; width:120px; height:120px; background:radial-gradient(circle,rgba(30,58,138,.3) 0%,transparent 70%); border-radius:50%; }
.tt-edit-hdr-icon { width:44px; height:44px; border-radius:13px; background:rgba(255,255,255,.2); border:1.5px solid rgba(255,255,255,.3); display:flex; align-items:center; justify-content:center; color:#fff; font-size:18px; flex-shrink:0; position:relative; z-index:2; backdrop-filter:blur(6px); }
.tt-edit-hdr-text { flex:1; position:relative; z-index:2; min-width:0; }
.tt-edit-hdr-title { font-size:15px; font-weight:800; color:#fff; line-height:1.3; letter-spacing:-.02em; }
.tt-edit-hdr-sub { font-size:11.5px; color:rgba(255,255,255,.75); margin-top:2px; }
.tt-edit-close { width:34px; height:34px; border-radius:9px; background:rgba(255,255,255,.15); border:1.5px solid rgba(255,255,255,.25); color:#fff; font-size:13px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .18s ease; flex-shrink:0; position:relative; z-index:2; }
.tt-edit-close:hover { background:rgba(220,38,38,.35); border-color:rgba(220,38,38,.5); transform:rotate(90deg) scale(1.1); }

/* Meta pill bar */
.tt-edit-meta { display:flex; gap:8px; padding:10px 24px; background:var(--bg-muted); border-bottom:1px solid var(--border-light); flex-shrink:0; }
.tt-meta-pill { display:inline-flex; align-items:center; gap:6px; padding:4px 12px; border-radius:99px; font-size:11.5px; font-weight:700; }
.tt-meta-pill--blue  { background:#DBEAFE; color:#1E3A8A; border:1px solid #BFDBFE; }
.tt-meta-pill--green { background:#DCFCE7; color:#15803D; border:1px solid #BBF7D0; }

/* Scrollable body — flex:1 1 auto + min-height:0 so the body sizes to its
   natural content height when short, and only shrinks (with scroll) once the
   modal would hit max-height. flex-basis:0 would have collapsed the body to
   zero on short content, squeezing the whole modal. */
.tt-edit-body { flex:1 1 auto; min-height:0; overflow-y:auto; padding:18px 22px; display:flex; flex-direction:column; gap:12px; background:var(--bg-base); }
.tt-edit-body::-webkit-scrollbar { width:10px; }
.tt-edit-body::-webkit-scrollbar-track { background:transparent; }
.tt-edit-body::-webkit-scrollbar-thumb { background:#CBD5E1; border-radius:5px; border:2px solid var(--bg-base); }
.tt-edit-body::-webkit-scrollbar-thumb:hover { background:#94A3B8; }
.tt-edit-body { scrollbar-width:thin; scrollbar-color:#CBD5E1 transparent; }

/* Footer */
.tt-edit-footer { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:14px 22px; background:var(--bg-card); border-top:1px solid var(--border-light); flex-shrink:0; }
.tt-edit-footer-left  { display:flex; gap:8px; flex-wrap:wrap; }
.tt-edit-footer-right { display:flex; gap:8px; }

/* Footer buttons */
.tt-foot-btn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:11px; font-size:13px; font-weight:700; cursor:pointer; border:none; font-family:var(--font-body); transition:all .2s cubic-bezier(.4,0,.2,1); white-space:nowrap; }
.tt-foot-btn--ghost { background:var(--bg-muted); border:1.5px solid var(--border-light); color:var(--text-secondary); }
.tt-foot-btn--ghost:hover:not(:disabled) { border-color:var(--brand-primary); color:var(--brand-primary); background:#DBEAFE; transform:translateY(-1px); }
.tt-foot-btn--ghost:disabled { opacity:.5; cursor:not-allowed; }
.tt-foot-btn--add { background:linear-gradient(135deg,#1D4ED8,#1E3A8A); color:#fff; box-shadow:0 3px 12px rgba(30,58,138,.3); }
.tt-foot-btn--add:hover { background:linear-gradient(135deg,#2563EB,#1D4ED8); box-shadow:0 6px 18px rgba(30,58,138,.45); transform:translateY(-2px); }
.tt-foot-btn--cancel { background:transparent; border:1.5px solid var(--border-light); color:var(--text-muted); }
.tt-foot-btn--cancel:hover { background:var(--bg-muted); color:var(--text-primary); }
.tt-foot-btn--save { background:linear-gradient(135deg,#15803D,#16A34A); color:#fff; box-shadow:0 3px 12px rgba(21,128,61,.3); }
.tt-foot-btn--save:hover { background:linear-gradient(135deg,#16A34A,#22C55E); box-shadow:0 6px 18px rgba(21,128,61,.45); transform:translateY(-2px); }
.tt-foot-btn--delete { background:linear-gradient(135deg,#EF4444,#DC2626); color:#fff; box-shadow:0 3px 12px rgba(220,38,38,.3); }
.tt-foot-btn--delete:hover { background:linear-gradient(135deg,#F87171,#EF4444); box-shadow:0 6px 18px rgba(220,38,38,.45); transform:translateY(-2px); }
.tt-foot-btn:active { transform:translateY(0) scale(.97) !important; }

/* Period cards — flex-shrink:0 keeps every card at its natural height so the
   body scrolls instead of squashing Period 1/2/3/4/5 together. */
.ttp-card { flex-shrink:0; background:var(--bg-card); border:2px solid var(--border-light); border-radius:16px; overflow:hidden; transition:all .2s ease; border-left:4px solid var(--ttp-color, var(--brand-primary)); box-shadow:0 2px 8px rgba(0,0,0,.04); animation:ttpCardIn .2s ease; }
@keyframes ttpCardIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
.ttp-card:hover { box-shadow:0 4px 18px rgba(0,0,0,.1); transform:translateY(-1px); }
.ttp-card--break { background:linear-gradient(135deg,#FEF9F0,#FFFBF5); border-color:#FDE68A; border-left-color:#DC2626; }

/* Card header */
.ttp-card-hdr { display:flex; align-items:center; gap:10px; padding:12px 16px; background:linear-gradient(90deg, rgba(30,58,138,.06), transparent); border-bottom:1px solid var(--border-light); }
.ttp-card--break .ttp-card-hdr { background:linear-gradient(90deg, rgba(220,38,38,.05), transparent); }
.ttp-num { width:30px; height:30px; border-radius:50%; color:#fff; font-size:12px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 2px 8px rgba(0,0,0,.2); }
.ttp-title { flex:1; display:flex; align-items:center; gap:8px; font-size:13.5px; font-weight:800; color:var(--text-primary); min-width:0; }
.ttp-title > span:first-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ttp-dur { font-size:11px; font-weight:700; padding:2px 9px; border-radius:99px; background:var(--bg-muted); color:var(--text-muted); border:1px solid var(--border-light); flex-shrink:0; white-space:nowrap; }
.ttp-del { width:30px; height:30px; border-radius:8px; background:rgba(220,38,38,.08); border:1.5px solid rgba(220,38,38,.2); color:#DC2626; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:12px; transition:all .18s; flex-shrink:0; }
.ttp-del:hover { background:#DC2626; color:#fff; border-color:#DC2626; transform:scale(1.15) rotate(-5deg); box-shadow:0 3px 10px rgba(220,38,38,.35); }

/* Card body — 4-col grid (matches HTML) */
.ttp-body { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr); gap:12px; padding:14px 16px; }
.ttp-field { display:flex; flex-direction:column; gap:4px; min-width:0; }
.ttp-field--break-msg { grid-column:span 1; flex-direction:row; align-items:center; gap:6px; font-size:11.5px; color:var(--text-muted); background:var(--bg-muted); border-radius:9px; padding:8px 10px; border:1px dashed var(--border-light); align-self:end; }
.ttp-label { font-size:10.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.5px; display:flex; align-items:center; gap:4px; line-height:1.1; }
.ttp-label > i { flex-shrink:0; font-size:9px; opacity:.6; }

.ttp-input, .ttp-select { height:40px; border:1.5px solid var(--border-light); border-radius:10px; padding:0 12px; font-family:var(--font-body); font-size:13px; font-weight:600; color:var(--text-primary); background:var(--bg-card); outline:none; transition:border-color .2s, box-shadow .2s; width:100%; box-sizing:border-box; min-width:0; }
.ttp-input:focus, .ttp-select:focus { border-color:var(--ttp-color, var(--brand-primary)); box-shadow:0 0 0 3px rgba(30,58,138,.15); }
.ttp-input[type="time"] { font-variant-numeric:tabular-nums; }
.ttp-select { appearance:none; -webkit-appearance:none; background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' stroke='%2364748B' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>"); background-repeat:no-repeat; background-position:right 10px center; padding-right:28px; cursor:pointer; text-overflow:ellipsis; }
.ttp-select option { color:#0F172A; }
.ttp-time-display { font-size:11px; font-weight:800; color:var(--brand-primary); padding:2px 0 0 2px; min-height:16px; }

/* Inner confirm dialog (period delete) */
.tt-edit-modal { position:relative; }
.ttp-confirm-overlay { position:absolute; inset:0; background:rgba(10,22,40,.45); backdrop-filter:blur(3px); display:flex; align-items:center; justify-content:center; padding:16px; z-index:5; animation:ttIn .15s ease both; border-radius:18px; }
.ttp-confirm-modal { background:var(--bg-card); border-radius:14px; width:100%; max-width:380px; overflow:hidden; box-shadow:0 16px 42px rgba(0,0,0,.28); border:1px solid var(--border-light); animation:ttIn .22s cubic-bezier(.34,1.26,.64,1) both; }
.ttp-confirm-hdr { display:flex; align-items:center; gap:12px; padding:16px 20px; background:linear-gradient(135deg,#FEF2F2,#FFF5F5); border-bottom:1px solid #FECACA; }
.ttp-confirm-icon { width:42px; height:42px; border-radius:11px; background:linear-gradient(135deg,#EF4444,#DC2626); color:#fff; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; box-shadow:0 4px 12px rgba(220,38,38,.3); }
.ttp-confirm-title { font-size:14.5px; font-weight:800; color:#DC2626; line-height:1.2; }
.ttp-confirm-meta { font-size:11px; color:#EF4444; margin-top:3px; font-weight:600; }
.ttp-confirm-body { padding:16px 20px; }
.ttp-confirm-msg { font-size:13px; font-weight:600; color:var(--text-primary); line-height:1.55; margin-bottom:10px; }
.ttp-confirm-detail { font-size:12px; color:var(--text-muted); padding:9px 12px; background:var(--bg-muted); border-radius:8px; border:1px solid var(--border-light); }
.ttp-confirm-footer { display:flex; gap:8px; justify-content:flex-end; padding:0 20px 18px; }

/* Download modal */
.tt-dl-modal { background:var(--bg-card); border-radius:18px; width:100%; max-width:520px; max-height:90vh; overflow-y:auto; box-shadow:0 30px 80px rgba(0,0,0,.22); border:1px solid var(--border-light); animation:ttIn .25s cubic-bezier(.34,1.26,.64,1) both; }
.tt-dl-hdr { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; padding:22px 24px 18px; display:flex; align-items:center; justify-content:space-between; gap:14px; position:relative; overflow:hidden; }
.tt-dl-hdr::before { content:""; position:absolute; top:-20px; right:-20px; width:120px; height:120px; border-radius:50%; background:rgba(255,255,255,.06); }
.tt-dl-hdr-icon { width:44px; height:44px; border-radius:12px; background:rgba(255,255,255,.16); border:1.5px solid rgba(255,255,255,.28); display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; position:relative; z-index:2; }
.tt-dl-hdr-title { font-size:16px; font-weight:800; letter-spacing:-.2px; position:relative; z-index:2; }
.tt-dl-hdr-sub { font-size:12px; opacity:.85; margin-top:2px; position:relative; z-index:2; }
.tt-dl-body { padding:22px 24px; }
.tt-dl-section-lbl { font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.7px; margin-bottom:10px; }

.tt-dl-mode-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:18px; }
.tt-dl-mode { display:flex; align-items:center; gap:10px; padding:11px 14px; border-radius:12px; border:2px solid var(--border-light); background:var(--bg-card); cursor:pointer; font-family:var(--font-body); transition:all .2s; }
.tt-dl-mode:hover { border-color:#93C5FD; }
.tt-dl-mode.selected { border-color:#2563EB; background:linear-gradient(135deg,#EFF6FF,#DBEAFE); }
.tt-dl-mode:focus-visible { outline:none; border-color:#1E40AF; box-shadow:0 0 0 3px rgba(30,64,175,.22); }
[data-theme="dark"] .tt-dl-mode:focus-visible { border-color:#3B82F6; box-shadow:0 0 0 3px rgba(59,130,246,.32); }
[data-theme="dark"] .tt-dl-mode.selected { background:rgba(59,130,246,.10); border-color:#3B82F6; }
.tt-dl-mode-icon { width:32px; height:32px; border-radius:9px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:13px; flex-shrink:0; }
.tt-dl-mode-name { font-size:13px; font-weight:700; color:var(--text-primary); }
.tt-dl-mode-sub  { font-size:10.5px; color:var(--text-muted); }

.tt-dl-card { display:flex; align-items:center; gap:14px; padding:14px 16px; border-radius:14px; border:2px solid var(--border-light); background:var(--bg-card); cursor:pointer; text-align:left; font-family:var(--font-body); transition:all .2s; width:100%; }
.tt-dl-card:hover { transform:translateY(-1px); box-shadow:0 4px 14px rgba(0,0,0,.06); }
.tt-dl-card--blue:hover  { border-color:#2563EB; background:#EFF6FF; }
.tt-dl-card--green:hover { border-color:#16A34A; background:#F0FDF4; }
.tt-dl-card--amber:hover { border-color:#D97706; background:#FFFBEB; }
.tt-dl-card-icon { width:42px; height:42px; border-radius:11px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:17px; flex-shrink:0; box-shadow:0 4px 10px rgba(0,0,0,.18); }
.tt-dl-card-name { font-size:13.5px; font-weight:700; color:var(--text-primary); }
.tt-dl-card-sub  { font-size:11.5px; color:var(--text-muted); margin-top:2px; }

/* School modal */
.tt-school-modal { background:var(--bg-card); border-radius:18px; width:100%; max-width:420px; padding:28px 26px; box-shadow:0 30px 80px rgba(0,0,0,.22); border:1px solid var(--border-light); animation:ttIn .25s cubic-bezier(.34,1.26,.64,1) both; }
.tt-school-icon { width:52px; height:52px; border-radius:14px; background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff; display:flex; align-items:center; justify-content:center; font-size:22px; margin:0 auto 12px; box-shadow:0 4px 14px rgba(30,58,138,.3); }
.tt-school-title { font-size:17px; font-weight:800; color:var(--text-primary); margin-bottom:4px; }
.tt-school-sub { font-size:12.5px; color:var(--text-muted); }
.tt-school-opt { display:flex; align-items:center; gap:14px; padding:14px 18px; border-radius:14px; border:2px solid var(--border-light); background:var(--bg-card); cursor:pointer; text-align:left; transition:all .2s ease; font-family:var(--font-body); }
.tt-school-opt:hover { border-color:var(--brand-primary); background:var(--bg-muted); }
.tt-school-opt-name { font-size:13.5px; font-weight:700; color:var(--text-primary); }
.tt-school-opt-sub  { font-size:11.5px; color:var(--text-muted); margin-top:2px; }

/* Delete modal */
.tt-del-modal { background:var(--bg-card); border-radius:18px; width:100%; max-width:440px; overflow:hidden; box-shadow:0 30px 80px rgba(0,0,0,.22); border:1px solid var(--border-light); animation:ttIn .25s cubic-bezier(.34,1.26,.64,1) both; }
.tt-del-hdr { padding:22px 24px 18px; background:linear-gradient(135deg,#FEF2F2,#FFF5F5); border-bottom:1px solid #FECACA; display:flex; align-items:center; gap:14px; }
.tt-del-icon-wrap { width:48px; height:48px; border-radius:14px; background:linear-gradient(135deg,#EF4444,#DC2626); color:#fff; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; box-shadow:0 4px 14px rgba(220,38,38,.3); }
.tt-del-title { font-size:15px; font-weight:800; color:#DC2626; line-height:1.25; }
.tt-del-meta  { font-size:11.5px; color:#EF4444; margin-top:3px; font-weight:600; }
.tt-del-body { padding:20px 24px; }
.tt-del-msg { font-size:13.5px; font-weight:600; color:var(--text-primary); line-height:1.55; margin-bottom:10px; }
.tt-del-detail { font-size:12px; color:var(--text-muted); line-height:1.5; padding:10px 14px; background:var(--bg-muted); border-radius:9px; border:1px solid var(--border-light); }
.tt-del-footer { padding:0 24px 22px; display:flex; gap:10px; justify-content:flex-end; }

/* ═══════════════════════════════════════════════════════════════════
   Auto-Generate Wizard
   ═══════════════════════════════════════════════════════════════════ */
.wiz-modal { width:100%; max-width:820px; max-height:94vh; display:flex; flex-direction:column; border-radius:24px; overflow:hidden; background:var(--bg-card); box-shadow:0 24px 60px rgba(0,0,0,.22), 0 8px 20px rgba(0,0,0,.1); animation:ttModalIn .25s cubic-bezier(.34,1.56,.64,1); }
.wiz-header { display:flex; align-items:center; justify-content:space-between; padding:18px 24px; background:linear-gradient(135deg,#4C1D95,#6D28D9,#7C3AED); flex-shrink:0; }
.wiz-header-icon { width:40px; height:40px; border-radius:11px; background:rgba(255,255,255,.2); display:flex; align-items:center; justify-content:center; color:#fff; font-size:17px; flex-shrink:0; border:1.5px solid rgba(255,255,255,.3); }
.wiz-header-title { font-size:15px; font-weight:800; color:#fff; }
.wiz-header-sub { font-size:11.5px; color:rgba(255,255,255,.75); margin-top:2px; }

.wiz-pills-bar { display:flex; align-items:center; padding:14px 24px; background:var(--bg-card); border-bottom:1px solid var(--border-light); flex-shrink:0; gap:0; }
.wiz-pill { display:flex; align-items:center; gap:5px; padding:6px 12px; border-radius:99px; font-size:11px; font-weight:700; border:1.5px solid var(--border-light); color:var(--text-muted); background:var(--bg-card); transition:all .25s; white-space:nowrap; }
.wiz-pill .wsn { font-size:10px; font-weight:800; }
.wiz-pill .wiz-pill-lbl { display:none; }
.wiz-pill[data-state="active"] { border-color:#7C3AED; background:#EDE9FE; color:#6D28D9; }
.wiz-pill[data-state="active"] .wiz-pill-lbl { display:inline; }
.wiz-pill[data-state="done"] { border-color:#16A34A; background:#DCFCE7; color:#15803D; }
.wiz-pill-line { flex:1; height:2px; background:var(--border-light); margin:0 4px; transition:background .25s; min-width:10px; }
.wiz-pill-line[data-done="1"] { background:#16A34A; }

.wiz-body { flex:1 1 auto; min-height:0; overflow-y:auto; padding:20px 24px; display:flex; flex-direction:column; gap:16px; background:var(--bg-base); }
.wiz-body::-webkit-scrollbar { width:10px; }
.wiz-body::-webkit-scrollbar-thumb { background:#CBD5E1; border-radius:5px; border:2px solid var(--bg-base); }
.wiz-body { scrollbar-width:thin; scrollbar-color:#CBD5E1 transparent; }

.wiz-footer { display:flex; align-items:center; padding:14px 24px; border-top:1px solid var(--border-light); background:var(--bg-card); flex-shrink:0; gap:10px; }

.wiz-btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:11px; border:none; font-family:var(--font-body); font-size:13px; font-weight:700; cursor:pointer; transition:all .2s; white-space:nowrap; }
.wiz-btn-back   { background:var(--bg-muted); border:1.5px solid var(--border-light); color:var(--text-secondary); }
.wiz-btn-back:hover { border-color:#7C3AED; color:#7C3AED; background:#EDE9FE; }
.wiz-btn-cancel { background:transparent; border:1.5px solid var(--border-light); color:var(--text-muted); }
.wiz-btn-cancel:hover { background:var(--bg-muted); color:var(--text-primary); }
.wiz-btn-next   { background:linear-gradient(135deg,#7C3AED,#6D28D9); color:#fff; box-shadow:0 3px 12px rgba(109,40,217,.3); }
.wiz-btn-next:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 18px rgba(109,40,217,.45); }
.wiz-btn-generate { background:linear-gradient(135deg,#15803D,#16A34A); color:#fff; box-shadow:0 3px 12px rgba(21,128,61,.3); font-size:14px; padding:10px 22px; }
.wiz-btn-generate:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 18px rgba(21,128,61,.45); background:linear-gradient(135deg,#16A34A,#22C55E); }

/* Section */
.wiz-section { background:var(--bg-card); border:1.5px solid var(--border-light); border-radius:14px; padding:16px 18px; }
.wiz-section-label { font-size:13px; font-weight:800; color:var(--text-primary); margin-bottom:12px; }
.wiz-two-col { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.wiz-field { display:flex; flex-direction:column; gap:6px; min-width:0; }
.wiz-label { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:var(--text-muted); }
.wiz-time-input, .wiz-text-input { height:42px; border:1.5px solid var(--border-light); border-radius:10px; padding:0 12px; font-family:var(--font-body); font-size:13.5px; font-weight:600; color:var(--text-primary); background:var(--bg-card); outline:none; transition:all .2s; box-sizing:border-box; }
.wiz-time-input:focus, .wiz-text-input:focus { border-color:#7C3AED; box-shadow:0 0 0 3px rgba(124,58,237,.12); }
.wiz-time-sm { height:36px; border:1.5px solid var(--border-light); border-radius:8px; padding:0 10px; font-family:var(--font-body); font-size:12.5px; font-weight:600; color:var(--text-primary); background:var(--bg-card); outline:none; box-sizing:border-box; width:100%; }
.wiz-time-sm:focus { border-color:#7C3AED; box-shadow:0 0 0 3px rgba(124,58,237,.12); }
.wiz-time-preview { font-size:11.5px; color:#7C3AED; font-weight:700; }
.wiz-inset-note { font-size:10.5px; color:var(--text-muted); font-weight:600; }
.wiz-desc-box { display:flex; align-items:flex-start; gap:8px; padding:10px 14px; background:#EDE9FE; border:1px solid #DDD6FE; border-radius:10px; font-size:12px; color:#5B21B6; margin-bottom:12px; line-height:1.5; }
.wiz-desc-box i { color:#7C3AED; flex-shrink:0; margin-top:2px; }

/* Day / Duration buttons */
.wiz-day-row { display:grid; grid-template-columns:repeat(6,1fr); gap:8px; }
.wiz-day-btn, .wiz-dur-btn { padding:10px 12px; border-radius:10px; border:1.5px solid var(--border-light); background:var(--bg-card); color:var(--text-muted); font-family:var(--font-body); font-size:12.5px; font-weight:700; cursor:pointer; transition:all .15s; }
.wiz-day-btn:hover, .wiz-dur-btn:hover { border-color:#7C3AED; color:#7C3AED; }
.wiz-day-btn--on, .wiz-dur-btn--on { background:linear-gradient(135deg,#EDE9FE,#DDD6FE); border-color:#7C3AED; color:#6D28D9; }
.wiz-dur-row { display:grid; grid-template-columns:repeat(7,1fr); gap:8px; }

/* Stepper */
.wiz-stepper { display:inline-flex; align-items:center; gap:0; border:1.5px solid var(--border-light); border-radius:10px; overflow:hidden; background:var(--bg-card); }
.wiz-stepper-btn { width:32px; height:32px; border:none; background:transparent; color:#7C3AED; font-size:16px; font-weight:700; cursor:pointer; transition:background .15s; }
.wiz-stepper-btn:hover { background:#EDE9FE; }
.wiz-stepper-val { min-width:36px; text-align:center; font-size:13.5px; font-weight:800; color:var(--text-primary); padding:0 6px; border-left:1px solid var(--border-light); border-right:1px solid var(--border-light); height:32px; line-height:32px; }
.wiz-stepper--lg .wiz-stepper-btn { width:42px; height:42px; font-size:20px; }
.wiz-stepper--lg .wiz-stepper-val { font-size:17px; min-width:50px; height:42px; line-height:42px; }
.wiz-stepper-btn--lg { width:42px; height:42px; }
.wiz-stepper-val--lg { font-size:17px; min-width:50px; }
.wiz-stepper-card { display:flex; align-items:center; gap:16px; padding:12px 16px; background:var(--bg-muted); border-radius:12px; border:1.5px solid var(--border-light); flex-wrap:wrap; }
.wiz-link-btn { background:none; border:none; color:#7C3AED; font-size:11.5px; font-weight:700; cursor:pointer; padding:0; font-family:var(--font-body); }
.wiz-link-btn:hover { text-decoration:underline; }

/* Toggle card */
.wiz-toggle-card { display:flex; align-items:flex-start; gap:12px; padding:14px 16px; border:1.5px solid var(--border-light); border-radius:14px; background:var(--bg-card); cursor:pointer; transition:all .2s; text-align:left; font-family:var(--font-body); width:100%; }
.wiz-toggle-card:hover { border-color:#7C3AED; }
.wiz-toggle-card--on { border-color:#7C3AED; background:linear-gradient(135deg,#F5F3FF,#EDE9FE); }
.wiz-toggle-box { width:22px; height:22px; border-radius:7px; border:2px solid var(--border-med); background:var(--bg-card); display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:2px; transition:all .15s; }
.wiz-toggle-box--on { background:#7C3AED; border-color:#7C3AED; }
.wiz-toggle-title { font-size:13.5px; font-weight:800; color:var(--text-primary); }
.wiz-toggle-sub { font-size:11.5px; color:var(--text-muted); margin-top:3px; line-height:1.4; }

/* Per-day overrides */
.wiz-day-overrides-block { display:flex; flex-direction:column; gap:8px; padding:14px; background:#FAFAF9; border:1.5px dashed #DDD6FE; border-radius:12px; }
.wiz-day-override-row { display:grid; grid-template-columns:90px 1fr 1fr; gap:14px; align-items:start; padding:10px 14px; background:var(--bg-card); border:1px solid var(--border-light); border-radius:10px; }
.wiz-day-override-name { font-size:13px; font-weight:800; color:#6D28D9; padding-top:18px; }
.wiz-day-override-time, .wiz-day-override-periods { display:flex; flex-direction:column; gap:4px; min-width:0; }

/* Class selector */
.wiz-cls-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:8px; }
.wiz-cls-chip { display:flex; align-items:center; gap:8px; padding:9px 12px; border:1.5px solid var(--border-light); border-radius:10px; background:var(--bg-card); cursor:pointer; font-family:var(--font-body); font-size:12.5px; font-weight:600; color:var(--text-primary); text-align:left; transition:all .15s; }
.wiz-cls-chip:hover { border-color:#7C3AED; background:var(--bg-muted); }
.wiz-cls-chip--on { border-color:#7C3AED; background:linear-gradient(135deg,#F5F3FF,#EDE9FE); color:#6D28D9; }
.wiz-cls-check { width:18px; height:18px; border-radius:5px; border:1.5px solid var(--border-med); background:var(--bg-card); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.wiz-cls-check--on { background:#7C3AED; border-color:#7C3AED; }
.wiz-pill-btn { padding:4px 10px; border-radius:99px; border:1.5px solid; font-size:11px; font-weight:700; cursor:pointer; font-family:var(--font-body); transition:all .2s; display:inline-flex; align-items:center; gap:4px; }
.wiz-pill-btn--purple { border-color:#7C3AED; background:#EDE9FE; color:#6D28D9; }
.wiz-pill-btn--purple:hover { background:#DDD6FE; }
.wiz-pill-btn--red { border-color:#DC2626; background:#FEE2E2; color:#DC2626; }
.wiz-pill-btn--red:hover { background:#FECACA; }

/* Step 2 breaks */
.wiz-bk-card { background:var(--bg-card); border:1.5px solid var(--border-light); border-radius:14px; overflow:hidden; }
.wiz-bk-card--default { border-color:#DDD6FE; }
.wiz-bk-card-hdr { display:flex; align-items:center; gap:12px; padding:14px 16px; background:linear-gradient(135deg,#F5F3FF,#EDE9FE); border-bottom:1px solid #DDD6FE; }
.wiz-bk-card-icon { width:36px; height:36px; border-radius:10px; color:#fff; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; box-shadow:0 3px 10px rgba(109,40,217,.3); }
.wiz-bk-card-title { font-size:13.5px; font-weight:800; color:#6D28D9; }
.wiz-bk-card-sub { font-size:11px; color:#7C3AED; opacity:.85; margin-top:2px; }
.wiz-bk-card-body { padding:14px 16px; display:flex; flex-direction:column; gap:12px; }

.wiz-break-form { display:flex; align-items:flex-end; gap:10px; flex-wrap:wrap; }
.wiz-input-sm { height:36px; border:1.5px solid var(--border-light); border-radius:8px; padding:0 10px; font-family:var(--font-body); font-size:12.5px; font-weight:600; color:var(--text-primary); background:var(--bg-card); outline:none; transition:.15s; box-sizing:border-box; width:100%; }
.wiz-input-sm:focus { border-color:#7C3AED; box-shadow:0 0 0 3px rgba(124,58,237,.12); }
.wiz-break-form .wiz-field:nth-child(1), .wiz-break-form .wiz-field:nth-child(2) { width:120px; flex-shrink:0; }
.wiz-btn-add-break { height:36px; padding:0 16px; border-radius:8px; border:none; background:linear-gradient(135deg,#7C3AED,#6D28D9); color:#fff; font-family:var(--font-body); font-size:12.5px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all .15s; box-shadow:0 2px 8px rgba(109,40,217,.3); flex-shrink:0; }
.wiz-btn-add-break:hover { transform:translateY(-1px); box-shadow:0 4px 12px rgba(109,40,217,.45); }

.wiz-chips { display:flex; flex-wrap:wrap; gap:8px; }
.wiz-chip { display:inline-flex; align-items:center; gap:6px; padding:6px 12px 6px 8px; border-radius:99px; background:#FEF2F2; border:1.5px solid #FECACA; font-size:11.5px; font-weight:600; color:#7F1D1D; }
.wiz-chip-icon { font-size:13px; }
.wiz-chip-main { font-weight:800; color:#DC2626; }
.wiz-badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:99px; font-size:10.5px; font-weight:700; }
.wiz-badge--red { background:#DC2626; color:#fff; }
.wiz-chip-label { color:#7F1D1D; opacity:.85; }
.wiz-chip-del { width:18px; height:18px; border-radius:50%; border:none; background:rgba(220,38,38,.15); color:#DC2626; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; transition:all .15s; }
.wiz-chip-del:hover { background:#DC2626; color:#fff; transform:scale(1.1); }
.wiz-empty-chip { padding:10px 14px; background:var(--bg-muted); border:1px dashed var(--border-light); border-radius:8px; font-size:12px; color:var(--text-muted); font-style:italic; text-align:center; }

.wiz-bk-day-list { display:flex; flex-direction:column; gap:8px; }
.wiz-bk-day { background:var(--bg-card); border:1.5px solid var(--border-light); border-radius:12px; overflow:hidden; transition:border-color .15s; }
.wiz-bk-day--custom { border-color:#7C3AED; }
.wiz-bk-day-hdr { display:flex; align-items:center; gap:12px; padding:12px 16px; }
.wiz-bk-day-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
.wiz-bk-day-name { font-size:13px; font-weight:800; color:var(--text-primary); min-width:90px; }
.wiz-bk-day-status { flex:1; }
.wiz-bk-status-badge { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:700; }
.wiz-bk-status-badge--inherit { background:var(--bg-muted); color:var(--text-muted); border:1px solid var(--border-light); }
.wiz-bk-status-badge--custom { background:#EDE9FE; color:#6D28D9; border:1px solid #DDD6FE; }
.wiz-bk-btn-custom { padding:6px 12px; border-radius:8px; border:1.5px solid #7C3AED; background:#EDE9FE; color:#6D28D9; font-family:var(--font-body); font-size:11.5px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:5px; transition:all .15s; }
.wiz-bk-btn-custom:hover { background:#DDD6FE; }
.wiz-bk-btn-remove { padding:6px 12px; border-radius:8px; border:1.5px solid #DC2626; background:#FEE2E2; color:#DC2626; font-family:var(--font-body); font-size:11.5px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:5px; transition:all .15s; }
.wiz-bk-btn-remove:hover { background:#FECACA; }
.wiz-bk-day-body { padding:12px 16px 14px; background:#FAFAF9; border-top:1px dashed #DDD6FE; display:flex; flex-direction:column; gap:12px; }

/* Step 3 — two-panel layout */
.wiz-two-panel { display:grid; grid-template-columns:1.6fr 1fr; gap:14px; }
.wiz-panel { background:var(--bg-card); border:1.5px solid var(--border-light); border-radius:14px; padding:16px; min-width:0; }
.wiz-panel--border { background:linear-gradient(145deg,#FDFCFF,#F5F3FF); border-color:#DDD6FE; }
.wiz-sub-label { display:flex; align-items:center; margin-top:12px; margin-bottom:8px; font-size:11.5px !important; }

/* Day selector grid */
.wiz-day-sel-grid { display:grid; grid-template-columns:repeat(6,1fr); gap:8px; margin-bottom:14px; }
.wiz-day-sel-card { position:relative; padding:10px 6px; border-radius:10px; border:1.5px solid var(--border-light); background:var(--bg-card); cursor:pointer; transition:all .15s; display:flex; flex-direction:column; align-items:center; gap:2px; font-family:var(--font-body); }
.wiz-day-sel-card:hover { border-color:#7C3AED; background:#F5F3FF; }
.wiz-day-sel-card--on { border-color:#7C3AED; background:linear-gradient(135deg,#EDE9FE,#DDD6FE); box-shadow:0 3px 10px rgba(124,58,237,.18); }
.wiz-day-sel-card--custom .wiz-day-sel-dot { position:absolute; top:6px; right:6px; width:8px; height:8px; border-radius:50%; background:#7C3AED; box-shadow:0 0 0 2px var(--bg-card); }
.wiz-day-sel-name { font-size:11px; font-weight:700; color:var(--text-muted); letter-spacing:.5px; text-transform:uppercase; }
.wiz-day-sel-num  { font-size:20px; font-weight:900; color:#6D28D9; line-height:1; margin-top:2px; }
.wiz-day-sel-unit { font-size:9.5px; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:.4px; }

/* Period count bar */
.wiz-period-count-bar { display:flex; align-items:center; gap:14px; padding:12px 16px; background:linear-gradient(135deg,#F5F3FF,#EDE9FE); border:1.5px solid #DDD6FE; border-radius:12px; }
.wiz-period-count-title { font-size:14px; font-weight:800; color:#6D28D9; }
.wiz-period-count-sub   { font-size:11px; color:#7C3AED; opacity:.85; margin-top:2px; }

/* Period duration cards */
.wiz-period-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:8px; }
.wiz-period-card { display:flex; align-items:center; gap:8px; padding:8px 10px; background:var(--bg-card); border:1.5px solid var(--border-light); border-radius:10px; transition:border-color .15s; }
.wiz-period-card:hover { border-color:#7C3AED; }
.wiz-period-card--custom { border-color:#7C3AED; background:linear-gradient(135deg,#F5F3FF,#EDE9FE); }
.wiz-period-num { width:28px; height:28px; border-radius:7px; background:linear-gradient(135deg,#0369A1,#0284C7); color:#fff; font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.wiz-period-card--custom .wiz-period-num { background:linear-gradient(135deg,#7C3AED,#6D28D9); }
.wiz-period-time { font-size:10.5px; font-weight:700; color:var(--text-muted); white-space:nowrap; }
.wiz-period-input { width:50px; height:30px; border:1.5px solid var(--border-light); border-radius:7px; padding:0 6px; font-family:var(--font-body); font-size:13px; font-weight:700; color:var(--text-primary); background:var(--bg-card); outline:none; text-align:center; transition:.15s; }
.wiz-period-input:focus { border-color:#7C3AED; box-shadow:0 0 0 3px rgba(124,58,237,.12); }
.wiz-period-unit { font-size:10.5px; color:var(--text-muted); font-weight:700; }
.wiz-period-reset { width:24px; height:24px; border-radius:6px; border:none; background:rgba(124,58,237,.12); color:#7C3AED; cursor:pointer; font-size:10px; font-weight:800; transition:all .15s; flex-shrink:0; }
.wiz-period-reset:hover { background:#7C3AED; color:#fff; }

/* Timeline */
.wiz-tl-list { display:flex; flex-direction:column; gap:5px; padding:10px 12px; background:var(--bg-muted); border:1px solid var(--border-light); border-radius:10px; max-height:240px; overflow-y:auto; }
.wiz-tl-list::-webkit-scrollbar { width:6px; }
.wiz-tl-list::-webkit-scrollbar-thumb { background:#CBD5E1; border-radius:3px; }
.wiz-tl-row { display:flex; align-items:center; gap:8px; padding:6px 10px; background:var(--bg-card); border:1px solid var(--border-light); border-radius:8px; }
.wiz-tl-row--break { background:#FEF2F2; border-color:#FECACA; }
.wiz-tl-dot { width:24px; height:24px; border-radius:50%; color:#fff; font-size:10.5px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.wiz-tl-name { flex:1; font-size:12px; font-weight:700; }
.wiz-tl-time { font-size:11px; color:var(--text-muted); font-weight:600; white-space:nowrap; }
.wiz-badge--blue { background:#1E40AF; color:#fff; }

/* Lesson allocation bar */
.wiz-lesson-bar-wrap { padding:10px 12px; background:var(--bg-card); border:1.5px solid var(--border-light); border-radius:10px; margin-bottom:12px; }
.wiz-lesson-bar-track { height:10px; border-radius:99px; background:#E2E8F0; overflow:hidden; }
.wiz-lesson-bar-fill { height:100%; border-radius:99px; transition:width .25s ease,background .25s; }
.wiz-lesson-bar--under { background:linear-gradient(90deg,#7C3AED,#6D28D9); }
.wiz-lesson-bar--exact { background:linear-gradient(90deg,#15803D,#16A34A); }
.wiz-lesson-bar--over  { background:linear-gradient(90deg,#EF4444,#DC2626); }
.wiz-lesson-sum { margin-top:6px; font-size:12px; font-weight:700; }
.wiz-lesson-sum--under { color:#7C3AED; }
.wiz-lesson-sum--exact { color:#15803D; }
.wiz-lesson-sum--over  { color:#DC2626; }

/* Subject list (right panel) */
.wiz-subj-list { display:flex; flex-direction:column; gap:6px; }
.wiz-subj-row { display:flex; align-items:center; gap:10px; padding:8px 12px; background:var(--bg-card); border:1.5px solid var(--border-light); border-radius:9px; transition:border-color .15s; }
.wiz-subj-row:hover { border-color:#7C3AED; }
.wiz-subj-badge { padding:4px 10px; border-radius:99px; color:#fff; font-size:11px; font-weight:700; flex:1; text-align:center; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.wiz-subj-unit { font-size:10.5px; color:var(--text-muted); font-weight:600; white-space:nowrap; }

/* Old subject grid (kept for compat) */
.wiz-subject-grid { display:flex; flex-direction:column; gap:8px; }
.wiz-subject-row { display:flex; align-items:center; gap:12px; padding:10px 14px; background:var(--bg-muted); border:1px solid var(--border-light); border-radius:10px; }
.wiz-subject-badge { padding:6px 14px; border-radius:99px; color:#fff; font-size:12px; font-weight:700; min-width:140px; text-align:center; }

/* Step 4 — teacher workload */
.wiz-tload-list { display:flex; flex-direction:column; gap:8px; }
.wiz-tload-row { display:flex; align-items:center; gap:14px; padding:12px 14px; background:var(--bg-card); border:1.5px solid var(--border-light); border-radius:12px; transition:border-color .15s; flex-wrap:wrap; }
.wiz-tload-row:hover { border-color:#7C3AED; }
.wiz-tload-row--over { border-color:#FECACA; background:linear-gradient(135deg,#FEF2F2,#FFF5F5); }
.wiz-tload-avatar { width:38px; height:38px; border-radius:10px; color:#fff; font-size:14px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 2px 8px rgba(0,0,0,.18); }
.wiz-tload-info { flex:1; min-width:140px; }
.wiz-tload-name { font-size:13.5px; font-weight:800; color:var(--text-primary); }
.wiz-tload-days { font-size:11px; color:var(--text-muted); margin-top:2px; font-weight:600; }
.wiz-tload-stat { display:flex; flex-direction:column; align-items:flex-end; gap:4px; min-width:120px; flex-shrink:0; }
.wiz-tload-bar-track { width:120px; height:6px; border-radius:99px; background:#E2E8F0; overflow:hidden; }
.wiz-tload-bar-fill { height:100%; border-radius:99px; transition:width .3s ease; }
.wiz-tload-nums { font-size:12px; font-weight:800; }
.wiz-tload-over { font-size:10px; font-weight:700; color:#DC2626; background:#FEE2E2; padding:1px 7px; border-radius:99px; border:1px solid #FECACA; }
.wiz-tload-day-picker { display:flex; align-items:center; gap:8px; }
.wiz-tload-day-label { font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:var(--text-muted); white-space:nowrap; }
.wiz-tload-day-mini-row { display:flex; gap:3px; }
.wiz-mini-day { width:26px; height:26px; border-radius:7px; border:1.5px solid var(--border-light); background:var(--bg-card); color:var(--text-muted); cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:10.5px; font-weight:800; transition:all .15s; padding:0; font-family:var(--font-body); }
.wiz-mini-day:hover:not(:disabled) { border-color:#7C3AED; color:#7C3AED; }
.wiz-mini-day--on { background:linear-gradient(135deg,#7C3AED,#6D28D9); border-color:#7C3AED; color:#fff; box-shadow:0 2px 6px rgba(124,58,237,.3); }
.wiz-mini-day--disabled { opacity:.35; cursor:not-allowed; }

/* Empty state */
.wiz-empty-state { display:flex; align-items:center; gap:14px; padding:24px 20px; background:var(--bg-muted); border:1.5px dashed var(--border-light); border-radius:12px; font-size:13px; color:var(--text-muted); line-height:1.55; }
.wiz-empty-state i { font-size:30px; color:#7C3AED; opacity:.5; flex-shrink:0; }

/* Step 4 / 5 — alerts */
.wiz-alert { display:flex; align-items:flex-start; gap:12px; padding:14px 16px; border-radius:12px; border:1.5px solid; font-size:12.5px; line-height:1.5; }
.wiz-alert i { font-size:18px; flex-shrink:0; margin-top:1px; }
.wiz-alert--ok    { background:linear-gradient(135deg,#F0FDF4,#DCFCE7); border-color:#BBF7D0; color:#14532D; }
.wiz-alert--ok i  { color:#16A34A; }
.wiz-alert--warn  { background:#FFFBEB; border-color:#FDE68A; color:#92400E; }
.wiz-alert--warn i{ color:#D97706; }
.wiz-alert--error { background:#FEF2F2; border-color:#FECACA; color:#7F1D1D; }
.wiz-alert--error i{ color:#DC2626; }
.wiz-alert-title  { font-weight:800; font-size:13px; margin-bottom:2px; }
.wiz-alert-sub    { font-size:11.5px; opacity:.9; }

/* Step 5 — stats cards */
.wiz-stats-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
.wiz-stat-card { padding:14px 16px; border-radius:12px; border:1.5px solid; text-align:center; }
.wiz-stat-card--purple { background:linear-gradient(135deg,#F5F3FF,#EDE9FE); border-color:#DDD6FE; color:#6D28D9; }
.wiz-stat-card--blue   { background:linear-gradient(135deg,#EFF6FF,#DBEAFE); border-color:#BFDBFE; color:#1E40AF; }
.wiz-stat-card--amber  { background:linear-gradient(135deg,#FFFBEB,#FEF3C7); border-color:#FDE68A; color:#92400E; }
.wiz-stat-card--green  { background:linear-gradient(135deg,#F0FDF4,#DCFCE7); border-color:#BBF7D0; color:#15803D; }
.wiz-stat-val { font-size:24px; font-weight:900; line-height:1; }
.wiz-stat-key { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; opacity:.85; margin-top:5px; }

/* Step 5 — check list */
.wiz-check-list { display:flex; flex-direction:column; gap:8px; }
.wiz-check-row { display:flex; align-items:flex-start; gap:12px; padding:11px 14px; background:var(--bg-card); border:1.5px solid var(--border-light); border-radius:10px; }
.wiz-check-icon { width:28px; height:28px; border-radius:8px; color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; flex-shrink:0; }
.wiz-check-ok   { background:linear-gradient(135deg,#15803D,#16A34A); box-shadow:0 2px 6px rgba(22,163,74,.25); }
.wiz-check-warn { background:linear-gradient(135deg,#D97706,#F59E0B); box-shadow:0 2px 6px rgba(217,119,6,.25); }
.wiz-check-fail { background:linear-gradient(135deg,#DC2626,#EF4444); box-shadow:0 2px 6px rgba(220,38,38,.25); }
.wiz-check-title { font-size:12.5px; font-weight:800; color:var(--text-primary); }
.wiz-check-detail{ font-size:11.5px; color:var(--text-muted); margin-top:2px; line-height:1.45; }

/* Step 5 — day-by-day breakdown */
.wiz-day-summary-grid { display:grid; grid-template-columns:repeat(6,1fr); gap:8px; }
.wiz-day-summary-card { padding:12px 10px; background:linear-gradient(135deg,#F5F3FF,#EDE9FE); border:1.5px solid #DDD6FE; border-radius:10px; text-align:center; }
.wiz-day-summary-name { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#7C3AED; }
.wiz-day-summary-num  { font-size:22px; font-weight:900; color:#6D28D9; line-height:1; margin-top:4px; }
.wiz-day-summary-sub  { font-size:9.5px; color:#7C3AED; opacity:.8; font-weight:600; margin-top:3px; }

/* Step 5 summary */
.wiz-summary-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(160px, 1fr)); gap:10px; }
.wiz-summary-cell { padding:11px 14px; background:var(--bg-muted); border:1px solid var(--border-light); border-radius:10px; }
.wiz-summary-lbl { font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:var(--text-muted); margin-bottom:5px; }
.wiz-summary-val { font-size:13.5px; font-weight:800; color:var(--text-primary); }
.wiz-error-box { display:flex; align-items:flex-start; gap:10px; padding:12px 16px; background:#FEF2F2; border:1.5px solid #FECACA; border-radius:12px; color:#7F1D1D; font-size:12.5px; line-height:1.55; }
.wiz-error-box i { color:#DC2626; font-size:16px; flex-shrink:0; margin-top:2px; }
.wiz-warn-box { display:flex; align-items:flex-start; gap:10px; padding:12px 16px; background:#FFFBEB; border:1.5px solid #FDE68A; border-radius:12px; color:#92400E; font-size:12.5px; line-height:1.55; }
.wiz-warn-box i { color:#D97706; font-size:16px; flex-shrink:0; margin-top:2px; }
.wiz-ok-box { display:flex; align-items:center; gap:12px; padding:14px 18px; background:linear-gradient(135deg,#F0FDF4,#DCFCE7); border:1.5px solid #BBF7D0; border-radius:12px; color:#14532D; font-size:13px; }
.wiz-ok-box i { color:#16A34A; font-size:20px; flex-shrink:0; }

/* Wizard mobile */
@media (max-width:768px) {
  .wiz-modal { border-radius:20px 20px 0 0; max-height:96dvh; margin-top:auto; }
  .wiz-header { padding:14px 16px; }
  .wiz-pills-bar { padding:10px 14px; overflow-x:auto; }
  .wiz-pill-lbl { display:none !important; }
  .wiz-body { padding:14px 14px; gap:12px; }
  .wiz-footer { padding:12px 14px; flex-wrap:wrap; }
  .wiz-day-row { grid-template-columns:repeat(3,1fr); }
  .wiz-dur-row { grid-template-columns:repeat(4,1fr); }
  .wiz-two-col { grid-template-columns:1fr; }
  .wiz-day-override-row { grid-template-columns:1fr; gap:8px; }
  .wiz-day-override-name { padding-top:0; }
  .wiz-teacher-head, .wiz-teacher-row { grid-template-columns:1fr repeat(6, 40px); }
  .wiz-day-cell { width:32px; height:28px; }
  .wiz-break-row { flex-wrap:wrap; }
  .wiz-break-row .wiz-field { flex:1 1 calc(50% - 5px); width:auto !important; }
  .wiz-two-panel { grid-template-columns:1fr; }
  .wiz-day-sel-grid { grid-template-columns:repeat(3,1fr); }
  .wiz-period-count-bar { flex-wrap:wrap; gap:10px; }
  .wiz-period-grid { grid-template-columns:repeat(2,1fr); }
  .wiz-tload-row { gap:10px; }
  .wiz-tload-stat { align-items:flex-start; }
  .wiz-tload-day-picker { width:100%; }
  .wiz-stats-grid { grid-template-columns:repeat(2,1fr); }
  .wiz-day-summary-grid { grid-template-columns:repeat(3,1fr); }
}

/* Auto-generate modal (legacy intro modal — kept for compat) */
.tt-auto-modal { background:var(--bg-card); border-radius:18px; width:100%; max-width:460px; padding:30px 26px; box-shadow:0 30px 80px rgba(0,0,0,.22); border:1px solid var(--border-light); animation:ttIn .25s cubic-bezier(.34,1.26,.64,1) both; }
.tt-auto-icon { width:56px; height:56px; border-radius:16px; background:linear-gradient(135deg,#7C3AED,#6D28D9); color:#fff; display:flex; align-items:center; justify-content:center; font-size:22px; margin:0 auto 14px; box-shadow:0 6px 20px rgba(109,40,217,.35); }
.tt-auto-title { font-size:18px; font-weight:800; color:var(--text-primary); margin-bottom:6px; }
.tt-auto-sub { font-size:13px; color:var(--text-muted); line-height:1.6; }
.tt-auto-cta { display:flex; align-items:center; gap:14px; padding:18px 20px; border-radius:14px; border:2px solid #DDD6FE; background:linear-gradient(135deg,#F5F3FF,#EDE9FE); cursor:pointer; text-align:left; font-family:var(--font-body); transition:all .22s cubic-bezier(.4,0,.2,1); width:100%; }
.tt-auto-cta:hover { border-color:#7C3AED; background:#EDE9FE; transform:translateY(-2px); box-shadow:0 8px 24px rgba(109,40,217,.22); }
.tt-auto-cta-name { font-size:14.5px; font-weight:800; color:#5B21B6; margin-bottom:4px; }
.tt-auto-cta-sub  { font-size:12px; color:var(--text-muted); line-height:1.5; }

/* Mobile */
@media (max-width:820px) {
  .tt-table-head { display:none; }
  .tt-row { grid-template-columns:1fr; min-height:0; padding:14px 14px; gap:8px; }
  .tt-td-actions { flex-wrap:wrap; }
  .tt-day-tabs { flex-wrap:wrap; }
  .tt-day-btn { flex:0 0 calc(33.33% - 1px); font-size:12px; padding:9px 4px; }
  .tt-dl-mode-grid { grid-template-columns:1fr; }
}
@media (max-width:768px) {
  .tt-edit-modal { border-radius:20px 20px 0 0; max-height:95dvh; margin-top:auto; }
  .tt-edit-hdr { padding:16px 16px; }
  .tt-edit-hdr-title { font-size:13.5px; }
  .tt-edit-meta { padding:8px 16px; }
  .tt-edit-body { padding:14px 14px; gap:10px; }
  .tt-edit-footer { padding:12px 14px; flex-direction:column; align-items:stretch; }
  .tt-edit-footer-left, .tt-edit-footer-right { width:100%; }
  .tt-edit-footer-left { order:2; }
  .tt-edit-footer-right { order:1; }
  .tt-foot-btn { flex:1; justify-content:center; }
  .ttp-body { grid-template-columns:minmax(0,1fr) minmax(0,1fr); }
}
@media (max-width:540px) {
  .tt-toolbar-right { width:100%; }
  .tt-toolbar-right .tt-btn { flex:1; justify-content:center; }
  /* Constrain modals on phones so they don't push against viewport edges */
  .tt-overlay { padding:8px; }
  .tt-dl-modal, .tt-auto-modal { max-width:96vw !important; max-height:95dvh !important; }
}
@media (max-width:480px) {
  .tt-edit-hdr-icon { width:36px; height:36px; font-size:15px; }
  .ttp-body { grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:8px; padding:10px 12px; }
  .ttp-card-hdr { padding:10px 12px; }
  .ttp-field--break-msg { grid-column:span 2; }
}

[data-theme="dark"] .tt-toolbar { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .tt-day-tabs { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .tt-day-btn.active { background:rgba(30,58,138,.2); }
[data-theme="dark"] .tt-row { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .tt-row:nth-child(even) { background:var(--bg-muted); }
[data-theme="dark"] .tt-detail-table thead tr { background:#0a0f1e; }
/* Pills, table card, edit modal surfaces, empty/auto cards, ttp confirm dialog,
   download mode-icon labels — keep these readable on dark surfaces. */
[data-theme="dark"] .tt-table-card { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .tt-table-head { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .tt-row-wrap { border-bottom-color:var(--border-light); }
[data-theme="dark"] .tt-section-pill { background:rgba(59,130,246,.16); color:#93C5FD; border-color:rgba(59,130,246,.32); }
[data-theme="dark"] .tt-meta-pill--blue  { background:rgba(59,130,246,.16); color:#93C5FD; border-color:rgba(59,130,246,.32); }
[data-theme="dark"] .tt-meta-pill--green { background:rgba(34,197,94,.16); color:#86EFAC; border-color:rgba(34,197,94,.32); }
[data-theme="dark"] .tt-detail-table tbody tr { background:var(--bg-card); border-bottom-color:var(--border-light); }
[data-theme="dark"] .tt-detail-table tbody tr:nth-child(even) { background:var(--bg-muted); }
[data-theme="dark"] .tt-detail-table td { color:var(--text-primary); }
[data-theme="dark"] .tt-empty-detail { background:var(--bg-muted); }
[data-theme="dark"] .tt-edit-meta { background:var(--bg-muted); border-bottom-color:var(--border-light); }
[data-theme="dark"] .tt-edit-body { background:var(--bg-base); }
[data-theme="dark"] .tt-edit-footer { background:var(--bg-card); border-top-color:var(--border-light); }
[data-theme="dark"] .ttp-card { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .ttp-input, [data-theme="dark"] .ttp-select { background:var(--bg-card); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .ttp-select option { color:var(--text-primary); background:var(--bg-card); }
[data-theme="dark"] .ttp-confirm-modal { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .ttp-confirm-hdr { background:linear-gradient(135deg, rgba(220,38,38,.12), rgba(220,38,38,.06)); border-bottom-color:rgba(220,38,38,.28); }
[data-theme="dark"] .tt-dl-modal { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .tt-dl-mode { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .tt-dl-mode-name { color:var(--text-primary); }
[data-theme="dark"] .tt-auto-modal { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .tt-auto-cta { background:rgba(124,58,237,.08); border-color:rgba(124,58,237,.3); }
[data-theme="dark"] .tt-auto-cta-name { color:#C4B5FD; }
[data-theme="dark"] .btn-tt-del { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .tt-expand-btn { background:var(--bg-card); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .tt-expand { background:var(--bg-muted); border-top-color:var(--border-light); }

/* ───────────────────────── MOBILE (≤600px) ─────────────────────────
   Real internal screen responsiveness — stacks toolbar, scrolls day-tabs,
   horizontally scrolls weekly timetable grid + class filter row,
   makes period editor modal single-column. */
@media (max-width:600px) {
  /* Toolbar — stack title + actions */
  .tt-toolbar { flex-direction:column; align-items:stretch; padding:12px 14px; gap:10px; margin-bottom:12px; border-radius:12px; }
  .tt-toolbar-left { width:100%; }
  .tt-toolbar-title { font-size:14px; }
  .tt-toolbar-sub { font-size:11px; }
  .tt-toolbar-right { width:100%; flex-wrap:wrap; gap:8px; }
  .tt-toolbar-right .tt-btn { flex:1 1 calc(50% - 4px); justify-content:center; min-width:0; }
  .tt-btn { padding:8px 12px; font-size:12px; gap:5px; }

  /* Day tabs — horizontal scroll for 7 days */
  .tt-day-tabs { overflow-x:auto; flex-wrap:nowrap; scrollbar-width:none; border-radius:12px; margin-bottom:12px; }
  .tt-day-tabs::-webkit-scrollbar { display:none; }
  .tt-day-btn { flex:0 0 auto; min-width:80px; padding:10px 12px; font-size:12px; white-space:nowrap; }

  /* Class table — compact 2-line card per row.
     Row 1: [#]  [icon] Class Name  [Section Badge]
     Row 2: [Update] [PDF] [Delete] ........... [⌄]
     Replaces the 820px rule that put grid-template-columns:1fr
     (which stacked all 5 cells vertically — the scattered look). */
  .tt-table-card { border-radius:12px; margin-bottom:14px; }
  .tt-row {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    column-gap: 8px !important;
    row-gap: 8px !important;
    padding: 10px 12px !important;
    grid-template-columns: none !important;
    min-height: 0 !important;
  }
  /* Line 1 — identity (left → right) */
  .tt-row > .tt-td-num {
    flex: 0 0 auto !important;
    order: 1 !important;
    padding: 0 !important;
    font-size: 12px !important;
    font-weight: 700 !important;
  }
  .tt-row > .tt-td-cls {
    flex: 1 1 auto !important;
    order: 2 !important;
    min-width: 0 !important;
    padding: 0 !important;
    gap: 8px !important;
  }
  .tt-row > .tt-td-sec {
    flex: 0 0 auto !important;
    order: 3 !important;
    padding: 0 !important;
  }
  /* Force a wrap break between Row 1 (orders 1–3) and Row 2 (orders 4–5) */
  .tt-row::after {
    content: "";
    flex: 1 1 100%;
    height: 0;
    order: 3.5;
  }
  /* Line 2 — actions group + chevron pinned to far right */
  .tt-row > .tt-td-actions {
    flex: 1 1 auto !important;
    order: 4 !important;
    padding: 0 !important;
    gap: 6px !important;
    flex-wrap: nowrap !important;
    min-width: 0 !important;
  }
  .tt-row > .tt-td-chev {
    flex: 0 0 auto !important;
    order: 5 !important;
    padding: 0 !important;
    margin-left: auto !important;
    justify-content: flex-end !important;
    justify-self: end !important;
  }
  .tt-td { font-size: 12.5px; }
  .tt-td-cls { gap: 8px; }
  .tt-avatar { width:28px; height:28px; font-size:12px; border-radius:7px; }
  .tt-section-pill { font-size:11px; padding:2px 9px; }
  .btn-tt-update { padding:6px 12px; font-size:11.5px; flex-shrink: 1; min-width: 0; }
  .btn-tt-dl { padding:0 10px; height:30px; font-size:11px; flex-shrink: 0; }
  .btn-tt-del { width:30px; height:30px; font-size:11px; padding:0; flex-shrink: 0; }
  .tt-expand-btn { width:30px; height:30px; font-size:10px; flex-shrink: 0; }

  /* Weekly timetable grid (expand panel) — horizontal scroll */
  .tt-empty-detail { padding:24px 16px; }
  .tt-empty-icon { font-size:30px; }
  .tt-empty-title { font-size:13px; }
  .tt-empty-sub { font-size:11.5px; }
  .tt-details-hdr { padding:10px; font-size:12.5px; }
  .tt-detail-table { font-size:12px; min-width:520px; }
  .tt-detail-table thead th { padding:8px 10px; font-size:10.5px; }
  .tt-detail-table td { padding:8px 10px; font-size:12px; }
  .tt-subj-badge { padding:2px 8px; font-size:10.5px; }

  /* Period editor modal (edit modal) — stack header, single-col period grid */
  .tt-edit-modal { border-radius:18px 18px 0 0; max-height:96dvh; }
  .tt-edit-hdr { padding:14px 14px; gap:10px; flex-wrap:wrap; }
  .tt-edit-hdr-icon { width:34px; height:34px; font-size:14px; border-radius:11px; }
  .tt-edit-hdr-title { font-size:13px; }
  .tt-edit-hdr-sub { font-size:10.5px; }
  .tt-edit-close { width:30px; height:30px; font-size:12px; }
  .tt-edit-meta { padding:8px 14px; flex-wrap:wrap; gap:6px; }
  .tt-meta-pill { font-size:10.5px; padding:3px 10px; }
  .tt-edit-body { padding:12px 12px; gap:10px; }
  .tt-edit-footer { padding:12px 12px; flex-direction:column; align-items:stretch; gap:8px; }
  .tt-edit-footer-left, .tt-edit-footer-right { width:100%; flex-wrap:wrap; gap:6px; }
  .tt-edit-footer-left { order:2; }
  .tt-edit-footer-right { order:1; }
  .tt-foot-btn { flex:1 1 calc(50% - 3px); justify-content:center; padding:8px 12px; font-size:12px; }

  /* Period cards — single-column body */
  .ttp-card { border-radius:13px; }
  .ttp-card-hdr { padding:10px 12px; gap:8px; }
  .ttp-num { width:28px; height:28px; font-size:11px; }
  .ttp-title { font-size:12.5px; }
  .ttp-dur { font-size:10px; padding:2px 8px; }
  .ttp-del { width:28px; height:28px; font-size:11px; }
  .ttp-body { grid-template-columns:1fr; gap:8px; padding:10px 12px; }
  .ttp-field--break-msg { grid-column:span 1; font-size:11px; padding:7px 9px; }
  .ttp-input, .ttp-select { height:38px; font-size:12.5px; }
  .ttp-label { font-size:10px; }

  /* Auto-generate modal */
  .tt-auto-modal { padding:22px 18px; border-radius:14px; }
  .tt-auto-icon { width:48px; height:48px; font-size:19px; border-radius:13px; margin-bottom:12px; }
  .tt-auto-title { font-size:16px; }
  .tt-auto-sub { font-size:12px; }
  .tt-auto-cta { padding:14px 14px; gap:10px; }
  .tt-auto-cta-name { font-size:13px; }
  .tt-auto-cta-sub { font-size:11px; }

  /* Wizard modal — bottom-sheet sized */
  .wiz-modal { border-radius:18px 18px 0 0; max-height:96dvh; margin-top:auto; }
  .wiz-header { padding:12px 14px; }
  .wiz-pills-bar { padding:8px 12px; overflow-x:auto; flex-wrap:nowrap; scrollbar-width:none; }
  .wiz-pills-bar::-webkit-scrollbar { display:none; }
  .wiz-pill-lbl { display:none !important; }
  .wiz-body { padding:12px 12px; gap:10px; }
  .wiz-footer { padding:10px 12px; flex-wrap:wrap; gap:8px; }
  .wiz-footer > * { flex:1 1 calc(50% - 4px); justify-content:center; }
  .wiz-two-col, .wiz-two-panel { grid-template-columns:1fr; }
  .wiz-day-row, .wiz-day-sel-grid { grid-template-columns:repeat(2,1fr); }
  .wiz-dur-row { grid-template-columns:repeat(2,1fr); }
  .wiz-day-override-row { grid-template-columns:1fr; gap:8px; }
  .wiz-day-override-name { padding-top:0; }
  .wiz-teacher-head, .wiz-teacher-row { grid-template-columns:1fr; gap:4px; }
  .wiz-day-cell { width:auto; height:auto; }
  .wiz-break-row { flex-direction:column; }
  .wiz-break-row .wiz-field { flex:1 1 100%; width:100% !important; }
  .wiz-stats-grid { grid-template-columns:1fr 1fr; }
  .wiz-day-summary-grid { grid-template-columns:1fr 1fr; }
  .wiz-period-grid { grid-template-columns:1fr 1fr; }
  .wiz-summary-grid { grid-template-columns:1fr; }
  .wiz-error-box, .wiz-warn-box, .wiz-ok-box { font-size:12px; padding:10px 12px; }

  /* Download / report modals */
  .tt-overlay { padding:8px; }
  .tt-dl-modal { border-radius:14px; }
  .tt-dl-mode-grid { grid-template-columns:1fr; gap:8px; }
  .tt-dl-mode { padding:12px 14px; }
}
`;
