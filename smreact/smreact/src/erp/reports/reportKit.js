import React, { useState, useEffect } from 'react';
import ExcelJS from 'exceljs';
import Tooltip from '../components/Tooltip';

/* ═══════════════════════════════════════════════════════════════════
   REPORT KIT — the ERP-wide standard report system.

   Extracted from Academics.js's ReportPicker/generateReportWindow,
   which this session's research confirmed is the ORIGIN of the
   `.report-picker-overlay`/`.rp-*` pattern (only Academics and
   Examination used it before this kit existed) and the most
   fully-designed report format in the app — real dual-asset SVG
   logo, a genuinely redesigned (not just color-stripped) Colorless
   mode, a three-part footer. This file is that design, generalized
   so every module can share ONE implementation instead of
   reimplementing it per module.

   A module using this kit still owns its own report CONTENT (what
   goes in the body — a free-form section like Academics' Textbooks
   table, or a data table like Examination's Result Upload Status).
   The kit owns everything else: the picker modal, the header/logo/
   footer chrome, the PDF print-window trigger, the Word-as-.doc
   trigger, and the Excel workbook builder.

   NOTE ON CSS: `.report-picker-overlay`/`.rp-*` already exist,
   verbatim, inside both Academics.js's ACADEMICS_CSS and
   Examination.jsx's EXAM_CSS (each file is self-contained and
   injects its own `<style>` block). Migrating those two modules onto
   this kit does not require touching that CSS — it already renders
   these exact class names correctly in both hosts. A module with NO
   existing copy of this CSS should render `<style>{REPORT_KIT_CSS}</style>`
   once (see export below) before using <StandardReportPicker>.
   ═══════════════════════════════════════════════════════════════════ */

export const REPORT_SCHOOL_NAME = 'The Oxford System, Lahore Campus';
export const REPORT_ACADEMIC_YEAR = 'Academic Year 2026–2027';

/* `.report-picker-overlay`/`.rp-*` — the CSS every <StandardReportPicker>
   render needs. Verbatim copy of the block that already lived inline in
   both Academics.js's ACADEMICS_CSS and Examination.jsx's EXAM_CSS (this
   kit's two original hosts). Every OTHER module that adopted this kit
   this session (AdmissionCrm, Inventory, Attendance,
   PerformanceIntelligence, DoubleEntryAccounts, Fee, Students) has no
   local copy of this CSS and was rendering the picker unstyled — fixed
   by having StandardReportPicker inject this itself below, so no
   consuming module needs to remember to add it. Relies only on the
   CSS custom properties defined globally in App.js (--bg-card,
   --text-primary, --text-muted, --border-light, --border-med,
   --brand-primary, --bg-muted, --shadow-xl, --shadow-md, --tr,
   --font-body, --error) and the `modalIn` keyframe also defined
   globally in App.js — nothing Academics/Examination-specific. */
