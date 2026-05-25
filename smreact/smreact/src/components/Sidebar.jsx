import React from 'react';

const NAV_ITEMS = [
  { key: 'school',      icon: 'fa-school',          label: 'School',          status: 'Step 1' },
  { key: 'classes',     icon: 'fa-chalkboard',       label: 'Classes',         status: 'Step 2' },
  { key: 'subjects',    icon: 'fa-book',             label: 'Subjects',        status: 'Step 3' },
  { key: 'departments', icon: 'fa-building',         label: 'Departments',     status: 'Step 4' },
  { key: 'staff',       icon: 'fa-users',            label: 'Staff',           status: 'Step 5' },
  { key: 'student',     icon: 'fa-user-graduate',    label: 'Students',        status: 'Step 6' },
  // { key: 'timetable',   icon: 'fa-calendar-alt',     label: 'Time Table',      status: 'Step 7' },
];

export default function Sidebar({ activeTab, onTabChange, isOpen }) {
  const activeIdx = NAV_ITEMS.findIndex(n => n.key === activeTab);
  const progress = Math.round(((activeIdx + 1) / NAV_ITEMS.length) * 100);
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
        {NAV_ITEMS.map((item, idx) => (
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
