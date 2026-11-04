# Dashboard Data Standard

**API response = frontend data state = displayed value.**
The backend is the source of truth for every figure on the Super Admin Dashboard.
The frontend receives, validates, maps, formats and renders — nothing else.

This standard is enforced by tests (`npm run test:dashboard`), a live runtime check
(`npm run verify:dashboard`) and lint (`npm run lint:dashboard`). CI must run the first and
third; run the second against a running dev server before releasing dashboard changes.

---

## 1. Architecture

```
admin_dashboard ─┐                         ┌─ dashboard/contract.js     validate every response
get_onelink_Report┘ → api/services/*.js  ──┤
                      (fetch, abort,        └─ dashboard/metrics.js      THE registry: metric → endpoint + field
                       error handling)               │
                                                     ▼
                       dashboard/useDashboardData.js  one state, latest-request-wins, unmount-safe
                       api/useApi.js (1LINK)          same sequencing rule
                                                     │
                                                     ▼
                       Dashboard.jsx / OneLinkSection.jsx
                         value = values[metricId]  →  format.js  →  <el data-metric="metricId">
```

| File | Responsibility |
|---|---|
| `src/superadmin/dashboard/metrics.js` | **Metric registry.** Every displayed number has one entry: `id`, `label`, `source` endpoint, declarative `spec` (which field), `format`, optional `periods`. |
| `src/superadmin/dashboard/contract.js` | Runtime schema checks. Required fields are derived from the registry. Errors → value shows `—` + banner; warnings (negative money, broken invariants) → shown as sent + listed. |
| `src/superadmin/api/services/dashboard.js` | `fetchDashboard({ signal })` → validated view model `{ values, feeRows, bugList, videoCategories, violations }`. |
| `src/superadmin/dashboard/useDashboardData.js` | The Dashboard's only `admin_dashboard` state. Aborts outdated requests, drops stale responses, silent refresh keeps last valid data. |
| `src/superadmin/format.js` | The only formatters: `fmtCount`, `fmtPKR`, `fmtAmount`, `fmtPct`. `null` → `—`; formatting never changes the number. |
| `src/superadmin/dashboard/periods.js` | Pakistan-time (Asia/Karachi) period logic shared by every filter. |
| `src/superadmin/dashboard/testing/verifyMetrics.js` | Test utility: independent spec reader + DOM reader + comparison table. |

## 2. Rules

1. **Every value has a registered API source.** No number is rendered unless it is a registry
   metric (or a row of an API list, e.g. Current Month Details, video categories).
2. **Explicit field mapping.** The registry `spec` names the real response field
   (`{ path: 'ActiveSchools' }`). Never map one field onto an unrelated card.
3. **No business calculations in the frontend.** Fees, dues, school counts, login statistics,
   onboarding and percentages are the backend's job. The only arithmetic allowed is the
   registry's declarative aggregations over ONE response (`sum`, `add`, `pct`, `count` of
   records) — each flagged `derived: true`, listed in §4 and tested.
4. **Missing ≠ zero.** A missing / null / non-numeric field is `null` and renders `—`.
   `|| 0` on an API value is a lint error. A genuine API `0` renders `0`.
5. **No silent fallbacks.** No demo data, no hardcoded figures, no substitute values.
   Request failure → error state with Retry. Contract error → banner naming the field.
6. **Latest response wins.** Data hooks sequence requests; a slower, older response is dropped.
   A filter whose period the API does not serve shows "not provided by the API" — never the
   previous period's numbers.
7. **Formatting only through `format.js`.** (`toLocaleString` in dashboard components is a lint error.)
8. **Every rendered value carries `data-metric="<registry id>"`** so tests read the real DOM.
9. **Drill-down lists are detail, not metrics.** School-wise modals may use other endpoints, load
   on demand, and must say so when their total differs from the API card.

## 3. Adding a new card / chart / metric — checklist

1. Identify the backend endpoint and field (Swagger: `/SchoolMentorSuperAdminAPI/swagger`). If the
   backend does not provide it, request it from the backend — do not compute it in React.
2. Add a registry entry in `dashboard/metrics.js` (`id`, `label`, `source`, `spec`, `format`).
   New endpoint? Add it to `SOURCES`, a service function, and a `validate…` function in `contract.js`.
3. Render it with `fmtX(values[id])` on an element with `data-metric={id}`.
4. Run `npm run test:dashboard` — the registry-completeness test fails until the element exists,
   and the API-vs-UI test compares it automatically. Add a spot-check with the literal fixture
   value if the field choice is non-obvious.
