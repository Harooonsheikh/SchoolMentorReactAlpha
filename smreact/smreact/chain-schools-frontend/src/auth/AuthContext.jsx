import { createContext, useCallback, useEffect, useState } from 'react'
import * as authApi from '../api/authApi'
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
  const [user, setUser] = useState(() => getStoredUser())
  const [booting, setBooting] = useState(true)

  /* On first load: if a token exists, confirm who we are with the API.
     A failure clears the (stale) session. */
  useEffect(() => {
    let active = true
    ;(async () => {
      if (!getToken()) {
        setBooting(false)
        return
      }
      try {
        const me = await authApi.fetchMe()
        if (active) {
          setUser(me)
          setStoredUser(me)
        }
      } catch {
        if (active) {
          clearToken()
          setUser(null)
        }
      } finally {
        if (active) setBooting(false)
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
    setUser(null)
  }, [])

  const value = { user, isAuthenticated: !!user, booting, login, logout }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
