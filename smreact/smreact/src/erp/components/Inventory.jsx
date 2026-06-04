import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from './Tooltip';
import TutorialModal from './TutorialModal';
import * as inventoryService from '../services/inventoryService';
import useAsync from '../hooks/useAsync';

/* ─── module-wide helpers (mirrors HTML reference) ─── */
const CAT_ICON = {
  'Furniture':        'fa-chair',
  'Electronics':      'fa-desktop',
  'Appliances':       'fa-fan',
  'Lab Equipment':    'fa-flask',
  'Sports':           'fa-futbol',
  'Books Stock':      'fa-book',
  'Stationery':       'fa-pen',
  'Office Equipment': 'fa-print',
  'Security':         'fa-video',
  'Teaching Aids':    'fa-chalkboard',
  'Other':            'fa-box',
};
const catIcon = (c) => CAT_ICON[c] || 'fa-box';

const PROD_ICON = {
  'Books':      'fa-book',
  'Notebooks':  'fa-book-open',
  'Stationery': 'fa-pen',
  'Uniform':    'fa-shirt',
  'Other':      'fa-box-open',
};
const prodIcon = (c) => PROD_ICON[c] || 'fa-box-open';

const STATUS_PILL = {
  'In Use':       'inv-pill-green',
  'In Store':     'inv-pill-blue',
  'Under Repair': 'inv-pill-amber',
  'Damaged':      'inv-pill-red',
};
const statusPillClass = (s) => STATUS_PILL[s] || 'inv-pill-grey';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtMoney = (n) => Number(n || 0).toLocaleString('en-PK');
const todayISO = () => new Date().toISOString().slice(0, 10);
const invFmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return `${dt.getDate()} ${MONTHS_SHORT[dt.getMonth()]} ${dt.getFullYear()}`;
};

