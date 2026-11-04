# Dashboard API vs UI — live run 2026-11-04T10:45:21.072Z
API base: http://localhost:3001

### Inactive / Active Login — ERP | Launch Setup

Schools in directory: 314 · login checked: 314 · unchecked: 0

| Card | Category | Source (raw responses) | UI (rendered) | Result |
|---|---|---:|---:|---|
| Inactive Schools | ERP | 82 | 82 | PASS |
| Inactive Schools | Launch Setup | 103 | 103 | PASS |
| Active Login Schools | ERP | 116 | 116 | PASS |
| Active Login Schools | Launch Setup | 13 | 13 | PASS |

### Default view (Fee: This Month · Bugs/Improvements: All Time · 1LINK: This Month)

| Metric | API field | API value | UI value (rendered) | Result |
|---|---|---:|---:|---|
| Previous Dues | `Σ CurrentMonthDetails[].PreviousAmount` | 385416 | PKR 385,416.00 | PASS |
| Fee Challan This Month | `Σ CurrentMonthDetails[].FeeChallan` | 278343 | PKR 278,343.00 | PASS |
| Fee Discount This Month | `Σ CurrentMonthDetails[].FeeDiscount` | 0 | PKR 0.00 | PASS |
| Fee Challan After Discount | `Σ CurrentMonthDetails[].Receivable` | 663759 | PKR 663,759.00 | PASS |
| Fee Received | `Σ CurrentMonthDetails[].ReceivedAmount` | 0 | PKR 0.00 | PASS |
| Total Pending | `Σ CurrentMonthDetails[].TotalPending` | 663759 | PKR 663,759.00 | PASS |
| Active Schools | `ActiveSchools` | 313 | 313 | PASS |
| Active Schools — New this month | `ThisMonthProgress.ERPSchools + ThisMonthProgress.LaunchSetupSchools` | 3 | 3 | PASS |
| ERP Schools | `ERP_Schools` | 211 | 211 | PASS |
| ERP Schools — New this month | `ThisMonthProgress.ERPSchools` | 0 | 0 | PASS |
| Launch Set-Up Schools | `LaunchSetup_Schools` | 102 | 102 | PASS |
| Launch Set-Up Schools — New this month | `ThisMonthProgress.LaunchSetupSchools` | 3 | 3 | PASS |
| Fully Trained | `OnboardingStatus.FullyTrained` | 1 | 1 | PASS |
| In Process | `OnboardingStatus.InProcess` | 74 | 74 | PASS |
| % Complete | `round(OnboardingStatus.FullyTrained / (OnboardingStatus.FullyTrained + OnboardingStatus.InProcess) × 100)` | 1 | 1% | PASS |
| Total Students — Overall | `TotalStudents.Overall` | 39498 | 39,498 | PASS |
| Total Students — New Sign Up | `TotalStudents.NewSignUp` | 858 | 858 | PASS |
| Total Staff — Overall | `TotalStaff.Overall` | 3105 | 3,105 | PASS |
| Total Staff — New Sign Up | `TotalStaff.NewSignUp` | 539 | 539 | PASS |
| Total Bug(s) | `count(Bugs[] kind=bug, all)` | 6 | 6 | PASS |
| Total Resolved Bug(s) | `count(Bugs[] kind=bug, solved)` | 2 | 2 | PASS |
| Total Pending Bug(s) | `count(Bugs[] kind=bug, open)` | 4 | 4 | PASS |
| Total New Improvements | `count(Bugs[] kind=improvement, all)` | 1 | 1 | PASS |
| Total Completed Improvements | `count(Bugs[] kind=improvement, solved)` | 0 | 0 | PASS |
| Total Pending Improvements | `count(Bugs[] kind=improvement, open)` | 1 | 1 | PASS |
| Total Schools | `ActiveSchools + InActiveSchools` | 337 | 337 | PASS |
| In Active Schools | `InActiveSchools` | 24 | 24 | PASS |
| Active Schools | `ActiveSchools` | 313 | 313 | PASS |
| Launch Set-up Schools | `LaunchSetup_Schools` | 102 | 102 | PASS |
| ERP Schools | `ERP_Schools` | 211 | 211 | PASS |
| Total Active Users | `TotalStudents.Overall + TotalStaff.Overall` | 42603 | 42,603 | PASS |
| Total Staff | `TotalStaff.Overall` | 3105 | 3,105 | PASS |
| Total Students | `TotalStudents.Overall` | 39498 | 39,498 | PASS |
| Total Videos | `TotalVideos` | 2 | 2 | PASS |
| New Schools in Launch Set-Up Tab | `ThisMonthProgress.LaunchSetupSchools` | 3 | 3 | PASS |
| New Schools in ERP Tab | `ThisMonthProgress.ERPSchools` | 0 | 0 | PASS |
| Total New Staff Sign Up | `TotalStaff.NewSignUp` | 539 | 539 | PASS |
| Total New Student Sign Up | `TotalStudents.NewSignUp` | 858 | 858 | PASS |
| Total Transactions | `totals.totalTransactions` | 0 | 0 | PASS |
| Total Collection | `totals.totalCollection` | 0 | PKR 0.00 | PASS |
| Schools Receiving Payments | `totals.schoolsReceivingPayments` | 0 | 0 | PASS |
| Schools Receiving Payments — enabled | `totals.totalEnabledSchools` | 49 | 49 | PASS |
| Avg. Transaction Value | `totals.avgTransactionValue` | 0 | PKR 0.00 | PASS |
| Successful Transactions | `count(transactions[] where status = Paid)` | 0 | 0 | PASS |
| Customer Charges | `totals.customerCharges` | 0 | PKR 0.00 | PASS |
| Provider Payable | `totals.providerPayable` | 0 | PKR 0.00 | PASS |
| School Mentor Revenue | `totals.schoolMentorRevenue` | 0 | PKR 0.00 | PASS |
| Margin / txn | `totals.marginPerTxn` | 300 | PKR 300.00 | PASS |

