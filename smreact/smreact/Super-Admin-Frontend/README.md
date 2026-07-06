# School Mentor — Super Admin Frontend

Self-contained **Super Admin** console for School Mentor, built with React
(Create React App). This is a standalone repository — it is **not** part of the
school ERP frontend.

## What's inside

A full admin surface with these modules:

- **Dashboard** — platform overview, derived live from the other modules, with a
  permission-aware "Viewing as" preview.
- **E-Tube**, **School Permissions**, **Schools Progress**, **Schools Payment**,
  **Operational SOPs**, **Mentor AI**, **Customer Support**, **Teachers Training**,
  **Quiz Content**, **Notifications**, **User Management**.
- App-wide **tooltips** and persistent **dark mode** (including the embedded
  Support console).

The **Customer Support** console is also available full-screen at the `#agent`
route. It can talk to the SignalR support backend; otherwise it runs on demo data.

## Run

```bash
npm install
npm start            # http://localhost:3000  → Super Admin app
npm test             # smoke + permission-gating suite
npm run build        # production build
```

## Connecting the .NET backend

The app ships an API layer under `src/superadmin/api/`. With no API base URL set
it runs in **mock mode** (bundled demo data), so it works with zero backend.
Point it at the .NET host to go live — see **[SUPERADMIN_API_GUIDE.md](./SUPERADMIN_API_GUIDE.md)**
and copy `.env.example` → `.env`:

```
REACT_APP_SA_API=https://your-dotnet-host
```

The host app can also inject the API URL + bridge JWT at runtime via
`configureSuperAdmin({ apiBaseUrl, token })` — no second login, no hardcoded URL.

## Structure

```
src/
  App.js                 hash routing (Super Admin / #agent support console)
  superadmin/            the Super Admin app
    SuperAdminShell.jsx  host shell (sidebar, theme, routing)
    *.jsx / *Data.js     one component + demo data per module
    saStyles.js          scoped design system (.sa-root) — light + dark
    api/                 config, client, endpoints, services, useApi
  components/            AgentSupport / AgentOverview (support console)
  support/               support data hooks, realtime, config
```
