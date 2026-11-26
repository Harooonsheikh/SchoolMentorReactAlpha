/* ═══════════════════════════════════════════════════════════════════
   docKit / theme — CSS for every document the kit renders.
   Two print styles share one markup:
     .dk.col  → Colourful (navy / gold / teal, from the Mentor AI
                lesson-plan PDF and the QP template)
     .dk.ink  → Inkless (black outlines on white, light grey fills
                only, from worksheet_premium_inkless)
   Sheet = one A4 page width (794 CSS px). PDF export slices sheets
   into A4 pages at safe break points (.dk-brk).
   ═══════════════════════════════════════════════════════════════════ */

export const DK_FONTS = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700&family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap';

export const DK_CSS = `
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0}
body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.dk-stage{background:#E8EBF0;padding:22px 12px 40px;min-height:100vh}
.dk-stage.flat{background:#fff;padding:0;min-height:0}
.dk{font-family:'Inter','Segoe UI',system-ui,sans-serif;color:#2B2F38;font-size:13px;line-height:1.65}
.dk[dir=rtl]{font-family:'Noto Nastaliq Urdu','Jameel Noori Nastaleeq','Inter',serif;line-height:2.1}
.dk-sheet{width:794px;min-height:1123px;margin:0 auto 22px;background:#fff;box-shadow:0 4px 28px rgba(15,23,42,.12);border-radius:3px;position:relative;overflow:hidden;display:flex;flex-direction:column}
.dk-stage.flat .dk-sheet{box-shadow:none;border-radius:0;margin:0 auto;min-height:0}
.dk-sheet-body{padding:30px 46px 34px;flex:1}
.dk p{margin:0 0 8px}
.dk a{color:inherit}
.dk-serif{font-family:'Playfair Display',Georgia,'Times New Roman',serif}

/* ── Masthead (lesson / question bank) ── */
.dk-mast{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:30px 46px 26px}
.dk-mast-l{display:flex;align-items:center;gap:20px;min-width:0}
.dk-crest{width:64px;height:64px;flex-shrink:0}
.dk-crest img{width:64px;height:64px;object-fit:contain;border-radius:10px}
.dk-school{font-family:'Playfair Display',Georgia,serif;font-size:25px;font-weight:700;line-height:1.15}
.dk-tag{font-size:9.5px;font-weight:600;letter-spacing:.24em;text-transform:uppercase;margin-top:7px}
.dk-mast-r{text-align:right;flex-shrink:0}
.dk-doctype{font-family:'Playfair Display',Georgia,serif;font-size:19px;font-weight:700;line-height:1.1}
.dk-docsub{font-size:9.5px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;margin-top:5px}
.dk-rule{height:5px}
.dk-meta{display:flex;align-items:center;flex-wrap:wrap;padding:0 46px;min-height:44px}
.dk-mi{display:flex;align-items:baseline;gap:9px;padding:6px 24px 6px 0;margin-right:24px;white-space:nowrap}
.dk-mi:last-child{margin-right:0;border-right:none!important}
.dk-mi b{font-size:8.5px;font-weight:700;letter-spacing:.17em;text-transform:uppercase}
.dk-mi span{font-size:12.5px;font-weight:500}

/* ── Title block ── */
.dk-kicker{font-size:10.5px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;margin:6px 0 6px}
.dk-title{font-family:'Playfair Display',Georgia,serif;font-size:31px;font-weight:700;line-height:1.2;margin:0 0 10px}
.dk[dir=rtl] .dk-title,.dk[dir=rtl] .dk-school{font-family:'Noto Nastaliq Urdu',serif;line-height:1.9}
.dk-sub{font-size:12.5px;color:#7A8090;display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center}
.dk-sub i{font-style:normal}
.dk-hr{height:1.5px;background:#E2E5EC;margin:24px 0 26px;border:0}
.dk-badge{display:inline-block;font-size:10px;font-weight:700;padding:2px 10px;border-radius:20px;letter-spacing:.04em}

/* ── Section label pill ── */
.dk-sec{margin:0 0 24px}
.dk-sec-h{display:flex;align-items:center;gap:12px;margin:0 0 14px}
.dk-pill{display:inline-block;font-size:10.5px;font-weight:700;letter-spacing:.17em;text-transform:uppercase;padding:6px 14px;border-radius:3px}
.dk-mins{font-size:12px;color:#7A8090}
.dk-sec-marks{margin-left:auto;font-size:11px;font-weight:600}

/* ── Blocks ── */
.dk-h{font-weight:700;margin:16px 0 8px;line-height:1.35}
.dk-h1{font-size:19px}.dk-h2{font-size:16px}.dk-h3{font-size:14px}.dk-h4{font-size:13px}
.dk-sub-h{font-weight:700;font-size:13.5px;padding:1px 0 1px 12px;margin:16px 0 8px}
.dk ul,.dk ol{margin:4px 0 10px;padding-left:22px}
.dk[dir=rtl] ul,.dk[dir=rtl] ol{padding-left:0;padding-right:22px}
.dk li{margin:0 0 5px;padding-left:2px}
.dk li::marker{font-weight:600}
.dk-callout{border-left:4px solid;border-radius:0 6px 6px 0;padding:11px 18px;margin:12px 0}
.dk[dir=rtl] .dk-callout{border-left:0;border-right:4px solid;border-radius:6px 0 0 6px}
.dk-callout b.dk-cl{font-weight:700;margin-right:4px}
.dk-defs{margin:6px 0 12px}
.dk-defs div{margin:0 0 9px}
.dk-defs b{font-weight:700}
.dk-table{width:100%;border-collapse:collapse;margin:10px 0 14px;font-size:12px}
.dk-table th{font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;text-align:left;padding:9px 12px}
.dk[dir=rtl] .dk-table th{text-align:right}
.dk-table td{padding:8px 12px;vertical-align:top}
.dk-cap{font-size:11px;color:#7A8090;margin:-6px 0 12px}
.dk-fig{margin:12px 0 16px;text-align:center}
.dk-fig img{max-width:100%;max-height:360px;object-fit:contain;border-radius:6px}
.dk-fig figcaption{font-size:11px;color:#7A8090;margin-top:6px;font-style:italic}
.dk-res{display:grid;grid-template-columns:1fr 1fr;gap:6px 30px;margin:4px 0 10px;padding:0;list-style:none}
.dk-res li{position:relative;padding-left:16px;margin:0}
.dk-res li::before{content:'';position:absolute;left:0;top:.62em;width:6px;height:6px;border-radius:50%}
.dk-num{list-style:none;padding:0!important;margin:4px 0 12px}
.dk-num li{display:flex;gap:14px;align-items:flex-start;margin:0 0 10px;padding:0}
.dk-num li>i{width:23px;height:23px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:11px;font-weight:700;margin-top:1px}
.dk-video{display:inline-flex;align-items:center;gap:10px;padding:11px 20px;border-radius:6px;font-weight:500;text-decoration:none!important;margin:6px 0 10px;max-width:100%}
.dk-video svg{flex-shrink:0}
.dk-quote{margin:10px 0;padding:6px 16px;font-style:italic;border-left:3px solid}
.dk-divider{height:1px;background:#E2E5EC;margin:18px 0;border:0}
.dk-blank{display:inline-block;min-width:70px;border-bottom:1.5px solid currentColor;margin:0 3px;vertical-align:-2px;height:1em}
.dk-empty{font-style:italic;color:#9AA0AC;padding:4px 0}

/* ── Lesson card header inside a unit document ── */
.dk-lesson-h{margin:0 0 6px}
.dk-src{font-size:10px;font-weight:700;padding:3px 11px;border-radius:20px;margin-left:10px;vertical-align:middle;letter-spacing:.03em}

/* ── Student info grid (worksheet / question bank student copy) ── */
.dk-student{display:grid;grid-template-columns:2fr 1fr 2fr 1fr;border:1px solid #CCCCCC;border-radius:4px;margin:0 0 18px}
.dk-student div{padding:9px 13px;border-right:1px solid #CCCCCC}
.dk-student div:last-child{border-right:none}
.dk-student label{display:block;font-size:8.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#666;margin-bottom:14px}
.dk-student span{display:block;border-bottom:1.5px solid #333}

/* ═══════════ Question paper (QP template) ═══════════ */
.qp-body{padding:40px 48px 34px;flex:1}
.qp-masthead{border-radius:0;padding:20px 28px 16px;margin:-40px -48px 0;display:flex;align-items:center;gap:18px}
.qp-logo{width:52px;height:52px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;letter-spacing:-.5px;flex-shrink:0;overflow:hidden}
.qp-logo img{width:100%;height:100%;object-fit:contain}
.qp-school{font-size:11px;text-transform:uppercase;letter-spacing:.12em;margin-bottom:3px}
.qp-examname{font-size:20px;font-weight:800;line-height:1.15}
.qp-gold-bar{height:4px;margin:0 -48px 6px}
.qp-meta-row{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 10px}
.qp-meta-pill{display:flex;align-items:center;gap:6px;border-radius:20px;padding:5px 12px;font-size:12px;font-weight:600}
.qp-fields{display:grid;grid-template-columns:repeat(var(--qpf,3),1fr);border:1.5px solid;border-radius:8px;overflow:hidden;margin:0 0 14px}
.qp-fields div{padding:9px 14px;border-right:1.5px solid;font-size:12px}
.qp-fields div:last-child{border-right:none}
.qp-fields label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px}
.qp-fields span{font-weight:600;color:#111;font-size:13px;border-bottom:1px solid;display:block;min-height:18px}
.qp-instr{border-left:4px solid;border-radius:0 6px 6px 0;padding:10px 14px;font-size:12px;line-height:1.6;margin-bottom:8px}
.qp-instr b{font-size:11px;text-transform:uppercase;letter-spacing:.08em;display:block;margin-bottom:4px}
.qp-sec-head{font-size:9pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:8px 16px;border-radius:4px 4px 0 0;display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:18px}
.qp-sec-head span:last-child{font-weight:400;font-size:8.5pt;white-space:nowrap}
.qp-sec-body{border:1.5px solid;border-top:none;border-radius:0 0 4px 4px;padding:4px 0}
.qp-sec-note{font-size:11px;font-style:italic;padding:8px 16px 2px}
.qp-q{display:flex;gap:10px;padding:10px 16px;border-bottom:1px solid}
.qp-q:last-child{border-bottom:none}
.qp-qnum{width:26px;height:26px;border-radius:50%;font-size:9pt;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.qp-qbody{flex:1;min-width:0}
.qp-qtext{font-size:11pt;color:#1a1a1a;line-height:1.6;margin:0 0 6px}
.qp-mark{font-size:8.5pt;font-weight:700;padding:2px 8px;border-radius:3px;white-space:nowrap;margin-left:8px;float:right}
.dk[dir=rtl] .qp-mark{float:left;margin-left:0;margin-right:8px}
.qp-opts{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;margin-top:6px}
.qp-opt{font-size:10.5pt;color:#333;display:flex;gap:6px;align-items:flex-start;border-radius:4px;padding:1px 4px}
.qp-opt-lbl{font-weight:700;flex-shrink:0}
.qp-opt.ok{font-weight:700}
.qp-tf{display:flex;gap:16px;margin-top:6px}
.qp-tf-btn{border:1.5px solid;border-radius:6px;padding:5px 20px;font-size:11pt;color:#555;font-weight:500}
.qp-tf-btn.ok{font-weight:700}
.qp-blank{display:inline-block;border-bottom:1.5px solid #333;min-width:80px;height:16px;margin:0 4px;vertical-align:bottom}
.qp-match{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin-top:6px}
.qp-match-row{display:flex;gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid;font-size:10.5pt}
.qp-match-row:last-child{border-bottom:none}
.qp-match-lbl{font-weight:700;width:22px;flex-shrink:0}
.qp-match-box{border:1.5px solid;border-radius:4px;width:28px;height:24px;margin-left:auto;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:9pt;font-weight:700}
.qp-diagram{margin-top:8px;border:1.5px dashed;border-radius:6px;min-height:120px;display:flex;align-items:center;justify-content:center;font-size:11pt;overflow:hidden;padding:8px}
.qp-diagram img{max-width:100%;max-height:240px;object-fit:contain}
.qp-labels{display:grid;grid-template-columns:1fr 1fr;gap:8px 32px;margin-top:10px}
.qp-labels div{display:flex;align-items:center;gap:10px;font-size:10.5pt}
.qp-labels i{width:22px;height:22px;border-radius:50%;border:1.5px solid;font-style:normal;font-size:8.5pt;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.qp-labels u{flex:1;border-bottom:1.5px solid #888;height:18px;text-decoration:none}
.qp-calcbox{margin-top:8px;border:1.5px solid;border-radius:6px;min-height:70px;padding:8px 12px;font-size:10pt}
.qp-line{border-bottom:1px solid #d0d0d8;height:22px;margin-bottom:4px}
.qp-table{width:100%;border-collapse:collapse;margin-top:6px;font-size:10.5pt}
.qp-table th{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:6px 10px;border:1px solid;text-align:left}
.dk[dir=rtl] .qp-table th{text-align:right}
.qp-table td{padding:7px 10px;border:1px solid;vertical-align:top}
.qp-wordbank{margin:6px 0 8px;padding:8px 12px;border-radius:4px;border:1px solid;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.qp-wordbank b{font-size:8pt;letter-spacing:.12em;text-transform:uppercase;margin-right:6px}
.qp-wordbank span{padding:2px 11px;border:1px solid;border-radius:20px;font-size:10pt;background:#fff}
.qp-circle{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.qp-circle span{padding:3px 14px;border:1.5px solid;border-radius:20px;font-size:10.5pt}
.qp-circle span.ok{font-weight:700}
.qp-passage{padding:12px 15px;margin:4px 0 10px;border:1px solid;border-left-width:3px;border-radius:0 4px 4px 0;font-size:10.5pt;line-height:1.8}
.qp-topics{margin:4px 0 6px;padding:0 6px;display:grid;grid-template-columns:1fr 1fr;gap:3px 20px}
.qp-topics b{margin-inline-end:4px}
/* Standard 4-line handwriting copy: lines 1, 2 and 4 light blue, baseline (3) red;
   ~3.2 mm between lines, a small gap between bands. */
.qp-four-wrap{margin:6px 0 2px}
.qp-four{margin:0 0 9px}
.qp-four i{display:block;height:12px;border-top:1px solid #8DB0DC}
.qp-four i:nth-child(3){border-top-color:#E07070}
.qp-four i:last-child{height:0}
.qp-ans{margin-top:7px;padding:7px 11px;border-radius:5px;font-size:10pt;border:1px solid}
.qp-ans b{font-size:8pt;letter-spacing:.1em;text-transform:uppercase;margin-right:6px}
.ans-space{display:block}
.ans-label{font-size:8pt;border-radius:4px;padding:3px 8px;margin:6px 0 3px;display:inline-block;font-weight:600}
.ans-lines .qp-line{height:24px;margin-bottom:2px}
.dk[dir=rtl] .ans-lines .qp-line{height:30px}
.ans-chip{font-size:8.5pt;padding:4px 10px;border-radius:4px;margin-top:5px;display:inline-block;margin-left:6px}
.ans-chip span{font-weight:600;display:inline-block;margin-right:14px}
.ans-chip small{opacity:.65;display:inline-block}
.qp-ak-head{border-radius:6px;padding:12px 18px;font-weight:700;font-size:13pt;margin:18px 0 16px;display:flex;justify-content:space-between;align-items:center}
.qp-ak-head small{font-weight:400;font-size:10pt}
.qp-ak-sec-lbl{font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;margin-top:14px}
.qp-ak-row{display:flex;gap:8px;padding:5px 0;border-bottom:1px solid;font-size:10.5pt}
.qp-ak-n{font-weight:700;min-width:26px;flex-shrink:0}
.qp-ak-ans{color:#1a1a1a;flex:1}
.qp-ak-mark{font-size:9pt;padding:1px 7px;border-radius:3px;font-weight:600;white-space:nowrap;align-self:flex-start}

/* ── RTL (Urdu) mirroring ── */
/* letter-spacing breaks Nastaliq letter joining (and html2canvas draws each letter alone) */
.dk[dir=rtl] *{letter-spacing:0!important}
.dk[dir=rtl] .qp-fields div{border-right:none;border-left:1.5px solid}
.dk[dir=rtl] .qp-fields div:last-child{border-left:none}
.dk[dir=rtl] .qp-instr{border-left:none;border-right:4px solid;border-radius:6px 0 0 6px}
.dk[dir=rtl] .qp-passage{border-left-width:1px;border-right-width:3px;border-radius:4px 0 0 4px}
.dk[dir=rtl] .ans-chip{margin-left:0;margin-right:6px}
.dk[dir=rtl] .ans-chip span{margin-right:0;margin-left:14px}
.dk[dir=rtl] .qp-match-box{margin-left:0;margin-right:auto}
.dk[dir=rtl] .qp-qtext,.dk[dir=rtl] .qp-opt,.dk[dir=rtl] .qp-passage{line-height:2.05}
.dk.col[dir=rtl] .qp-instr{border-color:var(--teal)}
.dk.col[dir=rtl] .qp-passage{border-color:var(--rule);border-right-color:var(--gold)}
.dk.ink[dir=rtl] .qp-instr{border:1.5px solid #bbb;border-right:4px solid #111}
.dk.ink[dir=rtl] .qp-passage{border-color:#ccc;border-right-color:#555}
.dk.col[dir=rtl] .qp-fields div{border-color:var(--rule)}
.dk.ink[dir=rtl] .qp-fields div{border-color:#bbb}

/* ── Footer ── */
.dk-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 46px;font-size:10px;letter-spacing:.04em;margin-top:auto}
.dk-foot b{font-family:'Playfair Display',Georgia,serif;font-size:13px;letter-spacing:.01em}
.dk-pdf .dk-foot{display:none}
/* html2canvas drops word spaces with the Playfair web font — use Georgia in the PDF raster */
.dk-pdf .dk:not([dir=rtl]) .dk-school,.dk-pdf .dk:not([dir=rtl]) .dk-doctype,.dk-pdf .dk:not([dir=rtl]) .dk-title,.dk-pdf .dk-foot b{font-family:Georgia,'Times New Roman',serif;letter-spacing:0}

/* ═══════════ COLOURFUL ═══════════ */
.dk.col{--navy:#0F1F3D;--navy2:#1A2B4D;--gold:#B8882A;--goldLt:#F6EAD3;--teal:#0E5A52;--tealLt:#E6F2F1;--blue:#1A3A6B;--blueLt:#E8EFF8;--red:#B42323;--redLt:#FDECEC;--rule:#E2E5EC;--muted:#7A8090}
.dk.col .dk-mast{background:var(--navy);color:#fff}
.dk.col .dk-tag{color:var(--gold)}
.dk.col .dk-doctype{color:var(--gold)}
.dk.col .dk-docsub{color:#A9B1C2}
.dk.col .dk-rule{background:linear-gradient(90deg,var(--gold) 0%,var(--gold) 55%,#4B5875 100%)}
.dk.col .dk-meta{background:var(--navy2);color:#fff}
.dk.col .dk-mi{border-right:1px solid rgba(255,255,255,.18)}
.dk.col .dk-mi b{color:var(--gold)}
.dk.col .dk-kicker{color:var(--gold)}
.dk.col .dk-title{color:var(--navy)}
.dk.col .dk-pill{background:var(--navy);color:#fff}
.dk.col .dk-pill.t-gold{background:var(--gold)}
.dk.col .dk-pill.t-blue{background:#1E3A6B}
.dk.col .dk-pill.t-red{background:var(--red)}
.dk.col .dk-pill.t-teal{background:var(--teal)}
.dk.col .dk-sec-marks{color:var(--blue)}
.dk.col .dk-sub-h{color:var(--blue);border-left:3px solid var(--navy)}
.dk.col[dir=rtl] .dk-sub-h{border-left:0;border-right:3px solid var(--navy);padding:1px 12px 1px 0}
.dk.col .dk-h{color:var(--navy)}
.dk.col li::marker{color:var(--navy)}
.dk.col .dk-callout{background:var(--tealLt);border-color:var(--teal)}
.dk.col .dk-callout b.dk-cl{color:var(--teal)}
.dk.col .dk-callout.v-warning,.dk.col .dk-callout.v-teacher,.dk.col .dk-callout.v-gold{background:var(--goldLt);border-color:var(--gold)}
.dk.col .dk-callout.v-warning b.dk-cl,.dk.col .dk-callout.v-teacher b.dk-cl,.dk.col .dk-callout.v-gold b.dk-cl{color:#8A5F12}
.dk.col .dk-callout.v-note,.dk.col .dk-callout.v-blue{background:var(--blueLt);border-color:var(--blue)}
.dk.col .dk-callout.v-note b.dk-cl,.dk.col .dk-callout.v-blue b.dk-cl{color:var(--blue)}
.dk.col .dk-callout.v-alert,.dk.col .dk-callout.v-danger{background:var(--redLt);border-color:var(--red)}
.dk.col .dk-callout.v-alert b.dk-cl,.dk.col .dk-callout.v-danger b.dk-cl{color:var(--red)}
.dk.col .dk-defs b{color:var(--navy)}
.dk.col .dk-table th{background:var(--navy);color:#fff;border:1px solid var(--navy)}
.dk.col .dk-table td{border:1px solid var(--rule)}
.dk.col .dk-table tr:nth-child(even) td{background:#F7F8FB}
.dk.col .dk-fig img{border:1px solid var(--rule)}
.dk.col .dk-res li::before{background:var(--gold)}
.dk.col .dk-num li>i{background:var(--navy);color:#fff}
.dk.col .dk-video{background:var(--redLt);border:1px solid #F5C2C2;color:var(--red)}
.dk.col .dk-quote{border-color:var(--gold);color:#4A4F5C}
.dk.col .dk-src.ai{background:#EDE9FE;color:#6D28D9}
.dk.col .dk-src.manual{background:#DCFCE7;color:#15803D}
.dk.col .dk-foot{background:var(--navy);color:#A9B1C2}
.dk.col .dk-foot b{color:var(--gold)}
/* paper — colourful */
.dk.col .qp-masthead{background:var(--navy)}
.dk.col .qp-logo{background:rgba(255,255,255,.12);color:#fff}
.dk.col .qp-school{color:rgba(255,255,255,.65)}
.dk.col .qp-examname{color:#fff}
.dk.col .qp-gold-bar{background:linear-gradient(90deg,#B8882A,#F0C040,#B8882A)}
.dk.col .qp-meta-pill{background:var(--blueLt);color:var(--blue)}
.dk.col .qp-fields,.dk.col .qp-fields div{border-color:var(--rule)}
.dk.col .qp-fields label{color:var(--muted)}
.dk.col .qp-fields span{border-color:var(--rule)}
.dk.col .qp-instr{background:var(--tealLt);border-color:var(--teal);color:var(--teal)}
.dk.col .qp-instr b{color:var(--teal)}
.dk.col .qp-sec-head{background:var(--navy);color:#fff}
.dk.col .qp-sec-head span:last-child{opacity:.75}
.dk.col .qp-sec-body{border-color:var(--rule)}
.dk.col .qp-sec-note{color:var(--muted)}
.dk.col .qp-q{border-color:var(--rule)}
.dk.col .qp-qnum{background:var(--teal);color:#fff}
.dk.col .qp-mark{background:var(--blueLt);color:var(--blue)}
.dk.col .qp-opt-lbl{color:var(--teal)}
.dk.col .qp-opt.ok{background:var(--tealLt);color:var(--teal)}
.dk.col .qp-tf-btn{border-color:var(--rule)}
.dk.col .qp-tf-btn.ok{background:var(--tealLt);border-color:var(--teal);color:var(--teal)}
.dk.col .qp-match-row{border-color:var(--rule)}
.dk.col .qp-match-lbl{color:var(--teal)}
.dk.col .qp-match-box{border-color:var(--rule);color:var(--teal)}
.dk.col .qp-diagram{border-color:var(--rule);color:var(--muted)}
.dk.col .qp-labels i{border-color:var(--teal);color:var(--teal)}
.dk.col .qp-calcbox{border-color:var(--rule);color:var(--muted)}
.dk.col .qp-table th{background:var(--blueLt);color:var(--blue);border-color:#C9D6EA}
.dk.col .qp-table td{border-color:var(--rule)}
.dk.col .qp-wordbank{background:var(--blueLt);border-color:#C9D6EA}
.dk.col .qp-wordbank b{color:var(--blue)}
.dk.col .qp-wordbank span{border-color:#C9D6EA;color:var(--blue)}
.dk.col .qp-circle span{border-color:#C9D6EA}
.dk.col .qp-circle span.ok{background:var(--tealLt);border-color:var(--teal);color:var(--teal)}
.dk.col .qp-passage{background:#FAFBFD;border-color:var(--rule);border-left-color:var(--gold)}
.dk.col .qp-ans{background:var(--tealLt);border-color:#BFDCD8;color:#163E3A}
.dk.col .qp-ans b{color:var(--teal)}
.dk.col .ans-label{color:var(--teal);background:var(--tealLt)}
.dk.col .ans-lines .qp-line{border-bottom-color:#aad8d4}
.dk.col .ans-chip{color:var(--teal);background:var(--tealLt)}
.dk.col .qp-ak-head{background:var(--teal);color:#fff}
.dk.col .qp-ak-head small{opacity:.85}
.dk.col .qp-ak-sec-lbl{color:var(--teal)}
.dk.col .qp-ak-row{border-color:var(--rule)}
.dk.col .qp-ak-n{color:var(--teal)}
.dk.col .qp-ak-mark{background:var(--blueLt);color:var(--blue)}
.dk.col .qp-foot{border-top:3px solid var(--gold);color:var(--muted)}

/* ═══════════ INKLESS ═══════════ */
.dk.ink{color:#111}
.dk.ink .dk-mast{border-bottom:2.5px solid #111;color:#111}
.dk.ink .dk-crest svg *{stroke:#111}
.dk.ink .dk-tag,.dk.ink .dk-docsub{color:#555}
.dk.ink .dk-rule{display:none}
.dk.ink .dk-meta{border-bottom:1px solid #CCC;color:#111}
.dk.ink .dk-mi{border-right:1px solid #CCC}
.dk.ink .dk-mi b{color:#555}
.dk.ink .dk-kicker{color:#555}
.dk.ink .dk-title{color:#111}
.dk.ink .dk-pill{border:1.5px solid #111;background:#F0F0F0;color:#111}
.dk.ink .dk-sec-marks{color:#333}
.dk.ink .dk-sub-h{color:#111;border-left:2.5px solid #555}
.dk.ink[dir=rtl] .dk-sub-h{border-left:0;border-right:2.5px solid #555;padding:1px 12px 1px 0}
.dk.ink .dk-callout{background:#F5F5F5;border-color:#555}
.dk.ink .dk-callout b.dk-cl{color:#111}
.dk.ink .dk-table th{background:#EEE;color:#111;border:1.5px solid #999}
.dk.ink .dk-table td{border:1px solid #CCC}
.dk.ink .dk-table tr:nth-child(even) td{background:#F8F8F8}
.dk.ink .dk-fig img{border:1px solid #CCC;filter:grayscale(1)}
.dk.ink .dk-res li::before{background:#555}
.dk.ink .dk-num li>i{border:1.5px solid #333;color:#111;background:#fff}
.dk.ink .dk-video{border:1.5px solid #999;color:#111;background:#FAFAFA}
.dk.ink .dk-quote{border-color:#555;color:#333}
.dk.ink .dk-src{border:1px solid #999;color:#111;background:#fff}
.dk.ink .dk-foot{border-top:2px solid #111;color:#666}
.dk.ink .dk-foot b{color:#111}
/* paper — B&W */
.dk.ink .qp-masthead{border:2px solid #111;border-bottom:3px solid #111;padding:16px 28px}
.dk.ink .qp-logo{border:2px solid #111;color:#111;border-radius:6px}
.dk.ink .qp-school{color:#555}
.dk.ink .qp-examname{color:#111}
.dk.ink .qp-gold-bar{height:3px;background:#111}
.dk.ink .qp-meta-pill{border:1.5px solid #ccc;color:#333}
.dk.ink .qp-fields{border-color:#bbb;border-radius:0}
.dk.ink .qp-fields div{border-color:#bbb}
.dk.ink .qp-fields label{color:#888}
.dk.ink .qp-fields span{border-color:#ccc}
.dk.ink .qp-instr{border:1.5px solid #bbb;border-left:4px solid #111;color:#333;border-radius:0}
.dk.ink .qp-instr b{color:#111}
.dk.ink .qp-sec-head{background:#f0f0f0;color:#111;border:1.5px solid #bbb;border-bottom:none;border-radius:0}
.dk.ink .qp-sec-head span:last-child{color:#555}
.dk.ink .qp-sec-body{border-color:#bbb;border-radius:0}
.dk.ink .qp-sec-note{color:#555}
.dk.ink .qp-q{border-color:#ddd}
.dk.ink .qp-qnum{border:1.5px solid #333;color:#111}
.dk.ink .qp-mark{background:#f0f0f0;color:#333;border:1px solid #ccc}
.dk.ink .qp-opt.ok{text-decoration:underline}
.dk.ink .qp-tf-btn{border-color:#bbb;border-radius:4px}
.dk.ink .qp-tf-btn.ok{border-color:#111;color:#111}
.dk.ink .qp-match-row{border-color:#ddd}
.dk.ink .qp-match-box{border-color:#bbb;border-radius:2px}
.dk.ink .qp-diagram{border-color:#bbb;color:#999;border-radius:0}
.dk.ink .qp-diagram img{filter:grayscale(1)}
.dk.ink .qp-labels i{border-color:#333}
.dk.ink .qp-calcbox{border-color:#bbb;color:#aaa;border-radius:0}
.dk.ink .qp-line{border-bottom-color:#ccc}
.dk.ink .qp-table th{background:#EEE;color:#111;border-color:#999}
.dk.ink .qp-table td{border-color:#ccc}
.dk.ink .qp-wordbank{background:#F5F5F5;border-color:#ccc}
.dk.ink .qp-wordbank b{color:#555}
.dk.ink .qp-wordbank span{border-color:#bbb}
.dk.ink .qp-circle span{border-color:#aaa}
.dk.ink .qp-circle span.ok{border-color:#111;border-width:2px}
.dk.ink .qp-passage{background:#FAFAFA;border-color:#ccc;border-left-color:#555}
.dk.ink .qp-ans{background:#F5F5F5;border-color:#ccc;color:#111}
.dk.ink .ans-label{color:#333;background:#f0f0f0;border:1px solid #ccc}
.dk.ink .ans-lines .qp-line{border-bottom-color:#bbb}
.dk.ink .qp-four i{border-top-color:#AAAAAA}
.dk.ink .qp-four i:nth-child(3){border-top-color:#555555}
.dk.ink .ans-chip{color:#333;background:#f0f0f0;border:1px solid #ccc}
.dk.ink .qp-ak-head{border:2px solid #111;color:#111}
.dk.ink .qp-ak-head small{color:#555}
.dk.ink .qp-ak-sec-lbl{color:#333}
.dk.ink .qp-ak-row{border-color:#ddd}
.dk.ink .qp-ak-mark{background:#f0f0f0;color:#333;border:1px solid #ccc}
.dk.ink .qp-foot{border-top:2px solid #333;color:#888}

.qp-foot{display:flex;justify-content:space-between;gap:12px;font-size:9pt;padding:10px 48px;margin-top:auto}
.dk-pdf .qp-foot{display:none}

@media (max-width:820px){
  .dk-stage:not(.flat){padding:10px 0 30px}
}
@page{size:A4;margin:0}
@media print{
  .dk-stage{background:#fff!important;padding:0!important}
  .dk-sheet{box-shadow:none!important;margin:0 auto!important;border-radius:0!important;min-height:0!important;break-after:page}
  .dk-sheet:last-child{break-after:auto}
  .dk-brk,.qp-q,.dk-callout,.dk-fig,tr{break-inside:avoid}
  .dk-sec-h,.qp-sec-head,.dk-sub-h{break-after:avoid}
}
`;