export const REPORT_KIT_CSS = `
.report-picker-overlay {
  position:fixed; inset:0;
  background:rgba(10,22,40,.5); backdrop-filter:blur(8px);
  z-index:2000; display:none;
  align-items:center; justify-content:center; padding:20px;
}
.report-picker-overlay.open { display:flex; }
.report-picker {
  background:var(--bg-card); border-radius:24px;
  width:100%; max-width:460px;
  border:1px solid var(--border-light);
  box-shadow:var(--shadow-xl);
  animation:modalIn .28s cubic-bezier(.34,1.26,.64,1) both;
  overflow:hidden;
}
.rp-header {
  display:flex; align-items:flex-start; justify-content:space-between;
  padding:22px 24px 18px; border-bottom:1px solid var(--border-light);
  background:linear-gradient(135deg,rgba(30,58,138,.03),transparent);
}
.rp-header-left { display:flex; align-items:center; gap:12px; }
.rp-header-icon {
  width:40px; height:40px; border-radius:11px;
  background:linear-gradient(135deg,#DBEAFE,#BFDBFE);
  color:#1E40AF; font-size:17px;
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
}
.rp-title { font-size:16px; font-weight:800; color:var(--text-primary); letter-spacing:-.01em; }
.rp-sub { font-size:11.5px; color:var(--text-muted); margin-top:2px; }
.rp-close {
  width:30px; height:30px; border-radius:8px; border:none;
  background:var(--bg-muted); color:var(--text-muted);
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; font-size:12px; transition:var(--tr); flex-shrink:0;
}
.rp-close:hover { background:rgba(220,38,38,.1); color:var(--error); }
.rp-body { padding:22px 24px 20px; }
.rp-section-label {
  font-size:10px; font-weight:800; letter-spacing:1.2px;
  text-transform:uppercase; color:var(--text-muted);
  margin-bottom:14px; display:flex; align-items:center; gap:8px;
}
.rp-section-label::after { content:''; flex:1; height:1px; background:var(--border-light); }
.rp-options { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:24px; }
.rp-option {
  border:2px solid var(--border-light); border-radius:16px;
  cursor:pointer; transition:all .2s cubic-bezier(.4,0,.2,1);
  background:var(--bg-card); overflow:hidden; position:relative;
}
.rp-option:hover { border-color:var(--border-med); transform:translateY(-2px); box-shadow:var(--shadow-md); }
.rp-option.selected {
  border-color:var(--brand-primary);
  box-shadow:0 0 0 3px rgba(30,58,138,.12), var(--shadow-md);
  transform:translateY(-2px);
}
.rp-check {
  position:absolute; top:10px; right:10px;
  width:22px; height:22px; border-radius:50%;
  background:linear-gradient(135deg,#1E40AF,#1E3A8A);
  color:#fff; font-size:9px;
  display:none; align-items:center; justify-content:center;
  box-shadow:0 3px 8px rgba(30,58,138,.4); z-index:2;
}
.rp-option.selected .rp-check { display:flex; }
.rp-preview { height:110px; position:relative; overflow:hidden; }
.rp-preview-color {
  width:100%; height:100%;
  background:linear-gradient(145deg,#1E3A8A 0%,#1E40AF 45%,#2563EB 100%);
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:6px; padding:14px; position:relative; overflow:hidden;
}
.rp-preview-color::before { content:''; position:absolute; top:-20px; right:-20px; width:80px; height:80px; border-radius:50%; background:rgba(255,255,255,.06); }
.rp-preview-color::after  { content:''; position:absolute; bottom:-15px; left:-10px; width:60px; height:60px; border-radius:50%; background:rgba(14,165,233,.15); }
.rp-mock-header { width:80%; height:7px; border-radius:4px; background:rgba(255,255,255,.9); position:relative; z-index:1; }
.rp-mock-line   { border-radius:3px; background:rgba(255,255,255,.5); position:relative; z-index:1; }
.rp-mock-chips  { display:flex; gap:5px; position:relative; z-index:1; margin-top:2px; }
.rp-mock-chip   { width:28px; height:9px; border-radius:4px; }
.rp-preview-bw {
  width:100%; height:100%;
  background:#FFFFFF;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:6px; padding:14px;
  border-bottom:1px solid #E5E7EB;
}
.rp-mock-header-bw { width:80%; height:7px; border-radius:2px; background:#1F2937; }
.rp-mock-line-bw   { border-radius:2px; background:#9CA3AF; }
.rp-mock-chips-bw  { display:flex; gap:5px; margin-top:2px; }
.rp-mock-chip-bw   { width:28px; height:9px; border-radius:2px; background:transparent; border:1px solid #9CA3AF; }
[data-theme="dark"] .rp-preview-bw { background:#F8FAFC; border-bottom-color:#CBD5E1; }
[data-theme="dark"] .rp-mock-header-bw { background:#1F2937; }
[data-theme="dark"] .rp-mock-line-bw { background:#94A3B8; }
[data-theme="dark"] .rp-mock-chip-bw { border-color:#94A3B8; }
.rp-option:focus-visible {
  outline:none;
  box-shadow:0 0 0 3px rgba(30,58,138,.18), var(--shadow-md);
  border-color:var(--brand-primary);
}
[data-theme="dark"] .rp-option:focus-visible {
  box-shadow:0 0 0 3px rgba(59,130,246,.32), var(--shadow-md);
  border-color:#3B82F6;
}
.rp-option-text { padding:12px 14px; }
.rp-option-name { font-size:13px; font-weight:800; color:var(--text-primary); margin-bottom:3px; }
.rp-option-desc { font-size:11px; color:var(--text-muted); line-height:1.45; }
.rp-format-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:6px; }
.rp-format-pill {
  display:flex; align-items:center; gap:10px;
  padding:12px 14px; border-radius:12px;
  border:2px solid var(--border-light); background:var(--bg-muted);
  cursor:pointer; transition:var(--tr);
  font-family:var(--font-body); text-align:left;
}
.rp-format-pill:hover { border-color:var(--border-med); background:var(--bg-card); }
.rp-format-pill.selected-pdf  { border-color:#DC2626; background:rgba(220,38,38,.05); }
.rp-format-pill.selected-word { border-color:#1E40AF; background:rgba(30,64,175,.05); }
.rp-format-pill.selected-excel { border-color:#16A34A; background:rgba(22,163,74,.05); }
.rp-format-icon { width:34px; height:34px; border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; }
.rp-format-pill.selected-pdf  .rp-format-icon { background:rgba(220,38,38,.1); color:#DC2626; }
.rp-format-pill.selected-word .rp-format-icon { background:rgba(30,64,175,.1); color:#1E40AF; }
.rp-format-pill.selected-excel .rp-format-icon { background:rgba(22,163,74,.1); color:#16A34A; }
.rp-format-pill:not(.selected-pdf):not(.selected-word):not(.selected-excel) .rp-format-icon { background:var(--bg-card); color:var(--text-muted); }
.rp-format-name { font-size:13px; font-weight:700; color:var(--text-primary); }
.rp-format-desc { font-size:10.5px; color:var(--text-muted); margin-top:1px; }
.rp-format-pill.selected-pdf  .rp-format-name { color:#DC2626; }
.rp-format-pill.selected-word .rp-format-name { color:#1E40AF; }
.rp-format-pill.selected-excel .rp-format-name { color:#16A34A; }
.rp-footer {
  display:grid; grid-template-columns:1fr 1.6fr; gap:10px;
  padding:16px 24px 24px; border-top:1px solid var(--border-light);
}
.rp-btn {
  display:flex; align-items:center; justify-content:center; gap:8px;
  height:46px; border-radius:12px; border:none; cursor:pointer;
  font-family:var(--font-body); font-size:14px; font-weight:700; transition:var(--tr);
}
.rp-btn.cancel {
  background:var(--bg-muted); border:1.5px solid var(--border-light);
  color:var(--text-muted);
}
.rp-btn.cancel:hover { background:var(--bg-card); color:var(--text-primary); }
.rp-btn.go {
  background:linear-gradient(135deg,#1D4ED8,#1E3A8A); color:#fff;
  box-shadow:0 4px 14px rgba(30,58,138,.32), inset 0 1px 0 rgba(255,255,255,.2);
}
.rp-btn.go:hover { transform:translateY(-1px); box-shadow:0 8px 22px rgba(30,58,138,.45); }
.rp-btn.go:active { transform:scale(.97); }
`;

