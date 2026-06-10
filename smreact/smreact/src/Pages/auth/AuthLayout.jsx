import { useEffect, useState } from 'react';
import '../../styles/auth.css';

//FOR tick icon color change show in left side of login and signup page
const TickIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
    <polyline points="20 6 9 17 4 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ILLUSTRATIONS = {
  login: {
    badge: '',
    title: "Pakistan's #1\nSchool OS",
    tagline: 'Trusted by 700+ schools across the nation',
    stats: [
      { value: '700+', label: 'Schools' },
      { value: '50K+', label: 'Students' },
      { value: '99%',  label: 'Uptime'  },
    ],
    features: [
      { icon: <TickIcon />, text: 'Complete ERP system for school management' },
      { icon: <TickIcon />, text: 'Mobile app for parents, teachers & staff'  },
      { icon: <TickIcon />, text: 'Mentor AI for smart school insights'        },
      { icon: <TickIcon />, text: 'Operational manuals & teacher trainings'   },
    ],
  },
  signup: {
    badge: '',
    title: 'Join the\nSchoolMentor\nFamily',
    tagline: 'Set up your school in under 5 minutes',
    stats: [
      { value: '5 min', label: 'Setup'   },
      { value: 'Free',  label: 'Trial'   },
      { value: '24/7',  label: 'Support' },
    ],
    features: [
      { icon: <TickIcon />, text: 'No credit card required to get started'    },
      { icon: <TickIcon />, text: 'Bank-grade security & data encryption'     },
      { icon: <TickIcon />, text: 'Cloud-based, accessible from anywhere'     },
      { icon: <TickIcon />, text: 'Pakistan & international schools supported' },
    ],
  },
};

function useIsMobile(bp = 768) {
  const [mobile, setMobile] = useState(() => window.innerWidth <= bp);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth <= bp);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [bp]);
  return mobile;
}

export default function AuthLayout({
  illustration = 'login',
  heading,
  tagline,
  children,
  step,
  totalSteps,
}) {
  const data    = ILLUSTRATIONS[illustration] || ILLUSTRATIONS.login;
  const isMobile = useIsMobile();

  return (
    <div className="auth-page">
      {/* ── LEFT PANEL — hidden on mobile via CSS ── */}
      <div className="auth-left">
        <div className="auth-blob auth-blob-1" />
        <div className="auth-blob auth-blob-2" />
        <div className="auth-blob auth-blob-3" />
        <div className="auth-grid" />

        {/* Logo */}
        <div className="auth-logo-row">
          <LogoMark size={28} />
          <span className="auth-logo-text">SchoolMentor</span>
        </div>

        {/* Hero */}
        <div className="auth-hero">
          <div className="auth-hero-badge">{data.badge}</div>
          <h1 className="auth-hero-title">{data.title}</h1>
          <p className="auth-hero-tagline">{data.tagline}</p>

          <div className="auth-stats-row">
            {data.stats.map((st, i) => (
              <div key={i} className="auth-stat-box">
                <div className="auth-stat-value">{st.value}</div>
                <div className="auth-stat-label">{st.label}</div>
              </div>
            ))}
          </div>

          <div className="auth-feature-list">
            {data.features.map((f, i) => (
              <div key={i} className="auth-feature-item">
                <span className="auth-feature-icon">{f.icon}</span>
                <span className="auth-feature-text">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="auth-building-wrap">
          <SchoolSVG />
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="auth-right">
        <div className="auth-form-scroll">

          {/* Mobile-only top bar — logo + gradient strip */}
          {isMobile && (
            <div className="auth-mobile-header">
              <div className="auth-mobile-header-bg" />
              <div className="auth-mobile-header-content">
                <LogoMark size={22} light />
                <span className="auth-mobile-logo-text">SchoolMentor</span>
              </div>
              {totalSteps && (
                <p className="auth-mobile-step-hint">Step {step} of {totalSteps}</p>
              )}
            </div>
          )}

          {/* Step dots — desktop */}
          {!isMobile && totalSteps && (
            <div className="auth-dots-row">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className="auth-dot"
                  style={{
                    width:     i + 1 === step ? 24 : 8,
                    background: i + 1 < step ? '#1DB88A'
                               : i + 1 === step ? '#1565C0'
                               : '#E2E8F0',
                  }}
                />
              ))}
            </div>
          )}

          <h2 className="auth-form-heading">{heading}</h2>
          <p  className="auth-form-tagline">{tagline}</p>

          {children}
        </div>
      </div>
    </div>
  );
}

/* ── sub-components ── */
function LogoMark({ size = 28, light = false }) {
  return (
    <div className={`auth-logo-mark ${light ? 'auth-logo-mark--light' : ''}`}
      style={{ width: size + 14, height: size + 14 }}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M16 4L28 10V22L16 28L4 22V10L16 4Z"
          fill={light ? 'white' : '#1565C0'} fillOpacity={0.9}/>
        <path d="M16 9L23 13V19L16 23L9 19V13L16 9Z"
          fill={light ? '#1DB88A' : '#1DB88A'}/>
      </svg>
    </div>
  );
}

function SchoolSVG() {
  return (
    <svg viewBox="0 0 480 200" width="100%" style={{ opacity: 0.18 }} fill="white">
      <rect x={0}   y={170} width={480} height={30} rx={4}/>
      <rect x={100} y={70}  width={280} height={100} rx={4}/>
      <polygon points="80,70 240,20 400,70"/>
      <rect x={210} y={130} width={60} height={40} rx={3}/>
      <rect x={120} y={90}  width={40} height={35} rx={3}/>
      <rect x={180} y={90}  width={40} height={35} rx={3}/>
      <rect x={260} y={90}  width={40} height={35} rx={3}/>
      <rect x={320} y={90}  width={40} height={35} rx={3}/>
      <rect x={238} y={0}   width={4}  height={22}/>
      <polygon points="242,0 242,14 262,7"/>
      <circle cx={50}  cy={140} r={25}/><rect x={46}  y={155} width={8} height={18}/>
      <circle cx={430} cy={140} r={25}/><rect x={426} y={155} width={8} height={18}/>
    </svg>
  );
}