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
import TutorialModal from './erp/components/TutorialModal';
import { AppProvider } from './context/AppContext';
import LoginScreen from './Pages/auth/LoginScreen';
import SignupFlow from './Pages/auth/SignupFlow';
import { isErpUnlocked } from './utils/erp';
import ErpApp from './erp/App';
import './styles/globals.css';
import './styles/tokens.css';
import Tooltip from '../src/erp/components/Tooltip';
function AppShell({ user, onLogout, onOpenErp }) {
  const state = useAppState();
  const [erpOpen, setErpOpen] = useState(false);
  const [successState, setSuccessState] = useState({ open: false, title: '', msg: '', detail: '' });
  const [errorState, setErrorState] = useState({ open: false, fields: [] });
  const [launchSetup, setLaunchSetup] = useState(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);

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
    <>
          <style>{App_CSS}</style>

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
                <Tooltip text="Play a short tutorial for the Academics module">
                          <button
                            className="tutorial-btn page-tutorial-btn"
                            onClick={() => setTutorialOpen(true)}
                          >
                            <div className="play-dot"><i className="fa-solid fa-play" style={{ fontSize: 8 }}></i></div>
                            <span className="tutorial-label">Tutorial</span>
                          </button>
                        </Tooltip>
                <button className="erp-launch-btn" onClick={() => {
                  /* Branch ko ERP access ho (launchSetup === 1) to popup nahi — seedha ERP kholo.
                     Warna popup (permission/setup message) dikhao jaise pehle. */
                  if (isErpUnlocked() && onOpenErp) onOpenErp();
                  else setErpOpen(true);
                }}>
                  <div className="erp-btn-icon"><i className="fas fa-th-large"></i></div>
                  <span>ERP</span>
                  {Number(launchSetup) !== 1 && <i className="fas fa-lock" style={{ fontSize: 11, opacity: .7 }}></i>}
                </button>
              </div>
            </div>
            <TutorialModal
  open={tutorialOpen}
  moduleKey="launch-setup"
  onClose={() => setTutorialOpen(false)}
  toast={state.showToast}
/>
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
              onContinue={() => state.switchTab('subjects')}
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
              onContinue={() => state.switchTab('departments')}
            />
          )}
          {state.activeTab === 'departments' && (
            <DepartmentsTab
              deptsData={state.deptsData}
              setDeptsData={state.setDeptsData}
              schoolInfo={state.schoolInfo}
              showToast={state.showToast}
              showSuccess={showSuccess}
              onContinue={() => state.switchTab('staff')}
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
              onContinue={() => state.switchTab('student')}
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
      <ERPDialog open={erpOpen} onClose={() => setErpOpen(false)} showToast={state.showToast} onOpenErp={onOpenErp} />
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
     </>

);
}
const App_CSS = `
/* ── Page header tutorial button (uses existing .tutorial-btn from App.js CSS) ── */
.page-tutorial-btn { flex-shrink: 0; }

/* Tutorial button */
[data-theme="dark"] .tutorial-btn,
[data-theme="dark"] .page-tutorial-btn { background:var(--bg-card); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .tutorial-btn:hover,
[data-theme="dark"] .page-tutorial-btn:hover { border-color:#3B82F6; color:#3B82F6; }
@media (max-width:600px) {
  .page-tutorial-btn { width:100%; justify-content:center; }

}
  .tutorial-btn{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);border-radius:var(--radius-md);padding:10px 16px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;transition:var(--tr);white-space:nowrap;backdrop-filter:blur(8px)}
.tutorial-btn:hover{background:rgba(255,255,255,.2);transform:translateY(-1px);box-shadow:0 8px 24px rgba(0,0,0,.2)}
.play-icon{width:26px;height:26px;background:linear-gradient(135deg,#1E40AF,#0EA5E9);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;animation:blink-glow 2s ease-in-out infinite}

/* ── Welcome-card Tutorial button — ERP module jaisa (rounded pill + animated play-dot),
   blue banner par legible white variant. .welcome-card scope se sirf yahin apply hota hai. ── */
.welcome-card .tutorial-btn{
  display:flex;align-items:center;gap:10px;
  background:rgba(255,255,255,.12);
  border:2px solid rgba(255,255,255,.55);border-radius:999px;
  padding:8px 18px 8px 8px;color:#fff;font-size:13px;font-weight:700;
  letter-spacing:.01em;cursor:pointer;white-space:nowrap;flex-shrink:0;
  box-shadow:0 2px 10px rgba(0,0,0,.14);backdrop-filter:blur(8px);
  transition:all .25s cubic-bezier(.4,0,.2,1);position:relative;overflow:hidden;
}
.welcome-card .tutorial-btn::before{
  content:'';position:absolute;inset:0;
  background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,.18) 50%,transparent 70%);
  transform:translateX(-100%);transition:transform .5s ease;
}
.welcome-card .tutorial-btn:hover::before{transform:translateX(100%)}
.welcome-card .tutorial-btn:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(0,0,0,.22);background:rgba(255,255,255,.2)}
.welcome-card .tutorial-btn:active{transform:scale(.97) translateY(0)}
.welcome-card .tutorial-label{line-height:1}
.welcome-card .play-dot{
  width:28px;height:28px;border-radius:50%;
  background:rgba(255,255,255,.2);color:#fff;
  display:flex;align-items:center;justify-content:center;
  font-size:9px;flex-shrink:0;position:relative;
}
.welcome-card .play-dot::before{
  content:'';position:absolute;inset:-4px;border-radius:50%;
  border:2px solid rgba(255,255,255,.45);
  animation:lsPlayRingPulse 2s ease infinite;
}
.welcome-card .play-dot::after{
  content:'';position:absolute;inset:-9px;border-radius:50%;
  border:1.5px solid rgba(255,255,255,.2);
  animation:lsPlayRingPulse 2s ease .4s infinite;
}
@keyframes lsPlayRingPulse{0%{transform:scale(.85);opacity:1}60%{transform:scale(1.3);opacity:0}100%{transform:scale(1.3);opacity:0}}
.welcome-card .play-dot i{animation:lsPlayIconBounce 1.8s ease infinite;position:relative;z-index:1}
@keyframes lsPlayIconBounce{0%,100%{transform:scale(1) translateX(0)}40%{transform:scale(1.15) translateX(1px)}70%{transform:scale(.95) translateX(0)}}

`;

