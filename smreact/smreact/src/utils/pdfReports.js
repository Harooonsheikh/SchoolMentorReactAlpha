// PDF report generation — opens a print-ready window with color/BW choice

export function askPDFColor(title) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,22,40,.52);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = `
      <div style="background:var(--bg-card,#fff);border-radius:20px;max-width:380px;width:100%;padding:28px;box-shadow:0 20px 50px rgba(0,0,0,.3);border:1px solid var(--border-light,#BFDBFE)">
        <div style="text-align:center;margin-bottom:20px">
          <div style="width:52px;height:52px;background:linear-gradient(135deg,rgba(30,58,138,.1),rgba(14,165,233,.1));border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px;margin:0 auto 12px">
            <i class="fas fa-file-pdf" style="color:#1E3A8A"></i>
          </div>
          <div style="font-size:16px;font-weight:700;color:var(--text-primary,#0F172A);margin-bottom:6px">${title}</div>
          <div style="font-size:13px;color:var(--text-muted,#64748B)">Choose your preferred print style</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px">
          <button id="_pdfColorBtn" style="padding:16px 12px;border:2px solid #1E3A8A;border-radius:12px;background:rgba(30,58,138,.06);cursor:pointer;font-family:inherit;transition:all .18s ease">
            <div style="font-size:22px;margin-bottom:8px">🎨</div>
            <div style="font-size:13px;font-weight:700;color:#1E3A8A">Colourful</div>
            <div style="font-size:11px;color:#64748B;margin-top:3px">Full colours &amp; gradients</div>
          </button>
          <button id="_pdfBWBtn" style="padding:16px 12px;border:2px solid #E5E7EB;border-radius:12px;background:#F9FAFB;cursor:pointer;font-family:inherit;transition:all .18s ease">
            <div style="font-size:22px;margin-bottom:8px">⬛</div>
            <div style="font-size:13px;font-weight:700;color:#111827">Zero Ink B&amp;W</div>
            <div style="font-size:11px;color:#6B7280;margin-top:3px">White bg, black text — saves ink</div>
          </button>
        </div>
        <button id="_pdfCancelBtn" style="width:100%;height:40px;border:1.5px solid #E5E7EB;border-radius:10px;background:transparent;font-family:inherit;font-size:13px;font-weight:600;color:#374151;cursor:pointer">Cancel</button>
      </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('#_pdfColorBtn').onclick = () => { document.body.removeChild(overlay); resolve('color'); };
    overlay.querySelector('#_pdfBWBtn').onclick   = () => { document.body.removeChild(overlay); resolve('bw'); };
    overlay.querySelector('#_pdfCancelBtn').onclick = () => { document.body.removeChild(overlay); resolve(null); };
    overlay.onclick = (e) => { if (e.target === overlay) { document.body.removeChild(overlay); resolve(null); } };
  });
}

const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">`;
const CLR = ['#1E40AF','#0EA5E9','#F59E0B','#8B5CF6','#EF4444','#06B6D4','#EC4899','#3B82F6'];

function getDateTime() {
  const n = new Date();
  return {
    dateStr: n.toLocaleDateString('en-PK', { weekday:'long', year:'numeric', month:'long', day:'numeric' }),
    timeStr: n.toLocaleTimeString('en-PK', { hour:'2-digit', minute:'2-digit', second:'2-digit' }),
  };
}

function openPrintWindow(html, showToast) {
  const w = window.open('', '_blank', 'width=900,height=720,scrollbars=yes');
  if (!w) { showToast('Allow popups in your browser to view the PDF report', 'error'); return; }
  w.document.write(html);
  w.document.close();
  w.onload = () => setTimeout(() => { w.focus(); w.print(); }, 600);
}

