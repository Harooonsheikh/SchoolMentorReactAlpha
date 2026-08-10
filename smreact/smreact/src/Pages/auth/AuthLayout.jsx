import '../../styles/auth.css';

/* Brand lockup: graduation-cap icon + live text wordmark ("SchoolMentor" +
   "Creating the Future"). Text ab image nahi, real text hai — har screen par
   sharp rehta hai aur size/color CSS se control hota hai. */
const BRAND_ICON = `${process.env.PUBLIC_URL}/logo192.png`;

function BrandLockup() {
  return (
    <>
      <img className="auth-brand-icon" src={BRAND_ICON} alt="" aria-hidden="true" />
      <span className="auth-brand-text">
        <span className="auth-brand-name">
          <b>School</b><span>Mentor</span>
        </span>
        <span className="auth-brand-tag">Creating the Future</span>
      </span>
    </>
  );
}

/* Left story panel ka content. `steps` = journey rail. */
const ILLUSTRATIONS = {
  login: {
    eyebrow: 'Trusted by schools nationwide',
    headline: <>Pakistan's <span className="auth-hl">Number One</span> School Operating System</>,
    sub: "School Mentor is a complete school operating system that brings every department, every operation, and every stakeholder's needs together in one powerful, one-stop solution.",
    journeyHead: 'How it works',
    steps: [
      {
        icon: 'fa-solid fa-rocket',
        title: 'Launch & Setup',
        desc: 'Set up your school profile, academic structure, users, permissions, and essential configurations.',
        chips: [],
      },
      {
        icon: 'fa-solid fa-layer-group',
        title: 'Activate Your School ERP',
        desc: 'Activate and manage all essential modules in one platform:',
        chips: [
          'Student Management', 'Attendance', 'Academics', 'Lesson Planning',
          'Question Bank', 'Paper Generator', 'Examination', 'Fee Management',
          'Accounts', 'HR', 'Payroll', 'Inventory', 'Communication', 'Reports',
        ],
      },
      {
        icon: 'fa-solid fa-chart-line',
        title: 'Manage, Automate & Grow',
        desc: 'Run daily operations, monitor performance, automate routine tasks, and make informed decisions from one centralized platform.',
        chips: [],
      },
    ],
    foot: 'One connected computer keeps every phone in your school in sync.',
  },
  signup: {
    eyebrow: 'Free trial — no card required',
    headline: <>Join the <span className="auth-hl">SchoolMentor</span> family</>,
    sub: 'Set up your school in under 5 minutes and start running your ERP the same day.',
    journeyHead: 'What happens next',
    steps: [
      {
        icon: 'fa-solid fa-user-plus',
        title: 'Create your account',
        desc: 'Just a phone number to begin — no credit card required.',
        chips: ['Phone verify', 'Instant access'],
      },
      {
        icon: 'fa-solid fa-shield-halved',
        title: 'Bank-grade security',
        desc: 'Your school data is encrypted in transit and at rest.',
        chips: ['Encrypted', 'Role-based access'],
      },
      {
        icon: 'fa-solid fa-cloud',
        title: 'Cloud based',
        desc: 'Accessible from any device, anywhere — nothing to install.',
        chips: ['Web', 'Mobile', 'Auto-backup'],
      },
      {
        icon: 'fa-solid fa-earth-asia',
        title: 'Built for your region',
        desc: 'Pakistan and international schools, with local fee and session cycles.',
        chips: ['PK curriculum', 'Multi-branch'],
      },
    ],
    foot: 'Onboarding assistance and staff training available from day one.',
  },
  /* Network Head Office signup — same rail, network ki zubaan me. Individual
     school wala `signup` copy branch/ek campus ki baat karta hai, ye poore
     network aur uske multiple campuses ki. */
  signupNetwork: {
    eyebrow: 'Free trial — no card required',
    headline: <>Bring your <span className="auth-hl">school network</span> together</>,
    sub: 'Set up your head office in under 5 minutes and connect every campus under one account.',
    journeyHead: 'What happens next',
    steps: [
      {
        icon: 'fa-solid fa-user-plus',
        title: 'Create your head office account',
        desc: 'Just a phone number to begin — no credit card required.',
        chips: ['Phone verify', 'Instant access'],
      },
      {
        icon: 'fa-solid fa-building',
        title: 'Add your campuses',
        desc: 'Register each branch under the network and manage them from one dashboard.',
        chips: ['Unlimited branches', 'Central control'],
      },
      {
        icon: 'fa-solid fa-shield-halved',
        title: 'Bank-grade security',
        desc: 'Your network data is encrypted in transit and at rest.',
        chips: ['Encrypted', 'Role-based access'],
      },
      {
        icon: 'fa-solid fa-chart-pie',
        title: 'Network-wide reporting',
        desc: 'Compare fee, attendance and results across every campus in real time.',
        chips: ['Consolidated reports', 'Branch comparison'],
      },
    ],
    foot: 'Dedicated onboarding for head office and every branch team.',
  },
};

