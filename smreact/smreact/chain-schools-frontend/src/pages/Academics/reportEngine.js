/* ═══════════════════════════════════════════════════════════════════
   A4 BRANDED REPORT ENGINE — chain (head office) ke sab Academics
   reports isi se bante hain: PDF (print window) aur Word (.doc).

   Header/footer hamesha CHAIN ka hota hai (naam, logo, pata, raabta) —
   ERP me yahan school ka /report-header aata hai; network level par
   uski jagah chain profile hai (config/chainProfile.js).

   Report ka shape:
     { title, period, filters: [[label, value], …], sections: [
         { title, columns: [{ label, a: 'l'|'c'|'r' }], rows: [[…]] }
       | { title, html }        ← rich-text (lesson plan sections jaisa)
     ] }

   Pehle ye Academics.jsx ke andar tha; Create Lesson Plan ke unit /
   lesson / notebook reports ko bhi wahi shell chahiye, is liye alag
   module me nikal diya gaya.
   ═══════════════════════════════════════════════════════════════════ */

import { loadChainProfile, chainInitials } from '../../config/chainProfile'

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
export function buildReportHTML(report) {
  const chain = loadChainProfile()
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) + ' · ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const logo = chain.logo ? `<img class="rep-logo-img" src="${chain.logo}" alt="">` : `<div class="rep-logo">${esc(chainInitials(chain.chainName))}</div>`
  const filters = (report.filters || []).map(([l, v]) => `<span><b>${esc(l)}:</b> ${esc(v)}</span>`).join('')
  const sectionsHtml = report.sections.map((sec) => {
    if (sec.html != null) return `<div class="rep-secttl">${esc(sec.title || '')}</div><div class="rep-html">${sec.html}</div>`
    const thead = sec.columns.map((c) => `<th class="${c.a === 'r' ? 'r' : c.a === 'c' ? 'c' : ''}">${esc(c.label)}</th>`).join('')
    const tbody = sec.rows.length ? sec.rows.map((row) => `<tr>${row.map((cell, i) => `<td class="${sec.columns[i].a === 'r' ? 'r' : sec.columns[i].a === 'c' ? 'c' : ''}">${esc(cell)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${sec.columns.length}" style="text-align:center;color:#999;padding:14px">No records.</td></tr>`
    return `${sec.title ? `<div class="rep-secttl">${esc(sec.title)}</div>` : ''}<table class="data"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`
  }).join('')
  const header = `<div class="rep-head">${logo}<div class="rep-head-txt"><div class="rep-name">${esc(chain.chainName)}</div><div class="rep-org-line">${esc(chain.address || '')}</div><div class="rep-org-line">${esc(chain.contact || '')}${chain.email ? ' · ' + esc(chain.email) : ''}</div></div><div class="rep-meta"><div class="rep-title">${esc(report.title)}</div><div class="rep-period">${esc(report.period || '')}</div></div></div>${filters ? `<div class="rep-filters">${filters}</div>` : ''}`
  const footer = `<div class="rep-foot"><span>${esc(chain.chainName)}${chain.contact ? ' · ' + esc(chain.contact) : ''}</span><span>Computer-generated · ${esc(report.title)} · ${esc(dateStr)}</span></div>`
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(chain.chainName)} — ${esc(report.title)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}html,body{background:#e9eef6}body{font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#111;font-size:10.5px;line-height:1.4}
.a4{width:210mm;min-height:297mm;margin:14px auto;background:#fff;padding:13mm;box-shadow:0 6px 28px rgba(15,23,42,.18)}
.wrap{width:100%;border-collapse:collapse}.wrap > thead{display:table-header-group}.wrap > tfoot{display:table-footer-group}
.rep-head{display:flex;align-items:flex-start;gap:13px;border-bottom:2.5px solid #1E3A8A;padding-bottom:10px;margin-bottom:10px}
.rep-logo{width:48px;height:48px;border:2px solid #1E3A8A;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;color:#1E3A8A;font-size:15px;flex-shrink:0}
.rep-logo-img{width:48px;height:48px;border-radius:12px;object-fit:cover;flex-shrink:0;border:1px solid #e2e8f0}
.rep-head-txt{flex:1}.rep-name{font-size:18px;font-weight:800;color:#1E3A8A;line-height:1.1}.rep-org-line{font-size:10.5px;color:#555;margin-top:2px}
.rep-meta{text-align:right}.rep-title{font-size:13px;font-weight:800;color:#1E3A8A}.rep-period{font-size:11px;color:#555;margin-top:2px}
.rep-filters{display:flex;flex-wrap:wrap;gap:5px 20px;font-size:10.5px;color:#333;margin-bottom:12px;background:#F1F5FB;padding:9px 13px;border-radius:6px}
.rep-secttl{font-size:12px;font-weight:800;color:#1E3A8A;margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid #cdd7ea}
.data{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:4px}
.data th{background:#1E3A8A;color:#fff;padding:6px 8px;text-align:left;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px}
.data th.r,.data td.r{text-align:right}.data th.c,.data td.c{text-align:center}
.data td{padding:5px 8px;border-bottom:1px solid #e5e9f2;vertical-align:top}.data tbody tr:nth-child(even) td{background:#f8fafc}
.rep-foot{display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-top:14px;font-size:9px;color:#888;border-top:1px solid #e5e9f2;padding-top:8px}
.rep-html{font-size:11px;color:#333;line-height:1.6;margin-bottom:8px}.rep-html ul,.rep-html ol{padding-left:20px;margin:5px 0}.rep-html table{border-collapse:collapse;margin:6px 0;width:100%}.rep-html td,.rep-html th{border:1px solid #cdd7ea;padding:4px 7px;font-size:10px}.rep-html p{margin:4px 0}
@media print{html,body{background:#fff}.a4{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}@page{size:A4 portrait;margin:13mm}}</style></head>
<body><div class="a4"><table class="wrap"><thead><tr><td>${header}</td></tr></thead><tfoot><tr><td>${footer}</td></tr></tfoot><tbody><tr><td>${sectionsHtml}</td></tr></tbody></table></div>__SCRIPT__</body></html>`
}
export function exportReport(report, fmt, onToast, bw) {
  let html = buildReportHTML(report)
  if (bw) html = html.replace(/#1E3A8A/g, '#333').replace(/#1E40AF/g, '#555').replace(/#F1F5FB/g, '#f1f1f1').replace(/#cdd7ea/g, '#ccc')
  if (fmt === 'word') {
    const blob = new Blob([html.replace('__SCRIPT__', '')], { type: 'application/msword' })
    const url = URL.createObjectURL(blob); const aEl = document.createElement('a')
    aEl.href = url; aEl.download = `${report.title.replace(/[^\w]+/g, '_')}.doc`; document.body.appendChild(aEl); aEl.click(); document.body.removeChild(aEl)
    setTimeout(() => URL.revokeObjectURL(url), 1500); onToast?.('Word document downloaded', 'success'); return
  }
  const w = window.open('', '_blank')
  if (!w) { onToast?.('Allow pop-ups to download / print the report', 'warn'); return }
  w.document.open(); w.document.write(html.replace('__SCRIPT__', '<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},300);};<\/script>')); w.document.close()
}