/* Every format a report might offer — a module passes a subset of
   these keys (e.g. ['pdf','word'] for Academics, ['pdf','excel'] for
   Examination) and the picker renders exactly that many pills. */
export const REPORT_FORMATS = {
  pdf:   { id: 'pdf',   label: 'PDF',           desc: 'Best for sharing',  icon: 'fa-solid fa-file-pdf',           pillClass: 'selected-pdf',   accent: '#DC2626' },
  word:  { id: 'word',  label: 'Word (.docx)',  desc: 'Best for editing',  icon: 'fa-brands fa-microsoft',         pillClass: 'selected-word',  accent: '#1E40AF' },
  excel: { id: 'excel', label: 'Excel (.xlsx)', desc: 'Best for analysis', icon: 'fa-solid fa-file-excel',         pillClass: 'selected-excel', accent: '#16A34A' },
};

/* ─── The two coordinated palettes every standard report renders
   with — Colorful (brand blue header, light-blue table headers,
   alt-row stripes, filled status pills) and Colorless (a genuine
   low-ink REDESIGN: white header, no decorative shapes, no
   alternating row fill, status pills become bordered text-only
   pills, emoji icons drop out via `ico()`) — not a CSS filter. ─── */
export function reportPalette(isColor) {
  const border = isColor ? '#BFDBFE' : '#D1D5DB';
  return {
    isColor,
    headerBg: isColor ? '#1E3A8A' : '#FFFFFF',
    headerFg: isColor ? '#FFFFFF' : '#111111',
    headerSubFg: isColor ? 'rgba(255,255,255,.75)' : '#4B5563',
    headerKick: isColor ? 'rgba(255,255,255,.55)' : '#6B7280',
    headerDivCol: isColor ? 'rgba(255,255,255,.2)' : '#E5E7EB',
    chipBg: isColor ? 'rgba(255,255,255,.14)' : 'transparent',
    chipBorder: isColor ? 'transparent' : '#D1D5DB',
    accent: isColor ? '#1E40AF' : '#374151',
    textD: isColor ? '#0F172A' : '#111111',
    textM: isColor ? '#64748B' : '#4B5563',
    border,
    tableHeadBg: isColor ? '#EFF6FF' : '#FFFFFF',
    tableHeadFg: isColor ? '#0F172A' : '#111111',
    rowAltBg: isColor ? '#F8FAFF' : '#FFFFFF',
    rowBaseBg: '#FFFFFF',
    styleLabel: isColor ? 'Colorful' : 'Colorless',
    sectionAccent: isColor ? `border-left:3px solid #1E40AF;padding-left:10px` : `border-bottom:1px solid ${border};padding:0 0 6px`,
    /* Drop emoji icons in colorless to save ink and avoid font-substitution glyphs. */
    ico: (emoji) => isColor ? `${emoji} ` : '',
  };
}