function baseCss(isBW) {
  return `*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Plus Jakarta Sans",sans-serif;color:${isBW?'#000':'#0A1628'};background:#fff;font-size:12px}@page{size:A4;margin:0}.page{width:210mm;min-height:297mm;display:flex;flex-direction:column}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;
}

function header(schoolName, reportLabel, dateStr, timeStr, isBW) {
  const logo = isBW
    ? `<div style="width:52px;height:52px;border-radius:6px;border:3px solid #000;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#000;flex-shrink:0">SM</div>`
    : `<div style="width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#1E40AF,#0EA5E9);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="30" height="30" viewBox="0 0 30 30"><defs><linearGradient id="g" x1="0" y1="0" x2="30" y2="30"><stop offset="0%" stop-color="#1E40AF"/><stop offset="100%" stop-color="#0EA5E9"/></linearGradient></defs><rect width="30" height="30" rx="7" fill="url(#g)"/><path d="M5 9h20M5 15h13M5 21h16" stroke="white" stroke-width="2" stroke-linecap="round"/></svg></div>`;
  const hdrBg = isBW ? 'background:#fff;border-bottom:3px solid #000' : 'background:linear-gradient(135deg,#1E40AF 0%,#1E40AF 100%)';
  const tc = isBW ? '#000' : '#fff';
  const sc = isBW ? '#555' : 'rgba(255,255,255,.6)';
  const badge = isBW
    ? `border:1.5px solid #000;border-radius:4px;padding:4px 10px;background:#fff;color:#000`
    : `background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);border-radius:7px;padding:5px 13px;color:rgba(255,255,255,.9)`;
  return `<div style="${hdrBg};padding:24px 36px;display:flex;align-items:center;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:14px">${logo}
      <div><div style="font-size:19px;font-weight:800;color:${tc};line-height:1.2;max-width:340px">${schoolName}</div>
        <div style="font-size:9px;color:${sc};letter-spacing:1.5px;text-transform:uppercase;margin-top:4px">School Mentor ERP — ${reportLabel}</div></div></div>
    <div style="text-align:right">
      <div style="font-size:9.5px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;margin-bottom:5px;display:inline-block;${badge}">${reportLabel}</div>
      <div style="font-size:10px;color:${isBW?'#444':'rgba(255,255,255,.65)'};">${dateStr}</div>
      <div style="font-size:10px;color:${isBW?'#444':'rgba(255,255,255,.65)'};margin-top:2px">${timeStr}</div>
    </div></div>`;
}

function metaBar(items, isBW) {
  return `<div style="background:${isBW?'#fff':'#93C5FD'};border-bottom:${isBW?'2px solid #000':'2px solid #E8EDF5'};padding:11px 36px;display:flex;gap:22px;flex-wrap:wrap">
    ${items.map(([lbl,val])=>`<div style="display:flex;align-items:center;gap:6px">
      <div><div style="font-size:9px;color:${isBW?'#555':'#8898AA'};font-weight:600;text-transform:uppercase;letter-spacing:.4px">${lbl}</div>
      <div style="font-size:10.5px;font-weight:700;color:${isBW?'#000':'#0A1628'}">${val}</div></div></div>`).join('')}
  </div>`;
}

function cards(list, isBW) {
  return `<div style="display:grid;grid-template-columns:repeat(${list.length},1fr);gap:11px;padding:14px 36px">
    ${list.map(([icon,val,lbl,clr])=>`<div style="background:#fff;border:${isBW?'1.5px solid #000':'1.5px solid #E8EDF5'};border-radius:${isBW?'4px':'9px'};padding:12px 14px;display:flex;align-items:center;gap:10px">
      <div style="width:32px;height:32px;border-radius:8px;${isBW?'border:1.5px solid #000;':'background:'+clr};display:flex;align-items:center;justify-content:center;font-size:13px">${icon}</div>
      <div><div style="font-size:18px;font-weight:800;color:${isBW?'#000':'#0A1628'};line-height:1">${val}</div>
      <div style="font-size:9.5px;color:${isBW?'#444':'#8898AA'};margin-top:2px">${lbl}</div></div></div>`).join('')}
  </div>`;
}

