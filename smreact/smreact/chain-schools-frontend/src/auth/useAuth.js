import { useContext } from 'react'
import { AuthContext } from './AuthContext'

/* Access the auth context. Kept in its own file so AuthContext.jsx only
   exports components (keeps Vite Fast Refresh happy). */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