### Fee Analytics — Last Month (not served by admin_dashboard → expected "—")

| Metric | API field | API value | UI value (rendered) | Result |
|---|---|---:|---:|---|
| Previous Dues | `Σ CurrentMonthDetails[].PreviousAmount` | — (null) | — | PASS |
| Fee Challan This Month | `Σ CurrentMonthDetails[].FeeChallan` | — (null) | — | PASS |
| Fee Discount This Month | `Σ CurrentMonthDetails[].FeeDiscount` | — (null) | — | PASS |
| Fee Challan After Discount | `Σ CurrentMonthDetails[].Receivable` | — (null) | — | PASS |
| Fee Received | `Σ CurrentMonthDetails[].ReceivedAmount` | — (null) | — | PASS |
| Total Pending | `Σ CurrentMonthDetails[].TotalPending` | — (null) | — | PASS |

### Bugs + Improvements — today

| Metric | API field | API value | UI value (rendered) | Result |
|---|---|---:|---:|---|
| Total Bug(s) | `count(Bugs[] kind=bug, all)` | 0 | 0 | PASS |
| Total Resolved Bug(s) | `count(Bugs[] kind=bug, solved)` | 0 | 0 | PASS |
| Total Pending Bug(s) | `count(Bugs[] kind=bug, open)` | 0 | 0 | PASS |
| Total New Improvements | `count(Bugs[] kind=improvement, all)` | 0 | 0 | PASS |
| Total Completed Improvements | `count(Bugs[] kind=improvement, solved)` | 0 | 0 | PASS |
| Total Pending Improvements | `count(Bugs[] kind=improvement, open)` | 0 | 0 | PASS |

### Bugs + Improvements — yesterday

| Metric | API field | API value | UI value (rendered) | Result |
|---|---|---:|---:|---|
| Total Bug(s) | `count(Bugs[] kind=bug, all)` | 0 | 0 | PASS |
| Total Resolved Bug(s) | `count(Bugs[] kind=bug, solved)` | 0 | 0 | PASS |
| Total Pending Bug(s) | `count(Bugs[] kind=bug, open)` | 0 | 0 | PASS |
| Total New Improvements | `count(Bugs[] kind=improvement, all)` | 0 | 0 | PASS |
| Total Completed Improvements | `count(Bugs[] kind=improvement, solved)` | 0 | 0 | PASS |
| Total Pending Improvements | `count(Bugs[] kind=improvement, open)` | 0 | 0 | PASS |