function tbl(heads, rows, isBW) {
  const thBg = isBW ? 'background:#fff;border-bottom:2px solid #000' : 'background:linear-gradient(135deg,#1E40AF,#1E40AF)';
  const thClr = isBW ? 'color:#000;border-right:1px solid #ccc' : 'color:#fff';
  const tblBorder = isBW ? 'border:1.5px solid #000' : '';
  return `<div style="padding:0 36px;flex:1"><table style="width:100%;border-collapse:collapse;${tblBorder}">
    <thead><tr style="${thBg}">${heads.map(h=>`<th style="padding:10px;font-size:9.5px;font-weight:700;${thClr};text-align:left;letter-spacing:.5px;text-transform:uppercase">${h}</th>`).join('')}</tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function ftr(schoolName, isBW) {
  const bg = isBW ? 'background:#fff;border-top:2px solid #000' : 'background:#93C5FD;border-top:2px solid #E8EDF5';
  const logo = isBW ? '' : '<div style="width:20px;height:20px;border-radius:5px;background:linear-gradient(135deg,#1E40AF,#0EA5E9);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#fff">SM</div>';
  return `<div style="${bg};padding:12px 36px;display:flex;justify-content:space-between;align-items:center;margin-top:auto">
    <div style="display:flex;align-items:center;gap:7px">${logo}<div><div style="font-size:10.5px;font-weight:700;color:${isBW?'#000':'#1E40AF'}">School Mentor ERP</div><div style="font-size:9px;color:${isBW?'#444':'#8898AA'}">theschoolmentor.online</div></div></div>
    <div style="font-size:9.5px;color:${isBW?'#444':'#8898AA'};text-align:center">Confidential — For internal use only — ${schoolName}</div>
    <div style="font-size:9.5px;color:${isBW?'#444':'#8898AA'};text-align:right">RPT-${Date.now().toString(36).toUpperCase()}</div>
  </div>`;
}

function sectionLabel(text, isBW) {
  return `<div style="padding:4px 36px 9px;display:flex;align-items:center;gap:10px"><div style="font-size:10px;font-weight:700;color:${isBW?'#555':'#8898AA'};letter-spacing:1px;text-transform:uppercase;white-space:nowrap">${text}</div><div style="flex:1;height:1px;background:${isBW?'#ccc':'linear-gradient(90deg,#E8EDF5,transparent)'}"></div></div>`;
}

// ════════════════ CLASSES REPORT ════════════════
export async function downloadClassesReport(classesData, schoolInfo, showToast) {
  const mode = await askPDFColor('Download Classes Report');
  if (!mode) return;
  const isBW = mode === 'bw';
  const schoolName = schoolInfo.schoolName || 'School';
  const { dateStr, timeStr } = getDateTime();
  const grandTotal = classesData.reduce((s,c)=>s+c.feeHeads.reduce((f,h)=>f+Number(h.amount),0),0);
  const totalSecs = classesData.reduce((s,c)=>s+c.sections.length,0);
  const tdB = isBW ? 'border-bottom:1px solid #ccc;border-right:1px solid #eee' : 'border-bottom:1px solid #E8EDF5';

  const bodyRows = classesData.map((cls,i) => {
    const bg = isBW?'#fff':(i%2===0?'#fff':'#f8faff');
    const col = CLR[i%CLR.length];
    const av = isBW
      ? `<div style="width:26px;height:26px;border-radius:4px;border:2px solid #000;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#000">${cls.name[0].toUpperCase()}</div>`
      : `<div style="width:26px;height:26px;border-radius:7px;background:${col};display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff">${cls.name[0].toUpperCase()}</div>`;
    const secs = cls.sections.length
      ? cls.sections.map(s=>isBW?`<span style="padding:1px 5px;border:1px solid #333;border-radius:3px;font-size:10px;font-weight:600">${s}</span> `:`<span style="padding:2px 7px;background:rgba(30,58,138,.09);border-radius:99px;font-size:10px;font-weight:600;color:#1E40AF">${s}</span> `).join('')
      : `<span style="color:#999;font-style:italic">None</span>`;
    const fee = cls.feeHeads.length ? cls.feeHeads.map(f=>`${f.name}: PKR ${Number(f.amount).toLocaleString()}`).join(' · ') : 'Not configured';
    return `<tr style="background:${bg}">
      <td style="padding:9px 10px;${tdB};font-size:11px;color:${isBW?'#000':'#8898AA'};font-weight:600">${String(i+1).padStart(2,'0')}</td>
      <td style="padding:9px 10px;${tdB}"><div style="display:flex;align-items:center;gap:8px">${av}<div><div style="font-size:12px;font-weight:700;color:#000">${cls.name}</div><div style="font-size:10px;color:${isBW?'#444':'#8898AA'}">${cls.teacher||'—'}</div></div></div></td>
      <td style="padding:9px 10px;${tdB}">${secs}</td>
      <td style="padding:9px 10px;${tdB};font-size:11px;color:${isBW?'#000':'#4A5568'}">${fee}</td>
    </tr>`;
  }).join('');

  const grandRow = `<tr style="${isBW?'background:#fff;border-top:2px solid #000':'background:linear-gradient(135deg,rgba(30,58,138,.06),rgba(14,165,233,.06));border-top:2px solid #1E40AF'}">
    <td colspan="3" style="padding:10px;font-size:12px;font-weight:800;color:${isBW?'#000':'#1E40AF'}">Total Fee (All Classes)</td>
    <td style="padding:10px;font-size:13px;font-weight:800;color:${isBW?'#000':'#1E40AF'}">PKR ${grandTotal.toLocaleString()}</td></tr>`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Classes Report</title>${FONTS}<style>${baseCss(isBW)}</style></head><body><div class="page">
    ${header(schoolName,'Classes Report',dateStr,timeStr,isBW)}
    ${metaBar([['Generated By','Dr. Islahudin (Admin)'],['Date',dateStr],['Total Classes',classesData.length+' classes']],isBW)}
    ${cards([['🏫',classesData.length,'Total Classes','rgba(30,58,138,.1)'],['📚',totalSecs,'Total Sections','rgba(14,165,233,.1)'],['💰','PKR '+grandTotal.toLocaleString(),'Grand Total Fee','rgba(245,158,11,.1)']],isBW)}
    ${sectionLabel('Class-wise Details',isBW)}
    ${tbl(['#','Class & Teacher','Sections','Fee Structure'],bodyRows+grandRow,isBW)}
    ${ftr(schoolName,isBW)}</div></body></html>`;

  openPrintWindow(html, showToast);
  showToast('Classes report ready — Save as PDF', 'success');
}

