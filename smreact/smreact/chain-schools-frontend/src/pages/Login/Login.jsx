import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { USE_MOCK } from '../../config/env'
import './Login.css'

/* ═══════════════════════════════════════════════════════════════════
   LOGIN — placeholder screen, fully wired to the auth flow.

   This is intentionally minimal: when you upload the login HTML we'll
   swap the markup/styles below but keep the exact same submit logic
   (useAuth().login → redirect to the page the user was headed to).
   ═══════════════════════════════════════════════════════════════════ */
export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login({ email, password })
      const dest = location.state?.from?.pathname || '/'
      navigate(dest, { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-brand">
          <div className="login-brand-mark">SC</div>
          <div>
            <h1 className="login-title">School Chain Portal</h1>
            <p className="login-sub">Sign in to continue</p>
          </div>
        </div>

        {error && <div className="login-error">{error}</div>}

        <label className="login-label" htmlFor="login-email">Email</label>
        <input
          id="login-email"
          className="login-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@school.com"
          autoComplete="username"
        />

        <label className="login-label" htmlFor="login-password">Password</label>
        <input
          id="login-password"
          className="login-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
        />

        <button className="login-btn" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        {USE_MOCK && (
          <p className="login-hint">
            Mock mode is ON — any email + password signs you in. Set
            <code> VITE_USE_MOCK=false</code> in <code>.env</code> once the API is connected.
          </p>
        )}
      </form>
    </div>
  )
}
