# Super Admin — .NET API Integration Guide

How to connect the React **Super Admin** app (`#superadmin`) to a .NET backend.
The frontend already ships a complete API layer under `src/superadmin/api/`. Until
a base URL is configured it runs in **mock mode** (bundled demo data), so the UI
works with zero backend. Point it at your .NET host and the same components call
real endpoints — no component rewrites required.

---

## 1. Architecture

```
src/superadmin/api/
  config.js        runtime config + configureSuperAdmin() + isMockMode()
  client.js        fetch wrapper (request/upload), ApiError, mock() / resolve()
  endpoints.js     EP — every REST path the frontend calls (the contract)
  useApi.js        useApi(fetcher) → { data, loading, error, reload }
  index.js         barrel: import { usersApi, fetchDashboard, ... } from './api'
  services/        one module per domain (dashboard, users, schools, payments,
                   etube, notifications) — each method does:
                     resolve(() => DEMO_DATA, () => request(EP.x.y()))
```

Every service method picks **mock vs live** automatically via `resolve(...)`:
- **mock mode** → returns the bundled demo data (deep-cloned) after a short delay.
- **live mode** → calls the .NET endpoint with the Bearer JWT attached.

This mirrors the existing **Support** module (`src/support/config.js` + `api.js`)
so there is one mental model for the whole app.

---

## 2. Turning on the live backend

Either is enough — pick whichever fits your hosting:

**A. Build-time env** (standalone CRA dev/build) — copy `.env.example` → `.env`:
```
REACT_APP_SA_API=https://your-dotnet-host
REACT_APP_SA_TOKEN=<optional dev JWT>
```

**B. Runtime injection** (embedded in the .NET MVC / ERP host) — the host page
calls one function after the bundle loads, passing the URL + the JWT it already
has, so there is **no second login and no hardcoded URL**:
```js
import { configureSuperAdmin } from 'src/superadmin/api';

configureSuperAdmin({
  apiBaseUrl: 'https://your-dotnet-host',
  token: '<bridge JWT>',
  role: 'SuperAdmin', userId: 42, name: 'Admin', email: 'admin@schoolmentor.app',
  onAuthError: () => location.assign('/login'),   // optional 401 handler
});
```

`isMockMode()` returns `false` as soon as a base URL is set (override with
`REACT_APP_SA_USE_MOCK=true|false` or `configureSuperAdmin({ useMock })`).

---

## 3. Conventions the backend must follow

- **Base path:** every route is `<apiBaseUrl>/api/superadmin/...` (see `endpoints.js`).
- **Auth:** `Authorization: Bearer <jwt>` on every request. Return **401** to trigger
  the `onAuthError` hook.
- **Errors:** return ASP.NET Core **ProblemDetails** (`application/problem+json`).
  The client surfaces `detail` or `title` as the error message; non-2xx throws
  `ApiError { status, problem }`. A network failure / CORS block surfaces as
  `status: 0`.
- **Empty bodies:** `204 No Content` is fine for deletes/updates.
- **CORS:** allow the frontend origin + `Authorization` header.
- **Pagination:** list endpoints accept `?search=&page=&pageSize=`. Prefer an
  envelope `{ items: [...], total, page, pageSize }`. (The demo returns bare
  arrays; if you return an envelope, adjust the one service mapping or have the
  service read `res.items` — noted per-endpoint below.)
- **IDs:** opaque to the client (number or GUID both work).
- **Files:** uploads are `multipart/form-data`; return stored paths as
  `/files/...` and the client resolves them via `fileUrl()`.

---

## 4. Endpoint contract

All paths relative to `<apiBaseUrl>`. Shapes below match the demo seed objects in
`src/superadmin/*Data.js` — use them as the DTO blueprint.

### Dashboard
| Method | Path | Returns |
|---|---|---|
| GET | `/api/superadmin/dashboard?month=YYYY-MM` | `DashboardDto` |

`DashboardDto` (see `dashboardData.js > buildDashboard`):
```jsonc
{
  "schools":   { "total":23,"erp":10,"launch":9,"inactive":4,"active":19,
                 "activeLogin":10,"newLaunch":7,"newErp":0 },
  "onboarding":{ "totalModules":15,"fullyTrained":1,"inProcess":8,"pct":61 },
  "students":  { "total":68231,"newSignup":34 },
  "staff":     { "total":5855,"newSignup":30 },
  "feeRows":   [ { "id":201,"name":"...","prevDues":0,"challan":3000,
                   "discount":0,"receivable":3000,"received":0,"pending":3000 } ],
  "feeTotals": { "prevDues":0,"challan":569948,"discount":0,
                 "receivable":569948,"received":0,"pending":442096 },
  "videos":    { "total":16,"ho":10,"school":6,
                 "byCat":{ "School Mentor":2,"Science":3,"Technology":2 } },
  "bugs":      { "total":6,"resolved":4,"pending":2 },
  "improvements":{ "total":0,"completed":0,"pending":0 }
}
```