/* Status pill — colored fill in Colorful; bordered text-only pill in
   Colorless. Shared so every module's body-builder renders status
   the same way. */
export function reportStatusPill(label, tone, palette) {
  const cap = label[0].toUpperCase() + label.slice(1);
  if (palette.isColor) {
    const bg = tone === 'green' ? 'rgba(22,163,74,.1)' : tone === 'amber' ? 'rgba(217,119,6,.1)' : tone === 'red' ? 'rgba(220,38,38,.1)' : tone === 'gray' ? 'rgba(100,116,139,.1)' : 'rgba(30,58,138,.1)';
    const fg = tone === 'green' ? '#16A34A' : tone === 'amber' ? '#D97706' : tone === 'red' ? '#DC2626' : tone === 'gray' ? '#64748B' : '#1E40AF';
    return `<span style="background:${bg};color:${fg};padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700">${cap}</span>`;
  }
  return `<span style="border:1px solid ${palette.border};color:${palette.textD};padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700">${cap}</span>`;
}

/* Bespoke two-asset school logo — a real gradient SVG mark in Colorful,
   a stroked monochrome variant (not just a recolor) in Colorless. */
export function reportLogoSvg(isColor, initials = 'OX') {
  const uid = `${Date.now()}${Math.floor(Math.random() * 9999)}`;
  return isColor
    ? `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="lg${uid}" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop stop-color="#1a237e"/><stop offset="1" stop-color="#283593"/></linearGradient></defs>
        <rect width="64" height="64" rx="16" fill="url(#lg${uid})"/>
        <path d="M32 18C25.5 18 18 20.2 18 20.2L18 46C18 46 25.5 43.8 32 43.8C38.5 43.8 46 46 46 46L46 20.2C46 20.2 38.5 18 32 18Z" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.5)" stroke-width="1.2"/>
        <path d="M32 18L32 43.8" stroke="rgba(255,255,255,0.5)" stroke-width="1.2"/>
        <path d="M23 17L26 11L32 15L38 11L41 17" stroke="#FCD34D" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="32" y="38" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="900" fill="rgba(255,255,255,0.9)">${initials}</text>
      </svg>`
    : `<svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="62" height="62" rx="12" fill="#FFFFFF" stroke="#1F2937" stroke-width="1.5"/>
        <path d="M32 18C25.5 18 18 20.2 18 20.2L18 46C18 46 25.5 43.8 32 43.8C38.5 43.8 46 46 46 46L46 20.2C46 20.2 38.5 18 32 18Z" fill="none" stroke="#1F2937" stroke-width="1.3"/>
        <path d="M32 18L32 43.8" stroke="#1F2937" stroke-width="1.3"/>
        <text x="32" y="36" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="800" fill="#1F2937">${initials}</text>
      </svg>`;
}

/* ─── The standard header + footer + print/close toolbar — every
   module's report shares this exact chrome. `subtitleLine` defaults
   to "<Academic Year> · <Colorful|Colorless> Report" (Academics'
   own convention) but a module may override it (e.g. Examination
   passing its own term/exam context). ─── */
