# Super Admin — School Permissions API Handoff

**Purpose of this document:** hand this to whoever reviews the backend API zip.
It describes **exactly** what the Super-Admin frontend calls, the request/response
shapes it expects, and the current production bug — so you can tell whether a
change is needed **in the API (backend)**, **in the frontend**, or **only in
deployment**.

- **App:** Super-Admin frontend (Create React App), module **School Permissions**
- **Backend:** `SchoolMentorSuperAdminAPI` (its own IIS application root)
- **Swagger:** `http://50.190.164.42:4100/SchoolMentorSuperAdminAPI/swagger/index.html`
- **Frontend files referenced below:**
  - `src/superadmin/api/config.js` (base URLs)
  - `src/superadmin/api/endpoints.js` (paths)
  - `src/superadmin/api/services/schoolPermissions.js` (request/response mapping)
  - `src/superadmin/SchoolPermissions.jsx` (the screen)

---

## 0. TL;DR — the current production problem

On the deployed site `http://50.190.164.42:4105/`, the School Permissions screen
shows **static/demo data**. DevTools → Network shows:

```
Request URL:  http://50.190.164.42:4105/SchoolMentorSuperAdminAPI/api/SchoolPermissions/get-branches-with-permissions
Status:       404 Not Found
```

**This is a DEPLOYMENT/BUILD issue, not an API change.** The request is going to
`:4105` (the site itself) instead of `:4100` (where the API lives). That happens
because the build deployed there is an **old build** where the API base URL was
empty, so the call resolves relative to the page origin.

- **Fix already applied in the frontend:** `.env.production` now sets
  `REACT_APP_SA_ADMIN_BASE=http://50.190.164.42:4100`, and a fresh build was
  produced (`build/static/js/main.cd3921c8.js`). The old deployed bundle was
  `main.a2fa6db4.js`.
- **Action required:** deploy the **new** `build/` folder to `:4105`, replacing the
  old files. After that, the request goes to
  `http://50.190.164.42:4100/SchoolMentorSuperAdminAPI/api/SchoolPermissions/get-branches-with-permissions`.

If, after deploying the new build, the request reaches `:4100` but still fails,
use the checklists in sections 5–6 to decide whether it's a **backend** or
**frontend** change.

---

## 1. How the frontend builds the URL

```
FULL URL = SA_ADMIN_API_BASE  +  SA_ROOT  +  <endpoint path>
```

- `SA_ADMIN_API_BASE` = `process.env.REACT_APP_SA_ADMIN_BASE || ''`
  - **Dev (`npm start`):** empty → relative path → forwarded by `src/setupProxy.js`
    (dev-only proxy) to the real backend. **Works in dev.**
  - **Production build:** MUST be `http://50.190.164.42:4100` (set in
    `.env.production`). Empty here = 404 (there is no dev proxy in a build).
- `SA_ROOT` = `/SchoolMentorSuperAdminAPI`

> ⚠️ CRA bakes `REACT_APP_*` variables in **at build time**. Any change to
> `.env.production` requires a **rebuild** (`npm run build`) and redeploy.

---

## 2. Endpoints the School Permissions screen uses

Base for all of these in production: `http://50.190.164.42:4100/SchoolMentorSuperAdminAPI`

| # | When | Method | Path | Notes |
|---|------|--------|------|-------|
| 1 | Screen load (fills the table) | `GET` | `/api/SchoolPermissions/get-branches-with-permissions` | **Primary.** Returns branches + their saved module permissions. |
| 2 | Legacy branch list (fallback mapping) | `GET` | `/api/SchoolPermissions/get-branch` | Branch directory only, no module flags. |
| 3 | (Available) single branch modules | `GET` | `/api/SchoolPermissions/module-permission/{branchId}` | 404 here means "no saved row" → treated as all-modules-ON. |
| 4 | Modal "Save Permissions" (step 1) | `POST` | `/api/SchoolPermissions/save-modulePermission` | Body = module flags (section 3.2). |
| 5 | Modal "Save Permissions" (step 2) — ERP Access | `PUT` | `/api/SchoolPermissions/toggle-launch-setup/{branchId}?launchSetup=1\|0` | Value is **int** 1/0. Empty JSON body `{}` sent (avoids IIS 411). |
| 6 | Modal "Save Permissions" (step 3) — Active Branch | `PUT` | `/api/SchoolPermissions/ToggleBranchStatus/{branchId}?isActive=true\|false` | Value is **bool**. Empty JSON body `{}` sent. |
| 7 | (Defined, not on the main flow) | `GET` | `/api/SchoolPermissions/enable-launch-setup/{id}` , `/disable-launch-setup/{id}` | Present in `endpoints.js`; verify if still expected. |

