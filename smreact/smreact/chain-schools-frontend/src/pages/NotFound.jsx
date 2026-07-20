import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="page-shell">
      <div className="page-shell-card" style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 40, margin: 0 }}>404</h1>
        <p>This page doesn’t exist.</p>
        <Link to="/">Go home</Link>
      </div>
    </div>
  )
}