// ════════════════ SUBJECTS REPORT ════════════════
export async function downloadSubjectsReport(classesData, subjectsData, bookLists, schoolInfo, showToast) {
  const mode = await askPDFColor('Download Subjects Report');
  if (!mode) return;
  const isBW = mode === 'bw';
  const schoolName = schoolInfo.schoolName || 'School';
  const { dateStr, timeStr } = getDateTime();
  const tdB = isBW ? 'border-bottom:1px solid #ccc;border-right:1px solid #eee' : 'border-bottom:1px solid #E8EDF5';

  const rows = classesData.map((cls,i) => {
    const bl = bookLists[cls.id]||{};
    const filled = Object.values(bl).filter(v=>v&&v.trim()).length;
    const status = filled===subjectsData.length&&filled>0?'Complete':`${filled}/${subjectsData.length}`;
    const sc = filled===subjectsData.length&&filled>0?'#16A34A':filled>0?'#D97706':'#9CA3AF';
    const bg = isBW?'#fff':(i%2===0?'#fff':'#f8faff');
    const booksHtml = subjectsData.map(s=>`<div style="padding:2px 0;font-size:10.5px"><span style="font-weight:700;color:${isBW?'#000':'#1E3A8A'}">${s}:</span> <span style="color:${bl[s]?isBW?'#000':'#374151':isBW?'#666':'#9CA3AF'};font-style:${bl[s]?'normal':'italic'}">${bl[s]||'Not set'}</span></div>`).join('');
    return `<tr style="background:${bg}">
      <td style="padding:8px 10px;${tdB};font-size:11px;color:${isBW?'#000':'#8898AA'};font-weight:600">${String(i+1).padStart(2,'0')}</td>
      <td style="padding:8px 10px;${tdB}"><div style="font-size:12px;font-weight:700;color:#000">${cls.name}</div><div style="font-size:10px;color:${isBW?'#444':'#8898AA'}">${cls.teacher||'—'}</div></td>
      <td style="padding:8px 10px;${tdB};text-align:center"><span style="padding:3px 9px;border-radius:99px;font-size:10px;font-weight:700;${isBW?'border:1px solid #000;color:#000':'background:'+sc+'20;color:'+sc}">${status}</span></td>
      <td style="padding:8px 10px;${tdB}">${booksHtml}</td></tr>`;
  }).join('');

  const fullyCovered = classesData.filter(c=>{const bl=bookLists[c.id]||{};return Object.values(bl).filter(v=>v&&v.trim()).length===subjectsData.length&&subjectsData.length>0;}).length;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Subjects Report</title>${FONTS}<style>${baseCss(isBW)}</style></head><body><div class="page">
    ${header(schoolName,'Subjects & Book List Report',dateStr,timeStr,isBW)}
    ${metaBar([['Generated By','Dr. Islahudin (Admin)'],['Date',dateStr],['Total Subjects',subjectsData.length+' subjects']],isBW)}
    ${cards([['🏫',classesData.length,'Total Classes','rgba(30,58,138,.1)'],['📚',subjectsData.length,'Total Subjects','rgba(14,165,233,.1)'],['✅',fullyCovered,'Classes Fully Set','rgba(16,185,129,.1)']],isBW)}
    ${sectionLabel('Book List Details by Class',isBW)}
    ${tbl(['#','Class & Teacher','Status','Subject — Book Title'],rows,isBW)}
    ${ftr(schoolName,isBW)}</div></body></html>`;

  openPrintWindow(html, showToast);
  showToast('Subjects report ready — Save as PDF', 'success');
}

// ════════════════ DEPARTMENTS REPORT ════════════════
export async function downloadDeptReport(deptsData, schoolInfo, showToast) {
  const mode = await askPDFColor('Download Departments Report');
  if (!mode) return;
  const isBW = mode === 'bw';
  const schoolName = schoolInfo.schoolName || 'School';
  const { dateStr, timeStr } = getDateTime();
  const totalPosts = deptsData.reduce((s,d)=>s+d.designations.length,0);
  const tdB = isBW ? 'border-bottom:1px solid #ccc;border-right:1px solid #eee' : 'border-bottom:1px solid #E8EDF5';

  const rows = deptsData.map((dept,i) => {
    const bg = isBW?'#fff':(i%2===0?'#fff':'#f8faff');
    const desigs = dept.designations.length
      ? dept.designations.map((d,di)=>`<div style="padding:4px 0;border-bottom:1px solid #F0F4FF;font-size:11px"><span style="font-weight:700;color:${isBW?'#000':'#1E3A8A'}">${di+1}. ${d.name}</span>${d.qual?` <span style="color:${isBW?'#555':'#8898AA'};font-size:10px">— ${d.qual}</span>`:''} ${d.job?`<div style="color:${isBW?'#555':'#8898AA'};font-style:italic;font-size:10px;margin-top:1px">${d.job}</div>`:''}</div>`).join('')
      : `<span style="color:#aaa;font-style:italic;font-size:11px">No designations</span>`;
    return `<tr style="background:${bg};vertical-align:top">
      <td style="padding:10px;${tdB};font-size:11px;color:${isBW?'#000':'#8898AA'};font-weight:600">${String(i+1).padStart(2,'0')}</td>
      <td style="padding:10px;${tdB}"><div style="display:inline-flex;align-items:center;gap:7px;${isBW?'border:1.5px solid #000;border-radius:4px;padding:4px 10px;':'background:rgba(30,58,138,.07);border:1px solid rgba(30,58,138,.15);border-radius:99px;padding:4px 13px;'}"><span style="font-size:12.5px;font-weight:700;color:${isBW?'#000':'#1E40AF'}">🏢 ${dept.name}</span></div></td>
      <td style="padding:10px;${tdB};text-align:center"><span style="padding:3px 10px;border-radius:99px;font-size:10.5px;font-weight:700;${isBW?'border:1px solid #000;':'background:'+(dept.designations.length?'rgba(30,58,138,.09)':'rgba(0,0,0,.05)')+';color:'+(dept.designations.length?'#1E40AF':'#8898AA')}">${dept.designations.length} post${dept.designations.length!==1?'s':''}</span></td>
      <td style="padding:10px;${tdB}">${desigs}</td></tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Departments Report</title>${FONTS}<style>${baseCss(isBW)}</style></head><body><div class="page">
    ${header(schoolName,'Departments Report',dateStr,timeStr,isBW)}
    ${metaBar([['Generated By','Dr. Islahudin (Admin)'],['Date',dateStr]],isBW)}
    ${cards([['🏢',deptsData.length,'Total Departments','rgba(30,58,138,.1)'],['📋',totalPosts,'Total Posts','rgba(14,165,233,.1)'],['✅',deptsData.filter(d=>d.designations.length>0).length,'Depts with Posts','rgba(16,185,129,.1)']],isBW)}
    ${sectionLabel('Department-wise Post Details',isBW)}
    ${tbl(['#','Department','Posts','Designations & Qualifications'],rows,isBW)}
    ${ftr(schoolName,isBW)}</div></body></html>`;

  openPrintWindow(html, showToast);
  showToast('Departments report ready — Save as PDF', 'success');
}

// ════════════════ STAFF REPORT ════════════════
export async function downloadStaffReport(staffData, schoolInfo, showToast) {
  const mode = await askPDFColor('Download Staff Report');
  if (!mode) return;
  const isBW = mode === 'bw';
  const schoolName = schoolInfo.schoolName || 'School';
  const { dateStr, timeStr } = getDateTime();
  const tdB = isBW ? 'border-bottom:1px solid #ccc;border-right:1px solid #eee' : 'border-bottom:1px solid #E8EDF5';

  const rows = staffData.map((s,i) => {
    const bg = isBW?'#fff':(i%2===0?'#fff':'#f8faff');
    const total = (s.salary||0)+(s.medical||0)+(s.rent||0)+(s.transport||0);
    const vbadge = s.verified
      ? `<span style="padding:2px 7px;border-radius:99px;font-size:9.5px;font-weight:700;${isBW?'border:1px solid #000;color:#000':'background:rgba(22,163,74,.1);color:#16A34A'}">✓ Verified</span>`
      : `<span style="padding:2px 7px;border-radius:99px;font-size:9.5px;font-weight:700;${isBW?'border:1px solid #999;color:#555':'background:rgba(245,158,11,.1);color:#D97706'}">Pending</span>`;
    return `<tr style="background:${bg}">
      <td style="padding:8px 10px;${tdB};font-size:11px;color:${isBW?'#000':'#8898AA'};font-weight:600">${String(i+1).padStart(2,'0')}</td>
      <td style="padding:8px 10px;${tdB}"><div style="font-size:12px;font-weight:700;color:#000">${s.firstName}${s.lastName?' '+s.lastName:''}</div><div style="font-size:10px;color:${isBW?'#444':'#8898AA'}">${s.mobile||'—'}</div></td>
      <td style="padding:8px 10px;${tdB};font-size:11px;color:${isBW?'#000':'#374151'}">${s.dept||'—'}</td>
      <td style="padding:8px 10px;${tdB};font-size:11px;color:${isBW?'#000':'#374151'}">${s.designation||'—'}</td>
      <td style="padding:8px 10px;${tdB};font-size:11px;color:${isBW?'#000':'#1E40AF'};font-weight:700">${total?'PKR '+total.toLocaleString():'—'}</td>
      <td style="padding:8px 10px;${tdB};text-align:center">${vbadge}</td></tr>`;
  }).join('');

  const totalPayroll = staffData.reduce((s,x)=>s+(x.salary||0)+(x.medical||0)+(x.rent||0)+(x.transport||0),0);
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Staff Report</title>${FONTS}<style>${baseCss(isBW)}</style></head><body><div class="page">
    ${header(schoolName,'Staff Report',dateStr,timeStr,isBW)}
    ${metaBar([['Generated By','Dr. Islahudin (Admin)'],['Date',dateStr],['Total Staff',staffData.length+' employees']],isBW)}
    ${cards([['👥',staffData.length,'Total Staff','rgba(30,58,138,.1)'],['✅',staffData.filter(s=>s.verified).length,'Verified','rgba(22,163,74,.1)'],['💰','PKR '+totalPayroll.toLocaleString(),'Total Payroll','rgba(245,158,11,.1)']],isBW)}
    ${sectionLabel('Staff Details',isBW)}
    ${tbl(['#','Name & Mobile','Department','Designation','Salary','Status'],rows,isBW)}
    ${ftr(schoolName,isBW)}</div></body></html>`;

  openPrintWindow(html, showToast);
  showToast('Staff report ready — Save as PDF', 'success');
}

