import React from 'react';

const NAV_ITEMS = [
  { key: 'school',      icon: 'fa-school',          label: 'School',          status: 'Step 1' },
  { key: 'classes',     icon: 'fa-chalkboard',       label: 'Classes',         status: 'Step 2' },
  { key: 'subjects',    icon: 'fa-book',             label: 'Subjects',        status: 'Step 3' },
  { key: 'departments', icon: 'fa-building',         label: 'Departments',     status: 'Step 4' },
  { key: 'staff',       icon: 'fa-users',            label: 'Staff',           status: 'Step 5' },
  { key: 'student',     icon: 'fa-user-graduate',    label: 'Students',        status: 'Step 6' },
  // { key: 'timetable',   icon: 'fa-calendar-alt',     label: 'Timetable',      status: 'Step 7' },
];

/* `visibleTabs` App.js se aata hai — un tab keys ka Set jin par is user ko
   Launch Setup ▸ View mila hua hai (dekhein utils/setupPermissions.js). Prop
   na mile to sab dikhte hain, taake Sidebar kahin aur bhi lag sake. */
export default function Sidebar({ activeTab, onTabChange, isOpen, visibleTabs, loading }) {
  const items = visibleTabs ? NAV_ITEMS.filter(n => visibleTabs.has(n.key)) : NAV_ITEMS;
  const activeIdx = items.findIndex(n => n.key === activeTab);
  /* Progress un hi steps par gina jata hai jo user ko waqai karne hain —
     warna 3 tabs wale user ke liye bar kabhi 100% tak pohanchta hi nahi. */
  const progress = (loading || !items.length) ? 0 : Math.round(((activeIdx + 1) / items.length) * 100);
  const UserDisplayName = sessionStorage.getItem("displayName")
  const UserRole = sessionStorage.getItem("accountType")

  return (
    <aside className={`sidebar${isOpen ? ' open' : ''}`} id="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="logo-icon"><i className="fas fa-graduation-cap"></i></div>
          <div className="logo-text">
            <div className="logo-name">School Mentor</div>
            <div className="logo-sub">Launch Setup</div>
          </div>
        </div>
      </div>

      <div className="sidebar-progress">
        <div className="progress-label">Setup Progress</div>
        <div className="progress-bar-outer">
          <div className="progress-bar-inner" style={{ width: `${progress}%` }}></div>
        </div>
        <div className="progress-pct">{progress}% Complete</div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Setup Steps</div>
        {/* Permissions aa rahi hain — is dauran na steps dikhao na "kuch nahi
            mila" ka paighaam, warna do bar screen badalti hai. */}
        {loading && [0, 1, 2].map(i => (
          <div key={i} className="nav-item" style={{ pointerEvents: 'none' }}>
            <div className="nav-icon-wrap" style={{ opacity: .35 }}><i className="fas fa-ellipsis" /></div>
            <div className="nav-item-info">
              <div style={{ height: 9, width: '62%', borderRadius: 5, background: 'var(--border-light,#E2E8F0)', opacity: .8 }} />
              <div style={{ height: 7, width: '40%', borderRadius: 5, background: 'var(--border-light,#E2E8F0)', opacity: .5, marginTop: 6 }} />
            </div>
          </div>
        ))}
        {!loading && items.length === 0 && (
          <div className="nav-item-status" style={{ padding: '10px 14px', opacity: .75 }}>
            No setup steps assigned to your account.
          </div>
        )}
        {!loading && items.map((item, idx) => (
          <div
            key={item.key}
            className={`nav-item${activeTab === item.key ? ' active' : ''}`}
            onClick={() => onTabChange(item.key)}
          >
            <div className="nav-icon-wrap"><i className={`fas ${item.icon}`}></i></div>
            <div className="nav-item-info">
              <div className="nav-item-name">{item.label}</div>
              <div className="nav-item-status">{item.status}</div>
            </div>
            <div className={`nav-badge${activeTab === item.key ? ' active' : ''}`}>{idx + 1}</div>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-avatar">
  {UserDisplayName ? UserDisplayName.charAt(0).toUpperCase() : 'U'}
</div>
        <div>
          <div className="user-name">{UserDisplayName}</div>
          <div className="user-role">{UserRole}</div>
        </div>
      </div>
    </aside>
  );
}
