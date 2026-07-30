/* ════════════════════════════════════════════════════════════════════
   SUPER ADMIN — API barrel

   One import surface for the whole data layer. Components import services
   from here; the host app calls configureSuperAdmin() to point everything
   at the live .NET backend (see ./config and SUPERADMIN_API_GUIDE.md).
   ════════════════════════════════════════════════════════════════════ */

/* Runtime config + auth */
export {
  configureSuperAdmin,
  isMockMode,
  setSuperAdminToken,
  getSuperAdminToken,
  getSuperAdminIdentity,
  fileUrl,
  SA_API_BASE,
} from './config';

/* Low-level client */
export { ApiError, request, upload, buildQuery } from './client';
export { EP } from './endpoints';
export { useApi } from './useApi';

/* Domain services (namespaced) */
export * as dashboardApi from './services/dashboard';
export * as usersApi from './services/users';
export * as schoolsApi from './services/schools';
export * as paymentsApi from './services/payments';
export * as etubeApi from './services/etube';
export * as notificationsApi from './services/notifications';
export * as branchesApi from './services/branches';
export * as schoolPermissionsApi from './services/schoolPermissions';

/* Convenience direct exports for the most-used calls */
export { fetchDashboard } from './services/dashboard';
