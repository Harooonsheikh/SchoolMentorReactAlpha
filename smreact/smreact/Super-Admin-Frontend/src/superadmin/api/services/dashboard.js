/* ════════════════════════════════════════════════════════════════════
   Dashboard service — Super Admin ka platform overview.

   LIVE hai: GET .../api/AHM_School_Progress/admin_dashboard
   Swagger par is route ka koi parameter nahi — poora overview EK hi call me
   aata hai, is liye screen par bhi bas ek call jati hai (mount par, aur Retry
   par dobara).

   Pehle yeh screen dashboardData.js ke buildDashboard() par chalti thi, jo
   doosre modules ki DEMO rows jama kar ke aankre banata tha. Ab hamesha live
   API chalti hai — bilkul waise jaise SchoolMentorSuperAdminAPI ke baqi module
   (payments / schoolProgress / permissions) karte hain: wo isMockMode() dekhte
   hi nahi, kyunke REACT_APP_SA_API khali hone par bhi SA_ADMIN_API_BASE ka
   khali base dev me setupProxy ke zariye asal host tak chala jata hai.

   API na chale to yahan demo aankre NAHI dikhaye jate — error upar jata hai
   aur screen apna "Couldn't load the dashboard" + Retry dikhati hai. Jhoote
   aankre dikhane se behtar hai ke saaf bata diya jaye.

   API ka jawab:
     { success, data: {
         ActiveSchools, ERP_Schools, LaunchSetup_Schools, InActiveSchools,
         Active_Login_Schools,
         TotalStudents { Overall, NewSignUp }, TotalStaff { Overall, NewSignUp },
         OnboardingStatus { FullyTrained, InProcess },
         BugSummary { TotalBugs, ResolvedBugs, PendingBugs },
         Bugs [ { ID, BranchID, Module, Developer, BugDetail, Date, IsSolved } ],
         TotalVideos, VideoCategories [ { CategoryID, CategoryName, VideoCount } ],
         ThisMonthProgress { ERPSchools, LaunchSetupSchools },
         CurrentMonthDetails [ { SchoolName, PreviousAmount, FeeChallan,
                                 FeeDiscount, Receivable, ReceivedAmount,
                                 TotalPending } ] } }

   Mapping sirf `adminDashboardToUi()` me hai — wahi shape jo Dashboard.jsx
   pehle se padhta tha, taake screen ka baqi code jaisa hai waisa chale.
   ════════════════════════════════════════════════════════════════════ */
import { ApiError } from '../client';
import { SA_ADMIN_API_BASE, getSuperAdminToken } from '../config';
import EP from '../endpoints';
import { listPermissionBranches } from './schoolPermissions';
import { listSchoolProgress } from './schoolProgress';

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const text = (v) => String(v ?? '').trim();

/* Bug ki tafseel ek hi string me aati hai, kai lineon par:
       "[Improvement] improvemment\ndescriyion\nPriority: Medium"
   Pehli line unwan hai, aakhri "Priority: X" line alag chip banti hai, aur
   "[Improvement]" ka tag batata hai ke yeh bug nahi behtari ki tajweez hai.
   Jo entry in me se kuch na rakhe (sirf saada jumla) wo bhi theek chalti hai:
   poora jumla hi unwan ban jata hai. */
/* Table me severity / status (In Progress) / reported-by ke khane nahi —
   is liye Dashboard ka Bug Manager inhe bhi bugDetail ki aakhri lineon me
   likhta hai, "Priority:" hi ki tarah (severity ka lafz Priority hi rakha,
   taake Support aur purani entries ek hi qaide par chalen):
       title\ndescription…\nReported By: X\nStatus: In Progress\nPriority: High
   Aakhir se jitni aisi lineen hon, sab utar li jati hain (kisi bhi tarteeb). */
const META_LINE = /^(Priority|Severity|Status|Reported By):\s*(.*)$/i;

