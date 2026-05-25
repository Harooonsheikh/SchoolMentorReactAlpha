import { createContext, useContext, useState, useCallback } from 'react';
import { INITIAL_CLASSES, INITIAL_SUBJECTS, INITIAL_DEPARTMENTS, INITIAL_STAFF, INITIAL_STUDENTS } from '../data/seedData';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // ── Theme ──
  const [isDark, setIsDark] = useState(false);
  const toggleTheme = () => setIsDark(d => !d);

  // ── Sidebar ──
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const openSidebar  = () => setSidebarOpen(true);
  const closeSidebar = () => setSidebarOpen(false);

  // ── Navigation ──
  const [activeTab, setActiveTab] = useState('school');
  const switchTab = useCallback((tab) => {
    setActiveTab(tab);
    closeSidebar();
  }, []);

  // ── ERP Dialog ──
  const [erpDialogOpen, setErpDialogOpen] = useState(false);

  // ── Toast ──
  const [toasts, setToasts] = useState([]);
  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  // ── School Data ──
  const [schoolData, setSchoolData] = useState({
    schoolName: '', email: '', phone: '', country: '', province: '', city: '',
    address: '', session: '', logo: null, accountNo: '', iban: '',
  });

  // ── Classes ──
  const [classesData, setClassesData]         = useState(INITIAL_CLASSES);
  const [subjectsData, setSubjectsData]       = useState(INITIAL_SUBJECTS);
  const [departmentsData, setDepartmentsData] = useState(INITIAL_DEPARTMENTS);
  const [staffData, setStaffData]             = useState(INITIAL_STAFF);
  const [studentsData, setStudentsData]       = useState(INITIAL_STUDENTS);

  // ── Timetable ──
  const [timetableData, setTimetableData] = useState({});

  // ── Setup progress ──
  const completedSteps = {
    school:      Object.values(schoolData).filter(Boolean).length > 4,
    classes:     classesData.length > 0,
    subjects:    subjectsData.length > 0,
    departments: departmentsData.length > 0,
    staff:       staffData.length > 0,
    student:     studentsData.length > 0,
    timetable:   Object.keys(timetableData).length > 0,
  };
  const completedCount = Object.values(completedSteps).filter(Boolean).length;
  const progressPct    = Math.round((completedCount / 7) * 100);

  return (
    <AppContext.Provider value={{
      // Theme
      isDark, toggleTheme,
      // Sidebar
      sidebarOpen, openSidebar, closeSidebar,
      // Navigation
      activeTab, switchTab,
      // ERP dialog
      erpDialogOpen, setErpDialogOpen,
      // Toast
      toasts, showToast,
      // Data
      schoolData, setSchoolData,
      classesData, setClassesData,
      subjectsData, setSubjectsData,
      departmentsData, setDepartmentsData,
      staffData, setStaffData,
      studentsData, setStudentsData,
      timetableData, setTimetableData,
      // Progress
      completedSteps, completedCount, progressPct,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