### User Management
| Method | Path | Body / Notes |
|---|---|---|
| GET | `/users?search=&page=&pageSize=` | → `User[]` (or paged envelope) |
| POST | `/users` | `{ fullName, userName, phone, address, password, active }` |
| PUT | `/users/{id}` | partial `User` patch |
| DELETE | `/users/{id}` | — |
| POST | `/users/{id}/picture` | multipart `file` |
| GET / PUT | `/users/{id}/permissions` | `{ menus: string[] }` |
| GET / PUT | `/users/{id}/assignments` | `{ schoolIds: number[] }` |

`User`: `{ id, fullName, userName, phone, address, password, active, pic }`.
Permission menu strings (`UM_MENUS`): `Dashboard, Uploader, Category,
School Permissions, School Progress, School Payments, Operational SOPs,
User Registration, User Assignment`. **These drive the dashboard's permission
gating**, so the values must round-trip exactly.

### Schools Progress
| Method | Path | Notes |
|---|---|---|
| GET | `/schools?group=launch\|erp\|inactive` | omit `group` → `{ launch, erp, inactive }` |
| GET | `/schools/{id}` | school detail (follow-ups, onboarding, activity) |
| PUT | `/schools/{id}/status` | `{ active: bool }` |
| POST | `/schools/{id}/followups` | `{ kind: note\|call\|message, text }` |
| GET / POST | `/schools/{id}/enquiries` | enquiry (bug) list / create |
| PUT | `/enquiries/{id}` | `{ status: open\|resolved, ... }` |

School fields: `{ id, name, principal, contact, staff, students, stuSignup,
staffSignup, signupDate, status, onboarding:{completed,total}, logins, ... }`
(see `statusData.js`).

### Schools Payment
| Method | Path | Notes |
|---|---|---|
| GET | `/payments/schools` | `PaySchool[]` |
| GET / PUT | `/payments/setup/{schoolId}` | billing setup |
| GET / POST | `/payments/challans?month=` | list / generate one |
| POST | `/payments/challans/bulk` | `{ schoolIds:[], month, ... }` |
| POST | `/payments/receiving` | record a payment |
| GET | `/payments/report?month=` | monthly report rows |

Setup: `{ formula: lumpsum\|perstudent, lumpAmount, perStudentRate,
studentCount, freeTrial, trialDays, notes }` (see `paymentData.js`).

### School Permissions (per-school module toggles)
| Method | Path |
|---|---|
| GET / PUT | `/school-permissions/{schoolId}` |

### E-Tube
| Method | Path | Notes |
|---|---|---|
| GET / POST | `/etube/videos` | POST is multipart (`file` + meta) |
| PUT / DELETE | `/etube/videos/{id}` | |
| GET / POST | `/etube/categories` | |
| PUT / DELETE | `/etube/categories/{id}` | |
| GET | `/etube/reviews` | school review queue |
| PUT | `/etube/reviews/{id}` | `{ status: Approved\|Rejected, note }` |
| GET / PUT / DELETE | `/etube/school-videos[/{id}]` | `{ status }` on PUT |

### Notifications
| Method | Path | Notes |
|---|---|---|
| GET | `/notifications?audience=&type=&page=` | sent history |
| POST | `/notifications` | send (audience, sub, cls, section, title, body, type) |
| PUT / DELETE | `/notifications/{id}` | |
| GET | `/notifications/recipients?audience=&sub=&cls=&section=` | `{ count }` |

### SOPs · Quiz · Trainings · Mentor AI
Endpoints are defined in `endpoints.js` (`EP.sops`, `EP.quiz`, `EP.trainings`,
`EP.mentor`). They follow the identical CRUD pattern; demo shapes live in
`sopData.js`, `quizData.js`, `trainingsData.js`, `mentorData.js`. Add a service
file for each when you wire those screens (see §5).

---

## 5. Wiring a module to live data

Two-step pattern (the Dashboard already does this — see `Dashboard.jsx`):

**1. Service method** — already provided for the six core modules. For a new one:
```js
// api/services/trainings.js
import { resolve, request } from '../client';
import EP from '../endpoints';
import { INITIAL_TRAININGS } from '../../trainingsData';
export const listTrainings = (status) =>
  resolve(() => INITIAL_TRAININGS, () => request(EP.trainings.list(), { query: { status } }));
```

**2. Consume it in the component** with `useApi`:
```js
import { useApi, usersApi } from './api';
const load = useCallback(() => usersApi.listUsers({ search }), [search]);
const { data: users, loading, error, reload } = useApi(load);
```
For mutations, call the service then `reload()` (or `setData` optimistically):
```js
await usersApi.createUser(form);
reload();
```

Because services already fall back to demo data, you can flip modules to live
**one at a time** without breaking the others.

---

## 6. QA

- `npm test` (or `CI=true npx react-scripts test`) runs the smoke + gating suite
  in `src/superadmin/SuperAdminShell.test.js` (boots on Dashboard, renders every
  module, verifies permission gating) plus `src/App.test.js`.
- `CI=false npx react-scripts build` must report **Compiled successfully**.
- All current checks pass: **8/8 tests green, clean build.**
