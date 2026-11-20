import React from 'react';

/* Mentor AI ke har tab ke gird safety net: agar server ka response umeed se
   mukhtalif ho aur koi component render me crash kare, to poora page safed hone
   ki jagah sirf us tab me error + "Try again" dikhe. Console me asli error aata hai. */
export default class MentorAIErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Mentor AI screen crashed:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="msai-card" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
        <div className="msai-step-title">
          <i className="fa-solid fa-triangle-exclamation" style={{ color: '#D97706', marginRight: 8 }} aria-hidden="true" />
          Something went wrong on this screen
        </div>
        <div className="msai-step-sub" style={{ marginTop: 0 }}>
          {String(this.state.error?.message || this.state.error)}
        </div>
        <button type="button" className="msai-btn-primary" onClick={() => this.setState({ error: null })}>
          <i className="fa-solid fa-rotate-right" aria-hidden="true" /> Try again
        </button>
      </div>
    );
  }
}