### Bugs + Improvements — thisMonth

| Metric | API field | API value | UI value (rendered) | Result |
|---|---|---:|---:|---|
| Total Bug(s) | `count(Bugs[] kind=bug, all)` | 0 | 0 | PASS |
| Total Resolved Bug(s) | `count(Bugs[] kind=bug, solved)` | 0 | 0 | PASS |
| Total Pending Bug(s) | `count(Bugs[] kind=bug, open)` | 0 | 0 | PASS |
| Total New Improvements | `count(Bugs[] kind=improvement, all)` | 0 | 0 | PASS |
| Total Completed Improvements | `count(Bugs[] kind=improvement, solved)` | 0 | 0 | PASS |
| Total Pending Improvements | `count(Bugs[] kind=improvement, open)` | 0 | 0 | PASS |

### Bugs + Improvements — lastMonth

| Metric | API field | API value | UI value (rendered) | Result |
|---|---|---:|---:|---|
| Total Bug(s) | `count(Bugs[] kind=bug, all)` | 0 | 0 | PASS |
| Total Resolved Bug(s) | `count(Bugs[] kind=bug, solved)` | 0 | 0 | PASS |
| Total Pending Bug(s) | `count(Bugs[] kind=bug, open)` | 0 | 0 | PASS |
| Total New Improvements | `count(Bugs[] kind=improvement, all)` | 0 | 0 | PASS |
| Total Completed Improvements | `count(Bugs[] kind=improvement, solved)` | 0 | 0 | PASS |
| Total Pending Improvements | `count(Bugs[] kind=improvement, open)` | 0 | 0 | PASS |

### Bugs + Improvements — all

| Metric | API field | API value | UI value (rendered) | Result |
|---|---|---:|---:|---|
| Total Bug(s) | `count(Bugs[] kind=bug, all)` | 6 | 6 | PASS |
| Total Resolved Bug(s) | `count(Bugs[] kind=bug, solved)` | 2 | 2 | PASS |
| Total Pending Bug(s) | `count(Bugs[] kind=bug, open)` | 4 | 4 | PASS |
| Total New Improvements | `count(Bugs[] kind=improvement, all)` | 1 | 1 | PASS |
| Total Completed Improvements | `count(Bugs[] kind=improvement, solved)` | 0 | 0 | PASS |
| Total Pending Improvements | `count(Bugs[] kind=improvement, open)` | 1 | 1 | PASS |

### 1LINK — Today (2026-11-04T00:00:00 → 2026-11-04T23:59:59)

| Metric | API field | API value | UI value (rendered) | Result |
|---|---|---:|---:|---|
| Total Transactions | `totals.totalTransactions` | 0 | 0 | PASS |
| Total Collection | `totals.totalCollection` | 0 | PKR 0.00 | PASS |
| Schools Receiving Payments | `totals.schoolsReceivingPayments` | 0 | 0 | PASS |
| Schools Receiving Payments — enabled | `totals.totalEnabledSchools` | 49 | 49 | PASS |
| Avg. Transaction Value | `totals.avgTransactionValue` | 0 | PKR 0.00 | PASS |
| Successful Transactions | `count(transactions[] where status = Paid)` | 0 | 0 | PASS |
| Customer Charges | `totals.customerCharges` | 0 | PKR 0.00 | PASS |
| Provider Payable | `totals.providerPayable` | 0 | PKR 0.00 | PASS |
| School Mentor Revenue | `totals.schoolMentorRevenue` | 0 | PKR 0.00 | PASS |
| Margin / txn | `totals.marginPerTxn` | 300 | PKR 300.00 | PASS |

### 1LINK — Yesterday (2026-11-03T00:00:00 → 2026-11-03T23:59:59)

