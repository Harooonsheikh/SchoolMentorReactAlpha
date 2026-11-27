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
.lsb-info{width:26px;height:26px;border-radius:50%;border:1px solid var(--border-light,#CBD5E1);background:var(--bg-muted,#F8FAFC);
  color:var(--primary,#1E3A8A);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;flex:0 0 auto;}
.lsb-info:hover,.lsb-info[aria-expanded="true"]{background:var(--primary,#1E3A8A);color:#fff;border-color:var(--primary,#1E3A8A);}
.lsb-panel{width:100%;margin-top:4px;padding:12px 14px;border-radius:10px;background:var(--bg-muted,#F8FAFC);
  border:1px solid var(--border-light,#E2E8F0);font-size:12.5px;line-height:1.55;color:var(--text-primary,#0F172A);}
.lsb-panel-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;font-weight:700;color:var(--primary,#1E3A8A);}
.lsb-panel-close{border:0;background:transparent;cursor:pointer;color:var(--text-muted,#64748B);font-size:14px;padding:2px 4px;}
.lsb-panel h4{margin:10px 0 4px;font-size:12.5px;font-weight:700;}
.lsb-panel ol,.lsb-panel ul{margin:0;padding-left:18px;}
.lsb-panel li{margin:2px 0;}
.lsb-panel code{font-family:Consolas,monospace;font-size:12px;background:#fff;border:1px solid var(--border-light,#E2E8F0);border-radius:4px;padding:0 4px;}
.lsb-panel .lsb-muted{color:var(--text-muted,#64748B);}
@media (max-width:560px){.lsb-label{width:100%;} .lsb-btn{width:100%;}}
`;

export default function LedgerScanBar({ onOpenChallan = () => {}, toast = () => {} }) {
  const [val, setVal] = useState('');
  const [infoOpen, setInfoOpen] = useState(false);
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
        <button
          type="button"
          className="lsb-info"
          aria-label="How Challan Lookup works"
          aria-expanded={infoOpen}
          title="How it works"
          onClick={() => setInfoOpen((o) => !o)}
        >
          <i className="fa-solid fa-circle-info"></i>
        </button>
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
      {infoOpen && (
        <div className="lsb-panel" role="region" aria-label="Challan Lookup details">
          <div className="lsb-panel-head">
            <span><i className="fa-solid fa-barcode"></i> Challan Lookup — how it works</span>
            <button type="button" className="lsb-panel-close" aria-label="Close" onClick={() => setInfoOpen(false)}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <p style={{ margin: '0 0 6px' }}>
            This box opens a fee challan directly in <b>Fee → Receiving</b>, with the receive popup already open
            for that student and month. You don't have to search for the student.
          </p>

          <h4>1. Scan the barcode on the challan</h4>
          <ol>
            <li>Every fee challan printed from the Fee module has a barcode under the payment steps (on the Bank, School and Parent copies).</li>
            <li>Click inside this box, then scan the barcode with your scanner (e.g. SpeedX speed-x-8500).</li>
            <li>The scanner types the code and presses Enter, so the challan opens automatically. No need to click anything.</li>
          </ol>

          <h4>2. Or type the Ledger ID</h4>
          <ol>
            <li>Each challan shows its <b>Ledger ID</b> printed under the barcode (e.g. "Ledger ID: 10452").</li>
            <li>Type that number in the box and press <b>Enter</b>, or click <b>Open Challan</b>.</li>
          </ol>

          <h4>What the barcode contains</h4>
          <ul>
            <li>Format: <code>LedgerID-StudentID</code>, for example <code>10452-1783</code>.</li>
            <li>The Ledger ID finds the exact challan. The Student ID is checked against it, so a wrong or mismatched code is rejected.</li>
            <li>Typing only the Ledger ID also works.</li>
          </ul>

          <h4>Scanner setup</h4>
          <ul>
            <li>The barcode is <b>Code 128</b>. Make sure Code 128 is enabled on the scanner (most scanners have it on by default).</li>
            <li>The scanner should send <b>Enter</b> after each scan (the default "suffix" setting). If the challan doesn't open by itself, enable the Enter suffix in the scanner's setup barcodes.</li>
          </ul>

          <h4>Good to know</h4>
          <ul>
            <li>The Pay Now amounts are pre-filled with each head's remaining balance. You can change them before paying.</li>
            <li>If you see "Challan not found", the Ledger ID is not in this branch or the challan is older than 24 months.</li>
            <li>A challan with no saved record (not yet generated) has no barcode.</li>
          </ul>
          <div className="lsb-muted" style={{ marginTop: 6 }}>Family (combined) challans don't have a barcode yet.</div>
        </div>
      )}
    </div>
  );
}
