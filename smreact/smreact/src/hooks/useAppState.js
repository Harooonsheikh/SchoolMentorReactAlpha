import { useState, useCallback } from 'react';
import { INITIAL_CLASSES, INITIAL_SUBJECTS, INITIAL_BOOK_LISTS, INITIAL_DEPARTMENTS, INITIAL_STAFF, SCHOOL_INFO_DEFAULTS } from '../data/initialData';

export function useAppState() {
  const [theme, setTheme] = useState('light');
  const [activeTab, setActiveTab] = useState('school');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [toasts, setToasts] = useState([]);

  // School Info
  const [schoolInfo, setSchoolInfo] = useState(SCHOOL_INFO_DEFAULTS);

  // Classes
  const [classesData, setClassesData] = useState(INITIAL_CLASSES);

  // Subjects
  const [subjectsData, setSubjectsData] = useState(INITIAL_SUBJECTS);
  const [bookLists, setBookLists] = useState(INITIAL_BOOK_LISTS);

  // Departments
  const [deptsData, setDeptsData] = useState(INITIAL_DEPARTMENTS);

  // Staff
  const [staffData, setStaffData] = useState(INITIAL_STAFF);

  // Student rows are derived from classesData x sections
  const [studentStrengths, setStudentStrengths] = useState({});
  const [manualReg, setManualReg] = useState(false);

  // Timetable: { classId_secName_day: periodsArray }
  const [timetableData, setTimetableData] = useState({});
  const [currentTTDay, setCurrentTTDay] = useState(0);

  const toggleTheme = useCallback(() => {
    setTheme(t => {
      const next = t === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  }, []);

  const showToast = useCallback((msg, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const markUnsaved = useCallback(() => setUnsavedChanges(true), []);
  const markSaved = useCallback(() => setUnsavedChanges(false), []);

  const switchTab = useCallback((tab) => {
    setActiveTab(tab);
  }, []);

  // Ensure bookLists has entries for new classes
  const ensureBookListEntry = useCallback((classId) => {
    setBookLists(prev => {
      if (prev[classId]) return prev;
      const entry = {};
      subjectsData.forEach(s => { entry[s] = ''; });
      return { ...prev, [classId]: entry };
    });
  }, [subjectsData]);

  return {
    theme, toggleTheme,
    activeTab, switchTab,
    sidebarOpen, setSidebarOpen,
    unsavedChanges, markUnsaved, markSaved,
    toasts, showToast,
    schoolInfo, setSchoolInfo,
    classesData, setClassesData,
    subjectsData, setSubjectsData,
    bookLists, setBookLists,
    deptsData, setDeptsData,
    staffData, setStaffData,
    studentStrengths, setStudentStrengths,
    manualReg, setManualReg,
    timetableData, setTimetableData,
    currentTTDay, setCurrentTTDay,
    ensureBookListEntry,
  };
}
