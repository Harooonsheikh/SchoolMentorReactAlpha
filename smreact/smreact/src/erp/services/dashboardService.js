// ══════════════════════════════════════════════════════════════════
//  Dashboard service — Command Center (Admin) ke saare real numbers.
//  Ek hi API se poora dashboard bharta hai:
//    GET /get-dashboard/{branchId}?month={m}&year={y}
//  branchID sessionStorage se; month/year default = current month/year.
//  Response.data ka shape (PascalCase) as-is return hota hai — mapping
//  AdminDashboard me hoti hai. Fail hone par error throw (caller {} par
//  gir jata hai taake dashboard crash na ho).
// ══════════════════════════════════════════════════════════════════
import { buildUrl, buildSuperAdminUrl, apiMessage } from '../../utils/apiConfig';

/* Current month (1-12) + year — API in dono ko query params me leta hai. */
export function currentMonthYear() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export async function getDashboard(month, year) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const cur = currentMonthYear();
  const m = Number(month) || cur.month;
  const y = Number(year) || cur.year;
  const res  = await fetch(
    buildUrl(`/get-dashboard/${branchID}?month=${m}&year=${y}`),
    { headers: { Accept: '*/*' } },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not load dashboard');
  }
  return json?.data || {};
}

/* Combined Financial Summary — EK hi call me dashboard ke DONO sections:
   FinancialOverview (Monthly Financial Summary card) + FeeAnalytics (Fee
   Analytics cards). accountFilterType batata hai FinancialOverview kis period ka
   ho:
     CurrentMonth  → mojooda mahina (koi aur param nahi chahiye)
     SpecificMonth → accountMonth + accountYear
     DateRange     → fromDate + toDate (YYYY-MM-DD)
     SingleDate    → singleDate (YYYY-MM-DD)
   FeeAnalytics hamesha feeMonth + feeYear ka hota hai. Backend sirf un params ko
   parhta hai jo chune gaye accountFilterType se match karte hain — baqi hamesha
   bhej diye jate hain (dummy/default values) taake query shape sthir rahe.
     GET /financial-summary?branchId&accountFilterType&fromDate&toDate&singleDate
         &accountMonth&accountYear&feeMonth&feeYear
   Response.data = { FinancialOverview:{OverallIncome,OverallExpenses,NetProfitLoss},
   FeeAnalytics:{CurrentMonthFeePosition,ChallanDiscount,ChallansGenerated,
   PreviousDues,StudentsWithDues,TotalNetReceivable,FeeReceived,CollectionPercent,
   StudentsPaid,ReceivingDiscount,AdvanceReceived,AdvanceAdjustments,
   StudentsAdjusted,PendingFee,PendingPercent} }. */
export async function getFinancialSummary(opts = {}) {
  const cur = currentMonthYear();
  const branchID = Number(opts.branchId) || Number(sessionStorage.getItem('branchID')) || 0;
  const pad = (n) => String(n).padStart(2, '0');
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const monthStartISO = `${cur.year}-${pad(cur.month)}-01`;
  const params = new URLSearchParams({
    branchId:          String(branchID),
    accountFilterType: opts.accountFilterType || 'CurrentMonth',
    fromDate:          opts.fromDate   || monthStartISO,
    toDate:            opts.toDate     || todayISO,
    singleDate:        opts.singleDate || todayISO,
    accountMonth:      String(opts.accountMonth || cur.month),
    accountYear:       String(opts.accountYear  || cur.year),
    feeMonth:          String(opts.feeMonth || cur.month),
    feeYear:           String(opts.feeYear  || cur.year),
  });
  const res = await fetch(
    buildUrl(`/financial-summary?${params.toString()}`),
    { headers: { Accept: '*/*' } },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not load financial summary');
  }
  return json?.data || {};
}

/* OneLink Payments — dashboard ke OneLink Payments card ke liye. Super-Admin API
   par rehta hai ({host}/SchoolMentorSuperAdminAPI/api/...). filterType batata hai
   kis period ki payments:
     Month      → month + year
     FromTo     → fromDate + toDate (YYYY-MM-DD)
     SingleDate → singleDate (YYYY-MM-DD)
   filterType na bhejo to backend aaj ka single date deta hai. Baqi params hamesha
   default values ke sath bheje jate hain (backend sirf filterType ke mutabiq parhta hai).
     GET /api/AHM_School_Progress/branch_onelink-payments?branchId&filterType
         &fromDate&toDate&singleDate&month&year
   Response.data = { Summary:{PeriodFrom,PeriodTo,OnelinkTransactions,TotalReceived,
   TotalCharges,GrossAmount}, Transactions:[...] }. */