**Auth:** if a bearer token is available it is sent as `Authorization: Bearer <token>`.
In the standalone app it is usually **absent** (null). Tell us if these endpoints
**require** auth — if so, the standalone build needs a token wired in.

---

## 3. Request / response contracts (verify the API against these)

The frontend is deliberately tolerant of camelCase/PascalCase and of a few field
aliases. Below, "reads" = names it will accept (first match wins).

### 3.1 GET `get-branches-with-permissions` — response

Expected: a **bare JSON array** (also accepts `{ data: [...] }` or `{ result: [...] }`):

```jsonc
[
  {
    "branch": {
      "id": 201,                     // reads: id | branchID | branchId   (REQUIRED — row skipped if missing)
      "name": "AES School System",   // reads: name | branchName | schoolName
      "branchCode": "000201",        // reads: branchCode | schoolCode | code
      "branchOwner": "AES Admin",    // reads: branchOwner | principal | ownerName | owner
      "branchPhone": "03001234001",  // reads: branchPhone | contact | phone | mobile
      "launchSetup": true,           // reads: launchSetup | erpAccess  → "ERP Access" toggle/pill
      "isActive": true,              // reads: isActive | active         → "Active Branch"
      "branchEmail1": "a@b.com",     // reads: branchEmail1 | branchEmail | email
      "address": "…",
      "academicSession": "2025-26",  // reads: academicSession
      "description": "…",
      "branchLogo": "…"
    },
    "modulePermission": {            // may be null → means "no saved row" → ALL modules ON
      "branchID": 201,
      "academics": true,
      "examination": true,
      "paperGenerator": false,
      "attendance": true,
      "timeTable": true,
      "fee": true,
      "accounts": true,
      "inventory": false,
      "admissionCRM": false,
      "students": true,
      "humanResource": true,
      "staffAppraisals": false,
      "schoolSOPs": false,
      "teacherTrainings": false,
      "auditLogs": true,
      "settings": true,
      "userPermissions": true
    }
  }
]
```

- `modulePermission: null` is valid and means **all modules ON** (unconfigured
  branch = unrestricted, matching ERP behaviour).
- Boolean flags may arrive as `true/false`, `1/0`, `"1"/"0"`, `"true"/"false"`,
  `"Y"/"N"`, `"active"/"inactive"` — all coerced.

### 3.2 POST `save-modulePermission` — request body the frontend sends

```jsonc
{
  "branchID": 201,
  "createdBy": 0,        // super-admin userId if known, else 0
  "modifiedBy": 0,
  "academics": true,
  "examination": true,
  "paperGenerator": false,
  "attendance": true,
  "timeTable": true,
  "fee": true,
  "accounts": true,
  "inventory": false,
  "admissionCRM": false,
  "students": true,
  "humanResource": true,
  "staffAppraisals": false,
  "schoolSOPs": false,
  "teacherTrainings": false,
  "auditLogs": true,
  "settings": true,
  "userPermissions": true
}
```

### 3.3 UI module key → API field name (must match the DTO exactly)