export function buildReportHeaderFooter({ isColor, reportTitle, format, subtitleLine, schoolName = REPORT_SCHOOL_NAME, logoInitials = 'OX' }) {
  const p = reportPalette(isColor);
  const logoSvg = reportLogoSvg(isColor, logoInitials);
  const sub = subtitleLine || `${REPORT_ACADEMIC_YEAR} · ${p.styleLabel} Report${isColor ? '' : ' (low-ink)'}`;
  const fmtLabel = (format || 'pdf').toUpperCase();
  const generatedOn = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const headerBlock = isColor
    ? `<div style="background:${p.headerBg};padding:24px 32px 28px;color:${p.headerFg};position:relative;overflow:hidden">
        <div style="position:absolute;top:-30px;right:-30px;width:140px;height:140px;border-radius:50%;background:rgba(255,255,255,.06)"></div>
        <div style="position:absolute;bottom:-20px;left:120px;width:80px;height:80px;border-radius:50%;background:rgba(14,165,233,.15)"></div>
        <div style="display:flex;align-items:center;gap:18px;position:relative;z-index:2">
          <div style="width:64px;height:64px;border-radius:16px;overflow:hidden;flex-shrink:0;box-shadow:0 4px 18px rgba(0,0,0,.35),0 0 0 2px rgba(255,255,255,.15)">${logoSvg}</div>
          <div>
            <div style="font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:${p.headerKick};font-weight:700;margin-bottom:3px">School Mentor ERP</div>
            <div style="font-size:20px;font-weight:800;color:${p.headerFg};letter-spacing:-.02em;line-height:1.2;text-shadow:0 1px 4px rgba(0,0,0,.2)">${schoolName}</div>
          </div>
        </div>
        <div style="height:1px;background:${p.headerDivCol};margin:18px 0 16px;position:relative;z-index:2"></div>
        <div style="font-size:22px;font-weight:800;letter-spacing:-.02em;margin-bottom:4px">${reportTitle}</div>
        <div style="font-size:13px;color:${p.headerSubFg};margin-bottom:16px">${sub}</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <div style="background:${p.chipBg};border:1px solid ${p.chipBorder};padding:6px 14px;border-radius:20px;font-size:11.5px"><strong>Generated:</strong> ${generatedOn}</div>
          <div style="background:${p.chipBg};border:1px solid ${p.chipBorder};padding:6px 14px;border-radius:20px;font-size:11.5px"><strong>Format:</strong> ${fmtLabel}</div>
        </div>
      </div>`
    : `<div style="background:${p.headerBg};padding:22px 32px 22px;color:${p.headerFg};border-bottom:1px solid ${p.border}">
        <div style="display:flex;align-items:center;gap:16px">
          <div style="width:56px;height:56px;flex-shrink:0">${logoSvg}</div>
          <div>
            <div style="font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:${p.headerKick};font-weight:700;margin-bottom:3px">School Mentor ERP</div>
            <div style="font-size:19px;font-weight:800;color:${p.headerFg};letter-spacing:-.02em;line-height:1.2">${schoolName}</div>
          </div>
        </div>
        <div style="height:1px;background:${p.headerDivCol};margin:16px 0 14px"></div>
        <div style="font-size:21px;font-weight:800;letter-spacing:-.02em;margin-bottom:3px;color:${p.headerFg}">${reportTitle}</div>
        <div style="font-size:12.5px;color:${p.headerSubFg};margin-bottom:14px">${sub}</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <div style="background:${p.chipBg};border:1px solid ${p.chipBorder};padding:5px 12px;border-radius:20px;font-size:11px;color:${p.textD}"><strong>Generated:</strong> ${generatedOn}</div>
          <div style="background:${p.chipBg};border:1px solid ${p.chipBorder};padding:5px 12px;border-radius:20px;font-size:11px;color:${p.textD}"><strong>Format:</strong> ${fmtLabel}</div>
        </div>
      </div>`;

  const footerBlock = `<div style="border-top:1px solid ${p.border};padding:14px 32px;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:${p.textM}">
    <span>${schoolName}</span><span>School Mentor ERP © 2026</span><span>Page 1 of 1</span>
  </div>`;

  const printBtnStyle = isColor
    ? `background:${p.headerBg};color:#fff;border:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;margin-right:10px`
    : `background:#FFFFFF;color:#111;border:1.5px solid #111;padding:11px 26px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;margin-right:10px`;
  const closeBtnStyle = `background:transparent;border:1.5px solid #CBD5E1;color:#64748B;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer`;
  const toolbarBg = isColor ? '#F8FAFC' : '#FFFFFF';
  const toolbarBlock = `<div class="no-print" style="text-align:center;padding:22px;background:${toolbarBg};border-top:1px solid #E2E8F0">
    <button onclick="window.print()" style="${printBtnStyle}">${isColor ? '🖨 ' : ''}Print / Save as PDF</button>
    <button onclick="window.close()" style="${closeBtnStyle}">Close</button>
  </div>`;

  return { headerBlock, footerBlock, toolbarBlock, palette: p };
}

