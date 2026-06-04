import React, { useState, useEffect } from 'react';
import './App.css';
import { useAppState } from './hooks/useAppState';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import ToastContainer from './components/Toast';
import ERPDialog from './components/ERPDialog';
import { SuccessDialog, ErrorDialog } from './components/Dialogs';
import SchoolTab from './tabs/SchoolTab';
import ClassesTab from './tabs/ClassesTab';
import SubjectsTab from './tabs/SubjectsTab';
import DepartmentsTab from './tabs/DepartmentsTab';
import StaffTab from './tabs/StaffTab';
import StudentTab from './tabs/StudentTab';
import TimetableTab from './tabs/TimetableTab';
import { AppProvider } from './context/AppContext';
import LoginScreen from './Pages/auth/LoginScreen';
import SignupFlow from './Pages/auth/SignupFlow';
import './styles/globals.css';
import './styles/tokens.css';

function AppShell({ user, onLogout }) {
  const state = useAppState();
  const [erpOpen, setErpOpen] = useState(false);
  const [successState, setSuccessState] = useState({ open: false, title: '', msg: '', detail: '' });
  const [errorState, setErrorState] = useState({ open: false, fields: [] });
  const [launchSetup, setLaunchSetup] = useState(null);

  const showSuccess = (title, msg, detail = '') => {
    setSuccessState({ open: true, title, msg, detail });
  };

  useEffect(() => {
    const launchSetup = sessionStorage.getItem('launchSetup');
setLaunchSetup(launchSetup)
    const schoolName = state.schoolInfo?.name?.trim();
    if (schoolName) {
      document.title = 'School Mentor - Launch Setup';
    }
  }, [state.schoolInfo?.name]);

  const showError = (fields) => {
    setErrorState({ open: true, fields });
  };

  const handleSchoolSave = (type, fields) => {
    if (type === 'error') { showError(fields); return; }
    showSuccess('School Saved!', 'School information has been saved. Moving to Classes setup…', '<strong>Next Step:</strong> Configure your school classes and sections.');
    state.markSaved();
    setTimeout(() => { setSuccessState(s => ({ ...s, open: false })); state.switchTab('classes'); }, 2200);
  };

  const handleSaveDraft = () => {
    showSuccess('Draft Saved!', 'Your school information draft has been saved. You can continue editing at any time.');
    state.markSaved();
  };

  return (
    <div className="app-layout">
      {/* Sidebar overlay for mobile */}
      <div className={`sidebar-overlay${state.sidebarOpen ? ' open' : ''}`} onClick={() => state.setSidebarOpen(false)} />

      <Sidebar
        activeTab={state.activeTab}
        onTabChange={(tab) => { state.switchTab(tab); state.setSidebarOpen(false); }}
        isOpen={state.sidebarOpen}
      />

      <main className="main-content">
        <Topbar
          activeTab={state.activeTab}
          theme={state.theme}
          onToggleTheme={state.toggleTheme}
          onOpenSidebar={() => state.setSidebarOpen(true)}
          onOpenERP={() => setErpOpen(true)}
          showToast={state.showToast}
        />

        <div className="page-content">
          {/* Welcome Card */}
          <div className="welcome-card">
            <div className="welcome-inner">
              <div className="welcome-icon-wrap"><i className="fas fa-rocket"></i></div>
              <div className="welcome-body">
                <h1 className="welcome-title">Welcome to School Mentor Launch Setup</h1>
                <p className="welcome-subtitle">Initial data entry stage for your school. Fill all information carefully to ensure smooth ERP operations. Follow the setup sequence step-by-step.</p>
                <div className="welcome-rules">
                  <span className="welcome-rule"><i className="fas fa-check-circle"></i> Fields marked * are mandatory</span>
                  <span className="welcome-rule"><i className="fas fa-list-ol"></i> Follow sequence to avoid conflicts</span>
                  <span className="welcome-rule"><i className="fas fa-shield-alt"></i> Data auto-saved as draft</span>
                </div>
              </div>
              <div className="welcome-card-actions">
                <button className="tutorial-btn" onClick={() => state.showToast('Opening tutorial video…', 'info')}>
                  <div className="play-icon"><i className="fas fa-play" style={{ marginLeft: 2 }}></i></div>Watch Tutorial
                </button>
                <button className="erp-launch-btn" onClick={() => setErpOpen(true)}>
                  <div className="erp-btn-icon"><i className="fas fa-th-large"></i></div>
                  <span>ERP</span>
                  {Number(launchSetup) !== 1 && <i className="fas fa-lock" style={{ fontSize: 11, opacity: .7 }}></i>}
                </button>
              </div>
            </div>
          </div>

          {/* Setup Tabs */}
          <div className="setup-tabs-container">
            <div className="setup-tabs">
              {[
                { key: 'school', num: 1, icon: 'fa-school', label: 'School' },
                { key: 'classes', num: 2, icon: 'fa-chalkboard', label: 'Classes' },
                { key: 'subjects', num: 3, icon: 'fa-book', label: 'Subjects' },
                { key: 'departments', num: 4, icon: 'fa-building', label: 'Departments' },
                { key: 'staff', num: 5, icon: 'fa-users', label: 'Staff Details' },
                { key: 'student', num: 6, icon: 'fa-user-graduate', label: 'Student Details' },
                // { key: 'timetable', num: 7, icon: 'fa-calendar-alt', label: 'Time Table' },
              ].map(t => (
                <div
                  key={t.key}
                  className={`tab-item${state.activeTab === t.key ? ' active' : ''}`}
                  onClick={() => state.switchTab(t.key)}
                  title={t.label}
                >
                  <div className="tab-num">{t.num}</div>
                  <i className={`fas ${t.icon} tab-icon`}></i>
                  <span className="tab-label">{t.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tab Panels */}
          {state.activeTab === 'school' && (
            <SchoolTab
              schoolInfo={state.schoolInfo}
              setSchoolInfo={state.setSchoolInfo}
              onSave={handleSchoolSave}
              onSaveDraft={handleSaveDraft}
              markUnsaved={state.markUnsaved}
              showToast={state.showToast}
            />
          )}
          {state.activeTab === 'classes' && (
            <ClassesTab
              classesData={state.classesData}
              setClassesData={state.setClassesData}
              schoolInfo={state.schoolInfo}
              showToast={state.showToast}
              showSuccess={showSuccess}
            />
          )}
          {state.activeTab === 'subjects' && (
            <SubjectsTab
              classesData={state.classesData}
              setClassesData={state.setClassesData}
              subjectsData={state.subjectsData}
              setSubjectsData={state.setSubjectsData}
              bookLists={state.bookLists}
              setBookLists={state.setBookLists}
              schoolInfo={state.schoolInfo}
              showToast={state.showToast}
              showSuccess={showSuccess}
            />
          )}
          {state.activeTab === 'departments' && (
            <DepartmentsTab
              deptsData={state.deptsData}
              setDeptsData={state.setDeptsData}
              schoolInfo={state.schoolInfo}
              showToast={state.showToast}
              showSuccess={showSuccess}
            />
          )}
          {state.activeTab === 'staff' && (
            <StaffTab
              staffData={state.staffData}
              setStaffData={state.setStaffData}
              deptsData={state.deptsData}
              setDeptsData={state.setDeptsData}
              schoolInfo={state.schoolInfo}
              showToast={state.showToast}
              showSuccess={showSuccess}
              classesData={state.classesData}
              setClassesData={state.setClassesData}
            />
          )}
          {state.activeTab === 'student' && (
            <StudentTab
              classesData={state.classesData}
              setClassesData={state.setClassesData}
              studentStrengths={state.studentStrengths}
              setStudentStrengths={state.setStudentStrengths}
              manualReg={state.manualReg}
              setManualReg={state.setManualReg}
              schoolInfo={state.schoolInfo}
              showToast={state.showToast}
              showSuccess={showSuccess}
            />
          )}
          {/* {state.activeTab === 'timetable' && (
            <TimetableTab
              classesData={state.classesData}
              subjectsData={state.subjectsData}
              timetableData={state.timetableData}
              setTimetableData={state.setTimetableData}
              currentTTDay={state.currentTTDay}
              setCurrentTTDay={state.setCurrentTTDay}
              showToast={state.showToast}
            />
          )} */}
        </div>
      </main>

      {/* Global components */}
      <ToastContainer toasts={state.toasts} />
      <ERPDialog open={erpOpen} onClose={() => setErpOpen(false)} />
      <SuccessDialog
        open={successState.open}
        title={successState.title}
        msg={successState.msg}
        detail={successState.detail}
        onClose={() => setSuccessState(s => ({ ...s, open: false }))}
      />
      <ErrorDialog
        open={errorState.open}
        fields={errorState.fields}
        onClose={() => setErrorState(s => ({ ...s, open: false }))}
      />
    </div>
  );
}

function AuthGate() {
  // const [screen, setScreen] = useState('login');
  // const [user, setUser] = useState(null);
  const [user, setUser] = useState(() => {
    const savedUser = sessionStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [screen, setScreen] = useState(() => {
    const token = sessionStorage.getItem("token");
    return token ? 'app' : 'login';
  });

  function handleLogin(userData) {
    setUser(userData);
    setScreen('app');
  }

  if (screen === 'login') {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onSignup={() => setScreen('signup')}
      />
    );
  }

  if (screen === 'signup') {
    return (
      <SignupFlow
        onBack={() => setScreen('login')}
        onComplete={() => setScreen('login')}
      />
    );
  }

  return (
      <AppShell user={user} onLogout={() => { setUser(null); setScreen('login'); }} />
  );
}

export default function App() {
  return (
    <AppProvider>
      <AuthGate />
    </AppProvider>
  );
}

