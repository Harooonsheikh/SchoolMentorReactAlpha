import React from 'react';
import { ELLIPSIS, pageItems } from './pageMath';
import { fmtCount } from './format';

/* ═══════════════════════════════════════════════════════════════════
   <Pagination> — shared table footer (styles: .pag-* in saStyles.js).

     Previous | 1 | … | 5 | 6 | 7 | 8 | 9 | … | 14 | Next

   Props
     page, totalPages, total, from, to   — from paginate() (./pageMath)
     onPageChange(n)                     — only ever called with a valid,
                                           different page
     noun        'entries' (default) — the word after the count
     disabled    true while a server page is loading
   ═══════════════════════════════════════════════════════════════════ */
export default function Pagination({ page, totalPages, total, from, to, onPageChange, noun = 'entries', disabled = false }) {
  const go = (n) => {
    if (disabled || !Number.isInteger(n) || n < 1 || n > totalPages || n === page) return;
    onPageChange(n);
  };
  const items = total > 0 ? pageItems(page, totalPages) : [];
  return (
    <div className="pag-bar">
      <div className="pag-info" data-testid="pag-info">
        {total > 0
          ? <>Showing {fmtCount(from)}–{fmtCount(to)} of {fmtCount(total)} {noun}<span className="pag-page"> · Page {fmtCount(page)} of {fmtCount(totalPages)}</span></>
          : `Showing 0 ${noun}`}
      </div>
      <nav className="pag-btns" aria-label="Pagination">
        <button type="button" className="pag-btn pag-nav" disabled={disabled || page <= 1} onClick={() => go(page - 1)}>Previous</button>
        {items.map((n, i) => (n === ELLIPSIS
          ? <span key={`gap-${i}`} className="pag-ellipsis" aria-hidden="true">{ELLIPSIS}</span>
          : (
            <button key={n} type="button" className={`pag-btn pag-num${n === page ? ' active' : ''}`}
              aria-current={n === page ? 'page' : undefined} aria-label={`Page ${n}`}
              disabled={disabled && n !== page} onClick={() => go(n)}>{n}</button>
          )))}
        <span className="pag-compact" aria-hidden="true">{total > 0 ? `${page} / ${totalPages}` : ''}</span>
        <button type="button" className="pag-btn pag-nav" disabled={disabled || page >= totalPages || total === 0} onClick={() => go(page + 1)}>Next</button>
      </nav>
    </div>
  );
}