5. Run `npm run lint:dashboard` and `npm run verify:dashboard` (live) before merging.

## 4. Current metric map

Source A = `GET /SchoolMentorSuperAdminAPI/api/AHM_School_Progress/admin_dashboard` (no parameters; current month only).
Source B = `GET /SchoolMentorSuperAdminAPI/api/AHM_School_Progress/get_onelink_Report?fromDate&toDate`.

| Card / row | id | Source | Field | Derived |
|---|---|---|---|---|
| Previous Dues | `fee.prevDues` | A | Σ `CurrentMonthDetails[].PreviousAmount` | Σ rows |
| Fee Challan This Month | `fee.challan` | A | Σ `CurrentMonthDetails[].FeeChallan` | Σ rows |
| Fee Discount This Month | `fee.discount` | A | Σ `CurrentMonthDetails[].FeeDiscount` | Σ rows |
| Fee Challan After Discount | `fee.receivable` | A | Σ `CurrentMonthDetails[].Receivable` | Σ rows |
| Fee Received | `fee.received` | A | Σ `CurrentMonthDetails[].ReceivedAmount` | Σ rows |
| Total Pending | `fee.pending` | A | Σ `CurrentMonthDetails[].TotalPending` | Σ rows |
| Active Schools | `schools.active` | A | `ActiveSchools` | |
| Active Schools — new this month | `schools.newThisMonth` | A | `ThisMonthProgress.ERPSchools + .LaunchSetupSchools` | sum |
| ERP Schools / new | `schools.erp` / `schools.erpNew` | A | `ERP_Schools` / `ThisMonthProgress.ERPSchools` | |
| Launch Set-Up Schools / new | `schools.launch` / `schools.launchNew` | A | `LaunchSetup_Schools` / `ThisMonthProgress.LaunchSetupSchools` | |
| Active Login Schools | `schools.activeLogin` | A | `Active_Login_Schools` | |
| Inactive Schools (0 logins) | — | not provided | shows `—` | |
| Fully Trained / In Process | `onboarding.*` | A | `OnboardingStatus.FullyTrained` / `.InProcess` | |
| Onboarding % complete | `onboarding.pct` | A | round(FullyTrained / (FullyTrained + InProcess) × 100) | pct |
| Total Modules | — | not provided | shows `—` | |
| Students / Staff overall + new | `students.*`, `staff.*` | A | `TotalStudents.Overall/NewSignUp`, `TotalStaff.Overall/NewSignUp` | |
| Bug & Improvement cards (per period) | `bugs.*`, `improvements.*` | A | count of `Bugs[]` records by kind (`[Improvement]` tag), `IsSolved`, `Date` | count |
| Total Schools | `details.totalSchools` | A | `ActiveSchools + InActiveSchools` | sum |
| In Active / Active / Launch / ERP Schools | `details.*` | A | `InActiveSchools`, `ActiveSchools`, `LaunchSetup_Schools`, `ERP_Schools` | |
| Total Active Users | `details.totalUsers` | A | `TotalStudents.Overall + TotalStaff.Overall` | sum |
| Total Videos / categories | `videos.total`, rows | A | `TotalVideos`, `VideoCategories[].VideoCount` | |
| This Month Progress rows | `month.*` | A | `ThisMonthProgress.*`, `TotalStaff.NewSignUp`, `TotalStudents.NewSignUp` | |
| 1LINK totals (8 stats + margin) | `onelink.*` | B | `totals.totalTransactions`, `.totalCollection`, `.schoolsReceivingPayments`, `.totalEnabledSchools`, `.avgTransactionValue`, `.customerCharges`, `.providerPayable`, `.schoolMentorRevenue`, `.marginPerTxn` | |
| Successful Transactions | `onelink.successful` | B | count `transactions[]` with status Paid/Successful | count |

**Backend follow-ups** (so the derived rows above can become plain fields): fee totals for the
month, a `month`/`year` parameter on `admin_dashboard`, zero-login school count, ERP/Launch split
of login counts, onboarding % and total modules, a bug `kind` column, total schools/users.

## 5. Verification commands

```bash
npm run test:dashboard      # fixture-based API-vs-DOM suite (CI)
npm run lint:dashboard      # data-rule lint (CI)
npm run verify:dashboard    # LIVE: real API via dev server → dashboard-api-ui-report.md
```
