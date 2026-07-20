import api from './client'
import { ENDPOINTS } from './endpoints'
import { USE_MOCK } from '../config/env'

/* ═══════════════════════════════════════════════════════════════════
   AUTH service — the only place that knows the login/me/logout routes.

   Each function has two paths:
     • USE_MOCK=true  → returns local demo data (no network) so the UI
       works before the .NET API exists.
     • USE_MOCK=false → calls the real endpoint via the shared axios
       client. Adjust the response mapping to match your API's shape.
   ═══════════════════════════════════════════════════════════════════ */

const MOCK_USER = {
  id: 1,
  name: 'Demo Admin',
  email: 'admin@schoolchain.app',
  role: 'ChainAdmin',
}
const wait = (ms = 450) => new Promise((r) => setTimeout(r, ms))

/* Returns { token, user }. */
export async function login({ email, password }) {
  if (USE_MOCK) {
    await wait()
    if (!email || !password) {
      throw { status: 400, message: 'Email and password are required.' }
    }
    return { token: 'mock-jwt-token', user: { ...MOCK_USER, email } }
  }
  const { data } = await api.post(ENDPOINTS.auth.login, { email, password })
  // .NET often returns { token | accessToken, user }. Normalise here.
  return { token: data.token ?? data.accessToken, user: data.user ?? data }
}

/* Returns the current user (used to restore the session on reload). */
export async function fetchMe() {
  if (USE_MOCK) {
    await wait(200)
    return MOCK_USER
  }
  const { data } = await api.get(ENDPOINTS.auth.me)
  return data.user ?? data
}

/* Best-effort server-side logout (token clearing happens in AuthContext). */
export async function logout() {
  if (USE_MOCK) return
  try {
    await api.post(ENDPOINTS.auth.logout)
  } catch {
    /* ignore — local sign-out still proceeds */
  }
}
