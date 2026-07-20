/* ═══════════════════════════════════════════════════════════════════
   Thin wrapper around where the auth token + cached user live.
   Centralised so swapping localStorage for cookies/sessionStorage later
   is a one-file change.
   ═══════════════════════════════════════════════════════════════════ */
const TOKEN_KEY = 'csp_token'
const USER_KEY = 'csp_user'

export const getToken = () => localStorage.getItem(TOKEN_KEY)

export const setToken = (token) =>
  token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY)

export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

export const setStoredUser = (user) =>
  user ? localStorage.setItem(USER_KEY, JSON.stringify(user)) : localStorage.removeItem(USER_KEY)
