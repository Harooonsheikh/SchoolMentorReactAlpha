import React, { useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import Tooltip from '../../components/Tooltip';

/* PDF worker + cmaps — public/ se locally serve hote hain (koi internet/CDN
   dependency nahi). Files public/pdf.worker.min.mjs aur public/cmaps/ me hain. */
pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.mjs`;

const PDF_OPTS = { cMapUrl: `${process.env.PUBLIC_URL}/cmaps/`, cMapPacked: true };
const clampScale = (s) => Math.min(3, Math.max(0.4, Number(s.toFixed(2))));

/* ═══════════════════════════════════════════════════════════════════
   PDF CANVAS — apna react-pdf viewer with custom toolbar.
   Native browser viewer ki jagah, taake "Download" button na dikhe;
   baaki sab (page navigation, zoom, rotate, print) yahin maujood hai.

   Alag file me is liye rakha hai ke react-pdf ka bhaari import + module-level
   worker side-effect SchoolSOPs.jsx ke Fast Refresh boundary ko na toray.
   ═══════════════════════════════════════════════════════════════════ */
export default function SopsPdfCanvas({ url, onLoadError }) {
  const scrollRef = useRef(null);
  const pageRefs  = useRef([]);
  const [numPages, setNumPages] = useState(0);
  const [pageNum,  setPageNum]  = useState(1);
  const [scale,    setScale]    = useState(1);
  const [rotate,   setRotate]   = useState(0);
  const [width,    setWidth]    = useState(0);
  const [status,   setStatus]   = useState('loading'); // loading | ready | error

  /* Scroll-viewport ki chaudai naapte hain — Page usi ke hisaab se fit hota
     hai. (Pages wrapper `max-content` hai, is liye usay naapna galat hota.) */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [status]);

  /* Scroll par current page number update hota hai (jo sab se zyada dikh rahi ho). */
  const onScroll = () => {
    const box = scrollRef.current;
    if (!box) return;
    const mid = box.scrollTop + box.clientHeight / 2;
    let best = 1;
    pageRefs.current.forEach((node, i) => {
      if (node && node.offsetTop <= mid) best = i + 1;
    });
    setPageNum(best);
  };

  const goTo = (n) => {
    const target = Math.min(numPages, Math.max(1, n));
    const node = pageRefs.current[target - 1];
    if (node && scrollRef.current) scrollRef.current.scrollTo({ top: node.offsetTop - 8, behavior: 'smooth' });
  };

  /* Print — chhupe iframe se sirf PDF print hota hai (poora app nahi). */
  const printPdf = () => {
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    frame.src = url;
    frame.onload = () => {
      try { frame.contentWindow.focus(); frame.contentWindow.print(); }
      catch { onLoadError?.('Print is not available for this file'); }
      setTimeout(() => frame.remove(), 60000);
    };
    document.body.appendChild(frame);
  };

  const pageWidth = width ? Math.max(240, Math.floor(width - 24)) : undefined;

  return (
    <div className="sops-pdfx">
      <div className="sops-pdfx-bar">
        <div className="sops-pdfx-grp">
          <Tooltip text="Previous page">
            <button type="button" className="sops-pdfx-btn" onClick={() => goTo(pageNum - 1)} disabled={pageNum <= 1} aria-label="Previous page">
              <i className="fa-solid fa-chevron-up" aria-hidden="true"></i>
            </button>
          </Tooltip>
          <span className="sops-pdfx-page">{status === 'ready' ? `${pageNum} / ${numPages}` : '—'}</span>
          <Tooltip text="Next page">
            <button type="button" className="sops-pdfx-btn" onClick={() => goTo(pageNum + 1)} disabled={pageNum >= numPages} aria-label="Next page">
              <i className="fa-solid fa-chevron-down" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>
        <div className="sops-pdfx-grp">
          <Tooltip text="Zoom out">
            <button type="button" className="sops-pdfx-btn" onClick={() => setScale((s) => clampScale(s - 0.15))} disabled={scale <= 0.4} aria-label="Zoom out">
              <i className="fa-solid fa-minus" aria-hidden="true"></i>
            </button>
          </Tooltip>
          <span className="sops-pdfx-zoom">{Math.round(scale * 100)}%</span>
          <Tooltip text="Zoom in">
            <button type="button" className="sops-pdfx-btn" onClick={() => setScale((s) => clampScale(s + 0.15))} disabled={scale >= 3} aria-label="Zoom in">
              <i className="fa-solid fa-plus" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>
        <div className="sops-pdfx-grp">
          <Tooltip text="Rotate">
            <button type="button" className="sops-pdfx-btn" onClick={() => setRotate((r) => (r + 90) % 360)} aria-label="Rotate">
              <i className="fa-solid fa-rotate-right" aria-hidden="true"></i>
            </button>
          </Tooltip>
          <Tooltip text="Print">
            <button type="button" className="sops-pdfx-btn" onClick={printPdf} aria-label="Print">
              <i className="fa-solid fa-print" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="sops-pdfx-scroll" ref={scrollRef} onScroll={onScroll}>
        <div className="sops-pdfx-pages">
          {status === 'error' && (
            <div className="sops-pdf-loading" style={{ position: 'static', background: 'transparent' }}>
              <i className="fa-solid fa-file-circle-xmark" style={{ fontSize: 26, opacity: 0.35 }} aria-hidden="true"></i>
              <span>Could not load this PDF.</span>
            </div>
          )}
          <Document
            file={url}
            options={PDF_OPTS}
            loading={<div className="sops-pdf-loading" style={{ position: 'static', background: 'transparent' }}><div className="sops-spinner" aria-hidden="true"></div><span>Loading PDF…</span></div>}
            error={<span />}
            onLoadSuccess={({ numPages: n }) => { setNumPages(n); setStatus('ready'); }}
            onLoadError={(err) => { setStatus('error'); onLoadError?.(err?.message || 'Could not load PDF'); }}
          >
            {Array.from({ length: numPages }, (_, i) => (
              <div className="sops-pdfx-page-wrap" key={`p_${i + 1}`} ref={(el) => { pageRefs.current[i] = el; }}>
                <Page
                  pageNumber={i + 1}
                  width={pageWidth}
                  scale={scale}
                  rotate={rotate}
                  renderAnnotationLayer={false}
                  renderTextLayer
                />
              </div>
            ))}
          </Document>
        </div>
      </div>
    </div>
  );
}