/* Improvement Manager ke zaid khane — sirf "[Improvement]" entries par
   padhe jaate hain, taake kisi bug ki aakhri line ("Type: …") ghalti se
   utar na jaye. Kai-line wale khane (Implementation / Expected Outcome /
   Evidence) ek line me "\n" (do harf) ban kar jaate hain. */
const IMP_META_LINE = /^(Priority|Severity|Status|Reported By|Category|Type|Target Date|Implementation|Expected Outcome|Completion Date|Completed By|Evidence):\s*(.*)$/i;
const IMP_META_KEYS = {
  category: 'Category', type: 'Type', targetDate: 'Target Date', implementation: 'Implementation',
  outcome: 'Expected Outcome', completionDate: 'Completion Date', completedBy: 'Completed By', evidence: 'Evidence',
};
const escLine = (v) => text(v).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n');
const unescLine = (v) => String(v || '').replace(/\\(\\|n)/g, (_, c) => (c === 'n' ? '\n' : '\\'));

export const BUG_STATUS = { pending: 'Pending', progress: 'In Progress', resolved: 'Resolved' };
export const IMP_STATUS = { new: 'New', pending: 'Pending', progress: 'In Progress', completed: 'Completed' };

function parseBugDetail(raw) {
  let body = text(raw);
  let kind = 'bug';
  const tag = body.match(/^\[([^\]]+)\]\s*/);
  if (tag) {
    if (/improve/i.test(tag[1])) kind = 'improvement';
    body = body.slice(tag[0].length);
  }
  const lineRe = kind === 'improvement' ? IMP_META_LINE : META_LINE;
  const lines = body.split('\n').map(text).filter(Boolean);
  const meta = {};
  while (lines.length > 1) {
    const m = lines[lines.length - 1].match(lineRe);
    if (!m) break;
    const key = m[1].toLowerCase() === 'severity' ? 'priority' : m[1].toLowerCase();
    if (meta[key] == null) meta[key] = text(m[2]);
    lines.pop();
  }
  const descLines = lines.slice(1);
  const out = {
    kind,
    priority: meta.priority || '',
    reportedBy: meta['reported by'] || '',
    statusTag: meta.status || '',
    title: lines[0] || '',
    description: descLines.join(' '),
    /* Edit form ke liye asal lineon wali tafseel. */
    descriptionText: descLines.join('\n'),
  };
  if (kind === 'improvement') {
    Object.entries(IMP_META_KEYS).forEach(([k, label]) => { out[k] = unescLine(meta[label.toLowerCase()]); });
  }
  return out;
}

/** Improvement Manager ka form → API ka bugDetail ("[Improvement]" tag ke saath). */
export function composeImprovementDetail(v) {
  return [
    `[Improvement] ${text(v.title)}`,
    text(v.description),
    ...Object.entries(IMP_META_KEYS).map(([k, label]) => escLine(v[k]) && `${label}: ${escLine(v[k])}`),
    text(v.reportedBy) && `Reported By: ${text(v.reportedBy)}`,
    /* Completed isSolved se — baqi teeno status line me. */
    v.status && v.status !== IMP_STATUS.completed && `Status: ${v.status}`,
    text(v.priority) && `Priority: ${text(v.priority)}`,
  ].filter(Boolean).join('\n');
}

/** parseBugDetail ka ulta — Bug Manager ka form → API ka bugDetail. */
export function composeBugDetail({ title, description, reportedBy, status, severity }) {
  return [
    text(title),
    text(description),
    text(reportedBy) && `Reported By: ${text(reportedBy)}`,
    /* Pending default hai aur Resolved isSolved se — sirf In Progress likhna padta hai. */
    status === BUG_STATUS.progress && `Status: ${BUG_STATUS.progress}`,
    text(severity) && `Priority: ${text(severity)}`,
  ].filter(Boolean).join('\n');
}

