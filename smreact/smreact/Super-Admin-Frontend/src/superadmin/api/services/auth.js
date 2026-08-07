/* Auth service — sign-in for the standalone Super Admin console.

   When this console is embedded in a host app the host injects a JWT via
   configureSuperAdmin({ token }) and no login screen is shown. Running on its
   own (the deployed /superadmin build) it needs its own sign-in, which is what
   this service backs.

   Mock mode (no API base URL configured — see isMockMode) accepts any
   non-empty credentials and hands back a demo session, exactly like the other
   services return demo data, so the whole screen is exercisable before the
   .NET endpoint exists. */
import { resolve, request } from '../client';
import EP from '../endpoints';

const DEMO_SESSION = {
  token: 'demo-super-admin-token',
  user: { id: 0, name: 'Super Admin', email: 'admin@schoolmentor.ai', role: 'superadmin' },
};

/**
 * POST /api/superadmin/auth/login
 * @param {{userName: string, password: string}} credentials
 * @returns {Promise<{token: string, user: {id, name, email, role}}>}
 * @throws {ApiError} 401 on bad credentials, 0 when the backend is unreachable.
 */
export const login = ({ userName, password }) =>
  resolve(
    () => ({ ...DEMO_SESSION, user: { ...DEMO_SESSION.user, name: userName || 'Super Admin' } }),
    () => request(EP.auth.login(), { method: 'POST', body: { userName, password } }),
  );

/** GET /api/superadmin/auth/me — validate a restored token on boot. */
export const me = () => resolve(() => DEMO_SESSION.user, () => request(EP.auth.me()));
