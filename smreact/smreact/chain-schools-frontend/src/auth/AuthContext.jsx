import { createContext, useCallback, useEffect, useState } from 'react'
import * as authApi from '../api/authApi'
import { USE_MOCK } from '../config/env'
import { clearLastPath } from '../routes/lastPath'
import {
  getToken,
  setToken,
  clearToken,
  getStoredUser,
  setStoredUser,
} from './tokenStorage'

/* eslint-disable-next-line react-refresh/only-export-components */
export const AuthContext = createContext(null)

/* ═══════════════════════════════════════════════════════════════════
   Holds the signed-in user + session lifecycle for the whole app.
     - user            current user object (or null)
     - isAuthenticated  convenience boolean
     - booting          true while we restore a session on first load
     - login(creds)     authenticate + persist
     - logout()         clear session
   Consume via the useAuth() hook.
   ═══════════════════════════════════════════════════════════════════ */
export function AuthProvider({ children }) {
  /* Session sirf tab valid hai jab token AUR user dono maujood hon. Sirf user
     (bina token ke) ek adhoora handoff hai — usay signed-in nahi maana jayega,
     warna app dashboard dikha deta hai aur har API call 401 par girti hai. */
  const [user, setUser] = useState(() => (getToken() ? getStoredUser() : null))
  const [booting, setBooting] = useState(true)

  /* On first load: restore the ERP Network Head Office hash handoff.
     Session ERP ke network-login se aati hai (main.jsx → sessionStorage).
     /auth/me Chain API par live nahi — call fail/401 → axios interceptor
     session saaf karke ERP login par wapas bhej deta tha (bounce). Is liye
     handoff user ko trust karte hain jab tak real /me wire na ho. */
  useEffect(() => {
    let active = true
    ;(async () => {
      const token = getToken()
      const stored = getStoredUser()
      if (!token || !stored) {
        clearToken()
        if (active) {
          setUser(null)
          setBooting(false)
        }
        return
      }
      if (active) {
        setUser(stored)
        setBooting(false)
      }
      /* Optional soft refresh — failure must NOT clear the handoff session. */
      if (USE_MOCK) return
      try {
        const me = await authApi.fetchMe()
        if (active && me) {
          setUser(me)
          setStoredUser(me)
        }
      } catch {
        /* keep handoff user */
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (credentials) => {
    const { token, user: signedIn } = await authApi.login(credentials)
    setToken(token)
    setStoredUser(signedIn)
    setUser(signedIn)
    return signedIn
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    clearToken()
    clearLastPath()   // agla user pichhle wale ke page par na khule
    setUser(null)
  }, [])

  const value = { user, isAuthenticated: !!user, booting, login, logout }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
