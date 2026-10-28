import axios from 'axios'
import { API_BASE_URL, ERP_LOGIN_URL } from '../config/env'
import { getToken, clearToken } from '../auth/tokenStorage'

/* ═══════════════════════════════════════════════════════════════════
   Shared axios instance. Every API service imports this so auth headers,
   error normalisation and the base URL live in exactly one place.
   ═══════════════════════════════════════════════════════════════════ */
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
})

/* Attach the JWT bearer token (if signed in) to every outgoing request. */
api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/* Centralised response handling:
   - 401 on real app APIs → clear session and bounce to ERP login.
   - /auth/me is NOT live on Chain API yet (ERP hash handoff is the session).
     A 401/404 there must NOT wipe the handoff or bounce back to ERP.
   - Everything else → reject with a consistent { status, message, data }
     shape (also reads .NET ProblemDetails `title`/`detail`). */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const url = String(error.config?.url || error.config?.baseURL || '')
    const isAuthMe = /\/auth\/me\b/i.test(url)
    if (status === 401 && !isAuthMe) {
      clearToken()
      /* Is portal ka apna /login use nahi hota — session ERP ke Network Head
         Office login se aata hai. Session expire ho to wahin wapas bhejo. */
      window.location.replace(ERP_LOGIN_URL)
    }
    const body = error.response?.data
    return Promise.reject({
      status: status ?? 0,
      message:
        body?.message ||
        body?.detail ||
        body?.title ||
        error.message ||
        'Something went wrong. Please try again.',
      data: body,
    })
  },
)

export default api