export default function AuthLayout({
  illustration = 'login',
  heading,
  tagline,
  children,
  step,
  totalSteps,
}) {
  const data = ILLUSTRATIONS[illustration] || ILLUSTRATIONS.login;

  return (
    <div className="auth-page">

      {/* ═══════════ LEFT: STORY / BRAND PANEL ═══════════ */}
      <div className="auth-story">
        <div className="auth-blob auth-blob-1" />
        <div className="auth-blob auth-blob-2" />
        <i className="fa-solid fa-graduation-cap auth-spark"  style={{ top: '14%', left: '78%', animationDelay: '.5s'  }} />
        <i className="fa-solid fa-chalkboard-user auth-spark" style={{ top: '62%', left: '6%',  animationDelay: '2.2s' }} />
        <i className="fa-solid fa-book-open auth-spark"       style={{ top: '38%', left: '88%', animationDelay: '4s'   }} />

        <div className="auth-story-content">

          <div className="auth-brand-row">
            <div className="auth-logo-badge">
              <BrandLockup />
            </div>
          </div>

          <div className="auth-hero">
            <div className="auth-eyebrow"><i className="fa-solid fa-circle" /> {data.eyebrow}</div>
            <h1 className="auth-headline">{data.headline}</h1>
            <p className="auth-sub">{data.sub}</p>
          </div>

          <div className="auth-journey">
            <div className="auth-journey-head">{data.journeyHead}</div>
            <div className="auth-rail">
              <div className="auth-rail-line"><div className="auth-rail-glow" /></div>
              {data.steps.map((s, i) => (
                <div key={i} className="auth-step">
                  <div className="auth-step-node">
                    <i className={s.icon} />
                    <span className="auth-step-num">{i + 1}</span>
                  </div>
                  <div className="auth-step-body">
                    <div className="auth-step-title">{s.title}</div>
                    <div className="auth-step-desc">{s.desc}</div>
                    {s.chips.length > 0 && (
                      <div className="auth-module-chips">
                        {s.chips.map((c, j) => <span key={j}>{c}</span>)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="auth-story-foot">
            <span className="auth-foot-icons">
              <i className="fa-solid fa-book" />
              <i className="fa-solid fa-headset" />
              <i className="fa-solid fa-certificate" />
            </span>
            <span className="auth-story-foot-text">{data.foot}</span>
          </div>
        </div>
      </div>

      {/* ═══════════ RIGHT: AUTH PANEL ═══════════ */}
      <div className="auth-wrap">
        <div className="auth-card">

          <div className="auth-card-badge">
            <BrandLockup />
          </div>

          {/* Step dots — signup flow */}
          {totalSteps && (
            <div className="auth-dots-row">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className="auth-dot"
                  style={{
                    width:      i + 1 === step ? 24 : 8,
                    background: i + 1 <  step ? '#16A34A'
                              : i + 1 === step ? '#2563EB'
                              : '#BFDBFE',
                  }}
                />
              ))}
            </div>
          )}

          {/* `key` par heading rakhi hai: account type badalne par React ye
              node remount karta hai, jis se fade-up animation dobara chalti
              hai — warna text achanak badal jata tha. */}
          <div className="auth-welcome" key={String(heading)}>
            <h2 className="auth-welcome-title">{heading}</h2>
            <p  className="auth-welcome-sub">{tagline}</p>
          </div>

          <div className="auth-forms">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