/** Ek API row → Dashboard ki bug list ka row. */
export function dashboardBugToUi(b, i) {
  const parsed = parseBugDetail(b?.BugDetail);
  const solved = b?.IsSolved === true || b?.IsSolved === 1;
  return {
    id: num(b?.ID) || `bug-${i}`,
    /* Asal record id — sirf isi par edit / delete chal sakta hai. */
    recordId: num(b?.ID),
    branchId: num(b?.BranchID),
    module: text(b?.Module) || '—',
    developer: text(b?.Developer) || '—',
    date: text(b?.Date).slice(0, 10),
    solved,
    ...parsed,
    status: parsed.kind === 'improvement'
      /* Purani (Support wali) improvements par status line nahi — Pending. */
      ? (solved ? IMP_STATUS.completed
        : /progress/i.test(parsed.statusTag) ? IMP_STATUS.progress
          : /^new$/i.test(parsed.statusTag) ? IMP_STATUS.new : IMP_STATUS.pending)
      : (solved ? BUG_STATUS.resolved
        : /progress/i.test(parsed.statusTag) ? BUG_STATUS.progress : BUG_STATUS.pending),
  };
}

/**
 * admin_dashboard ka `data` → wohi shape jo Dashboard.jsx padhta hai.
 * @param {Object} raw  jawab ka `data`
 */
export function adminDashboardToUi(raw) {
  const d = raw || {};

  const erp      = num(d.ERP_Schools);
  const launch   = num(d.LaunchSetup_Schools);
  const active   = num(d.ActiveSchools);
  const inactive = num(d.InActiveSchools);

  /* "New this month" — API ka apna ThisMonthProgress block. */
  const tmp       = d.ThisMonthProgress || {};
  const newErp    = num(tmp.ERPSchools);
  const newLaunch = num(tmp.LaunchSetupSchools);

  const stu = d.TotalStudents || {};
  const stf = d.TotalStaff || {};

  /* Onboarding: API sirf do aankre deti hai (FullyTrained / InProcess).
     "Total Modules" is route par hai hi nahi, is liye usay banate nahi —
     null bhej kar screen "—" dikha deti hai (jhoota 15 likhne se behtar).
     Percentage unhi do se: kitni schools mukammal train ho chukin. */
  const ob           = d.OnboardingStatus || {};
  const fullyTrained = num(ob.FullyTrained);
  const inProcess    = num(ob.InProcess);
  const tracked      = fullyTrained + inProcess;

  const bs = d.BugSummary || {};

  /* Current Month Details — Fee Analytics ke cards AUR neeche wali table,
     dono isi ek list se bante hain (cards us list ka jama hain, taake table
     aur cards kabhi alag na batayein). */
  const feeRows = (Array.isArray(d.CurrentMonthDetails) ? d.CurrentMonthDetails : [])
    .map((r, i) => ({
      id:         num(r?.BranchID) || `fee-${i}`,
      name:       text(r?.SchoolName) || '—',
      prevDues:   num(r?.PreviousAmount),
      challan:    num(r?.FeeChallan),
      discount:   num(r?.FeeDiscount),
      receivable: num(r?.Receivable),
      received:   num(r?.ReceivedAmount),
      pending:    num(r?.TotalPending),
    }));

  const feeTotals = feeRows.reduce((t, r) => ({
    prevDues:   t.prevDues   + r.prevDues,
    challan:    t.challan    + r.challan,
    discount:   t.discount   + r.discount,
    receivable: t.receivable + r.receivable,
    received:   t.received   + r.received,
    pending:    t.pending    + r.pending,
  }), { prevDues: 0, challan: 0, discount: 0, receivable: 0, received: 0, pending: 0 });

  /* Video categories ab API se aati hain (pehle screen par saat naam
     hardcoded thay, jinka E-Tube ki asal categories se koi taalluq nahi tha). */
  const byCat = {};
  (Array.isArray(d.VideoCategories) ? d.VideoCategories : []).forEach((c) => {
    byCat[text(c?.CategoryName) || '—'] = num(c?.VideoCount);
  });

  return {
    schools: {
      total: active + inactive,
      erp,
      launch,
      inactive,
      active,
      activeLogin: num(d.Active_Login_Schools),
      newLaunch,
      newErp,
    },
    onboarding: {
      totalModules: null,                 // is API me nahi — screen "—" dikhati hai
      fullyTrained,
      inProcess,
      pct: tracked ? Math.round((fullyTrained / tracked) * 100) : 0,
    },
    students: { total: num(stu.Overall), newSignup: num(stu.NewSignUp) },
    staff:    { total: num(stf.Overall), newSignup: num(stf.NewSignUp) },
    feeRows,
    feeTotals,
    videos: { total: num(d.TotalVideos), byCat },
    bugs: {
      total:    num(bs.TotalBugs),
      resolved: num(bs.ResolvedBugs),
      pending:  num(bs.PendingBugs),
    },
    /* Poori bug list bhi jawab me aati hai — aur Bugs Summary + Improvements
       Summary DONO isi list par chalti hain (Dashboard.jsx ka countBi):
         • kind === 'bug' / 'improvement'  → kaunsa section
         • date                            → Today / Yesterday / This Month /
                                             Last Month / All Time ka filter
         • solved                          → resolved vs pending
       Isi liye BugSummary (upar wala `bugs`) se aankre thore alag nikal sakte
       hain: wo all-time hai aur improvements ko bhi bug ginta hai. */
    bugList: (Array.isArray(d.Bugs) ? d.Bugs : []).map(dashboardBugToUi),
    raw: d,
  };
}

