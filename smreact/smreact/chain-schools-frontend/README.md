# Chain Schools Frontend

Head-Office / Chain-Admin ERP frontend for **School Mentor** — a control panel for a franchise/chain of schools. Built with **React 19 + Vite**.

It currently runs entirely on **mock + localStorage data** so the whole UI works before any backend exists. The codebase is structured so the backend developer can drop in real **.NET API** calls module by module without touching the UI.

---

## Requirements

**Node.js 18.12+** — the build tooling is pinned to **Vite 5 + React Router 6**
so this app runs on the same Node 18 as the ERP and the other modules. Do **not**
bump Vite to 7/8 or React Router to 7: those require Node 20.19+/22.12+ and will
break on Node 18 (`CustomEvent is not defined` / missing `rolldown-binding`).

## Quick start

This app runs on its **own port (3002)** so it can run alongside the ERP
(3000) and the Super-Admin app — each is a standalone, separately-deployed app.

```bash
npm install
npm run dev        # http://localhost:3002  (dev server, HMR)
```

Other scripts:

```bash
npm run build      # production build → dist/
npm run preview    # preview the production build on :3002 (Vite)
npm run serve      # static-serve dist/ on :3002 (mirrors the deploy step)
npm run lint       # oxlint
```

Demo login: any email/password works while `VITE_USE_MOCK=true` (see below).

---

## Modules

Dashboard (executive analytics) · School Permissions · School Progress · School Payments · Operational SOPs · Teacher Trainings · Notifications · User Permissions · Accounts · Inventory · Human Resource · Attendance · **Academics** (Activity Calendar, Lesson Plans, Resource Library + Master/Sub release system) · Settings.

Cross-cutting features: Head-Office ↔ connected-school **view switcher** (view-only mode), **dark mode**, app-wide **tooltips**, per-module **tutorials**, branded **A4 PDF/Word reports**, full **responsive** layout, and a global **ErrorBoundary**.

---

## Environment

Config lives in `.env` (committed for convenience — it holds no secrets):

```ini
# API base URL the frontend calls. "/api" is proxied to the .NET backend in dev.
VITE_API_BASE_URL=/api

# While true, API services return local mock data (no network) so the UI works
# before the backend is connected. Flip to false once the .NET API is live.
VITE_USE_MOCK=true
```

The Vite dev proxy (`vite.config.js`) forwards `/api/*` to the .NET backend — **change the target to your Kestrel http/https port from `launchSettings.json`**:

```js
server: { proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true } } }
```

---

## Backend integration path (for the .NET developer)

The API layer is already scaffolded so wiring real endpoints is a contained, per-module job:

| File | Purpose |
| --- | --- |
| `src/api/client.js` | Shared **axios** instance: base URL, JWT bearer header, **401 → auto-logout**, error normalization. |
| `src/api/endpoints.js` | **Central registry** of every route (auth, dashboard, schools, payments, accounts, inventory, hr, attendance, academics, sops, trainings, notifications, user-permissions, settings). Point these at your real controllers. |
| `src/api/authApi.js` | Reference service showing the **mock/real dual-path** pattern, gated by `USE_MOCK`. |
| `src/config/env.js` | Reads `VITE_API_BASE_URL` and `VITE_USE_MOCK`. |

**To take a module live:**

1. Build the .NET controller for that module's routes (see `endpoints.js`).
2. In that module's data file (`src/pages/<Module>/data.js` or `src/config/*Store.js`), replace the `localStorage` read/write with `api.get/post(...)` using the shared client — keep the `USE_MOCK` fallback so the UI never breaks mid-migration.
3. Match the response shape the components expect (the mock data files document each shape).
4. Flip `VITE_USE_MOCK=false` for that environment.

Auth flow is already complete (`src/auth/`): login stores a JWT, every request sends `Authorization: Bearer …`, and a 401 clears the session and redirects to `/login`.

> **Note on Academics releases:** the release model (Master/Sub releases, content snapshots, validity, `selectedSchoolIds`, `appliesToAllSchools`, status ACTIVE/EXPIRED/ARCHIVED) is fully structured in `src/config/academicsStore.js`, so a member-school pull API can filter exactly what each school is allowed to pull.

---

## Project structure

```
src/
  api/          # axios client, endpoint registry, auth service (.NET-ready)
  auth/         # auth context, token storage, protected routes
  components/   # ErrorBoundary, GlobalTooltip, TutorialButton, shared bits
  config/       # env, nav, view switcher, dashboard + academics data/stores
  layouts/      # admin shell (sidebar, topbar, switcher)
  pages/        # one folder per module (Component + .css + data.js)
  routes/       # app routes
  styles/       # global tokens, admin shell, responsive layer
```

Design system = namespaced CSS custom properties (`--brand`, `--card`, `--t1`, …) with a `[data-theme="dark"]` override — reuse them to keep new UI consistent.

---

## Going to production

1. Set `VITE_API_BASE_URL` to the deployed API URL and `VITE_USE_MOCK=false`.
2. `npm run build` → deploy the static `dist/`. To serve it standalone on its own
   port (like the Super-Admin app): `npm run serve` runs `serve -s dist -l 3002`
   with SPA fallback to `index.html`. Behind nginx instead, point a server block
   at `dist/` with `try_files $uri /index.html;` — pick a distinct port per app.
3. Configure the API/CORS to allow the deployed frontend origin.
