import React, { useRef, useState } from 'react';
import { parseChallanBarcode } from '../../services/challanBarcode';

/* Dashboard par challan lookup box.
   - Barcode scanner (keyboard-wedge, e.g. SpeedX speed-x-8500) text type karke Enter bhejta
     hai → Enter par hi lookup ho jata hai.
   - Ya user Ledger ID type karke Enter / "Open" dabaye.
   Format: "<ledgerId>-<studentId>" (barcode) ya sirf "<ledgerId>". */
const CSS = `
.lsb-wrap{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 14px;padding:10px 12px;
  background:var(--bg-card,#fff);border:1px solid var(--border-light,#E2E8F0);border-radius:12px;}
.lsb-label{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:var(--primary,#1E3A8A);white-space:nowrap;}
.lsb-label i{font-size:15px;}
.lsb-input{flex:1 1 240px;min-width:0;height:38px;padding:0 12px;border-radius:9px;
  border:1px solid var(--border-light,#CBD5E1);background:var(--bg-muted,#F8FAFC);color:var(--text-primary,#0F172A);
  font-size:14px;font-family:inherit;outline:none;}
.lsb-input:focus{border-color:var(--primary,#1E3A8A);box-shadow:0 0 0 3px rgba(30,58,138,.12);}
.lsb-btn{height:38px;padding:0 16px;border-radius:9px;border:0;background:var(--primary,#1E3A8A);color:#fff;
  font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;}
.lsb-btn:disabled{opacity:.5;cursor:not-allowed;}
.lsb-hint{width:100%;font-size:11.5px;color:var(--text-muted,#64748B);}
@media (max-width:560px){.lsb-label{width:100%;} .lsb-btn{width:100%;}}
`;

export default function LedgerScanBar({ onOpenChallan = () => {}, toast = () => {} }) {
  const [val, setVal] = useState('');
  const inputRef = useRef(null);

  const submit = () => {
    const parsed = parseChallanBarcode(val);
    if (!parsed) {
      toast('Enter a valid Ledger ID or scan the challan barcode', 'error');
      inputRef.current?.select();
      return;
    }
    onOpenChallan(parsed);
    setVal('');
  };

  return (
    <div className="lsb-wrap">
      <style>{CSS}</style>
      <div className="lsb-label">
        <i className="fa-solid fa-barcode"></i> Challan Lookup
      </div>
      <input
        ref={inputRef}
        className="lsb-input"
        type="text"
        value={val}
        placeholder="Scan challan barcode or type Ledger ID, then press Enter"
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); submit(); }
        }}
        autoComplete="off"
        spellCheck={false}
        aria-label="Ledger ID or challan barcode"
      />
      <button type="button" className="lsb-btn" onClick={submit} disabled={!val.trim()}>
        <i className="fa-solid fa-arrow-right"></i> Open Challan
      </button>
      <div className="lsb-hint">Opens that challan in Fee Receiving. Scanner sends Enter automatically after the barcode.</div>
    </div>
  );
}