/**
 * Dashboard ke school cards ka EK source — branch directory
 * (SchoolPermissions/get-branches-with-permissions), wahi list jo School
 * Permissions aur School Payments dikhate hain:
 *   isActive    → active / inactive
 *   launchSetup → 1 = ERP, 0 = Launch Set-Up   (inactive par bhi maloom)
 *
 * branch-report (School Status) sirf students / staff ke liye jodi jati hai.
 * Wo route kuch active branches chhor deta hai, aur isActive=false par
 * launchSetup ko nazar-andaz karta hai — is liye ginti / group ke liye us par
 * bharosa nahi kiya jata. Wo fail ho to sirf counts jaate hain (`enriched`
 * false), school list nahi.
 *
 * @returns {Promise<{ launch, erp, inactive, enriched }>} har row:
 *   { id, name, setupType: 'erp'|'launch', active, signupDate, students, staff }
 */
export async function loadSchoolDirectory() {
  const [{ schools, permMap }, prog] = await Promise.all([
    listPermissionBranches(),
    listSchoolProgress().catch(() => null),
  ]);
  const report = {};
  if (prog) [...prog.launch, ...prog.erp, ...prog.inactive].forEach((r) => { if (r.id) report[r.id] = r; });
  const out = { launch: [], erp: [], inactive: [], enriched: !!prog };
  const seen = new Set();
  (schools || []).forEach((s) => {
    const id = num(s.id);
    if (!id || seen.has(id)) return;
    seen.add(id);
    const p = permMap?.[s.id] || {};
    const r = report[id];
    const row = {
      id,
      name: s.name || r?.name || `Branch #${id}`,
      setupType: p.erpAccess ? 'erp' : 'launch',
      active: !!p.activeBranch,
      signupDate: text(s.raw?.createdAt).slice(0, 10) || r?.signupDate || '',
      students: r ? num(r.students) : 0,
      staff: r ? num(r.staff) : 0,
    };
    if (!row.active) out.inactive.push(row);
    else (row.setupType === 'erp' ? out.erp : out.launch).push(row);
  });
  return out;
}

/** GET /api/AHM_School_Progress/admin_dashboard → mapped overview. */
export async function fetchDashboard() {
  const token = getSuperAdminToken();
  let res;
  try {
    res = await fetch(`${SA_ADMIN_API_BASE}${EP.schoolProgress.adminDashboard()}`, {
      headers: {
        accept: '*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (networkErr) {
    throw new ApiError(networkErr.message || 'Network error', 0);
  }

  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.success === false)) {
    throw new ApiError(json?.message || `Could not load the dashboard (${res.status})`, res.status);
  }
  return adminDashboardToUi(json?.data ?? json);
}
