import React from 'react';
import Tooltip from '../erp/shared/Tooltip';

const CRUMBS = {
  school:      'School Registration',
  classes:     'Classes Setup',
  subjects:    'Subjects & Books',
  departments: 'Departments',
  staff:       'Staff Details',
  student:     'Student Details',
  // timetable:   'Timetable',
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
        <Tooltip text="Notifications">
          <button className="topbar-btn" onClick={() => showToast('No new notifications', 'info')}>
            <i className="fas fa-bell"></i>
          </button>
        </Tooltip>
        <Tooltip text="Help">
          <button className="topbar-btn" onClick={() => showToast('Help center coming soon', 'info')}>
            <i className="fas fa-question-circle"></i>
          </button>
        </Tooltip>
        <Tooltip text={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          <button className="topbar-btn" onClick={onToggleTheme}>
            <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
        </Tooltip>
        <Tooltip text="Logout">
          <button className="topbar-btn" onClick={() => handleLogout()}>
            <i className="fas fa-sign-out-alt"></i>
          </button>
        </Tooltip>
      </div>
    </header>
  );
}