function AuthGate() {
  const [user, setUser] = useState(() => {
    const savedUser = sessionStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // Decide the initial screen on load/reload:
  //   no token            → login
  //   token + unlocked    → erp   (unless the user deliberately stayed on setup)
  //   token + locked      → app   (launch setup)
  const [screen, setScreen] = useState(() => {
    const token = sessionStorage.getItem("token");
    if (!token) return 'login';
    if (isErpUnlocked() && !sessionStorage.getItem('forceSetup')) return 'erp';
    return 'app';
  });

  function handleLogin(userData) {
    setUser(userData);
    // launchSetup === 1 → go straight to the ERP screen, otherwise launch setup.
    if (isErpUnlocked() && !sessionStorage.getItem('forceSetup')) { setScreen('erp'); return; }
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

  if (screen === 'erp') {
    return (
      <ErpApp
        onExitToSetup={() => { sessionStorage.setItem('forceSetup', '1'); setScreen('app'); }}
        onLogout={() => { sessionStorage.clear(); setUser(null); setScreen('login'); }}
      />
    );
  }

  return (
    <AppShell
      user={user}
      onLogout={() => { sessionStorage.clear(); setUser(null); setScreen('login'); }}
      onOpenErp={() => setScreen('erp')}
    />
  );
}

export default function App() {
  return (
    <AppProvider>
      <AuthGate />
    </AppProvider>
  );
}

