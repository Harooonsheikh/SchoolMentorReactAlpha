import { useEffect } from 'react'
import { useAuth } from './useAuth'
import { ERP_LOGIN_URL } from '../config/env'

/* Wrap any route that requires a signed-in user. While the session is being
   restored we render a light placeholder.

   Bina session ke user ko is portal ke apne /login par bhejna bemani hai —
   yahan login hota hi nahi, session hamesha ERP ke Network Head Office login
   se aata hai (URL hash handoff, dekhein main.jsx). Is liye seedha ERP ke
   login par bhej dete hain. */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, booting } = useAuth()

  useEffect(() => {
    if (!booting && !isAuthenticated) window.location.replace(ERP_LOGIN_URL)
  }, [booting, isAuthenticated])

  if (booting) return <div className="app-loading">Loading…</div>
  /* Redirect chal raha hai — is dauran khali screen, taake login form ki
     jhalak na dikhe. */
  if (!isAuthenticated) return <div className="app-loading">Redirecting…</div>
  return children
}