/* Deterministic pseudo-Code39 barcode SVG (matches HTML reference) */
function barcodeSVG(code) {
  let bars = '';
  let x = 0;
  const seed = String(code || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  for (let k = 0; k < 46; k++) {
    const w = ((seed >> (k % 9)) + k * 7 + (code || ' ').charCodeAt(k % Math.max(1, code.length))) % 4 + 1;
    if (k % 2 === 0) bars += `<rect x="${x}" y="0" width="${w}" height="60" fill="#111"/>`;
    x += w;
  }
  return `<svg class="inv-barcode-svg" viewBox="0 0 ${x} 60" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"><rect width="${x}" height="60" fill="#fff"/>${bars}</svg>`;
}

function genItemCode(name, cat, existing) {
  const base = (cat === 'Furniture' ? 'FURN' : (cat || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5)) || 'ITEM';
  let max = 0;
  (existing || []).forEach(i => {
    const m = (i.code || '').match(/-(\d+)$/);
    if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
  });
  return `INV-${base}-${String(max + 1).padStart(3, '0')}`;
}

function schoolLogoSVG() {
  return `<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg"><rect width="36" height="36" rx="6" fill="#1E3A8A"/><path d="M18 10 C14 10 10 11.5 10 11.5 L10 26 C10 26 14 24.5 18 24.5 C22 24.5 26 26 26 26 L26 11.5 C26 11.5 22 10 18 10Z" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.6)" stroke-width="0.8"/><path d="M18 10 L18 24.5" stroke="rgba(255,255,255,0.7)" stroke-width="0.8"/></svg>`;
}

/* ─── International barcode label sizes ─── */
const LABEL_SIZES = [
  { id: 'small',  label: 'Small Thermal',  w: 38, h: 25, sub: 'Single label · 38 × 25 mm', icon: 'fa-tag',          desc: 'Smallest thermal label — fits on pens, erasers, small parts.' },
  { id: 'medium', label: 'Medium Thermal', w: 50, h: 30, sub: 'Single label · 50 × 30 mm', icon: 'fa-tags',         desc: 'Standard size — books, notebooks, mid-sized assets.' },
  { id: 'large',  label: 'Large Thermal',  w: 70, h: 40, sub: 'Single label · 70 × 40 mm', icon: 'fa-square-full',  desc: 'Easier to scan — bags, uniforms, large equipment.' },
  { id: 'sheet',  label: 'A4 Sheet · 30 labels', w: 70, h: 33, sub: '3 × 10 grid · Avery 5160 style', icon: 'fa-grip',         desc: 'Fill one A4 sheet with 30 identical labels (70 × 33 mm).' },
];

/* Build the HTML for a single barcode label sized in mm. */
function buildSingleLabelHTML(target, size, school, toast, copies = 1) {
  void toast;
  const esc = (s) => String(s ?? '').replace(/[<>&"']/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[m]));
  const showSchool = size.w >= 50;
  const showMeta   = size.w >= 50;
  /* Auto font sizing keyed off label width */
  const nameFS  = size.w < 40 ? 7 : size.w < 60 ? 9  : 11;
  const codeFS  = size.w < 40 ? 8 : size.w < 60 ? 10 : 12;
  const metaFS  = size.w < 50 ? 6.5 : 8;
  const labelBlock = `
    <div class="label">
      ${showSchool ? `<div class="lbl-school">${esc(school?.name || 'School')}</div>` : ''}
      <div class="lbl-name" style="font-size:${nameFS}px">${esc(target.name)}</div>
      <div class="lbl-bar">${barcodeSVG(target.code).replace('class="inv-barcode-svg"', 'style="width:100%;height:100%;display:block"')}</div>
      <div class="lbl-code" style="font-size:${codeFS}px">${esc(target.code)}</div>
      ${showMeta && (target.cat || target.loc) ? `<div class="lbl-meta" style="font-size:${metaFS}px">${esc([target.cat, target.loc].filter(Boolean).join(' · '))}</div>` : ''}
    </div>`;
  const repeated = Array.from({ length: copies }).map(() => labelBlock).join('');
  return `
    <style>
      *{box-sizing:border-box;margin:0;padding:0;font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif}
      html,body{background:#F1F3F8}
      body{padding:14px 0}
      .stage{display:flex;flex-direction:column;align-items:center;gap:10px}
      .label{width:${size.w}mm;height:${size.h}mm;background:#fff;border:1px solid #ccc;border-radius:1.5mm;padding:1.5mm 2mm;display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:0.5mm;overflow:hidden;box-shadow:0 4px 14px rgba(15,23,42,.10)}
      .lbl-school{font-size:7.5px;font-weight:800;color:#1E3A8A;letter-spacing:.3px;text-align:center;line-height:1.15}
      .lbl-name{font-weight:700;color:#111;text-align:center;line-height:1.15;width:100%;max-height:25%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .lbl-bar{flex:1;width:100%;display:flex;align-items:center;justify-content:center;min-height:0}
      .lbl-code{font-family:ui-monospace,Menlo,monospace;font-weight:800;letter-spacing:1.5px;color:#111;text-align:center;line-height:1.05}
      .lbl-meta{color:#666;text-align:center;font-weight:600;line-height:1.1}
      @page{size:${size.w + 4}mm ${size.h + 4}mm;margin:2mm}
      @media print{body{background:#fff;padding:0}.stage{gap:0}.label{box-shadow:none;border:none;page-break-after:always}.label:last-child{page-break-after:auto}}
    </style>
    <div class="stage">${repeated}</div>`;
}

/* Build an A4 sheet with 30 identical labels (3 × 10 grid). */
function buildLabelSheetHTML(target, school) {
  const esc = (s) => String(s ?? '').replace(/[<>&"']/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[m]));
  const labels = Array.from({ length: 30 }).map(() => `
    <div class="lbl">
      <div class="lbl-school">${esc(school?.name || 'School')}</div>
      <div class="lbl-name">${esc(target.name)}</div>
      <div class="lbl-bar">${barcodeSVG(target.code).replace('class="inv-barcode-svg"', 'style="width:100%;height:100%;display:block"')}</div>
      <div class="lbl-code">${esc(target.code)}</div>
    </div>`).join('');
  return `
    <style>
      *{box-sizing:border-box;margin:0;padding:0;font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif}
      html,body{background:#F1F3F8}
      body{padding:18px 0}
      .sheet{width:210mm;min-height:297mm;margin:0 auto;padding:13mm 6mm;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,.12);display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:27mm;gap:1.5mm 2mm}
      .lbl{border:1px dashed #cbd5e1;border-radius:1.5mm;padding:1.5mm 2mm;display:flex;flex-direction:column;align-items:center;justify-content:space-between;overflow:hidden;background:#fff}
      .lbl-school{font-size:6.5px;font-weight:800;color:#1E3A8A;letter-spacing:.3px;text-align:center;line-height:1.1}
      .lbl-name{font-size:7.5px;font-weight:700;color:#111;text-align:center;line-height:1.15;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
      .lbl-bar{flex:1;width:100%;display:flex;align-items:center;justify-content:center;min-height:0;padding:0.5mm 0}
      .lbl-code{font-family:ui-monospace,Menlo,monospace;font-size:8px;font-weight:800;letter-spacing:1px;color:#111;text-align:center}
      @page{size:A4 portrait;margin:0}
      @media print{body{background:#fff;padding:0}.sheet{box-shadow:none;margin:0}.lbl{border-color:transparent}}
    </style>
    <div class="sheet">${labels}</div>`;
}

/* Open a popup with raw HTML (no extra .page wrapper) — used for label printing */
function openRawPrintWindow(title, html, toast) {
  const w = window.open('', '_blank');
  if (!w) { toast && toast('Please allow pop-ups to print', 'error'); return; }
  const escTitle = String(title || '').replace(/[<>&]/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m]));
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escTitle}</title></head><body>${html}</body></html>`);
  w.document.close();
  w.onload = () => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } };
}

/* Build an A4 sales report — KPI strip + receipts table + totals. */
function buildSalesReportHTML(sales, school, opts = {}) {
  const esc = (s) => String(s ?? '').replace(/[<>&"']/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[m]));
  const today = todayISO();
  const todayList = sales.filter(s => s.date === today);
  const todayTotal = todayList.reduce((a, s) => a + s.total, 0);
  const monthKey   = today.slice(0, 7);
  const monthTotal = sales.filter(s => s.date.slice(0, 7) === monthKey).reduce((a, s) => a + s.total, 0);
  const totalQty   = sales.reduce((a, s) => a + s.lines.reduce((b, l) => b + l.qty, 0), 0);
  const totalAmt   = sales.reduce((a, s) => a + s.total, 0);
  const sorted     = [...sales].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const rows = sorted.map((s, i) => {
    const qty = s.lines.reduce((a, l) => a + l.qty, 0);
    const items = s.lines.map(l => `${l.qty}× ${esc(l.name)}`).join(', ');
    return `
      <tr>
        <td class="c">${i + 1}</td>
        <td class="mono">${esc(s.no)}</td>
        <td>${esc(invFmtDate(s.date))}</td>
        <td>${esc(s.buyer)}</td>
        <td class="items">${items}</td>
        <td class="c">${qty}</td>
        <td class="r"><b>Rs ${fmtMoney(s.total)}</b></td>
      </tr>`;
  }).join('');

  return `
    <div class="rhead">
      <div class="rlogo">${schoolLogoSVG()}</div>
      <div>
        <div class="rname">${esc(school?.name || 'School')}</div>
        <div class="rtitle">${esc(opts.title || 'Sales History Report')}</div>
      </div>
      <div class="meta">Generated: ${invFmtDate(today)}<br/>Records: ${sales.length}</div>
    </div>

    <div class="kpi-row">
      <div class="kpi a"><div class="l">Today's Sales</div><div class="v">Rs ${fmtMoney(todayTotal)}</div><div class="m">${todayList.length} receipt(s)</div></div>
      <div class="kpi b"><div class="l">This Month</div><div class="v">Rs ${fmtMoney(monthTotal)}</div><div class="m">${MONTHS_SHORT[new Date().getMonth()]} ${new Date().getFullYear()}</div></div>
      <div class="kpi c"><div class="l">Total Receipts</div><div class="v">${sales.length}</div><div class="m">all time</div></div>
      <div class="kpi d"><div class="l">Total Revenue</div><div class="v">Rs ${fmtMoney(totalAmt)}</div><div class="m">${totalQty} item(s) sold</div></div>
    </div>

    <div class="sec-band">
      <span>Sales History</span>
      <small>${sorted.length} receipt(s) · newest first</small>
    </div>

    <table class="tbl">
      <thead>
        <tr>
          <th class="c" style="width:30px">#</th>
          <th style="width:80px">Receipt #</th>
          <th style="width:75px">Date</th>
          <th style="width:140px">Buyer</th>
          <th>Items</th>
          <th class="c" style="width:40px">Qty</th>
          <th class="r" style="width:80px">Total</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="7" class="empty">No sales recorded yet.</td></tr>'}</tbody>
      <tfoot>
        <tr class="tot">
          <td colspan="5" class="r">Aggregate</td>
          <td class="c">${totalQty}</td>
          <td class="r">Rs ${fmtMoney(totalAmt)}</td>
        </tr>
      </tfoot>
    </table>

    <div style="margin-top:14px;font-size:11px;color:#555">Total sales across the recorded period: <b>Rs ${fmtMoney(totalAmt)}</b> · ${totalQty} items sold across ${sales.length} receipt(s).</div>
    <div class="rfoot">Generated on ${invFmtDate(today)} · School Mentor ERP — POS Sales</div>`;
}

/* ═══════════════════════════════════════════════════════════════════
   INVENTORY REPORTS — A4 print builders & opener (blue brand)
   Matches the HTML reference's openPrint() output exactly.
   ═══════════════════════════════════════════════════════════════════ */
const INV_MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function reportHeadHTML(title, school, isBW = false) {
  const esc = (s) => String(s ?? '').replace(/[<>&"']/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[m]));
  /* The actual palette swap happens via the .inv-bw class injected on
     <body> in openInvReportWindow (see below). This helper only adds a
     "Colorless Print" caption so the printed copy makes the variant clear. */
  return `<div class="rhead"><div class="rlogo">${schoolLogoSVG()}</div><div><div class="rname">${esc(school?.name || 'School')}</div><div class="rtitle">${esc(title)}</div></div><div class="meta">Generated: ${invFmtDate(todayISO())}${isBW ? '<br/><b>Colorless Print</b>' : ''}</div></div>`;
}
function reportFootHTML() {
  return `<div class="rfoot">Generated on ${invFmtDate(todayISO())} · School Mentor ERP — Inventory Module</div>`;
}

const INV_REPORT_TITLES = {
  inv_total:    'Total Inventory Report',
  inv_status:   'Active vs Inactive Items Report',
  inv_category: 'Category-wise Inventory Report',
  inv_location: 'Location-wise Inventory Report',
  pos_daily:    'Daily Sales Report',
  pos_monthly:  'Monthly Sales Report',
  pos_overall:  'Overall Sales Report',
  pos_product:  'Product-wise Sales Report',
  pos_lowstock: 'Low Stock Products Report',
  pos_pvs:      'Purchase vs Sale Summary',
  pos_pnl:      'Profit & Loss Report',
  pos_invvalue: 'Current Inventory Value Report',
};

function buildInvReportBody(type, opts, ctx) {
  const esc = (s) => String(s ?? '').replace(/[<>&"']/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[m]));
  const items    = ctx.items    || [];
  const products = ctx.products || [];
  const sales    = ctx.sales    || [];
  const o = opts || {};

  if (type === 'inv_total') {
    const list = items.filter(i => i.active);
    const totQty = list.reduce((a, i) => a + i.qty, 0);
    return `
      <table class="tbl">
        <thead><tr><th>Inventory #</th><th>Item</th><th>Category</th><th class="c">Qty</th><th>Location</th><th>Status</th></tr></thead>
        <tbody>${list.map(i => `<tr><td class="mono">${esc(i.code)}</td><td>${esc(i.name)}</td><td>${esc(i.cat)}</td><td class="c">${fmtMoney(i.qty)}</td><td>${esc(i.loc || '—')}</td><td>${esc(i.status)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">No active items.</td></tr>'}</tbody>
        <tfoot><tr class="tot"><td colspan="3">Total Items</td><td class="c">${fmtMoney(totQty)}</td><td colspan="2">${list.length} records</td></tr></tfoot>
      </table>`;
  }

  if (type === 'inv_status') {
    const actives  = items.filter(i => i.active);
    const inactive = items.filter(i => !i.active);
    return `
      <div class="kpi-row">
        <div class="kpi a"><div class="l">Active Items</div><div class="v">${actives.length}</div><div class="m">currently in use</div></div>
        <div class="kpi b"><div class="l">Inactive Items</div><div class="v">${inactive.length}</div><div class="m">retired or damaged</div></div>
        <div class="kpi c"><div class="l">Total Records</div><div class="v">${items.length}</div><div class="m">across all states</div></div>
      </div>
      <div class="secttl">Active Items (${actives.length})</div>
      <table class="tbl">
        <thead><tr><th>Inventory #</th><th>Item</th><th class="c">Qty</th><th>Status</th></tr></thead>
        <tbody>${actives.length ? actives.map(i => `<tr><td class="mono">${esc(i.code)}</td><td>${esc(i.name)}</td><td class="c">${fmtMoney(i.qty)}</td><td>${esc(i.status)}</td></tr>`).join('') : '<tr><td colspan="4" class="empty">No active items.</td></tr>'}</tbody>
      </table>
      <div class="secttl">Inactive Items (${inactive.length})</div>
      <table class="tbl">
        <thead><tr><th>Inventory #</th><th>Item</th><th class="c">Qty</th><th>Status</th></tr></thead>
        <tbody>${inactive.length ? inactive.map(i => `<tr><td class="mono">${esc(i.code)}</td><td>${esc(i.name)}</td><td class="c">${fmtMoney(i.qty)}</td><td>${esc(i.status)}</td></tr>`).join('') : '<tr><td colspan="4" class="empty">No inactive items.</td></tr>'}</tbody>
      </table>`;
  }

  if (type === 'inv_category') {
    const groups = {};
    items.filter(i => i.active).forEach(i => { (groups[i.cat] = groups[i.cat] || []).push(i); });
    return Object.keys(groups).sort().map(cat => {
      const g = groups[cat];
      const tot = g.reduce((a, i) => a + i.qty, 0);
      return `
        <div class="secttl">${esc(cat)} — ${fmtMoney(tot)} items</div>
        <table class="tbl">
          <thead><tr><th>Inventory #</th><th>Item</th><th class="c">Qty</th><th>Location</th></tr></thead>
          <tbody>${g.map(i => `<tr><td class="mono">${esc(i.code)}</td><td>${esc(i.name)}</td><td class="c">${fmtMoney(i.qty)}</td><td>${esc(i.loc || '—')}</td></tr>`).join('')}</tbody>
        </table>`;
    }).join('') || '<div class="empty-state">No active items.</div>';
  }

  if (type === 'inv_location') {
    const groups = {};
    items.filter(i => i.active).forEach(i => { const L = i.loc || 'Unassigned'; (groups[L] = groups[L] || []).push(i); });
    const updatedOf = (i) => {
      const h = i.history && i.history.length ? i.history[i.history.length - 1].at : null;
      return h || i.date || '';
    };
    return Object.keys(groups).sort().map(loc => {
      const g = groups[loc];
      const tot = g.reduce((a, i) => a + i.qty, 0);
      return `
        <div class="secttl">${esc(loc)} — ${fmtMoney(tot)} items</div>
        <table class="tbl">
          <thead><tr><th>Item</th><th>Category</th><th class="c">Qty</th><th class="c">Unit</th><th>Location</th><th>Status</th><th>Updated</th></tr></thead>
          <tbody>${g.map(i => `<tr><td>${esc(i.name)}</td><td>${esc(i.cat)}</td><td class="c">${fmtMoney(i.qty)}</td><td class="c">Pcs</td><td>${esc(i.loc || 'Unassigned')}</td><td>${esc(i.status || '—')}</td><td>${updatedOf(i) ? invFmtDate(updatedOf(i)) : '—'}</td></tr>`).join('')}</tbody>
        </table>`;
    }).join('') || '<div class="empty-state">No active items.</div>';
  }

  if (type === 'pos_daily') {
    const day = todayISO();
    const list = sales.filter(s => s.date === day);
    const tot = list.reduce((a, s) => a + s.total, 0);
    return `
      <div class="rfilters">
        <span><b>Date:</b> ${invFmtDate(day)}</span>
        <span><b>Receipts:</b> ${list.length}</span>
        <span><b>Total Sales:</b> Rs ${fmtMoney(tot)}</span>
      </div>
      <table class="tbl">
        <thead><tr><th>Receipt #</th><th>Buyer</th><th>Items</th><th class="c">Qty</th><th class="r">Amount</th></tr></thead>
        <tbody>${list.length ? list.map(s => `<tr><td class="mono">${esc(s.no)}</td><td>${esc(s.buyer)}</td><td class="items">${esc(s.lines.map(l => `${l.qty}× ${l.name}`).join(', '))}</td><td class="c">${s.lines.reduce((a, l) => a + l.qty, 0)}</td><td class="r">Rs ${fmtMoney(s.total)}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">No sales recorded today.</td></tr>'}</tbody>
        <tfoot><tr class="tot"><td colspan="4">Total Sales</td><td class="r">Rs ${fmtMoney(tot)}</td></tr></tfoot>
      </table>`;
  }

  if (type === 'pos_monthly') {
    const now = new Date();
    const y = o.year  != null ? o.year  : now.getFullYear();
    const m = o.month != null ? o.month : now.getMonth();
    const monKey = `${y}-${String(m + 1).padStart(2, '0')}`;
    const list = sales.filter(s => s.date.slice(0, 7) === monKey);
    const byDay = {};
    list.forEach(s => { byDay[s.date] = (byDay[s.date] || 0) + s.total; });
    const tot = list.reduce((a, s) => a + s.total, 0);
    const dayRows = Object.keys(byDay).sort().map(d => `<tr><td>${invFmtDate(d)}</td><td class="c">${list.filter(s => s.date === d).length}</td><td class="r">Rs ${fmtMoney(byDay[d])}</td></tr>`).join('');
    return `
      <div class="rfilters">
        <span><b>Month:</b> ${INV_MONTHS_LONG[m]} ${y}</span>
        <span><b>Receipts:</b> ${list.length}</span>
        <span><b>Total Sales:</b> Rs ${fmtMoney(tot)}</span>
      </div>
      <table class="tbl">
        <thead><tr><th>Date</th><th class="c">Receipts</th><th class="r">Sales (Rs)</th></tr></thead>
        <tbody>${dayRows || '<tr><td colspan="3" class="empty">No sales in this month.</td></tr>'}</tbody>
        <tfoot><tr class="tot"><td colspan="2">Total</td><td class="r">Rs ${fmtMoney(tot)}</td></tr></tfoot>
      </table>`;
  }

  if (type === 'pos_overall') {
    const from = o.from || todayISO();
    const to   = o.to   || todayISO();
    const list = sales.filter(s => s.date >= from && s.date <= to).sort((a, b) => a.date < b.date ? -1 : 1);
    const tot  = list.reduce((a, s) => a + s.total, 0);
    const qty  = list.reduce((a, s) => a + s.lines.reduce((x, l) => x + l.qty, 0), 0);
    return `
      <div class="rfilters">
        <span><b>From:</b> ${invFmtDate(from)}</span>
        <span><b>To:</b> ${invFmtDate(to)}</span>
        <span><b>Receipts:</b> ${list.length}</span>
        <span><b>Total Sales:</b> Rs ${fmtMoney(tot)}</span>
      </div>
      <table class="tbl">
        <thead><tr><th>Receipt #</th><th>Date</th><th>Buyer</th><th>Items</th><th class="c">Qty</th><th class="r">Amount</th></tr></thead>
        <tbody>${list.length ? list.map(s => `<tr><td class="mono">${esc(s.no)}</td><td>${invFmtDate(s.date)}</td><td>${esc(s.buyer)}</td><td class="items">${esc(s.lines.map(l => `${l.qty}× ${l.name}`).join(', '))}</td><td class="c">${s.lines.reduce((a, l) => a + l.qty, 0)}</td><td class="r">Rs ${fmtMoney(s.total)}</td></tr>`).join('') : '<tr><td colspan="6" class="empty">No sales in this date range.</td></tr>'}</tbody>
        <tfoot><tr class="tot"><td colspan="4">Total</td><td class="c">${qty}</td><td class="r">Rs ${fmtMoney(tot)}</td></tr></tfoot>
      </table>`;
  }

  if (type === 'pos_product') {
    const agg = {};
    sales.forEach(s => s.lines.forEach(l => { const a = agg[l.name] = agg[l.name] || { qty: 0, rev: 0 }; a.qty += l.qty; a.rev += l.qty * l.price; }));
    const keys = Object.keys(agg).sort((a, b) => agg[b].rev - agg[a].rev);
    const totQ = keys.reduce((a, k) => a + agg[k].qty, 0);
    const totR = keys.reduce((a, k) => a + agg[k].rev, 0);
    return `
      <table class="tbl">
        <thead><tr><th>Product</th><th class="c">Units Sold</th><th class="r">Revenue</th></tr></thead>
        <tbody>${keys.length ? keys.map(k => `<tr><td>${esc(k)}</td><td class="c">${fmtMoney(agg[k].qty)}</td><td class="r">Rs ${fmtMoney(agg[k].rev)}</td></tr>`).join('') : '<tr><td colspan="3" class="empty">No sales recorded yet.</td></tr>'}</tbody>
        <tfoot><tr class="tot"><td>Total</td><td class="c">${fmtMoney(totQ)}</td><td class="r">Rs ${fmtMoney(totR)}</td></tr></tfoot>
      </table>`;
  }

  if (type === 'pos_lowstock') {
    const list = products.filter(p => p.stock <= p.low);
    return `
      <table class="tbl">
        <thead><tr><th>Product</th><th>Category</th><th class="c">Stock</th><th class="c">Alert Below</th><th class="r">Sell Price</th></tr></thead>
        <tbody>${list.length ? list.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.cat)}</td><td class="c">${fmtMoney(p.stock)}</td><td class="c">${fmtMoney(p.low)}</td><td class="r">Rs ${fmtMoney(p.price)}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">All products are well stocked.</td></tr>'}</tbody>
      </table>`;
  }

  if (type === 'pos_pvs') {
    const agg = {};
    sales.forEach(s => s.lines.forEach(l => { const a = agg[l.name] = agg[l.name] || { qty: 0, rev: 0 }; a.qty += l.qty; a.rev += l.qty * l.price; }));
    let tRev = 0, tCost = 0;
    const rows = Object.keys(agg).sort().map(k => {
      const p = products.find(x => x.name === k);
      const cost = (p ? p.cost : 0) * agg[k].qty;
      const rev = agg[k].rev;
      tRev += rev; tCost += cost;
      const profit = rev - cost;
      return `<tr><td>${esc(k)}</td><td class="c">${fmtMoney(agg[k].qty)}</td><td class="r">Rs ${fmtMoney(cost)}</td><td class="r">Rs ${fmtMoney(rev)}</td><td class="r" style="color:${profit >= 0 ? '#15803D' : '#B91C1C'}">Rs ${fmtMoney(profit)}</td></tr>`;
    }).join('');
    return `
      <div class="kpi-row">
        <div class="kpi a"><div class="l">Total Cost</div><div class="v">Rs ${fmtMoney(tCost)}</div><div class="m">purchase cost</div></div>
        <div class="kpi b"><div class="l">Total Sales</div><div class="v">Rs ${fmtMoney(tRev)}</div><div class="m">gross revenue</div></div>
        <div class="kpi c"><div class="l">Gross Profit</div><div class="v" style="color:${tRev - tCost >= 0 ? '#15803D' : '#B91C1C'}">Rs ${fmtMoney(tRev - tCost)}</div><div class="m">revenue − cost</div></div>
      </div>
      <table class="tbl">
        <thead><tr><th>Product</th><th class="c">Units</th><th class="r">Purchase Cost</th><th class="r">Sale Value</th><th class="r">Profit</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" class="empty">No sales recorded yet.</td></tr>'}</tbody>
        <tfoot><tr class="tot"><td colspan="2">Total</td><td class="r">Rs ${fmtMoney(tCost)}</td><td class="r">Rs ${fmtMoney(tRev)}</td><td class="r" style="color:${tRev - tCost >= 0 ? '#15803D' : '#B91C1C'}">Rs ${fmtMoney(tRev - tCost)}</td></tr></tfoot>
      </table>`;
  }

  if (type === 'pos_pnl') {
    const from = o.from || todayISO();
    const to   = o.to   || todayISO();
    const list = sales.filter(s => s.date >= from && s.date <= to);
    const agg = {};
    list.forEach(s => s.lines.forEach(l => { const a = agg[l.name] = agg[l.name] || { qty: 0, rev: 0 }; a.qty += l.qty; a.rev += l.qty * l.price; }));
    const keys = Object.keys(agg).sort((a, b) => agg[b].rev - agg[a].rev);
    let tRev = 0, tCost = 0;
    const rows = keys.map(k => {
      const p = products.find(x => x.name === k);
      const cost = (p ? p.cost : 0) * agg[k].qty;
      const rev = agg[k].rev;
      tRev += rev; tCost += cost;
      const profit = rev - cost;
      return `<tr><td>${esc(k)}</td><td class="c">${fmtMoney(agg[k].qty)}</td><td class="r">Rs ${fmtMoney(rev)}</td><td class="r">Rs ${fmtMoney(cost)}</td><td class="r" style="color:${profit >= 0 ? '#15803D' : '#B91C1C'}">Rs ${fmtMoney(profit)}</td></tr>`;
    }).join('');
    const tProfit = tRev - tCost;
    return `
      <div class="rfilters">
        <span><b>From:</b> ${invFmtDate(from)}</span>
        <span><b>To:</b> ${invFmtDate(to)}</span>
        <span><b>Receipts:</b> ${list.length}</span>
      </div>
      <table class="tbl">
        <thead><tr><th>Product</th><th class="c">Sold Qty</th><th class="r">Sale Amount</th><th class="r">Purchase Cost</th><th class="r">Profit</th></tr></thead>
        <tbody>${keys.length ? rows : '<tr><td colspan="5" class="empty">No sales in this date range.</td></tr>'}</tbody>
        <tfoot><tr class="tot"><td colspan="2">Total</td><td class="r">Rs ${fmtMoney(tRev)}</td><td class="r">Rs ${fmtMoney(tCost)}</td><td class="r" style="color:${tProfit >= 0 ? '#15803D' : '#B91C1C'}">Rs ${fmtMoney(tProfit)}</td></tr></tfoot>
      </table>
      <div class="kpi-row" style="margin-top:14px">
        <div class="kpi a"><div class="l">Total Sales</div><div class="v">Rs ${fmtMoney(tRev)}</div><div class="m">over period</div></div>
        <div class="kpi b"><div class="l">Total Costing</div><div class="v">Rs ${fmtMoney(tCost)}</div><div class="m">at purchase price</div></div>
        <div class="kpi c"><div class="l">Total Profit</div><div class="v" style="color:${tProfit >= 0 ? '#15803D' : '#B91C1C'}">Rs ${fmtMoney(tProfit)}</div><div class="m">${tProfit >= 0 ? 'surplus' : 'deficit'}</div></div>
      </div>`;
  }

  if (type === 'pos_invvalue') {
    const list = [...products].sort((a, b) => a.name < b.name ? -1 : 1);
    let tPur = 0, tSale = 0;
    const rows = list.map(p => {
      const purVal = p.stock * p.cost;
      const saleVal = p.stock * p.price;
      tPur += purVal; tSale += saleVal;
      return `<tr><td>${esc(p.name)}</td><td class="c">${fmtMoney(p.stock)}</td><td class="r">Rs ${fmtMoney(p.cost)}</td><td class="r">Rs ${fmtMoney(purVal)}</td><td class="r">Rs ${fmtMoney(p.price)}</td><td class="r">Rs ${fmtMoney(saleVal)}</td></tr>`;
    }).join('');
    const tGross = tSale - tPur;
    return `
      <div class="rfilters">
        <span><b>As of:</b> ${invFmtDate(todayISO())}</span>
        <span><b>Products:</b> ${list.length}</span>
        <span><b>Total Stock Units:</b> ${fmtMoney(list.reduce((a, p) => a + p.stock, 0))}</span>
      </div>
      <table class="tbl">
        <thead><tr><th>Product</th><th class="c">Current Stock</th><th class="r">Cost / Unit</th><th class="r">Total Purchase Value</th><th class="r">Sale / Unit</th><th class="r">Total Sale Value</th></tr></thead>
        <tbody>${list.length ? rows : '<tr><td colspan="6" class="empty">No products in stock.</td></tr>'}</tbody>
        <tfoot><tr class="tot"><td colspan="3">Total</td><td class="r">Rs ${fmtMoney(tPur)}</td><td class="r"></td><td class="r">Rs ${fmtMoney(tSale)}</td></tr></tfoot>
      </table>
      <div class="kpi-row" style="margin-top:14px">
        <div class="kpi a"><div class="l">Inventory Purchase Value</div><div class="v">Rs ${fmtMoney(tPur)}</div><div class="m">at cost</div></div>
        <div class="kpi b"><div class="l">Inventory Sale Value</div><div class="v">Rs ${fmtMoney(tSale)}</div><div class="m">at retail</div></div>
        <div class="kpi c"><div class="l">Expected Gross Profit</div><div class="v" style="color:${tGross >= 0 ? '#15803D' : '#B91C1C'}">Rs ${fmtMoney(tGross)}</div><div class="m">if all stock sells</div></div>
      </div>`;
  }

  return '';
}

/* Open the report PDF in a popup window (blue brand, A4) */
function openInvReportWindow(title, inner, toast, isBW = false) {
  const w = window.open('', '_blank');
  if (!w) { toast && toast('Please allow pop-ups to print', 'error'); return; }
  const escTitle = String(title || '').replace(/[<>&]/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m]));
  const css = `*{box-sizing:border-box;margin:0;padding:0}html,body{background:#F1F3F8}body{font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;color:#111;font-size:10.5px;line-height:1.45;padding:18px 0}.page{width:210mm;min-height:297mm;margin:0 auto;padding:14mm;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,.12)}.rhead{display:flex;align-items:center;gap:14px;border-bottom:2px solid #1E3A8A;padding-bottom:10px;margin-bottom:14px}.rlogo{width:46px;height:46px;flex-shrink:0}.rname{font-size:17px;font-weight:800;color:#0F172A;line-height:1.15}.rtitle{font-size:12px;font-weight:700;color:#1E3A8A;margin-top:3px}.meta{margin-left:auto;font-size:9.5px;color:#64748B;text-align:right;line-height:1.55}.rfilters{display:flex;flex-wrap:wrap;gap:5px 26px;font-size:11px;color:#333;margin-bottom:14px;background:#F1F5FB;padding:10px 14px;border-radius:6px}.rfilters b{color:#1E3A8A}.secttl{font-size:13px;font-weight:800;color:#1E3A8A;margin:18px 0 8px;padding-bottom:5px;border-bottom:1px solid #cdd7ea}.tbl{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;font-size:10.5px;margin-bottom:10px}.tbl thead th{background:#1E3A8A;color:#fff;padding:7px 9px;text-align:left;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.3px}.tbl th.r,.tbl td.r{text-align:right}.tbl th.c,.tbl td.c{text-align:center}.tbl tbody td{padding:6px 9px;border-bottom:1px solid #F1F3F8;vertical-align:top}.tbl tbody tr:nth-child(even) td{background:#FAFBFE}.tbl tbody tr:last-child td{border-bottom:0}.tbl td.mono{font-family:ui-monospace,Menlo,monospace;color:#1E3A8A;font-weight:800;letter-spacing:.3px}.tbl td.items{font-size:10px;color:#475569;line-height:1.5}.tbl td.empty{text-align:center;padding:24px;color:#94A3B8;font-style:italic}.tbl tfoot td{padding:8px 9px;background:#EAF0FA;font-weight:800;border-top:1.5px solid #CBD5E1;font-size:11.5px;color:#1E3A8A}.kpi-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:14px}.kpi{border:1px solid #E5E7EB;border-radius:8px;padding:9px 11px;background:#F8FAFF;position:relative;overflow:hidden}.kpi::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px}.kpi.a::before{background:linear-gradient(180deg,#1E3A8A,#1E40AF)}.kpi.b::before{background:linear-gradient(180deg,#2563EB,#60A5FA)}.kpi.c::before{background:linear-gradient(180deg,#7C3AED,#6D28D9)}.kpi.d::before{background:linear-gradient(180deg,#D97706,#B45309)}.kpi .l{font-size:9px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.3px}.kpi .v{font-size:14px;font-weight:800;color:#0F172A;margin-top:2px;font-variant-numeric:tabular-nums}.kpi .m{font-size:9px;color:#64748B;margin-top:1px}.rfoot{margin-top:18px;text-align:center;font-size:9px;color:#94A3B8;border-top:1px solid #e5e9f2;padding-top:9px}.empty-state{text-align:center;padding:30px;color:#94A3B8}@page{size:A4 portrait;margin:0}@media print{body{background:#fff;padding:0}.page{width:auto;min-height:0;margin:0;padding:14mm;box-shadow:none}.tbl tr{page-break-inside:avoid}}
/* Colorless Report — strips gradients / colored backgrounds / table-head
   fills / row striping / colored tag fills to dark-on-white with light
   gray borders. Activates when .inv-bw is present on the body. */
.inv-bw .rhead{border-bottom-color:#0F172A !important;border-bottom-width:1.5px !important;}
.inv-bw .rtitle{color:#0F172A !important;}
.inv-bw .rfilters{background:#FFFFFF !important;border:1px solid #D1D5DB !important;color:#0F172A !important;}
.inv-bw .rfilters b{color:#0F172A !important;}
.inv-bw .secttl{color:#0F172A !important;border-bottom-color:#9CA3AF !important;}
.inv-bw .tbl thead th{background:#FFFFFF !important;color:#0F172A !important;border-bottom:1.5px solid #0F172A !important;}
.inv-bw .tbl tbody tr:nth-child(even) td{background:transparent !important;}
.inv-bw .tbl tfoot td{background:#FFFFFF !important;color:#0F172A !important;border-top-color:#0F172A !important;}
.inv-bw .tbl td.mono{color:#0F172A !important;}
.inv-bw .kpi{background:#FFFFFF !important;border-color:#D1D5DB !important;}
.inv-bw .kpi::before{background:#0F172A !important;}
.inv-bw .kpi .v[style*="color"]{color:#0F172A !important;}
.inv-bw .sec-band{background:#FFFFFF !important;color:#0F172A !important;border:1.5px solid #0F172A !important;}
.inv-bw .sec-band small{color:#4B5563 !important;opacity:1 !important;}
`;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escTitle}</title><style>${css}</style></head><body${isBW ? ' class="inv-bw"' : ''}><div class="page">${inner}</div></body></html>`);
  w.document.close();
  w.onload = () => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } };
}

/* Print window with extra styles (kpi-row + sec-band) — used by sales report */
function openReportPrintWindow(title, inner, toast, isBW = false) {
  const w = window.open('', '_blank');
  if (!w) { toast && toast('Please allow pop-ups to print', 'error'); return; }
  const escTitle = String(title || '').replace(/[<>&]/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m]));
  const css = `*{box-sizing:border-box;margin:0;padding:0}html,body{background:#F1F3F8}body{font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;color:#111;font-size:10.5px;line-height:1.45;padding:18px 0}.page{width:210mm;min-height:297mm;margin:0 auto;padding:14mm;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,.12)}.rhead{display:flex;align-items:center;gap:14px;border-bottom:2px solid #16A34A;padding-bottom:10px;margin-bottom:14px}.rlogo{width:46px;height:46px;flex-shrink:0}.rname{font-size:17px;font-weight:800;color:#0F172A;line-height:1.15}.rtitle{font-size:12px;font-weight:700;color:#15803D;margin-top:3px}.meta{margin-left:auto;font-size:9.5px;color:#64748B;text-align:right;line-height:1.55}.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}.kpi{border:1px solid #E5E7EB;border-radius:8px;padding:9px 11px;background:#F8FAFF;position:relative;overflow:hidden}.kpi::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px}.kpi.a::before{background:linear-gradient(180deg,#16A34A,#15803D)}.kpi.b::before{background:linear-gradient(180deg,#1E3A8A,#1E40AF)}.kpi.c::before{background:linear-gradient(180deg,#D97706,#B45309)}.kpi.d::before{background:linear-gradient(180deg,#7C3AED,#6D28D9)}.kpi .l{font-size:9px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.3px}.kpi .v{font-size:13px;font-weight:800;color:#0F172A;margin-top:2px}.kpi .m{font-size:9px;color:#64748B;margin-top:1px}.sec-band{background:linear-gradient(135deg,#16A34A,#15803D);color:#fff;padding:8px 14px;border-radius:6px;font-weight:800;margin-bottom:10px;font-size:12px;display:flex;justify-content:space-between;align-items:center}.sec-band small{font-weight:700;opacity:.85;font-size:10px}.tbl{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;font-size:10.5px;margin-bottom:10px}.tbl thead th{background:#F8FAFF;border-bottom:1.5px solid #E5E7EB;padding:8px 9px;text-align:left;font-weight:800;color:#15803D;font-size:9.5px;text-transform:uppercase;letter-spacing:.3px}.tbl th.r,.tbl td.r{text-align:right}.tbl th.c,.tbl td.c{text-align:center}.tbl tbody td{padding:7px 9px;border-bottom:1px solid #F1F3F8;vertical-align:top}.tbl tbody tr:nth-child(even) td{background:#FBFCFF}.tbl tbody tr:last-child td{border-bottom:0}.tbl td.mono{font-family:ui-monospace,Menlo,monospace;color:#1E3A8A;font-weight:800;letter-spacing:.3px}.tbl td.items{font-size:10px;color:#475569;line-height:1.5}.tbl td.empty{text-align:center;padding:24px;color:#94A3B8;font-style:italic}.tbl tfoot td{padding:9px 9px;background:#F1F3F8;font-weight:800;color:#0F172A;border-top:1.5px solid #CBD5E1;font-size:12px}.rfoot{margin-top:14px;padding-top:8px;border-top:1px solid #e5e9f2;text-align:center;font-size:9px;color:#94A3B8}@page{size:A4 portrait;margin:0}@media print{body{background:#fff;padding:0}.page{width:auto;min-height:0;margin:0;padding:14mm;box-shadow:none}.tbl tr{page-break-inside:avoid}}
/* Colorless Report — activates only when .inv-bw is on the body. */
.inv-bw .rhead{border-bottom-color:#0F172A !important;border-bottom-width:1.5px !important;}
.inv-bw .rtitle{color:#0F172A !important;}
.inv-bw .sec-band{background:#FFFFFF !important;color:#0F172A !important;border:1.5px solid #0F172A !important;}
.inv-bw .sec-band small{color:#4B5563 !important;opacity:1 !important;}
.inv-bw .tbl thead th{background:#FFFFFF !important;color:#0F172A !important;border-bottom:1.5px solid #0F172A !important;}
.inv-bw .tbl tbody tr:nth-child(even) td{background:transparent !important;}
.inv-bw .tbl tfoot td{background:#FFFFFF !important;color:#0F172A !important;border-top-color:#0F172A !important;}
.inv-bw .tbl td.mono{color:#0F172A !important;}
.inv-bw .kpi{background:#FFFFFF !important;border-color:#D1D5DB !important;}
.inv-bw .kpi::before{background:#0F172A !important;}
.inv-bw .kpi .v[style*="color"]{color:#0F172A !important;}
`;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escTitle}</title><style>${css}</style></head><body${isBW ? ' class="inv-bw"' : ''}><div class="page">${inner}</div></body></html>`);
  w.document.close();
  w.onload = () => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } };
}

/* A4 invoice for a sale */
function buildA4InvoiceHTML(sale, school) {
  const esc = (s) => String(s ?? '').replace(/[<>&"']/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[m]));
  const qty  = sale.lines.reduce((a, l) => a + l.qty, 0);
  const sub  = sale.subtotal != null ? sale.subtotal : sale.lines.reduce((a, l) => a + l.price * l.qty, 0);
  const disc = sale.discount || 0;
  const rows = sale.lines.map((l, k) => `
    <tr>
      <td class="c">${k + 1}</td>
      <td>${esc(l.name)}</td>
      <td class="c">${l.qty}</td>
      <td class="r">Rs ${fmtMoney(l.price)}</td>
      <td class="r">Rs ${fmtMoney(l.price * l.qty)}</td>
    </tr>`).join('');
  return `
    <div class="rhead"><div class="rlogo">${schoolLogoSVG()}</div><div><div class="rname">${esc(school?.name || 'School')}</div><div class="rtitle">Sales Invoice</div></div></div>
    <div class="rfilters">
      <span><b>Receipt #:</b> ${esc(sale.no)}</span>
      <span><b>Date:</b> ${invFmtDate(sale.date)}</span>
      <span><b>Buyer:</b> ${esc(sale.buyer)}</span>
      <span><b>Served by:</b> ${esc(sale.by || 'Front Desk')}</span>
    </div>
    <table class="tbl">
      <thead><tr><th class="c" style="width:36px">#</th><th>Item</th><th class="c" style="width:50px">Qty</th><th class="r" style="width:90px">Price</th><th class="r" style="width:110px">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr class="sub"><td colspan="4" class="r">Subtotal</td><td class="r">Rs ${fmtMoney(sub)}</td></tr>
        ${disc > 0 ? `<tr class="sub" style="color:#DC2626"><td colspan="4" class="r">Discount${sale.discType === 'pct' ? ` (${sale.discInput}%)` : ''}</td><td class="r">– Rs ${fmtMoney(disc)}</td></tr>` : ''}
        <tr class="tot"><td colspan="2">Total</td><td class="c">${qty}</td><td class="r"></td><td class="r">Rs ${fmtMoney(sale.total)}</td></tr>
      </tfoot>
    </table>
    <div style="margin-top:14px;font-size:11px;color:#555">Thank you for your purchase. Please keep this receipt for your records.</div>
    <div class="rfoot">Generated on ${invFmtDate(todayISO())} · School Mentor ERP — POS</div>`;
}

/* Override openPrintWindow with extra report styles (used by A4 invoice). */
function openInvoicePrintWindow(title, inner, toast) {
  const w = window.open('', '_blank');
  if (!w) { toast && toast('Please allow pop-ups to print', 'error'); return; }
  const escTitle = String(title || '').replace(/[<>&]/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m]));
  const css = `*{box-sizing:border-box;margin:0;padding:0}html,body{background:#F1F3F8}body{font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;color:#111;font-size:11px;line-height:1.45;padding:18px 0}.page{width:210mm;min-height:297mm;margin:0 auto;padding:16mm;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,.12)}.rhead{display:flex;align-items:center;gap:14px;border-bottom:2px solid #1E3A8A;padding-bottom:12px;margin-bottom:14px}.rlogo{width:46px;height:46px;flex-shrink:0}.rname{font-size:18px;font-weight:800;color:#1E3A8A;line-height:1.15}.rtitle{font-size:12.5px;font-weight:600;color:#555;margin-top:3px}.rfilters{display:flex;flex-wrap:wrap;gap:5px 26px;font-size:11px;color:#333;margin-bottom:14px;background:#F1F5FB;padding:10px 14px;border-radius:6px}.rfilters b{color:#1E3A8A}.tbl{width:100%;border-collapse:collapse;font-size:10.5px;margin-bottom:10px}.tbl th{background:#1E3A8A;color:#fff;padding:7px 8px;text-align:left;font-weight:700}.tbl th.r,.tbl td.r{text-align:right}.tbl th.c,.tbl td.c{text-align:center}.tbl td{padding:6px 8px;border-bottom:1px solid #e5e9f2;vertical-align:top}.tbl tr:nth-child(even) td{background:#FAFBFE}.tot td{background:#EAF0FA;font-weight:800;border-top:2px solid #1E3A8A;font-size:12px;color:#1E3A8A}.sub td{background:#F6F9FE;font-weight:700}.rfoot{margin-top:20px;text-align:center;font-size:9.5px;color:#999;border-top:1px solid #e5e9f2;padding-top:9px}@page{size:A4 portrait;margin:0}@media print{body{background:#fff;padding:0}.page{width:auto;min-height:0;margin:0;padding:14mm;box-shadow:none}}`;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escTitle}</title><style>${css}</style></head><body><div class="page">${inner}</div></body></html>`);
  w.document.close();
  w.onload = () => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } };
}

/* 80mm thermal receipt — opens its own popup with thermal CSS */
function openThermalPrintWindow(sale, school, toast) {
  const w = window.open('', '_blank');
  if (!w) { toast && toast('Please allow pop-ups to print', 'error'); return; }
  const esc = (s) => String(s ?? '').replace(/[<>&"']/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[m]));
  const qty  = sale.lines.reduce((a, l) => a + l.qty, 0);
  const sub  = sale.subtotal != null ? sale.subtotal : sale.lines.reduce((a, l) => a + l.price * l.qty, 0);
  const disc = sale.discount || 0;
  const lines = sale.lines.map(l => `
    <div class="ti">
      <div class="tn">${esc(l.name)}</div>
      <div class="tq">${l.qty} × ${fmtMoney(l.price)}</div>
      <div class="ta">${fmtMoney(l.price * l.qty)}</div>
    </div>`).join('');
  const css = `*{box-sizing:border-box;margin:0;padding:0}html,body{background:#fff}body{font-family:'Plus Jakarta Sans',-apple-system,Arial,sans-serif;color:#000;font-size:12px;line-height:1.4}.slip{width:80mm;margin:0 auto;padding:6mm 5mm}.tc{text-align:center}.tname{font-size:15px;font-weight:800;letter-spacing:.3px}.tsub{font-size:10.5px;color:#333;margin-top:2px}.hr{border:none;border-top:1px dashed #000;margin:8px 0}.meta{font-size:11px;display:flex;justify-content:space-between;margin:2px 0}.ti{display:grid;grid-template-columns:1fr auto;gap:0 8px;margin:5px 0}.tn{grid-column:1/3;font-weight:700;font-size:11.5px}.tq{color:#333;font-size:11px}.ta{text-align:right;font-weight:700;font-size:11.5px}.tt{display:flex;justify-content:space-between;font-size:12px;margin:3px 0}.tt.g{font-size:15px;font-weight:800;border-top:2px solid #000;padding-top:5px;margin-top:5px}.foot{text-align:center;font-size:10.5px;margin-top:10px;color:#222}@page{size:80mm auto;margin:0}@media print{.slip{width:auto;padding:3mm}}`;
  const inner = `
    <div class="tc"><div class="tname">${esc(school?.name || 'School')}</div><div class="tsub">Sales Receipt</div></div>
    <hr class="hr">
    <div class="meta"><span>Receipt #</span><span>${esc(sale.no)}</span></div>
    <div class="meta"><span>Date</span><span>${invFmtDate(sale.date)}</span></div>
    <div class="meta"><span>Buyer</span><span>${esc(sale.buyer)}</span></div>
    <div class="meta"><span>Served by</span><span>${esc(sale.by || 'Front Desk')}</span></div>
    <hr class="hr">
    ${lines}
    <hr class="hr">
    <div class="tt"><span>Subtotal (${qty} item${qty !== 1 ? 's' : ''})</span><span>Rs ${fmtMoney(sub)}</span></div>
    ${disc > 0 ? `<div class="tt"><span>Discount${sale.discType === 'pct' ? ` (${sale.discInput}%)` : ''}</span><span>– Rs ${fmtMoney(disc)}</span></div>` : ''}
    <div class="tt g"><span>TOTAL</span><span>Rs ${fmtMoney(sale.total)}</span></div>
    <hr class="hr">
    <div class="foot">Thank you for your purchase!<br>Generated on ${invFmtDate(todayISO())}<br>School Mentor ERP — POS</div>`;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt ${esc(sale.no)}</title><style>${css}</style></head><body><div class="slip">${inner}</div></body></html>`);
  w.document.close();
  w.onload = () => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } };
}

/* ═══════════════════════════════════════════════════════════════════
   INVENTORY MODULE — shell + 3 main tabs.
   Ported from ~/Desktop/ERP-HTML/Inventory Module .html

   Step 1 (this turn): page header + 3 main tabs (Inventory Management
   / Point of Sale / Reports) with Coming Soon bodies, mock data +
   service layer in place.

   Subsequent steps:
     2. Inventory Management — items grid + detail + modals
     3. POS Sell view (cart + checkout + A4 invoice)
     4. POS Products + Sales subtabs
     5. Reports — 12 report types with A4 PDFs
   ═══════════════════════════════════════════════════════════════════ */

const INV_TABS = [
  { id: 'manage',  icon: 'fa-warehouse',     label: 'Inventory Management' },
  { id: 'pos',     icon: 'fa-cash-register', label: 'Point of Sale' },
  { id: 'reports', icon: 'fa-chart-column',  label: 'Reports' },
];

export default function Inventory({ toast }) {
  const [tab, setTab] = useState('manage');
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const activeMeta = INV_TABS.find(t => t.id === tab);

  return (
    <>
      <style>{INV_CSS}</style>

      {/* Page header — module title, brand-gradient icon, Tutorial CTA */}
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}>
            <i className="fa-solid fa-boxes-stacked"></i>
          </div>
          <div>
            <div className="page-title">Inventory</div>
            <div className="page-sub">School assets, a simple shop counter &amp; printable reports</div>
          </div>
        </div>
        <Tooltip text="Play a short tutorial for the Inventory module">
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
        {INV_TABS.map(t => (
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

      {tab === 'manage' ? (
        <InventoryManagement toast={toast} />
      ) : tab === 'pos' ? (
        <PointOfSale toast={toast} />
      ) : tab === 'reports' ? (
        <InvReports toast={toast} />
      ) : (
        <InvComingSoon
          label={activeMeta?.label || 'This screen'}
          icon={activeMeta?.icon || 'fa-hammer'}
        />
      )}

      <TutorialModal
        open={tutorialOpen}
        moduleKey="inventory"
        onClose={() => setTutorialOpen(false)}
        toast={toast}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   INVENTORY MANAGEMENT — physical school assets with barcodes &
   history. Two views (list / detail), Active/Inactive segment,
   Add/Edit modal, and a single confirm dialog for mark-inactive &
   permanent-delete.
   ═══════════════════════════════════════════════════════════════════ */
function InventoryManagement({ toast }) {
  const { data: serverItems = [] } = useAsync(inventoryService.getInvItems, []);
  const { data: categories = [] }  = useAsync(inventoryService.getInvCategories, []);
  const { data: school = {} }      = useAsync(inventoryService.getInvSchool, {});
  const { data: serverNextId = 100 } = useAsync(inventoryService.getInvNextItemId, 100);

  /* Local mutable mirror — service returns clones so we can edit
     in-place without affecting the seed for the next caller. */
  const [items, setItems] = useState(null);
  useEffect(() => { if (serverItems.length && items == null) setItems(serverItems); }, [serverItems, items]);
  const list = useMemo(() => items || [], [items]);

  const [nextId, setNextId] = useState(null);
  useEffect(() => { if (nextId == null && serverNextId) setNextId(serverNextId); }, [serverNextId, nextId]);

  /* View state */
  const [seg, setSeg]                 = useState('active');
  const [search, setSearch]           = useState('');
  const [catFilter, setCatFilter]     = useState('all');
  const [statusFilter, setStatusFlt]  = useState('all');
  const [detailId, setDetailId]       = useState(null);
  const [editCfg, setEditCfg]         = useState(null);   // {mode:'add'|'edit', item?}
  const [confirmCfg, setConfirmCfg]   = useState(null);   // {kind, item, onYes}
  const [printTarget, setPrintTarget] = useState(null);   // {code, name, cat, loc}

  /* Filtered list */
  const filtered = useMemo(() => {
    let out = list.filter(i => i.active === (seg === 'active'));
    if (catFilter !== 'all')    out = out.filter(i => i.cat === catFilter);
    if (statusFilter !== 'all') out = out.filter(i => i.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      out = out.filter(i => `${i.name} ${i.code} ${i.loc} ${i.cat}`.toLowerCase().includes(q));
    }
    return out;
  }, [list, seg, catFilter, statusFilter, search]);

  /* Overview stats — only count ACTIVE items */
  const stats = useMemo(() => {
    const actives    = list.filter(i => i.active);
    const totalItems = actives.reduce((a, i) => a + i.qty, 0);
    const activeCnt  = actives.length;
    const catCnt     = new Set(actives.map(i => i.cat)).size;
    return { totalItems, activeCnt, catCnt };
  }, [list]);

  const detailItem = detailId ? list.find(i => i.id === detailId) : null;

  /* ─── Actions ─── */
  const handleSave = ({ name, cat, code, qty, date, cond, status, loc, desc, img }) => {
    if (!name.trim()) { toast('Please enter an item name', 'error'); return; }
    if ((Number(qty) || 0) < 1) { toast('Quantity must be at least 1', 'error'); return; }
    const finalCode = (code || '').trim() || genItemCode(name, cat, list);

    if (editCfg?.mode === 'edit' && editCfg.item) {
      setItems(prev => prev.map(i => i.id === editCfg.item.id
        ? {
            ...i,
            name: name.trim(), cat, code: finalCode, qty: Number(qty) || 0,
            date, cond, status, loc: loc.trim(), desc: desc.trim(),
            img: img ?? i.img,
            history: [...(i.history || []), { t: 'Item details updated', at: todayISO() }],
          }
        : i));
      toast('Item updated successfully', 'success');
    } else {
      const id = nextId || 100;
      setNextId(id + 1);
      setItems(prev => [
        ...(prev || []),
        {
          id, active: true,
          name: name.trim(), cat, code: finalCode, qty: Number(qty) || 0,
          low: 0, date, cond, status, loc: loc.trim(), desc: desc.trim(),
          img: img ?? null,
          history: [{ t: 'Item added to inventory', at: todayISO() }],
        },
      ]);
      toast('Item added successfully', 'success');
    }
    setEditCfg(null);
  };

  const askMarkInactive = (item) => setConfirmCfg({
    kind: 'inactive', item,
    onYes: () => {
      setItems(prev => prev.map(i => i.id === item.id
        ? { ...i, active: false, history: [...(i.history || []), { t: 'Marked Inactive', at: todayISO() }] }
        : i));
      toast('Item marked inactive', 'info');
      setConfirmCfg(null);
      if (detailId === item.id) setDetailId(null);
    },
  });

  const restore = (item) => {
    setItems(prev => prev.map(i => i.id === item.id
      ? { ...i, active: true, history: [...(i.history || []), { t: 'Restored to active', at: todayISO() }] }
      : i));
    toast('Item restored to active', 'success');
  };

  const askDelete = (item) => setConfirmCfg({
    kind: 'delete', item,
    onYes: () => {
      setItems(prev => prev.filter(i => i.id !== item.id));
      toast('Item permanently deleted', 'info');
      setConfirmCfg(null);
      if (detailId === item.id) setDetailId(null);
    },
  });

  const openPrintFor = (item) => setPrintTarget({
    code: item.code, name: item.name, cat: item.cat, loc: item.loc,
  });

  /* ─── DETAIL VIEW ─── */
  if (detailItem) {
    return (
      <>
        <InvItemDetail
          item={detailItem}
          onBack={() => setDetailId(null)}
          onEdit={() => setEditCfg({ mode: 'edit', item: detailItem })}
          onPrintLabel={() => openPrintFor(detailItem)}
          onToggle={() => detailItem.active ? askMarkInactive(detailItem) : restore(detailItem)}
          onDelete={() => askDelete(detailItem)}
        />
        {printTarget && (
          <InvBarcodeSizeModal
            target={printTarget}
            school={school}
            onClose={() => setPrintTarget(null)}
            toast={toast}
          />
        )}
        {editCfg && (
          <InvItemModal
            cfg={editCfg}
            categories={categories}
            existingItems={list}
            onClose={() => setEditCfg(null)}
            onSave={handleSave}
            toast={toast}
          />
        )}
        {confirmCfg && (
          <InvConfirmDialog
            cfg={confirmCfg}
            onClose={() => setConfirmCfg(null)}
          />
        )}
      </>
    );
  }

  /* ─── LIST VIEW ─── */
  return (
    <>
      {/* Overview banner */}
      <div className="acc-overview">
        <div className="acc-overview-main">
          <div className="acc-overview-icon"><i className="fa-solid fa-warehouse"></i></div>
          <div className="acc-overview-text">
            <div className="acc-overview-title">Inventory Management</div>
            <div className="acc-overview-sub">
              Keep a record of every <strong>physical item</strong> in your school — furniture, equipment, lab &amp; sports gear.
              Generate inventory numbers and print barcode labels to paste on each item.
            </div>
          </div>
        </div>
        <div className="acc-overview-stats">
          <div className="acc-ov-stat">
            <div className="acc-ov-stat-ic all"><i className="fa-solid fa-boxes-stacked"></i></div>
            <div>
              <div className="acc-ov-stat-val">{fmtMoney(stats.totalItems)}</div>
              <div className="acc-ov-stat-lbl">Total Items</div>
            </div>
          </div>
          <div className="acc-ov-stat">
            <div className="acc-ov-stat-ic rev"><i className="fa-solid fa-box"></i></div>
            <div>
              <div className="acc-ov-stat-val">{stats.activeCnt}</div>
              <div className="acc-ov-stat-lbl">Active Records</div>
            </div>
          </div>
          <div className="acc-ov-stat">
            <div className="acc-ov-stat-ic exp" style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}>
              <i className="fa-solid fa-layer-group"></i>
            </div>
            <div>
              <div className="acc-ov-stat-val">{stats.catCnt}</div>
              <div className="acc-ov-stat-lbl">Categories</div>
            </div>
          </div>
        </div>
      </div>

      {/* How-to steps */}
      <div className="acc-steps">
        <div className="acc-step">
          <div className="acc-step-no">1</div>
          <div>
            <div className="acc-step-title"><i className="fa-solid fa-plus"></i> Add Item</div>
            <div className="acc-step-desc">Add furniture, equipment &amp; other school assets.</div>
          </div>
        </div>
        <div className="acc-step">
          <div className="acc-step-no">2</div>
          <div>
            <div className="acc-step-title"><i className="fa-solid fa-barcode"></i> Print Label</div>
            <div className="acc-step-desc">Stick the barcode label on each physical item.</div>
          </div>
        </div>
        <div className="acc-step">
          <div className="acc-step-no">3</div>
          <div>
            <div className="acc-step-title"><i className="fa-solid fa-circle-check"></i> Track</div>
            <div className="acc-step-desc">View details, status &amp; history anytime.</div>
          </div>
        </div>
      </div>

      {/* Subbar */}
      <div className="inv-subbar">
        <div className="inv-subbar-title"><i className="fa-solid fa-boxes-stacked"></i> All Inventory Items</div>
        <div className="inv-subbar-spacer"></div>
        <Tooltip text="Create a new inventory item">
          <button className="fee-btn fee-btn-primary" onClick={() => setEditCfg({ mode: 'add' })}>
            <i className="fa-solid fa-plus"></i> Add Inventory Item
          </button>
        </Tooltip>
      </div>

      {/* Active / Inactive segment */}
      <div className="fee-seg">
        <button
          className={`fee-seg-btn${seg === 'active' ? ' active' : ''}`}
          onClick={() => setSeg('active')}
        >
          <i className="fa-solid fa-circle-check"></i> Active Items
        </button>
        <button
          className={`fee-seg-btn${seg === 'inactive' ? ' active' : ''}`}
          onClick={() => setSeg('inactive')}
        >
          <i className="fa-solid fa-circle-pause"></i> Inactive Items
        </button>
      </div>

      {/* Help banner */}
      <div className="fee-info">
        <i className="fa-solid fa-circle-info"></i>
        {seg === 'active'
          ? <span> Click any item to view its full details, barcode label and history. To remove an item, first <strong>Mark Inactive</strong> — it can only be permanently deleted from the Inactive Items tab.</span>
          : <span> These items are retired from active use. You can <strong>restore</strong> an item back to active, or <strong>permanently delete</strong> it from here.</span>}
      </div>

      {/* Filters */}
      <div className="fee-section fee-section--filters">
        <div className="fee-section-body">
          <div className="inv-toolbar">
            <div className="fee-field fee-field--grow">
              <span className="fee-label">Search</span>
              <div className="fee-search-box">
                <i className="fa-solid fa-magnifying-glass"></i>
                <input
                  className="fee-search-input"
                  placeholder="Search by name, inventory number or location"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoComplete="off"
                />
                {search && (
                  <Tooltip text="Clear search">
                    <button className="fee-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>
            <div className="fee-field">
              <span className="fee-label">Category</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
                  <option value="all">All Categories</option>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
            <div className="fee-field">
              <span className="fee-label">Status</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={statusFilter} onChange={(e) => setStatusFlt(e.target.value)}>
                  <option value="all">All Status</option>
                  <option>In Use</option>
                  <option>In Store</option>
                  <option>Under Repair</option>
                  <option>Damaged</option>
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card grid */}
      {filtered.length === 0 ? (
        <div className="fee-section">
          <div className="fee-section-body">
            <div className="inv-empty">
              <div className="inv-empty-ic"><i className="fa-solid fa-box-open"></i></div>
              <div className="inv-empty-title">No items found</div>
              <div className="inv-empty-sub">
                {search || catFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try changing your search or filters.'
                  : 'Add your first inventory item to get started.'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="inv-grid">
          {filtered.map(i => (
            <InvItemCard
              key={i.id}
              item={i}
              onOpen={() => setDetailId(i.id)}
              onEdit={() => setEditCfg({ mode: 'edit', item: i })}
              onMarkInactive={() => askMarkInactive(i)}
              onRestore={() => restore(i)}
              onDelete={() => askDelete(i)}
            />
          ))}
        </div>
      )}

      {/* Item Add/Edit modal */}
      {editCfg && (
        <InvItemModal
          cfg={editCfg}
          categories={categories}
          existingItems={list}
          onClose={() => setEditCfg(null)}
          onSave={handleSave}
          toast={toast}
        />
      )}

      {/* Confirm dialog */}
      {confirmCfg && (
        <InvConfirmDialog
          cfg={confirmCfg}
          onClose={() => setConfirmCfg(null)}
        />
      )}
    </>
  );
}

/* ─── Item card (grid tile) ─── */
function InvItemCard({ item, onOpen, onEdit, onMarkInactive, onRestore, onDelete }) {
  return (
    <div className={`inv-card${item.active ? '' : ' inactive'}`} onClick={onOpen}>
      <div className="inv-card-img">
        {item.img ? <img src={item.img} alt={item.name} /> : <i className={`fa-solid ${catIcon(item.cat)}`}></i>}
        <div className="inv-card-statusbadge">
          <span className={`inv-pill ${statusPillClass(item.status)}`}>{item.status}</span>
        </div>
      </div>
      <div className="inv-card-body">
        <div className="inv-card-name">{item.name}</div>
        <div className="inv-card-code">{item.code}</div>
        <div className="inv-card-meta">
          <span><i className="fa-solid fa-hashtag"></i> Qty: <strong>{fmtMoney(item.qty)}</strong></span>
          <span><i className="fa-solid fa-location-dot"></i> {item.loc || '—'}</span>
        </div>
      </div>
      <div className="inv-card-foot" onClick={(e) => e.stopPropagation()}>
        <Tooltip text="View full details">
          <button className="fee-btn fee-btn-ghost fee-btn-xs" style={{ flex: 1 }} onClick={onOpen}>
            <i className="fa-solid fa-eye"></i> View
          </button>
        </Tooltip>
        {item.active ? (
          <>
            <Tooltip text="Edit this item">
              <button className="fee-btn fee-btn-ghost fee-btn-xs" onClick={onEdit} aria-label="Edit this item">
                <i className="fa-solid fa-pen"></i>
              </button>
            </Tooltip>
            <Tooltip text="Mark Inactive">
              <button className="fee-btn fee-btn-ghost fee-btn-xs fee-m-danger" onClick={onMarkInactive} aria-label="Mark Inactive">
                <i className="fa-solid fa-circle-pause"></i>
              </button>
            </Tooltip>
          </>
        ) : (
          <>
            <Tooltip text="Restore to active">
              <button className="fee-btn fee-btn-ghost fee-btn-xs" onClick={onRestore} aria-label="Restore to active">
                <i className="fa-solid fa-rotate-left"></i>
              </button>
            </Tooltip>
            <Tooltip text="Delete permanently">
              <button className="fee-btn fee-btn-ghost fee-btn-xs fee-m-danger" onClick={onDelete} aria-label="Delete permanently">
                <i className="fa-solid fa-trash-can"></i>
              </button>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Item detail view ─── */
function InvItemDetail({ item, onBack, onEdit, onPrintLabel, onToggle, onDelete }) {
  const history = (item.history || []).slice().reverse();
  return (
    <>
      <div className="inv-subbar">
        <Tooltip text="Back to all items">
          <button className="fee-btn fee-btn-ghost fee-btn-sm" onClick={onBack}>
            <i className="fa-solid fa-arrow-left"></i> All Items
          </button>
        </Tooltip>
        <div className="inv-subbar-title">
          <i className={`fa-solid ${catIcon(item.cat)}`}></i> {item.name}
        </div>
        <div className="inv-subbar-spacer"></div>
        <Tooltip text="Print the printable barcode label">
          <button className="fee-btn fee-btn-ghost fee-btn-sm" onClick={onPrintLabel}>
            <i className="fa-solid fa-barcode"></i> Print Barcode
          </button>
        </Tooltip>
        <Tooltip text="Edit this item">
          <button className="fee-btn fee-btn-ghost fee-btn-sm" onClick={onEdit}>
            <i className="fa-solid fa-pen"></i> Edit
          </button>
        </Tooltip>
        <Tooltip text={item.active ? 'Move to Inactive Items' : 'Restore to active'}>
          <button className="fee-btn fee-btn-ghost fee-btn-sm fee-m-danger" onClick={onToggle}>
            <i className={`fa-solid ${item.active ? 'fa-circle-pause' : 'fa-rotate-left'}`}></i>
            {' '}{item.active ? 'Mark Inactive' : 'Restore'}
          </button>
        </Tooltip>
        {!item.active && (
          <Tooltip text="Delete permanently">
            <button className="fee-btn fee-btn-ghost fee-btn-sm fee-m-danger" onClick={onDelete}>
              <i className="fa-solid fa-trash-can"></i> Delete
            </button>
          </Tooltip>
        )}
      </div>

      <div className="inv-detail-grid">
        {/* Left — image + barcode + print button */}
        <div className="inv-detail-imgcard">
          <div className="inv-detail-img">
            {item.img
              ? <img src={item.img} alt={item.name} />
              : <i className={`fa-solid ${catIcon(item.cat)}`}></i>}
          </div>
          <div className="inv-detail-imgcard-body">
            <div className="inv-detail-pills">
              <span className={`inv-pill ${statusPillClass(item.status)}`}>{item.status}</span>
              <span className={`inv-pill ${item.active ? 'inv-pill-green' : 'inv-pill-grey'}`}>
                {item.active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="inv-barcode-box">
              <div
                className="inv-barcode-svgwrap"
                dangerouslySetInnerHTML={{ __html: barcodeSVG(item.code) }}
              />
              <div className="inv-barcode-code">{item.code}</div>
            </div>
            <div className="inv-barcode-printrow">
              <button className="fee-btn fee-btn-primary fee-btn-sm" onClick={onPrintLabel}>
                <i className="fa-solid fa-print"></i> Print Barcode Label
              </button>
            </div>
          </div>
        </div>

        {/* Right — facts + history */}
        <div>
          <div className="inv-detail-rows">
            <div className="inv-detail-row">
              <div className="inv-detail-row-lbl">Inventory Number</div>
              <div className="inv-detail-row-val inv-detail-mono">{item.code}</div>
            </div>
            <div className="inv-detail-row">
              <div className="inv-detail-row-lbl">Category</div>
              <div className="inv-detail-row-val">{item.cat}</div>
            </div>
            <div className="inv-detail-row">
              <div className="inv-detail-row-lbl">Quantity</div>
              <div className="inv-detail-row-val">{fmtMoney(item.qty)}</div>
            </div>
            <div className="inv-detail-row">
              <div className="inv-detail-row-lbl">Location / Room</div>
              <div className="inv-detail-row-val">{item.loc || '—'}</div>
            </div>
            <div className="inv-detail-row">
              <div className="inv-detail-row-lbl">Condition</div>
              <div className="inv-detail-row-val">{item.cond || '—'}</div>
            </div>
            <div className="inv-detail-row">
              <div className="inv-detail-row-lbl">Status</div>
              <div className="inv-detail-row-val">{item.status}</div>
            </div>
            <div className="inv-detail-row">
              <div className="inv-detail-row-lbl">Purchase Date</div>
              <div className="inv-detail-row-val">{invFmtDate(item.date)}</div>
            </div>
            <div className="inv-detail-row full">
              <div className="inv-detail-row-lbl">Description</div>
              <div className="inv-detail-row-val inv-detail-desc">{item.desc || '—'}</div>
            </div>
          </div>

          <div className="fee-section" style={{ marginTop: 16 }}>
            <div className="fee-section-header">
              <div className="fee-section-title">
                <div className="fee-section-icon"><i className="fa-solid fa-clock-rotate-left"></i></div>
                <div>
                  <div className="fee-section-name">History</div>
                  <div className="fee-section-sub">Activity log for this item</div>
                </div>
              </div>
            </div>
            <div className="fee-section-body">
              {history.length === 0 ? (
                <div className="inv-history-empty">No history yet.</div>
              ) : history.map((h, idx) => (
                <div key={idx} className="inv-history-item">
                  <div className="inv-history-dot"><i className="fa-solid fa-circle-dot"></i></div>
                  <div>
                    <div className="inv-history-txt">{h.t}</div>
                    <div className="inv-history-time">
                      <i className="fa-solid fa-calendar"></i> {invFmtDate(h.at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Item Add / Edit modal ─── */
function InvItemModal({ cfg, categories, existingItems, onClose, onSave, toast }) {
  const isEdit = cfg?.mode === 'edit';
  const base   = isEdit ? cfg.item : null;
  const fileRef = useRef(null);

  const [name, setName]     = useState(base?.name || '');
  const [cat, setCat]       = useState(base?.cat  || categories[0] || 'Other');
  const [code, setCode]     = useState(base?.code || '');
  const [qty, setQty]       = useState(base?.qty != null ? String(base.qty) : '1');
  const [date, setDate]     = useState(base?.date || todayISO());
  const [cond, setCond]     = useState(base?.cond || 'Good');
  const [status, setStatus] = useState(base?.status || 'In Use');
  const [loc, setLoc]       = useState(base?.loc  || '');
  const [desc, setDesc]     = useState(base?.desc || '');
  const [img, setImg]       = useState(base?.img  || null);

  useEffect(() => {
    if (!isEdit && !cat && categories.length) setCat(categories[0]);
  }, [categories, cat, isEdit]);

  /* esc + body scroll lock */
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      toast('Image too large (max 2 MB)', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImg(reader.result);
    reader.readAsDataURL(f);
  };

  const handleSubmit = () => onSave({ name, cat, code, qty, date, cond, status, loc, desc, img });

  return createPortal(
    <div className="fee-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fee-modal lg">
        <div className="fee-modal-head">
          <div className="fee-modal-head-title">
            <div className="fee-modal-head-icon"><i className="fa-solid fa-box"></i></div>
            <div>
              <div className="fee-modal-title">{isEdit ? 'Edit Inventory Item' : 'Add Inventory Item'}</div>
              <div className="fee-modal-sub">{isEdit ? (base?.code || 'Item') : 'Enter the item details below'}</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="fee-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
          </Tooltip>
        </div>

        <div className="fee-modal-body">
          <div className="inv-form-grid">
            <div className="fee-field full">
              <span className="fee-label">Item Name *</span>
              <input className="fee-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Student Chair" />
            </div>

            <div className="fee-field">
              <span className="fee-label">Category *</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={cat} onChange={(e) => setCat(e.target.value)}>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>

            <div className="fee-field">
              <span className="fee-label">Inventory Number</span>
              <input className="fee-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Auto-generated if left empty" />
              <div className="fee-hint">
                <i className="fa-solid fa-wand-magic-sparkles"></i> Leave empty to auto-generate (e.g. INV-CHAIR-001)
              </div>
            </div>

            <div className="fee-field">
              <span className="fee-label">Quantity *</span>
              <input className="fee-input" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>

            <div className="fee-field">
              <span className="fee-label">Purchase Date</span>
              <input className="fee-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            <div className="fee-field">
              <span className="fee-label">Condition</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={cond} onChange={(e) => setCond(e.target.value)}>
                  <option>New</option>
                  <option>Good</option>
                  <option>Fair</option>
                  <option>Poor</option>
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>

            <div className="fee-field">
              <span className="fee-label">Status</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option>In Use</option>
                  <option>In Store</option>
                  <option>Under Repair</option>
                  <option>Damaged</option>
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>

            <div className="fee-field">
              <span className="fee-label">Location / Room</span>
              <input className="fee-input" value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="e.g. Classroom 5-B" />
            </div>

            <div className="fee-field full">
              <span className="fee-label">Description</span>
              <textarea className="fee-input" rows="2" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional notes about this item"></textarea>
            </div>

            <div className="fee-field full">
              <span className="fee-label">Item Picture</span>
              <div className="inv-upload" onClick={() => fileRef.current && fileRef.current.click()}>
                {img ? (
                  <img src={img} alt="preview" className="inv-upload-preview" />
                ) : (
                  <div className="inv-upload-empty">
                    <i className="fa-solid fa-cloud-arrow-up"></i>
                    <div className="inv-upload-lbl">Click to upload a photo</div>
                    <div className="inv-upload-hint">JPG or PNG · optional</div>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
              <div className="fee-hint">
                <i className="fa-solid fa-circle-info"></i>
                The picture appears on this item's card in the inventory grid and at the top of its detail page.
              </div>
              {img && (
                <button type="button" className="fee-btn fee-btn-ghost fee-btn-xs" style={{ marginTop: 6 }} onClick={(e) => { e.stopPropagation(); setImg(null); }}>
                  <i className="fa-solid fa-xmark"></i> Remove image
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="fee-modal-foot">
          <Tooltip text="Discard changes">
            <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
          </Tooltip>
          <Tooltip text={isEdit ? 'Update item' : 'Save new item'}>
            <button className="fee-btn fee-btn-primary" onClick={handleSubmit}>
              <i className="fa-solid fa-floppy-disk"></i> Save Item
            </button>
          </Tooltip>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ─── Confirm dialog (mark inactive / permanent delete) ─── */
function InvConfirmDialog({ cfg, onClose }) {
  const { kind, item, onYes } = cfg;
  const isInactive = kind === 'inactive';
  const grad = isInactive ? 'linear-gradient(135deg,#D97706,#B45309)' : 'linear-gradient(135deg,#DC2626,#B91C1C)';
  const icon = isInactive ? 'fa-circle-pause' : 'fa-trash-can';
  const title = isInactive ? 'Mark item Inactive?' : 'Delete permanently?';
  const btnLbl = isInactive ? 'Mark Inactive' : 'Delete Forever';
  const msg = isInactive
    ? <span>"<strong>{item.name}</strong>" will be moved to the Inactive Items tab. It will not be deleted — you can restore it anytime.</span>
    : <span>"<strong>{item.name}</strong>" (<code>{item.code}</code>) will be permanently removed. This cannot be undone.</span>;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return createPortal(
    <div className="fee-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fee-modal sm">
        <div className="fee-modal-head">
          <div className="fee-modal-head-title">
            <div className="fee-modal-head-icon" style={{ background: grad }}>
              <i className={`fa-solid ${icon}`}></i>
            </div>
            <div>
              <div className="fee-modal-title">{title}</div>
              <div className="fee-modal-sub">This action needs confirmation</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="fee-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
          </Tooltip>
        </div>
        <div className="fee-modal-body">
          <p className="inv-confirm-msg">{msg}</p>
        </div>
        <div className="fee-modal-foot">
          <Tooltip text="Cancel">
            <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
          </Tooltip>
          <Tooltip text={btnLbl}>
            <button
              className="fee-btn fee-btn-primary"
              style={{ background: grad, boxShadow: isInactive ? '0 4px 14px rgba(217,119,6,.28)' : '0 4px 14px rgba(220,38,38,.28)' }}
              onClick={onYes}
            >
              <i className="fa-solid fa-check"></i> {btnLbl}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ═══════════════════════════════════════════════════════════════════
   POINT OF SALE — school shop counter. Three sub-tabs:
     • New Sale       — products + cart + checkout (this step)
     • Products       — manage shop products    (step 4)
     • Sales History  — receipts + reprint      (step 4)
   ═══════════════════════════════════════════════════════════════════ */
const POS_SUBTABS = [
  { id: 'sell',     icon: 'fa-cart-shopping', label: 'New Sale' },
  { id: 'products', icon: 'fa-box-open',      label: 'Products' },
  { id: 'sales',    icon: 'fa-receipt',       label: 'Sales History' },
];

function PointOfSale({ toast }) {
  const { data: serverProducts = [] }     = useAsync(inventoryService.getInvProducts, []);
  const { data: serverSales = [] }        = useAsync(inventoryService.getInvSales, []);
  const { data: serverNextReceipt = 1018 } = useAsync(inventoryService.getInvNextReceiptNo, 1018);
  const { data: school = {} }             = useAsync(inventoryService.getInvSchool, {});

  /* Local mutable mirrors */
  const [products, setProducts] = useState(null);
  useEffect(() => { if (serverProducts.length && products == null) setProducts(serverProducts); }, [serverProducts, products]);

  const [sales, setSales] = useState(null);
  useEffect(() => { if (serverSales.length && sales == null) setSales(serverSales); }, [serverSales, sales]);

  const [nextReceipt, setNextReceipt] = useState(null);
  useEffect(() => { if (nextReceipt == null && serverNextReceipt) setNextReceipt(serverNextReceipt); }, [serverNextReceipt, nextReceipt]);

  const productList = useMemo(() => products || [], [products]);
  const saleList    = useMemo(() => sales    || [], [sales]);

  /* Sub-tab state */
  const [sub, setSub] = useState('sell');
  const subMeta = POS_SUBTABS.find(t => t.id === sub);

  /* Stats */
  const stats = useMemo(() => {
    const today = todayISO();
    const todayTotal = saleList.filter(s => s.date === today).reduce((a, s) => a + s.total, 0);
    const lowProducts = productList.filter(p => p.stock <= p.low).length;
    return { products: productList.length, todayTotal, lowProducts };
  }, [productList, saleList]);

  /* Sale handler — used by PosSellView's checkout flow */
  const finalizeSale = ({ cart, buyer, discAmount, discType, discInput, fmt }) => {
    const sub2  = cart.reduce((a, c) => a + c.price * c.qty, 0);
    const grand = sub2 - discAmount;
    const no    = `RCP-${(nextReceipt || 1018) + 1}`;
    setNextReceipt((nextReceipt || 1018) + 1);

    /* Reduce stock */
    const lows = [];
    setProducts(prev => prev.map(p => {
      const line = cart.find(c => c.id === p.id);
      if (!line) return p;
      const ns = Math.max(0, p.stock - line.qty);
      const updated = { ...p, stock: ns };
      if (ns <= updated.low) lows.push(updated.name);
      return updated;
    }));

    const sale = {
      no, date: todayISO(), buyer: buyer.trim() || 'Walk-in',
      by: 'Front Desk',
      lines: cart.map(c => ({ name: c.name, qty: c.qty, price: c.price })),
      subtotal: sub2, discount: discAmount, discType, discInput,
      total: grand,
    };
    setSales(prev => [sale, ...(prev || [])]);

    toast(`Sale completed — receipt ${no}`, 'success');
    if (lows.length) setTimeout(() => toast(`Low stock: ${lows.join(', ')}`, 'info'), 400);

    /* Fire print in chosen format */
    if (fmt === 'thermal') openThermalPrintWindow(sale, school, toast);
    else                   openInvoicePrintWindow(`Invoice ${no}`, buildA4InvoiceHTML(sale, school), toast);
  };

  return (
    <>
      {/* Overview banner */}
      <div className="acc-overview">
        <div className="acc-overview-main">
          <div className="acc-overview-icon" style={{ background: 'linear-gradient(135deg,#16A34A,#15803D)' }}>
            <i className="fa-solid fa-cash-register"></i>
          </div>
          <div className="acc-overview-text">
            <div className="acc-overview-title">Point of Sale</div>
            <div className="acc-overview-sub">
              A simple school shop counter. Sell books, notebooks, uniforms &amp; stationery, add them to a cart and print a receipt — <strong>stock reduces automatically</strong>.
            </div>
          </div>
        </div>
        <div className="acc-overview-stats">
          <div className="acc-ov-stat">
            <div className="acc-ov-stat-ic rev"><i className="fa-solid fa-box-open"></i></div>
            <div>
              <div className="acc-ov-stat-val">{stats.products}</div>
              <div className="acc-ov-stat-lbl">Products</div>
            </div>
          </div>
          <div className="acc-ov-stat">
            <div className="acc-ov-stat-ic all"><i className="fa-solid fa-indian-rupee-sign"></i></div>
            <div>
              <div className="acc-ov-stat-val">Rs {fmtMoney(stats.todayTotal)}</div>
              <div className="acc-ov-stat-lbl">Today's Sales</div>
            </div>
          </div>
          <div className="acc-ov-stat">
            <div className="acc-ov-stat-ic exp"><i className="fa-solid fa-triangle-exclamation"></i></div>
            <div>
              <div className="acc-ov-stat-val">{stats.lowProducts}</div>
              <div className="acc-ov-stat-lbl">Low Stock</div>
            </div>
          </div>
        </div>
      </div>

      {/* POS sub-tabs */}
      <div className="fee-subtabs">
        {POS_SUBTABS.map(t => (
          <Tooltip key={t.id} text={t.label}>
            <button
              className={`fee-subtab${sub === t.id ? ' active' : ''}`}
              onClick={() => setSub(t.id)}
            >
              <i className={`fa-solid ${t.icon}`}></i> {t.label}
            </button>
          </Tooltip>
        ))}
      </div>

      {sub === 'sell' ? (
        <PosSellView
          products={productList}
          school={school}
          onFinalizeSale={finalizeSale}
          toast={toast}
        />
      ) : sub === 'products' ? (
        <PosProductsView
          products={productList}
          onAdd={(p) => setProducts(prev => [...(prev || []), p])}
          onUpdate={(p) => setProducts(prev => prev.map(x => x.id === p.id ? p : x))}
          onDelete={(id) => setProducts(prev => prev.filter(x => x.id !== id))}
          toast={toast}
        />
      ) : sub === 'sales' ? (
        <PosSalesView
          sales={saleList}
          school={school}
          toast={toast}
        />
      ) : (
        <InvComingSoon
          label={subMeta?.label || 'This screen'}
          icon={subMeta?.icon || 'fa-hammer'}
        />
      )}
    </>
  );
}

/* ─── New Sale subtab ─── */
function PosSellView({ products, school, onFinalizeSale, toast }) {
  const [search, setSearch]     = useState('');
  const [cart, setCart]         = useState([]);
  const [buyer, setBuyer]       = useState('');
  const [discInput, setDiscInput] = useState(0);
  const [discType, setDiscType] = useState('rs');
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const searchWrapRef = useRef(null);
  const [searchOpen, setSearchOpen] = useState(false);

  /* Outside-click closes the search dropdown */
  useEffect(() => {
    if (!searchOpen) return;
    const onClick = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [searchOpen]);

  const searchResults = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return [];
    return products
      .filter(p => `${p.name} ${p.barcode} ${p.cat}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [products, search]);

  /* Cart actions */
  const addToCart = (pid) => {
    const p = products.find(x => x.id === pid);
    if (!p) return;
    if (p.stock <= 0) { toast('This product is out of stock', 'error'); return; }
    const line = cart.find(c => c.id === pid);
    const have = line ? line.qty : 0;
    if (have + 1 > p.stock) { toast('Not enough stock available', 'error'); return; }
    setCart(prev => line
      ? prev.map(c => c.id === pid ? { ...c, qty: c.qty + 1 } : c)
      : [...prev, { id: pid, name: p.name, price: p.price, qty: 1 }]);
  };

  const adjustQty = (pid, delta) => {
    const line = cart.find(c => c.id === pid);
    if (!line) return;
    const p = products.find(x => x.id === pid);
    const nv = line.qty + delta;
    if (nv <= 0) { setCart(prev => prev.filter(c => c.id !== pid)); return; }
    if (p && nv > p.stock) { toast('Not enough stock available', 'error'); return; }
    setCart(prev => prev.map(c => c.id === pid ? { ...c, qty: nv } : c));
  };

  const removeLine = (pid) => setCart(prev => prev.filter(c => c.id !== pid));
  const clearCart  = () => { setCart([]); setDiscInput(0); setBuyer(''); };

  /* Totals */
  const subtotal     = useMemo(() => cart.reduce((a, c) => a + c.price * c.qty, 0), [cart]);
  const discAmount   = useMemo(() => {
    const raw = discType === 'pct' ? subtotal * ((Number(discInput) || 0) / 100) : Number(discInput) || 0;
    return Math.round(Math.max(0, Math.min(raw, subtotal)));
  }, [subtotal, discInput, discType]);
  const grand        = subtotal - discAmount;
  const itemCount    = cart.reduce((a, c) => a + c.qty, 0);

  /* Checkout */
  const openCheckout = () => {
    if (!cart.length) { toast('Cart is empty — add a product first', 'error'); return; }
    setCheckoutOpen(true);
  };
  const handleCheckout = (fmt) => {
    onFinalizeSale({ cart, buyer, discAmount, discType, discInput, fmt });
    clearCart();
    setCheckoutOpen(false);
  };

  return (
    <>
      <div className="fee-info">
        <i className="fa-solid fa-circle-info"></i>
        <span> Tap a product to add it to the cart, or search by name. Set the quantity, enter the buyer's name, then generate the receipt. Stock reduces automatically.</span>
      </div>

      <div className="inv-pos-wrap">
        {/* LEFT — search + product grid */}
        <div>
          <div className="fee-section fee-section--filters">
            <div className="fee-section-body">
              <div className="fee-field" style={{ width: '100%', position: 'relative' }} ref={searchWrapRef}>
                <span className="fee-label">Search Product</span>
                <div className="fee-search-box">
                  <i className="fa-solid fa-magnifying-glass"></i>
                  <input
                    placeholder="Search product by name or barcode"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
                    onFocus={() => setSearchOpen(true)}
                    autoComplete="off"
                  />
                  {search && (
                    <Tooltip text="Clear search">
                      <button className="fee-search-clear" onClick={() => { setSearch(''); setSearchOpen(false); }} aria-label="Clear search">
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </Tooltip>
                  )}
                </div>
                {searchOpen && search.trim() && (
                  <div className="inv-pos-searchresults open">
                    {searchResults.length === 0 ? (
                      <div className="inv-pos-sr-item" style={{ cursor: 'default', color: 'var(--text-muted)' }}>
                        No products found
                      </div>
                    ) : searchResults.map(p => (
                      <div
                        key={p.id}
                        className="inv-pos-sr-item"
                        onClick={() => { addToCart(p.id); setSearch(''); setSearchOpen(false); }}
                      >
                        <div className="inv-pos-sr-ic"><i className={`fa-solid ${prodIcon(p.cat)}`}></i></div>
                        <div style={{ flex: 1 }}>
                          <div className="inv-pos-sr-name">{p.name}</div>
                          <div className="inv-pos-sr-sub">Stock: {fmtMoney(p.stock)} · Rs {fmtMoney(p.price)}</div>
                        </div>
                        {p.stock <= 0
                          ? <span className="inv-pill inv-pill-red">Out</span>
                          : <i className="fa-solid fa-plus inv-pos-sr-add"></i>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {products.length === 0 ? (
            <div className="fee-section">
              <div className="fee-section-body">
                <div className="inv-empty">
                  <div className="inv-empty-ic"><i className="fa-solid fa-box-open"></i></div>
                  <div className="inv-empty-title">No products yet</div>
                  <div className="inv-empty-sub">Add a shop product from the Products tab to start selling.</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="inv-pos-products">
              {products.map(p => {
                const out = p.stock <= 0;
                const low = p.stock <= p.low && p.stock > 0;
                return (
                  <div
                    key={p.id}
                    className={`inv-pos-prod${out ? ' out' : ''}`}
                    onClick={() => addToCart(p.id)}
                  >
                    <div className="inv-pos-prod-img">
                      {p.img
                        ? <img src={p.img} alt={p.name} />
                        : <i className={`fa-solid ${prodIcon(p.cat)}`}></i>}
                      {(out || low) && (
                        <div className="inv-pos-lowtag">
                          <span className={`inv-pill ${out ? 'inv-pill-red' : 'inv-pill-amber'}`} style={{ fontSize: 9, padding: '2px 7px' }}>
                            {out ? 'Out' : 'Low'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="inv-pos-prod-body">
                      <div className="inv-pos-prod-name">{p.name}</div>
                      <div className="inv-pos-prod-price">Rs {fmtMoney(p.price)}</div>
                      <div className="inv-pos-prod-stock">Stock: {fmtMoney(p.stock)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT — Cart sidebar */}
        <div className="inv-cart">
          <div className="inv-cart-head">
            <div className="inv-cart-head-title"><i className="fa-solid fa-cart-shopping"></i> Cart</div>
            <Tooltip text="Clear all items from the cart">
              <button className="fee-btn fee-btn-ghost fee-btn-xs" onClick={clearCart}>
                <i className="fa-solid fa-trash-can"></i> Clear
              </button>
            </Tooltip>
          </div>

          <div className="inv-cart-items">
            {cart.length === 0 ? (
              <div className="inv-cart-empty">
                <i className="fa-solid fa-cart-shopping"></i>
                Cart is empty.<br />Tap a product to add it.
              </div>
            ) : cart.map(c => (
              <div key={c.id} className="inv-cart-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="inv-cart-row-name">{c.name}</div>
                  <div className="inv-cart-row-price">Rs {fmtMoney(c.price)} each</div>
                </div>
                <div className="inv-qty">
                  <Tooltip text="Decrease quantity">
                    <button onClick={() => adjustQty(c.id, -1)} aria-label="Decrease quantity">−</button>
                  </Tooltip>
                  <span className="inv-qty-val">{c.qty}</span>
                  <Tooltip text="Increase quantity">
                    <button onClick={() => adjustQty(c.id, 1)} aria-label="Increase quantity">+</button>
                  </Tooltip>
                </div>
                <div className="inv-cart-row-tot">Rs {fmtMoney(c.price * c.qty)}</div>
                <Tooltip text="Remove from cart">
                  <button className="inv-cart-del" onClick={() => removeLine(c.id)} aria-label="Remove from cart">
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </Tooltip>
              </div>
            ))}
          </div>

          <div className="inv-cart-foot">
            <div className="fee-field" style={{ marginBottom: 12 }}>
              <span className="fee-label">Buyer Name (Student / Parent)</span>
              <input className="fee-input" value={buyer} onChange={(e) => setBuyer(e.target.value)} placeholder="e.g. Ahmed Raza — Class 5B" />
            </div>
            <div className="fee-field" style={{ marginBottom: 12 }}>
              <span className="fee-label">Discount (optional)</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="fee-input"
                  type="number"
                  min="0"
                  value={discInput}
                  onChange={(e) => setDiscInput(Math.max(0, Number(e.target.value) || 0))}
                  style={{ flex: 1 }}
                />
                <div className="fee-select-wrap" style={{ width: 120 }}>
                  <select className="fee-select" value={discType} onChange={(e) => setDiscType(e.target.value)}>
                    <option value="rs">Rs (amount)</option>
                    <option value="pct">% percent</option>
                  </select>
                  <i className="fa-solid fa-chevron-down"></i>
                </div>
              </div>
            </div>

            <div className="inv-cart-total-row"><span>Items</span><span>{itemCount}</span></div>
            <div className="inv-cart-total-row"><span>Subtotal</span><span>Rs {fmtMoney(subtotal)}</span></div>
            {discAmount > 0 && (
              <div className="inv-cart-total-row inv-cart-disc-row">
                <span>Discount</span>
                <span>– Rs {fmtMoney(discAmount)}{discType === 'pct' ? ` (${discInput}%)` : ''}</span>
              </div>
            )}
            <div className="inv-cart-grand"><span>Total</span><span>Rs {fmtMoney(grand)}</span></div>

            <button
              className="fee-btn fee-btn-primary inv-cart-closebtn"
              onClick={openCheckout}
              disabled={!cart.length}
            >
              <i className="fa-solid fa-circle-check"></i> Close Sale
            </button>
          </div>
        </div>
      </div>

      {/* Checkout modal */}
      {checkoutOpen && (
        <PosCheckoutModal
          cart={cart}
          buyer={buyer.trim() || 'Walk-in'}
          subtotal={subtotal}
          discAmount={discAmount}
          discType={discType}
          discInput={discInput}
          total={grand}
          itemCount={itemCount}
          onClose={() => setCheckoutOpen(false)}
          onConfirm={handleCheckout}
        />
      )}
    </>
  );
}

/* ─── Checkout modal (summary + A4/Thermal picker) ─── */
function PosCheckoutModal({ cart, buyer, subtotal, discAmount, discType, discInput, total, itemCount, onClose, onConfirm }) {
  const [fmt, setFmt] = useState('a4');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return createPortal(
    <div className="fee-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fee-modal">
        <div className="fee-modal-head">
          <div className="fee-modal-head-title">
            <div className="fee-modal-head-icon" style={{ background: 'linear-gradient(135deg,#16A34A,#15803D)' }}>
              <i className="fa-solid fa-receipt"></i>
            </div>
            <div>
              <div className="fee-modal-title">Close Sale</div>
              <div className="fee-modal-sub">Review the order, then choose your invoice format</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="fee-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
          </Tooltip>
        </div>

        <div className="fee-modal-body">
          <div className="inv-co-sum">
            <div className="inv-co-line">
              <span className="nm"><i className="fa-solid fa-user" style={{ marginRight: 6, color: 'var(--brand-primary)' }}></i> Buyer</span>
              <span className="vl">{buyer}</span>
            </div>
            {cart.map(c => (
              <div key={c.id} className="inv-co-line">
                <span className="nm">{c.qty} × {c.name}</span>
                <span className="vl">Rs {fmtMoney(c.price * c.qty)}</span>
              </div>
            ))}
            <div className="inv-co-line">
              <span className="nm">Subtotal ({itemCount} item{itemCount !== 1 ? 's' : ''})</span>
              <span className="vl">Rs {fmtMoney(subtotal)}</span>
            </div>
            {discAmount > 0 && (
              <div className="inv-co-line" style={{ color: '#DC2626' }}>
                <span className="nm">Discount{discType === 'pct' ? ` (${discInput}%)` : ''}</span>
                <span className="vl" style={{ color: '#DC2626' }}>– Rs {fmtMoney(discAmount)}</span>
              </div>
            )}
            <div className="inv-co-line inv-co-tot">
              <span className="nm">Grand Total</span>
              <span className="vl">Rs {fmtMoney(total)}</span>
            </div>
          </div>

          <div className="fee-label" style={{ margin: '18px 0 8px' }}>Select Invoice Format</div>
          <div className="inv-fmt-grid">
            <button type="button" className={`inv-fmt-opt${fmt === 'a4' ? ' active' : ''}`} onClick={() => setFmt('a4')}>
              <div className="inv-fmt-ic"><i className="fa-solid fa-file-lines"></i></div>
              <div className="inv-fmt-name">A4 Invoice</div>
              <div className="inv-fmt-desc">Full-page printout for a normal printer / PDF</div>
              <div className="inv-fmt-check"><i className="fa-solid fa-circle-check"></i></div>
            </button>
            <button type="button" className={`inv-fmt-opt${fmt === 'thermal' ? ' active' : ''}`} onClick={() => setFmt('thermal')}>
              <div className="inv-fmt-ic"><i className="fa-solid fa-receipt"></i></div>
              <div className="inv-fmt-name">Thermal Receipt</div>
              <div className="inv-fmt-desc">80mm slip for a thermal receipt printer</div>
              <div className="inv-fmt-check"><i className="fa-solid fa-circle-check"></i></div>
            </button>
          </div>
        </div>

        <div className="fee-modal-foot">
          <Tooltip text="Discard checkout">
            <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
          </Tooltip>
          <Tooltip text={fmt === 'thermal' ? 'Finalise sale & print thermal receipt' : 'Finalise sale & print A4 invoice'}>
            <button
              className="fee-btn fee-btn-primary inv-confirm-sale"
              onClick={() => onConfirm(fmt)}
            >
              <i className="fa-solid fa-circle-check"></i> Confirm &amp; Print Invoice
            </button>
          </Tooltip>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ═══════════════════════════════════════════════════════════════════
   POS PRODUCTS — manage the catalog sold at the school shop.
   ═══════════════════════════════════════════════════════════════════ */
const PRODUCT_CATS = ['Books', 'Notebooks', 'Stationery', 'Uniform', 'Other'];

function PosProductsView({ products, onAdd, onUpdate, onDelete, toast }) {
  const { data: school = {} } = useAsync(inventoryService.getInvSchool, {});
  const [search, setSearch]   = useState('');
  const [catFilter, setCat]   = useState('all');
  const [editCfg, setEditCfg] = useState(null);     // {mode:'add'|'edit', product?}
  const [confirmCfg, setConfirmCfg] = useState(null);
  const [printTarget, setPrintTarget] = useState(null);

  const cats = useMemo(
    () => Array.from(new Set([...PRODUCT_CATS, ...products.map(p => p.cat)])),
    [products],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let out = products;
    if (catFilter !== 'all') out = out.filter(p => p.cat === catFilter);
    if (q) out = out.filter(p => `${p.name} ${p.barcode} ${p.cat}`.toLowerCase().includes(q));
    return out;
  }, [products, search, catFilter]);

  const askDelete = (p) => setConfirmCfg({
    product: p,
    onYes: () => { onDelete(p.id); toast('Product deleted', 'info'); setConfirmCfg(null); },
  });

  return (
    <>
      <div className="inv-subbar">
        <div className="inv-subbar-title"><i className="fa-solid fa-box-open"></i> Shop Products</div>
        <div className="inv-subbar-spacer"></div>
        <Tooltip text="Add a new shop product">
          <button className="fee-btn fee-btn-primary inv-add-prodbtn" onClick={() => setEditCfg({ mode: 'add' })}>
            <i className="fa-solid fa-plus"></i> Add Product
          </button>
        </Tooltip>
      </div>

      <div className="fee-info">
        <i className="fa-solid fa-circle-info"></i>
        <span> These are the items sold at the school shop. Low-stock products are flagged automatically so you know when to restock.</span>
      </div>

      <div className="fee-section fee-section--filters">
        <div className="fee-section-body">
          <div className="inv-toolbar">
            <div className="fee-field fee-field--grow">
              <span className="fee-label">Search Products</span>
              <div className="fee-search-box">
                <i className="fa-solid fa-magnifying-glass"></i>
                <input
                  placeholder="Search shop products"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoComplete="off"
                />
                {search && (
                  <Tooltip text="Clear search">
                    <button className="fee-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>
            <div className="fee-field">
              <span className="fee-label">Category</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={catFilter} onChange={(e) => setCat(e.target.value)}>
                  <option value="all">All Categories</option>
                  {cats.map(c => <option key={c}>{c}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="fee-section">
          <div className="fee-section-body">
            <div className="inv-empty">
              <div className="inv-empty-ic"><i className="fa-solid fa-box-open"></i></div>
              <div className="inv-empty-title">No products</div>
              <div className="inv-empty-sub">
                {search || catFilter !== 'all'
                  ? 'Try changing your search or filter.'
                  : 'Add a shop product to start selling.'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="inv-grid">
          {filtered.map(p => {
            const out = p.stock <= 0;
            const low = p.stock <= p.low && p.stock > 0;
            return (
              <div key={p.id} className="inv-card">
                <div className="inv-card-img">
                  {p.img
                    ? <img src={p.img} alt={p.name} />
                    : <i className={`fa-solid ${prodIcon(p.cat)}`}></i>}
                  <div className="inv-card-statusbadge">
                    {out
                      ? <span className="inv-pill inv-pill-red">Out of stock</span>
                      : low
                        ? <span className="inv-pill inv-pill-amber">Low</span>
                        : <span className="inv-pill inv-pill-green">In stock</span>}
                  </div>
                </div>
                <div className="inv-card-body">
                  <div className="inv-card-name">{p.name}</div>
                  <div className="inv-card-code">{p.barcode}</div>
                  <div className="inv-card-meta">
                    <span><i className="fa-solid fa-tag"></i> Rs {fmtMoney(p.price)}</span>
                    <span><i className="fa-solid fa-cubes"></i> Stock: <strong>{fmtMoney(p.stock)}</strong></span>
                  </div>
                </div>
                <div className="inv-card-foot">
                  <Tooltip text="Edit this product">
                    <button className="fee-btn fee-btn-ghost fee-btn-xs" style={{ flex: 1 }} onClick={() => setEditCfg({ mode: 'edit', product: p })}>
                      <i className="fa-solid fa-pen"></i> Edit
                    </button>
                  </Tooltip>
                  <Tooltip text="Print barcode label">
                    <button
                      className="fee-btn fee-btn-ghost fee-btn-xs"
                      onClick={() => setPrintTarget({ code: p.barcode, name: p.name, cat: p.cat, loc: '' })}
                    >
                      <i className="fa-solid fa-barcode"></i>
                    </button>
                  </Tooltip>
                  <Tooltip text="Delete this product">
                    <button className="fee-btn fee-btn-ghost fee-btn-xs fee-m-danger" onClick={() => askDelete(p)}>
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </Tooltip>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editCfg && (
        <PosProductModal
          cfg={editCfg}
          existingProducts={products}
          onClose={() => setEditCfg(null)}
          onSave={(payload) => {
            if (editCfg.mode === 'edit') {
              onUpdate({ ...editCfg.product, ...payload });
              toast('Product updated', 'success');
            } else {
              const nextId = Math.max(0, ...products.map(p => p.id)) + 1;
              onAdd({ id: nextId, ...payload });
              toast('Product added', 'success');
            }
            setEditCfg(null);
          }}
          toast={toast}
        />
      )}

      {confirmCfg && (
        <PosProductConfirmDialog
          cfg={confirmCfg}
          onClose={() => setConfirmCfg(null)}
        />
      )}

      {printTarget && (
        <InvBarcodeSizeModal
          target={printTarget}
          school={school}
          onClose={() => setPrintTarget(null)}
          toast={toast}
        />
      )}
    </>
  );
}

/* ─── Product Add/Edit modal ─── */
function PosProductModal({ cfg, existingProducts, onClose, onSave, toast }) {
  const isEdit = cfg?.mode === 'edit';
  const base   = isEdit ? cfg.product : null;
  const fileRef = useRef(null);

  const [name, setName]       = useState(base?.name || '');
  const [cat, setCat]         = useState(base?.cat  || 'Books');
  const [barcode, setBarcode] = useState(base?.barcode || '');
  const [stock, setStock]     = useState(base?.stock != null ? String(base.stock) : '0');
  const [low, setLow]         = useState(base?.low   != null ? String(base.low)   : '10');
  const [cost, setCost]       = useState(base?.cost  != null ? String(base.cost)  : '0');
  const [price, setPrice]     = useState(base?.price != null ? String(base.price) : '0');
  const [img, setImg]         = useState(base?.img   || null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast('Image too large (max 2 MB)', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => setImg(reader.result);
    reader.readAsDataURL(f);
  };

  const handleSubmit = () => {
    if (!name.trim()) { toast('Please enter a product name', 'error'); return; }
    const priceN = parseFloat(price) || 0;
    if (priceN <= 0) { toast('Please enter a selling price', 'error'); return; }
    /* Auto-barcode if blank */
    let bc = barcode.trim();
    if (!bc) {
      const pre = String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'ITM';
      let max = 0;
      existingProducts.forEach(p => {
        const m = (p.barcode || '').match(/-(\d+)$/);
        if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
      });
      bc = `${cat.toUpperCase().slice(0, 2)}-${pre}-${String(max + 1).padStart(3, '0')}`;
    }
    onSave({
      name: name.trim(), cat,
      barcode: bc,
      stock: parseInt(stock, 10) || 0,
      low:   parseInt(low,   10) || 0,
      cost:  parseFloat(cost)    || 0,
      price: priceN,
      img,
    });
  };

  return createPortal(
    <div className="fee-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fee-modal">
        <div className="fee-modal-head">
          <div className="fee-modal-head-title">
            <div className="fee-modal-head-icon" style={{ background: 'linear-gradient(135deg,#16A34A,#15803D)' }}>
              <i className="fa-solid fa-box-open"></i>
            </div>
            <div>
              <div className="fee-modal-title">{isEdit ? 'Edit Product' : 'Add Product'}</div>
              <div className="fee-modal-sub">Shop product for Point of Sale</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="fee-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
          </Tooltip>
        </div>

        <div className="fee-modal-body">
          <div className="inv-form-grid">
            <div className="fee-field full">
              <span className="fee-label">Product Name *</span>
              <input className="fee-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grade 1 English Book" />
            </div>

            <div className="fee-field">
              <span className="fee-label">Category</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={cat} onChange={(e) => setCat(e.target.value)}>
                  {PRODUCT_CATS.map(c => <option key={c}>{c}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>

            <div className="fee-field">
              <span className="fee-label">Barcode (optional)</span>
              <input className="fee-input" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Auto if empty" />
            </div>

            <div className="fee-field">
              <span className="fee-label">Stock Quantity *</span>
              <input className="fee-input" type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>

            <div className="fee-field">
              <span className="fee-label">Low Stock Below</span>
              <input className="fee-input" type="number" min="0" value={low} onChange={(e) => setLow(e.target.value)} />
            </div>

            <div className="fee-field">
              <span className="fee-label">Purchase Price (Rs.)</span>
              <input className="fee-input" type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>

            <div className="fee-field">
              <span className="fee-label">Selling Price (Rs.) *</span>
              <input className="fee-input" type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>

            <div className="fee-field full">
              <span className="fee-label">Product Image</span>
              <div className="inv-upload" onClick={() => fileRef.current && fileRef.current.click()}>
                {img ? (
                  <img src={img} alt="preview" className="inv-upload-preview" />
                ) : (
                  <div className="inv-upload-empty">
                    <i className="fa-solid fa-cloud-arrow-up"></i>
                    <div className="inv-upload-lbl">Click to upload a photo</div>
                    <div className="inv-upload-hint">JPG or PNG · optional</div>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
              <div className="fee-hint">
                <i className="fa-solid fa-circle-info"></i>
                The picture appears on this product's tile in the New Sale grid, the Products card and the cart preview.
              </div>
              {img && (
                <button type="button" className="fee-btn fee-btn-ghost fee-btn-xs" style={{ marginTop: 6 }} onClick={(e) => { e.stopPropagation(); setImg(null); }}>
                  <i className="fa-solid fa-xmark"></i> Remove image
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="fee-modal-foot">
          <Tooltip text="Discard changes">
            <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
          </Tooltip>
          <Tooltip text={isEdit ? 'Update product' : 'Save new product'}>
            <button className="fee-btn fee-btn-primary inv-confirm-sale" onClick={handleSubmit}>
              <i className="fa-solid fa-floppy-disk"></i> Save Product
            </button>
          </Tooltip>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ─── Product delete confirm ─── */
function PosProductConfirmDialog({ cfg, onClose }) {
  const { product, onYes } = cfg;
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return createPortal(
    <div className="fee-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fee-modal sm">
        <div className="fee-modal-head">
          <div className="fee-modal-head-title">
            <div className="fee-modal-head-icon" style={{ background: 'linear-gradient(135deg,#DC2626,#B91C1C)' }}>
              <i className="fa-solid fa-trash-can"></i>
            </div>
            <div>
              <div className="fee-modal-title">Delete product?</div>
              <div className="fee-modal-sub">This action needs confirmation</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="fee-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
          </Tooltip>
        </div>
        <div className="fee-modal-body">
          <p className="inv-confirm-msg">
            "<strong>{product.name}</strong>" will be removed from the shop. This cannot be undone.
          </p>
        </div>
        <div className="fee-modal-foot">
          <Tooltip text="Cancel">
            <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
          </Tooltip>
          <Tooltip text="Delete the product">
            <button
              className="fee-btn fee-btn-primary"
              style={{ background: 'linear-gradient(135deg,#DC2626,#B91C1C)', boxShadow: '0 4px 14px rgba(220,38,38,.28)' }}
              onClick={onYes}
            >
              <i className="fa-solid fa-check"></i> Delete
            </button>
          </Tooltip>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ═══════════════════════════════════════════════════════════════════
   POS SALES HISTORY — KPI strip + receipts table + reprint flow.
   ═══════════════════════════════════════════════════════════════════ */
function PosSalesView({ sales, school, toast }) {
  const [reprint, setReprint] = useState(null);
  /* Local report-style toggle — applies to the Sales History A4 download. */
  const [salesStyle, setSalesStyle] = useState('color'); // 'color' | 'bw'

  const today    = todayISO();
  const todaySales = sales.filter(s => s.date === today);
  const todayTot   = todaySales.reduce((a, s) => a + s.total, 0);
  const monthKey   = today.slice(0, 7);
  const monthTot   = sales.filter(s => s.date.slice(0, 7) === monthKey).reduce((a, s) => a + s.total, 0);
  const now        = new Date();

  const sorted = useMemo(
    () => [...sales].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [sales],
  );

  return (
    <>
      <div className="fee-kpis">
        <div className="fee-kpi k-green">
          <div className="fee-kpi-top">
            <span className="fee-kpi-label">Today's Sales</span>
            <span className="fee-kpi-ic" style={{ background: 'rgba(22,163,74,.12)', color: '#16A34A' }}>
              <i className="fa-solid fa-calendar-day"></i>
            </span>
          </div>
          <div className="fee-kpi-val">Rs {fmtMoney(todayTot)}</div>
          <div className="fee-kpi-meta">{todaySales.length} receipt(s)</div>
        </div>
        <div className="fee-kpi k-blue">
          <div className="fee-kpi-top">
            <span className="fee-kpi-label">This Month</span>
            <span className="fee-kpi-ic" style={{ background: 'rgba(30,58,138,.10)', color: '#1E40AF' }}>
              <i className="fa-solid fa-calendar-days"></i>
            </span>
          </div>
          <div className="fee-kpi-val">Rs {fmtMoney(monthTot)}</div>
          <div className="fee-kpi-meta">
            {['January','February','March','April','May','June','July','August','September','October','November','December'][now.getMonth()]} {now.getFullYear()}
          </div>
        </div>
        <div className="fee-kpi k-amber">
          <div className="fee-kpi-top">
            <span className="fee-kpi-label">Total Receipts</span>
            <span className="fee-kpi-ic" style={{ background: 'rgba(217,119,6,.12)', color: '#D97706' }}>
              <i className="fa-solid fa-receipt"></i>
            </span>
          </div>
          <div className="fee-kpi-val">{sales.length}</div>
          <div className="fee-kpi-meta">All time</div>
        </div>
      </div>

      <div className="fee-section">
        <div className="fee-section-header">
          <div className="fee-section-title">
            <div className="fee-section-icon"><i className="fa-solid fa-receipt"></i></div>
            <div>
              <div className="fee-section-name">Sales History</div>
              <div className="fee-section-sub">All shop receipts, newest first</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div
              className="inv-rep-style-seg"
              role="radiogroup"
              aria-label="Sales History report style"
              style={{ flexShrink: 0 }}
            >
              <button
                type="button"
                className={`inv-rep-style-btn${salesStyle === 'color' ? ' on' : ''}`}
                onClick={() => setSalesStyle('color')}
                role="radio"
                aria-checked={salesStyle === 'color'}
                tabIndex={salesStyle === 'color' ? 0 : -1}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')   { e.preventDefault(); setSalesStyle('color'); }
                  else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setSalesStyle('bw'); }
                }}
              >
                <i className="fa-solid fa-palette" aria-hidden="true"></i> Colorful
              </button>
              <button
                type="button"
                className={`inv-rep-style-btn${salesStyle === 'bw' ? ' on' : ''}`}
                onClick={() => setSalesStyle('bw')}
                role="radio"
                aria-checked={salesStyle === 'bw'}
                tabIndex={salesStyle === 'bw' ? 0 : -1}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')   { e.preventDefault(); setSalesStyle('color'); }
                  else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setSalesStyle('bw'); }
                }}
              >
                <i className="fa-solid fa-circle-half-stroke" aria-hidden="true"></i> Colorless
              </button>
            </div>
            <Tooltip text={`Download an A4 ${salesStyle === 'bw' ? 'Colorless' : 'Colorful'} PDF of every sale in this list`}>
              <button
                className="fee-btn fee-btn-ghost fee-btn-sm acc-dlreport-btn"
                onClick={() => openReportPrintWindow(
                  'Sales History Report',
                  buildSalesReportHTML(sorted, school, { title: 'Sales History Report' }),
                  toast,
                  salesStyle === 'bw',
                )}
              >
                <i className="fa-solid fa-file-export"></i> Download A4 Report
              </button>
            </Tooltip>
          </div>
        </div>

        <div className="inv-sales-tablewrap">
          <table className="inv-sales-table">
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Buyer</th>
                <th>Items</th>
                <th className="c">Qty</th>
                <th className="r">Total</th>
                <th className="c">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan="6" className="inv-sales-empty">No sales yet.</td>
                </tr>
              ) : sorted.map(s => {
                const qty = s.lines.reduce((a, l) => a + l.qty, 0);
                const itemsTxt = s.lines.map(l => `${l.qty}× ${l.name}`).join(', ');
                return (
                  <tr key={s.no}>
                    <td className="inv-sales-no">{s.no}</td>
                    <td>{s.buyer}</td>
                    <td className="inv-sales-items">{itemsTxt}</td>
                    <td className="c">{qty}</td>
                    <td className="r inv-sales-total">Rs {fmtMoney(s.total)}</td>
                    <td className="c">
                      <Tooltip text="Reprint this receipt">
                        <button className="fee-iconbtn" onClick={() => setReprint(s)}>
                          <i className="fa-solid fa-print"></i>
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

      {reprint && (
        <PosReprintModal
          sale={reprint}
          school={school}
          onClose={() => setReprint(null)}
          toast={toast}
        />
      )}
    </>
  );
}

/* ─── Reprint modal (A4 / Thermal picker) ─── */
function PosReprintModal({ sale, school, onClose, toast }) {
  const [fmt, setFmt] = useState('a4');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handlePrint = () => {
    if (fmt === 'thermal') openThermalPrintWindow(sale, school, toast);
    else                   openInvoicePrintWindow(`Invoice ${sale.no}`, buildA4InvoiceHTML(sale, school), toast);
    onClose();
  };

  return createPortal(
    <div className="fee-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fee-modal sm">
        <div className="fee-modal-head">
          <div className="fee-modal-head-title">
            <div className="fee-modal-head-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#2563EB)' }}>
              <i className="fa-solid fa-print"></i>
            </div>
            <div>
              <div className="fee-modal-title">Print Invoice</div>
              <div className="fee-modal-sub">Receipt {sale.no} · Rs {fmtMoney(sale.total)}</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="fee-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
          </Tooltip>
        </div>
        <div className="fee-modal-body">
          <div className="inv-fmt-grid">
            <button type="button" className={`inv-fmt-opt${fmt === 'a4' ? ' active' : ''}`} onClick={() => setFmt('a4')}>
              <div className="inv-fmt-ic"><i className="fa-solid fa-file-lines"></i></div>
              <div className="inv-fmt-name">A4 Invoice</div>
              <div className="inv-fmt-desc">Full-page printout for a normal printer / PDF</div>
              <div className="inv-fmt-check"><i className="fa-solid fa-circle-check"></i></div>
            </button>
            <button type="button" className={`inv-fmt-opt${fmt === 'thermal' ? ' active' : ''}`} onClick={() => setFmt('thermal')}>
              <div className="inv-fmt-ic"><i className="fa-solid fa-receipt"></i></div>
              <div className="inv-fmt-name">Thermal Receipt</div>
              <div className="inv-fmt-desc">80mm slip for a thermal receipt printer</div>
              <div className="inv-fmt-check"><i className="fa-solid fa-circle-check"></i></div>
            </button>
          </div>
        </div>
        <div className="fee-modal-foot">
          <Tooltip text="Close without printing">
            <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
          </Tooltip>
          <Tooltip text="Open the receipt in the chosen format">
            <button className="fee-btn fee-btn-primary" onClick={handlePrint}>
              <i className="fa-solid fa-print"></i> Print
            </button>
          </Tooltip>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ═══════════════════════════════════════════════════════════════════
   BARCODE SIZE PICKER MODAL — shared by both Inventory Items and POS
   Products. Lets the user choose from international standard label
   sizes (small / medium / large thermal, or A4 sheet of 30).
   ═══════════════════════════════════════════════════════════════════ */
function InvBarcodeSizeModal({ target, school, onClose, toast }) {
  const [sizeId, setSizeId] = useState('medium');
  const [copies, setCopies] = useState(1);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!target) return null;
  const size = LABEL_SIZES.find(s => s.id === sizeId) || LABEL_SIZES[1];

  const handlePrint = () => {
    if (size.id === 'sheet') {
      openRawPrintWindow(`Barcode Sheet — ${target.code}`, buildLabelSheetHTML(target, school), toast);
    } else {
      openRawPrintWindow(
        `Barcode Label — ${target.code}`,
        buildSingleLabelHTML(target, size, school, toast, Math.max(1, Math.min(50, copies || 1))),
        toast,
      );
    }
    onClose();
  };

  return createPortal(
    <div className="fee-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fee-modal lg">
        <div className="fee-modal-head">
          <div className="fee-modal-head-title">
            <div className="fee-modal-head-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#2563EB)' }}>
              <i className="fa-solid fa-barcode"></i>
            </div>
            <div>
              <div className="fee-modal-title">Print Barcode Label</div>
              <div className="fee-modal-sub">{target.name} · <code>{target.code}</code> — pick an international label size</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="fee-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
          </Tooltip>
        </div>

        <div className="fee-modal-body">
          {/* Live preview */}
          <div className="inv-bc-preview">
            <div className="inv-bc-preview-stage">
              <div
                className="inv-bc-preview-label"
                style={{ width: `${size.w * 2.6}px`, height: `${size.h * 2.6}px` }}
                dangerouslySetInnerHTML={{ __html: `
                  ${size.w >= 50 ? `<div class="bc-pv-school">${(school?.name || 'School').replace(/[<>&]/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[m]))}</div>` : ''}
                  <div class="bc-pv-name">${(target.name || '').replace(/[<>&]/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[m]))}</div>
                  <div class="bc-pv-bar">${barcodeSVG(target.code).replace('class="inv-barcode-svg"', 'style="width:100%;height:100%"')}</div>
                  <div class="bc-pv-code">${(target.code || '').replace(/[<>&]/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[m]))}</div>
                `}}
              />
            </div>
            <div className="inv-bc-preview-meta">
              <i className="fa-solid fa-ruler-combined"></i>
              <strong>{size.w} × {size.h} mm</strong>
              {' '}— {size.id === 'sheet' ? '30 labels per A4 sheet' : 'single label'}
            </div>
          </div>

          {/* Size picker grid */}
          <div className="fee-label" style={{ margin: '20px 0 8px' }}>Label Size — international standards</div>
          <div className="inv-bc-grid">
            {LABEL_SIZES.map(s => (
              <button
                key={s.id}
                type="button"
                className={`inv-bc-opt${sizeId === s.id ? ' active' : ''}`}
                onClick={() => setSizeId(s.id)}
              >
                <div className="inv-bc-opt-top">
                  <div className="inv-bc-opt-ic"><i className={`fa-solid ${s.icon}`}></i></div>
                  <div className="inv-bc-opt-check"><i className="fa-solid fa-circle-check"></i></div>
                </div>
                <div className="inv-bc-opt-name">{s.label}</div>
                <div className="inv-bc-opt-dims">{s.sub}</div>
                <div className="inv-bc-opt-desc">{s.desc}</div>
              </button>
            ))}
          </div>

          {/* Copies row (single labels only) */}
          {size.id !== 'sheet' && (
            <div className="inv-bc-copyrow">
              <div className="fee-field" style={{ maxWidth: 200 }}>
                <span className="fee-label">Copies</span>
                <input
                  className="fee-input"
                  type="number"
                  min="1"
                  max="50"
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                />
              </div>
              <div className="inv-bc-copyhint">
                <i className="fa-solid fa-circle-info"></i>
                Each copy prints on its own page sized for a thermal printer feed.
              </div>
            </div>
          )}
        </div>

        <div className="fee-modal-foot">
          <Tooltip text="Close without printing">
            <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
          </Tooltip>
          <Tooltip text={`Open the printer with the ${size.label} layout`}>
            <button className="fee-btn fee-btn-primary" onClick={handlePrint}>
              <i className="fa-solid fa-print"></i> Print {size.id === 'sheet' ? '30-Label Sheet' : `${copies > 1 ? `${copies} ` : ''}Label${copies > 1 ? 's' : ''}`}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ═══════════════════════════════════════════════════════════════════
   REPORTS — 12 printable A4 reports, grouped Inventory / POS.
   Three reports (Monthly / Overall / P&L) open a picker modal first.
   ═══════════════════════════════════════════════════════════════════ */
const INV_REPORT_TILES = [
  { id: 'inv_total',    icon: 'fa-boxes-stacked',       title: 'Total Inventory Report', desc: 'Complete list of all items & quantities' },
  { id: 'inv_status',   icon: 'fa-toggle-on',           title: 'Active vs Inactive',     desc: 'Items currently in use vs retired' },
  { id: 'inv_category', icon: 'fa-layer-group',         title: 'Category-wise Inventory', desc: 'Items grouped by category' },
  { id: 'inv_location', icon: 'fa-location-dot',        title: 'Location-wise Inventory', desc: 'Items grouped by room / location' },
];
const POS_REPORT_TILES = [
  { id: 'pos_daily',    icon: 'fa-calendar-day',         title: 'Daily Sales Report',     desc: 'All sales for today' },
  { id: 'pos_monthly',  icon: 'fa-calendar-days',        title: 'Monthly Sales Report',   desc: 'Day-by-day sales for a selected month', picker: 'month' },
  { id: 'pos_overall',  icon: 'fa-calendar-week',        title: 'Overall Sales Report',   desc: 'All sales between two selected dates', picker: 'range' },
  { id: 'pos_product',  icon: 'fa-box-open',             title: 'Product-wise Sales',     desc: 'Units & revenue sold per product' },
  { id: 'pos_lowstock', icon: 'fa-triangle-exclamation', title: 'Low Stock Products',     desc: 'Shop products that need restocking' },
  { id: 'pos_pvs',      icon: 'fa-scale-balanced',       title: 'Purchase vs Sale Summary', desc: 'Cost, revenue & profit per product' },
  { id: 'pos_pnl',      icon: 'fa-money-bill-trend-up',  title: 'Profit & Loss Report',   desc: 'Sales, costing & profit between two dates', picker: 'range' },
  { id: 'pos_invvalue', icon: 'fa-warehouse',            title: 'Current Inventory Value', desc: 'Stock value at purchase & sale price' },
];

function InvReports({ toast }) {
  /* Each report needs a fresh snapshot of the data the user wants to see.
     useAsync runs once on mount — adequate for an A4 PDF preview. */
  const { data: serverItems    = [] } = useAsync(inventoryService.getInvItems,    []);
  const { data: serverProducts = [] } = useAsync(inventoryService.getInvProducts, []);
  const { data: serverSales    = [] } = useAsync(inventoryService.getInvSales,    []);
  const { data: school         = {} } = useAsync(inventoryService.getInvSchool,   {});

  const [picker, setPicker] = useState(null); // {kind, type}
  /* Page-level Report Style toggle. Applies to whichever tile the user
     clicks next — saves us from threading a per-tile picker through 12
     report flows while still giving the audit-required Colorful /
     Colorless choice for every report. */
  const [style, setStyle] = useState('color'); // 'color' | 'bw'

  const ctx = { items: serverItems, products: serverProducts, sales: serverSales };

  const runReport = (type, opts = {}) => {
    const title = INV_REPORT_TITLES[type] || 'Report';
    const isBW = style === 'bw';
    const inner = reportHeadHTML(title, school, isBW) + buildInvReportBody(type, opts, ctx) + reportFootHTML();
    openInvReportWindow(title, inner, toast, isBW);
  };

  const openTile = (tile) => {
    if (tile.picker === 'month') setPicker({ kind: 'month', type: tile.id });
    else if (tile.picker === 'range') setPicker({ kind: 'range', type: tile.id });
    else runReport(tile.id);
  };

  const onStyleKey = (e, value) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setStyle(value); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')   { e.preventDefault(); setStyle('color'); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw'); }
  };

  return (
    <>
      {/* Overview banner */}
      <div className="acc-overview">
        <div className="acc-overview-main">
          <div className="acc-overview-icon" style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}>
            <i className="fa-solid fa-chart-column"></i>
          </div>
          <div className="acc-overview-text">
            <div className="acc-overview-title">Reports</div>
            <div className="acc-overview-sub">
              Clean, printable <strong>A4 reports</strong> for both inventory and shop sales — total items, low stock, daily &amp; monthly sales and more. Print or save as PDF.
            </div>
          </div>
        </div>
      </div>

      {/* Page-level Report Style toggle (applies to every report below) */}
      <div className="inv-rep-style-row">
        <div className="inv-rep-style-lbl" id="inv-rep-style-lbl">Report Style</div>
        <div className="inv-rep-style-seg" role="radiogroup" aria-labelledby="inv-rep-style-lbl">
          <button
            type="button"
            className={`inv-rep-style-btn${style === 'color' ? ' on' : ''}`}
            onClick={() => setStyle('color')}
            role="radio"
            aria-checked={style === 'color'}
            tabIndex={style === 'color' ? 0 : -1}
            onKeyDown={(e) => onStyleKey(e, 'color')}
          >
            <i className="fa-solid fa-palette" aria-hidden="true"></i> Colorful Report
          </button>
          <button
            type="button"
            className={`inv-rep-style-btn${style === 'bw' ? ' on' : ''}`}
            onClick={() => setStyle('bw')}
            role="radio"
            aria-checked={style === 'bw'}
            tabIndex={style === 'bw' ? 0 : -1}
            onKeyDown={(e) => onStyleKey(e, 'bw')}
          >
            <i className="fa-solid fa-circle-half-stroke" aria-hidden="true"></i> Colorless Report
          </button>
        </div>
      </div>

      <div className="fee-info">
        <i className="fa-solid fa-circle-info"></i>
        <span> Every report opens as a clean <strong>A4 page</strong> you can Print or Save as PDF. Use the <strong>Report Style</strong> toggle above to switch between a Colorful brand layout and a low-ink Colorless layout.</span>
      </div>

      <div className="inv-rep-group-title">
        <i className="fa-solid fa-warehouse"></i> Inventory Reports
      </div>
      <div className="inv-rep-grid">
        {INV_REPORT_TILES.map(tile => (
          <InvReportTile key={tile.id} tile={tile} variant="blue" onClick={() => openTile(tile)} />
        ))}
      </div>

      <div className="inv-rep-group-title">
        <i className="fa-solid fa-cash-register"></i> Point of Sale Reports
      </div>
      <div className="inv-rep-grid">
        {POS_REPORT_TILES.map(tile => (
          <InvReportTile key={tile.id} tile={tile} variant="green" onClick={() => openTile(tile)} />
        ))}
      </div>

      {/* Pickers — note: the page-level Style toggle is already applied
          inside runReport, so these only need to gather the date filters. */}
      {picker?.kind === 'month' && (
        <InvMonthPickerModal
          sales={serverSales}
          onClose={() => setPicker(null)}
          onRun={({ month, year }) => { runReport(picker.type, { month, year }); setPicker(null); }}
        />
      )}
      {picker?.kind === 'range' && (
        <InvRangePickerModal
          title={picker.type === 'pos_pnl' ? 'Profit & Loss — pick a date range' : 'Overall Sales — pick a date range'}
          onClose={() => setPicker(null)}
          onRun={({ from, to }) => { runReport(picker.type, { from, to }); setPicker(null); }}
          toast={toast}
        />
      )}
    </>
  );
}

/* ─── Tile ─── */
function InvReportTile({ tile, variant, onClick }) {
  return (
    <Tooltip text={tile.desc}>
      <button type="button" className={`inv-rep-tile inv-rep-tile--${variant}`} onClick={onClick}>
        <div className="inv-rep-tile-ic">
          <i className={`fa-solid ${tile.icon}`}></i>
        </div>
        <div>
          <div className="inv-rep-tile-name">{tile.title}</div>
          <div className="inv-rep-tile-desc">{tile.desc}</div>
        </div>
        <div className="inv-rep-tile-arrow"><i className="fa-solid fa-arrow-right"></i></div>
      </button>
    </Tooltip>
  );
}

/* ─── Month + year picker ─── */
function InvMonthPickerModal({ sales, onClose, onRun }) {
  const initialNow = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(initialNow.getMonth());
  const [year, setYear]   = useState(initialNow.getFullYear());

  const years = useMemo(() => {
    const set = new Set(sales.map(s => parseInt(s.date.slice(0, 4), 10)));
    set.add(initialNow.getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [sales, initialNow]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return createPortal(
    <div className="fee-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fee-modal sm">
        <div className="fee-modal-head">
          <div className="fee-modal-head-title">
            <div className="fee-modal-head-icon" style={{ background: 'linear-gradient(135deg,#16A34A,#15803D)' }}>
              <i className="fa-solid fa-calendar-days"></i>
            </div>
            <div>
              <div className="fee-modal-title">Monthly Sales Report</div>
              <div className="fee-modal-sub">Pick a month to render</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="fee-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
          </Tooltip>
        </div>
        <div className="fee-modal-body">
          <div className="inv-form-grid">
            <div className="fee-field">
              <span className="fee-label">Month</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  {INV_MONTHS_LONG.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
            <div className="fee-field">
              <span className="fee-label">Year</span>
              <div className="fee-select-wrap">
                <select className="fee-select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
          </div>
        </div>
        <div className="fee-modal-foot">
          <Tooltip text="Cancel">
            <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
          </Tooltip>
          <Tooltip text="Generate the monthly report">
            <button className="fee-btn fee-btn-primary inv-confirm-sale" onClick={() => onRun({ month, year })}>
              <i className="fa-solid fa-chart-column"></i> Generate Report
            </button>
          </Tooltip>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ─── From/To date range picker ─── */
function InvRangePickerModal({ title, onClose, onRun, toast }) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const first = new Date(now.getFullYear(), now.getMonth(), 1);

  const [from, setFrom] = useState(iso(first));
  const [to, setTo]     = useState(iso(now));

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleRun = () => {
    if (!from || !to) { toast('Please select both dates', 'error'); return; }
    if (from > to)    { toast('"From" date must be before "To" date', 'error'); return; }
    onRun({ from, to });
  };

  return createPortal(
    <div className="fee-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fee-modal sm">
        <div className="fee-modal-head">
          <div className="fee-modal-head-title">
            <div className="fee-modal-head-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#2563EB)' }}>
              <i className="fa-solid fa-calendar-week"></i>
            </div>
            <div>
              <div className="fee-modal-title">{title}</div>
              <div className="fee-modal-sub">Inclusive of both dates</div>
            </div>
          </div>
          <Tooltip text="Close">
            <button className="fee-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button>
          </Tooltip>
        </div>
        <div className="fee-modal-body">
          <div className="inv-form-grid">
            <div className="fee-field">
              <span className="fee-label">From Date</span>
              <input className="fee-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="fee-field">
              <span className="fee-label">To Date</span>
              <input className="fee-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="fee-modal-foot">
          <Tooltip text="Cancel">
            <button className="fee-btn fee-btn-ghost" onClick={onClose}>Cancel</button>
          </Tooltip>
          <Tooltip text="Generate the report for this date range">
            <button className="fee-btn fee-btn-primary" onClick={handleRun}>
              <i className="fa-solid fa-chart-column"></i> Generate Report
            </button>
          </Tooltip>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ─── Coming Soon placeholder used for every not-yet-built screen ──── */
function InvComingSoon({ label, icon }) {
  return (
    <div className="fee-section">
      <div className="fee-section-body">
        <div className="inv-coming">
          <div className="inv-coming-ic">
            <i className={`fa-solid ${icon}`}></i>
          </div>
          <div className="inv-coming-title">{label}</div>
          <div className="inv-coming-sub">
            This screen is being implemented step-by-step from the design reference.
            <br />Stay tuned — it will land in an upcoming step.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STYLES — shared primitives duplicated from Fee/Accounts so this
   module is self-contained. Inventory-specific classes use the
   `.inv-*` prefix.
   ═══════════════════════════════════════════════════════════════════ */
const INV_CSS = `
/* ═══════════════════════════════════════════════════════════════════
   Page header (.page-header / .page-title / .tutorial-btn / .play-dot)
   is styled globally in App.js — do NOT redeclare here or we override
   the canonical font sizes, gradient and tutorial chip.
   ═══════════════════════════════════════════════════════════════════ */

/* ── Sub-tabs (shared with Fee/Accounts pattern, stretched to row) ── */
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

/* ── Section card ── */
.fee-section {
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(15,23,42,.04);
  overflow: hidden;
  margin-bottom: 16px;
}
.fee-section-body { padding: 22px 24px; }

/* ── Coming Soon placeholder ── */
.inv-coming {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 38px 20px;
  gap: 16px;
}
.inv-coming-ic {
  width: 64px; height: 64px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(30,58,138,.08), rgba(124,58,237,.08));
  border: 1.5px dashed rgba(30,58,138,.32);
  color: #1E3A8A;
  display: flex; align-items: center; justify-content: center;
  font-size: 26px;
}
.inv-coming-title {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -.01em;
}
.inv-coming-sub {
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.7;
  max-width: 480px;
}

/* ═══════════════════════════════════════════════════════════════════
   Shared primitives mirrored from Fee/Accounts so this module renders
   identically when Fee/Accounts are unmounted (each ships its own CSS).
   ═══════════════════════════════════════════════════════════════════ */

/* Section header (used by detail history section) */
.fee-section-header {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-light);
}
.fee-section-title { display: flex; align-items: center; gap: 12px; min-width: 0; }
.fee-section-icon {
  width: 38px; height: 38px;
  border-radius: 11px;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px;
  box-shadow: 0 4px 12px rgba(30,58,138,.24);
  flex-shrink: 0;
}
.fee-section-name { font-size: 14px; font-weight: 800; color: var(--text-primary); letter-spacing: -.01em; }
.fee-section-sub  { font-size: 11.5px; color: var(--text-muted); margin-top: 1px; }

/* Buttons */
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
.fee-btn-xs { padding: 6px 11px; font-size: 11.5px; gap: 5px; border-radius: 8px; }
.fee-m-danger { color: #DC2626; }
.fee-m-danger:hover { background: rgba(220,38,38,.06); border-color: rgba(220,38,38,.32); }

/* Info banner */
.fee-info {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px;
  background: rgba(30,58,138,.06);
  border: 1.5px solid rgba(30,58,138,.18);
  border-radius: 12px;
  color: var(--text-secondary);
  font-size: 12.5px;
  margin-bottom: 14px;
  line-height: 1.55;
}
.fee-info i { color: #1E3A8A; font-size: 14px; flex-shrink: 0; }
.fee-info strong { color: var(--text-primary); }

/* Form field primitives */
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
textarea.fee-input { height: auto; padding: 10px 14px; resize: vertical; line-height: 1.5; }
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
.fee-hint { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-muted); }
.fee-hint i { color: #7C3AED; }
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
.fee-search-input, .fee-search-box input {
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

/* Modal overlay + container */
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
  animation: invModalIn .2s ease;
}
.fee-modal.lg { max-width: 720px; }
.fee-modal.sm { max-width: 440px; }
@keyframes invModalIn {
  from { transform: translateY(10px) scale(.98); opacity: 0; }
  to   { transform: none; opacity: 1; }
}
@media (max-width: 640px) {
  .fee-overlay { padding: 8px; }
  .fee-modal,
  .fee-modal.lg,
  .fee-modal.sm { max-width: 96vw; }
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

/* Overview banner (.acc-overview / -main / -stats) */
.acc-overview {
  background: linear-gradient(135deg, rgba(30,58,138,.06), rgba(124,58,237,.04));
  border: 1.5px solid rgba(30,58,138,.18);
  border-radius: 18px;
  padding: 20px 22px;
  margin-bottom: 14px;
  display: flex; align-items: center; justify-content: space-between;
  gap: 22px;
  flex-wrap: wrap;
}
.acc-overview-main { display: flex; align-items: center; gap: 16px; min-width: 0; flex: 1; }
.acc-overview-icon {
  width: 52px; height: 52px;
  border-radius: 14px;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px;
  box-shadow: 0 8px 20px rgba(30,58,138,.32);
  flex-shrink: 0;
}
.acc-overview-title { font-size: 17px; font-weight: 800; color: var(--text-primary); letter-spacing: -.01em; }
.acc-overview-sub { font-size: 12.5px; color: var(--text-secondary); margin-top: 3px; line-height: 1.6; max-width: 640px; }
.acc-overview-stats { display: flex; flex-wrap: wrap; gap: 12px; }
.acc-ov-stat {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  min-width: 152px;
  box-shadow: 0 1px 3px rgba(15,23,42,.04);
}
.acc-ov-stat-ic {
  width: 38px; height: 38px;
  border-radius: 11px;
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}
.acc-ov-stat-ic.all { background: linear-gradient(135deg, #1E3A8A, #1E40AF); }
.acc-ov-stat-ic.rev { background: linear-gradient(135deg, #16A34A, #15803D); }
.acc-ov-stat-ic.exp { background: linear-gradient(135deg, #DC2626, #B91C1C); }
.acc-ov-stat-val { font-size: 16px; font-weight: 800; color: var(--text-primary); letter-spacing: -.01em; }
.acc-ov-stat-lbl { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .3px; margin-top: 1px; }

/* How-to steps strip */
.acc-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}
.acc-step {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(15,23,42,.04);
}
.acc-step-no {
  width: 32px; height: 32px;
  border-radius: 10px;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800;
  font-size: 14px;
  box-shadow: 0 4px 12px rgba(30,58,138,.28);
  flex-shrink: 0;
}
.acc-step-title { font-size: 13px; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 6px; }
.acc-step-title i { color: #1E3A8A; font-size: 12px; }
.acc-step-desc { font-size: 12px; color: var(--text-muted); margin-top: 2px; line-height: 1.5; }

/* Active/Inactive segment */
.fee-seg {
  display: inline-flex;
  background: var(--bg-muted);
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  padding: 4px;
  gap: 3px;
  margin-bottom: 14px;
}
.fee-seg-btn {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 16px;
  border: none; background: transparent;
  border-radius: 9px;
  font-family: var(--font-body);
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-muted);
  cursor: pointer;
  transition: all .15s ease;
  white-space: nowrap;
}
.fee-seg-btn:hover:not(.active) { color: var(--text-primary); }
.fee-seg-btn.active {
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  box-shadow: 0 4px 12px rgba(30,58,138,.28);
}
.fee-seg-btn i { font-size: 11px; }

/* Subbar (back / title / spacer / actions) */
.inv-subbar {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 14px;
  margin-bottom: 14px;
  flex-wrap: wrap;
  box-shadow: 0 1px 2px rgba(15,23,42,.04);
}
.inv-subbar-title {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 13.5px; font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -.01em;
}
.inv-subbar-title i { color: #1E3A8A; }
.inv-subbar-spacer { flex: 1; }

/* Toolbar (filters row) */
.inv-toolbar {
  display: flex; gap: 12px; align-items: flex-end;
  flex-wrap: wrap;
}
.fee-section--filters { margin-bottom: 14px; overflow: visible; }
.fee-section--filters .fee-section-body { overflow: visible; }

/* Card grid */
.inv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}
.inv-card {
  position: relative;
  display: flex; flex-direction: column;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease;
  box-shadow: 0 1px 2px rgba(15,23,42,.04);
}
.inv-card::before {
  content: '';
  position: absolute; inset: 0;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(30,58,138,.06), rgba(37,99,235,.04) 60%, transparent);
  opacity: 0;
  pointer-events: none;
  transition: opacity .25s ease;
  z-index: 0;
}
.inv-card:hover {
  transform: translateY(-5px);
  border-color: var(--brand-primary);
  box-shadow: 0 14px 32px rgba(30,58,138,.16), 0 4px 10px rgba(15,23,42,.06);
}
.inv-card:hover::before { opacity: 1; }
.inv-card.inactive { opacity: .72; }
.inv-card.inactive:hover { opacity: .85; }
.inv-card > * { position: relative; z-index: 1; }
.inv-card-img {
  position: relative;
  height: 130px;
  background: linear-gradient(135deg, var(--brand-light), #EEF4FF);
  display: flex; align-items: center; justify-content: center;
  border-bottom: 1px solid var(--border-light);
  overflow: hidden;
}
.inv-card-img img {
  width: 100%; height: 100%;
  object-fit: cover;
  transition: transform .35s ease;
}
.inv-card-img > i {
  font-size: 42px;
  color: var(--brand-primary);
  transition: transform .35s ease, color .25s ease;
}
.inv-card:hover .inv-card-img img { transform: scale(1.06); }
.inv-card:hover .inv-card-img > i { transform: scale(1.12); color: var(--brand-mid); }
.inv-card-statusbadge {
  position: absolute;
  top: 9px; right: 9px;
  transition: transform .25s ease, box-shadow .25s ease;
}
.inv-card:hover .inv-card-statusbadge {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(15,23,42,.10);
  border-radius: 999px;
}
.inv-card-body { padding: 13px 15px; display: flex; flex-direction: column; gap: 7px; flex: 1; }
.inv-card-name {
  font-size: 14px; font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -.01em; line-height: 1.25;
  transition: color .2s ease;
}
.inv-card:hover .inv-card-name { color: var(--brand-primary); }
.inv-card-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: var(--brand-primary);
  font-weight: 700;
  letter-spacing: .4px;
}
.inv-card-meta {
  display: flex; flex-wrap: wrap; gap: 5px 12px;
  margin-top: 2px;
  font-size: 11.5px;
  color: var(--text-muted);
  font-weight: 600;
}
.inv-card-meta span { display: inline-flex; align-items: center; gap: 5px; }
.inv-card-meta i { font-size: 11px; color: var(--brand-mid); opacity: .8; }
.inv-card-meta strong { color: var(--text-primary); font-weight: 700; }
.inv-card-foot {
  display: flex; gap: 6px;
  padding: 10px 12px;
  border-top: 1px solid var(--border-light);
  background: var(--bg-muted);
  transition: background .25s ease;
}
.inv-card:hover .inv-card-foot { background: rgba(30,58,138,.04); }
.inv-card-foot .fee-btn { transition: all .15s ease; }
.inv-card-foot .fee-btn:hover {
  background: var(--brand-primary);
  color: #fff;
  border-color: var(--brand-primary);
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(30,58,138,.28);
}
.inv-card-foot .fee-btn.fee-m-danger:hover {
  background: #DC2626;
  border-color: #DC2626;
  color: #fff;
  box-shadow: 0 4px 10px rgba(220,38,38,.32);
}
[data-theme="dark"] .inv-card:hover .inv-card-foot { background: rgba(59,130,246,.08); }
[data-theme="dark"] .inv-card:hover .inv-card-name { color: #93C5FD; }
[data-theme="dark"] .inv-card-foot .fee-btn:hover { background: #2563EB; border-color: #2563EB; }

/* Status pills */
.inv-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: .3px;
  border: 1px solid;
  white-space: nowrap;
}
.inv-pill-green { background: rgba(22,163,74,.12); color: #15803D; border-color: rgba(22,163,74,.28); }
.inv-pill-blue  { background: rgba(30,58,138,.08); color: #1E40AF; border-color: rgba(30,58,138,.22); }
.inv-pill-amber { background: rgba(217,119,6,.10); color: #B45309; border-color: rgba(217,119,6,.28); }
.inv-pill-red   { background: rgba(220,38,38,.10); color: #B91C1C; border-color: rgba(220,38,38,.28); }
.inv-pill-grey  { background: rgba(100,116,139,.10); color: #475569; border-color: rgba(100,116,139,.24); }

/* Empty state */
.inv-empty {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  padding: 36px 20px;
  gap: 12px;
}
.inv-empty-ic {
  width: 60px; height: 60px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(30,58,138,.08), rgba(124,58,237,.08));
  border: 1.5px dashed rgba(30,58,138,.32);
  color: #1E3A8A;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px;
}
.inv-empty-title { font-size: 15px; font-weight: 800; color: var(--text-primary); }
.inv-empty-sub { font-size: 12.5px; color: var(--text-muted); max-width: 360px; line-height: 1.6; }

/* Item detail grid */
.inv-detail-grid {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 16px;
  align-items: flex-start;
}
@media (max-width: 880px) { .inv-detail-grid { grid-template-columns: 1fr; } }
.inv-detail-imgcard {
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(15,23,42,.05);
}
.inv-detail-img {
  height: 220px;
  background: linear-gradient(135deg, #F1F3F8, #E5E9F2);
  display: flex; align-items: center; justify-content: center;
  border-bottom: 1px solid var(--border-light);
}
.inv-detail-img img { width: 100%; height: 100%; object-fit: cover; }
.inv-detail-img > i { font-size: 70px; color: #94A3B8; }
.inv-detail-imgcard-body { padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.inv-detail-pills { display: flex; flex-wrap: wrap; gap: 7px; }
.inv-barcode-box {
  background: var(--bg-muted);
  border: 1.5px dashed var(--border-light);
  border-radius: 11px;
  padding: 12px 10px;
  text-align: center;
}
.inv-barcode-svgwrap { display: flex; justify-content: center; }
.inv-barcode-svg { width: 100%; max-width: 240px; height: 60px; display: block; }
.inv-barcode-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 2px;
  color: var(--text-primary);
  margin-top: 6px;
}
.inv-barcode-printrow {
  display: flex;
  justify-content: center;
}
.inv-detail-rows {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 16px;
  padding: 16px;
}
.inv-detail-row { display: flex; flex-direction: column; gap: 4px; }
.inv-detail-row.full { grid-column: 1 / -1; }
.inv-detail-row-lbl {
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--text-muted);
}
.inv-detail-row-val {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.5;
}
.inv-detail-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #1E3A8A;
  font-weight: 800;
  letter-spacing: .5px;
}
.inv-detail-desc { font-weight: 600; font-size: 12.5px; color: var(--text-secondary); }

/* History timeline */
.inv-history-item {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 9px 0;
  border-bottom: 1px dashed var(--border-light);
}
.inv-history-item:last-child { border-bottom: 0; }
.inv-history-dot {
  width: 24px; height: 24px;
  border-radius: 50%;
  background: rgba(30,58,138,.10);
  color: #1E3A8A;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px;
  flex-shrink: 0;
  margin-top: 1px;
}
.inv-history-txt { font-size: 12.5px; font-weight: 700; color: var(--text-primary); }
.inv-history-time {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
  display: flex; align-items: center; gap: 5px;
}
.inv-history-time i { font-size: 9.5px; }
.inv-history-empty { color: var(--text-muted); font-size: 12.5px; }

/* Form grid (modal body) */
.inv-form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}
.inv-form-grid .fee-field.full { grid-column: 1 / -1; }
@media (max-width: 620px) { .inv-form-grid { grid-template-columns: 1fr; } }

/* Image upload area */
.inv-upload {
  position: relative;
  border: 2px dashed var(--border-med);
  border-radius: 14px;
  background: var(--bg-muted);
  min-height: 140px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  overflow: hidden;
  transition: all .2s ease;
}
.inv-upload:hover { border-color: #1E3A8A; background: rgba(30,58,138,.04); }
.inv-upload-empty {
  text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 5px;
  color: var(--text-muted);
}
.inv-upload-empty > i { font-size: 28px; color: #1E3A8A; }
.inv-upload-lbl { font-size: 13px; font-weight: 700; color: var(--text-primary); }
.inv-upload-hint { font-size: 11px; color: var(--text-muted); }
.inv-upload-preview { max-width: 100%; max-height: 180px; display: block; }

/* Confirm message */
.inv-confirm-msg {
  font-size: 13.5px;
  color: var(--text-secondary);
  line-height: 1.6;
}
.inv-confirm-msg code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: var(--bg-muted);
  padding: 1px 6px;
  border-radius: 5px;
  color: #1E3A8A;
  font-size: 12.5px;
}

/* ═══════════════════════════════════════════════════════════════════
   POINT OF SALE — product grid, search dropdown, cart sidebar, qty
   stepper, format picker, summary block.
   ═══════════════════════════════════════════════════════════════════ */

/* Two-column layout: products + sticky cart */
.inv-pos-wrap {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 16px;
  align-items: start;
}
@media (max-width: 960px) {
  .inv-pos-wrap { grid-template-columns: 1fr; }
  .inv-cart { position: relative; max-height: none; top: 0; }
}

/* Product grid — scrollable inside its own pane so the search box,
   info banner and cart sidebar stay anchored. */
.inv-pos-products {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  max-height: calc(100vh - 280px);
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 10px 4px 2px;
  margin-right: -4px;
  scroll-behavior: smooth;
}
.inv-pos-products::-webkit-scrollbar {
  width: 8px;
}
.inv-pos-products::-webkit-scrollbar-track {
  background: var(--bg-muted);
  border-radius: 999px;
}
.inv-pos-products::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #1E3A8A, #1E40AF);
  border-radius: 999px;
  border: 2px solid var(--bg-muted);
}
.inv-pos-products::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #1E40AF, #2563EB);
}
.inv-pos-products {
  scrollbar-width: thin;
  scrollbar-color: #1E3A8A var(--bg-muted);
}
@media (max-width: 960px) {
  .inv-pos-products { max-height: 70vh; }
}
[data-theme="dark"] .inv-pos-products::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #2563EB, #3B82F6);
  border-color: var(--bg-muted);
}
.inv-pos-prod {
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  background: var(--bg-card);
  box-shadow: 0 1px 2px rgba(15,23,42,.04);
  overflow: hidden;
  cursor: pointer;
  transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
  display: flex;
  flex-direction: column;
}
.inv-pos-prod:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 22px rgba(15,23,42,.10);
  border-color: var(--brand-primary);
}
.inv-pos-prod.out { opacity: .5; pointer-events: none; }
.inv-pos-prod-img {
  position: relative;
  height: 84px;
  background: linear-gradient(135deg, var(--brand-light), #EEF4FF);
  display: flex; align-items: center; justify-content: center;
  font-size: 30px;
  color: var(--brand-primary);
  overflow: hidden;
}
.inv-pos-prod-img img { width: 100%; height: 100%; object-fit: cover; }
.inv-pos-prod-body {
  padding: 9px 11px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.inv-pos-prod-name { font-size: 12.5px; font-weight: 800; color: var(--text-primary); line-height: 1.2; }
.inv-pos-prod-price { font-size: 13px; font-weight: 800; color: var(--brand-primary); }
.inv-pos-prod-stock { font-size: 10.5px; font-weight: 700; color: var(--text-muted); margin-top: auto; }
.inv-pos-lowtag { position: absolute; top: 6px; left: 6px; }

/* Search results dropdown */
.inv-pos-searchresults {
  position: absolute;
  top: calc(100% + 6px);
  left: 0; right: 0;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  box-shadow: 0 18px 40px rgba(15,23,42,.18);
  z-index: 30;
  max-height: 320px;
  overflow-y: auto;
  display: none;
}
.inv-pos-searchresults.open { display: block; }
.inv-pos-sr-item {
  display: flex; align-items: center; gap: 11px;
  padding: 10px 13px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-light);
  transition: background .15s ease;
}
.inv-pos-sr-item:last-child { border-bottom: none; }
.inv-pos-sr-item:hover { background: var(--bg-muted); }
.inv-pos-sr-ic {
  width: 34px; height: 34px;
  border-radius: 9px;
  background: var(--brand-light);
  color: var(--brand-primary);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}
.inv-pos-sr-name { font-size: 13px; font-weight: 800; color: var(--text-primary); }
.inv-pos-sr-sub { font-size: 11px; color: var(--text-muted); margin-top: 1px; }
.inv-pos-sr-add { color: #16A34A; font-size: 13px; }

/* Cart sidebar */
.inv-cart {
  position: sticky;
  top: 14px;
  border: 1.5px solid var(--border-light);
  border-radius: 16px;
  background: var(--bg-card);
  box-shadow: 0 2px 10px rgba(15,23,42,.06);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 40px);
}
.inv-cart-head {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-light);
  background: linear-gradient(135deg, rgba(22,163,74,.06), transparent);
  display: flex; align-items: center; justify-content: space-between;
}
.inv-cart-head-title {
  font-size: 14.5px;
  font-weight: 800;
  color: var(--text-primary);
  display: flex; align-items: center; gap: 8px;
}
.inv-cart-head-title i { color: #16A34A; }

.inv-cart-items {
  padding: 10px 16px;
  overflow-y: auto;
  flex: 1;
  min-height: 90px;
}
.inv-cart-empty {
  text-align: center;
  color: var(--text-muted);
  font-size: 12.5px;
  padding: 26px 10px;
}
.inv-cart-empty i {
  font-size: 30px;
  color: var(--border-med);
  display: block;
  margin-bottom: 9px;
}
.inv-cart-row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 0;
  border-bottom: 1px dashed var(--border-light);
}
.inv-cart-row:last-child { border-bottom: none; }
.inv-cart-row-name {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.25;
}
.inv-cart-row-price {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 600;
  margin-top: 2px;
}

/* Qty stepper */
.inv-qty {
  display: flex; align-items: center;
  border: 1.5px solid var(--border-light);
  border-radius: 8px;
  overflow: hidden;
}
.inv-qty button {
  width: 26px; height: 28px;
  border: none;
  background: var(--bg-muted);
  color: var(--brand-primary);
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background .15s ease;
}
.inv-qty button:hover { background: var(--brand-light); }
.inv-qty-val {
  width: 32px;
  text-align: center;
  font-size: 13px;
  font-weight: 800;
  color: var(--text-primary);
}

.inv-cart-row-tot {
  font-size: 13px;
  font-weight: 800;
  color: var(--text-primary);
  min-width: 64px;
  text-align: right;
  white-space: nowrap;
}
.inv-cart-del {
  width: 26px; height: 26px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  transition: background .15s ease, color .15s ease;
}
.inv-cart-del:hover { background: rgba(220,38,38,.10); color: #DC2626; }

/* Cart footer (buyer + discount + totals + close-sale button) */
.inv-cart-foot {
  padding: 14px 16px;
  border-top: 1px solid var(--border-light);
  background: var(--bg-muted);
}
.inv-cart-total-row {
  display: flex; justify-content: space-between;
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 700;
  margin-bottom: 6px;
}
.inv-cart-disc-row { color: #DC2626; }
.inv-cart-grand {
  display: flex; justify-content: space-between; align-items: baseline;
  font-size: 15px;
  font-weight: 800;
  color: var(--text-primary);
  padding-top: 9px;
  border-top: 2px solid var(--border-light);
  margin-top: 4px;
}
.inv-cart-grand span:last-child {
  font-size: 20px;
  color: #16A34A;
}
.inv-cart-closebtn {
  width: 100%;
  margin-top: 14px;
  background: linear-gradient(135deg, #16A34A, #15803D) !important;
  color: #fff !important;
  border-color: transparent !important;
  box-shadow: 0 4px 14px rgba(22,163,74,.28) !important;
}
.inv-cart-closebtn:hover { box-shadow: 0 8px 22px rgba(22,163,74,.36) !important; }
.inv-cart-closebtn:disabled {
  opacity: .55;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: 0 2px 6px rgba(22,163,74,.18) !important;
}

/* Checkout summary block */
.inv-co-sum {
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  overflow: hidden;
}
.inv-co-line {
  display: flex; justify-content: space-between; align-items: center;
  padding: 9px 14px;
  font-size: 13px;
  border-bottom: 1px solid var(--border-light);
}
.inv-co-line:last-child { border-bottom: none; }
.inv-co-line .nm { color: var(--text-secondary); }
.inv-co-line .vl { font-weight: 700; color: var(--text-primary); }
.inv-co-tot {
  background: var(--bg-muted);
  font-size: 15px;
}
.inv-co-tot .vl {
  color: var(--brand-primary);
  font-weight: 800;
}

/* Invoice format picker */
.inv-fmt-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.inv-fmt-opt {
  position: relative;
  text-align: left;
  border: 2px solid var(--border-light);
  border-radius: 14px;
  background: var(--bg-card);
  padding: 16px;
  cursor: pointer;
  transition: all .2s ease;
  display: flex; flex-direction: column; gap: 6px;
  font-family: var(--font-body);
}
.inv-fmt-opt:hover {
  border-color: var(--brand-mid);
  box-shadow: 0 4px 12px rgba(30,58,138,.10);
}
.inv-fmt-opt.active {
  border-color: var(--brand-primary);
  background: linear-gradient(135deg, rgba(30,58,138,.05), transparent);
  box-shadow: 0 4px 14px rgba(30,58,138,.14);
}
.inv-fmt-ic {
  width: 40px; height: 40px;
  border-radius: 10px;
  background: var(--bg-muted);
  display: flex; align-items: center; justify-content: center;
  font-size: 18px;
  color: var(--brand-primary);
  margin-bottom: 2px;
  transition: background .2s ease, color .2s ease;
}
.inv-fmt-opt.active .inv-fmt-ic {
  background: linear-gradient(135deg, #1E3A8A, #2563EB);
  color: #fff;
}
.inv-fmt-name { font-size: 14px; font-weight: 800; color: var(--text-primary); }
.inv-fmt-desc { font-size: 11px; color: var(--text-muted); line-height: 1.5; }
.inv-fmt-check {
  position: absolute; top: 12px; right: 12px;
  font-size: 17px;
  color: var(--brand-primary);
  opacity: 0;
  transform: scale(.6);
  transition: all .2s ease;
}
.inv-fmt-opt.active .inv-fmt-check { opacity: 1; transform: scale(1); }

.inv-confirm-sale {
  background: linear-gradient(135deg, #16A34A, #15803D) !important;
  color: #fff !important;
  border-color: transparent !important;
  box-shadow: 0 4px 14px rgba(22,163,74,.28) !important;
}
.inv-confirm-sale:hover { box-shadow: 0 8px 22px rgba(22,163,74,.36) !important; }

/* Green "Add Product" button (matches POS branding) */
.inv-add-prodbtn {
  background: linear-gradient(135deg, #16A34A, #15803D) !important;
  color: #fff !important;
  border-color: transparent !important;
  box-shadow: 0 4px 14px rgba(22,163,74,.28) !important;
}
.inv-add-prodbtn:hover { box-shadow: 0 8px 22px rgba(22,163,74,.36) !important; }

/* ═══════════════════════════════════════════════════════════════════
   KPI strip (used by Sales History, mirrors Fee/Accounts pattern)
   ═══════════════════════════════════════════════════════════════════ */
.fee-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}
.fee-kpi {
  position: relative;
  padding: 16px 18px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(15,23,42,.04);
  overflow: hidden;
}
.fee-kpi::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 4px;
}
.fee-kpi.k-green::before { background: linear-gradient(180deg, #16A34A, #15803D); }
.fee-kpi.k-blue::before  { background: linear-gradient(180deg, #1E3A8A, #1E40AF); }
.fee-kpi.k-amber::before { background: linear-gradient(180deg, #D97706, #B45309); }
.fee-kpi.k-red::before   { background: linear-gradient(180deg, #DC2626, #B91C1C); }
.fee-kpi-top {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 8px;
}
.fee-kpi-label {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .4px;
  color: var(--text-muted);
}
.fee-kpi-ic {
  width: 32px; height: 32px;
  border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px;
}
.fee-kpi-val {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -.01em;
  font-variant-numeric: tabular-nums;
}
.fee-kpi-meta {
  font-size: 11.5px;
  color: var(--text-muted);
  margin-top: 4px;
  font-weight: 600;
}

/* ═══════════════════════════════════════════════════════════════════
   Sales history table
   ═══════════════════════════════════════════════════════════════════ */
.inv-sales-tablewrap { overflow-x: auto; }
.inv-sales-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.inv-sales-table thead th {
  text-align: left;
  padding: 12px 16px;
  background: var(--bg-muted);
  border-bottom: 1.5px solid var(--border-light);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .4px;
  color: var(--text-muted);
  white-space: nowrap;
}
.inv-sales-table th.c, .inv-sales-table td.c { text-align: center; }
.inv-sales-table th.r, .inv-sales-table td.r { text-align: right; }
.inv-sales-table tbody td {
  padding: 13px 16px;
  border-bottom: 1px solid var(--border-light);
  vertical-align: top;
  color: var(--text-secondary);
}
.inv-sales-table tbody tr:last-child td { border-bottom: none; }
.inv-sales-table tbody tr:hover td { background: rgba(30,58,138,.04); }
.inv-sales-no {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 800;
  color: var(--brand-primary);
  letter-spacing: .3px;
  white-space: nowrap;
}
.inv-sales-items {
  font-size: 11.5px;
  color: var(--text-muted);
  max-width: 360px;
  line-height: 1.55;
}
.inv-sales-total {
  font-weight: 800;
  color: var(--text-primary);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.inv-sales-empty {
  text-align: center;
  padding: 36px 20px !important;
  color: var(--text-muted) !important;
  font-style: italic;
}

/* Red "Download Report" CTA — consistent with Accounts module */
.acc-dlreport-btn {
  background: linear-gradient(135deg, #DC2626, #B91C1C) !important;
  color: #fff !important;
  border-color: transparent !important;
  box-shadow: 0 6px 16px rgba(220,38,38,.28) !important;
}
.acc-dlreport-btn i { color: #fff !important; }
.acc-dlreport-btn:hover {
  background: linear-gradient(135deg, #B91C1C, #991B1B) !important;
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(220,38,38,.36) !important;
}

/* ═══════════════════════════════════════════════════════════════════
   Reports — tile group titles + tile cards
   ═══════════════════════════════════════════════════════════════════ */
.inv-rep-group-title {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: .3px;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin: 6px 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--border-light);
}
.inv-rep-group-title i { color: #1E3A8A; font-size: 13px; }

/* Page-level Report Style toggle (Colorful / Colorless) */
.inv-rep-style-row {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin: 8px 0 12px;
  padding: 12px 16px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 12px;
  box-shadow: var(--shadow-xs, 0 1px 2px rgba(15,23,42,.04));
}
.inv-rep-style-lbl {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--text-muted);
}
.inv-rep-style-seg {
  display: inline-flex;
  background: var(--bg-muted);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  padding: 3px;
  gap: 3px;
}
.inv-rep-style-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 14px;
  border: none;
  background: transparent;
  border-radius: 7px;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-secondary);
  transition: all .18s ease;
}
.inv-rep-style-btn i { font-size: 11px; }
.inv-rep-style-btn:hover { color: var(--brand-primary, #1E40AF); }
.inv-rep-style-btn.on {
  background: var(--bg-card);
  color: var(--brand-primary, #1E40AF);
  box-shadow: 0 1px 3px rgba(15,23,42,.10);
}
.inv-rep-style-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(30,64,175,.22);
}
[data-theme="dark"] .inv-rep-style-row { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .inv-rep-style-seg { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .inv-rep-style-btn.on { background: var(--bg-card); color: #93C5FD; }
[data-theme="dark"] .inv-rep-style-btn:focus-visible { box-shadow: 0 0 0 3px rgba(59,130,246,.32); }
@media (max-width: 520px) {
  .inv-rep-style-row { padding: 10px 12px; }
  .inv-rep-style-btn { padding: 7px 11px; font-size: 11.5px; }
}

.inv-rep-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}
.inv-rep-tile {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-light);
  border-radius: 14px;
  cursor: pointer;
  text-align: left;
  font-family: var(--font-body);
  transition: all .2s ease;
  box-shadow: 0 1px 2px rgba(15,23,42,.04);
  overflow: hidden;
}
.inv-rep-tile::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(30,58,138,.05), transparent 70%);
  opacity: 0;
  pointer-events: none;
  transition: opacity .2s ease;
}
.inv-rep-tile:hover {
  transform: translateY(-3px);
  border-color: var(--brand-primary);
  box-shadow: 0 12px 28px rgba(15,23,42,.10);
}
.inv-rep-tile:hover::before { opacity: 1; }
.inv-rep-tile > * { position: relative; z-index: 1; }
.inv-rep-tile-ic {
  width: 42px; height: 42px;
  border-radius: 11px;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(30,58,138,.32);
  transition: transform .2s ease;
}
.inv-rep-tile:hover .inv-rep-tile-ic { transform: scale(1.05); }
.inv-rep-tile--green .inv-rep-tile-ic {
  background: linear-gradient(135deg, #16A34A, #15803D);
  box-shadow: 0 4px 12px rgba(22,163,74,.32);
}
.inv-rep-tile--green:hover { border-color: #16A34A; }
.inv-rep-tile-name { font-size: 13.5px; font-weight: 800; color: var(--text-primary); letter-spacing: -.01em; line-height: 1.3; }
.inv-rep-tile-desc { font-size: 11.5px; color: var(--text-muted); margin-top: 3px; line-height: 1.5; }
.inv-rep-tile-arrow {
  margin-left: auto;
  width: 26px; height: 26px;
  border-radius: 8px;
  background: var(--bg-muted);
  display: flex; align-items: center; justify-content: center;
  color: var(--brand-primary);
  font-size: 11px;
  flex-shrink: 0;
  transition: all .2s ease;
}
.inv-rep-tile:hover .inv-rep-tile-arrow {
  background: var(--brand-primary);
  color: #fff;
  transform: translateX(3px);
}
.inv-rep-tile--green:hover .inv-rep-tile-arrow { background: #16A34A; }

[data-theme="dark"] .inv-rep-tile { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .inv-rep-tile:hover { border-color: #2563EB; }
[data-theme="dark"] .inv-rep-tile--green:hover { border-color: #16A34A; }
[data-theme="dark"] .inv-rep-tile-arrow { background: var(--bg-muted); color: #93C5FD; }
[data-theme="dark"] .inv-rep-tile-arrow .fa-arrow-right { color: inherit; }
[data-theme="dark"] .inv-rep-group-title i { color: #93C5FD; }

/* ═══════════════════════════════════════════════════════════════════
   Barcode size picker (modal contents)
   ═══════════════════════════════════════════════════════════════════ */
.inv-bc-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 18px;
  background: linear-gradient(135deg, rgba(30,58,138,.04), rgba(59,130,246,.02));
  border: 1.5px dashed rgba(30,58,138,.22);
  border-radius: 14px;
}
.inv-bc-preview-stage {
  display: flex; align-items: center; justify-content: center;
  padding: 10px;
}
.inv-bc-preview-label {
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 6px 8px;
  display: flex; flex-direction: column; align-items: center; justify-content: space-between;
  gap: 3px;
  box-shadow: 0 6px 16px rgba(15,23,42,.10);
  overflow: hidden;
  transition: width .2s ease, height .2s ease;
}
.inv-bc-preview-label .bc-pv-school {
  font-size: 9.5px; font-weight: 800; color: #1E3A8A;
  letter-spacing: .3px; text-align: center; line-height: 1.15;
}
.inv-bc-preview-label .bc-pv-name {
  font-size: 11px; font-weight: 700; color: #111;
  text-align: center; line-height: 1.2; max-width: 100%;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.inv-bc-preview-label .bc-pv-bar {
  flex: 1; width: 100%;
  display: flex; align-items: center; justify-content: center;
  min-height: 0;
}
.inv-bc-preview-label .bc-pv-bar svg { width: 100%; height: 100%; display: block; }
.inv-bc-preview-label .bc-pv-code {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 11px; font-weight: 800; letter-spacing: 1.5px;
  color: #111;
}
.inv-bc-preview-meta {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.inv-bc-preview-meta i { color: #1E3A8A; }
.inv-bc-preview-meta strong { color: var(--text-primary); font-variant-numeric: tabular-nums; }

.inv-bc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}
.inv-bc-opt {
  position: relative;
  text-align: left;
  border: 2px solid var(--border-light);
  border-radius: 14px;
  background: var(--bg-card);
  padding: 14px 14px 12px;
  cursor: pointer;
  transition: all .2s ease;
  font-family: var(--font-body);
  display: flex; flex-direction: column; gap: 4px;
}
.inv-bc-opt:hover {
  border-color: var(--brand-mid);
  box-shadow: 0 4px 14px rgba(30,58,138,.10);
  transform: translateY(-1px);
}
.inv-bc-opt.active {
  border-color: var(--brand-primary);
  background: linear-gradient(135deg, rgba(30,58,138,.06), transparent);
  box-shadow: 0 6px 18px rgba(30,58,138,.16);
}
.inv-bc-opt-top {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 4px;
}
.inv-bc-opt-ic {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: var(--bg-muted);
  display: flex; align-items: center; justify-content: center;
  font-size: 15px;
  color: var(--brand-primary);
  transition: all .2s ease;
}
.inv-bc-opt.active .inv-bc-opt-ic {
  background: linear-gradient(135deg, #1E3A8A, #2563EB);
  color: #fff;
}
.inv-bc-opt-check {
  font-size: 17px;
  color: var(--brand-primary);
  opacity: 0;
  transform: scale(.6);
  transition: all .2s ease;
}
.inv-bc-opt.active .inv-bc-opt-check { opacity: 1; transform: scale(1); }
.inv-bc-opt-name { font-size: 13.5px; font-weight: 800; color: var(--text-primary); }
.inv-bc-opt-dims {
  font-size: 11px;
  font-weight: 700;
  color: var(--brand-primary);
  letter-spacing: .2px;
  font-variant-numeric: tabular-nums;
}
.inv-bc-opt-desc {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.5;
  margin-top: 2px;
}

.inv-bc-copyrow {
  display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end;
  margin-top: 18px;
  padding: 14px;
  background: var(--bg-muted);
  border-radius: 12px;
}
.inv-bc-copyhint {
  display: inline-flex; align-items: center; gap: 7px;
  font-size: 12px;
  color: var(--text-muted);
  flex: 1;
  min-width: 220px;
}
.inv-bc-copyhint i { color: var(--brand-primary); }

[data-theme="dark"] .inv-bc-preview {
  background: linear-gradient(135deg, rgba(59,130,246,.08), rgba(167,139,250,.05));
  border-color: rgba(59,130,246,.32);
}
[data-theme="dark"] .inv-bc-opt { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .inv-bc-opt-name { color: var(--text-primary); }
[data-theme="dark"] .inv-bc-opt-ic { background: var(--bg-muted); color: #93C5FD; }
[data-theme="dark"] .inv-bc-opt.active { background: linear-gradient(135deg, rgba(59,130,246,.10), transparent); border-color: #2563EB; }
[data-theme="dark"] .inv-bc-opt-dims, [data-theme="dark"] .inv-bc-opt-check { color: #93C5FD; }
[data-theme="dark"] .inv-bc-copyrow { background: var(--bg-muted); }

/* Icon-only button (for the print column) */
.fee-iconbtn {
  width: 34px; height: 34px;
  border-radius: 9px;
  border: 1.5px solid var(--border-light);
  background: var(--bg-card);
  color: var(--brand-primary);
  font-size: 13px;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: all .15s ease;
}
.fee-iconbtn:hover {
  background: var(--brand-primary);
  color: #fff;
  border-color: var(--brand-primary);
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(30,58,138,.28);
}

/* ── Dark mode ── */
[data-theme="dark"] .fee-subtabs { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .fee-subtab { color: var(--text-muted); }
[data-theme="dark"] .fee-subtab:hover:not(.active) { background: var(--bg-muted); color: var(--text-primary); }
[data-theme="dark"] .fee-section { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .fee-btn-ghost { background: var(--bg-card); border-color: var(--border-light); color: var(--text-secondary); }
[data-theme="dark"] .fee-info { background: rgba(59,130,246,.08); border-color: rgba(59,130,246,.22); color: var(--text-secondary); }
[data-theme="dark"] .fee-info i { color: #93C5FD; }
[data-theme="dark"] .fee-input,
[data-theme="dark"] .fee-select,
[data-theme="dark"] .fee-search-box { background: var(--bg-card); border-color: var(--border-light); color: var(--text-primary); }
[data-theme="dark"] .fee-modal { background: var(--bg-card); }
[data-theme="dark"] .fee-modal-foot { background: var(--bg-muted); }
[data-theme="dark"] .fee-seg { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .acc-overview { background: linear-gradient(135deg, rgba(59,130,246,.10), rgba(167,139,250,.06)); border-color: rgba(59,130,246,.30); }
[data-theme="dark"] .acc-overview-title, [data-theme="dark"] .acc-step-title { color: var(--text-primary); }
[data-theme="dark"] .acc-overview-sub, [data-theme="dark"] .acc-step-desc { color: var(--text-secondary); }
[data-theme="dark"] .acc-ov-stat, [data-theme="dark"] .acc-step, [data-theme="dark"] .inv-subbar { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .inv-card { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .inv-card-img { background: linear-gradient(135deg, rgba(59,130,246,.12), rgba(37,99,235,.05)); border-color: var(--border-light); }
[data-theme="dark"] .inv-card-img > i, [data-theme="dark"] .inv-detail-img > i { color: #93C5FD; }
[data-theme="dark"] .inv-card-code { color: #93C5FD; }
[data-theme="dark"] .inv-card-meta i { color: #93C5FD; }
[data-theme="dark"] .inv-card-foot { background: var(--bg-muted); }
[data-theme="dark"] .inv-detail-imgcard, [data-theme="dark"] .inv-detail-rows { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .inv-detail-img { background: linear-gradient(135deg, rgba(30,58,138,.18), rgba(15,23,42,.32)); border-color: var(--border-light); }
[data-theme="dark"] .inv-detail-mono { color: #93C5FD; }
[data-theme="dark"] .inv-history-dot { background: rgba(59,130,246,.18); color: #93C5FD; }
[data-theme="dark"] .inv-upload { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .inv-upload:hover { border-color: #2563EB; background: rgba(59,130,246,.06); }
[data-theme="dark"] .inv-upload-empty > i { color: #93C5FD; }
[data-theme="dark"] .inv-barcode-box { background: var(--bg-muted); border-color: var(--border-light); }
[data-theme="dark"] .inv-coming-ic {
  background: linear-gradient(135deg, rgba(59,130,246,.10), rgba(167,139,250,.10));
  border-color: rgba(59,130,246,.40);
  color: #93C5FD;
}
[data-theme="dark"] .inv-pos-prod { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .inv-pos-prod-img { background: linear-gradient(135deg, rgba(59,130,246,.12), rgba(37,99,235,.05)); color: #93C5FD; }
[data-theme="dark"] .inv-pos-prod-name { color: var(--text-primary); }
[data-theme="dark"] .inv-pos-prod-price { color: #93C5FD; }
[data-theme="dark"] .inv-pos-searchresults { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .inv-pos-sr-ic { background: rgba(59,130,246,.16); color: #93C5FD; }
[data-theme="dark"] .inv-pos-sr-name { color: var(--text-primary); }
[data-theme="dark"] .inv-cart { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .inv-cart-head { background: linear-gradient(135deg, rgba(22,163,74,.10), transparent); }
[data-theme="dark"] .inv-cart-head-title { color: var(--text-primary); }
[data-theme="dark"] .inv-cart-row-name, [data-theme="dark"] .inv-cart-row-tot, [data-theme="dark"] .inv-cart-grand { color: var(--text-primary); }
[data-theme="dark"] .inv-cart-foot { background: var(--bg-muted); }
[data-theme="dark"] .inv-qty { border-color: var(--border-light); }
[data-theme="dark"] .inv-qty button { background: var(--bg-card); color: #93C5FD; }
[data-theme="dark"] .inv-qty button:hover { background: rgba(59,130,246,.16); }
[data-theme="dark"] .inv-co-sum, [data-theme="dark"] .inv-fmt-opt { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .inv-co-line .vl { color: var(--text-primary); }
[data-theme="dark"] .inv-co-tot { background: var(--bg-muted); }
[data-theme="dark"] .inv-co-tot .vl { color: #93C5FD; }
[data-theme="dark"] .inv-fmt-name { color: var(--text-primary); }
[data-theme="dark"] .inv-fmt-ic { background: var(--bg-muted); color: #93C5FD; }
[data-theme="dark"] .inv-fmt-opt.active { background: linear-gradient(135deg, rgba(59,130,246,.10), transparent); border-color: #2563EB; }
[data-theme="dark"] .inv-fmt-opt.active .inv-fmt-ic { background: linear-gradient(135deg, #1E3A8A, #2563EB); color: #fff; }
[data-theme="dark"] .inv-fmt-check { color: #93C5FD; }
[data-theme="dark"] .fee-kpi { background: var(--bg-card); border-color: var(--border-light); }
[data-theme="dark"] .fee-kpi-val { color: var(--text-primary); }
[data-theme="dark"] .inv-sales-table thead th { background: var(--bg-muted); border-color: var(--border-light); color: var(--text-muted); }
[data-theme="dark"] .inv-sales-table tbody td { border-color: var(--border-light); color: var(--text-secondary); }
[data-theme="dark"] .inv-sales-table tbody tr:hover td { background: rgba(59,130,246,.08); }
[data-theme="dark"] .inv-sales-no { color: #93C5FD; }
[data-theme="dark"] .inv-sales-total { color: var(--text-primary); }
[data-theme="dark"] .fee-iconbtn { background: var(--bg-card); border-color: var(--border-light); color: #93C5FD; }
[data-theme="dark"] .fee-iconbtn:hover { background: #2563EB; color: #fff; border-color: #2563EB; }

/* ═══════════════════════════════════════════════════════════════════
   MOBILE RESPONSIVE — internal screen layouts (≤ 600px)
   Items, POS, Sales / Receipts tabs of Inventory.
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

  /* Sub-tabs already overflow-x; tighten on mobile */
  .fee-subtabs { padding: 4px; gap: 4px; border-radius: 12px; scrollbar-width: none; }
  .fee-subtabs::-webkit-scrollbar { display: none; }
  .fee-subtab {
    flex: 0 0 auto;
    white-space: nowrap;
    padding: 10px 14px;
    font-size: 12.5px;
    border-radius: 10px;
  }

  /* Overview banner */
  .acc-overview {
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
    padding: 14px;
    border-radius: 14px;
  }
  .acc-overview-icon { width: 44px; height: 44px; font-size: 18px; border-radius: 12px; }
  .acc-overview-title { font-size: 15px; }
  .acc-overview-sub { font-size: 11.5px; }
  .acc-overview-stats { flex-wrap: wrap; gap: 8px; }
  .acc-ov-stat { flex: 1 1 calc(50% - 4px); min-width: 0; padding: 9px 11px; }

  /* Section cards — reduce padding */
  .fee-section { border-radius: 12px; margin-bottom: 12px; }
  .fee-section-body { padding: 14px; }
  .fee-section-header {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 12px 14px;
  }

  /* Toolbar (search + filter + add) — stack and full-width */
  .inv-toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .inv-toolbar > * { width: 100%; min-width: 0; flex: 1 1 auto; }
  .inv-toolbar .fee-btn { width: 100%; justify-content: center; }

  /* Fee filters block reused */
  .fee-filters {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .fee-filters .fee-field,
  .fee-filters > * { width: 100%; min-width: 0; flex: 1 1 auto; }
  .fee-filters .fee-btn { width: 100%; justify-content: center; }

  /* Item card grid — keep auto-fill but ensure single column at narrow */
  .inv-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
  .inv-card-body { padding: 10px 12px; gap: 6px; }
  .inv-card-name { font-size: 13px; }
  .inv-card-img { height: 110px; }

  /* Item list table fallback — horizontal scroll wrapper added via fee-section */
  .fee-section--scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }

  /* POS layout — stack left products + right cart vertically */
  .inv-pos-wrap { grid-template-columns: 1fr; gap: 12px; }
  .inv-pos-products {
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    max-height: none;
    gap: 8px;
  }
  .inv-pos-prod-img { height: 88px; }
  .inv-cart { position: relative; max-height: none; top: 0; }
  .inv-cart-head { padding: 12px 14px; }
  .inv-cart-items { max-height: 360px; }
  .inv-cart-row {
    flex-wrap: wrap;
    gap: 6px;
    padding: 10px 12px;
  }
  .inv-cart-row-name { flex: 1 1 100%; }
  .inv-cart-foot { padding: 12px; }

  /* Sales receipts table — horizontal scroll, prevent column squash */
  .inv-sales-tablewrap { overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 12px; }
  .inv-sales-table { min-width: 760px; }
  .inv-sales-items { max-width: 240px; }

  /* Detail / form grids */
  .inv-detail-grid { grid-template-columns: 1fr; gap: 12px; }
  .inv-detail-img { height: 180px; }
  .inv-detail-rows { gap: 10px; }
  .inv-form-grid { grid-template-columns: 1fr; gap: 12px; }

  /* Reports grid */
  .inv-rep-grid { grid-template-columns: 1fr; gap: 10px; }
  .inv-rep-tile { padding: 12px; }

  /* Checkout / format grids */
  .inv-co-sum, .inv-fmt-opt { padding: 11px; }
  .inv-fmt-grid { grid-template-columns: 1fr !important; gap: 8px; }

  /* Style toggle */
  .inv-rep-style-row {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    padding: 10px 12px;
  }
  .inv-rep-style-seg { width: 100%; }
  .inv-rep-style-btn { flex: 1; justify-content: center; }

  /* Modal foot / head / body padding */
  .fee-modal-foot { flex-wrap: wrap; gap: 8px; padding: 12px 14px; }
  .fee-modal-foot .fee-btn { flex: 1 1 auto; justify-content: center; }
  .fee-modal-head { padding: 12px 14px; }
  .fee-modal-body { padding: 14px; }
}

@media (max-width: 480px) {
  .inv-grid { grid-template-columns: 1fr; }
  .acc-ov-stat { flex: 1 1 100%; }
  .fee-section-body { padding: 12px; }
  .fee-subtab { padding: 9px 12px; font-size: 12px; }
  .inv-pos-products { grid-template-columns: repeat(2, 1fr); }
}
`;
