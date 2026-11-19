/* ════════════════════════════════════════════════════════════════════
   SUPER ADMIN — REST endpoint map (the .NET contract)

   Single source of truth for every path the frontend calls. The .NET
   backend implements a controller action per entry below. All paths are
   relative to the configured API base URL and assume a Bearer JWT.

   Conventions:
     • List endpoints accept ?search=&page=&pageSize= and SHOULD return a
       paged envelope { items, total, page, pageSize } (see API guide).
     • Mutations use POST (create), PUT (replace/update), DELETE (remove).
     • IDs are numbers in the demo; the backend may use GUIDs — the client
       treats them as opaque, so either works.
   ════════════════════════════════════════════════════════════════════ */

const ROOT = '/api/superadmin';

/* The LIVE .NET Super Admin API is hosted under its own application root
   (swagger: http://<host>:4100/SchoolMentorSuperAdminAPI/swagger/index.html,
   `servers: [{ url: "/SchoolMentorSuperAdminAPI" }]`), so every real path
   carries this prefix. Services prepend SA_ADMIN_API_BASE — empty in dev, so
   the request goes to our own origin and setupProxy.js forwards it. */
const SA_ROOT = '/SchoolMentorSuperAdminAPI';

export const EP = {

  /* ── 1LINK / 1Bill Transaction Monitoring ── */
  transactions: {
    list: () => `${ROOT}/transactions`,                             // ?from=&to=&month=&schoolId=&status=
    summary: () => `${ROOT}/transactions/summary`,                  // ?from=&to=&month=  -> network-wide KPIs
    schoolWise: () => `${ROOT}/transactions/school-wise`,           // ?from=&to=&month=  -> per-school breakdown
    rateConfig: () => `${ROOT}/transactions/rate-config`,           // GET / PUT { customerCharge, providerCost, effectiveFrom }
    report: () => `${ROOT}/transactions/report`,                    // ?from=&to=&month=  -> detailed transaction report (download)
    revenueReport: () => `${ROOT}/transactions/revenue-report`,     // ?from=&to=&month=  -> revenue report (download)
  },

  /* ── Auth (only needed for the standalone app; the host injects a token) ── */
  auth: {
    /* Super Admin ka apna sign-in — SchoolMentorSuperAdminAPI ke ANDAR:
         POST {base}/SchoolMentorSuperAdminAPI/api/Auth/login
         body: { user_Name, password }   (schema: MdlAHM_SuperAdmin_Login)
       Main ERP app ka /api/Auth/login is se ALAG route hai (ERP host par). */
    login: () => `${SA_ROOT}/api/Auth/login`,
    /* GET — saare Super Admin users:
         { success, count, data: [ { id, firstName, lastName, user_Name,
                                     signUpDateTime, isAdmin } ] }
       Screens ke "Assigned To" / "Select User" dropdowns isi se bharte hain,
       aur jahan API ko userId chahiye wahi `id` jata hai. */
    allUsers: () => `${SA_ROOT}/api/Auth/get-all-users`,
    /* POST — naya Super Admin user (User Management ▸ Add User):
         body: { firstName, lastName, user_Name, password, isAdmin }
         (schema: MdlAHM_SuperAdmin_Signup) */
    signup: () => `${SA_ROOT}/api/Auth/signup`,
    /* PUT — user edit: { id, firstName, lastName, user_Name, password, isAdmin }
       (SuperAdminUserUpdateRequest). password na bhejo to purana rehta hai. */
    updateUser: () => `${SA_ROOT}/api/Auth/update-user`,
    /* PUT — user band / chalu (body nahi). */
    deactivateUser: (id) => `${SA_ROOT}/api/Auth/deactivate-user/${encodeURIComponent(id)}`,
    activateUser:   (id) => `${SA_ROOT}/api/Auth/activate-user/${encodeURIComponent(id)}`,
    /* Screen × action permissions (User Permission ▸ Edit Permissions):
         POST save → { userID, modifiedBy, permissions:[{ menuName, subMenuName, action, isAccessable }] }
         GET  by user → 404 { success:false, "No permissions found for this user." } jab kuch save na ho */
    saveMenuPermissions: () => `${SA_ROOT}/api/Auth/save-superadmin-module-permission`,
    getAllMenuPermissions: () => `${SA_ROOT}/api/Auth/get-superadmin-module-permission`,
    getMenuPermissions:  (userId) => `${SA_ROOT}/api/Auth/get-superadmin-module-permission-byuserid/${encodeURIComponent(userId)}`,
  },

  /* ── Dashboard ── */
  dashboard: {
    get: () => `${ROOT}/dashboard`,                       // ?month=YYYY-MM
  },

  /* ── User Management ── */
  users: {
    list: () => `${ROOT}/users`,                          // ?search=&page=&pageSize=
    create: () => `${ROOT}/users`,
    update: (id) => `${ROOT}/users/${id}`,
    remove: (id) => `${ROOT}/users/${id}`,
    picture: (id) => `${ROOT}/users/${id}/picture`,       // multipart
    permissions: (id) => `${ROOT}/users/${id}/permissions`,
    assignments: (id) => `${ROOT}/users/${id}/assignments`,
  },

  /* ── Schools Progress (status / onboarding / enquiries / follow-ups) ── */
  schools: {
    list: () => `${ROOT}/schools`,                        // ?group=launch|erp|inactive
    get: (id) => `${ROOT}/schools/${id}`,
    setStatus: (id) => `${ROOT}/schools/${id}/status`,    // { active }
    followups: (id) => `${ROOT}/schools/${id}/followups`, // { kind, text }
    enquiries: (id) => `${ROOT}/schools/${id}/enquiries`,
    updateEnquiry: (id) => `${ROOT}/enquiries/${id}`,     // { status, ... }
  },

  /* ── Schools Payment — LIVE SchoolMentorSuperAdminAPI (see SA_ROOT).
     Poora AHM_School_Payments controller: setup, challan ledger aur receiving.
     Reports ka apna endpoint nahi — wo inhi teeno se bante hain. ── */
  payments: {
    /* POST — Payment Setup save (action: ADD | UPDATE | DELETE; INSERT bhi
       chalta hai magar record maujood ho to error deta hai, is liye ADD/UPDATE.
       Is route par GET NAHI hai — padhne ke liye summary() hai).
       body: Mdl_AHM_NetworkSchoolPaymentAction. */
    manage: () => `${SA_ROOT}/api/AHM_School_Payments/manage`,
    /* GET ?branchId=&type= — ek branch ka saved setup wapas (dono LAAZMI;
       type chhoot jaye to 400, record na ho to 404). */
    summary: () => `${SA_ROOT}/api/AHM_School_Payments/summary`,
    /* POST — challan (payment ledger): GET | INSERT | ADD | UPDATE | DELETE.
       GET branchID par filter karta hai aur rows ki list deta hai. */
    ledgerAction: () => `${SA_ROOT}/api/AHM_School_Payments/manage_payment_ledger`,
    /* GET — branchId CHHOR do to SAARI branches ke ledger rows ek call me
       (?challanType=Monthly&networkId=0). */
    ledgerList: () => `${SA_ROOT}/api/AHM_School_Payments/get_payment_ledger`,
    /* POST — fee receiving: wahi paanch actions, GET currentBranchID par. */
    receivingAction: () => `${SA_ROOT}/api/AHM_School_Payments/manage_payment_receiving`,

    /* ── One-Time Challans / Receiving — naye school signups ka ek dafa ka
       challan (AHM_School_Invoice). Monthly system se bilkul juda, apna
       controller set:
         • manage        POST — INSERT | UPDATE | DELETE | GET
                          body: MdlAHM_School_Invoice (ek hi row me challan +
                          receiving dono: school_Name, invoiceDate, challanDate,
                          isLumpSum, lumpSumAmount | totalStudent+pricePerStudent,
                          totalAmount, receivedAmount, method, receivedDate,
                          month, year, isActive). Method/ReceivedDate/ChallanDate/
                          InvoiceDate/School_Name [Required] — null kabhi nahi.
         • list          GET  ?month=&year= → { success, count, data:[ …rows ] }
         • receivePayment POST — { id, receivedAmount, receivedDate, method, modifiedBy }
         • resetPayment   POST /{id}?modifiedBy= — us row ki receiving saaf. */
    oneTimeManage: () => `${SA_ROOT}/api/AHM_School_Payments/one_time_chalan_manage`,
    oneTimeList: () => `${SA_ROOT}/api/AHM_School_Payments/one_time_chalan_list`,
    oneTimeReceive: () => `${SA_ROOT}/api/AHM_School_Payments/one_time_chalan_receive-payment`,
    oneTimeReset: (id) => `${SA_ROOT}/api/AHM_School_Payments/one_time_chalan_reset-payment/${id}`,
  },

  /* ── Billing Automation — global billing-auto setup (School Payment →
       Billing Automation → Save Changes).
         GET  /api/BillingAutoSetup            → current setup
         POST /api/BillingAutoSetup            body: BillingAutoSetupModel
           { id, billingAuto, billingDay, fallback, fallbackDate, invoiceSend,
             sendOffset, dueDate, gracePeriod, restrictionCutOff,
             restrictedAccess, restrictedMode, isActive } ── */
  billingAuto: {
    setup: () => `${SA_ROOT}/api/BillingAutoSetup`,
    /* POST ?date= (optional) → { generated, skipped, failed, errors[], challanIDs[] }.
       Is mahine ka challan pehle se ho to school "skipped" — do dafa dabana safe. */
    triggerGeneration: () => `${SA_ROOT}/trigger-auto-challan-generation`,
    /* GET active schedule (read-only; due field = dueDateAfterDays). 404 = not configured. */
    getActive: () => `${SA_ROOT}/get-billing-auto-setup`,
  },

  /* ── Billing Reminders (Hangfire backend — frontend sirf configure + dikhata
       hai, kuch schedule nahi karta). Routes API ROOT par hain (/api ke baghair),
       wahi jo swagger par trigger-auto-challan-generation ke hain.
         GET  /get-billing-reminder-settings   → { beforeDue, overdue, general }
         PUT  /save-billing-reminder-settings  body: same + updatedBy
         POST /send-due-reminders-now          → abhi bhejo (unpaid challans)
         GET  /get-billing-reminder-delivery-history ?pageNumber&pageSize&reminderType&branchId
                                               → { items[], totalCount }
       schedule/cancel-challan-notifications ab server par nahi hain — server har
       5 min unpaid challans khud check karta hai. ── */
  billingReminders: {
    getSettings: () => `${SA_ROOT}/get-billing-reminder-settings`,
    saveSettings: () => `${SA_ROOT}/save-billing-reminder-settings`,
    sendNow: () => `${SA_ROOT}/send-due-reminders-now`,
    history: () => `${SA_ROOT}/get-billing-reminder-delivery-history`,
  },

  /* ── School Permissions — LIVE SchoolMentorSuperAdminAPI (see SA_ROOT).
     Mirrors the controller exactly, per its swagger. The two toggle routes
     take their value as a QUERY parameter, not a body. ── */
  schoolPermissions: {
    /* GET — what the screen loads: every branch WITH its saved module
       permissions, as [ { branch: {...}, modulePermission: {...} | null } ]. */
    branchesWithPermissions: () => `${SA_ROOT}/api/SchoolPermissions/get-branches-with-permissions`,
    /* GET — branch directory only (no module flags); superseded by the above. */
    branches: () => `${SA_ROOT}/api/SchoolPermissions/get-branch`,
    /* GET — one branch's saved ModulePermission row. */
    modulePermission: (branchId) => `${SA_ROOT}/api/SchoolPermissions/module-permission/${branchId}`,
    /* POST — save every module flag for a branch in one ModulePermission body. */
    saveModulePermission: () => `${SA_ROOT}/api/SchoolPermissions/save-modulePermission`,
    /* PUT ?launchSetup=1|0 — the modal's "ERP Access" card. */
    toggleLaunchSetup: (branchId) => `${SA_ROOT}/api/SchoolPermissions/toggle-launch-setup/${branchId}`,
    /* PUT ?isActive=true|false — the modal's "Active Branch" card. */
    toggleBranchStatus: (branchId) => `${SA_ROOT}/api/SchoolPermissions/ToggleBranchStatus/${branchId}`,
    /* POST https://alphaapi.schoolmentor.ai/manage-mobileapp-permission
         { action: SAVE|GET|DELETE, id, branchID, chatType, mentorAI,
           parentAccess, etube, etubeView, etubeUpload } */
    mobileAppPermission: () => '/manage-mobileapp-permission',
    /* PUT — the older single-purpose launch-setup routes (toggle- replaces them). */
    enableLaunchSetup: (id) => `${SA_ROOT}/api/SchoolPermissions/enable-launch-setup/${id}`,
    disableLaunchSetup: (id) => `${SA_ROOT}/api/SchoolPermissions/disable-launch-setup/${id}`,
  },

  /* ── Network Permissions — LIVE SchoolMentorSuperAdminAPI.
     GET  /api/AHM_NetworkUsers → networks table.
     POST /api/AHM_NetworkUsers/update-isactive { network_ID, isActive }
          → modal ka "Active Network" card.
     POST /api/SchoolPermissions/network-permissions
          → chain module toggles (GET load, SAVE persist). ── */
  networkPermissions: {
    networks: () => `${SA_ROOT}/api/AHM_NetworkUsers`,
    updateIsActive: () => `${SA_ROOT}/api/AHM_NetworkUsers/update-isactive`,
    /* POST — chain portal module flags per network.
       body: Mdl_AHM_NetworkPermissionsAction
         { action: GET|SAVE, id, networkID, dashboard, academics,
           schoolPermisison, schoolProgress, schoolPAyments, operationlSOP,
           hr, accounts, attendance, inventory, training, userPermission } */
    manage: () => `${SA_ROOT}/api/SchoolPermissions/network-permissions`,
  },

  /* ── Schools Progress — LIVE SchoolMentorSuperAdminAPI.
     GET branch-report?isActive=&launchSetup= → har branch ka setup progress:
       { category, branchID, branchName, totalStaff, totalStudents, assignedTo,
         generalDetails{ principalName, principalPhone, totalStudents, totalStaff,
                         studentSignUp, staffSignUp, createdAt },
         stateDetails{ schoolTab, classTab, studentTab, departmentTab, staffTab,
                       syllabusTab, timeTableTab },
         compulsionDetails{ staffContact, subjectAssigned, parentContact,
                            previousDeus } }
     DONO query params LAAZMI hain — ek bhi chhoot jaye to API 0 rows deti hai.
     Screen ke teen tabs isi tarah banate hain:
       Launch Setup → isActive=true&launchSetup=0   (category "LaunchSetup School")
       ERP          → isActive=true&launchSetup=1   (category "ERP Schools")
       Inactive     → isActive=false (dono launchSetup) ── */
  schoolProgress: {
    branchReport: () => `${SA_ROOT}/api/AHM_School_Progress/branch-report`,
    /* GET  Dashboard ka poora overview EK call me (swagger par is route ka
       koi parameter nahi):
         { ActiveSchools, ERP_Schools, LaunchSetup_Schools, InActiveSchools,
           Active_Login_Schools,
           TotalStudents { Overall, NewSignUp }, TotalStaff { Overall, NewSignUp },
           OnboardingStatus { FullyTrained, InProcess },
           BugSummary { TotalBugs, ResolvedBugs, PendingBugs },
           Bugs [ { ID, BranchID, Module, Developer, BugDetail, Date, IsSolved } ],
           TotalVideos, VideoCategories [ { CategoryID, CategoryName, VideoCount } ],
           ThisMonthProgress { ERPSchools, LaunchSetupSchools },
           CurrentMonthDetails [ { SchoolName, PreviousAmount, FeeChallan,
                                   FeeDiscount, Receivable, ReceivedAmount,
                                   TotalPending } ] } */
    adminDashboard: () => `${SA_ROOT}/api/AHM_School_Progress/admin_dashboard`,
    /* GET ?fromDate=&toDate=&period= — 1LINK Overview ka poora report:
         { totals { totalTransactions, totalCollection, schoolsReceivingPayments,
                    totalEnabledSchools, avgTransactionValue, customerCharges,
                    providerPayable, schoolMentorRevenue, customerChargePerTxn,
                    providerCostPerTxn, marginPerTxn, fromDate, toDate },
           branches [ { schoolID, schoolName, totalTransactions, totalCollection,
                        providerPayable, customerCharges, schoolMentorRevenue } ],
           transactions [ { schoolID, schoolName, txnID, oneLinkRef, txnDate,
                            txnTime, studentName, admissionNo, feeType, amount,
                            status } ] }
       (schoolProgress.getOnelinkReport isi ko bulata tha, magar yeh route yahan
       likha hi nahi tha — call TypeError par gir kar poora section 0 dikhata tha.) */
    onelinkReport: () => `${SA_ROOT}/api/AHM_School_Progress/get_onelink_Report`,
    /* GET / PUT 1LINK transaction rates — Chain Management API on the SAME
       host as SA_API_HOST (sandbox / live switch). Pehle yeh do URL
       OneLinkSection me sandbox par hardcoded thay, is liye live build bhi
       sandbox ke rates padhta / likhta. */
    networkChargesGet: () => '/SchoolmentorChainManagementAPI/api/Network_Setup/GetCharges',
    networkChargesUpdate: () => '/SchoolmentorChainManagementAPI/api/Network_Setup/UpdateCharges',
    /* POST — Follow-up Card (Notes/Calls/Messages) aur Onboarding Card, dono
       ek hi route par; `headType` batata hai kaunsa card hai aur
       `subHeadType` uska sub-tab / module. */
    cardAction: () => `${SA_ROOT}/api/AHM_School_Progress/followup/onboarding-card-action`,
    /* POST — Training Card ki "School Participation Details".
       Wahi chaar actions: get | add | update | delete. */
    trainingAction: () => `${SA_ROOT}/api/AHM_School_Progress/training-session-action`,
    /* POST — ERP Schools ka "School Enquiries" (bug tracker) tab.
       body: { action, id, branchID, module, developer, bugDetail, date,
               isSolved, userId }
       `isSolved` hi tay karta hai bug kis list me jayega:
         false → Open (unsolved)   |   true → Resolved (solved)
       Wahi chaar actions: get | add | update | delete. */
    enquiryAction: () => `${SA_ROOT}/api/AHM_School_Progress/school-enquiries-bugs-action`,
    /* POST — "Assigned To" dropdown (Launch Setup + ERP Schools).
       body: { action, id, branchID, userID, launchSetup, isActive,
               createdBy, modifiedBy }
       Actions sirf teen hain: GET | UPSERT | DELETE (live check —
       "Invalid @Action value. Use GET, UPSERT, or DELETE."). UPSERT hi
       pehli baar insert aur baad me update, dono karta hai. */
    assignedUser: () => `${SA_ROOT}/api/AHM_School_Progress/manage_assignedUser`,
    /* POST /manage-usertimespend — ERP root path; host = SA_API_HOST (sandbox/live). */
    userTimeSpend: () => '/manage-usertimespend',
    /* POST /usertimespend-report — Monthly Progress. */
    userTimeSpendReport: () => '/usertimespend-report',
  },
  /* ── E-Tube — LIVE SchoolMentorSuperAdminAPI
     (swagger: .../Schoolmentorsuperadminapi/swagger/index.html).

     SOPs ki tarah dono routes POST hain aur kaam ek hi body ke `action` se
     tay hota hai: get | insert | update | delete.
       manage_categories → application/json     (camelCase fields)
       manage_videos     → multipart/form-data  (PascalCase + file fields)

     Reviews aur school-videos ki abhi koi API nahi hai — wo screens demo
     data par chalti hain (etubeData.js), is liye unke purane paths waise hi
     rakhe hain. ── */
  etube: {
    categories: () => `${SA_ROOT}/api/AHM_Etube/manage_categories`,
    videos: () => `${SA_ROOT}/api/AHM_Etube/manage_videos`,
    /* abhi backend me nahi — demo data */
    reviews: () => `${ROOT}/etube/reviews`,
    review: (id) => `${ROOT}/etube/reviews/${id}`,        // PUT { status }
    schoolVideos: () => `${ROOT}/etube/school-videos`,
    schoolVideo: (id) => `${ROOT}/etube/school-videos/${id}`,
  },

  /* ── Notifications ── */
  notifications: {
    list: () => `${ROOT}/notifications`,                  // ?audience=&type=&page=
    send: () => `${ROOT}/notifications`,
    update: (id) => `${ROOT}/notifications/${id}`,
    remove: (id) => `${ROOT}/notifications/${id}`,
    recipients: () => `${ROOT}/notifications/recipients`, // ?audience=&sub=&cls=&section=
  },

  /* ── Operational SOPs ── */
  /* ── Operational SOPs — LIVE SchoolMentorSuperAdminAPI.
     Teeno routes POST hain aur ek hi body me `action` se kaam tay hota hai:
     get | insert | update | delete. ── */
  sops: {
    /* Manual Heads (screen par "Category" / manual head) */
    manualHead: () => `${SA_ROOT}/api/AHM_School_SOPs/manual-head`,
    /* Ek manual head ke andar ke manuals */
    manualDetail: () => `${SA_ROOT}/api/AHM_School_SOPs/manual-detail`,
    /* Manual ke saath attached forms */
    manualForm: () => `${SA_ROOT}/api/AHM_School_SOPs/manual-form`,
  },

  /* ── School Agreements & Legal Documents ─────────────────────────
     ⚠ BACKEND PENDING — ye route live API par ABHI NAHI hai. Poora
     swagger check kiya gaya (SchoolMentorSuperAdminAPI ke 60 routes, ERP
     ke 644, Chain ke 86): per-school agreement/legal-document store kahin
     nahi. Jo endpoint banna hai uski poori spec — fields, actions,
     responses, file storage, validation — SCHOOL_AGREEMENTS_API_HANDOFF.md
     me hai.

     Shakal jaan-boojh kar AHM_School_SOPs/manual-detail jaisi rakhi hai:
     ek hi POST route, multipart/form-data, PascalCase fields aur ek
     `Action` (get | insert | update | delete) — taake backend par koi naya
     pattern na banana pare.

     get par BranchID = 0 ka matlab "poore network ke documents" hai; wo
     sirf module ke chaar summary cards bharta hai. ── */
  agreements: {
    documents: () => `${SA_ROOT}/api/AHM_School_Agreements/manage_documents`,
    /* School-level general comments (get | insert | delete) — BACKEND PENDING,
       spec: SCHOOL_AGREEMENTS_API_HANDOFF.md §11. */
    comments: () => `${SA_ROOT}/api/AHM_School_Agreements/manage_comments`,
  },

  /* ── Quiz Content ── */
  quiz: {
    classes: () => `${ROOT}/quiz/classes`,
    subjects: () => `${ROOT}/quiz/subjects`,              // ?classId=
    mcqs: () => `${ROOT}/quiz/mcqs`,                      // ?subjectId=
    mcq: (id) => `${ROOT}/quiz/mcqs/${id}`,
    bulkUpload: () => `${ROOT}/quiz/mcqs/bulk`,           // multipart (Excel)
  },

  /* ── Teachers Training ── */
  trainings: {
    list: () => `${ROOT}/trainings`,                      // ?status=upcoming|recorded
    create: () => `${ROOT}/trainings`,
    update: (id) => `${ROOT}/trainings/${id}`,
    remove: (id) => `${ROOT}/trainings/${id}`,
  },

  /* ── Tech Module — API README (TECH_TICKETS_API_README.md). One GET route
     (?action=…) and one multipart POST route per resource; the action is
     chosen with the `action` parameter. ── */
  techTickets: {
    base: () => `${SA_ROOT}/api/superadmin/tech-tickets`,
  },

  /* ── Tech Module — internal notifications (Release → Support handoff). ── */
  techNotifications: {
    base: () => `${SA_ROOT}/api/superadmin/tech-notifications`,
  },

  /* ── Mentor AI ── */
  mentor: {
    plans: () => `${ROOT}/mentor/plans`,
    plan: (id) => `${ROOT}/mentor/plans/${id}`,
    payments: () => `${ROOT}/mentor/payments`,
  },

  /* ── Registration — branch directory + branch CRUD. Ye routes MAIN ERP API
     par hain (superadmin root ke BAHAR), is liye services inhe ERP_API_BASE
     ke saath bulati hain; dev me src/setupProxy.js pehle se /api/Registration
     forward karta hai, is liye koi nayi proxy entry nahi chahiye.

     Sab live swagger par tasdeeq-shuda hain (ERP ke 644 routes, 2026-11-10) —
     koi endpoint farz nahi kiya gaya:

       old_MISDBBranch     purani MIS directory (880 rows, alag id space —
                           sirf Mentor AI use karta hai; school list ke liye
                           NAHI, warna duplicate/ghair-mutaliq records aate).
       get-all-branches    MOJOODA branch directory, poori (live: 346 rows).
                           Yehi superset hai — get-branches-with-permissions
                           323 aur branch-report 319 deta hai.
       get-branch/{id}     ek branch ki poori tafseel.
       signup              naya school: { password, branchName,
                           branchOwnerName, branchPhone } → branch + login
                           user. ERP ka apna SignupFlow bhi yehi chalata hai.
       register-branch     mukammal multipart create (Branch.* + LoginUser.* +
                           Employee.*) — abhi koi screen use nahi karti,
                           reference ke liye yahan likha hai.
       update-branch       PUT multipart, poora branch record (wahi field
                           list jo ERP ke src/tabs/SchoolTab.jsx bhejti hai).
       delete-branch/{id}  PERMANENT delete — wapas nahi aata. Screen pehle
                           hamesha ToggleBranchStatus (deactivate) deti hai. ── */
  registration: {
    branches: () => `/api/Registration/old_MISDBBranch`,
    allBranches: () => `/api/Registration/get-all-branches`,
    branch: (id) => `/api/Registration/get-branch/${id}`,
    signup: () => `/api/Registration/signup`,
    registerBranch: () => `/api/Registration/register-branch`,
    updateBranch: () => `/api/Registration/update-branch`,
    deleteBranch: (id) => `/api/Registration/delete-branch/${id}`,
  },

  /* ── AI / wallet (per-branch Mentor AI plan + subscription state). ── */
  wallet: {
    subscriptions: () => `/ai/api/wallet/admin/branches/subscriptions/`,
    subscription: (branchId) => `/ai/api/wallet/admin/branches/${branchId}/subscription/`,
    status: (branchId) => `/ai/api/wallet/admin/branches/${branchId}/status/`,
  },
};

export default EP;