| Metric | API field | API value | UI value (rendered) | Result |
|---|---|---:|---:|---|
| Total Transactions | `totals.totalTransactions` | 0 | 0 | PASS |
| Total Collection | `totals.totalCollection` | 0 | PKR 0.00 | PASS |
| Schools Receiving Payments | `totals.schoolsReceivingPayments` | 0 | 0 | PASS |
| Schools Receiving Payments — enabled | `totals.totalEnabledSchools` | 49 | 49 | PASS |
| Avg. Transaction Value | `totals.avgTransactionValue` | 0 | PKR 0.00 | PASS |
| Successful Transactions | `count(transactions[] where status = Paid)` | 0 | 0 | PASS |
| Customer Charges | `totals.customerCharges` | 0 | PKR 0.00 | PASS |
| Provider Payable | `totals.providerPayable` | 0 | PKR 0.00 | PASS |
| School Mentor Revenue | `totals.schoolMentorRevenue` | 0 | PKR 0.00 | PASS |
| Margin / txn | `totals.marginPerTxn` | 300 | PKR 300.00 | PASS |

### 1LINK — Last Month (2026-10-01T00:00:00 → 2026-10-31T23:59:59)

| Metric | API field | API value | UI value (rendered) | Result |
|---|---|---:|---:|---|
| Total Transactions | `totals.totalTransactions` | 10 | 10 | PASS |
| Total Collection | `totals.totalCollection` | -1440 | PKR -1,440.00 | PASS |
| Schools Receiving Payments | `totals.schoolsReceivingPayments` | 3 | 3 | PASS |
| Schools Receiving Payments — enabled | `totals.totalEnabledSchools` | 49 | 49 | PASS |
| Avg. Transaction Value | `totals.avgTransactionValue` | -144 | PKR -144.00 | PASS |
| Successful Transactions | `count(transactions[] where status = Paid)` | 10 | 10 | PASS |
| Customer Charges | `totals.customerCharges` | 5000 | PKR 5,000.00 | PASS |
| Provider Payable | `totals.providerPayable` | 1840 | PKR 1,840.00 | PASS |
| School Mentor Revenue | `totals.schoolMentorRevenue` | 3160 | PKR 3,160.00 | PASS |
| Margin / txn | `totals.marginPerTxn` | 300 | PKR 300.00 | PASS |

### 1LINK — This Month (2026-11-01T00:00:00 → 2026-11-30T23:59:59)

| Metric | API field | API value | UI value (rendered) | Result |
|---|---|---:|---:|---|
| Total Transactions | `totals.totalTransactions` | 0 | 0 | PASS |
| Total Collection | `totals.totalCollection` | 0 | PKR 0.00 | PASS |
| Schools Receiving Payments | `totals.schoolsReceivingPayments` | 0 | 0 | PASS |
| Schools Receiving Payments — enabled | `totals.totalEnabledSchools` | 49 | 49 | PASS |
| Avg. Transaction Value | `totals.avgTransactionValue` | 0 | PKR 0.00 | PASS |
| Successful Transactions | `count(transactions[] where status = Paid)` | 0 | 0 | PASS |
| Customer Charges | `totals.customerCharges` | 0 | PKR 0.00 | PASS |
| Provider Payable | `totals.providerPayable` | 0 | PKR 0.00 | PASS |
| School Mentor Revenue | `totals.schoolMentorRevenue` | 0 | PKR 0.00 | PASS |
| Margin / txn | `totals.marginPerTxn` | 300 | PKR 300.00 | PASS |

### API contract log

- **warning** `admin_dashboard → CurrentMonthDetails[17].FeeChallan`: negative amount (Beacon Public School)
- **warning** `admin_dashboard → CurrentMonthDetails[73].FeeChallan`: negative amount (Mughal's System)
- **warning** `admin_dashboard → CurrentMonthDetails[115].FeeChallan`: negative amount (The Future Professionals)
- **warning** `admin_dashboard → CurrentMonthDetails[120].FeeChallan`: negative amount (The Learning School)
- **warning** `get_onelink_Report → totals.totalCollection`: negative total collection

### Failed requests

- none