| UI key | API field (sent/read) |
|---|---|
| academics | `academics` |
| examination | `examination` |
| papergenerator | `paperGenerator` |
| attendance | `attendance` |
| timetable | `timeTable` |
| fee | `fee` |
| accounts | `accounts` |
| inventory | `inventory` |
| admissioncrm | `admissionCRM` |
| students | `students` |
| hr | `humanResource` |
| staffappraisals | `staffAppraisals` |
| schoolsops | `schoolSOPs` |
| teachertrainings | `teacherTrainings` |
| auditlogs | `auditLogs` |
| settings | `settings` |
| userpermissions | `userPermissions` |

> If the backend DTO renames any of these, EITHER rename it back to match this
> table (backend change) OR tell us and we update `MODULE_API_FIELD` /
> `MODULE_ALIAS` in `schoolPermissions.js` (frontend change).

### 3.4 PUT toggles

- `PUT /toggle-launch-setup/{branchId}?launchSetup=1` (on) / `?launchSetup=0` (off) — **int**
- `PUT /ToggleBranchStatus/{branchId}?isActive=true` / `?isActive=false` — **bool**
- Both carry an **empty JSON body `{}`** on purpose (a body-less PUT returns
  `411 Length Required` on IIS). Value is in the **query string**, not the body.

---

## 4. How the screen behaves on error (why it looks like "old/static data")

`SchoolPermissions.jsx`:

```js
try {
  const { schools, permMap } = await schoolPermissionsApi.listPermissionBranches();
  setSchools(schools); setPermMap(permMap);
} catch (err) {
  setSchools(SCHOOLS);   // ← bundled DEMO data as a fallback so the UI is never empty
}
```

So **any** failed request (404, CORS, 500, network) silently shows demo data.
That is why a broken API call looks like "the APIs aren't working / it shows
static data."

---

## 5. Checklist — is a BACKEND (API) change needed?

Deploy the new build first (section 0), then on `:4100` verify:

- [ ] `GET …/get-branches-with-permissions` returns **200** and an **array** (or `{data:[]}`/`{result:[]}`).
- [ ] Each item has a `branch` object with an **id** (`id`/`branchID`) — items without an id are dropped.
- [ ] `branch.launchSetup` and `branch.isActive` are present (drive ERP Access / Active pills).
- [ ] `modulePermission` uses the field names in **section 3.3** (or is `null`).
- [ ] `POST save-modulePermission` accepts the body in **section 3.2** and returns 2xx.
- [ ] `PUT toggle-launch-setup/{id}?launchSetup=1|0` returns 2xx (int param).
- [ ] `PUT ToggleBranchStatus/{id}?isActive=true|false` returns 2xx (bool param).
- [ ] **CORS:** the API allows the origin that serves the build (`http://50.190.164.42:4105`).
      A cross-origin browser call from :4105 → :4100 needs `:4105` in the CORS allow-list.
- [ ] **Auth:** do these endpoints require a bearer token? (The standalone app may not send one.)

If any bullet fails → **backend change** (or tell us the real shape and we adapt the frontend).

## 6. Checklist — is a FRONTEND change needed?

- [ ] Deployed bundle is the **new** one (`main.cd3921c8.js`, not `main.a2fa6db4.js`).
- [ ] Network request goes to **`:4100/SchoolMentorSuperAdminAPI/...`** (not `:4105/...`).
- [ ] `.env.production` contains `REACT_APP_SA_ADMIN_BASE=http://50.190.164.42:4100`.
- [ ] If the API host/port changes → update `REACT_APP_SA_ADMIN_BASE` and rebuild.
- [ ] If field names / response envelope differ from section 3 → update
      `branchToSchoolPerm` / `MODULE_API_FIELD` / `MODULE_ALIAS` in
      `src/superadmin/api/services/schoolPermissions.js`.

---

## 7. What to send back after reviewing the API zip

Please report, per endpoint:
1. Exact **method + path** as implemented (any rename vs section 2?).
2. A **real sample response** for `get-branches-with-permissions` (one item is enough).
3. The **DTO field names** for `modulePermission` (compare to section 3.3).
4. Whether **auth** is required, and the **CORS** allow-list.

With that, we can say definitively: "backend matches, only redeploy needed", or
"backend field X renamed → change here", or "frontend mapping needs update".
