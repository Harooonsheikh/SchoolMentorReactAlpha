/* ═══════════════════════════════════════════════════════════════════
   SUPER ADMIN — design system (ported from "Super Admin Support .html")

   Every selector is scoped under `.sa-root` so these styles never leak
   into the school ERP shell. The Super Admin app is a self-contained
   full-screen surface (mounted at #superadmin) that hosts two modules:
     • Mentor AI  — frontend-only screens (Plan Management + Payments)
     • Support    — the existing agent console (Overview + Agent Inbox)
   Light/dark theming is driven by the `data-theme` attribute on the
   `.sa-root` wrapper.
   ═══════════════════════════════════════════════════════════════════ */

export const SA_CSS = `
.sa-root{
  --brand:#1E3A8A; --brand-mid:#1E40AF; --brand-light:#DBEAFE;
  --bg:#F0F4FF; --card:#FFFFFF; --muted:#EFF6FF;
  --t1:#0F172A; --t2:#1E3A5F; --tm:#64748B;
  --success:#16A34A; --warn:#D97706; --err:#DC2626; --info:#0284C7;
  --bl:#BFDBFE; --bm:#93C5FD;
  --s-xs:0 1px 2px rgba(0,0,0,.06);
  --s-sm:0 2px 6px rgba(30,58,138,.18),0 1px 2px rgba(0,0,0,.05);
  --s-md:0 4px 14px rgba(30,58,138,.20);
  --s-lg:0 10px 30px rgba(30,58,138,.22),0 4px 8px rgba(0,0,0,.07);
  --s-xl:0 20px 50px rgba(30,58,138,.20),0 8px 16px rgba(0,0,0,.08);
  --r-sm:6px; --r-md:10px; --r-lg:14px; --r-xl:20px; --r-f:9999px;
  --font:'Plus Jakarta Sans',sans-serif;
  --tr:all .2s cubic-bezier(.4,0,.2,1);
  --inp:#FFFFFF;
  font-family:var(--font); color:var(--t1); background:var(--bg);
}
.sa-root[data-theme="dark"]{
  --bg:#080D1A; --card:#0E1628; --muted:#131F38; --inp:#0E1628;
  --t1:#E2E8F8; --t2:#B8C8E8; --tm:#6B82A8;
  --brand:#3B82F6; --brand-mid:#2563EB; --brand-light:#1E3A6A;
  --bl:#1C2E50; --bm:#243858;
}
.sa-root *,.sa-root *::before,.sa-root *::after{box-sizing:border-box;margin:0;padding:0}
.sa-root button{font-family:var(--font);cursor:pointer}
.sa-root input,.sa-root select,.sa-root textarea{font-family:var(--font)}

/* LAYOUT */
.sa-root .app-layout{display:flex;min-height:100vh}
.sa-root .sidebar{width:240px;flex-shrink:0;background:var(--card);border-right:1px solid var(--bl);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;box-shadow:2px 0 12px rgba(30,58,138,.08);z-index:100}
.sa-root .main-content{flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden}
.sa-root .topbar{height:60px;background:var(--card);border-bottom:1px solid var(--bl);display:flex;align-items:center;justify-content:space-between;padding:0 24px;position:sticky;top:0;z-index:90;box-shadow:var(--s-xs);flex-shrink:0}
.sa-root .page-content{flex:1;padding:24px;overflow-y:auto;overflow-x:hidden;background:var(--bg);min-height:0}

/* SIDEBAR */
.sa-root .sidebar-logo{padding:14px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--bl);min-height:62px;flex-shrink:0}
.sa-root .logo-icon{width:36px;height:36px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1a237e,#283593);color:#fff}
.sa-root .logo-name{font-size:11px;font-weight:700;color:var(--t1);line-height:1.35}
.sa-root .sidebar-nav{flex:1;overflow-y:auto;padding:8px 0;scrollbar-width:none}
.sa-root .sidebar-nav::-webkit-scrollbar{display:none}
.sa-root .nav-section-label{font-size:9.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--tm);padding:12px 16px 4px}
.sa-root .nav-divider{border:none;border-top:1px solid var(--bl);margin:6px 12px}
.sa-root .nav-item{display:flex;align-items:center;gap:10px;padding:9px 14px;border-radius:var(--r-md);margin:1px 8px;cursor:pointer;transition:var(--tr);position:relative;border:none;background:transparent;width:calc(100% - 16px);text-align:left}
.sa-root .nav-item:hover:not(.active){background:rgba(30,58,138,.06)}
.sa-root .nav-item.active{background:linear-gradient(135deg,rgba(30,58,138,.12),rgba(30,64,175,.08))}
.sa-root .nav-item.active::before{content:'';position:absolute;left:-8px;top:50%;transform:translateY(-50%);width:3px;height:20px;border-radius:2px;background:linear-gradient(180deg,#1E3A8A,#1E40AF)}
.sa-root .nav-iw{width:32px;height:32px;border-radius:9px;flex-shrink:0;background:rgba(30,58,138,.08);color:var(--brand);display:flex;align-items:center;justify-content:center;font-size:13px}
.sa-root .nav-item.active .nav-iw{background:rgba(30,58,138,.18);color:#1E40AF}
.sa-root .nav-nm{font-size:12.5px;font-weight:600;color:var(--t2)}
.sa-root .nav-item.active .nav-nm{color:var(--brand);font-weight:700}
.sa-root .nav-st{font-size:10px;color:var(--tm);margin-top:1px}
.sa-root .sidebar-footer{padding:12px 16px;border-top:1px solid var(--bl)}
.sa-root .reset-btn{width:100%;height:36px;border-radius:var(--r-md);border:1.5px solid rgba(220,38,38,.25);background:rgba(220,38,38,.05);color:var(--err);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:7px;transition:var(--tr)}
.sa-root .reset-btn:hover{background:rgba(220,38,38,.12);border-color:var(--err)}

/* TOPBAR */
.sa-root .tb-left{display:flex;align-items:center;gap:12px}
.sa-root .breadcrumb{display:flex;align-items:center;gap:6px;font-size:13px}
.sa-root .bc-item{color:var(--tm)}
.sa-root .bc-item.cur{color:var(--brand);font-weight:700}
.sa-root .bc-sep{color:var(--tm);font-size:10px}
.sa-root .tb-right{display:flex;align-items:center;gap:8px}
.sa-root .tb-user{display:flex;align-items:center;gap:8px;padding:5px 12px;border-radius:var(--r-f);border:1.5px solid var(--bl);background:var(--muted);cursor:pointer;transition:var(--tr)}
.sa-root .tb-user:hover{border-color:var(--brand)}
.sa-root .tb-avatar{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center}
.sa-root .tb-uname{font-size:12.5px;font-weight:700;color:var(--t2)}
.sa-root .theme-btn{width:34px;height:34px;border-radius:var(--r-f);border:1.5px solid var(--bl);background:var(--card);color:var(--tm);display:flex;align-items:center;justify-content:center;font-size:14px;transition:var(--tr)}
.sa-root .theme-btn:hover{background:var(--muted);color:var(--brand)}
.sa-root .hamburger{display:none;width:36px;height:36px;border-radius:var(--r-md);border:1.5px solid var(--bl);background:var(--muted);color:var(--t2);align-items:center;justify-content:center;font-size:14px}

/* PAGE HEADER */
.sa-root .page-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:22px;flex-wrap:wrap;gap:12px}
.sa-root .page-title-row{display:flex;align-items:center;gap:14px}
.sa-root .page-icon{width:46px;height:46px;border-radius:14px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff;background:linear-gradient(135deg,#1E3A8A,#1E40AF);box-shadow:0 6px 18px rgba(30,58,138,.32)}
.sa-root .page-title{font-size:22px;font-weight:800;color:var(--t1);letter-spacing:-.02em}
.sa-root .page-sub{font-size:13px;color:var(--tm);margin-top:3px}

/* MODULE TABS */
.sa-root .app-tabs{display:flex;background:var(--card);border:1.5px solid var(--bl);border-radius:var(--r-lg);box-shadow:var(--s-sm);margin-bottom:22px;overflow:hidden}
.sa-root .app-tab{flex:1;padding:13px 20px;border:none;background:transparent;font-size:13.5px;font-weight:600;color:var(--tm);cursor:pointer;transition:var(--tr);display:flex;align-items:center;justify-content:center;gap:8px;border-right:1px solid var(--bl)}
.sa-root .app-tab:last-child{border-right:none}
.sa-root .app-tab:hover:not(.active){background:var(--muted);color:var(--t1)}
.sa-root .app-tab.active{background:linear-gradient(135deg,#1E3A8A,#1E40AF,#2563EB);color:#fff;font-weight:700}

/* SECTION CARD */
.sa-root .section-card{background:var(--card);border:1px solid var(--bl);border-radius:var(--r-xl);box-shadow:var(--s-sm);margin-bottom:20px}
.sa-root .card-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--bl);background:linear-gradient(135deg,rgba(30,58,138,.03),transparent);border-radius:var(--r-xl) var(--r-xl) 0 0;flex-wrap:wrap;gap:10px}
.sa-root .card-title{font-size:14px;font-weight:800;color:var(--t1);display:flex;align-items:center;gap:8px}
.sa-root .card-title i{color:var(--brand)}
.sa-root .card-sub{font-size:11.5px;color:var(--tm);margin-top:2px;font-weight:500}
.sa-root .card-body{padding:20px}

/* STAT CARDS */
.sa-root .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px}
.sa-root .stat-card{background:var(--card);border:1px solid var(--bl);border-radius:var(--r-lg);padding:16px 18px;box-shadow:var(--s-xs);position:relative;overflow:hidden;border-left:3px solid var(--brand)}
.sa-root .stat-card::after{content:'';position:absolute;right:-10px;top:-10px;width:70px;height:70px;border-radius:50%;background:linear-gradient(135deg,rgba(30,58,138,.06),transparent)}
.sa-root .stat-icon{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;color:#fff;margin-bottom:10px;background:linear-gradient(135deg,#1E3A8A,#1E40AF)}
.sa-root .stat-val{font-size:24px;font-weight:800;color:var(--t1);letter-spacing:-.02em}
.sa-root .stat-lbl{font-size:11.5px;color:var(--tm);font-weight:600;margin-top:2px}
.sa-root .stat-card.s-green{border-left-color:var(--success)}.sa-root .stat-card.s-green .stat-icon{background:linear-gradient(135deg,#15803d,#16a34a)}
.sa-root .stat-card.s-warn{border-left-color:var(--warn)}.sa-root .stat-card.s-warn .stat-icon{background:linear-gradient(135deg,#b45309,#d97706)}
.sa-root .stat-card.s-err{border-left-color:var(--err)}.sa-root .stat-card.s-err .stat-icon{background:linear-gradient(135deg,#b91c1c,#dc2626)}
.sa-root .stat-card.s-purple{border-left-color:#7C3AED}.sa-root .stat-card.s-purple .stat-icon{background:linear-gradient(135deg,#6d28d9,#7c3aed)}

/* PAYMENTS STAT GRID — 6 columns */
.sa-root .stat-grid-6{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:20px}

/* FILTER BAR */
.sa-root .filter-bar{display:flex;align-items:flex-end;gap:10px;padding:16px 20px;border-bottom:1px solid var(--bl);flex-wrap:wrap;background:var(--card)}
.sa-root .f-field{display:flex;flex-direction:column;min-width:140px}
.sa-root .f-label{font-size:11.5px;font-weight:700;color:var(--t2);margin-bottom:5px;display:block}
.sa-root .f-input{width:100%;height:38px;border:1.5px solid var(--bl);border-radius:var(--r-md);padding:0 12px;font-size:13px;color:var(--t1);background:var(--inp);outline:none;transition:var(--tr)}
.sa-root .f-input:hover{border-color:var(--bm)}
.sa-root .f-input:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(30,58,138,.09)}
.sa-root .f-textarea{width:100%;min-height:70px;border:1.5px solid var(--bl);border-radius:var(--r-md);padding:10px 13px;font-size:13px;color:var(--t1);background:var(--inp);outline:none;resize:vertical;transition:var(--tr)}
.sa-root .f-textarea:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(30,58,138,.09)}
.sa-root select.f-input{cursor:pointer}
.sa-root .f-field-grow{flex:1;min-width:180px}
.sa-root .search-box{display:flex;align-items:center;gap:8px;background:var(--muted);border:1.5px solid var(--bl);border-radius:var(--r-f);padding:0 14px;height:38px;transition:var(--tr);width:100%}
.sa-root .search-box:focus-within{border-color:var(--brand);box-shadow:0 0 0 3px rgba(30,58,138,.09)}
.sa-root .search-box i{color:var(--tm);font-size:13px;flex-shrink:0}
.sa-root .search-input{border:none;background:transparent;outline:none;font-size:13px;color:var(--t1);width:100%}

/* BUTTONS */
.sa-root .btn-primary{display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 18px;border-radius:var(--r-md);border:none;background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;font-size:13px;font-weight:700;box-shadow:0 4px 14px rgba(30,58,138,.28);transition:var(--tr)}
.sa-root .btn-primary:hover{transform:translateY(-1px)}
.sa-root .btn-secondary{display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 16px;border-radius:var(--r-md);border:1.5px solid var(--bl);background:var(--muted);color:var(--t2);font-size:13px;font-weight:600;transition:var(--tr)}
.sa-root .btn-secondary:hover{background:var(--card);color:var(--t1)}
.sa-root .btn-success{display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 16px;border-radius:var(--r-md);border:none;background:linear-gradient(135deg,#15803d,#16a34a);color:#fff;font-size:13px;font-weight:700;box-shadow:0 4px 12px rgba(22,163,74,.28);transition:var(--tr)}
.sa-root .btn-success:hover{transform:translateY(-1px)}
.sa-root .btn-danger{display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 16px;border-radius:var(--r-md);border:none;background:linear-gradient(135deg,#b91c1c,#dc2626);color:#fff;font-size:13px;font-weight:700;box-shadow:0 4px 12px rgba(220,38,38,.28);transition:var(--tr)}
.sa-root .btn-danger:hover{transform:translateY(-1px)}
.sa-root .btn-info{display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 16px;border-radius:var(--r-md);border:none;background:linear-gradient(135deg,#0369a1,#0284c7);color:#fff;font-size:13px;font-weight:700;box-shadow:0 4px 12px rgba(2,132,199,.28);transition:var(--tr)}
.sa-root .btn-info:hover{transform:translateY(-1px)}
.sa-root .btn-sm{display:inline-flex;align-items:center;gap:5px;padding:6px 13px;border-radius:var(--r-md);border:1.5px solid var(--brand);background:rgba(30,58,138,.06);color:var(--brand);font-size:11.5px;font-weight:700;transition:var(--tr)}
.sa-root .btn-sm:hover{background:rgba(30,58,138,.14)}

/* EXPORT ROW */
.sa-root .export-row{display:flex;gap:8px;justify-content:flex-end;padding:0 20px 16px;flex-wrap:wrap}

/* PRINT — "Download PDF" / "Print" window.print() chalate hain, jo POORA
   document chhapta hai: sidebar, tabs, filter bar, sab. Is liye jo cheez
   sach me kaagaz par jani hai us par .sa-print-area lagta hai (Reports ka
   panel, challan slip ka paper) aur baaqi sab chhup jata hai.
   display:none ke bajaye visibility isliye ke display hatane se table ka
   column layout toot jata hai; visibility jagah chhorti hai magar chhapti
   nahi, aur print-area ko top-left par utha diya jata hai. */
@media print{
  body *{visibility:hidden !important}
  .sa-print-area,.sa-print-area *{visibility:visible !important}
  .sa-print-area{position:absolute !important;left:0;top:0;width:100%;margin:0;border:none;box-shadow:none;
    -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sa-no-print{display:none !important}
  /* Shell ke scroll boxes print-area ko pehle safhe par kaat dete hain —
     chhapte waqt sab kuch seedha block aur visible. */
  .sa-root .app-layout,.sa-root .main-content,.sa-root .page-content{
    display:block !important;overflow:visible !important;height:auto !important;
    min-height:0 !important;padding:0 !important}
  /* Slip ka overlay bhi fixed + scrollable hai — usay bhi khol dete hain. */
  .sa-root .ch-slip-ov,.sa-root .ch-slip-wrap{
    position:static !important;overflow:visible !important;background:none !important;
    backdrop-filter:none !important;padding:0 !important;box-shadow:none !important;
    max-width:none !important;animation:none !important}
  /* chhapte waqt scroll ka koi matlab nahi — poori table dikhni chahiye */
  .sa-root .tbl-wrap{overflow:visible !important}
}

/* TABLE */
/* overflow-x:auto akela likha jaye to CSS doosre axis ko bhi khud 'auto' kar
   deta hai — phir jab horizontal bar aata hai to andar ki height ghat jati hai
   aur uske saath ek be-matlab VERTICAL bar bhi aa jata hai (aur data badalte hi
   aata-jata rehta hai). Page khud scroll karta hai, is liye yahan vertical
   scroll chahiye hi nahi — overflow-y saaf hidden. Jis table ko sach me apni
   height chahiye (QuizContent ka picker) wo inline maxHeight + overflowY deta
   hai, jo is rule ko override kar deta hai. */
.sa-root .tbl-wrap{overflow-x:auto;overflow-y:hidden}
.sa-root .mentor-table{width:100%;border-collapse:collapse;min-width:1100px}
.sa-root .mentor-table thead tr{background:linear-gradient(135deg,#1E3A8A,#1E40AF)}
.sa-root .mentor-table th{padding:12px 12px;text-align:left;font-size:10.5px;font-weight:800;color:#fff;letter-spacing:.5px;text-transform:uppercase;white-space:nowrap}
.sa-root .mentor-table td{padding:11px 12px;border-bottom:1px solid var(--bl);font-size:13px;color:var(--t2);vertical-align:middle}
.sa-root .mentor-table tbody tr:hover td{background:rgba(30,58,138,.03)}
.sa-root .mentor-table tbody tr:last-child td{border-bottom:none}
.sa-root .td-bold{font-weight:700;color:var(--t1)}
.sa-root .td-center{text-align:center;color:var(--tm);font-weight:700;font-size:12px}
.sa-root .td-ref{font-size:11.5px;color:var(--tm)}
.sa-root .td-empty{text-align:center;padding:40px;color:var(--tm)}
.sa-root .td-empty i{font-size:24px;display:block;margin-bottom:8px}

/* PROGRESS */
.sa-root .progress{height:7px;background:var(--muted);border-radius:var(--r-f);overflow:hidden;margin-top:5px;min-width:80px}
.sa-root .progress span{display:block;height:100%;border-radius:var(--r-f);background:linear-gradient(90deg,#1E3A8A,#2563EB)}
.sa-root .prog-wrap{display:flex;flex-direction:column;gap:2px}
.sa-root .prog-label{font-size:10.5px;color:var(--tm);font-weight:600}

/* BADGES */
.sa-root .badge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:var(--r-f);font-size:10.5px;font-weight:700;letter-spacing:.3px;white-space:nowrap}
.sa-root .badge i{font-size:9px}
.sa-root .b-green{background:rgba(22,163,74,.1);color:#16A34A;border:1px solid rgba(22,163,74,.25)}
.sa-root .b-gray{background:rgba(100,116,139,.1);color:#64748B;border:1px solid rgba(100,116,139,.2)}
.sa-root .b-warn{background:rgba(217,119,6,.1);color:#D97706;border:1px solid rgba(217,119,6,.25)}
.sa-root .b-blue{background:var(--brand-light);color:var(--brand);border:1px solid var(--bm)}
.sa-root .b-red{background:rgba(220,38,38,.1);color:#DC2626;border:1px solid rgba(220,38,38,.25)}
.sa-root .b-purple{background:rgba(124,58,237,.1);color:#7C3AED;border:1px solid rgba(124,58,237,.25)}

/* ACTION MENU */
.sa-root .action-wrap{position:relative}
.sa-root .action-trigger{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 10px;border-radius:var(--r-md);border:1.5px solid var(--bl);background:var(--card);color:var(--t2);font-size:11.5px;font-weight:700;transition:var(--tr)}
.sa-root .action-trigger:hover{border-color:var(--brand);color:var(--brand)}
.sa-root .action-menu{display:none;position:absolute;right:0;top:36px;background:var(--card);border:1.5px solid var(--bl);box-shadow:var(--s-lg);border-radius:var(--r-lg);min-width:200px;z-index:50;padding:6px;overflow:hidden}
.sa-root .action-menu.open{display:block}
.sa-root .action-menu button{display:flex;align-items:center;gap:7px;width:100%;text-align:left;background:transparent;border:none;padding:9px 12px;border-radius:var(--r-md);font-size:12.5px;font-weight:600;color:var(--t2);cursor:pointer;transition:var(--tr)}
.sa-root .action-menu button i{color:var(--tm)}
.sa-root .action-menu button:hover{background:var(--muted);color:var(--brand)}
.sa-root .action-menu button.danger:hover{background:rgba(220,38,38,.06);color:var(--err)}

/* PAY ACTIONS */
.sa-root .pay-actions{display:flex;gap:6px;flex-wrap:wrap}

/* MODAL */
.sa-root .ov{position:fixed;inset:0;background:rgba(8,13,26,.55);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px;z-index:1000}
.sa-root .modal{background:var(--card);border-radius:var(--r-xl);width:100%;max-width:640px;max-height:92vh;overflow-y:auto;box-shadow:var(--s-xl);border:1px solid var(--bl);animation:saMIn .28s cubic-bezier(.34,1.26,.64,1) both}
.sa-root .modal.lg{max-width:820px}
@keyframes saMIn{from{opacity:0;transform:translateY(20px) scale(.97)}to{opacity:1;transform:none}}
.sa-root .modal-head{display:flex;align-items:flex-start;justify-content:space-between;padding:20px 22px;border-bottom:1px solid var(--bl);position:sticky;top:0;background:var(--card);z-index:2;border-radius:var(--r-xl) var(--r-xl) 0 0}
.sa-root .modal-title{font-size:16px;font-weight:800;color:var(--t1);display:flex;align-items:center;gap:9px}
.sa-root .modal-title i{color:var(--brand)}
.sa-root .modal-sub{font-size:12px;color:var(--tm);margin-top:3px}
.sa-root .modal-close{width:32px;height:32px;border-radius:8px;border:1.5px solid var(--bl);background:var(--card);color:var(--tm);display:flex;align-items:center;justify-content:center;font-size:13px;transition:var(--tr)}
.sa-root .modal-close:hover{border-color:var(--err);color:var(--err)}
.sa-root .modal-body{padding:22px}
.sa-root .modal-foot{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:16px 22px;border-top:1px solid var(--bl);position:sticky;bottom:0;background:var(--card)}
.sa-root .modal-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.sa-root .modal-grid .span2{grid-column:span 2}

/* USAGE CARDS */
.sa-root .usage-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.sa-root .usage-card{border:1.5px solid var(--bl);border-radius:var(--r-lg);padding:16px;background:var(--muted)}
.sa-root .usage-title{font-size:13px;font-weight:800;color:var(--t1);margin-bottom:10px;display:flex;align-items:center;gap:6px}
.sa-root .usage-title i{color:var(--brand)}
.sa-root .usage-stats{display:flex;justify-content:space-between;font-size:12.5px;color:var(--tm);margin-bottom:8px;font-weight:600}
.sa-root .usage-stats b{color:var(--t1)}

/* REPORT POPUP OPTIONS */
.sa-root .report-popup-options{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}
.sa-root .report-option{border:1.5px solid var(--bl);background:var(--muted);border-radius:var(--r-lg);padding:18px;text-align:center;cursor:pointer;transition:var(--tr)}
.sa-root .report-option:hover{border-color:var(--brand);background:rgba(30,58,138,.04);transform:translateY(-2px);box-shadow:var(--s-sm)}
.sa-root .report-option-icon{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;margin:0 auto 10px}
.sa-root .report-option-name{font-size:13.5px;font-weight:800;color:var(--t1)}
.sa-root .report-option-desc{font-size:11.5px;color:var(--tm);margin-top:4px;line-height:1.5}

/* FILE INPUT */
.sa-root .f-file{width:100%;border:1.5px dashed var(--bm);border-radius:var(--r-md);padding:10px 13px;font-size:13px;color:var(--t1);background:var(--muted);outline:none;cursor:pointer;transition:var(--tr)}
.sa-root .f-file:hover{border-color:var(--brand)}
.sa-root .proof-preview{margin-top:10px;border:1.5px solid var(--bl);border-radius:var(--r-lg);overflow:hidden;background:var(--muted)}
.sa-root .proof-preview-hd{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--bl);background:var(--card)}
.sa-root .proof-preview-nm{font-size:11.5px;font-weight:700;color:var(--t2);display:flex;align-items:center;gap:6px}
.sa-root .proof-preview-nm i{color:var(--brand)}
.sa-root .proof-preview-x{width:24px;height:24px;border-radius:6px;border:1.5px solid rgba(220,38,38,.25);background:rgba(220,38,38,.06);color:var(--err);display:flex;align-items:center;justify-content:center;font-size:11px}

/* PROOF VIEW GRID */
.sa-root .proof-month{border:1.5px solid var(--bl);border-radius:var(--r-lg);overflow:hidden;background:var(--card)}
.sa-root .proof-month-hd{background:linear-gradient(135deg,#1E3A8A,#1E40AF);padding:10px 14px;display:flex;align-items:center;justify-content:space-between}
.sa-root .proof-month-img{padding:12px;text-align:center;min-height:160px;display:flex;align-items:center;justify-content:center;background:var(--muted)}
.sa-root .proof-month-img img{max-width:100%;max-height:220px;border-radius:var(--r-md);object-fit:contain;border:1px solid var(--bl)}
.sa-root .proof-month-rows{padding:10px 14px;border-top:1px solid var(--bl)}

/* TOAST */
.sa-root .toast-wrap{position:fixed;top:20px;right:20px;z-index:2000;display:flex;flex-direction:column;gap:10px}
.sa-root .toast{display:flex;align-items:center;gap:10px;padding:12px 18px;border-radius:var(--r-md);background:var(--card);box-shadow:var(--s-lg);border:1px solid var(--bl);font-size:13px;font-weight:600;color:var(--t1);animation:saTIn .3s ease both;min-width:240px}
@keyframes saTIn{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:none}}
.sa-root .toast i{font-size:15px}
.sa-root .toast.success i{color:var(--success)}.sa-root .toast.info i{color:var(--info)}.sa-root .toast.warn i{color:var(--warn)}.sa-root .toast.error i{color:var(--err)}

/* MOBILE PAYMENT CARDS */
.sa-root .mobile-payment-cards{display:none}

@media(max-width:1280px){
  .sa-root .stat-grid-6{grid-template-columns:repeat(3,1fr)}
}
@media(max-width:1024px){
  .sa-root .sidebar{position:fixed;left:0;top:0;transform:translateX(-100%);transition:transform .3s}
  .sa-root .sidebar.open{transform:none}
  .sa-root .hamburger{display:flex}
  .sa-root .stat-grid,.sa-root .stat-grid-6{grid-template-columns:repeat(2,1fr)}
  .sa-root .modal-grid{grid-template-columns:1fr}
  .sa-root .modal-grid .span2{grid-column:span 1}
  .sa-root .usage-grid{grid-template-columns:1fr}
  .sa-root .mentor-table{min-width:900px}
}
@media(max-width:760px){
  .sa-root .report-popup-options{grid-template-columns:1fr}
  .sa-root .payments-table-wrap{display:none}
  .sa-root .mobile-payment-cards{display:flex;flex-direction:column;gap:12px;padding:0 20px 20px}
  .sa-root .payment-mobile-card{background:var(--card);border:1.5px solid var(--bl);border-radius:var(--r-lg);padding:16px;box-shadow:var(--s-xs)}
  .sa-root .payment-mobile-card h3{margin:0 0 6px;font-size:15px;font-weight:800;color:var(--t1)}
  .sa-root .payment-mobile-card p{margin:4px 0;color:var(--tm);font-size:12.5px;font-weight:600}
  .sa-root .payment-mobile-card .pay-actions{margin-top:12px}
  .sa-root .filter-bar{flex-direction:column;align-items:stretch}
  .sa-root .f-field,.sa-root .f-field-grow{min-width:unset;width:100%}
}

/* Support module embed — the agent console is normally position:fixed
   (full-screen at #agent). Inside the Super Admin shell we neutralise
   that so it flows within the page content under the header + tabs. */
.sa-root .sa-support-embed{min-height:560px;display:flex;flex-direction:column}
.sa-root .sa-support-embed .ag-root{position:static;inset:auto;z-index:auto;flex:1;min-height:560px;border:1px solid var(--bl);border-radius:var(--r-xl);overflow:hidden}
/* Agent Inbox ki bulandi bandhi honi chahiye, warna uske andar ka apna scroll
   chalta hi nahi. Standalone console position:fixed hone ki wajah se screen
   jitna bulanda hota hai; yahan position:static kar dene se koi had nahi
   rehti, is liye conversation lambi hoti chali jati thi — message area ka
   overflow-y kabhi kaam hi nahi aata tha aur reply box tak pahunchne ke liye
   poora page neeche karna parta tha.

   Tareeqa: page ke content area ko flex column bana kar embed ko baqi bachi
   hui SAARI bulandi de dete hain (koi magic number nahi). Us se console utna
   hi bulanda hota hai jitni jagah header + tabs ke neeche bachti hai, teenon
   columns barabar rehte hain, aur har ek apna vertical scroll dikhata hai:
   conversation (.ag-msgs), inbox list (.ag-inbox-list), sidebar (.ag-side).

   :has() na chalne wali soorat me neeche wali max-height fallback ka kaam
   deti hai. Ye had poori row par hai, sirf chat par nahi — pehle sirf chat par
   thi to teenon columns ki bulandi alag alag ho jati thi (chat chhota, side
   panels apne content jitne lambe). Aur saada height shell par chalta nahi:
   wo column-flex ka item hai jispar flex:1 hai, aur flex-basis height ko
   override kar deta hai; max-height flex resolve hone ke BAAD lagti hai.
   Sirf Inbox par asar; Overview (.ov-root) pehle ki tarah page ke sath. */
.sa-root .page-content:has(.sa-support-embed){display:flex;flex-direction:column}
.sa-root .sa-support-embed{flex:1;min-height:460px}
.sa-root .sa-support-embed .ag-root{min-height:0}
.sa-root .sa-support-embed .ag-shell{max-height:calc(100vh - 170px);min-height:0}

/* ══════════ E-TUBE MODULE ══════════ */
.sa-root .et-ph{display:flex;align-items:flex-start;gap:16px;margin-bottom:22px}
.sa-root .et-ph-icon{width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#1E3A8A,#2563EB);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 14px rgba(30,58,138,.3)}
.sa-root .et-tabs{display:flex;gap:4px;background:var(--card);border:1.5px solid var(--bl);border-radius:var(--r-lg);padding:5px;margin-bottom:20px;box-shadow:var(--s-sm);overflow-x:auto}
.sa-root .et-tab{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:11px 14px;border-radius:var(--r-md);border:none;background:transparent;font-family:var(--font);font-size:12.5px;font-weight:600;color:var(--tm);cursor:pointer;transition:var(--tr);white-space:nowrap;flex-shrink:0}
.sa-root .et-tab:hover:not(.active){background:var(--muted);color:var(--t1)}
.sa-root .et-tab.active{background:linear-gradient(135deg,#1E3A8A,#1E40AF,#2563EB);color:#fff;box-shadow:0 4px 16px rgba(30,58,138,.35)}
.sa-root .et-tab-badge{background:rgba(30,58,138,.15);color:var(--brand);border-radius:999px;padding:1px 7px;font-size:9.5px;font-weight:800;margin-left:2px}
.sa-root .et-tab.active .et-tab-badge{background:rgba(255,255,255,.25);color:#fff}
.sa-root .et-panel{animation:saEtFd .22s ease both}
@keyframes saEtFd{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.sa-root .et-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
.sa-root .et-stat{background:var(--card);border:1px solid var(--bl);border-radius:var(--r-lg);padding:14px 16px;display:flex;align-items:center;gap:12px;box-shadow:var(--s-xs);transition:var(--tr)}
.sa-root .et-stat:hover{box-shadow:var(--s-sm);transform:translateY(-1px)}
.sa-root .et-si{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.sa-root .et-sv{font-size:22px;font-weight:800;color:var(--t1);line-height:1}
.sa-root .et-sl{font-size:11px;color:var(--tm);margin-top:2px;font-weight:500}
.sa-root .et-card{background:var(--card);border-radius:var(--r-lg);border:1px solid var(--bl);box-shadow:var(--s-sm);margin-bottom:16px}
.sa-root .et-ch{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--bl);background:linear-gradient(135deg,rgba(30,58,138,.03),transparent);flex-wrap:wrap;gap:8px}
.sa-root .et-chl{display:flex;align-items:center;gap:10px}
.sa-root .et-ci{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
.sa-root .et-ct{font-size:14px;font-weight:800;color:var(--t1)}
.sa-root .et-cs{font-size:11px;color:var(--tm);margin-top:1px}
.sa-root .et-ml{display:flex;flex-direction:column}
.sa-root .et-mr{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--bl);transition:var(--tr)}
.sa-root .et-mr:last-child{border-bottom:none}
.sa-root .et-mr:hover{background:rgba(30,58,138,.02)}
.sa-root .et-mt{width:50px;height:32px;border-radius:7px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#DBEAFE,#BFDBFE);position:relative;overflow:hidden}
.sa-root .et-mp{position:absolute;width:16px;height:16px;border-radius:50%;background:rgba(30,58,138,.8);color:#fff;display:flex;align-items:center;justify-content:center;font-size:6px}
.sa-root .et-mb{flex:1;min-width:0}
.sa-root .et-mtitle{font-size:12.5px;font-weight:700;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sa-root .et-mmeta{font-size:10.5px;color:var(--tm);margin-top:1px}
.sa-root .et-toolbar{display:flex;align-items:center;gap:10px;padding:14px 20px;border-bottom:1px solid var(--bl);flex-wrap:wrap}
.sa-root .et-srch{display:flex;align-items:center;gap:7px;flex:1;min-width:180px;border:1.5px solid var(--bl);border-radius:var(--r-md);padding:0 11px;background:var(--inp);height:38px;transition:var(--tr)}
.sa-root .et-srch:focus-within{border-color:var(--brand);box-shadow:0 0 0 3px rgba(30,58,138,.08)}
.sa-root .et-srch i{color:var(--tm);font-size:12px;flex-shrink:0}
.sa-root .et-srch input{border:none;outline:none;background:transparent;font-family:var(--font);font-size:13px;color:var(--t1);width:100%}
.sa-root .et-sel{height:38px;border:1.5px solid var(--bl);border-radius:var(--r-md);padding:0 10px;font-family:var(--font);font-size:12px;font-weight:600;color:var(--t2);background:var(--inp);outline:none;cursor:pointer;transition:var(--tr)}
.sa-root .et-sel:focus{border-color:var(--brand)}
.sa-root .et-vth{display:grid;grid-template-columns:80px 2fr 1fr 1fr 80px 110px;background:var(--muted);border-bottom:1px solid var(--bl);padding:0 14px}
.sa-root .et-th{padding:9px 7px;font-size:9.5px;font-weight:700;color:var(--tm);letter-spacing:.5px;text-transform:uppercase}
.sa-root .et-vr{display:grid;grid-template-columns:80px 2fr 1fr 1fr 80px 110px;padding:10px 14px;align-items:center;transition:var(--tr);border-bottom:1px solid var(--bl)}
.sa-root .et-vr:last-child{border-bottom:none}
.sa-root .et-vr:hover{background:rgba(30,58,138,.03)}
.sa-root .et-td{padding:5px 7px;font-size:12px;color:var(--t2);display:flex;align-items:center;gap:5px;min-width:0}
.sa-root .et-vth2{width:68px;height:42px;border-radius:7px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#DBEAFE,#BFDBFE);position:relative;overflow:hidden}
.sa-root .et-vp{position:absolute;width:18px;height:18px;border-radius:50%;background:rgba(30,58,138,.8);color:#fff;display:flex;align-items:center;justify-content:center;font-size:7px}
.sa-root .et-vtt{font-size:12.5px;font-weight:700;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sa-root .et-vtd{font-size:10.5px;color:var(--tm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
.sa-root .et-va{display:flex;gap:4px;justify-content:flex-end}
.sa-root .et-ab{width:28px;height:28px;border-radius:7px;border:1.5px solid var(--bl);background:var(--card);color:var(--tm);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:10px;transition:var(--tr)}
.sa-root .et-ab:hover{border-color:var(--brand);color:var(--brand);background:var(--brand-light)}
.sa-root .et-ab.d:hover{border-color:var(--err);color:var(--err);background:rgba(220,38,38,.06)}
.sa-root .et-sb{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:var(--r-f);font-size:10px;font-weight:700;white-space:nowrap}
.sa-root .et-live{background:rgba(22,163,74,.1);color:#16A34A;border:1px solid rgba(22,163,74,.25)}
.sa-root .et-proc{background:rgba(2,132,199,.1);color:#0284C7;border:1px solid rgba(2,132,199,.25)}
.sa-root .et-draft{background:rgba(100,116,139,.1);color:#64748B;border:1px solid rgba(100,116,139,.25)}
.sa-root .et-cb{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:var(--r-f);font-size:10px;font-weight:700;background:rgba(2,132,199,.08);color:#0284C7;border:1px solid rgba(2,132,199,.2)}
.sa-root .et-ug{display:grid;grid-template-columns:1.3fr 1fr;gap:20px;padding:20px}
.sa-root .et-dz{border:2px dashed var(--bm);border-radius:var(--r-lg);padding:26px 16px;text-align:center;cursor:pointer;transition:var(--tr);background:var(--muted)}
.sa-root .et-dz:hover{border-color:var(--brand);background:var(--brand-light)}
.sa-root .et-dz i{font-size:26px;color:var(--brand);margin-bottom:8px;display:block}
.sa-root .et-dz-t{font-size:13px;font-weight:700;color:var(--t1)}
.sa-root .et-dz-s{font-size:11px;color:var(--tm);margin-top:3px}
.sa-root .et-fg{display:flex;flex-direction:column;gap:4px;margin-bottom:13px}
.sa-root .et-fl{font-size:11.5px;font-weight:700;color:var(--t2)}
.sa-root .et-fi{height:38px;border:1.5px solid var(--bl);border-radius:var(--r-md);padding:0 11px;font-family:var(--font);font-size:13px;color:var(--t1);background:var(--inp);outline:none;transition:var(--tr)}
.sa-root .et-fi:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(30,58,138,.08)}
.sa-root .et-fta{border:1.5px solid var(--bl);border-radius:var(--r-md);padding:9px 11px;font-family:var(--font);font-size:13px;color:var(--t1);background:var(--inp);outline:none;resize:vertical;min-height:72px;transition:var(--tr);width:100%}
.sa-root .et-fta:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(30,58,138,.08)}
.sa-root .et-step-wrap{display:flex;align-items:center;margin:10px 0 14px}
.sa-root .et-step{display:flex;flex-direction:column;align-items:center;flex:1;position:relative}
.sa-root .et-dot{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;border:2px solid var(--bl);background:var(--card);color:var(--tm);z-index:2;transition:var(--tr)}
.sa-root .et-step.done .et-dot{background:linear-gradient(135deg,#16A34A,#15803D);border-color:#16A34A;color:#fff}
.sa-root .et-step.cur .et-dot{background:linear-gradient(135deg,var(--brand),var(--brand-mid));border-color:var(--brand);color:#fff;box-shadow:0 0 0 3px rgba(30,58,138,.15)}
.sa-root .et-line{position:absolute;top:13px;left:50%;width:100%;height:2px;background:var(--bl);z-index:1}
.sa-root .et-step.done .et-line{background:var(--success)}
.sa-root .et-slbl{font-size:9px;font-weight:700;color:var(--tm);margin-top:4px;text-align:center}
.sa-root .et-step.done .et-slbl,.sa-root .et-step.cur .et-slbl{color:var(--t1)}
.sa-root .et-pub-btn{width:100%;padding:12px;border-radius:var(--r-md);border:none;background:linear-gradient(135deg,#15803D,#16A34A);color:#fff;font-family:var(--font);font-size:13.5px;font-weight:800;cursor:pointer;transition:var(--tr);display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 12px rgba(22,163,74,.28);margin-top:10px}
.sa-root .et-pub-btn:hover{transform:translateY(-1px)}.sa-root .et-pub-btn:disabled{opacity:.45;cursor:not-allowed;transform:none}
.sa-root .et-up-btn{width:100%;padding:12px;border-radius:var(--r-md);border:none;background:linear-gradient(135deg,var(--brand),var(--brand-mid));color:#fff;font-family:var(--font);font-size:13.5px;font-weight:800;cursor:pointer;transition:var(--tr);display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 12px rgba(30,58,138,.28)}
.sa-root .et-up-btn:hover{transform:translateY(-1px)}.sa-root .et-up-btn:disabled{opacity:.45;cursor:not-allowed;transform:none}
.sa-root .et-hlp{display:flex;align-items:flex-start;gap:8px;padding:9px 12px;border-radius:var(--r-md);font-size:12px;color:var(--t2);background:var(--muted);border:1px solid var(--bl);line-height:1.55;margin-bottom:12px}
.sa-root .et-cg{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;padding:18px}
.sa-root .et-cc{background:var(--card);border:1px solid var(--bl);border-radius:var(--r-lg);padding:15px;box-shadow:var(--s-xs);transition:var(--tr)}
.sa-root .et-cc:hover{box-shadow:var(--s-sm);transform:translateY(-2px)}
.sa-root .et-ctx{display:flex;align-items:center;gap:10px;margin-bottom:11px}
.sa-root .et-cci{width:40px;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
.sa-root .et-ccn{font-size:13.5px;font-weight:800;color:var(--t1)}.sa-root .et-ccd{font-size:11px;color:var(--tm);margin-top:2px}
.sa-root .et-ccs{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:11px}
.sa-root .et-cst{text-align:center;background:var(--muted);border:1px solid var(--bl);border-radius:var(--r-md);padding:6px 3px}
.sa-root .et-csv{font-size:15px;font-weight:800;color:var(--t1);line-height:1}.sa-root .et-csl{font-size:8.5px;font-weight:600;color:var(--tm);margin-top:2px;text-transform:uppercase;letter-spacing:.3px}
.sa-root .et-cca{display:flex;gap:6px;margin-top:11px;padding-top:9px;border-top:1px solid var(--bl)}
.sa-root .et-cab{flex:1;height:28px;border-radius:var(--r-md);border:1.5px solid var(--bl);background:var(--muted);color:var(--tm);font-family:var(--font);font-size:11px;font-weight:600;cursor:pointer;transition:var(--tr);display:flex;align-items:center;justify-content:center;gap:5px}
.sa-root .et-cab:hover{border-color:var(--brand);color:var(--brand);background:var(--brand-light)}
.sa-root .et-cab.d:hover{border-color:var(--err);color:var(--err);background:rgba(220,38,38,.06)}
.sa-root .et-add-cc{background:var(--muted);border:2px dashed var(--bm);border-radius:var(--r-lg);padding:15px;cursor:pointer;transition:var(--tr);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;min-height:130px;text-align:center}
.sa-root .et-add-cc:hover{border-color:var(--brand);background:var(--brand-light)}
.sa-root .et-add-cc i{font-size:22px;color:var(--brand)}.sa-root .et-add-cc span{font-size:12.5px;font-weight:700;color:var(--brand)}
.sa-root .et-empty{padding:44px 20px;text-align:center}
.sa-root .et-ei{width:56px;height:56px;border-radius:18px;background:var(--muted);border:2px solid var(--bl);display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--tm);margin:0 auto 12px}
.sa-root .et-et{font-size:15px;font-weight:800;color:var(--t1);margin-bottom:5px}
.sa-root .et-es{font-size:12.5px;color:var(--tm);max-width:300px;margin:0 auto;line-height:1.55}

/* Video sub-tabs */
.sa-root .et-vid-subtabs{display:flex;gap:4px;margin-bottom:14px;background:var(--card);border:1.5px solid var(--bl);border-radius:var(--r-lg);padding:4px;box-shadow:var(--s-xs)}
.sa-root .et-vid-stab{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:10px 16px;border-radius:var(--r-md);border:none;background:transparent;font-family:var(--font);font-size:13px;font-weight:600;color:var(--tm);cursor:pointer;transition:var(--tr);white-space:nowrap}
.sa-root .et-vid-stab:hover:not(.active){background:var(--muted);color:var(--t1)}
.sa-root .et-vid-stab.active{background:linear-gradient(135deg,#1E3A8A,#1E40AF,#2563EB);color:#fff;box-shadow:0 4px 14px rgba(30,58,138,.35)}

/* Reviews — ATube style */
.sa-root .rv-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:18px}
.sa-root .rv-stat{background:var(--card);border:1px solid var(--bl);border-radius:var(--r-lg);padding:18px 22px;display:flex;align-items:center;gap:16px;box-shadow:var(--s-xs);transition:var(--tr)}
.sa-root .rv-stat:hover{box-shadow:var(--s-sm);transform:translateY(-1px)}
.sa-root .rv-stat-icon{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.sa-root .rv-stat-val{font-size:28px;font-weight:800;color:var(--t1);line-height:1;letter-spacing:-.02em}
.sa-root .rv-stat-lbl{font-size:12px;color:var(--tm);margin-top:3px;font-weight:500}
.sa-root .rv-list{display:flex;flex-direction:column}
.sa-root .rv-item{display:flex;align-items:center;gap:14px;padding:14px 20px;border-bottom:1px solid var(--bl);transition:var(--tr)}
.sa-root .rv-item:last-child{border-bottom:none}
.sa-root .rv-item:hover{background:rgba(30,58,138,.025)}
.sa-root .rv-thumb{width:90px;height:56px;border-radius:10px;flex-shrink:0;overflow:hidden;position:relative;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#DBEAFE,#BFDBFE)}
.sa-root .rv-play{position:absolute;width:24px;height:24px;border-radius:50%;background:rgba(30,58,138,.82);color:#fff;display:flex;align-items:center;justify-content:center;font-size:9px}
.sa-root .rv-body{flex:1;min-width:0}
.sa-root .rv-title{font-size:13.5px;font-weight:700;color:var(--t1);margin-bottom:5px}
.sa-root .rv-meta{font-size:11px;color:var(--tm);display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;margin-bottom:5px}
.sa-root .rv-meta span{display:inline-flex;align-items:center;gap:3px}
.sa-root .rv-desc{font-size:11.5px;color:var(--tm);margin-bottom:4px;display:flex;align-items:flex-start;gap:4px;font-style:italic;line-height:1.45}
.sa-root .rv-comment{font-size:12.5px;color:var(--t2);line-height:1.5;display:flex;align-items:flex-start;gap:4px}
.sa-root .rv-badge-pending{background:rgba(217,119,6,.1);color:#B45309;border:1px solid rgba(217,119,6,.3);display:inline-flex;align-items:center;gap:3px;padding:3px 9px;border-radius:9999px;font-size:10px;font-weight:700}
.sa-root .rv-badge-approved{background:rgba(22,163,74,.1);color:#15803D;border:1px solid rgba(22,163,74,.25);display:inline-flex;align-items:center;gap:3px;padding:3px 9px;border-radius:9999px;font-size:10px;font-weight:700}
.sa-root .rv-badge-rejected{background:rgba(220,38,38,.08);color:#DC2626;border:1px solid rgba(220,38,38,.22);display:inline-flex;align-items:center;gap:3px;padding:3px 9px;border-radius:9999px;font-size:10px;font-weight:700}
.sa-root .rv-school{display:inline-flex;align-items:center;gap:3px;background:rgba(30,58,138,.07);color:#1E40AF;border:1px solid rgba(30,58,138,.15);border-radius:9999px;padding:2px 9px;font-size:10.5px;font-weight:700}
.sa-root .rv-actions{display:flex;gap:7px;flex-shrink:0;align-items:center}
.sa-root .rv-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 15px;border-radius:var(--r-md);font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer;transition:var(--tr);white-space:nowrap;border:1.5px solid}
.sa-root .rv-btn-det{border-color:var(--bl);background:var(--muted);color:var(--t2)}
.sa-root .rv-btn-det:hover{border-color:var(--brand);color:var(--brand);background:var(--brand-light)}
.sa-root .rv-btn-approve{border-color:#16A34A;background:#16A34A;color:#fff}
.sa-root .rv-btn-approve:hover{background:#15803D;border-color:#15803D;box-shadow:0 2px 8px rgba(22,163,74,.35)}
.sa-root .rv-btn-reject{border-color:#DC2626;background:#DC2626;color:#fff}
.sa-root .rv-btn-reject:hover{background:#B91C1C;border-color:#B91C1C;box-shadow:0 2px 8px rgba(220,38,38,.3)}
.sa-root .rv-btn:disabled{opacity:.38;cursor:not-allowed;pointer-events:none}

@media(max-width:1100px){
  .sa-root .et-stats{grid-template-columns:repeat(2,1fr)}
  .sa-root .et-ug{grid-template-columns:1fr}
  .sa-root .rv-actions{flex-wrap:wrap;gap:5px}
  .sa-root .rv-btn{font-size:11px;padding:6px 10px}
}
@media(max-width:768px){
  .sa-root .et-tab i{display:none}
  .sa-root .et-vth,.sa-root .et-vr{display:none}
  .sa-root .et-cg{grid-template-columns:1fr}
  .sa-root .rv-stats{grid-template-columns:1fr 1fr}
  .sa-root .rv-item{flex-wrap:wrap}
  .sa-root .rv-thumb{width:70px;height:44px}
  .sa-root .rv-actions{width:100%;flex-wrap:wrap}
  .sa-root .rv-btn{flex:1;justify-content:center;font-size:11px}
}

/* ══════════ SCHOOL PERMISSIONS MODULE ══════════ */
.sa-root .sp-search-bar{display:flex;align-items:center;gap:10px;padding:16px 20px;border-bottom:1px solid var(--bl);flex-wrap:wrap}
.sa-root .sp-table{width:100%;border-collapse:collapse}
.sa-root .sp-table thead tr{background:linear-gradient(135deg,#1E3A8A,#1E40AF)}
.sa-root .sp-table th{padding:11px 14px;text-align:left;font-size:10.5px;font-weight:800;color:#fff;letter-spacing:.5px;text-transform:uppercase;white-space:nowrap;border:none}
.sa-root .sp-table td{padding:11px 14px;border-bottom:1px solid var(--bl);font-size:13px;color:var(--t2);vertical-align:middle}
.sa-root .sp-table tbody tr:hover td{background:rgba(30,58,138,.03)}
.sa-root .sp-table tbody tr:last-child td{border-bottom:none}

/* Toggle switch */
.sa-root .sw{position:relative;display:inline-flex;width:38px;height:22px;flex-shrink:0}
.sa-root .sw input{opacity:0;width:0;height:0;position:absolute}
.sa-root .sw-track{position:absolute;inset:0;border-radius:99px;background:#CBD5E1;transition:background .2s ease;cursor:pointer}
.sa-root .sw input:checked~.sw-track{background:linear-gradient(135deg,#1E3A8A,#2563EB)}
.sa-root .sw-thumb{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.22);transition:transform .2s ease;pointer-events:none}
.sa-root .sw input:checked~.sw-thumb{transform:translateX(16px)}

/* Permissions modal */
.sa-root .perm-ov{position:fixed;inset:0;background:rgba(8,13,26,.6);backdrop-filter:blur(4px);display:none;align-items:flex-start;justify-content:center;padding:14px;z-index:1100;overflow-y:auto}
.sa-root .perm-ov.open{display:flex}
.sa-root .perm-modal{background:var(--card);border-radius:var(--r-xl);width:100%;max-width:720px;box-shadow:var(--s-xl);border:1px solid var(--bl);animation:saMIn .28s cubic-bezier(.34,1.26,.64,1) both;margin:auto}
.sa-root .pm-hdr{display:flex;align-items:center;gap:14px;padding:18px 22px;border-bottom:1px solid var(--bl);background:var(--card);border-radius:var(--r-xl) var(--r-xl) 0 0;position:sticky;top:0;z-index:10}
.sa-root .pm-av{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 3px 10px rgba(30,58,138,.3)}
.sa-root .pm-school-name{font-size:15px;font-weight:800;color:var(--t1)}
.sa-root .pm-school-meta{font-size:11.5px;color:var(--tm);margin-top:3px;display:flex;gap:12px;flex-wrap:wrap}
.sa-root .pm-school-meta span{display:flex;align-items:center;gap:4px}
.sa-root .pm-close{width:32px;height:32px;border-radius:8px;border:1.5px solid var(--bl);background:var(--card);color:var(--tm);display:flex;align-items:center;justify-content:center;font-size:13px;transition:var(--tr);margin-left:auto;flex-shrink:0;cursor:pointer}
.sa-root .pm-close:hover{border-color:var(--err);color:var(--err)}
.sa-root .pm-body{padding:20px 22px;max-height:70vh;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--bl) transparent}
.sa-root .pm-body::-webkit-scrollbar{width:4px}
.sa-root .pm-body::-webkit-scrollbar-thumb{background:var(--bl);border-radius:99px}
.sa-root .pm-top-section{background:var(--muted);border:1.5px solid var(--bl);border-radius:var(--r-lg);padding:16px;margin-bottom:18px}
.sa-root .pm-top-title{font-size:11px;font-weight:800;color:var(--brand);letter-spacing:.6px;text-transform:uppercase;margin-bottom:12px;display:flex;align-items:center;gap:6px}
.sa-root .pm-top-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.sa-root .pm-top-card{background:var(--card);border:1.5px solid var(--bl);border-radius:var(--r-md);padding:14px;display:flex;flex-direction:column;gap:8px;transition:var(--tr)}
.sa-root .pm-top-card.enabled{border-color:rgba(22,163,74,.35);background:rgba(22,163,74,.04)}
.sa-root .pm-top-card-top{display:flex;align-items:center;justify-content:space-between}
.sa-root .pm-top-card-icon{width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px}
.sa-root .pm-top-card.enabled .pm-top-card-icon{background:linear-gradient(135deg,#15803d,#16a34a)}
.sa-root .pm-top-card-name{font-size:12.5px;font-weight:700;color:var(--t1);margin-top:6px}
.sa-root .pm-top-card-desc{font-size:10.5px;color:var(--tm);line-height:1.45}
.sa-root .pm-modules-title{font-size:13px;font-weight:800;color:var(--t1);display:flex;align-items:center;gap:7px;margin-bottom:10px;padding-bottom:8px;border-bottom:1.5px solid var(--bl);flex-wrap:wrap}
.sa-root .pm-modules-title i{color:var(--brand)}
.sa-root .pm-modules-title .pm-mod-badges{margin-left:auto;display:flex;gap:6px}
.sa-root .pm-section-label{font-size:9.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--tm);margin:14px 0 8px}
.sa-root .pm-mod-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:4px}
.sa-root .pm-mod-card{background:var(--muted);border:1.5px solid var(--bl);border-radius:var(--r-md);padding:11px 13px;display:flex;align-items:center;gap:10px;transition:var(--tr)}
.sa-root .pm-mod-card.enabled{border-color:rgba(30,58,138,.3);background:rgba(30,58,138,.05)}
.sa-root .pm-mod-icon{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0}
.sa-root .pm-mod-card.enabled .pm-mod-icon{background:linear-gradient(135deg,#15803d,#16a34a)}
.sa-root .pm-mod-name{font-size:12px;font-weight:700;color:var(--t1);flex:1;min-width:0;line-height:1.3}
.sa-root .pm-foot{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:16px 22px;border-top:1px solid var(--bl);position:sticky;bottom:0;background:var(--card);border-radius:0 0 var(--r-xl) var(--r-xl)}

@media(max-width:900px){
  .sa-root .pm-top-grid{grid-template-columns:1fr 1fr}
  .sa-root .pm-mod-grid{grid-template-columns:repeat(2,1fr)}
}
@media(max-width:600px){
  .sa-root .pm-top-grid{grid-template-columns:1fr}
  .sa-root .pm-mod-grid{grid-template-columns:1fr}
  .sa-root .pm-foot{flex-direction:column}
  .sa-root .pm-foot button{width:100%}
  .sa-root .sp-table td,.sa-root .sp-table th{padding:8px 10px;font-size:12px}
}

/* ══════════ SCHOOL STATUS (Schools Progress) MODULE ══════════ */
.sa-root .ss-panel{animation:saEtFd .2s ease both}
.sa-root .tab-count{background:rgba(255,255,255,.22);color:#fff;border-radius:99px;padding:1px 8px;font-size:10px;font-weight:800}
.sa-root .app-tab:not(.active) .tab-count{background:rgba(30,58,138,.12);color:var(--brand)}
.sa-root .assign-select{height:34px;border:1.5px solid var(--bl);border-radius:var(--r-md);padding:0 8px;font-family:var(--font);font-size:12px;color:var(--t2);background:var(--inp);outline:none;width:160px;cursor:pointer;transition:var(--tr)}
.sa-root .assign-select:focus{border-color:var(--brand);box-shadow:0 0 0 2px rgba(30,58,138,.08)}
.sa-root .det-btn{width:32px;height:32px;border-radius:var(--r-md);border:1.5px solid var(--bl);background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;transition:var(--tr);cursor:pointer}
.sa-root .det-btn:hover{box-shadow:0 3px 10px rgba(30,58,138,.3);transform:translateY(-1px)}
.sa-root .sub-tabs{display:flex;gap:3px;background:var(--muted);border:1.5px solid var(--bl);border-radius:var(--r-lg);padding:4px;margin-bottom:16px;width:fit-content}
.sa-root .sub-tab{padding:8px 18px;border-radius:var(--r-md);border:none;background:transparent;font-family:var(--font);font-size:12.5px;font-weight:600;color:var(--tm);cursor:pointer;transition:var(--tr);display:flex;align-items:center;gap:6px}
.sa-root .sub-tab.active{background:var(--card);color:var(--brand);box-shadow:var(--s-xs);font-weight:700}
.sa-root .sub-tab:hover:not(.active){color:var(--t1)}

/* ERP school cards */
.sa-root .erp-card{background:var(--card);border:1px solid var(--bl);border-radius:var(--r-xl);box-shadow:var(--s-xs);margin-bottom:16px;overflow:hidden;transition:var(--tr)}
.sa-root .erp-card:hover{box-shadow:var(--s-sm);transform:translateY(-1px)}
.sa-root .erp-top{display:flex;align-items:center;gap:14px;padding:16px 20px;border-bottom:1px solid var(--bl);flex-wrap:wrap}
.sa-root .erp-avatar{width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 3px 10px rgba(30,58,138,.25)}
.sa-root .erp-name{font-size:14px;font-weight:800;color:var(--t1);flex:1;min-width:160px}
.sa-root .erp-stat{text-align:center;min-width:70px}
.sa-root .erp-stat-val{font-size:22px;font-weight:800;color:var(--t1);line-height:1;letter-spacing:-.02em}
.sa-root .erp-stat-lbl{font-size:10px;color:var(--tm);margin-top:2px;font-weight:600}
.sa-root .erp-divider{width:1px;height:38px;background:var(--bl);flex-shrink:0}
.sa-root .erp-meta{display:flex;align-items:center;gap:8px;padding:10px 20px;background:linear-gradient(135deg,rgba(30,58,138,.03),transparent);border-bottom:1px solid var(--bl);flex-wrap:wrap}
.sa-root .erp-chip{display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:var(--r-f);background:var(--muted);border:1px solid var(--bl);font-size:11.5px;font-weight:600;color:var(--t2)}
.sa-root .erp-chip i{color:var(--brand);font-size:11px}
.sa-root .erp-progress{padding:14px 20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.sa-root .erp-prog-info{display:flex;align-items:center;gap:10px;min-width:200px}
.sa-root .erp-prog-icon{width:36px;height:36px;border-radius:10px;background:rgba(30,58,138,.08);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sa-root .erp-prog-icon i{color:var(--brand);font-size:15px}
.sa-root .erp-prog-lbl{font-size:10px;color:var(--tm);font-weight:600}
.sa-root .erp-prog-num{font-size:20px;font-weight:800;color:var(--t1);line-height:1}
.sa-root .prog-track{flex:1;height:7px;background:var(--muted);border-radius:var(--r-f);overflow:hidden;min-width:120px}
.sa-root .prog-fill{height:100%;border-radius:var(--r-f);background:linear-gradient(90deg,#1E3A8A,#2563EB);transition:width .4s ease}
.sa-root .erp-pct{font-size:13px;font-weight:800;color:var(--brand);min-width:38px;text-align:right}

/* Branch detail modal inner cards */
.sa-root .detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.sa-root .detail-card{background:var(--muted);border:1.5px solid var(--bl);border-radius:var(--r-lg);padding:16px}
.sa-root .detail-card-title{font-size:13px;font-weight:800;color:var(--brand);margin-bottom:12px;display:flex;align-items:center;gap:7px}
.sa-root .detail-row{display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bl)}
.sa-root .detail-row:last-child{border-bottom:none}
.sa-root .detail-label{font-size:12.5px;color:var(--tm);font-weight:500}
.sa-root .detail-val{font-size:12.5px;font-weight:700;color:var(--t1)}
.sa-root .detail-val-pill{background:var(--brand-light);color:var(--brand);border:1px solid var(--bm);border-radius:var(--r-f);padding:2px 10px;font-size:12px;font-weight:700;display:inline-block}

/* Confirm modal */
.sa-root .confirm-icon{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:26px;margin:0 auto 16px}
.sa-root .confirm-title{font-size:20px;font-weight:800;color:var(--t1);text-align:center;margin-bottom:8px}
.sa-root .confirm-sub{font-size:13.5px;color:var(--tm);text-align:center;line-height:1.6;margin-bottom:24px;max-width:340px;margin-left:auto;margin-right:auto}
.sa-root .confirm-btns{display:flex;gap:10px;justify-content:center}

/* ── ERP DETAIL MODAL ── */
.sa-root .ov-erp{position:fixed;inset:0;background:rgba(8,13,26,.6);backdrop-filter:blur(4px);display:flex;align-items:flex-start;justify-content:center;padding:14px;z-index:1000;overflow-y:auto}
.sa-root .erp-modal-wrap{background:var(--card);border-radius:var(--r-xl);width:100%;max-width:960px;box-shadow:var(--s-xl);border:1px solid var(--bl);animation:saMIn .28s cubic-bezier(.34,1.26,.64,1) both;margin:auto}
.sa-root .em-hdr{display:flex;align-items:center;gap:14px;padding:16px 22px;border-bottom:1px solid var(--bl);background:var(--card);border-radius:var(--r-xl) var(--r-xl) 0 0;position:sticky;top:0;z-index:10}
.sa-root .em-av{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 3px 10px rgba(30,58,138,.3)}
.sa-root .em-school-name{font-size:15px;font-weight:800;color:var(--t1)}
.sa-root .em-school-meta{font-size:11.5px;color:var(--tm);margin-top:3px;display:flex;gap:14px;flex-wrap:wrap}
.sa-root .em-school-meta span{display:flex;align-items:center;gap:4px}
.sa-root .em-nav{display:flex;background:var(--muted);border-bottom:1px solid var(--bl);overflow-x:auto;scrollbar-width:none}
.sa-root .em-nav::-webkit-scrollbar{display:none}
.sa-root .em-nav-btn{flex:1;min-width:130px;padding:12px 14px;border:none;background:transparent;font-family:var(--font);font-size:12.5px;font-weight:600;color:var(--tm);cursor:pointer;transition:var(--tr);display:flex;align-items:center;justify-content:center;gap:6px;border-bottom:2.5px solid transparent;white-space:nowrap}
.sa-root .em-nav-btn:hover:not(.active){color:var(--t1);background:rgba(30,58,138,.04)}
.sa-root .em-nav-btn.active{color:var(--brand);font-weight:700;border-bottom-color:var(--brand);background:var(--card)}
.sa-root .em-body{padding:20px 22px;max-height:72vh;overflow-y:auto}
.sa-root .em-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px}
.sa-root .em-info-card{background:var(--muted);border:1.5px solid var(--bl);border-radius:var(--r-lg);padding:14px 16px}
.sa-root .em-ic-title{font-size:11px;font-weight:800;color:var(--brand);letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:6px}
.sa-root .em-ic-row{display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bl)}
.sa-root .em-ic-row:last-child{border-bottom:none}
.sa-root .em-ic-label{font-size:12px;color:var(--tm)}
.sa-root .em-ic-val{font-size:12px;font-weight:700;color:var(--t1)}
.sa-root .em-pill-blue{background:var(--brand-light);color:var(--brand);border:1px solid var(--bm);border-radius:var(--r-f);padding:2px 9px;font-size:10.5px;font-weight:700;display:inline-block}
.sa-root .em-pill-green{background:rgba(22,163,74,.1);color:#15803D;border:1px solid rgba(22,163,74,.25);border-radius:var(--r-f);padding:2px 8px;font-size:10.5px;font-weight:700;display:inline-flex;align-items:center;gap:3px}
.sa-root .em-pill-red{background:rgba(220,38,38,.1);color:#DC2626;border:1px solid rgba(220,38,38,.25);border-radius:var(--r-f);padding:2px 8px;font-size:10.5px;font-weight:700;display:inline-flex;align-items:center;gap:3px}
.sa-root .em-comp-card{background:var(--muted);border:1.5px solid var(--bl);border-radius:var(--r-lg);padding:14px 16px;margin-bottom:16px}
.sa-root .em-comp-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 24px}
.sa-root .em-prog-title{font-size:13px;font-weight:800;color:var(--t1);display:flex;align-items:center;gap:7px;padding-bottom:8px;border-bottom:1.5px solid var(--bl);margin-bottom:12px}
.sa-root .em-prog-title i{color:var(--brand)}
.sa-root .em-prog-summary{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:13px}
.sa-root .em-prog-card{background:linear-gradient(135deg,rgba(30,58,138,.06),rgba(30,64,175,.03));border:1.5px solid var(--bl);border-radius:var(--r-md);padding:11px 14px;display:flex;align-items:center;gap:10px}
.sa-root .em-prog-icon{width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0}
.sa-root .em-prog-val{font-size:19px;font-weight:800;color:var(--t1);line-height:1}
.sa-root .em-prog-lbl{font-size:10px;color:var(--tm);margin-top:2px;font-weight:600}
.sa-root .em-mod-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-bottom:16px}
.sa-root .em-mod-row{background:var(--muted);border:1px solid var(--bl);border-radius:var(--r-md);padding:9px 11px;display:flex;align-items:center;gap:9px}
.sa-root .em-mod-icon{width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0}
.sa-root .em-mod-name{font-size:11.5px;font-weight:700;color:var(--t1);flex:1;min-width:0}
.sa-root .em-mod-time{font-size:10px;color:var(--tm)}
.sa-root .em-mod-count{font-size:10.5px;font-weight:700;color:var(--brand);background:var(--brand-light);border-radius:var(--r-f);padding:1px 7px;white-space:nowrap}
.sa-root .em-sub-tabs{display:flex;gap:4px;background:var(--muted);border:1.5px solid var(--bl);border-radius:var(--r-lg);padding:4px;margin-bottom:14px}
.sa-root .em-stab{flex:1;padding:8px 12px;border:none;background:transparent;font-family:var(--font);font-size:12px;font-weight:600;color:var(--tm);cursor:pointer;transition:var(--tr);border-radius:var(--r-md);display:flex;align-items:center;justify-content:center;gap:5px}
.sa-root .em-stab.active{background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;box-shadow:0 2px 8px rgba(30,58,138,.22)}
.sa-root .em-stab:hover:not(.active){color:var(--t1);background:rgba(30,58,138,.06)}
.sa-root .em-stab-cnt{background:rgba(255,255,255,.22);color:#fff;border-radius:99px;padding:1px 6px;font-size:9.5px;font-weight:800}
.sa-root .em-stab:not(.active) .em-stab-cnt{background:rgba(30,58,138,.12);color:var(--brand)}
.sa-root .em-empty{text-align:center;padding:30px 16px;color:var(--tm)}
.sa-root .em-empty i{font-size:24px;display:block;margin:0 auto 8px;opacity:.3}
.sa-root .em-empty-t{font-size:13px;font-weight:600}

/* Follow-up cards */
.sa-root .fu-section-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:14px;border-bottom:1.5px solid var(--bl);gap:12px;flex-wrap:wrap}
.sa-root .fu-section-info{display:flex;align-items:center;gap:12px}
.sa-root .fu-section-icon{width:38px;height:38px;border-radius:10px;color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;box-shadow:0 3px 10px rgba(30,58,138,.22)}
.sa-root .fu-section-title{font-size:14px;font-weight:800;color:var(--t1)}
.sa-root .fu-section-sub{font-size:11.5px;color:var(--tm);margin-top:2px}
.sa-root .fu-add-btn{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 16px;border-radius:var(--r-md);border:none;background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;font-family:var(--font);font-size:12.5px;font-weight:700;box-shadow:0 3px 10px rgba(30,58,138,.25);transition:var(--tr);cursor:pointer;white-space:nowrap}
.sa-root .fu-add-btn:hover{transform:translateY(-1px);box-shadow:0 5px 16px rgba(30,58,138,.35)}
.sa-root .fu-list{display:flex;flex-direction:column;gap:10px}
.sa-root .fu-card{background:var(--card);border:1.5px solid var(--bl);border-radius:var(--r-lg);overflow:hidden;transition:var(--tr);box-shadow:var(--s-xs)}
.sa-root .fu-card:hover{box-shadow:var(--s-sm);border-color:var(--bm)}
.sa-root .fu-card-top{display:flex;align-items:flex-start;gap:12px;padding:13px 14px 10px}
.sa-root .fu-card-avatar{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;flex-shrink:0;font-weight:800}
.sa-root .fu-card-avatar.note{background:linear-gradient(135deg,#1E3A8A,#1E40AF)}
.sa-root .fu-card-avatar.call{background:linear-gradient(135deg,#15803D,#16A34A)}
.sa-root .fu-card-avatar.message{background:linear-gradient(135deg,#0369A1,#0284C7)}
.sa-root .fu-card-body{flex:1;min-width:0}
.sa-root .fu-card-text{font-size:13px;color:var(--t1);line-height:1.6;font-weight:500;margin-bottom:8px;word-break:break-word}
.sa-root .fu-card-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.sa-root .fu-meta-date{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--tm);font-weight:600;background:var(--muted);border:1px solid var(--bl);border-radius:var(--r-f);padding:2px 9px}
.sa-root .fu-meta-date i{color:var(--brand);font-size:9px}
.sa-root .fu-meta-user{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--brand);font-weight:700;background:var(--brand-light);border:1px solid var(--bm);border-radius:var(--r-f);padding:2px 9px}
.sa-root .fu-meta-user i{font-size:9px}
.sa-root .fu-card-actions{display:flex;gap:5px;flex-shrink:0;margin-left:auto;padding-top:1px}
.sa-root .fu-act-btn{width:28px;height:28px;border-radius:7px;border:1.5px solid var(--bl);background:var(--muted);color:var(--tm);display:flex;align-items:center;justify-content:center;font-size:10px;transition:var(--tr);cursor:pointer}
.sa-root .fu-act-btn.edit:hover{border-color:var(--brand);color:var(--brand);background:var(--brand-light)}
.sa-root .fu-act-btn.del:hover{border-color:var(--err);color:var(--err);background:rgba(220,38,38,.06)}
.sa-root .fu-card-strip{height:3px;background:linear-gradient(90deg,#1E3A8A,#1E40AF)}
.sa-root .fu-card-strip.call{background:linear-gradient(90deg,#15803D,#16A34A)}
.sa-root .fu-card-strip.message{background:linear-gradient(90deg,#0369A1,#0284C7)}
.sa-root .fu-empty{text-align:center;padding:40px 20px;background:var(--muted);border:1.5px dashed var(--bl);border-radius:var(--r-lg)}
.sa-root .fu-empty-icon{width:52px;height:52px;border-radius:14px;background:var(--card);border:1.5px solid var(--bl);display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--tm);margin:0 auto 12px;opacity:.6}
.sa-root .fu-empty-title{font-size:13.5px;font-weight:700;color:var(--t1);margin-bottom:4px}
.sa-root .fu-empty-sub{font-size:12px;color:var(--tm);line-height:1.5}

/* Onboarding cards */
.sa-root .em-ob-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
.sa-root .em-ob-sum{background:var(--muted);border:1.5px solid var(--bl);border-radius:var(--r-md);padding:11px 13px;text-align:center}
.sa-root .em-ob-val{font-size:20px;font-weight:800;color:var(--t1);line-height:1}
.sa-root .em-ob-lbl{font-size:10px;color:var(--tm);margin-top:3px;font-weight:600}
.sa-root .em-ob-bar-wrap{margin-bottom:14px}
.sa-root .em-ob-bar-hdr{display:flex;justify-content:space-between;font-size:11.5px;font-weight:700;color:var(--t2);margin-bottom:5px}
.sa-root .em-ob-bar{height:7px;background:var(--muted);border:1px solid var(--bl);border-radius:var(--r-f);overflow:hidden}
.sa-root .em-ob-bar-fill{height:100%;border-radius:var(--r-f);background:linear-gradient(90deg,#1E3A8A,#2563EB);transition:width .5s}
.sa-root .em-ob-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:11px}
.sa-root .em-ob-card{border:1.5px solid var(--bl);border-radius:var(--r-lg);overflow:hidden;transition:var(--tr)}
.sa-root .em-ob-card:hover{box-shadow:var(--s-sm)}
.sa-root .em-ob-card.done{border-color:rgba(22,163,74,.3)}
.sa-root .em-ob-head{padding:9px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--bl)}
.sa-root .em-ob-head.done{background:linear-gradient(135deg,rgba(22,163,74,.07),rgba(22,163,74,.02))}
.sa-root .em-ob-head.pend{background:linear-gradient(135deg,rgba(30,58,138,.04),transparent)}
.sa-root .em-ob-mod-name{font-size:12px;font-weight:800;color:var(--t1);display:flex;align-items:center;gap:6px}
.sa-root .em-ob-mod-icon{width:26px;height:26px;border-radius:7px;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0}
.sa-root .em-ob-status-done{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:var(--r-f);font-size:9.5px;font-weight:700;background:rgba(22,163,74,.1);color:#15803D;border:1px solid rgba(22,163,74,.25)}
.sa-root .em-ob-status-pend{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:var(--r-f);font-size:9.5px;font-weight:700;background:rgba(217,119,6,.1);color:#B45309;border:1px solid rgba(217,119,6,.25)}
.sa-root .em-ob-body{padding:9px 12px}
.sa-root .em-ob-flbl{font-size:9.5px;font-weight:700;color:var(--tm);text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px}
.sa-root .em-ob-ta{width:100%;border:1.5px solid var(--bl);border-radius:var(--r-sm);padding:5px 8px;font-family:var(--font);font-size:11.5px;color:var(--t1);background:var(--inp);outline:none;resize:none;transition:var(--tr);margin-bottom:6px}
.sa-root .em-ob-ta:focus{border-color:var(--brand);box-shadow:0 0 0 2px rgba(30,58,138,.08)}
.sa-root .em-ob-ta.done{background:var(--muted);color:var(--tm)}
.sa-root .em-ob-date{width:100%;border:1.5px solid var(--bl);border-radius:var(--r-sm);padding:5px 8px;font-family:var(--font);font-size:11.5px;color:var(--t1);background:var(--inp);outline:none;transition:var(--tr);height:30px}
.sa-root .em-ob-date:focus{border-color:var(--brand)}
.sa-root .em-ob-foot{padding:7px 12px;border-top:1px solid var(--bl);display:flex;align-items:center;justify-content:space-between;background:rgba(30,58,138,.02)}
.sa-root .em-ob-view-btn{font-size:10.5px;font-weight:700;color:var(--brand);background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:3px}
.sa-root .em-ob-save-btn{display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 10px;border-radius:var(--r-sm);border:none;background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;font-size:10.5px;font-weight:700;cursor:pointer}
.sa-root .em-ob-hist-ov{position:fixed;inset:0;background:rgba(8,13,26,.55);backdrop-filter:blur(3px);z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px}
.sa-root .em-ob-hist-box{background:var(--card);border-radius:var(--r-xl);max-width:500px;width:100%;box-shadow:var(--s-xl);border:1px solid var(--bl);animation:saMIn .22s ease both}
.sa-root .em-ob-hist-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--bl)}
.sa-root .em-ob-hist-title{font-size:14px;font-weight:800;color:var(--t1);display:flex;align-items:center;gap:7px}
.sa-root .em-ob-hist-title i{color:var(--brand)}
.sa-root .em-ob-hist-body{padding:16px 18px;max-height:55vh;overflow-y:auto}
.sa-root .em-ob-h-item{display:flex;align-items:flex-start;gap:9px;padding:9px 0;border-bottom:1px solid var(--bl)}
.sa-root .em-ob-h-item:last-child{border-bottom:none}
.sa-root .em-ob-h-dot{width:8px;height:8px;border-radius:50%;background:var(--brand);flex-shrink:0;margin-top:4px}
.sa-root .em-ob-h-comment{font-size:12.5px;color:var(--t1);flex:1;line-height:1.5}
.sa-root .em-ob-h-date{font-size:10.5px;color:var(--tm);font-weight:600;white-space:nowrap}

/* Add follow-up popup */
.sa-root .em-add-ov{position:fixed;inset:0;background:rgba(8,13,26,.55);backdrop-filter:blur(3px);z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px}
.sa-root .em-add-box{background:var(--card);border-radius:var(--r-xl);max-width:460px;width:100%;box-shadow:var(--s-xl);border:1px solid var(--bl);animation:saMIn .22s ease both}
.sa-root .em-add-hdr{padding:14px 18px;background:linear-gradient(135deg,#1E3A8A,#1E40AF);border-radius:var(--r-xl) var(--r-xl) 0 0;display:flex;align-items:center;justify-content:space-between}
.sa-root .em-add-title{font-size:14px;font-weight:800;color:#fff;display:flex;align-items:center;gap:7px}
.sa-root .em-add-close{width:28px;height:28px;border-radius:7px;border:1.5px solid rgba(255,255,255,.3);background:rgba(255,255,255,.12);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;transition:var(--tr);cursor:pointer}
.sa-root .em-add-body{padding:16px 18px}
.sa-root .em-add-f{display:flex;flex-direction:column;gap:4px;margin-bottom:12px}
.sa-root .em-add-f label{font-size:11.5px;font-weight:700;color:var(--t2)}
.sa-root .em-add-f textarea,.sa-root .em-add-f input{width:100%;border:1.5px solid var(--bl);border-radius:var(--r-md);padding:8px 11px;font-family:var(--font);font-size:13px;color:var(--t1);background:var(--inp);outline:none;resize:vertical;transition:var(--tr)}
.sa-root .em-add-f textarea{min-height:85px}
.sa-root .em-add-f textarea:focus,.sa-root .em-add-f input:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(30,58,138,.08)}
.sa-root .em-add-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--bl)}

/* Training card */
.sa-root .em-tr-overview{background:linear-gradient(135deg,rgba(30,58,138,.06),rgba(30,64,175,.03));border:1.5px solid var(--bm);border-radius:var(--r-lg);padding:16px;margin-bottom:16px}
.sa-root .em-tr-header{display:flex;align-items:flex-start;gap:12px;margin-bottom:13px}
.sa-root .em-tr-icon{width:42px;height:42px;border-radius:11px;background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 3px 10px rgba(30,58,138,.25)}
.sa-root .em-tr-title{font-size:14px;font-weight:800;color:var(--t1)}
.sa-root .em-tr-sub{font-size:11.5px;color:var(--tm);margin-top:2px}
.sa-root .em-tr-meta{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.sa-root .em-tr-field{background:var(--card);border:1.5px solid var(--bl);border-radius:var(--r-md);padding:9px 11px}
.sa-root .em-tr-fl{font-size:9.5px;font-weight:700;color:var(--tm);text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px}
.sa-root .em-tr-fv{font-size:12.5px;font-weight:700;color:var(--t1)}
.sa-root .em-tr-part{background:var(--muted);border:1.5px solid var(--bl);border-radius:var(--r-lg);padding:15px}
.sa-root .em-tr-part-title{font-size:13px;font-weight:800;color:var(--t1);display:flex;align-items:center;gap:7px;padding-bottom:9px;border-bottom:1.5px solid var(--bl);margin-bottom:13px}
.sa-root .em-tr-part-title i{color:var(--brand)}
.sa-root .em-tr-row{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-bottom:11px}
.sa-root .em-tr-fg{display:flex;flex-direction:column;gap:4px}
.sa-root .em-tr-fg label{font-size:11px;font-weight:700;color:var(--t2)}
.sa-root .em-tr-input{width:100%;height:36px;border:1.5px solid var(--bl);border-radius:var(--r-md);padding:0 11px;font-family:var(--font);font-size:12.5px;color:var(--t1);background:var(--inp);outline:none;transition:var(--tr)}
.sa-root .em-tr-input:focus{border-color:var(--brand);box-shadow:0 0 0 2px rgba(30,58,138,.08)}
.sa-root .em-tr-textarea{width:100%;border:1.5px solid var(--bl);border-radius:var(--r-md);padding:8px 11px;font-family:var(--font);font-size:12.5px;color:var(--t1);background:var(--inp);outline:none;resize:vertical;min-height:75px;transition:var(--tr);margin-bottom:11px}
.sa-root .em-tr-textarea:focus{border-color:var(--brand);box-shadow:0 0 0 2px rgba(30,58,138,.08)}
.sa-root .em-tr-save{display:flex;justify-content:flex-end}
.sa-root .em-tr-save-btn{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 18px;border-radius:var(--r-md);border:none;background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;font-size:13px;font-weight:700;box-shadow:0 3px 10px rgba(30,58,138,.22);transition:var(--tr);cursor:pointer}
.sa-root .em-tr-save-btn:hover{transform:translateY(-1px)}
.sa-root .em-tr-save-btn:disabled{opacity:.6;cursor:default;transform:none}
/* Koi training session add na hua ho (ya list load ho rahi ho) — dashed box. */
.sa-root .em-tr-empty{background:var(--card);border:1.5px dashed var(--bm);border-radius:var(--r-lg);padding:20px;margin-bottom:16px;text-align:center;font-size:12px;font-weight:600;color:var(--tm)}
/* Har session card ke edit/delete buttons — header ke daayen kinare par. */
.sa-root .em-tr-acts{display:flex;gap:6px;margin-left:auto;flex-shrink:0}
.sa-root .em-tr-act{width:28px;height:28px;border-radius:8px;border:1.5px solid var(--bl);background:var(--card);color:var(--tm);font-size:11px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:var(--tr)}
.sa-root .em-tr-act:hover{color:var(--t1);border-color:var(--bm)}
.sa-root .em-tr-act:disabled{opacity:.5;cursor:default}
.sa-root .em-tr-act.danger:hover{color:#fca5a5;border-color:rgba(220,38,38,.45);background:rgba(220,38,38,.12)}

/* ── ENQUIRIES ── */
.sa-root .enq-filter-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px}
.sa-root .enq-search-box{display:flex;align-items:center;gap:8px;background:var(--muted);border:1.5px solid var(--bl);border-radius:var(--r-f);padding:0 14px;height:38px;flex:1;min-width:180px;transition:var(--tr)}
.sa-root .enq-search-box:focus-within{border-color:var(--brand);box-shadow:0 0 0 3px rgba(30,58,138,.08)}
.sa-root .enq-search-box i{color:var(--tm);font-size:13px;flex-shrink:0}
.sa-root .enq-search-box input{border:none;background:transparent;outline:none;font-size:13px;color:var(--t1);width:100%;font-family:var(--font)}
.sa-root .enq-filter-sel{height:38px;border:1.5px solid var(--bl);border-radius:var(--r-md);padding:0 11px;font-family:var(--font);font-size:13px;font-weight:600;color:var(--t2);background:var(--inp);outline:none;cursor:pointer;transition:var(--tr)}
.sa-root .enq-filter-sel:focus{border-color:var(--brand)}
.sa-root .enq-section-card{background:var(--card);border:1px solid var(--bl);border-radius:var(--r-xl);box-shadow:var(--s-sm);overflow:hidden}
.sa-root .enq-tbl{width:100%;border-collapse:collapse;min-width:680px}
.sa-root .enq-tbl thead tr{background:linear-gradient(135deg,#1E3A8A,#1E40AF)}
.sa-root .enq-tbl th{padding:12px 14px;text-align:left;font-size:10.5px;font-weight:800;color:#fff;letter-spacing:.5px;text-transform:uppercase;white-space:nowrap}
.sa-root .enq-tbl td{padding:11px 14px;border-bottom:1px solid var(--bl);font-size:13px;color:var(--t2);vertical-align:middle}
.sa-root .enq-tbl tbody tr:hover td{background:rgba(30,58,138,.025)}
.sa-root .enq-tbl tbody tr:last-child td{border-bottom:none}
.sa-root .badge-open{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:var(--r-f);font-size:11px;font-weight:700;background:rgba(220,38,38,.1);color:#DC2626;border:1px solid rgba(220,38,38,.25);white-space:nowrap}
.sa-root .badge-resolved{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:var(--r-f);font-size:11px;font-weight:700;background:rgba(22,163,74,.1);color:#15803D;border:1px solid rgba(22,163,74,.25);white-space:nowrap}
.sa-root .badge-zero{background:rgba(100,116,139,.08)!important;color:#64748B!important;border-color:rgba(100,116,139,.2)!important}
.sa-root .enq-add-btn{display:inline-flex;align-items:center;gap:5px;height:32px;padding:0 13px;border-radius:var(--r-md);border:none;background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;font-family:var(--font);font-size:11.5px;font-weight:700;cursor:pointer;transition:var(--tr);box-shadow:0 2px 8px rgba(30,58,138,.2);white-space:nowrap}
.sa-root .enq-add-btn:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(30,58,138,.32)}
.sa-root .enq-det-btn{width:30px;height:30px;border-radius:var(--r-md);border:1.5px solid var(--bl);background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:11px;cursor:pointer;transition:var(--tr)}
.sa-root .enq-det-btn:hover{box-shadow:0 2px 8px rgba(30,58,138,.3);transform:translateY(-1px)}
.sa-root .enq-ov{position:fixed;inset:0;background:rgba(8,13,26,.58);backdrop-filter:blur(4px);display:flex;align-items:flex-start;justify-content:center;padding:16px;z-index:1100;overflow-y:auto}
.sa-root .enq-modal{background:var(--card);border-radius:var(--r-xl);width:100%;max-width:820px;box-shadow:var(--s-xl);border:1px solid var(--bl);animation:saMIn .26s cubic-bezier(.34,1.26,.64,1) both;margin:auto}
.sa-root .enq-modal-hdr{padding:18px 22px;background:linear-gradient(135deg,#1E3A8A,#1E40AF);border-radius:var(--r-xl) var(--r-xl) 0 0;display:flex;align-items:center;gap:14px;position:sticky;top:0;z-index:5}
.sa-root .enq-modal-av{width:42px;height:42px;border-radius:12px;background:rgba(255,255,255,.18);color:#fff;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sa-root .enq-modal-school-name{font-size:15px;font-weight:800;color:#fff}
.sa-root .enq-modal-sub{font-size:11.5px;color:rgba(255,255,255,.72);margin-top:2px}
.sa-root .enq-modal-close{width:32px;height:32px;border-radius:8px;border:1.5px solid rgba(255,255,255,.3);background:rgba(255,255,255,.12);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;cursor:pointer;transition:var(--tr);flex-shrink:0}
.sa-root .enq-modal-close:hover{background:rgba(255,255,255,.25)}
.sa-root .enq-modal-body{padding:20px 22px;max-height:76vh;overflow-y:auto}
.sa-root .enq-summary{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px}
.sa-root .enq-sum-card{border-radius:var(--r-lg);padding:15px 18px;display:flex;align-items:center;gap:13px}
.sa-root .enq-sum-card.open-card{background:rgba(220,38,38,.05);border:1.5px solid rgba(220,38,38,.22)}
.sa-root .enq-sum-card.res-card{background:rgba(22,163,74,.05);border:1.5px solid rgba(22,163,74,.22)}
.sa-root .enq-sum-icon{width:40px;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:17px;color:#fff;flex-shrink:0}
.sa-root .enq-sum-icon.open-card{background:linear-gradient(135deg,#b91c1c,#dc2626)}
.sa-root .enq-sum-icon.res-card{background:linear-gradient(135deg,#15803d,#16a34a)}
.sa-root .enq-sum-val{font-size:28px;font-weight:800;line-height:1}
.sa-root .enq-sum-val.open-card{color:#DC2626}
.sa-root .enq-sum-val.res-card{color:#15803D}
.sa-root .enq-sum-lbl{font-size:11.5px;font-weight:600;color:var(--tm);margin-top:3px}
.sa-root .enq-dtabs{display:flex;gap:3px;background:var(--muted);border:1.5px solid var(--bl);border-radius:var(--r-lg);padding:4px;margin-bottom:16px}
.sa-root .enq-dtab{flex:1;padding:8px 12px;border:none;background:transparent;font-family:var(--font);font-size:12.5px;font-weight:600;color:var(--tm);cursor:pointer;transition:var(--tr);border-radius:var(--r-md);display:flex;align-items:center;justify-content:center;gap:5px}
.sa-root .enq-dtab.active{background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;box-shadow:0 2px 8px rgba(30,58,138,.22)}
.sa-root .enq-dtab:hover:not(.active){color:var(--t1);background:rgba(30,58,138,.06)}
.sa-root .enq-dtab-cnt{background:rgba(255,255,255,.22);color:#fff;border-radius:99px;padding:1px 6px;font-size:9.5px;font-weight:800}
.sa-root .enq-dtab:not(.active) .enq-dtab-cnt{background:rgba(30,58,138,.12);color:var(--brand)}
.sa-root .enq-bug-list{display:flex;flex-direction:column;gap:10px}
.sa-root .enq-bug-card{background:var(--card);border:1.5px solid var(--bl);border-radius:var(--r-lg);overflow:hidden;transition:var(--tr)}
.sa-root .enq-bug-card:hover{border-color:var(--bm);box-shadow:var(--s-sm)}
.sa-root .enq-bug-card.is-open{border-left:3px solid #DC2626}
.sa-root .enq-bug-card.is-resolved{border-left:3px solid #16A34A}
.sa-root .enq-bug-top{display:flex;align-items:flex-start;gap:12px;padding:13px 15px}
.sa-root .enq-bug-av{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:13px;color:#fff;flex-shrink:0}
.sa-root .enq-bug-av.is-open{background:linear-gradient(135deg,#b91c1c,#dc2626)}
.sa-root .enq-bug-av.is-resolved{background:linear-gradient(135deg,#15803d,#16a34a)}
.sa-root .enq-bug-body{flex:1;min-width:0}
.sa-root .enq-bug-module{font-size:10.5px;font-weight:700;color:#7C3AED;background:rgba(124,58,237,.08);border:1px solid rgba(124,58,237,.2);border-radius:var(--r-f);padding:1px 7px;display:inline-block;margin-bottom:4px}
.sa-root .enq-bug-desc{font-size:12.5px;color:var(--tm);line-height:1.55;margin-top:4px;margin-bottom:8px}
.sa-root .enq-bug-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.sa-root .enq-bug-date{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--tm);font-weight:600;background:var(--muted);border:1px solid var(--bl);border-radius:var(--r-f);padding:2px 8px}
.sa-root .enq-bug-user{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--brand);font-weight:700;background:var(--brand-light);border:1px solid var(--bm);border-radius:var(--r-f);padding:2px 8px}
.sa-root .enq-bug-actions{display:flex;align-items:center;gap:5px;flex-shrink:0;padding-top:1px}
.sa-root .enq-iact{width:28px;height:28px;border-radius:7px;border:1.5px solid var(--bl);background:var(--muted);color:var(--tm);display:flex;align-items:center;justify-content:center;font-size:10px;cursor:pointer;transition:var(--tr)}
.sa-root .enq-iact:hover{border-color:var(--brand);color:var(--brand)}
.sa-root .enq-iact:disabled{opacity:.5;cursor:not-allowed}
.sa-root .enq-iact.del:hover{border-color:var(--err);color:var(--err);background:rgba(220,38,38,.06)}
.sa-root .enq-resolve-btn{display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 11px;border-radius:var(--r-sm);border:none;background:linear-gradient(135deg,#15803d,#16a34a);color:#fff;font-family:var(--font);font-size:10.5px;font-weight:700;cursor:pointer;transition:var(--tr)}
.sa-root .enq-resolve-btn:hover{transform:translateY(-1px);box-shadow:0 2px 8px rgba(22,163,74,.3)}
.sa-root .enq-reopen-btn{display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 11px;border-radius:var(--r-sm);border:1.5px solid rgba(220,38,38,.3);background:rgba(220,38,38,.06);color:#DC2626;font-family:var(--font);font-size:10.5px;font-weight:700;cursor:pointer;transition:var(--tr)}
.sa-root .enq-reopen-btn:hover{background:rgba(220,38,38,.12)}
.sa-root .enq-add-ov{position:fixed;inset:0;background:rgba(8,13,26,.55);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:16px;z-index:2100}
.sa-root .enq-add-box{background:var(--card);border-radius:var(--r-xl);max-width:500px;width:100%;box-shadow:var(--s-xl);border:1px solid var(--bl);animation:saMIn .22s ease both}
.sa-root .enq-add-hdr{padding:15px 20px;background:linear-gradient(135deg,#1E3A8A,#1E40AF);border-radius:var(--r-xl) var(--r-xl) 0 0;display:flex;align-items:center;justify-content:space-between}
.sa-root .enq-add-title{font-size:14px;font-weight:800;color:#fff;display:flex;align-items:center;gap:7px}
.sa-root .enq-add-close{width:30px;height:30px;border-radius:8px;border:1.5px solid rgba(255,255,255,.3);background:rgba(255,255,255,.12);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;cursor:pointer;transition:var(--tr)}
.sa-root .enq-add-close:hover{background:rgba(255,255,255,.22)}
.sa-root .enq-add-body{padding:18px 20px}
.sa-root .enq-f{display:flex;flex-direction:column;gap:4px;margin-bottom:13px}
.sa-root .enq-f label{font-size:11.5px;font-weight:700;color:var(--t2)}
.sa-root .enq-f input,.sa-root .enq-f select,.sa-root .enq-f textarea{width:100%;border:1.5px solid var(--bl);border-radius:var(--r-md);padding:8px 12px;font-family:var(--font);font-size:13px;color:var(--t1);background:var(--inp);outline:none;transition:var(--tr)}
.sa-root .enq-f input{height:38px;padding:0 12px}
.sa-root .enq-f textarea{min-height:85px;resize:vertical}
.sa-root .enq-f input:focus,.sa-root .enq-f select:focus,.sa-root .enq-f textarea:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(30,58,138,.08)}
.sa-root .enq-f-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sa-root .enq-add-foot{display:flex;justify-content:flex-end;gap:9px;padding:14px 20px;border-top:1px solid var(--bl)}
.sa-root .enq-empty{text-align:center;padding:40px 20px;background:var(--muted);border:1.5px dashed var(--bl);border-radius:var(--r-lg)}
.sa-root .enq-empty i{font-size:28px;opacity:.3;color:var(--tm);display:block;margin:0 auto 10px}
.sa-root .enq-empty-t{font-size:13.5px;font-weight:700;color:var(--t1);margin-bottom:4px}
.sa-root .enq-empty-s{font-size:12px;color:var(--tm)}

@media(max-width:760px){
  .sa-root .em-info-grid,.sa-root .em-comp-grid,.sa-root .em-ob-summary,.sa-root .em-ob-grid,.sa-root .em-tr-meta,.sa-root .em-tr-row{grid-template-columns:1fr}
  .sa-root .em-prog-summary,.sa-root .em-mod-grid{grid-template-columns:1fr}
  .sa-root .em-nav-btn{font-size:11px;padding:10px 8px;min-width:90px}
  .sa-root .em-body{padding:14px}
  .sa-root .detail-grid{grid-template-columns:1fr}
  .sa-root .enq-summary{grid-template-columns:1fr}
}

/* ══════════ SCHOOLS PAYMENT (Payment Status) MODULE ══════════ */
.sa-root .pay-tabs{display:grid;grid-template-columns:repeat(4,1fr);background:var(--card);border:1.5px solid var(--bl);border-radius:var(--r-lg);overflow:hidden;box-shadow:var(--s-sm);margin-bottom:20px}
.sa-root .pay-tab{padding:13px 10px;border:none;background:transparent;font-family:var(--font);font-size:13px;font-weight:600;color:var(--tm);cursor:pointer;transition:var(--tr);display:flex;align-items:center;justify-content:center;gap:7px;border-right:1px solid var(--bl)}
.sa-root .pay-tab:last-child{border-right:none}
.sa-root .pay-tab:hover:not(.active){background:var(--muted);color:var(--t1)}
.sa-root .pay-tab.active{background:linear-gradient(135deg,#1E3A8A,#1E40AF,#2563EB);color:#fff;font-weight:700}

/* Shared payment tables */
.sa-root .psetup-table,.sa-root .ch-table,.sa-root .recv-table,.sa-root .rpt-table{width:100%;border-collapse:collapse}
.sa-root .psetup-table thead tr,.sa-root .ch-table thead tr,.sa-root .recv-table thead tr,.sa-root .rpt-table thead tr{background:linear-gradient(135deg,#1E3A8A,#1E40AF)}
.sa-root .psetup-table th,.sa-root .ch-table th,.sa-root .recv-table th,.sa-root .rpt-table th{padding:12px 14px;text-align:left;font-size:10.5px;font-weight:800;color:#fff;letter-spacing:.5px;text-transform:uppercase;white-space:nowrap}
.sa-root .psetup-table td,.sa-root .ch-table td,.sa-root .recv-table td{padding:11px 14px;border-bottom:1px solid var(--bl);font-size:13px;color:var(--t2);vertical-align:middle}
.sa-root .rpt-table td{padding:10px 13px;border-bottom:1px solid var(--bl);font-size:12.5px;color:var(--t2);vertical-align:middle}
.sa-root .psetup-table tbody tr:hover td,.sa-root .ch-table tbody tr:hover td,.sa-root .recv-table tbody tr:hover td,.sa-root .rpt-table tbody tr:hover td{background:rgba(30,58,138,.03)}
.sa-root .psetup-table tbody tr:last-child td,.sa-root .ch-table tbody tr:last-child td,.sa-root .recv-table tbody tr:last-child td,.sa-root .rpt-table tbody tr:last-child td{border-bottom:none}

/* Setup expand */
.sa-root .psetup-expand-row td{padding:0;border-bottom:1px solid var(--bl)}
.sa-root .psetup-detail-box{background:var(--muted);border-top:1.5px solid var(--bl);padding:14px 20px}
.sa-root .psetup-detail-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.sa-root .psetup-detail-card{background:var(--card);border:1px solid var(--bl);border-radius:var(--r-md);padding:10px 14px;text-align:center}
.sa-root .pdc-lbl{font-size:10.5px;color:var(--tm);font-weight:600;margin-bottom:4px}
.sa-root .pdc-val{font-size:16px;font-weight:800;color:var(--t1)}
.sa-root .pdc-sub{font-size:10px;color:var(--tm);margin-top:2px}
.sa-root .ps-badge-setup{background:rgba(22,163,74,.1);color:#16A34A;border:1px solid rgba(22,163,74,.25)}
.sa-root .ps-badge-pending{background:rgba(217,119,6,.1);color:#D97706;border:1px solid rgba(217,119,6,.25)}
/* Set Up / Edit row action button */
.sa-root .ps-action-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 16px;border-radius:var(--r-f);font-family:var(--font);font-size:11.5px;font-weight:700;cursor:pointer;transition:var(--tr);border:none;white-space:nowrap}
.sa-root .ps-action-btn i{font-size:10px}
.sa-root .ps-action-btn.is-setup{background:linear-gradient(135deg,#1E3A8A,#2563EB);color:#fff;box-shadow:0 2px 8px rgba(30,58,138,.28)}
.sa-root .ps-action-btn.is-setup:hover{transform:translateY(-1px);box-shadow:0 5px 14px rgba(30,58,138,.4)}
.sa-root .ps-action-btn.is-edit{background:var(--card);color:var(--brand);border:1.5px solid var(--bm)}
.sa-root .ps-action-btn.is-edit:hover{background:var(--brand-light);border-color:var(--brand);transform:translateY(-1px)}

/* Setup modal */
.sa-root .pay-ov{position:fixed;inset:0;background:rgba(8,13,26,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;z-index:1200;overflow-y:auto}
.sa-root .pay-modal{background:var(--card);border-radius:var(--r-xl);width:100%;max-width:540px;box-shadow:var(--s-xl);border:1px solid var(--bl);animation:saMIn .28s cubic-bezier(.34,1.26,.64,1) both;margin:auto}
.sa-root .pay-modal-hdr{display:flex;align-items:center;gap:14px;padding:18px 22px;border-bottom:1px solid var(--bl);border-radius:var(--r-xl) var(--r-xl) 0 0}
.sa-root .pay-modal-av{width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 3px 10px rgba(30,58,138,.28)}
.sa-root .pay-modal-title{font-size:14px;font-weight:800;color:var(--t1)}
.sa-root .pay-modal-sub{font-size:11.5px;color:var(--tm);margin-top:3px}
.sa-root .pay-modal-body{padding:22px}
/* Setup modal ke sar par saved record ka khulasa (GET /summary se). */
.sa-root .pay-setup-summary{background:var(--muted);border:1.5px solid var(--bl);border-left:3px solid var(--brand);border-radius:var(--r-md);padding:12px 16px;margin-bottom:18px}
.sa-root .pay-modal-foot{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:16px 22px;border-top:1px solid var(--bl);border-radius:0 0 var(--r-xl) var(--r-xl)}
.sa-root .pay-formula-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px}
.sa-root .pay-formula-card{border:2px solid var(--bl);border-radius:var(--r-lg);padding:16px;cursor:pointer;transition:var(--tr);position:relative;background:var(--card)}
.sa-root .pay-formula-card:hover{border-color:var(--brand);background:var(--muted)}
.sa-root .pay-formula-card.selected{border-color:var(--brand);background:rgba(30,58,138,.06)}
.sa-root .pay-formula-card.selected::after{content:'\\2713';position:absolute;top:10px;right:12px;width:20px;height:20px;border-radius:50%;background:var(--brand);color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;line-height:20px;text-align:center}
.sa-root .pay-fc-icon{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;color:#fff;margin-bottom:10px}
.sa-root .pay-fc-title{font-size:13px;font-weight:800;color:var(--t1);margin-bottom:4px}
.sa-root .pay-fc-desc{font-size:11.5px;color:var(--tm);line-height:1.45}
.sa-root .pay-field{margin-bottom:16px}
.sa-root .pay-field label{display:block;font-size:11.5px;font-weight:700;color:var(--t2);margin-bottom:6px}
.sa-root .pay-input{width:100%;height:40px;border:1.5px solid var(--bl);border-radius:var(--r-md);padding:0 14px;font-family:var(--font);font-size:13px;color:var(--t1);background:var(--inp);outline:none;transition:var(--tr)}
.sa-root .pay-input:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(30,58,138,.09)}
.sa-root .pay-input-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sa-root .pay-toggle-row{display:flex;align-items:center;justify-content:space-between;background:var(--muted);border:1.5px solid var(--bl);border-radius:var(--r-md);padding:12px 14px;margin-bottom:16px}
.sa-root .pay-toggle-label{font-size:13px;font-weight:700;color:var(--t1)}
.sa-root .pay-toggle-sub{font-size:11px;color:var(--tm);margin-top:2px}
.sa-root .pay-info-box{background:rgba(30,58,138,.06);border:1.5px solid var(--bl);border-radius:var(--r-md);padding:12px 14px;margin-bottom:16px;display:flex;gap:10px;align-items:flex-start}
.sa-root .pay-info-box i{color:var(--brand);font-size:14px;margin-top:1px;flex-shrink:0}
.sa-root .pay-info-box p{font-size:12px;color:var(--t2);line-height:1.55;margin:0}
.sa-root .pay-formula-panel.active{display:block;animation:saEtFd .18s ease both}

/* Challans tab */
.sa-root .ch-actions{display:flex;align-items:center;gap:6px;flex-wrap:nowrap}
.sa-root .ch-btn{display:inline-flex;align-items:center;gap:5px;height:32px;padding:0 13px;border-radius:var(--r-md);font-family:var(--font);font-size:11.5px;font-weight:700;cursor:pointer;transition:var(--tr);border:none;white-space:nowrap}
.sa-root .ch-btn-gen{background:linear-gradient(135deg,#15803d,#16a34a);color:#fff;box-shadow:0 2px 8px rgba(22,163,74,.25)}
.sa-root .ch-btn-gen:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 12px rgba(22,163,74,.35)}
.sa-root .ch-btn-dl{background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;box-shadow:0 2px 8px rgba(30,58,138,.22)}
.sa-root .ch-btn-dl:hover{transform:translateY(-1px)}
.sa-root .ch-btn-del{background:linear-gradient(135deg,#b91c1c,#dc2626);color:#fff;box-shadow:0 2px 8px rgba(220,38,38,.22)}
.sa-root .ch-btn-del:hover{transform:translateY(-1px)}
.sa-root .ch-btn:disabled{background:#94a3b8;box-shadow:none;cursor:not-allowed;transform:none}

/* Generate challan modal */
.sa-root .ch-gen-ov,.sa-root .ch-bulk-ov{position:fixed;inset:0;background:rgba(8,13,26,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;z-index:1300;overflow-y:auto}
.sa-root .ch-gen-modal{background:var(--card);border-radius:var(--r-xl);width:100%;max-width:460px;box-shadow:var(--s-xl);border:1px solid var(--bl);animation:saMIn .28s cubic-bezier(.34,1.26,.64,1) both;margin:auto}
.sa-root .ch-gen-hdr{display:flex;align-items:center;gap:12px;padding:18px 22px;border-bottom:1px solid var(--bl);border-radius:var(--r-xl) var(--r-xl) 0 0;background:linear-gradient(135deg,rgba(30,58,138,.04),transparent)}
.sa-root .ch-gen-hdr-icon{width:40px;height:40px;border-radius:11px;background:linear-gradient(135deg,#15803d,#16a34a);color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;box-shadow:0 3px 10px rgba(22,163,74,.28)}
.sa-root .ch-gen-title{font-size:14px;font-weight:800;color:var(--t1)}
.sa-root .ch-gen-sub{font-size:11.5px;color:var(--tm);margin-top:2px}
.sa-root .ch-gen-body{padding:22px}
.sa-root .ch-gen-field{margin-bottom:16px}
.sa-root .ch-gen-field label{display:block;font-size:11.5px;font-weight:700;color:var(--t2);margin-bottom:6px}
.sa-root .ch-gen-input{width:100%;height:40px;border:1.5px solid var(--bl);border-radius:var(--r-md);padding:0 14px;font-family:var(--font);font-size:13px;color:var(--t1);background:var(--inp);outline:none;transition:var(--tr)}
.sa-root .ch-gen-input:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(30,58,138,.09)}
.sa-root .ch-gen-info{background:rgba(30,58,138,.05);border:1.5px solid var(--bl);border-radius:var(--r-md);padding:12px 14px;margin-bottom:16px}
.sa-root .ch-gen-info-row{display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--bl)}
.sa-root .ch-gen-info-row:last-child{border-bottom:none}
.sa-root .ch-gen-info-lbl{font-size:11.5px;color:var(--tm);font-weight:600}
.sa-root .ch-gen-info-val{font-size:12px;font-weight:700;color:var(--t1)}
.sa-root .ch-gen-amount-preview{background:linear-gradient(135deg,rgba(30,58,138,.08),rgba(30,64,175,.04));border:1.5px solid var(--bl);border-radius:var(--r-md);padding:14px 16px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between}
.sa-root .ch-gen-foot{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:16px 22px;border-top:1px solid var(--bl);border-radius:0 0 var(--r-xl) var(--r-xl)}

/* Bulk modal */
.sa-root .ch-bulk-modal{background:var(--card);border-radius:var(--r-xl);width:100%;max-width:560px;max-height:92vh;overflow-y:auto;box-shadow:var(--s-xl);border:1px solid var(--bl);animation:saMIn .28s cubic-bezier(.34,1.26,.64,1) both;margin:auto}
.sa-root .ch-bulk-hdr{display:flex;align-items:center;gap:12px;padding:18px 22px;border-bottom:1px solid var(--bl);border-radius:var(--r-xl) var(--r-xl) 0 0;background:var(--card);position:sticky;top:0;z-index:5}
.sa-root .ch-bulk-hdr-icon{width:40px;height:40px;border-radius:11px;background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;box-shadow:0 3px 10px rgba(30,58,138,.25)}
.sa-root .ch-bulk-body{padding:22px}
.sa-root .ch-branch-selector{border:1.5px solid var(--bl);border-radius:var(--r-md);background:var(--inp);min-height:44px;padding:6px 10px;cursor:text;transition:var(--tr)}
.sa-root .ch-branch-selector:focus-within{border-color:var(--brand);box-shadow:0 0 0 3px rgba(30,58,138,.09)}
.sa-root .ch-tags{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:4px}
.sa-root .ch-tag{display:inline-flex;align-items:center;gap:4px;background:var(--brand-light);color:var(--brand);border:1px solid var(--bm);border-radius:var(--r-f);padding:3px 9px;font-size:11.5px;font-weight:700}
.sa-root .ch-tag-x{cursor:pointer;font-size:13px;opacity:.7;line-height:1}
.sa-root .ch-tag-x:hover{opacity:1}
.sa-root .ch-branch-input{border:none;outline:none;background:transparent;font-family:var(--font);font-size:13px;color:var(--t1);width:100%;min-width:140px}
.sa-root .ch-dropdown{background:var(--card);border:1.5px solid var(--bl);border-radius:var(--r-md);box-shadow:var(--s-md);max-height:200px;overflow-y:auto;margin-top:4px}
.sa-root .ch-dropdown-item{padding:9px 13px;font-size:13px;color:var(--t2);cursor:pointer;display:flex;align-items:center;gap:8px;transition:var(--tr)}
.sa-root .ch-dropdown-item:hover{background:var(--muted);color:var(--t1)}
.sa-root .ch-dropdown-item.selected{background:rgba(30,58,138,.07);color:var(--brand);font-weight:600}
.sa-root .ch-dropdown-all{position:sticky;top:0;background:var(--muted);border-bottom:1.5px solid var(--bl);color:var(--brand);font-weight:800;z-index:1}
.sa-root .ch-dropdown-all:hover{background:var(--brand-light)}
.sa-root .ch-bulk-foot{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:16px 22px;border-top:1px solid var(--bl);position:sticky;bottom:0;background:var(--card);border-radius:0 0 var(--r-xl) var(--r-xl)}

/* Slip preview modal */
.sa-root .ch-slip-ov{position:fixed;inset:0;background:rgba(8,13,26,.7);backdrop-filter:blur(4px);display:flex;align-items:flex-start;justify-content:center;padding:14px;z-index:1400;overflow-y:auto}
.sa-root .ch-slip-wrap{background:#f5f5f5;border-radius:var(--r-xl);width:100%;max-width:700px;box-shadow:var(--s-xl);animation:saMIn .28s cubic-bezier(.34,1.26,.64,1) both;margin:auto;overflow:hidden}
.sa-root .ch-slip-toolbar{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;background:var(--card);border-bottom:1px solid var(--bl);border-radius:var(--r-xl) var(--r-xl) 0 0}
.sa-root .ch-slip-toolbar-title{font-size:13px;font-weight:700;color:var(--t1);display:flex;align-items:center;gap:7px}
.sa-root .ch-slip-toolbar-title i{color:var(--brand)}
.sa-root .ch-slip-paper{background:#fff;margin:16px;border-radius:12px;box-shadow:0 2px 20px rgba(0,0,0,.1);overflow:hidden}
.sa-root .ch-slip-band{background:linear-gradient(135deg,#0369A1,#0284C7);height:8px}
.sa-root .ch-slip-header{padding:24px 28px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #e5e7eb}
.sa-root .ch-slip-logo-area{display:flex;align-items:center;gap:14px}
.sa-root .ch-slip-logo-circle{width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;font-size:18px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sa-root .ch-slip-school-name{font-size:17px;font-weight:800;color:#0F172A;line-height:1.25}
.sa-root .ch-slip-school-city{font-size:12px;color:#64748B;margin-top:2px}
.sa-root .ch-slip-school-addr{font-size:11px;color:#94a3b8;margin-top:1px}
.sa-root .ch-slip-title-area{text-align:right}
.sa-root .ch-slip-doc-title{font-size:22px;font-weight:800;color:#0284C7;letter-spacing:-.02em}
.sa-root .ch-slip-doc-sub{font-size:11px;color:#64748B;margin-top:3px}
.sa-root .ch-slip-info{padding:16px 28px;background:#f8fafc;border-bottom:1px solid #e5e7eb}
.sa-root .ch-slip-info-row{display:flex;align-items:center;margin-bottom:8px}
.sa-root .ch-slip-info-row:last-child{margin-bottom:0}
.sa-root .ch-slip-info-key{width:120px;background:#1E3A8A;color:#fff;font-size:10px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;padding:6px 10px;border-radius:4px;flex-shrink:0}
.sa-root .ch-slip-info-val{flex:1;padding:6px 14px;font-size:13px;font-weight:600;color:#0F172A;border-bottom:1.5px dashed #e2e8f0}
.sa-root .ch-slip-calc{display:grid;grid-template-columns:1fr 1fr;gap:0;padding:20px 28px;border-bottom:1px solid #e5e7eb}
.sa-root .ch-slip-calc-left{padding-right:16px;border-right:1px solid #e5e7eb}
.sa-root .ch-slip-calc-right{padding-left:16px}
.sa-root .ch-slip-calc-title{font-size:11px;font-weight:800;color:#0284C7;letter-spacing:.5px;text-transform:uppercase;margin-bottom:12px;display:flex;align-items:center;gap:6px}
.sa-root .ch-slip-calc-row{display:flex;align-items:center;margin-bottom:8px;padding-bottom:8px;border-bottom:1px dashed #e5e7eb}
.sa-root .ch-slip-calc-row:last-child{border-bottom:none;margin-bottom:0;padding-bottom:0}
.sa-root .ch-slip-calc-key{background:#334155;color:#fff;font-size:9.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;padding:5px 9px;border-radius:4px;flex-shrink:0;min-width:120px;text-align:center}
.sa-root .ch-slip-calc-val{flex:1;padding:5px 12px;font-size:12.5px;font-weight:600;color:#0F172A;border-bottom:1px dashed #e2e8f0;margin-left:8px}
.sa-root .ch-slip-calc-val.highlight{color:#0284C7;font-size:15px;font-weight:800}
.sa-root .ch-slip-net-key{background:#0F172A;color:#fff;font-size:9.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;padding:5px 9px;border-radius:4px;flex-shrink:0;min-width:120px;text-align:center}
.sa-root .ch-slip-net-val{flex:1;padding:5px 12px;font-size:14px;font-weight:800;color:#0284C7;margin-left:8px}
.sa-root .ch-slip-bank{padding:16px 28px 0;border-bottom:1px solid #e5e7eb}
.sa-root .ch-slip-bank-title{font-size:11px;font-weight:800;color:#0284C7;letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:6px}
.sa-root .ch-slip-bank-empty{display:flex;align-items:center;gap:8px;padding:10px 2px;font-size:12.5px;color:#64748B}
.sa-root .ch-slip-bank-grid{display:grid;grid-template-columns:1fr 1fr;gap:0}
.sa-root .ch-slip-bank-row{display:flex;align-items:center;margin-bottom:10px}
.sa-root .ch-slip-bank-key{background:#334155;color:#fff;font-size:9px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;padding:5px 8px;border-radius:4px;flex-shrink:0;min-width:90px;text-align:center}
.sa-root .ch-slip-bank-val{flex:1;padding:5px 10px;font-size:12px;font-weight:600;color:#0F172A;border-bottom:1px dashed #e2e8f0;margin-left:8px}
.sa-root .ch-slip-instructions{padding:14px 28px 20px;background:#eff6ff}
.sa-root .ch-slip-instr-title{font-size:11px;font-weight:800;color:#0284C7;letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px;display:flex;align-items:center;gap:6px}
.sa-root .ch-slip-instr-text{font-size:12px;color:#475569;line-height:1.6}
.sa-root .ch-slip-bottom-band{background:linear-gradient(135deg,#0369A1,#0284C7);height:6px}

/* Delete confirm */
.sa-root .ch-del-ov{position:fixed;inset:0;background:rgba(8,13,26,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;z-index:1350}
.sa-root .ch-del-modal{background:var(--card);border-radius:var(--r-xl);width:100%;max-width:400px;box-shadow:var(--s-xl);border:1px solid var(--bl);animation:saMIn .28s cubic-bezier(.34,1.26,.64,1) both;padding:32px 28px;text-align:center}

/* Receiving tab */
.sa-root .dues-pos{color:var(--err);font-weight:800}
.sa-root .dues-zero{color:var(--tm);font-weight:600}
.sa-root .dues-neg{color:var(--success);font-weight:800}
.sa-root .recv-expand-row td{padding:0;border-bottom:1px solid var(--bl)}
.sa-root .recv-detail-box{background:var(--muted);border-top:1.5px solid var(--bl);padding:14px 20px}
.sa-root .recv-detail-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:12px}
.sa-root .recv-dc{background:var(--card);border:1px solid var(--bl);border-radius:var(--r-md);padding:10px 14px;text-align:center}
.sa-root .recv-dc-lbl{font-size:10.5px;color:var(--tm);font-weight:600;margin-bottom:4px}
.sa-root .recv-dc-val{font-size:15px;font-weight:800;color:var(--t1)}
.sa-root .recv-history-title{font-size:11px;font-weight:800;color:var(--brand);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;display:flex;align-items:center;gap:6px}
.sa-root .recv-hist-item{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--bl)}
.sa-root .recv-hist-item:last-child{border-bottom:none}
.sa-root .recv-hist-dot{width:8px;height:8px;border-radius:50%;background:var(--success);flex-shrink:0}
.sa-root .recv-hist-amount{font-size:13px;font-weight:800;color:var(--success);min-width:90px}
.sa-root .recv-hist-via{font-size:11.5px;color:var(--tm);flex:1}
.sa-root .recv-hist-date{font-size:11px;color:var(--tm)}
.sa-root .recv-btn-dl{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 12px;border-radius:var(--r-md);font-family:var(--font);font-size:11.5px;font-weight:700;cursor:pointer;transition:var(--tr);background:rgba(30,58,138,.08);color:var(--brand);border:1px solid var(--bl)}
.sa-root .recv-btn-dl:hover{background:var(--brand-light)}
.sa-root .recv-btn-del{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 12px;border-radius:var(--r-md);font-family:var(--font);font-size:11.5px;font-weight:700;cursor:pointer;transition:var(--tr);background:rgba(220,38,38,.07);color:var(--err);border:1px solid rgba(220,38,38,.2)}
.sa-root .recv-btn-del:hover{background:rgba(220,38,38,.14)}
.sa-root .recv-btn-recv{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 13px;border-radius:var(--r-md);font-family:var(--font);font-size:11.5px;font-weight:700;cursor:pointer;transition:var(--tr);border:none;background:linear-gradient(135deg,#0369A1,#0284C7);color:#fff;box-shadow:0 2px 8px rgba(3,105,161,.25)}
.sa-root .recv-btn-recv:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 12px rgba(3,105,161,.35)}
/* Us mahine ki receiving ho chuki ho to button band — wahi shakl jo Challans
   ke Generate button ki hai (.ch-btn:disabled). */
.sa-root .recv-btn-recv:disabled{background:#94a3b8;box-shadow:none;cursor:not-allowed;transform:none}
.sa-root .recv-btn-dl:disabled,.sa-root .recv-btn-del:disabled{opacity:.4;cursor:not-allowed}

/* Receiving modal */
.sa-root .recv-ov{position:fixed;inset:0;background:rgba(8,13,26,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;z-index:1300;overflow-y:auto}
.sa-root .recv-modal{background:var(--card);border-radius:var(--r-xl);width:100%;max-width:520px;box-shadow:var(--s-xl);border:1px solid var(--bl);animation:saMIn .28s cubic-bezier(.34,1.26,.64,1) both;margin:auto}
.sa-root .recv-modal-hdr{display:flex;align-items:center;gap:12px;padding:18px 22px;border-bottom:1px solid var(--bl);border-radius:var(--r-xl) var(--r-xl) 0 0;background:linear-gradient(135deg,rgba(3,105,161,.06),transparent)}
.sa-root .recv-modal-icon{width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#0369A1,#0284C7);color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;box-shadow:0 3px 10px rgba(3,105,161,.28)}
.sa-root .recv-modal-body{padding:22px}
.sa-root .recv-field{margin-bottom:14px}
.sa-root .recv-field label{display:block;font-size:11.5px;font-weight:700;color:var(--t2);margin-bottom:5px}
.sa-root .recv-input{width:100%;height:40px;border:1.5px solid var(--bl);border-radius:var(--r-md);padding:0 14px;font-family:var(--font);font-size:13px;color:var(--t1);background:var(--inp);outline:none;transition:var(--tr)}
.sa-root .recv-input:focus{border-color:#0284C7;box-shadow:0 0 0 3px rgba(2,132,199,.1)}
.sa-root .recv-input[readonly]{background:var(--muted);color:var(--tm);cursor:not-allowed}
.sa-root .recv-input-2col{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sa-root .recv-summary-card{background:linear-gradient(135deg,rgba(3,105,161,.07),rgba(2,132,199,.03));border:1.5px solid rgba(2,132,199,.2);border-radius:var(--r-md);padding:14px 16px;margin-bottom:16px}
.sa-root .recv-summary-row{display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--bl)}
.sa-root .recv-summary-row:last-child{border-bottom:none}
.sa-root .recv-summary-lbl{font-size:12px;color:var(--tm);font-weight:600}
.sa-root .recv-summary-val{font-size:13px;font-weight:700;color:var(--t1)}
.sa-root .recv-remaining-live{background:var(--muted);border:1.5px solid var(--bl);border-radius:var(--r-md);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;margin-top:14px}
.sa-root .recv-modal-foot{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:16px 22px;border-top:1px solid var(--bl);border-radius:0 0 var(--r-xl) var(--r-xl)}

/* Reports */
.sa-root .rpt-loading{display:flex;flex-direction:column;align-items:center;gap:12px;padding:56px 20px;color:var(--tm);font-size:13px;font-weight:700}
.sa-root .rpt-loading i{font-size:26px;color:var(--brand)}
.sa-root .rpt-stat-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:18px}
.sa-root .rpt-stat{background:var(--card);border:1px solid var(--bl);border-radius:var(--r-lg);padding:13px 14px;box-shadow:var(--s-xs);border-left:3px solid var(--brand);text-align:center}
.sa-root .rpt-stat-val{font-size:20px;font-weight:800;color:var(--t1);letter-spacing:-.02em;line-height:1}
.sa-root .rpt-stat-lbl{font-size:10.5px;color:var(--tm);font-weight:600;margin-top:4px}
.sa-root .rpt-stat.s-green{border-left-color:var(--success)}
.sa-root .rpt-stat.s-warn{border-left-color:var(--warn)}
.sa-root .rpt-stat.s-red{border-left-color:var(--err)}
.sa-root .rpt-stat.s-info{border-left-color:#0284C7}
.sa-root .rpt-filter-bar{display:flex;align-items:flex-end;gap:8px;padding:14px 18px;border-bottom:1px solid var(--bl);flex-wrap:wrap;background:var(--card);border-radius:var(--r-xl) var(--r-xl) 0 0}
.sa-root .rpt-subtabs{display:flex;gap:4px;background:var(--muted);border:1.5px solid var(--bl);border-radius:var(--r-lg);padding:4px;margin-bottom:18px;flex-wrap:wrap}
.sa-root .rpt-stab{flex:1;min-width:110px;padding:9px 12px;border:none;background:transparent;font-family:var(--font);font-size:12px;font-weight:600;color:var(--tm);cursor:pointer;transition:var(--tr);border-radius:var(--r-md);display:flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap}
.sa-root .rpt-stab.active{background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;box-shadow:0 2px 8px rgba(30,58,138,.22)}
.sa-root .rpt-stab:hover:not(.active){color:var(--t1);background:rgba(30,58,138,.06)}
.sa-root .rpt-pdf-btn{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 14px;border-radius:var(--r-md);border:none;background:linear-gradient(135deg,#b91c1c,#dc2626);color:#fff;font-size:12px;font-weight:700;box-shadow:0 2px 8px rgba(220,38,38,.25);cursor:pointer;transition:var(--tr);font-family:var(--font)}
.sa-root .rpt-pdf-btn:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(220,38,38,.35)}
.sa-root .rpt-paid{background:rgba(22,163,74,.1);color:#16A34A;border:1px solid rgba(22,163,74,.25);border-radius:var(--r-f);padding:2px 9px;font-size:10.5px;font-weight:700;display:inline-block}
.sa-root .rpt-partial{background:rgba(217,119,6,.1);color:#D97706;border:1px solid rgba(217,119,6,.25);border-radius:var(--r-f);padding:2px 9px;font-size:10.5px;font-weight:700;display:inline-block}
.sa-root .rpt-unpaid{background:rgba(220,38,38,.1);color:#DC2626;border:1px solid rgba(220,38,38,.25);border-radius:var(--r-f);padding:2px 9px;font-size:10.5px;font-weight:700;display:inline-block}
.sa-root .rpt-pending{background:rgba(100,116,139,.1);color:#64748B;border:1px solid rgba(100,116,139,.2);border-radius:var(--r-f);padding:2px 9px;font-size:10.5px;font-weight:700;display:inline-block}
.sa-root .rpt-totals-row td{background:linear-gradient(135deg,rgba(30,58,138,.07),rgba(30,64,175,.04));font-weight:800;color:var(--brand);border-top:2px solid var(--brand)}

@media(max-width:1100px){.sa-root .rpt-stat-grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:700px){
  .sa-root .rpt-stat-grid{grid-template-columns:repeat(2,1fr)}
  .sa-root .rpt-stab{font-size:11px;padding:8px 8px;min-width:80px}
}
@media(max-width:640px){
  .sa-root .pay-formula-grid{grid-template-columns:1fr}
  .sa-root .pay-input-row{grid-template-columns:1fr}
  .sa-root .psetup-detail-grid{grid-template-columns:1fr 1fr}
  .sa-root .pay-tabs{grid-template-columns:1fr 1fr}
  .sa-root .pay-tab{font-size:11.5px;padding:10px 6px}
  .sa-root .recv-detail-grid{grid-template-columns:repeat(2,1fr)}
  .sa-root .recv-input-2col{grid-template-columns:1fr}
  .sa-root .ch-slip-calc,.sa-root .ch-slip-bank-grid{grid-template-columns:1fr}
  .sa-root .ch-actions{flex-wrap:wrap}
}

/* ══════════ OPERATIONAL SOPs MODULE ══════════ */
.sa-root .sop-cat-bar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px}
.sa-root .sop-cat-btn{display:inline-flex;align-items:center;gap:7px;padding:9px 16px;border-radius:var(--r-lg);border:1.5px solid var(--bl);background:var(--card);font-family:var(--font);font-size:12.5px;font-weight:600;color:var(--t2);cursor:pointer;transition:var(--tr)}
.sa-root .sop-cat-btn:hover{border-color:var(--brand);color:var(--brand);background:var(--muted)}
.sa-root .sop-cat-btn.active{background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;border-color:transparent;box-shadow:0 3px 10px rgba(30,58,138,.28)}
.sa-root .sop-cat-count{background:rgba(255,255,255,.22);color:#fff;border-radius:99px;padding:1px 7px;font-size:10px;font-weight:800}
.sa-root .sop-cat-btn:not(.active) .sop-cat-count{background:rgba(30,58,138,.1);color:var(--brand)}
/* Inactive manual head list me rehta hai (edit/activate karne ke liye), bas
   dabaa hua dikhta hai aur apna status badge saath rakhta hai. */
.sa-root .sop-cat-btn.off:not(.active){border-style:dashed;color:var(--tm)}
.sa-root .sop-cat-state{background:rgba(217,119,6,.14);color:#B45309;border-radius:99px;padding:1px 7px;font-size:9.5px;font-weight:800;letter-spacing:.3px;text-transform:uppercase}
.sa-root .sop-cat-btn.active .sop-cat-state{background:rgba(255,255,255,.22);color:#fff}
.sa-root .sop-cat-edit-btn{width:26px;height:26px;border-radius:7px;border:none;background:rgba(255,255,255,.18);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;cursor:pointer;transition:var(--tr);flex-shrink:0}
.sa-root .sop-cat-btn:not(.active) .sop-cat-edit-btn{background:rgba(30,58,138,.08);color:var(--brand)}
.sa-root .sop-cat-edit-btn:hover{background:rgba(255,255,255,.35)}
.sa-root .sop-table{width:100%;border-collapse:collapse}
.sa-root .sop-table thead tr{background:linear-gradient(135deg,#1E3A8A,#1E40AF)}
.sa-root .sop-table th{padding:11px 13px;text-align:left;font-size:10.5px;font-weight:800;color:#fff;letter-spacing:.5px;text-transform:uppercase;white-space:nowrap}
.sa-root .sop-table td{padding:10px 13px;border-bottom:1px solid var(--bl);font-size:12.5px;color:var(--t2);vertical-align:middle}
.sa-root .sop-table tbody tr:hover td{background:rgba(30,58,138,.025)}
.sa-root .sop-table tbody tr:last-child td{border-bottom:none}
.sa-root .sop-manual-title{font-weight:700;color:var(--brand);cursor:pointer;display:flex;align-items:center;gap:7px}
.sa-root .sop-manual-title:hover{text-decoration:underline}
.sa-root .sop-expand-row td{padding:0;border-bottom:1px solid var(--bl)}
.sa-root .sop-forms-box{background:var(--muted);border-top:1px solid var(--bl);padding:12px 16px}
.sa-root .sop-form-item{display:flex;align-items:center;gap:10px;padding:7px 10px;background:var(--card);border:1px solid var(--bl);border-radius:var(--r-md);margin-bottom:6px}
.sa-root .sop-form-item:last-child{margin-bottom:0}
.sa-root .sop-form-icon{width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,#b91c1c,#dc2626);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0}
.sa-root .sop-form-title{font-size:12.5px;font-weight:700;color:var(--t1);flex:1}
.sa-root .sop-form-code{font-size:11px;color:var(--tm)}
.sa-root .sop-form-ref{font-size:10.5px;color:var(--tm);background:var(--muted);border:1px solid var(--bl);border-radius:var(--r-f);padding:1px 7px}
.sa-root .sop-btn-view{display:inline-flex;align-items:center;gap:5px;height:29px;padding:0 11px;border-radius:var(--r-md);border:none;background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font);transition:var(--tr)}
.sa-root .sop-btn-view:hover{transform:translateY(-1px)}
.sa-root .sop-dots-btn{width:28px;height:28px;border-radius:7px;border:1.5px solid var(--bl);background:var(--card);color:var(--tm);display:flex;align-items:center;justify-content:center;font-size:13px;cursor:pointer;transition:var(--tr)}
.sa-root .sop-dots-btn:hover{background:var(--muted);color:var(--t1)}
.sa-root .sop-dropdown{position:absolute;top:32px;right:0;background:var(--card);border:1.5px solid var(--bl);border-radius:var(--r-md);box-shadow:var(--s-md);min-width:160px;z-index:200}
.sa-root .sop-dd-item{display:flex;align-items:center;gap:8px;padding:9px 13px;font-size:12.5px;font-weight:600;color:var(--t2);cursor:pointer;transition:var(--tr)}
.sa-root .sop-dd-item i{width:14px;text-align:center}
.sa-root .sop-dd-item:hover{background:var(--muted);color:var(--t1)}
.sa-root .sop-dd-item.danger{color:var(--err)}.sa-root .sop-dd-item.danger:hover{background:rgba(220,38,38,.07)}
.sa-root .sop-badge-pdf{background:rgba(220,38,38,.09);color:#DC2626;border:1px solid rgba(220,38,38,.2);border-radius:var(--r-f);padding:2px 8px;font-size:10px;font-weight:700;white-space:nowrap}
.sa-root .sop-badge-form{background:rgba(30,58,138,.09);color:var(--brand);border:1px solid var(--bl);border-radius:var(--r-f);padding:2px 8px;font-size:10px;font-weight:700;white-space:nowrap}
.sa-root .sop-badge-soon{background:rgba(100,116,139,.09);color:#64748B;border:1px solid rgba(100,116,139,.2);border-radius:var(--r-f);padding:2px 8px;font-size:10px;font-weight:700;white-space:nowrap}

/* SOP modals — shared field bits */
.sa-root .sop-field{margin-bottom:14px}
.sa-root .sop-field label{display:block;font-size:11.5px;font-weight:700;color:var(--t2);margin-bottom:5px}
.sa-root .sop-input{width:100%;height:40px;border:1.5px solid var(--bl);border-radius:var(--r-md);padding:0 13px;font-family:var(--font);font-size:13px;color:var(--t1);background:var(--inp);outline:none;transition:var(--tr)}
.sa-root .sop-input:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(30,58,138,.09)}
.sa-root .sop-textarea{width:100%;border:1.5px solid var(--bl);border-radius:var(--r-md);padding:10px 13px;font-family:var(--font);font-size:13px;color:var(--t1);background:var(--inp);outline:none;transition:var(--tr);resize:vertical;min-height:70px}
.sa-root .sop-textarea:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(30,58,138,.09)}
.sa-root .sop-2col{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sa-root .sop-section-divider{font-size:10.5px;font-weight:800;color:var(--brand);text-transform:uppercase;letter-spacing:.5px;padding:10px 0 6px;border-bottom:1.5px solid var(--bl);margin-bottom:14px;display:flex;align-items:center;gap:6px}
.sa-root .sop-file-row{display:flex;align-items:center;gap:10px;background:var(--muted);border:1.5px dashed var(--bl);border-radius:var(--r-md);padding:10px 14px;cursor:pointer;transition:var(--tr)}
.sa-root .sop-file-row:hover{border-color:var(--brand);background:rgba(30,58,138,.04)}
.sa-root .sop-modal-hdr{display:flex;align-items:center;gap:12px;padding:18px 22px;border-bottom:1px solid var(--bl);position:sticky;top:0;background:var(--card);z-index:5}
.sa-root .sop-modal-icon{width:40px;height:40px;border-radius:11px;background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;box-shadow:0 3px 10px rgba(30,58,138,.25)}
.sa-root .sop-modal-body{padding:22px}
.sa-root .sop-modal-foot{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:14px 22px;border-top:1px solid var(--bl);border-radius:0 0 var(--r-xl) var(--r-xl)}

/* Manual modal */
.sa-root .sop-modal-ov{position:fixed;inset:0;background:rgba(8,13,26,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;z-index:1300;overflow-y:auto}
.sa-root .sop-modal{background:var(--card);border-radius:var(--r-xl);width:100%;max-width:580px;max-height:94vh;overflow-y:auto;box-shadow:var(--s-xl);border:1px solid var(--bl);animation:saMIn .28s cubic-bezier(.34,1.26,.64,1) both}
/* Category modal */
.sa-root .sop-cat-ov{position:fixed;inset:0;background:rgba(8,13,26,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;z-index:1400}
.sa-root .sop-cat-modal{background:var(--card);border-radius:var(--r-xl);width:100%;max-width:440px;box-shadow:var(--s-xl);border:1px solid var(--bl);animation:saMIn .28s cubic-bezier(.34,1.26,.64,1) both}
/* Form modal */
.sa-root .sop-form-ov{position:fixed;inset:0;background:rgba(8,13,26,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;z-index:1400}
.sa-root .sop-form-modal{background:var(--card);border-radius:var(--r-xl);width:100%;max-width:480px;box-shadow:var(--s-xl);border:1px solid var(--bl);animation:saMIn .28s cubic-bezier(.34,1.26,.64,1) both}
/* Detail modal */
.sa-root .sop-det-ov{position:fixed;inset:0;background:rgba(8,13,26,.62);backdrop-filter:blur(4px);display:flex;align-items:flex-start;justify-content:center;padding:14px;z-index:1200;overflow-y:auto}
.sa-root .sop-det-modal{background:var(--card);border-radius:var(--r-xl);width:100%;max-width:720px;box-shadow:var(--s-xl);border:1px solid var(--bl);animation:saMIn .28s cubic-bezier(.34,1.26,.64,1) both;margin:auto}
.sa-root .sop-det-hdr{display:flex;align-items:flex-start;gap:14px;padding:18px 22px;border-bottom:1px solid var(--bl);border-radius:var(--r-xl) var(--r-xl) 0 0;background:linear-gradient(135deg,rgba(30,58,138,.05),transparent)}
.sa-root .sop-det-av{width:46px;height:46px;border-radius:13px;background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;font-size:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px rgba(30,58,138,.28)}
.sa-root .sop-det-body{padding:20px 22px;max-height:72vh;overflow-y:auto}
.sa-root .sop-det-section{margin-bottom:18px}
.sa-root .sop-det-section-title{font-size:11px;font-weight:800;color:var(--brand);text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px;display:flex;align-items:center;gap:6px;padding-bottom:6px;border-bottom:1.5px solid var(--bl)}
.sa-root .sop-det-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:14px 22px;border-top:1px solid var(--bl);border-radius:0 0 var(--r-xl) var(--r-xl)}
/* PDF viewer */
.sa-root .sop-pdf-ov{position:fixed;inset:0;background:rgba(8,13,26,.75);backdrop-filter:blur(4px);display:flex;align-items:flex-start;justify-content:center;padding:14px;z-index:1500;overflow-y:auto}
.sa-root .sop-pdf-wrap{background:var(--card);border-radius:var(--r-xl);width:100%;max-width:860px;box-shadow:var(--s-xl);animation:saMIn .28s cubic-bezier(.34,1.26,.64,1) both;margin:auto;overflow:hidden}
.sa-root .sop-pdf-toolbar{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;background:var(--card);border-bottom:1px solid var(--bl)}
/* Video modal */
.sa-root .sop-vid-ov{position:fixed;inset:0;background:rgba(0,0,0,.85);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;z-index:1600}
.sa-root .sop-vid-modal{background:#000;border-radius:var(--r-xl);width:100%;max-width:800px;box-shadow:0 20px 60px rgba(0,0,0,.8);overflow:hidden;animation:saMIn .28s cubic-bezier(.34,1.26,.64,1) both}
.sa-root .sop-vid-toolbar{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#111;border-bottom:1px solid #333}
.sa-root .sop-vid-frame{width:100%;aspect-ratio:16/9;border:none;display:block}
/* Delete modal */
.sa-root .sop-del-ov{position:fixed;inset:0;background:rgba(8,13,26,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;z-index:1500}
.sa-root .sop-del-modal{background:var(--card);border-radius:var(--r-xl);width:100%;max-width:400px;box-shadow:var(--s-xl);border:1px solid var(--bl);animation:saMIn .28s cubic-bezier(.34,1.26,.64,1) both;padding:32px 26px;text-align:center}

@media(max-width:700px){
  .sa-root .sop-2col{grid-template-columns:1fr}
  .sa-root .sop-cat-btn{font-size:11.5px;padding:7px 12px}
}

/* ══════════ QUIZ CONTENT MODULE ══════════ */
.sa-root .quiz-tabs{display:flex;background:var(--card);border:1.5px solid var(--bl);border-radius:var(--r-lg);overflow:hidden;box-shadow:var(--s-sm);margin-bottom:20px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}
.sa-root .quiz-tabs::-webkit-scrollbar{display:none}
.sa-root .quiz-tab{flex:1;min-width:110px;padding:12px 10px;border:none;background:transparent;font-family:var(--font);font-size:12.5px;font-weight:600;color:var(--tm);cursor:pointer;transition:var(--tr);display:flex;align-items:center;justify-content:center;gap:6px;border-right:1px solid var(--bl);white-space:nowrap}
.sa-root .quiz-tab:last-child{border-right:none}
.sa-root .quiz-tab:hover:not(.active){background:var(--muted);color:var(--t1)}
.sa-root .quiz-tab.active{background:linear-gradient(135deg,#1E3A8A,#1E40AF,#2563EB);color:#fff;font-weight:700}
.sa-root .quiz-table{width:100%;border-collapse:collapse}
.sa-root .quiz-table thead tr{background:linear-gradient(135deg,#1E3A8A,#1E40AF)}
.sa-root .quiz-table th{padding:11px 13px;text-align:left;font-size:10.5px;font-weight:800;color:#fff;letter-spacing:.5px;text-transform:uppercase;white-space:nowrap}
.sa-root .quiz-table td{padding:10px 13px;border-bottom:1px solid var(--bl);font-size:13px;color:var(--t2);vertical-align:middle}
.sa-root .quiz-table tbody tr:hover td{background:rgba(30,58,138,.03)}
.sa-root .quiz-table tbody tr:last-child td{border-bottom:none}

/* Difficulty badges */
.sa-root .b-easy{background:rgba(22,163,74,.1);color:#16A34A;border:1px solid rgba(22,163,74,.25)}
.sa-root .b-medium{background:rgba(217,119,6,.1);color:#D97706;border:1px solid rgba(217,119,6,.25)}
.sa-root .b-hard{background:rgba(220,38,38,.1);color:#DC2626;border:1px solid rgba(220,38,38,.25)}

/* MCQ cards */
.sa-root .mcq-card{background:var(--card);border:1px solid var(--bl);border-radius:var(--r-lg);margin-bottom:10px;overflow:hidden;transition:var(--tr);box-shadow:var(--s-xs)}
.sa-root .mcq-card:hover{box-shadow:var(--s-sm)}
.sa-root .mcq-card-top{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;cursor:pointer}
.sa-root .mcq-num{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.sa-root .mcq-question{font-size:13px;font-weight:700;color:var(--t1);flex:1;line-height:1.5}
.sa-root .mcq-meta{display:flex;align-items:center;flex-wrap:wrap;gap:5px;margin-top:5px}
.sa-root .mcq-expand-body{padding:0 16px 14px;border-top:1px solid var(--bl);margin-top:4px}
.sa-root .mcq-expand-body.open{display:block;animation:saEtFd .16s ease both}
.sa-root .mcq-option{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:var(--r-md);margin-bottom:5px;background:var(--muted);border:1px solid var(--bl);font-size:12.5px;color:var(--t2)}
.sa-root .mcq-option.correct{background:rgba(22,163,74,.08);border-color:rgba(22,163,74,.3);color:#15803D;font-weight:700}
.sa-root .mcq-option-key{width:24px;height:24px;border-radius:6px;background:var(--brand);color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sa-root .mcq-option.correct .mcq-option-key{background:#16A34A}
.sa-root .mcq-explain{background:rgba(30,58,138,.05);border:1.5px solid var(--bl);border-radius:var(--r-md);padding:10px 12px;margin-top:8px;font-size:12px;color:var(--t2);line-height:1.55}
.sa-root .mcq-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:10px 16px;border-top:1px solid var(--bl);background:var(--muted)}

/* Quiz modals */
.sa-root .quiz-ov{position:fixed;inset:0;background:rgba(8,13,26,.6);backdrop-filter:blur(4px);display:flex;align-items:flex-start;justify-content:center;padding:14px;z-index:1200;overflow-y:auto}
.sa-root .quiz-modal{background:var(--card);border-radius:var(--r-xl);width:100%;max-width:580px;box-shadow:var(--s-xl);border:1px solid var(--bl);animation:saMIn .28s cubic-bezier(.34,1.26,.64,1) both;margin:auto}
.sa-root .quiz-modal-hdr{display:flex;align-items:center;gap:12px;padding:18px 22px;border-bottom:1px solid var(--bl);border-radius:var(--r-xl) var(--r-xl) 0 0;position:sticky;top:0;background:var(--card);z-index:5}
.sa-root .quiz-modal-icon{width:40px;height:40px;border-radius:11px;background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.sa-root .quiz-modal-body{padding:20px 22px;max-height:72vh;overflow-y:auto;scrollbar-width:thin}
.sa-root .quiz-field{margin-bottom:14px}
.sa-root .quiz-field label{display:block;font-size:11.5px;font-weight:700;color:var(--t2);margin-bottom:5px}
.sa-root .quiz-input{width:100%;height:40px;border:1.5px solid var(--bl);border-radius:var(--r-md);padding:0 13px;font-family:var(--font);font-size:13px;color:var(--t1);background:var(--inp);outline:none;transition:var(--tr)}
.sa-root .quiz-input:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(30,58,138,.09)}
.sa-root .quiz-textarea{width:100%;border:1.5px solid var(--bl);border-radius:var(--r-md);padding:10px 13px;font-family:var(--font);font-size:13px;color:var(--t1);background:var(--inp);outline:none;resize:vertical;min-height:68px}
.sa-root .quiz-textarea:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(30,58,138,.09)}
.sa-root .quiz-2col{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sa-root .quiz-modal-foot{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:14px 22px;border-top:1px solid var(--bl);border-radius:0 0 var(--r-xl) var(--r-xl)}
.sa-root .quiz-del-ov{position:fixed;inset:0;background:rgba(8,13,26,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;z-index:1300}
.sa-root .quiz-del-modal{background:var(--card);border-radius:var(--r-xl);width:100%;max-width:400px;box-shadow:var(--s-xl);border:1px solid var(--bl);animation:saMIn .28s cubic-bezier(.34,1.26,.64,1) both;padding:32px 26px;text-align:center}

@media(max-width:700px){
  .sa-root .quiz-2col{grid-template-columns:1fr}
  .sa-root .quiz-tab{font-size:11px;padding:10px 8px}
  .sa-root .quiz-table thead{display:none}
  .sa-root .quiz-table tr{display:block;margin-bottom:10px;background:var(--card);border:1px solid var(--bl);border-radius:var(--r-md);padding:10px}
  .sa-root .quiz-table td{display:flex;justify-content:space-between;align-items:center;border:none;padding:5px 2px;flex-wrap:wrap;gap:4px}
  .sa-root .quiz-table td::before{content:attr(data-label);font-size:10.5px;font-weight:700;color:var(--tm);text-transform:uppercase;flex-shrink:0}
}

/* ══════════ TEACHER TRAININGS MODULE ══════════ */
.sa-root .tt-tab{padding:10px 18px;border:none;background:none;font-family:var(--font);font-size:13px;font-weight:600;color:var(--tm);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;transition:var(--tr);display:flex;align-items:center;gap:7px;border-radius:var(--r-sm) var(--r-sm) 0 0}
.sa-root .tt-tab:hover{color:var(--brand);background:rgba(30,58,138,.05)}
.sa-root .tt-tab.active{color:var(--brand);border-bottom:2px solid var(--brand);background:rgba(30,58,138,.06)}
.sa-root .tt-cat-btn{padding:7px 14px;border-radius:var(--r-f);border:1.5px solid var(--bl);background:var(--card);color:var(--tm);font-family:var(--font);font-size:12px;font-weight:600;cursor:pointer;transition:var(--tr);display:flex;align-items:center;gap:6px}
.sa-root .tt-cat-btn:hover{border-color:var(--brand);color:var(--brand)}
.sa-root .tt-cat-btn.active{background:linear-gradient(135deg,var(--brand),var(--brand-mid));color:#fff;border-color:var(--brand)}
.sa-root .tt-card{background:var(--card);border:1.5px solid var(--bl);border-radius:var(--r-lg);padding:18px;margin-bottom:12px;transition:var(--tr);display:flex;gap:16px;align-items:flex-start}
.sa-root .tt-card:hover{box-shadow:var(--s-md);border-color:var(--bm)}
.sa-root .tt-card-avatar{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,var(--brand),var(--brand-mid));color:#fff;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sa-root .tt-card-body{flex:1;min-width:0}
.sa-root .tt-card-title{font-size:14px;font-weight:700;color:var(--t1);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sa-root .tt-card-meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px}
.sa-root .tt-card-desc{font-size:12px;color:var(--tm);line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.sa-root .tt-badge{font-size:11px;font-weight:700;padding:2px 10px;border-radius:var(--r-f);display:inline-flex;align-items:center;gap:4px}
.sa-root .tt-badge-academics{background:rgba(30,58,138,.1);color:var(--brand)}
.sa-root .tt-badge-administrative{background:rgba(2,132,199,.1);color:var(--info)}
.sa-root .tt-badge-parenting{background:rgba(22,163,74,.1);color:var(--success)}
.sa-root .tt-badge-character{background:rgba(217,119,6,.1);color:var(--warn)}
.sa-root .tt-badge-others{background:rgba(100,116,139,.1);color:var(--tm)}
.sa-root .tt-status-published{background:rgba(22,163,74,.12);color:var(--success)}
.sa-root .tt-status-draft{background:rgba(217,119,6,.12);color:var(--warn)}
.sa-root .tt-status-hidden{background:rgba(100,116,139,.12);color:var(--tm)}
.sa-root .tt-status-scheduled{background:rgba(30,58,138,.1);color:var(--brand)}
.sa-root .tt-status-completed{background:rgba(22,163,74,.12);color:var(--success)}
.sa-root .tt-status-cancelled{background:rgba(220,38,38,.1);color:var(--err)}
.sa-root .tt-card-actions{display:flex;gap:6px;flex-shrink:0;align-items:flex-start}
.sa-root .tt-action-btn{height:32px;padding:0 12px;border-radius:var(--r-md);border:1.5px solid var(--bl);background:var(--card);color:var(--t2);font-family:var(--font);font-size:12px;font-weight:600;cursor:pointer;transition:var(--tr);display:flex;align-items:center;gap:5px}
.sa-root .tt-action-btn:hover{border-color:var(--brand);color:var(--brand)}
.sa-root .tt-action-btn.danger:hover{border-color:var(--err);color:var(--err)}
.sa-root .tt-empty{text-align:center;padding:48px 24px;color:var(--tm)}
.sa-root .tt-empty i{font-size:36px;margin-bottom:12px;opacity:.4;display:block}
.sa-root .tt-form-body{padding:20px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;max-height:calc(90vh - 130px)}
.sa-root .tt-2col{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:640px){
  .sa-root .tt-card{flex-direction:column;gap:12px}
  .sa-root .tt-card-actions{width:100%;justify-content:flex-end}
  .sa-root .tt-card-title{white-space:normal}
  .sa-root .tt-2col{grid-template-columns:1fr}
}

/* ══════════ USER MANAGEMENT MODULE ══════════ */
.sa-root .um-tabs{display:grid;grid-template-columns:repeat(3,1fr);background:var(--card);border:1.5px solid var(--bl);border-radius:var(--r-lg);overflow:hidden;box-shadow:var(--s-sm);margin-bottom:20px}
.sa-root .um-tab{padding:13px 10px;border:none;background:transparent;font-family:var(--font);font-size:13px;font-weight:600;color:var(--tm);cursor:pointer;transition:var(--tr);display:flex;align-items:center;justify-content:center;gap:8px;border-right:1px solid var(--bl)}
.sa-root .um-tab:last-child{border-right:none}
.sa-root .um-tab:hover:not(.active){background:var(--muted);color:var(--t1)}
.sa-root .um-tab.active{background:linear-gradient(135deg,#1E3A8A,#1E40AF,#2563EB);color:#fff;font-weight:700}
.sa-root .um-table{width:100%;border-collapse:collapse}
.sa-root .um-table thead tr{background:linear-gradient(135deg,#1E3A8A,#1E40AF)}
.sa-root .um-table th{padding:11px 13px;text-align:left;font-size:10.5px;font-weight:800;color:#fff;letter-spacing:.5px;text-transform:uppercase;white-space:nowrap}
.sa-root .um-table td{padding:10px 13px;border-bottom:1px solid var(--bl);font-size:13px;color:var(--t2);vertical-align:middle}
.sa-root .um-table tbody tr:hover td{background:rgba(30,58,138,.03)}
.sa-root .um-table tbody tr:last-child td{border-bottom:none}
.sa-root .um-avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sa-root .um-form-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px}
.sa-root .um-form-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
.sa-root .um-field{display:flex;flex-direction:column;gap:5px}
.sa-root .um-label{font-size:11.5px;font-weight:700;color:var(--t2)}
.sa-root .um-input{height:38px;border:1.5px solid var(--bl);border-radius:var(--r-md);padding:0 13px;font-family:var(--font);font-size:13px;color:var(--t1);background:var(--inp);outline:none;transition:var(--tr);width:100%}
.sa-root .um-input:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(30,58,138,.09)}
.sa-root .um-pw-wrap{position:relative}
.sa-root .um-pw-wrap .um-input{padding-right:38px}
.sa-root .um-pw-eye{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--tm);font-size:14px;padding:0}
.sa-root .um-img-preview{width:80px;height:80px;border-radius:var(--r-md);border:2px dashed var(--bl);background:var(--muted);display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--tm);overflow:hidden;flex-shrink:0}
.sa-root .um-img-preview img{width:100%;height:100%;object-fit:cover}
.sa-root .um-checkbox-row{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.sa-root .um-checkbox-row input[type=checkbox]{width:16px;height:16px;accent-color:var(--brand);cursor:pointer}
.sa-root .um-checkbox-row label{font-size:13px;font-weight:600;color:var(--t1);cursor:pointer}
.sa-root .um-school-tabs{display:flex;gap:0;background:var(--muted);border:1.5px solid var(--bl);border-radius:var(--r-md);overflow:hidden;margin-bottom:14px}
.sa-root .um-stab{flex:1;padding:10px 14px;border:none;background:transparent;font-family:var(--font);font-size:12.5px;font-weight:600;color:var(--tm);cursor:pointer;transition:var(--tr);display:flex;align-items:center;justify-content:center;gap:6px}
.sa-root .um-stab.active{background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;font-weight:700}
.sa-root .um-stab:hover:not(.active){background:rgba(30,58,138,.06);color:var(--t1)}
.sa-root .um-assign-table{width:100%;border-collapse:collapse}
.sa-root .um-assign-table th{padding:10px 12px;text-align:left;font-size:10.5px;font-weight:800;color:#fff;letter-spacing:.5px;text-transform:uppercase;background:linear-gradient(135deg,#1E3A8A,#1E40AF)}
.sa-root .um-assign-table td{padding:9px 12px;border-bottom:1px solid var(--bl);font-size:12.5px;color:var(--t2);vertical-align:middle}
.sa-root .um-assign-table tbody tr:hover td{background:rgba(30,58,138,.03)}
.sa-root .um-user-select{width:100%;max-width:340px;height:38px;border:1.5px solid var(--brand);border-radius:var(--r-f);padding:0 14px;font-family:var(--font);font-size:13px;color:var(--t1);background:var(--inp);outline:none;cursor:pointer}
.sa-root .um-perm-table{width:100%;border-collapse:collapse}
.sa-root .um-perm-table th{padding:10px 12px;text-align:left;font-size:10.5px;font-weight:800;color:#fff;letter-spacing:.5px;text-transform:uppercase;background:linear-gradient(135deg,#1E3A8A,#1E40AF)}
.sa-root .um-perm-table td{padding:10px 12px;border-bottom:1px solid var(--bl);font-size:13px;color:var(--t2);vertical-align:middle}
.sa-root .um-perm-table tbody tr:last-child td{border-bottom:none}
.sa-root .um-select-all-th{display:flex;align-items:center;gap:6px;cursor:pointer;color:#fff}
.sa-root .um-pagination{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-top:1px solid var(--bl);flex-wrap:wrap;gap:8px}
.sa-root .um-pag-info{font-size:12px;color:var(--tm)}
.sa-root .um-pag-btns{display:flex;align-items:center;gap:4px}
.sa-root .um-pag-btn{min-width:32px;height:32px;padding:0 8px;border-radius:var(--r-md);border:1.5px solid var(--bl);background:var(--card);color:var(--t2);font-size:12.5px;font-weight:600;cursor:pointer;transition:var(--tr);font-family:var(--font)}
.sa-root .um-pag-btn:hover:not(.active):not(:disabled){background:var(--muted)}
.sa-root .um-pag-btn.active{background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;border-color:transparent}
.sa-root .um-pag-btn:disabled{opacity:.4;cursor:not-allowed}
.sa-root .um-edit-ov{position:fixed;inset:0;background:rgba(8,13,26,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;z-index:1200}
.sa-root .um-edit-modal{background:var(--card);border-radius:var(--r-xl);width:100%;max-width:520px;box-shadow:var(--s-xl);border:1px solid var(--bl);animation:saMIn .28s cubic-bezier(.34,1.26,.64,1) both}
.sa-root .um-del-ov{position:fixed;inset:0;background:rgba(8,13,26,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;z-index:1300}
.sa-root .um-del-modal{background:var(--card);border-radius:var(--r-xl);width:100%;max-width:400px;box-shadow:var(--s-xl);border:1px solid var(--bl);animation:saMIn .28s cubic-bezier(.34,1.26,.64,1) both;padding:32px 26px;text-align:center}
@media(max-width:700px){
  .sa-root .um-form-grid{grid-template-columns:1fr}
  .sa-root .um-form-grid-2{grid-template-columns:1fr}
  .sa-root .um-tabs{grid-template-columns:1fr}
  .sa-root .um-tab{border-right:none;border-bottom:1px solid var(--bl)}
  .sa-root .um-tab:last-child{border-bottom:none}
}

/* ══════════ NOTIFICATIONS MODULE ══════════ */
.sa-root .notif-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px}
.sa-root .notif-stat{background:var(--card);border:1px solid var(--bl);border-radius:var(--r-lg);padding:16px 18px;display:flex;align-items:center;gap:14px;box-shadow:var(--s-xs);transition:var(--tr)}
.sa-root .notif-stat:hover{box-shadow:var(--s-sm);transform:translateY(-1px)}
.sa-root .notif-stat-icon{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.sa-root .notif-stat-val{font-size:22px;font-weight:800;color:var(--t1);line-height:1}
.sa-root .notif-stat-lbl{font-size:11.5px;color:var(--tm);margin-top:3px;font-weight:600}
.sa-root .notif-layout{display:grid;grid-template-columns:1.6fr 1fr;gap:20px;align-items:start}
.sa-root .notif-card{background:var(--card);border:1px solid var(--bl);border-radius:var(--r-lg);box-shadow:var(--s-sm);overflow:visible}
.sa-root .notif-card-header{padding:14px 20px;border-bottom:1px solid var(--bl);display:flex;align-items:center;gap:10px;background:linear-gradient(135deg,rgba(30,58,138,.03),transparent)}
.sa-root .notif-card-icon{width:34px;height:34px;border-radius:9px;background:var(--brand-light);color:var(--brand);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
.sa-root .notif-card-title{font-size:14px;font-weight:800;color:var(--t1)}
.sa-root .notif-card-sub{font-size:11px;color:var(--tm);margin-top:1px}
.sa-root .notif-card-body{padding:18px 20px;display:flex;flex-direction:column;gap:14px}
.sa-root .notif-form-label{font-size:11.5px;font-weight:700;color:var(--t2);display:block}
.sa-root .req-star{color:var(--err)}
.sa-root .notif-form-input{width:100%;height:40px;border:1.5px solid var(--bl);border-radius:var(--r-md);padding:0 13px;font-family:var(--font);font-size:13px;color:var(--t1);background:var(--inp);outline:none;transition:var(--tr)}
.sa-root .notif-form-input:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(30,58,138,.09)}
.sa-root select.notif-form-input{cursor:pointer}
.sa-root .notif-form-textarea{width:100%;border:1.5px solid var(--bl);border-radius:var(--r-md);padding:10px 13px;font-family:var(--font);font-size:13px;color:var(--t1);background:var(--inp);outline:none;resize:vertical;min-height:90px;transition:var(--tr)}
.sa-root .notif-form-textarea:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(30,58,138,.09)}
.sa-root .audience-pills{display:flex;gap:8px;flex-wrap:wrap}
.sa-root .audience-pill{flex:1;min-width:90px;padding:10px 14px;border-radius:var(--r-md);border:1.5px solid var(--bl);background:var(--muted);font-family:var(--font);font-size:13px;font-weight:600;color:var(--tm);cursor:pointer;transition:var(--tr);display:flex;align-items:center;justify-content:center;gap:7px}
.sa-root .audience-pill:hover{border-color:var(--brand);color:var(--brand);background:var(--brand-light)}
.sa-root .audience-pill.active{background:linear-gradient(135deg,var(--brand),var(--brand-mid));color:#fff;border-color:transparent;box-shadow:0 3px 10px rgba(30,58,138,.25)}
.sa-root .sub-audience-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.sa-root .sub-audience-card{padding:9px 12px;border-radius:var(--r-md);border:1.5px solid var(--bl);background:var(--muted);font-family:var(--font);font-size:12px;font-weight:600;color:var(--t2);cursor:pointer;transition:var(--tr);display:flex;align-items:center;gap:7px}
.sa-root .sub-audience-card:hover{border-color:var(--brand);background:var(--brand-light);color:var(--brand)}
.sa-root .sub-audience-card.active{border-color:var(--brand);background:var(--brand-light);color:var(--brand)}
.sa-root .sub-audience-radio{width:14px;height:14px;border-radius:50%;border:2px solid currentColor;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sa-root .sub-audience-card.active .sub-audience-radio::after{content:'';width:6px;height:6px;border-radius:50%;background:currentColor}
.sa-root .class-section-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.sa-root .notif-type-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}
.sa-root .notif-type-pill{padding:8px 10px;border-radius:var(--r-md);border:1.5px solid var(--bl);background:var(--muted);font-family:var(--font);font-size:11.5px;font-weight:700;color:var(--tm);cursor:pointer;transition:var(--tr);display:flex;align-items:center;gap:6px;justify-content:center}
.sa-root .notif-type-pill:hover{transform:translateY(-1px)}
.sa-root .notif-type-pill.active{color:#fff;border-color:transparent}
.sa-root .notif-type-pill[data-type="general"].active{background:linear-gradient(135deg,var(--brand),var(--brand-mid));box-shadow:0 3px 8px rgba(30,58,138,.3)}
.sa-root .notif-type-pill[data-type="important"].active{background:linear-gradient(135deg,#D97706,#B45309);box-shadow:0 3px 8px rgba(217,119,6,.3)}
.sa-root .notif-type-pill[data-type="reminder"].active{background:linear-gradient(135deg,#0284C7,#0369A1);box-shadow:0 3px 8px rgba(2,132,199,.3)}
.sa-root .notif-type-pill[data-type="emergency"].active{background:linear-gradient(135deg,#DC2626,#B91C1C);box-shadow:0 3px 8px rgba(220,38,38,.3)}
.sa-root .notif-char-counter{font-size:10.5px;color:var(--tm);text-align:right;margin-top:3px;font-weight:600}
.sa-root .notif-char-counter.warn{color:#D97706}
.sa-root .notif-char-counter.over{color:#DC2626}
.sa-root .notif-send-btn{width:100%;padding:12px;border-radius:var(--r-md);border:none;background:linear-gradient(135deg,var(--brand),var(--brand-mid));color:#fff;font-family:var(--font);font-size:14px;font-weight:800;cursor:pointer;transition:var(--tr);display:flex;align-items:center;justify-content:center;gap:9px;box-shadow:0 4px 14px rgba(30,58,138,.3)}
.sa-root .notif-send-btn:hover{box-shadow:0 6px 20px rgba(30,58,138,.45);transform:translateY(-1px)}

/* Sent table */
.sa-root .notif-table-wrap{background:var(--card);border:1px solid var(--bl);border-radius:var(--r-lg);box-shadow:var(--s-sm);overflow:hidden}
.sa-root .notif-table-head{display:grid;grid-template-columns:2fr 1fr 1.2fr 1fr 1fr 110px;background:var(--muted);border-bottom:1px solid var(--bl);padding:0 16px}
.sa-root .notif-th{padding:10px 8px;font-size:10px;font-weight:700;color:var(--tm);text-transform:uppercase;letter-spacing:.6px}
.sa-root .notif-row{display:grid;grid-template-columns:2fr 1fr 1.2fr 1fr 1fr 110px;padding:12px 16px;align-items:center;border-bottom:1px solid var(--bl);transition:var(--tr)}
.sa-root .notif-row:last-child{border-bottom:none}
.sa-root .notif-row:hover{background:var(--muted)}
.sa-root .notif-td{padding:0 8px;font-size:12.5px;color:var(--t2)}
.sa-root .notif-title-txt{font-size:13px;font-weight:700;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}
.sa-root .notif-body-txt{font-size:11px;color:var(--tm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;margin-top:2px}
.sa-root .notif-delivered{background:rgba(22,163,74,.08);color:#16A34A;border:1px solid rgba(22,163,74,.2);border-radius:var(--r-f);padding:2px 8px;font-size:10px;font-weight:700;display:inline-flex;align-items:center;gap:4px}
.sa-root .notif-type-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:var(--r-f);font-size:10.5px;font-weight:700}
.sa-root .ntb-general{background:var(--brand-light);color:var(--brand)}
.sa-root .ntb-important{background:rgba(217,119,6,.1);color:#D97706}
.sa-root .ntb-reminder{background:rgba(2,132,199,.1);color:#0284C7}
.sa-root .ntb-emergency{background:rgba(220,38,38,.1);color:#DC2626}
.sa-root .notif-act-btns{display:flex;gap:5px}
.sa-root .notif-del-btn,.sa-root .notif-edit-btn{width:30px;height:30px;border-radius:8px;border:1.5px solid var(--bl);background:var(--card);color:var(--tm);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;transition:var(--tr)}
.sa-root .notif-del-btn:hover{border-color:var(--err);color:var(--err);background:rgba(220,38,38,.06)}
.sa-root .notif-edit-btn:hover{border-color:var(--brand);color:var(--brand);background:var(--brand-light)}
.sa-root .notif-filter-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:14px 20px;border-bottom:1px solid var(--bl)}
.sa-root .notif-filter-search{display:flex;align-items:center;gap:7px;flex:1;min-width:200px;background:var(--muted);border:1.5px solid var(--bl);border-radius:var(--r-f);padding:7px 13px;transition:var(--tr)}
.sa-root .notif-filter-search:focus-within{border-color:var(--brand)}
.sa-root .notif-filter-search i{color:var(--tm);font-size:12px}
.sa-root .notif-filter-search input{border:none;background:transparent;font-family:var(--font);font-size:12.5px;color:var(--t1);outline:none;flex:1}
.sa-root .notif-filter-sel{border:1.5px solid var(--bl);border-radius:var(--r-f);background:var(--muted);font-family:var(--font);font-size:12px;font-weight:600;color:var(--t2);padding:7px 13px;outline:none;cursor:pointer;transition:var(--tr)}
.sa-root .notif-filter-sel:focus{border-color:var(--brand)}
.sa-root .notif-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 20px;text-align:center}
.sa-root .notif-empty-icon{width:60px;height:60px;border-radius:16px;background:var(--brand-light);color:var(--brand);display:flex;align-items:center;justify-content:center;font-size:26px;margin:0 auto 14px}
.sa-root .notif-empty-title{font-size:15px;font-weight:800;color:var(--t1);margin-bottom:5px}
.sa-root .notif-empty-sub{font-size:12.5px;color:var(--tm);line-height:1.6}

/* Notif modals */
.sa-root .notif-ov{position:fixed;inset:0;background:rgba(8,13,26,.55);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px;z-index:1300;overflow-y:auto}
.sa-root .notif-modal{background:var(--card);border-radius:var(--r-xl);width:100%;max-height:92vh;overflow-y:auto;box-shadow:var(--s-xl);border:1px solid var(--bl);animation:saMIn .28s cubic-bezier(.34,1.26,.64,1) both;margin:auto}
.sa-root .notif-modal-hdr{display:flex;align-items:flex-start;justify-content:space-between;padding:18px 22px;border-bottom:1px solid var(--bl)}
.sa-root .notif-modal-body{padding:20px 22px}
.sa-root .notif-modal-foot{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:16px 22px;border-top:1px solid var(--bl)}
.sa-root .notif-confirm-summary{background:var(--muted);border:1px solid var(--bl);border-radius:var(--r-md);padding:14px 16px;margin:12px 0;display:flex;flex-direction:column;gap:8px}
.sa-root .ncs-row{display:flex;align-items:baseline;gap:8px}
.sa-root .ncs-label{font-size:11px;font-weight:800;color:var(--tm);text-transform:uppercase;letter-spacing:.4px;width:110px;flex-shrink:0}
.sa-root .ncs-val{font-size:13px;font-weight:700;color:var(--t1)}
.sa-root .notif-helper-warn{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:#D97706;background:rgba(217,119,6,.06);border:1px solid rgba(217,119,6,.2);border-radius:var(--r-md);padding:8px 11px;margin-top:8px}

@media(max-width:1100px){.sa-root .notif-layout{grid-template-columns:1fr}}
@media(max-width:900px){.sa-root .notif-stats{grid-template-columns:repeat(2,1fr)}}
@media(max-width:760px){
  .sa-root .notif-type-grid{grid-template-columns:repeat(2,1fr)}
  .sa-root .notif-table-head{display:none}
  .sa-root .notif-row{grid-template-columns:1fr;gap:8px;padding:14px 16px}
  .sa-root .notif-title-txt,.sa-root .notif-body-txt{max-width:100%;white-space:normal}
}

/* ═══════════════════ DASHBOARD ═══════════════════
   (section-card / card-header / card-title / mentor-table / tbl-wrap
    are shared with the table modules above and reused as-is.) */
.sa-root .section-hdr{display:flex;align-items:center;gap:10px;margin-bottom:14px;margin-top:4px}
.sa-root .section-hdr-icon{width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0}
.sa-root .section-hdr-title{font-size:14px;font-weight:800;color:var(--t1)}

/* fee analytics cards */
.sa-root .fee-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:14px}
.sa-root .fee-grid-2{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:28px}
.sa-root .fee-card{border-radius:var(--r-lg);padding:18px 20px;position:relative;overflow:hidden;cursor:default}
.sa-root .fee-card::after{content:'';position:absolute;right:-12px;top:-12px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,.08)}
.sa-root .fee-card-red{background:linear-gradient(135deg,#DC2626,#B91C1C)}
.sa-root .fee-card-teal{background:linear-gradient(135deg,#0F766E,#0D9488)}
.sa-root .fee-card-orange{background:linear-gradient(135deg,#B45309,#D97706)}
.sa-root .fee-card-slate{background:linear-gradient(135deg,#334155,#475569)}
.sa-root .fee-card-green{background:linear-gradient(135deg,#15803D,#16A34A)}
.sa-root .fee-card-red2{background:linear-gradient(135deg,#9F1239,#BE123C)}
.sa-root .fee-card-lbl{font-size:11px;font-weight:700;color:rgba(255,255,255,.78);letter-spacing:.3px;margin-bottom:10px}
.sa-root .fee-card-val{font-size:26px;font-weight:800;color:#fff;letter-spacing:-.03em;line-height:1}
.sa-root .fee-card-icon{position:absolute;right:18px;top:50%;transform:translateY(-50%);font-size:28px;color:rgba(255,255,255,.22)}

/* school overview cards */
.sa-root .overview-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:14px}
.sa-root .ov-card{background:var(--card);border:1px solid var(--bl);border-radius:var(--r-lg);padding:18px 20px;box-shadow:var(--s-xs);position:relative;overflow:hidden}
.sa-root .ov-card::after{content:'';position:absolute;right:-10px;top:-10px;width:70px;height:70px;border-radius:50%;background:linear-gradient(135deg,rgba(30,58,138,.05),transparent)}
.sa-root .ov-lbl{font-size:10px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:var(--tm);margin-bottom:8px}
.sa-root .ov-lbl.green{color:#15803D}
.sa-root .ov-lbl.red{color:#DC2626}
.sa-root .ov-val{font-size:30px;font-weight:800;color:var(--t1);letter-spacing:-.03em;line-height:1;margin-bottom:6px}
.sa-root .ov-val.red{color:#DC2626}
.sa-root .ov-sub{font-size:11.5px;color:var(--tm)}
.sa-root .ov-sub b{color:var(--brand)}
.sa-root .ov-sub b.red{color:#DC2626}
.sa-root .ov-badge{position:absolute;right:16px;top:50%;transform:translateY(-50%);width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px}
.sa-root .ov-badge-blue{background:rgba(30,58,138,.1);color:var(--brand)}
.sa-root .ov-badge-green{background:rgba(22,163,74,.1);color:#16A34A}
.sa-root .ov-badge-red{background:rgba(220,38,38,.1);color:#DC2626}
.sa-root .ov-badge-teal{background:rgba(20,184,166,.1);color:#0D9488}
.sa-root .ov-badge-purple{background:rgba(139,92,246,.1);color:#7C3AED}
.sa-root .ov-badge-orange{background:rgba(234,88,12,.1);color:#EA580C}

/* onboarding status card */
.sa-root .onboard-card{background:var(--card);border:1px solid var(--bl);border-radius:var(--r-lg);padding:18px 20px;box-shadow:var(--s-xs)}
.sa-root .onboard-nums{display:flex;align-items:center;gap:0;margin:6px 0 4px}
.sa-root .onboard-num-block{flex:1;text-align:center}
.sa-root .onboard-num-divider{width:1px;background:var(--bl);height:36px;flex-shrink:0}
.sa-root .onboard-num-val{font-size:24px;font-weight:800;color:var(--t1);letter-spacing:-.02em}
.sa-root .onboard-num-lbl{font-size:10px;color:var(--tm);font-weight:600;margin-top:2px}
.sa-root .onboard-progress-row{display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--tm);margin-top:8px}
.sa-root .onboard-bar{height:5px;background:var(--muted);border-radius:99px;margin-top:5px;overflow:hidden;border:1px solid var(--bl)}
.sa-root .onboard-bar-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,#1E3A8A,#2563EB)}

/* students / staff cards */
.sa-root .user-card{background:var(--card);border:1px solid var(--bl);border-radius:var(--r-lg);padding:18px 20px;box-shadow:var(--s-xs)}
.sa-root .user-card-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.sa-root .user-card-lbl{font-size:10px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:var(--tm)}
.sa-root .user-card-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:15px;color:#fff}
.sa-root .user-card-icon-teal{background:linear-gradient(135deg,#0F766E,#0D9488)}
.sa-root .user-card-icon-blue{background:linear-gradient(135deg,#1E3A8A,#1E40AF)}
.sa-root .user-card-row{display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--bl)}
.sa-root .user-card-row:last-child{border-bottom:none}
.sa-root .user-card-field{font-size:12.5px;color:var(--tm);font-weight:600}
.sa-root .user-card-vals{display:flex;align-items:center;gap:10px}
.sa-root .user-card-bigval{font-size:15px;font-weight:800;color:var(--t1)}

/* bugs & improvements summary */
.sa-root .bi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:14px}
.sa-root .bi-card{border-radius:var(--r-lg);padding:16px 18px;position:relative;overflow:hidden;box-shadow:var(--s-xs)}
.sa-root .bi-card-red{background:var(--card);border:1px solid var(--bl);border-left:3px solid var(--err)}
.sa-root .bi-card-green{background:var(--card);border:1px solid var(--bl);border-left:3px solid var(--success)}
.sa-root .bi-card-orange{background:var(--card);border:1px solid var(--bl);border-left:3px solid var(--warn)}
.sa-root .bi-card-blue{background:var(--card);border:1px solid var(--bl);border-left:3px solid var(--brand)}
.sa-root .bi-icon{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:14px;margin-bottom:8px}
.sa-root .bi-icon-red{background:rgba(220,38,38,.12);color:#DC2626}
.sa-root .bi-icon-green{background:rgba(22,163,74,.12);color:#16A34A}
.sa-root .bi-icon-orange{background:rgba(217,119,6,.12);color:#D97706}
.sa-root .bi-icon-blue{background:rgba(30,58,138,.1);color:var(--brand)}
.sa-root .bi-lbl{font-size:10px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:var(--tm);margin-bottom:4px}
.sa-root .bi-val{font-size:26px;font-weight:800;color:var(--t1);letter-spacing:-.03em;line-height:1.1;margin-bottom:4px}
.sa-root .bi-sub{font-size:11px;color:var(--tm);line-height:1.4}
.sa-root .bi-sub .hi-red{color:#DC2626;font-weight:700}
.sa-root .bi-sub .hi-green{color:#16A34A;font-weight:700}
.sa-root .bi-sub .hi-orange{color:#D97706;font-weight:700}
.sa-root .bi-sub .hi-blue{color:var(--brand);font-weight:700}
.sa-root .bi-date{font-size:10px;color:var(--tm);margin-top:10px}
.sa-root .bi-btn{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 11px;border-radius:var(--r-md);border:none;font-family:var(--font);font-size:11px;font-weight:700;cursor:pointer;transition:var(--tr);margin-top:10px}
.sa-root .bi-btn-red{background:linear-gradient(135deg,#B91C1C,#DC2626);color:#fff;box-shadow:0 2px 8px rgba(220,38,38,.25)}
.sa-root .bi-btn-green{background:linear-gradient(135deg,#15803D,#16A34A);color:#fff;box-shadow:0 2px 8px rgba(22,163,74,.25)}
.sa-root .bi-btn-orange{background:linear-gradient(135deg,#B45309,#D97706);color:#fff;box-shadow:0 2px 8px rgba(217,119,6,.22)}
.sa-root .bi-btn-blue{background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;box-shadow:0 2px 8px rgba(30,58,138,.22)}
.sa-root .bi-period-bar{display:flex;align-items:center;gap:10px}
.sa-root .bi-period-lbl{font-size:12px;font-weight:700;color:var(--tm)}
.sa-root .bi-period-sel{height:32px;border:1.5px solid var(--bl);border-radius:var(--r-md);padding:0 10px;font-family:var(--font);font-size:12px;color:var(--t2);background:var(--inp);outline:none;cursor:pointer}

/* current month details table controls + footer + pagination */
.sa-root .card-header-right{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.sa-root .tbl-show-row{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--tm)}
.sa-root .tbl-show-sel{height:30px;border:1.5px solid var(--bl);border-radius:var(--r-md);padding:0 8px;font-family:var(--font);font-size:12px;color:var(--t2);background:var(--inp);outline:none;cursor:pointer}
.sa-root .tbl-search{display:flex;align-items:center;gap:7px;background:var(--muted);border:1.5px solid var(--bl);border-radius:var(--r-f);padding:0 12px;height:32px;transition:var(--tr)}
.sa-root .tbl-search:focus-within{border-color:var(--brand)}
.sa-root .tbl-search i{color:var(--tm);font-size:12px}
.sa-root .tbl-search input{border:none;background:transparent;outline:none;font-size:12px;color:var(--t1);width:160px;font-family:var(--font)}
.sa-root .mentor-table th .sort-icon{opacity:.5;margin-left:4px;font-size:9px}
.sa-root .mentor-table tfoot td{padding:12px 14px;font-size:12.5px;font-weight:800;color:var(--t1);background:linear-gradient(135deg,rgba(30,58,138,.05),transparent);border-top:2px solid var(--bm)}
.sa-root .pag-bar{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-top:1px solid var(--bl);flex-wrap:wrap;gap:8px}
.sa-root .pag-info{font-size:12px;color:var(--tm)}
.sa-root .pag-btns{display:flex;align-items:center;gap:4px}
.sa-root .pag-btn{min-width:32px;height:32px;padding:0 8px;border-radius:var(--r-md);border:1.5px solid var(--bl);background:var(--card);color:var(--t2);font-size:12.5px;font-weight:600;cursor:pointer;transition:var(--tr);font-family:var(--font)}
.sa-root .pag-btn:hover:not(.active):not(:disabled){background:var(--muted)}
.sa-root .pag-btn.active{background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;border-color:transparent}
.sa-root .pag-btn:disabled{opacity:.45;cursor:not-allowed}

/* school / user / video detail cards (db- prefixed to avoid clashing
   with the detail-card styles used by the payment + status modules) */
.sa-root .detail-2col{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
.sa-root .db-detail-card{background:var(--card);border:1px solid var(--bl);border-radius:var(--r-lg);padding:18px 20px;box-shadow:var(--s-xs)}
.sa-root .db-detail-card-hdr{display:flex;align-items:center;gap:9px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--bl)}
.sa-root .db-detail-card-icon{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0}
.sa-root .db-detail-card-title{font-size:13px;font-weight:800;color:var(--t1)}
.sa-root .db-detail-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bl)}
.sa-root .db-detail-row:last-child{border-bottom:none}
.sa-root .db-detail-row-lbl{font-size:12.5px;color:var(--tm);font-weight:600}
.sa-root .db-detail-row-val{font-size:14px;font-weight:800;color:#fff;background:linear-gradient(135deg,#1E3A8A,#1E40AF);border-radius:var(--r-f);padding:2px 12px;min-width:42px;text-align:center}
.sa-root .db-detail-row-val.red{background:linear-gradient(135deg,#B91C1C,#DC2626)}
.sa-root .db-detail-row-val.green{background:linear-gradient(135deg,#15803D,#16A34A)}

/* video detail card */
.sa-root .video-detail-row{display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--bl)}
.sa-root .video-detail-row:last-child{border-bottom:none}
.sa-root .video-detail-lbl{font-size:12.5px;color:var(--tm);font-weight:600}
.sa-root .video-detail-pill{font-size:12.5px;font-weight:800;color:#fff;background:linear-gradient(135deg,#1E3A8A,#1E40AF);border-radius:var(--r-f);padding:2px 11px;min-width:38px;text-align:center;display:inline-block}

/* this month progress */
.sa-root .month-progress-card{background:var(--card);border:1px solid var(--bl);border-radius:var(--r-lg);padding:18px 20px;box-shadow:var(--s-xs)}
.sa-root .month-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bl)}
.sa-root .month-row:last-child{border-bottom:none}
.sa-root .month-row-lbl{font-size:12.5px;color:var(--tm);font-weight:600}
.sa-root .month-row-val{font-size:14px;font-weight:800;padding:2px 12px;border-radius:var(--r-f);min-width:42px;text-align:center}
.sa-root .month-val-blue{background:var(--brand-light);color:var(--brand);border:1px solid var(--bm)}
.sa-root .month-val-orange{background:rgba(234,88,12,.1);color:#EA580C;border:1px solid rgba(234,88,12,.25)}
.sa-root .month-val-red{background:rgba(220,38,38,.1);color:#DC2626;border:1px solid rgba(220,38,38,.2)}

@media(max-width:1100px){
  .sa-root .fee-grid,.sa-root .overview-grid{grid-template-columns:repeat(2,1fr)}
  .sa-root .fee-grid-2{grid-template-columns:repeat(2,1fr)}
  .sa-root .bi-grid{grid-template-columns:1fr}
}
@media(max-width:760px){
  .sa-root .fee-grid,.sa-root .fee-grid-2,.sa-root .overview-grid,.sa-root .detail-2col{grid-template-columns:1fr}
  .sa-root .section-hdr{flex-wrap:wrap}
}

/* dashboard "viewing as" control + permission notices */
.sa-root .db-viewbar{display:flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--bl);border-radius:var(--r-f);padding:6px 8px 6px 14px;box-shadow:var(--s-xs);flex-wrap:wrap}
.sa-root .db-viewbar>i{color:var(--brand);font-size:13px}
.sa-root .db-viewbar-lbl{font-size:12px;font-weight:700;color:var(--tm)}
.sa-root .db-viewbar select{height:34px;border:1.5px solid var(--bl);border-radius:var(--r-md);padding:0 12px;font-family:var(--font);font-size:12.5px;font-weight:600;color:var(--t1);background:var(--inp);outline:none;cursor:pointer;min-width:210px}
.sa-root .db-viewbar select:focus{border-color:var(--brand)}
.sa-root .db-viewbar-tag{font-size:10.5px;font-weight:700;color:var(--brand);background:var(--brand-light);border:1px solid var(--bm);border-radius:var(--r-f);padding:3px 9px}
.sa-root .db-locked{display:flex;align-items:center;gap:9px;background:rgba(217,119,6,.08);border:1px solid rgba(217,119,6,.28);border-radius:var(--r-md);padding:10px 14px;margin-bottom:18px;font-size:12.5px;color:var(--t2)}
.sa-root .db-locked i{color:#D97706;font-size:14px;flex-shrink:0}
.sa-root .db-locked b{color:var(--t1);font-weight:800}
.sa-root .db-locked-ok{background:rgba(22,163,74,.07);border-color:rgba(22,163,74,.28)}
.sa-root .db-locked-ok i{color:#16A34A}
.sa-root .db-block{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;background:var(--card);border:1px solid var(--bl);border-radius:var(--r-xl);box-shadow:var(--s-sm);padding:54px 28px;margin-top:6px}
.sa-root .db-block>i{font-size:34px;color:var(--tm);opacity:.45;margin-bottom:4px}
.sa-root .db-block-ttl{font-size:17px;font-weight:800;color:var(--t1)}
.sa-root .db-block-sub{font-size:13px;color:var(--tm);line-height:1.6;max-width:440px}
.sa-root .db-retry{margin-top:14px;display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 16px;border-radius:var(--r-md);border:none;background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;font-family:var(--font);font-size:12.5px;font-weight:700;cursor:pointer;box-shadow:var(--s-sm)}
.sa-root .db-retry:hover{filter:brightness(1.06)}
.sa-root .db-skeleton{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:6px}
.sa-root .db-skel-card{height:104px;border-radius:var(--r-lg);background:linear-gradient(100deg,var(--muted) 30%,var(--card) 50%,var(--muted) 70%);background-size:200% 100%;border:1px solid var(--bl);animation:saSkel 1.2s ease-in-out infinite}
@keyframes saSkel{0%{background-position:200% 0}100%{background-position:-200% 0}}
@media(max-width:760px){.sa-root .db-skeleton{grid-template-columns:1fr}}
@media(max-width:760px){.sa-root .db-viewbar{width:100%}.sa-root .db-viewbar select{flex:1;min-width:0}}

/* Native controls (selects, scrollbars, date pickers) follow the theme. */
.sa-root{color-scheme:light}
.sa-root[data-theme="dark"]{color-scheme:dark}

/* ═══════════════════ TOOLTIPS ═══════════════════
   Attribute-driven and theme-aware. Add data-tip="label" to any element;
   optionally data-tip-pos="bottom|left|right" (default points up). An empty
   data-tip renders nothing, so it can be bound conditionally. */
.sa-root [data-tip]{position:relative}
.sa-root [data-tip]::after{content:attr(data-tip);position:absolute;z-index:1200;left:50%;bottom:calc(100% + 9px);transform:translateX(-50%) translateY(4px);background:var(--t1);color:var(--card);font-family:var(--font);font-size:11px;font-weight:600;letter-spacing:.2px;line-height:1.2;white-space:nowrap;max-width:260px;padding:6px 9px;border-radius:7px;box-shadow:0 6px 18px rgba(0,0,0,.28);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .14s ease,transform .14s ease}
.sa-root [data-tip]::before{content:'';position:absolute;z-index:1200;left:50%;bottom:calc(100% + 4px);transform:translateX(-50%) translateY(4px);border:5px solid transparent;border-top-color:var(--t1);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .14s ease,transform .14s ease}
.sa-root [data-tip]:hover::after,.sa-root [data-tip]:hover::before,.sa-root [data-tip]:focus-visible::after,.sa-root [data-tip]:focus-visible::before{opacity:1;visibility:visible;transform:translateX(-50%) translateY(0)}
.sa-root [data-tip=""]::after,.sa-root [data-tip=""]::before{display:none}
.sa-root [data-tip-pos="bottom"]::after{bottom:auto;top:calc(100% + 9px);transform:translateX(-50%) translateY(-4px)}
.sa-root [data-tip-pos="bottom"]::before{bottom:auto;top:calc(100% + 4px);border-top-color:transparent;border-bottom-color:var(--t1);transform:translateX(-50%) translateY(-4px)}
.sa-root [data-tip-pos="bottom"]:hover::after,.sa-root [data-tip-pos="bottom"]:hover::before,.sa-root [data-tip-pos="bottom"]:focus-visible::after,.sa-root [data-tip-pos="bottom"]:focus-visible::before{transform:translateX(-50%) translateY(0)}
.sa-root [data-tip-pos="left"]::after{left:auto;bottom:auto;top:50%;right:calc(100% + 9px);transform:translateY(-50%) translateX(4px)}
.sa-root [data-tip-pos="left"]::before{left:auto;bottom:auto;top:50%;right:calc(100% + 4px);border-top-color:transparent;border-left-color:var(--t1);transform:translateY(-50%) translateX(4px)}
.sa-root [data-tip-pos="left"]:hover::after,.sa-root [data-tip-pos="left"]:hover::before,.sa-root [data-tip-pos="left"]:focus-visible::after,.sa-root [data-tip-pos="left"]:focus-visible::before{transform:translateY(-50%) translateX(0)}
.sa-root [data-tip-pos="right"]::after{left:calc(100% + 9px);bottom:auto;top:50%;transform:translateY(-50%) translateX(-4px)}
.sa-root [data-tip-pos="right"]::before{left:calc(100% + 4px);bottom:auto;top:50%;border-top-color:transparent;border-right-color:var(--t1);transform:translateY(-50%) translateX(-4px)}
.sa-root [data-tip-pos="right"]:hover::after,.sa-root [data-tip-pos="right"]:hover::before,.sa-root [data-tip-pos="right"]:focus-visible::after,.sa-root [data-tip-pos="right"]:focus-visible::before{transform:translateY(-50%) translateX(0)}
`;
