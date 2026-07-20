import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

/* Wrap any route that requires a signed-in user. While the session is
   being restored we render a light placeholder; unauthenticated users are
   redirected to /login (remembering where they were headed). */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, booting } = useAuth()
  const location = useLocation()

  if (booting) return <div className="app-loading">Loading…</div>
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return children
}
