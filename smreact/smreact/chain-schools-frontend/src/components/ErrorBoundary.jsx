import { Component } from 'react'

/* ═══════════════════════════════════════════════════════════════════
   Error boundary — contains render-time crashes so one broken screen
   (e.g. an unexpected API response shape) shows a friendly fallback
   instead of white-screening the whole app. Used at the app level and
   around each routed page (keyed by route so it resets on navigation).
   ═══════════════════════════════════════════════════════════════════ */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Surface for debugging; wire to a real logger/Sentry later if needed.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    if (this.props.fallback) return this.props.fallback(error, this.reset)

    return (
      <div className="eb-wrap">
        <div className="eb-card">
          <div className="eb-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
          <div className="eb-title">{this.props.title || 'Something went wrong'}</div>
          <div className="eb-sub">{this.props.message || 'This screen ran into an unexpected error. Your other modules are still available — try again or go back.'}</div>
          {import.meta.env.DEV && error?.message && <pre className="eb-detail">{String(error.message)}</pre>}
          <div className="eb-actions">
            <button className="btn-secondary" onClick={() => window.history.back()}><i className="fa-solid fa-arrow-left" /> Go Back</button>
            <button className="btn-primary" onClick={this.reset}><i className="fa-solid fa-rotate-right" /> Try Again</button>
          </div>
        </div>
      </div>
    )
  }
}