// ════════════════ STUDENT REPORT ════════════════
export async function downloadStudentReport(classesData, studentStrengths, schoolInfo, showToast) {
  const mode = await askPDFColor('Download Student Report');
  if (!mode) return;
  const isBW = mode === 'bw';
  const schoolName = schoolInfo.schoolName || 'School';
  const { dateStr, timeStr } = getDateTime();
  const tdB = isBW ? 'border-bottom:1px solid #ccc;border-right:1px solid #eee' : 'border-bottom:1px solid #E8EDF5';

  const allRows = [];
  classesData.forEach(cls => {
    const secs = cls.sections?.length ? cls.sections : [null];
    secs.forEach(sec => allRows.push({ cls, sec }));
  });
  const totalStudents = Object.values(studentStrengths).reduce((s,v)=>s+(v||0),0);

  const rows = allRows.map(({cls,sec},i) => {
    const key = `${cls.id}_${sec||'null'}`;
    const strength = studentStrengths[key]||0;
    const bg = isBW?'#fff':(i%2===0?'#fff':'#f8faff');
    return `<tr style="background:${bg}">
      <td style="padding:8px 10px;${tdB};font-size:11px;color:${isBW?'#000':'#8898AA'};font-weight:600">${String(i+1).padStart(2,'0')}</td>
      <td style="padding:8px 10px;${tdB};font-size:12px;font-weight:700;color:#000">${cls.name}</td>
      <td style="padding:8px 10px;${tdB}"><span style="padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;${isBW?'border:1px solid #000;':'background:rgba(30,58,138,.08);color:#1E40AF'}">${sec||'—'}</span></td>
      <td style="padding:8px 10px;${tdB};font-size:13px;font-weight:800;color:${isBW?'#000':'#1E40AF'}">${strength}</td>
      <td style="padding:8px 10px;${tdB};font-size:11px;color:${isBW?'#444':'#8898AA'}">${cls.teacher||'—'}</td></tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Students Report</title>${FONTS}<style>${baseCss(isBW)}</style></head><body><div class="page">
    ${header(schoolName,'Students Report',dateStr,timeStr,isBW)}
    ${metaBar([['Generated By','Dr. Islahudin (Admin)'],['Date',dateStr],['Total Students',totalStudents+' students']],isBW)}
    ${cards([['🎓',totalStudents,'Total Students','rgba(30,58,138,.1)'],['📚',allRows.length,'Total Sections','rgba(14,165,233,.1)'],['🏫',classesData.length,'Total Classes','rgba(16,185,129,.1)']],isBW)}
    ${sectionLabel('Section-wise Strength',isBW)}
    ${tbl(['#','Class','Section','Strength','Class Teacher'],rows,isBW)}
    ${ftr(schoolName,isBW)}</div></body></html>`;

  openPrintWindow(html, showToast);
  showToast('Student report ready — Save as PDF', 'success');
}
