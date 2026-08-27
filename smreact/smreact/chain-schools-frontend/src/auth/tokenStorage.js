/* ═══════════════════════════════════════════════════════════════════
   Thin wrapper around where the auth token + cached user live.
   Centralised so swapping the storage later is a one-file change.

   sessionStorage — localStorage nahi. Session sirf isi tab tak mehdood
   rehta hai: tab band hote hi khatam, aur ERP (jo khud sessionStorage par
   chalta hai) ke saath rawaiya ek jaisa rehta hai. Sanjhe/public computer
   par token peeche nahi reh jaata.
   ═══════════════════════════════════════════════════════════════════ */
const TOKEN_KEY = 'csp_token'
const USER_KEY = 'csp_user'

export const getToken = () => sessionStorage.getItem(TOKEN_KEY)

export const setToken = (token) =>
  token ? sessionStorage.setItem(TOKEN_KEY, token) : sessionStorage.removeItem(TOKEN_KEY)

export const clearToken = () => {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
}

export const getStoredUser = () => {
  try {
    return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

export const setStoredUser = (user) =>
  user ? sessionStorage.setItem(USER_KEY, JSON.stringify(user)) : sessionStorage.removeItem(USER_KEY)