export async function getOneLinkPayments(opts = {}) {
  const cur = currentMonthYear();
  const branchID = Number(opts.branchId) || Number(sessionStorage.getItem('branchID')) || 0;
  const pad = (n) => String(n).padStart(2, '0');
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const monthStartISO = `${cur.year}-${pad(cur.month)}-01`;
  const params = new URLSearchParams({
    branchId:   String(branchID),
    filterType: opts.filterType || 'Month',
    fromDate:   opts.fromDate   || monthStartISO,
    toDate:     opts.toDate     || todayISO,
    singleDate: opts.singleDate || todayISO,
    month:      String(opts.month || cur.month),
    year:       String(opts.year  || cur.year),
  });
  const res = await fetch(
    buildSuperAdminUrl(`/api/AHM_School_Progress/branch_onelink-payments?${params.toString()}`),
    { headers: { Accept: '*/*' } },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not load OneLink payments');
  }
  return json?.data || {};
}

/* App-adoption report — un logon ki list jinhon ne mobile app install/register
   ki (FCM token registered = "downloaded"). Yehi endpoint dashboard ke Teachers/
   Parents "Downloaded" count ka source hai.
     GET /branch/{branchId}/fcm-tokens?accountType={teacher|parent}
   Response: { success, count, data: [{ id, name, userName, accountType,
   accountTypeID, fcmToken, hasToken }] }. branchID sessionStorage se. */
export async function getBranchFcmTokens(accountType) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const at = String(accountType || '').trim();
  const res = await fetch(
    buildUrl(`/branch/${branchID}/fcm-tokens${at ? `?accountType=${encodeURIComponent(at)}` : ''}`),
    { headers: { Accept: '*/*' } },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not load app adoption report');
  }
  return Array.isArray(json?.data) ? json.data : [];
}

/* Branch ka POORA active staff — Teachers App Status report ke liye.
     GET /api/LaunchSetup/get-employees-by-branch/{branchId}?isActive=true
   fcm-tokens sirf un ko bhejta hai jin ke paas token hai, is liye "Not
   Downloaded" wale yahin se aate hain. branchID sessionStorage se. */
export async function getBranchStaff() {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const token = sessionStorage.getItem('token');
  const res = await fetch(
    buildUrl(`/api/LaunchSetup/get-employees-by-branch/${branchID}?isActive=true`),
    { headers: { Accept: '*/*', ...(token ? { Authorization: `Bearer ${token}` } : {}) } },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not load staff list');
  }
  return (Array.isArray(json?.data) ? json.data : []).map(e => ({
    id:          Number(e.id) || 0,
    name:        [e.firstName, e.lastName].filter(Boolean).join(' ').trim() || e.name || e.employeeName || '—',
    phone:       e.phone || e.mobile || e.contactNo || '',
    designation: e.designationName || e.designation || '',
    department:  e.departmentName || e.department || '',
  }));
}

/* Activity Calendar — ek mahine ki activities (Academics → Activity Calendar ka hi source).
     GET /api/getactivitycalendarbymonth?BranchID&month&SessionYearID&pageNo=1
   Dashboard ke "Upcoming Activities" section ke liye. Fail par error throw. */
export async function getActivitiesByMonth(month) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const sessionYearID = sessionStorage.getItem('changeSessionId')
    || sessionStorage.getItem('SessionID') || sessionStorage.getItem('sessionID') || '';
  const token = sessionStorage.getItem('token');
  const m = Number(month) || currentMonthYear().month;
  const res = await fetch(
    buildUrl(`/api/getactivitycalendarbymonth?BranchID=${branchID}&month=${m}&SessionYearID=${sessionYearID}&pageNo=1`),
    { headers: { Accept: '*/*', ...(token ? { Authorization: `bearer ${token}` } : {}) } },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not load activities');
  }
  return Array.isArray(json?.data) ? json.data : [];
}
