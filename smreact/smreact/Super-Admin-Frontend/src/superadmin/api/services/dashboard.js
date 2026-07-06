/* Dashboard service — platform overview. */
import { resolve, request } from '../client';
import EP from '../endpoints';
import { buildDashboard, REF_MONTH } from '../../dashboardData';

/** GET /api/superadmin/dashboard?month=YYYY-MM → DashboardDto (see API guide). */
export const fetchDashboard = (month = REF_MONTH) =>
  resolve(
    () => buildDashboard(),
    () => request(EP.dashboard.get(), { query: { month } }),
  );
