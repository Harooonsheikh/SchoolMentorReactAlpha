/* ═══════════════════════════════════════════════════════════════════
   EXAM REPORT PREVIEW — "Downloads & Reports" preview screen.

   Opens a preview of any report FIRST (rendered in an iframe, no toolbar);
   PDF / Word / Excel downloads are triggered from that preview through the
   ERP's own pipeline:
     PDF   → deliverReport(…,'pdf')   (print preview → Save as PDF)
     Word  → deliverReport(…,'word')  (native .docx "Save as Word")
     Excel → downloadReportExcel(excel) when `excel` rows are supplied,
             otherwise the same report HTML → native .xlsx (downloadReportHtmlAsExcel)

   Usage:
     <ExamReportPreview
       open={!!req}
       title="Comparison Report"
       subtitle={student.name}
       buildHtml={({ format, isColor, includeToolbar }) => buildComparisonReportHtml({...})}  // sync or async
       excel={{ title, subtitle, columns, rows }}   // optional table-shaped Excel
       onClose={() => setReq(null)}
     />
   buildHtml is called with includeToolbar:false for the on-screen preview and
   with includeToolbar:true when the PDF/Word window is opened.
   ═══════════════════════════════════════════════════════════════════ */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { REPORT_FORMATS, downloadReportExcel, reportFileName } from '../reports/reportKit';
import { examDeliver } from './examReportCommon';

export default function ExamReportPreview({
  open = true, title = 'Report Preview', subtitle, buildHtml, excel,
  formats = ['pdf', 'word', 'excel'], defaultColor = true, onClose, onError,
}) {
  const [isColor, setIsColor] = useState(defaultColor);
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setLoading(true); setErr('');
    Promise.resolve()
      .then(() => buildHtml({ format: 'pdf', isColor, includeToolbar: false }))
      .then(h => { if (alive) { setHtml(h || ''); setLoading(false); } })
      .catch(e => {
        console.error('Report preview failed:', e);
        if (alive) { setErr('Could not build this report.'); setLoading(false); }
        if (onError) onError(e);
      });
    return () => { alive = false; };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [open, isColor]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => { if (e.key === 'Escape' && onClose) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const download = async (format) => {
    if (busy) return;
    setBusy(format);
    try {
      const fname = `${title}${subtitle ? ` - ${subtitle}` : ''}`;
      if (format === 'excel') {
        if (excel && excel.columns && excel.rows) {
          await downloadReportExcel({ filename: `${reportFileName(fname)}.xlsx`, isColor, ...excel });
        } else {
          const h = await buildHtml({ format: 'excel', isColor, includeToolbar: false });
          await examDeliver(fname, 'excel', h);
        }
      } else {
        // Open synchronously (pop-up blocker safe), then fill it once built.
        const win = window.open('', '_blank', 'width=950,height=900');
        const h = await buildHtml({ format, isColor, includeToolbar: true });
        examDeliver(fname, format, h, { win });
      }
    } catch (e) {
      console.error('Report download failed:', e);
      if (onError) onError(e);
    } finally { setBusy(''); }
  };

  const seg = (active, col) => ({
    padding: '6px 12px', borderRadius: 7, border: 'none', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit', background: active ? col : 'transparent', color: active ? '#fff' : 'var(--text-muted, #64748B)',
  });

  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget && onClose) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 9600, background: 'rgba(10,22,40,.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div style={{ background: 'var(--bg-card, #fff)', borderRadius: 18, width: '100%', maxWidth: 900, height: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border-light, #E2E8F0)', background: 'var(--bg-muted, #F8FAFC)', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #0F172A)' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 11, color: 'var(--text-muted, #64748B)', marginTop: 1 }}>{subtitle}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card, #fff)', border: '1px solid var(--border-light, #E2E8F0)', borderRadius: 9, padding: 3 }}>
              <button type="button" style={seg(isColor, '#1E40AF')} onClick={() => setIsColor(true)}>Colorful</button>
              <button type="button" style={seg(!isColor, '#374151')} onClick={() => setIsColor(false)}>Colorless</button>
            </div>
            {formats.map(f => {
              const meta = REPORT_FORMATS[f];
              if (!meta) return null;
              return (
                <button key={f} type="button" disabled={loading || !!err || !!busy} onClick={() => download(f)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, border: 'none', background: meta.accent, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: (loading || err || busy) ? 'not-allowed' : 'pointer', opacity: (loading || err) ? .5 : 1, fontFamily: 'inherit' }}>
                  <i className={meta.icon}></i> {busy === f ? 'Preparing…' : meta.label}
                </button>
              );
            })}
            <button type="button" onClick={onClose} aria-label="Close"
              style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--border-light, #E2E8F0)', background: 'transparent', color: 'var(--text-muted, #64748B)', cursor: 'pointer' }}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, background: '#E5E7EB', display: 'flex', alignItems: 'stretch', justifyContent: 'center' }}>
          {loading && <div style={{ alignSelf: 'center', color: '#475569', fontSize: 13 }}>Building preview…</div>}
          {!loading && err && <div style={{ alignSelf: 'center', color: '#DC2626', fontSize: 13 }}>{err}</div>}
          {!loading && !err && (
            <iframe title={title} srcDoc={html} style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