/* ─── Full standalone HTML document — header + body (caller-supplied
   HTML, either free-form sections or a table built via
   buildReportTableHtml below) + footer + print toolbar. `orientation`
   lets wide-table reports (Examination's) go landscape while
   Academics' single-topic reports stay portrait. ─── */
export function buildStandardReportHtml({ title, format = 'pdf', isColor, bodyHtml, subtitleLine, schoolName, logoInitials, orientation = 'portrait', includeToolbar = true }) {
  const { headerBlock, footerBlock, toolbarBlock, palette } = buildReportHeaderFooter({ isColor, reportTitle: title, format, subtitleLine, schoolName, logoInitials });
  const pageWidth = orientation === 'landscape' ? '297mm' : '210mm';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title} — Report</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:${palette.textD};font-size:13px}.page{width:${pageWidth};margin:0 auto}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none}@page{size:A4 ${orientation};margin:15mm}}</style>
  </head><body><div class="page">
    ${headerBlock}
    <div style="padding:28px 32px">${bodyHtml}</div>
    ${footerBlock}
    ${includeToolbar ? toolbarBlock : ''}
  </div></body></html>`;
}

/* Opens a print-ready report window — same technique every module's
   PDF export already used independently (`document.write` into a
   blank `window.open`), now shared. */
export function openReportWindow(html, w = 900, h = 700) {
  const win = window.open('', '_blank', `width=${w},height=${h}`);
  if (win) { win.document.write(html); win.document.close(); }
}

/* Word export — the exact same report HTML, saved as a .doc file via
   the Blob technique already established elsewhere in this codebase
   (PaperGenerator.jsx, hrReports.js's exportHrReportAsWord). Word
   viewers open HTML saved with a .doc extension + application/msword
   MIME type just fine — no real docx library needed for this
   mock/demo app, and it turns Academics' previous "coming soon" stub
   into an actually-working export. */
/* Shared filename sanitizer — every module's own reportFileName/
   downloadHtmlAsWord helper duplicated this exact regex; centralized
   here so new modules calling downloadReportAsWord/downloadReportHtmlAsExcel
   don't need to re-derive it. */
export function reportFileName(title) {
  return (title || 'Report').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
}

export function downloadReportAsWord(html, filename) {
  const blob = new Blob([html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* Universal Excel export — the exact same report HTML, saved as a
   .xls file via the Blob technique already established independently
   in Fee.jsx, DoubleEntryAccounts.jsx and AdmissionCrm.jsx (Excel
   opens HTML content fine when served with a .xls extension +
   application/vnd.ms-excel MIME type). This is what makes "Excel
   wherever applicable" tractable for every free-form/sectioned report
   in the ERP — not just the handful with a real {columns,rows} shape
   (those keep using downloadReportExcel below for a true, nicer-
   formatted .xlsx with frozen panes etc.) — since it reuses whatever
   HTML was already built for PDF/Word, no separate column mapping
   needed per report. */
export function downloadReportHtmlAsExcel(html, filename) {
  const blob = new Blob(['﻿', html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* Builds just the inner <table> for a columns+rows report (Examination's
   shape) using the same palette as the free-form body builder, so a
   table-shaped report and a sections-shaped report render inside the
   IDENTICAL header/footer chrome. Supports the same class-block
   `groupKey`/`groupLabel` grouping built for Examination's Syllabus
   Sharing / Result Upload Status reports. */
export function buildReportTableHtml({ columns, rows, isColor, groupKey, groupLabel, emptyText }) {
  const p = reportPalette(isColor);
  const theadHtml = columns.map(c => `<th style="padding:9px 10px;text-align:${c.align || 'left'};border:1px solid ${p.border};font-weight:700;color:${p.tableHeadFg}${c.width ? `;width:${c.width}` : ''}">${c.label}</th>`).join('');
  let lastGroup;
  let n = 0;
  const bodyHtml = rows.length
    ? rows.map(r => {
        const i = n++;
        const rowHtml = `<tr style="background:${i % 2 === 0 ? p.rowBaseBg : p.rowAltBg}">${columns.map(c => `<td style="padding:8px 10px;text-align:${c.align || 'left'};border:1px solid ${p.border};color:${p.textM}">${r[c.key] ?? '—'}</td>`).join('')}</tr>`;
        if (!groupKey || r[groupKey] === lastGroup) return rowHtml;
        lastGroup = r[groupKey];
        const label = groupLabel ? groupLabel(r) : String(lastGroup);
        return `<tr><td colspan="${columns.length}" style="background:${isColor ? '#DBEAFE' : '#F3F4F6'};color:${p.accent};font-weight:800;font-size:11.5px;padding:8px 10px;border:1px solid ${p.border}">${label}</td></tr>${rowHtml}`;
      }).join('')
    : `<tr><td colspan="${columns.length}" style="text-align:center;padding:24px;color:${p.textM};border:1px solid ${p.border}">${emptyText || 'No data for this selection.'}</td></tr>`;
  return `<table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead><tr style="background:${p.tableHeadBg}">${theadHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
}

