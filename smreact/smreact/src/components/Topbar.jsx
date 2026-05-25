import React from 'react';

const CRUMBS = {
  school:      'School Registration',
  classes:     'Classes Setup',
  subjects:    'Subjects & Books',
  departments: 'Departments',
  staff:       'Staff Details',
  student:     'Student Details',
  // timetable:   'Time Table',
};

export default function Topbar({ activeTab, theme, onToggleTheme, onOpenSidebar, onOpenERP, showToast }) {

  const handleLogout = () => {
  sessionStorage.clear();
  showToast('Logged out successfully', 'success');
   setTimeout(() => {
    window.location.href = '/LoginScreen.jsx'; 
  }, 300);
};

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* <button className="hamburger" onClick={onOpenSidebar} style={{ display: 'flex' }}>
          <i className="fas fa-bars"></i>
        </button> */}
        <div className="breadcrumb">
          <span className="breadcrumb-item"><i className='fas fa-home'></i></span>
          {/* <span className="breadcrumb-sep"><i className="fas fa-chevron-right" style={{ fontSize: 10 }}></i></span>
          <span className="breadcrumb-item">School Mentor</span> */}
          <span className="breadcrumb-sep"><i className="fas fa-chevron-right" style={{ fontSize: 6 }}></i></span>
          <span className="breadcrumb-item">Launch Setup</span>
          <span className="breadcrumb-sep"><i className="fas fa-chevron-right" style={{ fontSize: 6 }}></i></span>
          <span className="breadcrumb-item current">{CRUMBS[activeTab] || activeTab}</span>
        </div>
      </div>
      <div className="topbar-right">
        <button className="topbar-btn" title="Notifications" onClick={() => showToast('No new notifications', 'info')}>
          <i className="fas fa-bell"></i>
        </button>
        <button className="topbar-btn" title="Help" onClick={() => showToast('Help center coming soon', 'info')}>
          <i className="fas fa-question-circle"></i>
        </button>
        <button className="topbar-btn" onClick={onToggleTheme} title="Toggle theme">
          <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
        </button>
        <button className="topbar-btn" title="Logout" onClick={() => handleLogout()}>
          <i className="fas fa-sign-out-alt"></i> 
        </button>
      </div>
    </header>
  );
}
