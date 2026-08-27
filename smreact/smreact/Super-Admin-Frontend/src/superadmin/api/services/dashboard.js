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

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const text = (v) => String(v ?? '').trim();

/* Bug ki tafseel ek hi string me aati hai, kai lineon par:
       "[Improvement] improvemment\ndescriyion\nPriority: Medium"
   Pehli line unwan hai, aakhri "Priority: X" line alag chip banti hai, aur
   "[Improvement]" ka tag batata hai ke yeh bug nahi behtari ki tajweez hai.
   Jo entry in me se kuch na rakhe (sirf saada jumla) wo bhi theek chalti hai:
   poora jumla hi unwan ban jata hai. */
function parseBugDetail(raw) {
  let body = text(raw);
  let kind = 'bug';
  const tag = body.match(/^\[([^\]]+)\]\s*/);
  if (tag) {
    if (/improve/i.test(tag[1])) kind = 'improvement';
    body = body.slice(tag[0].length);
  }
  let priority = '';
  body = body.replace(/(^|\n)\s*Priority:\s*([^\n]*)\s*$/i, (_, __, p) => { priority = text(p); return ''; });

  const lines = body.split('\n').map(text).filter(Boolean);
  return {
    kind,
    priority,
    title: lines[0] || '',
    description: lines.slice(1).join(' '),
  };
}

/** Ek API row → Dashboard ki bug list ka row. */
export function dashboardBugToUi(b, i) {
  const parsed = parseBugDetail(b?.BugDetail);
  return {
    id: num(b?.ID) || `bug-${i}`,
    branchId: num(b?.BranchID),
    module: text(b?.Module) || '—',
    developer: text(b?.Developer) || '—',
    date: text(b?.Date).slice(0, 10),
    solved: b?.IsSolved === true || b?.IsSolved === 1,
    ...parsed,
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