/* ─── Shared Excel export — absorbs bmuDownloadWorkbook (Examination),
   feeDownloadWorkbook (Fee) and Students' equivalent into ONE ExcelJS
   builder: merged title row (colorful/colorless header fill), a meta
   row, a styled header row, bordered data rows, and the same
   groupKey/groupLabel class-block divider support built for
   Examination's Reports tab. ─── */
export async function downloadReportExcel({ title, subtitle, metaLine, columns, rows, filename, isColor = true, groupKey, groupLabel }) {
  const headerFill = isColor ? 'FF1E3A8A' : 'FF475569';
  const groupFill  = isColor ? 'FFDBEAFE' : 'FFDDDDDD';
  const wb = new ExcelJS.Workbook();
  wb.creator = 'School Mentor';
  wb.created = new Date();
  const ws = wb.addWorksheet((title || 'Report').slice(0, 31));
  ws.columns = columns.map(() => ({ width: 20 }));

  ws.mergeCells(1, 1, 1, columns.length);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = subtitle ? `${title} — ${subtitle}` : title;
  titleCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerFill } };
  ws.getRow(1).height = 24;

  ws.mergeCells(2, 1, 2, columns.length);
  const metaCell = ws.getCell(2, 1);
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  metaCell.value = `${metaLine ? metaLine + '   ·   ' : ''}Generated: ${today}`;
  metaCell.font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
  metaCell.alignment = { horizontal: 'center' };
  ws.getRow(2).height = 18;

  const headerRow = ws.getRow(3);
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.label;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9.5 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerFill } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  headerRow.height = 26;

  let rowNum = 4;
  let lastGroup;
  rows.forEach(r => {
    if (groupKey && r[groupKey] !== lastGroup) {
      lastGroup = r[groupKey];
      ws.mergeCells(rowNum, 1, rowNum, columns.length);
      const grpCell = ws.getCell(rowNum, 1);
      grpCell.value = groupLabel ? groupLabel(r) : String(lastGroup);
      grpCell.font = { bold: true, size: 10.5, color: { argb: 'FF1E3A8A' } };
      grpCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: groupFill } };
      ws.getRow(rowNum).height = 20;
      rowNum++;
    }
    const row = ws.getRow(rowNum);
    columns.forEach((c, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = r[c.key] ?? '—';
      cell.alignment = { horizontal: c.align === 'right' || c.align === 'center' ? 'center' : 'left' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
    rowNum++;
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════════════════════════════
   STANDARD REPORT PICKER — the ERP-wide modal. Same shell every
   pre-existing `.report-picker-overlay`/`.rp-*` picker already used,
   generalized: `formats` is an array of REPORT_FORMATS keys, and the
   format-pill row renders exactly that many pills instead of a
   hardcoded pair.
   ═══════════════════════════════════════════════════════════════════ */
export function StandardReportPicker({ open, title = 'Download Report', subtitle, formats = ['pdf'], defaultFormat, defaultStyle, onGenerate, onClose, filters, generateDisabled }) {
  const [style, setStyle] = useState(defaultStyle || 'color');
  const [format, setFormat] = useState(defaultFormat || formats[0]);

  useEffect(() => {
    if (open) { setStyle(defaultStyle || 'color'); setFormat(defaultFormat || formats[0]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* Escape-to-close + body-scroll-lock while open — same modal chrome
     every pre-existing bespoke picker across the ERP already provided
     locally (e.g. AdmissionCrm's useModalChrome), now built into the
     shared component so every caller gets it for free. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const fmtDef = REPORT_FORMATS[format] || REPORT_FORMATS.pdf;
  const downloadLabel = `Download ${style === 'color' ? 'Colorful' : 'Colorless'} ${fmtDef.label}`;

  const onStyleKey = (e, value) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setStyle(value); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setStyle('color'); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw'); }
  };

  if (!open) return null;

  return (
    <div className="report-picker-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-labelledby="rp-title">
      <style>{REPORT_KIT_CSS}</style>
      <div className="report-picker">
        <div className="rp-header">
          <div className="rp-header-left">
            <div className="rp-header-icon"><i className="fa-solid fa-print"></i></div>
            <div>
              <div className="rp-title" id="rp-title">Download Report</div>
              <div className="rp-sub">{subtitle || `${title} — Choose style and format`}</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="rp-close" onClick={onClose} aria-label="Close download dialog"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>
        <div className="rp-body">
          {filters && <>{filters}</>}
          <div className="rp-section-label" id="rp-style-label">Report Style</div>
          <div className="rp-options" role="radiogroup" aria-labelledby="rp-style-label">
            <div className={`rp-option${style === 'color' ? ' selected' : ''}`} onClick={() => setStyle('color')} role="radio" aria-checked={style === 'color'} tabIndex={style === 'color' ? 0 : -1} onKeyDown={e => onStyleKey(e, 'color')}>
              <div className="rp-check" aria-hidden="true"><i className="fa-solid fa-check"></i></div>
              <div className="rp-preview" aria-hidden="true">
                <div className="rp-preview-color">
                  <div className="rp-mock-header"></div>
                  <div className="rp-mock-line" style={{ width: '65%', height: 5 }}></div>
                  <div className="rp-mock-line" style={{ width: '50%', height: 5 }}></div>
                  <div className="rp-mock-chips">
                    <div className="rp-mock-chip" style={{ background: 'rgba(255,255,255,.85)' }}></div>
                    <div className="rp-mock-chip" style={{ background: '#FCD34D' }}></div>
                    <div className="rp-mock-chip" style={{ background: '#FCA5A5' }}></div>
                  </div>
                </div>
              </div>
              <div className="rp-option-text">
                <div className="rp-option-name"><i className="fa-solid fa-palette" style={{ color: '#1E40AF', marginRight: 6, fontSize: 12 }}></i>Colorful Report</div>
                <div className="rp-option-desc">Full brand palette, summary cards, colored headers &amp; icons</div>
              </div>
            </div>
            <div className={`rp-option${style === 'bw' ? ' selected' : ''}`} onClick={() => setStyle('bw')} role="radio" aria-checked={style === 'bw'} tabIndex={style === 'bw' ? 0 : -1} onKeyDown={e => onStyleKey(e, 'bw')}>
              <div className="rp-check" aria-hidden="true"><i className="fa-solid fa-check"></i></div>
              <div className="rp-preview" aria-hidden="true">
                <div className="rp-preview-bw">
                  <div className="rp-mock-header-bw"></div>
                  <div className="rp-mock-line-bw" style={{ width: '65%', height: 5 }}></div>
                  <div className="rp-mock-line-bw" style={{ width: '50%', height: 5 }}></div>
                  <div className="rp-mock-chips-bw">
                    <div className="rp-mock-chip-bw"></div>
                    <div className="rp-mock-chip-bw"></div>
                    <div className="rp-mock-chip-bw"></div>
                  </div>
                </div>
              </div>
              <div className="rp-option-text">
                <div className="rp-option-name"><i className="fa-solid fa-circle-half-stroke" style={{ color: 'var(--text-muted)', marginRight: 6, fontSize: 12 }}></i>Colorless Report</div>
                <div className="rp-option-desc">Low-ink layout — white background, light borders, no colored blocks</div>
              </div>
            </div>
          </div>

          <div className="rp-section-label">File Format</div>
          <div className="rp-format-row" style={{ gridTemplateColumns: `repeat(${formats.length},1fr)` }}>
            {formats.map(fid => {
              const f = REPORT_FORMATS[fid];
              if (!f) return null;
              return (
                <button key={fid} className={`rp-format-pill${format === fid ? ` ${f.pillClass}` : ''}`} onClick={() => setFormat(fid)}>
                  <div className="rp-format-icon"><i className={f.icon}></i></div>
                  <div><div className="rp-format-name">{f.label}</div><div className="rp-format-desc">{f.desc}</div></div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="rp-footer">
          <Tooltip text="Cancel and close"><button className="rp-btn cancel" onClick={onClose}>Cancel</button></Tooltip>
          <Tooltip text={generateDisabled ? 'Fill in the required filters first' : 'Generate and download the selected report'}>
            <button className="rp-btn go" onClick={() => onGenerate(style, format)} disabled={!!generateDisabled} style={generateDisabled ? { opacity: .5, cursor: 'not-allowed' } : undefined}>
              <i className="fa-solid fa-download"></i><span>{downloadLabel}</span>
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
